"""OCR של שקפים לניתוח סרטונים (גל 0 — docs/studio-video-analysis-plan.md 3.2 שלב 8, ‏V22, ‏16.2 PR 0.1), גרסה 2:
כמה שפות וכתבים באותו מסך ובאותה שורה (docs/studio-lang-research.md §5, מחקר docs/research/lang-id/03-screen-text.md).

מעבר ראשון: Tesseract 5 עם heb+eng, ‏`--psm 3`, פלט TSV. אחריו, בלי מודל נוסף:
1. פיצול שורה בפער רחב (GAP_K × גובה) — עמודה עברית ועמודה אנגלית באותו גובה לא מתמזגות לשורה אחת
   (במדידה: 33–67% מהשורות בשקף דו־טורי התמזגו).
2. תיקון מילים דבוקות (`_repair`): תחילית עברית + מקף צמודה למונח לועזי ("ה־API", ‏"ב־Machine Learning") נראית
   כמילה אחת בשני כתבים, ו־Tesseract קורא אותה כזבל. קריאה חוזרת של המילה בעברית ובאנגלית (כל החיתוכים בהרצה
   אחת — TIFF מרובה עמודים ב־stdin, ‏hOCR עם תיבה לכל תו) מוצאת את המקף, ומפצלת: התחילית מהקריאה העברית, המונח
   מקריאה אנגלית של החלק השמאלי. וגם מילה עברית שנקראה כלטינית ("צוות" → "NUN"): קריאה עברית נקייה בביטחון ≥ HEB_OK
   מחליפה אותה (מונחים אמיתיים — BI, ‏AWS, ‏pip — לא עברו 81 במדידה).
3. כתבים נוספים (EXTRA, למשל ערבית ורוסית) — רק לשורות שבהן מילים שאינן עברית ברורה נקראו חלש או כ"זבל לטיני"
   ("Cnacn6o" = "Спасибо"), ורק אם המודלים מותקנים. מחליפות רק מילים בכתב הנוסף, ולא עברית ברורה או לטינית בטוחה.
0. כתוביות צרובות (`_subs`): טקסט לבן/צהוב עם קו מתאר על רקע וידאו — הבינאריזציה של Tesseract נכשלת על רקע
   רועש (במדידה: חצי מהשורות לא נמצאו). ברצועה התחתונה, כשהרקע מרקמי, מסכה של הפיקסלים הלבנים/הצהובים נקראת
   שוב, ושורה ממנה מחליפה את מה שהמעבר הראשון קרא שם אם היא בטוחה ממנו.
4. כיוון השורה (`line_dir`): יישור מול השורות האחרות, נקודתיים של כותרת, הקצוות, רוב האותיות (עם עדיפות לעברית —
   מונחים באנגלית בשורה עברית נפוצים) וכיוון השקף. שורה באנגלית עם שם בעברית נשארת LTR.
5. סדר לוגי (`reorder`) — היפוך של אלגוריתם ה־bidi: בשורת RTL רצף לועזי נקרא משמאל לימין, ורצף של מספרים בלבד
   נשאר בסדר RTL ("2024: 4.2"); בשורת LTR — אי עברי נקרא מימין לשמאל. תחילית עם מקף נצמדת למילה שאחריה.
6. שפה לכל קטע (`segments`): עברית/ערבית/רוסית לפי הכתב, ולטינית — אנגלית אלא אם מילות פונקציה וסימנים מעידים
   על צרפתית/ספרדית/גרמנית/איטלקית/פורטוגזית. שורה בכמה שפות = mix עם segs.

מקביליות: כמה תהליכי Tesseract ב־single-thread (‏OMP_THREAD_LIMIT=1) ולא תהליך אחד עם threads — שם הזמן היה
לא יציב (0.2–4.9 שנ׳). ‏Pool מגביל כמה רצים יחד, והגבול משתנה בזמן ריצה (set_limit) — שומר הזיכרון של הניתוח
מוריד אותו כשעבודת תרגום רצה במקביל (PR 0.2). התמונה עוברת ב־stdin (PNG/TIFF בזיכרון) — בלי קבצים זמניים.

שורה בפלט: {text, conf (0–100, כמו ב־vi.json), box [x, y, w, h], lang he|en|ar|ru|…|mix|other, dir rtl|ltr, words,
segs?: [[טקסט, שפה], …] רק ב־mix}. התמונה כולה: {lines, words, conf, ms, langs: {שפה: חלק מהאותיות}, fix?: {…}}.
"""

from __future__ import annotations

import html
import io
import os
import re
import shutil
import subprocess
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

V = 2                                      # ‏vo — גרסת ה־OCR (ממדי הגרסה)
LANGS = os.environ.get("VI_OCR_LANGS") or "heb+eng"
EXTRA = os.environ.get("VI_OCR_EXTRA", "ara+rus")   # כתבים לשורות שלא נקראו — רק המותקנים ("" = כבוי)
PSM = 3
PROCS = max(1, int(os.environ.get("VI_OCR_PROCS") or 4))
TIMEOUT = 90                               # שנ׳ לתמונה — Tesseract שנתקע לא תוקע את הניתוח
WORD_CONF = 30                             # מילה קצרה בביטחון נמוך מזה — רעש (רקע, אייקון, תמונה)
LINE_CONF = 45                             # שורה קצרה (עד 3 תווים) בביטחון נמוך מזה — רעש
GAP_K = 2.5                                # פער בין מילים (× גובה המילים) שמפצל שורה — עמודות, תאי טבלה
REPAIR = os.environ.get("VI_OCR_REPAIR", "1") != "0"
HEB_OK = 85                                # קריאה עברית נקייה מעל זה מחליפה מילה שנקראה כלטינית
LAT_KEEP = 90                              # ...אלא אם המילה הלטינית ארוכה (6+) ונקראה שוב באנגלית בביטחון כזה
EXTRA_LINE = 80                            # מילים לא־עבריות בשורה בביטחון נמוך מזה — השורה נקראת שוב עם EXTRA
EXTRA_GAIN = 15                            # ...והקריאה החדשה מתקבלת רק אם הביטחון עלה לפחות בכך
MAX_FIX = 60                               # תקרת חיתוכים לקריאה חוזרת בתמונה אחת
SUB_Y = 0.6                                # רצועת הכתוביות — מ־60% מגובה התמונה ומטה
SUB_TEX = 3.0                              # מרקם (הפרש בהירות ממוצע בין פיקסלים שכנים) — מעליו הרקע וידאו/תמונה
SUB_CONF = 70                              # שורה ממסכת הכתוביות מתקבלת מביטחון כזה
HEB = re.compile(r"[א-תיִ-ﭏ]")                    # אותיות עבריות (בלי ניקוד ופיסוק)
ARA = re.compile(r"[ؠ-يٮ-ۓۺ-ۿݐ-ݿﭐ-﷿ﹰ-ﻼ]")
CYR = re.compile(r"[Ѐ-ӿ]")
LAT = re.compile(r"[A-Za-zÀ-ɏ]")
RTLC = re.compile(HEB.pattern[:-1] + ARA.pattern[1:])                  # אות בכתב מימין לשמאל
LTRC = re.compile(LAT.pattern[:-1] + CYR.pattern[1:])
ALNUM = re.compile(r"[\w]", re.UNICODE)
BIDI = re.compile(r"[‎‏‪-‮⁦-⁩]")
NIQQUD = re.compile(r"[֑-ֽֿ-ׇ]")
HYPH = "-־‐‑–_~"
PREFIXES = set("ו ה ב כ ל מ ש וה וב וכ ול ומ וש שה שב שכ של שמ כש מש מה כשה כשב ושה ושב ושל ומה וכש לכש".split())
MIRROR = str.maketrans("()[]{}<>", ")(][}{><")
QUOTES = "\"'\u201c\u201d\u201e\u201f\u2018\u2019`\u00b4\u00ab\u00bb"
LAT_SURE = 85                              # מילה לועזית נקייה בביטחון כזה בקריאה באנגלית — לא מפצלים אותה
GLUE_ENG = 80                              # מילה "עברית" משובשת → הקריאה באנגלית מחליפה אותה אם נקייה ובביטחון כזה
CLEAN_LAT = re.compile(r"[A-Za-z0-9][A-Za-z0-9.+#&'/]*")
ZNUM = re.compile(r"^(?:0\d{1,2}|[86])$")     # "01" בתא — אולי "Q1"; ‏"8" לבד — אולי "B" או "&"
CELL = re.compile(r"^(?:[A-Z]\d{0,2}|&)$")
# "ל-100%5", ‏"ו-סוס" — תחילית+מקף+משהו שאינו מספר: בעברית מקף אחרי תחילית בא רק לפני מספר או מילה לועזית
GLUED = re.compile(r"^[ובכלמשה]{1,3}[" + HYPH + r"](?!\d+(?:[.,]\d+)?%?$)\S")
# מילה "לטינית" שהיא כנראה כתב אחר שנקרא בטעות: ספרה בין אותיות ("Cnacn6o"), ספרה+אות ("3a"), רישיות מתחלפות ("BHUMaHue")
JUNK = re.compile(r"[A-Za-z]\d+[A-Za-z]|^\d[A-Za-z]{1,2}$|[A-Z][a-z][A-Z][a-z]")
CYR_SAME = set("АВЕКМНОРСТХІЈЅаеорсухіјѕ")   # קיריליות שנראות כמו לטיניות — לא מעידות על רוסית
_LANGS_CACHE: list[str] | None = None


