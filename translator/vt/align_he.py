"""סנכרון מילים לשיר בעברית (31/10/2026) — השרשרת שנבדקה ואושרה בהאזנה (docs/studio-karaoke-he.md):

  1. ivrit (whisper-large-v3-turbo, ct2 int8, ‏Apache-2.0) מתמלל את הקול המופרד → עוגנים (vt/karaoke.anchor).
  2. stable-ts ‏align() עם אותו מודל על המילים הידועות — הבסיס, הכי מדויק לפי ההאזנה (כשהוא לא קורס).
  3. CTC עברי (imvladikon/wav2vec2-large-xlsr-53-hebrew, ‏Apache-2.0) בחלונות סביב העוגנים — הגיבוי.
  4. כללי ההחלפה מ־stable-ts ל־CTC (tools/karaoke-he/guard.py, אותם ספים).

היישור הכפוי של ה־CTC (Viterbi) כתוב כאן ב־numpy — אותו אלגוריתם ואותו שבירת שוויון של ctc-forced-aligner
(BSD-2, ‏forced_align_impl.cpp), כך שאין צורך בהרחבת C++. get_spans/postprocess — לפי אותה ספרייה.
כל תקלה בשלב 2 או 3 = השלב האחר לבד; בלי שניהם — העוגנים. בלי המודלים — karaoke.py נשאר בשרשרת האנגלית.
"""

from __future__ import annotations

import difflib
import json
import math
import os
import re
import sys
import time
from pathlib import Path

import numpy as np

from . import karaoke as K

IVRIT_DIR = os.environ.get("SNB_KA_IVRIT") or "/opt/karaoke-he/ivrit"
CTC_DIR = os.environ.get("SNB_KA_HECTC") or "/opt/karaoke-he/ctc"
HE_PY = os.environ.get("SNB_KA_HEPY") or "/opt/karaoke-he/py"          # stable_whisper (מקוד המקור — infra/worker/Dockerfile)
if os.path.isdir(HE_PY) and HE_PY not in sys.path:
    sys.path.append(HE_PY)
SR = 16000
PAD, MAXW, GAP = 1.0, 28.0, 2.5      # חלונות ה־CTC: שוליים · אורך מרבי · פער בין עוגנים שמפצל חלון
TH = 0.7                             # סטייה בין stable-ts ל־CTC שנחשבת קריסה (רצף של 2+ מילים)
AGREE = 0.4                          # רוב 2 מ־3: CTC ו־ivrit מסכימים עד כאן
STRETCH = 1.2                        # מילה פותחת שורה ש־stable-ts מתח מעבר לזה
HEB = re.compile("[א-ת]")
NIQQUD = re.compile("[֑-ׇ]")


def is_hebrew(lines: list[list[str]]) -> bool:
    """שיר עברי = לפחות 30% מהאותיות במילים עבריות."""
    letters = [c for ln in lines for w in ln for c in w if c.isalpha()]
    heb = sum(1 for c in letters if HEB.match(c))
    return heb > 0 and heb >= 0.3 * len(letters)


def ready() -> bool:
    """שני המודלים בתמונה (בלי רשת)."""
    return (Path(IVRIT_DIR) / "model.bin").is_file() and (Path(CTC_DIR) / "vocab.json").is_file() and \
        (Path(CTC_DIR) / "model.safetensors").is_file()


def _threads() -> int:
    return max(1, min(16, os.cpu_count() or 4))


def load_audio(wav: str) -> np.ndarray:
    import soundfile as sf
    a, sr = sf.read(wav, dtype="float32")
    if a.ndim > 1:
        a = a.mean(axis=1)
    if sr != SR:
        raise ValueError(f"צריך {SR}Hz, התקבל {sr}")
    return np.ascontiguousarray(a)


# ---------------------------------------------------------------- 1–2. ivrit: תמלול (עוגנים) ו־stable-ts align

def load_ivrit():
    import stable_whisper
    return stable_whisper.load_faster_whisper(IVRIT_DIR, device="cpu", compute_type="int8", cpu_threads=_threads())


def transcribe(model, audio: np.ndarray, vad: bool = True) -> list[dict]:
    """language='he' חובה (זיהוי השפה של ivrit פגוע); בלי הקשר מהקטע הקודם; VAD."""
    tr = getattr(model, "transcribe_original", model.transcribe)     # stable-ts עוטף את transcribe — כאן המקורי
    kw = {"vad_filter": True, "vad_parameters": {"min_silence_duration_ms": 500}} if vad else {"vad_filter": False}
    segs, _ = tr(audio, language="he", word_timestamps=True, condition_on_previous_text=False, beam_size=5, **kw)
    out = []
    for s in segs:
        for w in s.words or []:
            out.append({"w": w.word.strip(), "s": round(float(w.start), 3), "e": round(float(w.end), 3)})
    return out


