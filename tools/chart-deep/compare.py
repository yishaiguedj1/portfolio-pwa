#!/usr/bin/env python3
"""בדיקת העומק של גרף הנרות — שלב 3: ההשוואה והפסיקות (docs/chart-deep-audit.md, סעיף 5).
קוד נפרד ובשפה אחרת מהנבדק (chartlib.js): הצבירה הצפויה נכתבת כאן מההגדרה (ת־גרף), לא מהקוד של הטלפון.

קלט:  <out>/disp/<SYM>/<tf>.<pre>.json (model.js — מה שהמסך מציג) · <out>/src/<מקור>/<SYM>/<iv>.json (sources.py)
פלט:  <out>/cmp/<SYM>.json + שורת סיכום לכל (סימבול, מרווח, מורחב) + xday (עקביות יומי מול תוך־יומי).

הבדיקות:
  inv   — ג≥max(פ,ס), נ≤min(פ,ס), מחירים>0, נפח≥0, זמנים עולים; ביומי ומעלה — בלי שני נרות לאותו יום/שבוע/חודש (DUP).
  gap   — חורים ברשת הנרות של הבסיס בתוך יום מסחר (בקריפטו — בכל רצף).
  align — צבירה בלתי תלויה של נרות הבסיס במסך לפי העוגן הצפוי: ארה"ב 9:30 (במורחב 4:00), קריפטו 00:00 UTC,
          מט"ח 17:00 ET, חוזים 18:00 ET, ת"א — הנר הראשון של היום. נר במסך שלא על הרשת = ALIGN; אותה תווית וערך אחר = AGG.
  src   — כל נר במסך (חוץ מהחי — LIVE, גל 4) מול המקורות הבלתי תלויים:
          V3 (תואם לשני מקורות ומעלה) · V2 (תואם למקור היחיד שיש) · MIX (תואם לאחד, אחר שונה) ·
          DIFF (שני מקורות מסכימים ביניהם ולא עם המסך) · DIFF? (שונה, בלי שני מקורות מסכימים) · NOSRC (אין מקור — לא אומת).
          בנוסף: split (התאמה ביחס פיצול נקי — מוסכמת התאמה, לא טעות), VOLSCOPE (מחיר תואם ונפח לא),
          MISS (נר שקיים בשני מקורות ומעלה ולא במסך; MISS1 — במקור אחד), EXTRA (במסך ולא באף מקור שמכסה את הזמן).
  xday  — הנר היומי מול צבירת התוך־יומי של אותו יום (עקביות פנימית של Yahoo, כשאין מקור בלתי תלוי — ת"א).
סובלנות: מניות — חצי טיק (0.0051 מעל דולר, 0.000051 מתחת); קריפטו — 0.3% פתיחה/סגירה, 0.6% גבוה/נמוך (מחיר מצרפי מול בורסה);
  מט"ח — 0.05%. נפח: יומי ומעלה 0.5%, תוך־יומי 2%; בקריפטו הנפח לא נבדק (מצרפי מול בורסה אחת).
שימוש: python3 -I tools/chart-deep/compare.py --out <dir> [--syms AAPL,NVDA] [--tfs 1m,3m,1D] [--pre 0,1]
       python3 -I tools/chart-deep/compare.py --selftest
"""
import glob
import json
import os
import statistics
import sys
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

UTC = timezone.utc
NY = ZoneInfo('America/New_York')
_Z = {}


def Z(name):
    if name not in _Z:
        _Z[name] = UTC if name in ('UTC', 'GMT', 'Etc/UTC', '') else ZoneInfo(name)
    return _Z[name]


# המרווחים במסך: (קובץ הבסיס במסך, שניות — או חודשים לצבירה הקלנדרית). תוך־יומי = שניות ≥ 60.
TFS = {'1m': ('1m', 60), '2m': ('2m', 120), '3m': ('1m', 180), '5m': ('5m', 300), '10m': ('5m', 600), '15m': ('15m', 900),
       '30m': ('30m', 1800), '45m': ('15m', 2700), '1h': ('1h', 3600), '2h': ('1h', 7200), '3h': ('1h', 10800), '4h': ('1h', 14400),
       '1D': ('1D', 0), '1W': ('1W', 0), '1M': ('1M', 0), '3M': ('1M', 3), '6M': ('1M', 6), '12M': ('1M', 12)}
INTRA = lambda tf: TFS[tf][1] >= 60
# מרווחי המקורות: מקורי, ואם אין — צבירה שלנו (לפי העוגן הצפוי) של מרווח עדין יותר של אותו מקור
NATIVE = {'1m': ['1m'], '2m': ['2m'], '3m': ['3m'], '5m': ['5m'], '10m': ['10m'], '15m': ['15m'], '30m': ['30m'], '45m': ['45m'],
          '1h': ['1h', '60m'], '2h': ['2h'], '3h': ['3h'], '4h': ['4h'], '1D': ['1d'], '1W': ['1w', '1wk'], '1M': ['1M', '1mo']}
DERIVE = {'2m': ['1m'], '3m': ['1m'], '5m': ['1m'], '10m': ['5m', '1m'], '15m': ['5m', '1m'], '30m': ['15m', '5m', '1m'],
          '45m': ['15m', '5m', '1m'], '1h': ['30m', '15m', '5m', '1m'], '2h': ['1h', '30m', '15m', '5m', '1m'],
          '3h': ['1h', '30m', '15m', '5m', '1m'], '4h': ['1h', '30m', '15m', '5m', '1m'],
          '3M': ['1M', '1mo'], '6M': ['1M', '1mo'], '12M': ['1M', '1mo']}
IV_SEC = {'1m': 60, '2m': 120, '3m': 180, '5m': 300, '10m': 600, '15m': 900, '30m': 1800, '45m': 2700, '1h': 3600, '60m': 3600,
          '2h': 7200, '3h': 10800, '4h': 14400, '6h': 21600}
FIX_SRC = ('ecb', 'boi')   # שער ייחוס יומי — רק בדיקת "בתוך טווח היום"
ADJ_SRC = ('webull-adj',)   # מותאם דיבידנד — Yahoo לא; לא נכנס לפסיקות


