"""הסוכן של השרת (agent.py) — מול שרתון מדומה בלבד: משיכה עם טוקן השרת, בלי פורט פתוח, ניקוי אחרי כל עבודה.

הרצה: python3 -m unittest tests.test_agent   (מתוך translator/)
"""
import json
import time
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
        self.polls, self.reports, self.auth, self.next_job, self.fail, self.hb = 0, [], [], None, 0, []
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
                    fake.hb.append(body.get('hb'))
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
        hb = self.fake.hb[0]
        self.assertEqual(hb['busy'], '')
        self.assertTrue(0 <= hb['disk'] <= 100 and hb['free'] >= 0 and 'mem' in hb, 'דופק: דיסק, זיכרון — מספרים בלבד')
        self.assertEqual(set(hb) - {'v', 'busy', 'disk', 'free', 'load', 'mem', 'up', 'iso', 'iw', 'al', 'ev', 'cpu', 'nj', 'mx'}, set(), 'בלי שום שדה מעבר למספרים, לגרסה ולקודים הקבועים')
        self.assertEqual([k for _, k in hb['ev']], ['up'], 'ת7: יומן השרת — "הסוכן עלה" נשלח כבר בפנייה הראשונה')
        self.assertTrue(all(isinstance(t, int) and t > 1.6e9 for t, _ in hb['ev']))
        self.assertIn(hb['al'], ('o', 't'), 'שלב 4.1: מנוע היישור — קוד קבוע (בלי גרפים בבדיקה = torch)')
        self.assertIn(hb['iso'], ('g', 'r'), 'ת2: בידוד הקופסה — קוד קבוע')
        self.assertTrue(hb.get('iw', 'mem') in ('mem', 'missing', 'selftest', 'manual'))

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

    def test_reports_job_cut_by_restart(self):
        """14/10/2026: הסוכן עולה ומוצא עבודה שרצה (.busy + קובץ המצב) — השרת הופעל מחדש באמצע. מדווח worker_lost
        (השרתון: תקלה חולפת → "המשך" אוטומטי), ואז מנקה. בלי זה העבודה נשארה "רצה" עד שעתיים."""
        work, state = self.tmp / 'work', self.tmp / 'state'
        work.mkdir(parents=True)
        state.mkdir(parents=True)
        (work / '.busy').write_text(JOB)
        (state / 'job.json').write_text(json.dumps({'job': JOB, 'key': KEY, 'server': self.fake.url,
                                                    'drive_api': self.fake.url + '/drive/v3'}))
        r = self.agent()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        lost = [x for x in self.fake.reports if x.get('err') == 'worker_lost']
        self.assertEqual(len(lost), 1, r.stdout + r.stderr)
        self.assertTrue(lost[0].get('fail'))
        self.assertFalse((state / 'job.json').exists(), 'אחרי הדיווח — הניקוי הרגיל')
        self.assertFalse((work / '.busy').exists(), '20/10/2026: .busy שנשאר מעבודה שנקטעה נמחק — אחרת המעדכן לא מחליף גרסה לעולם')
        self.assertIn('lost', [k for _, k in self.fake.hb[0]['ev']], 'יומן השרת: "עבודה נקטעה"')
        self.assertNotIn(KEY, r.stdout + r.stderr)

    def test_no_report_without_busy(self):
        state = self.tmp / 'state'
        state.mkdir(parents=True)
        (state / 'job.json').write_text(json.dumps({'job': JOB, 'key': KEY, 'server': self.fake.url, 'drive_api': self.fake.url + '/drive/v3'}))
        r = self.agent()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual([x for x in self.fake.reports if x.get('err') == 'worker_lost'], [], 'בלי .busy — לא עבודה שנקטעה')

    def test_stale_busy_removed_on_start(self):
        # 20/10/2026: .busy בלי קובץ מצב (העבודה כבר נמחקה / בוטלה) — בעלייה אף עבודה לא רצה, אז הוא שארית
        work = self.tmp / 'work'
        work.mkdir(parents=True)
        (work / '.busy').write_text(JOB)
        r = self.agent()
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertFalse((work / '.busy').exists())
        self.assertEqual(self.fake.hb[0]['busy'], '', 'הדופק: לא עסוק')

    def test_refuses_foreign_server_and_bad_token(self):
        r = self.agent(env=dict(self.env, SNB_SERVER='https://evil.example.com'))
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.fake.polls, 0)
        r = self.agent(env=dict(self.env, SNB_WORKER_TOKEN='short'))
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(self.fake.polls, 0)


