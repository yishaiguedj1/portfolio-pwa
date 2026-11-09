"""ה־OCR של השקפים (vt/ocr.py, גל 0 — PR 0.1): סידור RTL לפי מיקום המילים, פענוח TSV, סינון רעש, מאגר התהליכים
והגבול המשתנה שלו. Tesseract אמיתי — רק כשהוא מותקן (בתמונת העובד; ב־CI מדולג)."""
import sys
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vt import ocr as O  # noqa: E402

HEAD = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"


def tsv(rows):
    """rows = [(block, par, line, word, x, y, w, h, conf, text)] → TSV כמו של Tesseract, עם שורות המבנה (level 1–4)."""
    out = [HEAD, "1\t1\t0\t0\t0\t0\t0\t0\t1280\t720\t-1\t"]
    seen = set()
    for b, p, l, n, x, y, w, h, c, t in rows:
        if (b, p, l) not in seen:
            seen.add((b, p, l))
            out.append(f"4\t1\t{b}\t{p}\t{l}\t0\t{x}\t{y}\t{w}\t{h}\t-1\t")
        out.append(f"5\t1\t{b}\t{p}\t{l}\t{n}\t{x}\t{y}\t{w}\t{h}\t{c}\t{t}")
    return "\n".join(out) + "\n"


# שקף "הרצאה על Machine Learning" כפי ש־Tesseract מחזיר אותו: מילה־מילה עם מיקום, בסדר משמאל לימין בשורה מעורבת
SLIDE = tsv([
    (1, 1, 1, 1, 100, 40, 160, 50, 93.1, "Machine"),
    (1, 1, 1, 2, 280, 40, 170, 50, 91.7, "Learning"),
    (1, 1, 1, 3, 480, 40, 60, 50, 95.0, "‏על"),
    (1, 1, 1, 4, 560, 40, 150, 50, 96.2, "הרצאה‎"),
    (2, 1, 1, 1, 900, 200, 80, 40, 90.0, "פרק"),
    (2, 1, 1, 2, 860, 200, 20, 40, 88.0, "3"),
    (2, 1, 1, 3, 740, 200, 100, 40, 92.0, "מתוך"),
    (2, 1, 1, 4, 690, 200, 40, 40, 89.0, "10"),
    (3, 1, 1, 1, 80, 400, 200, 40, 94.0, "Gradient"),
    (3, 1, 1, 2, 300, 400, 180, 40, 95.0, "descent"),
    (4, 1, 1, 1, 1200, 680, 10, 30, 12.0, "|"),        # רעש — קו של אייקון
    (5, 1, 1, 1, 600, 600, 30, 30, 21.0, "ee"),        # רעש — מילה קצרה בביטחון נמוך
    (6, 1, 1, 1, 50, 650, 40, 30, 33.0, "Hi"),         # שורה קצרה בביטחון נמוך
])


class TestReorder(unittest.TestCase):
    def test_ltr_line(self):
        self.assertEqual(O.reorder_line([(300, "descent"), (80, "Gradient")]), "Gradient descent")

    def test_rtl_with_english_term(self):
        w = [(100, "Machine"), (280, "Learning"), (480, "על"), (560, "הרצאה")]
        self.assertEqual(O.reorder_line(w), "הרצאה על Machine Learning")

    def test_numbers_inside(self):
        w = [(900, "פרק"), (860, "3"), (740, "מתוך"), (690, "10")]
        self.assertEqual(O.reorder_line(w), "פרק 3 מתוך 10")

    def test_english_first_in_rtl(self):
        self.assertEqual(O.reorder_line([(500, "GPT-4"), (400, "הוא"), (300, "מודל")]), "GPT-4 הוא מודל")

    def test_english_run_in_middle(self):
        w = [(520, "השתמשנו"), (420, "learning"), (320, "deep"), (220, "כאן")]
        self.assertEqual(O.reorder_line(w), "השתמשנו deep learning כאן")

    def test_clean_bidi_and_nfc(self):
        self.assertEqual(O.clean("‫שָׁלוֹם‬‎ "), "שָׁלוֹם")
        self.assertEqual(O.clean("é"), "é")


class TestTsv(unittest.TestCase):
    def test_words(self):
        ws = O.tsv_words(SLIDE)
        self.assertEqual(len(ws), 13)
        self.assertEqual(ws[2]["text"], "על")             # סימני bidi הוסרו
        self.assertEqual(ws[0]["key"], (1, 1, 1))
        self.assertEqual(O.tsv_words(""), [])
        self.assertEqual(O.tsv_words("garbage\nrows"), [])

    def test_lines(self):
        ls = O.lines(O.tsv_words(SLIDE))
        self.assertEqual([x["text"] for x in ls], ["הרצאה על Machine Learning", "פרק 3 מתוך 10", "Gradient descent"])
        t = ls[0]
        self.assertEqual((t["lang"], t["dir"], t["words"]), ("mix", "rtl", 4))
        self.assertEqual(t["box"], [100, 40, 610, 50])
        self.assertEqual(t["conf"], 94)
        self.assertEqual((ls[1]["lang"], ls[1]["dir"]), ("he", "rtl"))
        self.assertEqual((ls[2]["lang"], ls[2]["dir"]), ("en", "ltr"))
        self.assertTrue(all(isinstance(x["conf"], int) for x in ls))

    def test_lang_of(self):
        self.assertEqual(O.lang_of("שלום"), "he")
        self.assertEqual(O.lang_of("hello"), "en")
        self.assertEqual(O.lang_of("שלום hello"), "mix")
        self.assertEqual(O.lang_of("2026 — 3.5%"), "other")


