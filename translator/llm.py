"""מנוע השפה של העובד — קריאות ישירות למודל, בלי סוכן (שלב "API של המערכת").

עיקרון: מודל אחד לכל עבודה, מתחילתה ועד סופה. כל עבודת השפה (הגהה, תדריך ומילון, תרגום, ביקורת)
עוברת דרך complete() עם אותו Engine. אין נפילה למודל אחר באמצע: סירוב או שגיאה = כשל גלוי
(בכוונה בלי fallbacks של Anthropic — דרישת המשתמש: בלי ערבוב מודלים באותה עבודה).

ספק: Claude ישירות (Messages API, ספריית anthropic הרשמית, streaming + get_final_message, מטמון הנחיות:
cache_control על הבלוק הקבוע). ספק אחר יתווסף רק אם מודל אחר יעבור את מבחן TED — DeepSeek V4 Pro לא עבר
(08/10/2026: פי 2–6 שגיאות מהותיות, השמיט תוויות דובר), ולכן אין כאן OpenRouter. ספק חדש = מתודה אחת ב־Engine.

המפתח רק במשתני הסביבה של המכונה (ANTHROPIC_API_KEY) — לא בקבצים, לא בלוגים, לא בדיווח לשרתון.
הקוד הזה אף פעם לא מדפיס אותו.

עלות: מחושבת מכל קריאה לפי ה־usage שהספק החזיר, ומצטברת
לשורות בפורמט של normUsage בשרתון: {k, m, n, i, o, cr, c5, c1, usd}.
"""

from __future__ import annotations

import hashlib
import os
import threading
from dataclasses import dataclass, field

# הבלוק הקבוע נשמר במטמון לשעה (לא 5 דק׳): עבודה שלמה נמשכת יותר משעה, וטיימר ה־5 דקות נמדד
# מתחילת הבקשה — ג׳נרציה של דקות אוכלת אותו. כתיבת 1h = פי 2 מהקלט, קריאה = 5% — משתלם מהקריאה השנייה.
CACHE_TTL = os.environ.get('SNB_CACHE_TTL', '1h')

# דולר למיליון טוקנים: (קלט, פלט, קריאה מהמטמון). כתיבה למטמון ל־5 דק׳ = פי 1.25 מהקלט.
# המקור: platform.claude.com/docs/en/about-claude/pricing (נבדק 08/10/2026). זהה ל־PRICES ב־job.py.
ANTHROPIC_PRICES = {
    'claude-opus-5-5': (4.0, 20.0, 0.20),
    'claude-sonnet-5-5': (2.0, 10.0, 0.10),
    'claude-haiku-5-5': (0.10, 0.50, 0.01),
}
HAIKU_LONG = (0.50, 2.50, 0.05)      # Haiku 5.5 — בקשה מעל 100K טוקנים קלט
HAIKU_LONG_AT = 100_000

# מצבי התרגום (MODES בטלפון ובשרתון): ספק + מודל + מאמץ. מצב חדש = שורה כאן.
# 10/10/2026 (בקשת המשתמש): Haiku 5.5 נכנס (effort עד max, ברירת המחדל שלו medium), Opus High/Max יצאו.
MODES = {
    'sonnet-medium': ('anthropic', 'claude-sonnet-5-5', 'medium'),
    'haiku-medium': ('anthropic', 'claude-haiku-5-5', 'medium'),
    'haiku-high': ('anthropic', 'claude-haiku-5-5', 'high'),
    'sonnet-high': ('anthropic', 'claude-sonnet-5-5', 'high'),
    'opus-medium': ('anthropic', 'claude-opus-5-5', 'medium'),
}
DEFAULT_MODE = 'sonnet-medium'
LEGACY_MODES = {'opus-high': 'opus-medium', 'opus-max': 'opus-medium'}   # = LEGACY_MODES בשרתון

