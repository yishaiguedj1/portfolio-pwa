#!/usr/bin/env node
/* בדיקת העומק של גרף הנרות (16/11/2026, docs/chart-deep-audit.md) — שלב 1: צילום תשובות השרתון.
   מה המשתמש מקבל: POST /api/history { op:'candles', sym, iv, to?, pre? } — בדיוק כמו הטלפון (fetchInit → fetchOlder):
   עמוד 0 בלי to, ואז to = הנר הראשון שכבר נטען (שניות), עד more=false או עמוד ריק.
   המקור של השרתון (Yahoo) הוא הנבדק — לא פונים אליו ישירות (429 מהסביבה). הקצב: 30 בקשות לדקה כברירת מחדל (המגבלה: 90 ל־IP),
   כי ב־80 לדקה Yahoo החזיר לשרת 502 בסדרות (16/11) — הבדיקה לא תפגע במשתמשים. אחרי 502 — הפסקה של 30 שנ׳ ויותר.
   שימוש:
     node tools/chart-deep/snap.js --syms AAPL,NVDA --out <dir> [--ivs 1m,5m,1d] [--pre 0,1] [--pages 99] [--rate 30] [--refresh]
   הפלט (מחירים ציבוריים): <out>/snap/<SYM>/<iv>.<pre>.p<k>.json = { req, at, res } — מחוץ לריפו (סקראצ'פד). */
'use strict';
const fs = require('node:fs');
const path = require('node:path');

const API = 'https://api.thesnowball.app/api/history';
const ORIGIN = 'https://invest.thesnowball.app';
const ALL_IVS = ['1m', '2m', '5m', '15m', '30m', '60m', '1d', '1wk', '1mo'];
const INTRA = (iv) => /m$/.test(iv);

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const BO = +process.env.CHART_DEEP_BACKOFF || 0;   // בבדיקות: המתנות קצרות (tests/chart-deep.test.js)

/* קצב: מרווח מינימלי בין בקשות (60/rate שניות) — 80 לדקה = 750ms */
let lastAt = 0;
async function pace(rate) {
  const gap = 60000 / rate, w = lastAt + gap - Date.now();
  if (w > 0) await sleep(w);
  lastAt = Date.now();
}

/* tries: עמוד 0 — 5 ניסיונות; עמוד היסטוריה — 2, ואז 502 נרשם כתשובה (ממצא C-001: חלון ריק בקצה ההיסטוריה = 502, לא חסימה) */
async function post(body, rate, tries = 5) {
  for (let i = 0; i < tries; i++) {
    await pace(rate);
    try {
      const r = await fetch(API, { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const t = await r.text();
      if (r.status === 429) { process.stderr.write('429 — ממתין דקה\n'); await sleep(BO || 65000); continue; }
      if (r.status === 502) {
        if (i === tries - 1) return { ok: false, error: 'upstream', status: 502 };
        process.stderr.write('502 — הפסקה\n'); await sleep((BO || 30000) * (i + 1)); continue;   // מרווח גדל
      }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + t.slice(0, 200));
      return JSON.parse(t);
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep((BO || 4000) * (i + 1));
    }
  }
  throw new Error('נכשל אחרי 5 ניסיונות');
}

/* כל העמודים של (סימבול, מרווח, מורחב) — כמו הטלפון. מחזיר את מספר העמודים */
async function snapSeries(out, sym, iv, pre, opt) {
  const dir = path.join(out, 'snap', sym);
  fs.mkdirSync(dir, { recursive: true });
  let to = 0, k = 0, first = Infinity;
  for (; k < opt.pages; k++) {
    const f = path.join(dir, iv + '.' + (pre ? 1 : 0) + '.p' + k + '.json');
    let rec = null;
    if (!opt.refresh && fs.existsSync(f)) rec = JSON.parse(fs.readFileSync(f, 'utf8'));
    else {
      const req = { op: 'candles', sym, iv, to: to || undefined, pre: !!pre };
      const res = await post(req, opt.rate, k ? 2 : 5);
      rec = { req, at: Date.now(), res };
      fs.writeFileSync(f, JSON.stringify(rec));
    }
    const r = rec.res;
    if (!r || !r.ok) { if (k === 0) process.stderr.write(sym + ' ' + iv + ' ' + (r && r.error) + '\n'); break; }
    const t = (r.t || []).filter((x) => x * 1000 < first);   // כמו fetchOlder: רק מה שלפני הנר הראשון שכבר נטען
    if (!t.length) { k++; break; }
    first = Math.min(first, t[0] * 1000);
    if (!r.more) { k++; break; }
    to = Math.floor(first / 1000);
  }
  return k;
}

async function main() {
  const out = arg('out');
  if (!out || out === true) { console.error('חסר --out'); process.exit(2); }
  let syms = String(arg('syms', '') || '').split(',').filter(Boolean);
  const file = arg('file');
  if (file && file !== true) syms = syms.concat(fs.readFileSync(file, 'utf8').split(/\s+/).filter(Boolean));
  const ivs = String(arg('ivs', ALL_IVS.join(','))).split(',').filter((x) => ALL_IVS.includes(x));
  const pres = String(arg('pre', '0,1')).split(',').map(Number);
  const opt = { pages: +arg('pages', 99), rate: Math.min(80, +arg('rate', 30)), refresh: !!arg('refresh', false) };
  let n = 0;
  for (const sym of syms) {
    for (const iv of ivs) {
      for (const pre of pres) {
        if (pre && !INTRA(iv)) continue;   // הטלפון שולח pre רק בתוך־יומי
        try { n += await snapSeries(out, sym.toUpperCase(), iv, pre, opt); } catch (e) { console.error(sym, iv, pre, e.message); }
      }
    }
    console.log(sym, 'עמודים עד כה:', n);
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { snapSeries };
