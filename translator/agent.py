"""הסוכן של השרת (מצב "API של המערכת") — לולאה ששואלת את השרתון אם יש עבודה, מריצה אותה ומנקה אחריה.

אבטחה — למה כך:
  • השרת לא פותח אף פורט. הוא זה שפונה החוצה (poll), ולכן אין לאן להתחבר אליו מבחוץ.
  • הזדהות מול השרתון: טוקן שרת (SNB_WORKER_TOKEN) בכותרת Authorization — השרתון שומר רק את ה־hash שלו.
  • כתובת השרתון קבועה בקוד (job.SERVER); רק localhost מותר לעקוף, ורק לבדיקות.
  • עבודה אחת בכל רגע. בסוף כל עבודה — מחיקה של כל קובצי העבודה (סרטונים, תמלילים, תרגומים): הם חיים
    ב־Drive של המשתמש, לא על השרת.
  • המפתחות (ANTHROPIC_API_KEY, SNB_WORKER_TOKEN) מגיעים ממשתני הסביבה של הקונטיינר ולא מודפסים לעולם.

קובץ /work/.busy קיים בזמן עבודה — כך המעדכן (snb-update) לא מחליף גרסה באמצע תרגום.
"""

from __future__ import annotations

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
    if s != J.SERVER and not J.LOCAL_RE.match(s):
        raise SystemExit('✗ שרת לא מוכר (מותר רק השרתון הקבוע או localhost לבדיקות).')
    return s.rstrip('/')


def token() -> str:
    t = os.environ.get('SNB_WORKER_TOKEN', '')
    if not TOKEN_RE.match(t):
        raise SystemExit('✗ חסר SNB_WORKER_TOKEN תקין בסודות של השרת.')
    return t


def host_info(busy: str = '') -> dict:
    """מצב השרת למסך השרת באפליקציה — מספרים בלבד (בלי שמות קבצים, בלי תוכן). כל ערך שלא נמדד — לא נשלח."""
    hb = {'v': os.environ.get('SNB_VERSION', 'dev')[:12], 'busy': busy}
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


def poll(server: str, tok: str, op: str = 'poll', busy: str = '') -> dict:
    """{'job': {'id', 'key', 'kind'}} או {'job': None}. שגיאה → {'error': ...} (הלולאה מחכה ומנסה שוב).
    op='beat' — רק דופק (באמצע עבודה), בלי לבקש עבודה."""
    try:
        st, j, hd = J.http('POST', server + '/api/studio', {'op': op, 'v': 1, 'hb': host_info(busy)},
                           headers={'Authorization': 'Bearer ' + tok}, timeout=30)
    except (OSError, ValueError) as e:
        return {'error': 'network', 'detail': type(e).__name__}
    if st == 401:
        return {'error': 'auth'}          # הטוקן בוטל (השרת הוסר באפליקציה) — מחכים הרבה, לא מציפים
    if st == 200 and j.get('ok'):
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


def beat_loop(server: str = '', tok: str = ''):
    while not _stop:
        heartbeat()
        if server and _busy:
            poll(server, tok, 'beat', _busy)      # באמצע עבודה: מסך השרת יודע שהוא חי ועל מה הוא עובד
        for _ in range(BEAT_S):
            if _stop:
                return
            time.sleep(1)


def cleanup():
    """מחיקה של כל מה שהעבודה השאירה על הדיסק — כולל הסרטונים. המודלים (מטמון) נשארים."""
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


def run_child(args: list[str], timeout: int) -> int:
    cmd = [sys.executable, str(HERE / 'job.py')] + args
    try:
        return subprocess.run(cmd, cwd=str(HERE.parent), timeout=timeout).returncode
    except subprocess.TimeoutExpired:
        print('✗ העבודה חרגה מהזמן המרבי — נעצרה.', flush=True)
        return 124


def crash_code(rc: int) -> str:
    """קוד היציאה של job.py auto → קוד שגיאה לדיווח, או '' כשאין מה לדווח (0 = הצליח, 1 = כבר דיווח, 2 = "עצור")."""
    if rc in (0, 1, 2):
        return ''
    if rc == 124:
        return 'job_timeout'
    if rc in (137, -9) or rc < 0:
        return 'worker_oom' if rc in (137, -9) else 'worker_crash'
    return 'worker_crash'


def handle(jb: dict, server: str) -> int:
    global _busy
    J.VT_WORK.mkdir(parents=True, exist_ok=True)
    BUSY.write_text(jb['id'])
    _busy = jb['id']
    try:
        base = ['run', '--job', jb['id'], '--key', jb['key']]
        if server != J.SERVER:                 # בדיקות בלבד (localhost) — job.py בודק שוב בעצמו
            base += ['--server', server]
            if os.environ.get('SNB_DRIVE_API'):
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
        _busy = ''
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
    t = threading.Thread(target=run, daemon=True)
    t.start()
    return t


def main(once: bool = False) -> int:
    signal.signal(signal.SIGTERM, _on_term)
    signal.signal(signal.SIGINT, _on_term)
    server, tok = server_url(), token()
    cleanup()                                  # שאריות מהפעלה קודמת שנקטעה (כיבוי, עדכון)
    warm = None if once else start_warm()
    print('✓ הסוכן פעיל — שואל את השרתון אם יש עבודה', flush=True)
    if not once:
        threading.Thread(target=beat_loop, args=(server, tok), daemon=True).start()
    backoff = POLL_S
    while not _stop:
        r = poll(server, tok)
        if r.get('job'):
            print('→ עבודה ' + r['job']['id'][:6] + '…', flush=True)
            if warm is not None and warm.is_alive():
                warm.join(WARM_WAIT_S)           # ההורדה מראש עוד רצה — העבודה הייתה מורידה את אותם קבצים בעצמה
            rc = handle(r['job'], server)
            print('← סיום (' + str(rc) + ')', flush=True)
            backoff = POLL_S
            if once:
                return rc
            continue
        if r.get('error') == 'auth':
            backoff = MAX_BACKOFF_S
            print('✗ השרתון לא מכיר את טוקן השרת (בוטל באפליקציה?) — snb-setup עם טוקן חדש', flush=True)
        elif r.get('error'):
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
