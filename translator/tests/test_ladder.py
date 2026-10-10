"""איכויות צפייה (ladder.py): החלטה מי נארז, הפקודות, האינדקס והקודקים — ועם ffmpeg אמיתי (אם יש): המקור הארוז זהה
בבייטים לזרמים המקוריים, האיכויות הנמוכות עם מפתחות באותם רגעים, והאינדקס מכסה את כל הקובץ."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import ladder as L  # noqa: E402

FF = shutil.which('ffmpeg') and shutil.which('ffprobe')


def sm(**kw):
    base = {'nv': 1, 'na': 1, 'other': [], 'v': 'h264', 'a': 'aac', 'w': 1920, 'h': 1080, 'dur': 600.0, 'gop': 2.0}
    base.update(kw)
    return base


class TestPlan(unittest.TestCase):
    def test_plan(self):
        p = L.plan(sm())
        self.assertTrue(p['ok'])
        self.assertEqual([r[0] for r in p['rungs']], [720, 480, 360, 240, 144], 'רק מתחת למקור')
        self.assertEqual([r[0] for r in L.plan(sm(w=3840, h=2160))['rungs']], [1440, 1080, 720, 480, 360, 240, 144])
        self.assertEqual(L.plan(sm(w=1080, h=1920))['short'], 1080, 'אנכי — לפי הצלע הקצרה (כמו YouTube)')
        self.assertEqual(L.plan(sm(w=1280, h=720))['rungs'][0][0], 480)
        for kw, why in ((dict(na=2), 'streams'), (dict(other=['subtitle']), 'streams'), (dict(nv=0), 'streams'),
                        (dict(v='prores'), 'vcodec'), (dict(a='pcm_s16le'), 'acodec'), (dict(gop=30.0), 'gop'),
                        (dict(gop=0.0), 'gop'), (dict(w=176, h=144), 'small')):
            self.assertEqual(L.plan(sm(**kw))['why'], why, kw)
        self.assertTrue(L.plan(sm(na=0, a=''))['ok'], 'בלי קול — בסדר')
        self.assertEqual(L.plan(sm(), edl=True)['why'], 'edl', 'חיתוך לפני התרגום — הנגן מנגן את הצריבה')
        for why in ('streams', 'vcodec', 'acodec', 'gop', 'small', 'edl'):
            self.assertIn(why, L.WHY)

    def test_summarize_rotation(self):
        info = {'streams': [{'codec_type': 'video', 'codec_name': 'hevc', 'width': 1920, 'height': 1080,
                             'side_data_list': [{'rotation': -90}]},
                            {'codec_type': 'video', 'codec_name': 'mjpeg', 'disposition': {'attached_pic': 1}},
                            {'codec_type': 'audio', 'codec_name': 'aac'}, {'codec_type': 'data', 'codec_name': 'bin_data'}],
                'format': {'duration': '61.5'}}
        s = L.summarize(info, 2.0)
        self.assertEqual((s['nv'], s['na'], s['other'], s['w'], s['h'], s['dur']), (1, 1, [], 1080, 1920, 61.5),
                         'סיבוב 90° = אנכי; תמונת כריכה ורצועת נתונים לא נחשבות')

    def test_max_gap(self):
        csv = '0.0,K__\n0.5,___\n2.0,K__\n9.0,___\n10.0,K__\n11.0,___\n'
        self.assertEqual(L.max_gap(csv), 8.0)
        self.assertEqual(L.max_gap(csv, dur=30.0), 20.0, 'עד סוף הסרטון')
        self.assertEqual(L.max_gap(''), 0.0)

    def test_cmds(self):
        c = L.remux_cmd('in.mov', 'top.mp4', sm(v='hevc'))
        self.assertIn('-c', c)
        self.assertEqual(c[c.index('-c') + 1], 'copy', 'בלי קידוד')
        self.assertIn('hvc1', c)
        self.assertIn(L.MOVFLAGS, c)
        self.assertNotIn('-map 0:a:0', ' '.join(L.remux_cmd('in.mp4', 'o.mp4', sm(na=0))))
        rungs = L.plan(sm())['rungs']
        lc = L.low_cmd('in.mp4', '/o', rungs, True)
        self.assertEqual(lc.count('-i'), 1, 'פענוח אחד לכל האיכויות')
        self.assertEqual(lc.count('libx264'), len(rungs))
        self.assertEqual(lc.count('source'), len(rungs), 'מפתחות באותם רגעים של המקור — מעבר חלק')
        self.assertTrue(all(isinstance(x, str) for x in lc), 'רשימת ארגומנטים, בלי shell')
        self.assertIn('/o/r144.mp4', lc)


@unittest.skipUnless(FF, 'אין ffmpeg')
class TestBuild(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        cls.src = cls.tmp / 'src.mp4'
        r = subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=25', '-f', 'lavfi',
                            '-i', 'sine=frequency=440', '-t', '8', '-c:v', 'libx264', '-g', '50', '-pix_fmt', 'yuv420p',
                            '-c:a', 'aac', str(cls.src)], capture_output=True)
        cls.ok = r.returncode == 0
        cls.res = L.build(cls.src, cls.tmp / 'out', log=lambda m: None) if cls.ok else None

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def md5(self, p, sel):
        r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(p), '-map', '0:' + sel, '-c', 'copy', '-f', 'md5', '-'], capture_output=True, text=True)
        return r.stdout.strip()

    def test_build(self):
        if not self.ok:
            self.skipTest('ffmpeg בלי libx264')
        r = self.res
        self.assertTrue(r['ok'], r)
        top = Path(r['top']['f'])
        self.assertEqual(self.md5(top, 'v:0'), self.md5(self.src, 'v:0'), 'הווידאו במקור הארוז זהה בבייטים')
        self.assertEqual(self.md5(top, 'a:0'), self.md5(self.src, 'a:0'), 'וגם הקול')
        self.assertLess(abs(top.stat().st_size - self.src.stat().st_size), self.src.stat().st_size * 0.02, 'בערך באותו גודל — לא עותק נוסף')
        self.assertEqual(r['top']['c'].split(',')[0][:7], 'avc1.64')
        self.assertTrue(r['top']['c'].endswith('mp4a.40.2'))
        self.assertEqual([x['h'] for x in r['rungs']], [480, 360, 240, 144])
        self.assertEqual([x['w'] for x in r['rungs']], [854, 640, 426, 256])
        tops = 0
        for f in [top] + [Path(x['f']) for x in r['rungs']]:
            b = L.head(f)
            init_end, segs = L.sidx_index(b)
            self.assertGreater(init_end, 0)
            self.assertEqual(segs[0][0] + sum(x[1] for x in segs) <= f.stat().st_size, True)
            self.assertAlmostEqual(sum(x[2] for x in segs), 8.0, delta=0.1, msg='האינדקס מכסה את כל הסרטון')
            self.assertEqual([round(x[2], 2) for x in segs], [2.0] * 4, 'קטעים לפי המפתחות של המקור (כל 2 שנ׳) — בכל האיכויות')
            tops += 1
        self.assertEqual(tops, 5)
        low = sum(Path(x['f']).stat().st_size for x in r['rungs'])
        self.assertLess(low, top.stat().st_size, 'כל האיכויות הנמוכות יחד — פחות מהמקור')
        for x in [r['top']] + r['rungs']:
            self.assertGreaterEqual(x['bw'], x['abw'])

    def test_not_eligible_untouched(self):
        mkv = self.tmp / 'sub.mkv'
        srt = self.tmp / 's.srt'
        srt.write_text('1\n00:00:00,000 --> 00:00:01,000\nhi\n')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(self.src), '-i', str(srt), '-map', '0', '-map', '1', '-c', 'copy',
                        '-c:s', 'srt', str(mkv)], capture_output=True)
        r = L.build(mkv, self.tmp / 'out2', log=lambda m: None)
        self.assertEqual((r['ok'], r['why']), (False, 'streams'), 'כתוביות בתוך הקובץ — לא נוגעים במקור')
        self.assertFalse((self.tmp / 'out2' / 'top.mp4').exists())


if __name__ == '__main__':
    unittest.main()
