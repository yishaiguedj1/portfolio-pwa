"""הפקת הסרטון: צריבה באיכות גבוהה, MKV עם כתוביות רכות, ותמונות בדיקה."""

from __future__ import annotations

import os
from pathlib import Path

from .config import FONTS_DIR
from .util import run, run_progress, log

MP4_AUDIO_OK = {"aac", "mp3", "ac3", "eac3", "alac", "opus", "flac"}


def _filter_path(p: Path) -> str:
    # escape לנתיב בתוך פילטר של ffmpeg
    return str(p).replace("\\", "/").replace(":", r"\:").replace("'", r"\'").replace(",", r"\,")


def sub_filter(ass: Path, base: float = 0.0) -> str:
    f = f"subtitles=filename='{_filter_path(ass)}':fontsdir='{_filter_path(FONTS_DIR)}'"
    if base:
        f = f"setpts=PTS-{base}/TB," + f
    return f


# ---------------------------------------------------------------------------
# צריבה מהירה (v1.3): ציור מראש + overlay, ו־AV1 בגודל של המקור
# ---------------------------------------------------------------------------
# נמדד על ראיון 1080p24 (אקמן, AV1 ‏391kbps מיוטיוב), קטע של דקה, VMAF מול "המקור + כתוביות" בלי אובדן:
#   ישן:  subtitles + x264 medium CRF18 → 45 fps, ‏1862kbps (פי 4.8 מהמקור), VMAF 97.9
#   חדש:  overlay + SVT-AV1 p8 lp=4 CRF40 → 64 fps, ‏444kbps, VMAF 96.2 (CRF מכויל לגודל המקור)
# הציור עצמו: subtitles לבד מגביל ל־50 fps; הלבשה של תמונה מוכנה ~200 fps, ופלט זהה בפיקסל (נבדק פריים־פריים).

PROFILES = {
    # "same": אותה איכות וגודל כמו המקור — CRF מכויל כך שקצב הווידאו ≈ המקור × (1 + headroom).
    # preset 9: פי 1.5 מהיר מ־8 ב־0.1–0.3 נקודות VMAF פחות (לא מורגש). enable-tf=0: בלי סינון זמני
    # שמחליק מרקם (שיער, עור) — נבדק בעין בחיתוך 1:1. variance boost: יותר ביטים לאזורים חלקים/כהים.
    "same": {"preset": 9, "headroom": 0.02, "params": "enable-tf=0:enable-variance-boost=1", "crfs": (40, 50)},
    # "small": גרסה דחוסה (‎--compact): 65% מקצב המקור, preset 9, בלי variance boost.
    # נמדד בקטע מאקמן באותו קצב (~260kbps): preset 9 = VMAF 93.9 ב־87fps; preset 6 = 94.6 ב־28fps (פי 3 איטי);
    # preset 9 עם variance boost = 93.1 (בקצב נמוך הוא לוקח ביטים מהפנים). preset 6/7 מנצלים 3.6–3.7 ליבות —
    # חלוקה לקטעים מקבילים לא תאיץ. האודיו: AAC מונו 64k כשהמקור מונו בפועל (הפרש ערוצים < ‎-50dB).
    "small": {"preset": 9, "ratio": 0.65, "params": "enable-tf=0", "crfs": (44, 54)},
}


def video_packets(src: Path) -> list[tuple[float, int]]:
    """(זמן, גודל) לכל חבילת וידאו — לקצב הכולל ולקצב המקור בכל דגימה של הכיול."""
    p = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=pts_time,size",
             "-of", "csv=p=0", str(src)], capture=True, quiet=True)
    out = []
    for line in p.stdout.split():
        t, _, n = line.partition(",")
        try:
            out.append((float(t), int(n)))
        except ValueError:
            continue
    return out


def video_kbps(src: Path, packets: list | None = None) -> float:
    """קצב הווידאו בפועל (גודל החבילות / משך) — עובד גם כשהמכולה לא מדווחת bit_rate (MKV/WebM)."""
    packets = packets if packets is not None else video_packets(src)
    d = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                  capture=True, quiet=True).stdout.strip())
    return sum(n for _, n in packets) * 8 / d / 1000


