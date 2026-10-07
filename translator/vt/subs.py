"""כתיבת קבצי כתוביות: ASS (לצריבה ולנגנים מתקדמים), SRT ו־VTT.

ב־ASS כל שורה היא אירוע נפרד במיקום מדויק (‎\\an2\\pos‎), כדי לשלוט במרווח
בין השורות ובמיקום — בדיוק כמו בסגנון שנבחר. בסגנון "bold" יש שתי שכבות:
שכבה 0 = טקסט עם מסגרת שחורה עבה ורכה, שכבה 1 = אותו טקסט עם "מסגרת" לבנה
דקה שמעבה את האותיות. Encoding=-1 + סימן RLM בתחילת כל שורה = כיוון RTL תקין.
"""

from __future__ import annotations

from .config import Style
from .hebrew import rtl
from .util import FrameGrid, floor_unit


def _ass_time(t: float) -> str:
    t = max(0.0, floor_unit(t, 0.01))
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _srt_time(t: float) -> str:
    t = max(0.0, floor_unit(t, 0.001))
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _vtt_time(t: float) -> str:
    return _srt_time(t).replace(",", ".")


def _ass_escape(s: str) -> str:
    return s.replace("\\", "＼").replace("{", "(").replace("}", ")")


def _alpha_colour(alpha: int, bgr: str = "000000") -> str:
    return f"&H{alpha:02X}{bgr}"


def write_ass(cues: list[dict], style: Style, width: int, height: int, title: str = "") -> str:
    st = style.scaled(width, height)
    x = width / 2.0
    k = st.k
    head = [
        "[Script Info]",
        f"Title: {title}",
        "ScriptType: v4.00+",
        f"PlayResX: {width}",
        f"PlayResY: {height}",
        "WrapStyle: 2",
        "ScaledBorderAndShadow: yes",
        "YCbCr Matrix: None",
        "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        (f"Style: Main,{style.font},{st.size:.1f},{style.primary},{style.primary},"
         f"{style.outline_colour},{_alpha_colour(style.shadow_alpha)},{style.bold},0,0,0,100,100,"
         f"{st.spacing:.2f},0,1,{st.outline:.2f},{st.shadow:.2f},2,0,0,0,-1"),
        (f"Style: Fill,{style.font},{st.size:.1f},{style.primary},{style.primary},"
         f"{style.primary},&H00000000,{style.bold},0,0,0,100,100,"
         f"{st.spacing:.2f},0,1,{st.faux_bold:.2f},0,2,0,0,0,-1"),
        "",
        "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    ev = []
    for c in cues:
        lines = c["lines"]
        a, b = _ass_time(c["start"]), _ass_time(c["end"])
        n = len(lines)
        for li, line in enumerate(lines):
            y = st.bottom_y - (n - 1 - li) * st.line_pitch
            txt = _ass_escape(rtl(line))
            tag = f"{{\\an2\\pos({x:.1f},{y:.1f})" + (f"\\blur{st.blur:.2f}" if st.blur > 0 else "") + "}"
            ev.append(f"Dialogue: 0,{a},{b},Main,{c['id']},0,0,0,,{tag}{txt}")
            if st.faux_bold > 0:
                ev.append(f"Dialogue: 1,{a},{b},Fill,{c['id']},0,0,0,,{{\\an2\\pos({x:.1f},{y:.1f})}}{txt}")
    _ = k
    return "\n".join(head + ev) + "\n"


def write_ass_compat(cues: list[dict], style: Style, width: int, height: int, title: str = "") -> str:
    """ASS לנגנים (רצועה רכה ב־MKV): אירוע אחד לכל כתובית, שתי השורות יחד (\\N), בלי \\pos ובלי שכבה כפולה.

    למה: הקובץ לצריבה בנוי משורות נפרדות במיקום מוחלט ומשכבת העבות — libass מצייר אותו מושלם,
    אבל נגנים רבים (מבוססי ExoPlayer, נגני טלוויזיה, נגנים שמתעלמים מ־\\pos או מציגים אירוע אחד
    בכל פעם) הציגו רק חלק מהכתובית או כפילויות. כאן כל כתובית היא יחידה אחת, כמו ב־SRT, עם אותו
    גופן, גודל ומסגרת. ההבדל היחיד מהצריבה: מרווח השורות הטבעי של הגופן, ובלי שכבת ההעבות.
    """
    st = style.scaled(width, height)
    margin_v = max(0, int(round(height - st.bottom_y)))
    margin_x = int(round(st.margin_x))
    head = [
        "[Script Info]", f"Title: {title}", "ScriptType: v4.00+", f"PlayResX: {width}", f"PlayResY: {height}",
        "WrapStyle: 2", "ScaledBorderAndShadow: yes", "YCbCr Matrix: None", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        (f"Style: Default,{style.font},{st.size:.1f},{style.primary},{style.primary},"
         f"{style.outline_colour},{_alpha_colour(style.shadow_alpha)},{style.bold},0,0,0,100,100,"
         f"{st.spacing:.2f},0,1,{st.outline:.2f},{st.shadow:.2f},2,"
         f"{margin_x},{margin_x},{margin_v},-1"),
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    blur = f"{{\\blur{st.blur:.2f}}}" if st.blur > 0 else ""
    ev = [f"Dialogue: 0,{_ass_time(c['start'])},{_ass_time(c['end'])},Default,,0,0,0,,"
          + blur + "\\N".join(_ass_escape(rtl(x)) for x in c["lines"]) for c in cues]
    return "\n".join(head + ev) + "\n"


def write_srt(cues: list[dict], with_rlm: bool = True, key: str = "lines") -> str:
    out = []
    for n, c in enumerate(cues, start=1):
        lines = c[key] if isinstance(c[key], list) else [c[key]]
        if with_rlm:
            lines = [rtl(x) for x in lines]
        out.append(f"{n}\n{_srt_time(c['start'])} --> {_srt_time(c['end'])}\n" + "\n".join(lines) + "\n")
    return "\n".join(out)


def write_vtt(cues: list[dict], with_rlm: bool = True) -> str:
    out = ["WEBVTT", ""]
    for n, c in enumerate(cues, start=1):
        lines = [rtl(x) for x in c["lines"]] if with_rlm else c["lines"]
        out.append(f"{n}\n{_vtt_time(c['start'])} --> {_vtt_time(c['end'])}\n" + "\n".join(lines) + "\n")
    return "\n".join(out)


def frame_check(cues: list[dict], grid: FrameGrid) -> list[str]:
    """בדיקה שהזמנים שנכתבו לקובץ אכן מציגים בדיוק את הפריימים שתוכננו."""
    issues = []
    for c in cues:
        for unit, name in ((0.01, "ass"), (0.001, "srt")):
            s = floor_unit(c["start"], unit)
            e = floor_unit(c["end"], unit)
            first = grid.frame_ceil(s)
            last_excl = grid.frame_ceil(e)
            if first != c["fi"] or last_excl != c["fo"]:
                issues.append(f"#{c['id']} {name}: frames {first}-{last_excl} != {c['fi']}-{c['fo']}")
    return issues
