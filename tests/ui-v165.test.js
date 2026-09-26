// ui-v165.test.js — מחירים חיים כל 2 שניות דרך השרתון, שדות טרום/אחרי/overnight מ־Yahoo v7,
// ואנימציית מחיר בסגנון Robinhood (ספרות מתגלגלות, LTR גם ב־RTL).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const ext = new Function('t', 'esc', 'fmtPct', src.slice(src.indexOf('const YAHOO_STATE_SESSION'), src.indexOf('function applyExtQuote(')) + grab('applyExtQuote') + grab('extSessionHTML') + 'return { applyExtQuote, extSessionHTML };')(
  (k) => k, (x) => String(x), (v, s) => (s && v >= 0 ? '+' : '') + v.toFixed(2) + '%');
let q = ext.applyExtQuote({ close: 341, session: 'regular' }, { state: 'POST', reg: { p: 341.07, ch: 5, pct: 1.5, t: 1 }, post: { p: 341, ch: -0.07, pct: -0.02, t: 2 } });
ok(q.session === 'post' && q.ext.kind === 'post' && q.ext.price === 341 && q.regClose === 341.07, 'אחרי־מסחר: session מ־marketState, השינוי מהסגירה הרגילה');
q = ext.applyExtQuote({ close: 370 }, { state: 'OVERNIGHT', reg: { p: 372 }, post: { p: 371, pct: -0.3 }, night: { p: 370.5, ch: -1.5, pct: -0.4, t: 9 } });
ok(q.session === 'night' && q.ext.kind === 'night' && q.ext.pct === -0.4, 'overnight: הסשן הלילי עם המחיר הלילי');
q = ext.applyExtQuote({ close: 370 }, { state: 'OVERNIGHT', reg: { p: 372 }, post: { p: 371, ch: -1, pct: -0.3, t: 3 } });
ok(q.session === 'night' && q.ext.kind === 'post', 'overnight בלי מחיר לילי (מניה שלא נסחרת בלילה) → נופל לאחרי־מסחר');
q = ext.applyExtQuote({ close: 336 }, { state: 'PRE', reg: { p: 335.9 }, pre: { p: 336, ch: 0.1, pct: 0.03, t: 4 } });
ok(q.session === 'pre' && q.ext.kind === 'pre', 'טרום־מסחר');
q = ext.applyExtQuote({ close: 341, session: 'regular' }, { state: 'REGULAR', reg: { p: 341 } });
ok(q.session === 'regular' && !q.ext, 'מסחר רגיל: בלי תג');
q = ext.applyExtQuote({ close: 78.3 }, { state: 'POSTPOST', reg: { p: 78.3, ch: 0, pct: 0, t: 1 } });
ok(q.session === 'post' && !q.ext && ext.extSessionHTML(q) === '', 'ת"א אחרי הסגירה: בלי מחיר מורחב → בלי תג');
ok(/ext-sess neg/.test(ext.extSessionHTML({ ext: { kind: 'post', price: 341, pct: -0.02 } })) && /sessPostShort/.test(ext.extSessionHTML({ ext: { kind: 'post', price: 341, pct: -0.02 } })), 'תג: "אחרי־מסחר" באדום כשיורד');
ok(/const LIVE_FAST_MS = 2000;/.test(src) && /const LIVE_ALL_EVERY = 2;/.test(src) && /const LIVE_IDLE_AFTER = 15;/.test(src), 'לולאה: טיק כל 2 שניות, כל התיק כל 4, האטה אחרי ~דקה בלי תזוזה');
ok(/applyExtQuote\(q, j\.data\[sym\]\.x\)/.test(src), 'השדות המורחבים נקלטים מהשרתון');
ok(/function livePriceSwap\(a, b\)/.test(src) && /px-roll ' \+ dir/.test(src) && /prefers-reduced-motion: reduce/.test(grab('livePriceSwap')), 'החלפת מחיר מגולגלת, מכבדת "הפחת תנועה"');
ok(/if \(pa && pb\) livePriceSwap\(pa, pb\);/.test(src), 'renderLive משתמש בה (לא innerHTML גס)');
ok(/\.stock-price \{[^}]*direction: ltr;[^}]*unicode-bidi: isolate/.test(css), 'המחיר תמיד LTR — ב־RTL ספרות מגולגלות התערבבו ("51.9$33")');
ok(/@keyframes pxRollInUp/.test(css) && /@keyframes pxDown/.test(css) && /\.ext-sess \{/.test(css), 'CSS: גלגול, הבזק, תג סשן');
ok(/<span class="sh-r2">[\s\S]*?<span class="stock-ext">' \+ extSessionHTML\(m\.q, m\)/.test(src), 'v204/v206: תג הסשן בשורה השנייה של הכרטיס (ליד שם החברה), מתעדכן בטיק');
for (const k of ['sessionNight', 'sessPreShort', 'sessPostShort', 'sessNightShort', 'sessExtTitle']) ok((src.match(new RegExp('\\n  ' + k + ': ', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
console.log('\n' + n + ' בדיקות עברו');
