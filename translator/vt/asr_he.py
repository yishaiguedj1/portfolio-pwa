"""תמלול עברי לניתוח סרטונים (V13, גל 0 — docs/studio-video-analysis-plan.md 3.2 שלב 4, 16.2 PR 0.1).

הבעיה (מחקר docs/research/video-analysis/04-audio-asr.md §1): ivrit turbo מוביל את הלוח העברי, אבל בפענוח רציף
של 5 דקות השמיט משפטים שלמים (WER ‏17.3% משפט־משפט → 48.6–49.2% ברצף, חורים של 6–15 שנ׳). השרשרת כאן:

  1. VAD — Silero של faster-whisper (המודל בתוך החבילה, בלי רשת), סף נמוך (0.35; ‏0.5 איבד דיבור במחקר) →
     קטעים של עד SEG_MAX שנ׳ בגבולות שקט. כל קטע מפוענח לבד ב־ivrit turbo (ct2 int8, ‏language='he', בלי הקשר
     מקטע קודם — בלי לולאות), כמה קטעים במנה (BatchedInferencePipeline עם clip_timestamps: כל קטע עצמאי).
  2. zipformer עברי (sherpa-onnx, ‏CC-BY-4.0 — Yakov Kolani / ivrit.ai) על **כל** ציר הזמן — הקטעים והרווחים
     שביניהם. "מנוע שני" זול (RTF ‏0.05–0.09, ‏~0.24GB) שלא משמיט משפטים.
  3. בדיקת כיסוי: קטע שבו ל־ivrit הרבה פחות מילים מאשר ל־zipformer, או סימני הזיה (יחס דחיסה, log-prob),
     ודיבור ש־zipformer שמע ברווח שה־VAD דילג עליו → פענוח חוזר בחלקים קטנים יותר (עם temperature fallback).
     עדיין חסר → הטקסט של zipformer לקטע (src='zf'). ivrit כתב כשאין דיבור (zipformer לא שמע כלום, ו־ivrit
     עצמו "לא בטוח") → הטקסט נזרק (src='drop').
  4. נפילה: בלי ivrit — zipformer לבד ו־quality='low' (‏vi_asr_low); בלי zipformer — ivrit בלי בדיקת כיסוי.

הפלט: קטעים עם זמן וטקסט (זמן לכל מילה — בשלב היישור, ‏vt/align_he.py). הספים מהמחקר; מכיילים ב־PR 0.4.
המודלים טוענים רק מהתמונה (בלי רשת). כל הלוגיקה — פונקציות טהורות שנבדקות בלי מודלים (tests/test_asr_he.py).
"""

from __future__ import annotations

import bisect
import difflib
import os
import re
import sys
import time
import unicodedata
from pathlib import Path

V = 1                                    # ‏vh — גרסת שרשרת התמלול העברי (ממדי הגרסה, נספח 19.6)
IVRIT_DIR = os.environ.get("SNB_VI_IVRIT") or os.environ.get("SNB_KA_IVRIT") or "/opt/karaoke-he/ivrit"
ZF_DIR = os.environ.get("SNB_VI_ZF") or "/opt/vi/zf"
VI_PY = os.environ.get("SNB_VI_PY") or "/opt/vi/py"            # sherpa-onnx (infra/worker/requirements-vi.lock)
SEPDEPS = os.environ.get("SNB_SEPDEPS") or "/opt/sepdeps"       # faster-whisper + ctranslate2
SR = 16000

