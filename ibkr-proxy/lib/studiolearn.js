'use strict';
const { impactView } = require('./learnimpact');
/* מאגר הלמידה של סטודיו התרגום (14/10/2026, בקשת המשתמש: "החלק הכי חשוב — לשפר כל הזמן יכולות, יעילות, איכות וחיסכון בטוקנים").
   טהור, בלי קריאות. שלושה חלקים:
   1. normLx — העובדות שהעובד שולח בסוף כל הפעלה (job.py learn_facts): רק מספרים וקודים בצורה קבועה, בלי טקסט.
   2. learnRec — רשומה אנונימית לכל עבודה (studioLearn/{מזהה}): בלי uid, בלי שמות קבצים/תיקיות/סשנים, בלי טקסט חופשי
      (מונחים, הערות, שאלות, תיקונים — רק כמה). המזהה = sha256 של מזהה העבודה (אקראי) — רק לכפילויות; לא מקשר למשתמש.
      הרשומה נשארת גם אחרי שהעבודה נמחקה מהסטודיו — זה הזיכרון הארוך של המערכת.
   3. learnView — לוח הבקרה של המנהל: מדדים עיקריים מול התקופה הקודמת, לאן הולכים הכסף, הזמן והטוקנים, איכות, כשלים,
      השוואת מצבים, והמסקנות — מדורגות לפי ההשפעה (כמה דולר בחודש / כמה נקודות איכות), כל אחת עם פעולה מוצעת. */
const crypto = require('crypto');

const LR_V = 1;
const STAGES = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];
const ROLES = ['main', 'tl', 'rv', 'jg', 'sub'];
const Q_KEYS = ['cps', 'len', 'lines', 'dur', 'en', 'chk'];
const JG_CODES = ['mean', 'omit', 'add', 'gram', 'flu', 'term'];
const MX_GROUPS = ['st', 'tm', 'cs', 'om'];                // st שלבים · tm תזמון · cs עקביות · om השמטות
const MODES = ['haiku-medium', 'haiku-high', 'sonnet-low', 'sonnet-medium', 'sonnet-high', 'opus-medium'];   // מהזול ליקר
const DAY = 86400e3, WIN = 30 * DAY;
const KEY_RE = /^[a-z][a-z0-9_.]{0,47}$/;
const CODE_RE = /^[a-z][a-z0-9_]{0,39}$/;
const WHERE_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39} @ [a-z_][a-z0-9_]{0,30}\.py:\d{1,6}( [A-Za-z_][A-Za-z0-9_]{0,39})?$/;   // = lib/studio.js
const CMD_RE = /^[a-z][a-z_-]{1,19}$/;
const MODEL_RE = /^claude-[a-z0-9-]{1,50}$/;

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r4 = (v) => Math.round(v * 1e4) / 1e4;
const clampNum = (v, hi) => (isNum(v) && Math.abs(v) <= (hi || 1e12) ? r4(v) : typeof v === 'boolean' ? (v ? 1 : 0) : null);
const lid = (jobId) => crypto.createHash('sha256').update('snb-learn|' + String(jobId || '')).digest('hex').slice(0, 20);
const hour = (t) => (isNum(t) && t > 0 ? Math.floor(t / 3600e3) * 3600e3 : 0);

/* ---------------- 1. העובדות מהעובד ---------------- */
/* מילון שטוח של מספרים (מפתח בצורה קבועה) — כל ערך שאינו מספר / בוליאני נזרק בשקט */
function flatNums(o, max, hi) {
  const out = {};
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  for (const [k, v] of Object.entries(o)) {
    if (Object.keys(out).length >= max) break;
    if (!KEY_RE.test(k)) continue;
    const x = clampNum(v, hi);
    if (x != null) out[k] = x;
  }
  return out;
}
const numArr = (a, n) => (Array.isArray(a) && a.length <= n && a.every(isNum) ? a.map(r4) : null);
function normLx(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out = { v: 1 };
  if (o.env && typeof o.env === 'object') {
    const e = {};
    if (isNum(o.env.cpus) && o.env.cpus >= 0 && o.env.cpus <= 1024) e.cpus = Math.round(o.env.cpus);
    if (/^[a-z0-9_]{1,16}$/.test(String(o.env.arch || ''))) e.arch = o.env.arch;
    if (o.env.gv != null) e.gv = o.env.gv ? 1 : 0;
    if (isNum(o.env.mem) && o.env.mem > 0 && o.env.mem < 1e7) e.mem = Math.round(o.env.mem);   // MB
    // 21/10/2026: גרסת התמונה והספריות (anthropic / onnxruntime / httpx) — כדי לייחס שינוי בהתנהגות לגרסה
    if (/^[0-9a-f]{7,12}$/.test(String(o.env.img || ''))) e.img = o.env.img;
    for (const k of ['an', 'ort', 'hx']) if (/^[0-9][0-9a-z.+-]{0,19}$/.test(String(o.env[k] || ''))) e[k] = o.env[k];
    if (Object.keys(e).length) out.env = e;
  }
  if (o.vid && typeof o.vid === 'object') {                                           // 20/10/2026: רזולוציה, פריימים, קצב — לצפי הצריבה
    const v = {};
    for (const [k, hi] of [['w', 16384], ['h', 16384], ['fps', 480], ['kb', 1e6]]) if (isNum(o.vid[k]) && o.vid[k] > 0 && o.vid[k] <= hi) v[k] = k === 'fps' ? r4(o.vid[k]) : Math.round(o.vid[k]);
    if (Object.keys(v).length) out.vid = v;
  }
  const ps = flatNums(o.ps, 90); if (Object.keys(ps).length) out.ps = ps;            // מה ש־vt רשם לכל שלב (project.json)
  if (Array.isArray(o.vt)) {                                                            // זמן לכל פקודת vt: [פקודה, פעמים, שניות, הארוכה]
    const vt = [];
    for (const x of o.vt.slice(0, 30)) {
      if (!Array.isArray(x) || !CMD_RE.test(String(x[0] || ''))) continue;
      const nums = x.slice(1, 4);
      if (nums.length === 3 && nums.every((v) => isNum(v) && v >= 0 && v < 1e7)) vt.push([x[0], Math.round(nums[0]), r4(nums[1]), r4(nums[2])]);
    }
    if (vt.length) out.vt = vt;
  }
  if (o.cu && typeof o.cu === 'object') {                                               // התפלגות הכתוביות הסופיות (בלי טקסט)
    const cu = flatNums(o.cu, 30, 1e7);
    for (const k of ['cps', 'ch', 'du', 'gp', 'ln']) { const a = numArr(o.cu[k], 6); if (a) cu[k] = a; }
    const fl = flatNums(o.cu.fl, 20, 1e7); if (Object.keys(fl).length) cu.fl = fl;
    if (Object.keys(cu).length) out.cu = cu;
  }
  if (o.mx && typeof o.mx === 'object' && !Array.isArray(o.mx)) {                      // מ׳5: המדדים בקוד (translator/learnmetrics.py)
    const mx = {};
    for (const g of MX_GROUPS) { const x = flatNums(o.mx[g], 30, 1e7); if (Object.keys(x).length) mx[g] = x; }
    if (Object.keys(mx).length) out.mx = mx;
  }
  for (const k of ['wd', 'tl', 'en', 'sy', 'gl', 'md']) {
    if (!o[k] || typeof o[k] !== 'object') continue;
    const x = flatNums(o[k], 30, 1e12);
    if (k === 'en' && o.en.th && typeof o.en.th === 'object') { const th = flatNums(o.en.th, 8, 1e12); if (Object.keys(th).length) x.th = th; }
    if (Object.keys(x).length) out[k] = x;
  }
  return JSON.stringify(out).length <= 16000 ? out : Object.assign({}, out, { ps: undefined, vt: undefined });
}

/* ---------------- 1ב. מה קרה אחרי העבודה (מ׳3, 15/10/2026) — מהטלפון, מספרים בלבד ----------------
   e = עריכות בעורך הכתוביות (s שמירות, ws שניות עבודה פעילה, n שינויים, cd/wd מרחק עריכה בתווים/במילים, m שינויי טקסט שגם
       הזמן שלהם זז, wa/ca מילים/תווים בגרסה האחרונה — המכנה של HTER, ולכל סוג: txt tm sp mg add del mx;
       מ׳5: sb עריכות SubER — גם שבירות וזמנים, sr אסימוני הייחוס בגרסה האחרונה — המכנה)
   pl = הנגן (n הפעלות, sec שניות צפייה, cov החלק הגדול ביותר של הסרטון שנצפה — 0 עד 1)
   o = תוצרים (dl הורדות, sh שיתופים, dx שמירה בתיקייה ב־Drive) · sg = הצעות (a התקבלו, r נדחו)
   ai = גיליון ה־AI (q בקשות, a שינויים שהוחלו, r שנדחו) · gl = מונחים שנוספו למילון מתוך העבודה (a)
   הטלפון שולח תוספת (delta); המיזוג מחבר, חוץ מ־cov (המקסימום) ו־wa/ca (האחרון). **UX_SHAPE זהה ל־UX_SHAPE ב־studio.js** */
