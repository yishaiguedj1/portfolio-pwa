"""תמלול מקומי וחינמי: NVIDIA Parakeet TDT 0.6B (דרך onnx-asr, רץ על CPU).

שעה של אודיו ≈ 10 דקות על 4 ליבות. האודיו נחתך לקטעים של עד ~40 שניות
בנקודות שקט (Silero VAD) כדי שמשפטים לא ייחתכו באמצע. התוצאה כוללת מילות
מילוי (um/uh) — טוב ליישור הכפוי. אין זיהוי דוברים (הדוברים מסומנים בהגהה).
"""

from __future__ import annotations

import time

import numpy as np

from .util import log

MODEL = "nemo-parakeet-tdt-0.6b-v2"   # אנגלית בלבד, הדיוק הגבוה ביותר במשפחה


def _chunks(segments: list[tuple[int, int]], n: int, sr: int, max_s: float = 40.0,
            pad: int = 0) -> list[tuple[int, int]]:
    """אורז קטעי דיבור לחלונות של עד max_s, חותך רק בשתיקות."""
    out = []
    max_len = int(max_s * sr)
    cur_s, cur_e = None, None
    for s, e in segments:
        if cur_s is None:
            cur_s, cur_e = s, e
        elif e - cur_s <= max_len:
            cur_e = e
        else:
            out.append((cur_s, cur_e))
            cur_s, cur_e = s, e
        while cur_e - cur_s > max_len * 1.5:          # דיבור רציף ארוך מאוד — חיתוך כפוי
            out.append((cur_s, cur_s + max_len))
            cur_s += max_len
    if cur_s is not None:
        out.append((cur_s, cur_e))
    # ריפוד קטן לכל צד, בתוך גבולות השתיקה
    res = []
    for i, (s, e) in enumerate(out):
        lo = max(0, s - pad) if i == 0 else max(s - pad, (out[i - 1][1] + s) // 2)
        hi = min(n, e + pad) if i == len(out) - 1 else min(e + pad, (e + out[i + 1][0]) // 2)
        res.append((lo, hi))
    return res


def tokens_to_words(tokens: list[str], ts: list[float], offset: float, chunk_end: float) -> list[dict]:
    words: list[dict] = []
    cur, cur_s = "", None
    starts = []
    for tok, t in zip(tokens, ts):
        if tok.startswith(" ") or tok.startswith("▁") or cur_s is None:
            if cur.strip():
                words.append({"w": cur.strip(), "s": cur_s})
                starts.append(cur_s)
            cur, cur_s = tok.replace("▁", " "), offset + t
        else:
            cur += tok
    if cur.strip():
        words.append({"w": cur.strip(), "s": cur_s})
    for i, w in enumerate(words):
        nxt = words[i + 1]["s"] if i + 1 < len(words) else min(chunk_end, w["s"] + 0.6)
        w["e"] = max(w["s"] + 0.04, min(nxt, w["s"] + 1.5))
        w["s"], w["e"] = round(w["s"], 3), round(w["e"], 3)
        w["spk"] = None
        w["conf"] = None
    return [w for w in words if w["w"] and w["w"] not in {",", "."}]


HOLE_S = 1.2      # דיבור (לפי Silero) בלי אף מילה — חור
HOLE_PAD = 2.0    # שוליים לחלון התמלול החוזר
WORD_S = 0.6      # כמה זמן "תופסת" מילה כשאין לה סוף אמיתי
QUIET_S = 2.5     # גם "שקט" ארוך: Silero מפספס דיבור ברעש (מסוק, רחוב — Undercover, ~70 מילים לפרק)
PIECE_S = 28.0    # חור ארוך מתומלל בחלקים


def _norm(w: str) -> str:
    return "".join(c for c in w.lower() if c.isalnum())


def holes(words: list[dict], segs: list[tuple[float, float]], total: float) -> list[tuple[int, float, float]]:
    """22/10/2026 (ניתוח המאגר): בחלון ארוך Parakeet מדלג לפעמים על משפט שלם — ב־Uber 28 מילים ב־0:35
    ו־11 ב־1:53, באמצע קטע דיבור רציף. חור = בין שתי מילים סמוכות יש לפחות HOLE_S שניות של דיבור.
    מחזיר (אינדקס המילה שאחריה החור, תחילה, סוף)."""
    out = []
    for i in range(len(words) + 1):
        a = words[i - 1]["s"] + WORD_S if i > 0 else 0.0
        b = words[i]["s"] if i < len(words) else total
        if b - a < HOLE_S:
            continue
        sp = sum(max(0.0, min(e, b) - max(s, a)) for s, e in segs)
        if sp >= HOLE_S or b - a >= QUIET_S:
            k = max(1, int(-(-(b - a) // PIECE_S)))
            step = (b - a) / k
            out += [(i, a + j * step, a + (j + 1) * step) for j in range(k)]
    return out


def rescue(words: list[dict], found: list[tuple[int, float, float]], recog, total: float) -> int:
    """תמלול חוזר של כל חור בחלון קצר משלו; נכנסות רק מילים שמתחילות בתוך החור. recog(a, b) → מילים."""
    add: dict[int, list[dict]] = {}
    for i, a, b in found:
        prev = words[i - 1] if i > 0 else None
        nxt = words[i] if i < len(words) else None
        lo = max((prev["s"] + 0.05) if prev else 0.0, a if add.get(i) is not None else 0.0)
        hi = (nxt["s"] - 0.05) if nxt else total
        hi = min(hi, b) if b < hi - 0.5 else hi            # חלק שאינו האחרון — רק מה שמתחיל בתוכו
        got = [w for w in recog(max(0.0, a - HOLE_PAD), min(total, b + HOLE_PAD)) if lo < w["s"] < hi]
        if prev:                                      # אותה מילה שכבר נשמעה לפני החור ("slash slash", "W-I-S-P… i s p")
            pv = _norm(prev["w"])
            while got and (_norm(got[0]["w"]) == pv or (pv.endswith(_norm(got[0]["w"])) and len(pv) > 4)
                           or (len(_norm(got[0]["w"])) == 1 and len(pv) > 4 and _norm(got[0]["w"]) in pv)):
                got = got[1:]
        if got and nxt and _norm(got[-1]["w"]) == _norm(nxt["w"]):
            got = got[:-1]
        add.setdefault(i, [])
        if got:
            if nxt:
                got[-1]["e"] = min(got[-1]["e"], nxt["s"])
            add[i] += got
    if not any(add.values()):
        return 0
    res = []
    for i in range(len(words) + 1):
        res += add.get(i, [])
        if i < len(words):
            res.append(words[i])
    for i in range(len(res) - 1):                     # המילה שלפני החור נגמרת לפני המילה שנוספה
        if res[i]["e"] > res[i + 1]["s"]:
            res[i]["e"] = round(max(res[i]["s"] + 0.04, res[i + 1]["s"]), 3)
    n = len(res) - len(words)
    words[:] = res
    return n


def transcribe(wav_path: str, quantization: str | None = "int8", batch: int = 4) -> dict:
    import onnx_asr
    import soundfile as sf

    t0 = time.time()
    audio, sr = sf.read(wav_path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    if sr != 16000:
        raise ValueError("נדרש WAV ב־16kHz (vt ingest מייצר כזה)")
    model = onnx_asr.load_model(MODEL, quantization=quantization).with_timestamps()
    vad = onnx_asr.load_vad("silero")
    segs = list(next(vad.segment_batch(audio[None, :], np.array([len(audio)]), 16000,
                                       min_silence_duration_ms=150, max_speech_duration_s=3600,
                                       min_speech_duration_ms=150, speech_pad_ms=0)))
    chunks = _chunks(segs, len(audio), sr, pad=int(0.12 * sr))
    log(f"Parakeet: {len(chunks)} קטעים, {len(audio) / sr / 60:.1f} דקות אודיו")
    words: list[dict] = []
    for i in range(0, len(chunks), batch):
        part = chunks[i:i + batch]
        res = model.recognize([audio[s:e] for s, e in part], sample_rate=16000)
        for (s, e), r in zip(part, res):
            if r.tokens:
                words += tokens_to_words(r.tokens, r.timestamps, s / sr, e / sr)
        if (i // batch) % 10 == 0:
            done = part[-1][1] / sr
            log(f"  {done / 60:.1f}/{len(audio) / sr / 60:.1f} דק׳ ({time.time() - t0:.0f} שנ׳)")
    total = len(audio) / sr
    found = holes(words, [(a / sr, b / sr) for a, b in segs], total)
    if found:
        def recog(a: float, b: float) -> list[dict]:
            r = model.recognize(audio[int(a * sr):int(b * sr)], sample_rate=16000)
            return tokens_to_words(r.tokens, r.timestamps, a, b) if r.tokens else []
        n = rescue(words, found, recog, total)
        log(f"Parakeet: {len(found)} חורים בדיבור — תמלול חוזר החזיר {n} מילים")
    log(f"Parakeet הסתיים: {len(words)} מילים ב־{time.time() - t0:.0f} שניות")
    return {"engine": "parakeet", "model": MODEL, "language": "en", "words": words, "events": []}
