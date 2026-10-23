#!/usr/bin/env node
/* שדרוג אוטומטי של השרת הקיים ל־CX53 בלי שרת חדש (Rescale) — workflow ‏upgrade.yml. 23/10/2026, בקשת המשתמש
 * ("שכל התהליך יהיה אוטומטי לגמרי", "לפי כל התובנות והניסיון שלנו").
 *
 * למה לא שרת חדש: מכסת החשבון ב־Hetzner = 20 vCPU (Limits; "too new to request a limit increase"). השרת הקיים (CX43)
 * תופס 8, ו־CX53 חדש עוד 16 = 24 → ההזמנה של autobuy נעצרה ב־403 resource_limit_exceeded (23/10, Issue ‏#234).
 * Rescale מחליף את השרת עצמו: 8 → 16, סך הכול 16 מתוך 20. אותו שם, אותה כתובת, אותו דיסק, בלי מעבר נתונים.
 *
 * מה התיעוד הרשמי אומר (cloud.spec.json, נבדק 23/10/2026):
 *   change_type — השרת חייב להיות כבוי; Hetzner מעתיק את הדיסק ומדליק אותו בעצמו. upgrade_disk=false = אפשר לחזור
 *                 ל־CX43 אחר כך (ההגדלה של הדיסק בלתי הפיכה) — לכן false. המחיר זהה.
 *   shutdown    — ACPI מסודר; הצלחת הפעולה = הבקשה נשלחה, לא שהשרת כבה → בודקים את status עד off. poweroff רק כגיבוי.
 *   זמינות      — server_type.locations[].available (במיקום של השרת עצמו — שרת לא עובר מיקום).
 *
 * מה למדנו בקוד שלנו (CLAUDE.md סעיף 18) — וזה מה שמונע נזק:
 *   1. הפעלה מחדש באמצע עבודה = worker_lost (/state נמחק, lostOnBoot). לכן קודם משהים (paused — השרתון לא נותן
 *      עבודה לשרת מושהה, op:'poll') ומחכים שאין עבודה רצה או שנלקחה: גם לפי המסמך של השרת (job, hb.nj, hb.busy)
 *      וגם לפי מסמכי העבודות (running / נלקחה).
 *   2. עבודה בתור בלי שרת 6 שעות = no_server. לכן ההמתנה לסיום מוגבלת (DRAIN), ולא משהים כשיש עבודה שכבר מחכה
 *      יותר מ־QUEUE_OLD — מחכים שתילקח.
 *   3. אחרי ההדלקה הקונטיינרים עולים עם המגבלות הישנות (restart: unless-stopped), ו־snb-update (2–3 דק׳ אחרי
 *      העלייה) בונה אותם מחדש לפי הזיכרון והליבות החדשים (snb_limits) — עבודה שתתחיל ביניהם תיקטע. לכן ההשהיה יורדת
 *      רק כשהעובד מדווח על תקרת הזיכרון החדשה (hb.mx) — או בתום LIM_MAX עם אזהרה (השרת עובד גם בלי, רק בגבולות הישנים).
 *   4. ההשהיה יורדת תמיד: finally בתהליך, צעד always ב־workflow (release), ובתחילת כל ריצה. רק מה שאנחנו השהינו
 *      (upz = מתי) — שרת שהמנהל השהה ביד נשאר מושהה.
 *
 * כסף: אותו מתג ואותה תקרה של ההזמנה האוטומטית — SNB_AUTOBUY=on (ב־workflow) ו־SNB_AUTOBUY_MAX (מחיר לחודש כולל
 * IPv4, במטבע של החשבון, מה־API — נבדק שוב רגע לפני הכיבוי). המשתמש אישר: CX53 ‏$34.99 מול CX43 ‏$18.49 (+$16.50).
 *
 * פקודות:
 *   check   — בלי שום שינוי: השרת, המיקום, מלאי ומחיר CX53 שם, מצב השרתים והעבודות.
 *   watch N — לולאה עד N דקות. GITHUB_OUTPUT: upgraded=1 (+warn=<קוד>) | stopped=<קוד>.
 *   release — מסיר השהיה שנשארה מריצה קודמת (רק upz).
 * כל ערך סודי — רק בזיכרון. */
