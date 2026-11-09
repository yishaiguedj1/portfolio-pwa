"""ניתוח סרטונים — השלבים הכבדים בעובד (גל 0, PR 0.2; docs/studio-video-analysis-plan.md 3.1–3.3, 16.2).

כל שלב הוא פקודת vt (‏vi-asr, ‏vi-align, ‏vi-screen, ‏vi-small), והמתזמר (translator/analyze.py) מריץ אותן דרך job.vt.
כך לכל אחת נרשמים זמן, שיא זיכרון וזמן מעבד ב־snb-timing.json (‏devPull), ותקלת זיכרון מסומנת כמו בתרגום.
השלבים רצים ברצף ולא במקביל, כך שבכל רגע יש בזיכרון מודל אחד בלבד (3.3).

יישור המילים בלי MMS_FA (רישיון NC — אסור בניתוח, פרק 15):
- אנגלית: Qwen3-ForcedAligner לבד.
- עברית: ה־CTC העברי של הקריוקי (‏vt/align_he.py, ‏Apache-2.0) בחלונות סביב קטעי ivrit.
- מה שלא יושר שומר על זמן משוער, מסומן `c` (‏ts_coarse).

המסך:
- גלאי השקפים (vt/slides.py).
- פריים עד 1080p לכל שקף — המצב האחרון, שבו כל מה שנחשף.
- OCR (vt/ocr.py) במאגר תהליכים, ששומר הזיכרון מקטין ומגדיל.
- חבילת WebP אחת (‏vis, 10.3), ותמונה ממוזערת.
"""

from __future__ import annotations

import io
import json
import os
import subprocess
import threading
import time
from pathlib import Path

from .util import log

V = 1
FRAME_H = 1080                 # פריים ל־OCR — עד 1080p (מחקר 8.5: גלאי ברזולוציה נמוכה, OCR בגבוהה)
VIS_W = 1280                   # רוחב מרבי בחבילת השקפים (10.3)
VIS_Q = 80                     # איכות WebP
THUMB_W = 480
SMALL_H = 480                  # עותק הצפייה — ‏480p בלי צריבה (4.4)
SMALL_CRF = 30
LOWRES_H = 480                 # מתחת לזה — ‏vi_lowres (קשה ל־OCR)
GUARD_S = 2.0                  # שומר הזיכרון: דגימה כל 2 שנ׳ (3.3)
GUARD_HI, GUARD_LO = 0.9, 0.6  # מעל 90% מההזמנה — פחות תהליכים; מתחת ל־60% — חוזרים לאט
AVAIL_LOW, AVAIL_OK = 768, 2048   # MB פנויים בקונטיינר: מתחת — פחות תהליכים; מעל — אפשר לחזור


# ---------------------------------------------------------------- זיכרון

def _release_memory() -> None:
    import gc
    gc.collect()
    try:
        import ctypes
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except (OSError, AttributeError):
        pass


def _children() -> dict:
    kids: dict = {}
    proc = Path("/proc")
    for d in proc.iterdir() if proc.is_dir() else []:
        if d.name.isdigit():
            try:
                st = (d / "stat").read_text()
                kids.setdefault(int(st[st.rindex(")") + 2:].split()[1]), []).append(int(d.name))
            except (OSError, ValueError, IndexError):
                continue
    return kids


def tree_rss_mb(pid: int | None = None) -> float:
    """RSS של התהליך וכל צאצאיו (Tesseract, ‏ffmpeg) — כמו tree_rss_mb בסוכן."""
    pid = pid or os.getpid()
    kids = _children()
    try:
        page = os.sysconf("SC_PAGE_SIZE")
    except (ValueError, OSError):
        page = 4096
    tot, todo, seen = 0, [pid], set()
    while todo:
        p = todo.pop()
        if p in seen:
            continue
        seen.add(p)
        try:
            tot += int(Path(f"/proc/{p}/statm").read_text().split()[1]) * page
        except (OSError, ValueError, IndexError):
            pass
        todo.extend(kids.get(p, []))
    return tot / (1024 * 1024)


