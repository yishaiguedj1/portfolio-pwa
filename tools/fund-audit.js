#!/usr/bin/env node
/* בקרת הדיוק של מנתח החברות (25/10/2026, שכבות 4–5).
   מריץ את אותו fundamentals() של השרתון על רשימת חברות ומודד:
   - מול הדוח עצמו: כל ערך שנתי ב־10-K האחרון מול מה שהחברה הדפיסה (face);
   - זהויות חשבונאיות וחוקי DQC (validate) ומול Yahoo (xy);
   - סט הזהב (ibkr-proxy/lib/golden.json) — ערכים שנבדקו מול הדוחות ולא אמורים לזוז לעולם.
   שימוש: node tools/fund-audit.js [--top 500 | --syms AAPL,MA] [--out <dir>] [--hist <history.json>]
   --out כותב summary.json + report.md; --hist מוסיף את הריצה להיסטוריה (קובץ קיים או חדש).
   הסיכום (מספרים מ־SEC וסימבולים — מידע ציבורי בלבד) מתפרסם ב־Release ‏fund-audit (fund-audit.yml). */
const fs = require('fs');
const path = require('path');
const F = require('../ibkr-proxy/lib/fundamentals.js');
const GOLD = require('../ibkr-proxy/lib/golden.json');
const FA = require('../ibkr-proxy/lib/fundaudit.js');
const vm = require('vm');

/* שכבה 7: הצמיחה כפי שהמסך עצמו מחשב (analysis.js — אותו קוד שרץ בטלפון) מול הדוחות ב־SEC (FA.growthAudit) */
const AN = (() => {
  const sb = { console, Date, Math, JSON };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../analysis.js'), 'utf8').replace(/^export (async )?(function|const)/gm, '$1$2') + '\n;globalThis.A = _test;', sb);
  sb.A.setEnv({ t: (k) => k });
  return sb.A;
})();
const UA = { headers: { 'User-Agent': process.env.SEC_UA || 'TheSnowball/1.0 data@thesnowball.app' } };
async function growthCheck(r) {
  if (!r || !r.ok || r.src !== 'sec' || !r.cik || !r.tags) return;
  let facts = null;
  try { const x = await fetch('https://data.sec.gov/api/xbrl/companyfacts/CIK' + String(r.cik).padStart(10, '0') + '.json', UA); if (x.status === 200) facts = await x.json(); } catch (e) { facts = null; }
  if (!facts) return;
  const co = AN.prep(r, null, 0), fy = AN.periodList(co, 'fy').filter((p) => p.kind === 'fy');
  r.gr = []; r.grn = 0;
  for (const m of ['rev', 'ni']) {
    const tag = r.tags[m]; if (!tag || /\+/.test(tag)) continue;
    const got = fy.map((p) => AN.growthOf(co, p, m));
    r.grn += got.filter((g) => g != null).length;
    r.gr.push(...FA.growthAudit(facts, tag, co.fyE, got, m));
  }
}

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

(async () => {
  const res = [], t0 = Date.now();
  const pool = 3; let next = 0;
  async function worker() {
    while (next < syms.length) {
      const sym = syms[next++];
      let r = null;
      try { F._cache.clear(); r = await F.fundamentals(sym); await growthCheck(r); } catch (e) { r = { ok: false, error: String(e.message || e).slice(0, 40) }; }
      res.push({ sym, r });
      if (res.length % 25 === 0) process.stderr.write(res.length + '/' + syms.length + '\n');
    }
  }
  await Promise.all(Array.from({ length: pool }, worker));
  const S = FA.summarize(res, GOLD, Date.now(), Date.now() - t0);
  const pct = (a, b) => (b ? (a / b * 100).toFixed(2) + '%' : '—');
  const md = ['# בקרת דיוק — מנתח החברות', '', `${S.at} · ${S.n} חברות (${S.sec} מ־SEC, ${S.yahoo} מ־Yahoo, ${S.fail} נכשלו)`, '',
    `**מול הדוח השנתי עצמו:** ${S.face.ok}/${S.face.n} ערכים תואמים (${pct(S.face.ok, S.face.n)}); חברות שכל הערכים שלהן תואמים: ${S.face.coOk}/${S.face.cos} (${pct(S.face.coOk, S.face.cos)})`,
    `**סט הזהב:** ${S.gold.n - S.gold.bad}/${S.gold.n} חברות בלי סטייה`,
    `**צמיחה מול הדוחות (שכבה 7):** ${S.gr.n - (S.kinds.gr || 0)}/${S.gr.n} שנים תואמות (הכנסות ורווח נקי, כפי שהמסך מחשב)`, '', '| בדיקה | מספר |', '|---|---|',
    ...Object.entries(S.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`), '', '## חריגים', '',
    ...S.items.map((x) => `- ${x.sym} · ${x.k}${x.m ? ' · ' + x.m : ''} · ${x.p}${x.f != null ? ` · בדוח ${x.f} מול ${x.v}` : ''}`),
    ...(S.ni > S.items.length ? ['', `ועוד ${S.ni - S.items.length}`] : [])].join('\n');
  if (out) { fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(S, null, 1)); fs.writeFileSync(path.join(out, 'report.md'), md); }
  console.log(md.split('## חריגים')[0]);
  const hp = arg('hist', '');
  if (hp) {
    let h = []; try { h = JSON.parse(fs.readFileSync(hp, 'utf8')); } catch (e) { h = []; }
    fs.writeFileSync(hp, JSON.stringify(FA.pushHist(h, S)));
  }
  // נכשל רק כשסט הזהב זז — זה אומר שקוד/נתון שכבר נבדק השתנה
  if (S.gold.bad) process.exitCode = 1;
})();
