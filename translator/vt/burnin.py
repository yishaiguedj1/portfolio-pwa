"""טקסט שכבר על המסך (25/10/2026, ניתוח האיכות — בקשת המשתמש): הכתוביות שלנו לא נצרבות עליו.

מה נמצא במאגר: באפט — הפס של CNBC בתחתית כמעט כל הזמן; הריאליטי — שם ותפקיד בתחתית לכמה שניות;
אקמן — מונחים שמופיעים על המסך. הכתוביות שלנו נצרבו מעליהם (באפט: 61% מהכתוביות).

איך:
  1. באותו מעבר של ffmpeg שמזהה חילופי שוטים (media.detect_shots) יוצאים גם 2 פריימים לשנייה, ברוחב 640.
     ‏PP-OCRv3 (‏PaddleOCR דרך RapidOCR 1.2.3, ‏Apache-2.0 — בתמונת העובד ב־/opt/burnin, גרסה נעולה + sha256):
     det מזהה איפה יש טקסט בפס העליון ובפס התחתון, ו־rec מאשר שזה טקסט (לפחות 2 תווים בביטחון של חצי) —
     בלי זה במה עם כיסאות או יד על הברך זוהו כ"טקסט" (ציון det של 0.95, נמדד). לא שומרים מה כתוב.
     רכיבים קשירים בלי scipy/OpenCV.
  2. בבנייה (place): לכל כתובית — המלבן שהיא תתפוס בפועל (הסגנון + רוחב השורות), מול התיבות שהופיעו בזמן שלה.
     טקסט בדרך ביותר מ־30% מהפריימים → מרימים את הכתובית מעליו (lift, כמו בחדשות); אין מקום מעל לפני אמצע
     המסך → לראש המסך (top, ‏\\an8 — Netflix); גם שם תפוס → נשארת במקום.
  3. כתוביות סמוכות עם הרמה דומה — אותה הרמה (לא קופצות כמה פיקסלים בכל כתובית).

כל תקלה (אין onnxruntime / numpy, המודל לא תואם, שגיאה באמצע) → בלי זיהוי, והבנייה כמו קודם. בלי טוקנים, בלי רשת.
"""
from __future__ import annotations

import hashlib
import math
import os
from pathlib import Path

MODEL_DIR = Path(os.environ.get("SNB_BURN_DIR", "/opt/burnin"))
DET, REC = "ch_PP-OCRv3_det_infer.onnx", "ch_PP-OCRv3_rec_infer.onnx"
SHA256 = {DET: "3439588c030faea393a54515f51e983d8e155b19a2e8aba7891934c1cf0de526",
          REC: "897a3ededb38fee0dae2c1ccee38241f37df202c9509e3abca02e9217c5ee615"}
FPS = 2                  # פריימים לשנייה לזיהוי
W = 640                  # רוחב הפריים לזיהוי
TOP_BAND = 0.25          # הפס העליון: 0–25% מהגובה
BOT_BAND = 0.58          # הפס התחתון: 58%–100%
THR = 0.3                # סף ההסתברות למפה (כמו RapidOCR)
BOX_THR = 0.5            # ציון ממוצע מינימלי לתיבה (כמו RapidOCR)
MIN_H = 0.012            # תיבה נמוכה מזה (חלק מהגובה) = רעש
MIN_W = 0.03             # תיבה צרה מזה (חלק מהרוחב) = רעש (פרחים, נצנוץ) — טקסט אמיתי רחב
MIN_AR = 1.0             # רוחב/גובה (בפיקסלים) — טקסט הוא לפחות מרובע
REC_H = 48               # גובה הקלט של rec
REC_SCORE = 0.5          # ביטחון ממוצע מינימלי בתווים (כמו text_score של RapidOCR)
REC_MIN = 2              # לפחות 2 תווים
UNCLIP = 1.6             # הרחבת התיבה לפני הקריאה (det מכווץ את התיבות — כמו RapidOCR)
MAX_BOXES = 12           # לכל היותר תיבות לפריים (מהגדולות) — תקרת זמן
REUSE_S = 5.0            # תיבה באותו מקום שנקראה ב־5 השניות האחרונות — אותה הכרעה (פס קבוע לא נקרא בכל פריים)
SHARE = 0.3              # חלק מהפריימים בכתובית שבהם הטקסט בדרך — מתחת לזה לא מזיזים
GAP = 0.012              # מרווח בין תחתית הכתובית שהורמה לטקסט שמתחתיה (חלק מהגובה)
MAX_UP = 0.5             # ראש הכתובית שהורמה לא עולה מעל אמצע המסך — אחרת לראש המסך
SAME = 0.03              # הרמות שההפרש ביניהן קטן מזה — מאוחדות בין כתוביות סמוכות
NEAR_S = 1.0             # "סמוכות" — עד שנייה בין הכתוביות
V = 1                    # גרסת burned.json


