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

    def test_learned_norm(self):
        # v363: "הרגיל" שנלמד מהעבודות של המשתמש
        self.assertIsNone(T.valid_norm({'ph': 3, 'mx': 4, 'n': 2}), 'פחות מ־3 עבודות — המדידות שלנו')
        self.assertIsNone(T.valid_norm({'ph': 0, 'mx': 4, 'n': 5}))
        self.assertIsNone(T.valid_norm({'ph': 'x', 'n': 5}))
        self.assertIsNone(T.valid_norm('junk'))
        nm = {'ph': 4.0, 'mx': 6.0, 'n': 5}
        self.assertAlmostEqual(T.expected_usd({'dur': 3600, 'mode': 'haiku-high'}, nm), 4.0, msg='החציון שלך, לא הקבוע של המצב')
        self.assertAlmostEqual(T.expected_usd({'dur': 300}, nm), 4.0 * 600 / 3600, msg='סרטון קצר — כמו 10 דק׳ (כמו בשרתון)')
        self.assertEqual(T.thresholds(None), (4.0, 5.0))
        self.assertEqual(T.thresholds(nm), (4.0, 5.0), 'הכבדה ביותר פי 1.5 — הסף נשאר פי 4')
        self.assertEqual(T.thresholds({'ph': 4.0, 'mx': 12.0, 'n': 3}), (6.0, 7.5), 'עבודה פי 3 כבר קרתה — אדום רק מפי 6, ורשת הביטחון מעליו')
        # עבודה כבדה כמו הכבדה ביותר שהייתה — לא נעצרת; כפולה ממנה — כן
        exp = T.expected_usd({'dur': 3600}, {'ph': 4.0, 'mx': 12.0, 'n': 3})
        red_x, cap_x = T.thresholds({'ph': 4.0, 'mx': 12.0, 'n': 3})
        self.assertNotEqual(T.assess(0, 12.0, exp, 1.0, [], [], None, None, red_x, cap_x)[0], 'red')
        self.assertEqual(T.assess(0, 25.0, exp, 1.0, [], [], None, None, red_x, cap_x)[:2], ('red', 'cost'))

    def test_shadow(self):
        # v384: מצב צל — הספים הישנים נאכפים, החדשים רק מזהירים
        self.assertIsNone(T.valid_shadow(None))
        self.assertIsNone(T.valid_shadow({'n': 0}))
        self.assertIsNone(T.valid_shadow({'n': 9}))
        self.assertEqual(T.valid_shadow({'n': 2, 'old': None}), {'n': 2, 'old': None})
        self.assertEqual(T.valid_shadow({'n': 1, 'old': {'ph': 4.0, 'mx': 5.0}})['old']['ph'], 4.0)
        nm, spec = {'ph': 3.0, 'mx': 4.0, 'n': 4}, {'dur': 3600, 'mode': 'opus-medium'}
        frac = T.progress_frac('tl', 0.5)
        self.assertEqual(T.shadow_assess(0, 8.0, spec, nm, None, frac, [], [], None, None)[0], 'red', 'בלי צל — החדשים עוצרים')
        lv, why, info = T.shadow_assess(0, 8.0, spec, nm, {'n': 2, 'old': None}, frac, [], [], None, None)
        self.assertEqual((lv, info.get('sh'), info.get('shn')), ('warn', 1, 2), 'בצל — רק אזהרה: "בספים החדשים היה נעצר"')
        lv, why, info = T.shadow_assess(0, 30.0, spec, nm, {'n': 2, 'old': None}, frac, [], [], None, None)
        self.assertEqual((lv, why), ('red', 'cost'), 'מה שהישנים עוצרים — נעצר גם בצל')
        lv, why, info = T.shadow_assess(0, 1.0, spec, nm, {'n': 3, 'old': None}, frac, [], [], None, None)
        self.assertEqual((lv, info.get('sh')), ('ok', None))

    def test_fault_fp_and_known_hint(self):
        # v364: ספר התיקונים — טביעה יציבה לפי סוג · שלב · מה שחזר; תזכורת רק לתקלה מוכרת, מ־3 שגיאות, פעם אחת
        fp = T.fault_fp('loop', 'tl', 'e1')
        self.assertEqual(fp, T.fault_fp('loop', 'tl', 'e1'))
        self.assertNotEqual(fp, T.fault_fp('loop', 'rv', 'e1'))
        self.assertRegex(fp, r'^[0-9a-f]{12}$')
        now = 10000.0
        errs = [(now - i, 'e1') for i in range(3)]
        known = {fp: 'מפצלים כתובית ארוכה לשתיים'}
        self.assertEqual(T.known_hint('tl', errs, [], {}, known, {}, now), (fp, known[fp]))
        self.assertIsNone(T.known_hint('tl', errs[:2], [], {}, known, {}, now), 'פחות מ־3 — עוד לא')
        self.assertIsNone(T.known_hint('tl', errs, [], {}, known, {fp: now - 5}, now), 'כבר הוזכר בסשן הזה')
        self.assertIsNone(T.known_hint('tl', errs, [], {}, {}, {}, now), 'תקלה לא מוכרת — המגדל עובד כרגיל')
        cfp = T.fault_fp('calls', 'tl', 'Read')
        calls = [(now - i, 'k1') for i in range(5)]
        self.assertEqual(T.known_hint('tl', [], calls, {'k1': 'Read'}, {cfp: 'x'}, {}, now)[0], cfp)
        self.assertIn('מידע בלבד', T.hint_text('לפצל `rm` <b>'))
        self.assertNotIn('`', T.hint_text('לפצל `rm`'))

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
        self.env = dict(os.environ, SNB_STATE=str(self.state), SNB_CLAUDE_PROJECTS=str(self.tmp / 'projects'), SNB_TOWER_EVERY='0', SNB_GATE_CHECK='0')
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

    def test_learned_norm_hook(self):
        # v363: אצלך עבודה כזו עולה בדרך כלל 3$ לשעה — 8$ באמצע התרגום = פי 6.3 → עוצרים, והדיווח אומר "לפי 4 העבודות שלך"
        self.set_job(nm={'ph': 3.0, 'mx': 4.0, 'n': 4})
        self.spend(400_000)
        out = self.hook()
        self.assertIs(out['continue'], False)
        tw = self.fake.reports[-1]['tower']
        self.assertEqual((tw['why'], tw['b'], tw['nj']), ('cost', 'u', 4))

    def test_shadow_hook(self):
        # v384: אותה עבודה כמו test_learned_norm_hook, אבל הספים החדשים במצב צל — לא עוצרים, מדווחים צהוב עם sh=1
        self.set_job(nm={'ph': 3.0, 'mx': 4.0, 'n': 4}, sh={'n': 2, 'old': None})
        self.spend(400_000)
        self.assertIsNone(self.hook())
        tw = [r['tower'] for r in self.fake.reports if r.get('tower')][-1]
        self.assertEqual((tw['lv'], tw.get('sh'), tw.get('shn')), ('warn', 1, 2))
        self.assertFalse(any(r.get('fail') for r in self.fake.reports))

    def test_learned_heavy_not_stopped(self):
        # אותו דבר, אבל כבר הייתה אצלך עבודה פי 5 מהחציון — 8$ הם עוד בטווח (צהוב, בלי לעצור)
        self.set_job(nm={'ph': 3.0, 'mx': 15.0, 'n': 4})
        self.spend(400_000)
        self.assertIsNone(self.hook())
        tw = [r['tower'] for r in self.fake.reports if r.get('tower')][-1]
        self.assertEqual((tw['lv'], tw['b']), ('warn', 'u'))

    def test_red_has_fingerprint(self):
        self.spend(50_000, errors=6)
        self.assertIs(self.hook()['continue'], False)
        tw = self.fake.reports[-1]['tower']
        self.assertEqual(tw['fp'], T.fault_fp('loop', 'tl', T.fingerprint('Exit code 1')), 'טביעה = לולאה · שלב התרגום · השגיאה שחזרה')

    def test_known_fix_hint(self):
        # תקלה מוכרת: אחרי 3 שגיאות זהות — הפעולה נחסמת פעם אחת עם התיקון, בלי לעצור; השרתון סופר "טופל לבד"
        fp = T.fault_fp('loop', 'tl', T.fingerprint('Exit code 1'))
        self.set_job(fb=[{'fp': fp, 'why': 'loop', 'st': 'tl', 'fix': 'מפצלים כתובית ארוכה לשתיים'}])
        self.spend(50_000, errors=3)
        out = self.hook()
        self.assertNotIn('continue', out, 'לא עצירה')
        self.assertEqual(out['hookSpecificOutput']['permissionDecision'], 'deny')
        self.assertIn('מפצלים כתובית ארוכה לשתיים', out['hookSpecificOutput']['permissionDecisionReason'])
        self.assertEqual([r.get('fixUsed') for r in self.fake.reports if r.get('fixUsed')], [fp])
        self.assertIsNone(self.hook(), 'פעם אחת בסשן — הפעולה הבאה עוברת')
        self.spend(50_000, errors=6)
        self.assertIs(self.hook()['continue'], False, 'חזרה עד הסף בכל זאת — עוצרים כרגיל')

    def test_budget_gate_go(self):
        # v367: תקציב 5$ — ב־6$ המגדל פותח שער: כל פעולה מחכה לך, חוץ מ־job.py gate; "להמשיך" — התקציב גדל ל־10$
        self.set_job(rl={'b': 5, 'ab': False})
        self.spend(300_000)
        out = self.hook('Read', {'file_path': '/x'})
        self.assertNotIn('continue', out, 'לא עצירה — המתנה')
        self.assertIn('job.py gate', out['hookSpecificOutput']['permissionDecisionReason'])
        g = [r['gate'] for r in self.fake.reports if r.get('gate')]
        self.assertEqual(g, [{'k': 'b', 'usd': 6.0, 'cap': 5.0}])
        self.assertEqual(self.hook('Read', {'file_path': '/x'})['hookSpecificOutput']['permissionDecision'], 'deny')
        self.assertIsNone(self.hook('Bash', {'command': 'python3 translator/job.py gate'}), 'הפקודה שמחכה לתשובה — מותרת')
        self.fake.gate_ans = 'go'
        self.assertIsNone(self.hook('Read', {'file_path': '/x'}), 'ענית "להמשיך" — ממשיכים')
        self.assertEqual(json.loads((self.state / 'tower.json').read_text())['bx'], 1)
        self.assertIsNone(self.hook('Read', {'file_path': '/y'}), '6$ מתוך 10$ — בלי שער חדש')
        self.assertEqual(len([r for r in self.fake.reports if r.get('gate')]), 1)

    def test_budget_gate_stop(self):
        self.set_job(rl={'b': 5, 'ab': False})
        self.spend(300_000)
        self.hook()
        self.fake.gate_ans = 'stop'
        out = self.hook()
        self.assertIs(out['continue'], False)
        self.assertIn('תקציב', out['stopReason'])
        self.assertEqual(self.fake.reports[-1].get('err'), 'budget_stop')
        self.assertIs(self.hook('Agent', {'prompt': 'x'})['continue'], False, 'הדגל נשאר')

    def test_budget_counts_previous_sessions(self):
        # התקציב לכל העבודה: 4.5$ מסשנים קודמים + 1$ עכשיו ≥ 5$ — שער. bx=1 מהשרתון (אישרת כבר פעם) → 10$ — בלי שער
        self.set_job(rl={'b': 5}, u0=4.5)
        self.spend(50_000)
        self.assertEqual(self.hook()['hookSpecificOutput']['permissionDecision'], 'deny')
        (self.state / 'tower.json').unlink()
        self.fake.reports.clear()
        self.set_job(rl={'b': 5}, u0=4.5, bx=1)
        self.assertIsNone(self.hook())
        self.assertFalse([r for r in self.fake.reports if r.get('gate')])

    def test_budget_gate_timeout(self):
        self.set_job(rl={'b': 5})
        self.spend(300_000)
        self.hook()
        tw = json.loads((self.state / 'tower.json').read_text())
        tw['gate']['at'] -= 31 * 60
        (self.state / 'tower.json').write_text(json.dumps(tw))
        out = self.hook()
        self.assertIs(out['continue'], False, 'חצי שעה בלי תשובה — ברירת המחדל: לעצור')
        self.assertTrue(any(r.get('askTimeout') == tw['gate']['id'] for r in self.fake.reports))

    def test_no_budget_no_gate(self):
        self.spend(300_000)
        self.assertIsNone(self.hook())
        self.assertFalse([r for r in self.fake.reports if r.get('gate')])

    def test_broken_input_allows(self):
        r = subprocess.run(['sh', str(HERE / 'tower-hook.sh')], input='not json', capture_output=True, text=True, timeout=60, env=self.env)
        self.assertEqual((r.returncode, r.stdout.strip()), (0, ''))
        (self.state / 'tower.json').write_text('{broken')
        self.assertIsNone(self.hook())


if __name__ == '__main__':
    unittest.main()
