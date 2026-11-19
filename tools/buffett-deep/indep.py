#!/usr/bin/env python3
"""בדיקת העומק של מכפיל באפט — המימוש העצמאי (שכבה 3, docs/buffett-pe-audit.md).

נכתב מההגדרה ב־docs/buffett-pe.md בלבד, בלי שורת קוד משותפת עם analysis.js: שפה אחרת, מבנה אחר. קורא את אותם צילומים של
השרתון (snap/<SYM>.json — הקלט הגולמי, לפני prep) ומחשב לכל חברה: 4 הרבעונים, רחוב, GAAP, תגמול אחרי מס, המדיניות לכל רבעון,
הניכוי, רווח באפט, הצפוי, וארבעת המכפילים. ההשוואה ל־model.js (הפלט של analysis.js) — compare.py.

ההגדרה (docs/buffett-pe.md §1–2, §5):
- 4 הרבעונים האחרונים ברשימת הרבעונים של החברה, רצופים (75–105 או 110–120 יום ביניהם), והאחרון = סוף "עכשיו" (±5 ימים).
  "עכשיו" = 12 החודשים האחרונים כשהרבעון האחרון אחרי סוף השנה האחרונה ו־4 הרבעונים רצופים; אחרת — סוף השנה האחרונה.
- רחוב = epsActual של Yahoo לרבעון (התאמה ±20 יום). GAAP = EPS מדולל של הרבעון. תגמול אחרי מס = SBC × (1−t) ÷ מניות הרבעון.
- t = מס ÷ רווח לפני מס של 12 החודשים, חסום ל־[0.10, 0.35]; רווח לפני מס לא חיובי או חסר → 0.21.
- המדיניות לרבעון שהסתיים ב־e: ההודעות (sbcX) שהוגשו 1–100 יום אחרי e — הארוכה קובעת; אין — הקרובה ל־e+45.
- הניכוי: pol=0 → 0; הסדרה של Yahoo = GAAP ב־3 מ־4 (|רחוב−GAAP| ≤ max(0.02, 2%)) → 0; pol=1 → כל התגמול; לא ידוע →
  clamp(רחוב−GAAP, 0, תגמול).
- null: מטבע מחיר ≠ מטבע דוחות; פחות מ־4 רבעונים; חסר רחוב/GAAP/מניות; יחס רחוב/GAAP מעל 8 (או מתחת ל־1/8) בסימנים זהים.
- הצפוי: הבסיס = מחיר Yahoo ÷ fpe (אחרת ממוצע +1y). שיעור התגמול = SBC ÷ הכנסות של 12 החודשים; התגמול הצפוי = שיעור × הכנסות
  +1y (אחרת הכנסות 12 החודשים); החלק = הניכוי ÷ התגמול אחרי מס ברבעונים שבהם pol≠0 (אין כאלה: 1 אם fut, אחרת 0); fut=false
  בהודעה האחרונה → 0; מחולק במניות הרבעון האחרון.
- המכפילים על המחיר החי; המכפיל הצפוי של Yahoo עובר למחיר החי דרך אותו בסיס (יחס בין חצי לפי 2).
שימוש: python3 tools/buffett-deep/indep.py <snap-dir> <out.jsonl> [--px 1.05]
"""
import json
import math
import os
import sys
from datetime import date

DAY = 1.0


def d(s):
    y, m, dd = (int(x) for x in s[:10].split('-'))
    return date(y, m, dd)


def days(a, b):
    return (d(b) - d(a)).days


def fin(x):
    return x is not None and isinstance(x, (int, float)) and math.isfinite(x)


def consecutive(qs):
    for a, b in zip(qs, qs[1:]):
        g = days(a, b)
        if not (75 <= g <= 105 or 110 <= g <= 120):
            return False
    return True


def ttm(snap, key, qi):
    """12 החודשים עד הרבעון qi: הערך המחושב בשרתון (T) כשקיים, אחרת סכום 4 רבעונים רצופים."""
    T = snap.get('T') or {}
    if T.get(key) is not None:
        return T[key]
    Q = (snap.get('Q') or {}).get(key) or []
    if qi < 3:
        return None
    vals = Q[qi - 3:qi + 1]
    if len(vals) < 4 or any(v is None for v in vals):
        return None
    if not consecutive(snap['q'][qi - 3:qi + 1]):
        return None
    return sum(vals)


