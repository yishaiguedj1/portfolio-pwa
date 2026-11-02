/* 02/11/2026 — תוכנית איכות התרגום, PR1 (תשתית מדידה): דגלי ניסוי (xf) וזרועות של "הרץ גל", learnPull בעמודים,
   סימון הניסוי וההכרעה בין הטיוטות בפריט של המאגר, וזמן המעבד בציר הזמן (T8). בלי רשת ובלי נתונים אמיתיים */
const fs = require('fs');
const path = require('path');
const S = require('../ibkr-proxy/lib/studio.js');
const LC = require('../ibkr-proxy/lib/learncorpus.js');
const DL = require('../ibkr-proxy/lib/devlog.js');
const LP = require('../tools/learn-pull.js');
let n = 0, fail = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { fail++; console.log('FAIL - ' + m); } };
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

(async () => {
  /* ---------- 1. דגלי ניסוי — אותה רשימה סגורה בשרתון ובעובד ---------- */
  const py = /XF_KEYS = \(([^)]*)\)/.exec(R('translator/xflags.py'));
  const pyKeys = py ? py[1].split(',').map((x) => x.trim().replace(/'/g, '')).filter(Boolean) : [];
  ok(JSON.stringify(pyKeys) === JSON.stringify(S.XF_KEYS), 'XF_KEYS זהה בשרתון ובעובד (translator/xflags.py)');
  ok(JSON.stringify(S.normXf(['smf', 'zzz', 'smf', '-gq'])) === '["-gq","smf"]', 'normXf — רק דגלים מהרשימה, בלי כפולים, "-שם" מותר');
  ok(S.normXf([]) === null && S.normXf('smf') === null && S.normXf(null) === null, 'normXf — ריק / לא רשימה = null');

  /* ---------- 2. זרועות וסדר משולב ---------- */
  const srcs = Array.from({ length: 12 }, (_, i) => ({ id: 'g' + i }));
  const arms = S.normArms([{ mode: 'haiku-medium' }, { mode: 'haiku-high', xf: ['smf'] }], srcs.map((j) => j.id));
  const wv = S.waveOrder(srcs, arms);
  ok(wv.length === 24 && wv.every(([j, a, i], k) => j.id === 'g' + Math.floor(k / 2) && i === k % 2), 'waveOrder — 12 מקורות × 2 זרועות, בסדר משולב');
  { const src = { id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { eng: 'api', ph: 1, pw: 1, dur: 600, mode: 'haiku-medium' }, fa: { id: 'a' }, fph: { id: 'm' }, fpw: { id: 'w' }, folder: 'f' };
    const c = S.goldClone(src, 'jBBBBBBBBBBBBBBBBBBBB', 'u', 1, 'haiku-medium'), w = S.waveClone(src, 'jCCCCCCCCCCCCCCCCCCCC', 'u', 1, { mode: 'haiku-high', xf: [] }, 1), k = S.smokeJob(src, 'jDDDDDDDDDDDDDDDDDDDD', 'u', 1);
    ok(c.fph.id === 'm' && c.fpw.id === 'w' && w.fph.id === 'm' && k.fph.id === 'm', 'goldClone — תרגום בטלפון: המדידות והמילים עוברות לעותק (בלי זה upload_timeout אחרי 12 שעות)');
    ok(!('fph' in S.goldClone(Object.assign({}, src, { fph: null, fpw: null }), 'jEEEEEEEEEEEEEEEEEEEE', 'u', 1)), 'goldClone — בלי מדידות במקור: אין שדה ריק'); }
  ok(S.normArms([{ mode: 'nope' }], []) === null && S.normArms([{}, {}, {}, {}, {}], []) === null && S.normArms([{}, {}, {}, {}], []).length === 4 && S.normArms([], []) === null, 'normArms — מצב לא מוכר / יותר מ־4 / ריק = null');
  ok(S.normArms([{ src: ['x'] }], ['g0']) === null, 'normArms — רשימת מקורות בלי אף מקור מוכר = null');
  const a1 = S.normArms([{ src: ['g1', 'zz'] }], ['g0', 'g1']);
  ok(a1 && a1[0].mode === S.DEFAULT_MODE && a1[0].src.join() === 'g1' && S.waveOrder(srcs, a1).length === 1, 'normArms — בלי מצב = ברירת המחדל; מקור לא מוכר נזרק');
  const src0 = { id: 'jSRC', uid: 'u', kind: 'tr', state: 'done', folder: 'f', spec: { mode: 'haiku-high', out: ['compact'], xf: ['gq'], xe: { tl: 'low' } }, fa: { id: 'a' }, gd: { r: 'refs1234567890' } };
  const c = S.waveClone(src0, 'jNEW', 'u', 1, arms[1], 1);
  ok(c.spec.out.join() === 'srt' && JSON.stringify(c.spec.xf) === '["smf"]' && !c.spec.xe && c.wa === 1 && c.gs === 'jSRC' && c.spec.mode === 'haiku-high', 'waveClone — רק SRT, xf של הזרועה (לא של המקור), מספר הזרועה');
  const ab = S.normArms([{ mode: 'haiku-medium', bt: 1 }, { mode: 'haiku-medium', bt: true }], ['jSRC']);
  const apiSrc = Object.assign({}, src0, { spec: Object.assign({}, src0.spec, { eng: 'api', bt: 1 }) });
  ok(ab[0].bt === 1 && !ab[1].bt && S.waveClone(apiSrc, 'j1', 'u', 1, ab[0], 0).spec.bt === 1 && !S.waveClone(apiSrc, 'j2', 'u', 1, ab[1], 1).spec.bt
    && !S.waveClone(src0, 'j3', 'u', 1, ab[0], 0).spec.bt, 'זרוע בחצי מחיר (bt) — רק כשביקשו (1) ורק במנוע api; מהמקור לא עובר');
  ok(!S.goldClone(src0, 'jX', 'u', 1).spec.xf, 'goldClone — xf של המקור לא עובר להרצה רגילה');
  ok(S.publicJob(Object.assign({}, c, { created: 1, updated: 1 }), 2).wa === 1 && S.publicJob(Object.assign({}, src0, { created: 1, updated: 1 }), 2).wa === -1, 'publicJob — wa (‎-1 = לא בגל)');
  const api = R('ibkr-proxy/api/studio.js');
  ok(/body\.arms != null[\s\S]{0,400}isAdmin\(user\)\) return res\.status\(403\)/.test(api), 'goldRun עם arms — מנהל בלבד');
  ok(/const old = fin\.filter\(\(j\) => j\.gs\)[\s\S]{0,200}\.concat\(fin\.filter\(\(j\) => !j\.gs\)/.test(api), 'הניקוי לפני גל — קודם עותקי זהב ישנים, אחר כך עבודות רגילות');
  ok(/S\.goldMax\(true\) \* arms\.length/.test(api), 'התקרה של גל = goldMax × מספר הזרועות');
  ok(/if \(sp\.xe \|\| sp\.xg \|\| sp\.xf\) return null/.test(R('ibkr-proxy/lib/studio.js')), 'עבודה עם xf לא נכנסת לנורמת העלות');

  /* ---------- 3. learnPull בעמודים ---------- */
  const id = (k) => String(k).padStart(20, '0');
  ok(LC.pageArgs({ ci: 50 }).items === 20 && LC.pageArgs({ cs: -5, ci: 1 }).skip === 0 && LC.pageArgs({ cx: true }).list === true, 'pageArgs — ci עד 20, דילוג לא שלילי, cx');
  const pa = LC.pageArgs({ cl: [id(1), 'bad', id(1), id(2)] });
  ok(pa.ids.join() === [id(1), id(2)].join() && pa.items === 2 && pa.skip === 0, 'pageArgs — cl: רק מזהים תקינים, בלי כפולים');
  const keys = [
    { key: 'c/2026-10/' + id(3) + '.bin', lastModified: '2026-10-05T00:00:00Z' },
    { key: 'c/2026-10/' + id(2) + '.bin', lastModified: '2026-10-05T00:00:00Z' },
    { key: 'q/' + id(4) + '.bin', lastModified: '2026-11-01T00:00:00Z' },
    { key: 'c/2026-11/' + id(4) + '.bin', lastModified: '2026-11-02T00:00:00Z' },
    { key: 'e/2026-10/' + id(2) + '.bin', lastModified: '2026-10-09T00:00:00Z' },
  ];
  ok(LC.pageOrder(keys).map((k) => LC.parseKey(k.key).lid).join() === [id(4), id(2), id(3)].join() && LC.parseKey(LC.pageOrder(keys)[0].key).kind === 'q',
    'pageOrder — התור קודם, כל מזהה פעם אחת, שוויון בזמן — לפי המפתח');
  ok(/if \(body\.co === true\) \{[\s\S]{0,400}return res\.status\(200\)\.json\(\{ ok: true, v: LR\.LR_V, at: now, corpus \}\)/.test(api)
    && api.indexOf('if (body.co === true)') < api.indexOf('const { recs } = await learnLoad(deps, now);'), 'learnPull co — לפני learnLoad/checks: רק הטוקן והקורפוס');

  /* ---------- 4. tools/learn-pull.js ---------- */
  const o = LP.args(['--all', '--ids', id(1) + ',zz,' + id(2), '--skip', '3', '--page', '50', '--since', '2026-10', '--ids-file', 'x.txt']);
  ok(o.all && o.cl.join() === [id(1), id(2)].join() && o.cs === 3 && o.page === 20 && o.since === '2026-10' && o.idsFile === 'x.txt', 'learn-pull — הארגומנטים החדשים');
  ok(LP.args(['--since', 'bad']).since === '', 'learn-pull — --since רק בחודש תקין');
  const all = Array.from({ length: 7 }, (_, i) => ({ id: id(10 + i), q: 0, m: '2026-10' }));
  let calls = [], hit429 = false, slept = [];
  const fakeFetch = async (url, init) => {
    const b = JSON.parse(init.body);
    calls.push(b);
    if (b.co && !hit429) { hit429 = true; return { ok: false, status: 429, json: async () => ({ ok: false, error: 'rate_limited' }) }; }
    const items = (b.cl || []).map((x) => ({ id: x, cu: [] })).concat(b.cl && b.cl[0] === id(10) ? [{ id: id(10), cu: [] }] : []);
    return { ok: true, status: 200, json: async () => ({ ok: true, corpus: { on: true, items } }) };
  };
  const first = { corpus: { on: true, ids: all, items: [{ id: id(16), cu: [] }] } };
  const r = await LP.pullAll('https://api.example.test', 'snbL_' + 'x'.repeat(32), fakeFetch, { page: 3 }, first, async (ms) => { slept.push(ms); });
  ok(r.items.length === 7 && new Set(r.items.map((x) => x.id)).size === 7, 'pullAll — כל הפריטים, בלי כפילויות');
  ok(calls.every((b) => b.co === true && b.cl.length <= 3) && !calls.some((b) => b.cl.includes(id(16))), 'pullAll — עמודים לפי מזהה עם co, בלי מה שכבר הגיע');
  ok(slept.includes(LP.WAIT_429_MS), 'pullAll — אחרי 429 מחכים 61 שנ׳ ומנסים שוב');
  calls = []; hit429 = true;
  await LP.pullAll('https://x.vercel.app', 't', fakeFetch, {}, { corpus: { ids: all } }, async () => {});
  ok(calls.every((b) => b.cl.length <= LP.PAGE_VERCEL), 'pullAll — בכתובת של Vercel עמוד של 3');
  calls = [];
  const r2 = await LP.pullAll('https://api.example.test', 't', fakeFetch, { since: '2026-11' }, { corpus: { ids: all.concat([{ id: id(30), q: 1, m: '' }]) } }, async () => {});
  ok(r2.items.map((x) => x.id).join() === id(30), 'pullAll — --since: רק מהחודש, ועבודות בתור תמיד');
  ok(!/writeFileSync\([^)]*token/i.test(R('tools/learn-pull.js')), 'learn-pull — הטוקן לא נכתב לקובץ');

  /* ---------- 5. הפריט במאגר: סימון הניסוי וההכרעה בין הטיוטות ---------- */
  ok(JSON.stringify(LC.expMark({ spec: { xf: ['smf', 'BAD!'] }, gs: 'jGOLD0000000', wa: 1 })) === '{"xf":["smf"],"gs":"jGOLD0000000","wa":1}', 'expMark — xf, gs, wa כשדות מפורשים');
  ok(JSON.stringify(LC.expMark({ spec: {} })) === '{}', 'expMark — עבודה רגילה: בלי סימון');
  ok(/Object\.assign\(item, LC\.expMark\(job\)\)/.test(api), 'learnPut מוסיף את הסימון לכל פריט (לא רק במצב המלא)');
  const it = LC.normCorpus({ v: LC.LC_V, cu: [{ i: 1, s: 0, e: 1, en: 'a', d: 'ב' }], dual: { sg: 3, c: 9, b: 1, bc: 4, n: 50, pk: 'AB-', x: 'drop' } }, '2026-11', false);
  ok(it && JSON.stringify(it.dual) === '{"sg":3,"c":9,"b":1,"bc":4,"n":50,"pk":"AB-"}', 'normCorpus — dual: מספרים והכרעה לכל קטע (A/B/-)');
  ok(LC.normDual({ pk: 'A<script>' }) === null, 'normDual — הכרעה לא תקינה נזרקת');
  ok(/'pk': ''\.join\(pk_all\)/.test(R('translator/pipeline.py')) && /out\['dual'\] = \{k: du\[k\] for k in \('sg', 'c', 'b', 'bc', 'n', 'pk'\)/.test(R('translator/job.py')), 'העובד — ההכרעה לכל קטע נרשמת ונשלחת למאגר');
  ok(/_lc_answers\(\[td \/ 'fixes_review\.txt', td \/ 'fixes_rview\.txt'\]\)/.test(R('translator/job.py')), 'הצופה (fixes_rview) נכנס לקורפוס אחרי הביקורת');

  /* ---------- 6. T8 — זמן המעבד בציר הזמן ---------- */
  const lg = DL.normJobLog({ v: DL.DL_V, job: 'j' + '0'.repeat(20), rc: 0, tm: [['build', 1.8e9, 12.5, 'main', 900, 2, 30.4], ['align', 1.8e9, 3, 'main', 100, 1]] });
  const tm = lg && lg.tm;
  ok(tm && tm[0][6] === 30.4 && tm[1][6] === null, 'devlog — השדה השביעי (שניות מעבד) נשמר; בלי — null');
  ok(/return \[x\[:7\] for x in/.test(R('translator/agent.py')), 'agent.vt_timeline — לא חותך את זמן המעבד');

  /* ---------- "הרץ גל" במרכז הניהול — אותה רשימה ואותה תקרה כמו בשרתון ---------- */
  const adm = R('admin-app.js');
  const ak = /const XF_KEYS = (\[[^\]]*\]), GOLD_ARMS = (\d+);/.exec(adm);
  ok(ak && JSON.stringify(JSON.parse(ak[1].replace(/'/g, '"'))) === JSON.stringify(S.XF_KEYS) && +ak[2] === S.GOLD_ARMS, 'admin-app — XF_KEYS ו־GOLD_ARMS זהים לשרתון');
  ok(/api\('goldRun', \{ ok: true, arms: arms\.map/.test(adm) && /n > GOLD_MAX \* arms\.length/.test(adm), 'admin-app — הגל בקריאה אחת עם arms, ובתקרה GOLD_MAX × זרועות');
  ok(/function paintWave[\s\S]{0,4500}askConfirm\(/.test(adm), 'admin-app — אישור לפני הרצת גל');
  ok(/const armSrc = \(a\) =>/.test(adm) && /src: x\.map\(\(j\) => j\.id\)/.test(adm), 'admin-app — מקורות לכל זרוע (M1: זרועות על מקורות שונים)');

  console.log(`${n - fail}/${n}`);
  process.exit(fail ? 1 : 0);
})();
