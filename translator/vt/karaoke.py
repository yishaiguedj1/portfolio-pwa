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
SUNG = "&H003DC8FF"   # זהב — ברירת המחדל של ky.c (ASS = &HAABBGGRR)
UNSUNG = "&H00FFFFFF"
LYR_MAX = 8000        # תווים (= KA_LYR_MAX בשרתון)
WIPE_FPS = 12         # מילוי לאורך המילה: צעדים בשנייה (כל צעד = מצב אחד בצריבה המהירה)
INTERLUDE_S = 8.0     # שקט כזה בין שורות = תווית "נגינה"
TITLE_MIN_S = 1.5     # כרטיס פתיחה רק כשהשורה הראשונה מופיעה אחרי כך

# 31/10/2026: עיצוב הקריוקי (ת־קריוקי ב־docs/standards.md). אותם מפתחות וברירות מחדל ב־studio.js (normKy) ובשרתון
# (ibkr-proxy/lib/studio.js normKy) — tests/studio-karaoke-design.test.js משווה. u לא־שר · c שר · f מילוי (w לאורך המילה,
# d מילה שלמה) · z גודל · cd ספירה · tc כרטיס פתיחה · dm הכהיה עם וידאו · bg רקע בלי וידאו · sg צבע לכל זמר · sb ביחד
KY_DEF = {"u": "#FFFFFF", "c": "#FFC83D", "f": "w", "z": "M", "cd": 1, "tc": 1, "dm": 1, "bg": "dark",
          "sg": ["#3DD6FF", "#FF5CA8", "#7CE38B", "#B48CFF"], "sb": "#FFC83D"}
KY_Z = {"S": 0.85, "M": 1.0, "L": 1.18}
KY_BG = ("dark", "grad", "tint")
_HEX = re.compile(r"^#[0-9a-fA-F]{6}$")

_SINGER = re.compile(r"^\s*[\[(]\s*(?:(?:p|זמר|זמרת|singer|voice|קול)\s*)?([1-4])\s*[\])]\s*:?\s*", re.I)
_TOGETHER = re.compile(r"^\s*[\[(]\s*(?:ביחד|יחד|כולם|שניהם|both|all|together|1\s*[+&]\s*2(?:\s*[+&]\s*[34])*)\s*[\])]\s*:?\s*", re.I)
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
    return _parse(text)[0]


def parse_singers(text: str) -> list:
    """31/10/2026 (דואט): מי שר כל שורה של parse_lyrics — 1..4, ‏0 = ביחד, None = לא סומן. הסימון ("[1]", "[זמר 2]",
    "[ביחד]", "(both)") לבד בשורה או בתחילתה, וחל עד הסימון הבא. בלי שום סימון — רשימה ריקה (שיר של זמר אחד)."""
    lines, sg, any_tag = _parse(text)
    return sg if any_tag else []


def _parse(text: str):
    out: list[list[str]] = []
    sg: list = []
    cur, any_tag = None, False
    for raw in clean_lyrics(text).split("\n"):
        line = raw.strip()
        m = _SINGER.match(line) or _TOGETHER.match(line)
        if m:
            cur, any_tag = (int(m.group(1)) if m.re is _SINGER else 0), True
            line = line[m.end():].strip()
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
            parts = _split_long(words)
            out.extend(parts)
            sg.extend([cur] * len(parts))
    return out, sg, any_tag


# 01/11/2026: בלי מילים (LRCLIB לא עונה או לא מכיר את השיר) — טיוטת מילים מתמלול הקול המופרד. השורות נשברות בהפסקה
# בשירה, בסוף משפט או אחרי DRAFT_MAXW מילים. מילה שנשמעת בקטע כמעט שקט = הזיה של המודל (Whisper "ממציא" בשקט) — יורדת.
DRAFT_GAP = 0.6       # שנ׳ של הפסקה ששוברת שורה
DRAFT_MAXW = 8        # מילים לשורה לכל היותר
DRAFT_MINW = 2        # שורה לא נשברת לפני כך (חוץ מהפסקה ארוכה)
GATE_DB = -26.0       # מילה בעוצמה נמוכה מזה ביחס לשירה (אחוזון 95) — לא נשמעה באמת
_EDGE = re.compile(r"^[\s.,!?;:…\"“”„()\[\]{}\-–—]+|[\s.,!?;:…\"“”„()\[\]{}\-–—]+$")


