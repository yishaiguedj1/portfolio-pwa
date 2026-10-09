"""יישור כפוי (forced alignment) — זמן מדויק לכל מילה לפי האודיו.

אחרי שהטקסט הוגה ונקבע, Qwen3-ForcedAligner-0.6B מחשב לכל מילה זמן התחלה
וסוף (סטייה ממוצעת של עשרות מילישניות בלבד בבנצ'מרקים — הכלי המדויק ביותר
הזמין ב־2026). רץ גם על CPU: כ־8 דקות לשעת אודיו.

המודל מקבל עד ~3 דקות בכל פעם, לכן חותכים לקטעים בנקודות שקט בין מילים,
ומיישרים כל קטע בנפרד. מילה שהיישור שלה חשוד (רחוק מהזמן המשוער) נשארת
בזמן המשוער ומסומנת.
"""

from __future__ import annotations

import time
import unicodedata

import numpy as np

from .util import log

MODEL_ID = "Qwen/Qwen3-ForcedAligner-0.6B"
# 09/10/2026: 90 ולא 170 — נמדד על הרצאת TED של 5 דק׳ בתמונה של השרת: שיא הזיכרון 6.8GB → 6.05GB
# (בשרת עם 8GB הקונטיינר מוגבל ל־~6.6GB, ו־vt align נהרג באמצע), אותם זמנים (חציון הפרש 4ms)
# ופחות מילים "חשודות" (11 → 5). הזמן לא גדל (69 שנ׳ מול 82).
MAX_CHUNK_S = 90.0


def clean_token(w: str) -> str:
    """כמו במעבד של Qwen: אותיות, ספרות וגרש בלבד."""
    return "".join(ch for ch in w if ch == "'" or unicodedata.category(ch)[:1] in ("L", "N"))


def plan_chunks(words: list[dict], max_s: float = MAX_CHUNK_S, audio_len: float | None = None) -> list[tuple[int, int, float, float]]:
    """(i0, i1 לא כולל, התחלת אודיו, סוף אודיו) — חיתוך באמצע השתיקה הארוכה ביותר."""
    out = []
    i0, n = 0, len(words)
    while i0 < n:
        cs = max(0.0, words[i0]["s"] - 0.3)
        if i0 > 0:
            cs = max(cs, (words[i0 - 1]["e"] + words[i0]["s"]) / 2)
        j = i0
        while j + 1 < n and words[j + 1]["e"] - cs <= max_s:
            j += 1
        if j + 1 >= n:
            ce = words[n - 1]["e"] + 0.5
            if audio_len:
                ce = min(ce, audio_len)
            out.append((i0, n, cs, ce))
            break
        # השתיקה הארוכה ביותר ב־40% האחרונים של החלון
        lo = i0 + max(1, int((j - i0) * 0.6))
        best_k, best_gap = j, -1.0
        for k in range(lo, j + 1):
            gap = words[k + 1]["s"] - words[k]["e"] if k + 1 < n else 0.0
            if gap > best_gap:
                best_k, best_gap = k, gap
        ce = (words[best_k]["e"] + words[best_k + 1]["s"]) / 2
        out.append((i0, best_k + 1, cs, ce))
        i0 = best_k + 1
    return out


