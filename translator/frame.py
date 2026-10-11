"""סבב 9 (11/10/2026): מסגור אוטומטי לדובר — כשחותכים ליחס צר (9:16 לשורטס, 1:1, 4:5) המסגרת עוקבת אחרי הפנים.

איך:
  1. ffmpeg מפענח את המקור ב־2 פריימים לשנייה, אחרי אותו סיבוב / היפוך של העריכה, מוקטן ל־640 — בלי לטעון סרטון לזיכרון.
  2. YuNet (OpenCV Zoo, MIT — translator/models) ב־onnxruntime, בלי OpenCV: הפנים הגדולות בכל פריים, עם העדפה לאלה שליד
     המסגרת הנוכחית (לא קופצים בין שני אנשים באותו גודל).
  3. "צלם": המסגרת זזה רק כשהפנים יוצאות מאזור מת (DEAD) לפחות שנייה (HOLD), בפאן של חצי שנייה; בחיתוך בין קטעים — קפיצה.
  4. ffmpeg: crop עם x שמחושב לכל פריים מביטוי של מדרגות רכות (בלי שרשור if) — x_expr.

כל תקלה (אין onnxruntime / המודל לא תואם / אין פנים) → None, והחיתוך נשאר במיקום הקבוע מהעריכה. בלי טוקנים, בלי רשת.
"""
import hashlib
import math
import subprocess
from pathlib import Path

MODEL = Path(__file__).resolve().parent / 'models' / 'face_detection_yunet_2023mar.onnx'
MODEL_SHA256 = '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4'
FPS = 2                  # פריימים לשנייה לזיהוי
IN = 640                 # הקלט של YuNet (640×640, BGR, 0–255)
SCORE = 0.6
DEAD = 0.08              # אזור מת — חלק מרוחב הטווח שבו המסגרת יכולה לזוז
HOLD = 2                 # כמה פריימים רצופים מחוץ לאזור המת לפני שזזים (= שנייה)
PAN = 0.5                # משך הפאן (שניות)
KF_MAX = 80              # תקרת מעברים בביטוי של ffmpeg
NEAR = 0.15              # "ליד המסגרת הנוכחית" — מעדיפים פנים כאלה אם הן לפחות 60% מהגדולה
STRIDES = (8, 16, 32)


def model_ok(path=MODEL):
    try:
        return hashlib.sha256(Path(path).read_bytes()).hexdigest() == MODEL_SHA256
    except OSError:
        return False


def decode(outs, score=SCORE):
    """הפלטים של YuNet (dict שם → מערך) → [(x1, y1, w, h, ציון)] בפיקסלים של הקלט 640. כמו FaceDetectorYN של OpenCV."""
    import numpy as np
    faces = []
    for s in STRIDES:
        cols = IN // s
        cls = np.clip(outs['cls_%d' % s].reshape(-1), 0, 1)
        obj = np.clip(outs['obj_%d' % s].reshape(-1), 0, 1)
        sc = np.sqrt(cls * obj)
        idx = np.nonzero(sc >= score)[0]
        if not len(idx):
            continue
        bb = outs['bbox_%d' % s].reshape(-1, 4)[idx]
        r, c = idx // cols, idx % cols
        cx, cy = (c + bb[:, 0]) * s, (r + bb[:, 1]) * s
        w, h = np.exp(bb[:, 2]) * s, np.exp(bb[:, 3]) * s
        for i in range(len(idx)):
            faces.append((float(cx[i] - w[i] / 2), float(cy[i] - h[i] / 2), float(w[i]), float(h[i]), float(sc[idx[i]])))
    return nms(faces)


def nms(faces, thr=0.3):
    out = []
    for f in sorted(faces, key=lambda f: -f[4]):
        if all(iou(f, g) < thr for g in out):
            out.append(f)
    return out


