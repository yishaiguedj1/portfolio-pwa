'use strict';
/* 28/10/2026: מונה קריאות Firestore לפי פעולה — בשרת שלנו בלבד (server.js עוטף את fetch הגלובלי).
   רקע: מכסת 50 אלף הקריאות ביום נגמרה פעמיים (26/10, 28/10) ולא היה אפשר לדעת מי צרך אותה — Cloud Monitoring נותן רק סכום.
   היום = יום המכסה (חצות בשעון קליפורניה). בזיכרון בלבד; התוויות הן שמות פעולות (studio:jobs, ibkr-sync:px) — בלי נתוני משתמש.
   החיוב: מסמך = קריאה, שאילתה = מספר המסמכים שחזרו (לפחות 1), ספירה (aggregation) = 1 לכל 1000 (כאן — 1). */
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();
const TAG_MAX = 120;
let day = '', total = 0, by = new Map(), hours = new Map();

const dayKey = (now) => new Date(now).toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
const tagOf = (name, req) => {
  const b = (req && req.body) || {}, q = (req && req.query) || {};
  const op = String((b && typeof b === 'object' && b.op) || q.op || q.job || req.method || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 24);
  return String(name || '').slice(0, 24) + (op ? ':' + op : '');
};
function run(tag, fn) { return als.run({ tag }, fn); }
function add(reads, now = Date.now()) {
  if (!(reads > 0)) return;
  const d = dayKey(now);
  if (d !== day) { day = d; total = 0; by = new Map(); hours = new Map(); }
  const st = als.getStore();
  let t = (st && st.tag) || 'other';
  if (!by.has(t) && by.size >= TAG_MAX) t = 'other';
  by.set(t, (by.get(t) || 0) + reads);
  const h = new Date(now).toISOString().slice(0, 13);
  hours.set(h, (hours.get(h) || 0) + reads);
  total += reads;
}
/* כמה קריאות חויבו בתשובה הזו (רק תשובה מוצלחת — שגיאה/429 לא נספרת) */
function readsOf(method, url, status, j) {
  if (status !== 200) return 0;
  if (/:runQuery(\?|$)/.test(url)) return Math.max(1, Array.isArray(j) ? j.filter((x) => x && x.document).length : 0);
  if (/:runAggregationQuery(\?|$)/.test(url)) return 1;
  if (/:batchGet(\?|$)/.test(url)) return Math.max(1, Array.isArray(j) ? j.filter((x) => x && x.found).length : 0);
  if (method === 'GET') return Math.max(1, j && Array.isArray(j.documents) ? j.documents.length : 1);
  return 0;
}
/* עוטף fetch: בקשה ל־Firestore נמדדת (על עותק של התשובה — הקורא מקבל אותה כמו שהיא) */
function wrapFetch(f) {
  if (typeof f !== 'function' || f._fsm) return f;
  const w = async (input, init) => {
    const r = await f(input, init);
    try {
      const url = String(typeof input === 'string' ? input : (input && input.url) || '');
      if (url.includes('firestore.googleapis.com/') && r && r.status === 200 && typeof r.clone === 'function') {
        const method = String((init && init.method) || (input && input.method) || 'GET').toUpperCase();
        const store = als.getStore();
        if (method === 'GET' || /:(runQuery|runAggregationQuery|batchGet)(\?|$)/.test(url)) {
          r.clone().json().then((j) => als.run(store || { tag: 'other' }, () => add(readsOf(method, url, 200, j)))).catch(() => {});
        }
      }
    } catch (e) {}
    return r;
  };
  w._fsm = true;
  return w;
}
function view(now = Date.now()) {
  if (dayKey(now) !== day) return { day: dayKey(now), total: 0, top: [], hours: [] };
  const top = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
  const hrs = [...hours.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).slice(-24);
  return { day, total, top, hours: hrs };
}
const _reset = () => { day = ''; total = 0; by = new Map(); hours = new Map(); };

module.exports = { run, add, readsOf, wrapFetch, view, tagOf, dayKey, _reset };
