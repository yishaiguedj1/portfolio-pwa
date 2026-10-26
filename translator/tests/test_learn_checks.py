"""26/10/2026 — מאגר הלמידה: "מה כל שלב תיקן ומה קלקל" בלי שיפוט ידני.
pipeline רושם את קודי הבודק לכל כתובית בכל נקודה (tr/learn_checks.json) ואת התשובות שנזרקו (tr/learn_rej.jsonl);
job.learn_corpus מכניס אותם לקורפוס, ו־learnmetrics מחשב מהם מספרים (תוקנו / נשארו / נוצרו) לרשומה."""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import job  # noqa: E402
import learnmetrics as LM  # noqa: E402
import pipeline as P  # noqa: E402
from test_pipeline import FixStages2510, msg  # noqa: E402


class Codes(unittest.TestCase):
    def test_check_codes(self):
        md = '# בדיקה\n\n- #3: [num] המספר 5 נעלם\n- #3: [cps] 45 תווים מול תקציב 40\n- #3: [num] עוד\n- #7: בלי קוד\nשורה אחרת\n'
        self.assertEqual(P.check_codes(md), {'3': ['cps', 'num'], '7': ['?']})

    def test_metrics(self):
        corpus = {'ccs': ['f0', 'f1', 'z0', 'z1'], 'cu': [
            {'i': 1, 'cc': {'f0': ['cps'], 'f1': ['cps']}},       # נשארה לאורך כל הדרך? לא — נעלמה ב־z0
            {'i': 2, 'cc': {'f0': ['num']}},                       # תוקנה בסבב התיקון
            {'i': 3, 'cc': {'z1': ['hdg']}},                       # נוצרה בתיקון האחרון
            {'i': 4}]}
        m = LM.check_metrics(corpus)
        self.assertEqual((m['f0f1.fx'], m['f0f1.kp'], m['f0f1.nw']), (1, 1, 0))
        self.assertEqual((m['f1z0.fx'], m['z0z1.nw']), (1, 1))
        self.assertEqual((m['n0'], m['n1'], m['nw.hdg']), (2, 1, 1))
        self.assertIsNone(LM.check_metrics({'ccs': ['f0'], 'cu': []}), 'נקודה אחת — אין מעבר')
        self.assertEqual(LM.rej_metrics([{'s': 'f', 'w': 'ok'}, {'s': 'f', 'w': 'ok'}, {'s': 'q', 'w': 'qs'}]), {'f.ok': 2, 'q.qs': 1})

    def test_stages_match_server(self):
        js = (Path(__file__).resolve().parents[2] / 'ibkr-proxy' / 'lib' / 'learncorpus.js').read_text(encoding='utf-8')
        self.assertIn("const CK_STAGES = ['f0', 'f1', 'z0', 'z1', 'q1'];", js)
        self.assertEqual(job.LC_CK_STAGES, LM.CK_ORDER)
        self.assertEqual(job.LC_CK_STAGES, tuple(P.CK_STAGE[f] + n for f in ('fixes.txt', 'fixes_zfinal.txt') for n in '01') + ('q1',))
        self.assertIn("const REJ_W = ['" + "', '".join(job.LC_REJ_W) + "'];", js)


