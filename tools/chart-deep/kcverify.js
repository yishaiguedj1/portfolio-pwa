#!/usr/bin/env node
/* בדיקת העומק של גרף הנרות — אימות מודל התצוגה בדפדפן אמיתי (Playwright) על סביבת הניסוי, עם תיק הדמו (בלי התחברות).
   כל תשובת /api/history (op:'candles') שהגרף מקבל נרשמת. אחרי כל מרווח: הנרות שהגרף מצייר בפועל (getDataList של KLineChart)
   מול המודל של model.js — fromColumns, עמודים ישנים כמו fetchOlder (chart.js:1176), aggregate — שנבנה מאותן תשובות בדיוק.
   המחיר החי מוקפא (/api/quotes ריק), כדי שההשוואה תהיה מדויקת. רק נרות ציבוריים נאספים — לא סימוני עסקאות ולא אחזקות.
   הרצה: node tools/chart-deep/kcverify.js --out <dir> [--base https://invest-staging.thesnowball.app] [--tfs 1D,1h,4h,45m,3m,1W,1M,3M] [--older 2] [--sym AAPL] */
'use strict';
const fs = require('fs');
const path = require('path');
const playwright = () => require(process.env.PW_PATH || 'playwright');   // רק בהרצה — הבדיקה (chart-deep.test.js) טוענת את הקובץ בלי דפדפן, וב־CI אין playwright
const { loadLib } = require('./model.js');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LABEL = { '1h': '1H|1h', '2h': '2H|2h', '3h': '3H|3h', '4h': '4H|4h' };

/* המודל: אותן תשובות → raw כמו fetchInit/fetchOlder → aggregate */
function model(L, TF, log, sym, tf) {
  const base = TF[tf].base;
  const rs = log.filter((x) => x.body.sym === sym && x.body.iv === base && x.res && x.res.ok);
  let raw = null;
  for (const x of rs) {   // לפי הסדר: בקשה בלי to = fetchInit (מרווח חדש — מתחילים מחדש), עם to = fetchOlder
    if (!x.body.to) { raw = L.fromColumns(x.res); continue; }
    if (!raw || !raw.length || x.body.to !== raw[0].timestamp / 1000) continue;
    raw = L.fromColumns(x.res).filter((b) => b.timestamp < raw[0].timestamp).concat(raw);
  }
  return raw ? L.aggregate(raw, tf) : null;
}

function compare(shown, mod) {
  const key = (b) => b.timestamp;
  const M = new Map(mod.map((b) => [key(b), b]));
  let same = 0, diff = 0, onlyShown = 0;
  const ex = [];
  for (const b of shown) {
    const m = M.get(key(b));
    if (!m) { onlyShown++; if (ex.length < 4) ex.push(['רק במסך', b.timestamp / 1000]); continue; }
    const eq = ['open', 'high', 'low', 'close', 'volume'].every((f) => Math.abs((b[f] || 0) - (m[f] || 0)) <= 1e-9 * Math.max(1, Math.abs(m[f] || 0)));
    if (eq) same++; else { diff++; if (ex.length < 4) ex.push(['שונה', b.timestamp / 1000, [b.open, b.high, b.low, b.close, b.volume], [m.open, m.high, m.low, m.close, m.volume]]); }
  }
  const S = new Set(shown.map(key));
  const onlyModel = mod.filter((b) => !S.has(key(b))).length;
  // סביבת ההבדל הראשון: הנרות במסך ובמודל ביום שלפני ואחרי (לאבחון תפרים)
  const t0 = ex.length ? ex[0][1] * 1000 : null, row = (b) => [b.timestamp / 1000, b.open, b.high, b.low, b.close, b.volume];
  const near = t0 ? { shown: shown.filter((b) => Math.abs(b.timestamp - t0) < 86400e3).map(row), model: mod.filter((b) => Math.abs(b.timestamp - t0) < 86400e3).map(row) } : null;
  return { shown: shown.length, model: mod.length, same, diff, onlyShown, onlyModel, ex, near };
}

