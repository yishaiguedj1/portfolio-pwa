// v341 (בקשת המשתמש 05/10/2026): ויקיפדיה כמו בקינדל — חיפוש על הבחירה כמו שהיא, בוויקיפדיה של שפת הספר,
// התוצאה הראשונה של מנוע החיפוש, "לא נמצא ערך" כשאין — ובנוסף הערך בשפת המשתמש (מקביל או תרגום אוטומטי)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const { swVersionOk } = require('./_swver.js');
const pure = (name) => new Function('return (' + lib.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n\\}\\n'))[0] + ')')();
const wl = pure('wikiLangFor');
ok(wl('moat', 'en') === 'en' && wl('moat', 'en-US') === 'en', 'ספר באנגלית — ויקיפדיה באנגלית');
ok(wl('Anlage', 'de') === 'de' && wl('Anlage', '') === 'en', 'ספר בגרמנית — ויקיפדיה בגרמנית; בלי שפה — אנגלית');
ok(wl('חפיר', 'en') === 'he' && wl('moat', 'he') === 'en' && wl('ריבית', 'iw') === 'he', 'מילה בכתב אחר משפת הספר — בשפה של הכתב');
const k = (lib.match(/function wikiKindle[\s\S]*?\n\}\n/) || [''])[0];
ok(/wikiWord\(text\)/.test(k) && !/base|translation/.test(k), 'החיפוש על הטקסט שנבחר כמו שהוא — לא על צורת הבסיס/התרגום');
ok(/list=search/.test(k) && /srlimit=3/.test(k), 'מנוע החיפוש של ויקיפדיה (הפניות, נטיות, ביטויים)');
ok(/return \{ none: true \}/.test(k) && /w\.none/.test(lib) && /trWikiNone/.test(lib), 'אין ערך — "לא נמצא ערך" (הכרטיס לא נעלם)');
ok(/wikiOtherLang\(lang, w, tl\)\)? \|\| wikiInLang\(w\)/.test(k) || /\(await wikiOtherLang\(lang, w, tl\)\) \|\| wikiInLang\(w\)/.test(k), 'שפת המשתמש: הערך המקביל, ואם אין — תרגום אוטומטי');
ok(/wikiKindle\(text\)\.then\(\(w\) => wikiSection\(c, w, seq\)\)[\s\S]{0,40}gtQuick\(text, tl\)/.test(lib), 'ויקיפדיה במקביל למילון — לא מחכה לו');
ok(!/wikiFromDict|wikiLookup|wikiTitle/.test(lib), 'בלי המסלולים הקודמים');
ok(/trWikiNone: 'לא נמצא ערך בוויקיפדיה'/.test(app) && /trWikiNone: 'No Wikipedia entry found'/.test(app), 'מחרוזות בעברית ובאנגלית');
const v = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(!!v && swVersionOk(v), 'גרסה');
console.log(`\n${n} בדיקות עברו`);
