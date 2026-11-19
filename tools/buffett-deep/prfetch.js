#!/usr/bin/env node
/* בדיקת העומק של מכפיל באפט — גל 2: אוסף ההודעות לעיתונות של כל היקום (docs/buffett-pe-audit.md).
   לכל CIK ב־tools/fund-deep/ciks.tsv: כל 8-K (ו־8-K/A) עם Item 2.02 מ־460 הימים האחרונים — **בלי התקרה של 6** שבמערכת, וגם
   מדפי ההגשות הישנים (filings.files) כשה־recent לא מגיע עד תחילת החלון (חברות שמגישות הרבה — בנקים). לחברות זרות — גם 6-K.
   מכל הגשה: index.json, וכל נספח htm (חוץ מדפי R) — EX-99 כולם; בלי EX-99 — המסמך הראשי. נרשם גם מה המערכת קוראת
   (secsbc.pick — 6 הראשונות מ־recent; SECPR.exhibits — 2 הנספחים הראשונים), כדי למדוד מה היא מפספסת.
   הקריאה ל־SEC — רק דרך sec.js (מטמון, 250ms, המתנה ב־429). פלט: <BD_DIR>/pr/<CIK>.json (מניפסט).
   שימוש: BD_DIR=<dir> node tools/buffett-deep/prfetch.js [--syms A,B] [--now 2026-11-19] */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const sec = require('./sec');
const SBC = require('../../ibkr-proxy/lib/secsbc');
const SECPR = require('../../ibkr-proxy/lib/secpr');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i < 0 ? d : argv[i + 1]; };
const DAYS = 460;
const FOREIGN = /^(?:20-F|40-F|6-K)/;

function rowsOf(r) {
  const out = [];
  for (let i = 0; i < (r.form || []).length; i++) out.push({ form: r.form[i], items: r.items[i] || '', filed: r.filingDate[i], acc: r.accessionNumber[i], doc: r.primaryDocument[i], rep: r.reportDate[i] });
  return out;
}

async function one(sym, cik, now) {
  const sub = await sec.submissions(cik);
  const lim = new Date(now - DAYS * 864e5).toISOString().slice(0, 10);
  let all = rowsOf(sub.filings.recent);
  const oldest = all.length ? all[all.length - 1].filed : '9999';
  let paged = false;
  if (oldest > lim) {
    for (const f of sub.filings.files || []) {
      if (f.filingTo && f.filingTo < lim) continue;
      try { all = all.concat(rowsOf(await sec.json('https://data.sec.gov/submissions/' + f.name))); paged = true; } catch (e) { /* דף חסר */ }
    }
  }
  const foreign = all.some((x) => FOREIGN.test(x.form) && x.filed >= lim) && !all.some((x) => /^10-[KQ]/.test(x.form) && x.filed >= lim);
  const sysPick = new Set(SBC.pick(sub, now).map((k) => k.acc));
  const want = all.filter((x) => x.filed >= lim && ((/^8-K/.test(x.form) && /2\.02/.test(x.items)) || (foreign && /^6-K/.test(x.form))));
  const items = [];
  for (const k of want) {
    const base = sec.accBase(cik, k.acc);
    let idx = null;
    try { idx = JSON.parse(await sec.get(base + 'index.json')); } catch (e) { items.push({ ...k, err: String(e.message).slice(0, 80) }); continue; }
    const dir = (idx.directory && idx.directory.item) || [];
    const htm = dir.filter((x) => /\.htm$/i.test(x.name) && !/^R\d+\.htm$/i.test(x.name) && !/index/i.test(x.name));
    const sysEx = SECPR.exhibits(idx, k.doc).slice(0, 2);
    const ex99 = htm.filter((x) => x.name !== k.doc && /ex[-_]?99|exhibit99|ex99|exhibit_?99/i.test(x.name)).map((x) => x.name);
    // מה נשמר לקריאה בלתי תלויה: כל EX-99; בלי EX-99 — כל הנספחים שאינם הראשי; ואם אין — הראשי. וגם מה שהמערכת קוראת
    let get = ex99.length ? ex99 : htm.filter((x) => x.name !== k.doc).map((x) => x.name);
    if (!get.length && k.doc) get = [k.doc];
    for (const nm of sysEx) if (!get.includes(nm)) get.push(nm);
    if (!sysEx.length && k.doc && !get.includes(k.doc)) get.push(k.doc);
    const got = [];
    for (const nm of get) { try { await sec.get(base + nm); got.push(nm); } catch (e) { /* 404 — נרשם כחסר */ } }
    items.push({ ...k, sys: sysPick.has(k.acc), sysEx: sysEx.length ? sysEx : k.doc ? [k.doc] : [], ex99, got, htm: htm.map((x) => [x.name, +x.size || 0]) });
  }
  return { sym, cik, now: new Date(now).toISOString().slice(0, 10), lim, paged, foreign, oldestRecent: oldest, n: items.length, items };
}

async function main() {
  const BD = process.env.BD_DIR || '.';
  const outD = path.join(BD, 'pr');
  fs.mkdirSync(outD, { recursive: true });
  const now = arg('now') ? Date.parse(arg('now')) : Date.now();
  let list = fs.readFileSync(path.join(__dirname, '..', 'fund-deep', 'ciks.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
  if (arg('syms')) { const w = new Set(arg('syms').split(',')); list = list.filter(([s]) => w.has(s)); }
  let k = 0;
  for (const [sym, cik] of list) {
    const f = path.join(outD, (+cik) + '.json');
    if (fs.existsSync(f) && !argv.includes('--refresh')) { k++; continue; }
    try { const o = await one(sym, cik, now); fs.writeFileSync(f, JSON.stringify(o)); k++; console.log(new Date().toISOString().slice(11, 19), k + '/' + list.length, sym, 'הודעות:', o.n, o.paged ? '(דפים ישנים)' : '', o.foreign ? '(זרה)' : ''); }
    catch (e) { console.error(sym, 'נכשל:', String(e && e.message).slice(0, 120)); }
  }
}
if (require.main === module) main();
module.exports = { one };
