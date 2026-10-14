"""בדיקות למנהל העבודה של מצב API (pipeline.py) — מודל מדומה, vt מדומה, בלי רשת ובלי מפתחות."""

from __future__ import annotations

import os
import re
import shutil
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402
import pipeline as P  # noqa: E402

llm.MID_RETRY_WAIT = (0, 0)

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


class HaikuPureTests(unittest.TestCase):
    def test_source_window_and_split_package(self):
        head, parts = P.parse_source(SOURCE)
        w = P.source_window(head, parts, 0, radius=0)
        self.assertIn('#1 ≤40 Hello', w)
        self.assertNotIn('#3', w, 'חלון של החלק בלבד')
        self.assertIn('קטע מהמקור — חלקים 1–1 מתוך 2', w)
        pkg = ('# חבילה\n\n## תדריך\n\nת\n\n## כתוביות (…)\n\n**S1 · 00:00:01**\n#1 Hello\n→ שלום\n#2 Thanks\n→ תודה\n'
               '**S2 · 00:00:09**\n#3 Netflix\n→ נטפליקס\n')
        sl = P.split_package(pkg, 2)
        self.assertEqual(len(sl), 2)
        self.assertTrue(all('## תדריך' in x for x in sl), 'כל קטע עם התדריך והמילון')
        self.assertEqual([sorted(re.findall(r'#(\d+) ', x)) for x in sl], [['1', '2'], ['3']], 'בגבולות כתובית, בלי כפילות')
        self.assertEqual(P.split_package('#1 a\n→ b\n', 3), ['#1 a\n→ b\n'], 'בלי כותרת — כמו שהיא')


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

    def test_truncated_part_keeps_lines_and_asks_only_missing(self):
        # 11/10/2026 (Haiku · High): חשיבה + תרגום עברו את התקרה — התשובה נקטעה באמצע כתובית.
        # קודם: כל העבודה נכשלה (max_tokens). עכשיו: מה שהגיע נשמר (בלי השורה החתוכה) ורק החסר נשלח שוב.
        asks = []

        def h(kw):
            p = kw['messages'][0]['content']
            asks.append(p)
            if 'חלק 1/2' in p:
                m = msg('#1 שלום וברוכים הבאים.\n#2 תודה שהז')
                m.stop_reason = 'max_tokens'
                return m
            if 'חסרו בתשובה' in p:
                self.assertIn('#2', p)
                self.assertNotIn('#1', p, 'מה שכבר הגיע לא מבוקש שוב')
                return msg('#2 תודה שהזמנתם אותי.')
            if 'חלק 2/2' in p:
                return msg('#3 נדבר על נטפליקס.')
            raise AssertionError(p[:80])
        pl = P.Pipeline(self.ctx, self.J, self.engine(h, 'haiku-high'))
        pl.translate(fix=False)
        he = pl.current()
        self.assertEqual(he['2'], 'תודה שהזמנתם אותי.', 'הכתובית שנחתכה לא נשמרה חצויה')
        self.assertEqual(he['1'], 'שלום וברוכים הבאים.')
        self.assertTrue(all(c['max_tokens'] >= 64000 for c in self.client.calls), 'תקרה של 64K לחלק (הייתה 32K)')

    def test_halt_stops_parts_before_calling(self):
        """14/10/2026: "עצור" מהיישור שברקע / כשל בחלק אחר — חלק שעוד לא שלח בקשה לא שולח (עד היום כולם המשיכו, בתשלום)."""
        def h(kw):
            return msg('#1 שלום\n#2 תודה\n#3 נטפליקס')
        pl = P.Pipeline(self.ctx, self.J, self.engine(h))
        pl.halt.set()
        with self.assertRaises(BaseException):
            pl.translate(fix=False)
        self.assertEqual(self.client.calls, [], 'אף בקשה לא נשלחה אחרי העצירה')

    def test_failed_part_sets_halt(self):
        def h(kw):
            raise RuntimeError('boom')
        pl = P.Pipeline(self.ctx, self.J, self.engine(h))
        with self.assertRaises(BaseException):
            pl.translate(fix=False)
        self.assertTrue(pl.halt.is_set(), 'כשל בחלק אחד עוצר את השאר')

    def test_partial_part_file_resumes(self):
        # "המשך" אחרי חלק שנכתב חלקית — ממשיכים ממה שכבר תורגם, לא מאפס (ובלי לשלם עליו שוב)
        (self.pd / 'tr' / 'batch_001.he.txt').write_text('#1 שלום\n', encoding='utf-8')
        asks = []

        def h(kw):
            p = kw['messages'][0]['content']
            asks.append(p)
            return msg('#2 תודה' if '#2' in p else '#3 נטפליקס')
        P.Pipeline(self.ctx, self.J, self.engine(h)).translate(fix=False)
        self.assertTrue(any('חסרו' in a and '#2' in a and '#1' not in a for a in asks), 'רק הכתובית החסרה')
        self.assertEqual(P.answer_lines((self.pd / 'tr' / 'batch_001.he.txt').read_text(encoding='utf-8'), {'1', '2'}), {'1': 'שלום', '2': 'תודה'})
        self.assertFalse(list((self.pd / 'tr').glob('*.part')), 'הכתיבה האטומית לא משאירה קבצים זמניים')

    def test_truncated_part_with_nothing_raises(self):
        def h(kw):
            m = msg('#1 שלום וברוכים הבא')
            m.stop_reason = 'max_tokens'
            return m
        pl = P.Pipeline(self.ctx, self.J, self.engine(h, 'haiku-high'))
        with self.assertRaises(llm.LLMError) as cm:
            pl.translate(fix=False)
        self.assertEqual(cm.exception.code, 'max_tokens')

    def test_fix_round_in_batches(self):
        (self.pd / 'tr' / 'batch_001.he.txt').write_text('#1 ארוך ארוך\n#2 ארוך גם\n', encoding='utf-8')
        (self.pd / 'tr' / 'batch_002.he.txt').write_text('#3 ארוך מאוד\n', encoding='utf-8')
        sizes = []

        def h(kw):
            p = kw['messages'][0]['content']
            ids = re.findall(r'^#(\d+) \[', p, re.M)
            sizes.append(len(ids))
            return msg('\n'.join(f'#{i} מתוקן' for i in ids))
        old = P.FIX_BATCH
        P.FIX_BATCH = 2
        try:
            pl = P.Pipeline(self.ctx, self.J, self.engine(h, 'haiku-high'))
            left = pl.fix_round('fixes.txt', 'X', 'tl')
        finally:
            P.FIX_BATCH = old
        self.assertEqual(sizes, [2, 1], 'שלוש כתוביות לתיקון במנות של 2')
        self.assertEqual(left, 0)
        self.assertTrue(all(c['max_tokens'] == 32000 for c in self.client.calls))

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
        self.assertIn('tl', [r[0] for r in self.ctx.reports], 'במסלול הרגיל — מדווחים על שלב התרגום')

    def test_translate_quiet_in_parallel(self):
        """10/10/2026: במסלול המקבילי היישור מדווח על השלב — התרגום שקט (אחרת השלב קופץ al↔tl והזמנים הנלמדים נשברים)"""
        def h(kw):
            p = kw['messages'][0]['content']
            return msg('#1 שלום.\n#2 תודה.') if 'חלק 1/2' in p else msg('#3 נטפליקס.')
        P.Pipeline(self.ctx, self.J, self.engine(h)).translate(fix=False, quiet=True)
        self.assertNotIn('tl', [r[0] for r in self.ctx.reports])
        self.assertIn('#3 נטפליקס.', (self.pd / 'tr' / 'batch_002.he.txt').read_text(encoding='utf-8'))

    def test_untrusted_output_is_only_text(self):
        def h(kw):
            return msg('=== PATCH ===\n`rm -rf /` => x\n=== BRIEF ===\n=== GLOSSARY ===\n=== QUESTIONS ===\n[]')
        P.Pipeline(self.ctx, self.J, self.engine(h)).proofread()
        self.assertFalse((self.pd / 'en.patch.txt').exists(), 'תיקון שלא קיים בתמליל נזרק; שום פלט לא מורץ')
        self.assertEqual(self.J.cmds, [])

    def test_judge_api_mode(self):
        """השופט (v375) במצב API: Haiku נפרד, המדגם = נתונים בתוך גבולות, העלות בספר הראשי."""
        J = self.J

        def judge_prep(a):
            d = self.pd / 'judge'
            d.mkdir(exist_ok=True)
            (d / 'sample.md').write_text('#1 Hello\n→ שלום\n#2 Thanks\n→ תודה\n', encoding='utf-8')
            J.st = {'jg': {'ids': [1, 2], 'a': 2}}
            return 0

        def judge_read(a):
            J.verdict = (self.pd / 'judge' / 'verdict.txt').read_text(encoding='utf-8')
            return 0
        J.judge_prep, J.judge, J.load_state = judge_prep, judge_read, lambda: getattr(J, 'st', {})

        def h(kw):
            self.assertEqual(kw['model'], 'claude-haiku-5-5', 'מתרגם Opus → השופט Haiku (משפחה אחרת, זול)')
            self.assertIn('<judge_sample>', kw['messages'][0]['content'], 'המדגם = נתונים בגבולות מסומנים')
            return msg('#1 5 ok\n#2 4 flu')
        pl = P.Pipeline(self.ctx, J, self.engine(h, 'opus-medium'))
        pl.judge()
        self.assertEqual(J.verdict, '#1 5 ok\n#2 4 flu\n')
        rows = {r['k']: r for r in pl.eng.ledger.list()}
        self.assertEqual(rows['jg']['m'], 'claude-haiku-5-5', 'עלות השופט נרשמת בספר של העבודה')

    def test_haiku_over_card_windowed_and_review_slices(self):
        """Haiku מעל סף ה־100K: כל חלק עם חלון מהמקור, והביקורת בקטעים — כל בקשה בכרטיס הזול."""
        old = dict(llm.CARD_LIMIT)
        llm.CARD_LIMIT['claude-haiku-5-5'] = 10                           # סף זעיר — תמיד "מעל"
        try:
            def h(kw):
                p = kw['messages'][0]['content']
                if 'חלק 1/2' in p:
                    return msg('#1 שלום\n#2 תודה')
                if 'חלק 2/2' in p:
                    return msg('#3 נטפליקס')
                if '<review_package>' in p:
                    return msg('')
                raise AssertionError(p[:80])
            pl = P.Pipeline(self.ctx, self.J, self.engine(h, 'haiku-high'))
            pl.translate()
            src = [c['system'][0]['text'] for c in self.client.calls]
            self.assertTrue(all('קטע מהמקור' in t for t in src), 'כל חלק עם חלון מהמקור')
            self.assertEqual(pl.current(), {'1': 'שלום', '2': 'תודה', '3': 'נטפליקס'})
            (self.pd / 'review').mkdir(exist_ok=True)
            self.J.vt = (lambda ctx, args, _v=self.J.vt: (_v(ctx, args), (self.pd / 'review' / 'package.md').write_text(
                '# ח\n\n## כתוביות (…)\n\n#1 Hello\n→ שלום\n#2 Thanks\n→ תודה\n#3 Netflix\n→ נטפליקס\n', encoding='utf-8')
                if args[0] == 'review-pack' else None)[0])
            n0 = len(self.client.calls)
            pl.review()
            rv = [c for c in self.client.calls[n0:] if '<review_package>' in c['messages'][0]['content']]
            self.assertEqual(len(rv), 3, 'הביקורת בקטעים (עד כתובית אחת לקטע)')
        finally:
            llm.CARD_LIMIT.clear()
            llm.CARD_LIMIT.update(old)

    def test_judge_always_haiku_high(self):
        J = self.J

        def judge_prep(a):
            d = self.pd / 'judge'
            d.mkdir(exist_ok=True)
            (d / 'sample.md').write_text('#1 Hello\n→ שלום\n', encoding='utf-8')
            J.st = {'jg': {'ids': [1], 'a': 1}}
            return 0
        J.judge_prep, J.judge, J.load_state = judge_prep, (lambda a: 0), lambda: getattr(J, 'st', {})
        seen = []
        pl = P.Pipeline(self.ctx, J, self.engine(lambda kw: seen.append((kw['model'], (kw.get('output_config') or {}).get('effort'))) or msg('#1 5 ok'), 'haiku-high'))
        pl.judge()
        self.assertEqual(seen, [('claude-haiku-5-5', 'high')], 'השופט תמיד Haiku 5.5 · High — גם כשהמתרגם Haiku (11/10)')
        self.assertEqual({r['k']: r['m'] for r in pl.eng.ledger.list()}['jg'], 'claude-haiku-5-5')

    def test_judge_skipped_when_prep_declines(self):
        J = self.J
        J.judge_prep, J.load_state = (lambda a: 0), (lambda: {})
        called = []
        pl = P.Pipeline(self.ctx, J, self.engine(lambda kw: called.append(1) or msg('x')))
        pl.judge()
        self.assertEqual(called, [], 'בלי מדגם (כבוי בחוקים / מעט כתוביות) — אין קריאה למודל')


