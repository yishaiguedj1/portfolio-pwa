#!/usr/bin/env python3
"""מאגר הלמידה מול התרגום האנושי — כל שלב בשרשרת התרגום, לכל פרק של סדרה (28/10/2026, ניתוח פרקים 16–20).

מה עושה (השיטה המלאה: docs/studio-learning.md, "פרקים 16–20 מול התרגום האנושי"):
  1. קורא corpus.json של tools/learn-pull.js --corpus 20 ומזהה פרקים לפי SxxEyy בשם הקובץ.
  2. ממפה פרק → IMDb דרך Wikidata (--qid של הסדרה), ומוריד מ־OPUS v2018 ‏(raw/he.zip) רק את קבצי הפרקים — בבקשות טווח,
     בלי להוריד את 2.8GB. מטמון: <out>/opus.
  3. מיישר לפי טקסט, בקטעים (ההיסט קופץ בכל הפסקת פרסומות), ובוחר את הגרסה שמכסה הכי טוב.
  4. chrF לכל כתובית מול האדם, לכל שלב: A, B, הבחירה, f (תיקון), r (ביקורת), z (תיקון אחרון) + ניתוח הקיצורים לקצב קריאה
     + בדיקת כתוביות העזר (subref_grade ו־WER של התמליל מול en.ref.txt) + פילוח לפי xd / xr / מצב.
  כותב <out>/report.md (מספרים + דוגמאות). **תוכן אמיתי — רק לתיקייה זמנית, לעולם לא לריפו.**

שימוש:
  SNB_LEARN_TOKEN=… node tools/learn-pull.js --out $S/lp --corpus 20
  python3 -I tools/learn-vs-human.py --corpus $S/lp/corpus.json --records $S/lp/records.json --qid Q147235 --out $S/vh
  (Q147235 = הסדרה של פרקים 1–20. סדרה אחרת — ה־QID שלה ב־Wikidata.)
"""
from __future__ import annotations

import argparse
import glob
import io
import json
import os
import re
import statistics as stt
import sys
import urllib.parse
import urllib.request
import zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'translator'))
import learnmetrics as LM  # noqa: E402
import pipeline as P  # noqa: E402

OPUS = 'https://object.pouta.csc.fi/OPUS-OpenSubtitles/v2018/raw/%s.zip'
UA = {'User-Agent': 'snb-research/1.0'}


# ------------------------------------------------------------------ הורדה
class HttpFile(io.RawIOBase):
    """קובץ zip מרוחק כקובץ שאפשר לקפוץ בו (HTTP Range) — zipfile קורא רק את תוכן העניינים ואת הקבצים שביקשנו"""
    def __init__(self, url):
        self.u, self.p = url, 0
        self.n = int(urllib.request.urlopen(urllib.request.Request(url, method='HEAD', headers=UA)).headers['content-length'])

    def seekable(self): return True
    def readable(self): return True
    def tell(self): return self.p

    def seek(self, o, w=0):
        self.p = o if w == 0 else self.p + o if w == 1 else self.n + o
        return self.p

    def readinto(self, b):
        if self.p >= self.n or not len(b):
            return 0
        e = min(self.n, self.p + len(b)) - 1
        d = urllib.request.urlopen(urllib.request.Request(self.u, headers=dict(UA, Range='bytes=%d-%d' % (self.p, e)))).read()
        b[:len(d)] = d
        self.p += len(d)
        return len(d)


def imdb_map(qid: str, season: int) -> dict[int, str]:
    """פרק → מזהה IMDb בלי tt ובלי אפסים מובילים (הנתיב ב־OPUS)"""
    q = ('SELECT ?imdb ?n WHERE { ?e wdt:P179 wd:%s; wdt:P345 ?imdb. ?e p:P4908 ?s. ?s pq:P1545 ?n. ?s ps:P4908 ?season. '
         '?season p:P179 ?ss. ?ss pq:P1545 "%d". }' % (qid, season))
    url = 'https://query.wikidata.org/sparql?' + urllib.parse.urlencode({'query': q, 'format': 'json'})
    rows = json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA)))['results']['bindings']
    return {int(r['n']['value']): str(int(r['imdb']['value'][2:])) for r in rows}


