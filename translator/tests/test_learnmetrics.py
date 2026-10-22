"""מאגר הלמידה מ׳5 (20/10/2026): המדדים בקוד — זהים לכלים הפתוחים, ורק מספרים יוצאים.
הערכים הקבועים חושבו ב־sacrebleu 2.6.0 (TER(), CHRF(word_order=2), ‏corpus_score) וב־apptek/SubER (calculate_SubER) —
הכלים לא מותקנים ב־CI, לכן הם כאן. השוואה אקראית ל־1,200 מקרים נוספים נעשתה מולם ב־20/10/2026 (0 הבדלים)."""
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402
import learnmetrics as L  # noqa: E402

VEC = json.loads('{"ter": [[["הוא הלך הביתה מהר.", "אני אוהב את Apple"], ["הוא חזר הביתה מהר", "אני אוהב את אפל"], 37.5, 58.97305407757455], [["the cat sat on the mat", "a b c d e f"], ["the mat sat on the cat", "f e d c b a"], 58.333333333333336, 74.01515666995545], [["ג׳ובס אמר: \\"תישארו רעבים\\".", "לא", "זה היה ב־2005, בסטנפורד."], ["ג׳ובס אמר \\"הישארו רעבים\\"", "לא.", "זה היה בסטנפורד ב־2005."], 66.66666666666666, 63.84298043663335], [["", " x "], ["שלום", "x"], 50.0, 40.229885057471265]], "suber": [[[[0, 2, ["שלום לכולם", "ברוכים הבאים"]], [2.5, 4, ["היום נדבר על AI"]]], [[0, 2, ["שלום לכולם ברוכים", "הבאים"]], [2.5, 4, ["היום נדבר על AI."]]], 9.091], [[[0, 1, ["a b c"]], [1, 2, ["d e f"]]], [[0, 1, ["a b"]], [1, 2, ["c d e f"]]], 25.0], [[[0, 1, ["a b c"]]], [[5, 6, ["a b c"]]], 200.0], [[[0, 3, ["הוא אמר שזה עובד", "כמו שצריך"]], [3.04, 5, ["ואז הכל השתנה"]]], [[0, 2.9, ["הוא אמר", "שזה עובד כמו שצריך"]], [3.04, 5.2, ["ואז", "הכל השתנה"]]], 15.385], [[], [[0, 1, ["x y"]]], 100.0]]}')


def row(i, en, d, **kw):
    return dict({'i': i, 's': i * 2.0, 'e': i * 2 + 1.5, 'k': 'S1', 'en': en, 'd': d}, **kw)


class Reference(unittest.TestCase):
    def test_ter_chrf(self):
        for h, r, ter, chrf in VEC['ter']:
            self.assertAlmostEqual(L.ter_corpus(h, r), ter, places=9)
            self.assertAlmostEqual(L.chrf_corpus(h, r), chrf, places=9)

    def test_suber(self):
        for h, r, want in VEC['suber']:
            self.assertAlmostEqual(L.suber(h, r), want, places=9)

    def test_identical(self):
        subs = [(0, 1, ['שלום', 'עולם']), (1.5, 3, ['מה נשמע'])]
        self.assertEqual(L.suber_counts(subs, subs), (0, 7))     # 4 מילים + שבירת שורה + 2 סופי כתובית
        self.assertEqual(L.suber([], []), 0.0)


