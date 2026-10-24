"""ההעברה (24/10/2026, בקשת המשתמש: "שהיישור והצריבה יהיו על השרת שלנו גם במצב Routine").

עבודת "המנוי שלי" רצה בשרת שלנו מקצה לקצה (הורדה, תמלול, יישור, צריבה — כמו עבודת שרת), ורק הקריאות ל־Claude
עוברות דרך תור בזיכרון של השרתון (ibkr-proxy/lib/relay.js) ל־Routine של המשתמש, שמריץ אותן ב־claude -p על המנוי שלו.

שני צדדים, בלי תלויות:
  call(...)  — העובד בשרת: בקשה אחת ל־Claude דרך התור (llm.Engine._relay0).
  serve(...) — ה־Routine: מושך בקשות מהתור, מריץ (runner) ומחזיר תשובות — עד שהתור אומר "סוף".

מדיניות: אין כאן טוקן של מנוי. הקריאות רצות בבינארי הרשמי, בתוך הסשן של המשתמש, רק לעבודות שלו.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import threading
import time
import urllib.error
import urllib.request

UA = 'snb-studio-relay/1'
WAIT_MS = 25000                                           # המתנה ארוכה — = WAIT_MAX בשרתון
FIRST_WAIT = float(os.environ.get('SNB_RELAY_FIRST', '600'))   # ה־Routine לא התחבר בזמן הזה → relay_none
IDLE_MAX = float(os.environ.get('SNB_RELAY_IDLE', '300'))      # ה־Routine התחבר והפסיק לשאול → relay_lost
NET_MAX = float(os.environ.get('SNB_RELAY_NET', '180'))        # השרתון לא עונה ברצף → relay_lost
CALL_MAX = float(os.environ.get('SNB_RELAY_CALL', '3600'))     # בקשה אחת לא נענתה (נלקחה ונעלמה) → api_timeout
PAR = int(os.environ.get('SNB_RELAY_PAR', '6'))                # כמה קריאות ל־Claude במקביל בצד ה־Routine


class RelayError(RuntimeError):
    def __init__(self, code: str, msg: str = ''):
        super().__init__(msg or code)
        self.code = code


def post(base: str, body: dict, timeout: float = 40) -> dict:
    """POST אחד לשרתון. רשת / 5xx = RelayError('net'); 4xx = התשובה (ok: false + error)."""
    data = json.dumps(body, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(base.rstrip('/') + '/api/studio', data=data, method='POST',
                                 headers={'Content-Type': 'application/json', 'User-Agent': UA})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode('utf-8') or '{}')
    except urllib.error.HTTPError as e:
        if e.code >= 500 and e.code != 503:
            raise RelayError('net', 'HTTP %d' % e.code) from e
        try:
            out = json.loads(e.read().decode('utf-8') or '{}')
        except ValueError:
            out = {}
        out.setdefault('ok', False)
        out.setdefault('error', 'http_%d' % e.code)
        return out
    except (urllib.error.URLError, OSError, ValueError) as e:
        raise RelayError('net', type(e).__name__) from e


def fh_of(fixed: str) -> str:
    return hashlib.sha1(fixed.encode('utf-8')).hexdigest()


# ------------------------------------------------------------------ העובד בשרת
def call(base: str, job: str, key: str, *, k: str, model: str, effort: str, max_tokens: int,
         fixed: str, extra: str, prompt: str, on_first_token=None, sleep=time.sleep, clock=time.time) -> dict:
    """בקשה אחת. מחזיר את התשובה כפי שה־Routine שלח: {t, u, st, th} — או זורק RelayError(קוד)."""
    rid = secrets.token_urlsafe(18)
    fh = fh_of(fixed)
    req = {'op': 'rlPut', 'job': job, 'key': key, 'rid': rid, 'k': (k or '')[:8], 'm': model, 'e': effort or 'medium',
           'mt': int(max_tokens), 'fh': fh, 'ex': extra or '', 'pr': prompt}
    t0, net0, started = clock(), None, False

    def send(body):
        nonlocal net0
        while True:
            try:
                out = post(base, body)
                net0 = None
                return out
            except RelayError:
                net0 = net0 or clock()
                if clock() - net0 > NET_MAX:
                    raise RelayError('relay_lost', 'השרתון לא עונה')
                sleep(5)

    def put():
        while True:
            out = send(req)
            if out.get('ok'):
                return
            err = out.get('error')
            if err == 'need_fixed':
                fx = send({'op': 'rlFix', 'job': job, 'key': key, 'fh': fh, 'fx': fixed})
                if not fx.get('ok') and fx.get('error') != 'hub_full':
                    raise RelayError('relay_error', 'rlFix: ' + str(fx.get('error')))
                if fx.get('ok'):
                    continue
            if err == 'hub_full' or (err == 'need_fixed'):
                if clock() - t0 > CALL_MAX:
                    raise RelayError('api_timeout', 'התור מלא')
                sleep(5)
                continue
            if out.get('stop') or err in ('bad_key', 'stop', 'ended'):
                raise RelayError('relay_stop', str(out.get('state') or err))
            if err == 'no_hub':
                raise RelayError('relay_hub', 'אין תור בשרתון הזה')
            raise RelayError('relay_error', str(err or 'failed')[:40])

    put()
    while True:
        out = send({'op': 'rlWait', 'job': job, 'key': key, 'rid': rid, 'w': WAIT_MS})
        if not out.get('ok'):
            if out.get('stop') or out.get('error') in ('bad_key', 'stop'):
                raise RelayError('relay_stop', str(out.get('state') or out.get('error')))
            if out.get('error') == 'rate_limited':
                sleep(5)
                continue
            raise RelayError('relay_error', str(out.get('error') or 'failed')[:40])
        st, idle = out.get('st'), out.get('idle', -1)
        if st == 'd':
            if not started and on_first_token is not None:
                on_first_token()                      # מהיר מדי לראות את "התחיל" — מי שמחכה לכתיבת המטמון משתחרר בכל זאת
            return out.get('ans') or {}
        if st in ('unknown',):
            put()                                     # השרתון עלה מחדש — שולחים שוב (אותו rid)
            continue
        if st == 'ended':
            raise RelayError('relay_stop', 'ended')
        if st == 's' and not started:
            started = True
            if on_first_token is not None:
                on_first_token()
        if not isinstance(idle, (int, float)):
            idle = -1
        if idle < 0 and clock() - t0 > FIRST_WAIT:
            raise RelayError('relay_none', 'ה־Routine לא התחבר')
        if idle >= 0 and idle / 1000.0 > IDLE_MAX:
            raise RelayError('relay_lost', 'ה־Routine הפסיק לענות')
        if clock() - t0 > CALL_MAX:
            raise RelayError('api_timeout', 'הבקשה לא נענתה')


def end(base: str, job: str, key: str, why: str = 'done') -> None:
    try:
        post(base, {'op': 'rlEnd', 'job': job, 'key': key, 'why': why}, timeout=15)
    except RelayError:
        pass


# ------------------------------------------------------------------ ה־Routine
def serve(base: str, job: str, key: str, runner, *, par: int = PAR, log=print, sleep=time.sleep, clock=time.time) -> int:
    """מושך בקשות ומריץ עד par במקביל. runner(req, fixed, started) → {t,u,st,th} או {err}. מחזיר 0 בסוף רגיל."""
    fixed: dict = {}
    busy: dict = {}
    lock = threading.Lock()
    net0, done_n = None, 0

    def mark(body):
        for _ in range(30):
            try:
                out = post(base, dict(body, op='rlMark', job=job, key=key), timeout=60)
                return out
            except RelayError:
                sleep(5)
        return {}

    def one(r):
        nonlocal done_n
        fx = fixed.get(r['fh'])
        flag = {'s': False}

        def started():
            if not flag['s']:
                flag['s'] = True
                mark({'rid': r['rid'], 'st': 's'})
        try:
            ans = runner(r, fx, started)
        except Exception as e:                    # noqa: BLE001 — כל תקלה = קוד, לא קריסה של הלולאה
            ans = {'err': getattr(e, 'code', None) or 'cli_error'}
        mark({'rid': r['rid'], 'st': 'd', 'ans': ans})
        with lock:
            busy.pop(r['rid'], None)
            done_n += 1

    while True:
        with lock:
            free = max(0, par - len(busy))
        try:
            out = post(base, {'op': 'rlNext', 'job': job, 'key': key, 'have': list(fixed)[:64], 'max': free,
                              'w': WAIT_MS if free else 5000}, timeout=40)
            net0 = None
        except RelayError:
            net0 = net0 or clock()
            if clock() - net0 > NET_MAX:
                log('✗ השרתון לא עונה כבר כמה דקות — עוצר.')
                return 1
            sleep(5)
            continue
        if not out.get('ok'):
            err = out.get('error')
            if out.get('stop') or err in ('bad_key', 'stop'):
                log('■ העבודה הסתיימה בשרת (' + str(out.get('state') or err) + ').')
                break
            if err in ('rate_limited', 'hub_full', 'no_hub'):
                sleep(10)
                continue
            log('✗ ' + str(err))
            sleep(10)
            continue
        for h, t in (out.get('fx') or {}).items():
            if isinstance(t, str) and fh_of(t) == h:
                fixed[h] = t
        for r in out.get('reqs') or []:
            if not isinstance(r, dict) or r.get('fh') not in fixed:
                continue
            with lock:
                busy[r['rid']] = r
            threading.Thread(target=one, args=(r,), daemon=True).start()
        if out.get('end'):
            log('■ העבודה הסתיימה בשרת (' + str(out['end']) + ').')
            break
        if not free:
            sleep(1)
    for _ in range(int(CALL_MAX)):                # מסיימים את מה שבדרך (התשובות כבר לא נחוצות — רק לא לנתק באמצע)
        with lock:
            if not busy:
                break
        sleep(1)
    log('✓ ' + str(done_n) + ' קריאות ל־Claude הועברו.')
    return 0
