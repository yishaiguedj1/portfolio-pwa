"""איכויות צפייה לפי ת־נגן — בלי עותק כפול של הסרטון (10/10/2026).

האיכות הגבוהה = המקור עצמו: אותם זרמי וידאו וקול בדיוק (בלי קידוד מחדש), רק בסידור של MP4 מקוטע עם אינדקס (sidx)
בראש הקובץ — כך הנגן מבקש כל קטע לפי טווח בתים, וזה מחליף את הקובץ המקורי ב־Drive (לא קובץ נוסף).
האיכויות הנמוכות (144p…1440p, רק מתחת למקור) = H.264 קטן, עם מפתחות באותם רגעים של המקור — מעבר חלק בין איכויות.
הכל נעשה ברקע, במקביל לתרגום, בלי Claude ובלי טוקנים. סרטון שאי אפשר לארוז בלי אובדן — נשאר כמו שהוא (בלי איכויות).

הנגן בטלפון קורא את האינדקס מתחילת כל קובץ ובונה ממנו את רשימות ההשמעה (HLS עם טווחי בתים) — שום קובץ רשימות
לא נשמר, ואותו דבר יעבוד מ־R2 (קובץ אחד לכל איכות, בקשות טווח).
"""
import json
import os
import struct
import subprocess
from pathlib import Path

# גובה (הצלע הקצרה — אנכי 1080×1920 הוא "1080p", לפי ת־נגן), CRF ותקרת קצב (kbps) לכל איכות נמוכה
RUNGS = ((1440, 25, 6000), (1080, 26, 3200), (720, 27, 1600), (480, 28, 800), (360, 29, 500), (240, 30, 280), (144, 31, 140))
V_OK = ('h264', 'hevc', 'av1', 'vp9')            # נארזים בלי קידוד ומתנגנים ב־MSE של Chrome
A_OK = ('aac', 'opus', 'mp3', 'flac')           # הדפדפן מנגן אותם בעצמו — הקול נשאר בקובץ ומתנגן כמו שהוא
# 22/10/2026 (בקשת המשתמש: "לא לדרוס סאונד איכותי"): קול שהטלפון לא תמיד מנגן (Dolby, DTS, TrueHD, ALAC) נשאר במקור כמו שהוא —
# הקובץ נארז בלי קידוד כמו כל מקור, ולצידו נבנה עותק קול קטן ב־Opus רק לנגן (ALT). טלפון שמכיר את הקול המקורי מנגן אותו;
# אחר — הנגן מסיר את רצועת הקול מהקטעים תוך כדי (studioplay.js stripAudio) ומנגן את העותק כרצועת קול חלופית של HLS
A_ALT = ('ac3', 'eac3', 'alac', 'dts', 'truehd')
# 23/10/2026 (בקשת המשתמש): כמה רצועות קול (שפות / פרשנות) — כולן נשארות במקור בלי קידוד, ולכל אחת עותק Opus לנגן:
# ה־MSE של Chrome מנגן רק רצועת קול אחת מתוך הקובץ, אז הנגן מסיר את כולן מהקטעים ובוחר עותק (רצועת קול חלופית של HLS)
A_MAX = 4
GOP_MAX = 12.0                                   # מפתח לפחות כל 12 שנ׳ — אחרת קטעים ענקיים (קפיצה ומעבר איטיים)
A_LOW = '64k'
MOVFLAGS = '+frag_keyframe+empty_moov+default_base_moof+global_sidx'
WHY = ('streams', 'vcodec', 'acodec', 'gop', 'small', 'edl', 'probe', 'remux', 'verify', 'encode', 'time', 'alt')


def _streams(info):
    return [s for s in (info.get('streams') or []) if isinstance(s, dict)]


