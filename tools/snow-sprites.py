# מחולל אריחי השלג של הלוגו החי (20/10/2026): snow-<far|mid|near>-<light|dark>.png ברזולוציה פי 4.
# כל אריח חוזר על עצמו בלי תפר (הפתיתים רחוקים מהקצוות), יורד ב־CSS באורך האריח בדיוק.
# שימוש: python3 tools/snow-sprites.py  (PIL + numpy + scipy; זרע קבוע — אותה תוצאה בכל הרצה)
import math, random
from PIL import Image, ImageDraw, ImageFilter
K = 4
LAYERS = {   # רוחב, גובה (CSS px), פתיתים: (סוג, רדיוס CSS, טשטוש CSS, אטימות) — כמה סוגים, כמו בשלג אמיתי
  'far':  (120, 150, [('dot', 1.0, .5, .75)] * 8 + [('dot', 1.4, .6, .8)] * 3 + [('star', 2.2, .2, .7)] * 2),
  'mid':  (170, 200, [('xtal', 4.2, .15, .95)] * 2 + [('fern', 4.6, .12, .95)] + [('star', 3.2, .12, .9)] * 2 + [('sector', 3.6, .1, .9)] +
                     [('dot', 2.0, .4, .9)] * 4 + [('dot', 1.3, .4, .8)] * 3),
  'near': (230, 280, [('fern', 8.0, .3, 1)] + [('xtal', 7.0, .35, 1)] + [('sector', 6.2, .45, .95)] + [('star', 5.2, .6, .9)] +
                     [('bokeh', 5.5, 2.4, .5)] * 2 + [('dot', 3.0, .9, .9)] * 3),
}
COL = {'light': ((158, 196, 236), (96, 142, 204)), 'dark': ((255, 255, 255), (170, 205, 245))}

def xtal(d, cx, cy, r, w, rnd):
    rot = rnd.uniform(0, math.pi / 3)
    for k in range(6):
        a = rot + k * math.pi / 3; ex, ey = cx + r * math.cos(a), cy + r * math.sin(a)
        d.line((cx, cy, ex, ey), fill=255, width=max(1, int(w)))
        for t, L in ((.45, .36), (.72, .26)):           # ענפים צדדיים, כמו בקריסטל אמיתי
            px, py = cx + r * t * math.cos(a), cy + r * t * math.sin(a)
            for s in (-1, 1):
                b = a + s * math.pi / 3
                d.line((px, py, px + r * L * math.cos(b), py + r * L * math.sin(b)), fill=255, width=max(1, int(w * .8)))
        d.ellipse((ex - w * .7, ey - w * .7, ex + w * .7, ey + w * .7), fill=255)
    d.ellipse((cx - w * 1.4, cy - w * 1.4, cx + w * 1.4, cy + w * 1.4), fill=255)

def star(d, cx, cy, r, w, rnd):         # כוכב פשוט — שש קרניים
    rot = rnd.uniform(0, math.pi / 3)
    for k in range(6):
        a = rot + k * math.pi / 3; d.line((cx, cy, cx + r * math.cos(a), cy + r * math.sin(a)), fill=255, width=max(1, int(w)))
    d.ellipse((cx - w, cy - w, cx + w, cy + w), fill=255)

def fern(d, cx, cy, r, w, rnd):         # דנדריט "שרך" — הרבה ענפים קטנים לכל זרוע
    rot = rnd.uniform(0, math.pi / 3)
    for k in range(6):
        a = rot + k * math.pi / 3; d.line((cx, cy, cx + r * math.cos(a), cy + r * math.sin(a)), fill=255, width=max(1, int(w)))
        for t in (.3, .45, .6, .75, .88):
            px, py = cx + r * t * math.cos(a), cy + r * t * math.sin(a); L = r * .3 * (1 - t * .7)
            for sg in (-1, 1):
                b = a + sg * math.pi / 3; d.line((px, py, px + L * math.cos(b), py + L * math.sin(b)), fill=255, width=max(1, int(w * .7)))
    d.ellipse((cx - w * 1.3, cy - w * 1.3, cx + w * 1.3, cy + w * 1.3), fill=255)

