"""הסנכרון בעברית לקריוקי (31/10/2026, vt/align_he.py): זיהוי השפה, יישור CTC כפוי, החלונות, כללי ההחלפה, המיזוג.
בלי מודלים — נתונים סינתטיים. השרשרת המלאה נבדקה מקומית (docs/studio-karaoke-he.md)."""
import itertools
import sys
import unittest
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

from vt import align_he as H  # noqa: E402
from vt import karaoke as K  # noqa: E402


def brute(lp, tg, blank):
    """כל הנתיבים החוקיים של CTC — הציון הגבוה ביותר (לבדיקת ה־Viterbi על מקרים קטנים)."""
    T, best = lp.shape[0], -np.inf
    for path in itertools.product(range(lp.shape[1]), repeat=T):
        col, prev = [], None
        for p in path:
            if p != prev and p != blank:
                col.append(p)
            prev = p
        if col == list(tg):
            best = max(best, sum(lp[t, p] for t, p in enumerate(path)))
    return best


class Lang(unittest.TestCase):
    def test_is_hebrew(self):
        self.assertTrue(H.is_hebrew([["שלום", "עולם"], ["ממותה"]]))
        self.assertFalse(H.is_hebrew([["Hello", "darkness"]]))
        self.assertTrue(H.is_hebrew([["אני", "love", "you", "מאוד"]]))
        self.assertFalse(H.is_hebrew([["123"]]))

    def test_ready_without_models(self):
        self.assertFalse(H.ready() and not Path(H.IVRIT_DIR).is_dir())


class Viterbi(unittest.TestCase):
    def test_matches_brute_force(self):
        rng = np.random.default_rng(3)
        for _ in range(25):
            T, C = int(rng.integers(3, 6)), 3
            lp = np.log(rng.dirichlet(np.ones(C), size=T)).astype(np.float32)
            tg = np.asarray(rng.integers(1, C, size=int(rng.integers(1, 3))), np.int64)
            try:
                path, sc = H.viterbi(lp, tg, 0)
            except ValueError:
                continue
            self.assertAlmostEqual(float(sc.sum()), brute(lp, tg, 0), places=4)
            col = [int(p) for i, p in enumerate(path) if p != 0 and (i == 0 or p != path[i - 1])]
            self.assertEqual(col, list(tg))

    def test_too_long(self):
        with self.assertRaises(ValueError):
            H.viterbi(np.zeros((2, 3), np.float32), np.asarray([1, 1], np.int64), 0)

    def test_spans_and_times(self):
        # שתי "מילים" (טוקן 1, טוקן 2) עם <star> לפני כל אחת; הפליטות מכוונות: 1 בפריימים 3–4, 2 בפריימים 8–9
        T, star = 12, 3
        lp = np.full((T, 4), -9.0, np.float32)
        lp[:, 0] = -0.1
        lp[3:5, 1] = 0.0
        lp[8:10, 2] = 0.0
        lp[:, star] = 0.0                                   # כמו בפליטות האמיתיות: <star> = log 1
        toks = [[star], [1], [star], [2]]
        path, _ = H.viterbi(lp, np.asarray([x for t in toks for x in t], np.int64), 0)
        sp = H._spans(toks, H._segments(path), 0)
        self.assertEqual(len(sp), 4)
        self.assertTrue(sp[1][0] <= 4 <= sp[1][1] + 1, sp)
        self.assertTrue(sp[3][0] <= 9 and sp[3][1] >= 8, sp)
        self.assertLess(sp[1][1], sp[3][0])

    def test_letters(self):
        d = {"ש": 1, "ל": 2, "ו": 3, "ם": 4, "'": 5, "[pad]": 0, "|": 6}
        self.assertEqual(H._letters("שָׁלוֹם", d), [1, 2, 3, 4])
        self.assertEqual(H._letters("ת′", d), [])


