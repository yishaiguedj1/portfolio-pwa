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
TRUTH = [W("every", 35.2), W("year.", 35.4), W("But", 35.7), W("it", 35.85), W("seems", 36.0), W("that", 36.2),
         W("you", 36.4), W("were", 36.6), W("forged.", 36.7), W("Yeah,", 39.8), W("and", 40.1), W("it", 40.2),
         W("started.", 40.4), W("With", 42.4), W("the", 42.6)]
SEGS = [(35.1, 42.2), (42.4, 42.9)]


def first_pass():
    return [dict(w) for w in TRUTH if w["s"] < 35.6 or w["s"] >= 42.0]


def recog(a, b):
    return [dict(w) for w in TRUTH if a <= w["s"] < b]


class Holes(unittest.TestCase):
    def test_finds_speech_without_words(self):
        f = holes(first_pass(), SEGS, 42.9)
        self.assertEqual(len(f), 1)
        i, a, b = f[0]
        self.assertEqual((i, round(a, 2), b), (2, 36.0, 42.4))

    def test_silence_is_not_a_hole(self):
        self.assertEqual(holes(first_pass(), [(35.1, 35.6), (42.3, 43.0)], 43.0), [])

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

    def test_nothing_found(self):
        words = first_pass()
        self.assertEqual(rescue(words, holes(words, SEGS, 42.9), lambda a, b: [], 42.9), 0)
        self.assertEqual(len(words), len(first_pass()))


if __name__ == "__main__":
    unittest.main()
