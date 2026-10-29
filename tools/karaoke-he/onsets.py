"""דיוק התחלת מילה מול "חזרת השירה": נקודות שבהן הקול המופרד עובר משקט (≥150ms) לשירה הן אמת־מידה אובייקטיבית.
לכל נקודה כזו — המילה שהכלי שם הכי קרוב אליה (עד 1.5 שנ׳), והסטייה. שימוש: onsets.py <voc16.wav> <res.json>..."""
import json, sys
import numpy as np, soundfile as sf
v, sr = sf.read(sys.argv[1], dtype='float32')
r = np.sqrt(np.convolve(v ** 2, np.ones(480) / 480, 'same')[::160]); db = 20 * np.log10(r + 1e-9)
on = db > np.percentile(db, 95) - 25
ons = [i / 100 for i in range(15, len(on)) if on[i] and not on[i - 15:i].any()]
print(f'נקודות חזרת שירה: {len(ons)}')
for f in sys.argv[2:]:
    ws = json.load(open(f))['words']
    # רק מילים שהכלי עצמו שם אחרי הפסקה (≥100ms) — אחרת פיזור אחיד "מוצא" מילה ליד כל נקודה
    st = np.array([w['s'] for i, w in enumerate(ws) if i == 0 or w['s'] - ws[i - 1]['e'] >= 0.1])
    err = []
    for t in ons:
        k = np.argmin(np.abs(st - t)) if len(st) else None
        if k is not None and abs(st[k] - t) <= 1.5:
            err.append(st[k] - t)
    e = np.abs(np.array(err))
    print(f"{f.split('/')[-1]:28s} נמצאו {len(err):2d}/{len(ons)} · חציון |Δ| {np.median(e):.3f}s · ממוצע {e.mean():.3f} · ≤0.1: {np.mean(e <= .1) * 100:3.0f}% · ≤0.3: {np.mean(e <= .3) * 100:3.0f}% · הטיה {np.median(err):+.3f}")
