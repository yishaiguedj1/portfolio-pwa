"""25/10/2026 (תרגום בטלפון, שלב 2): מחולל הקבצים לבדיקת הזהות של Kotlin (testStudio · Ph2Test) מול הקוד של השרת.

מריצים את הפונקציות האמיתיות של השרת — vt/asr_parakeet.py, ‏vt/diarize.py, ‏vt/align.py, ‏onnx_asr 0.12.0, ‏qwen_asr —
על קלט סינתטי (בלי קול אמיתי, בלי מודלים גדולים) ושומרים קלט ופלט. גם מסנני המל שהטלפון צריך (assets של Studio).
שימוש (בסביבה עם התלויות של העובד — requirements.lock): python3 tools/ph2-fixtures.py <תיקיית מודל היישור — לטוקנייזר ולמעבד>
"""
import json, os, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'translator'))
import numpy as np
from vt import asr_parakeet as P, align as A, diarize as D
from onnx_asr.models.silero import SileroVad
from onnx_asr.preprocessors.numpy_preprocessor import NemoPreprocessorNumpy, _NumpyPreprocessor
from qwen_asr.inference.qwen3_forced_aligner import Qwen3ForceAlignProcessor

OUT = ROOT / 'android/app/src/testStudio/resources/ph2'
ASSETS = ROOT / 'android/app/src/studio/assets/ph2'
rng = np.random.default_rng(20261025)
fx = {}


def sig(sec, seed):
    """אות סינתטי: כמה צלילים + רעש, ב־int16 (נשמר כמו שהוא — שני הצדדים מחלקים ב־32768)"""
    r = np.random.default_rng(seed)
    t = np.arange(int(sec * 16000)) / 16000
    x = 0.3 * np.sin(2 * np.pi * 220 * t) + 0.2 * np.sin(2 * np.pi * 1330 * t + 1) + 0.05 * r.standard_normal(len(t))
    x *= np.linspace(0.2, 1.0, len(t))
    return np.clip(np.round(x * 32767), -32768, 32767).astype(np.int16)


# --- מסננים (assets) ---
ASSETS.mkdir(parents=True, exist_ok=True)
nemo_f = _NumpyPreprocessor('nemo128')._melscale_fbanks.astype('<f4')
nemo_f.tofile(ASSETS / 'nemo_mel_128.bin')
from transformers import WhisperFeatureExtractor
whisper_f = WhisperFeatureExtractor(feature_size=128).mel_filters.astype('<f4')
assert whisper_f.shape == (201, 128)
whisper_f.tofile(ASSETS / 'whisper_mel_128.bin')

# --- מאפייני Parakeet (NemoPreprocessorNumpy) ---
x = sig(0.31, 1); xf = (x.astype(np.float32) / 32768.0)
f, fl = NemoPreprocessorNumpy('nemo128')(xf[None, :], np.array([len(xf)]))
fx['nemo'] = {'x': x.tolist(), 'n': int(fl[0]), 'f': f[0].astype(float).round(6).tolist()}

# --- מל של Qwen (המעבד של המודל, כמו align_onnx) ---
from qwen_asr.inference.utils import normalize_audios
from vt import align_onnx
al = align_onnx.OnnxAligner(Path(sys.argv[1]))
x = sig(0.42, 2); xf = (x.astype(np.float32) / 32768.0) * 2.5     # שיא מעל 1 — בודק גם את הנרמול
wav = normalize_audios([(xf, 16000)])
inp = al.processor(text=['<|audio_start|><|audio_pad|><|audio_end|>'], audio=wav, return_tensors='np', padding=True)
flen = int(np.asarray(inp['feature_attention_mask'])[0].sum())
mel = np.asarray(inp['input_features'])[0][:, :flen]
fx['whisper'] = {'x': x.tolist(), 'gain': 2.5, 't': flen, 'm': mel.astype(float).round(6).tolist()}

# --- fbank של זיהוי הדוברים ---
x = sig(0.29, 3)
fb = D.fbank(x.astype(np.float32) / 32768.0)
fx['fbank'] = {'x': x.tolist(), 'f': fb.astype(float).round(5).tolist()}

# --- Silero: הסתברויות → קטעים (עם הפרמטרים של transcribe) ---
class V(SileroVad):
    def __init__(self):
        pass
