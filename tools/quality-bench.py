#!/usr/bin/env python3
"""quality-bench — רתמת המדידה הקבועה של איכות התרגום (02/11/2026, תוכנית איכות התרגום PR1 1.4–1.7, 1.11).

השיטה (docs/studio-learning.md, "כלי המדידה"; ההחלטות: docs/studio-quality-plan.md §6):
  • הכרעה — השוואה עיוורת: X/Y אקראי, בשני הסדרים, תיקו מותר, קוד סיבה (mean/gen/reg/joke/flu), הערה לפני ההכרעה.
  • אבחון — מומחה MQM לפי tools/quality/EXPERT.md (תבנית כללית; --genre), על זמני fin (מה שהצופה רואה, 1.7).
  • מונים דטרמיניסטיים (1.5) — חינם, בכל הרצה.
  • ESA (1.11) — גיליון של 40 כתוביות לסימון אנושי, וקריאה חזרה.

פקודות (כל הפלט ל־--out מחוץ לריפו — אחרת הכלי נעצר; יש בפלט טקסט אמיתי):
  prep    --corpus C --out D [--eps all|S01E05,…] [--genre auto|sitcom|lecture|interview] [--imdb-map M --opus-dir O --refmap R]
  pairs   --mode stages --corpus C --out D            · לפני מול אחרי של כל שלב באותה הרצה
  pairs   --mode ab --a CA --b CB --out D [--n 40]     · שתי הרצות של אותו סרטון (לפי gs/fn), דגימה לפי seed
  run     --task expert|pairs --in D --transport cli|api --cap-usd X [--yes] [--model M] [--effort E] [--print-agent-prompts]
  score   --in D                                       · scores.json — מספרים בלבד
  compare --base B.json --new N.json                   · טבלה + הכרעה לפי הקריטריון שנקבע מראש (§6.4)
  count   --corpus C --out D                           · המונים הדטרמיניסטיים
  esa     --a CA --b CB --out D [--n 40]  ·  esa-read --in D --sheet S.csv
מזהי הסדרה (מפת IMDb, QID) — רק ב־--config מחוץ לריפו. בריפו: הקוד, התבניות הכלליות ו־baseline.json (ממוצעים בלבד).
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import math
import random
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'translator'))
QDIR = ROOT / 'tools' / 'quality'
_spec = importlib.util.spec_from_file_location('lvh', ROOT / 'tools' / 'learn-vs-human.py')
V = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(V)

MODEL, EFFORT = 'claude-opus-5-5', 'medium'      # אותו מודל כמו נקודת הבסיס; החלפה = בסיס חדש (hash ב־manifest.json)
EXPERT_BATCH, PAIRS_BATCH = 50, 40
SEVS = {'min': 1, 'maj': 5, 'crit': 10}
CATS = ('mean', 'omit', 'add', 'gen', 'reg', 'name', 'joke', 'flu', 'gram', 'spk', 'fmt', 'time')
NON_CONTENT = ('fmt', 'time')                    # "MQM לתוכן" — בלי עיצוב ותזמון
WHY = ('mean', 'gen', 'reg', 'joke', 'flu')
GENRES = ('sitcom', 'lecture', 'interview')
PAIR_W = ('X', 'Y', 'T')


# ------------------------------------------------------------------ כללי
def guard_out(p) -> Path:
    if V.inside_repo(p):
        sys.exit('--out בתוך הריפו — אסור (תוכן אמיתי). תיקייה זמנית בלבד')
    d = Path(p)
    d.mkdir(parents=True, exist_ok=True)
    return d


def load_corpus(p) -> list:
    C = json.load(open(p, encoding='utf-8'))
    return C if isinstance(C, list) else list(C.values())


def ep_tag(o) -> str:
    k = V.ep_key(o)
    return f'S{k[0]:02d}E{k[1]:02d}' if k else str(o.get('id', ''))[:8]


def sha(t: str) -> str:
    return hashlib.sha256(t.encode('utf-8')).hexdigest()[:16]


def fill(tpl: str, **kw) -> str:
    for k, v in kw.items():
        tpl = tpl.replace('{{' + k + '}}', str(v))
    return tpl


def genre_of(o, want='auto') -> str:
    if want in GENRES:
        return want
    fn = str(o.get('fn') or '')
    return 'sitcom' if V.ep_key(o) else 'lecture' if re.search(r'lecture|talk|ted|הרצאה', fn, re.I) else 'interview'


def characters(o) -> str:
    """שמות ומגדר — מטבלת הדוברים של העבודה (sp), בזמן ריצה; לא מהתבנית"""
    rows = []
    for k, v in sorted((o.get('sp') or {}).items()):
        g = {'m': 'זכר', 'f': 'נקבה'}.get(str(v.get('g') or '').lower()[:1], '?')
        rows.append(f'- {k}: {v.get("n") or "?"} · {g}' + (f' · {v["r"]}' if v.get('r') else ''))
    return '\n'.join(rows) or '- (אין טבלת דוברים)'


def overlap(a, b) -> float:
    return max(0.0, min(a[1], b[1]) - max(a[0], b[0]))


def fin_rows(o) -> list:
    """לכל כתובית סופית (זמני fin — מה שהצופה רואה, 1.7): הכתובית בתכנון (cu) עם החפיפה הגדולה, בשביל EN/דובר/היסטוריה"""
    cu = [c for c in o.get('cu') or [] if isinstance(c.get('s'), (int, float))]
    out = []
    for n, f in enumerate(o.get('fin') or [], 1):
        best = max(cu, key=lambda c: overlap((f['s'], f['e']), (c['s'], c['e'])), default=None)
        if best is not None and overlap((f['s'], f['e']), (best['s'], best['e'])) <= 0:
            best = None
        out.append({'n': n, 's': f['s'], 'e': f['e'], 'h': f.get('h') or '', 'c': best})
    return out


def tsf(t: float) -> str:
    m, s = divmod(max(0.0, t or 0), 60)
    return f'{int(m):02d}:{s:05.2f}'


# ------------------------------------------------------------------ prep (מומחה)
def human_blocks(o, args):
    """HE-HUMAN לפי בלוקים (כל משפט פעם אחת) — מ־OPUS דרך learn-vs-human, או מהייחוס של העבודה (ref.he)"""
    rows = [(r['s'], r['e']) for r in fin_rows(o)]
    R = None
    if (o.get('ref') or {}).get('he'):
        R = [(c['s'], c['e'], c['h']) for c in o['ref']['he']]
    elif args.imdb_map and args.opus_dir and V.ep_key(o):
        im = json.load(open(args.imdb_map, encoding='utf-8')).get(ep_tag(o))
        fixed = (json.load(open(args.refmap, encoding='utf-8')).get(ep_tag(o)) or {}).get('ver') if args.refmap else None
        r = V.episode(o, Path(args.opus_dir) / 'he', str(im), 'edit', fixed) if im else None
        R = r['R'] if r else None
    if not R:
        return {}
    out = {}
    for c, r in V.blocks(rows, R):
        out[c[0]] = (c, ' '.join(R[j][2] for j in r))
    return out


def expert_md(o, args) -> str:
    fx = V.fix_files(o.get('tx'))
    hb = human_blocks(o, args)
    L = [f'# {ep_tag(o)} · {o.get("mode", "")}', '', '## דוברים', characters(o), '', '## כתוביות', '']
    for i, r in enumerate(fin_rows(o)):
        c = r['c'] or {}
        L.append(f'#{r["n"]} [{tsf(r["s"])}–{tsf(r["e"])}] {c.get("k", "S?")}')
        L.append(f'EN: {c.get("en", "")}')
        L.append('HE: ' + r['h'].replace('\n', ' / '))
        if c:
            t = V.stage_texts(c, fx)
            hist = [f'{k}: {t[y]}' for k, x, y in V.STEPS if V.norm(t[x]) != V.norm(t[y])]
            if hist:
                L.append('HIST: ' + ' ‖ '.join([f'draft: {t["A"]}'] + hist))
        if i in hb:
            ci, txt = hb[i]
            L.append(f'HE-HUMAN (#{ci[0] + 1}–#{ci[-1] + 1}): {txt}')
        L.append('')
    return '\n'.join(L)


def cmd_prep(a):
    out = guard_out(a.out)
    C = [o for o in load_corpus(a.corpus) if o.get('fin')]
    want = None if a.eps == 'all' else set(a.eps.split(','))
    tpl = (QDIR / 'EXPERT.md').read_text(encoding='utf-8')
    (out / 'expert').mkdir(exist_ok=True)
    man = {'task': 'expert', 'model': a.model, 'effort': a.effort, 'seed': a.seed, 'tpl': sha(tpl), 'eps': {}}
    for o in C:
        ep = ep_tag(o)
        if want and ep not in want:
            continue
        g = genre_of(o, a.genre)
        rub = fill(tpl, GENRE=g, CHARACTERS=characters(o), HAS_EN_REF='כן' if (o.get('tx') or {}).get('en.ref.txt') else 'לא',
                   HAS_HE_HUMAN='כן' if (o.get('ref') or {}).get('he') or a.opus_dir else 'לא')
        (out / 'expert' / f'{ep}.md').write_text(expert_md(o, a), encoding='utf-8')
        (out / 'expert' / f'{ep}.RUBRIC.md').write_text(rub, encoding='utf-8')
        man['eps'][ep] = {'genre': g, 'n': len(o.get('fin') or []), 'mode': o.get('mode', ''), 'xf': o.get('xf'), 'wa': o.get('wa')}
    (out / 'manifest.json').write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'prep: {len(man["eps"])} פרקים → {out / "expert"}')


# ------------------------------------------------------------------ pairs (השוואה עיוורת)
def stage_pairs(o) -> list:
    fx = V.fix_files(o.get('tx'))
    out = []
    for c in o.get('cu') or []:
        t = V.stage_texts(c, fx)
        for k, x, y in V.STEPS:
            if V.norm(t[x]) != V.norm(t[y]):
                out.append({'ep': ep_tag(o), 'i': c.get('i'), 'k': k, 'en': c.get('en', ''), 'a': t[x], 'b': t[y]})
    return out


def match_runs(A, B) -> list:
    """כתוביות של שתי הרצות של אותו סרטון: לפי מספר כשהתכנון זהה, אחרת לפי חפיפת זמן (50% מהקצרה)"""
    ra, rb = fin_rows(A), fin_rows(B)
    same = len(A.get('cu') or []) == len(B.get('cu') or []) and all(
        (x.get('en') == y.get('en')) for x, y in zip(A.get('cu') or [], B.get('cu') or []))
    out = []
    if same and len(ra) == len(rb):
        return [(x, y) for x, y in zip(ra, rb)]
    j = 0
    for x in ra:
        while j < len(rb) and rb[j]['e'] < x['s']:
            j += 1
        for y in rb[j:j + 4]:
            if overlap((x['s'], x['e']), (y['s'], y['e'])) >= 0.5 * min(x['e'] - x['s'], y['e'] - y['s']):
                out.append((x, y))
                break
    return out


def ab_pairs(A, B, n, seed, touched=None) -> list:
    """עד n זוגות שונים לפרק: קודם כתוביות שהדגל נגע בהן (touched — מספרי כתובית), אחר כך השאר; לפי seed"""
    rnd = random.Random(seed)
    m = [(x, y) for x, y in match_runs(A, B) if V.norm(x['h']) != V.norm(y['h'])]
    t = set(touched or [])
    first = [p for p in m if (p[1]['c'] or {}).get('i') in t]
    rest = [p for p in m if p not in first]
    rnd.shuffle(first)
    rnd.shuffle(rest)
    out = []
    for x, y in (first + rest)[:n]:
        out.append({'ep': ep_tag(A), 'i': (x['c'] or {}).get('i'), 'k': 'ab', 'en': (x['c'] or {}).get('en', ''), 'a': x['h'], 'b': y['h'],
                    'ft': 1 if (y['c'] or {}).get('i') in t else 0})
    return out


def write_pairs(items, out: Path, seed: int, both: bool, tpl: str, batch=PAIRS_BATCH):
    """מנות של זוגות X/Y אקראי. both = כל זוג פעמיים, בסדר הפוך, במנות רחוקות. המפתח — ב־key/ (לא בתיקייה שהמודל קורא)"""
    rnd = random.Random(seed)
    rows = []
    for n, it in enumerate(items):
        flip = rnd.random() < 0.5
        rows.append((n, 0, flip, it))
        if both:
            rows.append((n, 1, not flip, it))
    first = [r for r in rows if r[1] == 0]
    second = [r for r in rows if r[1] == 1]
    rnd.shuffle(first)
    rnd.shuffle(second)
    allr = first + second                             # הסדר ההפוך — במנות שאחרי כל המנות הראשונות
    (out / 'pairs').mkdir(parents=True, exist_ok=True)
    (out / 'key').mkdir(parents=True, exist_ok=True)
    key = {}
    for b in range(0, len(allr), batch):
        L = [fill(tpl, N=min(batch, len(allr) - b)), '']
        for (n, o_, flip, it) in allr[b:b + batch]:
            pid = f'p{n:04d}{"b" if o_ else "a"}'
            x, y = (it['b'], it['a']) if flip else (it['a'], it['b'])
            L += [f'§{pid}', f'EN: {it["en"]}', f'X: {x}', f'Y: {y}', '']
            key[pid] = {'n': n, 'o': o_, 'xb': 1 if flip else 0, 'ep': it['ep'], 'i': it.get('i'), 'k': it['k'], 'ft': it.get('ft', 0)}
        (out / 'pairs' / f'batch_{b // batch + 1:03d}.md').write_text('\n'.join(L), encoding='utf-8')
    (out / 'key' / 'pairs.json').write_text(json.dumps(key, ensure_ascii=False), encoding='utf-8')
    return key


def cmd_pairs(a):
    out = guard_out(a.out)
    tpl = (QDIR / 'PAIRS.md').read_text(encoding='utf-8')
    if a.mode == 'stages':
        items = [p for o in load_corpus(a.corpus) for p in stage_pairs(o)]
    else:
        CA, CB = load_corpus(a.a), load_corpus(a.b)
        bk = lambda o: o.get('gs') or o.get('fn') or ep_tag(o)
        items = []
        idx = defaultdict(list)
        for o in CB:
            idx[bk(o)].append(o)
        for A in CA:
            for B in idx.get(bk(A), [])[:1]:
                items += ab_pairs(A, B, a.n, a.seed + len(items), (B.get('ft') or []))
    key = write_pairs(items, out, a.seed, a.both_orders, tpl)
    man = {'task': 'pairs', 'mode': a.mode, 'model': a.model, 'effort': a.effort, 'seed': a.seed, 'tpl': sha(tpl), 'n': len(items), 'both': a.both_orders}
    (out / 'manifest.json').write_text(json.dumps(man, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'pairs: {len(items)} זוגות ({len(key)} שורות) → {out / "pairs"}')


# ------------------------------------------------------------------ run (המודל)
_EXP_LINE = re.compile(r'^\{.*\}$')


def parse_expert(text: str, ids: set) -> list:
    out = []
    for ln in (text or '').splitlines():
        ln = ln.strip().strip(',')
        if not _EXP_LINE.match(ln):
            continue
        try:
            r = json.loads(ln)
        except ValueError:
            continue
        if isinstance(r, dict) and r.get('i') in ids and r.get('cat') in CATS and r.get('sev') in SEVS:
            out.append({'i': r['i'], 'cat': r['cat'], 'sev': r['sev'], 'stage': str(r.get('stage') or '')[:12]})
    return out


def parse_pairs(text: str, ids: set) -> list:
    out = []
    for ln in (text or '').splitlines():
        ln = ln.strip().strip(',')
        if not _EXP_LINE.match(ln):
            continue
        try:
            r = json.loads(ln)
        except ValueError:
            continue
        if isinstance(r, dict) and r.get('p') in ids and r.get('w') in PAIR_W:
            out.append({'p': r['p'], 'w': r['w'], 'why': r.get('why') if r.get('why') in WHY else ''})
    return out


def batches(d: Path, task: str) -> list:
    if task == 'expert':
        return sorted(p for p in (d / 'expert').glob('*.md') if not p.name.endswith('.RUBRIC.md'))
    return sorted((d / 'pairs').glob('batch_*.md'))


def expert_chunks(p: Path) -> list:
    """קובץ פרק → מנות של EXPERT_BATCH כתוביות (הכותרת והדוברים בכל מנה)"""
    t = p.read_text(encoding='utf-8')
    head, _, body = t.partition('## כתוביות')
    cues = re.split(r'\n(?=#\d+ \[)', body.strip())
    cues = [c for c in cues if re.match(r'#\d+ \[', c)]
    return [(head + '## כתוביות\n\n' + '\n'.join(cues[i:i + EXPERT_BATCH]), {int(re.match(r'#(\d+)', c).group(1)) for c in cues[i:i + EXPERT_BATCH]})
            for i in range(0, len(cues), EXPERT_BATCH)]


def jobs_for(d: Path, task: str) -> list:
    """[(שם המנה, ההנחיה, הבקשה, מזהים חוקיים)]"""
    out = []
    if task == 'expert':
        for p in batches(d, 'expert'):
            rub = (p.parent / (p.stem + '.RUBRIC.md')).read_text(encoding='utf-8')
            for k, (txt, ids) in enumerate(expert_chunks(p)):
                out.append((f'{p.stem}.{k:02d}', rub, txt, ids))
    else:
        for p in batches(d, 'pairs'):
            t = p.read_text(encoding='utf-8')
            ids = set(re.findall(r'^§(p\d{4}[ab])$', t, re.M))
            out.append((p.stem, '', t, ids))
    return out


def cmd_run(a, engine=None):
    d = Path(a.inp)
    if V.inside_repo(d):
        sys.exit('--in בתוך הריפו — אסור')
    jobs = jobs_for(d, a.task)
    raw = d / 'raw' / a.task
    raw.mkdir(parents=True, exist_ok=True)
    if a.print_agent_prompts:
        for name, sysp, req, _ids in jobs:
            print(f'=== {name} → {raw / (name + ".txt")}\n{sysp}\n\n{req}\n')
        return 0
    if a.transport == 'api' and not a.yes:
        sys.exit('transport api עולה כסף — רק עם --yes (ואחרי אישור המחיר)')
    if engine is None:
        import llm
        engine = llm.Engine(llm.Spec('anthropic', a.model, a.effort), cap_usd=a.cap_usd, transport=a.transport)
    parse = parse_expert if a.task == 'expert' else parse_pairs
    done = bad = 0
    for name, sysp, req, ids in jobs:
        f = raw / (name + '.txt')
        if f.exists():                     # המשך מהמקום שנעצר
            continue
        for attempt in range(2):           # ניסיון חוזר אחד למנה פגומה
            try:
                res = engine.complete('rv', sysp, req, max_tokens=24000)
            except Exception as e:  # noqa: BLE001 — כולל LLMError של התקרה: עוצרים, מה שנשמר נשמר
                print(f'· {name}: נעצר ({getattr(e, "code", type(e).__name__)})')
                return 1
            txt = getattr(res, 'text', '') or ''
            rows = parse(txt, ids)
            if rows or attempt:
                break
        if not rows:
            bad += 1
        f.write_text(txt, encoding='utf-8')
        done += 1
    usd = engine.ledger.total() if getattr(engine, 'ledger', None) else None
    (d / 'raw' / f'{a.task}.cost.json').write_text(json.dumps({'usd': usd, 'n': done, 'bad': bad}), encoding='utf-8')
    print(f'run {a.task}: {done} מנות, {bad} פגומות, עלות {usd}')
    return 0


# ------------------------------------------------------------------ score
def wilson(k: int, n: int, z: float = 1.96):
    if n <= 0:
        return (None, None, None)
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return (round(p, 4), round(c - h, 4), round(c + h, 4))


def sign_p(w: int, l: int) -> float | None:
    """מבחן סימן דו־צדדי (בלי תיקו)"""
    n = w + l
    if not n:
        return None
    k = min(w, l)
    s = sum(math.comb(n, i) for i in range(k + 1)) / 2 ** n
    return round(min(1.0, 2 * s), 4)


def score_expert(d: Path) -> dict:
    man = json.load(open(d / 'manifest.json', encoding='utf-8'))
    raw = d / 'raw' / 'expert'
    per = defaultdict(list)
    for f in sorted(raw.glob('*.txt')):
        ep = f.stem.rsplit('.', 1)[0]
        n = (man.get('eps', {}).get(ep) or {}).get('n') or 0
        per[ep] += parse_expert(f.read_text(encoding='utf-8'), set(range(1, n + 1)))   # רק כתוביות שקיימות בפרק
    eps = {}
    for ep, m in man.get('eps', {}).items():
        rows, n = per.get(ep, []), max(1, m.get('n') or 1)
        k = 100.0 / n
        eps[ep] = {'n': m.get('n'), 'genre': m.get('genre'), 'mode': m.get('mode'), 'xf': m.get('xf'), 'wa': m.get('wa'),
                   'issues': round(len(rows) * k, 2),
                   'majcrit': round(sum(r['sev'] != 'min' for r in rows) * k, 2),
                   'mqm': round(sum(SEVS[r['sev']] for r in rows) * k, 2),
                   'mqm_content': round(sum(SEVS[r['sev']] for r in rows if r['cat'] not in NON_CONTENT) * k, 2),
                   'cat': {c: round(sum(r['sev'] != 'min' for r in rows if r['cat'] == c) * k, 2) for c in CATS},
                   'stage': dict(Counter(r['stage'] for r in rows if r['stage']))}
    agg = {}
    if eps:
        for key in ('issues', 'majcrit', 'mqm', 'mqm_content'):
            agg[key] = round(sum(e[key] for e in eps.values()) / len(eps), 2)
        agg['cat'] = {c: round(sum(e['cat'][c] for e in eps.values()) / len(eps), 2) for c in CATS}
    return {'eps': eps, 'avg': agg, 'tpl': man.get('tpl'), 'model': man.get('model')}


def score_pairs(d: Path) -> dict:
    key = json.load(open(d / 'key' / 'pairs.json', encoding='utf-8'))
    got = {}
    for f in sorted((d / 'raw' / 'pairs').glob('*.txt')):
        for r in parse_pairs(f.read_text(encoding='utf-8'), set(key)):
            got[r['p']] = r
    per_o = defaultdict(dict)     # n → {סדר: 'b' | 'a' | 'T'}
    why = Counter()
    by_k = defaultdict(Counter)
    ft = Counter()
    for pid, r in got.items():
        k = key[pid]
        v = 'T' if r['w'] == 'T' else ('b' if (r['w'] == 'X') == bool(k['xb']) else 'a')
        per_o[k['n']][k['o']] = v
        if v != 'T' and r['why']:
            why[v + ':' + r['why']] += 1
        by_k[k['k']][v] += 1
        if k.get('ft'):
            ft[v] += 1
    both = [x for x in per_o.values() if len(x) == 2]
    agree = sum(x[0] == x[1] for x in both)
    tally = Counter(v for x in per_o.values() for v in x.values())
    w, l, t = tally['b'], tally['a'], tally['T']
    p, lo, hi = wilson(w, w + l)
    return {'b': w, 'a': l, 't': t, 'n': w + l + t, 'win': p, 'lo': lo, 'hi': hi, 'sign_p': sign_p(w, l),
            'pos_x': round(sum(1 for pid, r in got.items() if r['w'] == 'X') / max(1, sum(1 for r in got.values() if r['w'] != 'T')), 4),
            'agree': round(agree / len(both), 4) if both else None, 'n_both': len(both),
            'by_stage': {k: dict(v) for k, v in by_k.items()}, 'why': dict(why), 'ft': dict(ft)}


def cmd_score(a):
    d = Path(a.inp)
    out = {'v': 1}
    if (d / 'raw' / 'expert').exists():
        out['expert'] = score_expert(d)
    if (d / 'key' / 'pairs.json').exists():
        out['pairs'] = score_pairs(d)
    (d / 'scores.json').write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding='utf-8')
    print(json.dumps({k: (v.get('avg') if k == 'expert' else {x: v[x] for x in ('b', 'a', 't', 'win', 'lo', 'hi', 'agree')}) for k, v in out.items() if isinstance(v, dict)}, ensure_ascii=False))
    return out


# ------------------------------------------------------------------ compare (§6.4)
def decide(base: dict, new: dict, noise: float = 0.0, cost=None, tm=None) -> dict:
    """הקריטריון שנקבע מראש: (1) הגבול התחתון של Wilson מעל 50%; (2) אין קטגוריה שנסוגה ביותר מ־0.5 בעיות חמורות ל־100
    וגם מפעמיים רצפת הרעש; (5) עלות עד ‎+10% וזמן עד ‎+5%. תנאים 3, 4, 6 — בדוח של הגל (ז'אנר, אמינות, מונה לכל דגל)"""
    why = []
    pr = new.get('pairs') or {}
    c1 = pr.get('lo') is not None and pr['lo'] > 0.5
    if not c1:
        why.append(f'השוואה עיוורת: הגבול התחתון {pr.get("lo")} לא מעל 0.5')
    bc = ((base.get('expert') or {}).get('avg') or {}).get('cat') or {}
    nc = ((new.get('expert') or {}).get('avg') or {}).get('cat') or {}
    reg = {c: round(nc.get(c, 0) - bc.get(c, 0), 2) for c in CATS if nc.get(c, 0) - bc.get(c, 0) > max(0.5, 2 * noise)}
    if reg:
        why.append('נסיגה אצל המומחה: ' + ', '.join(f'{c} ‎+{v}' for c, v in reg.items()))
    c5 = (cost is None or cost <= 0.10) and (tm is None or tm <= 0.05)
    if not c5:
        why.append(f'עלות/זמן מעל הסף ({cost}, {tm}) — לשאול')
    return {'on': c1 and not reg and c5, 'c1': c1, 'reg': reg, 'c5': c5, 'why': why}


def cmd_compare(a):
    B = json.load(open(a.base, encoding='utf-8'))
    N = json.load(open(a.new, encoding='utf-8'))
    d = decide(B, N, a.noise, a.cost, a.time)
    be, ne = (B.get('expert') or {}).get('avg') or {}, (N.get('expert') or {}).get('avg') or {}
    print('| מדד | בסיס | חדש |\n|---|---|---|')
    for k in ('mqm_content', 'majcrit', 'issues'):
        print(f'| {k} | {be.get(k)} | {ne.get(k)} |')
    pr = N.get('pairs') or {}
    print(f'| עיוורת (B) | | {pr.get("win")} [{pr.get("lo")}–{pr.get("hi")}] · {pr.get("b")}/{pr.get("a")}/{pr.get("t")} |')
    print('\nהכרעה: ' + ('מופעל' if d['on'] else 'לא מופעל') + ('' if d['on'] else ' — ' + '; '.join(d['why'])))
    return d


# ------------------------------------------------------------------ count (1.5) — מונים דטרמיניסטיים
REG_PAIRS = (('כלומר', r'\bI mean\b'), ('אוי', r'\bOh\b'), ('לדעתי', r'\bI think\b'))
HEDGE_EN = re.compile(r"\b(I think|maybe|probably|kind of|sort of|I guess|perhaps|might)\b", re.I)
HEDGE_HE = re.compile(r'(אולי|כנראה|נראה לי|לדעתי|אני חושב|אני חושבת|בערך|די |סוג של|יכול להיות)')
YOU_HE = re.compile(r'(?<![\w])(את|אתה|אתם|אתן)(?![\w])')


def counters(o) -> dict:
    fin = o.get('fin') or []
    cu = o.get('cu') or []
    fx = V.fix_files(o.get('tx'))
    T = [V.stage_texts(c, fx) for c in cu]
    n = max(1, len(fin))
    reg = {}
    for he, en in REG_PAIRS:
        rx = re.compile(en, re.I)
        e = [c for c, t in zip(cu, T) if rx.search(c.get('en') or '')]
        reg[he] = {'en': len(e), 'he': sum(he in (t['z'] or '') for c, t in zip(cu, T) if rx.search(c.get('en') or '')),
                   'extra': sum(he in (t['z'] or '') for c, t in zip(cu, T) if not rx.search(c.get('en') or ''))}
    hed = [(c, t) for c, t in zip(cu, T) if HEDGE_EN.search(c.get('en') or '')]
    you = Counter(m.group(1) for f in fin for m in YOU_HE.finditer(f.get('h') or ''))
    names = Counter()
    for g in o.get('gl') or []:
        en_t, _, he_t = str(g).partition('\t')
        if not en_t or not he_t or en_t.startswith('#'):
            continue
        rx = re.compile(r'\b' + re.escape(en_t) + r'\b', re.I)
        for c, t in zip(cu, T):
            if rx.search(c.get('en') or ''):
                names['use'] += 1
                names['miss'] += he_t not in (t['z'] or '')
    pipes_ours = sum('||' in (f.get('h') or '') or '\n-' in (f.get('h') or '') for f in fin)
    dash_ref = sum(1 for ln in str((o.get('tx') or {}).get('en.ref.txt') or '').splitlines() if re.search(r'\]\s*-', ln))
    early15 = early3 = 0
    wd = [w for w in o.get('wd') or [] if isinstance(w, list) and len(w) > 2 and isinstance(w[1], (int, float))]
    ws = sorted(w[1] for w in wd)
    import bisect
    for f in fin:
        k = bisect.bisect_left(ws, f['s'])
        if ws and k < len(ws):
            gap = ws[k] - f['s']
            early15 += gap > 1.5
            early3 += gap > 3
    ov = sum(1 for x, y in zip(fin, fin[1:]) if x['e'] > y['s'] + 1e-3)
    short = sum(1 for f in fin if f['e'] - f['s'] < 0.8)
    zrev = sum(1 for t in T if V.norm(t['z']) != V.norm(t['v']) and V.norm(t['z']) == V.norm(t['pick']) and V.norm(t['v']) != V.norm(t['pick']))
    zpipe = sum(1 for t in T if '||' in (t['z'] or '') and '||' not in (t['v'] or '') and '||' in (t['pick'] or ''))
    return {'n': len(fin), 'reg': reg, 'hedge': {'en': len(hed), 'kept': sum(bool(HEDGE_HE.search(t['z'] or '')) for _c, t in hed)},
            'you': dict(you), 'names': dict(names), 'pipes': {'ours': pipes_ours, 'ref_dash': dash_ref},
            'early15': early15, 'early3': early3, 'overlap': ov, 'short': short, 'zrevert': zrev, 'zpipe': zpipe,
            'per100': {'early15': round(early15 * 100 / n, 2), 'overlap': round(ov * 100 / n, 2)}}


def cmd_count(a):
    out = guard_out(a.out)
    res = {ep_tag(o) + (f'.a{o["wa"]}' if o.get('wa') is not None else ''): counters(o) for o in load_corpus(a.corpus) if o.get('fin')}
    (out / 'counters.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    tot = Counter()
    for r in res.values():
        for k in ('early15', 'early3', 'overlap', 'short', 'zrevert', 'zpipe'):
            tot[k] += r[k]
    print(f'count: {len(res)} פרקים · ' + ' · '.join(f'{k} {v}' for k, v in tot.items()))
    return res


# ------------------------------------------------------------------ esa (1.11)
def cmd_esa(a):
    out = guard_out(a.out)
    CA, CB = load_corpus(a.a), load_corpus(a.b)
    idx = {o.get('gs') or o.get('fn'): o for o in CB}
    items = []
    for A in CA:
        B = idx.get(A.get('gs') or A.get('fn'))
        if B:
            items += ab_pairs(A, B, a.n, a.seed)
    rnd = random.Random(a.seed)
    rnd.shuffle(items)
    items = items[:a.n]
    key, rows = {}, []
    for n, it in enumerate(items, 1):
        flip = rnd.random() < 0.5
        x, y = (it['b'], it['a']) if flip else (it['a'], it['b'])
        rows.append([n, it['en'], x, '', '', y, '', ''])
        key[n] = {'xb': 1 if flip else 0, 'ep': it['ep'], 'i': it['i']}
    (out / 'key').mkdir(exist_ok=True)
    with open(out / 'esa.csv', 'w', encoding='utf-8', newline='') as f:
        w = csv.writer(f)
        w.writerow(['#', 'EN', 'תרגום 1', 'שגיאות 1 (קל/משמעותי)', 'ציון 1 (0–100)', 'תרגום 2', 'שגיאות 2 (קל/משמעותי)', 'ציון 2 (0–100)'])
        w.writerows(rows)
    (out / 'key' / 'esa.json').write_text(json.dumps(key), encoding='utf-8')
    print(f'esa: {len(rows)} כתוביות → {out / "esa.csv"} (להעלות כגיליון ל־Drive של המשתמש; המפתח נשאר ב־key/)')


def cmd_esa_read(a):
    d = Path(a.inp)
    key = json.load(open(d / 'key' / 'esa.json', encoding='utf-8'))
    sa, sb, w = [], [], Counter()
    with open(a.sheet, encoding='utf-8') as f:
        for r in list(csv.reader(f))[1:]:
            if not r or str(r[0]) not in key:
                continue
            try:
                s1, s2 = float(r[4]), float(r[7])
            except (ValueError, IndexError):
                continue
            k = key[str(r[0])]
            b, aa = (s1, s2) if k['xb'] else (s2, s1)
            sb.append(b)
            sa.append(aa)
            w['b' if b > aa else 'a' if aa > b else 'T'] += 1
    res = {'n': len(sa), 'a': round(sum(sa) / len(sa), 2) if sa else None, 'b': round(sum(sb) / len(sb), 2) if sb else None, 'win': dict(w)}
    (d / 'esa.scores.json').write_text(json.dumps(res), encoding='utf-8')
    print(json.dumps(res, ensure_ascii=False))
    return res


# ------------------------------------------------------------------ ארגומנטים
def build_parser():
    ap = argparse.ArgumentParser(description='quality-bench — מדידת איכות התרגום')
    sp = ap.add_subparsers(dest='cmd', required=True)

    def common(p):
        p.add_argument('--model', default=MODEL)
        p.add_argument('--effort', default=EFFORT)
        p.add_argument('--seed', type=int, default=1102)
    p = sp.add_parser('prep')
    common(p)
    p.add_argument('--corpus', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--eps', default='all')
    p.add_argument('--genre', default='auto', choices=('auto',) + GENRES)
    p.add_argument('--imdb-map', default='')
    p.add_argument('--opus-dir', default='')
    p.add_argument('--refmap', default='')
    p = sp.add_parser('pairs')
    common(p)
    p.add_argument('--mode', required=True, choices=('stages', 'ab'))
    p.add_argument('--corpus', default='')
    p.add_argument('--a', default='')
    p.add_argument('--b', default='')
    p.add_argument('--n', type=int, default=40)
    p.add_argument('--both-orders', action='store_true')
    p.add_argument('--out', required=True)
    p = sp.add_parser('run')
    common(p)
    p.add_argument('--task', required=True, choices=('expert', 'pairs'))
    p.add_argument('--in', dest='inp', required=True)
    p.add_argument('--transport', default='cli', choices=('cli', 'api'))
    p.add_argument('--cap-usd', type=float, default=2.0)
    p.add_argument('--yes', action='store_true')
    p.add_argument('--print-agent-prompts', action='store_true')
    p = sp.add_parser('score')
    p.add_argument('--in', dest='inp', required=True)
    p = sp.add_parser('compare')
    p.add_argument('--base', required=True)
    p.add_argument('--new', required=True)
    p.add_argument('--noise', type=float, default=0.0, help='רצפת הרעש של המומחה (בעיות חמורות ל־100), מ־M1')
    p.add_argument('--cost', type=float, default=None, help='שינוי העלות היחסי (0.08 = ‎+8%%)')
    p.add_argument('--time', type=float, default=None)
    p = sp.add_parser('count')
    p.add_argument('--corpus', required=True)
    p.add_argument('--out', required=True)
    p = sp.add_parser('esa')
    p.add_argument('--a', required=True)
    p.add_argument('--b', required=True)
    p.add_argument('--n', type=int, default=40)
    p.add_argument('--seed', type=int, default=1102)
    p.add_argument('--out', required=True)
    p = sp.add_parser('esa-read')
    p.add_argument('--in', dest='inp', required=True)
    p.add_argument('--sheet', required=True)
    return ap


def main(argv=None):
    a = build_parser().parse_args(argv)
    if getattr(a, 'out', None) is not None and a.cmd not in ('compare',):
        guard_out(a.out)
    return {'prep': cmd_prep, 'pairs': cmd_pairs, 'run': cmd_run, 'score': cmd_score, 'compare': cmd_compare,
            'count': cmd_count, 'esa': cmd_esa, 'esa-read': cmd_esa_read}[a.cmd](a)


if __name__ == '__main__':
    r = main()
    sys.exit(r if isinstance(r, int) else 0)
