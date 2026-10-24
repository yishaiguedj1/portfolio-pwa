'use strict';
/* מעקב תעבורה ואחסון של שירותי הענן (23/10/2026, אפשרות א׳ מתוך הדיון: טוקנים לקריאה בלבד).
   כל ספק נשאל בנפרד, ורק אם הטוקן שלו מוגדר בסביבה. בלי טוקן = "off" (לא מומצא מספר).
   המכסות החינמיות הן הערכה לפי התיעוד של כל ספק — להשוות לדשבורד בעת ההגדרה.
   מה שלא אומת מול הספק בזמן הכתיבה מסומן UNVERIFIED: הפענוח מחזיר shape כשהתשובה לא מוכרת, ולא מנחש.
   הטוקנים לא נשמרים ולא חוזרים לטלפון; רק תוצאה מסוכמת (מספרים וקודי מצב) נשלחת. */

const { cloudToken } = require('./gauth');

const GB = 1e9;
// מכסות חינמיות (הערכה לפי התיעוד). תעבורה/אחסון ב־GB, פעולות/קריאות כמספר לחודש או ליום
const LIMITS = {
  vercel: { bw: { lim: 100, unit: 'GB' }, inv: { lim: 1e6, unit: 'n' } },   // Hobby: 100GB תעבורה, מיליון קריאות לפונקציות
  r2: { store: { lim: 10, unit: 'GB' }, ops: { lim: 11e6, unit: 'n' } },    // R2 חינם: 10GB אחסון, 1M פעולות A + 10M B
  fs: { reads: { lim: 50000, unit: 'n' }, writes: { lim: 20000, unit: 'n' } }, // Firestore Spark ליום
};

const item = (k, used, lim, unit) => ({ k, used: used == null || !Number.isFinite(+used) ? null : Math.round(+used * 10) / 10, lim, unit,
  pct: used == null || !Number.isFinite(+used) ? null : Math.min(999, Math.round((+used / lim) * 1000) / 10) });

/* ---- מפענחים טהורים (נבדקים בלי רשת) ---- */
/* Vercel — UNVERIFIED: מצפה לשדות bandwidth/invocations בתשובה של ה־usage. צורה אחרת = shape */
function parseVercel(j) {
  const bw = j && (j.bandwidth != null ? j.bandwidth : j.bandwidthBytes), inv = j && (j.invocations != null ? j.invocations : j.functionInvocations);
  if (bw == null && inv == null) return { st: 'err', err: 'shape', items: [] };
  return { st: 'ok', items: [item('bw', bw == null ? null : +bw / GB, LIMITS.vercel.bw.lim, 'GB'), item('inv', inv, LIMITS.vercel.inv.lim, 'n')] };
}
/* Cloudflare R2 (GraphQL) — UNVERIFIED: שמות השדות r2StorageAdaptiveGroups / r2OperationsAdaptiveGroups */
function parseR2(j) {
  const acc = j && j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0];
  if (!acc) return { st: 'err', err: 'shape', items: [] };
  const st = (acc.r2StorageAdaptiveGroups || [])[0], op = (acc.r2OperationsAdaptiveGroups || [])[0];
  const storeBytes = st && st.max ? st.max.payloadSize : null, reqs = op && op.sum ? op.sum.requests : null;
  if (storeBytes == null && reqs == null) return { st: 'ok', items: [item('store', null, LIMITS.r2.store.lim, 'GB'), item('ops', null, LIMITS.r2.ops.lim, 'n')] };
  return { st: 'ok', items: [item('store', storeBytes == null ? null : +storeBytes / GB, LIMITS.r2.store.lim, 'GB'), item('ops', reqs, LIMITS.r2.ops.lim, 'n')] };
}
/* Firestore (Cloud Monitoring) — סכום היום של קריאות/כתיבות. תשובת timeSeries: points[].value.int64Value */
function sumPoints(j) {
  let t = 0, any = false;
  for (const s of (j && j.timeSeries) || []) for (const p of s.points || []) {
    const v = p.value && (p.value.int64Value != null ? p.value.int64Value : p.value.doubleValue);
    if (v != null) { t += +v; any = true; }
  }
  return any ? t : null;
}
function parseFs(readsJ, writesJ) {
  const r = sumPoints(readsJ), w = sumPoints(writesJ);
  if (r == null && w == null) return { st: 'err', err: 'shape', items: [] };
  return { st: 'ok', items: [item('reads', r, LIMITS.fs.reads.lim, 'n'), item('writes', w, LIMITS.fs.writes.lim, 'n')] };
}

