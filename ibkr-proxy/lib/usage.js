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
  if (r.status === 403) {
    // 24/10/2026: ב־Google 403 הוא שני דברים שונים — ה־API כבוי בפרויקט (SERVICE_DISABLED) או שחסר תפקיד. רק קוד, בלי ההודעה
    const tx = typeof r.text === 'function' ? await r.text().catch(() => '') : '';
    return { err: /SERVICE_DISABLED|has not been used|is disabled/.test(tx) ? 'api_off' : 'http_403' };
  }
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
  // 24/10/2026: לפי התיעוד של Cloudflare (r2/platform/metrics-analytics) הסינון הוא datetime_geq/datetime_leq — עד היום
  // datetimeHour_*, שהשאילתה נדחתה עליו. האחסון = הנקודה האחרונה (orderBy datetime_DESC), לא שיא החודש
  const query = 'query($a:string,$s:Time,$e:Time){viewer{accounts(filter:{accountTag:$a}){' +
    'r2StorageAdaptiveGroups(limit:1,filter:{datetime_geq:$s,datetime_leq:$e},orderBy:[datetime_DESC]){max{payloadSize}}' +
    'r2OperationsAdaptiveGroups(limit:1,filter:{datetime_geq:$s,datetime_leq:$e}){sum{requests}}}}}';
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

/* ---- האחסון שלנו, לפי מקום (24/10/2026, בקשת המשתמש: "כל האחסונים שלנו כמו R2") ----
   R2 — לכל דלי שהשרתון מכיר (R2_BUCKET, R2L_BUCKET ועוד ב־R2_USAGE_BUCKETS="snb-staging,..."): גודל ומספר קבצים מה־GraphQL
   של Cloudflare (אותו CF_USAGE_TOKEN). דלי עם תחום שיפוט (EU) נשאל בשם eu_<דלי> — לא תמיד ידוע איפה הוא, לכן שתי השאלות
   באותה בקשה ולוקחים את מי שענה. הכמות החינמית (10GB) משותפת לכל הדליים בחשבון. */
const BUCKET_RE = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const STO_GAP = 55 * 60e3;   // מדידת האחסון לכל היותר פעם בשעה
function r2Buckets(env) {
  const out = [];
  const add = (b) => { b = String(b || '').trim(); if (BUCKET_RE.test(b) && !out.includes(b)) out.push(b); };
  add(env.R2_BUCKET); add(env.R2L_BUCKET);
  for (const x of String(env.R2_USAGE_BUCKETS || '').split(',')) add(x);
  return out.slice(0, 8);
}
function storeQuery(bs) {
  const one = (al, name) => al + ':r2StorageAdaptiveGroups(limit:1,filter:{datetime_geq:$s,datetime_leq:$e,bucketName:"' + name + '"},' +
    'orderBy:[datetime_DESC]){max{payloadSize metadataSize objectCount}}';
  return 'query($a:string,$s:Time,$e:Time){viewer{accounts(filter:{accountTag:$a}){' +
    bs.map((b, i) => one('p' + i, b) + ' ' + one('e' + i, 'eu_' + b)).join(' ') + '}}}';
}
function parseStore(j, bs) {
  const acc = j && j.data && j.data.viewer && j.data.viewer.accounts && j.data.viewer.accounts[0];
  if (!acc) return { st: 'err', err: 'shape', b: [] };
  const b = [];
  bs.forEach((name, i) => {
    const g = ((acc['p' + i] || [])[0] || (acc['e' + i] || [])[0] || {}).max;
    if (!g || g.payloadSize == null) return;
    const bytes = +g.payloadSize + (+g.metadataSize || 0);
    b.push({ name, gb: Math.round(bytes / GB * 1000) / 1000, n: Number.isFinite(+g.objectCount) ? +g.objectCount : null });
  });
  return { st: 'ok', b };
}
/* העלות החודשית של R2 (24/10/2026, בקשת המשתמש: "כבר מזמן עברתי את ה־10GB"). המחירון מהתיעוד (developers.cloudflare.com/r2/pricing,
   נבדק 24/10/2026): אחסון $0.015 ל־GB-חודש מעל 10; Class A ‏$4.50 למיליון מעל מיליון; Class B ‏$0.36 למיליון מעל 10 מיליון; יציאה חינם.
   GB-חודש = ממוצע של השיא היומי (מעוגל למעלה). זו הערכה — החשבונית של Cloudflare היא הקובעת */
