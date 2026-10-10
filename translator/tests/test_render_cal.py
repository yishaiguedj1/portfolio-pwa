"""כיול ה־CRF של הצריבה (שלב 4.3, 10/10/2026): סדר דגימות מפוזר ועצירה מוקדמת כשההחלטה ממילא חסומה.

נמדד על 5 דק׳ TED אמיתיות (1.1Mbps): הכיול = 24% מזמן הצריבה, והתוצאה CRF 18 (הגבול) — 15→6 שנ׳ אחרי השינוי.
במקור בקצב נמוך (300kbps) — אותה תוצאה בדיוק (CRF 35): כל 12 הדגימות, הסכום לא תלוי בסדר.
"""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from vt import render as R  # noqa: E402


class Order(unittest.TestCase):
    def test_permutation_and_spread(self):
        for n in range(1, 30):
            o = R.spread_order(n)
            self.assertEqual(sorted(o), list(range(n)), n)
        o = R.spread_order(12)
        self.assertEqual(o[:2], [0, 11], "קודם הקצוות")
        self.assertTrue(any(4 <= i <= 7 for i in o[:3]), "ואז האמצע")
        # 4 הדגימות הראשונות מכסות את כל הסרטון (לא השליש הראשון)
        self.assertGreaterEqual(max(o[:4]) - min(o[:4]), 9)


class EarlyStop(unittest.TestCase):
    def _run(self, ratio_at):
        """calibrate_crf עם ffmpeg מדומה: כל דגימה בגודל ratio_at(crf) × המקור."""
        calls = []

        def fake_run(cmd, **kw):
            outs = [Path(a) for a in cmd if a.endswith(".mkv")]
            crfs = [int(cmd[i + 1]) for i, a in enumerate(cmd) if a == "-crf"]
            for o, c in zip(outs, crfs):
                o.write_bytes(b"x" * int(1000 * ratio_at(c)))
            calls.append(1)

        packets = [(t / 25, 1000 // 161 + 1) for t in range(25 * 300)]   # ~1000 בתים לכל GOP של 161 פריימים
        info = {"duration": 300.0, "video": {"fps_float": 25}}
        with mock.patch.object(R, "run", fake_run), mock.patch.object(R, "sub_filter", lambda *a: "null"):
            with tempfile.TemporaryDirectory() as td:
                crf, pred = R.calibrate_crf(Path(td) / "src.mp4", Path(td) / "s.ass", info, 1.02, packets=packets)
        return crf, len(calls)

    def test_high_bitrate_stops_early(self):
        # AV1 קטן פי 5–8 מהמקור כבר ב־CRF 40 → החיזוי הרבה מתחת ל־18 → נעצר אחרי CAL_MIN דגימות
        crf, n = self._run(lambda c: 0.2 if c == 40 else 0.12)
        self.assertEqual(crf, R.CRF_MIN)
        self.assertEqual(n, R.CAL_MIN, "עצירה מוקדמת")

    def test_in_range_uses_all_samples(self):
        # קרוב ליעד — כל 12 הדגימות, כמו קודם
        crf, n = self._run(lambda c: 0.9 if c == 40 else 0.55)
        self.assertEqual(n, 12)
        self.assertTrue(R.CRF_MIN < crf < R.CRF_MAX)

    def test_flat_samples_no_crash(self):
        crf, n = self._run(lambda c: 0.5)
        self.assertEqual(n, 12, "בלי מגמה — בלי עצירה מוקדמת")


if __name__ == "__main__":
    unittest.main()
