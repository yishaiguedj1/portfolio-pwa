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
     המסך → לראש המסך (top, ‏\\an8 — לפי ת־כתוביות); גם שם תפוס → נשארת במקום.
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
BOT_BAND = 0.45          # הפס התחתון: 45%–100% (כתובית שהורמה + השטח שמעליה חייבים להיות בתוך מה שנסרק)
THR = 0.3                # סף ההסתברות למפה (כמו RapidOCR)
BOX_THR = 0.5            # ציון ממוצע מינימלי לתיבה (כמו RapidOCR)
MIN_H = 0.012            # תיבה נמוכה מזה (חלק מהגובה) = רעש
MIN_W = 0.03             # תיבה צרה מזה (חלק מהרוחב) = רעש (פרחים, נצנוץ) — טקסט אמיתי רחב
MIN_AR = 1.0             # רוחב/גובה (בפיקסלים) — טקסט הוא לפחות מרובע
MAX_H = 0.12             # תיבה גבוהה מזה = לא שורת טקסט (רגליים ודוכן נאום בהרצאה, 0.15–0.33 מהגובה) — בשקפים 99% עד 0.04
REC_H = 48               # גובה הקלט של rec
REC_SCORE = 0.5          # ביטחון ממוצע מינימלי בתווים (כמו text_score של RapidOCR)
REC_MIN = 2              # לפחות 2 תווים
UNCLIP = 1.6             # הרחבת התיבה לפני הקריאה (det מכווץ את התיבות — כמו RapidOCR)
MAX_BOXES = 12           # לכל היותר תיבות לפריים (מהגדולות) — תקרת זמן
REUSE_S = 5.0            # תיבה באותו מקום שנקראה ב־5 השניות האחרונות — אותה הכרעה (פס קבוע לא נקרא בכל פריים)
SHARE = 0.3              # חלק מהפריימים בכתובית שבהם הטקסט בדרך — מתחת לזה לא מזיזים
GAP = 0.012              # מרווח בין תחתית הכתובית שהורמה לטקסט שמתחתיה (חלק מהגובה)
MAX_UP = 0.5             # ראש הכתובית שהורמה לא עולה מעל אמצע המסך — אחרת לראש המסך
MIN_LIFT = 0.03          # הרמה קטנה מזה — לא מרימים: רק המתאר נוגע (לוגו חסות מתחת), וקפיצה של 20 פיקסלים בין כתוביות גרועה יותר
MAX_LIFT = 0.25          # הרמה של עד רבע מהגובה — פס תחתון (חדשות, שם דובר) נכנס בזה; יותר = כבר אמצע התמונה
ABOVE = 0.06             # שטח פנוי מעל המקום המורם (חלק מהגובה). טקסט שם, אפילו בפריים אחד = הכתובית "נדחסת" בין שורות של שקף
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
        if (not MIN_H <= (yb - ya) / fh <= MAX_H) or (xb - xa) / fw < MIN_W or (xb - xa) < MIN_AR * (yb - ya):
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


def _lift_ok(c, lift, smp, need, st, meas, width, height) -> bool:
    """אפשר להרים לגובה הזה: לא יותר מ־MAX_LIFT, לא מעל אמצע המסך, פנוי במקום עצמו ובשטח שמעליו."""
    r = cue_rect(c, st, meas, width, height, lift)
    if lift > MAX_LIFT + 1e-9 or r[1] < MAX_UP or r[1] - ABOVE < BOT_BAND:
        return False
    # 25/10/2026 (הרצאה עם שקפים): בלי הבדיקה מעל, הכתובית עלתה לשורה ריקה באמצע טבלה, בין שורות טקסט
    # (וחלק מהן הגלאי לא סימן) — עדיף לראש המסך
    up = (r[0], r[1] - ABOVE, r[2], r[1])
    if sum(1 for bs in smp if any(_hit(r, b) for b in bs)) >= need:
        return False
    # מעל — בכל פריים: בטבלה הגלאי מסמן כל פעם תאים אחרים (טקסט קטן), ויחד הם מראים שזה אמצע של שקף
    if any(_hit(up, b) or (b[1] < r[1] and b[3] > r[1] - ABOVE and b[2] > r[0] and b[0] < r[2])
           for bs in smp for b in bs):
        return False
    # באותה שורה, גם בצד: טקסט בגובה של המקום החדש = שורה של טבלה או של שקף (המספרים באמצע — הגלאי מפספס)
    row = (0.0, r[1], 1.0, r[3])
    return sum(1 for bs in smp if any(_hit(row, b) for b in bs)) < need


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
    if lift < MIN_LIFT:
        return "stay", 0.0
    if _lift_ok(c, lift, smp, need, st, meas, width, height):
        return "lift", round(lift, 3)
    rt = cue_rect(c, st, meas, width, height, top=True)
    if sum(1 for bs in smp if any(_hit(rt, b) for b in bs)) < need:
        return "top", 0.0
    return "stay", 0.0


