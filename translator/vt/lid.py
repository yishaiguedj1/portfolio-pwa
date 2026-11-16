"""16/11/2026 — ציר השפות המדוברות: איזו שפה מדברים בכל רגע בסרטון (בקשת המשתמש; docs/studio-lang-research.md).

המודל: ECAPA-TDNN שאומן על VoxLingua107 (‏speechbrain/lang-id-voxlingua107-ecapa, ‏Apache-2.0; 107 שפות). במדידה שלנו
(סעיף 4 במסמך) הוא היחיד שמבדיל עברית מאנגלית בחלון של 1.5–3 שנ׳ בלי טעויות — whisper-small/base/tiny טועים בשליש
מהחלונות הקצרים. **מימוש torch טהור** של אותה רשת (בלי speechbrain בתמונה: בלי hyperpyyaml שמריץ קוד מתוך YAML,
ובלי עוד עשר חבילות) — המשקולות נטענות ב־weights_only, ‏tests/test_lid.py משווה את הפלט לספרייה המקורית.

השלבים (timeline):
  1. דיבור — Silero (‏vt/asr_he.vad, הקטעים עד 14 שנ׳); מוזיקה ושקט לא נכנסים.
  2. חלונות — קטע קצר הוא חלון אחד; ארוך — חלונות של WIN שנ׳ בצעד HOP (חפיפה של חצי).
  3. ECAPA על כל חלון → log-הסתברות ל־107 השפות; שפה "גונבת" מתקפלת לשפה שהיא בעצם (FOLD: בלארוסית → רוסית).
  4. השפות המועמדות: עברית, אנגלית והשפה שנבחרה — ועוד שפה רק כשחלונות רבים מזהים אותה בביטחון (EXTRA_*).
  5. Viterbi על רצף החלונות: מעבר שפה עולה SWITCH (פחות בהפסקה ארוכה) — כך חלון בודד שגוי לא "מחליף שפה".
  6. אזורים — רצף חלונות באותה שפה, בגבולות הדיבור; לכל אזור הביטחון הממוצע.
הפלט: {"regions": [{s, e, lg, p}], "share": {lg: חלק מזמן הדיבור}, "main", "cands", "n", "s"}.
"""

from __future__ import annotations

import math
import os
import time
from pathlib import Path

ECAPA_DIR = os.environ.get("SNB_LID_ECAPA") or "/opt/lid/ecapa"
FILES = ("embedding_model.ckpt", "classifier.ckpt", "label_encoder.txt")
SR = 16000

WIN = 3.0               # חלון: 3 שנ׳ (המדידה: 1.0 בעברית/אנגלית מ־1.5 שנ׳, יציב יותר ב־3)
HOP = 1.5
MIN_WIN = 0.6           # דיבור קצר מזה — לא נשפט (שם, "אה") — מקבל את השפה של השכנים
ONE_MAX = 4.5           # קטע דיבור עד 4.5 שנ׳ — חלון אחד
BATCH = 16
BASE = ("he", "en")     # תמיד מועמדות (הקהל בישראל)
TEMP = 1.0              # כיול ה־log-הסתברות (מכויל על סט הכיול, סעיף 4 במסמך)
SWITCH = 6.0            # עלות מעבר שפה בין חלונות סמוכים (ביחידות log)
GAP_S = 1.5             # הפסקה ארוכה מזה — מעבר זול יותר (חילופי דוברים, שקף חדש)
GAP_SWITCH = 2.0
EXTRA_P = 0.7           # שפה נוספת: חלון שבו היא הראשונה בביטחון ≥ 0.7...
EXTRA_SHARE = 0.05      # ...בלפחות 5% מזמן הדיבור...
EXTRA_MIN_S = 6.0       # ...ובלפחות 6 שנ׳
EXTRA_MAX = 3
MAX_S = 4 * 3600        # מעל 4 שעות דיבור — לא מנתחים (הגבלת זמן)

