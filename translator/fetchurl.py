"""הורדה מקישור (22/10/2026, בקשת המשתמש: "כל וידאו שקיים בתוך לינק" — כמו IDM).
המנוע = yt-dlp (מאות אתרים + מזהה כללי: קובץ ישיר, HLS/DASH, נגנים מוטמעים, og:video). יוטיוב דורש מנוע JavaScript
(Deno) — בתמונת העובד. בלי לקבע player_client: ברירת המחדל של yt-dlp מתחלפת כל כמה חודשים, והיא הנכונה
(מחקר 22/10/2026 — reports/עקיפת חסימות יוטיוב והורדה מכל אתר).

כאן רק לוגיקה טהורה + הרצה של yt-dlp כתהליך נפרד (בלי ייבוא שלו — הגרסה בתמונה מתעדכנת בנפרד):
  check_url   — קישור שמותר לפתוח: http/https, בלי משתמש/סיסמה, בלי כתובת פנימית (חומת האש של המארח חוסמת גם היא).
  summarize   — מהפלט של `yt-dlp -J` מסכם קטן ונקי לטלפון: שם, ערוץ, אורך, פרקים, כתוביות, איכויות עם גודל.
  choose      — הפורמט לכל איכות: "הכי קרוב למקור" = הזרם עם האיכות הכי גבוהה באותה רזולוציה, בלי קידוד מחדש.
  err_code    — שגיאה של yt-dlp → קוד קבוע (blocked/login/gone/geo/drm/live/unsupported/…), לא טקסט חופשי.
"""
import ipaddress
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from urllib.parse import urlsplit

URL_MAX = 2048
TITLE_MAX = 200
CH_MAX = 30
SUB_MAX = 40
FMT_MAX = 60
HEIGHTS = (2160, 1440, 1080, 720, 480, 360)
DEFAULT_H = 1080
PROBE_TIMEOUT = int(os.environ.get('SNB_PROBE_TIMEOUT', '75'))

# משפחת קודק → שם קבוע (הטלפון מסביר כל אחד בשפה פשוטה)
VC = (('av01', 'av1'), ('vp09', 'vp9'), ('vp9', 'vp9'), ('vp8', 'vp8'), ('avc', 'h264'), ('h264', 'h264'),
      ('hev', 'h265'), ('hvc', 'h265'), ('h265', 'h265'))
AC = (('opus', 'opus'), ('mp4a', 'aac'), ('aac', 'aac'), ('mp3', 'mp3'), ('vorbis', 'vorbis'), ('ac-3', 'ac3'),
      ('ec-3', 'eac3'), ('flac', 'flac'))
# איכות לכל ביט: AV1 ו־VP9 שומרים יותר פרטים באותו גודל — ביוטיוב הם הזרם עם האיכות הכי גבוהה
V_RANK = {'av1': 4, 'vp9': 3, 'h265': 3, 'h264': 2, 'vp8': 1}
A_RANK = {'opus': 3, 'flac': 3, 'aac': 2, 'eac3': 2, 'ac3': 1, 'vorbis': 1, 'mp3': 1}


def _fam(codec, table):
    c = str(codec or '').lower()
    if not c or c == 'none':
        return ''
    for pre, name in table:
        if c.startswith(pre):
            return name
    return 'other'


def extract_url(text):
    """מטקסט ששותף ("Check this out https://…") — הקישור הראשון. בלי קישור → ''."""
    m = re.search(r'https?://[^\s<>"\'‎‏]+', str(text or ''))
    return m.group(0).rstrip('.,;:!?)]}»') if m else ''


def _bad_ip(ip):
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return True
    if getattr(a, 'ipv4_mapped', None):
        a = a.ipv4_mapped
    return not a.is_global or a.is_multicast


