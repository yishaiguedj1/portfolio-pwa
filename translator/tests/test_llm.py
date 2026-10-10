"""בדיקות למנוע השפה (llm.py) — לקוח Claude מדומה בלבד, בלי רשת ובלי מפתחות אמיתיים."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402


def fake_msg(text='שלום', stop='end_turn', i=100, o=50, cr=0, c5=0, c1=0, mid=None, think='', diag=None):
    cc = NS(ephemeral_1h_input_tokens=c1, ephemeral_5m_input_tokens=c5) if (c5 or c1) else None
    u = NS(input_tokens=i, output_tokens=o, cache_read_input_tokens=cr, cache_creation_input_tokens=c5 + c1, cache_creation=cc)
    return NS(content=[NS(type='thinking', thinking=think), NS(type='text', text=text)], stop_reason=stop, usage=u,
              id=mid, diagnostics=diag)


class FakeClient:
    """מחקה client.messages.stream(**kw) של ספריית anthropic — רושם את הבקשות ומחזיר תשובות לפי התור."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []
        self.messages = self

    def stream(self, **kw):
        self.calls.append(kw)
        r = self.replies.pop(0)
        outer = self

        class S:
            def __enter__(self):
                if isinstance(r, Exception):
                    raise r
                return self

            def __exit__(self, *a):
                return False

            def get_final_message(self):
                return r
        _ = outer
        return S()


