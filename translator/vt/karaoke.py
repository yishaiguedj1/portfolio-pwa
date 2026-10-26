"""קריוקי משיר רגיל (26/10/2026, בעקבות המחקר "קריוקי משיר רגיל") — הלוגיקה הטהורה, בלי מודלים.

הצינור (translator/karaoke.py מפעיל): הפרדת קול → המילים שהמשתמש הדביק → עיגון לתמלול של הקול המופרד
(Parakeet) → יישור כפוי לכל מילה (Qwen) → כתוביות שבהן כל מילה נצבעת כשהיא נשמעת.

למה מילה שלמה ולא \\kf (מילוי הדרגתי): libass ממלא \\kf תמיד משמאל לימין, גם בעברית (libass #406, #221),
ו־vt/overlay.py מצייר כל קטע זמן פעם אחת — אירוע \\kf היה נתקע בפריים הראשון. כאן כל מצב ("עד המילה הזו
נשמע") הוא אירוע נפרד: הכיוון נכון בכל שפה, וההלבשה המהירה עובדת כמו שהיא.
"""

from __future__ import annotations

import difflib
import re
import unicodedata

LEAD_S = 0.6          # השורה מופיעה לפני המילה הראשונה שלה
PRE_MAX_S = 4.0       # השורה הבאה מופיעה מראש לכל היותר כך
HOLD_S = 0.5          # השורה נשארת אחרי המילה האחרונה
COUNT_GAP_S = 4.0     # שקט כזה לפני שורה = נקודות ספירה לאחור
COUNT_S = 3.0         # שלוש נקודות, אחת לשנייה
WORD_S = 0.35         # מילה בלי עיגון (לפני / אחרי כל העוגנים)
MAX_LINE_CHARS = 42   # שורת שיר ארוכה מזה מתפצלת לשתיים
SUNG = "&H0000D7FF"   # צהוב־זהב (ASS = &HAABBGGRR)
UNSUNG = "&H00FFFFFF"
LYR_MAX = 8000        # תווים (= KA_LYR_MAX בשרתון)

_SECTION = re.compile(r"^\s*[\[(].*[\])]\s*$")
_REPEAT = re.compile(r"\s*[\[(]?\s*[x×]\s*(\d)\s*[\])]?\s*$", re.I)
_NIQQUD = re.compile("[֑-ׇ]")
_CTRL = re.compile("[\u0000-\u0008\u000b-\u001f\u007f‎‏‪-‮⁦-⁩]")


def clean_lyrics(text: str) -> str:
    """טקסט מהמשתמש: בלי תווי בקרה וכיווניות, עד LYR_MAX."""
    t = _CTRL.sub("", str(text or "")).replace("\r\n", "\n").replace("\r", "\n")
    return t[:LYR_MAX]


def norm(w: str) -> str:
    """להשוואה בלבד: אותיות וספרות (וגרש), בלי ניקוד, אותיות קטנות."""
    w = _NIQQUD.sub("", unicodedata.normalize("NFC", w))
    return "".join(ch for ch in w if ch == "'" or unicodedata.category(ch)[:1] in ("L", "N")).lower()


def _split_long(words: list[str]) -> list[list[str]]:
    """שורת שיר ארוכה מדי לשורה אחת על המסך — באמצע, ליד הפסיק אם יש."""
    if sum(len(w) + 1 for w in words) - 1 <= MAX_LINE_CHARS or len(words) < 4:
        return [words]
    half = len(words) // 2
    best = half
    for k in range(max(1, half - 2), min(len(words) - 1, half + 2) + 1):
        if words[k - 1].endswith((",", ";", ":")):
            best = k
            break
    return _split_long(words[:best]) + _split_long(words[best:])


def parse_lyrics(text: str) -> list[list[str]]:
    """המילים שהודבקו → שורות של מילים. כותרות קטע ("[Chorus]", "(Verse 2)") יורדות; "×2" בסוף שורה = השורה פעמיים;
    שורה ריקה מפרידה בין בתים (לא נשמרת — הזמנים מגיעים מהשירה)."""
    out: list[list[str]] = []
    for raw in clean_lyrics(text).split("\n"):
        line = raw.strip()
        if not line or _SECTION.match(line):
            continue
        rep = 1
        m = _REPEAT.search(line)
        if m and line[:m.start()].strip():
            rep = max(1, min(4, int(m.group(1))))
            line = line[:m.start()].strip()
        words = [w for w in line.split() if norm(w)]
        if not words:
            continue
        for _ in range(rep):
            out.extend(_split_long(words))
    return out


