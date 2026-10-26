#!/usr/bin/env node
/* שכבה 8 בבקרת הדיוק (26/10/2026): כל ערך שנתי ורבעוני מול SEC גולמי, הדוח המודפס, Yahoo ו־Nasdaq.
   שימוש: node tools/fund-xcheck.js [--syms A,B | --file syms.txt] [--out <dir>] [--pool 3]
   כותב <out>/rows.json (כל ערך שאינו ok) + summary.json + report.md. מידע ציבורי בלבד. */
const fs = require('fs');
const path = require('path');
const F = require('../ibkr-proxy/lib/fundamentals.js');
const X = require('../ibkr-proxy/lib/fundxcheck.js');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const out = arg('out', '');
let syms = (arg('syms', '') || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
if (!syms.length && arg('file')) syms = fs.readFileSync(arg('file'), 'utf8').split(/\s+/).map((s) => s.trim().toUpperCase().replace('.', '-')).filter(Boolean);
const UA = process.env.SEC_UA || 'TheSnowball/1.0 data@thesnowball.app';
const BR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(url, headers, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try { const r = await fetch(url, { headers }); if (r.status === 200) return await r.json(); if (r.status === 404) return null; } catch (e) { /* ניסיון נוסף */ }
    await sleep(1500 * (t + 1));
  }
  return null;
}
const YK = { rev: 'TotalRevenue', gp: 'GrossProfit', op: 'OperatingIncome', ni: 'NetIncomeCommonStockholders', eps: 'DilutedEPS', sh: 'DilutedAverageShares',
  ocf: 'OperatingCashFlow', capex: 'CapitalExpenditure', cash: 'CashAndCashEquivalents', ta: 'TotalAssets', tl: 'TotalLiabilitiesNetMinorityInterest',
  eq: 'StockholdersEquity', ca: 'CurrentAssets', cl: 'CurrentLiabilities' };
async function yahoo(sym) {
  const types = ['annual', 'quarterly'].flatMap((p) => Object.values(YK).map((t) => p + t)).join(',');
  const j = await json('https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/' + encodeURIComponent(sym) + '?type=' + types +
    '&period1=1262304000&period2=' + Math.floor(Date.now() / 1000 + 86400), { 'User-Agent': BR });
  return j ? F.parseYahooTs(j) : null;
}
async function nasdaq(sym, f) {
  const j = await json('https://api.nasdaq.com/api/company/' + encodeURIComponent(sym) + '/financials?frequency=' + f, { 'User-Agent': BR, Accept: 'application/json' });
  return j ? X.parseNasdaq(j) : null;
}

(async () => {
  const res = [], t0 = Date.now(), pool = +arg('pool', 3);
  let next = 0;
  async function worker() {
    while (next < syms.length) {
      const sym = syms[next++];
      let x = [], err = null, src = null;
      try {
        F._cache.clear();
        const d = await F.fundamentals(sym);
        src = d && d.src;
        if (d && d.ok && d.src === 'sec' && d.cik) {
          const [facts, y, nA, nQ] = await Promise.all([
            json('https://data.sec.gov/api/xbrl/companyfacts/CIK' + String(d.cik).padStart(10, '0') + '.json', { 'User-Agent': UA }),
            yahoo(sym), nasdaq(sym, 1), nasdaq(sym, 2)]);
          x = X.xcheck(d, facts, y, { A: nA, Q: nQ });
        }
      } catch (e) { err = String(e.message || e).slice(0, 60); }
      res.push({ sym, src, err, x });
      if (res.length % 20 === 0) process.stderr.write(res.length + '/' + syms.length + ' · ' + Math.round((Date.now() - t0) / 1000) + 's\n');
    }
  }
  await Promise.all(Array.from({ length: pool }, worker));
  const S = X.summarizeX(res);
  const lines = ['# שכבה 8 — כל ערך מול כמה מקורות', '', `${new Date().toISOString().slice(0, 16)} · ${res.length} חברות · ${S.n} ערכים · ${Math.round((Date.now() - t0) / 60000)} דק׳`, '',
    '| הכרעה | ערכים |', '|---|---|', ...Object.entries(S.c).sort((a, b) => b[1] - a[1]).map(([k, n]) => `| ${k} | ${n} |`), '',
    '| מדד | ok | def | ext | bug | one | none |', '|---|---|---|---|---|---|---|',
    ...Object.entries(S.byM).sort().map(([m, b]) => `| ${m} | ${b.ok || 0} | ${b.def || 0} | ${b.ext || 0} | ${b.bug || 0} | ${b.one || 0} | ${b.none || 0} |`), '',
    `נכשלו / לא SEC: ${res.filter((r) => r.err || r.src !== 'sec').map((r) => r.sym + (r.err ? '(' + r.err + ')' : '·' + r.src)).join(', ')}`];
  if (out) {
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'rows.json'), JSON.stringify(res.map((r) => ({ sym: r.sym, src: r.src, err: r.err, x: r.x.filter((v) => v.c !== 'ok') }))));
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(S, null, 1));
    fs.writeFileSync(path.join(out, 'report.md'), lines.join('\n'));
  }
  console.log(lines.join('\n'));
})();
