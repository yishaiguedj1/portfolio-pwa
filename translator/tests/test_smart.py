"""סבב 2 של השדרוג (01/11/2026): A9 ציון לכל שורה (notes), A6 משחקי מילים, A10 הצופה המדומה, A12 קטעים שאינם באנגלית."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import job as J  # noqa: E402
import pipeline as P  # noqa: E402
from vt import lang as L  # noqa: E402


def W(s, e, conf):
    return {'w': 'x', 's': s, 'e': e, 'conf': conf}


class Flags(unittest.TestCase):
    def test_codes_order_like_server(self):
        # הסדר לפי RVF_CODES (כמו normRvf בשרתון), לא לפי האלפבית
        self.assertEqual(J.review_flags('!#5 l\n!#5 p\n!#5 g\n!#2 v'), [[2, 'v'], [5, 'g'], [5, 'p'], [5, 'l']])
        self.assertEqual(J.RVF_CODES, ('g', 's', 't', 'p', 'v', 'l'))

    def test_pun_alternatives(self):
        txt = '#3 טקסט\n!#4 p ממש מעוגן | עומד על עוגן | לא זז מהמזח\n!#4 p כפול\n!#9 p\n!#7 g'
        self.assertEqual(J.review_puns(txt), {4: ['ממש מעוגן', 'עומד על עוגן', 'לא זז מהמזח']})
        self.assertEqual(J.review_flags(txt), [[4, 'p'], [7, 'g'], [9, 'p']])
        self.assertEqual(J.review_puns(txt, {7}), {})

    def test_word_after_code_is_not_a_code(self):
        self.assertEqual(J.review_flags('!#3 pun here'), [])     # "pun" ≠ הקוד p


class Viewer(unittest.TestCase):
    def test_lines(self):
        got = P.viewer_lines('#3 r מי זה הוא?\n#4 x לא קוד\n#9 m לא קיים\n#3 m כפול\n', {'3', '4'})
        self.assertEqual(got, {'3': ('r', 'מי זה הוא?')})


class Lang(unittest.TestCase):
    def test_candidates(self):
        words = [W(0, .5, .9), W(1, 1.4, .2), W(1.5, 2, .3), W(2.1, 2.6, .9), W(2.7, 3.4, .1), W(10, 10.5, .2)]
        self.assertEqual(L.candidates(words), [(0.7, 3.7)])   # רצף אחד (מילה בטוחה באמצע לא שוברת); הבודדת קצרה מדי

    def test_noise_everywhere_is_not_language(self):
        words = [W(i * 5, i * 5 + 2.5, .1) for i in range(L.MAX_SEG + 5)]
        self.assertEqual(L.candidates(words), [])

    def test_cue_map(self):
        cues = [{'id': 1, 'speech_s': 0, 'speech_e': 2}, {'id': 2, 'speech_s': 2.2, 'speech_e': 4}, {'id': 3, 'speech_s': 5, 'speech_e': 6}]
        seg = [{'s': 1.8, 'e': 4.5, 'lg': 'es', 'tx': 'hola'}]
        self.assertEqual(set(L.cue_map(seg, cues)), {2})


class Notes(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())
        (self.d / 'out').mkdir()
        (self.d / 'review').mkdir()
        (self.d / 'judge').mkdir()
        cues = [{'id': i, 'speech_s': i * 2.0, 'speech_e': i * 2.0 + 1.5, 'w0': i, 'w1': i} for i in range(1, 7)]
        (self.d / 'cues.en.json').write_text(json.dumps(cues), encoding='utf-8')
        (self.d / 'out' / 'cues.final.json').write_text(json.dumps([{'id': c['id']} for c in cues]), encoding='utf-8')
        words = [{'s': i * 2.0, 'e': i * 2.0 + 1, 'conf': .9} for i in range(7)]
        words[5]['conf'] = .2
        (self.d / 'en.words.json').write_text(json.dumps({'words': words}), encoding='utf-8')
        (self.d / 'judge' / 'verdict.txt').write_text('#1 5 ok\n#2 2 mean\n#3 3 flu\n#4 5 ok\n', encoding='utf-8')
        (self.d / 'review' / 'flags.txt').write_text('!#6 g\n', encoding='utf-8')
        (self.d / 'review' / 'puns.json').write_text(json.dumps({'4': ['א', 'ב']}), encoding='utf-8')
        (self.d / 'review' / 'viewer.json').write_text(json.dumps({'3': 'מי זה הוא?'}), encoding='utf-8')
        (self.d / 'foreign.json').write_text(json.dumps({'v': 1, 'seg': [{'s': 11.9, 'e': 13.6, 'lg': 'es', 'tx': 'hola amigo'}]}), encoding='utf-8')

    def test_notes(self):
        n = J.smart_notes(self.d)
        c = n['c']
        self.assertEqual(n['n'], 6)
        self.assertEqual(n['js'], 3.75)
        self.assertEqual(c['2']['lv'], 'l')
        self.assertEqual(c['2']['r'], ['jg:mean'])
        self.assertEqual(c['3']['lv'], 'l')                  # השופט 3 (לשקול) + הצופה לא הבין → לבדוק
        self.assertEqual(c['3']['x'], 'מי זה הוא?')
        self.assertEqual(c['4']['p'], ['א', 'ב'])
        self.assertEqual(c['5']['r'], ['asr'])
        self.assertEqual((c['6']['lg'], c['6']['o']), ('es', 'hola amigo'))
        self.assertIn('g', c['6']['r'])
        self.assertNotIn('1', c)
        self.assertEqual(set(J.NOTE_KEYS) >= {k for v in c.values() for k in v}, True)
        self.assertEqual(J.notes_flags(n), [[3, 'v'], [6, 'l']])

    def test_foreign_block(self):
        fb = P.foreign_block(self.d)
        self.assertIn('foreign_segments', fb)
        self.assertIn('#6 [es] hola amigo', fb)
        self.assertEqual(P.foreign_block(self.d, {'1'}), '')

    def test_no_cues_no_notes(self):
        self.assertIsNone(J.smart_notes(Path(tempfile.mkdtemp())))


class Judge(unittest.TestCase):
    def test_lines_all(self):
        self.assertEqual(J.judge_lines('#1 5 ok\n#2 2 mean\n#2 4 ok\n#3 9 ok\n#4 3 zzz'), {1: (5, 'ok'), 2: (2, 'mean')})


if __name__ == '__main__':
    unittest.main()
