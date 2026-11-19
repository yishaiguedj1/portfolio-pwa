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


# ישות שהחליפה ישות קודמת (חברת אחזקות חדשה) — ב־SEC אין קישור ביניהן; עובדה ציבורית, מתועדת: ExxonMobil Holdings Corp ‏(2026)
# ← ‏Exxon Mobil Corp. בלי האיחוד אין לרבעונים שלפני ההחלפה אף עובדה (XOM ‏12/2025, ‏3/2026)
PREV_CIK = {2115436: 34088}


def facts_of(cik):
    f = os.path.join(CACHE, 'data.sec.gov', 'api', 'xbrl', 'companyfacts', 'CIK%010d.json' % int(cik))
    if not os.path.exists(f):
        return None
    F = json.load(open(f))
    pc = PREV_CIK.get(int(cik))
    if pc:
        P = facts_of(pc)
        for ns, T in ((P or {}).get('facts') or {}).items():
            for c, t in T.items():
                for u, arr in t.get('units', {}).items():
                    F.setdefault('facts', {}).setdefault(ns, {}).setdefault(c, {'units': {}})['units'].setdefault(u, []).extend(arr)
    return F


# הגשות תקופתיות שחסרות ב־companyfacts (5/11/2026: עשרות 10-Q של יולי–נובמבר) — מקובץ ה־instance של ההגשה (xfetch.js ‏--inst),
# בפענוח משלנו (ElementTree; רק עובדות בלי ממד, בטקסונומיות us-gaap / ifrs-full — כמו companyfacts). השרתון עושה את זה ב־lib/secxbrl.js.
PERIODIC = __import__('re').compile(r'^(10-K|10-Q|20-F|40-F)$')
XI = '{http://www.xbrl.org/2003/instance}'
NS_RX = [(__import__('re').compile(r'fasb\.org/us-gaap/'), 'us-gaap'), (__import__('re').compile(r'xbrl\.ifrs\.org/taxonomy/.*ifrs-full'), 'ifrs-full')]


def parse_instance(path, acc, form, filed):
    import xml.etree.ElementTree as ET
    root = ET.parse(path).getroot()
    ctx, units, out, seen = {}, {}, {}, set()
    for c in root.iter(XI + 'context'):
        ent = c.find(XI + 'entity')
        if (ent is not None and ent.find(XI + 'segment') is not None) or c.find(XI + 'scenario') is not None:
            continue                                    # עובדה עם ממד — לא ב־companyfacts
        per = c.find(XI + 'period')
        st, en, ins = per.find(XI + 'startDate'), per.find(XI + 'endDate'), per.find(XI + 'instant')
        if en is not None and st is not None:
            ctx[c.get('id')] = (st.text.strip(), en.text.strip())
        elif ins is not None:
            ctx[c.get('id')] = (None, ins.text.strip())
    for u in root.iter(XI + 'unit'):
        dv = u.find(XI + 'divide')
        m = lambda e: '*'.join(x.text.strip().split(':')[-1] for x in e.iter(XI + 'measure'))
        units[u.get('id')] = (m(dv.find(XI + 'unitNumerator')) + '/' + m(dv.find(XI + 'unitDenominator'))) if dv is not None else m(u)
    for el in root:
        if not isinstance(el.tag, str) or not el.tag.startswith('{'):
            continue
        uri, name = el.tag[1:].split('}', 1)
        ns = next((n for rx, n in NS_RX if rx.search(uri)), None)
        cr, ur = el.get('contextRef'), el.get('unitRef')
        if not ns or cr not in ctx or ur not in units or el.get('{http://www.w3.org/2001/XMLSchema-instance}nil') == 'true':
            continue
        try:
            v = float((el.text or '').strip())
        except ValueError:
            continue
        st, en = ctx[cr]
        k = (ns, name, units[ur], st, en)
        if k in seen:
            continue
        seen.add(k)
        rec = {'end': en, 'val': v, 'accn': acc, 'form': form, 'filed': filed}
        if st:
            rec['start'] = st
        out.setdefault(ns, {}).setdefault(name, {'units': {}})['units'].setdefault(units[ur], []).append(rec)
    return out


