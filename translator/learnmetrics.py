"""מאגר הלמידה מ׳5 (20/10/2026) — מדדים שמחושבים בקוד, בלי טוקנים ובלי תלויות.

מה הסוכנים שינו בין השלבים (טיוטה ← תיקוני המתרגם ← הביקורת ← התיקון האחרון): כמה כתוביות השתנו, TER ו־chrF++,
תזמון מול הדיבור (מתי הכתובית עולה מול המילה הראשונה, כמה פריימים מחילוף שוט), עקביות (מונחים מהמילון, שם אחד
באיות אחד), ובדיקות השמטה (כתובית ריקה, קיצור חריג, מספר שנעלם).
רק מספרים יוצאים מכאן — learn_facts שולח אותם תחת mx, והשרתון (lib/studiolearn.js ‏normMx) מקבל רק את הצורה הזו.

התאמה לכלים הפתוחים (נבדק מול הכלים עצמם — הערכים ב־tests/test_learnmetrics.py):
  - TER = sacrebleu 2.6.0 ‏TER() בברירת המחדל (בלי רישיות, פיצול ברווחים), ברמת קורפוס (סכום עריכות ÷ סכום מילות הייחוס).
  - chrF++ = sacrebleu ‏CHRF(word_order=2) ברמת קורפוס (סכום הסטטיסטיקות ואז F_β). חלוקת המילים — tedeval._chrf_words.
  - SubER = apptek/SubER (TER עם שבירות שורה/כתובית כמילים, ומילים מתאימות רק כשהכתוביות חופפות בזמן).
  אותו SubER גם בטלפון (studiosubs.js ‏suber) — אחרי עריכה בעורך. **שינוי באלגוריתם = בשני המקומות.**
"""

from __future__ import annotations

import math
import re
import string

try:
    from tedeval import _chrf_words
except ImportError:                                     # כשמייבאים כחבילה (translator.learnmetrics)
    from translator.tedeval import _chrf_words

MX_V = 1

# ---------------------------------------------------------------------------
# TER — העתקה של sacrebleu/metrics/lib_ter.py (Apache-2.0, Memsource), עם התוספת של SubER (תנאי התאמה בזמן)
# ---------------------------------------------------------------------------
_MAX_SHIFT_SIZE = 10
_MAX_SHIFT_DIST = 50
_BEAM_WIDTH = 100
_MAX_CACHE_SIZE = 10000
_MAX_SHIFT_CANDIDATES = 1000
_INF = int(1e16)
_FLIP = str.maketrans('id', 'di')


def _eq(a, b):
    return a == b


def _yes(a, b):
    return True


def _ident(w):
    return w


