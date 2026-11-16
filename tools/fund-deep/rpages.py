#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""בדיקת העומק של מנתח החברות (16/11/2026, docs/fund-deep-audit.md) — הדוחות המודפסים של ההגשות האחרונות.

קבצי FSDS של SEC מתפרסמים פעם ברבעון (אחרי סופו), ולכן ההגשות של הרבעון הנוכחי — השנה והרבעון האחרונים, המספרים הבולטים
ביותר במסך — עוד לא בהם. הכלי קורא את דפי הדוחות (R pages) של כל הגשה כזו ישירות מ־EDGAR: FilingSummary.xml → הדוחות
בקטגוריה Statements → כל שורה (התגית מתוך defref, התווית המודפסת) וכל עמודה (תאריך ומשך) — ומכניס אותם לאותו מסד ובאותה
צורה כמו fsds.py (טבלאות sub/pre/num, ‏q='rpage'). קוד נפרד מ־lib/secface.js של השרתון (שפה אחרת, מימוש אחר).

  python3 -I tools/fund-deep/rpages.py --db <scratch>/fsds.db --ciks <scratch>/sec/ciks.tsv [--since 2026-10-01] [--syms AAPL,MSFT]

הערות:
- הערך בדף הוא כפי שהודפס: שורה עם תווית הפוכה (תשלומים בתזרים) מוצגת בסוגריים. כדי להשוות לערך ה־XBRL (כמו ב־FSDS) —
  תשלום (Payments*/Repayments*) שהודפס שלילי נשמר חיובי, ו־negating=1.
