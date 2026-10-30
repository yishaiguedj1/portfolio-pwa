'use strict';
/* 29/10/2026 (בקשת המשתמש): ניטור משתמשים במרכז הניהול — מי עובד עכשיו ואיפה העבודה שלו עומדת, כמה כל משתמש תרגם
   ועלה לנו (דולרים וטוקנים), טיימליין של כל הפעולות, התראה למנהל בווילון כשמשתמש אחר מתרגם, תקרה חודשית והשהיה
   לכל משתמש, וסיכום יומי. טהור — בלי Firestore; השרתון (api/studio.js) קורא ושומר.
   פרטיות: השם והמייל נשמרים רק ב־studioStats/{uid} (פרטי, שרת בלבד) ויוצאים רק למנהל (isAdmin). שם הקובץ של הסרטון לא יוצא */
const S = require('./studio');
const SLA = require('./studiosla');

const NM_MAX = 40;
const EM_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}$/;
const UID_RE = /^[A-Za-z0-9_-]{6,128}$/;
const CAP_MIN = 1, CAP_MAX = 10000;           // תקרה חודשית לכל משתמש, בדולרים שלמים (mc ב־studioStats)
/* 29/10/2026 (בקשת המשתמש): ברירת המחדל לכל משתמש — $20 לחודש ("תגביל ל־20 דולר כל משתמש כרגע"); המנהל משנה במרכז
   הניהול (sysCfg.ucap, או תקרה אישית). בנוסף — התראה למנהל בכל פעם שמשתמש חוצה סכום עגול החודש (SPEND_STEPS) */
const CAP_DEF = 20;
/* המנהל (studioStats.ad = 1, נרשם בכל כניסה לפי isAdmin) — בלי תקרה חודשית של המערכת; רק המגבלה בחשבון Claude
   (בקשת המשתמש: "שהמערכת שלנו לא תגביל למשתמש שלי") */
const ADMIN_CAP = 1e6;
const isAdm = (st) => !!(st && st.ad === 1);
const monthCap = (st, def) => (isAdm(st) ? ADMIN_CAP : capOf(st, def));
const SPEND_STEPS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
const CAP_WARN = 0.8;                         // התראה למנהל כשמשתמש עובר 80% מהתקרה שלו
const TL_DAYS = 30, TL_MAX = 300;             // הטיימליין: 30 יום (= jobs30), עד 300 אירועים
const DAILY_H = 21;                           // הסיכום היומי — 21:00 שעון ישראל
const KINDS = ['watch', 'watch_end', 'watch_clear', 'cap80', 'daily', 'spend'];

/* השם והמייל מהטוקן — שם נקי (בלי תווי בקרה וסוגריים זוויתיים), מייל רק בצורה תקינה */
function idOf(user) {
  const nm = String((user && user.name) || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, NM_MAX);
  const em = String((user && user.email) || '').trim().toLowerCase();
  return { nm, em: EM_RE.test(em) ? em : '' };
}
/* שם לתצוגה: השם, ואם אין — החלק שלפני @ */
const label = (nm, em) => String(nm || '').trim() || String(em || '').split('@')[0] || '?';

const n0 = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
const tokOf = (use) => (Array.isArray(use) ? use : []).reduce((s, r) => s + (r ? n0(r.i) + n0(r.o) + n0(r.cr) + n0(r.c5) + n0(r.c1) : 0), 0);
/* use כבר כולל את use0 (הדיווח ממזג אותם — mergeUse); בין "המשך" לדיווח הבא — רק use0 */
const jobUse = (job) => (Array.isArray(job && job.use) && job.use.length ? job.use : Array.isArray(job && job.use0) ? job.use0 : []);
/* עלות לנו = מנוע ה־API שלנו (לא Routine / המנוי של המשתמש, לא העתק־הדבק) */
const ours = (job) => !!(job && job.spec && job.spec.eng === 'api' && job.spec.ry !== 1 && job.spec.cp !== 1);

/* התקרה החודשית של משתמש: mc (דולרים שלמים) או ברירת המחדל של המערכת */
function capOf(st, def) {
  const c = Number(st && st.mc);
  return Number.isInteger(c) && c >= CAP_MIN && c <= CAP_MAX ? c : def;
}
function normCap(v) {
  if (v === null || v === 0 || v === '') return 0;              // 0 = חזרה לברירת המחדל
  const c = Math.round(Number(v));
  return Number.isFinite(c) && c >= CAP_MIN && c <= CAP_MAX ? c : -1;
}
const paused = (st) => !!(st && st.ps === 1);

