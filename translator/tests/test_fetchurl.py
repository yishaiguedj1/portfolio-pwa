"""22/10/2026: הורדה מקישור (fetchurl.py) — בדיקת קישור, סיכום הפלט של yt-dlp, בחירת "הכי קרוב למקור", קודי שגיאה.
הנתונים סינתטיים, במבנה של `yt-dlp -J` (יוטיוב: וידאו וקול נפרדים + DRC + דיבוב; TED: HLS בלי קודק קול ידוע;
קובץ ישיר בלי גובה). בלי רשת ובלי yt-dlp."""
import subprocess
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import fetchurl as F  # noqa: E402


def fm(fid, vc='none', ac='none', h=None, tbr=0, abr=0, size=0, note='', proto='https', fps=None, dr='SDR', lang=None):
    return {'format_id': fid, 'vcodec': vc, 'acodec': ac, 'height': h, 'tbr': tbr, 'abr': abr, 'filesize': size or None,
            'format_note': note, 'protocol': proto, 'fps': fps, 'dynamic_range': dr if vc != 'none' else None, 'language': lang, 'ext': 'mp4'}


YT = {
    'title': 'Interview‮: The Future', 'webpage_url': 'https://www.youtube.com/watch?v=abc', 'extractor_key': 'Youtube',
    'uploader': 'Channel', 'duration': 600.4, 'upload_date': '20261020', 'language': 'en',
    'chapters': [{'start_time': 0, 'title': 'Intro'}, {'start_time': 61.6, 'title': 'Main\npart'}],
    'subtitles': {'en': [{'name': 'English'}], 'he': [{'name': 'Hebrew'}], 'live_chat': [{}]},
    'automatic_captions': {'en': [{'name': 'English (auto)'}], 'fr': [{'name': 'French'}], 'en-orig': [{'name': 'English (Original)'}]},
    'formats': [
        fm('sb0', note='storyboard'),
        fm('140', ac='mp4a.40.2', abr=129, size=9_700_000, note='medium, original', lang='en'),
        fm('251', ac='opus', abr=135, size=10_000_000, note='medium, original', lang='en'),
        fm('251-drc', ac='opus', abr=140, size=10_400_000, note='medium, DRC', lang='en'),
        fm('251-1', ac='opus', abr=160, size=12_000_000, note='Español, medium', lang='es'),
        fm('137', vc='avc1.640028', h=1080, tbr=4000, size=300_000_000, fps=30),
        fm('248', vc='vp9', h=1080, tbr=2600, size=190_000_000, fps=30),
        fm('399', vc='av01.0.08M.08', h=1080, tbr=2100, size=150_000_000, fps=30),
        fm('701', vc='av01.0.12M.10', h=2160, tbr=18000, size=1_300_000_000, fps=60, dr='HDR10'),
        fm('313', vc='vp9', h=2160, tbr=17000, size=1_200_000_000, fps=60),
        fm('22', vc='avc1.64001F', ac='mp4a.40.2', h=720, tbr=1500, size=110_000_000, fps=30),
        fm('136', vc='avc1.4d401f', h=720, tbr=1200, size=80_000_000, fps=30),
        fm('hls-1080', vc='avc1.640028', h=1080, tbr=4100, proto='m3u8_native', fps=30),
    ],
}

TED = {'title': 'Talk', 'webpage_url': 'https://www.ted.com/talks/x', 'extractor_key': 'TedTalk', 'duration': 100,
       'formats': [{'format_id': 'hls-audio0-low', 'vcodec': 'none', 'acodec': None, 'protocol': 'm3u8_native'},
                   {'format_id': 'h264-1200k', 'vcodec': None, 'acodec': None, 'tbr': 1200},
                   {'format_id': 'hls-1017', 'vcodec': 'avc1.64001f', 'acodec': 'none', 'height': 480, 'tbr': 1017, 'protocol': 'm3u8_native'},
                   {'format_id': 'hls-851', 'vcodec': 'avc1.64001f', 'acodec': 'none', 'height': 360, 'tbr': 851, 'protocol': 'm3u8_native'}]}

DIRECT = {'title': 'clip', 'webpage_url': 'https://cdn.example.com/clip.mp4', 'extractor_key': 'Generic', 'duration': 30,
          'formats': [{'format_id': 'mp4', 'vcodec': None, 'acodec': None, 'filesize': 5_000_000}]}


