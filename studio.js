/* סטודיו התרגום. שלב 1 (v354): שלד — רשימת פרויקטים, פרויקט חדש (טיוטה), הגדרות ואשף החיבור.
   שלב 2 (v355): החיבור ל־Claude נשמר מוצפן בשרתון (אשף עם העתקה + "שמירה ובדיקה" אמיתית), עבודות בשרתון, העלאה מתחדשת
   ל־Google Drive של המשתמש (הקול קודם, מסך דולק, "רק ב־Wi‑Fi") ומסך ההתקדמות בשפה פשוטה. כל הרשת — ב־studionet.js;
   כאן רק הממשק (tests/studio-v354 אוכף: בלי פנייה ישירה לרשת מהקובץ הזה).
   נטען רק בלחיצה על "תרגום סרטונים" בתפריט (import דינמי מ־app.js, כמו library.js) — האפליקציה לא גדלה.
   אחסון: הגדרות, טיוטות ומצב העבודות ב־localStorage של החשבון (pwa_studio_v1, ב־ACCOUNT_KEYS) — רק פרטים קטנים,
   אף פעם לא הקובץ ואף פעם לא המפתח של ה־Routine (הוא רק בכספת בשרתון). קובץ שנבחר: ידית (File System Access) ב־IndexedDB
   כשהדפדפן תומך — כדי להמשיך העלאה אחרי רענון בלי לבחור שוב.
   "חזור" של המכשיר: עם CloseWatcher — רשומה אחת ומחסנית דפים בזיכרון; בלי — רשומה לכל דף (סעיף 18 ב־CLAUDE.md).
   מחרוזות: t() של app.js (STRINGS.he/en, מפתחות studio*) — כל מפתח כתוב כאן מילולית, והבדיקות מאמתות שהוא קיים בשתי השפות. */
import { createNet, probeVideo, extractAudio, stageEstimates, progressModel } from './studionet.js';
import { createBackup, waitOAuthCode } from './libbackup.js';

const T = (k, v) => (typeof t === 'function' ? t(k, v) : k);
export const LS_STUDIO = 'pwa_studio_v1';

/* מצבי התרגום — המספרים מהמבחן מול המתרגם האנושי של TED (נספח ה׳ בתוכנית). q = איכות, u = שימוש במנוי (מתוך 5),
   min = הערכת זמן לשעת ראיון בדקות. Opus 5.5 · Medium = המומלץ וברירת המחדל */
