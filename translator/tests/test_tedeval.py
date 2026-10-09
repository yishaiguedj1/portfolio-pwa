"""בדיקות לכלי ההערכה מול TED ‏(tedeval.py) — טהורות, בלי רשת ובלי תלויות.

ערכי ה־chrF++ שבבדיקות אומתו מול sacrebleu 2.6.0 ‏(CHRF(word_order=2),
sentence_score) ב־09/10/2026 — המימוש שלנו התאים עד 3.6e-15 גם על 200 זוגות
כתוביות עבריות אמיתיות. אם בדיקת הערכים נשברת — המימוש סטה מהסטנדרט.
"""
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import tedeval as T  # noqa: E402


class TestChrf(unittest.TestCase):
    def test_sacrebleu_values(self):
        # (hyp, ref, ציון sacrebleu מעוגל ל־3 ספרות)
        cases = [
            ("the cat sat on the mat", "the cat sat on a mat", 72.030),
            ("שלום עולם, מה נשמע?", "שלום עולם! מה נשמע?", 71.918),
            ("זה תרגום ניסיון של כתובית ארוכה יותר — עם מקף עברי",
             "זה ניסיון תרגום של כתובית ארוכה, עם מקף עברי", 67.163),
            ("a", "a", 100.0),
            ("abc", "xyz", 0.0),
            ("", "ref text", 0.0),
            ("קצר", "קצר מאוד מאוד", 27.108),
            ("Hello world", "hello World", 28.155),
            ("מספרים 123 ו־456.", "מספרים 123 ו-456.", 66.940),
            ("שתי שורות\nעם ירידת שורה", "שתי שורות עם ירידת שורה", 100.0),
        ]
        for hyp, ref, want in cases:
            self.assertAlmostEqual(T.chrfpp(hyp, ref), want, places=3, msg=repr(hyp))

    def test_identity_and_bounds(self):
        s = "כתובית עברית רגילה לבדיקה"
        self.assertAlmostEqual(T.chrfpp(s, s), 100.0, places=9)
        self.assertTrue(0.0 <= T.chrfpp("אבג", "דהו") <= 100.0)


class TestNorm(unittest.TestCase):
    def test_norm_he(self):
        self.assertEqual(T.norm_he("‏שָׁלוֹם…‎"), "שלום...")
        self.assertEqual(T.norm_he("בית״ס  ו־כו׳"), 'בית"ס ו-כו\'')

    def test_strip_bidi(self):
        self.assertEqual(T.strip_bidi("‫טקסט‬‏"), "טקסט")


class TestParse(unittest.TestCase):
    SRT = "﻿1\n00:00:01,000 --> 00:00:02,500\n‏שורה אחת\n\n2\n00:01:00,000 --> 00:01:03,000\nשורה ראשונה\nשנייה\n"

    def test_parse_srt(self):
        cues = T.parse_srt(self.SRT)
        self.assertEqual(len(cues), 2)
        self.assertEqual(cues[0]["s"], 1.0)
        self.assertEqual(cues[0]["e"], 2.5)
        self.assertEqual(cues[0]["text"], "שורה אחת")          # בלי תו הכיוון
        self.assertEqual(cues[1]["lines"], ["שורה ראשונה", "שנייה"])
        self.assertEqual(cues[1]["s"], 60.0)

    def test_parse_ted_and_speaker(self):
        p = Path(self.tmp) / "he.json"
        p.write_text(json.dumps([{"t": 1500, "x": "Chris Anderson: שלום\nלכולם"},
                                 {"t": 4000, "x": "(מחיאות כפיים)"}]), encoding="utf-8")
        cues = T.parse_ted(p)
        self.assertEqual(cues[0], {"s": 1.5, "text": "שלום לכולם"})
        self.assertEqual(len(T.drop_sound_cues(cues)), 1)       # כתובית הקול ירדה

    def setUp(self):
        import tempfile
        self._td = tempfile.TemporaryDirectory()
        self.tmp = self._td.name

    def tearDown(self):
        self._td.cleanup()


