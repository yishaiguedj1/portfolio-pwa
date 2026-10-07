"""v358: העובד בענן (translator/job.py) — עבודת תרגום מקצה לקצה מול שרתון ו־Drive מדומים, עם vt מדומה.

בודק: לקיחה ושמירת המצב (קובץ פרטי, בלי להדפיס את המפתח), זוג שפות לא נתמך, הורדה עם המשך אחרי ניתוק (Range),
העלאה מתחדשת (308 → המשך מהבייט ש־Drive אישר), דיווח השלבים, finish שנעצר על שגיאות tr-check, ותוצרים בתיקיית העבודה.
הרצה: python3 -m unittest discover -s tests   (מתוך translator/)
"""
import json
import os
import stat
import subprocess
import sys
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
JOB = 'jAbCdEfGhIjKlMnOpQrSt'
KEY = 'K' * 40 + '_-9'
TOKEN = 'ya29.DRIVE-SECRET-TOKEN'
VIDEO = bytes(range(256)) * 4000          # ~1MB

FAKE_VT = r'''#!/usr/bin/env python3
import os, sys, pathlib
a = sys.argv[1:]
if a[:1] == ['-c']:
    rf = os.environ.get('FAKE_READY')
    sys.exit(0 if not rf or os.path.exists(rf) else 1)
a = a[2:]                                   # "-m vt"
cmd, name = a[0], (a[1] if len(a) > 1 else '')
w = pathlib.Path(os.environ['VT_WORK']) / name
log = pathlib.Path(os.environ['FAKE_LOG'])
log.open('a').write(' '.join(a) + '\n')
if cmd == 'new':
    w.mkdir(parents=True, exist_ok=True)
    src = a[a.index('--source') + 1]
    (w / 'src_size').write_text(str(os.path.getsize(src)))
elif cmd == 'asr':
    print('תמלול 50%'); print('תמלול 100%')
elif cmd == 'tr-check':
    n = os.environ.get('FAKE_ERRS', '0')
    print('תורגמו 10/10 · שגיאות ' + n + ' · מעל תקציב 0')
elif cmd == 'render':
    (w / 'out').mkdir(parents=True, exist_ok=True)
    if '--compact' in a: (w / 'out' / (name + '.he.compact.mp4')).write_bytes(b'v' * 700000)
    if '--mkv' in a: (w / 'out' / (name + '.he.mkv')).write_bytes(b'm' * 1000)
elif cmd == 'build':
    (w / 'out').mkdir(parents=True, exist_ok=True)
    (w / 'out' / 'he.srt').write_text('1\n00:00:00,000 --> 00:00:01,000\nשלום\n')
print('✓ ' + cmd)
'''


