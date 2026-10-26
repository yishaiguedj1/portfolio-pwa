'use strict';
/* גיבוי יומי של רשומות הדומיין (26/10/2026, שלב 4 ב־תוכנית-עמידות-שירותים.md — החלטת המשתמש: בלי Backblaze, רק זה).
   Cloudflare מייצא את כל הרשומות של thesnowball.app כקובץ BIND אחד (טקסט של כמה KB) — נכנס לגיבוי היומי (bk/<יום>/dns.txt.gz,
   14 יום ב־R2, ומשם גם ל־Drive של המנהל). אם משהו נמחק בטעות ב־Cloudflare — מייבאים את הקובץ בחזרה (DNS ← Records ← Import).
   הטוקן: CF_DNS_TOKEN (הרשאות Zone:Read + DNS:Read), או CF_USAGE_TOKEN אם יש לו אותן. בלי — לא מייצאים (בלי שגיאה). */
const ZONE_RE = /^[a-z0-9-]{1,63}(\.[a-z0-9-]{1,63})+$/;
const MAX = 1024 * 1024;

const tokenOf = (env) => String(env.CF_DNS_TOKEN || env.CF_USAGE_TOKEN || '').trim();
const zoneOf = (env) => { const z = String(env.CF_ZONE || 'thesnowball.app').trim().toLowerCase(); return ZONE_RE.test(z) ? z : ''; };

/* טהורה: קובץ BIND סביר — יש בו לפחות רשומה אחת של הדומיין, וקטן מ־MAX */
function looksBind(txt, zone) {
  const s = String(txt || '');
  if (!s || s.length > MAX) return false;
  return s.split('\n').some((l) => /\sIN\s+(A|AAAA|CNAME|MX|TXT|NS|SOA)\s/i.test(l) && l.toLowerCase().includes(zone));
}

/* מחזיר את הטקסט, או null (אין טוקן / אין הרשאה / תשובה לא צפויה) */
async function dnsExport(env, f) {
  const tok = tokenOf(env), zone = zoneOf(env);
  if (!tok || !zone) return null;
  const h = { Authorization: 'Bearer ' + tok };
  const r = await f('https://api.cloudflare.com/client/v4/zones?name=' + encodeURIComponent(zone), { headers: h });
  if (r.status !== 200) return null;
  const j = await r.json().catch(() => null);
  const id = j && Array.isArray(j.result) && j.result[0] && String(j.result[0].id || '');
  if (!/^[a-f0-9]{32}$/.test(id)) return null;
  const e = await f('https://api.cloudflare.com/client/v4/zones/' + id + '/dns_records/export', { headers: h });
  if (e.status !== 200) return null;
  const txt = await e.text();
  return looksBind(txt, zone) ? txt : null;
}

module.exports = { dnsExport, looksBind, tokenOf, zoneOf };
