"""הפקת הסרטון: צריבה באיכות גבוהה, MKV עם כתוביות רכות, ותמונות בדיקה."""

from __future__ import annotations

import json
import os
import subprocess
import threading
import time
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
    # 10/10/2026 (שלב 4.3) — preset 10: נמדד על 5 דק׳ TED אמיתיות (VMAF מול המקור + אותן כתוביות כמעט בלי אובדן):
    #   מקור 1.1Mbps (CRF נחסם ב־18): הצריבה 43→28 שנ׳ (‎−34%), VMAF 96.89→96.62 (‎−0.27), גודל ×0.80→×0.87
    #   מקור 300kbps (CRF מכויל):     33→25 שנ׳ (‎−25%), VMAF 94.35→93.82 (‎−0.53), גודל ×0.93→×0.91
    #   preset 11 כבר ‎−1.5 VMAF — לא. החזרה: "preset": 9.
    "same": {"preset": 10, "headroom": 0.02, "params": "enable-tf=0:enable-variance-boost=1", "crfs": (40, 50)},
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


def svt_lp() -> int:
    """מקביליות של SVT-AV1 = הליבות שמותרות לתהליך (4–16). הפלט זהה בבית בכל lp (נמדד 20/10/2026: lp 1/2/4/אוטומטי
    — אותו md5). עד 20/10 היה lp=4 קבוע (נמדד במכונה של 4 ליבות) — בשרת של 8 ליבות חצי מהמעבד עמד בזמן הצריבה.
    ‏SNB_SVT_LP דורס (בדיקות / מדידה)."""
    v = os.environ.get("SNB_SVT_LP", "")
    if v.isdigit() and 1 <= int(v) <= 64:
        return int(v)
    try:
        n = len(os.sched_getaffinity(0))
    except (AttributeError, OSError):
        n = os.cpu_count() or 4
    try:                                         # מכסת המעבד של הקונטיינר (cgroup v2: "<quota> <period>")
        q, per = Path("/sys/fs/cgroup/cpu.max").read_text().split()[:2]
        if q != "max":
            n = min(n, max(1, int(-(-int(q) // int(per)))))
    except (OSError, ValueError):
        pass
    return max(4, min(16, n))


def enc_args(codec: str, crf: int, preset: int | str, params: str = "", lp: int | None = None) -> list[str]:
    if codec == "av1":
        # lp: מקביליות פנימית לפי הליבות (svt_lp) — פלט זהה בבית. בצריבה בחלקים — חלק מהליבות לכל חלק
        return ["-c:v", "libsvtav1", "-preset", str(preset), "-crf", str(crf),
                "-svtav1-params", f"lp={lp or svt_lp()}" + (":" + params if params else ""), "-pix_fmt", "yuv420p"]
    return ["-c:v", "libx264", "-preset", str(preset), "-crf", str(crf), "-pix_fmt", "yuv420p", "-profile:v", "high"]


CRF_MIN, CRF_MAX = 18, 60
CAL_MIN, CAL_MARGIN = 4, 4


def spread_order(n: int) -> list[int]:
    """סדר הדגימות כך שכל התחלה של הרשימה מפוזרת על כל הסרטון: 0, n-1, האמצע, הרבעים…
    (בסדר רגיל 4 הדגימות הראשונות הן השליש הראשון בלבד — עצירה מוקדמת הייתה מוטה)."""
    if n <= 2:
        return list(range(n))
    out, seen, q = [0, n - 1], {0, n - 1}, [(0, n - 1)]
    while q:
        a, b = q.pop(0)
        m = (a + b) // 2
        if m not in seen:
            out.append(m)
            seen.add(m)
        if m - a > 1:
            q.append((a, m))
        if b - m > 1:
            q.append((m, b))
    return out + [i for i in range(n) if i not in seen]


def _crf_raw(enc: dict, src_bytes: int, crfs: tuple[int, int], ratio: float) -> float:
    """ה־CRF שצפוי לתת ratio × המקור (בלי עיגול ובלי גבולות) — מהדגימות שנאספו עד עכשיו."""
    import math
    r1, r2 = (enc[c] / max(src_bytes, 1) for c in crfs)
    slope = (math.log(r2) - math.log(r1)) / (crfs[1] - crfs[0])
    if not slope < 0:                      # דגימות שקטות/זהות — אין מגמה; החלטה רק בסוף (כמו קודם)
        return float(crfs[0])
    return (math.log(ratio) - math.log(r1)) / slope + crfs[0]


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
    starts = [dur * (0.04 + 0.92 * i / max(1, n - 1)) for i in spread_order(n)]
    enc = {c: 0 for c in crfs}
    src_bytes = 0
    # 21/10/2026: הדגימות בזוגות במקביל (כמו הצריבה בחלקים), כל אחת עם חלק מהליבות. התוצאה זהה בבית (SVT-AV1 מוציא
    # אותו קובץ בכל lp), והעצירה המוקדמת נבדקת באותן נקודות (4, 6, …). נמדד בכיול של 12 דגימות 1080p ב־4 ליבות.
    par = max(1, min(len(starts), cal_par()))
    lp = max(1, svt_lp() // par) if codec == "av1" else None
    with tempfile.TemporaryDirectory() as td:
        for k0 in range(0, len(starts), par):
            # עצירה מוקדמת (שלב 4.3, 10/10/2026): מקור בקצב גבוה (סרטון מהטלפון, הרצאה ב־1Mbps) נחסם ב־CRF 18
            # בכל מקרה — אחרי 4 דגימות מפוזרות על כל הסרטון ההחלטה ידועה, ושאר הכיול מבוזבז (נמדד: 24% מזמן
            # הצריבה ב־5 דק׳). רק כשהחיזוי רחוק ≥4 מהגבול; קרוב לגבול — ממשיכים כרגיל.
            if k0 >= CAL_MIN and src_bytes > 0 and min(enc.values()) > 0:
                raw = _crf_raw(enc, src_bytes, crfs, ratio)
                if raw < CRF_MIN - CAL_MARGIN or raw > CRF_MAX + CAL_MARGIN:
                    log(f"כיול: {k0} דגימות מספיקות (החיזוי {raw:.0f} — מחוץ לטווח, נחסם)")
                    break
            cmds, batch = [], []
            for k in range(k0, min(len(starts), k0 + par)):
                t = min(starts[k], max(0.0, dur - win - 1))
                a, b = bisect.bisect_left(pts, t + base), bisect.bisect_left(pts, t + base + win)
                src_bytes += sum(sz for _, sz in packets[a:b])
                outs = {c: Path(td) / f"s{k}_{c}.mkv" for c in crfs}
                fc = f"[0:v]{sub_filter(ass, base)},split=2[a][b]"
                cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{t:.3f}", "-copyts",
                       "-i", str(src), "-filter_complex", fc]
                for lab, c in zip("ab", crfs):
                    cmd += ["-map", f"[{lab}]", "-frames:v", str(gop)] + enc_args(codec, c, preset, params, lp=lp) + ["-an", str(outs[c])]
                cmds.append(cmd)
                batch.append(outs)
            env = dict(os.environ, SVT_LOG="1")
            if len(cmds) == 1:
                run(cmds[0], quiet=True, env=env)
            else:
                from concurrent.futures import ThreadPoolExecutor
                with ThreadPoolExecutor(len(cmds)) as ex:
                    list(ex.map(lambda c: run(c, quiet=True, env=env), cmds))      # תקלה באחת — נזרקת כאן
            for outs in batch:
                for c in crfs:
                    enc[c] += outs[c].stat().st_size
    r1, r2 = (enc[c] / max(src_bytes, 1) for c in crfs)
    slope = (math.log(r2) - math.log(r1)) / (crfs[1] - crfs[0])
    crf = _crf_raw(enc, src_bytes, crfs, ratio)
    crf = int(min(CRF_MAX, max(CRF_MIN, math.ceil(crf - 0.15))))          # ceil = לא לעבור את היעד
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
    nparts = burn_parts(info.get("duration") or 0.0, work) if start is None and end is None else 1
    said = nparts > 1                            # שורת "צורב →" פעם אחת לכל צריבה (העובד סופר אותן — RenderProg)
    if nparts > 1:
        log(f"צורב → {out.name} ({codec}, preset={preset}, crf={crf}, {nseg} מצבי כתוביות, {nparts} חלקים במקביל)")
        try:
            _burn_parts(src, out, info, work, lst, y0, scale_h, codec, crf, preset, prof, profile, nparts)
            return {"codec": codec, "crf": crf, "preset": preset, "segments": nseg, "parts": nparts}
        except (subprocess.CalledProcessError, OSError, ValueError) as e:
            # כל תקלה בדרך המקבילית — הצריבה הרגילה, אותה תוצאה (רק לאט יותר). העבודה לא נופלת בגלל האצה
            log(f"· הצריבה בחלקים נכשלה ({type(e).__name__}) — צורבים בתהליך אחד")
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-stats", "-y"]
    seek = []
    if start is not None:
        seek = ["-ss", f"{start:.3f}"]
    cmd += seek + ["-i", str(src), "-f", "concat", "-safe", "0", "-i", str(lst)]
    if end is not None:
        cmd += ["-t", f"{end - (start or 0.0):.3f}"]
    cmd += ["-filter_complex", fc, "-map", f"[{last}]", "-map", "0:a:0?"]
    cmd += enc_args(codec, crf, preset, prof["params"] if codec == "av1" else "") + _color_args(info)
    cmd += _audio_args(src, info, profile)
    cmd += ["-movflags", "+faststart", "-metadata:s:v:0", "language=eng", str(out)]
    if not said:
        log(f"צורב → {out.name} ({codec}, preset={preset}, crf={crf}, {nseg} מצבי כתוביות)")
    total = (end - (start or 0.0)) if end is not None else info["duration"] - (start or 0.0)
    run_progress(cmd, total, "צריבה", every=0.02)   # 21/10/2026: כל 2% (העובד שולח לכל היותר פעם ב־15 שנ׳)
    return {"codec": codec, "crf": crf, "preset": preset, "segments": nseg}


def _audio_args(src: Path, info: dict, profile: str) -> list[str]:
    a = info.get("audio", {})
    if profile == "small":
        mono = is_mono(src, info)
        return ["-c:a", "aac", "-b:a", "64k" if mono else "96k"] + (["-ac", "1"] if mono else [])
    if a and a.get("codec") in MP4_AUDIO_OK:
        return ["-c:a", "copy"]
    return ["-c:a", "aac", "-b:a", "160k"]


# 21/10/2026 — צריבה בחלקים במקביל (בקשת המשתמש: "כמו מנהל הורדות"). SVT-AV1 בתהליך אחד לא מנצל את כל הליבות
# (וגם הפענוח וההלבשה של הכתוביות רצים בתהליך הזה), ולכן כמה חלקים במקביל — כל אחד עם חלק מהליבות — מסיימים מהר יותר.
# נמדד ב־4 ליבות, 1080p, preset 10: תהליך אחד 57.0 שנ׳ → שני חלקים 45.4 (‏−20%); תוכן כבד 39.2 → 32.9 (‏−16%);
# ארבעה חלקים לא הוסיפו (43.8 / 38.6). זיכרון: 676MB → 1,095MB בשיא.
# האיכות: אותו CRF ואותו preset בכל חלק (הכיול פעם אחת, על כל הסרטון), גבולות באמצע בין פריימים — כל פריים פעם אחת,
# בדיוק עם הכתובית שלו (אותה רשימת הלבשה, מוזזת). ההבדל היחיד: פריים מפתח בתחילת כל חלק (n−1 נוספים — זניח בגודל).
BURN_PAR_MIN_S = 120.0                           # סרטון קצר מזה — תהליך אחד (החיבור והפתיחה לא שווים)
BURN_PART_MIN_FRAMES = 1800                      # לפחות דקה ב־30fps לכל חלק


def burn_parts(duration: float, work: Path | None = None) -> int:
    """כמה חלקים במקביל: 2 עד 11 ליבות, 3 מ־12, 4 מ־16. ‏SNB_BURN_PAR דורס (1 = כבוי)."""
    v = os.environ.get("SNB_BURN_PAR", "")
    if v.isdigit() and 1 <= int(v) <= 8:
        n = int(v)
    elif duration < BURN_PAR_MIN_S:
        return 1
    else:
        n = max(2, min(4, svt_lp() // 4))
    frames = 0
    try:
        frames = len(json.loads(((work or Path(".")) / "segments.json").read_text())["times"])
    except (OSError, ValueError, KeyError):
        return 1
    return max(1, min(n, frames // BURN_PART_MIN_FRAMES if not v.isdigit() else n, frames))


def cal_par() -> int:
    """כמה דגימות כיול במקביל — כמו מספר החלקים בצריבה (בלי תלות באורך הסרטון). ‏SNB_BURN_PAR=1 מכבה."""
    v = os.environ.get("SNB_BURN_PAR", "")
    if v.isdigit() and 1 <= int(v) <= 8:
        return int(v)
    return max(2, min(4, svt_lp() // 4))


def part_bounds(nframes: int, n: int) -> list[tuple[int, int]]:
    """n טווחים של פריימים [מ, עד) — שווים ככל האפשר, בלי חפיפה ובלי חור."""
    b = [round(k * nframes / n) for k in range(n + 1)]
    return [(b[k], b[k + 1]) for k in range(n) if b[k + 1] > b[k]]


def run_parts(cmds: list[list[str]], totals: list[float], label: str, every: float = 0.02) -> None:
    """כמה ffmpeg במקביל עם שורת התקדמות אחת משותפת (סכום הזמן שקודד מכל החלקים). תקלה באחד — עוצרים את כולם."""
    env = dict(os.environ, SVT_LOG=os.environ.get("SVT_LOG", "1"))
    done = [0.0] * len(cmds)
    total = max(sum(totals), 1e-6)
    procs = []
    for c in cmds:
        c = [x for x in c if x != "-stats"]
        procs.append(subprocess.Popen(c[:1] + ["-nostats", "-progress", "pipe:1"] + c[1:], stdout=subprocess.PIPE, text=True, env=env))

    def read(i, p):
        for line in p.stdout:
            if line.startswith("out_time_us="):
                try:
                    done[i] = min(totals[i], int(line.split("=")[1]) / 1e6)
                except ValueError:
                    pass

    ths = [threading.Thread(target=read, args=(i, p), daemon=True) for i, p in enumerate(procs)]
    for t in ths:
        t.start()
    t0, nxt, bad = time.time(), every, None
    while True:
        rcs = [p.poll() for p in procs]
        if any(r not in (None, 0) for r in rcs):
            bad = next(i for i, r in enumerate(rcs) if r not in (None, 0))
            break
        frac = sum(done) / total
        if frac >= nxt:
            el = time.time() - t0
            log(f"{label}: {frac * 100:.0f}% · {el / 60:.1f} דק׳ · נותרו ~{el / max(frac, 1e-6) * (1 - frac) / 60:.1f}")
            while nxt <= frac:
                nxt += every
        if all(r == 0 for r in rcs):
            break
        time.sleep(0.5)
    if bad is not None:
        for p in procs:
            if p.poll() is None:
                p.kill()
        for p in procs:
            p.wait()
        raise subprocess.CalledProcessError(procs[bad].returncode, cmds[bad])
    for t in ths:
        t.join(2)


def count_frames(path: Path) -> int:
    p = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-count_packets", "-show_entries",
                        "stream=nb_read_packets", "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=True)
    return int(p.stdout.strip().split()[0])


def _start_time(src: Path) -> float:
    p = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=start_time", "-of", "csv=p=0", str(src)],
                       capture_output=True, text=True, check=True)
    try:
        return float(p.stdout.strip() or 0.0)
    except ValueError:
        return 0.0


def _first_pts(src: Path, x: float) -> float | None:
    """איפה קפיצה מהירה ל־x באמת נוחתת: הזמן (המקורי) של הפריים הראשון אחרי הקפיצה — אותה קפיצה שהחלק יעשה."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-copyts", "-noaccurate_seek", "-ss", f"{x:.6f}", "-i", str(src),
                        "-map", "0:v:0", "-vf", "showinfo", "-frames:v", "1", "-an", "-f", "null", "-"],
                       capture_output=True, text=True)
    import re
    m = re.search(r"pts_time:\s*(-?[0-9.]+)", p.stderr)
    return float(m.group(1)) if m else None


def seek_point(src: Path, cut: float) -> float | None:
    """נקודת קפיצה שנוחתת לפני החיתוך (זמן מקורי). קפיצה מהירה נוחתת על פריים מפתח — בדרך כלל זה שלפני, אבל לא
    תמיד: ב־MKV היא נחתה על זה שאחרי (נמצא בבדיקה: ‎-ss 6.46 → 9.5, והחלק איבד שתי שניות). לכן בודקים, וחוזרים
    אחורה עד שהיא לפני. None = מפענחים מההתחלה (נכון תמיד, רק לאט יותר)."""
    x, step = cut - 1.0, 4.0
    for _ in range(6):
        if x <= 0:
            return None
        f = _first_pts(src, x)
        if f is not None and f < cut - 1e-4:
            return x
        x -= step
        step *= 2
    return None


def _burn_parts(src: Path, out: Path, info: dict, work: Path, lst: Path, y0: int, scale_h: int | None, codec: str,
                crf: int, preset, prof: dict, profile: str, n: int) -> None:
    """כל חלק: הזמנים המקוריים (‎-copyts — אותו ציר של רשימת הכתוביות), קפיצה מהירה לפריים מפתח לפני החלק, ואז
    ‏trim בדיוק על החיתוך. לא ‎-ss מדויק: הוא משאיר גם את הפריים שמוצג ברגע החיתוך (נמצא בבדיקה — החלק השני
    התחיל פריים אחד מוקדם, ונגמר פריים אחד לפני הסוף). ‏trim שומר רק פריים שהזמן שלו ≥ החיתוך, והחיתוך באמצע בין פריימים."""
    from .overlay import cut_time, overlay_filter
    times = json.loads((work / "segments.json").read_text())["times"]
    parts = part_bounds(len(times), n)
    lp = max(1, svt_lp() // len(parts)) if codec == "av1" else None
    st = _start_time(src)                        # הזמנים ברשימה מתחילים באפס (frame_times_ms) — הווידאו לפי start_time
    pdir = work / "parts"
    pdir.mkdir(parents=True, exist_ok=True)
    cmds, totals, files = [], [], []
    for k, (fa, fb) in enumerate(parts):
        t = cut_time(times, fa)
        f = pdir / f"part{k}.mp4"
        fc = (f"[0:v]setpts=PTS-{st:.6f}/TB[m];" + overlay_filter(y0).replace("[0:v][s]", "[m][s]")
              + f"[v0];[v0]trim=start={t:.6f},setpts=PTS-STARTPTS[v1]")
        last = "v1"
        if scale_h:
            fc += f";[v1]scale=-2:{scale_h}[v2]"
            last = "v2"
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-copyts"]
        x = seek_point(src, st + t) if fa else None
        if x is not None:
            cmd += ["-noaccurate_seek", "-ss", f"{x:.6f}"]
        cmd += ["-i", str(src), "-f", "concat", "-safe", "0", "-i", str(lst), "-filter_complex", fc,
                "-map", f"[{last}]", "-frames:v", str(fb - fa), "-an"]
        cmd += enc_args(codec, crf, preset, prof["params"] if codec == "av1" else "", lp=lp) + _color_args(info)
        cmd += [str(f)]
        cmds.append(cmd)
        totals.append((cut_time(times, fb) if fb < len(times) else info.get("duration") or 0.0) - t)
        files.append(f)
    run_parts(cmds, totals, "צריבה")
    got = [count_frames(f) for f in files]
    if got != [fb - fa for fa, fb in parts]:
        raise ValueError(f"part_frames {got}")
    lst = pdir / "parts.txt"
    lst.write_text("ffconcat version 1.0\n" + "".join(f"file {f.name}\n" for f in files), encoding="utf-8")
    # הסנכרון עם הקול: החלקים מתחילים באפס, והווידאו במקור מתחיל ב־times[0] (למשל ‎23ms אחרי הקול — ריפוד של AAC)
    off = ["-itsoffset", f"{times[0] / 1000:.6f}"] if times and times[0] > 0 else []
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-y"] + off + ["-f", "concat", "-safe", "0", "-i", str(lst),
           "-i", str(src), "-map", "0:v:0", "-map", "1:a:0?", "-c:v", "copy"] + _audio_args(src, info, profile)
    cmd += ["-movflags", "+faststart", "-metadata:s:v:0", "language=eng", str(out)]
    run(cmd)
    if count_frames(out) != len(times):
        raise ValueError("out_frames")
    for f in files + [lst]:
        f.unlink(missing_ok=True)


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
    # 21/10/2026: עם התקדמות (‎-progress) — העובד מראה בטלפון את המעבר הזה כחלק משלב הצריבה, לא כעצירה
    run_progress(common + ["-pass", "1", "-an", "-f", "null", "/dev/null"], dur, "עותק קטן 1/2", every=0.05)
    run_progress(common + ["-pass", "2", "-c:a", "aac", "-b:a", f"{SMALL_AUDIO_KBPS}k", "-ac", "1",
                  "-movflags", "+faststart", str(out)], dur, "עותק קטן 2/2", every=0.05)
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
