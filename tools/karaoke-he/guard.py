"""stable-ts (ivrit) כבסיס — הכי מדויק לפי ההאזנה; מילה שסוטה מה־CTC בחלונות ביותר מ־TH שנ׳ (קריסה) → הזמן של ה־CTC.
קריסה = רצף של 2+ מילים (מילה בודדת נשארת stable-ts). במחלוקת — השופט הוא הזמן שבו ivrit עצמו שמע את המילה (vt/karaoke.anchor מול התמלול): נבחר הקרוב אליו.
שימוש: guard.py <st.json> <ctc.json> <out.json> <TH> <lyrics.txt> <asr.json>"""
import json, os, sys
out = sys.argv[3]
st, ct = (json.load(open(f))['words'] for f in sys.argv[1:3])
TH = float(sys.argv[4]) if len(sys.argv) > 4 else 0.7
bad = [abs(a['s'] - b['s']) > TH for a, b in zip(st, ct)]
for i in range(1, len(bad) - 1):
    if bad[i - 1] and bad[i + 1]:
        bad[i] = True
# רק רצף של 2+ מילים נחשב קריסה. מילה בודדת בתחילת שורה שסוטה — לפי ההאזנה stable-ts צודק שם
run = [False] * len(bad)
i = 0
while i < len(bad):
    j = i
    while j < len(bad) and bad[j]:
        j += 1
    if j - i >= 2:
        run[i:j] = [True] * (j - i)
    i = max(j, i + 1)
bad = run
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'translator'))
from vt import karaoke as K
anc = K.anchor(K.parse_lyrics(open(sys.argv[5], encoding='utf-8').read()), json.load(open(sys.argv[6]))['words'])
assert len(anc) == len(st)
bad = [b and abs(ct[i]['s'] - anc[i]['s']) < abs(st[i]['s'] - anc[i]['s']) for i, b in enumerate(bad)]
# רוב 2 מ־3 גם למילה בודדת: CTC ו־ivrit מסכימים (≤0.4s) ו־stable-ts רחוק משניהם (>TH) — stable-ts "מתח" את המילה אחורה
one = [abs(ct[i]['s'] - anc[i]['s']) <= 0.4 and abs(st[i]['s'] - anc[i]['s']) > TH and abs(st[i]['s'] - ct[i]['s']) > TH for i in range(len(st))]
bad = [a or b for a, b in zip(bad, one)]
# מילה שפותחת שורה ש־stable-ts מתח אחורה אל ההפסקה שלפניה (משך >1.2s, וה־CTC מתחיל בתוכה) — Whisper (וגם ivrit, אותה הטיה) מקדים אותה
first, k = set(), 0
for ln in K.parse_lyrics(open(sys.argv[5], encoding='utf-8').read()):
    first.add(k); k += len(ln)
st_ = [i in first and st[i]['e'] - st[i]['s'] > 1.2 and st[i]['s'] + 0.4 < ct[i]['s'] < st[i]['e'] for i in range(len(st))]
bad = [a or b for a, b in zip(bad, st_)]
ws = [dict(b if bad[i] else a, src='ctc' if bad[i] else 'st') for i, (a, b) in enumerate(zip(st, ct))]
for i in range(1, len(ws)):                          # רציפות בגבולות ההחלפה
    if ws[i]['s'] < ws[i - 1]['s'] + 0.02:
        ws[i]['s'] = round(ws[i - 1]['s'] + 0.02, 3)
    if ws[i - 1]['e'] > ws[i]['s']:
        ws[i - 1]['e'] = ws[i]['s']
    ws[i]['e'] = max(ws[i]['e'], round(ws[i]['s'] + 0.08, 3))
json.dump({'words': ws, 'th': TH, 'from_ctc': sum(bad)}, open(out, 'w'), ensure_ascii=False)
print(f'✓ {out}: {sum(bad)} מתוך {len(ws)} מילים מה־CTC:', [i for i, b in enumerate(bad) if b])
