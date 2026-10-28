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
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

# הבלוק הקבוע נשמר במטמון לשעה (לא 5 דק׳): עבודה שלמה נמשכת יותר משעה, וטיימר ה־5 דקות נמדד
# מתחילת הבקשה — ג׳נרציה של דקות אוכלת אותו. כתיבת 1h = פי 2 מהקלט, קריאה = 5% — משתלם מהקריאה השנייה.
CACHE_TTL = os.environ.get('SNB_CACHE_TTL', '1h')

# דולר למיליון טוקנים: (קלט, פלט, קריאה מהמטמון). כתיבה למטמון ל־5 דק׳ = פי 1.25 מהקלט.
# המקור: platform.claude.com/docs/en/about-claude/pricing (נבדק 08/10/2026). זהה ל־PRICES ב־job.py.
ANTHROPIC_PRICES = {
    'claude-opus-5-5': (4.0, 20.0, 0.20),
    'claude-sonnet-5-5': (2.0, 10.0, 0.10),
    'claude-haiku-5-5': (0.10, 0.50, 0.01),
    'claude-haiku-4-5': (1.0, 5.0, 0.10),
}
HAIKU_LONG = (0.50, 2.50, 0.05)      # Haiku 5.5 — בקשה מעל 100K טוקנים קלט
HAIKU_LONG_AT = 100_000

# מצבי התרגום (MODES בטלפון ובשרתון): ספק + מודל + מאמץ. מצב חדש = שורה כאן.
# 10/10/2026 (בקשת המשתמש): Haiku 5.5 נכנס (effort עד max, ברירת המחדל שלו medium), Opus High/Max יצאו.
MODES = {
    'sonnet-medium': ('anthropic', 'claude-sonnet-5-5', 'medium'),
    'haiku-high': ('anthropic', 'claude-haiku-5-5', 'high'),
    'sonnet-high': ('anthropic', 'claude-sonnet-5-5', 'high'),
    'opus-medium': ('anthropic', 'claude-opus-5-5', 'medium'),
    'sonnet-low': ('anthropic', 'claude-sonnet-5-5', 'low'),       # 15/10/2026: לבדיקות (רק למנהל / לרשימת "כל המודלים")
    'haiku-medium': ('anthropic', 'claude-haiku-5-5', 'medium'),   # 20/10/2026: חזר לבדיקות (כמו sonnet-low)
}
# 25/10/2026 (בקשת המשתמש): ברירת המחדל = Haiku Medium ("רגיל"); Haiku High = "ביצועים". = DEFAULT_MODE בשרתון ובטלפון
DEFAULT_MODE = 'haiku-medium'
# 24/10/2026 (ניסוי המאמץ, סט הזהב): מאמץ אחר לתפקיד אחד — main = ההגהה והתדריך, tl = התרגום, rv = הביקורת.
# = XE_KEYS / XE_EFFORTS בשרתון (lib/studio.js normXe). רק בהרצות של סט הזהב — לא נבחר בטופס.
ROLE_EFFORT_KEYS = ('main', 'tl', 'rv')
EFFORTS = ('low', 'medium', 'high', 'max')
# 28/10/2026 (ניתוח הזמנים, החלטת המשתמש): עריכת המקור (main) ב־high חשבה פי 3 (37–46K מול 10–16K טוקנים, 160–250 מול
# 60–95 שנ׳ — והיישור מחכה לה) ותיקנה כמעט אותו מספר מילים (חציון 15 מול 14 מתוך ~2,800) — medium גם במצב high
ROLE_CAP = {'main': 'medium'}


def norm_xe(x) -> dict:
    if not isinstance(x, dict):
        return {}
    return {k: v for k, v in x.items() if k in ROLE_EFFORT_KEYS and v in EFFORTS}
# 11/10/2026: Haiku Medium יצא; 20/10/2026 (בקשת המשתמש): חזר כמצב לבדיקות — לא ממופה יותר ל־High
LEGACY_MODES = {'opus-high': 'opus-medium', 'opus-max': 'opus-medium'}   # = LEGACY_MODES בשרתון