def is_mono(src: Path, info: dict) -> bool:
    """שני הערוצים זהים בפועל? (RMS של L−R בדקה מאמצע הסרטון; באקמן: ‎-72dB)"""
    a = info.get("audio", {})
    if int(a.get("channels") or 1) < 2:
        return True
    t = max(0.0, info.get("duration", 0) / 2 - 30)
    p = run(["ffmpeg", "-hide_banner", "-v", "info", "-ss", f"{t:.1f}", "-t", "60", "-i", str(src), "-map", "0:a:0",
             "-af", "pan=mono|c0=c0-c1,astats=measure_perchannel=none:measure_overall=RMS_level",
             "-f", "null", "-"], capture=True, quiet=True)
    import re
    m = re.search(r"RMS level dB:\s*(-?[\d.]+|-inf)", p.stderr)
    return bool(m) and (m.group(1) == "-inf" or float(m.group(1)) < -50)


def _color_args(info: dict) -> list[str]:
    v, out = info.get("video", {}), []
    for k, opt in (("color_primaries", "-color_primaries"), ("color_transfer", "-color_trc"),
                   ("color_space", "-colorspace"), ("color_range", "-color_range")):
        if v.get(k) and v[k] not in ("unknown", "reserved"):
            out += [opt, v[k]]
    return out


def enc_args(codec: str, crf: int, preset: int | str, params: str = "") -> list[str]:
    if codec == "av1":
        # lp=4: מקביליות פנימית — +18% מהירות, פלט זהה בבית (נמדד)
        return ["-c:v", "libsvtav1", "-preset", str(preset), "-crf", str(crf),
                "-svtav1-params", "lp=4" + (":" + params if params else ""), "-pix_fmt", "yuv420p"]
    return ["-c:v", "libx264", "-preset", str(preset), "-crf", str(crf), "-pix_fmt", "yuv420p", "-profile:v", "high"]


def calibrate_crf(src: Path, ass: Path, info: dict, ratio: float, codec: str = "av1",
                  preset: int = 9, crfs: tuple[int, int] = (40, 50), n: int = 12, gop: int = 161,
                  params: str = "", packets: list | None = None) -> tuple[int, float]:
    """בוחר CRF שהקובץ שלו ≈ ratio × המקור (בווידאו).

    n דגימות של GOP אחד בדיוק (161 פריימים — ברירת המחדל של SVT-AV1; דגימה של 8 שנ׳ = 2 פריימי מפתח
    במקום 1.2 בממוצע, ניפוח של ~9%) עם הכתוביות, שני CRF בבת אחת (פענוח וציור אחד, שני מקודדים).
    החיזוי לפי **היחס** בין הקידוד שלנו למקור באותן דגימות, לא לפי הקצב המוחלט: דגימות
    ממילא לא מייצגות את כל הסרטון (באקמן: חיזוי מוחלט 389kbps, בפועל 428, ‎+10%), אבל היחס
    ביניהן למקור יציב — כי הקצב של שניהם עולה ויורד עם אותו תוכן.
    """
    import bisect
    import math
    import tempfile
    dur = info["duration"]
    base = info.get("timeline_base", 0.0)
    packets = packets if packets is not None else video_packets(src)
    pts = [t for t, _ in packets]
    fps = float(info.get("video", {}).get("fps_float") or 24)
    win = gop / fps
    starts = [dur * (0.04 + 0.92 * i / max(1, n - 1)) for i in range(n)]
    enc = {c: 0 for c in crfs}
    src_bytes = 0
    with tempfile.TemporaryDirectory() as td:
        for k, t in enumerate(starts):
            t = min(t, max(0.0, dur - win - 1))
            a, b = bisect.bisect_left(pts, t + base), bisect.bisect_left(pts, t + base + win)
            src_bytes += sum(sz for _, sz in packets[a:b])
            outs = {c: Path(td) / f"s{k}_{c}.mkv" for c in crfs}
            fc = f"[0:v]{sub_filter(ass, base)},split=2[a][b]"
            cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-copyts",
                   "-i", str(src), "-filter_complex", fc]
            for lab, c in zip("ab", crfs):
                cmd += ["-map", f"[{lab}]", "-frames:v", str(gop)] + enc_args(codec, c, preset, params) + ["-an", str(outs[c])]
            run(cmd, quiet=True, env=dict(os.environ, SVT_LOG="1"))
            for c in crfs:
                enc[c] += outs[c].stat().st_size
    r1, r2 = (enc[c] / max(src_bytes, 1) for c in crfs)
    slope = (math.log(r2) - math.log(r1)) / (crfs[1] - crfs[0])
    crf = (math.log(ratio) - math.log(r1)) / slope + crfs[0]
    crf = int(min(60, max(18, math.ceil(crf - 0.15))))          # ceil = לא לעבור את היעד
    pred = r1 * math.exp(slope * (crf - crfs[0]))
    log(f"כיול: CRF{crfs[0]}=×{r1:.2f} · CRF{crfs[1]}=×{r2:.2f} מהמקור → CRF {crf} (צפוי ×{pred:.2f}, יעד ×{ratio:.2f})")
    return crf, pred