def matched(lines: list[list[str]], asr: list[dict]) -> int:
    """כמה ממילות השיר התמלול שמע (אותה התאמת רצפים של vt/karaoke.anchor)."""
    a = [K.norm(w) for ln in lines for w in ln]
    b = [K.norm(str(x.get("w", ""))) for x in asr]
    return sum(m.size for m in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks())


def hits(lines: list[list[str]], asr: list[dict]) -> list[bool]:
    """לכל מילה בשיר — האם התמלול שמע אותה (אותה התאמה של vt/karaoke.anchor; השאר = ניחוש)."""
    a = [K.norm(w) for ln in lines for w in ln]
    b = [K.norm(str(x.get("w", ""))) for x in asr]
    out = [False] * len(a)
    for m in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        out[m.a:m.a + m.size] = [True] * m.size
    return out


COVER = 0.6     # 31/10/2026: ה־VAD הפיל משפטים שלמים בבדיקה (89 מתוך 179 מילים) — מתחת לזה, תמלול שני בלי VAD


def anchors_asr(model, audio: np.ndarray, lines: list[list[str]]) -> tuple[list[dict], dict]:
    asr = transcribe(model, audio)
    n, tot = matched(lines, asr), sum(map(len, lines)) or 1
    info = {"asr_hit": round(n / tot, 2), "vad": 1}
    if n < COVER * tot:
        alt = transcribe(model, audio, vad=False)
        m = matched(lines, alt)
        info["asr_hit2"] = round(m / tot, 2)
        if m > n:
            asr, info["vad"] = alt, 0
    return asr, info


def st_align(model, audio: np.ndarray, lines: list[list[str]]) -> list[dict]:
    r = model.align(audio, "\n".join(" ".join(ln) for ln in lines), language="he", original_split=True)
    return [{"w": w.word.strip(), "s": round(float(w.start), 3), "e": round(float(w.end), 3)}
            for s in r.segments for w in s.words if w.word.strip()]


def map_to(words: list[dict], got: list[dict]) -> list[dict | None]:
    """תוצאה של כלי (מילים אולי בחלוקה אחרת) → מילה־למילה מול המילים של השיר. מה שלא הותאם = None."""
    if len(got) == len(words):
        return list(got)
    a = [K.norm(w["w"]) for w in words]
    b = [K.norm(x["w"]) for x in got]
    out: list[dict | None] = [None] * len(words)
    for blk in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            out[blk.a + k] = got[blk.b + k]
    return out


# ---------------------------------------------------------------- 3. CTC עברי בחלונות

def load_ctc():
    import torch
    from transformers import Wav2Vec2ForCTC
    torch.set_num_threads(_threads())
    m = Wav2Vec2ForCTC.from_pretrained(CTC_DIR, torch_dtype=torch.float32).eval()
    vocab = json.loads((Path(CTC_DIR) / "vocab.json").read_text(encoding="utf-8"))
    return m, {k.lower(): int(v) for k, v in vocab.items()}


def emissions(model, seg: np.ndarray) -> np.ndarray:
    """log-softmax לכל 20ms + עמודת <star> של אפסים (כמו generate_emissions בחלון אחד, בלי נרמול)."""
    import torch
    with torch.inference_mode():
        lg = model(torch.from_numpy(seg)[None]).logits[0]
    lp = torch.log_softmax(lg.float(), dim=-1).numpy()
    return np.concatenate([lp, np.zeros((lp.shape[0], 1), np.float32)], axis=1).astype(np.float32)