# קודי VoxLingua107 שונים מ־ISO 639-1 של שאר המערכת
CODE = {"iw": "he", "jw": "jv"}
# שפה "גונבת" → השפה שהיא בעצם: ב־VoxLingua107 הקטגוריה הבלארוסית מלאה ברוסית — במדידה (FLEURS ru, חלונות של 3 שנ׳)
# 52% מהרוסית סווגו כבלארוסית ו־41% כרוסית. ההסתברות שלה מתווספת לרוסית, והיא עצמה לא מועמדת.
FOLD = {"be": "ru"}


def ready(path: str | None = None) -> bool:
    p = Path(path or ECAPA_DIR)
    return all((p / f).is_file() for f in FILES)


def _threads() -> int:
    try:
        n = len(os.sched_getaffinity(0))
    except (AttributeError, OSError):
        n = os.cpu_count() or 4
    return max(1, min(8, n))


def labels(path: str | None = None) -> list[str]:
    """label_encoder.txt של speechbrain: "'iw: Hebrew' => 44" → רשימת קודים לפי האינדקס (iw → he)."""
    out: dict[int, str] = {}
    for ln in (Path(path or ECAPA_DIR) / "label_encoder.txt").read_text(encoding="utf-8").splitlines():
        if "=>" not in ln or ":" not in ln:
            continue
        k, v = ln.rsplit("=>", 1)
        code = k.strip().strip("'\"").split(":")[0].strip()
        try:
            out[int(v.strip())] = CODE.get(code, code)
        except ValueError:
            continue
    return [out[i] for i in range(len(out))]


# ---------------------------------------------------------------- הרשת (torch טהור, אותם שמות כמו ב־speechbrain)

