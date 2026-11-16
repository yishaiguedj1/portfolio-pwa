"""16/11/2026 — ציר השפות המדוברות (vt/lid.py) והחיבור שלו לניתוח (vt/vi.py) ולתרגום (vt/cli.py ‏cmd_lang, A12).
הפונקציות הטהורות (חלונות, מועמדות, Viterbi, אזורים) — עם numpy בלבד; הרשת עצמה — רק כש־torch מותקן (בתמונה).
השוואה מספרית מול speechbrain המקורי: docs/studio-lang-research.md (הפרש מרבי 7.6e-6 ב־log-הסתברות)."""

import importlib.util
import json
import math
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import numpy as np

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

from vt import lang as L  # noqa: E402
from vt import lid  # noqa: E402
from vt import vi as V  # noqa: E402

SR = lid.SR
CODES = ["ar", "en", "he", "ru", "fr"]


def lp_rows(rows):
    """[(שפה, הסתברות)] → log-הסתברות [N, len(CODES)]: השפה מקבלת p, השאר מתחלקות בשווה."""
    out = np.zeros((len(rows), len(CODES)), dtype="float32")
    for i, (lg, p) in enumerate(rows):
        rest = (1 - p) / (len(CODES) - 1)
        out[i] = [math.log(p if c == lg else rest) for c in CODES]
    return out


class FakeModel:
    """במקום ECAPA: השפה של כל חלון לפי הזמן שלו (טבלה של [(עד שנייה, שפה, הסתברות)])."""

    def __init__(self, plan):
        self.plan, self.codes, self.calls = plan, CODES, 0

    def logp(self, clips):
        self.calls += 1
        rows = []
        for c in clips:
            t = float(c[0])                      # הקטע מתחיל בזמן שלו — האודיו המזויף הוא ציר הזמן עצמו
            rows.append(next(((lg, p) for until, lg, p in self.plan if t < until), self.plan[-1][1:]))
        return lp_rows(rows)


def clock(dur):
    """אודיו מזויף שבו כל דגימה = הזמן שלה בשניות — כך FakeModel יודע מאיפה הקטע."""
    return (np.arange(int(dur * SR), dtype="float64") / SR).astype("float32")


class Labels(unittest.TestCase):
    def test_parse_and_iw(self):
        with tempfile.TemporaryDirectory() as td:
            Path(td, "label_encoder.txt").write_text("'ab: Abkhazian' => 0\n'iw: Hebrew' => 1\n'en: English' => 2\n"
                                                    "================\n'starting_index' => 0\n", encoding="utf-8")
            self.assertEqual(lid.labels(td), ["ab", "he", "en"])
            self.assertFalse(lid.ready(td), "בלי המשקולות — לא מוכן")
            for f in ("embedding_model.ckpt", "classifier.ckpt"):
                Path(td, f).write_bytes(b"x")
            self.assertTrue(lid.ready(td))


class Windows(unittest.TestCase):
    def test_short_one_long_many_tiny_none(self):
        w = lid.windows([(0.0, 0.4), (1.0, 4.0), (5.0, 14.0)])
        self.assertEqual(w[0], (1.0, 4.0, 1), "קטע קצר — חלון אחד; קטע של 0.4 שנ׳ — בלי חלון")
        long_ = [x for x in w if x[2] == 2]
        self.assertEqual((long_[0][0], long_[-1][1]), (5.0, 14.0), "החלון האחרון צמוד לסוף")
        self.assertTrue(all(abs((b - a) - lid.WIN) < 1e-6 for a, b, _ in long_))
        self.assertTrue(all(long_[i + 1][0] - long_[i][0] <= lid.HOP + 1e-6 for i in range(len(long_) - 1)), "חפיפה")


