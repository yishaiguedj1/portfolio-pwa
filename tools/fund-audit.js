#!/usr/bin/env node
/* בקרת הדיוק של מנתח החברות (25/10/2026, שכבות 4–5).
   מריץ את אותו fundamentals() של השרתון על רשימת חברות ומודד:
   - מול הדוח עצמו: כל ערך שנתי ב־10-K האחרון מול מה שהחברה הדפיסה (face);
   - זהויות חשבונאיות וחוקי DQC (validate) ומול Yahoo (xy);
   - סט הזהב (ibkr-proxy/lib/golden.json) — ערכים שנבדקו מול הדוחות ולא אמורים לזוז לעולם.
   שימוש: node tools/fund-audit.js [--top 500 | --syms AAPL,MA] [--out <dir>] [--post <url>]
   --post שולח רק את הסיכום (מספרים וסימבולים — מידע ציבורי) לשרתון, עם FUND_AUDIT_SECRET. */
const fs = require('fs');
const path = require('path');
const F = require('../ibkr-proxy/lib/fundamentals.js');
const GOLD = require('../ibkr-proxy/lib/golden.json');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', '');
let syms = (arg('syms', '') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
if (!syms.length) {
  const top = +arg('top', 500), seen = new Set();
  for (const l of fs.readFileSync(path.join(__dirname, '../ibkr-proxy/lib/universe.txt'), 'utf8').split('\n')) {
    const [s, name = ''] = l.split('|');
    if (!s || /\b(ETF|Fund|Trust|Class [B-Z]|Capital Stock|Depositary|Notes?|Warrant)\b/i.test(name) || /[.^=]/.test(s)) continue;
    const key = name.replace(/\b(Inc|Corp|Corporation|Company|Co|Ltd|plc|Holdings?)\b\.?|[,.]/gi, '').trim().toLowerCase();
    if (seen.has(key)) continue; seen.add(key); syms.push(s);
    if (syms.length >= top) break;
  }
}

/* סט הזהב: כל ערך מול מה שנשמר מהדוח (עד 0.5%; למניה — עד סנט) */
function goldCheck(sym, r) {
  const g = GOLD.companies[sym]; if (!g || !r || !r.A) return [];
  const bad = [];
  for (const [k, byYear] of Object.entries(g.v)) for (const [end, want] of Object.entries(byYear)) {
    const i = r.fy.findIndex((e) => Math.abs(Date.parse(e) - Date.parse(end)) < 9 * 864e5);
    const got = i >= 0 && r.A[k] ? r.A[k][i] : null;
    const tol = k === 'eps' ? 0.011 : 0.005 * Math.abs(want);
    if (got == null || Math.abs(Math.abs(got) - Math.abs(want)) > tol) bad.push({ sym, m: k, p: end, want, got });
  }
  return bad;
}

(async () => {
  const res = [], t0 = Date.now();
  const pool = 3; let next = 0;
  async function worker() {
    while (next < syms.length) {
      const sym = syms[next++];
      let r = null;
      try { F._cache.clear(); r = await F.fundamentals(sym); } catch (e) { r = { ok: false, error: String(e.message || e).slice(0, 40) }; }
      res.push({ sym, r });
      if (res.length % 25 === 0) process.stderr.write(res.length + '/' + syms.length + '\n');
    }
  }
  await Promise.all(Array.from({ length: pool }, worker));
  const S = { at: new Date().toISOString(), n: syms.length, sec: 0, yahoo: 0, fail: 0, face: { n: 0, ok: 0, cos: 0, coOk: 0 }, kinds: {}, gold: { n: 0, bad: 0 }, items: [] };
  for (const { sym, r } of res) {
    if (!r || !r.ok) { S.fail++; continue; }
    if (r.src !== 'sec') { S.yahoo++; continue; }
    S.sec++;
    if (r.face) { S.face.n += r.face.n; S.face.ok += r.face.ok; S.face.cos++; if (r.face.n && r.face.ok === r.face.n) S.face.coOk++; }
    for (const c of r.checks || []) {
      S.kinds[c.k] = (S.kinds[c.k] || 0) + 1;
      S.items.push({ sym, k: c.k, m: c.m || null, p: c.p, f: c.f != null ? c.f : null, v: c.v != null ? c.v : null });
    }
    if (GOLD.companies[sym]) {
      const gb = goldCheck(sym, r); S.gold.n++; if (gb.length) S.gold.bad++;
      for (const b of gb) S.items.push({ sym, k: 'gold', m: b.m, p: b.p, f: b.want, v: b.got });
    }
  }
  S.ms = Date.now() - t0;
  const pct = (a, b) => (b ? (a / b * 100).toFixed(2) + '%' : '—');
  const md = ['# בקרת דיוק — מנתח החברות', '', `${S.at} · ${S.n} חברות (${S.sec} מ־SEC, ${S.yahoo} מ־Yahoo, ${S.fail} נכשלו)`, '',
    `**מול הדוח השנתי עצמו:** ${S.face.ok}/${S.face.n} ערכים תואמים (${pct(S.face.ok, S.face.n)}); חברות שכל הערכים שלהן תואמים: ${S.face.coOk}/${S.face.cos} (${pct(S.face.coOk, S.face.cos)})`,
    `**סט הזהב:** ${S.gold.n - S.gold.bad}/${S.gold.n} חברות בלי סטייה`, '', '| בדיקה | מספר |', '|---|---|',
    ...Object.entries(S.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`), '', '## חריגים', '',
    ...S.items.map((x) => `- ${x.sym} · ${x.k}${x.m ? ' · ' + x.m : ''} · ${x.p}${x.f != null ? ` · בדוח ${x.f} מול ${x.v}` : ''}`)].join('\n');
  if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(S, null, 1)); fs.writeFileSync(path.join(out, 'report.md'), md); }
  console.log(md.split('## חריגים')[0]);
  const post = arg('post', '');
  if (post && process.env.FUND_AUDIT_SECRET) {
    const body = { op: 'fundAudit', s: { ...S, items: S.items.slice(0, 200) } };
    const r = await fetch(post, { method: 'POST', headers: { 'content-type': 'application/json', 'x-audit-secret': process.env.FUND_AUDIT_SECRET }, body: JSON.stringify(body) });
    console.log('post', r.status);
  }
  // נכשל רק כשסט הזהב זז — זה אומר שקוד/נתון שכבר נבדק השתנה
  if (S.gold.bad) process.exitCode = 1;
})();
