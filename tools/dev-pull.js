#!/usr/bin/env node
/* האיסוף המלא בתקופת הפיתוח → סשן של Claude Code (15/10/2026, בקשת המשתמש: "לאבחן בלי צילומי מסך").
   מושך בטוקן הניתוח (אותו טוקן של learn-pull.js — נוצר במרכז הניהול, קריאה בלבד) את מה שנאסף בימים האחרונים:
     jobs.json     — לכל עבודה: סוף הלוג, ה־traceback, מצב התהליכים כשנתקעה, יומן הקריאות ל־Claude
     calls.json    — יומן הקריאות מכל העבודות, שורה לקריאה (זמן, משך, שלב, stop_reason, ניסיון, request id, טוקנים, עלות)
     metrics.json  — מדדי השרת לדקה (מעבד, זיכרון, דיסק, עומס, העבודה והשלב)
     errors.json   — שגיאות JavaScript מהטלפון (Academy, Studio)
     summary.md    — סיכום קצר: מה לקרוא קודם
   תוכן אמיתי (שמות קבצים, משפטים מהעבודה) — לתיקייה זמנית בלבד, לעולם לא לריפו. הטוקן — רק ממשתנה סביבה או מהשורה.
   שימוש:
     SNB_LEARN_TOKEN=snbL_… node tools/dev-pull.js [--days 2] [--job j…] [--kinds j,m,e] [--out <תיקייה>] [--staging] [--api <כתובת>]
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { API } = require('./learn-pull');

function args(argv) {
  const o = { out: '', api: '', env: 'prod', token: process.env.SNB_LEARN_TOKEN || '', days: 2, job: '', kinds: ['j', 'm', 'e'] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i] || '';
    else if (a === '--api') o.api = argv[++i] || '';
    else if (a === '--staging') o.env = 'staging';
    else if (a === '--token') o.token = argv[++i] || '';
    else if (a === '--days') o.days = Math.max(1, Math.min(14, parseInt(argv[++i], 10) || 2));
    else if (a === '--job') o.job = argv[++i] || '';
    else if (a === '--kinds') o.kinds = String(argv[++i] || '').split(',').filter((k) => ['j', 'm', 'e'].includes(k));
  }
  return o;
}

async function pull(base, o, fetchFn) {
  const r = await (fetchFn || fetch)(base.replace(/\/+$/, '') + '/api/studio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'devPull', at: o.token, days: o.days, job: o.job || undefined, kinds: o.kinds }),
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || ('http_' + r.status));
  return j;
}

/* הפריטים → הקבצים (טהור — נבדק ב־tests/devlog.test.js) */
function split(items) {
  const jobs = [], calls = [], metrics = [], errors = [];
  for (const x of items || []) {
    if (x.k === 'j') {
      jobs.push(x);
      for (const c of x.calls || []) calls.push(Object.assign({ job: x.job }, c));
    } else if (x.k === 'm') for (const s of x.smp || []) metrics.push(Object.assign({ sid: x.sid }, s));
    else if (x.k === 'e') for (const e of x.errs || []) errors.push(Object.assign({ app: x.app, ver: x.ver }, e));
  }
  calls.sort((a, b) => (a.t || 0) - (b.t || 0));
  metrics.sort((a, b) => (a.t || 0) - (b.t || 0));
  errors.sort((a, b) => (a.at || 0) - (b.at || 0));
  return { jobs, calls, metrics, errors };
}
function summary(j, s) {
  const L = ['# האיסוף המלא — ' + new Date(j.at).toISOString().slice(0, 16).replace('T', ' ') + ' UTC', ''];
  L.push('הדגל learn_full: ' + (j.on ? 'דולק' : 'כבוי') + (j.r2 ? '' : ' · הדלי של מאגר הלמידה לא מוגדר'));
  L.push('עבודות: ' + s.jobs.length + ' · קריאות ל־Claude: ' + s.calls.length + ' · דגימות מדדים: ' + s.metrics.length + ' · שגיאות מהטלפון: ' + s.errors.length, '');
  const bad = s.jobs.filter((x) => x.t === 'stuck' || x.tb || (x.rc != null && x.rc !== 0));
  if (bad.length) {
    L.push('## לקרוא קודם — עבודות שנכשלו / נתקעו');
    for (const x of bad.slice(0, 20)) L.push('- ' + x.job + ' · ' + x.t + ' · rc ' + x.rc + ' · שלב ' + (x.st || '?') + (x.tb ? ' · יש traceback' : '') + (x.stack ? ' · יש מצב חוטים' : ''));
    L.push('');
  }
  const failed = s.calls.filter((c) => c.err || c.sr === 'max_tokens' || c.sr === 'refusal' || c.a > 0);
  if (failed.length) {
    L.push('## קריאות ל־Claude שנכשלו / נקטעו / נוסו שוב (' + failed.length + ')');
    for (const c of failed.slice(-20)) L.push('- ' + new Date(c.t * 1000).toISOString().slice(0, 19) + ' · ' + c.job + ' · ' + (c.k || '?') + ' · ' + (c.err || c.sr) + ' · ניסיון ' + (c.a || 0) + (c.rid ? ' · ' + c.rid : ''));
    L.push('');
  }
  const hot = s.metrics.filter((m) => m.mem > 90 || m.disk > 90);
  if (hot.length) L.push('## לחץ משאבים: ' + hot.length + ' דקות עם זיכרון / דיסק מעל 90%', '');
  if (s.errors.length) {
    L.push('## שגיאות מהטלפון');
    for (const e of s.errors.slice(-20)) L.push('- ' + e.app + ' ' + (e.ver || '') + ' · ' + (e.msg || '').slice(0, 160) + (e.n > 1 ? ' ×' + e.n : ''));
    L.push('');
  }
  L.push('הקבצים: jobs.json (לוג, traceback, תהליכים, קריאות) · calls.json · metrics.json · errors.json');
  return L.join('\n') + '\n';
}

