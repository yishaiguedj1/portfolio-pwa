"""בקרת איכות בסגנון Netflix על הכתוביות הסופיות + בדיקת כיסוי הדיבור."""

from __future__ import annotations

import bisect

from .config import TimingRules, TextRules
from .hebrew import visible_len, has_latin
from .util import fmt_ts


def run_qc(cues: list[dict], words: list[dict], rules: TimingRules, text: TextRules,
           fps: float, shots: list[int], measure=None, max_px: float | None = None) -> tuple[str, dict]:
    errors, warns = [], []
    gap_min = rules.min_gap_frames
    n_over15 = n_over17 = 0
    durs = []
    for i, c in enumerate(cues):
        tag = f"#{c['id']} `{fmt_ts(c['start'])}`"
        lines = c["lines"]
        if len(lines) > text.max_lines:
            errors.append(f"{tag}: {len(lines)} שורות")
        for ln in lines:
            n = visible_len(ln)
            if n > text.max_chars_line:
                errors.append(f"{tag}: שורה של {n} תווים (מקס׳ {text.max_chars_line}) — {ln}")
            if measure is not None and max_px and measure.width(ln) > max_px:
                errors.append(f"{tag}: השורה רחבה מהמסך ({measure.width(ln):.0f}px > {max_px:.0f}px)")
        dur = (c["fo"] - c["fi"]) / fps
        durs.append(dur)
        if dur < rules.min_dur_s - 1e-6:
            warns.append(f"{tag}: משך {dur:.2f} שנ׳ — קצר מ־{rules.min_dur_s:.2f}")
        if dur > rules.max_dur_s + 1e-6:
            errors.append(f"{tag}: משך {dur:.2f} שנ׳ — ארוך מ־7")
        cps = c["chars"] / max(dur, 1e-6)
        if cps > 15:
            n_over15 += 1
        if cps > rules.cps_max + 0.05:
            n_over17 += 1
            (errors if cps > 20 else warns).append(f"{tag}: קצב קריאה {cps:.1f} תווים/שנ׳ — לקצר את הטקסט")
        if i + 1 < len(cues):
            g = cues[i + 1]["fi"] - c["fo"]
            if g < 0:
                errors.append(f"{tag}: חפיפה עם הכתובית הבאה")
            elif g < gap_min:
                errors.append(f"{tag}: מרווח {g} פריימים (מינ׳ {gap_min})")
        early = (c["si"] - c["fi"]) / fps
        late = (c["fi"] - c["si"]) / fps
        if late > rules.shot_red_s + 0.01:
            warns.append(f"{tag}: הכתובית נכנסת {late:.2f} שנ׳ אחרי תחילת הדיבור")
        if early > rules.shot_zone_s + 0.05:
            warns.append(f"{tag}: הכתובית נכנסת {early:.2f} שנ׳ לפני הדיבור")
        k = bisect.bisect_right(shots, c["fi"])
        if k < len(shots) and shots[k] < c["fo"]:
            S = shots[k]
            if c["so"] <= S:
                warns.append(f"{tag}: חוצה חילוף שוט בלי שהדיבור חוצה אותו")
        if has_latin(" ".join(lines)):
            pass  # מותג/מונח באנגלית — נבדק בשלב התרגום
        for fl in c.get("flags", []):
            if fl in ("speech_over_7s",):
                warns.append(f"{tag}: הדיבור עצמו ארוך מ־7 שנ׳ — לפצל בתכנון")

    # כיסוי: דיבור בלי כתובית (מעבר לתגובות רקע ומילוי שסוננו)
    spoken = [w for w in words if not w.get("skip") and not w.get("filler")]
    covered_until = 0
    gaps = []
    cue_spans = sorted((c["speech_s"], c["speech_e"]) for c in cues)
    j = 0
    run_start, run_n = None, 0
    for w in spoken:
        while j < len(cue_spans) and cue_spans[j][1] < w["s"] - 0.05:
            j += 1
        inside = j < len(cue_spans) and cue_spans[j][0] - 0.05 <= w["s"] <= cue_spans[j][1] + 0.05
        if not inside:
            if run_start is None:
                run_start, run_n = w["s"], 0
            run_n += 1
        else:
            if run_start is not None and run_n >= 3:
                gaps.append((run_start, run_n))
            run_start = None
    if run_start is not None and run_n >= 3:
        gaps.append((run_start, run_n))
    for t, n in gaps:
        warns.append(f"`{fmt_ts(t)}`: {n} מילים מדוברות בלי כתובית — לוודא שהושמטו בכוונה")
    _ = covered_until

    total = len(cues)
    stats = {
        "cues": total,
        "errors": len(errors),
        "warnings": len(warns),
        "avg_duration": round(sum(durs) / total, 2) if total else 0,
        "pct_over_15cps": round(100 * n_over15 / total, 1) if total else 0,
        "pct_over_17cps": round(100 * n_over17 / total, 1) if total else 0,
        "two_line": sum(1 for c in cues if len(c["lines"]) == 2),
    }
    rep = ["# בקרת איכות — כתוביות בעברית", "",
           f"- כתוביות: {total} · דו־שורתיות: {stats['two_line']} · משך ממוצע: {stats['avg_duration']} שנ׳",
           f"- מעל 15 תווים/שנ׳: {stats['pct_over_15cps']}% · מעל 17: {stats['pct_over_17cps']}%",
           f"- שגיאות: {len(errors)} · אזהרות: {len(warns)}", ""]
    if errors:
        rep += ["## שגיאות (חובה לתקן)", ""] + [f"- {e}" for e in errors] + [""]
    if warns:
        rep += ["## אזהרות (לבדוק)", ""] + [f"- {w}" for w in warns] + [""]
    if not errors and not warns:
        rep.append("הכל תקין.")
    return "\n".join(rep) + "\n", stats
