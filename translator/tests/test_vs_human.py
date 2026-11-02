"""tools/learn-vs-human.py v2 (02/11/2026, תוכנית איכות התרגום PR1 1.1) — בחירת הגרסה, נרמול, בלוקים, שלבים. נתונים סינתטיים בלבד."""
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location('lvh', ROOT / 'tools' / 'learn-vs-human.py')
V = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(V)


def xml(rows, mt=False):
    """rows = [(start|None, end|None, text)] → XML בצורה של OPUS"""
    def t(v):
        h, r = divmod(v, 3600)
        m, s = divmod(r, 60)
        return '%02d:%02d:%02d,%03d' % (h, m, int(s), round((s - int(s)) * 1000))
    out = []
    for i, (s, e, x) in enumerate(rows, 1):
        b = (f'<time id="T{i}S" value="{t(s)}" />' if s is not None else '') + x + (f'<time id="T{i}E" value="{t(e)}" />' if e is not None else '')
        out.append(f'<s id="{i}">{b}</s>')
    meta = '<meta><subtitle><machine_translated>%d</machine_translated></subtitle></meta>' % (1 if mt else 0)
    return '<document>' + ''.join(out) + meta + '</document>'


WORDS = ['בוקר טוב לכולם היום', 'אנחנו נוסעים לים הגדול', 'מי מביא את הכריכים', 'אני מביא את השתייה הקרה',
         'אל תשכחו את המגבות', 'השמש חזקה מאוד היום', 'נחזור לפני השקיעה', 'כולם מוכנים לצאת עכשיו']


def corpus_item(n=40):
    cu, fin = [], []
    for i in range(n):
        s, e = i * 3.0, i * 3.0 + 2.5
        h = WORDS[i % len(WORDS)] + ' %d' % i
        cu.append({'i': i + 1, 's': s, 'e': e, 'en': 'line', 'd': h})
        fin.append({'s': s, 'e': e, 'h': h})
    return {'id': 'x', 'fn': 'Show.S01E02.mp4', 'mode': 'haiku-medium', 'cu': cu, 'fin': fin}


class ParseOpus(unittest.TestCase):
    def test_interpolation(self):
        ref, mt, dens = V.parse_text(xml([(10, 11, 'אחת'), (None, None, 'שתיים'), (20, 21, 'שלוש')]))
        self.assertFalse(mt)
        self.assertAlmostEqual(dens, 2 / 3)
        self.assertTrue(10 < ref[1][0] < 20)             # האמצעי בין שני העוגנים, לפי מיקום התווים
        self.assertLessEqual(ref[1][1], 20)
        # M0 (02/11/2026): גם סוף ידוע הוא עוגן (כמו parse2 של המחקר), וסוף לא אחרי ההתחלה — שנייה
        ref, _mt, _d = V.parse_text(xml([(10, 11, 'אחת'), (None, 19, 'שתיים שלוש ארבע'), (20, 21, 'חמש')]))
        self.assertEqual(ref[1][1], 19)
        self.assertTrue(11 <= ref[1][0] < 19)
        self.assertEqual(V.parse_text(xml([(5, 5, 'אחת')]))[0][0][:2], [5, 6.0])


class Norm(unittest.TestCase):
    def test_pipes(self):
        self.assertEqual(V.cf('שלום|עולם', 'שלום עולם'), V.cf('שלום עולם', 'שלום עולם'))
        self.assertEqual(V.cf('שלום||עולם', 'שלום עולם'), V.cf('שלום עולם', 'שלום עולם'))
        self.assertEqual(V.vis_len('א|ב'), 3)


class Blocks(unittest.TestCase):
    def test_sentence_once(self):
        cues = [(0, 2), (2, 4), (10, 12)]
        R = [(0.5, 3.5, 'משפט ארוך אחד'), (10, 12, 'עוד')]
        BL = V.blocks(cues, R)
        self.assertEqual(sorted(BL), [([0, 1], [0]), ([2], [1])])
        refs = [r for _h, r in V.block_texts(BL, ['א', 'ב', 'ג'], R)]
        self.assertEqual(sum(len(r) for r in refs), len('משפט ארוך אחד') + len('עוד'))   # בלי ספירה כפולה


class PickVersion(unittest.TestCase):
    def test_broken_long_version_loses(self):
        c = [{'file': 'long.xml', 'anchors': 40, 'lr': 2.2, 'chrf': 60, 'cov': 0.9, 'drift': 1, 'end': 1},
             {'file': 'ok.xml', 'anchors': 90, 'lr': 1.0, 'chrf': 45, 'cov': 0.7, 'drift': 1, 'end': 1}]
        self.assertEqual(V.pick_version(c)['file'], 'ok.xml')
        self.assertEqual(max(c, key=lambda x: x['cov'])['file'], 'long.xml')       # הכלל הישן (כיסוי) היה בוחר את השבורה

    def test_same_edit_rule(self):
        c = [{'file': 'a.xml', 'anchors': 90, 'lr': 1.0, 'chrf': 50, 'drift': 60, 'end': 70},
             {'file': 'b.xml', 'anchors': 85, 'lr': 1.0, 'chrf': 49.3, 'drift': 2, 'end': 3}]
        self.assertEqual(V.pick_version(c, 'edit')['file'], 'b.xml')
        self.assertEqual(V.pick_version(c, 'd7')['file'], 'a.xml')
        self.assertEqual(V.pick_version(c, 'edit', fixed='a.xml')['file'], 'a.xml')   # refmap קפוא


