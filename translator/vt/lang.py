"""A12 (01/11/2026, סבב 2 של השדרוג): קטעים בסרטון שאינם באנגלית.

Parakeet מתמלל אנגלית בלבד: על משפט בספרדית הוא כותב "אנגלית" פונטית בביטחון נמוך. כאן:
  1. מועמדים — רצפים של מילים בביטחון נמוך (conf), באורך של 2 שנ׳ לפחות.
  2. זיהוי שפה בכל מועמד — whisper-small רב־לשוני (faster-whisper, ct2 int8; Systran/faster-whisper-small, MIT).
  3. שפה אחרת בביטחון גבוה → תמלול בשפה שלה.
התוצאה: foreign.json בפרויקט — {"v": 1, "seg": [{"s", "e", "lg", "p", "tx"}]}. **המילים של התמליל לא משתנות**
(edit-import בונה את en.words.json מחדש בכל align); התרגום מקבל את הקטעים כבלוק נתונים (pipeline.foreign_block),
והעורך מציג את המקור (notes). בלי המודל בתמונה — בלי השלב, כמו קודם.
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


def ready() -> bool:
    return (Path(LID_DIR) / "model.bin").is_file()


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


def detect(wav: str, words: list[dict], model=None) -> list[dict]:
    """[{s, e, lg, p, tx}] — רק קטעים שזוהו בביטחון כשפה שאינה אנגלית."""
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
    out = []
    for s, e in cand:
        clip = audio[int(s * SR):int(e * SR)]
        if len(clip) < SR:
            continue
        segs, info = m.transcribe(clip, beam_size=5, condition_on_previous_text=False, vad_filter=False)
        lg, p = getattr(info, "language", "") or "", float(getattr(info, "language_probability", 0) or 0)
        if lg in ("", "en") or p < P_MIN:
            continue
        tx = " ".join(x.text.strip() for x in segs).strip()[:TX_MAX]
        if tx:
            out.append({"s": s, "e": e, "lg": lg[:5], "p": round(p, 2), "tx": tx})
    return out


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