probs = np.clip(np.repeat(rng.random(120), rng.integers(1, 12, 120)) * 1.15 - 0.1, 0, 1).astype(np.float32)
n = len(probs) * 512 - 200
segs = list(V()._merge_segments(V()._find_segments(probs, 512), n, 16000, min_silence_duration_ms=150,
                                 max_speech_duration_s=3600, min_speech_duration_ms=150, speech_pad_ms=0))
segs2 = list(V()._merge_segments(V()._find_segments(probs, 512), n, 16000, min_silence_duration_ms=150,
                                  max_speech_duration_s=2.0, min_speech_duration_ms=150, speech_pad_ms=30))
fx['vad'] = {'p': probs.astype(float).tolist(), 'n': n, 'segs': [list(map(int, s)) for s in segs],
             'segs2': [list(map(int, s)) for s in segs2]}

# --- חלונות, מילים, חורים, הצלה ---
s_ = sorted(rng.integers(0, 16000 * 200, 60).tolist())
segs = [(s_[i], s_[i + 1] - 400) for i in range(0, 58, 2) if s_[i + 1] - 400 > s_[i]] + [(16000 * 200, 16000 * 290)]
fx['chunks'] = {'segs': segs, 'n': 16000 * 300, 'out': [list(map(int, c)) for c in P._chunks(segs, 16000 * 300, 16000, pad=int(0.12 * 16000))]}
VOC = [' the', ' quick', ' br', 'own', ' fox', ',', '.', ' A', 'B', 'C', ' -', ' slash', ' W-I-S-P', ' don', "'t", ' 3', '.', '14', '▁um', ' café']
tw = []
for k in range(4):
    nt = int(rng.integers(5, 30))
    toks = [VOC[i] for i in rng.integers(0, len(VOC), nt)]
    ts = sorted((rng.integers(0, 400, nt) * 0.08).tolist())
    off, end = float(k * 37.5), float(k * 37.5 + 36)
    tw.append({'t': toks, 'ts': ts, 'o': off, 'e': end, 'w': P.tokens_to_words(toks, ts, off, end)})
tw = json.loads(json.dumps(tw))
fx['words'] = tw
words = json.loads(json.dumps([w for c in tw for w in c['w']]))   # עותק — ההצלה משנה את המילים במקום
words.sort(key=lambda w: w['s'])
vsegs = [(float(a), float(a + rng.random() * 9)) for a in sorted(rng.random(25) * 150)]
total = 151.3
found = P.holes(words, vsegs, total)
calls = []
def recog(a, b):
    k = len(calls)
    toks = [VOC[i] for i in np.random.default_rng(k).integers(0, len(VOC), 9)]
    ts = sorted((np.random.default_rng(100 + k).integers(0, int((b - a) / 0.08) + 1, 9) * 0.08).tolist())
    calls.append({'a': a, 'b': b, 't': toks, 'ts': ts})
    return P.tokens_to_words(toks, ts, a, b)
before = json.loads(json.dumps(words))
nres = P.rescue(words, found, recog, total)
fx['rescue'] = {'words': before, 'segs': vsegs, 'total': total, 'holes': [list(h) for h in found], 'calls': calls, 'n': nres, 'out': words}
# 25/10/2026: מרווחים סביב הספים (HOLE_S 0.9, ‏QUIET_S 1.8; החור מתחיל WORD_S אחרי תחילת המילה) — בדיבור: 0.8 (לא),
# 1.0 (כן); בשקט: 1.7 (לא), 2.0 (כן); בסוף 0.5 (לא)
hst = [0.0, 1.4, 3.0, 5.3, 7.9]
hw = [{'w': 'x', 's': x, 'e': round(x + 0.3, 3)} for x in hst]
hseg = [(0.0, 3.2)]   # דיבור רק בשני המרווחים הראשונים
htot = round(hst[-1] + P.WORD_S + 0.5, 3)
fx['holes2'] = {'words': hw, 'segs': hseg, 'total': htot, 'holes': [list(h) for h in P.holes(json.loads(json.dumps(hw)), hseg, htot)]}

