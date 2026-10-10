"""ת4 — העובד מול Cloudflare R2: הורדת הקלט והעלאת התוצרים / נקודות השמירה דרך קישורים חתומים מהשרתון.
לעובד אין מפתח של R2: השרתון נותן קישור לקובץ אחד (הורדה, 6 שעות) או לחלק אחד (העלאה, שעה),
ורק לקבצים בתיקייה של העבודה שהמפתח שלו פותח. מזהה קובץ = R2_<עבודה>_<אקראי> (כמו מזהה של Drive).
ב־R2 כל החלקים חוץ מהאחרון באותו גודל (ps) — השרתון קובע.
התלויות מוזרקות (call, opener, sleep) — נבדק בלי רשת.
call(op, **kw) → dict: תשובת השרתון כמו שהיא (גם ok:false), חריגה רק כשהוא לא עונה בכלל."""
import time
import urllib.error
import urllib.request

UA = 'snb-studio-worker'
READ = 8 * 1024 * 1024
MAX_TRIES = 8


class StoreError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _open(req, timeout, opener=None):
    return (opener or urllib.request.urlopen)(req, timeout=timeout)


def download(call, fid, dest, on_progress=None, opener=None, sleep=time.sleep):
    """הורדה בזרם עם המשך מאותו בייט (Range). קישור שפג (403) → קישור חדש מהשרתון."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    j = call('r2get', id=fid)
    if not j.get('ok'):
        raise StoreError(j.get('error') or 'r2_get')
    url, size, tries = j['url'], int(j.get('size') or 0), 0
    while True:
        have = dest.stat().st_size if dest.exists() else 0
        if size and have >= size:
            return dest
        req = urllib.request.Request(url, headers={'User-Agent': UA})
        if have:
            req.add_header('Range', 'bytes=%d-' % have)
        try:
            with _open(req, 60, opener) as r, open(dest, 'ab' if have and r.status == 206 else 'wb') as f:
                got = have if r.status == 206 else 0
                while True:
                    b = r.read(READ)
                    if not b:
                        break
                    f.write(b)
                    got += len(b)
                    if on_progress and size:
                        on_progress(got / size)
            if not size or dest.stat().st_size >= size:
                return dest
        except urllib.error.HTTPError as e:
            if e.code == 403:                                   # הקישור פג — מבקשים חדש
                j = call('r2get', id=fid)
                if not j.get('ok'):
                    raise StoreError(j.get('error') or 'r2_get')
                url = j['url']
            elif e.code == 416 and size and dest.exists() and dest.stat().st_size >= size:
                return dest
            elif e.code not in (408, 429) and e.code < 500:
                raise StoreError('r2_dl_%d' % e.code)
        except (urllib.error.URLError, TimeoutError, OSError):
            pass
        tries += 1
        if tries > MAX_TRIES:
            raise StoreError('r2_dl_net')
        sleep(min(30, 2 ** tries))


def _put(url, data, opener=None):
    req = urllib.request.Request(url, data=data, method='PUT', headers={'User-Agent': UA, 'Content-Length': str(len(data))})
    try:
        with _open(req, 300, opener) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except (urllib.error.URLError, TimeoutError, OSError):
        return 0


def upload(call, path, mime='application/octet-stream', name='', replace='', on_progress=None, opener=None, sleep=time.sleep):
    """העלאה בחלקים קבועים. replace = תוכן חדש לקובץ קיים (אותו מזהה). אחרי תקלה שואלים את השרתון מה הגיע
    וממשיכים משם. מחזיר את מזהה הקובץ."""
    size = path.stat().st_size
    if size <= 0:
        raise StoreError('empty')
    first = dict(size=size, type=mime, name=name[:200])
    if replace:
        first.update(id=replace, replace=True)
    j = call('r2wup', **first)
    fid, fails = j.get('id') or replace, 0
    with open(path, 'rb') as f:
        while True:
            if not j.get('ok'):
                if j.get('error') == 'r2_gone' and fails <= MAX_TRIES:
                    j = call('r2wup', **first)          # ההעלאה פגה — חדשה
                    fid = j.get('id') or fid
                    fails += 1
                    continue
                raise StoreError(j.get('error') or 'r2_up')
            fid = j.get('id') or fid
            if j.get('file'):
                if on_progress:
                    on_progress(1.0)
                return fid
            up, ps = j['up'], int(j['ps'])
            done = set(int(n) for n in j.get('done') or [])
            urls = {int(k): v for k, v in (j.get('urls') or {}).items()}
            n_all = max(1, -(-size // ps))
            missing = [n for n in range(1, n_all + 1) if n not in done]
            if not missing:
                j = call('r2wdone', id=fid, up=up)
                if j.get('ok'):
                    if on_progress:
                        on_progress(1.0)
                    return fid
                if j.get('error') == 'r2_parts':
                    j = call('r2wparts', id=fid, up=up)
                continue                                # r2_gone → הענף שלמעלה
            sent = 0
            for n in missing:
                if n not in urls:
                    break
                f.seek((n - 1) * ps)
                data = f.read(ps if n < n_all else size - ps * (n_all - 1))
                st = _put(urls[n], data, opener)
                if st != 200:
                    if 400 <= st < 500 and st not in (403, 404, 408, 429):
                        raise StoreError('r2_up_%d' % st)
                    break
                done.add(n)
                sent += 1
                if on_progress:
                    on_progress(min(1.0, sum(min(ps, size - ps * (k - 1)) for k in done) / size))
            if sent:
                fails = 0
            else:
                fails += 1
                if fails > MAX_TRIES:
                    raise StoreError('r2_up_net')
                sleep(min(30, 2 ** fails))
            j = call('r2wparts', id=fid, up=up)


def delete(call, fid):
    """מחיקת קובץ שהעובד העלה (נקודת שמירה ישנה, איכות שלא נשמרה). כשל — לא חשוב."""
    try:
        return bool(call('r2del', id=fid).get('ok'))
    except Exception:           # noqa: BLE001
        return False
