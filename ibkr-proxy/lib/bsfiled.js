/* המאזן המודפס של כל הגשה (17/11/2026, בדיקת העומק של מנתח החברות — גל 2, ‏docs/research/fund-deep/wave-2.md §1).
   החוב לכל תאריך נקרא מהמאזן כפי שהודפס ב־10-K/10-Q (FilingSummary.xml ← דף ה־R של המאזן, ‏lib/secface.js) — לא משוחזר מתגיות
   companyfacts (הכלל של F7 פספס 18% מהתאריכים: שורות שנעלמו, תגיות פרטיות, חלויות בתוך שורה אחרת).
   אחסון: אובייקט אחד לחברה ב־R2, ‏fund/bsf/<CIK>.json.gz — לכל הגשה רק צד ההתחייבויות של המאזן. מידע ציבורי של SEC בלבד.
   · load — בכל op:'fund': קריאה מ־R2, ועד MAX_LIVE ההגשות החדשות ביותר שחסרות (2 בקשות להגשה, בתקרת זמן), ונכתב בחזרה.
   · tick — עבודת רקע בשרת שלנו (server.js → startBsf): משלימה את כל ההגשות מ־SINCE_Y שנים, עד 2 בקשות לשנייה ל־SEC.
   כל תקלה — מחזיר מה שיש (או null), והחוב של אותו תאריך נשאר בכלל של F7. אף פעם לא מפיל את התשובה.
   באותו אובייקט, שדה p (גל 2, F2): ההודעה לעיתונות על התוצאות השנתיות (8-K ‏Item 2.02 ← EX-99.1) לכל סוף שנה — שורות "Diluted"
   (lib/secpr.js), למניות ולרווח למניה של הרבעון הרביעי. רק בעבודת הרקע (הרבעון האחרון — ממילא מ־Yahoo, qShares).
   ובכל 10-K גם שדה cf (גל 3, F13): מדף התזרים — רק שורות הפחת וההשקעות ההוניות כפי שהודפסו (bsfCf ב־fundamentals). הגשה שנקראה
   לפני כן — משלימים לה רק את התזרים (FilingSummary ← דף התזרים), בלי לקרוא שוב את המאזן. */
'use strict';
const zlib = require('zlib');
const SECFACE = require('./secface');
const SECPR = require('./secpr');
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

/* דף התזרים — רק השורות של פחת/הפחתות ושל רכישת רכוש קבוע (מה ש־bsfCf קורא); שאר הדף לא נשמר */
const CF_ROW = /Depreci|Amortiz|PaymentsToAcquire(PropertyPlantAndEquipment|ProductiveAssets)/;
function slimCf(p) {
  if (!p || !p.rows) return null;
  const rows = p.rows.filter((r) => CF_ROW.test(r.tag)).map((r) => ({ ns: r.ns, tag: r.tag, label: r.label, v: r.v }));
  return { cols: p.cols, scale: p.scale, rows };
}
/* דף רווח והפסד (גל 5 בבדיקת העומק, F20 — bsfIs): כל השורות עם ערכים, בלי שורות למניה ובלי מניות (bsfIs קורא רק סכומים) */
const IS_SKIP = /PerShare|Shares|PerOutstanding|Units?Outstanding/;
function slimIs(p) {
  if (!p || !p.rows) return null;
  const rows = p.rows.filter((r) => !IS_SKIP.test(r.tag) && r.v && r.v.some((x) => x != null)).map((r) => ({ ns: r.ns, tag: r.tag, label: r.label, v: r.v }));
  return { cols: p.cols, scale: p.scale, rows };
}
const annual = (f) => /^10-K/.test(f.form);
const dead = (r) => !!(r.err && r.err !== 'nobs' && r.err !== 'empty');
const needCf = (r) => !!(r && annual(r) && !r.cf && !r.cfErr && !dead(r));
// דף רווח והפסד: 10-K (גל 5, F20) וגם 10-Q (גל 6 — F20 ברבעונים; הגשה שכבר נשמרה בלעדיו מושלמת ב־readMissing)
const needIs = (r) => !!(r && !r.is && !r.isErr && !dead(r));
const needX = (r) => needCf(r) || needIs(r);
/* דף אחד של הגשה שנתית לפי הסוג (cf / is): {cf} / {cfErr} (נשמר) / null (תקלת רשת). xml — FilingSummary כשכבר נקרא */
async function readSt(k, base, xml, getText) {
  const E = k + 'Err';
  if (xml == null) { try { xml = await getText(base + 'FilingSummary.xml'); } catch (e) { return /http_404/.test(String(e && e.message)) ? { [E]: 'nofs' } : null; } }
  const pick = SECFACE.pickStatements(xml);
  if (!pick[k]) return { [E]: 'no' + k };
  let h;
  try { h = await getText(base + pick[k]); } catch (e) { return /http_404/.test(String(e && e.message)) ? { [E]: 'nor' } : null; }
  const st = (k === 'cf' ? slimCf : slimIs)(SECFACE.parseR(h));
  return st && st.cols && st.cols.length ? { [k]: st } : { [E]: 'empty' };
}
const readCf = (base, xml, getText) => readSt('cf', base, xml, getText);
/* מה שחסר בהגשה שנתית שכבר נשמרה (התזרים / רווח והפסד) — FilingSummary פעם אחת. {…} / null (תקלת רשת באחד מהם) */
async function readMissing(r, base, xml, getText) {
  const out = {};
  if (xml == null && needX(r)) { try { xml = await getText(base + 'FilingSummary.xml'); } catch (e) { if (!/http_404/.test(String(e && e.message))) return null; return { ...(needCf(r) ? { cfErr: 'nofs' } : {}), ...(needIs(r) ? { isErr: 'nofs' } : {}) }; } }
  for (const k of ['cf', 'is']) {
    if (!(k === 'cf' ? needCf : needIs)(r)) continue;
    const c = await readSt(k, base, xml, getText).catch(() => null);
    if (!c) return Object.keys(out).length ? out : null;
    Object.assign(out, c);
  }
  return out;
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
      seen.add(acc); out.push({ acc, form: r.form[i], filed: r.filingDate[i], rep: r.reportDate ? r.reportDate[i] : null });
    }
  };
  add(sub && sub.filings && sub.filings.recent);
  for (const f of files || []) add(f);
  return out.sort((a, b) => (a.filed < b.filed ? 1 : a.filed > b.filed ? -1 : 0));
}