# --- 25/10/2026: חלון בלי פיסוק (flat) ותמלול חוזר בחלונות קצרים (unflatten) ---
def _fw(text, s0=0.0):
    return [{'w': w, 's': round(s0 + 0.3 * i, 3), 'e': round(s0 + 0.3 * i + 0.25, 3), 'spk': None, 'conf': None}
            for i, w in enumerate(text.split())]
_F = ('so i think it shaped us it was a time when we all had to work and my mother had to become a salesperson to make some '
      'money and she did it all herself and she really stepped up and we learned from her that you do what you have to do')
_G = ('So I think it shaped us. It was a time when we all had to work, and my mother had to become a salesperson to make some '
      'money. And she did it all herself. She really stepped up, and we learned from her that you do what you have to do.')
_cases = [_fw(_F), _fw(_G), _fw(_F)[:39], _fw(_F.replace(' i ', ' I ')), _fw(_G.lower().replace(' i ', ' I ')),
          _fw(_F.replace('work and', 'work, and').replace('money and', 'money, and').replace('herself and', 'herself, and')),
          _fw(_F.replace(' i ', " i'm "))]
fx['flat'] = {'cases': _cases, 'flat': [P.flat(json.loads(json.dumps(c))) for c in _cases],
              'shape': [list(P._shape(c)) for c in _cases]}
_ch = [(0, 16000 * 40), (16000 * 40, 16000 * 80), (16000 * 80, 16000 * 120)]
_sg = [(0, 16000 * 18), (16000 * 19, 16000 * 39), (16000 * 40, 16000 * 79), (16000 * 80, 16000 * 119)]
_parts = [_fw(_F), _fw(_G, 40.0), _fw(_F, 80.0)]
_ucalls = []
def _urecog(a, b):
    g = _G.split() if a < 16000 * 80 else _G.split()[:20]          # השלישי — מילים חסרות: לא מחליפים
    t0 = 80.0 if a >= 16000 * 80 else 0.0                          # המילה i נאמרה ב־t0 + 0.3i
    out = [{'w': g[i], 's': round(t0 + 0.3 * i, 3), 'e': round(t0 + 0.3 * i + 0.25, 3), 'spk': None, 'conf': None}
           for i in range(len(g)) if a / 16000 <= t0 + 0.3 * i < b / 16000]
    _ucalls.append({'a': a, 'b': b, 'w': out})
    return json.loads(json.dumps(out))
_before = json.loads(json.dumps(_parts))
_nu = P.unflatten(_parts, _ch, _sg, 16000 * 120, 16000, _urecog)
fx['unflat'] = {'parts': _before, 'chunks': [list(c) for c in _ch], 'segs': [list(c) for c in _sg], 'n': 16000 * 120,
                'calls': _ucalls, 'done': _nu, 'out': _parts}

# --- טוקנייזר קטן באותה צורה של Qwen2 (byte-level BPE, הביטוי של Qwen2, NFC, טוקנים שנוספו) ---
from tokenizers import Tokenizer, models, pre_tokenizers, normalizers, trainers, Regex
PAT = r"""(?i:'s|'t|'re|'ve|'m|'ll|'d)|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+"""
tk = Tokenizer(models.BPE())
tk.normalizer = normalizers.NFC()
tk.pre_tokenizer = pre_tokenizers.Sequence([pre_tokenizers.Split(Regex(PAT), behavior='isolated', invert=False),
                                            pre_tokenizers.ByteLevel(add_prefix_space=False, use_regex=False)])
corpus = ["The quick brown fox jumps over the lazy dog. I've been there, don't worry!", "naïve café résumé 3.14159 2026",
          "Hello   world\n\nnew lines   and  spaces", "שלום עולם, מה שלומך?", "emoji 🎉 test 🎉🎉", "It's 1,000,000 dollars."] * 20
