#!/usr/bin/env python3
"""בדיקת העומק של מכפיל באפט — גל 1: חילוץ עצמאי של רכיבי SEC לכל רבעון, מ־companyfacts (docs/buffett-pe-audit.md).

נכתב מההגדרה של XBRL בלבד, בלי הקוד של השרתון (fundamentals.js): לכל חברה בצילום ולכל אחד מששת הרבעונים האחרונים
ב־`q`, ולכל רכיב שנכנס למכפיל (eps, sh, sbc, pretax, tax, rev, ni):
- `same` — אותו תג שהמערכת בחרה (`tags` בצילום), בחישוב התקופה שלנו: עובדה של ~3 חודשים שמסתיימת בסוף הרבעון; אחרת
  הפרש מצטבר (YTD עכשיו פחות YTD של הרבעון הקודם עם אותה התחלה); לרבעון הרביעי — השנה פחות 9 החודשים.
  רווח למניה ומניות ממוצעות **לא** חיבוריים: ברבעון הרביעי אין להם ערך ב־XBRL של 10-K — נרשם `none` (המקור הבלתי תלוי
  שלהם הוא ההודעה לעיתונות, שכבה 4), ובנוסף הקירוב: רווח למניה = רווח נקי ÷ מניות; מניות = 4×שנה − 3 רבעונים.
- `alt` — רשימת התגים שלנו (לפי הסדר), לבדוק אם בחירת התג של המערכת סבירה.
- לכל ערך: הראשון שהוגש ו**האחרון** שהוגש (הצגה מחדש), ה־accession והטופס.
- `frame` — הערך ש־SEC עצמה בחרה ב־frames API לרבעון הקלנדרי הקרוב (±30 יום, כמו בהגדרה של SEC).
פלט: שורה לכל חברה × רבעון × רכיב: {sym, e, c, used, sys, same:{v,how,first,last,acc,form}, alt:{tag,…}, frame, ok, why}
שימוש: BD_DIR=<dir> python3 -I tools/buffett-deep/xbrl.py <snap-dir> <out.jsonl> [--syms A,B]
"""
import json
import os
import sys
from datetime import date, timedelta

BD = os.environ.get('BD_DIR', '.')
CACHE = os.environ.get('BD_CACHE', os.path.join(BD, 'cache'))
COMP = ['eps', 'sh', 'sbc', 'pretax', 'tax', 'rev', 'ni']
UNIT = {'eps': 'USD/shares', 'sh': 'shares'}
NONADD = {'eps', 'sh'}  # לא חיבוריים — אין הפרש מצטבר
ALT = {
    'eps': ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'],
    'sh': ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted'],
    'sbc': ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense', 'ShareBasedCompensationArrangementByShareBasedPaymentAwardCompensationCost'],
    'pretax': ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
               'IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
               'IncomeLossFromContinuingOperationsBeforeIncomeTaxesDomestic'],
    'tax': ['IncomeTaxExpenseBenefit', 'IncomeTaxExpenseBenefitContinuingOperations'],
    'rev': ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax',
            'SalesRevenueNet', 'RevenuesNetOfInterestExpense'],
    'ni': ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersDiluted', 'ProfitLoss'],
}
FIN = __import__('re').compile(r'^(10-K|10-Q|10-KT|10-QT|20-F|40-F|6-K|8-K)(/A)?$')
FRAME_TAGS = {'eps': ('EarningsPerShareDiluted', 'USD-per-shares'), 'sh': ('WeightedAverageNumberOfDilutedSharesOutstanding', 'shares'),
              'tax': ('IncomeTaxExpenseBenefit', 'USD'), 'ni': ('NetIncomeLoss', 'USD')}


def d(s):
    return date.fromisoformat(s)


def days(a, b):
    return (d(b) - d(a)).days


def near(a, b, tol=7):
    return abs(days(a, b)) <= tol


def facts_of(cik):
    f = os.path.join(CACHE, 'data.sec.gov', 'api', 'xbrl', 'companyfacts', 'CIK%010d.json' % int(cik))
    if not os.path.exists(f):
        return None
    return json.load(open(f))


