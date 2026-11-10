"""סט הזהב של הניתוח (PR 1.6, 10/11/2026; docs/studio-video-analysis-plan.md 6.4–6.7): הציון מול הייחוס בעובד
(analyze.gold_score), הדגל vwin, השופט בזוגות (visheet.vj_*) והקריטריון (vimetrics.wilson_lb / boot_lb / decide)."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import analyze as A  # noqa: E402
import vimetrics as M  # noqa: E402
import visheet as V  # noqa: E402
import xflags  # noqa: E402

VI = json.loads((ROOT / 'tests' / 'fixtures' / 'vi_ok.json').read_text(encoding='utf-8'))


class GoldScore(unittest.TestCase):
    def test_score_only_in_gold_run(self):
        t0 = [c['t0'] for c in VI['chapters']]
        q = A.gold_score(VI, {'vg': 1, 'vrb': t0})
        m = M.metrics(VI, {'chapters': [{'t0': t} for t in t0]})
        self.assertEqual(q, {'f5': m['ch_f1_5'], 'f10': m['ch_f1_10']})
        self.assertIsNone(A.gold_score(VI, {'vrb': t0}))                 # לא הרצת זהב
        self.assertIsNone(A.gold_score(VI, {'vg': 1}))                   # בלי ייחוס
        self.assertIsNone(A.gold_score(VI, {'vg': 1, 'vrb': []}))
        self.assertIsNone(A.gold_score({'v': 'x'}, {'vg': 1, 'vrb': [0, 60]}))   # ניתוח לא תקין — לא נופל

    def test_vwin_flag(self):
        self.assertIn('vwin', xflags.XF_KEYS)
        self.assertTrue(xflags.on({'xf': ['vwin']}, 'vwin'))
        self.assertGreater(A.VI_WIN_TOK_X, A.VI_WIN_TOK)
        src = (ROOT / 'analyze.py').read_text(encoding='utf-8')
        self.assertIn("win_tok=VI_WIN_TOK_X if xflags.on(spec, 'vwin') else 0", src)
        self.assertIn("if info['video'] and spec.get('vg') != 1:", src)        # הרצת זהב — בלי הסרטון באיכות מלאה


class Judge(unittest.TestCase):
    def test_text_has_no_ids_or_mode(self):
        t = V.vj_text(VI)
        self.assertIn(VI['items'][0]['text'], t)
        self.assertNotIn('n1', t)
        self.assertNotIn('haiku', t)
        self.assertEqual(V.vj_text(None), '(empty)')
        r = V.vj_ref_text({'units': [{'text': 'קל', 'w': 1}, {'text': 'מרכזי', 'w': 3}], 'bounds': [{'t0': 65, 'lv': 1, 'title': 'פרק'}, {'t0': 70, 'lv': 2, 'title': 'משנה'}]})
        self.assertLess(r.index('מרכזי'), r.index('קל'))
        self.assertIn('(chapter 1:05) פרק', r)
        self.assertNotIn('משנה', r)
        p = V.vj_prompt('AAA', 'BBB', 'REF')
        self.assertLess(p.index('REF'), p.index('AAA'))
        self.assertLess(p.index('AAA'), p.index('BBB'))

    def test_parse(self):
        self.assertEqual(V.parse_vj('x {"w":"A","a":["om:ma","bad","acc:xx"],"b":["flu:mi"]} y'), {'w': 'A', 'a': ['om:ma'], 'b': ['flu:mi']})
        self.assertIsNone(V.parse_vj('no json'))
        self.assertIsNone(V.parse_vj('{"w":"C","a":[],"b":[]}'))
        self.assertIsNone(V.parse_vj('{"w":'))
        self.assertEqual(V.mqm(['om:ma', 'acc:cr', 'flu:mi', 'zzz:ma']), 31)

    def test_pair_both_orders(self):
        a = {'w': 'A', 'a': ['flu:mi'], 'b': ['om:ma']}
        b = {'w': 'B', 'a': ['acc:mi'], 'b': ['ts:ma']}                 # בסדר ההפוך: A = Y, B = X — שוב X ניצח
        self.assertEqual(V.vj_pair(a, b), {'w': 'X', 'x': ['flu:mi', 'ts:ma'], 'y': ['om:ma', 'acc:mi']})
        self.assertEqual(V.vj_pair(a, {'w': 'A', 'a': [], 'b': []})['w'], 'tie')   # אי־הסכמה — תיקו
        self.assertIsNone(V.vj_pair(a, None))
        self.assertEqual(len(V.vj_hash()), 12)
        self.assertEqual(V.VJ_SCHEMA['properties']['w']['enum'], ['A', 'B', 'tie'])


class Criterion(unittest.TestCase):
    def test_wilson(self):
        self.assertIsNone(M.wilson_lb(0, 0))
        self.assertAlmostEqual(M.wilson_lb(8, 10), 0.4902, places=4)
        self.assertGreater(M.wilson_lb(12, 12), 0.5)
        self.assertLess(M.wilson_lb(6, 12), 0.5)

    def test_boot_clustered_and_seeded(self):
        d = {'v1': [0.1, 0.1], 'v2': [-0.2], 'v3': [0.0, None]}
        self.assertEqual(M.boot_lb(d), M.boot_lb(copy.deepcopy(d)))      # זרע קבוע
        self.assertLess(M.boot_lb(d), 0)
        self.assertIsNone(M.boot_lb({}))
        self.assertEqual(M.boot_lb({'v': [0.05] * 3}), 0.05)

    def test_shared_fixture(self):
        """= viDecide בשרתון (tests/fixtures/vi-decide.json — גם tests/learn-vi.test.js): אותו מחולל, אותו סדר חיבור"""
        f = json.loads((ROOT.parent / 'tests' / 'fixtures' / 'vi-decide.json').read_text(encoding='utf-8'))
        self.assertGreaterEqual(len(f['cases']), 5)
        for c in f['cases']:
            self.assertEqual(json.dumps(M.decide(c['rows'])), json.dumps(c['out']), c['name'])

    def row(self, w, vid='v1', sup=(0.9, 0.9), usd=(1, 1), sec=(10, 10), uns=0):
        return {'vid': vid, 'w': w, 'a': {'support_rate': sup[0], 'kf_cov': 0.5, 'usd': usd[0], 'sec': sec[0]},
                'b': {'support_rate': sup[1], 'kf_cov': 0.5, 'usd': usd[1], 'sec': sec[1]}, 'b_uns': uns}

    def test_decide(self):
        good = [self.row('Y', 'v%d' % (i % 6)) for i in range(14)] + [self.row('tie', 'v0')]
        d = M.decide(good)
        self.assertTrue(d['pass'], d)
        self.assertEqual((d['wins'], d['losses'], d['ties']), (14, 0, 1))
        self.assertEqual(d['reg']['support_rate'], 0)
        self.assertIsNone(d['reg']['ts_acc'])
        self.assertEqual(M.decide(good[:3])['why'], ['wins'])            # מעט מדי זוגות — Wilson לא מעל 0.5
        self.assertIn('hard', M.decide(good + [self.row('Y', uns=1)])['why'])
        self.assertIn('reg_support_rate', M.decide([self.row('Y', 'v%d' % i, sup=(0.9, 0.8)) for i in range(14)])['why'])
        self.assertIn('cost', M.decide([self.row('Y', 'v%d' % i, usd=(1, 1.2)) for i in range(14)])['why'])
        self.assertIn('time', M.decide([self.row('Y', 'v%d' % i, sec=(10, 10.6)) for i in range(14)])['why'])
        self.assertFalse(M.decide([])['pass'])


if __name__ == '__main__':
    unittest.main()
