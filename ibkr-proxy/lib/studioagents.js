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
    out.push({ k, m: model, ef: k === 'main' || k === 'jg' ? '' : effortOf(last.spec && last.spec.mode), jobs: ran.length, usd: r4(usd), partial,
      ok: ended.length ? Math.round(100 * ok / ended.length) : null, n, e, s: sec,
      pv, pvs: pvs.size, pvNew: !!(pv && pvs.size > 1 && now - pvAt < NEW_MS), q: qn ? Math.round(qs / qn) : null });
  }
  // גרסת הסביבה (v371) — האחרונה, וכמה גרסאות היו בחודש
  const evs = list.filter((j) => /^[0-9a-f]{12}$/.test(String(j.ev || '')));
  return { jobs: list.length, agents: out, ev: evs.length ? { v: evs[evs.length - 1].ev, n: new Set(evs.map((j) => j.ev)).size } : null };
}

module.exports = { KEEP, NEW_MS, AGENTS, effortOf, agentsView };