def burn(src: Path, ass: Path, out: Path, info: dict, codec: str = "av1", profile: str = "same",
         crf: int | None = None, preset: int | str | None = None, start: float | None = None,
         end: float | None = None, scale_h: int | None = None, work: Path | None = None) -> dict:
    """צריבה: ציור מראש של כל מצבי הכתוביות (libass, פעם אחת) + overlay + קידוד.

    codec="av1" (ברירת מחדל): SVT-AV1 בגודל של המקור ("same") או דחוס ("small").
    codec="h264": x264 — לתאימות מירבית (נגנים ישנים מאוד), קובץ גדול בהרבה.
    האודיו מועתק כמו שהוא (בלי קידוד מחדש) כשאפשר.
    """
    from .overlay import prerender, overlay_filter, write_list
    v, a = info.get("video", {}), info.get("audio", {})
    W, H = int(v.get("width", 1920)), int(v.get("height", 1080))
    work = work or out.parent / "_overlay"
    lst, y0, nseg = prerender(ass, work, W, H, src, FONTS_DIR)
    if start is not None:
        lst = write_list(work, start, end)
    prof = PROFILES[profile]
    if preset is None:
        preset = prof["preset"] if codec == "av1" else "slow"
    if crf is None:
        if codec == "av1":
            ratio = (1 + prof.get("headroom", 0.0)) * prof.get("ratio", 1.0)
            crf, _ = calibrate_crf(src, ass, info, ratio, codec, int(preset), prof["crfs"],
                                   params=prof["params"])
        else:
            crf = 20
    fc = overlay_filter(y0) + "[v0]"
    last = "v0"
    if scale_h:
        fc += f";[v0]scale=-2:{scale_h}[v1]"
        last = "v1"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-stats", "-y"]
    seek = []
    if start is not None:
        seek = ["-ss", f"{start:.3f}"]
    cmd += seek + ["-i", str(src), "-f", "concat", "-safe", "0", "-i", str(lst)]
    if end is not None:
        cmd += ["-t", f"{end - (start or 0.0):.3f}"]
    cmd += ["-filter_complex", fc, "-map", f"[{last}]", "-map", "0:a:0?"]
    cmd += enc_args(codec, crf, preset, prof["params"] if codec == "av1" else "") + _color_args(info)
    if profile == "small":
        mono = is_mono(src, info)
        cmd += ["-c:a", "aac", "-b:a", "64k" if mono else "96k"] + (["-ac", "1"] if mono else [])
    elif a and a.get("codec") in MP4_AUDIO_OK:
        cmd += ["-c:a", "copy"]
    else:
        cmd += ["-c:a", "aac", "-b:a", "160k"]
    cmd += ["-movflags", "+faststart", "-metadata:s:v:0", "language=eng", str(out)]
    log(f"צורב → {out.name} ({codec}, preset={preset}, crf={crf}, {nseg} מצבי כתוביות)")
    total = (end - (start or 0.0)) if end is not None else info["duration"] - (start or 0.0)
    run_progress(cmd, total, "צריבה")
    return {"codec": codec, "crf": crf, "preset": preset, "segments": nseg}


def burn_libass(src: Path, ass: Path, out: Path, info: dict, crf: int = 18, preset: str = "medium",
                start: float | None = None, end: float | None = None, scale_h: int | None = None) -> None:
    """הצריבה הישנה (subtitles + x264) — לגיבוי ולבדיקות השוואה בלבד. איטית פי 3–4."""
    v = info.get("video", {})
    a = info.get("audio", {})
    vf = sub_filter(ass)
    if scale_h:
        vf = f"{vf},scale=-2:{scale_h}"
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-stats", "-y"]
    if start is not None:
        cmd += ["-ss", f"{start:.3f}", "-copyts"]
        vf = f"{vf},setpts=PTS-STARTPTS"
    cmd += ["-i", str(src)]
    if end is not None:
        cmd += ["-t", f"{end - (start or 0.0):.3f}"]
    cmd += ["-map", "0:v:0", "-map", "0:a:0?", "-vf", vf] + enc_args("h264", crf, preset) + _color_args(info)
    if a and a.get("codec") in MP4_AUDIO_OK and start is None:
        cmd += ["-c:a", "copy"]
    else:
        cmd += ["-c:a", "aac", "-b:a", "192k"]
    if start is not None:
        cmd += ["-af", "asetpts=PTS-STARTPTS"]
    cmd += ["-movflags", "+faststart", str(out)]
    run(cmd)


