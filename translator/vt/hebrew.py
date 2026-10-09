"""טקסט עברי לכתוביות: נרמול, מדידה, שבירת שורות וכיווניות (RTL).

כללי השבירה לפי Netflix Hebrew Timed Text Style Guide: עד 42 תווים בשורה,
עד 2 שורות, שורה אחת כשאפשר, שבירה בנקודה לשונית הגיונית, ועדיפות לצורת
"פירמידה" שבה השורה התחתונה ארוכה יותר (ולא מילה בודדת למעלה).
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

RLM = "‏"
LRM = "‎"
_BIDI = re.compile("[‎‏‪-‮⁦-⁩]")
HEB = re.compile("[֐-׿]")
LATIN = re.compile("[A-Za-z]")
DIGIT = re.compile(r"\d")

# מילים שנצמדות למילה שאחריהן — לא לסיים בהן שורה
BIND_NEXT = {
    "של", "את", "על", "עם", "אל", "מן", "בין", "לא", "אין", "כל", "גם", "רק", "עוד", "הכי",
    "יותר", "פחות", "כמו", "אצל", "בלי", "לפי", "מול", "ליד", "כדי", "אם", "כי", "אבל", "או",
    "אלא", "למרות", "בגלל", "לגבי", "בתוך", "מתוך", "אחרי", "לפני", "עד", "כאשר", "מאז", "בזמן",
    "שום", "איזה", "איזו", "אילו", "כמה", "זאת", "כלומר", "דרך", "בשביל", "בעד", "נגד", "תחת",
    "מעל", "מתחת", "סביב", "לעבר", "אותו", "אותה", "אותם", "אותן", "היה", "היתה", "הייתה",
    "הוא", "היא", "הם", "הן", "אני", "אנחנו", "אתה", "את", "אתם", "אתן", "יש", "אפשר", "צריך",
    "ממש", "די", "פשוט", "באמת", "בדיוק", "אחד", "אחת", "אי", "בכל", "אף",
}
# מילים שפותחות פסוקית — שבירה לפניהן טובה
CONJ_START = {
    "אבל", "אלא", "כי", "כאשר", "בגלל", "למרות", "כדי", "אז", "או", "ולכן", "לכן", "אך", "אולם",
    "שכן", "ואז", "וגם", "אם", "מכיוון", "משום", "ואם", "וכש", "כשאני", "כשאתה", "כשהם",
    "שבו", "שבה", "שבהם", "מה", "איך", "למה", "מתי", "איפה", "ולמה", "ואיך",
}
# יחידות שנצמדות למספר שלפניהן
UNITS = {
    "מיליון", "מיליארד", "טריליון", "אלף", "אלפי", "דולר", "דולרים", "שקל", "שקלים", "אחוז",
    "אחוזים", "שנה", "שנים", "חודשים", "חודש", "ימים", "יום", "שעות", "שעה", "דקות", "דקה",
    "שניות", "אנשים", "עובדים", "לקוחות", "משתמשים", "מדינות", "פעמים", "יורו", "ליש\"ט",
}
_TRAIL_PUNCT = re.compile(r"[,;:.?!…\"']+$")


def strip_bidi(s: str) -> str:
    return _BIDI.sub("", s)


def visible_len(s: str) -> int:
    """אורך לספירת תווים (Netflix): כולל רווחים ופיסוק, בלי סימני כיוון ושבירות."""
    return len(strip_bidi(s).replace("\n", ""))


def normalize_he(text: str) -> str:
    t = strip_bidi(text)
    t = t.replace("\r", "")
    t = re.sub(r"\.{3,}", "…", t)
    t = re.sub(r"[“”„״]", '"', t)
    t = t.replace("’", "'").replace("‘", "'")
    t = re.sub(r"[ \t]+", " ", t)
    t = re.sub(r" +([,.;:?!…])", r"\1", t)
    t = "\n".join(x.strip() for x in t.split("\n"))
    return t.strip()


def has_latin(s: str) -> bool:
    return bool(LATIN.search(s))


def latin_runs(s: str) -> list[str]:
    return re.findall(r"[A-Za-z][A-Za-z0-9&.'\-]*(?:\s+[A-Za-z0-9][A-Za-z0-9&.'\-]*)*", s)


def bare(word: str) -> str:
    return _TRAIL_PUNCT.sub("", word).strip('"\'')


# ---------------------------------------------------------------------------
# מדידת רוחב בפיקסלים לפי הגופן והסגנון
# ---------------------------------------------------------------------------

@lru_cache(maxsize=8)
def _pil_font(path: str, size: int):
    from PIL import ImageFont
    return ImageFont.truetype(path, size=size)


class Measurer:
    """מודד רוחב שורה בפיקסלים כפי ש־libass יצייר אותה (בקירוב טוב)."""

    def __init__(self, font_path: Path, ass_size: float, spacing: float, outline: float):
        # libass (כמו VSFilter) מגדיר את גודל הגופן כך ש־usWinAscent+usWinDescent
        # מטבלת OS/2 = גודל ה־ASS. לכן em = size * unitsPerEm / (winAscent + winDescent).
        from fontTools.ttLib import TTFont
        t = TTFont(str(font_path), lazy=True)
        upem = t["head"].unitsPerEm
        h = 0
        if "OS/2" in t:
            h = t["OS/2"].usWinAscent + t["OS/2"].usWinDescent
        if not h:
            h = t["hhea"].ascent - t["hhea"].descent
        t.close()
        self.em = ass_size * upem / h
        self.font = _pil_font(str(font_path), max(8, int(round(self.em))))
        self.scale = self.em / max(8, int(round(self.em)))
        self.spacing = spacing
        self.outline = outline

    def width(self, line: str) -> float:
        s = strip_bidi(line)
        if not s:
            return 0.0
        w = self.font.getlength(s) * self.scale
        return w + self.spacing * max(len(s) - 1, 0) + 2 * self.outline


# ---------------------------------------------------------------------------
# שבירת שורות
# ---------------------------------------------------------------------------

# שמות עצם שכמעט תמיד בסמיכות עם המילה שאחריהם ("בית ספר", "חברת התעופה")
CONSTRUCT_HEADS = {
    "בית", "בתי", "ראש", "ראשי", "יום", "ימי", "שנת", "שנות", "חברת", "חברות", "מנהל", "מנהלי",
    "בעל", "בעלי", "סוג", "סוגי", "כמות", "רוב", "חלק", "סוף", "תחילת", "אמצע", "עולם", "מועצת",
    "שירותי", "ערוצי", "עובדי", "מנויי", "צופי", "תעשיית", "מערכת", "מחלקת", "קבוצת", "רשת", "רשתות",
}
# מילים שמתחילות ב־ו שאינה ו׳ החיבור
VAV_WORDS = {"וידאו", "ויכוח", "ועדה", "ועד", "וירוס", "ויזה", "ולנטיין", "וושינגטון", "ויקיפדיה",
             "וטרינר", "ויטמין", "וילה", "ויסות", "ויתור", "ותיק", "ותק", "ורד", "ורוד", "וינה", "ויקי"}
DEMONSTRATIVES = {"האלה", "האלו", "הזה", "הזאת", "הזו", "ההוא", "ההיא", "ההם", "ההן"}
# מילות יחס שפותחות צירוף — שבירה לפניהן טבעית
PREP_START = {"דרך", "על", "עם", "של", "בלי", "אצל", "לפי", "מול", "בגלל", "כמו", "עד", "אחרי", "לפני",
              "בתוך", "מתוך", "בזמן", "בשביל", "לגבי", "בין", "מאז", "למען", "כלפי", "לעומת"}
# מילות עצימה — שבירה לפניהן מפרקת שם עצם מהתואר שלו ("הנחיות | די מפתיעות")
INTENSIFIERS = {"די", "ממש", "הכי", "קצת", "כה", "מאוד", "יותר", "פחות"}
# צירופים קבועים שאסור לפרק בין שורות
FIXED_BIGRAMS = {("אי", "אפשר"), ("בדרך", "כלל"), ("בכל", "זאת"), ("כל", "כך"), ("יותר", "מדי"),
                 ("בית", "ספר"), ("בתי", "ספר"), ("בכל", "מקרה"), ("אף", "אחד"), ("אף", "פעם"),
                 ("בסופו", "של"), ("על", "ידי"), ("בני", "אדם"), ("בן", "אדם"), ("לא", "רק"), ("כמו", "כן")}
POSSESSIVES = {"שלי", "שלך", "שלו", "שלה", "שלנו", "שלכם", "שלכן", "שלהם", "שלהן"}
CLITICS = {"בה", "בו", "בהם", "בהן", "לו", "לה", "להם", "להן", "לי", "לנו", "לך", "לכם", "אותו", "אותה",
           "אותם", "אותי", "אותנו", "אליהם", "אליו", "אליה", "אלינו", "אליי", "ממנו", "ממנה", "מהם"}
REL_SUBJECTS = {"שהם", "שהן", "שאני", "שאנחנו", "שאתה", "שאתם", "שהוא", "שהיא", "שאת"}
NUM_NOUN_HEADS = {"מיליון", "מיליארד", "טריליון", "אלף", "אלפי", "מאות", "עשרות", "מאה", "מאתיים"}
_NUMBER_WORDS = {w for ws in (
    {"אחד", "אחת"}, {"שניים", "שתיים", "שני", "שתי"}, {"שלושה", "שלוש"}, {"ארבעה", "ארבע"},
    {"חמישה", "חמש"}, {"שישה", "שש"}, {"שבעה", "שבע"}, {"שמונה"}, {"תשעה", "תשע"}, {"עשרה", "עשר"})
    for w in ws}


def _break_cost(top: list[str], bottom: list[str], n_total: int, shape: bool = True) -> float:
    """עלות שבירה בין top[-1] ל־bottom[0]: תחביר קודם, צורת הפירמידה אחר כך.

    הכללים (Netflix + נוהג כתוביות בעברית): לשבור אחרי פיסוק, לפני מילת קישור
    או ו׳ החיבור; לא לפרק סמיכות ("הזמנת | התוכן"), מספר מהנספר ("6 מיליון | מנויים"),
    שם עצם מהתואר שלו ("החלטות | טובות"), מילת יחס מהמילה שאחריה.
    """
    a, b = top[-1], bottom[0]
    ba, bb = bare(a), bare(b)
    punct_end = bool(re.search(r"[,;:.?!…—–]$", a))
    cost = 0.0
    if re.search(r"[.?!…]$", a):
        cost -= 4.0
    elif re.search(r"[,;:]$", a) or a.endswith("—") or a.endswith("–"):
        cost -= 3.0
    if ba in BIND_NEXT:
        cost += 6.0
    if bb in CONJ_START or (b.startswith("ו") and bare(b[1:]) in CONJ_START):
        cost -= 1.5
    elif b.startswith("ו") and len(bb) > 2 and bb not in VAV_WORDS and not punct_end:
        cost -= 0.75                       # לפני ו׳ החיבור — שבירה סבירה
    elif bb in PREP_START and not punct_end:
        cost -= 1.0                        # לפני צירוף יחס
    if not punct_end:
        if DIGIT.search(a) and not re.search(r"%$", ba):
            cost += 8.0 if bb in UNITS else 5.0           # מספר | הנספר
        if ba in NUM_NOUN_HEADS or ba in _NUMBER_WORDS:
            cost += 6.0                                    # "חמישה | כוכבים", "מיליון | מנויים"
        if ba in CONSTRUCT_HEADS:
            cost += 6.0
        elif len(ba) > 2 and len(bb) > 2 and bb.startswith("ה") and (ba.endswith("ת") or ba.endswith("י")):
            cost += 4.0                                    # סמיכות: "הזמנת | התוכן", "ערוצי | הכבלים"
        if (len(ba) > 2 and len(bb) > 2 and ba.startswith("ה") and bb.startswith("ה")
                and ba not in BIND_NEXT and ba not in DEMONSTRATIVES):
            cost += 2.5                                    # שם מיודע + תואר מיודע
        for suf in ("ות", "ים"):
            if len(ba) > 3 and len(bb) > 3 and ba.endswith(suf) and bb.endswith(suf) and not bb.startswith("ו"):
                cost += 1.5                                # "החלטות | טובות" (או נושא + בינוני — לכן חלש)
                break
        if bb in INTENSIFIERS:
            cost += 2.0
        if bb == "את":
            cost += 1.5                                    # פועל | מושא
        if bb in CLITICS:
            cost += 3.0                                    # כינוי שנצמד לפועל: "מקבלים | בה"
        if bb in POSSESSIVES or bb in DEMONSTRATIVES:
            cost += 5.0                                    # "האלגוריתם | שלכם", "לסרטים | האלה"
        if (ba, bb) in FIXED_BIGRAMS:
            cost += 9.0                                    # "אי | אפשר", "בדרך | כלל"
        if ba == "מה" and bb.startswith("ש"):
            cost += 6.0                                    # "מה | שמאפשר"
        if ba in REL_SUBJECTS:
            cost += 4.0                                    # "שהם | מקבלים"
    if has_latin(a) and has_latin(b) and not re.search(r"[,.;:?!]$", a):
        cost += 6.0  # לא לפצל שם/מונח לועזי
    if a.endswith("־") or b.startswith("־"):
        cost += 10.0
    if a.count('"') % 2 == 1 and " ".join(top).count('"') % 2 == 1:
        cost += 4.0                                        # שבירה בתוך מירכאות
    if not shape:
        return cost
    lt, lb = len(" ".join(top)), len(" ".join(bottom))
    if lt > lb:
        cost += (lt - lb) * 0.2           # עדיפות לשורה תחתונה ארוכה יותר
    cost += abs(lt - lb) * 0.05
    if min(lt, lb) < 0.35 * max(lt, lb):
        cost += 2.5                       # שורה קצרצרה מול ארוכה — נראה שבור
    if len(top) == 1 and n_total > 3:
        cost += 3.0
    if len(bottom) == 1 and n_total > 3:
        cost += 2.0
    return cost


def break_lines(text: str, max_chars: int = 42, measure: Measurer | None = None,
                max_px: float | None = None) -> tuple[list[str], bool]:
    """מחזיר (שורות, תקין). אם אין דרך לעמוד במגבלות — מחזיר את הטוב ביותר עם תקין=False.

    שבירה ידנית: '|' בטקסט קובע את נקודת השבירה.
    """
    text = normalize_he(text)
    if "|" in text:
        parts = [p.strip() for p in text.split("|") if p.strip()]
        lines = parts[:2] if len(parts) <= 2 else [parts[0], " ".join(parts[1:])]
        return lines, _fits(lines, max_chars, measure, max_px)
    if "\n" in text:
        lines = [x.strip() for x in text.split("\n") if x.strip()]
        if len(lines) <= 2:
            return lines, _fits(lines, max_chars, measure, max_px)
        text = " ".join(lines)
    if _fits([text], max_chars, measure, max_px):
        return [text], True
    toks = text.split(" ")
    if len(toks) < 2:
        return [text], False
    best, best_cost, best_ok = None, 1e9, False
    for i in range(1, len(toks)):
        top, bottom = toks[:i], toks[i:]
        lines = [" ".join(top), " ".join(bottom)]
        ok = _fits(lines, max_chars, measure, max_px)
        c = _break_cost(top, bottom, len(toks))
        if not ok:
            over = max(visible_len(x) for x in lines) - max_chars
            c += 1000 + max(over, 0) * 10
        if c < best_cost:
            best, best_cost, best_ok = lines, c, ok
    return best, best_ok


def _fits(lines: list[str], max_chars: int, measure: Measurer | None, max_px: float | None) -> bool:
    for ln in lines:
        if visible_len(ln) > max_chars:
            return False
        if measure is not None and max_px is not None and measure.width(ln) > max_px:
            return False
    return True


def dual_lines(a: str, b: str) -> list[str]:
    """שני דוברים בכתובית אחת: מקף צמוד (בלי רווח) לדובר השני בלבד — נטפליקס־עברית.
    (עד 10/10/2026 היה מקף לשני הדוברים — הנוהג הישן; המדריך העברי של נטפליקס קובע רק לשני.)"""
    return [normalize_he(a).lstrip("-– "), "-" + normalize_he(b).lstrip("-– ")]


def rtl(line: str) -> str:
    """סימן RLM בתחילת השורה קובע כיוון בסיס מימין לשמאל גם כשהשורה מתחילה
    במילה לועזית או במספר — כך הפיסוק לא "קופץ" לצד הלא נכון."""
    return RLM + strip_bidi(line)


# ---------------------------------------------------------------------------
# מספרים — לבדיקת התאמה בין אנגלית לעברית
# ---------------------------------------------------------------------------

HE_NUMBER_WORDS = {
    1: {"אחד", "אחת"}, 2: {"שניים", "שתיים", "שני", "שתי", "שנים", "זוג"}, 3: {"שלושה", "שלוש"},
    4: {"ארבעה", "ארבע"}, 5: {"חמישה", "חמש"}, 6: {"שישה", "שש"}, 7: {"שבעה", "שבע"},
    8: {"שמונה"}, 9: {"תשעה", "תשע"}, 10: {"עשרה", "עשר"},
}


def numbers_in(text: str) -> list[str]:
    """מספרים בטקסט, מנורמלים (בלי פסיקי אלפים)."""
    nums = re.findall(r"\d[\d,]*(?:\.\d+)?", text)
    return [n.replace(",", "").rstrip(".") for n in nums]


def number_ok_in_he(num: str, he: str) -> bool:
    he_nums = numbers_in(he)
    if num in he_nums:
        return True
    try:
        v = float(num)
    except ValueError:
        return True
    if v.is_integer() and 1 <= v <= 10:
        words = set(re.findall(r"[א-ת]+", he))
        bare_words = {w[1:] if w[:1] in "והבלמשכ" else w for w in words} | words
        if HE_NUMBER_WORDS[int(v)] & bare_words:
            return True
    # 1,000 → "אלף", ‏1,000,000 → "מיליון" וכו'
    if v.is_integer():
        iv = int(v)
        for base, word in ((1_000_000_000_000, "טריליון"), (1_000_000_000, "מיליארד"),
                           (1_000_000, "מיליון"), (1000, "אלף")):
            if iv % base == 0 and iv // base in range(1, 1000):
                if word in he and (str(iv // base) in he_nums or iv // base == 1):
                    return True
    return False
