"""ייבוא קובץ כתוביות קיים (SRT / VTT / ASS) לתרגום — בלי תמלול ובלי סרטון (22/10/2026).

מה יש כאן (טהור, בלי תלויות):
- decode: קידוד — BOM (UTF-8 / UTF-16), UTF-8, ואם לא — Windows-1252 ("תוקן").
- parse: SRT, WebVTT, ASS/SSA → כתוביות {s, e, lines, it, top} במילישניות שלמות.
- clean: פרסומות ("Synced by…"), כתוביות ריקות, כפולות רצופות, חפיפות, סדר.
- SDH (כתוביות לכבדי שמיעה): [door slams], (sighs), תוויות דובר "JOHN:" — מוסרים כברירת מחדל,
  ושמות הדוברים נשמרים לדף הדמויות.
- to_vt: ‏cues.en.json במצב template (tpl) — הזמנים של הקובץ נשמרים; ה־vt מאריך רק לתוך רווח.

port זהה ב־studiosubs.js (importSubs) — הטלפון מציג את אותם מספרים שהעובד יראה.
שינוי כאן = גם שם (tests/subs-import.test.js משווה את שניהם על אותם קבצים).
"""
from __future__ import annotations

import re

# ------------------------------------------------------------------------------------------- קידוד


def decode(raw: bytes) -> dict:
    """bytes → {text, enc, fixed}. fixed = לא היה UTF-8 תקין (נפענח כ־Windows-1252)."""
    if raw[:3] == b"\xef\xbb\xbf":
        return {"text": raw[3:].decode("utf-8", "replace"), "enc": "utf-8", "fixed": False}
    if raw[:2] == b"\xff\xfe":
        return {"text": raw[2:].decode("utf-16-le", "replace"), "enc": "utf-16", "fixed": True}
    if raw[:2] == b"\xfe\xff":
        return {"text": raw[2:].decode("utf-16-be", "replace"), "enc": "utf-16", "fixed": True}
    head = raw[:400]
    if len(head) >= 4:
        odd = sum(1 for i in range(1, len(head), 2) if head[i] == 0)
        even = sum(1 for i in range(0, len(head), 2) if head[i] == 0)
        half = len(head) // 4
        if odd > half:
            return {"text": raw.decode("utf-16-le", "replace"), "enc": "utf-16", "fixed": True}
        if even > half:
            return {"text": raw.decode("utf-16-be", "replace"), "enc": "utf-16", "fixed": True}
    try:
        return {"text": raw.decode("utf-8"), "enc": "utf-8", "fixed": False}
    except UnicodeDecodeError:
        return {"text": raw.decode("cp1252", "replace"), "enc": "windows-1252", "fixed": True}


# ------------------------------------------------------------------------------------------- פענוח

_SRT_TIME = re.compile(r"(\d{1,3}):(\d{1,2}):(\d{1,2})[,.](\d{1,3})\s*-->\s*(\d{1,3}):(\d{1,2}):(\d{1,2})[,.](\d{1,3})")
_VTT_TS = r"(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})\.(\d{1,3})"
_VTT_TIME = re.compile(_VTT_TS + r"\s*-->\s*" + _VTT_TS + r"(.*)$")
_ASS_TIME = re.compile(r"^(\d{1,2}):(\d{1,2}):(\d{1,2})[.:](\d{1,3})$")
_TOP_AN = re.compile(r"\\an([789])|\\a([5679]|1[01])(?![0-9])")
_ITALIC_ON = re.compile(r"\\i1")


def _ms(h, m, s, f) -> int:
    f = (f + "00")[:3]
    return ((int(h or 0) * 60 + int(m)) * 60 + int(s)) * 1000 + int(f)


def detect(text: str) -> str:
    t = text.lstrip("﻿ \t\r\n")
    if t.startswith("WEBVTT"):
        return "vtt"
    if re.search(r"^\s*\[(Script Info|Events|V4\+? Styles)\]", t, re.M | re.I) or re.search(r"^Dialogue:", t, re.M):
        return "ass"
    if _SRT_TIME.search(t):
        return "srt"
    return ""


def _blocks(text: str) -> list[list[str]]:
    lines = text.replace("\r\n", "\n").replace("\r", "\n").split("\n")
    out, cur = [], []
    for ln in lines:
        if ln.strip() == "":
            if cur:
                out.append(cur)
                cur = []
        else:
            cur.append(ln.rstrip())
    if cur:
        out.append(cur)
    return out