class Choose(unittest.TestCase):
    def test_extra_language_needs_time_and_confidence(self):
        wins = [(i * 3.0, i * 3.0 + 3.0, i) for i in range(20)]
        rows = [("en", 0.9)] * 14 + [("ar", 0.9)] * 3 + [("ru", 0.9)] + [("fr", 0.5)] * 2
        c = lid.choose(lp_rows(rows), CODES, wins)
        self.assertEqual(c, ["he", "en", "ar"], "ערבית: 9 שנ׳ (15%) — נוספת; רוסית 3 שנ׳ — לא; צרפתית — ביטחון נמוך")
        self.assertEqual(lid.choose(lp_rows(rows), CODES, wins, base=("he", "en", "fr")), ["he", "en", "fr", "ar"])
        self.assertEqual(lid.choose(lp_rows([]), CODES, []), ["he", "en"])

    def test_extra_language_needs_a_run(self):
        # המדידה: טעות אקראית (חלונות בודדים או זוגות) לא יוצרת רצף; שפה אמיתית — רצף של 3 ומעלה, גם כשהיא 3% מסרטון ארוך
        wins = [(i * 3.0, i * 3.0 + 3.0, i) for i in range(100)]
        rows = [("en", 0.9)] * 40 + [("fr", 0.95)] * 3 + [("en", 0.9)] * 20 + [("ar", 0.9)] * 2 + [("en", 0.9)] * 10 \
            + [("ar", 0.9)] * 2 + [("en", 0.9)] * 23
        self.assertEqual(lid.choose(lp_rows(rows), CODES, wins), ["he", "en", "fr"],
                         "צרפתית: רצף של 3 (9 שנ׳, 3%) — נוספת; ערבית: 12 שנ׳ אבל רק זוגות — לא")
        self.assertEqual(lid.choose(lp_rows(rows), CODES, wins, extra_run=2), ["he", "en", "ar", "fr"])
        rows = [("en", 0.9)] * 10 + [("fr", 0.95), ("fr", 0.6), ("fr", 0.95), ("fr", 0.95)] + [("en", 0.9)] * 10
        self.assertEqual(lid.choose(lp_rows(rows), CODES, wins[:24]), ["he", "en"], "חלון לא בטוח באמצע שובר את הרצף")

    def test_many_languages_fit(self):
        # המדידה: בסרטון עם 4 שפות נוספות, תקרה של 3 השאירה רוסית בחוץ — והיא סומנה "צרפתית" (כאן: 3 שפות ותקרה של 2)
        wins = [(i * 3.0, i * 3.0 + 3.0, i) for i in range(100)]
        rows = [("en", 0.9)] * 30
        for lg in ("fr", "ar", "ru"):
            rows += [(lg, 0.95)] * 4 + [("en", 0.9)] * 5
        rows += [("en", 0.9)] * (100 - len(rows))
        self.assertEqual(lid.choose(lp_rows(rows), CODES, wins), ["he", "en", "fr", "ar", "ru"])
        self.assertEqual(lid.choose(lp_rows(rows), CODES, wins, extra_max=2), ["he", "en", "fr", "ar"])

    def test_restrict_normalizes(self):
        r = lid.restrict(lp_rows([("en", 0.6), ("ar", 0.9)]), CODES, ["he", "en"])
        self.assertTrue(np.allclose(np.exp(r).sum(axis=1), 1.0))
        self.assertGreater(r[0, 1], r[0, 0], "אנגלית מנצחת בשורה הראשונה")


class Viterbi(unittest.TestCase):
    def wins(self, n, gap_at=()):
        out, t = [], 0.0
        for i in range(n):
            if i in gap_at:
                t += 3.0
            out.append((t, t + 1.5, i))
            t += 1.5
        return out

    def test_single_outlier_is_smoothed(self):
        em = np.log(np.array([[0.9, 0.1]] * 4 + [[0.3, 0.7]] + [[0.9, 0.1]] * 4))
        self.assertEqual(lid.viterbi(em, self.wins(9)), [0] * 9, "חלון בודד באנגלית בתוך עברית — לא מחליף שפה")

    def test_sustained_switch_detected(self):
        # הכיול (SWITCH=6): מעבר הלוך־חזור עולה 12 — ארבעה חלונות ברורים (0.99, כמו ב־ECAPA על דיבור נקי) מספיקים
        em = np.log(np.array([[0.9, 0.1]] * 4 + [[0.01, 0.99]] * 4 + [[0.9, 0.1]] * 4))
        self.assertEqual(lid.viterbi(em, self.wins(12)), [0] * 4 + [1] * 4 + [0] * 4)
        em = np.log(np.array([[0.9, 0.1]] * 4 + [[0.05, 0.95]] * 5 + [[0.9, 0.1]] * 4))
        self.assertEqual(lid.viterbi(em, self.wins(13)), [0] * 4 + [1] * 5 + [0] * 4, "גם ראיה חלשה יותר — כשהיא נמשכת")

    def test_gap_makes_switch_cheaper(self):
        em = np.log(np.array([[0.9, 0.1]] * 4 + [[0.15, 0.85]] + [[0.9, 0.1]] * 4))
        self.assertEqual(lid.viterbi(em, self.wins(9)), [0] * 9)
        self.assertEqual(lid.viterbi(em, self.wins(9, gap_at=(4, 5)), switch=6.0, gap_switch=0.5), [0] * 4 + [1] + [0] * 4,
                         "אחרי הפסקה ארוכה (חילופי דוברים) — גם קטע קצר יכול להיות בשפה אחרת")
        self.assertEqual(lid.viterbi(np.zeros((0, 2)), []), [])


