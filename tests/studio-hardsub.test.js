// 16/11/2026 (בקשת המשתמש): כתוביות צרובות במקור — הטלפון מציע רקע כהה מתחילת העבודה (כרטיס בלי סגירה עד שהקובץ מוכן),
// בתוצאות — המלצה בולטת או "✓ הוסתרו — נבדק", והנגן מנגן את הקובץ שנבדק. הצורה (hs) זהה בטלפון ובשרתון.
// הרצה: node tests/studio-hardsub.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k) => k;
  const ST = await import(path.join(root, 'studio.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. הצורה — זהה בטלפון ובשרתון ---------- */
  let seed = 11;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  let bad = -1;
  for (let k = 0; k < 400 && bad < 0; k++) {
    const z = Array.from({ length: pick([3, 4, 4, 4, 5]) }, () => pick([rnd(), rnd() * 1.3 - 0.1, '0.5', null]));
    const o = pick([null, 'x', [], { z }, { z, sh: pick([rnd(), -1, 3, 'a']) },
      { z, sh: rnd(), v: pick([null, [], { n: Math.floor(rnd() * 300), lk: pick([0, 2, -1, 1.5]), ok: pick([0, 1, true, 'y']), full: pick([0, 1, true]) }]) }]);
    if (JSON.stringify(ST.normHs(o)) !== JSON.stringify(S.normHs(o))) bad = k;
  }
  ok(bad < 0, 'normHs — הטלפון = השרתון (400 קלטים אקראיים)');
  const good = { z: [0.21, 0.82, 0.79, 0.93], sh: 0.6 };
  ok(ST.normHs(good) && ST.normHs({ z: [0.5, 0.82, 0.51, 0.93] }) === null && ST.normHs({ z: [0.2, 0.8, 0.8, 1.2] }) === null, 'אזור צר מדי או מחוץ למסגרת — null');

  /* ---------- 2. מה הכרטיס אומר ---------- */
  const job = (state, o) => Object.assign({ spec: Object.assign({ out: ['compact'] }, o && o.spec), srv: Object.assign({ state, kind: 'tr', hs: good, ev: 0, sx: 0 }, o && o.srv) });
  const k = (rec, rr, ed) => { const s = ST.hsState(rec, rr, ed); return s ? s.k + (s.n ? ':' + s.n : '') : null; };
  ok(k(job('running'), null, true) === 'ask', 'זוהו בתחילת העבודה, אפשר עוד לשנות — הצעה ("להפעיל רקע כהה")');
  ok(k(job('queued', { spec: { sty: { bx: 1 } } }), null, true) === 'on', 'נבחר רקע כהה — הכרטיס נשאר ("רקע כהה פעיל") עד שהקובץ מוכן');
  ok(k(job('running'), null, false) === 'late', 'הצריבה כבר התחילה — "בסוף אפשר להפיק מחדש"');
  ok(k(job('running', { srv: { hs: null } }), null, true) === null, 'בלי כתוביות צרובות — בלי כרטיס');
  ok(['failed', 'cancelled'].every((s) => k(job(s), null, true) === null), 'נכשלה / בוטלה — בלי כרטיס');
  ok(k(job('running', { spec: { ka: 1 } }), null, true) === null && k(job('running', { spec: { ph: 1 } }), null, true) === null
    && k(job('running', { spec: { src: 'subs' } }), null, true) === null && k(job('running', { srv: { kind: 'rr' } }), null, true) === null, 'קריוקי / בטלפון / מקובץ כתוביות / הפקה מחדש עצמה — בלי כרטיס');
  ok(k(job('done'), null, true) === 'rr', 'מוכן בלי רקע כהה — המלצה בולטת: הפקה מחדש עם רקע כהה');
  ok(k(job('done', { srv: { sx: 5 } }), null, true) === 'gone', 'המקור נמחק — ההמלצה בלי כפתור הפקה מחדש');
  const v = (n, lk, okv) => ({ hs: Object.assign({}, good, { v: { n, lk, ok: okv } }) });
  ok(k(job('done', { spec: { sty: { bx: 1 } }, srv: v(164, 0, 1) }), null, true) === 'ok:164', 'רקע כהה + הבדיקה נקייה — "✓ נבדק ב־164 פריימים"');
  ok(k(job('done', { spec: { sty: { bx: 1 } }, srv: v(80, 3, 0) }), null, true) === 'bad:80', 'הבדיקה עוד מצאה שרידים — אומרים את זה');
  ok(k(job('done', { spec: { sty: { bx: 1 } }, srv: v(0, 0, 0) }), null, true) === 'nochk', 'הבדיקה לא רצה — "כוסו", בלי "נבדק"');
  ok(k(job('done', { spec: { sty: { bx: 1 } } }), null, true) === null, 'רקע כהה בלי תוצאת הסתרה (עובד ישן / נכשל) — לא מכריזים "הוסתרו"');
  const rr = (state, o) => ({ spec: Object.assign({ sty: { bx: 1 } }, o && o.spec), srv: Object.assign({ state, kind: 'rr' }, o && o.srv) });
  ok(k(job('done'), rr('running'), true) === 'rrrun', 'ההפקה מחדש עם רקע כהה רצה — "מפיקים מחדש"');
  ok(k(job('done'), rr('running', { spec: { sty: null } }), true) === 'rr', 'הפקה מחדש בלי רקע כהה — ההמלצה נשארת');
  ok(k(job('done'), rr('done', { srv: v(120, 0, 1) }), true) === 'ok:120', 'ההפקה מחדש הסתיימה ונבדקה — התוצאה שלה (האחרונה)');

  /* ---------- 3. הנגן ---------- */
  ok(ST.hsPlayBurned(job('done', { spec: { sty: { bx: 1 } }, srv: v(164, 0, 1) })), 'הוסתרו — הנגן מנגן את הקובץ שנבדק (לא המקור עם שכבה מעליו)');
  ok(!ST.hsPlayBurned(job('done', { spec: { sty: { bx: 1 } }, srv: Object.assign(v(164, 0, 1), { ev: 2 }) })), 'אחרי עריכה — המקור (בצרוב הנוסח הישן)');
  ok(!ST.hsPlayBurned(job('done')), 'בלי הסתרה — כרגיל');

  /* ---------- 4. החיבור בממשק ---------- */
  const sj = read('studio.js');
  ok(/hs: normHs\(s\.hs\),/.test(sj), 'השדה מהשרתון נשמר בעבודה בטלפון');
  ok(/const hsc = hsCard\(rec\);[^\n]*\n  if \(hsc\) p\.append\(hsc\);\n  const cpc = cpCard\(rec\);/.test(sj), 'הכרטיס בדף העבודה — למעלה, לפני התוצאות');
  const card = sj.slice(sj.indexOf('function hsCard(rec)'), sj.indexOf('function towerLine(rec)'));
  ok(!/close|'x'|ico\('x'\)|dismiss/.test(card), 'בכרטיס אין כפתור סגירה');
  ok(/jobStySet\(rec, \{ bx: 1 \}\)/.test(card) && /bx: 1 \}\)\); go\('rr', rec\.id\)/.test(card), '"להפעיל רקע כהה" — בעבודה עצמה; בסוף — הפקה מחדש עם רקע כהה');
  ok(/'job\|' \+ \(r \? one\(r\) \+ hsSig\(r\)/.test(sj), 'הכרטיס מופיע באמצע העבודה ברגע שהבדיקה המהירה מצאה (מפתח הציור)');
  ok(/const hid = !!bo && hsPlayBurned\(rec\);/.test(sj) && /const src = srcId && !hid \?/.test(sj), 'הנגן: הקובץ הצרוב כשהוסתרו');
  for (const kk of ['studioHsT', 'studioHsS', 'studioHsGo', 'studioHsOnT', 'studioHsOnS', 'studioHsLate', 'studioHsRrS', 'studioHsRr', 'studioHsGone', 'studioHsRrRun', 'studioHsDone', 'studioHsChk', 'studioHsBadT', 'studioHsBad', 'studioHsNoChk']) {
    ok(sj.includes("'" + kk + "'"), 'בשימוש: ' + kk);
  }
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
