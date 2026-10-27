// Studio Browser ↔ Chrome — הלוגיקה של הסנכרון (26/10/2026, בקשת המשתמש: "סנכרון אוטומטי, בלי כפילויות").
// טהור: בלי chrome.* ובלי רשת — נבדק ב־node (tests/chrome-ext.test.js).
//
// המבנה: Chrome הוא המקור. רק התוסף כותב את state.json (ב־appDataFolder של Drive של המשתמש — לא אצלנו);
// Studio Browser כותב רק ops.json: מה שהשתנה אצלו (נוספה / נמחקה / ביקורים). התוסף מחיל את זה על Chrome
// ובונה את state.json מחדש מהעץ של Chrome. כך אין שני כותבים לאותו קובץ ואין מיזוג משני הצדדים.

export const STATE_V = 1;
export const OPS_V = 1;
export const HIST_DAYS = 30;
export const HIST_MAX = 3000;
export const DEL_HOLD_MIN = 10;      // מחיקה גדולה (יותר מ־DEL_HOLD_MIN וגם מרבע) — מחכה לאישור בחלון של התוסף

const TRACK = /^(utm_[a-z0-9_]+|fbclid|gclid|gbraid|wbraid|dclid|msclkid|mc_cid|mc_eid|igshid|_ga|_gl|yclid|ref_src)$/i;

/** אותו מפתח בדיוק של BrSync.key ב־Studio Browser — אותה סימנייה גם בכתובת שנכתבה אחרת */
export function key(url) {
  let u = String(url || '').trim();
  const sch = u.indexOf('://');
  if (sch <= 0) return u.toLowerCase();
  const scheme = u.slice(0, sch).toLowerCase();
  u = u.slice(sch + 3);
  let frag = '';
  const h = u.indexOf('#'); if (h >= 0) { frag = u.slice(h + 1); u = u.slice(0, h); }
  let query = '';
  const q = u.indexOf('?'); if (q >= 0) { query = u.slice(q + 1); u = u.slice(0, q); }
  const slash = u.indexOf('/');
  let host = (slash >= 0 ? u.slice(0, slash) : u);
  host = host.slice(host.lastIndexOf('@') + 1).toLowerCase().replace(/\.+$/, '');
  let path = slash >= 0 ? u.slice(slash) : '/';
  if (host.startsWith('www.')) host = host.slice(4);
  if ((scheme === 'https' && host.endsWith(':443')) || (scheme === 'http' && host.endsWith(':80'))) host = host.slice(0, host.lastIndexOf(':'));
  path = path.replace(/%[0-9a-fA-F]{2}/g, (m) => m.toUpperCase());
  if (path.length > 1) path = path.replace(/\/+$/, '') || '/';
  const qs = query.split('&').filter((p) => p && !TRACK.test(p.split('=')[0])).join('&');
  const f = frag.startsWith('/') || frag.startsWith('!') ? frag : '';
  const web = scheme === 'http' || scheme === 'https';
  return (web ? '' : scheme + '://') + host + path + (qs ? '?' + qs : '') + (f ? '#' + f : '');
}

export const isWeb = (u) => /^https?:\/\//i.test(String(u || ''));