class Fold(unittest.TestCase):
    def test_belarusian_folds_into_russian(self):
        codes = ["he", "en", "ru", "be"]
        lp = np.log(np.array([[0.05, 0.05, 0.3, 0.6], [0.9, 0.04, 0.03, 0.03]]))
        out = lid.fold(lp, codes)
        self.assertAlmostEqual(float(np.exp(out[0, 2])), 0.9, places=6, msg="רוסית + בלארוסית = רוסית")
        self.assertEqual(float(out[0, 3]), -np.inf, "בלארוסית לא מועמדת")
        self.assertEqual(lid.choose(out, codes, [(0.0, 9.0, 0), (9.0, 12.0, 1)], extra_min_s=6.0, extra_run=1),
                         ["he", "en", "ru"], "הרוסית נבחרת — לא הבלארוסית")
        self.assertAlmostEqual(float(lp[0, 3]), np.log(0.6), msg="המקור לא משתנה")
        self.assertTrue(np.array_equal(lid.fold(lp, ["he", "en", "x", "y"]), lp), "בלי השפות — בלי שינוי")


class Regions(unittest.TestCase):
    def test_merge_and_bounds(self):
        spans = [(0.0, 6.0), (7.0, 9.0)]
        wins = [(0.0, 3.0, 0), (1.5, 4.5, 0), (3.0, 6.0, 0), (7.0, 9.0, 1)]
        regs = lid.regions(wins, ["he", "he", "en", "en"], [0.9, 0.8, 0.95, 0.9], spans)
        self.assertEqual([(g["s"], g["e"], g["lg"]) for g in regs], [(0.0, 3.75, "he"), (3.75, 9.0, "en")],
                         "גבול בין מרכזי החלונות; אזורים באותה שפה מתאחדים גם מעבר להפסקה")
        self.assertEqual(lid.share(regs), {"en": round(5.25 / 9.0, 3), "he": round(3.75 / 9.0, 3)})
        self.assertEqual(lid.lang_at(regs, 1.0), "he")
        self.assertEqual(lid.lang_at(regs, 9.5), "en", "קרוב לאזור — השפה שלו")
        self.assertEqual(lid.lang_at(regs, 30.0, "en"), "en", "רחוק — ברירת המחדל")
        self.assertEqual(lid.regions([], [], [], []), [])


def lab_of(regs, wins):
    """תווית וביטחון לכל חלון — מהאזור שבו המרכז שלו."""
    lab, prob = [], []
    for a, b, _ in wins:
        g = next(g for g in regs if g["s"] <= (a + b) / 2 <= g["e"])
        lab.append(g["lg"])
        prob.append(g["p"])
    return lab, prob


ZERO = {"n": 0, "flip": 0, "nlow": 0, "fliplow": 0}


