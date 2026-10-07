"""מודל התמליל המשותף לכל המנועים, ייצוא/ייבוא להגהה, והשוואה בין מנועים.

מילה = dict:  {"w": טקסט כולל פיסוק, "s": התחלה, "e": סוף, "spk": "S1", "conf": 0..1}
אירוע קול (צחוק, מחיאות כפיים) נשמר ברשימה נפרדת ולא משתתף ביישור/בכתוביות.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass

from .util import fmt_ts

_PUNCT_EDGE = re.compile(r"^[^\w']+|[^\w%$']+$", re.UNICODE)
FILLERS = {"um", "uh", "uhm", "erm", "er", "ah", "hmm", "mm", "mhm", "mm-hmm", "uh-huh", "huh"}
BACKCHANNEL = FILLERS | {"yeah", "yes", "right", "okay", "ok", "sure", "wow", "exactly",
                         "absolutely", "totally", "interesting", "cool", "true", "nice"}


def norm(token: str) -> str:
    """נרמול להשוואה: אותיות קטנות, בלי פיסוק בקצוות, גרש אחיד."""
    t = token.replace("’", "'").replace("‘", "'").lower()
    t = _PUNCT_EDGE.sub("", t)
    return t


def is_filler(token: str) -> bool:
    return norm(token) in FILLERS


def words_text(words: list[dict]) -> str:
    return " ".join(w["w"] for w in words)


def speakers_in(words: list[dict]) -> list[str]:
    seen = []
    for w in words:
        s = w.get("spk")
        if s and s not in seen:
            seen.append(s)
    return seen


def renumber_speakers(words: list[dict]) -> dict:
    """מיפוי תוויות מנוע (speaker_0, A...) ל־S1, S2... לפי סדר הופעה."""
    mapping = {}
    for w in words:
        s = w.get("spk")
        if s is None:
            continue
        if s not in mapping:
            mapping[s] = f"S{len(mapping) + 1}"
        w["spk"] = mapping[s]
    return mapping


def sanity_fix_times(words: list[dict]) -> list[dict]:
    """זמנים מונוטוניים, משך חיובי, ובלי חפיפות."""
    prev_e = 0.0
    for w in words:
        s = float(w.get("s", prev_e))
        e = float(w.get("e", s))
        if s < prev_e - 0.05:
            s = prev_e
        if e < s + 0.02:
            e = s + 0.02
        w["s"], w["e"] = round(s, 3), round(e, 3)
        prev_e = e
    return words


# ---------------------------------------------------------------------------
# ייצוא לקובץ הגהה טקסטואלי
# ---------------------------------------------------------------------------

EDIT_HEADER = """# קובץ הגהה של התמליל באנגלית.
# כל שורה = פסקה של דובר אחד. התגית בתחילת השורה: [דובר זמן].
# מותר: לתקן מילים ופיסוק, לשנות דובר בתגית, לפצל שורה (שורה חדשה עם תגית),
#        לאחד שורות, ולמחוק מילים שלא נאמרו. הזמן בתגית הוא רק להתמצאות.
# אסור: לסכם או לנסח מחדש — התמליל צריך להיות מילה במילה (כולל um/uh).
# אחרי ההגהה: python -m vt edit-import <שם>   ואז   python -m vt align <שם>
"""


def to_paragraphs(words: list[dict], pause_s: float = 1.5, max_words: int = 90) -> list[tuple[int, int]]:
    """חלוקה לפסקאות: החלפת דובר, הפסקה ארוכה, או אורך (בסוף משפט)."""
    paras = []
    start = 0
    for i in range(1, len(words) + 1):
        if i == len(words):
            paras.append((start, i))
            break
        prev, cur = words[i - 1], words[i]
        n = i - start
        brk = cur.get("spk") != prev.get("spk")
        brk = brk or (cur["s"] - prev["e"] >= pause_s)
        brk = brk or (n >= max_words and prev["w"][-1:] in ".?!")
        if brk:
            paras.append((start, i))
            start = i
    return paras


def export_edit(words: list[dict], speakers: dict | None = None) -> str:
    lines = [EDIT_HEADER]
    if speakers:
        desc = ", ".join(f"{k}={v.get('name', '?')}" for k, v in speakers.items())
        lines.append(f"# דוברים: {desc}")
    lines.append("")
    for a, b in to_paragraphs(words):
        spk = words[a].get("spk") or "S?"
        lines.append(f"[{spk} {fmt_ts(words[a]['s'])}] " + words_text(words[a:b]))
    return "\n".join(lines) + "\n"


_TAG = re.compile(r"^\[(?P<spk>S\d+|S\?)(?:\s+[\d:.,]+)?\]\s*")


def parse_edit(text: str) -> list[tuple[str, str]]:
    """מחזיר רשימת (טוקן, דובר) מקובץ ההגהה."""
    out = []
    spk = "S?"
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        m = _TAG.match(line)
        if m:
            spk = m.group("spk")
            line = line[m.end():]
        for tok in line.split():
            out.append((tok, spk))
    return out


def import_edit(orig: list[dict], edited_text: str) -> tuple[list[dict], dict]:
    """ממפה את הטקסט המוגה למילים המקוריות כדי לשמור זמנים משוערים.

    מילים שהשתנו/נוספו מקבלות זמנים משוערים (חלוקה שווה בטווח) — היישור
    הכפוי שאחרי כן קובע את הזמנים המדויקים מהאודיו.
    """
    toks = parse_edit(edited_text)
    a = [norm(w["w"]) for w in orig]
    b = [norm(t) for t, _ in toks]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    new: list[dict | None] = [None] * len(toks)
    stats = {"equal": 0, "replaced": 0, "inserted": 0, "deleted": 0}
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            for k in range(j2 - j1):
                o = orig[i1 + k]
                new[j1 + k] = {"w": toks[j1 + k][0], "s": o["s"], "e": o["e"],
                               "spk": toks[j1 + k][1], "conf": o.get("conf")}
            stats["equal"] += j2 - j1
        elif tag in ("replace", "insert"):
            if tag == "replace":
                s0, e0 = orig[i1]["s"], orig[i2 - 1]["e"]
                stats["replaced"] += j2 - j1
            else:
                s0 = orig[i1 - 1]["e"] if i1 > 0 else 0.0
                e0 = orig[i1]["s"] if i1 < len(orig) else s0 + 0.3 * (j2 - j1)
                if e0 <= s0:
                    e0 = s0 + 0.2 * (j2 - j1)
                stats["inserted"] += j2 - j1
            n = j2 - j1
            step = (e0 - s0) / max(n, 1)
            for k in range(n):
                new[j1 + k] = {"w": toks[j1 + k][0], "s": s0 + k * step, "e": s0 + (k + 1) * step,
                               "spk": toks[j1 + k][1], "conf": None, "edited": True}
        elif tag == "delete":
            stats["deleted"] += i2 - i1
    words = sanity_fix_times([w for w in new if w is not None])
    return words, stats


# ---------------------------------------------------------------------------
# השוואה בין שני מנועי תמלול — נקודות מחלוקת להכרעה בהגהה
# ---------------------------------------------------------------------------

@dataclass
class Disagreement:
    t: float
    a: str
    b: str
    ctx_before: str
    ctx_after: str


def compare(words_a: list[dict], words_b: list[dict], ctx: int = 6) -> list[Disagreement]:
    a = [norm(w["w"]) for w in words_a]
    b = [norm(w["w"]) for w in words_b]
    sm = difflib.SequenceMatcher(a=a, b=b, autojunk=False)
    out = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        ta = " ".join(w["w"] for w in words_a[i1:i2])
        tb = " ".join(w["w"] for w in words_b[j1:j2])
        # הבדלי מילות מילוי בלבד אינם מעניינים
        if all(is_filler(x) for x in ta.split() + tb.split()):
            continue
        t = words_a[i1]["s"] if i1 < len(words_a) else (words_a[-1]["e"] if words_a else 0.0)
        before = " ".join(w["w"] for w in words_a[max(0, i1 - ctx):i1])
        after = " ".join(w["w"] for w in words_a[i2:i2 + ctx])
        out.append(Disagreement(t, ta, tb, before, after))
    return out


def compare_report(name_a: str, name_b: str, diffs: list[Disagreement], n_words: int) -> str:
    lines = [f"# השוואת תמלול: {name_a} מול {name_b}", "",
             f"מילים ב־{name_a}: {n_words} · נקודות מחלוקת: {len(diffs)}", "",
             "הכרעה: לפי ההקשר, ידע על הדוברים והחברה, ואיות שמות מהרשת. "
             "את התיקונים מבצעים בקובץ ההגהה (en.edit.txt).", ""]
    for d in diffs:
        lines.append(f"- `{fmt_ts(d.t)}` …{d.ctx_before} **[{name_a}: {d.a or '∅'} | {name_b}: {d.b or '∅'}]** {d.ctx_after}…")
    return "\n".join(lines) + "\n"


def apply_patch(text: str, patch: str) -> tuple[str, list[str]]:
    """תיקוני הגהה כקובץ קצר במקום כתיבה מחדש של כל התמליל.

    שורה: `טקסט ישן => טקסט חדש` (הטקסט הישן חייב להופיע בדיוק פעם אחת — אחרת להאריך אותו).
    `\\n` בטקסט החדש = שורה חדשה (למשל החלפת דובר: `Yeah thanks Gary => \\n[S2] Yeah, thanks, Gary.`).
    שורות ריקות ושורות שמתחילות ב־# — מדולגות. מחזיר (טקסט, שגיאות); עם שגיאות לא משנים כלום.
    כתיבה מחדש של תמליל של שעה = ~16K טוקני פלט; קובץ תיקונים = כמה מאות.
    """
    errs, out = [], text
    for n, line in enumerate(patch.splitlines(), start=1):
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if " => " not in line:
            errs.append(f"שורה {n}: חסר ' => '")
            continue
        old, new = line.split(" => ", 1)
        new = new.replace("\\n", "\n")
        k = out.count(old)
        if k != 1:
            errs.append(f"שורה {n}: '{old[:40]}' מופיע {k} פעמים (צריך בדיוק 1)")
            continue
        out = out.replace(old, new, 1)
    return (text, errs) if errs else (out, [])

