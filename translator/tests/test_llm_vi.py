"""ניתוח סרטונים, PR 1.1 (9/11/2026): llm.py — תמונות, Structured Outputs, Citations ותפקידי הניתוח.
לקוח Claude מדומה בלבד — בלי רשת, בלי מפתחות ובלי עלות. הקבלה: בקשות התרגום זהות בייט בבייט לקוד הקודם."""

from __future__ import annotations

import base64
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import llm  # noqa: E402
import llm_snap  # noqa: E402
from test_llm import FakeClient, fake_msg  # noqa: E402

llm.MID_RETRY_WAIT = (0, 0)


def png(w, h):
    raw = b'\x89PNG\r\n\x1a\n' + (13).to_bytes(4, 'big') + b'IHDR' + w.to_bytes(4, 'big') + h.to_bytes(4, 'big') + b'\x08\x02\0\0\0' + b'\0' * 40
    return base64.b64encode(raw).decode()


def jpeg(w, h):
    app0 = b'\xff\xe0' + (16).to_bytes(2, 'big') + b'JFIF\0' + b'\x01\x01\0\0\x01\0\x01\0\0'
    sof = b'\xff\xc0' + (17).to_bytes(2, 'big') + b'\x08' + h.to_bytes(2, 'big') + w.to_bytes(2, 'big') + b'\x03' + b'\0' * 9
    return base64.b64encode(b'\xff\xd8' + app0 + sof + b'\0' * 40).decode()


def img(data, mt='image/png'):
    return {'type': 'image', 'source': {'type': 'base64', 'media_type': mt, 'data': data}}


def cite_msg(blocks, stop='end_turn'):
    u = NS(input_tokens=10, output_tokens=5, cache_read_input_tokens=0, cache_creation_input_tokens=0, cache_creation=None)
    return NS(content=blocks, stop_reason=stop, usage=u, id='m', diagnostics=None)


class TranslationSnapshotTests(unittest.TestCase):
    def test_translation_requests_byte_identical(self):
        """הקבלה של PR 1.1: כל בקשות התרגום (כל המצבים, ניסוי המאמץ, שבירת שורות, השופט, סירוב, קטיעה, count_tokens,
        טביעת התור) זהות לתמונת־המצב שנוצרה מהקוד שלפני ההרחבה."""
        self.assertTrue(llm_snap.FIX.exists())
        got = llm_snap.dump(llm_snap.snap(llm))
        self.assertEqual(got, llm_snap.FIX.read_text(encoding='utf-8'),
                         'בקשת תרגום השתנתה — שינוי מכוון = python3 tests/llm_snap.py --write, והסבר ב־PR')


