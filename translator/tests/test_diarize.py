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

    def test_switch_snaps_to_sentence_end(self):
        """'we're going to let you | know. But…' — החלון נחתך באמצע; ההחלפה זזה לסוף המשפט"""
        ws, truth = talk([("A", 7, 0.0), ("B", 9, 0.0), ("A", 14, 0.6), ("B", 14, 0.6)])
        ws[6]["w"] = "know."
        audio = np.zeros(int((ws[-1]["e"] + 1) * D.SR), dtype=np.float32)
        us = D.units(ws)
        r = np.random.default_rng(5)
        base = {k: v / np.linalg.norm(v) for k, v in (("A", r.normal(size=32)), ("B", r.normal(size=32)))}

        def e(x, _it=iter(us)):
            a, b, _ = next(_it)
            maj = max("AB", key=lambda k: sum(truth[i] == k for i in range(a, b)))
            v = base[maj] + 0.05 * r.normal(size=32)
            return v / np.linalg.norm(v)
        D.assign(ws, audio, e)
        m = {ws[0]["spk"]: "A"}
        m.update({x: "B" for x in {w["spk"] for w in ws} if x not in m})
        self.assertEqual([m[w["spk"]] for w in ws[:16]], truth[:16])


class MergeSmall(unittest.TestCase):
    """23/10/2026: דובר אחד שפוצל לשני אשכולות מתאחד; דובר אמיתי קטן (קול אחר) נשאר."""

    def emb(self, base, n, noise, r):
        X = base + noise * r.normal(size=(n, len(base)))
        return X / np.linalg.norm(X, axis=1, keepdims=True)

    def test_split_speaker_merges_real_small_stays(self):
        r = np.random.default_rng(7)
        a, b = r.normal(size=32), r.normal(size=32)
        a /= np.linalg.norm(a)
        b /= np.linalg.norm(b)
        a2 = a + 0.6 * r.normal(size=32) / np.sqrt(32)                   # אותו קול — דמיון ~0.85 לממוצע
        a2 /= np.linalg.norm(a2)
        E = np.concatenate([self.emb(a, 60, 0.3, r), self.emb(a2, 4, 0.3, r), self.emb(b, 4, 0.3, r)])
        dur = np.full(len(E), 2.0)
        cent = np.stack([a, a2, b])
        who = (E @ cent.T).argmax(axis=1)
        who, cent = D.merge_small(E, dur, who, cent)
        self.assertEqual(len(cent), 2)
        self.assertEqual(len(set(who[:64].tolist())), 1)                  # הפיצול אוחד
        self.assertNotEqual(who[0], who[-1])                              # הקטן האמיתי נשאר לבד

    def test_big_clusters_need_more(self):
        r = np.random.default_rng(3)
        a = r.normal(size=32)
        a /= np.linalg.norm(a)
        b = a + 1.4 * r.normal(size=32) / np.sqrt(32)                     # דומה, אבל שני דוברים גדולים
        b /= np.linalg.norm(b)
        E = np.concatenate([self.emb(a, 80, 0.2, r), self.emb(b, 80, 0.2, r)])
        dur = np.full(len(E), 2.0)                                        # 160 שנ׳ לכל אחד — סף ~1.2
        who, cent = D.merge_small(E, dur, (E @ np.stack([a, b]).T).argmax(axis=1), np.stack([a, b]))
        self.assertEqual(len(cent), 2)


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


class VoiceGender(unittest.TestCase):
    """26/10/2026: מגדר מגובה הקול במקום שאלה למשתמש. נבדק גם על הקלטות אמיתיות (LibriVox / LibriSpeech, גברים:
    94–112Hz); בצעקה של נאום הגובה עולה מעל 250Hz — לכן זה רמז בלבד, וההקשר בהנחיה גובר."""
    @staticmethod
    def voice(f0, dur, seed=1):
        rng = np.random.default_rng(seed)
        t = np.arange(int(dur * D.SR)) / D.SR
        ph = 2 * np.pi * np.cumsum(f0 * (1 + 0.06 * np.sin(2 * np.pi * 3 * t))) / D.SR
        x = sum((1 / k) * np.sin(k * ph) for k in range(1, 15)) * (np.sin(2 * np.pi * 2.5 * t) > -0.3)
        return (0.1 * x + 0.003 * rng.standard_normal(len(t))).astype(np.float32)

    def test_male_and_female(self):
        a = np.concatenate([self.voice(115, 5), np.zeros(D.SR // 2, np.float32), self.voice(215, 5)])
        words = [W('a', 0.0, 5.0), W('b', 5.5, 10.5)]
        words[0]['spk'], words[1]['spk'] = 'S1', 'S2'
        g = D.voice_gender(words, a)
        self.assertEqual(g['S1']['g'], 'm')
        self.assertEqual(g['S2']['g'], 'f')
        self.assertTrue(105 <= g['S1']['hz'] <= 125 and 200 <= g['S2']['hz'] <= 230, g)

    def test_between_and_too_short_and_noise(self):
        w = W('a', 0.0, 5.0)
        w['spk'] = 'S1'
        self.assertEqual(D.voice_gender([w], self.voice(163, 5))['S1']['g'], '?', 'בין הספים — לא מכריעים')
        w2 = W('a', 0.0, 0.8)
        w2['spk'] = 'S1'
        self.assertEqual(D.voice_gender([w2], self.voice(120, 0.8)), {}, 'מעט מדי דיבור — בלי רמז')
        noise = np.random.default_rng(2).standard_normal(5 * D.SR).astype(np.float32) * 0.1
        self.assertEqual(D.voice_gender([w], noise), {}, 'רעש — לא מחזורי')


class Image(unittest.TestCase):
    def test_dockerfile_has_model(self):
        d = (Path(__file__).resolve().parents[2] / "infra/worker/Dockerfile").read_text(encoding="utf-8")
        self.assertIn(D.MODEL_SHA256, d, "אותו sha256 בתמונה ובקוד")
        self.assertIn("COPY --from=speaker /opt/speaker /opt/speaker", d)
        self.assertRegex(d, r"find /app /opt/aligner /opt/speaker -type f -exec chmod 644", "קריאה למשתמש של העובד")


if __name__ == "__main__":
    unittest.main()
