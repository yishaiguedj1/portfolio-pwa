'use strict';
/* כל השירותים במקום אחד (26/10/2026, שלב 1 ב־תוכנית-עמידות-שירותים.md, בקשת המשתמש: "פרויקט מאוחד לכל השירותים חוץ מ־GitHub").
   טהור: מקבל את מה שכבר נמדד (sysUsage/main — upv, sto; השרתים; שרשרת המיילים) ומחזיר שורה לכל שירות:
   { k, st, pct, at, bk, m } — st: ok / warn (מ־70%) / crit (מ־90%) / down / off (לא נמדד — אין טוקן) / na (אין מונה בכלל),
   pct = האחוז הגבוה מבין המדדים של השירות, at = מתי נמדד (מילישניות), bk = קוד הגיבוי (טקסט במסך), m = מדדים [{k, pct}].
   אף מספר לא מומצא: שירות שלא נמדד = off/na, לא "תקין". התראה למנהל מ־70% — alertsDue (פעם אחת לכל מדד, עד שהוא יורד מתחת ל־60). */

const WARN = 70, CRIT = 90, CLEAR = 60;
const SRV_DOWN_MS = 15 * 60e3;

/* הסדר = סדר ההצגה. bk: none = אין גיבוי (סיכון), אחר = שם הגיבוי (מילולי במסך). paid = כבר מעל החינם בידיעה (R2) */
const SERVICES = [
  { k: 'fs', bk: 'fs' },          // Firebase — Auth + Firestore. גיבוי: עותק יומי לשחזור בלבד (התוכנית: מסד משלנו)
  { k: 'vercel', bk: 'vercel' },  // השרתון בגיבוי — השרת שלנו ראשי
  { k: 'hetzner', bk: 'hetzner' },// השרת: השרתון — Vercel; התרגום — Routine / העתק־הדבק / הטלפון
  { k: 'r2', bk: 'r2' },          // קבצים — Drive של המנהל לספרים ולגיבוי היומי
  { k: 'mail', bk: 'mail' },      // שרשרת שירותי השליחה — ואחריה Firebase
  { k: 'pages', bk: 'pages' },    // Cloudflare Pages — GitHub Pages נפרס במקביל
  { k: 'dns', bk: 'none' },       // Cloudflare DNS — אין גיבוי
  { k: 'drive', bk: 'none' },     // Google Drive של המנהל — הגיבוי עצמו
  { k: 'gemini', bk: 'gemini' },  // Mistral, MyMemory
  { k: 'anthropic', bk: 'anthropic' }, // Routine, העתק־הדבק, תרגום בטלפון
  { k: 'market', bk: 'market' },  // Yahoo — CNBC, Stooq
  { k: 'hf', bk: 'hf' },          // Hugging Face — המודלים כבר בתוך התמונה
];
const KEYS = SERVICES.map((s) => s.k);

const lvl = (pct) => (pct == null ? null : pct >= CRIT ? 'crit' : pct >= WARN ? 'warn' : 'ok');
const r1 = (x) => Math.round(x * 10) / 10;
/* מדדים מספק שנמדד (usage.js: {st, items:[{k, pct}], at בשניות}) → {st, pct, at, m} */
function fromProv(P, skip) {
  if (!P || !P.st || P.st === 'off') return { st: 'off' };
  const at = P.at ? +P.at * 1000 : 0;
  if (P.st === 'err') return { st: 'down', at, err: String(P.err || '').slice(0, 20) };
  const m = (P.items || []).filter((x) => x && x.pct != null && !(skip || []).includes(x.k)).map((x) => ({ k: String(x.k), pct: r1(+x.pct) }));
  if (!m.length) return { st: 'off' };
  const pct = Math.max(...m.map((x) => x.pct));
  return { st: lvl(pct), pct, at, m };
}