/* סכומים מצטברים (tt ב־studioStats) — מאז ומעולם. d = {usd, tok, n, sec, ok} */
function addTotal(tt, d) {
  const o = Object.assign({ usd: 0, tok: 0, n: 0, sec: 0, ok: 0 }, tt && typeof tt === 'object' ? tt : {});
  for (const k of ['usd', 'tok', 'n', 'sec', 'ok']) o[k] = Math.max(0, Number(o[k]) || 0) + Math.max(0, Number(d && d[k]) || 0);
  o.usd = Math.round(o.usd * 1e4) / 1e4;
  o.tok = Math.round(o.tok); o.n = Math.round(o.n); o.sec = Math.round(o.sec); o.ok = Math.round(o.ok);
  return o;
}
/* מילוי ראשון (פעם אחת לכל משתמש) מהעבודות שכבר הסתיימו */
function backfill(jobs) {
  let tt = { bf: 1 };
  for (const j of jobs || []) {
    if (!j || j.kind !== 'tr' || !['done', 'failed', 'cancelled'].includes(j.state)) continue;
    const use = jobUse(j);
    const ok = j.state === 'done' ? 1 : 0;   // n = תרגומים שהסתיימו (כמו totalAdd בסוף עבודה); הזמן והעלות — גם של מה שנעצר
    tt = Object.assign(addTotal(tt, { n: ok, ok, sec: ok ? n0(j.spec && j.spec.dur) : 0,
      usd: ours(j) ? S.usdOf(use) : 0, tok: ours(j) ? tokOf(use) : 0 }), { bf: 1 });
  }
  return tt;
}

/* עבודה שרצה עכשיו — שורה למסך "עכשיו" ולהתראה. st = studioStats של הבעלים (השם) */
function liveRow(job, st, now) {
  if (!job || !job.id) return null;
  const prog = job.prog || {}, use = jobUse(job);
  const frac = SLA.progFrac(job);
  const usd = Math.max(n0(job.tw && job.tw.usd), S.usdOf(use));
  const t0 = n0(job.c0) || n0(job.created);
  const el = t0 ? Math.max(0, now - t0 - n0(job.pz)) : 0;
  // 30/10/2026: אותו צפי שהמשתמש רואה (studiosla fc — לפי השלבים והסוכנים שנשארו), לא הקצנה קווית של עלות/התקדמות
  const sv = SLA.slaView(job, now), fc = sv && sv.fc;
  const left = fc ? Math.max(0, Math.round(fc.t - sv.t.el)) : frac >= 0.05 && frac < 1 && el ? Math.round(el * (1 - frac) / frac / 1000) : 0;
  const exp = fc && fc.u != null ? fc.u : frac >= 0.15 ? Math.round(usd / frac * 100) / 100 : n0(job.tg && job.tg.u);
  const sp = job.spec || {};
  const wait = job.qa && job.qa.at && !job.qa.a ? 'q' : job.wv0 ? 'v' : '';
  return { j: job.id, u: job.uid, nm: label(st && st.nm, st && st.em), em: (st && st.em) || '', k: job.kind, state: job.state,
    st: prog.st || '', sp: Math.round(Math.max(0, Math.min(1, n0(prog.p))) * 1000) / 1000, p: Math.round(frac * 1000) / 1000,
    usd: Math.round(usd * 100) / 100, tok: tokOf(use), exp: Math.round(Math.max(exp, usd) * 100) / 100, left, t0, dur: n0(sp.dur),
    mode: String(sp.mode || ''), to: Array.isArray(sp.to) ? sp.to.join(',') : String(sp.to || ''), our: ours(job), wait,
    // 30/10/2026 (המשתמש: "מוציאים את הקול — עוד לא", כשהשאר הסתיימו): ההעלאה קורית בטלפון, לפני שהעבודה בתור — לא נרשמת בשרתון
    stg: Object.assign(Object.fromEntries(Object.entries(prog.stg || {}).filter(([k]) => S.STAGES.includes(k)).map(([k, v]) => [k, v && v.e ? 'd' : v && v.s ? 'n' : ''])), { up: 'd' }),
    by: byAgent(use) };
}
/* העלות והטוקנים לפי סוכן (main/tl/rv/jg/sub) — לכרטיס העבודה החיה */
function byAgent(use) {
  const o = {};
  for (const r of use || []) {
    if (!r || !r.k) continue;
    const a = o[r.k] || (o[r.k] = { usd: 0, tok: 0, m: '' });
    a.usd = Math.round((a.usd + n0(r.usd)) * 100) / 100; a.tok += tokOf([r]); a.m = a.m || String(r.m || '');
  }
  return o;
}
const isLive = (j) => !!j && ['queued', 'running'].includes(j.state) && j.kind !== 'ping' && !j.rdy;

