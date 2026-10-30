"""השרשרת המוצעת: עוגנים מ־ivrit (vt/karaoke.anchor — אותה התאמת רצפים של העובד) → CTC עברי בחלונות סביב העוגנים.
החלון מגביל את ה־CTC (לא "בורח" על פני שקט ארוך), וה־CTC נותן את הזמן המדויק בתוכו.
שימוש: hybrid.py <ctc_model_dir> <voc16.wav> <lyrics.txt> <asr.json> <out.json>"""
import json, os, sys, time
import numpy as np, soundfile as sf, torch
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'translator'))
from vt import karaoke as K
from ctc_forced_aligner import load_alignment_model, generate_emissions, get_spans, postprocess_results
from ctc_forced_aligner.alignment_utils import forced_align, merge_repeats
import os, re

mdir, wav, lyr, asrf, out = sys.argv[1:6]
PAD, MAXW, GAP = 1.0, 28.0, 2.5            # שוליים סביב החלון · אורך חלון מרבי · פער שמפצל חלון
NQ = re.compile('[֑-ׇ]')
t0 = time.time()
model, tok = load_alignment_model('cpu', mdir, dtype=torch.float32)
vocab = json.load(open(os.path.join(mdir, 'vocab.json')))
d = {k.lower(): v for k, v in vocab.items()}
blank_id = d.get('[pad]', d.get('<pad>'))
audio, sr = sf.read(wav, dtype='float32')
lines = K.parse_lyrics(open(lyr, encoding='utf-8').read())
words = K.anchor(lines, json.load(open(asrf))['words'])          # זמן משוער לכל מילה (עוגנים + מילוי)
t1 = time.time()

# חלונות: שורות רצופות, מתפצלים בפער גדול בין העוגנים או כשהחלון ארוך מדי
by_line = {}
for i, w in enumerate(words):
    by_line.setdefault(w['li'], []).append(i)
chunks, cur = [], []
for li in sorted(by_line):
    idx = by_line[li]
    if cur and (words[idx[0]]['s'] - words[cur[-1]]['e'] > GAP or words[idx[-1]]['e'] - words[cur[0]]['s'] > MAXW):
        chunks.append(cur); cur = []
    cur += idx
if cur: chunks.append(cur)


def letters(w):
    w = NQ.sub('', w).replace('׳', "'").replace('′', '').lower()
    return ' '.join(c for c in w if c in d and c not in ('|', '[pad]', '[unk]'))


res = [None] * len(words)
for ch in chunks:
    a = max(0.0, words[ch[0]]['s'] - PAD); b = min(len(audio) / sr, words[ch[-1]]['e'] + PAD)
    seg = torch.from_numpy(audio[int(a * sr):int(b * sr)].copy())
    em, stride = generate_emissions(model, seg, batch_size=1)
    star = em.shape[1] - 1
    toks, txt, keep = [], [], []
    for i in ch:
        t = letters(words[i]['w'])
        if t:
            toks += ['<star>', t]; txt += ['<star>', words[i]['w']]; keep.append(i)
    dd = dict(d); dd['<star>'] = star
    ids = [dd[c] for c in ' '.join(toks).split(' ') if c in dd]
    path, scores = forced_align(em.unsqueeze(0).float().numpy(), np.asarray([ids], dtype=np.int64), blank=blank_id)
    inv = {v: k for k, v in dd.items()}
    spans = get_spans(toks, merge_repeats(path.squeeze().tolist(), inv), inv[blank_id])
    for i, r in zip(keep, postprocess_results(txt, spans, stride, scores)):
        res[i] = {'w': words[i]['w'], 's': round(a + r['start'], 3), 'e': round(a + r['end'], 3), 'p': round(r['score'], 3)}
for i, w in enumerate(words):                 # מילה בלי אותיות (סימן בלבד) — הזמן המשוער
    if res[i] is None:
        res[i] = {'w': w['w'], 's': w['s'], 'e': w['e'], 'p': None}
t2 = time.time()
json.dump({'run_s': round(t2 - t0, 1), 'anchor_s': round(t1 - t0, 1), 'chunks': len(chunks), 'words': res}, open(out, 'w'), ensure_ascii=False)
print(f'✓ {out}: {len(res)} מילים, {len(chunks)} חלונות, {t2 - t1:.0f}s')
