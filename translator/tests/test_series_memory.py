"""זיכרון הסדרה (28/10/2026): הניקוי של מה שמגיע מהשרתון, הבלוק להגהה, המיזוג למילון ומה שנשלח בסוף העבודה."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import job as J  # noqa: E402
import pipeline as P  # noqa: E402


class Ctx:
    def __init__(self, pdir, st):
        self.pdir, self.st = pdir, st


BRIEF = """## 2. הדוברים
| תווית | שם | תפקיד | מגדר | איך מדבר |
|---|---|---|---|---|
| S1 | אורן ברינדל | המספר | זכר | |
| S2 | נעמה וקסלי | כתבת | נקבה | |
| S3 | לא ידוע | | | |
| S4 | גבר / שכן | | זכר | |
| S5 | אישה נוספת | | נקבה | |
| S6 | תמר | | נקבה (לא ודאי) | |
"""


class TestSeriesMemory(unittest.TestCase):
    """שמות בדויים בלבד. 02/11/2026 (PR2): שורה [en, he, n, l, f] / [שם, g, תפקיד, n, l, f]"""
    def test_valid(self):
        self.assertIsNone(J.sm_valid(None))
        self.assertIsNone(J.sm_valid({'gl': [], 'ch': []}))
        v = J.sm_valid({'n': 'Fake Show', 'ep': 3, 'gl': [['Vexley', 'וקסלי'], ['vexley', 'x'], ['bad']],
                        'ch': [['נעמה', 'f', 'כתבת'], ['אורן', '?'], ['<b>', 'm']]})
        self.assertEqual(v['gl'], [['Vexley', 'וקסלי', 1, 0, 0]])           # שורה ישנה — n 1, l 0, f 0
        self.assertEqual(v['ch'], [['נעמה', 'f', 'כתבת', 1, 0, 0], ['b', 'm', '', 1, 0, 0]])
        self.assertEqual(v['ep'], 3)

    def test_valid_flags_and_junk(self):
        v = J.sm_valid({'gl': [['Vexley', 'וקסלי (לא ודאי)', 4, 9, 1], ['Quorra', 'קורה', '7', 'x', 4]],
                        'ch': [['נעמה — לא ודאית', 'f', '', 2, 3, 0], ['לא ודאי', 'm'], ['אישה נוספת', 'f'], ['גבר לא ודאי', 'm'],
                               ['נעמה וקסלי', 'f'], ['מר כהן', 'm'], ['מר לוי', 'm']]})
        self.assertEqual(v['gl'][0], ['Vexley', 'וקסלי', 4, 9, 1 | J.SM_UNSURE])
        self.assertEqual(v['gl'][1], ['Quorra', 'קורה', 7, 0, 0])            # SM_FIX לא נשמר בקובץ (mask)
        self.assertEqual([c[0] for c in v['ch']], ['נעמה', 'מר כהן', 'מר לוי'])   # זבל בחוץ, כפילות לפי השם הפרטי / תואר+שם
        self.assertEqual(v['ch'][0][5], J.SM_UNSURE)
        self.assertEqual(J.sm_valid({'gl': [['A', 'א', 1, 0, 4]]}, mask=J.SM_UNSURE | J.SM_FIX)['gl'][0][4], J.SM_FIX)

    def test_block_and_part(self):
        st = {'sm': J.sm_valid({'gl': [['Quorra News 4', 'קורה ניוז 4'], ['Vexley', 'וקסלי', 1, 0, 2]], 'ch': [['נעמה', 'f', 'כתבת']]})}
        b = J.sm_block(st)
        self.assertIn('נעמה · אישה · כתבת', b)
        self.assertIn('Quorra News 4 → קורה ניוז 4', b)
        self.assertIn('Vexley → וקסלי (לא ודאי)', b)                       # "לא ודאי" חוזר לטקסט
        self.assertEqual(J.sm_block({}), '')

    def test_block_filter(self):
        """2.8 (smf): רק מה שנאמר בפרק; שמות חוזרים (n≥2) כשאין כתוביות עזר; דמויות לפי המילה בעברית או n≥3"""
        st = {'sm': J.sm_valid({'gl': [['Vexley', 'נעמה וקסלי'], ['Quorra', 'קורה', 3], ['Pell', 'פל'], ['MONDAY', 'שני', 5]],
                                'ch': [['נעמה', 'f', ''], ['אורן', 'm', '', 4], ['דנה', 'f', '', 1]]})}
        b = J.sm_block(st, 'Hi, Vexley.', '')
        self.assertIn('Vexley →', b)
        self.assertIn('Quorra →', b)                                        # n≥2, שם, מילה אחת — תיקון שמיעה
        self.assertNotIn('Pell', b)
        self.assertNotIn('MONDAY', b)
        self.assertIn('- נעמה ·', b)                                       # המילה בעברית של שורה שנבחרה
        self.assertIn('- אורן ·', b)                                       # n≥3
        self.assertNotIn('דנה', b)
        self.assertNotIn('Quorra', J.sm_block(st, 'Hi, Vexley.', 'Hello Vexley'))   # עם כתוביות עזר — רק מה שנאמר
        self.assertEqual(J.sm_block(st), J.sm_block(st, None))             # בלי text — הכל

    def test_merge_glossary(self):
        with tempfile.TemporaryDirectory() as d:
            pd = Path(d)
            (pd / 'tr').mkdir()
            (pd / 'cues.en.json').write_text(json.dumps([{'en': 'Naama Vexley from Quorra News 4, and Pell, and Brindle.'}]), encoding='utf-8')
            (pd / 'tr' / 'glossary.tsv').write_text('# head\nVexley\tווקסלי\nQuorra News 4\tקורה ניוז פור\nPell\tפל\nBrindle\tברינדל\n',
                                                    encoding='utf-8')
            st = {'gl': [['Quorra News 4', 'קורה ניוז 4', '']],
                  'sm': J.sm_valid({'gl': [['Vexley', 'וקסלי', 7, 3, 0], ['Quorra News 4', 'קורה 4'], ['Lumo', 'לומו'],
                                           ['Pell', 'פלל (לא ודאי)'], ['Brindle', 'ברינדול', 2, 1, 2]]})}
            ctx = Ctx(pd, st)
            J.gl_merge(ctx)
            J.gl_merge(ctx)   # הרצה חוזרת — בלי כפילות
            t = (pd / 'tr' / 'glossary.tsv').read_text(encoding='utf-8')
            self.assertEqual(t.count(J.SM_MARK), 1)
            self.assertNotIn('ווקסלי', t)                 # זיכרון ודאי גובר על שורה של העבודה
            self.assertIn('Vexley\tוקסלי\n', t)            # ⚠ שתי עמודות בלבד — n (7) לא נכתב כהערה
            self.assertNotIn('קורה 4\n', t)               # המילון שלך גובר על הזיכרון
            self.assertNotIn('לומו', t)                   # רק מה שמופיע בפרק
            self.assertIn('Pell\tפל\n', t)                # "לא ודאי" בזיכרון — שורה ודאית של העבודה גוברת
            self.assertNotIn('פלל', t)
            self.assertIn('Brindle\tברינדל\n', t)
            # מה שנשלח בסוף: מילון העבודה + שורות הזיכרון שנאמרו (נספרות); לא מהמילון שלך; דמויות מפוקפקות בחוץ
            (pd / 'tr' / 'glossary.tsv').write_text(t.replace('# head\n', '# head\nOren\tאורן\n'), encoding='utf-8')
            (pd / 'tr' / 'brief.md').write_text(BRIEF, encoding='utf-8')
            sm = J.sm_collect(ctx)
            self.assertEqual([r[0] for r in sm['gl']], ['Oren', 'Pell', 'Brindle', 'Vexley'])
            self.assertTrue(all(r[2:] == [1, 0, 0] for r in sm['gl']))
            self.assertEqual(sm['ch'], [['אורן ברינדל', 'm', 'המספר', 1, 0, 0], ['נעמה וקסלי', 'f', 'כתבת', 1, 0, 0]])

    def test_pipeline_part(self):
        class Fake:
            st = {'sm': J.sm_valid({'ch': [['נעמה', 'f', '']], 'gl': [['Vexley', 'וקסלי'], ['Lumo', 'לומו']]})}
        pl = P.Pipeline.__new__(P.Pipeline)
        pl.J, pl.ctx = J, Fake()
        self.assertIn('<series_memory>', pl.sm_part().replace('\n', ''))
        self.assertIn('Lumo', pl.sm_part('Vexley'))                        # בלי הדגל — הבלוק המלא
        pl.ctx.st = dict(Fake.st, spec={'xf': ['smf']})
        self.assertNotIn('Lumo', pl.sm_part('Vexley'))                     # smf — רק מה שנאמר
        self.assertIn('Vexley', pl.sm_part('Vexley'))
        pl.ctx.st = {}
        self.assertEqual(pl.sm_part(), '')


if __name__ == '__main__':
    unittest.main()


class TestDualAb(unittest.TestCase):
    """ניסוי "טיוטה אחת" (28/10/2026): xd מהשרתון מכבה את הטיוטה השנייה; SNB_TL_DUAL=on גובר."""
    def _pl(self, st, env=''):
        import os
        from unittest import mock
        pl = P.Pipeline.__new__(P.Pipeline)

        class E:
            manual = False

            class spec:
                model = 'claude-haiku-5-5'
        pl.eng, pl.ctx = E(), type('C', (), {'st': st})()
        with mock.patch.dict(os.environ, {'SNB_TL_DUAL': env}):
            return pl.dual_on()

    def test_xd(self):
        # 28/10/2026 (ערב): הניסוי הסתיים — טיוטה אחת תמיד; SNB_TL_DUAL=on מדליק
        self.assertFalse(self._pl({}))
        self.assertFalse(self._pl({'xd': 1}))
        self.assertTrue(self._pl({'xd': 1}, 'on'))
        self.assertTrue(self._pl({}, 'on'))

    def test_rv_ab(self):
        import llm
        def eng(mode, xe=None):
            e = llm.Engine(llm.Spec.of(mode), client=object())
            e.role_effort = llm.norm_xe(xe)
            return e
        e = eng('haiku-high')
        self.assertTrue(P.rv_ab(e, {'xr': 1}))
        self.assertEqual(e.role_effort, {'rv': 'medium'})
        llm._tl.k = 'rv'
        try:
            self.assertEqual(e.effort(), 'medium', 'הביקורת ב־medium')
            llm._tl.k = 'tl'
            self.assertEqual(e.effort(), 'high', 'התרגום נשאר high')
        finally:
            llm._tl.k = ''
        self.assertFalse(P.rv_ab(eng('haiku-high'), {}), 'בלי xr — רגיל')
        self.assertFalse(P.rv_ab(eng('haiku-medium'), {'xr': 1}), 'medium — אין מה להוריד')
        self.assertFalse(P.rv_ab(eng('sonnet-low'), {'xr': 1}), 'לא מעלים מצב נמוך')
        g = eng('haiku-high', {'rv': 'high'})
        self.assertFalse(P.rv_ab(g, {'xr': 1}), 'ניסוי המאמץ של סט הזהב גובר')
        self.assertEqual(g.role_effort, {'rv': 'high'})