class Verify(unittest.TestCase):
    """אימות אזורי המיעוט: ECAPA מהסס (0.78–0.96 בחלונות) — whisper-small, ששומע את כל האזור, מכריע; ECAPA בטוח — לא."""
    def setUp(self):
        self.wins = [(0.0, 3.0, 0), (1.5, 4.5, 0), (5.0, 8.0, 1), (6.5, 9.5, 1), (10.0, 13.0, 2), (11.5, 14.5, 2)]
        self.audio = np.zeros(16000 * 16, dtype="float32")
        self.cand = ["he", "en"]

    def em(self, rows):
        return np.log(np.array(rows))

    def run_v(self, regs, em, wp, **kw):
        lab, prob = lab_of(regs, self.wins)
        return lid.verify(regs, lab, prob, self.wins, em, self.cand, self.audio, "he", wp, **kw)

    def test_unsure_minority_region_is_overturned(self):
        regs = [{"s": 0.0, "e": 4.5, "lg": "he", "p": 0.99}, {"s": 5.0, "e": 9.5, "lg": "en", "p": 0.87},
                {"s": 10.0, "e": 14.5, "lg": "he", "p": 0.99}]
        em = self.em([[0.99, 0.01]] * 2 + [[0.22, 0.78], [0.04, 0.96]] + [[0.99, 0.01]] * 2)
        heard = []

        def wp(clip):
            heard.append(len(clip) / 16000)
            return {"he": 0.95, "en": 0.01, "ar": 0.04}
        lab, prob, st, fl = self.run_v(regs, em, wp)
        self.assertEqual((lab, st, fl), (["he"] * 6, dict(ZERO, n=1, flip=1), {2, 3}))
        self.assertAlmostEqual(heard[0], 4.5, places=2, msg="whisper שומע את האזור עצמו")
        merged = lid.regions(self.wins, lab, prob, [(0.0, 4.5), (5.0, 9.5), (10.0, 14.5)])
        self.assertEqual([(g["s"], g["e"], g["lg"]) for g in merged], [(0.0, 14.5, "he")], "שלושת האזורים מתאחדים")

    def test_confident_or_short_or_main_regions_are_not_checked(self):
        regs = [{"s": 0.0, "e": 4.5, "lg": "he", "p": 0.5}, {"s": 5.0, "e": 9.5, "lg": "en", "p": 1.0},
                {"s": 10.0, "e": 11.5, "lg": "en", "p": 0.6}]
        called = []
        wins = self.wins[:5]
        lab, prob = lab_of(regs, wins)
        out = lid.verify(regs, lab, prob, wins, self.em([[0.5, 0.5]] * 5), self.cand, self.audio, "he",
                         lambda c: called.append(1) or {"he": 1.0})
        self.assertEqual((out[0], out[2], called), (lab, ZERO, []), "השפה הראשית — לא; בטוח (1.0) — לא; קצר מ־2 שנ׳ — לא")

    def test_whisper_cannot_overturn_a_sure_ecapa(self):
        regs = [{"s": 0.0, "e": 4.5, "lg": "he", "p": 0.99}, {"s": 5.0, "e": 9.5, "lg": "en", "p": 0.99},
                {"s": 10.0, "e": 14.5, "lg": "he", "p": 0.99}]
        em = self.em([[0.99, 0.01]] * 2 + [[0.002, 0.998]] * 2 + [[0.99, 0.01]] * 2)
        lab, _, st, _ = self.run_v(regs, em, lambda c: {"he": 0.7, "en": 0.3})
        self.assertEqual((st, lab[2]), (dict(ZERO, n=1), "en"), "whisper בחלון קצר טועה — ECAPA בטוח מנצח")

    def test_failure_keeps_regions(self):
        regs = [{"s": 0.0, "e": 4.5, "lg": "he", "p": 0.99}, {"s": 5.0, "e": 9.5, "lg": "en", "p": 0.8},
                {"s": 10.0, "e": 14.5, "lg": "he", "p": 0.99}]
        lab, _ = lab_of(regs, self.wins)

        def boom(c):
            raise RuntimeError("x")
        for fn in (boom, None):
            out = self.run_v(regs, self.em([[0.5, 0.5]] * 6), fn)
            self.assertEqual((out[0], out[2], out[3]), (lab, ZERO, set()))

    def test_whisper_probs_reads_all_languages(self):
        class Info:
            language, language_probability = "he", 0.9
            all_language_probs = [("he", 0.9), ("en", 0.06), ("iw", 0.01)]

        class M:
            def transcribe(self, clip, **kw):
                return iter(()), Info()
        self.assertEqual(L.whisper_probs(M())(np.zeros(16000, "float32")), {"he": 0.91, "en": 0.06})


class LostEcapa(unittest.TestCase):
    """מבטא כבד: ECAPA "הולך לאיבוד" (רוב ההסתברות על שפות שאינן מועמדות), והצמצום לעברית/אנגלית הוא הטלת מטבע.
    המדידה: אנגלית במבטא ערבי בתוך סרטון עברי — סומנה כולה "עברית"; whisper: אנגלית 0.38, ערבית 0.51, עברית 0."""
    def setUp(self):
        self.wins = [(1.5 * i, 1.5 * i + 3.0, 0) for i in range(12)]
        self.audio = np.zeros(16000 * 22, dtype="float32")
        self.cov = np.array([0.99] * 3 + [0.02] * 8 + [0.99])

    def go(self, wp, cand=("he", "en"), lab=None):
        cand = list(cand)
        em = np.log(np.array([[0.9, 0.1] + [1e-6] * (len(cand) - 2)] * 12))
        em = em - np.logaddexp.reduce(em, axis=1, keepdims=True)
        lab = lab or ["he"] * 12
        regs = [{"s": 0.0, "e": 19.5, "lg": "he", "p": 0.9}]
        return lid.verify(regs, lab, [0.9] * 12, self.wins, em, cand, self.audio, "he", wp, cov=self.cov)

    def test_whisper_decides_he_vs_en(self):
        heard = []
        lab, _, st, fl = self.go(lambda c: heard.append(len(c) / 16000) or {"ar": 0.51, "en": 0.38})
        self.assertEqual((lab[3:11], lab[:3] + lab[11:], st["nlow"], st["fliplow"]), (["en"] * 8, ["he"] * 4, 1, 1))
        self.assertEqual(fl, set(range(3, 11)))
        self.assertAlmostEqual(heard[0], 13.5, places=1, msg="whisper שומע את הרצף (4.5–18)")

    def test_whisper_unsure_too(self):
        lab, _, st, _ = self.go(lambda c: {"ar": 0.9, "en": 0.05, "he": 0.01})
        self.assertEqual((lab, st), (["he"] * 12, ZERO), "עברית+אנגלית < 0.2 — גם whisper לא יודע")

    def test_only_he_vs_en(self):
        lab, _, st, _ = self.go(lambda c: {"ar": 0.8, "he": 0.15, "en": 0.05}, cand=("he", "en", "ar"))
        self.assertEqual((lab, st["fliplow"]), (["he"] * 12, 0), "whisper מבלבל עברית⇄ערבית — לא מחליפים לערבית")

    def test_mixed_chunk_is_skipped(self):
        lab0 = ["he"] * 3 + ["he", "en"] * 4 + ["he"]
        lab, _, st, _ = self.go(lambda c: {"en": 0.99}, lab=lab0)
        self.assertEqual((lab, st["nlow"]), (lab0, 0), "רצף שחוצה גבול — whisper שומע תערובת")

    def test_low_chunks(self):
        w = [(1.5 * i, 1.5 * i + 3.0, 0) for i in range(40)]
        cov = np.array([0.9] * 2 + [0.1] * 3 + [0.9] + [0.1] * 3 + [0.9] * 3 + [0.1] * 2 + [0.9] * 27)
        self.assertEqual(lid.low_chunks(cov, w), [[2, 3, 4, 6, 7, 8], [12, 13]], "חלון טוב בודד לא שובר; שלושה — כן")
        self.assertEqual(lid.low_chunks(cov, w, min_s=5.0), [[2, 3, 4, 6, 7, 8]], "רצף של 4.5 שנ׳ — קצר מ־5")
        self.assertEqual([len(c) for c in lid.low_chunks(np.full(40, 0.1), w)], [19, 21], "חתיכות של עד 30 שנ׳")
        self.assertAlmostEqual(float(lid.coverage(lp_rows([("ar", 0.6)]), CODES, ["he", "en"])[0]), 0.2, places=5)


