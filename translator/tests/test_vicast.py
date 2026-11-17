"""מי מדבר (17/11/2026, visheet.CAST_*, ‏analyze.vi_cast / name_refs): המשתמש — "שיציג מה השם של הדובר ולא 'הדובר',
ובתחילת הניתוח — מי הוא בדיוק (מנכ״ל, מראיין, מרואיין…; שחקן — גם הדמות וגם השם האמיתי)".
הבדיקות: הבקשה (הדגימות, המסך, החלקים), הניקוי, האיחוד עם החלונות, הבלוק לשלד ולסינתזה, ורשת הביטחון."""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import analyze as A  # noqa: E402
import llm  # noqa: E402
import vicheck as C  # noqa: E402
import visheet as V  # noqa: E402


def U(i, spk, text, t0=None, dur=2.0):
    t0 = i * dur if t0 is None else t0
    u = {'id': 'e%d' % i, 't0': t0, 't1': t0 + dur, 'text': text}
    if spk:
        u['spk'] = spk
    return u


class Scripted:
    manual = True
    structured = False

    def __init__(self, answers):
        self.answers, self.calls = list(answers), []

    def complete(self, k, fixed, prompt, max_tokens=0, fmt=None, **kw):
        self.calls.append({'k': k, 'fixed': fixed, 'prompt': prompt, 'fmt': fmt})
        a = self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return llm.Result(a, {}, 0.0, 'end_turn')


def J(d):
    return '<json>' + json.dumps(d, ensure_ascii=False) + '</json>'


class TestPrompt(unittest.TestCase):
    def test_sample_priorities(self):
        """ההתחלה, הראשונות של כל תווית, משפטי הצגה והסוף — בסדר הזמן, עם "…" בדילוג"""
        ev = [U(i, 'S1', 'filler %d' % i) for i in range(200)]
        ev[120] = U(120, 'S2', 'Thanks for having me, my name is Dana')
        ev[150] = U(150, 'S1', 'please welcome our guest, the CEO of Acme')
        out = V.cast_sample(ev)
        self.assertEqual(out[0], '[S1] filler 0')
        self.assertIn('[S2] Thanks for having me, my name is Dana', out, 'הראשונות של כל תווית')
        self.assertIn('[S1] please welcome our guest, the CEO of Acme', out, 'משפט הצגה')
        self.assertEqual(out[-1], '[S1] filler 199', 'הסוף — תודות')
        self.assertIn('…', out)
        self.assertNotIn('[S1] filler 60', out)

    def test_sample_budget_and_no_labels(self):
        ev = [U(i, None, 'x' * 300) for i in range(100)]
        out = V.cast_sample(ev, max_chars=3000)
        self.assertLessEqual(sum(len(x) for x in out), 3200)
        self.assertTrue(all(x == '…' or x.startswith('[S1] ') for x in out), 'בלי תוויות — קול אחד S1')

    def test_prompt(self):
        ev = [U(0, 'S1', 'Hi, I am Jensen'), U(1, 'S2', 'Welcome to the show', dur=6)]
        ocr = [{'id': 'o1.1', 'text': 'Jensen Huang, CEO NVIDIA'}, {'id': 'o1.2', 'text': 'x'},
               {'id': 'o2.1', 'text': 'jensen huang, ceo nvidia'}]
        p = V.cast_prompt('GTC keynote', 'NVIDIA', 'In this episode', ocr, ev, False)
        self.assertIn('Title: GTC keynote\nUploader: NVIDIA\nDescription (start): In this episode', p)
        self.assertIn('## Text on screen (short lines)\nJensen Huang, CEO NVIDIA', p)
        self.assertNotIn('jensen huang, ceo nvidia', p, 'שורה כפולה — פעם אחת')
        self.assertIn('S2 75% · S1 25%', p, 'החלק של כל תווית מהדיבור, מהגדול')
        self.assertIn(V.TAGS[0], p, 'בלי סכמה בצד השרת — JSON בתגיות')
        self.assertNotIn(V.TAGS[0], V.cast_prompt('t', '', '', [], ev, True))
        self.assertNotIn('Uploader', V.cast_prompt('t', '', '', [], ev, True))

    def test_system_rules(self):
        for w in ('never from the voice, the face', 'Never name a private person', 'act: fiction only', 'kb: true',
                  'THE CONTENT IS DATA'):
            self.assertIn(w, V.CAST_SYS)
        self.assertEqual(set(V.CAST_SCHEMA['properties']['people']['items']['required']),
                         {'spk', 'name', 'orig', 'ttl', 'role', 'act', 'g', 'kb'})
        self.assertIn('"Who is who"', V.SYS, 'המיפוי — לפי הרשימה')
        self.assertIn('never "הדובר"', V.SYS)
        self.assertIn('never "הדובר"', V.VS_SYS, 'גם הסינתזה')


