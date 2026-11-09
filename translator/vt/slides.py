"""גלאי השקפים לניתוח סרטונים (גל 0 — docs/studio-video-analysis-plan.md 3.2 שלב 6, 16.2 PR 0.1).

השיטה (מחקר docs/research/video-analysis/03-slides-ocr-visual.md §1 — 47/47 מעברים עם סמן נע ו־PiP; ‏ffmpeg
ו־PySceneDetect בספים המקובלים — 0/47):
  1. ffmpeg מפענח VI_FPS (1) פריימים לשנייה, ‏640×360 אפור, בצינור rawvideo (בלי קבצים). סרטון שאינו 16:9 —
     מרופד, והריפוד (roi) לא נספר.
  2. מסכת "תנועה מתמשכת": פיקסל שהשתנה ביותר מ־30% מזוגות הדגימות בחלון נע של ±WIN_S שנ׳ = PiP, מצלמה או
     וידאו מוטמע → מורחב 15×15 ומושמט מההשוואה. חלון נע ולא כל הסרטון: פריסה שמתחלפת באמצע (מצלמה ↔ שקפים),
     וזיכרון חסום (‏~WIN_S פריימים, ‏~15MB) גם בהרצאה של שעתיים.
  3. חציון של 3 דגימות — סמן, לייזר ועכבר שמופיעים בדגימה אחת נעלמים (בלעדיו — 158 זיהויי שווא במחקר).
  4. הפרש מקומי: |M[i] − M[i−1]| > DIFF במסכה → הרחבה 7×7 → רכיבים קשירים. אירוע = רכיב שיש בתוכו AREA
     פיקסלים *שהשתנו* לפחות (לא שטח הרכיב המורחב: סמן שנעצר לשתי דגימות — ‏~20–40 פיקסלים ב־360p — נשאר מתחת;
     שורת טקסט שנחשפה — מאות. במחקר שני זיהויי השווא היו 121–140px מורחבים, האירוע האמיתי הקטן — 1,637px).
  5. דגימות רצופות עם אירוע (fade, אנימציה) = מעבר; מצב יציב = STABLE דגימות לפחות בלי אירוע.
  6. בין שני מצבים יציבים של שקף (relate):
       same   — אין אירוע ביניהם (חלון קופץ שנסגר, סמן) → אותו מצב, הטווח מתארך;
       reveal — "תוספתי מול מחליף" על ההפרש הגולמי: נעלם ≤ REVEAL × הופיע → אותו שקף, מצב חדש (חשיפה). במחקר:
                0.000 בכל חשיפה, 1.346 ומעלה בכל החלפה;
       edit   — האזור שהשתנה קטן מ־EDIT מאזור התוכן (הדגשה שעוברת בין שורות, עיגול סמן, הודעה קופצת) → אותו שקף,
                מצב חדש. תוספת על המחקר (שם הסמן זז בכל דגימה) — הסף מכויל ב־PR 0.4 לפי המדדים שנשמרים (`m`);
       new    — שקף חדש.
  7. סוגים: blank (כמעט אחיד — שחור, לבן ריק) — לא יחידה, אבל שובר רצף; cam — מסכת התנועה על רוב הפריים
     (מצלמה / וידאו במסך מלא; רצופים מתאחדים); motion — רצף מעברים של MOTION_MIN_S שנ׳ לפחות (גלילה, הדגמה חיה,
     וידאו מוטמע בלי מסכה) — יחידה עם מצב אחד; slide — כל השאר.

הפלט: יחידות `s<n>` עם מצבים `s<n>.<k>` (‏t0, ‏t1, ‏frame_t — הרגע לפריים החד מהזרם המלא; פרק 4.1 בתוכנית).
הספים — מהמחקר ומהמדידה הסינתטית; מכיילים על הרצאות אמיתיות ב־PR 0.3/0.4 (גם דרך משתני הסביבה VI_SL_*).
numpy בלבד — בלי OpenCV/scipy (הרכיבים הקשירים — vt/burnin.components), בלי טוקנים, בלי רשת.
"""

