"""מאגר המדידות (translator/bench.py): צורה קבועה, ערכים לדקה, התאמת קו העלות (ניסוי 3.5), והקובץ בריפו תקין."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import bench as B  # noqa: E402

RUN = {'id': '2026-10-10-09', 'clip': 'ted-test-0-300', 'dur_s': 300, 'wall_s': 810, 'mode': 'opus-medium',
       'models': {'main': 'claude-opus-5-5'}, 'usd': {'main': 0.3, 'tl': 0.2}, 'tok': {'main': 50000, 'tl': 30000},
       'stages_s': {'tr': 150, 'al': 300}}


class Bench(unittest.TestCase):
    def test_validate_shape(self):
        self.assertEqual(B.validate(dict(RUN))['id'], RUN['id'])
        for bad in ({'clip': 'My Secret Video.mp4'}, {'id': 'x'}, {'notes': 'x' * 401}, {'models': {'evil': 'claude-x'}},
                    {'usd': {'main': -1}}, {'stages_s': {'zz': 1}}):
            with self.assertRaises(ValueError, msg=str(bad)):
                B.validate(dict(RUN, **bad))

    def test_derive_per_minute(self):
        d = B.derive(RUN)
        self.assertEqual((d['usd'], d['usd_min'], d['tok_min'], d['wall_min']), (0.5, 0.1, 16000, 2.7))

    def test_fit_line(self):
        a, b = B.fit_line([(5, 1 + 5 * 0.08), (10, 1 + 10 * 0.08), (30, 1 + 30 * 0.08)])
        self.assertAlmostEqual(a, 1.0)
        self.assertAlmostEqual(b, 0.08)
        self.assertIsNone(B.fit_line([(5, 0.5), (5, 0.6)]), 'אורך אחד — אין קו')

    def test_repo_runs_valid_and_private(self):
        runs = B.load()
        self.assertGreaterEqual(len(runs), 3)
        for r in runs:
            B.validate(r)
            blob = json.dumps(r, ensure_ascii=False)
            self.assertNotRegex(blob, r'\.(mp4|mkv|mov|m4a)\b', 'בלי שמות קבצים')
            self.assertNotRegex(blob, r'[\w.+-]+@[\w-]+\.', 'בלי מיילים')


if __name__ == '__main__':
    unittest.main()