class _BeamED:
    def __init__(self, ref, match, allowed, key):
        self.ref, self.n = ref, len(ref)
        self.match, self.allowed, self.key = match, allowed, key
        self.init = [(i, 'i') for i in range(self.n + 1)]
        self.cache, self.size = {}, 0
        self.empty = [(_INF, 'x')] * (self.n + 1)

    def __call__(self, hyp):
        start, dist = self._find(hyp)
        d, rows, trace = self._ed(hyp, start, dist)
        self._add(hyp, rows)
        return d, trace

    def _ed(self, h, start, cache):
        nh = len(h)
        dist = cache + [list(self.empty) for _ in range(nh - start)]
        ratio = self.n / nh if h else 1
        beam = math.ceil(ratio / 2 + _BEAM_WIDTH) if _BEAM_WIDTH < ratio / 2 else _BEAM_WIDTH
        ref, match, allowed = self.ref, self.match, self.allowed
        for i in range(start + 1, nh + 1):
            diag = math.floor(i * ratio)
            lo = max(0, diag - beam)
            hi = self.n + 1 if i == nh else min(self.n + 1, diag + beam)
            row, prev = dist[i], dist[i - 1]
            for j in range(lo, hi):
                if j == 0:
                    row[j] = (prev[j][0] + 1, 'd')
                    continue
                if match(h[i - 1], ref[j - 1]):
                    cs, op = 0, ' '
                else:
                    cs, op = (1 if allowed(h[i - 1], ref[j - 1]) else _INF), 's'
                for c, o in ((prev[j - 1][0] + cs, op), (prev[j][0] + 1, 'd'), (row[j - 1][0] + 1, 'i')):
                    if row[j][0] > c:
                        row[j] = (c, o)
        trace, i, j = '', nh, self.n
        while i > 0 or j > 0:
            op = dist[i][j][1]
            trace = op + trace
            if op in ('s', ' '):
                i, j = i - 1, j - 1
            elif op == 'i':
                j -= 1
            elif op == 'd':
                i -= 1
            else:
                raise ValueError('trace')
        return dist[-1][-1][0], dist[len(cache):], trace

    def _add(self, h, rows):
        if self.size >= _MAX_CACHE_SIZE:
            return
        node = self.cache
        skip = len(h) - len(rows)
        for i in range(skip):
            node = node[self.key(h[i])][0]
        for w, row in zip(h[skip:], rows):
            k = self.key(w)
            if k not in node:
                node[k] = ({}, tuple(row))
                self.size += 1
            node = node[k][0]

    def _find(self, h):
        node, start, dist = self.cache, 0, [self.init]
        for w in h:
            k = self.key(w)
            if k not in node:
                break
            start += 1
            node, row = node[k]
            dist.append(row)
        return start, dist


def _align(trace):
    ph = pr = -1
    he, re_, al = [], [], {}
    for op in trace:
        if op in (' ', 's'):
            ph += 1
            pr += 1
            al[pr] = ph
            he.append(0 if op == ' ' else 1)
            re_.append(0 if op == ' ' else 1)
        elif op == 'i':
            ph += 1
            he.append(1)
        elif op == 'd':
            pr += 1
            al[pr] = ph
            re_.append(1)
    return al, re_, he


def _perform(w, start, length, target):
    if target < start:
        return w[:target] + w[start:start + length] + w[target:start] + w[start + length:]
    if target > start + length:
        return w[:start] + w[start + length:target] + w[start:start + length] + w[target:]
    return w[:start] + w[start + length:length + target] + w[start:start + length] + w[length + target:]


def _pairs(h, r, match):
    nh, nr = len(h), len(r)
    for sh in range(nh):
        for sr in range(nr):
            if abs(sr - sh) > _MAX_SHIFT_DIST:
                continue
            ln = 0
            while match(h[sh + ln], r[sr + ln]) and ln < _MAX_SHIFT_SIZE:
                ln += 1
                yield sh, sr, ln
                if nh == sh + ln or nr == sr + ln:
                    break


def _shift(h, r, ed, checked, match):
    pre, inv = ed(h)
    al, ref_err, hyp_err = _align(inv.translate(_FLIP))
    best = None
    for sh, sr, ln in _pairs(h, r, match):
        if sum(hyp_err[sh:sh + ln]) == 0 or sum(ref_err[sr:sr + ln]) == 0:
            continue
        if sh <= al[sr] < sh + ln:
            continue
        prev = -1
        for off in range(-1, ln):
            if sr + off == -1:
                idx = 0
            elif sr + off in al:
                idx = al[sr + off] + 1
            else:
                break
            if idx == prev:
                continue
            prev = idx
            sw = _perform(h, sh, ln, idx)
            cand = (pre - ed(sw)[0], ln, -sh, -idx)
            checked += 1
            if not best or cand > best[0]:
                best = (cand, sw)
        if checked >= _MAX_SHIFT_CANDIDATES:
            break
    if not best:
        return 0, h, checked
    return best[0][0], best[1], checked


