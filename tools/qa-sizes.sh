#!/usr/bin/env bash
# סריקת כל גדלי המסך ויחסי התצוגה (11/11/2026, תצוגת מחשב — docs/desktop-plan.md, סעיף "כל גודל מסך"):
# מריץ את tools/qa-desktop.js (--quick) בכל גודל — מטלפון צר במיוחד (280) ועד מסך רחב במיוחד (5120×1440) ומסך מחשב לאורך —
# ומסכם: גלילה אופקית, רכיבים שבורחים מהמסך, טקסט חתוך, ושגיאות בדף.
# הרצה: bash tools/qa-sizes.sh <תיקיית פלט> [מקביליות=4] [--only inv|ac|st|cf|adm] — דורש שרת מקומי על 8792.
set -u
OUT="${1:?תיקיית פלט}"; PAR="${2:-4}"; shift; shift || true
EXTRA=("$@")
mkdir -p "$OUT"
# רוחב גובה מצב (m = טלפון/טאבלט עם מגע, t = מחשב עם מסך מגע, - = עכבר)
SIZES="280 653 m
320 568 m
360 640 m
375 667 m
360 800 m
390 844 m
412 915 m
430 932 m
568 320 m
667 375 m
844 390 m
932 430 m
600 960 m
673 841 m
768 1024 m
820 1180 m
1024 768 m
1180 820 m
1366 1024 m
900 700 -
960 1080 -
1024 600 -
1280 720 -
1280 1024 -
1366 768 -
1536 864 -
1440 900 t
1920 1080 -
1080 1920 -
2560 1440 -
3440 1440 -
3840 2160 -
5120 1440 -"
DIR="$(cd "$(dirname "$0")" && pwd)"
run() {
  local w=$1 h=$2 m=$3 f=""
  [ "$m" = m ] && f="--mobile"; [ "$m" = t ] && f="--touch"
  node "$DIR/qa-desktop.js" --out "$OUT" --width "$w" --height "$h" $f --quick --htag "${EXTRA[@]+"${EXTRA[@]}"}" > "$OUT/log-${w}x${h}.txt" 2>&1
  echo "$w×$h$([ "$m" != - ] && echo " ($m)"): $(tail -1 "$OUT/log-${w}x${h}.txt")"
}
while read -r w h m; do
  while [ "$(jobs -rp | wc -l)" -ge "$PAR" ]; do wait -n; done
  run "$w" "$h" "$m" &
done <<< "$SIZES"
wait