/* משתמשים: שורה לכל מי שיש לו studioStats או עבודה ב־30 יום. stats = [{id, nm, em, ls, fs, mu, mc, ps, tt}] */
function usersView(stats, jobs, now, opt) {
  const o = opt || {}, def = o.cap || 30, me = o.me || '';
  const by = new Map();
  const get = (u) => by.get(u) || (by.set(u, { u, nm: '', em: '', ls: 0, fs: 0, mo: 0, cap: def, ps: false, tt: null,
    d30: { n: 0, ok: 0, f: 0, sec: 0, usd: 0, tok: 0 }, live: false, me: u === me }), by.get(u));
  for (const st of stats || []) {
    if (!st || !UID_RE.test(String(st.id || ''))) continue;
    const r = get(st.id);
    r.nm = String(st.nm || ''); r.em = String(st.em || ''); r.ls = n0(st.ls); r.fs = n0(st.fs);
    r.mo = Math.round(S.monthUsed(st.mu, now) * 100) / 100; r.cap = capOf(st, def); r.ps = paused(st);
    r.mc = capOf(st, 0) || 0; r.ad = isAdm(st);
    if (st.tt && typeof st.tt === 'object') r.tt = addTotal(st.tt, {});
  }
  const from = now - TL_DAYS * 86400000;
  for (const j of jobs || []) {
    if (!j || !UID_RE.test(String(j.uid || '')) || j.kind === 'ping') continue;
    const r = get(j.uid);
    r.ls = Math.max(r.ls, n0(j.updated));
    if (isLive(j)) r.live = true;
    if (j.kind !== 'tr' || n0(j.created) < from) continue;
    const use = jobUse(j), d = r.d30;
    d.n++; if (j.state === 'done') d.ok++; if (j.state === 'failed') d.f++;
    d.sec += n0(j.spec && j.spec.dur);
    if (ours(j)) { d.usd = Math.round((d.usd + S.usdOf(use)) * 100) / 100; d.tok += tokOf(use); }
  }
  const rows = [...by.values()].filter((r) => r.nm || r.em || r.d30.n || r.tt);
  for (const r of rows) {
    r.name = label(r.nm, r.em);
    // מאז ומעולם: הסכום המצטבר, ולא פחות ממה שרואים ב־30 הימים (לפני המילוי הראשון)
    const t = r.tt || {};
    r.all = { n: Math.max(n0(t.n), r.d30.n), sec: Math.max(n0(t.sec), r.d30.sec), usd: Math.round(Math.max(n0(t.usd), r.d30.usd) * 100) / 100,
      tok: Math.max(n0(t.tok), r.d30.tok), ok: Math.max(n0(t.ok), r.d30.ok) };
    delete r.tt;
  }
  rows.sort((a, b) => (b.live - a.live) || (b.mo - a.mo) || (b.d30.usd - a.d30.usd) || (b.ls - a.ls));
  const sum = rows.reduce((a, r) => ({ mo: a.mo + r.mo, usd30: a.usd30 + r.d30.usd, tok30: a.tok30 + r.d30.tok, n30: a.n30 + r.d30.n }), { mo: 0, usd30: 0, tok30: 0, n30: 0 });
  sum.mo = Math.round(sum.mo * 100) / 100; sum.usd30 = Math.round(sum.usd30 * 100) / 100;
  const act = (ms) => rows.filter((r) => r.ls && now - r.ls < ms).length;
  return { rows, sum, active: { d1: act(86400000), d7: act(7 * 86400000), d30: act(30 * 86400000) }, n: rows.length,
    nw: rows.filter((r) => r.fs && now - r.fs < 7 * 86400000).length };
}

