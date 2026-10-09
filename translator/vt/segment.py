"""תכנון הכתוביות: חלוקת התמליל המיושר ליחידות תצוגה (cues).

כל כתובית היא רצף מילים באנגלית שנאמר ברצף אחד, כך שהתרגום שלה יוצג
בדיוק בזמן שהדברים נאמרים. החלוקה:
1. משפטים (פיסוק, החלפת דובר, הפסקה ארוכה).
2. בתוך משפט ארוך — חלוקה אופטימלית (תכנות דינמי) בנקודות טבעיות:
   פיסוק > הפסקה בדיבור > לפני מילת קישור, ולעולם לא אחרי "the/of/to".
3. איחוד משפטים קצרים של אותו דובר, וכתובית "שני דוברים" לחילופי דברים קצרים.
4. השמטת מילות מילוי ותגובות רקע ("mm-hmm", "right") של המראיין באמצע תשובה.
"""

from __future__ import annotations

import math
import re

from .config import TimingRules, TextRules
from .transcript import norm, is_filler, BACKCHANNEL

ABBREV = {"mr.", "mrs.", "ms.", "dr.", "st.", "vs.", "etc.", "e.g.", "i.e.", "jr.", "sr.",
          "inc.", "co.", "corp.", "ltd.", "no.", "approx.", "dept.", "u.s.", "u.k.", "a.i."}
CONJ = {"and", "but", "so", "because", "which", "who", "whom", "whose", "that", "when", "where",
        "if", "or", "while", "although", "though", "since", "unless", "until", "before", "after",
        "as", "whether", "then", "yet", "nor", "how", "why", "what"}
BIND_FWD = {"the", "a", "an", "of", "to", "in", "on", "for", "with", "at", "by", "from", "into",
            "my", "your", "our", "their", "his", "her", "its", "this", "these", "those", "that's",
            "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "will", "would",
            "can", "could", "should", "must", "might", "may", "very", "really", "not", "no", "and",
            "or", "but", "i", "we", "you", "they", "he", "she", "it", "i'm", "we're", "you're",
            "they're", "it's", "there's", "about", "than", "like", "just", "more", "most", "so"}


def _ends_sentence(word: str) -> bool:
    w = word.strip()
    if not re.search(r"[.?!…][\"')\]]*$", w):
        return False
    lw = w.lower().rstrip("\"')]")
    if lw in ABBREV:
        return False
    if re.fullmatch(r"(?:[a-z]\.){2,}", lw):     # U.S. / A.I.
        return False
    return True


def sentences(words: list[dict], pause_s: float = 1.2) -> list[list[int]]:
    out, cur = [], []
    for i, w in enumerate(words):
        if w.get("skip"):
            continue
        if cur:
            prev = words[cur[-1]]
            if w.get("spk") != prev.get("spk") or w["s"] - prev["e"] >= pause_s:
                out.append(cur)
                cur = []
        cur.append(i)
        if _ends_sentence(w["w"]):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out


def mark_backchannels(words: list[dict], max_words: int = 3) -> int:
    """מסמן לדילוג תגובות רקע קצרות של דובר אחר באמצע תור, ומילוי בלבד."""
    turns, start = [], 0
    for i in range(1, len(words) + 1):
        if i == len(words) or words[i].get("spk") != words[i - 1].get("spk"):
            turns.append((start, i))
            start = i
    n = 0
    for k, (a, b) in enumerate(turns):
        toks = [norm(words[i]["w"]) for i in range(a, b)]
        if not toks:
            continue
        only_fill = all(t in BACKCHANNEL or t == "" for t in toks)
        if not only_fill or (b - a) > max_words:
            continue
        prev_spk = words[turns[k - 1][0]].get("spk") if k > 0 else None
        next_spk = words[turns[k + 1][0]].get("spk") if k + 1 < len(turns) else None
        sandwiched = prev_spk is not None and prev_spk == next_spk and prev_spk != words[a].get("spk")
        if sandwiched or all(is_filler(words[i]["w"]) for i in range(a, b)):
            for i in range(a, b):
                words[i]["skip"] = True
            n += b - a
    for w in words:   # מילוי בודד בתחילת/סוף משפט לא משנה תזמון — נשאר למילים, לא לטקסט
        if is_filler(w["w"]):
            w["filler"] = True
    return n


