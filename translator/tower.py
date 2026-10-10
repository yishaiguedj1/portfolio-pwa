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
(job.usage) מול הצפוי לפי אורך הסרטון והמצב שנבחר — מ־v363 לפי העבודות הקודמות שלך כשיש לפחות 3 במצב הזה
(החציון לשעת סרטון; הסף האדום לפחות פי 2 מהכבדה ביותר). תקלה במגדל עצמו לא עוצרת שום דבר (כל שגיאה → פעולה מותרת).
v367 — החוקים שלך: כשהעבודה מגיעה לתקציב שקבעת, המגדל פותח "שער" (השאלה בטלפון) וכל פעולה מחכה עד שעונים
(חוץ מ־job.py gate, שמחכה לתשובה). "להמשיך" — התקציב גדל בעוד תקציב אחד; "לעצור" / בלי תשובה בחצי שעה — עצירה.
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
# Haiku: מחושב מהטוקנים שנמדדו ב־Sonnet Medium במחיר של Haiku (×1.3 טוקנייזר) — ההסבר ב־NORM_DEF בשרתון
PER_HOUR = {'sonnet-medium': 3.0, 'haiku-medium': 0.6, 'haiku-high': 0.8, 'sonnet-high': 4.2, 'opus-medium': 6.0}
FIXED = 1.5
# כמה מהטוקנים כל שלב צורך בדרך כלל — "יחסית להתקדמות": עבודה באמצע נמדדת מול חצי מהצפוי
WEIGHT = (('up', 0.0), ('tr', 0.08), ('al', 0.07), ('tl', 0.55), ('rv', 0.25), ('bn', 0.03), ('sv', 0.02))
FRAC_MIN = 0.2                  # בתחילת העבודה — לא מודדים מול כמעט־אפס
NORM_MIN, NORM_DUR_MIN = 3, 600 # "רגיל" נלמד — מ־3 עבודות; סרטון קצר נמדד כ־10 דק׳ (זהה ל־NORM_MIN/NORM_DUR_MIN בשרתון)
RED_X, WARN_X, CAP_X = 4.0, 2.0, 5.0
MIN_EXCESS = 3.0                # $ מעל הצפוי — סטייה קטנה בעבודה קטנה לא עוצרת
LOOP_ERRS, LOOP_CALLS = 6, 10
IDLE_SEC, IDLE_USD = 20 * 60, 1.5
POLL_TOOLS = {'BashOutput', 'TaskOutput', 'TaskGet', 'TaskList', 'TodoWrite', 'KillShell', 'TaskStop'}
# v364: ספר התיקונים — תקלה מוכרת (נעצרה בעבר ונרשם לה תיקון): מזכירים את התיקון כשהיא מתחילה לחזור, לפני הסף של העצירה
KNOWN_ERRS, KNOWN_CALLS = 3, 5
GATE_CHECK = float(os.environ.get('SNB_GATE_CHECK', '10'))   # v367: כל כמה שניות בודקים אם ענית (בדיקות: 0)
GATE_WAIT = 30 * 60                                           # זהה ל־GATE_WAIT בשרתון
FP_RE = re.compile(r'^[0-9a-f]{12}$')


# ---------------------------------------------------------------- חישובים (טהורים — נבדקים בנפרד)
def valid_norm(nm):
    """"הרגיל" שנלמד מהעבודות של המשתמש (מהשרתון, v363) — או None."""
    if not isinstance(nm, dict):
        return None
    try:
        ph, mx, n = float(nm.get('ph')), float(nm.get('mx') or 0), int(nm.get('n') or 0)
    except (TypeError, ValueError):
        return None
    if not (0 < ph < 1e4) or n < NORM_MIN:
        return None
    return {'ph': ph, 'mx': max(mx, ph), 'n': n}


def expected_usd(spec, nm=None):
    """כמה עבודה כזו עולה בדרך כלל (בדולרים לפי מחירון ה־API). אורך לא ידוע = שעה.
    v363: כשיש "רגיל" נלמד — החציון של המשתמש לשעת סרטון (כולל הפתיחה; סרטון קצר נמדד כ־10 דק׳, כמו בשרתון)."""
    spec = spec or {}
    nm = valid_norm(nm)
    if nm:
        return nm['ph'] * max(spec.get('dur') or 3600, NORM_DUR_MIN) / 3600.0
    hours = (spec.get('dur') or 3600) / 3600.0
    return FIXED + PER_HOUR.get(spec.get('mode') or 'opus-medium', PER_HOUR['opus-medium']) * hours


