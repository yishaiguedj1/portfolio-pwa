"""יישור CTC שני (MMS_FA של torchaudio) והכרעה בין מנועי היישור.

ממצא המבחן מול TED (ריד הייסטינגס, 392 כתוביות אנושיות): ל־Qwen3-ForcedAligner
חציון מצוין (~60ms) אבל זנב כבד — 165 מילים "קופלו" ל־20ms, ובמקרים בודדים
מילה הוקדמה בשנייה שלמה (כתובית שמופיעה לפני שהדובר פותח את הפה).
יישור CTC קלאסי (wav2vec2, השיטה של WhisperX) טועה בדרך אחרת. לכן לכל מילה
לוקחים את החציון של שלושה מקורות בלתי תלויים: Qwen, ‏CTC וזמני מנוע התמלול.
מקור אחד שטועה בגסות לא יכול להזיז את התוצאה.

MMS_FA: מודל wav2vec2 של 315M פרמטרים שאומן במיוחד ליישור (1.2GB, נשמר במטמון
של torch). רץ על CPU בחלונות של ~30 שניות.
"""

from __future__ import annotations

import re
import statistics
import time
import unicodedata

import numpy as np

from .util import log

SR = 16000
WIN_S = 30.0
MARGIN_S = 0.6

_ONES = ("zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
         "fifteen sixteen seventeen eighteen nineteen").split()
_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split()