class Stages(unittest.TestCase):
    def test_from_tx(self):
        c = {'i': 5, 'd': 'טיוטה', 'f': 'תיקון', 'r': 'צופה', 'z': 'בקרה'}
        fx = V.fix_files({'tr/fixes_review.txt': '#5 ביקורת\n', 'tr/fixes_rview.txt': '#5 צופה\n',
                          'tr/fixes_zfinal.txt': '#5 אחרון\n', 'tr/fixes_zqc.txt': '#5 בקרה\n', 'tr/other.txt': '#5 x'})
        t = V.stage_texts(c, fx)
        self.assertEqual((t['r'], t['v'], t['z0'], t['z']), ('ביקורת', 'צופה', 'אחרון', 'בקרה'))
        t0 = V.stage_texts(c)
        self.assertEqual((t0['v'], t0['z0']), (t0['r'], t0['z']))
        self.assertEqual([s[0] for s in V.STEPS], ['pick', 'fix', 'review', 'viewer', 'zfinal', 'qc'])
        self.assertEqual(list(V.FIX_ORDER), sorted(V.FIX_ORDER))                       # = sorted(glob) בבנייה


class EndToEnd(unittest.TestCase):
    def test_run_offline(self):
        o = corpus_item()
        o['cu'][3]['f'] = o['cu'][3]['d'].replace(' ', '|', 1)                           # שינוי של שבירת שורה בלבד
        o['cu'][5]['f'] = 'משהו אחר לגמרי'
        good = [(c['s'] + 0.2, c['e'] + 0.2, c['d']) for c in o['cu']]
        merged = [(good[i][0], good[i + 1][1], good[i][2] + ' ' + good[i + 1][2] + ' ' + good[i][2]) for i in range(0, len(good) - 1, 2)]
        with tempfile.TemporaryDirectory() as t:
            T = Path(t)
            d = T / 'opus' / 'he' / '777'
            d.mkdir(parents=True)
            (d / 'a_good.xml').write_text(xml(good), encoding='utf-8')
            (d / 'b_merged.xml').write_text(xml(merged), encoding='utf-8')
            (d / 'c_mt.xml').write_text(xml(good, mt=True), encoding='utf-8')
            (T / 'c.json').write_text(json.dumps([o, dict(corpus_item(), id='y', xf=['smf'])]), encoding='utf-8')
            (T / 'im.json').write_text(json.dumps({'S01E02': '777'}), encoding='utf-8')
            out = T / 'out'
            sc = V.main(['--corpus', str(T / 'c.json'), '--imdb-map', str(T / 'im.json'), '--opus-dir', str(T / 'opus'), '--out', str(out)])
            ep = sc['eps']['S01E02']
            self.assertEqual(json.loads((out / 'refmap.json').read_text())['S01E02']['ver'], 'a_good.xml')
            self.assertEqual(ep['dec']['fix'], {'worse': 1})                              # רק השינוי האמיתי נספר
            self.assertGreater(ep['chrf']['z'], 90)
            txt = (out / 'scores.json').read_text(encoding='utf-8')
            self.assertNotIn('בוקר', txt)                                                 # מספרים בלבד
            # ריצה שנייה עם refmap קפוא — אותה בחירה גם כשהמועמדים משתנים
            (d / 'a_good.xml').rename(d / 'z_good.xml')
            (d / 'a2.xml').write_text(xml(good), encoding='utf-8')
            json.dump({'S01E02': {'ver': 'z_good.xml'}}, open(T / 'rm.json', 'w'))
            sc2 = V.main(['--corpus', str(T / 'c.json'), '--imdb-map', str(T / 'im.json'), '--opus-dir', str(T / 'opus'), '--out', str(out), '--refmap', str(T / 'rm.json')])
            self.assertEqual(json.loads((out / 'refmap.json').read_text())['S01E02']['ver'], 'z_good.xml')
            self.assertEqual(len(sc2['eps']), 1)                                         # עבודת ניסוי (xf) לא בדוח הזה

    def test_out_inside_repo(self):
        with self.assertRaises(SystemExit):
            V.main(['--corpus', 'x.json', '--imdb-map', 'x', '--out', str(ROOT / 'tmp-out')])


if __name__ == '__main__':
    unittest.main()
