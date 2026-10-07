"""העברת קבצים גדולים מ/אל Google Drive.

שתי דרכים:
1. rclone עם אסימון גישה שנשמר במשתנה הסביבה RCLONE_DRIVE_TOKEN (הגדרה
   חד־פעמית — ראו את מדריך העבודה). מאפשר הורדה והעלאה של קבצים בכל גודל.
2. קישור שיתוף ציבורי ("כל מי שיש לו את הקישור") — להורדה בלבד, בלי הגדרה.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import stat
import zipfile
from pathlib import Path

from .config import ROOT
from .util import run, log, die, which, human_size

REMOTE = "gdrive"
RCLONE_URL = "https://downloads.rclone.org/rclone-current-linux-amd64.zip"


def rclone_bin() -> str:
    b = which("rclone") or (str(ROOT / ".bin" / "rclone") if (ROOT / ".bin" / "rclone").exists() else None)
    if b:
        return b
    import requests
    log("מתקין rclone…")
    data = requests.get(RCLONE_URL, timeout=300).content
    z = zipfile.ZipFile(io.BytesIO(data))
    name = next(n for n in z.namelist() if n.endswith("/rclone"))
    dest = ROOT / ".bin" / "rclone"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(z.read(name))
    dest.chmod(dest.stat().st_mode | stat.S_IEXEC)
    return str(dest)


def configured() -> bool:
    return bool(os.environ.get("RCLONE_DRIVE_TOKEN"))


def configure() -> Path:
    token = os.environ.get("RCLONE_DRIVE_TOKEN", "").strip()
    if not token:
        die("לא מוגדר RCLONE_DRIVE_TOKEN — ראו 'הגדרה חד־פעמית' במדריך העבודה")
    conf = Path.home() / ".config" / "rclone" / "rclone.conf"
    conf.parent.mkdir(parents=True, exist_ok=True)
    lines = [f"[{REMOTE}]", "type = drive", f"scope = {os.environ.get('RCLONE_DRIVE_SCOPE', 'drive')}",
             f"token = {token}"]
    if os.environ.get("VT_DRIVE_ROOT_ID"):
        lines.append(f"root_folder_id = {os.environ['VT_DRIVE_ROOT_ID']}")
    conf.write_text("\n".join(lines) + "\n", encoding="utf-8")
    conf.chmod(0o600)
    return conf


def _rc(*args: str, capture: bool = False):
    configure()
    return run([rclone_bin(), *args], capture=capture)


HOME_DIR = "תרגום ראיונות"


def rpath(path: str) -> str:
    """נתיב ב־Drive. כש־VT_DRIVE_ROOT_ID מצביע על התיקייה "תרגום ראיונות" עצמה (למשל תיקייה
    ששותפה לחשבון נפרד), הנתיבים יחסיים אליה — מסירים את הקידומת."""
    p = path.strip("/")
    if os.environ.get("VT_DRIVE_ROOT_ID") and (p == HOME_DIR or p.startswith(HOME_DIR + "/")):
        p = p[len(HOME_DIR):].lstrip("/")
    return p


def ls(path: str = "") -> str:
    return _rc("lsf", "--max-depth", "1", f"{REMOTE}:{rpath(path)}", capture=True).stdout


def get(remote_path: str, local_dir: Path) -> None:
    local_dir.mkdir(parents=True, exist_ok=True)
    _rc("copy", f"{REMOTE}:{rpath(remote_path)}", str(local_dir), "--progress", "--stats-one-line")


def put(local: Path, remote_dir: str) -> None:
    _rc("copy", str(local), f"{REMOTE}:{rpath(remote_dir)}", "--progress", "--stats-one-line")


# ---------------------------------------------------------------------------
# קישורים ציבוריים
# ---------------------------------------------------------------------------

def direct_url(url: str) -> str:
    m = re.search(r"drive\.google\.com/(?:file/d/|open\?id=|uc\?(?:export=download&)?id=)([\w-]+)", url)
    if m:
        return f"https://drive.usercontent.google.com/download?id={m.group(1)}&export=download&confirm=t"
    if "dropbox.com" in url:
        url = re.sub(r"([?&])dl=0", r"\1dl=1", url)
        if "dl=1" not in url and "raw=1" not in url:
            url += ("&" if "?" in url else "?") + "dl=1"
    return url


def confirm_form(html: str) -> str | None:
    """דף האזהרה של Drive לקובץ גדול ("לא ניתן לסרוק לאיתור וירוסים") — הכתובת שבטופס, עם השדות הנסתרים."""
    import html as H
    from urllib.parse import urlencode
    m = re.search(r'<form[^>]+id="download-form"[^>]+action="([^"]+)"(.*?)</form>', html, re.S)
    if not m:
        return None
    fields = {k: H.unescape(v) for k, v in
              re.findall(r'<input[^>]+type="hidden"[^>]+name="([^"]+)"[^>]+value="([^"]*)"', m.group(2))}
    return H.unescape(m.group(1)) + "?" + urlencode(fields) if fields else None


def fetch(url: str, out: Path) -> Path:
    import requests
    u = direct_url(url)
    log(f"מוריד {u[:90]}…")
    s = requests.Session()
    r = s.get(u, stream=True, timeout=60, allow_redirects=True)
    if "text/html" in r.headers.get("content-type", ""):
        nxt = confirm_form(r.text)
        r.close()
        if nxt:
            log("  אישור הורדה של קובץ גדול")
            r = s.get(nxt, stream=True, timeout=60, allow_redirects=True)
    with r:
        r.raise_for_status()
        ctype = r.headers.get("content-type", "")
        if "text/html" in ctype:
            die("התקבל דף HTML ולא קובץ — ודאו שהקישור משותף ל'כל מי שיש לו את הקישור'")
        total = int(r.headers.get("content-length", 0) or 0)
        n = 0
        out.parent.mkdir(parents=True, exist_ok=True)
        with open(out, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
                n += len(chunk)
                if n % (200 << 20) < (1 << 20):
                    log(f"  {human_size(n)}" + (f" / {human_size(total)}" if total else ""))
    log(f"הורד {human_size(out.stat().st_size)}")
    return out


def copy_local(src: Path, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.link(src, dest)
    except OSError:
        shutil.copy2(src, dest)
    return dest
