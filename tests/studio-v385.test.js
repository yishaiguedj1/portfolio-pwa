// v385: סטודיו התרגום — מגדל 2.0, ציון חריגה 0–10 (ServiceNow: Metric Intelligence):
// זמן לכל שלב ועלות לכל סוכן מול הרגיל שלך (חציון + MAD), רק כלפי מעלה; התראה רק בהתמדה (2 מתוך 3) — קפיצה בודדת לא מתריעה.
// הבדיקות המלאות של השרתון: ibkr-proxy/tests/run.js (בלוק v385).
// הרצה: node tests/studio-v385.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const AN = require(path.join(root, 'ibkr-proxy/lib/studioanom.js'));
  const L = require(path.join(root, 'ibkr-proxy/lib/studiosla.js'));
  const now = Date.UTC(2026, 9, 10, 12);
  let seq = 0;
  // עבודה שהסתיימה: 10 דק׳ סרטון, תמלול trS שניות, עלות התרגום usd
  const mk = (trS, o) => {
    const i = seq++;
    return Object.assign({ id: 'j' + String(i).padStart(20, '0'), kind: 'tr', state: 'done', ended: now - (100 - i) * 3600e3,
      spec: { dur: 600, mode: 'opus-medium' }, prog: { stg: { tr: { s: 1000, e: 1000 + trS * 1000 }, tl: { s: 5000, e: 5000 + 300e3 } } },
      use: [{ k: 'main', m: 'claude-sonnet-5-5', usd: 0.5 }, { k: 'tl', m: 'claude-opus-5-5', usd: 1 }] }, o || {});
  };

  /* ---------- 1. המדדים והציון ---------- */
  const v = AN.metricVals(mk(120));
  ok(v['t:tr'] === 12 && v['t:tl'] === 30 && v['u:tl'] === 6 && v['u:main'] === 3, 'מדדים: שניות לדקת סרטון, דולר לשעת סרטון');
  ok(Object.keys(AN.metricVals(mk(120, { state: 'failed' }))).length === 0 && Object.keys(AN.metricVals({ kind: 'ping', state: 'done' })).length === 0, 'רק עבודות תרגום שהסתיימו');
  ok(AN.METRICS.every((m) => /^[tu]:/.test(m.k)) && AN.METRICS.filter((m) => m.k[0] === 't').map((m) => m.k.slice(2)).join() === L.STAGES.join(), 'מדד זמן לכל שלב (אותם שלבים של יעדי השירות)');
  ok(AN.baseline([1, 2, 3, 4]) === null && AN.baseline([1, 2, 3, 4, 5]).med === 3, 'בסיס רק מ־5 עבודות');
  const flat = AN.baseline([10, 10, 10, 10, 10]);
  ok(Math.abs(flat.sc - 1.5) < 1e-9 && AN.score(11, flat) === 0 && AN.score(20, flat) === 10, 'עבודות זהות — סטייה מינימלית 15% (שינוי קטן לא "חריג")');
  ok(AN.score(5, flat) === 0, 'רק כלפי מעלה: מהיר / זול מהרגיל = 0');
  ok(AN.score(12, flat) > 0 && AN.score(12, flat) < AN.score(14, flat), 'הציון עולה עם המרחק');

  /* ---------- 2. התמדה: קפיצה בודדת לא מתריעה ---------- */
  seq = 0;
  const base = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mk(60 + i));
  const one = AN.anomView(base.concat([mk(200), mk(61), mk(62)]), now);
  const tr1 = one.m.find((r) => r.k === 't:tr');
  ok(tr1 && !tr1.p && one.act.length === 0 && tr1.f === 1, 'קפיצה בודדת: נספרת בתדירות, בלי התראה');
  ok(AN.anomAlerts(one).every((e) => e.ok), 'בלי התמדה — כל ההתראות נסגרות');
  seq = 0;
  const base2 = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => mk(60 + i));
  const two = AN.anomView(base2.concat([mk(200), mk(61), mk(210)]), now);
  const tr2 = two.m[0];
  ok(tr2.k === 't:tr' && tr2.p && tr2.s === 10 && tr2.tr === 'u' && two.act.join() === 't:tr', '2 מתוך 3 — חריג בהתמדה, ראשון ברשימה, מגמה עולה');
  const al = AN.anomAlerts(two);
  ok(al.find((e) => e.c === 'vt' && !e.ok) && al.filter((e) => e.ok).length === 2, 'התראה לרכיב של המדד (vt) בלבד');
  const lastId = base2.length + 2;
  const rows = two.j['j' + String(lastId).padStart(20, '0')];
  ok(rows && rows[0][0] === 't:tr' && rows[0][1] === 10 && rows.every((r) => r[1] > 0), 'לכל עבודה — רק מה שמעל הרגיל, מהגבוה');
  ok(Object.keys(two.j).length <= AN.RECENT, 'לכל היותר 10 עבודות אחרונות בתשובה');
  // הבסיס — רק מהעבודות שלפני (עבודה לא נמדדת מול עצמה או מול העתיד)
  seq = 0;
  const early = AN.anomView([0, 1, 2, 3, 4].map((i) => mk(60 + i)), now);
  ok(early.m.length === 0 && early.n === 5, '5 עבודות — עוד אין ציון (הראשונה בלי עבודות לפניה)');
  // תרגום ועלות — הבסיס לפי אותו מצב
  seq = 0;
  const mix = [0, 1, 2, 3, 4].map(() => mk(60, { spec: { dur: 600, mode: 'sonnet-medium' }, use: [{ k: 'tl', m: 'claude-sonnet-5-5', usd: 0.2 }] }))
    .concat([mk(60)]);
  const mv = AN.anomView(mix, now);
  ok(!mv.m.some((r) => r.k === 'u:tl') && mv.m.some((r) => r.k === 't:tr'), 'עלות התרגום — מול אותו מצב בלבד; תמלול — מול כולם');

  /* ---------- 3. השרתון ---------- */
  const api = read('ibkr-proxy/api/studio.js');
  ok(/const an = AN\.anomView\(list, now\);/.test(api) && /slo: SLO\.sloView\(list, now\), an \}/.test(api), 'op:jobs מחזיר an — מאותה רשימה, בלי קריאה נוספת');
  ok(/if \(an\.act\.length \|\| anOpen\) await raise\(deps, uid, AN\.anomAlerts\(an\), '', now, true\)/.test(api), 'ההתראה — בלי עבודה (דפוס בין עבודות), ורק כשיש מה לפתוח/לסגור');
  const ops = require(path.join(root, 'ibkr-proxy/lib/studioops.js'));
  ok(['vt', 'claude', 'drive'].every((c) => ops.KINDS[c + ':anomaly'] === 4), 'בקטלוג: anomaly לשלושת הרכיבים (P4 — בסיכום היומי)');

  /* ---------- 4. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  ok(JSON.stringify(st.AN_KEYS) === JSON.stringify(AN.METRICS.map((m) => m.k)), 'אותם מדדים בטלפון ובשרתון');
  const nv = st.normAn(JSON.parse(JSON.stringify(two)));
  ok(nv && nv.m[0].k === 't:tr' && nv.m[0].p === true && nv.hi === AN.HI && Object.keys(nv.j).length === Object.keys(two.j).length, 'normAn: עובר כמו שהוא');
  const bad = st.normAn({ n: 3, j: { evil: [['t:tr', 5, 1, 1]], ['j' + 'A'.repeat(20)]: [['x:y', 5, 1, 1], ['t:tr', 50, 1, 1], ['t:al', 4, 2, 1]] },
    m: [{ k: 't:tr', c: 'evil', s: 4, v: 1, med: 1 }, { k: 'u:tl', c: 'claude', s: 3, v: 2, med: 1, tr: '<b>', p: 'yes' }] });
  ok(bad && Object.keys(bad.j).length === 1 && bad.j['j' + 'A'.repeat(20)].length === 1 && bad.m.length === 1 && bad.m[0].tr === 'f' && bad.m[0].p === false, 'normAn: מסנן מפתחות, רכיבים וציונים לא תקינים');
  ok(st.normAn(null) === null, 'normAn: בלי נתונים — null');
  const sj = read('studio.js');
  ok(/x === 'slo' \|\| x === 'anom' \? \['tower', null\]/.test(sj), 'דף החריגות — אב = המגדל');
  ok(/p\.append\(\.\.\.anJobRows\(rec\)\);/.test(sj) && /const show = rows\.filter\(\(r\) => r\[1\] >= 3\);/.test(sj), 'דף העבודה: רק שלבים עם ציון 3 ומעלה');
  for (const c of ['claude', 'drive', 'vt']) ok(new RegExp("case '" + c + ":anomaly': return T\\('studioAl").test(sj), 'תווית להתראה ' + c + ':anomaly');
  const app = read('app.js');
  const keys = ['studioAnT', 'studioAnFew', 'studioAnOk', 'studioAnAct1', 'studioAnAct', 'studioAnTr', 'studioAnAl', 'studioAnTl', 'studioAnRv', 'studioAnBn', 'studioAnSv',
    'studioAnUMain', 'studioAnUTl', 'studioAnURv', 'studioAnJobT', 'studioAnVsT', 'studioAnVsU', 'studioAnJobNote', 'studioAnNone', 'studioAnFewT', 'studioAnActT',
    'studioAnOkT', 'studioAnByM', 'studioAnRest', 'studioAnRest1', 'studioAnX', 'studioAnFreq', 'studioAnNote', 'studioAlClaudeAnom', 'studioAlDriveAnom', 'studioAlVtAnom'];
  for (const k of keys) ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);

  /* ---------- 5. גרסה ---------- */
  const ver = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1] || '';
  ok(+ver.slice(1) >= 385 && swVersionOk(ver), 'APP_VERSION ≥ v385 ו־sw.js תואם (או גרסה אחת אחורה)');
  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