def ter_edits(h, r, match=_eq, allowed=_yes, key=_ident):
    """(עריכות, אורך הייחוס) — translation_edit_rate של sacrebleu / SubER"""
    if not r:
        return len(h), 0
    ed = _BeamED(r, match, allowed, key)
    shifts, cur, checked = 0, h, 0
    while True:
        delta, new, checked = _shift(cur, r, ed, checked, match)
        if checked >= _MAX_SHIFT_CANDIDATES or delta <= 0:
            break
        shifts += 1
        cur = new
    return shifts + ed(cur)[0], len(r)


def ter_corpus(hyps, refs):
    """TER של sacrebleu בברירת המחדל (0–100), ברמת קורפוס"""
    e = n = 0
    for h, r in zip(hyps, refs):
        a, b = ter_edits(h.lower().split(), r.lower().split())
        e += a
        n += b
    return 100.0 * e / n if n else (0.0 if not e else 100.0)


# ---------------------------------------------------------------------------
# chrF++ ברמת קורפוס — sacrebleu ‏CHRF(word_order=2)
# ---------------------------------------------------------------------------
def _ngrams(seq, n):
    out = {}
    for i in range(len(seq) - n + 1):
        g = seq[i:i + n] if isinstance(seq, str) else tuple(seq[i:i + n])
        out[g] = out.get(g, 0) + 1
    return out


def chrf_stats(hyp, ref, char_order=6, word_order=2):
    st = []
    ch, cr = ''.join(hyp.split()), ''.join(ref.split())
    hw, rw = _chrf_words(hyp), _chrf_words(ref)
    for seqs, top in (((ch, cr), char_order), ((hw, rw), word_order)):
        for n in range(1, top + 1):
            a, b = _ngrams(seqs[0], n), _ngrams(seqs[1], n)
            # כמו sacrebleu: בלי n־גרמות בייחוס — גם ההשערה נספרת 0 (משנה רק ברמת קורפוס)
            st.append([sum(a.values()) if b else 0, sum(b.values()), sum(min(v, b.get(k, 0)) for k, v in a.items())])
    return st


def chrf_from_stats(st, beta=2):
    f = beta * beta
    ap = ar = 0.0
    eff = 0
    for nh, nr, m in st:
        if nh > 0 and nr > 0:
            ap += m / nh
            ar += m / nr
            eff += 1
    if not eff:
        return 0.0
    ap, ar = ap / eff, ar / eff
    return 100 * (1 + f) * ap * ar / (f * ap + ar) if ap + ar else 0.0


def chrf_corpus(hyps, refs):
    tot = None
    for h, r in zip(hyps, refs):
        st = chrf_stats(h, r)
        tot = st if tot is None else [[x + y for x, y in zip(a, b)] for a, b in zip(tot, st)]
    return chrf_from_stats(tot) if tot else 0.0


# ---------------------------------------------------------------------------
# SubER — apptek/SubER ‏calculate_SubER(metric="SubER")
# כתובית = (התחלה, סוף, [שורות]). מילה = (טקסט, התחלה, סוף, מספר) — המספר רק למטמון
# ---------------------------------------------------------------------------
EOL, EOB = '<eol>', '<eob>'
_BREAKS = (EOL, EOB)
_PUNCT = str.maketrans('', '', string.punctuation)
_TAG = re.compile(r'</?[^>]>')


def _norm_word(s):
    x = s.lower()
    y = x.translate(_PUNCT).replace('…', '')
    return y or x


def _sub_words(sub):
    out = []                                            # [טקסט, שבירה]
    for line in sub[2]:
        line = _TAG.sub('', str(line).strip())
        out += [[w, ''] for w in line.split()]
        if out:
            out[-1][1] = EOL
    if out:
        out[-1][1] = EOB
    return out


