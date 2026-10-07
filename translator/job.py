#!/usr/bin/env python3
"""העובד בענן של סטודיו התרגום (THE SNOWBALL) — הלקוח לשרתון. שלב 2: "בדיקת חיבור".

רץ בסשן ש־Routine של המשתמש פותח (לפי translator/RUNBOOK.md):
    python3 translator/job.py run --job <מזהה העבודה> --key <מפתח העבודה>

רק ספריות מובנות של Python. אף פעם לא מדפיס את מפתח העבודה או את הגישה ל־Drive.
השרתון קבוע בקוד (לא מגיע מההודעה שהפעילה את הסשן): הטקסט שמגיע בהפעלה מסומן "לא מהימן",
ולכן ממנו נלקחים רק שני ערכים, שנבדקים כאן בצורה קפדנית.
"""
import argparse
import json
import re
import sys
import time
import urllib.error
import urllib.request

SERVER = 'https://ibkr-proxy-wine.vercel.app'
DRIVE_API = 'https://www.googleapis.com/drive/v3'
JOB_RE = re.compile(r'^j[A-Za-z0-9_-]{20}$')
KEY_RE = re.compile(r'^[A-Za-z0-9_-]{43}$')
LOCAL_RE = re.compile(r'^http://(127\.0\.0\.1|localhost)(:\d{1,5})?$')   # רק לבדיקות (tests/studio-worker-v355)
UA = 'snb-studio-worker/1'


class Stop(Exception):
    """השרתון אמר לעצור (העבודה בוטלה / הסתיימה / המפתח לא תקף)."""


def http(method, url, body=None, headers=None, timeout=30):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=dict({'User-Agent': UA}, **(headers or {})))
    if data is not None:
        req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read() or b'{}'), dict(r.headers)
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read() or b'{}')
        except ValueError:
            payload = {}
        return e.code, payload, dict(e.headers or {})


def denied(headers):
    """הרשת של הסביבה חסמה את השרת (Claude Code מחזיר 403 עם x-deny-reason)."""
    return any(k.lower() == 'x-deny-reason' for k in (headers or {}))


class Client:
    def __init__(self, server, job, key):
        self.url = server.rstrip('/') + '/api/studio'
        self.host = re.sub(r'^https?://', '', server).split('/')[0]
        self.job, self.key = job, key

    def call(self, op, **extra):
        body = dict(extra, op=op, job=self.job, key=self.key)
        for attempt in range(4):
            try:
                st, j, hd = http('POST', self.url, body)
            except (urllib.error.URLError, TimeoutError, OSError):
                st, j, hd = 0, {}, {}
            if st == 403 and denied(hd):
                raise SystemExit('✗ הרשת של הסביבה חוסמת את ' + self.host + ' — צריך להוסיף אותו ל־Allowed domains של הסביבה.')
            if j.get('stop'):
                raise Stop(j.get('state') or j.get('error') or 'stop')
            if st == 200 and j.get('ok'):
                return j
            if st in (0, 429) or st >= 500:
                time.sleep(2 ** attempt)
                continue
            raise SystemExit('✗ השרתון החזיר ' + str(st) + ' ' + str(j.get('error') or ''))
        raise SystemExit('✗ השרתון לא עונה (' + self.host + ')')


def drive_ok(token, api):
    """האם הגישה ל־Drive עובדת מתוך הסשן (רשת + הרשאה). בלי להדפיס את הגישה."""
    if not token:
        return False
    try:
        st, j, _ = http('GET', api + '/about?fields=user(emailAddress)', headers={'Authorization': 'Bearer ' + token}, timeout=20)
    except (urllib.error.URLError, TimeoutError, OSError):
        return False
    return st == 200 and bool((j.get('user') or {}).get('emailAddress'))


def run(args):
    c = Client(args.server, args.job, args.key)
    try:
        got = c.call('claim')
        job = got.get('job') or {}
        token = (got.get('drive') or {}).get('token') or ''
        if job.get('kind') == 'ping':
            d = drive_ok(token, args.drive_api)
            c.call('report', done=True, checks={'drive': d}, msg='החיבור תקין' if d else 'החיבור תקין, אבל אין גישה ל־Drive מהסשן')
            print('✓ בדיקת החיבור הסתיימה: השרתון ✓ · Drive ' + ('✓' if d else '✗'))
            return 0
        # שלב 2: העובד יודע רק "בדיקת חיבור" (השרתון לא מפעיל עבודות תרגום עד שלב 3)
        c.call('report', fail=True, err='worker_not_ready')
        print('✗ עבודת תרגום — העובד המלא מגיע בשלב 3. סומן בשרתון.')
        return 1
    except Stop as e:
        print('■ השרתון ביקש לעצור (' + str(e) + ').')
        return 2


def main(argv=None):
    p = argparse.ArgumentParser(description='העובד בענן של סטודיו התרגום')
    sub = p.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('run', help='ביצוע העבודה שבהודעה')
    r.add_argument('--job', required=True)
    r.add_argument('--key', required=True)
    r.add_argument('--server', default=SERVER, help=argparse.SUPPRESS)
    r.add_argument('--drive-api', default=DRIVE_API, help=argparse.SUPPRESS)
    a = p.parse_args(argv)
    if not JOB_RE.match(a.job) or not KEY_RE.match(a.key):
        print('✗ מזהה העבודה או המפתח לא בצורה הנכונה (job=j + 20 תווים, key = 43 תווים).')
        return 1
    if a.server != SERVER and not LOCAL_RE.match(a.server):
        print('✗ שרת לא מוכר.')
        return 1
    if a.drive_api != DRIVE_API and not LOCAL_RE.match(re.sub(r'/drive/v3$', '', a.drive_api)):
        print('✗ שרת Drive לא מוכר.')
        return 1
    return run(a)


if __name__ == '__main__':
    sys.exit(main())
