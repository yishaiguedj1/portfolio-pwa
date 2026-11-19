#!/usr/bin/env python3
"""בדיקת העומק של מכפיל באפט — יומן האימות: שורה לכל חברה × רבעון × רכיב, עם כל המקורות והפסיקה (docs/buffett-pe-audit.md §5).

הקלט (מתיקיית העבודה):
- m<N>.jsonl — מה שהמערכת מחשבת (model.js, ‏analysis.js עצמו)
- i<N>.jsonl — המימוש העצמאי (indep.py) — זהות בחישוב
- x<N>.jsonl — החילוץ העצמאי מ־companyfacts ו־frames (xbrl.py)
- read/{A,B}/*.jsonl — הקוראים הבלתי תלויים של ההודעות (גל 2): המדיניות, וחלק ב׳ (המספרים מההודעה). לא חובה.
הרכיבים לרבעון: street (רווח הרחוב), gaap, sbc, sh, pol, ded. לחברה: t (שיעור המס), ‏eps (באפט 12 חודשים), ‏fe/rate/fd (הצפוי),
ארבעת האריחים.
פסיקה: V3 — שלושה מקורות שבהם לפחות מסמך אחד נפרד מהדוח (ההודעה לעיתונות) מסכימים; V2 — המערכת + מקור עצמאי אחד;
DIFF — מקור עצמאי לא מסכים מעבר לסובלנות; SPLIT — מקורות עצמאיים חלוקים ביניהם; MISS — למערכת אין ערך ויש לו מקור;
EXTRA — למערכת יש ערך שלא היה צריך; DEF — פער בהגדרה (מתועד); PEND — ממתין למקור (הקוראים); NOSRC — אין ערך בשום מקור;
V2~ / PEND~ — רבעון 4 בלי עובדה של 3 חודשים: קירוב (השנה פחות שלושה רבעונים) מסכים / לא — לא פסיקה סופית, ממתין להודעה.
פלט: CSV (אפשר gzip — הסיומת .gz) + סיכום לפי רכיב ופסיקה.
שימוש: python3 -I tools/buffett-deep/ledger.py <work-dir> <N> <out.csv[.gz]>
"""
import csv
import glob
import gzip
import json
import os
import sys
from collections import Counter

TOL = {'eps': lambda a, b: abs(a - b) <= (0.005 * abs(b) if abs(b) > 2 else 0.01) + 1e-9,
       'rel': lambda a, b: abs(a - b) <= 0.005 * max(abs(b), 1e-12) + 1e-9,
       'tax': lambda a, b: abs(a - b) <= 0.01 + 1e-12,
       'mult': lambda a, b: abs(a - b) <= 0.01 * max(abs(b), 1e-12) + 1e-9}
KIND = {'street': 'eps', 'gaap': 'eps', 'ded': 'eps', 'sbc': 'rel', 'sh': 'rel', 't': 'tax', 'eps': 'eps',
        'pe': 'mult', 'fpe': 'mult', 'bpe': 'mult', 'bfpe': 'mult', 'fe': 'eps', 'fd': 'eps', 'rate': 'rel'}


def same(k, a, b):
    if a is None or b is None:
        return None
    return TOL[KIND.get(k, 'rel')](a, b)


def load_jsonl(p):
    out = {}
    if not os.path.exists(p):
        return out
    for l in open(p):
        l = l.strip()
        if not l:
            continue
        o = json.loads(l)
        if 'sym' in o:
            out.setdefault(o['sym'], o)
    return out


def load_readers(w):
    R = {}
    for who in ('A', 'B', 'C'):
        for f in sorted(glob.glob(os.path.join(w, 'read', who, '*.jsonl'))):
            for l in open(f):
                l = l.strip()
                if not l:
                    continue
                try:
                    j = json.loads(l)
                except Exception:
                    continue
                R.setdefault(j.get('acc'), {})[who] = j
    return R


