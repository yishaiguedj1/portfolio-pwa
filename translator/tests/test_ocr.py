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


class TestBidiV2(unittest.TestCase):
    """גרסה 2: היפוך אלגוריתם ה־bidi בשורות מעורבות — ניטרליים בקצות אי, תחיליות, מירכאות, כיוון השורה."""

    def test_separator_outside_island(self):
        w = [(900, "דנה"), (800, "לוי"), (700, "|"), (400, "Dana"), (500, "Levi")]
        self.assertEqual(O.reorder(w, "rtl"), "דנה לוי | Dana Levi")
        w = [(900, "ברוכים"), (800, "הבאים"), (700, "—"), (400, "Welcome")]
        self.assertEqual(O.reorder(w, "rtl"), "ברוכים הבאים — Welcome")

    def test_island_edge_punct_and_quotes(self):
        # המירכאה הסוגרת של ‎"fix"‎ מוצגת משמאל ל־git (ניטרלי בין לטינית לעברית מקבל את כיוון השורה)
        w = [(1610, "הפקודה"), (1175, '"git'), (1263, "commit"), (1445, "-m"), (1523, '"fix'), (1031, "שומרת"),
             (931, "שינוי")]
        self.assertEqual(O.reorder(w, "rtl"), 'הפקודה git commit -m "fix" שומרת שינוי')
        w = [(900, "תודה"), (800, "רבה!"), (600, "you"), (400, "!Thank")]
        self.assertEqual(O.reorder(w, "rtl"), "תודה רבה! Thank you!")
        self.assertEqual(O.reorder([(900, "כלי"), (700, '"CRM"'), (500, "מבוסס")], "rtl"), 'כלי "CRM" מבוסס')

    def test_prefix_glue(self):
        self.assertEqual(O.reorder([(900, "מבוא"), (800, "ל"), (600, "React")], "rtl"), "מבוא ל\u05beReact")
        self.assertEqual(O.reorder([(900, "מבוא"), (800, "ל-"), (600, "React")], "rtl"), "מבוא ל-React")
        # "של" היא מילה ולא תחילית
        self.assertEqual(O.reorder([(900, "הרכיבים"), (800, "של"), (600, "React")], "rtl"), "הרכיבים של React")

    def test_line_dir_matrix_language(self):
        # רוב האותיות לטיניות, אבל "על" — המשפט עברי
        self.assertEqual(O.line_dir([(100, "Machine"), (280, "Learning"), (480, "על"), (560, "הרצאה")]), "rtl")
        w = [(100, "Our"), (200, "team"), (300, "in"), (400, "Israel"), (550, "(הצוות"), (700, "בישראל)")]
        self.assertEqual(O.line_dir(w), "ltr")
        # כותרת עם נקודתיים בקצה הימני — עברית
        self.assertEqual(O.line_dir([(900, "הכלים:"), (600, "Excel,"), (400, "Power"), (300, "BI")]), "rtl")

    def test_aligns_same_size_only(self):
        # כותרת גדולה שהקצה השמאלי שלה נופל ליד שורת גוף — לא נחשבת מיושרת לשמאל
        self.assertEqual(O.aligns([[1142, 113, 654, 65], [1065, 267, 691, 46], [1162, 367, 594, 38]]), [None, "r", "r"])

    def test_split_gaps(self):
        ws = [{"x": 100, "w": 100, "h": 40, "text": "a"}, {"x": 210, "w": 100, "h": 40, "text": "b"},
              {"x": 900, "w": 100, "h": 40, "text": "c"}]
        self.assertEqual([[w["text"] for w in p] for p in O.split_gaps(ws)], [["a", "b"], ["c"]])


class TestSegmentsV2(unittest.TestCase):
    def test_codes_are_neutral(self):
        self.assertEqual(O.segments("הכנסות | Q1 2025 | 12.5%"), [["הכנסות | Q1 2025 | 12.5%", "he"]])
        self.assertEqual([lg for _, lg in O.segments("תוצאות A/B Testing: גרסה B ניצחה")], ["he", "en", "he"])
        self.assertEqual(O.lang_of("רשת 5G מהירה"), "he")
        self.assertEqual(O.lang_of("בינה מלאכותית (AI)"), "mix")         # ראשי תיבות של שתי אותיות — מילה
        self.assertEqual(O.lang_of("Q1"), "other")

    def test_scripts_and_latin_languages(self):
        self.assertEqual(O.segments("ברוכים הבאים — Добро пожаловать"),
                         [["ברוכים הבאים —", "he"], ["Добро пожаловать", "ru"]])
        self.assertEqual(O.lang_of("مرحبا بكم"), "ar")
        self.assertEqual(O.latin_lang("Gracias por su atención"), "es")
        self.assertEqual(O.latin_lang("Bienvenue à tous"), "fr")
        self.assertEqual(O.latin_lang("Vielen Dank für Ihre Aufmerksamkeit"), "de")
        self.assertEqual(O.latin_lang("Thank you for watching"), "en")

    def test_page_langs(self):
        ls = O.lines(O.tsv_words(SLIDE))
        self.assertEqual(set(O.page_langs(ls)), {"he", "en"})


