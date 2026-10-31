// snow-buttons.test.js — כפתורי כדור שלג בכל המערכת (31/10/2026, בקשת המשתמש: "כל הכפתורים במערכת, ללא יוצא מן הכלל").
// 1. כל מחלקה של <button>/role=button בקוד (tools/btn-inventory.js) מופיעה ב־snow.css — בשלג או ברשימת הפטורים (@snow-exempt).
//    כפתור חדש עם מחלקה חדשה = להוסיף אותה ל־snow.css (לרשימה המתאימה), או לפטור אותה שם עם סיבה (שורה/מתג/קישור טקסט/דוגמית).
// 2. snow.css בשכבה עם !important (גובר על כל !important של הרכיבים), בלי backdrop-filter על הכפתורים, ונטען בכל הדפים.
// 3. תמונות השלג קיימות, קטנות, ובמטמון של sw.js.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { inventory } = require('../tools/btn-inventory.js');
let n = 0;
const fails = [];
function ok(cond, name) { n++; if (!cond) fails.push(name); else console.log('ok - ' + name); }

const css = fs.readFileSync(path.join(root, 'snow.css'), 'utf8');
const ex = (css.match(/\/\* @snow-exempt([\s\S]*?)\*\//) || [, ''])[1];
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
const inSnow = (c) => new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '(?![\\w-])').test(body);
const inEx = (c) => new RegExp('(^|\\s)' + c.replace(/[-]/g, '\\-') + '(?=\\s|$)', 'm').test(ex);

const inv = inventory();
ok(inv.size > 120, 'המלאי מוצא את הכפתורים (' + inv.size + ' מחלקות)');
const missing = [...inv.keys()].filter((c) => !inSnow(c) && !inEx(c));
ok(!missing.length, 'כל מחלקת כפתור מסווגת ב־snow.css' + (missing.length ? ' — חסר: ' + missing.join(', ') : ''));
const both = [...inv.keys()].filter((c) => inEx(c) && inSnow(c) && !/^(adm-seg-b|mg-seg-b|st-seg-b|kc-seg-b|lang-opt|theme-opt|tab|adm-tab|mg-tb)$/.test(c));
ok(!both.length, 'מחלקה לא גם בשלג וגם פטורה (חוץ מסגמנטים ומעטפות)' + (both.length ? ': ' + both.join(', ') : ''));

// הרכיבים המרכזיים מכל אפליקציה — בשלג (לא בטעות בפטורים)
for (const c of ['icon-btn', 'fx-pill', 'btn', 'dlg-ok', 'chip-btn', 'range-btn', 'wl-tab', 'mini-btn', 'tab-disc', 'tab-glow', 'subpage-back', 'lib-back', 'st-back', 'adm-back',
  'lib-chip', 'lib-btn', 'st-btn', 'st-chip', 'st-mini', 'st-plus', 'an-btn', 'an-chip', 'an-seg-th', 'kc-btn', 'kc-chip', 'kc-fab', 'kc-ib', 'adm-btn', 'google-btn', 'st-pill'])
  ok(inSnow(c) && !inEx(c), 'בשלג: .' + c);

// שכבה + !important, בלי pseudo (רכיבים רבים כבר משתמשים ב־::before/::after) ובלי טשטוש
ok(/@layer snow\s*\{/.test(body), 'snow.css ב־@layer snow');
const layer = body.slice(body.indexOf('@layer snow'));
ok(/background:\s*var\(--sb-cap\),\s*var\(--sb-grain\),\s*var\(--sb-body\)\s*!important/.test(layer), 'החומר: כיפה + גרעין + גוף, !important');
ok(/backdrop-filter:\s*none\s*!important/.test(layer), 'בלי backdrop-filter על הכפתורים');
ok(!/::(before|after)/.test(layer), 'בלי ::before/::after');
ok(!/--sb-hill|top:\s*-\d/.test(body), 'בלי בליטה מעל הכפתור (בכהה נראתה כקו — בקשת המשתמש)');
ok(/\[data-theme="dark"\][^{]*\{[^}]*--sb-cap-r:\s*url\(snow-cap-r-dark\.webp\)/.test(body), 'כהה: כיפה כהה');
ok(/--sb-tone:\s*var\(--btn-c,\s*var\(--primary\)\)/.test(layer), 'צבעוני = צבע הכפתור (--btn-c / --primary)');
ok(/data-app="admin"\][^{]*\{[^}]*#5E5CE6/.test(body), 'ניהול: הסגול של הניהול');

for (const f of ['index.html', 'academy.html', 'studio.html', 'admin.html', 'move.html'])
  ok(/<link rel="stylesheet" href="snow\.css">/.test(fs.readFileSync(path.join(root, f), 'utf8')), f + ' טוען את snow.css');

const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
for (const f of ['snow.css', 'snow-cap-r.webp', 'snow-cap-r-dark.webp', 'snow-cap-p.webp', 'snow-cap-p-dark.webp', 'snow-tex.webp', 'snow-spk.webp']) {
  const p = path.join(root, f);
  ok(fs.existsSync(p) && fs.statSync(p).size < 60000, f + ' קיים וקטן');
  ok(sw.includes("'./" + f + "'"), f + ' במטמון של sw.js');
  if (/\.webp$/.test(f)) ok(new RegExp('url\\(' + f.replace('.', '\\.') + '\\)').test(body), f + ' בשימוש ב־snow.css');
}

if (fails.length) { console.log('\nנכשלו ' + fails.length + '/' + n + ':\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('\n' + n + '/' + n + ' עברו');