def mclass(sym):
    if sym.endswith('.TA'):
        return 'tase'
    if sym.endswith('=X'):
        return 'fx'
    if sym.endswith('=F'):
        return 'fut'
    if sym.endswith('-USD') or sym.endswith('-USDT') or sym.endswith('-EUR'):
        return 'crypto'
    return 'us'


def anchor(t, cls, pre, tz, first=None):
    """תחילת הסשן שהנר בזמן t שייך אליו — העוגן של רשת הנרות (ת־גרף)"""
    if cls == 'crypto':
        return t - t % 86400
    if cls in ('fx', 'fut'):
        d = datetime.fromtimestamp(t, NY)
        h = 17 if cls == 'fx' else 18
        a = d.replace(hour=h, minute=0, second=0, microsecond=0)
        if a > d:
            a = (d - timedelta(days=1)).replace(hour=h, minute=0, second=0, microsecond=0)
        return int(a.timestamp())
    d = datetime.fromtimestamp(t, Z(tz))
    if cls == 'tase':
        return (first or {}).get(d.strftime('%Y-%m-%d'), t)
    return int(d.replace(hour=4 if pre else 9, minute=0 if pre else 30, second=0, microsecond=0).timestamp())


def bucket(t, sec, cls, pre, tz, first=None):
    a = anchor(t, cls, pre, tz, first)
    return a + (t - a) // sec * sec