class CheckUrl(unittest.TestCase):
    def ok(self, u, addrs=('93.184.216.34',)):
        return F.check_url(u, resolve=lambda h: list(addrs))

    def bad(self, u, code, addrs=('93.184.216.34',)):
        with self.assertRaises(ValueError) as c:
            F.check_url(u, resolve=lambda h: list(addrs))
        self.assertEqual(str(c.exception), code, u)

    def test_public(self):
        self.assertEqual(self.ok('https://www.youtube.com/watch?v=abc'), 'https://www.youtube.com/watch?v=abc')
        self.assertTrue(self.ok('http://example.com:8080/v.mp4'))
        self.assertTrue(self.ok('https://93.184.216.34/v.mp4'))

    def test_private_and_metadata(self):
        for u in ('http://127.0.0.1/', 'http://169.254.169.254/hetzner/v1/metadata', 'http://10.0.0.5/', 'http://[::1]/',
                  'http://[::ffff:127.0.0.1]/', 'https://localhost/x', 'https://box.local/', 'http://100.64.1.1/'):
            self.bad(u, 'private')
        self.bad('https://evil.example.com/', 'private', addrs=('93.184.216.34', '192.168.1.10'))   # כתובת פנימית אחת מספיקה

    def test_shape(self):
        for u in ('ftp://x.com/a', 'https://user:pw@x.com/', 'javascript:alert(1)', 'https://x.com:22/', 'https://x com/', 'https://intranet/', '', 'https://' + 'a' * 2100 + '.com'):
            self.bad(u, 'bad_url')

    def test_dns_fail(self):
        def boom(h):
            raise OSError('nx')
        with self.assertRaises(ValueError) as c:
            F.check_url('https://nx.example.org/', resolve=boom)
        self.assertEqual(str(c.exception), 'dns')

    def test_extract_url(self):
        self.assertEqual(F.extract_url('צפו בזה https://youtu.be/abc?si=x).'), 'https://youtu.be/abc?si=x')
        self.assertEqual(F.extract_url('אין כאן קישור'), '')


class Summarize(unittest.TestCase):
    def test_youtube(self):
        s = F.summarize(YT)
        self.assertEqual(s['t'], 'Interview : The Future')                  # בלי תווי כיווניות מטקסט חיצוני
        self.assertEqual((s['d'], s['ud'], s['s']), (600, '20261020', 'Youtube'))
        self.assertEqual(s['ch'], [[0, 'Intro'], [62, 'Main part']])
        self.assertEqual(s['rec'], 1080)
        q = {o['h']: o for o in s['q']}
        self.assertEqual(sorted(q), [720, 1080, 2160])
        # 1080: AV1 (האיכות הכי גבוהה לביט, הורדה ישירה) + Opus המקורי — לא H.264, לא HLS, לא DRC ולא הדיבוב
        self.assertEqual((q[1080]['v'], q[1080]['a'], q[1080]['c'], q[1080]['ac']), ('399', '251', 'av1', 'opus'))
        self.assertEqual(q[1080]['sz'], 160_000_000)
        self.assertEqual(q[2160]['v'], '313')                              # SDR לפני HDR (HDR נצרב בצבעים דהויים)
        self.assertEqual(q[720]['v'], '136')                               # וידאו נפרד + הקול הכי טוב לפני הקובץ המשולב
        self.assertEqual(s['ao']['id'], '251')
        ids = [f['id'] for f in s['fm']]
        self.assertNotIn('251-drc', ids)
        self.assertNotIn('sb0', ids)
        subs = {(x['l'], x['a']) for x in s['sub']}
        self.assertEqual(subs, {('en', 0), ('he', 0), ('en', 1), ('en-orig', 1)})   # אוטומטיות — רק בשפה המקורית

    def test_ted_unknown_audio_codec(self):
        s = F.summarize(TED)
        self.assertEqual([(o['h'], o['v'], o['a']) for o in s['q']], [(480, 'hls-1017', 'hls-audio0-low'), (360, 'hls-851', 'hls-audio0-low')])
        self.assertEqual(s['rec'], 480)

    def test_direct_file(self):
        s = F.summarize(DIRECT)
        self.assertEqual([(o['h'], o['v'], o['a']) for o in s['q']], [(0, 'mp4', '')])
        self.assertEqual(s['rec'], 0)

    def test_refusals(self):
        for info, code in (({'_type': 'playlist', 'entries': []}, 'playlist'), (dict(YT, is_live=True), 'live'),
                           ({'formats': [], '_has_drm': True}, 'drm'), ({'formats': []}, 'no_video'), ('x', 'fail')):
            with self.assertRaises(ValueError) as c:
                F.summarize(info)
            self.assertEqual(str(c.exception), code)

    def test_shape_bounded(self):
        big = dict(YT, title='x' * 900, chapters=[{'start_time': i, 'title': 't%d' % i} for i in range(200)],
                   formats=YT['formats'] + [fm('f%d' % i, vc='avc1', h=144, tbr=i) for i in range(200)])
        s = F.summarize(big)
        self.assertEqual(len(s['t']), F.TITLE_MAX)
        self.assertEqual(len(s['ch']), F.CH_MAX)
        self.assertLessEqual(len(s['fm']), F.FMT_MAX)


