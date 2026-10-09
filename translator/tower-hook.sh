#!/bin/sh
# מגדל הפיקוח (v362) — ה־Hook שרץ לפני כל פעולה של Claude (גם בסוכני־משנה). מוגדר רק בסביבה "סטודיו" — setup.sh כותב אותו ל־~/.claude/settings.json.
# בסשן בלי עבודת תרגום פעילה (כל סשן פיתוח) — יוצא מיד, בלי Python. כל תקלה = הפעולה מותרת.
# v370: ביציאה מוקדמת קוראים את הקלט (JSON קטן) — תהליך שיוצא בלי לקרוא אותו גורם ל־EPIPE אצל מי שכותב אליו (נמדד: ~8% תחת עומס)
S="${SNB_STATE:-$HOME/.snb-studio}"
[ -f "$S/job.json" ] || { cat >/dev/null; exit 0; }
[ "${SNB_TOWER:-on}" = off ] && { cat >/dev/null; exit 0; }
exec python3 "$(dirname "$0")/tower.py" hook