def _est_chars(words: list[dict], idx: list[int], ratio: float) -> float:
    txt = " ".join(words[i]["w"] for i in idx if not words[i].get("filler"))
    return len(txt) * ratio


def _break_after_cost(words: list[dict], j: int, last_in_sentence: bool) -> float:
    if last_in_sentence:
        return 0.0
    w, nxt = words[j], words[j + 1]
    t = w["w"]
    cost = 6.0
    if re.search(r"[,;:—–]$", t) or t.endswith("--"):
        cost = 1.0
    gap = nxt["s"] - w["e"]
    if gap >= 0.35:
        cost = min(cost, 1.5)
    elif gap >= 0.2:
        cost = min(cost, 2.5)
    if norm(nxt["w"]) in CONJ:
        cost = min(cost, 3.0)
    if norm(t) in BIND_FWD and not re.search(r"[,;:]$", t):
        cost = max(cost, 9.0)
    if t[:1].isupper() and nxt["w"][:1].isupper() and norm(t) not in {"i"}:
        cost += 4.0   # כנראה שם פרטי ארוך — לא לפצל
    if re.fullmatch(r"[\d$€£][\d,.%]*", t) or re.fullmatch(r"[\d,.%]+", nxt["w"]):
        cost += 3.0
    return cost


def plan_sentence(words: list[dict], idx: list[int], timing: TimingRules, text: TextRules) -> list[list[int]]:
    """חלוקה אופטימלית של משפט לכתוביות (DP על נקודות השבירה)."""
    n = len(idx)
    max_chars = text.max_chars_line * text.max_lines
    # מרווח ביטחון: אחרי הקדמת פריים ועיגול לפריימים הכתובית עדיין לא תעבור 7 שניות
    max_speech = timing.max_dur_s - 0.35
    INF = float("inf")
    best = [INF] * (n + 1)
    back = [0] * (n + 1)
    best[0] = 0.0
    for j in range(1, n + 1):
        for i in range(j - 1, -1, -1):
            seg = idx[i:j]
            dur = words[seg[-1]]["e"] - words[seg[0]]["s"]
            est = _est_chars(words, seg, text.he_en_ratio)
            if (dur > max_speech or est > max_chars * 1.1) and len(seg) > 1:
                if dur > timing.max_dur_s * 1.6:
                    break
                continue
            c = _break_after_cost(words, seg[-1], j == n)
            avail = dur + timing.linger_s
            cps = est / max(avail, timing.min_dur_s)
            if cps > timing.cps_max:
                c += (cps - timing.cps_max) * 1.5
            if dur < 1.5 and n > 1:
                c += (1.5 - dur) * 4.0
            if dur > 5.5:
                c += (dur - 5.5) * 1.5
            if est > text.max_chars_line * 1.6:
                c += 0.5
            total = best[i] + c + 1.0     # +1 לכל כתובית — מעדיף פחות פיצולים
            if total < best[j]:
                best[j] = total
                back[j] = i
    cuts, j = [], n
    while j > 0:
        i = back[j]
        cuts.append(idx[i:j])
        j = i
    return list(reversed(cuts))


def _span(words, ids):
    return words[ids[0]]["s"], words[ids[-1]]["e"]