def series(F, tag, comp):
    """כל העובדות של התג ביחידה המתאימה, עם start/end (משך)."""
    for ns in ('us-gaap', 'ifrs-full'):
        t = F.get('facts', {}).get(ns, {}).get(tag)
        if not t:
            continue
        units = t.get('units', {})
        want = UNIT.get(comp, 'USD')
        u = units.get(want)
        if u is None:
            # מטבע אחר / יחידה אחרת — לוקחים את הראשונה שמתאימה לסוג
            for k, v in units.items():
                if (comp == 'eps' and '/shares' in k) or (comp == 'sh' and k == 'shares') or (comp not in NONADD and '/' not in k and k != 'shares'):
                    u = v
                    break
        if u:
            # רק דוחות כספיים: דוח זימון האסיפה (DEF 14A, טבלת "שכר מול ביצועים") מתייג רווח נקי ביחידות אחרות (ANET: 3,511 = ‏$3.5B
            # במיליונים בלי קנה מידה), והוא היה נבחר כ"אחרון שהוגש"
            return [x for x in u if x.get('start') and x.get('end') and FIN.match(x.get('form') or '')]
    return []


def pick(cands):
    """מאותו (start,end): הראשון שהוגש והאחרון שהוגש."""
    if not cands:
        return None
    c = sorted(cands, key=lambda x: (x.get('filed', ''), x.get('accn', '')))
    return {'first': c[0]['val'], 'last': c[-1]['val'], 'acc': c[-1].get('accn'), 'form': c[-1].get('form'), 'filed': c[-1].get('filed'),
            'start': c[-1]['start'], 'end': c[-1]['end']}


def dur(x):
    return days(x['start'], x['end'])


def quarter_val(S, e, comp):
    """ערך של 3 חודשים שמסתיימים ב־e: ישיר / הפרש מצטבר / שנה פחות 9 חודשים. מחזיר dict או None."""
    at = [x for x in S if near(x['end'], e, 3)]
    q3 = [x for x in at if 80 <= dur(x) <= 100]
    if q3:
        r = pick(q3)
        r['how'] = 'q'
        return r
    if comp in NONADD:
        return None
    # הפרש מצטבר: YTD עד e (6/9/12 חודשים) פחות YTD עם אותה התחלה שמסתיים ~3 חודשים קודם
    for ln in (sorted({dur(x) for x in at if dur(x) > 100}, reverse=False)):
        cur = [x for x in at if dur(x) == ln]
        st = sorted({x['start'] for x in cur})
        for s0 in st:
            c1 = pick([x for x in cur if x['start'] == s0])
            prev = [x for x in S if x['start'] == s0 and 80 <= days(x['end'], e) <= 100]
            if not prev:
                continue
            p1 = pick(prev)
            how = 'fy-9m' if ln > 330 else 'ytd'
            return {'first': c1['first'] - p1['first'], 'last': c1['last'] - p1['last'], 'acc': c1['acc'], 'form': c1['form'], 'filed': c1['filed'],
                    'start': p1['end'], 'end': c1['end'], 'how': how, 'ytd': [c1['last'], p1['last']]}
    # השנה פחות שלושה רבעונים של 3 חודשים (כשאין מצטבר של 9 חודשים)
    for x in [x for x in at if dur(x) > 330]:
        s0 = x['start']
        qs = {}
        for y in S:
            if 80 <= dur(y) <= 100 and days(s0, y['start']) >= -3 and days(y['end'], e) >= 80:
                qs.setdefault(y['end'], []).append(y)
        ks = sorted(qs)
        if len(ks) == 3 and near(qs[ks[0]][0]['start'], s0, 3):
            c1 = pick([z for z in at if z['start'] == s0])
            ps = [pick(qs[k]) for k in ks]
            return {'first': c1['first'] - sum(p['first'] for p in ps), 'last': c1['last'] - sum(p['last'] for p in ps), 'acc': c1['acc'],
                    'form': c1['form'], 'filed': c1['filed'], 'start': ps[-1]['end'], 'end': c1['end'], 'how': 'fy-3q'}
    return None


def frame_val(cik, comp, e):
    if comp not in FRAME_TAGS:
        return None
    tag, unit = FRAME_TAGS[comp]
    ed = d(e)
    # הרבעון הקלנדרי הקרוב לסוף הרבעון
    best = None
    for y in (ed.year - 1, ed.year, ed.year + 1):
        for q in range(1, 5):
            qe = date(y, q * 3, 1) + timedelta(days=31)
            qe = qe.replace(day=1) - timedelta(days=1)
            if abs((qe - ed).days) <= 45 and (best is None or abs((qe - ed).days) < abs((best[2] - ed).days)):
                best = (y, q, qe)
    if not best:
        return None
    f = os.path.join(CACHE, 'data.sec.gov', 'api', 'xbrl', 'frames', 'us-gaap', tag, unit, 'CY%dQ%d.json' % (best[0], best[1]))
    if not os.path.exists(f):
        return None
    if not hasattr(frame_val, 'c'):
        frame_val.c = {}
    if f not in frame_val.c:
        js = json.load(open(f))
        frame_val.c[f] = {int(r['cik']): r for r in js.get('data', [])}
    r = frame_val.c[f].get(int(cik))
    if not r:
        return None
    return {'v': r['val'], 'end': r['end'], 'acc': r.get('accn'), 'frame': 'CY%dQ%d' % (best[0], best[1])}