VAD_TH = 0.35            # סף הדיבור של Silero (מחקר: 0.5 מצא 222.5 שנ׳ דיבור מתוך 303.7, ‏0.2 — 253.4)
VAD_SIL_MS = 300         # שקט שסוגר קטע
VAD_PAD_MS = 150         # ריפוד לכל צד
VAD_MIN_MS = 200         # קטע דיבור קצר מזה — נזרק
SEG_MAX = 14.0           # קטע לפענוח: עד 14 שנ׳ (מחקר: ‏≤10–15 בגבולות שקט)
SEG_TARGET = 10.0        # מאחדים קטעי VAD שכנים עד האורך הזה
JOIN_GAP = 0.6           # ...כשהשקט ביניהם קצר מזה
Z_MIN = 4                # פחות מילים מזה אצל zipformer — אין על מה לשפוט
COVER = 0.6              # מילים של ivrit / מילים של zipformer מתחת לזה = חשד להשמטה
CR_MAX = 2.4             # יחס דחיסה מעל זה = לולאה (ברירת המחדל של faster-whisper)
LP_MIN = -1.0            # log-prob ממוצע מתחת לזה = ivrit לא בטוח
NSP_MAX = 0.6            # הסתברות "אין דיבור" מעל זה
GAP_WORDS = 3            # zipformer שמע לפחות כך מילים ברווח בין קטעים → קטע חדש לפענוח
GAP_MIN_S = 1.0
GAP_PIECE = 60.0         # רווח ארוך (מוזיקה, הפסקה) — ל־zipformer בחלקים של עד דקה
SPLIT_MIN_S = 2.0        # חלק בפענוח החוזר — לפחות 2 שנ׳
HOLE_MIN = 4             # "חור": רצף של לפחות 4 מילות zipformer שאין להן מקבילה אצל ivrit...
HOLE_S = 1.5             # ...שנמשך לפחות 1.5 שנ׳ (השמטה בתוך קטע — ספירת מילים לא תופסת אותה)
SOFT = 0.6               # מילה של zipformer "דומה" למילה של ivrit (איות שונה) — נחשבת מותאמת
ZF_SHARE_LOW = 0.15      # יותר מ־15% מהדיבור בטקסט של zipformer = איכות נמוכה
COVER_LOW = 0.75         # כיסוי כולל (מילים ivrit / zipformer) מתחת לזה = איכות נמוכה
TAIL_S = 1.5             # שקט בסוף כל זרם — zipformer מסיים את החלק האחרון (כרטיס המודל)
BEAM = 5
BATCH = max(1, int(os.environ.get("VI_ASR_BATCH") or 1))
ZF_FILES = ("encoder.int8.onnx", "decoder.int8.onnx", "joiner.int8.onnx", "tokens.txt")

HEB = re.compile("[א-ת]")
NIQQUD = re.compile("[֑-ׇ]")
_PUNCT = re.compile(r"[^\wא-ת%$₪]+")


def _paths() -> None:
    for p in (SEPDEPS, VI_PY):
        if os.path.isdir(p) and p not in sys.path:
            sys.path.append(p)


def ivrit_ready() -> bool:
    return (Path(IVRIT_DIR) / "model.bin").is_file()


def zf_ready() -> bool:
    return all((Path(ZF_DIR) / f).is_file() for f in ZF_FILES)


def _threads() -> int:
    try:
        n = len(os.sched_getaffinity(0))
    except (AttributeError, OSError):
        n = os.cpu_count() or 4
    return max(1, min(16, n))


# ---------------------------------------------------------------- טקסט

def norm_words(text: str) -> list[str]:
    """מילים להשוואה וספירה: NFC, בלי ניקוד, בלי סימני כיוון ופיסוק; גרש וגרשיים אחידים."""
    t = unicodedata.normalize("NFC", text or "")
    t = NIQQUD.sub("", t).replace("׳", "'").replace("״", '"')
    out = []
    for w in t.split():
        w = _PUNCT.sub("", w).lower()
        if w:
            out.append(w)
    return out


def similarity(a: str, b: str) -> float:
    """הסכמה בין שני תמלולים (0–1) — יחס הרצפים על המילים המנורמלות."""
    x, y = norm_words(a), norm_words(b)
    if not x and not y:
        return 1.0
    return round(difflib.SequenceMatcher(a=x, b=y, autojunk=False).ratio(), 3)


# ---------------------------------------------------------------- 1. חלוקה לקטעים