def summarize(info, gop):
    """תקציר של ffprobe: וידאו (קודק, מידות אחרי סיבוב), קול, שאר הזרמים, אורך, המרווח הגדול בין מפתחות."""
    vs = [s for s in _streams(info) if s.get('codec_type') == 'video' and not (s.get('disposition') or {}).get('attached_pic')]
    aus = [s for s in _streams(info) if s.get('codec_type') == 'audio']
    other = [s.get('codec_type') or '?' for s in _streams(info) if s.get('codec_type') not in ('video', 'audio', 'data')]
    v = vs[0] if vs else {}
    w, h = int(v.get('width') or 0), int(v.get('height') or 0)
    rot = 0
    for sd in v.get('side_data_list') or []:
        if isinstance(sd, dict) and 'rotation' in sd:
            try:
                rot = int(float(sd['rotation']))
            except (TypeError, ValueError):
                rot = 0
    if abs(rot) % 180 == 90:
        w, h = h, w
    try:
        dur = float((info.get('format') or {}).get('duration') or v.get('duration') or 0)
    except (TypeError, ValueError):
        dur = 0.0
    tracks = [_track(a) for a in aus]
    first = tracks[0] if tracks else {'c': '', 'ch': 0}
    return {'nv': len(vs), 'na': len(aus), 'other': other, 'v': v.get('codec_name') or '', 'a': first['c'],
            'ch': first['ch'], 'as': tracks, 'w': w, 'h': h, 'dur': dur, 'gop': gop}


def _track(a):
    """רצועת קול: קודק, ערוצים, שפה (קוד ISO בלבד — טקסט חופשי מהקובץ לא עובר), ברירת מחדל."""
    try:
        ch = int(a.get('channels') or 0)
    except (TypeError, ValueError):
        ch = 0
    lang = str((a.get('tags') or {}).get('language') or '').lower()
    lang = lang if len(lang) in (2, 3) and lang.isalpha() and lang.isascii() and lang not in ('und', 'mis', 'mul', 'zxx') else ''
    return {'c': a.get('codec_name') or '', 'ch': ch, 'l': lang, 'd': 1 if (a.get('disposition') or {}).get('default') else 0}


def plan(sm, edl=False):
    """טהורה: אפשר לארוז בלי אובדן? אילו איכויות נמוכות? עותק קול לנגן? → {'ok', 'why', 'short', 'rungs', 'alt'}"""
    def no(why):
        return {'ok': False, 'why': why, 'short': 0, 'rungs': [], 'alt': False}
    if edl:
        return no('edl')                         # חיתוך לפני התרגום — הנגן מנגן את הצריבה, לא את המקור
    if sm['nv'] != 1 or sm['na'] > A_MAX or sm['other']:
        return no('streams')                     # כתוביות / פרקים / קבצים מצורפים / יותר מ־A_MAX רצועות קול — לא נוגעים במקור
    if sm['v'] not in V_OK:
        return no('vcodec')
    if any(t['c'] not in A_OK + A_ALT for t in _tracks_of(sm)):
        return no('acodec')
    if not (0 < sm['gop'] <= GOP_MAX):
        return no('gop')
    short = min(sm['w'], sm['h'])
    rungs = [r for r in RUNGS if r[0] < short - 8]
    if short < 200 or not rungs:
        return no('small')
    return {'ok': True, 'why': '', 'short': short, 'rungs': rungs, 'alt': sm['na'] > 1 or (bool(sm['na']) and sm['a'] in A_ALT)}


def _tracks_of(sm):
    """הרצועות מהתקציר (תקציר ישן בלי 'as' — רצועה אחת מ־a/ch)"""
    if sm.get('as') is not None:
        return sm['as']
    return [{'c': sm['a'], 'ch': sm.get('ch') or 0, 'l': '', 'd': 1}] if sm['na'] else []


