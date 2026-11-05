"""5/11/2026: קבלה חזויה (perf.py, docs/studio-parallel-plan.md) — כמה ארוכה יכולה להיות עבודה שנכנסת עכשיו."""
import os
import runpy
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

import perf  # noqa: E402

BIG = ('tr', 90.0, 0.0, 'up', 0.0)


class Model(unittest.TestCase):
    def test_alone_matches_plan(self):
        self.assertTrue(35 <= perf.alone('tr', 60) <= 44, perf.alone('tr', 60))
        self.assertLess(perf.alone('tr', 10), perf.alone('tr', 60))
        self.assertLess(perf.alone('ai', 0), 3)

    def test_same_model_as_the_tool(self):
        """המודל בעובד = המודל של הסימולציה בכלי (tools/studio-parallel-sim.py) — אותם מספרים בתוכנית"""
        g = runpy.run_path(str(HERE.parent / 'tools' / 'studio-parallel-sim.py'))
        for d in (10, 60, 90):
            self.assertAlmostEqual(perf.alone('tr', d), g['alone'](d), delta=0.6)

    def test_remaining(self):
        full = perf.phases('tr', 60)
        self.assertEqual(len(perf.remaining('tr', 60, None, None)), len(full), 'בלי דיווח — מההתחלה')
        half = perf.remaining('tr', 60, 'bn', 0.5)
        self.assertEqual(half[0][0], 'bn')
        self.assertAlmostEqual(half[0][2], 0.14 * 60 / 2, places=6)
        self.assertEqual(perf.remaining('tr', 60, 'tl', 0)[0][0], 'al', 'tl = אותו שלב כמו היישור')


class Dmax(unittest.TestCase):
    def test_no_limit_when_idle_or_light(self):
        self.assertIsNone(perf.dmax([]))
        self.assertIsNone(perf.dmax([('ai', 0, 1, 'sv', 0)]), 'גיליון AI לא תופס מעבד')
        self.assertIsNone(perf.dmax([BIG]), 'עבודה גדולה אחת — השנייה נכנסת בכל אורך')

    def test_third_big_waits_for_the_right_moment(self):
        d = perf.dmax([BIG, BIG])
        self.assertIsNotNone(d)
        self.assertLess(d, 60, 'שתי גדולות שהתחילו עכשיו — שלישית גדולה מחכה')
        self.assertGreater(d, 5, 'קצרה עדיין נכנסת לצידן')
        late = [('tr', 90.0, 45.0, 'bn', 0.6)] * 2
        self.assertIsNone(perf.dmax(late), 'כשהן בסוף הצריבה — נכנסת בכל אורך')

    def test_more_running_less_room(self):
        one = perf.dmax([('tr', 30.0, 0.0, 'up', 0.0)] * 2)
        two = perf.dmax([('tr', 30.0, 0.0, 'up', 0.0)] * 3)
        self.assertLessEqual(two if two is not None else 1e9, one if one is not None else 1e9)

    def test_switches(self):
        os.environ['SNB_PRED'] = 'off'
        try:
            self.assertIsNone(perf.dmax([BIG, BIG]))
        finally:
            os.environ.pop('SNB_PRED', None)
        self.assertIsNone(perf.dmax([('tr', 'x', 0, 'up', 0)]), 'קלט שבור — בלי הגבלה (רק הזיכרון)')
        loose = perf.dmax([BIG, BIG], slow_max=3.0)
        self.assertTrue(loose is None or loose > perf.dmax([BIG, BIG]))

    def test_fast(self):
        t = time.time()
        perf.dmax([BIG, BIG, ('tr', 20.0, 3.0, 'al', 0.3)])
        self.assertLess(time.time() - t, 2.0, 'החישוב בכל פנייה — שניות בודדות לכל היותר')


class AgentWiring(unittest.TestCase):
    def test_running_from_slots(self):
        import agent as A
        with tempfile.TemporaryDirectory() as d:
            st = Path(d)
            (st / 'prog.json').write_text('{"st": "al", "p": 0.4}', encoding='utf-8')

            class S:
                kind, dur, t0, state = 'tr', 5400.0, time.time() - 600, st
            r = A.perf_running({1: S()})
            self.assertEqual(r[0][0], 'tr')
            self.assertAlmostEqual(r[0][1], 90.0)
            self.assertAlmostEqual(r[0][2], 10.0, delta=0.1)
            self.assertEqual(r[0][3:], ('al', 0.4))
            self.assertIsNone(A.perf_dmax({1: S()}))
            (st / 'prog.json').write_text('{"st": "up", "p": 0}', encoding='utf-8')
            S.t0 = time.time()
            self.assertIsNotNone(A.perf_dmax({1: S(), 2: S()}), 'שתי גדולות שרק התחילו — יש הגבלה')


if __name__ == '__main__':
    unittest.main()