def model_ok(d=None) -> bool:
    d = Path(d or MODEL_DIR)
    try:
        return all(hashlib.sha256((d / f).read_bytes()).hexdigest() == h for f, h in SHA256.items())
    except OSError:
        return False


def available() -> bool:
    try:
        import numpy  # noqa: F401
        import onnxruntime  # noqa: F401
    except Exception:
        return False
    return model_ok()


def band_rows(fh: int) -> list[tuple[int, int]]:
    return [(0, int(fh * TOP_BAND)), (int(fh * BOT_BAND), fh)]


# ---------------------------------------------------------------------------
# זיהוי

def components(m):
    """רכיבים קשירים (שכנות 8) במסכה בוליאנית, בלי scipy: רצפים בכל שורה + איחוד בין שורות סמוכות.
    → [(y0, y1, x0, x1, [(y, x0, x1), ...])] — y1/x1 בלעדיים."""
    import numpy as np
    runs = []
    for y in np.nonzero(m.any(axis=1))[0]:
        d = np.diff(np.concatenate(([0], m[y].astype(np.int8), [0])))
        for a, b in zip(np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]):
            runs.append((int(y), int(a), int(b)))
    par = list(range(len(runs)))

    def find(i):
        while par[i] != i:
            par[i] = par[par[i]]
            i = par[i]
        return i

    prev, cur, cy = [], [], None
    for i, (y, a, b) in enumerate(runs):
        if y != cy:
            prev = cur if cy is not None and y == cy + 1 else []
            cur, cy = [], y
        for j in prev:
            _, pa, pb = runs[j]
            if pa <= b and a <= pb:              # כולל נגיעה באלכסון
                ri, rj = find(i), find(j)
                if ri != rj:
                    par[ri] = rj
        cur.append(i)
    groups: dict[int, list] = {}
    for i, r in enumerate(runs):
        groups.setdefault(find(i), []).append(r)
    out = []
    for g in groups.values():
        ys = [r[0] for r in g]
        out.append((min(ys), max(ys) + 1, min(r[1] for r in g), max(r[2] for r in g), g))
    return out


def prob_boxes(prob, y0: int, fh: int, fw: int = W) -> list[list[float]]:
    """מפת ההסתברות של פס (שמתחיל בשורה y0) → [[x1, y1, x2, y2], ...] יחסית לפריים (0–1)."""
    out = []
    for ya, yb, xa, xb, g in components(prob > THR):
        if (yb - ya) / fh < MIN_H or (xb - xa) / fw < MIN_W or (xb - xa) < MIN_AR * (yb - ya):
            continue
        tot = sum(float(prob[y, a:b].sum()) for y, a, b in g)
        if tot / max(1, sum(b - a for _, a, b in g)) < BOX_THR:
            continue
        out.append([round(xa / fw, 4), round((y0 + ya) / fh, 4), round(xb / fw, 4), round((y0 + yb) / fh, 4)])
    return out


def ctc_conf(pred) -> tuple[int, float]:
    """הפלט של rec ‏[T, classes] → (מספר התווים, הביטחון הממוצע בהם) — פענוח CTC חמדני, בלי מילון (לא שומרים מה כתוב)."""
    import numpy as np
    idx = pred.argmax(axis=1)
    pr = pred.max(axis=1)
    keep = [t for t in range(len(idx)) if idx[t] != 0 and (t == 0 or idx[t] != idx[t - 1])]
    if not keep:
        return 0, 0.0
    return len(keep), float(np.mean([pr[t] for t in keep]))


def unclip(b, fw: int, fh: int) -> tuple[int, int, int, int]:
    """תיבה יחסית → פיקסלים בפריים, מורחבת כמו ב־RapidOCR (מרחק = שטח × 1.6 / היקף)."""
    x1, y1, x2, y2 = b[0] * fw, b[1] * fh, b[2] * fw, b[3] * fh
    w, h = x2 - x1, y2 - y1
    d = w * h * UNCLIP / max(1e-6, 2 * (w + h))
    return (max(0, int(x1 - d)), max(0, int(y1 - d)), min(fw, int(math.ceil(x2 + d))), min(fh, int(math.ceil(y2 + d))))


