"""26/10/2026: שתי טיוטות + הכרעה בקטעים שבהם הן שונות, ו"לא להזיק" בסבבי התיקון (fix_ok, FIX_SKIP, החזרה לאחור).
מודל מדומה, vt מדומה (FakeJ של test_pipeline), משפטים סינתטיים בלבד."""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402
import pipeline as P  # noqa: E402
from test_pipeline import SOURCE, Client, Ctx, FakeJ, msg  # noqa: E402


class PureDual(unittest.TestCase):
    def test_segments(self):
        order = ['1', '2', '3', '4', '5']
        a = {'1': 'שלום לכולם', '2': 'החברה גדלה מהר', '3': 'זה נכון', '4': '=', '5': 'סוף טוב'}
        b = {'1': 'שלום לכולם!', '2': 'העסק צמח במהירות', '3': 'אין ספק שזה כך', '4': 'משהו', '5': 'סוף טוב'}
        self.assertEqual(P.dual_segments(order, a, b), [], 'קטע עם "=" לא נכנס; פיסוק בלבד = זהה')
        a['4'] = 'עוד שורה'
        b['4'] = 'עוד שורה'
        self.assertEqual(P.dual_segments(order, a, b), [['2', '3']], 'רצף של כתוביות שונות = קטע אחד')
        req = P.arb_request([['2', '3']], {'2': 'It grew fast', '3': 'True'}, a, b, first=4)
        self.assertTrue(req.startswith('§4'))
        self.assertIn('EN #2: It grew fast', req)
        self.assertIn('A: #2 החברה גדלה מהר | #3 זה נכון', req)
        self.assertIn('B: #2 העסק צמח במהירות | #3 אין ספק שזה כך', req)

    def test_parse_picks(self):
        self.assertEqual(P.parse_picks('§1 A\n§2 B\n§ 3: B\n§9 B\n', 1, 3), {1: 'A', 2: 'B', 3: 'B'})
        self.assertEqual(P.parse_picks('§1 B\n§1 A\n§2 B', 1, 2), {2: 'B'}, 'סתירה — לא נבחר (נשאר A)')
        self.assertEqual(P.parse_picks('אין תשובה', 1, 2), {})


class PureFixOk(unittest.TestCase):
    def test_rules(self):
        cps = ['[cps] 45 תווים מול תקציב 40 (קצב קריאה) — לשקול קיצור']
        self.assertFalse(P.fix_ok('א ב', 'א ב', cps), 'בלי שינוי')
        self.assertTrue(P.fix_ok('המחיר עלה ב־30 אחוז השנה', 'המחיר עלה ב־30% השנה', cps, 'up 30 percent'))
        self.assertFalse(P.fix_ok('המחיר עלה ב־30 אחוז השנה', 'המחיר עלה מאוד השנה', cps, 'up 30 percent'),
                         'מספר מהמקור שנעלם')
        self.assertFalse(P.fix_ok('הם בנו את זה לאט', 'הם בנו את זה לאט מאוד', cps), '"קיצור" שהאריך')
        self.assertFalse(P.fix_ok('אנחנו בונים מערכת שעובדת בכל מקום בעולם', 'בונים', cps), 'חיתוך עמוק')
        self.assertFalse(P.fix_ok('משהו', '=', cps), 'איחוד בלי בעיה שחייבת')
        self.assertTrue(P.fix_ok('משהו', '=', ['[len] ארוך'], hard=True))
        nm = ['[name] כתיב השם']
        self.assertTrue(P.fix_ok('דיברנו עם אקמן אתמול', 'דיברנו עם אקמאן אתמול', nm))
        self.assertFalse(P.fix_ok('דיברנו עם אקמן אתמול בערב', 'דיברנו', nm), 'פחות מחצי — נזרק')

    def test_skip_codes(self):
        self.assertEqual(P.FIX_SKIP, frozenset(('num', 'gls')))
        self.assertTrue(P.FIX_SKIP <= P.CODE_SOFT, 'רק הערות "לשקול" — בעיה שחייבת נשלחת תמיד')