class TestOcr(unittest.TestCase):
    def setUp(self):
        self._run = O.run_tsv

    def tearDown(self):
        O.run_tsv = self._run

    def test_ocr_with_fake_tesseract(self):
        O.run_tsv = lambda src, *a, **k: SLIDE
        r = O.ocr("slide.png")
        self.assertEqual(len(r["lines"]), 3)
        self.assertEqual(r["words"], 10)
        self.assertTrue(80 <= r["conf"] <= 100)
        self.assertNotIn("error", r)

    def test_ocr_error_kept(self):
        def boom(*a, **k):
            raise RuntimeError("tesseract (1): bad image")
        O.run_tsv = boom
        r = O.ocr(b"not an image")
        self.assertEqual(r["lines"], [])
        self.assertIn("bad image", r["error"])

    def test_numpy_goes_through_png(self):
        import numpy as np
        seen = {}

        def fake(src, *a, **k):
            seen["src"] = src
            return SLIDE
        O.run_tsv = fake
        O.ocr(np.full((40, 60), 255, np.uint8))
        self.assertTrue(isinstance(seen["src"], bytes) and seen["src"][:8] == b"\x89PNG\r\n\x1a\n")


class TestPool(unittest.TestCase):
    def test_order_and_limit(self):
        lock = threading.Lock()
        state = {"now": 0, "peak": 0}

        def fn(x):
            with lock:
                state["now"] += 1
                state["peak"] = max(state["peak"], state["now"])
            time.sleep(0.02)
            with lock:
                state["now"] -= 1
            return x * 2
        p = O.Pool(3, fn=fn)
        self.assertEqual(p.map(range(12)), [x * 2 for x in range(12)])
        self.assertLessEqual(state["peak"], 3)
        self.assertGreaterEqual(state["peak"], 2)
        self.assertEqual(p.map([]), [])

    def test_set_limit_while_running(self):
        lock = threading.Lock()
        state = {"now": 0, "peak_after": 0, "n": 0}
        p = None

        def fn(x):
            with lock:
                state["now"] += 1
                state["n"] += 1
                if state["n"] > 6:
                    state["peak_after"] = max(state["peak_after"], state["now"])
                if state["n"] == 4:
                    p.set_limit(1)                    # שומר הזיכרון מוריד את הגבול באמצע
            time.sleep(0.02)
            with lock:
                state["now"] -= 1
            return x
        p = O.Pool(4, fn=fn)
        self.assertEqual(p.map(range(16)), list(range(16)))
        self.assertEqual(state["peak_after"], 1)
        p.set_limit(99)
        self.assertEqual(p.limit, 4)                  # לא מעל המקסימום שהמאגר נבנה איתו
        p.set_limit(0)
        self.assertEqual(p.limit, 1)


@unittest.skipUnless(O.available() and "heb" in O.langs(), "Tesseract עם עברית לא מותקן")
class TestRealTesseract(unittest.TestCase):
    """שקף ‏1280×720 שצויר ב־Pillow (raqm) — עברית, מעורב ואנגלית — וחוזר מ־Tesseract בסדר הנכון."""

    @classmethod
    def setUpClass(cls):
        from PIL import Image, ImageDraw, ImageFont, features
        if not features.check("raqm"):
            raise unittest.SkipTest("Pillow בלי raqm — אין רינדור RTL")
        font = str(Path(__file__).resolve().parents[1] / "fonts" / "Assistant-SemiBold.ttf")
        im = Image.new("L", (1280, 720), 255)
        d = ImageDraw.Draw(im)
        f1, f2 = ImageFont.truetype(font, 60), ImageFont.truetype(font, 44)
        d.text((1200, 60), "הרצאה על Machine Learning", font=f1, fill=0, direction="rtl", anchor="ra")
        d.text((1200, 240), "פרק 3 מתוך 10", font=f2, fill=0, direction="rtl", anchor="ra")
        d.text((80, 420), "Gradient descent converges", font=f2, fill=0, direction="ltr", anchor="la")
        cls.im = im

    def test_slide(self):
        r = O.ocr(self.im)
        self.assertNotIn("error", r)
        texts = [x["text"] for x in r["lines"]]
        self.assertEqual(texts, ["הרצאה על Machine Learning", "פרק 3 מתוך 10", "Gradient descent converges"], r)
        self.assertEqual([x["dir"] for x in r["lines"]], ["rtl", "rtl", "ltr"])
        self.assertGreater(r["conf"], 70)

    def test_pool_real(self):
        rs = O.Pool(2).map([self.im, self.im, self.im])
        self.assertEqual(len(rs), 3)
        self.assertTrue(all(len(x["lines"]) == 3 for x in rs))

    def test_meta(self):
        self.assertTrue(O.version().startswith("tesseract 5"), O.version())
        self.assertIn("eng", O.langs())


if __name__ == "__main__":
    unittest.main()