def probe(src, ffprobe='ffprobe'):
    r = subprocess.run([ffprobe, '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(src)], capture_output=True, text=True)
    info = json.loads(r.stdout or '{}')
    k = subprocess.run([ffprobe, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'packet=pts_time,flags', '-of', 'csv=p=0', str(src)],
                       capture_output=True, text=True)
    return summarize(info, max_gap(k.stdout))


def max_gap(csv, dur=None):
    """המרווח הגדול ביותר בין מפתחות (כולל עד סוף הסרטון) מהפלט של ffprobe ‎packet=pts_time,flags."""
    ks, last = [], 0.0
    for line in (csv or '').splitlines():
        p = line.split(',')
        try:
            t = float(p[0])
        except (ValueError, IndexError):
            continue
        last = max(last, t)
        if len(p) > 1 and 'K' in p[1]:
            ks.append(t)
    if not ks:
        return 0.0
    ks.sort()
    end = dur if dur else last
    gaps = [b - a for a, b in zip(ks, ks[1:])] + [max(0.0, end - ks[-1])]
    return round(max(gaps + [0.0]), 3)


def remux_cmd(src, out, sm, ffmpeg='ffmpeg'):
    """האיכות הגבוהה = המקור: אותם זרמים, MP4 מקוטע עם sidx בראש הקובץ (בלי קידוד)."""
    cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src), '-map', '0:v:0']
    for i in range(sm['na']):
        cmd += ['-map', '0:a:%d' % i]            # כל רצועות הקול, בסדר של המקור
    cmd += ['-c', 'copy', '-map_metadata', '-1', '-map_chapters', '-1']
    if sm['v'] == 'hevc':
        cmd += ['-tag:v', 'hvc1']                # Chrome מכיר hvc1 (לא hev1)
    if any(t['c'] in A_ALT for t in _tracks_of(sm)):
        # Dolby/DTS/TrueHD ב־MP4: ffmpeg צריך לראות מנות לפני כתיבת moov (delay_moov — בלעדיו "Cannot write moov atom before
        # EAC3 packets parsed"), ו־DTS/TrueHD מסומנים אצלו כניסיוניים ב־MP4 (‎-strict -2). הזרם עצמו מועתק כמו שהוא
        return cmd + ['-strict', '-2', '-movflags', MOVFLAGS.replace('+empty_moov', '+empty_moov+delay_moov'), '-f', 'mp4', str(out)]
    return cmd + ['-movflags', MOVFLAGS, '-f', 'mp4', str(out)]


def alt_layout(ch):
    """(פריסה, קצב) לעותק ה־Opus: מונו/סטריאו כמו שהם, ‏5.1 ו־7.1 נשמרים (Opus בפריסה תקנית — 5.1(side) של Dolby לא מתקבל
    ב־mapping family 1), 3–5 ערוצים → 5.1. כ־64kbps לערוץ (שקוף לאוזן ב־Opus), עד 448."""
    ch = int(ch or 2)
    if ch <= 1:
        return 'mono', 64
    if ch == 2:
        return 'stereo', 128
    if ch >= 8:
        return '7.1', 448
    return '5.1', 320


def alt_cmd(src, out, sm, ffmpeg='ffmpeg', i=0):
    """עותק הקול לנגן (רצועה i): Opus ב־MP4 מקוטע עם sidx (קטעים של 6 שנ׳) — רצועת קול חלופית של HLS, בלי וידאו."""
    tr = _tracks_of(sm)
    lay, kbps = alt_layout(tr[i]['ch'] if i < len(tr) else sm.get('ch'))
    return [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src), '-map', '0:a:%d' % i, '-vn', '-sn', '-dn',
            '-af', 'aformat=channel_layouts=' + lay, '-c:a', 'libopus', '-b:a', '%dk' % kbps] + \
           (['-mapping_family', '1'] if lay not in ('mono', 'stereo') else []) + \
           ['-map_metadata', '-1', '-map_chapters', '-1', '-frag_duration', '6000000', '-movflags', MOVFLAGS, '-f', 'mp4', str(out)]


def low_cmd(src, outdir, rungs, has_audio, ffmpeg='ffmpeg'):
    """כל האיכויות הנמוכות במעבר אחד (פענוח אחד): H.264, מפתחות ברגעים של המקור (מעבר חלק), קול AAC קטן."""
    n = len(rungs)
    lab = ['[s%d]' % i for i in range(n)]
    fc = '[0:v]split=%d%s' % (n, ''.join(lab)) if n > 1 else '[0:v]null[s0]'
    for i, (h, _, _) in enumerate(rungs):
        fc += ";[s%d]scale=w='if(gt(iw,ih),-2,%d)':h='if(gt(iw,ih),%d,-2)'[o%d]" % (i, h, h, i)
    cmd = [ffmpeg, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src), '-filter_complex', fc]
    for i, (h, crf, mx) in enumerate(rungs):
        cmd += ['-map', '[o%d]' % i]
        if has_audio:
            cmd += ['-map', '0:a:0', '-c:a', 'aac', '-b:a', A_LOW, '-ac', '2']
        cmd += ['-c:v', 'libx264', '-preset', 'veryfast', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-crf', str(crf),
                '-maxrate', '%dk' % mx, '-bufsize', '%dk' % (2 * mx), '-force_key_frames', 'source', '-g', '9999',
                '-x264-params', 'scenecut=0', '-map_metadata', '-1', '-movflags', MOVFLAGS, '-f', 'mp4', str(Path(outdir) / ('r%d.mp4' % h))]
    return cmd


