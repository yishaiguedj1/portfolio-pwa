"""קבועים והגדרות: כללי תזמון (Netflix), כללי עברית, וסגנונות הכתוביות.

כל ערכי הסגנון מוגדרים לווידאו בגובה 1080 ומוכפלים לפי הרזולוציה בפועל.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FONTS_DIR = ROOT / "fonts"
GLOSSARY_DIR = ROOT / "glossary"
GUIDES_DIR = ROOT / "guides"
TEMPLATES_DIR = ROOT / "templates"

# ---------------------------------------------------------------------------
# כללי תזמון — מבוססים על Netflix Timed Text Style Guide (כללי והנחיות התזמון)
# ---------------------------------------------------------------------------

@dataclass
class TimingRules:
    min_gap_frames: int = 2          # מרווח מינימלי בין כתוביות
    chain_gap_s: float = 0.5         # מרווח קצר מזה נסגר ל־2 פריימים (שרשור)
    linger_s: float = 0.5            # כמה זמן מותר להשאיר כתובית אחרי סוף הדיבור
    min_dur_s: float = 5.0 / 6.0     # משך מינימלי (20 פריימים ב־24fps)
    max_dur_s: float = 7.0           # משך מקסימלי
    lead_frames: int = 1             # הקדמה קלה לפני תחילת הדיבור (עד 1–2 פריימים)
    shot_zone_s: float = 0.5         # "חצי שנייה" סביב חילוף שוט
    shot_red_s: float = 0.3          # אזור אדום (~7 פריימים ב־24fps)
    cps_max: float = 17.0            # קצב קריאה מקסימלי למבוגרים (עברית)
    cps_target: float = 15.0         # קצב נוח — מטרה לתכנון


# ---------------------------------------------------------------------------
# כללי טקסט בעברית — Netflix Hebrew Timed Text Style Guide
# ---------------------------------------------------------------------------

@dataclass
class TextRules:
    max_chars_line: int = 42
    max_lines: int = 2
    he_en_ratio: float = 0.9         # הערכת אורך עברית ביחס לאנגלית לתכנון


# ---------------------------------------------------------------------------
# סגנונות תצוגה
# ---------------------------------------------------------------------------

@dataclass
class Style:
    name: str
    font: str                 # שם המשפחה כפי ש־libass רואה אותו
    font_file: str            # קובץ בתיקיית fonts/
    bold: int                 # 1 = מודגש (לפי קובץ הגופן)
    size: float               # גודל ASS (≈ גובה שורה) ב־1080p
    spacing: float            # ריווח בין אותיות
    outline: float            # עובי מסגרת שחורה
    faux_bold: float          # העבות אותיות בשכבה לבנה נוספת (0 = כבוי)
    blur: float               # ריכוך קצה המסגרת
    shadow: float             # צל (0 = בלי)
    shadow_alpha: int         # שקיפות הצל 0–255 (0 = אטום)
    line_pitch: float         # מרחק בין שורות (מבסיס לבסיס) ב־1080p
    bottom_y: float           # מיקום תחתית השורה התחתונה ב־1080p
    margin_x: float           # שוליים מכל צד ב־1080p (לבדיקת רוחב)
    primary: str = "&H00FFFFFF"   # לבן
    outline_colour: str = "&H00000000"  # שחור

    def scaled(self, width: int, height: int) -> "ScaledStyle":
        s = min(width / 1920.0, height / 1080.0)
        return ScaledStyle(self, s, width, height)

    def to_dict(self):
        return asdict(self)


@dataclass
class ScaledStyle:
    base: Style
    k: float
    width: int
    height: int

    def __getattr__(self, item):
        v = getattr(self.base, item)
        if item in ("size", "spacing", "outline", "faux_bold", "blur", "shadow",
                    "line_pitch", "margin_x"):
            return v * self.k
        if item == "bottom_y":
            # המרחק מתחתית המסך נשמר יחסית לגובה
            return self.height - (1080.0 - v) * self.k
        return v

    @property
    def max_line_px(self) -> float:
        return self.width - 2 * self.margin_x


STYLES: dict[str, Style] = {
    # ברירת המחדל — לפי התמונה שהמשתמש בחר: לבן, עבה מאוד, מסגרת שחורה עבה ורכה.
    # כויל בפיקסלים מול הדוגמה: רוחב שורה, גובה אותיות, מרווח שורות ומיקום.
    "bold": Style(
        name="bold", font="Arimo", font_file="Arimo-Bold.ttf", bold=1,
        size=88, spacing=3.5, outline=9.0, faux_bold=2.0, blur=1.2,
        shadow=0.0, shadow_alpha=0, line_pitch=74, bottom_y=1012, margin_x=100,
    ),
    # חלופה עדינה בסגנון Netflix: SemiBold, מסגרת דקה וצל רך.
    "classic": Style(
        name="classic", font="Assistant SemiBold", font_file="Assistant-SemiBold.ttf",
        bold=0, size=58, spacing=0.0, outline=3.2, faux_bold=0.0, blur=0.6,
        shadow=1.5, shadow_alpha=96, line_pitch=58, bottom_y=1010, margin_x=150,
    ),
}

DEFAULT_STYLE = "bold"

TIMING = TimingRules()
TEXT = TextRules()


@dataclass
class ProjectSettings:
    """הגדרות פר־ראיון (נשמרות ב־project.json)."""
    style: str = DEFAULT_STYLE
    timing: dict = field(default_factory=dict)   # דריסות ל־TimingRules
    text: dict = field(default_factory=dict)     # דריסות ל־TextRules


def timing_rules(overrides: dict | None = None) -> TimingRules:
    r = TimingRules()
    for k, v in (overrides or {}).items():
        if hasattr(r, k):
            setattr(r, k, type(getattr(r, k))(v))
    return r


def text_rules(overrides: dict | None = None) -> TextRules:
    r = TextRules()
    for k, v in (overrides or {}).items():
        if hasattr(r, k):
            setattr(r, k, type(getattr(r, k))(v))
    return r
