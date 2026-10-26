"""הסוכן של השרת (מצב "API של המערכת") — לולאה ששואלת את השרתון אם יש עבודה, מריצה אותה ומנקה אחריה.

אבטחה — למה כך:
  • השרת לא פותח אף פורט. הוא זה שפונה החוצה (poll), ולכן אין לאן להתחבר אליו מבחוץ.
  • הזדהות מול השרתון: טוקן שרת (SNB_WORKER_TOKEN) בכותרת Authorization — השרתון שומר רק את ה־hash שלו.
  • כתובת השרתון מרשימה סגורה בקוד (job.SERVERS — הייצור וסביבת הניסוי); חוץ ממנה רק localhost, לבדיקות.
  • עבודה אחת בכל רגע. בסוף כל עבודה — מחיקה של כל קובצי העבודה (סרטונים, תמלילים, תרגומים): הם חיים
    ב־Drive של המשתמש, לא על השרת.
  • המפתחות (ANTHROPIC_API_KEY, SNB_WORKER_TOKEN) מגיעים ממשתני הסביבה של הקונטיינר ולא מודפסים לעולם.

קובץ /work/.busy קיים בזמן עבודה — כך המעדכן (snb-update) לא מחליף גרסה באמצע תרגום.
"""

from __future__ import annotations

import collections
import hashlib
import json
import os
import platform
import random
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import job as J  # noqa: E402

TOKEN_RE = re.compile(r'^[A-Za-z0-9_-]{32,128}$')
POLL_S = float(os.environ.get('SNB_POLL_S', '20'))
MAX_BACKOFF_S = 300
RUN_TIMEOUT_S = 15 * 60
AUTO_TIMEOUT_S = int(os.environ.get('SNB_JOB_TIMEOUT_S', str(10 * 3600)))
BUSY = J.VT_WORK / '.busy'

_stop = False


def _on_term(signum, frame):        # noqa: ARG001
    global _stop
    _stop = True


def server_url() -> str:
    s = os.environ.get('SNB_SERVER', J.SERVER)
    if s not in J.SERVERS and not J.LOCAL_RE.match(s):
        raise SystemExit('✗ שרת לא מוכר (מותרים רק השרתונים שבקוד — job.SERVERS — או localhost לבדיקות).')
    return s.rstrip('/')


def token() -> str:
    t = os.environ.get('SNB_WORKER_TOKEN', '')
    if not TOKEN_RE.match(t):
        raise SystemExit('✗ חסר SNB_WORKER_TOKEN תקין בסודות של השרת.')
    return t


_net_prev = [0.0, 0, 0]              # 22/10/2026: (שניות, קבלה, שליחה) של הדגימה הקודמת — לקצב הרשת


def net_bytes():
    """בייטים מצטברים (קבלה, שליחה) של כל הממשקים חוץ מ־lo — /proc/net/dev. בלי הקובץ — None"""
    rx = tx = 0
    try:
        for ln in Path('/proc/net/dev').read_text().splitlines()[2:]:
            name, _, rest = ln.partition(':')
            if not rest or name.strip() == 'lo':
                continue
            f = rest.split()
            rx += int(f[0])
            tx += int(f[8])
    except (OSError, ValueError, IndexError):
        return None
    return rx, tx


def rate_pair(t0, rx0, tx0, t1, rx1, tx1):
    """קצב (בייטים לשנייה) בין שתי דגימות. ריק כשאין בסיס, הזמן לא זז, או המונה ירד (אתחול) — לא מנחשים"""
    dt = t1 - t0
    if not t0 or dt <= 0 or rx1 < rx0 or tx1 < tx0:
        return {}
    return {'rx': round((rx1 - rx0) / dt), 'tx': round((tx1 - tx0) / dt)}


def net_rate() -> dict:
    """קצב הרשת מאז הדגימה הקודמת (rx/tx בבייטים לשנייה). נקרא מ־host_info בלבד — כל קריאה מעדכנת את הבסיס"""
    cur = net_bytes()
    if cur is None:
        return {}
    now = time.time()
    t0, rx0, tx0 = _net_prev
    _net_prev[:] = [now, cur[0], cur[1]]
    return rate_pair(t0, rx0, tx0, now, cur[0], cur[1])


def host_info(busy: str = '') -> dict:
    """מצב השרת למסך השרת באפליקציה — מספרים בלבד (בלי שמות קבצים, בלי תוכן). כל ערך שלא נמדד — לא נשלח."""
    hb = {'v': os.environ.get('SNB_VERSION', 'dev')[:12], 'busy': busy}
    if busy:                          # 15/10/2026: הדופק עם השלב הנוכחי (מ־prog.json של job.py)
        pr = _prog()
        if re.match(r'^[a-z0-9_-]{1,24}$', str(pr.get('st') or '')):
            hb['st'] = pr['st']
            if isinstance(pr.get('p'), (int, float)):
                hb['p'] = round(pr['p'], 3)
    # ת2: האם הקופסה רצה בליבה מדומה (gVisor מחזיר release שמסתיים ב־gvisor), ואם לא — למה (snb_runtime במארח)
    hb['iso'] = 'g' if platform.release().endswith('gvisor') else 'r'
    why = os.environ.get('SNB_ISO_WHY', '')
    if hb['iso'] == 'r' and why in ('mem', 'missing', 'selftest', 'manual'):
        hb['iw'] = why
    # שלב 4.1: מנוע היישור — o = גרפי ONNX INT8 בתמונה (/opt/aligner), t = torch (בלי גרפים / SNB_ALIGN=torch)
    al_dir = os.environ.get('SNB_ALIGN_ONNX') or '/opt/aligner'
    hb['al'] = 't' if os.environ.get('SNB_ALIGN', '').lower() == 'torch' or not os.path.isfile(os.path.join(al_dir, 'manifest.json')) else 'o'
    try:
        du = shutil.disk_usage(str(J.VT_WORK if J.VT_WORK.exists() else '/'))
        hb['disk'] = round(100 * du.used / du.total, 1)
        hb['free'] = round(du.free / 1e9, 1)
    except OSError:
        pass
    try:
        hb['load'] = round(os.getloadavg()[0], 2)
    except OSError:
        pass
    # 22/10/2026: מדדי הניטור (היסטוריה במסך הניטור): מעבד %, קצב רשת, לחץ זיכרון. דגימה אחת לכל קריאה — met_sample לוקח מכאן
    cu = cpu_pct()
    if cu is not None:
        hb['cu'] = cu
    hb.update(net_rate())
    psi = mem_pressure()
    if psi:
        hb['psi'] = psi
    hb['cpu'] = cpus_allowed()                      # 21/10/2026: לצפי (השרתון מנרמל זמנים לפי הליבות) ולמסך השרת
    if _slots:
        hb['nj'] = len(_slots)
    lim = mem_limit_mb()
    if lim:
        hb['mx'] = lim
    try:
        mi = dict(ln.split(':', 1) for ln in Path('/proc/meminfo').read_text().splitlines() if ':' in ln)
        tot, av = int(mi['MemTotal'].split()[0]), int(mi['MemAvailable'].split()[0])
        hb['mem'] = round(100 * (tot - av) / tot, 1)
        hb['up'] = int(float(Path('/proc/uptime').read_text().split()[0]))
    except (OSError, KeyError, ValueError, ZeroDivisionError):
        pass
    return hb


_events: collections.deque = collections.deque(maxlen=12)
_ev_lock = threading.Lock()          # הדופק רץ בחוט נפרד — קריאה באמצע הוספה הייתה זורקת RuntimeError


def ev(code: str):
    """ת7: יומן השרת — אירוע (קוד מהקטלוג SRV_EV בשרתון) נשלח בכל פנייה ומוצג במסך השרת באפליקציה.
    אותו קוד ברצף (למשל השרתון לא זמין שוב ושוב) — רק מעדכן את הזמן, לא ממלא את היומן."""
    t = int(time.time())
    with _ev_lock:
        if _events and _events[-1][1] == code and code in ('net', 'auth'):
            _events[-1] = [t, code]
        else:
            _events.append([t, code])


def ev_list() -> list:
    with _ev_lock:
        return [list(x) for x in _events]


# 20/10/2026: מצב העבודה (/state) נמחק בהפעלה מחדש של הקונטיינר — report_lost לא מוצא אותו. לכן הפנייה הראשונה
# אחרי העלייה (boot) אומרת לשרתון לבדוק בעצמו: עבודה שהוא נתן לשרת הזה ועוד "רצה" — נקטעה.
_boot = True


def _set_booted():
    global _boot
    _boot = False


# 26/10/2026: הדיסק בשרת הגיע ל־89% (תמונות עובד ישנות). עבודה שמתחילה בלי מקום נופלת באמצע (הורדה, צריבה,
# איכויות — כמה GB לסרטון ארוך). פחות מזה פנוי = לא לוקחים עבודה חדשה (רק דופק); השרתון ממשיך לראות אותנו,
# והעבודה מחכה בתור עד ש־snb-update מפנה תמונות. 0 = כבוי
DISK_MIN_GB = float(os.environ.get('SNB_DISK_MIN_GB', '8') or 0)
_disk_low_said = False


