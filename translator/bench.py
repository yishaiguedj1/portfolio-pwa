#!/usr/bin/env python3
"""מאגר המדידות של סטודיו התרגום (10/10/2026, בקשת המשתמש): כל ריצה — זמן, עלות, טוקנים, איכות — לדקת סרטון,
כדי למדוד לאורך זמן את השיפור במערכת (יעילות, איכות, עלות, זמני עבודה) ולהשוות מודלים ומצבים.

הקובץ: translator/bench/runs.jsonl — שורה לכל ריצה. בלי שמות קבצים של המשתמש ובלי תוכן:
רק מזהה קטע בדיקה (למשל ted-netflix-0-300 — הרצאת TED ציבורית שבמבחן), מספרים, מודלים וגרסת הקוד.

הרצה:
  python3 translator/bench.py add run.json        # הוספת ריצה (בדיקת צורה; מחושבים ‎/דקה)
  python3 translator/bench.py report               # טבלה לכל ריצה + ממוצע לכל מצב
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

RUNS = Path(__file__).resolve().parent / 'bench' / 'runs.jsonl'
STAGES = ('up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv')
ROLES = ('main', 'tl', 'rv', 'jg')
ID_RE = re.compile(r'^\d{4}-\d{2}-\d{2}-\d{2}$')
CLIP_RE = re.compile(r'^[a-z0-9][a-z0-9-]{2,60}$')
MODEL_RE = re.compile(r'^claude-[a-z0-9-]{1,50}$')


def num(v, lo=0.0, hi=1e9):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and lo <= v <= hi


def validate(r: dict) -> dict:
    """צורה קבועה — ריצה שלא עומדת בה לא נכנסת (ובטח לא טקסט חופשי עם שם קובץ)."""
    if not ID_RE.match(str(r.get('id', ''))):
        raise ValueError('id: YYYY-MM-DD-NN')
    if not CLIP_RE.match(str(r.get('clip', ''))):
        raise ValueError('clip: מזהה קטע בדיקה (אותיות קטנות, ספרות, מקפים)')
    if not num(r.get('dur_s'), 1, 86400) or not num(r.get('wall_s'), 1, 7 * 86400):
        raise ValueError('dur_s / wall_s')
    for k, v in (r.get('models') or {}).items():
        if k not in ROLES or not MODEL_RE.match(str(v)):
            raise ValueError('models: ' + k)
    for blk in ('usd', 'tok'):
        for k, v in (r.get(blk) or {}).items():
            if k not in ROLES or not num(v):
                raise ValueError(blk + ': ' + k)
    for k, v in (r.get('stages_s') or {}).items():
        if k not in STAGES or not num(v, 0, 7 * 86400):
            raise ValueError('stages_s: ' + k)
    if len(str(r.get('notes', ''))) > 400:
        raise ValueError('notes: עד 400 תווים')
    return r


def derive(r: dict) -> dict:
    """הערכים לדקת סרטון — מחושבים תמיד מהגולמי (לא נשמרים ביד, כדי שלא ייסתרו)."""
    m = r['dur_s'] / 60
    usd = sum((r.get('usd') or {}).values())
    tok = sum((r.get('tok') or {}).values())
    return {'usd': round(usd, 4), 'usd_min': round(usd / m, 4), 'tok_min': round(tok / m),
            'wall_min': round(r['wall_s'] / 60 / m, 2)}


def load() -> list[dict]:
    if not RUNS.exists():
        return []
    return [json.loads(ln) for ln in RUNS.read_text(encoding='utf-8').splitlines() if ln.strip()]


def add(path: str) -> int:
    r = validate(json.loads(Path(path).read_text(encoding='utf-8')))
    runs = load()
    if any(x['id'] == r['id'] for x in runs):
        raise SystemExit('✗ כבר יש ריצה עם המזהה ' + r['id'])
    RUNS.parent.mkdir(exist_ok=True)
    with RUNS.open('a', encoding='utf-8') as f:
        f.write(json.dumps(r, ensure_ascii=False, sort_keys=True) + '\n')
    d = derive(r)
    print('✓ נוספה %s · $%.3f לדקה · %d טוקנים לדקה · %.2f דק׳ עבודה לדקת סרטון' % (r['id'], d['usd_min'], d['tok_min'], d['wall_min']))
    return 0


def report() -> int:
    runs = load()
    if not runs:
        print('אין עדיין ריצות.')
        return 0
    head = ('ריצה', 'קטע', 'דק׳', 'מצב', 'גרסה', '$ סה״כ', '$/דק׳', 'טוקנים/דק׳', 'זמן/דק׳', 'איכות', 'שופט', 'chrF++')
    rows = []
    for r in runs:
        d = derive(r)
        ted = r.get('ted') or {}
        rows.append((r['id'], r['clip'], '%g' % (r['dur_s'] / 60), r.get('mode', '?'), r.get('code', '?'),
                     '%.3f' % d['usd'], '%.3f' % d['usd_min'], str(d['tok_min']), '%.2f' % d['wall_min'],
                     str(r.get('quality') if r.get('quality') is not None else '—'), str(r.get('judge') if r.get('judge') is not None else '—'), str(ted.get('chrf_doc', '—'))))
    w = [max(len(str(x[i])) for x in rows + [head]) for i in range(len(head))]
    for x in [head] + rows:
        print('  '.join(str(v).ljust(w[i]) for i, v in enumerate(x)))
    print('\nממוצע לכל מצב:')
    by = {}
    for r in runs:
        by.setdefault(r.get('mode', '?'), []).append(derive(r))
    for k, v in sorted(by.items()):
        n = len(v)
        print('  %-14s ריצות %d · $%.3f/דק׳ · %d טוקנים/דק׳ · %.2f דק׳ עבודה/דק׳' % (
            k, n, sum(x['usd_min'] for x in v) / n, sum(x['tok_min'] for x in v) / n, sum(x['wall_min'] for x in v) / n))
    return 0


if __name__ == '__main__':
    if len(sys.argv) >= 3 and sys.argv[1] == 'add':
        raise SystemExit(add(sys.argv[2]))
    if len(sys.argv) == 2 and sys.argv[1] == 'report':
        raise SystemExit(report())
    print(__doc__)
    raise SystemExit(2)
