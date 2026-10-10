/* מגדל הפיקוח 2.0 — מלאי הסוכנים (v373). בהשראת ServiceNow AI Control Tower: Discover · Inventory.
   "הסוכנים" = התפקידים בכל עבודת תרגום: מנהל העבודה (הסשן הראשי, main — מתאם, מגיה ומפעיל את vt), המתרגם (tl), המבקר (rv). לכל אחד ב־30 הימים האחרונים:
   המודל והמאמץ האחרונים, בכמה עבודות עבד, כמה עלה, אחוז ההצלחה, כמה פעולות (ומהן נכשלו — מהעקיבה), וגרסת ההנחיות
   (sha1 של RUNBOOK / TRANSLATE / REVIEW — "גרסה חדשה" = שינוי שנרשם). הכל נגזר מרשומות העבודות — בלי אחסון נוסף ובלי טוקנים.
   רק מספרים, מזהי מודל וקודים — בלי שמות קבצים. הקובץ טהור — בלי רשת. */
const KEEP = 30 * 86400e3, NEW_MS = 7 * 86400e3;
const AGENTS = [['main', 'rb'], ['tl', 'tl'], ['rv', 'rv'], ['jg', 'jg']];   // v375: jg = שופט האיכות (Haiku, בלי מאמץ)   // סוכן → מפתח גרסת ההנחיות שלו
const MODEL_RE = /^claude-[a-z0-9-]{1,50}$/;
const EFFORTS = ['low', 'medium', 'high', 'max'];
/* המאמץ של המתרגם והמבקר — מהמצב שנבחר (opus-medium → medium); מנהל העבודה — לפי ה־Routine (לא ידוע כאן) */
const effortOf = (mode) => { const e = String(mode || '').split('-').pop(); return EFFORTS.includes(e) ? e : ''; };
const r4 = (v) => Math.round(v * 1e4) / 1e4;

function agentsView(jobs, now) {
  const list = (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.kind === 'tr' && (j.created || 0) >= now - KEEP)
    .sort((a, b) => (a.created || 0) - (b.created || 0));
  const out = [];
  for (const [k, pk] of AGENTS) {
    const ran = list.filter((j) => Array.isArray(j.use) && j.use.some((r) => r && r.k === k) || j.tr && j.tr.a && j.tr.a[k]);
    if (!ran.length) continue;
    let usd = 0, partial = false, n = 0, e = 0, sec = 0, model = '', pv = '', pvAt = 0, qs = 0, qn = 0;
    const pvs = new Set();
    for (const j of ran) {
      for (const r of (Array.isArray(j.use) ? j.use : []).filter((x) => x && x.k === k)) {
        if (typeof r.usd === 'number') usd += r.usd; else partial = true;
        if (MODEL_RE.test(String(r.m || ''))) model = r.m;
      }
      const t = j.tr && j.tr.a && j.tr.a[k];
      if (t) { n += t.n || 0; e += t.e || 0; sec += t.s || 0; }
      const qv = k === 'jg' ? j.jd : k !== 'main' ? j.q : null;   // v374: מדד האיכות — למתרגם ולמבקר · v375: לשופט — הציון שלו
      if (qv && typeof qv.s === 'number') { qs += qv.s; qn += 1; }
      const v = j.pv && /^[0-9a-f]{8}$/.test(String(j.pv[pk] || '')) ? j.pv[pk] : '';
      if (v) { if (v !== pv) { pv = v; pvAt = j.created || 0; } pvs.add(v); }
    }
    const ended = ran.filter((j) => j.state === 'done' || j.state === 'failed');
    const ok = ended.filter((j) => j.state === 'done').length;
    const last = ran[ran.length - 1];
    // v386: הערכה לפי גרסת ההנחיות — הגרסאות האחרונות (החדשה ראשונה), כל אחת עם הציון שלה
    const byV = new Map();
    for (const j of ran) {
      const v = j.pv && /^[0-9a-f]{8}$/.test(String(j.pv[pk] || '')) ? j.pv[pk] : '';
      if (!v) continue;
      if (!byV.has(v)) byV.set(v, []);
      byV.get(v).push(j);
    }
    const vs = Array.from(byV.entries()).map(([p, js]) => Object.assign({ p, jobs: js.length, at: js[0].created || 0 }, evalOf(k, js)))
      .sort((a, b) => b.at - a.at).slice(0, VS_MAX);
    out.push(Object.assign({ k, m: model, ef: k === 'main' || k === 'jg' ? '' : effortOf(last.spec && last.spec.mode), jobs: ran.length, usd: r4(usd), partial,
      ok: ended.length ? Math.round(100 * ok / ended.length) : null, n, e, s: sec,
      pv, pvs: pvs.size, pvNew: !!(pv && pvs.size > 1 && now - pvAt < NEW_MS), q: qn ? Math.round(qs / qn) : null, vs }, evalOf(k, ran)));
  }
  // גרסת הסביבה (v371) — האחרונה, וכמה גרסאות היו בחודש
  const evs = list.filter((j) => /^[0-9a-f]{12}$/.test(String(j.ev || '')));
  return { jobs: list.length, agents: out, ev: evs.length ? { v: evs[evs.length - 1].ev, n: new Set(evs.map((j) => j.ev)).size } : null, risk: riskView(list) };
}
/* v386: מדדי הערכת סוכנים (ServiceNow: Agentic evaluation) — אחרי ריצה, מהיומנים, בלי טוקנים:
   c שלמות = הסוכן השלים את החלק שלו (מנהל העבודה — העבודה הסתיימה; המתרגם / המבקר — השלב שלו נסגר; השופט — נתן ציון), מתוך העבודות שנגמרו;
   t כלי נכון = פעולות בתוך התפקיד (העקיבה סופרת w — מחוץ לתפקיד; עקיבה ישנה בלי w לא נספרת);
   v קריאות תקינות = פעולות שלא נכשלו. sc = ממוצע המדדים שיש. */