/* f = { prov (provMerge), sto (sysUsage.sto), servers ([{seen, paused, dn}]), mail (mailer.view), now } */
function servicesView(f) {
  const F = f || {}, now = +F.now || Date.now(), P = F.prov || {};
  const out = [];
  for (const s of SERVICES) {
    let r = { st: 'na' };
    if (s.k === 'fs') r = fromProv(P.firestore);
    else if (s.k === 'vercel') r = fromProv(P.vercel);
    else if (s.k === 'r2') {
      // האחסון מעל 10GB = כבר משלמים בידיעה (המשתמש — 24/10) — לא מתריעים עליו; הפעולות כן
      r = fromProv(P.r2, ['store']);
      const sto = F.sto && F.sto.r2;
      if (sto && Array.isArray(sto.b) && sto.b.length) {
        const gb = sto.b.reduce((a, b) => a + (+b.gb || 0), 0);
        r.gb = Math.round(gb * 100) / 100;
        if (gb > 10) r.paid = 1;
        else { const pc = r1(gb / 10 * 100); r.m = (r.m || []).concat([{ k: 'store', pct: pc }]); r.pct = Math.max(r.pct || 0, pc); if (r.st === 'off') r.st = lvl(pc), r.at = +sto.at * 1000 || 0; else r.st = lvl(r.pct); }
      }
    } else if (s.k === 'drive') {
      const d = F.sto && F.sto.drive;
      if (d && d.gb != null && d.lim) { const pc = r1(d.gb / d.lim * 100); r = { st: lvl(pc), pct: pc, at: +d.at * 1000 || 0, m: [{ k: 'store', pct: pc }] }; }
      else if (d && d.gb != null) r = { st: 'ok', at: +d.at * 1000 || 0 };
      else r = { st: 'off' };
    } else if (s.k === 'hetzner') {
      const sv = (F.servers || []).filter((x) => x && !x.paused);
      if (!sv.length) r = { st: (F.servers || []).length ? 'ok' : 'off' };
      else {
        const seen = Math.max(...sv.map((x) => +x.seen || 0));
        const down = sv.filter((x) => x.dn || !x.seen || now - x.seen > SRV_DOWN_MS).length;
        const disk = sv.map((x) => x.hb && x.hb.disk).filter((x) => Number.isFinite(+x)).map(Number);
        r = { st: down === sv.length ? 'down' : down ? 'warn' : 'ok', at: seen, n: sv.length, dn: down };
        if (disk.length) { const pc = Math.max(...disk); r.m = [{ k: 'disk', pct: r1(pc) }]; r.pct = r1(pc); if (r.st === 'ok') r.st = lvl(pc); }
      }
    } else if (s.k === 'mail') {
      const M = F.mail;
      if (!M || !Array.isArray(M.list)) r = { st: 'off' };
      else {
        const on = M.list.filter((x) => x.on);
        if (!on.length) r = { st: 'off' };
        else {
          const max = on.reduce((a, x) => a + (+x.dayMax || 0), 0), used = on.reduce((a, x) => a + (+x.day || 0), 0);
          const pc = max ? r1(used / max * 100) : 0;
          r = { st: M.left > 0 ? lvl(pc) : 'down', pct: pc, at: now, left: +M.left || 0, n: on.length, m: [{ k: 'day', pct: pc }] };
        }
      }
    }
    out.push(Object.assign({ k: s.k, bk: s.bk }, r));
  }
  const sum = { ok: 0, warn: 0, crit: 0, down: 0, off: 0, na: 0, risk: 0 };
  for (const r of out) { sum[r.st] = (sum[r.st] || 0) + 1; if (r.bk === 'none') sum.risk++; }
  return { now, rows: out, sum };
}

/* התראה מ־70%: prev = {<שירות.מדד>: 1} ממה שכבר הותרע. מחזיר { fire: [מפתחות חדשים], keep } — מדד שירד מתחת ל־60 יוצא מ־keep */
function alertsDue(view, prev) {
  const was = prev && typeof prev === 'object' ? prev : {}, keep = {}, fire = [];
  for (const r of (view && view.rows) || []) {
    for (const m of r.m || []) {
      const key = r.k + '.' + m.k;
      if (m.pct >= WARN) { keep[key] = 1; if (!was[key]) fire.push(key); }
      else if (was[key] && m.pct >= CLEAR) keep[key] = 1;
    }
    // נפילה — רק המיילים (לשרת כבר יש התראה משלו, srv_down; תקלה במדידה של ספק היא לא נפילה של השירות)
    if (r.st === 'down' && r.k === 'mail') { const key = r.k + '.down'; keep[key] = 1; if (!was[key]) fire.push(key); }
  }
  return { fire, keep };
}

module.exports = { SERVICES, KEYS, WARN, CRIT, CLEAR, servicesView, alertsDue, fromProv };
