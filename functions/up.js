/* 23/10/2026 (בקשת המשתמש: העלאה שממשיכה גם כשהאפליקציה סגורה): נתיב ההעלאה של Background Fetch.
   Chrome לא שולח ב־Background Fetch בקשה שצריכה CORS preflight, ולכן ה־PUT החתום ישר ל־R2 (ממקור אחר) לא אפשרי משם.
   הטלפון שולח כל חלק ב־POST לכאן — אותו מקור, בלי CORS — והפונקציה מעבירה אותו כמו שהוא לקישור החתום (u).
   ההרשאה = החתימה בקישור עצמו (השרתון נתן אותו לחלק אחד של העלאה אחת), ולכן כאן רק בודקים שהוא באמת קישור כזה:
   R2 של Cloudflare, נתיב של קובץ בסטודיו (st/<uid>/<מזהה>), חלק של Multipart וחתימה — לא שער פתוח לכל כתובת.
   הגוף לא נקרא בזיכרון: זורם הלאה באורך קבוע (FixedLengthStream — R2 דורש Content-Length). Workers בחינם: עד 100MB לבקשה.
   GET = "יש כאן נתיב העלאה" (הטלפון בודק לפני שמשתמש בו; ב־GitHub Pages אין פונקציות → 404, נשארים בהעלאה הרגילה) */
export const UP_MAX = 100 * 1000 * 1000;
const HOST_RE = /^[a-f0-9]{32}(\.[a-z]{2,10})?\.r2\.cloudflarestorage\.com$/;
const PATH_RE = /^\/[a-z0-9][a-z0-9-]{1,61}[a-z0-9]\/st\/[A-Za-z0-9]{6,128}\/R2_j[A-Za-z0-9_-]{20}_[A-Za-z0-9]{12}$/;
const NEED = ['partNumber', 'uploadId', 'X-Amz-Algorithm', 'X-Amz-Credential', 'X-Amz-Date', 'X-Amz-Expires', 'X-Amz-SignedHeaders', 'X-Amz-Signature'];

/* הקישור החתום מ־?u= — או '' כשהוא לא קישור לחלק של העלאה בסטודיו */
export function upTarget(raw) {
  let u;
  try { u = new URL(String(raw || '')); } catch (e) { return ''; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port || u.hash || !HOST_RE.test(u.hostname) || !PATH_RE.test(u.pathname)) return '';
  const q = u.searchParams;
  for (const k of NEED) if (q.getAll(k).length !== 1) return '';
  for (const k of q.keys()) if (!NEED.includes(k)) return '';
  const n = Number(q.get('partNumber'));
  if (!Number.isInteger(n) || n < 1 || n > 10000 || q.get('X-Amz-SignedHeaders') !== 'host') return '';
  return u.href;
}

const json = (status, o) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

export async function upForward(request, env = {}) {
  const url = new URL(request.url);
  const target = upTarget(url.searchParams.get('u'));
  if (!target) return json(400, { ok: false, error: 'bad_target' });
  const len = Number(request.headers.get('content-length'));
  if (!Number.isInteger(len) || len <= 0 || len > UP_MAX || !request.body) return json(413, { ok: false, error: 'bad_length' });
  const FLS = env.FixedLengthStream || (typeof FixedLengthStream !== 'undefined' ? FixedLengthStream : null);
  let body = request.body;
  if (FLS) { const { readable, writable } = new FLS(len); request.body.pipeTo(writable).catch(() => {}); body = readable; }
  let r;
  try {
    r = await (env.fetch || fetch)(target, { method: 'PUT', body, headers: { 'content-length': String(len) }, duplex: 'half' });
  } catch (e) { return json(502, { ok: false, error: 'r2_net' }); }
  // Background Fetch: תשובה שאינה 2xx = כישלון (bad-status) — הטלפון ממשיך בהעלאה הרגילה מהחלקים שהגיעו
  if (r.status === 200) return json(200, { ok: true, etag: r.headers.get('etag') || '' });
  return json(r.status === 403 || r.status === 404 ? r.status : 502, { ok: false, error: 'r2_http_' + r.status });
}

export function onRequestGet() { return json(200, { ok: true, up: 1, max: UP_MAX }); }
export function onRequestPost({ request, env }) { return upForward(request, env); }
