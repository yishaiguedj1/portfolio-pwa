// 30/10/2026 — סבב קפיצות 6 (docs/smooth-architecture.md, שלב 1): סידור לפי רשימה במקום בנייה מחדש
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; };

// DOM מינימלי: רשימת ילדים מקושרת, וספירה של כל הכנסה/הוצאה
function Parent() {
  const kids = [];
  const p = { kids, moves: 0, removes: 0 };
  const link = () => kids.forEach((k, i) => { k.nextSibling = kids[i + 1] || null; });
  Object.defineProperty(p, 'firstChild', { get: () => kids[0] || null });
  p.removeChild = (c) => { kids.splice(kids.indexOf(c), 1); p.removes++; link(); };
  p.insertBefore = (c, ref) => { const i = kids.indexOf(c); if (i >= 0) kids.splice(i, 1); const j = ref ? kids.indexOf(ref) : kids.length; kids.splice(j, 0, c); p.moves++; link(); };
  p.set = (arr) => { kids.splice(0, kids.length, ...arr); link(); };
  return p;
}
const ctx = {};
vm.runInNewContext(fn(app, 'listSync') + 'this.listSync = listSync;', ctx);
ok(typeof ctx.listSync === 'function', 'listSync קיימת');
ok(fn(core, 'listSync') === fn(app, 'listSync'), 'listSync בליבה (core.js = app.js)');
const N = (k) => ({ k });
{
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(N);
  const p = Parent(); p.set([a, b, c, d]);
  ctx.listSync(p, [a, b, c, d]);
  ok(p.moves === 0 && p.removes === 0, 'אותה רשימה — אף צומת לא זז');
  ctx.listSync(p, [a, c, d]);
  ok(p.kids.join() === [a, c, d].join() && p.moves === 0 && p.removes === 1, 'סינון — רק מה שיצא יוצא, השאר לא זזים');
  ctx.listSync(p, [a, b, c, d]);
  ok(p.kids.map((x) => x.k).join('') === 'abcd' && p.moves === 1, 'ביטול הסינון — רק החוזר נכנס');
  const e = N('e');
  ctx.listSync(p, [e, a, b, c, d]);
  ok(p.kids.map((x) => x.k).join('') === 'eabcd' && p.moves === 2, 'כרטיס חדש בראש — הכנסה אחת (המונה מצטבר: 1 קודם)');
  ctx.listSync(p, [d, c, b, a]);
  ok(p.kids.map((x) => x.k).join('') === 'dcba', 'מיון הפוך — הסדר נכון');
  ctx.listSync(p, []);
  ok(p.kids.length === 0, 'רשימה ריקה — הכל יוצא');
}
// renderStocks: כרטיס שלא השתנה = הצומת הקיים
const rs = fn(app, 'renderStocks');
ok(!/list\.innerHTML\s*=\s*''/.test(rs), 'renderStocks: בלי ניקוי של הרשימה');
ok(/o\._sig === sig/.test(rs) && /was\.get\(p\)/.test(rs), 'renderStocks: שימוש חוזר רק באותו אובייקט ובאותו HTML');
ok(/listSync\(list, out\)/.test(rs), 'renderStocks: הסידור דרך listSync');
console.log(n + ' בדיקות עברו');