tk.train_from_iterator(corpus, trainers.BpeTrainer(vocab_size=700, initial_alphabet=pre_tokenizers.ByteLevel.alphabet(), show_progress=False))
d = tempfile.mkdtemp()
tk.model.save(d)
vocab = json.load(open(Path(d) / 'vocab.json'))
merges = (Path(d) / 'merges.txt').read_text(encoding='utf-8')
SPECIAL = ['<|audio_start|>', '<|audio_pad|>', '<|audio_end|>', '<timestamp>']
added = {t: len(vocab) + i for i, t in enumerate(SPECIAL)}
from transformers import Qwen2Tokenizer
vf, mf = Path(d) / 'vocab.json', Path(d) / 'merges.txt'
q = Qwen2Tokenizer(vocab_file=str(vf), merges_file=str(mf), errors='replace', unk_token=None, bos_token=None, eos_token=None, pad_token=None)
q.add_tokens(SPECIAL, special_tokens=True)
assert all(q.convert_tokens_to_ids(t) == i for t, i in added.items())
texts = ["The quick brown fox", "I've don't  it's", "naïve café", "naïve café", "3.14159 and 2026", "Hello   world\nnext",
         "שלום עולם", "🎉 emoji", "<|audio_start|><|audio_pad|><|audio_end|>quick<timestamp><timestamp>fox<timestamp><timestamp>",
         "x<timestamp>y<timestamp><timestamp>z", "  leading and trailing  ", "UPPER lower MiXeD", ""]
cases = [{'s': t, 'ids': q.encode(t, add_special_tokens=False)} for t in texts]
ap = Qwen3ForceAlignProcessor()
wl_cases = []
for t in ["Hello, world! It's 3.14 — ok?", "don't stop-believing (now)", "naïve café 2026", "...", "שלום world", "A B  C"]:
    w, ai = ap.encode_timestamp(t, 'English')
    wl_cases.append({'s': t, 'wl': w, 'ai': ai})
from vt.align_onnx import out_len
ids_cases = []
for mf_ in (37, 100, 233):
    w, ai = ap.encode_timestamp("The quick brown fox don't", 'English')
    ids_cases.append({'words': w, 'mel': mf_, 'ids': q.encode(ai.replace('<|audio_pad|>', '<|audio_pad|>' * out_len(mf_)), add_special_tokens=False)})
fx['tok'] = {'vocab': vocab, 'merges': merges, 'added': added, 'cases': cases, 'wl': wl_cases, 'ids': ids_cases,
             'clean': [[t, A.clean_token(t)] for t in ["Hello,", "it's", "—", "3.14", "(now)", "naïve", "שלום!", "...", "W-I-S-P", "x'y'"]]}

# --- היישור: fix_timestamp, חלוקה, מיפוי, החלה ותיקון סדר (align_words עם מנוע מדומה) ---
fts = []
for k in range(12):
    m = int(rng.integers(2, 40)) * 2
    a = np.sort(rng.integers(0, 3000, m)).astype(float) * 80
    for _ in range(int(rng.integers(0, 6))):
        a[int(rng.integers(0, m))] = float(rng.integers(0, 3000)) * 80
    fts.append({'d': a.tolist(), 'out': ap.fix_timestamp(a)})
fx['fix'] = fts
words = []
t = 0.4
for i in range(380):
    t += float(rng.choice([0.05, 0.1, 0.2, 0.3, 0.9, 2.4], p=[.3, .3, .2, .1, .07, .03]))
    w = str(VOC[int(rng.integers(0, len(VOC)))]).strip(' ▁') or 'um'
    if i % 37 == 5:
        w = '—'
    words.append({'w': w, 's': round(t, 3), 'e': round(t + float(rng.random()) * 0.5 + 0.02, 3), 'spk': None, 'conf': None})
    t = words[-1]['e']
wavd = tempfile.mkdtemp()
total = words[-1]['e'] + 1.7
import soundfile as sf
sf.write(Path(wavd) / 'z.wav', np.zeros(int(total * 16000), dtype=np.float32), 16000, subtype='PCM_16')
items_log = []
PLAN = A.plan_chunks(words, audio_len=total)
class FakeOnnx:
    """זמנים "של המודל": זמן התמלול של המילה ± רעש, לפעמים רחוק (suspicious), מילה שנשמטה או שונה (difflib)"""
    man = {'quant': 'fake'}
    cur = None
    def align(self, audio, sr, text, lang):
        k = len(items_log)
        i0, i1, cs, ce = PLAN[k]
        src = [w for w in self.cur if A.clean_token(w['w'])]
        r = np.random.default_rng(500 + k)
        its = []
        for j, (w, sw) in enumerate(zip(text.split(), src)):
            if k % 2 == 1 and j % 17 == 3:
                continue                                    # מילה שנשמטה — המיפוי ב־difflib
            st = round(max(0.0, sw['s'] - cs + float(r.integers(-3, 4)) * 0.08 + (float(r.integers(-40, 40)) * 0.08 if j % 23 == 7 else 0.0)), 3)
            its.append((w if j % 29 != 11 else w + 'x', st, round(st + float(r.integers(1, 6)) * 0.08, 3)))
        items_log.append(its)
        return its