def num_words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    if n < 100:
        return _TENS[n // 10] + ("" if n % 10 == 0 else " " + _ONES[n % 10])
    if n < 1000:
        return _ONES[n // 100] + " hundred" + ("" if n % 100 == 0 else " " + num_words(n % 100))
    for div, name in ((10 ** 12, "trillion"), (10 ** 9, "billion"), (10 ** 6, "million"), (1000, "thousand")):
        if n >= div:
            return num_words(n // div) + " " + name + ("" if n % div == 0 else " " + num_words(n % div))
    return ""


def _year(n: int) -> str:
    if 2000 <= n <= 2009:
        return num_words(n)
    hi, lo = divmod(n, 100)
    return num_words(hi) + (" hundred" if lo == 0 else (" oh " + _ONES[lo] if lo < 10 else " " + num_words(lo)))


def spoken(word: str) -> str:
    """המילה כפי שהיא נשמעת: אותיות a-z וגרש בלבד (ספרות נכתבות במילים)."""
    t = unicodedata.normalize("NFKD", word.replace("’", "'"))
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).lower()
    dollars = "$" in t
    t = t.replace("%", " percent ").replace("&", " and ").replace("+", " plus ")

    def num(m: re.Match) -> str:
        s = m.group(0).replace(",", "")
        if "." in s:
            a, b = s.split(".", 1)
            return f"{num_words(int(a or 0))} point {' '.join(_ONES[int(d)] for d in b if d.isdigit())}"
        n = int(s)
        if 1100 <= n <= 2099 and len(s) == 4 and "," not in m.group(0):
            return _year(n)
        return num_words(n)
    t = re.sub(r"\d[\d,]*(?:\.\d+)?", num, t)
    t = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", t)
    if dollars:
        t += " dollars"
    return re.sub(r"[^a-z']", "", t)


class CtcAligner:
    def __init__(self):
        import torch
        import torchaudio
        t0 = time.time()
        self.torch = torch
        self.F = torchaudio.functional
        # שלב 4.1: אותו מודל כגרף ONNX INT8 בתמונת העובד (translator/aligner_export.py) — ה־forced_align
        # עצמו נשאר של torchaudio. תקלה בגרף = המודל של torch.
        self.ort = None
        from .align_onnx import onnx_dir, session, verify
        d = onnx_dir()
        if d is not None and (d / "ctc.onnx").is_file() and (d / "ctc-dict.json").is_file():
            try:
                verify(d)
                self.ort = session(d / "ctc.onnx")
                import json
                self.dict = json.loads((d / "ctc-dict.json").read_text())
                self.star = self.dict["*"]
                log(f"מודל CTC ‏(MMS_FA · ONNX INT8) נטען ({time.time() - t0:.0f} שנ׳)")
                return
            except Exception as e:  # noqa: BLE001
                self.ort = None
                log(f"⚠ גרף ה־CTC לא נטען ({type(e).__name__}) — ממשיכים ב־torch")
        b = torchaudio.pipelines.MMS_FA
        try:
            self.model = b.get_model(with_star=True)
        except RuntimeError:
            # torch.hub לא בודק גודל/hash: הורדה שנקטעה נשארת במטמון כקובץ פגום, וכל עבודה אחריה נכשלת
            # ("failed finding central directory"). מוחקים את הקובץ ומורידים פעם אחת מחדש.
            import os
            cached = os.path.join(torch.hub.get_dir(), "checkpoints", os.path.basename(b._path))
            if not os.path.exists(cached):
                raise
            log("מודל ה־CTC במטמון פגום — מוריד מחדש")
            os.remove(cached)
            self.model = b.get_model(with_star=True)
        self.dict = b.get_dict(star="*")
        self.star = self.dict["*"]
        log(f"מודל CTC ‏(MMS_FA) נטען ({time.time() - t0:.0f} שנ׳)")

    def align(self, audio: np.ndarray, words: list[str]) -> list[tuple[float, float] | None]:
        """זמנים (שניות מתחילת הקטע) לכל מילה; None למילה בלי אותיות."""
        torch = self.torch
        toks, owner = [self.star], [-1]
        for k, w in enumerate(words):
            for ch in w:
                if ch in self.dict:
                    toks.append(self.dict[ch])
                    owner.append(k)
        toks.append(self.star)
        owner.append(-1)
        out: list[tuple[float, float] | None] = [None] * len(words)
        if len(toks) <= 2:
            return out
        if self.ort is not None:
            em = torch.from_numpy(self.ort.run(None, {"x": audio.astype(np.float32)[None]})[0])
        else:
            with torch.inference_mode():
                em, _ = self.model(torch.from_numpy(audio.astype(np.float32)).unsqueeze(0))
        if em.shape[1] < len(toks) * 2:
            return out
        ali, scores = self.F.forced_align(em, torch.tensor([toks], dtype=torch.int32), blank=0)
        spans = self.F.merge_tokens(ali[0], scores[0].exp())
        if len(spans) != len(toks):
            return out
        ratio = len(audio) / em.shape[1] / SR
        first: dict[int, int] = {}
        last: dict[int, int] = {}
        for sp, k in zip(spans, owner):
            if k < 0:
                continue
            first.setdefault(k, sp.start)
            last[k] = sp.end
        for k in first:
            out[k] = (first[k] * ratio, last[k] * ratio)
        return out


def _plan(words: list[dict], key_s: str, key_e: str, max_s: float) -> list[tuple[int, int]]:
    """חלונות של עד max_s שניות, חתוכים בשתיקה הארוכה ביותר ב־40% האחרונים."""
    out, i0, n = [], 0, len(words)
    while i0 < n:
        j = i0
        while j + 1 < n and words[j + 1][key_e] - words[i0][key_s] <= max_s:
            j += 1
        if j + 1 >= n:
            out.append((i0, n))
            break
        lo = i0 + max(1, int((j - i0) * 0.6))
        k = max(range(lo, j + 1), key=lambda q: words[q + 1][key_s] - words[q][key_e])
        out.append((i0, k + 1))
        i0 = k + 1
    return out


def ctc_align(words: list[dict], wav_path: str) -> dict:
    """מוסיף לכל מילה s_ctc/e_ctc. חלונות לפי הזמנים הקיימים + שוליים וכוכבית בקצוות."""
    import soundfile as sf
    audio, sr = sf.read(wav_path, dtype="float32")
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    assert sr == SR, "נדרש WAV ב־16kHz (vt ingest יוצר כזה)"
    total = len(audio) / SR
    # גבולות החלון: הזמן המוקדם/המאוחר מבין המקורות, כדי לא לחתוך מילה
    for w in words:
        w["_lo"] = min(x for x in (w["s"], w.get("s_asr", w["s"])) if x is not None)
        w["_hi"] = max(x for x in (w["e"], w.get("e_asr", w["e"])) if x is not None)
    al = CtcAligner()
    t0 = time.time()
    plan = _plan(words, "_lo", "_hi", WIN_S)
    ok = 0
    for ci, (i0, i1) in enumerate(plan):
        a = max(0.0, words[i0]["_lo"] - MARGIN_S)
        b = min(total, words[i1 - 1]["_hi"] + MARGIN_S)
        if i0 > 0:
            a = max(a, min(words[i0 - 1]["_hi"], words[i0]["_lo"]) - 0.05)
        seg = audio[int(a * SR):int(b * SR)]
        res = al.align(seg, [spoken(w["w"]) for w in words[i0:i1]])
        for k, r in enumerate(res):
            w = words[i0 + k]
            if r is None:
                w.pop("s_ctc", None)
                w.pop("e_ctc", None)
                continue
            w["s_ctc"], w["e_ctc"] = round(a + r[0], 3), round(a + r[1], 3)
            ok += 1
        if (ci + 1) % 10 == 0 or ci + 1 == len(plan):
            log(f"  CTC {ci + 1}/{len(plan)} ({b / 60:.1f}/{total / 60:.1f} דק׳, {time.time() - t0:.0f} שנ׳)")
    for w in words:
        w.pop("_lo", None)
        w.pop("_hi", None)
    return {"windows": len(plan), "aligned": ok, "seconds": round(time.time() - t0, 1)}


def consensus(words: list[dict]) -> dict:
    """זמן סופי לכל מילה: חציון של המקורות הזמינים (Qwen, ‏CTC, תמלול).

    התחלה — חציון של שלושה (או ממוצע של שניים שמסכימים, אחרת CTC).
    סוף — חציון של Qwen, ‏CTC וסוף התמלול חסום בתחילת המילה הבאה (מנוע התמלול
    מצרף את השתיקה שאחרי המילה לסוף שלה).
    """
    n = len(words)
    st = {"median3": 0, "two": 0, "one": 0, "moved_100ms": 0}
    for w in words:
        if "s_qwen" not in w:
            w["s_qwen"], w["e_qwen"] = (w["s"], w["e"]) if w.get("align") == "qwen3" else (None, None)
    for i, w in enumerate(words):
        nxt = words[i + 1].get("s_asr") if i + 1 < n else None
        e_asr = w.get("e_asr")
        if e_asr is not None and nxt is not None:
            e_asr = min(e_asr, nxt)
        ss = [x for x in (w.get("s_qwen"), w.get("s_ctc"), w.get("s_asr")) if x is not None]
        es = [x for x in (w.get("e_qwen"), w.get("e_ctc"), e_asr) if x is not None]
        if not ss:
            continue
        if len(ss) == 3:
            s = statistics.median(ss)
            st["median3"] += 1
        elif len(ss) == 2:
            s = sum(ss) / 2 if abs(ss[0] - ss[1]) <= 0.25 else (w.get("s_ctc") or ss[0])
            st["two"] += 1
        else:
            s = ss[0]
            st["one"] += 1
        e = statistics.median(es) if len(es) == 3 else (max(es) if es else s + 0.1)
        if abs(s - w["s"]) > 0.1:
            st["moved_100ms"] += 1
        w["s"], w["e"] = round(s, 3), round(max(e, s + 0.04), 3)
        w["align"] = "consensus"
    # מונוטוניות: התחלות לא יורדות, סוף לא עובר את תחילת הבאה
    for i in range(1, n):
        if words[i]["s"] < words[i - 1]["s"]:
            words[i]["s"] = words[i - 1]["s"]
    for i in range(n - 1):
        if words[i]["e"] > words[i + 1]["s"]:
            words[i]["e"] = max(words[i]["s"] + 0.02, words[i + 1]["s"])
        if words[i]["e"] < words[i]["s"]:
            words[i]["e"] = words[i]["s"] + 0.02
    return st
