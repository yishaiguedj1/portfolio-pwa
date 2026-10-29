// 29/10/2026 (בטלפון: האייקון של "קול" במקורות כמעט לא נראה במצב בהיר): tile('mic', 'purple') — ול־t-purple לא היה צבע
// ב־studio.css, כך שהאריח היה שקוף. כל צבע אריח שבשימוש ב־studio.js חייב רקע ב־CSS.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const js = read('studio.js'), css = read('studio.css');
const used = new Set();
for (const m of js.matchAll(/\b(?:tile|rowTxtRow)\('[a-z]+', '([a-z]+)'/g)) used.add(m[1]);
assert.ok(used.size >= 5, 'נמצאו צבעי אריחים בקוד');
let n = 0;
for (const c of used) {
  assert.ok(new RegExp('\\.st-tile\\.t-' + c + ' \\{ background:').test(css), 'לאריח בצבע ' + c + ' יש רקע ב־studio.css');
  n++; console.log('ok - אריח ' + c);
}
console.log('\nכל ' + n + ' הבדיקות עברו ✓');
