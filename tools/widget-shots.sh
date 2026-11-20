#!/usr/bin/env bash
# צילום הווידג'טים של Invest כפי שאנדרואיד מצייר אותם — בלי מכשיר (Robolectric, ציור native). בהיר + כהה, רגיל + צר.
# שימוש: bash tools/widget-shots.sh [תיקיית פלט]   (ברירת מחדל: widget-shots/ בשורש — לא נכנס ל־git)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$(realpath -m "${1:-$ROOT/widget-shots}")"
bash "$ROOT/tools/android-sdk.sh" >/dev/null
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
cd "$ROOT/android"
G=$(command -v gradle || echo /opt/gradle/bin/gradle)
WIDGET_SHOTS="$OUT" "$G" --no-daemon -q --max-workers=2 :app:testInvestDebugUnitTest --tests '*WidgetShotTest*' --rerun-tasks
ls "$OUT"
