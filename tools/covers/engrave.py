import numpy as np, sys, warnings; warnings.filterwarnings('ignore')
from PIL import Image
from skimage.filters import gaussian
from skimage.restoration import denoise_tv_chambolle
from skimage.morphology import remove_small_objects, remove_small_holes, binary_opening, disk
from scipy import ndimage as ndi
S = sys.argv[1]
P = dict(tv=0.16, dark=0.30, xs=3.4, xe=0.018, minl=900, hlo=0.36, hhi=0.52, period=13.0, suit=0.2, suity=0.62, hcov=0.7, open=0, fend=0.98, flen=0.16)
for a in sys.argv[2:]: k, v = a.split('='); P[k] = float(v)
im = np.asarray(Image.open(S + '/crop2.jpg').convert('L'), dtype=np.float32) / 255
m = np.asarray(Image.open(S + '/mask2.png'), dtype=np.float32) / 255
H, W = im.shape; yy, xx = np.mgrid[0:H, 0:W]
mm = ndi.binary_fill_holes(m > 0.5)
sm = denoise_tv_chambolle(im, weight=P['tv'])
lo, hi = np.percentile(sm[mm], [3, 97]); g = np.clip((sm - lo) / (hi - lo), 0, 1)
# 1) תווי פנים כהים: עיניים, מסגרת משקפיים, פה, נחיריים, אוזן
feat = gaussian(g, 1.5) < P['dark']
feat = binary_opening(feat, disk(2)); feat = remove_small_objects(feat, 250)
# 2) קווי מתאר רחבים בלבד
def xdog(g, s, k=1.6, tau=0.985, eps=0.02, phi=40):
    d = gaussian(g, s) - tau * gaussian(g, s * k)
    return np.where(d >= eps, 1.0, 1 + np.tanh(phi * (d - eps)))
ln = xdog(g, P['xs'], eps=P['xe']) < 0.5
ln = remove_small_objects(ln, int(P['minl']))
# 3) הצללה מקבילית רכה בצללים בינוניים
tone = gaussian(g, 7)
ph = ((xx * 0.75 + yy) / P['period']) % 1.0
dk = np.clip((P['hhi'] - tone) / (P['hhi'] - P['hlo']), 0, 1)
hatch = (np.abs(ph - 0.5) * 2 > 1 - dk * P['hcov']) & (dk > 0.12)   # hcov = כיסוי מרבי בצל עמוק
# 4) שיער: קווי קווצות דקים רק באזור השיער (בהיר, בחלק העליון)
from skimage.morphology import skeletonize, binary_dilation
def thin(mask, minlen, w=1):         # קו דק ורציף בעובי אחיד במקום כתם
    sk = skeletonize(mask)
    sk = remove_small_objects(sk, minlen, connectivity=2)
    return binary_dilation(sk, disk(w)) if w else sk
# שיער: קווצות צפופות לאורך השיער (מתמונה פחות מוחלקת)
from skimage.color import rgb2hsv
hsv = rgb2hsv(np.asarray(Image.open(S + '/crop2.jpg').convert('RGB'), dtype=np.float32) / 255)
sat = gaussian(hsv[..., 1], 4); val = gaussian(hsv[..., 2], 4)
hairzone = (sat < 0.17) & (val > 0.5) & (yy < H * 0.55) & ndi.binary_fill_holes(m > 0.5)
hairzone = ndi.binary_opening(hairzone, iterations=4)
hairzone = remove_small_objects(hairzone, 3000)
print('hair sat check', round(float(np.median(hsv[..., 1][hairzone])), 3) if hairzone.any() else None)
g2 = np.clip((denoise_tv_chambolle(im, weight=0.05) - lo) / (hi - lo), 0, 1)
from skimage.filters import sato
from scipy.ndimage import map_coordinates, convolve
def lic_strands(g, zone, L=26, seed=7):
    # כיוון השיער = ניצב לגרדיאנט (מכוון לפי טנזור מבנה מוחלק)
    gs = gaussian(g, 3)
    gy, gx = np.gradient(gs)
    Jxx, Jyy, Jxy = gaussian(gx * gx, 8), gaussian(gy * gy, 8), gaussian(gx * gy, 8)
    th = 0.5 * np.arctan2(2 * Jxy, Jxx - Jyy) + np.pi / 2       # כיוון הקווצה
    tx, ty = np.cos(th), np.sin(th)
    rng = np.random.default_rng(seed)
    noise = gaussian(rng.random(g.shape), 0.7)
    acc = noise.copy(); cnt = 1
    for sgn in (1, -1):
        px, py = xx.astype(np.float32), yy.astype(np.float32)
        for _ in range(L):
            ix = np.clip(px.round().astype(int), 0, W - 1); iy = np.clip(py.round().astype(int), 0, H - 1)
            px = px + sgn * tx[iy, ix]; py = py + sgn * ty[iy, ix]
            acc += map_coordinates(noise, [py, px], order=1, mode='nearest'); cnt += 1
    lic = acc / cnt
    lic = (lic - lic[zone].mean()) / (lic[zone].std() + 1e-6)
    return lic
