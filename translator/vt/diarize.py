"""זיהוי דוברים מהקול (22/10/2026, ניתוח המאגר): ב־9 מתוך 10 עבודות כל המילים היו "S?" — Parakeet לא
מזהה דוברים, וההגהה (מודל שפה, בלי קול) לא יודעת מי מדבר. התוצאה: מגדר שגוי בתרגום ושאלות שנבלעות
בין דוברים. כאן: טביעת קול לכל קטע דיבור (WeSpeaker ResNet34-LM, ‏ONNX, ‏CC-BY-4.0) ואשכול לפי דמיון —
כל מילה מקבלת S1, ‏S2… לפני ההגהה, וההגהה נותנת שמות ומתקנת.

בלי torch ובלי scipy: fbank בסגנון Kaldi ב־numpy, ואשכול היררכי (average linkage, ‏NN-chain) ב־numpy.
כל תקלה (אין מודל, אין onnxruntime) = המצב הקודם, בלי דוברים.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import numpy as np

from .util import log

MODEL_NAME = "voxceleb_resnet34_LM.onnx"
MODEL_SHA256 = "7bb2f06e9df17cdf1ef14ee8a15ab08ed28e8d0ef5054ee135741560df2ec068"
SR = 16000
GAP_S = 0.25        # שקט שמפריד בין קטעים
WIN_S = 2.0         # קטע ארוך מחולק לחלונות באורך הזה (החלפת דובר באמצע משפט)
MIN_EMB_S = 1.0     # קטע קצר מזה — מוכפל עד האורך הזה לפני הטביעה
STRONG_S = 1.2      # רק קטעים באורך הזה ומעלה בונים את האשכולות
THRESH = 0.62       # מרחק קוסינוס לחיתוך העץ (נקבע על דוברים ידועים — ראו tests/test_diarize.py)
MIN_SPK_S = 4.0     # דובר עם פחות דיבור מזה מצורף לקרוב אליו


def model_path() -> Path | None:
    """המודל רק אם הוא בדיוק הקובץ שנבדק (sha256) — קובץ אחר = בלי זיהוי דוברים."""
    import hashlib
    for d in (os.environ.get("SNB_SPK_DIR"), "/opt/speaker", str(Path(__file__).resolve().parent.parent / "models")):
        p = Path(d) / MODEL_NAME if d else None
        if p and p.is_file():
            h = hashlib.sha256()
            with open(p, "rb") as f:
                for b in iter(lambda: f.read(1 << 20), b""):
                    h.update(b)
            if h.hexdigest() == MODEL_SHA256:
                return p
            log("זיהוי דוברים: המודל לא תואם את ה־sha256 — מדלגים")
    return None


# --- fbank בסגנון Kaldi (כמו torchaudio.compliance.kaldi.fbank: povey, ‏pre-emphasis 0.97, בלי dither) ---

def _mel_banks(n_mels: int = 80, n_fft: int = 512, lo: float = 20.0, hi: float = SR / 2) -> np.ndarray:
    mel = lambda f: 1127.0 * np.log(1.0 + f / 700.0)
    m_lo, m_hi = mel(lo), mel(hi)
    pts = np.linspace(m_lo, m_hi, n_mels + 2)
    freqs = np.arange(n_fft // 2) * SR / n_fft
    mf = mel(freqs)
    banks = np.zeros((n_mels, n_fft // 2 + 1), dtype=np.float32)
    for m in range(n_mels):
        l, c, r = pts[m], pts[m + 1], pts[m + 2]
        up = (mf - l) / (c - l)
        down = (r - mf) / (r - c)
        banks[m, :n_fft // 2] = np.maximum(0.0, np.minimum(up, down))
    return banks


_BANKS = None
_WIN = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(400) / 399)) ** 0.85


def fbank(x: np.ndarray) -> np.ndarray:
    global _BANKS
    if _BANKS is None:
        _BANKS = _mel_banks()
    x = x.astype(np.float64) * 32768.0
    if len(x) < 400:
        x = np.pad(x, (0, 400 - len(x)))
    n = 1 + (len(x) - 400) // 160
    idx = np.arange(400)[None, :] + 160 * np.arange(n)[:, None]
    fr = x[idx]
    fr = fr - fr.mean(axis=1, keepdims=True)
    fr = np.concatenate([fr[:, :1] - 0.97 * fr[:, :1], fr[:, 1:] - 0.97 * fr[:, :-1]], axis=1)
    fr = fr * _WIN
    spec = np.abs(np.fft.rfft(fr, n=512)) ** 2
    f = np.log(np.maximum(spec @ _BANKS.T.astype(np.float64), np.finfo(np.float32).eps))
    return (f - f.mean(axis=0, keepdims=True)).astype(np.float32)


class Embedder:
    def __init__(self, path: Path):
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.intra_op_num_threads = max(1, min(4, os.cpu_count() or 1))
        self.s = ort.InferenceSession(str(path), so, providers=["CPUExecutionProvider"])

    def __call__(self, x: np.ndarray) -> np.ndarray:
        if len(x) < MIN_EMB_S * SR:
            x = np.tile(x, int(np.ceil(MIN_EMB_S * SR / max(1, len(x)))))[:int(MIN_EMB_S * SR)]
        e = self.s.run(None, {"feats": fbank(x)[None]})[0][0]
        return e / (np.linalg.norm(e) + 1e-9)


# --- קטעים מהמילים ---

def units(words: list[dict]) -> list[tuple[int, int, int]]:
    """רצפי מילים (מתחילה, עד סוף לא כולל, מספר הרצף) — חתוכים בשקט ובסוף משפט, וקטע ארוך מחולק לחלונות."""
    runs, a = [], 0
    for i in range(1, len(words) + 1):
        end = i == len(words) or words[i]["s"] - words[i - 1]["e"] >= GAP_S \
            or (words[i - 1]["w"][-1:] in ".?!" and words[i]["s"] - words[i - 1]["e"] >= 0.08)
        if end:
            runs.append((a, i))
            a = i
    out = []
    for r, (a, b) in enumerate(runs):
        if words[b - 1]["e"] - words[a]["s"] <= WIN_S * 1.5:
            out.append((a, b, r))
            continue
        k = a
        for j in range(a + 1, b + 1):
            if j == b or words[j]["s"] - words[k]["s"] >= WIN_S:
                out.append((k, j, r))
                k = j
    return out


# --- אשכול היררכי average linkage (NN-chain, ‏O(n²)) ---

def cluster(emb: np.ndarray, thresh: float = THRESH) -> np.ndarray:
    n = len(emb)
    if n == 0:
        return np.zeros(0, dtype=int)
    if n == 1:
        return np.zeros(1, dtype=int)
    S = (emb @ emb.T).astype(np.float64)
    np.fill_diagonal(S, -np.inf)
    size = np.ones(n)
    alive = np.ones(n, dtype=bool)
    merges = []
    chain: list[int] = []
    left = n
    while left > 1:
        if not chain:
            chain.append(int(np.flatnonzero(alive)[0]))
        a = chain[-1]
        row = np.where(alive, S[a], -np.inf)
        row[a] = -np.inf
        b = int(np.argmax(row))
        if len(chain) > 1 and row[chain[-2]] >= row[b]:
            b = chain[-2]
        if len(chain) > 1 and b == chain[-2]:
            chain.pop()
            chain.pop()
            merges.append((a, b, 1.0 - S[a, b]))
            new = (size[a] * S[a] + size[b] * S[b]) / (size[a] + size[b])
            S[a, :] = new
            S[:, a] = new
            S[a, a] = -np.inf
            size[a] += size[b]
            alive[b] = False
            S[b, :] = -np.inf
            S[:, b] = -np.inf
            left -= 1
        else:
            chain.append(b)
    parent = list(range(n))

    def root(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for a, b, h in merges:
        if h <= thresh:
            parent[root(b)] = root(a)
    roots = [root(i) for i in range(n)]
    ids = {r: k for k, r in enumerate(dict.fromkeys(roots))}
    return np.array([ids[r] for r in roots])


def assign(words: list[dict], audio: np.ndarray, embed) -> dict:
    """ממלא w["spk"] = S1, ‏S2… בסדר ההופעה. מחזיר סטטיסטיקה."""
    us = units(words)
    if not us:
        return {"speakers": 0}
    dur = np.array([words[b - 1]["e"] - words[a]["s"] for a, b, _ in us])
    E = np.stack([embed(audio[int(words[a]["s"] * SR):max(int(words[a]["s"] * SR) + 160, int(words[b - 1]["e"] * SR))])
                  for a, b, _ in us])
    strong = np.flatnonzero(dur >= STRONG_S)
    if len(strong) < 2:
        strong = np.arange(len(us))
    lab = cluster(E[strong])
    k = int(lab.max()) + 1
    cent = np.stack([E[strong][lab == c].mean(axis=0) for c in range(k)])
    tot = np.array([dur[strong][lab == c].sum() for c in range(k)])
    keep = np.flatnonzero(tot >= MIN_SPK_S)
    if len(keep) == 0:
        keep = np.array([int(np.argmax(tot))])
    cent = cent[keep] / np.linalg.norm(cent[keep], axis=1, keepdims=True)
    sim = E @ cent.T
    who = sim.argmax(axis=1)
    # קטע קצר שהדמיון בו לא חד — כמו השכן (הנגשה קצרה "Yeah." באמצע דברי אותו דובר)
    for i in range(len(us)):
        if dur[i] < STRONG_S and len(cent) > 1:
            top = np.sort(sim[i])[::-1]
            if top[0] - top[1] < 0.08:
                nb = [who[j] for j in (i - 1, i + 1) if 0 <= j < len(us) and dur[j] >= STRONG_S]
                if nb and all(x == nb[0] for x in nb):
                    who[i] = nb[0]
    order = list(dict.fromkeys(int(x) for x in who))
    name = {c: f"S{n + 1}" for n, c in enumerate(order)}
    for (a, b, _), c in zip(us, who):
        for w in words[a:b]:
            w["spk"] = name[int(c)]
    talk = {}
    for (a, b, _), c, d in zip(us, who, dur):
        talk[name[int(c)]] = round(talk.get(name[int(c)], 0.0) + float(d), 1)
    return {"speakers": len(order), "units": len(us), "talk_s": talk}


def diarize(words: list[dict], wav_path: str) -> dict | None:
    """נקודת הכניסה מ־vt asr. רק כשאין דוברים מהמנוע. כל תקלה — None, והמילים בלי שינוי."""
    if os.environ.get("SNB_DIARIZE") == "off" or not words or any(w.get("spk") not in (None, "S?") for w in words):
        return None
    p = model_path()
    if p is None:
        log("זיהוי דוברים: אין מודל — מדלגים")
        return None
    try:
        import soundfile as sf
        t0 = time.time()
        audio, sr = sf.read(wav_path, dtype="float32")
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != SR:
            return None
        before = [w.get("spk") for w in words]
        try:
            st = assign(words, audio, Embedder(p))
        except Exception:
            for w, s in zip(words, before):
                w["spk"] = s
            raise
        st["seconds"] = round(time.time() - t0, 1)
        log(f"זיהוי דוברים: {st['speakers']} דוברים ({st['units']} קטעים, {st['seconds']} שנ׳)")
        return st
    except Exception as e:                       # noqa: BLE001 — זיהוי דוברים לעולם לא מפיל תמלול
        log(f"זיהוי דוברים נכשל ({type(e).__name__}) — ממשיכים בלי")
        return None