def main():
    w, n, out = sys.argv[1], sys.argv[2], sys.argv[3]
    M = load_jsonl(os.path.join(w, 'm%s.jsonl' % n))
    I = load_jsonl(os.path.join(w, 'i%s.jsonl' % n))
    X = {}
    xp = os.path.join(w, 'x%s.jsonl' % n)
    if os.path.exists(xp):
        for l in open(xp):
            r = json.loads(l)
            if 'skip' not in r:
                X[(r['sym'], r['e'], r['c'])] = r
    RD = load_readers(w)
    # סימול → CIK (שני סוגי מניות של אותה חברה — GOOG/GOOGL, ‏FOX/FOXA — חולקים CIK ואת אותן הודעות)
    CIK = {}
    for l in open(os.environ.get('BD_CIKS') or os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'fund-deep', 'ciks.tsv')):
        a = l.split()
        if len(a) >= 2:
            CIK[a[0]] = int(a[1])
    ACC = {}
    for f in glob.glob(os.path.join(w, 'pr', '*.json')):
        mm = json.load(open(f))
        for it in mm.get('items', []):
            ACC.setdefault((int(mm['cik']), it['filed']), it['acc'])
    # ההודעה של הרבעון עצמו — לפי סוף התקופה שהקוראים העתיקו מכותרת העמודה (nums.pe), רק הודעות תוצאות
    from datetime import date
    OWN = {}
    for acc, rd in RD.items():
        for x in rd.values():
            pe = (x.get('nums') or {}).get('pe')
            if x.get('er') and isinstance(pe, str) and len(pe) >= 10:
                OWN.setdefault(acc, []).append(x)

    def own(cik, e):
        out = []
        for acc, xs in OWN.items():
            if ACCK.get(acc) != cik:
                continue
            for x in xs:
                try:
                    if abs((date.fromisoformat(x['nums']['pe'][:10]) - date.fromisoformat(e)).days) <= 7:
                        out.append((acc, x))
                except Exception:
                    pass
        return out
    ACCK = {}
    for (ck, _), acc in ACC.items():
        ACCK[acc] = ck
    rows = []

    def add(sym, e, comp, sysv, verdict, **kw):
        rows.append(dict(sym=sym, e=e, comp=comp, sys=sysv, verdict=verdict, **kw))

    for sym, m in sorted(M.items()):
        i = I.get(sym) or {}
        b = m.get('buf')
        if not b:
            add(sym, '', 'tile', None, 'NULL', cause=m.get('why') or '')
            continue
        irows = {r['e']: r for r in (i.get('rows') or [])}
        for r in m['rows']:
            e, ir = r['e'], irows.get(r['e'], {})
            # רחוב: Yahoo מול ההודעה (חלק ב׳ של הקוראים) — עד שהקוראים יעברו: PEND
            pb = r.get('polBy') or {}
            cik = CIK.get(sym)
            acc = ACC.get((cik, pb.get('filed'))) if pb.get('filed') else None
            rd = RD.get(acc, {}) if acc else {}
            ow = own(cik, e)                      # ההודעה של הרבעון עצמו (לפי הקוראים)
            pr = [x.get('nums', {}) for _, x in ow if x.get('nums')]
            adj = [p.get('eps_adj') for p in pr if isinstance(p.get('eps_adj'), (int, float))]
            st = (r.get('hq') or {}).get('a')
            if adj:
                agree = [same('street', st, a) for a in adj]
                add(sym, e, 'street', st, 'V2' if all(agree) else 'DIFF', pr=adj[0], src='yahoo|pr')
            else:
                add(sym, e, 'street', st, 'PEND', src='yahoo')
            # GAAP, תגמול, מניות: המערכת מול החילוץ העצמאי (אותו תג) + frame + ההודעה
            for comp, key, xc in (('gaap', 'g', 'eps'), ('sbc', 'sbc', 'sbc'), ('sh', 'sh', 'sh')):
                sv = r.get(key)
                x = X.get((sym, e, xc)) or {}
                xs = (x.get('same') or {}).get('last')
                fr = (x.get('frame') or {}).get('v')
                prv = [p.get({'gaap': 'eps_gaap', 'sbc': 'sbc_total', 'sh': 'sh_dil'}[comp]) for p in pr]
                prv = [v for v in prv if isinstance(v, (int, float))]
                sm = x.get('same') or {}
                dm = x.get('dim') or ({**x['alt'], 'how': 'alt:' + str(x['alt'].get('tag'))} if x.get('why') == 'alt' else {})
                kw = dict(xb=xs if xs is not None else x.get('approx') if x.get('approx') is not None else dm.get('last'),
                          xb_how=((sm.get('how') or '') + ('+inst' if sm.get('inst') else '')) or dm.get('how') or x.get('why'),
                          frame=fr, split=x.get('split'), pr=prv[0] if prv else None)
                if sv is None:
                    # MISS — יש ערך ב־SEC (בתג של המערכת או בחלופי) ולמערכת אין; NOSRC — אין בשום תג
                    al = (x.get('alt') or {}).get('last')
                    if xs is None and al is not None:
                        kw.update(xb=al, xb_how='alt:' + str((x.get('alt') or {}).get('tag')))
                    add(sym, e, comp, None, 'MISS' if xs is not None or al is not None else 'NOSRC', **kw)
                    continue
                ok = x.get('ok')
                if x.get('why') == 'q4-approx':
                    # רבעון 4 בלי עובדה של 3 חודשים: קירוב מהשנה פחות שלושה רבעונים — לא מקור; ההכרעה בהודעה לעיתונות (גל 2)
                    v = 'V2~' if ok else 'PEND~'
                elif ok is None:
                    v = 'PEND'
                elif ok is False:
                    v = 'DIFF'
                    # טעות קנה מידה במקור (MCD: המניות מתויגות במיליונים בלי decimals — ‏713.5): המערכת נכונה, נשאר DIFF עם הסיבה
                    if comp == 'sh' and xs and abs(sv / (xs * 1e6) - 1) < 0.005:
                        kw['cause'] = 'src-scale:1e6'
                else:
                    v = 'V2'
                    if fr is not None and same(comp if comp != 'gaap' else 'gaap', sv / (x.get('split') or 1) if comp == 'gaap' else sv * (x.get('split') or 1) if comp == 'sh' else sv, fr):
                        v = 'V2+frame'
                add(sym, e, comp, sv, v, **kw)
            # המדיניות: מה שהמערכת החליטה לרבעון מול מה שהקוראים קראו **בהודעה של הרבעון עצמו** (גם כשהמערכת לקחה הודעה אחרת —
            # near45, B-004/B-010 — היעד הוא ההודעה של הרבעון)
            rp = [x.get('ex') for _, x in ow if 'ex' in x]
            oacc = ow[0][0] if ow else None
            if rp:
                agree = [bool(x) == bool(r.get('pol')) for x in rp if x is not None]
                v = 'V3' if agree and all(agree) and len(agree) >= 2 else ('SPLIT' if len({bool(x) for x in rp if x is not None}) > 1 else ('V2' if agree and all(agree) else 'DIFF'))
                add(sym, e, 'pol', r.get('pol'), v, acc=oacc, how=pb.get('how') + ('' if oacc == acc else ':other'), readers=''.join('-' if x is None else '1' if x else '0' for x in rp))
            else:
                add(sym, e, 'pol', r.get('pol'), 'PEND', acc=acc, how=pb.get('how'))
            # הניכוי: זהות מול המימוש העצמאי
            add(sym, e, 'ded', r.get('ded'), 'V2' if same('ded', r.get('ded'), ir.get('ded')) else 'DIFF', indep=ir.get('ded'))
        # לחברה: מס, באפט 12 חודשים, הצפוי, האריחים — זהות מול המימוש העצמאי
        ib = i.get('buf') or i
        for comp, sv, iv in (('t', b.get('t'), ib.get('t')), ('eps', b.get('eps'), ib.get('eps')),
                             ('fe', (b.get('f') or {}).get('base'), (ib.get('f') or {}).get('base')),
                             ('rate', (b.get('f') or {}).get('rate'), (ib.get('f') or {}).get('rate')),
                             ('fd', (b.get('f') or {}).get('ded'), (ib.get('f') or {}).get('ded'))):
            add(sym, '', comp, sv, 'V2' if sv is None and iv is None or same(comp, sv, iv) else 'DIFF', indep=iv)
        # מס ושיעור התגמול — גם מול המקור: סכום ארבעת הרבעונים מהחילוץ העצמאי (xbrl.py: התג של המערכת, ואם אין — החלופי)
        es = [r['e'] for r in m['rows']]

        def x4(c):
            v = []
            for e in es:
                x = X.get((sym, e, c)) or {}
                y = (x.get('same') or {}).get('last')
                if y is None:
                    y = (x.get('alt') or {}).get('last')
                v.append(y)
            return sum(v) if len(v) == 4 and all(isinstance(y, (int, float)) for y in v) else None
        pt, tx, sb4, rv4 = x4('pretax'), x4('tax'), x4('sbc'), x4('rev')
        # כמו בהגדרה: רווח לפני מס לא חיובי → 0.21 (רק כשיש את כל שמונת הערכים — חוסר במקור אינו 0.21)
        xt = (min(max(tx / pt, 0.10), 0.35) if pt > 0 else 0.21) if pt is not None and tx is not None else None
        xr = sb4 / rv4 if sb4 and sb4 > 0 and rv4 and rv4 > 0 else None
        for comp, sv, xv in (('t.src', b.get('t'), xt), ('rate.src', (b.get('f') or {}).get('rate'), xr)):
            k = comp.split('.')[0]
            add(sym, '', comp, sv, 'NOSRC' if xv is None else ('V2' if same(k, sv, xv) else 'DIFF'), xb=xv, src='xbrl:4q')
        for comp in ('pe', 'fpe', 'bpe', 'bfpe'):
            sv, iv = (m.get('tiles') or {}).get(comp), (i.get('tiles') or {}).get(comp)
            add(sym, '', comp, sv, 'V2' if (sv is None and iv is None) or same(comp, sv, iv) else 'DIFF', indep=iv)
    cols = ['sym', 'e', 'comp', 'sys', 'verdict', 'xb', 'xb_how', 'frame', 'split', 'pr', 'indep', 'acc', 'how', 'readers', 'src', 'cause']
    op = gzip.open(out, 'wt', newline='') if out.endswith('.gz') else open(out, 'w', newline='')
    with op as fo:
        wr = csv.DictWriter(fo, fieldnames=cols, extrasaction='ignore')
        wr.writeheader()
        for r in rows:
            wr.writerow(r)
    c = Counter((r['comp'], r['verdict']) for r in rows)
    comps = sorted({k[0] for k in c})
    print('שורות:', len(rows), '· חברות:', len(M))
    for k in comps:
        print(' ', k, ' · '.join('%s %d' % (v, c[(k, v)]) for v in sorted({x[1] for x in c if x[0] == k})))


if __name__ == '__main__':
    main()
