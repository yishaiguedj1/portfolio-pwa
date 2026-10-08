#!/usr/bin/env python3
"""העובד בענן של סטודיו התרגום (THE SNOWBALL) — הלקוח לשרתון, ומ־v358 גם מנהל העבודה של vt.

רץ בסשן ש־Routine של המשתמש פותח (לפי translator/RUNBOOK.md):
    python3 translator/job.py run --job <מזהה העבודה> --key <מפתח העבודה>
"בדיקת חיבור" מסתיימת שם. עבודת תרגום ממשיכה בפקודות קצרות (הפרטים נשמרים בקובץ פרטי בבית של הסשן):
    prepare → (הגהה) → align → (תרגום, save tl, ביקורת) → finish     ·  fail אם משהו נתקע
v361: אחרי כל שלב גדול נשמרת נקודת שמירה ב־Drive; עבודה שהופעלה שוב ("המשך") מתחילה ב־restore ולא מההתחלה.

רק ספריות מובנות של Python. אף פעם לא מדפיס את מפתח העבודה או את הגישה ל־Drive.
השרתון קבוע בקוד (לא מגיע מההודעה שהפעילה את הסשן): הטקסט שמגיע בהפעלה מסומן "לא מהימן",
ולכן ממנו נלקחים רק שני ערכים, שנבדקים כאן בצורה קפדנית.
"""
import argparse
import io
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import time
from pathlib import Path
import urllib.error
import urllib.request

SERVER = 'https://ibkr-proxy-wine.vercel.app'
DRIVE_API = 'https://www.googleapis.com/drive/v3'
JOB_RE = re.compile(r'^j[A-Za-z0-9_-]{20}$')
KEY_RE = re.compile(r'^[A-Za-z0-9_-]{43}$')
LOCAL_RE = re.compile(r'^http://(127\.0\.0\.1|localhost)(:\d{1,5})?$')   # רק לבדיקות (tests/studio-worker-v355)
UA = 'snb-studio-worker/1'


class Stop(Exception):
    """השרתון אמר לעצור (העבודה בוטלה / הסתיימה / המפתח לא תקף)."""


HERE = Path(__file__).resolve().parent
STATE = Path(os.environ.get('SNB_STATE', str(Path.home() / '.snb-studio'))) / 'job.json'
VT_PY = os.environ.get('VT_PY', str(Path.home() / '.vt-venv' / 'bin' / 'python'))
VT_WORK = Path(os.environ.get('VT_WORK', str(Path.home() / 'vt-work')))
VT_BIN = Path(os.environ.get('VT_BIN', str(Path.home() / '.vt-bin')))
STAGES = ('up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv')
ERR_RE = re.compile(r'^[a-z0-9_]{1,40}$')
CHUNK = 32 * 1024 * 1024        # העלאה ל־Drive: כפולה של 256KB
FILE_ID_RE = re.compile(r'^[A-Za-z0-9_-]{10,100}$')
# v361: נקודות שמירה — אחרי תמלול, יישור, תרגום וביקורת (אותם מזהים בשרתון: lib/studio.js CK_STAGES)
CK_STAGES = ('asr', 'al', 'tl', 'rv')
CK_LABEL = {'asr': 'התמלול', 'al': 'היישור', 'tl': 'התרגום', 'rv': 'הביקורת'}
# v364: ספר התיקונים — שמות השלבים והעצירות בשפה פשוטה (להודעה בתחילת המשך אחרי עצירה של המגדל)
ST_LABEL = {'up': 'ההעלאה', 'tr': 'התמלול', 'al': 'היישור', 'tl': 'התרגום', 'rv': 'הביקורת', 'bn': 'הצריבה', 'sv': 'השמירה'}
WHY_LABEL = {'cost': 'צריכה חריגה', 'cap': 'צריכה חריגה מאוד', 'loop': 'אותה שגיאה חזרה שוב ושוב',
             'calls': 'אותה פעולה חזרה שוב ושוב', 'idle': 'תקיעה בלי התקדמות'}
FP_RE = re.compile(r'^[0-9a-f]{12}$')


def fb_valid(a):
    """ספר התיקונים מהשרתון — רק רשומות תקינות (טביעה, סוג, תיקון)."""
    return [e for e in (a if isinstance(a, list) else [])
            if isinstance(e, dict) and FP_RE.match(str(e.get('fp') or '')) and e.get('why') in WHY_LABEL and e.get('fix')][:30]


def vt_slug(name):
    """השם שבו vt שומר את הפרויקט — זהה ל־slugify ב־translator/vt/project.py (אותיות קטנות, בלי - בקצוות).
    מזהה העבודה כולל אותיות גדולות, ולפניו חיפשנו את התיקייה והתוצרים בשם המקורי (output_name_mismatch ב־99%)."""
    s = re.sub(r'[^\w\-]+', '-', name.strip().lower(), flags=re.UNICODE).strip('-')
    return s or 'interview'


def http(method, url, body=None, headers=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=dict({'User-Agent': UA}, **(headers or {})))
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b'{}'), dict(r.headers)
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read() or b'{}')
        except ValueError:
            payload = {}
        return e.code, payload, dict(e.headers or {})


def denied(headers):
    """הרשת של הסביבה חסמה את השרת (Claude Code מחזיר 403 עם x-deny-reason)."""
    return any(k.lower() == 'x-deny-reason' for k in (headers or {}))


class Client:
    def __init__(self, server, job, key):
        self.url = server.rstrip('/') + '/api/studio'
        self.host = re.sub(r'^https?://', '', server).split('/')[0]
        self.job, self.key = job, key

    def call(self, op, **extra):
        body = dict(extra, op=op, job=self.job, key=self.key)
        for attempt in range(4):
            try:
                st, j, hd = http('POST', self.url, body)
            except (urllib.error.URLError, TimeoutError, OSError):
                st, j, hd = 0, {}, {}
            if st == 403 and denied(hd):
                raise SystemExit('✗ הרשת של הסביבה חוסמת את ' + self.host + ' — צריך להוסיף אותו ל־Allowed domains של הסביבה.')
            if j.get('stop'):
                raise Stop(j.get('state') or j.get('error') or 'stop')
            if st == 200 and j.get('ok'):
                return j
            if st in (0, 429) or st >= 500:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit('✗ השרתון החזיר ' + str(st) + ' ' + str(j.get('error') or ''))
        raise SystemExit('✗ השרתון לא עונה (' + self.host + ')')


def drive_ok(token, api):
    """האם הגישה ל־Drive עובדת מתוך הסשן (רשת + הרשאה). בלי להדפיס את הגישה."""
    if not token:
        return False
    try:
        st, j, _ = http('GET', api + '/about?fields=user(emailAddress)', headers={'Authorization': 'Bearer ' + token}, timeout=20)
    except (urllib.error.URLError, TimeoutError, OSError):
        return False
    return st == 200 and bool((j.get('user') or {}).get('emailAddress'))