export const MODES = [
  { id: 'opus-medium', fam: 'opus', effort: 'Medium', q: 4, u: 3, min: 105, rec: true },
  { id: 'opus-high', fam: 'opus', effort: 'High', q: 4, u: 4, min: 125 },
  { id: 'opus-max', fam: 'opus', effort: 'Max', q: 5, u: 5, min: 160 },
  { id: 'sonnet-medium', fam: 'sonnet', effort: 'Medium', q: 2, u: 1, min: 85 },
  { id: 'sonnet-high', fam: 'sonnet', effort: 'High', q: 3, u: 2, min: 95 },
];
export const DEFAULT_MODE = 'opus-medium';
/* שפות: התמלול (Parakeet v2/v3, ivrit.ai, Omnilingual) מכסה גם שפות שלא ברשימה — זו רשימת הבחירה המהירה */
export const SOURCE_LANGS = ['en', 'he', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko'];
export const TARGET_LANGS = ['he', 'en', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko', 'am'];
const QUICK_LANGS = ['he', 'en', 'ar', 'ru', 'es', 'fr'];
export const STYLES = ['bold', 'classic', 'karaoke'];
export const OUTS = ['same', 'compact', 'mkv'];
export const CONNS = ['sub', 'copy', 'api'];
export const CAPS = [5, 10, 20, 50];   // מצב API: תקרה לעבודה אחת ($) — השרתון מגביל גם לפי מה שנשאר החודש
const TERMS_MAX = 1000;
const COMPACT_RATIO = 0.53;   // "דחוס" ≈ חצי מהמקור (נמדד על הראיון של אקמן)
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const FID_RE = /^[A-Za-z0-9_-]{10,100}$/;
const UPURI_RE = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/;   // כתובת העלאה של Drive — לא שום כתובת אחרת
const STATES = ['new', 'queued', 'running', 'done', 'failed', 'cancelled'];
const FINAL = ['done', 'failed', 'cancelled'];
/* החיבור ל־Claude: אותה בדיקת צורה כמו בשרתון (lib/studio.js) — כדי לענות מיד על הדבקה שגויה */
const ROUTINE_URL_RE = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/trig_[A-Za-z0-9]{8,64}\/fire$/;
const ROUTINE_KEY_RE = /^sk-ant-oat01-[A-Za-z0-9_-]{20,400}$/;
/* מה מעתיקים בשלב 1 של האשף: הכתובות לרשת של הסביבה, וסקריפט ההתקנה (שורה אחת שמריצה את translator/setup.sh מהריפו —
   כך מה שיתווסף בשלב 3 לא דורש הדבקה חוזרת) */
const SETUP_LINE = 'curl -fsSL https://raw.githubusercontent.com/yishaiguedj1/portfolio-pwa/main/translator/setup.sh | bash || true';
// v359: גם PyTorch (torch של CPU), GitHub (ffmpeg מ־Releases, setup.sh מ־raw) ו־dl.fbaipublicfiles.com (מודל היישור MMS) — מההרצה האמיתית
const HOSTS_EXTRA = ['huggingface.co', '*.huggingface.co', '*.hf.co', '*.pytorch.org', 'github.com', '*.githubusercontent.com', 'dl.fbaipublicfiles.com'];

/* ---------------- טהורות (נבדקות ב־node) ---------------- */
export function defaultSettings() {
  return { mode: DEFAULT_MODE, to: ['he'], out: { same: true, compact: false, mkv: false }, style: 'bold', conn: 'sub', wifi: false, cap: 10 };
}
function normOut(o) {
  const d = { same: true, compact: false, mkv: false };
  if (o && typeof o === 'object') for (const k of OUTS) if (typeof o[k] === 'boolean') d[k] = o[k];
  return d;
}
function normTo(a) {
  const to = Array.isArray(a) ? a.filter((c, i) => TARGET_LANGS.includes(c) && a.indexOf(c) === i) : [];
  return to.length ? to : ['he'];
}
export function normSettings(o) {
  const s = defaultSettings();
  if (!o || typeof o !== 'object') return s;
  if (MODES.some((m) => m.id === o.mode)) s.mode = o.mode;
  s.to = normTo(o.to);
  s.out = normOut(o.out);
  if (STYLES.includes(o.style)) s.style = o.style;
  if (CONNS.includes(o.conn)) s.conn = o.conn;
  s.wifi = o.wifi === true;
  if (CAPS.includes(o.cap)) s.cap = o.cap;
  return s;
}
/* מצב "API של המערכת" מהשרתון (status): התקציב החודשי, כמה שרתים מחוברים, והאם אתה המנהל */
export function normApi(a) {
  if (!a || typeof a !== 'object') return null;
  const n = (x) => (Number.isFinite(+x) && +x >= 0 ? +x : 0);
  return { month: n(a.month), cap: n(a.cap), online: Math.floor(n(a.online)), servers: Math.floor(n(a.servers)), admin: a.admin === true };
}
/* השרתים (srvList, למנהל) — רק מה שמוצג; השם טקסט בלבד */
export function normServers(list) {
  if (!Array.isArray(list)) return null;
  const n = (x) => (Number.isFinite(+x) ? +x : null);
  return list.slice(0, 10).filter((x) => x && /^[a-z0-9]{12}$/.test(String(x.id || ''))).map((x) => ({
    id: x.id, name: String(x.name || x.id).slice(0, 40), seen: Math.max(0, n(x.seen) || 0), online: x.online === true, paused: x.paused === true,
    hb: x.hb && typeof x.hb === 'object' ? { v: /^[0-9a-f]{7,12}$|^dev$/.test(String(x.hb.v || '')) ? x.hb.v : '', disk: n(x.hb.disk), mem: n(x.hb.mem), free: n(x.hb.free) } : null,
    job: x.job && JOB_RE.test(String(x.job.id || '')) ? { id: x.job.id, name: String(x.job.name || '').slice(0, 200) } : null }));
}
/* מצב שרת במילה אחת: מושהה גובר; אחרת מחובר/לא */
export const srvState = (sv) => (sv.paused ? 'paused' : sv.online ? 'on' : 'off');
export function normDraft(d) {
  if (!d || typeof d !== 'object' || typeof d.id !== 'string' || !/^[a-z0-9]{4,40}$/i.test(d.id)) return null;
  const s = normSettings(d);
  return {
    id: d.id,
    name: String(d.name || '').slice(0, 200),
    size: Math.max(0, Math.floor(Number(d.size) || 0)),
    type: String(d.type || '').slice(0, 60),
    created: Math.max(0, Number(d.created) || 0),
    from: d.from === 'auto' || SOURCE_LANGS.includes(d.from) ? d.from : 'auto',
    to: s.to, mode: s.mode, out: s.out, style: s.style,
    terms: String(d.terms || '').slice(0, TERMS_MAX),
  };
}
const num = (x) => Math.max(0, Math.floor(Number(x) || 0));
/* עבודה (שלב 2): הפרטים ששלחנו לשרתון, מצב ההעלאה בטלפון (כתובות ההעלאה של Drive, כמה עלה) והמצב האחרון מהשרתון */
export function normJob(j) {
  if (!j || typeof j !== 'object' || !JOB_RE.test(String(j.id || ''))) return null;
  const sp = j.spec && typeof j.spec === 'object' ? j.spec : {};
  const spec = {
    name: String(sp.name || '').slice(0, 200), size: num(sp.size), type: String(sp.type || '').slice(0, 60), dur: num(sp.dur),
    from: sp.from === 'auto' || SOURCE_LANGS.includes(sp.from) ? sp.from : 'auto', to: normTo(sp.to),
    mode: MODES.some((m) => m.id === sp.mode) ? sp.mode : DEFAULT_MODE,
    out: Array.isArray(sp.out) ? sp.out.filter((k, i) => OUTS.includes(k) && sp.out.indexOf(k) === i) : ['same'],
    style: STYLES.includes(sp.style) ? sp.style : 'bold', terms: String(sp.terms || '').slice(0, TERMS_MAX),
  };
  const u = j.up && typeof j.up === 'object' ? j.up : {};
  const part = (x) => {
    x = x && typeof x === 'object' ? x : {};
    return { done: x.done === true, id: FID_RE.test(String(x.id || '')) ? x.id : '', size: num(x.size),
      uri: UPURI_RE.test(String(x.uri || '')) ? String(x.uri).slice(0, 2000) : '', sent: num(x.sent) };
  };
  const up = { folder: FID_RE.test(String(u.folder || '')) ? u.folder : '', a: part(u.a), v: part(u.v),
    noAudio: typeof u.noAudio === 'string' ? u.noAudio.slice(0, 20) : '', started: num(u.started),
    wait: typeof u.wait === 'string' ? u.wait.slice(0, 40) : '', took: num(u.took) };
  const fp = j.fp && typeof j.fp === 'object' ? { name: String(j.fp.name || '').slice(0, 200), size: num(j.fp.size), lm: num(j.fp.lm) } : null;
  const s = j.srv && typeof j.srv === 'object' ? j.srv : null;
  const srv = s ? {
    state: STATES.includes(s.state) ? s.state : 'new', err: String(s.err || '').slice(0, 40), fired: num(s.fired), ended: num(s.ended),
    prog: s.prog && typeof s.prog === 'object' && !Array.isArray(s.prog) ? s.prog : null,
    sess: s.sess && typeof s.sess.url === 'string' && /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+$/.test(s.sess.url) ? { url: s.sess.url } : null,
    ed: typeof s.ed === 'string' ? s.ed.slice(0, 140) : '',   // v356: פרטי ההפעלה שנכשלה (סטטוס · סוג · מזהה בקשה)
    // v358: התוצרים בתיקיית העבודה ב־Drive (מהשרתון: files.o; בשמירה המקומית: out)
    out: (Array.isArray(s.out) ? s.out : s.files && Array.isArray(s.files.o) ? s.files.o : []).slice(0, 6)
      .filter((o) => o && FID_RE.test(String(o.id || '')) && ['compact', 'same', 'mkv', 'srt'].includes(o.k))
      .map((o) => ({ id: o.id, k: o.k, size: num(o.size) })),
    use: normUse(s.use),   // v359: טוקנים ועלות (מהעובד, דרך השרתון)
    eng: s.eng === 'api' ? 'api' : 'sub',   // מצב API: העבודה רצה על השרת של המערכת (בתור עד ששרת פנוי)
    qa: normQa(s.qa),      // שאלה מ־Claude באמצע העבודה (והתשובה)
    ck: normCk(s.ck),      // v361: נקודת השמירה האחרונה (אחרי איזה שלב)
    stale: s.stale === true, fires: num(s.fires),
    tw: normTw(s.tw),      // v362: מגדל הפיקוח
  } : null;
  return { id: j.id, created: num(j.created), spec, up, fp, srv };
}
/* שלב 3 סבב ד׳: שאלה מ־Claude באמצע העבודה — אותה בדיקה כמו בשרתון (lib/studio.js normAsk). הטקסט מוצג רק כטקסט */
export function normQa(q) {
  if (!q || typeof q !== 'object' || !/^q[a-z0-9]{1,12}$/.test(String(q.id || '')) || typeof q.q !== 'string' || !q.q) return null;
  const o = (Array.isArray(q.o) ? q.o : []).filter((x) => typeof x === 'string' && x).slice(0, 4).map((x) => x.slice(0, 80));
  const d = Number.isInteger(q.d) && q.d >= 0 && q.d < o.length ? q.d : -1;
  const a = q.a && typeof q.a === 'object' ? { i: Number.isInteger(q.a.i) ? q.a.i : -1, t: String(q.a.t || '').slice(0, 200), auto: q.a.auto === true } : null;
  return { id: q.id, q: q.q.slice(0, 300), o, d, w: num(q.w) || 480, at: num(q.at), a };
}
/* v362: מגדל הפיקוח — אותה בדיקה כמו בשרתון (lib/studio.js normTower) */
const TW_WHY = ['cost', 'cap', 'loop', 'calls', 'idle'];
export function normTw(t) {
  if (!t || typeof t !== 'object' || !['ok', 'warn', 'red'].includes(t.lv)) return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return { lv: t.lv, x: n(t.x), usd: n(t.usd), exp: n(t.exp), why: TW_WHY.includes(t.why) ? t.why : '', n: n(t.n), min: n(t.min),
    nj: t.b === 'u' ? n(t.nj) : 0,     // v363: "הרגיל" נלמד מ־nj עבודות שלך (0 = המדידות שלנו)
    fp: /^[0-9a-f]{12}$/.test(String(t.fp || '')) ? t.fp : '' };   // v364: טביעת האצבע של העצירה (ספר התיקונים)
}
/* v365: מגדל הפיקוח 2.0 — בריאות, זמינות, MTTR, מצב לכל רכיב והתראות פתוחות (מהשרתון, op status). רק מספרים ומזהים מהקטלוג */
export const OPS_COMPONENTS = ['phone', 'drive', 'server', 'routine', 'claude', 'vt'];
export function normOps(o) {
  if (!o || typeof o !== 'object') return null;
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : null);
  const comp = {};
  for (const c of OPS_COMPONENTS) comp[c] = Number.isInteger(o.comp && o.comp[c]) && o.comp[c] >= 0 && o.comp[c] <= 4 ? o.comp[c] : 0;
  const open = (Array.isArray(o.open) ? o.open : []).filter((a) => a && OPS_COMPONENTS.includes(a.c) && /^[a-z_]{2,12}$/.test(String(a.k || '')) && Number.isInteger(a.s) && a.s >= 1 && a.s <= 4)
    .slice(0, 20).map((a) => ({ c: a.c, k: a.k, s: a.s, j: JOB_RE.test(String(a.j || '')) ? a.j : '', n: num(a.n, 1, 1e6) || 1, l: num(a.l, 0, 1e15) || 0, rel: num(a.rel, 0, 100) || 0 }));
  return { score: num(o.score, 0, 100) ?? 100, avail: num(o.avail, 0, 100) ?? 100, mttr: num(o.mttr, 0, 1e6), comp, open };
}
/* v364: ספר התיקונים (מהשרתון, op status) — התיקון הוא טקסט מ־Claude: רק מחרוזת, מוצג כטקסט בלבד */
export function normFb(a) {
  if (!Array.isArray(a)) return null;
  const n = (v) => (Number.isInteger(v) && v >= 0 ? Math.min(v, 1e4) : 0);
  return a.filter((e) => e && /^[0-9a-f]{12}$/.test(String(e.fp || '')) && TW_WHY.includes(e.why)).slice(0, 30).map((e) => ({
    fp: e.fp, why: e.why, st: ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'].includes(e.st) ? e.st : '', n: n(e.n), auto: n(e.auto),
    fix: typeof e.fix === 'string' ? e.fix.slice(0, 160) : '', px: typeof e.px === 'string' ? e.px.slice(0, 160) : '',   // v366: הצעה שממתינה לאישור
    at: typeof e.at === 'number' ? e.at : 0 }));
}
/* v363: "הרגיל" לכל מצב (מהשרתון, op status) — לשעת סרטון; d = עוד אין מספיק עבודות, אז המדידות שלנו */
export function normNorms(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  for (const m of MODES) {
    const v = o[m.id];
    if (!v || typeof v !== 'object' || !(typeof v.ph === 'number' && v.ph > 0 && v.ph < 1e4)) continue;
    const c = Number.isInteger(v.n) && v.n >= 0 ? Math.min(v.n, 1000) : 0;
    out[m.id] = { ph: v.ph, mx: typeof v.mx === 'number' && v.mx >= v.ph ? v.mx : v.ph, n: c, d: v.d === true };
  }
  return Object.keys(out).length ? out : null;
}
/* עצרנו בגלל המגדל? (העבודה נכשלה עם tower_stop והפרטים הגיעו) */
export function towerStopped(rec) {
  const s = rec && rec.srv;
  return !!(s && s.state === 'failed' && s.err === 'tower_stop' && s.tw && s.tw.lv === 'red');
}
/* v361: נקודת השמירה האחרונה — אחרי תמלול / יישור / תרגום / ביקורת. CK_STAGE = השלב בטלפון שהיא סוגרת */
const CK_STAGE = { asr: 'tr', al: 'al', tl: 'tl', rv: 'rv' };
function ckName(s) {
  switch (s) {
    case 'asr': return T('studioCkAsr');
    case 'al': return T('studioCkAl');
    case 'tl': return T('studioCkTl');
    default: return T('studioCkRv');
  }
}
export function normCk(c) {
  return c && typeof c === 'object' && Object.prototype.hasOwnProperty.call(CK_STAGE, c.s) ? { s: c.s, at: num(c.at) } : null;
}
/* אפשר "המשך"? עבודת תרגום שנכשלה / בוטלה / נתקעה (השרתון בודק שוב) */
export function canResume(rec) {
  const s = rec && rec.srv;
  if (!s || !(rec.up.a.done || rec.up.v.done || rec.up.started)) return false;
  return s.state === 'failed' || s.state === 'cancelled' || ((s.state === 'running' || s.state === 'queued') && s.stale);
}
/* יש שאלה פתוחה שמחכה לתשובה (והעבודה עוד רצה) */
export function qaPending(rec) {
  const s = rec && rec.srv;
  return !!(s && s.qa && !s.qa.a && (s.state === 'queued' || s.state === 'running'));
}
/* v359: טוקנים ועלות של עבודה — אותה בדיקה כמו בשרתון (lib/studio.js normUsage): עד 6 שורות, מודל claude-…, מספרים בלבד */
const USE_KINDS = ['main', 'tl', 'rv', 'sub'];
export function normUse(a) {
  if (!Array.isArray(a) || !a.length || a.length > 6) return null;
  const out = [];
  for (const r of a) {
    if (!r || typeof r !== 'object' || !USE_KINDS.includes(r.k) || !/^claude-[a-z0-9-]{1,50}$/.test(String(r.m || ''))) return null;
    const row = { k: r.k, m: r.m };
    for (const f of ['n', 'i', 'o', 'cr', 'c5', 'c1', 'op']) row[f] = num(r[f]);
    for (const f of ['usd', 'oc']) row[f] = r[f] == null ? null : (Number.isFinite(+r[f]) && +r[f] >= 0 ? +r[f] : null);
    out.push(row);
  }
  return out;
}
/* "claude-opus-5-5" → "Opus 5.5" (מזהה אחר — כמו שהוא) */
export function modelLabel(id) {
  const m = /^claude-([a-z]+)-(\d+)-(\d+)\b/.exec(String(id || ''));
  return m ? m[1][0].toUpperCase() + m[1].slice(1) + ' ' + m[2] + '.' + m[3] : String(id || '');
}
/* 1234567 → "1.2M" · 85000 → "85K" · 900 → "900" */
export function fmtTok(n) {
  n = num(n);
  if (n >= 1e6) return (n >= 1e7 ? Math.round(n / 1e6) : (n / 1e6).toFixed(1)) + 'M';
  if (n >= 1e3) return Math.round(n / 1e3) + 'K';
  return String(n);
}
/* $2.00 · פחות מסנט — "<$0.01" · אפס — "$0" */
export function fmtUsd(v) {
  v = Number(v) || 0;
  if (v <= 0) return '$0';
  if (v < 0.01) return '<$0.01';
  return '$' + v.toFixed(2);
}
/* כרטיס "עלות": שורה לכל שלב (תיאום / תרגום / ביקורת / סוכן־משנה אחר), סכום כולל, והאם סוכן־משנה רץ על מודל אחר מהמצב שנבחר.
   מודל בלי מחירון — usd null: השורה בלי מחיר והסכום מסומן "לפחות" */
export function costView(use, modeId) {
  const rows = normUse(use);
  if (!rows) return null;
  const fam = modeById(modeId).fam;
  const seen = {};
  let total = 0, partial = false;
  const out = rows.map((r) => {
    seen[r.k] = (seen[r.k] || 0) + 1;
    if (r.usd == null) partial = true; else total += r.usd;
    const sub = r.k !== 'main';
    const tok = r.i + r.o + r.cr + r.c5 + r.c1;
    const off = (r.k === 'tl' || r.k === 'rv') && !new RegExp('^claude-' + fam + '-').test(r.m);
    return { k: r.k, nth: seen[r.k], model: modelLabel(r.m), tok, usd: r.usd, open: sub && r.op ? { tok: r.op, usd: r.oc } : null, off };
  });
  for (const r of out) if (seen[r.k] < 2) r.nth = 0;   // מספור רק כשיש כמה מאותו סוג
  return { rows: out, total, partial, want: modelLabel('claude-' + fam + '-5-5'), warn: out.filter((r) => r.off) };
}
export function normStore(o) {
  const src = o && typeof o === 'object' ? o : {};
  const seen = new Set();
  const drafts = (Array.isArray(src.drafts) ? src.drafts : []).map(normDraft)
    .filter((d) => d && !seen.has(d.id) && seen.add(d.id)).slice(0, 200);
  const seenJ = new Set();
  const jobs = (Array.isArray(src.jobs) ? src.jobs : []).map(normJob)
    .filter((j) => j && !seenJ.has(j.id) && seenJ.add(j.id)).slice(0, 100);
  const c = src.conn && typeof src.conn === 'object' ? { hint: String(src.conn.hint || '').slice(0, 24), ok: num(src.conn.ok), since: num(src.conn.since) } : null;
  const d = src.drive && typeof src.drive === 'object' ? { connected: src.drive.connected === true, email: String(src.drive.email || '').slice(0, 120), configured: src.drive.configured !== false } : null;
  return { settings: normSettings(src.settings), drafts, jobs, conn: c, drive: d };
}
/* טיוטה מהטופס: רק פרטי הקובץ (שם, גודל, סוג) — הקובץ עצמו לא נשמר */
export function newDraft(form, created, id) {
  const f = form.file || {};
  return normDraft({
    id, created, name: f.name, size: f.size, type: f.type,
    from: form.from, to: form.to, mode: form.mode, out: form.out, style: form.style, terms: form.terms,
  });
}
/* 3.2GB · 312MB · 84KB (יחידות של 1024, בלי רווח — כמו בשאר האפליקציה) */
export function fmtSize(n) {
  n = Math.max(0, Number(n) || 0);
  const G = 1073741824, M = 1048576;
  if (n >= G) return (n / G).toFixed(n >= 10 * G ? 0 : 1) + 'GB';
  if (n >= M) return Math.round(n / M) + 'MB';
  return Math.max(1, Math.round(n / 1024)) + 'KB';
}
/* 105 → "1:45" */
export function fmtHM(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0');
}
/* מה מקבלים בפועל: הבחירות + SRT תמיד */
export function outList(out) { return OUTS.filter((k) => out && out[k]).concat('srt'); }
export function modeById(id) { return MODES.find((m) => m.id === id) || MODES[0]; }
export function modeName(m) { return (m.fam === 'opus' ? 'Opus 5.5' : 'Sonnet 5.5') + ' · ' + m.effort; }
/* שם תצוגה לפרויקט מהקובץ: בלי סיומת, קווים תחתונים → רווחים ("Ackman_TKP_interview.mp4" → "Ackman TKP interview") */
export function fileTitle(name) {
  const t = String(name || '').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  return t || String(name || '');
}
export function fileExt(name) { const m = /\.([A-Za-z0-9]{1,5})$/.exec(String(name || '')); return m ? m[1].toUpperCase() : ''; }
export function langName(code, ui) {
  try { return new Intl.DisplayNames([ui || 'he'], { type: 'language' }).of(code) || code; } catch (e) { return code; }
}
const nativeName = (c) => { const n = langName(c, c); return n.charAt(0).toLocaleUpperCase(c) + n.slice(1); };
/* אותו קובץ? (המשך העלאה אחרי רענון — בוחרים שוב, ובודקים שזה באמת הוא): שם + גודל מדויק בבייטים.
   לא תאריך השינוי — באנדרואיד קובץ מהגלריה מקבל לפעמים תאריך חדש בכל בחירה. בסוף השרתון מאמת שוב את הגודל מול Drive */
export function sameFile(file, fp) {
  if (!file || !fp) return false;
  return file.name === fp.name && file.size === fp.size && fp.size > 0;
}
/* העבודה מנקודת המבט של המשתמש: מה קורה עכשיו (מצב השרתון + ההעלאה בטלפון) */
export function jobPhase(rec, run) {
  const s = rec.srv ? rec.srv.state : 'new';
  if (s === 'done' || s === 'failed' || s === 'cancelled') return s;
  if ((s === 'running' || s === 'queued') && rec.srv.stale) return 'stuck';   // v361: הסשן נפל — אפשר להמשיך
  if (run && run.active) return run.wait ? 'wait' : run.phase === 'extract' || run.phase === 'prep' ? 'extract' : run.phase === 'audio' ? 'audio' : 'video';
  if (run && run.phase === 'error') return 'error';
  if (s === 'queued' || s === 'running') return s;
  const upDone = rec.up.v.done && (rec.up.a.done || rec.up.noAudio);
  if (!upDone) return run && run.need ? 'need' : 'paused';
  return rec.up.started ? 'queued' : 'ready';
}

/* ---------------- מחרוזות לפי מזהה (כל מפתח מילולי) ---------------- */
function modeSub(id) {
  switch (id) {
    case 'opus-medium': return T('studioMsOpusMed');
    case 'opus-high': return T('studioMsOpusHigh');
    case 'opus-max': return T('studioMsOpusMax');
    case 'sonnet-high': return T('studioMsSonHigh');
    default: return T('studioMsSonMed');
  }
}
function effortSub(id) {
  switch (id) {
    case 'opus-medium': return T('studioEfOpusMed');
    case 'opus-high': return T('studioEfOpusHigh');
    case 'opus-max': return T('studioEfOpusMax');
    case 'sonnet-high': return T('studioEfSonHigh');
    default: return T('studioEfSonMed');
  }
}
function modeSum(id) {
  switch (id) {
    case 'opus-medium': return T('studioSumOpusMed');
    case 'opus-high': return T('studioSumOpusHigh');
    case 'opus-max': return T('studioSumOpusMax');
    case 'sonnet-high': return T('studioSumSonHigh');
    default: return T('studioSumSonMed');
  }
}
function outName(k) {
  switch (k) {
    case 'same': return T('studioOutSame');
    case 'compact': return T('studioOutCompact');
    case 'mkv': return T('studioOutMkv');
    default: return T('studioOutSrt');
  }
}
function outSub(k) {
  switch (k) {
    case 'same': return T('studioOutSameS');
    case 'compact': return T('studioOutCompactS');
    case 'mkv': return T('studioOutMkvS');
    default: return T('studioOutSrtS');
  }
}
const outShort = (k) => (k === 'srt' ? 'SRT' : k === 'same' ? T('studioOutSameShort') : outName(k));
const modeShort = (m) => (m.fam === 'opus' ? 'Opus ' : 'Sonnet ') + m.effort;   // לשורות צרות ("Opus Medium")
function styleName(k) {
  switch (k) {
    case 'classic': return T('studioStyleClassic');
    case 'karaoke': return T('studioStyleKaraoke');
    default: return T('studioStyleBold');
  }
}
/* שלבי העבודה — שם פשוט ומשפט הסבר (מהתוכנית: "שגם ילד וגם אדם מבוגר יבינו") */
function stageName(id, to) {
  switch (id) {
    case 'up': return T('studioStgUp');
    case 'tr': return T('studioStgTr');
    case 'al': return T('studioStgAl');
    case 'tl': return T('studioStgTl', { lang: to });
    case 'rv': return T('studioStgRv');
    case 'bn': return T('studioStgBn');
    default: return T('studioStgSv');
  }
}
function stageSub(id) {
  switch (id) {
    case 'up': return T('studioStgUpS');
    case 'tr': return T('studioStgTrS');
    case 'al': return T('studioStgAlS');
    case 'tl': return T('studioStgTlS');
    case 'rv': return T('studioStgRvS');
    case 'bn': return T('studioStgBnS');
    default: return T('studioStgSvS');
  }
}
/* שגיאות — משפט אחד שאומר מה קרה ומה עושים */
function errText(code, extra) {
  switch (code) {
    case 'signin': case 'no_auth': return T('studioErrSignin');
    case 'not_allowed': return T('studioErrDenied');
    case 'month_cap': return T('studioErrMonthCap');
    case 'no_server': return T('studioErrNoServer');
    case 'not_admin': return T('studioErrNotAdmin');
    case 'net': case 'http_0': return T('studioErrNet');
    case 'drive_full': return T('studioErrDriveFull');
    case 'not_connected': case 'revoked': case 'drive_auth': return T('studioErrDrive');
    case 'conn_missing': return T('studioErrConn');
    case 'gd_not_configured': return T('studioDriveNoCfg');
    case 'too_many': return T('studioErrTooMany');
    case 'file_size': case 'file_bad': case 'file_missing': return T('studioErrFile');
    case 'routine_auth': return T('studioErrRAuth');
    case 'routine_missing': return T('studioErrRMissing');
    case 'routine_paused': return T('studioErrRPaused');
    case 'routine_forbidden': return T('studioErrRForbidden');
    case 'routine_rate': return T('studioErrRRate', { m: Math.max(1, Math.ceil(((extra && extra.retry) || 3600) / 60)) });
    case 'routine_down': case 'routine_reply': return T('studioErrRDown');
    case 'routine_net': return T('studioErrRNet');
    case 'no_claim': return T('studioErrNoClaim');
    case 'budget': return T('studioErrBudget');
    case 'wait': return T('studioErrWait', { s: Math.max(1, (extra && extra.retry) || 60) });
    case 'worker_not_ready': return T('studioWaitWorker');
    case 'bad_url': return T('studioErrBadUrl');
    case 'bad_key': return T('studioErrBadKey');
    case 'vault_not_configured': return T('studioErrVault');
    case 'stalled': return T('studioErrNet');
    case 'resume_limit': return T('studioErrResumeLimit');
    case 'tower_stop': return T('studioErrTower');
    default: return T('studioErrGeneric', { c: String(code || '?').slice(0, 30) });
  }
}

/* ---------------- מצב ואחסון ---------------- */
let root = null;
let store = normStore(null);
let form = null;                  // טופס פרויקט חדש/עריכה — בזיכרון בין הטופס לדף בחירת השפות; נמחק ביציאה לרשימה
const ui = { view: 'home', param: null, access: '', kinds: [], starting: false, driveBusy: false, wiz: { url: '', key: '', busy: false, err: '' }, norm: null, fb: null, ops: null, api: null, servers: null, srvQueue: 0, newToken: '', srvBusy: false };
const scrolls = {};               // מיקום הגלילה של כל דף — "חזור" מחזיר אליו

const uiLang = () => (document.documentElement.lang === 'en' ? 'en' : 'he');
const arrow = () => (document.documentElement.dir === 'ltr' ? ' → ' : ' ← ');
const isIOS = () => typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent || '') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
function flashSafe(m) { if (typeof flash === 'function') flash(m); }
function load() {
  try { return normStore(JSON.parse(localStorage.getItem(LS_STUDIO) || 'null')); } catch (e) { return normStore(null); }
}
function save() {
  try { localStorage.setItem(LS_STUDIO, JSON.stringify(store)); return true; } catch (e) { flashSafe(T('studioSaveErr')); return false; }
}
let saveT = 0;                    // שמירה מרוכזת בזמן העלאה (כמה כמה שניות, לא בכל חתיכה)
const saveSoon = () => { if (!saveT) saveT = setTimeout(() => { saveT = 0; save(); }, 3000); };
const newId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
function freshForm(d) {
  const s = d || store.settings;
  return {
    id: d ? d.id : null,
    file: d && d.name ? { name: d.name, size: d.size, type: d.type } : null,
    fileObj: null, handle: null,    // הקובץ עצמו — רק בזיכרון, רק עד ההתחלה
    from: d ? d.from : 'auto',
    to: s.to.slice(), mode: s.mode, out: Object.assign({}, s.out), style: s.style,
    terms: d ? d.terms : '',
  };
}
/* "עברית, אנגלית" / "עברית ועוד 2" — בלי סימן פלוס שמתהפך ב־RTL */
const langsSum = (to) => { const n = to.map((c) => langName(c, uiLang())); return n.length <= 2 ? n.join(', ') : n[0] + ' ' + T('studioMoreN', { n: n.length - 1 }); };
const langsText = (from, to) => (from === 'auto' ? T('studioAuto') : langName(from, uiLang())) + arrow() + langsSum(to);
const approx = (v) => T('studioApprox', { v });   // "כ־3.2GB" בעברית (טילדה מתהפכת ב־RTL), "~3.2GB" באנגלית
/* שם קובץ: מבודד (LTR בתוך עברית) עם נקודות שבירה אחרי _ . - — בלי לשבור באמצע מילה */
function fileNameEl(name) {
  const b = document.createElement('bdi');
  String(name).split(/(?<=[_.\-])/).forEach((part, i) => { if (i) b.append(document.createElement('wbr')); b.append(part); });
  return b;
}
/* זמנים בשפה פשוטה */
function fmtLeft(sec) {             // "55 דקות" / "שעה ו־40 דק׳" — בראש מסך ההתקדמות
  const m = Math.round(Math.max(0, sec) / 60);
  if (m < 1) return T('studioLt1');
  if (m < 60) return T('studioMinLong', { m });
  return T('studioHM', { h: Math.floor(m / 60), m: m % 60 });
}
function fmtShort(sec) {            // "8 דק׳" / "1:05 ש׳" — בשורות השלבים
  const m = Math.max(1, Math.round(Math.max(0, sec) / 60));
  return m < 60 ? T('studioMinShort', { m }) : T('studioHMShort', { t: fmtHM(m) });
}
function fmtClock(ms) {
  try {
    const o = { hour: '2-digit', minute: '2-digit' };
    if (new Date(ms).toDateString() !== new Date().toDateString()) o.weekday = 'short';
    return new Intl.DateTimeFormat(uiLang(), o).format(ms);
  } catch (e) { return ''; }
}
/* אורך סרטון: "2:30" / "1:17:05" */
function fmtDur(sec) {
  const t = Math.max(0, Math.round(sec)), hh = Math.floor(t / 3600), mm = Math.floor((t % 3600) / 60), ss = String(t % 60).padStart(2, '0');
  return hh ? hh + ':' + String(mm).padStart(2, '0') + ':' + ss : mm + ':' + ss;
}
const fmtDate = (ms) => { try { return new Intl.DateTimeFormat(uiLang(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(ms); } catch (e) { return ''; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------- רשת (studionet.js) ---------------- */
async function idTok() {
  try {
    const u = typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length && firebase.auth().currentUser;
    return u ? await u.getIdToken() : '';
  } catch (e) { return ''; }
}
const proxyBase = () => (typeof IBKR_PROXY_DEFAULT !== 'undefined' && IBKR_PROXY_DEFAULT) || '';
const net = createNet({
  base: proxyBase,
  headers: () => (typeof ibkrProxyHeaders === 'function' ? ibkrProxyHeaders() : {}),
  idToken: idTok,
  online: () => typeof navigator === 'undefined' || navigator.onLine !== false,
});
/* חיבור Google Drive — אותו מנגנון של גיבוי הספרייה (libbackup.js), אבל לקוח OAuth נפרד בשרתון (v357); החלון נפתח בתוך הלחיצה */
let gdc = null;
function gd() {
  if (!gdc) gdc = createBackup({
    owner: () => { try { return localStorage.getItem('pwa_owner_v1') || 'local'; } catch (e) { return 'local'; } },
    libApi: (body) => net.driveApi(body), idToken: idTok,
    redirectUri: () => new URL('oauth.html', document.baseURI).href,
    openWindow: () => { try { return window.open('', 'snb-oauth', 'popup,width=480,height=700'); } catch (e) { return null; } },
    waitCode: waitOAuthCode,
    allBooksRaw: async () => [], putBook: async () => {}, getFile: async () => null,
    // לא לגעת בהגדרות של גיבוי הספרייה (pwa_libbk_v1) — החיבור כאן אחר; המצב מגיע מהשרתון (status)
    ls: (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })(),
  });
  return gdc;
}
let statusAt = 0;
async function refreshStatus(force) {
  if (!force && Date.now() - statusAt < 20000) return;
  statusAt = Date.now();
  const j = await net.api('status');
  if (j.ok) {
    ui.access = 'ok'; ui.kinds = Array.isArray(j.kinds) ? j.kinds : [];
    store.conn = j.conn ? { hint: String(j.conn.hint || ''), ok: num(j.conn.ok), since: num(j.conn.since) } : null;
    store.drive = j.drive ? { connected: !!j.drive.connected, email: String(j.drive.email || ''), configured: j.drive.configured !== false } : null;
    ui.norm = normNorms(j.norm) || ui.norm;
    ui.fb = normFb(j.fb) || ui.fb;
    ui.fm = j.fm === 'auto' ? 'auto' : 'suggest';   // v366: מסלול התיקונים (ברירת מחדל — הצעות לאישור)
    ui.ops = normOps(j.ops) || ui.ops;
    ui.api = normApi(j.api) || ui.api;   // מצב API של המערכת: תקציב חודשי ושרתים
    save();
  } else ui.access = j.error === 'signin' || j.error === 'no_auth' ? 'signin' : j.error === 'not_allowed' ? 'denied' : j.error === 'net' ? 'offline' : 'error';
  repaint();
}
let jobsAt = 0;
async function refreshJobs(force) {
  if (!force && Date.now() - jobsAt < 10000) return;
  jobsAt = Date.now();
  const j = await net.api('jobs');
  if (!j.ok || !Array.isArray(j.jobs)) return;
  if (Array.isArray(j.kinds)) ui.kinds = j.kinds;
  const have = new Map(store.jobs.map((x) => [x.id, x]));
  const ids = new Set();
  for (const sj of j.jobs) {
    if (!sj || !JOB_RE.test(String(sj.id || ''))) continue;
    ids.add(sj.id);
    const loc = have.get(sj.id);
    if (loc) loc.srv = normJob({ id: sj.id, srv: sj }).srv;
    else {                         // עבודה ממכשיר אחר / אחרי ניקוי — מה שכבר עלה רשום בשרתון
      const f = sj.files || {};
      const rec = normJob({ id: sj.id, created: sj.created, spec: sj.spec, srv: sj,
        up: { a: { done: !!f.a, id: f.a && f.a.id, size: f.a && f.a.size }, v: { done: !!f.v, id: f.v && f.v.id, size: f.v && f.v.size } } });
      if (rec) store.jobs.push(rec);
    }
  }
  store.jobs = store.jobs.filter((x) => ids.has(x.id) || (runs.get(x.id) && runs.get(x.id).active)).sort((a, b) => b.created - a.created);
  save();
  repaint();
}
const jobRec = (id) => store.jobs.find((x) => x.id === id) || null;

/* ---------------- ידיות לקבצים (File System Access) — המשך אחרי רענון בלי לבחור שוב ---------------- */
function hdb() {
  return new Promise((ok, no) => {
    const r = indexedDB.open('snb-studio', 1);
    r.onupgradeneeded = () => { try { r.result.createObjectStore('handles'); } catch (e) {} };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}
async function handleOp(mode, id, val) {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await hdb();
    return await new Promise((ok) => {
      const tx = db.transaction('handles', mode === 'get' ? 'readonly' : 'readwrite'), os = tx.objectStore('handles');
      const rq = mode === 'get' ? os.get(id) : mode === 'put' ? os.put(val, id) : os.delete(id);
      rq.onsuccess = () => ok(mode === 'get' ? rq.result || null : null); rq.onerror = () => ok(null);
    });
  } catch (e) { return null; }
}
const canPickHandle = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
async function pickWithHandle() {
  try {
    const [hnd] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'Video', accept: { 'video/*': ['.mp4', '.mov', '.mkv', '.m4v', '.webm', '.avi'] } }] });
    return { file: await hnd.getFile(), handle: hnd };
  } catch (e) { return e && e.name === 'AbortError' ? { cancel: true } : null; }
}

