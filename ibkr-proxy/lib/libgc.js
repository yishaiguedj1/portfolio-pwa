'use strict';
/* מנהל הספרייה, ס׳9 (11/10/2026): ניקוי יומי של R2 — רץ מהקרון היומי (אחרי הגיבוי). מוחק רק מה שבוודאות לא בשימוש:
   1. קבצים זמניים של העלאה (lib/v2/in/) — אחרי יום (הקישור החתום פג אחרי שעה; upCommit מוחק בהצלחה — כאן רק שאריות).
   2. קבצי ספרים וכריכות (lib/v2/f/, lib/v2/c/) שאף ספר בקטלוג לא מפנה אליהם — כולל ספרים ב״נמחקו לאחרונה״ —
      ורק אחרי 30 יום (כך גם עריכה שבוטלה יכולה להחזיר אותם).
   3. גרסאות בארכיון (lib/v2/arc/) — נשמרות 30 יום, ולפחות 200 האחרונות.
   4. המראה הישנה של Drive (lib/<id>.<md5>.epub ו־lib/catalog.json) — רק 30 יום אחרי שהמדף עבר ל־R2 (cfg.at), וכל עוד הוא שם.
   בטיחות: בלי קטלוג תקין — לא נוגעים בכלום; קובץ בלי תאריך — לא נמחק; עד GC_MAX מחיקות בריצה; ואם יותר מחצי מקבצי
   הספרים נראים "יתומים" — עוצרים (קטלוג שנפגם לא מוחק את הספרייה). */
const C = require('./libcat');

const DAY = 864e5;
const GC_TMP = DAY, GC_KEEP = 30 * DAY, ARC_MIN = 200, GC_MAX = 500;
const LEGACY_RE = /^lib\/[A-Za-z0-9_-]{10,100}\.[a-f0-9]{32}\.epub$/;

/* טהורה: objs = [{ key, at }] (רשימת lib/), cat = הקטלוג המלא. מחזירה { del: [מפתחות], why: {סוג: מספר}, stop? } */
function gcPlan(cat, objs, now) {
  const out = { del: [], why: { tmp: 0, file: 0, cover: 0, arc: 0, legacy: 0 } };
  if (!cat || !cat.books || typeof cat.books !== 'object') return Object.assign(out, { stop: 'no_cat' });
  const files = new Set(), covers = new Set();
  for (const b of Object.values(cat.books)) {
    for (const f of b.files || []) { const k = C.KEYS.file(f); if (k) files.add(k); }
    if (b.cover && b.cover.h) { const k = C.KEYS.cover(b.cover.h); if (k) covers.add(k); }
  }
  const old = (o, ms) => o.at > 0 && now - o.at > ms;
  const cand = { tmp: [], file: [], cover: [], arc: [], legacy: [] };
  let nFiles = 0;
  const arcs = [];
  for (const o of Array.isArray(objs) ? objs : []) {
    const k = String(o && o.key || '');
    if (k.startsWith('lib/v2/in/')) { if (old(o, GC_TMP)) cand.tmp.push(k); }
    else if (k.startsWith('lib/v2/f/')) { nFiles++; if (!files.has(k) && old(o, GC_KEEP)) cand.file.push(k); }
    else if (k.startsWith('lib/v2/c/')) { if (!covers.has(k) && old(o, GC_KEEP)) cand.cover.push(k); }
    else if (/^lib\/v2\/arc\/\d{9}\.json\.gz$/.test(k)) arcs.push(o);
    else if ((LEGACY_RE.test(k) || k === 'lib/catalog.json') && cat.cfg && cat.cfg.source === 'r2' && cat.cfg.at > 0 && now - cat.cfg.at > GC_KEEP) cand.legacy.push(k);
  }
  arcs.sort((a, b) => (a.key < b.key ? 1 : -1));   // מהחדשה לישנה (המספר מרופד באפסים)
  arcs.slice(ARC_MIN).forEach((o) => { if (old(o, GC_KEEP)) cand.arc.push(o.key); });
  if (cand.file.length && cand.file.length * 2 > nFiles) return Object.assign(out, { stop: 'orphans' });
  for (const t of ['tmp', 'arc', 'file', 'cover', 'legacy']) {
    for (const k of cand[t]) { if (out.del.length >= GC_MAX) break; out.del.push(k); out.why[t]++; }
  }
  return out;
}

/* io = { cat() → קטלוג או null, list(prefix) → [{key, at}], del(key) } */
async function runGc(io, now) {
  const cat = await io.cat().catch(() => null);
  if (!cat) return { ok: false, stop: 'no_cat' };
  const plan = gcPlan(cat, await io.list('lib/'), now);
  if (plan.stop) return { ok: false, stop: plan.stop };
  let gone = 0;
  for (const k of plan.del) { try { await io.del(k); gone++; } catch (e) {} }
  return { ok: true, gone, why: plan.why };
}

module.exports = { GC_TMP, GC_KEEP, ARC_MIN, GC_MAX, gcPlan, runGc };