def check_url(url, resolve=None):
    """קישור שמותר לפתוח → הקישור המנורמל, אחרת ValueError עם קוד. resolve(host) → רשימת כתובות (ברירת מחדל: DNS)."""
    u = str(url or '').strip()
    if not u or len(u) > URL_MAX or re.search(r'[\s\x00-\x1f\x7f]', u):
        raise ValueError('bad_url')
    p = urlsplit(u)
    if p.scheme not in ('http', 'https') or not p.hostname:
        raise ValueError('bad_url')
    if p.username or p.password:
        raise ValueError('bad_url')
    try:
        port = p.port
    except ValueError:
        raise ValueError('bad_url')
    if port not in (None, 80, 443, 8080, 8443):
        raise ValueError('bad_url')
    host = p.hostname.lower().rstrip('.')
    if host in ('localhost',) or host.endswith(('.localhost', '.local', '.internal', '.lan', '.home.arpa')):
        raise ValueError('private')
    try:
        ipaddress.ip_address(host)
        literal = True
    except ValueError:
        literal = False
    if literal:
        if _bad_ip(host):
            raise ValueError('private')
        return u
    if '.' not in host:
        raise ValueError('bad_url')
    try:
        addrs = resolve(host) if resolve else sorted({i[4][0] for i in socket.getaddrinfo(host, None)})
    except (OSError, UnicodeError):
        raise ValueError('dns')
    if not addrs:
        raise ValueError('dns')
    if any(_bad_ip(a) for a in addrs):
        raise ValueError('private')
    return u


def _size(f, dur):
    for k in ('filesize', 'filesize_approx'):
        v = f.get(k)
        if isinstance(v, (int, float)) and v > 0:
            return int(v)
    tbr = f.get('tbr') or ((f.get('vbr') or 0) + (f.get('abr') or 0))
    if isinstance(tbr, (int, float)) and tbr > 0 and dur:
        return int(tbr * 125 * dur)
    return 0


def _clean(s, n):
    s = re.sub(r'[\x00-\x1f\x7f‪-‮⁦-⁩]', ' ', str(s or ''))
    return re.sub(r'\s+', ' ', s).strip()[:n]


def _fmt_rows(info):
    """כל הפורמטים בצורה קבועה: id, k (v/a/av), h, fps, c (קודק וידאו), ac (קודק קול), hdr, sz, br, lang, orig."""
    dur = info.get('duration') or 0
    lang0 = str(info.get('language') or '').lower()
    rows = []
    for f in info.get('formats') or []:
        fid = str(f.get('format_id') or '')
        if not fid or not re.match(r'^[\w.+-]{1,60}$', fid):
            continue
        note = str(f.get('format_note') or '').lower()
        if f.get('has_drm') or 'storyboard' in note or f.get('ext') == 'mhtml':
            continue
        if 'drc' in note or fid.endswith('-drc'):                 # "Dynamic Range Compression" — קול דחוס, לא המקור
            continue
        # 'none' = אין זרם כזה; None = לא ידוע (נגנים כלליים, TED, קובץ ישיר) — מניחים שיש
        rv, ra = f.get('vcodec'), f.get('acodec')
        vc = '' if rv == 'none' else _fam(rv, VC) or 'other'
        ac = '' if ra == 'none' else _fam(ra, AC) or 'other'
        h = f.get('height') if isinstance(f.get('height'), int) else 0
        if not vc and not ac:
            continue
        k = 'av' if vc and ac else 'v' if vc else 'a'
        lang = str(f.get('language') or '').lower()[:10]
        rows.append({
            'id': fid, 'k': k, 'h': h if vc else 0, 'fps': int(round(f.get('fps') or 0)) if vc else 0,
            'c': vc, 'ac': ac, 'hdr': 1 if str(f.get('dynamic_range') or 'SDR').upper() not in ('SDR', '') else 0,
            'sz': _size(f, dur), 'br': int(round(f.get('abr') or 0)) if k == 'a' else int(round(f.get('tbr') or 0)),
            'lang': lang, 'orig': 1 if 'original' in note or (lang0 and lang == lang0) else 0,
            'm3u8': 1 if 'm3u8' in str(f.get('protocol') or '') else 0,
        })
    return rows


def best_audio(rows):
    """הקול הכי טוב: השפה המקורית (בסרטון עם כמה דיבובים), Opus לפני AAC, הקצב הכי גבוה."""
    aud = [r for r in rows if r['k'] == 'a']
    if not aud:
        return None
    has_orig = any(r['orig'] for r in aud)
    return max(aud, key=lambda r: (r['orig'] if has_orig else 0, A_RANK.get(r['ac'], 0) * 64 + min(r['br'], 400) / 8, -r['m3u8']))