SMALL_AUDIO_KBPS = 40       # AAC מונו — מספיק לדיבור
SMALL_MIN_VIDEO_KBPS = 100  # מתחת לזה התמונה מתפרקת (נבדק על TED ב־480p: 135kbps נראה טוב)


def small_bitrate(duration_s: float, target_mb: float, audio_kbps: int = SMALL_AUDIO_KBPS) -> int:
    """קצב הווידאו (kbps) שמכניס את הקובץ ל־target_mb (MiB), עם 3% מרווח למעטפת."""
    total = target_mb * 1024 * 1024 * 8 / max(duration_s, 1) / 1000 * 0.97
    return int(total - audio_kbps)


def small_copy(src: Path, out: Path, target_mb: float = 28.0) -> int:
    """עותק קטן של סרטון צרוב (x264 דו־מעברי) — לשליחה בצ'אט, שמקבל קבצים עד 30MB.
    לסרטון ארוך הקצב יוצא נמוך מדי: מזהירים, ואז עדיף Drive (rclone) או --clip."""
    dur = float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(src)],
                    capture=True, quiet=True).stdout.strip())
    v = small_bitrate(dur, target_mb)
    if v < SMALL_MIN_VIDEO_KBPS:
        log(f"אזהרה: {v}kbps לווידאו — איכות נמוכה מדי לסרטון של {dur / 60:.0f} דקות. עדיף Drive או --clip")
    log_base = str(out.with_suffix(""))
    common = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-c:v", "libx264",
              "-preset", "slow", "-b:v", f"{v}k", "-passlogfile", log_base]
    run(common + ["-pass", "1", "-an", "-f", "null", "/dev/null"])
    run(common + ["-pass", "2", "-c:a", "aac", "-b:a", f"{SMALL_AUDIO_KBPS}k", "-ac", "1",
                  "-movflags", "+faststart", str(out)])
    for f in out.parent.glob(Path(log_base).name + "*.log*"):
        f.unlink()
    log(f"גרסה קטנה → {out.name} ({out.stat().st_size / 1048576:.1f}MB, וידאו {v}kbps)")
    return v


def mux_mkv(src: Path, ass: Path, srt: Path, out: Path, style_font: str) -> None:
    """MKV: הווידאו והאודיו המקוריים בלי קידוד מחדש (איכות זהה למקור) + שתי
    רצועות כתוביות בעברית (ASS מעוצב כברירת מחדל, SRT לגיבוי) + הגופן מוטמע.

    ass = he.player.ass (אירוע אחד לכל כתובית) — לא he.ass של הצריבה, שנגנים רבים מציגים חלקית."""
    font = FONTS_DIR / style_font
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-i", str(ass),
           "-i", str(srt), "-map", "0:v:0", "-map", "0:a?", "-map", "1:0", "-map", "2:0",
           "-c", "copy", "-c:s:0", "ass", "-c:s:1", "srt",
           "-metadata:s:s:0", "language=heb", "-metadata:s:s:0", "title=עברית",
           "-metadata:s:s:1", "language=heb", "-metadata:s:s:1", "title=עברית (פשוט)",
           "-disposition:s:0", "default", "-disposition:s:1", "0"]
    if font.exists():
        cmd += ["-attach", str(font), "-metadata:s:t:0", "mimetype=application/x-truetype-font",
                "-metadata:s:t:0", f"filename={font.name}"]
    cmd += [str(out)]
    log(f"יוצר MKV → {out.name}")
    run(cmd)


def preview_frames(src: Path, ass: Path, times: list[float], out_dir: Path, base: float = 0.0,
                   width: int = 960) -> list[Path]:
    """פריים עם הכתובית בכל זמן מבוקש. ‏-copyts כדי שהכתובית תתאים לזמן האמיתי."""
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    vf = sub_filter(ass, base) + f",scale={width}:-2"
    for t in times:
        p = out_dir / f"frame_{t:09.3f}.png"
        run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-copyts",
             "-i", str(src), "-vf", vf, "-frames:v", "1", str(p)], quiet=True)
        paths.append(p)
    return paths


def contact_sheet(frames: list[Path], out: Path, cols: int = 2) -> None:
    from PIL import Image
    ims = [Image.open(f) for f in frames if f.exists()]
    if not ims:
        return
    w, h = ims[0].size
    rows = (len(ims) + cols - 1) // cols
    sheet = Image.new("RGB", (w * cols, h * rows), "black")
    for i, im in enumerate(ims):
        sheet.paste(im, ((i % cols) * w, (i // cols) * h))
    sheet.save(out)
