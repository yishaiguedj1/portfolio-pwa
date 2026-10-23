"""23/10/2026 — תיקונים מניתוח המאגר: שאלה שנבלעת בכתובית של שני דוברים, שאלה באמצע כתובית, מונחים עסקיים אוטומטיים."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import job  # noqa: E402
import pipeline  # noqa: E402
from vt.translate import check, _real_question  # noqa: E402


def cue(i, en, parts=None, budget=80):
    c = {'id': i, 'en': en, 'budget': budget}
    if parts:
        c['parts'] = [{'spk': 'S1', 'en': parts[0]}, {'spk': 'S2', 'en': parts[1]}]
    return c


class TwoSpeakers(unittest.TestCase):
    def test_dropped_part_is_hard(self):
        c = cue(1, "And what's your name? I'm Glenn.", ("And what's your name?", "I'm Glenn."))
        issues, _ = check([c], {'1': ' || אני גלן.'}, [])
        hard, _ = pipeline.parse_issues('\n'.join(issues))
        self.assertIn('1', hard, issues)

    def test_question_mark_missing_is_soft(self):
        c = cue(1, "And what's your name? I'm Glenn.", ("And what's your name?", "I'm Glenn."))
        issues, st = check([c], {'1': 'ואיך קוראים לך || אני גלן.'}, [])
        hard, soft = pipeline.parse_issues('\n'.join(issues))
        self.assertNotIn('1', hard)
        self.assertIn('1', soft)
        self.assertEqual(st['questions'], 1)

    def test_clean_two_speakers(self):
        c = cue(1, "And what's your name? I'm Glenn.", ("And what's your name?", "I'm Glenn."))
        issues, _ = check([c], {'1': 'ואיך קוראים לך? || אני גלן.'}, [])
        self.assertEqual(issues, [])


class MidQuestion(unittest.TestCase):
    def test_real_question(self):
        self.assertTrue(_real_question("And what's your name? I'm Glenn."))
        self.assertFalse(_real_question('It is huge, right? And then we left.'))
        self.assertFalse(_real_question('You know? It was fine.'))

    def test_flagged_when_question_lost(self):
        issues, st = check([cue(1, "So what do you do? We sell shoes.")], {'1': 'אנחנו מוכרים נעליים.'}, [])
        self.assertEqual(st['questions'], 1, issues)
        issues, st = check([cue(1, "So what do you do? We sell shoes.")], {'1': 'מה אתם עושים? מוכרים נעליים.'}, [])
        self.assertEqual(st['questions'], 0, issues)


class BizGlossary(unittest.TestCase):
    def run_merge(self, en, gl_rows=(), job_lines=''):
        d = Path(tempfile.mkdtemp())
        (d / 'tr').mkdir()
        (d / 'cues.en.json').write_text(json.dumps([{'en': en}]), encoding='utf-8')
        if job_lines:
            (d / 'tr' / 'glossary.tsv').write_text(job_lines, encoding='utf-8')
        ctx = SimpleNamespace(pdir=d, st={'gl': [list(r) for r in gl_rows]})
        job.gl_merge(ctx)
        p = d / 'tr' / 'glossary.tsv'
        return ctx, (p.read_text(encoding='utf-8') if p.exists() else '')

    def test_specific_terms_only(self):
        _, g = self.run_merge('Our run rate and EBITDA grew, the team cut cost.')
        self.assertIn(job.BIZ_MARK, g)
        self.assertIn('run rate\t', g)
        self.assertIn('EBITDA\t', g)
        self.assertNotIn('\nteam\t', g)       # מילה כללית — לא נכנסת
        self.assertNotIn('\ncost\t', g)

    def test_job_and_user_win(self):
        _, g = self.run_merge('Our run rate and EBITDA grew.', gl_rows=[('EBITDA', 'אביטדה')],
                              job_lines='run rate\tקצב הכנסות שנתי\n')
        biz = g.split(job.BIZ_MARK, 1)[1].split(job.GL_MARK)[0] if job.BIZ_MARK in g else ''
        self.assertNotIn('run rate', biz)      # שורה של העבודה גוברת
        self.assertNotIn('EBITDA', biz)        # שורה שלך גוברת
        self.assertIn(job.GL_MARK + '\nEBITDA\tאביטדה', g)
        self.assertTrue(g.startswith('run rate\tקצב הכנסות שנתי'))

    def test_rerun_idempotent_and_not_suggested(self):
        ctx, g1 = self.run_merge('Our run rate grew.', gl_rows=[('moat', 'חפיר')])
        job.gl_merge(ctx)
        g2 = (ctx.pdir / 'tr' / 'glossary.tsv').read_text(encoding='utf-8')
        self.assertEqual(g1, g2)
        self.assertEqual(g2.count(job.BIZ_MARK), 1)
        sug = job.gl_suggest(ctx)
        self.assertFalse(sug and any(r[0] == 'run rate' for r in sug.get('s', [])), sug)

    def test_rows_written_after_biz_block_survive(self):
        # Claude הוסיף מונחים בסוף החלק של העבודה (אחרי הבלוק העסקי) — בהרצה חוזרת הם נשארים, והבלוק העסקי מתחלף
        ctx, g = self.run_merge('Our run rate grew, a real moat.', gl_rows=[('moat', 'חפיר')])
        gp = ctx.pdir / 'tr' / 'glossary.tsv'
        head, tail = g.split(job.GL_MARK, 1)
        gp.write_text(head + 'Buyback\tרכישה עצמית\n' + job.GL_MARK + tail, encoding='utf-8')
        job.gl_merge(ctx)
        g2 = gp.read_text(encoding='utf-8')
        self.assertIn('Buyback\tרכישה עצמית', g2)
        self.assertEqual(g2.count('run rate\t'), 1)

    def test_nothing_to_add(self):
        _, g = self.run_merge('We just talked about food.')
        self.assertEqual(g, '')


class Prompts(unittest.TestCase):
    def test_rules_present(self):
        guide = (HERE.parent / 'guides' / 'style-guide-he.md').read_text(encoding='utf-8')
        self.assertIn('טעות שמיעה בתמליל', guide)
        self.assertIn('שאלה קצרה', guide)
        for t in (pipeline.TL_TASK, (HERE.parent / 'TRANSLATE.md').read_text(encoding='utf-8')):
            self.assertIn('לא קובץ כתוביות שכתב אדם', t)
            self.assertIn('כל דובר מקבל תרגום', t)
        self.assertIn('טעות שמיעה', pipeline.RV_TASK)
        self.assertIn('טעות שמיעה', (HERE.parent / 'REVIEW.md').read_text(encoding='utf-8'))


if __name__ == '__main__':
    unittest.main()
