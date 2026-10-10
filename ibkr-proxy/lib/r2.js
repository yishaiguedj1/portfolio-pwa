/* ת4 — אחסון הקבצים ב־Cloudflare R2 (תקן S3), בלי תלויות: חתימת SigV4 + הפעולות שהשרתון צריך.
   מפתחות הגישה רק במשתני הסביבה של השרתון — לעולם לא לטלפון ולא לעובד. הם מקבלים קישור חתום
   לקובץ אחד / לחלק אחד, לזמן קצר, ומעלים ומורידים ישירות מ־R2 (התעבורה לא עוברת דרך השרתון).
   משתני סביבה: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
   ואופציונלי R2_JURISDICTION (eu/us). בלעדיו — מזהים לבד: דלי ב־EU נגיש רק מהכתובת של EU.
   העלאה גדולה = Multipart: ב־R2 כל החלקים חוץ מהאחרון חייבים להיות באותו גודל (≥5MiB), עד 10,000 חלקים.
   ה־ETag של החלקים נקרא בשרתון (ListParts) — הטלפון והעובד לא צריכים לקרוא כותרות. */
const crypto = require('crypto');

const REGION = 'auto';
const SERVICE = 's3';
const MIB = 1024 * 1024;
const PART_MIN = 8 * MIB;                 // גודל חלק מינימלי שלנו (R2: ≥5MiB)
const PART_MAX_N = 10000;
const MAX_EXPIRES = 7 * 24 * 3600;       // SigV4 — עד שבוע
const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._\-\/]{0,511}$/;   // אנחנו בונים את המפתחות — בלי רווחים / תווים מיוחדים
const EMPTY_SHA = crypto.createHash('sha256').update('').digest('hex');

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => crypto.createHmac('sha256', k).update(s).digest();
/* קידוד RFC 3986 כמו ש־S3 דורש; בנתיב '/' נשאר */
function enc(s, slash) {
  return encodeURIComponent(String(s)).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%2F/g, slash ? '/' : '%2F');
}
const amzDate = (now) => new Date(now).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
function signingKey(secret, date, region, service) {
  return hmac(hmac(hmac(hmac('AWS4' + secret, date), region), service), 'aws4_request');
}
function canonQuery(q) {
  return Object.keys(q).sort().map((k) => enc(k) + '=' + enc(q[k])).join('&');
}

/* חתימה כללית (נבדקת מול הדוגמאות הרשמיות של AWS): מחזירה את החתימה ואת הכותרות/השאילתה */
function sign({ method, host, path, query = {}, headers = {}, payload = EMPTY_SHA, accessKey, secret, region = REGION, service = SERVICE, now, presign = 0 }) {
  const t = amzDate(now);
  const date = t.slice(0, 8);
  const scope = date + '/' + region + '/' + service + '/aws4_request';
  const h = { host };
  for (const k of Object.keys(headers)) h[k.toLowerCase()] = String(headers[k]).trim();
  if (!presign) { h['x-amz-date'] = t; h['x-amz-content-sha256'] = payload; }
  const names = Object.keys(h).sort();
  const signed = names.join(';');
  const q = Object.assign({}, query);
  if (presign) {
    Object.assign(q, { 'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': accessKey + '/' + scope,
      'X-Amz-Date': t, 'X-Amz-Expires': String(presign), 'X-Amz-SignedHeaders': signed });
  }
  const creq = [method, enc(path, true), canonQuery(q), names.map((n) => n + ':' + h[n] + '\n').join(''), signed,
    presign ? 'UNSIGNED-PAYLOAD' : payload].join('\n');
  const sts = ['AWS4-HMAC-SHA256', t, scope, sha256(creq)].join('\n');
  const sig = hmac(signingKey(secret, date, region, service), sts).toString('hex');
  return { sig, t, scope, signed, headers: h, query: q,
    auth: 'AWS4-HMAC-SHA256 Credential=' + accessKey + '/' + scope + ', SignedHeaders=' + signed + ', Signature=' + sig };
}