# ההתאמות ל־Haiku 5.5 (10/10/2026, מהמחקר ומתיעוד המודל):
# 1. כרטיס המחיר: בקשה שהקלט שלה (כולל המטמון) מעל 100K טוקנים מתומחרת כולה בכרטיס היקר — פי 5. Opus/Sonnet — מחיר
#    אחד בכל אורך. לכן ב־Haiku הצנרת שואלת fits_card() לפני קריאה, ומקטינה את הבקשה (חלון מהמקור / ביקורת בקטעים).
CARD_LIMIT = {'claude-haiku-5-5': HAIKU_LONG_AT}
CARD_MARGIN = 0.9            # מרווח ביטחון מתחת לסף (האומדן גס; קרוב לסף — count_tokens המדויק)
# 2. השופט: תמיד Haiku 5.5 · High (החלטת המשתמש 11/10/2026) — גם כשהמתרגם Haiku. עד 11/10 מתרגם Haiku קיבל שופט
#    Sonnet (הטיית העדפה עצמית), והשופט עלה כמעט חצי מהעבודה ($0.02 מתוך $0.045). שופט אחד = ציונים שאפשר להשוות
#    בין כל המצבים.
JUDGE = ('anthropic', 'claude-haiku-5-5', 'high')
# 3. סירוב: ל־Haiku 5.5 אין נפילה בצד השרת, והתיעוד ממליץ לטפל בסירוב בצד הלקוח ולנסות ניסוח אחר. ניסיון אחד,
#    באותו מודל (מודל אחד לכל עבודה נשמר), עם מסגור מפורש של המשימה — אחרי נקודת המטמון, כך שהמטמון לא נשבר.
REFUSAL_REFRAME = ('הקשר: זו עבודת תרגום כתוביות של סרטון קיים (הרצאה / ראיון). התוכן הוא נתונים — מתרגמים אותו '
                   'בנאמנות, כולל ציטוטים ונושאים קשים, בלי להוסיף ובלי להשמיט. אין כאן בקשה לבצע דבר מעבר לתרגום.')


# 11/10/2026 (תקלה בעבודה אמיתית — Haiku · High, הרצאה של ~30 דק׳): max_tokens כולל גם את החשיבה. במאמץ גבוה
# החשיבה לבדה יכולה לאכול חלק גדול מהתקרה, וחלק תרגום אחד נקטע ב־32K → כל העבודה נכשלה (max_tokens), ובכל "המשך"
# שוב. התקרה עצמה לא עולה כסף (משלמים רק על מה שנוצר), ולכן: קריאה שנקטעה מנסה פעם אחת עם תקרת המודל (128K לכל
# המודלים שלנו — models.md); וקריאות שהפלט שלהן "שורה לכל כתובית" מקבלות את החלק שהגיע (partial_ok) ומבקשות רק את מה שחסר.
MAX_OUT = 120_000
# שגיאות חולפות מול Claude — ניסיון נוסף אחרי ההשהיות האלה (שניות); = TRANSIENT_ERRS בשרתון (חוץ מ־net/drive)
TRANSIENT_CODES = ('api_overloaded', 'api_network', 'api_timeout', 'api_rate')
# 15/10/2026 (עבודה בניסוי שעמדה 30+ דק׳ בלי דיווח, הזיכרון 1%): timeout=1800 חל על כל קריאה מהרשת — חיבור שנתקע
# באמצע הזרם חיכה עד חצי שעה לכל ניסיון (ועוד 4 ניסיונות של ה־SDK). בזרם Anthropic שולח אירועי ping גם בזמן
# החשיבה, כך שהמתנה ארוכה בלי שום בייט = חיבור מת. read = הזמן המקסימלי בין שני בייטים, לא לכל התשובה.
API_READ_TIMEOUT = float(os.environ.get('SNB_API_READ_TIMEOUT', '150'))
# 24/10/2026 (בקשת המשתמש: "שה־Routine יעבוד בדיוק כמו ה־API"): ערוץ שני לאותן קריאות — Claude Code במצב ללא ממשק
# (claude -p) בתוך הסשן של ה־Routine, על המנוי של המשתמש. אותה הנחיה, אותו מודל ומאמץ, אותו בלוק קבוע במטמון —
# בלי כלים, בלי CLAUDE.md, בלי ההנחיה של Claude Code. נמדד בסשן ענן: מעטפת של ‎~1,400 טוקנים לקריאה (מול ‎~127K
# לכל סוכן־משנה במסלול הישן), המטמון נקרא בין תהליכים נפרדים, TTL של שעה. SNB_LLM=cli בוחר אותו (job.py, במנוי).
TRANSPORT = os.environ.get('SNB_LLM', 'api')
CLI_TIMEOUT = float(os.environ.get('SNB_CLI_TIMEOUT', '2400'))
# משתנים שמשנים את מה שהקריאה עושה: מפתח API (‏-p משתמש בו כשהוא קיים — חיוב ב־API במקום במנוי) ומאמץ שגובר על ‎--effort
CLI_DROP_ENV = ('ANTHROPIC_API_KEY', 'CLAUDE_CODE_EFFORT_LEVEL', 'CLAUDE_EFFORT', 'MAX_THINKING_TOKENS')
CLI_ENV = {'CLAUDE_CODE_DISABLE_CLAUDE_MDS': '1', 'CLAUDE_CODE_DISABLE_ATTACHMENTS': '1',
           'CLAUDE_CODE_DISABLE_GIT_INSTRUCTIONS': '1', 'DISABLE_AUTOUPDATER': '1'}
