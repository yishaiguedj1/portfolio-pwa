"""16/11/2026 — ציר השפות המדוברות: איזו שפה מדברים בכל רגע בסרטון (בקשת המשתמש; docs/studio-lang-research.md).

המודל: ECAPA-TDNN שאומן על VoxLingua107 (‏speechbrain/lang-id-voxlingua107-ecapa, ‏Apache-2.0; 107 שפות). במדידה שלנו
(סעיף 4 במסמך) הוא היחיד שמבדיל עברית מאנגלית בחלון של 1.5–3 שנ׳ בלי טעויות — whisper-small/base/tiny טועים בשליש
מהחלונות הקצרים. **מימוש torch טהור** של אותה רשת (בלי speechbrain בתמונה: בלי hyperpyyaml שמריץ קוד מתוך YAML,
ובלי עוד עשר חבילות) — המשקולות נטענות ב־weights_only, ‏tests/test_lid.py משווה את הפלט לספרייה המקורית.

השלבים (timeline):
  1. דיבור — Silero (‏vt/asr_he.vad, הקטעים עד 14 שנ׳); מוזיקה ושקט לא נכנסים.
  2. חלונות — קטע קצר הוא חלון אחד; ארוך — חלונות של WIN שנ׳ בצעד HOP (חפיפה של חצי).
  3. ECAPA על כל חלון → log-הסתברות ל־107 השפות; שפה "גונבת" מתקפלת לשפה שהיא בעצם (FOLD: בלארוסית → רוסית).
  4. השפות המועמדות: עברית, אנגלית והשפה שנבחרה — ועוד שפה רק כשרצף של חלונות מזהה אותה בביטחון (EXTRA_*),
     ו־whisper-small מאשר אותה ברצף הזה (confirm; ב־VoxLingua107 "וולשית" מלאה באנגלית).
  5. Viterbi על רצף החלונות: מעבר שפה עולה SWITCH (פחות בהפסקה ארוכה) — כך חלון בודד שגוי לא "מחליף שפה".
  6. אזורים — רצף חלונות באותה שפה, בגבולות הדיבור; לכל אזור הביטחון הממוצע.
  7. אימות ב־whisper-small (verify): אזור בשפת מיעוט שבו ECAPA לא בטוח (VERIFY_*), ורצף שבו ECAPA "הלך לאיבוד" —
     רוב ההסתברות שלו על שפות שאינן מועמדות, כמו במבטא כבד (LOW_*; רק עברית מול אנגלית). ההחלטה — שני המודלים יחד.
הפלט: {"regions": [{s, e, lg, p, v?}], "share": {lg: חלק מזמן הדיבור}, "main", "cands", "n", "vf", "s"}.
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
EXTRA_P = 0.7           # שפה נוספת: חלונות שבהם היא הראשונה בביטחון ≥ 0.7...
EXTRA_MIN_S = 6.0       # ...שמסתכמים בלפחות 6 שנ׳...
EXTRA_RUN = 3           # ...וביניהם רצף של 3 חלונות עוקבים. טעות אקראית לא יוצרת רצף: במדידה (70 סרטונים) לשפות שגויות
                        # היה רצף של 2 לכל היותר, ולאמיתיות 3 ומעלה. אחוז מהסרטון (היה 5%) פסל שפה אמיתית בסרטון ארוך
EXTRA_MAX = 5           # תקרה בלבד — הסינון האמיתי הוא הרצף. ב־3 נפלה רוסית אמיתית (12.7 שנ׳, ECAPA 0.95–0.997) בסרטון
                        # עם 4 שפות נוספות, וסומנה "צרפתית"; 4 ומעלה — אותן תוצאות בשני הסטים, ושום שפה מיותרת לא נוספה
MAX_S = 4 * 3600        # מעל 4 שעות דיבור — לא מנתחים (הגבלת זמן)
VERIFY_P = 0.995        # אזור בשפת מיעוט שבו ECAPA בטוח פחות מזה — נבדק שוב ב־whisper-small (מפל: ECAPA הזול על הכל,
                        # whisper רק בחשודים — במדידה 26 מתוך 160 אזורי מיעוט, פחות מאחד לסרטון; whisper הסכים בכולם). ההחלטה — סכום שניהם
VERIFY_MIN_S = 2.0      # אזור קצר מזה לא נבדק: whisper לא אמין בחלון קצר (35% ב־1.5 שנ׳ בעברית)
VERIFY_CLIP_S = 30.0    # whisper שומע עד 30 שנ׳ — מאמצע האזור
VERIFY_MAX = 40         # עד כמה אזורים לסרטון (הפחות בטוחים קודם)
LOW_COV = 0.5           # כיסוי המועמדות בחלון — כמה מההסתברות של ECAPA נופלת על השפות המועמדות. מתחת לזה ההכרעה ביניהן
                        # היא הטלת מטבע: במבטא ערבי כבד ECAPA אמר "מקדונית", "ליטאית", "אלבנית" — ואנגלית/עברית קיבלו 0.01
LOW_MIN_S = 4.0         # רצף כזה (חלון טוב בודד לא שובר) של 4 שנ׳ ו־3 חלונות לפחות, ש־75% מהם באותה שפה (רצף שחוצה
LOW_RUN = 3             # גבול — whisper שומע תערובת ומכריע לא נכון; כך נפסלה במדידה החלפה שגויה של 7 שנ׳ עברית)
LOW_PURE = 0.75
LOW_W = 0.2             # whisper צריך לתת לעברית+אנגלית יחד לפחות 0.2. ההכרעה — רק עברית מול אנגלית: whisper-small מבלבל
                        # עברית⇄ערבית בקטעים כאלה (3 החלפות שגויות במדידה, כשהותרו כל המועמדות)
LOW_MAX = 40
CONFIRM_P = 0.2         # שפה נוספת נשארת מועמדת אם whisper נותן לה ≥ 0.2 ברצף החזק שלה, או יותר מלכל שפת בסיס

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


def choose(lp, codes: list[str], wins: list, base=BASE, extra_p: float = EXTRA_P, extra_min_s: float = EXTRA_MIN_S,
           extra_run: int = EXTRA_RUN, extra_max: int = EXTRA_MAX) -> list[str]:
    """השפות המועמדות: base (שקיימות במודל), ועוד שפה שהיא הראשונה בביטחון ≥ extra_p בחלונות שסכום האורך שלהם
    ≥ extra_min_s שנ׳ (חלון חופף נספר לפי אורכו — קירוב), וביניהם רצף של extra_run חלונות עוקבים."""
    import numpy as np
    cand = [c for c in base if c in codes]
    if not len(wins):
        return cand
    top = np.argmax(lp, axis=1)
    pr = np.exp(lp[np.arange(len(wins)), top])
    acc: dict[str, float] = {}
    run: dict[str, int] = {}
    cur, n = None, 0
    for (s, e, _), j, p in zip(wins, top, pr):
        c = codes[j]
        if p >= extra_p and c not in cand:
            acc[c] = acc.get(c, 0.0) + (e - s)
            n = n + 1 if c == cur else 1
            cur = c
            run[c] = max(run.get(c, 0), n)
        else:
            cur, n = None, 0
    extra = [c for c, v in sorted(acc.items(), key=lambda kv: -kv[1]) if v >= extra_min_s and run.get(c, 0) >= extra_run]
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


def coverage(lp, codes: list[str], cand: list[str]):
    """לכל חלון: כמה מההסתברות של ECAPA (אחרי fold) נופלת על השפות המועמדות. נמוך — ההכרעה ביניהן לא אמינה."""
    import numpy as np
    if not len(lp):
        return np.zeros(0)
    return np.exp(np.asarray(lp)[:, [codes.index(c) for c in cand]]).sum(axis=1)


def _clip(audio, s: float, e: float, clip_s: float = VERIFY_CLIP_S):
    if e - s > clip_s:
        mid = (s + e) / 2
        s, e = mid - clip_s / 2, mid + clip_s / 2
    return audio[max(0, int(s * SR)):int(e * SR)]


def confirm(cand: list[str], base, lp, codes: list[str], wins: list, audio, probs_fn, extra_p: float = EXTRA_P,
            min_p: float = CONFIRM_P) -> tuple[list[str], dict]:
    """שפה נוספת (לא מ־base) נשארת מועמדת רק אם whisper-small מאשר אותה ברצף החזק שלה (חלונות עוקבים שבהם היא
    הראשונה ב־extra_p; הפסקה של עד 2 שנ׳ לא שוברת): ≥ min_p — נשארת; whisper אומר שפה אחרת שאינה בסיס (≥ 0.5) — היא
    נכנסת במקומה; אחרת נשארת רק אם whisper לא מעדיף עליה שפת בסיס. בלי probs_fn / תקלה — כמו קודם.
    → (מועמדות, {chk, drop, swap})."""
    import numpy as np
    st = {"chk": 0, "drop": 0, "swap": 0}
    base = [c for c in cand if c in base]
    extra = [c for c in cand if c not in base]
    if not extra or probs_fn is None or not len(wins):
        return cand, st
    pr = np.exp(np.asarray(lp))
    top = pr.argmax(axis=1)
    keep = list(base)
    for c in extra:
        ci = codes.index(c)
        best: list[int] = []
        cur: list[int] = []
        for i, w in enumerate(wins):
            ok = top[i] == ci and pr[i, ci] >= extra_p
            if ok and (not cur or w[2] == wins[cur[-1]][2] or w[0] - wins[cur[-1]][1] < 2.0):
                cur.append(i)
            else:
                best = cur if len(cur) > len(best) else best
                cur = [i] if ok else []
        best = cur if len(cur) > len(best) else best
        if not best:
            keep.append(c)
            continue
        try:
            wp = probs_fn(_clip(audio, wins[best[0]][0], wins[best[-1]][1])) or {}
        except Exception:                        # noqa: BLE001 — בלי אישור, כמו קודם
            keep.append(c)
            continue
        st["chk"] += 1
        g = lambda k: float(wp.get(k, 0.0) or 0.0)
        wt = max(wp, key=g) if wp else ""
        if g(c) >= min_p:
            keep.append(c)
        elif wt and wt != c and wt not in base and wt not in cand and wt not in keep and wt in codes and g(wt) >= 0.5:
            keep.append(wt)
            st["swap"] += 1
        elif g(c) >= max([g(b) for b in base] or [0.0]):
            keep.append(c)
        else:
            st["drop"] += 1
    return keep, st


def low_chunks(cov, wins: list, th: float = LOW_COV, min_s: float = LOW_MIN_S, max_s: float = VERIFY_CLIP_S) -> list[list[int]]:
    """רצפים של חלונות בכיסוי נמוך (חלון טוב אחד באמצע לא שובר), מפוצלים לחתיכות של עד max_s → [[אינדקסים]]."""
    runs: list[list[int]] = []
    cur: list[int] = []
    good = 0
    for i, c in enumerate(cov):
        if c < th:
            cur.append(i)
            good = 0
        elif cur:
            good += 1
            if good > 1:
                runs.append(cur)
                cur, good = [], 0
    if cur:
        runs.append(cur)
    out: list[list[int]] = []
    for r in runs:
        if wins[r[-1]][1] - wins[r[0]][0] < min_s:
            continue
        parts: list[list[int]] = []
        ch: list[int] = []
        for i in r:
            if ch and wins[i][1] - wins[ch[0]][0] > max_s:
                parts.append(ch)
                ch = []
            ch.append(i)
        if parts and (wins[ch[-1]][1] - wins[ch[0]][0] < min_s or len(ch) < LOW_RUN):
            parts[-1] += ch                      # זנב קצר — מצטרף לחתיכה הקודמת של אותו רצף
        else:
            parts.append(ch)
        out += parts
    return out


def verify(regs: list[dict], lab: list[str], prob: list[float], wins: list, em, cand: list[str], audio, main: str, probs_fn,
           cov=None, min_p: float = VERIFY_P, min_s: float = VERIFY_MIN_S, cap: int = VERIFY_MAX, low_cap: int = LOW_MAX):
    """אימות ב־whisper-small (probs_fn(קטע) → {שפה: הסתברות}) — כל מודל חזק במקום שהשני חלש: ECAPA מדויק בחלון קצר,
    whisper שומע קטע שלם ועמיד יותר למבטא. שני סוגים:
      - "מיעוט": אזור שאינו בשפה הראשית, ECAPA בטוח בו פחות מ־min_p, ואורכו ≥ min_s — הכרעה בין כל המועמדות.
      - "כיסוי": רצף שבו ECAPA "הלך לאיבוד" (low_chunks), ו־75% ממנו בעברית או באנגלית — הכרעה רק ביניהן.
    ההכרעה: ממוצע ה־log-הסתברות של ECAPA בחלונות + ה־log-הסתברות של whisper. → (lab, prob, {n, flip, nlow, fliplow},
    החלונות ששונו). תקלה ב־probs_fn — בלי שינוי, כמו קודם."""
    import numpy as np
    st = {"n": 0, "flip": 0, "nlow": 0, "fliplow": 0}
    lab, prob = list(lab), list(prob)
    flipped: set = set()
    if not len(wins) or probs_fn is None:
        return lab, prob, st, flipped
    em = np.asarray(em)
    cs = [(a + b) / 2 for a, b, _ in wins]
    jobs = []
    sus = sorted([g for g in regs if g["lg"] != main and g["p"] < min_p and g["e"] - g["s"] >= min_s], key=lambda g: g["p"])
    for g in sus[:cap]:
        idx = [k for k, c in enumerate(cs) if g["s"] <= c <= g["e"]]
        if idx:
            jobs.append(("min", idx, g["s"], g["e"]))
    if cov is not None and "he" in cand and "en" in cand:
        hi = [cand.index("he"), cand.index("en")]
        low = []
        for idx in low_chunks(cov, wins):
            top = max(set(lab[i] for i in idx), key=lambda c: sum(lab[i] == c for i in idx))
            if top in ("he", "en") and len(idx) >= LOW_RUN and sum(lab[i] == top for i in idx) >= LOW_PURE * len(idx):
                low.append(idx)
        for idx in sorted(low, key=lambda ix: float(np.mean([cov[i] for i in ix])))[:low_cap]:
            jobs.append(("low", idx, wins[idx[0]][0], wins[idx[-1]][1]))
    for kind, idx, s, e in jobs:
        try:
            wp = probs_fn(_clip(audio, s, e)) or {}
        except Exception:                        # noqa: BLE001 — בלי אימות, כמו קודם
            continue
        w = np.array([max(float(wp.get(c, 0.0) or 0.0), 1e-6) for c in cand])
        tot = em[idx].mean(axis=0) + np.log(w / w.sum())
        cur = max(set(lab[i] for i in idx), key=lambda c: sum(lab[i] == c for i in idx))
        if kind == "low":
            if sum(float(wp.get(c, 0.0) or 0.0) for c in ("he", "en")) < LOW_W:
                continue
            st["nlow"] += 1
            tot = np.where(np.isin(np.arange(len(cand)), hi), tot, -np.inf)
        else:
            st["n"] += 1
        j = int(np.argmax(tot))
        if cand[j] == cur:
            continue
        st["flip" if kind == "min" else "fliplow"] += 1
        pj = round(float(np.exp(tot[j] - np.logaddexp.reduce(tot[np.isfinite(tot)]))), 2)
        for i in idx:
            if kind == "min" or lab[i] == cur:
                lab[i], prob[i] = cand[j], pj
                flipped.add(i)
    return lab, prob, st, flipped


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


def timeline(audio, spans: list | None = None, prefer: str = "", model: Model | None = None, vad_fn=None,
             verify_fn=None) -> dict:
    """הציר המלא (ראו ראש הקובץ). prefer = השפה שהמשתמש בחר (מועמדת תמיד, ומקבלת יתרון קטן בהתחלה).
    spans = קטעי הדיבור אם כבר יש (אחרת Silero). verify_fn(קטע) → {שפה: הסתברות} — אימות אזורי המיעוט החשודים
    (whisper-small; בלי — בלי אימות). מודל חסר / תקלה — זורק; הקוראים מטפלים."""
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
        return {"regions": [], "share": {}, "main": "", "cands": [], "n": 0, "vf": {}, "s": round(time.time() - t0, 1)}
    m = model or Model()
    lp = fold(m.logp([audio[int(s * SR):int(e * SR)] for s, e, _ in wins]), m.codes)
    base = tuple(dict.fromkeys(BASE + ((prefer,) if prefer else ())))
    cand, cf = confirm(choose(lp, m.codes, wins, base=base), base, lp, m.codes, wins, audio, verify_fn)
    em = restrict(lp, m.codes, cand)
    prior = np.array([math.log(0.6) if c == prefer else math.log(0.4 / max(1, len(cand) - 1)) for c in cand]) if prefer in cand else None
    path = viterbi(em, wins, prior=prior)
    lab = [cand[j] for j in path]
    prob = [float(np.exp(em[i, j])) for i, j in enumerate(path)]
    regs = regions(wins, lab, prob, spans)
    main = next(iter(share(regs)), "")
    lab, prob, vf, flipped = verify(regs, lab, prob, wins, em, cand, audio, main, verify_fn, cov=coverage(lp, m.codes, cand))
    if flipped:
        regs = regions(wins, lab, prob, spans)
        cs = [(wins[i][0] + wins[i][1]) / 2 for i in flipped]
        for g in regs:
            if any(g["s"] <= c <= g["e"] for c in cs):
                g["v"] = 1
    vf.update(cf)
    sh = share(regs)
    return {"regions": regs, "share": sh, "main": next(iter(sh), ""), "cands": cand, "n": len(wins), "vf": vf,
            "s": round(time.time() - t0, 1)}
