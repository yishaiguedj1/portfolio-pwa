#!/bin/bash
# התקנות לעובד בענן של סטודיו התרגום. רץ בשני מקומות:
#  1. סקריפט ההתקנה של הסביבה ב־claude.ai/code (מאשף החיבור באפליקציה):
#       curl -fsSL https://raw.githubusercontent.com/yishaiguedj1/portfolio-pwa/main/translator/setup.sh | bash || true
#     התוצאה נשמרת כתמונת מצב לכשבוע, ולכן ההתקנות לא חוזרות בכל עבודה.
#  2. בתחילת כל עבודה (שלב 3) — כדי שמה שנוסף לקובץ הזה אחרי שתמונת המצב נשמרה יותקן בכל זאת.
# חייב לסיים ב־0 ומהר כשהכל כבר מותקן. שלב 2: בדיקת החיבור צריכה רק python3 (מותקן מראש).
set -u
command -v python3 >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq python3 >/dev/null 2>&1 || true; }
echo "סטודיו התרגום: הסביבה מוכנה (שלב 2)"
exit 0
