// ui-v152.test.js — ניקיון פנימי של styles.css בלי שינוי נראה (אומת: 28 מסכים זהים לפיקסל מול v151).
// עיגולי פינות בערכים הסטנדרטיים עוברים דרך המשתנים; ערך ידני חוזר = נכשל.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
ok(/--pill:\s*999px/.test(css), 'משתנה --pill מוגדר');
for (const [v, tok] of [['999px', '--pill'], ['12px', '--radius-xs'], ['16px', '--radius-sm'], ['22px', '--radius'], ['28px', '--radius-xl']]) {
  const bad = (css.match(new RegExp('border-radius:\\s*' + v + '\\s*[;}]', 'g')) || []).length;
  ok(bad === 0, 'אין border-radius: ' + v + ' ידני — משתמשים ב־var(' + tok + ')');
}
ok((css.match(/var\(--pill\)/g) || []).length >= 10, 'גלולות דרך המשתנה');
const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