const R2_PRICE = { gb: 0.015, a: 4.5, b: 0.36, freeGb: 10, freeA: 1e6, freeB: 1e7 };
const R2_A = ['ListBuckets', 'PutBucket', 'ListObjects', 'PutObject', 'CopyObject', 'CompleteMultipartUpload', 'CreateMultipartUpload',
  'LifecycleStorageTierTransition', 'ListMultipartUploads', 'UploadPart', 'UploadPartCopy', 'ListParts', 'PutBucketEncryption', 'PutBucketCors', 'PutBucketLifecycleConfiguration'];
const R2_FREE_OPS = ['DeleteObject', 'DeleteBucket', 'AbortMultipartUpload'];
/* פעולות החודש לפי סוג: {a, b} (פעולה שלא ברשימות = B, הזולה — שלא ננפח) */
function opsByClass(groups) {
  let a = 0, b = 0;
  for (const g of groups || []) {
    const t = g && g.dimensions && g.dimensions.actionType, n = +((g && g.sum && g.sum.requests) || 0);
    if (!Number.isFinite(n) || R2_FREE_OPS.includes(t)) continue;
    if (R2_A.includes(t)) a += n; else b += n;
  }
  return { a, b };
}
/* gbMonth = ממוצע השיא היומי עד היום; a/b = פעולות מתחילת החודש; day/days = היום בחודש ומספר הימים. מחזיר דולרים — בפועל
   עד היום (mtd) וצפי לסוף החודש (proj; הפעולות בקצב של עד היום) */
function r2Cost(o) {
  const P = R2_PRICE, day = Math.max(1, o.day || 1), days = Math.max(day, o.days || 30);
  const st = Math.max(0, Math.ceil(o.gbMonth || 0) - P.freeGb) * P.gb;
  const ca = (n) => Math.max(0, n - P.freeA) / 1e6 * P.a, cb = (n) => Math.max(0, n - P.freeB) / 1e6 * P.b;
  const k = days / day, pa = (o.a || 0) * k, pb = (o.b || 0) * k;
  const r2c = (x) => Math.round(x * 100) / 100;
  return { st: r2c(st), a: r2c(ca(pa)), b: r2c(cb(pb)), proj: r2c(st + ca(pa) + cb(pb)), mtd: r2c(st * day / days + ca(o.a || 0) + cb(o.b || 0)),
    gbm: Math.round((o.gbMonth || 0) * 100) / 100, pa: Math.round(pa), pb: Math.round(pb) };
}
/* השיא היומי מכל דלי (קבוצות לפי date) → ממוצע הסכום היומי */
function gbMonthOf(acc, n) {
  const day = {};
  for (let i = 0; i < n; i++) for (const g of acc['d' + i] || []) {
    const d = g && g.dimensions && g.dimensions.date, m = g && g.max;
    if (!d || !m || m.payloadSize == null) continue;
    day[d] = (day[d] || 0) + (+m.payloadSize + (+m.metadataSize || 0)) / GB;
  }
  const v = Object.values(day);
  return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null;
}
async function r2Store(env, f, now) {
  const tok = String(env.CF_USAGE_TOKEN || '').trim(), acc = String(env.R2_ACCOUNT_ID || '').trim(), bs = r2Buckets(env);
  if (!tok || !acc || !bs.length) return { st: 'off', b: [] };
  const gql = (query, vars) => getJson(f, 'https://api.cloudflare.com/client/v4/graphql', { method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: Object.assign({ a: acc }, vars) }) }).catch(() => ({ err: 'net' }));
  const d = new Date(now), m0 = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  const g = await gql(storeQuery(bs), { s: new Date(now - 3 * 86400e3).toISOString(), e: d.toISOString() });
  if (g.err) return { st: 'err', err: g.err, b: [] };
  if (g.j && Array.isArray(g.j.errors) && g.j.errors.length && !g.j.data) return { st: 'err', err: 'gql', b: [] };
  const out = parseStore(g.j, bs);
  if (out.st !== 'ok') return out;
  // העלות: שאלה נפרדת — אם היא נדחית (שם שדה), הגודל לפי דלי עדיין נשמר
  const c = await gql(costQuery(bs), { m: m0, e: d.toISOString() });
  const ca = !c.err && c.j && c.j.data && c.j.data.viewer && c.j.data.viewer.accounts && c.j.data.viewer.accounts[0];
  if (ca) {
    const ops = opsByClass(ca.ops), cur = out.b.reduce((x, y) => x + y.gb, 0), gbm = gbMonthOf(ca, bs.length * 2);
    const days = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
    out.cost = r2Cost({ gbMonth: gbm == null ? cur : gbm, a: ops.a, b: ops.b, day: d.getUTCDate(), days });
  }
  return out;
}
function costQuery(bs) {
  const one = (al, name) => al + ':r2StorageAdaptiveGroups(limit:40,filter:{datetime_geq:$m,datetime_leq:$e,bucketName:"' + name + '"}){max{payloadSize metadataSize} dimensions{date}}';
  return 'query($a:string,$m:Time,$e:Time){viewer{accounts(filter:{accountTag:$a}){' +
    'ops:r2OperationsAdaptiveGroups(limit:200,filter:{datetime_geq:$m,datetime_leq:$e}){sum{requests} dimensions{actionType}} ' +
    bs.map((b, i) => one('d' + i, b) + ' ' + one('d' + (i + bs.length), 'eu_' + b)).join(' ') + '}}}';
}
/* Google Drive — הגיבוי אצל ספק שני (lib/offsite.js) ב־Drive של המנהל: כמה תפוס מתוך המכסה. token = גישה של הלקוח של הספרייה */
function parseDrive(j) {
  const q = j && j.storageQuota;
  if (!q || q.usage == null) return { st: 'err', err: 'shape' };
  return { st: 'ok', gb: Math.round(+q.usage / GB * 100) / 100, lim: q.limit != null ? Math.round(+q.limit / GB) : null };
}
async function driveStore(token, f) {
  if (!token) return { st: 'off' };
  const g = await getJson(f, 'https://www.googleapis.com/drive/v3/about?fields=storageQuota', { headers: { Authorization: 'Bearer ' + token } }).catch(() => ({ err: 'net' }));
  return g.err ? { st: 'err', err: g.err } : parseDrive(g.j);
}
/* המצב שנשמר (sysUsage/main.sto): רק מה שהצליח — ריצה בלי טוקן (למשל בשרתון שלנו, שהוקם בלי CF_USAGE_TOKEN) לא מוחקת
   את מה שנמדד קודם (ב־Vercel) */