def tess() -> str | None:
    return os.environ.get("SNB_TESSERACT") or shutil.which("tesseract")


def available() -> bool:
    return bool(tess())


def _env() -> dict:
    env = dict(os.environ)
    env["OMP_THREAD_LIMIT"] = "1"
    return env


def langs() -> list[str]:
    """השפות המותקנות (‏--list-langs; השורה הראשונה היא כותרת)."""
    if not available():
        return []
    p = subprocess.run([tess(), "--list-langs"], capture_output=True, text=True, timeout=30, env=_env())
    out = (p.stdout or "") + (p.stderr or "")
    return [x.strip() for x in out.splitlines()[1:] if x.strip() and " " not in x.strip()]


def extra_langs() -> str:
    """EXTRA בלי מה שלא מותקן (נשמר אחרי הפעם הראשונה). ריק — אין מעבר שני."""
    global _LANGS_CACHE
    if not EXTRA:
        return ""
    if _LANGS_CACHE is None:
        try:
            _LANGS_CACHE = langs()
        except (OSError, subprocess.SubprocessError):
            _LANGS_CACHE = []
    have = [x for x in EXTRA.split("+") if x and x in _LANGS_CACHE and x not in LANGS.split("+")]
    return "+".join(have)


def version() -> str:
    if not available():
        return ""
    p = subprocess.run([tess(), "--version"], capture_output=True, text=True, timeout=30, env=_env())
    first = ((p.stdout or "") + (p.stderr or "")).strip().splitlines()
    return first[0].strip() if first else ""


# ---------------------------------------------------------------- כתב ושפה

def clean(t: str) -> str:
    t = BIDI.sub("", unicodedata.normalize("NFC", t or "")).strip()
    return "\u2014" if t == "--" else t           # קו מפריד שנקרא כשני מקפים


def script_of(ch: str) -> str:
    """כתב של תו: he / ar / ru (קירילי) / lat, או '' לתו ניטרלי (רווח, ספרה, פיסוק)."""
    if HEB.match(ch):
        return "he"
    if ARA.match(ch):
        return "ar"
    if CYR.match(ch):
        return "ru"
    if LAT.match(ch):
        return "lat"
    return ""


def tclass(t: str) -> str:
    """סוג מילה לסידור: R (אותיות מימין לשמאל), L (משמאל לימין), M (גם וגם), N (ספרות בלי אותיות), P (פיסוק)."""
    r, l_ = len(RTLC.findall(t)), len(LTRC.findall(t))
    if r and l_:
        return "M"
    if r:
        return "R"
    if l_:
        return "L"
    return "N" if any(c.isdigit() for c in t) else "P"


# מילות פונקציה נפוצות (ומעט סימנים) — רק כדי לא לקרוא לכל טקסט לטיני "אנגלית". קצר בכוונה: שורת שקף היא כמה מילים
_LAT_WORDS = {
    "en": "the and of to in for is on with are this that from by be at as our your you we it an or not how what".split(),
    "fr": "le la les des et pour une un du est dans sur avec pas vous nous au aux ce qui que bienvenue à".split(),
    "es": "el la los las y por para con una un del es en su sus que no al gracias bienvenidos como más".split(),
    "de": "der die das und für ist mit nicht ein eine den dem zu von auf ihre wir sie danke willkommen".split(),
    "it": "il lo la gli le e per con una un del della è che non sono grazie benvenuti di".split(),
    "pt": "o a os as e para com uma um do da não é que em no na obrigado bem-vindos".split(),
}
_LAT_MARK = {"fr": "àâçèéêëîïôûùœ", "es": "ñ¿¡áíóú", "de": "äöüß", "it": "àèéìòù", "pt": "ãõçáâêó"}


def latin_lang(t: str) -> str:
    """שפה של קטע לטיני: en, אלא אם ב־2 מילים לפחות יש ראיה לשפה אחרת (מילות פונקציה, וסימני הניקוד שלה)."""
    ws = [w.strip(".,:;!?()[]\"'«»") for w in t.lower().split()]
    ws = [w for w in ws if w]
    if len(ws) < 2:
        return "en"
    score = {}
    for lg, vocab in _LAT_WORDS.items():
        s = sum(1 for w in ws if w in vocab)
        s += 0.5 * sum(1 for c in t.lower() if c in _LAT_MARK.get(lg, ""))
        score[lg] = s
    best = max(score, key=lambda k: (score[k], k == "en"))
    return best if best != "en" and score[best] >= 1.5 and score[best] > score["en"] else "en"


def _code(t: str) -> bool:
    """רצף לטיני שהוא קוד ולא מילה: אות אחת, או עד 2 אותיות עם ספרה צמודה ("Q1", ‏"B2B", ‏"MP3")."""
    tok = t.split()[0] if t.split() else ""
    n = len(LAT.findall(t))
    return n == 1 or (n <= 2 and any(c.isdigit() for c in tok))


