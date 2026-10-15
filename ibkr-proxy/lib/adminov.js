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
  return { v: 1, at: now, sum: { urgent, all: items.length }, items, run };
}

module.exports = { DATES, overview, swBuild, daysTo };