/* הטיימליין: עבודות (התחלה / סוף / נעצרה), פעולות המנהל (sysLog) ומשתמשים חדשים — החדש למעלה */
function timeline(jobs, logs, stats, now) {
  const from = now - TL_DAYS * 86400000, ev = [];
  const byEm = new Map();
  for (const st of stats || []) if (st && st.em) byEm.set(String(st.em), st.id);
  for (const j of jobs || []) {
    if (!j || j.kind === 'ping' || !UID_RE.test(String(j.uid || ''))) continue;
    const sp = j.spec || {}, use = jobUse(j);
    const base = { u: j.uid, j: j.id, k: j.kind, dur: n0(sp.dur), mode: String(sp.mode || '') };
    if (n0(j.created) >= from) ev.push(Object.assign({ t: 'js', at: j.created, live: isLive(j) }, base,
      isLive(j) ? { usd: Math.round(Math.max(n0(j.tw && j.tw.usd), S.usdOf(use)) * 100) / 100 } : {}));
    const end = n0(j.ended) || n0(j.updated);
    if (['done', 'failed', 'cancelled'].includes(j.state) && end >= from) {
      ev.push(Object.assign({ t: j.state === 'done' ? 'jd' : j.state === 'failed' ? 'jf' : 'jc', at: end }, base, {
        usd: ours(j) ? S.usdOf(use) : 0, tok: ours(j) ? tokOf(use) : 0, our: ours(j),
        min: n0(j.created) ? Math.max(0, Math.round((end - j.created) / 60000)) : 0,
        q: j.q && typeof j.q.s === 'number' ? Math.round(j.q.s) : null,
        err: j.state === 'failed' ? String(j.err || '').slice(0, 30) : '' }));
    }
  }
  for (const l of logs || []) {
    if (!l || !(n0(l.at) >= from) || !l.k) continue;
    ev.push({ t: 'ad', at: l.at, k: String(l.k), d: String(l.d || '').slice(0, 120), w: String(l.w || ''), u: byEm.get(String(l.w || '')) || '' });
  }
  for (const st of stats || []) if (st && n0(st.fs) >= from && UID_RE.test(String(st.id || ''))) ev.push({ t: 'nu', at: st.fs, u: st.id });
  ev.sort((a, b) => b.at - a.at);
  return ev.slice(0, TL_MAX);
}

