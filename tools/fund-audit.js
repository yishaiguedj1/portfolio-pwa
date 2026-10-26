#!/usr/bin/env node
/* בקרת הדיוק של מנתח החברות (25/10/2026, שכבות 4–5).
   מריץ את אותו fundamentals() של השרתון על רשימת חברות ומודד:
   - מול הדוח עצמו: כל ערך שנתי ב־10-K האחרון מול מה שהחברה הדפיסה (face);
   - זהויות חשבונאיות וחוקי DQC (validate) ומול Yahoo (xy);
   - סט הזהב (ibkr-proxy/lib/golden.json) — ערכים שנבדקו מול הדוחות ולא אמורים לזוז לעולם;
   - שכבה 8 (--xsyms): כל ערך שנתי ורבעוני מול SEC גולמי, הדוח, Yahoo ו־Nasdaq (lib/fundxcheck.js, אותה השוואה של tools/fund-xcheck.js)
     על רשימה קבועה — S&P 500 ו־Nasdaq-100 (ibkr-proxy/lib/xsyms.txt, מתעדכנת ב־tools/xsyms.js). חברה מהרשימה שאינה ב־500 הגדולות
     נבדקת רק בשכבה 8 (xo) — כדי שהמספרים של שכבות 1–7 יישארו על אותן 500 חברות כמו בהיסטוריה.
   שימוש: node tools/fund-audit.js [--top 500 | --syms AAPL,MA] [--xsyms <file>] [--out <dir>] [--hist <history.json>]
   --out כותב summary.json + report.md; --hist מוסיף את הריצה להיסטוריה (קובץ קיים או חדש).
   הסיכום (מספרים מ־SEC וסימבולים — מידע ציבורי בלבד) מתפרסם ב־Release ‏fund-audit (fund-audit.yml). */
const fs = require('fs');
const path = require('path');
const F = require('../ibkr-proxy/lib/fundamentals.js');
const GOLD = require('../ibkr-proxy/lib/golden.json');
const FA = require('../ibkr-proxy/lib/fundaudit.js');
const XC = require('./fund-xcheck.js');
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
async function getFacts(r) {
  if (!r || !r.ok || r.src !== 'sec' || !r.cik) return null;
  try { const x = await fetch('https://data.sec.gov/api/xbrl/companyfacts/CIK' + String(r.cik).padStart(10, '0') + '.json', UA); if (x.status === 200) return await x.json(); } catch (e) { /* בלי companyfacts — שכבות 7–8 מדלגות */ }
  return null;
}
function growthCheck(r, facts) {
  if (!r || !r.ok || r.src !== 'sec' || !r.cik || !r.tags || !facts) return;
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
// שכבה 8: רשימה קבועה (סימבול בכל שורה; BRK.B → BRK-B כמו ב־Yahoo). מה שלא ב־500 — בסוף, רק לשכבה 8
const xsyms = new Set();
if (arg('xsyms', '')) for (const s of fs.readFileSync(arg('xsyms'), 'utf8').split(/\s+/)) { const t = s.trim().toUpperCase().replace('.', '-'); if (t) xsyms.add(t); }
const xonly = new Set([...xsyms].filter((s) => !syms.includes(s)));
syms.push(...xonly);

/* שכבה 8 בדוח: ההכרעות, ההסברים הנפוצים, וכל ערך לבדוק (bug/spl/estx/ext/odd/one) — כולם (ב־summary.json רק 400 הראשונים) */
const xm = (x) => (x == null ? '—' : Math.abs(x) >= 1e6 ? (Math.round(x / 1e5) / 10).toLocaleString('en-US') + 'M' : String(Math.round(x * 1000) / 1000));
function xReport(x) {
  if (!x) return [];
  return ['', '## שכבה 8 — כל ערך מול כמה מקורות', '', `${x.n} ערכים · ${x.cos} חברות · ${x.p} לבדוק`, '', '| הכרעה | ערכים |', '|---|---|',
    ...Object.entries(x.c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`), '', '| הכרעה · הסבר | ערכים |', '|---|---|',
    ...Object.entries(x.why).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`), '', '### ערכים לבדוק', '',
    ...x.items.map((r) => `- ${r.sym} · ${r.k}:${r.m} · ${r.p} · **${r.c}**${r.why ? ' (' + r.why + ')' : ''} · אנחנו ${xm(r.v)} · SEC ${xm(r.raw)} · Yahoo ${xm(r.y)} · Nasdaq ${xm(r.n)}`),
    ...(x.p > x.items.length ? ['', `ועוד ${x.p - x.items.length}`] : [])];
}

/* --seen: מניות שמשתמשים פתחו ויש בהן אי־התאמה (השרתון רושם — lib/fundamentals.js noteFlags; רק סימבולים).
   נבדקות כאן כדי שנתקן אותן בקוד — בסיכום רק כחריגים (uo), בלי לשנות את המספרים של 500 הגדולות */
const SEEN_API = ['https://api.thesnowball.app/api/history', 'https://ibkr-proxy-wine.vercel.app/api/history'];
async function seenSyms() {
  for (const u of SEEN_API) {
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://invest.thesnowball.app' }, body: JSON.stringify({ op: 'fundFlags' }) });
      const j = r.status === 200 ? await r.json() : null;
      if (j && j.ok && Array.isArray(j.syms)) return j.syms.filter((x) => /^[A-Z0-9][A-Z0-9.\-]{0,15}$/.test(x));
    } catch (e) { /* הכתובת הבאה */ }
  }
  return [];
}
const uonly = new Set();

