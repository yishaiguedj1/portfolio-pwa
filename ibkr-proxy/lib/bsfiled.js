/* המאזן המודפס של כל הגשה (17/11/2026, בדיקת העומק של מנתח החברות — גל 2, ‏docs/research/fund-deep/wave-2.md §1).
   החוב לכל תאריך נקרא מהמאזן כפי שהודפס ב־10-K/10-Q (FilingSummary.xml ← דף ה־R של המאזן, ‏lib/secface.js) — לא משוחזר מתגיות
   companyfacts (הכלל של F7 פספס 18% מהתאריכים: שורות שנעלמו, תגיות פרטיות, חלויות בתוך שורה אחרת).
   אחסון: אובייקט אחד לחברה ב־R2, ‏fund/bsf/<CIK>.json.gz — לכל הגשה רק צד ההתחייבויות של המאזן. מידע ציבורי של SEC בלבד.
   · load — בכל op:'fund': קריאה מ־R2, ועד MAX_LIVE ההגשות החדשות ביותר שחסרות (2 בקשות להגשה, בתקרת זמן), ונכתב בחזרה.
   · tick — עבודת רקע בשרת שלנו (server.js → startBsf): משלימה את כל ההגשות מ־SINCE_Y שנים, עד 2 בקשות לשנייה ל־SEC.
   כל תקלה — מחזיר מה שיש (או null), והחוב של אותו תאריך נשאר בכלל של F7. אף פעם לא מפיל את התשובה. */
'use strict';
const zlib = require('zlib');
const SECFACE = require('./secface');
const R2 = require('./r2');

const PRE = 'fund/bsf/';
const V = 1;                 // גרסת המבנה (שינוי בחיתוך / בפענוח = מספר חדש → נקרא מחדש)
const SINCE_Y = 13;          // כמה שנים אחורה (המסך: 12 שנים ו־~48 רבעונים)
const MAX_LIVE = 4;          // הגשות חסרות שנקראות בתוך op:'fund'
const LIVE_MS = 3000;        // תקרת הזמן שלהן
const PERIODIC = /^(10-K|10-Q|10-KT|10-QT)$/; // בלי ‎/A‎ — תיקון עלול להכיל דוחות של חברה אחרת (כמו ב־secxbrl)
const key = (cik) => PRE + String(cik).padStart(10, '0') + '.json.gz';

/* צד ההתחייבויות בלבד: מסך הנכסים ועד "סך התחייבויות והון" (כולל) — מה ש־debtFace קורא. בלי סך נכסים — הכל */
function slim(p) {
  if (!p || !p.rows) return null;
  const a0 = p.rows.findIndex((r) => r.tag === 'Assets');
  let z = p.rows.findIndex((r) => r.tag === 'LiabilitiesAndStockholdersEquity');
  if (z < 0) z = p.rows.length - 1;
  const rows = (a0 >= 0 && z >= a0 ? p.rows.slice(a0, z + 1) : p.rows).map((r) => ({ ns: r.ns, tag: r.tag, label: r.label, total: r.total, v: r.v }));
  return { cols: p.cols, scale: p.scale, rows };
}

/* ההגשות התקופתיות מ־submissions (recent, ודפי ההמשך כשמועברים) — החדשה ראשונה */
function periodic(sub, files, sinceY, now) {
  const since = String(new Date(now || Date.now()).getUTCFullYear() - (sinceY || SINCE_Y)) + '-01-01';
  const out = [], seen = new Set();
  const add = (r) => {
    if (!r || !r.form) return;
    for (let i = 0; i < r.form.length; i++) {
      const acc = r.accessionNumber[i];
      if (!PERIODIC.test(r.form[i]) || r.filingDate[i] < since || seen.has(acc)) continue;
      seen.add(acc); out.push({ acc, form: r.form[i], filed: r.filingDate[i] });
    }
  };
  add(sub && sub.filings && sub.filings.recent);
  for (const f of files || []) add(f);
  return out.sort((a, b) => (a.filed < b.filed ? 1 : a.filed > b.filed ? -1 : 0));
}

