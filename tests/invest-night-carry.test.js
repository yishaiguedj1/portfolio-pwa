// invest-night-carry.test.js — סבב קפיצות 8 (02/11/2026, הקלטה של Invest בלילה): המחיר קפץ 233.31 ⇄ 228.50 בתוך חצי שנייה.
// השרתון מחזיר את המחיר הלילי (x) רק כש־v7 ענה; תשובה בלי x לא דורסת סשן לילי טרי (extCarry). mocks בלבד — בלי רשת.
const fs = require('fs'), path = require('path'), vm = require('vm');
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
let n = 0;
const ok = (c, name) => { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); };
const pick = (name) => { const i = src.indexOf('function ' + name + '('); let d = 0, j = src.indexOf('{', i); for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && !--d) break; } return src.slice(i, j + 1); };
const sb = { Date };
vm.createContext(sb);
vm.runInContext("const YAHOO_STATE_SESSION = { OVERNIGHT: 'night', REGULAR: 'regular', POST: 'post', PRE: 'pre', CLOSED: 'closed', PREPRE: 'closed', POSTPOST: 'closed' };\n" +
  src.match(/const EXT_KEEP_MS = [^\n]+/)[0] + '\n' + pick('extCarry') + '\n' + pick('applyExtQuote') + '\nthis.extCarry = extCarry; this.applyExtQuote = applyExtQuote; this.EXT_KEEP_MS = EXT_KEEP_MS;', sb);
const { extCarry, applyExtQuote } = sb;
// תשובה מלאה בלילה: המחיר הראשי = הלילי
const full = applyExtQuote({ symbol: 'APP', close: 228.5, session: 'closed' }, { state: 'OVERNIGHT', reg: { p: 230, ch: 1, pct: 0.4 }, night: { p: 233.31, ch: 3.31, pct: 1.44, t: 1 } });
ok(full.close === 233.31 && full.session === 'night' && full.xAt > 0, 'תשובה מלאה בלילה — המחיר הלילי');
// הטיק הבא: v7 נפל — רק הנר של אחרי־המסחר
const bare = extCarry({ symbol: 'APP', close: 228.5, session: 'closed', ext: { kind: 'post', price: 228.5 } }, full);
ok(bare.close === 233.31, 'תשובה בלי x לא דורסת את המחיר הלילי (היה 228.50)');
ok(bare.session === 'night' && bare.ext.kind === 'night' && bare.regClose === 230, 'הסשן, התג והסגירה הרגילה נשמרים');
// ישן מדי — לא מחזיקים
const stale = Object.assign({}, full, { xAt: Date.now() - sb.EXT_KEEP_MS - 1000 });
ok(extCarry({ close: 228.5, session: 'closed' }, stale).close === 228.5, 'סשן לילי ישן (מעל EXT_KEEP_MS) — לא נשמר');
// pre/post: הנר חי — לא נוגעים
const post = applyExtQuote({ close: 240, session: 'post' }, { state: 'POST', post: { p: 240, ch: 1, pct: 0.4 } });
ok(extCarry({ close: 241, session: 'post' }, post).close === 241, 'אחרי־מסחר: הנר החי קובע');
// תשובה עם x — לא נוגעים
const full2 = applyExtQuote({ close: 228.5, session: 'closed' }, { state: 'OVERNIGHT', night: { p: 234, ch: 4, pct: 1.7 } });
ok(extCarry(full2, full).close === 234, 'תשובה מלאה חדשה — המחיר שלה');
ok(/extCarry\(got\[s\], old\)/.test(src), 'liveMerge מפעיל את extCarry לפני ההשוואה');
console.log('\n' + n + ' בדיקות עברו');