(async () => {
  if (process.argv.includes('--seen')) {
    for (const s of await seenSyms()) if (!syms.includes(s)) { uonly.add(s); syms.push(s); }
    process.stderr.write('מניות שמשתמשים פתחו עם אי־התאמה: ' + uonly.size + '\n');
  }
  const res = [], t0 = Date.now();
  const pool = 3; let next = 0;
  async function worker() {
    while (next < syms.length) {
      const sym = syms[next++];
      let r = null, x;
      try {
        F._cache.delete('fund:' + sym); r = await F.fundamentals(sym);   // לא clear(): עובד מקביל היה מוחק את הדוח המודפס של חברה אחרת באמצע
        const face = XC.faceOf(r);   // מיד — לפני await (עובד אחר מנקה את המטמון)
        const facts = await getFacts(r);
        if (!xonly.has(sym) && !uonly.has(sym)) growthCheck(r, facts);
        if (xsyms.has(sym)) x = facts ? await XC.checkOne(sym, r, facts, face) : [];
      } catch (e) { r = { ok: false, error: String(e.message || e).slice(0, 40) }; }
      res.push(Object.assign({ sym, r }, x ? { x } : {}, xonly.has(sym) ? { xo: 1 } : {}, uonly.has(sym) ? { uo: 1 } : {}));
      if (res.length % 25 === 0) process.stderr.write(res.length + '/' + syms.length + '\n');
    }
  }
  await Promise.all(Array.from({ length: pool }, worker));
  const S = FA.summarize(res, GOLD, Date.now(), Date.now() - t0);
  const pct = (a, b) => (b ? (a / b * 100).toFixed(2) + '%' : '—');
  const md = ['# בקרת דיוק — מנתח החברות', '', `${S.at} · ${S.n} חברות (${S.sec} מ־SEC, ${S.yahoo} מ־Yahoo, ${S.fail} נכשלו)`, '',
    `**מול הדוח השנתי עצמו:** ${S.face.ok}/${S.face.n} ערכים תואמים (${pct(S.face.ok, S.face.n)}); חברות שכל הערכים שלהן תואמים: ${S.face.coOk}/${S.face.cos} (${pct(S.face.coOk, S.face.cos)})`,
    `**סט הזהב:** ${S.gold.n - S.gold.bad}/${S.gold.n} חברות בלי סטייה`,
    `**צמיחה מול הדוחות (שכבה 7):** ${S.gr.n - (S.kinds.gr || 0)}/${S.gr.n} שנים תואמות (הכנסות ורווח נקי, כפי שהמסך מחשב)`,
    S.x ? `**כל ערך מול כמה מקורות (שכבה 8):** ${S.x.p} ערכים לבדוק מתוך ${S.x.n} (${S.x.cos} חברות, S&P 500 ו־Nasdaq-100; מתוכם ${S.x.b} שונים מ־SEC)` : '',
    '', '| בדיקה | מספר |', '|---|---|',
    ...Object.entries(S.kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`),
    ...(S.u ? ['', `## מניות שמשתמשים פתחו (מחוץ ל־500) — ${S.u.n} מניות, ${S.u.items.length} חריגים`, '', ...S.u.items.map((x) => `- ${x.sym} · ${x.k}${x.m ? ' · ' + x.m : ''} · ${x.p}${x.f != null ? ` · בדוח ${x.f} מול ${x.v}` : ''}`)] : []),
    '', '## חריגים', '',
    ...S.items.map((x) => `- ${x.sym} · ${x.k}${x.m ? ' · ' + x.m : ''} · ${x.p}${x.f != null ? ` · בדוח ${x.f} מול ${x.v}` : ''}`),
    ...(S.ni > S.items.length ? ['', `ועוד ${S.ni - S.items.length}`] : []), ...xReport(S.x ? FA.xSummary(res, Infinity) : null)].join('\n');
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
