"""עבודה עם קבצי מדיה (ffprobe/ffmpeg): נתוני וידאו, חילוץ אודיו וחילופי שוטים.

נקודה קריטית לסנכרון: אם האודיו מתחיל מאוחר מהווידאו (נפוץ ב־MP4), חילוץ
רגיל "מוחק" את ההיסט והכתוביות יקדימו את הדיבור. לכן מחלצים עם
aresample=async=1:first_pts=0 — זמן 0 בקובץ האודיו = זמן 0 של הסרטון.
"""

from __future__ import annotations

import json
import re
import subprocess
from fractions import Fraction
from pathlib import Path

from .util import run, log, FrameGrid


def probe(path: Path) -> dict:
    p = run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams",
             str(path)], capture=True, quiet=True)
    return summarize(json.loads(p.stdout), path)


def summarize(d: dict, path) -> dict:
    """הפלט של ffprobe (‏-show_format -show_streams) → media.json. 24/10/2026: גם מהטלפון (תרגום בטלפון — הסרטון לא
    עוזב אותו, ו־job.py phone_attach כותב את media.json מה־ffprobe שרץ שם)."""
    fmt = d.get("format", {})
    info = {"path": str(path), "duration": float(fmt.get("duration", 0) or 0),
            "start": float(fmt.get("start_time", 0) or 0), "size": int(fmt.get("size", 0) or 0),
            "format": fmt.get("format_name", "")}
    v = next((s for s in d["streams"] if s.get("codec_type") == "video"
              and not s.get("disposition", {}).get("attached_pic")), None)
    a = next((s for s in d["streams"] if s.get("codec_type") == "audio"), None)
    if v:
        fr = v.get("avg_frame_rate") or v.get("r_frame_rate") or "25/1"
        try:
            fps = Fraction(fr)
            if fps <= 0:
                fps = Fraction(v.get("r_frame_rate", "25/1"))
        except (ZeroDivisionError, ValueError):
            fps = Fraction(25)
        r = Fraction(v.get("r_frame_rate", fr)) if v.get("r_frame_rate", "0/0") != "0/0" else fps
        info["video"] = {
            "index": v["index"], "codec": v.get("codec_name"), "width": int(v.get("width", 0)),
            "height": int(v.get("height", 0)), "fps": str(fps.limit_denominator(100000)),
            "fps_float": float(fps), "vfr": abs(float(r) - float(fps)) > 0.01 * float(fps),
            "start": float(v.get("start_time", 0) or 0), "pix_fmt": v.get("pix_fmt"),
            "color_space": v.get("color_space"), "color_primaries": v.get("color_primaries"),
            "color_transfer": v.get("color_transfer"), "color_range": v.get("color_range"),
            "sar": v.get("sample_aspect_ratio"), "bitrate": int(v.get("bit_rate", 0) or 0),
        }
    if a:
        info["audio"] = {"index": a["index"], "codec": a.get("codec_name"),
                         "sample_rate": int(a.get("sample_rate", 0) or 0),
                         "channels": int(a.get("channels", 0) or 0),
                         "start": float(a.get("start_time", 0) or 0),
                         "bitrate": int(a.get("bit_rate", 0) or 0)}
    # 22/10/2026 (שלב 4): כל הזרמים בקובץ — כתוביות מוצמדות (שפה, שם, דגלים), עוד רצועות קול, תמונות מצורפות
    info["streams"] = [{
        "index": s.get("index"), "type": s.get("codec_type", ""), "codec": s.get("codec_name", ""),
        "lang": (s.get("tags") or {}).get("language", ""), "title": (s.get("tags") or {}).get("title", "")[:120],
        "default": bool((s.get("disposition") or {}).get("default")), "forced": bool((s.get("disposition") or {}).get("forced")),
        "sdh": bool((s.get("disposition") or {}).get("hearing_impaired")),
    } for s in d.get("streams", [])][:64]
    starts = [info["start"]] + [x["start"] for x in (info.get("video"), info.get("audio")) if x]
    base = min(starts) if starts else 0.0
    info["timeline_base"] = base
    if v:
        info["video"]["t0"] = round(info["video"]["start"] - base, 6)
    if a:
        info["audio"]["t0"] = round(info["audio"]["start"] - base, 6)
    return info


def grid_from(info: dict) -> FrameGrid:
    v = info.get("video")
    if not v:
        # 22/10/2026: קובץ כתוביות בלי סרטון — קצב הפריימים לפי מה שנשמר (ברירת מחדל 23.976 — סרט)
        return FrameGrid(Fraction(info.get("fps") or 25), 0.0)
    return FrameGrid(Fraction(v["fps"]), v.get("t0", 0.0))


def extract_audio(src: Path, out_wav: Path, rate: int = 16000) -> None:
    """אודיו מונו לתמלול וליישור, כשזמן 0 = תחילת ציר הזמן של הסרטון."""
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-map", "0:a:0",
         "-af", "aresample=async=1:first_pts=0", "-ac", "1", "-ar", str(rate), "-c:a", "pcm_s16le",
         str(out_wav)])


