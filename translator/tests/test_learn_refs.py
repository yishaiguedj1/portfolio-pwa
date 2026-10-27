"""26/10/2026 — מאגר הלמידה: כתוביות אנושיות שכבר קיימות למקור (עבודה מקישור) כייחוס.
fetchurl.get_subs מוריד רק את הכתוביות של היוצר בעברית ובאנגלית; job שומר אותן ב־<פרויקט>/ref/ ומכניס לקורפוס (ref);
learnmetrics.ref_metrics — chrF++ מול התרגום האנושי (הסופי ולכל שלב) ו־WER של התמליל מול האנגלית. בלי רשת: yt-dlp מדומה."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import fetchurl as F  # noqa: E402
import job  # noqa: E402
import learnmetrics as LM  # noqa: E402


def srt(rows):
    def t(x):
        h, m, s = int(x // 3600), int(x % 3600 // 60), x % 60
        return f'{h:02d}:{m:02d}:{int(s):02d},{int(round((s - int(s)) * 1000)):03d}'
    return '\n\n'.join(f'{i + 1}\n{t(a)} --> {t(b)}\n{txt}' for i, (a, b, txt) in enumerate(rows)) + '\n'


class GetSubs(unittest.TestCase):
    def test_pick(self):
        self.assertEqual(F.ref_pick(['ref.en-US.srt', 'ref.iw.srt', 'ref.en.srt', 'ref.fr.srt']), {'he': 'ref.iw.srt', 'en': 'ref.en.srt'})
        self.assertEqual(F.ref_pick(['ref.en-orig.srt', 'ref.de.srt']), {}, 'en-orig = אוטומטיות — לא')

    def test_human_only_and_files(self):
        seen = []
        with tempfile.TemporaryDirectory() as d:
            def run(cmd, **kw):
                seen.append(cmd)
                Path(d, 'ref.he.srt').write_text('1\n00:00:01,000 --> 00:00:02,000\nשלום\n', encoding='utf-8')
                Path(d, 'ref.en-orig.srt').write_text('x', encoding='utf-8')
                return SimpleNamespace(returncode=0, stderr='', stdout='')
            got = F.get_subs('https://www.ted.com/talks/x', d, run=run)
            self.assertEqual(list(got), ['he'])
            cmd = seen[0]
            self.assertIn('--write-subs', cmd)
            self.assertIn('--no-write-auto-subs', cmd)
            self.assertIn('--skip-download', cmd)
            self.assertNotIn('--write-auto-subs', cmd)
            self.assertEqual(cmd[-2:], ['--', 'https://www.ted.com/talks/x'])

    def test_failure_is_empty(self):
        with tempfile.TemporaryDirectory() as d:
            def boom(cmd, **kw):
                raise OSError('no yt-dlp')
            self.assertEqual(F.get_subs('https://x.test/v', d, run=boom), {})


class StartConditions(unittest.TestCase):
    def ctx(self, spec, pd):
        return SimpleNamespace(pdir=pd, st={'spec': spec, 'job': 'jX'}, name='x')

    def test_only_url_without_section(self):
        with tempfile.TemporaryDirectory() as d:
            pd = Path(d)
            os.environ.pop('SNB_LEARNREF', None)
            self.assertIsNone(job.learn_refs_start(self.ctx({'src': 'up'}, pd)))
            self.assertIsNone(job.learn_refs_start(self.ctx({'src': 'url', 'url': 'https://x', 'pick': {'sec': [10, 20]}}, pd)),
                              'קטע — הציר לא זהה')
            os.environ['SNB_LEARNREF'] = 'off'
            try:
                self.assertIsNone(job.learn_refs_start(self.ctx({'src': 'url', 'url': 'https://x', 'pick': {}}, pd)))
            finally:
                os.environ.pop('SNB_LEARNREF', None)
            (pd / 'ref').mkdir()
            self.assertIsNone(job.learn_refs_start(self.ctx({'src': 'url', 'url': 'https://x', 'pick': {}}, pd)), 'כבר נאסף')


class CorpusAndMetrics(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        pd = self.pd = Path(self.tmp.name)
        (pd / 'tr').mkdir()
        (pd / 'out').mkdir()
        (pd / 'ref').mkdir()
        n = 30
        heb = 'אבגדהוזחטיכלמנסעפצקרשת'
        he = [f'מילה{heb[i % 22]}{heb[i // 22]} ועוד {heb[(i * 7) % 22]}לה' for i in range(30)]
        en = [f'word{i} talk about item{i * 3}' for i in range(30)]
        en[0] = 'hello and welcome'
        (pd / 'cues.en.json').write_text(json.dumps([{'id': i + 1, 'speech_s': i * 2.0, 'speech_e': i * 2 + 1.8, 'en': en[i]}
                                                     for i in range(n)]), encoding='utf-8')
        (pd / 'tr' / 'batch_001.he.txt').write_text(''.join(f'#{i + 1} {"טיוטה" if i < 10 else he[i]}\n' for i in range(n)), encoding='utf-8')
        (pd / 'tr' / 'fixes_review.txt').write_text(''.join(f'#{i + 1} {he[i]}\n' for i in range(10)), encoding='utf-8')
        (pd / 'out' / 'cues.final.json').write_text(json.dumps([{'start': i * 2.0, 'end': i * 2 + 1.8, 'lines': [he[i]]} for i in range(n)]),
                                                    encoding='utf-8')
        (pd / 'ref' / 'he.srt').write_text(srt([(i * 2.0, i * 2 + 1.8, he[i]) for i in range(n)] + [(70, 71, '(מחיאות כפיים)')]), encoding='utf-8')
        (pd / 'ref' / 'en.srt').write_text(srt([(i * 2.0, i * 2 + 1.8, en[i] if i != 4 else 'word4 talk about honey') for i in range(n)]),
                                           encoding='utf-8')
        self.ctx = SimpleNamespace(pdir=pd, st={'spec': {}})

    def tearDown(self):
        self.tmp.cleanup()

    def test_corpus_has_ref(self):
        c = job.learn_corpus(self.ctx)
        self.assertEqual(len(c['ref']['he']), 30, 'כתובית צלילים — בחוץ')
        self.assertEqual(c['ref']['en'][0], {'s': 0.0, 'e': 1.8, 'h': 'hello and welcome'})

    def test_metrics(self):
        m = LM.job_metrics(job.learn_corpus(self.ctx))['rf']
        self.assertEqual(m['he.n'], 30)
        self.assertGreater(m['he.c'], 99)
        self.assertEqual(m['he.cov'], 1.0)
        self.assertLess(m['he.d'], m['he.r'], 'הביקורת קירבה לתרגום האנושי')
        self.assertEqual(m['he.r'], m['he.z'])
        self.assertEqual((m['en.s'], m['en.d'], m['en.i']), (1, 0, 0), 'מילה אחת שונה (item12/honey)')
        self.assertAlmostEqual(m['en.w'], round(100 / m['en.n'], 2), places=2)

    def test_too_few_refs(self):
        c = job.learn_corpus(self.ctx)
        c['ref'] = {'he': c['ref']['he'][:5]}
        self.assertIsNone(LM.ref_metrics(c))
        self.assertEqual(LM.wer_counts(['a', 'b', 'x'], ['a', 'b', 'c', 'd']), (1, 1, 0))

    def test_ref_not_in_full_texts(self):
        self.assertNotIn('ref/he.srt', job.project_texts(self.pd), 'כבר בקורפוס כמבנה — לא שוב כקובץ')


if __name__ == '__main__':
    unittest.main()
