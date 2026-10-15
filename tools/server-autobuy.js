#!/usr/bin/env node
/* הזמנה אוטומטית של שרת כשהוא חוזר למלאי (12/10/2026, בקשת המשתמש) — workflow ‏autobuy.yml.
 *
 * הבעיה: CX53 של Hetzner אוזל ונחטף תוך שעות, והמשתמש רוצה אותו בלי לשבת מול הטראקר.
 * הפתרון: בדיקה כל דקה ב־API של Hetzner עצמו (המקור שהטראקר קורא), וברגע שיש מלאי — אותה הקמה של
 * server-provision.js ‏(all: ייצור + ניסוי, כולל השרתון של הייצור), בלי לחיצת אישור.
 *
 * הזמינות: GET /v1/server_types?name=<סוג> → locations[].available. (‏/v1/datacenters מחזיר 410 מ־1/10/2026 —
 * changelog של Hetzner; "available" הוא רק אינדיקציה, ולכן גם resource_unavailable בהזמנה = ממשיכים לחכות.)
 *
 * פקודות:
 *   check — בלי הזמנה: המחיר לחודש במטבע של החשבון (‏/v1/pricing), המלאי עכשיו בכל מיקום, ובדיקה שכל הסודות
 *           קיימים ותקינים (שמות בלבד). זה מה שהמשתמש רואה לפני שהוא מדליק.
 *   watch — לולאה: כל דקה, עד הדדליין. נעצרת אם השרת כבר קיים (שם קבוע), אם המחיר עלה מעל התקרה שהמשתמש אישר
 *           (SNB_AUTOBUY_MAX), או אחרי הזמנה אחת. מדפיסה ל־GITHUB_OUTPUT רק: server, location, sid, sidp —
 *           או stopped=<קוד> בכל עצירה סופית (גם שגיאה). רק "עוד אין מלאי" משאיר את האוטומציה דולקת.
 *           קריאה אחת ל־Hetzner בדקה (המחירון — פעם אחת לריצה; "השרת קיים" — בהתחלה וכשיש מלאי).
 *
 * גבולות קשיחים: סוג אחד (AUTOBUY.type), מיקומים לפי הסדר (fsn1 ואז nbg1), שם אחד, לפחות 16GB, בלי שום
 * פעולה על שרת אחר. כל ערך סודי — רק בזיכרון (קוד ההקמה לא נכתב לדיסק). */
'use strict';
const fs = require('fs');
const path = require('path');
const P = require('./server-provision.js');

const ROOT = path.resolve(__dirname, '..');
const AUTOBUY = {
  type: 'cx53',                // CX53 בלבד — לא CX43/CPX/CCX/CAX (שמות דומים)
  locations: ['fsn1', 'nbg1'], // לפי הסדר; לא hel1 ולא מחוץ לאירופה
  name: 'snb-cx53',            // שם קבוע = שרת אחד לכל היותר (Hetzner לא מאפשר שני שרתים באותו שם)
  plan: 'all',
  every: 60e3,                 // כל דקה, כמו הטראקר
};
const MONEY_RE = /^\d{1,4}(\.\d{1,2})?$/;
function fail(code, msg) { const e = new Error(msg || code); e.code = code; throw e; }

/* המחירון של החשבון: המטבע ו־IPv4 לכל מיקום. נקרא פעם אחת לריצה (לא בכל דקה) */
async function pricing(e, deps) {
  const out = { currency: '', ipv4: {} };
  try {
    const pr = (await P.hc(deps, e, 'GET', '/pricing')).pricing || {};
    out.currency = String(pr.currency || '').slice(0, 3);
    for (const ip of pr.primary_ips || []) {
      if (ip.type !== 'ipv4') continue;
      for (const x of ip.prices || []) out.ipv4[x.location] = Number(((x.price_monthly || {}).gross) || 0);
    }
  } catch (x) { /* בלי מחירון — המחיר של השרת עדיין נכון */ }
  return out;
}

/* קריאה אחת ל־Hetzner: הסוג, המחיר לחודש לכל מיקום והמלאי עכשיו (locations[].available) */
async function typeInfo(e, deps, type, pr) {
  const st = ((await P.hc(deps, e, 'GET', '/server_types?name=' + encodeURIComponent(type))).server_types || [])[0];
  if (!st) fail('type', 'אין ב־Hetzner סוג שרת בשם ' + type);
  const loc = {};
  for (const x of st.prices || []) loc[x.location] = { server: Number(((x.price_monthly || {}).gross) || 0), ipv4: (pr.ipv4 || {})[x.location] || 0 };
  const avail = {};
  for (const l of st.locations || []) avail[l.name] = !!l.available && !(l.deprecation && l.deprecation.unavailable_after && Date.parse(l.deprecation.unavailable_after) < deps.now());
  return { id: st.id, memory: Number(st.memory), currency: pr.currency || '', loc, avail };
}