def plan(words: list[dict], timing: TimingRules, text: TextRules) -> list[dict]:
    mark_backchannels(words)
    groups: list[dict] = []
    for sid, sent in enumerate(sentences(words)):
        content = [i for i in sent if not words[i].get("filler")]
        if not content:
            continue   # משפט של מילוי בלבד
        for part in plan_sentence(words, sent, timing, text):
            if all(words[i].get("filler") for i in part):
                continue
            groups.append({"ids": part, "spk": words[part[0]].get("spk"), "sent": sid})

    # איחוד כתוביות קצרות סמוכות של אותו דובר
    merged: list[dict] = []
    max_chars = text.max_chars_line * text.max_lines
    for g in groups:
        if merged:
            p = merged[-1]
            ps, pe = _span(words, p["ids"])
            gs, ge = _span(words, g["ids"])
            est = _est_chars(words, p["ids"] + g["ids"], text.he_en_ratio)
            short = (pe - ps) < 1.6 or (ge - gs) < 1.6
            if (p.get("spk") == g.get("spk") and "parts" not in p and short and gs - pe <= 0.6
                    and ge - ps <= 6.0 and est <= max_chars * 0.85):
                p["ids"] = p["ids"] + g["ids"]
                continue
        merged.append(g)

    # כתובית שני דוברים לחילופי דברים קצרים
    final: list[dict] = []
    i = 0
    while i < len(merged):
        a = merged[i]
        if i + 1 < len(merged):
            b = merged[i + 1]
            as_, ae = _span(words, a["ids"])
            bs, be = _span(words, b["ids"])
            ea = _est_chars(words, a["ids"], text.he_en_ratio)
            eb = _est_chars(words, b["ids"], text.he_en_ratio)
            if (a.get("spk") != b.get("spk") and ae - as_ <= 1.8 and be - bs <= 1.8
                    and ea <= 30 and eb <= 30 and bs - ae <= 0.5 and be - as_ <= 4.0):
                final.append({"ids": a["ids"] + b["ids"], "spk": a.get("spk"),
                              "parts": [{"ids": a["ids"], "spk": a.get("spk")},
                                        {"ids": b["ids"], "spk": b.get("spk")}]})
                i += 2
                continue
        final.append(a)
        i += 1

    cues = []
    for k, g in enumerate(final, start=1):
        ids = g["ids"]
        s, e = _span(words, ids)
        cue = {"id": k, "w0": ids[0], "w1": ids[-1], "spk": g.get("spk"),
               "speech_s": round(s, 3), "speech_e": round(e, 3),
               "en": " ".join(words[i]["w"] for i in ids if not words[i].get("filler")).strip()}
        if "parts" in g:
            cue["parts"] = [{"spk": p["spk"],
                             "en": " ".join(words[i]["w"] for i in p["ids"] if not words[i].get("filler")),
                             "speech_s": round(words[p["ids"][0]]["s"], 3),
                             "speech_e": round(words[p["ids"][-1]]["e"], 3)} for p in g["parts"]]
        cues.append(cue)

    budgets(cues, timing, text)
    return cues


def budgets(cues: list[dict], timing: TimingRules, text: TextRules) -> None:
    """תקציב תווים לתרגום: לפי הזמן הזמין (עד הכתובית הבאה) וקצב קריאה."""
    max_chars = text.max_chars_line * text.max_lines
    for k, c in enumerate(cues):
        nxt = cues[k + 1]["speech_s"] if k + 1 < len(cues) else c["speech_e"] + 2.0
        avail = min(c["speech_e"] + timing.linger_s, nxt - 0.08) - c["speech_s"]
        avail = max(avail, timing.min_dur_s)
        avail = min(avail, timing.max_dur_s)
        c["dur"] = round(avail, 2)
        c["budget"] = int(min(max_chars, math.floor(timing.cps_max * avail)))
        c["ideal"] = int(min(max_chars, math.floor(timing.cps_target * avail)))