def _parse_srt(text: str) -> list[dict]:
    cues = []
    for b in _blocks(text.lstrip("﻿")):
        i = next((k for k, ln in enumerate(b[:3]) if _SRT_TIME.search(ln)), -1)
        if i < 0:
            continue
        g = _SRT_TIME.search(b[i]).groups()
        body = b[i + 1:]
        # בלוק שנדבק לבלוק הבא בלי שורה ריקה: שורת זמן נוספת בגוף — חותכים שם
        cut = next((k for k, ln in enumerate(body) if _SRT_TIME.search(ln)), -1)
        rest = body[cut - 1 if cut > 0 and body[cut - 1].strip().isdigit() else cut:] if cut >= 0 else []
        if cut >= 0:
            body = body[:cut - 1] if cut > 0 and body[cut - 1].strip().isdigit() else body[:cut]
        cues.append({"s": _ms(*g[:4]), "e": _ms(*g[4:]), "raw": body})
        if rest:
            cues.extend(_parse_srt("\n".join(rest)))
    return cues


def _parse_vtt(text: str) -> list[dict]:
    cues = []
    for b in _blocks(text.lstrip("﻿")):
        if b[0].startswith(("WEBVTT", "NOTE", "STYLE", "REGION")) and not any("-->" in x for x in b[:2]):
            continue
        i = next((k for k, ln in enumerate(b[:3]) if "-->" in ln), -1)
        if i < 0:
            continue
        m = _VTT_TIME.search(b[i])
        if not m:
            continue
        g = m.groups()
        sett = g[8] or ""
        top = False
        lm = re.search(r"\bline:(-?\d+(?:\.\d+)?)(%?)", sett)
        if lm:
            v = float(lm.group(1))
            top = (v < 50) if lm.group(2) else (0 <= v <= 3)
        raw = b[i + 1:]
        if top and raw:
            raw = ["{\\an8}" + raw[0]] + raw[1:]
        cues.append({"s": _ms(*g[0:4]), "e": _ms(*g[4:8]), "raw": raw})
    return cues


def _ass_fields(fmt_line: str) -> list[str]:
    return [x.strip().lower() for x in fmt_line.split(":", 1)[1].split(",")]


def _parse_ass(text: str) -> list[dict]:
    cues, fmt, in_ev = [], None, False
    for ln in text.replace("\r\n", "\n").replace("\r", "\n").lstrip("﻿").split("\n"):
        s = ln.strip()
        if s.startswith("["):
            in_ev = s.lower() == "[events]"
            continue
        if not in_ev:
            continue
        if s.lower().startswith("format:"):
            fmt = _ass_fields(s)
            continue
        if not s.lower().startswith("dialogue:"):
            continue                                   # Comment / Picture / Sound — לא כתוביות
        f = fmt or ["layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"]
        parts = s.split(":", 1)[1].split(",", len(f) - 1)
        if len(parts) < len(f):
            continue
        row = {k: parts[j].strip() if k != "text" else parts[j] for j, k in enumerate(f)}
        a, z = _ASS_TIME.match(row.get("start", "")), _ASS_TIME.match(row.get("end", ""))
        if not a or not z:
            continue
        t = row.get("text", "")
        if re.search(r"\\p[1-9]", t):
            continue                                   # ציור וקטורי — לא טקסט
        t = t.replace("\\N", "\n").replace("\\n", "\n").replace("\\h", " ")
        cues.append({"s": _ms(*a.groups()), "e": _ms(*z.groups()), "raw": t.split("\n"), "ass": 1,
                     "name": row.get("name", "").strip()})
    return cues


# ------------------------------------------------------------------- תגיות: הטיה ומיקום (לכל כתובית)

_HTML = re.compile(r"</?[A-Za-z][^>]*>")
_BRACE = re.compile(r"\{[^}]*\}")
_VTT_TS_TAG = re.compile(r"<\d{1,2}:\d{2}(?::\d{2})?\.\d{1,3}>")
_LETTER = re.compile(r"[A-Za-zÀ-ɏ֐-׿؀-ۿЀ-ӿ]")


def _italic_mask(line: str, it: bool) -> tuple[str, int, int, bool]:
    """(טקסט נקי, אותיות בהטיה, כל האותיות, הטיה בסוף השורה) — <i>…</i> או {\\i1}…{\\i0}; ההטיה נמשכת לשורה הבאה."""
    out, n_it, n_all = [], 0, 0
    i = 0
    while i < len(line):
        ch = line[i]
        if ch == "<":
            j = line.find(">", i)
            if j > 0:
                tag = line[i + 1:j].strip().lower()
                if tag == "i":
                    it = True
                elif tag == "/i":
                    it = False
                i = j + 1
                continue
        if ch == "{":
            j = line.find("}", i)
            if j > 0:
                tag = line[i:j + 1]
                if re.search(r"\\i1", tag):
                    it = True
                elif re.search(r"\\i0|\\r", tag):
                    it = False
                i = j + 1
                continue
        out.append(ch)
        if _LETTER.match(ch):
            n_all += 1
            if it:
                n_it += 1
        i += 1
    return "".join(out), n_it, n_all, it


