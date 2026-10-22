"""22/10/2026 (ניתוח המאגר): Parakeet דילג על משפט שלם בתוך חלון ארוך (Uber 0:35, 28 מילים).
holes() מוצא דיבור בלי מילים, rescue() מתמלל רק אותו שוב — בלי כפילויות בגבולות."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vt.asr_parakeet import holes, rescue  # noqa: E402


def W(w, s, e=None):
    return {"w": w, "s": s, "e": e if e is not None else s + 0.3, "spk": None, "conf": None}


# המקור (מה שבאמת נאמר) — המשפט האמצעי "נפל" בתמלול הראשון
TRUTH = [W("x", float(t)) for t in range(0, 35)] + [W("every", 35.2), W("year.", 35.4), W("But", 35.7), W("it", 35.85), W("seems", 36.0), W("that", 36.2),
         W("you", 36.4), W("were", 36.6), W("forged.", 36.7), W("Yeah,", 39.8), W("and", 40.1), W("it", 40.2),
         W("started.", 40.4), W("With", 42.4), W("the", 42.6)]
SEGS = [(35.1, 42.2), (42.4, 42.9)]


def first_pass():
    return [dict(w) for w in TRUTH if w["s"] < 35.6 or w["s"] >= 42.0]


IDX = 37                                                              # המילה שאחרי החור


def recog(a, b):
    return [dict(w) for w in TRUTH if a <= w["s"] < b]


class Holes(unittest.TestCase):
    def test_finds_speech_without_words(self):
        f = holes(first_pass(), SEGS, 42.9)
        self.assertEqual(len(f), 1)
        i, a, b = f[0]
        self.assertEqual((i, round(a, 2), b), (IDX, 36.0, 42.4))

    def test_short_silence_is_not_a_hole(self):
        words = [W("a", 0.2), W("b", 2.2)]                             # 1.4 שנ׳ שקט אחרי "a"
        self.assertEqual(holes(words, [(0.1, 0.7), (2.1, 2.6)], 2.6), [])

    def test_long_quiet_is_a_hole_in_pieces(self):
        """Silero מפספס דיבור ברעש (מסוק — Undercover 14:35, 23 מילים): גם שקט ארוך מתומלל שוב, בחלקים"""
        words = [W("a", 0.5), W("b", 80.0)]
        f = holes(words, [(0.4, 1.0), (79.9, 80.4)], 80.4)
        self.assertEqual(len(f), 3)
        self.assertTrue(all(b - a <= 28.0 for _, a, b in f))
        said = [W("we're", 20.0), W("gonna", 20.3), W("take", 44.9), W("a", 45.1), W("look", 70.0)]
        n = rescue(words, f, lambda x, y: [dict(w) for w in said if x <= w["s"] < y], 80.4)
        self.assertEqual([w["w"] for w in words], ["a", "we're", "gonna", "take", "a", "look", "b"])
        self.assertEqual(n, 5)

    def test_rescue_inserts_in_order(self):
        words = first_pass()
        n = rescue(words, holes(words, SEGS, 42.9), recog, 42.9)
        self.assertEqual(n, len(TRUTH) - len(first_pass()))
        self.assertEqual([w["w"] for w in words], [w["w"] for w in TRUTH])
        self.assertTrue(all(words[i]["e"] <= words[i + 1]["s"] for i in range(len(words) - 1)))

    def test_no_duplicates_at_edges(self):
        words = [W("join.woop.com/slash", 10.0), W("CEO.", 13.0)]
        def rec(a, b):
            return [W("slash", 10.7), W("slash", 11.0), W("CEO.", 12.99)]
        rescue(words, holes(words, [(9.9, 13.5)], 14.0), rec, 14.0)
        self.assertEqual([w["w"] for w in words], ["join.woop.com/slash", "CEO."])
        words = [W("W-I-S-P-R-F-L-O-W", 20.0), W("dot", 23.5)]
        def rec2(a, b):
            return [W(c, 20.8 + k * 0.3) for k, c in enumerate("isprflw")]
        rescue(words, holes(words, [(19.9, 24.0)], 25.0), rec2, 25.0)
        self.assertEqual([w["w"] for w in words], ["W-I-S-P-R-F-L-O-W", "dot"])

    def test_short_real_words_are_kept(self):
        words = [W("platform.", 10.0), W("Those", 14.0)]
        rescue(words, holes(words, [(9.9, 14.5)], 14.5), lambda a, b: [W("a", 11.0), W("form", 11.3)], 14.5)
        self.assertEqual([w["w"] for w in words], ["platform.", "a", "form", "Those"])

    def test_nothing_found(self):
        words = first_pass()
        self.assertEqual(rescue(words, holes(words, SEGS, 42.9), lambda a, b: [], 42.9), 0)
        self.assertEqual(len(words), len(first_pass()))


if __name__ == "__main__":
    unittest.main()