class Detector:
    """PP-OCRv3 ב־onnxruntime. frame(rgb uint8 [fh, W, 3]) → תיבות טקסט מאושרות בפסים העליון והתחתון."""

    def __init__(self, threads: int = 2, model_dir=None):
        import onnxruntime as ort
        d = Path(model_dir or MODEL_DIR)
        o = ort.SessionOptions()
        o.intra_op_num_threads = threads
        o.inter_op_num_threads = 1
        self.det = ort.InferenceSession(str(d / DET), o, providers=["CPUExecutionProvider"])
        self.rec = ort.InferenceSession(str(d / REC), o, providers=["CPUExecutionProvider"])
        self.dn, self.rn = self.det.get_inputs()[0].name, self.rec.get_inputs()[0].name
        self.seen: dict[tuple, tuple[float, bool]] = {}      # מקום התיבה (מעוגל) → (מתי נקראה, טקסט?)
        self.reads = 0

    def _is_text(self, img, b) -> bool:
        import numpy as np
        from PIL import Image
        fh, fw = img.shape[:2]
        x1, y1, x2, y2 = unclip(b, fw, fh)
        if x2 - x1 < 4 or y2 - y1 < 4:
            return False
        crop = img[y1:y2, x1:x2]
        rw = max(8, min(1280, int(math.ceil(REC_H * crop.shape[1] / crop.shape[0]))))
        im = np.asarray(Image.fromarray(np.ascontiguousarray(crop)).resize((rw, REC_H), Image.BILINEAR), np.float32)
        tw = max(320, rw)
        x = np.zeros((REC_H, tw, 3), np.float32)
        x[:, :rw] = (im[:, :, ::-1] / 255.0 - 0.5) / 0.5
        pred = self.rec.run(None, {self.rn: x.transpose(2, 0, 1)[None]})[0][0]
        n, conf = ctc_conf(pred)
        return n >= REC_MIN and conf >= REC_SCORE

    def verdict(self, img, b, t: float | None) -> bool:
        key = tuple(round(v * 100) for v in b[:4])
        hit = self.seen.get(key)
        if t is not None and hit is not None and t - hit[0] <= REUSE_S:
            return hit[1]
        ok = self._is_text(img, b)
        self.reads += 1
        if t is not None:
            self.seen[key] = (t, ok)
        return ok

    def frame(self, img, t: float | None = None) -> list[list[float]]:
        import numpy as np
        fh, fw = img.shape[:2]
        cand = []
        for y0, y1 in band_rows(fh):
            band = img[y0:y1]
            h = band.shape[0]
            if h < 8:
                continue
            ph = (h + 31) // 32 * 32
            x = np.zeros((ph, fw, 3), np.float32)
            x[:h] = (band[:, :, ::-1].astype(np.float32) / 255.0 - 0.5) / 0.5    # BGR כמו cv2 ב־RapidOCR
            prob = self.det.run(None, {self.dn: x.transpose(2, 0, 1)[None]})[0][0, 0][:h]
            cand += prob_boxes(prob, y0, fh, fw)
        cand.sort(key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))
        return [b for b in cand[:MAX_BOXES] if self.verdict(img, b, t)]


def frame_height(vw: int, vh: int) -> int:
    return max(32, int(round(vh * W / max(1, vw) / 2)) * 2)


# ---------------------------------------------------------------------------
# מיקום הכתוביות

def cue_rect(c: dict, st, meas, width: int, height: int, lift: float = 0.0, top: bool = False):
    """המלבן שהכתובית תתפוס (x1, y1, x2, y2 — חלק מהפריים), כמו ש־subs.write_ass מציב אותה."""
    lines = c.get("lines") or [""]
    n = len(lines)
    wpx = max((meas.width(x) for x in lines), default=0.0) + 2 * st.outline
    x1 = (width - wpx) / 2.0
    pad = st.outline + 2 * st.k
    if top:
        ya = (height - st.bottom_y) - st.size
        yb = (height - st.bottom_y) + (n - 1) * st.line_pitch
    else:
        yb = st.bottom_y - lift * height
        ya = yb - (n - 1) * st.line_pitch - st.size
    return (x1 / width, (ya - pad) / height, (x1 + wpx) / width, (yb + pad) / height)


def _hit(r, b) -> bool:
    """התיבה בדרך: חפיפה אופקית, ובגובה לפחות 40% מהנמוך מבין השניים (לוגו שרק נוגע בקצה — לא)."""
    if b[2] <= r[0] or b[0] >= r[2]:
        return False
    h = max(1e-6, min(b[3] - b[1], r[3] - r[1]))
    return (min(b[3], r[3]) - max(b[1], r[1])) / h >= 0.4