class Fake:
    """השרתון ו־Drive במקום אחד (כתובת מקומית — job.py מקבל רק localhost בבדיקות)."""

    def __init__(self):
        self.reports, self.files, self.uploads = [], {}, {}
        self.kind, self.spec, self.video_after = 'tr', {'name': 'Interview_2026.mp4', 'size': len(VIDEO), 'to': ['he'], 'from': 'auto',
                                                         'mode': 'opus-medium', 'out': ['compact'], 'dur': 4620}, 0
        self.claims, self.cut_once, self.upload_drop = 0, True, True
        fake = self

        class H(BaseHTTPRequestHandler):
            def log_message(self, *a):
                pass

            def _send(self, st, obj=None, hd=None, raw=None):
                body = raw if raw is not None else json.dumps(obj or {}).encode()
                self.send_response(st)
                for k, v in (hd or {}).items():
                    self.send_header(k, v)
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def do_POST(self):
                n = int(self.headers.get('Content-Length') or 0)
                data = self.rfile.read(n) if n else b''
                if self.path.startswith('/upload/drive/v3/files?uploadType=resumable'):
                    if self.headers.get('Authorization') != 'Bearer ' + TOKEN:
                        return self._send(401)
                    meta = json.loads(data)
                    uid = 'up%04d' % len(fake.uploads)
                    fake.uploads[uid] = {'meta': meta, 'data': b'', 'size': int(self.headers.get('X-Upload-Content-Length'))}
                    return self._send(200, {}, {'Location': 'http://127.0.0.1:%d/session/%s' % (fake.port, uid)})
                body = json.loads(data or b'{}')
                if body.get('job') != JOB or body.get('key') != KEY:
                    return self._send(403, {'ok': False, 'error': 'bad_key', 'stop': True})
                op = body.get('op')
                if op == 'claim':
                    fake.claims += 1
                    files = {'a': {'id': 'AUDIO000001', 'size': 10}}
                    if fake.claims > fake.video_after:
                        files['v'] = {'id': 'VIDEO000001', 'name': 'Interview_2026.mp4', 'size': len(VIDEO)}
                    return self._send(200, {'ok': True, 'job': {'id': JOB, 'kind': fake.kind, 'state': 'running', 'spec': fake.spec,
                                                                  'folder': 'FOLDER00001', 'files': files},
                                            'drive': {'token': TOKEN}})
                if op == 'token':
                    return self._send(200, {'ok': True, 'drive': {'token': TOKEN}})
                if op == 'report':
                    fake.reports.append(body)
                    return self._send(200, {'ok': True, 'stop': False})
                return self._send(400, {'ok': False})

            def do_GET(self):
                if self.path.startswith('/drive/v3/files/VIDEO000001?alt=media'):
                    if self.headers.get('Authorization') != 'Bearer ' + TOKEN:
                        return self._send(401)
                    rng = self.headers.get('Range')
                    start = int(rng.split('=')[1].rstrip('-')) if rng else 0
                    chunk = VIDEO[start:]
                    if fake.cut_once and not rng:            # ניתוק באמצע ההורדה הראשונה
                        fake.cut_once = False
                        self.send_response(200)
                        self.send_header('Content-Length', str(len(chunk)))
                        self.end_headers()
                        self.wfile.write(chunk[:300000])
                        self.wfile.flush()
                        self.connection.close()
                        return
                    return self._send(206 if rng else 200, raw=chunk)
                return self._send(404)

            def do_PUT(self):
                uid = self.path.rsplit('/', 1)[-1]
                up = fake.uploads[uid]
                n = int(self.headers.get('Content-Length') or 0)
                data = self.rfile.read(n) if n else b''
                cr = self.headers.get('Content-Range', '')
                if cr.startswith('bytes */'):                # "כמה הגיע?"
                    got = len(up['data'])
                    return self._send(308, {}, {'Range': 'bytes=0-%d' % (got - 1)} if got else {})
                start = int(cr.split(' ')[1].split('-')[0])
                if fake.upload_drop and start == 0 and len(data) > 200000:   # Drive קיבל רק חלק
                    fake.upload_drop = False
                    up['data'] = data[:262144]
                    return self._send(308, {}, {'Range': 'bytes=0-262143'})
                up['data'] = up['data'][:start] + data
                if len(up['data']) >= up['size']:
                    fid = 'OUT' + uid.upper() + '00'
                    up['id'] = fid
                    return self._send(200, {'id': fid})
                return self._send(308, {}, {'Range': 'bytes=0-%d' % (len(up['data']) - 1)})

        self.srv = ThreadingHTTPServer(('127.0.0.1', 0), H)
        self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()

    def close(self):
        self.srv.shutdown()


