/* מרכז הניהול — הסקירה, "מחכה לך" והתשתית (15/10/2026, סבב 3 בתוכנית; התצוגה המקדימה אושרה).
   טהור: מקבל עובדות שכבר נאספו (שרתים, גיבוי, ניטור הכתובות, GitHub, הגרסאות החיות, התאריכים) ומחזיר:
     items  — "מחכה לך": מה דורש החלטה שלך, ממוין לפי דחיפות (sev 1 = הכי דחוף). קודים בלבד — הטקסט בטלפון
     run    — "מה רץ איפה": הייצור, הניסוי, השרתים, הגיבוי, הכתובות
     sum    — משפט אחד (מספר הפריטים הדחופים) לראש המסך
   בלי פרטים אישיים: שמות שרתים (שהמנהל נתן), מספרי PR, גרסאות ותאריכים בלבד. */
'use strict';
const crypto = require('crypto');

const DAY = 86400000;
/* תאריכים שחייבים לזכור (CLAUDE.md, משימות-פתוחות.md). k = קוד; d = התאריך; warn = כמה ימים לפני מתחילים להזכיר */
const DATES = [
  { k: 'ant_key', d: '2027-01-16', warn: 30 },      // מפתח Anthropic של השרת פג
  { k: 'brk13f', d: '2026-11-14', warn: 7 },        // דוח 13F של ברקשייר — עדכון תיק הדמו
  { k: 'sec_txt', d: '2027-10-14', warn: 30 },      // security.txt פג
  { k: 'drill', d: '2027-01-14', warn: 14 },        // תרגיל חירום: הקמה מאפס בניסוי
];
const ymd = (s) => Date.parse(s + 'T00:00:00Z');
const daysTo = (s, now) => Math.ceil((ymd(s) - now) / DAY);

/* הגרסה מתוך sw.js החי ('portfolio-pwa-v427' → 427) */
function swBuild(txt) {
  const m = /CACHE_NAME = 'portfolio-pwa-v(\d{3,5})'/.exec(String(txt || ''));
  return m ? +m[1] : 0;
}

/* f = {
     now, prodBuild, stagBuild,                          // הגרסאות החיות (מ־sw.js); 0 = לא נקרא
     servers: [serverView…], backup: sysBackup/cfg, sites: { sd: 'api,invest' },
     gh: { waiting: [{id, name, sha, at}], prs: [{n, t, dep, at}], tag: 'v2.7.1' } | null
   } */
