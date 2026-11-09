"""OCR של שקפים לניתוח סרטונים (גל 0 — docs/studio-video-analysis-plan.md 3.2 שלב 8, ‏V22, ‏16.2 PR 0.1).

Tesseract 5 עם heb+eng, ‏`--psm 3`, פלט TSV, וסידור המילים מחדש לפי מיקום התיבות: שורה עם מילה עברית = RTL, ורצף
לא־עברי בתוכה שומר על סדרו הפנימי (מחקר docs/research/video-analysis/03-slides-ocr-visual.md §2: ‏0% CER בשקף עברי
ובשקף מעורב ב־720p וב־1080p; בלי הסידור — שורות קצרות במעורב יצאו בסדר הפוך, 11%, ‏issue #4680). סימני bidi מוסרים.

מקביליות: כמה תהליכי Tesseract ב־single-thread (‏OMP_THREAD_LIMIT=1) ולא תהליך אחד עם threads — שם הזמן היה
לא יציב (0.2–4.9 שנ׳). ‏Pool מגביל כמה רצים יחד, והגבול משתנה בזמן ריצה (set_limit) — שומר הזיכרון של הניתוח
מוריד אותו כשעבודת תרגום רצה במקביל (PR 0.2). התמונה עוברת ב־stdin (PNG בזיכרון) — בלי קבצים זמניים.

שורה בפלט: {text, conf (0–100, כמו ב־vi.json), box [x, y, w, h], lang he|en|mix|other, dir rtl|ltr, words}.
"""

from __future__ import annotations

import io
import os
import re
import shutil
import subprocess
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

V = 1                                      # ‏vo — גרסת ה־OCR (ממדי הגרסה)
LANGS = os.environ.get("VI_OCR_LANGS") or "heb+eng"
PSM = 3
PROCS = max(1, int(os.environ.get("VI_OCR_PROCS") or 4))
TIMEOUT = 90                               # שנ׳ לתמונה — Tesseract שנתקע לא תוקע את הניתוח
WORD_CONF = 30                             # מילה קצרה בביטחון נמוך מזה — רעש (רקע, אייקון, תמונה)
LINE_CONF = 45                             # שורה קצרה (עד 3 תווים) בביטחון נמוך מזה — רעש
HEB = re.compile(r"[֐-׿יִ-ﭏ]")
LAT = re.compile(r"[A-Za-zÀ-ɏ]")
ALNUM = re.compile(r"[\w]", re.UNICODE)
BIDI = re.compile(r"[‎‏‪-‮⁦-⁩]")


def tess() -> str | None:
    return os.environ.get("SNB_TESSERACT") or shutil.which("tesseract")


def available() -> bool:
    return bool(tess())


def _env() -> dict:
    env = dict(os.environ)
    env["OMP_THREAD_LIMIT"] = "1"
    return env


def langs() -> list[str]:
    """השפות המותקנות (‏--list-langs; השורה הראשונה היא כותרת)."""
    if not available():
        return []
    p = subprocess.run([tess(), "--list-langs"], capture_output=True, text=True, timeout=30, env=_env())
    out = (p.stdout or "") + (p.stderr or "")
    return [x.strip() for x in out.splitlines()[1:] if x.strip() and " " not in x.strip()]


def version() -> str:
    if not available():
        return ""
    p = subprocess.run([tess(), "--version"], capture_output=True, text=True, timeout=30, env=_env())
    first = ((p.stdout or "") + (p.stderr or "")).strip().splitlines()
    return first[0].strip() if first else ""


# ---------------------------------------------------------------- TSV → שורות

def clean(t: str) -> str:
    return BIDI.sub("", unicodedata.normalize("NFC", t or "")).strip()


def tsv_words(tsv: str) -> list[dict]:
    """שורות level 5 (מילים) מפלט ה־TSV של Tesseract, עם טקסט לא ריק אחרי ניקוי."""
    out = []
    rows = (tsv or "").splitlines()
    if not rows:
        return out
    head = rows[0].split("\t")
    try:
        ix = {k: head.index(k) for k in ("level", "block_num", "par_num", "line_num", "word_num", "left", "top",
                                         "width", "height", "conf", "text")}
    except ValueError:
        return out
    for r in rows[1:]:
        c = r.split("\t")
        if len(c) <= ix["text"] or c[ix["level"]] != "5":
            continue
        t = clean(c[ix["text"]])
        if not t:
            continue
        try:
            out.append({"key": (int(c[ix["block_num"]]), int(c[ix["par_num"]]), int(c[ix["line_num"]])),
                        "n": int(c[ix["word_num"]]), "x": int(c[ix["left"]]), "y": int(c[ix["top"]]),
                        "w": int(c[ix["width"]]), "h": int(c[ix["height"]]), "conf": float(c[ix["conf"]]),
                        "text": t})
        except ValueError:
            continue
    return out


