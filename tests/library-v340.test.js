// v340 (בקשת המשתמש 05/10/2026): "בהקשר הזה" (AI) הוסר מהקורא; ויקיפדיה לפי המילון של Google
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const tr = require(path.join(root, 'ibkr-proxy/api/translate.js'));
const { swVersionOk } = require('./_swver.js');
const src = (s) => s.match(/function parseGt\(j\) \{[\s\S]*?\n\}\n/)[0];
ok(src(lib) === src(fs.readFileSync(path.join(root, 'ibkr-proxy/api/translate.js'), 'utf8')), 'parseGt זהה בשרתון ובאפליקציה');
const g = tr._parseGt({ sentences: [{ trans: 'עקב', orig: 'followed' }], dict: [{ pos: 'פועל', terms: ['לַעֲקוֹב'], base_form: 'follow' }], src: 'en' });
ok(g.base === 'follow', 'צורת הבסיס מהמילון (followed → follow)');
ok(!/fetchTranslation|tr-ctx|trLimit/.test(lib), 'בלי "בהקשר הזה" ובלי פנייה ל־AI בכרטיס');
ok(/wikiFromDict\(text, o\)\.then\(\(w\) => wikiSection\(c, w, seq\)\)/.test(lib), 'ויקיפדיה אחרי המילון, לפי התוצאה שלו');
const fd = (lib.match(/async function wikiFromDict[\s\S]*?\n\}\n/) || [''])[0];
ok(/wikiLookup\('', he \? text : \(\(o && o\.base\) \|\| text\)\)/.test(fd) && /o\.translation/.test(fd), 'אנגלית — צורת הבסיס; עברית — המילה ואז התרגום לאנגלית');
ok(/T\('acAiNote'\)/.test(lib), 'ניתוח המכתב (AI) נשאר');
const v = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(v === 'v340' && swVersionOk(v), 'גרסה v340');
console.log(`\n${n} בדיקות עברו`);
