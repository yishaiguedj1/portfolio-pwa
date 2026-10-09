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

from .hebrew import normalize_he, visible_len, has_latin, latin_runs, numbers_in, number_ok_in_he
from .util import fmt_ts

LINE_RE = re.compile(r"^#(\d+)\s?(.*)$")
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
    return f"{spk} · {name}" if name else spk


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
        out[m.group(1)] = m.group(2).strip()
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


def check(cues: list[dict], he: dict[str, str], glossary: list[tuple[str, list[str]]],
          max_chars: int = 84) -> tuple[list[str], dict]:
    """בדיקת התרגום מול התכנון. מחזיר (שורות דוח, סיכום)."""
    issues: list[str] = []
    stats = {"total": len(cues), "translated": 0, "missing": 0, "over_budget": 0,
             "numbers": 0, "latin": 0, "glossary": 0, "questions": 0, "short": 0, "style": 0, "errors": 0}
    ids = {str(c["id"]) for c in cues}
    for k in he:
        if k not in ids:
            issues.append(f"- #{k}: מספר לא קיים בתכנון")
            stats["errors"] += 1
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
    for c in cues:
        k = str(c["id"])
        if k not in he:
            issues.append(f"- #{k}: חסר תרגום")
            stats["missing"] += 1
            continue
        t = he[k]
        if t in ("=", "∅"):
            if t == "=" and prev_text is None:
                issues.append(f"- #{k}: '=' בלי כתובית קודמת")
                stats["errors"] += 1
            stats["translated"] += 1
            continue
        prev_text = t
        stats["translated"] += 1
        txt = normalize_he(t.replace("||", " ").replace("|", " "))
        n = visible_len(txt)
        if c.get("parts") and "||" not in t:
            issues.append(f"- #{k}: כתובית של שני דוברים — חסר '||' בין הדוברים")
            stats["errors"] += 1
        if n > max_chars:
            issues.append(f"- #{k}: {n} תווים — מעל {max_chars} (לא ייכנס בשתי שורות)")
            stats["errors"] += 1
        elif n > eff_budget[k]:
            issues.append(f"- #{k}: {n} תווים מול תקציב {eff_budget[k]} (קצב קריאה) — לשקול קיצור")
            stats["over_budget"] += 1
        en = c["en"]
        if len(en) > 25 and n < len(en) * 0.3:
            issues.append(f"- #{k}: התרגום קצר מאוד ביחס למקור — לוודא שלא הושמט תוכן")
            stats["short"] += 1
        for num in numbers_in(en):
            if not number_ok_in_he(num, txt):
                issues.append(f"- #{k}: המספר {num} מהמקור לא מופיע בתרגום")
                stats["numbers"] += 1
        if NIKUD_RE.search(txt):
            issues.append(f"- #{k}: ניקוד בתרגום — כתוביות נכתבות בכתיב מלא בלי ניקוד (מילה דו־משמעית: לנסח מחדש)")
            stats["errors"] += 1
        # כללי נטפליקס־עברית (המסמך הנורמטיבי הפומבי היחיד לכתוביות עבריות):
        if re.match(r"^[-–־]", t.lstrip()):
            issues.append(f"- #{k}: מקף דובר בתחילת הכתובית — המקף נוסף אוטומטית (לשני דוברים כותבים 'א || ב')")
            stats["errors"] += 1
        if re.search(r"</?[a-z]+>|\{\\", t):
            issues.append(f"- #{k}: תג עיצוב בטקסט — בעברית בלי הטיה (italics) ובלי תגים")
            stats["errors"] += 1
        if re.search(r"[$€£₪]", txt):
            issues.append(f"- #{k}: סמל מטבע — המטבע בשם המלא (\"3 מיליארד דולר\", לא \"$3B\") — לשקול")
            stats["style"] += 1
        for sent_start in re.findall(r"(?:^|[.?!…]\s+)(\S)", txt.replace("|", " ")):
            if sent_start.isdigit():
                issues.append(f"- #{k}: ספרה בתחילת משפט — מספר שפותח משפט נכתב במילים — לשקול")
                stats["style"] += 1
                break
        if has_latin(txt):
            issues.append(f"- #{k}: אותיות לועזיות: {', '.join(latin_runs(txt))} (בסדר רק לשם מותג/מונח שנשאר בלועזית)")
            stats["latin"] += 1
        if en.rstrip().endswith("?") and not txt.rstrip().endswith(("?", "?!", "!?")) and not c.get("parts"):
            issues.append(f"- #{k}: שאלה במקור — בתרגום אין סימן שאלה")
            stats["questions"] += 1
        low = en.lower()
        for term, opts in glossary:
            if re.search(r"(?<![a-z])" + re.escape(term.lower()) + r"(?![a-z])", low):
                if not any(o in txt for o in opts):
                    issues.append(f"- #{k}: מונח '{term}' — לפי המילון: {' / '.join(opts)}")
                    stats["glossary"] += 1
        if "..." in t:
            issues.append(f"- #{k}: '...' — להשתמש בתו … (ינורמל אוטומטית)")
    return issues, stats


def check_report(issues: list[str], stats: dict) -> str:
    head = ["# בדיקת תרגום", "",
            f"- כתוביות: {stats['total']} · תורגמו: {stats['translated']} · חסרות: {stats['missing']}",
            f"- שגיאות: {stats['errors']} · מעל התקציב: {stats['over_budget']} · מספרים: {stats['numbers']}",
            f"- לועזית: {stats['latin']} · מילון מונחים: {stats['glossary']} · שאלות: {stats['questions']} · "
            f"קצרים: {stats['short']} · סגנון: {stats.get('style', 0)}",
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
            p["w1"] = c["w1"]
            p.setdefault("merged", []).append(c["id"])
            continue
        d = dict(c)
        d["he"] = t
        out.append(d)
    return out, warns


def estimate_minutes(n_cues: int) -> int:
    return int(math.ceil(n_cues / 60.0))
