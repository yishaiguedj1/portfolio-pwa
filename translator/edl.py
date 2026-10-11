"""מ4–מ5 (10/10/2026): רשימת העריכות (EDL) של עורך הווידאו — חיתוך ויחס תמונה.

**אותה לוגיקה בדיוק כמו studioedl.js בטלפון ו־normEdl בשרתון** (tests/studio-edl.test.js משווה):
  { "k": [[a, b], …] — הקטעים שנשארים בזמן המקור (ריק = הכל), "ar": "src" | "9:16" | "1:1" | "4:5", "x": 0–1 }
סבב 3 (עורך הווידאו ב׳) — שדות רשות, רק כשהם לא ברירת המחדל: y (מיקום אנכי), z (זום 1–3), sp (מהירות), rt (סיבוב),
fh / fv (היפוך), vo (עוצמה %), mu (השתקה), fi / fo (הדרגה, שניות), ln (השוואת עוצמה ל־‎−14 LUFS).
לפני התרגום רק k / ar / x (pre).
כאן גם הפקודה של ffmpeg: חיתוך (trim/atrim + concat) ויחס תמונה (crop), בקידוד ביניים איכותי — הצריבה אחר כך מקודדת שוב.
העריכה מגיעה מהטלפון (דרך השרתון) — מספרים בלבד; שום שדה לא נכנס לפקודה כטקסט.
"""
import json
import math
import subprocess
from pathlib import Path

SEG_MIN = 0.5
SEG_MAX = 60
JOIN_GAP = 0.05
ARS = ('src', '9:16', '1:1', '4:5')
MAX_T = 24 * 3600
SPEEDS = (0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4)
ROTS = (0, 90, 180, 270)
Z_MAX = 3
VOL_MAX = 200
FADE_MAX = 10
LUFS = -14
EXTRA_POS = ('y', 'z')
EXTRA_REST = ('sp', 'rt', 'fh', 'fv', 'vo', 'mu', 'fi', 'fo', 'ln', 'dn', 'br', 'ct', 'sa', 'fx', 'bl', 'tr', 'th')
FXS = ('bw', 'warm', 'cool', 'vint')   # סבב 7: מסננים


def _num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return math.nan
    return float(v) if math.isfinite(v) else math.nan


def r3(x):
    """כמו Math.round(x * 1000) / 1000 ב־JS (חצי — כלפי מעלה, לא עיגול בנקאי)."""
    return math.floor(x * 1000 + 0.5) / 1000


def _int_if(v):
    return int(v) if v == int(v) else v


