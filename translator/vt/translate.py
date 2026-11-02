"""שלב התרגום — מבוצע בתוך הסשן ע"י Claude, כמתרגם אנושי שמכיר את כל הראיון.

הקוד כאן לא מתרגם; הוא:
• מכין "מנות" קריאות (batch_NNN.md) עם כל הנתונים לכל כתובית: דובר, משך,
  תקציב תווים, וההקשר שלפני (כולל התרגום שכבר נעשה) — כדי שהתרגום יהיה רציף.
• קורא את קבצי התשובה (batch_NNN.he.txt) ובודק אותם לעומק (tr-check).
• מאחד הכל לקובץ אחד (he.json) שממנו נבנות הכתוביות.

פורמט התשובה — שורה לכל כתובית:
    #12 הטקסט בעברית
    #13 =            ← הכתובית מתאחדת עם הקודמת (התרגום של #12 מכסה את שתיהן)
    #14 ∅            ← בלי כתובית (מילוי/חזרה שלא מתרגמים)
    #15 באמת? || כן, לגמרי.   ← כתובית של שני דוברים
    ‏'|' בתוך טקסט = שבירת שורה ידנית.
"""

from __future__ import annotations

import csv
import math
import re
from pathlib import Path

from .hebrew import break_lines, normalize_he, visible_len, numbers_in, number_ok_in_he
from .util import fmt_ts

LINE_RE = re.compile(r"^#(\d+)\s?(.*)$")
# 22/10/2026 (ניתוח המאגר): המודל מעתיק לפעמים לתשובה את הסימון של שורת הקלט ("≤84", "[שני דוברים]") —
# ב־Uber ‏109 כתוביות יצאו לצופה עם "≤84" בתחילתן. מסירים כל הד כזה של הקלט מתחילת התשובה
ECHO_RE = re.compile(r"^(?:\s*(?:≤\s*\d+|\[שני דוברים\]|\d{1,2}:\d{2}(?:\.\d+)?\s*·\s*[\d.]+ש׳\s*·?)\s*)+")


def clean_answer(v: str) -> str:
    return ECHO_RE.sub("", v).strip()
# תווי ניקוד בלבד (בלי פיסוק עברי שבאותו טווח: מקף 05BE, פסק 05C0, סוף פסוק 05C3, נו״ן הפוכה 05C6).
# כתוביות עבריות נכתבות בכתיב מלא בלי ניקוד (הנוהג המקצועי; ניקוד גם מכפיל טוקנים פי 2–4).
NIKUD_RE = re.compile(r"[ְ-ׇֽֿׁׂׅׄ]")


def batches(cues: list[dict], size: int = 60) -> list[list[dict]]:
    """מנות בגודל ~size, שנחתכות רק בסוף משפט/תור כדי לא לשבור הקשר."""
    out, cur = [], []
    for i, c in enumerate(cues):
        cur.append(c)
        nxt = cues[i + 1] if i + 1 < len(cues) else None
        end_sent = c["en"].rstrip().endswith((".", "?", "!", "…")) or (nxt and nxt.get("spk") != c.get("spk"))
        if len(cur) >= size and (end_sent or len(cur) >= size * 1.4):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def speaker_label(spk: str | None, speakers: dict) -> str:
    if not spk:
        return "?"
    info = speakers.get(spk, {})
    name = info.get("name")
    g = gender_of(info)
    # 26/10/2026 (ניתוח האיכות: 57 הערות מגדר): המגדר ליד השם בכל החלפת דובר — עד היום רק בטבלה שבתדריך, והמתרגם
    # (בעיקר Haiku) כתב "אני חושב" למראיינת ו"אני מוכנה" לגבר
    tail = " · " + ("אישה" if g == "f" else "גבר") if g else ""
    return (f"{spk} · {name}" if name else spk) + tail


def gender_of(info: dict | None) -> str:
    """'f' / 'm' / '' מתוך שדה המגדר של הדובר (כמו שההגהה כתבה בטבלה: "נקבה", "זכר (לפי השם)")."""
    g = str((info or {}).get("gender") or "")
    f, m = ("נקבה" in g or "אישה" in g), ("זכר" in g or "גבר" in g)
    return "f" if f and not m else "m" if m and not f else ""


_SPK_LABEL = re.compile(r"^\s*\**\s*(S\d{1,2})\b")


def speakers_from_brief(text: str) -> dict[str, dict]:
    """טבלת הדוברים שההגהה כותבת בתדריך (| S1 | שם | תפקיד | מגדר | …) → {S1: {name, role, gender}}.
    לפי שורת הכותרת של הטבלה; תווית שהטבלה אומרת שאינה דובר ("לא דובר נפרד") — בחוץ."""
    out: dict[str, dict] = {}
    cols: dict[str, int] = {}
    for raw in (text or "").splitlines():
        line = raw.strip()
        if not line.startswith("|"):
            cols = {} if not line else cols
            continue
        cells = [x.strip() for x in line.strip("|").split("|")]
        if all(re.fullmatch(r":?-{2,}:?", x) for x in cells if x):
            continue
        m = _SPK_LABEL.match(cells[0]) if cells else None
        if not m:
            hdr = {}
            for i, h in enumerate(cells):
                if "מגדר" in h and "gender" not in hdr:
                    hdr["gender"] = i
                elif "תפקיד" in h and "role" not in hdr:
                    hdr["role"] = i
                elif "שם" in h and "name" not in hdr:
                    hdr["name"] = i
            if "gender" in hdr:
                cols = hdr
            continue
        if not cols:
            continue
        get = lambda k: cells[cols[k]] if k in cols and cols[k] < len(cells) else ""
        name = re.sub(r"\s*\([^)]*\)\s*", " ", get("name")).strip(" ,*")
        if not name or name in ("—", "-") or "לא דובר" in name:
            continue
        out[m.group(1)] = {"name": name[:40], "role": get("role")[:60], "gender": get("gender")[:30]}
    return out


def render_batch(k: int, total: int, batch: list[dict], prev: list[dict], he: dict,
                 speakers: dict) -> str:
    first, last = batch[0]["id"], batch[-1]["id"]
    lines = [f"# מנה {k} מתוך {total} — כתוביות {first}–{last}", "",
             "תרגמו לפי brief.md ו־glossary.tsv. כתבו את התשובה לקובץ "
             f"`batch_{k:03d}.he.txt` — שורה לכל כתובית: `#מספר טקסט`.",
             "תקציב התווים הוא תקרה לקריאה נוחה (17 תווים לשנייה); קצרו בחוכמה, בלי לאבד משמעות.", ""]
    if prev:
        lines += ["## הקשר קודם", ""]
        for c in prev:
            h = he.get(str(c["id"]), "")
            lines.append(f"#{c['id']} [{speaker_label(c.get('spk'), speakers)}] {c['en']}")
            if h:
                lines.append(f"    ← {h}")
        lines.append("")
    lines += ["## לתרגום", ""]
    cur_spk = None
    for c in batch:
        if c.get("spk") != cur_spk:
            cur_spk = c.get("spk")
            lines.append(f"**{speaker_label(cur_spk, speakers)}**")
        meta = f"{fmt_ts(c['speech_s'])[3:]} · {c['dur']:.1f}ש׳ · ≤{c['budget']}"
        if c.get("parts"):
            p1, p2 = c["parts"]
            lines.append(f"#{c['id']} [שני דוברים · {meta}] {speaker_label(p1['spk'], speakers)}: {p1['en']} "
                         f"|| {speaker_label(p2['spk'], speakers)}: {p2['en']}")
        else:
            lines.append(f"#{c['id']} [{meta}] {c['en']}")
    lines.append("")
    return "\n".join(lines)