class FakeAligner(A.Aligner):
    def __init__(self, *a, **k):
        self.onnx = FakeOnnx(); self.engine = 'onnx-fake'
    def align_chunk(self, audio, sr, words):
        self.onnx.cur = words
        return super().align_chunk(audio, sr, words)
A.Aligner = FakeAligner
inw = json.loads(json.dumps(words))
aw, st = A.align_words(json.loads(json.dumps(words)), str(Path(wavd) / 'z.wav'))
fx['align'] = {'words': inw, 'total': total, 'plan': [list(c) for c in A.plan_chunks(inw, audio_len=total)], 'items': items_log,
               'out': [{k: w.get(k) for k in ('w', 's', 'e', 's_asr', 'e_asr', 'align')} for w in aw],
               'stats': {k: st[k] for k in ('chunks', 'aligned', 'kept_approx', 'suspicious')}}

# --- זיהוי דוברים: יחידות, אשכול, שיוך (טביעות סינתטיות) ---
dw = []
t = 0.3
for i in range(150):
    t += float(rng.choice([0.04, 0.1, 0.3, 0.6, 1.5], p=[.35, .3, .2, .1, .05]))
    w = ['so', 'we', 'went', 'there.', 'yes?', 'right!', 'and', 'then'][int(rng.integers(0, 8))]
    dw.append({'w': w, 's': round(t, 3), 'e': round(t + 0.15 + float(rng.random()) * 0.4, 3)})
    t = dw[-1]['e']
us = D.units(dw)
base = rng.standard_normal((4, 64))           # 64 ממדים (במודל 256) — הקוד לא תלוי בממד, והקובץ קטן
who = rng.choice(4, len(us), p=[.45, .35, .17, .03])
E = base[who] + 0.85 * rng.standard_normal((len(us), 64))
E = np.round(E / np.linalg.norm(E, axis=1, keepdims=True), 4).astype(np.float32)   # 4 ספרות — קובץ קטן, אותם ערכים בשני הצדדים
class Fixed:
    def many(self, xs):
        return E
w2 = json.loads(json.dumps(dw))
st = D.assign(w2, np.zeros(int((dw[-1]['e'] + 1) * 16000), dtype=np.float32), Fixed())
ce = (E[:40] + 0.0).astype(np.float32)
f9 = lambda a: [[float(f'{v:.9g}') for v in r] for r in a]
fx['diar'] = {'words': dw, 'units': [list(u) for u in us], 'E': f9(E), 'spk': [w.get('spk') for w in w2],
              'stats': {'speakers': st['speakers'], 'units': st['units'], 'talk': st['talk_s']},
              'cluster': {'E': f9(ce), 'lab': D.cluster(ce).tolist(), 'lab5': D.cluster(ce, 0.5).tolist()}}

# --- קובץ המילים לשרתון: מה שהטלפון בונה עובר את pw_check ---
import job
sample = {'v': 1, 'engine': 'parakeet', 'aligner': 'qwen3-onnx-int8',
          'words': [{k: v for k, v in w.items() if k in ('w', 's', 'e', 'align') and v is not None} | ({'spk': s} if s else {})
                    for w, s in zip(aw[:50], (fx['diar']['spk'] + [None] * 50)[:50])],
          'diarize': {'speakers': st['speakers'], 'units': st['units'], 'seconds': 1.5}}
assert job.pw_check(sample, total) is not None
fx['pw'] = sample

OUT.mkdir(parents=True, exist_ok=True)
(OUT / 'fixtures.json').write_text(json.dumps(fx, ensure_ascii=False), encoding='utf-8')
print('ok', {k: len(json.dumps(v)) for k, v in fx.items()})
