#!/bin/bash
# התקנות לעובד בענן של סטודיו התרגום. רץ בשני מקומות:
#  1. סקריפט ההתקנה של הסביבה ב־claude.ai/code (מאשף החיבור באפליקציה):
#       curl -fsSL https://raw.githubusercontent.com/yishaiguedj1/portfolio-pwa/main/translator/setup.sh | bash || true
#     התוצאה נשמרת כתמונת מצב לכשבוע, ולכן ההתקנות לא חוזרות בכל עבודה.
#  2. בתחילת כל עבודה (שלב 3) — כדי שמה שנוסף לקובץ הזה אחרי שתמונת המצב נשמרה יותקן בכל זאת.
# חייב לסיים ב־0 ומהר כשהכל כבר מותקן.
# v358 (שלב 3): גם מנועי vt — סביבת Python ב־~/.vt-venv (תמלול Parakeet, יישור Qwen + MMS, PyTorch CPU)
# ו־ffmpeg עדכני (SVT-AV1, libass) ב־~/.vt-bin. המודלים עצמם יורדים בעבודה הראשונה (~1.5 דק׳).
# בסביבת תמונת מצב: עד ~5 דקות, אחרת היא לא נשמרת — לכן ההורדות במקביל.
set -u
command -v python3 >/dev/null 2>&1 || { apt-get update -qq && apt-get install -y -qq python3 >/dev/null 2>&1 || true; }
VENV="${VT_VENV:-$HOME/.vt-venv}"
VBIN="${VT_BIN:-$HOME/.vt-bin}"
# v359: הרשימה היחידה של המודולים שהמנועים צריכים — job.py קורא את השורה הזו (env_missing) ובודק בדיוק אותם
SNB_MODULES="numpy soundfile onnx_asr torch torchaudio qwen_asr"
# v359: פלט pip נשמר כאן (לא נבלע) — כשמשהו לא הותקן, רואים למה
LOG="${SNB_SETUP_LOG:-$HOME/.snb-studio/setup.log}"
mkdir -p "$(dirname "$LOG")" 2>/dev/null || LOG=/dev/null
missing() {   # המודולים שחסרים (או שבורים) בסביבה — שורה לכל אחד
  [ -x "$VENV/bin/python" ] || { echo $SNB_MODULES | tr ' ' '\n'; return; }
  "$VENV/bin/python" - $SNB_MODULES <<'PY' 2>/dev/null || echo $SNB_MODULES | tr ' ' '\n'
import importlib, sys
for m in sys.argv[1:]:
    try:
        importlib.import_module(m)
    except Exception:
        print(m)
PY
}
if [ -n "${SNB_SETUP_LITE:-}" ]; then :     # בדיקות: רק ההגדרות, בלי ההתקנות הכבדות
elif [ -n "$(missing)" ]; then
  echo "== $(date -u +%FT%TZ) התקנת מנועי vt — חסרים: $(missing | tr '\n' ' ')" >>"$LOG"
  python3 -m venv "$VENV" >>"$LOG" 2>&1 || { apt-get install -y -qq python3-venv >>"$LOG" 2>&1 && python3 -m venv "$VENV" >>"$LOG" 2>&1; } || true
  if [ ! -x "$VBIN/ffmpeg" ]; then
    ( mkdir -p "$VBIN" /tmp/ffb && curl -fsSL -o /tmp/ffb/ff.tar.xz https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz \
      && tar -C /tmp/ffb -xf /tmp/ffb/ff.tar.xz && cp /tmp/ffb/ffmpeg-master-latest-linux64-gpl/bin/ffmpeg /tmp/ffb/ffmpeg-master-latest-linux64-gpl/bin/ffprobe "$VBIN/" ; rm -rf /tmp/ffb ) >>"$LOG" 2>&1 &
  fi
  "$VENV/bin/pip" install -q -U pip wheel >>"$LOG" 2>&1 || true
  "$VENV/bin/pip" install -q numpy soundfile pillow requests fonttools "onnx-asr[cpu,hub]" >>"$LOG" 2>&1 || true
  # v359: torch ו־torchaudio מאינדקס ה־CPU *לפני* qwen-asr — אחרת qwen-asr מושך את torch של CUDA מ־PyPI (גיגה־בייטים).
  # בהרצה האמיתית זה נכשל כי הרשת חסמה את download.pytorch.org — לכן *.pytorch.org ברשימת הדומיינים של האשף
  if "$VENV/bin/pip" install -q torch torchaudio --index-url https://download.pytorch.org/whl/cpu >>"$LOG" 2>&1; then
    "$VENV/bin/pip" install -q qwen-asr --extra-index-url https://download.pytorch.org/whl/cpu >>"$LOG" 2>&1 || true
  else
    echo "!! torch/torchaudio מאינדקס ה־CPU נכשל — qwen-asr לא מותקן (כדי לא למשוך את torch של CUDA)" >>"$LOG"
  fi
  wait