/* ---- שליפה (fetch מוזרק לבדיקות) ---- */
const off = (lim) => ({ st: 'off', items: Object.keys(lim).map((k) => item(k, null, lim[k].lim, lim[k].unit)) });
async function getJson(f, url, opt) {
  const r = await f(url, opt);
  if (r.status !== 200) return { err: 'http_' + r.status };
  try { return { j: await r.json() }; } catch (e) { return { err: 'shape' }; }
}
async function vercelUsage(env, f, now) {
  const tok = String(env.VERCEL_USAGE_TOKEN || '').trim();
  if (!tok) return off(LIMITS.vercel);
  const team = String(env.VERCEL_TEAM_ID || '').trim();
  const from = new Date(Date.UTC(new Date(now).getUTCFullYear(), new Date(now).getUTCMonth(), 1)).toISOString();
  const url = 'https://api.vercel.com/v1/usage?from=' + encodeURIComponent(from) + (team ? '&teamId=' + encodeURIComponent(team) : '');
  const g = await getJson(f, url, { headers: { Authorization: 'Bearer ' + tok } }).catch(() => ({ err: 'net' }));
  if (g.err) return { st: 'err', err: g.err, items: [] };
  return parseVercel(g.j);
}
async function r2Usage(env, f, now) {
  const tok = String(env.CF_USAGE_TOKEN || '').trim(), acc = String(env.R2_ACCOUNT_ID || '').trim();
  if (!tok || !acc) return off(LIMITS.r2);
  const d = new Date(now), start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  const query = 'query($a:string,$s:Time,$e:Time){viewer{accounts(filter:{accountTag:$a}){' +
    'r2StorageAdaptiveGroups(limit:1,filter:{datetimeHour_geq:$s,datetimeHour_lt:$e}){max{payloadSize}}' +
    'r2OperationsAdaptiveGroups(limit:1,filter:{datetimeHour_geq:$s,datetimeHour_lt:$e}){sum{requests}}}}}';
  const body = JSON.stringify({ query, variables: { a: acc, s: start, e: d.toISOString() } });
  const g = await getJson(f, 'https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body }).catch(() => ({ err: 'net' }));
  if (g.err) return { st: 'err', err: g.err, items: [] };
  return parseR2(g.j);
}
async function firestoreUsage(env, f, now) {
  // אותו חשבון שירות שכבר בשרתון (GDRIVE_SA_KEY) — צריך לו תפקיד Monitoring Viewer בפרויקט של Firebase
  const { serviceAccount } = require('./gauth');
  if (!serviceAccount()) return off(LIMITS.fs);
  const project = String(env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e');
  const day = new Date(now), start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate())).toISOString();
  const q = (type) => 'https://monitoring.googleapis.com/v3/projects/' + project + '/timeSeries?filter=' +
    encodeURIComponent('metric.type="firestore.googleapis.com/document/' + type + '"') +
    '&interval.startTime=' + encodeURIComponent(start) + '&interval.endTime=' + encodeURIComponent(day.toISOString()) +
    '&aggregation.alignmentPeriod=86400s&aggregation.perSeriesAligner=ALIGN_SUM&aggregation.crossSeriesReducer=REDUCE_SUM';
  try {
    const tk = await cloudToken(f);
    const auth = { headers: { Authorization: 'Bearer ' + tk } };
    const r1 = await getJson(f, q('read_count'), auth), r2 = await getJson(f, q('write_count'), auth);
    if (r1.err || r2.err) return { st: 'err', err: r1.err || r2.err, items: [] };
    return parseFs(r1.j, r2.j);
  } catch (e) { return { st: 'err', err: e.message === 'not_configured' ? 'off' : 'auth', items: [] }; }
}

/* כל הספקים במקביל; ספק שנכשל לא מפיל את האחרים */
async function usageAll(env, f, now) {
  env = env || {}; f = f || fetch; now = now || Date.now();
  const [vercel, r2, firestore] = await Promise.all([
    vercelUsage(env, f, now).catch(() => ({ st: 'err', err: 'net', items: [] })),
    r2Usage(env, f, now).catch(() => ({ st: 'err', err: 'net', items: [] })),
    firestoreUsage(env, f, now).catch(() => ({ st: 'err', err: 'net', items: [] })),
  ]);
  return { now, vercel, r2, firestore };
}


/* היסטוריה (23/10/2026): נקודה לשעה לכל אחוז שימוש, עד 31 ימים. טור: זמן + 6 ערכים (אחוז או null).
   HIST_KEYS זהה ב־admin-app.js. נשמר במסמך sysUsage/main (שדה uh, JSON) */
const HIST_KEYS = ['t', 'vbw', 'vinv', 'rst', 'rops', 'rrd', 'rwr'];
const HIST_MAX = 744;          // 31 ימים × 24 שעות
const HIST_GAP = 55 * 60e3;    // נקודה לכל היותר פעם בשעה (המסלול רץ כל ~10 דק׳)
function histPoint(prov, now) {
  const pc = (P, k) => { const it = P && P.st === 'ok' && (P.items || []).find((x) => x.k === k); return it && it.pct != null ? it.pct : null; };
  return [Math.round(now / 1000), pc(prov.vercel, 'bw'), pc(prov.vercel, 'inv'), pc(prov.r2, 'store'), pc(prov.r2, 'ops'), pc(prov.firestore, 'reads'), pc(prov.firestore, 'writes')];
}
const histValid = (hist) => (Array.isArray(hist) ? hist : []).filter((p) => Array.isArray(p) && p.length === HIST_KEYS.length);
function histDue(hist, now) {
  const arr = histValid(hist);
  return !arr.length || now - arr[arr.length - 1][0] * 1000 >= HIST_GAP;
}
function histPush(hist, prov, now) {
  const arr = histValid(hist);
  if (!histDue(arr, now)) return arr;
  const pt = histPoint(prov, now);
  if (pt.slice(1).every((v) => v == null)) return arr;   // אין נתון באף ספק — לא שומרים נקודה ריקה
  arr.push(pt);
  return arr.slice(-HIST_MAX);
}

module.exports = { HIST_KEYS, HIST_MAX, histDue, histPush, LIMITS, parseVercel, parseR2, parseFs, sumPoints, usageAll, item };
