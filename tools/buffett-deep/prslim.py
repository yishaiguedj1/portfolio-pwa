#!/usr/bin/env python3
"""גל 2 — חיסכון בטוקנים בקוראים (סעיף 1א ב־docs/buffett-pe-audit.md): סינון דטרמיניסטי והסרת טקסט קבוע.

לא נוגע ב־prt/. כותב עותק דליל ב־<BD>/prl/<CIK>/<acc>.txt ורשימת דילוג ב־<BD>/prl/skip.tsv.
1. סינון: הודעה שאין בה בכלל "per share" / "EPS" / "per diluted" (בלי תלות ברישיות) לא יכולה להיות הודעת תוצאות לפי
   הרובריקה → לא נשלחת לקוראים (נרשמת ב־skip.tsv ונפסקת er=false בלי קורא, `skip=noeps`).
2. הסרה: גושי טקסט קבוע — אזהרת "forward-looking statements"/"safe harbor"/"cautionary", ‏"About <חברה>", אנשי קשר.
   גוש מתחיל בשורת כותרת כזאת ונגמר (שמרני) בגבול נספח ("=== "), בשורת טבלה (" | "), או בשורה שיש בה מילה
   שנוגעת לשאלה (non-GAAP, adjusted, per share, stock-based, share-based, reconciliation, EPS, consolidated…) — שורה כזאת נשמרת.
3. ‏--check <reads.jsonl[.gz]> — האימות שחייב לעבור לפני שימוש: (א) אף הודעה שקורא סימן er=true לא בדילוג;
   (ב) אף quote של קורא לא מגיע רק מטקסט שהוסר (מנורמל: רווחים, גרשיים; גם קידומת של 80 תווים — quote נחתך ב־300).
   נכשל → קוד יציאה 1, ולא משתמשים.
שימוש: BD_DIR=<dir> python3 -I tools/buffett-deep/prslim.py [--check <reads>] [--write]
"""
import glob
import gzip
import json
import os
import re
import sys

BD = os.environ.get('BD_DIR', '.')
EPS = re.compile(r'per\s+share|\bEPS\b|per\s+diluted', re.I)
HEAD = re.compile(r'^\s*(?:\W{0,3})(?:about\s+[A-Z0-9][^|]{0,80}$|(?:cautionary\s+(?:note|statement|language)[^|]{0,80}$)|'
                  r'(?:(?:special\s+note\s+regarding\s+|note\s+regarding\s+|note\s+on\s+)?forward[\s-]+looking\s+(?:statements?|information)[^|]{0,60}$)|'
                  r'(?:safe\s+harbor[^|]{0,80}$)|(?:(?:investor|media|press)\s*(?:relations|inquiries|contacts?)\s*:?\s*$)|(?:contacts?\s*:?\s*$))', re.I)
KEEP = re.compile(r'non[\s-]*gaap|adjust|per\s+share|\bEPS\b|stock[\s-]*based|share[\s-]*based|equity[\s-]*based|'
                  r'reconcil|consolidated|three\s+months|quarter\s+ended|six\s+months|nine\s+months|year\s+ended|'
                  r'diluted|net\s+income|earnings|operating\s+income|EBITDA|outlook|guidance', re.I)


def slim(text):
    """→ (kept_text, removed_text)."""
    keep, rem, on = [], [], False
    for ln in text.split('\n'):
        if on and (ln.startswith('=== ') or ' | ' in ln or KEEP.search(ln)):
            on = False
        if not on and HEAD.match(ln) and not KEEP.search(ln) and ' | ' not in ln:
            on = True
        (rem if on else keep).append(ln)
    return '\n'.join(keep), '\n'.join(rem)


def norm(s):
    s = s.replace('’', "'").replace('‘', "'").replace('“', '"').replace('”', '"').replace(' ', ' ')
    return re.sub(r'\s+', ' ', s).strip().lower()


def files():
    for p in sorted(glob.glob(os.path.join(BD, 'prt', '*', '*.txt'))):
        cik = os.path.basename(os.path.dirname(p))
        yield cik, os.path.basename(p)[:-4], p


def main():
    a = sys.argv[1:]
    chk = a[a.index('--check') + 1] if '--check' in a else None
    write = '--write' in a
    skip, tot, kept, nfile = {}, 0, 0, 0
    slimmed = {}
    for cik, acc, p in files():
        t = open(p, encoding='utf-8', errors='replace').read()
        nfile += 1
        tot += len(t)
        if not EPS.search(t):
            skip[acc] = cik
            continue
        k, r = slim(t)
        kept += len(k)
        slimmed[acc] = (cik, k, r)
        if write:
            d = os.path.join(BD, 'prl', cik)
            os.makedirs(d, exist_ok=True)
            open(os.path.join(d, acc + '.txt'), 'w', encoding='utf-8').write(k)
    if write:
        os.makedirs(os.path.join(BD, 'prl'), exist_ok=True)
        with open(os.path.join(BD, 'prl', 'skip.tsv'), 'w') as fo:
            for acc, cik in sorted(skip.items()):
                fo.write('%s\t%s\tnoeps\n' % (cik, acc))
    print('הודעות: %d · בדילוג (בלי per share/EPS): %d · תווים: %d → %d (%.1f%%)' % (
        nfile, len(skip), tot, kept, 100.0 * kept / max(tot, 1)))
    if not chk:
        return 0
    op = gzip.open if chk.endswith('.gz') else open
    bad_skip, bad_q, nq, ner = [], [], 0, 0
    for l in op(chk, 'rt', encoding='utf-8'):
        d = json.loads(l)
        acc = d['acc']
        if d.get('er'):
            ner += 1
            if acc in skip:
                bad_skip.append('%s %s %s' % (d.get('who'), d['cik'], acc))
        q = d.get('quote')
        if not q or acc not in slimmed:
            continue
        nq += 1
        _, k, r = slimmed[acc]
        nk, nr, nqq = norm(k), norm(r), norm(q).rstrip('.… ')
        probes = [nqq] + ([nqq[:80]] if len(nqq) > 80 else [])
        if any(x and x not in nk and x in nr for x in probes):
            bad_q.append('%s %s %s: %s' % (d.get('who'), d['cik'], acc, q[:120]))
    print('אימות: er=true %d — בדילוג %d · quotes %d — רק מטקסט שהוסר %d' % (ner, len(bad_skip), nq, len(bad_q)))
    for x in bad_skip[:30] + bad_q[:30]:
        print('  ✗', x)
    return 1 if bad_skip or bad_q else 0


if __name__ == '__main__':
    sys.exit(main())
