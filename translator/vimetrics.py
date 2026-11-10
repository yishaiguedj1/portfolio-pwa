"""ניתוח סרטונים — המדדים בקוד (התוכנית 7.6, PR 1.2ב). בלי טוקנים ובלי תלויות.

`metrics(vi, ref)` = התאום של `viMetrics` ב־ibkr-proxy/lib/studiovi.js (המעבדה). **זהה** על אותו fixture:
translator/tests/fixtures/vi_metrics.json ({in, ref, out}) — tests/studio-vi.test.js ו־test_vimetrics.py.
רק מה שאפשר לחשב מ־vi.json עצמו (ועם ref — מול ייחוס): נאמנות, כיסוי, צורה ומבנה.

`worker_extra(vi, wd)` — מה שרק העובד יכול: ביטחון ה־OCR, חלק המילים בביטחון נמוך, קצב הדיבור. נכנס לרשומה
המספרית (vi_facts), לא ל־viMetrics.
"""

from __future__ import annotations

import re

try:
    import vicheck as C
except ImportError:                                     # כשמייבאים כחבילה
    from translator import vicheck as C

# = words ב־JS: ‏/[\p{L}\p{N}][\p{L}\p{N}'’.\-]*/gu. ‏[^\W_] = אות או ספרה (str.isalnum), כמו \p{L}\p{N}
WORD_RE = re.compile(r"[^\W_](?:[^\W_]|['’.\-])*")
S_RE = re.compile(r'^s\d{1,5}$')


def _r4(v: float) -> float:
    """Math.round(v * 1e4) / 1e4 של JS (חצי — למעלה)"""
    x = C._jround(v * 1e4) / 1e4
    return int(x) if x == int(x) else x


def words(s) -> int:
    return len(WORD_RE.findall(str(s or '')))


def _first_t(it: dict, by_id: dict):
    t = None
    for i in it.get('ev') or []:
        e = by_id.get(i)
        if e is not None and (t is None or e['t0'] < t):
            t = e['t0']
    return t


def bound_f1(pred: list, ref: list, tol: float):
    """F1 של הגבולות: התאמה אחד־לאחד בחלון ±tol (חמדני, מהקרוב לרחוק) — = boundF1"""
    if not pred and not ref:
        return None
    pairs = sorted((abs(p - r), i, j) for i, p in enumerate(pred) for j, r in enumerate(ref) if abs(p - r) <= tol)
    ui, uj, tp = set(), set(), 0
    for _, i, j in pairs:
        if i not in ui and j not in uj:
            ui.add(i)
            uj.add(j)
            tp += 1
    pr = tp / len(pred) if pred else 0
    rc = tp / len(ref) if ref else 0
    return _r4(2 * pr * rc / (pr + rc)) if pr + rc > 0 else 0


def _bounds(chs) -> list:
    return sorted(c['t0'] for c in chs or [] if C._fin(c.get('t0'), 0, 86400))[1:]


def metrics(vi: dict, ref: dict | None = None):
    v = C.norm_vi(vi)
    if not v:
        return None
    its = v['items']
    n = len(its)
    dur = v['video']['dur']

    def cnt(f):
        return sum(1 for x in its if f(x))

    def rate(k):
        return _r4(k / n) if n else None
    out_w = sum(words(it['text']) for it in its) + sum(words(c.get('sum')) + words(c.get('adds')) for c in v['chapters'])
    tr_w = sum(words(e['text']) for e in v['evidence'])
    by_id = {x['id']: x for x in v['evidence'] + v['slides']}
    for s in v['slides']:
        for oid in s.get('ocr') or []:
            by_id[oid] = s
    used = set()
    for it in its:
        for i in it['ev']:
            x = by_id.get(i)
            if x is not None and S_RE.match(x['id']):
                used.add(x['id'])
    for l in v['ledger']:
        if l.get('used'):
            x = by_id.get(l['ref'])
            if x is not None and S_RE.match(x['id']):
                used.add(x['id'])
    ts = [t for t in (_first_t(it, by_id) for it in its) if t is not None]
    mid = (sum(1 for t in ts if dur / 3 <= t < 2 * dur / 3) / len(ts)) if dur > 0 and ts else None
    out = {
        'n': n, 'support_rate': rate(cnt(lambda x: x['ver'] == 'sup')), 'part_rate': rate(cnt(lambda x: x['ver'] == 'part')),
        'unknown_rate': rate(cnt(lambda x: x['ver'] == 'unk')),
        'unsupported_per_1k': _r4(cnt(lambda x: x['ver'] in ('uns', 'con')) * 1000 / out_w) if out_w > 0 else None,
        'so_share': rate(cnt(lambda x: x['src'] == 'screen_only')), 'inf_share': rate(cnt(lambda x: x['basis'] != 'speaker')),
        'kf_total': len(v['slides']), 'kf_used': len(used), 'kf_cov': _r4(len(used) / len(v['slides'])) if v['slides'] else None,
        'mid_ratio': None if mid is None else _r4(mid * 3),
        'density': _r4(n * 600 / dur) if dur > 0 else None,
        'len_ratio': _r4(out_w / tr_w) if tr_w > 0 else None,
        'out_words': out_w, 'n_ch': len(v['chapters']),
    }
    rc = [c for c in ref['chapters'] if isinstance(c, dict) and C._fin(c.get('t0'), 0, 86400)] \
        if isinstance(ref, dict) and isinstance(ref.get('chapters'), list) else None
    if rc is not None:
        p, r = _bounds(v['chapters']), _bounds(rc)
        out['ch_f1_5'] = bound_f1(p, r, 5)
        out['ch_f1_10'] = bound_f1(p, r, 10)
    return out