/* ---------------- ההעלאה — רצה ברקע גם כשיוצאים מהסטודיו (כל עוד האפליקציה פתוחה) ---------------- */
const runs = new Map();           // id → { active, phase, p, sent, total, rate, wait, err, need, ctl, file, t0 }
let wl = null, wlWant = false;    // מסך דולק בזמן העלאה (אנדרואיד משהה לשוניות ברקע)
async function wakeOn() {
  wlWant = true;
  if (wl || typeof navigator === 'undefined' || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try { wl = await navigator.wakeLock.request('screen'); wl.addEventListener('release', () => { wl = null; }); } catch (e) { wl = null; }
}
function wakeOffIfIdle() {
  if ([...runs.values()].some((r) => r.active)) return;
  wlWant = false;
  try { if (wl) wl.release(); } catch (e) {}
  wl = null;
}
const isCellular = () => { try { return !!navigator.connection && navigator.connection.type === 'cellular'; } catch (e) { return false; } };
const typeKnown = () => { try { return !!navigator.connection && typeof navigator.connection.type === 'string'; } catch (e) { return false; } };
function waitChange(ms) {
  return new Promise((res) => {
    let done = false;
    const c = typeof navigator !== 'undefined' ? navigator.connection : null;
    const fin = () => {
      if (done) return; done = true; clearTimeout(tm);
      window.removeEventListener('online', fin); window.removeEventListener('offline', fin);
      try { if (c) c.removeEventListener('change', fin); } catch (e) {}
      res();
    };
    const tm = setTimeout(fin, ms);
    window.addEventListener('online', fin); window.addEventListener('offline', fin);
    try { if (c) c.addEventListener('change', fin); } catch (e) {}
  });
}
/* עוצרים כשאין רשת, או כשבחרו "רק ב־Wi‑Fi" והחיבור סלולרי — וממשיכים לבד כשזה משתנה */
async function gate(run) {
  for (;;) {
    if (run.ctl.signal.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    const why = navigator.onLine === false ? 'offline' : store.settings.wifi && isCellular() ? 'wifi' : '';
    if (run.wait !== why) { run.wait = why; paintSoon(); }
    if (!why) return;
    await waitChange(5000);
  }
}
function tickRate(run, bytes) {
  const now = Date.now();
  if (!run.rs || bytes < run.rs.b) { run.rs = { t: now, b: bytes }; return; }
  const dt = (now - run.rs.t) / 1000;
  if (dt >= 2) { const r = (bytes - run.rs.b) / dt; run.rate = run.rate ? run.rate * 0.65 + r * 0.35 : r; run.rs = { t: now, b: bytes }; }
}
const isAbortErr = (e) => !!e && (e.name === 'AbortError' || e.code === 'aborted');
async function register(id, which, fid, folder) {
  const j = await net.api('file', { job: id, which, id: fid, folder });
  if (!j.ok) throw Object.assign(new Error(j.error || 'file'), { code: j.error || 'file' });
  const rec = jobRec(id); if (rec && j.job) rec.srv = normJob({ id, srv: j.job }).srv;
}
/* v361: "המשך" — השרתון מפעיל את ה־Routine שוב עם מפתח חדש; העובד ממשיך מנקודת השמירה האחרונה */
async function resumeSrv(id) {
  const rec = jobRec(id); if (!rec || ui.resuming) return;
  ui.resuming = id; render('none');
  const j = await net.api('resume', { job: id });
  ui.resuming = '';
  if (j.job) rec.srv = normJob({ id, srv: j.job }).srv;
  if (!j.ok) flashSafe(errText(j.error, j));
  save(); render('none');
}
/* "התחלה": השרתון מפעיל את ה־Routine. בשלב 2 העובד יודע רק "בדיקת חיבור" — התשובה worker_not_ready והעבודה ממתינה */
async function tryStart(id) {
  const rec = jobRec(id); if (!rec || rec.up.started) return;
  const j = await net.api('start', { job: id });
  if (j.job) rec.srv = normJob({ id, srv: j.job }).srv;
  if (j.ok) { rec.up.started = Date.now(); rec.up.wait = ''; }
  else rec.up.wait = String(j.error || 'failed').slice(0, 40);
  save(); paintSoon();
}
function startRun(id, file) {
  const prev = runs.get(id);
  if (prev && prev.active) return;
  const run = { active: true, phase: 'prep', p: 0, sent: 0, total: 0, rate: 0, wait: '', err: '', need: false, file, t0: Date.now(), ctl: new AbortController() };
  runs.set(id, run);
  runJob(id, run);
}
async function runJob(id, run) {
  const rec = jobRec(id);
  if (!rec) { run.active = false; return; }
  const up = rec.up, file = run.file, sig = run.ctl.signal;
  wakeOn(); paintSoon();
  try {
    if (!up.folder) { up.folder = await net.jobFolder(id, fileTitle(rec.spec.name)); save(); }
    // 1. הקול — מחולץ בטלפון בלי קידוד ועולה ראשון (Claude מתחיל לעבוד בזמן שהסרטון עולה)
    if (!up.a.done && !up.noAudio) {
      run.phase = 'extract'; run.p = 0; paintSoon();
      let ex;
      try { ex = await extractAudio(file, { onProgress: (p) => { run.p = p; paintSoon(); }, signal: sig }); }
      catch (e) { if (isAbortErr(e)) throw e; ex = { none: 'extract' }; }
      if (ex.none) { up.noAudio = ex.none; save(); }
      else {
        const size = ex.blob.size;
        run.phase = 'audio'; run.p = 0; run.sent = 0; run.total = size; run.rs = null; paintSoon();
        const f = await net.upload({ blob: ex.blob, size, mime: ex.blob.type, signal: sig, gate: () => gate(run),
          meta: { name: fileTitle(rec.spec.name) + ' — ' + T('studioAudioFile') + '.' + ex.ext, parents: [up.folder], appProperties: { snbJob: id, snbPart: 'a' } },
          onProgress: (b) => { run.sent = b; run.p = b / size; tickRate(run, b); paintSoon(); },
          onWait: () => paintSoon() });
        await register(id, 'a', f.id, up.folder);
        up.a = { done: true, id: f.id, size: Number(f.size) || size, uri: '', sent: size };
        up.took = Math.round((Date.now() - run.t0) / 1000);
        save();
      }
    }
    if (up.a.done) await tryStart(id);
    // 2. הסרטון המלא — אותו קובץ בדיוק (השרתון מאמת את הגודל מול Drive)
    if (!up.v.done) {
      run.phase = 'video'; run.total = file.size; run.sent = up.v.sent || 0; run.p = run.sent / file.size; run.rs = null; paintSoon();
      const f = await net.upload({ blob: file, size: file.size, mime: file.type || 'application/octet-stream', signal: sig, gate: () => gate(run),
        uri: up.v.uri || '', onUri: (u) => { up.v.uri = u; save(); },
        meta: { name: rec.spec.name, parents: [up.folder], appProperties: { snbJob: id, snbPart: 'v' } },
        onProgress: (b) => { up.v.sent = b; run.sent = b; run.p = b / file.size; tickRate(run, b); paintSoon(); saveSoon(); },
        onWait: () => paintSoon() });
      await register(id, 'v', f.id, up.folder);
      up.v = { done: true, id: f.id, size: Number(f.size) || file.size, uri: '', sent: file.size };
      if (!up.took) up.took = Math.round((Date.now() - run.t0) / 1000);
      save();
      handleOp('del', id);
    }
    if (!up.started) await tryStart(id);
    run.phase = 'done'; run.file = null;
    if (run.evd) opsEvent(id, [{ c: 'phone', k: 'upload', ok: true }, { c: 'phone', k: 'stall', ok: true }]);   // v365: ההעלאה הצליחה — ההתראות נסגרות
  } catch (e) {
    if (isAbortErr(e)) run.phase = 'paused';
    else {
      run.phase = 'error'; run.err = e.code || e.message || 'error';
      // v365: מגדל הפיקוח — העלאה שנכשלה (לא ביטול, לא "אין רשת" של הטלפון) נרשמת כאירוע
      const k = run.err === 'drive_full' ? ['drive', 'full'] : /^(not_connected|revoked|drive_auth)$/.test(run.err) ? ['drive', 'auth'] : run.err === 'stalled' ? ['phone', 'stall'] : run.err === 'net' ? null : ['phone', 'upload'];
      if (k) { run.evd = true; opsEvent(id, [{ c: k[0], k: k[1] }]); }
    }
  } finally {
    run.active = false; run.wait = '';
    save(); wakeOffIfIdle(); repaint();
  }
}
/* v365: אירוע למגדל הפיקוח מהטלפון — בלי לחכות ובלי לעצור כלום אם נכשל */
function opsEvent(id, ev) { try { net.api('event', { job: id, ev }).catch(() => {}); } catch (e) {} }
function stopRun(id) { const r = runs.get(id); if (r && r.active) r.ctl.abort(); }
/* המשך אחרי רענון / עצירה: הקובץ מהזיכרון, מהידית השמורה, או שמבקשים לבחור שוב (ובודקים שזה אותו קובץ) */
async function resumeJob(id, byUser) {
  const rec = jobRec(id); if (!rec) return;
  const run = runs.get(id);
  let file = run && run.file;
  if (!file) {
    const hnd = await handleOp('get', id);
    if (hnd && typeof hnd.getFile === 'function') {
      try {
        let perm = typeof hnd.queryPermission === 'function' ? await hnd.queryPermission({ mode: 'read' }) : 'granted';
        if (perm !== 'granted' && byUser && typeof hnd.requestPermission === 'function') perm = await hnd.requestPermission({ mode: 'read' });
        if (perm === 'granted') file = await hnd.getFile();
      } catch (e) {}
    }
  }
  if (!file || !sameFile(file, rec.fp)) {
    if (file && byUser) flashSafe(T('studioWrongFile'));
    runs.set(id, Object.assign(run || {}, { active: false, need: true, phase: 'need' }));
    repaint();
    return;
  }
  startRun(id, file);
}
function repickFor(id) {           // "בחרו שוב את הסרטון" — אותו קובץ בדיוק, וממשיכים מאיפה שעצרנו
  const rec = jobRec(id); if (!rec) return;
  const go2 = (file, handle) => {
    if (!sameFile(file, rec.fp)) { flashSafe(T('studioWrongFile')); return; }
    if (handle) handleOp('put', id, handle);
    startRun(id, file);
  };
  if (canPickHandle()) { pickWithHandle().then((r) => { if (r && r.file) go2(r.file, r.handle); else if (!r) pickInput(go2); }); return; }
  pickInput(go2);
}
function pickInput(cb) {
  const inp = document.createElement('input'); inp.type = 'file';
  inp.accept = 'video/*,.mkv,.mov,.mp4,.m4v,.webm,.avi';
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f) cb(f, null); });
  inp.click();
}

/* ---------------- בדיקת חיבור: הפעלה אמיתית של ה־Routine + המתנה ש־Claude יענה ---------------- */
let testRun = null;               // { st: fire|wait|ok|err, job, sess, err, retry, drive, claimed }
async function runTest() {
  if (testRun && (testRun.st === 'fire' || testRun.st === 'wait')) return;
  testRun = { st: 'fire' }; repaint();
  const j = await net.api('test');
  const ed = (x) => String((x && (x.detail || (x.job && x.job.ed))) || '').slice(0, 140);
  if (!j.ok) { testRun = { st: 'err', err: j.error || 'failed', retry: j.retry || 0, sess: j.job && j.job.sess ? j.job.sess.url : '', ed: ed(j) }; repaint(); return; }
  // v356: "לא ודאי" — Anthropic החזיר 5xx/רשת, אבל הסשן אולי נפתח: מחכים לו (השרתון לא ביטל את המפתח)
  const me = testRun = { st: 'wait', job: j.job.id, sess: j.job.sess ? j.job.sess.url : '', t0: Date.now(), unsure: !!j.unsure, ed: j.unsure ? ed(j) : '' };
  repaint();
  for (let i = 0; i < 120 && testRun === me; i++) {        // עד כ־7 דקות (סשן חדש עולה בדקה–שתיים)
    await sleep(i < 30 ? 3000 : 6000);
    if (testRun !== me) return;
    const r = await net.api('job', { job: me.job });
    if (!r.ok || !r.job) continue;
    if (r.job.state === 'done') {
      const drive = !!(r.job.prog && r.job.prog.ck && r.job.prog.ck.drive);
      testRun = drive ? null : { st: 'ok', drive, sess: me.sess };   // הכל תקין — הודעה קצרה, והשורה "נבדק" מתעדכנת
      if (drive) flashSafe(T('studioTestOk'));
      statusAt = 0; refreshStatus(true); break;
    }
    if (r.job.state === 'failed' || r.job.state === 'cancelled') { testRun = { st: 'err', err: r.job.err || 'failed', sess: me.sess, ed: ed(r) }; break; }
    if (r.job.state === 'running' && !me.claimed) { me.claimed = true; repaint(); }
  }
  repaint();
}

/* ---------------- "חזור" ---------------- */
/* לקח v350–v352 (הקורא): כל "חזור" שהוא ניווט בהיסטוריה — Chrome באנדרואיד מחליק במשיכה מצד המסך צילום של הרשומה
   הקודמת, שצולם כשעזבו אותה (בטופס: עם הבחירות הישנות) ← "קפיצה". לכן כשיש CloseWatcher (Chrome 120+) לסטודיו רשומה אחת
   בלבד ({studio:1, sv, sp} — מתעדכנת ב־replaceState לרענון), הדפים במחסנית בזיכרון (stack), ו"חזור" = בקשת סגירה של המאזין:
   דף אחורה באנימציה שלנו; בדף הבית — יציאה (back תוכנתי, בלי צילום). בלי תמיכה — רשומה לכל דף, ובלי אנימציה כפולה
   כש־Chrome כבר הנפיש (hasUAVisualTransition). */
const CW_OK = typeof window !== 'undefined' && typeof window.CloseWatcher === 'function';
let stack = [];                   // מצב CloseWatcher: הדפים הפתוחים ({v, p}); האחרון = הנוכחי
let cw = null;
/* app.js חושף snbAfterBack: pushState/replaceState/back מיד אחרי סגירת חלון (history.back שלו בדרך) נוחת על הרשומה הלא נכונה (לקח v322) */
const afterBack = (fn) => (typeof window !== 'undefined' && typeof window.snbAfterBack === 'function') ? window.snbAfterBack(fn) : fn();
function cleanState(extra) { const st = Object.assign({}, history.state || {}, extra); delete st.sheet; delete st.modal; return st; }
const depth = () => (history.state && history.state.studio) || 0;
const viewKey = () => ui.view + ':' + (ui.param == null ? '' : ui.param);
function syncState() {            // CloseWatcher: הרשומה היחידה משקפת את הדף הנוכחי (רענון חוזר אליו)
  const v = ui.view, p = ui.param;
  afterBack(() => { try { if (root && history.state && history.state.studio) history.replaceState(cleanState({ studio: 1, sv: v, sp: p }), ''); } catch (e) {} });
}
/* רענון במצב CloseWatcher: המסלול עד הדף ששמור ברשומה. הטופס לא נשמר — דף השפות של טופס חוזר לטופס חדש */
export function chainFor(v, p) {
  if (v === 'lang' && p !== 'def') { v = 'new'; p = null; }
  const parent = (x, y) => (x === 'home' ? null : (x === 'connect' || x === 'def' || x === 'lang' || x === 'tower') ? ['settings', null] : x === 'server' ? ['tower', null] : x === 'edit' ? ['project', y] : ['home', null]);
  const out = [{ v, p }];
  for (let c = parent(v, p); c; c = parent(c[0], c[1])) out.unshift({ v: c[0], p: c[1] });
  return out;
}

function leaving() {              // יציאה מדף: המפתח שהודבק באשף לא נשאר בזיכרון
  if (ui.view === 'connect') ui.wiz = { url: ui.wiz.url, key: '', busy: false, err: '' };
  if (ui.view === 'server') ui.newToken = '';   // טוקן שרת מוצג פעם אחת — יציאה מהדף מוחקת אותו מהזיכרון
}
function go(view, param) {
  if (!root) return;
  const p = param == null ? null : param;
  scrolls[viewKey()] = root.scrollTop;
  leaving();
  ui.view = view; ui.param = p;
  if (CW_OK) { stack.push({ v: view, p }); syncState(); }
  else afterBack(() => { try { history.pushState(cleanState({ studio: depth() + 1, sv: view, sp: p }), ''); } catch (e) {} });
  render('push');
}
/* במקום הדף הנוכחי (מהטופס לדף ההתקדמות) — "חזור" משם חוזר לרשימה, לא לטופס */
function replaceView(view, param) {
  if (!root) return;
  const p = param == null ? null : param;
  leaving();
  ui.view = view; ui.param = p;
  if (CW_OK) { stack = [{ v: 'home', p: null }, { v: view, p }]; syncState(); }
  else afterBack(() => { try { if (root && history.state && history.state.studio) history.replaceState(cleanState({ studio: depth(), sv: view, sp: p }), ''); } catch (e) {} });
  render('push');
}
function back() {
  if (!root) return;
  if (CW_OK && stack.length > 1) {
    scrolls[viewKey()] = root.scrollTop;
    leaving();
    stack.pop();
    const top = stack[stack.length - 1];
    ui.view = top.v; ui.param = top.p;
    syncState();
    render('pop');
    return;
  }
  afterBack(() => { try { history.back(); } catch (e) {} });   // בלי CloseWatcher: דף אחורה; עם — בדף הבית: יציאה
}
function watch() {                // מאזין אחד בכל רגע; חדש אחרי כל בקשה (בלי הפעלת משתמש מותר אחד, ונגיעה מחדשת)
  if (!CW_OK || !root) return;
  try { if (cw) cw.destroy(); } catch (e) {}
  let w;
  try { w = new CloseWatcher(); } catch (e) { cw = null; return; }
  cw = w;
  w.onclose = () => { if (cw === w) { cw = null; closeRequest(); } };
}
function closeRequest() {
  if (!root) return;
  // חלון אישור של האפליקציה (askConfirm) פתוח — "חזור" = הביטול שלו (יש לו רשומה משלו, והוא מוריד אותה)
  const dlg = document.querySelector('.dlg-veil.on');
  if (dlg) { const b = dlg.querySelector('.dlg-cancel') || dlg.querySelector('.dlg-ok'); if (b) b.click(); }
  else back();
  if (root) watch();
}
function onPop(e) {
  if (!root) return;
  const ds = document.documentElement.dataset;
  if (ds.modalPop || ds.navSkip) return;   // חלון של האפליקציה נסגר ב"חזור" / back פנימי שלה — לא ניווט של הסטודיו
  const uaT = !!(e && e.hasUAVisualTransition);   // Chrome כבר הנפיש "חזור" משלו (משיכה מצד המסך) — בלי אנימציה שנייה
  const st = history.state || {};
  if (!st.studio) { closeStudio(uaT); appToOverview(); return; }
  if (CW_OK) return;                       // עם CloseWatcher הדפים לא ברשומות (כאן רק "קדימה" חזרה לרשומה שלנו)
  scrolls[viewKey()] = root.scrollTop;
  leaving();
  ui.view = st.sv || 'home'; ui.param = st.sp == null ? null : st.sp;
  render('pop', uaT);
}
/* כמו בספרייה (v350, בקשת המשתמש): "חזור" מדף הבית של הסטודיו — לסקירה. מטאב ראשי app.js כבר עבר אליה בפתיחה */
function appToOverview() {
  try { if (typeof switchTab === 'function' && typeof currentTabName === 'function' && currentTabName() !== 'overview') switchTab('overview'); } catch (e) {}
}
/* רענון בזמן שהסטודיו פתוח — index.html מוריד וילון בצבע הרקע עד שהדף הראשון מוכן (כמו בספרייה) */
function curtainDown() {
  const e = document.documentElement;
  if (!e.classList.contains('lib-restoring')) return;
  e.classList.remove('lib-restoring');
  setTimeout(() => { e.classList.remove('lib-curtain'); e.style.removeProperty('--curtain'); }, 400);
}