def best_video(rows, h):
    """הזרם עם האיכות הכי גבוהה בגובה h (בדיוק; אין — הגבוה ביותר מתחתיו). SDR לפני HDR (HDR נצרב בצבעים דהויים),
    AV1/VP9 לפני H.264, הקצב הכי גבוה, הורדה ישירה לפני HLS. מחזיר (שורה, צריך קול נפרד?)."""
    vid = [r for r in rows if r['k'] in ('v', 'av') and r['h']]
    if not vid:
        return None
    at = [r for r in vid if r['h'] == h] or [r for r in vid if r['h'] < h]
    if not at:
        at = [min(vid, key=lambda r: r['h'])]
    top = max(r['h'] for r in at)
    at = [r for r in at if r['h'] == top]
    return max(at, key=lambda r: (1 - r['hdr'], r['k'] == 'v', V_RANK.get(r['c'], 0), r['fps'], r['br'], -r['m3u8']))


def options(rows, dur):
    """איכויות לבחירה: לכל גובה שקיים — הזרם הכי טוב + הקול הכי טוב, עם גודל משוער. בלי כפילויות."""
    a = best_audio(rows)
    out, seen = [], set()
    heights = sorted({r['h'] for r in rows if r['k'] in ('v', 'av') and r['h']}, reverse=True)
    for h in heights:
        v = best_video(rows, h)
        if not v or v['id'] in seen:
            continue
        seen.add(v['id'])
        need_a = v['k'] == 'v' and a is not None
        sz = v['sz'] + (a['sz'] if need_a else 0)
        out.append({'h': v['h'], 'v': v['id'], 'a': a['id'] if need_a else '', 'c': v['c'], 'ac': a['ac'] if need_a else v['ac'],
                    'fps': v['fps'], 'hdr': v['hdr'], 'sz': sz})
    if not out:
        # קובץ ישיר / נגן בלי גובה ידוע — אפשרות אחת: "הכי טוב שיש"
        v = max((r for r in rows if r['k'] in ('v', 'av')), key=lambda r: (r['k'] == 'av', r['br'], r['sz']), default=None)
        if v:
            need_a = v['k'] == 'v' and a is not None
            out.append({'h': 0, 'v': v['id'], 'a': a['id'] if need_a else '', 'c': v['c'], 'ac': a['ac'] if need_a else v['ac'],
                        'fps': v['fps'], 'hdr': v['hdr'], 'sz': v['sz'] + (a['sz'] if need_a else 0)})
    return out


def recommended(opts):
    """המומלץ: 1080p (או הכי קרוב מתחתיו; אין — הכי גבוה שיש)."""
    if not opts:
        return None
    below = [o for o in opts if o['h'] <= DEFAULT_H]
    return max(below, key=lambda o: o['h']) if below else min(opts, key=lambda o: o['h'])


def subs_list(info):
    """כתוביות: של היוצר (a=0) בכל השפות, ואוטומטיות (a=1) רק בשפה המקורית — יוטיוב מתרגם אוטומטית לכל השפות."""
    out = []
    lang0 = str(info.get('language') or '').lower()
    for auto, key in ((0, 'subtitles'), (1, 'automatic_captions')):
        for lang, tracks in (info.get(key) or {}).items():
            l = str(lang or '')
            if not re.match(r'^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$', l) or l.lower() == 'live_chat':
                continue
            if auto and not (l.lower() == lang0 or l.lower().endswith('-orig')):
                continue
            name = ''
            if isinstance(tracks, list) and tracks:
                name = _clean((tracks[0] or {}).get('name'), 60)
            out.append({'l': l[:20], 'n': name, 'a': auto})
            if len(out) >= SUB_MAX:
                return out
    return out