/* ---------------------------------------------------------------- הגדרה */
function config(env = process.env) {
  const c = { account: String(env.R2_ACCOUNT_ID || '').trim(), key: String(env.R2_ACCESS_KEY_ID || '').trim(),
    secret: String(env.R2_SECRET_ACCESS_KEY || '').trim(), bucket: String(env.R2_BUCKET || '').trim(),
    j: String(env.R2_JURISDICTION || '').trim().toLowerCase() };
  c.ok = /^[a-f0-9]{32}$/.test(c.account) && !!c.key && !!c.secret && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(c.bucket);
  c.jSet = /^(eu|us|fedramp)$/.test(c.j);
  if (!c.jSet) c.j = '';
  return c;
}
const hostOf = (c, j) => c.account + (j ? '.' + j : '') + '.r2.cloudflarestorage.com';
function okKey(k) { return typeof k === 'string' && KEY_RE.test(k) && !k.includes('..') && !k.includes('//') && !k.endsWith('/'); }

/* באיזו כתובת הדלי נמצא (EU / רגיל) — נקבע פעם אחת למופע. בלי R2_JURISDICTION: קודם EU (ההמלצה שלנו), ואז הרגילה */
const _where = new Map();
async function locate(c, deps = {}) {
  if (c.jSet) return c.j;
  const id = c.account + '/' + c.bucket;
  if (_where.has(id)) return _where.get(id);
  /* רשימה של מפתח אחד = הרשאת אובייקטים (Object Read & Write); דלי שלא בכתובת הזו → 404 NoSuchBucket */
  for (const j of ['eu', '']) {
    const r = await raw(c, deps, { method: 'GET', key: '', query: { 'list-type': '2', 'max-keys': '1' }, j }).catch(() => null);
    if (r && r.status === 200) { _where.set(id, j); return j; }
  }
  return null;
}

/* בקשה חתומה מהשרתון ל־R2 (גוף קטן בלבד — XML של הפעולות) */
async function raw(c, deps, { method, key, query = {}, body = '', headers = {}, j }) {
  const host = hostOf(c, j === undefined ? await locate(c, deps) : j);
  const path = '/' + c.bucket + (key ? '/' + key : '');
  const s = sign({ method, host, path, query, headers, payload: sha256(body), accessKey: c.key, secret: c.secret,
    now: (deps.now || Date.now)() });
  const qs = canonQuery(query);
  const hd = Object.assign({}, headers, { 'x-amz-date': s.t, 'x-amz-content-sha256': sha256(body), Authorization: s.auth });
  return (deps.fetch || fetch)('https://' + host + enc(path, true) + (qs ? '?' + qs : ''),
    { method, headers: hd, body: body || undefined, redirect: 'manual' });
}

/* קישור חתום (presigned) — הטלפון/העובד ניגשים ישירות */
async function presign(c, deps, { method = 'GET', key, query = {}, expires = 3600 }) {
  if (!okKey(key)) throw new Error('bad_key');
  const j = await locate(c, deps);
  if (j === null) throw new Error('r2_unreachable');
  const host = hostOf(c, j);
  const path = '/' + c.bucket + '/' + key;
  const exp = Math.max(60, Math.min(MAX_EXPIRES, Math.round(expires)));
  const s = sign({ method, host, path, query, accessKey: c.key, secret: c.secret, now: (deps.now || Date.now)(), presign: exp });
  return 'https://' + host + enc(path, true) + '?' + canonQuery(s.query) + '&X-Amz-Signature=' + s.sig;
}