def _norm_ws(s: str) -> str:
    return re.sub(r"[ \t ]+", " ", s).strip()


# -------------------------------------------------------------------------------------- ניקוי ו־SDH

_AD = re.compile(
    r"(subtitles?|subs|captions?|captioning|synced?|sync|resync(?:ed)?|corrected|ripped|encoded|transcript|timing)\s*(?:&\s*\w+\s*)?(by|:)"
    r"|opensubtitles|addic7ed|subscene|podnapisi|yts\.|yify|\bwww\.|https?://|[a-z0-9-]+\.(?:com|org|net|tv|io)\b"
    r"|support us|become (?:a )?vip|advertise your|osdb\.link", re.I)
_LABEL = re.compile(r"^([-–—]\s*)?([A-Z][A-Z0-9'’.\- ]{0,24}?)(\s*\([^)]{0,30}\))?\s*:\s+(?=\S)")
_MUSIC_ONLY = re.compile(r"^[\s♪♫#*]+$")


def _remove_spans(lines: list[str], op: str, cl: str) -> tuple[list[str], int]:
    """מסיר [..] / (..) גם כשנמשך על כמה שורות. מחזיר (שורות, כמה הוסרו)."""
    text = "\n".join(lines)
    out, n, i = [], 0, 0
    while i < len(text):
        j = text.find(op, i)
        if j < 0:
            out.append(text[i:])
            break
        out.append(text[i:j])
        k = text.find(cl, j + 1)
        if k < 0 or text.count("\n", j, k) > 2:
            out.append(text[j:])                       # לא נסגר — לא נוגעים (כנראה לא תיאור צליל)
            break
        n += 1
        out.append("\n" * text.count("\n", j, k))
        i = k + 1
    return "".join(out).split("\n"), n


def _strip_label(line: str) -> tuple[str, str]:
    m = _LABEL.match(line)
    if not m:
        return line, ""
    label = m.group(2).strip()
    rest = line[m.end():]
    words = label.split()
    if not words or len(words) > 3 or not re.search(r"[A-Z]", label):
        return line, ""
    letters = [c for c in rest if c.isalpha()]
    if letters and all(c.isupper() for c in letters):
        return line, ""                                # "WARNING: HIGH VOLTAGE" — שלט, לא דובר
    return (m.group(1) or "") + rest, label


def _title(name: str) -> str:
    return " ".join(w[:1].upper() + w[1:].lower() if w.isupper() else w for w in name.split())


def parse(text: str, fmt: str | None = None) -> tuple[str, list[dict]]:
    fmt = fmt or detect(text)
    if fmt == "vtt":
        return fmt, _parse_vtt(text)
    if fmt == "ass":
        return fmt, _parse_ass(text)
    if fmt == "srt":
        return fmt, _parse_srt(text)
    return "", []


