# יוצר את logo-blink-<app>.png — אותו לוגו עם עיניים עצומות (רק אזור העדשות), למצמוץ של הלוגו החי בהדר (20/10/2026).
# שימוש: python3 tools/brand-blink.py logo-header.png logo-blink-invest.png  (דורש numpy + scipy; מדפיס את המיקום באחוזים ל־styles.css)
# מחליפים לוגו — מריצים שוב ומעדכנים ב־styles.css את --bk-y / --bk-h / --bk-oy של האפליקציה.
import sys, json
from PIL import Image, ImageDraw, ImageFilter
import numpy as np
from scipy import ndimage as nd
src, out = sys.argv[1], sys.argv[2]
img = Image.open(src).convert('RGBA'); im = np.asarray(img).astype(float); N = im.shape[0]; s = N/512
L = im[...,:3] @ [.299,.587,.114]
bright = L > 150
lab, _ = nd.label(bright)
res = img.copy()
boxes = []
for seed, box in [((232,262),(222,264,244,278)), ((300,273),(278,316,243,278))]:
  x,y = int(seed[0]*s), int(seed[1]*s)
  bx0,bx1,by0,by1 = [int(v*s) for v in box]
  reg = np.zeros_like(bright)
  # כל האזורים הבהירים בתוך המסגרת של העדשה (בלי מה שבורח החוצה)
  for l in np.unique(lab[by0:by1, bx0:bx1]):
    if l == 0: continue
    ys, xs = np.where(lab == l)
    if xs.min() >= bx0 and xs.max() < bx1 and ys.min() >= by0 and ys.max() < by1: reg[ys, xs] = True
  lens = nd.binary_fill_holes(nd.binary_closing(reg, iterations=int(3*s)))
  lens &= ~nd.binary_dilation(~nd.binary_fill_holes(nd.binary_closing(reg, iterations=int(3*s))), iterations=0) if False else lens
  ink = lens & ~bright & (L < 170)
  il, n = nd.label(ink)
  comps = []
  for i in range(1, n+1):
    ys, xs = np.where(il == i)
    if len(ys) < 4*s*s: continue
    comps.append((ys.mean(), i, ys, xs))
  comps.sort()
  rem = np.zeros_like(ink)
  up = [c for c in comps if c[0] < 260*s]          # העפעף העליון והאישון; הקו התחתון (מרכז מתחת ל־260) נשאר
  for c in up: rem[c[2], c[3]] = True
  rem = nd.binary_dilation(rem, iterations=max(1, int(1.2*s))) & lens
  ys, xs = np.where(rem)
  colr = np.median(im[ink & (L < 90)][..., :3], axis=0) if (ink & (L < 90)).any() else np.array([30,70,30])
  # מילוי: ממוצע של השכנים הידועים, שוב ושוב
  a = im.copy(); known = lens & ~rem
  for _ in range(60):
    if not (rem & ~known).any(): break
    acc = np.zeros(a.shape[:2]+(3,)); cnt = np.zeros(a.shape[:2])
    for dy in (-1,0,1):
      for dx in (-1,0,1):
        sh = np.roll(np.roll(known, dy, 0), dx, 1); v = np.roll(np.roll(a[...,:3], dy, 0), dx, 1)
        acc += v * sh[...,None]; cnt += sh
    new = rem & ~known & (cnt > 0)
    a[new, :3] = acc[new] / cnt[new][:, None]; known = known | new
  a[rem, :3] = nd.gaussian_filter(a[...,:3], (1.2*s, 1.2*s, 0))[rem]
  # העפעף הסגור: קשת רכה מהקצה לקצה, יורדת עד מרכז האישון
  topy = {}
  for x0_ in (xs.min(), xs.max()):
    col = ys[xs == x0_]; topy[x0_] = col.min() + (col.max()-col.min())*.35
  p0 = (xs.min()+1.5*s, topy[xs.min()]); p2 = (xs.max()-1.5*s, topy[xs.max()])
  cy = max(p0[1], p2[1]) + 3.4*s        # הקשת שוקעת באמצע — עין עצומה ורגועה
  K = 4; H, W = a.shape[:2]
  lay = Image.new('L', (W*K, H*K), 0); d = ImageDraw.Draw(lay)
  pts = []
  for k in range(41):
    t = k/40; px = (1-t)**2*p0[0] + 2*(1-t)*t*(p0[0]+p2[0])/2 + t*t*p2[0]; py = (1-t)**2*p0[1] + 2*(1-t)*t*(2*cy-(p0[1]+p2[1])/2) + t*t*p2[1]
    pts.append((px*K, py*K))
  import math
  for k in range(len(pts)-1):            # קו שמתעבה באמצע ונעשה דק בקצוות, כמו משיכת מכחול
    t = k/(len(pts)-1); r = (0.55 + 0.75*math.sin(math.pi*t))*s*K
    for j in range(6):
      u = j/6; px = pts[k][0]*(1-u)+pts[k+1][0]*u; py = pts[k][1]*(1-u)+pts[k+1][1]*u
      d.ellipse((px-r, py-r, px+r, py+r), fill=255)
  m = np.asarray(lay.resize((W, H), Image.LANCZOS)).astype(float)/255
  glow = nd.gaussian_filter(m, 1.6*s)
  gcol = np.array([120, 220, 90.])
  a[..., :3] = a[..., :3]*(1-glow[..., None]*.35) + gcol*glow[..., None]*.35
  a[..., :3] = a[..., :3]*(1-m[..., None]) + colr*m[..., None]
  ys2, xs2 = np.where(lens)
  boxes.append((xs2.min(), ys2.min(), xs2.max()+1, ys2.max()+1))
  r = np.asarray(res).astype(float); r[lens] = a[lens]; res = Image.fromarray(r.clip(0,255).astype('uint8'))
x0 = min(b[0] for b in boxes); y0 = min(b[1] for b in boxes); x1 = max(b[2] for b in boxes); y1 = max(b[3] for b in boxes)
patch = res.crop((x0, y0, x1, y1))
orig = img.crop((x0, y0, x1, y1))
# שקיפות רק במה שהשתנה (עם קצה רך) — כל השאר לוקח מהלוגו עצמו
diff = np.abs(np.asarray(patch).astype(float) - np.asarray(orig).astype(float))[..., :3].sum(-1) > 6
al = nd.gaussian_filter(nd.binary_dilation(diff, iterations=int(1.5*s)).astype(float), .8*s)
pa = np.asarray(patch).copy(); pa[..., 3] = (np.clip(al*1.6, 0, 1)*255).astype('uint8')
Image.fromarray(pa).save(out)
print(json.dumps({'x': x0/N*100, 'y': y0/N*100, 'w': (x1-x0)/N*100, 'h': (y1-y0)/N*100}))