def grow(b, width: int, height: int) -> list[float]:
    """תיבה מ־burned.json (מכווצת, כמו שהגלאי מוציא) → כל הטקסט, באותה הרחבה של unclip. 25/10/2026: עם התיבה
    המכווצת (כשליש מגובה האותיות) הכתובית שהורמה נעצרה באמצע שם דובר גדול ונגעה בו."""
    fh = frame_height(width, height)
    x1, y1, x2, y2 = unclip(b, W, fh)
    return [x1 / W, y1 / fh, x2 / W, y2 / fh]


def place(cues: list[dict], burned: dict, st, meas, width: int, height: int) -> dict:
    """מסמן lift (חלק מהגובה) או top בכתוביות שהטקסט שעל המסך בדרכן. top קיים (מקובץ מיובא) — לא נוגעים."""
    fps = float(burned.get("fps") or FPS)
    frames = {int(round(t * fps)): [grow(b, width, height) for b in bs] for t, bs in burned.get("frames") or []}
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
            if below >= need and _lift_ok(c, L, smp, need, st, meas, width, height):
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
            smp = _samples(frames, cues[k]["start"], cues[k]["end"], fps)
            if _lift_ok(cues[k], hi, smp, max(1, math.ceil(SHARE * len(smp))), st, meas, width, height):
                cues[k]["lift"] = hi
        i = j + 1
    for c in cues:
        if c.get("lift"):
            stats["lift"] += 1
        if c.pop("_burn_top", False):
            stats["top"] += 1
    return stats


# ---------------------------------------------------------------------------
# כתוביות צרובות במקור (16/11/2026, בקשת המשתמש): הטלפון מציע "רקע כהה" כבר בתחילת העבודה, ועם רקע כהה
# הכתוביות שלנו מסתירות אותן — מלבן אטום מעליהן (cover), ובלי להרים את הכתוביות שלנו מעליהן (place).
# כתובית צרובה = שורה בתחתית (מרכז מתחת ל־HS_Y), באמצע הרוחב, לא פס לכל הרוחב, שמתחלפת לאורך הסרטון
# (סימן מים / לוגו קבוע — לא). רק תיבות, בלי מה שכתוב.

HS_Y = 0.6               # מרכז השורה מתחת ל־60% מהגובה
HS_CX = 0.1              # מרכז השורה עד 10% מאמצע הרוחב
HS_W = 0.92              # רחב מזה = פס (חדשות), לא כתובית
HS_SHARE = 0.12          # לפחות 12% מהפריימים עם כתובית צרובה
HS_MIN = 6               # ולפחות 6 פריימים
HS_CHG = 0.05            # חלק מהפריימים שבהם השורה השתנתה (כתוביות מתחלפות; סימן מים — לא)
HS_DX = 0.03             # שינוי בקצה השורה מעבר לזה = כתובית אחרת (רעש של הגלאי קטן מזה)
HS_GAP = 0.06            # תיבות באותו גובה במרחק עד כזה (חלק מהרוחב) = אותה שורה; רחוק יותר (לוגו בפינה) — לא
HS_PAD = 0.02            # ריפוד סביב מה שמסתירים (חלק מהגובה; ברוחב — פי 1.5) — נדיב: הסתרה מוחלטת קודמת למראה
HS_NEAR = 0.04           # הכתובית שלנו קרובה כזה לאזור — מלבן אחד לשתיהן
HS_PRE = 0.75            # מרווח ביטחון בזמן סביב כל פריים עם כתובית צרובה (1.5 דגימות — 16/11/2026: עם חצי שנייה
                         # הצרובה נראתה ברגע של הדגימה הבאה, כשהמלבן כבר ירד)