async function priceOf(e, deps, type) { return typeInfo(e, deps, type, await pricing(e, deps)); }

const total = (p, l) => (p.loc[l] ? Math.round((p.loc[l].server + p.loc[l].ipv4) * 100) / 100 : null);

/* כל הסודות קיימים ותקינים — אותה בדיקה של ההקמה, עם טוקנים מדומים. שמות בלבד, בלי ערכים */
async function checkSecrets(e, deps) {
  const app = await P.appEnv(e, deps);
  const fake = 'aaaaaaaaaaaa-' + 'A'.repeat(43);
  P.planFiles(AUTOBUY.plan, e, { stg: fake, prod: fake }, app.line);
  if (!/^[A-Za-z0-9]{20,100}$/.test(String(e.HCLOUD_TOKEN || ''))) fail('hcloud_token', 'חסר HCLOUD_TOKEN');
  return app.keys.length + ' משתנים לשרתון' + (app.sa === 'g' ? ' · חשבון השירות מ־PROD_FIREBASE_SA, אומת מול הכספת' : app.sa === 'x' ? ' · חשבון השירות מ־PROD_APP_EXTRA, אומת מול הכספת' : '')
    + (app.opt.length ? ' · ⚠ בלי מאגר הלמידה (' + app.opt.join(', ') + ' — Sensitive; להוסיף ל־PROD_APP_EXTRA) — הפעולות שלו דרך Vercel' : '');
}

async function exists(e, deps, name) {
  return ((await P.hc(deps, e, 'GET', '/servers?name=' + encodeURIComponent(name))).servers || []).length > 0;
}

/* תקלה רגעית (רשת, 429, 5xx) — מנסים בדקה הבאה. רק תקלה קבועה עוצרת ומכבה את האוטומציה. */
const transient = (x) => !x || !x.code || /^hcloud_(429|5\d\d)$/.test(x.code);
async function existsSoft(e, deps, name) {
  try { return await exists(e, deps, name); } catch (x) { if (transient(x)) return null; throw x; }
}

/* הזמנה אחת במיקום אחד: טוקנים חדשים לשתי הסביבות, קוד הקמה עם סודות טריים מ־Vercel, יצירה.
   כישלון = מנקים את הרישומים (שרת שלא נוצר לא משאיר טוקן חי). */
async function buyAt(e, deps, loc) {
  const tpl = fs.readFileSync(path.join(ROOT, 'infra/cloud-init.yaml'), 'utf8');
  const stg = await P.register(e, P.ENVS.stg, AUTOBUY.name, deps);
  let prod = null;
  try {
    prod = await P.register(e, P.ENVS.prod, AUTOBUY.name, deps);
    const app = await P.appEnv(e, deps);
    const ud = P.cloudInit(tpl, P.planFiles(AUTOBUY.plan, e, { stg: stg.token, prod: prod.token }, app.line));
    const r = await P.create(e, { name: AUTOBUY.name, type: AUTOBUY.type, location: loc, plan: AUTOBUY.plan }, ud, deps);
    return { server: r.id, location: loc, sid: stg.sid, sidp: prod.sid, learn: app.opt.length ? 'remote' : 'ok' };
  } catch (x) {
    await P.unregister(e, P.ENVS.stg, stg.sid, deps).catch(() => {});
    if (prod) await P.unregister(e, P.ENVS.prod, prod.sid, deps).catch(() => {});
    throw x;
  }
}