def extract_api_audio(src: Path, out: Path) -> None:
    """אודיו דחוס לשליחה לשירותי תמלול: Opus 64kbps מונו (~28MB לשעה)."""
    run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-map", "0:a:0",
         "-af", "aresample=async=1:first_pts=0", "-ac", "1", "-ar", "48000",
         "-c:a", "libopus", "-b:a", "64k", "-application", "voip", str(out)])


_SCD = re.compile(r"lavfi\.scd\.score:\s*([\d.]+),\s*lavfi\.scd\.time:\s*([\d.]+)")


def detect_shots(src: Path, threshold: float = 10.0, scale_w: int = 320, burn_out: Path | None = None) -> list[dict]:
    """חילופי שוטים (חיתוכים) עם scdet של ffmpeg על עותק מוקטן — מהיר גם לשעה.

    burn_out (25/10/2026): באותו מעבר — גם טקסט שעל המסך בפסים העליון והתחתון (vt/burnin.py) → JSON בנתיב הזה.
    בלי המודלים / תקלה בזיהוי → רק השוטים, כמו קודם."""
    log(f"מזהה חילופי שוטים (סף {threshold})…")
    if burn_out is not None:
        try:
            from . import burnin
            if burnin.available():
                return _shots_and_burn(src, threshold, scale_w, Path(burn_out))
        except Exception as e:                    # noqa: BLE001 — השוטים חשובים יותר
            log(f"זיהוי הטקסט שעל המסך נכשל ({type(e).__name__}) — רק חילופי השוטים")
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "info", "-i", str(src), "-map", "0:v:0",
           "-vf", f"scale={scale_w}:-2,scdet=threshold={threshold}", "-an", "-f", "null", "-"]
    p = subprocess.run(cmd, text=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    return _parse_shots(p.stderr)


def _parse_shots(err: str) -> list[dict]:
    return [{"t": float(m.group(2)), "score": float(m.group(1))} for m in _SCD.finditer(err)]


def _shots_and_burn(src: Path, threshold: float, scale_w: int, burn_out: Path) -> list[dict]:
    """מעבר אחד: scdet על עותק ברוחב scale_w, ובמקביל 2 פריימים לשנייה ברוחב 640 לצינור → burnin.Detector."""
    import threading
    import time
    import numpy as np
    from . import burnin
    info = probe(src)
    v = info.get("video") or {}
    fh = burnin.frame_height(int(v.get("width") or 1920), int(v.get("height") or 1080))
    t0 = float(v.get("start") or 0.0)
    fc = (f"[0:v:0]split=2[a][b];[a]scale={scale_w}:-2,scdet=threshold={threshold}[sa];"
          f"[b]fps={burnin.FPS},scale={burnin.W}:{fh},format=rgb24[sb]")
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "info", "-i", str(src), "-filter_complex", fc,
           "-map", "[sa]", "-an", "-f", "null", "-", "-map", "[sb]", "-an", "-f", "rawvideo", "pipe:1"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, stdin=subprocess.DEVNULL)
    err: list[bytes] = []
    th = threading.Thread(target=lambda: err.append(p.stderr.read()), daemon=True)
    th.start()
    det, frames, k, bad, a = None, [], 0, None, time.time()
    n = burnin.W * fh * 3
    try:
        det = burnin.Detector()
    except Exception as e:                        # noqa: BLE001
        bad = type(e).__name__
    while True:
        buf = p.stdout.read(n)
        if len(buf) < n:
            break
        if bad is None:
            try:
                t = round(t0 + k / burnin.FPS, 3)
                bs = det.frame(np.frombuffer(buf, np.uint8).reshape(fh, burnin.W, 3), t)
                if bs:
                    frames.append([t, bs])
            except Exception as e:                # noqa: BLE001 — ממשיכים לקרוא (אחרת ffmpeg נתקע) בלי זיהוי
                bad = type(e).__name__
        k += 1
    p.wait()
    th.join()
    shots = _parse_shots(b"".join(err).decode("utf-8", "replace"))
    if bad is None:
        tmp = burn_out.with_suffix(burn_out.suffix + ".tmp")
        tmp.write_text(json.dumps({"v": burnin.V, "fps": burnin.FPS, "w": burnin.W, "fh": fh, "n": k,
                                   "frames": frames}, ensure_ascii=False), encoding="utf-8")
        tmp.replace(burn_out)
        log(f"טקסט על המסך: {len(frames)} מתוך {k} פריימים ({round(time.time() - a)} שנ׳, {det.reads} קריאות)")
    else:
        log(f"זיהוי הטקסט שעל המסך נכשל ({bad}) — רק חילופי השוטים")
    return shots


def frame_png(src: Path, t: float, out: Path, vf: str | None = None) -> None:
    """פריים בודד בזמן t. ‏-copyts חיוני כדי שפילטר הכתוביות יראה את הזמן האמיתי."""
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-copyts",
           "-i", str(src)]
    if vf:
        cmd += ["-vf", vf]
    cmd += ["-frames:v", "1", str(out)]
    run(cmd, quiet=True)
