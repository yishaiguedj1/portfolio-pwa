"""צריבה בחלקים במקביל (21/10/2026): חלוקה לפי פריימים, נקודות חיתוך באמצע בין פריימים, מספר החלקים,
והבדיקה מקצה לקצה עם ffmpeg אמיתי — אותו מספר פריימים, אותו קול, והכתוביות באותם פריימים כמו בצריבה הרגילה."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from vt import overlay as O  # noqa: E402
from vt import render as R  # noqa: E402


def _has_svt():
    if not (shutil.which('ffmpeg') and shutil.which('ffprobe')):
        return False
    p = subprocess.run(['ffmpeg', '-hide_banner', '-encoders'], capture_output=True, text=True)
    return 'libsvtav1' in p.stdout


class Bounds(unittest.TestCase):
    def test_cover_every_frame_once(self):
        for n in (1, 2, 3, 4):
            for frames in (1, 7, 1800, 155_879):
                b = R.part_bounds(frames, n)
                self.assertEqual(b[0][0], 0)
                self.assertEqual(b[-1][1], frames)
                for (a, z), (a2, _) in zip(b, b[1:]):
                    self.assertEqual(z, a2, 'בלי חור ובלי חפיפה')
                self.assertLessEqual(max(z - a for a, z in b) - min(z - a for a, z in b), 1, 'שווים')

    def test_cut_time_between_frames(self):
        t = [0, 33, 67, 100]
        self.assertEqual(O.cut_time(t, 0), 0.0)
        self.assertAlmostEqual(O.cut_time(t, 2), 0.050)
        self.assertGreater(O.cut_time(t, 4), 0.1)


class Parts(unittest.TestCase):
    def _work(self, frames):
        d = Path(tempfile.mkdtemp())
        (d / 'segments.json').write_text(json.dumps({'times': list(range(frames))}))
        return d

    def test_count(self):
        w = self._work(30 * 3600)
        with mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop('SNB_BURN_PAR', None)
            with mock.patch.object(R, 'svt_lp', return_value=8):
                self.assertEqual(R.burn_parts(3600, w), 2, 'שמונה ליבות — שני חלקים')
                self.assertEqual(R.burn_parts(60, w), 1, 'סרטון קצר — תהליך אחד')
            with mock.patch.object(R, 'svt_lp', return_value=16):
                self.assertEqual(R.burn_parts(3600, w), 4)
            with mock.patch.object(R, 'svt_lp', return_value=8):
                self.assertEqual(R.burn_parts(3600, self._work(2500)), 1, 'פחות משני חלקים של דקה — אחד')
                self.assertEqual(R.burn_parts(3600, Path(tempfile.mkdtemp())), 1, 'בלי זמני פריימים — אחד')
        with mock.patch.dict(os.environ, {'SNB_BURN_PAR': '1'}):
            self.assertEqual(R.burn_parts(3600, w), 1, 'כיבוי')
        with mock.patch.dict(os.environ, {'SNB_BURN_PAR': '3'}):
            self.assertEqual(R.burn_parts(10, self._work(300)), 3, 'דריסה (בדיקות / מדידה)')

    def test_fallback_on_failure(self):
        """תקלה בדרך המקבילית → הצריבה הרגילה; שורת "צורב →" אחת בלבד (העובד סופר אותן)."""
        logs = []
        with mock.patch.object(R, 'burn_parts', return_value=2), \
                mock.patch.object(R, '_burn_parts', side_effect=ValueError('part_frames')), \
                mock.patch.object(R, 'run_progress') as rp, \
                mock.patch('vt.overlay.prerender', return_value=(Path('/x/overlay.txt'), 900, 3)), \
                mock.patch.object(R, 'log', side_effect=logs.append):
            r = R.burn(Path('/x/src.mp4'), Path('/x/he.ass'), Path('/x/out.mp4'),
                       {'duration': 3600.0, 'video': {'width': 1920, 'height': 1080}, 'audio': {'codec': 'aac'}},
                       crf=40, work=Path('/x/ov'))
        self.assertTrue(rp.called)
        self.assertNotIn('parts', r)
        self.assertEqual(sum('צורב →' in x for x in logs), 1)


@unittest.skipUnless(_has_svt(), 'ffmpeg עם libsvtav1 חסר')
class EndToEnd(unittest.TestCase):
    """8 שנ׳ עם כתובית שחוצה את הגבול ואחת שמתחילה בו: שני חלקים מול תהליך אחד."""
    SRC, EXTRA = 'src.mp4', []

    @classmethod
    def setUpClass(cls):
        cls.d = Path(tempfile.mkdtemp())
        cls.src = cls.d / cls.SRC
        # B־frames (כמו סרטון אמיתי) ופריים מפתח כל 2 שנ׳ — החיתוך באמצע קבוצה
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                        'testsrc2=s=640x360:r=25', '-f', 'lavfi', '-i', 'sine=f=440', '-t', '8', '-c:v', 'libx264',
                        '-preset', 'veryfast', '-bf', '3', '-g', '50', '-c:a', 'aac', '-shortest']
                       + cls.EXTRA + [str(cls.src)], check=True)
        cls.ass = cls.d / 'he.ass'
        cls.ass.write_text("""[Script Info]