def _net():
    """המחלקות נבנות רק כשצריך — import של torch כבד, והבדיקות הטהורות לא צריכות אותו."""
    import torch
    import torch.nn as nn
    import torch.nn.functional as F

    class Conv(nn.Module):              # speechbrain Conv1d: ריפוד "same" במצב reflect
        def __init__(self, cin, cout, k=1, d=1):
            super().__init__()
            self.conv = nn.Conv1d(cin, cout, k, dilation=d)
            self.pad = d * (k - 1) // 2

        def forward(self, x):
            return self.conv(F.pad(x, (self.pad, self.pad), mode="reflect") if self.pad else x)

    class BN(nn.Module):
        def __init__(self, n):
            super().__init__()
            self.norm = nn.BatchNorm1d(n)

        def forward(self, x):
            return self.norm(x)

    class TDNN(nn.Module):
        def __init__(self, cin, cout, k, d):
            super().__init__()
            self.conv = Conv(cin, cout, k, d)
            self.norm = BN(cout)

        def forward(self, x):
            return self.norm(F.relu(self.conv(x)))

    class Res2Net(nn.Module):
        def __init__(self, c, k, d, scale=8):
            super().__init__()
            self.blocks = nn.ModuleList([TDNN(c // scale, c // scale, k, d) for _ in range(scale - 1)])
            self.scale = scale

        def forward(self, x):
            ys, y = [], None
            for i, xi in enumerate(torch.chunk(x, self.scale, dim=1)):
                y = xi if i == 0 else self.blocks[i - 1](xi if i == 1 else xi + y)
                ys.append(y)
            return torch.cat(ys, dim=1)

    class SE(nn.Module):
        def __init__(self, c, se=128):
            super().__init__()
            self.conv1 = Conv(c, se)
            self.conv2 = Conv(se, c)

        def forward(self, x):
            s = torch.sigmoid(self.conv2(F.relu(self.conv1(x.mean(dim=2, keepdim=True)))))
            return s * x

    class SERes2(nn.Module):
        def __init__(self, c, k, d):
            super().__init__()
            self.tdnn1 = TDNN(c, c, 1, 1)
            self.res2net_block = Res2Net(c, k, d)
            self.tdnn2 = TDNN(c, c, 1, 1)
            self.se_block = SE(c)

        def forward(self, x):
            return self.se_block(self.tdnn2(self.res2net_block(self.tdnn1(x)))) + x

    class ASP(nn.Module):               # Attentive Statistics Pooling עם הקשר גלובלי
        def __init__(self, c, att=128):
            super().__init__()
            self.tdnn = TDNN(c * 3, att, 1, 1)
            self.conv = Conv(att, c)

        def forward(self, x):
            n = x.shape[-1]
            mean = x.mean(dim=2)
            std = torch.sqrt(((x - mean.unsqueeze(2)) ** 2).mean(dim=2).clamp(1e-12))
            a = torch.cat([x, mean.unsqueeze(2).expand(-1, -1, n), std.unsqueeze(2).expand(-1, -1, n)], dim=1)
            w = F.softmax(self.conv(torch.tanh(self.tdnn(a))), dim=2)
            mu = (w * x).sum(dim=2)
            sg = torch.sqrt((w * (x - mu.unsqueeze(2)) ** 2).sum(dim=2).clamp(1e-12))
            return torch.cat([mu, sg], dim=1).unsqueeze(2)

    class Ecapa(nn.Module):
        def __init__(self, n_mels=60, c=1024, cl=3072, lin=256):
            super().__init__()
            self.blocks = nn.ModuleList([TDNN(n_mels, c, 5, 1)] + [SERes2(c, 3, d) for d in (2, 3, 4)])
            self.mfa = TDNN(c * 3, cl, 1, 1)
            self.asp = ASP(cl)
            self.asp_bn = BN(cl * 2)
            self.fc = Conv(cl * 2, lin)

        def forward(self, x):            # x: [N, זמן, n_mels]
            x = x.transpose(1, 2)
            xl = []
            for b in self.blocks:
                x = b(x)
                xl.append(x)
            x = self.mfa(torch.cat(xl[1:], dim=1))
            return self.fc(self.asp_bn(self.asp(x))).squeeze(2)     # [N, 256]

    class Lin(nn.Module):
        def __init__(self, a, b):
            super().__init__()
            self.w = nn.Linear(a, b)

        def forward(self, x):
            return self.w(x)

    class Block(nn.Module):
        def __init__(self, a, b):
            super().__init__()
            self.linear = Lin(a, b)
            self.norm = BN(b)

        def forward(self, x):
            return self.norm(F.leaky_relu(self.linear(x)))

    class Head(nn.Module):              # speechbrain Xvector.Classifier: LeakyReLU → BN → Linear → LeakyReLU → BN → Linear
        def __init__(self, a=256, h=512, n=107):
            super().__init__()
            self.norm = BN(a)
            self.DNN = nn.Module()
            self.DNN.block_0 = Block(a, h)
            self.out = Lin(h, n)

        def forward(self, x):
            return F.log_softmax(self.out(self.DNN.block_0(self.norm(F.leaky_relu(x)))), dim=-1)

    return torch, Ecapa, Head


def fbank_matrix(n_mels: int = 60, n_fft: int = 400, sr: int = SR):
    """מסנני mel משולשים — הנוסחה של speechbrain (Filterbank, triangular) → [n_fft/2+1, n_mels]."""
    import torch
    to_mel = lambda hz: 2595 * math.log10(1 + hz / 700)   # noqa: E731
    mel = torch.linspace(to_mel(0), to_mel(sr // 2), n_mels + 2)
    hz = 700 * (10 ** (mel / 2595) - 1)
    band = (hz[1:] - hz[:-1])[:-1]
    fc = hz[1:-1]
    freqs = torch.linspace(0, sr // 2, n_fft // 2 + 1).repeat(n_mels, 1)
    slope = (freqs - fc.repeat(freqs.shape[1], 1).T) / band.repeat(freqs.shape[1], 1).T
    return torch.clamp(torch.minimum(slope + 1.0, -slope + 1.0), min=0).T


class Model:
    """ECAPA + המסווג. logp(קטעי שמע) → מערך numpy ‏[N, 107] של log-הסתברות. אותם קודים כמו labels()."""

    def __init__(self, path: str | None = None, threads: int | None = None):
        torch, Ecapa, Head = _net()
        self.torch = torch
        torch.set_num_threads(threads or _threads())
        p = Path(path or ECAPA_DIR)
        self.codes = labels(str(p))
        self.emb, self.head = Ecapa(), Head(n=len(self.codes))
        for m, f in ((self.emb, "embedding_model.ckpt"), (self.head, "classifier.ckpt")):
            sd = torch.load(p / f, map_location="cpu", weights_only=True)
            m.load_state_dict(sd, strict=True)
            m.eval()
        self.window = torch.hamming_window(400)
        self.fb = fbank_matrix()

    def feats(self, x):
        """[N, דגימות] → [N, זמן, 60]: STFT (‏25ms/10ms, ‏Hamming, ממורכז) → הספק → mel → dB (רצפה של 80dB מהשיא)
        → הורדת הממוצע של כל ערוץ (נרמול "משפט", בלי סטיית תקן) — כמו compute_features + mean_var_norm."""
        t = self.torch
        st = t.stft(x, 400, 160, 400, self.window, center=True, pad_mode="constant", normalized=False,
                    onesided=True, return_complex=True)
        p = (st.real ** 2 + st.imag ** 2).transpose(1, 2)
        db = 10 * t.log10(t.clamp(p @ self.fb, min=1e-10))
        db = t.maximum(db, db.amax(dim=(1, 2), keepdim=True) - 80.0)
        return db - db.mean(dim=1, keepdim=True)

    def logp(self, clips: list) -> "object":
        """קטעי שמע (numpy float32, ‏16kHz) → log-הסתברות [N, 107]. קטעים באותו אורך רצים יחד (BATCH)."""
        import numpy as np
        t = self.torch
        out = np.zeros((len(clips), len(self.codes)), dtype="float32")
        by: dict[int, list[int]] = {}
        for i, c in enumerate(clips):
            by.setdefault(len(c), []).append(i)
        with t.inference_mode():
            for n, idx in by.items():
                for k in range(0, len(idx), BATCH):
                    part = idx[k:k + BATCH]
                    x = t.from_numpy(np.stack([np.asarray(clips[i], dtype="float32") for i in part]))
                    out[part] = self.head(self.emb(self.feats(x))).numpy()
        return out


# ---------------------------------------------------------------- הציר (פונקציות טהורות — נבדקות בלי מודל)

def windows(spans: list, win: float = WIN, hop: float = HOP, one_max: float = ONE_MAX, min_win: float = MIN_WIN) -> list[tuple]:
    """קטעי דיבור → חלונות [(התחלה, סוף, מספר הקטע)]. קטע עד one_max — חלון אחד; ארוך — חלונות של win בצעד hop,
    והאחרון צמוד לסוף. קטע קצר מ־min_win — בלי חלון."""
    out = []
    for k, (s, e) in enumerate(spans):
        s, e = float(s), float(e)
        d = e - s
        if d < min_win:
            continue
        if d <= one_max:
            out.append((round(s, 3), round(e, 3), k))
            continue
        n = max(1, math.ceil((d - win) / hop)) + 1
        step = (d - win) / (n - 1)
        for i in range(n):
            a = s + i * step
            out.append((round(a, 3), round(a + win, 3), k))
    return out


def choose(lp, codes: list[str], wins: list, base=BASE, extra_p: float = EXTRA_P, extra_share: float = EXTRA_SHARE,
           extra_min_s: float = EXTRA_MIN_S, extra_max: int = EXTRA_MAX) -> list[str]:
    """השפות המועמדות: base (שקיימות במודל), ועוד שפה שהיא הראשונה בביטחון ≥ extra_p בחלונות שסכום האורך שלהם
    ≥ extra_min_s שנ׳ ו־≥ extra_share מזמן הדיבור (לפי חלונות; חלון חופף נספר לפי אורכו — קירוב)."""
    import numpy as np
    cand = [c for c in base if c in codes]
    if not len(wins):
        return cand
    tot = sum(e - s for s, e, _ in wins) or 1.0
    top = np.argmax(lp, axis=1)
    pr = np.exp(lp[np.arange(len(wins)), top])
    acc: dict[str, float] = {}
    for (s, e, _), j, p in zip(wins, top, pr):
        c = codes[j]
        if p >= extra_p and c not in cand:
            acc[c] = acc.get(c, 0.0) + (e - s)
    extra = [c for c, v in sorted(acc.items(), key=lambda kv: -kv[1]) if v >= extra_min_s and v / tot >= extra_share]
    return cand + extra[:extra_max]


def fold(lp, codes: list[str], fold_map: dict | None = None):
    """FOLD: ההסתברות של שפה "גונבת" מתווספת לשפה שהיא בעצם (logaddexp), והעמודה שלה נמחקת (‎-inf). עותק — המקור לא משתנה."""
    import numpy as np
    out = np.array(lp, dtype="float64", copy=True)
    for a, b in (FOLD if fold_map is None else fold_map).items():
        if a in codes and b in codes and len(out):
            i, j = codes.index(a), codes.index(b)
            out[:, j] = np.logaddexp(out[:, j], out[:, i])
            out[:, i] = -np.inf
    return out


def restrict(lp, codes: list[str], cand: list[str], temp: float = TEMP):
    """log-הסתברות רק על המועמדות, מנורמל מחדש (עם טמפרטורה) → [N, len(cand)]."""
    import numpy as np
    idx = [codes.index(c) for c in cand]
    x = lp[:, idx] * temp
    x = x - x.max(axis=1, keepdims=True)
    return x - np.log(np.exp(x).sum(axis=1, keepdims=True))


def viterbi(em, wins: list, switch: float = SWITCH, gap_s: float = GAP_S, gap_switch: float = GAP_SWITCH,
            prior=None) -> list[int]:
    """הרצף הסביר ביותר של שפות על החלונות (em = log-הסתברות [N, K]). מעבר בין חלונות עולה switch, ואחרי הפסקה
    ארוכה (בין סוף חלון להתחלת הבא ≥ gap_s) — gap_switch. prior = log-הסתברות התחלתית לכל שפה (אופציונלי)."""
    import numpy as np
    n, k = em.shape if len(em) else (0, 0)
    if not n:
        return []
    score = em[0] + (prior if prior is not None else 0)
    back = np.zeros((n, k), dtype=int)
    for i in range(1, n):
        gap = wins[i][0] - wins[i - 1][1]
        cost = gap_switch if gap >= gap_s else switch
        trans = score[:, None] - cost * (1 - np.eye(k))
        back[i] = np.argmax(trans, axis=0)
        score = trans[back[i], np.arange(k)] + em[i]
    path = [int(np.argmax(score))]
    for i in range(n - 1, 0, -1):
        path.append(int(back[i][path[-1]]))
    return path[::-1]


def regions(wins: list, lab: list[str], prob: list[float], spans: list) -> list[dict]:
    """חלונות מתויגים → אזורים רציפים [{s, e, lg, p}] בגבולות קטעי הדיבור. כל נקודה שייכת לחלון שהמרכז שלו הכי קרוב;
    חלונות סמוכים באותה שפה מתאחדים (גם מעבר להפסקה), p = ממוצע הביטחון של החלונות לפי אורך."""
    if not wins:
        return []
    by: dict[int, list[int]] = {}
    for i, (_, _, k) in enumerate(wins):
        by.setdefault(k, []).append(i)
    parts = []                            # (התחלה, סוף, שפה, ביטחון, משקל)
    for k, idx in sorted(by.items()):
        s0, e0 = float(spans[k][0]), float(spans[k][1])
        cs = [(wins[i][0] + wins[i][1]) / 2 for i in idx]
        for j, i in enumerate(idx):
            a = s0 if j == 0 else (cs[j - 1] + cs[j]) / 2
            b = e0 if j == len(idx) - 1 else (cs[j] + cs[j + 1]) / 2
            parts.append([a, b, lab[i], prob[i], b - a])
    parts.sort(key=lambda x: x[0])
    out: list[dict] = []
    for a, b, lg, p, w in parts:
        if out and out[-1]["lg"] == lg:
            g = out[-1]
            g["_w"] += w
            g["_p"] += p * w
            g["e"] = b
        else:
            out.append({"s": a, "e": b, "lg": lg, "_p": p * w, "_w": w})
    return [{"s": round(g["s"], 2), "e": round(g["e"], 2), "lg": g["lg"], "p": round(g["_p"] / max(g["_w"], 1e-9), 2)}
            for g in out]


def share(regs: list[dict]) -> dict:
    """חלק כל שפה מזמן הדיבור (לפי האזורים), מהגדול לקטן."""
    acc: dict[str, float] = {}
    for g in regs:
        acc[g["lg"]] = acc.get(g["lg"], 0.0) + max(0.0, g["e"] - g["s"])
    tot = sum(acc.values())
    return {k: round(v / tot, 3) for k, v in sorted(acc.items(), key=lambda kv: -kv[1])} if tot else {}


def lang_at(regs: list[dict], t: float, default: str = "") -> str:
    """השפה ברגע t — האזור שמכיל אותו, אחרת הקרוב ביותר עד 1.5 שנ׳, אחרת default."""
    best, d0 = default, 1.5
    for g in regs:
        if g["s"] <= t <= g["e"]:
            return g["lg"]
        d = min(abs(t - g["s"]), abs(t - g["e"]))
        if d < d0:
            best, d0 = g["lg"], d
    return best


def timeline(audio, spans: list | None = None, prefer: str = "", model: Model | None = None, vad_fn=None) -> dict:
    """הציר המלא (ראו ראש הקובץ). prefer = השפה שהמשתמש בחר (מועמדת תמיד, ומקבלת יתרון קטן בהתחלה).
    spans = קטעי הדיבור אם כבר יש (אחרת Silero). מודל חסר / תקלה — זורק; הקוראים מטפלים."""
    import numpy as np
    t0 = time.time()
    if spans is None:
        if vad_fn is None:
            from .asr_he import vad as vad_fn
        spans = vad_fn(audio)
    spans = [(float(s), float(e)) for s, e in spans if e > s]
    if sum(e - s for s, e in spans) > MAX_S:
        raise ValueError("ארוך מדי לזיהוי שפה")
    wins = windows(spans)
    if not wins:
        return {"regions": [], "share": {}, "main": "", "cands": [], "n": 0, "s": round(time.time() - t0, 1)}
    m = model or Model()
    lp = fold(m.logp([audio[int(s * SR):int(e * SR)] for s, e, _ in wins]), m.codes)
    base = tuple(dict.fromkeys(BASE + ((prefer,) if prefer else ())))
    cand = choose(lp, m.codes, wins, base=base)
    em = restrict(lp, m.codes, cand)
    prior = np.array([math.log(0.6) if c == prefer else math.log(0.4 / max(1, len(cand) - 1)) for c in cand]) if prefer in cand else None
    path = viterbi(em, wins, prior=prior)
    lab = [cand[j] for j in path]
    prob = [float(np.exp(em[i, j])) for i, j in enumerate(path)]
    regs = regions(wins, lab, prob, spans)
    sh = share(regs)
    return {"regions": regs, "share": sh, "main": next(iter(sh), ""), "cands": cand, "n": len(wins),
            "s": round(time.time() - t0, 1)}