/* הגשה אחת: FilingSummary ← דף המאזן. {form, filed, bs} / {form, filed, err} (err נשמר — לא נקרא שוב) / null (תקלת רשת — ינוסה שוב) */
const baseOf = (cik, acc) => 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + acc.replace(/-/g, '') + '/';
async function readOne(cik, f, getText) {
  const base = baseOf(cik, f.acc);
  const rec = { form: f.form, filed: f.filed };
  let xml;
  try { xml = await getText(base + 'FilingSummary.xml'); } catch (e) { return /http_404/.test(String(e && e.message)) ? { ...rec, err: 'nofs' } : null; }
  const pick = SECFACE.pickStatements(xml);
  // 10-K — גם דף התזרים ודף רווח והפסד; ‏10-Q — דף רווח והפסד (גל 6). תקלת רשת באחד = בלי הוא; יושלם בסבב הבא
  const withCf = async (r) => { if (r.err === 'xml') return r; const c = await readMissing(r, base, xml, getText).catch(() => null); return c ? { ...r, ...c } : r; };
  if (!pick.bs) return withCf({ ...rec, err: /R\d+\.xml/.test(String(xml)) ? 'xml' : 'nobs' });
  let h;
  try { h = await getText(base + pick.bs); } catch (e) { return /http_404/.test(String(e && e.message)) ? { ...rec, err: 'nor' } : null; }
  const bs = slim(SECFACE.parseR(h));
  return withCf(bs && bs.rows.length ? { ...rec, bs } : { ...rec, err: 'empty' });
}

/* ההודעה לעיתונות של סוף שנה אחד: המועמדים (8-K ‏2.02 עד 100 יום אחרי; בלעדיהם — 8-K בלי 2.02 עד 75 יום) ← index.json ← עד 3
   קבצים (בלי נספח — המסמך הראשי), הראשון שיש בו שורות "מדולל" (בטבלה, ובלעדיה — ברצף הטקסט) וגם שורת מניות.
   {end, acc, filed, file, rows} / {end, err} (נשמר) / null (תקלת רשת — ינוסה שוב) */
