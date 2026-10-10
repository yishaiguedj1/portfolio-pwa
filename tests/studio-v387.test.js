// v387: סטודיו התרגום — מגדל 2.0, סט הזהב (ServiceNow: Agentic evaluation · golden dataset) — תשתית:
// עבודה שהסתיימה + תרגום אנושי (SRT) לייחוס; ציון דטרמיניסטי (chrF++ זהה ל־tedeval + כיסוי זמן), בלי AI ובלי טוקנים;
// הרצה חוזרת — רק בלחיצה, אחרי אומדן ואישור, דרך "התחלה" הרגילה (כל השמירות).
// הבדיקות המלאות של השרתון: ibkr-proxy/tests/run.js (בלוק v387).
// הרצה: node tests/studio-v387.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const N = await import(path.join(root, 'studionet.js'));
  /* ---------- 1. SRT ו־chrF++ ---------- */
  const A = '﻿1\r\n00:00:01,000 --> 00:00:03,000\r\nשלום <i>עולם</i>\r\n\r\n2\r\n00:00:04,000 --> 00:00:06,500\r\nמה שלומך?\r\n\r\nפגום\r\n\r\n3\r\n00:00:09,000 --> 00:00:08,000\r\nהפוך\r\n';
  const pa = N.parseSrt(A);
  ok(pa.length === 2 && pa[0].a === 1000 && pa[0].b === 3000 && pa[0].t === 'שלום עולם' && pa[1].t === 'מה שלומך?', 'parseSrt: BOM, CRLF, תגיות; בלוק פגום וזמן הפוך — מדלגים');
  ok(N.parseSrt('').length === 0 && N.parseSrt('just text').length === 0, 'parseSrt: לא SRT — ריק');
  // אותם ערכי sacrebleu 2.6.0 של translator/tests/test_tedeval.py — המימוש בטלפון = המימוש של מאגר המדידות
  const SB = [['the cat sat on the mat', 'the cat sat on a mat', 72.030], ['שלום עולם, מה נשמע?', 'שלום עולם! מה נשמע?', 71.918],
    ['זה תרגום ניסיון של כתובית ארוכה יותר — עם מקף עברי', 'זה ניסיון תרגום של כתובית ארוכה, עם מקף עברי', 67.163], ['a', 'a', 100], ['abc', 'xyz', 0],
    ['', 'ref text', 0], ['קצר', 'קצר מאוד מאוד', 27.108], ['Hello world', 'hello World', 28.155], ['מספרים 123 ו־456.', 'מספרים 123 ו-456.', 66.940],
    ['שתי שורות\nעם ירידת שורה', 'שתי שורות עם ירידת שורה', 100]];
  ok(SB.every(([h, r, w]) => Math.abs(N.chrfpp(h, r) - w) < 5e-4), 'chrF++: זהה לערכי sacrebleu (כמו tedeval)');
  ok(N.normHe('\u200fשָׁלוֹם…\u200e') === 'שלום...' && N.normHe('בית״ס  ו־כו׳') === 'בית"ס ו-כו\'', 'normHe: זהה ל־norm_he');
  ok(!('chrF' in N), 'אין chrF תווי נפרד — מדד אחד');
  // אותם מספרים בדיוק כמו tedeval.py על טקסטים עבריים (כשיש python3)
  const { spawnSync } = require('child_process');
  const pairs = [['‏שָׁלוֹם, עולם! "בית״ס"', 'שלום עולם — בית"ס'], ['(מחיאות כפיים) תודה רבה לכם.', 'תודה רבה.'], ['אני: ואז הוא אמר — "לא!"', 'ואז הוא אמר "לא".']];
  const py = spawnSync('python3', ['-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); import tedeval as T; print(json.dumps([T.chrfpp(T.norm_he(h), T.norm_he(r)) for h, r in json.loads(sys.stdin.read())]))', path.join(root, 'translator')], { input: JSON.stringify(pairs), encoding: 'utf8' });
  if (py.status === 0) {
    const want = JSON.parse(py.stdout);
    ok(pairs.every(([h, r], i) => Math.abs(N.chrfpp(N.normHe(h), N.normHe(r)) - want[i]) < 1e-9), 'chrF++ ו־normHe: זהים ל־tedeval.py (python3)');
  }
  /* ---------- 2. כיסוי זמן והציון ---------- */
  const hyp = [{ a: 1000, b: 2000, t: 'x' }, { a: 4000, b: 6500, t: 'y' }];
  ok(N.timeCover(hyp, pa) === 77.8, 'timeCover: כמה מזמן הדיבור בייחוס מכוסה בכתוביות שלנו');
  ok(N.timeCover([], pa) === 0 && N.timeCover(pa, pa) === 100, 'timeCover: בלי כתוביות = 0, זהה = 100');
  const g = N.goldCompare(A, A);
  ok(g && g.s === 100 && g.tm === 100 && g.n === 2, 'goldCompare: מול עצמו = 100/100');
  ok(N.goldCompare(A, 'no srt') === null, 'goldCompare: ייחוס לא תקין — בלי ציון');
  ok(N.GOLD_REF_MAX === 2 * 1024 * 1024, 'הייחוס עד 2MB');
  ok(/gold: srv\.gq \? \{ chrf_doc: srv\.gq\.s, cover: srv\.gq\.tm/.test(read('studio.js')), 'נתוני המדידה (benchData) כוללים את ציון סט הזהב — מאגר מדידות אחד');

  /* ---------- 3. השרתון ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(S.GOLD_REF_MAX === N.GOLD_REF_MAX && S.GOLD_MAX === 10, 'אותה מגבלת גודל בטלפון ובשרתון; עד 10 עבודות זהב');
  const src = { id: 'j' + 'Q'.repeat(20), kind: 'tr', state: 'done', gd: { r: 'refs1234567890', n: 4 }, fa: { id: 'aud1234567890' }, folder: 'fold1234567890', spec: { mode: 'opus-medium', out: ['compact'] } };
  ok(S.goldSources([src, Object.assign({}, src, { gd: null }), Object.assign({}, src, { state: 'failed' }), Object.assign({}, src, { fa: null })]).length === 1, 'goldSources: רק שהסתיימו, עם ייחוס וקבצים');
  const c = S.goldClone(src, 'j' + 'R'.repeat(20), 'u1', 5);
  ok(c.state === 'new' && c.gs === src.id && c.spec.out.join() === 'compact,srt' && c.folder === src.folder && !c.gd && src.spec.out.length === 1, 'goldClone: עבודה חדשה עם אותו מקור, מוסיפה SRT, לא נוגעת במקור');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/if \(body\.ok !== true\) return res\.status\(400\)\.json\(\{ ok: false, error: 'confirm' \}\);/.test(api), 'goldRun — רק עם אישור מפורש');
  const runBlock = api.slice(api.indexOf("if (op === 'goldRun')"), api.indexOf("let job = await mine(body.job);"));
  ok(!/fireJob|queueApi/.test(runBlock), 'goldRun לא מפעיל כלום בשרתון — רק יוצר עבודות "חדשות"');
  ok(/!j\.gd && FINAL\.includes|!j\.gd/.test(read('ibkr-proxy/lib/studioscan.js')), 'הניקוי לא מוחק עבודות זהב');

  /* ---------- 4. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  ok(JSON.stringify(st.normGd({ r: 'refs1234567890', n: 4000, at: 9 })) === JSON.stringify(S.normGd({ r: 'refs1234567890', n: 4000, at: 9 })) && st.normGd({ r: '../x' }) === null, 'normGd: זהה לשרתון');
  ok(JSON.stringify(st.normGq({ s: 71, tm: 93, n: 120, at: 1 })) === JSON.stringify(S.normGq({ s: 71, tm: 93, n: 120, at: 1 })) && st.normGq({ s: 101, tm: 1, n: 1 }) === null, 'normGq: זהה לשרתון');
  const gold = [{ spec: { mode: 'opus-medium', dur: 1800 } }, { spec: { mode: 'sonnet-high', dur: 3600 } }];
  ok(st.goldEstimate(gold, { 'opus-medium': { ph: 4 }, 'sonnet-high': { ph: 1.5 } }) === 3.5 && st.goldEstimate(gold, null) === 4.5, 'goldEstimate: הרגיל לשעה × אורך (בלי נתונים — 3$ לשעה)');
  const sj = read('studio.js');
  ok(/askConfirm\(gold\.length === 1 \? T\('studioGoldRunQ1', \{ usd: fmtUsd\(usd\) \}\) : T\('studioGoldRunQ', \{ n: gold\.length, usd: fmtUsd\(usd\) \}\), go2/.test(sj), 'הרצה — רק אחרי אומדן ואישור');
  ok(/for \(const sj of j\.jobs\) await tryStart\(sj\.id\);/.test(sj), 'ההתחלה — דרך tryStart (מתג חירום, חוקים, תקלה רחבה)');
  ok(/p\.append\(\.\.\.goldCard\(rec\)\);/.test(sj) && /p\.append\(\.\.\.goldSection\(\)\);/.test(sj), 'כרטיס בדף העבודה, ומקטע בבקרת הסוכנים');
  ok(!/fetch\(/.test(sj.slice(sj.indexOf('v387: סט הזהב (golden dataset)'), sj.indexOf('function costCard('))), 'בלי פנייה ישירה לרשת מ־studio.js (הכל דרך studionet)');
  const app = read('app.js');
  for (const k of ['studioGoldT', 'studioGoldAdd', 'studioGoldAdding', 'studioGoldAddNote', 'studioGoldIn', 'studioGoldNoScore', 'studioGoldScore', 'studioGoldCalcGo', 'studioGoldCalc',
    'studioGoldOff', 'studioGoldOffQ', 'studioGoldRunT', 'studioGoldSrc', 'studioGoldOwn', 'studioGoldLast', 'studioGoldNone', 'studioGoldRun', 'studioGoldRunning', 'studioGoldRunNote',
    'studioGoldRunQ', 'studioGoldRunQ1', 'studioGoldRunOk', 'studioGoldStarted', 'studioGoldBig', 'studioGoldBad', 'studioGoldErr', 'studioGoldNoRef', 'studioGoldNoSrt', 'studioErrGoldFull', 'studioErrGoldBusy'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);

  /* ---------- 5. גרסה ---------- */
  const ver = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1] || '';
  ok(+ver.slice(1) >= 387 && swVersionOk(ver), 'APP_VERSION ≥ v387 ו־sw.js תואם (או גרסה אחת אחורה)');
  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