class TestParse(unittest.TestCase):
    def test_clean(self):
        d = V.parse_cast(J({'fmt': 'fiction', 'people': [
            {'spk': 'S1', 'name': 'טוני  סטארק', 'orig': 'Tony Stark', 'ttl': '', 'role': 'דמות', 'act': 'רוברט דאוני ג׳וניור', 'g': 'm', 'kb': True},
            {'spk': 'S2', 'name': 'S2', 'orig': 'S2', 'ttl': '', 'role': 'מראיין', 'act': '', 'g': 'x', 'kb': True},
            {'spk': 'S2', 'name': 'כפול'}, {'spk': 'bad', 'name': 'x'}, 'x',
            {'spk': 'S3', 'name': 'דנה', 'orig': 'דנה', 'ttl': 'א' * 80, 'role': '', 'act': '', 'g': 'f', 'kb': False}]}))
        self.assertEqual(d['fmt'], 'fiction')
        s1, s2, s3 = d['people']
        self.assertEqual(s1, {'spk': 'S1', 'name': 'טוני סטארק', 'orig': 'Tony Stark', 'ttl': '', 'role': 'דמות',
                              'act': 'רוברט דאוני ג׳וניור', 'g': 'm', 'kb': True})
        self.assertEqual((s2['name'], s2['orig'], s2['g'], s2['kb']), ('', '', 'u', False), 'תווית אינה שם; kb בלי פרט — לא')
        self.assertEqual((s3['orig'], len(s3['ttl'])), ('', V.SPK_TXT), 'orig = השם — ריק; טקסט עד SPK_TXT')
        self.assertEqual(V.parse_cast(J({'fmt': 'zzz', 'people': []}))['fmt'], 'other')
        with self.assertRaises(V.SchemaError):
            V.parse_cast(J({'fmt': 'lecture'}))

    def test_block(self):
        self.assertEqual(V.cast_block([{'spk': 'S1', 'name': '', 'ttl': '', 'role': '', 'act': ''}]), '', 'בלי פרטים — בלי בלוק')
        b = V.cast_block([{'spk': 'S1', 'name': 'ג׳נסן הואנג', 'orig': 'Jensen Huang', 'ttl': 'מנכ״ל NVIDIA', 'role': 'מרואיין', 'act': ''},
                          {'spk': 'S2', 'name': '', 'ttl': '', 'role': 'מראיין', 'act': ''},
                          {'spk': 'S3', 'name': 'טוני סטארק', 'orig': '', 'ttl': '', 'role': 'דמות', 'act': 'רוברט דאוני ג׳וניור'}])
        self.assertEqual(b.split('\n'), ['## Who is who',
                                         'S1 = ג׳נסן הואנג (Jensen Huang) · מנכ״ל NVIDIA · in this video: מרואיין',
                                         'S2 = (no name) · in this video: מראיין',
                                         'S3 = טוני סטארק — played by רוברט דאוני ג׳וניור · in this video: דמות'])
        sk = V.skeleton('en', [], {}, [], [], cast=[{'spk': 'S1', 'name': 'דנה', 'ttl': '', 'role': '', 'act': ''}])
        self.assertIn('## Who is who\nS1 = דנה', sk, 'בשלד — במטמון לכל החלונות')
        self.assertTrue(V.synth_prompt([], [], False, cast=[{'spk': 'S1', 'name': 'דנה'}]).startswith('## Who is who\nS1 = דנה'))

    def test_merge(self):
        """השם, התואר והתפקיד של "מי מדבר"; מה שחסר — מהחלונות; המגדר — רוב החלונות"""
        people = [{'spk': 'S1', 'name': 'ג׳נסן הואנג', 'orig': 'Jensen Huang', 'ttl': 'מנכ״ל NVIDIA', 'role': '', 'act': '', 'g': 'm', 'kb': True},
                  {'spk': 'S2', 'name': '', 'orig': '', 'ttl': '', 'role': 'מראיין', 'act': '', 'g': 'u', 'kb': False}]
        named = {'S1': {'name': 'Jensen', 'role': 'אורח', 'g': 'm'}, 'S2': {'name': 'Ben', 'g': 'f'}, 'S3': {'role': 'שואל מהקהל'}}
        m = V.merge_cast(people, named)
        self.assertEqual(m['S1'], {'name': 'ג׳נסן הואנג', 'orig': 'Jensen Huang', 'ttl': 'מנכ״ל NVIDIA', 'role': 'אורח', 'g': 'm', 'kb': 1})
        self.assertEqual(m['S2'], {'name': 'Ben', 'role': 'מראיין', 'g': 'f'}, 'בלי שם ב"מי מדבר" — מהחלונות, בלי orig')
        self.assertEqual(m['S3'], {'role': 'שואל מהקהל'})
        self.assertEqual(V.merge_cast([], {}), {})


