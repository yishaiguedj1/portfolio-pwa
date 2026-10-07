"""vt — צינור תרגום ראיונות וידאו מאנגלית לעברית, ברמת כתוביות מקצועיות.

השלבים: קליטה ← תמלול ← הגהה ← יישור כפוי ← תכנון כתוביות ← תרגום (בסשן)
← בנייה ותזמון לפי כללי Netflix ← בקרת איכות ← צריבה / כתוביות רכות.
"""

__version__ = "1.3.1"

# ffmpeg עדכני (בנייה סטטית עם SVT-AV1 4.x ו־libvmaf) מותקן ע״י setup.sh ל־.bin/ — קודם ב־PATH,
# כך שכל הפקודות ("ffmpeg"/"ffprobe") משתמשות בו, כולל libass אחד לצריבה, לציור מראש ולתמונות הבדיקה.
import os as _os
from pathlib import Path as _Path

_BIN = _Path(__file__).resolve().parent.parent / ".bin"
if _BIN.is_dir() and str(_BIN) not in _os.environ.get("PATH", "").split(_os.pathsep):
    _os.environ["PATH"] = str(_BIN) + _os.pathsep + _os.environ.get("PATH", "")
