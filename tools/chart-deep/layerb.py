#!/usr/bin/env python3
"""בדיקת העומק של גרף הנרות — גל 3: שכבה B (יומי/שבועי/חודשי של מניות ארה"ב מול Webull ומול עצמו).
משלים את compare.py במה שהשוואה לפי נר לא מראה:
 • daily — היומי של Yahoo (מה שהגרף מציג) מול Webull: תואם / שונה. לפני 2001 (מחירים בשברים) בנפרד;
   מ־2001 לפי סוג: פתיחה בלבד, גבוה/נמוך, סגירה, וכל אחד מהם גם אחרי קנה מידה (פיצול/ספין־אוף שהותאמו אחרת)
 • attr — שיוך כל יום שונה לסוג הפגם (classify): נר שטוח, נמוך/גבוה = סגירה ב־Webull, נר לא תקין, פתיחה↔סגירה
   הפוכות (+ מבחן פער הלילה: במקור הנכון הפתיחה קרובה לסגירה הקודמת), פתיחה = הסגירה הקודמת (ותאריכים חוזרים)
 • self — שבועי/חודשי מול צבירת היומי של אותו מקור: Yahoo (האם הגרף עקבי) ו־Webull (האם אפשר לאמת מולו שבועי/חודשי)
 • wd — סמלים שהשבועי שלהם לא מתחיל ביום שני (C-013), עם היום הראשון ביומי ויום השבוע של 1 בינואר באותה שנה
 • depth — היומי הראשון: Yahoo מול Webull; החודשי הראשון מול היומי (C-020: חודשי מ־01/1985)
הרצה: python3 -I tools/chart-deep/layerb.py --out <dir> [--syms A,B | --file list.txt] [--json <file>]
      python3 -I tools/chart-deep/layerb.py --selftest"""
import json
import os
import sys
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta, timezone

WDN = ('שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת', 'ראשון')


def day(t):
    """תאריך הנר: +6 שעות מספיק לכל המוסכמות כאן (Yahoo ‏09:30/00:00 ניו יורק, Webull חצות ניו יורק או UTC)"""
    t = t / 1000 if t > 1e11 else t
    return (datetime.fromtimestamp(t, timezone.utc) + timedelta(hours=6)).date()


def wkey(d):
    return d.isocalendar()[:2]


def mkey(d):
    return (d.year, d.month)


def load(p):
    if not os.path.exists(p):
        return []
    return [b for b in (json.load(open(p, encoding='utf-8')).get('bars') or []) if None not in b[1:5]]


def tol(x):
    return max(0.011, 0.0005 * abs(x))


def classify(y, w, g, yp=None, wp=None):
    """סוג ההבדל בין נר יומי של Yahoo (y) לנר של Webull (w, כפול קנה המידה g), או None כשהם תואמים.
    yp/wp — הנר הקודם של כל מקור. הסדר: שטוח באחד מהם → פתיחה↔סגירה הפוכות (קנה מידה מהגבוה/הנמוך של היום)
    → פגמים מוכרים של Webull → נר לא תקין → פתיחה בלבד (= הסגירה הקודמת?) → שדה יחיד → כמה שדות"""
    t = lambda v: max(0.011, 0.001 * abs(v))
    d = [abs(y[j] - w[j] * g) > t(y[j]) for j in (1, 2, 3, 4)]
    if not any(d):
        return None
    flat = lambda b: b[1] == b[2] == b[3] == b[4]
    if flat(y) != flat(w):
        return 'y-flat' if flat(y) else 'wb-flat'
    g2 = (y[2] / w[2] + y[3] / w[3]) / 2 if w[2] > 0 and w[3] > 0 else g
    if all(abs(y[j] - w[j] * g2) <= t(y[j]) for j in (2, 3)) and abs(y[1] - w[4] * g2) <= t(y[1]) and abs(y[4] - w[1] * g2) <= t(y[4]):
        return 'oc-swap'
    if w[3] == w[4] and d[2] and y[3] < w[3] * g:
        return 'wb-low=close'
    if w[2] == w[4] and d[1] and y[2] > w[2] * g:
        return 'wb-high=close'
    if w[3] > min(w[1], w[4]) or w[2] < max(w[1], w[4]):
        return 'wb-invalid'
    if y[3] > min(y[1], y[4]) + 1e-9 or y[2] < max(y[1], y[4]) - 1e-9:
        return 'y-invalid'
    if d[0] and not any(d[1:]):
        if yp and abs(y[1] - yp[4]) < 1e-6:
            return 'o:y=prevclose'
        if wp and abs(w[1] - wp[4]) < 1e-6:
            return 'o:wb=prevclose'
        return 'o:other'
    if sum(d) == 1:
        return 'hlc'[d.index(True) - 1] + '-only'
    return 'multi'