CLI_FLAGS = ('--disallowedTools', '*', '--setting-sources', '', '--strict-mcp-config', '--disable-slash-commands',
             '--max-turns', '1', '--no-session-persistence', '--output-format', 'stream-json', '--verbose',
             '--include-partial-messages')


def api_timeout():
    """זמני ההמתנה ללקוח של Anthropic: חיבור, קריאה (בין בייטים), כתיבה. בלי הספרייה — מספר אחד (כמו קודם, אבל קצר).
    20/10/2026: Timeout של ה־SDK עצמו (anthropic.Timeout), לא של httpx — מ־anthropic 1.x ה־SDK עובד עם httpx2 ודוחה
    httpx.Timeout ב־TypeError. כל עבודה בשרת קרסה כך בקריאה הראשונה ל־Claude (ההגהה), מ־15/10 ועד התיקון."""
    try:
        from anthropic import Timeout
    except ImportError:
        return API_READ_TIMEOUT
    try:
        return Timeout(connect=30.0, read=API_READ_TIMEOUT, write=120.0, pool=30.0)
    except (TypeError, ValueError):
        return API_READ_TIMEOUT


MID_RETRY_WAIT = tuple(int(x) for x in os.environ.get('SNB_MID_RETRY', '20,60').split(',') if x.strip())


def judge_spec(model: str = '') -> 'Spec':
    """מודל השופט — תמיד Haiku 5.5 · High, בלי קשר למתרגם (11/10/2026)."""
    return Spec(*JUDGE)


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
    rid: object = None          # 15/10: request id (יומן הקריאות — לפנייה לתמיכה של Anthropic)
    mid: object = None          # message id

    @property
    def truncated(self) -> bool:
        return self.stop == 'max_tokens'


# 24/10/2026: ההעברה — עבודת "המנוי שלי" שרצה בשרת שלנו: הקריאות ל־Claude עוברות דרך התור בשרתון ל־Routine של המשתמש
# (translator/relay.py). job.py auto קובע את זה כשהלקיחה החזירה כתובת תור (rh); כל מנוע שנוצר אחר כך בתהליך — דרכו.
RELAY: dict | None = None


def set_relay(base: str, job: str, key: str) -> None:
    global RELAY
    RELAY = {'base': base, 'job': job, 'key': key}