function overview(f) {
  const now = f.now || Date.now();
  const items = [];
  const gh = f.gh || null;
  // 1. פריסה שמחכה לאישור שלך — הדבר הכי דחוף (אחרת הניסוי והייצור נפרדים)
  for (const w of (gh && gh.waiting) || []) items.push({ k: 'deploy_wait', sev: 1, v: { id: w.id, at: w.at || 0 } });
  // 2. כתובת שנפלה (שתי בדיקות רצופות)
  const down = String((f.sites && f.sites.sd) || '').split(',').filter(Boolean);
  if (down.length) items.push({ k: 'site_down', sev: 1, v: { l: down } });
  // 3. שרת שכבר דיווח ונעלם
  for (const s of f.servers || []) if (s && s.seen && !s.online && !s.paused) items.push({ k: 'srv_off', sev: 1, v: { n: s.name, seen: s.seen } });
  // 4. הגיבוי אצל ספק שני — לא הצליח יותר מיומיים / שגיאה
  const bk = f.backup || null;
  if (!bk || !bk.okAt) items.push({ k: 'bk_none', sev: 2, v: {} });
  else if (now - bk.okAt > 2 * DAY) items.push({ k: 'bk_stale', sev: 2, v: { at: bk.okAt } });
  else if (bk.err) items.push({ k: 'bk_err', sev: 2, v: { e: String(bk.err).slice(0, 30) } });
  // 5. PR פתוחים — של Dependabot בנפרד (לבדוק יחד), ושל הסשנים (מחכים למיזוג)
  const prs = (gh && gh.prs) || [];
  const dep = prs.filter((p) => p.dep), own = prs.filter((p) => !p.dep);
  for (const p of own) items.push({ k: 'pr_open', sev: 2, v: { n: p.n, t: String(p.t || '').slice(0, 120), at: p.at || 0 } });
  if (dep.length) items.push({ k: 'pr_dep', sev: 3, v: { n: dep.length } });
  // 6. תאריכים שמתקרבים
  for (const x of DATES) {
    const d = daysTo(x.d, now);
    if (d <= x.warn) items.push({ k: 'date_' + x.k, sev: d <= 7 ? 2 : 3, v: { d: x.d, left: d } });
  }
  // 7. הניסוי לפני הייצור בהרבה בניות — כדאי לשחרר
  if (f.prodBuild && f.stagBuild && f.stagBuild - f.prodBuild >= 3 && !((gh && gh.waiting) || []).length) items.push({ k: 'release_due', sev: 3, v: { p: f.prodBuild, s: f.stagBuild } });
  items.sort((a, b) => a.sev - b.sev);

  const run = [];
  run.push({ k: 'prod', ok: !!f.prodBuild, v: { b: f.prodBuild || 0, tag: (gh && gh.tag) || '' } });
  run.push({ k: 'stag', ok: !!f.stagBuild, v: { b: f.stagBuild || 0, ahead: f.prodBuild && f.stagBuild ? f.stagBuild - f.prodBuild : 0 } });
  for (const s of f.servers || []) if (s) run.push({ k: 'srv', ok: !!s.online || !!s.paused, v: { n: s.name, seen: s.seen || 0, paused: !!s.paused, jobs: s.hb && s.hb.q != null ? s.hb.q : null } });
  run.push({ k: 'backup', ok: !!(bk && bk.okAt && now - bk.okAt <= 2 * DAY && !bk.err), v: { at: (bk && bk.okAt) || 0, up: (bk && bk.up) || 0 } });
  run.push({ k: 'sites', ok: !down.length, v: { down } });
  const urgent = items.filter((x) => x.sev <= 2).length;
  const dates = DATES.map((x) => ({ k: x.k, d: x.d, left: daysTo(x.d, now) })).sort((a, b) => a.left - b.left);
  return { v: 1, at: now, sum: { urgent, all: items.length }, items, run, dates };
}

/* ---- AI ועלויות (15/10/2026, סבב 4 בתוכנית) ----
   aiUse/{יום} (lib/aicache.js): t = כל הקריאות, i = ניתוחי מכתבים, u_<hash> = לכל קורא — כאן רק כמה קוראים (מספר).
   f = { now, days: { 'YYYY-MM-DD': doc|null }, lim: {total,user,anon,ins}, month: { usd, users, cap }, fns: { n, max } } */
const AI_DAYS = 14;
function dayKeys(now, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now - i * DAY).toISOString().slice(0, 10));
  return out;
}
function aiUseDay(doc) {
  const d = doc || {};
  const u = Object.keys(d).filter((k) => /^u_/.test(k)).length;
  return { t: Math.max(0, +d.t || 0), i: Math.max(0, +d.i || 0), u };
}
function aiView(f) {
  const now = f.now || Date.now();
  const lim = f.lim || { total: 2000, user: 150, anon: 40, ins: 100 };
  const days = dayKeys(now, AI_DAYS).map((d) => Object.assign({ d }, aiUseDay(f.days && f.days[d])));
  const td = days[days.length - 1];
  const wk = days.slice(-7), pw = days.slice(-14, -7);
  const sumT = (l) => l.reduce((s, x) => s + x.t, 0);
  const peak = days.reduce((m, x) => Math.max(m, x.t), 0);
  const mo = f.month || null;
  const fns = f.fns || null;
  // אזהרות: רק מה שדורש פעולה (תקרה יומית קרובה, תקציב חודשי של Studio, פונקציות Vercel)
  const warn = [];
  if (lim.total > 0 && td.t >= 0.8 * lim.total) warn.push({ k: 'ai_day', sev: td.t >= lim.total ? 1 : 2, v: { n: td.t, m: lim.total } });
  if (lim.ins > 0 && td.i >= 0.8 * lim.ins) warn.push({ k: 'ai_ins', sev: 2, v: { n: td.i, m: lim.ins } });
  if (mo && mo.cap > 0 && mo.top >= 0.8 * mo.cap) warn.push({ k: 'st_cap', sev: 2, v: { p: Math.round(mo.top / mo.cap * 100) } });
  if (fns && fns.max && fns.n >= fns.max) warn.push({ k: 'fn_full', sev: 3, v: { n: fns.n, m: fns.max } });
  return {
    v: 1, at: now, lim, days, today: td,
    wk: { t: sumT(wk), p: sumT(pw), i: wk.reduce((s, x) => s + x.i, 0), u: Math.max(0, ...wk.map((x) => x.u)) },
    peak, pct: lim.total > 0 ? Math.round(td.t / lim.total * 1000) / 10 : 0,
    month: mo ? { usd: Math.round((mo.usd || 0) * 100) / 100, users: mo.users || 0, cap: mo.cap || 0, top: Math.round((mo.top || 0) * 100) / 100 } : null,
    fns, warn: warn.sort((a, b) => a.sev - b.sev),
  };
}


