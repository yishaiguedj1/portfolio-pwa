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
| S1 | טד מוסבי | המספר | זכר | |
| S2 | רובין שרבצקי | כתבת | נקבה | |
| S3 | לא ידוע | | | |
"""


class TestSeriesMemory(unittest.TestCase):
    def test_valid(self):
        self.assertIsNone(J.sm_valid(None))
        self.assertIsNone(J.sm_valid({'gl': [], 'ch': []}))
        v = J.sm_valid({'n': 'HIMYM', 'ep': 3, 'gl': [['Scherbatsky', 'שרבצקי'], ['scherbatsky', 'x'], ['bad']],
                        'ch': [['רובין', 'f', 'כתבת'], ['טד', '?'], ['<b>', 'm']]})
        self.assertEqual(v['gl'], [['Scherbatsky', 'שרבצקי']])
        self.assertEqual(v['ch'], [['רובין', 'f', 'כתבת'], ['b', 'm', '']])
        self.assertEqual(v['ep'], 3)

    def test_block_and_part(self):
        st = {'sm': J.sm_valid({'gl': [['Metro News 1', 'מטרו ניוז 1']], 'ch': [['רובין', 'f', 'כתבת']]})}
        b = J.sm_block(st)
        self.assertIn('רובין · אישה · כתבת', b)
        self.assertIn('Metro News 1 → מטרו ניוז 1', b)
        self.assertEqual(J.sm_block({}), '')

    def test_merge_glossary(self):
        with tempfile.TemporaryDirectory() as d:
            pd = Path(d)
            (pd / 'tr').mkdir()
            (pd / 'cues.en.json').write_text(json.dumps([{'en': 'Robin Scherbatsky from Metro News 1.'}]), encoding='utf-8')
            (pd / 'tr' / 'glossary.tsv').write_text('# head\nScherbatsky\tשבוטסקי\nMetro News 1\tמטרו ניוז וואן\n', encoding='utf-8')
            st = {'gl': [['Metro News 1', 'מטרו ניוז 1', '']],
                  'sm': J.sm_valid({'gl': [['Scherbatsky', 'שרבצקי'], ['Metro News 1', 'מטרו 1'], ['Lily', 'לילי']]})}
            ctx = Ctx(pd, st)
            J.gl_merge(ctx)
            J.gl_merge(ctx)   # הרצה חוזרת — בלי כפילות
            t = (pd / 'tr' / 'glossary.tsv').read_text(encoding='utf-8')
            self.assertEqual(t.count(J.SM_MARK), 1)
            self.assertNotIn('שבוטסקי', t)               # הזיכרון גובר על שורה של העבודה
            self.assertIn('Scherbatsky\tשרבצקי', t)
            self.assertNotIn('מטרו 1\n', t)               # המילון שלך גובר על הזיכרון
            self.assertNotIn('לילי', t)                   # רק מה שמופיע בפרק
            # מה שנשלח בסוף: לא מהזיכרון ולא מהמילון שלך
            (pd / 'tr' / 'glossary.tsv').write_text(t.replace('# head\n', '# head\nTed\tטד\n'), encoding='utf-8')
            (pd / 'tr' / 'brief.md').write_text(BRIEF, encoding='utf-8')
            sm = J.sm_collect(ctx)
            self.assertEqual(sm['gl'], [['Ted', 'טד']])
            self.assertEqual(sm['ch'], [['טד מוסבי', 'm', 'המספר'], ['רובין שרבצקי', 'f', 'כתבת']])

    def test_pipeline_part(self):
        class Fake:
            st = {'sm': J.sm_valid({'ch': [['רובין', 'f', '']]})}
        pl = P.Pipeline.__new__(P.Pipeline)
        pl.J, pl.ctx = J, Fake()
        self.assertIn('<series_memory>', pl.sm_part().replace('\n', ''))
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