class Recorded(unittest.TestCase):
    setUp, tearDown, engine, write = FixStages2510.setUp, FixStages2510.tearDown, FixStages2510.engine, FixStages2510.write

    def test_fix_round_records_before_after(self):
        self.write('#1 שלום\n#2 ארוך מדי\n', '#3 נטפליקס\n')
        P.Pipeline(self.ctx, self.J, self.engine(lambda kw: msg('#2 קצר'))).fix_round('fixes.txt', 'X', 'tl')
        ck = json.loads((self.pd / 'tr' / P.CK_FILE).read_text(encoding='utf-8'))
        self.assertEqual(ck['f0'], {'2': ['?']}, 'לפני הסבב — שגיאת האורך (FakeJ בלי קודים)')
        self.assertEqual(ck['f1'], {}, 'אחרי — תוקנה')

    def test_rejections_recorded(self):
        # אותו תרחיש של test_review_sees_auto_fixes_and_zfinal_keeps_review: התשובה שמחזירה את הנוסח שלפני הביקורת נזרקת
        self.write('#1 שלום רב\n#2 תודה\n', '#3 נטפליקס\n', fixes='#1 שלום\n')

        def h(kw):
            p = kw['messages'][0]['content']
            if '<review_package>' in p:
                return msg('#3 נדבר על נטפליקס במילולי\n#1 שלום רב במילולי')
            return msg('#3 נטפליקס\n#1 שלום לכולם')
        P.Pipeline(self.ctx, self.J, self.engine(h)).review()
        rj = [json.loads(x) for x in (self.pd / 'tr' / P.REJ_FILE).read_text(encoding='utf-8').splitlines()]
        self.assertIn(('z', '3', 'נטפליקס'), {(r['s'], r['i'], r['t']) for r in rj}, 'החזרה לנוסח שלפני הביקורת — נרשמה כנזרקת')
        self.assertTrue({r['w'] for r in rj} <= {'ok', 'keep'})
        ck = json.loads((self.pd / 'tr' / P.CK_FILE).read_text(encoding='utf-8'))
        self.assertIn('z0', ck)
        self.assertIn('z1', ck)

    def test_proof_dropped(self):
        P.rej_dropped(self.pd / 'tr', ['nf: welcom', 'amb: the (3)', 'weird'])
        rj = [json.loads(x) for x in (self.pd / 'tr' / P.REJ_FILE).read_text(encoding='utf-8').splitlines()]
        self.assertEqual({(r['w'], r['t']) for r in rj}, {('p_nf', 'welcom'), ('p_amb', 'the (3)'), ('p_x', '')})

    def test_cap_and_bad_dir(self):
        P.rej_record(self.pd / 'nope' / 'x', 'f', {'1': 'a'}, 'ok')        # תיקייה שלא קיימת — לא מפיל
        P.ck_record(self.pd / 'nope' / 'x', 'f0', {})
        P.rej_record(self.pd / 'tr', 'f', {str(i): 'x' for i in range(P.REJ_MAX + 50)}, 'ok')
        P.rej_record(self.pd / 'tr', 'f', {'1': 'x'}, 'ok')
        n = len((self.pd / 'tr' / P.REJ_FILE).read_text(encoding='utf-8').splitlines())
        self.assertEqual(n, P.REJ_MAX)

    def test_corpus_and_metrics(self):
        td = self.pd / 'tr'
        (self.pd / 'cues.en.json').write_text(json.dumps([{'id': i, 'en': 'x'} for i in (1, 2, 3)]), encoding='utf-8')
        (td / 'batch_001.he.txt').write_text('#1 א\n#2 ב\n#3 ג\n', encoding='utf-8')
        P.ck_record(td, 'f0', {'2': ['num'], '3': ['cps']})
        P.ck_record(td, 'f1', {'3': ['cps'], '1': ['hdg']})
        P.ck_record(td, 'bogus', {'1': ['x']})
        P.rej_record(td, 'f', {'2': 'הצעה שהחמירה'}, 'ok')
        with (td / P.REJ_FILE).open('a', encoding='utf-8') as f:
            f.write('לא JSON\n' + json.dumps({'s': 'f', 'i': '9', 't': 'x', 'w': 'זדוני'}) + '\n')
        ctx = type('C', (), {'pdir': self.pd, 'st': {'spec': {}}})()
        c = job.learn_corpus(ctx)
        cu = {x['i']: x for x in c['cu']}
        self.assertEqual(c['ccs'], ['f0', 'f1'])
        self.assertEqual(cu[2]['cc'], {'f0': ['num']})
        self.assertEqual(cu[1]['cc'], {'f1': ['hdg']})
        self.assertEqual(c['rj'], [{'s': 'f', 'i': '2', 't': 'הצעה שהחמירה', 'w': 'ok'}], 'שורה שבורה / סיבה לא מוכרת — בחוץ')
        m = LM.job_metrics(c)
        self.assertEqual((m['ck']['f0f1.fx'], m['ck']['f0f1.kp'], m['ck']['f0f1.nw']), (1, 1, 1))
        self.assertEqual(m['rj'], {'f.ok': 1})


if __name__ == '__main__':
    unittest.main()