class Confirm(unittest.TestCase):
    """שפה נוספת צריכה אישור של whisper ברצף החזק שלה. המדידה: 2 מתוך 11 דוברי אנגלית ילידים זוהו כ"וולשית" לכל
    ההקלטה (הקטגוריה הוולשית של VoxLingua107 מלאה באנגלית); whisper: אנגלית 0.955, וולשית 0.035."""
    def setUp(self):
        self.wins = [(3.0 * i, 3.0 * i + 3.0, i) for i in range(10)]
        self.audio = np.zeros(16000 * 31, dtype="float32")
        self.lp = lp_rows([("en", 0.9)] * 3 + [("ru", 0.9)] * 4 + [("en", 0.9)] * 3)

    def go(self, wp):
        return lid.confirm(["he", "en", "ru"], ("he", "en"), self.lp, CODES, self.wins, self.audio, wp)

    def test_drop_keep_swap(self):
        heard = []
        self.assertEqual(self.go(lambda c: heard.append(len(c) / 16000) or {"en": 0.955, "ru": 0.035}),
                         (["he", "en"], {"chk": 1, "drop": 1, "swap": 0}))
        self.assertEqual(heard, [12.0], "whisper שומע את הרצף החזק (9–21)")
        self.assertEqual(self.go(lambda c: {"ru": 0.6, "en": 0.3})[0], ["he", "en", "ru"])
        self.assertEqual(self.go(lambda c: {"ru": 0.25, "en": 0.7})[0], ["he", "en", "ru"], "0.2 ומעלה — נשארת")
        self.assertEqual(self.go(lambda c: {"fr": 0.8, "ru": 0.05}), (["he", "en", "fr"], {"chk": 1, "drop": 0, "swap": 1}))
        self.assertEqual(self.go(lambda c: {"ar": 0.4, "ru": 0.1, "en": 0.05})[0], ["he", "en", "ru"],
                         "whisper לא בטוח בשפה אחרת, ולא מעדיף שפת בסיס — נשארת")

    def test_without_whisper(self):
        def boom(c):
            raise RuntimeError("x")
        self.assertEqual(self.go(boom), (["he", "en", "ru"], {"chk": 0, "drop": 0, "swap": 0}))
        self.assertEqual(self.go(None)[0], ["he", "en", "ru"])
        self.assertEqual(lid.confirm(["he", "en"], ("he", "en"), self.lp, CODES, self.wins, self.audio, lambda c: {})[1]["chk"], 0)


