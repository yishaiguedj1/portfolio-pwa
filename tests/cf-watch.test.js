// 22/10/2026: הניטור ב־Cloudflare Worker — קצב של studio-watch.yml (שנשאר כגיבוי). 24/10/2026: סנכרון IBKR יומי.
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const w = R('infra/cloudflare/watch/worker.js'), t = R('infra/cloudflare/watch/wrangler.toml'), y = R('.github/workflows/studio-watch.yml');
// הראשי = השרתון, הגיבוי = Vercel. ה־GitHub (studio-watch.yml) נשאר על הגיבוי העצמאי.
const primary = (w.match(/URL_PRIMARY = '([^']+)'/) || [])[1];
const backup = (w.match(/URL_BACKUP = '([^']+)'/) || [])[1];
assert.ok(primary && primary.startsWith('https://api.thesnowball.app/'), 'הראשי = השרתון');
assert.ok(backup && y.includes(backup), 'הגיבוי = אותה כתובת של studio-watch.yml (Vercel)');
assert.ok(!/URL_WATCH/.test(w), 'אין שארית של הכתובת הישנה');
assert.ok(/status >= 500/.test(w) && /from = 'backup'/.test(w), 'נפילה לגיבוי גם על 5xx');
assert.ok(/crons = \["\*\/10 \* \* \* \*", "5 12 \* \* \*"\]/.test(t), 'כל 10 דקות + סנכרון IBKR יומי ב־12:05 UTC');
assert.ok(/IBKR_CRON = '5 12 \* \* \*'/.test(w) && /event\.cron === IBKR_CRON/.test(w), 'הקרון היומי מנותב לסנכרון, השאר לניטור');
assert.ok(/api\.thesnowball\.app\/api\/ibkr-sync/.test(w) && /ibkr-proxy-wine\.vercel\.app\/api\/ibkr-sync/.test(w), 'סנכרון: ראשי + גיבוי');
assert.ok(/async scheduled\(/.test(w) && /waitUntil/.test(w), 'cron עם waitUntil');
assert.ok(!/console\.log\([^)]*SECRET/.test(w), 'הסוד לא נכתב ליומן');
console.log('cf-watch: 9 ✓');
