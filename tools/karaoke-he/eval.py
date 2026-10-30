"""מדידת תזמון קריוקי מול תיוג אמת (30/10/2026, docs/studio-karaoke-research.md — "סט הבדיקה והמדדים").
בלי תלויות מעבר ל־numpy. ההגדרות כמו ב־mir_eval.alignment (AAE, ‏PCO), אבל רק על התחלות המילים — זה מה שנראה על המסך.

תיוג אמת — CSV בסגנון JamendoLyrics: word_start,word_end,line_end,word (line_end=1 במילה האחרונה בשורה; word לא חובה).
תוצאה — JSON של השרשרת ({"words": [{"w","s","e"}]}) או CSV באותו פורמט.

  eval.py <ref.csv> <res.json> [res2.json ...]         טבלה לשיר אחד
  eval.py --set <DIR> <name> [name2 ...]               כל <DIR>/<שיר>/ref.csv מול <DIR>/<שיר>/<name>.json, ממוצע על השירים
  eval.py --draft <res.json> <lyrics.txt> <out.csv>    טיוטת תיוג מהפלט (השורות לפי המילים) — לתיקון ידני
  --shift S  מחסיר S שנ׳ מכל תוצאה (כיול היסט; העמודה shift* = ההיסט שהיה מאפס את החציון) · --json  פלט JSON

ההתאמה בין המילים: אותו מספר מילים → לפי הסדר; אחרת לפי הטקסט המנורמל (difflib). מילה בלי התאמה נספרת ב־miss.
האודיו, המילים והתיוג של השירים — רק ב־R2 הפרטי, לא בריפו."""
import csv
import difflib
import json
import os
import re
import sys

import numpy as np

NQ = re.compile('[֑-ׇ]')
PUN = re.compile(r"[^\w']+")


def norm(w):
    w = NQ.sub('', w or '').replace('׳', "'").replace('′', "'").replace('״', '').replace('"', '')
    return PUN.sub('', w).lower()


