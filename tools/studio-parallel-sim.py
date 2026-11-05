#!/usr/bin/env python3
"""סימולציה של עבודות סטודיו במקביל בשרת אחד (CX53) — docs/studio-parallel-plan.md (5/11/2026).

מודל: כל עבודה = שלבים (מעבד / המתנה), לכל שלב קבוע + לדקת סרטון. שלב מעבד מאט לפי מספר העבודות שבשלב מעבד
באותו רגע: k^(-log2 f), כש־f = השיפור בהכפלת ליבות שנמדד (1.8 תמלול/יישור, 1.5 צריבה), וקנס ריבוי תהליכונים.
המקדמים — מהמדידות של CX43 מחולקים בשיפור הליבות; גל 2 בתוכנית מחליף אותם במדידה מ־snb-timing.json.

הרצה: python3 tools/studio-parallel-sim.py   (הטבלאות של התוכנית: זמן לבד, האטה, נקודות הזהב, תרחישים)
"""
import math, random, copy
FA, FB, PEN = 1.8, 1.5, 0.93          # שיפור לכל הכפלת ליבות: תמלול/יישור, צריבה; קנס ריבוי תהליכונים
def phases(d, tr_par=6):
    # CX53 לבד, Haiku High. d = אורך הסרטון בדקות
    tr = 1 + 0.18 * d * 6 / tr_par
    return [('w', 1.5 + 0.01*d), ('c', 0.05*d, FA), ('w', 3.0), ('p', 0.108*d, FA, tr),
            ('w', 1.5 + 0.08*d), ('w', 0.4), ('w', 0.5), ('S',), ('c', 0.14*d, FB), ('w', 2.5 + 0.02*d)]
def cpu_frac(d):
    ph = phases(d); tot = alone(d)
    return sum(p[1] for p in ph if p[0] in 'cp') / tot
def sim(jobs, dt=0.01, pen=PEN):
    """jobs: [(start, d)] → [(wait?, subs, done)] — כולם רצים (בלי תור)"""
    J = [dict(ph=phases(d), i=0, rem=None, tr=None, st=s, sub=None, done=None) for s, d in jobs]
    t = 0.0
    while any(j['done'] is None for j in J):
        act = [j for j in J if j['st'] <= t and j['done'] is None]
        for j in act:
            while j['i'] < len(j['ph']):
                p = j['ph'][j['i']]
                if p[0] == 'S': j['sub'] = t; j['i'] += 1; continue
                if j['rem'] is None:
                    j['rem'] = p[1]; j['tr'] = p[3] if p[0] == 'p' else None
                break
        k = sum(1 for j in act if j['ph'][j['i']][0] in 'cp' and j['rem'] > 0)
        for j in act:
            p = j['ph'][j['i']]
            if p[0] in 'cp' and j['rem'] > 0:
                j['rem'] -= dt * k ** (-math.log2(p[2])) * (pen if k > 1 else 1)
            elif p[0] == 'w':
                j['rem'] -= dt
            if p[0] == 'p': j['tr'] -= dt
            if j['rem'] <= 0 and (p[0] != 'p' or j['tr'] <= 0):
                j['i'] += 1; j['rem'] = None
                while j['i'] < len(j['ph']) and j['ph'][j['i']][0] == 'S': j['sub'] = t; j['i'] += 1
                if j['i'] >= len(j['ph']): j['done'] = t
        t += dt
    return [(j['sub'] - j['st'], j['done'] - j['st']) for j in J]
_A = {}
def alone(d):
    if d not in _A: _A[d] = sim([(0, d)])[0][1]
    return _A[d]
def slow(n, d, gap=0.0):
    r = sim([(gap*i, d) for i in range(n)])
    return max(x[1] for x in r) / alone(d), r

FREE_MB = 21000
def need(d, a): return (a + 22*d) * 1.1
class Job:
    def __init__(s, idx, ta, d):
        s.idx, s.ta, s.d, s.ph, s.i, s.rem, s.tr, s.st, s.done = idx, ta, d, phases(d), 0, None, None, None, None
    def norm(s):
        while s.i < len(s.ph):
            p = s.ph[s.i]
            if p[0] == 'S': s.i += 1; continue
            if s.rem is None:
                s.rem = p[1]; s.tr = p[3] if p[0] == 'p' else None
            return