const VS_MAX = 3;
const STAGE_OF = { tl: 'tl', rv: 'rv' };
function completed(k, j) {
  if (k === 'main') return j.state === 'done';
  if (k === 'jg') return !!(j.jd && typeof j.jd.s === 'number');
  const g = j.prog && j.prog.stg && j.prog.stg[STAGE_OF[k]];
  return !!(g && g.e);
}
const pct = (a, b) => (b > 0 ? Math.round(100 * a / b) : null);
function evalOf(k, js) {
  const ended = js.filter((j) => j.state === 'done' || j.state === 'failed');
  let n = 0, e = 0, tn = 0, w = 0;
  for (const j of js) {
    const t = j.tr && j.tr.a && j.tr.a[k];
    if (!t) continue;
    n += t.n || 0; e += t.e || 0;
    if (typeof t.w === 'number') { tn += t.n || 0; w += t.w; }
  }
  const c = pct(ended.filter((j) => completed(k, j)).length, ended.length), tl = pct(tn - w, tn), v = pct(n - e, n);
  const have = [c, tl, v].filter((x) => x != null);
  return { c, t: tl, v, w, sc: have.length ? Math.round(have.reduce((a, x) => a + x, 0) / have.length) : null };
}
/* v386: סיכון מול בקרה (AI Control Tower · Risk) — לכל סיכון: הבקרה שקיימת, כמה היא חזקה (קבוע — מה שנאכף בקוד), וכמה פעמים פעלה ב־30 יום */
const RISKS = [['inj', 'm'], ['cost', 's'], ['loop', 's']];
function riskView(list) {
  const hit = {
    inj: list.filter((j) => j.ij && j.ij.n > 0).length,
    cost: list.filter((j) => j.err === 'budget_stop' || (j.tw && (j.tw.why === 'cost' || j.tw.why === 'cap') && (j.tw.lv === 'red' || j.err === 'tower_stop'))).length,
    loop: list.filter((j) => (j.tw && (j.tw.why === 'loop' || j.tw.why === 'calls') && (j.tw.lv === 'red' || j.err === 'tower_stop')) || (Array.isArray(j.rh) && j.rh.length >= 2)).length,
  };
  return RISKS.map(([r, st]) => ({ r, st, n: hit[r] }));
}

module.exports = { KEEP, NEW_MS, AGENTS, effortOf, agentsView, VS_MAX, evalOf, completed, RISKS, riskView };
