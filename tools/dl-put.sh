#!/usr/bin/env bash
# העלאת קבצים להורדה ציבורית — הדלי snb-dl ב־R2, בכתובת https://dl.thesnowball.app/<תיקייה>/<קובץ>
# (11/11/2026, גל 1 של הריפו הפרטי — docs/private-repo-plan.md: Releases של ריפו פרטי לא נגישים בלי התחברות).
# שימוש:  bash tools/dl-put.sh <תיקייה> <קובץ>...      למשל: bash tools/dl-put.sh android-latest *.apk latest.json
# סודות (GitHub Secrets): DL_R2_ACCESS_KEY_ID, DL_R2_SECRET_ACCESS_KEY (טוקן R2 "Object Read & Write" לדלי snb-dl בלבד);
# משתנה: CLOUDFLARE_ACCOUNT_ID (קיים). רשות: DL_BUCKET (ברירת מחדל snb-dl), DL_R2_JURISDICTION (eu).
# בתקופת המעבר Releases עדיין המקור הראשי של הגיבוי — לכן בלי מפתחות / בכשל: אזהרה ויציאה 0.
# DL_REQUIRED=1 (אחרי ההיפוך לפרטי) — כשל = יציאה 1.
set -u
dir="${1:-}"; shift || true
[ -n "$dir" ] && [ "$#" -gt 0 ] || { echo "שימוש: dl-put.sh <תיקייה> <קובץ>..." >&2; exit 2; }
case "$dir" in *[!a-z0-9-]*) echo "::error::שם תיקייה לא תקין: $dir"; exit 2;; esac
soft() { if [ "${DL_REQUIRED:-}" = 1 ]; then echo "::error::$1"; exit 1; fi; echo "::warning::$1 — ממשיכים (Releases עדיין גיבוי)"; exit 0; }
[ -n "${DL_R2_ACCESS_KEY_ID:-}" ] && [ -n "${DL_R2_SECRET_ACCESS_KEY:-}" ] && [ -n "${CLOUDFLARE_ACCOUNT_ID:-}" ] || soft "אין מפתחות DL_R2_* — לא הועלה ל־dl.thesnowball.app"
command -v aws > /dev/null || soft "אין aws cli"
bucket="${DL_BUCKET:-snb-dl}"
host="$CLOUDFLARE_ACCOUNT_ID${DL_R2_JURISDICTION:+.$DL_R2_JURISDICTION}.r2.cloudflarestorage.com"
export AWS_ACCESS_KEY_ID="$DL_R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$DL_R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
# R2 לא תומך בטביעות הברירה החדשות של aws cli (‏2.23+)
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
for f in "$@"; do
  [ -f "$f" ] || soft "אין קובץ: $f"
  n=$(basename "$f")
  case "$n" in
    *.apk) ct=application/vnd.android.package-archive; cc='public, max-age=300';;
    *.json) ct=application/json; cc='no-cache';;
    *.zip) ct=application/zip; cc='public, max-age=300';;
    *.md) ct='text/markdown; charset=utf-8'; cc='no-cache';;
    *.sh) ct='text/x-shellscript; charset=utf-8'; cc='no-cache';;
    *) ct=application/octet-stream; cc='public, max-age=3600';;
  esac
  aws s3 cp "$f" "s3://$bucket/$dir/$n" --endpoint-url "https://$host" --content-type "$ct" --cache-control "$cc" --only-show-errors \
    || soft "ההעלאה של $n ל־R2 נכשלה"
  echo "dl: $dir/$n ($(stat -c %s "$f") בתים)"
done
# אימות חי: הקובץ האחרון נגיש בכתובת הציבורית (בלי מטמון)
code=$(curl -s -o /dev/null -w '%{http_code}' -I "https://dl.thesnowball.app/$dir/$n?v=$(date +%s)" || true)
[ "$code" = 200 ] || soft "https://dl.thesnowball.app/$dir/$n החזיר $code (הדומיין מחובר לדלי?)"
echo "dl: נגיש — https://dl.thesnowball.app/$dir/"