# מניות ורווח למניה שמדווחים **רק לפי סוג מניה / שיטת חישוב** (עובדה עם ממד — לא נכנסת ל־companyfacts): HSY ‏(Common / Class B),
# ‏BKR ו־STZ ‏(Class A), ‏SJM ‏(EarningsPerShareMethodAxis). המערכת לוקחת אז את המניות מ־Yahoo (qShares, ‏'qsh') — כאן מה־instance
# של ה־10-Q של הרבעון. הסוג: המניה הרגילה / Class A (הנסחרת). אין ממוצע מדולל מתויג (HSY) → הבסיסי + כל המניות הנוספות של אותו סוג
XDI = '{http://xbrl.org/2006/xbrldi}'
DIM_AX = {'StatementClassOfStockAxis', 'EarningsPerShareMethodAxis', 'AwardTypeAxis'}
# שתי שיטות באותו 10-Q ‏(SJM: ‏TwoClass ‏106.7M, ‏TreasuryStock ‏106.9M — אותו רווח למניה): המדולל לפי שיטת המניות באוצר,
# שכוללת את ניירות הערך המדללים (ASC 260 — המדללת יותר מבין השתיים)
CLS_PREF = ('CommonStockMember', 'CommonClassAMember', 'TreasuryStockMethodMember')
DIM_NAMES = {'eps': 'EarningsPerShareDiluted', 'sh': 'WeightedAverageNumberOfDilutedSharesOutstanding', 'shb': 'WeightedAverageNumberOfSharesOutstandingBasic'}


def parse_dims(path):
    import xml.etree.ElementTree as ET
    if not hasattr(parse_dims, 'c'):
        parse_dims.c = {}
    if path in parse_dims.c:
        return parse_dims.c[path]
    root = ET.parse(path).getroot()
    ctx, out, seen = {}, [], set()
    for c in root.iter(XI + 'context'):
        per = c.find(XI + 'period')
        st, en = per.find(XI + 'startDate'), per.find(XI + 'endDate')
        if st is None or en is None or c.find('.//' + XDI + 'typedMember') is not None:
            continue
        dims = tuple(sorted((m.get('dimension').split(':')[-1], (m.text or '').strip().split(':')[-1]) for m in c.iter(XDI + 'explicitMember')))
        if dims and all(a in DIM_AX for a, _ in dims):
            ctx[c.get('id')] = (st.text.strip(), en.text.strip(), dims)
    for el in root:
        if not isinstance(el.tag, str) or not el.tag.startswith('{'):
            continue
        name = el.tag[1:].split('}', 1)[1]
        cr = el.get('contextRef')
        if cr not in ctx or (name not in DIM_NAMES.values() and not name.startswith('IncrementalCommonShares')):
            continue
        try:
            v = float((el.text or '').strip())
        except ValueError:
            continue
        st, en, dims = ctx[cr]
        k = (name, st, en, dims)
        if k not in seen:
            seen.add(k)
            out.append({'name': name, 'start': st, 'end': en, 'dims': dims, 'val': v})
    parse_dims.c[path] = out
    return out


def dim_val(cik, e, comp, need):
    """הערך של 3 חודשים מה־10-Q של הרבעון, לפי סוג המניה. אין instance במטמון → נרשם ב־need (להורדה ב־xfetch.js ‏--inst)."""
    sp = os.path.join(CACHE, 'data.sec.gov', 'submissions', 'CIK%010d.json' % int(cik))
    if not os.path.exists(sp):
        return None
    R = json.load(open(sp)).get('filings', {}).get('recent', {})
    for i, f in enumerate(R.get('form', [])):
        if f != '10-Q' or not R['reportDate'][i] or not near(R['reportDate'][i], e, 3):
            continue
        acc, doc = R['accessionNumber'][i], R['primaryDocument'][i]
        ip = os.path.join(CACHE, 'www.sec.gov', 'Archives', 'edgar', 'data', str(int(cik)), acc.replace('-', ''),
                          __import__('re').sub(r'\.htm$', '', doc, flags=__import__('re').I) + '_htm.xml')
        if not os.path.exists(ip):
            need.add('\t'.join([str(int(cik)), acc, f, R['filingDate'][i], R['reportDate'][i], doc]))
            return None
        fs = [x for x in parse_dims(ip) if near(x['end'], e, 3) and 80 <= days(x['start'], x['end']) <= 100]
        # המפתח: השיטה (ממד יחיד) או סוג המניה
        mem = {}
        for x in fs:
            ax = dict(x['dims'])
            m = ax.get('StatementClassOfStockAxis') or (ax.get('EarningsPerShareMethodAxis') if len(ax) == 1 else None)
            if m:
                mem.setdefault(m, []).append(x)
        cls = next((m for m in CLS_PREF if m in mem), None) or (next(iter(mem)) if len(mem) == 1 else None)
        if not cls:
            return None
        only = [x for x in mem[cls] if len(x['dims']) == 1]
        one = lambda n: next((x['val'] for x in only if x['name'] == n), None)
        how, fd = 'dim:' + cls, R['filingDate'][i]
        if comp == 'eps':
            v = one(DIM_NAMES['eps'])
            return {'last': v, 'first': v, 'how': how, 'acc': acc, 'filed': fd} if v is not None else None
        v = one(DIM_NAMES['sh'])
        if v is not None:
            return {'last': v, 'first': v, 'how': how, 'acc': acc, 'filed': fd}
        b = one(DIM_NAMES['shb'])
        if b is None:
            return None
        # המניות הנוספות: לכל תג — הסכום של הסוג עצמו אם מתויג, אחרת סכום הפירוט לפי סוג הענקה (HSY: המרת Class B + אופציות + RSU)
        inc = 0.0
        for n in sorted({x['name'] for x in mem[cls] if x['name'].startswith('IncrementalCommonShares')}):
            tot = [x['val'] for x in only if x['name'] == n]
            inc += tot[0] if tot else sum(x['val'] for x in mem[cls] if x['name'] == n and len(x['dims']) == 2 and 'AwardTypeAxis' in dict(x['dims']))
        return {'last': b + inc, 'first': b + inc, 'how': how + ':basic+inc', 'acc': acc, 'filed': fd}
    return None


