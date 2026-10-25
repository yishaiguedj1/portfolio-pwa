#!/usr/bin/env python3
"""טבלת הרוחבים של גופני הכתוביות (25/10/2026, שלב 3 של "תרגום בטלפון").

בטלפון אין PIL ואין fontTools (הפייתון של youtubedl-android — ספרייה סטנדרטית בלבד), ו־vt build מודד כל שורה בפיקסלים
(hebrew.Measurer: ‏PIL getlength). בתמונת העובד אין fribidi, ולכן PIL שם מודד בפריסה הבסיסית (Layout.BASIC — בלי
HarfBuzz): רוחב השורה = סכום הרוחבים של התווים אחרי hinting (מספרים שלמים), בלי קרנינג (בגופנים אין טבלת kern) ובלי
bidi. הכלי מוציא את הרוחב של כל תו בכל גודל שלם (כמו ש־PIL הבסיסי מחזיר) ל־translator/fonts/metrics.json, ו־
vt/textwidth.py מסכם ממנו את אותו רוחב בלי ספריות.

אחסון: לכל גודל — מחרוזת עם תו לכל תו בטבלה: ההפרש מהעיגול הפשוט (round(יחידות × גודל / upem)) + 'O' (‏'O' = 0).

הרצה (צריך pillow ו־fonttools — אותה pillow של תמונת העובד, ‏12.3.0):
    python3 tools/fontmetrics.py            # כותב את הקובץ
    python3 tools/fontmetrics.py --check    # רק בודק שהקובץ מעודכן
גופן חדש / גרסה חדשה של גופן / Pillow אחר בתמונה = להריץ שוב (translator/tests/test_textwidth.py נכשל אחרת).
"""
import hashlib
import json
import sys
from pathlib import Path

from fontTools.ttLib import TTFont
from PIL import Image, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / 'translator' / 'fonts'
OUT = FONTS / 'metrics.json'
FILES = ('Arimo-Bold.ttf', 'Assistant-SemiBold.ttf')
SIZES = (8, 320)               # הגדלים השלמים ש־Measurer מבקש מ־PIL (em מעוגל, לפחות 8); מעל — העיגול הפשוט
ZERO = ord('O')

# התווים שכתוביות מכילות בפועל (תו אחר — העיגול הפשוט, בקירוב)
RANGES = [(0x20, 0x7E), (0xA0, 0x17F), (0x0300, 0x036F), (0x0591, 0x05F4), (0x2010, 0x2027), (0x2030, 0x203A),
          (0x20AA, 0x20AC), (0x2116, 0x2122), (0x2190, 0x2193), (0xFB1D, 0xFB4F)]


def base(units, size, upem):
    return (units * size * 2 + upem) // (2 * upem)       # round(units × size / upem), חצי למעלה


def font_data(fn):
    path = FONTS / fn
    t = TTFont(str(path))
    upem = t['head'].unitsPerEm
    h = 0
    if 'OS/2' in t:
        h = t['OS/2'].usWinAscent + t['OS/2'].usWinDescent
    if not h:
        h = t['hhea'].ascent - t['hhea'].descent
    cmap = t.getBestCmap()
    hm = t['hmtx'].metrics
    chars = [c for a, b in RANGES for c in range(a, b + 1) if c in cmap]
    units = [hm[cmap[c]][0] for c in chars]
    nd = hm['.notdef'][0]
    per = {}
    for size in range(SIZES[0], SIZES[1] + 1):
        pf = ImageFont.truetype(str(path), size, layout_engine=ImageFont.Layout.BASIC)
        row = []
        for c, u in zip(chars, units):
            w = pf.getlength(chr(c))
            if w != int(w):
                raise SystemExit('✗ רוחב לא שלם (' + fn + ' ' + hex(c) + ') — PIL לא בפריסה הבסיסית?')
            d = int(w) - base(u, size, upem)
            if not -40 <= d <= 40:
                raise SystemExit('✗ הפרש גדול מדי (' + fn + ' ' + hex(c) + ' ' + str(size) + ')')
            row.append(chr(ZERO + d))
        per[str(size)] = ''.join(row)
    # תו שלא בגופן — PIL מצייר את ‎.notdef (גליף 0)
    nd_row = ''
    for size in range(SIZES[0], SIZES[1] + 1):
        pf = ImageFont.truetype(str(path), size, layout_engine=ImageFont.Layout.BASIC)
        nd_row += chr(ZERO + int(pf.getlength('\U0010FFFD')) - base(nd, size, upem))
    return {'file': fn, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'upem': upem, 'h': h,
            'chars': ''.join(chr(c) for c in chars), 'units': units, 'nd': nd, 'ndw': nd_row,
            'more': {str(c): hm[g][0] for c, g in sorted(cmap.items()) if c not in set(chars)}, 'w': per}


def build():
    return {'v': 1, 'pillow': Image.__version__, 'sizes': list(SIZES), 'zero': ZERO,
            'fonts': {fn: font_data(fn) for fn in FILES}}


def main():
    data = json.dumps(build(), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
    if '--check' in sys.argv:
        ok = OUT.exists() and OUT.read_text(encoding='utf-8') == data
        print('✓ metrics.json מעודכן' if ok else '✗ metrics.json לא מעודכן — python3 tools/fontmetrics.py')
        return 0 if ok else 1
    OUT.write_text(data, encoding='utf-8')
    print('✓ נכתב ' + str(OUT) + ' (' + str(len(data.encode('utf-8')) // 1024) + 'KB)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
