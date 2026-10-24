"""24/10/2026: מילון המונחים — אכיפה רק למונחים ספציפיים (gl_strict), וניסוי "בלי מילון" (spec.xg) בעובד."""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from vt.translate import check, gl_strict  # noqa: E402
import pipeline  # noqa: E402


class Strict(unittest.TestCase):
    def test_which_terms_enforced(self):
        self.assertTrue(gl_strict('child mortality', ['תמותת ילדים']))         # כמה מילים
        self.assertTrue(gl_strict('Sub-Saharan Africa', ['אפריקה שמדרום לסהרה']))
        self.assertTrue(gl_strict('OECD', ['OECD']))                           # ראשי תיבות
        self.assertTrue(gl_strict('Uber', ['אובר']))                           # שם במילה אחת → מילה אחת
        self.assertFalse(gl_strict('Soviet', ['ברית המועצות']))                # תואר/לאום — תלוי הקשר
        self.assertFalse(gl_strict('data', ['נתונים']))                        # מילה כללית
        self.assertFalse(gl_strict('chimpanzees', ['שימפנזים']))

    def test_check_soft_terms_not_flagged(self):
        cues = [{'id': 1, 'en': 'East Europe, Soviet economy for a long time.', 's': 0, 'e': 3, 'budget': 84},
                {'id': 2, 'en': 'The child mortality is high.', 's': 3, 'e': 6, 'budget': 84}]
        he = {'1': 'מזרח אירופה, כלכלה סובייטית זמן רב.', '2': 'המוות של ילדים גבוה.'}
        gl = [('Soviet', ['ברית המועצות']), ('child mortality', ['תמותת ילדים'])]
        issues, stats = check(cues, he, gl)
        txt = '\n'.join(issues)
        self.assertNotIn("'Soviet'", txt)                 # בעבודה אמיתית הכפייה שברה את המשפט
        self.assertIn("'child mortality'", txt)
        self.assertEqual(stats['glossary'], 1)
        self.assertEqual(stats['glossary_soft'], 1)

    def test_nested_term_checked_once(self):
        # שורה נפרדת למדינה ולתואר (ההוראה החדשה למתכנן): "Soviet Union" לא מסמן חוסר של "סובייטי"
        cues = [{'id': 1, 'en': 'The Soviet Union collapsed.', 's': 0, 'e': 3, 'budget': 84},
                {'id': 2, 'en': 'The Soviet economy was planned.', 's': 3, 'e': 6, 'budget': 84}]
        he = {'1': 'ברית המועצות קרסה.', '2': 'הכלכלה הסובייטית הייתה מתוכננת.'}
        gl = [('Soviet Union', ['ברית המועצות']), ('Soviet', ['סובייטי', 'סובייטית', 'סובייטיים'])]
        issues, stats = check(cues, he, gl)
        self.assertEqual(issues, [])                       # גם "הסובייטית" (ה' הידיעה) נמצא
        self.assertEqual(stats['glossary'] + stats['glossary_soft'], 0)
        he['1'] = 'המדינה קרסה.'
        issues, _ = check(cues, he, gl)
        self.assertEqual(len(issues), 1)
        self.assertIn("'Soviet Union'", issues[0])

    def test_prompts(self):
        self.assertNotIn('כפי שהם', pipeline.TL_TASK)     # 24/10/2026: לא כופים — מתאימים את הצורה למשפט
        self.assertIn('מתאימים למשפט', pipeline.TL_TASK)
        self.assertIn('לא כופים', pipeline.TL_TASK)
        for t in (pipeline.PROOF_TASK, pipeline.SUBS_TASK):
            self.assertIn('Soviet Union = ברית המועצות', t)
            self.assertIn('שורה נפרדת', t)
        md = (Path(__file__).resolve().parent.parent / 'TRANSLATE.md').read_text(encoding='utf-8')
        self.assertNotIn('כפי שהם', md)


class NoGlossary(unittest.TestCase):
    def test_write_glossary(self):
        with tempfile.TemporaryDirectory() as d:
            td = Path(d)
            gl = pipeline.write_glossary(td, 'Uber\tאובר\n', {'mode': 'haiku-high'})
            self.assertEqual(gl, 'Uber\tאובר')
            self.assertTrue((td / 'glossary.tsv').read_text(encoding='utf-8').endswith('Uber\tאובר\n'))
            gl = pipeline.write_glossary(td, 'Uber\tאובר\n', {'mode': 'haiku-high', 'xg': 1})
            body = (td / 'glossary.tsv').read_text(encoding='utf-8')
            self.assertEqual(gl, '')
            self.assertNotIn('אובר', body)
            self.assertTrue(all(x.startswith('#') for x in body.splitlines() if x.strip()))


if __name__ == '__main__':
    unittest.main()