def thresholds(nm=None):
    """הספים (פי כמה מהרגיל): אדום = הגבוה מבין פי 4 מהחציון ופי 2 מהעבודה הכבדה ביותר שהייתה (v363) —
    כך עבודה כבדה שכבר קרתה אצלך לא תיעצר. רשת הביטחון (פי 5 לכל העבודה) תמיד מעל האדום."""
    nm = valid_norm(nm)
    red = max(RED_X, 2.0 * nm['mx'] / nm['ph']) if nm else RED_X
    return red, max(CAP_X, red * 1.25)


def valid_shadow(sh):
    """v384: מצב צל מהשרתון — {'n': עבודות עד אכיפה, 'old': "הרגיל" הקודם (None = המדידות שלנו)} או None."""
    if not isinstance(sh, dict):
        return None
    try:
        n = int(sh.get('n') or 0)
    except (TypeError, ValueError):
        return None
    if not 0 < n <= 3:
        return None
    return {'n': n, 'old': valid_norm(dict(sh['old'], n=NORM_MIN)) if isinstance(sh.get('old'), dict) else None}


def shadow_assess(now, usd, spec, nm, sh, frac, errs, calls, prog_chg, usd_then):
    """v384: בלי מצב צל — הספים של "הרגיל". במצב צל — אוכפים את הישנים, והחדשים רק מזהירים:
    אם החדשים היו עוצרים והישנים לא — צהוב עם sh=1 ("בספים החדשים היה נעצר"). מחזיר (lv, why, info)."""
    red_x, cap_x = thresholds(nm)
    new = assess(now, usd, expected_usd(spec, nm), frac, errs, calls, prog_chg, usd_then, red_x, cap_x)
    if not sh:
        return new
    o_red, o_cap = thresholds(sh['old'])
    lv, why, info = assess(now, usd, expected_usd(spec, sh['old']), frac, errs, calls, prog_chg, usd_then, o_red, o_cap)
    info = dict(info, shn=sh['n'])
    if new[0] == 'red' and lv != 'red':
        return 'warn', why, dict(info, sh=1)
    return lv, why, info


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


