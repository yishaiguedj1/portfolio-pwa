// v336 (בקשת המשתמש 05/10/2026): חלון הסימון הוטמע בכרטיס התרגום — שורת פעולות מינימליסטית בראשו, עיגול צבע אחד
// שנפתח לשורת צבעים, והכרטיס (תרגום + סימון) נפתח רק בלחיצה ארוכה, כמו בקינדל
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const { swVersionOk } = require('./_swver.js');
const fn = (name) => (lib.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n}\\n')) || [''])[0];

ok(!/buildPop|placePop|'rd-pop rd-pop2'/.test(lib), 'הבועה הצפה הישנה הוסרה');
ok(/trShow\(text, bt, doc, range, \{ text, cfi: rd\.view\.getCFI\(doc\.__idx, range\), t: text \}\)/.test(fn('showSel')), 'בחירה (לחיצה ארוכה/ידיות) = כרטיס התרגום במצב סימון');
ok(/trShow\(ann\.x, [^)]*, doc, range, \{ text: ann\.x, cfi: ann\.c, ann/.test(fn('annPopup')), 'נגיעה בהדגשה קיימת — אותו כרטיס, עם הצבע שלה');
const click = (lib.match(/doc\.addEventListener\('click', \(e\) => \{[\s\S]*?\n  \}\);/) || [''])[0];
ok(click && !/trShow|wordAt/.test(click) && /setChrome\(!rd\.chrome\)/.test(click), 'נגיעה קצרה: בלי תרגום — סרגלים בלבד (כמו בקינדל)');
ok(/c\.append\(grab, bar, head, dictHost, ctx\)/.test(lib) && /const \{ bar, acts \} = selBar\(c, sel, text\)/.test(lib), 'שורת הפעולות בראש הכרטיס, מעל המילה');
const sb = fn('selBar');
ok(/tr-sw/.test(sb) && /sw\.after\(pal\); bar\.classList\.add\('pal-open'\)/.test(sb) && /\.tr-bar\.pal-open \.tr-ib \{ display: none; \}/.test(css), 'עיגול צבע אחד שנפתח לשורת צבעים בתוך הסרגל (בלי חלון צף)');
ok(/hlLast\(\)/.test(sb) && /localStorage\.setItem\(HL_LAST, k\)/.test(sb) && /return HL_COLORS\[k\] \? k : 'b'/.test(lib), 'העיגול = הצבע האחרון (ברירת מחדל כחול)');
ok(/saveHighlight\(\{ text: sel\.text, cfi: sel\.cfi, k, ann: sel\.ann && !sel\.ann\.d \? sel\.ann : null \}\)/.test(sb), 'בחירת צבע: הדגשה חדשה או החלפת צבע לקיימת — בלי עותק');
ok(/ICON_NOTE[\s\S]{0,200}noteSheet\(a, rd\.rec\)/.test(sb) && /ICON\.quote, 'hlQuote'/.test(sb), 'הערה וציטוט כאייקונים');
ok(/if \(c\._sel\) clearSelection\(\);/.test(fn('hideTr')), 'סגירת הכרטיס מבטלת את הבחירה');
ok(/if \(!text \|\| !rd\) return;/.test(fn('showSel')), 'בחירה שהתבטלה (גם אחרי הדגשה) — הכרטיס נשאר');
ok(/@media \(prefers-reduced-motion: reduce\) \{ \.tr-pal \{ animation: none; \}/.test(css), 'בלי אנימציה ב־reduced-motion');
const v = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(v === 'v336' && swVersionOk(v), 'גרסה v336');
console.log(`\n${n} בדיקות עברו`);
