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


def poll(server: str, tok: str, op: str = 'poll', busy: str = '') -> dict:
    """{'job': {'id', 'key', 'kind'}} או {'job': None}. שגיאה → {'error': ...} (הלולאה מחכה ומנסה שוב).
    op='beat' — רק דופק (באמצע עבודה), בלי לבקש עבודה."""
    try:
        hb = host_info(busy)
        hb['ev'] = ev_list()
        body = {'op': op, 'v': 1, 'hb': hb}
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
            return {'job': {'id': jb['id'], 'key': jb['key'], 'kind': jb.get('kind') or 'tr'}}
        return {'job': None, 'paused': j.get('paused') is True}
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


def met_sample() -> dict:
    hb = host_info(_busy)
    d = {'t': int(time.time()), 'cpu': cpu_pct(), 'mem': hb.get('mem'), 'disk': hb.get('disk'), 'free': hb.get('free'), 'load': hb.get('load')}
    if _busy:
        pr = _prog()
        d.update({'j': _busy, 'st': str(pr.get('st') or '')[:24], 'p': pr.get('p')})
        if _child['pid']:
            d['rss'] = sum(x.get('rss') or 0 for x in proc_snapshot(_child['pid']))
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
        J.Ctx(st).report(fail=True, err='worker_lost', msg='השרת הופעל מחדש באמצע העבודה', force=True)
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


def _prog() -> dict:
    try:
        return json.loads((J.STATE.parent / 'prog.json').read_text(encoding='utf-8'))
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
         'ver': os.environ.get('SNB_VERSION', 'dev')[:12]}
    if stack:
        d['stack'] = stack
    if ps:
        d['ps'] = ps
    if kind == 'end':
        d['stack'] = d.get('stack') or _read(DEV_DIR / 'stack.txt', 64 * 1024).decode('utf-8', 'replace')
    return bool(dev_send(server, tok, 'devLog', {k: v for k, v in d.items() if v not in (None, '')}).get('saved'))


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
    try:
        base = ['run', '--job', jb['id'], '--key', jb['key']]
        if server != J.SERVER:                 # שרתון הניסוי או localhost בבדיקות — job.py בודק שוב בעצמו
            base += ['--server', server]
            if os.environ.get('SNB_DRIVE_API') and J.LOCAL_RE.match(server):
                base += ['--drive-api', os.environ['SNB_DRIVE_API']]
        rc = run_child(base, RUN_TIMEOUT_S)
        if rc == 0 and jb.get('kind') == 'tr':
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
        _busy = ''
        _child['started'] = 0.0
        cleanup()
        try:
            BUSY.unlink()
        except OSError:
            pass


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
    sys.exit(main('--once' in sys.argv))
