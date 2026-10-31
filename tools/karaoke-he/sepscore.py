"""איכות ההפרדה מול האמת (31/10/2026): SDR של הקול והליווי + "קול שנשאר בליווי" (dB ביחס לקול). שימוש: python sepscore.py <תיקייה> <תצורות...>"""
import sys
from pathlib import Path
import numpy as np, soundfile as sf
S = Path(sys.argv[1])
def rd(p):
    a, _ = sf.read(str(p), dtype='float64', always_2d=True)
    return a
def sdr(ref, est):
    n = min(len(ref), len(est)); ref, est = ref[:n], est[:n]
    return 10 * np.log10((np.sum(ref ** 2) + 1e-9) / (np.sum((ref - est) ** 2) + 1e-9))
for cfg in sys.argv[2:]:
    rows = []
    for tr in sorted((S / 'tracks').iterdir()):
        o = S / 'out' / cfg / tr.name
        if not (o / 'voc.wav').exists():
            continue
        mix, voc = rd(tr / 'mixture.wav'), rd(tr / 'vocals.wav')
        acc = mix - voc
        ev, ei = rd(o / 'voc.wav'), rd(o / 'inst.wav')
        # דליפת קול לליווי: כמה מאנרגיית הקול האמיתי נשארת בליווי (הטלה), ב־dB ביחס לקול
        n = min(len(ei), len(voc)); r = ei[:n] - acc[:n]
        leak = 10 * np.log10((np.sum(r ** 2) + 1e-9) / (np.sum(voc[:n] ** 2) + 1e-9))
        rows.append((tr.name, sdr(voc, ev), sdr(acc, ei), leak))
    for r in rows:
        print(f'{cfg:12s} {r[0]:22s} קול {r[1]:6.2f}  ליווי {r[2]:6.2f}  שארית בליווי {r[3]:6.1f} dB')
    if rows:
        print(f'{cfg:12s} {"ממוצע":22s} קול {np.mean([r[1] for r in rows]):6.2f}  ליווי {np.mean([r[2] for r in rows]):6.2f}  שארית {np.mean([r[3] for r in rows]):6.1f} dB')