class JobHooks(unittest.TestCase):
    def test_job_has_auto_and_ask_user(self):
        src = (Path(P.__file__).parent / 'job.py').read_text(encoding='utf-8')
        self.assertIn("'auto': auto", src)
        self.assertRegex(src, r'def ask_user\(ctx, q, opts, default=0, wait=480\)')
        self.assertIn("get('api_usage')", src, 'בסוף העבודה — העלות מה־ledger של המנוע')
        self.assertTrue(re.search(r"'cap': job.get\('cap'\)", src))

    def test_auto_reports_unexpected_crash(self):
        # חריגה לא צפויה ב־run_auto = כשל גלוי מיד (worker_crash), בלי טקסט החריגה (נתיבים) — ואז נזרקת הלאה
        import job as JJ
        sent = []

        class C:
            def __init__(self, st):
                pass

            def report(self, **kw):
                sent.append(kw)
        saved = (P.run_auto, JJ.Ctx, JJ.load_state, JJ.usage_safe, JJ.trace_safe)

        def boom(j, a):
            raise ValueError('/root/work/private-name.mp4')
        P.run_auto, JJ.Ctx, JJ.load_state, JJ.usage_safe, JJ.trace_safe = boom, C, (lambda: {}), (lambda: None), (lambda: None)
        try:
            with self.assertRaises(ValueError):
                JJ.auto(None)
        finally:
            P.run_auto, JJ.Ctx, JJ.load_state, JJ.usage_safe, JJ.trace_safe = saved
        self.assertEqual(len(sent), 1)
        self.assertEqual((sent[0]['fail'], sent[0]['err'], sent[0]['msg']), (True, 'worker_crash', 'ValueError'))


