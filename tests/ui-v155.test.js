// ui-v155.test.js — הפקדות מהחדשה לישנה, סינון לפי מקור (הכל/ידני/IB) בהפקדות/עסקאות/מניות,
// וסכום ההפקדה לא גולש מהמסך כשהתיאור ארוך.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
function grab(name) {
  const i = src.indexOf('function ' + name + '(');
  let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); }
}
const fx = new Function(grab('depDateKey') + grab('depositsNewestFirst') + grab('srcPass') +
  'return { depDateKey, depositsNewestFirst, srcPass };')();

ok(fx.depDateKey({ date: '2025-03-04' }) === '20250304', 'מפתח תאריך ISO');
ok(fx.depDateKey({ date: '4/3/2024' }) === '20240304', 'מפתח תאריך DD/MM/YYYY (גם ספרה אחת)');
const list = [{ date: '01/02/2023' }, { date: '2025-01-10' }, { date: '15/06/2024' }, { date: '2025-01-10', x: 1 }];
const out = fx.depositsNewestFirst(list);
ok(out.map((o) => o.i).join(',') === '3,1,2,0', 'מהחדשה לישנה, שני הפורמטים יחד; תיקו — האחרונה ברשימה ראשונה');
ok(out[0].d === list[3], 'האינדקס המקורי נשמר (עריכה/מחיקה מוחקות את הנכונה)');
ok(fx.srcPass('all', 'ibkr') && fx.srcPass('manual', 'manual') && !fx.srcPass('ibkr', 'manual'), 'srcPass');

for (const tab of ['deposits', 'trades', 'stocks']) {
  ok(html.includes('id="' + tab + 'SrcFilter"'), 'בורר מקור ב־' + tab);
  ok(new RegExp("renderSrcFilter\\('" + tab + "'\\)").test(src), 'הבורר מצויר ב־' + tab);
}
ok(/srcPass\(sf, isIbkrDeposit\(x\.d\)/.test(src), 'הפקדות: מקור לפי isIbkrDeposit (כמו התגית והאיפוס)');
ok(/srcPass\(sf, r\.mt \? 'manual' : 'ibkr'\)/.test(src), 'עסקאות: ידני מול IBKR');
ok(/srcPass\(sf, positionSource\(p\)\)/.test(src), 'מניות: מקור לפי positionSource');
ok(/\.rows li > :not\(:first-child\) \{ flex: none; \}/.test(css) && /overflow-wrap: anywhere/.test(css), 'הסכום לא מתכווץ, התיאור נשבר');
ok(/srcFilterLabel: 'מקור:'/.test(src) && /srcFilterLabel: 'Source:'/.test(src), 'תוויות בעברית ובאנגלית');
console.log('\n' + n + ' בדיקות עברו');