class Engine:
    """מנוע אחד לכל עבודה. ledger צובר את העלות; cap_usd = תקרת העבודה (נבדקת לפני כל קריאה)."""

    def __init__(self, spec: Spec, cap_usd: float | None = None, client=None, transport: str | None = None):
        self.spec = spec
        self.role_effort: dict = {}      # 24/10/2026: ניסוי המאמץ — רק מעבודות של סט הזהב (spec.xe, ROLE_EFFORT_KEYS)
        # 'api' = Messages API עם המפתח של המערכת · 'cli' = claude -p במנוי · 'relay' = claude -p במנוי, דרך התור (העבודה בשרת שלנו)
        self.transport = transport or ('relay' if RELAY else None) or os.environ.get('SNB_LLM') or TRANSPORT
        self.cap = cap_usd
        self.ledger = Ledger()
        self._client = client          # בבדיקות: לקוח מדומה עם messages.stream(...)
        self._lock = threading.Lock()  # קריאות התרגום רצות במקביל — ה־ledger והמעקבים משותפים
        self._prev_id = None           # message id אחרון — נשלח ב־diagnostics של הקריאה הבאה
        self._fixed_calls: dict = {}   # hash של הבלוק הקבוע → כמה קריאות — לאימות שהמטמון באמת נקרא
        self.cache_warns = 0           # קריאות שהיו אמורות לקרוא מהמטמון (אותו בלוק, קריאה 2+) ולא קראו
        self.think: dict = {}          # שלב → חשיבה מצטברת (טוקנים כשהשרת מדווח; אחרת תווים)
        self.refusal_retries = 0       # סירובים שעברו בניסוח מחדש (Haiku 5.5 — בלי נפילה בצד השרת)
        self._inflight = 0             # קריאות שנשלחו ועוד לא חזרו (לתקרה בזמן מקבול)
        self.trunc = 0                 # 14/10/2026 (מאגר הלמידה): תשובות שנקטעו בתקרת הטוקנים
        self.mid_retries = 0           # ניסיונות חוזרים על שגיאה חולפת באמצע הזרם
        self.no_think = False          # 27/10/2026: בחירה מתוך רשימה (שבירת שורות) — בלי חשיבה (Haiku 5.5: disabled מותר עד high)

    def facts(self) -> dict:
        """14/10/2026: מאגר הלמידה — מספרים בלבד: אזהרות מטמון, סירובים שעברו, קטיעות, ניסיונות חוזרים, חשיבה לכל שלב,
        וכמה בלוקים קבועים שונים נשלחו (פיצול לחלונות = פחות שיתוף במטמון)."""
        with self._lock:
            return {'cw': self.cache_warns, 'rr': self.refusal_retries, 'tc': self.trunc, 'mr': self.mid_retries,
                    'fb': len(self._fixed_calls), 'th': dict(self.think)}

    def effort(self) -> str:
        """24/10/2026 (ניסוי המאמץ): מאמץ לפי התפקיד של הקריאה (role_effort: main / tl / rv), אחרת של המצב.
        28/10/2026: ROLE_CAP — תקרה לתפקיד כשהמצב גבוה ממנה (ניסוי המאמץ עדיין קובע מעליה)."""
        k = getattr(_tl, 'k', '')
        x = self.role_effort.get(k) if self.role_effort else None
        cap = None if x else ROLE_CAP.get(k)
        e = x or self.spec.effort or 'medium'
        return cap if cap and e in EFFORTS and EFFORTS.index(e) > EFFORTS.index(cap) else e

    # ------------------------------------------------------------------ ממשק אחד
    def complete(self, k: str, system_fixed: str, prompt: str, max_tokens: int = 32000,
                 system_extra: str = '', on_first_token=None, partial_ok: bool = False) -> Result:
        """partial_ok = תשובה שנקטעה (max_tokens) חוזרת כמו שהיא (res.truncated) — לפלט של שורה לכל כתובית, שבו
        המתקשר שומר את מה שהגיע ומבקש רק את החסר. בלי partial_ok — ניסיון אחד עם MAX_OUT, ורק אז כשל גלוי.
        system_fixed = הבלוק הקבוע (מדריך, תדריך, מילון, המקור) — נכנס למטמון ומשותף לכל הקריאות של העבודה.
        system_extra = הוראה קצרה שמשתנה (אחרי נקודת המטמון). prompt = הבקשה עצמה.
        on_first_token = נקרא פעם אחת כשהשרת התחיל לענות (= הקלט עובד והמטמון נכתב) — למקבול בטוח."""
        with self._lock:
            spent = self.ledger.total()
            calls = sum(r['n'] for r in self.ledger.list())
            # קריאות שכבר באוויר (התרגום רץ במקביל) נספרות לפי העלות הממוצעת לקריאה עד עכשיו — בלי זה 4 קריאות
            # מקבילות יכלו לעבור את התקרה יחד
            pending = self._inflight * (spent / calls if spent and calls else 0)
            if self.cap is not None and spent is not None and spent + pending >= self.cap:
                raise LLMError('budget_cap', f'הגענו לתקרת העבודה (${self.cap:.2f})')
            self._inflight += 1
        try:
            return self._complete(k, system_fixed, prompt, max_tokens, system_extra, on_first_token, partial_ok)
        finally:
            with self._lock:
                self._inflight -= 1

    def _complete(self, k, system_fixed, prompt, max_tokens, system_extra, on_first_token, partial_ok=False) -> 'Result':
        if self.spec.provider != 'anthropic':
            raise LLMError('provider_unknown', self.spec.provider)
        _tl.k, _tl.a = k, 0                  # יומן הקריאות: השלב של הקריאה (לחוט הזה)
        # 21/10/2026: המספר לפי סדר ההתחלה, לא הסיום. במקביל הקריאה הראשונה (שכותבת את המטמון) ארוכה ומסתיימת
        # רביעית — לפי הסיום היא נספרה "קריאה 4 בלי מטמון": אזהרת שווא בכל עבודה, ומסקנת cache_miss שגויה במאגר.
        fh = hashlib.sha1(system_fixed.encode('utf-8')).hexdigest()
        with self._lock:
            n_fixed = self._fixed_calls[fh] = self._fixed_calls.get(fh, 0) + 1
        res = self._call_retrying(system_fixed, system_extra, prompt, max_tokens, on_first_token)
        with self._lock:
            self.ledger.add(k, self.spec.model, res.usage, res.usd)  # גם קריאה שנכשלה בסוף עלתה כסף — נרשמת קודם
            self.think[k] = self.think.get(k, 0) + res.think_chars
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
        if res.stop == 'max_tokens' and not partial_ok and max_tokens < MAX_OUT:
            with self._lock:
                spent = self.ledger.total()
            if self.cap is not None and spent is not None and spent >= self.cap:
                raise LLMError('budget_cap', f'הגענו לתקרת העבודה (${self.cap:.2f})')
            print(f'· התשובה נקטעה בתקרה של {max_tokens} טוקנים (שלב {k}) — ניסיון אחד עם תקרת המודל')
            self.trunc += 1
            res = self._call_retrying(system_fixed, system_extra, prompt, MAX_OUT)
            with self._lock:
                self.ledger.add(k, self.spec.model, res.usage, res.usd)
                self.think[k] = self.think.get(k, 0) + res.think_chars
            if res.stop == 'refusal':
                raise LLMError('model_refusal', 'המודל סירב לבקשה (בלי מעבר למודל אחר — מודל אחד לכל עבודה)')
        if res.stop == 'max_tokens' and not partial_ok:
            raise LLMError('max_tokens', 'התשובה נקטעה גם בתקרת המודל')
        return res

    def _call_retrying(self, fixed, extra, prompt, max_tokens, on_first_token=None) -> 'Result':
        """11/10/2026 (ביקורת העמידות): ה־SDK מנסה שוב רק את פתיחת הבקשה. עומס (529/5xx) או ניתוק שמגיעים באמצע
        הזרם הכשילו עבודה שלמה של שעה (עשרות קריאות, 4 במקביל). כאן — עוד שני ניסיונות עם השהיה, רק לשגיאות חולפות."""
        for i in range(len(MID_RETRY_WAIT) + 1):
            _tl.a = i                        # יומן הקריאות: מספר הניסיון
            try:
                return self._anthropic(fixed, extra, prompt, max_tokens, on_first_token if i == 0 else None)
            except LLMError as e:
                if e.code not in TRANSIENT_CODES or i == len(MID_RETRY_WAIT):
                    raise
                self.mid_retries += 1
                print(f'· שגיאה חולפת מול Claude ({e.code}) — ניסיון נוסף בעוד {MID_RETRY_WAIT[i]} שנ׳')
                time.sleep(MID_RETRY_WAIT[i])

    # ------------------------------------------------------------------ כרטיס המחיר (Haiku 5.5)
    @property
    def card_limit(self) -> int | None:
        return CARD_LIMIT.get(self.spec.model)

    def prompt_tokens(self, fixed: str, prompt: str, extra: str = '') -> int:
        """כמה טוקני קלט תהיה הבקשה. אומדן גס; כשהוא באזור הסף — count_tokens של ה־API (חינם, מכסה נפרדת)."""
        rough = est_tokens(fixed) + est_tokens(extra) + est_tokens(prompt) + 64
        if self.transport in ('cli', 'relay'):
            rough += 1500                 # המעטפת של Claude Code (נמדד: ‎~1,400 טוקנים)
        lim = self.card_limit
        if lim and 0.5 * lim <= rough <= 2 * lim and self.transport == 'api':
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
            self._client = anthropic.Anthropic(max_retries=4, timeout=api_timeout())
        return self._client

    def _anthropic(self, fixed: str, extra: str, prompt: str, max_tokens: int, on_first_token=None) -> Result:
        """15/10/2026 — יומן הקריאות (האיסוף המלא, רק כש־SNB_CALLLOG מוגדר): זמן, משך, שלב, ניסיון, stop_reason, request id,
        טוקנים ועלות — לכל קריאה, גם לזו שנכשלה. העטיפה לא משנה את ההתנהגות; תקלה ביומן נבלעת"""
        t0 = time.time()
        try:
            res = {'cli': self._cli0, 'relay': self._relay0}.get(self.transport, self._anthropic0)(fixed, extra, prompt, max_tokens, on_first_token)
        except LLMError as e:
            call_log({'t': t0, 'ms': int((time.time() - t0) * 1000), 'k': getattr(_tl, 'k', ''), 'm': self.spec.model,
                      'a': getattr(_tl, 'a', 0), 'mt': max_tokens, 'err': e.code, 'em': str(e)[:300],
                      'rid': getattr(e.__cause__, 'request_id', None)})
            raise
        call_log({'t': t0, 'ms': int((time.time() - t0) * 1000), 'k': getattr(_tl, 'k', ''), 'm': self.spec.model,
                  'a': getattr(_tl, 'a', 0), 'mt': max_tokens, 'sr': res.stop, 'rid': res.rid, 'mid': res.mid,
                  'th': res.think_chars, 'usd': res.usd, **res.usage})
        return res

    def _anthropic0(self, fixed: str, extra: str, prompt: str, max_tokens: int, on_first_token=None) -> Result:
        system = [{'type': 'text', 'text': fixed, 'cache_control': {'type': 'ephemeral', 'ttl': CACHE_TTL}}]
        if extra:
            system.append({'type': 'text', 'text': extra})
        with self._lock:
            prev_id = self._prev_id
        kw = dict(model=self.spec.model, max_tokens=max_tokens, system=system,
                  messages=[{'role': 'user', 'content': prompt}], thinking={'type': 'disabled' if self.no_think else 'adaptive'},
                  # effort מקובע מפורשות תמיד — ברירות המחדל של המודלים שונות (Opus 5.5 = medium) ואסור לסמוך עליהן.
                  output_config={'effort': self.effort()},
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
                    'APITimeoutError': 'api_timeout', 'OverloadedError': 'api_overloaded',
                    'InternalServerError': 'api_overloaded', 'ServiceUnavailableError': 'api_overloaded'}.get(name)
            if code is None:
                st = getattr(e, 'status_code', None)
                mod = type(e).__module__ or ''
                if isinstance(st, int) and (st >= 500 or st == 529):
                    code = 'api_overloaded'                   # אירוע error באמצע הזרם (529 / 5xx)
                elif mod.startswith(('httpx', 'httpcore')) or isinstance(e, (ConnectionError, TimeoutError)):
                    code = 'api_network'                      # הזרם נותק
                else:
                    code = 'api_error'
            # 21/10/2026: מגבלת ההוצאה של ה־Workspace (או יתרה שנגמרה) מגיעה כ־400 רגיל — עד כאן "api_bad_request",
            # והשופט פשוט דילג. זה לא באג בבקשה: שום קריאה לא תעבור עד שהמגבלה מורמת במסוף — קוד משלו, P1, בלי "המשך" לבד.
            if code in ('api_bad_request', 'api_rate', 'api_auth') and re.search(r'usage limits?|credit balance|spend limit', str(e), re.I):
                code = 'api_quota'
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
        return Result(text, usage, usd, stop, think_chars=think, diag=getattr(msg, 'diagnostics', None),
                      rid=getattr(msg, '_request_id', None), mid=mid)

    # ------------------------------------------------------------------ claude -p (המנוי, בתוך ה־Routine)
    def _cli0(self, fixed: str, extra: str, prompt: str, max_tokens: int, on_first_token=None) -> Result:
        """אותה קריאה כמו _anthropic0, דרך Claude Code. הבלוק הקבוע = ההנחיה של המערכת (קובץ לפי טביעה — אותו קובץ
        לכל הקריאות, והמטמון לפי תחילית מדויקת); ההוראה שמשתנה + הבקשה = ההודעה. התיקייה קבועה: המטמון של Claude Code
        מוגבל לתיקייה. התקרה (max_tokens) עוברת במשתנה הסביבה; בקטיעה Claude Code ממשיך לבד, והשימוש מצטבר."""
        exe = os.environ.get('SNB_CLAUDE_BIN') or shutil.which('claude')
        if not exe:
            raise LLMError('cli_missing', 'לא נמצא claude (Claude Code) בסביבה')
        d = Path(os.environ.get('SNB_CLI_DIR') or (Path(tempfile.gettempdir()) / 'snb-cli'))
        d.mkdir(parents=True, exist_ok=True)
        sp = d / ('sys-' + hashlib.sha1(fixed.encode('utf-8')).hexdigest()[:20] + '.txt')
        if not sp.exists():
            tmp = sp.with_suffix('.%d.tmp' % threading.get_ident())
            tmp.write_text(fixed, encoding='utf-8')
            os.replace(tmp, sp)
        env = {k: v for k, v in os.environ.items() if k not in CLI_DROP_ENV}
        env.update(CLI_ENV)
        env['CLAUDE_CODE_MAX_OUTPUT_TOKENS'] = str(int(max_tokens))
        cmd = [exe, '-p', '--model', self.spec.model, '--effort', self.effort(),
               '--system-prompt-file', str(sp), *CLI_FLAGS]
        user = (extra + '\n\n' + prompt) if extra else prompt
        try:
            pr = subprocess.Popen(cmd, cwd=str(d), env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                  stderr=subprocess.PIPE, text=True, encoding='utf-8')
        except OSError as e:
            raise LLMError('cli_missing', 'claude לא עלה: ' + type(e).__name__) from e
        err_lines: list = []
        et = threading.Thread(target=lambda: err_lines.extend(pr.stderr.readlines()[-20:]), daemon=True)
        et.start()
        timer = threading.Timer(CLI_TIMEOUT, pr.kill)
        timer.start()
        res_ev, started = None, False
        try:
            try:
                pr.stdin.write(user)
                pr.stdin.close()
            except (BrokenPipeError, OSError):
                pass
            for line in pr.stdout:
                try:
                    ev = json.loads(line)
                except ValueError:
                    continue
                t = ev.get('type') if isinstance(ev, dict) else None
                if t == 'stream_event' and not started and on_first_token is not None:
                    started = True                  # השרת התחיל לענות — הקלט עובד והמטמון נכתב
                    on_first_token()
                elif t == 'result':
                    res_ev = ev
            pr.wait()
            et.join(5)
        finally:
            timer.cancel()
            for f in (pr.stdout, pr.stderr):
                try:
                    f.close()
                except OSError:
                    pass
        if not res_ev:
            if pr.returncode in (-9, 137):
                raise LLMError('api_timeout', 'claude -p לא סיים בזמן')
            tail = ' '.join(x.strip() for x in err_lines)[-200:]
            raise LLMError('cli_error', 'claude -p יצא בלי תוצאה (' + str(pr.returncode) + '): ' + tail)
        u = res_ev.get('usage') or {}
        cc = u.get('cache_creation') or {}
        c1 = int(cc.get('ephemeral_1h_input_tokens') or 0)
        c5 = max(int(u.get('cache_creation_input_tokens') or 0) - c1, 0)
        usage = {'i': int(u.get('input_tokens') or 0), 'o': int(u.get('output_tokens') or 0),
                 'cr': int(u.get('cache_read_input_tokens') or 0), 'c5': c5, 'c1': c1}
        if res_ev.get('is_error'):
            st = res_ev.get('api_error_status')
            msg = str(res_ev.get('result') or res_ev.get('subtype') or '')
            code = ('api_rate' if st == 429 else 'api_overloaded' if isinstance(st, int) and st >= 500
                    else 'api_auth' if st in (401, 403) else 'api_bad_request' if st == 400 else 'api_error')
            if re.search(r'usage limit|limit reached|hit your limit', msg, re.I):
                code = 'sub_limit'               # מגבלת השימוש של המנוי (מתאפסת לבד אחרי כמה שעות) — לא מפתח של המערכת
            raise LLMError(code, 'claude -p: ' + msg[:200])
        otd = u.get('output_tokens_details') or {}
        think = int(otd.get('thinking_tokens') or 0) if isinstance(otd, dict) else 0
        usd = cost_anthropic(self.spec.model, usage['i'], usage['o'], usage['cr'], usage['c5'], usage['c1'])
        return Result(str(res_ev.get('result') or ''), usage, usd, res_ev.get('stop_reason') or 'end_turn',
                      think_chars=think, mid=res_ev.get('uuid'))

    # ------------------------------------------------------------------ דרך התור (העבודה בשרת שלנו, Claude ב־Routine)
    def _relay0(self, fixed: str, extra: str, prompt: str, max_tokens: int, on_first_token=None) -> Result:
        """אותה קריאה כמו _cli0 — ה־Routine של המשתמש מריץ אותה (relay.serve → relay_answer). העלות = לפי המחירון,
        כמו במנוי (לא נגבית מהמפתח של המערכת)."""
        import relay as R
        r = RELAY or {}
        if not r:
            raise LLMError('relay_error', 'אין תור')
        try:
            a = R.call(r['base'], r['job'], r['key'], k=getattr(_tl, 'k', ''), model=self.spec.model,
                       effort=self.effort(), max_tokens=max_tokens, fixed=fixed, extra=extra,
                       prompt=prompt, on_first_token=on_first_token)
        except R.RelayError as e:
            raise LLMError(e.code, 'התור: ' + str(e)) from e
        if a.get('err'):
            raise LLMError(str(a['err']), 'ה־Routine: ' + str(a['err']))
        u = a.get('u') or {}
        usage = {f: int(u.get(f) or 0) for f in ('i', 'o', 'cr', 'c5', 'c1')}
        usd = cost_anthropic(self.spec.model, usage['i'], usage['o'], usage['cr'], usage['c5'], usage['c1'])
        return Result(str(a.get('t') or ''), usage, usd, a.get('st') or 'end_turn', think_chars=int(a.get('th') or 0))