def patch_missing(F, cik, today=None, need=None):
    """F + כל הגשה תקופתית מ־800 הימים האחרונים שאין לה ערך us-gaap/ifrs ב־companyfacts ויש לה instance במטמון. מחזיר (F, [acc…]).
    בלי instance במטמון — נרשמת ב־need (להורדה ב־xfetch.js ‏--inst)."""
    sp = os.path.join(CACHE, 'data.sec.gov', 'submissions', 'CIK%010d.json' % int(cik))
    if not os.path.exists(sp):
        return F, []
    R = json.load(open(sp)).get('filings', {}).get('recent', {})
    have = set()
    for ns in ('us-gaap', 'ifrs-full'):
        for t in (F.get('facts', {}).get(ns) or {}).values():
            for u in t.get('units', {}).values():
                have.update(x.get('accn') for x in u)
    since = (d(today or date.today().isoformat()) - __import__('datetime').timedelta(days=800)).isoformat()
    added = []
    for i, f in enumerate(R.get('form', [])):
        if R['filingDate'][i] < since:
            break
        acc = R['accessionNumber'][i]
        if not PERIODIC.match(f) or acc in have or (R.get('isXBRL') and not R['isXBRL'][i]):
            continue
        ip = os.path.join(CACHE, 'www.sec.gov', 'Archives', 'edgar', 'data', str(int(cik)), acc.replace('-', ''),
                          __import__('re').sub(r'\.htm$', '', R['primaryDocument'][i], flags=__import__('re').I) + '_htm.xml')
        if not os.path.exists(ip):
            if need is not None:
                need.add('\t'.join([str(int(cik)), acc, f, R['filingDate'][i], R['reportDate'][i], R['primaryDocument'][i]]))
            continue
        for ns, cc in parse_instance(ip, acc, f, R['filingDate'][i]).items():
            for c, v in cc.items():
                for u, arr in v['units'].items():
                    F.setdefault('facts', {}).setdefault(ns, {}).setdefault(c, {'units': {}})['units'].setdefault(u, []).extend(arr)
        added.append(acc)
    return F, added


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


ANNUAL = __import__('re').compile(r'^(10-K|10-KT|20-F|40-F)(/A)?$')


def pick(cands, asof=None):
    """מאותו (start,end): הראשון שהוגש והאחרון שהוגש (עד asof, אם ניתן — אותו בסיס כמו העובדה שמולה).
    שנה מלאה — רק מדוח שנתי כשיש (FIX: ב־10-Q של 1/2026 רבעון 1 של 2025 תויג כשנה מלאה)."""
    if not cands:
        return None
    if any(dur(x) > 330 for x in cands) and any(ANNUAL.match(x.get('form', '')) for x in cands):
        cands = [x for x in cands if ANNUAL.match(x.get('form', ''))]
    if asof:
        a = [x for x in cands if x.get('filed', '') <= asof]
        cands = a or cands
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
            # התקופה הקודמת כפי שהייתה ביום ההגשה של הנוכחית: אחרי הפרדה / שינוי חשבונאי ה־9 חודשים מוצגים מחדש בבסיס חדש,
            # והשנה (שהוגשה לפני כן) בבסיס הישן — BAC, ‏DD, ‏APTV ב־2025. ההפרש רק בין שני ערכים מאותו בסיס
            p1 = pick(prev, asof=c1['filed'])
            p1['first'] = pick(prev)['first']
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
            ps = [pick(qs[k], asof=c1['filed']) for k in ks]
            return {'first': c1['first'] - sum(p['first'] for p in ps), 'last': c1['last'] - sum(p['last'] for p in ps), 'acc': c1['acc'],
                    'form': c1['form'], 'filed': c1['filed'], 'start': ps[-1]['end'], 'end': c1['end'], 'how': 'fy-3q'}
    return None