'use strict';
const path = require('path');
const P = require('./server-provision.js');
const A = require('./server-autobuy.js');
const S = require(path.join(__dirname, '..', 'ibkr-proxy/lib/studio.js'));

const UP = {
  from: 'cx43', to: 'cx53',
  every: 60e3,               // בדיקת מלאי — כל דקה (קריאה אחת ל־Hetzner)
  drainEvery: 30e3,          // בזמן ההמתנה לעבודות
  DRAIN: 2 * 3600e3,         // המתנה לסיום עבודות — עד שעתיים, אחרת מסירים השהיה ומנסים מאוחר יותר
  QUEUE_OLD: 90 * 60e3,      // עבודה שמחכה בתור יותר מזה — לא משהים: השהיה עד DRAIN + TAIL (~3:40), ו־no_server אחרי 6 שעות
  OFF_MAX: 5 * 60e3,         // כיבוי מסודר — עד 5 דק׳, ואז poweroff
  ACT_MAX: 40 * 60e3,        // change_type (העתקת הדיסק) — עד 40 דק׳
  RUN_MAX: 10 * 60e3,        // השרת חוזר ל־running אחרי change_type
  UP_MAX: 20 * 60e3,         // healthz של השרתונים אחרי ההדלקה
  LIM_MAX: 25 * 60e3,        // המגבלות החדשות בעובד (snb-update; כולל משיכה של תמונה חדשה אם יש)
  SETTLE: 4 * 60e3,          // עובד בלי hb.mx (סוכן ישן): לפחות זה אחרי העלייה — snb-update רץ 2–3 דק׳ אחריה
  TAIL: 110 * 60e3,          // מה שצריך אחרי ההמתנה לעבודות (כיבוי 7 + Rescale 40 + חזרה 10 + שרתונים 20 + מגבלות 25 דק׳)
  RETRY_GAP: 30 * 60e3,      // אחרי ניסיון שנכשל על מלאי — לא לפני
  TRIES: 2,                  // ניסיונות Rescale בריצה (כל ניסיון = כיבוי והדלקה)
  MX_GROW: 1.5,              // תקרת הזיכרון בעובד אחרי: לפחות פי 1.5 מלפני (CX43 ~8.4GB → CX53 ~21GB)
  poll: 5e3,
};
const MONEY_RE = /^\d{1,4}(\.\d{1,2})?$/;
/* קודים של Hetzner ל־change_type שאומרים "לא עכשיו" (המפרט): אין מלאי בפועל, תחזוקה, פעולה אחרת רצה, שינוי באמצע.
   השרת מודלק בחזרה כמו שהיה, ומנסים שוב אחרי RETRY_GAP (עד TRIES בריצה). כל קוד אחר — עצירה */
const LATER_CODES = ['resource_unavailable', 'maintenance', 'locked', 'conflict'];
/* תקלה רגעית (רשת, 429, 5xx — של Hetzner או של Firestore): מנסים שוב, לא עוצרים */
const transient = (x) => !x || !x.code || /^(hcloud|fs_http)_(429|5\d\d)$/.test(x.code);
function fail(code, msg, extra) { const e = new Error(msg || code); e.code = code; if (extra) Object.assign(e, extra); throw e; }

/* ---------------------------------------------------------------- Hetzner */

/* השרת היחיד בפרויקט. יותר משרת אחד = לא מנחשים לאיזה מהם השרתים של הסטודיו שייכים → עצירה */
async function theServer(e, deps) {
  const list = (await P.hc(deps, e, 'GET', '/servers?per_page=50')).servers || [];
  if (list.length !== 1) fail('many_servers', 'בפרויקט ' + list.length + ' שרתים — השדרוג האוטומטי מניח שרת אחד');
  return srvView(list[0]);
}
/* המיקום: server.location.name (המפרט הנוכחי, נבדק 23/10/2026 — אין עוד datacenter בשרת, מאז ש־/v1/datacenters הוסר
   ב־1/10/2026). datacenter.location — רק גיבוי לתשובה ישנה */