class Aligner:
    def __init__(self, device: str = "cpu"):
        import torch
        from qwen_asr import Qwen3ForcedAligner
        torch.set_num_threads(max(1, torch.get_num_threads()))
        dtype = torch.float32 if device == "cpu" else torch.bfloat16
        t0 = time.time()
        self.model = Qwen3ForcedAligner.from_pretrained(MODEL_ID, dtype=dtype, device_map=device)
        # שכבות הקונבולוציה של המקודד רצות על כל שניות החלק בבת אחת (conv_chunksize=500 בהגדרות המודל):
        # בחלק של 170 שנ׳ — כ־2GB רגעיים. כל שנייה מקודדת בנפרד, ולכן 16 בכל פעם = אותה תוצאה בדיוק
        # (נבדק 09/10/2026: 797 מתוך 797 מילים זהות), שיא 6.76→6.05GB ו־99→79 שנ׳ על 5 דק׳ של TED.
        at = getattr(getattr(getattr(self.model, "model", None), "thinker", None), "audio_tower", None)
        if at is not None and getattr(at, "conv_chunksize", 0) > 16:
            at.conv_chunksize = 16
        log(f"מודל היישור נטען ({time.time() - t0:.0f} שנ׳)")

    def align_chunk(self, audio: np.ndarray, sr: int, words: list[dict]) -> list[tuple[float, float] | None]:
        toks = [clean_token(w["w"]) for w in words]
        idx = [i for i, t in enumerate(toks) if t]
        if not idx:
            return [None] * len(words)
        text = " ".join(toks[i] for i in idx)
        res = self.model.align(audio=(audio.astype(np.float32), sr), text=text, language="English")[0]
        items = list(res)
        out: list[tuple[float, float] | None] = [None] * len(words)
        if len(items) == len(idx):
            for k, i in enumerate(idx):
                out[i] = (items[k].start_time, items[k].end_time)
        else:
            import difflib
            a = [toks[i].lower() for i in idx]
            b = [it.text.lower() for it in items]
            sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
            for tag, i1, i2, j1, j2 in sm.get_opcodes():
                if tag == "equal":
                    for k in range(i2 - i1):
                        it = items[j1 + k]
                        out[idx[i1 + k]] = (it.start_time, it.end_time)
        return out


def align_words(words: list[dict], wav_path: str, device: str = "cpu",
                max_dev_s: float = 1.2) -> tuple[list[dict], dict]:
    import soundfile as sf
    audio, sr = sf.read(wav_path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    total = len(audio) / sr
    chunks = plan_chunks(words, audio_len=total)
    al = Aligner(device)
    t0 = time.time()
    stats = {"chunks": len(chunks), "aligned": 0, "kept_approx": 0, "suspicious": 0}
    for ci, (i0, i1, cs, ce) in enumerate(chunks):
        seg = audio[int(cs * sr):int(ce * sr)]
        res = al.align_chunk(seg, sr, words[i0:i1])
        for k, r in enumerate(res):
            w = words[i0 + k]
            if r is None:
                stats["kept_approx"] += 1
                w["align"] = "approx"
                continue
            s, e = cs + r[0], cs + r[1]
            if abs(s - w["s"]) > max_dev_s and not w.get("edited"):
                stats["suspicious"] += 1
                w["align"] = "suspicious"
                continue
            w["s_asr"], w["e_asr"] = w["s"], w["e"]
            w["s"], w["e"] = round(s, 3), round(max(e, s + 0.02), 3)
            w["align"] = "qwen3"
            stats["aligned"] += 1
        log(f"  יישור {ci + 1}/{len(chunks)} ({ce / 60:.1f}/{total / 60:.1f} דק׳, {time.time() - t0:.0f} שנ׳)")
    _repair_order(words)
    stats["seconds"] = round(time.time() - t0, 1)
    return words, stats


def _repair_order(words: list[dict]) -> None:
    """מבטיח זמנים מונוטוניים; מילים שלא יושרו מקבלות זמן בין שכנותיהן."""
    n = len(words)
    for i, w in enumerate(words):
        if w.get("align") in ("approx", "suspicious"):
            prev_e = words[i - 1]["e"] if i > 0 else 0.0
            nxt_s = words[i + 1]["s"] if i + 1 < n else w["e"]
            if not (prev_e <= w["s"] < w["e"] <= max(nxt_s, w["s"] + 0.05)):
                w["s"] = round(max(prev_e, min(w["s"], nxt_s - 0.05)), 3)
                w["e"] = round(max(w["s"] + 0.05, min(w["e"], nxt_s)), 3)
    for i in range(1, n):
        if words[i]["s"] < words[i - 1]["s"]:
            words[i]["s"] = words[i - 1]["s"]
        if words[i]["e"] < words[i]["s"]:
            words[i]["e"] = words[i]["s"] + 0.02