def avail_mb() -> float | None:
    """כמה זיכרון פנוי בקונטיינר: הקטן מבין התקרה של ה־cgroup פחות מה שבשימוש, ו־MemAvailable."""
    out = []
    try:
        mx = Path("/sys/fs/cgroup/memory.max").read_text().strip()
        cur = Path("/sys/fs/cgroup/memory.current").read_text().strip()
        if mx.isdigit() and cur.isdigit():
            out.append((int(mx) - int(cur)) / 1048576)
    except OSError:
        pass
    try:
        for line in Path("/proc/meminfo").read_text().splitlines():
            if line.startswith("MemAvailable:"):
                out.append(int(line.split()[1]) / 1024)
                break
    except (OSError, ValueError, IndexError):
        pass
    return min(out) if out else None


class MemGuard(threading.Thread):
    """השומר שבתוך העבודה (3.3): בזמן ה־OCR דוגם כל GUARD_S שנ׳ את הזיכרון של העבודה (עם הצאצאים) ואת הפנוי בקונטיינר.
    מתקרבים להזמנה או לתקרה — מאגר התהליכים קטן באחד (עד 1); יש מרווח — חוזר לאט. תחת gVisor חריגה מפילה את כל
    הקונטיינר, ולכן עדיף OCR איטי יותר."""

    def __init__(self, pool, budget_mb: float = 0.0, every: float = GUARD_S, rss=None, avail=None):
        super().__init__(daemon=True)
        self.pool, self.budget, self.every = pool, float(budget_mb or 0), every
        self._rss, self._avail = rss or tree_rss_mb, avail or avail_mb
        self.stop_ev = threading.Event()
        self.peak, self.cuts, self.low = 0.0, 0, pool.limit

    def step(self) -> None:
        rss, av = self._rss(), self._avail()
        self.peak = max(self.peak, rss)
        lim = self.pool.limit
        tight = (self.budget and rss > GUARD_HI * self.budget) or (av is not None and av < AVAIL_LOW)
        roomy = (not self.budget or rss < GUARD_LO * self.budget) and (av is None or av > AVAIL_OK)
        if tight and lim > 1:
            self.pool.set_limit(lim - 1)
            self.cuts += 1
        elif roomy and not tight and lim < self.pool.max:
            self.pool.set_limit(lim + 1)
        self.low = min(self.low, self.pool.limit)

    def run(self) -> None:
        while not self.stop_ev.wait(self.every):
            try:
                self.step()
            except Exception:  # noqa: BLE001 — השומר לא מפיל את ה־OCR
                continue

    def stop(self) -> None:
        self.stop_ev.set()


# ---------------------------------------------------------------- תמלול

def words_from_segments(segs: list[dict]) -> list[dict]:
    """קטעי ivrit (s, e, text) → מילים עם זמן משוער לפי אורך האותיות, ו־li = מספר הקטע (העוגנים של ה־CTC העברי).
    המילים מסומנות c=1 (גס) עד שהיישור מחליף אותן."""
    out = []
    for li, g in enumerate(segs):
        toks = str(g.get("text") or "").split()
        s, e = float(g.get("s") or 0), float(g.get("e") or 0)
        if not toks or e <= s:
            continue
        n = sum(len(t) for t in toks)
        acc = 0
        for t in toks:
            a = s + (e - s) * acc / n
            acc += len(t)
            out.append({"w": t, "s": round(a, 3), "e": round(s + (e - s) * acc / n, 3), "li": li, "c": 1})
    return out