function srvView(s) {
  const loc = (s.location && s.location.name) || (s.datacenter && s.datacenter.location && s.datacenter.location.name) || '';
  return { id: s.id, name: s.name, status: s.status, type: s.server_type && s.server_type.name, cores: s.server_type && Number(s.server_type.cores), loc };
}
/* בזמן המתנה (שרת כבוי, Rescale) תקלה רגעית ב־API לא מפילה — מנסים שוב עד 6 פעמים */
async function soft(deps, fn) {
  for (let i = 0; ; i++) {
    try { return await fn(); } catch (x) { if (!transient(x) || i >= 5) throw x; await deps.sleep(UP.poll * 2); }
  }
}
async function serverNow(e, deps, id) { return srvView((await soft(deps, () => P.hc(deps, e, 'GET', '/servers/' + id))).server || {}); }

/* פעולה של Hetzner — ממתינים לסיומה. כישלון = שגיאה עם קוד הפעולה */
async function action(e, deps, p, body, max) {
  const a = (await P.hc(deps, e, 'POST', p, body || {})).action;
  if (!a || !a.id) fail('action', 'Hetzner לא החזיר פעולה (' + p + ')');
  const until = deps.now() + (max || UP.ACT_MAX);
  while (deps.now() < until) {
    const cur = (await soft(deps, () => P.hc(deps, e, 'GET', '/actions/' + a.id))).action || {};
    if (cur.status === 'success') return;
    if (cur.status === 'error') fail('action_error', 'הפעולה נכשלה ב־Hetzner (' + ((cur.error || {}).code || '?') + ')', { hcode: (cur.error || {}).code || '' });
    await deps.sleep(UP.poll);
  }
  fail('action_timeout', 'הפעולה לא הסתיימה בזמן (' + p + ')');
}

async function waitStatus(e, deps, id, want, max) {
  const until = deps.now() + max;
  while (deps.now() < until) {
    if ((await serverNow(e, deps, id)).status === want) return true;
    await deps.sleep(UP.poll);
  }
  return false;
}

/* כיבוי מסודר (ACPI). השרת לא כבה בזמן → poweroff (כמו לנתק חשמל — רק כגיבוי) */
async function powerDown(e, deps, srv) {
  if ((await serverNow(e, deps, srv.id)).status === 'off') return 'off';
  await action(e, deps, '/servers/' + srv.id + '/actions/shutdown', null, 2 * 60e3);
  if (await waitStatus(e, deps, srv.id, 'off', UP.OFF_MAX)) return 'shutdown';
  await action(e, deps, '/servers/' + srv.id + '/actions/poweroff', null, 5 * 60e3);
  if (await waitStatus(e, deps, srv.id, 'off', 5 * 60e3)) return 'poweroff';
  fail('no_off', 'השרת לא כבה');
}

/* השרת דולק (אחרי Rescale Hetzner מדליק בעצמו; אחרי כישלון — מדליקים) */
async function powerUp(e, deps, id) {
  const st = (await serverNow(e, deps, id)).status;
  if (st === 'running') return;
  if (st === 'off') await action(e, deps, '/servers/' + id + '/actions/poweron', null, 5 * 60e3);
  if (!(await waitStatus(e, deps, id, 'running', UP.RUN_MAX))) fail('no_on', 'השרת לא חזר לפעול');
}

/* זמינות ומחיר של CX53 במיקום של השרת — אותו חישוב של ההזמנה האוטומטית (כולל IPv4) */
async function target(e, deps, loc, pr) {
  const p = await A.typeInfo(e, deps, UP.to, pr);
  return { avail: !!p.avail[loc], price: A.total(p, loc), currency: p.currency };
}

/* ---------------------------------------------------------------- Firestore (שני הפרויקטים) */

