"""סבב 3 — עורך הווידאו ב׳ (edl.py): מהירות, סיבוב והיפוך, זום, שמע. עם ffmpeg אמיתי (אם יש): המידות, האורך והשמע
של התוצאה כמו שהעריכה אומרת; סרטון עם סימון סיבוב — המידות שהמסנן רואה."""
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import edl as E  # noqa: E402

FF = shutil.which('ffmpeg') and shutil.which('ffprobe')


class TestLogic(unittest.TestCase):
    def test_pre_strips(self):
        e = E.norm_edl({'k': [[2, 6]], 'ar': '9:16', 'x': 0.3, 'sp': 2, 'mu': True, 'z': 2}, 30)
        self.assertEqual(E.pre(e), {'k': [[2, 6]], 'ar': '9:16', 'x': 0.3})
        self.assertIsNone(E.pre(E.norm_edl({'sp': 2}, 30)))

    def test_speed_cues(self):
        c = E.speed_cues([{'start': 2.0, 'end': 4.0, 'lines': ['א']}], 2)
        self.assertEqual((c[0]['start'], c[0]['end'], c[0]['lines']), (1.0, 2.0, ['א']))
        self.assertEqual(E.speed_cues([{'start': 1, 'end': 2}], 1), [{'start': 1, 'end': 2}])

    def test_numbers_only(self):
        """שום טקסט מהעריכה לא נכנס למסנן — רק מספרים מנורמלים"""
        e = E.norm_edl({'sp': '2;rm -rf', 'rt': '90', 'vo': '1e9', 'ar': '9:16[x]', 'fh': 'true'}, 30)
        self.assertIsNone(e)


@unittest.skipUnless(FF, 'אין ffmpeg')
class TestFfmpeg(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.d = Path(tempfile.mkdtemp())
        cls.src = cls.d / 'src.mp4'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc=size=640x360:rate=25:duration=12',
                        '-f', 'lavfi', '-i', 'sine=frequency=440:duration=12', '-c:v', 'libx264', '-preset', 'ultrafast', '-c:a', 'aac', '-shortest',
                        str(cls.src)], check=True)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.d, ignore_errors=True)

    def run_edit(self, name, e):
        ee = E.norm_edl(e, 12)
        out = self.d / (name + '.mp4')
        E.apply(self.src, out, ee)
        return ee, E.probe(out)

    def test_speed_rotate_zoom(self):
        ee, i = self.run_edit('a', {'k': [[1, 9]], 'sp': 2, 'rt': 90, 'z': 1.5, 'y': 0.3, 'fh': True})
        self.assertEqual((i['w'], i['h']), (360, 640), 'סיבוב 90 — אנכי, וזום חוזר לגודל המלא')
        self.assertAlmostEqual(i['dur'], E.out_dur(ee, 12), delta=0.15)
        self.assertTrue(i['a'])

    def test_slow_crop_fades(self):
        ee, i = self.run_edit('b', {'k': [[0, 4]], 'ar': '9:16', 'x': 0.2, 'sp': 0.5, 'fi': 1, 'fo': 2, 'vo': 150})
        self.assertEqual((i['w'], i['h']), (202, 360))
        self.assertAlmostEqual(i['dur'], 8.0, delta=0.15)

    def test_quarter_loudnorm(self):
        ee, i = self.run_edit('c', {'k': [[0, 2]], 'sp': 0.25, 'ln': True})
        self.assertAlmostEqual(i['dur'], 8.0, delta=0.15)

    def test_mute(self):
        ee, i = self.run_edit('d', {'rt': 180, 'fv': True, 'mu': True})
        self.assertFalse(i['a'], 'השתקה — בלי שמע')
        self.assertEqual((i['w'], i['h']), (640, 360))

    def test_rotation_tag(self):
        """סרטון טלפון עם סימון סיבוב: ffprobe מחזיר 640×360, ffmpeg מסובב בפענוח — המסנן רואה 360×640"""
        tagged = self.d / 'tag.mp4'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-display_rotation', '90', '-i', str(self.src), '-c', 'copy', str(tagged)], check=True)
        raw = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', str(tagged)], capture_output=True, text=True).stdout)
        v = next(s for s in raw['streams'] if s['codec_type'] == 'video')
        if not v.get('side_data_list'):
            self.skipTest('ffmpeg ישן — בלי -display_rotation')
        self.assertEqual((E.probe(tagged)['w'], E.probe(tagged)['h']), (360, 640))
        out = self.d / 'tag-crop.mp4'
        E.apply(tagged, out, E.norm_edl({'ar': '1:1'}, 12))
        i = E.probe(out)
        self.assertEqual((i['w'], i['h']), (360, 360), 'החיתוך על המידות האמיתיות (לפני — חיתוך 360 מתוך 640 הלא נכון)')


if __name__ == '__main__':
    unittest.main()
