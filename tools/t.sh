#!/usr/bin/env bash
# הרצת בדיקות בשקט — חוסך טוקנים (פרויקט החיסכון, 27/10/2026).
# מדפיס רק סיכום ושורות FAIL עם זנב קצר של היומן; היומן המלא בקובץ. קוד היציאה = האם הכל עבר.
#   bash tools/t.sh                 — כל בדיקות node כמו ב־CI (אותה רשימת SKIP מ־test.yml) + בדיקות השרתון
#   bash tools/t.sh tests/a.test.js tests/b.test.js   — רק אלה
#   bash tools/t.sh --py            — גם בדיקות הפייתון של translator (python3 -m unittest)
# אסור: `node tests/x.js | tail` — הצינור מחזיר את קוד היציאה של tail (CLAUDE.md סעיף 7).
cd "$(dirname "$0")/.." || exit 2
LOG="${TMPDIR:-/tmp}/snb-tests"; mkdir -p "$LOG"
PY=0; files=()
for a in "$@"; do [ "$a" = "--py" ] && PY=1 || files+=("$a"); done
if [ ${#files[@]} -eq 0 ]; then
  SKIP=$(grep -o 'SKIP="[^"]*"' .github/workflows/test.yml | head -1 | sed 's/SKIP="//;s/"$//')
  for f in tests/*.test.js; do case " $SKIP " in *" $(basename "$f") "*) continue;; esac; files+=("$f"); done
  files+=(ibkr-proxy/tests/run.js)
fi
pass=0; failed=()
for f in "${files[@]}"; do
  n=$(echo "$f" | tr '/' '_'); code=0
  if [ "${f%.js}" != "$f" ] && [ "${f#tests/}" != "$f" ]; then (cd tests && timeout 150 node "$(basename "$f")") > "$LOG/$n.log" 2>&1 || code=$?
  else timeout 300 node "$f" > "$LOG/$n.log" 2>&1 || code=$?; fi
  if [ $code -eq 0 ]; then pass=$((pass+1)); else failed+=("$f"); echo "FAIL $f (exit $code)"; tail -15 "$LOG/$n.log" | cut -c1-220; fi
done
if [ $PY = 1 ]; then
  code=0; (cd translator && python3 -m unittest discover -s tests -q) > "$LOG/py.log" 2>&1 || code=$?
  if [ $code -eq 0 ]; then pass=$((pass+1)); else failed+=(translator-py); echo "FAIL translator (python)"; tail -25 "$LOG/py.log" | cut -c1-220; fi
fi
echo "---- $pass עברו, ${#failed[@]} נכשלו (יומנים: $LOG) ----"
[ ${#failed[@]} -eq 0 ]
