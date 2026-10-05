/* v339 (בקשת המשתמש 05/10/2026): חיסכון והגנה על תקציב ה־AI — מטמון משותף + מפסק יומי + מגבלה לכל קורא.
   הכל ב־Firestore דרך חשבון השירות (REST, בלי תלויות):
     aiCache/{sha256}  — תשובה שחושבה פעם אחת משמשת את כל הקוראים ושורדת הפעלה מחדש של השרתון
                         ("בהקשר הזה" לפי מילה+הקשר+שפה, ניתוח מכתב לפי מזהה+md5). בלי טקסט מהספר — רק התשובה.
     aiUse/{יום}       — מונים אטומיים (increment): t = כל הקריאות היום, i = ניתוחי מכתבים, u_<hash> = לכל קורא.
   מפסק: מעבר לתקרה היומית ה־AI כבוי עד מחר (התרגום, המילון וויקיפדיה ממשיכים — הם חינמיים).
   תקרות במשתני סביבה (אופציונלי): AI_DAILY_LIMIT (2000), AI_USER_DAILY (150), AI_ANON_DAILY (40), AI_INSIGHT_DAILY (100).
   Firestore לא זמין (אין חשבון שירות / תקלה) → מונים בזיכרון של המופע, עם אותן תקרות — אף פעם לא בלי הגבלה. */
const crypto = require('crypto');
const { datastoreToken } = require('./gauth');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e';
const DB = () => 'projects/' + PROJECT() + '/databases/(default)/documents';
const BASE = () => 'https://firestore.googleapis.com/v1/';
const TTL = { ctx: 180 * 864e5, ins: 3650 * 864e5 };
const num = (k, d) => { const v = parseInt(process.env[k], 10); return v > 0 ? v : d; };
const limits = () => ({ total: num('AI_DAILY_LIMIT', 2000), user: num('AI_USER_DAILY', 150), anon: num('AI_ANON_DAILY', 40), ins: num('AI_INSIGHT_DAILY', 100) });
const hash = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const today = (now) => new Date(now || Date.now()).toISOString().slice(0, 10);

function aiKey(kind, parts) { return kind + '_' + hash(parts.map((p) => String(p == null ? '' : p)).join('\u0001')).slice(0, 40); }

function createAiStore(deps = {}) {
  const f = (...a) => (deps.fetch || fetch)(...a);
  const tok = () => (deps.token ? deps.token() : datastoreToken(deps.fetch));
  const mem = { day: '', c: {} };                 // גיבוי כש־Firestore לא זמין
  const memCache = new Map();
  const req = async (url, opt, ms) => {
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms || 2500);
    try {
      const t = await tok();
      const r = await f(url, Object.assign({ signal: ctl.signal }, opt, { headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' } }));
      let j = null; try { j = await r.json(); } catch (e) {}
      return { status: r.status, j };
    } finally { clearTimeout(to); }
  };

  async function get(kind, parts) {
    const key = aiKey(kind, parts);
    const m = memCache.get(key); if (m) return m;
    try {
      const r = await req(BASE() + DB() + '/aiCache/' + key, { method: 'GET' });
      if (r.status !== 200 || !r.j || !r.j.fields) return null;
      const fl = r.j.fields, at = +((fl.t || {}).integerValue || 0);
      if (!at || Date.now() - at > (TTL[kind] || TTL.ctx)) return null;
      const v = JSON.parse((fl.v || {}).stringValue || 'null');
      if (v) { memCache.set(key, v); if (memCache.size > 500) memCache.clear(); }
      return v;
    } catch (e) { return null; }
  }
  async function set(kind, parts, value) {
    const key = aiKey(kind, parts);
    memCache.set(key, value); if (memCache.size > 500) memCache.clear();
    try {
      await req(BASE() + DB() + '/aiCache/' + key, { method: 'PATCH', body: JSON.stringify({ fields: {
        v: { stringValue: JSON.stringify(value).slice(0, 60000) }, t: { integerValue: String(Date.now()) }, k: { stringValue: kind } } }) });
    } catch (e) {}
  }
  /* מונים אטומיים: מעלה את השדות ומחזיר את הערכים החדשים (פעולה אחת — commit עם increment) */
  async function bump(fields, now) {
    const day = today(now);
    try {
      const r = await req(BASE() + DB() + ':commit', { method: 'POST', body: JSON.stringify({ writes: [{
        transform: { document: DB() + '/aiUse/' + day, fieldTransforms: fields.map((fp) => ({ fieldPath: fp, increment: { integerValue: '1' } })) } }] }) });
      const tr = r.status === 200 && r.j && r.j.writeResults && r.j.writeResults[0] && r.j.writeResults[0].transformResults;
      if (tr && tr.length === fields.length) { const o = {}; fields.forEach((fp, i) => { o[fp] = +(tr[i].integerValue || 0); }); return o; }
    } catch (e) {}
    if (mem.day !== day) { mem.day = day; mem.c = {}; }
    const o = {}; fields.forEach((fp) => { mem.c[fp] = (mem.c[fp] || 0) + 1; o[fp] = mem.c[fp]; });
    o._mem = true;
    return o;
  }
  /* בקשה ל־AI: מותרת? who = uid (מחובר) או 'ip:<כתובת>' (לא מחובר). מחזיר { ok, why } */
  async function allow(who, kind, now) {
    const L = limits();
    const anon = String(who || '').startsWith('ip:');
    const uf = 'u_' + hash(who || 'anon').slice(0, 16);
    const fields = kind === 'ins' ? ['t', 'i'] : ['t', uf];
    const c = await bump(fields, now);
    if (c.t > L.total) return { ok: false, why: 'daily' };
    if (kind === 'ins' && c.i > L.ins) return { ok: false, why: 'daily' };
    if (kind !== 'ins' && c[uf] > (anon ? L.anon : L.user)) return { ok: false, why: 'user' };
    return { ok: true };
  }
  /* אבחון: כתיבה וקריאה אמיתיות ב־Firestore (בלי הזיכרון) + מונה — האם המטמון והמונים באמת משותפים */
  async function probe() {
    const parts = ['probe', String(Date.now())];
    await set('ctx', parts, { translation: 'probe' });
    memCache.delete(aiKey('ctx', parts));
    const back = await get('ctx', parts);
    const c = await bump(['probe']);
    return { cache: !!(back && back.translation === 'probe'), counters: !c._mem, n: c.probe };
  }
  return { get, set, allow, probe, _mem: mem, _memCache: memCache };
}

module.exports = { createAiStore, aiKey, limits };
