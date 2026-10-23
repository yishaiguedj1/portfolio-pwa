/* שדרוג אוטומטי של השרת הקיים ל־CX53 (Rescale) — tools/server-upgrade.js + .github/workflows/upgrade.yml. 23/10/2026.
   Hetzner, Firestore והשרתונים מדומים — בלי רשת, בלי סודות ובלי שינוי אמיתי. המדמה מתנהג לפי התיעוד הרשמי
   (change_type רק על שרת כבוי, ו־Hetzner מדליק אותו בעצמו; shutdown = רק נשלח) ולפי מה שקורה בשרת שלנו
   (הסוכן מדווח כל 20 שנ׳; snb-update בונה את הקונטיינרים מחדש עם הזיכרון החדש 2–3 דק׳ אחרי העלייה). */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const U = require('../tools/server-upgrade.js');
const S = require('../ibkr-proxy/lib/studio.js');

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (c) console.log('ok - ' + m); else { bad++; console.log('not ok - ' + m); } };
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const pem = privateKey.export({ type: 'pkcs8', format: 'pem' });
const SA = (p) => JSON.stringify({ type: 'service_account', project_id: p, client_email: 'x@' + p + '.iam.gserviceaccount.com', private_key: pem, token_uri: 'https://oauth2.googleapis.com/token' });
const PROD = 'yishaiguedj1-c786e', STG = 'snowball-staging-758f6';
const E = { HCLOUD_TOKEN: 'H'.repeat(64), PROD_FIREBASE_SA: SA(PROD), STG_FIREBASE_SA: SA(STG), SNB_AUTOBUY_MAX: '40' };
const T0 = Date.parse('2026-10-23T12:00:00Z');
const MIN = 60e3, HOUR = 3600e3;

/* העולם המדומה. o: avail(now), health(now), busyUntil, jobs, changeType {status, code} | {actionErr}, shutdownWorks,
   mxAfter, agentDelay, servers (יותר משרת אחד), type, adminPaused, leftover */
