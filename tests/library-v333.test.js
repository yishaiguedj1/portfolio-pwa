// v333 (בקשת המשתמש): נגיעה אחת במילה = כרטיס תרגום מלמטה (כמו Google Translate, בעיצוב שלנו), לחיצה ארוכה = חלון הסימון
// וההערה מיד; התרגום המיידי מ־Google (בלי מכסה), ו"בהקשר" מ־Gemini — שלא חוסם; תיקון "המכסה נגמרה" בשרתון
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const tr = fs.readFileSync(path.join(root, 'ibkr-proxy/api/translate.js'), 'utf8');
const gm = require(path.join(root, 'ibkr-proxy/lib/gmodels.js'));
const pure = (name, pre) => new Function((pre || '') + lib.match(new RegExp('export function ' + name + '[\\s\\S]*?\\n}\\n'))[0].replace('export ', '') + ';return ' + name + ';')();

// ---------- זיהוי מילה ----------
const wordBounds = pure('wordBounds', lib.match(/const WORD_CH[^\n]*\n/)[0]);
const t = 'טקסט לדוגמה של הספר, פסקה אחרי פסקה.';
ok(JSON.stringify(wordBounds(t, 23)) === '[21,25]' && JSON.stringify(wordBounds(t, 25)) === '[21,25]', 'מילה סביב הנגיעה (גם כשהסמן בסוף המילה)');
ok(JSON.stringify(wordBounds("it's well-known.", 3)) === '[0,4]' && JSON.stringify(wordBounds("it's well-known.", 8)) === '[5,15]', 'גרש ומקף בתוך מילה נשארים');
ok(JSON.stringify(wordBounds('"moat" ', 2)) === '[1,5]', 'מרכאות בקצוות — בחוץ');
ok(wordBounds('2023 ', 1) === null && wordBounds('a , b', 2) === null, 'מספר בלבד / פיסוק — לא מתרגמים');
ok(JSON.stringify(wordBounds('שָׁלוֹם עולם', 2)) === '[0,7]', 'מילה מנוקדת — שלמה');

// ---------- Google ----------
const parseGt = pure('parseGt', "const NIQQUD = /[\\u0591-\\u05C7]/g; const gtClip = (x, n) => String(x == null ? '' : x).replace(/\\s+/g, ' ').trim().slice(0, n);");
const g = parseGt({ sentences: [{ trans: 'תְעָלַת מָגֵן', orig: 'moat' }, { translit: 'x' }], dict: [{ pos: 'שם עצם', terms: ['תְעָלַת מָגֵן', 'חפיר', 'חפיר'] }, { pos: 'פועל', terms: [] }], src: 'en' });
ok(g.translation === 'תְעָלַת מָגֵן' && g.dict.length === 1 && g.dict[0].terms.join() === 'תְעָלַת מָגֵן,חפיר' && g.src === 'en', 'Google: תרגום וחלקי דיבר, עם הניקוד (v334), בלי כפולים, בלי חלק דיבר ריק');
ok(parseGt(null) === null && parseGt({ sentences: [] }) === null, 'תשובה ריקה → null');
ok(tr.includes("const NIQQUD = /[\\u0591-\\u05C7]/g;") && /function parseGt\(j\)/.test(tr), 'אותו פענוח גם בשרתון (גיבוי)');
ok(/const GT_URL = 'https:\/\/clients5\.google\.com\/translate_a\/single\?client=dict-chrome-ex&dt=t&dt=bd[^']*&dj=1';/.test(lib), 'ישירות מהטלפון — נקודת הקצה של תוסף המילון של Chrome (CORS פתוח, בלי מפתח)');
ok(/connect-src[^;]*https:\/\/clients5\.google\.com/.test(html), 'CSP מאפשר את Google Translate');
ok(/credentials: 'omit', referrerPolicy: 'no-referrer'/.test(lib), 'בלי עוגיות ובלי כתובת האתר');
ok(/body: JSON\.stringify\(\{ text: text\.slice\(0, 400\), mode: 'quick', to: tl \}\)/.test(lib), 'בכשל — אותה פנייה דרך השרתון');
ok(/const trTarget = \(text\) => \(uiLang\(\) === 'he' && \/\[\\u0590-\\u05FF\]\/\.test\(text\) \? 'en' : uiLang\(\)\);/.test(lib), 'מילה בעברית בממשק עברי — לאנגלית');