def worker_extra(vi: dict, words_list: list | None = None) -> dict:
    """מה שרק העובד יודע: ביטחון OCR ממוצע (0–100), ביטחון התמלול הממוצע וחלק המילים בביטחון נמוך (p < 0.5), מילים לדקה"""
    ocr = [o['conf'] for o in vi.get('ocr') or [] if isinstance(o.get('conf'), (int, float))]
    wl = [w for w in words_list or [] if isinstance(w.get('s'), (int, float)) and isinstance(w.get('e'), (int, float))]
    ps = [w['p'] for w in wl if isinstance(w.get('p'), (int, float))]
    sp = sum(max(0.0, w['e'] - w['s']) for w in wl)
    dur = (vi.get('video') or {}).get('dur') or 0
    return {'ocr_conf': round(sum(ocr) / len(ocr), 1) if ocr else None,
            'asr_conf': round(sum(ps) / len(ps), 4) if ps else None,
            'asr_low': round(sum(1 for p in ps if p < 0.5) / len(ps), 4) if ps else None,
            'wpm': round(len(wl) * 60 / dur, 1) if dur > 0 and wl else None,
            'speech_share': round(min(1.0, sp / dur), 4) if dur > 0 else None}


# ---------------------------------------------------------------- הקריטריון של גל הזהב (PR 1.6, התוכנית 6.7)
# 1. ניצחונות בזוגות (visheet.vj_pair): הגבול התחתון של Wilson (95%) על ניצחונות ÷ (ניצחונות + הפסדים) — מעל 0.5.
# 2. בלי נסיגה במדדים הקשים: bootstrap מקובץ לפי סרטון (1,000 דגימות, זרע קבוע) — הגבול התחתון (2.5%) של ההפרש
#    B − A ב־support_rate, ‏ts_acc ו־kf_cov לא יורד מתחת ל־−0.02.
# 3. חסימה קשיחה: טענה לא נתמכת אחת שמוצגת ב־B = נכשל.
# 4. משאבים: עלות ≤ +10%, זמן ≤ +5% (סכום על כל הסרטונים).
HARD = ('support_rate', 'ts_acc', 'kf_cov')
NO_REG = -0.02
BOOT_N, BOOT_SEED = 1000, 7
COST_UP, TIME_UP = 0.10, 0.05


def wilson_lb(k: int, n: int, z: float = 1.96) -> float | None:
    """הגבול התחתון של רווח הסמך של Wilson ל־k הצלחות מתוך n. n = 0 — None"""
    if n <= 0:
        return None
    p = k / n
    d = 1 + z * z / n
    c = p + z * z / (2 * n)
    s = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5)
    return _r4((c - s) / d)


def boot_lb(diffs: dict, n: int = BOOT_N, seed: int = BOOT_SEED) -> float | None:
    """diffs = {סרטון: [הפרשים]} → הגבול התחתון (2.5%) של ממוצע ההפרש, ב־bootstrap שדוגם סרטונים (לא פריטים)"""
    import random
    vids = [v for v in sorted(diffs) if [x for x in diffs[v] if x is not None]]
    if not vids:
        return None
    rnd = random.Random(seed)
    means = []
    for _ in range(n):
        xs = []
        for _v in range(len(vids)):
            xs.extend(x for x in diffs[vids[rnd.randrange(len(vids))]] if x is not None)
        means.append(sum(xs) / len(xs))
    means.sort()
    return _r4(means[int(0.025 * n)])


def decide(rows: list[dict]) -> dict:
    """rows — שורה לכל השוואה (זוג הרצות של אותו סרטון): {vid, w: 'X'|'Y'|'tie' (X = A, Y = B), a: {מדדים, usd, sec},
    b: {מדדים, usd, sec}, b_uns: טענות לא נתמכות שמוצגות ב־B}. → {pass, wins, losses, ties, wlb, reg: {מדד: lb},
    hard: n, cost, time, why: [סיבות הכישלון]}"""
    rows = [r for r in rows or [] if isinstance(r, dict)]
    w = sum(1 for r in rows if r.get('w') == 'Y')
    lo = sum(1 for r in rows if r.get('w') == 'X')
    out = {'wins': w, 'losses': lo, 'ties': len(rows) - w - lo, 'wlb': wilson_lb(w, w + lo), 'reg': {}, 'why': []}
    if out['wlb'] is None or out['wlb'] <= 0.5:
        out['why'].append('wins')
    for k in HARD:
        d: dict = {}
        for r in rows:
            a, b = (r.get('a') or {}).get(k), (r.get('b') or {}).get(k)
            if isinstance(a, (int, float)) and isinstance(b, (int, float)):
                d.setdefault(str(r.get('vid')), []).append(b - a)
        out['reg'][k] = boot_lb(d)
        if out['reg'][k] is not None and out['reg'][k] < NO_REG:
            out['why'].append('reg_' + k)
    out['hard'] = sum(int(r.get('b_uns') or 0) for r in rows)
    if out['hard'] > 0:
        out['why'].append('hard')
    tot = lambda side, f: sum(float((r.get(side) or {}).get(f) or 0) for r in rows)  # noqa: E731
    ca, cb, ta, tb = tot('a', 'usd'), tot('b', 'usd'), tot('a', 'sec'), tot('b', 'sec')
    out['cost'] = _r4(cb / ca - 1) if ca > 0 else None
    out['time'] = _r4(tb / ta - 1) if ta > 0 else None
    if out['cost'] is not None and out['cost'] > COST_UP:
        out['why'].append('cost')
    if out['time'] is not None and out['time'] > TIME_UP:
        out['why'].append('time')
    out['pass'] = not out['why']
    return out
