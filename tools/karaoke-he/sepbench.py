"""מדידת זמן של תצורת הפרדה (31/10/2026, docs/studio-karaoke-he.md "מהירות ההפרדה").
שימוש: python sepbench.py <תיקייה> <שם> <מודל> <overlap> <mixture|תצורה_קודמת>
<תיקייה>/tracks/<שיר>/{mixture,vocals}.wav (MUSDB18-HQ — סט המבחן, לא ב־git), <תיקייה>/models — המודלים.
בחירת החלון: לפי אנרגיית הקול, ולוודא alpha≈1 (המיקס = סכום הרצועות) — ב־"PR - Oh No" ‏0.735."""
import sys, os, time, json, shutil, glob
from pathlib import Path
import numpy as np, soundfile as sf
from audio_separator.separator import Separator
S = Path(sys.argv[1]); name, model, ov, src = sys.argv[2], sys.argv[3], int(sys.argv[4]), sys.argv[5]
outd = S / 'out' / name
sep = Separator(output_dir=str(S / 'tmp' / name), model_file_dir=str(S / 'models'), output_format='WAV', use_autocast=False,
                mdxc_params={'overlap': ov, 'segment_size': 256, 'batch_size': 1, 'pitch_shift': 0})
sep.load_model(model_filename=model)
def pick(files, *keys):
    for f in files:
        n = Path(f).name.lower()
        if any(k in n for k in keys):
            return Path(f)
res = {}
for tr in sorted((S / 'tracks').iterdir()):
    inp = tr / 'mixture.wav' if src == 'mixture' else S / 'out' / src / tr.name / 'voc.wav'
    t0 = time.time()
    files = [S / 'tmp' / name / Path(f).name for f in sep.separate(str(inp))]
    sec = time.time() - t0
    voc = pick(files, '(vocals)', '(vocal)', '(lead'); inst = next(f for f in files if f != voc)
    (outd / tr.name).mkdir(parents=True, exist_ok=True)
    shutil.move(str(voc), outd / tr.name / 'voc.wav'); shutil.move(str(inst), outd / tr.name / 'inst.wav')
    dur = sf.info(str(inp)).duration
    res[tr.name] = {'sec': round(sec, 1), 'dur': round(dur, 1)}
    print(name, tr.name, res[tr.name], flush=True)
tot = sum(r['sec'] for r in res.values()); d = sum(r['dur'] for r in res.values())
print(json.dumps({'cfg': name, 'sec': round(tot, 1), 'audio': round(d, 1), 'sec_per_min': round(tot / d * 60, 1)}), flush=True)
