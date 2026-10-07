// v356: אשף החיבור של הסטודיו — ארבעה שלבים מדויקים, כל פעולה בשורה משלה והכפתור שלה אחריה.
// הלקח מהטלפון: בטופס ה־Routine צריך לסמן טריגר API לפני Create (אחרת הכפתור אפור), והכתובת והמפתח בדף המשימה אחרי השמירה.
// הרצה: node tests/studio-v356.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const st = read('studio.js');
const app = read('app.js');
const runbook = read('translator/RUNBOOK.md');

/* ---------- 1. המחרוזות בשתי השפות ---------- */
const lines = app.split('\n');
const marks = lines.map((l, i) => (l.trim() === '// v354: סטודיו התרגום (studio.js)' ? i : -1)).filter((i) => i >= 0);
ok(marks.length === 2, 'שתי שורות המחרוזות של הסטודיו (עברית ואנגלית)');
const HE = eval('({' + lines[marks[0] + 1] + '})'), EN = eval('({' + lines[marks[1] + 1] + '})');
const KEYS = ['studioW1T', 'studioW1a', 'studioW1b', 'studioW1c', 'studioW2T', 'studioW2a', 'studioW2b', 'studioW2c',
  'studioW3T', 'studioW3a', 'studioW3b', 'studioW4T', 'studioW4D', 'studioOpenCode', 'studioOpenRoutines'];
ok(KEYS.every((k) => HE[k] && EN[k]), 'כל שורות האשף קיימות בעברית ובאנגלית');
ok(['studioW1D', 'studioW2D', 'studioW3D'].every((k) => !(k in HE) && !(k in EN) && !st.includes("'" + k + "'")), 'המחרוזות הישנות (פסקה לכל שלב) הוסרו');
const wiz = (o) => KEYS.map((k) => o[k]).join(' | ');
ok(!/Limited/.test(wiz(HE) + wiz(EN)), 'בלי "Limited" — ב־claude.ai יש רק None / Trusted / Full / Custom');
ok(/Custom/.test(HE.studioW1b) && /Allowed domains/.test(HE.studioW1b) && /Also include default list/.test(HE.studioW1b), 'שלב 1: Custom, ‏Allowed domains והתיבה של רשימת ברירת המחדל');
ok(/Setup script/.test(HE.studioW1c) && /Add cloud environment/.test(HE.studioW1a), 'שלב 1: איך פותחים סביבה חדשה, ואיפה מדביקים את השורה');
ok(/New routine/.test(HE.studioW2a) && /Sonnet 5\.5/.test(HE.studioW2b) && /portfolio-pwa/.test(HE.studioW2b), 'שלב 2: משימה חדשה, המודל והריפו');
for (const [o, lang] of [[HE, 'he'], [EN, 'en']]) {
  const s = o.studioW2c;
  ok(/Select a trigger/.test(s) && /API/.test(s) && /Create/.test(s) && s.indexOf('API') < s.lastIndexOf('Create'), lang + ': מסמנים API לפני Create (בלעדיו הכפתור אפור)');
  ok(/Connectors/.test(s), lang + ': בלי Connectors');
  ok(/Triggers/.test(o.studioW3a) && /API/.test(o.studioW3a), lang + ': הכתובת — בדף המשימה, תחת Triggers ליד API');
  ok(/Generate token/.test(o.studioW3b), lang + ': המפתח — Generate token');
}
ok(/פעם אחת/.test(HE.studioW3b) && /only once/.test(EN.studioW3b), 'המפתח מוצג פעם אחת — מעתיקים מיד');
ok(Object.values(EN).every((v) => !/[֐-׿]/.test(v)), 'אין עברית במחרוזות האנגליות');
ok(!/←/.test(wiz(EN)) && /→/.test(wiz(EN)) && /←/.test(wiz(HE)), 'כיוון החצים לפי השפה (← בעברית, → באנגלית)');

