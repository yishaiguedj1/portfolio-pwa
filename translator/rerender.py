"""מ2 (10/10/2026): הפקה מחדש — הכתוביות שנערכו בטלפון → ASS / SRT / VTT → צריבה. בלי Claude ובלי טוקנים.

רץ בסביבת vt (job.py render מפעיל אותו עם VT_PY), ומשתמש באותן פונקציות של vt build / vt render —
אותו עיצוב, אותו מנוע צריבה, אותם שמות קבצים. הקלט = הסרטון המקורי + קובץ ה־cues (JSON, הפורמט של cues.final.json).
הכתוביות הן טקסט מהמשתמש: מנקים תווי בקרה וכיווניות, מגבילים כמויות, ושום שדה לא נכנס לפקודה.
"""
import argparse
import json
import math
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


PORTRAIT_SCALE = 1.35     # מ5: וידאו אנכי (9:16 / 4:5) — כתוביות גדולות יותר, בשורות קצרות
PORTRAIT_LINE = 24


def rewrap(lines, mx=PORTRAIT_LINE, most=3):
    """שורות קצרות לווידאו אנכי: מילים ברצף עד mx תווים, עד most שורות (יותר — מגדילים את הרוחב)."""
    words = ' '.join(lines).split()
    while True:
        out, cur = [], ''
        for w in words:
            if cur and len(cur) + 1 + len(w) > mx:
                out.append(cur)
                cur = w
            else:
                cur = (cur + ' ' + w).strip()
        if cur:
            out.append(cur)
        if len(out) <= most or mx > 80:
            return out
        mx += 4


# סבב 5: עיצוב הכתוביות — **זהה ל־normSty בטלפון (studioplay.js) ובשרתון (lib/studio.js)**.
# k גודל (70–150%), c צבע (w/y/c), bx רקע כהה מאחורי הטקסט, y הרמה מהתחתית (0–40% מהגובה). רק מספרים וקודים — שום טקסט
STY_ASS = {'w': '&H00FFFFFF', 'y': '&H004DE1FF', 'c': '&H00FFE77F'}   # ASS = &HAABBGGRR


def norm_sty(o):
    if not isinstance(o, dict):
        return None
    out = {}
    try:
        k = int(math.floor(float(o.get('k')) / 10 + 0.5)) * 10   # כמו Math.round ב־JS (לא עיגול בנקאי)
    except (TypeError, ValueError, OverflowError):
        k = 100
    if 70 <= k <= 150 and k != 100:
        out['k'] = k
    if o.get('c') in STY_ASS and o.get('c') != 'w':
        out['c'] = o['c']
    if o.get('bx') is True or o.get('bx') == 1:
        out['bx'] = 1
    try:
        y = int(math.floor(float(o.get('y')) + 0.5))
    except (TypeError, ValueError, OverflowError):
        y = 0
    if 0 < y <= 40:
        out['y'] = y
    return out or None


def apply_sty(style, sty):
    """הסגנון של vt + העיצוב → סגנון חדש (dataclass)."""
    import dataclasses
    if not sty:
        return style
    f = (sty.get('k') or 100) / 100
    ch = dict(size=style.size * f, spacing=style.spacing * f, outline=style.outline * f, faux_bold=style.faux_bold * f,
              line_pitch=style.line_pitch * f, primary=STY_ASS[sty.get('c') or 'w'])
    if sty.get('y'):
        ch['bottom_y'] = style.bottom_y - 1080 * sty['y'] / 100
    if sty.get('bx'):
        # רקע: BorderStyle 3 — המסגרת הופכת לקופסה בצבע OutlineColour (שחור שקוף למחצה), והעובי = הריפוד סביב הטקסט
        ch.update(outline=style.size * f * 0.07, outline_colour='&H60000000', faux_bold=0.0, shadow=0.0, blur=0.0,
                  line_pitch=max(style.line_pitch, style.size * 1.22) * f)   # שורות בלי חפיפה של הקופסאות
    return dataclasses.replace(style, **ch)