# ---------------------------------------------------------------- MP4: אינדקס וקודקים (גם בטלפון — studioplay.js)
def boxes(b, start=0, end=None):
    """תיבות MP4 ברמה אחת: [(סוג, היסט, גודל, היסט התוכן)]"""
    end = len(b) if end is None else end
    i, out = start, []
    while i + 8 <= end:
        sz, t = struct.unpack('>I4s', b[i:i + 8])
        hd = 8
        if sz == 1 and i + 16 <= end:
            sz = struct.unpack('>Q', b[i + 8:i + 16])[0]
            hd = 16
        elif sz == 0:
            sz = end - i
        if sz < hd:
            break
        out.append((t.decode('latin-1'), i, sz, i + hd))
        i += sz
    return out


def sidx_index(b):
    """מהכותרת של הקובץ: סוף האתחול (ftyp+moov) ורשימת קטעים [(היסט, גודל, משך בשנ׳)] מה־sidx של רצועת הווידאו."""
    top = boxes(b)
    moov = next((x for x in top if x[0] == 'moov'), None)
    sid = next((x for x in top if x[0] == 'sidx'), None)
    if not moov or not sid or sid[1] + sid[2] > len(b):
        return None
    init_end = moov[1] + moov[2]
    o = sid[3]
    ver = b[o]
    p = o + 4
    _ref, ts = struct.unpack('>II', b[p:p + 8])
    p += 8
    if ver == 0:
        _ept, fo = struct.unpack('>II', b[p:p + 8])
        p += 8
    else:
        _ept, fo = struct.unpack('>QQ', b[p:p + 16])
        p += 16
    n = struct.unpack('>H', b[p + 2:p + 4])[0]
    p += 4
    off = sid[1] + sid[2] + fo
    segs = []
    for _ in range(n):
        a, d, _s = struct.unpack('>III', b[p:p + 12])
        p += 12
        size = a & 0x7fffffff
        segs.append((off, size, d / float(ts or 1)))
        off += size
    return init_end, segs


def _find(b, path, start=0, end=None):
    """תיבה לפי מסלול (moov/trak/…); מחזיר את הראשונה."""
    cur = (start, len(b) if end is None else end)
    hit = None
    for name in path:
        hit = next((x for x in boxes(b, cur[0], cur[1]) if x[0] == name), None)
        if not hit:
            return None
        cur = (hit[3], hit[1] + hit[2])
    return hit


def _tracks(b):
    moov = _find(b, ['moov'])
    if not moov:
        return []
    return [x for x in boxes(b, moov[3], moov[1] + moov[2]) if x[0] == 'trak']


def _stsd_entry(b, trak):
    st = _find(b, ['mdia', 'minf', 'stbl', 'stsd'], trak[3], trak[1] + trak[2])
    if not st:
        return None
    return boxes(b, st[3] + 8, st[1] + st[2])[:1]


def _rev_bits(x, n=32):
    r = 0
    for _ in range(n):
        r = (r << 1) | (x & 1)
        x >>= 1
    return r