def run(args):
    c = Client(args.server, args.job, args.key)
    try:
        got = c.call('claim')
        job = got.get('job') or {}
        token = (got.get('drive') or {}).get('token') or ''
        if job.get('kind') == 'ping':
            d = drive_ok(token, args.drive_api)
            c.call('report', done=True, checks={'drive': d}, msg='החיבור תקין' if d else 'החיבור תקין, אבל אין גישה ל־Drive מהסשן')
            print('✓ בדיקת החיבור הסתיימה: השרתון ✓ · Drive ' + ('✓' if d else '✗'))
            return 0
        if job.get('kind') != 'tr':
            c.call('report', fail=True, err='worker_unknown_kind')
            print('✗ סוג עבודה לא מוכר — סומן בשרתון.')
            return 1
        spec = job.get('spec') or {}
        if spec.get('from') not in ('auto', 'en', None) or 'he' not in (spec.get('to') or []):
            # vt מתרגם כרגע מאנגלית לעברית בלבד (שפות נוספות — שלב 7)
            c.call('report', fail=True, err='lang_unsupported', msg='כרגע רק מאנגלית לעברית')
            print('✗ זוג השפות עוד לא נתמך (כרגע אנגלית → עברית). סומן בשרתון.')
            return 1
        cks = [c for c in (job.get('ck') or []) if isinstance(c, dict) and c.get('s') in CK_STAGES and FILE_ID_RE.match(str(c.get('id') or ''))]
        ls = job.get('ls') if isinstance(job.get('ls'), dict) and FP_RE.match(str(job['ls'].get('fp') or '')) else None
        save_state({'job': args.job, 'key': args.key, 'server': args.server, 'drive_api': args.drive_api,
                    'folder': job.get('folder') or '', 'spec': spec, 'files': job.get('files') or {},
                    'ck': cks, 'ckids': {c['s']: c['id'] for c in cks},
                    'nm': job.get('nm') if isinstance(job.get('nm'), dict) else None,    # v363: "הרגיל" שלך — למגדל הפיקוח
                    'fb': fb_valid(job.get('fb')),                                        # v364: ספר התיקונים
                    'ls': ls})
        for old in ('prog.json', 'tower.json'):        # v362: מגדל הפיקוח מתחיל נקי לכל הפעלה
            try:
                (STATE.parent / old).unlink()
            except OSError:
                pass
        print('✓ עבודת תרגום נלקחה: ' + spec_line(spec))
        if start_setup_bg():
            print('· מנועי התמלול מותקנים ברקע (prepare ימתין להם בעצמו)')
        print('הפרויקט: ' + str(VT_WORK / vt_slug(args.job)))
        if ls:
            # v364: ההמשך הזה בא אחרי עצירה של מגדל הפיקוח — קודם מבינים למה, ורושמים תיקון לספר התיקונים
            known = next((e['fix'] for e in fb_valid(job.get('fb')) if e['fp'] == ls['fp']), '')
            print('⚠ העבודה נעצרה בפעם הקודמת במגדל הפיקוח: ' + WHY_LABEL.get(ls.get('why'), 'צריכה לא סבירה')
                  + (' (בשלב ' + ST_LABEL[ls['st']] + ')' if ls.get('st') in ST_LABEL else '') + '.')
            if known:
                print('התיקון שנרשם לתקלה הזו (מידע מעבודה קודמת): «' + re.sub(r'[\x00-\x1f]', ' ', known)[:160] + '» — פעל לפיו כשתגיע לשלב.')
            else:
                print('לפני שממשיכים: אבחן בקצרה מה גרם לזה (שגיאה אחרונה / קובץ התיקונים), ורשום תיקון במשפט אחד:')
                print('  python3 translator/job.py fix --text "<מה עושים כשזה קורה>"')
        if cks:
            # v361: "המשך" — העבודה כבר עברה חלק מהשלבים בסשן קודם
            print('↻ ממשיכים מנקודת שמירה: אחרי ' + CK_LABEL[cks[-1]['s']] + ' (בלי לתמלל ולתרגם מחדש)')
            print('הצעד הבא (ברקע, run_in_background): python3 translator/job.py restore')
            return 0
        print('הצעד הבא (ברקע, run_in_background): python3 translator/job.py prepare')
        return 0
    except Stop as e:
        print('■ השרתון ביקש לעצור (' + str(e) + ').')
        return 2


# ---------------------------------------------------------------- עלות וטוקנים (v359)
PROJECTS = Path(os.environ.get('SNB_CLAUDE_PROJECTS', str(Path.home() / '.claude' / 'projects')))
# דולר למיליון טוקנים: קלט, פלט, קריאה מהמטמון. כתיבה למטמון = פי 1.25 מהקלט (5 דק׳) / פי 2 (שעה)
PRICES = {
    'claude-opus-5-5': (4.0, 20.0, 0.20),
    'claude-sonnet-5-5': (2.0, 10.0, 0.20),
    'claude-haiku-4-5': (1.0, 5.0, 0.10),
}
USE_KINDS = ('main', 'tl', 'rv', 'sub')       # תיאום (הסשן הראשי) · תרגום · ביקורת · סוכן־משנה אחר
USE_MAX = 6
MODEL_RE = re.compile(r'^claude-[a-z0-9-]{1,50}$')


def price_of(model):
    """המחירון לפי מזהה המודל (גם עם סיומת תאריך / חלון הקשר, למשל claude-opus-5-5[1m]). לא מוכר → None."""
    m = re.sub(r'\[.*$', '', str(model or ''))
    for k, v in PRICES.items():
        if m == k or m.startswith(k + '-'):
            return v
    return None


def cost_of(model, i, o, cr, c5, c1):
    p = price_of(model)
    if not p:
        return None
    return (i * p[0] + o * p[1] + cr * p[2] + c5 * p[0] * 1.25 + c1 * p[0] * 2) / 1e6


def _first_prompt(recs):
    """ההנחיה הראשונה בקובץ של סוכן־משנה (רשומת user הראשונה) — לפיה יודעים אם זה התרגום או הביקורת."""
    for r in recs:
        if r.get('type') != 'user':
            continue
        c = (r.get('message') or {}).get('content')
        if isinstance(c, list):
            c = ' '.join(str(x.get('text') or '') for x in c if isinstance(x, dict) and x.get('type') == 'text')
        return str(c or '')
    return ''


def _calls(path):
    """הקריאות ל־API בקובץ יומן אחד, לפי הסדר. אותה הודעה נרשמת כמה פעמים (רשומה לכל חלק בתשובה —
    חשיבה, טקסט, כלי) עם אותו usage — לכל message.id נלקחת רק הרשומה האחרונה."""
    recs, calls, order = [], {}, []
    try:
        with open(path, encoding='utf-8') as f:
            for line in f:
                try:
                    r = json.loads(line)
                except ValueError:
                    continue
                if not isinstance(r, dict):
                    continue
                recs.append(r)
                m = r.get('message') if r.get('type') == 'assistant' else None
                if not isinstance(m, dict) or not m.get('id') or not isinstance(m.get('usage'), dict):
                    continue
                if str(m.get('model') or '').startswith('<'):        # <synthetic> — לא קריאה ל־API
                    continue
                if m['id'] not in calls:
                    order.append(m['id'])
                calls[m['id']] = m
    except OSError:
        pass
    return recs, [calls[k] for k in order]


def _num(x):
    try:
        return max(0, int(x or 0))
    except (TypeError, ValueError):
        return 0


def _tally(calls):
    """סכום לקבוצה, לפי מודל. מחזיר {מודל: שורה} — בדרך כלל מודל אחד."""
    by = {}
    for m in calls:
        u = m['usage']
        cc = u.get('cache_creation') if isinstance(u.get('cache_creation'), dict) else None
        c5 = _num(cc.get('ephemeral_5m_input_tokens')) if cc else _num(u.get('cache_creation_input_tokens'))
        c1 = _num(cc.get('ephemeral_1h_input_tokens')) if cc else 0
        model = str(m.get('model') or '')
        row = by.setdefault(model, {'m': model, 'n': 0, 'i': 0, 'o': 0, 'cr': 0, 'c5': 0, 'c1': 0})
        row['n'] += 1
        row['i'] += _num(u.get('input_tokens'))
        row['o'] += _num(u.get('output_tokens'))
        row['cr'] += _num(u.get('cache_read_input_tokens'))
        row['c5'] += c5
        row['c1'] += c1
    return by


def _open_cost(calls):
    """"עלות הפתיחה" של סוכן־משנה: הכתיבה למטמון בקריאה הראשונה שלו (ההקשר שהוא בונה מאפס)."""
    if not calls:
        return 0, None
    m = calls[0]
    u = m['usage']
    cc = u.get('cache_creation') if isinstance(u.get('cache_creation'), dict) else None
    c5 = _num(cc.get('ephemeral_5m_input_tokens')) if cc else _num(u.get('cache_creation_input_tokens'))
    c1 = _num(cc.get('ephemeral_1h_input_tokens')) if cc else 0
    return c5 + c1, cost_of(m.get('model'), 0, 0, 0, c5, c1)