HS_BRIDGE = 2.0          # פער עד כזה בין הופעות של כתוביות צרובות — מכסים גם אותו (הגלאי פספס פריים / בין כתוביות)
HS_JOIN = 0.25           # רווח קצר מזה בין שני כיסויים — רציף (בלי הבהוב)
HS_IN = 0.6              # תיבה שלפחות 60% ממנה בתוך מלבן מותר (כיסוי / הכתובית שלנו) — לא דליפה
HS_ORIG = 0.5            # תיבה שחופפת לפחות חצי ממנה לטקסט שבמקור באותו רגע — טקסט של המקור (לא שלנו)
HS_EDGE = (0.06, 0.04)   # קרוב כזה (רוחב) למלבן כיסוי, ובגובה שלו — חלק של הצרובה שמבצבץ מהצד
HS_OFF = 0.25            # הבדיקה דוגמת באמצע בין הדגימות של הסריקה (שלב אחר בזמן — שילוב של 4 פריימים לשנייה)
HS_ROUNDS = 3            # בדיקות: רגילה → תיקון הדליפות → פס רציף לכל הסרטון
HS_PROBE = 36            # כמה פריימים בבדיקה המהירה בתחילת העבודה


def sub_lines(bs: list, wide: bool = False) -> list[tuple[list[float], list[int]]]:
    """תיבות של פריים (מורחבות, יחסיות) → [(שורה, האינדקסים שלה)] של כתוביות צרובות: תיבות באותו גובה וסמוכות
    מתאחדות לשורה; נשארות רק שורות בתחתית, במרכז, ולא לכל הרוחב. wide (16/11/2026, נמצא בבדיקה על סרטון): גם שורה
    לכל הרוחב — להסתרה (כתובית ארוכה מקצה לקצה ביצבצה משני הצדדים); לזיהוי (hardsub) — לא, שם זה פס חדשות."""
    rows: list[list] = []
    for i in sorted(range(len(bs)), key=lambda j: bs[j][1]):
        b = bs[i]
        if (b[1] + b[3]) / 2 < HS_Y:
            continue
        for r in rows:
            q = r[0]
            if (min(q[3], b[3]) - max(q[1], b[1]) > 0.5 * min(q[3] - q[1], b[3] - b[1])
                    and b[0] <= q[2] + HS_GAP and b[2] >= q[0] - HS_GAP):
                r[0] = [min(q[0], b[0]), min(q[1], b[1]), max(q[2], b[2]), max(q[3], b[3])]
                r[1].append(i)
                break
        else:
            rows.append([list(b[:4]), [i]])
    return [(q, ix) for q, ix in rows if abs((q[0] + q[2]) / 2 - 0.5) <= HS_CX and (wide or q[2] - q[0] <= HS_W)]


def _vin(q, z) -> bool:
    """השורה q בגובה של האזור z (חפיפה של לפחות חצי מגובה השורה)."""
    return min(q[3], z[3]) - max(q[1], z[1]) >= 0.5 * (q[3] - q[1])


def _lines_at(burned: dict, width: int, height: int, z=None) -> list[tuple[float, list[list[float]]]]:
    """[(t, שורות)] של כתוביות צרובות. z (להסתרה): גם שורה לכל הרוחב — כשהיא בגובה של האזור."""
    out = []
    for t, bs in burned.get("frames") or []:
        ls = [q for q, _ in sub_lines([grow(b, width, height) for b in bs], wide=z is not None)
              if z is None or q[2] - q[0] <= HS_W or _vin(q, z)]
        if ls:
            out.append((float(t), ls))
    return out


def _changed(a: list, b: list) -> bool:
    if len(a) != len(b):
        return True
    wa, wb = max(a, key=lambda q: q[2] - q[0]), max(b, key=lambda q: q[2] - q[0])
    return abs(wa[0] - wb[0]) > HS_DX or abs(wa[2] - wb[2]) > HS_DX


