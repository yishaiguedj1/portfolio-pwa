#!/usr/bin/env node
/* בניית הספר של תיק אקמן מחוץ לשרת (16/11/2026) — לבדיקה ולמחקר. אותו קוד שרץ בשרת (lib/ackmanbuild.js).
   node tools/ackman-build.js --px <תיקיית JSON של Yahoo chart, קובץ לכל סימבול> [--asof 2026-11-13] [--out book.json] [--extra extra.json]
   מדפיס: התאמה ל־13F בכל רבעון, סיכומי מזומן, TWR לפי שנה, האחזקות היום. בלי --out — לא כותב כלום. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'ibkr-proxy/lib/ackmanbook.js'));
const AB = require(path.join(ROOT, 'ibkr-proxy/lib/ackmanbuild.js'));

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pxDir = arg('px');
if (!pxDir) { console.error('חסר --px <תיקייה>'); process.exit(2); }
const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'ibkr-proxy/lib/ackman-13f.json'), 'utf8'));
const extra = arg('extra') ? JSON.parse(fs.readFileSync(arg('extra'), 'utf8')) : null;
const px = {};
for (const f of fs.readdirSync(pxDir)) {
  if (!f.endsWith('.json')) continue;
  const s = B.seriesFromYahoo(JSON.parse(fs.readFileSync(path.join(pxDir, f), 'utf8')));
  if (s) px[f.replace(/\.json$/, '')] = s;
}
const need = AB.neededSymbols(data, extra, '2015-06-30').filter((s) => !px[s]);
if (need.length) console.log('⚠ חסרים מחירים:', need.join(' '));
const asOf = arg('asof') || px.SPY.d[px.SPY.d.length - 1];
const t0 = Date.now();
const book = AB.build(data, extra, px, { asOf });
console.log('נבנה ב־' + (Date.now() - t0) + 'ms · עד ' + asOf + ' · עסקאות ' + book.trades.length + ' (נאמדות ' + book.trades.filter((t) => t.est).length + ') · תנועות מזומן ' + book.cashTransactions.length + ' · ימים ' + book.navDaily.length);
if (book.ackman.warn.length) console.log('אזהרות:', book.ackman.warn.join(' | '));
let worst = 0;
for (const q of book.ackman.quarters) {
  const d = (q.nav - q.total) / q.total;
  if (Math.abs(d) > Math.abs(worst)) worst = d;
  if (Math.abs(d) > 0.0005) console.log('  פער מול 13F', q.period, (q.nav / 1e9).toFixed(4) + 'B מול ' + (q.total / 1e9).toFixed(4) + 'B');
}
console.log('הפער הגדול ביותר מול 13F בסוף רבעון: ' + (worst * 100).toFixed(4) + '%');
const sum = {};
for (const t of book.cashTransactions) sum[t.type] = (sum[t.type] || 0) + t.amount;
console.log('מזומן לפי סוג ($B):', Object.entries(sum).map(([k, v]) => k + ' ' + (v / 1e9).toFixed(3)).join(' · '));
const yr = {};
for (const p of book.navHistory) { const y = p.toDate.slice(0, 4); yr[y] = (yr[y] || 1) * (1 + p.twr / 100); }
console.log('TWR לפי שנה:', Object.entries(yr).map(([y, g]) => y + ' ' + ((g - 1) * 100).toFixed(1) + '%').join(' · '));
console.log('האחזקות:', book.positions.map((p) => p.symbol + ' ' + Math.round(p.qty).toLocaleString('en-US') + ' ($' + (p.marketValue / 1e9).toFixed(2) + 'B)').join(' · '));
if (arg('out')) { fs.writeFileSync(arg('out'), JSON.stringify(book)); console.log('נכתב:', arg('out'), Math.round(fs.statSync(arg('out')).size / 1024) + 'KB'); }