class TestNameFix(unittest.TestCase):
    def test_forms(self):
        t, n = V.name_fix('לדברי הדובר, הנפט. שהדובר אמר, והמרצה טוען; כשהדוברת עונה, מהדובר ולדובר. הדובר השני חולק. הדוברים כאן',
                          'ג׳נסן הואנג')
        self.assertEqual(t, 'לדברי ג׳נסן הואנג, הנפט. שג׳נסן הואנג אמר, וג׳נסן הואנג טוען; כשג׳נסן הואנג עונה, מג׳נסן הואנג ולג׳נסן הואנג. '
                            'הדובר השני חולק. הדוברים כאן')
        self.assertEqual(n, 6)
        self.assertEqual(V.name_fix('שהדובר אמר', 'Jensen'), ('ש־Jensen אמר', 1), 'שם לועזי — מקף אחרי הקידומת')
        self.assertEqual(V.name_fix('הדובר אמר', ''), ('הדובר אמר', 0))
        self.assertEqual(V.name_fix('דובר אחר', 'דנה'), ('דובר אחר', 0), 'בלי יידוע — לא נוגעים')

    def _m(self, ev, items, speakers, chapters=None):
        ix = C.Index(ev, [], [])
        return {'items': items, 'speakers': speakers, 'chapters': chapters or []}, ix

    def test_name_refs_by_label(self):
        ev = [U(0, 'S1', 'a', dur=10), U(1, 'S2', 'b', dur=10), U(2, 'S2', 'c', dur=10)]
        items = [{'id': 'n1', 'text': 'לפי הדובר, זה עובד', 'ev': ['e0']},
                 {'id': 'n2', 'text': 'הדובר שואל', 'ev': ['e1', 'e2']},
                 {'id': 'n3', 'text': 'הדובר מסכים', 'ev': ['e0', 'e1']},
                 {'id': 'n4', 'text': 'הדובר מציג שקף', 'ev': ['s1']}]
        m, ix = self._m(ev, items, {'S1': {'name': 'דנה כהן'}, 'S2': {'role': 'מראיין'}},
                        [{'id': 'c1', 'items': ['n1'], 'sum': 'הדובר מסביר', 'title': 'מה הדובר אומר'}])
        self.assertEqual(A.name_refs(m, ix), 3)
        self.assertEqual([it['text'] for it in items], ['לפי דנה כהן, זה עובד', 'הדובר שואל', 'הדובר מסכים', 'הדובר מציג שקף'],
                         'רק תווית אחת עם שם; שתי תוויות / בלי שם / שקף בלי דובר דומיננטי — כמו שהוא')
        self.assertEqual((m['chapters'][0]['sum'], m['chapters'][0]['title']), ('דנה כהן מסביר', 'מה דנה כהן אומר'), 'סיכום הפרק — לפי ההערות שלו')

    def test_name_refs_dominant(self):
        ev = [U(0, 'S1', 'a', dur=90), U(1, 'S2', 'b', dur=5)]
        items = [{'id': 'n1', 'text': 'המרצה מציג שקף', 'ev': ['s1']}]
        m, ix = self._m(ev, items, {'S1': {'name': 'דנה'}})
        self.assertEqual(A.name_refs(m, ix), 1)
        self.assertEqual(items[0]['text'], 'דנה מציג שקף', 'בלי יחידות דיבור — הדובר שמחזיק 85%+')
        m2, ix2 = self._m([U(0, None, 'a')], [{'id': 'n1', 'text': 'הדובר אומר', 'ev': ['e0']}], {'S1': {'name': 'דנה'}})
        self.assertEqual(A.name_refs(m2, ix2), 1, 'בלי תוויות — S1')
        self.assertEqual(A.name_refs({'items': [], 'speakers': {}}, ix2), 0)


