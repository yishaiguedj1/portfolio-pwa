"""28/10/2026 (ניתוח פרקים 12–20 של הסדרה מול התרגום האנושי): עזר שנכתב במילישניות, וקיצורי קצב קריאה קלים לפני הבנייה."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import pipeline as P  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_pipeline as TP  # noqa: E402 — מודול, לא מחלקות (אחרת FlowTests רצה פעמיים)
FakeJ, msg = TP.FakeJ, TP.msg

# מה שהטלפון כתב עד 2.81.2: זמן ההתחלה במילישניות כאילו הן שניות (19,452 מ״ש → "[05:24:12]")
MS = "[05:24:12] Kids, about eight months\n[05:48:40] into Aunt Lily's engagement,\n[350:47:41] Two months.\n"
EDIT = "[S1 00:00:18.500] Kids, about eight months into Aunt Lily's engagement,\n[S2 00:21:20.000] Two months.\n"


class RefMs(unittest.TestCase):
    def test_ms_file_rescaled(self):
        L = P.ref_lines(MS, end=1280)
        self.assertEqual([t for t, _ in L], [19.0, 20.0, 1262.0], 'שעות של 3 ספרות נקראות, והכל מחולק ב־1000')
        self.assertEqual(L[0][1], '[00:00:19] Kids, about eight months')
        self.assertEqual(P.ref_lines(MS)[-1][0], 1262.0, 'בלי אורך ידוע — מעל יממה = מילישניות')

    def test_normal_file_untouched(self):
        ok = "[00:00:19] Kids\n[00:21:02] Two months.\n"
        self.assertEqual([t for t, _ in P.ref_lines(ok, end=1280)], [19.0, 1262.0])
        film = "[00:00:05] a\n[02:59:00] b\n"
        self.assertEqual(P.ref_lines(film, end=10790)[-1][0], 10740.0, 'סרט של שלוש שעות — שניות, לא נוגעים')
        self.assertFalse(P.ref_ms([5, 900], end=60), 'קובץ ארוך מהתמליל (פי 15) — לא מילישניות')

    def test_window_after_rescue(self):
        # הבאג: ref_window / subref_grade חיפשו שורות בזמני התמליל (0–1280) ומצאו שורות "של 5 שעות" — כלום
        L = P.ref_lines(MS, end=1280)
        self.assertEqual(P.ref_window(L, EDIT.splitlines()[0]), '[00:00:19] Kids, about eight months\n[00:00:20] into Aunt Lily\'s engagement,')
        self.assertEqual(P.ref_window(P.ref_lines(MS.replace('[350:47:41]', '[03:47:41]')), EDIT.splitlines()[0]), '')


class CpsMild(unittest.TestCase):
    def test_threshold(self):
        self.assertTrue(P.cps_mild('[cps] 45 תווים מול תקציב 40 (קצב קריאה) — לשקול קיצור'))
        self.assertFalse(P.cps_mild('[cps] 46 תווים מול תקציב 40 (קצב קריאה) — לשקול קיצור'), '1.15 ומעלה — לתיקון')
        self.assertFalse(P.cps_mild('[short] התרגום קצר מאוד'))
        self.assertFalse(P.cps_mild('45 תווים מול תקציב 40 (קצב קריאה)'), 'בלי קוד (vt ישן) — כמו עד היום')
        self.assertFalse(P.cps_mild('[cps] 5 תווים מול תקציב 0'))


class J2810(FakeJ):
    def vt(self, ctx, args):
        if args[0] != 'tr-check':
            return super().vt(ctx, args)
        he = P.Pipeline(ctx, self, None).current()
        iss = []
        if he.get('1') == 'קצת ארוכה':
            iss.append('- #1: [cps] 44 תווים מול תקציב 40 (קצב קריאה) — לשקול קיצור')
        if he.get('2') == 'הרבה יותר מדי':
            iss.append('- #2: [cps] 52 תווים מול תקציב 40 (קצב קריאה) — לשקול קיצור')
        (self.pd / 'tr' / 'check.md').write_text('# בדיקה\n\n' + '\n'.join(iss) + '\n', encoding='utf-8')
        return ['שגיאות 0']


class FixRoundCps(unittest.TestCase):
    setUp, tearDown, engine = TP.FlowTests.setUp, TP.FlowTests.tearDown, TP.FlowTests.engine

    def test_mild_left_to_build(self):
        self.J = J2810(self.pd)
        (self.pd / 'tr' / 'batch_001.he.txt').write_text('#1 קצת ארוכה\n#2 הרבה יותר מדי\n#3 טוב\n', encoding='utf-8')
        seen = []

        def h(kw):
            seen.append(kw['messages'][0]['content'])
            return msg('#2 קצר')
        P.Pipeline(self.ctx, self.J, self.engine(h)).fix_round('fixes.txt', 'X', 'tl')
        self.assertEqual(len(seen), 1)
        self.assertIn('#2 [לשקול', seen[0])
        self.assertNotIn('#1 [', seen[0], 'חריגה של 10% — נשארת לבנייה ולסבב הבקרה')
        self.assertIn('לא משמיטים "עדיין"', P.FIX_TASK)

    def test_only_mild_no_call(self):
        self.J = J2810(self.pd)
        (self.pd / 'tr' / 'batch_001.he.txt').write_text('#1 קצת ארוכה\n#2 טוב\n#3 טוב\n', encoding='utf-8')
        pl = P.Pipeline(self.ctx, self.J, self.engine(lambda kw: self.fail('רק חריגה קלה — בלי קריאה')))
        self.assertEqual(pl.fix_round('fixes.txt', 'X', 'tl'), 0)


if __name__ == '__main__':
    unittest.main()