def _parts(hyp, ref):
    """חלוקה לחלקים בכל רגע שאין בו כתובית לא בהשערה ולא בייחוס — כמו _get_independent_parts"""
    hp, rp, i, j, last = [], [], 0, 0, -float('inf')
    while i < len(hyp) or j < len(ref):
        if i < len(hyp) and (j == len(ref) or hyp[i][0] < ref[j][0]):
            if (hp or rp) and hyp[i][0] >= last:
                yield hp, rp
                hp, rp = [], []
            hp.append(hyp[i])
            last = max(last, hyp[i][1])
            i += 1
        else:
            if (hp or rp) and ref[j][0] >= last:
                yield hp, rp
                hp, rp = [], []
            rp.append(ref[j])
            last = max(last, ref[j][1])
            j += 1
    if hp or rp:
        yield hp, rp


def _timed(subs, base):
    out = []
    for s in subs:
        for w, br in _sub_words(s):
            out.append((_norm_word(w), s[0], s[1], base + len(out)))
            if br:
                out.append((br, s[0], s[1], base + len(out)))
    return out


def _sub_ok(a, b):
    if (a[0] in _BREAKS) != (b[0] in _BREAKS):
        return False
    return (a[1] < b[2]) == (b[1] < a[2])


def _sub_match(a, b):
    return a[0] == b[0] and _sub_ok(a, b)


def _sub_key(w):
    return w


def suber_counts(hyp, ref):
    """(עריכות, אסימוני ייחוס — מילים ושבירות). hyp/ref = [(התחלה, סוף, [שורות]), ...]"""
    hyp = sorted(hyp, key=lambda s: s[0])
    ref = sorted(ref, key=lambda s: s[0])
    e = n = 0
    for hp, rp in _parts(hyp, ref):
        h, r = _timed(hp, 0), _timed(rp, 1 << 30)
        if [x[:3] for x in h] == [x[:3] for x in r]:   # חלק זהה = 0 עריכות (קיצור בלבד — התוצאה זהה)
            n += len(r)
            continue
        a, b = ter_edits(h, r, _sub_match, _sub_ok, _sub_key)
        e += a
        n += b
    return e, n


def suber(hyp, ref):
    e, n = suber_counts(hyp, ref)
    if n:
        return round(100.0 * e / n, 3)
    return 0.0 if not e else 100.0


# ---------------------------------------------------------------------------
# המדדים לעבודה — מהקורפוס של learn_corpus (job.py), בלי לקרוא שוב קבצים
# ---------------------------------------------------------------------------
_BIDI = re.compile('[‎‏‪-‮⁦-⁩﻿]')
_NIKUD = re.compile('[֑-ׇֽֿׁׂׅׄ]')
STAGE_PAIRS = (('df', 'd', 'f'), ('fr', 'f', 'r'), ('rz', 'r', 'z'), ('dz', 'd', 'z'))


def _clean(s):
    return _NIKUD.sub('', _BIDI.sub('', str(s or ''))).replace('\n', ' ').strip()


def _stage_texts(cu):
    out = []
    for c in cu:
        d = _clean(c.get('d'))
        f = _clean(c['f']) if 'f' in c else d
        r = _clean(c['r']) if 'r' in c else f
        z = _clean(c['z']) if 'z' in c else r
        out.append({'d': d, 'f': f, 'r': r, 'z': z, 'en': _clean(c.get('en')), 'i': c.get('i')})
    return out


def _r(v, d=3):
    return round(float(v), d)


def stage_metrics(rows):
    """מה כל שלב שינה: n = כתוביות עם תרגום, ולכל זוג — ch כתוביות ששונו, t TER, c chrF++ (הקודם מול הבא)"""
    rows = [x for x in rows if x['d'] or x['z']]
    out = {'n': len(rows)}
    for key, a, b in STAGE_PAIRS:
        hy = [x[a] for x in rows]
        rf = [x[b] for x in rows]
        ch = sum(1 for x, y in zip(hy, rf) if x != y)
        out[key + '.ch'] = ch
        if not rows:
            continue
        e = n = 0
        for x, y in zip(hy, rf):
            if x == y:
                n += len(y.lower().split())
                continue
            a2, b2 = ter_edits(x.lower().split(), y.lower().split())
            e += a2
            n += b2
        out[key + '.t'] = _r(100.0 * e / n if n else 0.0, 2)
        out[key + '.c'] = _r(chrf_corpus(hy, rf), 2)
    return out