class RunAutoResume(unittest.TestCase):
    """run_auto: המשך מנקודת שמירה מדלג על מה שכבר שולם — בלי Claude אמיתי (Pipeline ו־Engine מדומים)."""

    def flow(self, ck, resumed, proofed=False, src=None, attach=False, tl_fail=False, rc_want=0, park=''):
        log = []
        state = {'job': 'j' + 'a' * 20, 'spec': {'mode': 'opus-medium'}, 'ck': ck}
        if src:
            state['src'] = src

        class Park(Exception):
            pass

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
                if park == 'prepare':
                    raise Park()
                return 0

            def align(self, a):
                log.append('align')
                return 0

            def align_prep(self, ctx):
                log.append('align_prep')

            if attach:
                def attach_video(self, ctx):
                    log.append('attach')
                    if park == 'attach':
                        raise Park()
                    state['src'] = 'v'

            def align_run(self, ctx):
                time.sleep(0.05 if tl_fail else 0)       # היישור ארוך מהתרגום שנכשל — חייבים לחכות לו
                log.append('align_run')
                log.append('ck:al')

            def save_ck(self, ctx, s, extra=None):
                log.append('ck:' + s + ('+pr' if (extra or {}).get('pr') else ''))

            def finish(self, a):
                log.append('finish')
                return 0

            def Ctx(self, st):
                return NS(st=st, report=lambda *a, **k: log.append('fail') if k.get('fail') else log.append('park') if k.get('park') else None)

        J.Park = Park

        class Pl:
            def __init__(self, ctx, j, eng):
                self.ctx = ctx

            def proofread(self):
                log.append('proofread')
                return []

            def translate(self, fix=True, quiet=False):
                log.append('translate')
                if tl_fail:
                    raise P.llm.LLMError('max_tokens', 'נקטעה')

            def fixed_tl(self):
                return ''

            def fix_round(self, *a, **k):
                log.append('fix')
                return 0

            def review(self):
                log.append('review')
                return 0, 0

            def judge(self):
                log.append('judge')

            def save_usage(self):
                pass

        old = (P.Pipeline, P.llm.Engine)
        P.Pipeline, P.llm.Engine = Pl, lambda spec, cap_usd=None: NS(ledger=NS(list=lambda: []))
        try:
            rc = P.run_auto(J(), NS())
        finally:
            P.Pipeline, P.llm.Engine = old
        self.assertEqual(rc, rc_want)
        return log

    def check_parallel(self, log, expect_without_align_run, before='ck:tl'):
        """align_run רץ בתהליכון רקע — הסדר מול translate לא דטרמיניסטי; בודקים מיקום יחסי בלבד."""
        rest = [x for x in log if x not in ('align_run', 'ck:al')]
        self.assertEqual(rest, expect_without_align_run)
        self.assertEqual(log.count('align_run'), 1)
        self.assertGreater(log.index('align_run'), log.index('align_prep'), 'היישור מתחיל אחרי התכנון')
        self.assertLess(log.index('align_run'), log.index(before), 'מחכים ליישור לפני נקודת השמירה')

    def test_fresh(self):
        self.check_parallel(self.flow([], None),
                            ['prepare', 'proofread', 'ck:asr+pr', 'align_prep', 'translate', 'fix', 'ck:tl', 'review', 'judge', 'finish'])

    def test_resume_points(self):
        ck = [{'s': 'asr', 'id': 'x'}]
        self.check_parallel(self.flow(ck, 'asr'),
                            ['restore', 'proofread', 'ck:asr+pr', 'align_prep', 'translate', 'fix', 'ck:tl', 'review', 'judge', 'finish'])
        self.assertEqual(self.flow(ck, 'al'), ['restore', 'translate', 'ck:tl', 'review', 'judge', 'finish'])

        self.assertEqual(self.flow(ck, 'tl'), ['restore', 'review', 'judge', 'finish'], 'אחרי התרגום — לא מתרגמים שוב')
        self.assertEqual(self.flow(ck, 'rv'), ['restore', 'finish'])
        self.check_parallel(self.flow(ck, None),
                            ['restore', 'prepare', 'proofread', 'ck:asr+pr', 'align_prep', 'translate', 'fix', 'ck:tl', 'review', 'judge', 'finish'],
                            )

    def test_translate_failure_waits_for_align_checkpoint(self):
        # 11/10/2026 (תקלה בעבודה אמיתית): התרגום נכשל באמצע (max_tokens) בזמן שהיישור רץ ברקע — העבודה נכשלה מיד,
        # בלי נקודת השמירה של היישור. כל "המשך" חזר לנקודת התמלול ("כותבים כל מילה") ויישר ותרגם מחדש — בתשלום.
        # עכשיו: מחכים שהיישור יישמר (עם החלקים שכבר תורגמו), ורק אז הכשל.
        log = self.flow([], None, tl_fail=True, rc_want=1)
        self.assertIn('ck:al', log, 'נקודת השמירה של היישור נשמרת גם כשהתרגום נכשל')
        self.assertLess(log.index('ck:al'), log.index('fail'), 'הכשל מדווח רק אחרי שהיישור נשמר')
        self.assertNotIn('ck:tl', log)

    def test_resume_after_paid_proofread(self):
        # 09/10/2026: העבודה הראשונה בשרת נכשלה ביישור אחרי ההגהה — "המשך" לא משלם על ההגהה שוב
        ck = [{'s': 'asr', 'id': 'x'}]
        self.check_parallel(self.flow(ck, 'asr', proofed=True),
                            ['restore', 'align_prep', 'translate', 'fix', 'ck:tl', 'review', 'judge', 'finish'])

    def test_audio_first_stays_sequential(self):
        # "הקול קודם": הצירוף עלול לתמלל מחדש והתכנון היה נפסל — נשארים בטור (align המלא)
        self.assertEqual(self.flow([], None, src='a'),
                         ['prepare', 'proofread', 'ck:asr+pr', 'align', 'translate', 'ck:tl', 'review', 'judge', 'finish'])

    def test_park_while_waiting_for_video(self):
        # 15/10/2026: השרת לא תפוס עד 12 שעות כשהסרטון לא עולה. ההגהה (ששולמה) נשמרת, העבודה חוזרת לתור (קוד 3)
        log = self.flow([], None, src='a', attach=True, park='attach', rc_want=3)
        self.assertEqual([x for x in log if x != 'attach'], ['prepare', 'proofread', 'ck:asr+pr', 'park'])
        self.assertLess(log.index('ck:asr+pr'), log.index('park'), 'שומרים לפני שחוזרים לתור')
        # בלקיחה הבאה (הסרטון כבר נרשם): מאותה נקודה, בלי לשלם על ההגהה שוב
        self.check_parallel(self.flow([{'s': 'asr', 'id': 'x'}], 'asr', proofed=True, src='a', attach=True),
                            ['restore', 'attach', 'align_prep', 'translate', 'fix', 'ck:tl', 'review', 'judge', 'finish'])

    def test_park_before_anything_paid(self):
        # בלי קול נפרד: מחכים לסרטון עוד בהכנה — אין מה לשמור, פשוט חוזרים לתור
        self.assertEqual(self.flow([], None, park='prepare', rc_want=3), ['prepare', 'park'])

    def test_audio_first_attaches_then_parallel(self):
        # 10/10/2026: הטלפון תמיד מעלה קול קודם — הסרטון מצטרף ברקע בזמן ההגהה (קיצור היישור), לפני נקודת השמירה
        # של ההגהה (הנקודה עקבית: הסרטון הוא המקור), ואז התרגום רץ במקביל ליישור
        log = self.flow([], None, src='a', attach=True)
        self.assertEqual(log.count('attach'), 1)
        self.assertLess(log.index('attach'), log.index('ck:asr+pr'), 'הצירוף מסתיים לפני נקודת השמירה')
        self.assertGreater(log.index('attach'), log.index('prepare'))
        self.check_parallel([x for x in log if x != 'attach'],
                            ['prepare', 'proofread', 'ck:asr+pr', 'align_prep', 'translate', 'fix', 'ck:tl', 'review', 'judge', 'finish'])
        # המשך מנקודת התמלול של עבודה שהתחילה מהקול — גם כן מצרפים ואז במקביל
        self.check_parallel(self.flow([{'s': 'asr', 'id': 'x'}], 'asr', proofed=True, src='a', attach=True),
                            ['restore', 'attach', 'align_prep', 'translate', 'fix', 'ck:tl', 'review', 'judge', 'finish'])