def dkey(t, tf, tz):
    d = datetime.fromtimestamp(t, Z(tz))
    if tf == '1D':
        return d.strftime('%Y-%m-%d')
    if tf == '1W':
        y, w, _ = d.isocalendar()
        return '%d-W%02d' % (y, w)
    if tf == '1M':
        return d.strftime('%Y-%m')
    n = TFS[tf][1]
    return '%d-%02d' % (d.year, (d.month - 1) // n * n + 1)   # 3M: 2026-10 = הרבעון שמתחיל באוקטובר


# ימי מסחר מקוצרים בארה"ב (נעילה 13:00 ET, מסחר מאוחר עד 17:00) — רשימת הימים המיוחדים במסמך, סעיף 3
US_HALF = {'2023-07-03', '2023-11-24', '2024-07-03', '2024-11-29', '2024-12-24', '2025-07-03', '2025-11-28', '2025-12-24',
           '2026-11-27', '2026-12-24'}


def in_sess(t, cls, pre, tz):
    if cls != 'us':
        return True
    d = datetime.fromtimestamp(t, Z(tz))
    m = d.hour * 60 + d.minute
    half = d.strftime('%Y-%m-%d') in US_HALF
    return (240 <= m < (1020 if half else 1200)) if pre else (570 <= m < (780 if half else 960))


def first_of_day(bars, tz):
    f = {}
    for b in bars:
        f.setdefault(datetime.fromtimestamp(b[0], Z(tz)).strftime('%Y-%m-%d'), b[0])
    return f


def agg(bars, keyf):
    """נרות (ממוינים) → dict מפתח→[מפתח,פ,ג,נ,ס,נפח]; הסדר נשמר"""
    out = {}
    for b in bars:
        k = keyf(b[0])
        x = out.get(k)
        if x is None:
            out[k] = [k, b[1], b[2], b[3], b[4], b[5]]
        else:
            if b[2] > x[2]:
                x[2] = b[2]
            if b[3] < x[3]:
                x[3] = b[3]
            x[4] = b[4]
            x[5] += b[5]
    return out


def ptol(x, f, cls, tick=False):
    """חצי טיק (או טיק שלם — tick=True). קריפטו/מט"ח — יחסי"""
    if cls == 'crypto':
        return abs(x) * (0.003 if f in (1, 4) else 0.006)
    if cls == 'fx':
        return abs(x) * 0.0005
    k = 2 if tick else 1
    return (0.0051 if abs(x) >= 1 else 0.000051) * k - (0.0001 if tick and abs(x) >= 1 else 0)


def FF(*xs):
    """השדות שיש בכל הנרות (פתיחה None = המקור לא יודע את הפתיחה — Webull עד ~1991: פתיחה = סגירה)"""
    return [f for f in (1, 2, 3, 4) if all(x[f] is not None for x in xs)]


def pmatch(a, b, cls):
    """(סוג, קנה מידה למקור): 'eq' עד חצי טיק · 'tick' עד טיק · 'split' ביחס פיצול נקי (עד טיק במחיר המקור) · None"""
    F = FF(a, b)
    if all(abs(a[f] - b[f]) <= ptol(a[f], f, cls) for f in F):
        return 'eq', 1.0
    if all(abs(a[f] - b[f]) <= ptol(a[f], f, cls, True) for f in F):
        return 'tick', 1.0
    rs = sorted(a[f] / b[f] for f in F if b[f] > 0 and a[f] > 0)
    if len(rs) >= 3:
        R = statistics.median(rs)
        for q in (1, 2, 3, 4):
            for r, inv in ((R, False), (1 / R, True)):
                rr = round(r * q) / q
                if rr >= 1.25 and abs(r - rr) / r < 0.003:
                    sc = 1 / rr if inv else rr   # מחיר המקור × sc = מחיר המסך
                    if all(abs(a[f] / sc - b[f]) <= ptol(b[f], f, cls, True) for f in F):
                        return 'split', sc
                    return None, sc
    return None, 1.0


def vmatch(a, b, daily, sc=1.0):
    """נפח — גם מול המקור כפי שהוא וגם מוכפל ביחס הפיצול (יש מקורות שמתאימים נפח ולא מחיר)"""
    tol = 0.005 if daily else 0.02
    for w in ((1.0,) if sc == 1.0 else (1.0, 1 / sc, sc)):
        m = max(a[5], b[5] * w)
        if m == 0 or abs(a[5] - b[5] * w) / m <= tol:
            return True
    return False


def lt(t, tz):
    return datetime.fromtimestamp(t, Z(tz)).strftime('%Y-%m-%d %H:%M')


def rnd(b):
    return [b[0]] + [None if x is None else round(x, 6) for x in b[1:5]] + [b[5]]


# ---------------------------------------------------------------- טעינה
def load_disp(out, sym, tf, pre):
    f = os.path.join(out, 'disp', sym, '%s.%d.json' % (tf, pre))
    return json.load(open(f)) if os.path.exists(f) else None


def load_srcs(out, sym):
    s = {}
    for f in glob.glob(os.path.join(out, 'src', '*', sym, '*.json')):
        name = f.split(os.sep)[-3]
        s.setdefault(name, {})[os.path.basename(f)[:-5]] = json.load(open(f))
    return s


def live_cut(d):
    """הנר החי: תוך־יומי — שלא נסגר עד רגע הצילום; יומי ומעלה — התקופה של רגע הצילום"""
    return int((d.get('at') or 0) / 1000) or 10 ** 12


def is_live(t, tf, cut, tz):
    if INTRA(tf):
        return t + TFS[tf][1] > cut
    return dkey(t, tf, tz) >= dkey(cut, tf, tz)


# ---------------------------------------------------------------- הבדיקות
def check_inv(bars, tf, tz):
    """+ JUMP: סגירה פי 3 ומעלה (או שליש) מהנר הקודם — ערבוב יחידות (אגורות/שקלים ×100) או פיצול לא מותאם
       + UNIT: נר שבתוכו שדה אחד פי 50–200 משדה אחר (TEVA.TA שבועי 2010: פ 239, ג 23800) — אגורות ושקלים באותו נר"""
    bad, dup, prev, seen, jump, unit = [], [], None, {}, [], []
    for i, b in enumerate(bars):
        px = [x for x in b[1:5] if x and x > 0]
        if px and 50 <= max(px) / min(px) <= 200:
            unit.append([lt(b[0], tz)] + [round(x, 6) for x in b[1:5]])
        if i and bars[i - 1][4] > 0 and not (1 / 3 < b[4] / bars[i - 1][4] < 3):
            jump.append([lt(b[0], tz), round(bars[i - 1][4], 6), round(b[4], 6)])
        t, o, h, l, c, v = b
        if not (h >= max(o, c) and l <= min(o, c) and min(o, h, l, c) > 0 and v >= 0):
            bad.append(b)
        if prev is not None and t <= prev:
            dup.append(b)
        prev = t
        if not INTRA(tf):
            k = dkey(t, tf, tz)
            if k in seen:
                dup.append([k, seen[k], rnd(b)])
            seen[k] = rnd(b)
    return {'bad': len(bad), 'dup': len(dup), 'jump': len(jump), 'unit': len(unit), 'ex': [rnd(x) for x in bad[:3]] + dup[:3], 'ex_jump': jump[:4], 'ex_unit': unit[:6]}


def check_gap(bars, sec, cls, pre, tz):
    """חורים ברשת בתוך יום (קריפטו: בכל רצף). מחזיר מספר משבצות חסרות והימים הבולטים"""
    miss, byday = 0, {}
    for a, b in zip(bars, bars[1:]):
        d = b[0] - a[0]
        same = cls == 'crypto' or datetime.fromtimestamp(a[0], Z(tz)).date() == datetime.fromtimestamp(b[0], Z(tz)).date()
        if same and d > sec:
            n = d // sec - 1
            miss += n
            k = lt(a[0], tz)[:10]
            byday[k] = byday.get(k, 0) + n
    top = sorted(byday.items(), key=lambda x: -x[1])[:5]
    return {'slots': miss, 'top': top}


def check_align(S, B, tf, cls, pre, tz):
    """S = הנרות במסך (בלי החי), B = נרות הבסיס במסך. צבירה בלתי תלויה לפי העוגן הצפוי."""
    if INTRA(tf):
        sec = TFS[tf][1]
        first = first_of_day(B, tz) if cls == 'tase' else None
        E = agg(B, lambda t: bucket(t, sec, cls, pre, tz, first))
        keyS = {b[0]: b for b in S}
    else:
        E = agg(B, lambda t: dkey(t, tf, tz))
        keyS = {}
        for b in S:
            keyS[dkey(b[0], tf, tz)] = b
    off, aggd = [], []
    wday = [b for b in S if tf == '1W' and datetime.fromtimestamp(b[0], Z(tz)).weekday() != 0]   # ת־גרף: שבוע מתחיל ביום שני
    for k, b in keyS.items():
        e = E.get(k)
        if e is None:
            off.append(b)
            continue
        if not INTRA(tf) and TFS[tf][1] and lt(b[0], tz)[:7] != k:   # 3M/6M/12M: התווית צריכה להיות תחילת התקופה
            off.append(b)
            continue
        if any(abs(e[f] - b[f]) > 1e-9 * max(1, abs(b[f])) for f in (1, 2, 3, 4)) or abs(e[5] - b[5]) > 0.5:
            aggd.append([lt(b[0], tz), rnd(b), rnd(e)])
    lo = min(keyS) if keyS else None
    hi = max(keyS) if keyS else None
    gone = [k for k in E if lo is not None and lo <= k <= hi and k not in keyS]
    return {'n': len(keyS), 'off': len(off), 'agg': len(aggd), 'gone': len(gone), 'wday': len(wday),
            'ex_wday': [lt(b[0], tz) for b in wday[:3]],
            'ex_off': [lt(b[0], tz) for b in off[:6]], 'ex_agg': aggd[:3],
            'ex_gone': [lt(k, tz) if isinstance(k, int) else k for k in gone[:4]]}


def synth_open_years(r):
    """שנים שבהן ≥80% מהנרות היומיים של המקור עם פתיחה = סגירה — הפתיחה לא אמיתית (Webull לפני ~1991)"""
    if not r or not r.get('bars'):
        return set()
    n, e = {}, {}
    for b in r['bars']:
        y = datetime.fromtimestamp(b[0], timezone.utc).year
        n[y] = n.get(y, 0) + 1
        e[y] = e.get(y, 0) + (b[1] == b[4])
    return {y for y in n if n[y] >= 20 and e[y] >= 0.8 * n[y]}


def src_series(srcs, tf, cls, pre, tz):
    """לכל מקור: {מפתח: נר} לפי המוסכמה של המסך. מחזיר [(שם, dict, cut, הערה)]"""
    out = []
    for name, ivs in sorted(srcs.items()):
        if name in FIX_SRC or name in ADJ_SRC:
            continue
        rec, note, bars = None, '', None
        if INTRA(tf):
            sec = TFS[tf][1]
            cands = [(iv, 'native') for iv in NATIVE.get(tf, [])] + [(iv, 'derive') for iv in DERIVE.get(tf, [])]
            for iv, how in cands:
                r = ivs.get(iv)
                if not r or not r.get('bars'):
                    continue
                if cls == 'us' and pre and r.get('ext') != 'ext':
                    continue
                bs = [b for b in r['bars'] if in_sess(b[0], cls, pre, tz)]
                if not bs:
                    continue
                first = first_of_day(bs, tz) if cls == 'tase' else None
                if how == 'native':
                    on = sum(1 for b in bs if bucket(b[0], sec, cls, pre, tz, first) == b[0])
                    if on < 0.9 * len(bs):
                        note = '%s:רשת שונה' % iv
                        continue
                    rec, bars, note = r, {b[0]: b for b in bs}, iv
                else:
                    E = agg(bs, lambda t: bucket(t, sec, cls, pre, tz, first))
                    k0 = next(iter(E))
                    if bs[0][0] != k0:   # הדלי הראשון חלקי — המקור מתחיל באמצע
                        E.pop(k0, None)
                    rec, bars, note = r, E, '~' + iv
                break
        else:
            ktz = lambda r: 'UTC' if r.get('conv') == 'date' else (r.get('tz') or 'UTC')
            noopen = synth_open_years(ivs.get('1d'))
            for iv in NATIVE.get(tf, []):
                r = ivs.get(iv)
                if r and r.get('bars'):
                    rec, note = r, iv
                    bars = {}
                    for b in r['bars']:
                        bars[dkey(b[0], tf, ktz(r))] = b
                    break
            if rec is None:
                for iv in DERIVE.get(tf, []):
                    r = ivs.get(iv)
                    if r and r.get('bars'):
                        rec, note = r, '~' + iv
                        bars = agg(r['bars'], lambda t, r=r: dkey(t, tf, ktz(r)))
                        break
        if rec is not None and bars and not INTRA(tf) and noopen:
            yr = lambda t: int(t[:4]) if isinstance(t, str) else datetime.fromtimestamp(t, timezone.utc).year   # נר שנצבר (agg) — המפתח הוא מחרוזת
            bars = {k: (b if yr(b[0]) not in noopen else [b[0], None] + list(b[2:])) for k, b in bars.items()}
            note += ' בלי פתיחה:' + ','.join(str(y) for y in (min(noopen), max(noopen)))
        if rec is not None and bars:
            out.append((name, bars, int(rec.get('at') or 0) or 10 ** 12, note))
    return out


def adj_segments(S, bars, keyf, minlen=5):
    """קטעים של יחס קבוע בין המקור למסך (לפי הסגירה): פיצולים, וגם התאמות של Yahoo ליחס לא נקי (ספין־אוף, חלוקה מיוחדת).
    מחזיר ({מפתח: קנה מידה}, [[מפתח, יחס, 'split'|'adj']]) — קנה מידה: מחיר המקור × sc = מחיר המסך.
    נר בודד שסוטה לא שובר קטע (הוא נשאר הפרש); אירוע = מעבר בין שני קטעים ארוכים ביחס שונה."""
    rs = [(keyf(b[0]), bars[keyf(b[0])][4] / b[4]) for b in S if keyf(b[0]) in bars and bars[keyf(b[0])][4] > 0 and b[4] > 0]
    runs = []
    for k, r in rs:
        if runs and abs(r / runs[-1][1] - 1) < 0.002:
            runs[-1][2].append(k)
        else:
            runs.append([k, r, [k]])
    big = [x for x in runs if len(x[2]) >= minlen]
    if not big:
        return {}, []
    sc, ev, cur = {}, [], None
    for x in runs:
        if len(x[2]) >= minlen:
            if cur is not None and abs(x[1] / cur - 1) >= 0.002:
                f = cur / x[1]
                g = f if f >= 1 else 1 / f
                nice = any(abs(g - round(g * q) / q) / g < 0.003 and round(g * q) / q >= 1.25 for q in (1, 2, 3, 4))
                ev.append([x[0], round(f, 5), 'split' if nice else 'adj'])
            cur = x[1]
        r = cur if cur is not None else big[0][1]
        for k in x[2]:
            sc[k] = 1 / r
    return sc, ev


def check_src(S, tf, cls, pre, tz, ser, cut):
    daily = not INTRA(tf)
    keyf = (lambda t: dkey(t, tf, tz)) if daily else (lambda t: t)
    V = {k: 0 for k in ('V3', 'V2', 'MIX', 'DIFF', 'DIFF?', 'NOSRC')}
    ex = {k: [] for k in ('DIFF', 'DIFF?', 'MIX', 'VOLSCOPE', 'MISS', 'MISS1', 'EXTRA')}
    nsplit = nvol = nvolchk = ntick = 0
    hist = {'when': {}, 'size': {}, 'when?': {}, 'size?': {}}
    worst = []
    FN = ('o', 'h', 'l', 'c', 'v')
    fs = {n: {f: [0, 0, []] for f in FN} for n, _, _, _ in ser}   # לכל מקור ושדה: [נבדקו, תואמים, [(הפרש, זמן)]]
    rng = {n: (min(b), max(b)) for n, b, _, _ in ser}
    segs = {n: adj_segments(S, bars, keyf) for n, bars, _, _ in ser}
    nadj = 0
    Skeys = set()
    for b in S:
        k = keyf(b[0])
        Skeys.add(k)
        kinds, present = [], []
        for n, bars, scut, _ in ser:
            x = bars.get(k)
            if x is None or is_live(b[0], tf, min(cut, scut), tz):
                continue
            z, sc = pmatch(b, x, cls)
            g = segs[n][0].get(k)
            if not z and g and abs(g - 1) > 1e-9:   # התאמה של Yahoo ביחס הקטע (עד טיק, או 0.02% — עיגול של נתונים ישנים)
                if all(abs(b[f] - x[f] * g) <= max(ptol(b[f], f, cls, True), 0.0002 * b[f]) for f in FF(b, x)):
                    z, sc = 'adj', g
            present.append((n, x, sc))
            kinds.append(z)
            for i, f in enumerate(FN, 1):   # כל שדה מול המקור אחרי קנה המידה של הפיצול
                if x[i] is None:
                    continue
                st = fs[n][f]
                st[0] += 1
                xi = x[i] * sc if i < 5 else x[i]
                ok = vmatch(b, x, daily, sc) if f == 'v' else abs(b[i] - xi) <= ptol(b[i], i, cls, True)
                if ok:
                    st[1] += 1
                else:
                    st[2].append((abs(b[i] - xi) / (max(b[i], xi) or 1) if f == 'v' else abs(b[i] - xi), b[0]))
        keq = sum(1 for z in kinds if z)
        if not present:
            v = 'NOSRC'
        elif keq >= 2:
            v = 'V3'
        else:
            agree = any(pmatch(present[i][1], present[j][1], cls)[0] in ('eq', 'tick') and not kinds[i] and not kinds[j]
                        for i in range(len(present)) for j in range(i + 1, len(present)))
            v = 'DIFF' if agree else ('V2' if keq == 1 and len(present) == 1 else 'MIX' if keq == 1 else 'DIFF?')
        V[v] += 1
        if 'split' in kinds:
            nsplit += 1
        elif 'adj' in kinds:
            nadj += 1
        if 'tick' in kinds and 'eq' not in kinds:
            ntick += 1
        if v in ex and len(ex[v]) < 6:
            ex[v].append([lt(b[0], tz) if not daily else k, rnd(b)] + [[n, rnd(x), z] for (n, x, _), z in zip(present, kinds)])
        if v in ('DIFF', 'DIFF?', 'MIX'):
            d = max(abs(b[f] - x[f] * sc) for _, x, sc in present for f in FF(b, x))
            worst.append((d, lt(b[0], tz) if not daily else k))
            if v in ('DIFF', 'DIFF?'):   # התפלגות: שעה ביום (תוך־יומי) / שנה (יומי ומעלה), וגודל ההפרש ביחס למחיר
                q = '' if v == 'DIFF' else '?'
                w = k[:4] if daily else lt(b[0], tz)[11:]
                hist['when' + q][w] = hist['when' + q].get(w, 0) + 1
                rel = d / (b[4] or 1)
                sz = '≤2טיק' if d <= 0.0201 else '≤0.1%' if rel <= 0.001 else '≤1%' if rel <= 0.01 else '>1%'
                hist['size' + q][sz] = hist['size' + q].get(sz, 0) + 1
        if cls != 'crypto':
            eqs = [(x, sc) for (n, x, sc), z in zip(present, kinds) if z]
            if eqs:
                nvolchk += 1
                if not any(vmatch(b, x, daily, sc) for x, sc in eqs):
                    nvol += 1
                    if len(ex['VOLSCOPE']) < 6:
                        ex['VOLSCOPE'].append([lt(b[0], tz) if not daily else k, b[5]] + [[n, x[5]] for n, x, _ in present])
    # MISS / EXTRA — רק בטווח שהמסך מכסה (בלי החי)
    if S:
        lo, hi = keyf(S[0][0]), keyf(S[-1][0])
        cnt = {}
        for n, bars, scut, _ in ser:
            for k, x in bars.items():
                if lo <= k <= hi and k not in Skeys and not is_live(x[0] if not daily else S[-1][0], tf, min(cut, scut), tz):
                    cnt.setdefault(k, []).append(n)
        miss = sorted(k for k, ns in cnt.items() if len(ns) >= 2)
        miss1 = sorted(k for k, ns in cnt.items() if len(ns) == 1)
        ex['MISS'] = [lt(k, tz) if not daily else k for k in miss[:8]]
        ex['MISS1'] = [[lt(k, tz) if not daily else k, cnt[k][0]] for k in miss1[:5]]
        extra = []
        for b in S:
            k = keyf(b[0])
            cov = [n for n, bars, _, _ in ser if rng[n][0] <= k <= rng[n][1]]
            if cov and all(k not in bars for n, bars, _, _ in ser if n in cov):
                extra.append(lt(b[0], tz) if not daily else k)
        ex['EXTRA'] = extra[:8]
        nm, nm1, nx = len(miss), len(miss1), len(extra)
    else:
        nm = nm1 = nx = 0
    worst.sort(reverse=True)
    fstat = {}
    for n, d in fs.items():
        fstat[n] = {}
        for f, (k, ok, bad) in d.items():
            bad.sort(reverse=True)
            fstat[n][f] = [k, ok, [[round(x, 6), lt(t, tz) if not daily else dkey(t, tf, tz)] for x, t in bad[:3]],
                           round(statistics.median([x for x, _ in bad]), 6) if bad else 0]
    for q in ('', '?'):
        hist['when' + q] = sorted(hist['when' + q].items(), key=lambda x: -x[1])[:8]
    return {'v': V, 'hist': hist, 'fields': fstat, 'split': nsplit, 'adj': nadj, 'adjev': {n: e[1] for n, e in segs.items() if e[1]}, 'tick': ntick, 'volscope': nvol, 'volchk': nvolchk, 'miss': nm, 'miss1': nm1, 'extra': nx,
            'worst': [[round(d, 6), k] for d, k in worst[:5]], 'ex': {k: x for k, x in ex.items() if x},
            'srcs': [[n, note, len(bars)] for n, bars, _, note in ser]}


def check_fix(out, sym):
    """שער ייחוס (ECB ב־14:10 שעון פרנקפורט, בנק ישראל — שער יציג) — צריך ליפול בתוך טווח הנר היומי של אותו תאריך,
    ושער ה־ECB גם בתוך הנר השעתי שמכיל את 14:10 בפרנקפורט. בדיקת הכלה (חסם), לא אימות OHLC."""
    want = {'EURUSD=X': [('ecb', 'EURUSD')], 'ILS=X': [('boi', 'USDILS')], 'EURILS=X': [('ecb', 'EURILS')]}
    if sym not in want:
        return None
    res = {}
    for src, key in want[sym]:
        f = os.path.join(out, 'src', src, key, '1d.json')
        if not os.path.exists(f):
            continue
        fx = {datetime.fromtimestamp(b[0], timezone.utc).strftime('%Y-%m-%d'): b[4] for b in json.load(open(f))['bars']}
        for tf in ('1D', '1h'):
            D = load_disp(out, sym, tf, 0)
            if not D:
                continue
            tz, cut = D.get('tz') or 'UTC', live_cut(D)
            if tf == '1D':
                bars = {dkey(b[0], '1D', tz): b for b in D['bars'] if not is_live(b[0], '1D', cut, tz)}
                look = lambda d: bars.get(d)
            else:
                if src != 'ecb':
                    continue
                hb = {b[0]: b for b in D['bars'] if b[0] + 3600 <= cut}
                def look(d, hb=hb):
                    y, m, dd = map(int, d.split('-'))
                    t = int(datetime(y, m, dd, 14, 10, tzinfo=Z('Europe/Berlin')).timestamp())
                    return hb.get(t - t % 3600)
            st = {'n': 0, 'out': 0, 'ex': [], 'years': {}}
            for d, v in sorted(fx.items()):
                b = look(d)
                if not b:
                    continue
                st['n'] += 1
                tol = 0.0005 * v
                if b[3] - tol <= v <= b[2] + tol:
                    continue
                st['out'] += 1
                st['years'][d[:4]] = st['years'].get(d[:4], 0) + 1
                if len(st['ex']) < 5:
                    st['ex'].append([d, v, round(b[3], 5), round(b[2], 5)])
            res['%s:%s' % (src, tf)] = st
    return res


def xday(out, sym, cls, tz):
    """הנר היומי מול צבירת כל מרווח תוך־יומי (בלי מורחב) של אותו יום"""
    D = load_disp(out, sym, '1D', 0)
    if not D:
        return None
    cut = live_cut(D)
    tzd = D.get('tz') or tz
    day = {dkey(b[0], '1D', tzd): b for b in D['bars'] if not is_live(b[0], '1D', cut, tzd)}
    res = {}
    for tf in ('1m', '2m', '5m', '15m', '30m', '1h'):
        I = load_disp(out, sym, tf, 0)
        if not I:
            continue
        sec = TFS[tf][1]
        icut = live_cut(I)
        A = agg([b for b in I['bars'] if b[0] + sec <= icut], lambda t: dkey(t, '1D', tzd))
        ks = [k for k in A if k in day]
        if len(ks) > 2:
            ks = ks[1:]   # היום הראשון בטווח עלול להיות חלקי
        if not ks:
            continue
        ak = sorted(A)
        only_i = [k for k in ak[1:] if k not in day]                     # יום שיש בתוך־יומי ואין ביומי
        only_d = [k for k in day if ak[1] <= k <= ak[-1] and k not in A]  # יום שיש ביומי ואין בתוך־יומי
        st = {'days': len(ks), 'o': 0, 'h': 0, 'l': 0, 'c': 0, 'vr': [], 'ex_c': [], 'ex_o': [],
              'only_i': len(only_i), 'only_d': len(only_d), 'ex_only': only_i[:3] + only_d[:3]}
        for k in ks:
            a, d = A[k], day[k]
            for f, nm in ((1, 'o'), (2, 'h'), (3, 'l'), (4, 'c')):
                if abs(a[f] - d[f]) <= ptol(d[f], f, cls):
                    st[nm] += 1
                elif nm == 'c' and len(st['ex_c']) < 4:
                    st['ex_c'].append([k, round(a[4], 4), round(d[4], 4)])
                elif nm == 'o' and len(st['ex_o']) < 3:
                    st['ex_o'].append([k, round(a[1], 4), round(d[1], 4)])
            if d[5]:
                st['vr'].append(a[5] / d[5])
        st['vr'] = round(statistics.median(st['vr']), 4) if st['vr'] else None
        res[tf] = st
    return res


def xcal(out, sym, cls):
    """שבועי/חודשי מול צבירה של היומי: (א) לפי התקופה הצפויה (שבוע שני–ראשון בשעון הבורסה, חודש קלנדרי) —
    תופס קיבוץ שגוי (C-013: שבוע חמישי–רביעי); (ב) לפי הטווח של הנר עצמו (מהתווית עד התווית הבאה) — עקביות הנתונים"""
    D = load_disp(out, sym, '1D', 0)
    if not D:
        return None
    tz = D.get('tz') or 'America/New_York'
    days = [b for b in D['bars'] if not is_live(b[0], '1D', live_cut(D), tz)]
    res = {}
    for tf in ('1W', '1M'):
        X = load_disp(out, sym, tf, 0)
        if not X:
            continue
        xs = [b for b in X['bars'] if not is_live(b[0], tf, live_cut(X), tz) and b[0] >= days[0][0]]
        if len(xs) < 3:
            continue
        E = agg(days, lambda t: dkey(t, tf, tz))
        st = {'n': 0, 'exp': 0, 'span': 0, 'ex': []}
        same = lambda a, b: all(abs(a[f] - b[f]) <= ptol(b[f], f, cls, True) for f in (1, 2, 3, 4))
        for i, b in enumerate(xs[1:-1], 1):   # הראשון עלול להיות חלקי; האחרון — עד התווית הבאה שאין
            st['n'] += 1
            e = E.get(dkey(b[0], tf, tz))
            if e and same(e, b):
                st['exp'] += 1
            sp = [d for d in days if b[0] <= d[0] < xs[i + 1][0]]
            if sp:
                a = [sp[0][0], sp[0][1], max(d[2] for d in sp), min(d[3] for d in sp), sp[-1][4], sum(d[5] for d in sp)]
                if same(a, b):
                    st['span'] += 1
                elif len(st['ex']) < 3:
                    st['ex'].append([lt(b[0], tz), rnd(b), rnd(a)])
        res[tf] = st
    return res


# ---------------------------------------------------------------- ריצה
def run_sym(out, sym, tfs, pres):
    cls = mclass(sym)
    srcs = load_srcs(out, sym)
    rep = {'sym': sym, 'cls': cls, 'tfs': {}}
    lines = []
    for tf in tfs:
        for pre in pres:
            if pre and not INTRA(tf):
                continue
            D = load_disp(out, sym, tf, pre)
            if not D:
                continue
            tz = D.get('tz') or 'America/New_York'
            cut = live_cut(D)
            bars = D['bars']
            S = [b for b in bars if not is_live(b[0], tf, cut, tz)]
            r = {'n': len(bars), 'live': len(bars) - len(S), 'pages': D.get('pages'), 'endErr': D.get('endErr')}
            r['inv'] = check_inv(bars, tf, tz)
            base_tf, sec = TFS[tf]
            B = load_disp(out, sym, base_tf, pre)
            if B:
                Bb = [b for b in B['bars'] if not is_live(b[0], base_tf, live_cut(B), tz)]
                if INTRA(tf) and base_tf == tf:
                    r['gap'] = check_gap(Bb, sec, cls, pre, tz)
                r['align'] = check_align(S, Bb, tf, cls, pre, tz)
            ser = src_series(srcs, tf, cls, pre, tz)
            r['src'] = check_src(S, tf, cls, pre, tz, ser, cut)
            rep['tfs']['%s.%d' % (tf, pre)] = r
            v, a = r['src']['v'], r.get('align', {})
            lines.append('%-8s %-4s %d n=%-6d live=%d | V3=%d V2=%d MIX=%d DIFF=%d DIFF?=%d NOSRC=%d | split=%d tick=%d vol=%d/%d | MISS=%d MISS1=%d EXTRA=%d | ALIGN=%s AGG=%s gone=%s | inv=%d/%d/%d%s%s' % (
                sym, tf, pre, len(bars), r['live'], v['V3'], v['V2'], v['MIX'], v['DIFF'], v['DIFF?'], v['NOSRC'],
                r['src']['split'] + r['src']['adj'], r['src']['tick'], r['src']['volscope'], r['src']['volchk'], r['src']['miss'], r['src']['miss1'], r['src']['extra'],
                a.get('off', '-'), a.get('agg', '-'), a.get('gone', '-'), r['inv']['bad'], r['inv']['dup'], r['inv']['jump'],
                ' gap=%d' % r['gap']['slots'] if r.get('gap') else '', ' END=' + r['endErr'] if r.get('endErr') else '')
                + (' WD=%d' % a['wday'] if a.get('wday') else '')
                + (' UNIT=%d' % r['inv']['unit'] if r['inv'].get('unit') else '')
                + (' ADJ=%s' % ';'.join('%s:%s×%s' % (n, e[0], e[1]) for n, es in r['src']['adjev'].items() for e in es if e[2] == 'adj')[:160]
                   if any(e[2] == 'adj' for es in r['src']['adjev'].values() for e in es) else ''))
    rep['xday'] = xday(out, sym, cls, 'America/New_York')
    rep['xcal'] = xcal(out, sym, cls)
    for k, st in (rep['xcal'] or {}).items():
        lines.append('  xcal %-3s n=%d לפי התקופה הצפויה=%d לפי טווח הנר=%d' % (k, st['n'], st['exp'], st['span']))
    rep['fix'] = check_fix(out, sym)
    for k, st in (rep['fix'] or {}).items():
        lines.append('%-8s FIX %-9s n=%d מחוץ לטווח=%d %s' % (sym, k, st['n'], st['out'], st['ex'][:2]))
    os.makedirs(os.path.join(out, 'cmp'), exist_ok=True)
    json.dump(rep, open(os.path.join(out, 'cmp', sym + '.json'), 'w'), ensure_ascii=False)
    return lines, rep


def selftest():
    # עוגן ארה"ב: 9:30 גם אחרי מעבר שעון (9/3/2026: EDT)
    t = int(datetime(2026, 3, 9, 13, 31, tzinfo=UTC).timestamp())   # 9:31 EDT
    assert bucket(t, 2700, 'us', 0, 'America/New_York') == int(datetime(2026, 3, 9, 13, 30, tzinfo=UTC).timestamp())
    t = int(datetime(2026, 3, 6, 14, 31, tzinfo=UTC).timestamp())   # 9:31 EST
    assert bucket(t, 14400, 'us', 0, 'America/New_York') == int(datetime(2026, 3, 6, 14, 30, tzinfo=UTC).timestamp())
    # 4 שעות: 13:30 ET
    t = int(datetime(2026, 11, 11, 19, 0, tzinfo=UTC).timestamp())  # 14:00 EST
    assert bucket(t, 14400, 'us', 0, 'America/New_York') == int(datetime(2026, 11, 11, 18, 30, tzinfo=UTC).timestamp())
    # מורחב: 4:00 → שעה עגולה
    t = int(datetime(2026, 11, 11, 14, 45, tzinfo=UTC).timestamp())  # 9:45 EST
    assert bucket(t, 3600, 'us', 1, 'America/New_York') == int(datetime(2026, 11, 11, 14, 0, tzinfo=UTC).timestamp())
    # קריפטו: 45 דק׳ מחצות UTC
    t = int(datetime(2026, 11, 11, 16, 25, tzinfo=UTC).timestamp())
    assert bucket(t, 2700, 'crypto', 0, 'UTC') == int(datetime(2026, 11, 11, 15, 45, tzinfo=UTC).timestamp())
    # חוזים: 18:00 ET של אתמול
    t = int(datetime(2026, 11, 11, 15, 0, tzinfo=UTC).timestamp())  # 10:00 EST
    assert anchor(t, 'fut', 0, 'America/New_York') == int(datetime(2026, 11, 10, 23, 0, tzinfo=UTC).timestamp())
    # מפתחות יומי ומעלה
    t = int(datetime(2026, 1, 1, 14, 30, tzinfo=UTC).timestamp())
    assert dkey(t, '1W', 'America/New_York') == '2026-W01' and dkey(t, '3M', 'America/New_York') == '2026-01'
    assert dkey(int(datetime(2026, 11, 16, 14, 30, tzinfo=UTC).timestamp()), '6M', 'America/New_York') == '2026-07'
    # פיצול נקי מול התאמת דיבידנד
    a = [0, 124.81, 125.0, 124.5, 124.9, 1]
    assert pmatch(a, [0, 499.24, 500.0, 498.0, 499.6, 1], 'us') == ('split', 0.25)
    assert pmatch(a, [0, 121.0, 121.2, 120.7, 121.1, 1], 'us')[0] is None
    assert pmatch(a, [0, 124.814, 125.004, 124.496, 124.9, 1], 'us')[0] == 'eq'
    assert pmatch(a, [0, 124.80, 125.0, 124.5, 124.9, 1], 'us')[0] == 'tick'
    assert pmatch([0, 21.64, 21.7, 21.5, 21.6, 1], [0, 605.92, 607.6, 602.0, 604.8, 1], 'us') == ('split', 1 / 28)
    assert not in_sess(int(datetime(2025, 7, 3, 17, 0, tzinfo=UTC).timestamp()), 'us', 0, 'America/New_York')   # 13:00 ביום מקוצר
    # צבירה + פסיקות: מסך עם נר 3 דק׳ מוזז מול רשת 9:30
    base = [[int(datetime(2026, 11, 11, 14, 30 + i, tzinfo=UTC).timestamp()), 10 + i, 10.5 + i, 9.5 + i, 10 + i, 100] for i in range(6)]
    good = list(agg(base, lambda t: bucket(t, 180, 'us', 0, 'America/New_York')).values())
    assert [lt(b[0], 'America/New_York')[11:] for b in good] == ['09:30', '09:33']
    shifted = list(agg(base[1:], lambda t: t - (t - base[1][0]) % 180).values())
    al = check_align(shifted, base, '3m', 'us', 0, 'America/New_York')
    assert al['off'] == 2, al
    ser = [('a', {b[0]: b for b in good}, 10 ** 12, ''), ('b', {b[0]: list(b) for b in good}, 10 ** 12, '')]
    r = check_src(good, '3m', 'us', 0, 'America/New_York', ser, 10 ** 12)
    assert r['v']['V3'] == 2 and r['miss'] == 0 and r['extra'] == 0, r
    bad = [list(good[0]), list(good[1])]
    bad[1][4] += 1
    r = check_src(bad, '3m', 'us', 0, 'America/New_York', ser, 10 ** 12)
    assert r['v']['DIFF'] == 1 and r['v']['V3'] == 1, r
    r = check_src(good[:1], '3m', 'us', 0, 'America/New_York', ser, 10 ** 12)
    assert r['miss'] == 0   # מחוץ לטווח המסך — לא נספר
    # כפילות חודש (שני נרות לנובמבר)
    m = [[int(datetime(2026, 11, 2, 14, 30, tzinfo=UTC).timestamp()), 1, 2, 1, 2, 5], [int(datetime(2026, 11, 16, 14, 30, tzinfo=UTC).timestamp()), 2, 3, 2, 3, 1]]
    assert check_inv(m, '1M', 'America/New_York')['dup'] == 1
    u = check_inv([[1269212400, 239, 23800, 236.5, 23800, 0], [1269817200, 236.5, 237.1, 234.9, 237.1, 0]], '1W', 'Asia/Jerusalem')
    assert u['unit'] == 1 and u['jump'] == 1, u   # נר באגורות בתוך סדרה בשקלים
    # שבועי שמתחיל ביום חמישי (C-013: period1=0 = חמישי 1/1/1970) — מסומן WD
    thu = int(datetime(2026, 11, 12, tzinfo=NY).timestamp())
    mon = int(datetime(2026, 11, 9, tzinfo=NY).timestamp())
    dd = [[mon + i * 86400 + 34200, 10, 11, 9, 10, 100] for i in range(5)]
    assert check_align([[thu, 10, 11, 9, 10, 300]], dd, '1W', 'us', 0, 'America/New_York')['wday'] == 1
    assert check_align([[mon, 10, 11, 9, 10, 500]], dd, '1W', 'us', 0, 'America/New_York')['wday'] == 0
    # שער ייחוס: בתוך הטווח היומי / מחוצה לו
    import tempfile
    tmp = tempfile.mkdtemp()
    os.makedirs(os.path.join(tmp, 'disp', 'EURUSD=X'))
    os.makedirs(os.path.join(tmp, 'src', 'ecb', 'EURUSD'))
    d1 = int(datetime(2026, 11, 2, tzinfo=Z('Europe/London')).timestamp())
    json.dump({'tz': 'Europe/London', 'at': (d1 + 9 * 86400) * 1000, 'bars': [[d1, 1.10, 1.11, 1.09, 1.10, 0], [d1 + 86400, 1.10, 1.11, 1.09, 1.10, 0]]},
              open(os.path.join(tmp, 'disp', 'EURUSD=X', '1D.0.json'), 'w'))
    json.dump({'bars': [[1793577600, 1.1, 1.1, 1.1, 1.105, 0], [1793664000, 1.1, 1.1, 1.1, 1.13, 0]]},
              open(os.path.join(tmp, 'src', 'ecb', 'EURUSD', '1d.json'), 'w'))
    fx = check_fix(tmp, 'EURUSD=X')['ecb:1D']
    assert fx['n'] == 2 and fx['out'] == 1 and fx['ex'][0][0] == '2026-11-03', fx
    assert pmatch([0, 10, 11, 9, 10.5, 0], [0, None, 11, 9, 10.5, 0], 'us')[0] == 'eq'
    assert synth_open_years({'bars': [[86400 * 365 * 13 + i * 86400, 5, 6, 4, 5, 0] for i in range(30)]}) == {1983}
    print('selftest: תקין')


def main(argv):
    if '--selftest' in argv:
        return selftest()
    a = dict(zip(argv[::2], argv[1::2]))
    out = a.get('--out')
    if not out:
        print('חסר --out')
        sys.exit(2)
    syms = a['--syms'].split(',') if a.get('--syms') else sorted(os.listdir(os.path.join(out, 'disp')))
    tfs = a['--tfs'].split(',') if a.get('--tfs') else list(TFS)
    pres = [int(x) for x in a.get('--pre', '0,1').split(',')]
    for s in syms:
        lines, rep = run_sym(out, s.upper(), tfs, pres)
        print('\n'.join(lines))
        if rep.get('xday'):
            for tf, st in rep['xday'].items():
                print('  xday %-4s ימים=%d פ=%d ג=%d נ=%d ס=%d נפח(תוך/יומי)=%s רק־תוך=%d רק־יומי=%d' % (tf, st['days'], st['o'], st['h'], st['l'], st['c'], st['vr'], st['only_i'], st['only_d']))


if __name__ == '__main__':
    main(sys.argv[1:])