/* ---- סשנים ומשימות (15/10/2026): משימות-פתוחות.md מהריפו (ציבורי) — מה פתוח, מה בעבודה ובידי איזה סשן, מה עם תאריך.
   טהור: מקבל את הטקסט ומחזיר רשימה קצרה. בלי Markdown בפלט (רק טקסט), כל שדה חתוך */
const plain = (x) => String(x || '').replace(/`([^`]*)`/g, '$1').replace(/\*\*([^*]*)\*\*/g, '$1').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[*>#]/g, '').replace(/\s+/g, ' ').trim();
const DATE_RE = /(?:^|[\s*~])(\d{2})\/(\d{2})\/(\d{4})/;
function tasksParse(md, now) {
  const out = [], secs = [];
  let sec = '';
  for (const ln of String(md || '').split('\n')) {
    const hm = /^##\s+(.+)$/.exec(ln);
    if (hm) { sec = plain(hm[1]).replace(/^[^\p{L}\p{N}]+/u, '').replace(/\s*\(.*$/, '').slice(0, 40); if (!secs.includes(sec)) secs.push(sec); continue; }
    const sm = /^\s+- (.+)$/.exec(ln);
    if (sm && out.length && out[out.length - 1]._c) { const L = out[out.length - 1]; L.t = (L.t + (L._n++ ? ' · ' : ': ') + plain(sm[1])).slice(0, 120); continue; }
    const im = /^- \[( |x)\]\s+(.+)$/.exec(ln);
    if (!im || im[1] === 'x') continue;
    const body = im[2];
    const bm = /^\*\*(.+?)\*\*/.exec(body);
    const w = /‹בעבודה:\s*([^·›]+?)\s*(?:\(([^)]*)\))?\s*·\s*([^›]+)›/.exec(body);
    const onlyDate = bm && /^~?\d{2}\/\d{2}\/\d{4}$/.test(bm[1].trim());
    let t = plain(bm && !onlyDate ? bm[1] : (onlyDate ? body.slice(bm[0].length) : body).replace(/‹[^›]*›/g, '').replace(/^[\s—–-]+/, '').split(/[.(]\s/)[0]);
    const colon = !bm && /:\s*$/.test(body);
    t = t.replace(/[.:;—-]+\s*$/, '').replace(/\s*\([^)]*\)?\s*$/, '').replace(/[.:;—-]+\s*$/, '').slice(0, 90);
    const dm = DATE_RE.exec(bm ? bm[1] : body.slice(0, 40));
    const at = dm ? Date.UTC(+dm[3], +dm[2] - 1, +dm[1]) : 0;
    const id = crypto.createHash('sha1').update(sec + '|' + t).digest('hex').slice(0, 12);
    out.push({ id, s: sec, t, w: w ? { by: plain(w[1]).slice(0, 24), n: plain(w[2] || '').slice(0, 30), d: plain(w[3]).slice(0, 12) } : null,
      at, left: at && now ? Math.ceil((at - now) / DAY) : null, _c: colon, _n: 0 });
  }
  for (const x of out) { delete x._c; delete x._n; }
  return { items: out, secs: secs.map((s) => ({ s, n: out.filter((x) => x.s === s).length })).filter((x) => x.n) };
}

/* ---- האפליקציות (15/10/2026): מספרים בלבד. f = { now, counts: { users, ibkr, lib, studio, sess } (null = לא נמדד),
   cat: קטלוג הספרייה (libcat) או null, readers: מספר הקוראים שנוספו מהאפליקציה או null } */
function catStats(cat, now) {
  if (!cat || !Array.isArray(cat.books)) return null;
  const live = cat.books.filter((b) => b && !b.del);
  const by = (st) => live.filter((b) => b.st === st).length;
  const pub = live.filter((b) => b.st === 'pub');
  const fm = {};
  let bytes = 0;
  for (const b of live) for (const f of b.files || []) { fm[f.fmt || '?'] = (fm[f.fmt || '?'] || 0) + 1; bytes += +f.size || 0; }
  const hist = Array.isArray(cat.hist) ? cat.hist : [];
  return { n: live.length, pub: pub.length, draft: by('draft'), hide: by('hide'), del: cat.books.length - live.length,
    noCover: pub.filter((b) => !b.cover).length, fm, mb: Math.round(bytes / 1048576),
    at: cat.at || 0, ch7: hist.filter((h) => h && h.at >= now - 7 * DAY).length, src: (cat.cfg && cat.cfg.source) || 'drive' };
}
function appsView(f) {
  const now = f.now || Date.now();
  const c = f.counts || {};
  const num = (x) => (Number.isFinite(x) && x >= 0 ? x : null);
  return { v: 1, at: now,
    invest: { users: num(c.users), ibkr: num(c.ibkr) },
    academy: { cat: catStats(f.cat, now), readers: num(f.readers), backup: num(c.lib) },
    studio: { conn: num(c.studio) },
    shared: { sess: num(c.sess) } };
}

/* בדיקות בטלפון (15/10/2026, "אימות אחרי שינוי"): המקטע ברשימה + התשובות של המנהל (sysChecks). st: ok = עובד, no = לא עובד.
   "עובד" יורד מהרשימה הפתוחה; "לא עובד" נשאר, עם ההערה — עד שהסשן מתקן ומוחק את השורה מהקובץ */
const CHECK_SEC = /^בדיקות בטלפון/;
function checksView(tk, answers) {
  const A = answers || {};
  const all = ((tk && tk.items) || []).filter((x) => CHECK_SEC.test(x.s)).map((x) => Object.assign({ id: x.id, t: x.t }, A[x.id] ? { st: A[x.id].st, n: A[x.id].n || '', at: A[x.id].at || 0 } : {}));
  return { open: all.filter((x) => x.st !== 'ok'), done: all.filter((x) => x.st === 'ok') };
}
const noteClean = (x) => String(x || '').replace(/[\u0000-\u001f<>`]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 300);
/* ---- בדיקת מוכנות לכל המערכת (15/10/2026, Instance Scan — כל בדיקה נולדה מתקלה שכבר הייתה אצלנו).
   f = { now, cache: { host: 'cache-control' | null }, builds: { invest, academy, studio } (0 = לא נקרא),
         sess: { last: [[זמן, קוד, אפליקציה]] } | null, links: מספר החבילות ב־assetlinks | null,
         api: { main: bool, fb: bool }, sec: 'Expires' של security.txt | null }
   כל בדיקה: { k, ok, sev (1 דחוף / 2), v } — הטקסט, ו"מה עושים", בטלפון */