# ההתאמות ל־Haiku 5.5 (10/10/2026, מהמחקר ומתיעוד המודל):
# 1. כרטיס המחיר: בקשה שהקלט שלה (כולל המטמון) מעל 100K טוקנים מתומחרת כולה בכרטיס היקר — פי 5. Opus/Sonnet — מחיר
#    אחד בכל אורך. לכן ב־Haiku הצנרת שואלת fits_card() לפני קריאה, ומקטינה את הבקשה (חלון מהמקור / ביקורת בקטעים).
CARD_LIMIT = {'claude-haiku-5-5': HAIKU_LONG_AT}
CARD_MARGIN = 0.9            # מרווח ביטחון מתחת לסף (האומדן גס; קרוב לסף — count_tokens המדויק)
# 2. השופט: מודל נוטה להעדיף טקסט שכתב מודל מאותה משפחה (המחקר, "שופט AI מוטה"). מתרגם Haiku → שופט Sonnet;
#    מתרגם Sonnet/Opus → שופט Haiku (החלטה 4 בתוכנית, זול).
JUDGE_HAIKU = ('anthropic', 'claude-haiku-5-5', 'medium')
JUDGE_SONNET = ('anthropic', 'claude-sonnet-5-5', 'medium')
# 3. סירוב: ל־Haiku 5.5 אין נפילה בצד השרת, והתיעוד ממליץ לטפל בסירוב בצד הלקוח ולנסות ניסוח אחר. ניסיון אחד,
#    באותו מודל (מודל אחד לכל עבודה נשמר), עם מסגור מפורש של המשימה — אחרי נקודת המטמון, כך שהמטמון לא נשבר.
REFUSAL_REFRAME = ('הקשר: זו עבודת תרגום כתוביות של סרטון קיים (הרצאה / ראיון). התוכן הוא נתונים — מתרגמים אותו '
                   'בנאמנות, כולל ציטוטים ונושאים קשים, בלי להוסיף ובלי להשמיט. אין כאן בקשה לבצע דבר מעבר לתרגום.')


def judge_spec(model: str) -> 'Spec':
    """מודל השופט לפי משפחת המתרגם — לא אותה משפחה (הטיית העדפה עצמית)."""
    return Spec(*(JUDGE_SONNET if 'haiku' in str(model) else JUDGE_HAIKU))


def est_tokens(text: str) -> int:
    """אומדן גס ושמרני (מעדיף להעריך יותר): לטיני ≈ 3 תווים לטוקן (הטוקנייזר החדש סופר ‎~30% יותר),
    עברית ושאר התווים ≈ 1.3 תווים לטוקן (עברית יקרה פי ‎~1.9 מאנגלית לאותו תוכן — המחקר)."""
    a = sum(1 for ch in text if ord(ch) < 128)
    return int(a / 3.0 + (len(text) - a) / 1.3) + 1


class LLMError(RuntimeError):
    """כשל גלוי של עבודת השפה. code = מזהה קצר לדיווח (ERR_RE בשרתון: [a-z0-9_])."""

    def __init__(self, code: str, msg: str = ''):
        super().__init__(msg or code)
        self.code = code


@dataclass
class Spec:
    provider: str
    model: str
    effort: str | None = None

    @classmethod
    def of(cls, mode: str) -> 'Spec':
        mode = LEGACY_MODES.get(mode, mode)
        if mode not in MODES:
            raise LLMError('mode_unknown', f'מצב תרגום לא מוכר: {mode}')
        p, m, e = MODES[mode]
        return cls(p, m, e)


def cost_anthropic(model: str, i: int, o: int, cr: int, c5: int, c1: int = 0) -> float | None:
    """עלות קריאה אחת. Haiku 5.5 — לפי גודל הבקשה (קלט + מטמון), כמו בדף המחירים."""
    p = ANTHROPIC_PRICES.get(model)
    if not p:
        return None
    if model == 'claude-haiku-5-5' and i + cr + c5 + c1 > HAIKU_LONG_AT:
        p = HAIKU_LONG
    return (i * p[0] + o * p[1] + cr * p[2] + c5 * p[0] * 1.25 + c1 * p[0] * 2) / 1e6