const ED_KINDS = ['txt', 'tm', 'sp', 'mg', 'add', 'del', 'mx'];
const UX_SHAPE = { e: ['s', 'ws', 'n', 'cd', 'wd', 'm', 'wa', 'ca', 'sb', 'sr'].concat(ED_KINDS), pl: ['n', 'sec', 'cov'], o: ['dl', 'sh', 'dx'], sg: ['a', 'r'], ai: ['q', 'a', 'r'], gl: ['a'] };
const UX_LAST = ['wa', 'ca', 'sr'], UX_HI = 1e7;
function normUx(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out = {};
  for (const [g, keys] of Object.entries(UX_SHAPE)) {
    const x = o[g];
    if (!x || typeof x !== 'object' || Array.isArray(x)) continue;
    const y = {};
    for (const k of keys) {
      const v = x[k];
      if (!isNum(v) || v < 0 || v > UX_HI) continue;
      y[k] = k === 'cov' ? Math.min(1, r4(v)) : Math.round(v);
    }
    if (Object.keys(y).length) out[g] = y;
  }
  return Object.keys(out).length ? out : null;
}
function mergeUx(cur, add) {
  const a = normUx(add);
  if (!a) return normUx(cur);
  const out = normUx(cur) || {};
  for (const [g, x] of Object.entries(a)) {
    const y = out[g] || (out[g] = {});
    for (const [k, v] of Object.entries(x)) y[k] = k === 'cov' ? Math.max(y[k] || 0, v) : UX_LAST.includes(k) ? v : Math.min(UX_HI, (y[k] || 0) + v);
  }
  return out;
}

/* ---------------- 2. רשומה לכל עבודה ---------------- */
const STATES = ['new', 'queued', 'running', 'done', 'failed', 'cancelled'];
function effBasic(job, now, effState) {
  const e = typeof effState === 'function' ? effState(job, now) : { state: job.state, err: job.err || '' };
  return { st: STATES.includes(e.state) ? e.state : 'failed', err: CODE_RE.test(String(e.err || '')) ? e.err : '' };
}
function useRows(use) {
  const out = [];
  for (const r of Array.isArray(use) ? use.slice(0, 6) : []) {
    if (!r || !ROLES.includes(r.k) || !MODEL_RE.test(String(r.m || ''))) continue;
    const row = { k: r.k, m: r.m };
    for (const f of ['n', 'i', 'o', 'cr', 'c5', 'c1', 'op']) if (isNum(r[f]) && r[f] >= 0) row[f] = Math.round(r[f]);
    for (const f of ['usd', 'oc']) if (isNum(r[f]) && r[f] >= 0) row[f] = r4(r[f]); else if (r[f] === null) row[f] = null;
    out.push(row);
  }
  return out;
}
const usdSum = (rows) => r4(rows.reduce((s, r) => s + (isNum(r.usd) ? r.usd : 0), 0));
const priced = (rows) => rows.length > 0 && rows.every((r) => isNum(r.usd));
function stageSecs(prog) {
  // 21/10/2026: כולל את הזמן שנצבר בשלב לפני "המשך" (a) — כמו stgSpent ב־lib/studio.js
  const out = {}, stg = (prog && prog.stg) || {};
  for (const k of STAGES) {
    const x = stg[k];
    if (!x) continue;
    const ms = (isNum(x.a) ? x.a : 0) + (x.s > 0 && x.e > x.s ? x.e - x.s : 0);
    if (ms > 0) out[k] = Math.round(ms / 1000);
  }
  return out;
}
function edlInfo(e, dur) {
  if (!e || typeof e !== 'object') return null;
  const k = Array.isArray(e.k) ? e.k : [];
  const kept = k.reduce((s, x) => s + (Array.isArray(x) && isNum(x[0]) && isNum(x[1]) ? Math.max(0, x[1] - x[0]) : 0), 0);
  const o = { n: k.length, ar: typeof e.ar === 'string' ? e.ar.slice(0, 5) : 'src' };
  if (dur > 0 && kept > 0) o.kf = r4(Math.min(1, kept / dur));
  const fx = Object.keys(e).filter((x) => x !== 'k' && x !== 'ar' && /^[a-z]{1,3}$/.test(x)).sort();
  if (fx.length) o.fx = fx;
  return o;
}
function judgeInfo(jd) {
  if (!jd || !isNum(jd.s)) return null;
  const c = {};
  for (const k of JG_CODES) if (jd.c && isNum(jd.c[k])) c[k] = jd.c[k];
  return { s: jd.s, n: jd.n || 0, c };
}
function qualityInfo(q) {
  if (!q || !isNum(q.s)) return null;
  const b = {};
  for (const m of Array.isArray(q.m) ? q.m : []) if (m && Q_KEYS.includes(m.k) && isNum(m.b)) b[m.k] = m.b;
  return { s: q.s, n: q.n || 0, b };
}
function traceInfo(tr) {
  if (!tr || !tr.a) return null;
  const a = {};
  for (const [k, v] of Object.entries(tr.a)) if (ROLES.includes(k) && v) a[k] = { n: v.n || 0, e: v.e || 0, s: v.s || 0, ...(isNum(v.w) ? { w: v.w } : {}) };
  const g = (Array.isArray(tr.g) ? tr.g : []).filter((x) => Array.isArray(x) && /^[A-Za-z:_-]{1,30}$/.test(String(x[0]))).slice(0, 8).map((x) => [x[0], x[1] || 0, x[2] || 0]);
  return { a, g };
}
function errHist(eh) {
  return (Array.isArray(eh) ? eh : []).filter((x) => x && CODE_RE.test(String(x.e || ''))).slice(-10)
    .map((x) => Object.assign({ e: x.e, s: STAGES.includes(x.s) ? x.s : '', t: hour(x.at) }, WHERE_RE.test(String(x.w || '')) ? { w: x.w } : {}));   // 20/10/2026: איפה קרס
}
/* job = מסמך העבודה כמו שהוא בשרתון; effState = S.effState (מוזרק — כדי שהקובץ לא יהיה תלוי ב־studio.js) */
function learnRec(job, now, effState) {
  if (!job || !/^j[A-Za-z0-9_-]{20}$/.test(String(job.id || '')) || !['tr', 'rr', 'ai'].includes(job.kind)) return null;
  const sp = job.spec || {};
  const e = effBasic(job, now, effState);
  const use = useRows(Array.isArray(job.use) && job.use.length ? job.use : job.use0);
  const dur = isNum(sp.dur) ? Math.round(sp.dur) : 0;
  const rec = {
    v: LR_V, id: lid(job.id), k: job.kind,
    pid: /^j[A-Za-z0-9_-]{20}$/.test(String(job.rp || job.gs || '')) ? lid(job.rp || job.gs) : '',
    gold: job.gs ? 1 : 0,
    at: hour(job.created), end: hour(job.ended),
    st: e.st, err: e.err,
    eng: job.eng === 'api' || sp.eng === 'api' ? 'api' : 'sub', cp: sp.cp === 1 ? 1 : 0,
    mode: MODES.includes(sp.mode) ? sp.mode : String(sp.mode || '').replace(/[^a-z0-9-]/g, '').slice(0, 20),
    from: /^[a-z]{2,4}$/.test(String(sp.from || '')) ? sp.from : 'auto', to: Array.isArray(sp.to) ? sp.to.filter((x) => /^[a-z]{2,3}$/.test(x)).slice(0, 12) : [],
    dur, mb: isNum(sp.size) ? Math.round(sp.size / 1048576) : 0, type: /^[a-z0-9.+/-]{1,40}$/.test(String(sp.type || '')) ? sp.type : '',
    out: Array.isArray(sp.out) ? sp.out.filter((x) => /^[a-z]{2,10}$/.test(x)).slice(0, 6) : [], style: /^[a-z]{2,12}$/.test(String(sp.style || '')) ? sp.style : '',
    terms: String(sp.terms || '').split(/\n|,/).filter((x) => x.trim()).length,   // כמה מונחים — לא המונחים עצמם
    edl: edlInfo(sp.edl, dur),
    src: job.fa && job.fa.id ? 'a' : 'v', ext: job.fv && job.fv.ext ? 1 : 0, r2: /^R2_/.test(String(job.folder || '')) ? 1 : 0,
    fires: job.fires || 0, ar: job.ar || 0, eh: errHist(job.eh),
    t: {
      q: job.claimed && job.fired && job.claimed >= job.fired ? Math.round((job.claimed - job.fired) / 1000) : null,   // מההפעלה עד שנלקחה
      run: job.ended && (job.c0 || job.claimed) && job.ended > (job.c0 || job.claimed) ? Math.round((job.ended - (job.c0 || job.claimed)) / 1000) : null,
      pz: isNum(job.pz) ? Math.round(job.pz / 1000) : 0,                                 // השעון עצר — חיכינו לך / לסרטון
      s: stageSecs(job.prog),
    },
    ep: job.ep && isNum(job.ep.t) ? { t: Math.round(job.ep.t), n: job.ep.n || 0 } : null,
    tg: job.tg && isNum(job.tg.t) ? { t: Math.round(job.tg.t), u: isNum(job.tg.u) ? r4(job.tg.u) : null } : null,
    use, usd: usdSum(use), pr: priced(use) ? 1 : 0,
    tr: traceInfo(job.tr), q: qualityInfo(job.q), jd: judgeInfo(job.jd),
    tw: job.tw && job.tw.lv ? { lv: job.tw.lv, why: CODE_RE.test(String(job.tw.why || '')) ? job.tw.why : '', x: isNum(job.tw.x) ? r4(job.tw.x) : null, sh: job.tw.sh ? 1 : 0 } : null,
    ij: job.ij && isNum(job.ij.n) ? job.ij.n : 0,
    gl: job.gl ? { u: job.gl.u || 0, s: Array.isArray(job.gl.s) ? job.gl.s.length : 0 } : null,
    rvf: Array.isArray(job.rvf) ? job.rvf.length : 0, fil: Array.isArray(job.fil) ? job.fil.length : 0,   // סימונים מהביקורת, מילות מילוי — רק כמה
    qn: job.qn || 0, gn: job.gn || 0, nn: Array.isArray(job.nh) ? job.nh.length : 0,
    ed: Array.isArray(job.vh) ? job.vh.length : 0,                                       // כמה פעמים נשמרה עריכה של הכתוביות אחרי העבודה
    gq: job.gq && isNum(job.gq.s) ? { s: r4(job.gq.s), tm: isNum(job.gq.tm) ? r4(job.gq.tm) : null } : null,
    hl: Array.isArray(job.hl) ? job.hl.length : 0,
    env: /^[0-9a-f]{12}$/.test(String(job.ev || '')) ? job.ev : '',
    pv: job.pv && typeof job.pv === 'object' ? Object.fromEntries(Object.entries(job.pv).filter(([k, v]) => /^[a-z]{2,4}$/.test(k) && /^[0-9a-f]{8}$/.test(String(v)))) : null,
    lx: normLx(job.lx),
    ux: normUx(job.ux),
    // 21/10/2026: מדידת ההעלאה מהטלפון (חילוץ, העלאה, זמן ברקע — op upTel, כבר מנורמל בכתיבה): רק מספרים
    ut: job.utl && typeof job.utl === 'object' && !Array.isArray(job.utl) ? Object.fromEntries(Object.entries(job.utl).filter(([k, v]) => /^[a-z0-9]{1,4}$/.test(k) && isNum(v))) : null,
  };
  return rec;
}
/* טביעה — כתיבה רק כשמשהו השתנה */
const recHash = (rec) => crypto.createHash('sha1').update(JSON.stringify(rec)).digest('hex').slice(0, 16);

