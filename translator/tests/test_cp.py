"""סבב 10: העתק־הדבק לעבודה מלאה — המנוע הידני (llm.ManualEngine), התרגום בבקשה אחת, בלי שופט, ו־job.cp_round
(בקשה כקובץ → מחכים לתשובה ב־op qa → מורידים אותה). הרצה: python -m unittest tests.test_cp (מתוך translator/)."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm        # noqa: E402
import pipeline   # noqa: E402


class Manual(unittest.TestCase):
    def test_complete(self):
        seen = []
        eng = llm.ManualEngine(lambda k, text: seen.append((k, text)) or '#1 שלום')
        r = eng.complete('tl', 'קבוע', 'בקשה', on_first_token=lambda: seen.append('warm'))
        self.assertEqual(r.text, '#1 שלום')
        self.assertEqual(seen[0], 'warm', 'on_first_token נקרא (התרגום המקבילי לא נתקע)')
        k, text = seen[1]
        self.assertEqual(k, 'tl')
        self.assertTrue(text.startswith('קבוע\n\nבקשה') and text.endswith(llm.ManualEngine.FOOT))
        self.assertEqual(eng.ledger.list(), [], 'בלי עלות')
        self.assertEqual(eng.ledger.total(), 0)
        self.assertTrue(eng.fits_card('x' * 10 ** 6, 'y'), 'בלי כרטיס מחיר — כל הבקשה בבת אחת')
        self.assertIsNone(eng.cap)

    def test_empty(self):
        eng = llm.ManualEngine(lambda k, text: '   ')
        with self.assertRaises(llm.LLMError) as e:
            eng.complete('main', 'a', 'b')
        self.assertEqual(e.exception.code, 'cp_empty')


class TlManual(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())
        (self.d / 'tr').mkdir()
        (self.d / 'tr' / 'source.md').write_text(
            'כותרת\n## חלק 1/2 → batch_001.he.txt\n#1 Hello\n#2 World\n## חלק 2/2 → batch_002.he.txt\n#3 Again\n#4 Bye\n', encoding='utf-8')
        self.reports = []
        self.ctx = SimpleNamespace(pdir=self.d, report=lambda *a, **k: self.reports.append((a, k)), st={}, name='x')

    def test_one_request_then_missing(self):
        asks = []

        def ask(k, text):
            asks.append(text)
            return '#1 שלום\n#2 עולם\n#4 ביי\nהסבר שלא שייך' if len(asks) == 1 else '#3 שוב'
        pl = pipeline.Pipeline(self.ctx, SimpleNamespace(), llm.ManualEngine(ask))
        pl.translate(fix=False)
        self.assertEqual(len(asks), 2, 'בקשה אחת לכל החלקים, ועוד אחת רק לחסרות')
        self.assertIn('batch_001.he.txt, batch_002.he.txt', asks[0])
        self.assertIn('#3', asks[1])
        self.assertNotIn('#1', asks[1].split('—')[-1])
        self.assertEqual((self.d / 'tr' / 'batch_001.he.txt').read_text(encoding='utf-8').strip(), '#1 שלום\n#2 עולם')
        self.assertEqual((self.d / 'tr' / 'batch_002.he.txt').read_text(encoding='utf-8').strip(), '#3 שוב\n#4 ביי')

    def test_resume_skips_done(self):
        (self.d / 'tr' / 'batch_001.he.txt').write_text('#1 א\n#2 ב\n', encoding='utf-8')
        asks = []
        pl = pipeline.Pipeline(self.ctx, SimpleNamespace(), llm.ManualEngine(lambda k, t: asks.append(t) or '#3 ג\n#4 ד'))
        pl.translate(fix=False)
        self.assertEqual(len(asks), 1)
        self.assertIn('בבת אחת: batch_002.he.txt —', asks[0], 'חלק שכבר תורגם — לא מבקשים שוב')

    def test_no_judge(self):
        called = []
        J = SimpleNamespace(judge_prep=lambda ns: called.append(1) or 0)
        pipeline.Pipeline(self.ctx, J, llm.ManualEngine(lambda k, t: 'x')).judge()
        self.assertEqual(called, [], 'העתק־הדבק — בלי שופט (הוא רץ ב־API)')


class CpRound(unittest.TestCase):
    def test_round(self):
        import job as J
        d = Path(tempfile.mkdtemp())
        calls, reports, ups = [], [], []
        state = {'cp': {'n': 3, 'a': 'old0000000000', 'as': 5}}

        class C:
            def call(self, op, **kw):
                calls.append(op)
                if op == 'qa':
                    if len(calls) >= 3:              # אחרי שתי בדיקות — התשובה הגיעה
                        state['cp'] = {'n': 4, 'a': 'ans1234567890', 'as': 9}
                    return {'ok': True, 'cp': state['cp']}
                return {'ok': True}

        def report(**k):                             # כמו השרתון: אחרי הדיווח qa מחזיר את הבקשה החדשה (עוד בלי תשובה)
            reports.append(k)
            state['cp'] = {'n': k['cpq']['n'], 'a': '', 'as': 0}
        ctx = SimpleNamespace(c=C(), pdir=d, report=report)
        old = (J.put_output, J.fetch_input)
        J.put_output = lambda ctx, p, name, k, mime: ups.append((p.read_text(encoding='utf-8'), name, k, mime)) or 'req1234567890'

        def fetch(ctx, fid, dest, size):
            self.assertEqual((fid, size), ('ans1234567890', 9))
            dest.write_text('#1 תשובה', encoding='utf-8')
        J.fetch_input = fetch
        os.environ['SNB_CP_POLL'] = '0'
        try:
            out = J.cp_round(ctx, 'tl', 'הבקשה')
        finally:
            J.put_output, J.fetch_input = old
            os.environ.pop('SNB_CP_POLL', None)
        self.assertEqual(out, '#1 תשובה')
        self.assertEqual(ups[0][0], 'הבקשה')
        self.assertEqual(ups[0][2:], ('cpq', 'text/plain'))
        self.assertEqual(reports[0]['cpq'], {'n': 4, 'r': 'tl', 'id': 'req1234567890'}, 'המספר = הבקשה הקודמת בשרתון + 1')
        self.assertNotIn('claim', calls, 'רק op qa — בלי כתיבה למסמך בכל בדיקה')

    def test_timeout(self):
        import job as J
        d = Path(tempfile.mkdtemp())

        class C:
            def call(self, op, **kw):
                return {'ok': True, 'cp': {'n': 1, 'a': '', 'as': 0}}
        ctx = SimpleNamespace(c=C(), pdir=d, report=lambda **k: None)
        old = J.put_output
        J.put_output = lambda *a, **k: 'req1234567890'
        os.environ.update(SNB_CP_POLL='0', SNB_ASK_WAIT_SCALE='0.00001')
        try:
            with self.assertRaises(llm.LLMError) as e:
                J.cp_round(ctx, 'main', 'x')
        finally:
            J.put_output = old
            os.environ.pop('SNB_CP_POLL', None); os.environ.pop('SNB_ASK_WAIT_SCALE', None)
        self.assertEqual(e.exception.code, 'cp_timeout')


class Wiring(unittest.TestCase):
    def test_run_auto_picks_manual(self):
        src = (Path(pipeline.__file__)).read_text(encoding='utf-8')
        self.assertIn("(st.get('spec') or {}).get('cp') == 1 and hasattr(J, 'cp_round')", src)
        self.assertIn('llm.ManualEngine(lambda k, text: J.cp_round(J.Ctx(J.load_state()), k, text))', src)


if __name__ == '__main__':
    unittest.main()
