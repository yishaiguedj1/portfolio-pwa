"""מנוע התזמון — סנכרון מדויק לפריים בין הדיבור לכתובית.

הכללים (Netflix Timed Text Style Guide — Subtitle Timing Guidelines):
• כניסה בפריים הראשון של הדיבור (עד 1–2 פריימים לפניו).
• יציאה עד חצי שנייה אחרי סוף הדיבור, וארוך יותר רק אם קצב הקריאה מחייב.
• משך: לפחות 5/6 שנייה, לכל היותר 7 שניות.
• מרווח מינימלי 2 פריימים; מרווח קצר מחצי שנייה "נסגר" ל־2 פריימים (שרשור).
• חילופי שוטים: כניסה עד חצי שנייה אחרי חילוף → בדיוק על החילוף;
  יציאה עד חצי שנייה לפני חילוף → 2 פריימים לפני החילוף; כתובית לא חוצה
  חילוף אלא אם הדיבור עצמו חוצה אותו, ואז היא נמשכת לפחות חצי שנייה אחריו.

הכל מחושב בפריימים שלמים (FrameGrid) כדי שהתוצאה תהיה מדויקת לכל קצב פריימים.
"""

from __future__ import annotations

import bisect
import math

from .config import TimingRules
from .util import FrameGrid


def _shots_between(shots: list[int], lo: int, hi: int) -> list[int]:
    """חילופי שוטים S עם lo < S <= hi."""
    i = bisect.bisect_right(shots, lo)
    j = bisect.bisect_right(shots, hi)
    return shots[i:j]


def _nearest_shot(shots: list[int], f: int, zone: int) -> int | None:
    if not shots:
        return None
    i = bisect.bisect_left(shots, f)
    best = None
    for k in (i - 1, i):
        if 0 <= k < len(shots) and abs(shots[k] - f) <= zone:
            if best is None or abs(shots[k] - f) < abs(best - f):
                best = shots[k]
    return best


