#!/usr/bin/env python3
"""מגדל הפיקוח (v362, שלב 3 סבב ו׳) — שומר שתקלה בעבודת תרגום לא תשרוף את המכסה של המשתמש.

רץ כ־Hook של Claude Code לפני כל פעולה (PreToolUse), גם בתוך סוכני־משנה. מוגדר רק בסביבה "סטודיו":
setup.sh כותב אותו ל־~/.claude/settings.json בבניית תמונת המצב (לא בריפו — סשני הפיתוח לא מושפעים).
פעיל רק בסשן של העובד: כשיש עבודה פעילה בקובץ המצב של job.py (עד 50 שעות). בכל סשן אחר — יוצא מיד בלי לעשות כלום.

מה הוא בודק (כל 30 שנ׳; ספירת הפעולות — בכל פעולה):
  עלות — פי 4 מהרגיל ביחס להתקדמות, ולפחות 3$ מעל הצפוי · פי 5 מהצפוי לכל העבודה (תמיד)
  לולאה — אותה שגיאה 6 פעמים ב־15 דק׳ · אותה פעולה בדיוק 10 פעמים ב־15 דק׳
  תקיעה — 20 דק׳ בלי התקדמות, בזמן שנצרכו לפחות 1.5$
  פי 2 מהרגיל = צהוב ("חריג, עוקבים") — בלי לעצור.
עצירה (דגל אדום): מדווח לשרתון (העבודה "נכשלה" עם הפרטים — הטלפון מציג "עצרנו את העבודה" ו"המשך מאותה נקודה"),
ומכאן כל פעולה של Claude ושל סוכני־המשנה נחסמת ו־Claude נעצר (continue: false). "הרגיל" = מחירון ה־API של העבודה
(job.usage) מול הצפוי לפי אורך הסרטון והמצב שנבחר. תקלה במגדל עצמו לא עוצרת שום דבר (כל שגיאה → פעולה מותרת).
"""
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import job as J  # noqa: E402  (הלקוח לשרתון, קובץ המצב ו־usage)

TOWER = J.STATE.parent / 'tower.json'
PROG = J.STATE.parent / 'prog.json'
ACTIVE_FOR = 50 * 3600          # קובץ עבודה ישן מזה — לא פעיל (סשן אחר / עבודה שנגמרה מזמן)
CHECK_EVERY = float(os.environ.get('SNB_TOWER_EVERY', '30'))   # בדיקות: 0 = בכל פעולה
WINDOW = 15 * 60
# הצפוי לשעת סרטון, לפי מחירון ה־API (המבחנים: ראיון של שעה ב־Opus 5.5 Medium ≈ 5–6$) + פתיחת הסשן והסוכנים
PER_HOUR = {'opus-medium': 6.0, 'opus-high': 8.5, 'opus-max': 13.0, 'sonnet-medium': 3.0, 'sonnet-high': 4.2}
FIXED = 1.5
# כמה מהטוקנים כל שלב צורך בדרך כלל — "יחסית להתקדמות": עבודה באמצע נמדדת מול חצי מהצפוי
WEIGHT = (('up', 0.0), ('tr', 0.08), ('al', 0.07), ('tl', 0.55), ('rv', 0.25), ('bn', 0.03), ('sv', 0.02))
FRAC_MIN = 0.2                  # בתחילת העבודה — לא מודדים מול כמעט־אפס
RED_X, WARN_X, CAP_X = 4.0, 2.0, 5.0
MIN_EXCESS = 3.0                # $ מעל הצפוי — סטייה קטנה בעבודה קטנה לא עוצרת
LOOP_ERRS, LOOP_CALLS = 6, 10
IDLE_SEC, IDLE_USD = 20 * 60, 1.5
POLL_TOOLS = {'BashOutput', 'TaskOutput', 'TaskGet', 'TaskList', 'TodoWrite', 'KillShell', 'TaskStop'}


# ---------------------------------------------------------------- חישובים (טהורים — נבדקים בנפרד)
def expected_usd(spec):
    """כמה עבודה כזו עולה בדרך כלל (בדולרים לפי מחירון ה־API). אורך לא ידוע = שעה."""
    spec = spec or {}
    hours = (spec.get('dur') or 3600) / 3600.0
    return FIXED + PER_HOUR.get(spec.get('mode') or 'opus-medium', PER_HOUR['opus-medium']) * hours


def progress_frac(st, p):
    """כמה מהעבודה (במשקל הטוקנים) כבר מאחורינו."""
    done = 0.0
    for s, w in WEIGHT:
        if s == st:
            return done + w * max(0.0, min(1.0, p or 0.0))
        done += w
    return 0.0