def agg(bars, key):
    o = {}
    for b in bars:
        o.setdefault(key(day(b[0])), []).append(b)
    return {k: (v[0][1], max(x[2] for x in v), min(x[3] for x in v), v[-1][4], len(v)) for k, v in o.items()}


def self_check(daily, per, key):
    """נרות שבוע/חודש (בלי הראשון — חלקי — ובלי האחרון — חי) מול צבירת היומי של אותו מקור"""
    A = agg(daily, key)
    cur = key(day(daily[-1][0]))   # התקופה הנוכחית — חיה (וב־1mo עם שורה כפולה, C-003): הצילומים בשעות שונות
    n, bad, years, ex = 0, 0, Counter(), []
    for b in per[1:-1]:
        a = A.get(key(day(b[0])))
        if not a or key(day(b[0])) >= cur:
            continue
        n += 1
        if any(abs(b[i + 1] - a[i]) > tol(a[i]) for i in range(4)):
            bad += 1
            years[day(b[0]).year] += 1
            if len(ex) < 3:
                ex.append([str(day(b[0])), [round(x, 4) for x in b[1:5]], [round(x, 4) for x in a[:4]]])
    return {'n': n, 'bad': bad, 'years': dict(years), 'ex': ex}


def daily_vs(Y, B, live=True):
    """היומי של Yahoo מול Webull. קנה מידה מקומי = חציון יחס הסגירות ב־±10 ימים (פיצולים והתאמות שונות).
    live — הנר האחרון של Yahoo הוא היום החי (הצילומים בשעות שונות) ולא נספר"""
    Bm = {day(b[0]): b for b in B}
    ks = [day(b[0]) for b in (Y[:-1] if live else Y) if day(b[0]) in Bm]
    Ym = {day(b[0]): b for b in Y}
    rs = [Ym[k][4] / Bm[k][4] if Bm[k][4] else None for k in ks]
    st = {'n': len(ks), 'n2001': 0, 'same': 0, 'pre2001': 0, 'cls': Counter(), 'ex': defaultdict(list),
          'attr': {'pre': Counter(), 'post': Counter()}, 'attrYears': defaultdict(Counter), 'attrEx': {},
          'ypc': Counter(), 'swap': [0, 0]}
    for i, k in enumerate(ks):
        y, w = Ym[k], Bm[k]
        st['n2001'] += k.year >= 2001
        win = sorted(r for r in rs[max(0, i - 10):i + 11] if r)
        g = win[len(win) // 2] if win else 1
        if abs(g - 1) < 0.002:
            g = 1
        bad = ''.join(f for j, f in enumerate('ohlc', 1) if abs(y[j] - w[j] * g) > max(0.011, 0.001 * y[j]))
        if not bad:
            st['same'] += 1
            continue
        yp, wp = (Ym[ks[i - 1]], Bm[ks[i - 1]]) if i else (None, None)
        a = classify(y, w, g, yp, wp) or 'multi'
        st['attr']['pre' if k.year < 2001 else 'post'][a] += 1
        st['attrYears'][a][k.year - k.year % 5] += 1
        if a not in st['attrEx']:
            st['attrEx'][a] = [str(k), round(g, 4), [round(x, 4) for x in y[1:5]], w[1:5]]
        if a == 'oc-swap' and yp and yp[4] and wp[4]:   # מבחן פער הלילה: במקור הנכון הפתיחה קרובה לסגירה הקודמת
            st['swap'][0] += 1
            st['swap'][1] += abs(y[1] - yp[4]) / yp[4] < abs(w[1] - wp[4]) / wp[4]
        if k.year < 2001:
            st['pre2001'] += 1
            continue
        if a == 'o:y=prevclose':
            st['ypc'][str(k)] += 1
        c = ('scale:' if g != 1 else '') + bad
        st['cls'][c] += 1
        if len(st['ex'][c]) < 2:
            st['ex'][c].append([str(k), round(g, 4), [round(x, 4) for x in y[1:5]], w[1:5]])
    return st


def weekday_major(per):
    c = Counter(day(b[0]).weekday() for b in per[:-1])
    return c.most_common(1)[0][0] if c else None


def run(out, syms):
    R = {'syms': 0, 'daily': Counter(), 'cls': Counter(), 'clsSyms': defaultdict(Counter), 'ex': {},
         'self': {s: {tf: Counter() for tf in ('1W', '1M')} for s in ('yahoo', 'webull')},
         'selfYears': {s: {tf: Counter() for tf in ('1W', '1M')} for s in ('yahoo', 'webull')}, 'selfEx': [],
         'wd': [], 'c020': [], 'depth': Counter(), 'depthEx': [], 'missing': [],
         'attr': {'pre': Counter(), 'post': Counter()}, 'attrSyms': {'pre': defaultdict(Counter), 'post': defaultdict(Counter)},
         'attrYears': defaultdict(Counter), 'attrEx': {}, 'ypc': Counter(), 'swap': {}}
    for s in syms:
        Y = load(os.path.join(out, 'disp', s, '1D.0.json'))
        B = load(os.path.join(out, 'src', 'webull', s, '1d.json'))
        if not Y:
            R['missing'].append(s)
            continue
        R['syms'] += 1
        if B:
            d = daily_vs(Y, B)
            for f in ('n', 'n2001', 'same', 'pre2001'):
                R['daily'][f] += d[f]
            for p in ('pre', 'post'):
                for c, n in d['attr'][p].items():
                    R['attr'][p][c] += n; R['attrSyms'][p][c][s] += n
            for c, ys in d['attrYears'].items():
                R['attrYears'][c].update(ys)
            for c, e in d['attrEx'].items():
                R['attrEx'].setdefault(c, [s] + e)
            R['ypc'].update(d['ypc'])
            if d['swap'][0]:
                R['swap'][s] = d['swap']
            for c, n in d['cls'].items():
                R['cls'][c] += n; R['clsSyms'][c][s] += n
                R['ex'].setdefault(c, [])
                if len(R['ex'][c]) < 3:
                    R['ex'][c] += [[s] + e for e in d['ex'][c]][:3 - len(R['ex'][c])]
        wd = None
        for tf, iv, key in (('1W', '1wk', wkey), ('1M', '1mo', mkey)):
            Yp = load(os.path.join(out, 'disp', s, tf + '.0.json'))
            if tf == '1W' and Yp:
                wd = weekday_major(Yp)
                if wd not in (None, 0):
                    f = day(Y[0][0])
                    R['wd'].append([s, str(f), WDN[f.weekday()], WDN[wd], WDN[date(f.year, 1, 1).weekday()]])
            for src, D, P in (('yahoo', Y, Yp), ('webull', B, load(os.path.join(out, 'src', 'webull', s, iv + '.json')))):
                if not D or not P or (src == 'yahoo' and tf == '1W' and wd not in (None, 0)):
                    continue
                r = self_check(D, P, key)
                R['self'][src][tf]['n'] += r['n']; R['self'][src][tf]['bad'] += r['bad']
                for y, n in r['years'].items():
                    R['selfYears'][src][tf][y] += n
                if src == 'yahoo' and r['ex'] and len(R['selfEx']) < 6:
                    R['selfEx'].append([s, tf] + r['ex'][0])
        Ym = load(os.path.join(out, 'disp', s, '1M.0.json'))
        if Ym and mkey(day(Ym[0][0])) > mkey(day(Y[0][0])):
            R['c020'].append([s, str(day(Y[0][0])), str(day(Ym[0][0]))])
        if B:
            dd = (day(Y[0][0]) - day(B[0][0])).days
            k = 'yahoo' if dd < -5 else 'webull' if dd > 5 else 'same'
            R['depth'][k] += 1
            if k != 'same' and len(R['depthEx']) < 8:
                R['depthEx'].append([s, str(day(Y[0][0])), str(day(B[0][0]))])
    return R


def report(R):
    L = []
    d = R['daily']
    post = sum(R['cls'].values())
    L.append('סמלים %d (חסרים: %s)' % (R['syms'], ','.join(R['missing']) or '—'))
    L.append('יומי מול Webull: %d ימים (מ־2001: %d), תואמים %d (%.2f%%), שונים לפני 2001: %d, מ־2001: %d (%.2f%%)' % (
        d['n'], d['n2001'], d['same'], 100 * d['same'] / max(d['n'], 1), d['pre2001'], post, 100 * post / max(d['n2001'], 1)))
    for c, n in R['cls'].most_common(10):
        L.append('   %-12s %6d  %s' % (c, n, ' '.join('%s:%d' % x for x in R['clsSyms'][c].most_common(4))))
    for p, title in (('post', 'מ־2001'), ('pre', 'לפני 2001')):
        L.append('שיוך ההבדלים %s: %d' % (title, sum(R['attr'][p].values())))
        for c, n in R['attr'][p].most_common():
            S = R['attrSyms'][p][c]
            L.append('   %-15s %7d  סמלים %3d: %s' % (c, n, len(S), ' '.join('%s:%d' % x for x in S.most_common(5))))
    L.append('פתיחה = הסגירה הקודמת (Yahoo, מ־2001) — תאריכים חוזרים: %s' % ' '.join('%s:%d' % x for x in R['ypc'].most_common(6)))
    sw = sorted(R['swap'].items(), key=lambda x: -x[1][0])[:5]
    L.append('פתיחה↔סגירה הפוכות — מבחן פער הלילה (ימים/Yahoo קרוב יותר לסגירה הקודמת): %s' % ' '.join('%s:%d/%d' % (s, n, y) for s, (n, y) in sw))
    for src in ('yahoo', 'webull'):
        for tf in ('1W', '1M'):
            x = R['self'][src][tf]
            ys = R['selfYears'][src][tf]
            per = ' '.join('%s:%d' % (p, sum(n for y, n in ys.items() if lo <= y <= hi)) for p, lo, hi in
                           (('<2000', 0, 1999), ('2000-10', 2000, 2010), ('2011-20', 2011, 2020), ('2021+', 2021, 9999)))
            L.append('עקביות %s %s מול היומי שלו: %d/%d לא עקביים (%.1f%%) | %s' % (src, tf, x['bad'], x['n'], 100 * x['bad'] / max(x['n'], 1), per))
    L.append('שבועי שלא מתחיל ביום שני: %d %s' % (len(R['wd']), ' '.join('%s(%s→%s, 1/1=%s)' % (w[0], w[1], w[3], w[4]) for w in R['wd'])))
    L.append('C-020 חודשי מתחיל אחרי היומי: %d, החודש הראשון: %s' % (len(R['c020']), ','.join(sorted({x[2][:7] for x in R['c020']}))))
    L.append('עומק היומי מול Webull: %s %s' % (dict(R['depth']), R['depthEx'][:6]))
    return '\n'.join(L)


def selftest():
    T = lambda y, m, d, h=14: int(datetime(y, m, d, h, 30, tzinfo=timezone.utc).timestamp())
    days = [date(2005, 1, 3) + timedelta(days=i) for i in range(28) if (date(2005, 1, 3) + timedelta(days=i)).weekday() < 5]
    Y = [[T(x.year, x.month, x.day), 10 + i * 0.1, 10.5 + i * 0.1, 9.5 + i * 0.1, 10.2 + i * 0.1, 100] for i, x in enumerate(days)]
    B = [[T(x.year, x.month, x.day, 0)] + list(b[1:]) for x, b in zip(days, Y)]
    B[3] = B[3][:1] + [B[3][1] + 0.3] + B[3][2:]          # פתיחה בלבד שונה
    B[7] = [B[7][0]] + [v / 2 for v in B[7][1:5]] + [200]   # כל הנר בקנה מידה אחר — לא שונה (קנה המידה המקומי = 1)
    d = daily_vs(Y, B, live=False)
    assert d['n'] == 20 and d['cls']['o'] == 1 and d['same'] == 18, d
    assert d['attr']['post'] == Counter({'o:other': 1, 'multi': 1}) and daily_vs(Y, B)['n'] == 19, d['attr']
    t0 = T(2005, 1, 3)
    assert classify([t0, 10, 11, 9, 10.5], [t0, 10.5, 11, 9, 10], 1) == 'oc-swap'
    assert classify([t0, 10, 11, 9, 10.5], [t0, 10, 11, 10.5, 10.5], 1) == 'wb-low=close'
    assert classify([t0, 9.8, 11, 9, 10.5], [t0, 10.2, 11, 9, 10.5], 1, yp=[t0, 9, 10, 8, 9.8]) == 'o:y=prevclose'
    assert classify([t0, 10, 11, 9, 10.5], [t0, 10.5, 10.5, 10.5, 10.5], 1) == 'wb-flat'
    assert classify([t0, 10, 11, 9, 10.5], [t0, 20, 22, 18, 21], 0.5) is None
    W = [[T(2005, 1, 3 + 7 * k, 5), Y[5 * k][1], max(b[2] for b in Y[5 * k:5 * k + 5]), min(b[3] for b in Y[5 * k:5 * k + 5]), Y[5 * k + 4][4], 0] for k in range(4)]
    assert self_check(Y, W, wkey)['bad'] == 0
    W[1] = W[1][:4] + [W[1][4] + 1, 0]
    r = self_check(Y, W, wkey)
    assert r['bad'] == 1 and r['n'] == 2 and r['years'] == {2005: 1}, r
    Wt = [[T(2005, 1, 4 + 7 * k, 5)] + w[1:] for k, w in enumerate(W)]   # שבועות שמתחילים ביום שלישי
    assert weekday_major(Wt) == 1 and weekday_major(W) == 0
    print('selftest: תקין')


def main(argv):
    if '--selftest' in argv:
        return selftest()
    a = dict(zip(argv[::2], argv[1::2]))
    out = a.get('--out')
    if not out:
        print('חסר --out')
        sys.exit(2)
    if a.get('--file'):
        syms = [x.strip() for x in open(a['--file']).read().split() if x.strip()]
    elif a.get('--syms'):
        syms = a['--syms'].split(',')
    else:
        syms = sorted(os.listdir(os.path.join(out, 'disp')))
    R = run(out, syms)
    print(report(R))
    if a.get('--json'):
        json.dump(R, open(a['--json'], 'w', encoding='utf-8'), ensure_ascii=False, default=lambda x: dict(x) if isinstance(x, (Counter, defaultdict)) else str(x))


if __name__ == '__main__':
    main(sys.argv[1:])