def segments(text: str) -> list[list[str]]:
    """טקסט לוגי → [[קטע, שפה], …]: רצפים לפי כתב; תווים ניטרליים הולכים לקטע שלפניהם (בתחילת שורה — לראשון).
    שפה: he / ar / ru, ולטיני — latin_lang. קטעים סמוכים באותה שפה מתאחדים."""
    runs: list[list[str]] = []
    pend = ""
    for ch in text:
        s = script_of(ch)
        if not s:
            if runs:
                runs[-1][0] += ch
            else:
                pend += ch
            continue
        if runs and runs[-1][1] == s:
            runs[-1][0] += ch
        else:
            runs.append([pend + ch if not runs else ch, s])
            pend = ""
    # קוד לטיני קצר ("Q1", ‏"5G", ‏"B" כתווית) אינו טקסט בשפה — ניטרלי, כמו ספרות
    merged: list[list[str]] = []
    pend = ""
    for t, s in runs:
        if s == "lat" and _code(t):
            if merged:
                merged[-1][0] += t
            else:
                pend += t
            continue
        if merged and merged[-1][1] == s:
            merged[-1][0] += pend + t
        else:
            merged.append([pend + t, s])
        pend = ""
    if merged and pend:
        merged[-1][0] += pend
    runs = merged
    if not runs:
        return []
    out: list[list[str]] = []
    for t, s in runs:
        lg = latin_lang(t) if s == "lat" else s
        t = t.strip()
        if not t:
            continue
        if out and out[-1][1] == lg:
            out[-1][0] += " " + t
        else:
            out.append([t, lg])
    return out


def lang_of(text: str) -> str:
    """שפת השורה: שפה אחת — הקוד שלה; כמה — mix; בלי אותיות — other."""
    ls = {lg for _, lg in segments(text)}
    return ls.pop() if len(ls) == 1 else ("mix" if ls else "other")


# ---------------------------------------------------------------- TSV → מילים

def tsv_words(tsv: str) -> list[dict]:
    """שורות level 5 (מילים) מפלט ה־TSV של Tesseract, עם טקסט לא ריק אחרי ניקוי."""
    out = []
    rows = (tsv or "").splitlines()
    if not rows:
        return out
    head = rows[0].split("\t")
    try:
        ix = {k: head.index(k) for k in ("level", "block_num", "par_num", "line_num", "word_num", "left", "top",
                                         "width", "height", "conf", "text")}
    except ValueError:
        return out
    for r in rows[1:]:
        c = r.split("\t")
        if len(c) <= ix["text"] or c[ix["level"]] != "5":
            continue
        t = clean(c[ix["text"]])
        if not t:
            continue
        try:
            out.append({"key": (int(c[ix["block_num"]]), int(c[ix["par_num"]]), int(c[ix["line_num"]])),
                        "n": int(c[ix["word_num"]]), "x": int(c[ix["left"]]), "y": int(c[ix["top"]]),
                        "w": int(c[ix["width"]]), "h": int(c[ix["height"]]), "conf": float(c[ix["conf"]]),
                        "text": t})
        except ValueError:
            continue
    return out


# ---------------------------------------------------------------- סדר לוגי

def _glue(a: str, b: str) -> bool:
    """תחילית עברית עם מקף ("ב־", "וה-") נצמדת למילה שאחריה בלי רווח."""
    return len(a) >= 2 and a[-1] in HYPH and a[:-1] in PREFIXES


def _join(ts: list[str]) -> str:
    """מילים בסדר לוגי → שורה. תחילית עם מקף נצמדת; תחילית בודדת בלי מקף לפני מילה לועזית ("ל React") — מקבלת
    מקף ונצמדת (בעברית תחילית לא עומדת לבד, והמקף נבלע בקריאה)."""
    out = ""
    for i, t in enumerate(ts):
        if i and len(ts[i - 1]) == 1 and ts[i - 1] in PREFIXES and tclass(t) in "LN":
            out += "\u05be" + t
        elif i == 0 or _glue(ts[i - 1], t):
            out += t
        else:
            out += " " + t
    return out


def _fix_brackets(t: str) -> str:
    """מילה לא־לטינית שמתחילה בסוגר סוגר או מסתיימת בסוגר פותח — Tesseract קרא את הסוגריים בכיוון הוויזואלי."""
    if t and (t[0] in ")]}" or t[-1] in "([{") and not LTRC.search(t):
        return t.translate(MIRROR)
    return t


def reorder(words: list[tuple[int, str]], base: str) -> str:
    """[(x שמאלי, טקסט)] של שורה אחת → טקסט בסדר הקריאה, לפי כיוון הבסיס.
    RTL: מימין לשמאל; רצף של מילים לא־RTL שיש בו אות לטינית/קירילית נקרא משמאל לימין (מונח, שם, קוד), ורצף של
    מספרים/פיסוק בלבד נשאר בסדר RTL ("2024: 4.2"). ‏LTR: משמאל לימין; אי של מילים RTL (עם מספרים ביניהן) — מימין לשמאל."""
    if base == "rtl":
        out: list[str] = []
        run: list[str] = []

        def flush():
            core = [i for i, t in enumerate(run) if tclass(t) in "LMN"]
            if not any(tclass(t) in "LM" for t in run):
                out.extend(_fix_brackets(t) for t in run)
            else:
                # פיסוק בקצות האי שייך לשורה ה־RTL (כיוון הבסיס): "דנה לוי | Dana Levi", ‏"ברוכים הבאים — Welcome"
                i0, i1 = core[0], core[-1]
                out.extend(run[:i0])
                isl = run[i0:i1 + 1]
                # ניטרלי בין האי לעברית מקבל את כיוון השורה, ולכן מוצג מחוץ לאי: מה שנדבק משמאל למילה השמאלית
                # (":A/B", ‏"!Thank", ‏'"git' — המירכאה הסוגרת של ‎-m "fix"‎) הוא סוף האי בסדר הלוגי, ומירכאה שנדבקה
                # מימין למילה הימנית — תחילתו
                m = re.match(r"^([.,!?;:" + QUOTES + r"]+)(?=\w)", isl[-1])
                lead = m.group(1) if m else ""
                isl[-1] = isl[-1][len(lead):]
                m = re.search(r"(?<=\w)([" + QUOTES + r"]+)$", isl[0])
                trail = m.group(1) if m else ""
                if trail:
                    isl[0] = isl[0][:-len(trail)]
                isl = list(reversed(isl))
                isl[0] = trail + isl[0]
                isl[-1] += lead
                out.extend(isl)
                out.extend(run[i1 + 1:])
            run.clear()
        for _, t in sorted(words, key=lambda w: -w[0]):
            if tclass(t) == "R":
                flush()
                out.append(_fix_brackets(t))
            else:
                run.append(t)
        flush()
        return _join(out)
    out = []
    isl: list[str] = []
    pend: list[str] = []
    for _, t in sorted(words, key=lambda w: w[0]):
        c = tclass(t)
        if c == "R":
            isl.extend(pend + [t])
            pend = []
        elif isl and c in "NP":
            pend.append(t)
        else:
            if isl:
                out.extend(reversed(isl))
                isl = []
            out.extend(pend)
            pend = []
            out.append(t)
    out.extend(reversed(isl))
    out.extend(pend)
    return _join(out)