class AnthropicTests(unittest.TestCase):
    def test_request_shape_cache_effort(self):
        c = FakeClient([fake_msg('תרגום', i=200, o=80, cr=9000, c5=0)])
        e = llm.Engine(llm.Spec.of('opus-medium'), client=c)
        r = e.complete('tl', 'מדריך+מקור', 'חלק 1', system_extra='רק שורות #')
        self.assertEqual(r.text, 'תרגום')
        kw = c.calls[0]
        self.assertEqual(kw['model'], 'claude-opus-5-5')
        self.assertEqual(kw['output_config'], {'effort': 'medium'})
        self.assertEqual(kw['thinking'], {'type': 'adaptive'})
        self.assertEqual(kw['system'][0]['cache_control'], {'type': 'ephemeral', 'ttl': '1h'},
                         'הבלוק הקבוע במטמון של שעה — עבודה נמשכת יותר מחלון ה־5 דקות')
        self.assertNotIn('cache_control', kw['system'][1], 'ההוראה המשתנה אחרי נקודת המטמון')
        self.assertNotIn('fallbacks', kw, 'מודל אחד לכל עבודה — בלי מעבר למודל אחר')
        self.assertEqual(kw['extra_body'], {'diagnostics': {'previous_message_id': None}},
                         'cache diagnostics בכל בקשה (GA, חינם)')
        self.assertAlmostEqual(r.usd, (200 * 4 + 80 * 20 + 9000 * 0.20) / 1e6)

    def test_effort_pinned_even_without_spec(self):
        c = FakeClient([fake_msg()])
        e = llm.Engine(llm.Spec('anthropic', 'claude-opus-5-5', None), client=c)
        e.complete('tl', 'X', 'Y')
        self.assertEqual(c.calls[0]['output_config'], {'effort': 'medium'},
                         'effort מקובע מפורשות תמיד — לא סומכים על ברירת המחדל של המודל')

    def test_diagnostics_chain_and_thinking(self):
        c = FakeClient([fake_msg(mid='msg_1', think='חשיבה ארוכה'), fake_msg(mid='msg_2', cr=500)])
        e = llm.Engine(llm.Spec.of('opus-medium'), client=c)
        e.complete('tl', 'X', '1')
        e.complete('tl', 'X', '2')
        self.assertIsNone(c.calls[0]['extra_body']['diagnostics']['previous_message_id'])
        self.assertEqual(c.calls[1]['extra_body']['diagnostics']['previous_message_id'], 'msg_1',
                         'ה־id של התשובה הקודמת נשלח בבקשה הבאה — בלעדיו טביעת האצבע לא נשמרת')
        self.assertEqual(e.think['tl'], len('חשיבה ארוכה'), 'תווי החשיבה נרשמים לפי שלב')

    def test_cache_warning_on_second_call_without_reads(self):
        diag = {'cache_miss_reason': {'type': 'system_changed'}}
        c = FakeClient([fake_msg(), fake_msg(cr=0, diag=diag), fake_msg(cr=700)])
        e = llm.Engine(llm.Spec.of('opus-medium'), client=c)
        e.complete('tl', 'X', '1')
        e.complete('tl', 'X', '2')                       # קריאה שנייה עם אותו בלוק קבוע ובלי קריאת מטמון — אזהרה
        self.assertEqual(e.cache_warns, 1)
        e.complete('tl', 'X', '3')                       # קריאת מטמון תקינה — בלי אזהרה נוספת
        self.assertEqual(e.cache_warns, 1)

    def test_on_first_token_fires_once(self):
        c = FakeClient([fake_msg()])
        e = llm.Engine(llm.Spec.of('opus-medium'), client=c)
        hits = []
        e.complete('tl', 'X', 'Y', on_first_token=lambda: hits.append(1))
        self.assertEqual(hits, [1], 'הקולבק נקרא פעם אחת גם כשללקוח המדומה אין זרם')

    def test_ledger_by_stage_and_one_model(self):
        c = FakeClient([fake_msg(i=1000, o=100, c5=20000), fake_msg(i=50, o=900, cr=20000), fake_msg(i=10, o=10)])
        e = llm.Engine(llm.Spec.of('sonnet-medium'), client=c)
        e.complete('main', 'X', 'הגהה')
        e.complete('tl', 'X', 'חלק 1')
        e.complete('tl', 'X', 'חלק 2')
        rows = {r['k']: r for r in e.ledger.list()}
        self.assertEqual(set(rows), {'main', 'tl'})
        self.assertEqual({r['m'] for r in rows.values()}, {'claude-sonnet-5-5'}, 'כל השלבים באותו מודל')
        self.assertEqual((rows['tl']['n'], rows['tl']['cr'], rows['tl']['o']), (2, 20000, 910))
        self.assertAlmostEqual(rows['main']['usd'], (1000 * 2 + 100 * 10 + 20000 * 2 * 1.25) / 1e6)
        self.assertAlmostEqual(rows['tl']['usd'], (60 * 2 + 910 * 10 + 20000 * 0.10) / 1e6, places=6,
                               msg='Sonnet 5.5: קריאה מהמטמון $0.10')
        self.assertAlmostEqual(e.ledger.total(), rows['main']['usd'] + rows['tl']['usd'], places=6)

    def test_refusal_and_truncation_are_recorded_then_raise(self):
        for stop, code in (('refusal', 'model_refusal'), ('max_tokens', 'max_tokens')):
            c = FakeClient([fake_msg(stop=stop, i=10, o=500)] * (2 if stop == 'refusal' else 1))   # סירוב — ניסיון אחד נוסף
            e = llm.Engine(llm.Spec.of('sonnet-high'), client=c)
            with self.assertRaises(llm.LLMError) as cm:
                e.complete('tl', 'X', 'Y')
            self.assertEqual(cm.exception.code, code)
            self.assertEqual(e.ledger.list()[0]['o'], 500 * (2 if stop == 'refusal' else 1), 'כל קריאה עלתה כסף — נרשמת לפני השגיאה')

    def test_modes_haiku_and_removed(self):
        # 10/10/2026: Haiku 5.5 (medium/high), Sonnet Medium = ברירת המחדל, Opus High/Max הוסרו → Opus Medium
        self.assertEqual(sorted(llm.MODES), ['haiku-high', 'haiku-medium', 'opus-medium', 'sonnet-high', 'sonnet-medium'])
        self.assertEqual(llm.DEFAULT_MODE, 'sonnet-medium')
        self.assertEqual((llm.Spec.of('haiku-high').model, llm.Spec.of('haiku-high').effort), ('claude-haiku-5-5', 'high'))
        for old in ('opus-high', 'opus-max'):
            self.assertEqual((llm.Spec.of(old).model, llm.Spec.of(old).effort), ('claude-opus-5-5', 'medium'))
        with self.assertRaises(llm.LLMError):
            llm.Spec.of('gpt')

    def test_haiku_card_judge_tokens(self):
        # 10/10/2026: ההתאמות ל־Haiku 5.5 — כרטיס המחיר מעל 100K, שופט ממשפחה אחרת, אומדן שמרני
        self.assertEqual(llm.judge_spec('claude-haiku-5-5').model, 'claude-sonnet-5-5', 'מתרגם Haiku → שופט Sonnet')
        for m in ('claude-sonnet-5-5', 'claude-opus-5-5'):
            self.assertEqual(llm.judge_spec(m).model, 'claude-haiku-5-5')
        self.assertGreater(llm.est_tokens('שלום עולם ' * 50), llm.est_tokens('hello world ' * 50), 'עברית יקרה יותר בטוקנים')
        h, s = llm.Engine(llm.Spec.of('haiku-medium'), client=FakeClient([])), llm.Engine(llm.Spec.of('sonnet-medium'), client=FakeClient([]))
        big = 'word ' * 120000                                            # ‎~200K טוקנים לפי האומדן
        self.assertEqual((h.card_limit, s.card_limit), (100000, None))
        self.assertFalse(h.fits_card(big, 'x'), 'Haiku: מעל הסף — לא נשאר בכרטיס הזול')
        self.assertTrue(s.fits_card(big, 'x'), 'Sonnet/Opus: מחיר אחד בכל אורך')
        self.assertTrue(h.fits_card('word ' * 1000, 'x'))

        class Counting(FakeClient):
            def count_tokens(self, **kw):
                self.counted = kw
                return NS(input_tokens=42000)
        c = Counting([])
        e = llm.Engine(llm.Spec.of('haiku-high'), client=c)
        self.assertEqual(e.prompt_tokens('word ' * 40000, 'x'), 42000, 'באזור הסף — count_tokens המדויק (חינם)')
        self.assertEqual(c.counted['model'], 'claude-haiku-5-5')

    def test_refusal_retry_reframed_once(self):
        c = FakeClient([fake_msg('', stop='refusal', o=5), fake_msg('#1 תרגום')])
        e = llm.Engine(llm.Spec.of('haiku-medium'), client=c)
        r = e.complete('tl', 'קבוע', 'חלק 1')
        self.assertEqual((r.text, e.refusal_retries, e.ledger.list()[0]['n']), ('#1 תרגום', 1, 2), 'הסירוב עלה כסף — נרשם')
        self.assertEqual(c.calls[1]['model'], 'claude-haiku-5-5', 'אותו מודל — בלי מעבר למודל אחר')
        self.assertEqual(c.calls[1]['system'][0]['text'], 'קבוע', 'הבלוק הקבוע לא השתנה — המטמון נשמר')
        self.assertIn('תרגום כתוביות', c.calls[1]['system'][1]['text'], 'המסגור אחרי נקודת המטמון')
        c2 = FakeClient([fake_msg('', stop='refusal'), fake_msg('', stop='refusal')])
        with self.assertRaises(llm.LLMError) as cm:
            llm.Engine(llm.Spec.of('haiku-medium'), client=c2).complete('tl', 'X', 'Y')
        self.assertEqual(cm.exception.code, 'model_refusal', 'סירוב שני = כשל גלוי')

    def test_thinking_tokens_from_usage(self):
        m = fake_msg('ok', think='')                                       # טקסט החשיבה מושמט כברירת מחדל ב־5.5
        m.usage.output_tokens_details = NS(thinking_tokens=321)
        e = llm.Engine(llm.Spec.of('sonnet-medium'), client=FakeClient([m]))
        e.complete('tl', 'X', 'Y')
        self.assertEqual(e.think['tl'], 321, 'החשיבה נמדדת בטוקנים מה־usage, לא מתווים שמושמטים')

    def test_budget_cap(self):
        c = FakeClient([fake_msg(i=0, o=100000)] * 3)     # $2 לכל קריאה ב־Opus
        e = llm.Engine(llm.Spec.of('opus-medium'), cap_usd=3.0, client=c)
        e.complete('tl', 'X', '1')
        e.complete('tl', 'X', '2')                       # $4 — עברנו את התקרה אחרי הקריאה הזו
        with self.assertRaises(llm.LLMError) as cm:
            e.complete('tl', 'X', '3')
        self.assertEqual(cm.exception.code, 'budget_cap')
        self.assertEqual(len(c.calls), 2, 'לא נשלחה קריאה שלישית')

    def test_sdk_errors_mapped_to_short_codes(self):
        class RateLimitError(Exception):
            pass
        c = FakeClient([RateLimitError('429 secret-ish details')])
        e = llm.Engine(llm.Spec.of('opus-medium'), client=c)
        with self.assertRaises(llm.LLMError) as cm:
            e.complete('tl', 'X', 'Y')
        self.assertEqual(cm.exception.code, 'api_rate')

    def test_haiku_long_prompt_tier(self):
        self.assertAlmostEqual(llm.cost_anthropic('claude-haiku-5-5', 1000, 1000, 0, 0), (1000 * 0.10 + 1000 * 0.50) / 1e6)
        self.assertAlmostEqual(llm.cost_anthropic('claude-haiku-5-5', 120000, 1000, 0, 0), (120000 * 0.50 + 1000 * 2.50) / 1e6)
        self.assertIsNone(llm.cost_anthropic('claude-unknown', 1, 1, 0, 0))

    def test_unknown_mode(self):
        with self.assertRaises(llm.LLMError):
            llm.Spec.of('gpt-9')

    def test_prices_match_job(self):
        import job
        for m, p in llm.ANTHROPIC_PRICES.items():
            self.assertEqual(job.PRICES[m], p, f'המחירון ב־llm.py וב־job.py זהה ({m})')


if __name__ == '__main__':
    unittest.main()