def disk_low() -> bool:
    """פחות מ־DISK_MIN_GB פנויים בדיסק של העבודות (= הדיסק של השרת). שגיאה במדידה = לא חוסמים"""
    if DISK_MIN_GB <= 0:
        return False
    try:
        du = shutil.disk_usage(str(J.VT_WORK if J.VT_WORK.exists() else '/'))
    except OSError:
        return False
    return du.free / 1e9 < DISK_MIN_GB


def poll(server: str, tok: str, op: str = 'poll', busy: str = '', fit: dict | None = None) -> dict:
    """{'job': {'id', 'key', 'kind'}} או {'job': None}. שגיאה → {'error': ...} (הלולאה מחכה ומנסה שוב).
    op='beat' — רק דופק (באמצע עבודה), בלי לבקש עבודה. fit — כשכבר רצה עבודה: כמה זיכרון פנוי לעוד אחת (הזמנה).
    אין מקום בדיסק (disk_low) — בקשת עבודה הופכת לדופק בלבד."""
    global _disk_low_said
    held = op == 'poll' and disk_low()
    if held:
        op = 'beat'
        if not _disk_low_said:
            print('· פחות מ־' + str(int(DISK_MIN_GB)) + 'GB פנויים בדיסק — לא לוקחים עבודה חדשה עד שיתפנה מקום', flush=True)
        _disk_low_said = True
    elif op == 'poll':
        _disk_low_said = False
    try:
        hb = host_info(busy)
        hb['ev'] = ev_list()
        if held:
            hb['dl'] = 1                 # מסך השרת: "לא לוקח עבודות — הדיסק מלא"
        body = {'op': op, 'v': 1, 'hb': hb}
        if fit:
            body['fit'] = fit
        if op == 'poll' and _boot:
            body['boot'] = True      # 20/10/2026: הפנייה הראשונה אחרי העלייה — השרתון מסמן עבודה שנקטעה אצלנו (worker_lost)
        st, j, hd = J.http('POST', server + '/api/studio', body,
                           headers={'Authorization': 'Bearer ' + tok}, timeout=30)
    except (OSError, ValueError) as e:
        return {'error': 'network', 'detail': type(e).__name__}
    if st == 401:
        return {'error': 'auth'}          # הטוקן בוטל (השרת הוסר באפליקציה) — מחכים הרבה, לא מציפים
    if st == 200 and j.get('ok'):
        if op == 'poll':
            _set_booted()
        jb = j.get('job')
        if isinstance(jb, dict) and J.JOB_RE.match(str(jb.get('id') or '')) and J.KEY_RE.match(str(jb.get('key') or '')):
            out = {'id': jb['id'], 'key': jb['key'], 'kind': jb.get('kind') or 'tr'}
            if isinstance(jb.get('dur'), (int, float)) and 0 < jb['dur'] <= 86400:
                out['dur'] = jb['dur']                 # 21/10/2026: אורך הסרטון — להזמנת הזיכרון
            return {'job': out}
        return {'job': None, 'paused': j.get('paused') is True, 'disk': held}
    return {'error': 'http_' + str(st)}


ALIVE = J.STATE.parent / 'alive'
BEAT_S = 300


def heartbeat():
    """דופק: קובץ alive (בדיקת הבריאות של Docker) + פינג החוצה לשירות ניטור אופציונלי (למשל healthchecks.io),
    שמתריע כשהשרת מפסיק לפעום. רץ בחוט נפרד — גם באמצע עבודה של שעתיים. בלי פורט פתוח."""
    try:
        ALIVE.parent.mkdir(parents=True, exist_ok=True)
        ALIVE.write_text(str(int(time.time())))
    except OSError:
        pass
    url = os.environ.get('SNB_HEARTBEAT_URL', '')
    if not url.startswith('https://'):
        return
    try:
        urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': J.UA}), timeout=10).close()
    except OSError:
        pass


_busy = ''
_slots: dict = {}                   # 21/10/2026: העבודות שרצות במקביל — מספר משבצת → Slot


_cpu_prev = [0, 0]


def cpu_pct():
    """אחוז המעבד מאז הדגימה הקודמת (/proc/stat, כל הליבות)"""
    try:
        f = [int(x) for x in Path('/proc/stat').read_text().splitlines()[0].split()[1:]]
    except (OSError, ValueError, IndexError):
        return None
    idle, tot = f[3] + (f[4] if len(f) > 4 else 0), sum(f)
    pi, pt = _cpu_prev
    _cpu_prev[:] = [idle, tot]
    if not pt or tot <= pt:
        return None
    return round(100 * (1 - (idle - pi) / (tot - pt)), 1)


MET_TOP_MEM = 80                    # מעל אחוז זיכרון זה — גם התהליכים הכבדים (שם + MB) בדגימה


def mem_stat() -> dict:
    """memory.stat של ה־cgroup (MB): ma = anon (זיכרון של תהליכים), mf = file (מטמון קבצים, ניתן לפינוי), msh = shmem.
    בלי cgroup v2 (או תחת gVisor בלי הקובץ) — ריק"""
    try:
        kv = dict(ln.split() for ln in Path('/sys/fs/cgroup/memory.stat').read_text().splitlines() if ln.count(' ') == 1)
    except (OSError, ValueError):
        return {}
    out = {}
    for src, dst in (('anon', 'ma'), ('file', 'mf'), ('shmem', 'msh')):
        try:
            out[dst] = int(kv[src]) // 1048576
        except (KeyError, ValueError):
            pass
    return out


def top_procs(n: int = 5) -> list:
    """התהליכים עם הכי הרבה זיכרון: רק שם התהליך (comm) ו־MB — בלי שורת פקודה (שמות קבצים)"""
    try:
        page = os.sysconf('SC_PAGE_SIZE')
    except (ValueError, OSError):
        page = 4096
    out = []
    for d in Path('/proc').iterdir() if Path('/proc').is_dir() else []:
        if not d.name.isdigit():
            continue
        try:
            st = (d / 'stat').read_text()
            comm = re.sub(r'[^\w.:@+-]', '_', st[st.index('(') + 1:st.rindex(')')])[:24]
            out.append({'c': comm, 'r': int(int((d / 'statm').read_text().split()[1]) * page / 1048576)})
        except (OSError, ValueError, IndexError):
            continue
    return sorted(out, key=lambda x: -x['r'])[:n]


def met_sample() -> dict:
    hb = host_info(_busy)
    mi = _meminfo()
    d = {'t': int(time.time()), 'cpu': hb.get('cu'), 'mem': hb.get('mem'), 'disk': hb.get('disk'), 'free': hb.get('free'), 'load': hb.get('load'),
         # 21/10/2026 (מהיומנים): "100%" בלי התקרה לא אומר כמה GB; PSI = כמה זמן תהליכים חיכו לזיכרון (האות שמקדים OOM)
         'mx': mem_limit_mb() or None, 'av': int(mi['MemAvailable'] / 1024) if mi.get('MemAvailable') else None,
         'psi': mem_pressure() or None, 'pq': PQ_ST or None, 'pqn': PQ_N or None}
    ms = mem_stat()                     # 21/10/2026: anon (תהליכים) מול file (מטמון קבצים) — מכריע אם "100%" הוא זיכרון אמיתי או מטמון
    if ms:
        d.update(ms)
    if _busy:
        pr = _prog()
        d.update({'j': _busy, 'st': str(pr.get('st') or '')[:24], 'p': pr.get('p')})
        if _child['pid']:
            d['rss'] = sum(x.get('rss') or 0 for x in proc_snapshot(_child['pid']))
    if _slots:                          # במשבצות _child של הסוכן ריק — rss היה תמיד 0. עכשיו לכל משבצת
        kids, sl = _children(), []
        for x in list(_slots.values()):
            if x.p and x.p.poll() is None:
                pr = _prog(x.state)
                sl.append({'j': x.id, 'st': str(pr.get('st') or '')[:24], 'p': pr.get('p'), 'rss': int(tree_rss_mb(x.p.pid, kids))})
        if sl:
            d['sl'] = sl
            d['rss'] = sum(x['rss'] for x in sl) * 1048576
    if (d.get('mem') or 0) >= MET_TOP_MEM:
        d['top'] = top_procs()
    return {k: v for k, v in d.items() if v not in (None, '')}