# סבב 7: כותרת ולוגו — **זהה ל־normOv בטלפון (studioedl.js) ובשרתון**. הכותרת נכנסת רק ל־ASS (libass — עברית נכונה),
# אף פעם לא לפקודה; הלוגו = קובץ שה־job.py כתב (קלט שני של ffmpeg)
OV_T_MAX, OV_LG_MAX, OV_POS = 60, 65536, ('tl', 'tr', 'bl', 'br')
OV_BAD = re.compile('[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069{}\\\\]')
OV_LG_RE = re.compile(r'^data:image/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}\Z')   # \Z — לא $ (שמקבל ירידת שורה בסוף)


def norm_ov(o):
    if not isinstance(o, dict):
        return None
    out = {}
    t = o.get('t')
    t = re.sub(r'\s+', ' ', OV_BAD.sub('', t)).strip()[:OV_T_MAX].strip() if isinstance(t, str) else ''
    if t:
        out['t'] = t
        if o.get('ta') == 5 and o.get('ta') is not True:
            out['ta'] = 5
    lg = o.get('lg')
    if isinstance(lg, str) and len(lg) <= OV_LG_MAX and OV_LG_RE.match(lg):
        out['lg'] = lg
        out['lp'] = o.get('lp') if o.get('lp') in OV_POS else 'tr'
        try:
            ls = int(math.floor(float(o.get('ls')) / 2 + 0.5)) * 2
        except (TypeError, ValueError, OverflowError):
            ls = 0
        out['ls'] = ls if 8 <= ls <= 30 else 14
    return out or None


def title_event(ov, style, W, H, dur):
    """שורת ASS לכותרת בראש התמונה — כל הסרטון או 5 השניות הראשונות"""
    from vt.subs import _ass_escape, _ass_time
    from vt.hebrew import rtl
    st = style.scaled(W, H)
    end = min(dur, 5.0) if ov.get('ta') == 5 else dur
    return 'Dialogue: 2,%s,%s,Main,title,0,0,0,,{\\an8\\pos(%.1f,%.1f)\\fs%.1f}%s' % (
        _ass_time(0), _ass_time(max(0.5, end)), W / 2.0, H * 0.05, st.size * 1.1, _ass_escape(rtl(ov['t'])))


_BOX_RE = re.compile(r'^(Style: (?:Main|Default),.*?,[-\d.]+,0,)1(,[\d.]+,[\d.]+,\d,)', re.M)


def box_ass(text):
    """ASS עם רקע: BorderStyle=1 → 3 בסגנון הראשי (Main / Default)."""
    return _BOX_RE.sub(lambda m: m.group(1) + '3' + m.group(2), text)