class JobMetrics(unittest.TestCase):
    def test_stages(self):
        cu = [row(1, 'one two', 'אחת שתיים'), row(2, 'three', 'שלוש', f='שלושה'), row(3, 'four', 'ארבע', f='ארבעה', r='ארבע', z='ארבע.')]
        st = L.job_metrics({'cu': cu})['st']
        self.assertEqual(st['n'], 3)
        self.assertEqual((st['df.ch'], st['fr.ch'], st['rz.ch'], st['dz.ch']), (2, 1, 1, 2))
        self.assertAlmostEqual(st['df.t'], 50.0)                  # 2 החלפות מתוך 4 מילים בייחוס
        self.assertAlmostEqual(st['df.c'], round(L.chrf_corpus(['אחת שתיים', 'שלוש', 'ארבע'], ['אחת שתיים', 'שלושה', 'ארבעה']), 2))
        self.assertEqual(st['rz.t'], 25.0)                        # "ארבע" ← "ארבע." — מילה אחת (TER לא מסיר פיסוק)

    def test_timing_and_shots(self):
        fin = [{'s': 1.0, 'e': 3.0, 'h': 'x'}, {'s': 3.5, 'e': 4.5, 'h': 'y'}, {'s': 10, 'e': 12, 'h': 'z'}]
        wd = [['a', 0.7, 1.4], ['b', 1.5, 2.0], ['c', 2.2, 3.7], ['d', 3.8, 4.2]]
        tm = L.timing_metrics(fin, wd, shots=[1.2, 30.0], fps=25)
        self.assertEqual((tm['n'], tm['nw']), (3, 1))            # בכתובית השלישית אין דיבור
        self.assertEqual(tm['late'], 1)                           # הראשונה עולה 0.3 שנ׳ אחרי שהמילה a התחילה
        self.assertEqual(tm['cut'], 1)                            # והיא יורדת כש־c נאמרת עוד 0.7 שנ׳ (השנייה עולה מוקדם — תקין)
        self.assertEqual((tm['sh.near'], tm['sh.bad']), (1, 1))  # 1.0 — חמישה פריימים לפני השוט ב־1.2
        # 21/10/2026: יציאה 2 פריימים לפני חילוף = ההיצמדות של vt — "קרוב" אבל לא "רע"; כניסה 2 פריימים לפניו — רעה
        tm2 = L.timing_metrics([{'s': 0.0, 'e': 1.12}], wd, shots=[1.2, 30.0], fps=25)
        self.assertEqual((tm2['sh.near'], tm2['sh.bad']), (1, 0))
        tm3 = L.timing_metrics([{'s': 1.12, 'e': 2.5}], [[ 'x', 1.2, 2.4]], shots=[1.2, 30.0], fps=25)
        self.assertEqual((tm3['sh.near'], tm3['sh.bad']), (1, 1))

    def test_consistency(self):
        cu = [row(1, 'Then Michael said', 'ואז מייקל אמר'), row(2, 'and Michael left', 'ומייקל הלך'), row(3, 'I told Michael', 'אמרתי למיקל'),
              row(4, 'the Fed raised', 'הפד העלה'), row(5, 'the Fed cut', 'הבנק המרכזי הוריד')]
        cs = L.job_metrics({'cu': cu, 'gl': ['Fed\tהפד/הבנק המרכזי', 'Berkshire\tברקשייר']})['cs']
        self.assertEqual((cs['nm.n'], cs['nm.var']), (1, 1))      # מייקל / מיקל
        self.assertEqual((cs['gl.n'], cs['gl.miss'], cs['gl.mix']), (2, 0, 1))

    def test_glossary_prefixes_and_neighbors(self):
        """21/10/2026: "הפד" נשמר גם ב"בפד"/"ולפד", ומונח שעבר לכתובית השכנה — לא נחשבים פספוס"""
        cu = [row(1, 'at the Fed meeting', 'בפגישה בפד'), row(2, 'and the Fed', 'וכך'), row(3, 'said that', 'אמר שהפד מסכים'),
              row(4, 'the Fed again', 'הבנק שוב')]
        cs = L.job_metrics({'cu': cu, 'gl': ['Fed\tהפד']})['cs']
        self.assertEqual((cs['gl.n'], cs['gl.miss']), (3, 0))

    def test_omissions(self):
        cu = [row(1, 'we sold 1,000 shares in 2020', 'מכרנו 1000 מניות ב־2021'), row(2, 'this is a long sentence with many words', ''),
              row(3, 'this is a long sentence with many words in it', 'כן'), row(4, 'the 1990s were good', 'שנות ה־90 היו טובות')]
        om = L.job_metrics({'cu': cu})['om']
        self.assertEqual((om['om.e'], om['om.s']), (1, 1))
        self.assertEqual((om['num.n'], om['num.miss']), (2, 1))   # 2020 נעלם; 1990s לא נבדק

    def test_numbers_hebrew_forms(self):
        """21/10/2026: מספר קטן כמילה, "X אלף", ומספר שעבר לכתובית השכנה — לא נחשבים כנעלמים"""
        cu = [row(1, 'we have 3 kids and', 'יש לנו שלושה ילדים'), row(2, 'raised 100,000 dollars', 'גייסנו 100 אלף דולר'),
              row(3, 'in the year', 'בשנת 2019'), row(4, 'twenty 2019 was hard', 'הייתה שנה קשה'),
              row(5, 'and 250 people', 'ומאה אנשים')]
        om = L.job_metrics({'cu': cu})['om']
        self.assertEqual((om['num.n'], om['num.miss']), (4, 1))   # רק 250 → "מאה" באמת שגוי

    def test_numbers_only(self):
        cu = [row(1, 'Secret words here', 'מילים סודיות כאן', f='מילים סודיות')]
        txt = json.dumps(L.job_metrics({'cu': cu, 'fin': [{'s': 2, 'e': 3, 'h': 'מילים'}], 'wd': [['Secret', 2.0, 2.4]]}), ensure_ascii=False)
        self.assertIsNone(re.search('[\u05d0-\u05ea]|Secret|words', txt))
        for g, x in json.loads(txt).items():
            if g != 'v':
                for k, v in x.items():
                    self.assertTrue(re.match(r'^[a-z][a-z0-9_.]{0,47}$', k) and isinstance(v, (int, float)), (g, k, v))


class InFacts(unittest.TestCase):
    def test_learn_facts_has_mx(self):
        with tempfile.TemporaryDirectory() as t:
            pd = Path(t) / 'p'
            (pd / 'out').mkdir(parents=True)
            (pd / 'tr').mkdir()
            (pd / 'cues.en.json').write_text(json.dumps([{'id': 1, 'speech_s': 0.5, 'speech_e': 2, 'spk': 'S1', 'en': 'hello world'}]), encoding='utf-8')
            (pd / 'tr' / 'batch_001.he.txt').write_text('#1 שלום עולם\n', encoding='utf-8')
            (pd / 'tr' / 'fixes.txt').write_text('#1 שלום לעולם\n', encoding='utf-8')
            (pd / 'out' / 'cues.final.json').write_text(json.dumps([{'id': 1, 'start': 0.4, 'end': 2.1, 'lines': ['שלום לעולם']}]), encoding='utf-8')
            (pd / 'en.aligned.json').write_text(json.dumps({'words': [{'w': 'hello', 's': 0.5, 'e': 0.9}, {'w': 'world', 's': 1.0, 'e': 1.6}]}))
            (pd / 'shots.json').write_text(json.dumps({'shots': [{'t': 0.44}]}))
            (pd / 'media.json').write_text(json.dumps({'video': {'fps_float': 25.0}}))
            mx = job.learn_facts(SimpleNamespace(pdir=pd, st={'spec': {}}))['mx']
            self.assertEqual(mx['st']['df.ch'], 1)
            self.assertEqual(mx['tm']['sh.bad'], 1)
            self.assertNotIn('שלום', json.dumps(mx, ensure_ascii=False))

    def test_never_raises(self):
        self.assertIsNone(job.learn_metrics(SimpleNamespace(pdir=None, st=None)))


if __name__ == '__main__':
    unittest.main()