class RoleTests(unittest.TestCase):
    def test_vi_roles_in_effort_keys(self):
        self.assertEqual(llm.VI_ROLES, ('vm', 'vs', 'vv', 'vl', 'vx', 'vc'))
        self.assertEqual(llm.ROLE_EFFORT_KEYS[:3], ('main', 'tl', 'rv'), 'הסדר של התרגום נשמר')
        self.assertEqual(llm.norm_xe({'vm': 'low', 'vv': 'max', 'vq': 'low', 'vs': 'huge'}), {'vm': 'low', 'vv': 'max'})

    def test_role_caps(self):
        c = FakeClient([fake_msg()] * 4)
        e = llm.Engine(llm.Spec.of('sonnet-high'), client=c, transport='api')
        for k in ('vm', 'vx', 'vs', 'vv'):
            e.complete(k, 'קבוע', 'בקשה')
        self.assertEqual([x['output_config']['effort'] for x in c.calls], ['medium', 'low', 'high', 'high'],
                         'vm עד medium, vx עד low; הסינתזה במאמץ המצב במלואו')
        c = FakeClient([fake_msg()])
        e = llm.Engine(llm.Spec.of('sonnet-high'), client=c, transport='api')
        e.role_effort = llm.norm_xe({'vm': 'max'})
        e.complete('vm', 'קבוע', 'בקשה')
        self.assertEqual(c.calls[0]['output_config']['effort'], 'max', 'זרוע זהב קובעת מעל התקרה — כמו בתרגום')

    def test_ttl_per_role(self):
        c = FakeClient([fake_msg(), fake_msg()])
        e = llm.Engine(llm.Spec.of('haiku-medium'), client=c, transport='api')
        e.complete('vm', 'קידומת', 'חלון 1')
        e.complete('tl', 'מדריך', 'חלק 1')
        self.assertEqual(c.calls[0]['system'][0]['cache_control'], {'type': 'ephemeral', 'ttl': '5m'},
                         'הניתוח — 5 דק׳ (קריאות ברצף; כתיבה לשעה עולה פי 2)')
        self.assertEqual(c.calls[1]['system'][0]['cache_control'], {'type': 'ephemeral', 'ttl': llm.CACHE_TTL})

    def test_refusal_wording_per_role(self):
        c = FakeClient([fake_msg(stop='refusal'), fake_msg(), fake_msg(stop='refusal'), fake_msg()])
        e = llm.Engine(llm.Spec.of('haiku-medium'), client=c, transport='api')
        e.complete('vm', 'קבוע', 'חלון', system_extra='הוראה')
        e.complete('tl', 'קבוע', 'חלק')
        self.assertTrue(c.calls[1]['system'][-1]['text'].endswith(llm.refusal_text('vm')), 'הנוסח של התפקיד (visheet.py רשאי להחליף)')
        self.assertTrue(c.calls[1]['system'][-1]['text'].startswith('הוראה\n\n'))
        self.assertIn('ניתוח', llm.REFUSAL_REFRAME_VI)
        self.assertNotIn('כתוביות', llm.REFUSAL_REFRAME_VI)
        self.assertEqual(c.calls[3]['system'][-1]['text'], llm.REFUSAL_REFRAME)
        self.assertEqual(e.refusal_retries, 2)


class ImageTests(unittest.TestCase):
    def test_image_tokens(self):
        self.assertEqual(llm.image_tokens(1280, 720), 1196, 'התוכנית 5.5: ⌈w/28⌉×⌈h/28⌉')
        self.assertEqual(llm.image_tokens(28, 28), 1)
        self.assertEqual(llm.image_tokens(29, 1), 2)

    def test_sizes_from_headers(self):
        self.assertEqual(llm._img_size(png(1280, 720)), (1280, 720))
        self.assertEqual(llm._img_size(jpeg(1920, 1080)), (1920, 1080))
        self.assertIsNone(llm._img_size(base64.b64encode(b'GIF89a' + b'\0' * 20).decode()))
        self.assertIsNone(llm._img_size('!!!not base64'))
        self.assertEqual(llm.block_tokens(img('AAAA')), llm.image_tokens(1920, 1080), 'לא זוהה — אומדן שמרני של 1080p')

    def test_request_shape_with_images(self):
        c = FakeClient([fake_msg('{"s":[]}')])
        e = llm.Engine(llm.Spec.of('haiku-medium'), client=c, transport='api')
        p = [{'type': 'text', 'text': 'Slide 17 [23:10–25:40]'}, img(png(1280, 720)), {'type': 'text', 'text': 'תאר'}]
        e.complete('vx', 'כללים', p)
        self.assertEqual(c.calls[0]['messages'], [{'role': 'user', 'content': p}], 'הבלוקים עוברים כמו שהם')
        self.assertEqual(c.calls[0]['output_config'], {'effort': 'low'})

    def test_estimate_and_card_count_images(self):
        e = llm.Engine(llm.Spec.of('haiku-medium'), client=FakeClient([]), transport='api')
        p = [img(png(1280, 720))] * 3 + [{'type': 'text', 'text': 'abc' * 30}]
        self.assertEqual(llm.prompt_est(p), 3 * 1196 + llm.est_tokens('abc' * 30))
        self.assertEqual(e.prompt_tokens('', p), 3 * 1196 + llm.est_tokens('abc' * 30) + llm.est_tokens('') * 2 + 64)
        many = [img(png(1280, 720))] * 80               # 95,680 טוקני תמונה — מעל 90% מסף ה־100K
        self.assertFalse(e.fits_card('', many))
        self.assertTrue(e.fits_card('', many[:60]))
        self.assertTrue(llm.Engine(llm.Spec.of('opus-medium'), client=FakeClient([])).fits_card('', many), 'בלי כרטיסים')

    def test_count_tokens_gets_blocks(self):
        class C(FakeClient):
            def count_tokens(self, **kw):
                self.ct = kw
                return NS(input_tokens=77777)
        c = C([])
        e = llm.Engine(llm.Spec.of('haiku-medium'), client=c, transport='api')
        p = [img(png(1280, 720))] * 50 + [{'type': 'text', 'text': 'x', 'citations': [{'type': 'char_location'}]}]
        self.assertEqual(e.prompt_tokens('', p), 77777, 'באזור הסף — count_tokens המדויק (חינם)')
        self.assertNotIn('citations', c.ct['messages'][0]['content'][-1], 'גם בספירה — בלי ציטוטים בהודעת user')

    def test_cli_and_relay_text_only(self):
        got = []
        e = llm.Engine(llm.Spec.of('haiku-medium'), client=FakeClient([]), transport='cli')
        e._cli0 = lambda f, x, p, m, o=None: (got.append(p), llm.Result('ok', {'i': 0, 'o': 0, 'cr': 0, 'c5': 0, 'c1': 0}, 0.0, 'end_turn'))[1]
        e.complete('vv', 'כללים', [{'type': 'text', 'text': 'טענה'},
                                   {'type': 'search_result', 'source': 'u1', 'title': 'u1 [00:10]',
                                    'content': [{'type': 'text', 'text': 'ראיה'}], 'citations': {'enabled': True}}])
        self.assertEqual(got, ['טענה\n\n[u1 [00:10]]\nראיה'])
        with self.assertRaises(llm.LLMError) as cm:
            e.complete('vx', 'כללים', [img(png(10, 10))])
        self.assertEqual(cm.exception.code, 'llm_media', 'vision רק במנוע api')
        self.assertFalse(e.structured)
        self.assertTrue(llm.Engine(llm.Spec.of('haiku-medium'), client=FakeClient([]), transport='api').structured)


