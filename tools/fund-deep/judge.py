"""בדיקת העומק — השופט של "לפני/אחרי" (F13 בגל 3 — פחת והשקעות הוניות; מגל 4 — כל מדד).

לכל שינוי ב־<w>/allcmp.json (הפלט של allcmp.js): השורות שהודפסו בדוח של המדד (רווח והפסד / מאזן / תזרים) באותה תקופה,
בתגית מהרשימה של המוצר (US GAAP ו־IFRS, מ־fundamentals.js — `--fs`), בהגשה האחרונה שמדפיסה אותה ב־FSDS, ומי מהשניים — הישן
או החדש — שווה לאחת מהן.

  python3 -I tools/fund-deep/judge.py --db <dir>/fsds.db --w <dir> [--keys dep,capex] [--fs <fundamentals.js>] [--ciks …] [--out <קובץ>] [--anytag]

--anytag (גל 5, F20 — רווח והפסד לפי הגשה): כל שורה בדוח של המדד, בכל תגית (גם פרטית) — השורה שהמוצר לוקח היא לפעמים בתגית
שאינה ברשימה.

התקופה: שנתי — 12 חודשים מ־10-K / ‏20-F / ‏40-F; רבעוני — 3 חודשים מכל הגשה (בתזרים ב־10-Q יש רק מצטבר — לרוב "nofsds");
מאזן — תאריך. התאריכים (לקח גל 3, YUM ‏2015): ב־FSDS ‏`ddate` מעוגל לסוף החודש ו־`filed` הוא YYYYMMDD. התאריך שלנו מותאם לסוף
החודש הקרוב (עד 7 ימים — שנה של 52/53 שבועות שמסתיימת בתחילת החודש הבא נספרת לחודש הקודם), ואם באותה הגשה יש לאותו תאריך
מעוגל שני ערכים שונים באותה תגית (שתי תקופות שמתעגלות לאותו סוף חודש) — "דו־משמעי", לא "לא תואם".
פסקי הדין: better (החדש מודפס, הישן לא), worse (הפוך), both, neither, ambig (שני ערכים באותה תגית), nofsds (אין הגשה ב־FSDS
שמדפיסה — בדרך כלל 2009–2011, לפני הכיסוי, או רבעון בתזרים).
"""
import argparse
import datetime as dt
import json
import os
import subprocess
from collections import Counter
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
STMT = {'cf': 'CF', 'bs': 'BS', 'is': 'IS'}
PER_SHARE = {'eps', 'dps'}


def month_end(d):
    """התאריך שלנו (YYYY-MM-DD) → סוף החודש כפי ש־FSDS מעגל: עד 7 ימים לתוך החודש — לחודש הקודם"""
    x = dt.date.fromisoformat(d)
    if x.day <= 7:
        x = x.replace(day=1) - dt.timedelta(days=1)
    nxt = (x.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
    return (nxt - dt.timedelta(days=1)).strftime('%Y%m%d')


def same(a, b, k):
    if a is None or b is None:
        return False
    if k in PER_SHARE:
        return abs(abs(a) - abs(b)) <= 0.005
    return abs(abs(a) - abs(b)) <= max(0.5e6 if k != 'sh' else 0.5e3, 1e-4 * abs(b))


def product_tags(fs):
    """רשימות התגיות ומיקום כל מדד בדוחות — מהמוצר עצמו"""
    js = ("const F=require(%s);const s=require('fs').readFileSync(%s,'utf8');"
          "const m=s.match(/const STMT_OF = (\\{[\\s\\S]*?\\});/);const ST=eval('('+m[1]+')');"
          "console.log(JSON.stringify({g:F.TAGS.gaap,i:F.TAGS.ifrs,st:ST}))") % (json.dumps(fs), json.dumps(fs))
    d = json.loads(subprocess.check_output(['node', '-e', js]))
    tags = {k: list(dict.fromkeys(t for t in (d['g'].get(k) or []) + (d['i'].get(k) or []) if '-' not in t))
            for k in set(d['g']) | set(d['i'])}
    return tags, d['st']


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', required=True)
    ap.add_argument('--w', required=True)
    ap.add_argument('--keys', default='dep,capex')
    ap.add_argument('--fs', default=os.path.join(ROOT, 'ibkr-proxy/lib/fundamentals.js'))
    ap.add_argument('--ciks', default=os.path.join(HERE, 'ciks.tsv'))
    ap.add_argument('--out', default=None)
    ap.add_argument('--anytag', action='store_true', help='גל 5 (F20): כל שורה בדוח, לא רק התגיות של המוצר')
    o = ap.parse_args()
    TAGS, ST = product_tags(os.path.abspath(o.fs))
    keys = set(o.keys.split(','))
    cik = {}
    for line in open(o.ciks, encoding='utf-8'):
        p = line.split()
        if len(p) >= 2 and p[1].isdigit():
            cik.setdefault(p[0], int(p[1]))
    ch = [r for r in json.load(open(os.path.join(o.w, 'allcmp.json'), encoding='utf-8')) if r[2] in keys and TAGS.get(r[2])]
    db = sqlite3.connect(o.db)
    res, cnt = [], Counter()
    for sym, mode, k, end, old, new in ch:
        c = cik.get(sym)
        sts = [STMT[s] for s in ST.get(k, ['is'])]
        inst = sts == ['BS']
        qtrs = 0 if inst else (4 if mode == 'A' else 1)
        forms = "AND (s.form LIKE '10-K%%' OR s.form LIKE '20-F%%' OR s.form LIKE '40-F%%') " if mode == 'A' and not inst else ''
        q = ('SELECT s.adsh, s.filed, n.tag, n.value FROM sub s JOIN pre p ON p.adsh = s.adsh JOIN num n ON n.adsh = p.adsh AND n.tag = p.tag '
             'AND n.version = p.version WHERE s.cik = ? ' + forms + 'AND p.stmt IN (%s) AND n.ddate = ? AND n.qtrs = ? '
             + ('' if o.anytag else 'AND n.tag IN (%s)' % ','.join('?' * len(TAGS[k])))) % ','.join('?' * len(sts))
        rows = db.execute(q, [c] + sts + [month_end(end), qtrs] + ([] if o.anytag else TAGS[k])).fetchall() if c else []
        printed = []
        if not rows:
            v = 'nofsds'
        else:
            last = max(r[1] for r in rows)
            vals = {}
            for adsh, filed, tag, val in rows:
                if filed == last:
                    vals.setdefault(tag, set()).add(round(val, 4) if k in PER_SHARE else round(val))
            printed = sorted({x for s in vals.values() for x in s})
            if any(len(s) > 1 for s in vals.values()):
                v = 'ambig'
            else:
                a, b = any(same(old, x, k) for x in printed), any(same(new, x, k) for x in printed)
                v = 'both' if a and b else 'better' if b else 'worse' if a else 'neither'
        cnt[(k, v)] += 1
        res.append([sym, mode, k, end, old, new, v] + ([printed] if rows else []))
    by = {}
    for (k, v), n in sorted(cnt.items()):
        by.setdefault(k, {})[v] = n
    print(json.dumps(by, ensure_ascii=False))
    for r in res:
        if r[6] in ('worse', 'neither', 'ambig'):
            print(' ', *r)
    json.dump(res, open(o.out or os.path.join(o.w, 'judge.json'), 'w'))


if __name__ == '__main__':
    main()
