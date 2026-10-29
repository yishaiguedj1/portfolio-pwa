"""תמלול עם faster-whisper וחותמות זמן למילה. שימוש: asr_fw.py <model_dir> <wav> <out.json> [lang] [compute]"""
import json, sys, time
import soundfile as sf
from faster_whisper import WhisperModel

mdir, wav, out = sys.argv[1:4]
lang = sys.argv[4] if len(sys.argv) > 4 else 'he'
compute = sys.argv[5] if len(sys.argv) > 5 else 'int8'
t0 = time.time()
m = WhisperModel(mdir, device='cpu', compute_type=compute, cpu_threads=4)
t1 = time.time()
audio, sr = sf.read(wav, dtype='float32')   # 16kHz מונו (PyAV בסביבה לא תואם ל־decode_audio)
assert sr == 16000
segs, info = m.transcribe(audio, language=lang, word_timestamps=True, condition_on_previous_text=False,
                          beam_size=5, vad_filter=True, vad_parameters={'min_silence_duration_ms': 500})
words, lines = [], []
for s in segs:
    lines.append({'s': round(s.start, 3), 'e': round(s.end, 3), 't': s.text.strip()})
    for w in s.words or []:
        words.append({'w': w.word.strip(), 's': round(w.start, 3), 'e': round(w.end, 3), 'p': round(w.probability, 3)})
t2 = time.time()
json.dump({'model': mdir, 'lang': lang, 'compute': compute, 'load_s': round(t1 - t0, 1), 'run_s': round(t2 - t1, 1),
           'dur': info.duration, 'words': words, 'lines': lines}, open(out, 'w'), ensure_ascii=False, indent=0)
print(f'✓ {out}: {len(words)} מילים, טעינה {t1 - t0:.0f}s, ריצה {t2 - t1:.0f}s (RTF {(t2 - t1) / info.duration:.2f})')
