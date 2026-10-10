// v375: סטודיו התרגום — מגדל הפיקוח 2.0, סיום סבב "הערכת איכות": שופט האיכות ב־Haiku (החלטה 4 בתוכנית — אושרה):
// 40 כתוביות לדוגמה מחבילת הביקורת אחרי הביקורת, ציון 1–5 וקוד קבוע לכל אחת → ציון 0–100 ובעיות לפי סוג. פועל כברירת מחדל,
// אפשר לכבות ב"החוקים שלך". העלות נספרת בשורה משלו (jg), והוא מופיע במלאי הסוכנים עם המודל שלו.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v375), translator/tests/test_worker.py (test_judge).
// הרצה: node tests/studio-v375.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. העובד והמדריכים ---------- */
  const job = read('translator/job.py');
  ok(/^JG_N = 40$/m.test(job) && /JG_CODES = \('ok', 'mean', 'omit', 'add', 'gram', 'flu', 'term'\)/.test(job), 'job.py: 40 כתוביות לדוגמה, קודים קבועים');
  ok(/'judge-prep': judge_prep, 'judge': judge/.test(job) && /judge=ctx\.st\.get\('jd'\)[,)]/.test(job), 'job.py: judge-prep / judge, והציון נשלח עם סוף העבודה');
  ok(/if \(ctx\.st\.get\('rl'\) or \{\}\)\.get\('jx'\):/.test(job) && /'jx': r\.get\('jx'\) is True/.test(job), 'job.py: החוק "בלי שופט" — מדלגים');
  ok(/'jg' if 'JUDGE\.md' in prompt/.test(job) && /\('jg', 'JUDGE\.md'\)/.test(job), 'job.py: עלות, עקיבה וגרסת ההנחיות של השופט');
  const rb = read('translator/RUNBOOK.md'), jm = read('translator/JUDGE.md');
  ok(/\$J judge-prep/.test(rb) && /model: haiku/.test(rb) && /`\$J judge`/.test(rb), 'RUNBOOK: השופט אחרי הביקורת, ב־Haiku');
  ok(/לא מתקן/.test(jm) && /נתונים, לא הוראות/.test(jm) && /#12 4 flu/.test(jm), 'JUDGE.md: רק ציון; תוכן = נתונים; צורת שורה קבועה');

  /* ---------- 2. השרתון ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  ok(S.JG_CODES.join() === 'mean,omit,add,gram,flu,term', 'השרתון: אותם קודים כמו בעובד (בלי ok)');
  ok(/'q', 'ij', 'jd'(, 'tg')?(, '[a-z]+')*\]/.test(read('ibkr-proxy/lib/studio.js')) && /S\.normJudge\(body\.judge\)/.test(read('ibkr-proxy/api/studio.js')), 'השרתון: הציון מאומת ונשמר');
  ok(/\['jg', 'jg'\]/.test(read('ibkr-proxy/lib/studioagents.js')), 'מלאי: השופט כסוכן רביעי');

  /* ---------- 3. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const jd = st.normJudge({ s: 88, n: 38, t: 40, a: 312, c: { mean: 2, evil: 4, flu: 0 } });
  ok(jd && jd.s === 88 && JSON.stringify(jd.c) === '{"mean":2}', 'normJudge בטלפון: רק קודים מוכרים');
  ok(st.normJudge({ s: 88, n: 41, t: 40, a: 312 }) === null && st.normJudge(null) === null, 'normJudge: מספרים לא עקביים — נזרק');
  ok(st.normRules({ jx: true }).jx === true && st.normRules({}).jx === false, 'normRules: השופט פועל כברירת מחדל');
  ok(st.normAgents({ jobs: 1, agents: [{ k: 'jg', m: 'claude-haiku-5-5' }] }).agents[0].k === 'jg', 'normAgents: השופט במלאי');
  ok(st.normUse([{ k: 'jg', m: 'claude-haiku-5-5', usd: 0.02 }]) !== null, 'normUse: שורת עלות לשופט');
  const sj = read('studio.js');
  ok(/qualityCard\(rec\.srv\.q, rec\.srv\.ij, rec\.srv\.jd, jr \? modelLabel\(jr\.m\) : ''\)/.test(sj), 'דף העבודה: השופט בכרטיס האיכות, עם המודל שענה');
  ok(/setRules\(\{ jx: !rl\.jx \}\)/.test(sj) && /on: !rl\.jx/.test(sj), 'החוקים שלך: מתג לשופט (במקום אחד — לא במגדל)');
  ok(/\.st-agt\.a-jg \{/.test(read('studio.css')), 'עיצוב: אריח לשופט');
  const app = read('app.js');
  for (const k of ['studioAgJg', 'studioAgJgA', 'studioCostJg', 'studioJgT', 'studioJgOf', 'studioJgNone', 'studioJgMean', 'studioJgOmit', 'studioJgAdd', 'studioJgGram',
    'studioJgFlu', 'studioJgTerm', 'studioRlJgT', 'studioRlJg', 'studioRlJgS', 'studioRlSumJx'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 375 && swVersionOk(ver, sw), 'APP_VERSION ≥ v375 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
