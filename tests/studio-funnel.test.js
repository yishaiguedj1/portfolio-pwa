// 26/10/2026 (Vid Hub, שלב א׳): המסלול שלפני העבודה — מונים קבועים ו"מה עצר אותך?" באומדן, ושורת "אין חיבור" בדף העבודה.
// הרצה: node tests/studio-funnel.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const F = require(path.join(root, 'ibkr-proxy/lib/studiofnl.js'));

/* ---------- 1. גוף הבקשה ---------- */
ok(JSON.stringify(F.normFnl({ s: { pick: 2, est: 1 }, w: { exp: 1 } })) === JSON.stringify({ s_pick: 2, s_est: 1, w_exp: 1 }), 'צעדים וסיבות → שדות למונה');
ok(F.normFnl({ s: { pick: 999 } }).s_pick === F.FNL_MAX, 'מונה גדול נחתך');
ok(F.normFnl({ s: { evil: 1 } }) === null && F.normFnl({ w: { name: 1 } }) === null, 'צעד/סיבה לא מוכרים — כל הבקשה נדחית');
ok(F.normFnl({ s: { pick: 0 } }) === null && F.normFnl({ s: { pick: 1.5 } }) === null && F.normFnl({ s: { pick: '2x' } }) === null, 'רק שלמים חיוביים');
ok(F.normFnl({ s: [1] }) === null && F.normFnl(null) === null && F.normFnl({}) === null, 'צורה לא צפויה / ריק = null');
ok(F.normFnl({ s: { pick: 1 }, file: 'x.mp4' }).s_pick === 1 && !('file' in F.normFnl({ s: { pick: 1 }, file: 'x' })), 'שדות אחרים בגוף לא נכנסים');

/* ---------- 2. הכתיבה ---------- */
const w = F.fnlWrite('d/1', { s_pick: 2 });
ok(w.writes[0].transform.fieldTransforms[0].increment.integerValue === '2' && w.writes[0].transform.document === 'd/1', 'increment בלי קריאה');

/* ---------- 3. הסיכום ---------- */
const now = Date.UTC(2026, 9, 26, 12);
const v = F.fnlView([{ id: '2026-10-26', s_est: 4, s_start: 3, s_quit: 1, w_exp: 1 }, { id: '2026-10-20', s_est: 1, s_start: 0, w_slow: 2 }, { id: '2020-01-01', s_est: 99 }], now);
ok(v.days.length === F.FNL_DAYS && v.days[F.FNL_DAYS - 1].d === '2026-10-26', '14 ימים, היום אחרון');
ok(v.tot.s.est === 5 && v.est2start === 60 && v.quit === 20, 'מאומדן להתחלה ומי שוויתר — באחוזים (מחוץ לחלון לא נספר)');
ok(v.why[0][0] === 'slow' && v.whyN === 3, 'הסיבות לפי שכיחות');
ok(F.fnlView([], now).est2start === null && F.fnlView([], now).n === 0, 'בלי נתונים — בלי אחוז');

/* ---------- 4. הטלפון ---------- */
const st = read('studio.js');
const arr = (src, name) => (src.match(new RegExp(name + ' = (\\[[^\\]]*\\])')) || [])[1];
ok(arr(st, 'FNL_STEPS') === JSON.stringify(F.FNL_STEPS).replace(/"/g, "'").replace(/,/g, ', ') && arr(st, 'FNL_WHY') === JSON.stringify(F.FNL_WHY).replace(/"/g, "'").replace(/,/g, ', '), 'הרשימות זהות בטלפון ובשרתון');
for (const k of F.FNL_STEPS) ok(k === 'quit' || k === 'est' ? /fnlAdd\('(est|quit)'/.test(st) : st.includes("fnlAdd('" + k + "')"), 'הצעד ' + k + ' נספר');
ok((st.match(/askConfirmP|estAsk\(/g) || []).length > 0 && !/askConfirm\w*\(estimate/.test(st), 'כל האומדנים דרך estAsk');
ok(/'pagehide', \(\) => \{[^}]*fnlFlush\(\)/.test(st), 'נשלח גם כשהדף נסגר');
ok(!/fnlAdd\([^)]*(name|url|file)/.test(st), 'בלי שמות/קישורים במונים');

/* ---------- 5. השרתון ומרכז הניהול ---------- */
const api = read('ibkr-proxy/api/studio.js');
ok(/op === 'fnl'[\s\S]{0,400}limited\('fnl:/.test(api) && /op === 'adminFnl'[\s\S]{0,200}isAdmin\(user\)/.test(api), 'fnl מוגבל בקצב, adminFnl רק למנהל');
const adm = read('admin-app.js');
ok(/page\('labFnl'/.test(adm) && /fnlRow\(\),/.test(adm) && /api\('adminFnl'\)/.test(adm), 'עמוד במעבדת השיפור');
const app = read('app.js');
for (const k of [...F.FNL_STEPS.map((x) => 'admFnlS_' + x), ...F.FNL_WHY.map((x) => 'admFnlW_' + x), ...F.FNL_WHY.map((x) => 'studioWhy_' + x), 'studioWhyT', 'studioWhyThanks', 'admFnlT', 'studioOfflRun', 'studioOfflDone'])
  ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, k + ' בעברית ובאנגלית');

(async () => {
  /* ---------- 6. "אין חיבור" בדף העבודה ---------- */
  const S = await import(path.join(root, 'studio.js')).catch(() => null);
  if (S && S.offlineNote) {
    ok(S.offlineNote({ state: 'done' }, null, false) === '', 'מחובר — בלי שורה');
    ok(S.offlineNote(null, null, true) === '', 'בלי עבודה — בלי שורה');
  } else ok(/export function offlineNote/.test(st) && /studioOfflRun/.test(st), 'offlineNote מיוצא');
  /* ---------- 7. זמן מדויק בעורך החיתוך ---------- */
  const E = await import(path.join(root, 'studioedl.js'));
  ok(E.parseTime('83') === 83 && E.parseTime('1:23') === 83 && E.parseTime('1:23.4') === 83.4 && E.parseTime('1:02:03') === 3723 && E.parseTime(' 0:05,5 ') === 5.5, 'זמן מוקלד — שניות, דקות, שעות, פסיק עשרוני');
  ok(E.parseTime('1:75') === null && E.parseTime('1:60:00') === null && E.parseTime('abc') === null && E.parseTime('') === null && E.parseTime('-3') === null, 'זמן לא תקין = null');
  ok(E.fmtTenth(83.44) === '1:23.4' && E.fmtTenth(3723) === '1:02:03.0' && E.fmtTenth(-1) === '0:00.0', 'הזמן בשדה — עם עשירית');
  ok(E.parseTime(E.fmtTenth(754.3)) === 754.3, 'הלוך ושוב');
  ok(JSON.stringify(E.thumbTimes(80, 4)) === '[10,30,50,70]' && E.thumbTimes(0, 8).length === 0, 'רגעי התמונות הממוזערות — במרכז כל חלק');
  const ed = read('studioedl.js');
  ok(/stopAt != null && t >= stopAt/.test(ed) && /'ed-playseg'/.test(ed), 'ניגון הקטע עוצר בסופו');
  ok(/removeAttribute\('src'\); thV\.load\(\)/.test(ed) && /THUMB_MS/.test(ed), 'הנגן הנסתר של התמונות משתחרר (סיום / זמן / destroy)');
  console.log('\n# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