FW_HE = set("על של את עם אל זה זו הוא היא הם אני אנחנו כי אם או גם רק כל לא יש אין מה איך למה כמו בין עד אבל הזה "
            "הזאת אחרי לפני תחת מאוד".split())
FW_EN = set("the of in on at to for with and is are was were from by this that these our we".split())


def line_dir(words: list[tuple[int, str]], align: str | None = None, prior: int = 0) -> str:
    """כיוון הבסיס של שורה. בלי אותיות RTL — ltr; בלי אותיות LTR — rtl. מעורבת — ניקוד ראיות (חיובי = rtl):
    יישור לימין/שמאל מול שורות אחרות באותו גודל (±2), כותרת עם נקודתיים בקצה ("הכלים:" מימין / "Speaker:" משמאל, ±2),
    מילת RTL בקצה השמאלי (+1.5, הכלל של Tesseract), אי בסוגריים (‎-2/+1), רוב האותיות כשעברית שוקלת פי 1.5 (±1),
    מילות הדקדוק של שפת המסגרת (±2) וכיוון השקף (±0.5). תיקו — rtl."""
    if not words:
        return "ltr"
    txt = " ".join(t for _, t in words)
    n_r, n_l = len(RTLC.findall(txt)), len(LTRC.findall(txt))
    if not n_r:
        return "ltr"
    if not n_l:
        return "rtl"
    ws = sorted(words, key=lambda w: w[0])
    left, right = ws[0][1], ws[-1][1]
    s = 0.0
    if align == "r":
        s += 2
    elif align == "l":
        s -= 2
    if right.endswith(":") and tclass(right) == "R":
        s += 2
    if left.endswith(":") and tclass(left) == "L":
        s -= 2
    if tclass(left) == "R":
        s += 1.5
    # אי בסוגריים הוא תוספת לשורה: עברית בסוגריים בשורה לטינית ("Our team (הצוות)") — LTR, ולהפך ("ראשון (Zoom)")
    lt, rt = reorder(words, "ltr"), reorder(words, "rtl")
    if re.search(r"\([^()A-Za-z]*" + RTLC.pattern + r"[^()A-Za-z]*\)", lt) and not re.search(r"\(.*" + LTRC.pattern, lt):
        s -= 2
    if re.search(r"\([^()]*" + LTRC.pattern + r"[^()]*\)", rt) and not re.search(r"\([^()]*" + RTLC.pattern, rt):
        s += 1
    s += 1 if n_r * 1.5 >= n_l else -1
    # שפת המסגרת: מילות הדקדוק (מילות יחס, כינויים, "על", ‏"the") ותחילית עם מקף ("ב־") שייכות לשפה שבה המשפט
    # בנוי — "הרצאה על Machine Learning" עברית גם כשרוב האותיות לטיניות, ‏"Our team in Israel (…)" אנגלית
    fh = sum(1 for _, t in words if t.strip(".,:;!?\"'()") in FW_HE or (t[-1:] in HYPH and t[:-1] in PREFIXES))
    fe = sum(1 for _, t in words if t.strip(".,:;!?\"'()").lower() in FW_EN)
    s += 2 if fh > fe else -2 if fe > fh else 0
    s += 0.5 * prior
    return "rtl" if s >= 0 else "ltr"


def reorder_line(words: list[tuple[int, str]], base: str | None = None) -> str:
    """[(x שמאלי, טקסט)] → טקסט בסדר הקריאה. בלי base — הכיוון נקבע מהמילים עצמן (line_dir)."""
    return reorder(words, base or line_dir(words))


# ---------------------------------------------------------------- מילים → שורות