class StructuredTests(unittest.TestCase):
    SCHEMA = {'type': 'object', 'properties': {'ch': {'type': 'array', 'items': {'type': 'string'}}},
              'required': ['ch'], 'additionalProperties': False}

    def test_output_config_format(self):
        c = FakeClient([fake_msg('{"ch":[]}'), fake_msg('{"ch":[]}')])
        e = llm.Engine(llm.Spec.of('haiku-high'), client=c, transport='api')
        e.complete('vm', 'קידומת', 'חלון', fmt=self.SCHEMA)
        e.complete('vm', 'קידומת', 'חלון 2')
        self.assertEqual(c.calls[0]['output_config'], {'effort': 'medium', 'format': {'type': 'json_schema', 'schema': self.SCHEMA}})
        self.assertEqual(c.calls[1]['output_config'], {'effort': 'medium'}, 'הסכמה לא דולפת לקריאה הבאה')

    def test_format_kept_on_retry_and_in_batch_key(self):
        c = FakeClient([fake_msg(stop='max_tokens'), fake_msg('{"ch":[]}')])
        e = llm.Engine(llm.Spec.of('haiku-high'), client=c, transport='api')
        e.complete('vs', 'X', 'Y', max_tokens=1000, fmt=self.SCHEMA)
        self.assertEqual([x['output_config'].get('format') for x in c.calls], [llm.json_format(self.SCHEMA)] * 2,
                         'גם בניסיון עם תקרת המודל')
        kw = dict(c.calls[0])
        self.assertNotEqual(llm.batch_key(llm.batch_params(kw)), llm.batch_key(llm.batch_params({**kw, 'output_config': {'effort': 'medium'}})))

    def test_format_with_citations_fails_before_sending(self):
        c = FakeClient([])
        e = llm.Engine(llm.Spec.of('haiku-high'), client=c, transport='api')
        with self.assertRaises(llm.LLMError) as cm:
            e.complete('vv', 'X', [{'type': 'search_result', 'source': 's', 'title': 't', 'content': [{'type': 'text', 'text': 'a'}],
                                    'citations': {'enabled': True}}], fmt=self.SCHEMA)
        self.assertEqual(cm.exception.code, 'fmt_cites')
        self.assertEqual(c.calls, [])