class OrphanUnit(unittest.TestCase):
    """14/10/2026: עבודה שחרגה מהזמן — נעצרת כל קבוצת התהליכים שלה (vt, ffmpeg), לא רק job.py."""

    def test_timeout_kills_grandchildren(self):
        sys.path.insert(0, str(HERE))
        import agent
        tmp = Path(tempfile.mkdtemp())
        pidf = tmp / 'gc.pid'
        (tmp / 'job.py').write_text(
            'import subprocess, sys, time\n'
            'p = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(60)"])\n'
            'open(%r, "w").write(str(p.pid))\n'
            'time.sleep(60)\n' % str(pidf))
        saved = agent.HERE
        agent.HERE = tmp
        self.addCleanup(setattr, agent, 'HERE', saved)
        rc = agent.run_child([], 2)
        self.assertEqual(rc, 124)
        gc = int(pidf.read_text())
        import time
        for _ in range(50):
            try:
                os.kill(gc, 0)
            except ProcessLookupError:
                break
            try:                                   # זומבי (נכד שהורה מת — אצל init) עדיין "קיים"; לבדוק את המצב
                if Path('/proc/%d/stat' % gc).read_text().split()[2] == 'Z':
                    break
            except OSError:
                break
            time.sleep(0.1)
        else:
            self.fail('הנכד (vt) עוד רץ אחרי שהעבודה חרגה מהזמן')


class EventLogUnit(unittest.TestCase):
    """ת7: יומן השרת — קודים קבועים, רצף של אותה תקלה לא ממלא את היומן, עד 12 אירועים."""

    def setUp(self):
        sys.path.insert(0, str(HERE))
        import agent
        self.A = agent
        agent._events.clear()

    def test_end_codes(self):
        e = self.A.end_code
        self.assertEqual([e(0), e(1), e(2), e(124), e(137), e(-9), e(3), e(4)], ['done', 'fail', 'stop', 'timeout', 'oom', 'oom', 'park', 'crash'])

    def test_repeated_net_collapses(self):
        for _ in range(5):
            self.A.ev('net')
        self.A.ev('up')
        self.A.ev('net')
        self.assertEqual([k for _, k in self.A.ev_list()], ['net', 'up', 'net'])
        for _ in range(20):
            self.A.ev('job')
        self.assertEqual(len(self.A.ev_list()), 12)


class HandleUnit(unittest.TestCase):
    """handle(): עבודת תרגום = run ואז auto; חריגת זמן = דיווח כשל; הניקוי קורה תמיד."""

    def test_crash_code(self):
        sys.path.insert(0, str(HERE))
        import agent
        # 0 = הצליח, 1 = כבר דיווח, 2 = "עצור" — בלי דיווח; כל השאר = דיווח (אחרת העבודה "רצה" עד STALE_MS)
        self.assertEqual([agent.crash_code(rc) for rc in (0, 1, 2, 3)], ['', '', '', ''], '3 = חזרה לתור (מחכה לסרטון) — דווח כבר')
        self.assertEqual(agent.crash_code(124), 'job_timeout')
        self.assertEqual(agent.crash_code(137), 'worker_oom', 'SIGKILL של מנהל הזיכרון')
        self.assertEqual(agent.crash_code(-9), 'worker_oom')
        self.assertEqual(agent.crash_code(-11), 'worker_crash')
        self.assertEqual(agent.crash_code(4), 'worker_crash')

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
            job.LADDER_DIR.mkdir(parents=True, exist_ok=True)              # איכויות הצפייה — בתיקיית העבודה
            (job.LADDER_DIR / 'top.mp4').write_bytes(b'v')
            (job.STATE.parent / 'ladder').mkdir(parents=True, exist_ok=True)   # שארית מגרסה קודמת ב־/state
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
        self.assertFalse((job.STATE.parent / 'ladder').exists(), 'שארית האיכויות ב־/state (tmpfs של 16MB) נמחקת')
        self.assertTrue(str(job.LADDER_DIR).startswith(str(job.VT_WORK)), 'האיכויות בדיסק העבודה, לא ב־/state (תקלה 10/10)')


