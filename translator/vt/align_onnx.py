"""יישור כפוי ב־ONNX Runtime (שלב 4.1 בתוכנית, 10/10/2026) — אותו מודל (Qwen3-ForcedAligner-0.6B),
בלי torch בזמן הריצה ובמשקולות INT8 במקודד ובמפענח.

הגרפים נוצרים מהמודל הרשמי (translator/aligner_export.py) — לא משקולות של צד שלישי. רק החלק הכבד מוחלף
(`thinker(**inputs).logits.argmax(-1)`); המעבד של Qwen (מל, טוקנים) ומפענח הזמנים נשארים בדיוק כמו שהם.

זרימה לחלק אחד: מל (128×T) → חלקי 100 פריימים → audio-conv (FP32) + קידוד מיקומי → audio-encoder (חלונות
קשב של 104 פריימים, כמו cu_seqlens) → מוזרק במקום טוקני האודיו → text-decoder (+argmax) → זמנים ×80ms.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path

import numpy as np

from .util import log

FILES = ("audio-conv.onnx", "audio-encoder.onnx", "text-decoder.onnx", "embed.npy", "pos.npy")


def onnx_dir() -> Path | None:
    """תיקיית הגרפים: SNB_ALIGN_ONNX, אחרת /opt/aligner (בתמונת העובד). None = אין — נופלים ל־torch."""
    if os.environ.get("SNB_ALIGN", "").lower() == "torch":
        return None
    d = Path(os.environ.get("SNB_ALIGN_ONNX") or "/opt/aligner")
    if all((d / f).is_file() for f in FILES) and (d / "manifest.json").is_file() and (d / "model").is_dir():
        return d
    return None


def out_len(n: int) -> int:
    """_get_feat_extract_output_lengths של Qwen: אורך אחרי שלוש הקונבולוציות (100 פריימים → 13)."""
    r = n % 100
    f = (r - 1) // 2 + 1
    return ((f - 1) // 2 + 1 - 1) // 2 + 1 + (n // 100) * 13


_VERIFIED: dict[str, dict] = {}


def verify(d: Path) -> dict:
    """הקבצים תואמים ל־manifest (sha256) — גרף שהשתנה בדיסק לא נטען. פעם אחת לתהליך (Qwen ו־CTC חולקים)."""
    if str(d) in _VERIFIED:
        return _VERIFIED[str(d)]
    man = json.loads((d / "manifest.json").read_text())
    for f, want in man["sha256"].items():
        h = hashlib.sha256()
        with open(d / f, "rb") as fh:
            for b in iter(lambda: fh.read(1 << 22), b""):
                h.update(b)
        if h.hexdigest() != want:
            raise RuntimeError(f"aligner_onnx_hash:{f}")
    _VERIFIED[str(d)] = man
    return man


def session(path: Path, threads: int | None = None):
    """InferenceSession עם הגדרות המחקר: בלי "סיבוב" של תהליכונים מחכים (שורף ליבות שאחרים צריכים),
    תהליכון בין־אופרטורים אחד, כל הליבות שמותרות לתהליך בתוך אופרטור."""
    import onnxruntime as ort
    so = ort.SessionOptions()
    so.intra_op_num_threads = threads or len(os.sched_getaffinity(0))
    so.inter_op_num_threads = 1
    so.add_session_config_entry("session.intra_op.allow_spinning", "0")
    so.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(str(path), so, providers=["CPUExecutionProvider"])


class OnnxAligner:
    def __init__(self, d: Path, threads: int | None = None):
        from qwen_asr.core.transformers_backend import Qwen3ASRConfig, Qwen3ASRProcessor
        from qwen_asr.inference.qwen3_forced_aligner import Qwen3ForceAlignProcessor
        from transformers import AutoConfig, AutoProcessor
        t0 = time.time()
        self.man = verify(d)
        AutoConfig.register("qwen3_asr", Qwen3ASRConfig, exist_ok=True)
        AutoProcessor.register(Qwen3ASRConfig, Qwen3ASRProcessor, exist_ok=True)
        self.processor = AutoProcessor.from_pretrained(str(d / "model"), fix_mistral_regex=True)
        self.ap = Qwen3ForceAlignProcessor()
        cfg = json.loads((d / "model" / "config.json").read_text())
        self.ts_id = int(cfg["timestamp_token_id"])
        self.seg_ms = float(cfg["timestamp_segment_time"])
        self.audio_id = int(cfg["thinker_config"]["audio_token_id"])
        self.conv = session(d / "audio-conv.onnx", threads)
        self.enc = session(d / "audio-encoder.onnx", threads)
        self.dec = session(d / "text-decoder.onnx", threads)
        self.embed = np.load(d / "embed.npy", mmap_mode="r")      # float16, ‏(vocab, 1024) — רק השורות שצריך
        self.pos = np.load(d / "pos.npy")
        log(f"מודל היישור (ONNX {self.man.get('quant', '?')}) נטען ({time.time() - t0:.0f} שנ׳)")

    def audio_features(self, mel: np.ndarray) -> np.ndarray:
        """(128, T) → (T', 1024), בדיוק כמו Qwen3ASRAudioEncoder.forward לאודיו אחד."""
        T = mel.shape[1]
        k = -(-T // 100)
        pad = np.zeros((k, 1, 128, 100), np.float32)
        lens = []
        for i in range(k):
            c = mel[:, i * 100:(i + 1) * 100]
            pad[i, 0, :, :c.shape[1]] = c
            lens.append(out_len(c.shape[1]))
        y = self.conv.run(None, {"x": pad})[0]                     # (k, 13, 1024)
        y = y + self.pos[: y.shape[1]][None].astype(np.float32)
        h = np.concatenate([y[i, :lens[i]] for i in range(k)], 0)
        assert h.shape[0] == out_len(T)
        return self.enc.run(None, {"h": h.astype(np.float32)})[0]

    def align(self, audio: np.ndarray, sr: int, text: str, language: str = "English"):
        from qwen_asr.inference.utils import normalize_audios
        word_list, ai_text = self.ap.encode_timestamp(text, language)
        wav = normalize_audios([(audio.astype(np.float32), sr)])
        inp = self.processor(text=[ai_text], audio=wav, return_tensors="np", padding=True)
        ids = np.asarray(inp["input_ids"])[0]
        flen = int(np.asarray(inp["feature_attention_mask"])[0].sum())
        mel = np.asarray(inp["input_features"])[0][:, :flen].astype(np.float32)
        af = self.audio_features(mel)
        e = self.embed[ids].astype(np.float32)
        at = np.where(ids == self.audio_id)[0]
        if len(at) != af.shape[0]:
            raise RuntimeError(f"aligner_onnx_audio_tokens:{len(at)}/{af.shape[0]}")
        e[at] = af
        out = self.dec.run(None, {"e": e[None]})[0][0]
        ts = out[ids == self.ts_id].astype(np.float64) * self.seg_ms
        res = self.ap.parse_timestamp(word_list, ts)
        return [(it["text"], round(it["start_time"] / 1000.0, 3), round(it["end_time"] / 1000.0, 3)) for it in res]