def beat_loop(server: str = '', tok: str = ''):
    """כל דקה: דגימת מדדים (האיסוף המלא); כל BEAT_S: הדופק (קובץ alive + beat לשרתון — עם השלב הנוכחי);
    כל MET_FLUSH דגימות: מנה לשרתון. השרתון ענה שהדגל כבוי — מנסים שוב רק אחרי שעה (הדגימות נזרקות)"""
    smp, n, quiet_until = [], 0, 0.0
    cpu_pct()
    while not _stop:
        if n % max(1, BEAT_S // MET_S) == 0:
            heartbeat()
            if server and _busy:
                poll(server, tok, 'beat', _busy)      # באמצע עבודה: מסך השרת יודע שהוא חי, על מה הוא עובד ובאיזה שלב
        n += 1
        if server and tok and time.time() >= quiet_until:
            try:
                smp.append(met_sample())
            except Exception:     # noqa: BLE001
                pass
            if len(smp) >= MET_FLUSH:
                j = dev_send(server, tok, 'devMet', {'smp': smp, 'ver': os.environ.get('SNB_VERSION', 'dev')[:12], 'cores': os.cpu_count() or 1})
                smp = []
                if not j.get('saved'):
                    quiet_until = time.time() + 3600
        for _ in range(MET_S):
            if _stop:
                return
            time.sleep(1)


def report_lost():
    """הסוכן עלה ומצא סימן של עבודה שרצה (.busy) — השרת הופעל מחדש באמצע (עדכון snb-update, כיבוי, docker restart).
    בלי הדיווח העבודה נשארת "רצה" עד STALE_MS (שעתיים) ורק אז נכשלת. worker_lost = תקלה חולפת בשרתון: חלון התאוששות
    ואז "המשך" אוטומטי מנקודת השמירה. המפתח מקובץ המצב של job.py; דיווח שנכשל — לא עוצר את העלייה."""
    if not BUSY.exists():
        return False
    try:
        st = J.load_state()
        if not st or st.get('job') != BUSY.read_text().strip():
            return False
        # 21/10/2026: סימן של שלב כבד שלא נוקה = נפל באמצע היישור (כמעט תמיד זיכרון). עדיין worker_lost (חולף) — כי ה"המשך"
        # רץ עכשיו במצב חיסכון (job.py heavy_mark) ולא יפול שוב באותו מקום
        heavy = sorted(p.name.split('.')[1] for p in J.HEAVY_DIR.glob(J.vt_slug(st['job']) + '.*.json')) if J.HEAVY_DIR.is_dir() else []
        msg = ('השרת נפל באמצע ' + {'align': 'היישור'}.get(heavy[0], heavy[0]) + ' (כנראה נגמר הזיכרון) — ממשיכים במצב חיסכון') if heavy else 'השרת הופעל מחדש באמצע העבודה'
        J.Ctx(st).report(fail=True, err='worker_lost', msg=msg, force=True)
        print('· עבודה ' + str(st.get('job', ''))[:6] + '… נקטעה בהפעלה מחדש — דווחה (תמשיך לבד מנקודת השמירה)', flush=True)
        ev('lost')
        return True
    except BaseException:     # noqa: BLE001 — אין קובץ מצב / השרתון לא זמין: העבודה תיתפס כ"נתקעה" כמו קודם
        return False


def cleanup():
    """מחיקה של כל מה שהעבודה השאירה על הדיסק — כולל הסרטונים. המודלים (מטמון) נשארים."""
    J.ladder_stop()                              # איכויות הצפייה רצות בתהליך נפרד — לא ממשיכות לכתוב אחרי המחיקה
    shutil.rmtree(J.STATE.parent / 'ladder', ignore_errors=True)   # שארית מגרסה קודמת (שם היא מילאה את /state)
    w = J.VT_WORK
    if w.is_dir():
        for p in w.iterdir():
            if p.name == '.busy':
                continue
            if p.is_dir():
                shutil.rmtree(p, ignore_errors=True)
            else:
                try:
                    p.unlink()
                except OSError:
                    pass
    st = J.STATE.parent
    if st.is_dir():
        for name in ('job.json', 'prog.json', 'tower.json', 'setup.pid', 'job.tmp'):
            try:
                (st / name).unlink()
            except OSError:
                pass


def _kill_group(pgid: int):
    """כל התהליכים שהעבודה פתחה (vt, ffmpeg, onnx) — לא רק job.py. בלי זה, עבודה שחרגה מהזמן השאירה את vt רץ
    (וממשיך לכתוב לדיסק ולתפוס מעבד) גם אחרי שהעבודה הבאה התחילה."""
    try:
        os.killpg(pgid, signal.SIGKILL)
    except (ProcessLookupError, PermissionError, OSError):
        pass


# ---------------------------------------------------------------- האיסוף המלא בתקופת הפיתוח (15/10/2026)
# הדגל learn_full במרכז הניהול. הסוכן שולח לשרתון (טוקן השרת, devLog/devMet): סוף הלוג של כל עבודה וה־traceback בכישלון;
# כשעבודה תקועה (ההתקדמות לא זזה STUCK_S) — מצב התהליך (faulthandler של job.py + /proc); ומדדי מעבד/זיכרון/דיסק פעם בדקה.
# הלוג של העבודה נשלח רק כש־job.py קיבל full מהשרתון (הבעלים אישר את הנוסח); המדדים — השרתון בודק את הדגל.
# השרתון מנקה סודות (lib/devlog.js — redact) ומצפין. תקלה כאן לעולם לא נוגעת בעבודה עצמה.
DEV_DIR = J.VT_WORK / '_dev'
TAIL_LINES = 4000
TAIL_BYTES = 200 * 1024
STUCK_S = int(os.environ.get('SNB_STUCK_S', str(20 * 60)))
MET_S = 60
MET_FLUSH = 10                      # דגימות במנה (= פעם ב־10 דק׳)
_tail: collections.deque = collections.deque(maxlen=TAIL_LINES)
_tail_lock = threading.Lock()
_child = {'pid': 0, 'started': 0.0}


def _pump(stream):
    """הפלט של job.py: לקונסולה של docker כמו קודם, ולזנב בזיכרון (לשליחה בסוף העבודה)"""
    for raw in iter(stream.readline, b''):
        try:
            sys.stdout.buffer.write(raw)
            sys.stdout.flush()
        except (OSError, ValueError):
            pass
        with _tail_lock:
            _tail.append(raw.decode('utf-8', 'replace').rstrip('\n')[:2000])


def tail_text() -> str:
    with _tail_lock:
        lines = list(_tail)
    out, n = [], 0
    for ln in reversed(lines):
        n += len(ln) + 1
        if n > TAIL_BYTES:
            break
        out.append(ln)
    return '\n'.join(reversed(out))


def last_traceback(text: str) -> str:
    """ה־traceback האחרון בלוג (Python מדפיס אותו ל־stderr — שנאסף יחד עם הפלט)"""
    i = text.rfind('Traceback (most recent call last):')
    if i < 0:
        i = text.rfind('Fatal Python error')
    return text[i:][:32 * 1024] if i >= 0 else ''


def _read(path, limit=None):
    try:
        b = Path(path).read_bytes()
        return b[-limit:] if limit else b
    except OSError:
        return b''


def proc_snapshot(pgid: int) -> list:
    """מצב כל התהליכים של העבודה (קבוצת התהליכים של job.py): מצב, על מה מחכה (wchan), זיכרון, זמן מעבד, שורת פקודה"""
    out = []
    try:
        tick = os.sysconf('SC_CLK_TCK')
        page = os.sysconf('SC_PAGE_SIZE')
    except (ValueError, OSError):
        tick, page = 100, 4096
    for d in Path('/proc').iterdir() if Path('/proc').is_dir() else []:
        if not d.name.isdigit():
            continue
        try:
            st = (d / 'stat').read_text()
            comm = st[st.index('(') + 1:st.rindex(')')]
            f = st[st.rindex(')') + 2:].split()
            if pgid and int(f[2]) != pgid:
                continue
            rss = int((d / 'statm').read_text().split()[1]) * page
            cl = (d / 'cmdline').read_bytes().replace(b'\0', b' ').decode('utf-8', 'replace').strip()
            cl = re.sub(r'(--key[ =])\S+', r'\1⟨key⟩', cl)[:300]
            out.append({'pid': int(d.name), 'cm': re.sub(r'[^\w.:@/+-]', '_', comm)[:40], 's': f[0][:1],
                        'wc': re.sub(r'[^\w.]', '', _read(d / 'wchan').decode('ascii', 'replace'))[:48],
                        'rss': rss, 'cpu': round((int(f[11]) + int(f[12])) / tick, 1), 'th': int(f[17]), 'cl': cl})
        except (OSError, ValueError, IndexError):
            continue
    return out[:60]


def _job_state() -> dict:
    try:
        return J.load_state() or {}
    except BaseException:     # noqa: BLE001
        return {}


def _prog(state_dir=None) -> dict:
    if state_dir is None and _slots:                  # המשבצת של העבודה שמוצגת בדופק (הראשונה)
        sl = next(iter(_slots.values()))
        state_dir = sl.state
    try:
        return json.loads(((state_dir or J.STATE.parent) / 'prog.json').read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return {}


def dev_send(server: str, tok: str, op: str, d: dict) -> dict:
    try:
        st, j, _ = J.http('POST', server + '/api/studio', {'op': op, 'd': d}, headers={'Authorization': 'Bearer ' + tok}, timeout=60)
        return j if st == 200 and isinstance(j, dict) else {}
    except (OSError, ValueError):
        return {}


def calls_log() -> list:
    out = []
    for ln in _read(DEV_DIR / 'calls.jsonl', 4 * 1024 * 1024).decode('utf-8', 'replace').splitlines():
        try:
            x = json.loads(ln)
            if isinstance(x, dict):
                out.append(x)
        except ValueError:
            continue
    return out[-3000:]


def vt_timeline(job_id: str) -> list:
    """21/10/2026: ציר הזמן של פקודות vt בעבודה (snb-timing.json — שם, התחלה, משך, תהליכון). learn_facts שולח רק סכום לפקודה;
    בלי הציר אי אפשר לראות מה רץ במקביל למה (היישור מול איכויות הצפייה — הנפילות של היום)"""
    try:
        d = json.loads((J.VT_WORK / J.vt_slug(job_id) / 'snb-timing.json').read_text(encoding='utf-8'))
        return [x[:6] for x in (d.get('vt') or [])[-200:] if isinstance(x, list) and len(x) >= 3]
    except (OSError, ValueError, AttributeError, TypeError):
        return []


def dev_job_log(server: str, tok: str, job_id: str, rc: int, kind: str = 'end', stack: str = '', ps=None) -> bool:
    """היומן של העבודה לשרתון — רק כשהעבודה במצב המלא (job.py שמר full מהלקיחה)"""
    st = _job_state()
    if not st.get('full') or st.get('job') != job_id or not server:
        return False
    pr = _prog()
    text = tail_text()
    d = {'job': job_id, 't': kind, 'rc': rc, 'tail': text, 'tb': last_traceback(text) if kind == 'end' else '',
         'calls': calls_log(), 'st': str(pr.get('st') or '')[:24], 'p': pr.get('p'),
         'dur': int(time.time() - _child['started']) if _child['started'] else None,
         'idle': int(time.time() - pr['chg']) if isinstance(pr.get('chg'), (int, float)) else None,
         'ver': os.environ.get('SNB_VERSION', 'dev')[:12], 'tm': vt_timeline(job_id) or None}
    if stack:
        d['stack'] = stack
    if ps:
        d['ps'] = ps
    if kind == 'end':
        d['stack'] = d.get('stack') or _read(DEV_DIR / 'stack.txt', 64 * 1024).decode('utf-8', 'replace')
    return bool(dev_send(server, tok, 'devLog', {k: v for k, v in d.items() if v not in (None, '')}).get('saved'))


# 21/10/2026 (מהיומנים של הייצור): שלוש נפילות של השרת באמצע היישור לא השאירו אף שורת יומן — היומן נשלח רק בסוף העבודה,
# והזיכרון של התהליך נעלם יחד עם הקונטיינר. "קופסה שחורה": כל FLIGHT_S הזנב + השלב + התהליכים נכתבים לדיסק המתמיד
# (/work — שם כבר נמצאים קובצי העבודה; רק כשהעבודה במצב המלא), ובעלייה הבאה נשלחים כ־devLog מסוג lost ונמחקים.
FLIGHT_S = int(os.environ.get('SNB_FLIGHT_S', '60'))
FLIGHT_FIRST = float(os.environ.get('SNB_FLIGHT_FIRST', '15'))   # הכתיבה הראשונה — מוקדם
FLIGHT_DIR = Path(os.environ.get('SNB_FLIGHT_DIR') or str(J.VT_WORK / '_flight'))


def flight_write(job_id: str):
    st = _job_state()
    if not st.get('full') or st.get('job') != job_id:
        return False
    pr = _prog()
    d = {'job': job_id, 't': 'lost', 'rc': -9, 'at': int(time.time()), 'tail': tail_text(), 'calls': calls_log(),
         'st': str(pr.get('st') or '')[:24], 'p': pr.get('p'),
         'dur': int(time.time() - _child['started']) if _child['started'] else None,
         'idle': int(time.time() - pr['chg']) if isinstance(pr.get('chg'), (int, float)) else None,
         'ver': os.environ.get('SNB_VERSION', 'dev')[:12], 'ps': proc_snapshot(_child['pid']) if _child['pid'] else None,
         'tm': vt_timeline(job_id) or None}
    try:
        FLIGHT_DIR.mkdir(parents=True, exist_ok=True)
        tmp = FLIGHT_DIR / (job_id + '.tmp')
        tmp.write_text(json.dumps({k: v for k, v in d.items() if v not in (None, '')}, ensure_ascii=False), encoding='utf-8')
        os.chmod(tmp, 0o600)
        tmp.replace(FLIGHT_DIR / (job_id + '.json'))
        return True
    except OSError:
        return False


def flight_loop(job_id: str, stop: threading.Event):
    # 21/10/2026: עבודה שנפלה בדקה הראשונה (עדכון של העובד בדיוק בלקיחה) לא השאירה אף שורה — הכתיבה הראשונה אחרי
    # FLIGHT_FIRST שניות (מספיק כדי שקובץ המצב של job.py קיים), ואחר כך כל FLIGHT_S
    wait = FLIGHT_FIRST
    while not stop.wait(wait):
        wait = FLIGHT_S
        try:
            flight_write(job_id)
        except Exception:     # noqa: BLE001 — תקלה כאן לעולם לא נוגעת בעבודה
            pass


def flight_clear(job_id: str):
    for ext in ('.json', '.tmp'):
        try:
            (FLIGHT_DIR / (job_id + ext)).unlink()
        except OSError:
            pass


def flight_send(server: str, tok: str, only: str = '') -> int:
    """בעלייה: כל קופסה שחורה שנשארה = עבודה שנקטעה באמצע (השרת נפל). שולחים ומוחקים — גם כשהשליחה נכשלה (לא נשמר מעל יום)"""
    n = 0
    if not FLIGHT_DIR.is_dir():
        return 0
    for f in sorted(FLIGHT_DIR.glob((only or '*') + '.json')):
        try:
            d = json.loads(f.read_text(encoding='utf-8'))
            if server and tok and J.JOB_RE.match(str(d.get('job') or '')) and time.time() - float(d.get('at') or 0) < 86400:
                d['lost'] = int(time.time())
                if dev_send(server, tok, 'devLog', d).get('saved'):
                    n += 1
        except (OSError, ValueError, TypeError):
            pass
        finally:
            try:
                f.unlink()
            except OSError:
                pass
    for f in FLIGHT_DIR.glob((only or '*') + '.tmp'):
        try:
            f.unlink()
        except OSError:
            pass
    return n


def stuck_watch(server: str, tok: str, job_id: str, stop: threading.Event):
    """עבודה שההתקדמות שלה לא זזה STUCK_S: faulthandler ב־job.py (SIGUSR1 → stack.txt) + מצב התהליכים → devLog stuck.
    פעם אחת לכל תקיעה (לפי chg), ולכל היותר פעם בחצי שעה"""
    last_chg, last_at = None, 0.0
    while not stop.wait(60):
        pr = _prog()
        chg = pr.get('chg')
        if not isinstance(chg, (int, float)) or time.time() - chg < STUCK_S or chg == last_chg or time.time() - last_at < 1800:
            continue
        if not _job_state().get('full'):
            continue
        last_chg, last_at = chg, time.time()
        pid = _child['pid']
        try:
            sp = DEV_DIR / 'stack.txt'
            before = sp.stat().st_size if sp.exists() else 0
            if pid:
                os.kill(pid, signal.SIGUSR1)
            time.sleep(3)
            stack = _read(sp).decode('utf-8', 'replace')[before:][-64 * 1024:]
        except OSError:
            stack = ''
        dev_job_log(server, tok, job_id, -1, 'stuck', stack, proc_snapshot(pid))


def run_child(args: list[str], timeout: int) -> int:
    cmd = [sys.executable, str(HERE / 'job.py')] + args
    p = subprocess.Popen(cmd, cwd=str(HERE.parent), start_new_session=True,   # קבוצת תהליכים משלה — כדי לעצור את כולה
                         stdout=subprocess.PIPE, stderr=subprocess.STDOUT)   # 15/10: הפלט נאסף לזנב (האיסוף המלא)
    _child['pid'] = p.pid
    pump = threading.Thread(target=_pump, args=(p.stdout,), daemon=True)
    pump.start()
    try:
        return p.wait(timeout=timeout)
    except subprocess.TimeoutExpired:
        print('✗ העבודה חרגה מהזמן המרבי — נעצרה.', flush=True)
        _kill_group(p.pid)
        try:
            p.wait(timeout=30)
        except subprocess.TimeoutExpired:
            pass
        return 124
    finally:
        _kill_group(p.pid)   # 14/10/2026: גם כשהעבודה הסתיימה — תהליכי vt יתומים שנשארו ממנה (הקבוצה כבר ריקה = כלום)
        pump.join(5)
        try:
            p.stdout.close()
        except OSError:
            pass
        _child['pid'] = 0


def crash_code(rc: int) -> str:
    """קוד היציאה של job.py auto → קוד שגיאה לדיווח, או '' כשאין מה לדווח (0 = הצליח, 1 = כבר דיווח, 2 = "עצור",
    3 = חזרה לתור — מחכה לסרטון, 15/10/2026)."""
    if rc in (0, 1, 2, 3):
        return ''
    if rc == 124:
        return 'job_timeout'
    if rc in (137, -9) or rc < 0:
        return 'worker_oom' if rc in (137, -9) else 'worker_crash'
    return 'worker_crash'


def end_code(rc: int) -> str:
    """קוד היציאה של עבודה → אירוע ביומן השרת (0 הצליחה, 1 נכשלה ודיווחה, 2 נעצרה מהאפליקציה, אחר — לפי crash_code)"""
    if rc == 0:
        return 'done'
    if rc == 1:
        return 'fail'
    if rc == 2:
        return 'stop'
    if rc == 3:
        return 'park'
    return {'job_timeout': 'timeout', 'worker_oom': 'oom'}.get(crash_code(rc), 'crash')


AUTO_KINDS = ('tr', 'rr', 'ai', 'dx')     # 26/10/2026: dx = שמירה ב־Drive; = WORKER_KINDS בשרתון חוץ מ־ping — job.py auto מטפל בכולם


def handle(jb: dict, server: str, tok: str = '') -> int:
    global _busy
    J.VT_WORK.mkdir(parents=True, exist_ok=True)
    BUSY.write_text(jb['id'])
    _busy = jb['id']
    with _tail_lock:
        _tail.clear()
    _child['started'] = time.time()
    stop = threading.Event()
    rc = None
    if tok:
        threading.Thread(target=stuck_watch, args=(server, tok, jb['id'], stop), daemon=True).start()
        threading.Thread(target=flight_loop, args=(jb['id'], stop), daemon=True).start()
    try:
        base = ['run', '--job', jb['id'], '--key', jb['key']]
        if server != J.SERVER:                 # שרתון הניסוי או localhost בבדיקות — job.py בודק שוב בעצמו
            base += ['--server', server]
            if os.environ.get('SNB_DRIVE_API') and J.LOCAL_RE.match(server):
                base += ['--drive-api', os.environ['SNB_DRIVE_API']]
        rc = run_child(base, RUN_TIMEOUT_S)
        # 22/10/2026 (באג חמור — מ־21/10 השרתון שולח את הסוג; עד אז הוא היה חסר = 'tr' תמיד): הפקה מחדש וגיליון ה־AI
        # נלקחו, סומנו "רצה" ולא הורצו — job.py auto הוא שמפנה אותם (render / ai_auto). רק בדיקת חיבור (ping) בלי auto
        if rc == 0 and (jb.get('kind') or 'tr') in AUTO_KINDS:
            rc = run_child(['auto'], AUTO_TIMEOUT_S)
            err = crash_code(rc)
            if err:
                # 124 = חרגה מהזמן; 137 / אות = נהרגה (לרוב זיכרון); אחר = קריסה. בלי דיווח העבודה הייתה נשארת "רצה"
                # עד STALE_MS (שעתיים). דיווח כפול (העבודה כבר דיווחה כישלון) — השרתון מחזיר רק "עצור".
                msg = {'job_timeout': 'העבודה חרגה מהזמן המרבי', 'worker_oom': 'התהליך נהרג (כנראה נגמר הזיכרון)'}.get(err, f'התהליך נעצר (קוד {rc})')
                try:
                    J.Ctx(J.load_state()).report(fail=True, err=err, msg=msg, force=True, usage=J.usage_safe())
                except BaseException:     # noqa: BLE001 — הדיווח משני; הניקוי חשוב יותר
                    pass
        return rc
    finally:
        stop.set()
        if tok:
            try:
                dev_job_log(server, tok, jb['id'], rc if isinstance(rc, int) else -2)   # לפני הניקוי — הקבצים עוד שם
            except BaseException:     # noqa: BLE001
                pass
        flight_clear(jb['id'])               # העבודה הסתיימה כרגיל (גם בכישלון) — היומן נשלח, הקופסה השחורה מיותרת
        _busy = ''
        _child['started'] = 0.0
        cleanup()
        try:
            BUSY.unlink()
        except OSError:
            pass


# ---------------------------------------------------------------- כמה עבודות במקביל (21/10/2026)
# בקשת המשתמש: לנצל את הזיכרון — עבודה שנייה (ושלישית) נכנסת כשיש לה מקום, לא מחכה בתור שהשרת יסיים.
# כמו requests ב־Kubernetes / reservation ב־Nomad: לכל עבודה שרצה "הזמנה" = השיא הצפוי שלה (לא מה שהיא תופסת
# עכשיו — יישור של שעה עולה ל־6GB אחרי עשרים דקות), ועבודה חדשה נכנסת רק אם השיא שלה נכנס במה שנשאר בתוך התקרה
# של הקונטיינר, פחות מרווח בטחון. PSI (לחץ זיכרון של הקרנל) = בלם: בלחץ לא מכניסים כלום.
# כל עבודה רצה בתהליך בן משלו (agent.py --slot) עם תיקיית מצב ותיקיית עבודה משלה (SNB_STATE/VT_WORK = s<n>) —
# job.py לא השתנה: הוא בטוח שהוא לבד. השיא האמיתי של כל עבודה נמדד (RSS של כל התהליכים שלה) ונלמד.
SLOTS_MAX = 4
MEM_DB = Path(os.environ.get('SNB_MEM_DB', '/cache/snb-mem.json'))
# השיא הצפוי לפי סוג העבודה: [קבוע MB, MB לדקת סרטון]. תרגום: היישור ב־ONNX תחת gVisor 4.2GB ל־5 דק׳ (נמדד 10/10),
# ‏CTC לפני השחרור 5.3GB לשעה ועשרים (20/10) — לכן קבוע גבוה ושיפוע מתון. הפקה מחדש = צריבה; גיליון AI = קריאות בלבד.
MEM_PRIOR = {'tr': (4600, 22), 'rr': (2200, 6), 'ai': (700, 0), 'dx': (400, 0)}   # dx — רק העתקה
MEM_MARGIN = 1.1                    # ההזמנה = השיא הצפוי + 10%
MEM_BASE_MB = 400                   # הסוכן עצמו + ההכנה מראש של המודלים
PSI_MAX = 10.0                      # some avg10 מעל 10% — הזיכרון כבר בלחץ: לא מכניסים עבודה


def cpus_allowed() -> int:
    try:
        return len(os.sched_getaffinity(0))
    except (AttributeError, OSError):
        return os.cpu_count() or 1


def slots_max() -> int:
    """כמה עבודות לכל היותר במקביל. SNB_SLOTS קובע; אחרת לפי הליבות — לפחות 4 ליבות לעבודה (יישור וצריבה מוגבלים
    במעבד: שתי עבודות על 4 ליבות לא מסיימות מהר יותר מאחת אחרי השנייה, רק מאחרות את שתיהן)."""
    v = os.environ.get('SNB_SLOTS', '')
    if v.isdigit() and int(v) > 0:
        return min(SLOTS_MAX, int(v))
    return max(1, min(SLOTS_MAX, cpus_allowed() // 4))


def _read_int(p) -> int | None:
    try:
        t = Path(p).read_text().strip()
        return None if t == 'max' else int(t)
    except (OSError, ValueError):
        return None


def _meminfo() -> dict:
    try:
        return {k: int(v.split()[0]) for k, v in (ln.split(':', 1) for ln in Path('/proc/meminfo').read_text().splitlines() if ':' in ln)}
    except (OSError, ValueError, IndexError):
        return {}


def mem_limit_mb() -> int:
    """התקרה של הקונטיינר (cgroup v2 memory.max); בלי — כל הזיכרון של המכונה (תחת gVisor /proc/meminfo = התקרה)."""
    mi = _meminfo()
    tot = mi.get('MemTotal', 0) // 1024
    cg = _read_int('/sys/fs/cgroup/memory.max')
    lim = cg // (1024 * 1024) if cg else 0
    return min(x for x in (tot, lim) if x > 0) if (tot or lim) else 0


def mem_pressure() -> float:
    """PSI: אחוז הזמן ב־10 השניות האחרונות שבו משימה כלשהי חיכתה לזיכרון (some avg10). 0 כשאין PSI."""
    for p in ('/sys/fs/cgroup/memory.pressure', '/proc/pressure/memory'):
        try:
            m = re.search(r'some avg10=([0-9.]+)', Path(p).read_text())
            if m:
                return float(m.group(1))
        except OSError:
            continue
    return 0.0


def mem_samples() -> list:
    try:
        d = json.loads(MEM_DB.read_text(encoding='utf-8'))
        return [x for x in d if isinstance(x, list) and len(x) == 3 and x[0] in MEM_PRIOR and all(isinstance(v, (int, float)) for v in x[1:])][-60:]
    except (OSError, ValueError, TypeError):
        return []


def mem_note(kind: str, dur_s: float, peak_mb: float):
    """שיא אמיתי של עבודה שהסתיימה → המאגר של השרת (בתיקיית המטמון — שורד הפעלה מחדש). מספרים בלבד."""
    if kind not in MEM_PRIOR or not (peak_mb > 0):
        return
    try:
        MEM_DB.parent.mkdir(parents=True, exist_ok=True)
        MEM_DB.write_text(json.dumps((mem_samples() + [[kind, round(dur_s or 0), round(peak_mb)]])[-60:]), encoding='utf-8')
    except OSError:
        pass


def mem_model(kind: str) -> tuple[int, float]:
    """[קבוע, לדקה] לסוג העבודה: ה־prior, ומעליו המעטפת של מה שנמדד בשרת הזה (לעולם לא מתחת ל־prior — שמרני).
    השיפוע נשאר של ה־prior; הקבוע עולה כך שכל שיא שנמדד נכנס מתחת לקו."""
    a, b = MEM_PRIOR.get(kind, MEM_PRIOR['tr'])
    for k, d, pk in mem_samples():
        if k == kind:
            a = max(a, pk - b * (d / 60))
    return int(round(a)), b


def mem_need(kind: str, dur_s: float) -> int:
    a, b = mem_model(kind)
    return int(round((a + b * max(0.0, dur_s or 0) / 60) * MEM_MARGIN))


def _children() -> dict:
    kids = {}
    for d in Path('/proc').iterdir() if Path('/proc').is_dir() else []:
        if d.name.isdigit():
            try:
                st = (d / 'stat').read_text()
                kids.setdefault(int(st[st.rindex(')') + 2:].split()[1]), []).append(int(d.name))
            except (OSError, ValueError, IndexError):
                continue
    return kids


def tree_rss_mb(pid: int, kids: dict | None = None) -> float:
    """RSS של תהליך וכל הצאצאים שלו (גם בקבוצות תהליכים אחרות — job.py ו־vt פותחים session משלהם)"""
    kids = kids if kids is not None else _children()
    try:
        page = os.sysconf('SC_PAGE_SIZE')
    except (ValueError, OSError):
        page = 4096
    tot, todo, seen = 0, [pid], set()
    while todo:
        p = todo.pop()
        if p in seen:
            continue
        seen.add(p)
        try:
            tot += int(Path('/proc/%d/statm' % p).read_text().split()[1]) * page
        except (OSError, ValueError, IndexError):
            pass
        todo.extend(kids.get(p, []))
    return tot / (1024 * 1024)


class Slot:
    """עבודה אחת שרצה בתהליך בן משלו. state/work = התיקיות שלה; need = ההזמנה (MB); peak = השיא שנמדד."""

    def __init__(self, n: int, jb: dict):
        self.n, self.jb, self.id = n, jb, jb['id']
        self.state = J.STATE.parent / ('s%d' % n)
        self.work = J.VT_WORK / ('s%d' % n)
        self.kind = jb.get('kind') or 'tr'
        self.dur = float(jb.get('dur') or 0)
        self.need = mem_need(self.kind, self.dur)
        self.peak = 0.0
        self.p = None
        self.t0 = time.time()

    def start(self, server: str, tok: str):
        for d in (self.state, self.work):
            shutil.rmtree(d, ignore_errors=True)
            d.mkdir(parents=True, exist_ok=True)
        env = dict(os.environ, SNB_STATE=str(self.state), VT_WORK=str(self.work), SNB_SLOT=str(self.n), SNB_FLIGHT_DIR=str(FLIGHT_DIR))
        self.p = subprocess.Popen([sys.executable, str(Path(__file__).resolve()), '--slot'], env=env, cwd=str(HERE.parent),
                                  stdin=subprocess.PIPE, start_new_session=True)
        # העבודה (כולל המפתח) — ב־stdin, לא בשורת הפקודה (שגלויה ב־ps)
        self.p.stdin.write(json.dumps({'job': self.jb, 'server': server}).encode())
        self.p.stdin.close()

    def sample(self, kids=None):
        if self.p and self.p.poll() is None:
            self.peak = max(self.peak, tree_rss_mb(self.p.pid, kids))
            if not self.dur:                             # האורך — מקובץ המצב של job.py (נכתב בלקיחה)
                try:
                    self.dur = float(((json.loads((self.state / 'job.json').read_text(encoding='utf-8')).get('spec') or {}).get('dur')) or 0)
                    self.need = mem_need(self.kind, self.dur)
                except (OSError, ValueError, TypeError, AttributeError):
                    pass

    def reserved(self) -> float:
        """כמה מהזיכרון שמור לה: השיא הצפוי, או מה שהיא כבר תופסת אם עברה אותו"""
        return max(self.need, self.peak * MEM_MARGIN)

    def done(self) -> int | None:
        return self.p.poll() if self.p else 0

    def stop(self):
        """כל העץ — job.py ו־vt פותחים session משלהם, kill לקבוצה של הבן לא מגיע אליהם"""
        if self.p and self.p.poll() is None:
            kids, todo, all_ = _children(), [self.p.pid], []
            while todo:
                x = todo.pop()
                all_.append(x)
                todo.extend(kids.get(x, []))
            for x in reversed(all_):
                try:
                    os.kill(x, signal.SIGTERM)
                except OSError:
                    pass

    def finish(self):
        shutil.rmtree(self.state, ignore_errors=True)
        shutil.rmtree(self.work, ignore_errors=True)


def mem_fit(slots: dict) -> dict | None:
    """כמה זיכרון פנוי לעוד עבודה (MB), ולפי איזה מודל — השרתון בוחר רק עבודה שהשיא שלה נכנס. None = לא מכניסים כלום.
    התקרה פחות הסוכן, פחות מרווח בטחון (10%, לפחות 1GB), פחות ההזמנות של מה שרץ; ובנוסף לא יותר ממה שבאמת פנוי
    עכשיו (MemAvailable) פחות מה שהעבודות שרצות עוד יתפסו עד השיא שלהן."""
    lim = mem_limit_mb()
    if not lim or mem_pressure() > PSI_MAX:
        return None
    head = max(1024, lim * 0.1)
    res = sum(s.reserved() for s in slots.values())
    grow = sum(max(0.0, s.reserved() - s.peak) for s in slots.values())   # מה שהן עוד יגדלו (מעבר למה שהן תופסות עכשיו)
    av = _meminfo().get('MemAvailable', 0) / 1024
    free = lim - MEM_BASE_MB - head - res
    if av:
        free = min(free, av - head - grow)
    if free < mem_need('ai', 0):
        return None
    a, b = mem_model('tr')
    ra, rb = mem_model('rr')
    return {'mb': int(free), 'a': int(round(a * MEM_MARGIN)), 'b': round(b * MEM_MARGIN, 1), 'ra': int(round(ra * MEM_MARGIN)),
            'rb': round(rb * MEM_MARGIN, 1), 'ai': mem_need('ai', 0)}


def write_busy():
    """/work/.busy כל עוד עבודה כלשהי רצה — כך snb-update לא מחליף גרסה באמצע (המזהים, שורה לכל אחת)"""
    try:
        if _slots:
            J.VT_WORK.mkdir(parents=True, exist_ok=True)
            BUSY.write_text('\n'.join(s.id for s in _slots.values()))
        elif BUSY.exists():
            BUSY.unlink()
    except OSError:
        pass


def slot_main() -> int:
    """תהליך הבן של משבצת: העבודה מ־stdin, אותו handle של עבודה יחידה (job.py עם התיקיות של המשבצת)."""
    signal.signal(signal.SIGTERM, _on_term)
    try:
        d = json.loads(sys.stdin.read() or '{}')
        jb, server = d['job'], d['server']
    except (ValueError, KeyError, TypeError):
        return 1
    if server not in J.SERVERS and not J.LOCAL_RE.match(server):
        return 1
    if not (J.JOB_RE.match(str(jb.get('id') or '')) and J.KEY_RE.match(str(jb.get('key') or ''))):
        return 1
    return handle(jb, server, token())


def run_slots(server: str, tok: str, warm, nmax: int, stop_after: int = 0) -> int:
    """הלולאה כשמותר יותר מעבודה אחת: שואלים את השרתון כל עוד יש משבצת ויש זיכרון, ומדגימים את השיא של כל עבודה."""
    global _busy
    backoff, finished = POLL_S, 0
    nxt_poll = 0.0
    while not _stop:
        kids = _children() if _slots else None
        for n, sl in list(_slots.items()):
            sl.sample(kids)
            rc = sl.done()
            if rc is None:
                continue
            print('← סיום ' + sl.id[:6] + '… (' + str(rc) + ') · שיא זיכרון ' + str(int(sl.peak)) + 'MB', flush=True)
            ev(end_code(rc))
            if rc in (0, 1, 2) and sl.peak > 0:
                mem_note(sl.kind, sl.dur, sl.peak)
            try:
                flight_send(server, tok, sl.id)          # תהליך המשבצת מת בלי לסיים (נהרג) — היומן שלו עכשיו, לא בעלייה הבאה
            except Exception:     # noqa: BLE001
                pass
            sl.finish()
            del _slots[n]
            finished += 1
            nxt_poll = 0.0                                   # התפנתה משבצת — שואלים מיד
        _busy = next(iter(_slots.values())).id if _slots else ''
        write_busy()
        if stop_after and finished >= stop_after and not _slots:
            return 0
        now = time.time()
        if len(_slots) < nmax and now >= nxt_poll:
            fit = mem_fit(_slots) if _slots else None
            if _slots and fit is None:
                nxt_poll = now + POLL_S                      # אין זיכרון לעוד עבודה — מחכים שתסתיים / שהלחץ ירד
            else:
                r = poll(server, tok, fit=fit)
                if r.get('job'):
                    jb = r['job']
                    if warm is not None and warm.is_alive() and not _slots:
                        warm.join(WARM_WAIT_S)
                    n = next(i for i in range(1, SLOTS_MAX + 1) if i not in _slots)
                    sl = Slot(n, jb)
                    print('→ עבודה ' + jb['id'][:6] + '… (משבצת ' + str(n) + ', הזמנה ' + str(sl.need) + 'MB)', flush=True)
                    ev('job')
                    _slots[n] = sl
                    write_busy()
                    sl.start(server, tok)
                    backoff, nxt_poll = POLL_S, now + 2          # עוד אחת? בודקים שוב בעוד רגע (הזיכרון כבר מחושב עם זו)
                    continue
                if r.get('error') == 'auth':
                    ev('auth')
                    backoff = MAX_BACKOFF_S
                    print('✗ השרתון לא מכיר את טוקן השרת (בוטל באפליקציה?) — snb-setup עם טוקן חדש', flush=True)
                elif r.get('error'):
                    ev('net')
                    backoff = min(MAX_BACKOFF_S, backoff * 2)
                    print('· השרתון לא זמין (' + r['error'] + ') — עוד ' + str(int(backoff)) + ' שנ׳', flush=True)
                else:
                    backoff = POLL_S
                nxt_poll = now + backoff * random.uniform(0.85, 1.15)
        time.sleep(1 if _slots else 0.5)
    for sl in _slots.values():                              # כיבוי (SIGTERM): העבודות נעצרות; הסוכן הבא ידווח עליהן (boot)
        sl.stop()
    return 0


PQ_S = float(os.environ.get('SNB_PQ_S', '4'))
PQ_ST, PQ_N = 0, 0     # 24/10/2026: מה השרתון ענה לשאלה האחרונה על בדיקות קישור (0 = עוד לא שאלנו, 1 = רשת) וכמה בדיקות טופלו — למדדים


def probe_once(server: str, tok: str, run=subprocess.run) -> bool:
    """22/10/2026: הורדה מקישור — בדיקת קישור אחת מהתור (op:'pq'): yt-dlp בלי הורדה, בתהליך נפרד (fetchurl.py probe),
    ומחזירים לשרתון סיכום או קוד שגיאה. True = הייתה בדיקה (שואלים שוב מיד)."""
    global PQ_ST, PQ_N
    try:
        st, j, _ = J.http('POST', server + '/api/studio', {'op': 'pq'}, headers={'Authorization': 'Bearer ' + tok}, timeout=20)
    except (OSError, ValueError):
        PQ_ST = 1                                        # 24/10/2026: רשת — נראה במדדים (pq)
        return False
    if st != PQ_ST and st != 200:
        print('· בדיקות קישור: השרתון החזיר ' + str(st), flush=True)
    PQ_ST = st
    pr = j.get('pr') if st == 200 and isinstance(j, dict) else None
    if not isinstance(pr, dict) or not re.match(r'^p[0-9a-z]{6,30}$', str(pr.get('id') or '')):
        return False
    body = {'op': 'pq', 'done': True, 'pid': pr['id']}
    try:
        ref = str(pr.get('ref') or '')                  # שלב 2: קובץ שנמצא בדף — הדף שממנו הגיע (Referer)
        r = run([sys.executable, str(Path(__file__).with_name('fetchurl.py')), 'probe', str(pr.get('u') or '')] + (['--ref', ref] if ref else []),
                capture_output=True, text=True, timeout=120)
        out = json.loads((r.stdout or '').strip().splitlines()[-1])
    except (OSError, subprocess.SubprocessError, ValueError, IndexError):
        out = {'error': 'fail'}
    if out.get('error'):
        body.update(ok=False, e=str(out['error'])[:20])
    else:
        body.update(ok=True, r=out)
    print('· בדיקת קישור ' + pr['id'][:8] + '… → ' + (body.get('e') or 'ok'), flush=True)
    PQ_N += 1
    try:
        st2, _, _ = J.http('POST', server + '/api/studio', body, headers={'Authorization': 'Bearer ' + tok}, timeout=30)
        if st2 != 200:                                   # 24/10/2026: עד היום נבלע בשקט (413 על תשובה גדולה)
            print('· תשובת בדיקת הקישור נדחתה: ' + str(st2), flush=True)
    except (OSError, ValueError):
        print('· תשובת בדיקת הקישור לא נשלחה (רשת)', flush=True)
    return True


# ---------------------------------------------------------------- תרגום בטלפון, שלב 3 (25/10/2026)
# הטלפון מריץ את כל העבודה, וכל קריאה ל־Claude מגיעה לתור בשרתון (lib/relay.js). כאן — העונה: מושך בקשות של כל העבודות
# שהטלפון מריץ (op:'ptNext', הטוקן של השרת), קורא ל־Claude עם המפתח של המערכת (llm.pt_answer) ומחזיר (op:'ptMark') —
# עם המחיר, כדי שהשרתון יספור את העלות (לא הטלפון). התור חי בחדר האפליקציה — שרתון בלי תור עונה no_hub עם הכתובת שלו.
PT_PAR = int(os.environ.get('SNB_PT_PAR', '8'))


def pt_loop(server: str, tok: str, answer=None, post=None):
    answer = answer or llm_answer
    post = post or (lambda base, body, t: J.http('POST', base + '/api/studio', body, headers={'Authorization': 'Bearer ' + tok}, timeout=t))
    base, fixed, busy, lock = server, {}, {}, threading.Lock()

    def mark(b, body):
        for _ in range(20):
            try:
                st, j, _ = post(b, dict(body, op='ptMark'), 60)
                if st == 200:
                    return
            except (OSError, ValueError):
                pass
            time.sleep(3)

    def one(b, r):
        flag = {'s': False}

        def started():
            if not flag['s']:
                flag['s'] = True
                mark(b, {'job': r['job'], 'rid': r['rid'], 'st': 's'})
        try:
            ans = answer(r, fixed.get(r['fh']), started)
        except Exception as e:     # noqa: BLE001 — כל תקלה = קוד, לא קריסה של הלולאה
            ans = {'err': getattr(e, 'code', None) or 'api_error'}
        usd = ans.pop('usd', 0) if isinstance(ans, dict) else 0
        mark(b, {'job': r['job'], 'rid': r['rid'], 'st': 'd', 'ans': ans, 'usd': usd})
        with lock:
            busy.pop(r['rid'], None)

    while not _stop:
        with lock:
            free = max(0, PT_PAR - len(busy))
        try:
            st, j, _ = post(base, {'op': 'ptNext', 'have': list(fixed)[:256], 'max': free, 'w': 25000 if free else 3000}, 40)
        except (OSError, ValueError):
            time.sleep(5)
            continue
        if st != 200 or not isinstance(j, dict) or not j.get('ok'):
            hub = str((j or {}).get('hub') or '') if isinstance(j, dict) else ''
            if (j or {}).get('error') == 'no_hub' and hub in J.SERVERS and hub != base:
                base = hub                                # התור בחדר האפליקציה — לשם (אותו טוקן שרת)
                continue
            time.sleep(10)
            continue
        for h, t in (j.get('fx') or {}).items():
            if isinstance(t, str) and hashlib.sha1(t.encode('utf-8')).hexdigest() == h:
                fixed[h] = t
        if len(fixed) > 400:
            fixed.clear()
        for r in j.get('reqs') or []:
            if not isinstance(r, dict) or r.get('fh') not in fixed or not J.JOB_RE.match(str(r.get('job') or '')):
                continue
            with lock:
                busy[r['rid']] = r
            threading.Thread(target=one, args=(base, r), daemon=True).start()
        if not free:
            time.sleep(1)


def llm_answer(r, fx, started):
    import llm
    return llm.pt_answer(r, fx, started)


def probe_loop(server: str, tok: str):
    """חוט נפרד: בדיקות קישור לא מחכות לעבודה שרצה (הן קלות — שניות, כ־100MB). השרתון לא קורא ל־Firestore כשאין
    בדיקה חדשה, כך שהשאלה כל 4 שניות זולה."""
    while not _stop:
        try:
            busy = probe_once(server, tok)
        except Exception as e:     # noqa: BLE001 — חוט רקע: תקלה לא מפילה את הסוכן
            print('· בדיקת קישור נכשלה (' + type(e).__name__ + ')', flush=True)
            busy = False
        time.sleep(0.2 if busy else PQ_S)


# 25/10/2026 (בקשת המשתמש): יוטיוב בשרת דרך חשבון ייעודי. העוגיות (cookies.txt) מגיעות מהשרתון (op:'ytCk', הטוקן של
# השרת) רק כשהגרסה השתנתה, ונשמרות ב־/cache/yt (0600) — fetchurl.py משתמש בהן רק לקישורי יוטיוב. מה ש־yt-dlp עדכן בקובץ
# (ck.dirty) חוזר לשרתון, וההצלחה/החסימה האחרונה (ck.rep) מדווחת — כך מרכז הניהול יודע כשהחשבון נחסם. לא מדפיסים אותן לעולם
YT_DIR = Path(os.environ.get('SNB_YT_DIR', '/cache/yt'))
YT_SYNC_S = float(os.environ.get('SNB_YT_SYNC_S', '300'))


def yt_sync(server: str, tok: str, http=None) -> int:
    """סבב אחד: גרסה, דיווח ועדכון. מחזיר את הגרסה שבקובץ אחרי הסבב (0 = אין חשבון)."""
    http = http or J.http
    ck, vf, rep, dirty = YT_DIR / 'ck.txt', YT_DIR / 'ck.v', YT_DIR / 'ck.rep', YT_DIR / 'ck.dirty'
    try:
        v = int(vf.read_text().strip() or 0) if vf.is_file() and ck.is_file() else 0
    except (OSError, ValueError):
        v = 0
    body = {'op': 'ytCk', 'v': v}
    sent = []
    try:
        r = json.loads(rep.read_text())
        if v and int(r.get('v') or 0) == v:
            body['rep'] = {'ok': True} if r.get('ok') is True else {'ok': False, 'code': str(r.get('code') or '')[:12]}
        sent.append(rep)
    except (OSError, ValueError, AttributeError):
        pass
    if v and dirty.exists():
        try:
            body['put'] = ck.read_text()[:70000]
        except OSError:
            pass
        sent.append(dirty)
    try:
        st, j, _ = http('POST', server + '/api/studio', body, headers={'Authorization': 'Bearer ' + tok}, timeout=30)
    except (OSError, ValueError):
        return v
    if st != 200 or not isinstance(j, dict):
        return v
    for f in sent:
        try:
            f.unlink()
        except OSError:
            pass
    nv = int(j.get('v') or 0)
    if nv == v and j.get('same'):
        return v
    try:
        YT_DIR.mkdir(parents=True, exist_ok=True)
        os.chmod(YT_DIR, 0o700)
        text = j.get('ck')
        if nv and isinstance(text, str) and text.startswith('# Netscape HTTP Cookie File'):
            tmp = YT_DIR / ('.ck.' + str(os.getpid()))
            fd = os.open(str(tmp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
            with os.fdopen(fd, 'w') as fh:
                fh.write(text)
            os.replace(str(tmp), str(ck))
            vf.write_text(str(nv))
            print('· חשבון היוטיוב של השרת עודכן', flush=True)
            return nv
        if ck.exists():
            ck.unlink()
            print('· חשבון היוטיוב של השרת הוסר', flush=True)
        vf.write_text('0')
    except OSError:
        pass
    return 0


def yt_loop(server: str, tok: str):
    while not _stop:
        try:
            yt_sync(server, tok)
        except Exception as e:     # noqa: BLE001 — חוט רקע
            print('· סנכרון חשבון היוטיוב נכשל (' + type(e).__name__ + ')', flush=True)
        for _ in range(int(YT_SYNC_S)):
            if _stop:
                return
            time.sleep(1)


WARM_WAIT_S = 900


def start_warm():
    """המודלים הכבדים יורדים ונבדקים כשהשרת עולה (warm.py, תהליך נפרד — הזיכרון שלו משתחרר כשהוא נגמר).
    קובץ קטוע מתגלה כאן ולא אחרי שההגהה כבר שולמה, ועבודה לא מחכה להורדה של כ־3GB."""
    def run():
        try:
            subprocess.run([sys.executable, str(Path(__file__).with_name('warm.py'))], timeout=WARM_WAIT_S)
        except (OSError, subprocess.SubprocessError) as e:
            print('· הכנת המודלים מראש נכשלה (' + type(e).__name__ + ') — העבודה תוריד אותם בעצמה', flush=True)
            ev('warm')
    t = threading.Thread(target=run, daemon=True)
    t.start()
    return t


def main(once: bool = False) -> int:
    signal.signal(signal.SIGTERM, _on_term)
    signal.signal(signal.SIGINT, _on_term)
    server, tok = server_url(), token()
    report_lost()                              # 14/10/2026: עבודה שרצה כשהשרת כבה — מדווחת, כדי שתמשיך לבד ולא "תרוץ" שעתיים
    try:
        if flight_send(server, tok):           # 21/10/2026: היומן של מה שנקטע — לפני הניקוי
            print('· נשלח היומן של עבודה שנקטעה באמצע (האיסוף המלא)', flush=True)
    except Exception:     # noqa: BLE001
        pass
    cleanup()                                  # שאריות מהפעלה קודמת שנקטעה (כיבוי, עדכון)
    # 20/10/2026: בעלייה אף עבודה לא רצה — .busy שנשאר (עבודה שנקטעה, כבר דווחה למעלה) הוא שארית. עד היום cleanup()
    # דילג עליו, והוא נשאר לתמיד: snb-update לא החליף את העובד של הניסוי ימים ("עבודה רצה"), וגם snb-host-apply סירב
    try:
        BUSY.unlink()
    except OSError:
        pass
    warm = None if once else start_warm()
    print('✓ הסוכן פעיל — שואל את השרתון אם יש עבודה', flush=True)
    ev('up')
    if not once:
        threading.Thread(target=beat_loop, args=(server, tok), daemon=True).start()
        if os.environ.get('SNB_PT', 'on') != 'off' and os.environ.get('ANTHROPIC_API_KEY'):
            threading.Thread(target=pt_loop, args=(server, tok), daemon=True).start()   # 25/10/2026: תרגום בטלפון — Claude
        if os.environ.get('SNB_PROBE', 'on') != 'off':
            threading.Thread(target=probe_loop, args=(server, tok), daemon=True).start()   # 22/10/2026: בדיקות קישור
        if os.environ.get('SNB_YT', 'on') != 'off':
            os.environ['SNB_YT_COOKIES'] = str(YT_DIR / 'ck.txt')   # יורש כל תהליך (בדיקה, עבודה) — fetchurl משתמש רק ביוטיוב
            threading.Thread(target=yt_loop, args=(server, tok), daemon=True).start()   # 25/10/2026: חשבון יוטיוב ייעודי
    nmax = slots_max()
    if not once and nmax > 1:
        print('· עד ' + str(nmax) + ' עבודות במקביל, לפי הזיכרון (תקרה ' + str(mem_limit_mb()) + 'MB)', flush=True)
        return run_slots(server, tok, warm, nmax, int(os.environ.get('SNB_STOP_AFTER', '0') or 0))
    backoff = POLL_S
    while not _stop:
        r = poll(server, tok)
        if r.get('job'):
            print('→ עבודה ' + r['job']['id'][:6] + '…', flush=True)
            if warm is not None and warm.is_alive():
                warm.join(WARM_WAIT_S)           # ההורדה מראש עוד רצה — העבודה הייתה מורידה את אותם קבצים בעצמה
            ev('job')
            rc = handle(r['job'], server, tok)
            print('← סיום (' + str(rc) + ')', flush=True)
            ev(end_code(rc))
            backoff = POLL_S
            if once:
                return rc
            continue
        if r.get('error') == 'auth':
            ev('auth')
            backoff = MAX_BACKOFF_S
            print('✗ השרתון לא מכיר את טוקן השרת (בוטל באפליקציה?) — snb-setup עם טוקן חדש', flush=True)
        elif r.get('error'):
            ev('net')
            backoff = min(MAX_BACKOFF_S, backoff * 2)
            print('· השרתון לא זמין (' + r['error'] + ') — עוד ' + str(int(backoff)) + ' שנ׳', flush=True)
        else:
            backoff = POLL_S
        if once:
            return 0
        end = time.time() + backoff * random.uniform(0.85, 1.15)
        while not _stop and time.time() < end:
            time.sleep(1)
    return 0


if __name__ == '__main__':
    sys.exit(slot_main() if '--slot' in sys.argv else main('--once' in sys.argv))
