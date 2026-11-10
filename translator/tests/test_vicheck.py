"""vicheck.py (PR 1.2א): התאום של normVi, הבדיקות בקוד (V45, ‏V73, ‏V74, ‏V79) והעיגון (4.2). בלי מודלים ובלי רשת."""

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import vicheck as C  # noqa: E402

FX = ROOT / "tests" / "fixtures"


def fx(name):
    return json.loads((FX / name).read_text(encoding="utf-8"))


def W(w, s, e):
    return {"w": w, "s": s, "e": e}


# הרצאה קטנה: שתי יחידות דיבור (מילים עם זמן), שקף עם שתי שורות (אחת "רק על המסך")
WORDS = [W("We", 10.0, 10.2), W("measured", 10.3, 10.8), W("a", 10.9, 11.0), W("12%", 11.1, 11.6), W("drop", 11.7, 12.0),
         W("in", 12.1, 12.2), W("errors.", 12.3, 12.9),
         W("This", 30.0, 30.2), W("might", 30.3, 30.6), W("reduce", 30.7, 31.1), W("cost.", 31.2, 31.8)]
EV = [{"id": "e1", "t0": 10.0, "t1": 12.9, "text": "We measured a 12% drop in errors.", "w0": 0, "w1": 6},
      {"id": "e2", "t0": 30.0, "t1": 31.8, "text": "This might reduce cost.", "w0": 7, "w1": 10}]
SLIDES = [{"id": "s1", "t0": 8.0, "t1": 40.0, "ocr": ["o1.1", "o1.2"], "so": ["o1.2"]},
          {"id": "s2", "t0": 41.0, "t1": 60.0, "ocr": [], "so": []}]
OCR = [{"id": "o1.1", "text": "Error rate", "conf": 90}, {"id": "o1.2", "text": "Baseline: 1,200 runs", "conf": 90}]
SPAN = (0.0, 60.0)


def ix():
    return C.Index(EV, SLIDES, OCR, WORDS)


class TestNorm(unittest.TestCase):
    def test_twin_of_normVi(self):
        """אותם fixtures כמו tests/studio-vi.test.js — vi_ok יוצא כמו שנכנס (גם הסדר), vi_bad → vi_bad.norm"""
        ok = fx("vi_ok.json")
        self.assertEqual(json.dumps(C.norm_vi(ok), ensure_ascii=False), json.dumps(ok, ensure_ascii=False))
        self.assertEqual(C.norm_vi(fx("vi_bad.json")), fx("vi_bad.norm.json"))
        self.assertIsNone(C.norm_vi({"v": "x"}))
        self.assertIsNone(C.norm_vi([]))

    def test_t_field(self):
        """t (זמן המילה) — רק מספר בטווח, מעוגל ל־3 ספרות כמו r3 ב־JS (חצי — למעלה)"""
        base = fx("vi_ok.json")
        it = dict(base["items"][0], t=1.0005)
        out = C.norm_vi(dict(base, items=[it] + base["items"][1:]))
        self.assertEqual(out["items"][0]["t"], 1.001)
        for bad in ("3", -1, 1e9, True, None):
            out = C.norm_vi(dict(base, items=[dict(base["items"][0], t=bad)] + base["items"][1:]))
            self.assertNotIn("t", out["items"][0], bad)

    def test_constants_match_server(self):
        js = (ROOT.parent / "ibkr-proxy" / "lib" / "studiovi.js").read_text(encoding="utf-8")
        for name in ("VI_SEG", "VI_SRC", "VI_BASIS", "VI_CONF", "VI_VER", "VI_DROP", "VI_GENRES", "VI_WARN", "VI_LANGS"):
            line = next(x for x in js.splitlines() if x.startswith("const %s = [" % name))
            vals = line.split("[", 1)[1].split("]", 1)[0].replace("'", "").replace(" ", "").split(",")
            self.assertEqual(tuple(vals), getattr(C, name), name)


class TestAnchor(unittest.TestCase):
    def test_quote_word_time_exact(self):
        """הקבלה של 1.2א: זמן השבב = זמן המילה, בדיוק — גם כשהציטוט מתחיל באמצע היחידה"""
        it = {"text": "ירידה של 12% בשגיאות", "ev": ["e1"], "q": "12% drop in errors.", "conf": "high", "basis": "speaker"}
        x, iss = C.check_item(it, ix(), SPAN, set())
        self.assertEqual(iss, [])
        self.assertEqual(x["t"], 11.1, "המילה '12%' מתחילה ב־11.1")
        self.assertEqual(C.anchor({"ev": ["e1"], "q": "We measured"}, ix()), 10.0)

    def test_no_quote_slide_and_unit(self):
        self.assertEqual(C.anchor({"ev": ["o1.2"]}, ix()), 8.0, "שורת OCR — ה־t0 של השקף")
        self.assertEqual(C.anchor({"ev": ["e2", "s1"]}, ix()), 8.0, "הראיה המוקדמת")
        self.assertIsNone(C.anchor({"ev": []}, ix()))

    def test_quote_moves_unit_first(self):
        it = {"text": "זה עשוי להוזיל", "ev": ["s1", "e2"], "q": "might reduce", "basis": "speaker", "conf": "med"}
        x, _ = C.check_item(it, ix(), SPAN, set())
        self.assertEqual(x["ev"][0], "e2")
        self.assertEqual(x["t"], 30.3)
        self.assertEqual(x["src"], "both", "V42: דיבור ומסך")