def time_cues(cues: list[dict], grid: FrameGrid, shots: list[int] | None,
              rules: TimingRules) -> list[dict]:
    """מחשב לכל כתובית fi (פריים ראשון) ו־fo (פריים יציאה, לא כולל).

    כל cue צריך: speech_s, speech_e (שניות), chars (אורך הטקסט העברי).
    """
    shots = sorted(set(shots or []))
    G = rules.min_gap_frames
    H = max(1, grid.frames(rules.shot_zone_s))
    R = max(1, grid.frames(rules.shot_red_s))
    L = grid.frames(rules.linger_s)
    MIN = int(math.ceil(rules.min_dur_s * grid.fps_f - 1e-9))
    MAX = int(math.floor(rules.max_dur_s * grid.fps_f + 1e-9))
    CHAIN = grid.frames(rules.chain_gap_s)

    for c in cues:
        c.setdefault("flags", [])
        c["so"] = grid.frame_ceil(c["speech_e"])           # סוף הדיבור (לא כולל)
        c["si"] = grid.frame_floor(c["speech_s"])          # הפריים שבו הדיבור מתחיל
        c["fi"] = max(0, c["si"] - rules.lead_frames)
        need = max(MIN, int(math.ceil(c.get("chars", 0) / rules.cps_max * grid.fps_f)))
        c["need"] = need
        fo = c["so"] + L
        if fo - c["fi"] < need:
            fo = c["fi"] + need
        if c["so"] - c["fi"] > MAX:
            c["flags"].append("speech_over_7s")   # 7 שניות הוא כלל קשיח — הכתובית נקטמת
        c["fo"] = min(fo, c["fi"] + MAX)

    # --- כניסה מול חילופי שוטים ---
    for c in cues:
        S = _nearest_shot(shots, c["fi"], H)
        if S is None or S == c["fi"]:
            continue
        if S < c["fi"]:
            nfi, kind = S, "cut"              # הדיבור מתחיל מעט אחרי חילוף → על החילוף
        elif S - c["fi"] <= R:
            nfi, kind = S, "cut_late"         # הדיבור מתחיל ממש לפני חילוף
        else:
            nfi, kind = max(0, S - H), "half_before_cut"
        if nfi < c["fi"] and c["so"] - nfi > MAX:
            c["flags"].append("no_snap_max")  # הקדמה הייתה מאריכה מעבר ל־7 שניות — כיסוי הדיבור קודם
            continue
        c["fi"], c["snap_in"] = nfi, kind
        c["fo"] = min(c["fo"], c["fi"] + MAX)

    # --- יציאה מול חילופי שוטים ---
    for c in cues:
        for S in _shots_between(shots, c["fi"], c["fo"] + H):
            if S >= c["fo"] + G:
                # חילוף מעט אחרי היציאה → להאריך עד 2 פריימים לפניו
                if S - c["fo"] <= H and (S - G) - c["fi"] <= MAX:
                    c["fo"] = S - G
                    c["snap_out"] = "extend_to_cut"
                break
            if S <= c["fi"]:
                continue
            e = c["so"] - S                    # כמה דיבור נשאר אחרי החילוף
            pull_back_ok = (S - G) - c["fi"] >= MIN
            if e <= R and pull_back_ok:
                c["fo"] = S - G                # הדיבור (כמעט) נגמר לפני החילוף
                c["snap_out"] = "before_cut"
                break
            # הדיבור חוצה את החילוף → הכתובית נשארת לפחות חצי שנייה אחריו
            c["fo"] = min(max(c["fo"], S + H), c["fi"] + MAX)
            c["snap_out"] = "cross_cut"
            if e < H:
                c["flags"].append("crosses_cut")

    # --- חפיפות, שרשור ומשך מינימלי ---
    for i, a in enumerate(cues):
        b = cues[i + 1] if i + 1 < len(cues) else None
        if b is None:
            continue
        if a["fo"] > b["fi"] - G:
            a["fo"] = b["fi"] - G
            if a["fo"] - a["fi"] < MIN:
                # ניסיון: לבטל את ההקדמה של הבאה (כניסה בדיוק בתחילת הדיבור)
                if b["fi"] < b["si"] and not b.get("snap_in"):
                    shift = min(b["si"] - b["fi"], MIN - (a["fo"] - a["fi"]))
                    b["fi"] += shift
                    a["fo"] = b["fi"] - G
            if a["fo"] - a["fi"] < MIN:
                a["flags"].append("under_min_duration")
        gap = b["fi"] - a["fo"]
        if G < gap < CHAIN:
            cut = _shots_between(shots, a["fo"], b["fi"])
            target = (cut[0] - G) if cut else (b["fi"] - G)
            if target > a["fo"] and target - a["fi"] <= MAX:
                a["fo"] = target
                a["chained"] = True

    # --- תוצאה ובדיקות ---
    for c in cues:
        if c["fo"] <= c["fi"]:
            c["fo"] = c["fi"] + MIN
            c["flags"].append("forced_min")
        if c["fo"] - c["fi"] > MAX:          # כלל קשיח: לעולם לא יותר מ־7 שניות
            c["fo"] = c["fi"] + MAX
            c["flags"].append("clamped_max")
        dur = c["fo"] - c["fi"]
        if dur < c["need"] and "under_min_duration" not in c["flags"]:
            c["flags"].append("reading_speed")
        c["start"] = grid.time_of(c["fi"])
        c["end"] = grid.time_of(c["fo"])
        c["cps"] = round(c.get("chars", 0) / max(dur / grid.fps_f, 1e-6), 1)
        late = (c["fi"] - c["si"]) / grid.fps_f
        if late > rules.shot_red_s + 1e-6:
            c["flags"].append("late_start")
        c["flags"] = sorted(set(c["flags"]))
    return cues
