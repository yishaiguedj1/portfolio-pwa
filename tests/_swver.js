// עזר משותף: האם CACHE_NAME ב־sw.js תואם ל־APP_VERSION.
// מ־v394 (פס פריסה אחד) tools/swgen.js כותב את CACHE_NAME מ־APP_VERSION, ולכן הם תמיד שווים —
// ו־tests/swgen.test.js הוא השומר האמיתי. הסובלנות לגרסה אחת אחורה נשארה מהפרוטוקול הדו־שלבי (עד v393)
// ולא מזיקה. sw.js לפני התוכן, או פער של יותר מגרסה — כשל.
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
