/* מגדל הפיקוח 2.0 — בעיות וספרי הפעלה (v376). בהשראת ServiceNow: Problem · KEDB (שגיאות מוכרות ועקיפות), AIOps LEAP (מה שווה
   אוטומציה / תיקון קבוע), Playbooks (פעולות תיקון לפי רמת סיכון). ITIL: תקלה = מה שקרה לעבודה; בעיה = הסיבה שחוזרת.
   הבעיה = רשומה בספר התיקונים (v364, טביעת האצבע של עצירת המגדל). המצב נגזר — בלי שדה נוסף לנהל:
     n חדשה (אין תיקון) → d אובחנה (Claude הציע תיקון שמחכה לאישור) → w עקיפה ידועה (תיקון מאושר, נמסר לכל עבודה)
     → f לא חזרה (PRB_CLEAR עבודות הסתיימו בהצלחה מאז הפעם האחרונה — "נסגר רק אחרי שהוכח שלא חזר", עיקרון 7)
   "שווה לתקן בקוד" = כמה פעמים חזרה × כמה עלו העבודות שנפגעו (לפחות PRB_MIN_USD לפעם, כדי שבעיה זולה שחוזרת הרבה לא תיעלם).
   ספרי ההפעלה = מה שהמערכת כבר עושה לבד (בטוח — לא משנה את התוצאה) ומה רק באישורך (משנה את התוצאה), עם כמה פעמים קרה בחודש.
   רק מספרים, מזהים וקודים — בלי שמות קבצים ובלי טקסט חופשי (התיקון עצמו מגיע מ־fbView, שכבר ניקה אותו). הקובץ טהור — בלי רשת. */
const DAY = 86400e3, KEEP = 30 * DAY;
const PRB_CLEAR = 3;          // עבודות שהצליחו מאז הפעם האחרונה — עד אז הבעיה עוד "חיה"
const PRB_MIN_USD = 0.5;
const STATES = ['n', 'd', 'w', 'f'];
const FP_RE = /^[0-9a-f]{12}$/;
const r2 = (v) => Math.round(v * 100) / 100;
const usdOf = (j) => [].concat(Array.isArray(j.use0) ? j.use0 : [], Array.isArray(j.use) ? j.use : [])
  .reduce((s, r) => s + (r && typeof r.usd === 'number' ? r.usd : 0), 0);
const doneAt = (j) => (j && j.state === 'done' ? j.ended || j.updated || 0 : 0);

/* fb = הפלט של fbView (כבר מסונן ומנוקה), inc = רשומות התקלות (studioOps.inc), jobs = רשימת העבודות של op:'jobs' */
function problemsView(fb, inc, jobs, now) {
  const list = (Array.isArray(fb) ? fb : []).filter((e) => e && FP_RE.test(String(e.fp || '')) && Number.isInteger(e.no));
  const incs = (Array.isArray(inc) ? inc : []).filter((x) => x && FP_RE.test(String(x.fp || '')) && Number.isInteger(x.no));
  const tr = (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.kind === 'tr');
  const byId = new Map(tr.map((j) => [j.id, j]));
  const out = list.map((e) => {
    const mine = incs.filter((x) => x.fp === e.fp).sort((a, b) => a.no - b.no);
    const ids = Array.from(new Set(mine.map((x) => x.j)));
    const usd = r2(ids.reduce((s, id) => s + (byId.has(id) ? usdOf(byId.get(id)) : 0), 0));
    const after = tr.filter((j) => doneAt(j) > (e.at || 0)).length;
    const state = after >= PRB_CLEAR ? 'f' : e.fix ? 'w' : e.px ? 'd' : 'n';
    const score = state === 'f' ? 0 : r2((e.n || 0) * Math.max(usd, PRB_MIN_USD));
    return { no: e.no, fp: e.fp, why: e.why, st: e.st || '', state, n: e.n || 0, auto: e.auto || 0, jobs: ids.length, usd,
      after: Math.min(after, 99), at: e.at || 0, fix: e.fix || '', px: e.px || '', score, inc: mine.map((x) => x.no).slice(-8) };
  });
  // "שווה לתקן בקוד": הפתוחות לפי חיסכון, ואז מה שכבר לא חזר
  out.sort((a, b) => (a.state === 'f') - (b.state === 'f') || b.score - a.score || b.at - a.at);
  return { list: out, open: out.filter((x) => x.state !== 'f').length };
}

/* ספרי ההפעלה — r: 's' בטוח (רץ לבד) / 'c' משנה את התוצאה (רק באישורך). n = כמה פעמים ב־30 הימים האחרונים */
const RUNBOOKS = [['net', 's'], ['known', 's'], ['cheap', 'c']];
function runbooksView(fb, jobs, now) {
  const recent = (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.kind === 'tr' && (j.created || 0) >= now - KEEP);
  const fbl = (Array.isArray(fb) ? fb : []).filter((e) => e && FP_RE.test(String(e.fp || '')));
  const n = {
    net: recent.reduce((s, j) => s + Math.min(Number.isInteger(j.ar) ? j.ar : 0, 9), 0),
    known: fbl.filter((e) => (e.ua || 0) >= now - KEEP).reduce((s, e) => s + (Number.isInteger(e.auto) ? e.auto : 0), 0),
    cheap: recent.filter((j) => j.spec && j.spec.dm).length,
  };
  return RUNBOOKS.map(([k, r]) => ({ k, r, n: n[k] }));
}

module.exports = { PRB_CLEAR, PRB_MIN_USD, STATES, RUNBOOKS, problemsView, runbooksView };