HOCR = """<div class='ocr_page' id='page_1' title='image "x"; bbox 0 0 300 60'>
<span class='ocrx_word' id='word_1_1' title='bbox 10 5 290 55; x_wconf 31'>
<span class='ocrx_cinfo' title='x_bboxes 260 8 290 50; x_conf 98.5'>ב</span>
<span class='ocrx_cinfo' title='x_bboxes 240 26 256 30; x_conf 97'>-</span>
<span class='ocrx_cinfo' title='x_bboxes 20 8 230 50; x_conf 40'>&amp;</span></span></div>
<div class='ocr_page' id='page_2' title='image "x"; bbox 0 0 300 60'></div>"""


class TestRepairHelpers(unittest.TestCase):
    """הכלים של תיקון המילים הדבוקות — בלי Tesseract."""

    def test_parse_hocr(self):
        pages = O.parse_hocr(HOCR)
        self.assertEqual(len(pages), 2)
        self.assertEqual(pages[1], [])
        w = pages[0][0]
        self.assertEqual(w["text"], "ב-&")
        self.assertEqual(w["conf"], 31)
        self.assertEqual(w["chars"][1], ("-", 240, 256, 97.0, 26, 30))

    def test_dash_by_shape(self):
        ref = (68, 62)
        self.assertTrue(O._dash(("e", 173, 194, 87, 69, 75), ref))      # מקף שנקרא "e" — שטוח ונמוך
        self.assertFalse(O._dash(("p", 52, 91, 99, 68, 130), ref))
        self.assertFalse(O._dash((".", 10, 16, 90, 120, 126), ref))     # נקודה — לא שטוחה
        self.assertTrue(O._dash(("־", 0, 9, 90, 0, 1), None))

    def test_tail_and_prefix(self):
        pip = [("p", 52, 91, 99, 68, 130), ("i", 104, 111, 99, 52, 113), ("p", 125, 164, 99, 68, 130),
               ("e", 173, 194, 87, 69, 75), ("!", 205, 213, 89, 69, 113)]
        self.assertEqual(O._tail_at(pip), 3)                            # ‎"pip" + מקף + ו׳ שנקראה "!"
        hooks = [("H", 18, 37, 98, 21, 47), ("o", 42, 60, 99, 27, 47), ("o", 64, 82, 98, 27, 47),
                 ("k", 86, 102, 99, 18, 47), ("s", 105, 118, 98, 27, 47), ('"', 122, 131, 85, 25, 27),
                 ("7", 134, 150, 98, 18, 47)]
        self.assertEqual(O._tail_at(hooks), 5)
        hello = [(c, i * 10, i * 10 + 8, 99, 0, 30) for i, c in enumerate("Hello")] + [("!", 50, 54, 99, 0, 30)]
        self.assertEqual(O._tail_at(hello), 5)                          # סימן בסוף, בלי תחילית אחריו
        self.assertEqual(O._prefix_split(O.parse_hocr(HOCR)[0][0]["chars"]), ("ב", 240))
        self.assertIsNone(O._prefix_split([("מ", 50, 80, 99, 0, 40), ("ו", 30, 45, 99, 0, 40), ("-", 10, 25, 99, 18, 22)]))
        self.assertEqual(O._pre_of("ודצ"), "ו")
        self.assertEqual(O._pre_of("ן"), "ו")                          # קו אנכי בודד
        self.assertEqual(O._pre_of("וה"), "וה")
        self.assertIsNone(O._pre_of("9"))
        self.assertEqual(O._lat_edges('JSON"'), "JSON")
        self.assertEqual(O._lat_edges("Learning\u201d"), "Learning")
        self.assertEqual(O._lat_edges(".JSON"), ".JSON")

    def test_other_script(self):
        self.assertTrue(O._other("Спасибо"))
        self.assertTrue(O._other("مرحبا"))
        self.assertFalse(O._other("АРІ"))                                # רק אותיות שנראות לטיניות
        self.assertFalse(O._other("API"))
        self.assertTrue(O.JUNK.search("Cnacn6o"))
        self.assertFalse(O.JUNK.search("JavaScript"))


def _page(text, conf, chars=None, box=(0, 0, 100, 40)):
    return {"text": text, "conf": conf, "box": list(box), "chars": chars or [(c, i * 10, i * 10 + 9, 95.0, 5, 35)
                                                                             for i, c in enumerate(text)]}