def codecs(b):
    """מחרוזת CODECS (RFC 6381) מהכותרת: avc1.PPCCLL / hvc1.… / av01.… / vp09.… + mp4a.40.x / opus / mp4a.6B."""
    out = []
    for trak in _tracks(b):
        ent = _stsd_entry(b, trak)
        if not ent:
            continue
        typ, o, sz, c = ent[0]
        end = o + sz
        if typ in ('avc1', 'avc3', 'hvc1', 'hev1', 'av01', 'vp09'):
            kids = boxes(b, c + 78, end)
            k = {x[0]: x for x in kids}
            if 'avcC' in k:
                q = k['avcC'][3]
                out.append('%s.%02x%02x%02x' % (typ, b[q + 1], b[q + 2], b[q + 3]))
            elif 'hvcC' in k:
                q = k['hvcC'][3]
                ps = b[q + 1] >> 6
                tier = (b[q + 1] >> 5) & 1
                prof = b[q + 1] & 0x1f
                compat = struct.unpack('>I', b[q + 2:q + 6])[0]
                cons = list(b[q + 6:q + 12])
                level = b[q + 12]
                while cons and cons[-1] == 0:
                    cons.pop()
                s = '%s.%s%d.%x.%s%d' % (typ, ('', 'A', 'B', 'C')[ps], prof, _rev_bits(compat), 'H' if tier else 'L', level)
                out.append(s + ''.join('.%02x' % x for x in cons))
            elif 'av1C' in k:
                q = k['av1C'][3]
                prof = b[q + 1] >> 5
                lvl = b[q + 1] & 0x1f
                tier = b[q + 2] >> 7
                hb, twelve = (b[q + 2] >> 6) & 1, (b[q + 2] >> 5) & 1
                depth = 12 if hb and twelve else 10 if hb else 8
                out.append('av01.%d.%02d%s.%02d' % (prof, lvl, 'H' if tier else 'M', depth))
            elif 'vpcC' in k:
                q = k['vpcC'][3]
                out.append('vp09.%02d.%02d.%02d' % (b[q + 4], b[q + 5], b[q + 6] >> 4))
        elif typ == 'mp4a':
            es = next((x for x in boxes(b, c + 28, end) if x[0] == 'esds'), None)
            oti, aot = 0x40, 2
            if es:
                d = b[es[3] + 4:es[1] + es[2]]
                i = d.find(b'\x04')                    # DecoderConfigDescriptor
                if i >= 0:
                    j = i + 1
                    while j < len(d) and d[j] & 0x80:
                        j += 1
                    j += 1
                    oti = d[j] if j < len(d) else 0x40
                    k5 = d.find(b'\x05', j + 13)       # DecoderSpecificInfo
                    if k5 >= 0:
                        m = k5 + 1
                        while m < len(d) and d[m] & 0x80:
                            m += 1
                        m += 1
                        if m < len(d):
                            aot = d[m] >> 3 or 2
            out.append('mp4a.40.%d' % aot if oti == 0x40 else 'mp4a.%02X' % oti)
        elif typ == 'Opus':
            out.append('opus')
        elif typ in ('ac-3', 'ec-3', 'alac', 'mlpa'):
            out.append(typ)                      # RFC 6381: ac-3 / ec-3 (שאר הקודקים — לנגן רק כדי לדעת שהקול לא בשבילו)
        elif typ == 'fLaC':
            out.append('flac')
        elif typ in ('dtsc', 'dtsh', 'dtsl', 'dtse', 'dtsx'):
            out.append(typ)
        elif typ == '.mp3':
            out.append('mp4a.6B')
    return ','.join(out)


def dims(b):
    """רוחב וגובה של רצועת הווידאו (מהרשומה ב־stsd)."""
    for trak in _tracks(b):
        ent = _stsd_entry(b, trak)
        if ent and ent[0][0] in ('avc1', 'avc3', 'hvc1', 'hev1', 'av01', 'vp09'):
            c = ent[0][3]
            return struct.unpack('>HH', b[c + 24:c + 28])
    return 0, 0


def head(path, n=256 * 1024):
    with open(path, 'rb') as f:
        return f.read(n)


def describe(path, segs_hint=None):
    """לכל קובץ באיכות: מידות, קצב שיא וממוצע (bps), קודקים — מה שהנגן צריך לרשימה הראשית."""
    b = head(path)
    ix = sidx_index(b)
    if not ix:
        return None
    init_end, segs = ix
    dur = sum(s[2] for s in segs) or 1
    total = sum(s[1] for s in segs)
    # קצב שיא על חלונות של ~6 שנ׳ (כמו הקטעים שהנגן מקבץ)
    peak, acc_b, acc_t = 0.0, 0, 0.0
    for _o, size, d in segs:
        acc_b += size
        acc_t += d
        if acc_t >= 6:
            peak = max(peak, acc_b * 8 / acc_t)
            acc_b, acc_t = 0, 0.0
    if acc_t > 0:
        peak = max(peak, acc_b * 8 / max(acc_t, 1.0))
    w, h = dims(b)
    return {'bw': int(max(peak, total * 8 / dur)), 'abw': int(total * 8 / dur), 'c': codecs(b), 'size': os.path.getsize(path), 'w': w, 'h': h}


