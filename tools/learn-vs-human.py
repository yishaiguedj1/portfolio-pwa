#!/usr/bin/env python3
"""מאגר הלמידה מול התרגום האנושי — כל שלב בשרשרת התרגום, לכל פרק של סדרה. v2 (02/11/2026, תוכנית איכות התרגום PR1 1.1).

מה עושה (השיטה: docs/studio-learning.md, "כלי המדידה"):
  1. קורא corpus.json של tools/learn-pull.js (--all) ומזהה פרקים לפי SxxEyy בשם הקובץ.
  2. ממפה פרק → IMDb: --imdb-map (קובץ, בלי רשת) או דרך Wikidata (--qid). מוריד מ־OPUS v2018 ‏(raw/he.zip) רק את קבצי
     הפרקים — בבקשות טווח. מטמון: --opus-dir (או <out>/opus) — ריצה חוזרת בלי רשת.
  3. מיישר לפי טקסט, בקטעים (ההיסט קופץ בכל הפסקת פרסומות), ובוחר גרסה של התרגום האנושי:
     • מועמדים עם 20 עוגנים ומעלה ויחס אורך 0.6–1.7 (גרסה ממוזגת/שבורה נופלת כאן — באג v1: הבחירה לפי כיסוי);
     • --rule edit (ברירת המחדל): קודם גרסה **מאותה עריכה** — סחיפת ההיסט לאורך הפרק עד EDIT_DRIFT שנ׳ והפרש בסוף עד
       EDIT_END שנ׳; מתוכן ה־chrF הגבוה. --rule d7 — בלי כלל העריכה (נקודת הבסיס של המחקר);
     • --refmap — הבחירה קפואה מריצה קודמת (נכתבת ל־<out>/refmap.json).
  4. chrF v2: בלוקים (רכיבים קשירים בגרף כתובית↔משפט — כל משפט וכל כתובית פעם אחת; v1 ספר משפט ב־2–3 כתוביות),
     ונרמול כמו בציון של סט הזהב (tedeval.norm_he) + הסרת '|'/'||'. שינוי של שבירת שורה בלבד — לא "שינוי".
  5. השלבים: pick, fix, review, viewer (fixes_rview), zfinal, qc — מקובצי tx כשיש (האיסוף המלא); בלי tx — viewer בתוך
     review, ו־zfinal כולל את qc.
  כותב <out>/report.md (עם דוגמאות טקסט — **תוכן אמיתי, רק מחוץ לריפו**; --out בתוך הריפו נדחה), <out>/scores.json
  (מספרים בלבד) ו־<out>/refmap.json.

שימוש:
  SNB_LEARN_TOKEN=… node tools/learn-pull.js --out $S/lp --all
  python3 -I tools/learn-vs-human.py --corpus $S/lp/corpus.json --records $S/lp/records.json --imdb-map $Q/imdb.json --out $S/vh
  (מזהי הסדרה — QID / מפת IMDb — רק בקובץ ההגדרות של quality-bench, מחוץ לריפו.)
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
import tedeval as TE  # noqa: E402

OPUS = 'https://object.pouta.csc.fi/OPUS-OpenSubtitles/v2018/raw/%s.zip'
UA = {'User-Agent': 'snb-research/1.0'}
MIN_ANCHORS, LR_LO, LR_HI = 20, 0.6, 1.7
EDIT_DRIFT, EDIT_END = 5.0, 15.0   # גרסה מאותה עריכה: סחיפה של עד 5 שנ׳ לאורך הפרק, והפרש קטן בסוף


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


def _interp(out):
    """זמנים חסרים: בין שני משפטים עם זמן — לפי מיקום התווים המצטבר; בקצוות — ‎±2 שנ׳"""
    n = len(out)
    pos, acc = [], 0
    for r in out:
        pos.append(acc)
        acc += len(r[2]) + 1
    known = [i for i in range(n) if out[i][0] is not None]
    for i in range(n):
        if out[i][0] is not None:
            continue
        lo = max((k for k in known if k < i), default=None)
        hi = min((k for k in known if k > i), default=None)
        if lo is not None and hi is not None and pos[hi] > pos[lo]:
            out[i][0] = out[lo][0] + (out[hi][0] - out[lo][0]) * (pos[i] - pos[lo]) / (pos[hi] - pos[lo])
        elif lo is not None:
            out[i][0] = (out[lo][1] if out[lo][1] is not None else out[lo][0]) + 0.01 * (i - lo)
        elif hi is not None:
            out[i][0] = max(0.0, out[hi][0] - 2 * (hi - i))
        else:
            out[i][0] = 2.0 * i
    for i in range(n):
        if out[i][1] is None or out[i][1] < out[i][0]:
            nx = out[i + 1][0] if i + 1 < n else None
            out[i][1] = min(out[i][0] + 2, nx) if nx is not None and nx > out[i][0] else out[i][0] + 2
    return out


def parse_text(x):
    """XML של OPUS → ([[התחלה, סוף, טקסט]], מתורגם במכונה, dens = חלק המשפטים עם זמן התחלה מפורש)"""
    meta = x.split('<meta>')[1] if '<meta>' in x else ''
    out = []
    for m in re.finditer(r'<s id="\d+">(.*?)</s>', x.split('<meta>')[0], re.S):
        b = m.group(1)
        st, en = re.findall(r'<time id="T\d+S" value="([^"]+)"', b), re.findall(r'<time id="T\d+E" value="([^"]+)"', b)
        t = ' '.join(re.sub(r'<[^>]+>', ' ', b).split())
        out.append([ts(st[0]) if st else None, ts(en[-1]) if en else None, t])
    dens = sum(1 for s, _e, _t in out if s is not None) / max(1, len(out))
    return _interp(out), ('machine_translated>1' in meta), dens


def parse_opus(fn):
    return parse_text(open(fn, encoding='utf-8', errors='replace').read())


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


def norm(t):
    """אותו נרמול כמו הציון של סט הזהב (tedeval.norm_he ↔ studionet.js normHe), ובלי סימני השורה/הדובר"""
    return TE.norm_he((t or '').replace('||', ' ').replace('|', ' ').replace('\n', ' '))


def cf(h, r):
    return LM.chrf_from_stats(LM.chrf_stats(norm(h), norm(r)))


def vis_len(t):   # v1: vis — אורך לקצב הקריאה בלבד
    return len(norm(t))


def _ov(s, e, rs, re_):
    return min(e, re_) - max(s, rs) > max(0, 0.3 * min(e - s, re_ - rs))


def blocks(cues, R):
    """רכיבים קשירים בגרף כתובית↔משפט (חפיפה מעל 30% מהקצר) — כל משפט וכל כתובית פעם אחת.
    cues = [(s, e)], R = [(s, e, טקסט)] → [(אינדקסי כתוביות, אינדקסי משפטים)]; כתובית בלי משפט — בלי בלוק"""
    par = list(range(len(cues) + len(R)))

    def f(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x
    order = sorted(range(len(R)), key=lambda j: R[j][0])
    for i, (s, e) in enumerate(cues):
        for j in order:
            if R[j][0] > e + 1:
                break
            if _ov(s, e, R[j][0], R[j][1]):
                par[f(i)] = f(len(cues) + j)
    grp = {}
    for i in range(len(cues)):
        grp.setdefault(f(i), ([], []))[0].append(i)
    for j in range(len(R)):
        g = grp.get(f(len(cues) + j))
        if g is not None:
            g[1].append(j)
    return [(sorted(c), sorted(r)) for c, r in grp.values() if r]


def block_texts(BL, texts, R):
    """לכל בלוק: (צירוף הכתוביות, צירוף המשפטים) — texts = טקסט לכל כתובית"""
    return [(' '.join(texts[i] or '' for i in c), ' '.join(R[j][2] for j in r)) for c, r in BL]


def block_chrf(BL, texts, R):
    """chrF קורפוס על הבלוקים"""
    bt = block_texts(BL, texts, R)
    return LM.chrf_corpus([norm(h) for h, _ in bt], [norm(r) for _, r in bt]) if bt else 0.0


def len_ratio(ours, R):
    a = sum(len(norm(t)) for _s, _e, t in ours)
    lo, hi = (ours[0][0], ours[-1][1]) if ours else (0, 0)
    b = sum(len(norm(t)) for s, e, t in R if e > lo - 1 and s < hi + 1)
    return b / max(1, a)


def edit_fit(A, ours, ref):
    """(סחיפה, הפרש בסוף): כמה ההיסט זז לאורך הפרק, וכמה שונה הסוף — גרסה מאותה עריכה של הווידאו"""
    if not A or not ours or not ref:
        return 99.0, 99.0
    o = [x[1] for x in A]
    return max(o) - min(o), abs(ref[-1][1] - ours[-1][1])


FIX_ORDER = ('fixes-ab.txt', 'fixes.txt', 'fixes_review.txt', 'fixes_rview.txt', 'fixes_zfinal.txt', 'fixes_zqc.txt')   # = sorted(glob) ב־vt/translate.py
STEPS = (('pick', 'A', 'pick'), ('fix', 'pick', 'f'), ('review', 'f', 'r'), ('viewer', 'r', 'v'), ('zfinal', 'v', 'z0'), ('qc', 'z0', 'z'))
_FX_LINE = re.compile(r'^#(\d+)\s+(.*)$')


def fix_files(tx):
    """tx (האיסוף המלא) → {שם קובץ: {מספר: נוסח}} לקובצי התיקון המוכרים"""
    out = {}
    for k, v in (tx or {}).items():
        b = k.rsplit('/', 1)[-1]
        if b in FIX_ORDER and isinstance(v, str):
            d = {}
            for ln in v.splitlines():
                m = _FX_LINE.match(ln.strip())
                if m:
                    d[m.group(1)] = m.group(2).strip()
            out[b] = d
    return out


def stage_texts(c, fx=None):
    """הנוסח של כתובית אחרי כל שלב. fx = fix_files(tx); בלי — v=r (הצופה בתוך הביקורת), z0=z (zfinal כולל qc)"""
    ch = c['b'] if c.get('p') else c['d']
    f = c.get('f', ch)
    k = str(c.get('i'))
    if fx:
        r = fx.get('fixes_review.txt', {}).get(k, f)
        v = fx.get('fixes_rview.txt', {}).get(k, r)
        z0 = fx.get('fixes_zfinal.txt', {}).get(k, v)
        z = fx.get('fixes_zqc.txt', {}).get(k, z0)
    else:
        r = c.get('r', f)
        v = r
        z = c.get('z', r)
        z0 = z
    return {'A': c['d'], 'B': c.get('b', c['d']), 'pick': ch, 'f': f, 'r': r, 'v': v, 'z0': z0, 'z': z}


def block_delta(BL_i, texts_x, i, y, R):
    """הפרש ה־chrF של הבלוק של כתובית i כשרק היא מוחלפת לנוסח y (שאר הבלוק בשלב x)"""
    c, r = BL_i
    ref = ' '.join(R[j][2] for j in r)
    hx = ' '.join(texts_x[k] or '' for k in c)
    hy = ' '.join((y if k == i else texts_x[k]) or '' for k in c)
    return cf(hy, ref) - cf(hx, ref)


def pick_version(cand, rule='edit', fixed=None):
    """cand = [dict(file, anchors, lr, chrf, drift, end, ...)] → המועמד הנבחר (או None)"""
    if not cand:
        return None
    if fixed:
        return next((x for x in cand if x['file'] == fixed), None)
    ok = [x for x in cand if x['anchors'] >= MIN_ANCHORS and LR_LO <= x['lr'] <= LR_HI] or cand
    if rule == 'edit':
        same = [x for x in ok if x['drift'] <= EDIT_DRIFT and x['end'] <= EDIT_END]
        ok = same or ok
    return max(ok, key=lambda x: (round(x['chrf'], 6), x['anchors'], x['file']))   # שובר שוויון דטרמיניסטי


def episode(o, d, imdb, rule='edit', fixed=None):
    rows0 = [c for c in o['cu'] if isinstance(c.get('s'), (int, float)) and isinstance(c.get('e'), (int, float))]
    ours = [(c['s'], c['e'], c['h']) for c in o.get('fin') or []] or [(c['s'], c['e'], stage_texts(c)['z']) for c in rows0]
    fz = [stage_texts(c)['z'] for c in rows0]
    cue_t = [(c['s'], c['e']) for c in rows0]
    cand = []
    for f in sorted(glob.glob(str(d / imdb / '*.xml'))):
        ref, mt, dens = parse_opus(f)
        if mt:
            continue
        A = anchors(ours, ref)
        if len(A) < MIN_ANCHORS and not fixed:
            continue
        R = mapref(ref, A) if A else ref
        dr, en = edit_fit(A, ours, ref)
        cand.append({'file': os.path.basename(f), 'anchors': len(A), 'lr': len_ratio(ours, R), 'cov': coverage(ours, R),
                     'chrf': block_chrf(blocks(cue_t, R), fz, R), 'drift': dr, 'end': en, 'dens': dens, 'R': R})
    c = pick_version(cand, rule, fixed)
    if not c:
        return None
    BL = blocks(cue_t, c['R'])
    return {'cov': c['cov'], 'anchors': c['anchors'], 'ver': c['file'], 'lr': c['lr'], 'dens': c['dens'], 'drift': c['drift'],
            'end': c['end'], 'R': c['R'], 'rows': rows0, 'BL': BL, 'ncand': len(cand)}


def inside_repo(p) -> bool:
    try:
        Path(p).resolve().relative_to(ROOT)
        return True
    except ValueError:
        return False


def ep_key(o, season=0):
    m = re.search(r'S(\d+)\s*E(\d+)', o.get('fn') or '', re.I)
    return (int(m.group(1)), int(m.group(2))) if m and (not season or int(m.group(1)) == season) else None


def score_episode(o, r):
    """לכל פרק: chrF של הבלוקים לכל שלב, וההכרעות לכל שלב (קירב/הרחיק/בלי הבדל — הפרש בלוק מעל ±2)"""
    rows, R, BL = r['rows'], r['R'], r['BL']
    fx = fix_files(o.get('tx'))
    T = [stage_texts(c, fx) for c in rows]
    bl_of = {i: b for b in BL for i in b[0]}
    corp = {k: round(block_chrf(BL, [t[k] for t in T], R), 2) for k in ('A', 'B', 'pick', 'f', 'r', 'v', 'z0', 'z')}
    dec = {k: Counter() for k, _x, _y in STEPS}
    worse = []
    for i, t in enumerate(T):
        if i not in bl_of:
            continue
        for k, x, y in STEPS:
            if norm(t[x]) == norm(t[y]):     # שינוי של שבירת שורה / סימן דובר בלבד — לא שינוי
                continue
            d = block_delta(bl_of[i], [tt[x] for tt in T], i, t[y], R)
            v = 'better' if d > 2 else 'worse' if d < -2 else 'same'
            dec[k][v] += 1
            if v == 'worse':
                worse.append((k, i, t[x], t[y]))
    return {'chrf': corp, 'dec': {k: dict(v) for k, v in dec.items()}, 'tx': bool(fx)}, T, worse


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--corpus', required=True)
    ap.add_argument('--records', default='')
    ap.add_argument('--qid', default='', help='Wikidata QID של הסדרה (או --imdb-map)')
    ap.add_argument('--imdb-map', default='', help='{"S01E04": "1234567"} — בלי Wikidata')
    ap.add_argument('--opus-dir', default='', help='מטמון OPUS קיים (תיקייה עם he/<imdb>/*.xml) — בלי רשת')
    ap.add_argument('--refmap', default='', help='הבחירה הקפואה מריצה קודמת (refmap.json)')
    ap.add_argument('--rule', default='edit', choices=('edit', 'd7'), help='edit = קודם גרסה מאותה עריכה; d7 = נקודת הבסיס של המחקר')
    ap.add_argument('--season', type=int, default=0, help='ברירת מחדל — לפי שמות הקבצים')
    ap.add_argument('--out', required=True)
    a = ap.parse_args(argv)
    if inside_repo(a.out):
        sys.exit('--out בתוך הריפו — אסור (תוכן אמיתי). תיקייה זמנית בלבד')
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    C = json.load(open(a.corpus, encoding='utf-8'))
    C = C if isinstance(C, list) else list(C.values())
    recs = {r['id']: r for r in (json.load(open(a.records, encoding='utf-8')) if a.records else [])}
    eps = {}
    for o in C:
        k = ep_key(o, a.season)
        if k and not o.get('xf') and not o.get('gs'):   # עבודות ניסוי / עותקי זהב — רק ב־quality-bench (לפי זרוע)
            eps[k] = o
    if not eps:
        sys.exit('אין בקורפוס פרקים בשם SxxEyy (במצב האיסוף המלא בלבד יש fn)')
    tag = lambda s, e: f'S{s:02d}E{e:02d}'
    if a.imdb_map:
        im = json.load(open(a.imdb_map, encoding='utf-8'))
        maps = {s: {e: str(im[tag(s, e)]) for (s2, e) in eps if s2 == s and tag(s, e) in im} for s in {k[0] for k in eps}}
    elif a.qid:
        maps = {s: imdb_map(a.qid, s) for s in {k[0] for k in eps}}
    else:
        sys.exit('חסר --imdb-map או --qid')
    od = Path(a.opus_dir) if a.opus_dir else out / 'opus'
    if not a.opus_dir:
        fetch_opus('he', {maps[s].get(e) for (s, e) in eps if maps[s].get(e)}, od)
    frozen = json.load(open(a.refmap, encoding='utf-8')) if a.refmap else {}
    refmap, scores = {}, {'v': 2, 'rule': a.rule, 'eps': {}}
    L = ['# מול התרגום האנושי — דוח (v2)', '',
         '| פרק | מצב | xd | xr | גרסה | עוגנים | יחס | סחיפה | chrF A | B | בחירה | f | r | v | z0 | z | $ | שופט |',
         '|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|']
    tot = {k: Counter() for k, _x, _y in STEPS}
    ex = {k: [] for k, _x, _y in STEPS}
    for (s, e), o in sorted(eps.items()):
        ep, im = tag(s, e), maps[s].get(e)
        fx = (frozen.get(ep) or {}).get('ver')
        r = episode(o, od / 'he', im, a.rule, fx) if im else None
        rec = recs.get(o['id'], {})
        if not r:
            L.append(f'| {ep} | {o.get("mode", "")} | — | — | אין ייחוס אנושי | | | | | | | | | | | | | |')
            continue
        refmap[ep] = {'ver': r['ver'], 'anchors': r['anchors'], 'lr': round(r['lr'], 2)}
        sc, T, worse = score_episode(o, r)
        corp = sc['chrf']
        scores['eps'][ep] = dict(sc, mode=o.get('mode', ''), xr=rec.get('xr'), xd=rec.get('xd'), anchors=r['anchors'], lr=round(r['lr'], 2),
                                 dens=round(r['dens'], 2), drift=round(r['drift'], 1), end=round(r['end'], 1), ncand=r['ncand'],
                                 usd=rec.get('usd'), jd=(rec.get('jd') or {}).get('s'))
        L.append(f'| {ep} | {o.get("mode", "")} | {rec.get("xd", "")} | {rec.get("xr", "")} | {r["ver"]} | {r["anchors"]} | {r["lr"]:.2f} | {r["drift"]:.1f} | '
                 + ' | '.join(f'{corp[k]:.2f}' for k in ('A', 'B', 'pick', 'f', 'r', 'v', 'z0', 'z'))
                 + f' | {rec.get("usd", 0) or 0:.3f} | {(rec.get("jd") or {}).get("s", "")} |')
        for k, d in sc['dec'].items():
            tot[k].update(d)
        for (k, i, x, y) in worse:
            if len(ex[k]) < 12:
                c = r['rows'][i]
                ex[k].append((f'{ep} #{c["i"]}', c.get('en', ''), x, y))
    eps_s = list(scores['eps'].values())
    if eps_s:
        def avg(f, sel=lambda x: True):
            v = [f(x) for x in eps_s if sel(x) and f(x) is not None]
            return round(sum(v) / len(v), 2) if v else None
        scores['avg'] = {'n': len(eps_s), 'chrf_z': avg(lambda x: x['chrf']['z']),
                         'by_mode': {m: avg(lambda x: x['chrf']['z'], lambda x, m=m: x['mode'] == m) for m in sorted({x['mode'] for x in eps_s})},
                         'dec': {k: dict(tot[k]) for k in tot}}
    L += ['', '## מה כל שלב עשה (chrF של הבלוק מול האדם, הפרש מעל ±2; שבירת שורה בלבד — לא שינוי)', '',
          '| שלב | קירב | הרחיק | בלי הבדל |', '|---|---|---|---|']
    L += [f'| {k} | {tot[k]["better"]} | {tot[k]["worse"]} | {tot[k]["same"]} |' for k, _x, _y in STEPS]
    if scores.get('avg'):
        L += ['', f'**chrF v2 ממוצע (z): {scores["avg"]["chrf_z"]}** · לפי מצב: ' + ' · '.join(f'{m} {v}' for m, v in scores['avg']['by_mode'].items())]
    L += ['', '## דוגמאות שהרחיקו מהאדם (תוכן אמיתי — לא לריפו)', '']
    for k, _x, _y in STEPS:
        for (w, en, x, y) in ex[k][:6]:
            L.append(f'- **{k}** {w} — EN: {en}\n  - לפני: {x}\n  - אחרי: {y}')
    (out / 'report.md').write_text('\n'.join(L) + '\n', encoding='utf-8')
    (out / 'scores.json').write_text(json.dumps(scores, ensure_ascii=False, indent=1), encoding='utf-8')
    (out / 'refmap.json').write_text(json.dumps(refmap, ensure_ascii=False, indent=1), encoding='utf-8')
    print('\n'.join(L[:4 + len(eps)]))
    print('\nהדוח: ' + str(out / 'report.md') + ' · מספרים: ' + str(out / 'scores.json'))
    return scores


if __name__ == '__main__':
    main()
