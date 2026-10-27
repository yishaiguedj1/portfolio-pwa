"""27/10/2026 — מאגר הלמידה, סבב 2 (בקשת המשתמש): זמן מעבד לכל פקודת vt, סוג התוכן מחושב בקוד, ומדידות "הכל בטלפון"
(זמן, סוללה וחום לכל שלב). רק מספרים. בלי רשת ובלי vt אמיתי."""
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


def words(spk_seq, dur=1.0):
    """רצף דוברים → מילים צמודות של dur שניות"""
    return [{'w': 'x', 's': i * dur, 'e': i * dur + dur * 0.9, 'spk': k} for i, k in enumerate(spk_seq)]


class ContentType(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.pd = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def kind(self, ws, au=None, dur=600):
        r = job.content_type(self.pd, ws, au, dur)
        return job.CT_KINDS[r['k']], r

    def test_kinds(self):
        self.assertEqual(self.kind(words(['S1'] * 500))[0], 'talk')
        self.assertEqual(self.kind(words(['S1'] * 95 + ['S2'] * 5))[0], 'talk', 'שאלה מהקהל — עדיין הרצאה')
        self.assertEqual(self.kind(words((['S1'] * 10 + ['S2'] * 10) * 20))[0], 'interview')
        self.assertEqual(self.kind(words(['S1', 'S2', 'S3'] * 100))[0], 'panel')
        self.assertEqual(self.kind(words(['S1'] * 500), {'sp': 0.2})[0], 'quiet')
        (self.pd / 'shots.json').write_text(json.dumps({'threshold': 10, 'shots': [{'t': i} for i in range(100)]}))
        k, r = self.kind(words(['S1', 'S2', 'S3'] * 100))
        self.assertEqual((k, r['shm']), ('show', 10.0))

    def test_values(self):
        (self.pd / 'burned.json').write_text(json.dumps({'n': 200, 'frames': [[i, []] for i in range(50)]}))
        _, r = self.kind(words(['S1', 'S1', 'S2', 'S?', 'S2']), {'sp': 0.8}, 60)
        self.assertEqual(r['spk'], 2, 'S? לא נספר כדובר')
        self.assertEqual(r['swm'], 1.0, 'החלפה אחת בדקה (S? לא שובר רצף)')
        self.assertEqual(r['ot'], 0.25)
        self.assertEqual(r['sp'], 0.8)
        self.assertNotIn('shm', r, 'בלי shots.json — לא ממציאים')

    def test_empty(self):
        self.assertIsNone(job.content_type(self.pd, [], None, 60))
        self.assertIsNone(job.content_type(self.pd, [{'w': 'a'}], None, 60))

    def test_kinds_match_server(self):
        js = (ROOT / 'ibkr-proxy' / 'lib' / 'studiolearn.js').read_text(encoding='utf-8')
        self.assertIn("const CT_KINDS = ['" + "', '".join(job.CT_KINDS) + "'];", js)


class PhoneTel(unittest.TestCase):
    def test_clean(self):
        t = {'v': 1, 'st': {'asr': {'t': 312.44, 'n': 2, 'b0': 80, 'b1': 71, 'c0': 31.2, 'c1': 39.8, 'ch': 0, 'th': 2, 'evil': 5},
                            'hack': {'t': 1}, 'align': {'t': -3, 'b1': 'x', 'ch': True}},
             'dev': {'cores': 8, 'mem': 12, 'sdk': 35, 'model': 'SM-X'}}
        out = job.pw_tel(t)
        self.assertEqual(out['asr.t'], 312.4)
        self.assertEqual(out['asr.th'], 2)
        self.assertEqual(out['dev.cores'], 8)
        self.assertFalse(any(k.startswith('hack') or k.endswith('evil') or 'model' in k for k in out))
        self.assertFalse(any(k.startswith('align') for k in out), 'ערך שלילי / טקסט / bool — בחוץ')
        self.assertEqual(job.pw_tel({'v': 2, 'st': {}}), {})
        self.assertEqual(job.pw_tel('x'), {})

    def test_pw_check_keeps_tel(self):
        d = {'v': 1, 'words': [{'w': 'hi', 's': 0.1, 'e': 0.4}], 'tel': {'v': 1, 'st': {'wav': {'t': 4.2}}}}
        self.assertEqual(job.pw_check(d)['tel'], {'wav.t': 4.2})
        d['tel'] = 'garbage'
        self.assertNotIn('tel', job.pw_check(d), 'tel לא תקין לא מפיל את קובץ המילים')

    def test_keys_match_phone(self):
        kt = (ROOT / 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhTel.kt').read_text(encoding='utf-8')
        for k in job.PW_TEL_KEYS:
            self.assertIn('"' + k + '"', kt, k)
        for k in job.PW_TEL_DEV:
            self.assertIn('"' + k + '"', kt, k)
        pl = (ROOT / 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhLocal.kt').read_text(encoding='utf-8')
        self.assertEqual(set(re.findall(r'stepT\("([a-z]+)"', pl)), set(job.PW_TEL_STAGES))


class Facts(unittest.TestCase):
    def test_learn_facts(self):
        with tempfile.TemporaryDirectory() as d:
            pd = Path(d)
            (pd / 'asr').mkdir()
            (pd / 'asr' / 'parakeet.json').write_text(json.dumps({'audio': {'sp': 0.9}, 'tel': {'asr.t': 300.0, 'dev.cores': 8, 'bad key': 1}}))
            (pd / 'en.words.json').write_text(json.dumps({'words': words(['S1', 'S2'] * 50)}))
            (pd / 'snb-timing.json').write_text(json.dumps({'vt': [['align', 0, 120.0, 'T', 900, 1, 118.5], ['align', 0, 60.0, 'T', 900, 1, 60.2],
                                                                     ['ingest', 0, 10.0, 'T', 100, 1], ['render', 0, 50.0, 'T', 100, 1, None]]}))
            out = job.learn_facts(SimpleNamespace(pdir=pd, st={'spec': {'dur': 120}}))
            vt = {x[0]: x for x in out['vt']}
            self.assertEqual(vt['align'], ['align', 2, 180.0, 120.0, 178.7], 'זמן מעבד מצטבר')
            self.assertEqual(len(vt['ingest']), 4, 'בלי מדידת מעבד — בלי העמודה')
            self.assertEqual(len(vt['render']), 4)
            self.assertEqual(out['ph'], {'asr.t': 300.0, 'dev.cores': 8})
            self.assertEqual(job.CT_KINDS[out['ct']['k']], 'interview')

    def test_note_timing_cpu(self):
        with tempfile.TemporaryDirectory() as d:
            ctx = SimpleNamespace(pdir=Path(d))
            job.note_timing(ctx, 'asr', 0, 10, 500, 37.25)
            job.note_timing(ctx, 'plan', 0, 1, 10)
            rows = json.loads((Path(d) / 'snb-timing.json').read_text())['vt']
            self.assertEqual(rows[0][6], 37.2)
            self.assertIsNone(rows[1][6])


if __name__ == '__main__':
    unittest.main()