def verify_same(src, top, ffprobe='ffprobe', na=1):
    """האריזה לא איבדה כלום: אותו מספר מנות וידאו ובכל רצועת קול, ואותו אורך (עד 0.25 שנ׳)."""
    def cnt(p, sel):
        r = subprocess.run([ffprobe, '-v', 'error', '-select_streams', sel, '-count_packets', '-show_entries',
                            'stream=nb_read_packets:format=duration', '-of', 'json', str(p)], capture_output=True, text=True)
        j = json.loads(r.stdout or '{}')
        st = (j.get('streams') or [{}])
        return int((st[0] if st else {}).get('nb_read_packets') or -1), float((j.get('format') or {}).get('duration') or 0)
    v1, d1 = cnt(src, 'v:0')
    v2, d2 = cnt(top, 'v:0')
    same = all(cnt(src, 'a:%d' % i)[0] == cnt(top, 'a:%d' % i)[0] for i in range(max(1, na)))
    return v1 > 0 and v1 == v2 and same and abs(d1 - d2) <= 0.25


def build(src, outdir, edl=False, ffmpeg='ffmpeg', ffprobe='ffprobe', log=print, gate=None):
    """הכל: בדיקה, אריזת המקור, האיכויות הנמוכות, תיאור לכל קובץ. מחזיר {'ok', 'why', 'top', 'rungs'}.
    gate (22/10/2026, אפשרות א׳): נקרא אחרי שהמקור נארז ונבדק ולפני הקידוד של הנמוכות — מחכה לסוף הצריבה,
    כך שהקידוד הכבד לא מתחרה בה על המעבד (בפרק של 92 דק׳ הצריבה לקחה 32 דק׳ עם האיכויות ו־19 בלעדיהן)."""
    outdir = Path(outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    try:
        sm = probe(src, ffprobe)
    except (OSError, ValueError):
        return {'ok': False, 'why': 'probe'}
    pl = plan(sm, edl)
    if not pl['ok']:
        return {'ok': False, 'why': pl['why']}
    top = outdir / 'top.mp4'
    log('איכויות: אורזים את המקור (בלי קידוד)')
    if subprocess.run(remux_cmd(src, top, sm, ffmpeg)).returncode != 0 or not top.exists():
        return {'ok': False, 'why': 'remux'}
    if not verify_same(src, top, ffprobe, sm['na']):
        return {'ok': False, 'why': 'verify'}
    alts = []
    if pl['alt']:
        log('איכויות: עותק קול לנגן (Opus%s) — הקול המקורי נשאר בקובץ' % ('' if sm['na'] < 2 else ', %d רצועות' % sm['na']))
        for i in range(sm['na']):
            p = outdir / ('alt.mp4' if i == 0 else 'alt%d.mp4' % i)
            if subprocess.run(alt_cmd(src, p, sm, ffmpeg, i)).returncode != 0 or not p.exists():
                return {'ok': False, 'why': 'alt'}
            alts.append(p)
    if gate is not None:
        log('איכויות: המקור ארוז — הנמוכות מחכות לסוף הצריבה')
        gate()
    log('איכויות: ' + ' · '.join('%dp' % r[0] for r in pl['rungs']))
    if subprocess.run(low_cmd(src, outdir, pl['rungs'], sm['na'] > 0, ffmpeg)).returncode != 0:
        return {'ok': False, 'why': 'encode'}
    t = describe(top)
    if not t:
        return {'ok': False, 'why': 'remux'}
    t.update(w=sm['w'], h=sm['h'], f=str(top))     # מידות התצוגה (אחרי סיבוב) — ב־stsd הן לפני הסיבוב
    rungs = []
    for h, _, _ in pl['rungs']:
        p = outdir / ('r%d.mp4' % h)
        d = describe(p) if p.exists() else None
        if not d:
            return {'ok': False, 'why': 'encode'}
        d.update(f=str(p))                       # האיכויות הנמוכות כבר זקופות (ffmpeg מסובב בפענוח)
        rungs.append(d)
    out = {'ok': True, 'why': '', 'top': t, 'rungs': rungs}
    if alts:
        tr, lst = _tracks_of(sm), []
        dflt = next((i for i, t in enumerate(tr) if t.get('d')), 0)   # ברירת המחדל של המקור, אחרת הראשונה
        for i, p in enumerate(alts):
            a = describe(p)
            if not a or a['c'] != 'opus':
                return {'ok': False, 'why': 'alt'}
            a.update(f=str(p), ch=int(tr[i]['ch'] or 2) if i < len(tr) else 2)
            if i < len(tr) and tr[i].get('l'):
                a['l'] = tr[i]['l']
            if len(alts) > 1 and i == dflt:
                a['d'] = 1
            lst.append(a)
        out['alt'] = lst[0]                      # תאימות: ladder_finish ישן קורא רצועה אחת
        out['alts'] = lst
    return out
