"""האיסוף המלא בתקופת הפיתוח (15/10/2026, הדגל learn_full) — בצד העובד, בלי רשת אמיתית:
יומן הקריאות ב־llm.py (כולל ניסיון חוזר וכשל), זנב הלוג וה־traceback של הסוכן, מצב התהליכים, השליחה רק במצב המלא,
faulthandler ב־job.py, וקבצי הטקסט של הפרויקט לקורפוס.

הרצה: python3 -m unittest tests.test_devlog   (מתוך translator/)
"""
from __future__ import annotations

import json
import os
import signal
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / 'tests'))
import llm  # noqa: E402
from test_llm import FakeClient, fake_msg  # noqa: E402


class CallLog(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.path = os.path.join(self.d, 'calls.jsonl')

    def rows(self):
        with open(self.path, encoding='utf-8') as f:
            return [json.loads(x) for x in f]

    def test_success_retry_and_failure_logged(self):
        class OverloadedError(Exception):
            status_code = 529
        m = fake_msg('ok', mid='msg_1', i=10, o=5)
        m._request_id = 'req_0123456789'
        with mock.patch.dict(os.environ, {'SNB_CALLLOG': self.path}), mock.patch.object(llm, 'MID_RETRY_WAIT', (0, 0)):
            llm.Engine(llm.Spec.of('sonnet-medium'), client=FakeClient([OverloadedError('o'), m])).complete('tl', 'X', 'Y')
            with self.assertRaises(llm.LLMError):
                llm.Engine(llm.Spec.of('sonnet-medium'), client=FakeClient([ValueError('bad sk-ant-zzz')])).complete('rv', 'X', 'Y')
        r = self.rows()
        self.assertEqual([x.get('err') or x.get('sr') for x in r], ['api_overloaded', 'end_turn', 'api_error'])
        self.assertEqual((r[0]['a'], r[1]['a'], r[1]['k'], r[2]['k']), (0, 1, 'tl', 'rv'), 'מספר הניסיון והשלב')
        self.assertEqual((r[1]['rid'], r[1]['mid'], r[1]['i'], r[1]['o']), ('req_0123456789', 'msg_1', 10, 5))
        self.assertTrue(r[1]['usd'] > 0 and r[1]['ms'] >= 0 and r[1]['mt'] == 32000 and r[1]['m'] == 'claude-sonnet-5-5')

    def test_off_without_env(self):
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('SNB_CALLLOG', None)
            llm.Engine(llm.Spec.of('sonnet-medium'), client=FakeClient([fake_msg()])).complete('tl', 'X', 'Y')
        self.assertFalse(os.path.exists(self.path), 'בלי SNB_CALLLOG — שום קובץ')


class Agent(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        os.environ['VT_WORK'] = os.path.join(self.d, 'work')
        os.environ['SNB_STATE'] = os.path.join(self.d, 'state')
        for m in ('agent', 'job'):
            sys.modules.pop(m, None)
        import agent  # noqa: E402
        self.A = agent
        self.J = agent.J

    def test_traceback_and_tail(self):
        A = self.A
        with A._tail_lock:
            A._tail.clear()
            A._tail.extend(['line %d' % i for i in range(10)] + ['Traceback (most recent call last):', '  File "job.py", line 1', 'ValueError: x'])
        t = A.tail_text()
        self.assertTrue(t.endswith('ValueError: x'))
        self.assertTrue(A.last_traceback(t).startswith('Traceback') and 'ValueError' in A.last_traceback(t))
        self.assertEqual(A.last_traceback('ok'), '')

    def test_run_child_captures_output(self):
        A = self.A
        with A._tail_lock:
            A._tail.clear()
        fake = Path(self.d) / 'job.py'
        fake.write_text('import sys\nprint("hello")\nraise ValueError("boom")\n')
        with mock.patch.object(A, 'HERE', Path(self.d)):
            rc = A.run_child([], 30)
        self.assertEqual(rc, 1)
        t = A.tail_text()
        self.assertIn('hello', t)
        self.assertIn('ValueError: boom', A.last_traceback(t))

    def test_proc_snapshot_own_group(self):
        p = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(5)'], start_new_session=True)
        try:
            time.sleep(0.3)
            ps = self.A.proc_snapshot(p.pid)
            self.assertTrue(ps and ps[0]['pid'] == p.pid and ps[0]['s'] in 'SRD' and 'cl' in ps[0])
        finally:
            p.kill()
            p.wait()

    def test_job_log_only_in_full_mode(self):
        A, J = self.A, self.J
        sent = []
        J.save_state({'job': 'j' + 'A' * 20, 'key': 'K' * 43, 'server': 'http://localhost:1', 'full': False})
        with mock.patch.object(A, 'dev_send', lambda s, t, op, d: sent.append((op, d)) or {'saved': True}):
            self.assertFalse(A.dev_job_log('http://localhost:1', 'tok', 'j' + 'A' * 20, 1))
            J.save_state({'job': 'j' + 'A' * 20, 'key': 'K' * 43, 'server': 'http://localhost:1', 'full': True})
            A.DEV_DIR.mkdir(parents=True, exist_ok=True)
            (A.DEV_DIR / 'calls.jsonl').write_text('{"t": 1760000000, "k": "tl"}\nnot json\n')
            (A.DEV_DIR / 'stack.txt').write_text('Thread 0x1 (most recent call first):\n  File "x.py"')
            self.assertTrue(A.dev_job_log('http://localhost:1', 'tok', 'j' + 'A' * 20, 1))
            self.assertFalse(A.dev_job_log('http://localhost:1', 'tok', 'j' + 'B' * 20, 1), 'עבודה אחרת — לא')
        op, d = sent[0]
        self.assertEqual(op, 'devLog')
        self.assertEqual((d['rc'], d['t'], len(d['calls'])), (1, 'end', 1))
        self.assertIn('most recent call first', d['stack'])

    def test_metrics_sample(self):
        A = self.A
        A.cpu_pct()
        s = A.met_sample()
        self.assertIn('t', s)
        self.assertTrue(all(k in ('t', 'cpu', 'mem', 'disk', 'free', 'load', 'j', 'st', 'p', 'rss', 'mx', 'av', 'psi', 'sl', 'top', 'ma', 'mf', 'msh') for k in s))
        self.assertTrue(s.get('mx', 0) > 0, '21/10/2026: התקרה בכל דגימה (בלי זה "100%" לא אומר כמה GB)')

    def test_metrics_per_slot_rss(self):
        """21/10/2026: במשבצות rss היה תמיד 0 — עכשיו לכל משבצת עם השלב שלה"""
        A = self.A
        p = subprocess.Popen([sys.executable, '-c', 'import time; b=bytearray(30*1024*1024); time.sleep(5)'])
        try:
            time.sleep(0.5)
            sl = A.Slot(1, {'id': 'j' + 'S' * 20, 'kind': 'tr', 'dur': 60})
            sl.p = p
            sl.state.mkdir(parents=True, exist_ok=True)
            (sl.state / 'prog.json').write_text(json.dumps({'st': 'al', 'p': 0.4}))
            A._slots[1] = sl
            try:
                s = A.met_sample()
            finally:
                A._slots.clear()
            self.assertEqual([(x['j'], x['st'], x['p']) for x in s['sl']], [('j' + 'S' * 20, 'al', 0.4)])
            self.assertGreaterEqual(s['sl'][0]['rss'], 25, 'MB של עץ התהליכים של המשבצת')
        finally:
            p.kill()
            p.wait()

    def test_top_procs_no_cmdline(self):
        top = self.A.top_procs(3)
        self.assertTrue(top and all(set(x) == {'c', 'r'} for x in top), 'רק שם התהליך ו־MB')

    def test_flight_recorder_survives_crash(self):
        """21/10/2026 (שלוש נפילות ביישור בלי שורת יומן): הקופסה השחורה נכתבת בזמן העבודה ונשלחת בעלייה הבאה, ואז נמחקת"""
        A, J = self.A, self.J
        jid = 'j' + 'F' * 20
        J.save_state({'job': jid, 'key': 'K' * 43, 'server': 'http://localhost:1', 'full': True})
        with A._tail_lock:
            A._tail.clear()
            A._tail.extend(['✓ vt align: התחיל', 'עוד שורה'])
        self.assertTrue(A.flight_write(jid))
        self.assertTrue((A.FLIGHT_DIR / (jid + '.json')).exists())
        self.assertEqual(oct((A.FLIGHT_DIR / (jid + '.json')).stat().st_mode & 0o777), '0o600')
        sent = []
        with mock.patch.object(A, 'dev_send', lambda s, t, op, d: sent.append((op, d)) or {'saved': True}):
            self.assertEqual(A.flight_send('http://localhost:1', 'tok'), 1)
        self.assertEqual(sent[0][0], 'devLog')
        self.assertEqual((sent[0][1]['t'], sent[0][1]['rc']), ('lost', -9))
        self.assertIn('vt align', sent[0][1]['tail'])
        self.assertFalse(list(A.FLIGHT_DIR.glob('*')), 'נמחקה אחרי השליחה')

    def test_flight_only_in_full_mode_and_cleared(self):
        A, J = self.A, self.J
        jid = 'j' + 'G' * 20
        J.save_state({'job': jid, 'key': 'K' * 43, 'server': 'http://localhost:1', 'full': False})
        self.assertFalse(A.flight_write(jid), 'בלי ההסכמה למצב המלא — כלום על הדיסק')
        J.save_state({'job': jid, 'key': 'K' * 43, 'server': 'http://localhost:1', 'full': True})
        self.assertTrue(A.flight_write(jid))
        A.flight_clear(jid)
        self.assertFalse((A.FLIGHT_DIR / (jid + '.json')).exists(), 'עבודה שהסתיימה כרגיל — נמחקת')


class JobSide(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        os.environ['VT_WORK'] = os.path.join(self.d, 'work')
        os.environ['SNB_STATE'] = os.path.join(self.d, 'state')
        sys.modules.pop('job', None)
        import job  # noqa: E402
        self.J = job

    def test_project_texts(self):
        pd = Path(self.d) / 'p'
        for rel, txt in (('tr/brief.md', '# תדריך'), ('tr/batch_001.he.txt', '#1 שלום'), ('tr/fixes_review.txt', '#1 תיקון'),
                         ('judge/verdict.txt', '#1 4 ok'), ('cues.en.json', '[]'), ('source.mp4', 'x'), ('asr/words.json', '{}'), ('out/a.mp4', 'v')):
            (pd / rel).parent.mkdir(parents=True, exist_ok=True)
            (pd / rel).write_text(txt, encoding='utf-8')
        tx = self.J.project_texts(pd)
        self.assertEqual(sorted(tx), ['judge/verdict.txt', 'tr/batch_001.he.txt', 'tr/brief.md', 'tr/fixes_review.txt'])
        self.assertEqual(tx['tr/brief.md'], '# תדריך')

    def test_dev_setup_faulthandler(self):
        J = self.J
        self.assertFalse(J.dev_setup({'full': False}))
        script = ('import os, sys, time, signal\nsys.path.insert(0, %r)\nimport job\nassert job.dev_setup({"full": True})\n'
                  'print(os.environ["SNB_CALLLOG"], flush=True)\nos.kill(os.getpid(), signal.SIGUSR1)\ntime.sleep(0.3)\n') % str(HERE)
        out = subprocess.run([sys.executable, '-c', script], capture_output=True, text=True, timeout=60,
                             env=dict(os.environ, VT_WORK=os.environ['VT_WORK'], SNB_STATE=os.environ['SNB_STATE']))
        self.assertEqual(out.returncode, 0, out.stderr)
        self.assertTrue(out.stdout.strip().endswith('calls.jsonl'))
        st = (Path(os.environ['VT_WORK']) / '_dev' / 'stack.txt').read_text()
        self.assertIn('most recent call first', st, 'SIGUSR1 → מצב החוטים בקובץ')

    def test_corpus_tx_only_full(self):
        J = self.J
        pd = Path(self.d) / 'q'
        (pd / 'tr').mkdir(parents=True)
        (pd / 'cues.en.json').write_text(json.dumps([{'id': 1, 'en': 'Hi', 'speech_s': 0, 'speech_e': 1}]))
        (pd / 'tr' / 'brief.md').write_text('# x')

        class C:
            pass
        ctx = C()
        ctx.pdir, ctx.st = pd, {'spec': {}}
        self.assertNotIn('tx', J.learn_corpus(ctx))
        ctx.st = {'spec': {}, 'full': True}
        self.assertEqual(J.learn_corpus(ctx)['tx'], {'tr/brief.md': '# x'})


if __name__ == '__main__':
    unittest.main()
