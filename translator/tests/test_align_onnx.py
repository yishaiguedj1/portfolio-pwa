"""יישור ב־ONNX INT8 (שלב 4.1, 10/10/2026): בחירת המנוע, אימות הקבצים, אורכי הקונבולוציות, והבנייה בתמונה.

בלי onnxruntime ובלי torch (כמו ב־CI): הגרפים עצמם נבדקו מול torch על 4 הרצאות TED (היומן) — כאן הלוגיקה.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "translator"))

from vt import align as A  # noqa: E402
from vt import align_onnx as O  # noqa: E402


def read(p: str) -> str:
    return (ROOT / p).read_text(encoding="utf-8")


def qwen_out_len(n: int) -> int:
    # _get_feat_extract_output_lengths מתוך qwen_asr (modeling_qwen3_asr.py), מועתק כמו שהוא
    leave = n % 100
    feat = (leave - 1) // 2 + 1
    return ((feat - 1) // 2 + 1 - 1) // 2 + 1 + (n // 100) * 13


def make_dir(d: Path) -> None:
    for f in O.FILES:
        (d / f).write_bytes(f.encode())
    (d / "model").mkdir()
    man = {"quant": "int8", "sha256": {f: hashlib.sha256(f.encode()).hexdigest() for f in O.FILES}}
    (d / "manifest.json").write_text(json.dumps(man))


class Lengths(unittest.TestCase):
    def test_out_len_matches_qwen(self):
        for n in range(1, 3001):
            self.assertEqual(O.out_len(n), qwen_out_len(n), n)
        self.assertEqual(O.out_len(100), 13)
        # סכום על חלקים של 100 = האורך של כל האודיו (ההנחה של audio_features)
        for T in (99, 100, 101, 999, 9000, 9017):
            parts = [min(100, T - i) for i in range(0, T, 100)]
            self.assertEqual(sum(O.out_len(p) for p in parts), O.out_len(T), T)


class Choose(unittest.TestCase):
    def test_dir_selection(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            with mock.patch.dict(os.environ, {"SNB_ALIGN_ONNX": t, "SNB_ALIGN": ""}):
                self.assertIsNone(O.onnx_dir(), "תיקייה ריקה = torch")
                make_dir(d)
                self.assertEqual(O.onnx_dir(), d)
            with mock.patch.dict(os.environ, {"SNB_ALIGN_ONNX": t, "SNB_ALIGN": "torch"}):
                self.assertIsNone(O.onnx_dir(), "SNB_ALIGN=torch מכבה")

    def test_verify_rejects_changed_file(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t)
            make_dir(d)
            O._VERIFIED.clear()
            self.assertEqual(O.verify(d)["quant"], "int8")
            (d / "text-decoder.onnx").write_bytes(b"x")
            self.assertEqual(O.verify(d)["quant"], "int8", "פעם אחת לתהליך — לא מגבבים שוב 1.4GB")
            O._VERIFIED.clear()
            with self.assertRaisesRegex(RuntimeError, "aligner_onnx_hash:text-decoder.onnx"):
                O.verify(d)


class Chunk(unittest.TestCase):
    def _al(self, items):
        al = A.Aligner.__new__(A.Aligner)
        al.onnx = mock.Mock()
        al.onnx.align.return_value = items
        al.engine = "onnx-int8"
        return al

    def test_items_map_to_words(self):
        words = [{"w": "Hello,"}, {"w": "—"}, {"w": "world"}]
        al = self._al([("Hello", 1.0, 1.4), ("world", 1.5, 2.0)])
        out = al.align_chunk(__import__("numpy").zeros(16000, "float32"), 16000, words)
        self.assertEqual(out, [(1.0, 1.4), None, (1.5, 2.0)], "מילה בלי אותיות — בלי זמן")
        args = al.onnx.align.call_args[0]
        self.assertEqual(args[2], "Hello world")

    def test_mismatch_uses_diff(self):
        words = [{"w": "a"}, {"w": "b"}, {"w": "c"}]
        al = self._al([("a", 0.1, 0.2), ("c", 0.5, 0.6)])
        out = al.align_chunk(__import__("numpy").zeros(1600, "float32"), 16000, words)
        self.assertEqual(out[0], (0.1, 0.2))
        self.assertIsNone(out[1])
        self.assertEqual(out[2], (0.5, 0.6))

    def test_fallback_to_torch_on_load_error(self):
        src = read("translator/vt/align.py")
        self.assertRegex(src, r"except Exception as e:.*\n.*ממשיכים ב־torch", "תקלה בטעינת הגרפים = torch, לא כישלון")
        self.assertIn('"engine": al.engine', src, "המנוע נרשם בסטטיסטיקה")


class Build(unittest.TestCase):
    def test_export_pinned_to_official_weights(self):
        src = read("translator/aligner_export.py")
        self.assertIn('MODEL_ID = "Qwen/Qwen3-ForcedAligner-0.6B"', src)
        self.assertRegex(src, r'REVISION = "[0-9a-f]{40}"', "גרסה נעולה")
        self.assertRegex(src, r'WEIGHTS_SHA256 = "[0-9a-f]{64}"', "sha256 של המשקולות")
        self.assertIn("if got != WEIGHTS_SHA256:", src, "משקולות אחרות = הבנייה נכשלת")
        self.assertIn("revision=REVISION", src)
        self.assertRegex(src, r'CTC_SHA256 = "[0-9a-f]{64}"', "גם משקולות ה־CTC נעולות")
        self.assertIn("if got != CTC_SHA256:", src)
        # המשקולות רשומות כתת־מודול — אחרת הן קבועים בגרף ו־quantize_dynamic לא מכווץ אותן (נמצא בייצוא)
        self.assertIn("self.at, self.tm, self.head = at, tm, th.lm_head", src)
        self.assertIn("self.w = w", src)

    def test_ctc_onnx_with_fallback(self):
        src = read("translator/vt/align_ctc.py")
        self.assertIn('session(d / "ctc.onnx")', src)
        self.assertIn("ממשיכים ב־torch", src, "גרף CTC פגום = המודל של torch")
        self.assertIn("self.F.forced_align(em", src, "ה־forced_align נשאר של torchaudio")

    def test_dockerfile_bakes_graphs(self):
        d = read("infra/worker/Dockerfile")
        self.assertIn("FROM deps AS aligner", d)
        self.assertIn("aligner_export.py /opt/aligner", d)
        self.assertIn("COPY --from=aligner /opt/aligner /opt/aligner", d)
        self.assertIn("find /app /opt/aligner -type f -exec chmod 644", d, "קריאה למשתמש של העובד")
        for lock in ("requirements.lock", "requirements-arm64.lock"):
            self.assertRegex(read("infra/worker/" + lock), r"(?m)^onnx==\S+ \\$", "onnx נעול עם hash: " + lock)

    def test_runtime_settings(self):
        src = read("translator/vt/align_onnx.py")
        self.assertIn('"session.intra_op.allow_spinning", "0"', src, "בלי סיבוב של תהליכונים מחכים")
        self.assertIn("inter_op_num_threads = 1", src)
        self.assertIn('mmap_mode="r"', src, "טבלת ההטמעות לא נטענת כולה לזיכרון")
        self.assertIn("verify(d)", src, "הקבצים נבדקים לפני טעינה")


if __name__ == "__main__":
    unittest.main()