class Windows(unittest.TestCase):
    def test_split_on_gap_and_length(self):
        lines = [["א", "ב"], ["ג"], ["ד", "ה"]]
        ws = K.anchor(lines, [{"w": "א", "s": 1, "e": 1.5}, {"w": "ב", "s": 2, "e": 2.5}, {"w": "ג", "s": 3, "e": 3.5},
                              {"w": "ד", "s": 10, "e": 10.5}, {"w": "ה", "s": 11, "e": 11.5}])
        self.assertEqual(H.windows(ws, 20.0), [[0, 1, 2], [3, 4]])
        long = [{"w": "x", "li": i, "s": i * 5.0, "e": i * 5.0 + 1} for i in range(10)]
        self.assertTrue(all(long[c[-1]]["e"] - long[c[0]]["s"] <= H.MAXW + 1 for c in H.windows(long, 60.0)))


def w(s, e=None):
    return {"s": s, "e": s + 0.3 if e is None else e}


class Guard(unittest.TestCase):
    def test_collapse_run_takes_ctc_near_anchor(self):
        # stable-ts דחס 3 מילים לשנייה 1, ה־CTC והעוגן ב־10–12
        st = [w(1.0), w(1.1), w(1.2), w(13.0)]
        ct = [w(10.0), w(11.0), w(12.0), w(13.0)]
        an = [w(10.2), w(11.1), w(12.1), w(13.0)]
        self.assertEqual(H.guard(st, ct, an, [["a", "b", "c", "d"]]), [True, True, True, False])

    def test_single_word_needs_majority(self):
        st = [w(1.0), w(5.0), w(3.0)]
        ct = [w(1.0), w(2.0), w(3.0)]
        self.assertEqual(H.guard(st, ct, [w(1.0), w(2.1), w(3.0)], [["a", "b", "c"]]), [False, True, False])
        self.assertEqual(H.guard(st, ct, [w(1.0), w(5.0), w(3.0)], [["a", "b", "c"]]), [False, False, False])

    def test_stretched_line_start(self):
        st = [w(1.0, 3.0), w(3.1)]
        ct = [w(2.2), w(3.1)]
        self.assertEqual(H.guard(st, ct, [w(1.0), w(3.1)], [["a", "b"]]), [True, False])
        self.assertEqual(H.guard(st, ct, [w(1.0), w(3.1)], [["a"], ["b"]])[1], False)


class Merge(unittest.TestCase):
    def test_fallbacks_and_continuity(self):
        lines = [["א", "ב", "ג"]]
        words = [{"w": "א", "li": 0, "s": 1.0, "e": 1.5}, {"w": "ב", "li": 0, "s": 2.0, "e": 2.5},
                 {"w": "ג", "li": 0, "s": 3.0, "e": 3.5}]
        st = [{"s": 1.1, "e": 1.6}, None, {"s": 1.55, "e": 1.58}]
        ct = [{"s": 1.0, "e": 1.4}, {"s": 2.0, "e": 2.4}, None]
        out, n = H.merge(words, st, ct, lines)
        self.assertEqual([x["align"] for x in out], ["st", "ctc", "st"])
        self.assertEqual(n, 1)
        for a, b in zip(out, out[1:]):
            self.assertGreaterEqual(b["s"], a["s"] + 0.02 - 1e-9)
            self.assertLessEqual(a["e"], b["s"] + 1e-9)
        self.assertTrue(all(x["e"] > x["s"] for x in out))
        self.assertGreaterEqual(out[-1]["e"], out[-1]["s"] + 0.08 - 1e-9)
        out, _ = H.merge(words, [None] * 3, [None] * 3, lines)
        self.assertEqual({x["align"] for x in out}, {"anchor"})

    def test_map_to(self):
        words = [{"w": "שלום"}, {"w": "עולם,"}, {"w": "יפה"}]
        self.assertEqual(H.map_to(words, [{"w": "a"}] * 3), [{"w": "a"}] * 3)
        got = H.map_to(words, [{"w": "שלום", "s": 1}, {"w": "עולם", "s": 2}])
        self.assertEqual([g and g["s"] for g in got], [1, 2, None])

    def test_matched(self):
        self.assertEqual(H.matched([["שלום", "עולם"]], [{"w": "שלום."}, {"w": "בית"}]), 1)


if __name__ == "__main__":
    unittest.main()
