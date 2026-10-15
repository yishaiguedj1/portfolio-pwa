"""14/10/2026: מאגר הלמידה — learn_facts אוסף מהפרויקט רק מספרים וקודים, בלי טקסט מהסרטון, בלי שמות ובלי נתיבים."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402

SECRET = 'SECRET-SPEECH-WORDS'


class LearnFacts(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        pd = Path(self.tmp.name) / 'my-private-video-name'
        (pd / 'out').mkdir(parents=True)
        (pd / 'tr').mkdir()
        (pd / 'project.json').write_text(json.dumps({'name': 'my-private-video-name', 'title': SECRET, 'source': '/home/x/' + SECRET + '.mp4',
            'stages': {'ingest': {'at': '2026-10-14 10:00:00', 'duration': 300.5},
                       'asr': {'at': 'x', 'engine': 'parakeet', 'words': 812},
                       'edit_import': {'at': 'x', 'equal': 780, 'replaced': 20, 'inserted': 7, 'deleted': 5},
                       'align': {'at': 'x', 'aligned': 800, 'suspicious': 9, 'kept_approx': 3, 'seconds': 41.2, 'engine': 'onnx-int8'},
                       'build': {'at': 'x', 'style': 'bold', 'errors': 0, 'warnings': 4}}}), encoding='utf-8')
        (pd / 'en.aligned.json').write_text(json.dumps({'stats': {'ctc': {'aligned': 790, 'seconds': 12.5}, 'consensus': {'moved_100ms': 14}}, 'words': []}))
        (pd / 'snb-timing.json').write_text(json.dumps({'env': {}, 'vt': [['asr', 1, 60.0, 'Main'], ['align', 2, 40.0, 'x'], ['align', 5, 10.0, 'x'], ['../bad cmd', 1, 3, 'x']]}))
        cues = [{'id': i, 'start': i * 3.0, 'end': i * 3.0 + 2.5, 'cps': 10 + i, 'chars': 30 + i, 'lines': [SECRET] * (1 + i % 2),
                 'flags': ['forced_min'] if i % 3 == 0 else [], 'he': SECRET, 'en': SECRET, 'merged': i == 2} for i in range(10)]
        (pd / 'out' / 'cues.final.json').write_text(json.dumps(cues), encoding='utf-8')
        (pd / 'en.words.json').write_text(json.dumps({'words': [{'w': SECRET, 'spk': 'S1'}] * 50 + [{'w': 'x', 'spk': 'S?'}] * 2}))
        (pd / 'tr' / 'batch_001.he.txt').write_text('#1 ' + SECRET, encoding='utf-8')
        (pd / 'tr' / 'fixes.txt').write_text('#3 ' + SECRET + '\n#4 ' + SECRET + '\n', encoding='utf-8')
        (pd / 'tr' / 'fixes_review.txt').write_text('#5 ' + SECRET + '\n', encoding='utf-8')
        (pd / 'tr' / 'glossary.tsv').write_text('# head\nA\tא\n' + job.GL_MARK + '\nB\tב\nC\tג\n', encoding='utf-8')
        self.ctx = SimpleNamespace(pdir=pd, st={'spec': {'dur': 300, 'name': SECRET + '.mp4'}, 'sync': {'off': 0.12, 'conf': 0.93},
                                                'eng_facts': {'cw': 1, 'rr': 0, 'tc': 2, 'mr': 1, 'fb': 3, 'th': {'tl': 9000, 'rv': 100}}})

    def tearDown(self):
        self.tmp.cleanup()

    def test_facts(self):
        lx = job.learn_facts(self.ctx)
        self.assertEqual(lx['ps']['ingest.duration'], 300.5)
        self.assertEqual(lx['ps']['edit_import.replaced'], 20)
        self.assertEqual(lx['ps']['align.ctc.aligned'], 790)
        self.assertEqual(lx['ps']['align.consensus.moved_100ms'], 14)
        self.assertNotIn('align.engine', lx['ps'])                  # מחרוזות לא נכנסות
        self.assertEqual(lx['vt'], [['asr', 1, 60.0, 60.0], ['align', 2, 50.0, 40.0]])   # מהארוכה לקצרה; פקודה לא תקינה נזרקת
        self.assertEqual(lx['cu']['n'], 10)
        self.assertEqual(lx['cu']['fl'], {'forced_min': 4})
        self.assertEqual(lx['cu']['mg'], 1)
        self.assertAlmostEqual(lx['cu']['l2'], 0.5)
        self.assertEqual(lx['wd']['n'], 52)
        self.assertEqual(lx['wd']['spk'], 1)
        self.assertEqual(lx['wd']['unk'], 2)
        self.assertEqual(lx['tl'], {'pt': 1, 'fx': 2, 'fr': 1, 'fz': 0, 'ntl': 2})
        self.assertEqual(lx['gl'], {'n': 3, 'u': 2})
        self.assertEqual(lx['en']['tc'], 2)
        self.assertEqual(lx['en']['th'], {'tl': 9000, 'rv': 100})
        self.assertEqual(lx['sy'], {'c': 0.93, 'o': 0.12})

    def test_privacy(self):
        txt = json.dumps(job.learn_facts(self.ctx), ensure_ascii=False)
        self.assertNotIn(SECRET, txt)
        self.assertNotIn('my-private-video-name', txt)
        self.assertNotIn('/home', txt)

    def test_empty_project(self):
        ctx = SimpleNamespace(pdir=Path(self.tmp.name) / 'missing', st={})
        lx = job.learn_facts(ctx)
        self.assertEqual(lx['v'], 1)
        self.assertNotIn('cu', lx)
        self.assertIsNone(job.learn_safe(SimpleNamespace(pdir=None, st=None)) and None)


if __name__ == '__main__':
    unittest.main()