def _finish_row(kind, row, extra=None):
    usd = cost_of(row['m'], row['i'], row['o'], row['cr'], row['c5'], row['c1'])
    out = dict(row, k=kind, usd=None if usd is None else round(usd, 4))
    if not MODEL_RE.match(out['m']):
        out['m'] = 'claude-unknown'
    out.update(extra or {})
    return out


def usage(root=None):
    """v359: הטוקנים והעלות של העבודה מתוך יומני הסשן (~/.claude/projects/**/*.jsonl).
    קבוצות: הסשן הראשי (תיאום), וכל קובץ בתיקייה subagents/ = סוכן־משנה אחד — תרגום או ביקורת לפי ההנחיה הראשונה בו.
    לכל שורה: מודל, קריאות, קלט, פלט, קריאה מהמטמון, כתיבה למטמון (5 דק׳ / שעה), עלות בדולרים (מודל לא מוכר — None),
    ולסוכן־משנה גם "עלות הפתיחה" (op = טוקנים, oc = דולרים). עד USE_MAX שורות; רק מספרים ומזהה מודל."""
    root = Path(root or PROJECTS)
    main_calls, subs = [], []
    for p in sorted(root.rglob('*.jsonl')) if root.is_dir() else []:
        recs, calls = _calls(p)
        if 'subagents' in p.parts:
            prompt = _first_prompt(recs)
            kind = 'tl' if 'TRANSLATE.md' in prompt else 'rv' if 'REVIEW.md' in prompt else 'sub'
            if calls:
                subs.append((kind, calls))
        else:
            main_calls += calls
    rows = [_finish_row('main', r) for r in _tally(main_calls).values()]
    for kind, calls in subs:
        ot, oc = _open_cost(calls)
        for r in _tally(calls).values():
            first = r['m'] == str(calls[0].get('model') or '')
            rows.append(_finish_row(kind, r, {'op': ot if first else 0,
                                              'oc': (None if oc is None else round(oc, 4)) if first else 0}))
    rows.sort(key=lambda r: USE_KINDS.index(r['k']))
    if len(rows) > USE_MAX:                       # יותר מדי שורות — מאחדים לפי סוג ומודל
        merged = {}
        for r in rows:
            key = (r['k'], r['m'])
            if key not in merged:
                merged[key] = dict(r)
                continue
            t = merged[key]
            for f in ('n', 'i', 'o', 'cr', 'c5', 'c1', 'op'):
                t[f] = t.get(f, 0) + r.get(f, 0)
            for f in ('usd', 'oc'):
                if f in t:
                    t[f] = None if t[f] is None or r.get(f) is None else round(t[f] + r[f], 4)
        rows = list(merged.values())[:USE_MAX]
    return rows


def usage_safe():
    """לדיווח האחרון: תקלה בקריאת היומנים לא מפילה את סוף העבודה. אין יומנים → None (לא נשלח)."""
    try:
        return usage() or None
    except Exception:            # noqa: BLE001 — מידע משני
        return None


# ---------------------------------------------------------------- מצב העבודה בסשן
def save_state(st):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(STATE.parent, 0o700)
    except OSError:
        pass
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(st, ensure_ascii=False), encoding='utf-8')
    os.chmod(tmp, 0o600)                      # מפתח העבודה — רק למשתמש של הסשן
    tmp.replace(STATE)