def relay_answer(req: dict, fixed: str, started=None) -> dict:
    """ה־Routine: בקשה אחת מהתור → claude -p (אותה פונקציה כמו במצב 'cli') → תשובה לתור. רק מודלים ומאמצים מוכרים."""
    model, effort = str(req.get('m') or ''), str(req.get('e') or 'medium')
    if model not in ANTHROPIC_PRICES or effort not in ('low', 'medium', 'high', 'xhigh', 'max') or not isinstance(fixed, str):
        return {'err': 'relay_bad'}
    eng = Engine(Spec('anthropic', model, effort), transport='cli')
    try:
        res = eng._cli0(fixed, str(req.get('ex') or ''), str(req.get('pr') or ''), int(req.get('mt') or 32000), started)
    except LLMError as e:
        return {'err': e.code}
    return {'t': res.text, 'u': res.usage, 'st': res.stop or 'end_turn', 'th': int(res.think_chars or 0)}


def pt_answer(req: dict, fixed: str, started=None, client=None) -> dict:
    """25/10/2026 (שלב 3 של "תרגום בטלפון"): השרת שלנו עונה לבקשה מהתור של עבודה שהטלפון מריץ — Messages API עם המפתח של
    המערכת (אותה קריאה כמו במצב השרת: זרם, ניסיונות באמצע, מטמון על הבלוק הקבוע). הבקשה הגיעה מהטלפון — לא מהימנה: רק
    המודל של המצב של העבודה (md), השופט ודוח התקלה, ורק מאמץ מוכר; התקרה עד MAX_OUT. מחזיר {t,u,st,th,usd} או {err}."""
    model, effort, md = str(req.get('m') or ''), str(req.get('e') or 'medium'), str(req.get('md') or '')
    allowed = {JUDGE[1], 'claude-sonnet-5-5'}          # השופט ודוח התקלה (pipeline.PIR_SPEC)
    try:
        allowed.add(Spec.of(md).model)
    except (KeyError, ValueError, LLMError):
        return {'err': 'relay_bad'}
    if model not in allowed or model not in ANTHROPIC_PRICES or effort not in ('low', 'medium', 'high', 'xhigh', 'max') or not isinstance(fixed, str):
        return {'err': 'relay_bad'}
    mt = max(256, min(MAX_OUT, int(req.get('mt') or 32000)))
    eng = Engine(Spec('anthropic', model, effort), transport='api', client=client)
    try:
        res = eng._call_retrying(fixed, str(req.get('ex') or ''), str(req.get('pr') or ''), mt, started)
    except LLMError as e:
        return {'err': e.code}
    return {'t': res.text, 'u': res.usage, 'st': res.stop or 'end_turn', 'th': int(res.think_chars or 0),
            'usd': float(res.usd or 0)}


