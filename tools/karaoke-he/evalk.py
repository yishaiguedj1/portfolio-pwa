"""מדדי קריוקי לכל תוצאה (JSON עם words: w/s/e). שימוש: evalk.py <voc16.wav> <ref.txt|-> <res1.json> [res2.json ...]
1. דיוק הטקסט (כשיש מילים מקוריות): WER/CER אחרי נרמול (בלי ניקוד/פיסוק).
2. כיסוי שירה: כמה מכל מילה נופלת על פריימים שבהם הקול המופרד פעיל (RMS מעל סף), ואחוז מילים שמתחילות בשקט.
3. תקינות: משך מילה לא סביר (<60ms או >2.5s), חפיפות/חזרה לאחור, פערים גדולים בין מילים עוקבות.
4. הסכמה בין כלים: |Δ התחלה| בין כל זוג תוצאות עם אותו מספר מילים (חציון, ≤0.1, ≤0.3)."""
import json, re, sys
import numpy as np
import soundfile as sf

NQ = re.compile('[֑-ׇ]')
PUN = re.compile(r"[^\wא-ת' ]+")


def nrm(t):
    t = NQ.sub('', t).replace('״', '').replace('׳', "'")
    return [w for w in PUN.sub(' ', t).split() if w]


def ed(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p, d[0] = d[0], i
        for j in range(1, len(b) + 1):
            p, d[j] = d[j], min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] != b[j - 1]))
    return d[len(b)]


voc, sr = sf.read(sys.argv[1], dtype='float32')
hop = sr // 100
rms = np.sqrt(np.convolve(voc ** 2, np.ones(hop * 3) / (hop * 3), 'same')[::hop])
db = 20 * np.log10(rms + 1e-9)
thr = np.percentile(db, 95) - 30          # 30dB מתחת לשיא = "שר"
act = db > thr
ref = None if sys.argv[2] == '-' else nrm(open(sys.argv[2], encoding='utf-8').read())

rows, runs = [], {}
for f in sys.argv[3:]:
    d = json.load(open(f))
    ws = d.get('words') or []
    name = f.split('/')[-1].replace('.json', '')
    runs[name] = ws
    r = {'name': name, 'n': len(ws), 'sec': d.get('run_s') or round((d.get('emis_s') or 0) + (d.get('align_s') or 0), 1)}
    if ref:
        hyp = nrm(' '.join(w['w'] for w in ws))
        r['WER'] = round(ed(ref, hyp) / len(ref) * 100, 1)
        r['CER'] = round(ed(list(''.join(ref)), list(''.join(hyp))) / len(''.join(ref)) * 100, 1)
    cov, silent = [], 0
    for w in ws:
        a, b = int(w['s'] * 100), max(int(w['e'] * 100), int(w['s'] * 100) + 1)
        seg = act[a:b]
        cov.append(seg.mean() if len(seg) else 0)
        silent += not act[a:a + 5].any()
    r['cover%'] = round(float(np.mean(cov)) * 100, 1) if cov else 0
    r['start_silent%'] = round(silent / max(len(ws), 1) * 100, 1)
    durs = [w['e'] - w['s'] for w in ws]
    r['bad_dur%'] = round(sum(x < 0.06 or x > 2.5 for x in durs) / max(len(ws), 1) * 100, 1)
    r['backward'] = sum(ws[i]['s'] < ws[i - 1]['s'] - 1e-3 for i in range(1, len(ws)))
    r['gaps>4s'] = sum(ws[i]['s'] - ws[i - 1]['e'] > 4 for i in range(1, len(ws)))
    rows.append(r)

keys = list(dict.fromkeys(k for r in rows for k in r))
print(' | '.join(keys))
for r in rows:
    print(' | '.join(str(r.get(k, '')) for k in keys))
names = list(runs)
print('\nהסכמה בין כלים (התחלת מילה, רק כשמספר המילים זהה):')
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        a, b = runs[names[i]], runs[names[j]]
        if len(a) != len(b) or not a:
            continue
        dd = np.abs(np.array([x['s'] for x in a]) - np.array([y['s'] for y in b]))
        print(f'{names[i]} ↔ {names[j]}: חציון {np.median(dd):.3f}s · ≤0.1: {np.mean(dd <= .1) * 100:.0f}% · ≤0.3: {np.mean(dd <= .3) * 100:.0f}% · >1s: {int((dd > 1).sum())}')