def anchor(lines: list[list[str]], asr: list[dict]) -> list[dict]:
    """לכל מילה מהשיר — זמן משוער מהתמלול של הקול המופרד (התאמת רצפים). מילה שהתמלול לא שמע: באמצע בין העוגנים
    שלפניה ואחריה, לפי האורך; לפני העוגן הראשון / אחרי האחרון — WORD_S למילה. המיישר מתקן אחר כך."""
    words = [{"w": w, "li": li} for li, ln in enumerate(lines) for w in ln]
    a = [norm(w["w"]) for w in words]
    b = [norm(str(x.get("w", ""))) for x in asr]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    got: dict[int, tuple[float, float]] = {}
    for blk in sm.get_matching_blocks():
        for k in range(blk.size):
            x = asr[blk.b + k]
            got[blk.a + k] = (float(x["s"]), float(x["e"]))
    n = len(words)
    idx = sorted(got)
    if not idx:                                   # אין שום עוגן — מפזרים על כל השיר (המיישר יחליט)
        end = max((float(x.get("e", 0)) for x in asr), default=n * WORD_S)
        span = max(end, n * WORD_S)
        for i, w in enumerate(words):
            w["s"], w["e"] = round(span * i / max(1, n), 3), round(span * (i + 1) / max(1, n), 3)
        return words
    for i in idx:
        words[i]["s"], words[i]["e"] = got[i]
    first, last = idx[0], idx[-1]
    for i in range(first - 1, -1, -1):
        e = words[i + 1]["s"]
        words[i]["s"], words[i]["e"] = max(0.0, e - WORD_S), e
    for i in range(last + 1, n):
        s = words[i - 1]["e"]
        words[i]["s"], words[i]["e"] = s, s + WORD_S
    for j in range(len(idx) - 1):                 # פערים בין עוגנים — לפי אורך המילים
        p, q = idx[j], idx[j + 1]
        if q - p <= 1:
            continue
        t0, t1 = words[p]["e"], words[q]["s"]
        gap = words[p + 1:q]
        tot = sum(len(norm(w["w"])) + 1 for w in gap) or 1
        t = t0
        for w in gap:
            d = max(0.0, t1 - t0) * (len(norm(w["w"])) + 1) / tot
            w["s"], w["e"] = round(t, 3), round(t + d, 3)
            t += d
    for w in words:
        w["s"], w["e"] = round(float(w["s"]), 3), round(max(float(w["e"]), float(w["s"]) + 0.05), 3)
    return words


def timed_lines(words: list[dict]) -> list[dict]:
    """המילים (אחרי יישור) → שורות: {"words": [{"w","s","e"}], "s", "e"}."""
    out: list[dict] = []
    for w in words:
        li = int(w["li"])
        while len(out) <= li:
            out.append({"words": []})
        out[li]["words"].append({"w": w["w"], "s": float(w["s"]), "e": float(w["e"])})
    out = [ln for ln in out if ln["words"]]
    for ln in out:
        ln["s"], ln["e"] = ln["words"][0]["s"], ln["words"][-1]["e"]
    return out


def layout(lines: list[dict]) -> list[dict]:
    """תצוגה בשתי שורות מתחלפות (כמו בקריוקי מקצועי): שורה זוגית למעלה, אי־זוגית למטה. כל שורה מופיעה כשהשורה
    הקודמת באותו מקום מסתיימת (לכל היותר PRE_MAX_S לפני המילה הראשונה), ונעלמת HOLD_S אחרי האחרונה — או כשהבאה
    באותו מקום צריכה אותו. נקודות ספירה לאחור לפני שורה שבאה אחרי שקט."""
    shown: list[dict] = []
    free = [0.0, 0.0]
    for k, ln in enumerate(lines):
        row = k % 2
        show = max(free[row], ln["s"] - PRE_MAX_S, 0.0)
        show = min(show, max(0.0, ln["s"] - LEAD_S))
        nxt = lines[k + 2]["s"] - PRE_MAX_S if k + 2 < len(lines) else None
        hide = ln["e"] + HOLD_S
        if nxt is not None:
            hide = min(hide, max(ln["e"] + 0.15, nxt))
        prev_end = lines[k - 1]["e"] if k > 0 else 0.0
        cd = ln["s"] - prev_end >= COUNT_GAP_S
        shown.append({"row": row, "show": round(show, 3), "hide": round(hide, 3), "words": ln["words"], "cd": cd})
        free[row] = hide
    return shown


def _esc(s: str) -> str:
    return s.replace("\\", "＼").replace("{", "(").replace("}", ")")


def _line_text(words: list[dict], upto: int, fill: bool) -> str:
    """המילים 0..upto (כולל) בצבע "נשמע", השאר בצבע הרגיל. בשכבת ההעבות (fill) צובעים גם את המסגרת."""
    parts = []
    for i, w in enumerate(words):
        c = SUNG if i <= upto else UNSUNG
        tag = f"{{\\c{c}" + (f"\\3c{c}" if fill else "") + "}"
        parts.append(tag + _esc(w["w"]))
    return " ".join(parts)