/* ---- ההתראות למנהל (webpush.message) ---- */
const STG = {
  he: { up: 'מעלה', tr: 'מתמלל', al: 'מיישר', tl: 'מתרגם', rv: 'בודק', bn: 'בונה', sv: 'שומר' },
  en: { up: 'Uploading', tr: 'Transcribing', al: 'Aligning', tl: 'Translating', rv: 'Reviewing', bn: 'Building', sv: 'Saving' },
};
const usdT = (v) => '$' + (Math.round(n0(v) * 100) / 100).toFixed(2);
const minT = (s, en) => (s >= 60 ? (en ? '~' + Math.round(s / 60) + ' min left' : 'עוד ~' + Math.round(s / 60) + ' דק׳') : '');
/* x = {nm, st, p, usd, left, min, ok, n, u, usd, cap} — מחזיר [כותרת, שורה] או null */
function pushText(kind, x, lang) {
  const en = lang === 'en', d = en ? '' : '‏';
  const nm = String((x && x.nm) || (en ? 'A user' : 'משתמש')).slice(0, NM_MAX);
  if (kind === 'watch') {
    const L = STG[en ? 'en' : 'he'], pct = Math.round(Math.max(0, Math.min(1, n0(x.p))) * 100);
    const parts = [(L[x.st] || (en ? 'Working' : 'עובד')) + ' ' + pct + '%', usdT(x.usd) + (en ? ' so far' : ' עד עכשיו')];
    const m = minT(n0(x.left), en); if (m) parts.push(m);
    return [en ? '👤 ' + nm + ' · translating · not yours' : '👤 ' + nm + ' · תרגום רץ · לא שלך', d + parts.join(' · ')];
  }
  if (kind === 'watch_end') return x.ok
    ? [en ? '■ ' + nm + ' · translation finished' : '■ ' + nm + ' · התרגום הסתיים', d + usdT(x.usd) + ' · ' + Math.max(1, Math.round(n0(x.min))) + (en ? ' min' : ' דק׳')]
    : [en ? '■ ' + nm + ' · the job stopped' : '■ ' + nm + ' · העבודה נעצרה', d + usdT(x.usd) + (en ? ' spent' : ' עד העצירה')];
  if (kind === 'watch_clear') return en ? ['✓ No other users are working', 'You can start a translation or a test run'] : ['✓ אין עבודות של משתמשים אחרים', d + 'אפשר להתחיל תרגום או בדיקה'];
  if (kind === 'cap80') return [en ? nm + ' · 80% of the monthly cap' : nm + ' · 80% מהתקרה החודשית', d + usdT(x.usd) + (en ? ' of ' : ' מתוך ') + usdT(x.cap)];
  if (kind === 'daily') return [en ? 'Today in THE SNOWBALL' : 'היום ב־THE SNOWBALL',
    d + (en ? x.u + ' active users · ' + x.n + ' translations · ' + usdT(x.usd) : x.u + ' משתמשים פעילים · ' + x.n + ' תרגומים · ' + usdT(x.usd))
      + (n0(x.mo) > 0 ? (en ? ' · month ' : ' · החודש ') + usdT(x.mo) : '')];
  if (kind === 'spend') return [en ? nm + ' · passed ' + usdT(x.s).replace('.00', '') + ' this month' : nm + ' · עבר ' + usdT(x.s).replace('.00', '') + ' החודש',
    d + (en ? usdT(x.usd) + ' used · cap ' : usdT(x.usd) + ' עד עכשיו · תקרה ') + usdT(x.cap).replace('.00', '')];
  return null;
}
/* מתי לשלוח את הסיכום היומי: אחרי 21:00 בישראל, פעם אחת ביום. מחזיר את מפתח היום או '' */
function dailyDue(now, last) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(now)).map((x) => [x.type, x.value]));
  const day = p.year + '-' + p.month + '-' + p.day;
  return Number(p.hour) >= DAILY_H && last !== day ? day : '';
}
/* הסיכום היומי מ־24 השעות האחרונות */
function dailySum(stats, jobs, now) {
  const from = now - 86400000;
  const us = new Set();
  for (const st of stats || []) if (n0(st && st.ls) >= from) us.add(st.id);
  let n = 0, usd = 0;
  for (const j of jobs || []) {
    if (!j || j.kind !== 'tr') continue;
    if (n0(j.updated) >= from) us.add(j.uid);
    if (n0(j.created) >= from) { n++; if (ours(j)) usd += S.usdOf(jobUse(j)); }
  }
  let mo = 0;
  for (const st of stats || []) mo += S.monthUsed(st && st.mu, now);
  return { u: us.size, n, usd: Math.round(usd * 100) / 100, mo: Math.round(mo * 100) / 100 };
}
/* האם לשלוח למנהל: עבודה של משתמש אחר בלבד (העבודה שלך — כבר בהתראה של Studio) */
const watchFor = (job, adminUid) => !!(job && adminUid && job.uid && job.uid !== adminUid && job.kind === 'tr');
/* 80% מהתקרה — פעם אחת בחודש (m80 = מפתח החודש) */
function capWarn(st, used, def, now) {
  const cap = capOf(st, def), mk = S.monthKey(now);
  return used >= cap * CAP_WARN && (st && st.m80) !== mk ? { cap, mk } : null;
}
/* חציית סכום עגול החודש (SPEND_STEPS) — התראה אחת לכל סף; msx = "<חודש>:<הסף האחרון>". מחזיר {s, v} או null */
function spendStep(st, used, now) {
  const mk = S.monthKey(now), m = /^(\d{4}-\d{2}):(\d+)$/.exec(String((st && st.msx) || ''));
  const last = m && m[1] === mk ? Number(m[2]) : 0;
  let s = 0;
  for (const x of SPEND_STEPS) if (n0(used) >= x) s = x;
  return s > last ? { s, v: mk + ':' + s } : null;
}

/* ---- שימוש ומשאבים (29/10/2026, בקשת המשתמש: "להעריך את כמות השימוש ואת הצורך בשדרוג המשאבים") ----
   מכל עבודות 30 הימים (jobs30): לפי סוג (סרטון, קישור, קובץ כתוביות, קריוקי, בטלפון, הפקה מחדש, גיליון AI, Drive),
   לפי יום ולפי שעה, זמני המתנה בתור וריצה, שיא העבודות במקביל, ניצולת, כשלים, שרתים, מגמה, תחזית לחודש — והמלצות */
