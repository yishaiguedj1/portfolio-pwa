// v334 (בקשות המשתמש 05/10/2026): מילון בכרטיס התרגום (כמו קינדל, נקי), "בהקשר הזה" מ־Mistral עם גיבוי Gemini,
// ויקיפדיה כמו בקינדל, ושם המודל המדויק בכל תשובת AI (גם בניתוח המכתב)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const tr = require(path.join(root, 'ibkr-proxy/api/translate.js'));
const pure = (name, pre) => new Function((pre || '') + lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n'))[0].replace('export ', '') + ';return ' + name + ';')();

// ---------- שם המודל ----------
const aiModelLabel = pure('aiModelLabel');
ok(aiModelLabel('mistral-medium-latest') === 'Mistral Medium' && aiModelLabel('mistral-small-latest') === 'Mistral Small', 'Mistral Medium / Small');
ok(aiModelLabel('gemini-3.5-flash-lite') === 'Gemini Flash‑Lite' && aiModelLabel('gemini-flash-latest') === 'Gemini Flash' && aiModelLabel('') === '', 'Gemini Flash‑Lite / Flash; בלי מודל — ריק');
ok(/model\.textContent = aiModelLabel\(j\.model\)/.test(lib) && /T\('acAiNote'\) \+ \(ins\.model \? ' · ' \+ aiModelLabel\(ins\.model\) : ''\)/.test(lib), 'תווית המודל ב"בהקשר הזה" ובניתוח המכתב');

// ---------- מילון: פענוח Google (זהה בשרתון ובאפליקציה) ----------
const src = (s) => s.match(/function parseGt\(j\) \{[\s\S]*?\n\}\n/)[0];
ok(src(lib) === src(fs.readFileSync(path.join(root, 'ibkr-proxy/api/translate.js'), 'utf8')), 'אותו פענוח בדיוק באפליקציה ובשרתון');
const j = { sentences: [{ trans: 'סַרְסוּר', orig: 'broker' }, { src_translit: 'ˈbrōkər' }],
  dict: [{ pos: 'שם עצם', terms: ['סַרְסוּר', 'מְתַוֵך', 'סוֹכֵן מְנָיוֹת', 'עָמִיל'], entry: [{ word: 'סַרְסוּר', reverse_translation: ['pimp', 'broker'] }] }],
  definitions: [{ pos: 'שם עצם', entry: [{ gloss: 'a person who buys and sells goods or assets for others.', example: 'operate through <b>brokers</b>' }] }, { pos: 'פועל', entry: [{ gloss: 'arrange or negotiate.', example: 'broker a ceasefire' }] }],
  synsets: [{ pos: 'שם עצם', entry: [{ synonym: ['rep'], label_info: { register: ['informal'] } }, { synonym: ['dealer', 'broker-dealer', 'agent', 'middleman', 'intermediary', 'mediator'] }] }], src: 'en' };
const g = tr._parseGt(j);
ok(g.ipa === 'ˈbrōkər' && g.translation === 'סַרְסוּר', 'הגייה + תרגום עם הניקוד');
ok(g.dict[0].terms.join() === 'סַרְסוּר,מְתַוֵך,סוֹכֵן מְנָיוֹת' && g.dict[0].def.startsWith('a person') && g.dict[0].ex === 'operate through brokers', 'עד 3 תרגומים לחלק דיבר, הגדרה ודוגמה (בלי תגיות)');
ok(g.dict[1].pos === 'פועל' && !g.dict[1].terms.length && g.dict[1].def === 'arrange or negotiate.', 'חלק דיבר עם הגדרה בלבד נכנס (עד 2)');
ok(g.syn.join() === 'dealer,agent,middleman,intermediary', 'נרדפות: בלי סלנג ובלי צירוף שמכיל את המילה, עד 4');
ok(/dt=md&dt=ss&dt=rm/.test(lib) && /dt=md&dt=ss&dt=rm/.test(fs.readFileSync(path.join(root, 'ibkr-proxy/api/translate.js'), 'utf8')), 'הבקשה ל־Google כוללת הגדרות, נרדפות והגייה');

// ---------- ויקיפדיה ----------
const wikiExact = pure('wikiExact');
ok(wikiExact('Broker', 'Broker') && wikiExact('brokers', 'Broker') && !wikiExact('moat', 'Moath al-Alwi') && !wikiExact('', 'x'), 'בלי AI — רק התאמה מדויקת (אחרת "moat" = תעלה של טירה)');
ok(/if \(ai && !j\.wiki\) return;/.test(lib), 'לפי ה־AI מילה רגילה — בלי ויקיפדיה');
ok(/prop=langlinks&lllang=he/.test(lib) && /api\/rest_v1\/page\/summary\//.test(lib) && /j\.type === 'disambiguation'/.test(lib), 'ערך בעברית דרך הקישור מהאנגלית; בלי דפי פירושונים');
ok(/connect-src[^;]*https:\/\/en\.wikipedia\.org https:\/\/he\.wikipedia\.org/.test(html), 'CSP מאפשר את ויקיפדיה');
ok(/T\('trWiki'\) \+ ' · CC BY-SA'/.test(lib), 'קרדיט לפי הרישיון');

// ---------- ממשק ----------
ok(/trSection\('wiki', \[h\('span', null, T\('trWiki'\)\)\], false\)/.test(lib), 'ויקיפדיה מקופלת כברירת מחדל');
ok(/localStorage\.setItem\('pwa_trsec_v1'/.test(lib), 'מצב המקטעים נזכר');
ok(/u\.lang = .*'he-IL' : 'en-US'/.test(lib), 'השמעה בקול המכשיר, עברית או אנגלית');
ok(/\.tr-sec\.fold \.tr-sec-b \{[^}]*mask-image/.test(css) && /\.tr-model \{/.test(css) && /\.dc-syn span:not\(:last-child\)::after/.test(css), 'עיצוב Apple: מקופל נמוג, תווית מודל, נרדפות בשורה');
for (const k of ['trDict', 'trSyn', 'trSay', 'trWiki', 'trWikiMore']) ok((app.match(new RegExp('\\b' + k + ": '", 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');
// ---------- באג "קופץ ונעלם" (דיווח המשתמש) + מיקום הכרטיס ----------
const pageMoved = pure('pageMoved');
ok(pageMoved({ index: 3, location: { current: 5 }, cfi: 'a' }, { index: 3, location: { current: 5 }, cfi: 'b' }) === false, 'אותו פרק ואותו עמוד עם CFI שונה מעט (הצמדה אחרי רעד אצבע) — לא נחשב מעבר עמוד');
ok(pageMoved({ index: 3, location: { current: 5 } }, { index: 3, location: { current: 6 } }) && pageMoved({ index: 3 }, { index: 4 }), 'עמוד אחר או פרק אחר — מעבר');
ok(/const moved = pageMoved\(rd\.loc, d\)/.test(lib) && /c\._at = Date\.now\(\);/.test(lib), 'הכרטיס נסגר רק במעבר עמוד אמיתי');
const trDock = pure('trDock');
ok(trDock(200, 844) === 'bottom' && trDock(600, 844) === 'top', 'הכרטיס נפתח בצד שמול המילה');
ok(/\.tr-card \{ max-height: 46vh;/.test(css) && /\.tr-card\.full \{ max-height: 84vh; \}/.test(css) && /\.tr-card\.top \{/.test(css), 'גובה בינוני כברירת מחדל, מלא בגרירה/"הצג עוד", כרטיס עליון');
ok(/dbody\.append\(main\)/.test(lib) && /trSection\('dict', \[h\('span', null, T\('trDict'\)\)\], false\)/.test(lib), 'התרגום בתוך קבוצת המילון; מקופל כברירת מחדל (קומפקטי)');
console.log('# ' + n + ' בדיקות עברו');
