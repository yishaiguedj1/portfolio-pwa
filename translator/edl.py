"""מ4–מ5 (10/10/2026): רשימת העריכות (EDL) של עורך הווידאו — חיתוך ויחס תמונה.

**אותה לוגיקה בדיוק כמו studioedl.js בטלפון ו־normEdl בשרתון** (tests/studio-edl.test.js משווה):
  { "k": [[a, b], …] — הקטעים שנשארים בזמן המקור (ריק = הכל), "ar": "src" | "9:16" | "1:1" | "4:5", "x": 0–1 }
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


def _num(v):
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return math.nan
    return float(v) if math.isfinite(v) else math.nan


def r3(x):
    """כמו Math.round(x * 1000) / 1000 ב־JS (חצי — כלפי מעלה, לא עיגול בנקאי)."""
    return math.floor(x * 1000 + 0.5) / 1000


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
    xv = _num(e.get('x'))
    x = math.floor(xv * 100 + 0.5) / 100 if 0 <= xv <= 1 else 0.5
    whole = not k or (len(k) == 1 and k[0][0] <= JOIN_GAP and d > 0 and k[0][1] >= d - JOIN_GAP)
    if whole and ar == 'src':
        return None
    if len(k) > SEG_MAX:
        return None
    return {'k': [] if whole else k, 'ar': ar, 'x': 0.5 if ar == 'src' else x}


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
    """כתוביות {start, end, …} (הפורמט של cues.final.json) → אחרי החיתוך; נחתכה באמצע — החלק הארוך."""
    if not e or not e['k']:
        return [dict(c) for c in cues]
    out = []
    for c in cues:
        best, off = None, 0.0
        for a, b in e['k']:
            s, z = max(c['start'], a), min(c['end'], b)
            if z - s > ((best[1] - best[0]) if best else 0):
                best = (r3(off + s - a), r3(off + z - a))
            off += b - a
        if best and best[1] - best[0] >= min_dur:
            out.append(dict(c, start=best[0], end=best[1]))
    return out


def compose_edl(e0, e1):
    """e0 על המקור (לפני התרגום), e1 על התוצאה שלה (אחרי) → עריכה אחת על המקור."""
    if not e0:
        return {'k': [list(p) for p in e1['k']], 'ar': e1['ar'], 'x': e1['x']} if e1 else None
    if not e1:
        return {'k': [list(p) for p in e0['k']], 'ar': e0['ar'], 'x': e0['x']}
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
    return {'k': k, 'ar': ar, 'x': e1['x'] if e1['ar'] != 'src' else e0['x']}


def crop_box(W, H, ar, x):
    if ar == 'src' or not (W > 0 and H > 0):
        return None
    rw, rh = (int(v) for v in ar.split(':'))
    r = rw / rh

    def even(v):
        return max(2, int(v // 2) * 2)
    if W / H > r:
        w = even(H * r)
        return {'w': w, 'h': even(H), 'x': even((W - w) * x), 'y': 0}
    h = even(W / r)
    return {'w': even(W), 'h': h, 'x': 0, 'y': even((H - h) / 2)}


# ---------------------------------------------------------------- ffmpeg
def probe(path, env=None):
    p = subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', str(path)],
                       capture_output=True, text=True, check=True, env=env)
    st = json.loads(p.stdout).get('streams') or []
    v = next((s for s in st if s.get('codec_type') == 'video' and not (s.get('disposition') or {}).get('attached_pic')), None)
    a = next((s for s in st if s.get('codec_type') == 'audio'), None)
    return {'w': int(v.get('width') or 0) if v else 0, 'h': int(v.get('height') or 0) if v else 0, 'v': bool(v), 'a': bool(a)}


def ffmpeg_args(src, out, e, info, audio_only=False):
    """הפקודה (רשימה, בלי shell): קטעים → concat, ואז crop. רק מספרים מהעריכה נכנסים למסנן."""
    segs = e['k'] or None
    has_v, has_a = info.get('v') and not audio_only, info.get('a')
    parts, vl, al = [], [], []
    for i, (a, b) in enumerate(segs or [[None, None]]):
        rng = ('=start=%.3f:end=%.3f' % (a, b)) if segs else ''
        if has_v:
            parts.append('[0:v]trim%s,setpts=PTS-STARTPTS[v%d]' % (rng, i))
            vl.append('[v%d]' % i)
        if has_a:
            parts.append('[0:a]atrim%s,asetpts=PTS-STARTPTS[a%d]' % (rng, i))
            al.append('[a%d]' % i)
    n = len(segs or [0])
    if has_v and has_a:
        parts.append(''.join(x + y for x, y in zip(vl, al)) + 'concat=n=%d:v=1:a=1[vc][ac]' % n)
    elif has_v:
        parts.append(''.join(vl) + 'concat=n=%d:v=1:a=0[vc]' % n)
    elif has_a:
        parts.append(''.join(al) + 'concat=n=%d:v=0:a=1[ac]' % n)
    vout = '[vc]'
    cb = crop_box(info.get('w') or 0, info.get('h') or 0, e['ar'], e['x']) if has_v else None
    if cb:
        parts.append('[vc]crop=%d:%d:%d:%d,setsar=1[vo]' % (cb['w'], cb['h'], cb['x'], cb['y']))
        vout = '[vo]'
    cmd = ['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src), '-filter_complex', ';'.join(parts)]
    if has_v:
        cmd += ['-map', vout, '-c:v', 'libx264', '-crf', '16', '-preset', 'veryfast', '-pix_fmt', 'yuv420p']
    if has_a:
        cmd += ['-map', '[ac]', '-c:a', 'aac', '-b:a', '192k']
    return cmd + ['-movflags', '+faststart', str(out)]


def apply(src, out, e, audio_only=False, env=None):
    """מריץ את החיתוך. מחזיר את הנתיב (out)."""
    info = probe(src, env)
    subprocess.run(ffmpeg_args(src, out, e, info, audio_only), check=True, env=env)
    return Path(out)