def import_subs(raw: bytes, sdh: bool = True) -> dict:
    """הכל: bytes → {fmt, enc, fixed, cues: [{s, e, lines, it, top, spk, dash}], stats, names}."""
    d = decode(raw)
    fmt, cues = parse(d["text"])
    st = {"fmt": fmt, "enc": d["enc"], "fixed": d["fixed"], "n_in": len(cues), "ads": 0, "empty": 0, "dups": 0,
          "overlaps": 0, "sorted": 0, "it": 0, "pit": 0, "top": 0, "sdh": 0, "sdh_cues": 0, "labels": 0, "dual": 0}
    names: dict[str, int] = {}
    order = list(range(len(cues)))
    order.sort(key=lambda k: (cues[k]["s"], k))
    if order != list(range(len(cues))):
        st["sorted"] = 1
    cues = [cues[k] for k in order]
    out = []
    for c in cues:
        ass = bool(c.get("ass"))
        top = False
        lines = []
        n_it = n_all = 0
        itx = False
        for ln in c["raw"]:
            if _TOP_AN.search(ln):
                top = True
            ln = _VTT_TS_TAG.sub("", ln)
            ln = re.sub(r"<v(?:\.[^ >]*)?\s+([^>]*)>", "", ln)     # VTT: <v Speaker>
            t, a, b, itx = _italic_mask(ln, itx)
            n_it += a
            n_all += b
            p = None
            while t != p:                      # עד שאין מה להסיר — "<<i>script>" → "<script>" בהסרה אחת
                p = t
                t = _BRACE.sub("", _HTML.sub("", t))
            lines.append(_norm_ws(t))
        lines = [x for x in lines if x]
        whole = " ".join(lines)
        if not lines:
            st["empty"] += 1
            continue
        if _AD.search(whole) and len(whole) <= 120:
            st["ads"] += 1
            continue
        if c["e"] <= c["s"]:
            st["empty"] += 1
            continue
        spk = c.get("name", "") if ass else ""
        spks: list[str] = []                           # דובר לכל שורה שנשארה (מתווית SDH)
        if sdh:
            before = list(lines)
            lines, n1 = _remove_spans(lines, "[", "]")
            lines, n2 = _remove_spans(lines, "(", ")")
            kept = []
            for ln in lines:
                ln = _norm_ws(ln)
                if _MUSIC_ONLY.match(ln or "#") and ln:
                    continue
                ln2, label = _strip_label(ln)
                nm = ""
                if label:
                    st["labels"] += 1
                    nm = _title(label)
                    names[nm] = names.get(nm, 0) + 1
                ln2 = _norm_ws(ln2)
                if ln2 and re.search(r"[A-Za-z0-9À-ɏ]", ln2):
                    kept.append(ln2)
                    spks.append(nm)
            removed = n1 + n2
            if removed or kept != [_norm_ws(x) for x in before]:
                st["sdh"] += removed
                st["sdh_cues"] += 1
            lines = kept
            if spks and spks[0] and not spk:
                spk = spks[0]
            if not lines:
                continue
            if len(lines) == 1 and re.match(r"^[-–—]\s*", lines[0]):
                lines[0] = re.sub(r"^[-–—]\s*", "", lines[0])   # נשאר דובר אחד מתוך דיאלוג
        it = n_all > 0 and n_it * 10 >= n_all * 9
        dash = len(lines) == 2 and all(re.match(r"^[-–—]\s*\S", x) for x in lines)
        cur = {"s": c["s"], "e": c["e"], "lines": lines, "it": it, "pit": bool(n_it) and not it, "top": top,
               "spk": spk, "spk2": (spks[1] if dash and len(spks) > 1 else ""), "dash": dash}
        prev = out[-1] if out else None
        if prev and prev["lines"] == lines and cur["s"] < prev["e"]:
            prev["e"] = max(prev["e"], cur["e"])        # אותה כתובית פעמיים, חופפת בזמן — אחת (ברצף בלי חפיפה = דיבור שחוזר, נשאר)
            st["dups"] += 1
            continue
        if prev and prev["e"] > cur["s"]:
            prev["e"] = cur["s"]
            st["overlaps"] += 1
            if prev["e"] <= prev["s"]:
                out.pop()
                st["empty"] += 1
        out.append(cur)
    for c in out:
        st["it"] += int(c["it"])
        st["pit"] += int(c.pop("pit"))
        st["top"] += int(c["top"])
        st["dual"] += int(c["dash"])
    st["n"] = len(out)
    st["dur"] = out[-1]["e"] if out else 0
    st["names"] = len(names)
    return {"fmt": fmt, "enc": d["enc"], "fixed": d["fixed"], "cues": out, "stats": st,
            "names": sorted(names.items(), key=lambda kv: (-kv[1], kv[0]))}


# ------------------------------------------------------------------------------- המרה ל־vt (template)


def to_vt(imp: dict) -> tuple[list[dict], dict]:
    """→ (cues.en.json בלי תקציבים, speakers). דובר לפי תווית SDH (S1, S2… לפי סדר ההופעה)."""
    spk_ids: dict[str, str] = {}
    speakers: dict[str, dict] = {}

    def sid(name: str) -> str | None:
        if not name:
            return None
        if name not in spk_ids:
            k = "S" + str(len(spk_ids) + 1)
            spk_ids[name] = k
            speakers[k] = {"name": name}
        return spk_ids[name]

    cues = []
    for k, c in enumerate(imp["cues"], start=1):
        s, e = round(c["s"] / 1000, 3), round(c["e"] / 1000, 3)
        cue = {"id": k, "spk": sid(c["spk"]), "speech_s": s, "speech_e": e, "tpl": 1,
               "en": " ".join(c["lines"])}
        if c["it"]:
            cue["it"] = 1
        if c["top"]:
            cue["top"] = 1
        if c["dash"]:
            a, b = [re.sub(r"^[-–—]\s*", "", x) for x in c["lines"]]
            cue["en"] = a + " " + b
            cue["parts"] = [{"spk": cue["spk"], "en": a, "speech_s": s, "speech_e": e},
                            {"spk": sid(c["spk2"]), "en": b, "speech_s": s, "speech_e": e}]
        cues.append(cue)
    return cues, speakers


def transcript(imp: dict) -> str:
    """טקסט קריא להכנת התדריך (במקום התמליל): שורה לכל כתובית, עם הדובר כשידוע."""
    out = []
    for c in imp["cues"]:
        t = " ".join(c["lines"])
        m, s = divmod(c["s"] // 1000, 60)
        h, m = divmod(m, 60)
        out.append(f"[{h:d}:{m:02d}:{s:02d}{(' ' + c['spk']) if c['spk'] else ''}] {t}")
    return "\n".join(out) + "\n"
