#!/usr/bin/env node
/* מאגר הלמידה → סשן של Claude Code (14/10/2026, בקשת המשתמש: "המטרה הראשית — לנתח יחד עם Claude").
   מושך בטוקן ניתוח (נוצר במרכז הניהול, קריאה בלבד) את הרשומות האנונימיות, וכותב לתיקייה:
     brief.md      — ההוראה ל־Claude, המדדים, המסקנות המדורגות ומילון השדות
     records.json  — כל הרשומות (רשומה לכל עבודה, בלי פרטים אישיים)
     view.json     — הניתוח המלא של לוח הבקרה
     checks.json   — התשובות של המנהל לבדיקות בטלפון (עובד / לא עובד + הערה)
     media/<מזהה>.a.mka — 22/10/2026: עם --media <מזהה,מזהה> (עד 4) — הקול של העבודות, מפוענח ב־ffmpeg (CENC). תוכן אמיתי:
                     לתיקייה זמנית בלבד, לעולם לא לריפו. --video — גם ה־240p
     corpus.json   — מ׳2: עם --corpus N — עד 20 פריטים מקורפוס הטקסט (כתוביות לכל שלב, זמני מילים). תוכן אמיתי:
                     לתיקייה זמנית בלבד, לעולם לא לריפו
     ids.json      — 02/11/2026 (PR1 1.3): עם --all — רשימת כל המזהים בקורפוס (id, q = בתור, m = חודש)
   כל הקורפוס (02/11/2026): --all — קריאה ראשונה עם cx (רשימת המזהים + הרשומות), ואחריה עמודים לפי מזהה (cl) עם co
   (בלי Firestore מעבר לטוקן), 11 שנ׳ בין עמודים ו־61 שנ׳ אחרי 429. --ids a,b / --ids-file f — רק המזהים האלה.
   --skip N — דילוג. --page N — גודל עמוד (עד 20; בכתובת של Vercel — 3). --since YYYY-MM — רק מהחודש הזה ואילך.
   הטוקן — רק ממשתנה סביבה או מהשורה, אף פעם לא בקובץ בריפו.
   שימוש:
     SNB_LEARN_TOKEN=snbL_… node tools/learn-pull.js [--out <תיקייה>] [--api <כתובת>] [--staging] [--corpus N | --all | --ids …]
*/
'use strict';
const fs = require('fs');
const path = require('path');

const API = { prod: ['https://api.thesnowball.app', 'https://ibkr-proxy-wine.vercel.app'], staging: ['https://api-staging.thesnowball.app'] };

const LID = /^[0-9a-f]{20}$/;
const PAGE = 20, PAGE_VERCEL = 3, GAP_MS = 11000, WAIT_429_MS = 61000;
function args(argv) {
  const o = { out: '', api: '', env: 'prod', token: process.env.SNB_LEARN_TOKEN || '', ci: 0, mi: [], mv: false, all: false, cl: [], idsFile: '', cs: 0, page: 0, since: '' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') o.out = argv[++i] || '';
    else if (a === '--api') o.api = argv[++i] || '';
    else if (a === '--staging') o.env = 'staging';
    else if (a === '--token') o.token = argv[++i] || '';
    else if (a === '--media') o.mi = String(argv[++i] || '').split(',').filter((x) => /^[0-9a-f]{20}$/.test(x)).slice(0, 4);
    else if (a === '--video') o.mv = true;
    else if (a === '--corpus') o.ci = Math.max(0, Math.min(20, parseInt(argv[++i], 10) || 0));
    else if (a === '--all') o.all = true;
    else if (a === '--ids') o.cl = String(argv[++i] || '').split(',').filter((x) => LID.test(x));
    else if (a === '--ids-file') o.idsFile = argv[++i] || '';
    else if (a === '--skip') o.cs = Math.max(0, parseInt(argv[++i], 10) || 0);
    else if (a === '--page') o.page = Math.max(1, Math.min(20, parseInt(argv[++i], 10) || 20));
    else if (a === '--since') o.since = /^\d{4}-\d{2}$/.test(argv[i + 1] || '') ? argv[++i] : '';
  }
  return o;
}