def summarize(info):
    """הסיכום שעובר לטלפון (ולשרתון): צורה קבועה, טקסטים נקיים וקצרים, בלי קישורים חתומים לקבצים."""
    if not isinstance(info, dict):
        raise ValueError('fail')
    if info.get('_type') in ('playlist', 'multi_video') and not info.get('formats'):
        raise ValueError('playlist')
    if info.get('is_live') or info.get('live_status') in ('is_live', 'is_upcoming', 'post_live'):
        raise ValueError('live')
    rows = _fmt_rows(info)
    if not rows:
        raise ValueError('drm' if info.get('_has_drm') else 'no_video')
    dur = int(round(info.get('duration') or 0))
    opts = options(rows, dur)
    rec = recommended(opts)
    a = best_audio(rows)
    ch = []
    for c in (info.get('chapters') or [])[:CH_MAX]:
        try:
            st = max(0, int(round(float(c.get('start_time') or 0))))
        except (TypeError, ValueError):
            continue
        t = _clean(c.get('title'), 80)
        if t:
            ch.append([st, t])
    ud = str(info.get('upload_date') or '')
    return {
        't': _clean(info.get('title') or info.get('fulltitle'), TITLE_MAX) or 'video',
        'u': str(info.get('webpage_url') or '')[:URL_MAX],
        's': _clean(info.get('extractor_key') or info.get('extractor'), 40),
        'up': _clean(info.get('uploader') or info.get('channel'), 100),
        'd': dur,
        'ud': ud if re.match(r'^\d{8}$', ud) else '',
        'lang': str(info.get('language') or '')[:10],
        'ch': ch,
        'sub': subs_list(info),
        'q': opts,
        'rec': rec['h'] if rec else 0,
        'ao': {'id': a['id'], 'ac': a['ac'], 'br': a['br'], 'sz': a['sz']} if a else None,
        'fm': [{k: r[k] for k in ('id', 'k', 'h', 'fps', 'c', 'ac', 'hdr', 'sz', 'br')} for r in
               sorted(rows, key=lambda r: (-r['h'], r['k'] != 'v', -V_RANK.get(r['c'], 0), -r['br']))][:FMT_MAX],
        'drm': 1 if info.get('_has_drm') else 0,
        '_th': thumb_url(info),                     # לא עובר לטלפון — העובד מקטין לתמונה קטנה (th) ומוחק
    }


def thumb_url(info):
    """תמונת הסרטון ברוחב הכי קרוב ל־480 (מספיק לכרטיס; לא מורידים 4K בשביל תמונה קטנה)."""
    best, bd = '', 1e9
    for t in info.get('thumbnails') or []:
        u, w = str((t or {}).get('url') or ''), (t or {}).get('width') or 0
        if not u.startswith(('https://', 'http://')) or u.endswith('.webp') and not w:
            continue
        d = abs((w or 480) - 480)
        if d < bd:
            best, bd = u, d
    u = best or str(info.get('thumbnail') or '')
    return u if u.startswith(('https://', 'http://')) and len(u) <= URL_MAX else ''


TH_MAX = 70 * 1024


def thumb_data(url, opener=None, run=subprocess.run):
    """תמונה קטנה (320px, JPEG) כ־data: — הטלפון מציג בלי לפנות לאתר חיצוני (CSP, פרטיות). כל תקלה → ''."""
    import base64
    import tempfile
    import urllib.request
    try:
        check_url(url)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with (opener or urllib.request.urlopen)(req, timeout=10) as r:
            raw = r.read(3 * 1024 * 1024 + 1)
        if not raw or len(raw) > 3 * 1024 * 1024:
            return ''
        vb = os.environ.get('VT_BIN', '')
        ff = os.path.join(vb, 'ffmpeg') if vb and os.path.isfile(os.path.join(vb, 'ffmpeg')) else 'ffmpeg'
        with tempfile.TemporaryDirectory() as d:
            src, dst = os.path.join(d, 'in'), os.path.join(d, 'out.jpg')
            with open(src, 'wb') as f:
                f.write(raw)
            run([ff, '-v', 'error', '-y', '-i', src, '-vf', 'scale=320:-2', '-frames:v', '1', '-q:v', '6', dst],
                capture_output=True, timeout=20, check=True)
            with open(dst, 'rb') as f:
                out = f.read()
        b = 'data:image/jpeg;base64,' + base64.b64encode(out).decode()
        return b if len(b) <= TH_MAX else ''
    except Exception:     # noqa: BLE001 — תמונה היא קישוט; בלעדיה הכרטיס מציג סמל
        return ''