/* ---------- 2. סדר השלבים והכפתורים ב־studio.js ---------- */
const a = st.indexOf('function pageConnect'), b = st.indexOf('async function saveConn');
const pc = st.slice(a, b);
const arr = pc.slice(pc.indexOf('const steps = ['), pc.indexOf('];', pc.indexOf('const steps = [')));
const seq = (arr.match(/T\('studioW[0-9][A-Za-z]*'\)|'w:[a-z]+'/g) || []).map((x) => x.replace(/^T\('|'\)$|'/g, ''));
ok(seq.join(' ') === 'studioW1T studioW1a w:open studioW1b w:hosts studioW1c w:setup studioW2T studioW2a w:routines studioW2b w:prompt studioW2c studioW3T studioW3a studioW3b studioW4T studioW4D',
  'הסדר: כל שורה ואחריה הכפתור שלה, בסדר שבו עושים ב־claude.ai — ' + seq.join(' '));
ok(/'https:\/\/claude\.ai\/code\/routines'/.test(pc) && /'https:\/\/claude\.ai\/code'/.test(pc), 'קישורים ישירים ל־claude.ai/code ול־/routines');
ok(/rel = 'noopener noreferrer'/.test(pc) && /target = '_blank'/.test(pc), 'קישורים חיצוניים — בחלון חדש, noopener');
ok(/typeof it === 'string'/.test(pc) && /st-wacts/.test(pc), 'שורה = פסקה; כפתורים אחרי שורה — בקבוצה אחת מתחתיה');

/* ---------- 2ב. שורות בעברית: כל שם מסך באנגלית בבידוד (<bdi>) — אחרת "API ← Generate token" נקרא הפוך ---------- */
const reSrc = (st.match(/const LATIN_RUN = (\/.+\/g);/) || [])[1];
ok(!!reSrc && /function bidiP\(text\)/.test(st) && /body\.append\(bidiP\(it\)\)/.test(pc), 'שורות האשף עוברות דרך bidiP');
const RUN = eval(reSrc);
const runs = (s) => [...s.matchAll(RUN)].map((m) => m[0]);
ok(runs(HE.studioW3b).join('|') === 'API|Generate token', 'שלב 3: ‏API ו־Generate token — שני רצפים נפרדים (החץ ביניהם בכיוון העברית)');
ok(runs(HE.studioW1a).join('|') === 'claude.ai/code|Cloud|Add cloud environment', 'שלב 1: הכתובת, Cloud ו־Add cloud environment נפרדים');
ok(runs(HE.studioW1b).join('|') === 'Network access|Custom|Allowed domains|Also include default list', 'שלב 1: שמות השדות — כל אחד ברצף משלו');
ok(KEYS.every((k) => runs(HE[k]).every((r) => /[A-Za-z0-9]$/.test(r))), 'רצף לטיני לא בולע נקודה/נקודתיים/פסיק בסופו');

/* ---------- 3. העובד: הפעלה בלי עבודה (Run now) לא מריצה כלום ---------- */
ok(/אין בלוק כזה/.test(runbook) && /Run now/.test(runbook) && /לא מריצים שום דבר/.test(runbook), 'RUNBOOK: בלי בלוק או בלי ערכים תקינים — לא מריצים כלום ומסיימים');

/* ---------- 3ב. הפעלה "לא ודאית" (5xx/רשת): הסשן אולי נפתח — מחכים לו (קרה אצל המשתמש: "לא זמין" ואז bad_key) ---------- */
const api = read('ibkr-proxy/api/studio.js'), lib = read('ibkr-proxy/lib/studio.js');
ok(/const UNSURE = \['routine_down', 'routine_net'\]/.test(api) && /UNSURE\.includes\(f\.error\)/.test(api), 'השרתון: 5xx ותקלת רשת = "לא ודאי"');
const un = api.slice(api.indexOf('UNSURE.includes(f.error)'), api.indexOf('if (!f.ok) {', api.indexOf('UNSURE.includes(f.error)')));
ok(/warn: f\.error/.test(un) && !/kh: ''/.test(un) && !/state: 'failed'/.test(un) && /unsure: f\.error/.test(un), 'לא ודאי: המפתח נשאר בתוקף, העבודה לא נכשלת, הטלפון מקבל unsure');
ok(/err: job\.warn \|\| 'no_claim'/.test(lib), 'לא נלקח בזמן אחרי הפעלה לא ודאית — נכשל עם השגיאה של Anthropic');
ok((api.match(/warn = ''/g) || []).length >= 1 && /up\.warn = ''/.test(api), 'claim/דיווח ראשון מנקים את הסימון');
ok(/unsure: !!j\.unsure/.test(st) && /T\('studioTestUnsure'\)/.test(st) && /T\('studioTestUnsureS'\)/.test(st), 'הטלפון: "Anthropic החזיר שגיאה — מחכים עד כ־6 דקות" (במקום כישלון מיד)');
ok(HE.studioTestUnsure && EN.studioTestUnsure && /6/.test(HE.studioTestUnsureS) && /6/.test(EN.studioTestUnsureS), 'המחרוזות בשתי השפות');
ok(/בלי התראות ובלי בדיקות חוזרות מתוזמנות/.test(runbook), 'RUNBOOK: העובד לא שולח התראות ולא מתזמן בדיקות (הסשן של המשתמש שלח התראה)');

/* ---------- 4. גרסה ---------- */
const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
ok(+String(ver).slice(1) >= 356, 'APP_VERSION ≥ v356');
ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');

console.log('# ' + n + ' בדיקות עברו');