class TestRepairFlow(unittest.TestCase):
    """_repair מקצה לקצה עם hOCR מזויף: מה נקרא שוב, ואיך התוצאה נכנסת לשורה."""

    def setUp(self):
        from PIL import Image
        self.im = Image.new("L", (1600, 200), 255)
        self.orig = O.run_hocr

    def tearDown(self):
        O.run_hocr = self.orig

    def fake(self, script):
        """script = {שפה: [תשובה לקריאה 1, לקריאה 2, …]} — הקריאות בעברית ובאנגלית רצות במקביל."""
        lock = threading.Lock()
        seen = {k: 0 for k in script}

        def run(images, lang, psm=7, timeout=None):
            with lock:
                i = seen[lang]
                seen[lang] += 1
            out = script[lang][i]
            self.assertEqual(len(out), len(images))
            return out
        O.run_hocr = run
        return seen

    def word(self, text, x, w, conf, n=1):
        return {"key": (1, 1, 1), "n": n, "x": x, "y": 50, "w": w, "h": 40, "conf": conf, "text": text}

    def test_glued_prefix_split(self):
        ws = [self.word("השתמשנו", 1120, 220, 92, 1), self.word("ב-פחוחז63.!", 800, 300, 0, 2),
              self.word("Machine", 600, 180, 93, 3)]
        # המועמדים לפי x: Machine ואז הבלוב. בחיתוך הבלוב (שוליים 13): ה־ב בימין, מקף, וזבל משמאל
        heb = _page("ב-שחוח", 31, [("ב", 290, 313, 99, 15, 50), ("-", 270, 286, 98, 30, 34), ("ש", 20, 260, 60, 15, 50)])
        self.fake({"heb": [[[_page("ץ", 20)], [heb]], [[]]],
                   "eng": [[[_page("Machine", 96)], [_page("Learning2", 11)]], [[_page("Learning", 95)]]]})
        st = O._repair(self.im, ws)
        self.assertEqual(st["split"], 1)
        self.assertEqual(O.lines(ws)[0]["text"], "השתמשנו ב\u05beMachine Learning")

    def test_hebrew_misread_as_latin(self):
        ws = [self.word("nin", 1300, 120, 87, 1), self.word("נקי", 1200, 80, 92, 2)]
        self.fake({"heb": [[[_page("רווח", 91)]]], "eng": [[[_page("niin", 69)]]]})
        self.assertEqual(O._repair(self.im, ws)["heb"], 1)
        self.assertEqual(O.lines(ws)[0]["text"], "רווח נקי")

    def test_latin_word_between_latin_words_stays(self):
        ws = [self.word("Our", 100, 80, 95, 1), self.word("team", 200, 100, 95, 2), self.word("in", 320, 40, 90, 3),
              self.word("Israel", 380, 140, 95, 4), self.word("(הצוות", 600, 160, 92, 5)]
        self.fake({"heb": [[[_page("Our", 0)], [_page("team", 0)], [_page("חו", 92)], [_page("Israel", 0)]]],
                   "eng": [[[_page("Our", 95)], [_page("team", 96)], [_page("in", 70)], [_page("Israel", 96)]]]})
        st = O._repair(self.im, ws)
        self.assertEqual(st["heb"], 0)
        self.assertEqual([w["text"] for w in ws][:4], ["Our", "team", "in", "Israel"])

    def test_cell_code_and_acronym(self):
        ws = [self.word("2025", 900, 100, 96, 1), self.word("01", 1020, 50, 48, 2), self.word("נתוני", 1300, 120, 92, 3),
              self.word("חא", 1150, 60, 60, 4)]
        self.fake({"heb": [[[_page("1", 37)], [_page("חא", 50)]]], "eng": [[[_page("Ql", 77)], [_page("KPI", 93)]]]})
        st = O._repair(self.im, ws)
        self.assertEqual(st["eng"], 2)
        self.assertEqual({w["text"] for w in ws}, {"2025", "Q1", "נתוני", "KPI"})


class TestSubs(unittest.TestCase):
    def test_flat_background_skips(self):
        from PIL import Image
        self.assertEqual(O._subs(Image.new("RGB", (640, 360), "white"), []), (0, None))

    def test_noisy_band_with_white_text(self):
        import numpy as np
        from PIL import Image
        rng = np.random.default_rng(1)
        a = rng.integers(40, 160, (360, 640, 3)).astype(np.uint8)
        a[290:310, 200:440] = 255                                       # "טקסט" לבן
        calls = []

        def fake_tsv(src, *a_, **k):
            calls.append(src)
            return tsv([(1, 1, 1, 1, 200, 70, 110, 20, 93.0, "שלום"), (1, 1, 1, 2, 330, 70, 110, 20, 95.0, "Hello")])
        orig = O.run_tsv
        O.run_tsv = fake_tsv
        try:
            ws = [self.word_("junk", 210, 290, 12.0)]
            n, im = O._subs(Image.fromarray(a), ws)
        finally:
            O.run_tsv = orig
        self.assertEqual(n, 1)
        self.assertEqual(len(calls), 1)
        self.assertEqual(sorted(w["text"] for w in ws), ["Hello", "שלום"])     # הזבל של המעבר הראשון הוחלף
        self.assertTrue(all(w["y"] >= 216 for w in ws))                        # המיקום חזר לקואורדינטות התמונה
        self.assertEqual(im.mode, "L")

    @staticmethod
    def word_(text, x, y, conf):
        return {"key": (1, 1, 1), "n": 1, "x": x, "y": y, "w": 100, "h": 20, "conf": conf, "text": text}


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