function readyView(f) {
  const now = f.now || Date.now();
  const out = [];
  const cache = f.cache || {};
  const bad = Object.entries(cache).filter(([, v]) => v != null && !/no-cache|no-store/.test(String(v))).map(([h]) => h);
  const miss = Object.entries(cache).filter(([, v]) => v == null).map(([h]) => h);
  out.push({ k: 'cache', sev: 1, ok: !bad.length && !miss.length, v: { bad, miss, n: Object.keys(cache).length } });
  const b = f.builds || {};
  const vals = Object.values(b).filter((x) => x > 0);
  out.push({ k: 'live', sev: 1, ok: vals.length === 3 && new Set(vals).size === 1, v: { b } });
  const api = f.api || {};
  out.push({ k: 'api', sev: 1, ok: !!api.main, v: {} });
  out.push({ k: 'fb', sev: 2, ok: !!api.fb, v: {} });
  const sl = (f.sess && f.sess.last) || null;
  const signBad = sl ? sl.filter((x) => /sign_http_40[34]/.test(String(x[1]))) : [];
  out.push({ k: 'sess', sev: 2, ok: !!sl && !signBad.length, v: { n: signBad.length, read: !!sl } });
  out.push({ k: 'links', sev: 2, ok: f.links != null && f.links >= 3, v: { n: f.links } });
  const ex = f.sec ? Date.parse(f.sec) : 0;
  const exLeft = ex ? Math.ceil((ex - now) / DAY) : null;
  out.push({ k: 'sec', sev: 2, ok: exLeft != null && exLeft > 30, v: { left: exLeft } });
  const soon = DATES.map((x) => ({ k: x.k, left: daysTo(x.d, now), warn: x.warn })).filter((x) => x.left <= x.warn);
  out.push({ k: 'dates', sev: 2, ok: !soon.length, v: { soon: soon.map((x) => ({ k: x.k, left: x.left })), next: DATES.map((x) => daysTo(x.d, now)).sort((a, c) => a - c)[0] } });
  const fails = out.filter((x) => !x.ok).sort((a, c) => a.sev - c.sev);
  return { v: 1, at: now, n: out.length, pass: out.length - fails.length, checks: [...fails, ...out.filter((x) => x.ok)] };
}

