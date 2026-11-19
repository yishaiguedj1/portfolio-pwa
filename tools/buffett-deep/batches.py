#!/usr/bin/env python3
"""גל 2 — חלוקת ההודעות לעיתונות לקבוצות לקוראים (בדיקת העומק של מכפיל באפט, docs/buffett-pe-audit.md).

שימוש: python3 -I tools/buffett-deep/batches.py <BD> <wave> <start> <count> [max_chars=170000] [big=300000]
  <BD>     — תיקיית העבודה (pr/<cik>.json מ־prfetch.js, ‏prt/<cik>/<acc>.txt מ־prtext.py)
  <wave>   — שם הגל (w2, ‏w2b…); הפלט: <BD>/read/<wave>/batches/bNN.txt ו־batches.json
  <start> <count> — טווח החברות לפי סדר אלפביתי של הסימול (0 50 = 50 הראשונות; 50 50 = הבאות)

‏BD_TXT=prl — הטקסטים הדלילים של prslim.py (רק אחרי שהאימות שלו עבר): הגודל לפי prl/, והודעות שב־prl/skip.tsv לא נכנסות.
היקום: כל חברה ב־pr/ שיש לה לפחות טקסט אחד ב־prt/. שני סוגי מניות עם אותו CIK (GOOG/GOOGL) — פעם אחת, בסימול הראשון.
האריזה: לפי הסדר (סימול, ואז תאריך ההגשה), עד max_chars תווים לקבוצה. קובץ מעל big — קבוצה לבד (דוח שנתי שהוגש כהודעה),
והקורא מקבל הוראה מיוחדת לקריאה חלקית (ראו הפרומפט). מדפיס סיכום: חברות, הודעות, קבוצות, הגדולה ביותר.
"""
import glob
import json
import os
import sys


TXT = os.environ.get('BD_TXT', 'prt')


def universe(bd):
    seen, out = set(), []
    skip = set()
    sp = os.path.join(bd, TXT, 'skip.tsv')
    if TXT != 'prt' and os.path.exists(sp):
        skip = {l.split('\t')[1] for l in open(sp) if l.strip()}
    for f in glob.glob(os.path.join(bd, 'pr', '*.json')):
        m = json.load(open(f))
        cik = int(m['cik'])
        files = []
        for it in sorted(m.get('items', []), key=lambda x: (x.get('filed') or '', x['acc'])):
            rel = '%d/%s.txt' % (cik, it['acc'])
            p = os.path.join(bd, TXT, rel)
            if it['acc'] not in skip and os.path.exists(p):
                files.append((rel, os.path.getsize(p)))
        if files:
            out.append((m['sym'], cik, files))
    out.sort()
    uniq = []
    for sym, cik, files in out:
        if cik in seen:
            continue
        seen.add(cik)
        uniq.append((sym, cik, files))
    return uniq


def pack(comps, max_chars, big):
    batches, cur = [], {'files': [], 'chars': 0, 'syms': [], 'big': []}

    def flush():
        nonlocal cur
        if cur['files']:
            batches.append(cur)
        cur = {'files': [], 'chars': 0, 'syms': [], 'big': []}

    for sym, _, files in comps:
        for rel, n in files:
            if n > big:
                batches.append({'files': [rel], 'chars': n, 'syms': [sym], 'big': [rel]})
                continue
            if cur['files'] and cur['chars'] + n > max_chars:
                flush()
            cur['files'].append(rel)
            cur['chars'] += n
            if not cur['syms'] or cur['syms'][-1] != sym:
                cur['syms'].append(sym)
    flush()
    return batches


def main():
    bd, wave, start, count = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
    max_chars = int(sys.argv[5]) if len(sys.argv) > 5 else 170000
    big = int(sys.argv[6]) if len(sys.argv) > 6 else 300000
    comps = universe(bd)[start:start + count]
    out = os.path.join(bd, 'read', wave)
    os.makedirs(os.path.join(out, 'batches'), exist_ok=True)
    meta = []
    for i, b in enumerate(pack(comps, max_chars, big)):
        bid = 'b%02d' % i
        lp = os.path.join(out, 'batches', bid + '.txt')
        with open(lp, 'w') as fo:
            fo.write('\n'.join(b['files']) + '\n')
        meta.append({'id': bid, 'list': lp, 'n': len(b['files']), 'chars': b['chars'], 'syms': b['syms'], 'big': b['big']})
    with open(os.path.join(out, 'batches.json'), 'w') as fo:
        json.dump(meta, fo, ensure_ascii=False)
    nf = sum(x['n'] for x in meta)
    print('חברות: %d (%s…%s) · הודעות: %d · קבוצות: %d · גדולים: %d · הקבוצה הגדולה (בלי גדולים): %d תווים' % (
        len(comps), comps[0][0] if comps else '', comps[-1][0] if comps else '', nf, len(meta),
        sum(1 for x in meta if x['big']), max([x['chars'] for x in meta if not x['big']] or [0])))


if __name__ == '__main__':
    main()
