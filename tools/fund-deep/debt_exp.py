"""בדיקת העומק — החוב כפי שהוא מודפס במאזן (face_debt של verify.py), לכל חברה ולכל תאריך מאזן, מכל ההגשות ב־FSDS.

הצפוי לכל תאריך = ההגשה השנתית האחרונה שמדפיסה את שורות החוב (אם אין — הרבעונית האחרונה); לצידו כל הסכומים שהודפסו באותו
תאריך (חלופות), ההרכב לפי סוג, ו"צפוי חלקי" — שורת חוב במאזן בלי ערך בלי ממד באותה הגשה (Exelon). הפלט: <w>/debt/exp.json,
הקלט של `node tools/fund-deep/debt.js cmp`.

  python3 -I tools/fund-deep/debt_exp.py --db <dir>/fsds.db --w <dir> [--ciks tools/fund-deep/ciks.tsv]
"""
import argparse
import importlib.util
import json
import os
import sqlite3

HERE = os.path.dirname(os.path.abspath(__file__))


def load_verify():
    spec = importlib.util.spec_from_file_location('verify', os.path.join(HERE, 'verify.py'))
    v = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(v)
    return v


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', required=True)
    ap.add_argument('--w', required=True)
    ap.add_argument('--ciks', default=os.path.join(HERE, 'ciks.tsv'))
    o = ap.parse_args()
    V = load_verify()
    db = sqlite3.connect(o.db)
    ciks = []
    for line in open(o.ciks, encoding='utf-8'):
        p = line.split()
        if len(p) >= 2 and p[1].isdigit():
            ciks.append((p[0], int(p[1])))
    bs_cache = {}

    def bs_rows(adsh):
        if adsh not in bs_cache:
            bs_cache[adsh] = db.execute("select tag, plabel, line from pre where adsh=? and stmt='BS' and inpth=0", (adsh,)).fetchall()
        return bs_cache[adsh]

    out, seen = {}, set()
    for sym, cik in ciks:
        if cik in seen:
            continue
        seen.add(cik)
        pr = V.Printed(db, [cik])
        curs = {}
        for r in pr.rows:
            if r[3] == 'BS' and r[9] == 0:
                curs[r[10]] = curs.get(r[10], 0) + 1
        cur = max(curs, key=curs.get) if curs else 'USD'
        res = {}
        for dd in sorted({k[0] for k in pr.by if k[1] == 0}):
            byf = {}
            for r in pr.by.get((dd, 0), []):
                if r[3] == 'BS' and not r[4] and r[10] == cur:
                    byf.setdefault(r[0], [r[1], r[2], []])[2].append(r)
            tots = []
            for adsh, (form, filed, rows) in byf.items():
                # רק הגשה שבה זה תאריך של המאזן עצמו (לא הערת שוליים — Welltower)
                if not any(r[6] in ('Assets', 'LiabilitiesAndStockholdersEquity') for r in rows):
                    continue
                tot, S, used = V.Co.face_debt(None, rows)
                if tot is None and 'lease' not in S:
                    continue
                have = {r[6] for r in rows}
                a0 = max([r[5] for r in rows if r[6] == 'Assets'] or [0])
                miss = [t for t, lab, line in bs_rows(adsh) if line > a0 and t not in have and V.debt_row(t, lab or '')]
                tots.append(dict(form=form, filed=str(filed), total=tot or 0, S=S, miss=miss))
            if not tots:
                continue
            ann = [t for t in tots if not t['form'].startswith('10-Q')]
            exp = max(ann or tots, key=lambda t: t['filed'])
            d = '%s-%s-%s' % (dd[:4], dd[4:6], dd[6:8])
            res[d] = [exp['total'], sorted({t['total'] for t in tots}), exp['S']] + ([exp['miss']] if exp['miss'] else [])
        out[str(cik)] = dict(sym=sym, cur=cur, d=res)
        print(sym, len(res), flush=True)
    os.makedirs(os.path.join(o.w, 'debt'), exist_ok=True)
    with open(os.path.join(o.w, 'debt', 'exp.json'), 'w') as f:
        json.dump(out, f)


if __name__ == '__main__':
    main()
