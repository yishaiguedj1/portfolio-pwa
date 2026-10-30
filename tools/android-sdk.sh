#!/usr/bin/env bash
# מתקין את כלי הבנייה של אנדרואיד לסשן הנוכחי — רק כשנוגעים ב־android/ (כ־300MB, לא בכל סשן).
# שימוש:  bash tools/android-sdk.sh            — התקנה בלבד (אידמפוטנטי)
#         bash tools/android-sdk.sh build      — התקנה + בדיקת קומפילציה (Kotlin, manifest, משאבים) של invest
# Maven Central מחזיר לפעמים 429 — הבנייה מנסה שוב עד 6 פעמים; מה שירד נשמר במטמון של gradle.
set -u
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
SDKM="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
if [ ! -d "$ANDROID_HOME/platforms/android-36" ] || [ ! -d "$ANDROID_HOME/build-tools/36.0.0" ]; then
  if [ ! -x "$SDKM" ]; then
    mkdir -p "$ANDROID_HOME/cmdline-tools" && tmp=$(mktemp -d) &&
    curl -sSfo "$tmp/clt.zip" https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip &&
    unzip -qo "$tmp/clt.zip" -d "$tmp" && rm -rf "$ANDROID_HOME/cmdline-tools/latest" &&
    mv "$tmp/cmdline-tools" "$ANDROID_HOME/cmdline-tools/latest" && rm -rf "$tmp" || { echo "הורדת cmdline-tools נכשלה"; exit 1; }
  fi
  yes | "$SDKM" --licenses >/dev/null 2>&1
  "$SDKM" "platforms;android-36" "build-tools;36.0.0" >/dev/null || { echo "sdkmanager נכשל"; exit 1; }
fi
command -v gradle >/dev/null || [ -x /opt/gradle/bin/gradle ] || { echo "gradle לא נמצא (צפוי ב־/opt/gradle)"; exit 1; }
echo "SDK מוכן: $ANDROID_HOME"
[ "${1:-}" = build ] || exit 0
G=$(command -v gradle || echo /opt/gradle/bin/gradle)
LOG=$(mktemp)
cd "$(dirname "$0")/../android" || exit 1
for i in 1 2 3 4 5 6; do
  timeout 900 "$G" --no-daemon -q --max-workers=1 :app:compileInvestReleaseKotlin :app:processInvestReleaseManifest :app:mergeInvestReleaseResources >"$LOG" 2>&1 && { echo "בנייה עברה (ניסיון $i)"; exit 0; }
  grep -q 429 "$LOG" || break
  echo "429 מ־Maven — ניסיון $i, ממתין דקה"; sleep 60
done
grep -A4 "What went wrong" "$LOG" | head -8; grep "^e: " "$LOG" | head
exit 1
