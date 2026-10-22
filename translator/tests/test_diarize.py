"""22/10/2026: זיהוי דוברים מהקול (vt/diarize.py). בלי המודל האמיתי — טביעות מדומות לכל דובר.
עם המודל (SNB_SPK_DIR) — גם בדיקה על קול אמיתי. נמדד מול VoxConverse: שגיאת דובר ברמת מילה ~2%."""
import os
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vt import diarize as D  # noqa: E402


def W(w, s, e):
    return {"w": w, "s": s, "e": e, "spk": None, "conf": None}


def talk(plan):
    """plan = [(דובר, מספר מילים, הפסקה אחרי)] → מילים + הדובר האמיתי של כל מילה"""
    ws, truth, t = [], [], 0.0
    for spk, n, gap in plan:
        for k in range(n):
            ws.append(W(f"w{len(ws)}", t, t + 0.3))
            truth.append(spk)
            t += 0.35
        t += gap
    return ws, truth


def fake_embed(truth_at, dim=32, noise=0.15, seed=3):
    """טביעה לפי הדובר שמדבר באמצע הקטע: וקטור קבוע לכל דובר + רעש"""
    r = np.random.default_rng(seed)
    base = {}

    def f(x):
        spk = truth_at(f.cur)
        if spk not in base:
            v = r.normal(size=dim)
            base[spk] = v / np.linalg.norm(v)
        e = base[spk] + noise * r.normal(size=dim) / np.sqrt(dim)
        return e / np.linalg.norm(e)
    f.cur = 0.0
    return f


class Units(unittest.TestCase):
    def test_split_at_pause_and_long_runs(self):
        ws, _ = talk([("A", 30, 1.0), ("B", 3, 0.5)])
        us = D.units(ws)
        self.assertTrue(all(b > a for a, b, _ in us))
        self.assertEqual(sum(b - a for a, b, _ in us), len(ws))
        self.assertGreater(len(us), 2)                                # 30 מילים רצופות = כמה חלונות
        self.assertTrue(any(a == 30 for a, _, _ in us))                # ההפסקה מפרידה


class Cluster(unittest.TestCase):
    def test_three_groups(self):
        r = np.random.default_rng(0)
        c = r.normal(size=(3, 16))
        c /= np.linalg.norm(c, axis=1, keepdims=True)
        X = np.concatenate([c[k] + 0.05 * r.normal(size=(20, 16)) for k in range(3)])
        X /= np.linalg.norm(X, axis=1, keepdims=True)
        lab = D.cluster(X)
        self.assertEqual(len(set(lab)), 3)
        for k in range(3):
            self.assertEqual(len(set(lab[k * 20:(k + 1) * 20])), 1)

    def test_one_speaker_stays_one(self):
        r = np.random.default_rng(1)
        v = r.normal(size=16)
        X = v + 0.05 * r.normal(size=(30, 16))
        X /= np.linalg.norm(X, axis=1, keepdims=True)
        self.assertEqual(len(set(D.cluster(X))), 1)

    def test_tiny(self):
        self.assertEqual(list(D.cluster(np.zeros((0, 4)))), [])
        self.assertEqual(list(D.cluster(np.ones((1, 4)) / 2)), [0])


class Assign(unittest.TestCase):
    def test_interview(self):
        ws, truth = talk([("A", 12, 0.6), ("B", 25, 0.5), ("A", 8, 0.4), ("B", 30, 0.7), ("A", 10, 0.3)])
        audio = np.zeros(int((ws[-1]["e"] + 1) * D.SR), dtype=np.float32)
        emb = fake_embed(lambda t: truth[min(range(len(ws)), key=lambda i: abs(ws[i]["s"] - t))])
        starts = iter([ws[a]["s"] for a, _, _ in D.units(ws)])       # הטביעה המדומה לפי תחילת כל קטע

        def e(x):
            emb.cur = next(starts)
            return emb(x)
        st = D.assign(ws, audio, e)
        self.assertEqual(st["speakers"], 2)
        got = [w["spk"] for w in ws]
        self.assertEqual(got[0], "S1")                                  # מספור לפי סדר ההופעה
        m = {"A": "S1", "B": "S2"}
        ok = sum(m[t] == g for t, g in zip(truth, got))
        self.assertGreaterEqual(ok / len(ws), 0.95)


class Fallback(unittest.TestCase):
    def test_no_model_leaves_words(self):
        ws, _ = talk([("A", 5, 0.5)])
        old = os.environ.get("SNB_SPK_DIR")
        os.environ["SNB_SPK_DIR"] = "/nonexistent"
        try:
            if D.model_path() is not None:
                self.skipTest("מודל מותקן במערכת")
            self.assertIsNone(D.diarize(ws, "/nonexistent.wav"))
        finally:
            if old is None:
                os.environ.pop("SNB_SPK_DIR", None)
            else:
                os.environ["SNB_SPK_DIR"] = old
        self.assertTrue(all(w["spk"] is None for w in ws))

    def test_off_and_engine_speakers(self):
        ws, _ = talk([("A", 5, 0.5)])
        os.environ["SNB_DIARIZE"] = "off"
        try:
            self.assertIsNone(D.diarize(ws, "x.wav"))
        finally:
            os.environ.pop("SNB_DIARIZE")
        ws[0]["spk"] = "S1"                                             # המנוע כבר נתן דוברים — לא נוגעים
        self.assertIsNone(D.diarize(ws, "x.wav"))
        self.assertIsNone(ws[1]["spk"])

    def test_fbank_shape(self):
        f = D.fbank(np.zeros(16000, dtype=np.float32) + 0.001)
        self.assertEqual(f.shape, (98, 80))
        self.assertTrue(np.isfinite(f).all())


if __name__ == "__main__":
    unittest.main()
