/* השלמת companyfacts מקובץ ה־XBRL של ההגשה עצמה (5/11/2026).
   companyfacts של SEC לא תמיד מכיל דוח שהוגש: ב־5/11/2026 חסרו בו 56 דוחות תקופתיים של 42 חברות מ־S&P 500 ו־Nasdaq-100
   (AEP, ‏V, ‏PLD, ‏NEE, ‏DUK…, רובם 10-Q של יולי ואוקטובר 2026). הדוח עצמו ב־EDGAR, ולכן המסך הראה רבעון ישן בלי שום סימן.
   כאן: דוח תקופתי שב־submissions ולא ב־companyfacts → קובץ ה־instance של ההגשה (‎<doc>_htm.xml‎, מה ש־SEC עצמו מחלץ מה־iXBRL)
   → אותה צורה של companyfacts (רק ערכים בלי ממד, בטקסונומיות הסטנדרטיות — כמו companyfacts), וממוזג (mergeFacts).
   משם הכל כרגיל: בחירת התגיות, האחרון שהוגש גובר, הבדיקות, השוואת המקורות. מידע ציבורי בלבד. */
'use strict';

// רק הגשה מקורית: תיקון (‎/A‎) עלול להכיל דוחות של ישות אחרת בלי ממד (Rule 3-09 — חברה כלולה; FMX ‏20-F/A ‏2026: הרווח הנקי זז
// מול הדוח המודפס), וכשהוא חסר — המצב כמו לפני ההשלמה
const PERIODIC = /^(10-K|10-Q|20-F|40-F)$/;
// טקסטונומיות ש־companyfacts מכיל (תגית פרטית של החברה — לא נכנסת, גם שם לא)
const NS = [[/fasb\.org\/us-gaap\//, 'us-gaap'], [/xbrl\.ifrs\.org\/taxonomy\/[^"]*ifrs-full/, 'ifrs-full'], [/xbrl\.sec\.gov\/dei\//, 'dei'], [/fasb\.org\/srt\//, 'srt']];
const memo = new Map(); // הגשה לא משתנה אחרי שהוגשה — הקובץ המפוענח נשמר בזיכרון (גם לבקרה הלילית, שמביאה את companyfacts שוב)
const MAX_FILINGS = 4; // הכי חדשים קודם; יותר מזה — כנראה תקלה רחבה ב־SEC, לא מורידים עשרות קבצים לבקשה אחת
const SINCE_DAYS = 800;

const accSet = (facts) => {
  const s = new Set();
  for (const ns of Object.values((facts && facts.facts) || {})) for (const t of Object.values(ns)) for (const u of Object.values(t.units || {})) for (const x of u) if (x.accn) s.add(x.accn);
  return s;
};

/* הדוחות התקופתיים ב־submissions (מהחדש לישן) שאין להם אף ערך ב־companyfacts */
function missingFilings(sub, facts, now = Date.now()) {
  const R = sub && sub.filings && sub.filings.recent;
  if (!R || !R.form) return [];
  const have = accSet(facts), since = new Date(now - SINCE_DAYS * 864e5).toISOString().slice(0, 10), out = [];
  for (let i = 0; i < R.form.length && out.length < MAX_FILINGS; i++) {
    if ((R.filingDate[i] || '') < since) break;
    if (!PERIODIC.test(R.form[i] || '') || have.has(R.accessionNumber[i])) continue;
    if (R.isXBRL && !R.isXBRL[i]) continue;
    out.push({ acc: R.accessionNumber[i], form: R.form[i], filed: R.filingDate[i], doc: R.primaryDocument ? R.primaryDocument[i] : null, per: R.reportDate ? R.reportDate[i] : null });
  }
  return out;
}

const measure = (m) => { const s = String(m || '').trim(); const i = s.indexOf(':'); return i >= 0 ? s.slice(i + 1) : s; };

/* instance XML → { facts: { ns: { tag: { units: { USD: [{start?, end, val, accn, form, filed}] } } } } } */
function parseInstance(xml, meta = {}) {
  const out = { facts: {} };
  if (!xml || typeof xml !== 'string') return out;
  const root = (xml.match(/<(?:[\w-]+:)?xbrl\b[^>]*>/) || [''])[0];
  const pre = {}; // קידומת → מפתח companyfacts
  for (const m of root.matchAll(/xmlns:([\w-]+)="([^"]+)"/g)) { const hit = NS.find(([re]) => re.test(m[2])); if (hit) pre[m[1]] = hit[1]; }
  const ctx = new Map();
  for (const m of xml.matchAll(/<(?:[\w-]+:)?context\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?context>/g)) {
    const b = m[2];
    if (/<(?:[\w-]+:)?(segment|scenario)\b/.test(b)) continue; // ערך עם ממד (חברה בת, מגזר) — לא ב־companyfacts
    const g = (k) => { const r = b.match(new RegExp('<(?:[\\w-]+:)?' + k + '>\\s*([^<\\s]+)\\s*<')); return r ? r[1].slice(0, 10) : null; };
    const inst = g('instant'), st = g('startDate'), en = g('endDate');
    if (inst) ctx.set(m[1], { end: inst }); else if (st && en) ctx.set(m[1], { start: st, end: en });
  }
  const units = new Map();
  for (const m of xml.matchAll(/<(?:[\w-]+:)?unit\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?unit>/g)) {
    const b = m[2], ms = [...b.matchAll(/<(?:[\w-]+:)?measure>([^<]+)</g)].map((x) => measure(x[1]));
    if (!ms.length) continue;
    units.set(m[1], /divide\b/.test(b) && ms.length >= 2 ? ms[0] + '/' + ms[1] : ms[0]);
  }
  const seen = new Set();
  for (const m of xml.matchAll(/<([\w-]+):([\w.-]+)\b([^>]*?)(\/>|>([^<]*)<\/\1:\2>)/g)) {
    const ns = pre[m[1]]; if (!ns) continue;
    const at = m[3];
    if (!/\bunitRef="/.test(at) || /xsi:nil="true"/.test(at) || m[5] == null) continue;
    const c = ctx.get((at.match(/\bcontextRef="([^"]+)"/) || [])[1]); if (!c) continue;
    const u = units.get((at.match(/\bunitRef="([^"]+)"/) || [])[1]); if (!u) continue;
    const val = Number(m[5].trim()); if (!Number.isFinite(val) || m[5].trim() === '') continue;
    const key = ns + '|' + m[2] + '|' + u + '|' + (c.start || '') + '|' + c.end;
    if (seen.has(key)) continue; // אותו ערך בכמה מקומות בדוח
    seen.add(key);
    const T = (out.facts[ns] = out.facts[ns] || {}), node = (T[m[2]] = T[m[2]] || { units: {} });
    const row = { end: c.end, val, accn: meta.acc || null, form: meta.form || null, filed: meta.filed || null };
    if (c.start) row.start = c.start;
    (node.units[u] = node.units[u] || []).push(row);
  }
  return out;
}

const instUrl = (cik, f) => 'https://www.sec.gov/Archives/edgar/data/' + Number(cik) + '/' + f.acc.replace(/-/g, '') + '/';

/* קובץ ה־instance של הגשה: <doc>_htm.xml (iXBRL), ואם לא — לפי index.json (instance ישן, ‎.xml‎ שאינו linkbase) */
async function fetchInstance(cik, f, getText, getJson) {
  const base = instUrl(cik, f);
  if (f.doc && /\.html?$/i.test(f.doc)) {
    try { return await getText(base + f.doc.replace(/\.html?$/i, '_htm.xml')); } catch (e) { /* לפי האינדקס */ }
  }
  const idx = await getJson(base + 'index.json');
  const items = ((idx && idx.directory && idx.directory.item) || []).map((x) => x.name);
  const name = items.find((n) => /_htm\.xml$/i.test(n)) || items.find((n) => /\.xml$/i.test(n) && !/_(cal|def|lab|pre)\.xml$|FilingSummary|MetaLinks/i.test(n));
  if (!name) throw new Error('no_instance');
  return getText(base + name);
}

/* facts + הדוחות החסרים. מחזיר { facts, added: [{acc, form, filed, per, n}] }; תקלה בהגשה אחת — ממשיכים בלעדיה */
async function patchFacts(facts, sub, cik, deps) {
  const miss = missingFilings(sub, facts, deps.now || Date.now());
  if (!miss.length) return { facts, added: [] };
  const parts = await Promise.all(miss.map(async (f) => {
    const hit = memo.get(f.acc); if (hit) return { f, x: hit };
    try {
      const x = parseInstance(await fetchInstance(cik, f, deps.getText, deps.getJson), f);
      memo.set(f.acc, x); if (memo.size > 40) memo.delete(memo.keys().next().value);
      return { f, x };
    } catch (e) { return null; }
  }));
  let out = facts; const added = [];
  for (const p of parts) {
    if (!p) continue;
    let n = 0; for (const ns of Object.values(p.x.facts)) for (const t of Object.values(ns)) for (const u of Object.values(t.units)) n += u.length;
    if (!n) continue;
    out = deps.merge(out, p.x);
    added.push({ acc: p.f.acc, form: p.f.form, filed: p.f.filed, per: p.f.per, n });
  }
  return { facts: out, added };
}

module.exports = { missingFilings, parseInstance, patchFacts, fetchInstance, MAX_FILINGS };