// ---------- התנהגות ----------
ok(!/doc\.addEventListener\('pointerdown', \(e\) => \{[\s\S]{0,260}gtQuick\(w\.text/.test(lib), 'v336: נגיעה קצרה לא מתרגמת (וגם לא טוענת מראש) — רק לחיצה ארוכה');
ok(!/if \(w\) \{ if \(rd\.chrome\) setChrome\(false\); trShow\(/.test(lib) && /if \(trCard\) \{ hideTr\(\); return; \}\s*setChrome\(!rd\.chrome\);/.test(lib), 'v336 (כמו בקינדל): נגיעה קצרה — סוגרת כרטיס, ואז סרגלים');
ok(/const HOLD_MS = 320;/.test(lib) && /if \(rd\.chrome && rd\.setChrome\) rd\.setChrome\(false\);\s*openSel\(doc, w\.range\);/.test(lib), 'לחיצה ארוכה: 320ms → המילה מסומנת והכרטיס מיד (v337: בחירה שלנו, לא של Chrome)');
ok(/setTimeout\(\(\) => showSel\(doc\), 140\)/.test(lib) && /if \(selMode && trCard\._sel\.t === text\) return;/.test(lib), 'שינוי בחירה — 140ms, בלי בנייה מחדש כשלא השתנה');
ok(/Date\.now\(\) - \(rd\.holdAt \|\| 0\) < 1500\) \{\s*try \{ sel\.removeAllRanges\(\); sel\.addRange\(rd\.holdRange\)/.test(lib), 'שחרור האצבע שמקפל את הבחירה — המילה חוזרת, החלון נשאר');
ok(/const moved = pageMoved\(rd\.loc, d\)/.test(lib) && /if \(moved\) \{ hideSel\(\); hideTr\(\); \}/.test(lib), 'המנוע שולח relocate גם בנגיעה בלי תזוזה — נסגר רק בהחלפת עמוד (נמצא ב־QA)');
ok(/else if \(trCard\) hideTr\(\);/.test(lib) && /if \(trCard\) \{ hideTr\(\); return; \}\s*if \(rd\) return readerExit\(\);/.test(lib), '"חזור" ו־Escape סוגרים את הכרטיס');
ok(/box\.addEventListener\('click', \(e\) => \{[\s\S]{0,300}setChrome\(!rd\.chrome\);/.test(lib), 'הסרגלים נפתחים גם בנגיעה בשולי העמוד');
ok(!/act\('rdTranslate'/.test(lib) && !/function translateSheet/.test(lib), 'v336: חלון הסימון הוטמע בכרטיס התרגום — אין כפתור "תרגום" נפרד');
ok(/if \(seq !== trSeq\) return;/.test(lib), 'תשובה מאוחרת של מילה קודמת לא דורסת');
ok(!/fetchTranslation\(/.test(lib) && !/tr-ctx/.test(lib), 'v340 (בקשת המשתמש): "בהקשר הזה" (AI) הוסר מכרטיס התרגום בקורא');
ok(/CSS\.highlights\.set\('snb-tap'/.test(lib) && /::highlight\(snb-tap\)/.test(lib), 'המילה מסומנת בעדינות בלי לגעת ב־DOM של הספר');

// ---------- עיצוב ----------
ok(/\.tr-card \{[^}]*position: absolute;[^}]*bottom: calc\(8px \+ env\(safe-area-inset-bottom\)\)/.test(css) && /\.rd\[data-dark="1"\] \.tr-card \{ background: #1C1C1E;/.test(css), 'כרטיס מלמטה, בצבע הדף; בכהה משטח מוגבה');
ok(/\.tr-grab \{/.test(css) && /\.tr-dsec \.tr-main \{[^}]*font-size: 20px/.test(css) && /\.tr-ctx-t \{/.test(css), 'ידית, תרגום גדול (מ־v334 בראש קבוצת המילון), "בהקשר" כמקטע');
ok(/prefers-reduced-motion: reduce\) \{ \.tr-card/.test(css), 'reduced-motion');

// ---------- Gemini: מכסה ----------
delete process.env.GEMINI_MODEL;
delete process.env.GEMINI_INSIGHT_MODEL;
ok(/lite/.test(gm.TRANSLATE_MODELS()[0]) && /lite/.test(gm.INSIGHT_MODELS()[0]) && gm.INSIGHT_MODELS().some((m) => !/lite/.test(m)), 'תרגום: Flash-Lite קודם; ניתוח (מ־v334, החלטת המשתמש): גם Flash-Lite קודם, Flash גיבוי');
ok(gm.badScript('חפير', 'he') && !gm.badScript('חפיר', 'he') && !gm.badScript('خندق', 'ar'), 'עברית עם אותיות ערביות — נפסלת');
ok(/if \(r\.status === 429\) \{ q429\+\+; continue; \}/.test(tr) && /return q429 && q429 === tried \? \{ quota: true \} : null;/.test(tr), '429 במודל אחד — ממשיכים; "מכסה" רק כשכולם 429');
console.log('# ' + n + ' בדיקות עברו');