class AttachInBackground(unittest.TestCase):
    """10/10/2026 (קיצור היישור): צירוף הסרטון רץ בזמן ההגהה — אמיתית במקביל, שקט, ושגיאה בו לא נבלעת."""

    def J(self, attach):
        return NS(attach_video=attach, align_prep=lambda c: None)

    def test_runs_concurrently_with_main_thread(self):
        import threading as T
        started, release = T.Event(), T.Event()

        def attach(c):
            started.set()
            release.wait(5)
            c.st['src'] = 'v'
        st = {'src': 'a', 'files': {'v': {'id': 'x'}}}
        rep = []
        ctx = NS(st=st, report=lambda *a, **k: rep.append((a, k)))
        bg = P.start_attach(self.J(attach), ctx)
        self.assertTrue(started.wait(5), 'הצירוף התחיל לפני שההגהה הסתיימה')
        release.set()
        P.join_attach(self.J(attach), ctx, bg, poll=0.01)
        self.assertEqual(st['src'], 'v', 'אותו מילון מצב')

    def test_quiet_ctx_used(self):
        seen = []
        ctx = NS(st={'files': {'v': {'id': 'x'}}}, report=lambda *a, **k: None, quiet=lambda: 'QUIET')
        bg = P.start_attach(self.J(lambda c: seen.append(c)), ctx)
        P.join_attach(self.J(None), ctx, bg, poll=0.01)
        self.assertEqual(seen, ['QUIET'], 'הרקע לא מזיז את השלב בטלפון')

    def test_error_raised_after_join(self):
        def attach(c):
            raise SystemExit('✗ vt ingest נכשל')
        ctx = NS(st={'files': {'v': {'id': 'x'}}}, report=lambda *a, **k: None)
        bg = P.start_attach(self.J(attach), ctx)
        with self.assertRaises(SystemExit):
            P.join_attach(self.J(attach), ctx, bg, poll=0.01)

    def test_waiting_for_video_pauses_sla_clock(self):
        import threading as T
        go = T.Event()
        st = {'files': {}}
        rep = []
        ctx = NS(st=st, report=lambda *a, **k: rep.append(k))
        bg = P.start_attach(self.J(lambda c: go.wait(5)), ctx)
        t = T.Timer(0.05, lambda: (st['files'].update(v={'id': 'x'}), T.Timer(0.05, go.set).start()))
        t.start()
        P.join_attach(self.J(None), ctx, bg, poll=0.01)
        self.assertTrue(any(k.get('wv') for k in rep), 'מחכים לסרטון → wv (השעון עוצר)')
        self.assertEqual(sum(1 for k in rep if k.get('wv')), 1, 'פעם אחת, לא בכל סיבוב')

    def test_no_attach_in_old_worker(self):
        self.assertIsNone(P.start_attach(NS(), NS(st={})))