/* extra = { ci, cs, cl, cx, co, mi, mv } (או מספר = ci — הצורה הישנה, עם mi, mv אחריו) */
async function pull(base, token, fetchFn, extra, mi, mv) {
  const x = typeof extra === 'object' && extra ? extra : { ci: extra || 0, mi, mv };
  const body = { op: 'learnPull', at: token, ci: x.ci || 0 };
  if (x.cs) body.cs = x.cs;
  if (Array.isArray(x.cl) && x.cl.length) body.cl = x.cl;
  if (x.cx) body.cx = true;
  if (x.co) body.co = true;
  if (x.mi && x.mi.length) { body.mi = x.mi; body.mv = !!x.mv; }
  const r = await (fetchFn || fetch)(base.replace(/\/+$/, '') + '/api/studio', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  let j = null; try { j = await r.json(); } catch (e) {}
  if (!r.ok || !j || !j.ok) throw new Error((j && j.error) || ('http_' + r.status));
  return j;
}
const sleep0 = (ms) => new Promise((r) => setTimeout(r, ms));
/* כל הקורפוס: first = התשובה של הקריאה הראשונה (cx), ואז עמודים לפי מזהה. מחזיר { items, ids } — בלי כפילויות לפי id */
async function pullAll(base, token, fetchFn, o, first, sleep) {
  const zz = sleep || sleep0;
  const page = o.page || (/vercel\.app/.test(base) ? PAGE_VERCEL : PAGE);
  let ids = ((first.corpus && first.corpus.ids) || []).filter((x) => x && LID.test(String(x.id)));
  if (o.since) ids = ids.filter((x) => x.q || String(x.m || '') >= o.since);
  if (o.cl && o.cl.length) { const w = new Set(o.cl); ids = ids.filter((x) => w.has(x.id)); }
  ids = ids.slice(o.cs || 0);
  const got = new Map();
  for (const it of (first.corpus && first.corpus.items) || []) if (it && LID.test(String(it.id))) got.set(it.id, it);
  const need = ids.map((x) => x.id).filter((id) => !got.has(id));
  for (let i = 0; i < need.length;) {
    const cl = need.slice(i, i + page);
    let j;
    try { j = await pull(base, token, fetchFn, { cl, co: true, ci: cl.length }); } catch (e) {
      if (/rate_limited/.test(e.message)) { await zz(WAIT_429_MS); continue; }   // הבקשה שנדחתה נספרת גם היא — מחכים דקה שלמה
      throw e;
    }
    for (const it of (j.corpus && j.corpus.items) || []) if (it && LID.test(String(it.id))) got.set(it.id, it);
    i += page;
    if (i < need.length) await zz(GAP_MS);
  }
  const want = new Set(ids.map((x) => x.id));
  return { items: [...got.values()].filter((it) => want.has(it.id)), ids };
}

async function main() {
  const o = args(process.argv.slice(2));
  if (!/^snbL_[A-Za-z0-9_-]{32}$/.test(o.token)) {
    console.error('חסר טוקן ניתוח: SNB_LEARN_TOKEN=snbL_… (יוצרים אותו במרכז הניהול ← "לנתח עם Claude")');
    process.exit(2);
  }
  if (o.idsFile) { try { o.cl = o.cl.concat(String(fs.readFileSync(o.idsFile, 'utf8')).split(/[\s,]+/).filter((x) => LID.test(x))); } catch (e) { console.error('אין קובץ מזהים: ' + o.idsFile); process.exit(2); } }
  const many = o.all || o.cl.length > 0;
  const bases = o.api ? [o.api] : API[o.env];
  let j = null, last = null, base = '';
  for (const b of bases) {
    try { j = await pull(b, o.token, null, many ? { cx: true, ci: 0, mi: o.mi, mv: o.mv } : { ci: o.ci, cs: o.cs, mi: o.mi, mv: o.mv }); } catch (e) { last = e; if (/bad_token|rate_limited/.test(e.message)) break; continue; }
    // 24/10/2026: השרת המאוחד הוקם בלי R2L_* — שם הקורפוס "לא מוגדר"; כשביקשו קורפוס/קול — הכתובת הבאה (כמו dev-pull)
    if ((o.ci || o.mi.length || many) && !(j.corpus && j.corpus.on) && b !== bases[bases.length - 1]) continue;
    base = b;
    break;
  }
  if (!j) { console.error('המשיכה נכשלה: ' + (last && last.message)); process.exit(1); }
  if (many && j.corpus && j.corpus.on) {
    const r = await pullAll(base, o.token, null, o, j);
    j.corpus = Object.assign({}, j.corpus, { items: r.items, ids: r.ids });
  }
  const out = o.out || path.join(process.env.TMPDIR || '/tmp', 'snb-learn-' + new Date(j.at).toISOString().slice(0, 10));
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'brief.md'), j.brief || '');
  fs.writeFileSync(path.join(out, 'records.json'), JSON.stringify(j.records || [], null, 1));
  fs.writeFileSync(path.join(out, 'view.json'), JSON.stringify(j.view || {}, null, 1));
  fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(j.checks || [], null, 1));
  const cp = j.corpus || {};
  if (cp.items) fs.writeFileSync(path.join(out, 'corpus.json'), JSON.stringify(cp.items));
  if (cp.ids) fs.writeFileSync(path.join(out, 'ids.json'), JSON.stringify(cp.ids));
  // הקול: ffmpeg קורא ישירות מהקישור החתום ומפענח (המפתח רק בזיכרון — לא נכתב לקובץ). שם הקובץ — רק ממזהה תקין
  for (const [lid, m] of Object.entries(j.media || {})) {
    if (!/^[0-9a-f]{20}$/.test(lid)) continue;
    for (const k of ['a', 'v']) {
      const x = m && m[k];
      if (!x || !/^https:\/\//.test(String(x.url)) || !/^[0-9a-f]{32}$/.test(String(x.key))) continue;
      const dir = path.join(out, 'media'); fs.mkdirSync(dir, { recursive: true });
      const dec = path.join(dir, lid + '.' + k + (k === 'a' ? '.mka' : '.mp4'));
      const p = require('child_process').spawnSync('ffmpeg', ['-v', 'error', '-y', '-decryption_key', x.key, '-i', x.url, '-c', 'copy', dec]);
      console.log(p.status === 0 ? 'נשמר: ' + dec : 'ההורדה/הפענוח נכשלו: ' + lid + '.' + k);
    }
  }
  const v = j.view || {};
  console.log('נמשכו ' + (j.records || []).length + ' רשומות · מסקנות: ' + ((v.ins || []).length) + ' · בדיקות בטלפון: ' + (j.checks || []).filter((c) => c.st === 'no').length + ' לא עובדות · קורפוס: ' + (cp.on ? (cp.n || 0) + ' פריטים (' + (cp.q || 0) + ' בתור)' : 'לא מוגדר') + ' · נשמר ב: ' + out);
  console.log('לקרוא קודם: ' + path.join(out, 'brief.md'));
}

if (require.main === module) main();
module.exports = { args, pull, pullAll, API, PAGE, PAGE_VERCEL, WAIT_429_MS };