/* הגשה אחת: FilingSummary ← דף המאזן. {form, filed, bs} / {form, filed, err} (err נשמר — לא נקרא שוב) / null (תקלת רשת — ינוסה שוב) */
async function readOne(cik, f, getText) {
  const base = 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + f.acc.replace(/-/g, '') + '/';
  const rec = { form: f.form, filed: f.filed };
  let xml;
  try { xml = await getText(base + 'FilingSummary.xml'); } catch (e) { return /http_404/.test(String(e && e.message)) ? { ...rec, err: 'nofs' } : null; }
  const pick = SECFACE.pickStatements(xml);
  if (!pick.bs) return { ...rec, err: /R\d+\.xml/.test(String(xml)) ? 'xml' : 'nobs' };
  let h;
  try { h = await getText(base + pick.bs); } catch (e) { return /http_404/.test(String(e && e.message)) ? { ...rec, err: 'nor' } : null; }
  const bs = slim(SECFACE.parseR(h));
  return bs && bs.rows.length ? { ...rec, bs } : { ...rec, err: 'empty' };
}

/* ---------- R2 (deps.store — מחסן בזיכרון לבדיקות) ---------- */
async function getObj(cik, deps) {
  if (deps.store) return deps.store.get(key(cik)) || null;
  const c = deps.r2c || R2.config(); if (!c.ok) return null;
  const b = await R2.getBuf(c, deps, key(cik), 8 * 1024 * 1024);
  if (!b) return null;
  try { const o = JSON.parse(zlib.gunzipSync(b).toString('utf8')); return o && o.v === V ? o : null; } catch (e) { return null; }
}
async function putObj(cik, o, deps) {
  if (deps.store) { deps.store.put(key(cik), o); return true; }
  const c = deps.r2c || R2.config(); if (!c.ok) return false;
  await R2.putBuf(c, deps, key(cik), zlib.gzipSync(JSON.stringify(o)), 'application/gzip');
  return true;
}

/* משלים עד max הגשות חסרות (החדשות קודם), בתקרת זמן. מחזיר {o, added} */
async function fill(cik, list, o, deps, max, ms) {
  const t0 = Date.now(), miss = list.filter((f) => !o.f[f.acc]).slice(0, max);
  let added = 0;
  const one = async (f) => {
    if (ms && Date.now() - t0 > ms) return;
    const r = await readOne(cik, f, deps.getText).catch(() => null);
    if (r) { o.f[f.acc] = r; added++; }
  };
  if (deps.par > 1) { for (let i = 0; i < miss.length; i += deps.par) await Promise.all(miss.slice(i, i + deps.par).map(one)); }
  else for (const f of miss) await one(f);
  return { o, added };
}

/* בתוך op:'fund': מה שיש ב־R2 + עד MAX_LIVE ההגשות החסרות החדשות ביותר. null — אין R2 / תקלה */
async function load(cik, sub, deps = {}) {
  try {
    const o = (await getObj(cik, deps)) || { v: V, f: {} };
    const list = periodic(sub, null, SINCE_Y, deps.now);
    let added = 0;
    if (deps.getText && list.some((f) => !o.f[f.acc])) {
      const live = Promise.race([fill(cik, list, o, { ...deps, par: MAX_LIVE }, MAX_LIVE, LIVE_MS), new Promise((r) => setTimeout(() => r(null), LIVE_MS + 500))]);
      const r = await live; if (r) added = r.added;
      if (added) await Promise.race([putObj(cik, o, deps).catch(() => false), new Promise((r) => setTimeout(r, 1500))]);
    }
    return Object.keys(o.f).length ? o.f : null;
  } catch (e) { return null; }
}

