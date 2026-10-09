"""בדיקות למנהל העבודה של מצב API (pipeline.py) — מודל מדומה, vt מדומה, בלי רשת ובלי מפתחות."""

from __future__ import annotations

import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402
import pipeline as P  # noqa: E402

SOURCE = """# המקור לתרגום — כל הראיון

שורה: `#מספר ≤תקציב טקסט`.

## חלק 1/2 → batch_001.he.txt

**S1 · 00:00:01**
#1 ≤40 Hello and welcome.
#2 ≤40 Thanks for having me.

## חלק 2/2 → batch_002.he.txt

**S2 · 00:00:09**
#3 ≤40 Let's talk about Netflix.
"""


def msg(text, i=100, o=50, cr=0, c5=0):
    u = NS(input_tokens=i, output_tokens=o, cache_read_input_tokens=cr, cache_creation_input_tokens=c5, cache_creation=None)
    return NS(content=[NS(type='text', text=text)], stop_reason='end_turn', usage=u)


class Client:
    """messages.stream(**kw) — התשובה מחושבת מהבקשה (handler)."""

    def __init__(self, handler):
        self.handler, self.calls, self.messages = handler, [], self

    def stream(self, **kw):
        self.calls.append(kw)
        m = self.handler(kw)

        class S:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def get_final_message(self):
                return m
        return S()


class FakeJ:
    """המודול job — רק מה ש־pipeline צריך. tr-check מדומה: חסר = שגיאה, 'ארוך' = שגיאת אורך, 'תקציב' = הערה."""

    def __init__(self, pd: Path):
        self.pd, self.cmds, self.asked = pd, [], []

    def save_state(self, st):
        pass

    def ask_user(self, ctx, q, opts, d, wait):
        self.asked.append(q)
        return 'ביל אקמן', 'answer'

    def vt(self, ctx, args):
        self.cmds.append(args[0])
        td = self.pd / 'tr'
        if args[0] == 'tr-check':
            he = P.Pipeline(ctx, self, None).current()
            issues = []
            for k in ('1', '2', '3'):
                if k not in he:
                    issues.append(f'- #{k}: חסר תרגום')
                elif 'ארוך' in he[k]:
                    issues.append(f'- #{k}: 90 תווים — מעל 84 (לא ייכנס בשתי שורות)')
                elif 'מילולי' in he[k]:
                    issues.append(f'- #{k}: 45 תווים מול תקציב 40 (קצב קריאה) — לשקול קיצור')
            errs = sum(1 for x in issues if 'לשקול' not in x)
            (td / 'check.md').write_text('# בדיקת תרגום\n\n' + '\n'.join(issues) + '\n', encoding='utf-8')
            return [f'תורגמו {len(he)}/3 · שגיאות {errs}']
        if args[0] == 'review-pack':
            (self.pd / 'review').mkdir(exist_ok=True)
            (self.pd / 'review' / 'package.md').write_text('#1 Hello → שלום\n#3 Netflix → נטפליקס\n', encoding='utf-8')
        return []


class Ctx:
    def __init__(self, pd):
        self.pdir, self.name, self.st, self.reports = pd, 'job', {'spec': {'terms': 'Bill Ackman'}}, []

    def report(self, st=None, p=None, msg=None, force=False, **extra):
        self.reports.append((st, p, msg, extra))