class Flow(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.pd = self.tmp / 'job'
        (self.pd / 'tr').mkdir(parents=True)
        (self.pd / 'tr' / 'source.md').write_text(SOURCE, encoding='utf-8')
        (self.pd / 'cues.en.json').write_text(json.dumps([
            {'id': 1, 'en': 'Hello and welcome.'}, {'id': 2, 'en': 'Thanks for having me.'},
            {'id': 3, 'en': "Let's talk about Netflix."}]), encoding='utf-8')
        self.ctx, self.J = Ctx(self.pd), FakeJ(self.pd)
        self.env = os.environ.pop('SNB_TL_DUAL', None)
        os.environ['SNB_TL_DUAL'] = 'on'          # 28/10/2026: כבויה כברירת מחדל — המנגנון נבדק כשמדליקים אותו

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)
        os.environ.pop('SNB_TL_DUAL', None)
        if self.env is not None:
            os.environ['SNB_TL_DUAL'] = self.env

    def engine(self, handler, mode='haiku-high'):
        self.client = Client(handler)
        return llm.Engine(llm.Spec.of(mode), client=self.client)

    def test_dual_draft_and_arbiter(self):
        calls = {'tl1': 0, 'arb': 0}

        def h(kw):
            p = kw['messages'][0]['content']
            if '<compare>' in p:
                calls['arb'] += 1
                self.assertIn('EN #3', p)
                self.assertNotIn('#1 ', p.split('<compare>')[1], 'כתובית זהה בשתי הטיוטות לא נשלחת להכרעה')
                return msg('§1 B')
            if 'חלק 1/2' in p:
                calls['tl1'] += 1
                return msg('#1 שלום וברוכים הבאים.\n#2 תודה שהזמנתם אותי.')
            if 'חלק 2/2' in p:
                # הקריאה הראשונה = טיוטה A, השנייה = B (המודל המדומה עונה אחרת כל פעם)
                calls.setdefault('tl2', 0)
                calls['tl2'] += 1
                return msg('#3 בואו נדבר על נטפליקס.' if calls['tl2'] == 1 else '#3 עכשיו על נטפליקס.')
            raise AssertionError(p[:80])
        pl = P.Pipeline(self.ctx, self.J, self.engine(h))
        self.assertTrue(pl.dual_on(), 'SNB_TL_DUAL=on — דולק')
        pl.translate(fix=False)
        self.assertEqual((calls['tl1'], calls['tl2'], calls['arb']), (2, 2, 1), 'כל חלק פעמיים, הכרעה אחת')
        a, b = P.answer_lines((self.pd / 'tr' / 'batch_002.he.txt').read_text(encoding='utf-8'), {'3'}), \
            P.answer_lines((self.pd / 'tr' / 'alt' / 'batch_002.he.txt').read_text(encoding='utf-8'), {'3'})
        self.assertNotEqual(a, b)
        picked = pl.draft()['3']
        self.assertEqual(picked, b['3'], 'B נבחרה → היא הטיוטה')
        self.assertEqual(pl.current()['3'], b['3'])
        self.assertEqual(self.ctx.st['dual'], {'sg': 1, 'c': 1, 'b': 1, 'bc': 1, 'n': 3})
        # "המשך": ההכרעה כבר נכתבה — בלי טיוטה שנייה ובלי הכרעה נוספת
        n0 = len(self.client.calls)
        pl.translate(fix=False)
        self.assertEqual(len(self.client.calls), n0)

    def test_dual_off_and_other_models(self):
        def h(kw):
            p = kw['messages'][0]['content']
            return msg('#1 שלום.\n#2 תודה.') if 'חלק 1/2' in p else msg('#3 נטפליקס.')
        os.environ['SNB_TL_DUAL'] = 'off'
        P.Pipeline(self.ctx, self.J, self.engine(h)).translate(fix=False)
        self.assertEqual(len(self.client.calls), 2)
        self.assertFalse((self.pd / 'tr' / 'alt').exists())
        os.environ.pop('SNB_TL_DUAL')
        self.assertFalse(P.Pipeline(self.ctx, self.J, self.engine(h)).dual_on(), '28/10/2026: גם Haiku — טיוטה אחת כברירת מחדל')
        self.assertFalse(P.Pipeline(self.ctx, self.J, self.engine(h, 'sonnet-medium')).dual_on())

    def test_second_draft_failure_is_harmless(self):
        # שתי הטיוטות שולחות בדיוק אותה בקשה ורצות במקביל — הכשל מוזרק לפי היעד (tr/alt), לא לפי סדר הקריאות
        def h(kw):
            p = kw['messages'][0]['content']
            if 'חלק 1/2' in p:
                return msg('#1 שלום.\n#2 תודה.')
            return msg('#3 נטפליקס.')
        pl = P.Pipeline(self.ctx, self.J, self.engine(h))
        orig = pl._tl_part

        def part(p, fixed, warm=None, out_dir=None):
            if out_dir is not None and p['file'].startswith('batch_002'):
                raise llm.LLMError('api_error', 'boom')
            return orig(p, fixed, warm, out_dir)
        pl._tl_part = part
        pl.translate(fix=False)
        self.assertEqual(pl.current()['3'], 'נטפליקס.', 'כשל בטיוטה השנייה — הראשונה נשארת, העבודה ממשיכה')
        self.assertFalse((self.pd / 'tr' / 'alt' / 'batch_002.he.txt').exists())

    def test_fix_guard_and_revert(self):
        td = self.pd / 'tr'
        td.joinpath('batch_001.he.txt').write_text('#1 ארוך ארוך\n#2 תודה\n', encoding='utf-8')
        td.joinpath('batch_002.he.txt').write_text('#3 בוא נדבר על נטפליקס במילולי\n', encoding='utf-8')

        def h(kw):
            p = kw['messages'][0]['content']
            self.assertIn('<to_fix>', p)
            # #1 חייב (ארוך) — התיקון תקין; #3 לשקול — התשובה "ארוך" יוצרת בעיה חמורה חדשה
            return msg('#1 שלום.\n#3 נטפליקס ארוך')
        pl = P.Pipeline(self.ctx, self.J, self.engine(h, 'sonnet-medium'))
        left = pl.fix_round('fixes.txt', 'X', 'tl', rounds=1)
        self.assertEqual(left, 0)
        cur = pl.current()
        self.assertEqual(cur['1'], 'שלום.')
        self.assertEqual(cur['3'], 'בוא נדבר על נטפליקס במילולי', 'תיקון שיצר בעיה חמורה — חזר לנוסח הקודם')
        self.assertEqual(pl.fix_rej, 1)

    def test_skip_num_gls(self):
        td = self.pd / 'tr'
        td.joinpath('batch_001.he.txt').write_text('#1 שלום\n#2 תודה\n#3 נטפליקס\n', encoding='utf-8')
        J = self.J
        orig = J.vt

        def vt(ctx, args):
            if args[0] == 'tr-check':
                (td / 'check.md').write_text('- #1: [num] המספר 30 חסר\n- #2: [gls] המונח לפי המילון\n', encoding='utf-8')
                return ['תורגמו 3/3 · שגיאות 0']
            return orig(ctx, args)
        J.vt = vt
        pl = P.Pipeline(self.ctx, J, self.engine(lambda kw: self.fail('אין מה לשלוח לתיקון'), 'sonnet-medium'))
        self.assertEqual(pl.fix_round('fixes.txt', 'X', 'tl'), 0)
        self.assertEqual(self.client.calls, [])


if __name__ == '__main__':
    unittest.main()


class LiteralTranslationRules(unittest.TestCase):
    def test_tl_task_against_calques(self):
        # 26/10/2026: ארבע השורות נגד תרגום מילולי (נבדקו בשיפוט עיוור) — בהנחיה של התרגום
        for frag in ('קוראים את העברית לבד', '"you want to…" כעצה = "כדאי"', 'לא "עכשיו"', 'לפי המובן בהקשר'):
            self.assertIn(frag, P.TL_TASK)