const TYPES = ['vid', 'url', 'sub', 'ka', 'ph', 'rr', 'ai', 'dx'];
function typeOf(j) {
  if (!j) return 'oth';
  if (j.kind === 'tr') {
    const sp = j.spec || {};
    return sp.ka === 1 ? 'ka' : sp.src === 'subs' ? 'sub' : sp.ph === 1 ? 'ph' : sp.src === 'url' ? 'url' : 'vid';
  }
  return TYPES.includes(j.kind) ? j.kind : 'oth';   // סוג עבודה חדש — נספר ב"אחר" עד שיקבל שם
}
const engOf = (j) => { const sp = (j && j.spec) || {}; return sp.cp === 1 ? 'cp' : sp.ry === 1 ? 'ry' : sp.eng === 'api' ? 'api' : 'rt'; };
const IL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
function ilParts(ms) { const p = Object.fromEntries(IL.formatToParts(new Date(ms)).map((x) => [x.type, x.value])); return { d: p.year + '-' + p.month + '-' + p.day, h: Number(p.hour) % 24 }; }
const pct = (arr, q) => { if (!arr.length) return 0; const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(q * a.length))]; };
const r2 = (v) => Math.round(v * 100) / 100;
const U_REC = { wait: 600, util: 0.5, fail: 0.15, grow: 0.5 };   // ספי ההמלצות: המתנה p90 (שנ׳), ניצולת, שיעור כשלים, צמיחה שבועית
/* jobs = עבודות 30 יום; stats = studioStats (סכום החודש); o = { max: גבול השאילתה } */
function usage(jobs, stats, now, o) {
  const opt = o || {}, from = now - TL_DAYS * 86400000;
  const L = (jobs || []).filter((j) => j && j.kind !== 'ping' && n0(j.created) >= from);
  const days = [];
  for (let i = TL_DAYS - 1; i >= 0; i--) days.push({ d: ilParts(now - i * 86400000).d, n: 0, usd: 0, sec: 0, f: 0, pk: 0, t: {} });
  const dIx = new Map(days.map((x, i) => [x.d, i]));
  const hours = new Array(24).fill(0);
  const ty = {}, eng = { api: 0, ry: 0, cp: 0, rt: 0 }, errs = {}, srv = {};
  const waits = [], runs = [], iv = [];
  const tot = { n: 0, ok: 0, f: 0, c: 0, live: 0, usd: 0, tok: 0, sec: 0 };
  for (const j of L) {
    const k = typeOf(j), use = jobUse(j), our = ours(j), usd = our ? S.usdOf(use) : 0, tok = our ? tokOf(use) : 0, sec = n0(j.spec && j.spec.dur);
    const t = ty[k] || (ty[k] = { k, n: 0, ok: 0, f: 0, usd: 0, tok: 0, sec: 0, rm: 0, rn: 0 });
    t.n++; t.usd += usd; t.tok += tok; t.sec += sec;
    tot.n++; tot.usd += usd; tot.tok += tok; tot.sec += sec;
    if (j.state === 'done') { t.ok++; tot.ok++; } else if (j.state === 'failed') { t.f++; tot.f++; errs[String(j.err || '?').slice(0, 30)] = (errs[String(j.err || '?').slice(0, 30)] || 0) + 1; }
    else if (j.state === 'cancelled') tot.c++;
    if (isLive(j)) tot.live++;
    eng[engOf(j)]++;
    const p = ilParts(n0(j.created)), di = dIx.get(p.d);
    hours[p.h]++;
    if (di != null) { const D = days[di]; D.n++; D.usd += usd; D.sec += sec; if (j.state === 'failed') D.f++; D.t[k] = (D.t[k] || 0) + 1; }
    const c1 = n0(j.claimed), end = n0(j.ended) || (isLive(j) ? now : n0(j.updated));
    if (c1 && c1 >= n0(j.created)) waits.push((c1 - n0(j.created)) / 1000);
    if (c1 && end > c1) {
      const ms = end - c1;
      if (j.state === 'done') { runs.push(ms / 60000); t.rm += ms; t.rn++; }
      if (j.kind === 'tr') iv.push([c1, end]);
      const sid = String(j.sid || '');
      if (sid) { const sv = srv[sid] || (srv[sid] = { s: sid, n: 0, h: 0 }); sv.n++; sv.h += ms / 3600e3; }
    }
  }
  // שיא במקביל (תרגומים בלבד — הם שתופסים את העובד) וזמן העבודה הכולל
  const ev = [];
  let busy = 0;
  for (const [a, b] of iv) { ev.push([a, 1], [b, -1]); busy += b - a; }
  ev.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  let c = 0, pk = 0, pkAt = 0;
  for (const [tm, dl] of ev) {
    c += dl;
    if (c > pk) { pk = c; pkAt = tm; }
    const di = dIx.get(ilParts(tm).d);
    if (di != null && c > days[di].pk) days[di].pk = c;
  }
  for (const D of days) { D.usd = r2(D.usd); }
  const types = Object.values(ty).map((t) => ({ k: t.k, n: t.n, ok: t.ok, f: t.f, usd: r2(t.usd), tok: t.tok, sec: t.sec,
    run: t.rn ? Math.round(t.rm / t.rn / 60000) : 0, cpm: t.sec >= 60 ? Math.round(t.usd / (t.sec / 60) * 1000) / 1000 : 0 })).sort((a, b) => b.n - a.n);
  // מגמה: 7 הימים האחרונים מול השבוע שלפניו
  const wk = (a, b) => L.filter((j) => n0(j.created) >= now - a * 86400000 && n0(j.created) < now - b * 86400000)
    .reduce((s, j) => ({ n: s.n + 1, usd: s.usd + (ours(j) ? S.usdOf(jobUse(j)) : 0) }), { n: 0, usd: 0 });
  const cur = wk(7, 0), prev = wk(14, 7);
  const g = prev.n ? (cur.n - prev.n) / prev.n : 0;
  // החודש: מה שנוצל (studioStats.mu של כולם) ותחזית לסוף החודש לפי הקצב עד היום
  let mo = 0;
  for (const st of stats || []) mo += S.monthUsed(st && st.mu, now);
  const dt = new Date(now), dim = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth() + 1, 0)).getUTCDate();
  const el = Math.max(1, (now - Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), 1)) / 86400000);
  const util = busy / (TL_DAYS * 86400000);
  const wait = { p50: Math.round(pct(waits, 0.5)), p90: Math.round(pct(waits, 0.9)), max: Math.round(waits.length ? Math.max(...waits) : 0), n: waits.length };
  const fin = tot.ok + tot.f, fr = fin ? tot.f / fin : 0;
  const cut = !!(opt.max && (jobs || []).length >= opt.max);
  const rec = [];
  if (wait.n >= 3 && wait.p90 > U_REC.wait) rec.push({ k: 'wait', v: wait.p90 });
  if (util > U_REC.util) rec.push({ k: 'util', v: Math.round(util * 100) });
  if (fin >= 5 && fr > U_REC.fail) rec.push({ k: 'fail', v: Math.round(fr * 100) });
  if (prev.n >= 3 && g > U_REC.grow) rec.push({ k: 'grow', v: Math.round(g * 100) });
  if (cut) rec.push({ k: 'cut', v: opt.max });
  return { n: tot.n, ok: tot.ok, f: tot.f, c: tot.c, live: tot.live, usd: r2(tot.usd), tok: tot.tok, sec: tot.sec,
    types, eng, days, hours, wait, run: { p50: Math.round(pct(runs, 0.5)), p90: Math.round(pct(runs, 0.9)) },
    peak: { c: pk, at: pkAt, busy: Math.round(busy / 3600e3 * 10) / 10, util: Math.round(util * 1000) / 1000 },
    errs: Object.entries(errs).map(([e, n]) => ({ e, n })).sort((a, b) => b.n - a.n).slice(0, 6),
    srv: Object.values(srv).map((x) => ({ s: x.s, n: x.n, h: Math.round(x.h * 10) / 10 })).sort((a, b) => b.n - a.n).slice(0, 8),
    wk: { cur: { n: cur.n, usd: r2(cur.usd) }, prev: { n: prev.n, usd: r2(prev.usd) }, g: Math.round(g * 100) },
    mo: { usd: r2(mo), proj: r2(mo / el * dim), d: Math.floor(el), dim }, fr: Math.round(fr * 100), cut, rec };
}

module.exports = { KINDS, CAP_MIN, CAP_MAX, CAP_DEF, ADMIN_CAP, isAdm, monthCap, SPEND_STEPS, TYPES, typeOf, engOf, usage, spendStep, CAP_WARN, TL_DAYS, TL_MAX, DAILY_H, idOf, label, tokOf, ours, capOf, normCap, paused, addTotal, backfill,
  liveRow, byAgent, isLive, usersView, timeline, pushText, dailyDue, dailySum, watchFor, capWarn };
