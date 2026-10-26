// 26/10/2026 — הרחבת מאגר הלמידה (בקשת המשתמש: "מה עוד אפשר לאסוף שיועיל"): הרשימה המותרת בשרתון לשדות החדשים.
// (3) קודי הבודק לכל כתובית לאורך השלבים (cc, ccs) ותשובות שנזרקו (rj) · המדדים המצרפיים ck/rj ברשומה.
// הרצה: node tests/learn-extra.test.js
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const LC = require(path.join(root, 'ibkr-proxy/lib/learncorpus.js'));
const SL = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));

/* ---------- (3) קודי הבודק ותשובות שנזרקו ---------- */
const base = { v: LC.LC_V, cu: [
  { i: 1, s: 0, e: 1, k: 'S1', en: 'a', d: 'א', cc: { f0: ['num', 'cps'], f1: ['cps'], zz: ['x'], z1: ['BAD', 'hdg', 'a?'] } },
  { i: 2, s: 1, e: 2, k: 'S1', en: 'b', d: 'ב', cc: 'junk' }] };
const c = LC.normCorpus(Object.assign({}, base, {
  ccs: ['f0', 'f1', 'z1', 'evil'],
  rj: [{ s: 'f', i: '1', t: 'כתבו ל־a@b.co', w: 'ok' }, { s: 'f', i: '1', t: 'x', w: 'rm -rf' }, { s: '../x', i: '1', t: 'x', w: 'ok' },
    { s: 'q', i: 'abc', t: 'x', w: 'qs' }, { s: 'p', i: '4', t: 'welcom', w: 'p_nf' }],
}), '2026-10');
ok(JSON.stringify(c.cu[0].cc) === JSON.stringify({ f0: ['num', 'cps'], f1: ['cps'], z1: ['hdg', 'a?'] }), 'cc — רק נקודות וקודים מוכרים');
ok(!('cc' in c.cu[1]), 'cc לא תקין — בחוץ');
ok(JSON.stringify(c.ccs) === JSON.stringify(['f0', 'f1', 'z1']), 'ccs — רק נקודות מוכרות');
ok(c.rj.length === 2 && c.rj[0].t === 'כתבו ל־⟨מייל⟩' && c.rj[1].w === 'p_nf', 'rj — סיבה/שלב/מספר לא תקינים בחוץ, הטקסט מנוקה');
ok(!('rj' in LC.normCorpus(Object.assign({}, base, { rj: 'x' }), '2026-10')), 'rj שאינו רשימה — בחוץ');

const lx = SL.normLx({ mx: { ck: { 'f0f1.fx': 3, 'f0f1.nw': 1, 'nw.num': 1, 'Bad Key': 2 }, rj: { 'f.ok': 2, 'q.qs': 1 }, zz: { a: 1 } } });
ok(lx.mx.ck['f0f1.fx'] === 3 && lx.mx.ck['nw.num'] === 1 && !('Bad Key' in lx.mx.ck), 'lx.mx.ck נכנס לרשומה');
ok(lx.mx.rj['f.ok'] === 2 && !('zz' in lx.mx), 'lx.mx.rj נכנס, קבוצה לא מוכרת — בחוץ');

console.log(`\n${n} בדיקות עברו`);
