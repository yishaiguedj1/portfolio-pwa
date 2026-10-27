"""27/10/2026 (בקשת המשתמש): כתוביות שכבר קיימות למקור — עזר להגהה בכל מקור, לא רק בקובץ מהטלפון.
מקישור: כתוביות היוצר (learn_refs_start — מתחיל ב־url_fetch); סרטון שהשרת מוריד (Drive): רצועת טקסט בתוך הקובץ (ffmpeg).
pipeline.sub_ref משתמש בהן כשהטלפון לא שלח files.r. ffmpeg אמיתי — קובץ MKV עם שתי רצועות כתוביות."""
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402
import pipeline as P  # noqa: E402

SRT_EN = '1\n00:00:01,000 --> 00:00:02,500\nHello <i>world</i>\n\n2\n00:01:05,000 --> 00:01:07,000\n(applause)\n\n' \
         '3\n01:00:02,000 --> 01:00:04,000\nSecond\nline\n'


def ctx_for(pd, spec=None, files=None):
    return SimpleNamespace(pdir=Path(pd), st={'spec': spec or {}, 'files': files or {}})


class Pure(unittest.TestCase):
    def test_sub_tracks(self):
        m = {'streams': [
            {'index': 0, 'type': 'video', 'codec': 'h264'},
            {'index': 2, 'type': 'subtitle', 'codec': 'subrip', 'lang': 'eng', 'forced': True},
            {'index': 3, 'type': 'subtitle', 'codec': 'subrip', 'lang': 'eng', 'sdh': True},
            {'index': 4, 'type': 'subtitle', 'codec': 'ass', 'lang': 'eng'},
            {'index': 5, 'type': 'subtitle', 'codec': 'hdmv_pgs_subtitle', 'lang': 'heb'},
            {'index': 6, 'type': 'subtitle', 'codec': 'mov_text', 'lang': 'heb'},
            {'index': 7, 'type': 'subtitle', 'codec': 'subrip', 'lang': 'fre'},
        ]}
        self.assertEqual(job.sub_tracks(m), {'en': 4, 'he': 6}, 'לא מאולצת ולא SDH קודם; תמונה (PGS) — לא')
        m2 = {'streams': [{'index': 2, 'type': 'subtitle', 'codec': 'subrip', 'lang': 'en', 'forced': True},
                          {'index': 3, 'type': 'subtitle', 'codec': 'subrip', 'lang': 'en', 'sdh': True}]}
        self.assertEqual(job.sub_tracks(m2), {'en': 3}, 'רק SDH — עדיף על מאולצת')
        self.assertEqual(job.sub_tracks({}), {})

    def test_hlp_lines(self):
        txt = job.hlp_lines(SRT_EN)
        self.assertEqual(txt, '[00:00:01] Hello world\n[01:00:02] Second line\n', 'בלי תגיות, בלי כתוביות צלילים, שורה אחת')
        lines = P.ref_lines(txt)
        self.assertEqual([round(t) for t, _ in lines], [1, 3602], 'הפורמט שההגהה קוראת')
        self.assertEqual(job.hlp_lines(''), '')


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg')
class Embedded(unittest.TestCase):
    def test_mkv_tracks(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / 'en.srt').write_text(SRT_EN.replace('01:00:02', '00:00:03').replace('01:00:04', '00:00:04'), encoding='utf-8')
            (d / 'he.srt').write_text('1\n00:00:01,000 --> 00:00:02,000\nשלום עולם\n', encoding='utf-8')
            src = d / 'source.mkv'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x36:d=5',
                            '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-i', str(d / 'en.srt'), '-i', str(d / 'he.srt'),
                            '-map', '0:v', '-map', '1:a', '-map', '2', '-map', '3', '-t', '5', '-c:v', 'libx264', '-c:a', 'aac',
                            '-c:s', 'srt', '-metadata:s:s:0', 'language=eng', '-metadata:s:s:1', 'language=heb', str(src)],
                           check=True, capture_output=True)
            pr = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', str(src)],
                                           check=True, capture_output=True, text=True).stdout)
            from vt import media as M
            (d / 'media.json').write_text(json.dumps(M.summarize(pr, src)), encoding='utf-8')
            for f in ('en.srt', 'he.srt'):
                (d / f).unlink()
            c = ctx_for(d, files={'v': {'id': 'x'}})
            self.assertEqual(job.embedded_subs(c), ['en', 'he'])
            self.assertIn('שלום עולם', (d / 'ref' / 'he.srt').read_text(encoding='utf-8'))
            got = job.subs_hlp(c)
            self.assertIn('[00:00:01] Hello world', got)
            self.assertIn('[00:00:03] Second line', got)
            self.assertNotIn('applause', got)
            self.assertEqual(job.embedded_subs(c), ['en', 'he'], 'פעם שנייה — לא שולפים שוב')

    def test_no_video_no_subs(self):
        with tempfile.TemporaryDirectory() as d:
            c = ctx_for(d)
            self.assertEqual(job.embedded_subs(c), [])
            self.assertEqual(job.subs_hlp(c), '')