def gate(words: list[dict], audio, sr: int = 16000) -> list[dict]:
    """רק המילים שנשמעות בקול המופרד (עוצמה מעל GATE_DB מתחת לשירה הרגילה)."""
    import numpy as np
    a = np.asarray(audio, dtype=np.float32)
    if a.ndim > 1:
        a = a.mean(axis=1)
    hop = max(1, int(sr * 0.05))
    n = len(a) // hop
    if n < 2:
        return list(words)
    rms = np.sqrt((a[: n * hop].reshape(n, hop) ** 2).mean(axis=1) + 1e-12)
    ref = float(np.percentile(rms, 95)) or 1e-6
    lim = ref * 10 ** (GATE_DB / 20)
    out = []
    for w in words:
        i, j = int(float(w["s"]) * sr / hop), int(float(w["e"]) * sr / hop) + 1
        if i < n and float(rms[i:min(n, max(j, i + 1))].max()) >= lim:
            out.append(w)
    return out


def draft_lines(words: list[dict]) -> list[str]:
    """מילים מתוזמנות → שורות טקסט (טיוטת המילים). בלי פיסוק בקצוות, בלי לולאות של מודל (אותה מילה 4+ פעמים ברצף)."""
    lines, cur, prev, rep = [], [], None, 0
    for w in words:
        txt = _EDGE.sub("", _CTRL.sub("", str(w.get("w") or ""))).strip()
        if not norm(txt):
            continue
        rep = rep + 1 if prev is not None and norm(txt) == norm(prev["w"]) else 0
        if rep >= 3:
            continue
        if cur and (float(w["s"]) - float(prev["e"]) >= DRAFT_GAP * (1 if len(cur) >= DRAFT_MINW else 3)
                    or len(cur) >= DRAFT_MAXW
                    or (len(cur) >= 3 and str(prev.get("raw", "")).rstrip()[-1:] in ".?!")):
            lines.append(" ".join(cur))
            cur = []
        cur.append(txt)
        prev = {"w": txt, "e": w["e"], "raw": w.get("w") or ""}
    if cur:
        lines.append(" ".join(cur))
    return lines


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
    for li, ln in enumerate(out):
        ln["li"] = li                                # לשיוך הזמר (parse_singers) — לפני הסינון
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
        shown.append({"row": row, "show": round(show, 3), "hide": round(hide, 3), "words": ln["words"], "cd": cd,
                      "s": ln["s"], "e": ln["e"], "sg": ln.get("sg")})
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


def norm_ky(d) -> dict:
    """עיצוב הקריוקי מה־spec → ערכים תקינים (= normKy בטלפון ובשרתון). ערך לא תקין = ברירת המחדל."""
    d = d if isinstance(d, dict) else {}
    hx = lambda v, dv: v.upper() if isinstance(v, str) and _HEX.match(v) else dv
    sg = d.get("sg") if isinstance(d.get("sg"), list) else []
    return {
        "u": hx(d.get("u"), KY_DEF["u"]), "c": hx(d.get("c"), KY_DEF["c"]),
        "f": "d" if d.get("f") == "d" else "w",
        "z": d.get("z") if d.get("z") in KY_Z else "M",
        "cd": 0 if d.get("cd") == 0 else 1, "tc": 0 if d.get("tc") == 0 else 1,
        "dm": d.get("dm") if d.get("dm") in (0, 1, 2) else 1,
        "bg": d.get("bg") if d.get("bg") in KY_BG else "dark",
        "sg": [hx(sg[i] if i < len(sg) else None, KY_DEF["sg"][i]) for i in range(4)],
        "sb": hx(d.get("sb"), KY_DEF["sb"]),
    }


def ass_colour(hx: str, alpha: int = 0) -> str:
    """‎#RRGGBB → ‎&HAABBGGRR של ASS."""
    h = hx.lstrip("#")
    return f"&H{alpha:02X}{h[4:6]}{h[2:4]}{h[0:2]}".upper()


