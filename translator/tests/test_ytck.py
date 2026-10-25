"""25/10/2026: יוטיוב בשרת דרך חשבון ייעודי — העובד. fetchurl.YtCookies (רק ליוטיוב, עותק פרטי לכל הרצה, החזרה של
העוגיות המעודכנות רק באותה גרסה, דיווח הצלחה/חסימה) ו־agent.yt_sync (משיכה רק כשהגרסה השתנתה, 0600, מחיקה כשהוסר,
put ודיווח). בלי רשת ובלי yt-dlp. הרצה: python3 -m unittest tests.test_ytck (מתוך translator/)"""
import json
import os
import stat
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import fetchurl as F  # noqa: E402

CK = '# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1800000000\tSAPISID\taaa\n'


class YtCookiesTest(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())
        (self.d / 'ck.txt').write_text(CK)
        (self.d / 'ck.v').write_text('7')
        os.environ['SNB_YT_COOKIES'] = str(self.d / 'ck.txt')

    def tearDown(self):
        os.environ.pop('SNB_YT_COOKIES', None)

    def test_yt_host(self):
        for u in ('https://www.youtube.com/watch?v=x', 'https://youtu.be/x', 'https://m.youtube.com/x', 'https://www.youtube-nocookie.com/embed/x'):
            self.assertTrue(F.yt_host(u), u)
        for u in ('https://vimeo.com/1', 'https://evil-youtube.com/x', 'https://youtube.com.evil.net/x', '', 'not a url'):
            self.assertFalse(F.yt_host(u), u)

    def test_only_youtube(self):
        y = F.YtCookies('https://vimeo.com/1')
        self.assertEqual(y.args, [])
        y.done(True)
        self.assertFalse((self.d / 'ck.rep').exists())

    def test_private_copy_and_writeback(self):
        y = F.YtCookies('https://youtu.be/abc')
        self.assertEqual(y.args[0], '--cookies')
        tmp = y.args[1]
        self.assertNotEqual(tmp, str(self.d / 'ck.txt'))
        self.assertEqual(stat.S_IMODE(os.stat(tmp).st_mode), 0o600)
        Path(tmp).write_text(CK.replace('aaa', 'rotated'))      # yt-dlp כותב את העוגיות בחזרה
        y.done(True)
        self.assertIn('rotated', (self.d / 'ck.txt').read_text())
        self.assertTrue((self.d / 'ck.dirty').exists())
        self.assertEqual(json.loads((self.d / 'ck.rep').read_text()), {'ok': True, 'code': '', 'v': 7})
        self.assertFalse(os.path.exists(tmp))

    def test_new_version_wins(self):
        y = F.YtCookies('https://youtu.be/abc')
        Path(y.args[1]).write_text(CK.replace('aaa', 'stale'))
        (self.d / 'ck.v').write_text('8')                     # המנהל הדביק עוגיות חדשות בזמן ההורדה
        y.done(True)
        self.assertNotIn('stale', (self.d / 'ck.txt').read_text())
        self.assertFalse((self.d / 'ck.dirty').exists())

    def test_report_block(self):
        y = F.YtCookies('https://youtu.be/abc')
        y.done(False, "ERROR: [youtube] abc: Sign in to confirm you're not a bot")
        self.assertEqual(json.loads((self.d / 'ck.rep').read_text())['code'], 'blocked')
        y = F.YtCookies('https://youtu.be/abc')
        y.done(False, 'WARNING: The provided YouTube account cookies are no longer valid')
        self.assertEqual(json.loads((self.d / 'ck.rep').read_text())['code'], 'ck')
        (self.d / 'ck.rep').unlink()
        y = F.YtCookies('https://youtu.be/abc')
        y.done(False, 'ERROR: Video unavailable')            # לא קשור לחשבון — לא מדווחים
        self.assertFalse((self.d / 'ck.rep').exists())

    def test_probe_uses_cookies_only_for_youtube(self):
        seen = []

        class R:
            returncode = 1
            stdout = ''
            stderr = 'ERROR: Sign in to confirm you are not a bot'

        def run(cmd, **kw):
            seen.append(cmd)
            return R()
        with self.assertRaises(ValueError):
            F.probe('https://youtu.be/abc', run=run)
        with self.assertRaises(ValueError):
            F.probe('https://vimeo.com/1', run=run)
        self.assertIn('--cookies', seen[0])
        self.assertNotIn('--sleep-interval', seen[0])       # בבדיקה אין הורדה
        self.assertNotIn('--cookies', seen[1])
        self.assertEqual(json.loads((self.d / 'ck.rep').read_text())['code'], 'blocked')
        self.assertEqual([p.name for p in self.d.iterdir() if p.name.startswith('.ck.')], [])   # אין עותקים יתומים