def reorder_line(words: list[tuple[int, str]]) -> str:
    """[(x שמאלי, טקסט)] של שורה אחת → הטקסט בסדר הקריאה. השורה עברית אם יש בה מילה עברית אחת לפחות: מימין לשמאל,
    ורצף של מילים לא־עבריות (מונח באנגלית, מספר) שומר על סדרו משמאל לימין (האלגוריתם מהמחקר, 03 §2)."""
    if not any(HEB.search(t) for _, t in words):
        return " ".join(t for _, t in sorted(words, key=lambda w: w[0]))
    out: list[str] = []
    run: list[str] = []
    for _, t in sorted(words, key=lambda w: -w[0]):
        if HEB.search(t):
            out += reversed(run)
            run = []
            out.append(t)
        else:
            run.append(t)
    return " ".join(out + list(reversed(run)))


def lang_of(text: str) -> str:
    h, l = bool(HEB.search(text)), bool(LAT.search(text))
    return "mix" if h and l else "he" if h else "en" if l else "other"


def lines(words: list[dict]) -> list[dict]:
    """מילים → שורות בסדר של Tesseract (בלוק, פסקה, שורה), אחרי סינון רעש."""
    groups: dict[tuple, list] = {}
    for w in words:
        if w["conf"] < WORD_CONF and len(ALNUM.findall(w["text"])) < 3:
            continue
        groups.setdefault(w["key"], []).append(w)
    out = []
    for key in sorted(groups):
        ws = groups[key]
        text = reorder_line([(w["x"], w["text"]) for w in ws])
        if not ALNUM.search(text):
            continue
        conf = sum(w["conf"] for w in ws) / len(ws)
        if len(text) <= 3 and conf < LINE_CONF:
            continue
        x0, y0 = min(w["x"] for w in ws), min(w["y"] for w in ws)
        x1, y1 = max(w["x"] + w["w"] for w in ws), max(w["y"] + w["h"] for w in ws)
        out.append({"text": text, "conf": int(round(conf)), "box": [x0, y0, x1 - x0, y1 - y0],
                    "lang": lang_of(text), "dir": "rtl" if HEB.search(text) else "ltr", "words": len(ws)})
    return out


# ---------------------------------------------------------------- הרצה

def run_tsv(src, langs_: str | None = None, psm: int = PSM, timeout: float = TIMEOUT) -> str:
    """Tesseract על נתיב לתמונה, או על bytes של תמונה (דרך stdin) → TSV. נכשל → RuntimeError."""
    exe = tess()
    if not exe:
        raise RuntimeError("Tesseract לא מותקן")
    data = None
    if isinstance(src, (bytes, bytearray)):
        data, arg = bytes(src), "stdin"
    else:
        arg = str(src)
    p = subprocess.run([exe, arg, "stdout", "-l", langs_ or LANGS, "--psm", str(psm), "tsv"], input=data,
                       capture_output=True, timeout=timeout, env=_env())
    if p.returncode != 0:
        raise RuntimeError(f"tesseract ({p.returncode}): {p.stderr.decode('utf-8', 'replace')[-300:].strip()}")
    return p.stdout.decode("utf-8", "replace")


def png_bytes(img) -> bytes:
    """תמונת PIL או מערך numpy (אפור / RGB) → PNG בזיכרון."""
    from PIL import Image
    if not isinstance(img, Image.Image):
        img = Image.fromarray(img)
    buf = io.BytesIO()
    img.save(buf, format="PNG", compress_level=1)
    return buf.getvalue()


def ocr(src) -> dict:
    """תמונה אחת (נתיב, bytes, PIL או numpy) → {lines, words, conf, ms}. השגיאה נשמרת ולא נזרקת."""
    t0 = time.time()
    try:
        if isinstance(src, (str, Path, bytes, bytearray)):
            tsv = run_tsv(src)
        else:
            tsv = run_tsv(png_bytes(src))
        ws = tsv_words(tsv)
        ls = lines(ws)
        n = sum(x["words"] for x in ls)
        conf = round(sum(x["conf"] * x["words"] for x in ls) / n) if n else 0
        return {"lines": ls, "words": n, "conf": conf, "ms": int((time.time() - t0) * 1000)}
    except (RuntimeError, OSError, subprocess.TimeoutExpired, ValueError) as e:
        return {"lines": [], "words": 0, "conf": 0, "ms": int((time.time() - t0) * 1000), "error": str(e)[:300]}


class Pool:
    """כמה תהליכי OCR במקביל, בגבול שאפשר לשנות תוך כדי (set_limit). התוצאות בסדר הקלט."""

    def __init__(self, limit: int | None = None, fn=None):
        self.max = max(1, int(limit or PROCS))
        self.limit = self.max
        self.fn = fn or ocr
        self._cv = threading.Condition()
        self._busy = 0
        self.peak = 0

    def set_limit(self, n: int) -> None:
        with self._cv:
            self.limit = max(1, min(self.max, int(n)))
            self._cv.notify_all()

    def _one(self, item):
        with self._cv:
            while self._busy >= self.limit:
                self._cv.wait()
            self._busy += 1
            self.peak = max(self.peak, self._busy)
        try:
            return self.fn(item)
        finally:
            with self._cv:
                self._busy -= 1
                self._cv.notify_all()

    def map(self, items) -> list:
        items = list(items)
        if not items:
            return []
        with ThreadPoolExecutor(max_workers=min(self.max, len(items))) as ex:
            return list(ex.map(self._one, items))