class CitationTests(unittest.TestCase):
    def test_parse_citations(self):
        blocks = [NS(type='thinking', thinking=''), NS(type='text', text='u3|ok\n', citations=None),
                  NS(type='text', text='u7|bad', citations=[NS(type='search_result_location', search_result_index=2,
                                                                start_block_index=0, end_block_index=1, cited_text='ראיה')]),
                  NS(type='text', text='\n')]
        c = FakeClient([cite_msg(blocks)])
        e = llm.Engine(llm.Spec(*llm.JUDGE), client=c, transport='api')
        r = e.complete('vv', 'X', [{'type': 'search_result', 'source': 's', 'title': 't',
                                    'content': [{'type': 'text', 'text': 'ראיה'}], 'citations': {'enabled': True}}])
        self.assertEqual(r.text, 'u3|ok\nu7|bad\n')
        self.assertEqual(r.cites, [{'at': 6, 'n': 6, 'refs': [{'ty': 'search_result_location', 'r': 2, 'b0': 0, 'b1': 1, 'q': 'ראיה'}]}])
        self.assertEqual(r.text[6:12], 'u7|bad', 'at/n מצביעים על הבלוק המצוטט בטקסט המאוחד')

    def test_parse_from_batch_dict_and_none(self):
        m = {'content': [{'type': 'text', 'text': 'a', 'citations': [{'type': 'content_block_location', 'document_index': 1,
                                                                      'start_block_index': 3, 'end_block_index': 4, 'cited_text': 'q'}]}],
             'usage': {'input_tokens': 1, 'output_tokens': 1}, 'stop_reason': 'end_turn'}
        r = llm.msg_result(m, 'claude-haiku-5-5')
        self.assertEqual(r.cites[0]['refs'][0]['r'], 1)
        self.assertIsNone(llm.msg_result(fake_msg('x'), 'claude-haiku-5-5').cites, 'התרגום — בלי ציטוטים')

    def test_strip_citations_between_turns(self):
        prev = [{'type': 'text', 'text': 'טענה', 'citations': [{'type': 'search_result_location', 'cited_text': 'x'}]}]
        p = [{'type': 'tool_result', 'tool_use_id': 't', 'content': prev},
             {'type': 'search_result', 'source': 's', 'title': 't', 'citations': {'enabled': True},
              'content': [{'type': 'text', 'text': 'a', 'citations': [{'type': 'char_location'}]}]}] + prev
        out = llm.strip_citations(p)
        self.assertNotIn('citations', out[0]['content'][0])
        self.assertEqual(out[1]['citations'], {'enabled': True}, 'ההגדרה על search_result נשארת')
        self.assertNotIn('citations', out[1]['content'][0])
        self.assertEqual(out[2], {'type': 'text', 'text': 'טענה'})
        self.assertIn('citations', prev[0], 'המקור לא משתנה')
        c = FakeClient([fake_msg()])
        llm.Engine(llm.Spec.of('haiku-medium'), client=c, transport='api').complete('vs', 'X', p)
        self.assertEqual(c.calls[0]['messages'][0]['content'], out, 'נמחק לפני השליחה (400 מגרסת 2026-10-21)')


class ManualEngineTests(unittest.TestCase):
    def test_manual_accepts_blocks_and_fmt(self):
        asked = []
        m = llm.ManualEngine(lambda k, t: (asked.append(t), '{"ch":[]}')[1])
        r = m.complete('vm', 'קבוע', [{'type': 'text', 'text': 'חלון'}], fmt={'type': 'object'})
        self.assertEqual(r.text, '{"ch":[]}')
        self.assertTrue(asked[0].startswith('קבוע\n\nחלון'))
        self.assertFalse(m.structured)


if __name__ == '__main__':
    unittest.main()
