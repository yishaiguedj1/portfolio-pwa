#!/usr/bin/env python3
"""בדיקת העומק של גרף הנרות — סיכום לפי סמל מתוך קבצי ההשוואה (<out>/cmp/*.json של compare.py).
לכל סמל: סכום הפסיקות בכל המרווחים (V3/V2/MIX/DIFF/DIFF?/NOSRC), יישור (off/agg/gone/WD), נרות פגומים
(bad/dup/jump/UNIT), עומק (הנר הראשון ביומי/שבועי/חודשי), xcal (שבועי/חודשי מול היומי) והמרווחים עם הכי הרבה DIFF.
הרצה: python3 -I tools/chart-deep/summary.py --out <dir> [--syms A,B] [--md 1]"""
import json
import os
import sys
from datetime import datetime, timezone

V = ('V3', 'V2', 'MIX', 'DIFF', 'DIFF?', 'NOSRC')


def first_day(out, sym, tf):
    f = os.path.join(out, 'disp', sym, tf + '.0.json')
    if not os.path.exists(f):
        return None
    b = json.load(open(f, encoding='utf-8')).get('bars') or []
    if not b:
        return None
    t = b[0][0] / 1000 if b[0][0] > 1e11 else b[0][0]
    return datetime.fromtimestamp(t, timezone.utc).strftime('%Y-%m')


def sym_row(out, r):
    tot = dict.fromkeys(V + ('n', 'off', 'agg', 'gone', 'wday', 'bad', 'dup', 'jump', 'unit'), 0)
    worst = []
    for k, t in r['tfs'].items():
        tot['n'] += t.get('n', 0)
        v = (t.get('src') or {}).get('v') or {}
        for x in V:
            tot[x] += v.get(x, 0)
        for x in ('off', 'agg', 'gone', 'wday'):
            tot[x] += (t.get('align') or {}).get(x, 0)
        for x in ('bad', 'dup', 'jump', 'unit'):
            tot[x] += (t.get('inv') or {}).get(x, 0)
        if v.get('DIFF'):
            worst.append((v['DIFF'], k))
    worst.sort(reverse=True)
    xc = r.get('xcal') or {}
    tot['xcal'] = ' '.join('%s %d/%d' % (k, x.get('exp', 0), x.get('n', 0)) for k, x in xc.items() if x.get('exp', 0) != x.get('n', 0))
    tot['srcs'] = ','.join(sorted({s[0] for t in r['tfs'].values() for s in (t.get('src') or {}).get('srcs', [])})) or '—'
    tot['top'] = ' '.join('%s:%d' % (k, d) for d, k in worst[:3])
    tot['depth'] = '/'.join(first_day(out, r['sym'], tf) or '—' for tf in ('1D', '1W', '1M'))
    return tot


def main(argv):
    a = dict(zip(argv[::2], argv[1::2]))
    out = a.get('--out')
    if not out:
        print('חסר --out')
        sys.exit(2)
    want = set(a['--syms'].split(',')) if a.get('--syms') else None
    rows = []
    for f in sorted(os.listdir(os.path.join(out, 'cmp'))):
        r = json.load(open(os.path.join(out, 'cmp', f), encoding='utf-8'))
        if want and r['sym'] not in want:
            continue
        rows.append((r['sym'], r.get('cls', ''), sym_row(out, r)))
    md = a.get('--md') == '1'
    if md:
        print('| סמל | נרות | V3 | V2 | MIX | DIFF | DIFF? | NOSRC | מחוץ לרשת | WD | פגומים (dup/jump/UNIT) | xcal שונה | עומק (יומי/שבועי/חודשי) | מקורות |')
        print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for s, cls, t in rows:
        if md:
            print('| %s | %s | %s | %s | %s | %s | %s | %s | %s | %s | %d/%d/%d | %s | %s | %s |' % (
                s, format(t['n'], ','), format(t['V3'], ','), format(t['V2'], ','), format(t['MIX'], ','), format(t['DIFF'], ','),
                format(t['DIFF?'], ','), format(t['NOSRC'], ','), format(t['off'], ','), t['wday'] or '', t['dup'], t['jump'], t['unit'],
                t['xcal'] or '', t['depth'], t['srcs']))
        else:
            print('%-8s %-6s n=%-7d %s | off=%d agg=%d gone=%d WD=%d | bad=%d dup=%d jump=%d UNIT=%d | xcal %s | %s | %s | %s' % (
                s, cls, t['n'], ' '.join('%s=%d' % (x, t[x]) for x in V), t['off'], t['agg'], t['gone'], t['wday'],
                t['bad'], t['dup'], t['jump'], t['unit'], t['xcal'] or '=', t['depth'], t['srcs'], t['top']))


if __name__ == '__main__':
    main(sys.argv[1:])