def norm_edl(e, dur=0):
    if not isinstance(e, dict):
        return None
    d = _num(dur)
    lim = min(d, MAX_T) if d > 0 else MAX_T
    segs = []
    for p in (e.get('k') if isinstance(e.get('k'), list) else [])[:SEG_MAX * 4]:
        if not isinstance(p, list) or len(p) != 2:
            continue
        a, b = max(0.0, _num(p[0])), min(lim, _num(p[1]))
        if not (a >= 0) or not (b - a >= SEG_MIN):
            continue
        segs.append([r3(a), r3(b)])
    segs.sort(key=lambda s: (s[0], s[1]))
    k = []
    for s in segs:
        if k and s[0] <= k[-1][1] + JOIN_GAP:
            k[-1][1] = max(k[-1][1], s[1])
        else:
            k.append(list(s))
    ar = e.get('ar') if e.get('ar') in ARS else 'src'
    zv = _num(e.get('z'))
    z = min(Z_MAX, math.floor(zv * 20 + 0.5) / 20) if zv > 1 else 1
    crop = ar != 'src' or z > 1
    xv, yv = _num(e.get('x')), _num(e.get('y'))
    x = math.floor(xv * 100 + 0.5) / 100 if 0 <= xv <= 1 else 0.5
    y = math.floor(yv * 100 + 0.5) / 100 if 0 <= yv <= 1 else 0.5
    ex = {}
    if crop and y != 0.5:
        ex['y'] = y
    if z > 1:
        ex['z'] = z
    sp, rt = _num(e.get('sp')), _num(e.get('rt'))
    if sp in SPEEDS and sp != 1:
        ex['sp'] = e['sp']
    if rt in ROTS and rt != 0:
        ex['rt'] = e['rt']
    if e.get('fh') is True:
        ex['fh'] = True
    if e.get('fv') is True:
        ex['fv'] = True
    mu = e.get('mu') is True
    vo = _num(e.get('vo'))
    if not mu and 0 <= vo <= VOL_MAX and math.floor(vo + 0.5) != 100:
        ex['vo'] = int(math.floor(vo + 0.5))
    if mu:
        ex['mu'] = True
    for f in ('fi', 'fo'):
        fv = _num(e.get(f))
        if not mu and fv > 0:
            r = min(FADE_MAX, math.floor(fv * 2 + 0.5) / 2)
            if r:
                ex[f] = int(r) if r == int(r) else r
    if not mu and e.get('ln') is True:
        ex['ln'] = True
    # סבב 7 (עורך הווידאו ג׳): ניקוי רעש · בהירות / ניגודיות / רוויה · מסנן · טשטוש אזור · מעברים · תמונה ממוזערת
    if not mu and e.get('dn') in (1, 2) and e.get('dn') is not True:
        ex['dn'] = int(e['dn'])
    for f, lo, hi, st in (('br', -30, 30, 5), ('ct', -30, 30, 5), ('sa', -100, 100, 10)):
        v = _num(e.get(f))
        if lo <= v <= hi:
            r = int(math.floor(v / st + 0.5)) * st
            if r != 0:
                ex[f] = r
    if e.get('fx') in FXS:
        ex['fx'] = e['fx']
    bl = e.get('bl')
    if isinstance(bl, list) and len(bl) == 4:
        bx, by, bw, bh = (_int_if(math.floor(_num(v) * 100 + 0.5) / 100) if _num(v) == _num(v) else math.nan for v in bl)
        if bx >= 0 and by >= 0 and bw >= 0.05 and bh >= 0.05 and bx + bw <= 1.0001 and by + bh <= 1.0001:
            ex['bl'] = [bx, by, bw, bh]
    if e.get('tr') is True:
        ex['tr'] = True
    th = _num(e.get('th'))
    if 0 <= th <= MAX_T:
        ex['th'] = _int_if(math.floor(th * 10 + 0.5) / 10)
    whole = not k or (len(k) == 1 and k[0][0] <= JOIN_GAP and d > 0 and k[0][1] >= d - JOIN_GAP)
    if whole and ar == 'src' and not ex:
        return None
    if len(k) > SEG_MAX:
        return None
    return dict({'k': [] if whole else k, 'ar': ar, 'x': x if crop else 0.5}, **ex)


def pre(e):
    """לפני התרגום: רק החיתוך ויחס התמונה (מהירות, סיבוב ושמע — רק בהפקה מחדש)."""
    if not e:
        return None
    if not e['k'] and e['ar'] == 'src':
        return None
    return {'k': [list(p) for p in e['k']], 'ar': e['ar'], 'x': 0.5 if e['ar'] == 'src' else e['x']}


def out_dur(e, dur):
    """האורך של התוצאה — אחרי החיתוך ואחרי המהירות."""
    return r3(edl_dur(e, dur) / ((e or {}).get('sp') or 1))


def rot_dims(W, H, rt):
    return (H, W) if rt in (90, 270) else (W, H)


def speed_cues(cues, sp):
    """הכתוביות במהירות אחרת: הזמנים מתחלקים במהירות."""
    if not sp or sp == 1:
        return cues
    return [dict(c, start=r3(c['start'] / sp), end=r3(c['end'] / sp)) for c in cues]


def edl_dur(e, dur):
    if not e or not e['k']:
        d = _num(dur)
        return max(0.0, d) if d == d else 0.0
    return r3(sum(b - a for a, b in e['k']))


def map_time(e, t):
    if not e or not e['k']:
        return t
    off = 0.0
    for a, b in e['k']:
        if t < a:
            return None
        if t <= b:
            return r3(off + t - a)
        off += b - a
    return None


def map_cues(e, cues, min_dur=0.2):
    """כתוביות {start, end, …} (הפורמט של cues.final.json) → אחרי החיתוך: נחתכה כולה — יוצאת; נחתך ממנה רוב הזמן — החלק הארוך;
    נחתך ממנה מעט (סבב 4: מילת מילוי / שקט קצר באמצע) — מהחלק הראשון עד האחרון, ברצף. **זהה ל־mapCues בטלפון**"""
    if not e or not e['k']:
        return [dict(c) for c in cues]
    out = []
    for c in cues:
        best = first = last = None
        kept, off = 0.0, 0.0
        for a, b in e['k']:
            s, z = max(c['start'], a), min(c['end'], b)
            if z > s:
                p = (r3(off + s - a), r3(off + z - a))
                if first is None:
                    first = p
                last = p
                kept += z - s
                if best is None or z - s > best[1] - best[0]:
                    best = p
            off += b - a
        span = (first[0], last[1]) if first is not None and first is not last and kept >= (c['end'] - c['start']) * 0.5 else best
        if span and span[1] - span[0] >= min_dur:
            out.append(dict(c, start=span[0], end=span[1]))
    return out