/* עבודת הרקע: חברה אחת — כל ההגשות החסרות מ־SINCE_Y שנים (גם מדפי ההמשך של submissions). "at" נרשם רק כשלא נשאר חסר */
async function fillAll(cik, deps) {
  const sub = JSON.parse(await deps.getText('https://data.sec.gov/submissions/CIK' + String(cik).padStart(10, '0') + '.json'));
  const files = [];
  const since = String(new Date(deps.now || Date.now()).getUTCFullYear() - SINCE_Y);
  for (const f of (sub.filings && sub.filings.files) || []) {
    if (f.filingTo && f.filingTo < since) continue;
    try { files.push(JSON.parse(await deps.getText('https://data.sec.gov/submissions/' + f.name))); } catch (e) { /* דף חסר — רק הוא */ }
  }
  const o = (await getObj(cik, deps)) || { v: V, f: {} };
  const list = periodic(sub, files, SINCE_Y, deps.now);
  const { added } = await fill(cik, list, o, { ...deps, par: 1 }, 1e4, deps.budgetMs || 0);
  const left = list.filter((f) => !o.f[f.acc]).length;
  if (!left) o.at = new Date(deps.now || Date.now()).toISOString();
  if (added || !left) await putObj(cik, o, deps);
  return { n: list.length, added, left };
}

/* סבב של עבודת הרקע (server.js → startBsf, כל 10 דק׳): עובר על 517 החברות (xsyms.txt) מהמקום שבו עצר, ומשלים חברה שלא הושלמה
   ב־20 השעות האחרונות — עד תקרת הזמן, ועד 2 בקשות לשנייה ל־SEC (המגבלה שלהם: 10). מצב: fund/bsf/_state.json ‏{i} */
const STATE = PRE + '_state.json';
const FRESH = 20 * 3600e3;
async function tick(deps = {}) {
  const t0 = Date.now(), budget = deps.budgetMs || 9 * 60e3, gap = deps.gap == null ? 500 : deps.gap;
  const syms = deps.syms || require('fs').readFileSync(require('path').join(__dirname, 'xsyms.txt'), 'utf8').split(/\s+/).filter(Boolean);
  if (!syms.length) return { ok: true, done: 0 };
  let last = 0;
  const getText = async (u) => { const w = last + gap - Date.now(); if (w > 0) await new Promise((r) => setTimeout(r, w)); last = Date.now(); return deps.getText(u); };
  const st = deps.store ? deps.store.get(STATE) || {} : await (async () => { const c = deps.r2c || R2.config(); if (!c.ok) return null; try { return JSON.parse((await R2.getText(c, deps, STATE)) || '{}'); } catch (e) { return {}; } })();
  if (!st) return { ok: false, error: 'no_r2' };
  const cmap = await deps.cikMap();
  let i = (st.i || 0) % syms.length, done = 0, added = 0, k = 0;
  for (; k < syms.length && Date.now() - t0 < budget; k++, i = (i + 1) % syms.length) {
    const cik = cmap.get(deps.secSym ? deps.secSym(syms[i]) : syms[i]);
    if (!cik) continue;
    const o = await getObj(cik, deps).catch(() => null);
    if (o && o.at && (deps.now || Date.now()) - Date.parse(o.at) < FRESH) continue;
    try { const r = await fillAll(cik, { ...deps, getText, budgetMs: budget - (Date.now() - t0) }); done++; added += r.added; if (r.left) break; }
    catch (e) { /* חברה אחת — לא עוצרת את הסבב */ }
  }
  const ns = { i, at: new Date(deps.now || Date.now()).toISOString() };
  if (deps.store) deps.store.put(STATE, ns);
  else { const c = deps.r2c || R2.config(); if (c.ok) await R2.putText(c, deps, STATE, JSON.stringify(ns), 'application/json').catch(() => {}); }
  return { ok: true, done, added, i, ms: Date.now() - t0 };
}

module.exports = { load, fillAll, tick, slim, periodic, readOne, key, PRE, V, SINCE_Y, MAX_LIVE };