def fingerprint(text):
    """טביעת אצבע לשגיאה: השורה הראשונה בלי מספרים ונתיבים — אותה תקלה בכתובית אחרת = אותה טביעה."""
    t = (str(text or '').strip().splitlines() or [''])[0][:240]
    t = re.sub(r'/[^\s:\'"]+', '/…', t)
    t = re.sub(r'\d+', '#', t)
    return hashlib.sha1(t.encode('utf-8', 'replace')).hexdigest()[:12]


def assess(now, usd, exp_total, frac, errs, calls, prog_chg, usd_then):
    """המצב: ('ok'|'warn'|'red', סיבה, פרטים). errs/calls = [(זמן, טביעה)] · usd_then = הצריכה לפני IDLE_SEC."""
    so_far = exp_total * max(frac, FRAC_MIN)
    x = round(usd / so_far, 1) if so_far > 0 else 0.0
    info = {'x': x, 'usd': round(usd, 2), 'exp': round(so_far, 2)}
    if usd > CAP_X * exp_total:
        return 'red', 'cap', info
    if x >= RED_X and usd - so_far >= MIN_EXCESS:
        return 'red', 'cost', info
    for kind, lst, lim in (('loop', errs, LOOP_ERRS), ('calls', calls, LOOP_CALLS)):
        cnt = {}
        for t, k in lst:
            if now - t <= WINDOW:
                cnt[k] = cnt.get(k, 0) + 1
        top = max(cnt.values()) if cnt else 0
        if top >= lim:
            return 'red', kind, dict(info, n=top)
    if prog_chg and now - prog_chg >= IDLE_SEC and usd_then is not None and usd - usd_then >= IDLE_USD:
        return 'red', 'idle', dict(info, min=int((now - prog_chg) // 60))
    if x >= WARN_X:
        return 'warn', '', info
    return 'ok', '', info


# ---------------------------------------------------------------- מה קרה בסשן (מהיומנים)
def _ts(s):
    try:
        return datetime.fromisoformat(str(s).replace('Z', '+00:00')).timestamp()
    except ValueError:
        return 0.0


def recent_errors(now, root=None):
    """השגיאות של הכלים ב־15 הדקות האחרונות (הסשן הראשי וסוכני־המשנה) — [(זמן, טביעה)]."""
    out = []
    base = Path(root) if root else J.PROJECTS
    if not base.exists():
        return out
    for p in base.rglob('*.jsonl'):
        try:
            if now - p.stat().st_mtime > WINDOW + 60:
                continue
            with open(p, encoding='utf-8', errors='replace') as f:
                for line in f:
                    if '"is_error":true' not in line.replace(' ', ''):
                        continue
                    try:
                        rec = json.loads(line)
                    except ValueError:
                        continue
                    t = _ts(rec.get('timestamp'))
                    if now - t > WINDOW:
                        continue
                    for c in ((rec.get('message') or {}).get('content') or []):
                        if isinstance(c, dict) and c.get('type') == 'tool_result' and c.get('is_error'):
                            body = c.get('content')
                            if isinstance(body, list):
                                body = ' '.join(str(x.get('text') or '') for x in body if isinstance(x, dict))
                            out.append((t, fingerprint(body)))
        except OSError:
            continue
    return out


# ---------------------------------------------------------------- מצב המגדל
def load(path=None):
    try:
        return json.loads((path or TOWER).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def store(d, path=None):
    p = path or TOWER
    tmp = p.with_suffix('.tmp')
    tmp.write_text(json.dumps(d), encoding='utf-8')
    tmp.replace(p)


def active_state():
    """העבודה הפעילה בסשן הזה, או None (אין עבודה / ישנה מדי / המגדל כבוי)."""
    if os.environ.get('SNB_TOWER') == 'off':
        return None
    try:
        if time.time() - J.STATE.stat().st_mtime > ACTIVE_FOR:
            return None
        st = json.loads(J.STATE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None
    if not J.JOB_RE.match(str(st.get('job') or '')) or not J.KEY_RE.match(str(st.get('key') or '')):
        return None
    return st


WHY = {
    'cost': 'Claude צרך פי {x} מהרגיל לעבודה בשלב הזה',
    'cap': 'הצריכה עברה פי 5 מהצפוי לכל העבודה',
    'loop': 'אותה שגיאה חזרה {n} פעמים ב־15 דקות — סימן ללולאה',
    'calls': 'אותה פעולה חזרה {n} פעמים ב־15 דקות — סימן ללולאה',
    'idle': '{min} דקות בלי התקדמות, בזמן שהטוקנים ממשיכים להיצרך',
    'server': 'העבודה בוטלה או הועברה לסשן אחר',
}


def stop_reason(red):
    why = WHY.get(red.get('why'), 'צריכה לא סבירה').format(**{k: red.get(k, '') for k in ('x', 'n', 'min')})
    return ('⛔ מגדל הפיקוח עצר את העבודה: ' + why + '. אל תמשיך ואל תנסה לעקוף — סכם בשורה אחת וסיים. '
            'הכל שמור; המשתמש יחליט בטלפון אם להמשיך מאותה נקודה.')


def block(red):
    """עצירה: Claude מפסיק (continue: false), וכל פעולה — גם של סוכן־משנה שעוד רץ — נחסמת."""
    msg = stop_reason(red)
    return {'continue': False, 'stopReason': msg, 'hookSpecificOutput': {
        'hookEventName': 'PreToolUse', 'permissionDecision': 'deny', 'permissionDecisionReason': msg}}


def check(st, tw, now):
    """בדיקה מלאה (כל CHECK_EVERY): צריכה, שגיאות, התקדמות, ודיווח לשרתון (שגם אומר אם לעצור). מחזיר דגל אדום או None."""
    use = J.usage() or []
    usd = sum(r.get('usd') or 0.0 for r in use)
    prog = load(PROG)
    frac = progress_frac(prog.get('st'), prog.get('p'))
    samples = [s for s in tw.get('samples', []) if now - s[0] <= IDLE_SEC + 600] + [[now, round(usd, 4)]]
    tw['samples'] = samples[-200:]
    then = [s[1] for s in samples if now - s[0] >= IDLE_SEC]
    lv, why, info = assess(now, usd, expected_usd(st.get('spec')), frac, recent_errors(now),
                           [(t, k) for t, k in tw.get('calls', [])], prog.get('chg') or prog.get('at'),
                           then[-1] if then else None)
    tw['lv'], tw['info'] = lv, info
    c = J.Client(st['server'], st['job'], st['key'])
    try:
        if lv == 'red':
            red = dict(info, why=why, at=now)
            c.call('report', fail=True, err='tower_stop', tower=dict(info, lv='red', why=why), usage=use or None)
            return red
        if lv != tw.get('sent_lv') or now - tw.get('sent_at', 0) >= 300:
            c.call('report', tower=dict(info, lv=lv))
            tw['sent_lv'], tw['sent_at'] = lv, now
    except J.Stop:
        return {'why': 'server', 'at': now}
    except SystemExit:
        pass                      # השרתון לא זמין — לא עוצרים בגלל זה
    return None


def hook(stdin_text, now=None):
    """נקודת הכניסה של ה־Hook: מחזיר את הפלט (dict) או None = לאפשר."""
    now = now or time.time()
    st = active_state()
    if not st:
        return None
    tw = load()
    if tw.get('job') != st['job'] or tw.get('kh') != hashlib.sha1(st['key'].encode()).hexdigest()[:12]:
        tw = {'job': st['job'], 'kh': hashlib.sha1(st['key'].encode()).hexdigest()[:12]}   # עבודה/המשך חדש — מתחילים נקי
    if tw.get('red'):
        return block(tw['red'])
    try:
        inp = json.loads(stdin_text or '{}')
    except ValueError:
        inp = {}
    name = str(inp.get('tool_name') or '')
    if name and name not in POLL_TOOLS:
        key = hashlib.sha1((name + json.dumps(inp.get('tool_input'), sort_keys=True, ensure_ascii=False)).encode('utf-8')).hexdigest()[:12]
        tw['calls'] = [c for c in tw.get('calls', []) if now - c[0] <= WINDOW][-400:] + [[now, key]]
    red = None
    if now - tw.get('checked', 0) >= CHECK_EVERY:
        tw['checked'] = now
        red = check(st, tw, now)
    if red:
        tw['red'] = red
    store(tw)
    return block(red) if red else None


def main(argv):
    if len(argv) < 1 or argv[0] != 'hook':
        print('שימוש: tower.py hook  (מתוך Hook של Claude Code)', file=sys.stderr)
        return 0
    try:
        out = hook(sys.stdin.read())
    except Exception:            # noqa: BLE001 — תקלה במגדל לעולם לא עוצרת עבודה
        return 0
    if out:
        print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