lic = lic_strands(g, hairzone)
# קווצה כהה = ערכי LIC נמוכים, בצפיפות לפי כהות מקומית של השיער
hl = (lic < -0.9 + (0.62 - gaussian(g, 4)) * 2.5) & hairzone
hl = remove_small_objects(hl, 60, connectivity=2)
def strokes(mask, minlen):
    sk = skeletonize(mask)
    nb = convolve(sk.astype(np.uint8), np.ones((3, 3), np.uint8), mode='constant') - 1
    sk = sk & ~(nb >= 3)                       # חותכים בצמתים → רק קטעים חלקים
    return remove_small_objects(sk, minlen, connectivity=2)
facezone = mm & ~hairzone & (yy > H * 0.18)
rw = sato(g2, sigmas=[3.0, 5.0], black_ridges=True)
wr = (rw > np.percentile(rw[facezone], 88)) & facezone
wr = binary_dilation(strokes(wr, 70), disk(1))
from skimage.measure import label as sklabel, regionprops
def elongated(mask, ratio=3.0):          # רק קווים מוארכים — בלי נקודות עגולות
    lab = sklabel(mask, connectivity=2); keep = np.zeros_like(mask)
    for r in regionprops(lab):
        if r.minor_axis_length == 0 or r.major_axis_length / max(r.minor_axis_length, 1e-6) >= ratio:
            keep[lab == r.label] = True
    return keep
wr = elongated(wr); hl = elongated(hl, 2.5)
ink = feat | ln | hatch | hl | wr
print("hair zone", int(hairzone.sum()), "hair lines", int(hl.sum()), "face zone", int(facezone.sum()), "wrinkles", int(wr.sum()), "feat", int(feat.sum()))
suit = (gaussian(im, 8) < P['suit']) & (yy > H * P['suity'])   # בגד כהה בתחתית (באפט: חליפה; בזוס: חולצה)
mm &= ~suit
if P['open']: mm = ndi.binary_opening(mm, structure=disk(int(P['open'])))   # מנקה שאריות דקות לאורך שולי הבגד
lab, n = ndi.label(mm)
if n > 1: sz = ndi.sum(mm, lab, range(1, n + 1)); mm = lab == (1 + int(np.argmax(sz)))
paper = mm & ~ink
paper = remove_small_objects(paper, 500); paper = remove_small_holes(paper, 150) & ~(feat | ln | hl | wr)
fade = np.clip((H * P['fend'] - yy) / (H * P['flen']), 0, 1)   # דהייה בתחתית
a = gaussian(paper.astype(np.float32), 0.8) * fade
out = np.zeros((H, W, 4), np.uint8); out[..., :3] = 255; out[..., 3] = (np.clip(a * 1.25, 0, 1) * 255).astype(np.uint8)
img = Image.fromarray(out); img = img.crop(img.getchannel('A').getbbox())
img.save(S + '/portrait4.png')
bg = Image.new('RGBA', img.size, (105, 81, 165, 255)); bg.alpha_composite(img)
bg.convert('RGB').resize((img.width // 2, img.height // 2), Image.LANCZOS).save(S + '/portrait4_prev.jpg')