/* ---------------- רכיבים ---------------- */
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const ICON = {   // סמלים קבועים בלבד — אף פעם לא תוכן חיצוני
  back: '<polyline points="9 6 15 12 9 18"/>',
  chev: '<polyline points="15 6 9 12 15 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<polyline points="5 12.5 10 17 19 7"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.6 3.5 5.5 3.5 8.6s-1.1 6-3.5 8.6c-2.4-2.6-3.5-5.5-3.5-8.6s1.1-6 3.5-8.6z"/>',
  spark: '<path d="M11 2.5l1.9 5.4 5.4 1.9-5.4 1.9L11 17.1l-1.9-5.4-5.4-1.9 5.4-1.9z" fill="currentColor" stroke="none"/><path d="M18.5 14.5l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" fill="currentColor" stroke="none"/>',
  key: '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8M16.2 6.8l2.3 2.3M13.8 9.2l1.8 1.8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v4.5A1.5 1.5 0 0 1 16.5 20h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
  copy: '<rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>',
  cloud: '<path d="M7 18.5h10.2a4.3 4.3 0 0 0 .5-8.6A6 6 0 0 0 6.2 9.3 4.6 4.6 0 0 0 7 18.5z"/>',
  up: '<path d="M12 19V7M7 11.5l5-5 5 5"/>',
  wifi: '<path d="M4.5 9.5a11 11 0 0 1 15 0M7.5 12.8a6.6 6.6 0 0 1 9 0"/><circle cx="12" cy="16.5" r="1.4" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 6.5v11M15 6.5v11"/>',
  alert: '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10v4.2"/><circle cx="12" cy="16.9" r=".9" fill="currentColor" stroke="none"/>',
  help: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-7l-4 3v-3H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z"/><path d="M10 9.6a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6.9v.3"/><circle cx="12" cy="14.6" r=".9" fill="currentColor" stroke="none"/>',
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  shield: '<path d="M12 3.5l7 2.6v5.4c0 4.3-2.9 7.8-7 9-4.1-1.2-7-4.7-7-9V6.1z"/>',
};
function ico(k, cls) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = ICON[k];
  return s;
}
function tile(icon, color) { const s = h('span', 'st-tile t-' + color); s.append(ico(icon)); return s; }
function btn(cls, label, onClick, k) {
  const b = h('button', cls, label); b.type = 'button';
  if (k) b.dataset.k = k;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
/* קישור החוצה (claude.ai, Drive) — תמיד בלשונית חדשה ובלי גישה חזרה לאפליקציה */
function extLink(cls, href, label, icon, k) {
  const a = h('a', cls); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  if (k) a.dataset.k = k;
  if (icon) a.append(ico(icon));
  a.append(h('span', null, label));
  return a;
}
/* עדכון במקום (התקדמות, זמנים) — בלי לבנות את הדף מחדש בכל רגע, כדי שנגיעה בכפתור לא "תיפול" בין שני ציורים */
function live(el, fn) { el.dataset.live = '1'; el._live = fn; fn(el); return el; }
/* סרגל עליון: חזרה (חץ + שם הדף הקודם) או "ביטול", כותרת קטנה באמצע, ופעולה בצד השני */
function navBar(o) {
  const bar = h('div', 'st-nav');
  let lead;
  if (o.cancel) lead = btn('st-txt', o.cancel, back, 'nav-cancel');
  else { lead = btn('st-back', null, back, 'nav-back'); const l = h('span', 'st-back-l'); l.append(h('bdi', null, o.back)); lead.append(ico('back'), l); }
  const s = h('span', 'st-nav-s'); s.append(lead);
  const e = h('span', 'st-nav-e'); if (o.end) e.append(o.end);
  bar.append(s, h('span', 'st-nav-t', o.title || ''), e);
  return bar;
}
const large = (txt) => h('h1', 'st-large', txt);
function secT(txt) { const d = h('div', 'st-sec-t'); d.append(h('span', null, txt)); return d; }
function list(...rows) { const l = h('div', 'st-list'); l.append(...rows.filter(Boolean)); return l; }
const note = (txt) => h('p', 'st-note', txt);
function rowTxt(label, sub) {
  const l = h('span', 'st-l');
  l.append(h('b', null, label));
  if (sub) l.append(h('small', null, sub));
  return l;
}
/* שורה שמובילה לדף אחר */
function rowNav(o) {
  const r = btn('st-row' + (o.tile ? ' st-ric' : ''), null, o.onClick, o.k);
  if (o.tile) r.append(o.tile);
  r.append(rowTxt(o.label, o.sub));
  if (o.value) r.append(h('span', 'st-v', o.value));
  r.append(ico('chev', 'st-chev'));
  return r;
}
/* שורה עם עיגול סימון (בחירה מרובה) */
function rowCheck(o) {
  const r = o.locked ? h('div', 'st-row') : btn('st-row', null, o.onClick, o.k);
  const c = h('span', 'st-check' + (o.on ? ' on' : '') + (o.locked ? ' lock' : '')); c.append(ico('check'));
  if (!o.locked) { r.setAttribute('role', 'checkbox'); r.setAttribute('aria-checked', o.on ? 'true' : 'false'); }
  r.append(c, rowTxt(o.label, o.sub));
  if (o.value) r.append(h('span', 'st-v', o.value));
  return r;
}
/* שורה עם עיגול בחירה (אחת מכמה) */
function rowRadio(o) {
  const r = btn('st-row', null, o.disabled ? null : o.onClick, o.k);
  r.setAttribute('role', 'radio'); r.setAttribute('aria-checked', o.on ? 'true' : 'false');
  if (o.disabled) { r.disabled = true; r.classList.add('off'); }
  r.append(h('span', 'st-radio' + (o.on ? ' on' : '')), rowTxt(o.label, o.sub));
  if (o.badge) r.append(h('span', 'st-badge gray', o.badge));
  return r;
}
/* שורה עם מתג (כן/לא) */
function rowSwitch(o) {
  const r = btn('st-row', null, o.onClick, o.k);
  r.setAttribute('role', 'switch'); r.setAttribute('aria-checked', o.on ? 'true' : 'false');
  r.append(rowTxt(o.label, o.sub), h('span', 'st-sw' + (o.on ? ' on' : '')));
  return r;
}
function kvRow(k, v, iso) {
  const r = h('div', 'st-row st-kvrow');
  const val = h('span', 'st-v'); if (iso) val.append(typeof v === 'string' ? h('bdi', null, v) : v); else val.textContent = v;
  r.append(h('span', 'st-k', k), val);
  return r;
}
/* הודעה בראש דף: התחברות, הרשאה, רשת. פעולות שדורשות את השרתון כבויות רק כשבטוח שלא יעבדו (לא מחובר / לא מורשה) */
const blocked = () => ui.access === 'signin' || ui.access === 'denied';
function banner(kind, txt, action) {
  const b = h('div', 'st-banner ' + kind);
  b.append(ico(kind === 'warn' ? 'alert' : 'cloud'), h('span', null, txt));
  if (action) b.append(action);
  return b;
}
function accessBanner() {
  if (ui.access === 'signin') return banner('warn', T('studioErrSignin'));
  if (ui.access === 'denied') return banner('warn', T('studioErrDenied'));
  if (ui.access === 'offline') return banner('info', T('studioOffline'));
  if (ui.access === 'error') return banner('info', T('studioErrServer'));
  return null;
}
async function copyText(txt, okMsg) {
  try { await navigator.clipboard.writeText(txt); flashSafe(okMsg || T('studioCopied')); return true; }
  catch (e) { flashSafe(T('studioCopyFail')); return false; }
}
/* קופסת טקסט להעתקה (כתובות, סקריפט, הנחיה) — הטקסט גלוי, והכפתור מעתיק */
/* שורת הוראה בעברית עם שמות מסכים באנגלית: כל רצף לטיני בבידוד (<bdi>). בלי זה חץ בין שתי מילים לטיניות
   ("API ← Generate token") נבלע ברצף LTR אחד ונקרא הפוך, ושבירת שורה מערבבת את הסדר (נמצא בצילום של v356).
   הרצף מסתיים באות/ספרה — נקודה או נקודתיים בסוף נשארים בחוץ (אחרת הם עוברים לצד הלא נכון של המילה). */
const LATIN_RUN = /[A-Za-z0-9](?:[A-Za-z0-9./_+-]*[A-Za-z0-9])?(?: [A-Za-z0-9](?:[A-Za-z0-9./_+-]*[A-Za-z0-9])?)*/g;
function bidiP(text) {
  const p = h('p');
  if (!/[֐-׿]/.test(text)) { p.textContent = text; return p; }
  let i = 0;
  for (const m of text.matchAll(LATIN_RUN)) {
    if (m.index > i) p.append(text.slice(i, m.index));
    p.append(h('bdi', null, m[0]));
    i = m.index + m[0].length;
  }
  if (i < text.length) p.append(text.slice(i));
  return p;
}

function copyBox(txt, label, k, prose) {
  const wrap = h('div', 'st-copybox');
  const pre = h('div', 'st-code' + (prose ? ' prose' : ''), txt); pre.dir = 'auto';
  const b = btn('st-wbtn', null, () => copyText(txt), k);
  b.append(ico('copy'), h('span', null, label));
  wrap.append(pre, b);
  return wrap;
}

/* בורר מצב התרגום — כרטיס המצב הנבחר (המומלץ בולט) + שתי קבוצות מאמץ + שורת המבחן */
function modePicker(cur, onPick) {
  const m = modeById(cur);
  const best = h('div', 'st-mode-best' + (m.rec ? '' : ' other'));
  best.append(h('span', 'st-ribbon', m.rec ? T('studioRibbonRec') : T('studioRibbonSel', { name: modeShort(MODES[0]) })));
  const mh = h('div', 'st-mh');
  const mt = h('span', 'st-l'); mt.append(h('b', null, modeName(m)), h('small', null, modeSub(m.id)));
  mh.append(tile('spark', 'green'), mt);
  const bars = (n, cls) => { const b = h('span', 'st-bars' + (cls ? ' ' + cls : '')); for (let i = 0; i < 5; i++) b.append(h('i', i < n ? 'on' : null)); return b; };
  const meter = (lbl, val) => { const d = h('div', 'st-meter'); d.append(h('small', null, lbl), val); return d; };
  const meters = h('div', 'st-meters'); meters.setAttribute('aria-hidden', 'true');
  meters.append(meter(T('studioQuality'), bars(m.q)), meter(T('studioUsage'), bars(m.u, 'amber')),
    meter(T('studioHourEst'), h('b', null, T('studioHrs', { t: fmtHM(m.min) }))));
  best.append(mh, meters);
  const grp = (fam) => {
    const g = h('div', 'st-mode-grp');
    const gh = h('div', 'st-gh');
    const title = fam === 'opus' ? T('studioGrpPerf') : T('studioGrpEco');
    gh.append(h('b', null, title), h('small', null, fam === 'opus' ? T('studioGrpPerfS') : T('studioGrpEcoS')));
    const ef = h('div', 'st-effort'); ef.setAttribute('role', 'radiogroup'); ef.setAttribute('aria-label', title);
    for (const x of MODES.filter((y) => y.fam === fam)) {
      const b = btn(null, null, () => onPick(x.id), 'm:' + x.id);
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', x.id === m.id ? 'true' : 'false');
      b.append(h('b', null, x.effort), h('small', x.rec ? 'star' : null, effortSub(x.id)));
      ef.append(b);
    }
    g.append(gh, ef);
    return g;
  };
  const sum = h('p', 'st-modesum');
  const nb = h('b'); nb.append(h('bdi', 'st-nw', modeName(m)));   // מבודד — שם המודל לא "נדבק" לטקסט הלטיני שלפניו
  sum.append(T('studioSumPre') + ' ', nb, ' — ' + modeSum(m.id));
  return [best, grp('opus'), grp('sonnet'), sum];
}
/* מה לקבל — שלוש אפשרויות + SRT קבוע. ההערכה לפי גודל הקובץ (כשיש) */
function outRows(out, size, onToggle) {
  const est = size ? { same: approx(fmtSize(size)), compact: approx(fmtSize(size * COMPACT_RATIO)), mkv: approx(fmtSize(size)) } : {};
  const rows = OUTS.map((k) => rowCheck({ label: outName(k), sub: outSub(k), value: est[k], on: !!out[k], onClick: () => onToggle(k), k: 'o:' + k }));
  rows.push(rowCheck({ label: outName('srt'), sub: outSub('srt'), on: true, locked: true }));
  return list(...rows);
}
/* מראה הכתוביות — שלושה כרטיסים עם דוגמה על "תמונה" כהה */
function stylePicker(cur, onPick) {
  const g = h('div', 'st-styles'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', T('studioSecStyle'));
  for (const k of STYLES) {
    const b = btn('st-sty' + (k === cur ? ' on' : ''), null, () => onPick(k), 's:' + k);
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', k === cur ? 'true' : 'false');
    const s = h('span', 's s-' + k);
    if (k === 'karaoke') s.append(T('studioSampleK1') + ' ', h('em', null, T('studioSampleK2')));
    else s.textContent = T('studioSample');
    b.append(h('span', 'n', styleName(k)), s);
    g.append(b);
  }
  return g;
}
function toggleLang(target, c, persist) {
  if (target.to.includes(c)) {
    if (target.to.length === 1) { flashSafe(T('studioMin1')); return; }
    target.to = target.to.filter((x) => x !== c);
  } else target.to = target.to.concat(c);
  if (persist) save();
  render('none');
}

/* ---------------- התקדמות (מודל משותף לרשימה ולמסך ההתקדמות) ---------------- */
function upState(rec, run) {      // ההעלאה בטלפון במונחים של "השלב הראשון" (הקול) + הסרטון המלא בנפרד
  const up = rec.up, dur = rec.spec.dur || 0;
  const aDone = up.a.done || !!up.noAudio && up.v.done;
  const active = !!(run && run.active && (run.phase === 'prep' || run.phase === 'extract' || run.phase === 'audio' || (up.noAudio && run.phase === 'video')));
  let p = 0, left = 0;
  const rate = (run && run.rate) || 0;
  const audioBytes = up.a.size || Math.max(1, dur) * 16000;       // כ־128kbps — בערך מה שיוצא מראיון
  if (run && run.phase === 'extract') { p = 0.25 * (run.p || 0); left = (1 - (run.p || 0)) * Math.max(10, dur * 0.004) + audioBytes / (rate || 1.5e6); }
  else if (run && run.phase === 'audio') { p = 0.25 + 0.75 * (run.p || 0); left = Math.max(0, (run.total || audioBytes) - (run.sent || 0)) / (rate || 1.5e6); }
  else if (run && run.phase === 'video' && up.noAudio) { p = run.p || 0; left = Math.max(0, rec.spec.size - (run.sent || 0)) / (rate || 1.5e6); }
  return { active, done: aDone, p, left: Math.round(left), took: up.took, est: Math.max(30, Math.round(audioBytes / 1.5e6) + 20) };
}
function modelFor(rec) {
  const run = runs.get(rec.id);
  const est = stageEstimates(modeById(rec.spec.mode).min, rec.spec.dur || 0);
  return progressModel({ state: rec.srv ? rec.srv.state : 'new', prog: rec.srv && rec.srv.prog }, est, upState(rec, run), Date.now());
}
function videoLine(rec, run) {    // "עלו 1.2GB מתוך 3.2GB · 4.3MB לשנייה · נשארו 8 דק׳"
  const sent = run && run.phase === 'video' ? run.sent || 0 : rec.up.v.sent || 0, size = rec.spec.size;
  const parts = [T('studioUpOf', { a: fmtSize(sent), b: fmtSize(size) })];
  if (run && run.active && run.phase === 'video' && run.rate > 0) {
    parts.push(T('studioPerSec', { v: fmtSize(run.rate) }));
    parts.push(T('studioStageLeft', { t: fmtShort(Math.max(0, size - sent) / run.rate) }));
  }
  return parts.join(' · ');
}
/* העלאה שלא התחילה עבודה (העובד עוד לא מוכן / Claude לא מחובר): הראש מראה את ההעלאה, לא זמן תרגום שלא יקרה עכשיו */
function uploadLeft(rec, run) {
  const rate = (run && run.rate) || 1.5e6, up = rec.up, dur = rec.spec.dur || 0;
  const aBytes = up.a.size || Math.max(1, dur) * 16000;
  let left = 0, done = 0, all = rec.spec.size + (up.noAudio ? 0 : aBytes);
  if (!up.noAudio) {
    if (up.a.done) done += aBytes;
    else if (run && run.phase === 'audio') { done += run.sent || 0; left += Math.max(0, (run.total || aBytes) - (run.sent || 0)) / rate; }
    else left += aBytes / rate + (run && run.phase === 'extract' ? (1 - (run.p || 0)) * Math.max(10, dur * 0.004) : 0);
  }
  const vs = up.v.done ? rec.spec.size : run && run.phase === 'video' ? run.sent || 0 : up.v.sent || 0;
  done += vs; left += Math.max(0, rec.spec.size - vs) / rate;
  return { left: Math.round(left), pct: Math.max(0, Math.min(1, done / Math.max(1, all))), done, all };
}
function heroState(rec, run, ph) {
  const m = modelFor(rec);
  if (ph === 'done') return { pct: 1, check: true, big: T('studioNowDone'), sub: '' };
  if (ph === 'failed' || ph === 'cancelled') return { pct: m.pct, big: ph === 'failed' ? T('studioBFailed') : T('studioBCancelled'), sub: '' };
  if (ph === 'stuck') return { pct: m.pct, big: T('studioStuckBig'), sub: '' };
  if (ph === 'ready') return { pct: 1, check: true, big: T('studioReadyBig'),
    sub: rec.up.wait === 'worker_not_ready' ? T('studioWaitWorkerS') : rec.up.wait === 'conn_missing' ? T('studioNeedConnS') : T('studioTotalEst', { t: fmtLeft(m.left) }) };
  const u = uploadLeft(rec, run);
  // ההעלאה עצרה / מחכה — בלי "נשארו בערך": מה שנשאר תלוי בחזרה של הרשת או בבחירה מחדש
  if (ph === 'need' || ph === 'paused' || ph === 'error') return { pct: u.pct, big: T('studioUpStopBig'), sub: T('studioUpOf', { a: fmtSize(u.done), b: fmtSize(u.all) }) };
  if (ph === 'wait') return { pct: u.pct, big: T('studioUpWaitBig'), sub: T('studioUpOf', { a: fmtSize(u.done), b: fmtSize(u.all) }) };
  const parked = (!rec.srv || rec.srv.state === 'new') && !rec.up.started;
  if (parked) return { pct: u.pct, big: T('studioLeftBig', { t: fmtLeft(u.left) }), sub: T('studioUpLeftS') };
  return { pct: m.pct, big: T('studioLeftBig', { t: fmtLeft(m.left) }), sub: T('studioReadyAt', { t: fmtClock(Date.now() + m.left * 1000) }) };
}
/* מה קורה עכשיו — משפט אחד */
function nowLine(rec, run, ph) {
  if (ph === 'wait') return run.wait === 'wifi' ? T('studioWaitWifi') : T('studioWaitNet');
  if (ph === 'extract') return T('studioNowExtract');
  if (ph === 'audio') return T('studioNowAudio');
  if (ph === 'video') return rec.up.noAudio ? T('studioNowVideoOnly') : T('studioNowVideo');
  if (ph === 'need') return T('studioNeedFile');
  if (ph === 'paused') return T('studioPausedNow');
  if (ph === 'error') return errText(run.err);
  if (ph === 'ready') return rec.up.wait === 'worker_not_ready' ? T('studioWaitWorker') : rec.up.wait ? errText(rec.up.wait) : T('studioReady');
  if (ph === 'queued') return rec.srv && rec.srv.eng === 'api' ? T('studioNowQueuedApi') : T('studioNowQueued');
  if (ph === 'running') return (rec.srv && rec.srv.prog && rec.srv.prog.msg) || T('studioNowRunning');
  if (ph === 'done') return T('studioNowDone');
  if (ph === 'failed') return errText(rec.srv && rec.srv.err);
  if (ph === 'stuck') return T('studioNowStuck');
  return T('studioNowCancelled');
}
function badgeFor(ph) {
  switch (ph) {
    case 'extract': case 'audio': case 'video': return ['green', T('studioBUp')];
    case 'wait': case 'need': case 'paused': return ['amber', T('studioBPaused')];
    case 'stuck': return ['amber', T('studioBStuck')];
    case 'error': case 'failed': return ['red', T('studioBFailed')];
    case 'ready': return ['gray', T('studioBReady')];
    case 'queued': case 'running': return ['green', T('studioBRunning')];
    case 'done': return ['green', T('studioBDone')];
    default: return ['gray', T('studioBCancelled')];
  }
}

/* ---------------- דפים ---------------- */
function pageHome(p) {
  const pon = apiMode() ? ui.api.online > 0 : !!store.conn;
  const pill = btn('st-cpill' + (pon ? ' on' : ''), null, () => go('settings'), 'cpill');
  pill.append(h('i'), h('span', null, apiMode() ? T('studioConnApiOn') : store.conn ? T('studioConnOn') : T('studioConnPill')));
  p.append(navBar({ back: 'THE SNOWBALL', end: pill }), large(T('studioTitle')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const nc = btn('st-newcard', null, () => { form = freshForm(null); go('new'); }, 'new');
  const plus = h('span', 'st-plus'); plus.append(ico('plus'));
  nc.append(plus, rowTxt(T('studioNew'), T('studioNewSub')));
  p.append(nc);
  if (!store.drafts.length && !store.jobs.length) {
    const e = h('div', 'st-empty');
    const ic = h('span', 'st-empty-ic'); ic.append(ico('film'));
    e.append(ic, h('b', null, T('studioEmptyT')), h('p', null, T('studioEmptyS')));
    p.append(e);
    return;
  }
  if (store.jobs.length) {
    const rows = store.jobs.map((rec) => {
      const r = btn('st-proj', null, () => go('job', rec.id), 'j:' + rec.id);
      const th = h('span', 'st-thumb'); th.append(ico('film'));
      const bar = h('span', 'st-tprog'); const bi = h('i'); bar.append(bi); th.append(bar);
      const info = h('span', 'st-pinfo');
      const nm = h('b'); nm.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')));
      const stat = h('span', 'st-pstat');
      const bd = h('span', 'st-badge'); const tx = h('span', 'st-ptx');
      stat.append(bd, tx);
      const sm = h('small'); sm.append(langsText(rec.spec.from, rec.spec.to) + ' · ', h('bdi', 'st-nw', modeShort(modeById(rec.spec.mode))));
      info.append(nm, sm, stat);
      r.append(th, info);
      live(r, () => {             // אחוז ומצב — מתעדכנים במקום
        const run = runs.get(rec.id), ph = jobPhase(rec, run), m = modelFor(rec);
        const [c, l] = qaPending(rec) ? ['amber', T('studioBAsk')] : badgeFor(ph);
        bd.className = 'st-badge ' + c; bd.textContent = l;
        const upping = ph === 'extract' || ph === 'audio' || ph === 'video';
        tx.textContent = upping ? Math.round(100 * (ph === 'video' ? run.p || 0 : m.stages[0].p || 0)) + '%' + (ph === 'video' && !rec.up.noAudio ? ' · ' + T('studioVideoShort') : '')
          : ph === 'running' || ph === 'queued' ? T('studioLeftShort', { t: fmtLeft(m.left) }) : '';
        const pct = ph === 'done' ? 1 : ph === 'video' ? run.p || 0 : upping ? m.stages[0].p || 0 : m.pct;
        bar.hidden = FINAL.includes(ph) || ph === 'ready';
        bi.style.width = Math.round(100 * pct) + '%';
      });
      return r;
    });
    p.append(secT(T('studioSecJobs')), list(...rows));
  }
  if (!store.drafts.length) return;
  const rows = store.drafts.map((d) => {
    const r = btn('st-proj', null, () => go('project', d.id), 'p:' + d.id);
    const th = h('span', 'st-thumb'); th.append(ico('film'));
    const info = h('span', 'st-pinfo');
    const nm = h('b'); nm.append(h('bdi', null, d.name ? fileTitle(d.name) : T('studioUntitled')));   // שם באנגלית — מבודד, מיושר לצד של הממשק
    const stat = h('span', 'st-pstat');
    stat.append(h('span', 'st-badge gray', T('studioDraft')));
    const meta = [fileExt(d.name), d.size ? fmtSize(d.size) : ''].filter(Boolean).join(' · ');
    if (meta) stat.append(h('span', null, meta));
    const sm = h('small'); sm.append(langsText(d.from, d.to) + ' · ', h('bdi', 'st-nw', modeName(modeById(d.mode))));   // שם המודל שלם — לא נשבר באמצע
    info.append(nm, sm, stat);
    r.append(th, info);
    return r;
  });
  p.append(secT(T('studioSecDrafts')), list(...rows));
}

function pageForm(p, editing) {
  if (!form) {
    const d = editing ? store.drafts.find((x) => x.id === ui.param) : null;
    if (editing && !d) { back(); return; }
    form = freshForm(d);
  }
  const f = form;
  const saveTop = btn('st-txt bold', T('studioSave'), saveForm, 'nav-save');
  saveTop.disabled = !f.file;
  p.append(navBar({ cancel: T('studioCancel'), title: editing ? T('studioEditT') : T('studioNew'), end: saveTop }));

  // הסרטון — מהטלפון. הקובץ נשאר בזיכרון רק עד ההתחלה; בטיוטה נשמרים רק השם, הגודל והסוג
  const inp = h('input', 'st-file'); inp.type = 'file'; inp.hidden = true;
  inp.accept = 'video/*,.mkv,.mov,.mp4,.m4v,.webm,.avi';
  const took = (file, handle) => { f.fileObj = file; f.handle = handle || null; f.file = { name: file.name, size: file.size, type: file.type || '' }; render('none'); };
  inp.addEventListener('change', () => { const file = inp.files && inp.files[0]; if (file) took(file, null); });
  const pick = () => {
    if (canPickHandle()) { pickWithHandle().then((r) => { if (r && r.file) took(r.file, r.handle); else if (!r) inp.click(); }); return; }
    inp.click();
  };
  let card;
  if (f.file) {
    card = btn('st-filecard', null, pick, 'file');
    card.setAttribute('aria-label', T('studioReplace') + ': ' + f.file.name);
    const th = h('span', 'st-thumb'); th.append(ico('film'));
    const txt = h('span', 'st-l');
    const nm = h('b'); nm.append(fileNameEl(f.file.name));
    const sz = h('small'); sz.append(fmtSize(f.file.size) + ' · ', h('span', 'st-linkish', T('studioReplace')));
    txt.append(nm, sz, f.fileObj ? h('small', 'st-ok', T('studioPhoneOnly')) : h('small', 'st-warn', T('studioRepick')));
    card.append(th, txt);
  } else {
    card = btn('st-newcard pick', null, pick, 'file');
    const plus = h('span', 'st-plus'); plus.append(ico('film'));
    card.append(plus, rowTxt(T('studioPick'), T('studioNewSub')));
  }
  p.append(inp, secT(T('studioSecVideo')), card);
  if (isIOS()) p.append(note(T('studioIosTip')));

  // שפות
  const ul = uiLang();
  p.append(secT(T('studioSecLangs')), list(
    rowNav({ tile: tile('mic', 'blue'), label: T('studioFrom'), value: f.from === 'auto' ? T('studioAuto') : langName(f.from, ul), onClick: () => go('lang', 'from'), k: 'from' }),
    rowNav({ tile: tile('globe', 'teal'), label: T('studioTo'), value: langsSum(f.to), onClick: () => go('lang', 'to'), k: 'to' })));
  const chips = h('div', 'st-chips'); chips.setAttribute('role', 'group'); chips.setAttribute('aria-label', T('studioTo'));
  for (const c of QUICK_LANGS.concat(f.to.filter((x) => !QUICK_LANGS.includes(x)))) {
    const on = f.to.includes(c);
    const b = btn('st-chip' + (on ? ' on' : ''), null, () => toggleLang(f, c, false), 'c:' + c);
    if (on) b.append(ico('check', 'st-chk'));
    b.append(h('bdi', null, nativeName(c)));
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    chips.append(b);
  }
  chips.append(btn('st-chip', '+ ' + T('studioMore'), () => go('lang', 'to'), 'c:more'));
  p.append(chips);

  // שמות ומונחים — Claude משתמש בהם בהגהה ובתרגום
  const ta = h('textarea', 'st-ta'); ta.rows = 3; ta.maxLength = TERMS_MAX; ta.value = f.terms || '';
  ta.placeholder = T('studioTermsPh'); ta.dataset.k = 'terms'; ta.setAttribute('aria-label', T('studioSecTerms'));
  ta.addEventListener('input', () => { f.terms = ta.value; });
  p.append(secT(T('studioSecTerms')), ta, note(T('studioTermsNote')));

  // מצב התרגום — המומלץ מסומן ונבחר מראש
  p.append(secT(T('studioSecMode')), ...modePicker(f.mode, (id) => { f.mode = id; render('none'); }));
  // מה לקבל — "זהה למקור" כברירת מחדל, SRT תמיד
  p.append(secT(T('studioSecOut')), outRows(f.out, f.file ? f.file.size : 0, (k) => { f.out[k] = !f.out[k]; render('none'); }));
  p.append(secT(T('studioSecStyle')), stylePicker(f.style, (k) => { f.style = k; render('none'); }));

  // התחלה: יוצרים עבודה בשרתון ומעלים ל־Drive (הקול קודם). טיוטה — אפשרות משנית
  const startBtn = btn('st-btn wide', ui.starting ? T('studioStarting') : T('studioStart'), startFromForm, 'start');
  startBtn.disabled = !f.fileObj || ui.starting;
  const saveBtn = btn('st-btn tint wide', T('studioSaveDraft'), saveForm, 'save');
  saveBtn.disabled = !f.file;
  p.append(h('div', 'st-gap'), startBtn, h('div', 'st-gap sm'), saveBtn,
    note(!f.file ? T('studioPickFirst') : !f.fileObj ? T('studioRepickNote') : T('studioStartNote')));
}
function saveForm() {
  const f = form;
  if (!f || !f.file) return;
  if (f.id) {
    const i = store.drafts.findIndex((d) => d.id === f.id);
    if (i < 0) return;
    store.drafts[i] = newDraft(f, store.drafts[i].created || Date.now(), f.id);
  } else store.drafts.unshift(newDraft(f, Date.now(), newId()));
  if (!save()) { store = load(); return; }
  flashSafe(T('studioSaved'));
  form = null;
  back();
}
/* "התחלה" מהטופס: התחברות + Drive מחובר → קריאה מהירה של הסרטון (אורך) → עבודה בשרתון → מסך ההתקדמות + ההעלאה */
function startFromForm() {
  const f = form;
  if (!f || !f.fileObj || ui.starting) return;
  if (ui.access === 'signin' || ui.access === 'denied') { flashSafe(ui.access === 'signin' ? T('studioErrSignin') : T('studioErrDenied')); return; }
  if (!store.drive || !store.drive.connected) {
    if (typeof askConfirm === 'function') askConfirm(T('studioNeedDrive'), connectDrive, { ok: T('studioDriveConnect') });
    else connectDrive();
    return;
  }
  ui.starting = true; render('none');
  (async () => {
    const file = f.fileObj;
    const pr = await probeVideo(file);
    const spec = { name: file.name, size: file.size, type: file.type || '', dur: pr.dur || 0, from: f.from, to: f.to,
      mode: f.mode, out: OUTS.filter((k) => f.out[k]), style: f.style, terms: f.terms };
    if (apiMode()) Object.assign(spec, { eng: 'api', cap: store.settings.cap });   // השרת של המערכת — בלי Routine
    const j = await net.api('create', { spec });
    ui.starting = false;
    if (!j.ok || !j.job) { flashSafe(errText(j.error)); render('none'); return; }
    const rec = normJob({ id: j.job.id, created: j.job.created || Date.now(), spec: j.job.spec || spec, srv: j.job,
      fp: { name: file.name, size: file.size, lm: file.lastModified || 0 }, up: {} });
    store.jobs.unshift(rec);
    if (f.id) store.drafts = store.drafts.filter((d) => d.id !== f.id);   // טיוטה שהתחילה — כבר עבודה
    save();
    if (f.handle) handleOp('put', rec.id, f.handle);
    form = null;
    if (!root) { startRun(rec.id, file); return; }
    replaceView('job', rec.id);
    startRun(rec.id, file);
  })();
}

function pageLang(p) {
  const which = ui.param;
  const def = which === 'def';
  const target = def ? store.settings : form;
  if (!target || (which !== 'from' && which !== 'to' && !def)) { back(); return; }
  const multi = which !== 'from';
  p.append(navBar({ back: def ? T('studioSettings') : (form.id ? T('studioEditT') : T('studioNew')) }),
    large(multi ? T('studioTo') : T('studioFrom')));
  const ul = uiLang();
  const sub = (c) => { const n = nativeName(c); return n !== langName(c, ul) ? n : null; };
  const rows = [];
  if (!multi) {
    rows.push(rowRadio({ label: T('studioAuto'), on: target.from === 'auto', onClick: () => { target.from = 'auto'; back(); }, k: 'l:auto' }));
    for (const c of SOURCE_LANGS) rows.push(rowRadio({ label: langName(c, ul), sub: sub(c), on: target.from === c, onClick: () => { target.from = c; back(); }, k: 'l:' + c }));
  } else {
    for (const c of TARGET_LANGS) rows.push(rowCheck({ label: langName(c, ul), sub: sub(c), on: target.to.includes(c), onClick: () => toggleLang(target, c, def), k: 'l:' + c }));
  }
  p.append(list(...rows));
  if (multi) p.append(note(T('studioToSub')));
}

function pageProject(p) {
  const d = store.drafts.find((x) => x.id === ui.param);
  if (!d) { back(); return; }
  p.append(navBar({ back: T('studioShort') }));
  const t1 = h('h1', 'st-large clamp'); t1.append(h('bdi', null, d.name ? fileTitle(d.name) : T('studioUntitled')));
  const tag = h('div', 'st-ptag'); tag.append(h('span', 'st-badge gray', T('studioPhoneDraft')));
  p.append(t1, tag);
  p.append(list(
    kvRow(T('studioFile'), (() => { const s2 = h('span'); s2.append(fileNameEl(d.name || '—')); if (d.size) s2.append(' · ' + fmtSize(d.size)); return s2; })(), true),
    kvRow(T('studioSecLangs'), langsText(d.from, d.to)),
    kvRow(T('studioSecMode'), modeName(modeById(d.mode))),
    kvRow(T('studioSecOut'), outList(d.out).map(outShort).join(' + ')),
    kvRow(T('studioSecStyle'), styleName(d.style)),
    d.terms ? kvRow(T('studioTermsK'), d.terms, true) : null,
    kvRow(T('studioCreated'), fmtDate(d.created))));
  const start = btn('st-btn wide', T('studioStartDraft'), () => { form = freshForm(d); go('edit', d.id); }, 'edit');
  const del = btn('st-btn danger wide', T('studioDelete'), () => {
    const doDel = () => {
      store.drafts = store.drafts.filter((x) => x.id !== d.id);
      if (!save()) { store = load(); return; }
      flashSafe(T('studioDeleted'));
      back();
    };
    if (typeof askConfirm === 'function') askConfirm(T('studioDeleteQ'), doDel, { danger: true, ok: T('studioDeleteOk') });
    else doDel();
  }, 'delete');
  p.append(h('div', 'st-gap'), start, h('div', 'st-gap sm'), del, note(T('studioDraftNote')));
}

/* שלב 3 סבב ד׳: "Claude שואל" — שאלה קצרה באמצע העבודה. תשובה מוכנה בנגיעה, או טקסט כשאין תשובות מוכנות.
   לא ענית עד הזמן שכתוב — העבודה ממשיכה עם ברירת המחדל (העובד מדווח, והכרטיס מתחלף לשורה אחת) */
let askBusy = false;
async function sendAnswer(id, qid, ans) {
  if (askBusy) return;
  askBusy = true; repaint();
  try {
    const j = await net.api('answer', Object.assign({ job: id, qid }, ans));
    const r = jobRec(id);
    if (j.job && r) { r.srv = normJob({ id, srv: j.job }).srv; save(); }
    if (!j.ok) flashSafe(errText(j.error));
  } finally { askBusy = false; render('none'); }
}
/* v362: מגדל הפיקוח — שורה קטנה בזמן העבודה (תקין / חריג), וכרטיס "עצרנו את העבודה" כשהוא עצר */
function towerWhy(tw) {
  const x = fmtX(tw.x);
  switch (tw.why) {
    case 'cost': return T('studioTwWhyCost', { x });
    case 'cap': return T('studioTwWhyCap');
    case 'loop': return T('studioTwWhyLoop', { n: tw.n });
    case 'calls': return T('studioTwWhyCalls', { n: tw.n });
    default: return T('studioTwWhyIdle', { m: tw.min });
  }
}
const fmtX = (x) => (Math.round(x * 10) / 10).toLocaleString(uiLang() === 'en' ? 'en-US' : 'he-IL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
function towerLine(rec) {
  const s = rec.srv, tw = s && s.tw;
  if (!tw || tw.lv === 'red' || !(s.state === 'running' || s.state === 'queued')) return null;
  const c = btn('st-tower ' + tw.lv, null, () => go('tower'), 'tower');   // v363: נגיעה = מסך "מגדל הפיקוח"
  const t = h('span');
  t.textContent = (tw.lv === 'warn' ? T('studioTwWarn', { x: fmtX(tw.x) }) : T('studioTwOk', { x: fmtX(tw.x) }));
  c.append(ico('shield'), t, ico('chev', 'st-chev'));
  return c;
}
function towerStopCard(rec) {
  if (!towerStopped(rec)) return null;
  const tw = rec.srv.tw;
  const c = h('div', 'st-tstop');
  c.dataset.k = 'tower-stop';
  const head = h('div', 'st-tstop-h');
  head.append(ico('shield'), h('b', null, T('studioTwStopT')));
  const row = (k, v) => { const r = h('div', 'st-tstop-r'); r.append(h('span', 'k', k), h('span', 'v', v)); return r; };
  c.append(head, row(T('studioTwWhat'), towerWhy(tw)), row(T('studioTwMeans'), T('studioTwMeansV')));
  const known = tw.fp && ui.fb ? ui.fb.find((e) => e.fp === tw.fp && e.fix) : null;   // v364: תקלה מוכרת — מה Claude יעשה בהמשך
  if (known) { const r = row(T('studioFbKnown'), known.fix); r.lastChild.dir = 'auto'; c.append(r); }
  if (tw.x || tw.usd) {
    const nums = h('span', 'v');
    nums.append(T('studioTwNums', { x: fmtX(tw.x) }) + ' · ', usdEl(tw.usd));
    if (tw.nj) nums.append(' · ' + T('studioTwNormU', { n: tw.nj }));   // v363: "הרגיל" — מהעבודות שלך
    const r = h('div', 'st-tstop-r'); r.append(h('span', 'k', T('studioTwNumsK')), nums); c.append(r);
  }
  c.append(btn('st-link', T('studioTwHow'), () => go('tower'), 'tower-how'));
  return c;
}
/* v365: מגדל הפיקוח 2.0 — כרטיס הבריאות (ציון, זמינות 30 יום, MTTR), מפת השירות (שרשרת הרכיבים) והתראות פתוחות */
function opsComp(c) {
  switch (c) {
    case 'phone': return T('studioCmpPhone');
    case 'drive': return 'Drive';
    case 'server': return T('studioCmpServer');
    case 'routine': return 'Routine';
    case 'claude': return 'Claude';
    default: return T('studioCmpVt');
  }
}
function opsAlert(c, k) {
  switch (c + ':' + k) {
    case 'phone:upload': return T('studioAlPhoneUpload');
    case 'phone:stall': return T('studioAlPhoneStall');
    case 'drive:up_retry': return T('studioAlDriveUpRetry');
    case 'drive:dl_retry': return T('studioAlDriveDlRetry');
    case 'drive:up_fail': return T('studioAlDriveUpFail');
    case 'drive:dl_fail': return T('studioAlDriveDlFail');
    case 'drive:auth': return T('studioAlDriveAuth');
    case 'drive:full': return T('studioAlDriveFull');
    case 'routine:fire': return T('studioAlRoutineFire');
    case 'routine:unsure': return T('studioAlRoutineUnsure');
    case 'routine:rate': return T('studioAlRoutineRate');
    case 'routine:no_claim': return T('studioAlRoutineNoClaim');
    case 'claude:stale': return T('studioAlClaudeStale');
    case 'claude:tw_warn': return T('studioAlClaudeTwWarn');
    case 'claude:tw_stop': return T('studioAlClaudeTwStop');
    case 'claude:net': return T('studioAlClaudeNet');
    case 'vt:setup': return T('studioAlVtSetup');
    case 'vt:ingest': return T('studioAlVtIngest');
    case 'vt:asr': return T('studioAlVtAsr');
    case 'vt:align': return T('studioAlVtAlign');
    case 'vt:check': return T('studioAlVtCheck');
    case 'vt:render': return T('studioAlVtRender');
    default: return T('studioAlVtOther');
  }
}
function opsAgo(ms) {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60e3));
  return m < 60 ? T('studioAgoM', { n: m }) : m < 48 * 60 ? T('studioAgoH', { n: Math.round(m / 60) }) : T('studioAgoD', { n: Math.round(m / 1440) });
}
const fmtPct1 = (v) => (Math.round(v * 10) / 10).toLocaleString(uiLang() === 'en' ? 'en-US' : 'he-IL', { maximumFractionDigits: 1 }) + '%';
function opsSection(o) {
  const out = [];
  // כרטיס הבריאות
  const card = h('div', 'st-health');
  card.dataset.k = 'ops-health';
  const lvl = o.score >= 95 ? 'g' : o.score >= 70 ? 'a' : 'r';
  const ring = h('span', 'st-hring ' + lvl);
  ring.style.setProperty('--v', String(o.score));
  ring.append(h('b', null, String(Math.round(o.score))));
  const t = h('span', 'st-l');
  const word = o.score >= 95 ? T('studioOpsGood') : o.score >= 70 ? T('studioOpsOk') : o.score >= 40 ? T('studioOpsFair') : T('studioOpsBad');
  t.append(h('b', null, T('studioOpsTitle', { w: word })),
    h('small', null, !o.open.length ? T('studioOpsNoAlerts') : o.open.length === 1 ? T('studioOpsOneAlert', { a: opsAlert(o.open[0].c, o.open[0].k) }) : T('studioOpsNAlerts', { n: o.open.length })));
  const top = h('div', 'st-hrow'); top.append(ring, t);
  const kpi = (k, v) => { const d = h('div', 'st-kpi'); d.append(h('small', null, k), h('b', null, v)); return d; };
  const kpis = h('div', 'st-kpis');
  kpis.append(kpi(T('studioOpsAvail'), fmtPct1(o.avail)), kpi(T('studioOpsMttr'), o.mttr == null ? '—' : fmtShort(o.mttr * 60)), kpi(T('studioOpsOpen'), String(o.open.length)));
  card.append(top, kpis);
  out.push(card);
  // מפת השירות — לפי סדר השרשרת; רכיב עם התראה פתוחה צבוע לפי החומרה
  const map = h('div', 'st-smap');
  map.setAttribute('role', 'list'); map.setAttribute('aria-label', T('studioOpsMap'));
  OPS_COMPONENTS.forEach((c, i) => {
    const sv = o.comp[c];
    const n = h('span', 'st-snode' + (sv ? ' bad s' + Math.min(sv, 3) : ''));
    n.setAttribute('role', 'listitem');
    n.append(h('i', 'st-sdot ' + (!sv ? 'g' : sv <= 2 ? 'r' : 'a')), h('bdi', null, opsComp(c)));
    if (i) map.append(h('span', 'st-sarr', '←'));
    map.append(n);
  });
  out.push(secT(T('studioOpsMap')), map);
  // התראות פתוחות
  if (o.open.length) {
    out.push(secT(T('studioOpsOpenT')), list(...o.open.map((a) => {
      const rec = a.j ? jobRec(a.j) : null;
      const r = rec ? btn('st-row st-ric', null, () => go('job', rec.id), 'al:' + a.c + a.k + a.j) : h('div', 'st-row st-ric');
      const l = h('span', 'st-l');
      const sub = h('small');
      sub.append((a.n === 1 ? T('studioOpsEvent1') : T('studioOpsEvents', { n: a.n })) + (rec ? ' · ' : ''));
      if (rec) sub.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')));
      sub.append(' · ' + opsAgo(a.l) + (a.rel ? ' · ' + (a.rel === 1 ? T('studioOpsRel1') : T('studioOpsRel', { n: a.rel })) : ''));
      l.append(h('b', null, opsAlert(a.c, a.k)), sub);
      r.append(h('i', 'st-sdot ' + (a.s <= 2 ? 'r' : a.s === 3 ? 'a' : 'n')), l, h('span', 'st-pri p' + a.s, 'P' + a.s));
      return r;
    })));
  }
  return out;
}
function fbWhy(w) {
  switch (w) {
    case 'cost': return T('studioFbWhyCost');
    case 'cap': return T('studioFbWhyCap');
    case 'loop': return T('studioFbWhyLoop');
    case 'calls': return T('studioFbWhyCalls');
    default: return T('studioFbWhyIdle');
  }
}
/* v366: מסלול התיקונים ו"לשמור / לא" להצעה — בשרתון (המסלול שייך לחשבון, לא לטלפון) */
let fixBusy = false;
async function setFixMode(mode) {
  if (fixBusy || ui.fm === mode) return;
  const prev = ui.fm; ui.fm = mode; fixBusy = true; render('none');
  try {
    const j = await net.api('fixMode', { mode });
    if (!j.ok) { ui.fm = prev; flashSafe(errText(j.error)); }
  } finally { fixBusy = false; render('none'); }
}
async function decideFix(fp, ok) {
  if (fixBusy) return;
  fixBusy = true;
  try {
    const j = await net.api('fbDecide', { fp, ok });
    const fb = normFb(j.fb); if (fb) ui.fb = fb;
    flashSafe(!j.ok ? errText(j.error) : ok ? T('studioFbKept') : T('studioFbDropped'));
  } finally { fixBusy = false; render('none'); }
}
const fbStage = (st) => { const c = { tr: 'asr', al: 'al', tl: 'tl', rv: 'rv' }[st]; return c ? ckName(c) : ''; };
/* v363: מסך "מגדל הפיקוח" — מה קורה עכשיו, "הרגיל" שלך לכל מצב (נלמד מהעבודות שלך), מתי עוצרים, ועצירות אחרונות */
function pageTower(p) {
  p.append(navBar({ back: T('studioBack') }), large(T('studioTwT')), h('p', 'st-lede', T('studioTwLede')));
  const ab = accessBanner(); if (ab) p.append(ab);
  if (ui.ops) p.append(...opsSection(ui.ops));   // v365: בריאות הסטודיו, מפת השירות והתראות פתוחות
  if (ui.api && (ui.api.admin || ui.api.servers)) {
    p.append(list(rowNav({ tile: tile('cloud', ui.api.online ? 'green' : 'orange'), label: T('studioSrvT'),
      sub: ui.api.online ? T('studioSrvOnN', { n: ui.api.online }) : T('studioSrvNone'), onClick: () => go('server'), k: 'tower-srv' })));
  }
  const name = (rec) => { const b = h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')); return b; };
  const jobRow = (rec, sub, color, k) => {
    const r = btn('st-row st-ric', null, () => go('job', rec.id), k);
    const l = h('span', 'st-l'); const b = h('b'); b.append(name(rec)); l.append(b, h('small', null, sub));
    r.append(tile('shield', color), l, ico('chev', 'st-chev'));
    return r;
  };
  const act = store.jobs.filter((r) => r.srv && (r.srv.state === 'running' || r.srv.state === 'queued'));
  p.append(secT(T('studioTwSecNow')), list(...(act.length ? act.map((rec) => {
    const tw = rec.srv.tw;
    const sub = !tw ? T('studioTwWaitRep') : tw.lv === 'warn' ? T('studioTwWarnS', { x: fmtX(tw.x) }) : T('studioTwOkS', { x: fmtX(tw.x) });   // בלי "מגדל הפיקוח ·" — כבר בכותרת
    return jobRow(rec, sub, tw && tw.lv === 'warn' ? 'orange' : 'green', 'tw:' + rec.id);
  }) : [h('div', 'st-row st-muted', T('studioTwNone'))])));
  // v364: ספר התיקונים — כל תקלה שעצרה עבודה, מה Claude רשם לעשות כשהיא חוזרת, וכמה פעמים זה טופל לבד
  if (ui.fb && ui.fb.length) {
    p.append(secT(T('studioFbT')), list(...ui.fb.slice(0, 8).map((e) => {
      const st = fbStage(e.st);
      const r = h('div', 'st-row st-fb');
      r.dataset.k = 'fb:' + e.fp;
      const l = h('span', 'st-l');
      const fx = h('small', e.fix ? null : 'st-muted', e.fix || T('studioFbNoFix'));
      if (e.fix) fx.dir = 'auto';   // התיקון בשפה ש־Claude כתב — לא בהכרח שפת הממשק
      const cnt = h('small', 'st-fbn', e.auto ? (e.auto === 1 ? T('studioFbAuto1') : T('studioFbAutoN', { n: e.auto })) : (e.n === 1 ? T('studioFbStop1') : T('studioFbStopN', { n: e.n })));
      l.append(h('b', null, fbWhy(e.why) + (st ? ' · ' + st : '')), fx, cnt);   // המונה בשורה משלו — התיקון מקבל את כל הרוחב
      if (e.px) {
        // v366: הצעה של Claude שממתינה להחלטה — טקסט בלבד, ושני כפתורים
        const pr = h('span', 'st-fbp'); const pt = h('small', null, e.px); pt.dir = 'auto';
        const bs = h('span', 'st-fbb');
        bs.append(btn('st-mini tint', T('studioFbKeep'), () => decideFix(e.fp, true), 'fbk:' + e.fp), btn('st-mini ghost', T('studioFbDrop'), () => decideFix(e.fp, false), 'fbd:' + e.fp));
        pr.append(h('small', 'st-fbpl', T('studioFbPropL')), pt, bs);
        l.append(pr);
      }
      r.append(l);
      return r;
    })));
  }
  // v366: מסלול התיקונים — "הצעות לאישור" (ברירת המחדל) או "Claude מחליט לבד"
  const fm = ui.fm === 'auto' ? 'auto' : 'suggest';
  p.append(secT(T('studioFmT')), list(
    rowRadio({ label: T('studioFmSug'), sub: T('studioFmSugS'), on: fm === 'suggest', onClick: () => setFixMode('suggest'), k: 'fm:suggest', disabled: blocked() }),
    rowRadio({ label: T('studioFmAuto'), sub: T('studioFmAutoS'), on: fm === 'auto', onClick: () => setFixMode('auto'), k: 'fm:auto', disabled: blocked() })));
  // הרגיל — המצב שבשימוש בברירת המחדל, וכל מצב שכבר נלמד מהעבודות שלך
  const nm = ui.norm;
  let learned = false;
  if (nm) {
    const ids = MODES.map((m) => m.id).filter((id) => nm[id] && (id === store.settings.mode || !nm[id].d || nm[id].n));
    const rows = ids.map((id) => {
      const v = nm[id];
      if (!v.d) learned = true;
      const left = Math.max(1, 3 - v.n);
      const sub = !v.d ? T('studioTwNormU', { n: v.n }) : T('studioTwNormD') + ' · ' + (left === 1 ? T('studioTwNormLeft1') : T('studioTwNormLeft', { n: left }));
      const r = h('div', 'st-row');
      const val = h('span', 'st-v'); val.append(usdEl(v.ph));
      r.append(rowTxt(modeName(modeById(id)), sub), val);
      r.dataset.k = 'nm:' + id;
      return r;
    });
    p.append(secT(T('studioTwSecNorm')), list(...rows));
  }
  const rule = (txt) => h('div', 'st-row st-rule', txt);   // כללים — טקסט רגיל, לא כותרות
  p.append(secT(T('studioTwSecRules')), list(rule(learned ? T('studioTwR1U') : T('studioTwR1')), rule(T('studioTwR2')), rule(T('studioTwR3')), rule(T('studioTwR4'))),
    note(T('studioTwRulesNote')));
  const stops = store.jobs.filter(towerStopped);
  if (stops.length) p.append(secT(T('studioTwSecStops')), list(...stops.slice(0, 5).map((rec) => jobRow(rec, towerWhy(rec.srv.tw), 'red', 'ts:' + rec.id))));
}
function askCard(rec) {
  const qa = rec.srv && rec.srv.qa;
  if (!qa || FINAL.includes(rec.srv.state)) return null;
  const c = h('div', 'st-ask' + (qa.a ? ' done' : ''));
  c.dataset.k = 'ask';
  if (qa.a) {                                   // כבר טופלה — שורה אחת
    const tx = qa.a.auto ? (qa.d >= 0 ? T('studioAskAuto', { a: qa.a.t }) : T('studioAskAutoFree')) : T('studioAskDone', { a: qa.a.t });
    c.append(ico('check'), h('span', null, tx));
    return c;
  }
  const head = h('div', 'st-ask-h');
  head.append(ico('help'), h('b', null, T('studioAskT')));
  const q = h('p', 'st-ask-q', qa.q); q.dir = 'auto';
  c.append(head, q);
  const opts = h('div', 'st-ask-o');
  if (qa.o.length) {
    qa.o.forEach((o, i) => {
      const b = btn('st-btn ' + (i === qa.d ? 'tint' : 'ghost') + ' wide', null, () => sendAnswer(rec.id, qa.id, { i }), 'ask:' + i);
      const t = h('bdi', null, o); t.dir = 'auto'; b.append(t);
      b.disabled = askBusy;
      opts.append(b);
    });
  } else {
    const ta = h('textarea', 'st-in st-ask-in'); ta.rows = 2; ta.maxLength = 200; ta.dir = 'auto'; ta.dataset.k = 'ask:t';
    ta.setAttribute('aria-label', T('studioAskT'));
    const send = btn('st-btn wide', T('studioAskSend'), () => { const t = ta.value.trim(); if (t) sendAnswer(rec.id, qa.id, { t }); }, 'ask:send');
    send.disabled = askBusy;
    opts.append(ta, send);
  }
  c.append(opts);
  const until = fmtClock((qa.at || Date.now()) + qa.w * 1000);
  c.append(h('small', 'st-ask-n', qa.d >= 0 ? T('studioAskDefault', { t: until, a: qa.o[qa.d] }) : T('studioAskFree', { t: until })));
  return c;
}

/* v359: כרטיס "עלות" בדף העבודה */
function costLabel(k) {
  switch (k) {
    case 'main': return T('studioCostMain');
    case 'tl': return T('studioCostTl');
    case 'rv': return T('studioCostRv');
    default: return T('studioCostSub');
  }
}
function usdEl(v, plus) { const b = h('bdi', null, v == null ? '—' : fmtUsd(v) + (plus ? '+' : '')); b.dir = 'ltr'; return b; }   // "+" בתוך הבידוד — אחרת ב־RTL הוא קופץ לצד השני
function costCard(cv) {
  const rows = cv.rows.map((r) => {
    const row = h('div', 'st-row st-cost' + (r.off ? ' off-model' : ''));
    const l = h('span', 'st-l');
    l.append(h('b', null, costLabel(r.k) + (r.nth ? ' ' + r.nth : '')));
    const sm = h('small');
    sm.append(h('bdi', null, r.model), ' · ' + T('studioCostTok', { n: fmtTok(r.tok) }));
    if (r.open) { sm.append(' · ' + T('studioCostOpen') + ' '); sm.append(r.open.usd == null ? T('studioCostTok', { n: fmtTok(r.open.tok) }) : usdEl(r.open.usd)); }
    if (r.usd == null) sm.append(' · ' + T('studioCostNoPrice'));
    l.append(sm);
    const v = h('span', 'st-v'); v.append(usdEl(r.usd));
    row.append(l, v);
    row.dataset.k = 'cost:' + r.k + (r.nth || '');
    return row;
  });
  const tot = h('div', 'st-row st-cost total');
  const tv = h('span', 'st-v'); tv.append(usdEl(cv.total, cv.partial));
  tot.append(h('span', 'st-l', T('studioCostTotal')), tv);
  tot.dataset.k = 'cost:total';
  const out = [secT(T('studioSecCost'))];
  for (const w of cv.warn) out.push(banner('warn', w.k === 'tl' ? T('studioCostWarnTl', { got: w.model, want: cv.want }) : T('studioCostWarnRv', { got: w.model, want: cv.want })));
  out.push(list(...rows, tot), note(T('studioCostNote')));
  return out;
}

/* מסך ההתקדמות — "שגם ילד וגם אדם מבוגר יבינו": כמה נשאר, מתי יהיה מוכן, מה קורה עכשיו, ולכל שלב זמן */
function pageJob(p) {
  const rec = jobRec(ui.param);
  if (!rec) { back(); return; }
  const id = rec.id;
  p.append(navBar({ back: T('studioShort') }));
  const t1 = h('h1', 'st-large clamp'); t1.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')));
  p.append(t1);
  const ab = accessBanner(); if (ab) p.append(ab);
  const run0 = runs.get(id), ph0 = jobPhase(rec, run0);
  const toTxt = langsSum(rec.spec.to);

  // למעלה: טבעת + "נשארו בערך…" + "יהיה מוכן בסביבות…"
  const hero = h('div', 'st-hero');
  const ring = h('span', 'st-ring');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 64 64'); svg.setAttribute('aria-hidden', 'true');
  const mk = (cls) => { const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', '32'); c.setAttribute('cy', '32'); c.setAttribute('r', '27'); c.setAttribute('class', cls); return c; };
  const track = mk('trk'), arc = mk('arc');
  svg.append(track, arc);
  const pctEl = h('b');
  ring.append(svg, pctEl);
  const ht = h('span', 'st-hero-t');
  const big = h('span', 'st-left-big'), sub = h('span', 'st-left-sub');
  ht.append(big, sub);
  hero.append(ring, ht);
  live(hero, () => {
    const r = jobRec(id); if (!r) return;
    const run = runs.get(id), ph = jobPhase(r, run), hs = heroState(r, run, ph);
    arc.style.strokeDashoffset = String(Math.round(170 * (1 - hs.pct)));
    pctEl.textContent = hs.check ? '✓' : Math.round(hs.pct * 100) + '%';
    big.textContent = hs.big; sub.textContent = hs.sub; sub.hidden = !hs.sub;
  });
  p.append(hero);
  const ask = askCard(rec);   // שאלה מ־Claude — מעל הכל, כי היא מחכה לך
  if (ask) p.append(ask);
  const tstop = towerStopCard(rec);   // v362: מגדל הפיקוח עצר — מה קרה, מה זה אומר, המספרים
  if (tstop) p.append(tstop);
  const tline = towerLine(rec);
  if (tline) p.append(tline);

  // מה קורה עכשיו — משפט אחד + דוגמה חיה
  const nowc = h('div', 'st-nowc');
  const nic = h('span', 'st-nowic');
  nic.append(ico(ph0 === 'wait' ? (run0 && run0.wait === 'wifi' ? 'wifi' : 'cloud') : ph0 === 'error' || ph0 === 'failed' ? 'alert' : ph0 === 'need' || ph0 === 'paused' || ph0 === 'stuck' ? 'pause' : 'up'));
  const ntx = h('span', 'st-l'); const nb = h('b'), ns = h('small');
  const npb = h('span', 'st-pbar'); const npi = h('i'); npb.append(npi);
  ntx.append(nb, ns, npb);
  nowc.append(nic, ntx);
  live(nowc, () => {
    const r = jobRec(id); if (!r) return;
    const run = runs.get(id), ph = jobPhase(r, run);
    nb.textContent = nowLine(r, run, ph);
    const ex = r.srv && r.srv.prog && r.srv.prog.ex;
    ns.textContent = ph === 'extract' ? Math.round(100 * (run.p || 0)) + '%'
      : ph === 'audio' ? T('studioUpOf', { a: fmtSize(run.sent || 0), b: fmtSize(run.total || 0) })
      : ph === 'video' ? videoLine(r, run) : ph === 'running' && ex ? ex : '';
    ns.hidden = !ns.textContent;
    const up = ph === 'extract' || ph === 'audio' || ph === 'video';
    npb.hidden = !up;
    if (up) npi.style.width = Math.round(100 * (run.p || 0)) + '%';
  });
  // "מוכן" שרק מחכה לעדכון הבא / לחיבור — הראש כבר אומר את זה; בלי כרטיס כפול
  const quiet = ph0 === 'ready' && ['', 'worker_not_ready', 'conn_missing'].includes(rec.up.wait);
  if (!quiet && !qaPending(rec) && !tstop) p.append(nowc);   // כרטיס העצירה כבר אומר מה קרה   // שאלה פתוחה — כרטיס השאלה הוא "מה קורה עכשיו"
  // פעולה לפי המצב: בחירה חוזרת / המשך / נסיון חוזר / התחלה
  const acts = [];
  if (ph0 === 'need') acts.push(btn('st-btn wide', T('studioRepickBtn'), () => repickFor(id), 'repick'));
  else if (ph0 === 'paused' || ph0 === 'error') acts.push(btn('st-btn wide', ph0 === 'error' ? T('studioRetry') : T('studioResume'), () => resumeJob(id, true), 'resume'));
  else if (ph0 === 'ready' && rec.up.wait === 'conn_missing') acts.push(btn('st-btn wide', T('studioConnectNow'), () => go('settings'), 'connect-now'));
  else if (ph0 === 'ready' && ui.kinds.includes('tr') && rec.up.wait !== '') acts.push(btn('st-btn wide', T('studioStartNow'), () => { rec.up.wait = ''; tryStart(id); }, 'start-now'));
  else if (canResume(rec)) {
    // v361: "המשך מאותה נקודה" — Claude מוריד את נקודת השמירה האחרונה וממשיך ממנה (בלי לתמלל ולתרגם מחדש)
    const ck = rec.srv.ck;
    acts.push(btn('st-btn wide', ui.resuming === id ? T('studioResuming') : ck ? T('studioResumeCk') : T('studioRetryAll'), () => resumeSrv(id), 'resume-srv'));
    if (ck) acts.push(note(T('studioCkSaved', { s: ckName(ck.s) })));
  }
  if (acts.length) p.append(h('div', 'st-gap sm'), ...acts);

  // השלבים
  const m0 = modelFor(rec);
  const stl = h('div', 'st-stages');
  for (const s of m0.stages) {
    const row = h('div', 'st-stg ' + s.state);
    const dot = h('span', 'dot');
    if (s.state === 'done') dot.append(ico('check'));
    else if (s.state === 'now') dot.append(h('span', 'st-spin'));
    const txt = h('span', 'st-l');
    txt.append(h('b', null, stageName(s.id, toTxt)), h('small', null, stageSub(s.id)));
    const tm = h('span', 'st-stg-t');
    row.append(dot, txt, tm);
    if (s.state === 'now') { const pb = h('span', 'st-pbar'); const pi = h('i'); pb.append(pi); txt.append(pb); live(pb, () => { const mm = modelFor(jobRec(id) || rec).stages.find((x) => x.id === s.id); pi.style.width = Math.round(100 * ((mm && mm.p) || 0)) + '%'; }); }
    live(tm, () => {
      const mm = modelFor(jobRec(id) || rec).stages.find((x) => x.id === s.id) || s;
      tm.textContent = mm.state === 'done' ? (mm.took ? '✓ ' + fmtShort(mm.took) : '✓') : mm.state === 'now' ? T('studioStageLeft', { t: fmtShort(mm.left) }) : approx(fmtShort(mm.est));
    });
    stl.append(row);
  }
  p.append(secT(T('studioSecStages')), stl);

  // v359: עלות — שורה לכל שלב, עלות הפתיחה של כל סוכן־משנה, סכום כולל
  const cv = rec.srv && rec.srv.use ? costView(rec.srv.use, rec.spec.mode) : null;
  if (cv) p.append(...costCard(cv));

  // הסרטון המלא — עולה ברקע אחרי הקול (Claude צריך אותו רק לצריבה)
  if (!rec.up.noAudio && !rec.up.v.done && (ph0 === 'queued' || ph0 === 'running')) {
    const vc = h('div', 'st-vcard');
    const vt = h('span', 'st-l'); const vb = h('b', null, T('studioVideoT')), vs = h('small');
    const pb = h('span', 'st-pbar'); const pi = h('i'); pb.append(pi);
    vt.append(vb, vs, pb);
    vc.append(tile('film', 'blue'), vt);
    live(vc, () => {
      const r = jobRec(id); if (!r) return;
      const run = runs.get(id);
      const sent = run && run.phase === 'video' ? run.sent || 0 : r.up.v.sent || 0;
      pi.style.width = Math.round(100 * sent / Math.max(1, r.spec.size)) + '%';
      vs.textContent = videoLine(r, run) + (run && run.phase === 'video' && run.active ? '' : ' · ' + T('studioVideoAfter'));
    });
    p.append(h('div', 'st-gap sm'), vc, note(T('studioKeepOpen')));
  }

  // פרטים טכניים — מוסתרים, למי שסקרן
  const det = h('details', 'st-details');
  if (ui.det) det.open = true;
  det.addEventListener('toggle', () => { ui.det = det.open; });
  const sum = h('summary', null, T('studioTech'));
  const rows = [
    kvRow(T('studioFile'), (() => { const s2 = h('span'); s2.append(fileNameEl(rec.spec.name || '—'), ' · ' + fmtSize(rec.spec.size)); return s2; })(), true),
    rec.spec.dur ? kvRow(T('studioDur'), fmtDur(rec.spec.dur), true) : null,
    kvRow(T('studioSecLangs'), langsText(rec.spec.from, rec.spec.to)),
    kvRow(T('studioSecMode'), modeName(modeById(rec.spec.mode))),
    kvRow(T('studioSecOut'), rec.spec.out.concat('srt').map(outShort).join(' + ')),
    kvRow(T('studioSecStyle'), styleName(rec.spec.style)),
    rec.up.a.done ? kvRow(T('studioAudioK'), fmtSize(rec.up.a.size)) : rec.up.noAudio ? kvRow(T('studioAudioK'), T('studioNoAudio')) : null,
    kvRow(T('studioCreated'), fmtDate(rec.created)),
    kvRow(T('studioJobId'), rec.id, true),
    rec.srv && rec.srv.ed ? kvRow(T('studioErrCodeL'), rec.srv.ed, true) : null,
  ];
  const links = h('div', 'st-wacts');
  for (const o of (rec.srv && rec.srv.out) || []) links.append(extLink('st-wbtn', 'https://drive.google.com/file/d/' + o.id + '/view', outShort(o.k) + (o.size ? ' · ' + fmtSize(o.size) : ''), 'out', 'out:' + o.k));
  if (rec.up.folder) links.append(extLink('st-wbtn', 'https://drive.google.com/drive/folders/' + rec.up.folder, T('studioOpenDrive'), 'out', 'drive-folder'));
  if (rec.srv && rec.srv.sess) links.append(extLink('st-wbtn', rec.srv.sess.url, T('studioOpenSess'), 'out', 'session'));
  det.append(sum, list(...rows), links);
  p.append(h('div', 'st-gap sm'), det);

  // ביטול / מחיקה
  const fin = FINAL.includes(ph0);
  const del = btn('st-btn danger wide', fin || ph0 === 'ready' || ph0 === 'paused' || ph0 === 'need' || ph0 === 'error' ? T('studioJobDel') : T('studioJobCancel'), () => {
    const removing = fin || ph0 === 'ready' || ph0 === 'paused' || ph0 === 'need' || ph0 === 'error';
    const doIt = async () => {
      stopRun(id);
      if (removing) {
        if (!fin) await net.api('cancel', { job: id });
        const j = await net.api('remove', { job: id });
        if (!j.ok && j.error !== 'no_job') { flashSafe(errText(j.error)); return; }
        store.jobs = store.jobs.filter((x) => x.id !== id); runs.delete(id); handleOp('del', id); save();
        flashSafe(T('studioJobDeleted')); back();
      } else {
        const j = await net.api('cancel', { job: id });
        if (j.job) { const r = jobRec(id); if (r) r.srv = normJob({ id, srv: j.job }).srv; }
        save(); repaint();
      }
    };
    if (typeof askConfirm === 'function') askConfirm(removing ? T('studioJobDelQ') : T('studioJobCancelQ'), doIt, { danger: true, ok: removing ? T('studioDeleteOk') : T('studioJobCancelOk') });
    else doIt();
  }, 'job-del');
  p.append(h('div', 'st-gap'), del);
}

function connectDrive() {
  if (ui.driveBusy) return;
  ui.driveBusy = true;
  let pr;
  try { pr = gd().connect(); } catch (e) { pr = Promise.reject(e); }   // החלון נפתח כאן, בתוך הלחיצה
  repaint();
  pr.then(() => flashSafe(T('studioDriveOk')))
    .catch((e) => {
      const c = e && e.code;
      flashSafe(c === 'gd_popup' ? T('studioDrivePopup') : c === 'gd_denied' || c === 'gd_cancel' ? T('studioDriveCancel') : c === 'gd_not_configured' ? T('studioDriveNoCfg') : T('studioDriveErr'));
    })
    .finally(() => { ui.driveBusy = false; statusAt = 0; refreshStatus(true); });
}
function testLine() {             // מצב בדיקת החיבור — שורה מתחת לכפתור
  if (!testRun) return null;
  const d = h('div', 'st-test ' + testRun.st);
  if (testRun.st === 'fire' || testRun.st === 'wait') d.append(h('span', 'st-spin'));
  else d.append(ico(testRun.st === 'ok' ? 'check' : 'alert'));
  const txt = h('span', 'st-l');
  if (testRun.st === 'fire') txt.append(h('b', null, T('studioTestFire')));
  else if (testRun.st === 'wait' && testRun.unsure && !testRun.claimed) {
    txt.append(h('b', null, T('studioTestUnsure')), h('small', null, T('studioTestUnsureS')));
    if (testRun.ed) { const c = h('small', 'st-ecode'); c.append(T('studioErrCodeL') + ': ', h('bdi', null, testRun.ed)); txt.append(c); }
  }
  else if (testRun.st === 'wait') txt.append(h('b', null, testRun.claimed ? T('studioTestClaimed') : T('studioTestWait')), h('small', null, T('studioTestWaitS')));
  else if (testRun.st === 'ok') txt.append(h('b', null, T('studioTestOk')), h('small', null, testRun.drive ? T('studioTestDriveOk') : T('studioTestDriveNo')));
  else {
    txt.append(h('b', null, T('studioTestErr')), h('small', null, errText(testRun.err, testRun)));
    if (testRun.ed) { const c = h('small', 'st-ecode'); c.append(T('studioErrCodeL') + ': ', h('bdi', null, testRun.ed)); txt.append(c); }
  }
  d.append(txt);
  if (testRun.sess) d.append(extLink('st-link', testRun.sess, T('studioOpenSess'), null, 'test-sess'));
  return d;
}
function pageSettings(p) {
  const s = store.settings, m = modeById(s.mode);
  p.append(navBar({ back: T('studioShort') }), large(T('studioSettings')));
  const ab = accessBanner(); if (ab) p.append(ab);
  // "המנוי שלי" (Routine) או "השרת של המערכת" (מפתח API בשרת שלנו, תקציב חודשי). העתק־הדבק — בשלב 7
  const isApi = apiMode();
  const pick = (c) => () => { s.conn = c; save(); render('none'); };
  p.append(secT(T('studioSecClaude')), list(
    rowRadio({ label: T('studioConnSub'), sub: T('studioConnSubS'), on: !isApi, onClick: pick('sub'), k: 'cn:sub' }),
    rowRadio({ label: T('studioConnCopy'), sub: T('studioConnCopyS'), on: false, disabled: true, badge: T('studioSoon') }),
    rowRadio({ label: T('studioConnApi'), sub: T('studioConnApiS'), on: isApi, onClick: pick('api'), disabled: !ui.api, badge: ui.api ? null : T('studioSoon'), k: 'cn:api' })));
  const c = store.conn;
  if (isApi) {
    // השרת של המערכת: בלי אשף ובלי Routine — רק התקציב, התקרה לעבודה והשרת
    const a = ui.api;
    p.append(secT(T('studioSecApi')), list(
      kvRow(T('studioApiMonth'), T('studioApiOf', { a: fmtUsd(a.month), b: fmtUsd(a.cap) })),
      rowNav({ label: T('studioApiCap'), value: '$' + s.cap, onClick: () => go('def', 'cap'), k: 'def:cap' }),
      rowNav({ tile: tile('cloud', a.online ? 'green' : 'orange'), label: T('studioSrvT'), sub: a.online ? T('studioSrvOnN', { n: a.online }) : T('studioSrvNone'), onClick: () => go('server'), k: 'server' })));
  } else if (c) {
    const st = c.ok ? T('studioConnChecked', { t: fmtDate(c.ok) }) : T('studioConnUnchecked');
    const head = h('div', 'st-row st-ric');
    const hn = h('span', 'st-l'); hn.append(h('b', null, T('studioConnOn')));
    const hs = h('small'); hs.append(h('bdi', null, c.hint), ' · ' + st); hn.append(hs);
    head.append(tile('key', 'green'), hn);
    const busy = testRun && (testRun.st === 'fire' || testRun.st === 'wait');
    const tb = btn('st-row st-act', busy ? T('studioTesting') : T('studioTestConn'), runTest, 'test');
    tb.disabled = !!busy || blocked();
    p.append(secT(T('studioSecConnect')), list(head, tb,
      rowNav({ label: T('studioReconnect'), onClick: () => go('connect'), k: 'wizard' }),
      btn('st-row st-act danger', T('studioDisconn'), disconnectClaude, 'disconnect')));
    const tl = testLine(); if (tl) p.append(tl);
  } else {
    p.append(secT(T('studioSecConnect')), list(
      rowNav({ tile: tile('key', 'green'), label: T('studioWizard'), sub: T('studioNotConn') + ' · ' + T('studioWizardS'), onClick: () => go('connect'), k: 'wizard' })));
  }
  // Google Drive — שם הסרטונים והתוצרים (חיבור נפרד מגיבוי הספרייה, v357)
  const dr = store.drive;
  const drow = h('div', 'st-row st-ric');
  const dl = h('span', 'st-l'); dl.append(h('b', null, 'Google Drive'));
  const dsub = h('small'); if (dr && dr.connected && dr.email) dsub.append(h('bdi', null, dr.email)); else dsub.textContent = T('studioDriveNot');
  dl.append(dsub);
  drow.append(tile('cloud', 'blue'), dl);
  const drows = [drow];
  if (!dr || !dr.connected) { const b = btn('st-row st-act', ui.driveBusy ? T('studioDriveBusy') : T('studioDriveConnect'), connectDrive, 'drive-connect'); b.disabled = ui.driveBusy || blocked(); drows.push(b); }
  p.append(secT(T('studioSecDrive')), list(...drows), note(T('studioDriveNote')));
  // העלאה
  p.append(secT(T('studioSecUpload')), list(
    rowSwitch({ label: T('studioWifiOnly'), sub: typeKnown() ? T('studioWifiOnlyS') : T('studioWifiUnknown'), on: s.wifi, onClick: () => { s.wifi = !s.wifi; save(); render('none'); }, k: 'wifi' })));
  p.append(secT(T('studioSecSafety')), list(
    rowNav({ tile: tile('shield', 'green'), label: T('studioTwT'), sub: T('studioTwRowS'), onClick: () => go('tower'), k: 'tower' })));
  p.append(secT(T('studioSecDefaults')), list(
    rowNav({ label: T('studioSecMode'), value: modeShort(m), onClick: () => go('def', 'mode'), k: 'def:mode' }),
    rowNav({ label: T('studioTo'), value: langsSum(s.to), onClick: () => go('lang', 'def'), k: 'def:to' }),
    rowNav({ label: T('studioSecOut'), value: outList(s.out).map(outShort).join(' + '), onClick: () => go('def', 'out'), k: 'def:out' }),
    rowNav({ label: T('studioSecStyle'), value: styleName(s.style), onClick: () => go('def', 'style'), k: 'def:style' })));
}
/* ---------------- מסך השרת (מצב API של המערכת) ----------------
   השרת לא פתוח לאינטרנט — הוא שואל את השרתון כל 20 שנ׳ ומדווח דופק. כאן רואים אותו ומנהלים אותו (המנהל בלבד):
   מחובר / לא, גרסה, דיסק, זיכרון, מה הוא מתרגם, השהיה, הסרה (הטוקן מת מיד), והוספה (הטוקן מוצג פעם אחת) */
const apiMode = () => store.settings.conn === 'api' && !!ui.api;
async function refreshServers() {
  if (!ui.api || !ui.api.admin) return;
  const j = await net.api('srvList');
  if (j.ok) { ui.servers = normServers(j.servers) || []; ui.srvQueue = num(j.queue); }
  repaint();
}
async function srvAct(op, sv, extra) {
  if (ui.srvBusy) return;
  ui.srvBusy = true; render('none');
  const j = await net.api(op, Object.assign({ sid: sv.id }, extra || {}));
  ui.srvBusy = false;
  if (j.ok) { ui.servers = normServers(j.servers) || []; ui.srvQueue = num(j.queue); }
  else flashSafe(errText(j.error, j));
  render('none');
}
async function addServer() {
  if (ui.srvBusy) return;
  ui.srvBusy = true; render('none');
  const j = await net.api('srvCreate', {});
  ui.srvBusy = false;
  if (j.ok && /^[a-z0-9]{12}-[A-Za-z0-9_-]{43}$/.test(String(j.token || ''))) { ui.newToken = j.token; refreshStatus(true); await refreshServers(); }
  else flashSafe(errText(j.error, j));
  render('none');
}
function pageServer(p) {
  p.append(navBar({ back: T('studioTwT') }), large(T('studioSrvT')), h('p', 'st-lede', T('studioSrvLede')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const a = ui.api;
  if (a) p.append(secT(T('studioApiMonthT')), list(kvRow(T('studioApiMonth'), T('studioApiOf', { a: fmtUsd(a.month), b: fmtUsd(a.cap) }))));
  if (!a || !a.admin) { p.append(note(a && a.online ? T('studioSrvOnN', { n: a.online }) : T('studioSrvNone'))); return; }
  if (ui.newToken) { const tk = h('div', 'st-tok'); tk.append(copyBox(ui.newToken, T('studioCopy'), 'srv-token')); p.append(secT(T('studioSrvNewT')), list(tk), note(T('studioSrvTokNote'))); }
  const rows = [];
  for (const sv of ui.servers || []) {
    const stt = srvState(sv);
    const r = h('div', 'st-row st-ric'); r.dataset.k = 'srv:' + sv.id;
    const l = h('span', 'st-l'); const b = h('b'); b.append(h('bdi', null, sv.name));
    const parts = [stt === 'on' ? T('studioSrvOn') : stt === 'paused' ? T('studioSrvPaused') : sv.seen ? T('studioSrvOff', { t: fmtDate(sv.seen) }) : T('studioSrvNever')];
    if (sv.hb && stt !== 'off') {
      if (sv.hb.disk != null) parts.push(T('studioSrvDisk', { n: Math.round(sv.hb.disk) }));
      if (sv.hb.mem != null) parts.push(T('studioSrvMem', { n: Math.round(sv.hb.mem) }));
    }
    const sub = h('small', null, parts.join(' · '));
    if (sv.hb && sv.hb.v) sub.append(' · ', h('bdi', null, sv.hb.v.slice(0, 7)));
    l.append(b, sub);
    if (sv.job) { const js = h('small'); js.append(T('studioSrvJob') + ' '); js.append(h('bdi', null, sv.job.name ? fileTitle(sv.job.name) : T('studioSrvJobOther'))); l.append(js); }
    r.append(tile('cloud', stt === 'on' ? 'green' : stt === 'paused' ? 'orange' : 'red'), l);
    // שתי פעולות קטנות בתוך השורה (לא שורה לכל פעולה) — השהיה / המשך, והסרה עם אישור
    const pb = btn('st-mini fill', sv.paused ? T('studioSrvResume') : T('studioSrvPause'), () => srvAct('srvPause', sv, { paused: !sv.paused }), 'srv-pause:' + sv.id);
    const rm = () => srvAct('srvRemove', sv);
    const rb = btn('st-mini danger', T('studioSrvRemove'), () => (typeof askConfirm === 'function' ? askConfirm(T('studioSrvRemoveQ'), rm, { danger: true, ok: T('studioSrvRemove') }) : rm()), 'srv-rm:' + sv.id);
    pb.disabled = rb.disabled = ui.srvBusy || blocked();
    const bs = h('span', 'st-fbb'); bs.append(pb, rb); l.append(bs);
    rows.push(r);
  }
  const add = btn('st-row st-act', ui.srvBusy ? T('studioSrvAdding') : T('studioSrvAdd'), addServer, 'srv-add');
  add.disabled = ui.srvBusy || blocked();
  p.append(secT(T('studioSrvListT')), list(...(rows.length ? rows : [h('div', 'st-row st-muted', ui.servers ? T('studioSrvEmpty') : T('studioLoading'))]), add));
  if (ui.srvQueue) p.append(note(T('studioSrvQueue', { n: ui.srvQueue })));
  p.append(note(T('studioSrvNote')));
}
function disconnectClaude() {
  const doIt = async () => {
    const j = await net.api('disconnect');
    if (!j.ok) { flashSafe(errText(j.error)); return; }
    store.conn = null; testRun = null; save();
    flashSafe(T('studioDisconnected')); repaint();
  };
  if (typeof askConfirm === 'function') askConfirm(T('studioDisconnQ'), doIt, { danger: true, ok: T('studioDisconnOk') });
  else doIt();
}

/* ברירת מחדל אחת (מצב / פלטים / מראה) — נשמרת מיד */
function pageDef(p) {
  const s = store.settings, k = ui.param;
  const set = (fn) => { fn(); save(); render('none'); };
  p.append(navBar({ back: T('studioSettings') }));
  if (k === 'mode') p.append(large(T('studioSecMode')), ...modePicker(s.mode, (id) => set(() => { s.mode = id; })));
  else if (k === 'out') p.append(large(T('studioSecOut')), outRows(s.out, 0, (o) => set(() => { s.out[o] = !s.out[o]; })));
  else if (k === 'style') p.append(large(T('studioSecStyle')), stylePicker(s.style, (st) => set(() => { s.style = st; })));
  else if (k === 'cap') { p.append(large(T('studioApiCap')), list(...CAPS.map((c) => rowRadio({ label: '$' + c, on: s.cap === c, onClick: () => set(() => { s.cap = c; }), k: 'cap:' + c }))), note(T('studioApiCapNote'))); return; }
  else { back(); return; }
  p.append(note(T('studioDefNote')));
}

/* אשף החיבור — שלושת השלבים של ההגדרה החד־פעמית: סביבה, Routine עם טריגר API, הדבקה ובדיקה.
   המפתח שמודבק נשלח לשרתון ונשמר שם רק מוצפן; בטלפון הוא רק בשדה, עד שהשמירה הצליחה (או שיוצאים מהדף) */
function pageConnect(p) {
  p.append(navBar({ back: T('studioSettings') }), large(T('studioWizT')), h('p', 'st-lede', T('studioWizLede')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const link = (href, k, label) => {
    const a = h('a', 'st-wbtn'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.dataset.k = k;
    a.append(ico('out'), h('span', null, label));
    return a;
  };
  let host = 'ibkr-proxy-wine.vercel.app';
  try { host = new URL(proxyBase()).host || host; } catch (e) {}
  const hosts = [host].concat(HOSTS_EXTRA).join('\n');
  const w = ui.wiz;
  const urlIn = h('input', 'st-in'); urlIn.type = 'url'; urlIn.inputMode = 'url'; urlIn.dir = 'ltr'; urlIn.autocomplete = 'off'; urlIn.spellcheck = false;
  urlIn.placeholder = 'https://api.anthropic.com/v1/claude_code/routines/trig_…/fire'; urlIn.value = w.url; urlIn.dataset.k = 'w:url';
  urlIn.setAttribute('aria-label', T('studioFUrl'));
  urlIn.addEventListener('input', () => { w.url = urlIn.value; });
  const keyIn = h('input', 'st-in'); keyIn.type = 'password'; keyIn.dir = 'ltr'; keyIn.autocomplete = 'off'; keyIn.spellcheck = false;
  keyIn.placeholder = 'sk-ant-oat01-…'; keyIn.value = w.key; keyIn.dataset.k = 'w:key';
  keyIn.setAttribute('aria-label', T('studioFKey'));
  keyIn.addEventListener('input', () => { w.key = keyIn.value; });
  const lab = (txt, inp) => { const l = h('label', 'st-flab'); l.append(h('span', null, txt), inp); return l; };
  const saveB = btn('st-btn wide in-card', w.busy ? T('studioSaving') : T('studioSaveTest'), () => saveConn(), 'w:save');
  saveB.disabled = w.busy || blocked();
  const errEl = w.err ? h('p', 'st-ferr', w.err) : null;
  /* v356: כל פעולה בשורה משלה, והכפתור שלה מיד אחריה — בסדר שבו מבצעים ב־claude.ai.
     הטריגר API נבחר לפני Create (בלעדיו הכפתור אפור), והכתובת והמפתח — שלב נפרד אחרי השמירה. */
  const steps = [
    [T('studioW1T'), [T('studioW1a'), link('https://claude.ai/code', 'w:open', T('studioOpenCode')),
      T('studioW1b'), copyBox(hosts, T('studioCopyHosts'), 'w:hosts'),
      T('studioW1c'), copyBox(SETUP_LINE, T('studioCopySetup'), 'w:setup')]],
    [T('studioW2T'), [T('studioW2a'), link('https://claude.ai/code/routines', 'w:routines', T('studioOpenRoutines')),
      T('studioW2b'), copyBox(T('studioPromptText'), T('studioCopyPrompt'), 'w:prompt', true),
      T('studioW2c')]],
    [T('studioW3T'), [T('studioW3a'), T('studioW3b')]],
    [T('studioW4T'), [T('studioW4D'), lab(T('studioFUrl'), urlIn), lab(T('studioFKey'), keyIn), errEl, saveB, testLine()]],
  ];
  const ol = h('ol', 'st-wiz');
  for (const [tt, items] of steps) {
    const li = h('li');
    const body = h('div', 'st-wbody');
    body.append(h('b', null, tt));
    let grp = null;                  // הכפתורים שאחרי שורה — בקבוצה אחת מתחתיה
    for (const it of items) {
      if (!it) continue;
      if (typeof it === 'string') { body.append(bidiP(it)); grp = null; continue; }
      if (!grp) { grp = h('div', 'st-wacts'); body.append(grp); }
      grp.append(it);
    }
    li.append(body); ol.append(li);
  }
  p.append(ol, note(T('studioWizNote')));
}
async function saveConn() {
  const w = ui.wiz;
  if (w.busy) return;
  const url = String(w.url || '').trim(), key = String(w.key || '').trim().replace(/^Bearer\s+/i, '');
  if (!ROUTINE_URL_RE.test(url)) { w.err = T('studioErrBadUrl'); render('none'); return; }
  if (!ROUTINE_KEY_RE.test(key)) { w.err = T('studioErrBadKey'); render('none'); return; }
  w.busy = true; w.err = ''; render('none');
  const j = await net.api('connect', { url, key });
  w.busy = false;
  if (!j.ok) { w.err = errText(j.error); render('none'); return; }
  w.key = '';                      // המפתח בשרתון (מוצפן) — לא נשאר בטלפון
  store.conn = j.conn ? { hint: String(j.conn.hint || ''), ok: 0, since: num(j.conn.since) } : null;
  save();
  render('none');
  runTest();
}

/* ---------------- ציור ---------------- */
let renderSeq = 0;
let lastShape = '';
/* "צורת" הדף — כשהיא משתנה (שלב חדש, העלאה הסתיימה, שגיאה) בונים את הדף מחדש; אחרת רק מעדכנים במקום */
function shapeKey() {
  const one = (rec) => { const run = runs.get(rec.id); return rec.id + ':' + jobPhase(rec, run) + ':' + modelFor(rec).stages.map((s) => s.state[0]).join('') + ':' + (rec.up.v.done ? 1 : 0) + (rec.up.wait || '') + (rec.srv && rec.srv.use ? 'u' : '') + (rec.srv && rec.srv.qa ? rec.srv.qa.id + (rec.srv.qa.a ? 'a' : '') : '') + (rec.srv && rec.srv.ck ? rec.srv.ck.s : '') + (ui.resuming === rec.id ? 'r' : '') + (rec.srv && rec.srv.tw ? rec.srv.tw.lv + rec.srv.tw.x : ''); };
  if (ui.view === 'job') { const r = jobRec(ui.param); return 'job|' + (r ? one(r) : '') + '|' + ui.access + '|' + ui.kinds.join() + (r && towerStopped(r) && ui.fb ? '|' + ui.fb.filter((e) => e.fix).map((e) => e.fp).join() : ''); }
  if (ui.view === 'home') return 'home|' + store.jobs.map(one).join(',') + '|' + store.drafts.length + '|' + ui.access + '|' + (store.conn ? 1 : 0);
  if (ui.view === 'tower') return 'tower|' + store.jobs.map(one).join(',') + '|' + ui.access + '|' + JSON.stringify(ui.norm) + JSON.stringify(ui.fb) + JSON.stringify(ui.ops);
  if (ui.view === 'server') return 'server|' + ui.access + '|' + JSON.stringify(ui.api) + JSON.stringify(ui.servers) + ui.srvQueue + '|' + (ui.newToken ? 1 : 0) + ui.srvBusy;
  if (ui.view === 'settings' || ui.view === 'connect') return ui.view + '|' + (testRun ? testRun.st + (testRun.claimed ? 'c' : '') : '') + '|' + ui.access + '|' + JSON.stringify(store.conn) + JSON.stringify(store.drive) + ui.driveBusy + store.settings.conn + store.settings.cap + JSON.stringify(ui.api);
  return ui.view + '|' + ui.access;
}
let paintT = 0;
function paintSoon() { if (!paintT) paintT = setTimeout(() => { paintT = 0; livePaint(); }, 250); }
function livePaint() {
  if (!root) return;
  if (shapeKey() !== lastShape) { render('none'); return; }
  for (const el of root.querySelectorAll('[data-live]')) { try { if (el._live) el._live(el); } catch (e) {} }
}
const repaint = () => { if (root) livePaint(); };
function render(kind, still) {     // kind: none (ציור מחדש במקום) / push / pop; still = בלי אנימציה (Chrome כבר הנפיש)
  if (!root) return;
  const seq = ++renderSeq;
  const keepY = kind === 'none' ? root.scrollTop : (kind === 'pop' ? (scrolls[viewKey()] || 0) : 0);
  const ae = document.activeElement;
  const fk = ae && root.contains(ae) && ae.dataset ? ae.dataset.k : null;   // הפוקוס חוזר לאותו רכיב אחרי ציור מחדש
  if (ui.view === 'home') form = null;   // יציאה מהטופס בלי שמירה — הטיוטה לא נשמרת
  const p = h('div', 'st-page');
  if (ui.view === 'new') pageForm(p, false);
  else if (ui.view === 'edit') pageForm(p, true);
  else if (ui.view === 'lang') pageLang(p);
  else if (ui.view === 'project') pageProject(p);
  else if (ui.view === 'job') pageJob(p);
  else if (ui.view === 'settings') pageSettings(p);
  else if (ui.view === 'tower') pageTower(p);
  else if (ui.view === 'server') pageServer(p);
  else if (ui.view === 'def') pageDef(p);
  else if (ui.view === 'connect') pageConnect(p);
  else pageHome(p);
  if (!root || seq !== renderSeq) return;   // הדף חזר אחורה תוך כדי בנייה (טיוטה שנמחקה וכו') — הציור החדש כבר במקום
  if ((kind === 'push' || kind === 'pop') && !still && !reduceMotion()) p.classList.add(kind === 'push' ? 'in-push' : 'in-pop');
  root.replaceChildren(p);
  root.scrollTop = keepY;
  lastShape = shapeKey();
  if (kind === 'none' && fk) {
    const el = Array.from(root.querySelectorAll('[data-k]')).find((x) => x.dataset.k === fk);
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} }
  } else if (kind !== 'none' && document.activeElement === document.body) {
    try { root.focus({ preventScroll: true }); } catch (e) {}   // מעבר דף — הפוקוס עובר לשכבה ולא "נופל" לאפליקציה שמתחת
  }
  if (CW_OK && !cw) watch();             // מאזין "חזור" חסר (למשל אחרי רענון) — חוזר
  if (kind !== 'none') onEnter();
  schedulePoll();
}
const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/* נכנסים לדף: מרעננים ממה שבשרתון (מצב החיבור, העבודות) */
function onEnter() {
  if (ui.view === 'home') { refreshStatus(); refreshJobs(); }
  else if (ui.view === 'settings' || ui.view === 'connect') refreshStatus();
  else if (ui.view === 'tower') { refreshStatus(true); refreshJobs(true); }
  else if (ui.view === 'server') { refreshStatus(true); refreshServers(); }
  else if (ui.view === 'job') { pollNow(); const r = jobRec(ui.param); if (r && towerStopped(r)) refreshStatus(); }   // v364: תיקון מוכר בכרטיס העצירה
}
/* מעקב אחרי עבודה פתוחה: כל 4 שניות כש־Claude עובד, לאט כשמחכים, בכלל לא כשהסתיימה או כשהמסך כבוי */
let pollT = 0;
function schedulePoll() {
  clearTimeout(pollT); pollT = 0;
  if (!root || document.hidden) return;
  let ms = 0;
  if (ui.view === 'job') { const r = jobRec(ui.param), st = r && r.srv ? r.srv.state : 'new'; ms = st === 'queued' || st === 'running' ? 4000 : st === 'new' && r && r.up.started ? 15000 : 0; }
  else if (ui.view === 'home') ms = store.jobs.some((r) => r.srv && (r.srv.state === 'queued' || r.srv.state === 'running')) ? 15000 : 0;
  else if (ui.view === 'server' && ui.api && ui.api.admin) ms = 15000;   // מסך השרת: הדופק מתעדכן כל 15 שנ׳
  if (ms) pollT = setTimeout(pollNow, ms);
}
let polling = false;
async function pollNow() {
  if (polling || !root) return;
  polling = true;
  try {
    if (ui.view === 'job' && JOB_RE.test(String(ui.param || ''))) {
      const id = ui.param, j = await net.api('job', { job: id });
      const r = jobRec(id);
      if (j.ok && j.job && r) { r.srv = normJob({ id, srv: j.job }).srv; save(); }
    } else if (ui.view === 'home') await refreshJobs(true);
    else if (ui.view === 'server') await refreshServers();
  } finally { polling = false; repaint(); schedulePoll(); }
}

/* ---------------- כניסה / יציאה ---------------- */
function ensureCss() {
  if (document.getElementById('studioCss')) return;
  const l = document.createElement('link'); l.id = 'studioCss'; l.rel = 'stylesheet'; l.href = 'studio.css';
  document.head.appendChild(l);
}
function closeStudio(instant) {
  const r = root; root = null; form = null; stack = [];
  clearTimeout(pollT); pollT = 0;
  ui.wiz = { url: '', key: '', busy: false, err: '' };   // ההעלאה ממשיכה ברקע; מה שהודבק באשף — לא נשאר
  try { if (cw) cw.destroy(); } catch (e) {}
  cw = null;
  document.documentElement.classList.remove('studio-open');
  if (!r) return;
  if (instant || reduceMotion()) { r.remove(); return; }   // Chrome כבר הנפיש את היציאה — בלי אנימציה שנייה
  r.classList.add('leaving');
  setTimeout(() => r.remove(), 260);
}
export function openStudio(opt) {
  ensureCss();
  if (root) return;
  const restore = opt && opt.restore && opt.restore.studio ? opt.restore : null;   // רענון בזמן שהסטודיו היה פתוח
  store = load();
  root = h('div', 'st-root no-swipe');
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', T('studioTitle'));
  root.tabIndex = -1;
  root.addEventListener('pointerup', () => { if (CW_OK && root && !cw) watch(); }, true);   // נגיעה = הפעלת משתמש → מאזין חדש אם חסר
  if (!CW_OK && !window._stKey) {          // עם CloseWatcher גם Escape הוא בקשת סגירה — בלי מאזין משלנו
    window._stKey = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !root || e.defaultPrevented) return;
      if (document.querySelector('.dlg-veil')) return;   // חלון אישור של האפליקציה פתוח — הוא סוגר את עצמו
      e.preventDefault(); back();
    });
  }
  if (!window._stVis) {                    // חזרה לאפליקציה: מסך דולק שוב (אם מעלים) ומעקב מחדש
    window._stVis = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { if (wlWant) wakeOn(); if (root) pollNow(); }
      else { clearTimeout(pollT); pollT = 0; }
    });
  }
  document.body.append(root);
  document.documentElement.classList.add('studio-open');
  if (!restore) afterBack(() => { try { history.pushState(cleanState({ studio: 1, sv: 'home', sp: null }), ''); } catch (e) {} });
  if (!window._stPop) { window._stPop = true; window.addEventListener('popstate', onPop); }
  if (CW_OK) {
    stack = restore ? chainFor(restore.sv || 'home', restore.sp == null ? null : restore.sp) : [{ v: 'home', p: null }];
    const top = stack[stack.length - 1];
    ui.view = top.v; ui.param = top.p;
    if (restore) syncState();
    watch();                               // בתוך הלחיצה (הפעלת משתמש); ברענון — המאזין ה"חינמי"
  } else {
    ui.view = restore ? (restore.sv || 'home') : 'home';
    ui.param = restore && restore.sp != null ? restore.sp : null;
  }
  if (restore) root.classList.add('restored');
  render('none');
  if (restore) curtainDown();
  try { root.focus({ preventScroll: true }); } catch (e) {}
  refreshStatus(true); refreshJobs(true);
  // העלאות שנקטעו (רענון): ממשיכים לבד כשיש ידית לקובץ עם הרשאה; אחרת המסך מבקש לבחור שוב
  for (const rec of store.jobs) {
    const done = rec.up.v.done && (rec.up.a.done || rec.up.noAudio);
    const st = rec.srv ? rec.srv.state : 'new';
    if (!done && !FINAL.includes(st) && !(runs.get(rec.id) && runs.get(rec.id).active) && rec.fp) resumeJob(rec.id, false);
  }
}

export const _test = {
  state: () => ({ open: !!root, view: ui.view, param: ui.param, drafts: store.drafts.length, jobs: store.jobs.length, form: !!form, cw: CW_OK, watching: !!cw, stack: stack.length,
    access: ui.access, conn: !!store.conn, test: testRun ? testRun.st : '', runs: [...runs.entries()].map(([id, r]) => ({ id, phase: r.phase, active: r.active, wait: r.wait, err: r.err, p: r.p })) }),
  closeRequest: () => closeRequest(),   // QA: כמו "חזור" של אנדרואיד (Playwright לא יכול לשלוח אותו)
};