class PureTests(unittest.TestCase):
    def test_sections_patch_glossary_questions(self):
        out = ('=== PATCH ===\nnetflicks => Netflix\nthe => THE\nzzz => y\n'
               '=== BRIEF ===\n## 1. על מה\nנטפליקס\n=== GLOSSARY ===\nNetflix\tנטפליקס\n| Reed | ריד |\n---\n'
               '=== QUESTIONS ===\n[{"q":"איך כותבים?","opts":["א","ב"],"default":1},{"q":"2"},{"q":"3"}]')
        sec = P.split_sections(out)
        self.assertEqual(set(sec), {'PATCH', 'BRIEF', 'GLOSSARY', 'QUESTIONS'})
        ok, dropped = P.valid_patch('[S1] netflicks is the the best', sec['PATCH'])
        self.assertEqual(ok, ['netflicks => Netflix'], 'רק תיקון שהישן שלו מופיע בדיוק פעם אחת')
        self.assertEqual(len(dropped), 2)
        self.assertEqual(P.clean_glossary(sec['GLOSSARY']), 'Netflix\tנטפליקס\nReed\tריד')
        qs = P.parse_questions(sec['QUESTIONS'])
        self.assertEqual(len(qs), 2, 'לכל היותר 2 שאלות')
        self.assertEqual((qs[0]['default'], qs[1]['opts'], qs[1]['default']), (1, [], -1))
        self.assertEqual(P.parse_questions('אין'), [])

    def test_source_answers_issues(self):
        head, parts = P.parse_source(SOURCE)
        self.assertIn('המקור לתרגום', head)
        self.assertEqual([(p['k'], p['file'], p['ids']) for p in parts],
                         [(1, 'batch_001.he.txt', ['1', '2']), (2, 'batch_002.he.txt', ['3'])])
        self.assertEqual(P.answer_lines('הנה:\n#1 שלום\n#9 זר\n```\n#2  תודה ', {'1', '2'}), {'1': 'שלום', '2': 'תודה'})
        hard, soft = P.parse_issues('- #1: חסר תרגום\n- #2: 45 תווים מול תקציב 40 (קצב קריאה) — לשקול קיצור\n- #3: אותיות לועזיות: X')
        self.assertEqual((list(hard), list(soft)), (['1'], ['2']), 'לועזית (שם מותג) לא נשלחת לתיקון')


class FlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.pd = self.tmp / 'job'
        (self.pd / 'tr').mkdir(parents=True)
        (self.pd / 'en.edit.txt').write_text('[S1] Hello and welcom.\n[S2] Thanks for having me.\n', encoding='utf-8')
        (self.pd / 'tr' / 'source.md').write_text(SOURCE, encoding='utf-8')
        self.ctx, self.J = Ctx(self.pd), FakeJ(self.pd)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def engine(self, handler, mode='opus-medium'):
        self.client = Client(handler)
        return llm.Engine(llm.Spec.of(mode), client=self.client)

    def test_proofread_and_ask(self):
        def h(kw):
            return msg('=== PATCH ===\nwelcom. => welcome.\n=== BRIEF ===\nתדריך\n=== GLOSSARY ===\nNetflix\tנטפליקס\n'
                       '=== QUESTIONS ===\n[{"q":"כתיב השם?","opts":["ביל אקמן","ביל אקמאן"],"default":0}]')
        pl = P.Pipeline(self.ctx, self.J, self.engine(h))
        qs = pl.proofread()
        kw = self.client.calls[0]
        self.assertIn('<transcript>', kw['messages'][0]['content'], 'התמליל = נתונים בתוך גבולות מסומנים')
        self.assertIn('<user_terms>\nBill Ackman', kw['messages'][0]['content'])
        self.assertEqual(kw['system'][0]['cache_control'], {'type': 'ephemeral', 'ttl': '1h'})
        self.assertEqual((self.pd / 'en.patch.txt').read_text(encoding='utf-8'), 'welcom. => welcome.\n')
        self.assertTrue((self.pd / 'tr' / 'glossary.tsv').read_text(encoding='utf-8').endswith('Netflix\tנטפליקס\n'))
        pl.ask(qs)
        self.assertEqual(self.J.asked, ['כתיב השם?'])
        self.assertIn('כתיב השם? → ביל אקמן', (self.pd / 'tr' / 'brief.md').read_text(encoding='utf-8'))

    def test_translate_retry_missing_and_fix_round(self):
        def h(kw):
            p = kw['messages'][0]['content']
            if 'חלק 1/2' in p:
                return msg('#1 שלום וברוכים הבאים — ארוך')          # #2 חסר + #1 ארוך מדי
            if 'חסרו בתשובה' in p:
                return msg('#2 תודה שהזמנתם אותי.')
            if 'חלק 2/2' in p:
                return msg('#3 בוא נדבר על נטפליקס במילולי')         # הערת תקציב (לשקול)
            if '<to_fix>' in p:
                self.assertIn('#1 [חייב', p)
                self.assertIn('#3 [לשקול', p)
                self.assertNotIn('#2 [', p, 'כתובית תקינה לא נשלחת לתיקון')
                return msg('#1 שלום וברוכים הבאים.\n#3 נדבר על נטפליקס.')
            raise AssertionError(p[:80])
        pl = P.Pipeline(self.ctx, self.J, self.engine(h))
        pl.translate()
        td = self.pd / 'tr'
        self.assertEqual(P.answer_lines((td / 'batch_001.he.txt').read_text(encoding='utf-8'), {'1', '2'})['2'], 'תודה שהזמנתם אותי.')
        self.assertIn('#1 שלום וברוכים הבאים.', (td / 'fixes.txt').read_text(encoding='utf-8'))
        self.assertEqual(pl.current()['3'], 'נדבר על נטפליקס.', 'קובץ התיקונים דורס את התרגום')
        sys0 = {c['system'][0]['text'] for c in self.client.calls}
        self.assertEqual(len(sys0), 1, 'הבלוק הקבוע זהה בכל קריאות התרגום → מטמון')
        self.assertIn('<source>', next(iter(sys0)))
        rows = {r['k']: r for r in pl.eng.ledger.list()}
        self.assertEqual((rows['tl']['n'], rows['tl']['m']), (4, 'claude-opus-5-5'))

    def test_review_and_single_model(self):
        (self.pd / 'tr' / 'batch_001.he.txt').write_text('#1 שלום\n#2 תודה\n', encoding='utf-8')
        (self.pd / 'tr' / 'batch_002.he.txt').write_text('#3 נטפליקס\n', encoding='utf-8')

        def h(kw):
            p = kw['messages'][0]['content']
            if '<review_package>' in p:
                return msg('#3 בואו נדבר על נטפליקס.\n#7 לא קיים')
            raise AssertionError('לא אמורה להיות קריאה נוספת — הבדיקה נקייה')
        pl = P.Pipeline(self.ctx, self.J, self.engine(h, 'sonnet-high'))
        n, left = pl.review()
        self.assertEqual((n, left), (1, 0))
        self.assertEqual((self.pd / 'tr' / 'fixes_review.txt').read_text(encoding='utf-8'), '#3 בואו נדבר על נטפליקס.\n')
        self.assertEqual(self.J.cmds[:3], ['tr-merge', 'build', 'review-pack'])
        self.assertEqual({r['m'] for r in pl.eng.ledger.list()}, {'claude-sonnet-5-5'})

    def test_resume_skips_translated_parts(self):
        (self.pd / 'tr' / 'batch_001.he.txt').write_text('#1 שלום\n#2 תודה\n', encoding='utf-8')
        seen = []

        def h(kw):
            seen.append(kw['messages'][0]['content'])
            return msg('#3 נטפליקס')
        P.Pipeline(self.ctx, self.J, self.engine(h)).translate()
        self.assertEqual(len(seen), 1)
        self.assertIn('חלק 2/2', seen[0], 'חלק שכבר תורגם לא נשלח שוב')

    def test_translate_parallel_after_first_token(self):
        """החלק הראשון נשלח לבד; רק אחרי שהשרת התחיל לענות לו (= הבלוק הקבוע במטמון) שאר החלקים יוצאים."""
        order = []

        def h(kw):
            p = kw['messages'][0]['content']
            order.append('1' if 'חלק 1/2' in p else '2' if 'חלק 2/2' in p else '?')
            if 'חלק 1/2' in p:
                return msg('#1 שלום.\n#2 תודה.')
            if 'חלק 2/2' in p:
                return msg('#3 נטפליקס.')
            raise AssertionError(p[:80])
        pl = P.Pipeline(self.ctx, self.J, self.engine(h))
        pl.translate()
        self.assertEqual(order[0], '1', 'החלק הראשון כותב את המטמון לפני שהשאר יוצאים')
        self.assertEqual(sorted(order), ['1', '2'])
        for f, want in (('batch_001.he.txt', '#1 שלום.'), ('batch_002.he.txt', '#3 נטפליקס.')):
            self.assertIn(want, (self.pd / 'tr' / f).read_text(encoding='utf-8'))

    def test_untrusted_output_is_only_text(self):
        def h(kw):
            return msg('=== PATCH ===\n`rm -rf /` => x\n=== BRIEF ===\n=== GLOSSARY ===\n=== QUESTIONS ===\n[]')
        P.Pipeline(self.ctx, self.J, self.engine(h)).proofread()
        self.assertFalse((self.pd / 'en.patch.txt').exists(), 'תיקון שלא קיים בתמליל נזרק; שום פלט לא מורץ')
        self.assertEqual(self.J.cmds, [])


