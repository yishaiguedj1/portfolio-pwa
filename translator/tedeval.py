"""הערכת תרגום מול כתוביות הייחוס האנושיות של TED — בלי טוקנים, בלי תלויות.

הכלי משווה את ה־SRT העברי שלנו לתרגום האנושי של TED לאותה הרצאה, ומחזיר:
chrF++ ברמת מסמך וברמת מקטע (מימוש תואם sacrebleu — אומת מולו ב־09/10/2026,
הפרש מקסימלי 3.6e-15 על 200 זוגות כתוביות עבריות אמיתיות), יחס אורך,
ובדיקות צורה (קצב קריאה, אורך שורה, ניקוד, אנגלית שנשארה).

היישור בין ציר הזמן שלנו לציר של TED נעשה בהיסט קבוע שנאמד מהמילים האנגליות
(הפודקאסט מוסיף פתיח), והזיווג — לפי חלונות הזמן של כתוביות הייחוס.

מצב השוואה (‎--srt-b): מדידה מזווגת של שתי גרסאות שלנו מול אותו ייחוס —
הפרש לכל מקטע + bootstrap מזווג. זה הכלי של כלל "שינוי נשמר רק אם משפר
בנטפליקס ולא מזיק בשלוש האחרות".

הרצה:
  python3 tedeval.py --srt out/he.srt --ref he.json --ref-en en.json --words en.aligned.json
  python3 tedeval.py --srt A/he.srt --srt-b B/he.srt --ref he.json ...   # השוואת A/B
"""

from __future__ import annotations

import argparse
import difflib
import json
import random
import re
import statistics
from collections import Counter
from pathlib import Path

# ---------------------------------------------------------------------------
# chrF++ — תואם sacrebleu (nc:6, nw:2, β=2, בלי lowercase, בלי רווחים בתווים)
# ---------------------------------------------------------------------------

_PUNCTS = set('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~')


def _chrf_words(sent: str) -> list[str]:
    """פיסוק ASCII בקצה מילה מופרד לטוקן — בדיוק כמו sacrebleu (כולל הבאג המתועד של '(hi)')."""
    out: list[str] = []
    for w in sent.split():
        if len(w) == 1:
            out.append(w)
        elif w[-1] in _PUNCTS:
            out += [w[:-1], w[-1]]
        elif w[0] in _PUNCTS:
            out += [w[0], w[1:]]
        else:
            out.append(w)
    return out


def chrfpp(hyp: str, ref: str, char_order: int = 6, word_order: int = 2, beta: int = 2) -> float:
    """ציון 0–100. ממוצע דיוק/כיסוי על הסדרים האפקטיביים ואז F_β — כמו sacrebleu."""
    stats: list[tuple[int, int, int]] = []
    ch, cr = "".join(hyp.split()), "".join(ref.split())
    for n in range(1, char_order + 1):
        h = Counter(ch[i:i + n] for i in range(len(ch) - n + 1))
        r = Counter(cr[i:i + n] for i in range(len(cr) - n + 1))
        stats.append((sum((h & r).values()), sum(h.values()), sum(r.values())))
    hw, rw = _chrf_words(hyp), _chrf_words(ref)
    for n in range(1, word_order + 1):
        h = Counter(tuple(hw[i:i + n]) for i in range(len(hw) - n + 1))
        r = Counter(tuple(rw[i:i + n]) for i in range(len(rw) - n + 1))
        stats.append((sum((h & r).values()), sum(h.values()), sum(r.values())))
    ap = ar = 0.0
    eff = 0
    for m, ht, rt in stats:
        if ht > 0 and rt > 0:
            ap += m / ht
            ar += m / rt
            eff += 1
    if not eff:
        return 0.0
    ap, ar = ap / eff, ar / eff
    if ap + ar == 0:
        return 0.0
    b2 = beta * beta
    return 100 * (1 + b2) * ap * ar / (b2 * ap + ar)


# ---------------------------------------------------------------------------
# נרמול עברית להשוואה הוגנת
# ---------------------------------------------------------------------------

