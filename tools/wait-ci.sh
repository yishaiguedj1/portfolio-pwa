#!/usr/bin/env bash
# המתנה ל־CI / לפריסה ברקע — מעירה את הסשן פעם אחת, בסוף (פרויקט החיסכון, 27/10/2026).
# כל השכמה של סשן = קריאה מחדש של כל ההקשר שלו (מאות אלפי טוקנים). לולאת sleep ברקע לא עולה טוקנים בכלל.
# להריץ תמיד עם run_in_background: true:
#   bash tools/wait-ci.sh <sha|ענף>     — עד שכל הבדיקות על הקומיט הסתיימו; מדפיס רק מה שנכשל
#   bash tools/wait-ci.sh --deploy      — עד שריצת deploy האחרונה על main מחכה לאישור / הסתיימה; מדפיס קישור
REPO="yishaiguedj1/portfolio-pwa"; API="https://api.github.com/repos/$REPO"
EVERY="${SNB_WAIT_EVERY:-60}"; MAX="${SNB_WAIT_MAX:-3600}"; t=0
j() { curl -fsS -H 'Accept: application/vnd.github+json' "$API/$1"; }
if [ "$1" = "--deploy" ]; then
  while [ $t -lt $MAX ]; do
    out=$(j "actions/workflows/deploy.yml/runs?branch=main&per_page=1" | python3 -c '
import json,sys
r=(json.load(sys.stdin).get("workflow_runs") or [None])[0]
if not r: print("none"); sys.exit()
print(r["status"], r["conclusion"] or "-", r["head_sha"][:7], r["html_url"])') || out="err"
    set -- $out
    case "$1" in waiting|completed) echo "deploy: $*"; exit 0;; esac
    sleep "$EVERY"; t=$((t+EVERY))
  done; echo "deploy: עדיין רץ אחרי $MAX שנ׳ — $out"; exit 1
fi
REF="${1:?צריך sha או ענף}"
while [ $t -lt $MAX ]; do
  out=$(j "commits/$REF/check-runs?per_page=100" | python3 -c '
import json,sys
d=json.load(sys.stdin)["check_runs"]
if not d: print("PENDING 0"); sys.exit()
run=[c for c in d if c["status"]!="completed"]
if run: print("PENDING", len(run)); sys.exit()
bad=[c for c in d if c["conclusion"] not in ("success","skipped","neutral")]
print("DONE", len(d)-len(bad), len(bad))
for c in bad: print("  נכשל:", c["name"], "→", c["html_url"])') || out="PENDING err"
  case "$out" in DONE*) echo "$out"; set -- $(echo "$out" | head -1); [ "$3" = 0 ]; exit $?;; esac
  sleep "$EVERY"; t=$((t+EVERY))
done
echo "CI: עדיין רץ אחרי $MAX שנ׳ ($out)"; exit 2