def viterbi(lp: np.ndarray, tg: np.ndarray, blank: int) -> tuple[np.ndarray, np.ndarray]:
    """יישור CTC כפוי (torchaudio/ctc-forced-aligner): הנתיב (טוקן לכל פריים) והציון של כל פריים."""
    T, L = lp.shape[0], len(tg)
    R = int(np.sum(tg[1:] == tg[:-1]))
    if L == 0 or T < L + R:
        raise ValueError("הטקסט ארוך מדי לחלון")
    S = 2 * L + 1
    ext = np.full(S, blank, dtype=np.int64)
    ext[1::2] = tg
    skip = np.zeros(S, bool)
    skip[3::2] = tg[1:] != tg[:-1]
    e = lp[:, ext]
    neg = np.float32(-np.inf)
    alpha = np.full(S, neg, np.float32)
    alpha[0], alpha[1] = e[0, 0], e[0, 1]
    bp = np.zeros((T, S), np.int8)
    for t in range(1, T):
        x0 = alpha
        x1 = np.concatenate(([neg], alpha[:-1]))
        x2 = np.where(skip, np.concatenate(([neg, neg], alpha[:-2])), neg)
        c2 = (x2 > x1) & (x2 > x0)
        c1 = ~c2 & (x1 > x0) & (x1 > x2)
        alpha = np.where(c2, x2, np.where(c1, x1, x0)) + e[t]
        bp[t] = np.where(c2, 2, np.where(c1, 1, 0))
    s = S - 1 if alpha[S - 1] > alpha[S - 2] else S - 2
    path = np.empty(T, np.int64)
    for t in range(T - 1, -1, -1):
        path[t] = ext[s]
        s -= int(bp[t, s])
    return path, lp[np.arange(T), path]


def _segments(path):
    segs, i = [], 0
    while i < len(path):
        j = i
        while j < len(path) and path[j] == path[i]:
            j += 1
        segs.append((int(path[i]), i, j - 1))
        i = j
    return segs


def _spans(tokens: list[list[int]], segs, blank: int):
    """לכל טוקן (מילה או <star>) — הקטעים שלו בנתיב, עם חצי מהריק שלפניו ואחריו (get_spans)."""
    ti, li, start, iv = 0, 0, 0, []
    for si, (lab, _, _) in enumerate(segs):
        if ti == len(tokens) or lab == blank:
            continue
        if lab != tokens[ti][li]:
            raise ValueError("נתיב לא תואם")
        if li == 0:
            start = si
        if li == len(tokens[ti]) - 1:
            li, ti = 0, ti + 1
            iv.append((start, si))
        else:
            li += 1
    spans = []
    for k, (a, b) in enumerate(iv):
        s0, s1 = segs[a][1], segs[b][2]
        if a > 0 and segs[a - 1][0] == blank:
            p = segs[a - 1]
            s0 = p[1] if k == 0 else int((p[1] + p[2]) / 2)
        if b + 1 < len(segs) and segs[b + 1][0] == blank:
            n = segs[b + 1]
            s1 = n[2] if k == len(iv) - 1 else math.floor((n[1] + n[2]) / 2)
        spans.append((s0, s1))
    return spans


def _letters(w: str, d: dict) -> list[int]:
    w = NIQQUD.sub("", w).replace("׳", "'").replace("′", "").lower()
    return [d[c] for c in w if c in d and c not in ("|", "[pad]", "[unk]", "<pad>", "<unk>", "<s>", "</s>")]


def windows(words: list[dict], total: float) -> list[list[int]]:
    """שורות רצופות לפי העוגנים; מתפצלות בפער גדול או כשהחלון ארוך מדי."""
    by_line: dict[int, list[int]] = {}
    for i, w in enumerate(words):
        by_line.setdefault(int(w["li"]), []).append(i)
    chunks, cur = [], []
    for li in sorted(by_line):
        idx = by_line[li]
        if cur and (words[idx[0]]["s"] - words[cur[-1]]["e"] > GAP or words[idx[-1]]["e"] - words[cur[0]]["s"] > MAXW):
            chunks.append(cur)
            cur = []
        cur += idx
    if cur:
        chunks.append(cur)
    return chunks


def ctc_align(model, d: dict, audio: np.ndarray, words: list[dict]) -> list[dict | None]:
    """31/10/2026: גבולות החלון לפי העוגנים, כמו שנבדק. ניסיתי למתוח חלון שקצהו לא נשמע עד העוגן האמיתי הקרוב —
    ה־CTC "ברח" לתחילת הפתיחה (0.0 במקום 12.2 שנ׳), כמו שהמחקר הזהיר. לכן לא."""
    total = len(audio) / SR
    blank = d.get("[pad]", d.get("<pad>", 0))
    res: list[dict | None] = [None] * len(words)
    for ch in windows(words, total):
        a = max(0.0, words[ch[0]]["s"] - PAD)
        b = min(total, words[ch[-1]]["e"] + PAD)
        try:
            lp = emissions(model, audio[int(a * SR):int(b * SR)].copy())
            star = lp.shape[1] - 1
            toks, keep = [], []
            for i in ch:
                t = _letters(words[i]["w"], d)
                if t:
                    toks += [[star], t]
                    keep.append(i)
            if not keep:
                continue
            path, sc = viterbi(lp, np.asarray([x for t in toks for x in t], np.int64), blank)
            sp = _spans(toks, _segments(path), blank)
        except (ValueError, RuntimeError):
            continue                                  # החלון הזה — בלי CTC (stable-ts או העוגן)
        stride = 0.02
        for k, i in enumerate(keep):
            s0, s1 = sp[2 * k + 1]
            res[i] = {"w": words[i]["w"], "s": round(a + s0 * stride, 3), "e": round(a + (s1 + 1) * stride, 3),
                      "p": round(float(sc[s0:s1 + 1].mean()), 3)}
    return res


