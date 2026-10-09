/* מגדל הפיקוח 2.0 — סבב התקלות (v371). בהשראת ServiceNow Incident + Probable Root Cause + Major Incident Management.
   התראה (studioops.js) = אות מרכיב; תקלה = מה שקרה לעבודה (ITIL: אירוע ≠ תקלה ≠ בעיה). כל עבודת תרגום שנכשלה או נתקעה
   הופכת לתקלה אחת: חומרה P1–P4, מצב (פתוחה ← בטיפול ← נפתרה / נסגרה), מי טיפל (Claude לבד / אתה), ציר זמן,
   ו־3 סיבות סבירות — חשבון בקוד, בלי טוקנים. אותה תקלה בשתי עבודות תוך יום, או רכיב שנכשל לכמה עבודות = "תקלה רחבה":
   הפעלות חדשות מחכות עד שזה עובר (אפשר לעקוף).
   הרשומה נגזרת מהעבודה (עיקרון 1): השרתון מסנכרן בכל צפייה ברשימת העבודות (incSync) — לא בכל מעבר מצב בנפרד.
   רק קודים וזמנים — בלי טקסט חופשי, בלי שמות קבצים. נשמר ב־studioOps/{uid} (inc, mi). הקובץ טהור — בלי רשת. */
const { COMPONENTS, KINDS } = require('./studioops');

const INC_MAX = 60, KEEP = 30 * 86400e3, DAY = 86400e3, H_MAX = 16, RC_MAX = 3;
/* הציר: o נפתחה · f נכשלה שוב · w המשכת · c Claude המשיך לבד · r נפתרה · x נסגרה · m חלק מתקלה רחבה */
const H_CODES = ['o', 'f', 'w', 'c', 'r', 'x', 'm'];
const ST = ['o', 'w', 'r', 'x'];
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const ERR_RE = /^[a-z][a-z0-9_]{1,29}$/;
/* קוד השגיאה של העבודה → הרכיב שבו התקלה צצה, והחומרה. Routine שלא מאשר / לא קיים = שום עבודה לא תעבוד עד שמתקנים → P1 */
const ERR_INFO = {
  no_claim: ['routine', 2], routine_auth: ['routine', 1], routine_forbidden: ['routine', 1], routine_missing: ['routine', 1],
  routine_paused: ['routine', 1], routine_rate: ['routine', 3], routine_down: ['routine', 2], routine_net: ['routine', 2], routine_bad: ['routine', 2],
  no_server: ['server', 2], job_timeout: ['server', 2], month_cap: ['server', 3], worker_unknown_kind: ['server', 3],
  tower_stop: ['claude', 2], budget_stop: ['claude', 3], worker_step: ['claude', 2], stale: ['claude', 2], worker: ['claude', 2],
  lang_unsupported: ['claude', 4], upload_timeout: ['phone', 3], net: ['drive', 3], drive: ['drive', 3], drive_net: ['drive', 3],
};
const errInfo = (e) => ERR_INFO[e] || (/^routine_/.test(e) ? ['routine', 2] : ['claude', 2]);
/* רכיבים שכשל בהם פוגע בכל עבודה (תקלה רחבה גם בהתראה אחת שפוגעת בשתי עבודות, עוד לפני שיש "נכשלה") */
const WIDE_ALERTS = ['routine:fire', 'routine:no_claim', 'drive:auth', 'drive:full'];
const MAJOR_TTL = 6 * 3600e3;    // תקלה רחבה בלי שום חיזוק — נסגרת לבד (שלא תשהה הפעלות לנצח)

const hist = (x, t, c) => { x.h = (Array.isArray(x.h) ? x.h : []).concat([[t, c]]).slice(-H_MAX); };
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
function incList(inc, now) {
  return (Array.isArray(inc) ? inc : []).filter((x) => x && Number.isInteger(x.no) && JOB_RE.test(String(x.j || '')) && ST.includes(x.st)
    && ERR_RE.test(String(x.e || '')) && COMPONENTS.includes(x.c) && (x.st === 'o' || x.st === 'w' || now - num(x.rt) < KEEP));
}
/* עבודות מהשרתון → הצורה שהקובץ הזה צריך (בלי המפתח, בלי שמות): המצב האפקטיבי, הקוד, כמה הפעלות, כמה "המשך" אוטומטי */
function jobFacts(job, eff, stale) {
  return { id: job.id, st: eff.state, err: stale ? 'stale' : eff.err || (eff.state === 'failed' ? 'worker' : ''), bad: eff.state === 'failed' || !!stale,
    fires: num(job.fires), ar: num(job.ar), rw: num(job.rw), at: num(job.ended) || num(job.updated), fired: num(job.fired),
    ev: /^[0-9a-f]{8,40}$/.test(String(job.ev || '')) ? job.ev : '', fp: job.tw && /^[0-9a-f]{12}$/.test(String(job.tw.fp || '')) ? job.tw.fp : '' };
}