def events(shown: list[dict]) -> list[tuple[float, float, int, int, int]]:
    """(התחלה, סוף, אינדקס שורה, עד איזו מילה נשמע, שורה במסך) — מצב אחד לכל מילה."""
    out = []
    for li, ln in enumerate(shown):
        ws = ln["words"]
        t = ln["show"]
        marks = [w["s"] for w in ws]
        if marks[0] > t:
            out.append((t, marks[0], li, -1, ln["row"]))
        for i in range(len(ws)):
            a = max(marks[i], t)
            b = marks[i + 1] if i + 1 < len(ws) else ln["hide"]
            b = min(b, ln["hide"])
            if b > a:
                out.append((a, b, li, i, ln["row"]))
    return out


def write_ass(shown: list[dict], style, width: int, height: int, title: str = "", rtl_text: bool = False) -> str:
    """ASS לצריבה: מצב לכל מילה (בלי \\k — ראו בראש הקובץ), שתי שורות בתחתית, נקודות ספירה לאחור."""
    from .subs import _ass_time, _alpha_colour
    st = style.scaled(width, height)
    x = width / 2.0
    head = [
        "[Script Info]", f"Title: {_esc(title)}", "ScriptType: v4.00+", f"PlayResX: {width}", f"PlayResY: {height}",
        "WrapStyle: 2", "ScaledBorderAndShadow: yes", "YCbCr Matrix: None", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        (f"Style: Main,{style.font},{st.size:.1f},{UNSUNG},{UNSUNG},"
         f"{style.outline_colour},{_alpha_colour(style.shadow_alpha)},{style.bold},0,0,0,100,100,"
         f"{st.spacing:.2f},0,1,{st.outline:.2f},{st.shadow:.2f},2,0,0,0,-1"),
        (f"Style: Fill,{style.font},{st.size:.1f},{UNSUNG},{UNSUNG},"
         f"{UNSUNG},&H00000000,{style.bold},0,0,0,100,100,"
         f"{st.spacing:.2f},0,1,{st.faux_bold:.2f},0,2,0,0,0,-1"),
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    ev = []
    pitch = st.line_pitch * 1.25
    ys = [st.bottom_y - pitch, st.bottom_y]          # שורה 0 למעלה, שורה 1 למטה
    blur = f"\\blur{st.blur:.2f}" if st.blur > 0 else ""
    pre = "‏" if rtl_text else ""
    for a, b, li, upto, row in events(shown):
        words = shown[li]["words"]
        y = ys[row]
        pos = f"\\an2\\pos({x:.1f},{y:.1f})"
        ev.append(f"Dialogue: 0,{_ass_time(a)},{_ass_time(b)},Main,,0,0,0,,{{{pos}{blur}}}{pre}{_line_text(words, upto, False)}")
        if st.faux_bold > 0:
            ev.append(f"Dialogue: 1,{_ass_time(a)},{_ass_time(b)},Fill,,0,0,0,,{{{pos}}}{pre}{_line_text(words, upto, True)}")
    for ln in shown:                                 # נקודות ספירה לאחור — מעל השורה
        if not ln["cd"]:
            continue
        s0 = ln["words"][0]["s"]
        y = ys[ln["row"]] - st.line_pitch * 1.05
        for k in range(3):
            a, b = s0 - COUNT_S + k, s0 - COUNT_S + k + 1
            if a < 0:
                continue
            dots = "● " * (3 - k)
            ev.append(f"Dialogue: 2,{_ass_time(a)},{_ass_time(b)},Main,,0,0,0,,{{\\an2\\pos({x:.1f},{y:.1f})\\fs{st.size * 0.6:.1f}\\c{SUNG}}}{dots.strip()}")
    return "\n".join(head + ev) + "\n"


def _lrc_t(t: float) -> str:
    t = max(0.0, t)
    m, s = divmod(t, 60)
    return f"{int(m):02d}:{s:05.2f}"


def write_lrc(lines: list[dict], title: str = "", enhanced: bool = False) -> str:
    """LRC (זמן לשורה), ו־Enhanced LRC (גם ‎<mm:ss.xx>‎ לפני כל מילה)."""
    out = [f"[ti:{title}]"] if title else []
    for ln in lines:
        if enhanced:
            txt = " ".join(f"<{_lrc_t(w['s'])}>{w['w']}" for w in ln["words"]) + f" <{_lrc_t(ln['e'])}>"
        else:
            txt = " ".join(w["w"] for w in ln["words"])
        out.append(f"[{_lrc_t(ln['s'])}]{txt}")
    return "\n".join(out) + "\n"


def is_rtl(lines: list[list[str]]) -> bool:
    txt = "".join("".join(ln) for ln in lines)
    heb = sum(1 for ch in txt if "֐" <= ch <= "׿" or "؀" <= ch <= "ۿ")
    return heb > len(txt) * 0.3