def iou(a, b):
    ix = max(0.0, min(a[0] + a[2], b[0] + b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[1] + a[3], b[1] + b[3]) - max(a[1], b[1]))
    inter = ix * iy
    u = a[2] * a[3] + b[2] * b[3] - inter
    return inter / u if u > 0 else 0.0


def choose(faces, fw, prev=None):
    """המרכז האופקי (0–1 מרוחב הפריים) של הדובר: הפנים הגדולות, אלא אם יש קרובות למיקום הקודם ולא קטנות בהרבה."""
    if not faces or fw <= 0:
        return None
    big = max(faces, key=lambda f: f[2] * f[3])
    if prev is not None:
        near = [f for f in faces if abs((f[0] + f[2] / 2) / fw - prev) <= NEAR and f[2] * f[3] >= 0.6 * big[2] * big[3]]
        if near:
            big = max(near, key=lambda f: f[2] * f[3])
    return min(1.0, max(0.0, (big[0] + big[2] / 2) / fw))


def crop_pos(cx, RW, cw):
    """מרכז הפנים (0–1) → מיקום החיתוך (0–1, כמו x בעריכה): הפנים במרכז החלון, בלי לצאת מהתמונה."""
    free = RW - cw
    if free <= 0:
        return 0.5
    return min(1.0, max(0.0, (cx * RW - cw / 2) / free))