function world(o = {}) {
  const w = {
    now: T0, calls: [], acts: [], patches: [], badPatch: 0,
    srv: { id: 42, name: 'snb-cx43', status: 'running', type: o.type || 'cx43', cores: 8, loc: 'fsn1' },
    offAt: 0, runAt: 0, actN: 0, actions: {},
    docs: {
      [PROD]: { p1: { name: 'snb-cx43', seen: T0, paused: !!o.adminPaused, job: '', hb: { nj: 0, mx: 8458, cpu: 8 }, th: 'x' } },
      [STG]: { s1: { name: 'snb-cx43', seen: T0, paused: false, job: '', hb: { nj: 0, mx: 8458, cpu: 8 }, th: 'y' } },
    },
  };
  if (o.leftover) Object.assign(w.docs[STG].s1, { paused: true, upz: T0 - HOUR });
  const avail = o.avail || (() => true);
  const health = o.health || (() => true);
  const res = (status, j) => ({ status, json: async () => j, text: async () => (typeof j === 'string' ? j : JSON.stringify(j)) });
  const herr = (status, code) => res(status, { error: { code, message: code } });
  const status = () => {
    if (w.srv.status === 'stopping' && w.now >= w.offAt) w.srv.status = 'off';
    return w.srv.status;
  };
  const agent = () => {
    // הסוכן: כל עוד השרת דולק — מדווח; אחרי Rescale — הזיכרון החדש רק אחרי snb-update (agentDelay)
    if (status() !== 'running') return;
    const busy = o.busyUntil && w.now < o.busyUntil;
    for (const p of [PROD, STG]) {
      for (const d of Object.values(w.docs[p])) {
        if (o.agentDead) continue;
        d.seen = w.now;
        // כמו השרתון האמיתי (op:'poll' ב־api/studio.js): בזמן השהיה נכתבים רק seen ו־hb — job לא מתנקה.
        // וכמו הסוכן (host_info): nj רק כשיש עבודות, busy = מזהה העבודה
        const b = busy && p === PROD;
        if (b) d.job = 'JOB1'; else if (!d.paused) d.job = '';
        d.hb = Object.assign({}, d.hb, { busy: b ? 'JOB1' : '' });
        if (b && !o.busyNoNj) d.hb.nj = 1; else delete d.hb.nj;
        if (w.srv.type === 'cx53') { d.hb.cpu = 16; if (w.now >= w.runAt + (o.agentDelay == null ? 3 * MIN : o.agentDelay)) d.hb.mx = o.mxAfter || 20974; }
      }
    }
  };
  const fetch = async (url, init = {}) => {
    const m = init.method || 'GET';
    w.calls.push({ m, url, t: w.now });
    if (url === 'https://oauth2.googleapis.com/token') return res(200, { access_token: 'ya29.t', expires_in: 3600 });
    if (url.endsWith('/healthz')) return health(w.now, url) ? { status: 200, text: async () => 'ok' } : res(503, 'down');
    if (url.startsWith('https://firestore.googleapis.com/')) {
      const project = url.split('/projects/')[1].split('/')[0];
      agent();
      if (m === 'GET' && url.includes('/documents/studioServers?')) {
        return res(200, { documents: Object.entries(w.docs[project]).map(([id, d]) => ({ name: 'projects/' + project + '/databases/(default)/documents/studioServers/' + id, fields: S.toFields(d) })) });
      }
      if (m === 'PATCH' && url.includes('/documents/studioServers/')) {
        const id = decodeURIComponent(url.split('/studioServers/')[1].split('?')[0]);
        const mask = [...url.matchAll(/updateMask\.fieldPaths=([A-Za-z0-9_]+)/g)].map((x) => x[1]);
        if (!mask.length) { w.badPatch++; return res(400, {}); }
        w.patchN = (w.patchN || 0) + 1;
        if (o.patchFail && o.patchFail.includes(w.patchN)) return res(503, {});
        const got = S.fromFields(JSON.parse(init.body).fields);
        for (const k of mask) w.docs[project][id][k] = got[k];
        w.patches.push({ project, id, mask, v: got, t: w.now });
        return res(200, {});
      }
      if (m === 'POST' && url.endsWith(':runQuery')) {
        const st = JSON.parse(init.body).structuredQuery.where.fieldFilter.value.stringValue;
        const list = (o.jobs ? o.jobs(w.now, project) : []).filter((j) => j.state === st);
        return res(200, list.length ? list.map((j) => ({ document: { name: 'projects/' + project + '/databases/(default)/documents/studioJobs/' + j.id, fields: S.toFields(j) } })) : [{ readTime: 'x' }]);
      }
      return res(404, {});
    }
    if (url.startsWith('https://api.hetzner.cloud/v1')) {
      const p = url.slice('https://api.hetzner.cloud/v1'.length);
      if (o.flaky && p === '/servers/42' && o.flaky.length && o.flaky[0] <= w.now) { o.flaky.shift(); return herr(503, 'unavailable'); }
      // המבנה של המפרט הנוכחי: location בשרת עצמו, בלי datacenter (הוסר עם /v1/datacenters ב־1/10/2026)
      const view = () => ({ id: 42, name: w.srv.name, status: status(), server_type: { name: w.srv.type, cores: w.srv.cores }, location: { name: w.srv.loc } });
      if (m === 'GET' && p === '/servers?per_page=50') return res(200, { servers: [view()].concat(o.servers ? [{ id: 7, name: 'other', status: 'running', server_type: { name: 'cx23', cores: 2 }, location: { name: 'fsn1' } }] : []) });
      if (m === 'GET' && p === '/servers/42') return res(200, { server: view() });
      if (m === 'GET' && p === '/pricing') return res(200, { pricing: { currency: 'USD', primary_ips: [{ type: 'ipv4', prices: [{ location: 'fsn1', price_monthly: { gross: '0.60' } }] }] } });
      if (m === 'GET' && p === '/server_types?name=cx53') {
        return res(200, { server_types: [{ id: 99, name: 'cx53', memory: 32, cores: 16, locations: [{ name: 'fsn1', available: !!avail(w.now) }], prices: [{ location: 'fsn1', price_monthly: { gross: o.price || '34.99' } }] }] });
      }
      const act = p.match(/^\/servers\/42\/actions\/([a-z_]+)$/);
      if (m === 'POST' && act) {
        const a = act[1], body = init.body ? JSON.parse(init.body) : {};
        w.acts.push({ a, body, t: w.now, status: status() });
        if (a === 'shutdown') { if (o.shutdownWorks !== false && status() === 'running') { w.srv.status = 'stopping'; w.offAt = w.now + 40e3; } }
        else if (a === 'poweroff') w.srv.status = 'off';
        else if (a === 'poweron') { if (status() === 'off') { w.srv.status = 'running'; w.runAt = w.now; } }
        else if (a === 'change_type') {
          if (status() !== 'off') return herr(422, 'server_not_stopped');
          const ct = o.changeType && (typeof o.changeType === 'function' ? o.changeType(w) : o.changeType);
          if (ct && ct.status) return herr(ct.status, ct.code);
          if (!(ct && ct.actionErr)) { w.srv.type = body.server_type; w.srv.cores = 16; w.srv.status = 'running'; w.runAt = w.now; }
        }
        const id = ++w.actN;
        w.actions[id] = { a, err: o.changeType && o.changeType.actionErr && a === 'change_type' ? o.changeType.actionErr : '' };
        return res(201, { action: { id, status: 'running' } });
      }
      const ga = p.match(/^\/actions\/(\d+)$/);
      if (m === 'GET' && ga) {
        const x = w.actions[+ga[1]];
        return res(200, { action: x.err ? { id: +ga[1], status: 'error', error: { code: x.err } } : { id: +ga[1], status: 'success' } });
      }
      return res(404, {});
    }
    return res(404, {});
  };
  w.deps = { fetch, now: () => w.now, sleep: async (ms) => { w.now += ms; } };
  w.names = () => w.acts.map((x) => x.a);
  return w;
}
const paused = (w) => [w.docs[PROD].p1.paused, w.docs[STG].s1.paused];