def asr(wav: str, lang: str) -> dict:
    """שמע 16kHz → מילים עם זמן. עברית — vt/asr_he.py (‏VAD → ivrit → zipformer); אנגלית — Parakeet, כמו בתרגום."""
    t0 = time.time()
    if lang == "he":
        from . import asr_he
        r = asr_he.run(wav, log=log)
        segs = [g for g in r.get("segments") or [] if str(g.get("text") or "").strip()]
        words = words_from_segments(segs)
        st = {k: v for k, v in (r.get("stats") or {}).items() if isinstance(v, (int, float)) and not isinstance(v, bool)}
        return {"v": V, "lang": "he", "engine": r.get("engine"), "quality": r.get("quality") or "ok", "words": words,
                "stats": dict(st, n=len(words), s=round(time.time() - t0, 1)), "timing": r.get("timing") or {}}
    from . import asr_parakeet
    r = asr_parakeet.transcribe(wav, quantization="int8")
    words = [dict({"w": str(w["w"]), "s": round(float(w["s"]), 3), "e": round(float(w["e"]), 3)},
                  **({"p": w["conf"]} if isinstance(w.get("conf"), (int, float)) else {}))
             for w in r.get("words") or [] if w.get("w") and w.get("e") is not None and w.get("s") is not None]
    return {"v": V, "lang": "en", "engine": "parakeet", "quality": "ok" if words else "low", "words": words,
            "stats": {"n": len(words), "s": round(time.time() - t0, 1)}}


def align(tr: dict, wav: str) -> dict:
    """זמן לכל מילה (שלב 5 ב־3.2), ואחריו דוברים. תקלה = הזמנים מהתמלול נשארים (‏ts_coarse), לא כישלון."""
    words = [dict(w) for w in tr.get("words") or []]
    lang = tr.get("lang") or "en"
    st: dict = {"n": len(words)}
    aligner, t0 = "none", time.time()
    if words and lang == "en":
        try:
            from .align import align_words
            words, s = align_words(words, wav, device="cpu")
            st.update({k: v for k, v in s.items() if isinstance(v, (int, float)) and not isinstance(v, bool)})
            aligner = "qwen3"
        except Exception as e:  # noqa: BLE001
            log(f"יישור נכשל — נשארים עם זמני התמלול: {type(e).__name__}")
            for w in words:
                w["c"] = 1
            aligner = "asr"
        _release_memory()
    elif words:
        try:
            from . import align_he
            model, d = align_he.load_ctc()
            audio = align_he.load_audio(wav)
            got = align_he.ctc_align(model, d, audio, words)
            for w, g in zip(words, got):
                if g:
                    w["s"], w["e"] = g["s"], g["e"]
                    w.pop("c", None)
            del model, audio
            aligner = "ctc-he"
        except Exception as e:  # noqa: BLE001
            log(f"היישור העברי נכשל — נשארים עם זמני הקטעים: {type(e).__name__}")
            aligner = "seg"
        _release_memory()
    st["coarse"] = sum(1 for w in words if w.get("c"))
    st["align_s"] = round(time.time() - t0, 1)
    if words:
        try:
            from . import diarize
            ds = diarize.diarize(words, wav)
            if isinstance(ds, dict):
                st.update({"spk_" + k: v for k, v in ds.items() if isinstance(v, (int, float)) and not isinstance(v, bool)})
        except Exception as e:  # noqa: BLE001 — בלי דוברים
            log(f"זיהוי דוברים נכשל: {type(e).__name__}")
        _release_memory()
    n = len(words)
    ts = "none" if not n else ("word" if st["coarse"] <= 0.2 * n else "seg")
    return {"v": V, "lang": lang, "aligner": aligner, "ts": ts, "words": words, "stats": st}


# ---------------------------------------------------------------- מסך

def _ffmpeg() -> str:
    return os.environ.get("SNB_FFMPEG") or "ffmpeg"


