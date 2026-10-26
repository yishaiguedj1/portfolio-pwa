'use strict';
/* 26/10/2026 (בעקבות המחקר על Vid Hub, שלב א׳): המסלול שלפני העבודה, ו"למה ויתרת?" באומדן.
   הטלפון שולח רק מונים של צעדים קבועים וקודי סיבה קבועים (op:'fnl'), והשרתון מוסיף אותם למסמך של היום
   (studioFunnel/<YYYY-MM-DD>, increment — בלי קריאה). בלי משתמש, בלי שמות קבצים, בלי קישורים.
   מרכז הניהול (op:'adminFnl') קורא את 14 הימים האחרונים ומקבל את הסיכום מ־fnlView. טהור — נבדק ב־node. */

/* הצעדים, לפי הסדר במסלול. צעד חדש = כאן + fnlAdd בטלפון (FNL_STEPS ב־studio.js — זהה) + מחרוזת admFnlS_<k> */
const FNL_STEPS = ['pick', 'link', 'est', 'quit', 'start', 'cut', 'sty', 'lyr'];
/* "למה ויתרת?" — התשובות הקבועות (FNL_WHY ב־studio.js — זהה) + מחרוזות studioWhy_<k> ו־admFnlW_<k> */
const FNL_WHY = ['exp', 'slow', 'test', 'later'];
const FNL_MAX = 50;   // לכל מונה בבקשה אחת — טלפון אחד לא מנפח את היום
const FNL_DAYS = 14;

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

/* גוף הבקשה → השדות להוספה ({ s_pick: 2, w_exp: 1 }), או null כשאין מה להוסיף / משהו לא מוכר */
function normFnl(b) {
  if (!b || typeof b !== 'object') return null;
  const out = {};
  for (const [grp, keys, pre] of [['s', FNL_STEPS, 's_'], ['w', FNL_WHY, 'w_']]) {
    const o = b[grp];
    if (o == null) continue;
    if (typeof o !== 'object' || Array.isArray(o)) return null;
    for (const [k, v] of Object.entries(o)) {
      if (!keys.includes(k)) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) return null;
      out[pre + k] = Math.min(n, FNL_MAX);
    }
  }
  return Object.keys(out).length ? out : null;
}

/* הכתיבה: commit אחד עם increment לכל שדה — בלי קריאה של המסמך */
function fnlWrite(docName, fields) {
  return { writes: [{ transform: { document: docName, fieldTransforms: Object.entries(fields).map(([fp, n]) => ({ fieldPath: fp, increment: { integerValue: String(n) } })) } }] };
}

/* המסמכים של הימים ({ id: 'YYYY-MM-DD', s_pick: 3, ... }) → הסיכום למרכז הניהול */
function fnlView(docs, now, days) {
  const D = days || FNL_DAYS, by = new Map((docs || []).filter((d) => d && d.id).map((d) => [d.id, d]));
  const list = [];
  for (let i = D - 1; i >= 0; i--) {
    const id = day(now - i * 86400000), d = by.get(id) || {};
    const s = {}, w = {};
    for (const k of FNL_STEPS) s[k] = Math.max(0, d['s_' + k] | 0);
    for (const k of FNL_WHY) w[k] = Math.max(0, d['w_' + k] | 0);
    list.push({ d: id, s, w });
  }
  const tot = { s: {}, w: {} };
  for (const k of FNL_STEPS) tot.s[k] = list.reduce((a, x) => a + x.s[k], 0);
  for (const k of FNL_WHY) tot.w[k] = list.reduce((a, x) => a + x.w[k], 0);
  const pct = (a, b) => (b > 0 ? Math.round(a / b * 100) : null);
  const why = FNL_WHY.map((k) => [k, tot.w[k]]).filter((x) => x[1] > 0).sort((a, b) => b[1] - a[1]);
  return { days: list, tot, est2start: pct(tot.s.start, tot.s.est), quit: pct(tot.s.quit, tot.s.est), whyN: why.reduce((a, x) => a + x[1], 0), why, n: FNL_STEPS.reduce((a, k) => a + tot.s[k], 0) };
}

module.exports = { FNL_STEPS, FNL_WHY, FNL_MAX, FNL_DAYS, normFnl, fnlWrite, fnlView, fnlDay: day };
