#!/usr/bin/env python3
"""העובד בענן של סטודיו התרגום (THE SNOWBALL) — הלקוח לשרתון, ומ־v358 גם מנהל העבודה של vt.

רץ בסשן ש־Routine של המשתמש פותח (לפי translator/RUNBOOK.md):
    python3 translator/job.py run --job <מזהה העבודה> --key <מפתח העבודה>
"בדיקת חיבור" מסתיימת שם. עבודת תרגום ממשיכה בפקודות קצרות (הפרטים נשמרים בקובץ פרטי בבית של הסשן):
    prepare → (הגהה) → align → (תרגום וביקורת, עם stage) → finish     ·  fail אם משהו נתקע

רק ספריות מובנות של Python. אף פעם לא מדפיס את מפתח העבודה או את הגישה ל־Drive.
השרתון קבוע בקוד (לא מגיע מההודעה שהפעילה את הסשן): הטקסט שמגיע בהפעלה מסומן "לא מהימן",
ולכן ממנו נלקחים רק שני ערכים, שנבדקים כאן בצורה קפדנית.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
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


HERE = Path(__file__).resolve().parent
STATE = Path(os.environ.get('SNB_STATE', str(Path.home() / '.snb-studio'))) / 'job.json'
VT_PY = os.environ.get('VT_PY', str(Path.home() / '.vt-venv' / 'bin' / 'python'))
VT_WORK = Path(os.environ.get('VT_WORK', str(Path.home() / 'vt-work')))
VT_BIN = Path(os.environ.get('VT_BIN', str(Path.home() / '.vt-bin')))
STAGES = ('up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv')
ERR_RE = re.compile(r'^[a-z0-9_]{1,40}$')
CHUNK = 32 * 1024 * 1024        # העלאה ל־Drive: כפולה של 256KB


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
        if job.get('kind') != 'tr':
            c.call('report', fail=True, err='worker_unknown_kind')
            print('✗ סוג עבודה לא מוכר — סומן בשרתון.')
            return 1
        spec = job.get('spec') or {}
        if spec.get('from') not in ('auto', 'en', None) or 'he' not in (spec.get('to') or []):
            # vt מתרגם כרגע מאנגלית לעברית בלבד (שפות נוספות — שלב 7)
            c.call('report', fail=True, err='lang_unsupported', msg='כרגע רק מאנגלית לעברית')
            print('✗ זוג השפות עוד לא נתמך (כרגע אנגלית → עברית). סומן בשרתון.')
            return 1
        save_state({'job': args.job, 'key': args.key, 'server': args.server, 'drive_api': args.drive_api,
                    'folder': job.get('folder') or '', 'spec': spec, 'files': job.get('files') or {}})
        print('✓ עבודת תרגום נלקחה: ' + spec_line(spec))
        if start_setup_bg():
            print('· מנועי התמלול מותקנים ברקע (prepare ימתין להם בעצמו)')
        print('הצעד הבא (ברקע, run_in_background): python3 translator/job.py prepare')
        return 0
    except Stop as e:
        print('■ השרתון ביקש לעצור (' + str(e) + ').')
        return 2


# ---------------------------------------------------------------- מצב העבודה בסשן
def save_state(st):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.chmod(STATE.parent, 0o700)
    except OSError:
        pass
    tmp = STATE.with_suffix('.tmp')
    tmp.write_text(json.dumps(st, ensure_ascii=False), encoding='utf-8')
    os.chmod(tmp, 0o600)                      # מפתח העבודה — רק למשתמש של הסשן
    tmp.replace(STATE)


def load_state():
    try:
        st = json.loads(STATE.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        raise SystemExit('✗ אין עבודה פעילה בסשן — קודם: python3 translator/job.py run --job … --key …')
    if not JOB_RE.match(st.get('job', '')) or not KEY_RE.match(st.get('key', '')):
        raise SystemExit('✗ קובץ העבודה לא תקין.')
    return st


def spec_line(spec):
    mins = round((spec.get('dur') or 0) / 60)
    return '"' + str(spec.get('name') or '') + '"' + (' · ' + str(mins) + ' דק׳' if mins else '') + \
        ' · מצב ' + str(spec.get('mode') or 'opus-medium') + ' · תוצרים: ' + '+'.join((spec.get('out') or []) + ['srt'])


class Ctx:
    """עבודה פעילה: לקוח לשרתון, גישה ל־Drive ודיווח התקדמות (לכל היותר פעם ב־15 שנ׳ לאותו שלב)."""

    def __init__(self, st):
        self.st = st
        self.c = Client(st['server'], st['job'], st['key'])
        self.api = st['drive_api']
        self.upload = re.sub(r'/drive/v3$', '/upload/drive/v3', st['drive_api'])
        self.tok, self.tok_at = '', 0
        self.last = (None, 0.0, -1.0)

    @property
    def name(self):
        return self.st['job']

    @property
    def pdir(self):
        return VT_WORK / self.name

    def token(self, force=False):
        if force or not self.tok or time.time() - self.tok_at > 45 * 60:
            d = self.c.call('token').get('drive') or {}
            if not d.get('token'):
                raise SystemExit('✗ אין גישה ל־Drive (' + str(d.get('error') or 'drive') + ') — לחבר את Drive בהגדרות הסטודיו.')
            self.tok, self.tok_at = d['token'], time.time()
        return self.tok

    def report(self, st=None, p=None, msg=None, force=False, **extra):
        now = time.time()
        if not force and not extra and st == self.last[0] and now - self.last[1] < 15 and abs((p or 0) - self.last[2]) < 0.1:
            return                                  # אותו שלב, פחות מ־15 שנ׳ ופחות מ־10% — לא שווה כתיבה
        body = dict(extra)
        if st:
            body['st'] = st
        if p is not None:
            body['p'] = round(max(0.0, min(1.0, p)), 3)
        if msg:
            body['msg'] = msg
        self.c.call('report', **body)
        self.last = (st, now, p if p is not None else -1.0)

    def refresh(self):
        """פרטי העבודה העדכניים (הקבצים מהטלפון ממשיכים לעלות אחרי שהעבודה התחילה)."""
        job = self.c.call('claim').get('job') or {}
        self.st['files'] = job.get('files') or {}
        self.st['folder'] = job.get('folder') or self.st.get('folder', '')
        save_state(self.st)
        return job


# ---------------------------------------------------------------- Drive
def drive_download(ctx, fid, dest, size, on_progress=None):
    """הורדה בזרם, עם המשך מאותו בייט אחרי ניתוק (Range) וגישה חדשה כשפגה."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tries = 0
    while True:
        have = dest.stat().st_size if dest.exists() else 0
        if size and have >= size:
            return dest
        req = urllib.request.Request(ctx.api + '/files/' + fid + '?alt=media&supportsAllDrives=true',
                                     headers={'Authorization': 'Bearer ' + ctx.token(tries > 0), 'User-Agent': UA})
        if have:
            req.add_header('Range', 'bytes=' + str(have) + '-')
        try:
            with urllib.request.urlopen(req, timeout=60) as r, open(dest, 'ab' if have and r.status == 206 else 'wb') as f:
                got = have if r.status == 206 else 0
                while True:
                    b = r.read(8 * 1024 * 1024)
                    if not b:
                        break
                    f.write(b)
                    got += len(b)
                    if on_progress and size:
                        on_progress(got / size)
            if not size or dest.stat().st_size >= size:
                return dest
        except urllib.error.HTTPError as e:
            if e.code == 403 and denied(dict(e.headers or {})):
                raise SystemExit('✗ הרשת של הסביבה חוסמת את Drive — להוסיף www.googleapis.com ל־Allowed domains.')
            if e.code not in (401, 429) and e.code < 500:
                raise SystemExit('✗ ההורדה מ־Drive נכשלה (' + str(e.code) + ').')
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        tries += 1
        if tries > 8:
            raise SystemExit('✗ ההורדה מ־Drive נקטעה שוב ושוב.')
        time.sleep(min(30, 2 ** tries))


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k):
        return None