def smooth(samples, starts=None):
    """samples = [(t, pos או None[, קטע])] לפי הזמן בתוצאה; starts[קטע] = מתי הקטע מתחיל בתוצאה (תפר — קפיצה מותרת).
    → (x0, [(t, מ־, אל־, משך)]) או None כשאין אף פנים. מגדיל את האזור המת עד שהמעברים נכנסים ב־KF_MAX."""
    vals = [s[1] for s in samples if s[1] is not None]
    if not vals:
        return None
    filled, last = [], vals[0]
    for s in samples:
        last = s[1] if s[1] is not None else last
        filled.append((s[0], last, s[2] if len(s) > 2 else 0))
    med = []                                   # חציון של 3 בתוך הקטע — פריים בודד שגוי לא מזיז
    for i, (t, p, g) in enumerate(filled):
        w = sorted(q for _, q, h in filled[max(0, i - 1):i + 2] if h == g)
        med.append((t, w[(len(w) - 1) // 2], g))
    dead = DEAD
    while True:
        cur, kf, cnt, g0 = med[0][1], [], 0, med[0][2]
        x0 = cur
        for t, p, g in med:
            if g != g0:                        # תפר: קופצים מיד למקום של הקטע החדש
                g0, cnt = g, 0
                if abs(p - cur) > 1e-3:
                    kf.append((round((starts or {}).get(g, t), 3), cur, p, 0.0))
                    cur = p
                continue
            if abs(p - cur) > dead:
                cnt += 1
                if cnt >= HOLD:
                    kf.append((round(t, 3), cur, p, PAN))
                    cur, cnt = p, 0
            else:
                cnt = 0
        if len(kf) <= KF_MAX or dead >= 0.5:
            return round(x0, 4), [(t, round(a, 4), round(b, 4), d) for t, a, b, d in kf[:KF_MAX]]
        dead *= 1.5


def x_expr(free, x0, kf):
    """ביטוי x לפילטר crop (פיקסלים, זוגי): x0 + Σ (אל − מ) × מדרגה רכה. מספרים בלבד — בלי טקסט מהמשתמש."""
    terms = ['%.4f' % x0]
    for t, a, b, d in kf:
        step = ('clip((t-%.3f)/%.3f\\,0\\,1)' % (t, d)) if d > 0 else ('gte(t\\,%.3f)' % t)
        terms.append('%+.4f*%s' % (b - a, step))
    return '2*trunc(%d*(%s)/2)' % (int(free), ''.join(terms))


def frame_filters(e):
    """הסיבוב וההיפוך של העריכה (בלי מהירות / חיתוך) — כדי לזהות על אותה תמונה שתיחתך."""
    rt = e.get('rt') or 0
    f = []
    if rt in (90, 270):
        f.append('transpose=%d' % (1 if rt == 90 else 2))
    if bool(e.get('fh')) != (rt == 180):
        f.append('hflip')
    if bool(e.get('fv')) != (rt == 180):
        f.append('vflip')
    return f


def samples_for(src, e, info, detect, env=None):
    """(t במקור, מרכז 0–1 או None) לכל פריים בקטעים שנשארים. detect(frame640) → faces."""
    import numpy as np
    import edl as E
    RW, RH = E.rot_dims(info.get('w') or 0, info.get('h') or 0, e.get('rt') or 0)
    if not (RW > 0 and RH > 0):
        return []
    s = IN / max(RW, RH)
    sw, sh = max(2, int(RW * s) // 2 * 2), max(2, int(RH * s) // 2 * 2)
    vf = ','.join(['fps=%d' % FPS] + frame_filters(e) + ['scale=%d:%d' % (sw, sh)])
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(src), '-an', '-vf', vf, '-f', 'rawvideo', '-pix_fmt', 'bgr24', 'pipe:1']
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, env=env)
    n, out, prev = 0, [], None
    keep = e.get('k') or []
    canvas = np.zeros((IN, IN, 3), dtype=np.uint8)
    size = sw * sh * 3
    try:
        while True:
            buf = p.stdout.read(size)
            if len(buf) < size:
                break
            t = n / FPS
            n += 1
            if keep and not any(a <= t <= b for a, b in keep):
                continue
            canvas[:sh, :sw] = np.frombuffer(buf, dtype=np.uint8).reshape(sh, sw, 3)
            c = choose(detect(canvas), sw, prev)
            prev = c if c is not None else prev
            out.append((t, c))
    finally:
        p.stdout.close()
        p.wait()
    return out


def detector():
    """→ detect(frame) או None (אין onnxruntime / המודל לא תואם)."""
    if not model_ok():
        return None
    try:
        import numpy as np
        import onnxruntime as ort
    except ImportError:
        return None
    so = ort.SessionOptions()
    so.log_severity_level = 3
    sess = ort.InferenceSession(str(MODEL), so, providers=['CPUExecutionProvider'])
    names = [o.name for o in sess.get_outputs()]

    def detect(img):
        x = np.ascontiguousarray(img.transpose(2, 0, 1)[None].astype(np.float32))
        return decode(dict(zip(names, sess.run(None, {sess.get_inputs()[0].name: x}))))
    return detect


def track(src, e, info, env=None, detect=None):
    """→ (free, x0, kf) למסגור לפי הזמן בתוצאה, או None. free = כמה פיקסלים החיתוך יכול לזוז."""
    import edl as E
    if not e or not e.get('af') or not info.get('v'):
        return None
    RW, RH = E.rot_dims(info.get('w') or 0, info.get('h') or 0, e.get('rt') or 0)
    cb = E.crop_box(RW, RH, e['ar'], e['x'], e.get('y', 0.5), e.get('z', 1))
    if not cb or RW - cb['w'] < 2:
        return None
    detect = detect or detector()
    if not detect:
        return None
    raw = samples_for(src, e, info, detect, env)
    sp = e.get('sp') or 1
    keep = e.get('k') or []
    starts, off = {}, 0.0
    for i, (a, b) in enumerate(keep):
        starts[i] = round(off / sp, 3)
        off += b - a
    samples = []
    for t, c in raw:
        g = next((i for i, (a, b) in enumerate(keep) if a <= t <= b), 0) if keep else 0
        to = E.map_time(e, t)
        if to is not None:
            samples.append((to / sp, None if c is None else crop_pos(c, RW, cb['w']), g))
    sm = smooth(samples, starts)
    if not sm:
        return None
    return RW - cb['w'], sm[0], sm[1]