_tl = threading.local()
_log_lock = threading.Lock()


def call_log(entry: dict):
    """שורה ב־calls.jsonl (הסוכן שולח בסוף העבודה, השרתון מנקה ומצפין). רק כש־job.py הגדיר SNB_CALLLOG"""
    path = os.environ.get('SNB_CALLLOG')
    if not path:
        return
    try:
        d = {k: v for k, v in entry.items() if v not in (None, '')}
        if isinstance(d.get('rid'), str):
            d['rid'] = d['rid'][:80]
        with _log_lock, open(path, 'a', encoding='utf-8') as f:
            f.write(json.dumps(d, ensure_ascii=False, default=str) + '\n')
    except (OSError, TypeError, ValueError):
        pass


def _diag_reason(diag) -> str | None:
    """cache_miss_reason.type מתוך response.diagnostics — עובד גם על dict וגם על אובייקט SDK."""
    if diag is None:
        return None
    cm = diag.get('cache_miss_reason') if isinstance(diag, dict) else getattr(diag, 'cache_miss_reason', None)
    if cm is None:
        return None
    t = cm.get('type') if isinstance(cm, dict) else getattr(cm, 'type', None)
    return str(t) if t else None


class ManualEngine:
    """סבב 10: העתק־הדבק לעבודה מלאה — Claude של המשתמש (בצ'אט, במנוי שלו) במקום ה־API, בלי עלות למערכת.
    אותו ממשק כמו Engine: כל קריאה = בקשה אחת שהטלפון מציג להעתקה, והתשובה שהמשתמש מדביק חוזרת כטקסט.
    ask(k, text) → טקסט התשובה (job.cp_round). בטור בלבד (קריאה אחת בכל רגע) — אין מטמון ואין תקרה."""
    manual = True
    FOOT = ('\n\n---\nענה רק בפורמט שמתואר למעלה — בלי הקדמה ובלי סיכום. '
            'אם התשובה ארוכה, כתוב את כולה עד הסוף (אפשר בכמה הודעות רצופות; מדביקים את כולן יחד).')

    def __init__(self, ask, model: str = 'claude-chat'):
        self.spec = Spec('manual', model, None)
        self.cap = None
        self.ledger = Ledger()
        self._client = None
        self._ask = ask
        self._lock = threading.Lock()

    def fits_card(self, fixed: str, prompt: str, extra: str = '') -> bool:
        return True

    def complete(self, k: str, system_fixed: str, prompt: str, max_tokens: int = 32000,
                 system_extra: str = '', on_first_token=None, partial_ok: bool = False) -> Result:
        if on_first_token:
            on_first_token()
        with self._lock:
            text = self._ask(k, '\n\n'.join(x.strip() for x in (system_fixed, system_extra, prompt) if x and x.strip()) + self.FOOT)
        if not text or not str(text).strip():
            raise LLMError('cp_empty', 'התשובה שהודבקה ריקה')
        return Result(str(text), {}, 0.0, 'end_turn')