def frame_bytes(src: str, t: float, h: int = FRAME_H, timeout: float = 60) -> bytes:
    """פריים אחד בזמן t כ־PNG בזיכרון, עד h שורות (לא מגדילים מקור קטן)."""
    cmd = [_ffmpeg(), "-nostdin", "-hide_banner", "-loglevel", "error", "-ss", f"{max(0.0, t):.3f}", "-i", str(src),
           "-map", "0:v:0", "-frames:v", "1", "-vf", f"scale=-2:'min({h},ih)':flags=lanczos", "-f", "image2pipe",
           "-c:v", "png", "pipe:1"]
    p = subprocess.run(cmd, capture_output=True, timeout=timeout)
    if p.returncode != 0 or not p.stdout:
        raise RuntimeError("frame: " + p.stderr.decode("utf-8", "replace")[-200:].strip())
    return p.stdout


def webp(png: bytes, max_w: int = VIS_W, q: int = VIS_Q) -> tuple[bytes, int, int, str]:
    """PNG → WebP (או JPEG כש־Pillow בלי WebP), ברוחב עד max_w. מחזיר (bytes, w, h, סוג)."""
    from PIL import Image, features
    im = Image.open(io.BytesIO(png))
    im.load()
    if im.mode not in ("RGB", "L"):
        im = im.convert("RGB")
    if im.width > max_w:
        im = im.resize((max_w, max(1, round(im.height * max_w / im.width))), Image.LANCZOS)
    buf = io.BytesIO()
    if features.check("webp"):
        im.save(buf, format="WEBP", quality=q, method=4)
        kind = "webp"
    else:
        im.save(buf, format="JPEG", quality=q, optimize=True)
        kind = "jpeg"
    return buf.getvalue(), im.width, im.height, kind


def thumb(png: bytes, out: Path, w: int = THUMB_W) -> None:
    from PIL import Image
    im = Image.open(io.BytesIO(png)).convert("RGB")
    if im.width > w:
        im = im.resize((w, max(1, round(im.height * w / im.width))), Image.LANCZOS)
    im.save(out, format="JPEG", quality=82, optimize=True)


class _Prog:
    """שורות "N%" ל־job.vt (vt_frac) — רק כשהאחוז עולה, ונעול בין התהליכונים."""

    def __init__(self, lo: float, hi: float, n: int):
        self.lo, self.hi, self.n, self.k, self.last = lo, hi, max(1, n), 0, -1
        self.lock = threading.Lock()

    def tick(self) -> None:
        with self.lock:
            self.k += 1
            pct = int(self.lo + (self.hi - self.lo) * self.k / self.n)
            if pct > self.last:
                self.last = pct
                print(f"מסך: {pct}%", flush=True)