- קנה המידה מהכותרת ("$ in Millions", "shares in Thousands"); למניה — בלי קנה מידה; מניות — לפי "(in shares)" בתווית.
"""
import argparse
import datetime as dt
import html
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request

UA = 'TheSnowball/1.0 data@thesnowball.app'
FORMS = {'10-K', '10-K/A', '10-KT', '10-Q', '10-Q/A', '20-F', '20-F/A', '40-F', '40-F/A'}
MON = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}
SCALE = {'thousands': 1e3, 'millions': 1e6, 'billions': 1e9}
_last = [0.0]


def get(url, binary=False):
    """בקשה ל־SEC בקצב של עד 5 בשנייה, עם ניסיונות חוזרים"""
    err = None
    for i in range(5):
        w = _last[0] + 0.2 - time.time()
        if w > 0:
            time.sleep(w)
        _last[0] = time.time()
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                b = r.read()
            return b if binary else b.decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            err = e
        except Exception as e:
            err = e
        time.sleep(2 * (i + 1))
    raise RuntimeError('%s: %s' % (url, err))


def stmt_of(name):
    n = name.lower()
    par = 1 if 'parenthetical' in n else 0
    if re.search(r'comprehensive (income|loss)', n) and not re.search(r'operations and comprehensive|income and comprehensive|earnings and comprehensive', n):
        return 'CI', par
    if re.search(r'balance sheet|financial (position|condition)|statements? of condition|assets and liabilities', n):
        return 'BS', par
    if re.search(r'cash flow', n):
        return 'CF', par
    if re.search(r"(stockholders|shareholders|shareowners|changes in) .{0,20}(equity|deficit)|statements? of equity|changes in equity", n):
        return 'EQ', par
    if re.search(r'operations|income|earnings|loss', n):
        return 'IS', par
    return None, par


def parse_date(s):
    s = s.strip().replace('.', '')
    m = re.match(r'([A-Za-z]{3})[a-z]* (\d{1,2}), (\d{4})', s)
    if not m:
        return None
    return dt.date(int(m.group(3)), MON[m.group(1).lower()], int(m.group(2)))


PS_TAG = re.compile(r'PerShare|PerBasicShare|PerDilutedShare|PerBasicAndDilutedShare|PerUnit|PerOutstandingLimitedPartnershipUnit')
SH_TAG = re.compile(r'^WeightedAverageNumberOf|Shares(Outstanding|Issued|Authorized)?$|^SharesOutstanding')


def me(d):
    if d.day < 15:
        d = d.replace(day=1) - dt.timedelta(days=1)
    nx = (d.replace(day=28) + dt.timedelta(days=4))
    last = nx - dt.timedelta(days=nx.day)
    return last.strftime('%Y%m%d')


def num_cell(t):
    t = html.unescape(re.sub(r'<[^>]+>', '', t)).strip()
    if not t or t in ('—', '-', '–'):
        return None
    neg = t.startswith('(') or t.startswith('-') or t.startswith('$ (') or '(' in t[:4]
    x = re.sub(r'[^0-9.]', '', t)
    if not x or x == '.':
        return None
    v = float(x)
    return -v if neg else v


def parse_r(page, title_hint=''):
    """דף R → (stmt, inpth, currency, rows) כאשר rows = [(line, ns, tag, label, ddate, qtrs, uom, value, negating)]"""
    tbl = re.search(r'<table class="report".*?</table>', page, re.S)
    if not tbl:
        return None
    t = tbl.group(0)
    trs = re.findall(r'<tr[^>]*>(.*?)</tr>', t, re.S)
    if not trs:
        return None
    head = re.search(r'<th class="tl"[^>]*>(.*?)</th>', trs[0], re.S)
    title = html.unescape(re.sub(r'<[^>]+>', ' ', head.group(1))) if head else title_hint
    title = re.sub(r'\s+', ' ', title).strip()
    mcur = re.search(r'- ([A-Z]{3}) \(', title)
    cur = mcur.group(1) if mcur else 'USD'
    # "shares in Thousands, $ in Millions" — המטבע הוא $ / סמל / קוד של 3 אותיות גדולות בדיוק (לא סוף של "shares")
    sc_money = next((SCALE[k] for k in SCALE if re.search(r'(?<![A-Za-z])(\$|€|£|¥|[A-Z]{3}) in (?i:' + k + ')', title)), 1.0)
    sc_sh = next((SCALE[k] for k in SCALE if re.search(r'shares in ' + k, title, re.I)), 1.0)
    # כותרות העמודות: שורה ראשונה — משכים עם colspan; שורה שנייה — תאריכים (או תאריכים ישירות בשורה הראשונה, במאזן)
    durs, dates = [], []
    hdr_rows = [r for r in trs if '<th' in r]
    first = [(re.search(r'colspan="(\d+)"', a).group(1) if 'colspan' in a else None, x)
             for a, x in re.findall(r'<th class="th"([^>]*)>(.*?)</th>', hdr_rows[0], re.S)]
    def txt(x):
        return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', x))).strip()
    if len(hdr_rows) > 1:
        for cs, x in first:
            n = int(cs or 1)
            m = re.match(r'(\d+) Months? Ended', txt(x))
            q = int(round(int(m.group(1)) / 3)) if m else None
            durs += [q] * n
        for x in re.findall(r'<th class="th"[^>]*>(.*?)</th>', hdr_rows[1], re.S):
            dates.append(parse_date(txt(x)))
    else:
        for cs, x in first:
            dates.append(parse_date(txt(x)))
            durs.append(0)
    if not dates or len(durs) < len(dates):
        durs += [0] * (len(dates) - len(durs))
    rows = []
    line = 0
    member = False
    for tr in re.findall(r'<tr[^>]*>.*?</tr>', t, re.S)[len(hdr_rows):]:
        # שורת כותרת של רכיב (class="rh", "Products [Member]") — מכאן ועד הכותרת הבאה: ערכים עם מימד, לא הסך המאוחד
        if re.match(r'<tr class="rh"', tr):
            member = True
            continue
        if member:
            continue
        pl = re.search(r"<td class=\"pl[^\"]*\"[^>]*>.*?defref_([A-Za-z0-9\-]+)_([A-Za-z0-9_]+)'.*?>(.*?)</a>", tr, re.S)
        if not pl:
            continue
        line += 1
        ns, tag, lab = pl.group(1), pl.group(2), txt(pl.group(3))
        cells = re.findall(r'<td class="(nump|num|text|th)"[^>]*>(.*?)</td>', tr, re.S)
        vals = [num_cell(c) if k in ('nump', 'num') else None for k, c in cells]
        is_ps = bool(PS_TAG.search(tag) or re.search(r'per (common |ordinary |diluted |basic )?(share|unit)|\(in [a-z$ ]+ per share\)', lab, re.I))
        is_sh = not is_ps and bool(SH_TAG.search(tag) or re.search(r'\(in shares\)|\bshares\b.*\(in (millions|thousands)\)', lab, re.I))
        for ci, v in enumerate(vals):
            if v is None or ci >= len(dates) or dates[ci] is None:
                continue
            uom = 'shares' if is_sh else cur
            val = v * (sc_sh if is_sh else 1.0 if is_ps else sc_money)
            neg = 0
            if tag.startswith(('Payments', 'Repayments')) and val < 0:
                val, neg = -val, 1
            rows.append((line, ns, tag, lab, me(dates[ci]), durs[ci] if ci < len(durs) and durs[ci] is not None else 0, uom, val, neg))
    st, par = stmt_of(title)
    return st, par, cur, rows


def filings(cik, since):
    j = json.loads(get('https://data.sec.gov/submissions/CIK%010d.json' % cik))
    r = j.get('filings', {}).get('recent', {})
    out = []
    for i, f in enumerate(r.get('form', [])):
        if f in FORMS and r['filingDate'][i] >= since:
            out.append(dict(acc=r['accessionNumber'][i], form=f, filed=r['filingDate'][i], period=r.get('reportDate', [''])[i] or ''))
    return j.get('name', ''), j.get('sic'), out


def ingest(db, cik, name, sic, f):
    acc = f['acc']
    base = 'https://www.sec.gov/Archives/edgar/data/%d/%s/' % (cik, acc.replace('-', ''))
    fs = get(base + 'FilingSummary.xml')
    if not fs:
        return 0, 0
    reps = re.findall(r'<Report[^>]*>(.*?)</Report>', fs, re.S)
    n_pre = n_num = 0
    db.execute('DELETE FROM pre WHERE adsh=?', (acc,))
    db.execute('DELETE FROM num WHERE adsh=?', (acc,))
    db.execute('INSERT OR REPLACE INTO sub VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
               (acc, cik, name, int(sic or 0) if str(sic or '').isdigit() else None, f['form'], (f['period'] or '').replace('-', ''), None, None,
                f['filed'].replace('-', ''), None, 0, None, None, None, 'rpage'))
    for rp in reps:
        cat = re.search(r'<MenuCategory>(.*?)</MenuCategory>', rp)
        fn = re.search(r'<HtmlFileName>(.*?)</HtmlFileName>', rp)
        ln = re.search(r'<LongName>(.*?)</LongName>', rp)
        pos = re.search(r'<Position>(\d+)</Position>', rp)
        if not cat or cat.group(1) != 'Statements' or not fn:
            continue
        page = get(base + fn.group(1))
        if not page:
            continue
        res = parse_r(page, html.unescape(ln.group(1)) if ln else '')
        if not res or not res[0]:
            continue
        st, par, cur, rows = res
        rep = int(pos.group(1)) if pos else 0
        seen = set()
        for line, ns, tag, lab, ddate, qtrs, uom, val, neg in rows:
            ver = ns + '/rp'
            if (tag, line) not in seen:
                seen.add((tag, line))
                db.execute('INSERT INTO pre VALUES (?,?,?,?,?,?,?,?,?,?)', (acc, rep, line, st, par, 'H', tag, ver, lab, neg))
                n_pre += 1
            db.execute('INSERT INTO num VALUES (?,?,?,?,?,?,?)', (acc, tag, ver, ddate, qtrs, uom, val))
            n_num += 1
    db.commit()
    return n_pre, n_num


def fix_from_cf(db, cache):
    """דף R מציג ערך מעוגל, בסקאלה של הכותרת ובסימן של התצוגה (שורה עם תווית הפוכה — "(169)" להוצאות מימון).
    companyfacts מחזיק את אותה עובדה מאותה הגשה (accn) — ערך מלא, בסימן של העובדה, ביחידה המדויקת. תגית של החברה עצמה
    (לא us-gaap/ifrs-full/dei) — לא שם, ונשארת כפי שנקראה."""
    subs = db.execute("SELECT adsh, cik FROM sub WHERE q='rpage'").fetchall()
    by = {}
    for a, c in subs:
        by.setdefault(c, set()).add(a)
    fixed = kept = 0
    for cik, adset in sorted(by.items()):
        path = os.path.join(cache, 'cf_%d.json' % cik)
        if not os.path.exists(path):
            try:
                b = get('https://data.sec.gov/api/xbrl/companyfacts/CIK%010d.json' % cik)
            except Exception as e:
                print('CIK %d: companyfacts נכשל: %s' % (cik, e), flush=True)
                continue
            open(path, 'w', encoding='utf-8').write(b)
        j = json.load(open(path, encoding='utf-8'))
        idx = {}
        for tax in ('us-gaap', 'ifrs-full', 'dei', 'srt'):
            for tag, o in ((j.get('facts') or {}).get(tax) or {}).items():
                for unit, arr in (o.get('units') or {}).items():
                    for f in arr:
                        if f.get('accn') in adset:
                            idx.setdefault((tag, f['accn']), []).append(f | {'unit': unit})
        for adsh in adset:
            for rowid, tag, ddate, qtrs, uom, val in db.execute(
                    'SELECT rowid, tag, ddate, qtrs, uom, value FROM num WHERE adsh=?', (adsh,)).fetchall():
                fs = []
                for f in idx.get((tag, adsh), []):
                    e = dt.date.fromisoformat(f['end'])
                    if me(e) != ddate:
                        continue
                    q = int(round((e - dt.date.fromisoformat(f['start'])).days / 91.3)) if f.get('start') else 0
                    if q == qtrs:
                        fs.append(f)
                if not fs:
                    kept += 1
                    continue
                f = min(fs, key=lambda f: abs(abs(f['val']) - abs(val)))
                u = f['unit']
                u2 = 'shares' if u == 'shares' else u.split('/')[0] if u.endswith('/shares') else u
                db.execute('UPDATE num SET value=?, uom=? WHERE rowid=?', (float(f['val']), u2, rowid))
                fixed += 1
        db.commit()
    print('תיקון מ־companyfacts: %d ערכים הוחלפו בערך המדויק · %d נשארו מהטבלה (תגית של החברה)' % (fixed, kept), flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', required=True)
    ap.add_argument('--ciks', required=True)
    ap.add_argument('--since', default='2026-10-01')
    ap.add_argument('--syms', default='')
    ap.add_argument('--fix', default='', help='רק מעבר התיקון מ־companyfacts; התיקייה של cf_<cik>.json (המטמון של verify.py)')
    o = ap.parse_args()
    want = {s.strip().upper().replace('.', '-') for s in o.syms.split(',') if s.strip()}
    ciks = []
    for line in open(o.ciks, encoding='utf-8'):
        p = line.split()
        if len(p) >= 2 and p[1].isdigit() and (not want or p[0].upper().replace('.', '-') in want):
            ciks.append((p[0], int(p[1])))
    db = sqlite3.connect(o.db)
    db.execute('PRAGMA synchronous=OFF')
    if o.fix:
        return fix_from_cf(db, o.fix)
    done = {r[0] for r in db.execute("SELECT adsh FROM sub WHERE q='rpage'")}
    seen = set()
    for sym, cik in ciks:
        if cik in seen:
            continue
        seen.add(cik)
        try:
            name, sic, fl = filings(cik, o.since)
        except Exception as e:
            print('%s: submissions נכשל: %s' % (sym, e), flush=True)
            continue
        for f in fl:
            if f['acc'] in done:
                continue
            try:
                a, b = ingest(db, cik, name, sic, f)
                print('%s %s %s: %d שורות · %d ערכים' % (sym, f['form'], f['filed'], a, b), flush=True)
            except Exception as e:
                print('%s %s: נכשל: %s' % (sym, f['acc'], e), flush=True)
    print('סיום', flush=True)


if __name__ == '__main__':
    sys.exit(main())
