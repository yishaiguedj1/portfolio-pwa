// 22/10/2026: הניטור ב־Cloudflare Worker — אותה כתובת ואותו קצב של studio-watch.yml (שנשאר כגיבוי)
const fs = require('fs'), path = require('path'), assert = require('assert');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
const w = R('infra/cloudflare/watch/worker.js'), t = R('infra/cloudflare/watch/wrangler.toml'), y = R('.github/workflows/studio-watch.yml');
const url = (w.match(/URL_WATCH = '([^']+)'/) || [])[1];
assert.ok(url && y.includes(url), 'אותה כתובת בשניהם');
assert.ok(/crons = \["\*\/10 \* \* \* \*"\]/.test(t), 'כל 10 דקות');
assert.ok(/async scheduled\(/.test(w) && /waitUntil/.test(w), 'cron עם waitUntil');
assert.ok(!/console\.log\([^)]*SECRET/.test(w), 'הסוד לא נכתב ליומן');
console.log('cf-watch: 4 ✓');
