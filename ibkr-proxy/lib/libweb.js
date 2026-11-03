'use strict';
/* Academy Pro גל 6 (03/11/2026): חיבורים לרשת ולמכשירים — לשני ops ב־/api/library (רק משתמש מחובר):
   1. webGet — דף או פיד מהרשת בשביל "מאמר מקישור" (C10) ו"עיתון בוקר" (C11). הגנה מ־SSRF: רק http/https בפורט רגיל,
      בלי כתובות פנימיות (גם אחרי DNS וגם בכל הפניה), עד 4 הפניות, 2.5MB, 9 שניות. מחזיר טקסט — הניתוח בטלפון (DOMParser).
   2. inbox — "תיבת דואר" פרטית ב־R2 (inbox/<uid>/): הרצאה מ־Studio (C12), שליחת ספר למכשיר אחר (G4).
      put → כתובת העלאה חתומה; list → מה מחכה (ומחיקה של מה שישן מ־14 יום); get → כתובת הורדה חתומה; del. */
const dns = require('dns').promises;
const net = require('net');

const WEB_MAX = 2.5 * 1024 * 1024, WEB_MS = 9000, HOPS = 4;
const INBOX_MAX = 60 * 1024 * 1024, INBOX_KEEP = 14 * 864e5, INBOX_N = 40;
const TYPES = /^(text\/html|application\/xhtml\+xml|application\/(rss|atom)\+xml|application\/xml|text\/xml|text\/plain)\b/i;

function privateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === '::' || x === '::1') return true;
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x); if (m) return privateIp(m[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x) || x.startsWith('64:ff9b:') || x.startsWith('2001:db8');
  }
  return true;
}
function checkUrl(u) {      // טהורה: האם הכתובת מותרת בכלל (לפני DNS)
  let x; try { x = new URL(String(u || '').trim()); } catch (e) { return null; }
  if (!/^https?:$/.test(x.protocol) || x.username || x.password) return null;
  if (x.port && !['80', '443'].includes(x.port)) return null;
  const host = x.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal') || !host.includes('.') && !net.isIP(host)) return null;
  if (net.isIP(host) && privateIp(host)) return null;
  x.hash = '';
  return x;
}
async function hostOk(host, deps) {
  if (net.isIP(host)) return !privateIp(host);
  const look = deps.lookup || ((h) => dns.lookup(h, { all: true }));
  let addrs; try { addrs = await look(host); } catch (e) { return false; }
  return Array.isArray(addrs) && addrs.length > 0 && addrs.every((a) => !privateIp(a.address || a));
}
function charsetOf(ct, head) {
  const m = /charset=["']?([\w-]+)/i.exec(ct || '') || /<meta[^>]+charset=["']?([\w-]+)/i.exec(head || '') || /<\?xml[^>]+encoding=["']([\w-]+)/i.exec(head || '');
  const c = (m ? m[1] : 'utf-8').toLowerCase();
  return /^(utf-8|utf8|windows-1255|iso-8859-8|iso-8859-1|windows-1252|utf-16le|koi8-r|windows-1251)$/.test(c) ? c.replace('utf8', 'utf-8') : 'utf-8';
}
async function webGet(url, deps = {}) {
  let u = checkUrl(url); if (!u) return { status: 400, j: { ok: false, error: 'bad_url' } };
  const f = deps.fetch || fetch;
  const t0 = Date.now();
  for (let hop = 0; hop <= HOPS; hop++) {
    if (!(await hostOk(u.hostname.replace(/^\[|\]$/g, ''), deps))) return { status: 400, j: { ok: false, error: 'bad_host' } };
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), Math.max(1000, WEB_MS - (Date.now() - t0)));
    let r;
    try {
      r = await f(u.href, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36 TheSnowballReader', Accept: 'text/html,application/xhtml+xml,application/rss+xml,application/atom+xml,application/xml;q=0.9,*/*;q=0.5', 'Accept-Language': 'he,en;q=0.8' } });
    } catch (e) { clearTimeout(tm); return { status: 502, j: { ok: false, error: 'fetch_failed' } }; }
    if (r.status >= 300 && r.status < 400) {
      clearTimeout(tm);
      const loc = r.headers.get('location'); if (!loc) return { status: 502, j: { ok: false, error: 'bad_redirect' } };
      u = checkUrl(new URL(loc, u).href); if (!u) return { status: 400, j: { ok: false, error: 'bad_url' } };
      continue;
    }
    try {
      if (r.status !== 200) return { status: 502, j: { ok: false, error: 'http_' + r.status } };
      const ct = r.headers.get('content-type') || 'text/html';
      if (!TYPES.test(ct)) return { status: 415, j: { ok: false, error: 'bad_type' } };
      const len = Number(r.headers.get('content-length') || 0); if (len > WEB_MAX) return { status: 413, j: { ok: false, error: 'too_big' } };
      const buf = await readMax(r, WEB_MAX); if (!buf) return { status: 413, j: { ok: false, error: 'too_big' } };
      const cs = charsetOf(ct, buf.slice(0, 2048).toString('latin1'));
      let text; try { text = new TextDecoder(cs).decode(buf); } catch (e) { text = buf.toString('utf8'); }
      return { status: 200, j: { ok: true, url: u.href, type: ct.split(';')[0].trim().toLowerCase(), text } };
    } catch (e) { return { status: 502, j: { ok: false, error: 'fetch_failed' } }; }
    finally { clearTimeout(tm); }
  }
  return { status: 502, j: { ok: false, error: 'too_many_redirects' } };
}
async function readMax(r, max) {
  if (r.body && r.body.getReader) {
    const rd = r.body.getReader(); const parts = []; let n = 0;
    for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.length; if (n > max) { try { rd.cancel(); } catch (e) {} return null; } parts.push(Buffer.from(value)); }
    return Buffer.concat(parts);
  }
  const b = Buffer.from(await r.arrayBuffer()); return b.length > max ? null : b;
}

/* ---------- תיבת הדואר ---------- */
const b64u = (s) => Buffer.from(String(s), 'utf8').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const unb64u = (s) => { try { return Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch (e) { return ''; } };
const EXT = { epub: 'application/epub+zip', md: 'text/markdown' };
function inboxKey(uid, name, ext, from, now, rnd) {      // inbox/<uid>/<זמן>_<אקראי>_<מאיפה>_<שם>.<סוג> — הכל בתווים שמותרים במפתח
  const nm = b64u(String(name || 'book').replace(/[\u0000-\u001f]/g, '').slice(0, 90)).slice(0, 160);
  return 'inbox/' + uid + '/' + now.toString(36) + '_' + rnd + '_' + (from === 'studio' ? 's' : 'a') + '_' + nm + '.' + ext;
}
function inboxItem(uid, o) {
  const m = new RegExp('^inbox/' + uid + '/([a-z0-9]+)_([A-Za-z0-9]+)_([sa])_([A-Za-z0-9_-]*)\\.(epub|md)$').exec(o.key);
  if (!m) return null;
  return { id: o.key.slice(('inbox/' + uid + '/').length), at: parseInt(m[1], 36) || o.at, from: m[3] === 's' ? 'studio' : 'academy', name: unb64u(m[4]), ext: m[5], size: o.size };
}
async function inbox(body, uid, c, R2, deps = {}) {
  if (!c) return { status: 503, j: { ok: false, error: 'no_store' } };
  if (!/^[A-Za-z0-9]{6,64}$/.test(uid)) return { status: 400, j: { ok: false, error: 'bad_user' } };
  const now = (deps.now || Date.now)(), act = body.act, rd = { fetch: deps.fetch };
  const pre = 'inbox/' + uid + '/';
  const okId = (id) => typeof id === 'string' && /^[a-z0-9]+_[A-Za-z0-9]+_[sa]_[A-Za-z0-9_-]*\.(epub|md)$/.test(id) && id.length < 260;
  if (act === 'put') {
    const ext = EXT[body.ext] ? body.ext : null, size = Number(body.size) || 0;
    if (!ext || size <= 0 || size > INBOX_MAX) return { status: 400, j: { ok: false, error: 'bad_params' } };
    const have = await R2.list(c, rd, pre, 200);
    if (have.length >= INBOX_N) return { status: 429, j: { ok: false, error: 'inbox_full' } };
    const rnd = require('crypto').randomBytes(6).toString('hex');
    const key = inboxKey(uid, body.name, ext, body.from, now, rnd);
    return { status: 200, j: { ok: true, id: key.slice(pre.length), url: await R2.presign(c, rd, { method: 'PUT', key, expires: 900 }), type: EXT[ext] } };
  }
  if (act === 'list') {
    const all = await R2.list(c, rd, pre, 400), items = [];
    for (const o of all) {
      const it = inboxItem(uid, o);
      if (!it || now - it.at > INBOX_KEEP) { await R2.del(c, rd, o.key).catch(() => {}); continue; }
      if (o.size > 0) items.push(it);
    }
    items.sort((a, b) => a.at - b.at);
    return { status: 200, j: { ok: true, items } };
  }
  if (act === 'get' || act === 'del') {
    if (!okId(body.id)) return { status: 400, j: { ok: false, error: 'bad_params' } };
    const key = pre + body.id;
    if (act === 'del') { await R2.del(c, rd, key).catch(() => {}); return { status: 200, j: { ok: true } }; }
    return { status: 200, j: { ok: true, url: await R2.presign(c, rd, { method: 'GET', key, expires: 600 }) } };
  }
  return { status: 400, j: { ok: false, error: 'bad_act' } };
}

module.exports = { webGet, checkUrl, privateIp, charsetOf, inbox, inboxKey, inboxItem, WEB_MAX, INBOX_MAX, INBOX_KEEP };