def parse_answer(text: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("//"):
            continue
        m = LINE_RE.match(line)
        if not m:
            continue
        out[m.group(1)] = clean_answer(m.group(2))
    return out


def load_answers(tr_dir: Path) -> tuple[dict[str, str], list[str]]:
    """התשובות מ־batch_*.he.txt, ואחריהן fixes*.txt שדורסים (תיקוני עריכה/ביקורת).

    תיקון = שורה אחת `#מספר טקסט חדש` בקובץ תיקונים — במקום Edit לכל כתובית בקובצי המנות:
    פלט קצר יותר (בלי old_string) ופחות סבבים, כלומר פחות טוקנים, ובקובץ אחד שקל לסקור.
    """
    he: dict[str, str] = {}
    dups: list[str] = []
    for f in sorted(tr_dir.glob("batch_*.he.txt")):
        for k, v in parse_answer(f.read_text(encoding="utf-8")).items():
            if k in he:
                dups.append(k)
            he[k] = v
    for f in sorted(tr_dir.glob("fixes*.txt")):
        he.update(parse_answer(f.read_text(encoding="utf-8")))
    return he, dups


def render_source(cues: list[dict], speakers: dict, size: int = 150) -> tuple[str, int]:
    """כל הראיון בקובץ אחד, קומפקטי: קוראים אותו פעם אחת — גם להבנה וגם לתרגום.

    עד גרסה 1.2 האנגלית נקראה פעמיים (en.full.txt ואז שוב בכל מנה, עם 8 כתוביות הקשר חוזרות
    וזמן/משך לכל שורה) — פי ~2.3 טוקנים בהקשר, שנקראים מחדש בכל סבב. כאן: תקציב בלבד לכל שורה,
    דובר וזמן רק כשמתחלף דובר, וחלוקה לחלקים שכל אחד נענה בקובץ batch_NNN.he.txt.
    """
    bs = batches(cues, size)
    out = ["# המקור לתרגום — כל הראיון", "",
           "שורה: `#מספר ≤תקציב טקסט`. תשובה לכל חלק בקובץ `batch_NNN.he.txt` (שורה `#מספר טקסט`, "
           "`=` איחוד עם הקודמת, `∅` בלי כתובית, `||` שני דוברים, `|` שבירה ידנית). "
           "תיקונים מאוחרים: `fixes.txt` באותו פורמט (דורס).", ""]
    for k, b in enumerate(bs, start=1):
        out += [f"## חלק {k}/{len(bs)} → batch_{k:03d}.he.txt", ""]
        cur = None
        for c in b:
            if c.get("spk") != cur:
                cur = c.get("spk")
                out.append(f"**{speaker_label(cur, speakers)} · {fmt_ts(c['speech_s'])[:8]}**")
            if c.get("parts"):
                p1, p2 = c["parts"]
                out.append(f"#{c['id']} ≤{c['budget']} [שני דוברים] {speaker_label(p1['spk'], speakers)}: "
                           f"{p1['en']} || {speaker_label(p2['spk'], speakers)}: {p2['en']}")
            else:
                out.append(f"#{c['id']} ≤{c['budget']} {c['en']}")
        out.append("")
    return "\n".join(out), len(bs)


def load_glossary(path: Path) -> list[tuple[str, list[str]]]:
    """glossary.tsv: עמודה 1 = מונח באנגלית, עמודה 2 = עברית (חלופות מופרדות ב־/)."""
    out = []
    if not path.exists():
        return out
    with open(path, encoding="utf-8") as f:
        for row in csv.reader(f, delimiter="\t"):
            if len(row) < 2 or row[0].startswith("#") or not row[0].strip():
                continue
            out.append((row[0].strip(), [x.strip() for x in row[1].split("/") if x.strip()]))
    return out



# 22/10/2026 (מהקורפוס של הייצור: מתוך 195 "מונחים שלא נשמרו" כמחצית — צורה אחרת של אותה מילה, ועוד התרעות שווא):
# כל התרעה כזו נשלחת לסבב התיקונים כ"לשקול" — טוקנים, ולפעמים "תיקון" של משהו תקין.
_URL_RE = re.compile(r"(?:https?://|www\.)\S+|\b[\w.-]+@[\w-]+\.[\w.]+|\b[\w-]+(?:\.[\w-]+)*\.(?:com|co|org|net|io|ai|app|uk|us|me|tv|gov)\b(?:/\S*)?", re.I)
_HE_PREFIX = re.compile(r"^(?:ו?(?:ש|כש|מש|לכש)?[הבלמכ]?)")
_HE_SUFFIX = re.compile(r"(?:ים|ות|יות|ה|ת|י|יים)$")


def term_in_en(term: str, en: str) -> bool:
    """המונח מופיע במקור — לא בתוך כתובת/דומיין (נשארים בלועזית); מונח באותיות גדולות (MAX, ROI) — רק כמו שהוא כתוב"""
    text = _URL_RE.sub(" ", en)
    caps = len(term) >= 2 and term.upper() == term and any(ch.isalpha() for ch in term)
    if caps:
        return re.search(r"(?<![A-Za-z])" + re.escape(term) + r"(?![A-Za-z])", text) is not None
    return re.search(r"(?<![a-z])" + re.escape(term.lower()) + r"(?![a-z])", text.lower()) is not None


def gl_strict(term: str, opts: list[str]) -> bool:
    """24/10/2026: אילו מונחים מהמילון נאכפים (סימון + סבב תיקון). רק: מונח של כמה מילים, ראשי תיבות, או שם במילה אחת
    שמתורגם למילה אחת (Uber = אובר). מילה אחת שתרגומה תלוי בהקשר ("data", או "Soviet" = ברית המועצות כשבהקשר צריך
    "סובייטית") — רק המלצה: בעבודה אמיתית הכפייה שברה משפט ("ברית המועצות. כלכלה מתוכננת" במקום "כלכלה סובייטית")."""
    t = term.strip()
    if " " in t or "-" in t:
        return True
    if len(t) >= 2 and t.upper() == t and any(ch.isalpha() for ch in t):
        return True
    return t[:1].isupper() and all(len(re.findall(r"\S+", re.sub(r"\s*\([^)]*\)", "", o).strip())) == 1 for o in opts)


def _gl_inside(term: str, hit: list[str]) -> bool:
    """24/10/2026: מונח שמוכל במונח ארוך יותר שנמצא באותה כתובית ("Soviet" בתוך "Soviet Union") — נבדק רק הארוך,
    אחרת "ברית המועצות" מסומן כחסר "סובייטי"."""
    return any(len(t2) > len(term) and term_in_en(term, t2) for t2 in hit)


# 24/10/2026 (המחקר על המילון): שלושה חלקים מתורגמים במקביל, ושם שלא במילון יוצא לפעמים בשני כתיבים
# ("קרולינסקה" / "קרולינסקא", "רוסלינג" / "רוזלינג"). לכל שם אנגלי שחוזר: המילים בעברית שדומות לתעתיק שלו,
# ושני כתיבים שההבדל ביניהם הוא רק אמות קריאה / ס־ז / ת־ט / ק־כ — הכתיב הנדיר מסומן לאיחוד (הערה, לא שגיאה).
_NM_TOK = re.compile(r"[A-Z][a-z]{2,}")
_HE_WORD = re.compile(r"[א-ת]{3,}")
_HE_SKEL = str.maketrans({"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ", "ק": "כ", "ז": "ס", "ת": "ט"})
_EN_DI = (("sh", "ש"), ("ch", "צ"), ("th", "ט"), ("ph", "פ"), ("ck", "כ"), ("x", "כס"))
_EN_MAP = str.maketrans({"b": "ב", "c": "כ", "d": "ד", "f": "פ", "g": "ג", "j": "ג", "k": "כ", "l": "ל", "m": "מ",
                         "n": "נ", "p": "פ", "q": "כ", "r": "ר", "s": "ס", "t": "ט", "v": "ב", "z": "ס"})
_HE_PFX_ONLY = re.compile(r"^(?:ו?(?:ש|כש|מש|לכש)?[הבלמכ]?)$")


def he_skel(w: str) -> str:
    """שלד עיצורים: בלי אמות קריאה (א ה ו י) ובלי ע, סופיות כרגילות, ז/ת/ק כמו ס/ט/כ"""
    return re.sub(r"[אהויע]", "", w.translate(_HE_SKEL))


def en_skel(w: str) -> str:
    t = w.lower()
    for a, b in _EN_DI:
        t = t.replace(a, b)
    return re.sub(r"[a-z]", "", t.translate(_EN_MAP))


def _same_word(a: str, b: str) -> bool:
    """אותה מילה עם אות שימוש ("הודו" / "בהודו") — לא שני כתיבים"""
    if a == b or _nm_base(a) == _nm_base(b):
        return True
    lo, hi = (a, b) if len(a) < len(b) else (b, a)
    return hi.endswith(lo) and bool(_HE_PFX_ONLY.match(hi[:-len(lo)]))


def _nm_base(w: str) -> str:
    b = _HE_PREFIX.sub("", w, count=1)
    return b if len(b) >= 3 else w


def name_variants(cues: list[dict], he: dict[str, str]) -> list[str]:
    import difflib
    rows = []
    for c in cues:
        t = he.get(str(c["id"]))
        if t and t not in ("=", "∅"):
            rows.append((str(c["id"]), str(c.get("en") or ""), normalize_he(str(t))))
    lower = {w for _k, en, _t in rows for w in re.findall(r"\b[a-z]{3,}\b", en)}
    by_name: dict[str, list[int]] = {}
    for i, (_k, en, _t) in enumerate(rows):
        for nm in set(_NM_TOK.findall(en)):
            if nm.lower() not in lower:
                by_name.setdefault(nm, []).append(i)
    out, flagged = [], set()
    for nm, idx in sorted(by_name.items()):
        es = en_skel(nm)
        if len(idx) < 2 or len(es) < 3:
            continue
        seen: dict[str, list[int]] = {}          # מילה בעברית → באילו כתוביות
        for i in idx:
            for w in set(_HE_WORD.findall(rows[i][2])):
                if difflib.SequenceMatcher(None, he_skel(_nm_base(w)), es).ratio() >= 0.75:
                    seen.setdefault(w, []).append(i)
        groups: dict[str, list[str]] = {}
        for w in seen:
            groups.setdefault(he_skel(_nm_base(w)), []).append(w)
        for ws in groups.values():
            forms: list[list[str]] = []            # כתיבים שונים (בלי הבדלי אות שימוש)
            for w in ws:
                f = next((f for f in forms if any(_same_word(w, x) for x in f)), None)
                (f.append(w) if f is not None else forms.append([w]))
            if len(forms) < 2:
                continue
            cnt = [len({i for w in f for i in seen[w]}) for f in forms]
            major = forms[cnt.index(max(cnt))]
            for f, n in zip(forms, cnt):
                if f is major:
                    continue
                for i in sorted({i for w in f for i in seen[w]}):
                    if any(i in seen[w] for w in major) or rows[i][0] in flagged:
                        continue
                    flagged.add(rows[i][0])
                    out.append(f"- #{rows[i][0]}: [name] שם '{nm}' נכתב כאן '{min(f, key=len)}' ובשאר הכתוביות "
                               f"'{min(major, key=len)}' — לאחד לכתיב אחד")
    return out


# 25/10/2026 (עבודה אמיתית: "הווקטור" ו"הוקטור" באותו סרטון): אותה מילה בכתיב מלא ובכתיב חסר — ו/י כפולות באמצע המילה
# (לא באות הראשונה: "ו" + מילה שמתחילה ב־ו היא מילה אחרת). הכתיב של רוב הכתוביות מנצח; מילה בת פחות מ־4 אותיות — לא.
# נמדד על 18 עבודות מהמאגר: 4 התראות, 3 נכונות ("לוקטורים", "הוירטואלי", "שהלוה"), אחת שגויה ("לשווק" / "לשוק" — לכן "אם זו אותה מילה").
_SPL_KEY = re.compile(r"(?<=.)(ו)ו|(?<=.)(י)י(?=[א-ת]{2})")   # יי בסוף המילה = צורה אחרת ("עסקים" / "עסקיים", "אליך" / "אלייך")


_SPL_STOP = frozenset("that this with have from they there what when which would about their your just like into then than them were been also because these those very some more only other could should here where going really think know".split())


def _spl_key(w: str) -> str:
    return _SPL_KEY.sub(lambda m: m.group(1) or m.group(2), w)


def spell_variants(cues: list[dict], he: dict[str, str]) -> list[str]:
    """אותה מילה בשני כתיבים (ו/י כפולות). כדי לא לבלבל בין מילים שונות ("בטוח" / "בטווח", "ממדים" / "ממדיים") — רק
    כשהמקור באנגלית של הכתובית חולק מילה עם רוב הכתוביות של הכתיב השני (vector ↔ "וקטור")"""
    rows = []
    for c in cues:
        t = he.get(str(c["id"]))
        if t and t not in ("=", "∅"):
            en = {w[:5] for w in re.findall(r"[a-z]{4,}", str(c.get("en") or "").lower()) if w not in _SPL_STOP}
            rows.append((str(c["id"]), set(re.findall(r"[א-ת]{4,}", normalize_he(str(t)))), en))
    seen: dict[str, dict[str, list[int]]] = {}
    for i, (_k, ws, _en) in enumerate(rows):
        for w in ws:
            seen.setdefault(_spl_key(w), {}).setdefault(w, []).append(i)
    out, flagged = [], set()
    for forms in seen.values():
        if len(forms) < 2:
            continue
        major = max(forms, key=lambda w: (len(forms[w]), w.count("ו") + w.count("י")))   # שוויון — הכתיב המלא
        en_cnt: dict[str, int] = {}
        for i in forms[major]:
            for e in rows[i][2]:
                en_cnt[e] = en_cnt.get(e, 0) + 1
        need = max(1, (len(forms[major]) + 1) // 2)
        for w, idx in sorted(forms.items()):
            if w == major:
                continue
            for i in idx:
                if rows[i][0] in flagged or i in forms[major]:
                    continue
                if not any(en_cnt.get(e, 0) >= need for e in rows[i][2]):
                    continue                          # מקור אחר — כנראה מילה אחרת
                flagged.add(rows[i][0])
                out.append(f"- #{rows[i][0]}: [spl] '{w}' — בשאר הכתוביות '{major}'; אם זו אותה מילה — לאחד לכתיב אחד")
    return out


def _he_stem(w: str) -> str:
    b = _HE_SUFFIX.sub("", w) if len(w) > 3 else w
    return b


def gl_found(opt: str, txt: str) -> bool:
    """הנוסח מהמילון בתרגום — גם עם אותיות שימוש ("לאובר", "והפד") ובנטייה ("תגמולים" ל"תגמול")"""
    if opt in txt:
        return True
    bare = re.sub(r"\s*\([^)]*\)", "", opt).strip()   # "אלפא (יתרון)", "מנכ\"ל (CEO)" — הסוגריים הם הסבר במילון, לא חלק מהנוסח
    if bare and bare != opt:
        return gl_found(bare, txt)
    ow = re.findall(r"[א-ת'\"״׳]+|[A-Za-z0-9]+", opt)
    if not ow or not any(re.match(r"[א-ת]", w) for w in ow):
        return False
    words = re.findall(r"[א-ת'\"״׳]+|[A-Za-z0-9]+", txt)
    cands = set()
    for w in words:
        cands.add(w)
        cands.add(_HE_PREFIX.sub("", w, count=1) or w)
    stems = {_he_stem(c) for c in cands if c}
    pool = stems | cands

    def one(w: str) -> bool:
        st = _he_stem(w)
        if len(st) < 3:                     # מילה קצרה (אדם, פד) — רק כמו שהיא, עם אותיות שימוש
            return w in pool or st in pool
        return any(c.startswith(st) and len(c) - len(st) <= 3 for c in pool)

    for w in ow:
        if not re.match(r"[א-ת]", w):
            if w not in words:
                return False
            continue
        # 25/10/2026 (ניתוח האיכות): ה' הידיעה של המילון נבלעת אחרי ב/ל/כ ("האו"ם" → "באו"ם", "הניו יורק טיימס" →
        # "בניו יורק טיימס") — כמחצית מהתראות המילון שנשארו היו כאלה
        if not (one(w) or (w.startswith("ה") and len(w) > 3 and one(w[1:]))):
            return False
    return True


# 22/10/2026 (ניתוח המאגר): "הזזה" — המודל ממזג שתי שורות מקור לשורת תשובה אחת וממשיך כשכל תרגום שייך לכתובית
# הבאה (AppLovin: 93 כתוביות ברצף, הביקורת והשופט לא תפסו). אורך התרגום עוקב אחרי אורך המקור — חלון שבו אורכי
# התרגום מתואמים הרבה יותר עם המקור של השכנה (±1) מאשר עם המקור שלהם = הזזה. בלי מודל ובלי טוקנים.
DRIFT_W, DRIFT_STEP, DRIFT_GAIN = 24, 6, 0.25


def _corr(a: list[float], b: list[float]) -> float:
    n = len(a)
    if n < 3:
        return 0.0
    ma, mb = sum(a) / n, sum(b) / n
    sa = sum((x - ma) ** 2 for x in a) ** 0.5
    sb = sum((y - mb) ** 2 for y in b) ** 0.5
    return sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sa * sb) if sa and sb else 0.0


def drift_ids(cues: list[dict], he: dict[str, str]) -> dict[str, int]:
    """מזהה כתובית → כיוון ההזזה (+1: התרגום שייך לבאה, ‎-1: לקודמת)."""
    hl = [float(len(str(he.get(str(c["id"]), "")).replace("||", " "))) for c in cues]
    el = [float(len(c.get("en") or "")) for c in cues]
    out: dict[str, int] = {}
    n, W = len(cues), DRIFT_W
    for i in range(0, max(0, n - W - 2), DRIFT_STEP):
        a, b = i + 2, i + W
        base = _corr(hl[a:b], el[a:b])
        for o in (1, -1):
            if a + o < 0 or b + o > n:
                continue
            if _corr(hl[a:b], el[a + o:b + o]) - base > DRIFT_GAIN:
                for c in cues[a:b]:
                    out.setdefault(str(c["id"]), o)
    return out


_TAG_Q = re.compile(r"^(?:right|you know|ok(?:ay)?|yeah|huh|no|isn't it|don't you|you see|correct|true)\W*$", re.I)


def _real_question(en: str) -> bool:
    """משפט שאלה של 3 מילים ומעלה באמצע הכתובית — לא "right?" בסוף משפט (מילת מילוי שמשמיטים לפי המדריך)"""
    for m in re.finditer(r"([^.?!…]+)\?", en):
        q = m.group(1).strip().strip(",;:-—")
        tail = q.split(",")[-1].strip()
        if len(q.split()) >= 3 and not _TAG_Q.match(tail):
            return True
    return False


def _tag_question(en: str) -> bool:
    """השאלה בסוף הכתובית היא רק מילת מילוי אחרי משפט ("..., right?", "..., you know?") — לא שאלה אמיתית."""
    last = re.split(r"[.!…]\s+", en.rstrip())[-1]
    q = last.rstrip().rstrip("?").strip()
    tail = re.split(r"[,;—–]\s*|\s-\s", q)[-1].strip()
    return bool(_TAG_Q.match(tail)) and len(q.split()) > len(tail.split())


# 25/10/2026 (ניתוח האיכות, session_01UZAW + המאגר): הסתייגות שנשמטה הופכת השערה לעובדה ("maybe", "I think", "about three
# hours"). בקורפוס של 20 עבודות: 171 מתוך 1,090 כתוביות עם הסתייגות במקור הגיעו לצופה בלעדיה (16%), והשלבים שאחרי הטיוטה
# לא החזירו אותה. בלי "kind of" ו־"try to" — כמעט תמיד מילת מילוי (בבדיקה: שליש מההתראות, רובן נכונות להשמטה).
_HEDGE_NUM = (r"(?:\$?\d[\d,.]*|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|"
              r"fifty|sixty|seventy|eighty|ninety|a hundred|hundred|a thousand|thousand|a million|million|a billion|billion|"
              r"a dozen|a couple|half|a third|a quarter)")
_HEDGE_EN = re.compile("|".join([
    r"\b(?:maybe|perhaps|probably|possibly|likely|might|somewhat|apparently|supposedly|allegedly|reportedly)\b",
    r"\b(?:seems?|seemed)\b", r"\bmore or less\b", r"\bor so\b", r"\bto (?:some|a certain) (?:extent|degree)\b",
    r"\b(?:i|we) (?:still |really |do |would |'d )?think\b(?! (?:about|of|through)\b)",
    r"\b(?:i|we) (?:don't|do not|didn't) think\b", r"\bi (?:guess|suppose|imagine)\b", r"\b(?:i|we) believe\b(?! in\b)",
    r"\b(?:i'd|i would) say\b", r"\bi feel like\b", r"\bi'm told\b", r"\bnot sure\b",
    r"\bi don't know (?:if|that|whether)\b",
    r"\b(?:about|around|roughly|approximately|nearly|almost|close to|something like|like) " + _HEDGE_NUM + r"\b",
]), re.I)
_HEDGE_MAY = re.compile(r"\bmay\b(?! \d)")          # רק באות קטנה — May = החודש
_HEDGE_HE = re.compile(
    r"אולי|כנראה|מן הסתם|סביר|ייתכן|יתכן|יכול להיות|יכולים להיות|עשוי|עשויה|עשויים|עלול|עלולה|עלולים|בערך|בסביבות|סביב|"
    r"כמעט|קרוב ל|משהו כמו|פחות או יותר|יותר או פחות|לדעתי|לדעתנו|בעיניי|חושב|חושבת|חושבים|נראה|נדמה|מניח|מניחה|מניחים|"
    r"משער|מאמין|מאמינה|מאמינים|לא בטוח|לא יודע|במידה|מעין|סוג של|קצת|כביכול|לכאורה|אומרים|סיפרו לי|שמעתי|מתברר|מסתבר|"
    r"אפשר ש|מרגיש|מרגישה|הייתי אומר|לפחות|נשמע|"
    r"(?:^|\s)כ[־-]?(?:\d|אחד|שניים|שתיים|שני|שתי|שלוש|ארבע|חמש|שש|שבע|שמונה|תשע|עשר|עשרים|שלושים|ארבעים|חמישים|שישים|"
    r"שבעים|שמונים|תשעים|מאה|מאתיים|מאות|אלף|אלפיים|אלפים|מיליון|מיליארד|חצי|רבע|שליש|שבוע|שנה|שנתיים|שעה|שעתיים|דקה|יומיים)")


def hedges_in(en: str) -> list[str]:
    """ההסתייגויות במקור ("maybe", "I think", "about 50") — בצורה שבה הופיעו, בלי כפולים."""
    out: list[str] = []
    for m in list(_HEDGE_EN.finditer(en)) + list(_HEDGE_MAY.finditer(en)):
        w = m.group(0).strip()
        if w.lower() not in (x.lower() for x in out):
            out.append(w)
    return out


def hedge_kept_he(txt: str) -> bool:
    """יש בעברית מילה שמסתייגת (אולי, כנראה, בערך, לדעתי, כ־3…) — גסה בכוונה: בספק לא מתריעים."""
    return bool(_HEDGE_HE.search(txt))


_LAT_WORD = re.compile(r"[A-Za-z][A-Za-z'\-]*")
_URLISH = re.compile(r"\S+\.(?:com|org|net|io|ai|co|il|tv|app|me|gg|ly|so|us|uk)(?:/\S*)?", re.I)


def untranslated_words(txt: str, keep: set[str] = frozenset()) -> list[str]:
    """מילים באנגלית שלא תורגמו: רק מילים באותיות קטנות (3+ אותיות). שם, מותג וראשי תיבות (AI, CEO, OpenAI)
    וכתובת אתר נשארים בלועזית לפי המדריך — לא נספרים."""
    out: list[str] = []
    for w in _LAT_WORD.findall(_URLISH.sub(" ", txt)):
        if len(w) >= 3 and w.islower() and w not in keep and w not in out:
            out.append(w)
    return out


_IMPERIAL = re.compile(r"(\d[\d,]*(?:\.\d+)?)[\s-]*(?:feet|foot|ft|miles?|inch(?:es)?|yards?|pounds?|lbs?|ounces?|oz|"
                       r"gallons?|acres?|degrees?(?:\s*fahrenheit)?|°\s*f)\b", re.I)


def _number_ok_ctx(num: str, en: str, txt: str) -> bool:
    """מספר שמותר שלא יופיע כמו שהוא: עשור ("the 1990s" ← "שנות ה־90"), ‏9/11 ← "11 בספטמבר",
    ומידה אמריקאית שהומרה ליחידה מטרית ("10 feet" ← "שלושה מטרים")."""
    if re.fullmatch(r"(?:1[89]|20)\d0", num) and re.search(rf"{num}'?s\b", en) and num[2:] in numbers_in(txt):
        return True
    if num in ("9", "11") and re.search(r"\b9\s*/\s*11\b|\b9-11\b", en) and re.search(r"11\s*ב?ספטמבר", txt):
        return True
    for m in _IMPERIAL.finditer(en):
        if m.group(1).replace(",", "").rstrip(".") == num:
            return True
    return False


def _latin_kept(term: str, txt: str) -> bool:
    """המונח מהמילון נשאר בתרגום בלועזית, כמו שהוא (AI, ‏OpenAI) — החלטה לגיטימית לפי המדריך."""
    return bool(re.search(r"[A-Za-z]", term)) and bool(
        re.search(rf"(?<![A-Za-z]){re.escape(term)}(?![A-Za-z])", txt, re.I))


def _head_found(opts: list[str], txt: str) -> bool:
    """לנוסח מהמילון יש כמה מילים, והתרגום מכיל את המילה הראשונה שלו ("הדוכן" ← "דוכן לימונדה")."""
    for o in opts:
        hw = re.findall(r"[א-ת'\"״׳]+", re.sub(r"\s*\([^)]*\)", "", o))
        if len(hw) >= 2 and gl_found(hw[0], txt):
            return True
    return False


# 25/10/2026 (ניתוח האיכות): קוד קבוע לכל סוג הודעה — "- #12: [num] …". מי שקורא את tr/check.md (pipeline.parse_issues)
# מסווג לפי הקוד ולא לפי מילים בהודעה (ניסוח חדש שינה בשקט את העדיפות). h = חובה לתקן, s = לשקול, - = בלי סבב תיקון.
# קוד חדש = כאן + בדיקה (test_qa_fixes) + דרגה ב־pipeline.
CHECK_CODES = {
    "id": "h", "miss": "h", "eq": "h", "drift": "h", "spk": "h", "len": "h", "dlg": "h", "brk": "h",
    "nikud": "h", "dash": "h", "tag": "h", "part": "h",
    "num": "s", "gls": "s", "lat": "s", "name": "s", "spl": "s", "q": "s", "short": "s", "cps": "s", "cur": "s", "hdg": "s", "gen": "s", "agr": "s",
    "dots": "-",
}
CHECK_CODE_RE = re.compile(r"^- #(\d+): \[([a-z]+)\] ")


# 26/10/2026: דובר שמדבר על עצמו בהווה ("אני חושב") — רק צורות שהזכר והנקבה בהן שונים. ("רוצה", "עושה" — זהות; בחוץ)
_GEN_PAIRS = (
    ("חושב", "חושבת"), ("יודע", "יודעת"), ("מניח", "מניחה"), ("מרגיש", "מרגישה"), ("בטוח", "בטוחה"), ("מוכן", "מוכנה"),
    ("אוהב", "אוהבת"), ("מבין", "מבינה"), ("זוכר", "זוכרת"), ("מאמין", "מאמינה"), ("מסכים", "מסכימה"), ("צריך", "צריכה"),
    ("יכול", "יכולה"), ("הולך", "הולכת"), ("מתכוון", "מתכוונת"), ("שמח", "שמחה"), ("אומר", "אומרת"), ("לוקח", "לוקחת"),
    ("מדבר", "מדברת"), ("נותן", "נותנת"), ("חוזר", "חוזרת"), ("עובד", "עובדת"), ("לחוץ", "לחוצה"), ("המום", "המומה"),
    ("עייף", "עייפה"), ("מצטער", "מצטערת"), ("משוכנע", "משוכנעת"), ("סקרן", "סקרנית"), ("גורם", "גורמת"), ("מנסה", ""),
    ("מתרגש", "מתרגשת"), ("מודאג", "מודאגת"), ("מופתע", "מופתעת"), ("גאה", ""), ("חושש", "חוששת"), ("מקשיב", "מקשיבה"),
)
_GEN_M = {m: f for m, f in _GEN_PAIRS if f}
_GEN_F = {f: m for m, f in _GEN_PAIRS if f}
_GEN_RE = re.compile(r"(?<![א-ת])אני\s+((?:(?:לא|ממש|די|באמת|גם|עדיין|פשוט|מאוד|רק|תמיד|כבר|כל\s+כך)\s+){0,2})([א-ת]+)")


def gender_slips(text: str, g: str) -> list[str]:
    """צורות בגוף ראשון במגדר ההפוך מהדובר ("אני חושב" כשהדוברת אישה). ציטוט ("…") — לא נבדק: מישהו אחר מדבר."""
    t = normalize_he(text)
    if '"' in t or not g:
        return []
    bad = _GEN_M if g == "f" else _GEN_F
    return [m.group(0) for m in _GEN_RE.finditer(t) if m.group(2) in bad]


def gender_issues(cues: list[dict], he: dict[str, str], speakers: dict | None) -> list[str]:
    out = []
    if not speakers:
        return out
    for c in cues:
        k = str(c["id"])
        t = he.get(k)
        if not t or t in ("=", "∅"):
            continue
        if c.get("parts"):
            segs = list(zip([p.get("spk") for p in c["parts"]], t.split("||"))) if "||" in t else []
        else:
            segs = [(c.get("spk"), t)]
        for spk, txt in segs:
            info = speakers.get(spk or "") or {}
            g = gender_of(info)
            for hit in gender_slips(txt, g)[:1]:
                who = (info.get("name") or spk) + (", אישה" if g == "f" else ", גבר")
                out.append(f"- #{k}: [gen] הדובר {spk} ({who}) — '{hit}' {'בלשון זכר' if g == 'f' else 'בלשון נקבה'}; "
                           "אם התוכן מראה שמדבר כאן מישהו אחר — להשאיר")
    return out


# 01/11/2026 (שדרוג הסטודיו, A2): בדיקת התאמה לפי הניתוח הדקדוקי (DictaBERT joint שכבר בתמונה — vt.linebreak.DepModel).
# הרשימה של _GEN_PAIRS תופסת 35 פעלים בגוף ראשון; המודל — כל פועל ותואר: (1) "אני" כנושא מול מגדר הדובר; (2) נושא ונשוא
# שלא מתאימים במין או במספר ("הילדה הלך", "האנשים אמר"). הערה "לשקול" בלבד — המתקן מכריע, וניתוח שגוי לא מזיק.
_UD_G = {"Masc": "m", "Fem": "f"}
_UD_N = {"Sing": "s", "Plur": "p"}
_PRED_POS = {"VERB", "ADJ", "AUX"}
_SUBJ_POS = {"NOUN", "PRON", "PROPN"}
_SELF = {"אני", "ואני", "שאני", "כשאני", "גםאני"}


def agreement_slips(text: str, g: str, dep) -> list[tuple[str, str, str]]:
    """[(סוג, נושא, נשוא)] — סוג: 'self' (הדובר על עצמו במגדר ההפוך), 'g' (מין), 'n' (מספר). ציטוט — לא נבדק."""
    t = normalize_he(text)
    if dep is None or '"' in t:
        return []
    try:
        toks = dep.toks(t)
    except Exception:                       # noqa: BLE001 — בדיקה בלבד; תקלה במודל לא עוצרת את הבדיקות האחרות
        return []
    if not toks or len(toks[0]) < 7:
        return []
    out = []
    for i, tk in enumerate(toks):
        if not str(tk[2] or "").startswith("nsubj"):
            continue
        h = tk[1]
        if not isinstance(h, int) or not 0 <= h < len(toks) or h == i:
            continue
        hd = toks[h]
        if hd[3] not in _PRED_POS:
            continue
        hg, sg = _UD_G.get(hd[4]), _UD_G.get(tk[4])
        if tk[0] in _SELF:
            if g in ("m", "f") and hg and hg != g:
                out.append(("self", tk[0], hd[0]))
            continue
        if tk[3] not in _SUBJ_POS or tk[6] == "1":
            continue
        if sg and hg and sg != hg:
            out.append(("g", tk[0], hd[0]))
        elif _UD_N.get(tk[5]) and _UD_N.get(hd[5]) and _UD_N[tk[5]] != _UD_N[hd[5]]:
            out.append(("n", tk[0], hd[0]))
    return out


def agreement_issues(cues: list[dict], he: dict[str, str], speakers: dict | None, dep, skip: set | None = None) -> list[str]:
    """skip = כתוביות שכבר קיבלו הערת [gen] מהרשימה (לא שתי הערות על אותה מילה)."""
    out = []
    if dep is None:
        return out
    for c in cues:
        k = str(c["id"])
        t = he.get(k)
        if not t or t in ("=", "∅"):
            continue
        if c.get("parts"):
            segs = list(zip([p.get("spk") for p in c["parts"]], t.split("||"))) if "||" in t else []
        else:
            segs = [(c.get("spk"), t)]
        for spk, txt in segs:
            info = (speakers or {}).get(spk or "") or {}
            g = gender_of(info)
            hits = agreement_slips(txt, g, dep)
            if not hits:
                continue
            kind, a, b = hits[0]
            if kind == "self":
                if skip and k in skip:
                    continue
                who = (info.get("name") or spk) + (", אישה" if g == "f" else ", גבר")
                out.append(f"- #{k}: [gen] הדובר {spk} ({who}) — '{a} {b}' {'בלשון זכר' if g == 'f' else 'בלשון נקבה'}; "
                           "אם התוכן מראה שמדבר כאן מישהו אחר — להשאיר")
            else:
                out.append(f"- #{k}: [agr] '{a}' ו־'{b}' לא מתאימים {'במין' if kind == 'g' else 'במספר'}; "
                           "אם זה נכון בהקשר — להשאיר")
            break
    return out


def check(cues: list[dict], he: dict[str, str], glossary: list[tuple[str, list[str]]],
          max_chars: int = 84, speakers: dict | None = None, dep=None) -> tuple[list[str], dict]:
    """בדיקת התרגום מול התכנון. מחזיר (שורות דוח, סיכום)."""
    issues: list[str] = []
    stats = {"total": len(cues), "translated": 0, "missing": 0, "over_budget": 0,
             "numbers": 0, "latin": 0, "glossary": 0, "glossary_soft": 0, "names": 0, "spell": 0, "questions": 0, "short": 0, "style": 0, "errors": 0, "drift": 0, "hedges": 0, "gender": 0, "agree": 0}
    ids = {str(c["id"]) for c in cues}
    # מילים לועזיות שהמילון קובע שנשארות כך ("Claude", "if-else") — לא "לא תורגמו"
    keep_latin = {w.lower() for _t, opts in glossary for o in opts for w in _LAT_WORD.findall(o)}
    for k in he:
        if k not in ids:
            issues.append(f"- #{k}: [id] מספר לא קיים בתכנון")
            stats["errors"] += 1
    drift = drift_ids(cues, he)
    prev_text = None
    # תקציב אפקטיבי: כתובית שאחריה באות כתוביות '=' מקבלת גם את הזמן שלהן
    eff_budget = {}
    for i, c in enumerate(cues):
        b = c["budget"]
        j = i + 1
        while j < len(cues) and he.get(str(cues[j]["id"])) == "=":
            b += cues[j]["budget"]
            j += 1
        eff_budget[str(c["id"])] = min(b, max_chars)
    for ci, c in enumerate(cues):
        k = str(c["id"])
        if k not in he:
            issues.append(f"- #{k}: [miss] חסר תרגום")
            stats["missing"] += 1
            continue
        t = he[k]
        if t in ("=", "∅"):
            if t == "=" and prev_text is None:
                issues.append(f"- #{k}: [eq] '=' בלי כתובית קודמת")
                stats["errors"] += 1
            stats["translated"] += 1
            continue
        prev_text = t
        stats["translated"] += 1
        if k in drift:
            issues.append(f"- #{k}: [drift] נראה שהתרגום שייך לכתובית {'הבאה' if drift[k] > 0 else 'הקודמת'} (הזזה) — "
                          "לתרגם מחדש בדיוק את שורת המקור של הכתובית הזו")
            stats["errors"] += 1
            stats["drift"] += 1
        txt = normalize_he(t.replace("||", " ").replace("|", " "))
        n = visible_len(txt)
        if c.get("parts") and "||" not in t:
            issues.append(f"- #{k}: [spk] כתובית של שני דוברים — חסר '||' בין הדוברים")
            stats["errors"] += 1
        if n > max_chars:
            issues.append(f"- #{k}: [len] {n} תווים — מעל {max_chars} (לא ייכנס בשתי שורות)")
            stats["errors"] += 1
        elif "||" in t and max(visible_len(normalize_he(x)) for x in t.split("||", 1)) > max_chars // 2:
            # 25/10/2026 (ניתוח האיכות): דיאלוג מוצג בשורה לכל דובר — חלק ארוך מ־42 תווים לא נכנס, והבנייה שוברת
            # רגיל בלי המקף (20 כתוביות ב־20 עבודות). "מקף דובר" בהודעה = חובה לתקן ב־parse_issues
            issues.append(f"- #{k}: [dlg] דיאלוג (||) — החלק של אחד הדוברים ארוך מ־{max_chars // 2} תווים, "
                          "לא ייכנס בשורה משלו ויוצג בלי מקף דובר — לקצר אותו")
            stats["errors"] += 1
        elif "||" not in t and n > max_chars // 2 and not break_lines(txt, max_chars // 2)[1]:
            # 25/10/2026 (ניתוח האיכות): עד 84 תווים, אבל גבולות המילים לא מאפשרים שתי שורות של עד 42 — 10 שורות
            # ארוכות יצאו לצופה כשגיאת בקרה. "מעל 84" בהודעה = חובה לתקן ב־parse_issues
            issues.append(f"- #{k}: [brk] {n} תווים — אין חלוקה לשתי שורות של עד {max_chars // 2} "
                          f"(דינו כמו מעל {max_chars}) — לקצר")
            stats["errors"] += 1
        elif n > eff_budget[k]:
            issues.append(f"- #{k}: [cps] {n} תווים מול תקציב {eff_budget[k]} (קצב קריאה) — לשקול קיצור")
            stats["over_budget"] += 1
        en = c["en"]
        if len(en) > 25 and n < len(en) * 0.3:
            issues.append(f"- #{k}: [short] התרגום קצר מאוד ביחס למקור — לוודא שלא הושמט תוכן")
            stats["short"] += 1
        near_he = None
        for num in numbers_in(en):
            if number_ok_in_he(num, txt) or _number_ok_ctx(num, en, txt):
                continue
            if near_he is None:     # 25/10/2026: מספר שעבר לכתובית השכנה (סדר המילים בעברית) — לא חסר
                near_he = " ".join(normalize_he(str(he.get(str(x["id"]), "")))
                                   for x in cues[max(0, ci - 1):ci + 2] if x is not c)
            if number_ok_in_he(num, near_he):
                continue
            issues.append(f"- #{k}: [num] המספר {num} מהמקור לא מופיע בתרגום")
            stats["numbers"] += 1
        hg = hedges_in(en)
        if hg and not hedge_kept_he(txt):
            # 25/10/2026: ההסתייגות עברה לשכנה (סדר המילים) או לכתובית שאוחדה ('=' אחרי הזו) — לא חסרה
            j = ci + 1
            while j < len(cues) and he.get(str(cues[j]["id"])) == "=":
                j += 1
            near_h = " ".join(normalize_he(str(he.get(str(x["id"]), "")))
                              for x in cues[max(0, ci - 1):j + 1] if x is not c)
            if not hedge_kept_he(near_h):
                issues.append(f"- #{k}: [hdg] במקור הסתייגות ({', '.join(hg[:3])}) — בתרגום נשמטה, וההשערה נשמעת "
                              "כמו עובדה. להחזיר בקצרה (אולי, כנראה, בערך, לדעתי) — לשקול")
                stats["hedges"] += 1
        if NIKUD_RE.search(txt):
            issues.append(f"- #{k}: [nikud] ניקוד בתרגום — כתוביות נכתבות בכתיב מלא בלי ניקוד (מילה דו־משמעית: לנסח מחדש)")
            stats["errors"] += 1
        # כללי נטפליקס־עברית (המסמך הנורמטיבי הפומבי היחיד לכתוביות עבריות):
        if re.match(r"^[-–־]", t.lstrip()):
            issues.append(f"- #{k}: [dash] מקף דובר בתחילת הכתובית — המקף נוסף אוטומטית (לשני דוברים כותבים 'א || ב')")
            stats["errors"] += 1
        if re.search(r"</?[a-z]+>|\{\\", t):
            issues.append(f"- #{k}: [tag] תג עיצוב בטקסט — בעברית בלי הטיה (italics) ובלי תגים")
            stats["errors"] += 1
        if re.search(r"[$€£₪]", txt):
            issues.append(f"- #{k}: [cur] סמל מטבע — המטבע בשם המלא (\"3 מיליארד דולר\", לא \"$3B\") — לשקול")
            stats["style"] += 1
        # 25/10/2026 (ניתוח האיכות): בלי "ספרה בתחילת משפט" — סבב התיקון כתב מספרים במילים והאריך כתוביות;
        # ובלי התראה על כל אות לועזית: 1,069 התראות על AI, שמות ומותגים, וההודעה הכילה את המילה "מונח" — ולכן
        # נשלחה למתקן כבעיית מונח, לפני חריגות הקצב (בשחזור על הטיוטות של 20 עבודות: 205 מתוך 455 חריגות קצב
        # נכנסו למכסת התיקון; בלי ההתראות האלה — 443), והמתקן תרגם AI ל"בינה מלאכותית". עכשיו רק מילים באותיות
        # קטנות שלא תורגמו — אלה כן שווות תיקון.
        bad_en = untranslated_words(txt, keep_latin)
        if bad_en:
            issues.append(f"- #{k}: [lat] מונח באנגלית שלא תורגם: {', '.join(bad_en)} — לתרגם, או להשאיר אם זה שם")
            stats["latin"] += 1
        if c.get("parts") and "||" in t:
            # 23/10/2026 (ניתוח המאגר): שאלה קצרה של דובר אחד נבלעה בכתובית של שני דוברים ("And what's your name?" → חסר)
            for pi, (p, seg) in enumerate(zip(c["parts"], t.split("||", 1))):
                seg = normalize_he(seg.replace("|", " ")).strip()
                if not seg:
                    issues.append(f"- #{k}: [part] החלק של הדובר {'הראשון' if pi == 0 else 'השני'} הושמט — כל דובר מקבל תרגום")
                    stats["errors"] += 1
                elif str(p.get("en") or "").rstrip().endswith("?") and "?" not in seg:
                    issues.append(f"- #{k}: [q] שאלה במקור (הדובר {'הראשון' if pi == 0 else 'השני'}) — בתרגום אין סימן שאלה")
                    stats["questions"] += 1
        elif (en.rstrip().endswith("?") and not txt.rstrip().endswith(("?", "?!", "!?")) and not c.get("parts")
              and not _tag_question(en)):          # 25/10/2026: "..., right?" — מילת מילוי, לא שאלה ("נכון?" נוסף בגללה)
            issues.append(f"- #{k}: [q] שאלה במקור — בתרגום אין סימן שאלה")
            stats["questions"] += 1
        elif not c.get("parts") and "?" not in txt and _real_question(en):
            issues.append(f"- #{k}: [q] שאלה במקור (באמצע הכתובית) — בתרגום אין סימן שאלה, לוודא שלא הושמטה")
            stats["questions"] += 1
        near = " ".join(normalize_he(str(he.get(str(x["id"]), ""))) for x in cues[max(0, ci - 1):ci + 2])
        hit = [t2 for t2, _o in glossary if term_in_en(t2, en)]
        for term, opts in glossary:
            if term in hit and not _gl_inside(term, hit):
                if not any(gl_found(o, txt) or gl_found(o, near) for o in opts):
                    # 25/10/2026 (ניתוח האיכות): המונח נשאר בלועזית (AI, ‏OpenAI — כמו במדריך: "ה־AI"), או שהתרגום
                    # מקצר לשם העצם הראשי ("הדוכן" אחרי "דוכן לימונדה") — המלצה בלבד. עד היום המתקן הכניס את המחרוזת
                    # המלאה בכוח: "את הדוכן" → "את דוכן לימונדה", 9 פעמים בסרטון אחד
                    if _latin_kept(term, txt) or _head_found(opts, txt):
                        stats["glossary_soft"] += 1
                        continue
                    if gl_strict(term, opts):
                        issues.append(f"- #{k}: [gls] מונח '{term}' — לפי המילון: {' / '.join(opts)}")
                        stats["glossary"] += 1
                    else:
                        stats["glossary_soft"] += 1   # מילה אחת שהתרגום שלה תלוי בהקשר — המלצה בלבד, בלי סבב תיקון
        if "..." in t:
            issues.append(f"- #{k}: [dots] '...' — להשתמש בתו … (ינורמל אוטומטית)")
    nv = name_variants(cues, he)
    issues += nv
    stats["names"] = len(nv)
    sv = spell_variants(cues, he)   # 25/10/2026: כתיב מלא/חסר של אותה מילה
    issues += sv
    stats["spell"] = len(sv)
    gv = gender_issues(cues, he, speakers)   # 26/10/2026: הדובר מדבר על עצמו במגדר ההפוך
    issues += gv
    stats["gender"] = len(gv)
    av = agreement_issues(cues, he, speakers, dep, skip={x.split(":")[0][3:] for x in gv})   # 01/11/2026: לפי הניתוח
    issues += av
    stats["gender"] += sum(1 for x in av if "[gen]" in x)
    stats["agree"] = sum(1 for x in av if "[agr]" in x)
    return issues, stats


def check_report(issues: list[str], stats: dict) -> str:
    head = ["# בדיקת תרגום", "",
            f"- כתוביות: {stats['total']} · תורגמו: {stats['translated']} · חסרות: {stats['missing']}",
            f"- שגיאות: {stats['errors']} · מעל התקציב: {stats['over_budget']} · מספרים: {stats['numbers']}",
            f"- לועזית: {stats['latin']} · מילון מונחים: {stats['glossary']} · שאלות: {stats['questions']} · "
            f"קצרים: {stats['short']} · סגנון: {stats.get('style', 0)} · שם בשני כתיבים: {stats.get('names', 0)} · כתיב לא אחיד: {stats.get('spell', 0)}",
            ""]
    return "\n".join(head + (issues or ["אין הערות."])) + "\n"


def apply_merges(cues: list[dict], he: dict[str, str], max_dur: float) -> tuple[list[dict], list[str]]:
    """מחיל '=' (איחוד) ו־'∅' (השמטה). מחזיר כתוביות סופיות עם טקסט עברי."""
    out: list[dict] = []
    warns: list[str] = []
    for c in cues:
        t = he.get(str(c["id"]))
        if t is None:
            warns.append(f"#{c['id']}: חסר תרגום — מדולג")
            continue
        if t == "∅":
            continue
        if t == "=":
            if not out:
                warns.append(f"#{c['id']}: '=' ללא קודם")
                continue
            p = out[-1]
            if c["speech_e"] - p["speech_s"] > max_dur:
                warns.append(f"#{c['id']}: איחוד עם #{p['id']} יוצר כתובית ארוכה מ־{max_dur} שניות")
            p["speech_e"] = max(p["speech_e"], c["speech_e"])
            p["en"] = (p["en"] + " " + c["en"]).strip()
            p["w1"] = c.get("w1", p.get("w1"))   # כתובית מקובץ קיים (tpl) — בלי מילים
            p.setdefault("merged", []).append(c["id"])
            continue
        d = dict(c)
        d["he"] = t
        out.append(d)
    return out, warns


def estimate_minutes(n_cues: int) -> int:
    return int(math.ceil(n_cues / 60.0))