from __future__ import annotations

import os
import subprocess
import tempfile
import time
from collections import deque

V = 1                       # ‏vo — גרסת הגלאי (ממדי הגרסה)
W, H = 640, 360


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name) or default)
    except ValueError:
        return default


FPS = _f("VI_FPS", 1.0)                 # דגימות לשנייה
DIFF = int(_f("VI_SL_DIFF", 25))        # שינוי בהירות (0–255) שנחשב "השתנה"
MOTION = _f("VI_SL_MOTION", 0.3)        # חלק מזוגות הדגימות שבהם פיקסל השתנה → תנועה מתמשכת
WIN_S = _f("VI_SL_WIN", 60.0)           # חצי החלון של מסכת התנועה (שניות)
MASK_K = 15                             # הרחבת מסכת התנועה
DIL_K = 7                               # הרחבת ההפרש לפני הרכיבים (בלעדיה — רק 28 מתוך 36 חשיפות במחקר)
AREA = int(_f("VI_SL_AREA", 60))        # פיקסלים שהשתנו ברכיב אחד — פחות מזה רעש / סמן
REVEAL = _f("VI_SL_REVEAL", 0.3)        # נעלם/הופיע עד כאן = חשיפה
EDIT = _f("VI_SL_EDIT", 0.25)           # אזור השינוי / אזור התוכן מתחת לזה = עריכה באותו שקף
STABLE = int(_f("VI_SL_STABLE", 2))     # דגימות לפחות במצב יציב
CAM = _f("VI_SL_CAM", 0.5)              # מסכת תנועה על יותר מזה מהפריים = מצלמה / וידאו, לא שקף
BLANK_STD = _f("VI_SL_BLANK", 6.0)      # סטיית תקן מתחת לזה = פריים כמעט אחיד
MOTION_MIN_S = _f("VI_SL_MOTION_S", 5.0)  # רצף מעברים ארוך מזה = יחידת "motion"
MASK_EVERY = 5                          # מסכת התנועה מחושבת מחדש כל כמה דגימות (משתנה לאט)
QUICK = 4096                            # הפרש גדול מזה — אירוע בלי לספור רכיבים
BLK = (24, 32)                          # בלוק הרקע המקומי (שורות × עמודות) — רשת של 15×20


# ---------------------------------------------------------------- פעולות על פריימים (numpy בלבד)

def med3(a, b, c):
    """חציון של שלושה פריימים, פיקסל־פיקסל — בלי np.median (מהיר בהרבה)."""
    import numpy as np
    return np.maximum(np.minimum(a, b), np.minimum(np.maximum(a, b), c))


def absdiff(a, b):
    import numpy as np
    return np.maximum(a, b) - np.minimum(a, b)          # uint8 בלי גלישה


def dilate(m, k: int):
    """הרחבה בריבוע k×k של מסכה בוליאנית — מעבר שורות ומעבר עמודות של OR על הזזות."""
    if k <= 1 or not m.any():
        return m.copy()
    r = k // 2
    out = m.copy()
    for d in range(1, r + 1):
        out[:, d:] |= m[:, :-d]
        out[:, :-d] |= m[:, d:]
    m2 = out.copy()
    for d in range(1, r + 1):
        out[d:, :] |= m2[:-d, :]
        out[:-d, :] |= m2[d:, :]
    return out


def event_px(d) -> int:
    """הרכיב החזק במפת שינוי (בוליאנית): מספר הפיקסלים *שהשתנו* בתוך הרכיב הקשיר הגדול של המפה המורחבת.
    מפה עם QUICK פיקסלים ומעלה — הסכום כולו (אירוע ממילא; חוסך את ספירת הרכיבים בפייד ובגלילה)."""
    import numpy as np
    n = int(np.count_nonzero(d))
    if n == 0 or n >= QUICK:
        return n
    from .burnin import components
    best = 0
    for *_, g in components(dilate(d, DIL_K)):
        best = max(best, sum(int(np.count_nonzero(d[y, a:b])) for y, a, b in g))
    return best