def hardsub(burned: dict, width: int = 1920, height: int = 1080) -> dict | None:
    """burned.json (או הבדיקה המהירה) → {"z": [x1, y1, x2, y2] האזור של הכתוביות הצרובות, "sh": חלק הפריימים} או None."""
    n = int(burned.get("n") or 0) if isinstance(burned, dict) else 0
    rows = _lines_at(burned, width, height) if n > 0 else []
    if len(rows) < HS_MIN or len(rows) / n < HS_SHARE:
        return None
    chg = sum(1 for a, b in zip(rows, rows[1:]) if _changed(a[1], b[1]))
    if chg < max(3, math.ceil(HS_CHG * len(rows))):
        return None
    ls = [q for _, x in rows for q in x]

    def pct(v, p):
        v = sorted(v)
        return v[min(len(v) - 1, max(0, int(p * len(v))))]
    z = [pct([q[0] for q in ls], 0.02), pct([q[1] for q in ls], 0.02), pct([q[2] for q in ls], 0.98), pct([q[3] for q in ls], 0.98)]
    return {"z": [round(min(1.0, max(0.0, v)), 3) for v in z], "sh": round(min(1.0, len(rows) / n), 3)}


def norm_hz(z) -> list[float] | None:
    """אזור מבחוץ (הטלפון / השרתון / קובץ) → [x1, y1, x2, y2] תקין או None."""
    if not isinstance(z, (list, tuple)) or len(z) != 4:
        return None
    try:
        v = [float(x) for x in z]
    except (TypeError, ValueError):
        return None
    if not all(0.0 <= x <= 1.0 for x in v) or v[2] - v[0] < 0.02 or v[3] - v[1] < 0.01:
        return None
    return [round(x, 3) for x in v]


def without_subs(burned: dict, width: int, height: int, z=None) -> dict:
    """עותק של burned.json בלי שורות הכתוביות הצרובות — במצב הסתרה הן לא "בדרך" (מסתירים אותן, לא עוקפים).
    z: גם שורה לכל הרוחב בגובה של האזור (מכוסה — ראו _lines_at)."""
    fr = []
    for t, bs in burned.get("frames") or []:
        drop = {i for q, ix in sub_lines([grow(b, width, height) for b in bs], wide=z is not None)
                if z is None or q[2] - q[0] <= HS_W or _vin(q, z) for i in ix}
        keep = [b for i, b in enumerate(bs) if i not in drop]
        if keep:
            fr.append([t, keep])
    return dict(burned, frames=fr)


def zone_lift(cues: list[dict], z: list[float], st, height: int) -> int:
    """במצב הסתרה: הכתוביות הצרובות גבוהות מהמקום של שלנו — שלנו עולות אליהן (תחתית לתחתית), כדי שמלבן אחד יכסה
    את שתיהן ולא פס גבוה עם חור באמצע. רק כתוביות שלא הורמו / עברו לראש המסך מסיבה אחרת."""
    pad = st.outline + 2 * st.k
    lift = (st.bottom_y + pad) / height - z[3]
    if not MIN_LIFT <= lift <= MAX_LIFT:
        return 0
    n = 0
    for c in cues:
        if not c.get("top") and not c.get("lift"):
            c["lift"] = round(lift, 3)
            n += 1
    return n


def _union(a, b):
    return [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]


def _pad(r):
    return [max(0.0, r[0] - 1.5 * HS_PAD), max(0.0, r[1] - HS_PAD), min(1.0, r[2] + 1.5 * HS_PAD), min(1.0, r[3] + HS_PAD)]


def _area(r):
    return max(0.0, r[2] - r[0]) * max(0.0, r[3] - r[1])


def _inside(g, r) -> float:
    """כמה מהתיבה g בתוך המלבן r (0–1)."""
    i = [max(g[0], r[0]), max(g[1], r[1]), min(g[2], r[2]), min(g[3], r[3])]
    return _area(i) / max(1e-9, _area(g))


def _spans(ts: list[float], bridge: float) -> list[list[float]]:
    """רגעים עם כתובית צרובה → קטעי זמן: ±HS_PRE סביב כל אחד, ופערים עד bridge מגושרים."""
    out = []
    for t in sorted(ts):
        a, b = t - HS_PRE, t + HS_PRE
        if out and a - out[-1][1] <= bridge:
            out[-1][1] = max(out[-1][1], b)
        else:
            out.append([max(0.0, a), b])
    return out


