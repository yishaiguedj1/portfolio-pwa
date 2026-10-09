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
JOB = 'jAbCdEfGhIjKlMnOpQrS-'      # אותיות גדולות ו־- בסוף, כמו מזהה אמיתי
SLUG = 'jabcdefghijklmnopqrs'      # השם שבו vt שומר את הפרויקט (slugify)
KEY = 'K' * 40 + '_-9'
TOKEN = 'ya29.DRIVE-SECRET-TOKEN'
VIDEO = bytes(range(256)) * 4000          # ~1MB
AUDIO = bytes(range(255, -1, -1)) * 300    # ~77KB

FAKE_VT = r'''#!/usr/bin/env python3
import os, re, sys, json, pathlib
a = sys.argv[1:]
if a[:1] == ['-c']:
    rf = os.environ.get('FAKE_READY')
    if not rf or os.path.exists(rf):
        sys.exit(0)
    print(a[-1])                            # כמו הבדיקה האמיתית: שורה לכל מודול חסר (כאן — האחרון ברשימה)
    sys.exit(1)
if a and a[0].endswith('sync.py'):           # v360: מדידת ההיסט בין הקולות
    pathlib.Path(os.environ['FAKE_LOG']).open('a').write('sync\n')
    print(os.environ.get('FAKE_SYNC', '0.250000 0.990'))
    sys.exit(0)
a = a[2:]                                   # "-m vt"
cmd, name = a[0], (a[1] if len(a) > 1 else '')
name = re.sub(r'[^\w\-]+', '-', name.strip().lower(), flags=re.UNICODE).strip('-') or 'interview'   # כמו vt האמיתי
w = pathlib.Path(os.environ['VT_WORK']) / name
log = pathlib.Path(os.environ['FAKE_LOG'])
log.open('a').write(' '.join(a) + '\n')
if os.environ.get('FAKE_FAIL') == cmd:      # v365: פקודה שנכשלת — לאירוע של מגדל הפיקוח
    print('boom'); sys.exit(3)
if cmd == 'new':
    w.mkdir(parents=True, exist_ok=True)
    src = a[a.index('--source') + 1]
    (w / 'project.json').write_text(json.dumps({'name': name, 'source': src}))
elif cmd == 'ingest':                       # כמו vt: המקור מ־project.json (v361: לא meta.json), הקישור source.<סיומת>, audio16k.wav
    src = json.loads((w / 'project.json').read_text())['source']
    if not list(w.glob('source.*')) or '--force' in a:
        os.link(src, w / ('source' + pathlib.Path(src).suffix))
    (w / 'src_size').write_text(str(os.path.getsize(src)))
    (w / 'audio16k.wav').write_text('wav:' + src)
elif cmd == 'tr-prep':
    (w / 'tr').mkdir(exist_ok=True)
    (w / 'tr' / 'source.md').write_text('# source')
elif cmd == 'asr':
    print('תמלול 50%'); print('תמלול 100%')
    (w / 'asr').mkdir(exist_ok=True)
    (w / 'asr' / 'parakeet.json').write_text(json.dumps({'words': [{'w': 'Hello', 's': 1.0, 'e': 1.5}, {'w': 'world', 's': 0.1, 'e': 0.2}]}))
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
        self.claims, self.cut_once, self.upload_drop, self.audio = 0, True, True, True
        self.qa, self.answer, self.answer_after, self.ask_polls, self.ask_limit = None, None, 1, 0, False
        self.ck, self.corrupt, self.deleted = [], set(), []          # v361: נקודות שמירה (מה שהשרתון מחזיר בלקיחה)
        self.stop_all = False                                         # v362: העבודה בוטלה — כל קריאה מקבלת "עצור"
        self.nm = None                                                # v363: "הרגיל" של המשתמש (מהשרתון בלקיחה)
        self.fb, self.ls = [], None                                   # v364: ספר התיקונים והעצירה שלפני ההמשך
        self.fm = None                                                # v366: מסלול התיקונים (בלי — כמו שרתון ישן)
        self.rl, self.bx, self.u0 = None, 0, 0                        # v367: החוקים, אישורים מעבר לתקציב, מה שכבר עלה
        self.gate_ans, self.gate_after, self.gate_polls = None, 1, 0  # v367: התשובה לשער ('go'/'stop') ואחרי כמה בדיקות
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
                if fake.stop_all:
                    return self._send(200, {'ok': False, 'stop': True, 'state': 'cancelled'})
                if op == 'claim':
                    fake.claims += 1
                    if fake.qa and fake.qa['a'] is None and fake.answer is not None:
                        fake.ask_polls += 1
                        if fake.ask_polls >= fake.answer_after:
                            fake.qa['a'] = {'i': 0, 't': fake.answer}
                    files = {'a': {'id': 'AUDIO000001', 'name': 'Interview_2026.audio.m4a', 'size': len(AUDIO)}} if fake.audio else {}
                    if fake.claims > fake.video_after:
                        files['v'] = {'id': 'VIDEO000001', 'name': 'Interview_2026.mp4', 'size': len(VIDEO)}
                    return self._send(200, {'ok': True, 'job': {'id': JOB, 'kind': fake.kind, 'state': 'running', 'spec': fake.spec,
                                                                  'folder': 'FOLDER00001', 'files': files, 'qa': fake.qa, 'ck': fake.ck,
                                                                  'nm': fake.nm, 'fb': fake.fb, 'ls': fake.ls, 'fm': fake.fm,
                                                                  'rl': fake.rl, 'bx': fake.bx, 'u0': fake.u0},
                                            'drive': {'token': TOKEN}})
                if op == 'token':
                    return self._send(200, {'ok': True, 'drive': {'token': TOKEN}})
                if op == 'qa':                                   # v367: בדיקת תשובה לשער
                    q = fake.qa
                    if q and q.get('g') and q['a'] is None and fake.gate_ans:
                        fake.gate_polls += 1
                        if fake.gate_polls >= fake.gate_after:
                            q['a'] = {'i': 0 if fake.gate_ans == 'go' else 1, 't': fake.gate_ans}
                            if fake.gate_ans == 'go' and q['g'] == 'b':
                                fake.bx += 1
                    return self._send(200, {'ok': True, 'qa': q, 'bx': fake.bx})
                if op == 'report':
                    if body.get('ask') and fake.ask_limit:
                        return self._send(409, {'ok': False, 'error': 'ask_limit'})
                    fake.reports.append(body)
                    if body.get('ask'):
                        fake.qa = {'id': body['ask']['id'], 'a': None}
                    if body.get('gate'):
                        gid = 'g%012x' % len(fake.reports)
                        fake.qa, fake.gate_polls = {'id': gid, 'g': body['gate']['k'], 'a': None}, 0
                        return self._send(200, {'ok': True, 'stop': False, 'gate': gid})
                    if body.get('askTimeout') and fake.qa and fake.qa.get('id') == body['askTimeout'] and fake.qa['a'] is None:
                        fake.qa['a'] = {'i': 1, 't': 'stop', 'auto': True}
                    return self._send(200, {'ok': True, 'stop': False})
                return self._send(400, {'ok': False})

            def do_GET(self):
                if self.path.startswith('/drive/v3/files/AUDIO000001?alt=media'):
                    return self._send(200, raw=AUDIO)
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
                fid = self.path.split('/files/')[-1].split('?')[0]
                up = next((u for u in fake.uploads.values() if u.get('id') == fid), None)
                if up and 'alt=media' in self.path:                # נקודת שמירה שהועלתה קודם
                    return self._send(200, raw=b'x' * len(up['data']) if fid in fake.corrupt else up['data'])   # פגום, באותו גודל
                return self._send(404)

            def do_DELETE(self):
                fake.deleted.append(self.path.split('/files/')[-1].split('?')[0])
                return self._send(204, raw=b'')

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
                        VT_BIN=str(self.tmp / 'nobin'), FAKE_LOG=str(self.tmp / 'vt.log'),
                        SNB_CLAUDE_PROJECTS=str(self.tmp / 'projects'))   # לא היומנים האמיתיים של מי שמריץ את הבדיקות
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
        self.assertIn('הפרויקט: ' + str(self.tmp / 'work' / SLUG), out)
        self.assertNotIn(KEY, out)
        self.assertNotIn(TOKEN, out)
        st = self.tmp / 'state' / 'job.json'
        self.assertEqual(stat.S_IMODE(st.stat().st_mode), 0o600, 'קובץ המצב פרטי')
        self.assertFalse(self.fake.reports, 'לקיחה בלי דיווח "נכשל"')

        code, out = self.job('prepare')
        self.assertEqual(code, 0, out)
        W = self.tmp / 'work' / SLUG
        self.assertEqual(int((W / 'src_size').read_text()), len(AUDIO), 'v360: התמלול מהקול שעלה ראשון')
        self.assertTrue(any(r.get('st') == 'tr' and 0.5 < (r.get('p') or 0) < 0.95 for r in self.fake.reports), 'אחוזים מ־vt → התקדמות השלב')
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()]
        self.assertEqual(cmds, ['new', 'ingest', 'asr', 'edit-export'], 'מהקול: בלי חילופי שוטים (צריכים וידאו)')
        self.assertIn('מהקול', out)

        code, out = self.job('align')
        self.assertEqual(code, 0, out)
        self.assertTrue(any(r.get('st') == 'al' and r.get('p') == 1 for r in self.fake.reports))
        self.assertEqual(int((W / 'src_size').read_text()), len(VIDEO), 'הסרטון צורף (וההורדה הושלמה אחרי ניתוק — Range)')
        self.assertEqual([p.name for p in W.glob('source.*')], ['source.mp4'], 'הקול כבר לא המקור')
        self.assertTrue((W / 'audio16k.first.wav').exists())
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()][4:]
        self.assertEqual(cmds, ['ingest', 'sync', 'shots', 'edit-import', 'align', 'plan', 'tr-prep'])
        words = json.loads((W / 'asr' / 'parakeet.json').read_text())['words']
        self.assertEqual([(w['s'], w['e']) for w in words], [(1.25, 1.75), (0.35, 0.45)], 'זמני המילים הוזזו לציר הזמן של הסרטון')
        self.assertIn('היסט +0.250', out)

        code, out = self.job('stage', 'tl', '--p', '0.4', '--msg', 'מתרגם')
        self.assertEqual(code, 0, out)
        self.assertEqual(self.fake.reports[-1]['st'], 'tl')
        self.assertEqual(self.fake.reports[-1]['p'], 0.4)

        code, out = self.job('finish', env={'FAKE_ERRS': '2'})
        self.assertEqual(code, 1, out)
        self.assertIn('tr-check', out)
        self.assertFalse([u for u in self.fake.uploads.values() if 'snbOut' in u['meta']['appProperties']], 'עם שגיאות — לא מעלים תוצרים')

        code, out = self.job('finish')
        self.assertEqual(code, 0, out)
        done = self.fake.reports[-1]
        self.assertTrue(done.get('done'))
        kinds = sorted(o['k'] for o in done['out'])
        self.assertEqual(kinds, ['compact', 'srt'], 'רק התוצרים שנבחרו + SRT')
        up = {u['meta']['appProperties']['snbOut']: u for u in self.fake.uploads.values() if 'snbOut' in u['meta']['appProperties']}
        self.assertEqual(len(up['compact']['data']), 700000, 'העלאה מתחדשת — הקובץ המלא אחרי 308 חלקי')
        self.assertEqual(up['compact']['meta']['parents'], ['FOLDER00001'])
        self.assertEqual(up['compact']['meta']['name'], 'Interview_2026 (עברית).mp4')
        self.assertTrue(any(r.get('st') == 'sv' for r in self.fake.reports))
        self.assertNotIn(KEY, out)

    # ---------------------------------------------------------------- v361: נקודות שמירה והמשך
    def cks(self):
        return [r['ck'] for r in self.fake.reports if r.get('ck')]

    def new_container(self):
        """סשן חדש = מיכל חדש: בלי תיקיית העבודה ובלי קובץ המצב (רק מה שב־Drive ובשרתון)"""
        import shutil
        shutil.rmtree(self.tmp / 'work', ignore_errors=True)
        shutil.rmtree(self.tmp / 'state', ignore_errors=True)
        (self.tmp / 'vt.log').write_text('')
        self.fake.ck = [dict(c) for c in {c['s']: c for c in self.cks()}.values()]
        self.fake.reports.clear()

    def test_checkpoints(self):
        import io as _io, tarfile as _tar
        self.assertEqual(self.take()[0], 0)
        self.assertEqual(self.job('prepare')[0], 0)
        W = self.tmp / 'work' / SLUG
        (W / 'audio_api.ogg').write_bytes(b'o' * 100)
        code, out = self.job('align')
        self.assertEqual(code, 0, out)
        self.assertIn('נקודת שמירה: אחרי היישור', out)
        code, out = self.job('save', 'tl')
        self.assertEqual(code, 0, out)
        code, out = self.job('save', 'tl')                       # שוב — מחליפה את הקודמת
        self.assertEqual(code, 0, out)
        self.assertEqual(self.job('save', 'bn')[0], 1, 'רק tl / rv')
        self.assertEqual(self.job('finish')[0], 0)
        ck = self.cks()
        self.assertEqual([c['s'] for c in ck], ['asr', 'al', 'tl', 'tl', 'rv'])
        self.assertEqual(self.fake.deleted, [ck[2]['id']], 'נקודה ישנה של אותו שלב נמחקת מ־Drive')
        up = {u['id']: u for u in self.fake.uploads.values() if u.get('id')}
        al = up[ck[1]['id']]
        self.assertEqual(al['meta']['appProperties'], {'snbJob': JOB, 'snbCk': 'al'})
        self.assertEqual(al['meta']['parents'], ['FOLDER00001'])
        self.assertEqual(al['meta']['name'], 'נקודת שמירה — היישור.tar.gz')
        self.assertEqual(ck[1]['size'], len(al['data']))
        with _tar.open(fileobj=_io.BytesIO(al['data']), mode='r:gz') as t:
            names = sorted(t.getnames())
            info = json.loads(t.extractfile('_snb.json').read())
        self.assertIn('project.json', names)
        self.assertIn('asr/parakeet.json', names)
        self.assertIn('tr/source.md', names)
        self.assertFalse([n for n in names if n.startswith(('source.', 'out/')) or n.endswith(('.wav', '.ogg', '.mp4', '.m4a'))], names)
        self.assertEqual((info['s'], info['src']), ('al', 'v'))
        self.assertEqual(info['sync']['off'], 0.25)
        rv = up[ck[-1]['id']]
        with _tar.open(fileobj=_io.BytesIO(rv['data']), mode='r:gz') as t:
            self.assertFalse([n for n in t.getnames() if n.startswith('out/')], 'בלי הצריבות')

    def test_resume_from_latest(self):
        self.assertEqual(self.take()[0], 0)
        self.assertEqual(self.job('prepare')[0], 0)
        self.assertEqual(self.job('align')[0], 0)
        W = self.tmp / 'work' / SLUG
        before = json.loads((W / 'asr' / 'parakeet.json').read_text())
        self.new_container()
        code, out = self.take()
        self.assertEqual(code, 0, out)
        self.assertIn('↻ ממשיכים מנקודת שמירה: אחרי היישור', out)
        self.assertIn('job.py restore', out)
        self.assertNotIn('job.py prepare', out)
        code, out = self.job('restore')
        self.assertEqual(code, 0, out)
        self.assertIn('הצעד הבא: מלא את tr/brief.md', out)
        self.assertEqual(json.loads((W / 'asr' / 'parakeet.json').read_text()), before, 'התמלול המוזז חזר כמו שהוא — בלי תמלול מחדש')
        self.assertEqual(int((W / 'src_size').read_text()), len(VIDEO), 'הסרטון הורד וקולט מחדש')
        self.assertEqual(json.loads((W / 'project.json').read_text())['source'], str(self.tmp / 'work' / '_in' / (SLUG + '.mp4')))
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()]
        self.assertEqual(cmds, ['ingest'], 'בלי asr ובלי align — רק קליטת הסרטון')
        self.assertTrue(any(r.get('st') == 'tl' and r.get('msg') == 'ממשיכים מאותה נקודה' for r in self.fake.reports))
        self.assertNotIn(KEY, out)
        code, out = self.job('finish')
        self.assertEqual(code, 0, out)
        self.assertTrue(self.fake.reports[-1].get('done'))

    def test_resume_corrupt_falls_back(self):
        # האחרונה פגומה → הקודמת (אחרי התמלול, מהקול) — ואז align מצרף את הסרטון כרגיל
        self.assertEqual(self.take()[0], 0)
        self.assertEqual(self.job('prepare')[0], 0)
        self.assertEqual(self.job('align')[0], 0)
        self.new_container()
        self.fake.corrupt = {self.fake.ck[-1]['id']}
        self.assertEqual(self.take()[0], 0)
        code, out = self.job('restore')
        self.assertEqual(code, 0, out)
        self.assertIn('היישור לא נפתחה', out)
        self.assertIn('הצעד הבא: הגהה', out)
        W = self.tmp / 'work' / SLUG
        self.assertEqual(int((W / 'src_size').read_text()), len(AUDIO), 'נקודת התמלול — מהקול')
        self.assertFalse((W / 'tr').exists())
        code, out = self.job('align')
        self.assertEqual(code, 0, out)
        self.assertEqual(int((W / 'src_size').read_text()), len(VIDEO))

    def test_resume_none_valid(self):
        self.assertEqual(self.take()[0], 0)
        self.assertEqual(self.job('prepare')[0], 0)
        self.new_container()
        self.fake.corrupt = {c['id'] for c in self.fake.ck}
        self.assertEqual(self.take()[0], 0)
        code, out = self.job('restore')
        self.assertEqual(code, 0, out)
        self.assertIn('מתחילים מההתחלה', out)
        self.assertIn('job.py prepare', out)
        self.assertEqual(self.job('prepare')[0], 0)

    def test_unpack_safe(self):
        import importlib.util, io as _io, tarfile as _tar
        spec = importlib.util.spec_from_file_location('jobmod', HERE / 'job.py')
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)

        def arch(entries):
            p = self.tmp / ('a%d.tgz' % len(list(self.tmp.glob('a*.tgz'))))
            with _tar.open(p, 'w:gz') as t:
                for name, kind in entries:
                    ti = _tar.TarInfo(name)
                    if kind == 'link':
                        ti.type, ti.linkname = _tar.SYMTYPE, '/etc/passwd'
                        t.addfile(ti)
                    else:
                        data = b'{"s": "al"}' if name == '_snb.json' else b'{}'
                        ti.size = len(data)
                        t.addfile(ti, _io.BytesIO(data))
            return p
        dest = self.tmp / 'out'
        for bad in ([('_snb.json', 'f'), ('../evil.txt', 'f')], [('_snb.json', 'f'), ('/abs.txt', 'f')],
                    [('_snb.json', 'f'), ('x', 'link')], [('project.json', 'f')]):
            with self.assertRaises(ValueError, msg=str(bad)):
                m.ck_unpack(arch(bad), dest)
        self.assertFalse((self.tmp / 'evil.txt').exists())
        info = m.ck_unpack(arch([('_snb.json', 'f'), ('project.json', 'f'), ('asr/x.json', 'f')]), self.tmp / 'ok')
        self.assertEqual(info['s'], 'al')
        self.assertFalse((self.tmp / 'ok' / '_snb.json').exists())

    def test_waits_for_video(self):
        # v360: הקול כבר ב־Drive — התמלול לא מחכה לסרטון; היישור מחכה לו
        self.fake.video_after = 3
        self.assertEqual(self.take()[0], 0)
        code, out = self.job('prepare', env={'SNB_POLL': '0.2'})
        self.assertEqual(code, 0, out)
        self.assertNotIn('מחכה', out)
        code, out = self.job('align', env={'SNB_POLL': '0.2'})
        self.assertEqual(code, 0, out)
        self.assertIn('מחכה', out)
        self.assertTrue(any(r.get('st') == 'al' and r.get('msg') == 'מחכה שהסרטון יסיים לעלות' for r in self.fake.reports))

    def test_no_audio(self):
        # אין קובץ קול (קודק שאי אפשר להעתיק): מחכים לסרטון ומתמללים ממנו — כמו לפני v360
        self.fake.audio, self.fake.video_after = False, 2
        self.assertEqual(self.take()[0], 0)
        code, out = self.job('prepare', env={'SNB_POLL': '0.2'})
        self.assertEqual(code, 0, out)
        self.assertIn('מחכה', out)
        self.assertEqual(int((self.tmp / 'work' / SLUG / 'src_size').read_text()), len(VIDEO))
        self.assertEqual(self.job('align')[0], 0)
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()]
        self.assertEqual(cmds, ['new', 'ingest', 'asr', 'shots', 'edit-export', 'edit-import', 'align', 'plan', 'tr-prep'], 'בלי צירוף ובלי מדידת היסט')

    def test_sync_unsure(self):
        # ההיסט לא ודאי → תמלול מחדש מהסרטון (בלי טוקנים), בלי להזיז זמנים
        self.assertEqual(self.take()[0], 0)
        self.assertEqual(self.job('prepare')[0], 0)
        code, out = self.job('align', env={'FAKE_SYNC': '3.874 0.003'})
        self.assertEqual(code, 0, out)
        self.assertIn('לא ודאי', out)
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()][4:]
        self.assertEqual(cmds[:4], ['ingest', 'sync', 'asr', 'shots'])
        words = json.loads((self.tmp / 'work' / SLUG / 'asr' / 'parakeet.json').read_text())['words']
        self.assertEqual(words[0]['s'], 1.0, 'בלי הזזה — התמלול החדש כבר על ציר הזמן של הסרטון')

    def test_sync_module(self):
        # sync.py האמיתי על אותות סינתטיים: היסט חיובי/שלילי מדויק לדגימה, קבצים שונים — ודאות אפסית
        try:
            import numpy as np
        except ImportError:
            self.skipTest('numpy')
        import wave
        sr, rng = 16000, np.random.default_rng(7)
        t = np.arange(sr * 60) / sr
        env = (np.sin(2 * np.pi * 0.7 * t) > 0.2) * 1.0
        env[:sr * 3] = 0
        a = rng.normal(0, 3000, len(t)) * env

        def wav(name, x):
            p = self.tmp / name
            with wave.open(str(p), 'wb') as f:
                f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
                f.writeframes(np.clip(x, -32767, 32767).astype('<i2').tobytes())
            return str(p)

        def run(b):
            r = subprocess.run([sys.executable, str(HERE / 'sync.py'), wav('a.wav', a), wav('b.wav', b)], capture_output=True, text=True)
            off, conf = (float(x) for x in r.stdout.split())
            return off, conf
        off, conf = run(np.concatenate([np.zeros(int(0.37 * sr)), a]) + rng.normal(0, 200, len(a) + int(0.37 * sr)))
        self.assertAlmostEqual(off, 0.37, places=4)
        self.assertGreater(conf, 0.9)
        off, conf = run(a[int(0.0213 * sr):])
        self.assertAlmostEqual(off, -0.0213, places=4)
        off, conf = run(rng.normal(0, 3000, len(a)))
        self.assertLess(conf, 0.2)

    def test_setup_in_background(self):
        # המנועים חסרים: run מפעיל את ההתקנה ברקע, prepare מחכה לה — בלי פעולה של המשתמש
        ready = self.tmp / 'ready'
        setup = self.tmp / 'setup.sh'
        setup.write_text('echo "[$SNB_SETUP_NO_SETTINGS]" >> "%s.env"; sleep 2; touch "%s"\n' % (ready, ready))
        env = {'FAKE_READY': str(ready), 'SNB_SETUP': 'bash ' + str(setup)}
        code, out = self.job('run', '--job', JOB, '--key', KEY, '--server', self.base, '--drive-api', self.base + '/drive/v3', env=env)
        self.assertEqual(code, 0, out)
        self.assertIn('ברקע', out)
        self.assertFalse(ready.exists(), 'run לא מחכה להתקנה')
        code, out = self.job('prepare', env=env)
        self.assertEqual(code, 0, out)
        self.assertTrue(ready.exists())
        self.assertEqual(Path(str(ready) + '.env').read_text().split(), ['[1]'], 'ההתקנה מתוך העבודה לא כותבת את הגדרות הסשן')
        self.assertTrue((self.tmp / 'state' / 'setup.pid').exists(), 'ההתקנה הופעלה ברקע כבר ב־run')
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()]
        self.assertEqual(cmds[0], 'new', 'vt רץ רק אחרי שההתקנה הסתיימה')

    def test_ask_answered(self):
        # שאלה באמצע העבודה: נשלחת לשרתון עם התשובות המוכנות, והתשובה מהטלפון היא השורה האחרונה בפלט
        self.assertEqual(self.take()[0], 0)
        self.fake.answer, self.fake.answer_after = 'ביל אקמאן', 2
        code, out = self.job('ask', '--q', 'איך כותבים את שם הדובר?', '--opt', 'ביל אקמן', '--opt', 'ביל אקמאן', '--default', '1',
                             env={'SNB_ASK_POLL': '0.1'})
        self.assertEqual(code, 0, out)
        ask = next(r['ask'] for r in self.fake.reports if r.get('ask'))
        self.assertRegex(ask['id'], r'^q[a-z0-9]{1,12}$')
        self.assertEqual((ask['o'], ask['d'], ask['w']), (['ביל אקמן', 'ביל אקמאן'], 1, 480))
        self.assertEqual(out.strip().splitlines()[-1], 'תשובה: ביל אקמאן')

    def test_ask_timeout(self):
        # לא ענו בזמן → ברירת המחדל, ודיווח לשרתון (הטלפון מפסיק להציג שאלה פתוחה)
        self.assertEqual(self.take()[0], 0)
        code, out = self.job('ask', '--q', 'לתרגם את שם התוכנית?', '--opt', 'כן', '--opt', 'לא', '--default', '1', '--wait', '60',
                             env={'SNB_ASK_POLL': '0.1', 'SNB_ASK_WAIT_SCALE': '0.01'})
        self.assertEqual(code, 0, out)
        self.assertEqual(out.strip().splitlines()[-1], 'ברירת מחדל: לא')
        self.assertTrue(any(r.get('askTimeout') for r in self.fake.reports))

    def test_ask_limit(self):
        # השרתון לא מקבל עוד שאלות → מחליטים לבד, בלי ניסיונות חוזרים
        self.assertEqual(self.take()[0], 0)
        self.fake.ask_limit = True
        code, out = self.job('ask', '--q', 'עוד שאלה?')
        self.assertEqual(code, 0, out)
        self.assertEqual(out.strip().splitlines()[-1], 'אין תשובה — להחליט לבד')

    def test_norm_saved(self):
        # v363: "הרגיל" מהשרתון נשמר בקובץ המצב — מגדל הפיקוח קורא אותו משם
        self.fake.nm = {'ph': 3.2, 'mx': 4.1, 'n': 5}
        code, out = self.take()
        self.assertEqual(code, 0, out)
        st = json.loads((self.tmp / 'state' / 'job.json').read_text())
        self.assertEqual(st['nm'], {'ph': 3.2, 'mx': 4.1, 'n': 5})
        self.fake.nm = 'junk'
        self.take()
        self.assertIsNone(json.loads((self.tmp / 'state' / 'job.json').read_text())['nm'], 'לא תקין — בלי')

    def test_fixbook_resume(self):
        # v364: המשך אחרי עצירה של המגדל — בלי תיקון רשום: מבקשים אבחון ו־fix; עם תיקון: מדפיסים אותו
        self.fake.ls = {'fp': 'a1b2c3d4e5f6', 'why': 'loop', 'st': 'tl'}
        code, out = self.take()
        self.assertEqual(code, 0, out)
        self.assertIn('נעצרה בפעם הקודמת במגדל הפיקוח', out)
        self.assertIn('job.py fix --text', out)
        code, out = self.job('fix', '--text', 'ok')
        self.assertEqual(code, 1, 'קצר מדי')
        code, out = self.job('fix', '--text', 'מפצלים\nכתובית ארוכה לשתיים')
        self.assertEqual(code, 0, out)
        self.assertEqual(self.fake.reports[-1]['fix'], {'fp': 'a1b2c3d4e5f6', 't': 'מפצלים כתובית ארוכה לשתיים'})
        self.fake.fb = [{'fp': 'a1b2c3d4e5f6', 'why': 'loop', 'st': 'tl', 'fix': 'מפצלים כתובית ארוכה לשתיים'}, {'fp': 'bad', 'why': 'loop', 'fix': 'x'}]
        code, out = self.take()
        self.assertIn('«מפצלים כתובית ארוכה לשתיים»', out)
        st = json.loads((self.tmp / 'state' / 'job.json').read_text())
        self.assertEqual([e['fp'] for e in st['fb']], ['a1b2c3d4e5f6'], 'רק רשומות תקינות')
        self.fake.ls = None
        self.take()
        code, out = self.job('fix', '--text', 'משהו ארוך מספיק')
        self.assertEqual(code, 1, 'בלי עצירה — אין למה לרשום')

    def test_fix_mode(self):
        # v366: מסלול "הצעות לאישור" (ברירת המחדל) — ההודעה אומרת שהתיקון ממתין למשתמש; "עצמאי" — שהוא נרשם
        self.fake.ls = {'fp': 'a1b2c3d4e5f6', 'why': 'loop', 'st': 'tl'}
        self.take()
        self.assertEqual(json.loads((self.tmp / 'state' / 'job.json').read_text())['fm'], 'suggest', 'בלי מסלול מהשרתון — הצעות')
        code, out = self.job('fix', '--text', 'מריצים פעם אחת')
        self.assertEqual(code, 0, out)
        self.assertIn('כהצעה', out)
        self.fake.fm = 'auto'
        self.take()
        code, out = self.job('fix', '--text', 'מריצים פעם אחת')
        self.assertIn('נרשם בספר התיקונים', out)
        self.assertNotIn('כהצעה', out)
        self.fake.fm = 'evil'
        self.take()
        self.assertEqual(json.loads((self.tmp / 'state' / 'job.json').read_text())['fm'], 'suggest', 'לא מוכר — הצעות')

    def test_rules_saved(self):
        # v367: החוקים מהשרתון נשמרים בקובץ המצב (למגדל ול־finish); לא תקין — כאילו אין חוק
        self.fake.rl, self.fake.bx, self.fake.u0 = {'b': 12.5, 'ab': True, 'mx': 'opus-high'}, 2, 7.25
        self.take()
        st = json.loads((self.tmp / 'state' / 'job.json').read_text())
        self.assertEqual((st['rl'], st['bx'], st['u0']), ({'b': 12.5, 'ab': True}, 2, 7.25))
        self.fake.rl, self.fake.bx, self.fake.u0 = {'b': 'evil', 'ab': 'yes'}, -1, 'x'
        self.take()
        st = json.loads((self.tmp / 'state' / 'job.json').read_text())
        self.assertEqual((st['rl'], st['bx'], st['u0']), ({'b': 0.0, 'ab': False}, 0, 0.0))

    def finish_with_gate(self, ans, env=None):
        self.fake.rl, self.fake.gate_ans = {'b': 0, 'ab': True}, ans
        self.take()
        self.assertEqual(self.job('prepare')[0], 0)
        self.assertEqual(self.job('align')[0], 0)
        code, out = self.job('finish', env=dict({'SNB_GATE_POLL': '0.05'}, **(env or {})))
        self.assertEqual(code, 0, out)
        gates = [r['gate'] for r in self.fake.reports if r.get('gate')]
        self.assertEqual(len(gates), 1)
        self.assertEqual((gates[0]['k'], gates[0]['cnt'], gates[0]['cues']), ('r', 1, [{'t': '0:00', 'x': 'שלום'}]), 'כתוביות לדוגמה מ־he.srt')
        cmds = [l.split()[0] for l in (self.tmp / 'vt.log').read_text().splitlines()]
        kinds = [o['k'] for o in self.fake.reports[-1]['out']]
        return out, cmds, kinds

    def test_render_gate_go(self):
        # v367: אישור לפני צריבה — "לצרוב": צורבים כרגיל
        out, cmds, kinds = self.finish_with_gate('go')
        self.assertIn('render', cmds)
        self.assertEqual(kinds, ['compact', 'srt'])

    def test_render_gate_stop(self):
        # "רק קובץ כתוביות": בלי צריבה — רק he.srt עולה
        out, cmds, kinds = self.finish_with_gate('stop')
        self.assertNotIn('render', cmds)
        self.assertEqual(kinds, ['srt'])
        self.assertIn('בלי צריבה', out)

    def test_render_gate_timeout(self):
        # בלי תשובה בזמן: השרתון מקבל askTimeout (ברירת המחדל) — רק כתוביות
        out, cmds, kinds = self.finish_with_gate(None, env={'SNB_ASK_WAIT_SCALE': '0.0002'})
        self.assertNotIn('render', cmds)
        self.assertEqual(kinds, ['srt'])
        self.assertTrue(any(r.get('askTimeout', '').startswith('g') for r in self.fake.reports))

    def test_gate_cmd(self):
        # v367: job.py gate — מחכה לתשובה לשער התקציב שהמגדל פתח
        self.take()
        code, out = self.job('gate')
        self.assertIn('אין אישור שממתין', out)
        self.fake.qa, self.fake.gate_ans = {'id': 'g000000000001', 'g': 'b', 'a': None}, 'go'
        code, out = self.job('gate', env={'SNB_GATE_POLL': '0.05'})
        self.assertEqual(code, 0, out)
        self.assertIn('אישר להמשיך', out)
        self.fake.qa, self.fake.gate_ans = {'id': 'g000000000002', 'g': 'b', 'a': None}, 'stop'
        code, out = self.job('gate', env={'SNB_GATE_POLL': '0.05'})
        self.assertIn('בחר לעצור', out)
        self.assertEqual(self.fake.reports[-1].get('err'), 'budget_stop')
        self.fake.qa, self.fake.gate_ans = {'id': 'g000000000003', 'g': 'b', 'a': None}, None
        code, out = self.job('gate', env={'SNB_GATE_POLL': '0.05', 'SNB_GATE_WAIT': '0.2'})
        self.assertIn('עדיין מחכה', out)

    def test_srt_samples(self):
        sys.path.insert(0, str(HERE))
        import job as J
        p = self.tmp / 's.srt'
        p.write_text('\ufeff' + '\n\n'.join('%d\n%02d:%02d:05,000 --> %02d:%02d:07,000\n<i>שורה %d</i>\n{\\an8}שנייה' % (i + 1, i // 60, i % 60, i // 60, i % 60, i)
                                            for i in range(12)) + '\n', encoding='utf-8')
        cues, n = J.srt_samples(p)
        self.assertEqual(n, 12)
        self.assertEqual([c['x'] for c in cues], ['שורה 0 שנייה', 'שורה 3 שנייה', 'שורה 6 שנייה', 'שורה 8 שנייה', 'שורה 11 שנייה'])
        self.assertEqual(cues[0]['t'], '0:05')
        self.assertEqual(J.srt_samples(self.tmp / 'none.srt'), ([], 0))

    def test_ops_events(self):
        # v365: אירועים למגדל הפיקוח — Drive שהתאושש אחרי ניתוק (ok), ו־vt שנכשל (תמלול) — רק סוגים מהקטלוג, בלי טקסט
        self.fake.audio = False                                        # בלי קול — prepare מוריד את הסרטון (שם הניתוק המדומה)
        self.take()
        code, out = self.job('prepare', env={'FAKE_FAIL': 'asr'})
        self.assertNotEqual(code, 0, out)
        evs = [e for r in self.fake.reports for e in (r.get('ev') or [])]
        self.assertIn({'c': 'drive', 'k': 'dl_retry', 'ok': True}, evs, 'ההורדה נקטעה וחזרה — סוגרים את ההתראה')
        self.assertIn({'c': 'vt', 'k': 'asr', 'ok': False}, evs)
        self.assertTrue(all(set(e) == {'c', 'k', 'ok'} for e in evs))

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
        self.assertNotIn('usage', self.fake.reports[-1], 'בלי יומנים — בלי usage')

    # ---------------------------------------------------------------- v359: עלות וטוקנים
    def logs(self):
        """יומני סשן מדומים במבנה האמיתי של Claude Code: הסשן הראשי + subagents/agent-*.jsonl."""
        root = self.tmp / 'projects' / '-home-user-portfolio-pwa'
        sess = root / 'sess-1'
        (sess / 'subagents').mkdir(parents=True, exist_ok=True)

        def asst(mid, model, i, o, cr, c5, c1, part='text'):
            return {'type': 'assistant', 'message': {'id': mid, 'model': model, 'content': [{'type': part}],
                    'usage': {'input_tokens': i, 'output_tokens': o, 'cache_read_input_tokens': cr,
                              'cache_creation_input_tokens': c5 + c1,
                              'cache_creation': {'ephemeral_5m_input_tokens': c5, 'ephemeral_1h_input_tokens': c1}}}}

        def write(path, recs):
            path.write_text('\n'.join(json.dumps(r, ensure_ascii=False) if isinstance(r, dict) else r for r in recs) + '\n')

        S = 'claude-sonnet-5-5'
        write(root / 'sess-1.jsonl', [
            {'type': 'user', 'message': {'content': 'routine-fire-payload'}},
            asst('msg_A', S, 10, 100, 0, 0, 20000, 'thinking'),       # אותה הודעה שלוש פעמים (חשיבה, טקסט, כלי)
            asst('msg_A', S, 10, 100, 0, 0, 20000, 'text'),
            asst('msg_A', S, 10, 100, 0, 0, 20000, 'tool_use'),
            asst('msg_B', S, 2, 50, 20000, 0, 1000),
            {'type': 'assistant', 'message': {'id': 'msg_X', 'model': '<synthetic>', 'usage': {'input_tokens': 999, 'output_tokens': 999}}},
            'not json {',
        ])
        O = 'claude-opus-5-5'
        write(sess / 'subagents' / 'agent-a1.jsonl', [
            {'type': 'user', 'isSidechain': True, 'message': {'content': 'תרגם את העבודה לפי translator/TRANSLATE.md. הפרויקט: /x'}},
            {'type': 'user', 'message': {'content': 'שומר: REVIEW.md'}},    # רק ההנחיה הראשונה קובעת
            asst('msg_T1', O, 3, 1000, 0, 120000, 0),
            asst('msg_T1', O, 3, 1000, 0, 120000, 0),
            asst('msg_T2', O, 1, 4000, 120000, 5000, 0),
        ])
        write(sess / 'subagents' / 'agent-b2.jsonl', [
            {'type': 'user', 'message': {'content': [{'type': 'text', 'text': 'בקר לפי translator/REVIEW.md. הפרויקט: /x'}]}},
            asst('msg_R1', 'claude-sonnet-5-5', 2, 500, 0, 100000, 0),
        ])
        write(sess / 'subagents' / 'agent-c3.jsonl', [
            {'type': 'user', 'message': {'content': 'חפש משהו'}},
            asst('msg_H1', 'claude-mystery-9', 1, 1, 0, 1000, 0),
        ])
        return self.tmp / 'projects'

    def test_usage(self):
        sys.path.insert(0, str(HERE))
        import job as J
        rows = J.usage(self.logs())
        self.assertEqual([r['k'] for r in rows], ['main', 'tl', 'rv', 'sub'])
        main, tl, rv, sub = rows
        # הסשן הראשי: msg_A פעם אחת (לא שלוש), msg_B, בלי <synthetic> ובלי השורה השבורה
        self.assertEqual((main['n'], main['i'], main['o'], main['cr'], main['c5'], main['c1']), (2, 12, 150, 20000, 0, 21000))
        self.assertAlmostEqual(main['usd'], (12 * 2 + 150 * 10 + 20000 * 0.1 + 21000 * 2 * 2) / 1e6, places=4)
        self.assertNotIn('op', main, 'לסשן הראשי אין "עלות פתיחה"')
        # התרגום: לפי TRANSLATE.md בהנחיה הראשונה; msg_T1 פעם אחת
        self.assertEqual((tl['m'], tl['n'], tl['o'], tl['c5'], tl['cr']), ('claude-opus-5-5', 2, 5000, 125000, 120000))
        self.assertAlmostEqual(tl['usd'], (4 * 4 + 5000 * 20 + 120000 * 0.2 + 125000 * 4 * 1.25) / 1e6, places=4)
        self.assertEqual(tl['op'], 120000, 'עלות הפתיחה = הכתיבה למטמון בקריאה הראשונה')
        self.assertAlmostEqual(tl['oc'], 120000 * 4 * 1.25 / 1e6, places=4)
        self.assertEqual((rv['m'], rv['op']), ('claude-sonnet-5-5', 100000))
        self.assertAlmostEqual(rv['oc'], 100000 * 2 * 1.25 / 1e6, places=4)
        # מודל לא מוכר — בלי מחיר
        self.assertEqual((sub['m'], sub['usd'], sub['oc'], sub['op']), ('claude-mystery-9', None, None, 1000))
        self.assertEqual(J.usage(self.tmp / 'nothing'), [])
        self.assertIsNone(J.price_of('gpt-4o'))
        self.assertEqual(J.price_of('claude-opus-5-5[1m]'), J.PRICES['claude-opus-5-5'])
        self.assertEqual(J.PRICES['claude-sonnet-5-5'][2], 0.10, 'Sonnet 5.5: קריאה מהמטמון = 0.05× מהקלט')
        self.assertEqual(J.PRICES['claude-haiku-5-5'], (0.10, 0.50, 0.01))

    def test_usage_merge_max6(self):
        sys.path.insert(0, str(HERE))
        import job as J
        root = self.logs()
        subs = next(root.rglob('subagents'))
        src = (subs / 'agent-a1.jsonl').read_text()
        for n in range(6):                         # עוד שישה מתרגמים (ניסיונות חוזרים) — יותר מ־6 שורות
            (subs / ('agent-x%d.jsonl' % n)).write_text(src.replace('msg_T', 'msg_T%d_' % n))
        rows = J.usage(root)
        self.assertLessEqual(len(rows), 6)
        tl = [r for r in rows if r['k'] == 'tl']
        self.assertEqual(len(tl), 1, 'מאוחדים לפי סוג ומודל')
        self.assertEqual(tl[0]['n'], 14)
        self.assertEqual(tl[0]['op'], 7 * 120000)

    def test_finish_and_fail_send_usage(self):
        self.logs()
        self.assertEqual(self.take()[0], 0)
        self.assertEqual(self.job('prepare')[0], 0)
        self.assertEqual(self.job('align')[0], 0)
        code, out = self.job('finish')
        self.assertEqual(code, 0, out)
        last = self.fake.reports[-1]
        self.assertTrue(last.get('done'))
        self.assertEqual([r['k'] for r in last['usage']], ['main', 'tl', 'rv', 'sub'], 'finish שולח usage בדיווח האחרון')
        code, out = self.job('fail', '--err', 'stuck')
        self.assertEqual(code, 0, out)
        self.assertTrue(self.fake.reports[-1].get('fail') and self.fake.reports[-1].get('usage'), 'גם fail שולח usage')

    def test_missing_module_named(self):
        # ההתקנה לא הצליחה: ההודעה אומרת בדיוק איזה מודול חסר
        env = {'FAKE_READY': str(self.tmp / 'never'), 'SNB_SETUP': 'true'}
        code, out = self.job('run', '--job', JOB, '--key', KEY, '--server', self.base, '--drive-api', self.base + '/drive/v3', env=env)
        self.assertEqual(code, 0, out)
        code, out = self.job('prepare', env=env)
        self.assertNotEqual(code, 0)
        self.assertIn('חסרים: qwen_asr', out)
        self.assertIn('setup.log', out)

    def test_one_module_list(self):
        sys.path.insert(0, str(HERE))
        import job as J
        mods = J.engine_modules()
        self.assertEqual(mods, ['numpy', 'soundfile', 'onnx_asr', 'torch', 'torchaudio', 'qwen_asr'])
        sh = (HERE / 'setup.sh').read_text()
        self.assertNotIn('import numpy, soundfile', sh, 'בלי רשימה כפולה ב־setup.sh')
        self.assertNotIn("'import numpy", (HERE / 'job.py').read_text(), 'בלי רשימה כפולה ב־job.py')


if __name__ == '__main__':
    unittest.main()
