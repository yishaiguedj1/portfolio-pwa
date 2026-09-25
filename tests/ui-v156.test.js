// ui-v156.test.js — סינון מקור: כפתור "סינון" אחד, והבחירה בבועה מתחתיו (לא שורת צ'יפים גלויה).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

for (const tab of ['deposits', 'trades', 'stocks']) {
  ok(new RegExp('<div class="head-actions">\\s*<button[^\\n]*</button>\\s*<div class="src-filter" id="' + tab + 'SrcFilter"></div>').test(html),
    tab + ': כפתור הסינון בכותרת, בקצה החיצוני (הבועה נפתחת לתוך המסך)');
}
ok(!/stock-sort-row src-filter/.test(html), 'אין עוד שורת צ\'יפים גלויה');
ok(/class="chip-btn src-btn' \+ \(cur !== 'all' \? ' on' : ''\)/.test(src), 'כפתור אחד; ירוק כשמסונן');
ok(/cur === 'ibkr' \? 'IB'/.test(src), 'מסונן ל־IBKR: תווית קצרה בכפתור');
ok(/class="src-pop menu-drop hidden" role="menu"/.test(src), 'בועה עם אנימציית התפריט הקיימת');
ok(/role="menuitemradio" aria-checked=/.test(src) && /aria-expanded/.test(src), 'נגישות: menuitemradio + aria-expanded');
ok(/document\.addEventListener\('click', \(\) => closeSrcPops\(\)\)/.test(src) && /e\.key === 'Escape'\) closeSrcPops\(\)/.test(src), 'נסגר בלחיצה בחוץ וב־Escape');
ok(/closeSrcPops\(\); setSrcFilter\(tab, b\.dataset\.srcf\)/.test(src), 'בחירה סוגרת ומסננת');
ok(/\.src-pop \{[^}]*inset-inline-end: 0/.test(css) && /\.src-pop \{[^}]*var\(--radius-sm\)/.test(css), 'עיגון לוגי (RTL/LTR) ורדיוס מהטוקנים');
ok(/\.section-head:has\(\.head-actions\) h2 \{ white-space: nowrap; \}/.test(css), 'הכותרת בשורה אחת');
ok(/srcFilterBtn: 'סינון'/.test(src) && /srcFilterBtn: 'Filter'/.test(src), 'תווית בעברית ובאנגלית');
console.log('\n' + n + ' בדיקות עברו');
