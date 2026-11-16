#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""בדיקת העומק של מנתח החברות (16/11/2026, docs/fund-deep-audit.md) — המקור המודפס: Financial Statement Data Sets של SEC.

כל הגשה רבעונית/שנתית מאז 2009 — הדוחות כפי שהודפסו (pre.txt: השורות, הסדר, התווית; num.txt: הערכים בלי מימדים).
הכלי מוריד כל קובץ רבעוני, משאיר רק את ההגשות של החברות שלנו, ובונה מסד SQLite אחד. בלתי תלוי בשרתון: קוד אחר, שפה אחרת,
מקור אחר (לא companyfacts), ובלי מיפוי התגיות של lib/fundamentals.js.

  python3 -I tools/fund-deep/fsds.py --db <scratch>/fsds.db --ciks <scratch>/sec/ciks.tsv [--from 2014q1] [--to 2026q3] [--cache <dir>] [--keep]

הערות על הנתונים (מהתיעוד של SEC ומבדיקה חיה):
- num.txt כולל רק את העובדות שבדוחות עצמם (מאזן, רווח והפסד, תזרים, הון, רווח כולל) — לא את הביאורים.
- ddate מעוגל לסוף החודש הקרוב (שנה של 52/53 שבועות: 2025-09-27 → 20250930). qtrs: 0 = מאזן, 1 = רבעון, 4 = שנה.
- segments/coreg ריקים = הערך המאוחד של החברה עצמה. שורה עם מימד לא נשמרת.
"""
import argparse
import io
import os
import sqlite3
import sys
import time
import urllib.error
import urllib.request
import zipfile

UA = 'TheSnowball/1.0 data@thesnowball.app'  # SEC חוסם דפדפן ומבקש User-Agent עם כתובת קשר
BASE = 'https://www.sec.gov/files/dera/data/financial-statement-data-sets/'
FORMS = {'10-K', '10-K/A', '10-KT', '10-KT/A', '10-Q', '10-Q/A', '20-F', '20-F/A', '40-F', '40-F/A', '6-K', '6-K/A'}

SCHEMA = '''
CREATE TABLE IF NOT EXISTS loaded (q TEXT PRIMARY KEY, subs INTEGER, pre INTEGER, num INTEGER, at TEXT);
CREATE TABLE IF NOT EXISTS sub (adsh TEXT PRIMARY KEY, cik INTEGER, name TEXT, sic INTEGER, form TEXT, period TEXT, fy TEXT, fp TEXT,
  filed TEXT, accepted TEXT, prevrpt INTEGER, instance TEXT, fye TEXT, afs TEXT, q TEXT);
CREATE TABLE IF NOT EXISTS pre (adsh TEXT, report INTEGER, line INTEGER, stmt TEXT, inpth INTEGER, rfile TEXT, tag TEXT, version TEXT,
  plabel TEXT, negating INTEGER);
CREATE TABLE IF NOT EXISTS num (adsh TEXT, tag TEXT, version TEXT, ddate TEXT, qtrs INTEGER, uom TEXT, value REAL);
'''
INDEXES = '''
CREATE INDEX IF NOT EXISTS sub_cik ON sub(cik);
CREATE INDEX IF NOT EXISTS pre_adsh ON pre(adsh, stmt);
CREATE INDEX IF NOT EXISTS num_adsh ON num(adsh, tag);
CREATE INDEX IF NOT EXISTS num_tag ON num(tag, ddate, qtrs);
'''


def quarters(a, b):
    y, q = int(a[:4]), int(a[5])
    y2, q2 = int(b[:4]), int(b[5])
    while (y, q) <= (y2, q2):
        yield '%dq%d' % (y, q)
        q += 1
        if q > 4:
            q, y = 1, y + 1


def fetch(url, dest, tries=5):
    """הורדה בזרם לקובץ זמני ואז שינוי שם — קובץ חלקי לא נשאר בשם הסופי. 404 = הרבעון עוד לא פורסם."""
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=120) as r, open(dest + '.part', 'wb') as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            os.replace(dest + '.part', dest)
            return True
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return False
            err = e
        except Exception as e:  # רשת: ניסיון חוזר עם המתנה גדלה
            err = e
        time.sleep(2 ** i * 3)
    raise RuntimeError('הורדה נכשלה: %s (%s)' % (url, err))


def rows(z, name):
    """שורות קובץ טקסט מתוך ה־zip (טאבים, שורת כותרת) — מחזיר (כותרות, גנרטור של שורות גולמיות)"""
    f = io.TextIOWrapper(z.open(name), encoding='utf-8', errors='replace', newline='\n')
    head = f.readline().rstrip('\r\n').split('\t')
    return head, f


def ingest(db, q, path, ciks):
    z = zipfile.ZipFile(path)
    head, f = rows(z, 'sub.txt')
    ix = {k: i for i, k in enumerate(head)}
    subs = []
    for line in f:
        p = line.rstrip('\r\n').split('\t')
        if len(p) < len(head):
            continue
        try:
            cik = int(p[ix['cik']])
        except ValueError:
            continue
        if cik not in ciks or p[ix['form']] not in FORMS:
            continue
        g = lambda k: p[ix[k]] if k in ix else None
        subs.append((g('adsh'), cik, g('name'), int(g('sic') or 0) if (g('sic') or '').isdigit() else None, g('form'), g('period'), g('fy'), g('fp'),
                     g('filed'), g('accepted'), int(g('prevrpt') or 0) if (g('prevrpt') or '').isdigit() else None, g('instance'), g('fye'), g('afs'), q))
    adsh = {s[0] for s in subs}
    db.executemany('INSERT OR REPLACE INTO sub VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', subs)

    head, f = rows(z, 'pre.txt')
    ix = {k: i for i, k in enumerate(head)}
    buf, npre = [], 0
    for line in f:
        a = line[:20]
        if a not in adsh:
            continue
        p = line.rstrip('\r\n').split('\t')
        if len(p) < len(head):
            continue
        g = lambda k: p[ix[k]] if k in ix else None
        buf.append((g('adsh'), int(g('report') or 0), int(g('line') or 0), g('stmt'), int(g('inpth') or 0), g('rfile'), g('tag'), g('version'),
                    g('plabel'), int(g('negating') or 0)))
        if len(buf) >= 50000:
            db.executemany('INSERT INTO pre VALUES (?,?,?,?,?,?,?,?,?,?)', buf)
            npre += len(buf)
            buf = []
    if buf:
        db.executemany('INSERT INTO pre VALUES (?,?,?,?,?,?,?,?,?,?)', buf)
        npre += len(buf)

    head, f = rows(z, 'num.txt')
    ix = {k: i for i, k in enumerate(head)}
    iseg, ico = ix.get('segments'), ix.get('coreg')
    buf, nnum = [], 0
    for line in f:
        a = line[:20]
        if a not in adsh:
            continue
        p = line.rstrip('\r\n').split('\t')
        if len(p) < len(head) - 1:  # footnote אחרון יכול להיות חסר
            continue
        if (iseg is not None and p[iseg]) or (ico is not None and p[ico]):
            continue  # ערך עם מימד / של ישות אחרת בהגשה — לא הערך המאוחד
        v = p[ix['value']]
        if v == '':
            continue
        buf.append((p[ix['adsh']], p[ix['tag']], p[ix['version']], p[ix['ddate']], int(p[ix['qtrs']] or 0), p[ix['uom']], float(v)))
        if len(buf) >= 100000:
            db.executemany('INSERT INTO num VALUES (?,?,?,?,?,?,?)', buf)
            nnum += len(buf)
            buf = []
    if buf:
        db.executemany('INSERT INTO num VALUES (?,?,?,?,?,?,?)', buf)
        nnum += len(buf)
    db.execute('INSERT OR REPLACE INTO loaded VALUES (?,?,?,?,?)', (q, len(subs), npre, nnum, time.strftime('%Y-%m-%d %H:%M:%S')))
    db.commit()
    return len(subs), npre, nnum


def load_ciks(path, extra):
    out = set()
    for line in open(path, encoding='utf-8'):
        p = line.split()
        if len(p) >= 2 and p[1].isdigit():
            out.add(int(p[1]))
    for c in extra:
        out.add(int(c))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--db', required=True)
    ap.add_argument('--ciks', required=True)
    ap.add_argument('--extra', default='', help='CIK נוספים מופרדים בפסיק (ישות קודמת וכו׳)')
    ap.add_argument('--from', dest='a', default='2014q1')
    ap.add_argument('--to', dest='b', default='2026q3')
    ap.add_argument('--cache', default=None)
    ap.add_argument('--keep', action='store_true', help='לא למחוק את קבצי ה־zip אחרי הטעינה')
    o = ap.parse_args()
    ciks = load_ciks(o.ciks, [x for x in o.extra.split(',') if x.strip()])
    cache = o.cache or os.path.join(os.path.dirname(os.path.abspath(o.db)), 'fsds')
    os.makedirs(cache, exist_ok=True)
    db = sqlite3.connect(o.db)
    db.executescript('PRAGMA journal_mode=WAL; PRAGMA synchronous=OFF;' + SCHEMA)
    done = {r[0] for r in db.execute('SELECT q FROM loaded')}
    print('חברות: %d · רבעונים %s–%s · נטענו כבר: %d' % (len(ciks), o.a, o.b, len(done)), flush=True)
    for q in quarters(o.a, o.b):
        if q in done:
            continue
        path = os.path.join(cache, q + '.zip')
        t0 = time.time()
        if not os.path.exists(path) and not fetch(BASE + q + '.zip', path):
            print('%s: לא פורסם (404)' % q, flush=True)
            continue
        # טעינה חלקית קודמת (נקטעה) — מוחקים את מה שנכנס מאותו רבעון לפני טעינה מחדש
        old = [r[0] for r in db.execute('SELECT adsh FROM sub WHERE q=?', (q,))]
        for i in range(0, len(old), 500):
            ch = old[i:i + 500]
            qm = ','.join('?' * len(ch))
            db.execute('DELETE FROM pre WHERE adsh IN (%s)' % qm, ch)
            db.execute('DELETE FROM num WHERE adsh IN (%s)' % qm, ch)
        s, p, n = ingest(db, q, path, ciks)
        if not o.keep:
            os.remove(path)
        print('%s: %d הגשות · %d שורות דוח · %d ערכים · %.0f שנ׳' % (q, s, p, n, time.time() - t0), flush=True)
    db.executescript(INDEXES)
    db.commit()
    tot = db.execute('SELECT COUNT(*), (SELECT COUNT(*) FROM pre), (SELECT COUNT(*) FROM num) FROM sub').fetchone()
    print('סה״כ: %d הגשות · %d שורות דוח · %d ערכים' % tot, flush=True)


if __name__ == '__main__':
    sys.exit(main())
