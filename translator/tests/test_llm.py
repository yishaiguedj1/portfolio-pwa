"""בדיקות למנוע השפה (llm.py) — לקוח Claude מדומה בלבד, בלי רשת ובלי מפתחות אמיתיים."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402


def fake_msg(text='שלום', stop='end_turn', i=100, o=50, cr=0, c5=0, c1=0):
    cc = NS(ephemeral_1h_input_tokens=c1, ephemeral_5m_input_tokens=c5) if (c5 or c1) else None
    u = NS(input_tokens=i, output_tokens=o, cache_read_input_tokens=cr, cache_creation_input_tokens=c5 + c1, cache_creation=cc)
    return NS(content=[NS(type='thinking', thinking=''), NS(type='text', text=text)], stop_reason=stop, usage=u)


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
        self.assertEqual(kw['system'][0]['cache_control'], {'type': 'ephemeral'}, 'הבלוק הקבוע במטמון')
        self.assertNotIn('cache_control', kw['system'][1], 'ההוראה המשתנה אחרי נקודת המטמון')
        self.assertNotIn('fallbacks', kw, 'מודל אחד לכל עבודה — בלי מעבר למודל אחר')
        self.assertAlmostEqual(r.usd, (200 * 4 + 80 * 20 + 9000 * 0.20) / 1e6)

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
            c = FakeClient([fake_msg(stop=stop, i=10, o=500)])
            e = llm.Engine(llm.Spec.of('opus-high'), client=c)
            with self.assertRaises(llm.LLMError) as cm:
                e.complete('tl', 'X', 'Y')
            self.assertEqual(cm.exception.code, code)
            self.assertEqual(e.ledger.list()[0]['o'], 500, 'הקריאה עלתה כסף — נרשמת לפני השגיאה')

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
