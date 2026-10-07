"""ביקורת עצמאית של התרגום — "עורך שני" שלא כתב את התרגום.

1. חבילת ביקורת (review/package.md): ה־brief, המילון, וכל הכתוביות זו לצד זו
   (אנגלית ↔ עברית). עליה עובד עורך Claude נפרד (סוכן־משנה בהקשר נקי).
2. ביקורת חיצונית אופציונלית עם מודל ה־Pro העדכני של Gemini (אם הוגדר
   GEMINI_API_KEY בסביבה) — מודל ממשפחה אחרת תופס טעויות אחרות.
ההערות לא מוחלות אוטומטית: כל הערה נשקלת ומתקבלת או נדחית לגופה.
"""

from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path

from .util import log, die, fmt_ts, write_text, write_json

GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"

REVIEW_PROMPT = """אתם עורכים בכירים של כתוביות בעברית (מאנגלית), ברמת Netflix.
לפניכם ראיון שלם: תדריך (brief), מילון מונחים, ורשימת כל הכתוביות — לכל כתובית
מספר, זמן, דובר, המקור באנגלית והתרגום לעברית.

המשימה: לאתר בעיות אמיתיות בתרגום, תוך הבנת ההקשר של כל הראיון:
- דיוק: טעות במשמעות, היפוך, השמטה של מידע חשוב, הוספה שלא נאמרה, מספרים/שמות שגויים.
- הקשר: מונח או משפט שתורגמו מילולית אף שבהקשר של הראיון משמעותם אחרת;
  ניבים, הומור ורמזים תרבותיים שלא הועברו.
- עברית: תרגומית ("translationese"), תחביר אנגלי, משלב לא מתאים, שגיאות כתיב/דקדוק.
- מגדר ופנייה: התאמת מין לדובר ולנמען (את/אתה, אתם), עקביות בפנייה.
- עקביות: אותו מונח/שם מתורגם אחרת במקומות שונים.
- כתוביות: טקסט ארוך מדי לזמן התצוגה (מעל 17 תווים לשנייה), שבירה לא טבעית בין כתוביות.

אל תציעו שינויים טעמיים בלבד. אם הכל טוב — החזירו רשימה ריקה.
החזירו JSON בלבד, מערך של אובייקטים:
[{"id": <מספר כתובית>, "severity": "critical|major|minor",
  "type": "accuracy|omission|context|fluency|grammar|gender|consistency|terminology|length",
  "problem": "<תיאור קצר בעברית>", "suggestion": "<הטקסט המתוקן המלא לכתובית>"}]
"""


def package(meta: dict, cues: list[dict], he: dict, brief: str, glossary: str) -> str:
    """חבילה לעורך/ת: תדריך, מילון, וכל כתובית — אנגלית ומתחתיה העברית.

    פורמט קומפקטי (v1.3): דובר וזמן רק בהחלפת דובר, קצב קריאה רק כשהוא חורג (⚠). טבלת Markdown עם
    זמן/שם/קצב בכל שורה כמעט הכפילה את גודל החבילה שהסוכן קורא — טוקנים בלי מידע.
    """
    sp = meta.get("speakers", {})
    out = [f"# חבילת ביקורת — {meta.get('title', meta.get('name'))}", "", "## תדריך", "", brief.strip(), "",
           "## מילון מונחים", "", "```", glossary.strip(), "```", "",
           "## כתוביות (‎#מספר אנגלית / → עברית; = איחוד עם הקודמת, ∅ בלי כתובית, ⚠ = מעל 17 תווים לשנייה)", ""]
    cur = None
    for c in cues:
        if c.get("spk") != cur:
            cur = c.get("spk")
            name = sp.get(cur or "", {}).get("name", cur or "")
            out.append(f"**{name} · {fmt_ts(c['speech_s'])[:8]}**")
        h = he.get(str(c["id"]), "")
        dur = max(c.get("dur", 1.0), 0.5)
        warn = " ⚠" if h not in ("=", "∅", "") and len(h) / dur > 17 else ""
        out.append(f"#{c['id']} {c['en']}")
        out.append(f"→ {h}{warn}")
    return "\n".join(out) + "\n"


def _pick_gemini_model(key: str) -> str:
    import requests
    forced = os.environ.get("VT_GEMINI_MODEL")
    if forced:
        return forced if forced.startswith("models/") else "models/" + forced
    r = requests.get(f"{GEMINI_BASE}/models", headers={"x-goog-api-key": key},
                     params={"pageSize": 200}, timeout=60)
    if r.status_code != 200:
        die(f"Gemini models: {r.status_code} {r.text[:200]}")
    best, best_v = None, -1.0
    for m in r.json().get("models", []):
        name = m.get("name", "")
        if "generateContent" not in m.get("supportedGenerationMethods", []):
            continue
        if "pro" not in name or any(x in name for x in ("tts", "image", "vision", "embed", "live",
                                                         "audio", "computer", "robotics")):
            continue
        mv = re.search(r"gemini-(\d+(?:\.\d+)?)", name)
        v = float(mv.group(1)) if mv else 0.0
        v -= 0.01 if "preview" in name or "exp" in name else 0.0
        if v > best_v:
            best, best_v = name, v
    if not best:
        die("לא נמצא מודל Gemini Pro זמין למפתח הזה")
    return best


def gemini_review(pkg: str, out_dir: Path) -> list[dict]:
    import requests
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        die("לא מוגדר GEMINI_API_KEY בסביבה (אופציונלי — אפשר לדלג על שלב זה)")
    model = _pick_gemini_model(key)
    log(f"ביקורת חיצונית עם {model}…")
    body = {"contents": [{"role": "user", "parts": [{"text": REVIEW_PROMPT + "\n\n" + pkg}]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2,
                                 "maxOutputTokens": 65536}}
    t0 = time.time()
    r = requests.post(f"{GEMINI_BASE}/{model}:generateContent", headers={"x-goog-api-key": key},
                      json=body, timeout=1800)
    if r.status_code != 200:
        die(f"Gemini: {r.status_code} {r.text[:300]}")
    d = r.json()
    parts = d.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
    try:
        items = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\[.*\]", text, re.S)
        items = json.loads(m.group(0)) if m else []
    write_json(out_dir / "gemini.json", {"model": model, "seconds": round(time.time() - t0), "items": items})
    lines = [f"# ביקורת חיצונית ({model.split('/')[-1]}) — {len(items)} הערות", ""]
    order = {"critical": 0, "major": 1, "minor": 2}
    for it in sorted(items, key=lambda x: (order.get(x.get("severity"), 3), x.get("id", 0))):
        lines.append(f"- #{it.get('id')} [{it.get('severity')}/{it.get('type')}] {it.get('problem')}")
        if it.get("suggestion"):
            lines.append(f"  - הצעה: {it['suggestion']}")
    write_text(out_dir / "gemini.md", "\n".join(lines) + "\n")
    log(f"התקבלו {len(items)} הערות ({time.time() - t0:.0f} שנ׳)")
    return items