def fetch_opus(lang: str, ids: set[str], out: Path) -> None:
    need = {i for i in ids if not glob.glob(str(out / lang / i / '*.xml'))}
    if not need:
        return
    z = zipfile.ZipFile(io.BufferedReader(HttpFile(OPUS % lang), buffer_size=1 << 20))
    for n in z.namelist():
        p = n.split('/')
        if len(p) >= 4 and p[-2] in need and p[-1]:
            d = out / lang / p[-2]
            d.mkdir(parents=True, exist_ok=True)
            (d / p[-1].replace('.gz', '')).write_bytes(z.read(n))


# ------------------------------------------------------------------ יישור
def ts(v):
    h, m, r = v.split(':')
    s, ms = r.split(',')
    return int(h) * 3600 + int(m) * 60 + int(s) + int(ms) / 1000


def parse_opus(fn):
    x = open(fn, encoding='utf-8', errors='replace').read()
    meta = x.split('<meta>')[1] if '<meta>' in x else ''
    out, cur = [], None
    for m in re.finditer(r'<s id="\d+">(.*?)</s>', x.split('<meta>')[0], re.S):
        b = m.group(1)
        st, en = re.findall(r'<time id="T\d+S" value="([^"]+)"', b), re.findall(r'<time id="T\d+E" value="([^"]+)"', b)
        t = ' '.join(re.sub(r'<[^>]+>', ' ', b).split())
        if st:
            cur = ts(st[0])
        out.append([cur, ts(en[-1]) if en else None, t])
    for i in range(len(out) - 1, -1, -1):
        if out[i][1] is None:
            out[i][1] = out[i + 1][1] if i + 1 < len(out) and out[i + 1][1] else (out[i][0] or 0) + 2
        if out[i][0] is None:
            out[i][0] = out[i][1] - 2
    return out, ('machine_translated>1' in meta)


TOK = re.compile(r'[֐-׿A-Za-z0-9]+')


def toks(s):
    w = [re.sub(r'[֑-ׇ]', '', t) for t in TOK.findall(s or '')]
    return set(t[1:] if len(t) > 3 and t[0] in 'והבלמשכ' else t for t in w)   # אותיות שימוש — השוואה גסה


def jac(a, b):
    return len(a & b) / max(1, len(a | b))


def anchors(ours, ref):
    pts = []
    for (s, _e, t) in ours:
        A = toks(t)
        if len(A) < 3:
            continue
        bj, bo = 0, None
        for (rs, _re, rt) in ref:
            if abs(s - rs) <= 200:
                j = jac(A, toks(rt))
                if j > bj:
                    bj, bo = j, s - rs
        if bj >= 0.5:
            pts.append((s, bo))
    pts.sort()
    return [(s, o) for i, (s, o) in enumerate(pts) if abs(o - stt.median([x[1] for x in pts[max(0, i - 3):i + 4]])) < 2]


def offat(A, t):
    return stt.median([p[1] for p in sorted(A, key=lambda p: abs(p[0] - t))[:5]])


def mapref(ref, A):
    return [(rs + offat(A, rs + offat(A, rs)), re_ + offat(A, rs + offat(A, rs)), rt) for rs, re_, rt in ref]


def coverage(ours, R):
    ok = n = 0
    for (s, e, t) in ours:
        A = toks(t)
        if not A:
            continue
        n += 1
        B = set().union(*[toks(rt) for (rs, re_, rt) in R if rs < e + 1 and re_ > s - 1] or [set()])
        ok += len(A & B) / len(A) >= 0.5
    return ok / max(1, n)


def reftext(R, s, e):
    return ' '.join(t for (rs, re_, t) in R if min(e, re_) - max(s, rs) > max(0, 0.3 * min(e - s, re_ - rs)))


