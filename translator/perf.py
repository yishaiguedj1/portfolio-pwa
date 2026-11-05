"""קבלה חזויה — כמה ארוכה יכולה להיות עבודה שנכנסת עכשיו בלי להאט אף עבודה מעבר לתקרה (docs/studio-parallel-plan.md, 5/11/2026).

הסוכן "מריץ קדימה" בזיכרון את העבודות שרצות (לפי השלב שבו כל אחת נמצאת — prog.json של job.py) ואת המועמדת, ומחשב
לכל אחת את ההאטה הצפויה = (מה שעבר + מה שנשאר) ÷ הזמן שלה לבד. השרתון לוקח עבודה רק אם האורך שלה ≤ dmax.

המודל: כל עבודה = שלבים, לכל שלב קבוע + לדקת סרטון; שלב מעבד מאט לפי מספר העבודות שבשלב מעבד באותו רגע (k^-log2 f,
f = השיפור בהכפלת ליבות שנמדד: 1.8 תמלול/יישור, 1.5 צריבה) וקנס ריבוי תהליכונים. המקדמים — מהמדידות של היום
(tools/studio-parallel-sim.py, אותו מודל); מבחן העומס (גל 2) מכייל. רק מספרים — שום פרט של עבודה או משתמש.

SNB_PRED=off מכבה (רק הזיכרון קובע) · SNB_SLOW_MAX = התקרה (ברירת מחדל 1.35) · שגיאה כלשהי = בלי הגבלה.
"""
from __future__ import annotations

import math
import os

FA, FB, PEN = 1.8, 1.5, 0.93
SLOW_MAX = float(os.environ.get('SNB_SLOW_MAX', '1.35') or 1.35)
D_MAX = 240.0                    # מעבר לזה — אין הגבלה (אף סרטון לא ארוך מזה בפועל)
DT = 0.2                         # דקות — צעד הסימולציה (כמה מילישניות לחישוב)
# סדר השלבים בעבודת תרגום, כמו שהם מדווחים (ctx.report): up → tr (תמלול, הגהה) → al (יישור ‖ תרגום) → rv → bn → sv
STAGES = ('up', 'tr', 'al', 'rv', 'bn', 'sv')
ALIAS = {'tl': 'al'}


def enabled() -> bool:
    return os.environ.get('SNB_PRED', 'on') != 'off'


def phases(kind: str, d: float) -> list:
    """[(שלב, סוג, דקות לבד, f, תרגום־במקביל)] — סוג: c = מעבד, w = המתנה, p = מעבד שרץ לצד המתנה (יישור ‖ תרגום)"""
    if kind == 'rr':                                 # הפקה מחדש = צריבה ושמירה
        return [('bn', 'c', 0.14 * d, FB, 0), ('sv', 'w', 2.0, 0, 0)]
    if kind != 'tr':                                 # גיליון AI / העתקה — בלי מעבד
        return [('sv', 'w', 2.0, 0, 0)]
    return [('up', 'w', 1.5 + 0.01 * d, 0, 0), ('tr', 'c', 0.05 * d, FA, 0), ('tr', 'w', 3.0, 0, 0),
            ('al', 'p', 0.108 * d, FA, 1 + 0.18 * d), ('rv', 'w', 2.4 + 0.08 * d, 0, 0),
            ('bn', 'c', 0.14 * d, FB, 0), ('sv', 'w', 2.5 + 0.02 * d, 0, 0)]