/* הלולאה. מחזירה {bought:{…}} | {stop:'קוד', why} | {timeout:true} */
async function watch(e, deps, opts = {}) {
  const until = deps.now() + (opts.minutes || 345) * 60e3;
  const max = String(e.SNB_AUTOBUY_MAX || '').trim();
  if (!MONEY_RE.test(max)) return { stop: 'no_max', why: 'לא הוגדרה תקרת מחיר (המשתנה SNB_AUTOBUY_MAX) — לא מזמינים' };
  await checkSecrets(e, deps);
  const gone = () => ({ stop: 'exists', why: 'השרת ' + AUTOBUY.name + ' כבר קיים — לא מזמינים שוב' });
  if (await existsSoft(e, deps, AUTOBUY.name) === true) return gone();
  const pr = await pricing(e, deps);            // פעם אחת לריצה — בכל דקה רק קריאה אחת (המלאי)
  let n = 0;
  while (deps.now() < until) {
    n++;
    let p = null;
    try { p = await typeInfo(e, deps, AUTOBUY.type, pr); } catch (x) { if (!transient(x)) throw x; }
    if (p) {
      if (p.memory < P.PLANS[AUTOBUY.plan].minGb) return { stop: 'too_small', why: AUTOBUY.type + ' עם ' + p.memory + 'GB' };
      // "השרת קיים" — רק כשיש מלאי (בשאר הדקות קריאה אחת בלבד). לא ידוע (תקלה רגעית) — לא מזמינים בדקה הזו.
      const ex = AUTOBUY.locations.some((l) => p.avail[l]) ? await existsSoft(e, deps, AUTOBUY.name) : false;
      if (ex === true) return gone();
      if (ex === null) p = null;
    }
    if (p) {
      for (const loc of AUTOBUY.locations) {
        if (!p.avail[loc]) continue;
        const price = total(p, loc);
        if (price == null || price > Number(max)) return { stop: 'price', why: 'המחיר ב־' + loc + ' הוא ' + price + ' ' + p.currency + ' — מעל התקרה שאושרה (' + max + ')' };
        try {
          const b = await buyAt(e, deps, loc);
          return { bought: Object.assign(b, { price, currency: p.currency }) };
        } catch (x) {
          // נגמר המלאי באמצע (resource_unavailable) — המיקום הבא, ואחר כך ממשיכים לחכות. כל השאר = עוצרים.
          if (x.hcode !== 'resource_unavailable') throw x;
        }
      }
    }
    if (deps.now() + AUTOBUY.every >= until) break;
    await deps.sleep(AUTOBUY.every);
  }
  return { timeout: true, checks: n };
}

async function check(e, deps) {
  const lines = [];
  for (const t of [AUTOBUY.type, 'cax31']) {
    const p = await priceOf(e, deps, t);
    for (const loc of AUTOBUY.locations) {
      const tt = total(p, loc);
      lines.push(t + ' · ' + loc + ' · ' + (tt == null ? 'לא נמכר כאן' : tt.toFixed(2) + ' ' + p.currency + ' לחודש (כולל IPv4)') + ' · ' + (p.avail[loc] ? 'במלאי עכשיו' : 'אזל'));
    }
  }
  let sec = '';
  try { sec = 'הסודות: תקינים (' + (await checkSecrets(e, deps)) + ')'; } catch (x) { sec = 'הסודות: ✗ ' + x.message; }
  lines.push(sec);
  lines.push('השם שיוזמן: ' + AUTOBUY.name + (await exists(e, deps, AUTOBUY.name) ? ' — ✗ כבר קיים' : ''));
  return lines.join('\n');
}

if (require.main === module) {
  const deps = { fetch: (...x) => fetch(...x), now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)) };
  const cmd = process.argv[2];
  const out = (k, v) => { if (process.env.GITHUB_OUTPUT && /^[a-z]+$/.test(k) && /^[A-Za-z0-9._-]{1,60}$/.test(String(v))) fs.appendFileSync(process.env.GITHUB_OUTPUT, k + '=' + v + '\n'); };
  (async () => {
    if (cmd === 'check') { console.log(await check(process.env, deps)); return; }
    if (cmd === 'watch') {
      const r = await watch(process.env, deps, { minutes: Number(process.argv[3]) || 345 });
      if (r.bought) {
        for (const k of ['server', 'location', 'sid', 'sidp', 'learn']) out(k, r.bought[k]);
        out('price', r.bought.price); out('currency', r.bought.currency || 'na');
        console.log('✓ הוזמן: ' + AUTOBUY.name + ' · ' + AUTOBUY.type + ' · ' + r.bought.location);
      } else if (r.stop) { out('stopped', r.stop); console.log('■ ' + r.why); }
      else console.log('… עוד לא במלאי (' + r.checks + ' בדיקות) — הריצה הבאה ממשיכה');
      return;
    }
    fail('cmd', 'פקודה לא מוכרת');
  })().catch((err) => {
    // כל שגיאה = עצירה סופית: ה־workflow מכבה את עצמו ומודיע (כמו אצל Muse — אין ניסיון חוזר כל 6 שעות)
    out('stopped', String(err.hcode || err.code || 'error').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 60));
    console.error('✗ ' + (err.message || err.code));
    process.exit(1);
  });
}

module.exports = { AUTOBUY, transient, pricing, typeInfo, priceOf, total, checkSecrets, exists, buyAt, watch, check };