def cps_merge(cues: list[dict], timing: TimingRules, text: TextRules, refit) -> tuple[list[dict], int]:
    """מיזוג מונע־CPS אחרי התרגום: כתובית שגם אחרי כל ההארכה אין לה זמן קריאה (דגל reading_speed
    מ־time_cues) מתאחדת עם שכנתה — אותו דובר, דיבור רציף — לכתובית אחת ארוכה יותר.

    זה השלב שחסר בסולם של נטפליקס (הארכה → השאלה מהמרווח → מיזוג → רק בסוף קיצור טקסט):
    בניסוי המתועד במחקר, הארכה לבדה הורידה חריגות קריאה מ־68% ל־29% והמיזוג ל־24% — בלי לשנות מילה.

    refit(cue) מחשב מחדש lines/chars לפי הטקסט העברי (break_lines + מדידת הגופן) ומחזיר אם נכנס
    בשתי שורות. המיזוג מתבצע רק כשהוא באמת פותר: הטקסט המאוחד נכנס, והקצב יורד מתחת לתקרה."""
    out: list[dict] = []
    merges = 0
    max_chars = text.max_chars_line * text.max_lines
    i = 0
    while i < len(cues):
        c = cues[i]
        nxt = cues[i + 1] if i + 1 < len(cues) else None
        slow = 'reading_speed' in (c.get('flags') or ()) or (nxt and 'reading_speed' in (nxt.get('flags') or ()))
        can = (nxt is not None and slow
               and c.get('spk') == nxt.get('spk') and not c.get('parts') and not nxt.get('parts')
               and c.get('he') not in (None, '=', '∅') and nxt.get('he') not in (None, '=', '∅')
               and nxt['speech_s'] - c['speech_e'] <= timing.chain_gap_s
               and nxt['speech_e'] - c['speech_s'] <= timing.max_dur_s - 0.2)
        if can:
            trial = dict(c)
            trial['he'] = (str(c['he']).rstrip() + ' ' + str(nxt['he']).lstrip()).strip()
            trial['en'] = (c.get('en', '') + ' ' + nxt.get('en', '')).strip()
            trial['speech_e'] = nxt['speech_e']
            fits = refit(trial)
            # הזמן הזמין למאוחדת: עד הדיבור של הכתובית שאחרי הבאה (או linger), כמו ב־budgets
            nn = cues[i + 2]['speech_s'] if i + 2 < len(cues) else nxt['speech_e'] + 2.0
            avail = min(nxt['speech_e'] + timing.linger_s, nn - 0.085) - c['speech_s']
            avail = min(avail, timing.max_dur_s)
            if fits and trial['chars'] <= max_chars and avail > 0 and trial['chars'] / avail <= timing.cps_max + 0.01:
                trial['w1'] = nxt.get('w1', trial.get('w1'))
                trial['cps_merged'] = [c['id'], nxt['id']]
                out.append(trial)
                merges += 1
                i += 2
                continue
        out.append(c)
        i += 1
    return out, merges


def retime(words: list[dict], cues: list[dict], timing: TimingRules, text: TextRules) -> dict:
    """זמני דיבור חדשים לכתוביות קיימות (אחרי יישור משופר) — בלי לשנות חלוקה ותרגום."""
    mark_backchannels(words)
    moved = []
    for c in cues:
        s, e = words[c["w0"]]["s"], words[c["w1"]]["e"]
        moved.append(abs(s - c["speech_s"]))
        c["speech_s"], c["speech_e"] = round(s, 3), round(e, 3)
        if c.get("parts"):
            idx = [i for i in range(c["w0"], c["w1"] + 1) if not words[i].get("skip")]
            n_a = len(c["parts"][0]["en"].split())
            seen, cut = 0, len(idx) - 1
            for k, i in enumerate(idx):
                if not words[i].get("filler"):
                    seen += 1
                if seen == n_a:
                    cut = k
                    break
            a, b = c["parts"]
            a["speech_s"], a["speech_e"] = round(words[idx[0]]["s"], 3), round(words[idx[cut]]["e"], 3)
            if cut + 1 < len(idx):
                b["speech_s"] = round(words[idx[cut + 1]]["s"], 3)
            b["speech_e"] = round(words[idx[-1]]["e"], 3)
    budgets(cues, timing, text)
    moved.sort()
    return {"cues": len(cues), "moved_over_100ms": sum(1 for x in moved if x > 0.1),
            "moved_over_300ms": sum(1 for x in moved if x > 0.3), "max_moved_s": round(moved[-1], 2) if moved else 0}