def remaining(kind: str, d: float, st: str | None, p: float | None) -> list:
    """השלבים שנשארו לעבודה שנמצאת בשלב st באחוז p. שלב לא מוכר / בלי דיווח — מההתחלה (שמרני)."""
    ph = [list(x) for x in phases(kind, d)]
    st = ALIAS.get(st or '', st or '')
    idx = [i for i, x in enumerate(ph) if x[0] == st]
    if not idx:
        return ph
    rest = ph[idx[0]:]
    tot = sum(x[2] for x in rest if x[0] == st)
    cut = tot * max(0.0, min(1.0, float(p or 0)))
    for x in rest:
        if x[0] != st or cut <= 0:
            break
        take = min(x[2], cut)
        x[2] -= take
        if x[1] == 'p':
            x[4] = max(0.0, x[4] - take)
        cut -= take
    return [x for x in rest if x[2] > 1e-9 or (x[1] == 'p' and x[4] > 1e-9)]


def run(jobs: list) -> list:
    """jobs = [שלבים שנשארו] → כמה דקות עוד לכל אחת (כולן רצות מעכשיו)"""
    st = [{'ph': [list(x) for x in j], 'i': 0, 'done': None} for j in jobs]

    def over(x):                                     # שלב גמור: העבודה שלו נגמרה, וביישור ‖ תרגום — גם התרגום
        return x[2] <= 1e-9 and (x[1] != 'p' or x[4] <= 1e-9)

    t = 0.0
    while t < 2000:
        for s in st:
            while s['done'] is None and s['i'] < len(s['ph']) and over(s['ph'][s['i']]):
                s['i'] += 1
            if s['done'] is None and s['i'] >= len(s['ph']):
                s['done'] = t
        act = [s for s in st if s['done'] is None]
        if not act:
            break
        k = sum(1 for s in act if s['ph'][s['i']][1] in 'cp' and s['ph'][s['i']][2] > 0)
        for s in act:
            x = s['ph'][s['i']]
            if x[1] in 'cp' and x[2] > 0:
                x[2] -= DT * k ** (-math.log2(x[3])) * (PEN if k > 1 else 1)
            elif x[1] == 'w':
                x[2] -= DT
            if x[1] == 'p':
                x[4] -= DT
        t += DT
    return [s['done'] if s['done'] is not None else t for s in st]


_ALONE: dict = {}


def alone(kind: str, d: float) -> float:
    k = (kind, round(d, 1))
    if k not in _ALONE:
        _ALONE[k] = max(0.5, run([phases(kind, d)])[0])
    return _ALONE[k]


def worst(running: list, cand: tuple | None) -> float:
    """running = [(kind, d, elapsed_min, st, p)]; cand = (kind, d) או None → ההאטה הגרועה הצפויה"""
    jobs = [remaining(k, d, st, p) for k, d, _, st, p in running] + ([phases(*cand)] if cand else [])
    left = run(jobs)
    out = [(el + left[i]) / alone(k, d) for i, (k, d, el, _, _) in enumerate(running)]
    if cand:
        out.append(left[-1] / alone(*cand))
    return max(out) if out else 1.0


def dmax(running: list, slow_max: float | None = None) -> float | None:
    """האורך המרבי (דקות סרטון) של עבודת תרגום שאפשר לקבל עכשיו. None = בלי הגבלה (אין עבודה כבדה שרצה / כבוי).
    עבודה שכבר עברה את התקרה (בגלל עומס קודם) — לא מאטים אותה עוד מעבר ל־0.01."""
    if not enabled():
        return None
    run_h = [r for r in running if r[0] in ('tr', 'rr')]
    if not run_h:
        return None
    try:
        S = slow_max or SLOW_MAX
        lim = max(S, worst(run_h, None) + 0.01)
        if worst(run_h, ('tr', D_MAX)) <= lim:
            return None
        lo, hi = 0.0, D_MAX
        if worst(run_h, ('tr', 1.0)) > lim:
            return 0.0
        lo = 1.0
        for _ in range(10):
            mid = (lo + hi) / 2
            if worst(run_h, ('tr', mid)) <= lim:
                lo = mid
            else:
                hi = mid
        return round(lo, 1)
    except Exception:            # noqa: BLE001 — מדידה/ויסות בלבד: בתקלה רק הזיכרון קובע
        return None
