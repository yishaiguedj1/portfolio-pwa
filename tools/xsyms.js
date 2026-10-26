#!/usr/bin/env node
/* הרשימה הקבועה של שכבה 8 בבדיקה הלילית (ibkr-proxy/lib/xsyms.txt): S&P 500 ו־Nasdaq-100.
   S&P 500 — מהדף "List of S&P 500 companies" בוויקיפדיה (הטקסט הגולמי: {{NyseSymbol|MMM}} / {{NasdaqSymbol|AAPL}});
   Nasdaq-100 — api.nasdaq.com (אותו ממשק ש־tools/fund-xcheck.js קורא ממנו את הדוחות). מידע ציבורי בלבד.
   שימוש: node tools/xsyms.js [--dry]  — כותב רק כשהרשימה השתנתה, ורק כששני המקורות בגודל הצפוי (דף שהשתנה = לא דורסים).
   מתי: כשהמדדים מתעדכנים (S&P מעדכן כל רבעון, Nasdaq-100 בדצמבר) — או כצעד בעדכון החודשי של היקום (stock-universe.yml). */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '../ibkr-proxy/lib/xsyms.txt');
const SYM = /^[A-Z][A-Z0-9.]{0,6}$/;
const BR = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36';

function parseSp(wikitext) {
  const out = [];
  for (const m of String(wikitext || '').matchAll(/\{\{(?:NyseSymbol|NasdaqSymbol|nyse|nasdaq)\|([^}|]+)/gi)) { const s = m[1].trim().toUpperCase(); if (SYM.test(s) && !out.includes(s)) out.push(s); }
  return out;
}
function parseNdx(j) {
  const rows = (j && j.data && j.data.data && j.data.data.rows) || [];
  return rows.map((r) => String((r && r.symbol) || '').trim().toUpperCase()).filter((s) => SYM.test(s));
}
const merge = (a, b) => [...new Set([...a, ...b])].sort();
// S&P 500: ‏~503 מניות (500 חברות, שלוש עם שני סוגים); Nasdaq-100: ‏~101 — מחוץ לטווח = הדף / הממשק השתנה
function check(sp, nd) {
  if (sp.length < 490 || sp.length > 520) return 'sp_' + sp.length;
  if (nd.length < 95 || nd.length > 110) return 'ndx_' + nd.length;
  return null;
}

async function main() {
  const [w, n] = await Promise.all([
    fetch('https://en.wikipedia.org/w/index.php?title=List_of_S%26P_500_companies&action=raw', { headers: { 'User-Agent': 'TheSnowball/1.0 (data@thesnowball.app)' } }).then((r) => (r.ok ? r.text() : '')),
    fetch('https://api.nasdaq.com/api/quote/list-type/nasdaq100', { headers: { 'User-Agent': BR, Accept: 'application/json' } }).then((r) => (r.ok ? r.json() : null)),
  ]);
  const sp = parseSp(w), nd = parseNdx(n), bad = check(sp, nd);
  if (bad) { console.error('לא מעדכנים: ' + bad); process.exitCode = 2; return; }
  const next = merge(sp, nd), cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8').split('\n').filter(Boolean) : [];
  const add = next.filter((s) => !cur.includes(s)), rm = cur.filter((s) => !next.includes(s));
  console.log(`S&P 500: ${sp.length} · Nasdaq-100: ${nd.length} · יחד: ${next.length}` + (add.length ? ' · נכנסו: ' + add.join(' ') : '') + (rm.length ? ' · יצאו: ' + rm.join(' ') : ''));
  if (!add.length && !rm.length) { console.log('בלי שינוי'); return; }
  if (!process.argv.includes('--dry')) fs.writeFileSync(OUT, next.join('\n') + '\n');
}

module.exports = { parseSp, parseNdx, merge, check };
if (require.main === module) main().catch((e) => { console.error(e.message || e); process.exitCode = 1; });
