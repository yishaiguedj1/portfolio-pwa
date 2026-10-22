"""22/10/2026 (ניתוח המאגר): בדיקת ההזזה ב־tr-check — תרגום שכל שורה בו שייכת לכתובית הבאה (AppLovin, 93 כתוביות)."""
import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vt.translate import check, drift_ids  # noqa: E402


def make(n=120, seed=4):
    r = random.Random(seed)
    cues, he = [], {}
    for i in range(1, n + 1):
        en = " ".join("word" for _ in range(r.randint(2, 16)))
        cues.append({"id": i, "en": en, "budget": 84})
        he[str(i)] = "מ" * int(len(en) * r.uniform(0.75, 0.95))
    return cues, he


class Drift(unittest.TestCase):
    def test_clean_no_flags(self):
        for seed in range(20):
            cues, he = make(seed=seed)
            self.assertEqual(drift_ids(cues, he), {}, seed)

    def test_shift_detected(self):
        cues, he = make()
        sh = dict(he)
        for i in range(40, 100):               # מ־40: כל תרגום = של הבאה
            sh[str(i)] = he[str(i + 1)]
        d = drift_ids(cues, sh)
        hit = {int(k) for k, v in d.items() if v == 1}
        self.assertTrue(set(range(50, 90)) <= hit, sorted(hit))
        self.assertFalse(hit & set(range(1, 30)))
        issues, st = check(cues, sh, [])
        self.assertGreater(st["drift"], 30)
        self.assertTrue(any("הזזה" in x for x in issues))


if __name__ == "__main__":
    unittest.main()
