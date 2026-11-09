"""גלאי השקפים (vt/slides.py, גל 0 — PR 0.1) על סרטונים סינתטיים: חשיפה הדרגתית, החלפה, PiP, סמן נע ונח,
מעבר הדרגתי, מסך ריק, מצלמה בלבד, רקע כהה, עריכה קטנה, גלילה, והנתיב המלא דרך ffmpeg (כשמותקן)."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from vt import slides as S  # noqa: E402

H, W = S.H, S.W
BG, INK = 235, 35


def line(f, y, seed, x0=40, x1=600, h=10, ink=INK):
    """שורת "טקסט": מילים ברוחב אקראי, כל מילה רשת של קווים (כמו אותיות ב־360p)."""
    rng = np.random.default_rng(seed)
    x = x0
    while x < x1 - 30:
        w = int(rng.integers(18, 60))
        w = min(w, x1 - x)
        yy, xx = np.mgrid[0:h, 0:w]
        word = (xx % 3 == 0) | (yy % 4 == 0)
        f[y:y + h, x:x + w][word] = ink
        x += w + 8


def page(seeds, bg=BG, ink=INK, top=50, pitch=24, title=None):
    f = np.full((H, W), bg, np.uint8)
    if title is not None:
        line(f, 14, title, x0=40, x1=400, h=16, ink=ink)
    for k, s in enumerate(seeds):
        if s is not None:
            line(f, top + k * pitch, s, ink=ink)
    return f


def noisy(f, rng, sigma=3.0):
    return np.clip(f.astype(np.float32) + rng.normal(0, sigma, f.shape), 0, 255).astype(np.uint8)


def video(spec, seed=0, sigma=3.0, fx=None):
    """spec = [(פריים, שניות)] → רשימת פריימים ב־1fps עם רעש דחיסה; fx(i, f) — שכבה לכל פריים (סמן, PiP)."""
    rng = np.random.default_rng(seed)
    out = []
    for f, n in spec:
        for _ in range(n):
            g = noisy(f, rng, sigma)
            if fx:
                g = fx(len(out), g)
            out.append(g)
    return out


def run(frames, fps=1.0):
    return S.detect_frames(iter(frames), fps)


def shape(r):
    """[(סוג, [rel של כל מצב])] — לבדיקות קריאות."""
    return [(u["kind"], [s["rel"] for s in u["states"]]) for u in r["units"]]


class TestOps(unittest.TestCase):
    def test_med3_is_median(self):
        rng = np.random.default_rng(1)
        a, b, c = (rng.integers(0, 256, (H, W), dtype=np.uint8) for _ in range(3))
        self.assertTrue(np.array_equal(S.med3(a, b, c), np.median(np.stack([a, b, c]), axis=0).astype(np.uint8)))

    def test_absdiff_no_wrap(self):
        a = np.array([[10, 250]], np.uint8)
        b = np.array([[250, 10]], np.uint8)
        self.assertEqual(S.absdiff(a, b).tolist(), [[240, 240]])

    def test_dilate_box(self):
        m = np.zeros((H, W), bool)
        m[100, 200] = True
        d = S.dilate(m, 7)
        self.assertEqual(int(d.sum()), 49)
        self.assertTrue(d[97, 197] and d[103, 203] and not d[96, 200] and not d[100, 204])
        self.assertEqual(int(S.dilate(m, 1).sum()), 1)

    def test_event_px_cursor_below_text_above(self):
        d = np.zeros((H, W), bool)
        d[100:106, 200:204] = True                      # סמן נח ב־360p: ‏~24 פיקסלים
        self.assertLess(S.event_px(d), S.AREA)
        f = np.full((H, W), BG, np.uint8)
        line(f, 200, 3, x0=40, x1=300)                  # שורת טקסט שנחשפה
        d2 = f != BG
        self.assertGreaterEqual(S.event_px(d2), S.AREA)
        noise = np.zeros((H, W), bool)                  # רעש מפוזר — הרבה פיקסלים, אף רכיב חזק
        noise[::20, ::20] = True
        self.assertGreater(int(noise.sum()), S.AREA)
        self.assertLess(S.event_px(noise), S.AREA)

    def test_roi(self):
        r = S.roi_for(1280, 720)
        self.assertTrue(r.all())
        r = S.roi_for(960, 720)                          # ‏4:3 → ‏480×360 באמצע
        self.assertEqual(int(r.sum()), 480 * 360)
        self.assertFalse(r[:, :80].any() or r[:, 560:].any())
        r = S.roi_for(1080, 1920)                        # אנכי
        self.assertEqual(r.any(axis=0).sum(), 202)
        self.assertTrue(S.roi_for(0, 0).all())


class TestRelate(unittest.TestCase):
    def setUp(self):
        self.v = np.ones((H, W), bool)

    def test_same(self):
        a = page([1, 2, 3])
        self.assertEqual(S.relate(a, a.copy(), self.v)[0], "same")

    def test_reveal(self):
        rel, m = S.relate(page([1, 2]), page([1, 2, 3]), self.v)
        self.assertEqual(rel, "reveal")
        self.assertGreater(m["app"], 0)
        self.assertEqual(m["van"], 0)

    def test_replace(self):
        rel, m = S.relate(page([1, 2, 3, 4], title=7), page([11, 12, 13, 14], title=8), self.v)
        self.assertEqual(rel, "new")
        self.assertGreater(m["van"], S.REVEAL * m["app"])
        self.assertGreater(m["chg"], S.EDIT)

    def test_replace_same_template(self):
        """תבנית כבדה משותפת (פס כותרת כהה) — עדיין שקף חדש, לא עריכה."""
        def tpl(seeds):
            f = page(seeds)
            f[0:36, :] = 70
            f[340:346, 40:600] = 90
            return f
        self.assertEqual(S.relate(tpl([1, 2, 3, 4, 5]), tpl([21, 22, 23, 24, 25]), self.v)[0], "new")

    def test_dark_background_polarity(self):
        a = page([1, 2], bg=25, ink=225)
        b = page([1, 2, 3], bg=25, ink=225)
        self.assertEqual(S.relate(a, b, self.v)[0], "reveal")
        self.assertEqual(S.relate(b, page([5, 6, 7], bg=25, ink=225), self.v)[0], "new")

    def test_edit_small_change(self):
        """עיגול הדגשה (סמן מוגדל) שעובר בין שתי נקודות בשקף עמוס — עריכה, לא שקף חדש."""
        base = page([1, 2, 3, 4, 5, 6, 7, 8])
        a, b = base.copy(), base.copy()
        yy, xx = np.mgrid[0:H, 0:W]
        a[(yy - 120) ** 2 + (xx - 300) ** 2 <= 36] = 0
        b[(yy - 220) ** 2 + (xx - 450) ** 2 <= 36] = 0
        rel, m = S.relate(a, b, self.v)
        self.assertEqual(rel, "edit")
        self.assertLess(m["chg"], S.EDIT)

    def test_mask_hides_change(self):
        a, b = page([1]), page([1])
        b[300:350, 500:630] = 0
        v = self.v.copy()
        v[290:360, 490:640] = False
        self.assertEqual(S.relate(a, b, v)[0], "same")


class TestDetector(unittest.TestCase):
    def test_build_then_next_slide(self):
        r = run(video([(page([1]), 8), (page([1, 2]), 8), (page([1, 2, 3]), 8), (page([11, 12, 13]), 8)]))
        self.assertEqual(shape(r), [("slide", ["new", "reveal", "reveal"]), ("slide", ["new"])])
        u = r["units"][0]
        self.assertEqual([s["id"] for s in u["states"]], ["s1.1", "s1.2", "s1.3"])
        self.assertEqual((u["t0"], u["t1"]), (0.0, 24.0))
        self.assertEqual([s["t0"] for s in u["states"]], [0.0, 8.0, 16.0])
        self.assertEqual(r["units"][1]["t0"], 24.0)
        for s in u["states"]:
            self.assertTrue(s["t0"] <= s["frame_t"] < s["t1"])
        self.assertEqual(r["stats"]["reveal"], 2)
        self.assertFalse(S.noscreen(r))

    def test_replacements(self):
        r = run(video([(page([1, 2, 3]), 6), (page([4, 5, 6]), 6), (page([7, 8]), 6)]))
        self.assertEqual(shape(r), [("slide", ["new"])] * 3)
        self.assertEqual([u["t0"] for u in r["units"]], [0.0, 6.0, 12.0])

    def test_pip_masked(self):
        """PiP של מרצה מדבר (פינה שמשתנה בכל דגימה) — לא שובר את השקף, ומסכת התנועה מוצאת אותו."""
        rng = np.random.default_rng(5)

        def pip(i, f):
            f = f.copy()
            f[268:354, 491:634] = rng.integers(0, 256, (86, 143), dtype=np.uint8)
            return f
        r = run(video([(page([1, 2, 3]), 20), (page([1, 2, 3, 4]), 10), (page([9, 10]), 20)], fx=pip))
        self.assertEqual(shape(r), [("slide", ["new", "reveal"]), ("slide", ["new"])])
        mf = r["units"][0]["states"][0]["m"]["mf"]
        self.assertTrue(0.03 < mf < S.CAM, mf)

    def test_moving_cursor(self):
        """סמן שזז בכל דגימה — החציון מעלים אותו; אין שקפים מזויפים."""
        rng = np.random.default_rng(7)

        def cur(i, f):
            f = f.copy()
            y, x = int(rng.integers(20, 330)), int(rng.integers(20, 610))
            f[y:y + 7, x:x + 5] = 0
            return f
        r = run(video([(page([1, 2, 3]), 30)], fx=cur))
        self.assertEqual(shape(r), [("slide", ["new"])])

    def test_resting_cursor(self):
        """סמן שנח 3 דגימות בכל מקום — עובר את החציון, אבל קטן מ־AREA פיקסלים שהשתנו."""
        rng = np.random.default_rng(8)
        pos = [(int(rng.integers(20, 330)), int(rng.integers(20, 610))) for _ in range(20)]

        def cur(i, f):
            f = f.copy()
            y, x = pos[i // 3]
            f[y:y + 7, x:x + 5] = 0
            return f
        r = run(video([(page([1, 2, 3]), 30)], fx=cur))
        self.assertEqual(shape(r), [("slide", ["new"])])

    def test_fade(self):
        a, b = page([1, 2, 3]), page([4, 5, 6])
        mix = [((a * (1 - t) + b * t)).astype(np.uint8) for t in (0.25, 0.5, 0.75)]
        r = run(video([(a, 10)] + [(m, 1) for m in mix] + [(b, 10)]))
        self.assertEqual(shape(r), [("slide", ["new"]), ("slide", ["new"])])
        self.assertGreaterEqual(r["stats"]["unstable"], 1)
        self.assertEqual(r["stats"]["motion_s"], 0)

    def test_blank_between(self):
        black = np.zeros((H, W), np.uint8)
        a = page([1, 2, 3])
        r = run(video([(a, 8), (black, 5), (a, 8)]))
        self.assertEqual(shape(r), [("slide", ["new", "same"])])
        self.assertEqual(r["units"][0]["states"][1]["same"], "s1.1")
        self.assertGreaterEqual(r["stats"]["blank_s"], 4)
        r = run(video([(a, 8), (black, 5), (page([7, 8, 9]), 8)]))
        self.assertEqual(shape(r), [("slide", ["new"]), ("slide", ["new"])])

    def test_popup_same_content_extends(self):
        """הודעה קופצת לדגימה אחת (נבלעת בחציון) — אותו מצב, טווח אחד."""
        a = page([1, 2, 3])
        pop = a.copy()
        pop[20:60, 400:620] = 80
        r = run(video([(a, 10), (pop, 1), (a, 10)]))
        self.assertEqual(shape(r), [("slide", ["new"])])
        self.assertEqual((r["units"][0]["t0"], r["units"][0]["t1"]), (0.0, 21.0))

    def test_camera_only(self):
        """מצלמה בלבד: מרקם שזז בכל הפריים — יחידת cam אחת, ואין מסך לניתוח."""
        rng = np.random.default_rng(9)
        tex = rng.integers(0, 256, (H + 64, W + 64), dtype=np.uint8)
        k = np.ones(5) / 5
        tex = np.apply_along_axis(lambda r: np.convolve(r, k, "same"), 1, tex.astype(float))
        frames = [np.roll(np.roll(tex, 7 * i, axis=1), 3 * i, axis=0)[:H, :W].astype(np.uint8) for i in range(40)]
        r = run(frames)
        self.assertEqual([u["kind"] for u in r["units"]], ["cam"])
        self.assertTrue(S.noscreen(r))
        self.assertEqual(r["stats"]["slide_s"], 0)

    def test_dark_theme_build(self):
        r = run(video([(page([1], bg=25, ink=225), 8), (page([1, 2], bg=25, ink=225), 8),
                       (page([5, 6], bg=25, ink=225), 8)]))
        self.assertEqual(shape(r), [("slide", ["new", "reveal"]), ("slide", ["new"])])

    def test_scroll_is_motion(self):
        """גלילה של 10 שנ׳ באמצע הרצאה ארוכה — יחידת motion אחת בין שני השקפים, לא עשר יחידות."""
        doc = np.full((H * 3, W), BG, np.uint8)
        for k in range(40):
            line(doc, 20 + k * 24, 100 + k)
        a, b = doc[:H].copy(), doc[2 * H:].copy()
        scroll = [(doc[12 * j * 3:12 * j * 3 + H].copy(), 1) for j in range(1, 11)]
        r = run(video([(a, 70)] + scroll + [(b, 70)]))
        kinds = [u["kind"] for u in r["units"]]
        self.assertEqual(kinds, ["slide", "motion", "slide"])
        m = r["units"][1]
        self.assertGreaterEqual(m["t1"] - m["t0"], S.MOTION_MIN_S)

    def test_memory_bounded(self):
        d = S.Detector(1.0)
        rng = np.random.default_rng(3)
        f = page([1, 2, 3])
        for i in range(400):
            d.push(noisy(f, rng))
            self.assertLessEqual(len(d.raw), d.R + 3)
            self.assertLessEqual(len(d.pairs), 2 * d.R + 1)
        r = d.finish()
        self.assertEqual(shape(r), [("slide", ["new"])])
        self.assertEqual(r["n"], 400)
        self.assertEqual(r["dur"], 400.0)

    def test_short_and_empty(self):
        r = run([page([1])])
        self.assertEqual(shape(r), [("slide", ["new"])])
        r = run([])
        self.assertEqual(r["units"], [])
        self.assertTrue(S.noscreen(r))

    def test_result_shape(self):
        r = run(video([(page([1, 2]), 5)]))
        for k in ("v", "fps", "w", "h", "n", "dur", "units", "stats", "params"):
            self.assertIn(k, r)
        u = r["units"][0]
        self.assertEqual(set(u), {"id", "t0", "t1", "kind", "states"})
        self.assertTrue({"id", "t0", "t1", "frame_t", "rel"} <= set(u["states"][0]))
        for k in ("events", "units", "states", "slide_s", "cam_s", "motion_s", "blank_s", "ms_frame"):
            self.assertIn(k, r["stats"])

    def test_fps_two(self):
        """2 דגימות לשנייה — הזמנים בשניות, לא במספרי דגימות."""
        r = run(video([(page([1, 2]), 12), (page([5, 6]), 12)]), fps=2.0)
        self.assertEqual([u["t0"] for u in r["units"]], [0.0, 6.0])
        self.assertEqual(r["dur"], 12.0)


def _encoder() -> list[str]:
    """libx264 כשקיים (H.264 עם פריימי B — הנתיב של ‏-skip_frame noref), אחרת mpeg4 (בנייה מינימלית של ffmpeg)."""
    out = subprocess.run(["ffmpeg", "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    return ["-c:v", "libx264", "-pix_fmt", "yuv420p"] if " libx264 " in out else ["-c:v", "mpeg4", "-q:v", "2"]


@unittest.skipUnless(shutil.which("ffmpeg") and shutil.which("ffprobe"), "ffmpeg לא מותקן")
class TestFfmpeg(unittest.TestCase):
    def test_lavfi_video(self):
        """סרטון ‏4:3 אמיתי (H.264): כותרת קבועה, שורה שנחשפת ב־4 שנ׳, שקף אחר ב־8 שנ׳."""
        with tempfile.TemporaryDirectory() as td:
            out = os.path.join(td, "v.mp4")
            vf = ("drawbox=x=80:y=60:w=640:h=50:color=black:t=fill:enable='lt(t,8)',"
                  "drawbox=x=80:y=200:w=500:h=40:color=black:t=fill:enable='gte(t,4)*lt(t,8)',"
                  "drawbox=x=200:y=400:w=420:h=120:color=navy:t=fill:enable='gte(t,8)'")
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
                            "color=c=white:s=960x720:d=12:r=10", "-vf", vf] + _encoder() + ["-y", out], check=True)
            logs = []
            r = S.detect(out, log=logs.append)
            self.assertEqual(r["n"], 12)
            self.assertEqual(shape(r), [("slide", ["new", "reveal"]), ("slide", ["new"])])
            self.assertEqual([s["t0"] for s in r["units"][0]["states"]], [0.0, 4.0])
            self.assertEqual(r["units"][1]["t0"], 8.0)
            self.assertIn("decode_s", r["stats"])
            self.assertTrue(logs and "שקפים" in logs[0])
            r2 = S.detect(out, max_s=6)
            self.assertEqual(r2["n"], 6)

    def test_no_video_stream(self):
        with tempfile.TemporaryDirectory() as td:
            out = os.path.join(td, "a.wav")
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i",
                            "anullsrc=r=16000:cl=mono", "-t", "1", "-y", out], check=True)
            with self.assertRaises(RuntimeError):
                S.detect(out, size=(0, 0))


if __name__ == "__main__":
    unittest.main()
