"""01/11/2026 (סבב 3, I3): "חצי מחיר" — תור החיסכון (Message Batches). לקוח מדומה בלבד, בלי רשת ובלי מפתחות.
המנוע רושם בקשה וחונה (BatchWait), האוסף שולח ומחזיר תשובות, החידוש קורא אותה בקשה בדיוק — בחצי מחיר ופעם אחת."""

from __future__ import annotations

import json
import os
import sys
import tempfile
import threading
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402

from tests.test_llm import FakeClient, fake_msg  # noqa: E402


def msg_dict(text='תשובה', i=1000, o=500):
    return {'id': 'msg_1', 'type': 'message', 'stop_reason': 'end_turn', 'content': [{'type': 'text', 'text': text}],
            'usage': {'input_tokens': i, 'output_tokens': o, 'cache_read_input_tokens': 0, 'cache_creation_input_tokens': 0}}


def engine(tmp, client=None):
    e = llm.Engine(llm.Spec.of('sonnet-medium'), cap_usd=10, client=client or FakeClient([]))
    e.batch = Path(tmp) / 'job1'
    return e


class EngineBatchTests(unittest.TestCase):
    def test_registers_and_waits(self):
        with tempfile.TemporaryDirectory() as tmp:
            e = engine(tmp)
            warm = threading.Event()
            with self.assertRaises(llm.BatchWait):
                e.complete('tl', 'קבוע', 'תרגם', on_first_token=warm.set)
            req = list((e.batch / 'req').glob('*.json'))
            self.assertEqual(len(req), 1)
            p = json.loads(req[0].read_text(encoding='utf-8'))['p']
            self.assertNotIn('extra_body', p)            # diagnostics משתנה בין קריאות — לא בטביעה
            self.assertEqual(p['model'], 'claude-sonnet-5-5')
            self.assertTrue(warm.is_set())               # המקבול לא נתקע על טוקן ראשון
            self.assertEqual(e.ledger.total(), 0)         # עוד לא שולם כלום

    def test_batchwait_not_swallowed_by_except_exception(self):
        self.assertFalse(issubclass(llm.BatchWait, Exception))

    def test_answer_half_price_once(self):
        with tempfile.TemporaryDirectory() as tmp:
            e = engine(tmp)
            with self.assertRaises(llm.BatchWait) as cm:
                e.complete('tl', 'קבוע', 'תרגם')
            h = str(cm.exception)
            llm._write_json(e.batch / 'ans' / (h + '.json'), {'m': msg_dict()})
            r = e.complete('tl', 'קבוע', 'תרגם')
            self.assertEqual(r.text, 'תשובה')
            self.assertTrue(r.bt)
            full = llm.cost_anthropic('claude-sonnet-5-5', 1000, 500, 0, 0)
            self.assertAlmostEqual(r.usd, full * llm.BATCH_DISCOUNT, places=6)
            # חידוש מנקודת שמירה (מנוע חדש, אותה תיקייה) — אותה תשובה, בלי לחייב שוב
            e2 = engine(tmp)
            r2 = e2.complete('tl', 'קבוע', 'תרגם')
            self.assertEqual(r2.text, 'תשובה')
            self.assertEqual(r2.usd, 0.0)
            self.assertEqual(e2.ledger.total(), 0.0)

    def test_failed_in_queue_goes_live(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = FakeClient([fake_msg('בזמן אמת')])
            e = engine(tmp, c)
            with self.assertRaises(llm.BatchWait) as cm:
                e.complete('rv', 'קבוע', 'בדוק')
            llm._write_json(e.batch / 'ans' / (str(cm.exception) + '.json'), {'x': 'expired'})
            r = e.complete('rv', 'קבוע', 'בדוק')
            self.assertEqual(r.text, 'בזמן אמת')
            self.assertFalse(r.bt)
            self.assertEqual(len(c.calls), 1)

    def test_other_keys_live(self):
        with tempfile.TemporaryDirectory() as tmp:
            c = FakeClient([fake_msg('שבירה')])
            e = engine(tmp, c)
            self.assertEqual(e.complete('lb', 'קבוע', 'שבור').text, 'שבירה')   # שבירת השורות — לא דרך התור
            self.assertFalse((e.batch / 'req').exists())

    def test_park_and_ready(self):
        with tempfile.TemporaryDirectory() as tmp:
            jd = Path(tmp) / 'j'
            llm.batch_put(jd, 'a' * 40, {'model': 'x'})
            self.assertEqual(llm.batch_park(jd), 1)
            self.assertFalse(llm.batch_ready(jd))
            (jd / 'req' / ('a' * 40 + '.json')).unlink()
            self.assertTrue(llm.batch_ready(jd))
            self.assertEqual(llm.batch_park(jd), 2)


class FakeBatches:
    def __init__(self):
        self.made, self.status, self.res = [], {}, {}
        self.messages = self
        self.batches = self

    def create(self, requests):
        bid = 'msgbatch_' + str(len(self.made))
        self.made.append((bid, requests))
        self.status[bid] = 'in_progress'
        return NS(id=bid)

    def retrieve(self, bid):
        return NS(processing_status=self.status[bid])

    def results(self, bid):
        return self.res.get(bid, [])


class CollectorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        os.environ['SNB_BATCH_DIR'] = self.tmp.name
        import agent
        self.A = agent
        agent.BT_DIR = Path(self.tmp.name)
        agent._bt_last['poll'] = 0.0

    def tearDown(self):
        os.environ.pop('SNB_BATCH_DIR', None)
        self.tmp.cleanup()

    def test_gather_send_collect_ready(self):
        A, d = self.A, Path(self.tmp.name)
        llm.batch_put(d / 'jobA', 'a' * 40, {'model': 'm', 'n': 1})
        llm.batch_put(d / 'jobB', 'b' * 40, {'model': 'm', 'n': 2})   # קובץ שני ברשימה — אותו batch
        llm.batch_park(d / 'jobA')
        llm.batch_park(d / 'jobB')
        c = FakeBatches()
        t0 = max(json.loads(f.read_text())['t'] for f in d.glob('*/req/*.json'))
        self.assertEqual(A.bt_tick(c, t0 + 10)['sent'], [])           # עוד מחכים לשאר הרשימה
        out = A.bt_tick(c, t0 + A.BT_GATHER_S + 1)
        self.assertEqual(len(out['sent']), 1)
        self.assertEqual(len(c.made[0][1]), 2)
        self.assertEqual(A.bt_tick(c, t0 + A.BT_GATHER_S + 2)['sent'], [])   # לא שולחים שוב מה שבדרך
        self.assertEqual(A.BT_READY, [])
        bid = c.made[0][0]
        c.status[bid] = 'ended'
        cid_a, cid_b = A.bt_cid('jobA', 'a' * 40), A.bt_cid('jobB', 'b' * 40)
        c.res[bid] = [NS(custom_id=cid_a, result=NS(type='succeeded', message=msg_dict('א'))),
                      NS(custom_id=cid_b, result=NS(type='expired', message=None))]
        A._bt_last['poll'] = 0.0
        A.bt_tick(c, t0 + 10_000)
        self.assertEqual(json.loads((d / 'jobA' / 'ans' / ('a' * 40 + '.json')).read_text())['m']['content'][0]['text'], 'א')
        self.assertEqual(json.loads((d / 'jobB' / 'ans' / ('b' * 40 + '.json')).read_text()), {'x': 'expired'})
        self.assertEqual(sorted(A.BT_READY), ['jobA', 'jobB'])
        self.assertFalse(list((d / '_sent').glob('*.json')))

    def test_custom_id_valid(self):
        cid = self.A.bt_cid('AbC_123-xyz' * 4, 'f' * 40)
        self.assertTrue(llm.BATCH_ID_RE.match(cid))
        self.assertLessEqual(len(cid), 64)

    def test_cleanup_old_dirs(self):
        A, d = self.A, Path(self.tmp.name)
        old = d / 'old'
        (old / 'ans').mkdir(parents=True)
        os.utime(old, (1, 1))
        A.bt_tick(FakeBatches(), 10 * 86400)
        self.assertFalse(old.exists())


if __name__ == '__main__':
    unittest.main()
