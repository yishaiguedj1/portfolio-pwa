"""טקסט שעל המסך (25/10/2026): הכתוביות מורמות מעליו או עוברות לראש המסך. משפטים סינתטיים בלבד.

המודל האמיתי (PP-OCRv3) — רק כש־SNB_BURN_DIR מצביע עליו (בתמונת העובד: בדיקת העשן ב־Dockerfile)."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from vt import burnin as B  # noqa: E402
from vt import config as C  # noqa: E402
from vt.subs import write_ass, write_ass_compat  # noqa: E402

HAS_FF = shutil.which('ffmpeg') is not None
STYLE = C.STYLES['bold']
WD, HD = 1920, 1080
ST = STYLE.scaled(WD, HD)


class Meas:
    """רוחב קבוע לתו — מספיק כדי לבדוק את הגאומטריה."""
    def width(self, line):
        return 30.0 * len(line)


M = Meas()
BANNER = [0.1, 0.75, 0.9, 0.86]          # פס רחב בתחתית (כמו של ערוץ חדשות)
CORNER = [0.0, 0.88, 0.08, 0.95]         # לוגו בפינה — לא בדרך של כתובית ממורכזת


def cue(i, s, e, lines):
    return {'id': i, 'start': s, 'end': e, 'lines': lines}


def burned(boxes_at):
    """boxes_at: [(t, [box...])] → burned.json"""
    return {'v': 1, 'fps': 2, 'frames': [[t, bs] for t, bs in boxes_at if bs]}


def every(s, e, bs):
    k = int(s * 2)
    out = []
    while k / 2 <= e:
        out.append((k / 2, bs))
        k += 1
    return out


class TestComponents(unittest.TestCase):
    def test_two_blobs_and_diagonal(self):
        m = np.zeros((10, 20), bool)
        m[1:3, 1:5] = True              # רכיב 1
        m[3, 5] = True                   # נוגע באלכסון — אותו רכיב
        m[6:8, 10:18] = True             # רכיב 2
        comps = sorted(B.components(m))
        self.assertEqual(len(comps), 2)
        self.assertEqual(comps[0][:4], (1, 4, 1, 6))
        self.assertEqual(comps[1][:4], (6, 8, 10, 18))

    def test_prob_boxes_filters(self):
        fh, fw = 360, 640
        p = np.zeros((100, fw), np.float32)
        p[20:30, 100:400] = 0.9          # שורת טקסט רחבה — נשארת
        p[50:57, 500:512] = 0.95         # צרה מדי (12px < 3%)
        p[70:72, 100:300] = 0.95         # נמוכה מדי (2px)
        p[80:95, 600:615] = 0.95         # גבוהה מרוחבה
        p[40:46, 100:300] = 0.35         # ציון נמוך
        bs = B.prob_boxes(p, 200, fh, fw)
        self.assertEqual(len(bs), 1)
        big = np.zeros((200, fw), np.float32)
        big[10:70, 100:300] = 0.95       # גוש של 60 שורות (0.17 מהגובה) — רגליים ודוכן, לא שורת טקסט
        self.assertEqual(B.prob_boxes(big, 0, fh, fw), [])
        self.assertEqual(len(bs), 1)
        x1, y1, x2, y2 = bs[0]
        self.assertAlmostEqual(y1, 220 / fh, places=3)
        self.assertAlmostEqual(x1, 100 / fw, places=3)

    def test_ctc_conf(self):
        pred = np.full((8, 5), 0.01, np.float32)
        for t, c in enumerate([0, 2, 2, 0, 3, 0, 0, 4]):
            pred[t, c] = 0.9
        n, conf = B.ctc_conf(pred)
        self.assertEqual(n, 3)            # 2 (פעם אחת), 3, 4
        self.assertAlmostEqual(conf, 0.9, places=5)
        self.assertEqual(B.ctc_conf(np.eye(5)[[0, 0, 0]])[0], 0)

    def test_unclip_grows_inside_frame(self):
        x1, y1, x2, y2 = B.unclip([0.5, 0.9, 0.7, 0.95], 640, 360)
        self.assertLess(x1, 320)
        self.assertLess(y1, 324)
        self.assertLessEqual(y2, 360)


class TestPlace(unittest.TestCase):
    def test_lift_above_banner(self):
        cs = [cue(1, 0.0, 3.0, ['שורה אחת קצרה']), cue(2, 3.2, 6.0, ['שורה ראשונה', 'ושורה שנייה'])]
        st = B.place(cs, burned(every(0, 6, [BANNER])), ST, M, WD, HD)
        self.assertEqual(st['lift'], 2)
        self.assertTrue(all(c.get('lift') for c in cs))
        self.assertEqual(cs[0]['lift'], cs[1]['lift'])        # אותו גובה לכתוביות סמוכות
        r = B.cue_rect(cs[1], ST, M, WD, HD, cs[1]['lift'])
        self.assertLessEqual(r[3], BANNER[1])                  # התחתית מעל הפס
        self.assertGreaterEqual(r[1], B.MAX_UP)

    def test_corner_logo_and_short_flash_stay(self):
        cs = [cue(1, 0.0, 4.0, ['כתובית ממורכזת']), cue(2, 5.0, 9.0, ['עוד כתובית'])]
        frames = every(0, 4, [CORNER]) + [(5.0, [BANNER])]     # פס בפריים אחד מתוך 9 — פחות מ־30%
        st = B.place(cs, burned(frames), ST, M, WD, HD)
        self.assertEqual((st['lift'], st['top']), (0, 0))
        self.assertFalse(any(c.get('lift') or c.get('top') for c in cs))

    def test_top_when_no_room_below_middle(self):
        tall = [0.1, 0.62, 0.9, 0.86]                          # גוש טקסט מ־62% — אין מקום מעליו לפני האמצע
        cs = [cue(1, 0.0, 3.0, ['שורה ראשונה', 'ושורה שנייה'])]
        st = B.place(cs, burned(every(0, 3, [tall])), ST, M, WD, HD)
        self.assertEqual(st['top'], 1)
        self.assertTrue(cs[0].get('top'))
        self.assertNotIn('lift', cs[0])

    def test_stays_when_top_also_busy(self):
        tall = [0.1, 0.62, 0.9, 0.86]
        header = [0.1, 0.03, 0.9, 0.2]
        cs = [cue(1, 0.0, 3.0, ['שורה'])]
        st = B.place(cs, burned(every(0, 3, [tall, header])), ST, M, WD, HD)
        self.assertEqual((st['lift'], st['top']), (0, 0))

    def test_table_row_on_the_side_goes_top(self):
        # שקף עם טבלה: הכתובית בדרך לשורה התחתונה, והמקום שמעליה "פנוי" באמצע — אבל בצדדים יש תאים באותה שורה
        # (המספרים באמצע — הגלאי מפספס). לא נדחסים לתוך הטבלה — לראש המסך
        bottom = [0.3, 0.86, 0.7, 0.9]
        side = [[0.02, 0.74, 0.12, 0.77], [0.88, 0.74, 0.98, 0.77]]
        cs = [cue(1, 0.0, 3.0, ['שורה אחת קצרה'])]
        st = B.place(cs, burned(every(0, 3, [bottom] + side)), ST, M, WD, HD)
        self.assertEqual((st['lift'], st['top']), (0, 1))

    def test_text_above_seen_once_blocks_lift(self):
        # טקסט מעל המקום החדש, אפילו בפריים אחד (הגלאי מסמן כל פעם תאים אחרים) — לא מרימים
        bottom = [0.3, 0.86, 0.7, 0.9]
        cs = [cue(1, 0.0, 3.0, ['שורה אחת קצרה'])]
        r = B.cue_rect(cs[0], ST, M, WD, HD, 0.1)
        above = [0.45, r[1] - 0.04, 0.55, r[1] - 0.02]
        frames = every(0, 3, [bottom])
        frames[0] = (frames[0][0], [bottom, above])
        st = B.place(cs, burned(frames), ST, M, WD, HD)
        self.assertEqual(st['lift'], 0)
        cs = [cue(1, 0.0, 3.0, ['שורה אחת קצרה'])]
        st = B.place(cs, burned(every(0, 3, [bottom])), ST, M, WD, HD)   # בלעדיו — מרימים
        self.assertEqual(st['lift'], 1)

    def test_lift_capped(self):
        # גוש שמתחיל ב־55% — הרמה מעליו גדולה מרבע מסך (כבר אמצע התמונה) — לראש המסך
        cs = [cue(1, 0.0, 3.0, ['שורה'])]
        st = B.place(cs, burned(every(0, 3, [[0.2, 0.55, 0.8, 0.9]])), ST, M, WD, HD)
        self.assertEqual((st['lift'], st['top']), (0, 1))

    def test_imported_top_untouched_and_idempotent(self):
        cs = [cue(1, 0.0, 3.0, ['שורה']), cue(2, 3.5, 6.0, ['שורה ראשונה', 'ושורה שנייה'])]
        cs[0]['top'] = True
        b = burned(every(0, 6, [BANNER]))
        B.place(cs, b, ST, M, WD, HD)
        self.assertTrue(cs[0]['top'])
        self.assertNotIn('lift', cs[0])
        lift = cs[1]['lift']
        B.place(cs, b, ST, M, WD, HD)                           # בנייה שנייה — אותה תוצאה
        self.assertEqual(cs[1]['lift'], lift)

    def test_no_frames(self):
        cs = [cue(1, 0.0, 3.0, ['שורה'])]
        self.assertEqual(B.place(cs, {'fps': 2, 'frames': []}, ST, M, WD, HD)['lift'], 0)


class TestSubs(unittest.TestCase):
    def test_ass_lift_moves_lines_up(self):
        c = cue(1, 0.0, 2.0, ['שורה ראשונה', 'ושורה שנייה'])
        base = write_ass([c], STYLE, WD, HD)
        c['lift'] = 0.2
        up = write_ass([c], STYLE, WD, HD)
        ys0 = [float(x.split('\\pos(')[1].split(',')[1].split(')')[0]) for x in base.splitlines() if x.startswith('Dialogue: 0')]
        ys1 = [float(x.split('\\pos(')[1].split(',')[1].split(')')[0]) for x in up.splitlines() if x.startswith('Dialogue: 0')]
        self.assertEqual(len(ys0), 2)
        for a, b in zip(ys0, ys1):
            self.assertAlmostEqual(a - b, 0.2 * HD, places=1)
        compat = write_ass_compat([c], STYLE, WD, HD)
        ev = [x for x in compat.splitlines() if x.startswith('Dialogue:')][0]
        mv = int(ev.split(',')[7])
        self.assertGreater(mv, int(0.2 * HD))


class TestRerender(unittest.TestCase):
    def test_position_kept_only_without_edit(self):
        import rerender
        raw = [{'start': 0, 'end': 2, 'lines': ['א'], 'lift': 0.2}, {'start': 3, 'end': 5, 'lines': ['ב'], 'top': True},
               {'start': 6, 'end': 8, 'lines': ['ג'], 'lift': 0.9}, {'start': 9, 'end': 11, 'lines': ['ד'], 'lift': True}]
        kept = rerender.norm_cues(raw, 0, pos=True)
        self.assertEqual(kept[0].get('lift'), 0.2)
        self.assertTrue(kept[1].get('top'))
        self.assertNotIn('lift', kept[2])                       # מחוץ לטווח
        self.assertNotIn('lift', kept[3])                       # לא מספר
        self.assertFalse(any('lift' in c or 'top' in c for c in rerender.norm_cues(raw, 0)))


class TestShotsPass(unittest.TestCase):
    @unittest.skipUnless(HAS_FF, 'ffmpeg')
    def test_one_pass_shots_and_burn_with_fake_detector(self):
        from vt import media
        with tempfile.TemporaryDirectory() as td:
            src = Path(td) / 'v.mp4'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                            'color=red:s=320x180:d=2:r=25', '-f', 'lavfi', '-i', 'color=blue:s=320x180:d=2:r=25',
                            '-filter_complex', '[0][1]concat=n=2:v=1:a=0', '-pix_fmt', 'yuv420p', str(src)], check=True)
            seen = []

            class Fake:
                reads = 0

                def __init__(self, *a, **k):
                    pass

                def frame(self, img, t=None):
                    seen.append((img.shape, t))
                    return [[0.2, 0.8, 0.8, 0.85]] if t and t >= 2 else []
            old_d, old_a = B.Detector, B.available
            B.Detector, B.available = Fake, lambda: True
            try:
                out = Path(td) / 'burned.json'
                shots = media.detect_shots(src, 10.0, burn_out=out)
            finally:
                B.Detector, B.available = old_d, old_a
            self.assertTrue(any(abs(s['t'] - 2.0) < 0.1 for s in shots), shots)
            d = json.loads(out.read_text(encoding='utf-8'))
            self.assertEqual(d['fps'], 2)
            self.assertEqual(seen[0][0], (d['fh'], 640, 3))
            self.assertEqual(len(seen), d['n'])
            self.assertTrue(all(t >= 2 for t, _ in d['frames']))
            self.assertTrue(d['frames'])

    @unittest.skipUnless(HAS_FF, 'ffmpeg')
    def test_detector_failure_keeps_shots(self):
        from vt import media
        with tempfile.TemporaryDirectory() as td:
            src = Path(td) / 'v.mp4'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                            'color=red:s=320x180:d=1:r=25', '-pix_fmt', 'yuv420p', str(src)], check=True)

            class Boom:
                reads = 0

                def __init__(self, *a, **k):
                    raise RuntimeError('no model')
            old_d, old_a = B.Detector, B.available
            B.Detector, B.available = Boom, lambda: True
            try:
                out = Path(td) / 'burned.json'
                shots = media.detect_shots(src, 10.0, burn_out=out)
            finally:
                B.Detector, B.available = old_d, old_a
            self.assertIsInstance(shots, list)
            self.assertFalse(out.exists())


@unittest.skipUnless(os.environ.get('SNB_BURN_DIR') and B.available(), 'המודלים של PP-OCRv3 (SNB_BURN_DIR)')
class TestRealModel(unittest.TestCase):
    def test_finds_drawn_text_not_blank(self):
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new('RGB', (640, 360), (40, 60, 90))
        dr = ImageDraw.Draw(img)
        dr.rectangle([60, 270, 580, 310], fill=(20, 40, 160))
        dr.text((80, 276), 'NEWS FROM THE MEETING', fill='white', font=ImageFont.truetype(str(C.FONTS_DIR / 'Arimo-Bold.ttf'), 26))
        d = B.Detector()
        bs = d.frame(np.asarray(img), 0.0)
        self.assertTrue(any(b[1] >= 0.7 and b[3] <= 0.9 for b in bs), bs)
        self.assertEqual(d.frame(np.zeros((360, 640, 3), np.uint8), 1.0), [])


if __name__ == '__main__':
    unittest.main()