def probe_full(url, ref=''):
    """מה שהסוכן שולח לשרתון: הסיכום + תמונה קטנה, או {'error': קוד}. ref = הדף שבו נמצא הקובץ (דפדפן הציד)."""
    try:
        u = check_url(extract_url(url) or url)
        s = probe(u, ref=ref_ok(ref))
    except ValueError as e:
        return {'error': str(e)}
    th = s.pop('_th', '')
    s['th'] = thumb_data(th) if th else ''
    return s


def selector(pick):
    """הבחירה מהטלפון → בורר פורמט של yt-dlp. קודם המזהים המדויקים מהבדיקה, ואם השתנו בינתיים — אותו גובה,
    ואחר כך הכי טוב שיש. pick = {'v': id, 'a': id, 'h': גובה} או {'audio': 1}."""
    pick = pick or {}
    safe = lambda s: s if re.match(r'^[\w.+-]{1,60}$', str(s or '')) else ''
    if pick.get('audio'):
        a = safe(pick.get('a'))
        return (a + '/' if a else '') + 'bestaudio/best'
    v, a = safe(pick.get('v')), safe(pick.get('a'))
    h = pick.get('h') if isinstance(pick.get('h'), int) and 100 <= pick.get('h') <= 4320 else DEFAULT_H
    exact = (v + '+' + a) if v and a else v
    fall = 'bv*[height<=%d]+ba/b[height<=%d]/bv*+ba/b' % (h, h)
    return (exact + '/' if exact else '') + fall


def audio_selector(pick):
    """רק הקול (לתמלול מהר, לפני שהסרטון גמר לרדת)."""
    a = (pick or {}).get('a')
    a = a if re.match(r'^[\w.+-]{1,60}$', str(a or '')) else ''
    return (a + '/' if a else '') + 'bestaudio/best'


# שגיאה של yt-dlp → קוד קבוע. הסדר חשוב (הראשון שמתאים)
ERR_RULES = (
    ('drm', re.compile(r'\bDRM\b|drm protected|widevine', re.I)),
    ('blocked', re.compile(r"confirm you.?re not a bot|sign in to confirm|HTTP Error 429|too many requests|po.?token|blocked", re.I)),
    ('login', re.compile(r'only works when logged.in|private video|members.only|join this channel|login required|log in|sign in to view|age.restricted|confirm your age|requires authentication', re.I)),
    ('geo', re.compile(r'available in your country|geo.?restrict|geoblock', re.I)),
    ('live', re.compile(r'live event will begin|is live|premieres in|this live', re.I)),
    ('gone', re.compile(r'video unavailable|has been removed|does not exist|HTTP Error 404|HTTP Error 410|no longer available|account.*terminated', re.I)),
    ('unsupported', re.compile(r'unsupported url|no video formats found|unable to extract', re.I)),
    ('timeout', re.compile(r'timed out|timeout', re.I)),
    ('net', re.compile(r'unable to download webpage|connection (reset|refused)|name or service not known|temporary failure in name resolution|network is unreachable|ssl', re.I)),
)


def err_code(text):
    t = str(text or '')
    for code, rx in ERR_RULES:
        if rx.search(t):
            return code
    return 'fail'


def ytdlp_base():
    """הפקודה הבסיסית: yt-dlp מהסביבה של העובד, בלי קבצי הגדרות מבחוץ, מטמון נגן ב־/cache (חוסך בקשה בכל הורדה).
    קצב עדין (מחקר: 5–10 שנ׳ בין בקשות). העוגיות של החשבון הייעודי — רק ליוטיוב, דרך yt_cookies (לא כאן)."""
    py = os.environ.get('VT_PY') or sys.executable
    cmd = [py, '-m', 'yt_dlp', '--ignore-config', '--no-playlist', '--no-progress', '--no-color',
           '--socket-timeout', '20', '--retries', '5', '--fragment-retries', '10', '--extractor-retries', '2',
           '--sleep-requests', '1']
    cache = os.environ.get('SNB_YTDLP_CACHE') or (os.environ.get('XDG_CACHE_HOME', '') and os.path.join(os.environ['XDG_CACHE_HOME'], 'yt-dlp'))
    cmd += ['--cache-dir', cache] if cache else ['--no-cache-dir']
    vb = os.environ.get('VT_BIN', '')
    if vb and os.path.isfile(os.path.join(vb, 'ffmpeg')):
        cmd += ['--ffmpeg-location', vb]
    return cmd


