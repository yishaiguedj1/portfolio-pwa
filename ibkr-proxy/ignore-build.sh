#!/bin/sh
# כלל הדילוג של Vercel (ignoreCommand): exit 0 = לדלג על הפריסה, exit 1 = לפרוס.
# פורסים רק כשמשהו בתיקיית השרתון השתנה מאז הפריסה המוצלחת האחרונה (VERCEL_GIT_PREVIOUS_SHA).
# Vercel משכפל רק את הקומיטים האחרונים — הקומיט הישן לא תמיד בשכפול (לקח v285: "bad object" → exit 128
# → "Production deployment failed" במייל בכל דחיפה). לכן: מעמיקים את ההיסטוריה, ואם עדיין אין — שואלים את GitHub.
# בכל ספק — פורסים (אף פעם לא קורסים).
P="$VERCEL_GIT_PREVIOUS_SHA"
C="${VERCEL_GIT_COMMIT_SHA:-HEAD}"
[ -z "$P" ] && exit 1
if ! git cat-file -e "$P^{commit}" 2>/dev/null; then
  git fetch -q --deepen=500 origin 2>/dev/null || true
fi
if git cat-file -e "$P^{commit}" 2>/dev/null; then
  git diff --quiet "$P" "$C" -- . 2>/dev/null && exit 0
  exit 1
fi
# גיבוי: רשימת הקבצים שהשתנו מ־GitHub (ריפו ציבורי, בלי מפתח)
node -e '
const [p, c, o, r] = process.argv.slice(1);
if (!o || !r) process.exit(1);
fetch(`https://api.github.com/repos/${o}/${r}/compare/${p}...${c}`, { headers: { "User-Agent": "ibkr-proxy-ignore" } })
  .then((x) => (x.ok ? x.json() : Promise.reject(x.status)))
  .then((j) => { const f = j.files || []; if (f.length >= 300) process.exit(1); process.exit(f.some((x) => x.filename.startsWith("ibkr-proxy/")) ? 1 : 0); })
  .catch(() => process.exit(1));
' "$P" "$C" "$VERCEL_GIT_REPO_OWNER" "$VERCEL_GIT_REPO_SLUG"
exit $?