class Timeline(unittest.TestCase):
    def test_mixed_video(self):
        a = clock(60)
        spans = [(1.0, 13.0), (14.0, 26.0), (27.0, 39.0), (40.0, 59.0)]
        m = FakeModel([(26.0, "en", 0.9), (39.0, "he", 0.9), (99, "en", 0.9)])
        tl = lid.timeline(a, spans=spans, model=m)
        self.assertEqual([g["lg"] for g in tl["regions"]], ["en", "he", "en"])
        self.assertEqual(tl["main"], "en")
        self.assertAlmostEqual(sum(tl["share"].values()), 1.0, places=2)
        he = tl["regions"][1]
        self.assertLessEqual(abs(he["s"] - 26.5), 1.0, "גבול המעבר — בהפסקה בין הקטעים")
        self.assertGreater(tl["n"], 4)

    def test_vad_and_empty(self):
        m = FakeModel([(99, "he", 0.9)])
        tl = lid.timeline(clock(20), model=m, vad_fn=lambda a: [(2.0, 8.0), (9.0, 18.0)])
        self.assertEqual((tl["main"], len(tl["regions"])), ("he", 1))
        self.assertEqual(lid.timeline(clock(5), model=m, vad_fn=lambda a: [])["regions"], [])
        with self.assertRaises(ValueError):
            lid.timeline(clock(1), model=m, spans=[(0, lid.MAX_S + 10)])

    def test_verify_inside_timeline(self):
        spans = [(1.0, 13.0), (14.0, 26.0), (27.0, 39.0), (40.0, 59.0)]
        plan = [(26.0, "en", 0.9), (39.0, "he", 0.7), (99, "en", 0.9)]      # עברית מהססת (האזור יוצא בביטחון 0.9)
        base = lid.timeline(clock(60), spans=spans, model=FakeModel(plan))
        self.assertEqual(([g["lg"] for g in base["regions"]], base["vf"]["n"]), (["en", "he", "en"], 0))
        heard = []
        tl = lid.timeline(clock(60), spans=spans, model=FakeModel(plan), verify_fn=lambda c: heard.append(float(c[0])) or {"en": 0.999})
        self.assertEqual(([g["lg"] for g in tl["regions"]], tl["vf"]["n"], tl["vf"]["flip"], tl["main"]), (["en"], 1, 1, "en"))
        self.assertEqual(tl["regions"][0].get("v"), 1)
        self.assertTrue(26.0 <= heard[0] <= 28.0, "whisper שומע את האזור החשוד עצמו")
        self.assertEqual(lid.timeline(clock(5), model=FakeModel(plan), vad_fn=lambda a: [])["vf"], {})

    def test_prefer_breaks_ties_only(self):
        m = FakeModel([(99, "en", 0.52)])         # כמעט שוויון — ההעדפה של המשתמש מכריעה בהתחלה
        tl = lid.timeline(clock(10), spans=[(0.0, 4.0)], model=m, prefer="he")
        self.assertIn("he", tl["cands"])
        strong = lid.timeline(clock(10), spans=[(0.0, 4.0)], model=FakeModel([(99, "en", 0.95)]), prefer="he")
        self.assertEqual(strong["main"], "en", "ראיה חזקה גוברת על הבחירה")


class ForeignRegions(unittest.TestCase):
    def test_filter_pad_and_split(self):
        tl = {"regions": [{"s": 0.0, "e": 10.0, "lg": "en", "p": 0.9}, {"s": 10.0, "e": 10.6, "lg": "he", "p": 0.9},
                          {"s": 10.6, "e": 70.0, "lg": "he", "p": 0.8}, {"s": 70.0, "e": 80.0, "lg": "iw", "p": 0.9}]}
        out = L.foreign_regions(tl, "en")
        self.assertTrue(all(g["lg"] == "he" for g in out), "אנגלית (הראשית) לא; iw → he")
        self.assertTrue(all(g["e"] - g["s"] <= L.PIECE_S + 2 * L.TL_PAD_S + 1e-6 for g in out), "חלקים של עד 28 שנ׳")
        self.assertEqual(round(out[0]["s"], 2), round(10.6 - L.TL_PAD_S, 2))
        self.assertNotIn(10.0 - L.TL_PAD_S, [g["s"] for g in out], "אזור של 0.6 שנ׳ — קצר מדי")
        self.assertEqual(L.foreign_regions({"regions": []}, "en"), [])
        self.assertEqual(L.foreign_regions(None, "en"), [])

    def test_quiet_cut_with_audio(self):
        a = np.random.RandomState(0).randn(SR * 60).astype("float32") * 0.1
        a[int(29.0 * SR):int(29.6 * SR)] = 0                   # שקט ליד אמצע האזור
        out = L.foreign_regions({"regions": [{"s": 0.0, "e": 58.0, "lg": "he", "p": 0.9}]}, "en", audio=a)
        self.assertEqual(len(out), 3)
        cut = out[0]["e"]
        self.assertTrue(18.0 <= cut <= 21.5, cut)


class Whisperish:
    def __init__(self, words):
        self.words, self.calls = words, []

    def transcribe(self, clip, **kw):
        self.calls.append(kw)
        W = types.SimpleNamespace
        ws = [W(word=w, start=a, end=b) for w, a, b in self.words.get(kw.get("language"), [])]
        return iter([W(text="".join(x.word for x in ws), words=ws)] if ws else []), W(language=kw.get("language"),
                                                                                        language_probability=1.0)