if __name__ == '__main__':
    unittest.main()


class BootPollUnit(unittest.TestCase):
    """20/10/2026: הפנייה הראשונה אחרי העלייה (boot) — השרתון מסמן worker_lost לעבודה שנקטעה אצל השרת הזה.
    רק ב־poll, ורק עד התשובה התקינה הראשונה (תקלת רשת — boot נשלח שוב בפעם הבאה)."""

    def test_boot_only_first_ok_poll(self):
        sys.path.insert(0, str(HERE))
        import agent
        sent = []
        answers = [(200, {'ok': True, 'job': None}), (503, {}), (200, {'ok': True, 'job': None}), (200, {'ok': True, 'job': None})]

        def fake_http(method, url, body, headers=None, timeout=None):
            sent.append(dict(body))
            st, j = answers.pop(0)
            return st, j, {}
        saved_http, saved_boot = agent.J.http, agent._boot
        agent.J.http, agent._boot = fake_http, True
        self.addCleanup(setattr, agent.J, 'http', saved_http)
        self.addCleanup(setattr, agent, '_boot', saved_boot)
        agent.poll('https://x', 't', 'beat', 'j' + 'a' * 20)   # דופק — בלי boot
        agent.poll('https://x', 't')                           # 503 — עוד לא "עלינו", ישלח שוב
        agent.poll('https://x', 't')                           # התשובה התקינה הראשונה
        agent.poll('https://x', 't')
        self.assertEqual([b.get('boot') for b in sent], [None, True, True, None])


JOB2 = 'jZyXwVuTsRqPoNmLkJiH-'
KEY2 = 'Q' * 40 + '_-8'


class SlotsFake(Fake):
    """שתי עבודות בתור; הלקיחה של הראשונה איטית (3 שנ׳) — כך הבקשה השנייה מגיעה כשהראשונה עוד רצה"""
    def __init__(self):
        super().__init__()
        self.queue = [{'id': JOB, 'key': KEY, 'kind': 'ping', 'dur': 600}, {'id': JOB2, 'key': KEY2, 'kind': 'ping', 'dur': 300}]
        self.bodies, self.claims = [], {}
        fake = self
        keys = {JOB: KEY, JOB2: KEY2}

        class H(self.srv.RequestHandlerClass):
            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
                if body.get('op') == 'poll':
                    fake.polls += 1
                    fake.bodies.append(body)
                    jb = fake.queue.pop(0) if fake.queue else None
                    return self._send(200, {'ok': True, 'job': jb})
                if keys.get(body.get('job')) != body.get('key'):
                    return self._send(403, {'ok': False, 'error': 'bad_key', 'stop': True})
                if body['op'] == 'claim':
                    fake.claims[body['job']] = time.time()
                    if body['job'] == JOB:
                        time.sleep(3)
                    return self._send(200, {'ok': True, 'job': {'kind': 'ping'}, 'drive': {'token': 'ya29.T'}})
                if body['op'] == 'report':
                    fake.reports.append(body)
                    return self._send(200, {'ok': True})
                return self._send(400, {'ok': False})
        self.srv.RequestHandlerClass = H


