"""סבב 9: מסגור אוטומטי לדובר (frame.py) — פענוח YuNet, בחירת הדובר, "צלם" (אזור מת, פאן, תפרים), ביטוי ה־crop
ב־ffmpeg אמיתי, ומעקב מקצה לקצה עם גלאי מדומה. הרצה: python -m unittest tests.test_frame (מתוך translator/)."""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import edl as E      # noqa: E402
import frame as F    # noqa: E402

try:
    import numpy as np
except ImportError:   # pragma: no cover
    np = None
try:
    import onnxruntime  # noqa: F401
    HAS_ORT = True
except ImportError:
    HAS_ORT = False
HAS_FF = shutil.which('ffmpeg') is not None


def run(cmd):
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


class Model(unittest.TestCase):
    def test_sha(self):
        self.assertTrue(F.model_ok(), 'המודל בריפו = ה־sha256 שב־frame.py וב־models/README.md')
        self.assertIn(F.MODEL_SHA256, (F.MODEL.parent / 'README.md').read_text(encoding='utf-8'))
        self.assertFalse(F.model_ok(F.MODEL.parent / 'README.md'), 'קובץ אחר — לא נטען')

    @unittest.skipUnless(HAS_ORT and np is not None, 'בלי onnxruntime')
    def test_loads_and_blank(self):
        det = F.detector()
        self.assertIsNotNone(det)
        self.assertEqual(det(np.zeros((F.IN, F.IN, 3), dtype=np.uint8)), [], 'תמונה ריקה — בלי פנים')


