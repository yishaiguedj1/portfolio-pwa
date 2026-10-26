"""עיצוב הכתוביות (גודל, צבע, רקע, גובה) — משותף לבנייה הרגילה (vt build --sty) ולהפקה מחדש (rerender.py).

26/10/2026: עד היום רק ההפקה מחדש השתמשה בעיצוב, והצריבה הראשונה התעלמה ממה שנבחר בטופס.
"""
import dataclasses
import math
import re

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



_BOX_RE = re.compile(r'^(Style: (?:Main|Default),.*?,[-\d.]+,0,)1(,[\d.]+,[\d.]+,\d,)', re.M)


def box_ass(text):
    """ASS עם רקע: BorderStyle=1 → 3 בסגנון הראשי (Main / Default)."""
    return _BOX_RE.sub(lambda m: m.group(1) + '3' + m.group(2), text)