class SlotsTests(unittest.TestCase):
    """21/10/2026: כמה עבודות במקביל — כל אחת בתהליך ובתיקיות משלה, והבקשה לעוד עבודה כוללת כמה זיכרון פנוי"""

    def test_two_jobs_in_parallel(self):
        fake = SlotsFake()
        tmp = Path(tempfile.mkdtemp())
        (tmp / 'home').mkdir()
        env = dict(os.environ, SNB_SERVER=fake.url, SNB_WORKER_TOKEN=WTOK, SNB_DRIVE_API=fake.url + '/drive/v3',
                   VT_WORK=str(tmp / 'work'), SNB_STATE=str(tmp / 'state'), HOME=str(tmp / 'home'), SNB_POLL_S='0.2',
                   SNB_SLOTS='2', SNB_STOP_AFTER='2', SNB_MEM_DB=str(tmp / 'cache' / 'mem.json'))
        try:
            r = subprocess.run([sys.executable, str(HERE / 'agent.py')], env=env, capture_output=True, text=True, timeout=90)
        finally:
            fake.srv.shutdown()
            fake.srv.server_close()
        out = r.stdout + r.stderr
        self.assertEqual(r.returncode, 0, out)
        done = {x.get('job') for x in fake.reports if x.get('done')}
        self.assertEqual(done, {JOB, JOB2}, 'שתי העבודות רצו ודווחו')
        self.assertLess(fake.claims[JOB2] - fake.claims[JOB], 3, 'השנייה נלקחה בזמן שהראשונה עוד רצה — במקביל, לא בתור')
        fits = [b.get('fit') for b in fake.bodies if b.get('fit')]
        self.assertTrue(fits, 'הבקשה לעוד עבודה (כשאחת רצה) כוללת כמה זיכרון פנוי')
        f = fits[0]
        self.assertTrue(all(isinstance(f[k], (int, float)) for k in ('mb', 'a', 'b', 'ra', 'rb', 'ai')), f)
        self.assertTrue(any((b.get('hb') or {}).get('nj') == 1 for b in fake.bodies), 'הדופק: כמה עבודות רצות')
        self.assertTrue(all(isinstance((b.get('hb') or {}).get('cpu'), int) for b in fake.bodies), 'הדופק: הליבות המותרות')
        self.assertEqual(list((tmp / 'work').iterdir()), [], 'אחרי שתי העבודות לא נשאר כלום — גם לא תיקיות המשבצות')
        self.assertFalse(any((tmp / 'state').glob('s*')), 'מצב העבודות (כולל המפתחות) נמחק')
        self.assertNotIn(KEY, out)
        self.assertNotIn(KEY2, out)
        self.assertIn('שיא זיכרון', out, 'השיא של כל עבודה נמדד')
        self.assertFalse((tmp / 'cache' / 'mem.json').exists(), 'בדיקת חיבור לא נכנסת למאגר השיאים (רק תרגום / הפקה / AI)')


class MemUnit(unittest.TestCase):
    def setUp(self):
        sys.path.insert(0, str(HERE))
        import agent
        self.A = agent

    def test_need_and_learning(self):
        A = self.A
        with tempfile.TemporaryDirectory() as d:
            A.MEM_DB = Path(d) / 'm.json'
            base = A.mem_need('tr', 3600)
            self.assertEqual(base, round((4600 + 22 * 60) * 1.1), 'לפני מדידות — ה־prior × מרווח')
            A.mem_note('tr', 600, 9000)                   # שיא גבוה מה־prior — המודל עולה
            self.assertGreater(A.mem_need('tr', 3600), base)
            A.mem_note('tr', 600, 100)                    # שיא נמוך — לא מוריד מתחת ל־prior (שמרני)
            self.assertEqual(A.mem_model('tr')[0], round(9000 - 22 * 10))
            self.assertEqual(A.mem_need('ai', 0), round(700 * 1.1))

    def test_slots_by_cpu(self):
        A = self.A
        old = os.environ.pop('SNB_SLOTS', None)
        try:
            self.assertEqual(A.slots_max(), max(1, min(4, A.cpus_allowed() // 4)))
            os.environ['SNB_SLOTS'] = '9'
            self.assertEqual(A.slots_max(), 4, 'לכל היותר 4')
        finally:
            os.environ.pop('SNB_SLOTS', None)
            if old is not None:
                os.environ['SNB_SLOTS'] = old
