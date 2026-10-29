"""יישור כפוי של מילים ידועות עם מודל CTC עברי (ctc-forced-aligner, בלי רומניזציה).
שימוש: align_ctc.py <model_dir> <wav> <lyrics.txt> <out.json>"""
import json, re, sys, time
import torch
import numpy as np
from ctc_forced_aligner import load_alignment_model, generate_emissions, get_spans, postprocess_results, load_audio
from ctc_forced_aligner.alignment_utils import forced_align, merge_repeats

mdir, wav, lyr, out = sys.argv[1:5]
NIQQUD = re.compile('[֑-ׇ]')


def norm(w, vocab):
    """מילה → אותיות שקיימות באוצר של המודל (בלי ניקוד ופיסוק). מחזיר '' אם לא נשאר כלום."""
    w = NIQQUD.sub('', w).replace('״', '').replace('׳', "'").lower()
    return ''.join(c for c in w if c in vocab and c not in ('|', ' '))


t0 = time.time()
model, tok = load_alignment_model('cpu', mdir, dtype=torch.float32)
vocab = {k.lower() for k in tok.get_vocab()}
t1 = time.time()
audio = load_audio(wav, model.dtype, 'cpu')
em, stride = generate_emissions(model, audio, batch_size=2)
t2 = time.time()

lines = [l.split() for l in open(lyr, encoding='utf-8').read().splitlines() if l.strip()]
orig, toks = [], []
for li, ln in enumerate(lines):
    for wi, w in enumerate(ln):
        n = norm(w, vocab)
        if n:
            orig.append((li, wi, w))
            toks.append(' '.join(n))
starred_t, starred_x = [], []
for t, o in zip(toks, orig):     # <star> לפני כל מילה — סופג קולות שאינם מילים (כמו star_frequency='segment')
    starred_t += ['<star>', t]
    starred_x += ['<star>', o[2]]
# כמו get_alignments של הספרייה, בלי בדיקת גודל האוצר (ב־imvladikon יש <s>/</s> נוספים)
import os
vj = os.path.join(mdir, 'vocab.json')   # המיפוי האמיתי של פלט המודל (ה־tokenizer מוסיף טוקנים מעבר לו)
d = {k.lower(): v for k, v in (json.load(open(vj)) if os.path.exists(vj) else tok.get_vocab()).items() if v < em.shape[1] - 1}
d['<star>'] = em.shape[1] - 1
blank_id = d.get('<blank>', d.get('[pad]', d.get('<pad>', tok.pad_token_id)))
idx = [d[c] for c in ' '.join(starred_t).split(' ') if c in d]
path, scores = forced_align(em.unsqueeze(0).float().numpy(), np.asarray([idx], dtype=np.int64), blank=blank_id)
inv = {v: k for k, v in d.items()}
segs = merge_repeats(path.squeeze().tolist(), inv)
blank = inv[blank_id]
spans = get_spans(starred_t, segs, blank)
res = postprocess_results(starred_x, spans, stride, scores)
words = [{'w': o[2], 'line': o[0], 's': round(r['start'], 3), 'e': round(r['end'], 3), 'p': round(r['score'], 3)}
         for o, r in zip(orig, res)]
t3 = time.time()
json.dump({'model': mdir, 'load_s': round(t1 - t0, 1), 'emis_s': round(t2 - t1, 1), 'align_s': round(t3 - t2, 1),
           'n': len(words), 'words': words}, open(out, 'w'), ensure_ascii=False, indent=0)
print(f'✓ {out}: {len(words)} מילים, פליטות {t2 - t1:.0f}s, יישור {t3 - t2:.1f}s')