def policy(sbcx, e):
    if not sbcx:
        return None, None
    win = [r for r in sbcx if 0 < days(e, r[0]) <= 100]
    if win:
        best = win[0]
        for r in win[1:]:
            if (r[3] or 0) > (best[3] or 0):
                best = r
        return (1 if best[1] else 0), best
    tgt = d(e).toordinal() + 45
    best = sbcx[0]
    for r in sbcx[1:]:
        if abs(d(r[0]).toordinal() - tgt) < abs(d(best[0]).toordinal() - tgt):
            best = r
    return (1 if best[1] else 0), best


def compute(snap, pxk=None):
    sym = snap.get('sym')
    out = {'sym': sym}
    # מטבע: מחיר בדולרים בארה"ב / שקלים בת"א, מול מטבע הדוחות
    px_cur = 'ILS' if sym.endswith('.TA') else 'USD'
    if (snap.get('cur') or 'USD') != px_cur:
        out['why'] = 'fx'
        return out
    qs = snap.get('q') or []
    Q = snap.get('Q') or {}
    fy = snap.get('fy') or []
    if len(qs) < 4:
        out['why'] = 'q<4'
        return out
    L = len(qs) - 1
    # "עכשיו"
    if fy and qs[L] > fy[-1] and consecutive(qs[L - 3:]):
        now_end, annual = qs[L], False
    elif fy:
        now_end, annual = fy[-1], True   # "עכשיו" = השנה האחרונה — הערכים השנתיים (גם כשהרבעון האחרון מסתיים באותו יום)
    else:
        out['why'] = 'no-period'
        return out
    if abs(days(qs[L], now_end)) > 5:
        out['why'] = 'last-q-not-now'
        return out
    if not consecutive(qs[L - 3:]):
        out['why'] = 'q-gap'
        return out
    pretax, tax = ttm(snap, 'pretax', L), ttm(snap, 'tax', L)
    if annual:   # "עכשיו" = השנה האחרונה (בלי 12 חודשים)
        A = snap.get('A') or {}
        i = len(fy) - 1
        pretax = (A.get('pretax') or [None] * len(fy))[i] if A.get('pretax') else None
        tax = (A.get('tax') or [None] * len(fy))[i] if A.get('tax') else None
    t = min(max(tax / pretax, 0.10), 0.35) if fin(pretax) and pretax > 0 and fin(tax) else 0.21
    hist = [h for h in (snap.get('hist') or []) if h and h.get('q') and fin(h.get('a'))]
    sbcx = snap.get('sbcX') or []
    rows = []
    for i in range(L - 3, L + 1):
        e = qs[i]
        hq = next((h for h in hist if abs(days(h['q'], e)) <= 20), None)
        g = (Q.get('eps') or [None] * len(qs))[i] if Q.get('eps') else None
        sh = (Q.get('sh') or [None] * len(qs))[i] if Q.get('sh') else None
        sbc = (Q.get('sbc') or [None] * len(qs))[i] if Q.get('sbc') else None
        if hq is None:
            out['why'] = 'no-hist:' + e
            return out
        if not fin(g):
            out['why'] = 'no-gaap:' + e
            return out
        if not (fin(sh) and sh > 0):
            out['why'] = 'no-sh:' + e
            return out
        sb = sbc * (1 - t) / sh if fin(sbc) and sbc > 0 else 0.0
        pol, rec = policy(sbcx, e)
        rows.append({'e': e, 's': hq['a'], 'g': g, 'sbc': sbc, 'sh': sh, 'sb': sb, 'pol': pol, 'rec': rec})
    ygaap = sum(1 for r in rows if abs(r['s'] - r['g']) <= max(0.02, 0.02 * abs(r['s']))) >= 3
    for r in rows:
        if r['pol'] == 0 or ygaap:
            r['ded'] = 0.0
        elif r['pol'] == 1:
            r['ded'] = r['sb']
        else:
            r['ded'] = min(max(r['s'] - r['g'], 0.0), r['sb'])
    st = sum(r['s'] for r in rows)
    g = sum(r['g'] for r in rows)
    if st * g > 0 and abs(st) > 0.05 and abs(g) > 0.05 and (abs(st / g) > 8 or abs(st / g) < 0.125):
        out['why'] = 'units'
        return out
    ded = sum(r['ded'] for r in rows)
    pols = [r['pol'] for r in rows]
    p1, p0 = pols.count(1), pols.count(0)
    out.update({'t': t, 'yGaap': ygaap, 'st': st, 'g': g, 'ded': ded, 'eps': st - ded,
                'pol': 'mix' if p1 and p0 else 'ex' if p1 else 'in' if p0 else '?', 'rows': rows})
    # הצפוי
    py = snap.get('price')
    fpe_y = snap.get('fpe')
    e1 = next((e for e in (snap.get('est') or []) if e.get('p') == '+1y'), {}) or {}
    fe = py / fpe_y if fin(py) and py > 0 and fin(fpe_y) and fpe_y > 0 else None
    base = fe if fe is not None else e1.get('eps')
    f = None
    if fin(base):
        last = sbcx[-1] if sbcx else None
        fut = bool(last[2]) if last else None
        chg = bool(last and last[1] and not last[2])
        ex_at = sum(r['sb'] for r in rows if r['pol'] != 0)
        ex_ded = sum(r['ded'] for r in rows if r['pol'] != 0)
        frac = ex_ded / ex_at if ex_at > 0 else (1.0 if fut else 0.0)
        sbc12, rev12 = ttm(snap, 'sbc', L), ttm(snap, 'rev', L)
        if annual:
            A = snap.get('A') or {}
            sbc12 = (A.get('sbc') or [None])[-1]
            rev12 = (A.get('rev') or [None])[-1]
        rate = sbc12 / rev12 if fin(sbc12) and sbc12 > 0 and fin(rev12) and rev12 > 0 else None
        rev_f = e1.get('rev') if fin(e1.get('rev')) and e1.get('rev') > 0 else rev12
        fs = rate * rev_f if rate is not None else 0.0
        fd = 0.0 if fut is False else frac * fs * (1 - t) / Q['sh'][L]
        f = {'base': base, 'rate': rate, 'frac': frac, 'fut': fut, 'chg': chg, 'ded': fd, 'eps': base - fd}
    out['f'] = f
    # המחיר והמכפילים
    px = py * pxk if pxk and fin(py) else py
    fpe = fpe_y
    if pxk and fe and fin(py) and py > 0 and 0.5 < px / py < 2:
        fpe = px / fe
    eps12 = (snap.get('A') or {}).get('eps', [None])[-1] if annual else ttm(snap, 'eps', L)
    out['px'] = px
    out['tiles'] = {
        'pe': px / eps12 if fin(px) and fin(eps12) and eps12 > 0 else None,
        'fpe': fpe if fin(fpe) and fpe > 0 else None,
        'bpe': px / out['eps'] if fin(px) and out['eps'] > 0 else None,
        'bfpe': px / f['eps'] if f and fin(px) and f['eps'] > 0 else None,
    }
    return out


def main():
    if len(sys.argv) < 3:
        print('שימוש: indep.py <snap-dir> <out.jsonl> [--px k]')
        sys.exit(2)
    src, dst = sys.argv[1], sys.argv[2]
    pxk = float(sys.argv[sys.argv.index('--px') + 1]) if '--px' in sys.argv else None
    n = 0
    with open(dst, 'w') as fo:
        for fn in sorted(os.listdir(src)):
            if fn.startswith('_') or not fn.endswith('.json'):
                continue
            with open(os.path.join(src, fn)) as fi:
                snap = json.load(fi)
            if not snap.get('ok'):
                continue
            fo.write(json.dumps(compute(snap, pxk)) + '\n')
            n += 1
    print('חברות:', n)


if __name__ == '__main__':
    main()