def screen(src: str, out_dir: Path, procs: int | None = None, mem_mb: float = 0.0, max_s: float | None = None,
           detect=None, frame=None, ocr_fn=None) -> dict:
    """שלב המסך: גלאי → פריים לכל שקף → OCR + WebP במאגר תהליכים עם שומר זיכרון → vis.bin, ‏thumb.jpg, ‏screen.json.
    detect/frame/ocr_fn — לבדיקות (ברירת המחדל: vt/slides, ‏ffmpeg, ‏vt/ocr)."""
    from . import ocr as O
    from . import slides as S
    from .media import probe
    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    v = probe(Path(src)).get("video") or {}
    w, h = int(v.get("width") or 0), int(v.get("height") or 0)
    res = {"v": V, "w": w, "h": h, "units": [], "noscreen": True, "lowres": bool(h and h < LOWRES_H),
           "img": None, "stats": {}}
    if not w or not h:
        res["stats"] = {"wall_s": round(time.time() - t0, 1)}
        return res
    r = (detect or (lambda: S.detect(src, max_s=max_s, size=(w, h), log=log)))()
    print("מסך: 40%", flush=True)
    st = dict(r.get("stats") or {})
    res["dur"] = r.get("dur")
    res["noscreen"] = S.noscreen(r)
    units = r.get("units") or []
    slides = [u for u in units if u.get("kind") == "slide" and u.get("states")]
    frame = frame or (lambda t: frame_bytes(src, t))
    ocr_fn = ocr_fn or O.ocr
    prog = _Prog(40, 95, len(slides))
    tm = {"fr": 0.0, "ocr": 0.0, "wp": 0.0}
    tl = threading.Lock()

    def one(u):
        a = time.time()
        png = frame(float(u["states"][-1].get("frame_t", u["states"][-1]["t0"])))
        b = time.time()
        o = ocr_fn(png)
        c = time.time()
        img = webp(png)
        d = time.time()
        with tl:
            tm["fr"] += b - a
            tm["ocr"] += c - b
            tm["wp"] += d - c
        prog.tick()
        return png if u is slides[0] else None, o, img

    pool = O.Pool(procs, fn=lambda u: _safe(one, u))
    guard = MemGuard(pool, mem_mb)
    t1 = time.time()
    guard.start()
    try:
        got = pool.map(slides)
    finally:
        guard.stop()
    st["shots_s"] = round(time.time() - t1, 1)
    pack, off, n_err, confs = bytearray(), 0, 0, []
    first_png = None
    for u, g in zip(slides, got):
        if isinstance(g, Exception):
            n_err += 1
            u["ocr"] = {"lines": [], "words": 0, "conf": 0, "error": type(g).__name__}
            continue
        png, o, (data, iw, ih, kind) = g
        first_png = first_png or png
        u["ocr"] = o
        if o.get("error"):
            n_err += 1
        elif o.get("words"):
            confs.append(o["conf"])
        u["img"] = {"o": off, "l": len(data), "w": iw, "h": ih}
        pack += data
        off += len(data)
        res["img"] = kind
    if pack:
        (out_dir / "vis.bin").write_bytes(bytes(pack))
    try:
        tp = first_png or frame(float(res.get("dur") or 0) * 0.1)
        thumb(tp, out_dir / "thumb.jpg")
    except Exception as e:  # noqa: BLE001 — בלי תמונה ממוזערת
        log(f"תמונה ממוזערת נכשלה: {type(e).__name__}")
    st.update({"ocr_n": len(slides), "ocr_err": n_err, "ocr_conf": round(sum(confs) / len(confs)) if confs else 0,
               "frame_s": round(tm["fr"], 1), "ocr_s": round(tm["ocr"], 1), "webp_s": round(tm["wp"], 1),
               "procs": pool.max, "lim_min": guard.low, "cuts": guard.cuts, "peak_mb": round(guard.peak),
               "pool_peak": pool.peak, "vis_kb": round(len(pack) / 1024), "wall_s": round(time.time() - t0, 1)})
    res["units"] = units
    res["stats"] = st
    print("מסך: 100%", flush=True)
    log(f"מסך: {len(slides)} שקפים · OCR {st['ocr_s']} שנ׳ מצטבר, ‏{n_err} כשלים, ביטחון {st['ocr_conf']} · "
        f"תהליכים {pool.max} (מינימום {guard.low}) · חבילה {st['vis_kb']}KB · {st['wall_s']} שנ׳")
    return res


def _safe(fn, x):
    try:
        return fn(x)
    except Exception as e:  # noqa: BLE001 — שקף אחד שנכשל לא מפיל את השלב
        return e


# ---------------------------------------------------------------- עותק הצפייה

def small(src: str, out: Path, dur: float) -> None:
    """‏480p בלי צריבה, בקידוד אחד (CRF) — לנגן של הניתוח (4.4). שורות "N%" ל־job.vt."""
    from .util import run_progress
    cmd = [_ffmpeg(), "-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-i", str(src), "-map", "0:v:0", "-map", "0:a:0?",
           "-vf", f"scale=-2:'min({SMALL_H},ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", str(SMALL_CRF),
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "64k", "-ac", "1", "-movflags", "+faststart", str(out)]
    run_progress(cmd, dur, "עותק צפייה", every=0.05)


def write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
