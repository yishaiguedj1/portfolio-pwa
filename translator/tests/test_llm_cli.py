"""24/10/2026: ה־Routine כמו מצב ה־API — עבודת השפה עוברת ב־claude -p (על המנוי), באותן קריאות של השרת.
claude מדומה: סקריפט שרושם את הפקודה, הסביבה והקלט, ומחזיר stream-json כמו Claude Code."""
from __future__ import annotations
import json
import os
import stat
import sys
import tempfile
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402

FAKE = r'''#!/usr/bin/env python3
import json, os, sys
d = os.environ['FAKE_DIR']
data = sys.stdin.read()
n = len([x for x in os.listdir(d) if x.startswith('call-')])
args = sys.argv[1:]
sp = args[args.index('--system-prompt-file') + 1]
json.dump({'argv': args, 'cwd': os.getcwd(), 'stdin': data, 'sys': open(sp, encoding='utf-8').read(),
           'env': {k: os.environ.get(k) for k in ('ANTHROPIC_API_KEY', 'CLAUDE_EFFORT', 'CLAUDE_CODE_EFFORT_LEVEL',
                   'CLAUDE_CODE_DISABLE_CLAUDE_MDS', 'CLAUDE_CODE_MAX_OUTPUT_TOKENS')}},
          open(os.path.join(d, 'call-%d-%d.json' % (n, os.getpid())), 'w'))   # במקביל — שם לפי התהליך
mode = os.environ.get('FAKE_MODE', 'ok')
if mode == 'crash':
    sys.stderr.write('boom\n'); sys.exit(3)
print(json.dumps({'type': 'system', 'subtype': 'init'}))
if mode == 'ok':
    print(json.dumps({'type': 'stream_event', 'event': {'type': 'message_start'}}))
    first = n == 0
    u = {'input_tokens': 3, 'output_tokens': 120, 'output_tokens_details': {'thinking_tokens': 40},
         'cache_read_input_tokens': 0 if first else 50000, 'cache_creation_input_tokens': 50000 if first else 0,
         'cache_creation': {'ephemeral_1h_input_tokens': 50000 if first else 0, 'ephemeral_5m_input_tokens': 0}}
    print(json.dumps({'type': 'result', 'subtype': 'success', 'is_error': False, 'stop_reason': 'end_turn',
                      'result': '#1\tשלום', 'usage': u, 'uuid': 'u%d' % n}))
elif mode == 'rate':
    print(json.dumps({'type': 'result', 'subtype': 'error', 'is_error': True, 'api_error_status': 429,
                      'result': 'API Error: 429 rate limited', 'usage': {}}))
elif mode == 'quota':
    print(json.dumps({'type': 'result', 'subtype': 'error', 'is_error': True,
                      'result': "You've hit your usage limit · resets 5pm", 'usage': {}}))
'''


class CliTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        exe = self.tmp / 'claude'
        exe.write_text(FAKE)
        exe.chmod(exe.stat().st_mode | stat.S_IEXEC)
        (self.tmp / 'calls').mkdir()
        self.env = {'SNB_CLAUDE_BIN': str(exe), 'SNB_CLI_DIR': str(self.tmp / 'cwd'), 'FAKE_DIR': str(self.tmp / 'calls'),
                    'ANTHROPIC_API_KEY': 'sk-test-not-real', 'CLAUDE_EFFORT': 'low', 'SNB_MID_RETRY': '0'}
        self.old = {k: os.environ.get(k) for k in list(self.env) + ['FAKE_MODE', 'SNB_LLM']}
        os.environ.update(self.env)
        self.wait0 = llm.MID_RETRY_WAIT
        llm.MID_RETRY_WAIT = ()

    def tearDown(self):
        llm.MID_RETRY_WAIT = self.wait0
        for k, v in self.old.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v

    def calls(self):
        return [json.loads(p.read_text()) for p in sorted((self.tmp / 'calls').glob('call-*.json'))]

    def eng(self):
        return llm.Engine(llm.Spec.of('haiku-high'), transport='cli')

    def test_same_call_as_api(self):
        e = self.eng()
        seen = []
        r = e.complete('tl', 'הבלוק הקבוע', 'הבקשה', max_tokens=32000, system_extra='הוראה קצרה',
                       on_first_token=lambda: seen.append(1))
        self.assertEqual(r.text, '#1\tשלום')
        self.assertEqual(seen, [1], 'on_first_token — כשהשרת התחיל לענות')
        c = self.calls()[0]
        a = c['argv']
        self.assertEqual(a[a.index('--model') + 1], 'claude-haiku-5-5')
        self.assertEqual(a[a.index('--effort') + 1], 'high')
        self.assertEqual(a[a.index('--disallowedTools') + 1], '*', 'בלי כלים')
        self.assertEqual(a[a.index('--setting-sources') + 1], '', 'בלי הגדרות ו־CLAUDE.md')
        for f in ('--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence'):
            self.assertIn(f, a)
        self.assertEqual(a[a.index('--max-turns') + 1], '1')
        self.assertEqual(c['sys'], 'הבלוק הקבוע', 'הבלוק הקבוע = ההנחיה של המערכת, כמו שהוא')
        self.assertEqual(c['stdin'], 'הוראה קצרה\n\nהבקשה', 'ההוראה שמשתנה — אחרי נקודת המטמון')
        self.assertIsNone(c['env']['ANTHROPIC_API_KEY'], 'בלי מפתח API — אחרת החיוב לא במנוי')
        self.assertIsNone(c['env']['CLAUDE_EFFORT'], 'מאמץ של הסשן לא גובר על המצב')
        self.assertEqual(c['env']['CLAUDE_CODE_DISABLE_CLAUDE_MDS'], '1')
        self.assertEqual(c['env']['CLAUDE_CODE_MAX_OUTPUT_TOKENS'], '32000')
        self.assertEqual(r.usage, {'i': 3, 'o': 120, 'cr': 0, 'c5': 0, 'c1': 50000})
        self.assertEqual(r.think_chars, 40)
        self.assertAlmostEqual(r.usd, llm.cost_anthropic('claude-haiku-5-5', 3, 120, 0, 0, 50000))

    def test_cache_shared_and_parallel(self):
        e = self.eng()
        e.complete('tl', 'קבוע', 'א')
        ts = [threading.Thread(target=e.complete, args=('tl', 'קבוע', 'ב%d' % i)) for i in range(3)]
        [t.start() for t in ts]
        [t.join() for t in ts]
        cs = self.calls()
        self.assertEqual(len(cs), 4)
        self.assertEqual(len({c['cwd'] for c in cs}), 1, 'תיקייה אחת — המטמון של Claude Code לפי תיקייה')
        self.assertEqual(len(list((self.tmp / 'cwd').glob('sys-*.txt'))), 1, 'קובץ הנחיה אחד לבלוק קבוע אחד')
        self.assertEqual(e.cache_warns, 0, 'מהקריאה השנייה — קריאה מהמטמון')
        row = e.ledger.list()[0]
        self.assertEqual((row['n'], row['cr']), (4, 150000))

    def test_errors(self):
        e = self.eng()
        for mode, code in (('rate', 'api_rate'), ('quota', 'sub_limit'), ('crash', 'cli_error')):
            os.environ['FAKE_MODE'] = mode
            with self.assertRaises(llm.LLMError) as cm:
                e.complete('tl', 'קבוע', 'x')
            self.assertEqual(cm.exception.code, code, mode)
        os.environ['SNB_CLAUDE_BIN'] = str(self.tmp / 'nope')
        with self.assertRaises(llm.LLMError) as cm:
            e.complete('tl', 'קבוע', 'x')
        self.assertEqual(cm.exception.code, 'cli_missing')

    def test_env_selects_transport(self):
        os.environ['SNB_LLM'] = 'cli'
        self.assertEqual(llm.Engine(llm.Spec.of('haiku-high')).transport, 'cli')
        self.assertEqual(llm.Engine(llm.judge_spec()).transport, 'cli', 'גם השופט')
        os.environ.pop('SNB_LLM')
        self.assertEqual(llm.Engine(llm.Spec.of('haiku-high')).transport, 'api')

    def test_card_counts_wrapper(self):
        e = self.eng()
        self.assertGreater(e.prompt_tokens('x', 'y'), 1500, 'המעטפת של Claude Code נספרת בכרטיס של Haiku')


if __name__ == '__main__':
    unittest.main()
