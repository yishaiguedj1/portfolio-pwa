"""ת4: העובד מול R2 (translator/store.py) — הורדה עם המשך וקישור שפג, העלאה בחלקים עם ניתוק והמשך.
R2 והשרתון מדומים בזיכרון; בלי רשת."""
import io
import os
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import store  # noqa: E402


class _Resp(io.BytesIO):
    def __init__(self, data, status=200):
        super().__init__(data)
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()


def _http_error(url, code):
    return urllib.error.HTTPError(url, code, 'x', {}, io.BytesIO(b''))


class FakeR2:
    """שרתון + R2: הורדה לפי טווח, העלאה בחלקים קבועים (ps), קישורים עם "תוקף" (מונה)"""

    def __init__(self, src=b'', ps=8):
        self.src, self.ps, self.ver = src, ps, 1
        self.parts, self.up, self.obj = {}, '', None
        self.calls, self.fail_put, self.cut_get, self.expire_get = [], set(), 0, 0
        self.fid, self.ups, self.deleted = '', [], []

    # --- השרתון
    def call(self, op, **kw):
        self.calls.append(op)
        if op == 'r2get':
            self.ver += 1
            return {'ok': True, 'url': 'https://r2.test/get?v=%d' % self.ver, 'size': len(self.src)}
        if op == 'r2wup':
            if self.obj is not None and len(self.obj) == kw['size'] and not kw.get('replace'):
                return {'ok': True, 'id': self.fid, 'file': {'size': kw['size']}}
            self.ups.append(dict(kw))
            self.fid = kw.get('id') or self.fid or 'R2_j' + 'A' * 20 + '_abcdefghijkl'
            self.up, self.parts, self.size = 'u%d' % len(self.calls), {}, kw['size']
            return self._state()
        if op == 'r2wparts':
            if kw['up'] != self.up or kw['id'] != self.fid:
                return {'ok': False, 'error': 'r2_gone'}
            return self._state()
        if op == 'r2wdone':
            n = -(-self.size // self.ps)
            if sorted(self.parts) != list(range(1, n + 1)):
                return {'ok': False, 'error': 'r2_parts'}
            self.obj = b''.join(self.parts[i] for i in range(1, n + 1))
            return {'ok': True, 'id': self.fid, 'file': {'size': len(self.obj)}}
        if op == 'r2del':
            self.deleted.append(kw['id'])
            return {'ok': True}
        return {'ok': False, 'error': 'bad_op'}

    def _state(self):
        n = -(-self.size // self.ps)
        miss = [i for i in range(1, n + 1) if i not in self.parts]
        return {'ok': True, 'id': self.fid, 'up': self.up, 'ps': self.ps, 'done': sorted(self.parts),
                'urls': {str(i): 'https://r2.test/put?up=%s&n=%d' % (self.up, i) for i in miss[:3]}}

    # --- R2 (opener של urllib)
    def opener(self, req, timeout=0):
        url = req.full_url.replace('https://r2.test/', '')
        if url.startswith('get?'):
            if self.expire_get and int(url.split('=')[1]) < self.expire_get:
                raise _http_error(url, 403)
            rng = req.get_header('Range') or ''
            start = int(rng.split('=')[1].rstrip('-')) if rng else 0
            data = self.src[start:]
            if self.cut_get:                       # ניתוק באמצע: רק חלק מהבייטים ואז שגיאה
                self.cut_get -= 1
                class Cut(_Resp):
                    def read(s, n=-1):
                        b = _Resp.read(s, 5)
                        if not b:
                            raise OSError('reset')
                        return b
                return Cut(data[:7], 206 if rng else 200)
            return _Resp(data, 206 if rng else 200)
        if url.startswith('put?'):
            up = url.split('up=')[1].split('&')[0]
            n = int(url.split('n=')[1])
            if n in self.fail_put:
                self.fail_put.discard(n)
                raise urllib.error.URLError('net')
            if up != self.up:
                raise _http_error(url, 404)
            self.parts[n] = req.data
            return _Resp(b'', 200)
        raise _http_error(url, 400)


class TestStore(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())

    def test_download_resume_and_expired_link(self):
        src = bytes(range(256)) * 3
        r = FakeR2(src)
        r.cut_get = 2                      # שתי הורדות שנקטעות באמצע
        dest = self.d / 'in' / 'video'
        out = store.download(r.call, 'R2_j' + 'A' * 20 + '_vvvvvvvvvvvv', dest, opener=r.opener, sleep=lambda s: None)
        self.assertEqual(out.read_bytes(), src)
        self.assertEqual(r.calls.count('r2get'), 1, 'ניתוק לא מבקש קישור חדש — רק ממשיך')

    def test_download_expired_link_refreshes(self):
        src = b'x' * 100
        r = FakeR2(src)
        r.expire_get = 3                   # הקישור הראשון כבר פג
        dest = self.d / 'v'
        store.download(r.call, 'R2_j' + 'A' * 20 + '_vvvvvvvvvvvv', dest, opener=r.opener, sleep=lambda s: None)
        self.assertEqual(dest.read_bytes(), src)
        self.assertEqual(r.calls.count('r2get'), 2)

    def test_download_error_from_server(self):
        with self.assertRaises(store.StoreError) as e:
            store.download(lambda op, **k: {'ok': False, 'error': 'not_ready'}, 'R2_j' + 'A' * 20 + '_vvvvvvvvvvvv', self.d / 'x', sleep=lambda s: None)
        self.assertEqual(e.exception.code, 'not_ready')

    def test_upload_parts_with_failure(self):
        data = os.urandom(8 * 7 + 3)       # 8 חלקים של 8 בייטים (האחרון 3)
        p = self.d / 'he.srt'
        p.write_bytes(data)
        r = FakeR2(ps=8)
        r.fail_put = {2, 5}
        prog = []
        fid = store.upload(r.call, p, 'text/plain', name='he.srt', on_progress=prog.append, opener=r.opener, sleep=lambda s: None)
        self.assertEqual(fid, r.fid)
        self.assertEqual(r.ups[0]['name'], 'he.srt')
        self.assertEqual(r.obj, data)
        self.assertEqual(prog[-1], 1.0)
        self.assertTrue(all(len(v) == 8 for k, v in r.parts.items() if k < 8))

    def test_upload_parts_in_parallel(self):
        """22/10/2026: חלקים במקביל (UP_PAR) — התוכן זהה, וכמה חלקים באוויר באותו רגע"""
        import threading
        data = os.urandom(8 * 12)
        p = self.d / 'big.mp4'
        p.write_bytes(data)
        r = FakeR2(ps=8)
        lock, live, peak = threading.Lock(), [0], [0]
        orig = r.opener

        def opener(req, *a, **k):
            if 'put?' not in str(getattr(req, 'full_url', req)):
                return orig(req, *a, **k)
            with lock:
                live[0] += 1
                peak[0] = max(peak[0], live[0])
            try:
                import time as _t
                _t.sleep(0.02)
                return orig(req, *a, **k)
            finally:
                with lock:
                    live[0] -= 1
        store.upload(r.call, p, opener=opener, sleep=lambda s: None)
        self.assertEqual(r.obj, data)
        self.assertGreater(peak[0], 1, 'יותר מחלק אחד באוויר')

    def test_upload_already_done(self):
        data = b'abc'
        p = self.d / 'x'
        p.write_bytes(data)
        r = FakeR2(ps=8)
        r.obj, r.fid = data, 'R2_j' + 'A' * 20 + '_xxxxxxxxxxxx'
        self.assertEqual(store.upload(r.call, p, opener=r.opener, sleep=lambda s: None), r.fid)
        self.assertEqual(r.calls, ['r2wup'])

    def test_upload_gone_restarts(self):
        data = os.urandom(20)
        p = self.d / 'y'
        p.write_bytes(data)
        r = FakeR2(ps=8)
        orig = r.call
        state = {'n': 0}

        def call(op, **kw):
            if op == 'r2wparts' and state['n'] == 0:   # ההעלאה פגה באמצע
                state['n'] = 1
                return {'ok': False, 'error': 'r2_gone'}
            return orig(op, **kw)
        store.upload(call, p, opener=r.opener, sleep=lambda s: None)
        self.assertEqual(r.obj, data)

    def test_upload_fatal(self):
        p = self.d / 'z'
        p.write_bytes(b'1')
        with self.assertRaises(store.StoreError):
            store.upload(lambda op, **k: {'ok': False, 'error': 'forbidden'}, p, sleep=lambda s: None)

    def test_upload_replace_keeps_id(self):
        """איכויות הצפייה: תוכן חדש לאותו קובץ — אותו מזהה, גם כשהגודל זהה"""
        old = 'R2_j' + 'A' * 20 + '_oooooooooooo'
        p = self.d / 'packed'
        p.write_bytes(b'12345678901')
        r = FakeR2(ps=8)
        r.obj, r.fid = b'x' * 11, old
        self.assertEqual(store.upload(r.call, p, 'video/mp4', replace=old, opener=r.opener, sleep=lambda s: None), old)
        self.assertEqual(r.obj, b'12345678901')
        self.assertTrue(r.ups[0]['replace'] and r.ups[0]['id'] == old)

    def test_delete(self):
        r = FakeR2()
        self.assertTrue(store.delete(r.call, 'R2_j' + 'A' * 20 + '_dddddddddddd'))
        self.assertEqual(r.deleted, ['R2_j' + 'A' * 20 + '_dddddddddddd'])
        self.assertFalse(store.delete(lambda op, **k: (_ for _ in ()).throw(OSError('x')), 'x'))


class TestJobRouting(unittest.TestCase):
    """job.py: fetch_input / put_output בוחרים R2 או Drive — לפי המזהה (קריאה) ולפי התיקייה של העבודה (כתיבה)"""

    def setUp(self):
        import job
        self.job = job
        self.d = Path(tempfile.mkdtemp())
        self.r = FakeR2(src=b'video-bytes', ps=8)

        class C:
            def __init__(s, r):
                s.r = r

            def raw(s, op, **kw):
                return s.r.call(op, **kw)

        class Ctx:
            def __init__(s, folder, r):
                s.st, s.c, s.events = {'folder': folder}, C(r), []

            def event(s, *a, **k):
                s.events.append(a)
        self.Ctx = Ctx
        self.calls = []
        self._dd, self._du = job.drive_download, job.drive_upload
        job.drive_download = lambda *a, **k: self.calls.append('drive_dl')
        job.drive_upload = lambda *a, **k: self.calls.append('drive_up') or 'DRIVEID1234'
        self._open = store._open
        store._open = lambda req, timeout, opener=None: self.r.opener(req, timeout)

    def tearDown(self):
        self.job.drive_download, self.job.drive_upload = self._dd, self._du
        store._open = self._open

    def test_routing(self):
        J = self.job
        r2f = 'R2_j' + 'A' * 20
        ctx = self.Ctx(r2f, self.r)
        dest = self.d / 'v.mp4'
        J.fetch_input(ctx, r2f + '_vvvvvvvvvvvv', dest, 11)
        self.assertEqual(dest.read_bytes(), b'video-bytes')
        J.fetch_input(ctx, '1DriveFileIdAbc', dest, 11)              # מקור מ־Drive (Picker) בעבודה של R2
        self.assertEqual(self.calls, ['drive_dl'])
        p = self.d / 'he.srt'
        p.write_bytes(b'subtitle-file')
        fid = J.put_output(ctx, p, 'he.srt', 'srt', 'application/x-subrip')
        self.assertTrue(J.is_r2_id(fid) or fid.startswith('R2_'))
        self.assertEqual(self.r.obj, b'subtitle-file')
        ctx2 = self.Ctx('1DriveFolderIdXYZ', self.r)                # עבודה של Drive
        self.assertEqual(J.put_output(ctx2, p, 'he.srt', 'srt', 'application/x-subrip'), 'DRIVEID1234')
        self.assertEqual(self.calls, ['drive_dl', 'drive_up'])
        self.assertTrue(J.drive_delete(ctx, r2f + '_cccccccccccc'))
        self.assertEqual(self.r.deleted, [r2f + '_cccccccccccc'])

    def test_r2_failure_is_clear(self):
        J = self.job
        ctx = self.Ctx('R2_j' + 'A' * 20, self.r)
        ctx.c.raw = lambda op, **kw: {'ok': False, 'error': 'r2_off'}
        with self.assertRaises(SystemExit) as e:
            J.fetch_input(ctx, 'R2_j' + 'A' * 20 + '_vvvvvvvvvvvv', self.d / 'x', 5)
        self.assertIn('r2_off', str(e.exception))
        self.assertEqual(ctx.events[-1], ('drive', 'dl_fail'))

    def test_store_codes(self):
        """11/10/2026 (r2_size בעבודה אמיתית): כשל אחסון מדווח בקוד משלו — store_net חולף, store_fail קבוע"""
        J = self.job
        self.assertEqual(J.store_err('r2_up_net'), 'store_net')
        self.assertEqual(J.store_err('r2_dl_net'), 'store_net')
        self.assertEqual(J.store_err('r2_gone'), 'store_net')
        for c in ('r2_size', 'r2_up_400', 'too_big', 'bad_id', 'r2_off'):
            self.assertEqual(J.store_err(c), 'store_fail', c)
        ctx = self.Ctx('R2_j' + 'A' * 20, self.r)
        ctx.c.raw = lambda op, **kw: {'ok': False, 'error': 'r2_size'}
        p = self.d / 'cues.json'
        p.write_bytes(b'{}')
        with self.assertRaises(J.StepError) as e:
            J.put_output(ctx, p, 'cues.json', 'cues', 'application/json')
        self.assertEqual(e.exception.err, 'store_fail')
        self.assertIn('r2_size', str(e.exception))
        self.assertIsInstance(e.exception, SystemExit, 'עדיין SystemExit — מי שתופס SystemExit (נקודות שמירה, איכויות) לא משתנה')

    def test_auto_reports_step_code(self):
        """auto(): כשל אחסון מדווח בקוד שלו (store_fail / store_net) והסיבה — לא worker_step"""
        J = self.job
        import pipeline
        got = []

        class FakeCtx:
            def __init__(s, st):
                pass

            def report(s, **k):
                got.append(k)
        old = (J.Ctx, J.load_state, pipeline.run_auto, J.usage_safe, J.trace_safe)
        try:
            J.Ctx, J.load_state = FakeCtx, (lambda: {})
            J.usage_safe = J.trace_safe = lambda: None

            def boom(*a, **k):
                raise J.StepError('✗ ההעלאה לאחסון נכשלה (r2_size).', 'store_fail')
            pipeline.run_auto = boom
            self.assertEqual(J.auto(None), 1)
            self.assertEqual(got[-1]['err'], 'store_fail')
            self.assertIn('r2_size', got[-1]['msg'])

            def boom2(*a, **k):
                raise SystemExit('✗ השרתון לא עונה (x)')
            pipeline.run_auto = boom2
            self.assertEqual(J.auto(None), 1)
            self.assertEqual(got[-1]['err'], 'worker_step', 'כשל כללי — כמו קודם')
        finally:
            J.Ctx, J.load_state, pipeline.run_auto, J.usage_safe, J.trace_safe = old

    def test_put_output_retry(self):
        """התוצרים כבר נצרבו: ניתוק (store_net) — עוד ניסיון על אותו קובץ; דחייה (store_fail) — מיד"""
        J = self.job
        old_put, old_wait = J.put_output, J.PUT_RETRY_WAIT
        reports = []
        ctx = self.Ctx('R2_j' + 'A' * 20, self.r)
        ctx.report = lambda *a, **k: reports.append(a)
        p = self.d / 'out.mp4'
        p.write_bytes(b'x')
        try:
            J.PUT_RETRY_WAIT = (0, 0)
            seq = [J.StepError('net', 'store_net'), J.StepError('net', 'store_net'), 'IDOK']

            def put(*a, **k):
                x = seq.pop(0)
                if isinstance(x, BaseException):
                    raise x
                return x
            J.put_output = put
            self.assertEqual(J.put_output_retry(ctx, p, 'out.mp4', 'same', 'video/mp4'), 'IDOK')
            self.assertEqual(len(reports), 2, 'שורת מצב בטלפון בכל ניסיון חוזר')
            seq[:] = [J.StepError('net', 'store_net')] * 3
            with self.assertRaises(J.StepError):
                J.put_output_retry(ctx, p, 'out.mp4', 'same', 'video/mp4')
            self.assertEqual(seq, [], 'שלושה ניסיונות ואז מוותרים')
            seq[:] = [J.StepError('bad', 'store_fail'), 'NEVER']
            with self.assertRaises(J.StepError):
                J.put_output_retry(ctx, p, 'out.mp4', 'same', 'video/mp4')
            self.assertEqual(seq, ['NEVER'], 'כשל קבוע — בלי ניסיון נוסף')
        finally:
            J.put_output, J.PUT_RETRY_WAIT = old_put, old_wait


if __name__ == '__main__':
    unittest.main()