/** שם תיקייה בנתיב: "/" מפריד בין תיקיות, אז "/" בתוך שם מוחלף ב־"∕" (נראה אותו דבר) */
export const seg = (t) => String(t || '').replace(/\//g, '\u2215');

/**
 * העץ של Chrome (chrome.bookmarks.getTree) → רשימה שטוחה בסדר של Chrome: id, כתובת, שם, איזה שורש (b/o/m), נתיב התיקיות
 * ו־i = המקום בתוך התיקייה. כל סימנייה עם כתובת — גם שאינה אתר (javascript:, chrome://) — כדי שהטלפון יראה בדיוק מה שב־Chrome.
 * `dirs` (אם הועבר מערך) מתמלא בכל התיקיות — גם ריקות — עם המקום שלהן.
 */
export function flatten(tree, dirs) {
  const root = Array.isArray(tree) ? tree[0] : tree;
  const out = [];
  const kids = (root && root.children) || [];
  kids.forEach((top, i) => {
    const ft = top.folderType || ['bookmarks-bar', 'other', 'mobile'][i] || 'other';
    const r = ft === 'bookmarks-bar' ? 'b' : ft === 'mobile' ? 'm' : 'o';
    const walk = (n, path) => {
      (n.children || []).forEach((c, j) => {
        if (c.url) out.push({ id: c.id, u: c.url, t: c.title || '', r, p: path.join('/'), i: j, at: c.dateAdded || 0 });
        else { const sub = path.concat(seg(c.title)); if (dirs) dirs.push({ r, p: sub.join('/'), i: j }); walk(c, sub); }
      });
    };
    walk(top, []);
  });
  return out;
}

/** מזהה תיקיית "סימניות בנייד" (לשם נכנס מה שנשמר בטלפון); אם אין — "סימניות אחרות" */
export function mobileFolderId(tree) {
  const kids = ((Array.isArray(tree) ? tree[0] : tree) || {}).children || [];
  const m = kids.find((k) => k.folderType === 'mobile') || kids[2];
  const o = kids.find((k) => k.folderType === 'other') || kids[1];
  return (m || o || {}).id || null;
}

/**
 * מה לעשות ב־Chrome עם הפעולות שהגיעו מהטלפון (רק אלה שעוד לא טופלו — s > ack):
 * add — רק אם אין כבר סימנייה עם אותו מפתח (אז רק מקשרים את המזהה הזמני של הטלפון לסימנייה הקיימת);
 * del — לפי המזהה (n…), או לפי המזהה הזמני שכבר קושר; מחיקה גדולה מחכה לאישור (`hold`), אלא אם `allowDel`.
 * מחזיר את הפעולות ל־Chrome; לא נוגע בכלום בעצמו.
 */
export function planOps(flat, opsFile, prev, allowDel = false) {
  const ack = (prev && prev.ack) || 0;
  const alias = Object.assign({}, (prev && prev.alias) || {});     // מזהה זמני של הטלפון (a…) → מזהה ב־Chrome (n…)
  const ops = ((opsFile && opsFile.ops) || []).filter((o) => o && o.s > ack).sort((a, b) => a.s - b.s);
  // מפתח → כל הסימניות עם הכתובת הזו (Chrome מרשה אותה כתובת בכמה תיקיות) — מחיקה של אחת לא "משכיחה" את האחרות
  const byKey = new Map(); for (const m of flat) { const k = key(m.u); if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(m); }
  const byId = new Map(flat.map((m) => ['n' + m.id, m]));
  const creates = [], deletes = [], renames = [];
  const created = new Map();                      // מפתח → מזהה זמני (נוצר באותה אצווה)
  const dels = ops.filter((o) => o.k === 'del').length;
  const hold = !allowDel && dels > DEL_HOLD_MIN && dels > flat.length / 4;
  let last = ack;
  for (const o of ops) {
    if (hold && o.k === 'del') break;             // עוצרים לפני המחיקה הראשונה — כל מה שאחריה מחכה לאישור
    last = o.s;
    if (o.k === 'add') {
      if (!isWeb(o.u)) continue;
      const k = key(o.u);
      const have = (byKey.get(k) || [])[0];
      if (have) { if (o.id) alias[o.id] = 'n' + have.id; continue; }
      if (created.has(k)) { if (o.id) alias[o.id] = created.get(k); continue; }
      creates.push({ aid: o.id || '', u: o.u, t: o.t || '' });
      created.set(k, o.id || '');
    } else if (o.k === 'del') {
      const sid = String(o.id || '').startsWith('a') ? alias[o.id] : o.id;
      const m = sid ? byId.get(sid) : (o.u ? (byKey.get(key(o.u)) || [])[0] : null);
      if (m) { deletes.push(m.id); const l = byKey.get(key(m.u)) || []; l.splice(l.indexOf(m), 1); if (!l.length) byKey.delete(key(m.u)); byId.delete('n' + m.id); }
      else { const ci = creates.findIndex((c) => c.aid && c.aid === o.id); if (ci >= 0) { created.delete(key(creates[ci].u)); creates.splice(ci, 1); } }
    } else if (o.k === 'ren') {
      const sid = String(o.id || '').startsWith('a') ? alias[o.id] : o.id;
      const m = sid ? byId.get(sid) : null;
      if (m && o.t && o.t !== m.t) renames.push({ id: m.id, t: String(o.t).slice(0, 300) });
    }
  }
  return { creates, deletes, renames, ack: last, alias, hold: hold ? dels : 0 };
}

/** ביקורים מהטלפון שעוד לא נכנסו ל־Chrome (אחרי `vat`) — chrome.history.addUrl */
export function planVisits(opsFile, prev) {
  const vat = (prev && prev.vat) || 0;
  const vis = ((opsFile && opsFile.vis) || []).filter((v) => v && isWeb(v.u) && v.at > vat);
  const seen = new Set();
  const add = vis.filter((v) => { const k = key(v.u); if (seen.has(k)) return false; seen.add(k); return true; });
  return { add, vat: vis.reduce((m, v) => Math.max(m, v.at), vat) };
}

/**
 * state.json מחדש מהעץ של Chrome. `o` = מאיפה הגיעה: a = נשמרה בטלפון (נוצרה כאן מפעולת add), c = Chrome.
 * `origin` = המזהים שנוצרו מהטלפון (נשמר בתוסף), `alias` נשמר כדי שהטלפון יקשר את המזהים הזמניים שלו.
 */
export function buildState({ flat, dirs, hist, prev, ack, alias, vat, origin, now, hold }) {
  const fromApp = new Set(origin || []);
  const marks = flat.map((m) => ({ id: 'n' + m.id, u: m.u, t: m.t, r: m.r, p: m.p, i: m.i, at: m.at, o: fromApp.has('n' + m.id) ? 'a' : 'c' }));
  const since = now - HIST_DAYS * 86400000;
  const h = (hist || []).filter((v) => isWeb(v.url) && v.lastVisitTime >= since)
    .sort((a, b) => b.lastVisitTime - a.lastVisitTime).slice(0, HIST_MAX)
    .map((v) => ({ u: v.url, t: v.title || '', at: Math.round(v.lastVisitTime) }));
  // מזהים זמניים שכבר לא מצביעים על סימנייה קיימת — יוצאים מהטבלה
  const live = new Set(marks.map((m) => m.id));
  const al = {}; for (const [a, n] of Object.entries(alias || {})) if (live.has(n)) al[a] = n;
  return { v: STATE_V, at: now, rev: ((prev && prev.rev) || 0) + 1, ack: ack || 0, vat: vat || 0, alias: al, hold: hold || 0, marks, dirs: dirs || [], hist: h };
}

/** האם יש בכלל מה לכתוב (כדי לא לכתוב ל־Drive כל כמה דקות בלי סיבה) */
export function sameState(a, b) {
  if (!a || !b) return false;
  const strip = (s) => JSON.stringify({ ack: s.ack, vat: s.vat, alias: s.alias, hold: s.hold, marks: s.marks, dirs: s.dirs || [], hist: (s.hist || []).slice(0, 50) });
  return strip(a) === strip(b);
}