class TranscribeHebrew(unittest.TestCase):
    def test_hebrew_goes_to_ivrit_others_to_small(self):
        audio = np.zeros(SR * 40, dtype="float32")
        found = [{"s": 2.0, "e": 6.0, "lg": "he", "p": 0.9}, {"s": 10.0, "e": 14.0, "lg": "ar", "p": 0.9}]
        ivrit = Whisperish({"he": [(" שלום", 0.1, 0.5)]})
        small = Whisperish({"ar": [(" مرحبا", 0.2, 0.6)], "he": [(" שגוי", 0, 1)]})
        out = L.transcribe_spans(audio, found, model=small, he_model=ivrit)
        self.assertEqual([(g["lg"], g["tx"]) for g in out], [("he", "שלום"), ("ar", "مرحبا")])
        self.assertEqual([c["language"] for c in ivrit.calls], ["he"])
        self.assertEqual([c["language"] for c in small.calls], ["ar"], "whisper-small לא מתמלל את העברית")

    def test_ivrit_failure_falls_back(self):
        class Boom:
            def transcribe(self, clip, **kw):
                raise RuntimeError("x")
        small = Whisperish({"he": [(" גיבוי", 0.1, 0.4)]})
        out = L.transcribe_spans(np.zeros(SR * 10, dtype="float32"), [{"s": 1.0, "e": 4.0, "lg": "he", "p": 0.9}],
                                 model=small, he_model=Boom())
        self.assertEqual(out[0]["tx"], "גיבוי")


def fake_sf(dur=60):
    m = types.ModuleType("soundfile")
    m.read = lambda path, dtype=None: (clock(dur), SR)
    return m


class AnalysisPath(unittest.TestCase):
    def setUp(self):
        os.environ.pop("SNB_LID", None)

    def test_lang_mix_with_timeline(self):
        tl = {"regions": [{"s": 0.0, "e": 20.0, "lg": "en", "p": 0.9}, {"s": 20.0, "e": 30.0, "lg": "he", "p": 0.9}]}
        words = [{"w": "hello", "s": 1.0, "e": 1.5, "p": 0.9}, {"w": "sha", "s": 22.0, "e": 22.4, "p": 0.3},
                 {"w": "lom", "s": 22.5, "e": 23.0, "p": 0.2}]
        ivrit = Whisperish({"he": [(" שלום", 2.0, 2.6)]})
        with mock.patch.dict(sys.modules, {"soundfile": fake_sf()}), mock.patch.object(L, "_ivrit", lambda: ivrit), \
                mock.patch.object(L, "ivrit_ready", lambda: True):
            out, st = V.lang_mix("x.wav", words, None, "en", tl=tl)
        self.assertEqual([(w["w"], w.get("lg")) for w in out], [("hello", None), ("שלום", "he")])
        self.assertEqual((st["lid_n"], st["lid_src"]), (1, "ecapa"))
        with mock.patch.dict(os.environ, {"SNB_LID": "off"}):
            self.assertIs(V.lang_mix("x.wav", words, None, "en", tl=tl)[0], words)

    def test_asr_switches_to_spoken_language(self):
        tl = {"regions": [{"s": 0.0, "e": 50.0, "lg": "he", "p": 0.9}, {"s": 50.0, "e": 60.0, "lg": "en", "p": 0.9}],
              "share": {"he": 0.83, "en": 0.17}, "main": "he", "cands": ["he", "en"], "n": 30, "s": 1.0}
        seen = {}

        def fake_asr(wav, lang, t0, tl_=None):
            seen["lang"], seen["tl"] = lang, tl_
            return {"v": 1, "lang": lang, "engine": "x", "quality": "ok", "words": [], "stats": {}}
        with mock.patch.object(V, "lang_timeline", lambda wav, prefer, model=None, wmodel=None: tl), mock.patch.object(V, "_asr", fake_asr):
            r = V.asr("x.wav", "en")
            self.assertEqual((seen["lang"], r["langs"]["chosen"], r["langs"]["main"]), ("he", "en", "he"),
                             "נבחרה אנגלית, 83% בעברית — מתמללים בעברית, ושומרים מה נבחר")
            self.assertIs(seen["tl"], tl)
            r = V.asr("x.wav", "auto")
            self.assertEqual((r["lang"], r["stats"]["auto"]["src"]), ("he", "ecapa"))
            tl2 = dict(tl, share={"he": 0.55, "en": 0.45})
        with mock.patch.object(V, "lang_timeline", lambda wav, prefer, model=None, wmodel=None: tl2), mock.patch.object(V, "_asr", fake_asr):
            V.asr("x.wav", "en")
            self.assertEqual(seen["lang"], "en", "55% — לא מספיק כדי לעקוף את הבחירה")
        with mock.patch.object(V, "lang_timeline", lambda wav, prefer, model=None, wmodel=None: None), mock.patch.object(V, "_asr", fake_asr):
            r = V.asr("x.wav", "en")
            self.assertNotIn("langs", r, "בלי ציר — כמו קודם")

    def test_lang_timeline_off_and_missing(self):
        with mock.patch.dict(os.environ, {"SNB_LID": "off"}):
            self.assertIsNone(V.lang_timeline("x.wav", "en", model=FakeModel([(99, "en", 0.9)])))
        with mock.patch.object(lid, "ready", lambda path=None: False):
            self.assertIsNone(V.lang_timeline("x.wav", "en"))
        with mock.patch.dict(sys.modules, {"soundfile": fake_sf(30)}), \
                mock.patch("vt.asr_he.vad", lambda a: [(1.0, 9.0), (10.0, 20.0)]):
            tl = V.lang_timeline("x.wav", "en", model=FakeModel([(9.5, "en", 0.9), (99, "he", 0.9)]))
        self.assertEqual([g["lg"] for g in tl["regions"]], ["en", "he"])
        doc = V.langs_doc(tl, "en")
        self.assertEqual((doc["src"], doc["chosen"], doc["regions"][0][2]), ("ecapa", "en", "en"))
        self.assertEqual(V.langs_doc(None), {})