async function main() {
  const o = args(process.argv.slice(2));
  if (!/^snbL_[A-Za-z0-9_-]{32}$/.test(o.token)) {
    console.error('חסר טוקן ניתוח: SNB_LEARN_TOKEN=snbL_… (יוצרים אותו במרכז הניהול ← "לנתח עם Claude")');
    process.exit(2);
  }
  const bases = o.api ? [o.api] : API[o.env];
  let j = null, last = null;
  for (const b of bases) {
    try { j = await pull(b, o); break; } catch (e) { last = e; if (/bad_token|rate_limited/.test(e.message)) break; }
  }
  if (!j) { console.error('המשיכה נכשלה: ' + (last && last.message)); process.exit(1); }
  const out = o.out || path.join(process.env.TMPDIR || '/tmp', 'snb-dev-' + new Date(j.at).toISOString().slice(0, 16).replace(/[:T]/g, '-'));
  fs.mkdirSync(out, { recursive: true });
  const s = split(j.items);
  fs.writeFileSync(path.join(out, 'jobs.json'), JSON.stringify(s.jobs, null, 1));
  fs.writeFileSync(path.join(out, 'calls.json'), JSON.stringify(s.calls, null, 1));
  fs.writeFileSync(path.join(out, 'metrics.json'), JSON.stringify(s.metrics));
  fs.writeFileSync(path.join(out, 'errors.json'), JSON.stringify(s.errors, null, 1));
  fs.writeFileSync(path.join(out, 'summary.md'), summary(j, s));
  console.log('נמשכו ' + (j.items || []).length + ' פריטים · עבודות ' + s.jobs.length + ' · קריאות ' + s.calls.length + ' · מדדים ' + s.metrics.length + ' · שגיאות ' + s.errors.length + ' · הדגל ' + (j.on ? 'דולק' : 'כבוי') + ' · נשמר ב: ' + out);
  console.log('לקרוא קודם: ' + path.join(out, 'summary.md'));
}

if (require.main === module) main();
module.exports = { args, pull, split, summary };
