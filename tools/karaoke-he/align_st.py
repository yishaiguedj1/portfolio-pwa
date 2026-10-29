"""יישור כפוי של מילים ידועות עם stable-ts מעל faster-whisper (ivrit). שימוש: align_st.py <model_dir> <wav> <lyrics.txt> <out.json>"""
import json, sys, time
import soundfile as sf
import stable_whisper
mdir, wav, lyr, out = sys.argv[1:5]
t0 = time.time(); m = stable_whisper.load_faster_whisper(mdir, device='cpu', compute_type='int8', cpu_threads=4); t1 = time.time()
audio, sr = sf.read(wav, dtype='float32')
text = open(lyr, encoding='utf-8').read()
r = m.align(audio, text, language='he', original_split=True)
t2 = time.time()
words = [{'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3), 'p': round(w.probability or 0, 3)} for s in r.segments for w in s.words]
json.dump({'model': mdir, 'load_s': round(t1 - t0, 1), 'run_s': round(t2 - t1, 1), 'words': words}, open(out, 'w'), ensure_ascii=False)
print(f'✓ {out}: {len(words)} מילים, ריצה {t2 - t1:.0f}s')