ScriptType: v4.00+
PlayResX: 640
PlayResY: 360

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arimo,28,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,2,0,2,10,10,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.50,0:00:02.00,Default,,0,0,0,,ראשונה
Dialogue: 0,0:00:03.80,0:00:04.20,Default,,0,0,0,,חוצה את הגבול
Dialogue: 0,0:00:04.00,0:00:05.00,Default,,0,0,0,,מתחילה בגבול
Dialogue: 0,0:00:07.00,0:00:07.90,Default,,0,0,0,,אחרונה
""", encoding='utf-8')
        cls.info = {'duration': 8.0, 'video': {'width': 640, 'height': 360}, 'audio': {'codec': 'aac'}}
        cls.out = {}
        for n in ('1', '2'):
            with mock.patch.dict(os.environ, {'SNB_BURN_PAR': n, 'SNB_SVT_LP': '2'}):
                o = cls.d / f'out{n}.mp4'
                cls.r = R.burn(cls.src, cls.ass, o, cls.info, crf=30, work=cls.d / f'ov{n}')
                cls.out[n] = o

    def _probe(self, f):
        p = subprocess.run(['ffprobe', '-v', 'error', '-count_packets', '-show_entries',
                            'stream=codec_type,nb_read_packets', '-of', 'csv=p=0', str(f)],
                           capture_output=True, text=True, check=True)
        return sorted(p.stdout.split())

    def _first(self, f, sel):
        p = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', sel, '-show_entries', 'packet=pts_time',
                            '-of', 'csv=p=0', str(f)], capture_output=True, text=True, check=True)
        return min(float(x.strip(',')) for x in p.stdout.split() if x.strip(','))

    def test_same_frames_and_audio(self):
        src = dict(x.split(',') for x in self._probe(self.src))
        got = dict(x.split(',') for x in self._probe(self.out['2']))
        self.assertEqual(got['video'], src['video'], 'כל פריים פעם אחת — לא פחות ולא יותר מהמקור')
        self.assertEqual(got['audio'], dict(x.split(',') for x in self._probe(self.out['1']))['audio'])
        # הסנכרון: הווידאו מתחיל אחרי הקול בדיוק כמו במקור (עד עיגול של בסיס הזמן)
        lag_src = self._first(self.src, 'v:0') - self._first(self.src, 'a:0')
        lag_out = self._first(self.out['2'], 'v:0') - self._first(self.out['2'], 'a:0')
        self.assertAlmostEqual(lag_out, lag_src, delta=0.002)
        self.assertFalse((self.d / 'ov2' / 'parts' / 'part0.mp4').exists(), 'החלקים נמחקים')

    def test_subtitles_on_the_same_frames(self):
        """רצועת הכתוביות בשתי הצריבות מול רפרנס בלי דחיסה: אף פריים לא רחוק — כתובית שזזה בפריים הייתה נראית כאן."""
        lst = self.d / 'ov1' / 'overlay.txt'
        y0 = json.loads((self.d / 'ov1' / 'segments.json').read_text())['y0']
        ref = self.d / 'ref.mkv'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(self.src), '-f', 'concat',
                        '-safe', '0', '-i', str(lst), '-filter_complex', O.overlay_filter(y0), '-an', '-c:v', 'libx264',
                        '-qp', '0', '-preset', 'ultrafast', str(ref)], check=True)
        vals = {}
        for n, f in self.out.items():
            log = self.d / f'psnr{n}.log'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(f), '-i', str(ref), '-lavfi',
                            f'[0:v]crop=640:{360 - y0}:0:{y0}[a];[1:v]crop=640:{360 - y0}:0:{y0}[b];'
                            f'[a][b]psnr=stats_file={log}', '-f', 'null', '-'], check=True)
            v = []
            for line in log.read_text().splitlines():
                d = dict(x.split(':') for x in line.split() if ':' in x)
                v.append(99.0 if d['psnr_avg'] == 'inf' else float(d['psnr_avg']))
            vals[n] = v
        # פריים שזז באחד (הבאג שנמצא: ‎-ss משאיר את הפריים שמוצג ברגע החיתוך, ו־MKV קופץ לפריים המפתח שאחרי) =
        # ‎~20dB פחות בכל החלק; דחיסה שונה בגלל פריים מפתח בתחילת חלק = עד ~4 בפריים בודד
        # במקור שהקול בו מתחיל לפני הווידאו הצריבה הרגילה משכפלת פריים בהתחלה (כל הווידאו זז ב־~17ms ביחס לקול) —
        # הצריבה בחלקים שומרת את הזמנים המקוריים, ולכן כאן היא אפילו קרובה יותר לרפרנס. הדרישה: לא פחות מדויקת
        a, b = vals['1'], vals['2']
        self.assertGreater(min(b), min(a) - 6, 'פריים בלי הכתובית שלו / פריים אחר')
        self.assertGreater(sum(b) / len(b), sum(a) / len(a) - 1.0, 'אותה איכות')
        self.assertGreater(sum(b) / len(b), 40, 'קרוב לרפרנס בלי דחיסה')


@unittest.skipUnless(_has_svt(), 'ffmpeg עם libsvtav1 חסר')
class EndToEndOffset(EndToEnd):
    """מקור שזמן ההתחלה שלו לא אפס (MKV / TS מצלמות) והקול מתחיל לפני הווידאו — וקפיצה מהירה שנוחתת אחרי היעד."""
    SRC, EXTRA = 'src.mkv', ['-output_ts_offset', '3.5']


if __name__ == '__main__':
    unittest.main()