_OPEN = urllib.request.build_opener(_NoRedirect).open      # ב־Drive ‏308 = "התקבל חלקית", לא הפניה


def drive_upload(ctx, path, name, kind, mime, on_progress=None):
    """העלאה מתחדשת לתיקיית העבודה. מחזיר את מזהה הקובץ ב־Drive."""
    size = path.stat().st_size
    meta = {'name': name, 'parents': [ctx.st['folder']], 'appProperties': {'snbJob': ctx.name, 'snbOut': kind}}
    st, j, hd = http('POST', ctx.upload + '/files?uploadType=resumable&fields=id',
                     meta, headers={'Authorization': 'Bearer ' + ctx.token(), 'X-Upload-Content-Type': mime,
                                    'X-Upload-Content-Length': str(size)})
    if st == 401:
        st, j, hd = http('POST', ctx.upload + '/files?uploadType=resumable&fields=id',
                         meta, headers={'Authorization': 'Bearer ' + ctx.token(True), 'X-Upload-Content-Type': mime,
                                        'X-Upload-Content-Length': str(size)})
    loc = next((v for k, v in hd.items() if k.lower() == 'location'), '')
    if st != 200 or not loc:
        raise SystemExit('✗ פתיחת העלאה ל־Drive נכשלה (' + str(st) + ').')
    sent, tries = 0, 0
    with open(path, 'rb') as f:
        while True:
            f.seek(sent)
            data = f.read(CHUNK)
            end = sent + len(data) - 1
            req = urllib.request.Request(loc, data=data, method='PUT', headers={
                'Content-Range': ('bytes %d-%d/%d' % (sent, end, size)) if data else 'bytes */%d' % size, 'User-Agent': UA})
            try:
                with _OPEN(req, timeout=300) as r:
                    out = json.loads(r.read() or b'{}')
                    if out.get('id'):
                        return out['id']
                    raise SystemExit('✗ Drive לא החזיר מזהה לקובץ.')
            except urllib.error.HTTPError as e:
                if e.code == 308:                                  # החתיכה התקבלה — ממשיכים ממה ש־Drive אישר
                    rng = e.headers.get('Range') or ''
                    sent = int(rng.split('-')[-1]) + 1 if rng else 0
                    tries = 0
                    if on_progress:
                        on_progress(sent / size)
                    continue
                if e.code not in (429,) and e.code < 500:
                    raise SystemExit('✗ ההעלאה ל־Drive נכשלה (' + str(e.code) + ').')
            except (urllib.error.URLError, TimeoutError, OSError):
                pass
            tries += 1
            if tries > 8:
                raise SystemExit('✗ ההעלאה ל־Drive נקטעה שוב ושוב.')
            time.sleep(min(30, 2 ** tries))
            # אחרי תקלה — שואלים את Drive כמה הגיע
            q = urllib.request.Request(loc, data=b'', method='PUT', headers={'Content-Range': 'bytes */%d' % size, 'User-Agent': UA})
            try:
                with _OPEN(q, timeout=60) as r:
                    out = json.loads(r.read() or b'{}')
                    if out.get('id'):
                        return out['id']
            except urllib.error.HTTPError as e:
                if e.code == 308:
                    rng = e.headers.get('Range') or ''
                    sent = int(rng.split('-')[-1]) + 1 if rng else 0
            except (urllib.error.URLError, TimeoutError, OSError):
                pass


