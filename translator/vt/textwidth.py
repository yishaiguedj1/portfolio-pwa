"""רוחב שורה בפיקסלים בלי PIL (25/10/2026, שלב 3 של "תרגום בטלפון").

בטלפון vt רץ בפייתון של youtubedl-android — ספרייה סטנדרטית בלבד. hebrew.Measurer מודד שם דרך המודול הזה, מתוך
fonts/metrics.json (tools/fontmetrics.py), ומחזיר בדיוק את מה ש־PIL מחזיר בתמונת העובד: שם אין fribidi, ו־PIL
בפריסה הבסיסית — סכום הרוחבים של התווים (אחרי hinting, שלמים), בלי קרנינג ובלי bidi. tests/test_textwidth.py משווה.
תו שלא בטבלה (נדיר — מחוץ לטווחים של כתוביות) — לפי היחידות בגופן בלי hinting, בקירוב של פיקסל.
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / 'fonts' / 'metrics.json'


@lru_cache(maxsize=1)
def table() -> dict:
    return json.loads(DATA.read_text(encoding='utf-8'))


def _base(units: int, size: int, upem: int) -> int:
    return (units * size * 2 + upem) // (2 * upem)


class Font:
    """getlength(s) כמו ImageFont.FreeTypeFont בפריסה הבסיסית, בגודל שלם אחד."""

    def __init__(self, d: dict, size: int, zero: int, sizes):
        upem = d['upem']
        lo, hi = sizes
        k = size - lo if lo <= size <= hi else -1
        row = d['w'][str(size)] if k >= 0 else None
        self.w = {ch: _base(d['units'][i], size, upem) + (ord(row[i]) - zero if row else 0)
                  for i, ch in enumerate(d['chars'])}
        self.nd = _base(d['nd'], size, upem) + (ord(d['ndw'][k]) - zero if k >= 0 else 0)
        self.size, self.upem, self.more = size, upem, d['more']

    def getlength(self, s: str) -> float:
        w = self.w
        total = 0
        for ch in s:
            v = w.get(ch)
            if v is None:
                u = self.more.get(str(ord(ch)))
                v = self.nd if u is None else _base(u, self.size, self.upem)
                w[ch] = v
            total += v
        return float(total)


@lru_cache(maxsize=16)
def font(file_name: str, size: int) -> Font | None:
    try:
        t = table()
    except (OSError, ValueError):
        return None
    d = t.get('fonts', {}).get(file_name)
    return Font(d, size, t['zero'], t['sizes']) if d else None


def em_height(file_name: str) -> tuple[int, int] | None:
    """(unitsPerEm, ‏winAscent + winDescent) — מה ש־Measurer לוקח מ־fontTools."""
    try:
        d = table()['fonts'][file_name]
    except (OSError, ValueError, KeyError):
        return None
    return d['upem'], d['h']