def assign_singers(lines: list[dict], singers: list) -> None:
    """הזמר של כל שורה (מ־parse_singers, לפי li). אין סימון — None."""
    for ln in lines:
        li = ln.get("li")
        ln["sg"] = singers[li] if singers and li is not None and li < len(singers) else None


# 31/10/2026: זיהוי הזמרים כשאין סימון במילים — טביעת קול (vt/diarize, ‏WeSpeaker) על הקול המופרד ואשכול. הספים לשירה
# נמדדו (docs/studio-karaoke-he.md, "זיהוי הזמרים"; MUSDB18: 8 סולו, 28 דואטים סינתטיים): בסף של הדיבור (0.68) שיר סולו
# פוצל לשני זמרים ב־2 מתוך 8 — וצבעים שמתחלפים בשיר של זמר אחד גרועים מצבע אחד. 0.78: סולו 8/8, דואט 25/28, שורות 92%.
SG_TH = 0.78          # מרחק קוסינוס לחיתוך העץ (בדיבור: diarize.THRESH)
SG_MIN_SHARE = 0.15   # זמר עם פחות מזה מזמן השירה — מצורף לזמר של השורה הקודמת
SG_MIN_S = 8.0        # ולפחות כך שניות שירה


def auto_singers(lines: list[dict], wav: str, embed=None) -> list:
    """מי שר כל שורה (timed_lines, לפי li) — 1..4 כמו parse_singers. זמר אחד, אין מודל או תקלה — [] (צבע אחד)."""
    from . import diarize as D
    try:
        import soundfile as sf
        if embed is None:
            p = D.model_path()
            if p is None:
                return []
            embed = D.Embedder(p)
        audio, sr = sf.read(wav, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != D.SR:
            return []
        words = [{"w": w["w"], "s": float(w["s"]), "e": float(w["e"]), "li": ln["li"]} for ln in lines for w in ln["words"]]
        if not words or D.assign(words, audio, embed, SG_TH).get("speakers", 0) < 2:
            return []
    except Exception:                                 # זיהוי הזמרים לא מפיל קריוקי
        return []
    per: dict = {}                                    # לכל שורה: שניות שירה לכל זמר
    for w in words:
        d = per.setdefault(w["li"], {})
        d[w["spk"]] = d.get(w["spk"], 0.0) + max(0.05, w["e"] - w["s"])
    line_sg = {li: max(d, key=d.get) for li, d in per.items()}
    tot: dict = {}
    for li, d in per.items():
        tot[line_sg[li]] = tot.get(line_sg[li], 0.0) + sum(d.values())
    allt = sum(tot.values()) or 1.0
    weak = {s for s, t in tot.items() if t < SG_MIN_SHARE * allt or t < SG_MIN_S}
    prev = None
    for li in sorted(line_sg):
        if line_sg[li] in weak:
            line_sg[li] = prev if prev is not None else max(tot, key=tot.get)
        prev = line_sg[li]
    order = list(dict.fromkeys(line_sg[li] for li in sorted(line_sg)))
    if len(order) < 2:
        return []
    num = {s: min(4, k + 1) for k, s in enumerate(order)}
    out: list = [None] * (max(line_sg) + 1)
    for li, s in line_sg.items():
        out[li] = num[s]
    return out


def states(shown: list[dict], wipe: bool) -> list[tuple[float, float, int, int, float, int]]:
    """(התחלה, סוף, שורה, מילה, כמה ממנה נשמע 0..1, שורה במסך). מילה שלמה — אחד לכל מילה (= events);
    לאורך המילה — בזמן שהמילה נשמעת, WIPE_FPS צעדים בשנייה (כל צעד מצויר פעם אחת בצריבה המהירה)."""
    out = []
    for a, b, li, i, row in events(shown):
        if i < 0 or not wipe:
            out.append((a, b, li, i, 1.0, row))
            continue
        w = shown[li]["words"][i]
        ws, we = max(a, w["s"]), min(b, w["e"])
        n = max(1, min(24, int(round((we - ws) * WIPE_FPS)))) if we > ws else 0
        t = a
        for k in range(n):
            t1 = ws + (we - ws) * (k + 1) / n
            if t1 > t:
                out.append((round(t, 3), round(t1, 3), li, i, (k + 1) / n, row))
            t = t1
        if b > t:
            out.append((round(t, 3), b, li, i, 1.0, row))
    return out


def _sung_hex(ln: dict, ky: dict) -> str:
    sg = ln.get("sg")
    if sg is None:
        return ky["c"]
    return ky["sb"] if sg == 0 else ky["sg"][sg - 1]


def _tag_label(sg: int, n_singers: int) -> str:
    return str(sg) if sg else "+".join(str(k) for k in range(1, max(2, n_singers) + 1))


def write_ass(shown: list[dict], style, width: int, height: int, title: str = "", rtl_text: bool = False,
              ky: dict | None = None, video: bool = True) -> str:
    """ASS לצריבה לפי ת־קריוקי: שתי שורות בתחתית, מילוי לאורך המילה (מימין לשמאל בעברית) או מילה שלמה, צבע לכל
    זמר + סמן בתחילת השורה, נקודות ספירה בצבע של מי שנכנס, כרטיס פתיחה, תווית "נגינה", הכהיה בתחתית הווידאו.
    בלי \\k / \\kf (ראו בראש הקובץ): המילוי = שכבת "שר" עם \\clip מלבני לפי רוחב המילים. כל אירוע עם \\an2\\pos —
    כך הצריבה המהירה מציירת רק את רצועת הכתוביות (vt/overlay.py ‏_band)."""
    from dataclasses import replace
    from .subs import _ass_time, _alpha_colour
    from . import config as C
    ky = norm_ky(ky)
    k = KY_Z[ky["z"]]
    style = replace(style, size=style.size * k, line_pitch=style.line_pitch * k, outline=style.outline * k,
                    faux_bold=style.faux_bold * k, spacing=style.spacing * k)
    st = style.scaled(width, height)
    U = ass_colour(ky["u"])
    x = width / 2.0
    tag_size = st.size * 0.5
    head = [
        "[Script Info]", f"Title: {_esc(title)}", "ScriptType: v4.00+", f"PlayResX: {width}", f"PlayResY: {height}",
        "WrapStyle: 2", "ScaledBorderAndShadow: yes", "YCbCr Matrix: None", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, "
        "Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, "
        "Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        (f"Style: Main,{style.font},{st.size:.1f},{U},{U},"
         f"{style.outline_colour},{_alpha_colour(style.shadow_alpha)},{style.bold},0,0,0,100,100,"
         f"{st.spacing:.2f},0,1,{st.outline:.2f},{st.shadow:.2f},2,0,0,0,-1"),
        (f"Style: Fill,{style.font},{st.size:.1f},{U},{U},"
         f"{U},&H00000000,{style.bold},0,0,0,100,100,"
         f"{st.spacing:.2f},0,1,{st.faux_bold:.2f},0,2,0,0,0,-1"),
        (f"Style: Tag,{style.font},{tag_size:.1f},&H00100D0B,&H00100D0B,{ass_colour(ky['c'])},&HFF000000,"
         f"1,0,0,0,100,100,0,0,3,{tag_size * 0.32:.2f},0,2,0,0,0,-1"),
        "", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    ev = []
    pitch = st.line_pitch * 1.25
    ys = [st.bottom_y - pitch, st.bottom_y]          # שורה 0 למעלה, שורה 1 למטה
    blur = f"\\blur{st.blur:.2f}" if st.blur > 0 else ""
    pre = "\u200f" if rtl_text else ""
    end_t = max((ln["hide"] for ln in shown), default=0.0) + 1.0

    # הכהיה בתחתית הווידאו — מלבן מטושטש מראש רצועת הכתוביות עד התחתית
    if video and ky["dm"] and shown:
        top = ys[0] - st.line_pitch * 1.05 - st.size * 1.15 - (st.size * 0.25 + 40) + 60
        hh = max(10.0, height - top)
        al = {1: 0x80, 2: 0x50}[ky["dm"]]
        ev.append(f"Dialogue: 0,{_ass_time(0)},{_ass_time(end_t)},Main,,0,0,0,,{{\\an2\\pos({x:.1f},{height + 100:.1f})"
                  f"\\bord0\\shad0\\blur{max(8.0, 30 * st.k):.1f}\\c&H000000&\\1a&H{al:02X}&\\p1}}"
                  f"m 0 0 l {width + 200} 0 {width + 200} {hh + 100:.0f} 0 {hh + 100:.0f}{{\\p0}}")

    # רוחב המילים — לגבולות המילוי (אותו מודד של שבירת השורות בכתוביות)
    meas = None
    if ky["f"] == "w":
        try:
            from .hebrew import Measurer
            meas = Measurer(C.FONTS_DIR / style.font_file, st.size, st.spacing, st.outline)
        except Exception:                            # noqa: BLE001 — בלי מודד: מילה שלמה
            meas = None
    g = (lambda t: max(0.0, meas.width(t) - 2 * st.outline) if t else 0.0) if meas else None

    def plain(words, col, fill):
        c = f"\\c{col}" + (f"\\3c{col}" if fill else "")
        return "{" + c + "}" + " ".join(_esc(w["w"]) for w in words)

    geo: dict[int, tuple] = {}
    n_singers = max([ln["sg"] for ln in shown if ln.get("sg")] or [0])
    for a, b, li, i, p, row in states(shown, meas is not None):
        ln = shown[li]
        words, y = ln["words"], ys[row]
        S = ass_colour(_sung_hex(ln, ky))
        pos = f"\\an2\\pos({x:.1f},{y:.1f})"
        if meas is None:                             # מילה שלמה
            parts = []
            for j, w in enumerate(words):
                c = S if j <= i else U
                parts.append(f"{{\\c{c}}}" + _esc(w["w"]))
            txt0 = " ".join(parts)
            ev.append(f"Dialogue: 1,{_ass_time(a)},{_ass_time(b)},Main,,0,0,0,,{{{pos}{blur}}}{pre}{txt0}")
            if st.faux_bold > 0:
                txt1 = " ".join(f"{{\\c{S if j <= i else U}\\3c{S if j <= i else U}}}" + _esc(w["w"]) for j, w in enumerate(words))
                ev.append(f"Dialogue: 2,{_ass_time(a)},{_ass_time(b)},Fill,,0,0,0,,{{{pos}}}{pre}{txt1}")
            continue
        if li not in geo:
            ws = [w["w"] for w in words]
            A = g(" ".join(ws))
            offs = [g(" ".join(ws[:j]) + " ") + st.spacing if j else 0.0 for j in range(len(ws))]
            geo[li] = (A, offs, [g(t) for t in ws])
        A, offs, wd = geo[li]
        ev.append(f"Dialogue: 1,{_ass_time(a)},{_ass_time(b)},Main,,0,0,0,,{{{pos}{blur}}}{pre}{plain(words, U, False)}")
        if st.faux_bold > 0:
            ev.append(f"Dialogue: 2,{_ass_time(a)},{_ass_time(b)},Fill,,0,0,0,,{{{pos}}}{pre}{plain(words, U, True)}")
        if i < 0:
            continue
        y0c, y1c = y - st.size * 1.4, y + st.outline * 2 + 6
        if rtl_text:
            xr = x + A / 2 - offs[i]
            x0c, x1c = xr - p * wd[i], float(width)
            if p >= 1 and i == len(words) - 1:
                x0c = 0.0
        else:
            xl = x - A / 2 + offs[i]
            x0c, x1c = 0.0, xl + p * wd[i]
            if p >= 1 and i == len(words) - 1:
                x1c = float(width)
        clip = f"\\clip({x0c:.0f},{y0c:.0f},{x1c:.0f},{y1c:.0f})"
        ev.append(f"Dialogue: 3,{_ass_time(a)},{_ass_time(b)},Main,,0,0,0,,{{{pos}{blur}{clip}}}{pre}{plain(words, S, False)}")
        if st.faux_bold > 0:
            ev.append(f"Dialogue: 4,{_ass_time(a)},{_ass_time(b)},Fill,,0,0,0,,{{{pos}{clip}}}{pre}{plain(words, S, True)}")

    for ln in shown:
        S = ass_colour(_sung_hex(ln, ky))
        y = ys[ln["row"]]
        if ln.get("sg") is not None:                 # סמן הזמר בתחילת השורה
            lab = _tag_label(ln["sg"], n_singers)
            if g is not None:
                A = g(" ".join(w["w"] for w in ln["words"]))
            else:
                A = sum(len(w["w"]) + 1 for w in ln["words"]) * st.size * 0.5
            mw = len(lab) * tag_size * 0.6 + tag_size * 0.64
            gap = st.size * 0.3
            mx = x + A / 2 + gap + mw / 2 if rtl_text else x - A / 2 - gap - mw / 2
            mx = min(max(mx, mw / 2 + 4), width - mw / 2 - 4)
            my = y - (st.size - tag_size) * 0.45
            ev.append(f"Dialogue: 5,{_ass_time(ln['show'])},{_ass_time(ln['hide'])},Tag,,0,0,0,,"
                      f"{{\\an2\\pos({mx:.1f},{my:.1f})\\3c{S}}}{_esc(lab)}")
        if not (ln["cd"] and ky["cd"]):              # נקודות ספירה לאחור — מעל השורה, בצבע של מי שנכנס
            continue
        s0 = ln["words"][0]["s"]
        yd = y - st.line_pitch * 1.05
        for k2 in range(3):
            a, b = s0 - COUNT_S + k2, s0 - COUNT_S + k2 + 1
            if a < 0:
                continue
            dots = "● " * (3 - k2)
            ev.append(f"Dialogue: 5,{_ass_time(a)},{_ass_time(b)},Main,,0,0,0,,{{\\an2\\pos({x:.1f},{yd:.1f})\\fs{st.size * 0.6:.1f}\\c{S}}}{dots.strip()}")

    if ky["tc"] and title and shown and shown[0]["show"] >= TITLE_MIN_S:      # כרטיס פתיחה
        ev.append(f"Dialogue: 5,{_ass_time(0)},{_ass_time(shown[0]['show'] - 0.2)},Main,,0,0,0,,"
                  f"{{\\an2\\pos({x:.1f},{ys[0]:.1f}){blur}\\fs{st.size * 1.05:.1f}}}{pre}{_esc(title)}")
    lab = "♪ נגינה ♪" if rtl_text else "♪ Instrumental ♪"
    for k2 in range(1, len(shown)):                  # תווית "נגינה" בהפסקה ארוכה
        prev_e, nxt = shown[k2 - 1]["e"], shown[k2]
        if nxt["s"] - prev_e < INTERLUDE_S:
            continue
        a = max(ln["hide"] for ln in shown[:k2]) + 0.4
        b = nxt["show"] - 0.2
        if b - a >= 1.0:
            ev.append(f"Dialogue: 5,{_ass_time(a)},{_ass_time(b)},Main,,0,0,0,,"
                      f"{{\\an2\\pos({x:.1f},{ys[0]:.1f})\\fs{st.size * 0.6:.1f}\\1a&H50&}}{pre}{lab}")
    return "\n".join(head + ev) + "\n"


def bg_ppm(ky: dict, w: int = 480, h: int = 270) -> bytes:
    """רקע לשיר בלי וידאו (בקטן — ffmpeg מגדיל): כהה · מעבר צבע (אלכסון) · צבע הערכה (זוהר מלמטה)."""
    ky = norm_ky(ky)
    base = (0x10, 0x14, 0x18)
    c = tuple(int(ky["c"][i:i + 2], 16) for i in (1, 3, 5))
    mix = lambda t: bytes(int(base[j] + (c[j] - base[j]) * t) for j in range(3))
    rows = []
    for yy in range(h):
        row = bytearray()
        for xx in range(w):
            if ky["bg"] == "grad":
                d = (xx / w + yy / h) / 2
                t = 0.33 * max(0.0, 1 - d / 0.55) + 0.2 * max(0.0, (d - 0.45) / 0.55)
            elif ky["bg"] == "tint":
                dx, dy = (xx - w / 2) / (w * 0.9), (yy - h * 1.2) / (h * 0.9)
                t = 0.33 * max(0.0, 1 - (dx * dx + dy * dy) ** 0.5)
            else:
                t = 0.0
            row += mix(t)
        rows.append(bytes(row))
    return f"P6 {w} {h} 255\n".encode() + b"".join(rows)


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
