"""תמונת־מצב של בקשות התרגום (PR 1.1 של ניתוח הסרטונים, 9/11/2026): הקבלה — בקשות התרגום זהות, בייט בבייט, לקוד
שלפני ההרחבה של llm.py (תמונות, Structured Outputs, Citations ותפקידי vi). snap(llm) מריץ סדרה קבועה של קריאות
תרגום מול לקוח מדומה ומחזיר את כל הבקשות שנשלחו, כ־JSON ממוין. הקובץ fixtures/llm_req_snapshot.json נוצר מהקוד הישן;
test_llm_vi משווה אליו. שינוי מכוון בבקשות התרגום = ליצור מחדש (python3 tests/llm_snap.py --write) ולהסביר ב־PR."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path
from types import SimpleNamespace as NS

FIX = Path(__file__).resolve().parent / 'fixtures' / 'llm_req_snapshot.json'


def _msg(text='ok', stop='end_turn', mid=None, cr=0):
    u = NS(input_tokens=100, output_tokens=50, cache_read_input_tokens=cr, cache_creation_input_tokens=0, cache_creation=None)
    return NS(content=[NS(type='text', text=text)], stop_reason=stop, usage=u, id=mid, diagnostics=None)


class _Client:
    def __init__(self, replies):
        self.replies = list(replies)
        self.calls = []
        self.counts = []
        self.messages = self

    def stream(self, **kw):
        self.calls.append(json.loads(json.dumps(kw, ensure_ascii=False)))
        r = self.replies.pop(0) if self.replies else _msg()

        class S:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def get_final_message(self):
                return r
        return S()

    def count_tokens(self, **kw):
        self.counts.append(json.loads(json.dumps(kw, ensure_ascii=False)))
        return NS(input_tokens=1234)


def snap(llm) -> dict:
    out = {}
    llm.MID_RETRY_WAIT = (0, 0)
    for mode in sorted(llm.MODES):
        c = _Client([_msg(mid='m1'), _msg(mid='m2', cr=10), _msg(mid='m3', cr=10)])
        e = llm.Engine(llm.Spec.of(mode), client=c, transport='api')
        e.complete('main', 'מדריך קבוע', 'הגהה')
        e.complete('tl', 'מדריך קבוע', 'חלק 1', system_extra='רק שורות #', max_tokens=16000)
        e.complete('rv', 'מדריך אחר', 'ביקורת')
        out[mode] = c.calls
    c = _Client([])
    e = llm.Engine(llm.Spec.of('haiku-high'), client=c, transport='api')
    e.role_effort = llm.norm_xe({'main': 'low', 'tl': 'max', 'rv': 'medium', 'jg': 'low'})
    for k in ('main', 'tl', 'rv'):
        e.complete(k, 'X', k)
    out['xe'] = c.calls
    c = _Client([])
    e = llm.Engine(llm.Spec('anthropic', 'claude-haiku-5-5', 'low'), client=c, transport='api')
    e.no_think = True
    e.complete('lb', 'כללים', 'רשימה', max_tokens=3000)
    out['lb'] = c.calls
    c = _Client([])
    e = llm.Engine(llm.judge_spec(), client=c, transport='api')
    e.complete('jg', 'רובריקה', 'ציון')
    out['jg'] = c.calls
    c = _Client([_msg(stop='refusal'), _msg()])
    e = llm.Engine(llm.Spec.of('haiku-medium'), client=c, transport='api')
    e.complete('tl', 'X', 'Y', system_extra='Z')
    out['refusal'] = c.calls
    c = _Client([_msg(stop='max_tokens'), _msg()])
    e = llm.Engine(llm.Spec.of('sonnet-medium'), client=c, transport='api')
    e.complete('main', 'X', 'Y', max_tokens=8000)
    out['trunc'] = c.calls
    c = _Client([])
    e = llm.Engine(llm.Spec.of('haiku-medium'), client=c, transport='api')
    e.prompt_tokens('word ' * 40000, 'x', 'y')
    out['count'] = c.counts
    kw = dict(out['haiku-high'][1])
    out['batch_key'] = llm.batch_key(llm.batch_params(kw))
    return out


def _short(o):
    """מחרוזת ארוכה (טקסט הבדיקה של כרטיס המחיר) → טביעה — הקובץ נשאר קטן, וההשוואה עדיין מדויקת."""
    if isinstance(o, str) and len(o) > 400:
        return 'sha1:' + hashlib.sha1(o.encode('utf-8')).hexdigest()
    if isinstance(o, dict):
        return {k: _short(v) for k, v in o.items()}
    if isinstance(o, list):
        return [_short(v) for v in o]
    return o


def dump(obj) -> str:
    return json.dumps(_short(obj), ensure_ascii=False, sort_keys=True, indent=1) + '\n'


if __name__ == '__main__':
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    import llm  # noqa: E402
    s = dump(snap(llm))
    if '--write' in sys.argv:
        FIX.parent.mkdir(exist_ok=True)
        FIX.write_text(s, encoding='utf-8')
        print('נכתב:', FIX, len(s))
    else:
        print('זהה' if FIX.exists() and FIX.read_text(encoding='utf-8') == s else 'שונה')