class Selector(unittest.TestCase):
    def test_exact_then_fallback(self):
        self.assertEqual(F.selector({'v': '399', 'a': '251', 'h': 1080}), '399+251/bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b')
        self.assertEqual(F.selector({'v': 'mp4', 'a': '', 'h': 0}), 'mp4/bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b')
        self.assertEqual(F.selector({'v': 'x;rm -rf', 'a': '$(id)'}), 'bv*[height<=1080]+ba/b[height<=1080]/bv*+ba/b')   # מזהה לא תקין — נזרק
        self.assertEqual(F.audio_selector({'a': '251'}), '251/bestaudio/best')
        self.assertEqual(F.audio_selector({}), 'bestaudio/best')


class Errors(unittest.TestCase):
    def test_codes(self):
        cases = {
            "ERROR: [youtube] x: Sign in to confirm you’re not a bot. Use --cookies": 'blocked',
            'ERROR: HTTP Error 429: Too Many Requests': 'blocked',
            'ERROR: [vimeo] 1: The web client only works when logged-in.': 'login',
            'ERROR: [youtube] x: Private video. Sign in if you\'ve been granted access': 'login',
            'ERROR: [youtube] x: Video unavailable. This video has been removed by the uploader': 'gone',
            'ERROR: The uploader has not made this video available in your country': 'geo',
            'ERROR: Unsupported URL: https://example.com/': 'unsupported',
            'ERROR: [x] This video is DRM protected': 'drm',
            'ERROR: Unable to download webpage: <urlopen error [Errno -3] Temporary failure in name resolution>': 'net',
            'ERROR: something new': 'fail',
        }
        for t, c in cases.items():
            self.assertEqual(F.err_code(t), c, t)


class Run(unittest.TestCase):
    def test_probe_errors(self):
        def run(cmd, **kw):
            self.assertIn('-J', cmd)
            self.assertIn('--ignore-config', cmd)
            self.assertEqual(cmd[-2:], ['--', 'https://x.com/v'])           # "--" לפני הקישור — לא ייקרא כדגל
            return subprocess.CompletedProcess(cmd, 1, '', 'ERROR: Unsupported URL: https://x.com/v')
        with self.assertRaises(ValueError) as c:
            F.probe('https://x.com/v', run=run)
        self.assertEqual(str(c.exception), 'unsupported')

    def test_probe_ref(self):
        # שלב 2 (דפדפן הציד): קובץ שנמצא בדף — Referer + Origin של הדף; Referer לא תקין — לא נשלח
        import json
        seen = []

        def run(cmd, **kw):
            seen.append(cmd)
            return subprocess.CompletedProcess(cmd, 0, json.dumps(DIRECT), '')
        F.probe('https://cdn.x.com/m.m3u8', run=run, ref='https://site.example/watch/1?a=b')
        c = seen[-1]
        self.assertIn('Referer:https://site.example/watch/1?a=b', c)
        self.assertIn('Origin:https://site.example', c)
        F.probe('https://cdn.x.com/m.m3u8', run=run, ref='https://a b\r\nX: y')
        self.assertFalse(any(str(a).startswith('Referer:') for a in seen[-1]))

    def test_probe_ok(self):
        import json
        run = lambda cmd, **kw: subprocess.CompletedProcess(cmd, 0, json.dumps(DIRECT), '')
        self.assertEqual(F.probe('https://x.com/v', run=run)['t'], 'clip')


if __name__ == '__main__':
    unittest.main()