# ------------------------------------------------------------------ ניתוח
def cf(h, r):
    return LM.chrf_from_stats(LM.chrf_stats(h or '', r or ''))


def vis(t):
    return len(re.sub(r'\s+', ' ', (t or '').replace('||', ' ').replace('|', ' ')).strip())


def stage_texts(c):
    ch = c['b'] if c.get('p') else c['d']
    f = c.get('f', ch)
    r = c.get('r', f)
    return {'A': c['d'], 'B': c.get('b', c['d']), 'pick': ch, 'f': f, 'r': r, 'z': c.get('z', r)}


STEPS = (('pick', 'A', 'pick'), ('fix', 'pick', 'f'), ('review', 'f', 'r'), ('zfinal', 'r', 'z'))


def episode(o, d, imdb):
    ours = [(c['s'], c['e'], c['h']) for c in o['fin']]
    cand = []
    for f in glob.glob(str(d / imdb / '*.xml')):
        ref, mt = parse_opus(f)
        if mt:
            continue
        A = anchors(ours, ref)
        if len(A) >= 20:
            R = mapref(ref, A)
            cand.append((coverage(ours, R), len(A), os.path.basename(f), R))
    if not cand:
        return None
    cv, na, fb, R = max(cand, key=lambda x: x[0])
    rows = [dict(c, ref=reftext(R, c['s'], c['e'])) for c in o['cu']]
    return {'cov': cv, 'anchors': na, 'ver': fb, 'rows': [r for r in rows if r['ref']]}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', required=True)
    ap.add_argument('--records', default='')
    ap.add_argument('--qid', required=True, help='Wikidata QID של הסדרה')
    ap.add_argument('--season', type=int, default=0, help='ברירת מחדל — לפי שמות הקבצים')
    ap.add_argument('--out', required=True)
    a = ap.parse_args()
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    C = json.load(open(a.corpus, encoding='utf-8'))
    C = C if isinstance(C, list) else list(C.values())
    recs = {r['id']: r for r in (json.load(open(a.records, encoding='utf-8')) if a.records else [])}
    eps = {}
    for o in C:
        m = re.search(r'S(\d+)\s*E(\d+)', o.get('fn') or '', re.I)
        if m and (not a.season or int(m.group(1)) == a.season):
            eps[(int(m.group(1)), int(m.group(2)))] = o
    if not eps:
        sys.exit('אין בקורפוס פרקים בשם SxxEyy (במצב האיסוף המלא בלבד יש fn)')
    maps = {s: imdb_map(a.qid, s) for s in {k[0] for k in eps}}
    ids = {maps[s].get(e) for (s, e) in eps if maps[s].get(e)}
    fetch_opus('he', ids, out / 'opus')
    L = ['# מול התרגום האנושי — דוח', '', '| פרק | מצב | xd | xr | גרסה | כיסוי | עוגנים | chrF A | B | בחירה | f | r | z | $ | שופט |',
         '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    tot = {k: Counter() for k, _, _ in STEPS}
    grp = {}
    cps_rows, ex = [], {k: [] for k, _, _ in STEPS}
    sub = []
    for (s, e), o in sorted(eps.items()):
        im = maps[s].get(e)
        r = episode(o, out / 'opus' / 'he', im) if im else None
        rec = recs.get(o['id'], {})
        if not r:
            L.append(f'| S{s:02d}E{e:02d} | {o["mode"]} | — | — | אין ייחוס אנושי | | | | | | | | | | |')
            continue
        rows = r['rows']
        T = [stage_texts(c) for c in rows]
        ref = [c['ref'] for c in rows]
        corp = {k: LM.chrf_corpus([t[k] for t in T], ref) for k in ('A', 'B', 'pick', 'f', 'r', 'z')}
        L.append(f'| S{s:02d}E{e:02d} | {o["mode"]} | {rec.get("xd", "")} | {rec.get("xr", "")} | {r["ver"]} | {r["cov"]:.2f} | '
                 f'{r["anchors"]} | ' + ' | '.join(f'{corp[k]:.2f}' for k in ('A', 'B', 'pick', 'f', 'r', 'z'))
                 + f' | {rec.get("usd", 0) or 0:.3f} | {(rec.get("jd") or {}).get("s", "")} |')
        key = f'{o["mode"]} · xd{rec.get("xd", "?")} · xr{rec.get("xr", "?")}'
        g = grp.setdefault(key, Counter())
        for c, t in zip(rows, T):
            for k, x, y in STEPS:
                if t[x] == t[y]:
                    continue
                d = cf(t[y], c['ref']) - cf(t[x], c['ref'])
                v = 'better' if d > 2 else 'worse' if d < -2 else 'same'
                tot[k][v] += 1
                g[k + ':' + v] += 1
                if v == 'worse' and len(ex[k]) < 12:
                    ex[k].append((f'S{s:02d}E{e:02d} #{c["i"]}', c['en'], t[x], t[y], c['ref'][:140]))
        # קיצורי קצב: הנוסח שלפני התיקון על התזמון הסופי
        for c in o['cu']:
            if 'f' in c and 'cps' in ((c.get('cc') or {}).get('f0') or []):
                fs = [f for f in o['fin'] if min(f['e'], c['e']) - max(f['s'], c['s']) > 0.5 * (c['e'] - c['s'])]
                if len(fs) == 1:
                    dur = max(0.1, fs[0]['e'] - fs[0]['s'])
                    cps_rows.append((vis(stage_texts(c)['pick']) / dur, vis(c['f']) / dur))
        # כתוביות העזר
        tx = o.get('tx') or {}
        if tx.get('en.ref.txt'):
            edit = tx.get('en.edit.txt', '')
            tsx = [int(h) * 3600 + int(m_) * 60 + int(x) for h, m_, x in P._EDIT_TS.findall(edit)]
            g2 = P.subref_grade(P.ref_lines(tx['en.ref.txt'], end=max(tsx) if tsx else None), edit)
            sub.append(f'S{s:02d}E{e:02d}: {g2["g"]} (דיוק {g2.get("p")}, כיסוי {g2.get("c")}) · תיקוני הגהה: {len(o.get("pt") or [])}')
    L += ['', '## מה כל שלב עשה (chrF לכתובית מול האדם, הפרש מעל ±2)', '',
          '| שלב | קירב | הרחיק | בלי הבדל |', '|---|---|---|---|']
    L += [f'| {k} | {tot[k]["better"]} | {tot[k]["worse"]} | {tot[k]["same"]} |' for k, _, _ in STEPS]
    L += ['', '### לפי קבוצה (מצב · xd · xr)', '']
    for key, g in sorted(grp.items()):
        L.append(f'- {key}: ' + ' · '.join(f'{k} +{g[k + ":better"]}/−{g[k + ":worse"]}' for k, _, _ in STEPS))
    if cps_rows:
        a0 = [x for x, _ in cps_rows]
        L += ['', f'## קיצורי קצב קריאה ({len(cps_rows)})', '',
              f'- הנוסח שלפני הקיצור על התזמון הסופי: עד 17 — {sum(x <= 17 for x in a0)}, 17–20 — {sum(17 < x <= 20 for x in a0)}, '
              f'מעל 20 — {sum(x > 20 for x in a0)} · אחרי הקיצור — חציון {stt.median(y for _, y in cps_rows):.1f}']
    L += ['', '## כתוביות העזר', ''] + ([f'- {x}' for x in sub] or ['- אין פרקים עם en.ref.txt'])
    L += ['', '## דוגמאות שהרחיקו מהאדם', '']
    for k, _, _ in STEPS:
        for (w, en, x, y, rf) in ex[k][:6]:
            L.append(f'- **{k}** {w} — EN: {en}\n  - לפני: {x}\n  - אחרי: {y}\n  - אדם: {rf}')
    (out / 'report.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
    print('\n'.join(L[:3 + len(eps) + 12]))
    print('\nהדוח המלא: ' + str(out / 'report.md'))


if __name__ == '__main__':
    main()
