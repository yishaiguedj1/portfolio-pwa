// v337 (דיווח המשתמש 05/10/2026): לחיצה ארוכה הקפיצה את תפריט ההעתקה של המכשיר ואת "Touch to Search" של Google;
// ויקיפדיה הופיעה רק למונחים. עכשיו: בלי בחירה של הדפדפן בספר (צביעה + ידיות משלנו), העתקה מהכרטיס = הטקסט המקורי,
// וויקיפדיה לכל מילה
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const proxy = fs.readFileSync(path.join(root, 'ibkr-proxy/api/translate.js'), 'utf8');
const { swVersionOk } = require('./_swver.js');
const pure = (name) => new Function(lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n'))[0].replace('export ', '') + ';return ' + name + ';')();

// בחירה בלי הדפדפן
ok(/html, body \{ -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; \}/.test(lib), 'הספר לא ניתן לבחירה בדפדפן — בלי תפריט העתקה ובלי Touch to Search');
ok(/::highlight\(snb-sel\)/.test(lib) && /CSS\.highlights\.set\('snb-sel'/.test(lib), 'הסימון = צביעה משלנו (CSS Highlight)');
ok(/doc\.addEventListener\('contextmenu', \(e\) => e\.preventDefault\(\)\)/.test(lib), 'תפריט ההקשר של המכשיר חסום בספר');
ok(/\.rd-hdl \{ position: absolute;/.test(css) && /touch-action: none/.test(css), 'ידיות גרירה משלנו');
const cmp = (a, b) => a - b;
const se = pure('selExtend');
ok(JSON.stringify(se(cmp, { s: 10, e: 20 }, { s: 4, e: 8 }, true)) === '{"s":4,"e":20}', 'ידית התחלה נגררת אחורה — הטווח גדל');
ok(JSON.stringify(se(cmp, { s: 10, e: 20 }, { s: 25, e: 30 }, true)) === '{"s":10,"e":20}', 'ידית התחלה אחרי הסוף — בלי היפוך');
ok(JSON.stringify(se(cmp, { s: 10, e: 20 }, { s: 25, e: 30 }, false)) === '{"s":10,"e":30}', 'ידית סוף נגררת קדימה — הטווח גדל');
ok(/function clearSelection\(\) \{[\s\S]{0,200}selPaint\(null\);/.test(lib), 'סגירת הכרטיס מסירה את הצביעה והידיות');
// העתקה
ok(/navigator\.clipboard\.writeText\(sel \? sel\.text : text\)/.test(lib), 'העתקה מהכרטיס = הטקסט המקורי מהספר (לא התרגום)');
// ויקיפדיה לכל מילה
const wq = pure('wikiQueries');
ok(JSON.stringify(wq('האתוס')) === '["האתוס","אתוס"]' && JSON.stringify(wq('ובהשקעה')) === '["ובהשקעה","בהשקעה","השקעה"]' && JSON.stringify(wq('ethos')) === '["ethos"]', 'עברית: גם בלי תחיליות ("האתוס" → "אתוס")');
ok(/for \(const w of wikiQueries\(q\)\)/.test(lib) && !/wikiExact/.test(lib), 'בלי דרישת התאמה מדויקת — הערך הראשון שאינו פירושונים');
ok(/"wished" -> "Wish"/.test(proxy) && /leave it empty only for function words/.test(proxy), 'השרתון: שם ערך גם למילה רגילה (צורת הבסיס)');
const v = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(v === 'v337' && swVersionOk(v), 'גרסה v337');
console.log(`\n${n} בדיקות עברו`);