/* שורש סביר (Probable Root Cause): עד 3 מועמדים, ממוינים. משקלים קבועים — כל אחד מוסבר בטלפון במשפט מהקטלוג:
   known  — ספר התיקונים מכיר את טביעת האצבע (יש תיקון)          75
   wide   — אותה תקלה בעבודות אחרות ב־24 שעות                      70 + 5 לכל עבודה נוספת
   up     — רכיב מוקדם יותר בשרשרת נכשל באותה עבודה                 55 + חומרה + מופעים
   env    — הסביבה של העובד השתנתה מאז העבודה האחרונה שהצליחה       50
   same   — התראה באותו רכיב באותה עבודה (הסימפטום הישיר)          35 + חומרה + מופעים
   self   — אין שום רמז אחר: הקוד עצמו                              25 */
function rootCauses(inc, f, al, others, prevEv, fb) {
  const out = [];
  if (f.fp && Array.isArray(fb) && fb.some((x) => x && x.fp === f.fp && x.fix)) out.push({ t: 'known', c: inc.c, k: f.fp, w: 75 });
  const wide = others.length;
  if (wide) out.push({ t: 'wide', c: inc.c, k: inc.e, w: Math.min(90, 70 + 5 * (wide - 1)), n: wide + 1 });
  const ci = COMPONENTS.indexOf(inc.c);
  const seen = new Set();
  for (const a of (Array.isArray(al) ? al : []).filter((x) => x && x.j === f.id && (x.c + ':' + x.k) in KINDS && x.k !== 'auto')) {
    const key = a.c + ':' + a.k;
    if (seen.has(key)) continue;
    seen.add(key);
    const up = COMPONENTS.indexOf(a.c) < ci;
    if (!up && a.c !== inc.c) continue;   // רכיב מאוחר יותר — תוצאה, לא סיבה
    out.push({ t: up ? 'up' : 'same', c: a.c, k: a.k, w: (up ? 55 : 35) + (5 - (a.s || 4)) * 4 + Math.min(num(a.n), 5) });
  }
  if (f.ev && prevEv && f.ev !== prevEv) out.push({ t: 'env', c: 'vt', k: '', w: 50 });
  if (!out.length) out.push({ t: 'self', c: inc.c, k: inc.e, w: 25 });
  out.sort((a, b) => b.w - a.w);
  const top = out.slice(0, RC_MAX);
  const sum = top.reduce((s, x) => s + x.w, 0) || 1;
  return top.map((x) => Object.assign({ t: x.t, c: x.c, k: x.k, p: Math.round(100 * x.w / sum) }, x.n ? { n: x.n } : {}));
}

/* הסנכרון: jobs = jobFacts של כל עבודות התרגום של המשתמש (כל הרשימה — עבודה שנעלמה ממנה נמחקה).
   al = ההתראות (studioOps.al), fb = ספר התיקונים. מחזיר רשימה חדשה, או null כשלא השתנה דבר */
