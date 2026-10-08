"""v362: מגדל הפיקוח (translator/tower.py) — הכללים (טהורים) וה־Hook מקצה לקצה מול שרתון מדומה.

בודק: עבודה רגילה לא נעצרת (גם כבדה, גם בתחילתה), צריכה פי 4 ביחס להתקדמות / פי 5 מהכל, אותה שגיאה 6 פעמים,
אותה פעולה 10 פעמים (בלי פקודות מעקב), תקיעה; הדגל האדום נשאר (כל פעולה נחסמת, גם בלי שרתון), "עצור" מהשרתון,
בלי עבודה פעילה / קובץ ישן / SNB_TOWER=off — שקט.
הרצה: python3 -m unittest discover -s tests   (מתוך translator/)
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import tower as T  # noqa: E402
from test_worker import Fake, JOB, KEY  # noqa: E402


class TestRules(unittest.TestCase):
    EXP = T.expected_usd({'dur': 3600, 'mode': 'opus-medium'})       # 7.5$

    def a(self, usd, frac=0.5, errs=(), calls=(), chg=None, then=None, now=10000.0):
        return T.assess(now, usd, self.EXP, frac, list(errs), list(calls), chg, then)

    def test_expected(self):
        self.assertAlmostEqual(self.EXP, 7.5)
        self.assertAlmostEqual(T.expected_usd({'dur': 1800, 'mode': 'sonnet-medium'}), 3.0)
        self.assertAlmostEqual(T.expected_usd({}), 7.5, msg='אורך לא ידוע = שעה')
        self.assertAlmostEqual(T.progress_frac('tl', 0.5), 0.08 + 0.07 + 0.275)
        self.assertEqual(T.progress_frac('up', 1), 0.0)
        self.assertAlmostEqual(T.progress_frac('sv', 1), 1.0)

    def test_normal_never_stops(self):
        self.assertEqual(self.a(3.7, 0.5)[0], 'ok')
        self.assertEqual(self.a(7.0, 1.0)[0], 'ok', 'עבודה שלמה בצריכה הרגילה')
        self.assertEqual(self.a(2.5, 0.0)[0], 'ok', 'בתחילת העבודה — מול 20% מהצפוי, לא מול אפס')
        lv, why, info = self.a(9.0, 0.5)
        self.assertEqual((lv, why), ('warn', ''), 'פי 2.4 — צהוב, בלי לעצור')
        self.assertEqual(info['x'], 2.4)

    def test_cost(self):
        lv, why, info = self.a(15.5, 0.5)
        self.assertEqual((lv, why), ('red', 'cost'))
        self.assertEqual(info['x'], 4.1)
        small = T.assess(0, 3.0, 2.0, 0.2, [], [], None, None)        # פי 7.5, אבל רק 2.6$ מעל הצפוי
        self.assertEqual(small[0], 'warn', 'סטייה קטנה בעבודה קטנה — לא עוצרים')

    def test_cap(self):
        self.assertEqual(self.a(38.0, 1.0)[:2], ('red', 'cap'), 'פי 5 מכל העבודה — תמיד')

    def test_loops(self):
        now = 10000.0
        errs = [(now - 60 * i, 'e1') for i in range(6)]
        lv, why, info = self.a(1.0, 0.5, errs=errs)
        self.assertEqual((lv, why, info['n']), ('red', 'loop', 6))
        self.assertEqual(self.a(1.0, 0.5, errs=errs[:5])[0], 'ok')
        old = [(now - 16 * 60 - i, 'e1') for i in range(10)]
        self.assertEqual(self.a(1.0, 0.5, errs=old)[0], 'ok', 'מחוץ לחלון של 15 דקות')
        mixed = [(now - i, 'e%d' % (i % 3)) for i in range(12)]
        self.assertEqual(self.a(1.0, 0.5, errs=mixed)[0], 'ok', 'שגיאות שונות — לא לולאה')
        calls = [(now - i, 'c1') for i in range(10)]
        self.assertEqual(self.a(1.0, 0.5, calls=calls)[:2], ('red', 'calls'))
        self.assertEqual(self.a(1.0, 0.5, calls=calls[:9])[0], 'ok')

    def test_idle(self):
        now = 10000.0
        lv, why, info = self.a(3.0, 0.5, chg=now - 25 * 60, then=1.2)
        self.assertEqual((lv, why, info['min']), ('red', 'idle', 25))
        self.assertEqual(self.a(3.0, 0.5, chg=now - 25 * 60, then=2.0)[0], 'ok', 'תקוע אבל כמעט בלי צריכה (למשל מחכה לתשובה)')
        self.assertEqual(self.a(3.0, 0.5, chg=now - 10 * 60, then=0.0)[0], 'ok', 'פחות מ־20 דקות')

    def test_fingerprint(self):
        a = T.fingerprint('✗ tr-check: כתובית 412 ארוכה מ־42 תווים /root/vt-work/x/tr/check.md')
        b = T.fingerprint('✗ tr-check: כתובית 413 ארוכה מ־42 תווים /root/vt-work/y/tr/check.md\nעוד שורה')
        self.assertEqual(a, b, 'אותה תקלה בכתובית אחרת / בנתיב אחר = אותה טביעה')
        self.assertNotEqual(a, T.fingerprint('✗ ההורדה מ־Drive נכשלה (500).'))


class TestHook(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.tmp = Path(tempfile.mkdtemp())
        self.state = self.tmp / 'state'
        self.state.mkdir()
        self.proj = self.tmp / 'projects' / '-x'
        self.proj.mkdir(parents=True)
        self.base = 'http://127.0.0.1:%d' % self.fake.port
        self.env = dict(os.environ, SNB_STATE=str(self.state), SNB_CLAUDE_PROJECTS=str(self.tmp / 'projects'), SNB_TOWER_EVERY='0')
        self.env.pop('SNB_TOWER', None)
        self.set_job()
        self.set_prog('tl', 0.5)

    def tearDown(self):
        self.fake.close()

    def set_job(self, **extra):
        st = dict({'job': JOB, 'key': KEY, 'server': self.base, 'drive_api': self.base + '/drive/v3', 'folder': 'F',
                   'spec': {'dur': 3600, 'mode': 'opus-medium'}}, **extra)
        (self.state / 'job.json').write_text(json.dumps(st))

    def set_prog(self, st, p, chg=None):
        (self.state / 'prog.json').write_text(json.dumps({'st': st, 'p': p, 'at': time.time(), 'chg': chg or time.time()}))

    def spend(self, out_tokens, errors=0):
        """יומן סשן מדומה: פלט ב־Opus (20$ למיליון) + שגיאות כלי זהות."""
        recs = [{'type': 'user', 'message': {'content': 'routine-fire-payload'}}]
        recs.append({'type': 'assistant', 'message': {'id': 'm1', 'model': 'claude-opus-5-5', 'content': [{'type': 'text'}],
                     'usage': {'input_tokens': 10, 'output_tokens': out_tokens}}})
        ts = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
        for i in range(errors):
            recs.append({'type': 'user', 'timestamp': ts, 'message': {'role': 'user', 'content': [
                {'type': 'tool_result', 'tool_use_id': 't%d' % i, 'is_error': True,
                 'content': 'Exit code 1\n✗ tr-check מצא שגיאות בכתובית %d' % (400 + i)}]}})
        (self.proj / 's.jsonl').write_text('\n'.join(json.dumps(r, ensure_ascii=False) for r in recs) + '\n')

    def hook(self, tool='Bash', inp=None, env=None):
        r = subprocess.run(['sh', str(HERE / 'tower-hook.sh')], input=json.dumps({'tool_name': tool, 'tool_input': inp or {'command': 'ls'}}),
                           capture_output=True, text=True, timeout=60, env=dict(self.env, **(env or {})))
        self.assertEqual(r.returncode, 0, r.stderr)
        return json.loads(r.stdout) if r.stdout.strip() else None

    def test_quiet_without_job(self):
        (self.state / 'job.json').unlink()
        self.assertIsNone(self.hook())
        self.set_job()
        self.assertIsNone(self.hook(env={'SNB_TOWER': 'off'}))
        old = time.time() - 60 * 3600
        os.utime(self.state / 'job.json', (old, old))
        self.spend(5_000_000)
        self.assertIsNone(self.hook(), 'קובץ עבודה בן יותר מ־50 שעות — לא פעיל')
        self.assertFalse(self.fake.reports)

    def test_normal_reports_ok(self):
        self.spend(150_000)                                          # 3$ באמצע התרגום — רגיל
        self.assertIsNone(self.hook())
        tw = [r['tower'] for r in self.fake.reports if r.get('tower')]
        self.assertEqual(tw[0]['lv'], 'ok')
        self.assertNotIn(KEY, (self.state / 'tower.json').read_text(), 'במצב המגדל — רק טביעה של המפתח')
        self.assertIsNone(self.hook())
        self.assertEqual(len([r for r in self.fake.reports if r.get('tower')]), 1, 'מדווחים רק כשהמצב משתנה (או כל 5 דק׳)')

    def test_cost_stops_everything(self):
        self.spend(900_000)                                          # 18$ באמצע — פי 4.2
        out = self.hook()
        self.assertIs(out['continue'], False)
        self.assertIn('מגדל הפיקוח עצר', out['stopReason'])
        self.assertEqual(out['hookSpecificOutput']['permissionDecision'], 'deny')
        fail = self.fake.reports[-1]
        self.assertTrue(fail['fail'])
        self.assertEqual(fail['err'], 'tower_stop')
        self.assertEqual((fail['tower']['lv'], fail['tower']['why']), ('red', 'cost'))
        self.assertTrue(fail.get('usage'), 'הטוקנים נשלחים עם העצירה')
        n = len(self.fake.reports)
        self.spend(10)
        out = self.hook('Agent', {'prompt': 'x'})
        self.assertIs(out['continue'], False, 'הדגל האדום נשאר — גם פעולה של סוכן־משנה אחרי זה נחסמת')
        self.assertEqual(len(self.fake.reports), n, 'בלי עוד פניות לשרתון')

    def test_same_error_loop(self):
        self.spend(50_000, errors=6)
        out = self.hook()
        self.assertIs(out['continue'], False)
        self.assertEqual(self.fake.reports[-1]['tower']['why'], 'loop')
        self.assertEqual(self.fake.reports[-1]['tower']['n'], 6)

    def test_same_call_loop(self):
        self.spend(50_000)
        for i in range(9):
            self.assertIsNone(self.hook('TaskOutput', {'task_id': 'b1'}), 'מעקב אחרי פקודה ברקע — לא נספר')
        for i in range(9):
            self.assertIsNone(self.hook('Read', {'file_path': '/x/en.edit.txt'}))
        out = self.hook('Read', {'file_path': '/x/en.edit.txt'})
        self.assertIs(out['continue'], False)
        self.assertEqual(self.fake.reports[-1]['tower']['why'], 'calls')

    def test_idle(self):
        self.set_prog('tl', 0.4, chg=time.time() - 30 * 60)
        tw = {'job': JOB, 'kh': __import__('hashlib').sha1(KEY.encode()).hexdigest()[:12], 'samples': [[time.time() - 25 * 60, 0.5]]}
        (self.state / 'tower.json').write_text(json.dumps(tw))
        self.spend(150_000)                                          # 3$ — עלה ב־2.5$ בלי התקדמות
        out = self.hook()
        self.assertIs(out['continue'], False)
        self.assertEqual(self.fake.reports[-1]['tower']['why'], 'idle')

    def test_server_stop(self):
        self.spend(50_000)
        self.fake.stop_all = True                                    # בוטלה בטלפון / הועברה לסשן חדש
        out = self.hook()
        self.assertIs(out['continue'], False)
        self.assertIn('בוטלה', out['stopReason'])
        self.assertIs(self.hook()['continue'], False)

    def test_new_job_starts_clean(self):
        self.spend(900_000)
        self.assertIs(self.hook()['continue'], False)
        tw = json.loads((self.state / 'tower.json').read_text())
        tw['kh'] = 'older0000000'                                     # הדגל נשמר בהפעלה קודמת (מפתח אחר) — "המשך" עם מפתח חדש
        (self.state / 'tower.json').write_text(json.dumps(tw))
        self.spend(50_000)
        self.assertIsNone(self.hook(), 'דגל אדום של הפעלה קודמת לא עוצר את ההמשך')

    def test_broken_input_allows(self):
        r = subprocess.run(['sh', str(HERE / 'tower-hook.sh')], input='not json', capture_output=True, text=True, timeout=60, env=self.env)
        self.assertEqual((r.returncode, r.stdout.strip()), (0, ''))
        (self.state / 'tower.json').write_text('{broken')
        self.assertIsNone(self.hook())


if __name__ == '__main__':
    unittest.main()