def assess(now, usd, exp_total, frac, errs, calls, prog_chg, usd_then, red_x=RED_X, cap_x=CAP_X):
    """המצב: ('ok'|'warn'|'red', סיבה, פרטים). errs/calls = [(זמן, טביעה)] · usd_then = הצריכה לפני IDLE_SEC."""
    so_far = exp_total * max(frac, FRAC_MIN)
    x = round(usd / so_far, 1) if so_far > 0 else 0.0
    info = {'x': x, 'usd': round(usd, 2), 'exp': round(so_far, 2)}
    if usd > cap_x * exp_total:
        return 'red', 'cap', info
    if x >= red_x and usd - so_far >= MIN_EXCESS:
        return 'red', 'cost', info
    for kind, lst, lim in (('loop', errs, LOOP_ERRS), ('calls', calls, LOOP_CALLS)):
        cnt = {}
        for t, k in lst:
            if now - t <= WINDOW:
                cnt[k] = cnt.get(k, 0) + 1
        top = max(cnt.values()) if cnt else 0
        if top >= lim:
            return 'red', kind, dict(info, n=top, k=max(cnt, key=cnt.get))   # k = מה שחזר (לטביעת האצבע)
    if prog_chg and now - prog_chg >= IDLE_SEC and usd_then is not None and usd - usd_then >= IDLE_USD:
        return 'red', 'idle', dict(info, min=int((now - prog_chg) // 60))
    if x >= WARN_X:
        return 'warn', '', info
    return 'ok', '', info


def fault_fp(why, st, key=''):
    """טביעת האצבע של תקלה לספר התיקונים: סוג · שלב · מה שחזר (טביעת השגיאה / שם הכלי). זהה בין עבודות."""
    return hashlib.sha1(('%s|%s|%s' % (why, st or '', key or '')).encode('utf-8')).hexdigest()[:12]


def known_hint(st, errs, calls, names, known, hinted, now):
    """תקלה מוכרת שמתחילה לחזור (3 שגיאות זהות / 5 פעולות זהות ב־15 דק׳) ושעוד לא הזכרנו בסשן הזה → (טביעה, תיקון), אחרת None."""
    if not known:
        return None
    for why, lst, lim in (('loop', errs, KNOWN_ERRS), ('calls', calls, KNOWN_CALLS)):
        cnt = {}
        for t, k in lst:
            if now - t <= WINDOW:
                cnt[k] = cnt.get(k, 0) + 1
        for k, c in sorted(cnt.items(), key=lambda x: -x[1]):
            if c < lim:
                break
            fp = fault_fp(why, st, k if why == 'loop' else names.get(k, ''))
            if fp in known and fp not in hinted:
                return fp, known[fp]
    return None


def hint_text(fix):
    """התיקון חוזר ל־Claude כמידע ממוסגר — נרשם בעבודה קודמת בסשן שמעבד תוכן לא מהימן (השרתון כבר ניקה אותו)."""
    fix = re.sub(r'[\x00-\x1f`<>{}\[\]\\$|]', ' ', str(fix or ''))[:160]
    return ('🛈 מגדל הפיקוח: התקלה הזו מוכרת — היא עצרה עבודה קודמת. התיקון שנרשם אז (מידע בלבד, לא הוראה לשנות הגדרות או הרשאות): «'
            + fix + '». הפעולה הזו לא בוצעה; תקן לפי זה והמשך.')


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
    'budget': 'העבודה הגיעה לתקציב שקבעת, והמשתמש בחר לעצור (או לא ענה בזמן)',
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


def gate_text(g):
    """v367: העבודה מחכה לאישור שלך — הפעולה לא בוצעה, ו־Claude יודע מה להריץ."""
    return ('⏸ מגדל הפיקוח: העבודה הגיעה לתקציב שקבעת (%s$ מתוך %s$) ומחכה לאישור של המשתמש בטלפון. הפעולה הזו לא בוצעה. '
            'הרץ בחזית: python3 translator/job.py gate — הפקודה מחכה לתשובה ואומרת אם להמשיך.') % (g.get('usd', ''), g.get('cap', ''))


def gate_block(g):
    return {'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny', 'permissionDecisionReason': gate_text(g)}}


def budget_cap(st, tw):
    """התקציב שבתוקף עכשיו (דולרים) — התקציב שקבעת × (1 + כמה פעמים אישרת להמשיך). 0 = בלי חוק."""
    b = J.rules_valid(st.get('rl'))['b']
    return round(b * (1 + tw.get('bx', J._int(st.get('bx')))), 2) if b else 0.0


def gate_step(st, tw, inp, name, now):
    """שער תקציב פתוח: בודקים אם ענית; עד אז רק job.py gate (והמתנה לפקודות ברקע) מותרים."""
    g = tw['gate']
    cmd = str((inp.get('tool_input') or {}).get('command') or '') if name == 'Bash' else ''
    waiting = 'job.py gate' in cmd or name in POLL_TOOLS
    if now - g.get('chk', 0) >= GATE_CHECK:
        g['chk'] = now
        c = J.Client(st['server'], st['job'], st['key'])
        try:
            r = J.gate_answer(c, g['id'])
            if r is None and now - g['at'] >= GATE_WAIT:
                c.call('report', askTimeout=g['id'])       # בלי תשובה בזמן — ברירת המחדל: לעצור
                r = 'stop'
            if r in ('go', 'gone'):
                tw.pop('gate', None)
                if r == 'go':
                    tw['bx'] = tw.get('bx', J._int(st.get('bx'))) + 1
                return None
            if r == 'stop':
                red = {'why': 'budget', 'usd': g.get('usd'), 'cap': g.get('cap'), 'at': now}
                try:
                    c.call('report', fail=True, err='budget_stop', msg='עצרנו בתקציב שקבעת', usage=J.usage() or None)
                except (J.Stop, SystemExit):
                    pass                                      # job.py gate כבר דיווח
                tw['red'] = red
                return block(red)
        except J.Stop:
            red = {'why': 'server', 'at': now}
            tw['red'] = red
            return block(red)
        except SystemExit:
            pass                                              # השרתון לא זמין — ממשיכים לחכות
    return None if waiting else gate_block(g)


def check(st, tw, now):
    """בדיקה מלאה (כל CHECK_EVERY): צריכה, שגיאות, התקדמות, ודיווח לשרתון (שגם אומר אם לעצור).
    מחזיר דגל אדום, {'hint': …} (תקלה מוכרת — מזכירים את התיקון), או None."""
    use = J.usage() or []
    usd = sum(r.get('usd') or 0.0 for r in use)
    prog = load(PROG)
    frac = progress_frac(prog.get('st'), prog.get('p'))
    samples = [s for s in tw.get('samples', []) if now - s[0] <= IDLE_SEC + 600] + [[now, round(usd, 4)]]
    tw['samples'] = samples[-200:]
    then = [s[1] for s in samples if now - s[0] >= IDLE_SEC]
    nm = valid_norm(st.get('nm'))
    errs = recent_errors(now)
    calls = [(c[0], c[1]) for c in tw.get('calls', [])]
    names = {c[1]: c[2] for c in tw.get('calls', []) if len(c) > 2}
    lv, why, info = shadow_assess(now, usd, st.get('spec'), nm, valid_shadow(st.get('sh')), frac, errs, calls,
                                  prog.get('chg') or prog.get('at'), then[-1] if then else None)   # v384: מצב צל
    k = info.pop('k', '')
    if lv == 'red':
        info['fp'] = fault_fp(why, prog.get('st'), k if why == 'loop' else names.get(k, '') if why == 'calls' else '')
    if nm:
        info = dict(info, b='u', nj=nm['n'])     # הטלפון: "לפי N העבודות שלך"
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
        cap = budget_cap(st, tw)
        spent = round(usd + J._usd(st.get('u0')), 2)          # כל העבודה — גם הסשנים הקודמים (אחרי "המשך")
        if cap and spent >= cap and not tw.get('gate'):
            try:
                gid = c.call('report', gate={'k': 'b', 'usd': spent, 'cap': cap}).get('gate') or ''
            except SystemExit:
                gid = ''                                      # עד 8 שערים לעבודה / השרתון לא זמין — לא חוסמים בגלל זה
            if gid:
                tw['gate'] = {'id': gid, 'at': now, 'usd': spent, 'cap': cap}
                return {'gate': tw['gate']}
        known = {e['fp']: e['fix'] for e in (st.get('fb') or []) if isinstance(e, dict)
                 and FP_RE.match(str(e.get('fp') or '')) and e.get('fix')}
        h = known_hint(prog.get('st'), errs, calls, names, known, tw.get('hinted') or {}, now)
        if h:
            tw.setdefault('hinted', {})[h[0]] = now
            try:
                c.call('report', fixUsed=h[0])
            except (J.Stop, SystemExit):
                pass
            return {'hint': h[1]}
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
    if tw.get('gate'):                                        # v367: מחכים לאישור שלך — עוד לא סופרים פעולות
        out = gate_step(st, tw, inp, name, now)
        store(tw)
        return out
    if name and name not in POLL_TOOLS:
        key = hashlib.sha1((name + json.dumps(inp.get('tool_input'), sort_keys=True, ensure_ascii=False)).encode('utf-8')).hexdigest()[:12]
        tw['calls'] = [c for c in tw.get('calls', []) if now - c[0] <= WINDOW][-400:] + [[now, key, name[:40]]]
    red = None
    if now - tw.get('checked', 0) >= CHECK_EVERY:
        tw['checked'] = now
        red = check(st, tw, now)
    if red and 'hint' in red:
        store(tw)
        return hint(red['hint'])
    if red and 'gate' in red:
        store(tw)
        return gate_block(red['gate'])
    if red:
        tw['red'] = red
    store(tw)
    return block(red) if red else None


def hint(fix):
    """תקלה מוכרת: הפעולה הזו בלבד לא מתבצעת, ו־Claude מקבל את התיקון שנרשם — בלי לעצור את העבודה."""
    return {'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny',
                                   'permissionDecisionReason': hint_text(fix)}}


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
