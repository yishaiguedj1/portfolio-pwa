"""סט הזהב — הציון של עבודה מול תרגום אנושי, בעובד (פריט 15 בסבב הייעול, 21/10/2026).

port זהה ל־goldCompare ב־studionet.js (הטלפון): אותו פענוח SRT, אותן כתוביות צלילים,
אותו נרמול ואותו chrF++ (מ־tedeval). כך "ריצת מבחן" מקבלת ציון בלי שהטלפון פתוח.
שינוי כאן = גם שם (tests/gold-score.test.js משווה את שניהם).
"""
from __future__ import annotations

import math
import re

try:
    from tedeval import chrfpp, norm_he
except ImportError:                      # כשנטען כחבילה (translator.goldscore)
    from translator.tedeval import chrfpp, norm_he

_TIME = re.compile(r"(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})")
_SOUND_ONLY = re.compile(r"^[\s(\[][^)\]]*[)\]][\s.!?]*$")
_BRACES = re.compile(r"\{[^}]*\}")


def _jround(x: float) -> int:
    """Math.round של JavaScript (חצי — כלפי מעלה), לא העיגול הבנקאי של Python."""
    return int(math.floor(x + 0.5))


def _strip_tags(s: str) -> str:
    out, in_tag = [], False
    for ch in s:
        if ch == "<":
            in_tag = True
            continue
        if ch == ">":
            in_tag = False
            continue
        if not in_tag:
            out.append(ch)
    return "".join(out)


def _ms(h, m, s, ms) -> int:
    return ((int(h) * 60 + int(m)) * 60 + int(s)) * 1000 + int(ms.ljust(3, "0"))


def parse_srt(text: str) -> list[dict]:
    """SRT ‏→ [{a, b, t}] במילישניות — כמו parseSrt בטלפון."""
    text = str(text or "")
    if text.startswith("﻿"):
        text = text[1:]
    text = re.sub(r"\r\n?", "\n", text)
    out = []
    for block in re.split(r"\n{2,}", text):
        lines = [ln for ln in block.split("\n") if ln.strip() != ""]
        i = next((k for k, ln in enumerate(lines) if "-->" in ln), -1)
        if i < 0:
            continue
        m = _TIME.search(lines[i])
        if not m:
            continue
        t = _BRACES.sub("", _strip_tags(" ".join(lines[i + 1:])))
        t = re.sub(r"\s+", " ", t).strip()
        g = m.groups()
        a, z = _ms(*g[:4]), _ms(*g[4:])
        if z > a and t:
            out.append({"a": a, "b": z, "t": t})
    return sorted(out, key=lambda c: c["a"])


def time_cover(hyp: list[dict], ref: list[dict]) -> float:
    tot = cov = 0
    for c in ref:
        tot += c["b"] - c["a"]
        for x in hyp:
            if x["b"] <= c["a"]:
                continue
            if x["a"] >= c["b"]:
                break
            cov += min(c["b"], x["b"]) - max(c["a"], x["a"])
    return _jround(min(1, cov / tot) * 1000) / 10 if tot else 0


def gold_compare(hyp_text: str, ref_text: str) -> dict | None:
    """{s, tm, n} — chrF++ של כל הטקסט, כיסוי הזמן, מספר הכתוביות בייחוס. ייחוס ריק → None."""
    r = [c for c in parse_srt(ref_text) if not _SOUND_ONLY.match(c["t"])]
    if not r:
        return None
    h = [c for c in parse_srt(hyp_text) if not _SOUND_ONLY.match(c["t"]) and (c["a"] + c["b"]) / 2 >= r[0]["a"]]
    doc = lambda cs: norm_he(" ".join(c["t"] for c in cs))  # noqa: E731
    return {"s": _jround(chrfpp(doc(h), doc(r))), "tm": _jround(time_cover(h, r)), "n": len(r)}