YT_RE = re.compile(r'(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$', re.I)
CK_BAD_RE = re.compile(r'cookies are no longer valid|cookies? (have|has) (likely )?been rotated', re.I)


def yt_host(url):
    """יוטיוב (כל הכתובות שלו) — זהה ל־ytHost ב־studio.js"""
    try:
        return bool(YT_RE.search(urlsplit(str(url or '').strip()).hostname or ''))
    except ValueError:
        return False


POT_HOME = os.environ.get('SNB_POT_HOME', '/opt/bgutil/server')


def pot_args(url):
    """25/10/2026: PO token ליוטיוב (bgutil, script-deno — רץ רק כשיוטיוב מבקש token). רק לקישורי יוטיוב, ורק כשהסקריפט
    בתמונה (באמד64; בלי — yt-dlp ממשיך בלעדיו). לבד הוא לא עוקף חסימה של חוות שרתים — יחד עם החשבון הייעודי (YtCookies)"""
    home = os.environ.get('SNB_POT_HOME', POT_HOME)
    if not yt_host(url) or not os.path.isfile(os.path.join(home, 'src', 'generate_once.ts')):
        return []
    return ['--extractor-args', 'youtubepot-bgutilscript:server_home=' + home]


class YtCookies:
    """25/10/2026: חשבון יוטיוב ייעודי בשרת (SNB_YT_COOKIES — הקובץ שהסוכן מושך מהשרתון, 0600). רק לקישורי יוטיוב.
    yt-dlp כותב את העוגיות בחזרה לקובץ — לכן עותק פרטי לכל הרצה (בדיקה והורדה במקביל לא כותבות לאותו קובץ), ובסוף
    הצלחה העותק המעודכן מחליף את המשותף (רק אם הגרסה לא התחלפה בינתיים) ומסומן לשליחה לשרתון (ck.dirty). התוצאה
    (הצליח / נחסם / לא מחובר / העוגיות פגו) נכתבת ל־ck.rep — הסוכן מדווח. העוגיות עצמן לא מודפסות לעולם."""

    def __init__(self, url):
        self.tmp = self.v = None
        self.args = []
        path = os.environ.get('SNB_YT_COOKIES', '')
        if not path or not yt_host(url) or not os.path.isfile(path):
            return
        self.path = path
        d = os.path.dirname(path)
        try:
            with open(os.path.join(d, 'ck.v')) as f:
                self.v = int(f.read().strip() or 0)
            with open(path, 'rb') as f:
                self.orig = f.read()
            fd, self.tmp = tempfile.mkstemp(prefix='.ck.', dir=d)
            with os.fdopen(fd, 'wb') as f:
                f.write(self.orig)
        except (OSError, ValueError):
            self.tmp = None
            return
        if self.v:
            # מחקר 25/10/2026: לחשבון מחובר — קצב שמרני (‏‎-t sleep‎ של yt-dlp: 10–20 שנ׳ לפני הורדה). בבדיקה (בלי הורדה) — לא חל
            self.args = ['--cookies', self.tmp, '--sleep-interval', '5', '--max-sleep-interval', '10']

    def _rep(self, ok, code=''):
        try:
            with open(os.path.join(os.path.dirname(self.path), 'ck.rep'), 'w') as f:
                json.dump({'ok': ok, 'code': code, 'v': self.v}, f)
        except OSError:
            pass

    def done(self, ok, err=''):
        if not self.tmp:
            return
        d = os.path.dirname(self.path)
        try:
            if ok:
                self._rep(True)
                with open(self.tmp, 'rb') as f:
                    new = f.read()
                with open(os.path.join(d, 'ck.v')) as f:
                    same_v = int(f.read().strip() or 0) == self.v
                if new != self.orig and same_v and new.startswith(b'# Netscape HTTP Cookie File'):
                    os.chmod(self.tmp, 0o600)
                    os.replace(self.tmp, self.path)
                    self.tmp = None
                    open(os.path.join(d, 'ck.dirty'), 'w').close()
            else:
                code = 'ck' if CK_BAD_RE.search(err or '') else err_code(err)
                if code in ('blocked', 'login', 'ck'):
                    self._rep(False, code)
        except (OSError, ValueError):
            pass
        finally:
            if self.tmp:
                try:
                    os.unlink(self.tmp)
                except OSError:
                    pass
                self.tmp = None