class TestPlanted(unittest.TestCase):
    """השגיאות השתולות (16.3): 100% נתפסות"""

    def test_foreign_id(self):
        x, iss = C.check_item({"text": "א", "ev": ["e99", "e1"], "basis": "speaker", "conf": "high"}, ix(), SPAN, set())
        self.assertIn("ev_bad", iss)
        self.assertEqual(x["ev"], ["e1"])

    def test_id_outside_window(self):
        x, iss = C.check_item({"text": "א", "ev": ["s2"], "basis": "speaker", "conf": "high"}, ix(), (0.0, 20.0), set())
        self.assertIn("ev_bad", iss)
        self.assertIn("no_ev", iss)
        self.assertEqual((x["basis"], x["conf"]), ("analyst_inference", "low"), "בלי ראיה — הוסק, ביטחון נמוך")

    def test_quote_not_substring(self):
        x, iss = C.check_item({"text": "א", "ev": ["e1"], "q": "we measured a 12% drop", "basis": "speaker", "conf": "high"},
                              ix(), SPAN, set())
        self.assertIn("q_bad", iss, "רישיות שונה = לא תת־מחרוזת")
        self.assertNotIn("q", x)
        self.assertEqual(x["t"], 10.0, "בלי ציטוט — ה־t0 של היחידה")

    def test_number_not_in_inventory(self):
        x, iss = C.check_item({"text": "ירידה של 15% בשגיאות", "ev": ["e1"], "basis": "speaker", "conf": "high"}, ix(), SPAN, set())
        self.assertIsNone(x, "מספר מומצא — הפריט נמחק")
        self.assertIn("num_bad", iss)
        x, iss = C.check_item({"text": "1,200 ריצות", "ev": ["e1"], "basis": "speaker", "conf": "high"}, ix(), SPAN, C.nums("1200"))
        self.assertIsNotNone(x)
        self.assertEqual(iss, ["num_far"], "במלאי, אבל לא ביחידות של הפריט")
        x, iss = C.check_item({"text": "בסיס של 1200 ריצות", "ev": ["o1.2"], "basis": "speaker", "conf": "high"}, ix(), SPAN, set())
        self.assertEqual(iss, [], "1,200 = 1200")
        self.assertEqual(x["src"], "screen_only")

    def test_hedge_kept(self):
        x, iss = C.check_item({"text": "זה מוזיל עלויות", "ev": ["e2"], "basis": "speaker", "conf": "high"}, ix(), SPAN, set())
        self.assertIn("hedge", iss)
        self.assertEqual(x["conf"], "med")
        x, iss = C.check_item({"text": "זה עשוי, כנראה, להוזיל", "ev": ["e2"], "basis": "speaker", "conf": "high"}, ix(), SPAN, set())
        self.assertNotIn("hedge", iss)
        self.assertFalse(C.HEDGE_RE.search("Today we talk about descent"), "about — רק לפני מספר")
        self.assertTrue(C.HEDGE_RE.search("about 30 runs"))

    def test_dangling_slide(self):
        """שקף "תלוי באוויר": הפנקס מפנה לפריט שנמחק אחר כך → unverified ו־vi_ledger"""
        items = [{"id": "n1", "ev": ["s1"]}, {"id": "n2", "ev": ["e1"]}]
        led, miss, used = C.ledger(SLIDES, items, {"s2": "decorative"})
        self.assertEqual(led[0], {"ref": "s1", "used": "n1"})
        self.assertEqual(led[1], {"ref": "o1.2", "used": "n1"}, "השקף כולו צוטט — גם השורה שלו")
        self.assertEqual(led[2], {"ref": "s2", "drop": "decorative"})
        self.assertEqual((miss, used), (0, 2))
        self.assertEqual(C.dangling(led, {"n2"}), 2)
        self.assertEqual(led[0], {"ref": "s1", "drop": "unverified"})

    def test_screen_only_missed(self):
        led, miss, _ = C.ledger(SLIDES, [{"id": "n1", "ev": ["o1.1"]}], {})
        self.assertIn({"ref": "o1.2", "drop": "low_salience"}, led, "V23: שורה שלא נאמרה ולא נכנסה — נספרת")
        self.assertEqual(miss, 2, "o1.2 ו־s2")

    def test_rate_and_feedback(self):
        res = [C.check_item(it, ix(), SPAN, set()) for it in (
            {"text": "א", "ev": ["e1"], "basis": "speaker", "conf": "med"},
            {"text": "ב", "ev": ["e77"], "basis": "speaker", "conf": "med"},
            {"text": "15 איש", "ev": ["e1"], "basis": "speaker", "conf": "med"})]
        self.assertAlmostEqual(C.bad_rate(res), 2 / 3)
        fb = C.feedback(res, [{"text": "א"}, {"text": "ב"}, {"text": "15 איש"}])
        self.assertIn('"ב": ev_bad, no_ev', fb)
        self.assertIn('"15 איש": num_bad', fb)
        self.assertNotIn('"א"', fb)

    def test_nums(self):
        self.assertEqual(C.nums("ב30% מ־1,200, גרסה 3.50; 7 ימים; 2019,2020"), {"30", "1200", "3.5", "2019", "2020"})


if __name__ == "__main__":
    unittest.main()