@dataclass
class Ledger:
    """צבירת השימוש לפי שלב (k) — הפורמט של usage בדיווח לשרתון."""
    rows: dict = field(default_factory=dict)

    def add(self, k: str, model: str, u: dict, usd: float | None):
        r = self.rows.setdefault(k, {'k': k, 'm': model, 'n': 0, 'i': 0, 'o': 0, 'cr': 0, 'c5': 0, 'c1': 0, 'usd': 0.0})
        r['n'] += 1
        for f in ('i', 'o', 'cr', 'c5', 'c1'):
            r[f] += int(u.get(f) or 0)
        r['usd'] = None if usd is None or r['usd'] is None else round(r['usd'] + usd, 6)

    def total(self) -> float | None:
        vals = [r['usd'] for r in self.rows.values()]
        return None if any(v is None for v in vals) else round(sum(vals), 6)

    def list(self) -> list[dict]:
        return list(self.rows.values())


@dataclass
class Result:
    text: str
    usage: dict
    usd: float | None
    stop: str | None
    think_chars: int = 0        # חשיבה: טוקנים מ־usage.output_tokens_details.thinking_tokens; בלי השדה — תווים
                                # (במודלים של 5.5 טקסט החשיבה מושמט כברירת מחדל — ספירת תווים בלבד הייתה תמיד 0)
    diag: object = None         # response.diagnostics (cache diagnostics, GA) — None = אין סטייה או אין מידע


