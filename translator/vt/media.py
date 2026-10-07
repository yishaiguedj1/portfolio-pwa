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
    d = json.loads(p.stdout)
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
        return FrameGrid(Fraction(25), 0.0)
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


def detect_shots(src: Path, threshold: float = 10.0, scale_w: int = 320) -> list[dict]:
    """חילופי שוטים (חיתוכים) עם scdet של ffmpeg על עותק מוקטן — מהיר גם לשעה."""
    log(f"מזהה חילופי שוטים (סף {threshold})…")
    cmd = ["ffmpeg", "-hide_banner", "-nostats", "-loglevel", "info", "-i", str(src), "-map", "0:v:0",
           "-vf", f"scale={scale_w}:-2,scdet=threshold={threshold}", "-an", "-f", "null", "-"]
    p = subprocess.run(cmd, text=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    shots = []
    for m in _SCD.finditer(p.stderr):
        shots.append({"t": float(m.group(2)), "score": float(m.group(1))})
    return shots


def frame_png(src: Path, t: float, out: Path, vf: str | None = None) -> None:
    """פריים בודד בזמן t. ‏-copyts חיוני כדי שפילטר הכתוביות יראה את הזמן האמיתי."""
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-copyts",
           "-i", str(src)]
    if vf:
        cmd += ["-vf", vf]
    cmd += ["-frames:v", "1", str(out)]
    run(cmd, quiet=True)
