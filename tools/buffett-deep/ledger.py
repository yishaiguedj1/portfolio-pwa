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
        # הפיילוט (read/<who>) ואחריו הגלים (read/w2/<who>…) — קריאה מאוחרת של אותה הודעה גוברת
        for f in sorted(glob.glob(os.path.join(w, 'read', who, '*.jsonl'))) + sorted(glob.glob(os.path.join(w, 'read', 'w*', who, '*.jsonl'))):
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
    # הקוראים כותבים את התאריך גם כ־'September 30, 2025' / '9/30/25' (גל 2) — אותו נרמול כמו בהשוואה (readcmp.pe_norm)
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from readcmp import pe_norm, num, unit_of
    for acc, rd in RD.items():
        for x in rd.values():
            pe = pe_norm((x.get('nums') or {}).get('pe'))
            if x.get('er') and pe:
                x.setdefault('nums', {})['pe'] = pe
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
    ACCK, ACCF = {}, {}
    for (ck, fd), acc in ACC.items():
        ACCK[acc] = ck
        ACCF[acc] = fd
    # חברות שכל ההודעות שלהן באוסף כבר נקראו — רבעון בלי הודעה אצלן = אין מקור (NOSRC), לא ממתין (PEND)
    READ = {ck for ck in set(ACCK.values()) if all(a in RD for a, k in ACCK.items() if k == ck)}
    # פיצולים מהצילום (`splitsUsed`, ‏`asOf`): ערך למניה כפי שהודפס בהודעה × המקדם = הערך המותאם של היום (Yahoo, המערכת)
    SPL = {}

    def spf(sym, filed):
        if sym not in SPL:
            sp = os.path.join(w, 'r%s' % n, 'snap', sym + '.json')
            try:
                sn = json.load(open(sp))
                SPL[sym] = (sn.get('splitsUsed') or [], sn.get('asOf') or '9999')
            except Exception:
                SPL[sym] = ([], '9999')
        f = 1.0
        if not filed:
            return f
        sl, asof = SPL[sym]
        for d, rto in sl:
            if filed < d <= asof and rto:
                f /= rto
        return f

    def pr_match(comp, sv, x, f):
        """ההודעה (קורא אחד) מול ערך המערכת: None — אין ערך בהודעה; אחרת (שווה?, איך)"""
        p = x.get('nums') or {}
        if comp == 'gaap':
            v = num(p.get('eps_gaap'))
            return None if v is None else (same('gaap', sv, v * f), 'eps_gaap')
        keys = ('sh_dil', 'sh_adj') if comp == 'sh' else ('sbc_total',)
        u = unit_of(x)
        seen = False
        for k in keys:
            v = num(p.get(k))
            if v is None:
                continue
            seen = True
            v = v / f if comp == 'sh' else v
            # יחידת הטבלה; טבלת המניות לפעמים ביחידה אחרת מטבלת הכסף — קנה מידה של 1000^k, ונרשם
            if u and same(comp, sv, v * u):
                return True, k
            for sc in (1, 1e3, 1e6, 1e9):
                if same(comp, sv, v * sc):
                    return True, '%s@%g' % (k, sc)
        return (False, keys[0]) if seen else None
    rows = []

    # פסיקות ידניות (manual.tsv) — אחרי בדיקה מול המקור; הפסיקה האוטומטית נשמרת ב־auto
    MAN = {}
    mp = os.environ.get('BD_MANUAL') or os.path.join(os.path.dirname(os.path.abspath(__file__)), 'manual.tsv')
    if os.path.exists(mp):
        for l in open(mp, encoding='utf-8'):
            a = l.rstrip('\n').split('\t')
            if len(a) >= 5 and not a[0].startswith('#'):
                MAN[(a[0], a[1], a[2])] = (a[3], a[4])

    def add(sym, e, comp, sysv, verdict, **kw):
        m = MAN.get((sym, e, comp))
        if m:
            kw.update(auto=verdict, cause=m[1], how_v='manual')
            verdict = m[0]
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
            st = (r.get('hq') or {}).get('a')
            # רחוב (Yahoo, מותאם לפיצולים של היום) מול ההודעה של הרבעון × מקדם הפיצול מאז שהודפסה.
            # אין רווח מותאם בהודעה — מול GAAP שבהודעה (חברה שמדווחת רק GAAP: הרחוב = GAAP)
            adj = [(num(x['nums'].get('eps_adj')), spf(sym, ACCF.get(a))) for a, x in ow if x.get('nums')]
            adj = [(v, f) for v, f in adj if v is not None]
            src = 'yahoo|pr'
            if not adj:
                adj = [(num(x['nums'].get('eps_gaap')), spf(sym, ACCF.get(a))) for a, x in ow if x.get('nums')]
                adj = [(v, f) for v, f in adj if v is not None]
                src = 'yahoo|pr-gaap'
            if adj and st is not None:
                agree = [same('street', st, v * f) for v, f in adj]
                kw = {'split': adj[0][1]} if adj[0][1] != 1 else {}
                if not all(agree) and src == 'yahoo|pr':
                    # הרחוב של Yahoo = ה־GAAP שבהודעה, לא המותאם (AMT ‏AFFO, ‏AEE ‏12/2025, ‏ARE) — הערך אמיתי, ההגדרה שאלה נפרדת
                    gg = [(num(x['nums'].get('eps_gaap')), spf(sym, ACCF.get(a))) for a, x in ow if x.get('nums')]
                    gg = [(v, f) for v, f in gg if v is not None]
                    if gg and all(same('street', st, v * f) for v, f in gg):
                        agree, src, kw['cause'] = [True], 'yahoo|pr-gaap', 'street=gaap≠adj'
                if not all(agree):
                    kw['cause'] = 'street≠gaap:no-adj' if src == 'yahoo|pr-gaap' else 'street≠pr'
                add(sym, e, 'street', st, 'V2' if all(agree) else 'DIFF', pr=adj[0][0], src=src, **kw)
            elif st is not None and ow and all(x.get('adj') is False for _, x in ow) and r.get('g') is not None:
                # ההודעה בלי מדד מותאם ובלי רווח רבעוני (ATO: רק מתחילת השנה) — הרחוב מול ה־GAAP של המערכת (מאומת מול SEC)
                ok = same('street', st, r.get('g'))
                add(sym, e, 'street', st, 'V2' if ok else 'DIFF', pr=r.get('g'), src='yahoo|sec-gaap', **({} if ok else {'cause': 'street≠gaap:no-adj'}))
            elif st is not None and not ow and cik in READ:
                add(sym, e, 'street', st, 'NOSRC', src='yahoo', cause='no-pr')   # לרבעון אין הודעה ב־SEC (AES — הפסיקה לפרסם ב־2.02)
            else:
                add(sym, e, 'street', st, 'PEND' if st is not None else 'NULL', src='yahoo')
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
                # המקור השלישי — ההודעה לעיתונות של הרבעון (הקוראים, גל 2), מותאמת לפיצולים מאז שהודפסה
                pm = [pr_match(comp, sv, xx, spf(sym, ACCF.get(a))) for a, xx in ow]
                pm = [m for m in pm if m is not None]
                if pm:
                    pok = [m[0] for m in pm]
                    kw['pr_how'] = pm[0][1]
                    if all(pok):
                        v = {'V2': 'V3', 'V2+frame': 'V3', 'V2~': 'V2', 'PEND~': 'V2', 'PEND': 'V2', 'DIFF': 'SPLIT'}.get(v, v)
                    elif not any(pok):
                        if v in ('V2', 'V2+frame'):
                            v, kw['cause'] = 'SPLIT', kw.get('cause') or 'pr≠sec'
                        elif v in ('V2~', 'PEND~', 'PEND'):
                            v = 'DIFF'
                    else:
                        v, kw['cause'] = 'SPLIT', 'pr-mixed'
                add(sym, e, comp, sv, v, **kw)
            # המדיניות: מה שהמערכת החליטה לרבעון מול מה שהקוראים קראו **בהודעה של הרבעון עצמו** (גם כשהמערכת לקחה הודעה אחרת —
            # near45, B-004/B-010 — היעד הוא ההודעה של הרבעון)
            # partial (רק תגמול מיוחד מוצא) או בלי רווח מותאם למניה (adj=false, ‏AAPL) = לא מוציא; None = "לא ברור".
            # ההכרעה — רוב של שני קוראים לפחות (A+B, או C במחלוקת)
            rp = [False if x.get('partial') is True or x.get('adj') is False else x.get('ex') for _, x in ow if 'ex' in x]
            oacc = ow[0][0] if ow else None
            if rp:
                kn = [bool(x) for x in rp if x is not None]
                nt, nf = kn.count(True), kn.count(False)
                maj = True if nt >= 2 and nt > nf else False if nf >= 2 and nf > nt else None
                if maj is not None:
                    v = 'V3' if maj == bool(r.get('pol')) else 'DIFF'
                elif nt and nf:
                    v = 'SPLIT'
                else:
                    v = 'PEND' if not kn else 'V2' if kn[0] == bool(r.get('pol')) else 'DIFF'
                kw = {}
                if v in ('DIFF', 'SPLIT') and b.get('yGaap'):
                    kw['cause'] = 'moot:yGaap'   # הרחוב = GAAP ב־3 רבעונים לפחות → הניכוי 0 בכל מקרה (AMT: ‏AFFO מוציא, הרחוב לא)
                add(sym, e, 'pol', r.get('pol'), v, acc=oacc, how=pb.get('how') + ('' if oacc == acc else ':other'), readers=''.join('-' if x is None else '1' if x else '0' for x in rp), **kw)
            elif cik in READ and not ow:
                # אין הודעה לרבעון; המדיניות נגררת מהודעה קודמת — אין מקור לאמת. בלי תגמול — הניכוי 0 בכל מקרה
                add(sym, e, 'pol', r.get('pol'), 'NOSRC', acc=acc, how=pb.get('how'), cause='no-pr' + (';moot:no-sbc' if r.get('sbc') is None else ''))
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
    cols = ['sym', 'e', 'comp', 'sys', 'verdict', 'xb', 'xb_how', 'frame', 'split', 'pr', 'indep', 'acc', 'how', 'readers', 'src', 'cause', 'pr_how', 'auto', 'how_v']
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
