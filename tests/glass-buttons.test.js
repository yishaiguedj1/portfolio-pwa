// glass-buttons.test.js — כפתורי זכוכית בכל המערכת (31/10/2026, בקשת המשתמש: "כל הכפתורים במערכת, ללא יוצא מן הכלל";
// סבב כדור השלג בוטל לבקשתו — נשארה מעטפת הזכוכית בלבד).
// 1. כל מחלקה של <button>/role=button בקוד (tools/btn-inventory.js) מופיעה ב־glass-btn.css — בזכוכית או ברשימת הפטורים (@glass-exempt).
//    כפתור חדש עם מחלקה חדשה = להוסיף אותה ל־glass-btn.css (לרשימה המתאימה), או לפטור אותה שם עם סיבה (שורה/מתג/קישור טקסט/דוגמית).
// 2. glass-btn.css בשכבה עם !important (גובר על כל !important של הרכיבים), זכוכית שקופה עם טשטוש (כבוי בסיבוב הקובייה), בלי שלג, ונטען בכל הדפים.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const { inventory } = require('../tools/btn-inventory.js');
let n = 0;
const fails = [];
function ok(cond, name) { n++; if (!cond) fails.push(name); else console.log('ok - ' + name); }

const css = fs.readFileSync(path.join(root, 'glass-btn.css'), 'utf8');
const ex = (css.match(/\/\* @glass-exempt([\s\S]*?)\*\//) || [, ''])[1];
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
const inGlass = (c) => new RegExp('\\.' + c.replace(/[-]/g, '\\-') + '(?![\\w-])').test(body);
const inEx = (c) => new RegExp('(^|\\s)' + c.replace(/[-]/g, '\\-') + '(?=\\s|$)', 'm').test(ex);

const inv = inventory();
ok(inv.size > 120, 'המלאי מוצא את הכפתורים (' + inv.size + ' מחלקות)');
const missing = [...inv.keys()].filter((c) => !inGlass(c) && !inEx(c));
ok(!missing.length, 'כל מחלקת כפתור מסווגת ב־glass-btn.css' + (missing.length ? ' — חסר: ' + missing.join(', ') : ''));
const both = [...inv.keys()].filter((c) => inEx(c) && inGlass(c) && !/^(adm-seg-b|mg-seg-b|st-seg-b|kc-seg-b|lang-opt|theme-opt|tab|adm-tab|mg-tb)$/.test(c));
ok(!both.length, 'מחלקה לא גם בזכוכית וגם פטורה (חוץ מסגמנטים ומעטפות)' + (both.length ? ': ' + both.join(', ') : ''));

// הרכיבים המרכזיים מכל אפליקציה — בזכוכית (לא בטעות בפטורים)
for (const c of ['icon-btn', 'fx-pill', 'btn', 'dlg-ok', 'chip-btn', 'range-btn', 'wl-tab', 'mini-btn', 'tab-disc', 'tab-glow', 'subpage-back', 'lib-back', 'st-back', 'adm-back',
  'lib-chip', 'lib-btn', 'st-btn', 'st-chip', 'st-mini', 'st-plus', 'an-btn', 'an-chip', 'an-seg-th', 'kc-btn', 'kc-chip', 'kc-fab', 'kc-ib', 'kc-tcell', 'adm-btn', 'google-btn', 'st-pill'])
  ok(inGlass(c) && !inEx(c), 'בזכוכית: .' + c);

ok(/@layer glassbtn\s*\{/.test(body), 'glass-btn.css ב־@layer glassbtn');
const layer = body.slice(body.indexOf('@layer glassbtn'));
ok(/--gb-on:\s*1;\s*background:\s*var\(--gb-body\)\s*!important/.test(layer), 'החומר: גוף הזכוכית, !important, מסומן --gb-on');
ok(/backdrop-filter:\s*var\(--gb-fx\)\s*!important/.test(layer) && /cube-face[^{]*\{[^}]*--gb-fx:\s*none/.test(body), "שקוף עם טשטוש, כבוי בסיבוב הקובייה");
ok(!/::(before|after)/.test(layer), 'בלי ::before/::after');
ok(!/snow|url\(/i.test(body), 'בלי שלג ובלי תמונות (בקשת המשתמש: רק הזכוכית)');
ok(/\[data-theme="dark"\][^{]*\{[^}]*--gb-body:/.test(body), 'כהה: גוף משלו');
ok(/--gb-tone:\s*var\(--gb-force,\s*var\(--btn-c,\s*var\(--primary\)\)\)/.test(layer), 'צבעוני = צבע הכפתור (--btn-c / --primary)');
ok(!/color:\s*var\(--gb-on\b/.test(layer) && /color:\s*var\(--gb-ontx, var\(--on-primary\)\)/.test(layer), 'צבע הטקסט בצבעוני — משתנה נפרד מהסימון --gb-on (אחרת color: 1 לא תקין)');
ok(/data-app="admin"\][^{]*\{[^}]*#5E5CE6/.test(body), 'ניהול: הסגול של הניהול');

ok(/:where\(\.stock-logo,[^{]*\{[^}]*--gb-logo-bg[^}]*backdrop-filter:\s*none/.test(layer) && !/mix-blend-mode/.test(layer), 'אריחי הלוגו: בלי טשטוש ובלי מיזוג (31/10 — הדף נעלם אחרי נחיתה בטלפון)');
ok(/\[data-theme="dark"\][^{]*\{[^}]*--gb-logo-bg:\s*linear-gradient\(180deg, rgba\(255, 255, 255, \.9\)/.test(body), 'כהה: אריח לוגו בהיר — לוגו כהה לא נעלם');

ok(/:where\(\.login-card, \.lib-sheet, \.kc-sheet\)\s*\{[^}]*--gl-panel/.test(layer), 'המשטחים שנשארו אטומים — זכוכית החלונות (--gl-panel)');
for (const f of ['index.html', 'academy.html', 'studio.html', 'admin.html', 'move.html'])
  ok(/<link rel="stylesheet" href="glass-btn\.css">/.test(fs.readFileSync(path.join(root, f), 'utf8')), f + ' טוען את glass-btn.css');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
ok(sw.includes("'./glass-btn.css'"), 'glass-btn.css במטמון של sw.js');
ok(!/snow-cap|snow\.css/.test(sw), 'אין שאריות של קבצי השלג ב־sw.js');

if (fails.length) { console.log('\nנכשלו ' + fails.length + '/' + n + ':\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('\n' + n + '/' + n + ' עברו');