def compose_edl(e0, e1):
    """e0 על המקור (לפני התרגום), e1 על התוצאה שלה (אחרי) → עריכה אחת על המקור.
    המיקום והזום — מהעריכה שקבעה את החיתוך; מהירות, סיבוב ושמע — מהאחרונה."""
    def copy(e):
        return dict(e, k=[list(p) for p in e['k']])
    if not e0:
        return copy(e1) if e1 else None
    if not e1:
        return copy(e0)
    if not e1['k']:
        k = [list(p) for p in e0['k']]
    elif not e0['k']:
        k = [list(p) for p in e1['k']]
    else:
        k = []
        for a1, b1 in e1['k']:
            off = 0.0
            for a0, b0 in e0['k']:
                ln = b0 - a0
                s, z = max(a1, off), min(b1, off + ln)
                if z - s > 1e-6:
                    k.append([r3(a0 + s - off), r3(a0 + z - off)])
                off += ln
    ar = e1['ar'] if e1['ar'] != 'src' else e0['ar']
    base = {'k': k, 'ar': ar, 'x': e1['x'] if e1['ar'] != 'src' else e0['x']}
    crop1 = e1['ar'] != 'src' or e1.get('z', 1) > 1
    src = e1 if crop1 else e0
    if crop1:
        base['x'] = e1['x']
    for f in EXTRA_POS:
        if f in src:
            base[f] = src[f]
    for f in EXTRA_REST:
        if f in e1:
            base[f] = e1[f]
    return base


