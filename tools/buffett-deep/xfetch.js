#!/usr/bin/env node
/* בדיקת העומק של מכפיל באפט — גל 1: הורדת נתוני XBRL של SEC לבדיקה העצמאית של הרכיבים (docs/buffett-pe-audit.md).
   1. companyfacts של כל CIK ב־tools/fund-deep/ciks.tsv — המקור שממנו xbrl.py מחלץ בעצמו כל רבעון (בלי הקוד של השרתון).
   2. frames — מקור שני מאותו מאגר, אבל בבחירה של SEC (ערך אחד לחברה לכל תקופה קלנדרית): לכל מושג ברשימה, הרבעונים
      CY<שנה>Q<n> מהרבעון השלישי של 2024 ועד היום, וגם השנים CY2024/CY2025. בקשה אחת = כל החברות.
   3. ‏--inst <tsv>: קובץ ה־instance ‏(‎<doc>_htm.xml‎) של כל הגשה תקופתית שחסרה ב־companyfacts (הרשימה — xbrl.py ‏--missing).
      השרתון משלים אותן ב־lib/secxbrl.js (עד 4 להגשה); כאן מורידים את כולן, ו־xbrl.py מפענח בעצמו.
   הכל דרך sec.js (מטמון, 250ms, המתנה ב־429). לא להריץ במקביל לתהליך אחר שפונה ל־SEC.
   שימוש: BD_DIR=<dir> node tools/buffett-deep/xfetch.js [--facts] [--frames] [--syms A,B] [--inst <tsv>] */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sec = require('./sec');

const argv = process.argv.slice(2);
const arg = (k) => { const i = argv.indexOf('--' + k); return i < 0 ? null : argv[i + 1]; };
const both = !argv.includes('--facts') && !argv.includes('--frames') && !argv.includes('--inst');

// המושגים לרבעון (משך של כ־3 חודשים) — מה שנכנס למכפיל: רווח למניה, מניות, מס, רווח לפני מס, הכנסות, תגמול
const FRAMES = [
  ['EarningsPerShareDiluted', 'USD-per-shares'],
  ['WeightedAverageNumberOfDilutedSharesOutstanding', 'shares'],
  ['IncomeTaxExpenseBenefit', 'USD'],
  ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest', 'USD'],
  ['IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments', 'USD'],
  ['Revenues', 'USD'],
  ['RevenueFromContractWithCustomerExcludingAssessedTax', 'USD'],
  ['AllocatedShareBasedCompensationExpense', 'USD'],
  ['ShareBasedCompensation', 'USD'],
  ['NetIncomeLoss', 'USD'],
];
function periods(now) {
  const out = [];
  const y1 = new Date(now).getUTCFullYear();
  for (let y = 2024; y <= y1; y++) {
    for (let q = 1; q <= 4; q++) {
      const end = Date.UTC(y, q * 3, 0);
      if (end > now) break;
      if (y === 2024 && q < 3) continue;
      out.push('CY' + y + 'Q' + q);
    }
    if (Date.UTC(y, 11, 31) < now) out.push('CY' + y);
  }
  return out;
}

// הקובץ שמחלץ SEC מה־iXBRL של ההגשה: ‏aep-20260930.htm → ‏aep-20260930_htm.xml
const instUrl = (cik, acc, doc) => 'https://www.sec.gov/Archives/edgar/data/' + Number(cik) + '/' + String(acc).replace(/-/g, '') + '/' + String(doc).replace(/\.htm$/i, '') + '_htm.xml';

async function main() {
  if (arg('inst')) {
    const L = fs.readFileSync(arg('inst'), 'utf8').trim().split('\n').filter((l) => l && l[0] !== '#').map((l) => l.split('\t'));
    let ok = 0;
    for (const [cik, acc, , , , doc] of L) {
      try { await sec.get(instUrl(cik, acc, doc)); ok++; }
      catch (e) { console.error('instance', cik, acc, String(e && e.message).slice(0, 80)); }
    }
    console.log('instance:', ok + '/' + L.length);
    return;
  }
  let list = fs.readFileSync(path.join(__dirname, '..', 'fund-deep', 'ciks.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
  if (arg('syms')) { const w = new Set(arg('syms').split(',')); list = list.filter(([s]) => w.has(s)); }
  if (both || argv.includes('--facts')) {
    let k = 0;
    for (const [sym, cik] of list) {
      k++;
      try { await sec.facts(cik); if (k % 25 === 0) console.log(new Date().toISOString().slice(11, 19), 'companyfacts', k + '/' + list.length, sym); }
      catch (e) { console.error(sym, 'companyfacts נכשל:', String(e && e.message).slice(0, 100)); }
    }
  }
  if (both || argv.includes('--frames')) {
    const P = periods(Date.now());
    for (const [c, u] of FRAMES) for (const p of P) {
      try { await sec.get('https://data.sec.gov/api/xbrl/frames/us-gaap/' + c + '/' + u + '/' + p + '.json'); }
      catch (e) { if (e.code !== 404) console.error('frames', c, p, String(e.message).slice(0, 80)); }
    }
    console.log('frames:', FRAMES.length + '×' + P.length, P.join(' '));
  }
}
if (require.main === module) main();
module.exports = { periods, FRAMES, instUrl };
