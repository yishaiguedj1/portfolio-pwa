"""26/10/2026 — מאגר הלמידה: ביטחון לכל מילה בתמלול (מה־log-prob ש־onnx_asr מחשב ממילא) ומצב הקול
(חלק הדיבור, יחס אות/רעש, מילים לדקה, חלק המילים בביטחון נמוך). רק מספרים, בלי שינוי בתמלול עצמו."""
import json
import math
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402
from vt import asr_parakeet as A  # noqa: E402


class Conf(unittest.TestCase):
    def test_word_conf_is_geometric_mean(self):
        ws = A.tokens_to_words([' P', 'ick', 'ed', ' off', ','], [0.08, 0.16, 0.32, 0.4, 0.5], 10.0, 11.0,
                               [math.log(0.9), math.log(0.8), math.log(0.5), math.log(0.99), 0.0])
        self.assertEqual([w['w'] for w in ws], ['Picked', 'off,'])
        self.assertAlmostEqual(ws[0]['conf'], round((0.9 * 0.8 * 0.5) ** (1 / 3), 3), places=3)
        self.assertAlmostEqual(ws[1]['conf'], round(math.sqrt(0.99), 3), places=3)

    def test_without_logprobs_unchanged(self):
        a = A.tokens_to_words([' P', 'ick', 'ed', ' off', ','], [0.08, 0.16, 0.32, 0.4, 0.5], 10.0, 11.0)
        b = A.tokens_to_words([' P', 'ick', 'ed', ' off', ','], [0.08, 0.16, 0.32, 0.4, 0.5], 10.0, 11.0, [0.0, 0.0])
        self.assertEqual(a, b, 'אורך לא תואם — כמו בלי (גם הטלפון, ph2, בלי ביטחון)')
        self.assertTrue(all(w['conf'] is None for w in a))
        self.assertEqual(set(a[0]), {'w', 's', 'e', 'spk', 'conf'}, 'בלי שדה עזר שנשאר')

    def test_audio_stats(self):
        sr = 16000
        rng = np.random.default_rng(1)
        audio = (rng.standard_normal(sr * 4) * 0.01).astype(np.float32)        # רעש חלש
        audio[sr:3 * sr] += (np.sin(np.arange(2 * sr) / 5) * 0.3).astype(np.float32)   # "דיבור" חזק בשנייה 1–3
        words = [{'w': 'a', 'conf': 0.9}, {'w': 'b', 'conf': 0.3}, {'w': 'c', 'conf': 0.95}, {'w': 'd', 'conf': None}]
        st = A.audio_stats(audio, sr, [(sr, 3 * sr)], words)
        self.assertEqual(st['sp'], 0.5)
        self.assertGreater(st['snr'], 20)
        self.assertEqual(st['wpm'], 120.0)
        self.assertEqual((st['cm'], st['lc']), (0.9, round(1 / 3, 4)))
        self.assertEqual(A.audio_stats(np.zeros(0), sr, [], []), {})

    def test_learn_facts_au(self):
        with tempfile.TemporaryDirectory() as d:
            pd = Path(d)
            (pd / 'asr').mkdir()
            (pd / 'asr' / 'parakeet.json').write_text(json.dumps({'words': [], 'audio': {'sp': 0.7, 'snr': 12.5, 'lc': 0.05, 'bad key': 1, 'x': 'txt'}}))
            out = job.learn_facts(SimpleNamespace(pdir=pd, st={'spec': {}}))
            self.assertEqual(out['au'], {'sp': 0.7, 'snr': 12.5, 'lc': 0.05})


if __name__ == '__main__':
    unittest.main()