# ---------------------------------------------------------------- vt
def vt_env():
    env = dict(os.environ, VT_WORK=str(VT_WORK), PYTHONUNBUFFERED='1')
    if VT_BIN.is_dir():
        env['PATH'] = str(VT_BIN) + os.pathsep + env.get('PATH', '')
    return env


def vt(ctx, args, stage=None, lo=0.0, hi=1.0):
    """מריץ פקודת vt. שורת סיכום לכל פקודה; אחוזים מהפלט הולכים לשרתון כהתקדמות השלב."""
    proc = subprocess.Popen([VT_PY, '-m', 'vt'] + args, cwd=str(HERE), env=vt_env(),
                            stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
    tail = []
    for line in proc.stdout:
        line = line.rstrip()
        tail = (tail + [line])[-12:]
        m = re.search(r'(\d{1,3}(?:\.\d)?)%', line)
        if stage and m:
            try:
                ctx.report(stage, lo + (hi - lo) * min(1.0, float(m.group(1)) / 100))
            except Stop:
                proc.kill()
                raise
    rc = proc.wait()
    if rc != 0:
        print('\n'.join(tail))
        raise SystemExit('✗ vt ' + args[0] + ' נכשל (קוד ' + str(rc) + ').')
    print('✓ vt ' + args[0] + (': ' + tail[-1] if tail else ''))
    return tail


def env_ready():
    probe = [VT_PY, '-c', 'import numpy, soundfile, onnx_asr, torch, torchaudio, qwen_asr']
    return os.path.exists(VT_PY) and subprocess.run(probe, capture_output=True).returncode == 0


SETUP_PID = STATE.parent / 'setup.pid'


def setup_cmd():
    return os.environ.get('SNB_SETUP', 'bash ' + str(HERE / 'setup.sh')).split()


def start_setup_bg():
    """v358: מנוע שחסר בתמונת המצב של הסביבה (setup.sh השתנה מאז שנבנתה) מותקן ברקע מרגע לקיחת העבודה —
    במקביל להעלאת הסרטון, להורדה ולקריאת מדריך הסגנון. כך אין צורך לעדכן ידנית את סקריפט ההתקנה ב־claude.ai:
    תמונת המצב מתרעננת לבד בערך פעם בשבוע (ומושכת את setup.sh העדכני מהריפו), ובינתיים זה קורה כאן."""
    if env_ready():
        return False
    STATE.parent.mkdir(parents=True, exist_ok=True)
    log = open(STATE.parent / 'setup.log', 'ab')
    p = subprocess.Popen(setup_cmd(), stdout=log, stderr=log, stdin=subprocess.DEVNULL, start_new_session=True)
    SETUP_PID.write_text(str(p.pid))
    return True


def setup_running():
    try:
        pid = int(SETUP_PID.read_text())
        os.kill(pid, 0)
    except (OSError, ValueError):
        return False
    try:                                         # תהליך שהסתיים אבל עוד לא נאסף (zombie) — לא "רץ"
        st = Path('/proc/%d/stat' % pid).read_text().split()
        return st[2] != 'Z'
    except OSError:
        return True


def ensure_env(ctx):
    """המנועים מותקנים? אם ההתקנה ברקע עוד רצה — מחכים לה; אם לא התחילה — מריצים עכשיו."""
    if env_ready():
        return
    ctx.report('tr', 0, 'משלים את התקנת המנועים', force=True)
    waited = 0
    while setup_running() and waited < 25 * 60:
        time.sleep(3)
        waited += 3
    if not env_ready():
        subprocess.run(setup_cmd(), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    if not env_ready():
        raise SystemExit('✗ ההתקנה של מנועי התמלול נכשלה — אולי הרשת של הסביבה חוסמת (Hugging Face / PyTorch).')


def guarded(fn):
    def wrap(args):
        try:
            return fn(args)
        except Stop as e:
            print('■ השרתון ביקש לעצור (' + str(e) + ').')
            return 2
    return wrap


@guarded
def prepare(args):
    ctx = Ctx(load_state())
    poll = float(os.environ.get('SNB_POLL', '30'))
    n = 0
    while not (ctx.st.get('files') or {}).get('v'):
        if n == 0:
            print('מחכה שהסרטון יסיים לעלות מהטלפון…')
        if n % 10 == 0:                          # פעם בחמש דקות מספיק — הטלפון מציג את ההעלאה בעצמו
            ctx.report('up', None, 'מחכה שהסרטון יסיים לעלות', force=True)
        time.sleep(poll)
        n += 1
        if n * poll > 12 * 3600:
            ctx.report(fail=True, err='upload_timeout', force=True)
            raise SystemExit('✗ הסרטון לא הגיע תוך 12 שעות.')
        ctx.refresh()
    v = ctx.st['files']['v']
    ext = (os.path.splitext(v.get('name') or '')[1] or '.mp4').lower()
    if not re.match(r'^\.[a-z0-9]{2,5}$', ext):
        ext = '.mp4'
    src = VT_WORK / '_in' / (ctx.name + ext)
    ctx.report('tr', 0, 'מוריד את הסרטון מ־Drive', force=True)
    drive_download(ctx, v['id'], src, int(v.get('size') or 0), lambda f: ctx.report('tr', 0.1 * f, 'מוריד את הסרטון מ־Drive'))
    ensure_env(ctx)                              # ההורדה רצה בינתיים; ההתקנה (אם חסרה) כבר רצה ברקע מאז run
    title = os.path.splitext(str(ctx.st['spec'].get('name') or ctx.name))[0][:120]
    vt(ctx, ['new', ctx.name, '--source', str(src), '--title', title, '--force'])
    vt(ctx, ['ingest', ctx.name])
    ctx.report('tr', 0.15, 'כותבים כל מילה שנאמרת', force=True)
    vt(ctx, ['asr', ctx.name, '--engine', 'parakeet'], 'tr', 0.15, 0.95)
    vt(ctx, ['shots', ctx.name])
    vt(ctx, ['edit-export', ctx.name])
    ctx.report('tr', 1, 'התמליל מוכן — Claude מגיה אותו', force=True)
    print('✓ התמלול הסתיים.')
    print('ההגהה: ' + str(ctx.pdir / 'en.edit.txt') + '  →  תיקונים ב־' + str(ctx.pdir / 'en.patch.txt'))
    print('אחר כך (ברקע): python3 translator/job.py align')
    return 0


@guarded
def align(args):
    ctx = Ctx(load_state())
    vt(ctx, ['edit-import', ctx.name])
    ctx.report('al', 0, 'מתאימים כל מילה לרגע שבו נאמרה', force=True)
    vt(ctx, ['align', ctx.name], 'al', 0.0, 0.9)
    vt(ctx, ['plan', ctx.name])
    vt(ctx, ['tr-prep', ctx.name])
    ctx.report('al', 1, 'הכתוביות מתוכננות — מתחילים לתרגם', force=True)
    print('✓ היישור והתכנון הסתיימו. לתרגום: ' + str(ctx.pdir / 'tr' / 'source.md'))
    return 0


@guarded
def stage(args):
    ctx = Ctx(load_state())
    if args.st not in STAGES:
        raise SystemExit('✗ שלב לא מוכר: ' + ', '.join(STAGES))
    ctx.report(args.st, args.p, args.msg, force=True)
    print('✓ דווח: ' + args.st + ('' if args.p is None else ' %d%%' % round(args.p * 100)))
    return 0


@guarded
def fail(args):
    ctx = Ctx(load_state())
    err = args.err if ERR_RE.match(args.err or '') else 'worker'
    ctx.report(fail=True, err=err, msg=args.msg, force=True)
    print('✓ העבודה סומנה "נכשלה" (' + err + ').')
    return 0


def vt_cmd(args):
    """קיצור לסשן: פקודת vt על הפרויקט של העבודה, עם הסביבה הנכונה (למשל: job.py vt tr-check)."""
    st = load_state()
    rest = list(args.rest)
    if not rest:
        raise SystemExit('✗ חסרה פקודה, למשל: python3 translator/job.py vt tr-check')
    cmd = [VT_PY, '-m', 'vt', rest[0]] + ([st['job']] if rest[0] not in ('doctor', 'drive') else []) + rest[1:]
    return subprocess.run(cmd, cwd=str(HERE), env=vt_env()).returncode


OUT_FILES = (                                     # (סוג, קובץ של vt, סיומת לשם, mime)
    ('compact', '{n}.he.compact.mp4', ' (עברית).mp4', 'video/mp4'),
    ('same', '{n}.he.mp4', ' (עברית, איכות מקור).mp4', 'video/mp4'),
    ('mkv', '{n}.he.mkv', ' (עברית).mkv', 'video/x-matroska'),
    ('srt', 'he.srt', '.he.srt', 'application/x-subrip'),
)


@guarded
def finish(args):
    ctx = Ctx(load_state())
    spec = ctx.st.get('spec') or {}
    want = [k for k in (spec.get('out') or []) if k in ('compact', 'same', 'mkv')]
    errs = re.findall(r'שגיאות (\d+)', '\n'.join(vt(ctx, ['tr-check', ctx.name])))
    if (not errs or int(errs[-1]) > 0) and not args.force:
        raise SystemExit('✗ tr-check מצא שגיאות — לתקן ב־tr/fixes_zfinal.txt ולהריץ שוב: grep -A2 "שגיא" ' + str(ctx.pdir / 'tr' / 'check.md'))
    vt(ctx, ['tr-merge', ctx.name])
    vt(ctx, ['build', ctx.name])
    if want:
        ctx.report('bn', 0, 'מוסיפים את הכתוביות לסרטון', force=True)
        flags = (['--compact'] if 'compact' in want else []) + (['--burn'] if 'same' in want else []) + (['--mkv'] if 'mkv' in want else [])
        vt(ctx, ['render', ctx.name] + flags, 'bn', 0.0, 1.0)
    ctx.report('sv', 0, 'שומרים את התוצרים ב־Drive', force=True)
    title = os.path.splitext(str(spec.get('name') or ctx.name))[0][:120]
    out, total = [], 0
    files = []
    for k, fname, suffix, mime in OUT_FILES:
        if k != 'srt' and k not in want:
            continue
        p = ctx.pdir / 'out' / fname.format(n=ctx.name)
        if not p.exists():
            raise SystemExit('✗ התוצר ' + p.name + ' לא נוצר.')
        files.append((k, p, title + suffix, mime))
        total += p.stat().st_size
    done = 0
    for k, p, name, mime in files:
        base = done
        fid = drive_upload(ctx, p, name, k, mime, lambda f, b=base, s=p.stat().st_size: ctx.report('sv', (b + f * s) / max(1, total)))
        done += p.stat().st_size
        out.append({'id': fid, 'name': name, 'size': p.stat().st_size, 'k': k})
    ctx.report(done=True, out=out, msg='התרגום מוכן', force=True)
    print('✓ העבודה הסתיימה: ' + ', '.join(o['name'] for o in out))
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(description='העובד בענן של סטודיו התרגום')
    sub = p.add_subparsers(dest='cmd', required=True)
    r = sub.add_parser('run', help='לקיחת העבודה שבהודעה ("בדיקת חיבור" מסתיימת כאן)')
    r.add_argument('--job', required=True)
    r.add_argument('--key', required=True)
    r.add_argument('--server', default=SERVER, help=argparse.SUPPRESS)
    r.add_argument('--drive-api', default=DRIVE_API, help=argparse.SUPPRESS)
    sub.add_parser('prepare', help='הורדה, קליטה, תמלול וקובץ ההגהה')
    sub.add_parser('align', help='ייבוא ההגהה, יישור, תכנון וקובץ התרגום')
    s = sub.add_parser('stage', help='דיווח התקדמות לאפליקציה')
    s.add_argument('st')
    s.add_argument('--p', type=float)
    s.add_argument('--msg')
    f = sub.add_parser('finish', help='בדיקה, בנייה, צריבה והעלאת התוצרים')
    f.add_argument('--force', action='store_true', help=argparse.SUPPRESS)
    e = sub.add_parser('fail', help='סימון העבודה כ"נכשלה"')
    e.add_argument('--err', default='worker')
    e.add_argument('--msg')
    v = sub.add_parser('vt', help='פקודת vt על הפרויקט של העבודה')
    v.add_argument('rest', nargs=argparse.REMAINDER)
    a = p.parse_args(argv)
    if a.cmd != 'run':
        return {'prepare': prepare, 'align': align, 'stage': stage, 'finish': finish, 'fail': fail, 'vt': vt_cmd}[a.cmd](a)
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
