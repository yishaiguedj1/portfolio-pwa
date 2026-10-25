"""25/10/2026 (ניתוח האיכות): חלון ארוך שבו Parakeet עבר למצב בלי פיסוק ובלי אותיות גדולות — מתומלל שוב בחלונות
קצרים, ונכנס רק אם חזר פיסוק ומספר המילים דומה."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vt import asr_parakeet as P  # noqa: E402

SR = 16000


def words(text, s0=0.0):
    return [{"w": w, "s": s0 + 0.3 * i, "e": s0 + 0.3 * i + 0.25, "spk": None, "conf": None} for i, w in enumerate(text.split())]


FLAT = ("so i think it shaped us it was a time when we all had to work and my mother had to become a salesperson "
        "to make some money and she did it all herself and she really stepped up and we learned from her that you "
        "do what you have to do")
GOOD = ("So I think it shaped us. It was a time when we all had to work, and my mother had to become a salesperson "
        "to make some money. And she did it all herself. She really stepped up, and we learned from her that you "
        "do what you have to do.")


class Flat(unittest.TestCase):
    def test_detects_flat_and_half_flat(self):
        self.assertTrue(P.flat(words(FLAT)))
        self.assertFalse(P.flat(words(GOOD)))
        # "חצי שטוח": פסיק פה ושם, אבל i קטנה ובלי אותיות גדולות
        half = FLAT.replace("work and", "work, and").replace("money and", "money, and").replace("herself and", "herself, and")
        self.assertTrue(P.flat(words(half)))
        self.assertFalse(P.flat(words(FLAT)[:30]))                      # קצר — לא מסיקים
        self.assertTrue(P.flat(words(FLAT.replace(" i ", " I "))))      # בלי i קטנה — עדיין בלי פיסוק ובלי אותיות גדולות
        self.assertFalse(P.flat(words(GOOD.lower().replace(" i ", " I "))))   # הכל קטן אבל עם פיסוק ו־I — לא
        self.assertTrue(P.flat(words(FLAT.replace(" i ", " we "))))

    def test_unflatten_replaces_only_flat_windows(self):
        chunks = [(0, 40 * SR), (40 * SR, 80 * SR)]
        segs = [(0, 18 * SR), (19 * SR, 39 * SR), (40 * SR, 79 * SR)]
        parts = [words(FLAT), words(GOOD, 40.0)]
        calls = []

        def recog(a, b):
            calls.append((a, b))
            n = len(GOOD.split())
            ws = GOOD.split()
            lo, hi = a / SR, b / SR
            return [{"w": ws[i], "s": 0.3 * i, "e": 0.3 * i + 0.25, "spk": None, "conf": None}
                    for i in range(n) if lo <= 0.3 * i < hi]
        self.assertEqual(P.unflatten(parts, chunks, segs, 80 * SR, SR, recog), 1)
        self.assertEqual(" ".join(w["w"] for w in parts[0]), GOOD)
        self.assertTrue(all(b - a <= int((P.FLAT_MAX_S * 1.5 + 1) * SR) for a, b in calls))
        self.assertTrue(all(b <= 40 * SR for a, b in calls))           # רק בתוך החלון השטוח
        self.assertEqual(parts[1][0]["w"], "So")                        # החלון התקין לא נגע

    def test_rejects_when_words_lost_or_still_flat(self):
        chunks = [(0, 40 * SR)]
        segs = [(0, 39 * SR)]
        parts = [words(FLAT)]
        self.assertEqual(P.unflatten(parts, chunks, segs, 40 * SR, SR, lambda a, b: words(GOOD)[:20] if a == 0 else []), 0)
        self.assertEqual(P.unflatten(parts, chunks, segs, 40 * SR, SR, lambda a, b: words(FLAT) if a == 0 else []), 0)
        self.assertEqual(" ".join(w["w"] for w in parts[0]), FLAT)


if __name__ == "__main__":
    unittest.main()