/* ---------------- 3. לוח הבקרה ---------------- */
const median = (a) => { const s = a.filter(isNum).sort((x, y) => x - y); if (!s.length) return null; const k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
const mean = (a) => { const s = a.filter(isNum); return s.length ? s.reduce((x, y) => x + y, 0) / s.length : null; };
const sum = (a) => a.filter(isNum).reduce((x, y) => x + y, 0);
const rnd = (v, d) => (isNum(v) ? Math.round(v * Math.pow(10, d || 0)) / Math.pow(10, d || 0) : null);
const mins = (r) => (r.dur > 0 ? r.dur / 60 : 0);
const runSec = (r) => (isNum(r.t && r.t.run) ? Math.max(0, r.t.run - (r.t.pz || 0)) : null);   // זמן עבודה, בלי ההמתנה לך
const tokOf = (r) => r.use.reduce((s, u) => ({ i: s.i + (u.i || 0), o: s.o + (u.o || 0), cr: s.cr + (u.cr || 0), cw: s.cw + (u.c5 || 0) + (u.c1 || 0) }), { i: 0, o: 0, cr: 0, cw: 0 });
const inTok = (t) => t.i + t.cr + t.cw;
const okFirst = (r) => r.st === 'done' && (r.fires || 0) <= 1 + (r.ar || 0);
/* עלות קלט "מלא" שאפשר היה לקרוא מהמטמון: הקלט שלא מהמטמון × 90% (קריאה = 10% מהמחיר). חלק הקלט מתוך העלות לפי
   המשקלים היחסיים של Claude (פלט ×5, קריאה ×0.1, כתיבה ×1.25) — אומדן, מסומן ≈ */
function cacheSavable(u) {
  const w = (u.i || 0) + 5 * (u.o || 0) + 0.1 * (u.cr || 0) + 1.25 * ((u.c5 || 0) + (u.c1 || 0));
  return w > 0 && isNum(u.usd) ? u.usd * ((u.i || 0) / w) * 0.9 : 0;
}
function kpis(rs) {
  const tr = rs.filter((r) => r.k === 'tr' && !r.gold);
  const fin = tr.filter((r) => r.st === 'done' || r.st === 'failed');
  const done = tr.filter((r) => r.st === 'done');
  const pr = done.filter((r) => r.pr && r.dur > 0);
  const m = sum(pr.map(mins));
  const tk = pr.map(tokOf), tin = sum(tk.map(inTok));
  const timed = done.filter((r) => runSec(r) != null && r.dur > 0);
  return {
    n: tr.length, done: done.length, fin: fin.length,
    min: rnd(sum(done.map(mins)), 1),
    cpm: m > 0 ? rnd(sum(pr.map((r) => r.usd)) / m, 4) : null,                     // דולר לדקת סרטון
    spm: timed.length ? rnd(median(timed.map((r) => runSec(r) / mins(r))), 1) : null, // שניות עבודה לדקת סרטון (חציון)
    tpm: m > 0 ? Math.round(sum(tk.map((t) => inTok(t) + t.o)) / m) : null,           // טוקנים לדקת סרטון
    ch: tin > 0 ? rnd(sum(tk.map((t) => t.cr)) / tin, 3) : null,                      // חלק הקלט שנקרא מהמטמון
    q: rnd(mean(done.map((r) => r.q && r.q.s)), 1),                                    // מדד האיכות (0–100)
    jd: rnd(mean(done.map((r) => r.jd && r.jd.s)), 1),                                 // ציון השופט (0–100)
    ok: fin.length ? rnd(fin.filter(okFirst).length / fin.length, 3) : null,           // הצלחה בלי "המשך" ידני
    usd: rnd(sum(tr.map((r) => r.usd)), 2),
    ...uxKpis(done),
  };
}
/* מ׳3: מה קרה אחרי העבודה. ht = שיעור העריכה (HTER: מילים שתוקנו ÷ מילים בגרסה האחרונה) על העבודות שנערכו ונשמרו;
   sb = SubER (מ׳5 — כמו HTER, אבל גם שבירות שורה/כתובית וזמנים); edr = חלק העבודות שנערכו; cov = חציון החלק שנצפה בנגן (מהעבודות שנצפו); sga = חלק ההצעות שהתקבלו */
function uxKpis(done) {
  const ed = done.filter((r) => r.ux && r.ux.e && r.ux.e.s > 0 && r.ux.e.wa > 0);
  const pl = done.filter((r) => r.ux && r.ux.pl && r.ux.pl.n > 0);
  const sg = done.map((r) => (r.ux && r.ux.sg) || {}), sga = sum(sg.map((x) => x.a)), sgr = sum(sg.map((x) => x.r));
  return {
    ht: ed.length ? rnd(sum(ed.map((r) => r.ux.e.wd)) / sum(ed.map((r) => r.ux.e.wa)), 3) : null,
    sb: (() => { const x = ed.filter((r) => r.ux.e.sr > 0); return x.length ? rnd(sum(x.map((r) => r.ux.e.sb || 0)) / sum(x.map((r) => r.ux.e.sr)), 3) : null; })(),   // מ׳5: SubER
    edr: done.length ? rnd(ed.length / done.length, 3) : null,
    cov: pl.length ? rnd(median(pl.map((r) => r.ux.pl.cov)), 3) : null,
    sga: sga + sgr > 0 ? rnd(sga / (sga + sgr), 3) : null,
  };
}
/* סיכום לכל סוג פעולה אחרי העבודה (90 יום) — לניתוח */
function uxSum(rs) {
  const out = {};
  for (const r of rs) {
    if (!r.ux) continue;
    for (const [g, x] of Object.entries(r.ux)) { const y = out[g] || (out[g] = { jobs: 0 }); y.jobs++; for (const [k, v] of Object.entries(x)) if (k !== 'cov') y[k] = (y[k] || 0) + v; }
  }
  return out;
}
function weekly(rs, now, n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const a = now - (i + 1) * 7 * DAY, b = now - i * 7 * DAY;
    const k = kpis(rs.filter((r) => r.at >= a && r.at < b));
    out.push({ cpm: k.cpm, q: k.q, jd: k.jd, spm: k.spm, ok: k.ok, n: k.n });
  }
  return out;
}
function costRoles(rs) {
  const by = {};
  for (const r of rs) for (const u of r.use) {
    const x = by[u.k] = by[u.k] || { k: u.k, usd: 0, i: 0, o: 0, cr: 0, cw: 0, n: 0, sav: 0, models: {} };
    x.usd += isNum(u.usd) ? u.usd : 0; x.i += u.i || 0; x.o += u.o || 0; x.cr += u.cr || 0; x.cw += (u.c5 || 0) + (u.c1 || 0); x.n += u.n || 0;
    x.sav += cacheSavable(u); x.models[u.m] = (x.models[u.m] || 0) + (isNum(u.usd) ? u.usd : 0);
  }
  const tot = sum(Object.values(by).map((x) => x.usd));
  return Object.values(by).map((x) => ({ k: x.k, usd: rnd(x.usd, 4), sh: tot > 0 ? rnd(x.usd / tot, 3) : 0, calls: x.n,
    tok: { i: x.i, o: x.o, cr: x.cr, cw: x.cw }, ch: x.i + x.cr + x.cw > 0 ? rnd(x.cr / (x.i + x.cr + x.cw), 3) : null, sav: rnd(x.sav, 4),
    m: Object.entries(x.models).sort((a, b) => b[1] - a[1]).map((e) => e[0])[0] || '' })).sort((a, b) => b.usd - a.usd);
}
function stageTime(rs) {
  const by = {};
  let tot = 0;
  for (const r of rs) for (const [k, v] of Object.entries(r.t.s || {})) { by[k] = (by[k] || 0) + v; tot += v; }
  const per = (k) => median(rs.filter((r) => r.dur > 0 && r.t.s && isNum(r.t.s[k])).map((r) => r.t.s[k] / mins(r)));
  return STAGES.filter((k) => by[k]).map((k) => ({ k, sec: Math.round(by[k]), sh: tot ? rnd(by[k] / tot, 3) : 0, spm: rnd(per(k), 1) }));
}
function vtTime(rs) {
  const by = {};
  for (const r of rs) for (const x of (r.lx && r.lx.vt) || []) { const o = by[x[0]] = by[x[0]] || { c: x[0], n: 0, sec: 0, mx: 0 }; o.n += x[1]; o.sec += x[2]; o.mx = Math.max(o.mx, x[3]); }
  const tot = sum(Object.values(by).map((x) => x.sec));
  return Object.values(by).sort((a, b) => b.sec - a.sec).slice(0, 8).map((x) => ({ c: x.c, n: x.n, sec: Math.round(x.sec), mx: rnd(x.mx, 1), sh: tot ? rnd(x.sec / tot, 3) : 0 }));
}
function failures(rs) {
  const by = {};
  const add = (code, st, usd, final) => { const o = by[code] = by[code] || { e: code, n: 0, fin: 0, usd: 0, st: {} }; o.n++; if (final) o.fin++; o.usd += usd || 0; if (st) o.st[st] = (o.st[st] || 0) + 1; };
  for (const r of rs.filter((x) => x.k === 'tr')) {
    const seen = new Set();
    for (const x of r.eh || []) { add(x.e, x.s, 0, false); seen.add(x.e); }
    if (r.st === 'failed' && r.err) { if (!seen.has(r.err)) add(r.err, '', r.usd, true); else { by[r.err].fin++; by[r.err].usd += r.usd; } }
  }
  return Object.values(by).sort((a, b) => b.n - a.n || b.usd - a.usd).slice(0, 10)
    .map((x) => ({ e: x.e, n: x.n, fin: x.fin, usd: rnd(x.usd, 2), st: Object.entries(x.st).sort((a, b) => b[1] - a[1]).map((y) => y[0])[0] || '' }));
}
function judgeCodes(rs) {
  const c = {}; let n = 0;
  for (const r of rs) if (r.jd) { n += r.jd.n || 0; for (const [k, v] of Object.entries(r.jd.c || {})) c[k] = (c[k] || 0) + v; }
  return { n, c: JG_CODES.filter((k) => c[k]).map((k) => ({ k, n: c[k], sh: n ? rnd(c[k] / n, 3) : 0 })).sort((a, b) => b.n - a.n) };
}
function qualityFails(rs) {
  const b = {}; let n = 0;
  for (const r of rs) if (r.q && r.q.n) { n += r.q.n; for (const [k, v] of Object.entries(r.q.b || {})) if (k !== 'chk') b[k] = (b[k] || 0) + v; }
  return { n, m: Q_KEYS.filter((k) => k !== 'chk').map((k) => ({ k, b: b[k] || 0, sh: n ? rnd((b[k] || 0) / n, 4) : 0 })).sort((x, y) => y.sh - x.sh) };
}
/* מ׳5: המדדים בקוד מכל העבודות שהסתיימו (lx.mx) — יחסים מצרפיים: מה כל שלב שינה (ch = חלק הכתוביות ששונו, t TER,
   c chrF++, ממוצע משוקלל במספר הכתוביות), תזמון מול הדיבור, עקביות והשמטות */