function incSync(inc, jobs, al, fb, now) {
  const out = incList(inc, now).map((x) => Object.assign({}, x));
  let seq = out.reduce((m, x) => Math.max(m, x.no), 0);
  let changed = out.length !== (Array.isArray(inc) ? inc.length : 0);
  const byId = new Map(jobs.map((f) => [f.id, f]));
  // הסביבה של העבודה האחרונה שהצליחה לפני כל עבודה (בשביל "אחרי שינוי בסביבה")
  const done = jobs.filter((f) => f.st === 'done' && f.ev).sort((a, b) => a.at - b.at);
  const prevEvOf = (f) => { let ev = ''; for (const d of done) if (d.id !== f.id && d.at <= (f.fired || f.at)) ev = d.ev; return ev; };
  const sevOf = (f, c, e) => Math.min(errInfo(e)[1], ...(Array.isArray(al) ? al : []).filter((a) => a && a.j === f.id && !a.x && (a.c + ':' + a.k) in KINDS).map((a) => a.s));
  for (const f of jobs) {
    const cur = out.filter((x) => x.j === f.id).pop();
    if (f.bad) {
      const [c] = errInfo(f.err);
      const reopen = cur && (cur.st === 'w' || ((cur.st === 'r' || cur.st === 'x') && f.fires > num(cur.fs)));
      if (cur && !reopen) {
        if (cur.st === 'o' && cur.e !== f.err && ERR_RE.test(f.err)) { cur.e = f.err; cur.c = c; cur.s = Math.min(cur.s, sevOf(f, c, f.err)); cur.l = now; changed = true; }
        continue;
      }
      const at = Math.min(now, f.at || now);
      const x = cur || { no: ++seq, j: f.id, f: at, n: 0, h: [] };
      Object.assign(x, { c, e: ERR_RE.test(f.err) ? f.err : 'worker', s: sevOf(f, c, f.err), st: 'o', by: '', l: now, rt: 0, n: num(x.n) + 1, fs: f.fires, ar: f.ar });
      hist(x, at, cur ? 'f' : 'o');
      if (!cur) out.push(x);
      changed = true;
      continue;
    }
    if (!cur || cur.st === 'r' || cur.st === 'x') continue;
    if (f.st === 'done') { cur.st = 'r'; cur.rt = Math.min(now, f.at || now); cur.l = now; if (!cur.by) cur.by = f.ar > num(cur.ar) ? 'c' : 'u'; hist(cur, cur.rt, 'r'); changed = true; continue; }
    if (f.st === 'cancelled') { cur.st = 'x'; cur.rt = Math.min(now, f.at || now); cur.l = now; hist(cur, cur.rt, 'x'); changed = true; continue; }
    if (cur.st === 'o' && (f.st === 'queued' || f.st === 'running') && f.fires > num(cur.fs)) {
      cur.st = 'w'; cur.by = f.ar > num(cur.ar) ? 'c' : 'u'; cur.l = now; hist(cur, Math.min(now, f.fired || now), cur.by === 'c' ? 'c' : 'w'); changed = true;
    }
  }
  // עבודה שנמחקה (לא ברשימה) — התקלה שלה נסגרת
  for (const x of out) if ((x.st === 'o' || x.st === 'w') && !byId.has(x.j)) { x.st = 'x'; x.rt = now; x.l = now; hist(x, now, 'x'); changed = true; }
  // השורש הסביר — מחושב מחדש לכל תקלה פתוחה (ההתראות וספר התיקונים מתעדכנים בזמן הטיפול)
  for (const x of out.filter((y) => y.st === 'o' || y.st === 'w')) {
    const f = byId.get(x.j);
    if (!f) continue;
    const others = out.filter((y) => y.j !== x.j && y.c === x.c && y.e === x.e && Math.abs(y.f - x.f) < DAY);
    const rc = rootCauses(x, f, al, others, prevEvOf(f), fb);
    if (JSON.stringify(rc) !== JSON.stringify(x.rc || [])) { x.rc = rc; changed = true; }
    const ev = rc.some((r) => r.t === 'env') ? 1 : 0;
    if (ev !== (x.ev || 0)) { x.ev = ev; changed = true; }
  }
  return changed ? out.sort((a, b) => a.no - b.no).slice(-INC_MAX) : null;
}
/* עבודה שנמחקה דרך "מחק" — סוגרים מיד (בלי לחכות לרשימה הבאה) */
function incCloseJob(inc, j, now) {
  const out = incList(inc, now).map((x) => Object.assign({}, x));
  let changed = false;
  for (const x of out) if (x.j === j && (x.st === 'o' || x.st === 'w')) { x.st = 'x'; x.rt = now; x.l = now; hist(x, now, 'x'); changed = true; }
  return changed ? out : null;
}

/* תקלה רחבה (Major Incident): אותו רכיב + קוד בשתי עבודות שונות תוך 24 שעות (ולפחות אחת עוד לא נפתרה),
   או התראה מ־WIDE_ALERTS פתוחה בשתי עבודות. mi = { no, c, e, at, x, n, h } — הנוכחית או האחרונה */