def plan_segments(spans: list[tuple[float, float]], total: float, seg_max: float | None = None,
                  target: float | None = None, gap: float | None = None) -> list[tuple[float, float]]:
    """קטעי VAD → קטעים לפענוח: שכנים עם שקט קצר מתאחדים עד target, וקטע ארוך מ־seg_max נחתך לחלקים שווים.
    פונקציה טהורה; הזמנים בשניות, בתוך [0, total]. ברירות המחדל — הקבועים של המודול בזמן הקריאה (כיול)."""
    seg_max = SEG_MAX if seg_max is None else seg_max
    target = SEG_TARGET if target is None else target
    gap = JOIN_GAP if gap is None else gap
    sp = sorted((max(0.0, float(s)), min(float(total), float(e))) for s, e in spans if e > s)
    merged: list[list[float]] = []
    for s, e in sp:
        if merged and s - merged[-1][1] <= gap and e - merged[-1][0] <= target:
            merged[-1][1] = max(merged[-1][1], e)
        elif merged and s < merged[-1][1]:          # חפיפה (ריפוד) — ממשיכים את הקודם
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    out = []
    for s, e in merged:
        n = max(1, int(-(-(e - s) // seg_max)))     # ceil
        step = (e - s) / n
        for k in range(n):
            out.append((round(s + k * step, 3), round(s + (k + 1) * step if k < n - 1 else e, 3)))
    return out


def tile(segs: list[tuple[float, float]], total: float, piece: float = GAP_PIECE) -> list[tuple[float, float, int]]:
    """כל ציר הזמן ברצף: הקטעים (סוג 1) והרווחים ביניהם (סוג 0, רווח ארוך — בחלקים של עד piece) — ל־zipformer."""
    out, t = [], 0.0
    for s, e in segs:
        if s - t > 0.05:
            _gap_pieces(out, t, s, piece)
        out.append((s, e, 1))
        t = e
    if total - t > 0.05:
        _gap_pieces(out, t, total, piece)
    return out


def _gap_pieces(out: list, a: float, b: float, piece: float) -> None:
    n = max(1, int(-(-(b - a) // piece)))
    step = (b - a) / n
    for k in range(n):
        out.append((round(a + k * step, 3), round(a + (k + 1) * step if k < n - 1 else b, 3), 0))


# ---------------------------------------------------------------- 2. zipformer: טוקנים → מילים

def zf_words(tokens: list[str], ts: list[float], off: float = 0.0, end: float | None = None) -> list[dict]:
    """טוקני BPE של sherpa-onnx (רווח מוביל = תחילת מילה) וזמני הטוקנים (יחסית לתחילת הזרם) → מילים עם זמן מוחלט.
    סוף מילה = תחילת המילה הבאה (לכל היותר +0.8 שנ׳)."""
    out: list[dict] = []
    new = True
    for tok, t in zip(tokens or [], ts or []):
        if not tok.strip():
            new = True
            continue
        if new or tok[:1].isspace() or not out:
            out.append({"w": tok.strip(), "s": round(off + float(t), 2)})
            new = False
        else:
            out[-1]["w"] += tok
    for i, w in enumerate(out):
        nxt = out[i + 1]["s"] if i + 1 < len(out) else (end if end is not None else w["s"] + 0.8)
        w["e"] = round(min(max(w["s"] + 0.05, nxt), w["s"] + 0.8), 2)
    return [w for w in out if norm_words(w["w"])]


def words_in(words: list[dict], s: float, e: float) -> list[dict]:
    """מילים שאמצען בתוך [s, e)."""
    return [w for w in words if s <= (w["s"] + w.get("e", w["s"])) / 2 < e]


# ---------------------------------------------------------------- 3. בדיקת כיסוי ופענוח חוזר

def holes(text: str, zws: list[dict], min_words: int | None = None, min_s: float | None = None) -> list[tuple[float, float]]:
    """השמטות בתוך קטע (מדידה מקומית, 9/11/2026: באריזה לקטעים של 24 שנ׳ נשמטו 6 משפטים, והכיסוי הכולל עדיין 95%):
    יישור מילות ivrit מול מילות zipformer (רצפים על מילים מנורמלות; בתוך בלוק "החלפה" — מילה דומה נחשבת מותאמת),
    ורצף של לפחות HOLE_MIN מילות zipformer בלי מקבילה, שנמשך HOLE_S שנ׳ לפחות → [(התחלה, סוף)]."""
    min_words = HOLE_MIN if min_words is None else min_words
    min_s = HOLE_S if min_s is None else min_s
    a = norm_words(text)
    b, own = [], []
    for i, w in enumerate(zws):
        for x in norm_words(w["w"]):
            b.append(x)
            own.append(i)
    if not b:
        return []
    ok = [False] * len(b)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(a=a, b=b, autojunk=False).get_opcodes():
        if op == "equal":
            ok[j1:j2] = [True] * (j2 - j1)
        elif op == "replace":
            for j in range(j1, j2):
                ok[j] = any(difflib.SequenceMatcher(a=b[j], b=a[i]).ratio() >= SOFT for i in range(i1, i2))
    out, j = [], 0
    while j < len(b):
        if ok[j]:
            j += 1
            continue
        k = j
        while k < len(b) and not ok[k]:
            k += 1
        w0, w1 = zws[own[j]], zws[own[k - 1]]
        if k - j >= min_words and w1["e"] - w0["s"] >= min_s:
            out.append((w0["s"], w1["e"]))
        j = k
    return out


def suspicious(seg: dict) -> list[str]:
    """הסיבות לפענוח חוזר של קטע (ריק = תקין). seg: nw, nz (מילים מנורמלות של ivrit / zipformer), cr, lp, nsp,
    holes (מ־holes())."""
    nw, nz = seg.get("nw", 0), seg.get("nz", 0)
    why = []
    if nz >= Z_MIN and nw < COVER * nz:
        why.append("cover")
    elif seg.get("holes"):
        why.append("hole")
    if nw and (seg.get("cr") or 0) > CR_MAX:
        why.append("loop")
    if nz >= Z_MIN and (seg.get("lp") if seg.get("lp") is not None else 0) < LP_MIN:
        why.append("lp")
    return why


def phantom(seg: dict) -> bool:
    """ivrit כתב כשאין דיבור: zipformer לא שמע אף מילה, ו־ivrit עצמו מסמן אי־ודאות (no-speech / log-prob / לולאה)."""
    return seg.get("nz", 0) == 0 and seg.get("nw", 0) >= 1 and (
        (seg.get("nsp") or 0) > NSP_MAX or (seg.get("lp") if seg.get("lp") is not None else 0) < LP_MIN
        or (seg.get("cr") or 0) > CR_MAX)


def split_span(s: float, e: float, zw: list[dict], parts: int | None = None,
               min_s: float = SPLIT_MIN_S) -> list[tuple[float, float]]:
    """קטע לפענוח חוזר → 2–3 חלקים, נחתך ברווחים הגדולים בין מילות zipformer (שם יש שקט); בלי מילים — חלקים שווים."""
    dur = e - s
    if parts is None:
        parts = 3 if dur >= 3 * 4.0 else 2
    parts = max(1, min(parts, int(dur // min_s)))
    if parts <= 1:
        return [(s, e)]
    ws = sorted(words_in(zw, s, e), key=lambda w: w["s"])
    cuts: list[float] = []
    if len(ws) >= 2:
        gaps = sorted(((ws[i + 1]["s"] - ws[i]["e"], (ws[i]["e"] + ws[i + 1]["s"]) / 2) for i in range(len(ws) - 1)),
                      reverse=True)
        for _, c in gaps:
            if all(abs(c - x) >= min_s for x in cuts) and c - s >= min_s and e - c >= min_s:
                cuts.append(c)
            if len(cuts) == parts - 1:
                break
    if len(cuts) < parts - 1:
        cuts = [s + dur * k / parts for k in range(1, parts)]
    cuts = sorted(cuts)
    b = [s] + cuts + [e]
    return [(round(b[i], 3), round(b[i + 1], 3)) for i in range(len(b) - 1)]


def split_at(s: float, e: float, cuts: list[float], min_s: float = SPLIT_MIN_S) -> list[tuple[float, float]]:
    """חיתוך קטע בנקודות נתונות (גבולות "חור"), כך שכל חלק לפחות min_s; נקודה שלא עומדת בזה — מדלגים."""
    keep: list[float] = []
    for c in sorted(cuts):
        if c - s >= min_s and e - c >= min_s and (not keep or c - keep[-1] >= min_s):
            keep.append(c)
    b = [s] + keep + [e]
    return [(round(b[i], 3), round(b[i + 1], 3)) for i in range(len(b) - 1)]


def assign(spans: list[tuple[float, float]], segs: list) -> list[dict]:
    """תוצאות faster-whisper (start/end/text/avg_logprob/no_speech_prob/compression_ratio) → תוצאה אחת לכל קטע,
    לפי אמצע הזמן. קטע בלי תוצאה = טקסט ריק."""
    starts = [s for s, _ in spans]
    acc: list[list] = [[] for _ in spans]
    for g in segs:
        mid = (float(g.start) + float(g.end)) / 2
        i = max(0, bisect.bisect_right(starts, mid) - 1)
        acc[i].append(g)
    return [_merge(gs) for gs in acc]


def _merge(gs: list) -> dict:
    text = " ".join((g.text or "").strip() for g in gs).strip()
    if not gs:
        return {"text": "", "lp": None, "nsp": None, "cr": None}
    return {"text": text, "lp": round(min(float(g.avg_logprob) for g in gs), 3),
            "nsp": round(max(float(g.no_speech_prob) for g in gs), 3),
            "cr": round(max(float(g.compression_ratio) for g in gs), 3)}


# ---------------------------------------------------------------- המודלים (רק בשרת; בבדיקות — מוקים באותו ממשק)

def vad(audio, th: float | None = None) -> list[tuple[float, float]]:
    """Silero של faster-whisper (silero_vad_v6.onnx בתוך החבילה) → [(התחלה, סוף)] בשניות, כל אחד עד SEG_MAX."""
    _paths()
    from faster_whisper.vad import VadOptions, get_speech_timestamps
    opt = VadOptions(threshold=VAD_TH if th is None else th, min_silence_duration_ms=VAD_SIL_MS, speech_pad_ms=VAD_PAD_MS,
                     min_speech_duration_ms=VAD_MIN_MS, max_speech_duration_s=SEG_MAX)
    return [(x["start"] / SR, x["end"] / SR) for x in get_speech_timestamps(audio, opt)]


class Ivrit:
    """ivrit-ai/whisper-large-v3-turbo (ct2 int8) — אותו מודל של הקריוקי העברי (/opt/karaoke-he/ivrit)."""

    def __init__(self, path: str | None = None, threads: int | None = None, batch: int | None = None):
        _paths()
        from faster_whisper import BatchedInferencePipeline, WhisperModel
        path = path or IVRIT_DIR
        self.batch = batch = BATCH if batch is None else batch
        self.m = WhisperModel(path, device="cpu", compute_type="int8", cpu_threads=threads or _threads())
        self.bp = BatchedInferencePipeline(self.m) if batch > 1 else None

    def many(self, audio, spans: list[tuple[float, float]]) -> list[dict]:
        if not spans:
            return []
        if self.bp is None:
            return [self.one(audio, sp, temps=(0.0,)) for sp in spans]
        segs, _ = self.bp.transcribe(audio, language="he", beam_size=BEAM, batch_size=self.batch, vad_filter=False,
                                     clip_timestamps=[{"start": s, "end": e} for s, e in spans],
                                     without_timestamps=True, condition_on_previous_text=False)
        return assign(spans, list(segs))

    def one(self, audio, span: tuple[float, float], temps: tuple = (0.0, 0.2, 0.4)) -> dict:
        s, e = span
        segs, _ = self.m.transcribe(audio[int(s * SR):int(e * SR)], language="he", beam_size=BEAM, vad_filter=False,
                                    condition_on_previous_text=False, without_timestamps=True, temperature=list(temps))
        return _merge(list(segs))


class Zipformer:
    """zipformer2-66m-streaming-he (int8, ‏sherpa-onnx) — זרם נפרד לכל חלק, כמה זרמים במנה."""

    def __init__(self, path: str | None = None, threads: int | None = None):
        _paths()
        import sherpa_onnx as so
        d = Path(path or ZF_DIR)
        self.r = so.OnlineRecognizer.from_transducer(
            tokens=str(d / "tokens.txt"), encoder=str(d / "encoder.int8.onnx"), decoder=str(d / "decoder.int8.onnx"),
            joiner=str(d / "joiner.int8.onnx"), model_type="zipformer2", num_threads=threads or min(8, _threads()),
            decoding_method="greedy_search")

    def many(self, audio, spans: list[tuple[float, float]], batch: int = 16) -> list[list[dict]]:
        import numpy as np
        out: list[list[dict]] = []
        tail = np.zeros(int(TAIL_S * SR), dtype=np.float32)
        for i in range(0, len(spans), batch):
            part = spans[i:i + batch]
            streams = []
            for s, e in part:
                st = self.r.create_stream()
                st.accept_waveform(SR, np.ascontiguousarray(audio[int(s * SR):int(e * SR)], dtype=np.float32))
                st.accept_waveform(SR, tail)
                st.input_finished()
                streams.append(st)
            while True:
                ready = [st for st in streams if self.r.is_ready(st)]
                if not ready:
                    break
                self.r.decode_streams(ready)
            for (s, e), st in zip(part, streams):
                res = self.r.get_result_all(st)
                out.append(zf_words(list(res.tokens), list(res.timestamps), s, e))
        return out


def load_audio(wav: str):
    import numpy as np
    import soundfile as sf
    a, sr = sf.read(wav, dtype="float32")
    if getattr(a, "ndim", 1) > 1:
        a = a.mean(axis=1)
    if sr != SR:
        raise ValueError(f"צריך {SR}Hz, התקבל {sr}")
    return np.ascontiguousarray(a)


# ---------------------------------------------------------------- התזמור

def transcribe(audio, ivrit=None, zf=None, vad_fn=None, log=None) -> dict:
    """הקול (16kHz מונו, numpy) → {segments, quality, stats, timing}. ivrit/zf — אובייקטים עם many/one (או None),
    vad_fn(audio) → [(s, e)]. כל מודל שחסר — השרשרת ממשיכה בלעדיו (ראו בראש הקובץ)."""
    if ivrit is None and zf is None:
        raise RuntimeError("אין מודל תמלול עברי")
    say = log or (lambda m: None)
    total = len(audio) / SR
    tm: dict[str, float] = {}
    t0 = time.time()
    spans = (vad_fn or vad)(audio)
    tm["vad"] = round(time.time() - t0, 1)
    segs = plan_segments(spans, total)
    say(f"תמלול עברי: {len(spans)} קטעי VAD → {len(segs)} קטעים, {total / 60:.1f} דק׳")

    zw: list[dict] = []
    gaps: list[tuple[float, float, list]] = []
    if zf is not None:
        t0 = time.time()
        tl = tile(segs, total)
        res = zf.many(audio, [(s, e) for s, e, _ in tl])
        for (s, e, kind), ws in zip(tl, res):
            zw.extend(ws)
            if not kind:
                gaps.append((s, e, ws))
        tm["zf"] = round(time.time() - t0, 1)
        say(f"zipformer: {len(zw)} מילים ({tm['zf']} שנ׳)")

    # דיבור ש־zipformer שמע ברווח שה־VAD דילג עליו — קטעים חדשים (בגבולות המילים, עם ריפוד)
    extra = []
    for s, e, ws in gaps:
        if len(ws) >= GAP_WORDS and e - s >= GAP_MIN_S:
            a, b = max(s, ws[0]["s"] - 0.3), min(e, ws[-1]["e"] + 0.3)
            extra += plan_segments([(a, b)], total, target=SEG_MAX)
    allsegs = sorted(segs + extra)

    out = [{"s": s, "e": e, "text": "", "src": "w", "gap": 1 if (s, e) in extra else 0} for s, e in allsegs]
    for g in out:
        g_z = words_in(zw, g["s"], g["e"])
        g["nz"] = sum(len(norm_words(w["w"])) for w in g_z)
        g["zt"] = " ".join(w["w"] for w in g_z)

    if ivrit is None:                                        # נפילה: zipformer לבד
        for g in out:
            g.update(text=g["zt"], src="zf", nw=g["nz"], lp=None, nsp=None, cr=None)
    else:
        t0 = time.time()
        res = ivrit.many(audio, allsegs)
        tm["w"] = round(time.time() - t0, 1)
        for g, r in zip(out, res):
            g.update(text=r["text"], lp=r["lp"], nsp=r["nsp"], cr=r["cr"], nw=len(norm_words(r["text"])))
        say(f"ivrit: {sum(g['nw'] for g in out)} מילים ב־{len(out)} קטעים ({tm['w']} שנ׳)")
        if zf is not None:
            t0 = time.time()
            for g in out:
                g["holes"] = holes(g["text"], words_in(zw, g["s"], g["e"]))
            _repair(audio, out, zw, ivrit, say)
            tm["re"] = round(time.time() - t0, 1)

    st = _stats(out, spans, len(extra))
    q = "low" if (ivrit is None or (zf is not None and (st["zf_share"] > ZF_SHARE_LOW or
                                                         (st["cover"] is not None and st["cover"] < COVER_LOW)))) else "ok"
    eng = "ivrit+zf" if ivrit is not None and zf is not None else ("ivrit" if ivrit is not None else "zf")
    return {"v": V, "engine": eng, "language": "he", "dur": round(total, 2), "quality": q,
            "segments": [_public(g) for g in out], "stats": st, "timing": tm}


def _nz(zw: list[dict], s: float, e: float) -> int:
    return sum(len(norm_words(w["w"])) for w in words_in(zw, s, e))


def _repair(audio, out: list[dict], zw: list[dict], ivrit, say) -> None:
    """הזיות נזרקות; קטע חשוד מפוענח מחדש בחלקים — בגבולות החורים, אחרת ברווחים הגדולים בין המילים. קודם כל
    החלקים במנה אחת, ואז חלק שעדיין חסר או בלולאה — לבד עם temperature fallback. חלק שגם אז חסר (מילים מתחת
    ל־COVER ממה ש־zipformer שמע) — הטקסט של zipformer לחלק הזה. התוצאה מתקבלת רק אם היא לא קצרה מהקודמת."""
    todo = []
    for g in out:
        if phantom(g):
            g["text0"], g["text"], g["src"], g["nw"] = g["text"], "", "drop", 0
            continue
        why = suspicious(g)
        if why:
            g["why"] = why
            todo.append(g)
    if todo:
        parts = []
        for g in todo:
            hs = g.get("holes") or []
            ps = split_at(g["s"], g["e"], [x for h in hs for x in (h[0] - 0.3, h[1] + 0.3)]) if hs else []
            parts.append(ps if len(ps) > 1 else split_span(g["s"], g["e"], zw))
        res = ivrit.many(audio, [p for ps in parts for p in ps])
        k = 0
        for g, ps in zip(todo, parts):
            rs = res[k:k + len(ps)]
            k += len(ps)
            texts, zs = [], 0.0
            for j, p in enumerate(ps):
                pz, n = _nz(zw, *p), len(norm_words(rs[j]["text"]))
                if (rs[j]["cr"] or 0) > CR_MAX or (pz >= Z_MIN and n < COVER * pz):
                    r2 = ivrit.one(audio, p)
                    if len(norm_words(r2["text"])) > n and (r2["cr"] or 0) <= CR_MAX:
                        rs[j], n = r2, len(norm_words(r2["text"]))
                if (pz >= Z_MIN and n < COVER * pz) or (rs[j]["cr"] or 0) > CR_MAX:
                    texts.append(" ".join(w["w"] for w in words_in(zw, *p)))
                    zs += p[1] - p[0]
                else:
                    texts.append(rs[j]["text"])
            text = " ".join(t for t in texts if t).strip()
            nw = len(norm_words(text))
            if "loop" in g["why"]:                            # חזרות מנפחות מילים — הטקסט בלי הלולאה מתקבל גם אם קצר
                better = True
            else:
                better = nw >= g["nw"] and (nw > g["nw"] or
                                            len(holes(text, words_in(zw, g["s"], g["e"]))) < len(g.get("holes") or []))
            if better:
                g["text0"], g["text"], g["nw"] = g["text"], text, nw
                g["zs"] = round(zs, 2)
                g["src"] = "w2" if not zs else ("zf" if zs >= 0.9 * (g["e"] - g["s"]) else "mix")
    n = {k: sum(1 for g in out if g["src"] == k) for k in ("w2", "mix", "zf", "drop")}
    if todo or n["drop"]:
        say(f"בדיקת כיסוי: {len(todo)} חשודים — {n['w2']} פוענחו מחדש, {n['mix']} חלקית ו־{n['zf']} כולם "
            f"בטקסט של zipformer; {n['drop']} הזיות נזרקו")


def _stats(out: list[dict], spans: list, n_gap: int) -> dict:
    nw = sum(g.get("nw", 0) for g in out)
    nz = sum(g.get("nz", 0) for g in out)
    speech = sum(g["e"] - g["s"] for g in out) or 1.0
    zfs = sum(g["e"] - g["s"] if g["src"] == "zf" and "zs" not in g else g.get("zs", 0) for g in out)
    return {"n_vad": len(spans), "vad_s": round(sum(e - s for s, e in spans), 1), "n_seg": len(out), "n_gap": n_gap,
            "n_susp": sum(1 for g in out if g.get("why")), "n_w2": sum(1 for g in out if g["src"] == "w2"),
            "n_hole": sum(1 for g in out if "hole" in (g.get("why") or [])),
            "n_mix": sum(1 for g in out if g["src"] == "mix"),
            "n_zf": sum(1 for g in out if g["src"] == "zf"), "n_drop": sum(1 for g in out if g["src"] == "drop"),
            "w_words": nw, "z_words": nz, "cover": round(nw / nz, 3) if nz else None,
            "zf_share": round(zfs / speech, 3)}


def _public(g: dict) -> dict:
    """הקטע בפלט: תמיד s/e/text/src/nw/nz; המדדים של ivrit כשיש; why/gap/text0 רק כשרלוונטי."""
    out = {k: g.get(k) for k in ("s", "e", "text", "src")}
    out["nw"], out["nz"] = g.get("nw", 0), g.get("nz", 0)
    for k in ("lp", "nsp", "cr"):
        if g.get(k) is not None:
            out[k] = g[k]
    for k in ("why", "gap", "text0", "zs"):
        if g.get(k):
            out[k] = g[k]
    if g.get("holes"):
        out["holes"] = [[round(a, 2), round(b, 2)] for a, b in g["holes"]]
    return out


def run(wav: str, log=None, use_ivrit: bool = True, use_zf: bool = True) -> dict:
    """מהקובץ, עם המודלים שבתמונה. מודל שחסר או שנכשל בטעינה — בלעדיו (ראו בראש הקובץ)."""
    say = log or (lambda m: None)
    audio = load_audio(wav)
    iv = zf = None
    t0 = time.time()
    if use_zf and zf_ready():
        try:
            zf = Zipformer()
        except Exception as e:                   # noqa: BLE001 — נפילה שקטה, נרשם
            say(f"zipformer לא נטען: {type(e).__name__}: {e}")
    if use_ivrit and ivrit_ready():
        try:
            iv = Ivrit()
        except Exception as e:                   # noqa: BLE001
            say(f"ivrit לא נטען: {type(e).__name__}: {e}")
    if iv is None and zf is None:
        raise RuntimeError("אין מודל תמלול עברי בתמונה")
    load_s = round(time.time() - t0, 1)
    r = transcribe(audio, iv, zf, log=say)
    r["timing"]["load"] = load_s
    return r