class FromLink(unittest.TestCase):
    def test_waits_for_creator_subs(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            c = ctx_for(d, spec={'src': 'url', 'url': 'https://www.youtube.com/watch?v=x'})

            def late():
                time.sleep(0.2)
                (d / job.REF_DIR).mkdir()
                (d / job.REF_DIR / 'en.srt').write_text(SRT_EN, encoding='utf-8')
            th = threading.Thread(target=late)
            th.start()
            old = job._REF['t']
            job._REF['t'] = th
            try:
                self.assertIn('Hello world', job.subs_hlp(c, wait=5), 'מחכים לכתוביות היוצר שעוד יורדות')
                self.assertIs(job.learn_refs_start(c) if th.is_alive() else th, th)
            finally:
                job._REF['t'] = old

    def test_started_by_url_fetch(self):
        src = Path(job.__file__).read_text(encoding='utf-8')
        body = src[src.index('def url_fetch('):src.index('def prepare(')]
        self.assertIn('learn_refs_start(ctx)', body, 'כתוביות היוצר — כבר בתחילת העבודה, לא רק בסוף')


class SubRef(unittest.TestCase):
    def test_pipeline_uses_server_subs(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            J = SimpleNamespace(subs_hlp=lambda ctx: '[00:00:05] From the server\n')
            pl = SimpleNamespace(pd=d, ctx=SimpleNamespace(st={'files': {}}), J=J)
            lines = P.Pipeline.sub_ref(pl)
            self.assertEqual(lines, [(5.0, '[00:00:05] From the server')])
            self.assertTrue((d / 'en.ref.txt').exists(), 'נשמר — נקודת שמירה / הגהה בחלקים משתמשות באותו קובץ')
            J2 = SimpleNamespace(subs_hlp=lambda ctx: '')
            with tempfile.TemporaryDirectory() as d2:
                pl2 = SimpleNamespace(pd=Path(d2), ctx=SimpleNamespace(st={'files': {}}), J=J2)
                self.assertEqual(P.Pipeline.sub_ref(pl2), [])
                self.assertFalse((Path(d2) / 'en.ref.txt').exists())

    def test_phone_file_wins(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            called = []

            def fetch(ctx, fid, dest, size):
                Path(dest).write_text('[00:00:09] From the phone\n', encoding='utf-8')
            J = SimpleNamespace(fetch_input=fetch, subs_hlp=lambda ctx: called.append(1) or 'x', Stop=type('S', (Exception,), {}))
            pl = SimpleNamespace(pd=d, ctx=SimpleNamespace(st={'files': {'r': {'id': 'R2_x_y', 'size': 30}}}), J=J)
            self.assertEqual(P.Pipeline.sub_ref(pl), [(9.0, '[00:00:09] From the phone')])
            self.assertEqual(called, [], 'הרצועה שהטלפון שלף — קודם')


if __name__ == '__main__':
    unittest.main()