_BIDI = re.compile(r"[‎‏‪-‮⁦-⁩﻿]")
# ניקוד בלבד — בלי סימני הפיסוק שבאותו גוש יוניקוד (מקף עברי 05BE, פסק 05C0, סוף פסוק 05C3, נו"ן הפוכה 05C6)
_NIKUD = re.compile(r"[ְ-ׇֽֿׁׂׅׄ]")
_PAREN_ONLY = re.compile(r"^[\s(\[][^)\]]*[)\]][\s.!?]*$")
_SPEAKER = re.compile(r"^[A-Zא-ת][\wא-ת .'׳-]{0,30}: ")


def strip_bidi(s: str) -> str:
    return _BIDI.sub("", s)


def norm_he(s: str) -> str:
    """נרמול לפני השוואה: תווי כיוון החוצה, ניקוד החוצה, גרשיים/מקף/שלוש־נקודות אחידים."""
    s = strip_bidi(s)
    s = _NIKUD.sub("", s)
    s = (s.replace("״", '"').replace("“", '"').replace("”", '"')
          .replace("׳", "'").replace("‘", "'").replace("’", "'")
          .replace("־", "-").replace("–", "-").replace("—", "-")
          .replace("…", "..."))
    return " ".join(s.split())


# ---------------------------------------------------------------------------
# קריאת קבצים
# ---------------------------------------------------------------------------