def crop_box(W, H, ar, x, y=0.5, z=1):
    """W×H — אחרי הסיבוב. יחס יעד, מיקום x/y, זום z."""
    zz = z if z and z > 1 else 1
    if (ar == 'src' and zz == 1) or not (W > 0 and H > 0):
        return None

    def even(v):
        return max(2, int(v // 2) * 2)

    def pos(free, f):
        return int(math.floor(free * f / 2) * 2) if free >= 2 else 0
    bw, bh = W, H
    if ar != 'src':
        rw, rh = (int(v) for v in ar.split(':'))
        r = rw / rh
        if W / H > r:
            bw = H * r
        else:
            bh = W / r
    w, h = even(bw / zz), even(bh / zz)
    return {'w': w, 'h': h, 'x': pos(W - w, 0.5 if x is None else x), 'y': pos(H - h, 0.5 if y is None else y)}


# ---------------------------------------------------------------- ffmpeg
def probe(path, env=None):
    p = subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', str(path)],
                       capture_output=True, text=True, check=True, env=env)
    j = json.loads(p.stdout)
    st = j.get('streams') or []
    v = next((s for s in st if s.get('codec_type') == 'video' and not (s.get('disposition') or {}).get('attached_pic')), None)
    a = next((s for s in st if s.get('codec_type') == 'audio'), None)
    w, h = (int(v.get('width') or 0), int(v.get('height') or 0)) if v else (0, 0)
    # סרטון מהטלפון עם סימון סיבוב: ffmpeg מסובב בפענוח — המידות שהמסנן רואה הפוכות
    rot = 0
    for sd in (v or {}).get('side_data_list') or []:
        if isinstance(sd, dict) and 'rotation' in sd:
            rot = int(_num(sd['rotation'])) if _num(sd['rotation']) == _num(sd['rotation']) else 0
    if not rot:
        try:
            rot = int(((v or {}).get('tags') or {}).get('rotate') or 0)
        except ValueError:
            rot = 0
    if abs(rot) % 180 == 90:
        w, h = h, w
    d = _num(_flt((j.get('format') or {}).get('duration')))
    return {'w': w, 'h': h, 'v': bool(v), 'a': bool(a), 'dur': d if d > 0 else 0.0}


def _flt(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return math.nan


def atempo(sp):
    """atempo מקבל 0.5–2 בכל גרסה — מהירות מחוץ לטווח = שרשרת."""
    f = []
    while sp < 0.5:
        f.append(0.5)
        sp /= 0.5
    while sp > 2:
        f.append(2)
        sp /= 2
    if abs(sp - 1) > 1e-9:
        f.append(sp)
    return ['atempo=%.4f' % x for x in f]


def video_filters(e, W, H):
    """מהירות → סיבוב → היפוך → חיתוך → זום (חזרה לגודל בלי זום). W×H = המידות לפני הסיבוב."""
    f = []
    sp = e.get('sp') or 1
    if sp != 1:
        f.append('setpts=%.6f*PTS' % (1 / sp))
    rt = e.get('rt') or 0
    if rt in (90, 270):
        f.append('transpose=%d' % (1 if rt == 90 else 2))
    hf, vf = bool(e.get('fh')) != (rt == 180), bool(e.get('fv')) != (rt == 180)
    if hf:
        f.append('hflip')
    if vf:
        f.append('vflip')
    RW, RH = rot_dims(W, H, rt)
    cb = crop_box(RW, RH, e['ar'], e['x'], e.get('y', 0.5), e.get('z', 1))
    if cb:
        f.append('crop=%d:%d:%d:%d' % (cb['w'], cb['h'], cb['x'], cb['y']))
        if (e.get('z') or 1) > 1:
            full = crop_box(RW, RH, e['ar'], e['x'], e.get('y', 0.5), 1) or {'w': RW - RW % 2, 'h': RH - RH % 2}
            f.append('scale=%d:%d:flags=lanczos' % (full['w'], full['h']))
    # סבב 7: צבע — בהירות / ניגודיות / רוויה, ומסנן (רק מספרים וקודים מהקטלוג)
    br, ct, sa = e.get('br') or 0, e.get('ct') or 0, e.get('sa') or 0
    if br or ct or sa:
        f.append('eq=brightness=%.2f:contrast=%.2f:saturation=%.2f' % (br / 100, 1 + ct / 100, 1 + sa / 100))
    if e.get('fx') in FX_FILTERS:
        f.append(FX_FILTERS[e['fx']])
    return f


FX_FILTERS = {'bw': 'hue=s=0', 'warm': 'colorbalance=rs=.08:gs=.02:bs=-.08', 'cool': 'colorbalance=rs=-.06:bs=.08', 'vint': 'curves=preset=vintage'}
DN_FILTERS = {1: 'afftdn=nr=12:nf=-40', 2: 'afftdn=nr=24:nf=-35,highpass=f=80'}   # סבב 7: ניקוי רעש — קל / חזק
TR_DUR = 0.25            # סבב 7: מעבר (האפלה) בכל תפר — בלי לשנות את האורך (הכתוביות לא זזות)
LOGO_POS = ('tl', 'tr', 'bl', 'br')


def final_dims(e, W, H):
    """המידות של התמונה אחרי סיבוב / חיתוך / זום — לטשטוש אזור וללוגו"""
    RW, RH = rot_dims(W, H, e.get('rt') or 0)
    if (e.get('z') or 1) > 1:
        full = crop_box(RW, RH, e['ar'], e['x'], e.get('y', 0.5), 1)
        return (full['w'], full['h']) if full else (RW - RW % 2, RH - RH % 2)
    cb = crop_box(RW, RH, e['ar'], e['x'], e.get('y', 0.5), 1)
    return (cb['w'], cb['h']) if cb else (RW, RH)


def audio_filters(e, total):
    """מהירות → השוואת עוצמה → עוצמה → הדרגה. total = אורך התוצאה (להדרגה בסוף)."""
    f = ([DN_FILTERS[e['dn']]] if e.get('dn') in DN_FILTERS else []) + atempo(e.get('sp') or 1)   # סבב 7: ניקוי רעש לפני הכל
    if e.get('ln'):
        f += ['loudnorm=I=%d:TP=-1.5:LRA=11' % LUFS, 'aresample=48000']
    vo = e.get('vo')
    if vo is not None and vo != 100:
        f.append('volume=%.2f' % (vo / 100))
    fi, fo = e.get('fi') or 0, e.get('fo') or 0
    if fi:
        f.append('afade=t=in:st=0:d=%.2f' % fi)
    if fo and total > fo:
        f.append('afade=t=out:st=%.3f:d=%.2f' % (total - fo, fo))
    return f


def ffmpeg_args(src, out, e, info, audio_only=False, ov=None, logo=None):
    """הפקודה (רשימה, בלי shell): קטעים → concat, ואז מהירות / סיבוב / חיתוך / צבע / טשטוש / לוגו / שמע.
    רק מספרים וקודים מהעריכה נכנסים למסנן; הלוגו = קובץ (קלט שני), המיקום והגודל מ־ov (מנורמל)."""
    segs = e['k'] or None
    has_v, has_a = info.get('v') and not audio_only, info.get('a') and not e.get('mu')
    tr = bool(e.get('tr')) and segs and len(segs) > 1          # סבב 7: מעבר בכל תפר
    parts, vl, al = [], [], []
    for i, (a, b) in enumerate(segs or [[None, None]]):
        rng = ('=start=%.3f:end=%.3f' % (a, b)) if segs else ''
        if has_v:
            vx = (',fade=t=in:st=0:d=%.2f,fade=t=out:st=%.3f:d=%.2f' % (TR_DUR, max(0.0, b - a - TR_DUR), TR_DUR)) if tr else ''
            parts.append('[0:v]trim%s,setpts=PTS-STARTPTS%s[v%d]' % (rng, vx, i))
            vl.append('[v%d]' % i)
        if has_a:
            # סבב 4: כמה קטעים — הדרגה של 10ms בכל תפר (בלי "קליק" כשחותכים מילת מילוי באמצע משפט); סבב 7: עם מעבר — הדרגה של המעבר
            d = TR_DUR if tr else 0.01
            fx = (',afade=t=in:d=%.2f,afade=t=out:st=%.3f:d=%.2f' % (d, max(0.0, b - a - d), d)) if segs and len(segs) > 1 else ''
            parts.append('[0:a]atrim%s,asetpts=PTS-STARTPTS%s[a%d]' % (rng, fx, i))
            al.append('[a%d]' % i)
    n = len(segs or [0])
    if has_v and has_a:
        parts.append(''.join(x + y for x, y in zip(vl, al)) + 'concat=n=%d:v=1:a=1[vc][ac]' % n)
    elif has_v:
        parts.append(''.join(vl) + 'concat=n=%d:v=1:a=0[vc]' % n)
    elif has_a:
        parts.append(''.join(al) + 'concat=n=%d:v=0:a=1[ac]' % n)
    vout, aout = '[vc]', '[ac]'
    vf = video_filters(e, info.get('w') or 0, info.get('h') or 0) if has_v else []
    if vf:
        parts.append('[vc]' + ','.join(vf + ['setsar=1']) + '[vo]')
        vout = '[vo]'
    if has_v and (e.get('bl') or logo):
        FW, FH = final_dims(e, info.get('w') or 0, info.get('h') or 0)
        bl = e.get('bl')
        if bl and FW > 0 and FH > 0:            # סבב 7: טשטוש אזור (מלבן בשברים מהתמונה הסופית)
            ev = lambda v: max(2, int(v // 2) * 2)
            bw, bh = ev(bl[2] * FW), ev(bl[3] * FH)
            bx, by = min(int(bl[0] * FW) // 2 * 2, FW - bw), min(int(bl[1] * FH) // 2 * 2, FH - bh)
            parts.append('%ssplit=2[bla][blb];[blb]crop=%d:%d:%d:%d,gblur=sigma=%d[blc];[bla][blc]overlay=%d:%d[vbl]'
                         % (vout, bw, bh, max(0, bx), max(0, by), max(8, min(bw, bh) // 8), max(0, bx), max(0, by)))
            vout = '[vbl]'
        if logo and FW > 0:                      # סבב 7: לוגו בפינה (קלט שני)
            o = ov or {}
            lw = max(16, int(FW * (o.get('ls') or 14) / 100) // 2 * 2)
            m = int(FW * 0.03)
            lp = o.get('lp') if o.get('lp') in LOGO_POS else 'tr'
            xy = {'tl': (str(m), str(m)), 'tr': ('main_w-overlay_w-%d' % m, str(m)),
                  'bl': (str(m), 'main_h-overlay_h-%d' % m), 'br': ('main_w-overlay_w-%d' % m, 'main_h-overlay_h-%d' % m)}[lp]
            parts.append('[1:v]scale=%d:-2,format=rgba[lgo];%s[lgo]overlay=%s:%s[vlg]' % (lw, vout, xy[0], xy[1]))
            vout = '[vlg]'
    af = audio_filters(e, out_dur(e, info.get('dur') or 0)) if has_a else []
    if af:
        parts.append('[ac]' + ','.join(af) + '[ao]')
        aout = '[ao]'
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src)] + (['-i', str(logo)] if logo and has_v else []) + ['-filter_complex', ';'.join(parts)]
    if has_v:
        cmd += ['-map', vout, '-c:v', 'libx264', '-crf', '16', '-preset', 'veryfast', '-pix_fmt', 'yuv420p']
    if has_a:
        cmd += ['-map', aout, '-c:a', 'aac', '-b:a', '192k']
    return cmd + ['-movflags', '+faststart', str(out)]


def apply(src, out, e, audio_only=False, env=None, ov=None, logo=None):
    """מריץ את החיתוך. מחזיר את הנתיב (out)."""
    info = probe(src, env)
    subprocess.run(ffmpeg_args(src, out, e, info, audio_only, ov, logo), check=True, env=env)
    return Path(out)
