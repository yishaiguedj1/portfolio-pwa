// 11/10/2026: תיקוני המגדל אחרי עבודת Haiku Medium הראשונה (שתי תקלות תשתית באמצע).
// (1) ציון חריגה — זמן אמיתי בטלפון (לא יחס × אורך), בלי עבודות שהומשכו, בלי סטיות של שניות; (2) תקציב השגיאות מ־20 עבודות;
// (3) "הרגיל" — כל המצבים, לפי המנוע (השרת / Routine); (4) "קריסה" נפרדת מ"נגמר הזיכרון"; (5) Haiku Medium יצא.
// הבדיקות המלאות: tests/studio-v385, studio-v383, studio-v363, ibkr-proxy/tests/run.js.
// הרצה: node tests/studio-tower-1011.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const st = await import(path.join(root, 'studio.js'));
  const sj = read('studio.js'), app = read('app.js');

  /* ---------- 1. חריגות: זמן אמיתי ---------- */
  const rowsFn = sj.slice(sj.indexOf('function anJobRows('), sj.indexOf('function pageAnom('));
  ok(!/v \* dur \/ 60/.test(rowsFn) && /planFor\(rec\)\.s\[k\.slice\(2\)\]/.test(rowsFn) && /fmtSecShort\(v \* ps\)/.test(rowsFn),
    'בדף העבודה: יחס × שניות השלב בתוכנית (היה "× אורך הסרטון" — 27 דק׳ מול דקה)');
  const an = st.normAn({ n: 9, j: { ['j' + 'A'.repeat(20)]: [['t:tr', 9, 2.5, 1, 150], ['u:tl', 7, 3, 1], ['t:al', 5, 2, 1, 'x']] }, m: [] });
  const r = an.j['j' + 'A'.repeat(20)];
  ok(r[0].length === 5 && r[0][4] === 150 && r[1].length === 4 && r[2].length === 4, 'normAn: השניות בתוכנית עוברות כשהן מספר');

  /* ---------- 2. תקציב השגיאות ---------- */
  ok(st.normSlo({ t: 95, n: 7, bad: 2, st: 'few', list: [] }).min === 20, 'normSlo: ברירת המחדל — מ־20 עבודות');
  ok(/studioSloFew: "\{g\} מתוך \{n\}/.test(app) && /T\('studioSloFew', \{ g: sl\.good/.test(sj), 'מוקדם למדוד — עדיין מראה כמה הסתיימו בלי התערבות');

  /* ---------- 3. "הרגיל" ---------- */
  const tower = sj.slice(sj.indexOf('function pageNorm(p) {'), sj.indexOf("const rule = (txt) => h('div', 'st-row st-rule'"));
  ok(/MODE_ORDER\.slice\(\)\.reverse\(\)\.filter\(\(id\) => nm\[id\] && \(modeOk\(id, ui\.mf\) \|\| nm\[id\]\.n\)\)/.test(tower), 'המגדל: כל המצבים ב"הרגיל" (גם מצב שהעבודה שלו לא נלמדה — Haiku Medium)');
  ok(/const curNorm = \(\) => \(apiMode\(\) \? ui\.normA \|\| ui\.normR : ui\.normR\)/.test(sj) && !/ui\.norm\b(?!R|A)/.test(sj), '"הרגיל" של המנוע שבשימוש — בכל מקום (מגדל, אומדן, סט הזהב)');
  const est = (apiOn) => st.startEstimate('haiku-high', 300, null, apiOn ? { cap: 30, month: 1 } : null, apiOn);
  ok(est(true).usd < est(false).usd && est(true).usd <= 0.35 && est(false).usd >= 1.5, 'אומדן לפני התחלה: בשרת בלי עלות הפתיחה של ה־Routine');

  /* ---------- 4. קריסה ≠ זיכרון ---------- */
  ok(/case 'worker_oom': return T\('studioErrOom'\);/.test(sj) && /case 'worker_crash': return T\('studioErrCrash'\);/.test(sj), 'הודעה נפרדת לקריסה');
  ok((app.match(/\bstudioErrCrash: "/g) || []).length === 2 && !/studioErrCrash: "[^"]*זיכרון/.test(app), 'בעברית ובאנגלית, בלי "זיכרון"');

  /* ---------- 5. Haiku Medium: יצא ב־11/10, חזר ב־20/10 כמצב לבדיקות (בקשת המשתמש) — רק למנהל / "כל המודלים" ---------- */
  const srv = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(st.MODES.some((m) => m.id === 'haiku-medium') && srv.MODES.includes('haiku-medium') && !srv.PUBLIC_MODES.includes('haiku-medium'), 'Haiku Medium בטלפון ובשרתון — לא בין המצבים הפתוחים לכולם');
  ok(st.modeNow('haiku-medium') === 'haiku-medium' && srv.modeNow('haiku-medium') === 'haiku-medium' && !srv.modeOk('haiku-medium', false) && srv.modeOk('haiku-medium', true), 'כבר לא ממופה ל־High; השרתון אוכף מי רשאי');
  ok(st.normRules({ mx: 'haiku-medium' }).mx === 'haiku-medium' && srv.normRules({ mx: 'haiku-medium' }).mx === 'haiku-medium', 'חוק "מצב מקסימלי" ב־Haiku Medium נשמר');
  ok(st.migrateSettings({ mode: 'opus-high' }).mode === 'haiku-high' && st.migrateSettings({ mode: 'sonnet-medium', mv: 2 }).mode === 'haiku-high' && st.migrateSettings({ mode: 'sonnet-medium', mv: 3 }).mode === 'sonnet-medium' && st.migrateSettings({ mode: 'opus-medium', mv: 2 }).mode === 'opus-medium', 'הגדרה ישנה: Opus / Sonnet Medium של ברירת המחדל הישנה → "רגיל" (פעם אחת, mv 3); בחירה מכוונת נשארת');
  const llm = read('translator/llm.py'), tw = read('translator/tower.py'), rb = read('translator/RUNBOOK.md');
  ok(/'haiku-medium': \('anthropic', 'claude-haiku-5-5', 'medium'\)/.test(llm) && !/'haiku-medium': 'haiku-high'/.test(llm) && /'haiku-medium': 0\.7/.test(tw) && /\| `haiku-medium` \| haiku \| medium \|/.test(rb), 'בעובד: במצבים (מאמץ medium), במגדל ובטבלת ה־RUNBOOK');
  ok(/studioMsHaiMed/.test(app) && /studioMsHaiMed/.test(sj), 'המחרוזות של Haiku Medium');

  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