def step(run, t, dt, pen=PEN):
    for j in run: j.norm()
    k = sum(1 for j in run if j.ph[j.i][0] in 'cp' and j.rem > 0)
    for j in run:
        p = j.ph[j.i]
        if p[0] in 'cp' and j.rem > 0: j.rem -= dt * k ** (-math.log2(p[2])) * (pen if k > 1 else 1)
        elif p[0] == 'w': j.rem -= dt
        if p[0] == 'p': j.tr -= dt
        if j.rem <= 0 and (p[0] != 'p' or j.tr <= 0):
            j.i += 1; j.rem = None; j.norm()
            if j.i >= len(j.ph): j.done = t + dt
    return [j for j in run if j.done is None]
def predict(run, t, dt):
    r = copy.deepcopy(run); out = {}
    while r:
        r2 = step(r, t, dt)
        for j in r:
            if j.done is not None: out[j.idx] = j.done
        r, t = r2, t + dt
    return out
def run_policy(arr, S=None, slots=4, a=4600, dt=0.05, bf=False, AGE=20):
    jobs = [Job(i, ta, d) for i, (ta, d) in enumerate(sorted(arr))]
    q, run, t = list(jobs), [], 0.0
    nxt = 0.0
    while q or run:
        cand_i = 0
        while q and t >= nxt - 1e-9 and cand_i < len(q) and q[cand_i].ta <= t + 1e-9:
            c = q[cand_i]
            ok = len(run) < slots and sum(need(j.d, a) for j in run) + need(c.d, a) <= FREE_MB
            if ok and S is not None and run:
                c2 = copy.deepcopy(c); c2.st = t
                F = predict(run + [c2], t, dt * 2)
                F0 = predict(run, t, dt * 2)
                worst = max((F[j.idx] - j.st) / alone(j.d) for j in run + [c2])
                base = max((F0[j.idx] - j.st) / alone(j.d) for j in run)
                ok = worst <= max(S, base + 0.01)
            if not ok:
                if bf and t - q[0].ta < AGE and cand_i + 1 < len(q) and q[cand_i + 1].ta <= t + 1e-9:
                    cand_i += 1; continue
                nxt = t + 1.0; break
            c.st = t; run.append(q.pop(cand_i)); cand_i = 0
        run = step(run, t, dt); t += dt
    return [(j.st - j.ta, j.done - j.st, j.done - j.ta, (j.done - j.st) / alone(j.d), (j.done - j.ta) / alone(j.d), j.d) for j in jobs]

def dstar(n, S, gap=0.0):
    lo, hi = 1.0, 150.0
    if slow(n, lo, gap)[0] > S: return 0
    for _ in range(14):
        mid = (lo+hi)/2
        (lo, hi) = (mid, hi) if slow(n, mid, gap)[0] <= S else (lo, mid)
    return lo


if __name__ == "__main__":
    print("זמן לבד (כתוביות / סיום), חלק המעבד")
    for d in (5, 10, 20, 30, 60, 90, 120):
        s, e = sim([(0, d)])[0]
        print(f"  {d:>4} דק׳: {s:5.1f} / {e:5.1f} · {cpu_frac(d):.0%}")
    S = slow(2, 90)[0]
    print(f"העוגן: 2×90 יחד → {S:.2f}")
    print("נקודות הזהב (יחד):", {n: round(dstar(n, S), 1) for n in (3, 4, 5)})
    print("נקודות הזהב (הפרש 5 דק׳):", {n: round(dstar(n, S, 5), 1) for n in (3, 4)})
    for name, ar in (("3×90 יחד", [(0, 90)] * 3), ("3×60 יחד", [(0, 60)] * 3), ("2×60 ואז 60 בדקה 15", [(0, 60), (0, 60), (15, 60)])):
        for s in (None, 1.25, 1.35):
            r = run_policy(ar, s, a=3680)
            print(f"  {name} S={s}:", " | ".join(f"מחכה {w:.0f} · סה״כ {tt:.0f}" for w, rr, tt, x, ts, d in r))
