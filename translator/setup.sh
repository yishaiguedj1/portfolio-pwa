#!/bin/bash
# התקנות לעובד בענן של סטודיו התרגום. רץ בשני מקומות:
#  1. סקריפט ההתקנה של הסביבה ב־claude.ai/code (מאשף החיבור באפליקציה):
#       curl -fsSL https://raw.githubusercontent.com/yishaiguedj1/portfolio-pwa/main/translator/setup.sh | bash || true
#     התוצאה נשמרת כתמונת מצב לכשבוע, ולכן ההתקנות לא חוזרות בכל עבודה.
#  2. בתחילת כל עבודה (שלב 3) — כדי שמה שנוסף לקובץ הזה אחרי שתמונת המצב נשמרה יותקן בכל זאת.
# חייב לסיים ב־0 ומהר כשהכל כבר מותקן. שלב 2: בדיקת החיבור צריכה רק python3 (מותקן מראש).
set -u
command -v python3 >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq python3 >/dev/null 2>&1 || true; }
# v357: הגדרות לסשנים של הסביבה הזו בלבד (סשן הפיתוח רץ בסביבה אחרת ולא מושפע). נכתב לפני ש־Claude עולה ונשמר בתמונת המצב:
#  - בלי ה־CLAUDE.md של הפרויקט: כ־100 אלף טוקנים בכל הפעלה, והעובד צריך רק את translator/RUNBOOK.md
#  - בלי דחיפה ב־git ובלי כלי ניהול הסשנים: הכלל בריפו שמתיר דחיפה ל־main נועד לסשן הפיתוח, והעובד קורא תוכן לא מהימן
#    (תמלילים). deny גובר על allow בכל שכבות ההגדרות.
python3 - <<'PY' || true
import json, os
p = os.path.expanduser('~/.claude/settings.json')
os.makedirs(os.path.dirname(p), exist_ok=True)
try:
    s = json.load(open(p))
except Exception:
    s = {}
ex = s.setdefault('claudeMdExcludes', [])
for g in ['**/CLAUDE.md', '**/CLAUDE.local.md']:
    if g not in ex:
        ex.append(g)
deny = s.setdefault('permissions', {}).setdefault('deny', [])
for r in ['Bash(git push *)', 'Bash(git push)', 'mcp__claude-code-remote']:
    if r not in deny:
        deny.append(r)
json.dump(s, open(p, 'w'), ensure_ascii=False, indent=2)
PY
echo "סטודיו התרגום: הסביבה מוכנה (שלב 2)"
exit 0
