"""tools/quality-bench.py (02/11/2026, תוכנית איכות התרגום PR1 1.4–1.7, 1.11). מנוע מדומה, נתונים סינתטיים ושמות בדויים בלבד."""
import csv
import importlib.util
import json
import re
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location('qb', ROOT / 'tools' / 'quality-bench.py')
Q = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(Q)


def item(id_='a', n=12, alt=False, **kw):
    cu, fin = [], []
    for i in range(n):
        s, e = i * 3.0, i * 3.0 + 2.5
        d = f'שורה מספר {i}'
        c = {'i': i + 1, 's': s, 'e': e, 'k': 'S1', 'en': f'I mean line {i}' if i == 0 else f'line {i}', 'd': d}
        if i == 2:
            c['f'] = d + ' מתוקנת'
        cu.append(c)
        fin.append({'s': s, 'e': e, 'h': (d + ' אחרת') if alt and i % 3 == 0 else (c.get('f') or d)})
    o = {'id': id_, 'fn': 'Fake.Show.S01E03.mp4', 'mode': 'haiku-medium', 'cu': cu, 'fin': fin,
         'sp': {'S1': {'n': 'דמות־בדויה', 'g': 'f'}}, 'wd': [['w', c['s'] + 0.1, c['s'] + 0.3] for c in cu]}
    o.update(kw)
    return o


class FakeEngine:
    def __init__(self, reply):
        self.reply, self.calls = reply, []
        self.ledger = SimpleNamespace(total=lambda: 0.0)

    def complete(self, k, sysp, req, max_tokens=0):
        self.calls.append(req)
        return SimpleNamespace(text=self.reply(req))


class Base(unittest.TestCase):
    def setUp(self):
        self.t = tempfile.TemporaryDirectory()
        self.T = Path(self.t.name)

    def tearDown(self):
        self.t.cleanup()

    def dump(self, name, data):
        p = self.T / name
        p.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        return str(p)


class Guards(Base):
    def test_out_in_repo(self):
        with self.assertRaises(SystemExit):
            Q.main(['count', '--corpus', 'x.json', '--out', str(ROOT / 'tmp-q')])

    def test_api_needs_yes(self):
        c = self.dump('c.json', [item()])
        Q.main(['prep', '--corpus', c, '--out', str(self.T / 'o')])
        with self.assertRaises(SystemExit):
            Q.main(['run', '--task', 'expert', '--in', str(self.T / 'o'), '--transport', 'api'])

    def test_templates_generic(self):
        for f in ('EXPERT.md', 'PAIRS.md'):
            t = (Q.QDIR / f).read_text(encoding='utf-8')
            self.assertNotRegex(t, r'S\d\dE\d\d')
        self.assertIn('{{CHARACTERS}}', (Q.QDIR / 'EXPERT.md').read_text(encoding='utf-8'))


class Expert(Base):
    def test_prep_run_score(self):
        c = self.dump('c.json', [item()])
        d = self.T / 'o'
        Q.main(['prep', '--corpus', c, '--out', str(d), '--genre', 'sitcom'])
        rub = (d / 'expert' / 'S01E03.RUBRIC.md').read_text(encoding='utf-8')
        self.assertIn('דמות־בדויה · נקבה', rub)                # הדמויות מטבלת הדוברים, בזמן ריצה
        self.assertIn('sitcom', rub)
        md = (d / 'expert' / 'S01E03.md').read_text(encoding='utf-8')
        self.assertIn('#3 [00:06.00–00:08.50]', md)             # זמני fin
        self.assertIn('HIST:', md)
        man = json.loads((d / 'manifest.json').read_text())
        self.assertEqual(man['model'], 'claude-opus-5-5')
        self.assertEqual(len(man['tpl']), 16)

        def reply(req):
            return '\n'.join(['{"i": 3, "cat": "gen", "sev": "maj", "stage": "fix"}', '{"i": 4, "cat": "fmt", "sev": "min"}',
                              '{"i": 99, "cat": "gen", "sev": "maj"}', '{"i": 5, "cat": "nope", "sev": "maj"}', 'טקסט חופשי'])
        eng = FakeEngine(reply)
        a = Q.build_parser().parse_args(['run', '--task', 'expert', '--in', str(d)])
        Q.cmd_run(a, eng)
        Q.cmd_run(a, eng)                                       # המשך — לא קורא שוב
        self.assertEqual(len(eng.calls), 1)
        sc = Q.main(['score', '--in', str(d)])['expert']['eps']['S01E03']
        self.assertEqual(sc['issues'], round(2 * 100 / 12, 2))  # השורה הלא חוקית נזרקה
        self.assertEqual(sc['mqm'], round(6 * 100 / 12, 2))
        self.assertEqual(sc['mqm_content'], round(5 * 100 / 12, 2))
        self.assertEqual(sc['majcrit'], round(100 / 12, 2))


    def test_cap_stops(self):
        c = self.dump('c.json', [item('a'), item('b', fn='Fake.Show.S01E04.mp4')])
        d = self.T / 'o'
        Q.main(['prep', '--corpus', c, '--out', str(d)])

        class Capped(FakeEngine):
            def complete(self, *a, **k):
                if self.calls:
                    raise type('LLMError', (Exception,), {'code': 'cap'})()
                return super().complete(*a, **k)
        eng = Capped(lambda req: '{"i": 1, "cat": "gen", "sev": "min"}')
        rc = Q.cmd_run(Q.build_parser().parse_args(['run', '--task', 'expert', '--in', str(d)]), eng)
        self.assertEqual(rc, 1)
        self.assertEqual(len(list((d / 'raw' / 'expert').glob('*.txt'))), 1)   # מה שנשמר — נשמר; ההמשך יחדש מכאן


