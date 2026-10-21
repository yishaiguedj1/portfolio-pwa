// 21/10/2026 — השפעת המאגר לאורך זמן (lib/learnimpact.js + lib/improvements.js): הבסיס מול עכשיו בשכבות מצב·מנוע,
// לכל שיפור לפני/אחרי, פירוק התרומה, חיסכון בחודש, טווח מותאם. הרצה: node tests/learn-impact.test.js
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const I = require(path.join(root, 'ibkr-proxy/lib/learnimpact.js'));
const { IMPROVEMENTS } = require(path.join(root, 'ibkr-proxy/lib/improvements.js'));
const D = 864e5, now = Date.UTC(2026, 10, 30);
let i = 0;
const rec = (o) => Object.assign({ v: 1, id: 'r' + (i++), k: 'tr', st: 'done', dur: 600, pr: 1, usd: 0.5, mode: 'haiku-high', eng: 'api',
  use: [{ i: 1000, o: 500 }], t: { run: 1200, pz: 0, s: { al: 300, sv: 120 } }, q: { s: 95 }, jd: { s: 70 }, fires: 1, ar: 0, eh: [] }, o);
const T1 = now - 40 * D, T2 = now - 15 * D;
const imps = [
  { id: 'a', at: new Date(T1).toISOString(), m: ['sv', 'act'], src: 'devlog', he: ['א', 'א'], en: ['a', 'a'] },
  { id: 'b', at: new Date(T2).toISOString(), m: ['crash', 'ok'], src: 'devlog', he: ['ב', 'ב'], en: ['b', 'b'] },
  { id: 'c', at: null, m: ['up'], src: 'user', he: ['ג', 'ג'], en: ['c', 'c'] },
];
// לפני a: sv=120 שנ׳ (12 לדקה), אחרי: 30 (3 לדקה). לפני b: כל רביעית נפלה ב־worker_lost, אחרי — אף אחת
const rs = [];
for (let k = 0; k < 10; k++) rs.push(rec({ at: T1 - (k + 1) * 2 * D, t: { run: 1300 + 10 * (k % 3), pz: 0, s: { al: 300, sv: 120 + (k % 3) } }, eh: k % 4 === 0 ? [{ e: 'worker_lost' }] : [], fires: k % 4 === 0 ? 2 : 1 }));
for (let k = 0; k < 10; k++) rs.push(rec({ at: T1 + (k + 1) * 2 * D - D, t: { run: 1210 + 10 * (k % 3), pz: 0, s: { al: 300, sv: 30 + (k % 3) } }, eh: k % 4 === 0 && k < 6 ? [{ e: 'worker_lost' }] : [], fires: k % 4 === 0 && k < 6 ? 2 : 1 }));
for (let k = 0; k < 8; k++) rs.push(rec({ at: T2 + k * D + 3600e3, t: { run: 1200 + 10 * (k % 3), pz: 0, s: { al: 300, sv: 30 + (k % 3) } } }));
// מלכודת: בבסיס Opus יקר, אחרי — Haiku זול. בלי שכבות זה היה "חיסכון" שלא קשור לאף שיפור
for (let k = 0; k < 6; k++) rs.push(rec({ at: T1 - (k + 1) * D, mode: 'opus-medium', usd: 3 }));

const v = I.impactView(rs, now, null, imps);
ok(v.start === T1, 'נקודת ההתחלה = השיפור הראשון שנפרס');
const ia = v.imps.find((x) => x.id === 'a'), ic = v.imps.find((x) => x.id === 'c');
const sv = ia.c.find((c) => c.k === 'sv');
ok(sv && sv.tg === 1 && sv.v === 'up' && Math.abs(sv.a - 12) < 0.3 && Math.abs(sv.b - 3) < 0.3, 'שיפור a: שלב השמירה ירד מ־12 ל־3 שנ׳ לדקה — "השתפר", עם רווח סמך');
ok(ia.c[0].tg === 1, 'המדדים שהשיפור כיוון אליהם — ראשונים');
ok(sv.sv && sv.sv.u === 'min' && sv.sv.v > 0, 'חיסכון בחודש בדקות');
ok(ic.st === 'wait' && !ic.c.length, 'שיפור שלא נפרס — "ממתין", לא נמדד');
const cpm = v.cmp.all.m.find((c) => c.k === 'cpm');
ok(cpm.v === 'eq' || cpm.v === 'few', 'מלכודת המצב: Opus יקר בבסיס מול Haiku אחרי — לא נספר כחיסכון (' + cpm.v + ')');
ok(cpm.sk === 1, 'השוואה רק בשכבה המשותפת (haiku-high|api)');
const crash = v.cmp.all.m.find((c) => c.k === 'crash');
ok(crash.good >= 0, 'נפילות: לא החמיר');
ok(['d7', 'd30', 'd90', 'all'].every((k) => v.cmp[k]), 'טווחים מוכנים: 7/30/90/הכל');
const dec = v.dec.find((x) => x.k === 'act');
ok(dec && dec.parts.some((p) => p.id === 'a') && Math.abs(dec.d - dec.parts.reduce((s, p) => s + p.d, 0) - dec.rest) < 1e-3, 'פירוק: הכולל = סכום השיפורים + "לא מוסבר"');
const cu = I.impactView(rs, now, { from: T2, to: now }, imps);
ok(cu.cmp.cu && cu.cmp.cu.from === T2 && cu.cmp.cu.nb === 8, 'טווח מותאם');
ok(JSON.stringify(I.impactView(rs, now, null, imps)) === JSON.stringify(v), 'זרע קבוע — אותה תשובה בכל טעינה');
ok(v.wk.length === 12 && v.wk.every((w) => 'sv' in w), 'מגמה שבועית לכל מדד');
const none = I.impactView(rs, now, null, imps.map((x) => Object.assign({}, x, { at: null })));
ok(!none.start && !Object.keys(none.cmp).length && none.imps.every((x) => x.st === 'wait'), 'בלי שיפור שנפרס — רק המגמה, בלי השוואה');

// היומן האמיתי
ok(IMPROVEMENTS.length >= 6 && IMPROVEMENTS.every((x) => /^i\d{2}$/.test(x.id) && (x.at === null || !isNaN(Date.parse(x.at))) && x.m.length && x.m.every((k) => I.MKEYS.includes(k)) && x.he.length === 2 && x.en.length === 2), 'יומן השיפורים: מזהה, תאריך או null, מדדים מוכרים, שם והשערה בשתי השפות');
ok(new Set(IMPROVEMENTS.map((x) => x.id)).size === IMPROVEMENTS.length, 'מזהים ייחודיים');
console.log('\nכל ' + n + ' הבדיקות עברו ✓');

// המסך במרכז הניהול
const fs = require('fs');
const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8'), app = fs.readFileSync(path.join(root, 'app.js'), 'utf8'), api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
for (const k of I.MKEYS) {
  ok(adm.includes("case '" + k + "': return t('admImM_" + k + "');"), 'שם במסך למדד ' + k);
  ok((app.match(new RegExp('admImM_' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
}
ok(/page\('labImp'/.test(adm) && /page\('labImpI'/.test(adm) && /go\('labImp'\)/.test(adm), 'עמודי "השפעת המאגר" ופרטי שיפור, ושורה בעמוד המעבדה');
ok(/op === 'learnImpact'[\s\S]{0,200}isAdmin\(user\)/.test(api), 'learnImpact — רק למנהל');
ok(/im: impactView\(all, now\)/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/lib/studiolearn.js'), 'utf8')), 'learnView כולל את ההשפעה');
console.log('\nכל ' + n + ' הבדיקות עברו (כולל המסך) ✓');