const MX_PAIRS = ['df', 'fr', 'rz', 'dz'];
function mxView(rs) {
  const xs = rs.filter((r) => r.k === 'tr' && r.st === 'done' && r.lx && r.lx.mx).map((r) => r.lx.mx);
  if (!xs.length) return null;
  const g = (k) => xs.map((x) => x[k]).filter(Boolean);
  const share = (a, b) => (b > 0 ? rnd(a / b, 4) : null);
  const st = g('st').filter((x) => x.n > 0), n = sum(st.map((x) => x.n));
  const wavg = (k) => { const w = st.filter((x) => isNum(x[k])); const d = sum(w.map((x) => x.n)); return d ? rnd(sum(w.map((x) => x[k] * x.n)) / d, 2) : null; };
  const out = { n: xs.length, st: { n } };
  for (const p of MX_PAIRS) out.st[p] = { ch: share(sum(st.map((x) => x[p + '.ch'])), n), t: wavg(p + '.t'), c: wavg(p + '.c') };
  const tm = g('tm').filter((x) => x.n > 0), tn = sum(tm.map((x) => x.n)), sp = sum(tm.map((x) => x.n - (x.nw || 0)));
  const sh = tm.filter((x) => isNum(x['sh.near']));
  out.tm = { n: tn, late: share(sum(tm.map((x) => x.late)), sp), cut: share(sum(tm.map((x) => x.cut)), sp), nw: share(sum(tm.map((x) => x.nw)), tn),
    in: rnd(median(tm.map((x) => x['in.p50'])), 3), out: rnd(median(tm.map((x) => x['out.p50'])), 3),
    shb: sh.length ? share(sum(sh.map((x) => x['sh.bad'])), 2 * sum(sh.map((x) => x.n))) : null };
  const cs = g('cs'), nmn = sum(cs.map((x) => x['nm.n'])), gln = sum(cs.map((x) => x['gl.n']));
  out.cs = { nm: nmn, nmv: share(sum(cs.map((x) => x['nm.var'])), nmn), gl: gln, glm: share(sum(cs.map((x) => x['gl.miss'])), gln), glx: sum(cs.map((x) => x['gl.mix'])) };
  const om = g('om'), numn = sum(om.map((x) => x['num.n']));
  out.om = { e: share(sum(om.map((x) => x['om.e'])), n), s: share(sum(om.map((x) => x['om.s'])), n), num: numn, numm: share(sum(om.map((x) => x['num.miss'])), numn),
    r50: rnd(median(om.map((x) => x['om.r50'])), 3) };
  return out;
}
function modeTable(rs) {
  return MODES.map((m) => ({ m, ...kpis(rs.filter((r) => r.mode === m)) })).filter((x) => x.n > 0);
}
/* מנוע מסקנות — כל מסקנה: k (קוד), sev 1 דחוף / 2 חשוב / 3 שווה בדיקה, imp = ההשפעה המשוערת בדולר לחודש (או 0), v = המספרים.
   הדירוג: קודם חומרה, אחר כך השפעה. הטלפון בונה את הטקסט מהקוד (בשתי השפות) */
/* ---------------- מ׳7 (20/10/2026): הלולאה — לפני ואחרי לכל גרסה ----------------
   כל עבודה נושאת את גרסת הקוד של העובד (env) ואת גרסת ההנחיות של כל סוכן (pv). לכל ממד: הגרסה החדשה (זו שהופיעה אחרונה)
   מול הקודמת — הממוצע לעבודה, ההפרש ורווח סמך של 90% ב־bootstrap (זרע קבוע לפי הגרסאות — אותה תשובה בכל טעינה).
   פסק: up = טוב יותר בוודאות, dn = גרוע יותר בוודאות, eq = כל הרווח בתוך הסף (אותו דבר בפועל), ? = עוד לא ברור, few = פחות מ־VER_MIN */
