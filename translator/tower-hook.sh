#!/bin/sh
# מגדל הפיקוח (v362) — ה־Hook שרץ לפני כל פעולה של Claude (גם בסוכני־משנה). מוגדר רק בסביבה "סטודיו" — setup.sh כותב אותו ל־~/.claude/settings.json.
# בסשן בלי עבודת תרגום פעילה (כל סשן פיתוח) — יוצא מיד, בלי Python. כל תקלה = הפעולה מותרת.
S="${SNB_STATE:-$HOME/.snb-studio}"
[ -f "$S/job.json" ] || exit 0
[ "${SNB_TOWER:-on}" = off ] && exit 0
exec python3 "$(dirname "$0")/tower.py" hook
