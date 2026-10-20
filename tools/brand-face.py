# מחולל "הפנים החיות" של באפט בלוגו (20/10/2026, בקשת המשתמש: "כמה שיותר אנושי וריאליסטי").
# גיליון פריימים של אזור הפנים (face-<app>.webp), כל פריים = עיוות עדין של הציור המקורי עצמו (liquify) —
# לא הדבקה: עפעף שיורד באמת על האישון (חוסם אותו), אישונים שזזים לצדדים, הרמת גבות, וחיוך דושן
# (זוויות הפה עולות, הלחיים מתרוממות, העפעפיים התחתונים עולים — העיניים "מחייכות").
# שימוש: python3 tools/brand-face.py <לוגו 768> <פלט.webp> <bbox מאסטר x0,y0,x1,y1> <bbox יעד x0,y0,x1,y1>
#   (ה־bbox ממפה את נקודות הפנים, שנמדדו על המאסטר ב־512, ללוגו שמוצג). דורש numpy + scipy. מדפיס JSON למיקום ב־CSS.
import sys, json, math
from PIL import Image, ImageDraw
import numpy as np
from scipy import ndimage as nd

src, out = sys.argv[1], sys.argv[2]
mb = [float(v) for v in sys.argv[3].split(',')]; tb = [float(v) for v in sys.argv[4].split(',')]
img = Image.open(src).convert('RGBA'); A = np.asarray(img).astype(float); N = A.shape[0]; s = N / 512
kx = (tb[2] - tb[0]) / (mb[2] - mb[0]); ky = (tb[3] - tb[1]) / (mb[3] - mb[1])
def P(x, y):   # נקודה במאסטר (סקאלת 512) → פיקסל בלוגו הזה
    return ((x * 2 - mb[0]) * kx + tb[0]) * N / tb[2] * tb[2] / N if False else ((x * 2 - mb[0]) * kx + tb[0]), ((y * 2 - mb[1]) * ky + tb[1])
# הלוגו (768) והמאסטר (1024): kx ממפה פיקסל מאסטר לפיקסל יעד ישירות
U = (kx + ky) / 2 * 2          # יחידה אחת בסקאלת 512 של המאסטר = U פיקסלים בלוגו

# ---- אזור הפנים: גבות עד הסנטר ----
fx0, fy0 = P(206, 224); fx1, fy1 = P(334, 330)
X0, Y0, X1, Y1 = int(fx0), int(fy0), int(math.ceil(fx1)), int(math.ceil(fy1))

L = A[..., :3] @ [.299, .587, .114]
bright = L > 150
lab, _ = nd.label(bright)

def premul(a): b = a.copy(); b[..., :3] *= b[..., 3:4] / 255; return b
def unpremul(b): a = b.copy(); al = np.maximum(a[..., 3:4], 1e-3); a[..., :3] = np.clip(a[..., :3] / al * 255, 0, 255); return a