def q4_weighted(S, e, adj=lambda filed: 1.0):
    """ממוצע משוקלל (מניות) לרבעון 4 שאין לו עובדה של 3 חודשים: (השנה × ימי השנה − Σ רבעון × ימיו) ÷ ימי רבעון 4.
    קירוב — במדולל, המניות הנוספות מחושבות לכל תקופה לפי המחיר הממוצע שלה, ורבעון הפסד לא כולל אותן."""
    for x in [x for x in S if near(x['end'], e, 3) and dur(x) > 330]:
        qs = {}
        for y in S:
            if 80 <= dur(y) <= 100 and days(x['start'], y['start']) >= -3 and days(y['end'], e) >= 80:
                qs.setdefault(y['end'], []).append(y)
        ks = sorted(qs)
        if len(ks) != 3 or not near(qs[ks[0]][0]['start'], x['start'], 3):
            continue
        fy = pick([z for z in S if z['start'] == x['start'] and z['end'] == x['end']])
        ps = [(pick(qs[k], asof=fy['filed']), dur(qs[k][0])) for k in ks]
        dq4 = days(ks[-1], e)
        if dq4 < 80:
            continue
        # ימים כולל שני הקצוות (start..end): השנה dur+1, כל רבעון dur+1, ורבעון 4 — מהיום שאחרי סוף רבעון 3 ועד e
        # כל עובדה בבסיס של היום: מוכפלת במקדם הפיצולים שאחרי ההגשה שלה (KLAC ‏1:10 ב־6/2026 — ה־10-K אחרי, הרבעונים לפני)
        return (fy['last'] * adj(fy['filed']) * (dur(x) + 1) - sum(p['last'] * adj(p['filed']) * (n + 1) for p, n in ps)) / dq4
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
    need = set()
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
            F, added = patch_missing(F, o['cik'], (o.get('asOf') or '')[:10] or None, need)
            added = set(added)
            q, Q, tags = o['q'], o['Q'], o.get('tags') or {}
            L = len(q) - 1

            # פיצול / איחוד אחרי ההגשה: ב־XBRL המספר כפי שדווח אז; המערכת מתאימה להיום (splitsUsed — DD ‏1:3, ‏KLAC ‏10:1, ‏MNST ‏2:1)
            def adj(filed, SU=o.get('splitsUsed') or [], today=(o.get('asOf') or '9999')[:10]):
                fct = 1.0
                for dd_, ff in SU:
                    if (filed or '') < dd_ <= today:
                        fct *= ff
                return fct
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
                    if not row.get('same') and not row.get('alt'):
                        # מאגר מאוחד של כל התגים החלופיים: חברה שמחליפה תג בין ה־10-Q ל־10-K (AKAM: ‏9 חודשים בתג אחד, השנה באחר)
                        pool, seen = [], set()
                        for t in ALT[comp]:
                            for x in series(F, t, comp):
                                k = (x.get('start'), x['end'], x.get('accn'))
                                if k not in seen:
                                    seen.add(k)
                                    pool.append(x)
                        r = quarter_val(pool, e, comp)
                        if r:
                            r['tag'] = 'pool'
                            row['alt'] = r
                    row['frame'] = frame_val(o['cik'], comp, e)
                    s = row.get('same')
                    if s and s.get('acc') in added:
                        s['inst'] = True                # מהגשה שחסרה ב־companyfacts — מה־instance שלה
                    if s:
                        row['ok'] = bool(tol_ok(comp, sysv, s['last']) or tol_ok(comp, sysv, s['first']))
                        row['okLast'] = tol_ok(comp, sysv, s['last'])
                    elif comp == 'sbc' and row.get('alt') and sysv is not None:
                        # התג של המערכת בלי הרבעון (מיזוג תגים בשרתון — COO, ‏FLEX, ‏GL): מול התג החלופי. רק בתגמול — התגים כמעט
                        # מילים נרדפות; ברווח לפני מס (רווח נקי + מס) וברווח נקי (לבעלי המניות הרגילות) ההגדרה שונה
                        row['ok'], row['why'] = tol_ok(comp, sysv, row['alt']['last']), 'alt'
                    vals[comp] = row
                # רווח לפני מס שלא תויג ברבעון (FLEX ‏6/2026 — אין שורה כזו ב־instance): רווח נקי + מס. מדויק כשאין רווח מפעילות שהופסקה,
                # זכויות מיעוט או חלק בכלולות — לכן רק כחלופה אחרונה, ומסומן
                pt_ = vals['pretax']
                if not pt_.get('same') and not pt_.get('alt'):
                    n_ = (vals['ni'].get('same') or vals['ni'].get('alt') or {}).get('last')
                    t_ = (vals['tax'].get('same') or vals['tax'].get('alt') or {}).get('last')
                    if n_ is not None and t_ is not None:
                        pt_['alt'] = {'last': n_ + t_, 'first': n_ + t_, 'how': 'ni+tax', 'tag': 'ni+tax'}
                # רבעון רביעי: רווח למניה ומניות — הקירוב
                # הרווח: לבעלי המניות הרגילות (אחרי דיבידנד בכורה / הקצאה לניירות משתתפים) כשמדווח — אחרת הרווח הנקי
                ni, sh, ep = vals['ni'], vals['sh'], vals['eps']
                # רבעון שאין לו עובדה בלי ממד (לא בתג של המערכת ולא בחלופי) — לפי סוג המניה מה־10-Q של הרבעון
                for comp in ('eps', 'sh'):
                    r_ = vals[comp]
                    if not r_.get('same') and not r_.get('alt') and r_.get('sys') is not None:
                        dv = dim_val(o['cik'], e, comp, need)
                        if dv:
                            f_ = adj(dv['filed']) if comp == 'sh' else 1 / adj(dv['filed'])
                            r_['dim'], r_['why'] = dv, 'dim'
                            r_['ok'] = tol_ok(comp, r_['sys'], dv['last'] * f_)
                if not sh.get('same') and not sh.get('dim') and sh.get('sys'):
                    # התג של המערכת קודם (XOM: הבסיסי — אין לה מדולל), ואז המדולל
                    for t in dict.fromkeys(x for x in (tags.get('sh'), 'WeightedAverageNumberOfDilutedSharesOutstanding') if x and '+' not in x):
                        a = q4_weighted(series(F, t, 'sh'), e, adj)
                        if a:
                            sh['approx'], sh['why'] = a, 'q4-approx'
                            sh['ok'] = tol_ok('sh', sh['sys'], a)
                            break
                if not ep.get('same') and not ep.get('dim') and sh.get('sys'):
                    # ואחרון — הרווח בתג החלופי (ALLE: ‏NetIncomeLoss לא מתויג ברבעון, ‏ProfitLoss כן; ‏BE: התג של המערכת מורכב)
                    for t in ('NetIncomeLossAvailableToCommonStockholdersDiluted', 'NetIncomeLossAvailableToCommonStockholdersBasic', None, 'alt'):
                        r = quarter_val(series(F, t, 'ni'), e, 'ni') if t and t != 'alt' else ni.get('same') if not t else ni.get('alt')
                        if r and r.get('last') is not None:
                            ep['approx'], ep['why'], ep['niTag'] = r['last'] / sh['sys'], 'q4-approx', (t if t != 'alt' else 'alt:' + str(r.get('tag'))) if t else ni.get('tag')
                            ep['ok'] = tol_ok('eps', ep['sys'], ep['approx'])
                            break
                # פיצול שהמערכת מכירה (splitsUsed) ואחרי ההגשה של העובדה: משווים אחרי אותו מקדם — לכל רכיב בנפרד
                # (MNST ‏2:1 ב־8/2026: המניות ב־10-Q של 3/2026 ו־6/2026 בבסיס הישן, ואין רווח למניה באותו תג להשוואה ההפוכה שלמטה)
                for a in ('eps', 'sh'):
                    A_ = vals[a]
                    s_ = A_.get('same')
                    if A_.get('ok') is False and s_ and A_['sys'] and s_.get('last'):
                        f_ = adj(s_.get('filed'))
                        if f_ != 1.0 and tol_ok(a, A_['sys'], s_['last'] * f_ if a == 'sh' else s_['last'] / f_):
                            A_['split'], A_['ok'] = round(1 / f_, 4), True
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
    if need:
        # קובצי instance שחסרים (הגשה שאינה ב־companyfacts, או בדיקה לפי סוג מניה) — להוריד:
        # node tools/buffett-deep/xfetch.js --inst <out>.need.tsv, ולהריץ שוב עד שאין
        open(out + '.need.tsv', 'w').write('\n'.join(sorted(need)) + '\n')
    print('שורות:', n, '· פער:', bad, '· בלי ערך עצמאי (ברבעונים שבשימוש):', miss, '· instance חסרים:', len(need))


if __name__ == '__main__':
    main()
