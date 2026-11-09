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


class Analysis(unittest.TestCase):
    """9/11/2026 (ניתוח סרטונים, גל 0): עבודת vi — שלבים משלה, נחשבת כבדה, והקבלה החזויה גם למועמדת מסוג vi"""

    def test_phases(self):
        ph = perf.phases('vi', 60)
        self.assertEqual([x[0] for x in ph], ['up', 'tr', 'al', 'rv', 'bn', 'sv'])
        self.assertTrue(all(x[0] in perf.STAGES for x in ph), 'אותם מפתחות של STAGES (perf.py)')
        self.assertAlmostEqual(dict((x[0], x[2]) for x in ph)['tr'], 0.18 * 60, 'התמלול לפי עברית — השמרני')
        self.assertTrue(15 <= perf.alone('vi', 60) <= 40, perf.alone('vi', 60))
        self.assertEqual(perf.remaining('vi', 60, 'bn', 0.5)[0][0], 'bn')

    def test_heavy_and_candidate_kind(self):
        vi = ('vi', 90.0, 0.0, 'up', 0.0)
        self.assertIsNone(perf.dmax([vi]), 'ניתוח אחד — עוד עבודה נכנסת בכל אורך')
        self.assertIsNotNone(perf.dmax([BIG, vi]), 'ניתוח שרץ נחשב בעומס של התרגום')
        dv, dt = perf.dmax([BIG, BIG], kind='vi'), perf.dmax([BIG, BIG])
        self.assertIsNotNone(dv)
        self.assertIsNotNone(dt)
        self.assertIsNone(perf.dmax([BIG], kind='zz'), 'סוג לא מוכר = תרגום (כבר נבדק בלי הגבלה)')
        self.assertEqual(perf.worst([vi], None), 1.0, 'ההאטה של הניתוח עצמו לא חוסמת (רק תרגום מוגן — PROTECT)')
        self.assertGreater(perf.worst([BIG, vi], None), 1.0, 'אבל הוא מאט את התרגום שרץ לצידו')

    def test_eta_parity(self):
        """VI_STG בשרתון (studioeta.js) ובטלפון (studionet.js) = perf.phases('vi') × 60: ‏a בשניות, b בשניות לדקת סרטון"""
        import json
        import re
        root = Path(__file__).resolve().parents[2]
        p0 = {k: m for k, _, m, *_ in perf.phases('vi', 0)}
        p60 = {k: m for k, _, m, *_ in perf.phases('vi', 60)}
        for f in ('ibkr-proxy/lib/studioeta.js', 'studionet.js'):
            m = re.search(r"VI_STG = (\{[^}]*\})", (root / f).read_text(encoding='utf-8'))
            self.assertIsNotNone(m, f)
            stg = json.loads(re.sub(r"(\w+):", r'"\1":', m.group(1)))
            self.assertEqual(set(stg), set(p0) - {'up'}, f + ' — כל השלבים חוץ מהקליטה (לא בצפי, כמו בקריוקי)')
            for k, (a, b) in stg.items():
                self.assertAlmostEqual(a, p0[k] * 60, places=6, msg=f + ' ' + k)
                self.assertAlmostEqual(b, p60[k] - p0[k], places=6, msg=f + ' ' + k)


class AgentWiring(unittest.TestCase):
    def test_vi_kind_and_fit(self):
        import agent as A
        self.assertEqual(A.perf_kind({'kind': 'tr', 'vi': 1}), 'vi')
        self.assertEqual(A.perf_kind({'kind': 'rr'}), 'rr')
        self.assertEqual(A.perf_kind({}), 'tr')
        self.assertEqual(A.MEM_PRIOR['vi'], A.MEM_PRIOR['tr'], 'גל 0: כמו תרגום עד המדידה (0.3)')
        import analyze
        self.assertEqual(A.MEM_PRIOR['vi'], analyze.MEM_VI, '= MEM_VI ב־analyze.py (שומר הזיכרון של ה־OCR)')
        self.assertEqual(A.mem_need('vi', 3600), analyze.mem_need(3600))

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