def ink_map(a, valid):
    """פיקסלי "דיו" — רחוקים יותר מ־DIFF מהרקע המקומי (חציון בבלוק 24×32), כך שמעבר צבע ברקע לא נספר כתוכן."""
    import numpy as np
    bh, bw = BLK
    med = np.median(a.reshape(H // bh, bh, W // bw, bw), axis=(1, 3))
    bg = np.repeat(np.repeat(med, bh, axis=0), bw, axis=1)
    return (np.abs(a.astype(np.int16) - bg.astype(np.int16)) > DIFF) & valid


def relate(a, b, valid) -> tuple[str, dict]:
    """שני מצבים יציבים של שקף (a לפני b) → ('same' | 'reveal' | 'edit' | 'new', מדדים לכיול)."""
    import numpy as np
    d = (absdiff(a, b) > DIFF) & valid
    if event_px(d) < AREA:
        return "same", {}
    a16, b16 = a.astype(np.int16), b.astype(np.int16)
    darker = int(np.count_nonzero((a16 - b16 > DIFF) & valid))
    lighter = int(np.count_nonzero((b16 - a16 > DIFF) & valid))
    light_bg = float(np.median(a[valid])) >= 128 if valid.any() else True
    app, van = (darker, lighter) if light_bg else (lighter, darker)
    chg = int(np.count_nonzero(dilate(d, DIL_K)))
    content = int(np.count_nonzero(dilate(ink_map(a, valid) | ink_map(b, valid), DIL_K)))
    ratio = chg / max(1, content)
    m = {"app": app, "van": van, "chg": round(ratio, 3)}
    if app > 0 and van <= REVEAL * app:
        return "reveal", m
    if ratio < EDIT:
        return "edit", m
    return "new", m


def flat(a, roi) -> float:
    """חלק הפריים ברמת האפור השכיחה (±4) — רקע אחיד של שקף/מסך גבוה, צילום מצלמה נמוך (מדד לכיול)."""
    import numpy as np
    h = np.bincount(a[roi].ravel(), minlength=256)
    k = int(h.argmax())
    return float(h[max(0, k - 4):k + 5].sum()) / max(1, int(h.sum()))


def roi_for(w: int, h: int):
    """האזור שמכיל את הסרטון אחרי הקטנה וריפוד ל־640×360 (כמו בפילטר של frames)."""
    import numpy as np
    roi = np.zeros((H, W), bool)
    if not w or not h or w <= 0 or h <= 0:
        roi[:] = True
        return roi
    s = min(W / w, H / h)
    sw, sh = min(W, max(2, int(w * s) // 2 * 2)), min(H, max(2, int(h * s) // 2 * 2))
    x0, y0 = (W - sw) // 2, (H - sh) // 2
    roi[y0:y0 + sh, x0:x0 + sw] = True
    return roi


# ---------------------------------------------------------------- הפענוח

def frames(src: str, fps: float | None = None, dur: float | None = None):
    """פריימים אפורים 640×360 (uint8) מ־ffmpeg, בצינור. נכשל לפני הפריים הראשון → RuntimeError.
    שגיאות ffmpeg לקובץ זמני ולא לצינור (צינור stderr מלא — ffmpeg נתקע)."""
    import numpy as np
    fps = FPS if fps is None else fps
    vf = (f"fps={fps:g},scale={W}:{H}:force_original_aspect_ratio=decrease:flags=area,"
          f"pad={W}:{H}:(ow-iw)/2:(oh-ih)/2,format=gray")
    # ‏-skip_frame noref: פריימים שאינם ייחוס (B) לא מפוענחים — ‏~23% מהירות ב־H.264, בלי סחיפה (אף פריים לא נשען
    # עליהם), והסטייה בזמן הדגימה עד פריים או שניים — זניחה ב־1fps
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-skip_frame", "noref", "-i", str(src)]
    if dur:
        cmd += ["-t", f"{dur:.3f}"]
    cmd += ["-map", "0:v:0", "-an", "-sn", "-vf", vf, "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"]
    err = tempfile.TemporaryFile()
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=err)
    n, size = 0, W * H
    try:
        while True:
            buf = p.stdout.read(size)
            if len(buf) < size:
                break
            n += 1
            yield np.frombuffer(buf, dtype=np.uint8).reshape(H, W)
    finally:
        p.stdout.close()
        try:
            code = p.wait(timeout=30)
        except subprocess.TimeoutExpired:
            p.kill()
            code = p.wait()
        err.seek(0)
        tail = err.read()[-400:].decode("utf-8", "replace").strip()
        err.close()
        if code and not n:
            raise RuntimeError(f"ffmpeg ({code}): {tail}")


# ---------------------------------------------------------------- הגלאי

class Detector:
    """מקבל פריימים בזה אחר זה (push) ומחזיר את היחידות בסוף (finish). הכל מקוון: בזיכרון רק חלון הפריימים,
    מפות השינוי הדחוסות של החלון, והמצב היציב האחרון."""

    def __init__(self, fps: float | None = None, roi=None):
        import numpy as np
        self.fps = FPS if fps is None else float(fps)
        self.R = max(2, int(round(WIN_S * self.fps)))
        self.roi = np.ones((H, W), bool) if roi is None else roi
        self.roi_n = max(1, int(self.roi.sum()))
        self.raw: deque = deque()            # פריימים גולמיים מ־base (נדרשים: i−1 עד i+R)
        self.base = 0
        self.pairs: deque = deque()          # מפות "השתנה" (packbits) של הזוגות j−1→j בחלון
        self.pair0 = 1                       # j של pairs[0]
        self.count = np.zeros((H, W), np.int16)
        self.n = 0
        self.i = 0
        self.mask = None
        self.prevM = None
        self.cur = None                      # המקטע הפתוח: {a, b, first, last, va, vb, mf, std}
        self.prev = None                     # המצב היציב האחרון שאינו ריק: {kind, last, vb, state}
        self.gap = 0                         # דגימות מעבר רצופות מאז המצב היציב האחרון
        self.gap_a = 0
        self.blank_since = False             # מקטע ריק יציב מאז prev
        self.motion_since = False            # יחידת motion מאז prev
        self.units: list[dict] = []
        self.st = {"events": 0, "segs": 0, "unstable": 0, "blank": 0, "same": 0, "reveal": 0, "edit": 0,
                   "new": 0}
        self.t_detect = 0.0

    # -- חלון התנועה
    def _add_pair(self, j: int) -> None:
        import numpy as np
        a, b = self.raw[j - 1 - self.base], self.raw[j - self.base]
        pk = np.packbits(absdiff(a, b) > DIFF)
        self.pairs.append(pk)
        self.count += np.unpackbits(pk, count=H * W).reshape(H, W)

    def _drop_pair(self) -> None:
        import numpy as np
        pk = self.pairs.popleft()
        self.count -= np.unpackbits(pk, count=H * W).reshape(H, W)
        self.pair0 += 1

    def push(self, f) -> None:
        t0 = time.time()
        self.raw.append(f)
        self.n += 1
        if self.n >= 2:
            self._add_pair(self.n - 1)
        while self.i + self.R < self.n:          # יש R דגימות "עתיד" לדגימה i
            self._process(self.i)
            self.i += 1
        self.t_detect += time.time() - t0

    def finish(self) -> dict:
        t0 = time.time()
        while self.i < self.n:
            self._process(self.i)
            self.i += 1
        self._close(final=True)
        self._flush_gap(self.n)
        self.t_detect += time.time() - t0
        return self._result()

    # -- דגימה אחת
    def _process(self, i: int) -> None:
        import numpy as np
        lo = max(1, i - self.R + 1)              # החלון של הזוגות לדגימה i: j ב־[i−R+1, i+R]
        while self.pairs and self.pair0 < lo:
            self._drop_pair()
        if self.mask is None or i % MASK_EVERY == 0:
            npairs = len(self.pairs)
            self.mask = (dilate(self.count > MOTION * npairs, MASK_K) & self.roi) if npairs >= 4 \
                else np.zeros((H, W), bool)
        valid = self.roi & ~self.mask
        raw = self.raw
        f = raw[i - self.base]
        M = med3(raw[i - 1 - self.base] if i >= 1 else f, f, raw[i + 1 - self.base] if i + 1 < self.n else f)
        ev = False
        if self.prevM is not None:
            ev = event_px((absdiff(M, self.prevM) > DIFF) & valid) >= AREA
        self.st["events"] += ev
        mf = float(np.count_nonzero(self.mask)) / self.roi_n
        if ev or self.cur is None:
            self._close(final=False)
            self.cur = {"a": i, "b": i, "first": M, "last": M, "va": valid, "vb": valid, "mf": mf,
                        "std": [float(M[self.roi].std())]}
        else:
            c = self.cur
            c["b"], c["last"], c["vb"] = i, M, valid
            c["mf"] = max(c["mf"], mf)
            if len(c["std"]) < 5:
                c["std"].append(float(M[self.roi].std()))
        self.prevM = M
        while self.base < i - 1:                 # הפריים i−1 נחוץ עד הדגימה הבאה
            raw.popleft()
            self.base += 1

    # -- מקטע שנסגר → יחידות
    def _close(self, final: bool) -> None:
        c, self.cur = self.cur, None
        if c is None:
            return
        self.st["segs"] += 1
        ln = c["b"] - c["a"] + 1
        std = sorted(c["std"])[len(c["std"]) // 2]
        lone = final and not self.units and self.prev is None and self.gap == 0
        if ln < STABLE and not lone:             # חלק ממעבר
            self.st["unstable"] += 1
            if self.gap == 0:
                self.gap_a = c["a"]
            self.gap += ln
            return
        self._flush_gap(c["a"])
        if std < BLANK_STD:
            self.st["blank"] += ln
            self.blank_since = True
            return
        kind = "cam" if c["mf"] > CAM else "slide"
        self._place(c, kind, std)

    def _flush_gap(self, end: int) -> None:
        """רצף מעברים שהסתיים: ארוך מ־MOTION_MIN_S → יחידת motion (גלילה, הדגמה, וידאו מוטמע)."""
        if self.gap and (end - self.gap_a) / self.fps >= MOTION_MIN_S:
            self.units.append({"kind": "motion", "states": [{"segs": [(self.gap_a, end - 1)], "rel": "new"}]})
            self.motion_since = True
        self.gap, self.gap_a = 0, 0

    def _place(self, c: dict, kind: str, std: float) -> None:
        p = self.prev
        rel, m = "new", {}
        if p is not None and p["kind"] == kind:
            if kind == "cam":
                rel = "same"
            else:
                rel, m = relate(p["last"], c["first"], p["vb"] & c["va"])
        self.st[rel] += 1
        m.update({"mf": round(c["mf"], 3), "std": round(std, 1), "flat": round(flat(c["last"], self.roi), 3)})
        seg = (c["a"], c["b"])
        if rel == "same" and not self.blank_since and not self.motion_since:
            p["state"]["segs"].append(seg)       # אותו תוכן ברצף — המצב מתארך
            state = p["state"]
        elif rel != "new" and not self.motion_since:
            state = {"segs": [seg], "rel": rel, "m": m}
            if rel == "same":                    # אותו תוכן אחרי מסך ריק
                state["same"] = p["state"]
            self.units[-1]["states"].append(state)
        else:
            state = {"segs": [seg], "rel": "new", "m": m}
            if rel == "same":                    # אותו תוכן אחרי יחידת motion — יחידה חדשה עם הפניה
                state["same"] = p["state"]
            self.units.append({"kind": kind, "states": [state]})
        self.prev = {"kind": kind, "last": c["last"], "vb": c["vb"], "state": state}
        self.blank_since = self.motion_since = False

    def _result(self) -> dict:
        fps = self.fps
        for n, u in enumerate(self.units, 1):
            for k, st in enumerate(u["states"], 1):
                st["id"] = f"s{n}.{k}"
        out = []
        for n, u in enumerate(self.units, 1):
            states = []
            for st in u["states"]:
                a, b = max(st["segs"], key=lambda s: s[1] - s[0])
                rec = {"id": st["id"], "t0": round(st["segs"][0][0] / fps, 2),
                       "t1": round((st["segs"][-1][1] + 1) / fps, 2), "frame_t": round((a + b) / 2 / fps, 2),
                       "rel": st["rel"]}
                if st.get("same"):
                    rec["same"] = st["same"]["id"]
                if st.get("m"):
                    rec["m"] = st["m"]
                states.append(rec)
            out.append({"id": f"s{n}", "t0": states[0]["t0"], "t1": states[-1]["t1"], "kind": u["kind"],
                        "states": states})
        secs = {k: round(sum(u["t1"] - u["t0"] for u in out if u["kind"] == k), 1)
                for k in ("slide", "cam", "motion")}
        st = dict(self.st)
        st.update({"units": len(out), "states": sum(len(u["states"]) for u in out),
                   "slide_s": secs["slide"], "cam_s": secs["cam"], "motion_s": secs["motion"],
                   "blank_s": round(st.pop("blank") / fps, 1), "detect_s": round(self.t_detect, 2),
                   "ms_frame": round(1000 * self.t_detect / max(1, self.n), 2)})
        return {
            "v": V, "fps": fps, "w": W, "h": H, "n": self.n, "dur": round(self.n / fps, 2),
            "units": out, "stats": st,
            "params": {"diff": DIFF, "motion": MOTION, "win_s": WIN_S, "area": AREA, "reveal": REVEAL,
                       "edit": EDIT, "stable": STABLE, "cam": CAM, "blank": BLANK_STD, "motion_s": MOTION_MIN_S},
        }


def detect_frames(it, fps: float | None = None, roi=None) -> dict:
    """פריימים (איטרטור של מערכי uint8 ב־H×W) → התוצאה. לבדיקות ולשימוש חוזר."""
    d = Detector(fps, roi)
    for f in it:
        d.push(f)
    return d.finish()


def detect(src: str, fps: float | None = None, max_s: float | None = None, size: tuple | None = None,
           log=None) -> dict:
    """מהסרטון: פענוח + גלאי. size = (רוחב, גובה) של המקור לאזור הריפוד; בלעדיו — ffprobe."""
    t0 = time.time()
    if size is None:
        try:
            from pathlib import Path
            from .media import probe
            v = probe(Path(src)).get("video") or {}
            size = (v.get("width", 0), v.get("height", 0))
        except Exception:  # noqa: BLE001 — בלי מידות: כל הפריים
            size = (0, 0)
    r = detect_frames(frames(src, fps, max_s), fps, roi_for(*size))
    wall = time.time() - t0
    s = r["stats"]
    s["wall_s"] = round(wall, 1)
    s["decode_s"] = round(max(0.0, wall - s["detect_s"]), 1)
    if log:
        log(f"שקפים: {s['units']} יחידות ({s['states']} מצבים — {s['reveal']} חשיפות, {s['edit']} עריכות) "
            f"מ־{r['n']} דגימות · שקף {s['slide_s']} שנ׳, מצלמה {s['cam_s']} שנ׳, תנועה {s['motion_s']} שנ׳ · "
            f"{s['wall_s']} שנ׳ ({s['ms_frame']}ms לפריים בגלאי)")
    return r


def noscreen(r: dict, min_share: float = 0.05) -> bool:
    """אין מסך לניתוח (‏vi_noscreen): שקפים פחות מ־min_share מאורך הסרטון."""
    return not r.get("dur") or r["stats"]["slide_s"] < min_share * r["dur"]
