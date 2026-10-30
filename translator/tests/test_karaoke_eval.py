"""tools/karaoke-he/eval.py — מדדי התזמון מול תיוג אמת. נתונים סינתטיים בלבד."""
import csv
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location('karaoke_eval', ROOT / 'tools' / 'karaoke-he' / 'eval.py')
E = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(E)


def ref_words():
    # שתי שורות: "אחת שתיים שלוש" / "ארבע חמש"
    t = [('אחת', 1.0, 0), ('שתיים', 2.0, 0), ('שלוש', 3.0, 1), ('ארבע', 10.0, 0), ('חמש', 11.0, 1)]
    return [{'w': w, 's': s, 'e': s + 0.5, 'le': bool(le)} for w, s, le in t]


def shifted(ref, ds):
    return [{'w': r['w'], 's': r['s'] + d, 'e': r['e'] + d, 'le': None} for r, d in zip(ref, ds)]


class Score(unittest.TestCase):
    def test_perfect(self):
        r = E.score(ref_words(), shifted(ref_words(), [0] * 5))
        self.assertEqual((r['miss'], r['aae'], r['pco15'], r['gt1']), (0, 0.0, 1.0, 0.0))

    def test_errors_and_line_starts(self):
        # שורה ראשונה מתחילה מוקדם ב־1.5, השנייה מאוחרת ב־0.4; שאר המילים מדויקות
        r = E.score(ref_words(), shifted(ref_words(), [-1.5, 0, 0, 0.4, 0]))
        self.assertAlmostEqual(r['aae'], 1.9 / 5)
        self.assertAlmostEqual(r['pco30'], 0.6)
        self.assertAlmostEqual(r['gt1'], 0.2)
        self.assertEqual((r['lines'], r['l_late30']), (2, 1))
        self.assertAlmostEqual(r['l_late_max'], 0.4)
        self.assertAlmostEqual(r['l_early_med'], 1.5)
        self.assertAlmostEqual(r['bias'], -1.1 / 5)

    def test_shift_calibration(self):
        res = shifted(ref_words(), [0.2] * 5)
        self.assertAlmostEqual(E.score(ref_words(), res)['shift'], 0.2)
        self.assertAlmostEqual(E.score(ref_words(), res, shift=0.2)['aae'], 0.0)

    def test_text_matching_when_counts_differ(self):
        # התוצאה דילגה על "שתיים" והוסיפה מילה זרה; ניקוד וגרש לא מפריעים להתאמה
        ref = ref_words()
        res = [{'w': 'אַחַת', 's': 1.0, 'e': 1.5}, {'w': 'שלוש', 's': 3.0, 'e': 3.5}, {'w': 'זבל', 's': 5, 'e': 6},
               {'w': 'ארבע', 's': 10.0, 'e': 10.5}, {'w': 'חמש', 's': 11.0, 'e': 11.5}, {'w': 'עוד', 's': 12, 'e': 13}]
        r = E.score(ref, res)
        self.assertEqual(r['miss'], 1)
        self.assertEqual(r['aae'], 0.0)

    def test_norm(self):
        self.assertEqual(E.norm('ת′מערכת,'), "ת'מערכת")
        self.assertEqual(E.norm('שָׁלוֹם!'), 'שלום')


class Files(unittest.TestCase):
    def test_csv_json_and_set(self):
        with tempfile.TemporaryDirectory() as d:
            song = Path(d) / 's1'
            song.mkdir()
            with open(song / 'ref.csv', 'w', encoding='utf-8', newline='') as f:
                w = csv.writer(f)
                w.writerow(['word_start', 'word_end', 'line_end', 'word'])
                for x in ref_words():
                    w.writerow([x['s'], x['e'], int(x['le']), x['w']])
            ref = E.load(str(song / 'ref.csv'))
            self.assertEqual([x['le'] for x in ref], [False, False, True, False, True])
            (song / 'base.json').write_text(json.dumps({'words': [{'w': x['w'], 's': x['s'] + 0.1, 'e': x['e']}
                                                                  for x in ref]}), encoding='utf-8')
            r = E.score(ref, E.load(str(song / 'base.json')))
            self.assertAlmostEqual(r['med'], 0.1)
            m = E.mean([r, r])
            self.assertAlmostEqual(m['aae'], r['aae'])
            self.assertIn('ממוצע', E.table([('ממוצע', m)]))


if __name__ == '__main__':
    unittest.main()