class TranslationPath(unittest.TestCase):
    def test_cmd_lang_uses_timeline(self):
        from vt import cli
        with tempfile.TemporaryDirectory() as td, mock.patch.dict(os.environ, {"VT_WORK": td}):
            os.environ.pop("SNB_LID", None)
            pd = Path(td, "job1")
            (pd / "asr").mkdir(parents=True)
            (pd / "project.json").write_text("{}", encoding="utf-8")
            (pd / "asr" / "parakeet.json").write_text(json.dumps({"words": [{"w": "hi", "s": 1, "e": 1.4, "conf": 0.99}]}),
                                                      encoding="utf-8")
            (pd / "audio16k.wav").write_bytes(b"x")
            tl = {"regions": [{"s": 0.0, "e": 10.0, "lg": "en", "p": 0.9}, {"s": 10.0, "e": 14.0, "lg": "he", "p": 0.9}],
                  "share": {"en": 0.71, "he": 0.29}, "main": "en", "cands": ["he", "en"], "n": 8, "s": 0.5}
            got = {}

            def tsp(audio, found, **kw):
                got["found"] = found
                return [dict(g, tx="שלום", wd=[[" שלום", g["s"] + 0.1, g["s"] + 0.5]]) for g in found]
            with mock.patch.object(lid, "ready", lambda path=None: True), mock.patch.object(lid, "timeline", lambda a, prefer="", verify_fn=None: tl), \
                    mock.patch.object(L, "transcribe_spans", tsp), mock.patch.dict(sys.modules, {"soundfile": fake_sf(20)}):
                cli.cmd_lang(types.SimpleNamespace(name="job1"))
            doc = json.loads((pd / "foreign.json").read_text(encoding="utf-8"))
            self.assertEqual([(g["lg"], g["tx"]) for g in doc["seg"]], [("he", "שלום")])
            self.assertEqual(doc["tl"]["share"], {"en": 0.71, "he": 0.29})
            self.assertTrue(all(g["lg"] == "he" for g in got["found"]))


@unittest.skipUnless(importlib.util.find_spec("torch"), "torch לא מותקן (נבדק בתמונה של העובד)")
class Net(unittest.TestCase):
    def test_structure_and_shapes(self):
        torch, Ecapa, Head = lid._net()
        e, h = Ecapa(), Head(n=107)
        self.assertEqual((len(e.state_dict()), len(h.state_dict())), (231, 14), "אותם מפתחות כמו המשקולות של speechbrain")
        self.assertIn("blocks.1.res2net_block.blocks.0.conv.conv.weight", e.state_dict())
        self.assertIn("DNN.block_0.linear.w.weight", h.state_dict())
        e.eval(), h.eval()
        x = torch.randn(2, 150, 60)
        with torch.no_grad():
            out = h(e(x))
        self.assertEqual(tuple(out.shape), (2, 107))
        self.assertTrue(torch.allclose(out.exp().sum(dim=1), torch.ones(2), atol=1e-4))

    def test_fbank_matrix(self):
        fb = lid.fbank_matrix()
        self.assertEqual(tuple(fb.shape), (201, 60))
        self.assertTrue(bool((fb >= 0).all()) and float(fb.max()) <= 1.0 + 1e-6)


if __name__ == "__main__":
    unittest.main()
