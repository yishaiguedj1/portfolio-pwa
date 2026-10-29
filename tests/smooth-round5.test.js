// 30/10/2026 — סבב קפיצות 5 (שלושה סרטונים: Invest, Studio, Academy): לוגו לבן וכפתור "סינון" שנעלם בבחירת מקור,
// ודהייה של הווילון ברענון בדף העצמאי. פירוט: docs/smooth-plan.md סעיף 11
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const app = rd('app.js'), lib = rd('library.js'), st = rd('studio.js');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; };

// ---- R10: הלוגואים שכבר נטענו עוברים לכרטיסים החדשים
const rs = fn(app, 'renderStocks');
ok(/const imgs = imgsOf\(list\);\s*[^\n]*\n\s*list\.innerHTML = ''/.test(rs), 'renderStocks: אוסף את הלוגואים לפני הניקוי');
ok(/imgsKeep\(imgs, card\)/.test(rs), 'renderStocks: מעביר אותם לכל כרטיס חדש');
{
  const mkImg = (src, done, cls) => ({ src, complete: done, naturalWidth: done ? 64 : 0, className: cls || '', attrs: { src }, getAttribute(k) { return this.attrs[k]; },
    replaceWith(o) { this.parent.img = o; o.parent = this.parent; o.previousElementSibling = this.previousElementSibling; }, previousElementSibling: null });
  const fb = () => ({ style: {}, classList: { contains: (c) => c === 'stock-logo-fb' } });
  const box = (img) => { const b = { img }; img.parent = b; img.previousElementSibling = fb(); b.querySelectorAll = () => ({ forEach: (f) => [b.img].forEach(f) }); return b; };
  const ctx = {};
  vm.runInNewContext(fn(app, 'imgsOf') + fn(app, 'imgsKeep') + 'this.imgsOf = imgsOf; this.imgsKeep = imgsKeep;', ctx);
  const oldA = mkImg('a.png', true), oldB = mkImg('b.png', false);
  const list = { querySelectorAll: () => ({ forEach: (f) => [oldA, oldB].forEach(f) }) };
  const m = ctx.imgsOf(list);
  ok(m.size === 1 && m.get('a.png') === oldA, 'imgsOf: רק לוגו שנטען (complete + naturalWidth)');
  const c1 = box(mkImg('a.png', false, 'stock-logo-img inv'));
  ctx.imgsKeep(m, c1);
  ok(c1.img === oldA && oldA.className === 'stock-logo-img inv', 'imgsKeep: הכרטיס החדש מקבל את האלמנט הישן, עם הסגנון החדש');
  ok(c1.img.previousElementSibling.style.display === 'none', 'imgsKeep: אות הגיבוי מוסתרת');
  const c2 = box(mkImg('a.png', false));
  ctx.imgsKeep(m, c2);
  ok(c2.img !== oldA, 'imgsKeep: אלמנט אחד לא עובר לשני כרטיסים');
}
const sf = fn(app, 'renderSrcFilter');
ok(/wrap\._lang === getLang\(\)/.test(sf) && sf.indexOf('return;', sf.indexOf('wrap._lang === getLang()')) < sf.indexOf('wrap.innerHTML'), 'renderSrcFilter: כבר בנוי — עדכון במקום, בלי innerHTML');

// ---- R9: רענון בדף העצמאי — הדף מופיע בבת אחת
ok(/else \{ restoreLibScroll\(\); curtainDown\(!!SA\); \}/.test(lib), 'Academy: רענון בבית/מדף בדף העצמאי — בלי דהייה');
ok(/curtainDown\(!restore \|\| !!SA\)/.test(st), 'Studio: רענון בדף העצמאי — בלי דהייה');

console.log('---- ' + n + ' בדיקות עברו');
