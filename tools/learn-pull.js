#!/usr/bin/env node
/* מאגר הלמידה → סשן של Claude Code (14/10/2026, בקשת המשתמש: "המטרה הראשית — לנתח יחד עם Claude").
   מושך בטוקן ניתוח (נוצר במרכז הניהול, קריאה בלבד) את הרשומות האנונימיות, וכותב לתיקייה:
     brief.md      — ההוראה ל־Claude, המדדים, המסקנות המדורגות ומילון השדות
     records.json  — כל הרשומות (רשומה לכל עבודה, בלי פרטים אישיים)
     view.json     — הניתוח המלא של לוח הבקרה
     checks.json   — התשובות של המנהל לבדיקות בטלפון (עובד / לא עובד + הערה)
     corpus.json   — מ׳2: עם --corpus N — עד 20 פריטים מקורפוס הטקסט (כתוביות לכל שלב, זמני מילים). תוכן אמיתי:
                     לתיקייה זמנית בלבד, לעולם לא לריפו
   הטוקן — רק ממשתנה סביבה או מהשורה, אף פעם לא בקובץ בריפו.
   שימוש:
     SNB_LEARN_TOKEN=snbL_… node tools/learn-pull.js [--out <תיקייה>] [--api <כתובת>] [--staging] [--corpus N]
*/
'use strict';
const fs = require('fs');
const path = require('path');

const API = { prod: ['https://api.thesnowball.app', 'https://ibkr-proxy-wine.vercel.app'], staging: ['https://api-staging.thesnowball.app'] };

function args(argv) {
  const o = { out: '', api: '', env: 'prod', token: process.env.SNB_LEARN_TOKEN || '', ci: 0 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i] || '';
    else if (a === '--api') o.api = argv[++i] || '';
    else if (a === '--staging') o.env = 'staging';
    else if (a === '--token') o.token = argv[++i] || '';
    else if (a === '--corpus') o.ci = Math.max(0, Math.min(20, parseInt(argv[++i], 10) || 0));
  }
  return o;
}

async function pull(base, token, fetchFn, ci) {
  const r = await (fetchFn || fetch)(base.replace(/\/+$/, '') + '/api/studio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ op: 'learnPull', at: token, ci: ci || 0 }),
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || ('http_' + r.status));
  return j;
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
    try { j = await pull(b, o.token, null, o.ci); break; } catch (e) { last = e; if (/bad_token|rate_limited/.test(e.message)) break; }
  }
  if (!j) { console.error('המשיכה נכשלה: ' + (last && last.message)); process.exit(1); }
  const out = o.out || path.join(process.env.TMPDIR || '/tmp', 'snb-learn-' + new Date(j.at).toISOString().slice(0, 10));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'brief.md'), j.brief || '');
  fs.writeFileSync(path.join(out, 'records.json'), JSON.stringify(j.records || [], null, 1));
  fs.writeFileSync(path.join(out, 'view.json'), JSON.stringify(j.view || {}, null, 1));
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(j.checks || [], null, 1));
  const cp = j.corpus || {};
  if (cp.items) fs.writeFileSync(path.join(out, 'corpus.json'), JSON.stringify(cp.items));
  const v = j.view || {};
  console.log('נמשכו ' + (j.records || []).length + ' רשומות · מסקנות: ' + ((v.ins || []).length) + ' · בדיקות בטלפון: ' + (j.checks || []).filter((c) => c.st === 'no').length + ' לא עובדות · קורפוס: ' + (cp.on ? (cp.n || 0) + ' פריטים (' + (cp.q || 0) + ' בתור)' : 'לא מוגדר') + ' · נשמר ב: ' + out);
  console.log('לקרוא קודם: ' + path.join(out, 'brief.md'));
}

if (require.main === module) main();
module.exports = { args, pull, API };