def _samples(frames: dict, s: float, e: float, fps: float) -> list[list]:
    """התיבות בכל פריים שנדגם בזמן הכתובית (פריים בלי טקסט = רשימה ריקה)."""
    k0, k1 = int(math.ceil(s * fps - 1e-6)), int(math.floor(e * fps + 1e-6))
    if k1 < k0:                                  # כתובית קצרה מהמרווח — הפריים הקרוב
        k0 = k1 = int(round((s + e) / 2 * fps))
    return [frames.get(k, []) for k in range(k0, k1 + 1)]


def _decide(c, smp, st, meas, width, height):
    """→ ("stay"|"lift"|"top", lift)"""
    need = max(1, math.ceil(SHARE * len(smp)))
    base = cue_rect(c, st, meas, width, height)
    if sum(1 for bs in smp if any(_hit(base, b) for b in bs)) < need:
        return "stay", 0.0
    lift = 0.0
    for _ in range(4):                           # מרימים עד שהמלבן פנוי (טקסט בכמה גבהים — כמה צעדים)
        r = cue_rect(c, st, meas, width, height, lift)
        tops = sorted(min(b[1] for b in bs if _hit(r, b)) for bs in smp if any(_hit(r, b) for b in bs))
        if len(tops) < need:
            break
        y_text = tops[0]                         # הטקסט הגבוה ביותר שבדרך — מעליו בכל הפריימים
        lift = max(lift, (st.bottom_y / height) - (y_text - GAP))
    r = cue_rect(c, st, meas, width, height, lift)
    if r[1] >= MAX_UP and sum(1 for bs in smp if any(_hit(r, b) for b in bs)) < need:
        return "lift", round(lift, 3)
    rt = cue_rect(c, st, meas, width, height, top=True)
    if sum(1 for bs in smp if any(_hit(rt, b) for b in bs)) < need:
        return "top", 0.0
    return "stay", 0.0


def place(cues: list[dict], burned: dict, st, meas, width: int, height: int) -> dict:
    """מסמן lift (חלק מהגובה) או top בכתוביות שהטקסט שעל המסך בדרכן. top קיים (מקובץ מיובא) — לא נוגעים."""
    fps = float(burned.get("fps") or FPS)
    frames = {int(round(t * fps)): bs for t, bs in burned.get("frames") or []}
    stats = {"lift": 0, "top": 0, "n": len(cues)}
    if not frames:
        return stats
    for c in cues:
        c.pop("lift", None)
        if c.get("top"):
            continue
        how, lift = _decide(c, _samples(frames, c["start"], c["end"], fps), st, meas, width, height)
        if how == "lift":
            c["lift"] = lift
        elif how == "top":
            c["top"] = True
            c["_burn_top"] = True
    # עקביות: כתובית לא מורמת שצמודה למורמת, וטקסט על המסך מתחת למקום המורם בזמן שלה — עולה לאותו גובה (אחרת שורה
    # אחת נשארת מתחת לפס ושתיים מעליו, והכתוביות קופצות). רק כשהמקום שם פנוי.
    for _ in range(3):
        changed = False
        for i, c in enumerate(cues):
            if c.get("lift") or c.get("top"):
                continue
            nb = [cues[j] for j in (i - 1, i + 1) if 0 <= j < len(cues) and cues[j].get("lift")
                  and (cues[j]["start"] - c["end"] if j > i else c["start"] - cues[j]["end"]) <= NEAR_S]
            if not nb:
                continue
            L = max(x["lift"] for x in nb)
            smp = _samples(frames, c["start"], c["end"], fps)
            need = max(1, math.ceil(SHARE * len(smp)))
            r = cue_rect(c, st, meas, width, height, L)
            below = sum(1 for bs in smp if any(b[1] >= r[3] - 2 * GAP and b[2] > r[0] and b[0] < r[2] for b in bs))
            if below >= need and sum(1 for bs in smp if any(_hit(r, b) for b in bs)) < need:
                c["lift"] = L
                changed = True
        if not changed:
            break
    # כתוביות סמוכות עם הרמה דומה — הגבוהה מביניהן לכולן
    i = 0
    while i < len(cues):
        if not cues[i].get("lift"):
            i += 1
            continue
        j = i
        while (j + 1 < len(cues) and cues[j + 1].get("lift")
               and cues[j + 1]["start"] - cues[j]["end"] <= NEAR_S
               and abs(cues[j + 1]["lift"] - cues[i]["lift"]) <= SAME):
            j += 1
        hi = max(cues[k]["lift"] for k in range(i, j + 1))
        for k in range(i, j + 1):
            cues[k]["lift"] = hi
        i = j + 1
    for c in cues:
        if c.get("lift"):
            stats["lift"] += 1
        if c.pop("_burn_top", False):
            stats["top"] += 1
    return stats
