"""תמלול בענן — המנועים המדויקים ביותר באנגלית (2026), עם זיהוי דוברים.

• ElevenLabs Scribe v2 — חותמות זמן למילה, זיהוי דוברים (עד 32), ו־keyterms:
  רשימת שמות ומונחים (שם המנכ"ל, החברה, מוצרים) שמשפרת מאוד את הדיוק בהם.
  מפתח: משתנה הסביבה ELEVENLABS_API_KEY.
• AssemblyAI Universal-3.5 Pro — מודל "עם הנחיות": keyterms + תיאור הקשר.
  מפתח: משתנה הסביבה ASSEMBLYAI_API_KEY.

המפתחות נשמרים רק במשתני הסביבה של סביבת הענן — לעולם לא בקבצים או בצ'אט.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

from .transcript import renumber_speakers, sanity_fix_times
from .util import log, die


def _requests():
    try:
        import requests
        return requests
    except ImportError:
        die("חסרה חבילת requests (pip install requests)")


# ---------------------------------------------------------------------------
# ElevenLabs Scribe v2
# ---------------------------------------------------------------------------

ELEVEN_URL = "https://api.elevenlabs.io/v1/speech-to-text"
ELEVEN_MODEL = "scribe_v2"


def elevenlabs(audio_path: Path, keyterms: list[str] | None = None, num_speakers: int | None = None) -> dict:
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        die("לא מוגדר ELEVENLABS_API_KEY בסביבה")
    rq = _requests()
    data = [("model_id", ELEVEN_MODEL), ("language_code", "en"), ("diarize", "true"),
            ("timestamps_granularity", "word"), ("tag_audio_events", "true")]
    if num_speakers:
        data.append(("num_speakers", str(int(num_speakers))))
    for t in (keyterms or [])[:1000]:
        t = t.strip()
        if t and len(t) < 50 and len(t.split()) <= 5:
            data.append(("keyterms", t))
    log(f"שולח ל־ElevenLabs ({audio_path.stat().st_size / 1e6:.1f}MB, {len(keyterms or [])} מונחים)…")
    t0 = time.time()
    with open(audio_path, "rb") as f:
        r = rq.post(ELEVEN_URL, headers={"xi-api-key": key}, data=data,
                    files={"file": (audio_path.name, f, "audio/ogg")}, timeout=3600)
    if r.status_code != 200:
        die(f"ElevenLabs החזיר {r.status_code}: {r.text[:300]}")
    log(f"התקבל תמלול ({time.time() - t0:.0f} שנ׳)")
    return normalize_elevenlabs(r.json())


def normalize_elevenlabs(d: dict) -> dict:
    words, events = [], []
    for w in d.get("words", []):
        typ = w.get("type", "word")
        if typ == "spacing":
            continue
        txt = (w.get("text") or "").strip()
        if not txt:
            continue
        item = {"w": txt, "s": float(w.get("start", 0)), "e": float(w.get("end", 0)),
                "spk": w.get("speaker_id"), "conf": None}
        lp = w.get("logprob")
        if lp is not None:
            import math
            item["conf"] = round(math.exp(min(0.0, float(lp))), 3)
        if typ == "audio_event":
            events.append(item)
        else:
            words.append(item)
    mapping = renumber_speakers(words)
    return {"engine": "elevenlabs", "model": ELEVEN_MODEL, "language": d.get("language_code", "en"),
            "words": sanity_fix_times(words), "events": events, "speaker_map": mapping}


# ---------------------------------------------------------------------------
# AssemblyAI Universal-3.5 Pro
# ---------------------------------------------------------------------------

AAI_BASE = "https://api.assemblyai.com"
AAI_MODELS = ["universal-3-5-pro", "universal-2"]


def assemblyai(audio_path: Path, keyterms: list[str] | None = None, num_speakers: int | None = None,
               context: str | None = None) -> dict:
    key = os.environ.get("ASSEMBLYAI_API_KEY")
    if not key:
        die("לא מוגדר ASSEMBLYAI_API_KEY בסביבה")
    rq = _requests()
    h = {"authorization": key}
    log(f"מעלה ל־AssemblyAI ({audio_path.stat().st_size / 1e6:.1f}MB)…")
    with open(audio_path, "rb") as f:
        up = rq.post(f"{AAI_BASE}/v2/upload", headers=h, data=f, timeout=1800)
    if up.status_code != 200:
        die(f"העלאה נכשלה {up.status_code}: {up.text[:300]}")
    body = {"audio_url": up.json()["upload_url"], "speech_models": AAI_MODELS, "language_code": "en",
            "speaker_labels": True, "punctuate": True, "format_text": True, "disfluencies": True}
    if num_speakers:
        body["speakers_expected"] = int(num_speakers)
    terms = [t.strip() for t in (keyterms or []) if t.strip() and len(t.split()) <= 6][:1000]
    if terms:
        body["keyterms_prompt"] = terms
    if context:
        body["prompt"] = context[:6000]
    sub = rq.post(f"{AAI_BASE}/v2/transcript", headers=h, json=body, timeout=120)
    if sub.status_code != 200:
        die(f"שליחה נכשלה {sub.status_code}: {sub.text[:300]}")
    tid = sub.json()["id"]
    t0 = time.time()
    while True:
        time.sleep(5)
        g = rq.get(f"{AAI_BASE}/v2/transcript/{tid}", headers=h, timeout=120).json()
        st = g.get("status")
        if st == "completed":
            break
        if st == "error":
            die(f"AssemblyAI: {g.get('error')}")
        if int(time.time() - t0) % 60 < 5:
            log(f"  ממתין ל־AssemblyAI… ({time.time() - t0:.0f} שנ׳)")
    return normalize_assemblyai(g)


def normalize_assemblyai(d: dict) -> dict:
    words = [{"w": w["text"], "s": w["start"] / 1000.0, "e": w["end"] / 1000.0,
              "spk": w.get("speaker"), "conf": w.get("confidence")} for w in d.get("words", [])]
    mapping = renumber_speakers(words)
    return {"engine": "assemblyai", "model": d.get("speech_model_used") or d.get("speech_model"),
            "language": d.get("language_code", "en"), "words": sanity_fix_times(words),
            "events": [], "speaker_map": mapping}
