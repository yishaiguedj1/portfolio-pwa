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
    log(f"Parakeet הסתיים: {len(words)} מילים ב־{time.time() - t0:.0f} שניות")
    return {"engine": "parakeet", "model": MODEL, "language": "en", "words": words, "events": []}
