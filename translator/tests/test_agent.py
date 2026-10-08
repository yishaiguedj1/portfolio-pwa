"""הסוכן של השרת (agent.py) — מול שרתון מדומה בלבד: משיכה עם טוקן השרת, בלי פורט פתוח, ניקוי אחרי כל עבודה.

הרצה: python3 -m unittest tests.test_agent   (מתוך translator/)
"""
import json
import os
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
WTOK = 'w' * 40 + '_-1'
JOB = 'jAbCdEfGhIjKlMnOpQrS-'
KEY = 'K' * 40 + '_-9'


class Fake:
    def __init__(self):
        self.polls, self.reports, self.auth, self.next_job, self.fail = 0, [], [], None, 0
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _send(self, st, obj):
                b = json.dumps(obj).encode()
                self.send_response(st)
                self.send_header('Content-Length', str(len(b)))
                self.end_headers()
                self.wfile.write(b)

            def do_GET(self):
                if self.path.startswith('/drive/v3/about') and self.headers.get('Authorization') == 'Bearer ya29.T':
                    return self._send(200, {'user': {'emailAddress': 'x@example.com'}})
                return self._send(404, {})

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
                if body.get('op') == 'poll':
                    fake.polls += 1
                    fake.auth.append(self.headers.get('Authorization'))
                    if fake.fail:
                        fake.fail -= 1
                        return self._send(503, {'ok': False})
                    if self.headers.get('Authorization') != 'Bearer ' + WTOK:
                        return self._send(401, {'ok': False, 'error': 'auth'})
                    jb, fake.next_job = fake.next_job, None
                    return self._send(200, {'ok': True, 'job': jb})
                if body.get('job') != JOB or body.get('key') != KEY:
                    return self._send(403, {'ok': False, 'error': 'bad_key', 'stop': True})
                if body['op'] == 'claim':
                    return self._send(200, {'ok': True, 'job': {'kind': 'ping'}, 'drive': {'token': 'ya29.T'}})
                if body['op'] == 'report':
                    fake.reports.append(body)
                    return self._send(200, {'ok': True})
                return self._send(400, {'ok': False})

        self.srv = ThreadingHTTPServer(('127.0.0.1', 0), H)
        self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    @property
    def url(self):
        return 'http://127.0.0.1:%d' % self.port


class AgentTests(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.tmp = Path(tempfile.mkdtemp())
        self.env = dict(os.environ, SNB_SERVER=self.fake.url, SNB_WORKER_TOKEN=WTOK, SNB_DRIVE_API=self.fake.url + '/drive/v3',
                        VT_WORK=str(self.tmp / 'work'), SNB_STATE=str(self.tmp / 'state'), HOME=str(self.tmp / 'home'),
                        SNB_POLL_S='0.1')
        (self.tmp / 'home').mkdir()

    def tearDown(self):
        self.fake.srv.shutdown()
        self.fake.srv.server_close()

    def agent(self, *extra, env=None):
        return subprocess.run([sys.executable, str(HERE / 'agent.py'), '--once', *extra], env=env or self.env,
                              capture_output=True, text=True, timeout=60)

    def test_idle_poll_uses_server_token(self):
        r = self.agent()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(self.fake.polls, 1)
        self.assertEqual(self.fake.auth, ['Bearer ' + WTOK])
        self.assertNotIn(WTOK, r.stdout + r.stderr, 'הטוקן לא מודפס לעולם')

    def test_runs_job_and_cleans_everything(self):
        work = self.tmp / 'work'
        (work / 'old-project').mkdir(parents=True)
        (work / 'old-project' / 'video.mp4').write_bytes(b'x' * 1000)      # שארית מהפעלה שנקטעה
        self.fake.next_job = {'id': JOB, 'key': KEY, 'kind': 'ping'}
        r = self.agent()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertTrue(any(x.get('done') and x.get('checks') == {'drive': True} for x in self.fake.reports), 'העבודה רצה, Drive נגיש, ודווחה')
        self.assertEqual(list(work.iterdir()), [], 'אחרי העבודה לא נשאר כלום — גם לא .busy')
        self.assertFalse((self.tmp / 'state' / 'job.json').exists(), 'מפתח העבודה נמחק מהדיסק')
        self.assertNotIn(KEY, r.stdout + r.stderr)

    def test_bad_job_shape_ignored(self):
        self.fake.next_job = {'id': '../../etc', 'key': KEY}
        r = self.agent()
        self.assertEqual(r.returncode, 0)
        self.assertEqual(self.fake.reports, [])

    def test_server_error_backs_off(self):
        self.fake.fail = 1
        r = self.agent()
        self.assertEqual(r.returncode, 0)
        self.assertIn('השרתון לא זמין (http_503)', r.stdout)

    def test_refuses_foreign_server_and_bad_token(self):
        r = self.agent(env=dict(self.env, SNB_SERVER='https://evil.example.com'))
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.fake.polls, 0)
        r = self.agent(env=dict(self.env, SNB_WORKER_TOKEN='short'))
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.fake.polls, 0)


class HandleUnit(unittest.TestCase):
    """handle(): עבודת תרגום = run ואז auto; חריגת זמן = דיווח כשל; הניקוי קורה תמיד."""

    def test_tr_runs_auto_and_cleanup_on_crash(self):
        tmp = Path(tempfile.mkdtemp())
        saved = {k: os.environ.get(k) for k in ('VT_WORK', 'SNB_STATE')}
        os.environ['VT_WORK'] = str(tmp / 'w')
        os.environ['SNB_STATE'] = str(tmp / 's')
        sys.path.insert(0, str(HERE))
        import importlib
        import job
        import agent
        importlib.reload(job)
        importlib.reload(agent)
        calls = []

        def child(args, timeout):
            calls.append(args[0])
            self.assertTrue(agent.BUSY.exists(), 'בזמן עבודה — קובץ busy (המעדכן לא מחליף גרסה)')
            (job.VT_WORK / 'proj').mkdir(parents=True, exist_ok=True)
            (job.VT_WORK / 'proj' / 'a.mp4').write_bytes(b'v')
            if args[0] == 'auto':
                raise RuntimeError('crash')
            return 0
        agent.run_child = child

        def restore():                          # קודם הסביבה, ואז טעינה מחדש — כך שאר הבדיקות רואות את הנתיבים הרגילים
            for k, v in saved.items():
                os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)
            importlib.reload(job)
            importlib.reload(agent)
        self.addCleanup(restore)
        with self.assertRaises(RuntimeError):
            agent.handle({'id': JOB, 'key': KEY, 'kind': 'tr'}, job.SERVER)
        self.assertEqual(calls, ['run', 'auto'])
        self.assertEqual(list(job.VT_WORK.iterdir()), [], 'גם בקריסה — הסרטון נמחק')


if __name__ == '__main__':
    unittest.main()