async function main() {
  const argv = process.argv.slice(2);
  const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
  const out = arg('out');
  if (!out) { console.error('שימוש: kcverify.js --out <dir> [--base URL] [--tfs 1D,1h] [--older 2]'); process.exit(2); }
  const base = arg('base', 'https://invest-staging.thesnowball.app');
  const tfs = String(arg('tfs', '1D,1h,4h,45m,3m,1W,1M,3M')).split(',');
  const older = +arg('older', 2);
  const sym = String(arg('sym', 'AAPL'));
  const { L, TF } = loadLib();
  const log = [];
  const browser = await playwright().chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: 'he-IL', timezoneId: 'Asia/Jerusalem' });
  const page = await ctx.newPage();
  await page.addInitScript(() => {   // כל מופע של KLineChart נשמר ב־window.__kcs
    let real;   // ה־UMD מציב אובייקט ריק וממלא אותו אחר כך — עוטפים את init בקריאה, לא בהצבה
    const wrap = (v) => { if (v && v.init && !v.__wrapped) { const init = v.init; v.init = function () { const ch = init.apply(this, arguments); (window.__kcs = window.__kcs || []).push(ch); return ch; }; v.__wrapped = true; } return v; };
    Object.defineProperty(window, 'klinecharts', { configurable: true, get: () => wrap(real), set: (v) => { real = v; } });
  });
  await page.route('**/api/quotes', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, data: {}, failed: [], ext: false }) }));
  await page.route('**/api/history', async (r) => {
    let body = {};
    try { body = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    let resp, text;
    try { resp = await r.fetch(); text = await resp.text(); } catch (e) { return; }   // הדפדפן נסגר באמצע בקשה
    if (body.op === 'candles') { let res = null; try { res = JSON.parse(text); } catch (e) {} log.push({ at: Date.now(), body, res }); }
    await r.fulfill({ response: resp, body: text }).catch(() => {});
  });
  await page.goto(base + '/', { waitUntil: 'load' });
  await sleep(3000);
  const guest = page.getByText('המשך בלי חשבון');   // מסך ההתחברות — תיק הדמו בלי חשבון
  if (await guest.count()) { await guest.first().click(); await sleep(3500); }
  const js = (q) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) throw new Error('אין ' + s); e.click(); }, q);
  await js('.tab[data-tab="stocks"]'); await sleep(1000);
  if (!(await page.locator('#stockList .stock').count())) {   // אורח בלי תיק: מוסיפים מניה אחת בדפדפן הזמני (לא חשבון, לא נתוני משתמש)
    await page.fill('#stockSearchInput', sym); await sleep(3500);
    await page.click('.stock-search-item >> nth=0'); await sleep(2000);
    await page.fill('#ap-shares', '1'); await page.fill('#ap-avg', '100');
    await page.click('#ap-save'); await sleep(3000);
  }
  await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(1500);
  await js('.stock.open .kc-open-btn');
  await page.waitForSelector('.kc-grid canvas', { timeout: 20000 });
  await sleep(3000);
  const res = [];
  for (const tf of tfs) {
    await page.locator('.kc-pk').nth(0).click().catch(() => {}); await sleep(700);
    const b = page.locator('.kc-sheet button, .kc-pick button, .kc-wheel ~ * button').filter({ hasText: new RegExp('^\\s*(' + (LABEL[tf] || tf) + ')\\s*$') });
    if (!(await b.count())) { res.push({ tf, err: 'אין כפתור' }); await page.keyboard.press('Escape').catch(() => {}); continue; }
    await b.first().click({ timeout: 3000 }); await sleep(3500);
    for (let k = 0; k < older; k++) {   // גלילה לתחילת הנתונים — fetchOlder
      await page.evaluate(() => { const c = (window.__kcs || []).slice(-1)[0]; if (c) c.scrollToDataIndex(0, 0); });
      await sleep(3500);
    }
    const shot = await page.evaluate(() => {
      const c = (window.__kcs || []).slice(-1)[0];
      if (!c) return null;
      const s = c.getSymbol && c.getSymbol(), p = c.getPeriod && c.getPeriod();
      return { sym: s && s.ticker, period: p, bars: c.getDataList().map((d) => ({ timestamp: d.timestamp, open: d.open, high: d.high, low: d.low, close: d.close, volume: d.volume })) };
    });
    if (!shot || !shot.sym) { res.push({ tf, err: 'אין גרף' }); continue; }
    const mod = model(L, TF, log, shot.sym, tf);
    const r = Object.assign({ tf, sym: shot.sym, period: shot.period, requests: log.filter((x) => x.body.sym === shot.sym && x.body.iv === TF[tf].base).length }, mod ? compare(shot.bars, mod) : { err: 'אין תשובות' });
    res.push(r);
    console.log(`${r.sym} ${tf.padEnd(4)} בקשות=${r.requests} במסך=${r.shown} במודל=${r.model} זהים=${r.same} שונים=${r.diff} רק־במסך=${r.onlyShown} רק־במודל=${r.onlyModel}${r.err ? ' ' + r.err : ''}`);
  }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'kcverify.json'), JSON.stringify({ base, at: Date.now(), res }, null, 1));
  await page.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { model, compare };