def cover(cues: list[dict], burned: dict | None, z: list[float] | None, st, meas, width: int, height: int,
          extra=(), full: bool = False, dur: float = 0.0) -> list:
    """מצב הסתרה → [(s, e, [x1, y1, x2, y2])] מלבנים אטומים (חלק מהפריים). 16/11/2026 (המשתמש: "הסתרה מוחלטת — שאף
    פעם לא יבצבצו כתוביות מתחת לשלנו"):
      • גאומטריה: כל האזור של הכתוביות הצרובות (z — השורה הרחבה ביותר, גם שתי שורות) + כל מה שנראה סביב הרגע,
        בריפוד נדיב; הכתובית שלנו בתוכו כשהיא קרובה (מלבן אחד).
      • זמן: מכל הופעה של כתובית צרובה ±HS_PRE, עם גישור של פערים עד HS_BRIDGE (פספוס של הגלאי / בין כתוביות), וגם
        בכל זמן של כתובית שלנו (הרגעים שבהם הכי סביר שיש מתחתיה צרובה).
      • extra: דליפות שהבדיקה מצאה [(t, תיבה)] — מכוסות ברגע שלהן. full: פס רציף לכל הסרטון (הצעד האחרון).
    בלי burned.json (רק האזור): האזור בזמן הכתוביות שלנו."""
    rows = _lines_at(burned, width, height, z or [0.0, HS_Y, 1.0, 1.0]) if burned else []
    rows += [(float(t), [list(g)]) for t, g in extra]
    rows.sort(key=lambda x: x[0])
    if not rows and not z:
        return []
    Z = list(z) if z else None
    if Z is None:
        ls = [q for _, x in rows for q in x]
        Z = ls[0]
        for q in ls[1:]:
            Z = _union(Z, q)
    ts = [t for t, _ in rows]
    pres = _spans(ts, HS_BRIDGE) if rows else []
    end = max([float(c["end"]) for c in cues] + [p[1] for p in pres] + [float(dur or 0)] + [0.0])
    if full:
        pres = [[0.0, end]]
    cs = [(float(c["start"]), float(c["end"]), c) for c in cues]
    cut = sorted({0.0} | {x for p in pres for x in p} | {x for s, e, _ in cs for x in (s, e)})
    ev = []
    for a, b in zip(cut, cut[1:]):
        if b - a < 1e-6:
            continue
        m = (a + b) / 2
        on = any(p[0] <= m <= p[1] for p in pres)
        act = [c for s, e, c in cs if s <= m <= e]
        if not on and not act:
            continue
        u = list(Z)
        for t, ls in rows:
            if a - HS_PRE <= t <= b + HS_PRE:
                for q in ls:
                    u = _union(u, q)
        r = _pad(u)
        for c in act:
            if c.get("top"):
                continue
            cr = cue_rect(c, st, meas, width, height, float(c.get("lift") or 0.0))
            if cr[1] <= r[3] + HS_NEAR and cr[3] >= r[1] - HS_NEAR:
                r = _union(r, _pad(list(cr)))
        r = [round(v, 4) for v in r]
        if ev and abs(ev[-1][1] - a) < 1e-6 and ev[-1][2] == r:
            ev[-1] = (ev[-1][0], b, r)
        else:
            ev.append((a, b, r))
    out = []
    for i, (s, e, r) in enumerate(ev):
        nx = ev[i + 1][0] if i + 1 < len(ev) else None
        if nx is not None and 0 < nx - e <= HS_JOIN:
            e = nx                                # בלי הבהוב בין שני כיסויים צמודים
        out.append((round(s, 3), round(e, 3), r))
    return out