def warp(base, fields, weight=None):
    """liquify: out(p) = in(p - D(p)), D = סכום של גאוסיאנים אליפטיים; weight מגביל לאזור (למשל בתוך העדשה)"""
    H, W = base.shape[:2]; yy, xx = np.mgrid[0:H, 0:W].astype(float)
    dx = np.zeros((H, W)); dy = np.zeros((H, W))
    for (cx, cy, vx, vy, rx, ry, w) in fields:
        g = np.exp(-(((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2) / 2)
        if w is not None: g = g * w
        dx += vx * g; dy += vy * g
    pm = premul(base); o = np.empty_like(pm)
    for c in range(4): o[..., c] = nd.map_coordinates(pm[..., c], [yy - dy, xx - dx], order=3, mode='nearest')
    return unpremul(np.clip(o, 0, 255))

# ---- העיניים: עדשה, עפעף עליון+אישון, קו תחתון — כמו ב־brand-blink.py ----
eyes = []
for seed, box in [((232, 262), (222, 264, 244, 278)), ((300, 273), (278, 316, 243, 278))]:
    bx0, bx1, by0, by1 = [int(v * s) for v in box]
    reg = np.zeros_like(bright)
    for l in np.unique(lab[by0:by1, bx0:bx1]):
        if l == 0: continue
        ys, xs = np.where(lab == l)
        if xs.min() >= bx0 and xs.max() < bx1 and ys.min() >= by0 and ys.max() < by1: reg[ys, xs] = True
    lens = nd.binary_fill_holes(nd.binary_closing(reg, iterations=int(3 * s)))
    ink = lens & ~bright & (L < 170)
    il, n = nd.label(ink)
    rem = np.zeros_like(ink); dark = np.zeros_like(ink)
    for i in range(1, n + 1):
        ys, xs = np.where(il == i)
        if len(ys) < 4 * s * s or ys.mean() >= 260 * s: continue
        rem[ys, xs] = True
    dark = rem & (L < 95)
    rem = nd.binary_dilation(rem, iterations=max(1, int(1.2 * s))) & lens
    ys, xs = np.where(rem)
    py, px = np.where(nd.binary_opening(dark, iterations=max(1, int(.8 * s))) & (np.arange(A.shape[0])[:, None] > ys.min() + 2.2 * s))
    pc = (px.mean(), py.mean()) if len(px) else (xs.mean(), ys.mean() + 2 * s)
    colr = np.median(A[ink & (L < 90)][..., :3], axis=0)
    # רקע העדשה בלי העפעף והאישון (מילוי מהשכנים)
    a = A.copy(); known = lens & ~rem
    for _ in range(80):
        if not (rem & ~known).any(): break
        acc = np.zeros(a.shape[:2] + (3,)); cnt = np.zeros(a.shape[:2])
        for dy_ in (-1, 0, 1):
            for dx_ in (-1, 0, 1):
                sh = np.roll(np.roll(known, dy_, 0), dx_, 1); v = np.roll(np.roll(a[..., :3], dy_, 0), dx_, 1)
                acc += v * sh[..., None]; cnt += sh
        new = rem & ~known & (cnt > 0); a[new, :3] = acc[new] / cnt[new][:, None]; known |= new
    a[rem, :3] = nd.gaussian_filter(a[..., :3], (1.2 * s, 1.2 * s, 0))[rem]
    # קו העפעף העליון המקורי: לכל עמודה — הפיקסל העליון של הדיו
    cols = np.arange(xs.min(), xs.max() + 1)
    top = np.array([ys[xs == c].min() if (xs == c).any() else np.nan for c in cols], float)
    top = nd.gaussian_filter1d(np.where(np.isnan(top), np.nanmean(top), top), 1.5 * s)
    p0 = (xs.min() + 1.5 * s, top[0] + 1.0 * s); p2 = (xs.max() - 1.5 * s, top[-1] + 1.0 * s)
    eyes.append(dict(lens=lens, rem=rem, bg=a, cols=cols, top=top, p0=p0, p2=p2, colr=colr, pc=pc,
                     wlens=nd.gaussian_filter(nd.binary_erosion(lens, iterations=int(1.2 * s)).astype(float), 1.2 * s)))

def lid_stroke(H, W, pts, thick):
    K = 4; lay = Image.new('L', (W * K, H * K), 0); d = ImageDraw.Draw(lay)
    for k in range(len(pts) - 1):
        t = k / (len(pts) - 1); r = (0.5 + 0.75 * math.sin(math.pi * t)) * thick * K
        for j in range(6):
            u = j / 6; x = (pts[k][0] * (1 - u) + pts[k + 1][0] * u) * K; y = (pts[k][1] * (1 - u) + pts[k + 1][1] * u) * K
            d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return np.asarray(lay.resize((W, H), Image.LANCZOS)).astype(float) / 255

def blink(base, t, eyes_list=None):
    """t 0..1: העפעף יורד מהקו המקורי לקשת עצומה ‿ — מה שמעליו = עור (רקע העדשה), מה שמתחתיו נשאר (האישון מוסתר בהדרגה)"""
    o = base.copy(); H, W = o.shape[:2]; yy = np.arange(H)[:, None]
    for e in eyes:
        cols, top = e['cols'], e['top']
        p0, p2 = e['p0'], e['p2']; cy = max(p0[1], p2[1]) + 3.4 * s
        u = (cols - p0[0]) / max(1, p2[0] - p0[0]); u = np.clip(u, 0, 1)
        closed = (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * (2 * cy - (p0[1] + p2[1]) / 2) + u * u * p2[1]
        ease = t   # האינטרפולציה עצמה ליניארית; העקומה בזמן — ב־CSS (סגירה מהירה, פתיחה איטית)
        yt = top + (closed - top) * ease
        cover = np.zeros((H, W), bool)
        for i, c in enumerate(cols): cover[: int(round(yt[i])) + 1, c] = True
        cover &= e['rem'] | (nd.binary_dilation(e['rem'], iterations=int(1 * s)) & e['lens'])
        o[cover, :3] = e['bg'][cover, :3]
        pts = [(c, yt[i] + .6 * s) for i, c in enumerate(cols)][:: max(1, len(cols) // 40)]
        m = lid_stroke(H, W, pts, 1.05 * s + .4 * s * ease)
        m *= e['lens']
        o[..., :3] = o[..., :3] * (1 - m[..., None]) + e['colr'] * m[..., None]
    return o

def gaze(base, gx, gy=0):
    fields = [(e['pc'][0], e['pc'][1], gx * U, gy * U, 5.5 * U, 3.6 * U, e['wlens']) for e in eyes]
    return warp(base, fields)

def smile(base, k):
    f = []
    for (x, y, vx, vy, rx, ry) in [
        (243, 302, -1.5, -2.0, 4.5, 4.0), (293, 299, 1.5, -2.0, 4.5, 4.0),     # זוויות הפה — למעלה ולצדדים
        (268, 300, 0, -.5, 12, 3.5), (268, 309, 0, .55, 10, 3.5),               # השפתיים נפתחות מעט
        (233, 287, -.4, -1.2, 7, 6), (301, 286, .4, -1.2, 7, 6),                # הלחיים עולות
        (236, 307, -.8, -.9, 4, 7), (297, 307, .8, -.9, 4, 7),                  # הקמטים ליד הפה
        (248, 266, 0, -1.0, 7, 2.2), (294, 266, 0, -1.0, 7, 2.2),               # העפעפיים התחתונים עולים — העיניים מחייכות
        (250, 255, 0, .45, 8, 2.4), (294, 255, 0, .45, 8, 2.4),                 # והעליונים יורדים מעט
    ]:
        cx, cy = P(x, y); f.append((cx, cy, vx * U * k, vy * U * k, rx * U, ry * U, None))
    return warp(base, f)

def brows(base, k):
    f = []
    for (x, y, vx, vy, rx, ry) in [(243, 236, 0, -2.3, 9, 3.6), (297, 236, 0, -2.3, 9, 3.6),
                                   (250, 252, 0, -.45, 7, 2.2), (294, 252, 0, -.45, 7, 2.2)]:
        cx, cy = P(x, y); f.append((cx, cy, vx * U * k, vy * U * k, rx * U, ry * U, None))
    return warp(base, f)

frames = [
    ('base', A),
    ('b1', blink(A, .38)), ('b2', blink(A, .74)), ('b3', blink(A, 1.0)),
    ('gl1', gaze(A, -1.1)), ('gl2', gaze(A, -2.2, .2)), ('gr1', gaze(A, 1.1)), ('gr2', gaze(A, 2.2, .2)),
    ('s1', smile(A, .45)), ('s2', smile(A, 1.0)),
    ('br', brows(smile(A, .35), 1.0)),
    ('s2b', blink(smile(A, 1.0), 1.0)),       # מצמוץ באמצע חיוך — חיוך שעיניו נעצמות (צחוק)
]
crop = lambda a: a[Y0:Y1, X0:X1]
diff = np.zeros((Y1 - Y0, X1 - X0), bool)
for _, f in frames[1:]: diff |= np.abs(crop(f) - crop(A))[..., :4].sum(-1) > 4
alpha = np.clip(nd.gaussian_filter(nd.binary_dilation(diff, iterations=int(2 * s)).astype(float), 1.2 * s) * 1.8, 0, 1)
fw, fh = X1 - X0, Y1 - Y0
sheet = np.zeros((fh, fw * len(frames), 4))
for i, (_, f) in enumerate(frames):
    c = crop(f).copy(); c[..., 3] = c[..., 3] * alpha
    sheet[:, i * fw:(i + 1) * fw] = c
Image.fromarray(np.clip(sheet, 0, 255).astype('uint8')).save(out, 'WEBP', quality=94, alpha_quality=100, method=6)
print(json.dumps({'n': len(frames), 'names': [n for n, _ in frames], 'x': X0 / N * 100, 'y': Y0 / N * 100, 'w': fw / N * 100, 'h': fh / N * 100}))