# ---------------------------------------------------------------- 4. כללי ההחלפה (tools/karaoke-he/guard.py)

def _judge(anc: list[dict], hit: list[bool]):
    """31/10/2026: השופט במחלוקת = העוגן רק כש־ivrit באמת שמע את המילה. מילה שלא נשמעה — הזמן שלה רק ניחוש (אינטרפולציה),
    ולכן "שופט" = הטווח בין העוגנים האמיתיים שלפניה ואחריה: זמן בתוך הטווח = מרחק 0. בבדיקה (שיר סינתטי, ivrit שמע 44%)
    העוגן המנוחש בחר ב־CTC שגוי בפתיחה (+7.5 שנ׳) במקום stable-ts שצדק."""
    n = len(anc)
    prev, nxt, last = [None] * n, [None] * n, None
    for i in range(n):
        prev[i] = last
        if hit[i]:
            last = anc[i]["s"]
    last = None
    for i in range(n - 1, -1, -1):
        nxt[i] = last
        if hit[i]:
            last = anc[i]["s"]

    def dist(i: int, t: float) -> float:
        if hit[i]:
            return abs(t - anc[i]["s"])
        lo = (prev[i] if prev[i] is not None else 0.0) - 1.0
        hi = (nxt[i] if nxt[i] is not None else float("inf")) + 1.0
        return 0.0 if lo <= t <= hi else min(abs(t - lo), abs(t - hi))
    return dist


def guard(st: list[dict], ct: list[dict], anc: list[dict], lines: list[list[str]], hit: list[bool] | None = None) -> list[bool]:
    """True = לקחת את ה־CTC במקום stable-ts. שלושה כללים (docs/studio-karaoke-he.md). hit = ivrit שמע את המילה."""
    n = len(st)
    hit = [True] * n if hit is None else hit
    dist = _judge(anc, hit)
    bad = [abs(st[i]["s"] - ct[i]["s"]) > TH for i in range(n)]
    for i in range(1, n - 1):
        if bad[i - 1] and bad[i + 1]:
            bad[i] = True
    run, i = [False] * n, 0                           # קריסה = רצף של 2+ מילים
    while i < n:
        j = i
        while j < n and bad[j]:
            j += 1
        if j - i >= 2:
            run[i:j] = [True] * (j - i)
        i = max(j, i + 1)
    out = [run[i] and dist(i, ct[i]["s"]) < dist(i, st[i]["s"]) for i in range(n)]
    for i in range(n):                                # רוב 2 מ־3 (רק מול עוגן אמיתי)
        if hit[i] and abs(ct[i]["s"] - anc[i]["s"]) <= AGREE and abs(st[i]["s"] - anc[i]["s"]) > TH and abs(st[i]["s"] - ct[i]["s"]) > TH:
            out[i] = True
    first, k = set(), 0                               # מילה פותחת שורה שנמתחה אחורה
    for ln in lines:
        first.add(k)
        k += len(ln)
    for i in first:
        if i < n and st[i]["e"] - st[i]["s"] > STRETCH and st[i]["s"] + AGREE < ct[i]["s"] < st[i]["e"]:
            out[i] = True
    return out


def repair(out: list[dict], st: list[dict | None], ct: list[dict | None]) -> int:
    """31/10/2026: מילה שיוצאת מהסדר מול שכנותיה (שמסכימות ביניהן) — הכלי השני אם הוא בטווח, אחרת בין השכנות.
    בבדיקה: מילה בלי CTC קיבלה את stable-ts שקרס (127 שנ׳ במקום 94), ומעבר הרציפות גרר אחריה 30 מילים."""
    n, fixed = len(out), 0
    for i in range(n):
        p = out[i - 1]["s"] if i > 0 else None
        q = out[i + 1]["s"] if i + 1 < n else None
        s = out[i]["s"]
        if not ((p is not None and s < p - TH) or (q is not None and s > q + TH)):
            continue
        if p is not None and q is not None and q < p:
            continue                                  # השכנות עצמן לא מסכימות — אין על מה לסמוך
        lo = p - TH if p is not None else -1e9
        hi = q + TH if q is not None else 1e9
        alt = [(src, x) for src, x in (("st", st[i]), ("ctc", ct[i])) if x is not None and lo <= x["s"] <= hi]
        if alt:
            src, x = alt[0]
            out[i].update(s=float(x["s"]), e=float(x["e"]), align=src)
        else:
            a = max(p if p is not None else (q - 0.3), (q if q is not None else p + 0.3) - 0.3)
            out[i].update(s=round(a, 3), e=round(a + 0.3, 3), align="fix")
        fixed += 1
    return fixed