def main(argv=None):
    p = argparse.ArgumentParser(description='הפקה מחדש מכתוביות ערוכות (בלי טוקנים)')
    p.add_argument('--src', required=True)
    p.add_argument('--cues', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--name', required=True)
    p.add_argument('--style', default='bold')
    p.add_argument('--want', default='compact')
    p.add_argument('--work', default='')
    p.add_argument('--edl0', default='')         # מ5: החיתוך שלפני התרגום (המקור → ציר הזמן של הכתוביות)
    p.add_argument('--edl', default='')          # מ5: חיתוך חדש על ציר הזמן של הכתוביות
    p.add_argument('--sty', default='')          # סבב 5: עיצוב הכתוביות (JSON — מספרים וקודים בלבד)
    p.add_argument('--ov', default='')           # סבב 7: כותרת (בלי הלוגו עצמו) — JSON
    p.add_argument('--logo', default='')         # סבב 7: קובץ הלוגו (job.py כתב אותו)
    a = p.parse_args(argv)
    import edl as E
    def _e(s):
        try:
            return E.norm_edl(json.loads(s)) if s else None
        except ValueError:
            raise SystemExit('✗ רשימת העריכות פגומה.')
    e0, e1 = _e(a.edl0), _e(a.edl)
    from vt import config as C
    from vt.media import probe
    from vt.render import burn, mux_mkv, small_copy
    from vt.subs import write_ass, write_ass_compat, write_srt, write_vtt
    from vt.util import write_text

    src, od = Path(a.src), Path(a.out)
    od.mkdir(parents=True, exist_ok=True)
    want = [k for k in a.want.split(',') if k in OUTS]
    ec = E.compose_edl(e0, e1)
    logo = Path(a.logo) if a.logo and Path(a.logo).is_file() else None
    try:
        raw = json.loads(a.ov) if a.ov else None
    except ValueError:
        raw = None
    # הלוגו עצמו כבר קובץ — כאן רק הפינה והגודל (norm_ov נותן אותם רק כשיש לוגו: ממלאים מקום)
    ov = norm_ov(dict(raw, lg='data:image/png;base64,AA==') if logo and isinstance(raw, dict) else raw)
    if logo and not ec:                          # לוגו בלי עריכה אחרת — אותו מעבר (קידוד ביניים) כמו עריכה
        ec = {'k': [], 'ar': 'src', 'x': 0.5}
    if ec:
        cut = od / '_cut.mp4'
        print('עריכה: %d קטעים%s%s' % (len(ec['k']) or 1, '' if ec['ar'] == 'src' else ' · ' + ec['ar'],
                                        ''.join(' · ' + f for f in E.EXTRA_REST + E.EXTRA_POS if f in ec)), flush=True)
        E.apply(src, cut, ec, ov=ov, logo=logo)
        src = cut
    info = probe(src)
    v = info.get('video') or {'width': 1920, 'height': 1080}
    W, H = int(v.get('width') or 1920), int(v.get('height') or 1080)
    style = C.STYLES.get(a.style) or C.STYLES[C.DEFAULT_STYLE]
    try:
        sty = norm_sty(json.loads(a.sty)) if a.sty else None
    except ValueError:
        sty = None
    style = apply_sty(style, sty)
    portrait = W < H
    try:
        raw = json.loads(Path(a.cues).read_text(encoding='utf-8-sig'))
    except (OSError, ValueError):
        raise SystemExit('✗ קובץ הכתוביות פגום.')
    if isinstance(raw, dict):
        raw = raw.get('cues')
    if e1 and isinstance(raw, list):           # הכתוביות זזות עם החיתוך שאחרי התרגום
        raw = E.map_cues(e1, [dict(c, start=_num(c.get('start', c.get('s'))), end=_num(c.get('end', c.get('e')))) for c in raw
                              if isinstance(c, dict) and _num(c.get('start', c.get('s'))) is not None and _num(c.get('end', c.get('e'))) is not None])
    if ec and ec.get('sp') and isinstance(raw, list):   # סבב 3: מהירות — הזמנים מתחלקים בה
        raw = E.speed_cues([dict(c, start=_num(c.get('start', c.get('s'))), end=_num(c.get('end', c.get('e')))) for c in raw
                            if isinstance(c, dict) and _num(c.get('start', c.get('s'))) is not None and _num(c.get('end', c.get('e'))) is not None], ec['sp'])
    cues = norm_cues(raw, float(info.get('duration') or 0))
    if not cues:
        raise SystemExit('✗ אין כתוביות תקינות בקובץ.')
    if portrait:
        import dataclasses
        f = PORTRAIT_SCALE
        style = dataclasses.replace(style, size=style.size * f, spacing=style.spacing * f, outline=style.outline * f,
                                    faux_bold=style.faux_bold * f, line_pitch=style.line_pitch * f)
        for c in cues:
            c['lines'] = rewrap(c['lines'])
    print('כתוביות: %d' % len(cues), flush=True)
    fix = box_ass if sty and sty.get('bx') else (lambda t: t)
    if ov and ov.get('t'):                       # סבב 7: הכותרת — שורת ASS נוספת (נצרבת עם הכתוביות)
        tl = title_event(ov, style, W, H, float(info.get('duration') or 0) or 3600.0)
        fix0 = fix
        fix = lambda t: fix0(t).rstrip('\n') + '\n' + tl + '\n'
    write_text(od / 'he.ass', fix(write_ass(cues, style, W, H, a.name)))
    write_text(od / 'he.player.ass', fix(write_ass_compat(cues, style, W, H, a.name)))
    th = ec.get('th') if ec else None
    if th is not None:                           # סבב 7: תמונה ממוזערת — פריים מהתוצאה (לפני הכתוביות)
        import subprocess
        t = min(float(th), max(0.0, float(info.get('duration') or 0) - 0.1)) if info.get('duration') else float(th)
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', '%.2f' % t, '-i', str(src), '-frames:v', '1', '-q:v', '3',
                        str(od / (a.name + '.thumb.jpg'))], check=False)
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