def _pct(vals, q):
    v = sorted(vals)
    if not v:
        return None
    return v[min(len(v) - 1, int(q * (len(v) - 1) + 0.5))]


def timing_metrics(fin, words, shots=None, fps=None):
    """מתי הכתובית עולה ויורדת מול הדיבור שבתוכה (מילים שהאמצע שלהן בתוך הכתובית), ומרחק הגבולות מחילוף שוט"""
    out = {}
    ws = sorted((w[1], w[2]) for w in words or [] if isinstance(w, (list, tuple)) and len(w) >= 3
                and isinstance(w[1], (int, float)) and isinstance(w[2], (int, float)))
    cues = [c for c in fin or [] if isinstance(c.get('s'), (int, float)) and isinstance(c.get('e'), (int, float)) and c['e'] > c['s']]
    if not cues:
        return out
    lead, tail, nw = [], [], 0
    k = 0
    for c in cues:
        s, e = c['s'], c['e']
        while k < len(ws) and (ws[k][0] + ws[k][1]) / 2 < s:
            k += 1
        j, inside = k, []
        while j < len(ws) and (ws[j][0] + ws[j][1]) / 2 <= e:
            inside.append(ws[j])
            j += 1
        if not inside:
            nw += 1
            continue
        lead.append(s - inside[0][0])
        tail.append(e - inside[-1][1])
    out['n'] = len(cues)
    out['nw'] = nw
    if lead:
        out['in.p50'] = _r(_pct(lead, 0.5))
        out['in.p90'] = _r(_pct(lead, 0.9))
        out['out.p50'] = _r(_pct(tail, 0.5))
        out['out.p10'] = _r(_pct(tail, 0.1))
        out['late'] = sum(1 for x in lead if x > 0.2)          # עולה יותר מ־200ms אחרי שהמילה הראשונה התחילה
        out['cut'] = sum(1 for x in tail if x < -0.5)          # יורדת כשהמילה האחרונה עוד נאמרת חצי שנייה
    if shots and fps and fps > 0:
        st = sorted(float(t) for t in shots if isinstance(t, (int, float)))
        near = bad = 0
        if st:
            import bisect
            for c in cues:
                for t in (c['s'], c['e']):
                    p = bisect.bisect_left(st, t)
                    d = min(abs(t - st[q]) for q in (p - 1, p) if 0 <= q < len(st))
                    fr = d * fps
                    if fr < 11.5:
                        near += 1
                        if fr >= 0.5:
                            bad += 1                            # 1–11 פריימים מחילוף — היה צריך להיצמד אליו
        out['sh.near'] = near
        out['sh.bad'] = bad
    return out


_HE_TOK = re.compile("[א-ת][א-ת'׳\"״]*")
_EN_NAME = re.compile(r"\b[A-Z][a-z]{2,}\b")
_PREF = set('והבלמשכ')
_DIGITS = re.compile(r"\d[\d,]*(?:\.\d+)?(?![a-zA-Z\d])")


def _he_tokens(s):
    return [t.replace("'", '׳').replace('"', '״').rstrip('׳״"\'') for t in _HE_TOK.findall(s)]


def _cores(t):
    out = {t}
    for k in (1, 2):
        if len(t) - k >= 3 and all(ch in _PREF for ch in t[:k]):
            out.add(t[k:])
    return out


def _skel(t):
    return t[:1] + re.sub('[ויאה׳״]', '', t[1:])