function majorSync(mi, inc, al, now) {
  const list = incList(inc, now);
  const cands = new Map();
  for (const x of list.filter((y) => now - y.f < DAY)) {
    const key = x.c + ':' + x.e;
    const g = cands.get(key) || { c: x.c, e: x.e, jobs: new Set(), live: false, at: Infinity };
    g.jobs.add(x.j); if (x.st === 'o' || x.st === 'w') g.live = true; g.at = Math.min(g.at, x.f);
    cands.set(key, g);
  }
  for (const a of (Array.isArray(al) ? al : []).filter((y) => y && !y.x && WIDE_ALERTS.includes(y.c + ':' + y.k) && JOB_RE.test(String(y.j || '')))) {
    const key = a.c + ':' + a.k;
    const g = cands.get(key) || { c: a.c, e: a.k, jobs: new Set(), live: true, at: Infinity };
    g.jobs.add(a.j); g.at = Math.min(g.at, a.f || now);
    cands.set(key, g);
  }
  const hit = Array.from(cands.values()).filter((g) => g.live && g.jobs.size >= 2).sort((a, b) => b.jobs.size - a.jobs.size || a.at - b.at)[0];
  const cur = mi && typeof mi === 'object' && Number.isInteger(mi.no) && COMPONENTS.includes(mi.c) && ERR_RE.test(String(mi.e || '')) ? Object.assign({}, mi) : null;
  const active = cur && !cur.x;
  if (hit) {
    if (active && cur.c === hit.c && cur.e === hit.e) {
      if (hit.jobs.size !== cur.n) { cur.n = hit.jobs.size; cur.l = now; return cur; }
      return null;
    }
    if (active) return null;   // תקלה רחבה אחת בכל רגע — השנייה תוכרז כשהראשונה תיסגר
    const no = (cur ? cur.no : 0) + 1;   // מונה נפרד (MAJ…) — לא מתנגש במספרי התקלות
    const m = { no, c: hit.c, e: hit.e, at: now, l: now, x: 0, n: hit.jobs.size, h: [] };
    hist(m, now, 'm');
    return m;
  }
  if (active && (!cands.has(cur.c + ':' + cur.e) || !cands.get(cur.c + ':' + cur.e).live || now - num(cur.l) > MAJOR_TTL)) {
    cur.x = now; hist(cur, now, 'r');
    return cur;
  }
  return null;
}
const majorActive = (mi) => !!(mi && typeof mi === 'object' && mi.at && !mi.x);
/* התקלות שבתקלה הרחבה — מקבלות P1 ושורת "m" בציר */
function majorMark(inc, mi, now) {
  if (!majorActive(mi)) return null;
  const out = incList(inc, now).map((x) => Object.assign({}, x));
  let changed = false;
  for (const x of out) if ((x.st === 'o' || x.st === 'w') && x.c === mi.c && x.e === mi.e && !x.m) { x.m = mi.no; x.s = 1; hist(x, now, 'm'); changed = true; }
  return changed ? out : null;
}

/* מה הטלפון רואה: התקלות (פתוחות ובטיפול קודם, אחר כך האחרונות), לכל אחת "קרה כבר" (התקלה הדומה האחרונה שנפתרה),
   והציר — הציר של התקלה + ההתראות של אותה עבודה (מתי כל אחת נפתחה), בלי שום אחסון נוסף */
function incView(inc, mi, al, now) {
  const list = incList(inc, now);
  const alerts = Array.isArray(al) ? al.filter((a) => a && (a.c + ':' + a.k) in KINDS) : [];
  const rank = (x) => (x.st === 'o' ? 0 : x.st === 'w' ? 1 : 2);
  const shown = list.slice().sort((a, b) => rank(a) - rank(b) || a.s - b.s || b.l - a.l).slice(0, 20);
  const items = shown.map((x) => {
    const sim = list.filter((y) => y.no !== x.no && y.e === x.e && y.c === x.c && y.st === 'r' && y.f < x.f).pop();
    const tl = (Array.isArray(x.h) ? x.h : []).filter((e) => Array.isArray(e) && typeof e[0] === 'number' && H_CODES.includes(e[1])).map((e) => [e[0], e[1]]);
    for (const a of alerts.filter((y) => y.j === x.j)) {
      tl.push([a.f, 'a', a.c, a.k, a.no || 0]);
      if (a.x) tl.push([a.x, 'k', a.c, a.k, a.no || 0]);
    }
    tl.sort((p, q) => p[0] - q[0]);
    return { no: x.no, j: x.j, c: x.c, e: x.e, s: x.s, st: x.st, by: x.by || '', f: x.f, l: x.l, rt: x.rt || 0, n: x.n || 1, m: x.m || 0, ev: x.ev || 0,
      rc: Array.isArray(x.rc) ? x.rc : [], tl: tl.slice(-24),
      sim: sim ? { no: sim.no, f: sim.f, by: sim.by || '', min: Math.max(1, Math.round((sim.rt - sim.f) / 60e3)) } : null,
      al: alerts.filter((y) => y.j === x.j && y.no).map((y) => ({ no: y.no, c: y.c, k: y.k, s: y.s, x: y.x ? 1 : 0 })).slice(-8) };
  });
  const m = mi && typeof mi === 'object' && mi.at && (!mi.x || now - mi.x < DAY) ? { no: mi.no, c: mi.c, e: mi.e, at: mi.at, x: mi.x || 0, n: mi.n || 0 } : null;
  return { list: items, open: list.filter((x) => x.st === 'o' || x.st === 'w').length, mi: m };
}
/* מפה קצרה עבודה → התקלה שלה (לדף העבודה ולרשימה) */
function incByJob(inc, now) {
  const out = {};
  for (const x of incList(inc, now)) out[x.j] = { no: x.no, s: x.s, st: x.st };
  return out;
}

module.exports = { INC_MAX, ERR_INFO, WIDE_ALERTS, MAJOR_TTL, H_CODES, errInfo, jobFacts, rootCauses, incSync, incCloseJob, majorSync, majorActive, majorMark, incView, incByJob };
