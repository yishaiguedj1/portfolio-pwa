// Academy Pro, גל 5 (03/11/2026): כלים חכמים — libai.js (הקראה, X-Ray, שאל את הספר, תיוג ותקציר, דו־לשוני, טיקרים ל־Invest)
// והחיבור ב־library.js. השרתון (op:'bookAi') — ב־ibkr-proxy/tests/run.js. הרצה: node tests/academy-pro5.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const lib = read('library.js'), ai = read('libai.js'), css = read('library.css'), srv = read('ibkr-proxy/api/library.js');

(async () => {
  const X = await import(path.join(root, 'libai.js'));

  /* F3: שליפת קטעים */
  const t = X.qTerms('מה עשה אליעזר בירושלים?');
  ok(t.includes('אליעזר') && t.includes('בירושלים') && t.includes('ירושלים') && !t.includes('מה'), 'מילות שאלה: בלי מילות קישור, גם בלי אות שימוש');
  ok(X.qTerms('Who is the captain?').join() === 'captain', 'מילות שאלה באנגלית');
  const paras = [
    { sec: 0, j: 0, t: 'פתיחה כללית על הים.' },
    { sec: 1, j: 0, t: 'אליעזר הגיע לירושלים בבוקר.' },
    { sec: 1, j: 1, t: 'הוא פגש שם את רבקה.' },
    { sec: 2, j: 0, t: 'אליעזר חזר הביתה.' },
  ];
  const ps = X.rankPassages(paras, X.qTerms('מה עשה אליעזר בירושלים'), 2);
  ok(ps.length === 2 && ps[0].sec === 1 && ps[1].sec === 2, 'קטעים: הכי רלוונטיים, בסדר הספר');
  ok(ps[0].t.includes('רבקה') && ps[0].at === 'אליעזר הגיע לירושלים בבוקר.', 'קטע קצר — עם ההמשך שלו (להקשר); המקור נשמר לקפיצה');
  ok(X.rankPassages(paras, [], 5).length === 0 && X.rankPassages(paras, ['חתול'], 5).length === 0, 'בלי התאמות — בלי קטעים');

  /* F1 */
  const long = 'א'.repeat(50) + 'ב'.repeat(100);
  const c = X.clipText(long, 60);
  ok(c.length <= 60 && c.startsWith('א') && c.endsWith('ב') && c.includes('…'), 'טקסט ארוך: ההתחלה והסוף');
  ok(X.clipText('קצר', 60) === 'קצר', 'טקסט קצר — כמו שהוא');
  ok(X.countIn('ירושלים, ירושלים וירושלים', 'ירושלים') === 3 && X.countIn('Apple apple', 'APPLE') === 2, 'ספירת מופעים (בלי תלות באותיות גדולות)');
  const g = X.groupXray([{ name: 'א', kind: 'person' }, { name: 'ב', kind: 'company', ticker: 'X' }, { name: 'ג', kind: 'org' }, { name: 'ד', kind: 'weird' }]);
  ok(g.person.length === 1 && g.org.length === 2 && g.place.length === 0 && !g.weird, 'X-Ray: קבוצות (חברה תחת ארגונים)');

  /* G5 */
  ok(X.investLink('https://invest.thesnowball.app/', 'aapl', 'Apple Inc.') === 'https://invest.thesnowball.app/#watch=AAPL&nm=Apple%20Inc.', 'טיקר → הוספה למעקב ב־Invest');
  ok(X.investLink('https://x/', '<script>', '') === 'https://x/#watch=SCRIPT' && X.investLink('', 'A') === '', 'טיקר: רק אותיות/ספרות');

  /* E1 */
  const ss = X.sentences('משפט ראשון. משפט שני! ושלישי? ' + 'מילה '.repeat(80), 120);
  ok(ss[0] === 'משפט ראשון.' && ss[1] === 'משפט שני!' && ss.every((x) => x.length <= 120), 'הקראה: משפטים קצרים');
  ok(X.sentences('', 100).length === 0, 'הקראה: טקסט ריק');

  /* F3: מקורות בתשובה */
  const cp = X.citeParts('הוא נסע [2] ושב [9].', 3);
  ok(cp.length === 4 && cp[1].n === 2 && !cp.some((x) => x.n === 9), 'תשובה: רק מספרי מקורות קיימים');

  /* F5 */
  ok(X.mergeTags('רומן, ישראל', ['ישראל', 'מסע', '']) === 'רומן, ישראל, מסע' && X.mergeTags('', ['א']) === 'א', 'תגיות: מיזוג בלי כפילות');

  /* F7 */
  const bp = X.batchParas(['a'.repeat(10), 'b'.repeat(10), 'c'.repeat(10), 'd'], 1, 2, 100);
  ok(bp.length === 2 && bp[0][0] === 'b', 'דו־לשוני: מנה מהמקום הנוכחי, עד המגבלה');
  ok(X.batchParas(['x'.repeat(50), 'y'.repeat(60)], 0, 40, 100).length === 1, 'דו־לשוני: מגבלת תווים');

  /* החיבור */
  ok(/import\('\.\/libai\.js'\)/.test(lib) && /aiKit\(\)/.test(lib), 'libai.js נטען רק כשנכנסים');
  ok(/'rd-ic rd-ai'/.test(lib) && /acts\.append\(aiBtn,/.test(lib), 'כפתור "כלים חכמים" בסרגל הקורא');
  ok(/if \(AIK\) AIK\.stop\(\)/.test(lib), 'ההקראה נעצרת כשהקורא נסגר');
  ok(/A\.openTagSum\(b\)/.test(lib), 'תקציר ותגיות בדף הספר (ספר שלך)');
  ok(/op: 'bookAi', task, idToken: tk/.test(lib), 'הבקשה לשרתון — עם התחברות');
  ok(/body\.op === 'bookAi'/.test(srv) && /verifyIdToken/.test(srv), 'השרתון: op bookAi רק למשתמש מחובר');
  ok(/'libai\.js'/.test(read('tools/coregen.js')) && /'\.\/libai\.js'/.test(read('sw.js')), 'libai.js ב־coregen וב־LIB_SHELL');
  ok(!/\b(confirm|alert|prompt)\(/.test(ai) && !/onclick=/.test(ai) && (ai.match(/innerHTML = [^;]*/g) || []).every((x) => /^innerHTML = (ICO\.|E\.chev|S\.playing \? ICO)/.test(x)), 'בלי confirm/alert/prompt, בלי onclick, innerHTML רק לסמלים קבועים');
  ok(!/border-radius: \d+px/.test(css.slice(css.indexOf('Academy Pro גל 5'))), 'CSS: עיגולי פינות רק במשתנים');
  ok(/ai-xr-main/.test(read('glass-btn.css')) && /ai-tts-b/.test(read('glass-btn.css')), 'כפתורים חדשים מסווגים (זכוכית/פטור)');
  const strs = read('strings-academy.js');
  ['aiTools', 'aiTts', 'aiXray', 'aiAsk', 'aiBi', 'aiTag', 'aiPriv', 'aiKPerson', 'aiTtsSlept', 'aiTicker'].forEach((k) => ok(strs.includes('"' + k + '"'), 'מחרוזת ב־strings-academy: ' + k));
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