def tol_ok(comp, a, b):
    if a is None or b is None:
        return None
    if comp == 'eps':
        return abs(a - b) <= max(0.01, 0.005 * abs(b) if abs(b) > 2 else 0.01) + 1e-9
    return abs(a - b) <= 0.005 * max(abs(b), 1e-9) + 1e-6


def main():
    snapd, out = sys.argv[1], sys.argv[2]
    only = set(sys.argv[sys.argv.index('--syms') + 1].split(',')) if '--syms' in sys.argv else None
    n = bad = miss = 0
    with open(out, 'w') as fo:
        for fn in sorted(os.listdir(snapd)):
            if not fn.endswith('.json'):
                continue
            o = json.load(open(os.path.join(snapd, fn)))
            sym = o.get('sym') or fn[:-5]
            if only and sym not in only:
                continue
            if not o.get('ok') or o.get('src') != 'sec' or not o.get('cik'):
                fo.write(json.dumps({'sym': sym, 'skip': o.get('src') or 'no-ok'}) + '\n')
                continue
            F = facts_of(o['cik'])
            if F is None:
                fo.write(json.dumps({'sym': sym, 'skip': 'no-facts'}) + '\n')
                continue
            q, Q, tags = o['q'], o['Q'], o.get('tags') or {}
            L = len(q) - 1
            for i in range(max(0, L - 5), L + 1):
                e = q[i]
                vals = {}
                for comp in COMP:
                    sysv = (Q.get(comp) or [None] * len(q))[i]
                    row = {'sym': sym, 'e': e, 'c': comp, 'used': i >= L - 3, 'sys': sysv, 'tag': tags.get(comp)}
                    tg = tags.get(comp)
                    if tg and '+' not in tg:
                        row['same'] = quarter_val(series(F, tg, comp), e, comp)
                    for t in ALT[comp]:
                        r = quarter_val(series(F, t, comp), e, comp)
                        if r:
                            r['tag'] = t
                            row['alt'] = r
                            break
                    row['frame'] = frame_val(o['cik'], comp, e)
                    s = row.get('same')
                    if s:
                        row['ok'] = bool(tol_ok(comp, sysv, s['last']) or tol_ok(comp, sysv, s['first']))
                        row['okLast'] = tol_ok(comp, sysv, s['last'])
                    vals[comp] = row
                # רבעון רביעי: רווח למניה ומניות — הקירוב
                ni, sh, ep = vals['ni'], vals['sh'], vals['eps']
                if not ep.get('same') and ni.get('same') and sh.get('sys'):
                    ep['approx'] = ni['same']['last'] / sh['sys']
                    ep['ok'] = tol_ok('eps', ep['sys'], ep['approx'])
                    ep['why'] = 'q4-approx'
                # פיצול / איחוד מניות: ב־XBRL הערך כפי שדווח אז, אצל המערכת — מותאם להיום. אותו מקדם הפוך ברווח למניה ובמניות,
                # והרווח הנקי לא זז (רווח למניה × מניות זהה בשניהם) → 'split' עם המקדם, לא פער
                for a, b in (('eps', 'sh'),):
                    A_, B_ = vals[a], vals[b]
                    if A_.get('ok') is False and A_.get('same') and A_['sys'] and A_['same']['last']:
                        f = A_['sys'] / A_['same']['last']
                        sb = B_.get('same')
                        if sb and B_['sys'] and abs(f * B_['sys'] / sb['last'] - 1) < 0.01:
                            A_['split'] = B_['split'] = round(f, 4)
                            A_['ok'] = B_['ok'] = True
                        elif not sb and B_['sys'] and ni.get('sys') and abs(A_['sys'] * B_['sys'] / ni['sys'] - 1) < 0.02:
                            A_['split'] = round(f, 4)   # אין מניות עצמאיות — הרווח למניה של המערכת עקבי עם הרווח הנקי והמניות שלה
                            A_['ok'] = True
                for comp in COMP:
                    r = vals[comp]
                    n += 1
                    if r.get('ok') is False:
                        bad += 1
                    if r.get('ok') is None and r['used']:
                        miss += 1
                    fo.write(json.dumps(r) + '\n')
    print('שורות:', n, '· פער:', bad, '· בלי ערך עצמאי (ברבעונים שבשימוש):', miss)


if __name__ == '__main__':
    main()
