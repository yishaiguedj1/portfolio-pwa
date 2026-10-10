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

    # --- השרתון
    def call(self, op, **kw):
        self.calls.append(op)
        if op == 'r2get':
            self.ver += 1
            return {'ok': True, 'url': 'https://r2.test/get?v=%d' % self.ver, 'size': len(self.src)}
        if op == 'r2wup':
            if self.obj is not None and len(self.obj) == kw['size']:
                return {'ok': True, 'file': {'size': kw['size']}}
            self.up, self.parts, self.size = 'u%d' % len(self.calls), {}, kw['size']
            return self._state()
        if op == 'r2wparts':
            if kw['up'] != self.up:
                return {'ok': False, 'error': 'r2_gone'}
            return self._state()
        if op == 'r2wdone':
            n = -(-self.size // self.ps)
            if sorted(self.parts) != list(range(1, n + 1)):
                return {'ok': False, 'error': 'r2_parts'}
            self.obj = b''.join(self.parts[i] for i in range(1, n + 1))
            return {'ok': True, 'file': {'size': len(self.obj)}}
        return {'ok': False, 'error': 'bad_op'}

    def _state(self):
        n = -(-self.size // self.ps)
        miss = [i for i in range(1, n + 1) if i not in self.parts]
        return {'ok': True, 'up': self.up, 'ps': self.ps, 'done': sorted(self.parts),
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
        out = store.download(r.call, 'v', dest, opener=r.opener, sleep=lambda s: None)
        self.assertEqual(out.read_bytes(), src)
        self.assertEqual(r.calls.count('r2get'), 1, 'ניתוק לא מבקש קישור חדש — רק ממשיך')

    def test_download_expired_link_refreshes(self):
        src = b'x' * 100
        r = FakeR2(src)
        r.expire_get = 3                   # הקישור הראשון כבר פג
        dest = self.d / 'v'
        store.download(r.call, 'v', dest, opener=r.opener, sleep=lambda s: None)
        self.assertEqual(dest.read_bytes(), src)
        self.assertEqual(r.calls.count('r2get'), 2)

    def test_download_error_from_server(self):
        with self.assertRaises(store.StoreError) as e:
            store.download(lambda op, **k: {'ok': False, 'error': 'not_ready'}, 'v', self.d / 'x', sleep=lambda s: None)
        self.assertEqual(e.exception.code, 'not_ready')

    def test_upload_parts_with_failure(self):
        data = os.urandom(8 * 7 + 3)       # 8 חלקים של 8 בייטים (האחרון 3)
        p = self.d / 'he.srt'
        p.write_bytes(data)
        r = FakeR2(ps=8)
        r.fail_put = {2, 5}
        prog = []
        size = store.upload(r.call, p, 'o:he.srt', 'text/plain', on_progress=prog.append, opener=r.opener, sleep=lambda s: None)
        self.assertEqual(size, len(data))
        self.assertEqual(r.obj, data)
        self.assertEqual(prog[-1], 1.0)
        self.assertTrue(all(len(v) == 8 for k, v in r.parts.items() if k < 8))

    def test_upload_already_done(self):
        data = b'abc'
        p = self.d / 'x'
        p.write_bytes(data)
        r = FakeR2(ps=8)
        r.obj = data
        self.assertEqual(store.upload(r.call, p, 'o:x', opener=r.opener, sleep=lambda s: None), 3)
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
        store.upload(call, p, 'o:y', opener=r.opener, sleep=lambda s: None)
        self.assertEqual(r.obj, data)

    def test_upload_fatal(self):
        p = self.d / 'z'
        p.write_bytes(b'1')
        with self.assertRaises(store.StoreError):
            store.upload(lambda op, **k: {'ok': False, 'error': 'forbidden'}, p, 'v', sleep=lambda s: None)


if __name__ == '__main__':
    unittest.main()