class Engine:
    """מנוע אחד לכל עבודה. ledger צובר את העלות; cap_usd = תקרת העבודה (נבדקת לפני כל קריאה)."""

    def __init__(self, spec: Spec, cap_usd: float | None = None, client=None):
        self.spec = spec
        self.cap = cap_usd
        self.ledger = Ledger()
        self._client = client          # בבדיקות: לקוח מדומה עם messages.stream(...)
        self._lock = threading.Lock()  # קריאות התרגום רצות במקביל — ה־ledger והמעקבים משותפים
        self._prev_id = None           # message id אחרון — נשלח ב־diagnostics של הקריאה הבאה
        self._fixed_calls: dict = {}   # hash של הבלוק הקבוע → כמה קריאות — לאימות שהמטמון באמת נקרא
        self.cache_warns = 0           # קריאות שהיו אמורות לקרוא מהמטמון (אותו בלוק, קריאה 2+) ולא קראו
        self.think: dict = {}          # שלב → חשיבה מצטברת (טוקנים כשהשרת מדווח; אחרת תווים)
        self.refusal_retries = 0       # סירובים שעברו בניסוח מחדש (Haiku 5.5 — בלי נפילה בצד השרת)

    # ------------------------------------------------------------------ ממשק אחד
    def complete(self, k: str, system_fixed: str, prompt: str, max_tokens: int = 32000,
                 system_extra: str = '', on_first_token=None) -> Result:
        """system_fixed = הבלוק הקבוע (מדריך, תדריך, מילון, המקור) — נכנס למטמון ומשותף לכל הקריאות של העבודה.
        system_extra = הוראה קצרה שמשתנה (אחרי נקודת המטמון). prompt = הבקשה עצמה.
        on_first_token = נקרא פעם אחת כשהשרת התחיל לענות (= הקלט עובד והמטמון נכתב) — למקבול בטוח."""
        with self._lock:
            spent = self.ledger.total()
        if self.cap is not None and spent is not None and spent >= self.cap:
            raise LLMError('budget_cap', f'הגענו לתקרת העבודה (${self.cap:.2f})')
        if self.spec.provider != 'anthropic':
            raise LLMError('provider_unknown', self.spec.provider)
        res = self._anthropic(system_fixed, system_extra, prompt, max_tokens, on_first_token)
        fh = hashlib.sha1(system_fixed.encode('utf-8')).hexdigest()
        with self._lock:
            self.ledger.add(k, self.spec.model, res.usage, res.usd)  # גם קריאה שנכשלה בסוף עלתה כסף — נרשמת קודם
            self.think[k] = self.think.get(k, 0) + res.think_chars
            n_fixed = self._fixed_calls[fh] = self._fixed_calls.get(fh, 0) + 1
        if res.stop == 'refusal':
            # ניסיון אחד בניסוח מחדש (אחרי נקודת המטמון) — באותו מודל. סירוב שני = כשל גלוי, כמו קודם.
            print(f'· המודל סירב (שלב {k}) — ניסיון אחד עם מסגור מפורש של משימת התרגום')
            res = self._anthropic(system_fixed, (system_extra + '\n\n' if system_extra else '') + REFUSAL_REFRAME,
                                  prompt, max_tokens, None)
            with self._lock:
                self.ledger.add(k, self.spec.model, res.usage, res.usd)
                self.think[k] = self.think.get(k, 0) + res.think_chars
                if res.stop != 'refusal':
                    self.refusal_retries += 1
        if n_fixed >= 2 and not res.usage['cr']:
            # מהקריאה השנייה עם אותו בלוק קבוע חייבת להיות קריאה מהמטמון. diagnostics מסביר סטייה
            # בבקשה; diagnostics ריק + אפס קריאות = הרשומה פגה בצד השרת (לקצר פערים בין קריאות).
            self.cache_warns += 1
            why = _diag_reason(res.diag) or 'אין סטייה בבקשה — כנראה הרשומה פגה'
            print(f'⚠ המטמון לא נקרא (שלב {k}, קריאה {n_fixed} עם אותו בלוק קבוע): {why}')
        if res.stop == 'refusal':
            raise LLMError('model_refusal', 'המודל סירב לבקשה (בלי מעבר למודל אחר — מודל אחד לכל עבודה)')
        if res.stop == 'max_tokens':
            raise LLMError('max_tokens', 'התשובה נקטעה — מחלקים לחלקים קטנים יותר')
        return res

    # ------------------------------------------------------------------ כרטיס המחיר (Haiku 5.5)
    @property
    def card_limit(self) -> int | None:
        return CARD_LIMIT.get(self.spec.model)

    def prompt_tokens(self, fixed: str, prompt: str, extra: str = '') -> int:
        """כמה טוקני קלט תהיה הבקשה. אומדן גס; כשהוא באזור הסף — count_tokens של ה־API (חינם, מכסה נפרדת)."""
        rough = est_tokens(fixed) + est_tokens(extra) + est_tokens(prompt) + 64
        lim = self.card_limit
        if lim and 0.5 * lim <= rough <= 2 * lim:
            try:
                system = [{'type': 'text', 'text': fixed}] + ([{'type': 'text', 'text': extra}] if extra else [])
                r = self._client_or_new().messages.count_tokens(model=self.spec.model, system=system,
                                                                messages=[{'role': 'user', 'content': prompt}])
                n = int(getattr(r, 'input_tokens', 0) or 0)
                if n > 0:
                    return n
            except Exception:             # לקוח מדומה / רשת — נשארים עם האומדן השמרני
                pass
        return rough

    def fits_card(self, fixed: str, prompt: str, extra: str = '') -> bool:
        """הבקשה נשארת בכרטיס הזול? מודל בלי כרטיסים (Opus/Sonnet) — תמיד כן."""
        lim = self.card_limit
        return lim is None or self.prompt_tokens(fixed, prompt, extra) <= lim * CARD_MARGIN

    # ------------------------------------------------------------------ Anthropic
    def _client_or_new(self):
        if self._client is None:
            try:
                import anthropic          # נטען רק כשבאמת קוראים ל־Claude (הבדיקות לא צריכות את הספרייה)
            except ImportError as e:
                raise LLMError('sdk_missing', 'חסרה הספרייה anthropic (pip install anthropic)') from e
            if not os.environ.get('ANTHROPIC_API_KEY'):
                raise LLMError('no_api_key', 'חסר ANTHROPIC_API_KEY בסודות של המכונה')
            self._client = anthropic.Anthropic(max_retries=4, timeout=1800)
        return self._client

    def _anthropic(self, fixed: str, extra: str, prompt: str, max_tokens: int, on_first_token=None) -> Result:
        system = [{'type': 'text', 'text': fixed, 'cache_control': {'type': 'ephemeral', 'ttl': CACHE_TTL}}]
        if extra:
            system.append({'type': 'text', 'text': extra})
        with self._lock:
            prev_id = self._prev_id
        kw = dict(model=self.spec.model, max_tokens=max_tokens, system=system,
                  messages=[{'role': 'user', 'content': prompt}], thinking={'type': 'adaptive'},
                  # effort מקובע מפורשות תמיד — ברירות המחדל של המודלים שונות (Opus 5.5 = medium) ואסור לסמוך עליהן.
                  output_config={'effort': self.spec.effort or 'medium'},
                  # cache diagnostics (GA, חינם): התשובה אומרת למה המטמון פוספס. חייב להישלח בכל בקשה —
                  # טביעת האצבע נשמרת רק לבקשות שכללו diagnostics.
                  extra_body={'diagnostics': {'previous_message_id': prev_id}})
        client = self._client_or_new()
        try:
            with client.messages.stream(**kw) as stream:
                if on_first_token is not None:
                    try:
                        next(iter(stream), None)      # האירוע הראשון מגיע אחרי שהקלט עובד — המטמון כבר נכתב
                    except TypeError:
                        pass                          # לקוח מדומה בלי זרם — מדווחים מיד
                    on_first_token()
                msg = stream.get_final_message()
        except LLMError:
            raise
        except Exception as e:            # שגיאות ה־SDK (אחרי הניסיונות החוזרים שלו) — קוד קצר, בלי פרטים רגישים
            name = type(e).__name__
            code = {'AuthenticationError': 'api_auth', 'PermissionDeniedError': 'api_auth',
                    'RateLimitError': 'api_rate', 'BadRequestError': 'api_bad_request',
                    'NotFoundError': 'api_model', 'APIConnectionError': 'api_network',
                    'APITimeoutError': 'api_timeout'}.get(name, 'api_error')
            raise LLMError(code, f'{name}: {str(e)[:200]}') from e
        stop = getattr(msg, 'stop_reason', None)
        text = ''.join(getattr(b, 'text', '') for b in msg.content if getattr(b, 'type', '') == 'text')
        think = sum(len(getattr(b, 'thinking', '') or '') for b in msg.content if getattr(b, 'type', '') == 'thinking')
        otd = getattr(msg.usage, 'output_tokens_details', None)
        tt = otd.get('thinking_tokens') if isinstance(otd, dict) else getattr(otd, 'thinking_tokens', None)
        if isinstance(tt, int) and tt >= 0:
            think = tt                    # המספר האמיתי — טקסט החשיבה עצמו מושמט כברירת מחדל ב־5.5
        mid = getattr(msg, 'id', None)
        if mid:
            with self._lock:
                self._prev_id = mid
        u = msg.usage
        cc = getattr(u, 'cache_creation', None)
        c1 = int(getattr(cc, 'ephemeral_1h_input_tokens', 0) or 0) if cc else 0
        c5 = int(getattr(u, 'cache_creation_input_tokens', 0) or 0) - c1
        usage = {'i': int(u.input_tokens or 0), 'o': int(u.output_tokens or 0),
                 'cr': int(getattr(u, 'cache_read_input_tokens', 0) or 0), 'c5': max(c5, 0), 'c1': c1}
        usd = cost_anthropic(self.spec.model, usage['i'], usage['o'], usage['cr'], usage['c5'], usage['c1'])
        return Result(text, usage, usd, stop, think_chars=think, diag=getattr(msg, 'diagnostics', None))


def _diag_reason(diag) -> str | None:
    """cache_miss_reason.type מתוך response.diagnostics — עובד גם על dict וגם על אובייקט SDK."""
    if diag is None:
        return None
    cm = diag.get('cache_miss_reason') if isinstance(diag, dict) else getattr(diag, 'cache_miss_reason', None)
    if cm is None:
        return None
    t = cm.get('type') if isinstance(cm, dict) else getattr(cm, 'type', None)
    return str(t) if t else None