/* ---------------------------------------------------------------- XML קטן */
const tag = (x, t) => { const m = new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>').exec(x); return m ? m[1] : ''; };
const tags = (x, t) => { const out = []; const re = new RegExp('<' + t + '>([\\s\\S]*?)</' + t + '>', 'g'); let m; while ((m = re.exec(x))) out.push(m[1]); return out; };
const unx = (s) => String(s).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const xesc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
async function fail(r, what) {
  let code = '';
  try { code = tag(await r.text(), 'Code'); } catch (e) {}
  const err = new Error('r2_' + what + '_' + r.status + (code ? '_' + code.replace(/[^A-Za-z]/g, '').slice(0, 40) : ''));
  err.status = r.status;
  throw err;
}

/* ---------------------------------------------------------------- פעולות */
/* גודל חלק קבוע לכל ההעלאה: מכפלה של MiB, לפחות 8MiB, ולא יותר מ־10,000 חלקים */
function partSize(size, want = PART_MIN) {
  const min = Math.ceil(Math.max(1, size) / PART_MAX_N / MIB) * MIB;
  return Math.max(PART_MIN, min, Math.ceil(Math.max(want, PART_MIN) / MIB) * MIB);
}
const partsOf = (size, ps) => Math.max(1, Math.ceil(size / ps));

async function head(c, deps, key) {
  if (!okKey(key)) throw new Error('bad_key');
  const r = await raw(c, deps, { method: 'HEAD', key });
  if (r.status === 404) return null;
  if (r.status !== 200) await fail(r, 'head');
  return { size: Number(r.headers.get('content-length') || 0), etag: String(r.headers.get('etag') || '').replace(/"/g, '') };
}
async function del(c, deps, key) {
  if (!okKey(key)) throw new Error('bad_key');
  const r = await raw(c, deps, { method: 'DELETE', key });
  if (r.status !== 204 && r.status !== 200 && r.status !== 404) await fail(r, 'delete');
  return true;
}
/* כל המפתחות בתחילית (לניקוי עבודה / סריקה) */
async function list(c, deps, prefix, max = 5000) {
  if (!okKey(prefix.replace(/\/$/, ''))) throw new Error('bad_key');
  const out = [];
  let token = '';
  do {
    const q = { 'list-type': '2', prefix, 'max-keys': '1000' };
    if (token) q['continuation-token'] = token;
    const r = await raw(c, deps, { method: 'GET', key: '', query: q });
    if (r.status !== 200) await fail(r, 'list');
    const x = await r.text();
    for (const it of tags(x, 'Contents')) out.push({ key: unx(tag(it, 'Key')), size: Number(tag(it, 'Size') || 0), at: Date.parse(tag(it, 'LastModified')) || 0 });
    token = tag(x, 'IsTruncated') === 'true' ? unx(tag(x, 'NextContinuationToken')) : '';
  } while (token && out.length < max);
  return out;
}
async function mpCreate(c, deps, key, type) {
  if (!okKey(key)) throw new Error('bad_key');
  const r = await raw(c, deps, { method: 'POST', key, query: { uploads: '' },
    headers: { 'content-type': /^[\w.+-]+\/[\w.+-]+$/.test(type || '') ? type : 'application/octet-stream' } });
  if (r.status !== 200) await fail(r, 'mpcreate');
  const id = unx(tag(await r.text(), 'UploadId'));
  if (!id) throw new Error('r2_mpcreate_noid');
  return id;
}
/* החלקים שכבר הגיעו: [{n, size, etag}] לפי הסדר */
async function mpList(c, deps, key, up) {
  if (!okKey(key)) throw new Error('bad_key');
  const out = [];
  let marker = '';
  for (let i = 0; i < 20; i++) {
    const q = { uploadId: up, 'max-parts': '1000' };
    if (marker) q['part-number-marker'] = marker;
    const r = await raw(c, deps, { method: 'GET', key, query: q });
    if (r.status === 404) return null;                              // ההעלאה בוטלה / פגה
    if (r.status !== 200) await fail(r, 'mplist');
    const x = await r.text();
    for (const p of tags(x, 'Part')) out.push({ n: Number(tag(p, 'PartNumber')), size: Number(tag(p, 'Size') || 0), etag: unx(tag(p, 'ETag')) });
    if (tag(x, 'IsTruncated') !== 'true') break;
    marker = tag(x, 'NextPartNumberMarker');
  }
  return out.sort((a, b) => a.n - b.n);
}
const mpPartUrl = (c, deps, key, up, n, expires = 3600) =>
  presign(c, deps, { method: 'PUT', key, query: { partNumber: String(n), uploadId: up }, expires });
async function mpComplete(c, deps, key, up, parts) {
  const body = '<CompleteMultipartUpload>' + parts.map((p) => '<Part><PartNumber>' + p.n + '</PartNumber><ETag>' + xesc(p.etag) + '</ETag></Part>').join('') + '</CompleteMultipartUpload>';
  const r = await raw(c, deps, { method: 'POST', key, query: { uploadId: up }, body, headers: { 'content-type': 'application/xml' } });
  const x = r.status === 200 ? await r.text() : '';
  if (r.status !== 200 || /<Error>/.test(x)) { if (r.status === 200) { const e = new Error('r2_mpcomplete_' + tag(x, 'Code')); e.status = 500; throw e; } await fail(r, 'mpcomplete'); }
  return true;
}
async function mpAbort(c, deps, key, up) {
  const r = await raw(c, deps, { method: 'DELETE', key, query: { uploadId: up } });
  if (r.status !== 204 && r.status !== 200 && r.status !== 404) await fail(r, 'mpabort');
  return true;
}
/* בדיקה שההעלאה שלמה: כל החלקים 1..N קיימים, כולם באותו גודל חוץ מהאחרון, והסכום = הגודל שהוצהר.
   מחזירה {ok, missing:[n…]} — הטהורה, כדי שהשרתון לא יסגור קובץ חסר או מורכב מחלקים לא נכונים. */
function partsCheck(parts, size, ps) {
  const n = partsOf(size, ps);
  const by = new Map((parts || []).map((p) => [p.n, p]));
  const missing = [];
  let total = 0;
  for (let i = 1; i <= n; i++) {
    const p = by.get(i);
    const want = i < n ? ps : size - ps * (n - 1);
    if (!p || p.size !== want) { missing.push(i); continue; }
    total += p.size;
  }
  const extra = (parts || []).some((p) => p.n > n);
  return { ok: !missing.length && !extra && total === size, missing, extra, n };
}

/* בדיקת חיבור: כתיבה, קריאה ומחיקה של קובץ זעיר + שה־CORS מאפשר לאתר להעלות (preflight) */
async function health(c, deps, origin) {
  if (!c.ok) return { ok: false, error: 'not_configured' };
  const j = await locate(c, deps);
  if (j === null) return { ok: false, error: 'r2_unreachable' };
  const key = 'health/' + Date.now().toString(36);
  const out = { ok: false, eu: j === 'eu' };
  try {
    const put = await (deps.fetch || fetch)(await presign(c, deps, { method: 'PUT', key, expires: 120 }), { method: 'PUT', body: 'ok' });
    if (put.status !== 200) return Object.assign(out, { error: 'r2_put_' + put.status });
    const h = await head(c, deps, key);
    if (!h || h.size !== 2) return Object.assign(out, { error: 'r2_head' });
    await del(c, deps, key);
    if (origin) {
      const pf = await (deps.fetch || fetch)(await presign(c, deps, { method: 'PUT', key, expires: 120 }),
        { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'PUT', 'Access-Control-Request-Headers': 'content-type' } });
      const allow = String(pf.headers.get('access-control-allow-origin') || '');
      out.cors = allow === origin || allow === '*';
      if (!out.cors) return Object.assign(out, { error: 'r2_cors' });
    }
    out.ok = true;
    return out;
  } catch (e) {
    return Object.assign(out, { error: String(e.message || 'r2_error').slice(0, 80) });
  }
}

module.exports = { sign, config, okKey, locate, presign, head, del, list, mpCreate, mpList, mpPartUrl, mpComplete, mpAbort,
  partSize, partsOf, partsCheck, health, PART_MIN, MIB, _reset: () => _where.clear() };
