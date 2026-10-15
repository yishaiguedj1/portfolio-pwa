/* מרכז הניהול — הסקירה, "מחכה לך" והתשתית (15/10/2026, סבב 3 בתוכנית; התצוגה המקדימה אושרה).
   טהור: מקבל עובדות שכבר נאספו (שרתים, גיבוי, ניטור הכתובות, GitHub, הגרסאות החיות, התאריכים) ומחזיר:
     items  — "מחכה לך": מה דורש החלטה שלך, ממוין לפי דחיפות (sev 1 = הכי דחוף). קודים בלבד — הטקסט בטלפון
     run    — "מה רץ איפה": הייצור, הניסוי, השרתים, הגיבוי, הכתובות
     sum    — משפט אחד (מספר הפריטים הדחופים) לראש המסך
   בלי פרטים אישיים: שמות שרתים (שהמנהל נתן), מספרי PR, גרסאות ותאריכים בלבד. */
'use strict';

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
    const im = /^- \[( |x)\]\s+(.+)$/.exec(ln);
    if (!im || im[1] === 'x') continue;
    const body = im[2];
    const bm = /^\*\*(.+?)\*\*/.exec(body);
    const w = /‹בעבודה:\s*([^·›]+?)\s*(?:\(([^)]*)\))?\s*·\s*([^›]+)›/.exec(body);
    const onlyDate = bm && /^~?\d{2}\/\d{2}\/\d{4}$/.test(bm[1].trim());
    let t = plain(bm && !onlyDate ? bm[1] : (onlyDate ? body.slice(bm[0].length) : body).replace(/‹[^›]*›/g, '').replace(/^[\s—–-]+/, '').split(/[.(]\s/)[0]);
    t = t.replace(/[.:;—-]+\s*$/, '').replace(/\s*\([^)]*\)?\s*$/, '').replace(/[.:;—-]+\s*$/, '').slice(0, 90);
    const dm = DATE_RE.exec(bm ? bm[1] : body.slice(0, 40));
    const at = dm ? Date.UTC(+dm[3], +dm[2] - 1, +dm[1]) : 0;
    out.push({ s: sec, t, w: w ? { by: plain(w[1]).slice(0, 24), n: plain(w[2] || '').slice(0, 30), d: plain(w[3]).slice(0, 12) } : null,
      at, left: at && now ? Math.ceil((at - now) / DAY) : null });
  }
  return { items: out, secs: secs.map((s) => ({ s, n: out.filter((x) => x.s === s).length })).filter((x) => x.n) };
}

module.exports = { DATES, overview, swBuild, daysTo, aiView, aiUseDay, dayKeys, AI_DAYS, tasksParse };
