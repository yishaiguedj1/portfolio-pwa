"""22/10/2026: הורדה מקישור בעבודה (job.url_fetch / url_get / wait_video): הקול יורד ונרשם לפני התמלול, הסרטון ברקע,
שגיאה מההורדה ברקע עוצרת את העבודה עם קוד url_*, ועבודה מקישור לא חוזרת לתור (Park). yt-dlp, R2 והשרתון מדומים."""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

TMP = tempfile.mkdtemp()
os.environ['VT_WORK'] = TMP
os.environ['SNB_STATE'] = os.path.join(TMP, 'state', 'job.json')
os.environ['SNB_POLL'] = '0.01'

import job as J  # noqa: E402
import fetchurl as F  # noqa: E402


class FakeClient:
    def __init__(self, st):
        self.st, self.calls = st, []

    def call(self, op, **kw):
        self.calls.append((op, kw))
        if op == 'srcFile':
            self.st.setdefault('files', {})[kw['which']] = {'id': kw['id'], 'name': 'x', 'size': 1}
            return {'ok': True}
        if op == 'claim':
            return {'ok': True, 'job': {'files': dict(self.st.get('files') or {}), 'folder': 'R2_jAAAA'}}
        return {'ok': True}


class FakeCtx:
    def __init__(self, st):
        self.st = st
        self.c = FakeClient(st)
        self.reports = []

    name = 'jabc'

    def report(self, st=None, p=None, msg=None, force=False, **extra):
        self.reports.append((st, p, msg, extra))

    def refresh(self):
        return {}

    def event(self, c, k, ok=False):
        pass


def spec():
    return {'src': 'url', 'url': 'https://www.youtube.com/watch?v=abc', 'name': 'Talk: one/two', 'eng': 'api', 'kind': 'tr',
            'pick': {'v': '399', 'a': '251', 'h': 1080, 'sec': [10, 70]}}


class UrlFetch(unittest.TestCase):
    def setUp(self):
        self.saved = (F.download, J.put_output, J.QuietCtx, J.save_state)
        self.dl = []

        def download(url, pick, tmpl, kind='v', section=None, on_progress=None, **kw):
            self.dl.append((kind, pick, section))
            if kind == 'v':
                time.sleep(0.05)
                if getattr(self, 'fail_v', None):
                    raise ValueError(self.fail_v)
            p = Path(tmpl.replace('%(ext)s', 'm4a' if kind == 'a' else 'mkv'))
            p.write_bytes(b'x' * (100 if kind == 'a' else 300))
            if on_progress:
                on_progress(1.0, 100, 100)
            return str(p)
        self.ups = []

        def put_output(ctx, path, name, kind, mime, on_progress=None, prop='snbOut', replace=''):
            self.ups.append((name, mime, prop, Path(path).stat().st_size))
            return 'R2_jAAAA_' + ('a' if 'audio' in name else 'v') * 12
        F.download, J.put_output = download, put_output
        J.QuietCtx = lambda st: self.ctx              # ההורדה ברקע — אותו לקוח מדומה (רושם את הסרטון)
        J.save_state = lambda st: None
        J._URL_BG.update(t=None, err=None)
        self.ctx = FakeCtx({'spec': spec(), 'files': {}})

    def tearDown(self):
        F.download, J.put_output, J.QuietCtx, J.save_state = self.saved
        if J._URL_BG['t']:
            J._URL_BG['t'].join(2)

    def test_audio_first_then_video(self):
        J.url_fetch(self.ctx)
        self.assertEqual(self.dl[0], ('a', spec()['pick'], [10, 70]))              # הקול קודם, רק הקטע שנבחר
        self.assertEqual(self.ctx.c.calls[0], ('srcFile', {'which': 'a', 'id': 'R2_jAAAA_' + 'a' * 12}))
        a_local = J.VT_WORK / '_in' / 'jabc.audio.m4a'
        self.assertTrue(a_local.exists() and a_local.stat().st_size == 100, 'הקול במקום ש־fetch_input מחפש — בלי הורדה חוזרת')
        self.assertEqual(self.ups[0][0], 'Talk  one two.audio.m4a')                # שם בלי תווים אסורים
        J._URL_BG['t'].join(2)
        self.assertEqual(self.dl[1][0], 'v')
        self.assertIn(('srcFile', {'which': 'v', 'id': 'R2_jAAAA_' + 'v' * 12}), self.ctx.c.calls)
        self.assertTrue((J.VT_WORK / '_in' / 'jabc.mkv').exists())
        v = J.wait_video(self.ctx, 'rv', 'x')
        self.assertEqual(v['id'], 'R2_jAAAA_' + 'v' * 12)

    def test_audio_error_stops_with_code(self):
        def boom(*a, **kw):
            raise ValueError('blocked')
        F.download = boom
        with self.assertRaises(J.StepError) as c:
            J.url_fetch(self.ctx)
        self.assertEqual(c.exception.err, 'url_blocked')

    def test_video_error_reaches_wait_video(self):
        self.fail_v = 'gone'
        J.url_fetch(self.ctx)
        J._URL_BG['t'].join(2)
        with self.assertRaises(J.StepError) as c:
            J.wait_video(self.ctx, 'rv', 'x')
        self.assertEqual(c.exception.err, 'url_gone')
        self.assertTrue(any(r[3].get('fail') and r[3].get('err') == 'url_gone' for r in self.ctx.reports))

    def test_resume_skips_registered(self):
        self.ctx.st['files'] = {'a': {'id': 'R2_jAAAA_' + 'a' * 12}, 'v': {'id': 'R2_jAAAA_' + 'v' * 12}}
        J.url_fetch(self.ctx)
        self.assertEqual(self.dl, [], 'המשך: מה שכבר נרשם לא יורד שוב')

    def test_no_park(self):
        self.assertFalse(J.can_park(self.ctx))
        self.ctx.st['spec'] = dict(spec(), src='')
        self.assertTrue(J.can_park(self.ctx))

    def test_not_url_job(self):
        self.ctx.st['spec'] = {'eng': 'api'}
        J.url_fetch(self.ctx)
        self.assertEqual(self.dl, [])


if __name__ == '__main__':
    unittest.main()