def sector(d, cx, cy, r, w, rnd):       # לוח עם מגזרים — שש "כפות" רחבות
    rot = rnd.uniform(0, math.pi / 3)
    for k in range(6):
        a = rot + k * math.pi / 3
        e = (cx + r * math.cos(a), cy + r * math.sin(a))
        l = (cx + r * .62 * math.cos(a - .32), cy + r * .62 * math.sin(a - .32)); q = (cx + r * .62 * math.cos(a + .32), cy + r * .62 * math.sin(a + .32))
        d.polygon([(cx, cy), l, e, q], fill=200)
        d.line((cx, cy, e[0], e[1]), fill=255, width=max(1, int(w * .8)))
    d.ellipse((cx - w * 1.2, cy - w * 1.2, cx + w * 1.2, cy + w * 1.2), fill=255)

def needle(d, cx, cy, r, w, rnd):       # מחט / עמוד קטן
    a = rnd.uniform(0, math.pi)
    d.line((cx - r * math.cos(a), cy - r * math.sin(a), cx + r * math.cos(a), cy + r * math.sin(a)), fill=255, width=max(1, int(w * 1.3)))

def plate(d, cx, cy, r, w, rnd):
    rot = rnd.uniform(0, math.pi / 3)
    pts = [(cx + r * math.cos(rot + k * math.pi / 3), cy + r * math.sin(rot + k * math.pi / 3)) for k in range(6)]
    d.polygon(pts, fill=150)
    d.line(pts + [pts[0]], fill=255, width=max(1, int(w)))
    for p in pts: d.line((cx, cy, p[0], p[1]), fill=210, width=max(1, int(w * .6)))

for name, (W, H, flakes) in LAYERS.items():
    rnd = random.Random(name)
    places = []
    n = len(flakes); cols = 3
    for i, (kind, r, blur, al) in enumerate(flakes):   # מיקום בלי חפיפה ורחוק מהקצוות — האריח נסגר בלי תפר; פיזור לפי עמודות
        c = i % cols
        for _ in range(500):
            m = r + blur * 2 + 3
            x, y = rnd.uniform(max(m, W * c / cols), min(W - m, W * (c + 1) / cols)), rnd.uniform(m, H - m)
            if all(math.hypot(x - a, y - b) > r + rr + 10 for a, b, rr in places): break
        places.append((x, y, r))
        flakes_pos = places
    for theme, (core, edge) in COL.items():
        out = Image.new('RGBA', (W * K, H * K), (0, 0, 0, 0))
        for (kind, r, blur, al), (x, y, _) in zip(flakes, places):
            m = Image.new('L', (W * K, H * K), 0); d = ImageDraw.Draw(m)
            cx, cy, R = x * K, y * K, r * K
            lw = max(1.6 * K * r / 7.5, K * .9)
            if kind == 'xtal': xtal(d, cx, cy, R, lw, rnd)
            elif kind == 'fern': fern(d, cx, cy, R, lw * .85, rnd)
            elif kind == 'star': star(d, cx, cy, R, lw * .9, rnd)
            elif kind == 'sector': sector(d, cx, cy, R, lw, rnd)
            elif kind == 'needle': needle(d, cx, cy, R, K * .8, rnd)
            elif kind == 'plate': plate(d, cx, cy, R, K * .9, rnd)
            else: d.ellipse((cx - R, cy - R, cx + R, cy + R), fill=255)
            if blur: m = m.filter(ImageFilter.GaussianBlur(blur * K))
            glow = m.filter(ImageFilter.GaussianBlur(1.6 * K))
            a = Image.eval(m, lambda v: int(v * al))
            halo = Image.eval(glow, lambda v: int(v * al * (.4 if theme == 'light' else .35)))
            out.alpha_composite(Image.merge('RGBA', (*[Image.new('L', m.size, c) for c in edge], halo)))
            out.alpha_composite(Image.merge('RGBA', (*[Image.new('L', m.size, c) for c in core], a)))
        out.save(f'snow-{name}-{theme}.png', optimize=True)
        print(name, theme, out.size)