_SRT_TIME = re.compile(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->\s*(\d+):(\d+):(\d+)[,.](\d+)")


def parse_srt(text: str) -> list[dict]:
    """SRT ‏→ [{s, e, lines, text}] — עמיד ל־BOM ולתווי הכיוון שאנחנו מוסיפים."""
    cues = []
    for block in re.split(r"\n\s*\n", text.replace("\r\n", "\n").strip("﻿ \n")):
        lines = [ln for ln in block.split("\n") if ln.strip()]
        if len(lines) < 2:
            continue
        i = 1 if _SRT_TIME.search(lines[1]) else 0        # שורת המספר אופציונלית
        m = _SRT_TIME.search(lines[i])
        if not m:
            continue
        g = [int(x) for x in m.groups()]
        body = [strip_bidi(ln).strip() for ln in lines[i + 1:]]
        body = [ln for ln in body if ln]
        cues.append({
            "s": g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000,
            "e": g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000,
            "lines": body,
            "text": " ".join(body),
        })
    return cues


def parse_ted(path: str | Path) -> list[dict]:
    """כתוביות TED ‏(JSON: ‏[{t: ms, x: טקסט}]) → ‏[{s, text}]; שם דובר בתחילת שורה מוסר."""
    cues = []
    for c in json.loads(Path(path).read_text(encoding="utf-8")):
        txt = " ".join(_SPEAKER.sub("", c["x"]).replace("\n", " ").split())
        cues.append({"s": c["t"] / 1000, "text": txt})
    return cues


def drop_sound_cues(cues: list[dict]) -> list[dict]:
    """כתובית שכולה בסוגריים — (מחיאות כפיים), (צחוק) — יורדת משני הצדדים."""
    return [c for c in cues if not _PAREN_ONLY.match(c["text"])]


# ---------------------------------------------------------------------------
# היסט וזיווג
# ---------------------------------------------------------------------------

def _en_tok(w: str) -> str:
    return re.sub(r"[^a-z0-9']", "", w.lower())


def estimate_offset(our_words: list[dict], en_cues: list[dict]) -> float:
    """ההיסט הקבוע שלנו מול TED: ‏our_time − ted_time, חציון על פתיחות הכתוביות שתואמו."""
    cue_toks, firsts = [], []
    for c in en_cues:
        ws = [t for t in (_en_tok(w) for w in c["text"].split()) if t]
        if ws:
            firsts.append((len(cue_toks), c["s"]))
            cue_toks += ws
    ours = [t for t in (_en_tok(w["w"]) for w in our_words) if t is not None]
    m: dict[int, int] = {}
    for a, b, n in difflib.SequenceMatcher(None, cue_toks, ours, autojunk=False).get_matching_blocks():
        for i in range(n):
            m[a + i] = b + i
    diffs = [our_words[m[i]]["s"] - t for i, t in firsts if i in m]
    if len(diffs) < 5:
        raise SystemExit("✗ פחות מ־5 עוגנים משותפים — אי אפשר לאמוד את ההיסט")
    return statistics.median(diffs)


def pair_segments(our: list[dict], ref: list[dict], offset: float) -> list[dict]:
    """לכל חלון ייחוס [t_i, t_{i+1}) — כל הכתוביות שלנו שמרכזן נופל בו (בציר של TED)."""
    pairs = []
    for i, rc in enumerate(ref):
        lo = rc["s"]
        hi = ref[i + 1]["s"] if i + 1 < len(ref) else float("inf")
        hyp = " ".join(c["text"] for c in our if lo <= (c["s"] + c["e"]) / 2 - offset < hi)
        pairs.append({"ref": rc["text"], "hyp": hyp, "t": rc["s"]})
    return pairs


# ---------------------------------------------------------------------------
# בדיקות צורה (הקבועים = כללי נטפליקס לעברית, כמו ב־vt)
# ---------------------------------------------------------------------------

CPS_MAX, LINE_MAX, LINES_MAX, DUR_MIN = 17.0, 42, 2, 5 / 6


def check_form(cues: list[dict]) -> dict:
    n = len(cues) or 1
    over_cps = over_line = over_lines = short = nikud = latin = dots = 0
    for c in cues:
        chars = sum(len(ln) for ln in c["lines"]) + max(len(c["lines"]) - 1, 0)
        dur = c["e"] - c["s"]
        over_cps += chars / max(dur, 1e-6) > CPS_MAX + 0.05
        over_line += any(len(ln) > LINE_MAX for ln in c["lines"])
        over_lines += len(c["lines"]) > LINES_MAX
        short += dur < DUR_MIN - 1e-9
        nikud += bool(_NIKUD.search(c["text"]))
        latin += bool(re.search(r"[A-Za-z]{2,}", c["text"]))
        dots += "..." in c["text"]
    pct = lambda k: round(100 * k / n, 1)  # noqa: E731
    return {"cues": len(cues), "over_cps%": pct(over_cps), "over_line%": pct(over_line),
            "over_lines%": pct(over_lines), "short%": pct(short), "nikud": nikud,
            "latin": latin, "three_dots": dots}


# ---------------------------------------------------------------------------
# הערכה והשוואה
# ---------------------------------------------------------------------------

def evaluate(pairs: list[dict]) -> dict:
    """ציוני מסמך ומקטעים על זוגות (אחרי נרמול; גם מסמך גולמי לשקיפות)."""
    covered = [p for p in pairs if p["hyp"]]
    doc_hyp = " ".join(p["hyp"] for p in pairs)
    doc_ref = " ".join(p["ref"] for p in pairs)
    seg = [chrfpp(norm_he(p["hyp"]), norm_he(p["ref"])) for p in covered]
    nh, nr = norm_he(doc_hyp), norm_he(doc_ref)
    return {
        "segments": len(pairs), "covered": len(covered),
        "chrf_doc": round(chrfpp(nh, nr), 2),
        "chrf_doc_raw": round(chrfpp(doc_hyp, doc_ref), 2),
        "chrf_seg_mean": round(statistics.fmean(seg), 2) if seg else 0.0,
        "chrf_seg_median": round(statistics.median(seg), 2) if seg else 0.0,
        "len_ratio_chars": round(len("".join(nh.split())) / max(len("".join(nr.split())), 1), 3),
        "len_ratio_words": round(len(nh.split()) / max(len(nr.split()), 1), 3),
    }


def compare(pairs_a: list[dict], pairs_b: list[dict], boot: int = 2000, seed: int = 7) -> dict:
    """השוואה מזווגת A מול B על אותם חלונות ייחוס: הפרש ממוצע, ‏win/loss, ‏CI מ־bootstrap."""
    assert len(pairs_a) == len(pairs_b)
    deltas = []
    for a, b in zip(pairs_a, pairs_b):
        if a["hyp"] or b["hyp"]:
            deltas.append(chrfpp(norm_he(a["hyp"]), norm_he(a["ref"]))
                          - chrfpp(norm_he(b["hyp"]), norm_he(b["ref"])))
    rng = random.Random(seed)
    means = sorted(statistics.fmean(rng.choices(deltas, k=len(deltas))) for _ in range(boot))
    lo, hi = means[int(boot * 0.025)], means[int(boot * 0.975)]
    return {"n": len(deltas), "delta_mean": round(statistics.fmean(deltas), 3),
            "a_wins": sum(d > 0 for d in deltas), "b_wins": sum(d < 0 for d in deltas),
            "ci95": [round(lo, 3), round(hi, 3)],
            "significant": lo > 0 or hi < 0}


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def _load_side(srt_path: str, ref_he: list[dict], en_cues: list[dict], words: list[dict]):
    cues = drop_sound_cues(parse_srt(Path(srt_path).read_text(encoding="utf-8")))
    off = estimate_offset(words, en_cues)
    return pair_segments(cues, ref_he, off), cues, off


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="הערכת he.srt מול תרגום TED האנושי")
    ap.add_argument("--srt", required=True, help="out/he.srt שלנו")
    ap.add_argument("--srt-b", help="גרסה שנייה להשוואה מזווגת (B)")
    ap.add_argument("--ref", required=True, help="JSON כתוביות עברית של TED")
    ap.add_argument("--ref-en", required=True, help="JSON כתוביות אנגלית של TED (לעיגון ההיסט)")
    ap.add_argument("--words", required=True, help="en.aligned.json של הפרויקט (מילים עם זמנים)")
    ap.add_argument("--json", help="כתיבת הדוח גם כ־JSON לקובץ")
    a = ap.parse_args(argv)

    ref_he = drop_sound_cues(parse_ted(a.ref))
    en_cues = drop_sound_cues(parse_ted(a.ref_en))
    words = json.loads(Path(a.words).read_text(encoding="utf-8"))["words"]

    pairs, cues, off = _load_side(a.srt, ref_he, en_cues, words)
    rep = {"offset_s": round(off, 2), "eval": evaluate(pairs), "form": check_form(cues)}

    print(f"היסט מול TED: ‏{rep['offset_s']} שנ׳ · חלונות ייחוס: {rep['eval']['segments']}"
          f" (מכוסים: {rep['eval']['covered']})")
    e = rep["eval"]
    print(f"chrF++ מסמך: {e['chrf_doc']} (גולמי {e['chrf_doc_raw']}) · "
          f"מקטע ממוצע {e['chrf_seg_mean']} · חציון {e['chrf_seg_median']}")
    print(f"יחס אורך (תווים/מילים): {e['len_ratio_chars']} / {e['len_ratio_words']} — "
          "אנחנו מכוונים לקצר מהייחוס (17 CPS מול 21 של TED)")
    f = rep["form"]
    print(f"צורה: {f['cues']} כתוביות · קצב>{CPS_MAX:g}: ‏{f['over_cps%']}% · "
          f"שורה>{LINE_MAX}: ‏{f['over_line%']}% · >2 שורות: {f['over_lines%']}% · "
          f"קצרות: {f['short%']}% · ניקוד: {f['nikud']} · לטינית: {f['latin']} · '...': {f['three_dots']}")

    if a.srt_b:
        pairs_b, cues_b, off_b = _load_side(a.srt_b, ref_he, en_cues, words)
        rep["eval_b"] = evaluate(pairs_b)
        rep["form_b"] = check_form(cues_b)
        rep["compare"] = compare(pairs, pairs_b)
        c = rep["compare"]
        print(f"\nהשוואה מזווגת (A − B) על {c['n']} חלונות: ‏Δ={c['delta_mean']} ‏chrF++ · "
              f"A מנצח {c['a_wins']} / B מנצח {c['b_wins']} · CI95 {c['ci95']}"
              + (" · מובהק" if c["significant"] else " · בתוך הרעש"))

    if a.json:
        Path(a.json).write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