/* ההחלטה של הבדיקה המתוזמנת (טהורה): מה לשלוח לטלפון. prev = sysWatch/ready, rd = readyView, bk = sysBackup/cfg */
function watchStep(prev, rd, bk, now) {
  // כשל נחשב רק כשהוא חוזר בשתי בדיקות רצופות (שעה) — באמצע פריסה הכתובות מגישות לרגע בניות שונות
  const cur = ((rd && rd.checks) || []).filter((x) => !x.ok && x.k !== 'dates').map((x) => x.k).sort();
  const sp = (x) => String(x || '').split(',').filter(Boolean);
  const pp = sp(prev.pp), fp = sp(prev.fp);
  const conf = cur.filter((k) => pp.includes(k));
  const send = [];
  const patch = {};
  if (cur.join() !== pp.join()) patch.pp = cur.join();
  if (conf.join() !== fp.join()) { patch.fp = conf.join(); if (conf.some((k) => !fp.includes(k))) send.push('ready_fail'); }
  const day = new Date(now).toISOString().slice(0, 10);
  const stale = !bk || !bk.okAt || now - bk.okAt > 2 * DAY;
  if (stale && prev.bkd !== day) { send.push('bk_fail'); patch.bkd = day; }
  if (Object.keys(patch).length) patch.at = now;
  return { send, patch: Object.keys(patch).length ? patch : null };
}

/* נתיב הפריסה (15/10/2026, Work queues — CLAUDE.md סעיף 11): PR עם מספר בנייה בכותרת ("2.9.0 (429): …" / "(429): …") מחזיק את
   הנתיב; PR שכתוב בו "ממתין לתור אחרי #NN" — בתור אחריו. waiting = ריצת deploy שמחכה לאישור (הנתיב עוד תפוס עד שהיא ירוקה) */
const BUILD_RE = /^(?:(\d+\.\d+\.\d+)\s+)?\((\d{3,5})\)/;
function laneView(prs, waiting) {
  const own = (prs || []).filter((p) => p && !p.dep).map((p) => {
    const q = /^\s*ממתין לתור אחרי\s*#(\d+)\s*[—–:-]?\s*/.exec(String(p.t || ''));
    const t0 = String(p.t || '').slice(q ? q[0].length : 0), m = BUILD_RE.exec(t0);
    return { n: p.n, t: t0.replace(BUILD_RE, '').replace(/^[:\s]+/, '').slice(0, 90), b: m ? +m[2] : 0, rel: m && m[1] ? m[1] : '', after: q ? +q[1] : 0, at: p.at || 0 }; });
  const withB = own.filter((x) => x.b && !x.after).sort((a, c) => a.b - c.b || a.at - c.at);
  const holder = withB[0] || null;
  const queue = [...withB.slice(1), ...own.filter((x) => x.after).sort((a, c) => a.at - c.at)];
  const other = own.filter((x) => !x.b && !x.after);
  const w = (waiting || []).length;
  return { holder, queue, other, deploy: w, free: !holder && !w };
}

module.exports = { laneView, watchStep, readyView, checksView, noteClean, CHECK_SEC, DATES, overview, swBuild, daysTo, aiView, aiUseDay, dayKeys, AI_DAYS, tasksParse, appsView, catStats };