(async () => {
  // ---------------- אין מלאי — לא נוגעים בכלום
  let w = world({ avail: () => false });
  let r = await U.watch(E, w.deps, { minutes: 20 });
  ok(r.timeout && w.acts.length === 0 && w.patches.length === 0, 'אין מלאי במיקום של השרת — בלי השהיה, בלי כיבוי');

  // ---------------- מלאי, אין עבודה — השדרוג המלא
  w = world();
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded === true && !r.warn, 'מלאי + אין עבודה → משודרג, בלי אזהרות');
  ok(JSON.stringify(w.names()) === JSON.stringify(['shutdown', 'change_type']), 'כיבוי מסודר → Rescale (Hetzner מדליק בעצמו — בלי poweron, בלי poweroff): ' + w.names().join(','));
  const ct = w.acts.find((x) => x.a === 'change_type');
  ok(ct && ct.body.server_type === 'cx53' && ct.body.upgrade_disk === false, 'change_type ל־cx53 עם upgrade_disk=false (אפשר לחזור ל־CX43)');
  ok(ct && ct.status === 'off', 'change_type נשלח רק כשהשרת כבר כבוי (status off)');
  ok(w.srv.type === 'cx53' && w.srv.status === 'running', 'בסוף: CX53 ודולק');
  const pz = w.patches.filter((x) => x.v.paused === true), rl = w.patches.filter((x) => x.v.paused === false);
  ok(pz.length === 2 && pz.every((x) => x.v.upz > 0), 'השהיה לשני השרתים (ייצור וניסוי), עם upz');
  ok(pz.every((x) => x.t <= ct.t), 'ההשהיה לפני הכיבוי');
  ok(rl.length === 2 && rl.every((x) => x.t >= w.runAt + 3 * MIN), 'ההשהיה יורדת רק אחרי שהעובד מדווח על הזיכרון החדש (אחרי snb-update)');
  ok(w.badPatch === 0 && w.patches.every((x) => JSON.stringify(x.mask) === JSON.stringify(['paused', 'upz'])), 'כל כתיבה ל־Firestore עם updateMask של paused/upz בלבד (seen/hb/job של השרתון לא נדרסים)');
  ok(paused(w).every((x) => x === false), 'בסוף שני השרתים לא מושהים');

  // ---------------- עבודה רצה — משהים ומחכים שתסתיים
  w = world({ busyUntil: T0 + 40 * MIN });
  r = await U.watch(E, w.deps, { minutes: 345 });
  const sd = w.acts.find((x) => x.a === 'shutdown');
  ok(r.upgraded && sd && sd.t >= T0 + 40 * MIN, 'עבודה רצה → השהיה, ממתינים לסיום, ורק אז כיבוי');
  ok(sd && sd.t < T0 + 45 * MIN, 'הכיבוי תוך דקות מסוף העבודה — גם כש־job במסמך של השרת לא מתנקה בזמן השהיה (רק hb): ' + (sd ? Math.round((sd.t - T0) / MIN) + ' דק׳' : '-'));
  ok(w.patches[0] && w.patches[0].t < T0 + 40 * MIN, 'ההשהיה מתחילה מיד (עבודות חדשות לא נלקחות בזמן ההמתנה)');

  // ---------------- סוכן במצב עבודה אחת: רק hb.busy, בלי nj — עדיין עסוק
  w = world({ busyUntil: T0 + 30 * MIN, busyNoNj: true });
  r = await U.watch(E, w.deps, { minutes: 345 });
  const sd2 = w.acts.find((x) => x.a === 'shutdown');
  ok(r.upgraded && sd2 && sd2.t >= T0 + 30 * MIN && sd2.t < T0 + 35 * MIN, 'hb.busy בלי nj — מחכים לו, וממשיכים מיד כשהוא מתנקה');

  // ---------------- מסמך ישן בלי hb בכלל, עם job — נחשב עסוק (לא מסתמכים על הדופק שאין)
  w = world({ agentDead: true });
  for (const d of [w.docs[PROD].p1, w.docs[STG].s1]) { delete d.hb; d.seen = T0; }
  w.docs[PROD].p1.job = 'JOB9';
  const snapOld = await U.snapshot(E, w.deps);
  ok(snapOld.busy.length === 1 && snapOld.srv.length === 2, 'מסמך בלי hb עם job — עסוק');

  // ---------------- עבודה שלא נגמרת — לא מכבים, וההשהיה יורדת; ובין הניסיונות יש הפסקה
  w = world({ busyUntil: T0 + 100 * HOUR });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.timeout && w.acts.length === 0, 'עבודה ארוכה מהמתנה — לא מכבים את השרת');
  ok(paused(w).every((x) => x === false), 'ההשהיה יורדת אחרי ההמתנה');
  const cyc = w.patches.filter((x) => x.v.paused === true && x.project === PROD).map((x) => x.t);
  ok(cyc.length >= 1 && cyc.every((t, i) => i === 0 || t - cyc[i - 1] >= U.UP.DRAIN + U.UP.RETRY_GAP), 'אחרי ניסיון — לפחות 30 דק׳ בלי השהיה (עבודות בתור נלקחות)');
  const unp = w.patches.filter((x) => x.v.paused === false && x.project === PROD);
  ok(cyc.every((t) => unp.some((u) => u.t > t && u.t - t <= U.UP.DRAIN + MIN)), 'כל השהיה נמשכת לכל היותר DRAIN');

  // ---------------- עבודה שנלקחה (sid + pk) ועוד לא התחילה = עסוק
  w = world({ jobs: (now, p) => (p === PROD && now < T0 + 20 * MIN ? [{ id: 'j1', state: 'queued', eng: 'api', sid: 'p1', pk: T0 - MIN, fired: T0 - 2 * MIN, updated: T0 }] : []) });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded && w.acts[0].t >= T0 + 20 * MIN, 'עבודה שנלקחה ועוד לא התחילה — מחכים לה');

  // ---------------- עבודה "רצה" שלא דיווחה שעתיים (יתומה) — לא עוצרת את השדרוג
  w = world({ jobs: (now, p) => (p === PROD ? [{ id: 'j2', state: 'running', eng: 'api', sid: 'p1', updated: T0 - 3 * HOUR }] : []) });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded && w.acts[0].t < T0 + 10 * MIN, 'עבודה "רצה" בלי דיווח 3 שעות (STALE) — לא חוסמת');

  // ---------------- עבודת Routine (לא בשרת שלנו) — לא חוסמת
  w = world({ jobs: (now, p) => (p === PROD ? [{ id: 'j3', state: 'running', eng: '', sid: '', updated: now }] : []) });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded && w.acts[0].t < T0 + 10 * MIN, 'עבודת Routine (רצה אצל Claude, לא בשרת) — לא חוסמת');

  // ---------------- עבודה ממתינה בתור הרבה זמן — לא משהים (no_server)
  w = world({ jobs: (now, p) => (p === PROD && now < T0 + 50 * MIN ? [{ id: 'j4', state: 'queued', eng: 'api', sid: '', fired: T0 - 2 * HOUR, updated: T0 }] : []) });
  r = await U.watch(E, w.deps, { minutes: 345 });
  const p0 = w.patches[0];
  ok(r.upgraded && p0 && p0.t >= T0 + 50 * MIN, 'עבודה בתור יותר משעה וחצי — לא משהים עד שהיא נלקחת');
  ok(U.UP.QUEUE_OLD + U.UP.DRAIN + U.UP.TAIL < S.API_QUEUE_WAIT, 'גם במקרה הגרוע עבודה בתור לא מגיעה ל־no_server (QUEUE_OLD + DRAIN + TAIL < 6 שעות)');

  // ---------------- עבודה שמחכה לסרטון (vw) — לא חוסמת
  w = world({ jobs: (now, p) => (p === PROD ? [{ id: 'j5', state: 'queued', eng: 'api', sid: '', vw: T0 - 3 * HOUR, fired: T0 - 3 * HOUR, updated: T0 }] : []) });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded, 'עבודה שמחכה לסרטון (vw) — לא חוסמת (אין לה no_server)');

  // ---------------- מחיר מעל התקרה / בלי תקרה
  w = world();
  r = await U.watch(Object.assign({}, E, { SNB_AUTOBUY_MAX: '30' }), w.deps, { minutes: 30 });
  ok(r.stop === 'price' && w.acts.length === 0 && w.patches.length === 0, 'מחיר ($35.59 כולל IPv4) מעל התקרה 30 → עצירה, בלי לגעת');
  w = world();
  r = await U.watch(Object.assign({}, E, { SNB_AUTOBUY_MAX: '' }), w.deps, { minutes: 30 });
  ok(r.stop === 'no_max' && w.calls.length === 0, 'בלי SNB_AUTOBUY_MAX — לא פונים לשום מקום');
  w = world();
  r = await U.watch(Object.assign({}, E, { SNB_AUTOBUY_MAX: '35.59' }), w.deps, { minutes: 345 });
  ok(r.upgraded, 'תקרה בדיוק במחיר ($35.59 כולל IPv4) → משדרגים');

  // ---------------- כבר CX53 / שרת שני
  w = world({ type: 'cx53' });
  r = await U.watch(E, w.deps, { minutes: 30 });
  ok(r.stop === 'done' && w.acts.length === 0, 'השרת כבר CX53 → done, בלי פעולה');
  w = world({ servers: 2 });
  let threw = null;
  try { await U.watch(E, w.deps, { minutes: 30 }); } catch (x) { threw = x; }
  ok(threw && threw.code === 'many_servers' && w.acts.length === 0, 'יותר משרת אחד בפרויקט → עצירה (לא מנחשים)');

  // ---------------- השרתון לא עונה לפני — לא נוגעים
  w = world({ health: (now) => now > T0 + 2 * HOUR });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded && w.patches[0].t > T0 + 2 * HOUR, 'שרתון שלא עונה לפני השדרוג — לא משהים ולא מכבים עד שהוא תקין');

  // ---------------- אף שרת סטודיו לא מחובר — לא נוגעים
  w = world({ agentDead: true });
  w.docs[PROD].p1.seen = T0 - HOUR; w.docs[STG].s1.seen = T0 - HOUR;
  r = await U.watch(E, w.deps, { minutes: 30 });
  ok(r.timeout && w.acts.length === 0, 'העובדים לא מחוברים — לא משדרגים שרת שלא ידוע מה מצבו');

  // ---------------- כיבוי מסודר לא עובד → poweroff
  w = world({ shutdownWorks: false });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded && JSON.stringify(w.names()) === JSON.stringify(['shutdown', 'poweroff', 'change_type']), 'השרת לא כבה ב־5 דק׳ → poweroff, ואז Rescale');
  const sdT = w.acts[0].t, poT = w.acts[1].t;
  ok(poT - sdT >= U.UP.OFF_MAX, 'poweroff רק אחרי שחיכינו לכיבוי מסודר');

  // ---------------- Hetzner: אין מלאי בפועל (412) → מדליקים בחזרה, ממשיכים לחכות; אחרי שני ניסיונות — מפסיקים לריצה הזו
  w = world({ changeType: { status: 412, code: 'resource_unavailable' } });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.timeout && w.srv.type === 'cx43' && w.srv.status === 'running', '412 resource_unavailable → השרת חזר לפעול כ־CX43');
  ok(w.names().filter((x) => x === 'change_type').length === U.UP.TRIES, 'לכל היותר ' + U.UP.TRIES + ' ניסיונות בריצה (כל ניסיון = כיבוי)');
  ok(w.names().filter((x) => x === 'poweron').length === U.UP.TRIES, 'אחרי כל ניסיון שנכשל — poweron');
  const ctT = w.acts.filter((x) => x.a === 'change_type').map((x) => x.t);
  ok(ctT.length === 2 && ctT[1] - ctT[0] >= U.UP.RETRY_GAP, 'בין הניסיונות — לפחות 30 דק׳');
  ok(paused(w).every((x) => x === false), 'וההשהיה ירדה');

  // ---------------- תחזוקה אצל Hetzner (403 maintenance) — זמני: מדליקים בחזרה ומנסים שוב, ובפעם השנייה עובר
  let mt = 0;
  w = world({ changeType: () => (++mt === 1 ? { status: 403, code: 'maintenance' } : null) });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded && w.names().filter((x) => x === 'change_type').length === 2, '403 maintenance → השרת חוזר לפעול, ניסיון שני אחרי 30 דק׳ מצליח');
  ok(JSON.stringify(U.LATER_CODES) === JSON.stringify(['resource_unavailable', 'maintenance', 'locked', 'conflict']), 'הקודים הזמניים של change_type — לפי המפרט');

  // ---------------- Hetzner: מגבלת חשבון (403) → מדליקים בחזרה ועוצרים
  w = world({ changeType: { status: 403, code: 'resource_limit_exceeded' } });
  threw = null;
  try { await U.watch(E, w.deps, { minutes: 345 }); } catch (x) { threw = x; }
  ok(threw && threw.hcode === 'resource_limit_exceeded', '403 resource_limit_exceeded → עצירה עם הקוד');
  ok(w.srv.status === 'running' && w.srv.type === 'cx43' && paused(w).every((x) => x === false), 'והשרת דולק כמו שהיה, בלי השהיה');

  // ---------------- הפעולה עצמה נכשלה ב־Hetzner
  w = world({ changeType: { actionErr: 'server_error' } });
  threw = null;
  try { await U.watch(E, w.deps, { minutes: 345 }); } catch (x) { threw = x; }
  ok(threw && w.srv.status === 'running' && paused(w).every((x) => x === false), 'פעולת Rescale שנכשלה → השרת הודלק בחזרה, ההשהיה ירדה');

  // ---------------- המגבלות החדשות לא הגיעו (snb-update לא בנה מחדש) → אזהרה, וההשהיה יורדת בכל זאת
  w = world({ agentDelay: 100 * HOUR });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded && r.warn === 'limits' && paused(w).every((x) => x === false), 'הזיכרון בעובד לא גדל תוך 25 דק׳ → משודרג עם אזהרה limits, ההשהיה ירדה');

  // ---------------- סוכן ישן בלי hb.mx — לפחות SETTLE אחרי העלייה (snb-update רץ 2–3 דק׳ אחריה)
  w = world();
  delete w.docs[PROD].p1.hb.mx; delete w.docs[STG].s1.hb.mx;
  r = await U.watch(E, w.deps, { minutes: 345 });
  const rel0 = w.patches.filter((x) => x.v.paused === false);
  ok(r.upgraded && !r.warn && rel0.length === 2 && rel0.every((x) => x.t >= w.runAt + U.UP.SETTLE), 'בלי hb.mx — ההשהיה יורדת רק 4 דק׳ אחרי העלייה');

  // ---------------- השרתון לא חוזר אחרי ההדלקה
  w = world({ health: (now) => !(w.runAt && now >= w.runAt) });
  threw = null;
  try { await U.watch(E, w.deps, { minutes: 345 }); } catch (x) { threw = x; }
  ok(threw && threw.code === 'no_health' && paused(w).every((x) => x === false), 'השרתון לא עונה אחרי השדרוג → עצירה no_health (התראה), ההשהיה ירדה');

  // ---------------- תקלה רגעית ב־API של Hetzner בזמן ההמתנה — לא מפילה
  w = world({ flaky: [T0 + 1, T0 + 2, T0 + 3] });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded, '503 רגעי של Hetzner בזמן המעקב אחרי השרת — ממשיכים');

  // ---------------- שרת שהמנהל השהה ביד — נשאר מושהה
  w = world({ adminPaused: true });
  r = await U.watch(E, w.deps, { minutes: 345 });
  ok(r.upgraded && w.docs[PROD].p1.paused === true && w.docs[STG].s1.paused === false, 'שרת שהמנהל השהה ביד — לא מוסרת ממנו השהיה');
  ok(!w.patches.some((x) => x.id === 'p1'), 'ולא נוגעים בו בכלל');

  // ---------------- כתיבת ההשהיה נכשלה באמצע (מסמך אחד כבר מושהה) — מוסרת מיד, לא נשארת עד הריצה הבאה
  w = world({ patchFail: [2] });
  r = await U.watch(E, w.deps, { minutes: 345 });
  const firstPause = w.patches.find((x) => x.v.paused === true);
  const freed = firstPause && w.patches.find((x) => x.v.paused === false && x.id === firstPause.id && x.t >= firstPause.t);
  ok(freed && freed.t - firstPause.t < 2 * MIN, 'כתיבת השהיה שנכשלה באמצע — מה שכבר הושהה משתחרר מיד');
  ok(r.upgraded && paused(w).every((x) => x === false), 'ובניסיון הבא (אחרי ההפסקה) משודרג');

  // ---------------- השהיה שנשארה מריצה שנקטעה — יורדת בתחילת הריצה ובפקודה release
  w = world({ leftover: true, avail: () => false });
  r = await U.watch(E, w.deps, { minutes: 5 });
  ok(w.docs[STG].s1.paused === false && w.docs[STG].s1.upz === 0, 'השהיה שנשארה (upz) יורדת בתחילת כל ריצה');
  w = world({ leftover: true, adminPaused: true });
  const nrel = await U.release(E, w.deps);
  ok(nrel === 1 && w.docs[STG].s1.paused === false && w.docs[PROD].p1.paused === true, 'release מסיר רק את מה שהשהינו (upz), לא השהיה של המנהל');

  // ---------------- לא מתחילים כשאין מספיק זמן בריצה
  w = world();
  r = await U.watch(E, w.deps, { minutes: 90 });
  ok(r.timeout && w.patches.length === 0 && w.acts.length === 0, 'ריצה קצרה מדי לכל התהליך — לא מתחילים להשהות');

  // ---------------- check — בלי שום שינוי
  w = world();
  const txt = await U.check(E, w.deps);
  ok(/cx43 · fsn1/.test(txt) && /35\.59 USD/.test(txt) && /במלאי/.test(txt), 'check: השרת, המיקום, המחיר כולל IPv4 והמלאי');
  ok(w.acts.length === 0 && w.patches.length === 0, 'check לא משנה כלום');

  // ---------------- ה־workflow
  const wf = read('.github/workflows/upgrade.yml');
  ok(/^permissions: \{\}$/m.test(wf), 'workflow: permissions ריקות ברמת הקובץ');
  ok(/github\.ref == 'refs\/heads\/main'/.test(wf) && /vars\.SNB_AUTOBUY == 'on'/.test(wf), 'רק מ־main, ורק כשהמתג SNB_AUTOBUY דולק (אותו אישור לעלות)');
  ok(/SNB_AUTOBUY_MAX: \$\{\{ vars\.SNB_AUTOBUY_MAX \}\}/.test(wf), 'אותה תקרה: SNB_AUTOBUY_MAX');
  ok(/server-upgrade\.js release/.test(wf) && /if: always\(\)/.test(wf), 'צעד release תמיד (גם כשהריצה נכשלה או בוטלה)');
  ok(/server-upgrade\.js watch 345/.test(wf) && /timeout-minutes: 358/.test(wf), 'הלולאה 345 דק׳ < 358 של ה־job');
  ok(/gh workflow disable upgrade\.yml/.test(wf), 'אחרי שדרוג או עצירה — מכבה את עצמו');
  ok(/@\$GITHUB_REPOSITORY_OWNER/.test(wf), 'Issue עם אזכור (התראה לטלפון)');
  ok(/group: (server-)?upgrade/.test(wf) && /cancel-in-progress: false/.test(wf), 'ריצה אחת בכל רגע');
  for (const sec of wf.match(/secrets\.[A-Z_]+/g) || []) ok(['secrets.HCLOUD_TOKEN', 'secrets.PROD_FIREBASE_SA', 'secrets.STG_FIREBASE_SA'].includes(sec), 'רק הסודות הנחוצים: ' + sec);
  for (const u of wf.match(/uses:\s*\S+/g) || []) ok(/@[0-9a-f]{40}$/.test(u.split(/\s+/)[1]), 'action נעול ל־SHA');

  console.log('\n# ' + n + ' בדיקות, ' + bad + ' נכשלו');
  process.exit(bad ? 1 : 0);
})().catch((x) => { console.log('not ok - חריגה: ' + (x.stack || x)); process.exit(1); });
