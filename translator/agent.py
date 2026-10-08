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


def poll(server: str, tok: str) -> dict:
    """{'job': {'id', 'key', 'kind'}} או {'job': None}. שגיאה → {'error': ...} (הלולאה מחכה ומנסה שוב)."""
    try:
        st, j, hd = J.http('POST', server + '/api/studio', {'op': 'poll', 'v': 1},
                           headers={'Authorization': 'Bearer ' + tok}, timeout=30)
    except (OSError, ValueError) as e:
        return {'error': 'network', 'detail': type(e).__name__}
    if st == 200 and j.get('ok'):
        jb = j.get('job')
        if isinstance(jb, dict) and J.JOB_RE.match(str(jb.get('id') or '')) and J.KEY_RE.match(str(jb.get('key') or '')):
            return {'job': {'id': jb['id'], 'key': jb['key'], 'kind': jb.get('kind') or 'tr'}}
        return {'job': None}
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


def beat_loop():
    while not _stop:
        heartbeat()
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


def handle(jb: dict, server: str) -> int:
    J.VT_WORK.mkdir(parents=True, exist_ok=True)
    BUSY.write_text(jb['id'])
    try:
        base = ['run', '--job', jb['id'], '--key', jb['key']]
        if server != J.SERVER:                 # בדיקות בלבד (localhost) — job.py בודק שוב בעצמו
            base += ['--server', server]
            if os.environ.get('SNB_DRIVE_API'):
                base += ['--drive-api', os.environ['SNB_DRIVE_API']]
        rc = run_child(base, RUN_TIMEOUT_S)
        if rc == 0 and jb.get('kind') == 'tr':
            rc = run_child(['auto'], AUTO_TIMEOUT_S)
            if rc == 124:
                try:
                    J.Ctx(J.load_state()).report(fail=True, err='job_timeout', msg='העבודה חרגה מהזמן המרבי', force=True,
                                                 usage=J.usage_safe())
                except BaseException:     # noqa: BLE001 — הדיווח משני; הניקוי חשוב יותר
                    pass
        return rc
    finally:
        cleanup()
        try:
            BUSY.unlink()
        except OSError:
            pass


def main(once: bool = False) -> int:
    signal.signal(signal.SIGTERM, _on_term)
    signal.signal(signal.SIGINT, _on_term)
    server, tok = server_url(), token()
    cleanup()                                  # שאריות מהפעלה קודמת שנקטעה (כיבוי, עדכון)
    print('✓ הסוכן פעיל — שואל את השרתון אם יש עבודה', flush=True)
    if not once:
        threading.Thread(target=beat_loop, daemon=True).start()
    backoff = POLL_S
    while not _stop:
        r = poll(server, tok)
        if r.get('job'):
            print('→ עבודה ' + r['job']['id'][:6] + '…', flush=True)
            rc = handle(r['job'], server)
            print('← סיום (' + str(rc) + ')', flush=True)
            backoff = POLL_S
            if once:
                return rc
            continue
        if r.get('error'):
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