const ENVS = () => [P.ENVS.prod, P.ENVS.stg];
async function fsReq(e, deps, env, method, p, body) {
  const tok = await P.fsToken(e, env, deps);
  const r = await deps.fetch(P.fsBase(env.project) + p, { method, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  if (r.status !== 200) fail('fs_http_' + r.status, 'Firestore החזיר ' + r.status + ' (' + env.project + ')');
  return r.json();
}

/* כל השרתים של הסטודיו (studioServers) בפרויקט */
async function servers(e, deps, env) {
  const j = await fsReq(e, deps, env, 'GET', '/studioServers?pageSize=100');
  return (j.documents || []).map((d) => Object.assign(S.fromFields(d.fields), { id: d.name.split('/').pop(), env: env.project }));
}

/* עבודות במצב אחד (runQuery עם שוויון אחד — בלי אינדקס, כמו השרתון) */
async function jobsIn(e, deps, env, state) {
  const j = await fsReq(e, deps, env, 'POST', ':runQuery', { structuredQuery: {
    from: [{ collectionId: 'studioJobs' }],
    where: { fieldFilter: { field: { fieldPath: 'state' }, op: 'EQUAL', value: { stringValue: state } } }, limit: 300 } });
  return (Array.isArray(j) ? j : []).filter((x) => x && x.document).map((x) => Object.assign(S.fromFields(x.document.fields), { id: x.document.name.split('/').pop() }));
}

/* שדות בודדים בלבד (updateMask) — השרתון כותב באותו מסמך seen/hb/job, ואסור לדרוס אותם */
async function patchSrv(e, deps, env, id, obj) {
  const q = Object.keys(obj).map((k) => 'updateMask.fieldPaths=' + k).join('&');
  return fsReq(e, deps, env, 'PATCH', '/studioServers/' + encodeURIComponent(id) + '?' + q, { fields: S.toFields(obj) });
}

const online = (s, now) => s.seen > 0 && now - s.seen < S.SRV_ONLINE_MS;
const hbOf = (s) => (s.hb && typeof s.hb === 'object' ? s.hb : {});

/* תמונת מצב: השרתים המחוברים (= השרת שלנו — יש אחד), מה רץ עליהם, ומה מחכה בתור */
async function snapshot(e, deps) {
  const now = deps.now(), out = { srv: [], busy: [], oldQueue: 0 };
  for (const env of ENVS()) {
    const list = (await servers(e, deps, env)).filter((s) => online(s, now));
    out.srv.push(...list);
    // לפי הדופק (hb — מתעדכן בכל פנייה, גם בזמן השהיה): nj רק כשיש עבודות, busy = מזהה העבודה.
    // לא לפי job במסמך: בזמן השהיה השרתון כותב רק seen ו־hb, ו־job לא מתנקה כשהעבודה נגמרת (op:'poll') —
    // ההמתנה הייתה נמשכת עד סוף DRAIN בכל ניסיון. job רק למסמך בלי hb בכלל (סוכן ישן)
    for (const s of list) {
      const hb = hbOf(s), hasHb = !!(s.hb && typeof s.hb === 'object');
      if (hb.nj > 0 || hb.busy || (!hasHb && s.job)) out.busy.push(env.project + ':' + s.id);
    }
    // עבודה שרצה או שנלקחה (sid + pk) אצל אחד השרתים — גם כשהמסמך של השרת עוד לא התעדכן
    for (const j of await jobsIn(e, deps, env, 'running')) {
      if (j.eng === 'api' && j.sid && now - (j.updated || 0) < S.STALE_MS) out.busy.push(env.project + ':' + j.id);
    }
    for (const j of await jobsIn(e, deps, env, 'queued')) {
      if (j.eng !== 'api' || S.effState(j, now).state !== 'queued') continue;
      if (j.sid && j.pk) { out.busy.push(env.project + ':' + j.id); continue; }   // נלקחה, עוד לא התחילה
      if (!j.vw && j.fired && now - j.fired > UP.QUEUE_OLD) out.oldQueue++;
    }
  }
  return out;
}

/* השהיה: רק שרתים שלא מושהים (upz = מתי השהינו — כך יודעים מה להחזיר, גם אחרי ריצה שנקטעה) */
async function cordon(e, deps, list) {
  const now = deps.now(), done = [];
  for (const s of list) {
    if (s.paused) continue;
    const env = ENVS().find((x) => x.project === s.env);
    await patchSrv(e, deps, env, s.id, { paused: true, upz: now });
    done.push(s.env + ':' + s.id);
  }
  return done;
}

/* מסירים השהיה רק ממה שאנחנו השהינו (upz > 0). שרת שהמנהל השהה ביד — לא נוגעים */
async function release(e, deps) {
  let n = 0;
  for (const env of ENVS()) {
    for (const s of await servers(e, deps, env)) {
      if (!(s.upz > 0)) continue;
      await patchSrv(e, deps, env, s.id, { paused: false, upz: 0 });
      n++;
    }
  }
  return n;
}

/* ---------------------------------------------------------------- השרתונים */

async function healthOnce(deps) {
  for (const env of ENVS()) {
    let ok = false;
    try { const r = await deps.fetch(env.api + '/healthz', { cache: 'no-store' }); ok = r.status === 200 && (await r.text()).trim() === 'ok'; } catch (x) { /* לא */ }
    if (!ok) return env.api;
  }
  return '';
}
async function healthWait(deps, max) {
  const until = deps.now() + max;
  let bad = '';
  while (deps.now() < until) {
    bad = await healthOnce(deps);
    if (!bad) return '';
    await deps.sleep(20e3);
  }
  return bad || 'timeout';
}

/* אחרי ההדלקה: כל שרת סטודיו שהיה מחובר — שאל מחדש (seen אחרי העלייה), ותקרת הזיכרון של הקונטיינר גדלה
   (snb-update בנה אותו מחדש לפי snb_limits). זה האות שהקונטיינר שיקבל עבודה הוא הסופי.
   (לא לפי hb.cpu: הזיקה לליבות לא משתנה עם cpus של docker, ותחת gVisor לא ודאי מה היא מראה) */
async function limitsWait(e, deps, before, t0, tUp) {
  const until = deps.now() + UP.LIM_MAX;
  let left = before.map((s) => s.env + ':' + s.id);
  while (deps.now() < until) {
    const now = deps.now(), all = [];
    try { for (const env of ENVS()) all.push(...await servers(e, deps, env)); } catch (x) { if (!transient(x)) throw x; await deps.sleep(20e3); continue; }
    left = before.filter((b) => {
      const s = all.find((x) => x.env === b.env && x.id === b.id);
      if (!s || !(s.seen > t0) || !online(s, now)) return true;
      const hb = hbOf(s), hb0 = hbOf(b);
      return hb0.mx > 0 ? !(hb.mx >= hb0.mx * UP.MX_GROW) : now < tUp + UP.SETTLE;
    }).map((s) => s.env + ':' + s.id);
    if (!left.length) return [];
    await deps.sleep(20e3);
  }
  return left;
}

/* ---------------------------------------------------------------- התהליך */

/* ניסיון אחד: השהיה → המתנה לעבודות → בדיקה אחרונה → כיבוי → Rescale → אימות. ההשהיה יורדת בכל מקרה.
   מחזיר {upgraded, warn} | {later:'סיבה'} (להמשיך לחכות) | זורק (עצירה) */
async function attempt(e, deps, srv, maxUsd, until, pr) {
  const snap = await snapshot(e, deps);
  if (!snap.srv.length) return { later: 'אף שרת של הסטודיו לא מחובר — לא נוגעים בשרת שלא ידוע מה מצבו' };
  if (snap.oldQueue) return { later: 'עבודה מחכה בתור יותר משעה וחצי — מחכים שתילקח' };
  const bad0 = await healthOnce(deps);
  if (bad0) return { later: 'השרתון לא עונה עוד לפני השדרוג (' + bad0 + ')' };
  // מרגע ההשהיה, כל "אחר כך" = הפסקה של RETRY_GAP לפני ניסיון הבא (cordoned) — אחרת הלולאה משהה שוב בדקה הבאה,
  // והשרת מושהה כמעט תמיד: עבודות בתור לא נלקחות ומגיעות ל־no_server
  const later = (why, x) => Object.assign({ later: why, cordoned: true }, x || {});
  try {
    await cordon(e, deps, snap.srv);   // בתוך try: כתיבה שנכשלה אחרי מסמך אחד — finally מסיר גם אותו
    // המתנה לסיום עבודות (בלי עבודות חדשות — השרת מושהה)
    const drainBy = Math.min(deps.now() + UP.DRAIN, until - UP.TAIL);
    let s = snap;
    while (s.busy.length) {
      if (deps.now() >= drainBy) return later('עבודות לא הסתיימו בזמן (' + s.busy.length + ')');
      await deps.sleep(UP.drainEvery);
      s = await snapshot(e, deps);
    }
    // בדיקה אחרונה רגע לפני הכיבוי: עדיין CX43, עדיין במלאי, המחיר בתקרה, השרתונים עונים
    const cur = await serverNow(e, deps, srv.id);
    if (cur.type !== UP.from) fail('not_from', 'השרת כבר מסוג ' + cur.type);
    const t = await target(e, deps, srv.loc, pr);
    if (!t.avail) return later('המלאי נגמר בזמן ההמתנה');
    if (t.price == null || t.price > Number(maxUsd)) fail('price', 'המחיר ' + t.price + ' מעל התקרה ' + maxUsd);
    const bad1 = await healthOnce(deps);
    if (bad1) return later('השרתון לא עונה (' + bad1 + ')');
    const before = s.srv;            // עם hb.mx של לפני — להשוואה אחרי
    // כיבוי ו־Rescale
    const t0 = deps.now();
    await powerDown(e, deps, srv);
    try {
      await action(e, deps, '/servers/' + srv.id + '/actions/change_type', { server_type: UP.to, upgrade_disk: false }, UP.ACT_MAX);
    } catch (x) {
      await powerUp(e, deps, srv.id).catch(() => {});        // לא משאירים את השרת כבוי
      await healthWait(deps, UP.UP_MAX).catch(() => {});
      if (LATER_CODES.includes(x.hcode) || transient(x)) return later('Hetzner: ' + (x.hcode || x.code) + ' — השרת הודלק בחזרה כמו שהיה', { tried: true });
      throw x;
    }
    await powerUp(e, deps, srv.id);
    const tUp = deps.now();
    const after = await serverNow(e, deps, srv.id);
    if (after.type !== UP.to) fail('type_mismatch', 'אחרי השינוי הסוג הוא ' + after.type);
    const bad2 = await healthWait(deps, UP.UP_MAX);
    if (bad2) fail('no_health', 'השרתון לא עונה אחרי ההדלקה (' + bad2 + ')');
    const left = await limitsWait(e, deps, before, t0, tUp);
    return { upgraded: true, price: t.price, currency: t.currency, warn: left.length ? 'limits' : '' };
  } finally {
    // תמיד — גם בכישלון. אחרי Rescale: רק אחרי האימות (כאן), כך שעבודה לא מתחילה בקונטיינר שעוד יוחלף.
    // נכשל גם אחרי הניסיונות — צעד release ב־workflow (always) ותחילת הריצה הבאה מסירים
    await soft(deps, () => release(e, deps)).catch(() => {});
  }
}

async function watch(e, deps, opts = {}) {
  const until = deps.now() + (opts.minutes || 345) * 60e3;
  const maxUsd = String(e.SNB_AUTOBUY_MAX || '').trim();
  if (!MONEY_RE.test(maxUsd)) return { stop: 'no_max', why: 'לא הוגדרה תקרת מחיר (SNB_AUTOBUY_MAX) — לא משדרגים' };
  await release(e, deps).catch((x) => { if (!transient(x)) throw x; });   // השהיה שנשארה מריצה שנקטעה
  const srv = await theServer(e, deps);
  if (srv.type === UP.to) return { stop: 'done', why: 'השרת ' + srv.name + ' כבר ' + UP.to };
  if (srv.type !== UP.from) return { stop: 'not_from', why: 'השרת ' + srv.name + ' מסוג ' + srv.type + ' — לא ' + UP.from };
  if (!srv.loc) return { stop: 'no_loc', why: 'לא ידוע המיקום של השרת' };
  const pr = await A.pricing(e, deps);
  let n = 0, tries = 0, nextTry = 0, last = '';
  while (deps.now() < until) {
    n++;
    let t = null;
    try { t = await target(e, deps, srv.loc, pr); } catch (x) { if (!transient(x)) throw x; }
    if (t && t.avail) {
      if (t.price == null || t.price > Number(maxUsd)) return { stop: 'price', why: 'המחיר ב־' + srv.loc + ' הוא ' + t.price + ' ' + t.currency + ' — מעל התקרה (' + maxUsd + ')' };
      if (deps.now() >= nextTry && until - deps.now() > UP.TAIL + 5 * 60e3) {
        let r;
        try { r = await attempt(e, deps, srv, maxUsd, until, pr); } catch (x) { if (!transient(x)) throw x; r = { later: 'תקלה רגעית (' + x.code + ')', cordoned: true }; }
        if (r.upgraded) return Object.assign(r, { srv: srv.name, loc: srv.loc });
        last = r.later;
        if (r.tried && ++tries >= UP.TRIES) return { timeout: true, checks: n, last };
        if (r.cordoned) nextTry = deps.now() + UP.RETRY_GAP;
      }
    }
    if (deps.now() + UP.every >= until) break;
    await deps.sleep(UP.every);
  }
  return { timeout: true, checks: n, last };
}

async function check(e, deps) {
  const srv = await theServer(e, deps);
  const pr = await A.pricing(e, deps);
  const t = srv.loc ? await target(e, deps, srv.loc, pr) : null;
  let st = '';
  try {
    const s = await snapshot(e, deps);
    st = 'שרתי סטודיו מחוברים: ' + s.srv.length + ' · עבודות רצות/נלקחו: ' + s.busy.length + ' · בתור יותר מ־3 שעות: ' + s.oldQueue;
  } catch (x) { st = 'מצב העבודות: ✗ ' + x.message; }
  const h = await healthOnce(deps);
  return [
    'שרת: ' + srv.name + ' · ' + srv.type + ' · ' + (srv.loc || '?') + ' · ' + srv.status,
    UP.to + ' ב־' + (srv.loc || '?') + ': ' + (t ? (t.avail ? 'במלאי' : 'אזל') + ' · ' + (t.price == null ? '?' : t.price.toFixed(2)) + ' ' + t.currency + ' לחודש (כולל IPv4)' : '?'),
    'תקרה (SNB_AUTOBUY_MAX): ' + (MONEY_RE.test(String(e.SNB_AUTOBUY_MAX || '').trim()) ? e.SNB_AUTOBUY_MAX : 'לא הוגדרה'),
    st,
    'השרתונים: ' + (h ? '✗ ' + h : 'עונים'),
  ].join('\n');
}

if (require.main === module) {
  const fs = require('fs');
  const deps = { fetch: (...x) => fetch(...x), now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
  const cmd = process.argv[2];
  const out = (k, v) => { if (process.env.GITHUB_OUTPUT && /^[a-z]+$/.test(k) && /^[A-Za-z0-9._-]{1,60}$/.test(String(v))) fs.appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + v + '\n'); };
  (async () => {
    if (cmd === 'check') { console.log(await check(process.env, deps)); return; }
    if (cmd === 'release') { console.log('השהיות שהוסרו: ' + await release(process.env, deps)); return; }
    if (cmd === 'watch') {
      const r = await watch(process.env, deps, { minutes: Number(process.argv[3]) || 345 });
      if (r.upgraded) {
        out('upgraded', '1'); out('price', r.price); out('currency', r.currency || 'na'); out('location', r.loc);
        if (r.warn) out('warn', r.warn);
        console.log('✓ שודרג: ' + r.srv + ' ל־' + UP.to + ' · ' + r.loc + (r.warn ? ' · ⚠ ' + r.warn : ''));
      } else if (r.stop) { out('stopped', r.stop); console.log('■ ' + r.why); }
      else console.log('… עוד לא (' + r.checks + ' בדיקות' + (r.last ? ' · ' + r.last : '') + ') — הריצה הבאה ממשיכה');
      return;
    }
    fail('cmd', 'פקודה לא מוכרת');
  })().catch((err) => {
    out('stopped', String(err.hcode || err.code || 'error').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60));
    console.error('✗ ' + (err.message || err.code));
    process.exit(1);
  });
}

module.exports = { UP, LATER_CODES, transient, theServer, powerDown, powerUp, snapshot, cordon, release, healthOnce, limitsWait, attempt, watch, check };
