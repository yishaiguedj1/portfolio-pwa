// v339 (בקשת המשתמש 05/10/2026): חיסכון והגנה על תקציב ה־AI — מטמון משותף, מפסק יומי, מגבלה לכל קורא,
// והתאמת דגמים לפי מדידה חיה של טוקנים (Flash-Lite לתרגום, Gemini ראשון ו־Ministral גיבוי)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const tr = fs.readFileSync(path.join(root, 'ibkr-proxy/api/translate.js'), 'utf8');
const libApi = fs.readFileSync(path.join(root, 'ibkr-proxy/api/library.js'), 'utf8');
const { swVersionOk } = require('./_swver.js');
const { TRANSLATE_MODELS } = require(path.join(root, 'ibkr-proxy/lib/gmodels.js'));

ok(/tok = await idToken\(\)/.test(lib) && /tok \? \{ idToken: tok \} : \{\}/.test(lib), 'האפליקציה שולחת את אסימון ההתחברות — מגבלה לפי קורא');
ok(/j\.limited === 'user' \? 'trLimitUser' : 'trLimitDay'/.test(lib) && /trLimitUser: 'הגעת למכסה היומית/.test(app) && /trLimitDay:/.test(app), 'מגבלה יומית — שורה קצרה בכרטיס, בעברית ובאנגלית');
ok(tr.indexOf("store.get('ctx', sk)") > 0 && tr.indexOf("store.get('ctx', sk)") < tr.indexOf("store.allow(who, 'ctx')") && tr.indexOf("store.allow(who, 'ctx')") < tr.indexOf('out = await gemini(') && tr.indexOf('out = await gemini(') < tr.indexOf("store.set('ctx', sk"), 'תרגום: מטמון משותף → מפסק → AI → שמירה למטמון');
ok(/store\.get\('ins', \[id, item\.md5\]\)/.test(libApi) && /store\.allow\(user\.uid, 'ins'\)/.test(libApi) && /store\.set\('ins', \[id, item\.md5\]/.test(libApi), 'ניתוח מכתב: פעם אחת לכל הקוראים (לפי md5), עם מפסק יומי');
const tm = TRANSLATE_MODELS();
ok(tm[0] === 'gemini-3.5-flash-lite' && !tm.some((m) => /gemini-(flash-latest|3\.8-flash|2\.5)/.test(m)), 'תרגום: Flash-Lite בלבד (3.5 ראשון), בלי Flash היקר ובלי 2.5 שהוסר');
ok(tr.indexOf('out = await gemini(') < tr.indexOf('out = await mistral('), 'Gemini ראשון, Ministral (חינמי) גיבוי');
ok(/const out = p\.then\(\(r\) => wikiInLang\(r\)\)/.test(lib) && /if \(!w \|\| w\.lang === tl\) return w;/.test(lib), 'ויקיפדיה תמיד בשפת המשתמש — ערך בשפה אחרת מתורגם');
ok(/gtLong\(w\.title, tl\), gtLong\(w\.extract, tl\)/.test(lib) && /T\('trWikiTr'\)/.test(lib) && /trWikiTr: 'תורגם אוטומטית'/.test(app), 'תרגום כותרת ותקציר + ציון "תורגם אוטומטית" בקרדיט');
ok(/if \(!extract\) return w;/.test(lib), 'תקלה בתרגום — נשאר במקור (לא ריק)');
const v = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(v === 'v339' && swVersionOk(v), 'גרסה v339');
console.log(`\n${n} בדיקות עברו`);