class ParkWaitVideo(unittest.TestCase):
    """15/10/2026: wait_video בשרת שלנו — Park אחרי SNB_PARK_AFTER בלי סרטון; ב־Routine (או כשהסרטון כבר כאן) — כמו קודם."""

    def ctx(self, eng, files=None):
        st = {'spec': {'eng': eng} if eng else {}, 'files': files or {}}
        return NS(st=st, report=lambda *a, **k: None, refresh=lambda: None)

    def run_wait(self, c):
        import job as JJ
        old = {k: os.environ.get(k) for k in ('SNB_PARK_AFTER', 'SNB_POLL')}
        os.environ.update(SNB_PARK_AFTER='0.05', SNB_POLL='0.01')
        try:
            return JJ.wait_video(c, 'al', 'x')
        finally:
            for k, v in old.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

    def test_api_parks(self):
        import job as JJ
        with self.assertRaises(JJ.Park):
            self.run_wait(self.ctx('api'))

    def test_routine_keeps_waiting(self):
        import threading as T
        c = self.ctx('')
        T.Timer(0.15, lambda: c.st['files'].update(v={'id': 'v1'})).start()
        self.assertEqual(self.run_wait(c), {'id': 'v1'}, 'ב־Routine אין תור — מחכים כמו קודם')

    def test_video_present_returns(self):
        self.assertEqual(self.run_wait(self.ctx('api', {'v': {'id': 'v2'}})), {'id': 'v2'})


class QuietCtxWorker(unittest.TestCase):
    def test_quiet_reports_only_failures(self):
        import job as JJ
        calls = []
        q = JJ.QuietCtx.__new__(JJ.QuietCtx)
        orig = JJ.Ctx.report
        JJ.Ctx.report = lambda self, *a, **k: calls.append(k)
        try:
            q.report('al', 0.5, 'x', force=True)
            q.report('al', None, 'מחכה', force=True, wv=True)
            q.report(fail=True, err='upload_timeout', force=True)
        finally:
            JJ.Ctx.report = orig
        self.assertEqual(len(calls), 1)
        self.assertTrue(calls[0].get('fail'))


if __name__ == '__main__':
    unittest.main()
