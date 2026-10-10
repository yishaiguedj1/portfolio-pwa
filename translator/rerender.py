"""מ2 (10/10/2026): הפקה מחדש — הכתוביות שנערכו בטלפון → ASS / SRT / VTT → צריבה. בלי Claude ובלי טוקנים.

רץ בסביבת vt (job.py render מפעיל אותו עם VT_PY), ומשתמש באותן פונקציות של vt build / vt render —
אותו עיצוב, אותו מנוע צריבה, אותם שמות קבצים. הקלט = הסרטון המקורי + קובץ ה־cues (JSON, הפורמט של cues.final.json).
הכתוביות הן טקסט מהמשתמש: מנקים תווי בקרה וכיווניות, מגבילים כמויות, ושום שדה לא נכנס לפקודה.
"""
import argparse
import json
import re
import sys
from pathlib import Path

CTRL = re.compile(r'[\x00-\x08\x0b-\x1f\x7f‎‏‪-‮⁦-⁩]')
MAX_CUES = 6000          # שעתיים של כתוביות הן כ־1,500
MAX_LINES = 3
MAX_LINE = 200
MIN_DUR = 0.05
OUTS = ('compact', 'same', 'mkv', 'small')


def _num(x):
    try:
        v = float(x)
    except (TypeError, ValueError):
        return None
    return v if v == v and abs(v) < 1e7 else None


def norm_cues(raw, dur=0.0):
    """רשימת כתוביות תקינה וממוינת: start/end בשניות (מקבל גם s/e), lines = עד 3 שורות טקסט.
    פגומה / ריקה / הפוכה — בחוץ; אחרי סוף הסרטון — בחוץ; חפיפה — הקודמת נחתכת. id = מספר רץ (vt צריך אותו)."""
    out = []
    for c in (raw if isinstance(raw, list) else [])[:MAX_CUES]:
        if not isinstance(c, dict):
            continue
        s, e = _num(c.get('start', c.get('s'))), _num(c.get('end', c.get('e')))
        lines = c.get('lines')
        if isinstance(lines, str):
            lines = lines.split('\n')
        if s is None or e is None or not isinstance(lines, list):
            continue
        lines = [CTRL.sub('', str(x)).strip()[:MAX_LINE] for x in lines if isinstance(x, (str, int, float))]
        lines = [x for x in lines if x][:MAX_LINES]
        s = max(0.0, s)
        if dur > 0:
            e = min(e, dur)
        if not lines or e - s < MIN_DUR:
            continue
        out.append({'start': round(s, 3), 'end': round(e, 3), 'lines': lines,
                    'spk': CTRL.sub('', str(c.get('spk') or ''))[:20], 'en': CTRL.sub('', str(c.get('en') or ''))[:400]})
    out.sort(key=lambda c: (c['start'], c['end']))
    for a, b in zip(out, out[1:]):
        if b['start'] < a['end']:
            a['end'] = round(max(a['start'] + MIN_DUR, b['start']), 3)
    out = [c for c in out if c['end'] - c['start'] >= MIN_DUR]
    for i, c in enumerate(out, start=1):
        c['id'] = i
    return out


def main(argv=None):
    p = argparse.ArgumentParser(description='הפקה מחדש מכתוביות ערוכות (בלי טוקנים)')
    p.add_argument('--src', required=True)
    p.add_argument('--cues', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--name', required=True)
    p.add_argument('--style', default='bold')
    p.add_argument('--want', default='compact')
    p.add_argument('--work', default='')
    a = p.parse_args(argv)
    from vt import config as C
    from vt.media import probe
    from vt.render import burn, mux_mkv, small_copy
    from vt.subs import write_ass, write_ass_compat, write_srt, write_vtt
    from vt.util import write_text

    src, od = Path(a.src), Path(a.out)
    od.mkdir(parents=True, exist_ok=True)
    want = [k for k in a.want.split(',') if k in OUTS]
    info = probe(src)
    v = info.get('video') or {'width': 1920, 'height': 1080}
    W, H = int(v.get('width') or 1920), int(v.get('height') or 1080)
    style = C.STYLES.get(a.style) or C.STYLES[C.DEFAULT_STYLE]
    try:
        raw = json.loads(Path(a.cues).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError):
        raise SystemExit('✗ קובץ הכתוביות פגום.')
    if isinstance(raw, dict):
        raw = raw.get('cues')
    cues = norm_cues(raw, float(info.get('duration') or 0))
    if not cues:
        raise SystemExit('✗ אין כתוביות תקינות בקובץ.')
    print('כתוביות: %d' % len(cues), flush=True)
    write_text(od / 'he.ass', write_ass(cues, style, W, H, a.name))
    write_text(od / 'he.player.ass', write_ass_compat(cues, style, W, H, a.name))
    write_text(od / 'he.srt', write_srt(cues), bom=True)
    write_text(od / 'he.vtt', write_vtt(cues))
    work = Path(a.work) if a.work else od / '_overlay'
    burned, comp = od / (a.name + '.he.mp4'), od / (a.name + '.he.compact.mp4')
    if 'mkv' in want:
        mux_mkv(src, od / 'he.player.ass', od / 'he.srt', od / (a.name + '.he.mkv'), style.font_file)
    if 'same' in want:
        burn(src, od / 'he.ass', burned, info, codec='av1', profile='same', work=work)
    if 'compact' in want or ('small' in want and 'same' not in want):
        burn(src, od / 'he.ass', comp, info, codec='av1', profile='small', work=work)
    if 'small' in want:
        base = burned if burned.exists() else comp
        small_copy(base, od / (a.name + '.he.small.mp4'))
    print('✓ ההפקה הסתיימה', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