function storeMerge(prev, r2, drive, now) {
  const p = prev && typeof prev === 'object' ? prev : {};
  const out = { r2: p.r2 || null, drive: p.drive || null };
  if (r2 && r2.st === 'ok' && r2.b.length) out.r2 = Object.assign({ at: Math.round(now / 1000), b: r2.b }, r2.cost ? { cost: r2.cost } : (p.r2 && p.r2.cost ? { cost: p.r2.cost } : {}));
  // 24/10/2026: שגיאה של R2 נשמרת (קוד וזמן) — אחרת המסך אמר "צריך טוקן" גם כשהטוקן קיים והשאילתה נדחתה
  if (r2 && r2.st === 'err') out.r2e = { err: String(r2.err || 'err').slice(0, 20), at: Math.round(now / 1000) };
  else if (p.r2e && !(r2 && r2.st === 'ok')) out.r2e = p.r2e;
  if (drive && drive.st === 'ok') out.drive = { at: Math.round(now / 1000), gb: drive.gb, lim: drive.lim };
  return out;
}

/* 24/10/2026: מרכז הניהול נשאל דרך השרת שלנו (ראשי), והטוקנים של הספקים רק ב־Vercel (שרץ מדי כמה שעות — בדיקת הגיבוי).
   לכן מופע עם טוקן שומר את מה שמדד (upv במסמך sysUsage/main), ומופע בלי טוקן מציג את השמור במקום "לא מוגדר".
   provKeep: רק מה שנמדד (לא off). provMerge: off מקומי ← השמור, עם הזמן שבו נמדד (at, בשניות) */
const PROV_KEYS = ['vercel', 'r2', 'firestore'];
function provKeep(prev, prov, now) {
  const out = Object.assign({}, prev && typeof prev === 'object' ? prev : {});
  for (const k of PROV_KEYS) { const x = prov && prov[k]; if (x && x.st && x.st !== 'off') out[k] = Object.assign({}, x, { at: Math.round(now / 1000) }); }
  return out;
}
function provMerge(prov, kept) {
  const out = Object.assign({}, prov || {}), K = kept && typeof kept === 'object' ? kept : {};
  for (const k of PROV_KEYS) if ((!out[k] || out[k].st === 'off') && K[k] && K[k].st) out[k] = K[k];
  return out;
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

module.exports = { PROV_KEYS, provKeep, provMerge, R2_PRICE, opsByClass, r2Cost, gbMonthOf, costQuery, STO_GAP, r2Buckets, storeQuery, parseStore, r2Store, parseDrive, driveStore, storeMerge, HIST_KEYS, HIST_MAX, histDue, histPush, LIMITS, parseVercel, parseR2, parseFs, sumPoints, usageAll, item };
