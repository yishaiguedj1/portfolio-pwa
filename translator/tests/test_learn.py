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


class LearnCorpus(unittest.TestCase):
    """15/10/2026 (מ׳2): הקורפוס — רשומה לכל כתובית לכל שלב, זמני המילים; בלי שם הסרטון, שם הקובץ, שמות דוברים ונתיבים"""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        pd = Path(self.tmp.name) / 'my-private-video-name'
        (pd / 'out').mkdir(parents=True)
        (pd / 'tr').mkdir()
        (pd / 'cues.en.json').write_text(json.dumps([{'id': i, 'speech_s': i * 2.0, 'speech_e': i * 2 + 1.5, 'spk': 'S1' if i < 4 else 'Dana', 'en': 'line %d' % i}
                                                     for i in range(1, 5)]), encoding='utf-8')
        (pd / 'tr' / 'batch_001.he.txt').write_text('#1 אחת\n#2 שתיים\n#3 שלוש\n#4 ארבע\n', encoding='utf-8')
        (pd / 'tr' / 'fixes.txt').write_text('#2 שתיים!\n', encoding='utf-8')
        (pd / 'tr' / 'fixes_review.txt').write_text('#3 שָלוש\n', encoding='utf-8')
        (pd / 'tr' / 'fixes_zfinal.txt').write_text('#2 שתיים.\n', encoding='utf-8')
        (pd / 'tr' / 'glossary.tsv').write_text('# head\nBerkshire\tברקשייר\n', encoding='utf-8')
        (pd / 'out' / 'cues.final.json').write_text(json.dumps([{'id': 1, 'start': 2.0, 'end': 3.5, 'lines': ['אחת'], 'he': 'אחת'}]), encoding='utf-8')
        (pd / 'en.aligned.json').write_text(json.dumps({'words': [{'w': 'line', 's': 2.0, 'e': 2.3, 'spk': 'S1', 's_asr': 1.9, 's_qwen': 2.0, 's_ctc': 2.02, 'align': 'qwen3'}]}))
        (pd / 'en.patch.applied.0.txt').write_text('# x\nbufet => Buffett\n', encoding='utf-8')
        self.ctx = SimpleNamespace(pdir=pd, st={'spec': {'dur': 300, 'name': SECRET + '.mp4', 'mode': 'sonnet-medium', 'from': 'en', 'to': ['he']}})

    def tearDown(self):
        self.tmp.cleanup()

    def test_stages(self):
        c = job.learn_corpus(self.ctx)
        self.assertEqual(c['v'], job.LC_V)
        cu = {x['i']: x for x in c['cu']}
        self.assertEqual(cu[1], {'i': 1, 's': 2.0, 'e': 3.5, 'k': 'S1', 'en': 'line 1', 'd': 'אחת'})   # בלי שינויים — רק המקור והטיוטה
        self.assertEqual(cu[4]['k'], 'S?')                                  # שם דובר → S?
        self.assertEqual((cu[2]['f'], cu[2]['z']), ('שתיים!', 'שתיים.'))
        self.assertNotIn('r', cu[2])
        self.assertEqual(cu[3]['r'], 'שָלוש')
        self.assertEqual(c['fin'], [{'s': 2.0, 'e': 3.5, 'h': 'אחת'}])
        self.assertEqual(c['wd'], [['line', 2.0, 2.3, 'S1', 1.9, 2.0, 2.02, 'qwen3']])
        self.assertEqual(c['pt'], ['bufet => Buffett'])
        self.assertEqual(c['gl'], ['Berkshire\tברקשייר'])
        self.assertEqual((c['mode'], c['src'], c['dst'], c['dur']), ('sonnet-medium', 'en', 'he', 300))

    def test_privacy(self):
        txt = json.dumps(job.learn_corpus(self.ctx), ensure_ascii=False)
        for bad in (SECRET, 'my-private-video-name', '/tmp', 'Dana'):
            self.assertNotIn(bad, txt)

    def test_put(self):
        import base64
        import gzip
        sent = {}

        class C:
            def raw(self, op, **kw):
                sent[op] = kw
                return {'ok': True, 'saved': True}
        self.ctx.c = C()
        self.assertTrue(job.learn_put(self.ctx))
        body = json.loads(gzip.decompress(base64.b64decode(sent['learnPut']['lc'])))
        self.assertEqual(len(body['cu']), 4)

    def test_put_never_raises(self):
        class C:
            def raw(self, op, **kw):
                raise SystemExit('✗ השרתון לא עונה')
        self.ctx.c = C()
        self.assertFalse(job.learn_put(self.ctx))
        self.assertFalse(job.learn_put(SimpleNamespace(pdir=Path(self.tmp.name) / 'missing', st={}, c=C())))


if __name__ == '__main__':
    unittest.main()