class AgentSyncTest(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp()) / 'yt'
        os.environ['SNB_YT_DIR'] = str(self.d)
        import importlib
        import agent
        self.A = importlib.reload(agent)
        self.calls = []

    def tearDown(self):
        os.environ.pop('SNB_YT_DIR', None)

    def http(self, reply):
        def f(method, url, body, headers=None, timeout=0):
            self.calls.append(body)
            return 200, reply(body), {}
        return f

    def test_fetch_store_clear(self):
        v = self.A.yt_sync('https://api', 'tok', http=self.http(lambda b: {'ok': True, 'v': 5, 'ck': CK}))
        self.assertEqual(v, 5)
        self.assertEqual((self.d / 'ck.txt').read_text(), CK)
        self.assertEqual(stat.S_IMODE(os.stat(self.d / 'ck.txt').st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(os.stat(self.d).st_mode), 0o700)
        self.assertEqual(self.calls[-1], {'op': 'ytCk', 'v': 0})
        v = self.A.yt_sync('https://api', 'tok', http=self.http(lambda b: {'ok': True, 'v': 5, 'same': True}))
        self.assertEqual((v, self.calls[-1]['v']), (5, 5))
        # דיווח + העוגיות שעודכנו
        (self.d / 'ck.rep').write_text(json.dumps({'ok': False, 'code': 'blocked', 'v': 5}))
        (self.d / 'ck.txt').write_text(CK.replace('aaa', 'rot'))
        (self.d / 'ck.dirty').touch()
        self.A.yt_sync('https://api', 'tok', http=self.http(lambda b: {'ok': True, 'v': 5, 'same': True}))
        self.assertEqual(self.calls[-1]['rep'], {'ok': False, 'code': 'blocked'})
        self.assertIn('rot', self.calls[-1]['put'])
        self.assertFalse((self.d / 'ck.rep').exists() or (self.d / 'ck.dirty').exists())
        # הוסר במרכז הניהול
        v = self.A.yt_sync('https://api', 'tok', http=self.http(lambda b: {'ok': True, 'v': 9}))
        self.assertEqual(v, 0)
        self.assertFalse((self.d / 'ck.txt').exists())

    def test_server_error_keeps_state(self):
        self.A.yt_sync('https://api', 'tok', http=self.http(lambda b: {'ok': True, 'v': 5, 'ck': CK}))
        (self.d / 'ck.rep').write_text(json.dumps({'ok': True, 'v': 5}))

        def bad(method, url, body, headers=None, timeout=0):
            return 503, {}, {}
        self.assertEqual(self.A.yt_sync('https://api', 'tok', http=bad), 5)
        self.assertTrue((self.d / 'ck.rep').exists() and (self.d / 'ck.txt').exists())   # ננסה שוב בסבב הבא

    def test_rejects_non_cookie_text(self):
        self.A.yt_sync('https://api', 'tok', http=self.http(lambda b: {'ok': True, 'v': 5, 'ck': 'rm -rf /'}))
        self.assertFalse((self.d / 'ck.txt').exists())


if __name__ == '__main__':
    unittest.main()
