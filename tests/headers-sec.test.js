// 14/10/2026: כותרות האבטחה של Cloudflare Pages (_headers) ו־security.txt
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const h = read('_headers');
const block = (h.split(/^\/\*$/m)[1] || '').split(/\n(?=\S)/)[0];
ok(/^  Cache-Control: no-cache$/m.test(block), 'בדיקה מול השרת בכל טעינה — נשאר');
ok(/^  X-Content-Type-Options: nosniff$/m.test(block) && /^  Referrer-Policy: strict-origin-when-cross-origin$/m.test(block), 'nosniff ו־Referrer-Policy');
ok(/^  Content-Security-Policy: frame-ancestors 'self'$/m.test(block), "frame-ancestors 'self' — לא 'none': הקורא מציג מסמכים במסגרות באותו מקור");
ok(/^  Strict-Transport-Security: max-age=\d{8,}; includeSubDomains$/m.test(block), 'HSTS');
const pp = (block.match(/^  Permissions-Policy: (.+)$/m) || [])[1] || '';
ok(pp && !/screen-wake-lock/.test(pp) && !/fullscreen/.test(pp) && /camera=\(\)/.test(pp), 'Permissions-Policy — בלי לחסום Wake Lock ומסך מלא (הסטודיו, המשיכה מ־IBKR, הנגן)');
ok(!/Cross-Origin-Opener-Policy/.test(h), 'בלי COOP — move.html וחלון ההרשאה של Google מדברים עם החלון שפתח אותם');
const st = read('.well-known/security.txt');
const exp = Date.parse((st.match(/^Expires: (.+)$/m) || [])[1]);
ok(/^Contact: https:\/\//m.test(st) && exp > Date.now() && exp - Date.now() < 400 * 864e5, 'security.txt — איש קשר בלי מייל, תוקף עד שנה (לחדש לפני ' + new Date(exp).toISOString().slice(0, 10) + ')');
console.log('# ' + n + ' בדיקות עברו');
