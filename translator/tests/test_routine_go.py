"""24/10/2026: ה־Routine כמו מצב ה־API — go מריץ את auto ברקע (מנותק מהסשן), wait מחכה לו, והעלות = הקריאות
מה־ledger + הסשן הדק של ה־Routine (שורת sub)."""
from __future__ import annotations
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

TMP = Path(tempfile.mkdtemp())
os.environ['SNB_STATE'] = str(TMP / 'state')
os.environ['SNB_CLAUDE_PROJECTS'] = str(TMP / 'projects')
os.environ['SNB_WAIT_STEP'] = '0.1'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import job as J  # noqa: E402


def run(*argv):
    buf = io.StringIO()
    with redirect_stdout(buf):
        rc = J.main(list(argv))
    return rc, buf.getvalue()


class GoWaitTests(unittest.TestCase):
    def tearDown(self):
        os.environ.pop('SNB_GO_CMD', None)
        os.environ.pop('SNB_LLM', None)

    def go(self, code):
        os.environ['SNB_GO_CMD'] = json.dumps([sys.executable, '-c', code])
        return run('go')

    def test_done(self):
        rc, out = self.go("import os; print('llm=' + os.environ.get('SNB_LLM', '')); print('✓ סוף')")
        self.assertEqual(rc, 0)
        self.assertIn('job.py wait', out)
        rc, out = run('wait', '--max', '30')
        self.assertEqual(rc, 0)
        self.assertIn('llm=cli', out, 'auto רץ עם claude -p (המנוי)')
        self.assertIn('✓ העבודה הסתיימה', out)

    def test_failed_code(self):
        self.go("import sys; print('נכשל'); sys.exit(3)")
        rc, out = run('wait', '--max', '30')
        self.assertIn('■ העבודה נעצרה (קוד 3)', out)

    def test_still_running_and_no_double_start(self):
        self.go("import time; time.sleep(8)")
        rc, out = run('go')
        self.assertIn('כבר רצה ברקע', out, 'go שני לא מפעיל עוד עבודה')
        rc, out = run('wait', '--max', '1')
        self.assertIn('עדיין רצה', out)
        rc, out = run('wait', '--max', '30')
        self.assertIn('✓ העבודה הסתיימה', out)


class SessionUsageTests(unittest.TestCase):
    def test_with_session(self):
        d = TMP / 'projects' / 'p' / 's1'
        d.mkdir(parents=True, exist_ok=True)
        S = 'claude-sonnet-5-5'
        rec = {'type': 'assistant', 'message': {'id': 'm1', 'model': S, 'content': [{'type': 'text'}],
               'usage': {'input_tokens': 5, 'output_tokens': 200, 'cache_read_input_tokens': 30000,
                         'cache_creation_input_tokens': 0}}}
        (d / 'sess.jsonl').write_text(json.dumps(rec) + '\n')
        ledger = [{'k': 'tl', 'm': 'claude-haiku-5-5', 'n': 4, 'i': 8, 'o': 900, 'cr': 150000, 'c5': 0, 'c1': 50000, 'usd': 0.01},
                  {'k': 'sub', 'm': S, 'n': 1, 'i': 10, 'o': 300, 'cr': 0, 'c5': 0, 'c1': 2000, 'usd': 0.012}]
        self.assertEqual(J.with_session(ledger), ledger, 'בשרת (בלי SNB_LLM=cli) — בלי שינוי')
        os.environ['SNB_LLM'] = 'cli'
        try:
            rows = J.with_session(ledger)
        finally:
            os.environ.pop('SNB_LLM')
        self.assertEqual(len(rows), 2)
        sub = [r for r in rows if r['k'] == 'sub'][0]
        self.assertEqual((sub['n'], sub['o'], sub['cr']), (2, 500, 30000), 'הסשן של ה־Routine מצטרף לשורת sub')
        self.assertAlmostEqual(sub['usd'], 0.012 + J.cost_of(S, 5, 200, 30000, 0, 0), places=3)


if __name__ == '__main__':
    unittest.main()
