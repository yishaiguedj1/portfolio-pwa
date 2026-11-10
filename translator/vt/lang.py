"""A12 (01/11/2026, סבב 2 של השדרוג): קטעים בסרטון שאינם באנגלית.

Parakeet מתמלל אנגלית בלבד: על משפט בספרדית הוא כותב "אנגלית" פונטית בביטחון נמוך. כאן:
  1. מועמדים — רצפים של מילים בביטחון נמוך (conf), באורך של 2 שנ׳ לפחות.
  2. זיהוי שפה בכל מועמד — whisper-small רב־לשוני (faster-whisper, ct2 int8; Systran/faster-whisper-small, MIT).
  3. שפה אחרת בביטחון גבוה → תמלול בשפה שלה.
התוצאה: foreign.json בפרויקט — {"v": 1, "seg": [{"s", "e", "lg", "p", "tx"}]}. **המילים של התמליל לא משתנות**
(edit-import בונה את en.words.json מחדש בכל align); התרגום מקבל את הקטעים כבלוק נתונים (pipeline.foreign_block),
והעורך מציג את המקור (notes). בלי המודל בתמונה — בלי השלב, כמו קודם.

10/11/2026 — "השפה המדוברת בכל רגע" (בקשת המשתמש; docs/studio-worker.md):
  - לכל קטע גם המילים עם זמן (wd = [[מילה, התחלה, סוף]]). קטע בעברית מתומלל ב־ivrit (המודל של העברית), לא ב־whisper-small.
  - cue_lang: הכתוביות שבתוך קטע כזה מקבלות lg ו־src (המקור בשפה שלו, בזמני הכתובית) — הטלפון מציג אותו במקום הניחוש באנגלית.
  - detect_spans + transcribe_spans + merge_words: למסלול שבו התמלול הראשי לא באנגלית (ניתוח של סרטון בעברית) —
    זיהוי שפה בכל קטע של ivrit, וקטע בשפה אחרת מתומלל במנוע שלה (אנגלית — Parakeet; אחרת — whisper-small בשפה שזוהתה).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

LID_DIR = os.environ.get("SNB_LID_DIR") or "/opt/lid/whisper-small"
SEPDEPS = os.environ.get("SNB_SEPDEPS") or "/opt/sepdeps"          # faster-whisper + ctranslate2 (requirements-karaoke.lock)
SR = 16000
CONF_LOW = 0.5          # מילה "לא בטוחה" של Parakeet
MIN_S = 2.0             # קטע קצר מזה — לא שווה זיהוי (שם, קריאה)
JOIN_S = 1.0            # שני רצפים קרובים — קטע אחד
PAD_S = 0.3
MAX_S = 30.0            # חלון אחד של whisper
MAX_SEG = 30            # יותר מזה — כנראה רעש/מוזיקה, לא שפה אחרת
LOW_FRAC = 0.6          # לפחות 60% מהמילים ברצף בביטחון נמוך
P_MIN = 0.75            # ביטחון מינימלי בזיהוי השפה
TX_MAX = 400
WD_MAX = 400            # מילים לקטע (30 שנ׳ = ~100)
SRC_MAX = 600           # המקור של כתובית אחת (כמו en בטלפון)
P_SPAN = 0.8            # זיהוי על כל קטע (בלי סינון ביטחון של התמלול) — סף מחמיר יותר
IVRIT_DIR = os.environ.get("SNB_VI_IVRIT") or os.environ.get("SNB_KA_IVRIT") or "/opt/karaoke-he/ivrit"
LG_ALIAS = {"iw": "he", "jw": "jv"}     # קודים ישנים של whisper


def ready() -> bool:
    return (Path(LID_DIR) / "model.bin").is_file()


def ivrit_ready() -> bool:
    return (Path(IVRIT_DIR) / "model.bin").is_file()


def norm_lg(lg) -> str:
    x = str(lg or "").strip().lower()[:5]
    return LG_ALIAS.get(x, x)


def _collect(segs, off: float) -> tuple[str, list]:
    """קטעי faster-whisper (עם word_timestamps) → (טקסט, [[מילה, התחלה, סוף]]) בזמן המוחלט (off = תחילת הקטע).
    המילה נשמרת כמו שהיא (עם הרווח שלפניה) — כך שפות בלי רווחים (סינית, יפנית) מתחברות נכון ב־"".join"""
    parts, wd = [], []
    for x in segs:
        t = str(getattr(x, "text", "") or "").strip()
        if t:
            parts.append(t)
        for w in getattr(x, "words", None) or []:
            ww = str(getattr(w, "word", "") or "")
            a, b = getattr(w, "start", None), getattr(w, "end", None)
            if ww.strip() and isinstance(a, (int, float)) and isinstance(b, (int, float)) and len(wd) < WD_MAX:
                wd.append([ww, round(off + a, 3), round(off + max(a, b), 3)])
    return " ".join(parts).strip()[:TX_MAX], wd


def _ivrit():
    if os.path.isdir(SEPDEPS) and SEPDEPS not in sys.path:
        sys.path.append(SEPDEPS)
    from faster_whisper import WhisperModel
    return WhisperModel(IVRIT_DIR, device="cpu", compute_type="int8", cpu_threads=max(1, min(8, os.cpu_count() or 4)))


def candidates(words: list[dict]) -> list[tuple[float, float]]:
    """רצפים של מילים בביטחון נמוך → [(התחלה, סוף)] בשניות. מילה בביטחון גבוה באמצע לא שוברת רצף,
    כל עוד רוב המילים בו נמוכות (LOW_FRAC). פונקציה טהורה — נבדקת בלי מודל."""
    ws = [w for w in words if isinstance(w, dict) and isinstance(w.get("s"), (int, float)) and isinstance(w.get("e"), (int, float))]
    runs, cur = [], None
    for w in ws:
        c = w.get("conf")
        low = isinstance(c, (int, float)) and c < CONF_LOW
        if low:
            if cur and w["s"] - cur[1] <= JOIN_S:
                cur[1], cur[2], cur[3] = w["e"], cur[2] + 1, cur[3] + 1
            else:
                if cur:
                    runs.append(cur)
                cur = [w["s"], w["e"], 1, 1]
        elif cur and w["s"] - cur[1] <= JOIN_S:
            cur[1], cur[3] = w["e"], cur[3] + 1       # מילה בטוחה בתוך רצף — נספרת, לא שוברת
    if cur:
        runs.append(cur)
    out = []
    for s, e, lo, n in runs:
        if e - s >= MIN_S and lo / max(1, n) >= LOW_FRAC:
            a, b = max(0.0, s - PAD_S), e + PAD_S
            while b - a > MAX_S:                       # קטע ארוך — בחלונות
                out.append((round(a, 2), round(a + MAX_S, 2)))
                a += MAX_S
            out.append((round(a, 2), round(b, 2)))
    return out[:MAX_SEG] if len(out) <= MAX_SEG else []


def _model():
    if os.path.isdir(SEPDEPS) and SEPDEPS not in sys.path:
        sys.path.append(SEPDEPS)
    from faster_whisper import WhisperModel
    return WhisperModel(LID_DIR, device="cpu", compute_type="int8", cpu_threads=max(1, min(8, os.cpu_count() or 4)))


def detect(wav: str, words: list[dict], model=None, he_model=None) -> list[dict]:
    """[{s, e, lg, p, tx, wd}] — רק קטעים שזוהו בביטחון כשפה שאינה אנגלית. עברית — ב־ivrit (נטען רק כשנמצא קטע כזה)."""
    cand = candidates(words)
    if not cand:
        return []
    import soundfile as sf
    audio, sr = sf.read(wav, dtype="float32")
    if getattr(audio, "ndim", 1) > 1:
        audio = audio.mean(axis=1)
    if sr != SR:
        raise ValueError(f"צריך {SR}Hz, התקבל {sr}")
    m = model or _model()
    he = he_model
    out = []
    for s, e in cand:
        clip = audio[int(s * SR):int(e * SR)]
        if len(clip) < SR:
            continue
        segs, info = m.transcribe(clip, beam_size=5, condition_on_previous_text=False, vad_filter=False, word_timestamps=True)
        lg, p = norm_lg(getattr(info, "language", "")), float(getattr(info, "language_probability", 0) or 0)
        if lg in ("", "en") or p < P_MIN:
            continue
        tx, wd = "", []
        if lg == "he" and (he is not None or ivrit_ready()):
            try:
                he = he or _ivrit()
                tx, wd = _collect(he.transcribe(clip, language="he", beam_size=5, condition_on_previous_text=False,
                                                vad_filter=False, word_timestamps=True)[0], s)
            except Exception:  # noqa: BLE001 — בלי ivrit: התמלול של whisper-small
                tx, wd = "", []
        if not tx:
            tx, wd = _collect(segs, s)
        if tx:
            out.append({"s": s, "e": e, "lg": lg, "p": round(p, 2), "tx": tx, "wd": wd})
    return out


def detect_spans(audio, spans: list, primary: str, model=None, p_min: float = P_SPAN) -> list[dict]:
    """זיהוי שפה בכל קטע נתון (במסלול העברי — הקטעים של ivrit) → [{s, e, lg, p, i}], רק שפה אחרת בביטחון.
    רק הזיהוי (transcribe של faster-whisper מזהה מיד ומחזיר מחולל — לא עוברים עליו)."""
    m = model or _model()
    out = []
    for i, sp in enumerate(spans):
        s, e = float(sp[0]), float(sp[1])
        if e - s < MIN_S:
            continue
        clip = audio[int(s * SR):int(min(e, s + MAX_S) * SR)]
        if len(clip) < SR:
            continue
        _, info = m.transcribe(clip, beam_size=1, condition_on_previous_text=False, vad_filter=False)
        lg, p = norm_lg(getattr(info, "language", "")), float(getattr(info, "language_probability", 0) or 0)
        if lg and lg != primary and p >= p_min:
            out.append({"s": round(s, 3), "e": round(e, 3), "lg": lg, "p": round(p, 2), "i": i})
    return out[:MAX_SEG * 4]


VOTE_AT = (0.1, 0.25, 0.4, 0.55, 0.7, 0.85)   # main_lang: איפה דוגמים (לא ההתחלה — לרוב מוזיקה / פתיח)
VOTE_S = 20.0                                # אורך כל דגימה


def main_lang(audio, model=None, at=VOTE_AT, win_s: float = VOTE_S) -> dict:
    """10/11/2026 (ניתוח סרטונים, PR 1.2א — "אוטומטי", התוכנית 9.3 סעיף 2): השפה הראשית של ההקלטה.
    זיהוי שפה (whisper-small) על כמה דגימות לאורך ההקלטה; כל דגימה מצביעה בביטחון שלה, והשפה עם הסכום הגבוה זוכה.
    → {lg, p (חלק הקולות של הזוכה), n (דגימות)}. בלי דגימה מתאימה — lg ריק."""
    m = model or _model()
    dur = len(audio) / SR
    votes: dict = {}
    n = 0
    for f in at if dur > win_s * 2 else (0.0,):
        s = max(0.0, min(dur - win_s, dur * f))
        clip = audio[int(s * SR):int(min(dur, s + win_s) * SR)]
        if len(clip) < SR:
            continue
        _, info = m.transcribe(clip, beam_size=1, condition_on_previous_text=False, vad_filter=False)
        lg, p = norm_lg(getattr(info, "language", "")), float(getattr(info, "language_probability", 0) or 0)
        if lg:
            votes[lg] = votes.get(lg, 0.0) + p
            n += 1
    if not votes:
        return {"lg": "", "p": 0.0, "n": 0}
    lg = max(votes, key=lambda k: votes[k])
    return {"lg": lg, "p": round(votes[lg] / sum(votes.values()), 2), "n": n}


GAP_S = 1.0             # שקט בין קטעים כשמחברים אותם לקובץ אחד ל־Parakeet


def parakeet_spans(audio, spans: list, run=None) -> list[list]:
    """קטעים באנגלית → מילים לכל קטע ([[מילה, התחלה, סוף, ביטחון]], בזמן המוחלט). כל הקטעים בקובץ אחד עם שקט ביניהם —
    טעינה אחת של המודל. run(wav) → {"words": [{w, s, e, conf}]} (ברירת המחדל: asr_parakeet.transcribe)."""
    import numpy as np
    import soundfile as sf
    import tempfile
    gap = np.zeros(int(GAP_S * SR), dtype="float32")
    pieces, off, buf = [], 0.0, []
    for s, e in spans:
        clip = audio[int(s * SR):int(e * SR)]
        pieces.append((off, float(s), len(clip) / SR))
        buf += [clip, gap]
        off += len(clip) / SR + GAP_S
    if run is None:
        from .asr_parakeet import transcribe as run_p

        def run(w):
            return run_p(w, quantization="int8")
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "spans.wav")
        sf.write(wav, np.concatenate(buf) if buf else gap, SR)
        res = run(wav) or {}
    out = [[] for _ in spans]
    for w in res.get("words") or []:
        a, b = w.get("s"), w.get("e")
        if not w.get("w") or not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
            continue
        mid = (a + b) / 2
        for k, (o, s, d) in enumerate(pieces):
            if o <= mid < o + d:
                out[k].append([" " + str(w["w"]).strip(), round(s + a - o, 3), round(s + b - o, 3), w.get("conf")])
                break
    return out


def transcribe_spans(audio, found: list[dict], model=None, en_run=None) -> list[dict]:
    """הקטעים שזוהו (detect_spans) → אותם קטעים עם tx ו־wd: אנגלית ב־Parakeet (כולם יחד), אחרת whisper-small בשפה שזוהתה.
    קטע שלא יצאו לו מילים — נזרק (המילים של התמלול הראשי נשארות)."""
    out = []
    en = [g for g in found if g["lg"] == "en"]
    if en:
        try:
            ws = parakeet_spans(audio, [(g["s"], g["e"]) for g in en], run=en_run)
        except Exception:  # noqa: BLE001 — בלי Parakeet: whisper-small באנגלית
            ws = None
        if ws is not None:
            for g, wd in zip(en, ws):
                if wd:
                    out.append(dict(g, tx="".join(x[0] for x in wd).strip()[:TX_MAX], wd=wd[:WD_MAX]))
            en = []
    m = None
    for g in [x for x in found if x["lg"] != "en"] + en:
        m = m or model or _model()
        clip = audio[int(g["s"] * SR):int(g["e"] * SR)]
        tx, wd = _collect(m.transcribe(clip, language=g["lg"], beam_size=5, condition_on_previous_text=False,
                                       vad_filter=False, word_timestamps=True)[0], g["s"])
        if wd:
            out.append(dict(g, tx=tx, wd=wd))
    return sorted(out, key=lambda g: g["s"])


def merge_words(words: list[dict], seg: list[dict]) -> list[dict]:
    """המילים של התמלול הראשי שבתוך קטע בשפה אחרת (לפי אמצע המילה) מוחלפות במילים של הקטע, עם lg — ממוין לפי זמן.
    מילה של Parakeet שומרת את הביטחון (p). קטע בלי wd — לא נוגעים."""
    seg = [g for g in seg or [] if g.get("wd")]
    if not seg:
        return words
    keep = [w for w in words if not any(g["s"] <= (w["s"] + w["e"]) / 2 < g["e"] for g in seg)]
    add = []
    for g in seg:
        for x in g["wd"]:
            if str(x[0]).strip():
                w = {"w": str(x[0]).strip(), "s": x[1], "e": x[2], "lg": g["lg"]}
                if len(x) > 3 and isinstance(x[3], (int, float)):
                    w["p"] = x[3]
                add.append(w)
    return sorted(keep + add, key=lambda w: (w["s"], w["e"]))


def cue_lang(seg: list[dict], cues: list[dict]) -> int:
    """cues.final: כתובית שחצייה בתוך קטע בשפה אחרת מקבלת lg, ו־src = המילים של הקטע בזמני הדיבור שלה (הקטע כולו —
    רק כשהוא כתובית אחת). זה המקור שהטלפון מציג במקום הניחוש באנגלית. מחזיר כמה כתוביות סומנו."""
    m = cue_map(seg or [], cues)
    per = {}
    for g in m.values():
        per[id(g)] = per.get(id(g), 0) + 1
    n = 0
    for c in cues:
        if not isinstance(c, dict):
            continue
        c.pop("lg", None)
        c.pop("src", None)
        g = m.get(c.get("id"))
        if not g or not g.get("lg"):
            continue
        a, b = c.get("speech_s", c.get("start")), c.get("speech_e", c.get("end"))
        ws = [x[0] for x in g.get("wd") or [] if a - 0.15 <= (x[1] + x[2]) / 2 <= b + 0.15]
        src = "".join(ws).strip() if ws else (str(g.get("tx") or "") if per.get(id(g)) == 1 else "")
        c["lg"] = norm_lg(g["lg"])
        if src:
            c["src"] = src[:SRC_MAX]
        n += 1
    return n


def cue_map(seg: list[dict], cues: list[dict]) -> dict[int, dict]:
    """{מזהה כתובית: הקטע} — לפי חפיפה של זמני הדיבור של הכתובית (speech_s/speech_e, או start/end) עם הקטע.
    כתובית שחצי ממנה לפחות בתוך הקטע."""
    out = {}
    for c in cues:
        if not isinstance(c, dict) or not isinstance(c.get("id"), int):
            continue
        a = c.get("speech_s", c.get("start"))
        b = c.get("speech_e", c.get("end"))
        if not isinstance(a, (int, float)) or not isinstance(b, (int, float)) or b <= a:
            continue
        for g in seg:
            ov = min(b, g["e"]) - max(a, g["s"])
            if ov > 0 and ov >= 0.5 * (b - a):
                out[c["id"]] = g
                break
    return out
