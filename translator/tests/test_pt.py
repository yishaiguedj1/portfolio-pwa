"""25/10/2026: תרגום בטלפון, שלב 3 — השרת שלנו עונה לקריאות ל־Claude של עבודה שהטלפון מריץ (agent.pt_loop → llm.pt_answer).
לקוח Claude מדומה ושרתון מדומה — בלי רשת ובלי מפתחות."""
import hashlib
import sys
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import llm  # noqa: E402
import agent  # noqa: E402
from test_llm import FakeClient, fake_msg  # noqa: E402


def req(**k):
    d = {'job': 'j' + 'A' * 20, 'rid': 'r' * 20, 'k': 'tl', 'm': 'claude-haiku-5-5', 'e': 'high', 'mt': 64000,
         'fh': hashlib.sha1('קבוע'.encode()).hexdigest(), 'ex': '', 'pr': 'בקשה', 'md': 'haiku-high'}
    d.update(k)
    return d


class Answer(unittest.TestCase):
    def test_answers_with_cost(self):
        c = FakeClient([fake_msg('תרגום', i=1000, o=500, cr=20000)])
        a = llm.pt_answer(req(), 'קבוע', client=c)
        self.assertEqual(a['t'], 'תרגום')
        self.assertEqual(a['u']['i'], 1000)
        self.assertAlmostEqual(a['usd'], llm.cost_anthropic('claude-haiku-5-5', 1000, 500, 20000, 0, 0), 9)
        self.assertEqual(c.calls[0]['model'], 'claude-haiku-5-5')

    def test_only_models_of_the_job(self):
        """הבקשה מהטלפון לא מהימנה: מודל יקר יותר מהמצב של העבודה — נדחה בלי קריאה ל־Claude"""
        c = FakeClient([])
        self.assertEqual(llm.pt_answer(req(m='claude-opus-5-5'), 'קבוע', client=c), {'err': 'relay_bad'})
        self.assertEqual(llm.pt_answer(req(e='turbo'), 'קבוע', client=c), {'err': 'relay_bad'})
        self.assertEqual(llm.pt_answer(req(md='no-such-mode'), 'קבוע', client=c), {'err': 'relay_bad'})
        self.assertEqual(llm.pt_answer(req(), None, client=c), {'err': 'relay_bad'})
        self.assertEqual(c.calls, [])

    def test_judge_and_pir_allowed(self):
        c = FakeClient([fake_msg('9'), fake_msg('דוח')])
        self.assertEqual(llm.pt_answer(req(m=llm.JUDGE[1], k='jg'), 'קבוע', client=c)['t'], '9')
        self.assertEqual(llm.pt_answer(req(m='claude-sonnet-5-5', k='sub', e='medium'), 'קבוע', client=c)['t'], 'דוח')

    def test_max_tokens_clamped(self):
        c = FakeClient([fake_msg('x')])
        llm.pt_answer(req(mt=10 ** 9), 'קבוע', client=c)
        self.assertLessEqual(c.calls[0]['max_tokens'], llm.MAX_OUT)


class Loop(unittest.TestCase):
    def test_loop_pulls_answers_and_marks(self):
        fx = 'קבוע'
        fh = hashlib.sha1(fx.encode()).hexdigest()
        calls, marks = [], []
        state = {'n': 0}

        def post(base, body, t):
            calls.append((base, body['op']))
            if body['op'] == 'ptNext':
                state['n'] += 1
                if base == 'https://ibkr-proxy-wine.vercel.app':
                    return 503, {'ok': False, 'error': 'no_hub', 'hub': 'https://api.thesnowball.app'}, {}
                if state['n'] == 2:
                    return 200, {'ok': True, 'reqs': [req(fh=fh), req(fh='0' * 40, rid='s' * 20)], 'fx': {fh: fx, '0' * 40: 'זיוף'}}, {}
                agent._stop = True
                return 200, {'ok': True, 'reqs': [], 'fx': {}}, {}
            marks.append(body)
            return 200, {'ok': True}, {}

        def answer(r, f, started):
            started()
            return {'t': 'ok:' + f, 'u': {'i': 1, 'o': 2}, 'st': 'end_turn', 'th': 0, 'usd': 0.5}
        agent._stop = False
        try:
            th = threading.Thread(target=agent.pt_loop, args=('https://ibkr-proxy-wine.vercel.app', 'tok'), kwargs={'answer': answer, 'post': post})
            th.start()
            th.join(10)
            for _ in range(50):
                if any(m['st'] == 'd' for m in marks):
                    break
                time.sleep(0.05)
        finally:
            agent._stop = False
        self.assertEqual(calls[0], ('https://ibkr-proxy-wine.vercel.app', 'ptNext'))
        self.assertTrue(all(b == 'https://api.thesnowball.app' for b, _ in calls[1:]), 'עבר לכתובת של התור')
        done = [m for m in marks if m['st'] == 'd']
        self.assertEqual(len(done), 1, 'בלוק קבוע שלא תואם לטביעה — הבקשה לא נענית')
        self.assertEqual(done[0]['ans']['t'], 'ok:' + fx)
        self.assertEqual(done[0]['usd'], 0.5)
        self.assertNotIn('usd', done[0]['ans'])
        self.assertTrue(any(m['st'] == 's' for m in marks))

    def test_hub_must_be_known(self):
        """כתובת תור שלא ברשימה הסגורה — לא עוברים אליה (הטוקן של השרת לא נשלח לכתובת זרה)"""
        calls = []

        def post(base, body, t):
            calls.append(base)
            if len(calls) > 2:
                agent._stop = True
            return 503, {'ok': False, 'error': 'no_hub', 'hub': 'https://evil.example.com'}, {}
        agent._stop = False
        orig = agent.time.sleep
        agent.time.sleep = lambda s: None
        try:
            agent.pt_loop('https://ibkr-proxy-wine.vercel.app', 'tok', answer=lambda *a: {}, post=post)
        finally:
            agent.time.sleep = orig
            agent._stop = False
        self.assertNotIn('https://evil.example.com', calls)


if __name__ == '__main__':
    unittest.main()
