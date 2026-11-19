#!/usr/bin/env python3
"""שכבה 3: המימוש העצמאי (indep.py) מול analysis.js (model.js) — כל חברה, כל רבעון, כל רכיב.
שימוש: python3 tools/buffett-deep/compare.py <model.jsonl> <indep.jsonl> [--out diffs.json]
פער = הבדל מעל 1e-6 יחסי (שתי מימושים של אותה הגדרה על אותו קלט חייבים להיות זהים, לא "קרובים")."""
import json
import sys


def load(p):
    with open(p) as f:
        return {o['sym']: o for o in map(json.loads, filter(None, f.read().split('\n')))}


def same(a, b):
    if a is None or b is None:
        return a is None and b is None
    if isinstance(a, bool) or isinstance(b, bool):
        return bool(a) == bool(b)
    return abs(a - b) <= 1e-6 * max(1.0, abs(a), abs(b))


def main():
    m, i = load(sys.argv[1]), load(sys.argv[2])
    diffs, n_ok, n_val = [], 0, 0
    for sym in sorted(set(m) | set(i)):
        a, b = m.get(sym), i.get(sym)
        if a is None or b is None:
            diffs.append({'sym': sym, 'k': 'missing', 'model': bool(a), 'indep': bool(b)})
            continue
        ma, ib = a.get('buf'), b if 'st' in b else None
        if (ma is None) != (ib is None):
            diffs.append({'sym': sym, 'k': 'null', 'model': a.get('why'), 'indep': b.get('why')})
            continue
        if ma is None:
            # שניהם null — גם הסיבה צריכה להיות זהה (בלי פירוט התאריך)
            wa, wb = (a.get('why') or '').split(':')[0], (b.get('why') or '').split(':')[0]
            wb = {'fx': 'fxNote'}.get(wb, wb)
            if wa != wb and not (wa in ('fxNote', 'fxMix') and wb == 'fxNote'):
                diffs.append({'sym': sym, 'k': 'why', 'model': a.get('why'), 'indep': b.get('why')})
            else:
                n_ok += 1
            continue
        bad = []
        for k in ('st', 'g', 'ded', 'eps', 't', 'yGaap', 'pol'):
            n_val += 1
            if k == 'pol':
                if ma[k] != ib[k]:
                    bad.append((k, ma[k], ib[k]))
            elif not same(ma[k], ib[k]):
                bad.append((k, ma[k], ib[k]))
        for j, (ra, rb) in enumerate(zip(a.get('rows') or [], ib['rows'])):
            for ka, kb in (('e', 'e'), ('g', 'g'), ('sh', 'sh'), ('sbAt', 'sb'), ('pol', 'pol'), ('ded', 'ded')):
                n_val += 1
                va, vb = ra[ka], rb[kb]
                if (ka in ('e', 'pol') and va != vb) or (ka not in ('e', 'pol') and not same(va, vb)):
                    bad.append(('q%d.%s' % (j, ka), va, vb))
            n_val += 1
            if not same(ra['hq']['a'], rb['s']):
                bad.append(('q%d.s' % j, ra['hq']['a'], rb['s']))
        fa, fb = ma.get('f'), ib.get('f')
        if (fa is None) != (fb is None):
            bad.append(('f', fa, fb))
        elif fa:
            for k in ('base', 'rate', 'ded', 'eps', 'fut', 'chg'):
                n_val += 1
                if not same(fa.get(k), fb.get(k)):
                    bad.append(('f.' + k, fa.get(k), fb.get(k)))
        for k in ('pe', 'fpe', 'bpe', 'bfpe'):
            n_val += 1
            if not same(a['tiles'][k], b['tiles'][k]):
                bad.append(('tile.' + k, a['tiles'][k], b['tiles'][k]))
        if bad:
            diffs.append({'sym': sym, 'k': 'values', 'bad': bad})
        else:
            n_ok += 1
    print('חברות זהות:', n_ok, '· ערכים שהושוו:', n_val, '· חברות עם פער:', len(diffs))
    for x in diffs[:40]:
        print(json.dumps(x, ensure_ascii=False)[:400])
    if '--out' in sys.argv:
        with open(sys.argv[sys.argv.index('--out') + 1], 'w') as f:
            json.dump(diffs, f, ensure_ascii=False, indent=1)
    sys.exit(1 if diffs else 0)


if __name__ == '__main__':
    main()