def ref_ok(ref):
    """Referer מהטלפון → רק http(s) תקין, בלי רווחים ותווי בקרה (נשלח ככותרת), אחרת ''."""
    r = str(ref or '').strip()
    return r if len(r) <= 2048 and re.match(r'^https?://[^\s\x00-\x1f\x7f]+$', r) else ''


def ref_args(ref):
    """שלב 2 (דפדפן הציד): קובץ שנמצא בדף — הרבה שרתים נותנים אותו רק עם ה־Referer וה־Origin של הדף"""
    r = ref_ok(ref)
    if not r:
        return []
    o = re.match(r'^(https?://[^/?#]+)', r).group(1)
    return ['--add-headers', 'Referer:' + r, '--add-headers', 'Origin:' + o]   # ‎--referer מיושן ב־yt-dlp


def probe(url, run=subprocess.run, timeout=PROBE_TIMEOUT, ref=''):
    """בדיקת קישור: yt-dlp -J (בלי הורדה) → summarize. כשל → ValueError(קוד)."""
    yc = YtCookies(url)
    try:
        r = run(ytdlp_base() + yc.args[:2] + pot_args(url) + ref_args(ref) + ['-J', '--skip-download', '--', url], capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        yc.done(False)
        raise ValueError('timeout')
    except OSError:
        yc.done(False)
        raise ValueError('no_tool')
    if r.returncode != 0 or not (r.stdout or '').strip():
        yc.done(False, r.stderr)
        raise ValueError(err_code(r.stderr))
    yc.done(True)
    try:
        info = json.loads(r.stdout)
    except ValueError:
        raise ValueError('fail')
    return summarize(info)


# 26/10/2026 (מאגר הלמידה — "כתוביות אנושיות שכבר קיימות למקור"): כתוביות של היוצר (לא האוטומטיות) בעברית ובאנגלית,
# כייחוס — chrF מול מתרגם אנושי ו־WER של התמלול, בכל עבודה מקישור שיש לה כאלה. רק טקסט, בלי הורדת הסרטון.
REF_LANGS = {'he': ('he', 'iw', 'he-il', 'iw-il'), 'en': ('en', 'en-us', 'en-gb', 'en-ca', 'en-au')}
REF_TIMEOUT = int(os.environ.get('SNB_REF_TIMEOUT', '90'))
REF_MAX_BYTES = 2 * 1024 * 1024


def ref_pick(names):
    """שמות הקבצים ש־yt-dlp כתב (ref.<שפה>.srt) → {he: שם, en: שם}; הקוד המדויק קודם לגרסה האזורית"""
    out = {}
    for want, codes in REF_LANGS.items():
        for code in codes:
            hit = [n for n in names if n.lower() == 'ref.' + code + '.srt']
            if hit:
                out[want] = hit[0]
                break
    return out


def get_subs(url, out_dir, run=subprocess.run, timeout=REF_TIMEOUT, ref=''):
    """הכתוביות האנושיות (של היוצר) בעברית ובאנגלית → {he: נתיב, en: נתיב} (מה שיש). כל כשל → {} — זה מידע משני."""
    os.makedirs(out_dir, exist_ok=True)
    yc = YtCookies(url)
    cmd = (ytdlp_base() + yc.args[:2] + pot_args(url) + ref_args(ref)
           + ['--skip-download', '--write-subs', '--no-write-auto-subs', '--sub-langs', 'he.*,iw.*,en.*,-live_chat',
              '--sub-format', 'srt/vtt/best', '--convert-subs', 'srt', '-o', os.path.join(out_dir, 'ref.%(ext)s'), '--', url])
    try:
        r = run(cmd, capture_output=True, text=True, timeout=timeout)
    except (subprocess.TimeoutExpired, OSError):
        yc.done(False)
        return {}
    yc.done(r.returncode == 0, r.stderr or '')
    try:
        names = os.listdir(out_dir)
    except OSError:
        return {}
    got = {}
    for lang, name in ref_pick(names).items():
        p = os.path.join(out_dir, name)
        try:
            if 0 < os.path.getsize(p) <= REF_MAX_BYTES:
                got[lang] = p
        except OSError:
            pass
    return got


PROG_RE = re.compile(r'^SNBP (\d+|NA) (\d+|NA) (\d+|NA)')


def download(url, pick, out_tmpl, kind='v', section=None, on_progress=None, popen=subprocess.Popen, timeout=6 * 3600, ref=''):
    """הורדה: kind 'a' = רק הקול, 'v' = וידאו + קול ממוזגים בלי קידוד מחדש (MKV — מקבל כל צירוף קודקים).
    section = (מ, עד) בשניות — רק החלק הזה (yt-dlp חותך על פריימי מפתח; sync.py מיישר את הקול). מחזיר את הנתיב."""
    yc = YtCookies(url)
    cmd = ytdlp_base() + yc.args + pot_args(url) + ref_args(ref) + ['--newline', '--progress', '--progress-template',
                          'download:SNBP %(progress.downloaded_bytes)s %(progress.total_bytes)s %(progress.total_bytes_estimate)s',
                          '--no-mtime', '--continue','--concurrent-fragments', '4',
                          '--max-filesize', '40G', '-o', out_tmpl, '--print', 'after_move:filepath']
    if kind == 'a':
        # -x: כשאין זרם קול נפרד (קובץ משולב) — מחלצים את הקול בלי לקודד (העתקה; קודק אחר → הקרוב בלי איבוד)
        cmd += ['-f', audio_selector(pick), '-x']
    else:
        cmd += ['-f', selector(pick), '--merge-output-format', 'mkv']
    if section and len(section) == 2:
        a, b = (max(0, int(section[0])), max(0, int(section[1])))
        if b > a:
            cmd += ['--download-sections', '*%d-%d' % (a, b)]
    cmd += ['--', url]
    try:
        return _download(cmd, on_progress, popen, timeout, yc)
    finally:
        yc.done(False)                         # אחרי הצלחה / כישלון זה כבר לא עושה כלום (tmp נמחק)


def _download(cmd, on_progress, popen, timeout, yc):
    t0 = time.time()
    p = popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, bufsize=1)
    path, last = '', 0.0
    for line in p.stdout:
        line = line.strip()
        m = PROG_RE.match(line)
        if m:
            got = int(m.group(1)) if m.group(1) != 'NA' else 0
            tot = int(m.group(2)) if m.group(2) != 'NA' else int(m.group(3)) if m.group(3) != 'NA' else 0
            now = time.time()
            if on_progress and tot and now - last >= 2:
                last = now
                on_progress(min(1.0, got / tot), got, tot)
        elif line.startswith('/'):
            path = line
        if time.time() - t0 > timeout:
            p.kill()
            raise ValueError('timeout')
    err = p.stderr.read() if p.stderr else ''
    if p.wait() != 0 or not path or not os.path.isfile(path):
        yc.done(False, err)
        raise ValueError(err_code(err))
    yc.done(True)
    return path


def main(argv):
    """שימוש ידני / בדיקה: python3 fetchurl.py probe <קישור>  → JSON של הסיכום."""
    if len(argv) >= 3 and argv[1] == 'probe':
        ref = argv[4] if len(argv) >= 5 and argv[3] == '--ref' else ''
        r = probe_full(argv[2], ref)
        print(json.dumps(r, ensure_ascii=False))
        return 1 if r.get('error') else 0
    print('usage: fetchurl.py probe <url>')
    return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv))