const PR_V = 3; // גרסת המפענח של ההודעות (2 — רצף הטקסט, מועמדים בלי 2.02 והמסמך הראשי, גל 5; 3 — רווח למניה בלי "מדולל" ומועמד עם שורת מניות, גל 6): רשומה ישנה בלי מניות נקראת שוב פעם אחת
const prNeed = (r) => !r || ((!!r.err || (!!r.rows && !r.rows.some(SECPR.isShares))) && (r.pv || 1) < PR_V);
async function readPr(cik, it, getText) {
  let last = { end: it.end, err: 'nofile', pv: PR_V }, first = null, fbr = null;
  const sh = (x) => !!x && x.rows.some(SECPR.isShares);
  for (const k of it.cands) {
    const base = 'https://www.sec.gov/Archives/edgar/data/' + (+cik) + '/' + k.acc.replace(/-/g, '') + '/';
    let idx;
    try { idx = JSON.parse(await getText(base + 'index.json')); } catch (e) { if (/http_404/.test(String(e && e.message))) continue; return null; }
    let names = SECPR.exhibits(idx, k.doc).slice(0, 3);
    // בלי נספח — ההודעה בגוף ה־8-K (Halliburton; גל 5, F26)
    const main = !names.length && !!k.doc;
    if (main) names = [k.doc];
    if (!names.length) { last = { end: it.end, err: 'noex', pv: PR_V }; continue; }
    // כמה קבצים באותה הגשה: עד שנמצאה גם שורת מניות (UPS: ‏EX-99.1 — רק התאמות לרווח המתואם; הדוחות המלאים ב־EX-99.2)
    let rows = [], files = [], fb = null;
    for (const nm of names) {
      let h;
      try { h = await getText(base + nm); } catch (e) { if (/http_404/.test(String(e && e.message))) continue; return null; }
      // בלי טבלה שיש בה "מדולל" — רצף הטקסט (מצגת, PDF שהומר; גל 5, F24)
      let r0 = SECPR.parse(h); if (!r0.length) r0 = SECPR.parseText(h);
      // בלי "מדולל" בכלל — "רווח למניה" ו"מניות" (גל 6, F30; מסומן b — q4Press מקבל רק בשנה בלי דילול). רק כגיבוי: קובץ אחר עם "מדולל" גובר
      if (!r0.length) { const e = SECPR.parseEps(h); if (e.length && (!fb || (!sh(fb) && e.some(SECPR.isShares)))) fb = { rows: e, file: nm }; continue; }
      const r = r0.map((x) => ({ ...x, t: x.t + 1000 * files.length }));
      rows = rows.concat(r); files.push(nm);
      if (r.some(SECPR.isShares)) break;
    }
    const rec = rows.length ? { end: it.end, acc: k.acc, filed: k.filed, file: files.join(' '), rows } : null;
    // מועמד בלי שורת מניות — ממשיכים למועמד הבא (גל 6, F31 — AbbVie ‏2025: ‏8-K של תחזית ב־6 בינואר עם "Diluted EPS Range",
    // ההודעה על התוצאות ב־31 בינואר; בלי מניות q4From לא מאמת כלום)
    if (sh(rec)) return rec;
    if (rec && !first) first = { ...rec, pv: PR_V };
    if (fb && (!fbr || (!sh(fbr) && sh(fb)))) fbr = { end: it.end, acc: k.acc, filed: k.filed, file: fb.file, rows: fb.rows, pv: PR_V };
    if (main && !rec && !fb) last = { end: it.end, err: 'noex', pv: PR_V };
  }
  return (sh(fbr) && fbr) || first || fbr || last;
}

/* כל ה־8-K של התוצאות מ־submissions (recent ודפי ההמשך), וה־8-K רק עם 7.01 / ‏8.01 / ‏9.01 (F25) — לבחירה לפי סוף השנה */
function merge8k(sub, files) {
  const r = { form: [], items: [], accessionNumber: [], filingDate: [], primaryDocument: [] };
  for (const x of [sub && sub.filings && sub.filings.recent, ...(files || [])]) {
    if (!x || !x.form) continue;
    for (let i = 0; i < x.form.length; i++) {
      const it = (x.items && x.items[i]) || '';
      if (!(/^8-K/.test(x.form[i]) && /2\.02/.test(it)) && !(x.form[i] === '8-K' && SECPR.ALT.test(it))) continue; // גם המועמדים בלי 2.02 (F25)
      for (const k of Object.keys(r)) r[k].push(x[k] ? x[k][i] : '');
    }
  }
  return { filings: { recent: r } };
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
  const t0 = Date.now(), miss = list.filter((f) => !o.f[f.acc] || needX(o.f[f.acc])).slice(0, max);
  let added = 0;
  const one = async (f) => {
    if (ms && Date.now() - t0 > ms) return;
    if (o.f[f.acc]) { const c = await readMissing(o.f[f.acc], baseOf(cik, f.acc), null, deps.getText).catch(() => null); if (c && Object.keys(c).length) { Object.assign(o.f[f.acc], c); added++; } return; }
    const r = await readOne(cik, f, deps.getText).catch(() => null);
    if (r) { o.f[f.acc] = r; added++; }
  };
  if (deps.par > 1) { for (let i = 0; i < miss.length; i += deps.par) await Promise.all(miss.slice(i, i + deps.par).map(one)); }
  else for (const f of miss) await one(f);
  return { o, added };
}

