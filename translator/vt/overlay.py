"""צריבה מהירה: כל מצב כתוביות מצויר פעם אחת ב־libass, ואז מולבש על הווידאו (overlay).

למה: פילטר subtitles של ffmpeg מצייר ומערבב את כל הכתוביות מחדש בכל פריים. בסגנון "bold"
(מסגרת עבה + blur + שכבת העבות) זה צוואר הבקבוק של כל הצריבה — נמדד בראיון 1080p:
פענוח לבד 272 פריימים לשנייה, פענוח + subtitles רק 50. הלבשה של תמונה מוכנה: ~200.

איך, בלי לשנות את המראה אפילו בפיקסל:
1. מחלקים את ציר הזמן לקטעים שבהם קבוצת האירועים הפעילים קבועה (בדרך כלל = כתובית).
2. מציירים כל קטע פעם אחת ב־libass (אותו פילטר subtitles) — פעם על רקע שחור ופעם על לבן.
3. "מט בהפרש": alpha = 1 − (לבן − שחור)/255, צבע = שחור/alpha — שחזור מדויק של מה ש־libass מערבב.
4. קובץ concat של תמונות PNG עם זמן מעבר באמצע בין פריימים — כך כל פריים מקבל בדיוק את
   הכתובית ש־libass היה מציג בו (חלון [start, end) של ASS).
"""

from __future__ import annotations

import os
import re
import subprocess
from pathlib import Path

from .util import log

FFMPEG = os.environ.get("VT_FFMPEG", "ffmpeg")
FFPROBE = os.environ.get("VT_FFPROBE", "ffprobe")

_DLG = re.compile(r"^Dialogue:\s*([^,]*),([^,]*),([^,]*),(.*)$")


def _t(s: str) -> float:
    h, m, rest = s.strip().split(":")
    return int(h) * 3600 + int(m) * 60 + float(rest)