class TestWorker(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.tmp = Path(tempfile.mkdtemp())
        vtpy = self.tmp / 'fakevt'
        vtpy.write_text(FAKE_VT)
        vtpy.chmod(0o755)
        self.env = dict(os.environ, SNB_STATE=str(self.tmp / 'state'), VT_PY=str(vtpy), VT_WORK=str(self.tmp / 'work'),
                        VT_BIN=str(self.tmp / 'nobin'), FAKE_LOG=str(self.tmp / 'vt.log'))
        self.base = 'http://127.0.0.1:%d' % self.fake.port

    def tearDown(self):
        self.fake.close()

    def job(self, *args, env=None):
        r = subprocess.run([sys.executable, str(HERE / 'job.py')] + list(args), capture_output=True, text=True, timeout=120,
                           env=dict(self.env, **(env or {})))
        return r.returncode, r.stdout + r.stderr

    def take(self):
        return self.job('run', '--job', JOB, '--key', KEY, '--server', self.base, '--drive-api', self.base + '/drive/v3')

    def test_flow(self):
        code, out = self.take()
        self.assertEqual(code, 0, out)
        self.assertIn('עבודת תרגום נלקחה', out)
        self.assertNotIn(KEY, out)
        self.assertNotIn(TOKEN, out)
        st = self.tmp / 'state' / 'job.json'
        self.assertEqual(stat.S_IMODE(st.stat().st_mode), 0o600, 'קובץ המצב פרטי')
        self.assertFalse(self.fake.reports, 'לקיחה בלי דיווח "נכשל"')

        code, out = self.job('prepare')
        self.assertEqual(code, 0, out)
        size = (self.tmp / 'work' / JOB / 'src_size').read_text()
        self.assertEqual(int(size), len(VIDEO), 'ההורדה הושלמה אחרי ניתוק (Range)')
        self.assertTrue(any(r.get('st') == 'tr' and 0.5 < (r.get('p') or 0) < 0.95 for r in self.fake.reports), 'אחוזים מ־vt → התקדמות השלב')
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()]
        self.assertEqual(cmds, ['new', 'ingest', 'asr', 'shots', 'edit-export'])

        code, out = self.job('align')
        self.assertEqual(code, 0, out)
        self.assertTrue(any(r.get('st') == 'al' and r.get('p') == 1 for r in self.fake.reports))

        code, out = self.job('stage', 'tl', '--p', '0.4', '--msg', 'מתרגם')
        self.assertEqual(code, 0, out)
        self.assertEqual(self.fake.reports[-1]['st'], 'tl')
        self.assertEqual(self.fake.reports[-1]['p'], 0.4)

        code, out = self.job('finish', env={'FAKE_ERRS': '2'})
        self.assertEqual(code, 1, out)
        self.assertIn('tr-check', out)
        self.assertFalse(self.fake.uploads, 'עם שגיאות — לא מעלים כלום')

        code, out = self.job('finish')
        self.assertEqual(code, 0, out)
        done = self.fake.reports[-1]
        self.assertTrue(done.get('done'))
        kinds = sorted(o['k'] for o in done['out'])
        self.assertEqual(kinds, ['compact', 'srt'], 'רק התוצרים שנבחרו + SRT')
        up = {u['meta']['appProperties']['snbOut']: u for u in self.fake.uploads.values()}
        self.assertEqual(len(up['compact']['data']), 700000, 'העלאה מתחדשת — הקובץ המלא אחרי 308 חלקי')
        self.assertEqual(up['compact']['meta']['parents'], ['FOLDER00001'])
        self.assertEqual(up['compact']['meta']['name'], 'Interview_2026 (עברית).mp4')
        self.assertTrue(any(r.get('st') == 'sv' for r in self.fake.reports))
        self.assertNotIn(KEY, out)

    def test_waits_for_video(self):
        self.fake.video_after = 2
        self.assertEqual(self.take()[0], 0)
        code, out = self.job('prepare', env={'SNB_POLL': '0.2'})
        self.assertEqual(code, 0, out)
        self.assertIn('מחכה', out)

    def test_setup_in_background(self):
        # המנועים חסרים: run מפעיל את ההתקנה ברקע, prepare מחכה לה — בלי פעולה של המשתמש
        ready = self.tmp / 'ready'
        setup = self.tmp / 'setup.sh'
        setup.write_text('sleep 2; touch "%s"\n' % ready)
        env = {'FAKE_READY': str(ready), 'SNB_SETUP': 'bash ' + str(setup)}
        code, out = self.job('run', '--job', JOB, '--key', KEY, '--server', self.base, '--drive-api', self.base + '/drive/v3', env=env)
        self.assertEqual(code, 0, out)
        self.assertIn('ברקע', out)
        self.assertFalse(ready.exists(), 'run לא מחכה להתקנה')
        code, out = self.job('prepare', env=env)
        self.assertEqual(code, 0, out)
        self.assertTrue(ready.exists())
        self.assertTrue((self.tmp / 'state' / 'setup.pid').exists(), 'ההתקנה הופעלה ברקע כבר ב־run')
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()]
        self.assertEqual(cmds[0], 'new', 'vt רץ רק אחרי שההתקנה הסתיימה')

    def test_lang_unsupported(self):
        self.fake.spec = dict(self.fake.spec, to=['ru'])
        code, out = self.take()
        self.assertEqual(code, 1, out)
        self.assertEqual(self.fake.reports[-1].get('err'), 'lang_unsupported')

    def test_no_state(self):
        code, out = self.job('prepare')
        self.assertNotEqual(code, 0)
        self.assertIn('אין עבודה פעילה', out)

    def test_fail(self):
        self.take()
        code, out = self.job('fail', '--err', 'Bad Code!', '--msg', 'נתקע')
        self.assertEqual(code, 0, out)
        self.assertEqual(self.fake.reports[-1]['err'], 'worker', 'קוד שגיאה לא תקין → worker')


if __name__ == '__main__':
    unittest.main()
