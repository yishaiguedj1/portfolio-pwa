#!/usr/bin/env node
/* יומני ההורדות של Studio DM → סשן של Claude Code (24/10/2026, בקשת המשתמש: מאגר שמזין את Claude, שלב ג׳).
   מושך בטוקן הניתוח (אותו טוקן של learn-pull.js / dev-pull.js — נוצר במרכז הניהול, קריאה בלבד):
     events.json — כל האירועים (התחלה / הסתיימה / נכשלה / נעצרה), עם u = hash של המשתמש (בלי uid ובלי מייל) ופרטי המכשיר
     fails.md    — הכשלים מהחדש לישן: קוד, אתר, שם הקובץ, החריגה, ההודעה ושורות ה־ERROR של yt-dlp
     summary.md  — סיכום: כמה הורדות, אחוז הצלחה, הקודים הנפוצים, אתרים, מהירות חציונית — מה לתקן קודם
   שמות קבצים ואתרים אמיתיים — לתיקייה זמנית בלבד, לעולם לא לריפו. הטוקן — רק ממשתנה סביבה או מהשורה.
   שימוש:
     SNB_LEARN_TOKEN=snbL_… node tools/dm-pull.js [--days 7] [--out <תיקייה>] [--api <כתובת>]
*/
'use strict';
const fs = require('fs');
const path = require('path');
const { API } = require('./learn-pull');
const { dmStats } = require('../ibkr-proxy/lib/dmlog');

function args(argv) {
  const o = { out: '', api: '', token: process.env.SNB_LEARN_TOKEN || '', days: 7 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i] || '';
    else if (a === '--api') o.api = argv[++i] || '';
    else if (a === '--token') o.token = argv[++i] || '';
    else if (a === '--days') o.days = Math.max(1, Math.min(31, parseInt(argv[++i], 10) || 7));
  }
  return o;
}

async function pull(base, o, before, fetchFn) {
  const r = await (fetchFn || fetch)(base.replace(/\/+$/, '') + '/api/studio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ op: 'dmPull', at: o.token, days: o.days, before: before || undefined }),
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (r.status === 421) return { ok: true, r2: false, items: [] };
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || ('http_' + r.status));
  return j;
}

/* עד שאין next (כל בקשה בתקציב הזמן של הפונקציה) */
async function pullAll(base, o, fetchFn) {
  const items = [];
  let before = '', r2 = true;
  for (let n = 0; n < 50; n++) {
    const j = await pull(base, o, before, fetchFn);
    if (!j.r2) { r2 = false; break; }
    items.push(...(j.items || []));
    if (!j.next || j.next === before) break;
    before = j.next;
  }
  return { r2, items };
}

const ts = (t) => new Date(t).toISOString().replace('T', ' ').slice(0, 19);
const mb = (b) => (b > 0 ? (b / 1048576).toFixed(1) + 'MB' : '?');

function summaryMd(items, days) {
  const s = dmStats(items);
  const L = ['# Studio DM — יומני ההורדות (' + days + ' ימים אחרונים)', ''];
  if (!s.n) return L.concat('אין אירועים. (השליחה דלוקה רק אחרי כניסה עם Google ב־DM.)').join('\n') + '\n';
  L.push(s.n + ' אירועים · ' + s.users + ' משתמשים · הצלחה ' + (s.ok == null ? '—' : s.ok + '%') +
    ' · הסתיימו ' + (s.k.done || 0) + ' · נכשלו ' + (s.k.fail || 0) + ' · נעצרו ' + (s.k.stop || 0) +
    (s.bps50 ? ' · מהירות חציונית ' + mb(s.bps50) + '/s' : ''), '');
  if (s.codes.length) { L.push('## קודי כשל', ''); s.codes.forEach(([c, n]) => L.push('- `' + c + '` × ' + n)); L.push(''); }
  if (s.doms.length) { L.push('## אתרים', ''); s.doms.forEach(([d, v]) => L.push('- ' + d + ': הסתיימו ' + (v.done || 0) + ', נכשלו ' + (v.fail || 0) + ', נעצרו ' + (v.stop || 0))); L.push(''); }
  L.push('קרא קודם את fails.md — כל כשל עם החריגה ושורות ה־ERROR.');
  return L.join('\n') + '\n';
}

function failsMd(items) {
  const L = ['# כשלים — מהחדש לישן', ''];
  const ev = [];
  for (const it of items) for (const e of it.ev || []) if (e.k === 'fail') ev.push(Object.assign({ u: it.u, dev: it.dev }, e));
  ev.sort((a, b) => b.t - a.t);
  for (const e of ev) {
    L.push('## ' + ts(e.t) + ' · `' + (e.code || '?') + '` · ' + (e.kind || '') + ' · ' + (e.dom || '?'));
    L.push('- קובץ: ' + (e.name || '—') + ' · ' + mb(e.got) + ' מתוך ' + mb(e.size) + ' · ' + (e.ms ? Math.round(e.ms / 1000) + ' שנ׳' : '') +
      (e.conns ? ' · ' + e.conns + ' חיבורים' : '') + (e.tries ? ' · ניסיון ' + e.tries : ''));
    if (e.dev) L.push('- מכשיר: ' + [e.dev.model, e.dev.sdk && 'SDK ' + e.dev.sdk, e.dev.v && 'DM ' + e.dev.v].filter(Boolean).join(' · ') + ' · משתמש ' + e.u);
    if (e.ex || e.msg) L.push('- ' + [e.ex, e.msg].filter(Boolean).join(': '));
    if (e.tail && e.tail.length) L.push('```', ...e.tail, '```');
    L.push('');
  }
  if (!ev.length) L.push('אין כשלים.');
  return L.join('\n') + '\n';
}

async function main() {
  const o = args(process.argv.slice(2));
  if (!/^snbL_[A-Za-z0-9_-]{32}$/.test(o.token)) { console.error('צריך טוקן ניתוח: SNB_LEARN_TOKEN=snbL_… (מרכז הניהול ← מאגר הלמידה)'); process.exit(2); }
  const bases = o.api ? [o.api] : API.prod;
  let got = null, last = null;
  for (const b of bases) {
    try {
      got = await pullAll(b, o);
      if (!got.r2 && b !== bases[bases.length - 1]) { got = null; continue; }   // שרת בלי מפתחות הדלי — הכתובת הבאה
      break;
    } catch (e) { last = e; }
  }
  if (!got) { console.error('המשיכה נכשלה: ' + (last ? last.message : 'r2')); process.exit(1); }
  const out = o.out || fs.mkdtempSync(path.join(require('os').tmpdir(), 'dm-pull-'));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(got.items, null, 1));
  fs.writeFileSync(path.join(out, 'fails.md'), failsMd(got.items));
  fs.writeFileSync(path.join(out, 'summary.md'), summaryMd(got.items, o.days));
  console.log(summaryMd(got.items, o.days));
  console.log('נשמר ב־' + out);
}

module.exports = { args, pullAll, summaryMd, failsMd };
if (require.main === module) main();