def load_state():
    try:
        st = json.loads(STATE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise SystemExit('✗ אין עבודה פעילה בסשן — קודם: python3 translator/job.py run --job … --key …')
    if not JOB_RE.match(st.get('job', '')) or not KEY_RE.match(st.get('key', '')):
        raise SystemExit('✗ קובץ העבודה לא תקין.')
    return st


def spec_line(spec):
    mins = round((spec.get('dur') or 0) / 60)
    return '"' + str(spec.get('name') or '') + '"' + (' · ' + str(mins) + ' דק׳' if mins else '') + \
        ' · מצב ' + str(spec.get('mode') or 'opus-medium') + ' · תוצרים: ' + '+'.join((spec.get('out') or []) + ['srt'])


def mirror_prog(st, p):
    """v362: ההתקדמות האחרונה בקובץ מקומי — מגדל הפיקוח (tower.py) מזהה ממנו תקיעה (chg = מתי זזה לאחרונה)."""
    path = STATE.parent / 'prog.json'
    try:
        old = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        old = {}
    now = time.time()
    moved = old.get('st') != st or (p is not None and abs((old.get('p') or 0) - p) >= 0.005)
    d = {'st': st, 'p': p if p is not None else old.get('p') if old.get('st') == st else 0, 'at': now,
         'chg': now if moved or not old.get('chg') else old['chg']}
    try:
        path.write_text(json.dumps(d), encoding='utf-8')
    except OSError:
        pass


_EV_SENT = {}
# v365: פקודת vt → סוג האירוע בקטלוג (תמלול / יישור / בדיקה / צריבה / קליטה)
VT_KIND = {'asr': 'asr', 'new': 'ingest', 'ingest': 'ingest', 'shots': 'ingest', 'edit-export': 'align', 'edit-import': 'align',
           'align': 'align', 'plan': 'align', 'tr-prep': 'align', 'tr-check': 'check', 'tr-merge': 'render', 'build': 'render',
           'render': 'render'}


class Ctx:
    """עבודה פעילה: לקוח לשרתון, גישה ל־Drive ודיווח התקדמות (לכל היותר פעם ב־15 שנ׳ לאותו שלב)."""

    def __init__(self, st):
        self.st = st
        self.c = Client(st['server'], st['job'], st['key'])
        self.api = st['drive_api']
        self.upload = re.sub(r'/drive/v3$', '/upload/drive/v3', st['drive_api'])
        self.tok, self.tok_at = '', 0
        self.last = (None, 0.0, -1.0)

    @property
    def name(self):
        return vt_slug(self.st['job'])

    @property
    def pdir(self):
        return VT_WORK / self.name

    def token(self, force=False):
        if force or not self.tok or time.time() - self.tok_at > 45 * 60:
            d = self.c.call('token').get('drive') or {}
            if not d.get('token'):
                raise SystemExit('✗ אין גישה ל־Drive (' + str(d.get('error') or 'drive') + ') — לחבר את Drive בהגדרות הסטודיו.')
            self.tok, self.tok_at = d['token'], time.time()
        return self.tok

    def report(self, st=None, p=None, msg=None, force=False, **extra):
        now = time.time()
        if not force and not extra and st == self.last[0] and now - self.last[1] < 15 and abs((p or 0) - self.last[2]) < 0.1:
            return                                  # אותו שלב, פחות מ־15 שנ׳ ופחות מ־10% — לא שווה כתיבה
        body = {k: v for k, v in extra.items() if v is not None}
        if st:
            body['st'] = st
        if p is not None:
            body['p'] = round(max(0.0, min(1.0, p)), 3)
        if msg:
            body['msg'] = msg
        self.c.call('report', **body)
        self.last = (st, now, p if p is not None else -1.0)
        if st:
            mirror_prog(st, p)


    def event(self, c, k, ok=False):
        """v365: אירוע למגדל הפיקוח (רכיב · סוג מהקטלוג בשרתון). אותו אירוע לכל היותר פעם בדקה; תקלה בדיווח לא עוצרת עבודה."""
        key, now = (c, k, ok), time.time()
        if now - _EV_SENT.get(key, 0) < 60:
            return
        _EV_SENT[key] = now
        try:
            self.c.call('report', ev=[{'c': c, 'k': k, 'ok': ok}])
        except Stop:
            raise
        except BaseException:      # noqa: BLE001 — כולל SystemExit מ־Client: דיווח שנכשל לא מפיל את העבודה
            pass

    def refresh(self):
        """פרטי העבודה העדכניים (הקבצים מהטלפון ממשיכים לעלות אחרי שהעבודה התחילה)."""
        job = self.c.call('claim').get('job') or {}
        self.st['files'] = job.get('files') or {}
        self.st['folder'] = job.get('folder') or self.st.get('folder', '')
        if job.get('qa'):
            self.st['qa'] = job['qa']
        save_state(self.st)
        return job


# ---------------------------------------------------------------- Drive
def drive_download(ctx, fid, dest, size, on_progress=None):
    """הורדה בזרם, עם המשך מאותו בייט אחרי ניתוק (Range) וגישה חדשה כשפגה."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tries = 0
    while True:
        have = dest.stat().st_size if dest.exists() else 0
        if size and have >= size:
            return dest
        req = urllib.request.Request(ctx.api + '/files/' + fid + '?alt=media&supportsAllDrives=true',
                                     headers={'Authorization': 'Bearer ' + ctx.token(tries > 0), 'User-Agent': UA})
        if have:
            req.add_header('Range', 'bytes=' + str(have) + '-')
        try:
            with urllib.request.urlopen(req, timeout=60) as r, open(dest, 'ab' if have and r.status == 206 else 'wb') as f:
                got = have if r.status == 206 else 0
                while True:
                    b = r.read(8 * 1024 * 1024)
                    if not b:
                        break
                    f.write(b)
                    got += len(b)
                    if on_progress and size:
                        on_progress(got / size)
            if not size or dest.stat().st_size >= size:
                if tries:
                    ctx.event('drive', 'dl_retry', ok=True)           # v365: Drive חזר — ההתראה נסגרת
                return dest
        except urllib.error.HTTPError as e:
            if e.code == 403 and denied(dict(e.headers or {})):
                ctx.event('claude', 'net')
                raise SystemExit('✗ הרשת של הסביבה חוסמת את Drive — להוסיף www.googleapis.com ל־Allowed domains.')
            if e.code not in (401, 429) and e.code < 500:
                ctx.event('drive', 'dl_fail')
                raise SystemExit('✗ ההורדה מ־Drive נכשלה (' + str(e.code) + ').')
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        tries += 1
        if tries == 2:
            ctx.event('drive', 'dl_retry')
        if tries > 8:
            ctx.event('drive', 'dl_fail')
            raise SystemExit('✗ ההורדה מ־Drive נקטעה שוב ושוב.')
        time.sleep(min(30, 2 ** tries))


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_OPEN = urllib.request.build_opener(_NoRedirect).open      # ב־Drive ‏308 = "התקבל חלקית", לא הפניה


def drive_upload(ctx, path, name, kind, mime, on_progress=None, prop='snbOut'):
    """העלאה מתחדשת לתיקיית העבודה. מחזיר את מזהה הקובץ ב־Drive."""
    size = path.stat().st_size
    meta = {'name': name, 'parents': [ctx.st['folder']], 'appProperties': {'snbJob': ctx.st['job'], prop: kind}}
    st, j, hd = http('POST', ctx.upload + '/files?uploadType=resumable&fields=id',
                     meta, headers={'Authorization': 'Bearer ' + ctx.token(), 'X-Upload-Content-Type': mime,
                                    'X-Upload-Content-Length': str(size)})
    if st == 401:
        st, j, hd = http('POST', ctx.upload + '/files?uploadType=resumable&fields=id',
                         meta, headers={'Authorization': 'Bearer ' + ctx.token(True), 'X-Upload-Content-Type': mime,
                                        'X-Upload-Content-Length': str(size)})
    loc = next((v for k, v in hd.items() if k.lower() == 'location'), '')
    if st != 200 or not loc:
        raise SystemExit('✗ פתיחת העלאה ל־Drive נכשלה (' + str(st) + ').')
    sent, tries, retried = 0, 0, False
    with open(path, 'rb') as f:
        while True:
            f.seek(sent)
            data = f.read(CHUNK)
            end = sent + len(data) - 1
            req = urllib.request.Request(loc, data=data, method='PUT', headers={
                'Content-Range': ('bytes %d-%d/%d' % (sent, end, size)) if data else 'bytes */%d' % size, 'User-Agent': UA})
            try:
                with _OPEN(req, timeout=300) as r:
                    out = json.loads(r.read() or b'{}')
                    if out.get('id'):
                        if retried:
                            ctx.event('drive', 'up_retry', ok=True)       # v365: Drive חזר — ההתראה נסגרת
                        return out['id']
                    raise SystemExit('✗ Drive לא החזיר מזהה לקובץ.')
            except urllib.error.HTTPError as e:
                if e.code == 308:                                  # החתיכה התקבלה — ממשיכים ממה ש־Drive אישר
                    rng = e.headers.get('Range') or ''
                    sent = int(rng.split('-')[-1]) + 1 if rng else 0
                    tries = 0
                    if on_progress:
                        on_progress(sent / size)
                    continue
                if e.code not in (429,) and e.code < 500:
                    ctx.event('drive', 'up_fail')
                    raise SystemExit('✗ ההעלאה ל־Drive נכשלה (' + str(e.code) + ').')
            except (urllib.error.URLError, TimeoutError, OSError):
                pass
            tries += 1
            retried = True
            if tries == 2:
                ctx.event('drive', 'up_retry')
            if tries > 8:
                ctx.event('drive', 'up_fail')
                raise SystemExit('✗ ההעלאה ל־Drive נקטעה שוב ושוב.')
            time.sleep(min(30, 2 ** tries))
            # אחרי תקלה — שואלים את Drive כמה הגיע
            q = urllib.request.Request(loc, data=b'', method='PUT', headers={'Content-Range': 'bytes */%d' % size, 'User-Agent': UA})
            try:
                with _OPEN(q, timeout=60) as r:
                    out = json.loads(r.read() or b'{}')
                    if out.get('id'):
                        return out['id']
            except urllib.error.HTTPError as e:
                if e.code == 308:
                    rng = e.headers.get('Range') or ''
                    sent = int(rng.split('-')[-1]) + 1 if rng else 0
            except (urllib.error.URLError, TimeoutError, OSError):
                pass


# ---------------------------------------------------------------- vt
def vt_env():
    env = dict(os.environ, VT_WORK=str(VT_WORK), PYTHONUNBUFFERED='1')
    if VT_BIN.is_dir():
        env['PATH'] = str(VT_BIN) + os.pathsep + env.get('PATH', '')
    return env


def vt(ctx, args, stage=None, lo=0.0, hi=1.0):
    """מריץ פקודת vt. שורת סיכום לכל פקודה; אחוזים מהפלט הולכים לשרתון כהתקדמות השלב."""
    proc = subprocess.Popen([VT_PY, '-m', 'vt'] + args, cwd=str(HERE), env=vt_env(),
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    tail = []
    for line in proc.stdout:
        line = line.rstrip()
        tail = (tail + [line])[-12:]
        m = re.search(r'(\d{1,3}(?:\.\d)?)%', line)
        if stage and m:
            try:
                ctx.report(stage, lo + (hi - lo) * min(1.0, float(m.group(1)) / 100))
            except Stop:
                proc.kill()
                raise
    rc = proc.wait()
    if rc != 0:
        print('\n'.join(tail))
        ctx.event('vt', VT_KIND.get(args[0], 'other'))
        raise SystemExit('✗ vt ' + args[0] + ' נכשל (קוד ' + str(rc) + ').')
    print('✓ vt ' + args[0] + (': ' + tail[-1] if tail else ''))
    return tail


def engine_modules():
    """v359: רשימת המודולים — אחת, מתוך setup.sh (השורה SNB_MODULES), כך שההתקנה ובדיקת המוכנות לא נפרדות."""
    m = re.search(r'^SNB_MODULES="([a-z0-9_ ]+)"', (HERE / 'setup.sh').read_text(encoding='utf-8'), re.M)
    return m.group(1).split() if m else []


_PROBE = """import importlib, sys
bad = 0
for m in sys.argv[1:]:
    try:
        importlib.import_module(m)
    except Exception:
        print(m)
        bad = 1
sys.exit(bad)
"""


def env_missing():
    """המודולים שחסרים (או שבורים — import נכשל) בסביבת vt. ריק = מוכן."""
    mods = engine_modules()
    if not os.path.exists(VT_PY):
        return mods
    r = subprocess.run([VT_PY, '-c', _PROBE] + mods, capture_output=True, text=True)
    if r.returncode == 0:
        return []
    got = [x.strip() for x in (r.stdout or '').splitlines() if x.strip() in mods]
    return got or mods


def env_ready():
    return not env_missing()


SETUP_PID = STATE.parent / 'setup.pid'


def setup_cmd():
    return os.environ.get('SNB_SETUP', 'bash ' + str(HERE / 'setup.sh')).split()


def setup_env():
    """ההתקנה מתוך העבודה לא כותבת את ~/.claude/settings.json — ההגדרות של הסשן נקבעות רק מתמונת המצב של הסביבה."""
    return dict(os.environ, SNB_SETUP_NO_SETTINGS='1', SNB_SETUP_LOG=str(STATE.parent / 'setup.log'))


def start_setup_bg():
    """v358: מנוע שחסר בתמונת המצב של הסביבה (setup.sh השתנה מאז שנבנתה) מותקן ברקע מרגע לקיחת העבודה —
    במקביל להעלאת הסרטון, להורדה ולקריאת מדריך הסגנון. כך אין צורך לעדכן ידנית את סקריפט ההתקנה ב־claude.ai:
    תמונת המצב מתרעננת לבד בערך פעם בשבוע (ומושכת את setup.sh העדכני מהריפו), ובינתיים זה קורה כאן."""
    if env_ready():
        return False
    STATE.parent.mkdir(parents=True, exist_ok=True)
    log = open(STATE.parent / 'setup.log', 'ab')
    p = subprocess.Popen(setup_cmd(), stdout=log, stderr=log, stdin=subprocess.DEVNULL, start_new_session=True,
                         env=setup_env())
    SETUP_PID.write_text(str(p.pid))
    return True


def setup_running():
    try:
        pid = int(SETUP_PID.read_text())
        os.kill(pid, 0)
    except (OSError, ValueError):
        return False
    try:                                         # תהליך שהסתיים אבל עוד לא נאסף (zombie) — לא "רץ"
        st = Path('/proc/%d/stat' % pid).read_text().split()
        return st[2] != 'Z'
    except OSError:
        return True


def ensure_env(ctx, st='tr'):
    """המנועים מותקנים? אם ההתקנה ברקע עוד רצה — מחכים לה; אם לא התחילה — מריצים עכשיו."""
    if env_ready():
        return
    ctx.report(st, None if st != 'tr' else 0, 'משלים את התקנת המנועים', force=True)
    waited = 0
    while setup_running() and waited < 25 * 60:
        time.sleep(3)
        waited += 3
    if not env_ready():
        subprocess.run(setup_cmd(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, env=setup_env())
    miss = env_missing()
    if miss:
        ctx.event('vt', 'setup')
        raise SystemExit('✗ ההתקנה של מנועי התמלול נכשלה — חסרים: ' + ', '.join(miss) +
                         '. אולי הרשת של הסביבה חוסמת (Hugging Face / PyTorch / GitHub). הפרטים: ' + str(STATE.parent / 'setup.log'))


def guarded(fn):
    def wrap(args):
        try:
            return fn(args)
        except Stop as e:
            print('■ השרתון ביקש לעצור (' + str(e) + ').')
            return 2
    return wrap


def wait_video(ctx, stage, msg):
    """מחכים שהסרטון יסיים לעלות מהטלפון (מעדכנים את השרתון פעם בחמש דקות — הטלפון מציג את ההעלאה בעצמו)."""
    poll = float(os.environ.get('SNB_POLL', '30'))
    n = 0
    while not (ctx.st.get('files') or {}).get('v'):
        if n == 0:
            print('מחכה שהסרטון יסיים לעלות מהטלפון…')
        if n % 10 == 0:
            ctx.report(stage, None, msg, force=True)
        time.sleep(poll)
        n += 1
        if n * poll > 12 * 3600:
            ctx.report(fail=True, err='upload_timeout', force=True)
            raise SystemExit('✗ הסרטון לא הגיע תוך 12 שעות.')
        ctx.refresh()
    return ctx.st['files']['v']


def in_path(ctx, f, kind):
    """הקובץ שהורד מ־Drive: הסרטון ב־_in/<שם>.<סיומת>, הקול ב־_in/<שם>.audio.<סיומת> (שניהם יכולים להיות שם יחד)."""
    default = '.mp4' if kind == 'v' else '.m4a'
    ext = (os.path.splitext(f.get('name') or '')[1] or default).lower()
    if not re.match(r'^\.[a-z0-9]{2,5}$', ext):
        ext = default
    return VT_WORK / '_in' / (ctx.name + ('.audio' if kind == 'a' else '') + ext)


@guarded
def prepare(args):
    """v360: התמלול מתחיל מהקול שהטלפון העלה ראשון — בלי לחכות לסרטון (שממשיך לעלות במקביל).
    הסרטון מצטרף ב־align (attach_video). אין קובץ קול (קודק שאי אפשר להעתיק) — מחכים לסרטון כמו קודם."""
    ctx = Ctx(load_state())
    files = ctx.st.get('files') or {}
    a = files.get('a') if (files.get('a') or {}).get('id') else None
    if a:
        src = in_path(ctx, a, 'a')
        ctx.report('tr', 0, 'מוריד את הקול מ־Drive', force=True)
        drive_download(ctx, a['id'], src, int(a.get('size') or 0), lambda f: ctx.report('tr', 0.05 * f, 'מוריד את הקול מ־Drive'))
    else:
        v = wait_video(ctx, 'up', 'מחכה שהסרטון יסיים לעלות')
        src = in_path(ctx, v, 'v')
        ctx.report('tr', 0, 'מוריד את הסרטון מ־Drive', force=True)
        drive_download(ctx, v['id'], src, int(v.get('size') or 0), lambda f: ctx.report('tr', 0.1 * f, 'מוריד את הסרטון מ־Drive'))
    ensure_env(ctx)                              # ההורדה רצה בינתיים; ההתקנה (אם חסרה) כבר רצה ברקע מאז run
    title = os.path.splitext(str(ctx.st['spec'].get('name') or ctx.name))[0][:120]
    vt(ctx, ['new', ctx.name, '--source', str(src), '--title', title, '--force'])
    vt(ctx, ['ingest', ctx.name])
    ctx.report('tr', 0.15, 'כותבים כל מילה שנאמרת', force=True)
    vt(ctx, ['asr', ctx.name, '--engine', 'parakeet'], 'tr', 0.15, 0.95)
    if not a:
        vt(ctx, ['shots', ctx.name])             # חילופי שוטים צריכים וידאו — מהקול זה קורה ב־attach_video
    vt(ctx, ['edit-export', ctx.name])
    ctx.st['src'] = 'a' if a else 'v'
    save_state(ctx.st)
    save_ck(ctx, 'asr')
    ctx.report('tr', 1, 'התמליל מוכן — Claude מגיה אותו', force=True)
    print('✓ התמלול הסתיים' + (' (מהקול — הסרטון יצורף ב־align).' if a else '.'))
    print('ההגהה: ' + str(ctx.pdir / 'en.edit.txt') + '  →  תיקונים ב־' + str(ctx.pdir / 'en.patch.txt'))
    print('אחר כך (ברקע): python3 translator/job.py align')
    return 0


def set_source(pd, src):
    """המקור של פרויקט vt (project.json — לפני v361 נכתב בטעות meta.json, ו־vt האמיתי לא היה רואה את הסרטון)."""
    mp = pd / 'project.json'
    meta = json.loads(mp.read_text(encoding='utf-8'))
    meta['source'] = str(src)
    mp.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')


SYNC_MIN_CONF = 0.6      # מתחת לזה ההיסט לא ודאי → מתמללים מחדש מהסרטון (בלי טוקנים, וההגהה נשמרת)


def shift_words(pdir, off):
    """מזיז את זמני המילים בכל קובצי התמלול (asr/*.json) — מציר הזמן של הקול לציר הזמן של הסרטון."""
    n = 0
    for p in sorted((pdir / 'asr').glob('*.json')):
        d = json.loads(p.read_text(encoding='utf-8'))
        for w in d.get('words') or []:
            for k in ('s', 'e'):
                if isinstance(w.get(k), (int, float)):
                    w[k] = round(max(0.0, w[k] + off), 3)
        p.write_text(json.dumps(d, ensure_ascii=False), encoding='utf-8')
        n += 1
    return n


def attach_video(ctx):
    """v360: הסרטון מצטרף לפרויקט שתומלל מהקול: מקור חדש לפרויקט (vt ingest), מדידת ההיסט בין הקולות (sync.py)
    והזזת זמני המילים — כך שהיישור, הכתוביות והצריבה על ציר הזמן של הסרטון. היסט לא ודאי → תמלול מחדש מהסרטון."""
    v = wait_video(ctx, 'al', 'מחכה שהסרטון יסיים לעלות')
    src = in_path(ctx, v, 'v')
    ctx.report('al', 0, 'מוריד את הסרטון מ־Drive', force=True)
    drive_download(ctx, v['id'], src, int(v.get('size') or 0), lambda f: ctx.report('al', 0.05 * f, 'מוריד את הסרטון מ־Drive'))
    pd = ctx.pdir
    first = pd / 'audio16k.first.wav'
    if (pd / 'audio16k.wav').exists():
        (pd / 'audio16k.wav').replace(first)
    for old in pd.glob('source.*'):              # הקול כבר לא המקור (vt בוחר את source.* הראשון בסדר האלפביתי)
        old.unlink()
    set_source(pd, src)
    vt(ctx, ['ingest', ctx.name, '--force'])
    off, conf = 0.0, 0.0
    if first.exists():
        r = subprocess.run([VT_PY, str(HERE / 'sync.py'), str(first), str(pd / 'audio16k.wav')], capture_output=True, text=True)
        try:
            off, conf = (float(x) for x in (r.stdout or '').split()[:2])
        except ValueError:
            off, conf = 0.0, 0.0
    if conf >= SYNC_MIN_CONF:
        if abs(off) >= 0.0005:
            shift_words(pd, off)
        print('✓ הסרטון צורף · היסט %+.3f שנ׳ (ודאות %.2f)' % (off, conf))
    else:
        print('· ההיסט בין הקול לסרטון לא ודאי (%.2f) — מתמללים מחדש מהסרטון (בלי טוקנים, ההגהה נשמרת)' % conf)
        ctx.report('al', 0.05, 'כותבים שוב מהסרטון עצמו', force=True)
        vt(ctx, ['asr', ctx.name, '--engine', 'parakeet'], 'al', 0.05, 0.3)
    vt(ctx, ['shots', ctx.name])
    ctx.st['src'] = 'v'
    ctx.st['sync'] = {'off': round(off, 4), 'conf': round(conf, 3)}
    save_state(ctx.st)


@guarded
def align(args):
    ctx = Ctx(load_state())
    base = 0.0
    if ctx.st.get('src') == 'a':
        attach_video(ctx)
        base = 0.3                               # ההורדה וההתאמה כבר הזיזו את השלב — הפס לא חוזר אחורה
    vt(ctx, ['edit-import', ctx.name])
    ctx.report('al', base, 'מתאימים כל מילה לרגע שבו נאמרה', force=True)
    vt(ctx, ['align', ctx.name], 'al', base, 0.9)
    vt(ctx, ['plan', ctx.name])
    vt(ctx, ['tr-prep', ctx.name])
    save_ck(ctx, 'al')
    ctx.report('al', 1, 'הכתוביות מתוכננות — מתחילים לתרגם', force=True)
    print('✓ היישור והתכנון הסתיימו. לתרגום: ' + str(ctx.pdir / 'tr' / 'source.md'))
    return 0


@guarded
def stage(args):
    ctx = Ctx(load_state())
    if args.st not in STAGES:
        raise SystemExit('✗ שלב לא מוכר: ' + ', '.join(STAGES))
    ctx.report(args.st, args.p, args.msg, force=True)
    print('✓ דווח: ' + args.st + ('' if args.p is None else ' %d%%' % round(args.p * 100)))
    return 0


@guarded
def ask(args):
    """שלב 3 סבב ד׳: שאלה קצרה למשתמש באמצע העבודה. מופיעה בטלפון בדף העבודה; מחכים לתשובה עד --wait שניות,
    ואם לא ענו — ממשיכים עם ברירת המחדל (והטלפון מראה שהמשכנו). השורה האחרונה בפלט היא מה שהסשן ממשיך איתו:
    "תשובה: …" / "ברירת מחדל: …" / "אין תשובה — להחליט לבד"."""
    ctx = Ctx(load_state())
    opts = [o.strip() for o in (args.opt or []) if o and o.strip()][:4]
    d = args.default if opts and 0 <= args.default < len(opts) else (0 if opts else -1)
    wait = max(60, min(1800, int(args.wait)))
    qid = 'q' + format(int(time.time() * 1000) % (36 ** 8), 'x')[-12:]
    try:
        ctx.report(ask={'id': qid, 'q': args.q, 'o': opts, 'd': d, 'w': wait}, force=True)
    except SystemExit as e:
        if 'ask_limit' in str(e):
            print('· כבר נשאלו מספיק שאלות בעבודה הזו — להחליט לבד.')
            print('אין תשובה — להחליט לבד' if d < 0 else 'ברירת מחדל: ' + opts[d])
            return 0
        raise
    print('השאלה נשלחה לטלפון — מחכה לתשובה עד %d דק׳.' % round(wait / 60))
    poll = float(os.environ.get('SNB_ASK_POLL', '10'))
    end = time.time() + wait * float(os.environ.get('SNB_ASK_WAIT_SCALE', '1'))   # בדיקות: זמן מקוצר
    while time.time() < end:
        time.sleep(poll)
        qa = (ctx.c.call('claim').get('job') or {}).get('qa') or {}
        if qa.get('id') != qid:
            break                                     # שאלה אחרת החליפה אותה — לא אמור לקרות
        a = qa.get('a')
        if a:
            print('תשובה: ' + str(a.get('t') or ''))
            return 0
    try:
        ctx.report(askTimeout=qid, force=True)
    except SystemExit:
        pass
    print('· לא ענו בזמן.')
    print('אין תשובה — להחליט לבד' if d < 0 else 'ברירת מחדל: ' + opts[d])
    return 0


@guarded
def fail(args):
    ctx = Ctx(load_state())
    err = args.err if ERR_RE.match(args.err or '') else 'worker'
    ctx.report(fail=True, err=err, msg=args.msg, force=True, usage=usage_safe())
    print('✓ העבודה סומנה "נכשלה" (' + err + ').')
    return 0


def fix(args):
    """v364: ספר התיקונים — אחרי אבחון של עצירה (בהמשך העבודה), משפט אחד: מה עושים כשהתקלה הזו חוזרת."""
    st = load_state()
    ls = st.get('ls') or {}
    if not FP_RE.match(str(ls.get('fp') or '')):
        print('✗ אין עצירה של מגדל הפיקוח בהפעלה הזו — אין למה לרשום תיקון.')
        return 1
    t = re.sub(r'\s+', ' ', re.sub(r'[\x00-\x1f\x7f]', ' ', args.text or '')).strip()
    if len(t) < 4:
        print('✗ התיקון קצר מדי — משפט אחד: מה עושים כשזה קורה.')
        return 1
    Ctx(st).report(fix={'fp': ls['fp'], 't': t[:160]}, force=True)
    print('✓ התיקון נרשם בספר התיקונים. בפעם הבאה שהתקלה תתחיל לחזור, המגדל יזכיר אותו.')
    return 0


def vt_cmd(args):
    """קיצור לסשן: פקודת vt על הפרויקט של העבודה, עם הסביבה הנכונה (למשל: job.py vt tr-check)."""
    st = load_state()
    rest = list(args.rest)
    if not rest:
        raise SystemExit('✗ חסרה פקודה, למשל: python3 translator/job.py vt tr-check')
    cmd = [VT_PY, '-m', 'vt', rest[0]] + ([st['job']] if rest[0] not in ('doctor', 'drive') else []) + rest[1:]
    return subprocess.run(cmd, cwd=str(HERE), env=vt_env()).returncode


OUT_FILES = (                                     # (סוג, קובץ של vt, סיומת לשם, mime)
    ('compact', '{n}.he.compact.mp4', ' (עברית).mp4', 'video/mp4'),
    ('same', '{n}.he.mp4', ' (עברית, איכות מקור).mp4', 'video/mp4'),
    ('mkv', '{n}.he.mkv', ' (עברית).mkv', 'video/x-matroska'),
    ('srt', 'he.srt', '.he.srt', 'application/x-subrip'),
)


@guarded
def finish(args):
    ctx = Ctx(load_state())
    spec = ctx.st.get('spec') or {}
    want = [k for k in (spec.get('out') or []) if k in ('compact', 'same', 'mkv')]
    errs = re.findall(r'שגיאות (\d+)', '\n'.join(vt(ctx, ['tr-check', ctx.name])))
    if (not errs or int(errs[-1]) > 0) and not args.force:
        raise SystemExit('✗ tr-check מצא שגיאות — לתקן ב־tr/fixes_zfinal.txt ולהריץ שוב: grep -A2 "שגיא" ' + str(ctx.pdir / 'tr' / 'check.md'))
    save_ck(ctx, 'rv')                           # התרגום אחרי הביקורת — אם הצריבה או ההעלאה נקטעות, ממשיכים מכאן
    vt(ctx, ['tr-merge', ctx.name])
    vt(ctx, ['build', ctx.name])
    if want:
        ctx.report('bn', 0, 'מוסיפים את הכתוביות לסרטון', force=True)
        flags = (['--compact'] if 'compact' in want else []) + (['--burn'] if 'same' in want else []) + (['--mkv'] if 'mkv' in want else [])
        vt(ctx, ['render', ctx.name] + flags, 'bn', 0.0, 1.0)
    ctx.report('sv', 0, 'שומרים את התוצרים ב־Drive', force=True)
    title = os.path.splitext(str(spec.get('name') or ctx.name))[0][:120]
    out, total = [], 0
    files = []
    for k, fname, suffix, mime in OUT_FILES:
        if k != 'srt' and k not in want:
            continue
        p = ctx.pdir / 'out' / fname.format(n=ctx.name)
        if not p.exists():
            raise SystemExit('✗ התוצר ' + p.name + ' לא נוצר.')
        files.append((k, p, title + suffix, mime))
        total += p.stat().st_size
    done = 0
    for k, p, name, mime in files:
        base = done
        fid = drive_upload(ctx, p, name, k, mime, lambda f, b=base, s=p.stat().st_size: ctx.report('sv', (b + f * s) / max(1, total)))
        done += p.stat().st_size
        out.append({'id': fid, 'name': name, 'size': p.stat().st_size, 'k': k})
    ctx.report(done=True, out=out, msg='התרגום מוכן', force=True, usage=usage_safe())
    print('✓ העבודה הסתיימה: ' + ', '.join(o['name'] for o in out))
    return 0


# ---------------------------------------------------------------- נקודות שמירה (v361)
# ארכיון של הפרויקט בלי המדיה (הסרטון, הקול והצריבות כבר ב־Drive או נוצרים מחדש בלי טוקנים) — כמה MB לשעת סרטון
CK_SKIP_DIRS = {'out', '_dl', 'preview'}
CK_SKIP_EXT = {'.mp4', '.mkv', '.mov', '.webm', '.m4v', '.ts', '.m4a', '.mp3', '.wav', '.ogg', '.opus', '.flac', '.aac'}
CK_FILE_MAX = 64 * 1024 * 1024
CK_TOTAL_MAX = 512 * 1024 * 1024
CK_INFO = '_snb.json'
CK_NEXT = {   # מאיזה שלב בעבודה ממשיכים אחרי כל נקודה (השלב בטלפון, ומה הסשן עושה)
    'asr': ('tr', 'הגהה: קרא את en.edit.txt פעם אחת ותקן ב־en.patch.txt (RUNBOOK סעיף 2, שלב 2), ואז align ברקע.'),
    'al': ('tl', 'מלא את tr/brief.md ו־tr/glossary.tsv (קרא את en.edit.txt פעם אחת), ואז תרגום ו־save tl (RUNBOOK סעיף 2, שלבים 3–4).'),
    'tl': ('rv', 'ביקורת (RUNBOOK סעיף 2, שלב 5), ואז finish ברקע.'),
    'rv': ('bn', 'python3 translator/job.py finish ברקע (RUNBOOK סעיף 2, שלב 6).'),
}


def ck_files(pdir):
    """הקבצים שנכנסים לנקודת השמירה (נתיבים יחסיים, בסדר קבוע)."""
    out = []
    for p in sorted(pdir.rglob('*')):
        rel = p.relative_to(pdir)
        if p.is_symlink() or not p.is_file() or rel.parts[0] in CK_SKIP_DIRS or rel.name == CK_INFO:
            continue
        # source.* = המקור בשורש הפרויקט (קישור לסרטון) — לא tr/source.md, קובץ התרגום
        if p.suffix.lower() in CK_SKIP_EXT or (len(rel.parts) == 1 and rel.name.startswith('source.')) or p.stat().st_size > CK_FILE_MAX:
            continue
        out.append(rel)
    return out


def ck_pack(pdir, s, info, dest):
    """tar.gz של הפרויקט + _snb.json (השלב, מאיפה תומלל, ההיסט). בלי מפתח העבודה ובלי גישה ל־Drive — רק תוצרי vt."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    meta = json.dumps(dict(info, v=1, s=s, at=int(time.time())), ensure_ascii=False).encode('utf-8')
    with tarfile.open(dest, 'w:gz', compresslevel=6) as t:
        ti = tarfile.TarInfo(CK_INFO)
        ti.size, ti.mtime = len(meta), int(time.time())
        t.addfile(ti, io.BytesIO(meta))
        for rel in ck_files(pdir):
            t.add(str(pdir / rel), arcname=rel.as_posix(), recursive=False)
    return dest


def ck_unpack(src, dest):
    """פתיחה בטוחה: רק קבצים ותיקיות רגילים, נתיבים יחסיים בלי .., עד CK_TOTAL_MAX. מחזיר את _snb.json."""
    with tarfile.open(src, 'r:gz') as t:
        members, total = [], 0
        for m in t.getmembers():
            parts = Path(m.name).parts
            if m.name.startswith(('/', '\\')) or '..' in parts or not parts or not (m.isfile() or m.isdir()):
                raise ValueError('נתיב לא תקין בארכיון')
            total += m.size
            if total > CK_TOTAL_MAX:
                raise ValueError('הארכיון גדול מדי')
            members.append(m)
        if CK_INFO not in [m.name for m in members]:
            raise ValueError('חסר ' + CK_INFO)
        dest.mkdir(parents=True, exist_ok=True)
        for m in members:
            out = dest.joinpath(*Path(m.name).parts)
            if m.isdir():
                out.mkdir(parents=True, exist_ok=True)
                continue
            out.parent.mkdir(parents=True, exist_ok=True)
            with t.extractfile(m) as f, open(out, 'wb') as w:
                shutil.copyfileobj(f, w)
    info = json.loads((dest / CK_INFO).read_text(encoding='utf-8'))
    (dest / CK_INFO).unlink()
    if info.get('s') not in CK_STAGES or not (dest / 'project.json').exists():
        raise ValueError('נקודת שמירה לא שלמה')
    return info


def drive_delete(ctx, fid):
    """מחיקת קובץ שהעובד העלה (נקודת שמירה ישנה). כשל — לא חשוב (נשאר קובץ קטן בתיקייה)."""
    req = urllib.request.Request(ctx.api + '/files/' + fid + '?supportsAllDrives=true', method='DELETE',
                                 headers={'Authorization': 'Bearer ' + ctx.token(), 'User-Agent': UA})
    try:
        with _OPEN(req, timeout=30):
            return True
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def save_ck(ctx, s):
    """נקודת שמירה ב־Drive + דיווח לשרתון. לעולם לא מפילה את העבודה: תקלה = הודעה, וממשיכים בלי."""
    try:
        path = VT_WORK / '_ck' / (ctx.name + '.' + s + '.tar.gz')
        ck_pack(ctx.pdir, s, {'src': ctx.st.get('src') or 'v', 'sync': ctx.st.get('sync') or None}, path)
        size = path.stat().st_size
        fid = drive_upload(ctx, path, 'נקודת שמירה — ' + CK_LABEL[s] + '.tar.gz', s, 'application/gzip', prop='snbCk')
        ctx.report(ck={'s': s, 'id': fid, 'size': size}, force=True)
        old = (ctx.st.get('ckids') or {}).get(s)
        if old and old != fid:
            drive_delete(ctx, old)
        ctx.st.setdefault('ckids', {})[s] = fid
        save_state(ctx.st)
        path.unlink()
        print('✓ נקודת שמירה: אחרי ' + CK_LABEL[s] + ' (%d KB)' % max(1, round(size / 1024)))
        return True
    except Stop:
        raise
    except (SystemExit, OSError, ValueError, tarfile.TarError) as e:
        print('· נקודת השמירה לא נשמרה (' + str(e).strip()[:120] + ') — ממשיכים בלי.')
        return False


@guarded
def save(args):
    """שמירה ידנית אחרי התרגום (RUNBOOK: אחרי שהסוכן המתרגם סיים — לפני הביקורת)."""
    ctx = Ctx(load_state())
    if args.s not in ('tl', 'rv'):
        raise SystemExit('✗ שומרים כך רק אחרי התרגום (tl) או הביקורת (rv).')
    return 0 if save_ck(ctx, args.s) else 1


@guarded
def restore(args):
    """v361: "המשך" — מורידים את נקודת השמירה האחרונה (ואם היא פגומה — את הקודמת), משחזרים את הפרויקט,
    מורידים את הסרטון (או את הקול, אם עוד לא צורף) ומקלטים אותו מחדש. בלי טוקנים. בסוף — מה הסשן עושה עכשיו."""
    ctx = Ctx(load_state())
    cks = ctx.st.get('ck') or []
    pd = ctx.pdir
    info, used = None, None
    for c in reversed(cks):
        st_next = CK_NEXT[c['s']][0]
        ctx.report(st_next, None, 'ממשיכים מנקודת השמירה', force=True)
        tgz = VT_WORK / '_ck' / ('in.' + c['s'] + '.tar.gz')
        tmp = pd.with_name(pd.name + '.restore')
        try:
            if tgz.exists():
                tgz.unlink()
            drive_download(ctx, c['id'], tgz, int(c.get('size') or 0))
            shutil.rmtree(tmp, ignore_errors=True)
            info = ck_unpack(tgz, tmp)
        except (SystemExit, OSError, ValueError, tarfile.TarError) as e:
            print('· נקודת השמירה של ' + CK_LABEL[c['s']] + ' לא נפתחה (' + str(e).strip()[:100] + ') — מנסים את הקודמת.')
            shutil.rmtree(tmp, ignore_errors=True)
            info = None
            continue
        shutil.rmtree(pd, ignore_errors=True)
        tmp.replace(pd)
        tgz.unlink()
        used = c['s']
        break
    if not info:
        ctx.st['ck'] = []
        save_state(ctx.st)
        ctx.report('tr', 0, 'אין נקודת שמירה תקינה — מתחילים מההתחלה', force=True)
        print('· אין נקודת שמירה תקינה — מתחילים מההתחלה.')
        print('הצעד הבא (ברקע, run_in_background): python3 translator/job.py prepare')
        return 0
    st_next, todo = CK_NEXT[used]
    ctx.refresh()
    files = ctx.st.get('files') or {}
    kind = 'a' if info.get('src') == 'a' and (files.get('a') or {}).get('id') else 'v'
    f = files['a'] if kind == 'a' else wait_video(ctx, st_next, 'מחכה שהסרטון יסיים לעלות')
    src = in_path(ctx, f, kind)
    ctx.report(st_next, None, 'מוריד את ' + ('הקול' if kind == 'a' else 'הסרטון') + ' מ־Drive', force=True)
    drive_download(ctx, f['id'], src, int(f.get('size') or 0))
    ensure_env(ctx, st_next)
    set_source(pd, src)
    vt(ctx, ['ingest', ctx.name, '--force'])
    ctx.st['src'] = kind
    if info.get('sync'):
        ctx.st['sync'] = info['sync']
    ctx.st['resumed'] = used
    save_state(ctx.st)
    ctx.report(st_next, 1 if used == 'asr' else 0, 'התמליל מוכן — Claude מגיה אותו' if used == 'asr' else 'ממשיכים מאותה נקודה', force=True)
    print('✓ הפרויקט שוחזר מנקודת השמירה: אחרי ' + CK_LABEL[used] + '.')
    qa = ctx.st.get('qa') or {}
    if qa.get('a') and qa.get('q'):
        print('תשובה קודמת של המשתמש — "' + str(qa['q']) + '": ' + str(qa['a'].get('t') or ''))
    print('הצעד הבא: ' + todo)
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description='העובד בענן של סטודיו התרגום')
    sub = p.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('run', help='לקיחת העבודה שבהודעה ("בדיקת חיבור" מסתיימת כאן)')
    r.add_argument('--job', required=True)
    r.add_argument('--key', required=True)
    r.add_argument('--server', default=SERVER, help=argparse.SUPPRESS)
    r.add_argument('--drive-api', default=DRIVE_API, help=argparse.SUPPRESS)
    sub.add_parser('prepare', help='הורדה, קליטה, תמלול וקובץ ההגהה')
    sub.add_parser('align', help='ייבוא ההגהה, יישור, תכנון וקובץ התרגום')
    s = sub.add_parser('stage', help='דיווח התקדמות לאפליקציה')
    s.add_argument('st')
    s.add_argument('--p', type=float)
    s.add_argument('--msg')
    sub.add_parser('restore', help='המשך: שחזור הפרויקט מנקודת השמירה האחרונה')
    sv = sub.add_parser('save', help='נקודת שמירה אחרי התרגום (tl) / הביקורת (rv)')
    sv.add_argument('s')
    f = sub.add_parser('finish', help='בדיקה, בנייה, צריבה והעלאת התוצרים')
    f.add_argument('--force', action='store_true', help=argparse.SUPPRESS)
    q = sub.add_parser('ask', help='שאלה קצרה למשתמש (בטלפון), עם תשובות מוכנות וברירת מחדל')
    q.add_argument('--q', required=True)
    q.add_argument('--opt', action='append')
    q.add_argument('--default', type=int, default=0)
    q.add_argument('--wait', type=int, default=480)
    e = sub.add_parser('fail', help='סימון העבודה כ"נכשלה"')
    e.add_argument('--err', default='worker')
    e.add_argument('--msg')
    x = sub.add_parser('fix', help='ספר התיקונים: מה עושים כשהתקלה שעצרה את העבודה חוזרת (משפט אחד)')
    x.add_argument('--text', required=True)
    v = sub.add_parser('vt', help='פקודת vt על הפרויקט של העבודה')
    v.add_argument('rest', nargs=argparse.REMAINDER)
    a = p.parse_args(argv)
    if a.cmd != 'run':
        return {'prepare': prepare, 'align': align, 'stage': stage, 'finish': finish, 'fail': fail, 'ask': ask, 'vt': vt_cmd,
                'save': save, 'restore': restore, 'fix': fix}[a.cmd](a)
    if not JOB_RE.match(a.job) or not KEY_RE.match(a.key):
        print('✗ מזהה העבודה או המפתח לא בצורה הנכונה (job=j + 20 תווים, key = 43 תווים).')
        return 1
    if a.server != SERVER and not LOCAL_RE.match(a.server):
        print('✗ שרת לא מוכר.')
        return 1
    if a.drive_api != DRIVE_API and not LOCAL_RE.match(re.sub(r'/drive/v3$', '', a.drive_api)):
        print('✗ שרת Drive לא מוכר.')
        return 1
    return run(a)


if __name__ == '__main__':
    sys.exit(main())