def merge(words: list[dict], st: list[dict | None], ct: list[dict | None], lines: list[list[str]],
          hit: list[bool] | None = None) -> tuple[list[dict], int]:
    """stable-ts כבסיס; ה־CTC איפה שהכללים אומרים או איפה ש־stable-ts חסר; העוגן כשאין אף אחד. חריגים, ואז רציפות."""
    hit = [True] * len(words) if hit is None else hit
    both = [i for i in range(len(words)) if st[i] is not None and ct[i] is not None]
    sw = guard([st[i] for i in both], [ct[i] for i in both], [words[i] for i in both], _sub_lines(lines, both),
               [hit[i] for i in both]) if both else []
    pick = dict(zip(both, sw))
    out = []
    for i, w in enumerate(words):
        if st[i] is not None and not pick.get(i, False):
            src, x = "st", st[i]
        elif ct[i] is not None:
            src, x = "ctc", ct[i]
        else:
            src, x = "anchor", w
        out.append({"w": w["w"], "li": w["li"], "s": float(x["s"]), "e": float(x["e"]), "align": src})
    repair(out, st, ct)
    for i in range(1, len(out)):
        if out[i]["s"] < out[i - 1]["s"] + 0.02:
            out[i]["s"] = round(out[i - 1]["s"] + 0.02, 3)
        if out[i - 1]["e"] > out[i]["s"]:
            out[i - 1]["e"] = out[i]["s"]
        out[i]["e"] = max(out[i]["e"], round(out[i]["s"] + 0.08, 3))
    if out:
        out[0]["e"] = max(out[0]["e"], round(out[0]["s"] + 0.08, 3))
    return out, sum(1 for x in out if x["align"] == "ctc")


def _sub_lines(lines: list[list[str]], keep: list[int]) -> list[list[str]]:
    """השורות אחרי סינון המילים (רק אלה שיש להן גם stable-ts וגם CTC) — לכלל "מילה פותחת שורה"."""
    ks, out, k = set(keep), [], 0
    for ln in lines:
        cur = [w for j, w in enumerate(ln) if k + j in ks]
        k += len(ln)
        if cur:
            out.append(cur)
    return out


def align_hebrew(lines: list[list[str]], wav: str) -> tuple[list[dict], dict]:
    audio = load_audio(wav)
    t0 = time.time()
    st_stats: dict = {"engine": "he"}
    model = load_ivrit()
    asr, info = anchors_asr(model, audio, lines)
    st_stats.update(info)
    t1 = time.time()
    words = K.anchor(lines, asr)
    hit = hits(lines, asr)
    try:
        st = map_to(words, st_align(model, audio, lines))
    except Exception as e:                            # stable-ts נפל — ה־CTC לבד
        print("· stable-ts: " + str(e)[:160], flush=True)
        st = [None] * len(words)
    del model
    t2 = time.time()
    try:
        cm, d = load_ctc()
        ct = ctc_align(cm, d, audio, words)
        del cm
    except Exception as e:
        print("· CTC: " + str(e)[:160], flush=True)
        ct = [None] * len(words)
    t3 = time.time()
    out, n_ctc = merge(words, st, ct, lines, hit)
    st_stats.update(asr=len(asr), asr_s=round(t1 - t0, 1), st_s=round(t2 - t1, 1), ctc_s=round(t3 - t2, 1),
                    st=sum(1 for x in st if x is not None), ctc=sum(1 for x in ct if x is not None), from_ctc=n_ctc,
                    from_st=sum(1 for w in out if w["align"] == "st"), fix=sum(1 for w in out if w["align"] == "fix"),
                    anchor=sum(1 for w in out if w["align"] == "anchor"))
    print(f"⏱ עברית: ivrit {t1 - t0:.0f} · stable-ts {t2 - t1:.0f} · CTC {t3 - t2:.0f} שנ׳ (ליבות={_threads()})", flush=True)
    return out, st_stats
