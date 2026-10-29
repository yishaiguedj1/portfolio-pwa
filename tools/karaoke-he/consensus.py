"""אמת מהסכמה (leave-one-out): לכל כלי — האמת = ממוצע שני כלים אחרים, רק במילים ששניהם מסכימים עד 0.15s."""
import json, sys, itertools
import numpy as np
fs = sys.argv[1:]
R = {f.split('/')[-1].replace('.json', ''): np.array([w['s'] for w in json.load(open(f))['words']]) for f in fs}
names = list(R)
for n in names:
    others = [o for o in names if o != n]
    best = None
    for a, b in itertools.combinations(others, 2):
        ok = np.abs(R[a] - R[b]) <= 0.15
        truth = (R[a] + R[b]) / 2
        e = np.abs(R[n] - truth)[ok]
        line = f'{n:20s} מול ({a} + {b}): {ok.sum():3d} מילים בטוחות · חציון {np.median(e):.3f}s · ממוצע {e.mean():.3f} · ≤0.1: {np.mean(e <= .1) * 100:3.0f}% · ≤0.3: {np.mean(e <= .3) * 100:3.0f}% · >1s: {(e > 1).sum()}'
        print(line)
