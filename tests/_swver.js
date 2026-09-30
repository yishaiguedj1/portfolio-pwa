// עזר משותף: האם CACHE_NAME ב־sw.js תואם ל־APP_VERSION.
// פרוטוקול הפריסה (CLAUDE.md סעיף 8) דוחף קודם את התוכן עם APP_VERSION חדש, ואת sw.js רק כעבור דקה —
// כך שבקומיט התוכן CACHE_NAME בכוונה גרסה אחת אחורה. זה מצב תקין, לא כשל (עד v288 הוא הכשיל ~28 בדיקות
// בכל פריסה ושלח מייל "Run failed" על כל גרסה). כל מצב אחר — sw.js לפני התוכן, או פער של יותר מגרסה — עדיין כשל.
const fs = require('fs');
const path = require('path');
function swVersionOk(appVer) {
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const m = sw.match(/const CACHE_NAME = 'portfolio-pwa-v(\d+)'/);
  const a = parseInt(String(appVer).replace(/^v/, ''), 10);
  if (!m || !(a > 0)) return false;
  const c = parseInt(m[1], 10);
  return c === a || c === a - 1;
}
module.exports = { swVersionOk };