def leaks(chk: dict, ev: list, cues: list[dict], z: list[float] | None, st, meas, width: int, height: int) -> list:
    """הבדיקה (media.hide_check — הפריים אחרי הכתוביות שלנו, והמקור באותו רגע) → [(t, תיבה)] טקסט של המקור שנראה.
    דליפה = תיבה בתחתית, שלא בתוך מלבן מותר (כיסוי פעיל / הכתובית שלנו), שהיא חלק מכתובית צרובה במקור — או
    שחופפת לטקסט במקור וצמודה למלבן כיסוי (קצה של צרובה שמבצבץ). לוגו / שם רחוקים מהאזור — לא."""
    out = []
    for t, comp, orig in chk.get("frames") or []:
        if not comp or not orig:
            continue
        og = [grow(b, width, height) for b in orig]
        subs = [q for q, _ in sub_lines(og, wide=True)]
        act = [r for s, e, r in ev if s <= t <= e]
        ok = act + [_pad(list(cue_rect(c, st, meas, width, height, float(c.get("lift") or 0.0), bool(c.get("top")))))
                    for c in cues if float(c["start"]) <= t <= float(c["end"])]
        band = act or ([_pad(list(z))] if z else [])
        for b in comp:
            g = grow(b, width, height)
            if (g[1] + g[3]) / 2 < HS_Y or any(_inside(g, r) >= HS_IN for r in ok):
                continue
            # מבצבץ מהצד: בגובה של מלבן הכיסוי (חצי מהתיבה לפחות) וצמוד לקצה שלו — לא שם דובר מעליו / לוגו רחוק
            side = any(_vin(g, r) and g[2] >= r[0] - HS_EDGE[0] and g[0] <= r[2] + HS_EDGE[0] for r in band)
            if any(_inside(g, q) >= HS_ORIG for q in subs) or (side and any(_inside(g, o) >= HS_ORIG for o in og)):
                out.append((float(t), [round(v, 4) for v in g]))
    return out


def hide(cues: list[dict], burned: dict | None, z: list[float] | None, st, meas, width: int, height: int,
         write, check, dur: float = 0.0):
    """מצב הסתרה עם בדיקה (16/11/2026): כיסוי → write(ev) כותב את ה־ASS → check() מצייר אותו על פריימים של המקור
    ובודק מה נראה → דליפות מכוסות ובודקים שוב → בצעד האחרון פס רציף לכל הסרטון. → (ev, {"n": פריימים שנבדקו,
    "lk": דליפות שתוקנו, "ok": 1 נקי / 0 לא נבדק, "full": 1 פס רציף})."""
    extra, st_ = [], {"n": 0, "lk": 0, "ok": 0}
    ev = cover(cues, burned, z, st, meas, width, height, dur=dur)
    write(ev)
    for rnd in range(HS_ROUNDS):
        chk = check()
        if not chk:
            return ev, st_                       # אי אפשר לבדוק (אין מודלים / תקלה) — ok=0
        st_["n"] += int(chk.get("n") or 0)
        lk = leaks(chk, ev, cues, z, st, meas, width, height)
        if not lk:
            st_["ok"] = 1
            return ev, st_
        st_["lk"] += len(lk)
        extra += lk
        if rnd == HS_ROUNDS - 1:
            break
        full = rnd == HS_ROUNDS - 2
        if full:
            st_["full"] = 1
        ev = cover(cues, burned, z, st, meas, width, height, extra=extra, full=full, dur=dur)
        write(ev)
    return ev, st_


def cover_ass(text: str, ev: list, width: int, height: int) -> str:
    """המלבנים כשורות ASS (ציור אטום, \\p1) בתחילת [Events] — נצבעים לפני הכתוביות, כלומר מתחתיהן. רק לצריבה
    (נגנים של רצועה רכה לא תמיד מציירים \\p — שם רק הרקע האטום של הכתובית)."""
    from .subs import _ass_time
    if not ev:
        return text
    lines = []
    for s, e, r in ev:
        x1, y1, x2, y2 = r[0] * width, r[1] * height, r[2] * width, r[3] * height
        lines.append(f"Dialogue: 0,{_ass_time(s)},{_ass_time(e)},Main,,0,0,0,,"
                     f"{{\\an7\\pos(0,0)\\bord0\\shad0\\blur0\\1c&H000000&\\1a&H00&\\p1}}"
                     f"m {x1:.0f} {y1:.0f} l {x2:.0f} {y1:.0f} l {x2:.0f} {y2:.0f} l {x1:.0f} {y2:.0f}{{\\p0}}")
    head, sep, tail = text.partition("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n")
    if not sep:
        return text
    return head + sep + "\n".join(lines) + "\n" + tail