fi
if [ -n "${SNB_SETUP_LITE:-}" ]; then :
elif [ -z "$(missing)" ]; then echo "סטודיו התרגום: מנועי vt מוכנים"
else echo "סטודיו התרגום: התקנת מנועי vt לא הושלמה — חסרים: $(missing | tr '\n' ' ')(הפרטים ב־$LOG; העבודה תנסה שוב)"; fi
# v357: הגדרות לסשנים של הסביבה הזו בלבד (סשן הפיתוח רץ בסביבה אחרת ולא מושפע). נכתב לפני ש־Claude עולה ונשמר בתמונת המצב:
#  - בלי ה־CLAUDE.md של הפרויקט: כ־100 אלף טוקנים בכל הפעלה, והעובד צריך רק את translator/RUNBOOK.md
#  - בלי דחיפה ב־git ובלי כלי ניהול הסשנים: הכלל בריפו שמתיר דחיפה ל־main נועד לסשן הפיתוח, והעובד קורא תוכן לא מהימן
#    (תמלילים). deny גובר על allow בכל שכבות ההגדרות.
#  - v359: בלי התראות ובלי תזמונים (PushNotification, CronCreate, ScheduleWakeup; send_later כבר חסום עם claude-code-remote) —
#    האפליקציה מציגה את ההתקדמות, והעובד שלח התראות למרות ההנחיה
#  - v362: מגדל הפיקוח — Hook לפני כל פעולה (גם בסוכני־משנה) שעוצר עבודה שצורכת טוקנים בצורה לא סבירה (translator/tower.py).
#    רק בסביבה הזו; בלי עבודה פעילה הוא יוצא מיד, וכל תקלה בו = הפעולה מותרת
#  - רק בבניית תמונת המצב: כשהעבודה עצמה מריצה את הסקריפט (job.py, SNB_SETUP_NO_SETTINGS=1) — לא נוגעים בהגדרות של הסשן שכבר רץ
if [ -z "${SNB_SETUP_NO_SETTINGS:-}" ]; then
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
for r in ['Bash(git push *)', 'Bash(git push)', 'mcp__claude-code-remote', 'PushNotification', 'CronCreate', 'ScheduleWakeup']:
    if r not in deny:
        deny.append(r)
TOWER = 'f="$CLAUDE_PROJECT_DIR/translator/tower-hook.sh"; [ -f "$f" ] && exec sh "$f"; exit 0'
pre = s.setdefault('hooks', {}).setdefault('PreToolUse', [])
if not any(h.get('command') == TOWER for e in pre for h in e.get('hooks', [])):
    pre.append({'matcher': '*', 'hooks': [{'type': 'command', 'command': TOWER, 'timeout': 20}]})
json.dump(s, open(p, 'w'), ensure_ascii=False, indent=2)
PY
fi
echo "סטודיו התרגום: הסביבה מוכנה"
exit 0