class Pairs(Base):
    def test_ab_both_orders_and_score(self):
        A, B = item('a'), item('b', alt=True)
        ca, cb = self.dump('a.json', [A]), self.dump('b.json', [B])
        d = self.T / 'p'
        Q.main(['pairs', '--mode', 'ab', '--a', ca, '--b', cb, '--out', str(d), '--both-orders'])
        key = json.loads((d / 'key' / 'pairs.json').read_text())
        self.assertEqual(len(key), 8)                            # 4 כתוביות שונות × שני סדרים
        self.assertFalse(list((d / 'pairs').glob('*.json')))     # המפתח לא בתיקייה שהמודל קורא
        self.assertEqual(sum(v['xb'] for k, v in key.items() if v['n'] == 0), 1)   # הסדר ההפוך — X/Y מתחלפים
        # דטרמיניסטי לפי seed
        d2 = self.T / 'p2'
        Q.main(['pairs', '--mode', 'ab', '--a', ca, '--b', cb, '--out', str(d2), '--both-orders'])
        self.assertEqual(key, json.loads((d2 / 'key' / 'pairs.json').read_text()))

        def reply(req):   # שופט שתמיד בוחר ב־B (הנוסח החדש), לפי המפתח
            out = []
            for pid in re.findall(r'^§(p\d{4}[ab])$', req, re.M):
                out.append(json.dumps({'p': pid, 'w': 'X' if key[pid]['xb'] else 'Y', 'why': 'mean'}))
            return '\n'.join(out)
        Q.cmd_run(Q.build_parser().parse_args(['run', '--task', 'pairs', '--in', str(d)]), FakeEngine(reply))
        pr = Q.main(['score', '--in', str(d)])['pairs']
        self.assertEqual((pr['b'], pr['a'], pr['t']), (8, 0, 0))
        self.assertEqual(pr['agree'], 1.0)
        self.assertGreater(pr['lo'], 0.5)

    def test_stages(self):
        ps = Q.stage_pairs(item())
        self.assertEqual([(p['k'], p['i']) for p in ps], [('fix', 3)])


class Stats(unittest.TestCase):
    def test_wilson_sign(self):
        p, lo, hi = Q.wilson(177, 260)
        self.assertAlmostEqual(p, 0.6808, places=3)
        self.assertAlmostEqual(lo, 0.622, places=2)
        self.assertAlmostEqual(hi, 0.734, places=2)
        self.assertEqual(Q.wilson(0, 0), (None, None, None))
        self.assertLess(Q.sign_p(177, 83), 0.001)
        self.assertEqual(Q.sign_p(5, 5), 1.0)

    def test_decide(self):
        base = {'expert': {'avg': {'cat': {'gen': 3.0, 'mean': 2.0}}}}
        good = {'pairs': {'lo': 0.55}, 'expert': {'avg': {'cat': {'gen': 2.0, 'mean': 2.2}}}}
        self.assertTrue(Q.decide(base, good)['on'])
        bad = {'pairs': {'lo': 0.55}, 'expert': {'avg': {'cat': {'gen': 3.0, 'mean': 2.8}}}}
        self.assertEqual(Q.decide(base, bad)['reg'], {'mean': 0.8})
        self.assertFalse(Q.decide(base, bad, noise=0.5)['reg'])     # בתוך פעמיים רצפת הרעש
        self.assertFalse(Q.decide(base, {'pairs': {'lo': 0.49}})['on'])
        self.assertFalse(Q.decide(base, good, cost=0.2)['on'])


class Counters(unittest.TestCase):
    def test_counters(self):
        o = item()
        o['fin'][1]['e'] = o['fin'][2]['s'] + 0.5               # חפיפה
        o['fin'][4]['e'] = o['fin'][4]['s'] + 0.5               # קצרה
        o['wd'] = [w for w in o['wd'] if w[1] > 10]             # כתוביות מוקדמות (המילה הראשונה אחרי 10 שנ׳)
        o['cu'][0]['f'] = 'כלומר, שורה'
        r = Q.counters(o)
        self.assertEqual(r['overlap'], 1)
        self.assertEqual(r['short'], 1)
        self.assertGreaterEqual(r['early3'], 2)
        self.assertEqual(r['reg']['כלומר'], {'en': 1, 'he': 1, 'extra': 0})

    def test_zfinal_revert(self):
        o = item(n=3)
        o['cu'][1].update({'f': 'שונה', 'r': 'שונה', 'z': o['cu'][1]['d']})
        self.assertEqual(Q.counters(o)['zrevert'], 1)


class Esa(Base):
    def test_roundtrip(self):
        ca, cb = self.dump('a.json', [item('a')]), self.dump('b.json', [item('b', alt=True)])
        d = self.T / 'e'
        Q.main(['esa', '--a', ca, '--b', cb, '--out', str(d), '--n', '40'])
        rows = list(csv.reader(open(d / 'esa.csv', encoding='utf-8')))
        key = json.loads((d / 'key' / 'esa.json').read_text())
        self.assertEqual(len(rows) - 1, 4)
        for r in rows[1:]:                                       # המשתמש נותן לנוסח החדש (B) 90, לישן 60
            b_first = key[r[0]]['xb']
            r[4], r[7] = ('90', '60') if b_first else ('60', '90')
        with open(d / 'filled.csv', 'w', encoding='utf-8', newline='') as f:
            csv.writer(f).writerows(rows)
        res = Q.main(['esa-read', '--in', str(d), '--sheet', str(d / 'filled.csv')])
        self.assertEqual((res['a'], res['b'], res['win']), (60.0, 90.0, {'b': 4}))


if __name__ == '__main__':
    unittest.main()