class TestOffsetPairing(unittest.TestCase):
    def _mk(self, shift):
        # ייחוס: 6 כתוביות אנגליות; המילים שלנו — אותן מילים בהיסט קבוע
        en = [{"s": 10.0, "text": "hello there friends"},
              {"s": 14.0, "text": "this is a test"},
              {"s": 18.0, "text": "goodbye now everyone"},
              {"s": 22.0, "text": "another line of words"},
              {"s": 26.0, "text": "almost done here"},
              {"s": 30.0, "text": "final anchor line"}]
        words = []
        for c in en:
            for j, w in enumerate(c["text"].split()):
                t = c["s"] + shift + j * 0.5          # המילה הראשונה בדיוק בהיסט הקבוע
                words.append({"w": w, "s": round(t, 2), "e": round(t + 0.2, 2)})
        return en, words

    def test_offset(self):
        en, words = self._mk(13.0)
        self.assertAlmostEqual(T.estimate_offset(words, en), 13.0, places=2)

    def test_pairing(self):
        ref = [{"s": 10.0, "text": "אחת"}, {"s": 14.0, "text": "שתיים"}, {"s": 18.0, "text": "שלוש"}]
        our = [{"s": 23.2, "e": 24.0, "text": "א", "lines": ["א"]},
               {"s": 27.1, "e": 28.0, "text": "ב", "lines": ["ב"]},
               {"s": 31.0, "e": 32.5, "text": "ג", "lines": ["ג"]}]
        pairs = T.pair_segments(our, ref, offset=13.0)
        self.assertEqual([p["hyp"] for p in pairs], ["א", "ב", "ג"])

    def test_too_few_anchors(self):
        with self.assertRaises(SystemExit):
            T.estimate_offset([{"w": "hello", "s": 1.0, "e": 1.2}], [{"s": 0.0, "text": "hello"}])


class TestForm(unittest.TestCase):
    def test_check_form(self):
        cues = [
            {"s": 0.0, "e": 2.0, "lines": ["שורה תקינה"], "text": "שורה תקינה"},
            # מהירה מדי (40 תווים בשנייה) + ניקוד + לטינית + '...'
            {"s": 3.0, "e": 4.0, "lines": ["שָׁלוֹם זה example של שורה ממש ארוכה מדי..."],
             "text": "שָׁלוֹם זה example של שורה ממש ארוכה מדי..."},
            {"s": 5.0, "e": 5.3, "lines": ["קצרה"], "text": "קצרה"},
        ]
        f = T.check_form(cues)
        self.assertEqual(f["cues"], 3)
        self.assertEqual(f["over_cps%"], 33.3)
        self.assertEqual(f["over_line%"], 33.3)
        self.assertEqual(f["short%"], 33.3)
        self.assertEqual(f["nikud"], 1)
        self.assertEqual(f["latin"], 1)
        self.assertEqual(f["three_dots"], 1)


class TestEvalCompare(unittest.TestCase):
    def test_evaluate_perfect(self):
        pairs = [{"ref": "שלום לכולם", "hyp": "שלום לכולם", "t": 0.0},
                 {"ref": "מה נשמע", "hyp": "מה נשמע", "t": 4.0}]
        e = T.evaluate(pairs)
        self.assertEqual(e["covered"], 2)
        self.assertAlmostEqual(e["chrf_doc"], 100.0, places=2)
        self.assertAlmostEqual(e["len_ratio_chars"], 1.0, places=3)

    def test_compare_direction(self):
        ref = [{"ref": "תרגום מדויק של המשפט הזה", "hyp": "תרגום מדויק של המשפט הזה", "t": 0.0}] * 12
        worse = [{"ref": "תרגום מדויק של המשפט הזה", "hyp": "משהו אחר לגמרי שכתוב כאן", "t": 0.0}] * 12
        c = T.compare(ref, worse, boot=200)
        self.assertGreater(c["delta_mean"], 0)
        self.assertEqual(c["a_wins"], 12)
        self.assertTrue(c["significant"])
        # סימטריה: היפוך הצדדים הופך את הסימן
        c2 = T.compare(worse, ref, boot=200)
        self.assertLess(c2["delta_mean"], 0)


if __name__ == "__main__":
    unittest.main()
