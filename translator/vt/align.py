"""יישור כפוי (forced alignment) — זמן מדויק לכל מילה לפי האודיו.

אחרי שהטקסט הוגה ונקבע, Qwen3-ForcedAligner-0.6B מחשב לכל מילה זמן התחלה
וסוף (סטייה ממוצעת של עשרות מילישניות בלבד בבנצ'מרקים — הכלי המדויק ביותר
הזמין ב־2026). רץ גם על CPU: כ־8 דקות לשעת אודיו.

המודל מקבל עד ~3 דקות בכל פעם, לכן חותכים לקטעים בנקודות שקט בין מילים,
ומיישרים כל קטע בנפרד. מילה שהיישור שלה חשוד (רחוק מהזמן המשוער) נשארת
בזמן המשוער ומסומנת.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import unicodedata
from pathlib import Path

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
    def __init__(self, device: str = "cpu", dur_min: float = 0.0):
        # שלב 4.1 (10/10/2026): גרפי ONNX INT8 מהמודל הרשמי, כשהם בתמונה (/opt/aligner) — חצי זיכרון ומהיר יותר
        # (נמדד על 4 הרצאות TED, יומן העבודה). תקלה בטעינה = חוזרים ל־torch, לא נכשלים.
        self.onnx = None
        if device == "cpu":
            from .align_onnx import OnnxAligner, onnx_dir
            d = onnx_dir()
            if d is not None:
                try:
                    self.onnx = OnnxAligner(d, dur_min=dur_min)
                    self.engine = "onnx-" + str(self.onnx.man.get("quant", "?"))
                    return
                except Exception as e:  # noqa: BLE001 — כל תקלה בגרפים: המנוע הקודם
                    log(f"⚠ גרפי ה־ONNX של היישור לא נטענו ({type(e).__name__}: {str(e)[:80]}) — ממשיכים ב־torch")
        self.engine = "torch"
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
        if self.onnx is not None:
            items = self.onnx.align(audio, sr, text, "English")          # [(טקסט, התחלה, סוף)]
        else:
            res = self.model.align(audio=(audio.astype(np.float32), sr), text=text, language="English")[0]
            items = [(it.text, it.start_time, it.end_time) for it in res]
        out: list[tuple[float, float] | None] = [None] * len(words)
        if len(items) == len(idx):
            for k, i in enumerate(idx):
                out[i] = (items[k][1], items[k][2])
        else:
            import difflib
            a = [toks[i].lower() for i in idx]
            b = [it[0].lower() for it in items]
            sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
            for tag, i1, i2, j1, j2 in sm.get_opcodes():
                if tag == "equal":
                    for k in range(i2 - i1):
                        it = items[j1 + k]
                        out[idx[i1 + k]] = (it[1], it[2])
        return out


class PartCache:
    """21/10/2026: התוצאות של כל קטע נשמרות לקובץ תוך כדי (align.part.json בפרויקט) — יישור של שעה וחצי שנקטע
    (השרת הופעל מחדש) ממשיך מהקטע שנעצר בו, לא מההתחלה. המפתח = המילים והחלוקה: קובץ של יישור אחר לא נקרא.
    התוצאה זהה בדיוק (המודל דטרמיניסטי); תקלה בקובץ = מיישרים כרגיל."""

    EVERY = 15.0

    def __init__(self, path, part: str, key_src):
        self.path = Path(path) if path else None
        self.part = part
        self.key = hashlib.sha1(json.dumps(key_src, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]
        self.data, self.t = {}, 0.0
        if not self.path:
            return
        try:
            d = json.loads(self.path.read_text(encoding="utf-8"))
            self.all = d if isinstance(d, dict) else {}
        except (OSError, ValueError):
            self.all = {}
        sec = self.all.get(part)
        if isinstance(sec, dict) and sec.get("k") == self.key and isinstance(sec.get("r"), dict):
            self.data = sec["r"]

    def get(self, i):
        return self.data.get(str(i))

    def put(self, i, res, force=False):
        if not self.path:
            return
        self.data[str(i)] = [[float(x) for x in r] if r is not None else None for r in res]   # numpy → float (JSON)
        if not force and time.time() - self.t < self.EVERY:
            return
        self.t = time.time()
        try:
            self.all[self.part] = {"k": self.key, "r": self.data}
            tmp = self.path.with_suffix(".tmp")
            tmp.write_text(json.dumps(self.all), encoding="utf-8")
            os.replace(tmp, self.path)
        except (OSError, TypeError, ValueError):
            pass


def align_words(words: list[dict], wav_path: str, device: str = "cpu",
                max_dev_s: float = 1.2, cache: str | None = None) -> tuple[list[dict], dict]:
    import soundfile as sf
    audio, sr = sf.read(wav_path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    total = len(audio) / sr
    chunks = plan_chunks(words, audio_len=total)
    pc = PartCache(cache, "q", [[w["w"], w["s"], w["e"]] for w in words] + [list(c) for c in chunks])
    al = Aligner(device, total / 60) if len(pc.data) < len(chunks) else None
    t0 = time.time()
    stats = {"chunks": len(chunks), "aligned": 0, "kept_approx": 0, "suspicious": 0, "engine": al.engine if al else "cache",
             "cached": 0}
    for ci, (i0, i1, cs, ce) in enumerate(chunks):
        res = pc.get(ci)
        if res is not None and len(res) == i1 - i0:
            stats["cached"] += 1
        else:
            if al is None:
                al = Aligner(device, total / 60)
                stats["engine"] = al.engine
            seg = audio[int(cs * sr):int(ce * sr)]
            res = al.align_chunk(seg, sr, words[i0:i1])
            pc.put(ci, res, force=ci + 1 == len(chunks))
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