def load(path):
    """→ רשימת {w, s, e, le}. le = סוף שורה (רק בתיוג; בתוצאה None)."""
    if path.endswith('.json'):
        with open(path, encoding='utf-8') as f:
            return [{'w': x.get('w', ''), 's': float(x['s']), 'e': float(x.get('e', x['s'])), 'le': None}
                    for x in json.load(f)['words']]
    out = []
    with open(path, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            out.append({'w': r.get('word') or '', 's': float(r['word_start']), 'e': float(r['word_end']),
                        'le': str(r.get('line_end', '0')).strip() in ('1', 'True', 'true')})
    return out


def pairs(ref, res):
    """זוגות אינדקסים (ref, res)."""
    if len(ref) == len(res):
        return [(i, i) for i in range(len(ref))]
    a, b = [norm(x['w']) for x in ref], [norm(x['w']) for x in res]
    out = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op == 'equal' or (op == 'replace' and i2 - i1 == j2 - j1):
            out += list(zip(range(i1, i2), range(j1, j2)))
    return out


def line_starts(ref):
    return {i for i in range(len(ref)) if i == 0 or ref[i - 1]['le']}


def score(ref, res, shift=0.0):
    pr = pairs(ref, res)
    n = len(ref)
    if not pr:
        return {'n': n, 'miss': n}
    ri, si = (np.array(x) for x in zip(*pr))
    rs = np.array([ref[i]['s'] for i in ri])
    d = np.array([res[j]['s'] for j in si]) - shift - rs          # חיובי = מאוחר
    de = np.array([res[j]['e'] for j in si]) - shift - np.array([ref[i]['e'] for i in ri])
    a = np.abs(d)
    ls = line_starts(ref)
    dl = np.array([d[k] for k, i in enumerate(ri) if i in ls]) if ls else np.array([])
    late, early = dl[dl > 0], -dl[dl < 0]
    return {
        'n': n, 'miss': n - len(pr),
        'aae': float(a.mean()), 'med': float(np.median(a)), 'p90': float(np.percentile(a, 90)),
        'pco30': float((a <= 0.3).mean()), 'pco15': float((a <= 0.15).mean()),
        'gt1': float((a > 1.0).mean()),
        'bias': float(d.mean()), 'shift': float(np.median(d)),
        'end_med': float(np.median(np.abs(de))),
        'lines': int(len(dl)),
        'l_late30': int((late > 0.3).sum()), 'l_late_max': float(late.max()) if len(late) else 0.0,
        'l_early_med': float(np.median(early)) if len(early) else 0.0,
    }


COLS = [('miss', 'miss', '{:d}'), ('aae', 'AAE', '{:.3f}'), ('med', 'חציון', '{:.3f}'), ('p90', 'P90', '{:.2f}'),
        ('pco30', 'PCO.3', '{:.0%}'), ('pco15', 'PCO.15', '{:.0%}'), ('gt1', '>1שנ׳', '{:.1%}'),
        ('bias', 'הטיה', '{:+.3f}'), ('shift', 'shift*', '{:+.3f}'), ('end_med', 'סוף', '{:.3f}'),
        ('l_late30', 'שורות מאוחרות', '{:d}'), ('l_late_max', 'איחור מרבי', '{:.2f}'), ('l_early_med', 'הקדמה', '{:.2f}')]


def mean(rows):
    """ממוצע על השירים (כל שיר משקל שווה)."""
    rows = [r for r in rows if 'aae' in r]
    if not rows:
        return {}
    m = {k: float(np.mean([r[k] for r in rows])) for k, _, _ in COLS}
    for k in ('miss', 'l_late30'):
        m[k] = int(sum(r[k] for r in rows))
    m['l_late_max'] = max(r['l_late_max'] for r in rows)
    return m


def table(rows):
    w = max([len(n) for n, _ in rows] + [6])
    lines = [' '.join([' ' * w] + [h for _, h, _ in COLS])]
    for name, r in rows:
        cells = [f.format(int(r[k]) if f == '{:d}' else r[k]) if k in r else '-' for k, _, f in COLS]
        lines.append(' '.join([name.ljust(w)] + cells))
    return '\n'.join(lines)


def draft(res_path, lyrics_path, out_path):
    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, os.path.join(here, '..', '..', 'translator'))
    from vt import karaoke as K
    with open(lyrics_path, encoding='utf-8') as f:
        lines = K.parse_lyrics(f.read())
    res = load(res_path)
    flat = [(w, k == len(ln) - 1) for ln in lines for k, w in enumerate(ln)]
    if len(flat) != len(res):
        sys.exit(f'מספר המילים שונה: {len(flat)} במילים, {len(res)} בתוצאה')
    with open(out_path, 'w', encoding='utf-8', newline='') as f:
        wr = csv.writer(f)
        wr.writerow(['word_start', 'word_end', 'line_end', 'word'])
        for (w, le), x in zip(flat, res):
            wr.writerow([f"{x['s']:.3f}", f"{x['e']:.3f}", int(le), w])
    print(f'{len(res)} מילים, {len(lines)} שורות → {out_path}')


def main(argv):
    shift, js = 0.0, False
    if '--shift' in argv:
        k = argv.index('--shift')
        shift = float(argv[k + 1])
        del argv[k:k + 2]
    if '--json' in argv:
        argv.remove('--json')
        js = True
    if not argv:
        sys.exit(__doc__)
    if argv[0] == '--draft':
        return draft(*argv[1:4])
    if argv[0] == '--set':
        d, names = argv[1], argv[2:]
        songs = sorted(s for s in os.listdir(d) if os.path.isfile(os.path.join(d, s, 'ref.csv')))
        out = {}
        for name in names:
            per = {}
            for s in songs:
                p = os.path.join(d, s, name + '.json')
                if os.path.isfile(p):
                    per[s] = score(load(os.path.join(d, s, 'ref.csv')), load(p), shift)
            out[name] = {'songs': per, 'mean': mean(per.values())}
        if js:
            print(json.dumps(out, ensure_ascii=False, indent=1))
            return
        for name in names:
            print(f'== {name} ({len(out[name]["songs"])} שירים)')
            print(table(list(out[name]['songs'].items()) + [('ממוצע', out[name]['mean'])]))
        return
    ref = load(argv[0])
    rows = [(os.path.basename(p), score(ref, load(p), shift)) for p in argv[1:]]
    print(json.dumps(dict(rows), ensure_ascii=False, indent=1) if js else table(rows))


if __name__ == '__main__':
    main(sys.argv[1:])