/* בתוך op:'fund': מה שיש ב־R2 + עד MAX_LIVE ההגשות החסרות החדשות ביותר. {f, p} (p — ההודעות לעיתונות, רק מה שכבר נשמר) /
   null — אין R2 / תקלה */
async function load(cik, sub, deps = {}) {
  try {
    const o = (await getObj(cik, deps)) || { v: V, f: {} };
    const list = periodic(sub, null, SINCE_Y, deps.now);
    let added = 0;
    if (deps.getText && list.some((f) => !o.f[f.acc] || needX(o.f[f.acc]))) {
      const live = Promise.race([fill(cik, list, o, { ...deps, par: MAX_LIVE }, MAX_LIVE, LIVE_MS), new Promise((r) => setTimeout(() => r(null), LIVE_MS + 500))]);
      const r = await live; if (r) added = r.added;
      if (added) await Promise.race([putObj(cik, o, deps).catch(() => false), new Promise((r) => setTimeout(r, 1500))]);
    }
    return Object.keys(o.f).length || (o.p && Object.keys(o.p).length) ? { f: o.f, p: o.p || {} } : null;
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
  const t0 = Date.now();
  let { added } = await fill(cik, list, o, { ...deps, par: 1 }, 1e4, deps.budgetMs || 0);
  // ההודעות לעיתונות: לכל 10-K (סוף השנה = reportDate) שעוד אין לו רשומה
  o.p = o.p || {};
  const ends = [...new Set(list.filter((f) => /^10-K/.test(f.form) && f.rep).map((f) => f.rep))];
  const its = SECPR.pickItems(merge8k(sub, files), ends).filter((it) => prNeed(o.p[it.end]));
  let prLeft = 0;
  for (const it of its) {
    if (deps.budgetMs && Date.now() - t0 > deps.budgetMs) { prLeft++; continue; }
    const r = await readPr(cik, it, deps.getText).catch(() => null);
    if (r) { o.p[it.end] = r; added++; } else prLeft++;
  }
  const left = list.filter((f) => !o.f[f.acc] || needX(o.f[f.acc])).length + prLeft;
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
  let i = (st.i || 0) % syms.length, done = 0, added = 0, k = 0, failed = 0;
  for (; k < syms.length && Date.now() - t0 < budget; k++, i = (i + 1) % syms.length) {
    const cik = cmap.get(deps.secSym ? deps.secSym(syms[i]) : syms[i]);
    if (!cik) continue;
    const o = await getObj(cik, deps).catch(() => null);
    if (o && o.at && (deps.now || Date.now()) - Date.parse(o.at) < FRESH) continue;
    // נשאר חסר כי נגמר התקציב — עוצרים, והסבב הבא ממשיך מאותה חברה. נשאר חסר בגלל תקלה (קובץ שנכשל בכל ניסיון: timeout,
    // ‏403/500) — ממשיכים לחברה הבאה; היא תנוסה שוב בסבב הבא על הרשימה. עד 18/11/2026 גם תקלה עצרה את הסבב, וחברה אחת כזו
    // תקעה אותו (בכל 10 דק׳ — רק היא; גל 5 בבדיקת העומק, F23)
    try { const r = await fillAll(cik, { ...deps, getText, budgetMs: budget - (Date.now() - t0) }); done++; added += r.added; if (r.left && Date.now() - t0 >= budget) break; if (r.left) failed++; }
    catch (e) { /* חברה אחת — לא עוצרת את הסבב */ }
  }
  const ns = { i, at: new Date(deps.now || Date.now()).toISOString() };
  if (deps.store) deps.store.put(STATE, ns);
  else { const c = deps.r2c || R2.config(); if (c.ok) await R2.putText(c, deps, STATE, JSON.stringify(ns), 'application/json').catch(() => {}); }
  return { ok: true, done, added, failed, i, ms: Date.now() - t0 };
}

module.exports = { load, fillAll, tick, slim, slimCf, slimIs, needCf, needIs, needX, readMissing, periodic, readOne, readCf, readPr, prNeed, PR_V, merge8k, key, PRE, V, SINCE_Y, MAX_LIVE };