def split_gaps(ws: list[dict], k: float = GAP_K) -> list[list[dict]]:
    """שורה של Tesseract → חלקים, בפער אופקי גדול מ־k × גובה המילים (חציון). עמודות שונות באותו גובה נפרדות."""
    ws = sorted(ws, key=lambda w: w["x"])
    hs = sorted(w["h"] for w in ws if ALNUM.search(w["text"])) or [w["h"] for w in ws]
    h = hs[len(hs) // 2] if hs else 0
    out = [[ws[0]]] if ws else []
    for a, b in zip(ws, ws[1:]):
        if h and b["x"] - (a["x"] + a["w"]) > k * h:
            out.append([b])
        else:
            out[-1].append(b)
    return out


def _box(ws: list[dict]) -> list[int]:
    x0, y0 = min(w["x"] for w in ws), min(w["y"] for w in ws)
    x1, y1 = max(w["x"] + w["w"] for w in ws), max(w["y"] + w["h"] for w in ws)
    return [x0, y0, x1 - x0, y1 - y0]


def aligns(boxes: list[list[int]]) -> list[str | None]:
    """לכל שורה: 'r' אם הקצה הימני שלה מיושר עם שורה אחרת והשמאלי לא, 'l' בהפך, אחרת None (ממורכזת/יחידה/רוב שווה)."""
    out: list[str | None] = []
    for i, a in enumerate(boxes):
        r = l_ = 0
        for j, b in enumerate(boxes):
            # רק שורות באותו גודל גופן בערך — כותרת גדולה שקצה שלה נופל במקרה ליד קצה של גוף הטקסט אינה "מיושרת"
            if i == j or max(a[3], b[3]) > 1.3 * max(1, min(a[3], b[3])):
                continue
            tol = max(6, 0.35 * min(a[3], b[3]))
            same_r = abs((a[0] + a[2]) - (b[0] + b[2])) <= tol
            same_l = abs(a[0] - b[0]) <= tol
            if same_r and not same_l:
                r += 1
            elif same_l and not same_r:
                l_ += 1
        out.append("r" if r > l_ else "l" if l_ > r else None)
    return out


def lines(words: list[dict]) -> list[dict]:
    """מילים → שורות בסדר של Tesseract (בלוק, פסקה, שורה), אחרי סינון רעש, פיצול בפערים, כיוון וסדר לוגי."""
    groups: dict[tuple, list] = {}
    for w in words:
        if w["conf"] < WORD_CONF and len(ALNUM.findall(w["text"])) < 3:
            continue
        groups.setdefault(w["key"], []).append(w)
    allt = " ".join(w["text"] for w in words)
    n_r, n_l = len(RTLC.findall(allt)), len(LTRC.findall(allt))
    prior = 1 if n_r > n_l else -1 if n_l > n_r else 0
    parts: list[list[dict]] = []
    for key in sorted(groups):
        ps = split_gaps(groups[key])
        if prior > 0:
            ps = ps[::-1]                       # שקף RTL — העמודה הימנית קודם
        parts.extend(ps)
    boxes = [_box(ws) for ws in parts]
    al = aligns(boxes)
    out = []
    for ws, box, a in zip(parts, boxes, al):
        tw = [(w["x"], w["text"]) for w in ws]
        d = line_dir(tw, a, prior)
        text = reorder(tw, d)
        if not ALNUM.search(text):
            continue
        conf = sum(w["conf"] for w in ws) / len(ws)
        if len(text) <= 3 and conf < LINE_CONF:
            continue
        segs = segments(text)
        lgs = {lg for _, lg in segs}
        lang = lgs.pop() if len(lgs) == 1 else ("mix" if lgs else "other")
        x = {"text": text, "conf": int(round(conf)), "box": box, "lang": lang, "dir": d, "words": len(ws)}
        if lang == "mix":
            x["segs"] = segs
        out.append(x)
    return out


def page_langs(ls: list[dict]) -> dict:
    """חלק כל שפה מהאותיות בתמונה (‏≥ 2%), מעוגל לשתי ספרות."""
    cnt: dict[str, int] = {}
    for x in ls:
        for t, lg in (x.get("segs") or [[x["text"], x["lang"]]]):
            n = sum(1 for c in t if script_of(c))
            if n and lg not in ("other", "mix"):
                cnt[lg] = cnt.get(lg, 0) + n
    tot = sum(cnt.values())
    return {k: round(v / tot, 2) for k, v in sorted(cnt.items(), key=lambda kv: -kv[1]) if tot and v / tot >= 0.02}


# ---------------------------------------------------------------- הרצה

def run_tsv(src, langs_: str | None = None, psm: int = PSM, timeout: float = TIMEOUT) -> str:
    """Tesseract על נתיב לתמונה, או על bytes של תמונה (דרך stdin) → TSV. נכשל → RuntimeError."""
    exe = tess()
    if not exe:
        raise RuntimeError("Tesseract לא מותקן")
    data = None
    if isinstance(src, (bytes, bytearray)):
        data, arg = bytes(src), "stdin"
    else:
        arg = str(src)
    p = subprocess.run([exe, arg, "stdout", "-l", langs_ or LANGS, "--psm", str(psm), "tsv"], input=data,
                       capture_output=True, timeout=timeout, env=_env())
    if p.returncode != 0:
        raise RuntimeError(f"tesseract ({p.returncode}): {p.stderr.decode('utf-8', 'replace')[-300:].strip()}")
    return p.stdout.decode("utf-8", "replace")


_HOCR = re.compile(r"class='(ocr_page|ocrx_word|ocrx_cinfo)'[^>]*?title='([^']*)'[^>]*>([^<]*)")
_NUMS = re.compile(r"-?\d+(?:\.\d+)?")


def parse_hocr(out: str) -> list[list[dict]]:
    """hOCR עם hocr_char_boxes → לכל עמוד רשימת מילים {text, conf, box, chars: [(תו, x0, x1, conf, y0, y1)]} בסדר
    הלוגי."""
    pages: list[list[dict]] = []
    for kind, title, body in _HOCR.findall(out or ""):
        if kind == "ocr_page":
            pages.append([])
            continue
        if not pages:
            pages.append([])
        nums = [float(x) for x in _NUMS.findall(title)]
        if kind == "ocrx_word" and len(nums) >= 5:
            pages[-1].append({"text": "", "conf": nums[4], "box": [int(n) for n in nums[:4]], "chars": []})
        elif kind == "ocrx_cinfo" and len(nums) >= 5 and pages[-1]:
            ch = html.unescape(body)
            w = pages[-1][-1]
            w["chars"].append((ch, int(nums[0]), int(nums[2]), nums[4], int(nums[1]), int(nums[3])))
            w["text"] += ch
    for pg in pages:
        for w in pg:
            w["text"] = clean(w["text"])
    return pages


def run_hocr(images: list, lang: str, psm: int = 7, timeout: float = TIMEOUT) -> list[list[dict]]:
    """כמה חיתוכים (PIL) בהרצה אחת: TIFF מרובה עמודים ב־stdin, ‏hOCR עם תיבה לכל תו. עמוד לכל חיתוך."""
    if not images:
        return []
    buf = io.BytesIO()
    images[0].save(buf, format="TIFF", save_all=True, append_images=images[1:], compression="tiff_lzw")
    p = subprocess.run([tess(), "stdin", "stdout", "-l", lang, "--psm", str(psm), "-c", "hocr_char_boxes=1", "hocr"],
                       input=buf.getvalue(), capture_output=True, timeout=timeout, env=_env())
    if p.returncode != 0:
        raise RuntimeError(f"tesseract ({p.returncode}): {p.stderr.decode('utf-8', 'replace')[-300:].strip()}")
    pages = parse_hocr(p.stdout.decode("utf-8", "replace"))
    return (pages + [[] for _ in images])[:len(images)]


def png_bytes(img) -> bytes:
    """תמונת PIL או מערך numpy (אפור / RGB) → PNG בזיכרון."""
    from PIL import Image
    if not isinstance(img, Image.Image):
        img = Image.fromarray(img)
    buf = io.BytesIO()
    img.save(buf, format="PNG", compress_level=1)
    return buf.getvalue()


def _rgb(src):
    """נתיב / bytes / PIL / numpy → PIL RGB."""
    from PIL import Image
    if isinstance(src, Image.Image):
        im = src
    elif isinstance(src, (bytes, bytearray)):
        im = Image.open(io.BytesIO(bytes(src)))
    elif isinstance(src, (str, Path)):
        im = Image.open(str(src))
    else:
        im = Image.fromarray(src)
    im.load()
    return im.convert("RGB")


def _crop(im, x0: int, y0: int, x1: int, y1: int, pad: int, cut_l: bool = False, cut_r: bool = False):
    """חיתוך עם שוליים, ממורכז על רקע בצבע הפינה — כמו מילה בודדת על השקף. cut_l/cut_r — הצד נחתך בדיוק בקו
    (בלי תוכן מעבר לו; נקודת פיצול של בלוב), והשוליים שם מרקע בלבד."""
    from PIL import Image
    x0 = max(0, x0 - (0 if cut_l else pad))
    x1 = min(im.width, x1 + (0 if cut_r else pad))
    y0, y1 = max(0, y0 - pad), min(im.height, y1 + pad)
    c = im.crop((x0, y0, x1, y1))
    bg = c.getpixel((0, 0))
    out = Image.new("L", (c.width + 2 * pad, c.height + 2 * pad), bg)
    out.paste(c, (pad, pad))
    return out, x0 - pad


def _letters(t: str) -> str:
    return "".join(c for c in t if c.isalpha())


def _heb_clean(t: str) -> bool:
    """קריאה עברית "נקייה": 2 אותיות לפחות, כולן עבריות, בלי ניקוד וספרות."""
    a = _letters(t)
    return len(a) >= 2 and all(HEB.match(c) for c in a) and not NIQQUD.search(t) and not any(c.isdigit() for c in t)


def _lat_edges(t: str) -> str:
    """ניקוי קצות חלק לועזי שנחתך מבלוב: שאריות מקף, גרש ומירכאות (‎"Learning”"‎, ‎"JSON\""‎). פיסוק סוף משפט
    בראש המילה (".JSON") נשאר — הסידור מעביר אותו לסוף האי."""
    return t.strip().rstrip(HYPH + QUOTES + "!|").lstrip(HYPH + QUOTES + "|")


def _pre_of(t: str) -> str | None:
    """קריאה עברית של חיתוך התחילית → התחילית הארוכה ביותר מ־PREFIXES שבראש הקריאה (שארית המקף נקראת לפעמים
    כאות: "ודצ" → "ו")."""
    t = t.strip()
    if t[:1] in ("\u05df", "\u05d6", "\u05d9", "|", "1", "l", "I", "!"):
        t = "\u05d5" + t[1:]          # קו אנכי בודד בראש התחילית (נקרא ן/ז/י/|) — ו׳; אף אחד מהם אינו תחילית
    t = "".join(c for c in t if HEB.match(c))
    for n in (3, 2, 1):
        if t[:n] in PREFIXES:
            return t[:n]
    return None


def _ref(chars: list[tuple]) -> tuple[float, float] | None:
    """(ראש, גובה) חציוניים של אותיות המילה — קנה מידה לזיהוי מקף לפי צורה."""
    hs = sorted((c[5] - c[4], c[4]) for c in chars if len(c) >= 6 and c[0].isalpha())
    if not hs:
        return None
    h, top = hs[len(hs) // 2]
    return top, max(1, h)


def _dash(c: tuple, ref) -> bool:
    """תו שהוא מקף: לפי הקריאה, או לפי הצורה — שטוח (רחב פי 1.5 מגובהו) ונמוך מאוד ביחס לאותיות (מקף שנקרא "e"
    או "~"). בלי תנאי על הגובה בשורה: המקף העברי (U+05BE) יושב למעלה, הלטיני באמצע; נקודה ופסיק אינם שטוחים."""
    if c[0] in HYPH:
        return True
    if not ref or len(c) < 6:
        return False
    h = c[5] - c[4]
    return h < 0.4 * ref[1] and c[2] - c[1] >= 1.5 * max(1, h)


def _prefix_split(chars: list[tuple]) -> tuple[str, int] | None:
    """קריאה עברית של מילה דבוקה (סדר לוגי) שמתחילה בתחילית + מקף → (התחילית, ה־x השמאלי של המקף)."""
    pre = ""
    ref = _ref(chars)
    for c in chars:
        if pre in PREFIXES and _dash(c, ref):
            return pre, c[1]
        if not HEB.match(c[0]) or len(pre) >= 3:
            return None
        pre += c[0]
    return None


def _tail_at(chars: list[tuple]) -> int | None:
    """קריאה באנגלית (משמאל לימין) של בלוב 'מונח־תחילית': האינדקס של המקף — אחריו עד 3 תווים (התחילית, שנקראה
    כזבל), ולפניו מונח לועזי נקי. בלי תווים אחריו — סתם שארית בקצה ("XML’")."""
    ref = _ref(chars)
    t = "".join(c[0] for c in chars)
    for n in range(max(2, len(chars) - 4), len(chars)):
        c = chars[n]
        if (_dash(c, ref) or c[0] in QUOTES or not c[0].isalnum()) and CLEAN_LAT.fullmatch(t[:n]):
            return n
    return None


def _conf(ps: list[dict]) -> float:
    """ביטחון קריאה: ממוצע התווים האלפאנומריים (ביטחון המילה של Tesseract נענש על גרש או מירכאות בקצה)."""
    cs = [c[3] for x in ps for c in x["chars"] if c[0].isalnum()]
    if cs:
        return sum(cs) / len(cs)
    return sum(x["conf"] for x in ps) / len(ps) if ps else 0


def _suspect(w: dict, line_r: bool) -> str | None:
    """מילה שכדאי לקרוא שוב: 'num' — "01" או "8" לבד (אולי "Q1", ‏"B", ‏"&"); ובשורה עם עברית: 'lat' — לטינית (אולי
    עברית שנקראה לא נכון, או דבוקה לתחילית); 'glue' — עברית/מעורבת בביטחון נמוך עם ספרות, ניקוד או סימנים, או
    תחילית+מקף+משהו שאינו מספר (מונח לועזי שנקרא בעברית); 'acr' — מילה עברית קצרה וחלשה (ראשי תיבות לועזיים: "KPI"
    → "חא")."""
    t = w["text"]
    if ZNUM.match(t):
        return "num"
    if not line_r:
        return None
    c = tclass(t)
    if c == "L" and len(LAT.findall(t)) >= 2 and not re.search(r"[/=@]|\.\w", t):
        return "lat"
    if GLUED.match(t):
        return "glue"
    if c in "RM" and (c == "M" or w["conf"] < 60) and (NIQQUD.search(t) or re.search(r"\d|[!*|\\\]\[]", t)
                                                       or any(h in t for h in HYPH)):
        return "glue"
    if c == "R" and len(_letters(t)) <= 3 and w["conf"] < 75 and t not in FW_HE and t not in PREFIXES:
        return "acr"
    return None


def _repair(im, words: list[dict]) -> dict:
    """תיקון מילים דבוקות ומילים עבריות שנקראו כלטיניות (ראו בראש הקובץ). משנה את words במקום; מחזיר מונים."""
    by_key: dict[tuple, list[dict]] = {}
    for w in words:
        by_key.setdefault(w["key"], []).append(w)
    cand, ctx = [], {}
    for ws in by_key.values():
        line_r = any(RTLC.search(w["text"]) for w in ws)
        ws = sorted(ws, key=lambda w: w["x"])
        for i, w in enumerate(ws):
            k = _suspect(w, line_r)
            if k:
                cand.append((w, k))
                # מילה לטינית שמשני צדיה מילים לטיניות ("Our team in Israel") — לא עברית שנקראה לא נכון
                ctx[id(w)] = 0 < i < len(ws) - 1 and tclass(ws[i - 1]["text"]) == "L" and tclass(ws[i + 1]["text"]) == "L"
    cand = cand[:MAX_FIX]
    st = {"cand": len(cand), "heb": 0, "eng": 0, "split": 0}
    if not cand:
        return st
    crops = []
    for w, _k in cand:
        pad = max(4, w["h"] // 3)
        c, ox = _crop(im, w["x"], w["y"], w["x"] + w["w"], w["y"] + w["h"], pad)
        crops.append((c, ox, pad))
    with ThreadPoolExecutor(2) as ex:
        fh = ex.submit(run_hocr, [c for c, _, _ in crops], "heb")
        fe = ex.submit(run_hocr, [c for c, _, _ in crops], "eng")
        heb, eng = fh.result(), fe.result()
    plan = []          # (מילה, x של הפיצול בתמונה, x שבו מתחילה התחילית, התחילית אם ידועה, סוג)
    for (w, k), (c, ox, pad), hp, ep in zip(cand, crops, heb, eng):
        ht = " ".join(x["text"] for x in hp)
        hc = sum(x["conf"] for x in hp) / len(hp) if hp else 0
        et = " ".join(x["text"] for x in ep)
        ec = _conf(ep)
        if k == "num":
            # "Ql"/"QI"/"QO" — באנגלית הספרה אחרי האות נקראת לפעמים כאות
            et = et[:1] + et[1:].translate(str.maketrans("lIOo", "1100")) if len(et) > 1 else et
            if len(ep) == 1 and CELL.match(et) and ep[0]["conf"] >= 70 and et != w["text"]:
                w.update(text=et, conf=float(ep[0]["conf"]))
                st["eng"] += 1
            continue
        if k == "acr":
            if (len(ep) == 1 and re.fullmatch(r"[A-Z]{2,5}", et) and ep[0]["conf"] >= LAT_SURE
                    and not (_heb_clean(ht) and hc >= 80)):
                w.update(text=et, conf=float(ep[0]["conf"]))
                st["eng"] += 1
            continue
        # מילה לועזית נקייה ובטוחה ("Dr.", ‏"Sarah") — לא מפצלים לפי קריאה עברית של אותיות לטיניות. ביטחון המילה
        # (לא התווים): Tesseract בטוח בכל תו גם ב־"JSON2", אבל המילה כולה מקבלת 11
        sure = len(ep) == 1 and ep[0]["conf"] >= LAT_SURE and CLEAN_LAT.fullmatch(et) is not None
        hw = max(hp, key=lambda x: x["box"][2]) if hp else None      # המילה הימנית — שם התחילית
        sp = _prefix_split(hw["chars"]) if hw and hw["chars"] and not sure else None
        if sp:
            plan.append((w, ox + sp[1], ox + sp[1], sp[0] + "\u05be", k))
            continue
        # התחילית כבר נקראה במעבר הראשון ("ל-100%5") — נשאר רק למצוא את נקודת הפיצול בקריאה האנגלית
        g = re.match(r"^([\u05d0-\u05ea]{1,3})[" + HYPH + "]", w["text"])
        known = g.group(1) + "\u05be" if g and g.group(1) in PREFIXES else None
        wc = sum(x["conf"] for x in ep) / len(ep) if ep else 0
        if (k == "lat" and _heb_clean(ht) and hc >= max(HEB_OK, wc + 5) and not ctx.get(id(w))
                and not (len(_letters(et)) >= 6 and wc >= LAT_KEEP)):
            w.update(text=ht, conf=hc)
            st["heb"] += 1
            continue
        n = _tail_at(ep[0]["chars"]) if len(ep) == 1 and ep[0]["chars"] and not sure else None
        if n is not None:
            ch = ep[0]["chars"]
            if n + 1 < len(ch) or known:
                # אחרי המקף — התחילית (שנקראה באותיות לטיניות); היא מתחילה בקצה הימני של המקף
                plan.append((w, ox + ch[n][1], ox + ch[n][2], known, k))
                continue
            et = "".join(x[0] for x in ch[:n])
        lt = _lat_edges(et)
        if (k == "glue" and ec >= max(60, w["conf"] + 20) and tclass(lt) == "L" and len(_letters(lt)) >= 2
                and not (_heb_clean(ht) and hc >= HEB_OK)):
            w.update(text=lt, conf=ec)
            st["eng"] += 1
    if not plan:
        return st
    lat_c, pre_c = [], []
    for w, sx, px, _pre, _k in plan:
        pad = max(4, w["h"] // 3)
        lat_c.append(_crop(im, w["x"], w["y"], max(w["x"] + 1, sx), w["y"] + w["h"], pad, cut_r=True)[0])
        pre_c.append(_crop(im, min(px, w["x"] + w["w"] - 1), w["y"], w["x"] + w["w"], w["y"] + w["h"], pad,
                           cut_l=True)[0])
    with ThreadPoolExecutor(2) as ex:
        fl = ex.submit(run_hocr, lat_c, "eng")
        fp = ex.submit(run_hocr, pre_c, "heb")
        lat, pre = fl.result(), fp.result()
    for (w, sx, _px, known, k), lp, pp in zip(plan, lat, pre):
        lt = _lat_edges(" ".join(x["text"] for x in lp))
        lc = sum(x["conf"] for x in lp) / len(lp) if lp else 0
        if tclass(lt) not in "LN" or lc < 60:
            continue
        pre_ = known[:-1] if known else _pre_of(" ".join(x["text"] for x in pp))
        if not pre_:
            if k == "glue":                    # אין תחילית — המילה כולה מונח לועזי שנקרא בעברית
                w.update(text=lt, conf=lc)
                st["eng"] += 1
            continue
        x1 = w["x"] + w["w"]
        # התחילית (מימין) והמונח (משמאל) — שתי מילים; הסידור יצמיד את התחילית למילה שאחריה בסדר הלוגי
        words.append(dict(w, x=sx, w=max(1, x1 - sx), text=pre_ + "\u05be", conf=max(w["conf"], 60.0)))
        w.update(w=max(1, sx - w["x"]), text=lt, conf=lc)
        st["split"] += 1
    return st


def _other(t: str) -> bool:
    """קריאה בכתב נוסף שאפשר לסמוך עליה: רוב האותיות ערביות/קיריליות; קירילית — עם מספיק אותיות שאין להן
    תאומה לטינית (אחרת זו כנראה מילה לטינית שנקראה בקירילית: "API" → "АРІ")."""
    a = _letters(t)
    ar, cy = len(ARA.findall(t)), len(CYR.findall(t))
    if not a or ar + cy < 0.6 * len(a):
        return False
    if cy > ar:
        return sum(1 for ch in t if CYR.match(ch) and ch not in CYR_SAME) >= max(1, 0.3 * cy)
    return True


def _extra(im, words: list[dict], extra: str) -> int:
    """שורות שבהן מילים שאינן עברית ברורה נקראו חלש או כ"זבל לטיני" → קריאה חוזרת של השורה עם LANGS+extra
    (ערבית, רוסית…). רק מילים בכתב הנוסף מחליפות, ורק מילים חלשות שהן מכסות — עברית ברורה ולטינית בטוחה לא
    נוגעים. נדרש עוד EXTRA_GAIN בביטחון (5 כשהישנות "זבל"), ולקירילית — 6 אותיות לפחות. מחזירה כמה שורות שונו."""
    by_key: dict[tuple, list[dict]] = {}
    for w in words:
        by_key.setdefault(w["key"], []).append(w)

    def firm(w):
        t = w["text"]
        if _heb_clean(t) and w["conf"] >= 70:
            return True
        return tclass(t) == "L" and len(_letters(t)) >= 3 and w["conf"] >= LAT_SURE and not JUNK.search(t)

    weak = []
    for k, ws in by_key.items():
        soft = [w for w in ws if not firm(w) and _letters(w["text"])]
        if sum(len(_letters(w["text"])) for w in soft) < 3:
            continue
        if sum(w["conf"] for w in soft) / len(soft) < EXTRA_LINE or any(JUNK.search(w["text"]) for w in soft):
            weak.append((k, ws))
    weak = weak[:MAX_FIX]
    if not weak:
        return 0
    crops = []
    for _k, ws in weak:
        b = _box(ws)
        pad = max(4, b[3] // 3)
        c, ox = _crop(im, b[0], b[1], b[0] + b[2], b[1] + b[3], pad)
        crops.append((c, ox, b[1] - pad))
    res = run_hocr([c for c, _, _ in crops], LANGS + "+" + extra, psm=7)
    n = 0
    for (k, ws), (c, ox, oy), pg in zip(weak, crops, res):
        new, hit = [], []
        for x in pg:
            if not _other(x["text"]):
                continue
            x0, x1 = ox + x["box"][0], ox + x["box"][2]
            ov = [w for w in ws if min(x1, w["x"] + w["w"]) - max(x0, w["x"]) > 0.4 * min(x1 - x0, w["w"])]
            if not ov or any(firm(w) for w in ov):
                continue
            new.append(x)
            hit.extend(w for w in ov if w not in hit)
        if not new:
            continue
        cy = sum(len(CYR.findall(x["text"])) for x in new)
        ar = sum(len(ARA.findall(x["text"])) for x in new)
        if (cy > ar and cy < 6) or ar + cy < 3:
            continue
        nc = sum(x["conf"] for x in new) / len(new)
        oc = sum(w["conf"] for w in hit) / len(hit)
        if nc < oc + (5 if any(JUNK.search(w["text"]) for w in hit) else EXTRA_GAIN):
            continue
        for w in hit:
            words.remove(w)
        for i, x in enumerate(new):
            bx = x["box"]
            words.append({"key": k, "n": 100 + i, "x": ox + bx[0], "y": oy + bx[1], "w": bx[2] - bx[0],
                          "h": bx[3] - bx[1], "conf": float(x["conf"]), "text": x["text"]})
        n += 1
    return n


def _subs(rgb, words: list[dict]):
    """כתוביות צרובות על רקע וידאו (ראו בראש הקובץ). משנה את words במקום; מחזיר (כמה שורות נוספו או הוחלפו,
    תמונת אפור שבה אזורי השורות האלה מוחלפים במסכה הנקייה — לקריאות החוזרות של _repair), או (0, None)."""
    import numpy as np
    from PIL import Image, ImageFilter
    a = np.asarray(rgb)
    y0 = int(a.shape[0] * SUB_Y)
    band = a[y0:].astype(np.int16)
    if band.size == 0:
        return 0, None
    g = band.mean(axis=2)
    tex = float(np.abs(np.diff(g, axis=1)).mean() + np.abs(np.diff(g, axis=0)).mean())
    if tex < SUB_TEX:
        return 0, None                              # רקע חלק — שקף; המעבר הראשון מסתדר
    mn, mx = band.min(axis=2), band.max(axis=2)
    m = ((mn >= 185) & (mx - mn <= 45)) | ((band[..., 0] >= 190) & (band[..., 1] >= 170) & (band[..., 2] <= 130))
    if m.mean() < 0.002:
        return 0, None                              # כמעט אין פיקסלים לבנים/צהובים — אין כתוביות
    mk = Image.fromarray(np.where(m, 0, 255).astype(np.uint8)).filter(ImageFilter.MedianFilter(3))
    by: dict[tuple, list[dict]] = {}
    for w in tsv_words(run_tsv(png_bytes(mk))):
        if w["conf"] < 50 and len(ALNUM.findall(w["text"])) <= 2:
            continue                                # נקודות רעש שעברו את המסכה
        w["y"] += y0
        w["key"] = (1000 + w["key"][0],) + tuple(w["key"][1:])
        by.setdefault(w["key"], []).append(w)
    im = None
    n = 0
    for ls in by.values():
        lc = sum(w["conf"] for w in ls) / len(ls)
        if lc < SUB_CONF or sum(len(_letters(w["text"])) for w in ls) < 3:
            continue
        b = _box(ls)
        old = [w for w in words if min(w["y"] + w["h"], b[1] + b[3]) - max(w["y"], b[1]) > 0.5 * min(w["h"], b[3])
               and min(w["x"] + w["w"], b[0] + b[2]) > max(w["x"], b[0])]
        if old and sum(w["conf"] for w in old) / len(old) >= lc - 5 and _box(old)[2] >= 0.8 * b[2]:
            continue                                # המעבר הראשון כבר קרא את השורה הזאת טוב
        for w in old:
            words.remove(w)
        words.extend(ls)
        if im is None:
            im = rgb.convert("L")
        pad = max(4, b[3] // 2)
        bx = (max(0, b[0] - pad), max(y0, b[1] - pad), min(rgb.width, b[0] + b[2] + pad), min(rgb.height, b[1] + b[3] + pad))
        im.paste(mk.crop((bx[0], bx[1] - y0, bx[2], bx[3] - y0)), (bx[0], bx[1]))
        n += 1
    return n, im


def ocr(src) -> dict:
    """תמונה אחת (נתיב, bytes, PIL או numpy) → {lines, words, conf, ms, langs, fix?}. השגיאה נשמרת ולא נזרקת;
    כשל בשלבי התיקון — נשארים עם המעבר הראשון."""
    t0 = time.time()
    try:
        if isinstance(src, (str, Path, bytes, bytearray)):
            tsv = run_tsv(src)
        else:
            tsv = run_tsv(png_bytes(src))
        ws = tsv_words(tsv)
        fix = {}
        if REPAIR:
            try:
                rgb = _rgb(src)
                fix["subs"], im = _subs(rgb, ws)
                if ws and any(RTLC.search(w["text"]) or w["conf"] < EXTRA_LINE or JUNK.search(w["text"])
                              or ZNUM.match(w["text"]) for w in ws):
                    im = im or rgb.convert("L")
                    fix.update(_repair(im, ws))
                    ex = extra_langs()
                    if ex:
                        fix["extra"] = _extra(im, ws, ex)
            except (RuntimeError, OSError, subprocess.SubprocessError, ValueError) as e:
                fix = {"error": str(e)[:120]}
        ls = lines(ws)
        n = sum(x["words"] for x in ls)
        conf = round(sum(x["conf"] * x["words"] for x in ls) / n) if n else 0
        out = {"lines": ls, "words": n, "conf": conf, "ms": int((time.time() - t0) * 1000), "langs": page_langs(ls)}
        if any(fix.get(k) for k in ("subs", "heb", "eng", "split", "extra", "error")):
            out["fix"] = {k: v for k, v in fix.items() if v}
        return out
    except (RuntimeError, OSError, subprocess.SubprocessError, ValueError) as e:
        return {"lines": [], "words": 0, "conf": 0, "ms": int((time.time() - t0) * 1000), "langs": {},
                "error": str(e)[:300]}


class Pool:
    """כמה תהליכי OCR במקביל, בגבול שאפשר לשנות תוך כדי (set_limit). התוצאות בסדר הקלט."""

    def __init__(self, limit: int | None = None, fn=None):
        self.max = max(1, int(limit or PROCS))
        self.limit = self.max
        self.fn = fn or ocr
        self._cv = threading.Condition()
        self._busy = 0
        self.peak = 0

    def set_limit(self, n: int) -> None:
        with self._cv:
            self.limit = max(1, min(self.max, int(n)))
            self._cv.notify_all()

    def _one(self, item):
        with self._cv:
            while self._busy >= self.limit:
                self._cv.wait()
            self._busy += 1
            self.peak = max(self.peak, self._busy)
        try:
            return self.fn(item)
        finally:
            with self._cv:
                self._busy -= 1
                self._cv.notify_all()

    def map(self, items) -> list:
        items = list(items)
        if not items:
            return []
        with ThreadPoolExecutor(max_workers=min(self.max, len(items))) as ex:
            return list(ex.map(self._one, items))