const VER_DIMS = ['env', 'tl', 'rv', 'rb', 'jg'];   // env = הקוד, השאר = ההנחיות של המתרגם / המבקר / המתזמר / השופט
const VER_MIN = 3, VER_LAST = 20, VER_B = 2000;
// [מפתח, כיוון (1 = גבוה עדיף), סף שוויון (מוחלט, או r = יחסי לממוצע הישן), ליבה]
const VER_MET = [['q', 1, 2, 1], ['jd', 1, 2, 1], ['ok', 1, 0.05, 1], ['cpm', -1, 'r', 1], ['spm', -1, 'r', 0], ['ht', -1, 0.02, 0], ['num', -1, 0.02, 0]];
function verVals(r) {
  const done = r.st === 'done', m = mins(r), ox = r.lx && r.lx.mx && r.lx.mx.om, e = r.ux && r.ux.e, rs = runSec(r);
  return {
    q: done && r.q ? r.q.s : null, jd: done && r.jd ? r.jd.s : null,
    ok: r.st === 'done' || r.st === 'failed' ? (okFirst(r) ? 1 : 0) : null,
    cpm: done && r.pr && m > 0 ? r.usd / m : null, spm: done && rs != null && m > 0 ? rs / m : null,
    ht: done && e && e.s > 0 && e.wa > 0 ? e.wd / e.wa : null,
    num: done && ox && ox['num.n'] > 0 ? ox['num.miss'] / ox['num.n'] : null,
  };
}
function seeded(s) {   // mulberry32
  let a = 0; for (const ch of String(s)) a = (Math.imul(a ^ ch.charCodeAt(0), 2654435761) >>> 0);
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* רווח סמך של 90% להפרש הממוצעים (a פחות b), bootstrap לא־מזווג */
function bootDiff(a, b, rnd01) {
  const mA = mean(a), mB = mean(b), ds = new Array(VER_B);
  for (let i = 0; i < VER_B; i++) {
    let sa = 0, sb = 0;
    for (let j = 0; j < a.length; j++) sa += a[(rnd01() * a.length) | 0];
    for (let j = 0; j < b.length; j++) sb += b[(rnd01() * b.length) | 0];
    ds[i] = sa / a.length - sb / b.length;
  }
  ds.sort((x, y) => x - y);
  return { d: mA - mB, lo: ds[Math.floor(0.05 * VER_B)], hi: ds[Math.ceil(0.95 * VER_B) - 1] };
}
function verMetric(k, dir, tol, A, B, seed) {
  const a = A.map((r) => verVals(r)[k]).filter(isNum), b = B.map((r) => verVals(r)[k]).filter(isNum);
  const out = { k, na: a.length, nb: b.length, a: rnd(mean(a), 4), b: rnd(mean(b), 4) };
  if (a.length < VER_MIN || b.length < VER_MIN) return Object.assign(out, { v: 'few' });
  const x = bootDiff(a, b, seeded(seed + '|' + k));
  const t = tol === 'r' ? 0.1 * Math.abs(mean(b)) : tol;
  // בכיוון "טוב": חיובי = לטובה
  const lo = dir > 0 ? x.lo : -x.hi, hi = dir > 0 ? x.hi : -x.lo;
  const v = lo > 0 && hi > t * 0.5 ? 'up' : hi < 0 && lo < -t * 0.5 ? 'dn' : lo >= -t && hi <= t ? 'eq' : '?';
  return Object.assign(out, { d: rnd(x.d, 4), lo: rnd(x.lo, 4), hi: rnd(x.hi, 4), v });
}
const stratOf = (r) => (r.mode || '?') + '|' + (r.eng || '?');
function verStratum(la, lb) {
  const ca = {}, cb = {};
  for (const r of la) ca[stratOf(r)] = (ca[stratOf(r)] || 0) + 1;
  for (const r of lb) cb[stratOf(r)] = (cb[stratOf(r)] || 0) + 1;
  let best = '', bv = 0;
  for (const k of Object.keys(ca)) { const v = Math.min(ca[k], cb[k] || 0); if (v > bv || (v === bv && v > 0 && ca[k] > (ca[best] || 0))) { best = k; bv = v; } }
  return best || null;              // אין שכבה משותפת — null = "few" (לא משווים תפוחים לתפוזים)
}
function versionsView(all) {
  const tr = all.filter((r) => r.k === 'tr' && !r.gold && (r.st === 'done' || r.st === 'failed'));
  const out = [];
  for (const dim of VER_DIMS) {
    const by = {};
    for (const r of tr) { const g = dim === 'env' ? r.env : r.pv && r.pv[dim]; if (g) (by[g] = by[g] || []).push(r); }
    const vs = Object.entries(by).map(([g, l]) => ({ g, l: l.sort((x, y) => x.at - y.at), at: Math.min(...l.map((r) => r.at || 0)) })).sort((x, y) => y.at - x.at);
    if (vs.length < 2) continue;
    const [A, B] = vs, seed = dim + '|' + A.g + '|' + B.g;
    // 21/10/2026 (ניתוח הייצור): השוואה בין גרסאות רק באותו מצב ואותו מנוע — אחרת "גרסה גרועה יותר" = מודל זול יותר
    // (ההנחיות החדשות רצו על Haiku, הקודמות על Sonnet/Opus). השכבה = זו שבה יש הכי הרבה עבודות בשני הצדדים (min)
    const sk = verStratum(A.l.slice(-VER_LAST * 3), B.l.slice(-VER_LAST * 3));
    const la = sk ? A.l.filter((r) => stratOf(r) === sk).slice(-VER_LAST) : [], lb = sk ? B.l.filter((r) => stratOf(r) === sk).slice(-VER_LAST) : [];
    const m = VER_MET.map(([k, dir, tol]) => verMetric(k, dir, tol, la, lb, seed)).filter((x) => x.na || x.nb);
    const core = m.filter((x) => VER_MET.find((y) => y[0] === x.k)[3]);
    const v = la.length < VER_MIN || lb.length < VER_MIN ? 'few'
      : core.some((x) => x.v === 'dn') ? 'dn' : m.some((x) => x.v === 'up') && !m.some((x) => x.v === 'dn') ? 'up'
      : m.some((x) => x.v === 'dn') ? 'mix' : m.length && m.every((x) => x.v === 'eq' || x.v === 'few') && m.some((x) => x.v === 'eq') ? 'eq' : '?';
    out.push({ d: dim, a: A.g, b: B.g, at: A.at, na: la.length, nb: lb.length, v, m, sk: sk || '' });
  }
  return out.sort((x, y) => y.at - x.at);
}
/* סיכום שבועי: 7 הימים האחרונים מול 7 שלפניהם + אילו גרסאות חדשות הופיעו השבוע */
function weekSum(all, now, ver) {
  const a = now - 7 * DAY, b = now - 14 * DAY;
  const k = kpis(all.filter((r) => r.at >= a)), kp = kpis(all.filter((r) => r.at >= b && r.at < a));
  const pick = (x) => ({ n: x.n, done: x.done, min: x.min, usd: x.usd, cpm: x.cpm, q: x.q, jd: x.jd, ok: x.ok, ht: x.ht });
  return { from: a, k: pick(k), kp: pick(kp), nv: (ver || []).filter((x) => x.at >= a).map((x) => ({ d: x.d, v: x.v })) };
}
function insights(rs, k30, roles, stages, fails, jc, qf, modes, now, mx, ver) {
  const out = [];
  const tr = rs.filter((r) => r.k === 'tr' && !r.gold);
  const done = tr.filter((r) => r.st === 'done');
  const perMonth = (usd, list) => { const span = Math.max(WIN, now - Math.min(...list.map((r) => r.at || now))); return usd * WIN / span; };
  // כשלים
  const fin = tr.filter((r) => r.st === 'done' || r.st === 'failed');
  if (fails.length && fin.length >= 3) {
    const f = fails[0], rate = f.n / fin.length;
    if (rate >= 0.1) out.push({ k: 'fail_top', sev: rate >= 0.25 ? 1 : 2, imp: rnd(perMonth(f.usd, tr), 2), v: { e: f.e, n: f.n, p: rnd(rate, 3), usd: f.usd, st: f.st } });
  }
  if (k30.ok != null && k30.fin >= 5 && k30.ok < 0.85) out.push({ k: 'first_pass', sev: k30.ok < 0.7 ? 1 : 2, imp: 0, v: { p: k30.ok, n: k30.fin } });
  // טוקנים ועלות
  for (const x of roles) {
    if (x.k === 'jg' || x.k === 'sub') continue;
    // 21/10/2026 (ניתוח הייצור): "פספוס מטמון" של $0.07 לחודש דורג sev 1 — מעל באגים אמיתיים. החומרה לפי ההשפעה בדולרים
    const im = perMonth(x.sav, rs);
    if (x.ch != null && x.ch < 0.6 && x.calls >= 6 && x.sav > 0.02) out.push({ k: 'cache_low', sev: im >= 5 ? 1 : im >= 1 ? 2 : 3, imp: rnd(im, 2), v: { r: x.k, p: x.ch, usd: x.sav } });
  }
  if (roles.length && roles[0].sh >= 0.5 && roles[0].usd > 0.5) out.push({ k: 'cost_role', sev: 3, imp: rnd(perMonth(roles[0].usd, rs) * 0.2, 2), v: { r: roles[0].k, p: roles[0].sh, m: roles[0].m } });
  const thinkRows = rs.map((r) => r.lx && r.lx.en && r.lx.en.th).filter(Boolean);
  if (thinkRows.length >= 3) {
    for (const role of ['tl', 'rv', 'main']) {
      const th = sum(thinkRows.map((t) => t[role])), o = sum(rs.filter((r) => r.lx && r.lx.en && r.lx.en.th).map((r) => sum(r.use.filter((u) => u.k === role).map((u) => u.o))));
      if (o > 20000 && th / o >= 0.6) { const ru = roles.find((x) => x.k === role); out.push({ k: 'think_heavy', sev: 3, imp: ru ? rnd(perMonth(ru.usd, rs) * 0.25, 2) : 0, v: { r: role, p: rnd(th / o, 3) } }); }
    }
  }
  const trunc = sum(rs.map((r) => r.lx && r.lx.en && r.lx.en.tc));
  if (trunc > 0) out.push({ k: 'truncated', sev: 2, imp: 0, v: { n: trunc, j: rs.filter((r) => r.lx && r.lx.en && r.lx.en.tc > 0).length } });
  const cw = sum(rs.map((r) => r.lx && r.lx.en && r.lx.en.cw));
  if (cw >= 3) out.push({ k: 'cache_miss', sev: 2, imp: 0, v: { n: cw } });
  // תהליך התרגום: כמה תיקונים צריך אחרי התרגום הראשון, וכמה הביקורת משנה
  const withCues = done.filter((r) => r.lx && r.lx.tl && r.lx.cu && r.lx.cu.n > 0);
  if (withCues.length >= 3) {
    const cues = sum(withCues.map((r) => r.lx.cu.n));
    const fx = sum(withCues.map((r) => r.lx.tl.fx || 0)), rv = sum(withCues.map((r) => (r.lx.tl.fr || 0) + (r.lx.tl.fz || 0)));
    if (cues && fx / cues >= 0.12) out.push({ k: 'fix_heavy', sev: 2, imp: 0, v: { p: rnd(fx / cues, 3) } });
    const rvRole = roles.find((x) => x.k === 'rv');
    if (cues && rv / cues < 0.02 && rvRole && rvRole.usd > 0.2) out.push({ k: 'rv_idle', sev: 3, imp: rnd(perMonth(rvRole.usd, rs) * 0.5, 2), v: { p: rnd(rv / cues, 4), usd: rvRole.usd } });
    else if (cues && rv / cues >= 0.2) out.push({ k: 'rv_heavy', sev: 2, imp: 0, v: { p: rnd(rv / cues, 3) } });
  }
  // איכות
  if (jc.n >= 40 && jc.c.length && jc.c[0].sh >= 0.08) out.push({ k: 'judge_top', sev: jc.c[0].sh >= 0.2 ? 1 : 2, imp: 0, v: { c: jc.c[0].k, p: jc.c[0].sh } });
  if (qf.n >= 50 && qf.m.length && qf.m[0].sh >= 0.05) out.push({ k: 'q_metric', sev: qf.m[0].sh >= 0.15 ? 2 : 3, imp: 0, v: { m: qf.m[0].k, p: qf.m[0].sh } });
  const edited = done.filter((r) => r.ed > 0).length;
  if (done.length >= 4 && edited / done.length >= 0.3) out.push({ k: 'edits_after', sev: 2, imp: 0, v: { p: rnd(edited / done.length, 3), n: edited } });
  const kids = rs.filter((r) => r.k === 'ai' && r.pid);
  if (done.length >= 4 && kids.length / done.length >= 0.3) out.push({ k: 'ai_after', sev: 3, imp: 0, v: { n: kids.length } });
  // זמן
  if (stages.length) {
    const s = stages.slice().sort((a, b) => b.sh - a.sh)[0];
    if (s.sh >= 0.35) out.push({ k: 'slow_stage', sev: 3, imp: 0, v: { s: s.k, p: s.sh, spm: s.spm } });
  }
  const pzSh = sum(done.map((r) => r.t.pz)) / Math.max(1, sum(done.map((r) => r.t.run)));
  if (done.length >= 3 && pzSh >= 0.2) out.push({ k: 'wait_user', sev: 3, imp: 0, v: { p: rnd(pzSh, 3) } });
  const over = done.filter((r) => r.tg && r.tg.t > 0 && runSec(r) != null && runSec(r) > r.tg.t);
  /* טעות הצפי (21/10/2026): הצפי בלקיחה (ep.t) מול הזמן בפועל בלי ההמתנות — רק עבודות בהפעלה אחת */
  const etaErr = done.filter((r) => r.ep && r.ep.t > 0 && r.t && isNum(r.t.run) && (r.fires || 0) <= 1)
    .map((r) => Math.abs(Math.max(0, r.t.run - (r.t.pz || 0)) - r.ep.t) / r.ep.t).sort((a, b) => a - b);
  if (etaErr.length >= 4) { const med = etaErr[Math.floor(etaErr.length / 2)]; if (med >= 0.25) out.push({ k: 'eta_off', sev: med >= 0.5 ? 2 : 3, imp: 0, v: { p: rnd(med, 3), n: etaErr.length } }); }
  if (done.length >= 4 && over.length / done.length >= 0.25) out.push({ k: 'sla_over', sev: 2, imp: 0, v: { p: rnd(over.length / done.length, 3) } });
  // התמלול והיישור
  const prf = done.filter((r) => r.lx && r.lx.ps && isNum(r.lx.ps['edit_import.equal']));
  if (prf.length >= 3) {
    const ch = sum(prf.map((r) => (r.lx.ps['edit_import.replaced'] || 0) + (r.lx.ps['edit_import.inserted'] || 0) + (r.lx.ps['edit_import.deleted'] || 0)));
    const all = ch + sum(prf.map((r) => r.lx.ps['edit_import.equal']));
    if (all && ch / all >= 0.05) out.push({ k: 'asr_weak', sev: 2, imp: 0, v: { p: rnd(ch / all, 3) } });
  }
  const al = done.filter((r) => r.lx && r.lx.ps && isNum(r.lx.ps['align.aligned']));
  if (al.length >= 3) {
    const bad = sum(al.map((r) => (r.lx.ps['align.suspicious'] || 0) + (r.lx.ps['align.kept_approx'] || 0))), tot = bad + sum(al.map((r) => r.lx.ps['align.aligned']));
    if (tot && bad / tot >= 0.05) out.push({ k: 'align_weak', sev: 3, imp: 0, v: { p: rnd(bad / tot, 3) } });
  }
  const sy = rs.filter((r) => r.lx && r.lx.sy && isNum(r.lx.sy.c));
  if (sy.length >= 3 && sy.filter((r) => r.lx.sy.c < 0.6).length / sy.length >= 0.2) out.push({ k: 'sync_low', sev: 3, imp: 0, v: { p: rnd(sy.filter((r) => r.lx.sy.c < 0.6).length / sy.length, 3) } });
  // השוואת מצבים: מצב זול יותר באיכות קרובה (לפחות 3 עבודות בכל אחד)
  const good = modes.filter((x) => x.done >= 3 && x.cpm != null && (x.jd != null || x.q != null));
  const score = (x) => (x.jd != null ? x.jd : x.q);
  if (good.length >= 2) {
    const best = good.slice().sort((a, b) => score(b) - score(a))[0];
    const cheap = good.filter((x) => x.cpm < best.cpm && score(best) - score(x) <= 3).sort((a, b) => a.cpm - b.cpm)[0];
    if (cheap) {
      const mBest = sum(rs.filter((r) => r.mode === best.m && r.at >= now - WIN).map(mins));
      out.push({ k: 'mode_value', sev: 2, imp: rnd(mBest * (best.cpm - cheap.cpm), 2), v: { a: best.m, b: cheap.m, d: rnd(score(best) - score(cheap), 1), sv: rnd(1 - cheap.cpm / best.cpm, 3) } });
    }
  }
  // מ׳7: גרסה חדשה של הקוד או של ההנחיות — גרועה / טובה יותר בוודאות (bootstrap, versionsView)
  const vMet = (x, w) => (x.m.find((y) => y.v === w && VER_MET.find((z) => z[0] === y.k)[3]) || x.m.find((y) => y.v === w) || {}).k || '';
  const vw = (ver || []).find((x) => x.v === 'dn'), vb = (ver || []).find((x) => x.v === 'up');
  if (vw) out.push({ k: 'ver_worse', sev: 1, imp: 0, v: { d: vw.d, a: vw.a, b: vw.b, k: vMet(vw, 'dn'), na: vw.na, nb: vw.nb } });
  if (vb) out.push({ k: 'ver_better', sev: 3, imp: 0, v: { d: vb.d, a: vb.a, b: vb.b, k: vMet(vb, 'up'), na: vb.na, nb: vb.nb } });
  // מ׳5: המדדים בקוד
  if (mx) {
    if (mx.om.num >= 20 && mx.om.numm >= 0.05) out.push({ k: 'num_drop', sev: mx.om.numm >= 0.15 ? 1 : 2, imp: 0, v: { p: mx.om.numm, n: mx.om.num } });
    const om = (mx.om.e || 0) + (mx.om.s || 0);
    if (mx.st.n >= 200 && om >= 0.02) out.push({ k: 'omit_cues', sev: om >= 0.05 ? 1 : 2, imp: 0, v: { p: rnd(om, 4), em: mx.om.e, sh: mx.om.s } });
    const lc = (mx.tm.late || 0) + (mx.tm.cut || 0);
    if (mx.tm.n >= 200 && lc >= 0.1) out.push({ k: 'tm_late', sev: lc >= 0.2 ? 2 : 3, imp: 0, v: { p: rnd(lc, 4), lt: mx.tm.late, ct: mx.tm.cut } });
    if (mx.tm.n >= 200 && mx.tm.shb != null && mx.tm.shb >= 0.05) out.push({ k: 'shot_near', sev: 3, imp: 0, v: { p: mx.tm.shb } });
    if (mx.cs.nm >= 5 && mx.cs.nmv >= 0.1) out.push({ k: 'name_var', sev: 3, imp: 0, v: { p: mx.cs.nmv, n: mx.cs.nm } });
    if (mx.cs.gl >= 10 && mx.cs.glm >= 0.1) out.push({ k: 'gl_miss', sev: 2, imp: 0, v: { p: mx.cs.glm, n: mx.cs.gl, x: mx.cs.glx } });
  }
  if (rs.filter((r) => r.ij > 0).length >= 2) out.push({ k: 'inject_seen', sev: 3, imp: 0, v: { n: rs.filter((r) => r.ij > 0).length } });
  const gq = done.filter((r) => r.gq).map((r) => r.gq.s);
  if (gq.length) out.push({ k: 'gold', sev: 3, imp: 0, v: { s: rnd(mean(gq), 1), n: gq.length } });
  if (!done.some((r) => r.lx)) out.push({ k: 'need_data', sev: 3, imp: 0, v: { n: done.length } });
  return out.sort((a, b) => a.sev - b.sev || (b.imp || 0) - (a.imp || 0)).slice(0, 14);
}
/* records = כל הרשומות (מכל המשתמשים, אנונימיות). now = עכשיו */
function learnView(records, now) {
  const all = (Array.isArray(records) ? records : []).filter((r) => r && r.v === LR_V && r.use && r.t);
  const rs = all.filter((r) => r.at >= now - 90 * DAY);
  const cur = all.filter((r) => r.at >= now - WIN), prev = all.filter((r) => r.at >= now - 2 * WIN && r.at < now - WIN);
  const k30 = kpis(cur), kp = kpis(prev);
  // 21/10/2026: זמן לפי שלב — רק עבודות "נקיות" (הפעלה אחת, המתנה למשתמש מתחת ל־20% מהריצה). עבודה של 5 דק׳ שחיכתה
  // 8 שעות לתשובה רשמה את כל ההמתנה על "תמלול", והמסקנה slow_stage הצביעה על השלב הלא נכון
  const clean = (r) => (r.fires || 0) <= 1 && !(r.t && r.t.run > 0 && (r.t.pz || 0) / r.t.run > 0.2);
  const roles = costRoles(rs), stages = stageTime(rs.filter((r) => r.k === 'tr' && r.st === 'done' && clean(r)));
  const fails = failures(rs), jc = judgeCodes(rs), qf = qualityFails(rs), modes = modeTable(rs), mx = mxView(rs), ver = versionsView(all);
  const tk = rs.map(tokOf);
  return {
    v: LR_V, n: all.length, n90: rs.length, first: all.length ? Math.min(...all.map((r) => r.at || now)) : 0,
    k: k30, kp, wk: weekly(all, now, 8),
    roles, tok: { i: sum(tk.map((t) => t.i)), o: sum(tk.map((t) => t.o)), cr: sum(tk.map((t) => t.cr)), cw: sum(tk.map((t) => t.cw)) },
    stages, vt: vtTime(rs), fails, jc, qf, modes, mx, ver, ws: weekSum(all, now, ver),
    eng: ['api', 'sub'].map((e) => ({ e, ...kpis(rs.filter((r) => r.eng === e)) })).filter((x) => x.n),
    follow: { rr: rs.filter((r) => r.k === 'rr').length, ai: rs.filter((r) => r.k === 'ai').length, ed: rs.filter((r) => r.k === 'tr' && (r.ed > 0)).length, gold: rs.filter((r) => r.gold).length, ux: uxSum(rs.filter((r) => r.k === 'tr')) },
    ins: insights(rs, k30, roles, stages, fails, jc, qf, modes, now, mx, ver),
    im: impactView(all, now),            // 21/10/2026: השפעת המאגר לאורך זמן (lib/learnimpact.js) — הבסיס מול עכשיו, לכל שיפור
    recent: all.filter((r) => r.k === 'tr').sort((a, b) => b.at - a.at).slice(0, 12).map((r) => ({ id: r.id.slice(0, 8), at: r.at, st: r.st, err: r.err, mode: r.mode, eng: r.eng,
      dur: r.dur, usd: r.usd, pr: r.pr, q: r.q ? r.q.s : null, jd: r.jd ? r.jd.s : null, run: runSec(r), fires: r.fires, ch: (() => { const t = tokOf(r); return inTok(t) ? rnd(t.cr / inTok(t), 3) : null; })() })),
  };
}

/* ---------------- 4. חבילה לניתוח עם Claude (14/10/2026, בקשת המשתמש: "המטרה הראשית") ----------------
   ⛔ בלי API: כאן רק קוד. את הניתוח עושה Claude שבמנוי של המשתמש (סשן Claude Code / שיחה ב־claude.ai) — אסור
   להוסיף לתהליך הזה קריאה ל־Anthropic API (לא לשלם על טוקנים מחוץ למנוי; tests/learn-claude.test.js אוכף).
   טקסט Markdown אחד: הוראה ל־Claude, המדדים, המסקנות המדורגות, מילון השדות — ואחריו (בנפרד) הרשומות כ־JSON.
   רק מה שכבר אנונימי ברשומות: בלי uid, בלי שמות, בלי טקסט ובלי מזהי קבצים */
const INS_HE = {
  fail_top: 'הכשל הנפוץ ביותר', first_pass: 'עבודות שעברו בלי "המשך" ידני', cache_low: 'שיעור פגיעה נמוך במטמון',
  cost_role: 'תפקיד אחד לוקח את רוב העלות', think_heavy: 'חשיבה כבדה', truncated: 'תשובות שנקטעו', cache_miss: 'פספוסי מטמון',
  fix_heavy: 'הרבה סבבי תיקון', rv_idle: 'המבקר כמעט לא משנה', rv_heavy: 'המבקר משנה הרבה', judge_top: 'הבעיה שהשופט מסמן הכי הרבה',
  q_metric: 'מדד איכות שנכשל הרבה', edits_after: 'עריכות ידניות אחרי העבודה', ai_after: 'שימוש בגיליון ה־AI אחרי העבודה',
  slow_stage: 'שלב איטי מהצפוי', wait_user: 'זמן המתנה למשתמש', sla_over: 'חריגה מיעד הזמן', eta_off: 'טעות בצפי הזמן', asr_weak: 'תמלול חלש',
  align_weak: 'יישור חלש', sync_low: 'סנכרון קול־וידאו לא ודאי', mode_value: 'מצב זול יותר כמעט באותה איכות',
  num_drop: 'מספרים שנעלמו בתרגום', omit_cues: 'כתוביות שנראות מושמטות', tm_late: 'כתוביות שעולות מאוחר / יורדות מוקדם',
  shot_near: 'גבולות קרובים לחילוף שוט', name_var: 'שם אחד בכמה איותים', gl_miss: 'מונחים מהמילון שלא נשמרו',
  ver_worse: 'גרסה חדשה גרועה יותר', ver_better: 'גרסה חדשה טובה יותר', inject_seen: 'שורות שנראות כמו הוראה בתמלול', gold: 'ציון סט הזהב', need_data: 'חסרים נתונים מפורטים',
};
const FIELDS = [
  ['k', 'סוג: tr תרגום, rr הפקה מחדש, ai גיליון AI'], ['st/err', 'מצב סופי וקוד השגיאה'], ['eng', 'api = השרת שלנו, sub = Routine של המשתמש'],
  ['mode', 'מצב התרגום (מודל · מאמץ)'], ['dur', 'אורך הסרטון בשניות'], ['use', 'שורות עלות: מודל, תפקיד, טוקנים (i קלט, o פלט, cr קריאה ממטמון, c5/c1 כתיבה)'],
  ['usd', 'עלות בדולרים לפי המחירון'], ['t', 'זמנים: q המתנה ללקיחה, run ריצה, pz המתנה למשתמש, s שניות לכל שלב'],
  ['ep/tg', 'הצפי והיעד שנקבעו בלקיחה'], ['tr', 'עקיבה: פעולות/שגיאות לכל סוכן'], ['q', 'מדד האיכות (0–100) ומה נכשל'],
  ['jd', 'ציון השופט וקודי הבעיות'], ['tw', 'המגדל עצר/הזהיר, ולמה'], ['fires/ar', 'כמה הפעלות / המשכים אוטומטיים'],
  ['ed', 'כמה פעמים נשמרה עריכה ידנית אחרי העבודה'], ['gq', 'ציון מול תרגום אנושי (סט הזהב)'], ['pv/env', 'גרסאות ההנחיות והסביבה'],
  ['ux', 'מה קרה אחרי העבודה (מהטלפון): e עריכות (s שמירות, ws שניות עבודה, n שינויים, wd/cd מרחק עריכה במילים/בתווים, wa/ca מילים/תווים בגרסה האחרונה, ולכל סוג: txt טקסט, tm זמן, sp פיצול, mg מיזוג, add, del, mx מורכב), pl נגן (n הפעלות, sec שניות, cov חלק שנצפה), o תוצרים (dl הורדות, sh שיתופים, dx ל־Drive), sg הצעות (a/r), ai גיליון AI (q בקשות, a הוחלו, r נדחו), gl מונחים שנוספו'],
  ['lx', 'עובדות מפורטות מהעובד: שלבי vt, תמלול, יישור, סנכרון, מנוע (קטיעות, ניסיונות חוזרים, חשיבה), זיכרון'],
  ['lx.mx', 'מ׳5 — מדדים בקוד: st מה כל שלב שינה (df טיוטה←תיקוני המתרגם, fr ←ביקורת, rz ←תיקון אחרון, dz טיוטה←סופי; ch כתוביות ששונו, t TER, c chrF++), tm תזמון מול הדיבור (in/out שניות מהמילה הראשונה/האחרונה, late/cut, nw בלי דיבור, sh.near/sh.bad גבולות 0–11 / 1–11 פריימים מחילוף שוט), cs עקביות (nm שמות שנבדקו, nm.var עם יותר מאיות אחד, gl מונחים מהמילון: n/miss/mix), om השמטות (om.e ריקות, om.s קצרות מאוד, om.r50 יחס אורך, num מספרים n/miss)'],
  ['ux.e.sb/sr', 'מ׳5 — SubER אחרי עריכה בעורך: עריכות / אסימוני הייחוס (מילים + שבירות)'],
];
const fmtv = (v) => (v == null ? '—' : typeof v === 'number' ? String(v) : JSON.stringify(v));
function learnBrief(view, now) {
  const v = view || {};
  const k = v.k || {}, kp = v.kp || {};
  const L = [];
  L.push('# מאגר הלמידה של סטודיו התרגום — חבילה לניתוח');
  L.push('');
  L.push('נוצר: ' + new Date(now || Date.now()).toISOString().slice(0, 16).replace('T', ' ') + ' UTC · רשומות: ' + (v.n || 0) + ' (ב־90 יום: ' + (v.n90 || 0) + ')');
  L.push('');
  L.push('## מה מבקשים ממך, Claude');
  L.push('אתה מנתח את מערכת תרגום הסרטונים (אנגלית → עברית, Claude דרך API או Routine, vt לתמלול/יישור/צריבה).');
  L.push('1. מצא את 3–5 השיפורים שהכי שווים: איכות, עלות לדקת סרטון, זמן, ואמינות (עבודות שעוברות בלי "המשך").');
  L.push('2. לכל שיפור: ההשערה, המספרים מהנתונים שתומכים בה, השינוי המוצע (קובץ/פרמטר), ואיך נמדוד שזה עבד.');
  L.push('3. ציין מה חסר בנתונים כדי להחליט — זה ייכנס לאיסוף הבא.');
  L.push('הנתונים אנונימיים: אין משתמשים, שמות, טקסט או קבצים. אל תנחש פרטים כאלה.');
  L.push('');
  L.push('## המדדים — 30 יום מול 30 הקודמים');
  L.push('| מדד | עכשיו | קודם |');
  L.push('|---|---|---|');
  for (const [key, he] of [['n', 'עבודות'], ['done', 'הסתיימו'], ['ok', 'עברו בלי "המשך" (חלק)'], ['min', 'דקות סרטון'], ['cpm', 'דולר לדקת סרטון'],
    ['spm', 'שניות עבודה לדקה (חציון)'], ['tpm', 'טוקנים לדקה'], ['ch', 'חלק הקלט מהמטמון'], ['q', 'מדד איכות'], ['jd', 'ציון שופט'], ['ht', 'שיעור העריכה שלך (HTER)'], ['sb', 'SubER אחרי העריכה'], ['edr', 'עבודות שנערכו (חלק)'], ['cov', 'חלק הסרטון שנצפה (חציון)'], ['sga', 'הצעות שהתקבלו (חלק)']]) {
    if (k[key] == null && kp[key] == null) continue;
    L.push('| ' + he + ' (`' + key + '`) | ' + fmtv(k[key]) + ' | ' + fmtv(kp[key]) + ' |');
  }
  L.push('');
  L.push('## המסקנות של המערכת (מדורגות; sev 1 = הכי חשוב, imp = דולר לחודש משוער)');
  if (!(v.ins || []).length) L.push('- אין עדיין מסקנות — מעט נתונים.');
  for (const x of v.ins || []) L.push('- **' + (INS_HE[x.k] || x.k) + '** (`' + x.k + '`, sev ' + x.sev + (x.imp ? ', imp $' + x.imp : '') + '): ' + JSON.stringify(x.v || {}));
  const sec = (title, val) => { if (val == null || (Array.isArray(val) && !val.length)) return; L.push(''); L.push('## ' + title); L.push('```json'); L.push(JSON.stringify(val)); L.push('```'); };
  sec('עלות לפי תפקיד', v.roles);
  sec('טוקנים (90 יום)', v.tok);
  sec('זמן לפי שלב', v.stages);
  sec('פקודות vt', v.vt);
  sec('כשלים', v.fails);
  sec('קודי השופט', v.jc);
  sec('מדדי איכות שנכשלו', v.qf);
  sec('מצבי התרגום', v.modes);
  sec('מדדים בקוד (מ׳5)', v.mx);
  sec('לפני ואחרי לכל גרסה (מ׳7) — d ממד (env קוד, tl/rv/rb/jg הנחיות), a חדשה, b קודמת, v פסק (up/dn/eq/?/few/mix), m: ממוצע לעבודה a/b, הפרש d ורווח סמך 90% lo–hi', v.ver);
  sec('השבוע מול השבוע שעבר', v.ws);
  sec('לפי מנוע', v.eng);
  sec('מה קרה אחרי העבודה', v.follow);
  sec('מגמה שבועית (8 שבועות)', v.wk);
  // 21/10/2026: השפעת המאגר — לכל שיפור שנפרס: לפני/אחרי (שכבות מצב·מנוע, רווח סמך 90%), והבסיס מול "הכל מאז"
  if (v.im) sec('השפעת המאגר — start = השיפור הראשון שנפרס; imps: לכל שיפור c = מדדים (a לפני, b אחרי, d, lo–hi, v פסק, tg = המדד שכוונו אליו); all = הבסיס מול כל מה שמאז', {
    start: v.im.start, vol: v.im.vol,
    imps: (v.im.imps || []).map((x) => ({ id: x.id, at: x.at, st: x.st, m: x.m, he: x.he && x.he[0], c: (x.c || []).filter((c) => c.v !== 'few').map((c) => ({ k: c.k, a: c.a, b: c.b, d: c.d, lo: c.lo, hi: c.hi, v: c.v, tg: c.tg })) })),
    all: v.im.cmp && v.im.cmp.all ? v.im.cmp.all.m.filter((c) => c.v !== 'few').map((c) => ({ k: c.k, a: c.a, b: c.b, rel: c.rel, v: c.v })) : null,
    dec: v.im.dec,
  });
  L.push('');
  L.push('## מילון השדות ברשומות (בקובץ records.json)');
  for (const [f, he] of FIELDS) L.push('- `' + f + '` — ' + he);
  return L.join('\n');
}

module.exports = { versionsView, weekSum, VER_DIMS, VER_MET, normUx, mergeUx, UX_SHAPE, ED_KINDS, learnBrief, INS_HE, LR_V, lid, normLx, learnRec, recHash, learnView, kpis, insights, cacheSavable, MODES, STAGES };