@unittest.skipUnless(np is not None, 'בלי numpy')
class Decode(unittest.TestCase):
    def outs(self, hits):
        o = {}
        for s in F.STRIDES:
            n = (F.IN // s) ** 2
            o['cls_%d' % s], o['obj_%d' % s] = np.zeros((1, n, 1), np.float32), np.zeros((1, n, 1), np.float32)
            o['bbox_%d' % s], o['kps_%d' % s] = np.zeros((1, n, 4), np.float32), np.zeros((1, n, 10), np.float32)
        for s, r, c, sc, bb in hits:
            i = r * (F.IN // s) + c
            o['cls_%d' % s][0, i, 0], o['obj_%d' % s][0, i, 0] = sc, 1.0
            o['bbox_%d' % s][0, i] = bb
        return o

    def test_box(self):
        f = F.decode(self.outs([(16, 10, 20, 0.81, [0.5, 0.25, math.log(4), math.log(5)])]))
        self.assertEqual(len(f), 1)
        x, y, w, h, sc = f[0]
        self.assertAlmostEqual(w, 64, 3); self.assertAlmostEqual(h, 80, 3)
        self.assertAlmostEqual(x + w / 2, (20 + 0.5) * 16, 3); self.assertAlmostEqual(y + h / 2, (10 + 0.25) * 16, 3)
        self.assertAlmostEqual(sc, 0.9, 3, 'ציון = √(cls × obj)')

    def test_threshold_and_nms(self):
        self.assertEqual(F.decode(self.outs([(8, 5, 5, 0.3, [0, 0, 1, 1])])), [], 'ציון נמוך — לא פנים')
        f = F.decode(self.outs([(16, 10, 20, 0.9, [0, 0, 1.5, 1.5]), (16, 10, 21, 0.8, [-0.2, 0, 1.5, 1.5]), (32, 2, 2, 0.9, [0, 0, 1, 1])]))
        self.assertEqual(len(f), 2, 'שתי תיבות חופפות — אחת (NMS); פנים אחרות נשארות')


class Choose(unittest.TestCase):
    def test_biggest_and_near(self):
        faces = [(10, 10, 40, 40, 0.9), (400, 10, 50, 50, 0.9)]
        self.assertAlmostEqual(F.choose(faces, 640), 425 / 640, 4, 'הגדולה')
        self.assertAlmostEqual(F.choose(faces, 640, prev=30 / 640), 30 / 640, 4, 'הקרובה למסגרת (≥60% מהגדולה) — לא קופצים')
        self.assertAlmostEqual(F.choose([(10, 10, 20, 20, 0.9), (400, 10, 50, 50, 0.9)], 640, prev=20 / 640), 425 / 640, 4, 'קטנה בהרבה — הגדולה')
        self.assertIsNone(F.choose([], 640))

    def test_crop_pos(self):
        self.assertEqual(F.crop_pos(0.5, 1920, 608), 0.5)
        self.assertEqual(F.crop_pos(0.0, 1920, 608), 0.0)
        self.assertEqual(F.crop_pos(1.0, 1920, 608), 1.0)
        self.assertAlmostEqual(F.crop_pos(0.25, 1920, 608), (480 - 304) / 1312, 6)
        self.assertEqual(F.crop_pos(0.9, 600, 600), 0.5, 'אין לאן לזוז')


class Smooth(unittest.TestCase):
    def test_dead_zone_and_hold(self):
        s = [(i / 2, 0.2 + (0.03 if i % 2 else 0)) for i in range(10)]
        x0, kf = F.smooth(s)
        self.assertEqual((x0, kf), (0.2, []), 'רעד בתוך האזור המת — המסגרת עומדת')
        s = [(i / 2, 0.2) for i in range(6)] + [(3.0, 0.9)] + [(i / 2, 0.2) for i in range(7, 12)]
        self.assertEqual(F.smooth(s)[1], [], 'פריים בודד חריג — לא זזים (חציון + שנייה מחוץ לאזור)')
        s = [(i / 2, 0.2) for i in range(6)] + [(i / 2, 0.8) for i in range(6, 14)]
        x0, kf = F.smooth(s)
        self.assertEqual(len(kf), 1)
        t, a, b, d = kf[0]
        self.assertEqual((a, b, d), (0.2, 0.8, F.PAN))
        self.assertTrue(3.0 <= t <= 4.0, 'זזים אחרי שנייה מחוץ לאזור המת')

    def test_cut_jumps(self):
        s = [(i / 2, 0.1, 0) for i in range(4)] + [(i / 2, 0.9, 1) for i in range(4, 8)]
        x0, kf = F.smooth(s, {0: 0, 1: 2.0})
        self.assertEqual(kf, [(2.0, 0.1, 0.9, 0.0)], 'בתפר בין קטעים — קפיצה מיידית')

    def test_none_and_fill(self):
        self.assertIsNone(F.smooth([(0, None), (0.5, None)]), 'בלי פנים בכלל — None (המיקום הקבוע)')
        x0, kf = F.smooth([(0, None), (0.5, 0.7), (1, None), (1.5, 0.7)])
        self.assertEqual((x0, kf), (0.7, []), 'פריים בלי פנים — הקודם')

    def test_kf_cap(self):
        s = [(i / 2, 0.1 if (i // 3) % 2 else 0.9) for i in range(2000)]
        x0, kf = F.smooth(s)
        self.assertLessEqual(len(kf), F.KF_MAX)

    def test_expr(self):
        e = F.x_expr(1312, 0.25, [(2.0, 0.25, 0.75, 0.5), (5.0, 0.75, 0.0, 0.0)])
        self.assertEqual(e, '2*trunc(1312*(0.2500+0.5000*clip((t-2.000)/0.500\\,0\\,1)-0.7500*gte(t\\,5.000))/2)')
        self.assertNotRegex(e, r'[^0-9a-z().*+\-/\\,]', 'רק מספרים ופונקציות')


@unittest.skipUnless(HAS_FF and np is not None, 'בלי ffmpeg / numpy')
class Ffmpeg(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())
        # 640×360, 4 שנ׳: ריבוע לבן ב־x=40 עד שנייה 2, ואז ב־x=520 ("הדובר" עובר לצד השני)
        self.src = self.d / 'src.mp4'
        run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=c=black:s=640x360:r=10:d=4',
             '-vf', "drawbox=x=40:y=140:w=80:h=80:color=white:t=fill:enable='lt(t,2)',drawbox=x=520:y=140:w=80:h=80:color=white:t=fill:enable='gte(t,2)'", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(self.src)])

    def tearDown(self):
        shutil.rmtree(self.d, ignore_errors=True)

    def frame_at(self, path, t, w, h):
        p = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-ss', str(t), '-i', str(path), '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1'],
                           check=True, stdout=subprocess.PIPE).stdout
        return np.frombuffer(p, np.uint8).reshape(h, w)

    def fake_detect(self, img):
        g = img[:, :, 0]
        cols = np.nonzero(g.max(axis=0) > 128)[0]
        rows = np.nonzero(g.max(axis=1) > 128)[0]
        if not len(cols):
            return []
        return [(float(cols[0]), float(rows[0]), float(cols[-1] - cols[0] + 1), float(rows[-1] - rows[0] + 1), 0.9)]

    def test_track_and_render(self):
        e = E.norm_edl({'k': [], 'ar': '9:16', 'x': 0.5, 'af': True}, 4)
        self.assertTrue(e['af'])
        info = E.probe(self.src)
        xt = F.track(self.src, e, info, detect=self.fake_detect)
        self.assertIsNotNone(xt)
        free, x0, kf = xt
        cb = E.crop_box(640, 360, '9:16', 0.5)
        self.assertEqual(free, 640 - cb['w'])
        self.assertLess(x0, 0.1, 'בהתחלה — הריבוע משמאל')
        self.assertEqual(len(kf), 1, 'מעבר אחד')
        self.assertTrue(2.0 <= kf[0][0] <= 3.5 and kf[0][2] > 0.9 and kf[0][3] == F.PAN, kf)
        out = self.d / 'out.mp4'
        run(E.ffmpeg_args(self.src, out, e, info, xt=xt))
        w, h = cb['w'], cb['h']
        a, b = self.frame_at(out, 0.5, w, h), self.frame_at(out, 3.8, w, h)
        self.assertGreater(a.mean(), 15, 'בהתחלה הריבוע בתוך החיתוך')
        self.assertGreater(b.mean(), 15, 'בסוף — המסגרת עברה אחריו')
        fixed = self.d / 'fixed.mp4'
        run(E.ffmpeg_args(self.src, fixed, e, info))
        self.assertLess(self.frame_at(fixed, 0.5, w, h).mean(), 5, 'בלי מסגור (x=0.5) — הריבוע מחוץ לחיתוך')

    def test_apply_auto_frame_fallback(self):
        # בלי פנים (גלאי שלא מוצא) — המיקום הקבוע, וההפקה לא נופלת
        e = E.norm_edl({'k': [], 'ar': '1:1', 'x': 0.25, 'af': True}, 4)
        info = E.probe(self.src)
        self.assertIsNone(F.track(self.src, e, info, detect=lambda img: []))
        self.assertIsNone(F.track(self.src, E.norm_edl({'k': [], 'ar': '1:1', 'x': 0.25}, 4), info, detect=self.fake_detect), 'בלי af — כלום')
        cut = self.d / 'cut.mp4'
        E.apply(self.src, cut, e, auto_frame=True)
        self.assertTrue(cut.exists())

    def test_segments_and_speed(self):
        # שני קטעים ומהירות ×2: הזמנים בביטוי = הזמנים בתוצאה, ובתפר — קפיצה
        e = E.norm_edl({'k': [[0, 1.5], [2.5, 4]], 'ar': '9:16', 'x': 0.5, 'af': True, 'sp': 2}, 4)
        xt = F.track(self.src, e, E.probe(self.src), detect=self.fake_detect)
        self.assertEqual(len(xt[2]), 1)
        t, a, b, d = xt[2][0]
        self.assertEqual((t, d), (0.75, 0.0), 'התפר (1.5 שנ׳) במהירות ×2 = 0.75 שנ׳ בתוצאה, בלי פאן')


class Norm(unittest.TestCase):
    def test_af_only_with_crop(self):
        self.assertNotIn('af', E.norm_edl({'k': [[0, 5]], 'ar': 'src', 'af': True}, 10) or {}, 'בלי חיתוך — אין מה למסגר')
        self.assertTrue(E.norm_edl({'k': [], 'ar': 'src', 'z': 1.5, 'af': True}, 10)['af'], 'זום = חיתוך')
        self.assertNotIn('af', E.norm_edl({'k': [], 'ar': '9:16', 'af': 1}, 10), 'רק True')
        self.assertNotIn('af', E.pre(E.norm_edl({'k': [], 'ar': '9:16', 'af': True}, 10)), 'לפני התרגום — רק חיתוך ויחס')
        c = E.compose_edl(E.norm_edl({'k': [], 'ar': '9:16', 'af': True}, 10), E.norm_edl({'k': [[1, 5]], 'ar': 'src', 'sp': 2}, 10))
        self.assertTrue(c.get('af'), 'בהרכבה — עם המיקום (EXTRA_POS)')


if __name__ == '__main__':
    unittest.main()