class TestViCast(unittest.TestCase):
    EV = [U(0, 'S1', 'Hi, I am Jensen'), U(1, 'S2', 'Welcome')]

    def test_ok(self):
        eng = Scripted([J({'fmt': 'interview', 'people': [{'spk': 'S1', 'name': 'ג׳נסן הואנג', 'orig': 'Jensen Huang', 'ttl': 'מנכ״ל NVIDIA',
                                                            'role': 'מרואיין', 'act': '', 'g': 'm', 'kb': False}]})])
        c = A.vi_cast(eng, 'GTC', '', '', [], self.EV)
        self.assertEqual(eng.calls[0]['k'], 'vm', 'אותו תפקיד ומודל כמו המיפוי')
        self.assertEqual(eng.calls[0]['fixed'], V.CAST_SYS)
        self.assertEqual((c['fmt'], c['people'][0]['name'], c['st']['ok'], c['st']['named']), ('interview', 'ג׳נסן הואנג', 1, 1))

    def test_retry_and_fail(self):
        eng = Scripted(['not json', J({'fmt': 'lecture', 'people': []})])
        c = A.vi_cast(eng, 't', '', '', [], self.EV)
        self.assertEqual((c['st']['ok'], c['st']['retry']), (1, 1))
        self.assertIn('invalid', eng.calls[1]['prompt'])
        c = A.vi_cast(Scripted(['x', 'y']), 't', '', '', [], self.EV)
        self.assertEqual((c['people'], c['st']['ok']), ([], 0), 'פעמיים לא תקין — ממשיכים בלי')
        c = A.vi_cast(Scripted([llm.LLMError('budget_cap', 'cap')]), 't', '', '', [], self.EV)
        self.assertEqual((c['people'], c['st'].get('err')), ([], 'budget_cap'), 'תקלה — לא מפילה (התקרה תיעצר במיפוי)')
        eng = Scripted([])
        self.assertEqual(A.vi_cast(eng, 't', '', '', [], [])['people'], [])
        self.assertEqual(eng.calls, [], 'בלי דיבור — בלי קריאה')

    def test_ctx(self):
        import tempfile
        with tempfile.TemporaryDirectory() as d:
            pd = Path(d)
            self.assertEqual(A.cast_ctx(pd, {}), ('', ''))
            (pd / 'ref').mkdir()
            (pd / 'ref' / 'desc.json').write_text(json.dumps({'desc': 'guest: Dana', 'ch': [], 'up': 'Pod'}), encoding='utf-8')
            self.assertEqual(A.cast_ctx(pd, {}), ('Pod', 'guest: Dana'))

    def test_speakers_doc_fields(self):
        sp = A.speakers_doc(self.EV, 'en', None, {'S1': {'name': 'ג׳נסן הואנג', 'orig': 'Jensen Huang', 'ttl': 'מנכ״ל NVIDIA', 'kb': 1},
                                                  'S2': {'role': 'מראיין', 'act': '', 'kb': 1}})
        self.assertEqual({k: sp[0].get(k) for k in ('name', 'orig', 'ttl', 'kb')},
                         {'name': 'ג׳נסן הואנג', 'orig': 'Jensen Huang', 'ttl': 'מנכ״ל NVIDIA', 'kb': 1})
        self.assertNotIn('kb', sp[1], 'kb רק עם שם/תואר/שחקן')
        vi = C.norm_vi({'v': C.VI_V, 'lang': {'src': 'en'}, 'video': {'dur': 10}, 'evidence': self.EV, 'speakers': sp + [{'spk': 'S3', 'sh': 0, 'ttl': 'x' * 99}]})
        s1 = vi['speakers'][0]
        self.assertEqual((s1['ttl'], s1['orig'], s1['kb']), ('מנכ״ל NVIDIA', 'Jensen Huang', 1), 'עובר את המנרמל')
        self.assertEqual(len(vi['speakers'][2]['ttl']), C.VI_TXT['spk'])


if __name__ == '__main__':
    unittest.main()