def _fmt(t: float) -> str:
    cs = int(round(t * 100))
    h, cs = divmod(cs, 360000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def parse_ass(text: str) -> tuple[list[str], list[tuple[float, float, str, str]]]:
    """(שורות הכותרת, אירועים: (התחלה, סוף, שכבה, שאר השורה))."""
    head, ev = [], []
    for line in text.splitlines():
        m = _DLG.match(line)
        if m:
            ev.append((_t(m.group(2)), _t(m.group(3)), m.group(1), m.group(4)))
        else:
            head.append(line)
    return head, ev


def frame_times_ms(src: Path) -> list[int]:
    """זמני הפריימים של הווידאו (מ״ש, אחרי נרמול לתחילת הקובץ — כמו שהפילטרים של ffmpeg רואים אותם).

    ‏vf_subtitles מעביר ל־libass את זמן הפריים במילישניות שלמות, ו־libass מציג אירוע כש־start ≤ t < end.
    מחשבים את אותה החלטה בדיוק — לכל פריים אמיתי, כולל קבצים שהזמנים בהם מעוגלים (MKV) או משתנים (VFR).
    """
    p = subprocess.run([FFPROBE, "-v", "error", "-select_streams", "v:0", "-show_entries",
                        "packet=pts_time:format=start_time", "-of", "csv=p=0", str(src)],
                       capture_output=True, text=True, check=True)
    vals = [x.strip().rstrip(",") for x in p.stdout.split()]
    nums = [float(x) for x in vals if x and x != "N/A"]
    # השורה האחרונה היא start_time של הקובץ
    start, pts = nums[-1], sorted(nums[:-1])
    return [int(round((t - start) * 1000)) for t in pts]


def segments(events, times_ms: list[int]) -> list[tuple[int, int, tuple]]:
    """קטעים: (אינדקס פריים ראשון, אינדקס פריים יציאה, אינדקסי האירועים הפעילים) — לפי זמני הפריימים."""
    ev = [(int(round(s * 1000)), int(round(e * 1000)), i) for i, (s, e, *_) in enumerate(events)]
    ev.sort()
    out, j, active = [], 0, []
    for k, t in enumerate(times_ms):
        while j < len(ev) and ev[j][0] <= t:
            active.append(ev[j])
            j += 1
        active = [x for x in active if x[1] > t]
        act = tuple(sorted(x[2] for x in active if x[0] <= t))
        if not act:
            continue
        if out and out[-1][2] == act and out[-1][1] == k:
            out[-1] = (out[-1][0], k + 1, act)
        else:
            out.append((k, k + 1, act))
    return out


def _render(ass_path: Path, n: int, w: int, h: int, colour: str, band: tuple[int, int], fontsdir: Path):
    """צינור של n פריימים rgb24 (רצועת הכתוביות בלבד) — קטע k מוצג בשנייה k."""
    y0, y1 = band
    vf = (f"subtitles=filename='{_esc(ass_path)}':fontsdir='{_esc(fontsdir)}',"
          f"crop={w}:{y1 - y0}:0:{y0}")
    cmd = [FFMPEG, "-v", "error", "-f", "lavfi", "-i", f"color=c={colour}:s={w}x{h}:r=1:d={n}",
           "-vf", vf, "-frames:v", str(n), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE)


def _render_part(job) -> None:
    """עובד: מצייר את הקטעים idx (שחור + לבן במקביל) ושומר PNG ‏RGBA לכל אחד ("מט בהפרש")."""
    import numpy as np
    from PIL import Image
    ass, idx, width, height, y0, y1, fontsdir, out_dir = job
    bh, n = y1 - y0, len(idx)
    pb = _render(Path(ass), n, width, height, "black", (y0, y1), Path(fontsdir))
    pw = _render(Path(ass), n, width, height, "white", (y0, y1), Path(fontsdir))
    size = width * bh * 3
    for k in idx:
        b = np.frombuffer(pb.stdout.read(size), np.uint8).reshape(bh, width, 3)
        wt = np.frombuffer(pw.stdout.read(size), np.uint8).reshape(bh, width, 3)
        ink = (wt < 255).any(axis=2) | (b > 0).any(axis=2)        # רק פיקסלים שהכתובית נגעה בהם (גם שחור אטום)
        rgba = np.zeros((bh, width, 4), np.uint8)
        if ink.any():
            bf, wf = b[ink].astype(np.float32), wt[ink].astype(np.float32)
            a = np.clip(1.0 - (wf - bf).mean(axis=1) / 255.0, 0.0, 1.0)
            rgb = np.where(a[:, None] > 1e-3, bf / np.maximum(a[:, None], 1e-3), 0.0)
            rgba[ink] = np.column_stack([np.clip(rgb + 0.5, 0, 255), np.round(a * 255)]).astype(np.uint8)
        Image.fromarray(rgba, "RGBA").save(Path(out_dir) / f"s{k:05d}.png", compress_level=1)
    pb.wait(), pw.wait()
    if pb.returncode or pw.returncode:
        raise RuntimeError("ציור הכתוביות נכשל")


def _esc(p: Path) -> str:
    return str(p).replace("\\", "/").replace(":", r"\:").replace("'", r"\'").replace(",", r"\,")


def _band(head: list[str], events, w: int, h: int) -> tuple[int, int]:
    """אזור הכתוביות לאורך כל הסרטון. עם ‎\\pos — לפי המיקומים והגופן; בלי — כל הפריים."""
    ys = []
    for *_, rest in events:
        m = re.search(r"\\pos\(\s*[\d.]+\s*,\s*([\d.]+)\s*\)", rest)
        if not m or not re.search(r"\\an2", rest):
            return 0, h
        ys.append(float(m.group(1)))
    size = max((float(x.split(",")[2]) for x in head if x.startswith("Style:")), default=h / 10)
    pad = size * 0.25 + 40
    y0 = max(0, int(min(ys) - size * 1.15 - pad)) & ~1
    y1 = min(h, int(max(ys) + pad + 1) + 1) & ~1
    return y0, max(y1, y0 + 2)


def prerender(ass: Path, out_dir: Path, width: int, height: int, src: Path,
              fontsdir: Path) -> tuple[Path, int, int]:
    """מכין את שכבת הכתוביות: תמונות PNG שקופות + overlay.txt (concat). מחזיר (קובץ, y של הרצועה)."""
    import numpy as np
    from PIL import Image

    import hashlib
    import json
    out_dir.mkdir(parents=True, exist_ok=True)
    text = ass.read_text(encoding="utf-8-sig")
    key = hashlib.sha1((text + f"|{src.stat().st_size}|{width}x{height}").encode()).hexdigest()
    meta = out_dir / "segments.json"
    if meta.exists():
        d = json.loads(meta.read_text())
        if d.get("key") == key and all((out_dir / x).exists() for x in d["names"][:1] + d["names"][-1:]):
            log(f"שכבת הכתוביות כבר מצוירת ({len(d['names'])} מצבים) — משתמש במטמון")
            return write_list(out_dir), d["y0"], len(d["names"])
    for f in out_dir.glob("*.png"):
        f.unlink()
    head, events = parse_ass(text)
    times = frame_times_ms(src)
    segs = segments(events, times)
    y0, y1 = _band(head, events, width, height)
    bh = y1 - y0
    # כל עובד מצייר חלק מהקטעים: ASS זמני שבו קטע k = [k, k+1) — אותו טקסט ותגים, רק זמן אחר
    lines = [x for x in head if x.strip() != "[Events]" and not x.startswith("Format: Layer")]
    n = len(segs)
    workers = max(1, min(os.cpu_count() or 2, 4, n // 50 or 1))
    parts = [list(range(n))[w::workers] for w in range(workers)]
    log(f"מצייר {n} מצבי כתוביות (רצועה {width}x{bh} מ־y={y0}, {workers} תהליכים)…")
    jobs = []
    for w, idx in enumerate(parts):
        ev_lines = ["", "[Events]", "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"]
        for j, k in enumerate(idx):
            for e in segs[k][2]:
                _, _, layer, rest = events[e]
                ev_lines.append(f"Dialogue: {layer},{_fmt(j)},{_fmt(j + 1)},{rest}")
        a = out_dir / f"segments_{w}.ass"
        a.write_text("\n".join(lines).rstrip() + "\n" + "\n".join(ev_lines) + "\n", encoding="utf-8")
        jobs.append((str(a), idx, width, height, y0, y1, str(fontsdir), str(out_dir)))
    from concurrent.futures import ProcessPoolExecutor
    with ProcessPoolExecutor(workers) as ex:
        list(ex.map(_render_part, jobs))
    names = [f"s{k:05d}.png" for k in range(n)]
    blank = out_dir / "blank.png"
    Image.new("RGBA", (width, bh), (0, 0, 0, 0)).save(blank)

    import json
    (out_dir / "segments.json").write_text(json.dumps({"key": key, "y0": y0, "times": times,
                                                         "segs": [[a, b] for a, b, _ in segs], "names": names}))
    return write_list(out_dir), y0, n


def write_list(out_dir: Path, start: float | None = None, end: float | None = None) -> Path:
    """קובץ concat: כל מעבר באמצע בין שני פריימים אמיתיים — עמיד לעיגול, ותמיד אותו פריים כמו libass.

    לקטע (start/end): הזמנים מוזזים ב־start, כי ffmpeg עם ‎-ss לפני הקלט מאפס את ציר הזמן לנקודת החיתוך.
    (‏-ss על קלט ה־concat עצמו לא מדויק לתמונות — נבדק: היסט בכל הקטע.)
    """
    import json
    d = json.loads((out_dir / "segments.json").read_text())
    times, segs, names = d["times"], d["segs"], d["names"]
    off = start or 0.0
    stop = end if end is not None else float("inf")

    def at(f: int) -> float:
        if f <= 0:
            return 0.0
        if f >= len(times):
            return times[-1] / 1000 + 0.5
        return (times[f - 1] + times[f]) / 2000

    rows, cur = ["ffconcat version 1.0"], 0.0
    for k, (fa, fb) in enumerate(segs):
        ta, tb = max(0.0, at(fa) - off), min(at(fb), stop + 1) - off
        if tb <= 0 or ta >= stop - off + 1:
            continue
        if ta > cur + 1e-6:
            rows += ["file blank.png", f"duration {ta - cur:.6f}"]
        rows += [f"file {names[k]}", f"duration {tb - ta:.6f}"]
        cur = tb
    rows += ["file blank.png", "duration 1.0"]
    lst = out_dir / ("overlay.txt" if start is None else f"overlay_{int(off)}.txt")
    lst.write_text("\n".join(rows) + "\n", encoding="utf-8")
    return lst


def overlay_filter(y0: int) -> str:
    """פילטר להלבשה: [0:v]=הסרטון, [1:v]=רצף התמונות."""
    return f"[1:v]format=rgba[s];[0:v][s]overlay=x=0:y={y0}:eof_action=pass:repeatlast=1:format=yuv420"