def consistency_metrics(rows, glossary=None):
    """שם אחד באיות אחד (שמות באנגלית שחוזרים ב־2 כתוביות לפחות), ומונחים מהמילון"""
    out = {}
    starts = set()
    by_name = {}
    for x in rows:
        if not x['z']:
            continue
        first = re.match(r"\W*([A-Za-z]+)", x['en'])
        starts.add(first.group(1) if first else '')
        for m in set(_EN_NAME.findall(x['en'])):
            if first and m == first.group(1):
                continue
            by_name.setdefault(m, []).append(x)
    checked = var = 0
    for name, xs in by_name.items():
        if len(xs) < 2:
            continue
        cnt = {}
        for x in xs:
            for c in {c for t in _he_tokens(x['z']) for c in _cores(t)}:
                cnt[c] = cnt.get(c, 0) + 1
        if not cnt:
            continue
        dom, n = max(cnt.items(), key=lambda kv: (kv[1], len(kv[0]), kv[0]))
        if n < 2 or n < 0.6 * len(xs) or len(dom) < 3:
            continue
        checked += 1
        sk = _skel(dom)
        if any(c != dom and _skel(c) == sk and len(c) >= 3 for c in cnt):
            var += 1
    out['nm.n'] = checked
    out['nm.var'] = var
    hits = miss = mixed = 0
    for line in glossary or []:
        parts = str(line).split('\t')
        if len(parts) < 2 or not parts[0].strip() or not parts[1].strip():
            continue
        en = parts[0].strip().lower()
        alts = [_clean(a) for a in parts[1].split('/') if _clean(a)]
        if not alts:
            continue
        pat = re.compile(r"(?<![a-z])" + re.escape(en) + r"(?![a-z])")
        used = set()
        for x in rows:
            if not x['z'] or not pat.search(x['en'].lower()):
                continue
            hits += 1
            got = [a for a in alts if a in x['z']]
            if not got:
                miss += 1
            else:
                used.add(got[0])
        if len(used) > 1:
            mixed += 1
    out['gl.n'] = hits
    out['gl.miss'] = miss
    out['gl.mix'] = mixed
    return out


def omission_metrics(rows):
    """כתובית שנשארה ריקה, קיצור חריג (פחות מ־30% מאורך המקור במשפט של 6 מילים ומעלה), ומספרים שנעלמו"""
    out = {}
    empty = short = 0
    ratios = []
    nums = miss = 0
    for x in rows:
        en, he = x['en'], x['z']
        nw = len(en.split())
        ce = len(''.join(en.split()))
        ch = len(''.join(he.split()))
        if nw >= 3 and not he:
            empty += 1
        if ce >= 10 and he:
            ratios.append(ch / ce)
            if nw >= 6 and ch / ce < 0.3:
                short += 1
        hd = [d.replace(',', '') for d in _DIGITS.findall(he)]
        for d in _DIGITS.findall(en):
            d = d.replace(',', '')
            nums += 1
            if d in hd:
                hd.remove(d)
            else:
                miss += 1
    out['om.e'] = empty
    out['om.s'] = short
    if ratios:
        out['om.r50'] = _r(_pct(ratios, 0.5))
    out['num.n'] = nums
    out['num.miss'] = miss
    return out


def job_metrics(corpus, shots=None, fps=None):
    """הכל יחד — מילון של קבוצות, ובכל קבוצה רק מספרים. corpus = הפלט של learn_corpus"""
    cu = corpus.get('cu') if isinstance(corpus, dict) else None
    if not isinstance(cu, list) or not cu:
        return None
    rows = _stage_texts([c for c in cu if isinstance(c, dict)])
    out = {'v': MX_V, 'st': stage_metrics(rows)}
    tm = timing_metrics(corpus.get('fin'), corpus.get('wd'), shots, fps)
    if tm:
        out['tm'] = tm
    out['cs'] = consistency_metrics(rows, corpus.get('gl'))
    out['om'] = omission_metrics(rows)
    return out