class JobHooks(unittest.TestCase):
    def test_job_has_auto_and_ask_user(self):
        src = (Path(P.__file__).parent / 'job.py').read_text(encoding='utf-8')
        self.assertIn("'auto': auto", src)
        self.assertRegex(src, r'def ask_user\(ctx, q, opts, default=0, wait=480\)')
        self.assertIn("get('api_usage')", src, 'בסוף העבודה — העלות מה־ledger של המנוע')
        self.assertTrue(re.search(r"'cap': job.get\('cap'\)", src))


class RunAutoResume(unittest.TestCase):
    """run_auto: המשך מנקודת שמירה מדלג על מה שכבר שולם — בלי Claude אמיתי (Pipeline ו־Engine מדומים)."""

    def flow(self, ck, resumed, proofed=False):
        log = []
        state = {'job': 'j' + 'a' * 20, 'spec': {'mode': 'opus-medium'}, 'ck': ck}

        class J:
            def load_state(self):
                return state

            def save_state(self, st):
                pass

            def restore(self, a):
                log.append('restore')
                state['resumed'] = resumed
                state['proofed'] = proofed
                return 0

            def prepare(self, a):
                log.append('prepare')
                return 0

            def align(self, a):
                log.append('align')
                return 0

            def save_ck(self, ctx, s, extra=None):
                log.append('ck:' + s + ('+pr' if (extra or {}).get('pr') else ''))

            def finish(self, a):
                log.append('finish')
                return 0

            def Ctx(self, st):
                return NS(st=st, report=lambda *a, **k: None)

        class Pl:
            def __init__(self, ctx, j, eng):
                self.ctx = ctx

            def proofread(self):
                log.append('proofread')
                return []

            def translate(self):
                log.append('translate')

            def review(self):
                log.append('review')
                return 0, 0

            def save_usage(self):
                pass

        old = (P.Pipeline, P.llm.Engine)
        P.Pipeline, P.llm.Engine = Pl, lambda spec, cap_usd=None: NS(ledger=NS(list=lambda: []))
        try:
            rc = P.run_auto(J(), NS())
        finally:
            P.Pipeline, P.llm.Engine = old
        self.assertEqual(rc, 0)
        return log

    def test_fresh(self):
        self.assertEqual(self.flow([], None), ['prepare', 'proofread', 'ck:asr+pr', 'align', 'translate', 'ck:tl', 'review', 'finish'])

    def test_resume_points(self):
        ck = [{'s': 'asr', 'id': 'x'}]
        self.assertEqual(self.flow(ck, 'asr'), ['restore', 'proofread', 'ck:asr+pr', 'align', 'translate', 'ck:tl', 'review', 'finish'])
        self.assertEqual(self.flow(ck, 'al'), ['restore', 'translate', 'ck:tl', 'review', 'finish'])
        self.assertEqual(self.flow(ck, 'tl'), ['restore', 'review', 'finish'], 'אחרי התרגום — לא מתרגמים שוב')
        self.assertEqual(self.flow(ck, 'rv'), ['restore', 'finish'])
        self.assertEqual(self.flow(ck, None), ['restore', 'prepare', 'proofread', 'ck:asr+pr', 'align', 'translate', 'ck:tl', 'review', 'finish'],
                         'נקודת שמירה פגומה → מההתחלה')

    def test_resume_after_paid_proofread(self):
        # 09/10/2026: העבודה הראשונה בשרת נכשלה ביישור אחרי ההגהה — "המשך" לא משלם על ההגהה שוב
        ck = [{'s': 'asr', 'id': 'x'}]
        self.assertEqual(self.flow(ck, 'asr', proofed=True), ['restore', 'align', 'translate', 'ck:tl', 'review', 'finish'])


if __name__ == '__main__':
    unittest.main()
