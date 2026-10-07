"""כלי עזר משותפים: קבצים, זמנים, פריימים והרצת פקודות."""

from __future__ import annotations

import json
import math
import os
import shlex
import subprocess
import sys
import time
from fractions import Fraction
from pathlib import Path


def log(msg: str) -> None:
    print(f"[vt {time.strftime('%H:%M:%S')}] {msg}", file=sys.stderr, flush=True)


def die(msg: str, code: int = 1):
    log("שגיאה: " + msg)
    raise SystemExit(code)


def read_json(path: Path | str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: Path | str, data, indent: int | None = 1) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)
        f.write("\n")
    os.replace(tmp, path)


def write_text(path: Path | str, text: str, bom: bool = False) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8-sig" if bom else "utf-8", newline="\n") as f:
        f.write(text)


def run(cmd: list[str], check: bool = True, capture: bool = False, quiet: bool = False,
        env: dict | None = None) -> subprocess.CompletedProcess:
    # הפקודה המלאה רק ב־VT_VERBOSE=1: כל שורת לוג נכנסת להקשר של Claude ונקראת מחדש בכל סבב
    if not quiet and os.environ.get("VT_VERBOSE"):
        log("$ " + " ".join(shlex.quote(c) for c in cmd))
    return subprocess.run(cmd, check=check, text=True,
                          stdout=subprocess.PIPE if capture else None,
                          stderr=subprocess.PIPE if capture else None,
                          env=env)


def run_progress(cmd: list[str], total_s: float, label: str, every: float = 0.1) -> None:
    """ffmpeg ארוך עם שורת התקדמות אחת לכל 10% (במקום מאות שורות ‎-stats) — חוסך טוקנים בהקשר."""
    env = dict(os.environ, SVT_LOG=os.environ.get("SVT_LOG", "1"))      # SVT-AV1: שגיאות בלבד
    cmd = [c for c in cmd if c != "-stats"]
    cmd = cmd[:1] + ["-nostats", "-progress", "pipe:1"] + cmd[1:]
    t0, nxt = time.time(), every
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, text=True, env=env)
    for line in p.stdout:
        if line.startswith("out_time_us="):
            try:
                frac = int(line.split("=")[1]) / 1e6 / max(total_s, 1e-6)
            except ValueError:
                continue
            if frac >= nxt:
                el = time.time() - t0
                log(f"{label}: {frac * 100:.0f}% · {el / 60:.1f} דק׳ · נותרו ~{el / frac * (1 - frac) / 60:.1f}")
                nxt += every
    if p.wait():
        raise subprocess.CalledProcessError(p.returncode, cmd)


# ---------------------------------------------------------------------------
# זמנים
# ---------------------------------------------------------------------------

def fmt_ts(t: float) -> str:
    """00:01:02.345 — לתצוגה ולקבצי עבודה."""
    if t < 0:
        t = 0.0
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def parse_ts(s: str) -> float:
    s = s.strip().replace(",", ".")
    parts = s.split(":")
    sec = 0.0
    for p in parts:
        sec = sec * 60 + float(p)
    return sec


def floor_unit(t: float, unit: float) -> float:
    """עיגול כלפי מטה ליחידה (0.01 ל־ASS, ‏0.001 ל־SRT) עם סבולת לשגיאות נקודה צפה."""
    return math.floor(t / unit + 1e-6) * unit


# ---------------------------------------------------------------------------
# פריימים
# ---------------------------------------------------------------------------

class FrameGrid:
    """רשת הפריימים של הווידאו: פריים k מוצג בזמן t0 + k/fps.

    כתובית "נכנסת" בפריים fi ו"יוצאת" בפריים fo (לא כולל) — כך מחשבים
    זמני קובץ שמבטיחים שבדיוק הפריימים האלה יציגו אותה.
    """

    def __init__(self, fps: Fraction | float | str, t0: float = 0.0):
        if isinstance(fps, str):
            fps = Fraction(fps)
        if isinstance(fps, float):
            fps = Fraction(fps).limit_denominator(1001 * 1000)
        if fps <= 0:
            fps = Fraction(25)
        self.fps = fps
        self.t0 = t0
        self.fps_f = float(fps)
        self.frame_s = 1.0 / self.fps_f

    def frame_at(self, t: float) -> int:
        """הפריים הקרוב ביותר לזמן t."""
        return int(round((t - self.t0) * self.fps_f))

    def frame_floor(self, t: float) -> int:
        return int(math.floor((t - self.t0) * self.fps_f + 1e-9))

    def frame_ceil(self, t: float) -> int:
        return int(math.ceil((t - self.t0) * self.fps_f - 1e-9))

    def time_of(self, k: int) -> float:
        return self.t0 + k / self.fps_f

    def frames(self, seconds: float) -> int:
        return int(round(seconds * self.fps_f))

    def file_time(self, k: int, unit: float) -> float:
        """זמן לכתיבה בקובץ כך שפריים k הוא הראשון שעליו הזמן חל."""
        return max(0.0, floor_unit(self.time_of(k), unit))


def which(binary: str) -> str | None:
    for d in os.environ.get("PATH", "").split(os.pathsep):
        p = Path(d) / binary
        if p.is_file() and os.access(p, os.X_OK):
            return str(p)
    return None


def human_size(n: float) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}TB"
