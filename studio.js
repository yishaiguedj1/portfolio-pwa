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
import { createNet, probeVideo, extractAudio, stageEstimates, progressModel, planFrom, Q_DEF, glClean, glUpsert, GL_MAX } from './studionet.js';
import { createBackup, waitOAuthCode } from './libbackup.js';

const T = (k, v) => (typeof t === 'function' ? t(k, v) : k);
export const LS_STUDIO = 'pwa_studio_v1';

/* מצבי התרגום — המספרים מהמבחן מול המתרגם האנושי של TED (נספח ה׳ בתוכנית). q = איכות, u = שימוש במנוי (מתוך 5,
   לפי הצפוי לשעה — NORM_DEF בשרתון), min = הערכת זמן לשעת ראיון בדקות.
   10/10/2026 (בקשת המשתמש): Sonnet 5.5 · Medium = המומלץ וברירת המחדל; נוסף Haiku 5.5 (Medium/High — עוד לא נבדק במבחן,
   לכן q = 1 עד שיימדד); Opus High/Max הוסרו — הגבוה ביותר: Opus Medium */
export const MODES = [
  { id: 'opus-medium', fam: 'opus', effort: 'Medium', q: 4, u: 5, min: 105 },
  { id: 'sonnet-medium', fam: 'sonnet', effort: 'Medium', q: 2, u: 3, min: 85, rec: true },
  { id: 'sonnet-high', fam: 'sonnet', effort: 'High', q: 3, u: 4, min: 95 },
  // Haiku: min מהמדידות — זמן קבוע (תמלול, יישור, צריבה ‎~52 דק׳ לשעה) + חלק ה־LLM (Opus ‎~53) × המהירות היחסית
  { id: 'haiku-medium', fam: 'haiku', effort: 'Medium', q: 1, u: 1, min: 70 },
  { id: 'haiku-high', fam: 'haiku', effort: 'High', q: 1, u: 1, min: 76 },
];
export const DEFAULT_MODE = 'sonnet-medium';
// מצבים שהוסרו → המצב הקיים הקרוב (= LEGACY_MODES בשרתון ובעובד): עבודה / טיוטה / חוק ישנים ממשיכים לעבוד
export const LEGACY_MODES = { 'opus-high': 'opus-medium', 'opus-max': 'opus-medium' };
export const modeNow = (id) => (MODES.some((m) => m.id === id) ? id : LEGACY_MODES[id] || DEFAULT_MODE);
const REC_MODE = MODES.find((m) => m.rec);
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
  return { mode: DEFAULT_MODE, to: ['he'], out: { same: true, compact: false, mkv: false }, style: 'bold', conn: 'sub', wifi: false, cap: 10, mv: 2 };
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
  if (typeof o.mode === 'string' && o.mode) s.mode = modeNow(o.mode);
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
    hb: x.hb && typeof x.hb === 'object' ? { v: /^[0-9a-f]{7,12}$|^dev$/.test(String(x.hb.v || '')) ? x.hb.v : '', disk: n(x.hb.disk), mem: n(x.hb.mem), free: n(x.hb.free),
      iso: x.hb.iso === 'g' || x.hb.iso === 'r' ? x.hb.iso : '', iw: ['mem', 'missing', 'selftest', 'manual'].includes(x.hb.iw) ? x.hb.iw : '',
      al: x.hb.al === 'o' || x.hb.al === 't' ? x.hb.al : '' } : null,
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
    mode: modeNow(sp.mode),
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
    rw: num(s.rec),        // v368: תקלה חולפת — ממשיכה לבד מהרגע הזה (0 = לא)
    fr: s.fr && typeof s.fr.s === 'number' && s.fr.s >= -1 && s.fr.s < 600 ? { s: s.fr.s, ms: num(s.fr.ms) } : null,   // v369: תוצאת ההפעלה האחרונה
    tr: normTrace(s.tr),   // v373: עקיבה
    q: normQuality(s.q), ij: normInj(s.ij),   // v374: מדד האיכות ושומר ההזרקות
    jd: normJudge(s.jd),                      // v375: שופט האיכות
    gl: normGl(s.gl),                         // v380: זיכרון המונחים
    sla: normSla(s.sla),                      // v377: יעדי זמן ותקציב
    ep: normEp(s.ep),                         // 10/10/2026: צפי הזמנים של העבודה (מהשרתון, נקבע בלקיחה)
  } : null;
  return { id: j.id, created: num(j.created), spec, up, fp, srv };
}
/* שלב 3 סבב ד׳: שאלה מ־Claude באמצע העבודה — אותה בדיקה כמו בשרתון (lib/studio.js normAsk). הטקסט מוצג רק כטקסט */
export function normQa(q) {
  if (!q || typeof q !== 'object') return null;
  // v367: שער (g) — השאלה נבנית בטלפון מהקטלוג (בלי טקסט מ־Claude): b = הגענו לתקציב, r = לפני הצריבה
  const g = q.g === 'b' || q.g === 'r' ? q.g : '';
  if (!(g ? /^g[a-z0-9]{1,12}$/ : /^q[a-z0-9]{1,12}$/).test(String(q.id || '')) || (!g && (typeof q.q !== 'string' || !q.q))) return null;
  const o = (Array.isArray(q.o) ? q.o : []).filter((x) => typeof x === 'string' && x).slice(0, 4).map((x) => x.slice(0, 80));
  if (g && o.length !== 2) return null;
  const d = Number.isInteger(q.d) && q.d >= 0 && q.d < o.length ? q.d : -1;
  const a = q.a && typeof q.a === 'object' ? { i: Number.isInteger(q.a.i) ? q.a.i : -1, t: String(q.a.t || '').slice(0, 200), auto: q.a.auto === true } : null;
  const out = { id: q.id, q: g ? '' : q.q.slice(0, 300), o, d, w: num(q.w) || 480, at: num(q.at), a };
  if (g) {
    const n = q.n && typeof q.n === 'object' ? q.n : {};
    const usd = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e5 ? v : 0);
    out.g = g;
    out.n = g === 'b' ? { usd: usd(n.usd), cap: usd(n.cap) } : {
      cnt: Math.min(num(n.cnt), 1e5),
      cues: (Array.isArray(n.cues) ? n.cues : []).filter((c) => c && typeof c.x === 'string' && c.x).slice(0, 5)
        .map((c) => ({ t: /^\d{1,2}:\d{2}(?::\d{2})?$/.test(String(c.t || '')) ? c.t : '', x: c.x.slice(0, 140) })) };
  }
  return out;
}
/* v367: החוקים שלך (מהשרתון, op status) — אותה בדיקה כמו בשרתון (lib/studio.js normRules) */
export const RULE_BUDGETS = [5, 10, 20, 40];
export function normRules(r) {
  const o = r && typeof r === 'object' ? r : {};
  const b = typeof o.b === 'number' && Number.isFinite(o.b) && o.b >= 1 && o.b <= 500 ? o.b : 0;
  return { b, mx: MODES.some((m) => m.id === o.mx) ? o.mx : '', ab: o.ab === true, jx: o.jx === true };   // v375: jx = שופט האיכות כבוי
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
    .slice(0, 20).map((a) => ({ id: /^[0-9a-f]{12}$/.test(String(a.id || '')) ? a.id : a.c + a.k + (a.j || ''), c: a.c, k: a.k, s: a.s, j: JOB_RE.test(String(a.j || '')) ? a.j : '',
      n: num(a.n, 1, 1e6) || 1, f: num(a.f, 0, 1e15) || 0, l: num(a.l, 0, 1e15) || 0, rel: num(a.rel, 0, 100) || 0,
      fl: a.fl === 1, r: num(a.r, 0, 1e4) || 0, nj: num(a.nj, 1, 100) || 1, ps: num(a.ps, 0, 1e9) || 0, m: num(a.m, 0, 1e15) || 0,   // v368: מהבהבת, עבודות שנפגעו, ציון עדיפות, מושתקת עד
      // v369: רשומת התראה — מספר (ALR…), אושרה, ציר פעילות, והתראות נוספות של אותו רכיב באותה עבודה
      no: Number.isInteger(a.no) && a.no > 0 && a.no < 1e7 ? a.no : 0, ak: num(a.ak, 0, 1e15) || 0,
      h: (Array.isArray(a.h) ? a.h : []).filter((x) => Array.isArray(x) && typeof x[0] === 'number' && ['o', 'a', 'x', 'r', 'k', 'v'].includes(x[1])).slice(-10).map((x) => [x[0], x[1]]),
      sub: (Array.isArray(a.sub) ? a.sub : []).filter((x) => x && /^[a-z_]{2,12}$/.test(String(x.k || '')) && Number.isInteger(x.s)).slice(0, 10)
        .map((x) => ({ no: Number.isInteger(x.no) ? x.no : 0, k: x.k, s: Math.min(4, Math.max(1, x.s)), n: num(x.n, 1, 1e6) || 1, l: num(x.l, 0, 1e15) || 0 })) }));
  // v368: סיכום 24 שעות והשתקות בתוקף
  const kind = (x) => x && OPS_COMPONENTS.includes(x.c) && /^[a-z_]{2,12}$/.test(String(x.k || ''));
  const d = o.digest && typeof o.digest === 'object' ? o.digest : {};
  const digest = { hi: num(d.hi, 0, 1e4) || 0, lo: num(d.lo, 0, 1e4) || 0, top: (Array.isArray(d.top) ? d.top : []).filter(kind).slice(0, 5).map((x) => ({ c: x.c, k: x.k, n: num(x.n, 1, 1e6) || 1 })) };
  const mu = (Array.isArray(o.mu) ? o.mu : []).filter(kind).slice(0, 20).map((x) => ({ c: x.c, k: x.k, until: num(x.until, 0, 1e15) || 0 })).filter((x) => x.until);
  // v369: מגמה לשבוע — 7 נקודות לכל מדד (null = אין נתון באותו יום)
  const tr = o.trend && typeof o.trend === 'object' ? o.trend : {};
  const series = (a, hi) => (Array.isArray(a) ? a.slice(-7).map((v) => num(v, 0, hi)) : []);
  const trend = { score: series(tr.score, 100), avail: series(tr.avail, 100), mttr: series(tr.mttr, 1e6) };
  return { score: num(o.score, 0, 100) ?? 100, avail: num(o.avail, 0, 100) ?? 100, mttr: num(o.mttr, 0, 1e6), comp, open, digest, mu, trend };
}
/* v371: תקלות (מהשרתון — op jobs / status): לכל עבודה שנכשלה או נתקעה רשומה עם חומרה, מצב, מי טיפל, ציר, שורש סביר
   ו"קרה כבר"; ותקלה רחבה (mi). רק מספרים וקודים מהקטלוג — בלי טקסט חופשי */
const INC_ST = ['o', 'w', 'r', 'x'], INC_EV = ['o', 'f', 'w', 'c', 'r', 'x', 'm', 'a', 'k'], RC_T = ['known', 'wide', 'up', 'env', 'same', 'self'];
const ERR_CODE = /^[a-z][a-z0-9_]{1,29}$/;
export function normInc(o) {
  if (!o || typeof o !== 'object') return null;
  const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0);
  const kind = (c, k) => OPS_COMPONENTS.includes(c) && /^[a-z_]{2,12}$/.test(String(k || ''));
  const list = (Array.isArray(o.list) ? o.list : []).filter((x) => x && Number.isInteger(x.no) && x.no > 0 && JOB_RE.test(String(x.j || '')) && OPS_COMPONENTS.includes(x.c)
    && ERR_CODE.test(String(x.e || '')) && Number.isInteger(x.s) && x.s >= 1 && x.s <= 4 && INC_ST.includes(x.st)).slice(0, 20).map((x) => ({
    no: x.no, j: x.j, c: x.c, e: x.e, s: x.s, st: x.st, by: x.by === 'c' || x.by === 'u' ? x.by : '', f: num(x.f, 0, 1e15), l: num(x.l, 0, 1e15), rt: num(x.rt, 0, 1e15),
    n: num(x.n, 1, 1e4) || 1, m: Number.isInteger(x.m) && x.m > 0 ? x.m : 0, ev: x.ev === 1 ? 1 : 0,
    rc: (Array.isArray(x.rc) ? x.rc : []).filter((r) => r && RC_T.includes(r.t) && OPS_COMPONENTS.includes(r.c) && /^[a-z0-9_]{0,30}$/.test(String(r.k || ''))).slice(0, 3)
      .map((r) => ({ t: r.t, c: r.c, k: String(r.k || ''), p: num(r.p, 0, 100), n: num(r.n, 0, 100) })),
    tl: (Array.isArray(x.tl) ? x.tl : []).filter((e) => Array.isArray(e) && typeof e[0] === 'number' && INC_EV.includes(e[1]) && (e[1] !== 'a' && e[1] !== 'k' || kind(e[2], e[3]))).slice(-24)
      .map((e) => (e[1] === 'a' || e[1] === 'k' ? [e[0], e[1], e[2], e[3], Number.isInteger(e[4]) ? e[4] : 0] : [e[0], e[1]])),
    pir: normPir(x.pir),   // v379: דוח אחרי תקלה
    sim: x.sim && Number.isInteger(x.sim.no) ? { no: x.sim.no, f: num(x.sim.f, 0, 1e15), by: x.sim.by === 'c' || x.sim.by === 'u' ? x.sim.by : '', min: num(x.sim.min, 1, 1e6) || 1 } : null,
    al: (Array.isArray(x.al) ? x.al : []).filter((a) => a && Number.isInteger(a.no) && kind(a.c, a.k) && Number.isInteger(a.s)).slice(-8).map((a) => ({ no: a.no, c: a.c, k: a.k, s: Math.min(4, Math.max(1, a.s)), x: a.x ? 1 : 0 })),
  }));
  const m = o.mi;
  const mi = m && Number.isInteger(m.no) && OPS_COMPONENTS.includes(m.c) && ERR_CODE.test(String(m.e || '')) ? { no: m.no, c: m.c, e: m.e, at: num(m.at, 0, 1e15), x: num(m.x, 0, 1e15), n: num(m.n, 0, 100) } : null;
  return { list, open: num(o.open, 0, 1e4), mi };
}
/* v379: דוח אחרי תקלה (lib/studiopir.js pirView) — מספרים, מזהה מודל, והסיכום (טקסט מ־Claude: רק מחרוזת, מוצג כטקסט בלבד) */
const MODEL_ID_RE = /^claude-[a-z0-9-]{1,50}$/;
export function normPir(o) {
  if (!o || typeof o !== 'object') return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e9 ? v : 0);
  const out = { tti: n(o.tti), ttr: n(o.ttr), usd: n(o.usd), ps: null, wait: o.wait === true };
  const ps = o.ps;
  if (ps && typeof ps === 'object' && typeof ps.t === 'string' && ps.t.trim().length >= 20)
    out.ps = { t: ps.t.slice(0, 420), m: MODEL_ID_RE.test(String(ps.m || '')) ? ps.m : '', at: n(ps.at), v: ps.v === 1 || ps.v === -1 ? ps.v : 0 };
  return out;
}
export const majorOn = (inc) => !!(inc && inc.mi && !inc.mi.x);
/* v373: עקיבה (מהשרתון, בעבודה) ומלאי הסוכנים (op jobs) — רק מספרים, מזהי מודל וקודים */
const TR_KINDS = ['main', 'tl', 'rv', 'jg', 'sub'], TR_KEY = /^(?:(?:job|vt):[a-z][a-z_-]{1,19}|[A-Za-z]{1,24})$/;
export function normTrace(t) {
  if (!t || typeof t !== 'object' || !t.a || typeof t.a !== 'object') return null;
  const int = (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1e7 ? v : 0);
  const a = {};
  for (const k of TR_KINDS) if (t.a[k] && typeof t.a[k] === 'object') a[k] = { n: int(t.a[k].n), e: Math.min(int(t.a[k].e), int(t.a[k].n)), s: int(t.a[k].s) };
  if (!Object.keys(a).length) return null;
  const g = (Array.isArray(t.g) ? t.g : []).filter((x) => Array.isArray(x) && TR_KEY.test(String(x[0] || ''))).slice(0, 8).map((x) => [x[0], int(x[1]), Math.min(int(x[2]), int(x[1]))]);
  return { a, g };
}
/* v374: מדד האיכות של הכתוביות ושומר ההזרקות (מהשרתון, בעבודה) — מספרים וקודים בלבד */
const Q_KEYS = ['cps', 'len', 'lines', 'dur', 'en', 'chk'];
export function normQuality(q) {
  if (!q || typeof q !== 'object' || !Array.isArray(q.m)) return null;
  const int = (v, hi) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= hi ? v : null);
  const m = q.m.filter((x) => x && Q_KEYS.includes(x.k) && int(x.w, 100) != null && int(x.g, 100) != null && int(x.b, 1e6) != null && x.g <= x.w)
    .map((x) => ({ k: x.k, w: x.w, g: x.g, b: x.b }));
  const sc = int(q.s, 100), n = int(q.n, 1e6);
  return sc == null || !n || m.length !== Q_KEYS.length ? null : { s: sc, n, m };
}
export function normInj(o) {
  return o && Number.isInteger(o.n) && o.n > 0 && o.n < 1e5 ? { n: o.n, c: (Array.isArray(o.c) ? o.c : []).filter((x) => ['ign', 'role', 'tag', 'cmd', 'key'].includes(x)) } : null;
}
export const Q_PASS = 70;
/* v376: בעיות וספרי הפעלה (מהשרתון, op jobs) — אותה צורה כמו lib/studioprob.js. התיקון / ההצעה = טקסט מ־Claude: רק מחרוזת, מוצג כטקסט */
const PB_ST = ['n', 'd', 'w', 'f'], PB_WHY = ['cost', 'cap', 'loop', 'calls', 'idle'];
export function normPb(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.list)) return null;
  const n = (v, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, hi) : 0);
  const list = o.list.filter((x) => x && Number.isInteger(x.no) && x.no > 0 && /^[0-9a-f]{12}$/.test(String(x.fp || '')) && PB_ST.includes(x.state) && PB_WHY.includes(x.why))
    .slice(0, 30).map((x) => ({ no: x.no, fp: x.fp, why: x.why, st: ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'].includes(x.st) ? x.st : '', state: x.state,
      n: n(x.n, 1e4), auto: n(x.auto, 1e4), jobs: n(x.jobs, 1e4), usd: n(x.usd, 1e6), after: n(x.after, 99), at: n(x.at, 1e14), score: n(x.score, 1e8),
      fix: typeof x.fix === 'string' ? x.fix.slice(0, 160) : '', px: typeof x.px === 'string' ? x.px.slice(0, 160) : '',
      inc: (Array.isArray(x.inc) ? x.inc : []).filter((v) => Number.isInteger(v) && v > 0).slice(-8) }));
  return { list, open: list.filter((x) => x.state !== 'f').length };
}
export function normRb(a) {
  if (!Array.isArray(a)) return null;
  const out = a.filter((x) => x && ['net', 'known', 'cheap'].includes(x.k) && (x.r === 's' || x.r === 'c'))
    .map((x) => ({ k: x.k, r: x.r, n: Number.isInteger(x.n) && x.n >= 0 ? Math.min(x.n, 1e4) : 0 }));
  return out.length ? out : null;
}
/* v376: ספר ההפעלה "מצב זול יותר" — רק אחרי עצירה על עלות (תקציב / המגדל על עלות), ורק למצבים שעולים פחות (כמו בשרתון) */
export const costStop = (srv) => !!srv && (srv.err === 'budget_stop' || (srv.err === 'tower_stop' && !!srv.tw && (srv.tw.why === 'cost' || srv.tw.why === 'cap')));
export const cheaperModes = (id) => { const i = MODE_ORDER.indexOf(modeNow(id)); return i > 0 ? MODE_ORDER.slice(0, i).reverse() : []; };
/* v377: יעדי שירות — השעון של יעד הזמן והתקציב (מהשרתון: lib/studiosla.js slaView). לא תקין — בלי כרטיס */
const SLA_LV = ['ok', 'half', 'risk', 'over', 'met'];
export function normSla(o) {
  if (!o || typeof o !== 'object' || !o.t || typeof o.t !== 'object') return null;
  const num = (v, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= hi ? v : null);
  const tg = num(o.t.tg, 1e6), el = num(o.t.el, 1e7), f = num(o.t.f, 1e4);
  if (!tg || el == null || f == null || !SLA_LV.includes(o.t.lv)) return null;
  const out = { t: { tg, el, pz: num(o.t.pz, 1e7) || 0, f, lv: o.t.lv, paused: o.t.paused === true }, pf: num(o.pf, 1) || 0 };
  if (o.u && typeof o.u === 'object') {
    const ut = num(o.u.tg, 1e5), sp = num(o.u.sp, 1e5), uf = num(o.u.f, 1e4);
    if (ut && sp != null && uf != null && SLA_LV.includes(o.u.lv)) out.u = { tg: ut, sp, f: uf, lv: o.u.lv };
  }
  return out;
}
/* v377: ערך ועלות החודש, תחזית, צוואר בקבוק ומסלולים חריגים (lib/studiosla.js valueView) */
export function normValue(o) {
  if (!o || typeof o !== 'object' || !/^\d{4}-\d{2}$/.test(String(o.m || ''))) return null;
  const num = (v, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= -1e6 && v <= hi ? v : null);
  const int = (v) => (Number.isInteger(v) && v >= 0 && v <= 1e5 ? v : 0);
  const out = { m: o.m, n: int(o.n), min: Math.max(0, num(o.min, 1e6) || 0), usd: Math.max(0, num(o.usd, 1e6) || 0), cpm: num(o.cpm, 1e4),
    hp: num(o.hp, 100) || 5, hpd: o.hpd === true, saved: num(o.saved, 1e7), fc: num(o.fc, 1e6) };
  if (out.cpm != null && out.cpm < 0) out.cpm = null;
  if (out.fc != null && out.fc < 0) out.fc = null;
  const b = o.bn;
  if (b && STAGE_IDS.includes(b.s) && num(b.sh, 1) != null) out.bn = { s: b.s, sh: Math.max(0, b.sh), x: num(b.x, 1e3), n: int(b.n) };
  const a = o.ab || {};
  out.ab = { n: int(a.n), rs: int(a.rs), qa: int(a.qa) };
  return out;
}
/* v378: בדיקת המוכנות (lib/studioscan.js scanView) — צורה קבועה, בלי מזהים */
const SC_KINDS = ['claude_missing', 'claude_untested', 'claude_stale', 'drive_cfg', 'drive_missing', 'drive_revoked', 'drive_err', 'quota_crit', 'quota_low', 'fires_high', 'budget_low', 'orphans', 'dupes', 'ck', 'old'];
const SC_CHECKS = ['claude', 'drive', 'quota', 'fires', 'budget', 'orphans', 'dupes', 'ck', 'old'];
const SC_CLEAN = ['orphans', 'dupes', 'ck', 'old'];
export function normScan(o) {
  if (!o || typeof o !== 'object' || !(typeof o.at === 'number' && o.at > 0)) return null;
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1e15 ? v : 0);
  const f = (Array.isArray(o.f) ? o.f : []).filter((x) => x && SC_KINDS.includes(x.k) && Number.isInteger(x.p) && x.p >= 1 && x.p <= 5).slice(0, 20)
    .map((x) => ({ k: x.k, p: x.p, ch: SC_CHECKS.includes(x.ch) ? x.ch : '', n: num(x.n), b: num(x.b), d: num(x.d), m: num(x.m), u: num(x.u), need: num(x.need) }));
  return { at: o.at, s: Math.max(0, Math.min(100, Math.round(num(o.s)))), n: Math.min(SC_CHECKS.length, Math.round(num(o.n))),
    ok: (Array.isArray(o.ok) ? o.ok : []).filter((k) => SC_CHECKS.includes(k)), f, fb: num(o.fb) };
}
const STAGE_IDS = ['tr', 'al', 'tl', 'rv', 'bn', 'sv'];
/* 10/10/2026: צפי הזמנים — תוכנית לעבודה (ep) ומודל לכל מנוע (status.eta). אותה צורה כמו lib/studioeta.js */
const ETA_KEYS = ['tr', 'al', 'tl', 'rv', 'bn', 'sv'];
const qOk = (q) => Array.isArray(q) && q.length === 3 && q.every((v) => typeof v === 'number' && v >= -3 && v <= 3);
export function normEp(o) {
  if (!o || typeof o !== 'object' || !o.s || typeof o.s !== 'object') return null;
  const s = {};
  for (const k of ETA_KEYS) { const v = o.s[k]; if (typeof v !== 'number' || !(v >= 0 && v <= 86400)) return null; s[k] = v; }
  return { s, q: qOk(o.q) ? o.q.slice() : Q_DEF.slice(), n: typeof o.n === 'number' && o.n >= 0 && o.n <= 1000 ? Math.round(o.n) : 0 };
}
export function normEta(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  for (const e of ['a', 'r']) {
    const m = o[e];
    if (!m || !m.st) continue;
    const st = {};
    let good = true;
    for (const k of ETA_KEYS) { const ab = m.st[k]; if (!Array.isArray(ab) || ab.length !== 2 || !ab.every((v) => typeof v === 'number' && v >= 0 && v <= 1e5)) good = false; else st[k] = ab.slice(); }
    if (good) out[e] = { st, q: qOk(m.q) ? m.q.slice() : Q_DEF.slice(), n: typeof m.n === 'number' && m.n >= 0 ? Math.round(m.n) : 0 };
  }
  return Object.keys(out).length ? out : null;
}

/* v380: זיכרון המונחים — u = מונחים מהמילון שלך שימשו, s = מונחים חדשים מהעבודה [[אנגלית, עברית]]. אותה בדיקה כמו בשרתון;
   הטקסט נכתב בסשן שמעבד תוכן לא מהימן — מוצג רק כטקסט, ונכנס למילון רק בלחיצה שלך */
export function normGl(o) {
  if (!o || typeof o !== 'object') return null;
  const u = Number.isInteger(o.u) && o.u >= 0 && o.u <= GL_MAX ? o.u : 0;
  const s = [], seen = new Set();
  for (const x of (Array.isArray(o.s) ? o.s : []).slice(0, 30)) {
    if (!Array.isArray(x)) continue;
    const en = glClean(x[0], 60), he = glClean(x[1], 80);
    if (!en || !he || seen.has(en.toLowerCase())) continue;
    seen.add(en.toLowerCase()); s.push([en, he]);
  }
  return u || s.length ? { u, s } : null;
}
/* v375: שופט האיכות (Haiku, על מדגם) — אותה בדיקה כמו בשרתון (lib/studio.js normJudge) */
const JG_CODES = ['mean', 'omit', 'add', 'gram', 'flu', 'term'];
export function normJudge(o) {
  if (!o || typeof o !== 'object') return null;
  const int = (v, lo, hi) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  const s = int(o.s, 0, 100), n = int(o.n, 1, 200), t = int(o.t, 1, 200), a = int(o.a, 1, 1e6);
  if (s == null || n == null || t == null || a == null || n > t || t > a) return null;
  const c = {};
  for (const k of JG_CODES) { const x = o.c && int(o.c[k], 1, 200); if (x) c[k] = x; }
  return { s, n, t, a, c };
}
export function normAgents(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.agents)) return null;
  const num = (v, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(hi, v)) : 0);
  const agents = o.agents.filter((x) => x && ['main', 'tl', 'rv', 'jg'].includes(x.k)).slice(0, 4).map((x) => ({
    k: x.k, m: /^claude-[a-z0-9-]{1,50}$/.test(String(x.m || '')) ? x.m : '', ef: ['low', 'medium', 'high', 'max'].includes(x.ef) ? x.ef : '',
    jobs: num(x.jobs, 1e4), usd: num(x.usd, 1e6), partial: x.partial === true, ok: typeof x.ok === 'number' ? num(x.ok, 100) : null,
    n: num(x.n, 1e8), e: num(x.e, 1e8), s: num(x.s, 1e9), pv: /^[0-9a-f]{8}$/.test(String(x.pv || '')) ? x.pv : '', pvs: num(x.pvs, 100), pvNew: x.pvNew === true, q: typeof x.q === 'number' ? num(x.q, 100) : null }));
  const ev = o.ev && /^[0-9a-f]{12}$/.test(String(o.ev.v || '')) ? { v: o.ev.v, n: num(o.ev.n, 1e3) } : null;
  return { jobs: num(o.jobs, 1e4), agents, ev };
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
/* v368: נכשלה בתקלה חולפת (Drive / רשת) — מחכה לחלון ההתאוששות ואז ממשיכה לבד, פעם אחת */
export function recovering(rec) {
  const s = rec && rec.srv;
  return !!(s && s.state === 'failed' && s.rw > 0);
}
/* יש שאלה פתוחה שמחכה לתשובה (והעבודה עוד רצה) */
export function qaPending(rec) {
  const s = rec && rec.srv;
  return !!(s && s.qa && !s.qa.a && (s.state === 'queued' || s.state === 'running'));
}
/* v359: טוקנים ועלות של עבודה — אותה בדיקה כמו בשרתון (lib/studio.js normUsage): עד 6 שורות, מודל claude-…, מספרים בלבד */
const USE_KINDS = ['main', 'tl', 'rv', 'jg', 'sub'];   // v375: jg = שופט האיכות
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
  return { settings: migrateSettings(src.settings), drafts, jobs, conn: c, drive: d };
}
/* 10/10/2026: ברירת המחדל עברה מ־Opus Medium ל־Sonnet Medium — הגדרות שנשמרו לפני כן (בלי mv) עם הברירה הישנה עוברות פעם אחת
   לחדשה. בחירה אחרת שנשמרה (Sonnet High וכו׳) נשארת */
export function migrateSettings(o) {
  const s = normSettings(o);
  if (o && typeof o === 'object' && o.mv !== 2 && (o.mode === 'opus-medium' || LEGACY_MODES[o.mode])) s.mode = DEFAULT_MODE;
  s.mv = 2;
  return s;
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
export function modeById(id) { const k = modeNow(id); return MODES.find((m) => m.id === k); }
const FAM_NAME = { opus: 'Opus', sonnet: 'Sonnet', haiku: 'Haiku' };
export function modeName(m) { return FAM_NAME[m.fam] + ' 5.5 · ' + m.effort; }
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
    case 'sonnet-high': return T('studioMsSonHigh');
    case 'haiku-high': return T('studioMsHaiHigh');
    case 'haiku-medium': return T('studioMsHaiMed');
    default: return T('studioMsSonMed');
  }
}
function effortSub(id) {
  switch (id) {
    case 'opus-medium': return T('studioEfOpusMed');
    case 'sonnet-high': return T('studioEfSonHigh');
    case 'haiku-high': return T('studioEfHaiHigh');
    case 'haiku-medium': return T('studioEfHaiMed');
    default: return T('studioEfSonMed');
  }
}
function modeSum(id) {
  switch (id) {
    case 'opus-medium': return T('studioSumOpusMed');
    case 'sonnet-high': return T('studioSumSonHigh');
    case 'haiku-high': return T('studioSumHaiHigh');
    case 'haiku-medium': return T('studioSumHaiMed');
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
const modeShort = (m) => FAM_NAME[m.fam] + ' ' + m.effort;   // לשורות צרות ("Opus Medium")
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
    case 'worker_oom': case 'worker_crash': return T('studioErrOom');
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
    case 'halted': return T('studioErrHalted');
    case 'rule_mode': return T('studioErrRuleMode');
    case 'major': return T('studioErrMajor');   // v371
    case 'mode': return T('studioErrMode');   // v376
    case 'budget_stop': return T('studioErrBudgetStop');
    default: return T('studioErrGeneric', { c: String(code || '?').slice(0, 30) });
  }
}

/* ---------------- מצב ואחסון ---------------- */
let root = null;
let store = normStore(null);
let form = null;                  // טופס פרויקט חדש/עריכה — בזיכרון בין הטופס לדף בחירת השפות; נמחק ביציאה לרשימה
const ui = { view: 'home', param: null, access: '', kinds: [], starting: false, driveBusy: false, wiz: { url: '', key: '', busy: false, err: '' }, norm: null, fb: null, ops: null, alAll: false, alTab: 'd', muPick: 0, inc: null, incAt: 0, incAll: false, incTab: 'd', ag: null,
  rl: normRules(null), halt: 0, api: null, servers: null, srvQueue: 0, newToken: '', srvBusy: false };   // v367: החוקים שלך ומתג החירום (מהשרתון) · מצב API: מסך השרת
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
    setInc(j.inc, j.now);   // v371: תקלות ותקלה רחבה
    ui.rl = normRules(j.rl);
    ui.halt = num(j.halt);
    ui.api = normApi(j.api) || ui.api;   // מצב API של המערכת: תקציב חודשי ושרתים
    ui.eta = normEta(j.eta) || ui.eta;   // 10/10/2026: מודל הצפי (לעבודות שעוד לא נלקחו)
    ui.sc = normScan(j.sc) || ui.sc;   // v378: בדיקת המוכנות האחרונה
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
  setInc(j.inc, j.now);   // v371: הרשימה מסנכרנת את התקלות בשרתון — העדכנית ביותר
  ui.ag = normAgents(j.ag) || ui.ag;   // v373: מלאי הסוכנים
  ui.pb = normPb(j.pb) || ui.pb; ui.rb = normRb(j.rb) || ui.rb;   // v376: בעיות וספרי הפעלה
  ui.va = normValue(j.va) || ui.va;   // v377: ערך, עלות ותחזית
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
  // v371: התקלה הרחבה עברה — עבודות שחיכו לה מתחילות לבד
  if (ui.inc && !majorOn(ui.inc)) for (const r of store.jobs.filter((x) => x.up.wait === 'major' && !x.up.started)) { r.up.wait = ''; tryStart(r.id); }
  repaint();
}
/* תשובה עדכנית יותר בלבד (status ו־jobs יכולים לחזור בסדר הפוך) */
function setInc(raw, at) {
  const t = num(at), v = normInc(raw);
  if (!v || (t && t < ui.incAt)) return;
  ui.inc = v; ui.incAt = t || Date.now();
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
async function resumeSrv(id, ov, mo, mode) {
  const rec = jobRec(id); if (!rec || ui.resuming) return;
  ui.resuming = id; render('none');
  const j = await net.api('resume', Object.assign({ job: id }, ov ? { ov: true } : {}, mo ? { mo: true } : {}, mode ? { mode } : {}));
  ui.resuming = '';
  if (j.job) rec.srv = normJob({ id, srv: j.job }).srv;
  if (j.ok && mode && j.job && j.job.spec && j.job.spec.mode === mode) rec.spec.mode = mode;   // v376: עברנו למצב הזול יותר
  // v367: מצב מעל המקסימום שבחוקים — הפעולה מחכה לאישור שלך
  if (!j.ok && j.error === 'rule_mode' && typeof askConfirm === 'function') askConfirm(T('studioRuleModeQ'), () => resumeSrv(id, true, mo, mode), { ok: T('studioStartAnyway') });
  else if (!j.ok && j.error === 'major' && typeof askConfirm === 'function') askConfirm(T('studioMajorQ', { c: opsComp(j.mi && j.mi.c) }), () => resumeSrv(id, ov, true, mode), { ok: T('studioStartAnyway') });   // v371
  else if (!j.ok) flashSafe(errText(j.error, j));
  save(); render('none');
}
/* v368: "לא להמשיך לבד" — העבודה נשארת "נכשלה" ואפשר להמשיך ידנית מתי שרוצים */
async function stopRecover(id) {
  const rec = jobRec(id); if (!rec) return;
  const j = await net.api('cancel', { job: id });
  if (j.job) rec.srv = normJob({ id, srv: j.job }).srv;
  else if (!j.ok) flashSafe(errText(j.error, j));
  save(); render('none');
}
/* v368: השתקת סוג התראה — שעה / 4 שעות / יום (h = 0 מבטל). בשרתון: שייך לחשבון */
let muteBusy = false;
async function muteKind(c, k, hrs) {
  if (muteBusy) return;
  muteBusy = true;
  try {
    const j = await net.api('mute', { c, k, h: hrs });
    const o = j.ok && normOps(j.ops);
    if (o) { ui.ops = o; save(); }
    flashSafe(!j.ok ? errText(j.error) : hrs ? T('studioMutedOk', { t: fmtClock(Date.now() + hrs * 3600e3) }) : T('studioUnmutedOk'));
  } finally { muteBusy = false; render('none'); }
}
/* "התחלה": השרתון מפעיל את ה־Routine. בשלב 2 העובד יודע רק "בדיקת חיבור" — התשובה worker_not_ready והעבודה ממתינה */
async function tryStart(id, ov, mo) {
  const rec = jobRec(id); if (!rec || rec.up.started) return;
  // v367: ov = "להתחיל בכל זאת" (מצב מעל המקסימום) · v371: mo = להתחיל למרות תקלה רחבה
  const j = await net.api('start', Object.assign({ job: id }, ov ? { ov: true } : {}, mo ? { mo: true } : {}));
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
/* v368: חלון חסימה לעדכון — גרסה חדשה של האפליקציה לא מרעננת את הדף באמצע העלאה (app.js שואל לפני הרענון) */
if (typeof window !== 'undefined') window.snbStudioBusy = () => Array.from(runs.values()).some((r) => r && r.active);
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
  const parent = (x, y) => (x === 'home' ? null : (x === 'connect' || x === 'def' || x === 'lang' || x === 'tower') ? ['settings', null] : x === 'gloss' ? ['rules', null] : x === 'rules' || x === 'alert' || x === 'inc' || x === 'agents' || x === 'server' || x === 'prob' || x === 'value' || x === 'scan' ? ['tower', null] : x === 'edit' ? ['project', y] : ['home', null]);
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
  power: '<path d="M17.7 7a8 8 0 1 1-11.4 0"/><path d="M12 3.5v8"/>',
  sliders: '<path d="M5 20v-6M5 10V4M12 20v-8M12 8V4M19 20v-4M19 12V4M2.5 14h5M9.5 8h5M16.5 16h5"/>',  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',   // v377: ערך ועלות
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
/* שורה שהיא קישור החוצה (Drive) — כמו rowNav, בלשונית חדשה */
function rowExt(o) {
  const a = h('a', 'st-row' + (o.tile ? ' st-ric' : '')); a.href = o.href; a.target = '_blank'; a.rel = 'noopener noreferrer';
  if (o.k) a.dataset.k = o.k;
  if (o.tile) a.append(o.tile);
  a.append(rowTxt(o.label, o.sub), ico('out', 'st-chev'));
  return a;
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
/* עבודה שנעצרה: השורה האחרונה שהעובד כתב ("vt align נכשל — נגמר הזיכרון") — הסיבה המדויקת,
   שהקוד הכללי (errText) לא אומר. טקסט מהעובד = טקסט בלבד (לא HTML), בכיוון שלו. */
function workerMsg(rec, ph) {
  const m = rec && rec.srv && rec.srv.prog && rec.srv.prog.msg;
  return (ph === 'failed' || ph === 'stuck' || ph === 'cancelled') && typeof m === 'string' && m.trim() ? m.trim().slice(0, 240) : '';
}
function workerMsgRow(rec, ph) {
  const m = workerMsg(rec, ph);
  if (!m) return null;
  const v = h('span'); v.dir = 'auto'; v.textContent = m;
  return kvRow(T('studioWorkerMsgL'), v, true);
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
  best.append(h('span', 'st-ribbon', m.rec ? T('studioRibbonRec') : T('studioRibbonSel', { name: modeShort(REC_MODE) })));
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
    const title = fam === 'opus' ? T('studioGrpPerf') : fam === 'sonnet' ? T('studioGrpEco') : T('studioGrpLite');
    gh.append(h('b', null, title), h('small', null, fam === 'opus' ? T('studioGrpPerfS') : fam === 'sonnet' ? T('studioGrpEcoS') : T('studioGrpLiteS')));
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
  // v367: מעל המצב המקסימלי שבחוקים שלך — לפני שמתחילים נשאל אותך
  const over = modeOverMax(m.id, ui.rl.mx) ? banner('warn', T('studioRlOverForm', { m: modeShort(modeById(ui.rl.mx)) })) : null;
  return [best, grp('opus'), grp('sonnet'), grp('haiku'), sum, over].filter(Boolean);
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
/* 10/10/2026: התוכנית של העבודה — מהשרתון (נקבעה בלקיחה), אחרת מהמודל הנלמד, אחרת הטבלה הישנה */
function planFor(rec) {
  if (rec.srv && rec.srv.ep) return rec.srv.ep;
  const eng = (rec.srv && rec.srv.eng) === 'api' || rec.spec.eng === 'api' ? 'a' : 'r';
  const md = ui.eta && ui.eta[eng];
  return (md && planFrom(md, modeById(rec.spec.mode).min, rec.spec.dur || 0)) || { s: stageEstimates(modeById(rec.spec.mode).min, rec.spec.dur || 0), q: Q_DEF, n: 0 };
}
function modelFor(rec) {
  const run = runs.get(rec.id);
  const pl = planFor(rec);
  const m = progressModel({ state: rec.srv ? rec.srv.state : 'new', prog: rec.srv && rec.srv.prog }, pl.s, upState(rec, run), Date.now(), pl.q);
  m.n = pl.n || 0;
  return m;
}
/* שעת הסיום שמוצגת (p80) — יציבה: יורדת מיד, עולה רק כשהפער גדול מדקה או מ־10% ממה שנשאר (מחקר הצפי, 10/10/2026) */
const etaEnd = new Map();
function shownEnd(id, leftSec) {
  const now = Date.now(), raw = now + leftSec * 1000, prev = etaEnd.get(id);
  if (!prev || raw < prev || raw - prev > Math.max(60e3, 0.1 * leftSec * 1000) || prev < now) { etaEnd.set(id, raw); return raw; }
  return prev;
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
  if (ph === 'failed' && recovering(rec)) {   // v368: תקלה חולפת — ספירה לאחור עד ההמשך האוטומטי
    const left = Math.round((rec.srv.rw - Date.now()) / 1000);
    return { pct: m.pct, big: left > 30 ? T('studioRecBig', { t: fmtLeft(left) }) : T('studioRecSoon'), sub: '' };
  }
  if (ph === 'failed' || ph === 'cancelled') return { pct: m.pct, big: ph === 'failed' ? T('studioBFailed') : T('studioBCancelled'), sub: '' };
  if (ph === 'stuck') return { pct: m.pct, big: T('studioStuckBig'), sub: '' };
  if (ph === 'ready') return { pct: 1, check: true, big: T('studioReadyBig'),
    sub: rec.up.wait === 'worker_not_ready' ? T('studioWaitWorkerS') : rec.up.wait === 'conn_missing' ? T('studioNeedConnS') : T('studioTotalEst', { t: fmtLeft(m.left80) }) };
  const u = uploadLeft(rec, run);
  // ההעלאה עצרה / מחכה — בלי "נשארו בערך": מה שנשאר תלוי בחזרה של הרשת או בבחירה מחדש
  if (ph === 'need' || ph === 'paused' || ph === 'error') return { pct: u.pct, big: T('studioUpStopBig'), sub: T('studioUpOf', { a: fmtSize(u.done), b: fmtSize(u.all) }) };
  if (ph === 'wait') return { pct: u.pct, big: T('studioUpWaitBig'), sub: T('studioUpOf', { a: fmtSize(u.done), b: fmtSize(u.all) }) };
  const parked = (!rec.srv || rec.srv.state === 'new') && !rec.up.started;
  if (parked) return { pct: u.pct, big: T('studioLeftBig', { t: fmtLeft(u.left) }), sub: T('studioUpLeftS') };
  // p80 (שמרני — להקדים ולא לאחר); לפני 8 עבודות שהמודל למד מהן — טווח p50–p90, כי עוד אין מספיק נתונים לשעה אחת
  const end = shownEnd(rec.id, m.left80), now = Date.now();
  const sub = m.n >= 8 || m.left90 - m.left < 120 ? T('studioReadyAt', { t: fmtClock(end) })
    : T('studioReadyRange', { a: fmtClock(now + m.left * 1000), b: fmtClock(now + m.left90 * 1000) });
  return { pct: m.pct, big: T('studioLeftBig', { t: fmtLeft(Math.max(0, (end - now) / 1000)) }), sub };
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
  if (ph === 'failed') return recovering(rec) ? T('studioRecLine') : errText(rec.srv && rec.srv.err);
  if (ph === 'stuck') return T('studioNowStuck');
  return rec.srv && rec.srv.err === 'halted' ? T('studioErrHalted') : T('studioNowCancelled');
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
  const hb = haltBanner(); if (hb) p.append(hb);   // v367: מתג החירום פעיל — כאן רואים למה עבודות לא מתחילות
  const mb = majorBanner(); if (mb) p.append(mb);   // v371: תקלה רחבה — במקום הבאנר של ההתראות (היא כבר אומרת את החשוב)
  const ub = mb ? null : urgentBanner(); if (ub) p.append(ub);   // v368: התראה דחופה (P1–P2) — מיד; הקלות — רק בסיכום במגדל
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
        const [c, l] = qaPending(rec) ? ['amber', T('studioBAsk')] : recovering(rec) ? ['amber', T('studioBRecover')] : badgeFor(ph);
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
    case 'claude:budget': return T('studioAlClaudeBudget');
    case 'claude:auto': return T('studioAlClaudeAuto');
    case 'claude:inject': return T('studioAlClaudeInject');
    case 'claude:sla_time': return T('studioAlSlaTime');   // v377
    case 'claude:sla_cost': return T('studioAlSlaCost');
    case 'server:down': return T('studioAlServerDown');   // ת7: הבדיקה המתוזמנת
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
/* v369: מגדל הפיקוח בעיצוב התוכנית — המבנה של ServiceNow (Horizon) עם המראה של הסטודיו.
   חומרה → צבע: 1 קריטי (אדום), 2 חמור (כתום), 3 קל (צהוב), 4 מידע (כחול) — הפס בצד, הגלולה והנקודות */
const SEV_CLS = ['', 'c', 'h', 'w', 'i'];
function sevName(s) {
  switch (s) {
    case 1: return T('studioSev1');
    case 2: return T('studioSev2');
    case 3: return T('studioSev3');
    default: return T('studioSev4');
  }
}
const alrNo = (no) => 'ALR' + String(no || 0).padStart(7, '0');
const pill = (cls, txt) => h('span', 'st-pill ' + cls, txt);
/* קו מגמה (SVG) — 7 נקודות, null מדולג */
function spark(vals) {
  const pts = vals.map((v, i) => [i, v]).filter((x) => x[1] != null);
  if (pts.length < 2) return null;
  const ys = pts.map((x) => x[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const X = (i) => (i / 6) * 100, Y = (v) => 19 - ((v - lo) / span) * 15;
  const d = pts.map((x, k) => (k ? 'L' : 'M') + X(x[0]).toFixed(1) + ' ' + Y(x[1]).toFixed(1)).join(' ');
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 22'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('class', 'st-spark'); svg.setAttribute('aria-hidden', 'true');
  const area = document.createElementNS(NS, 'path'); area.setAttribute('class', 'a');
  area.setAttribute('d', d + ' L' + X(pts[pts.length - 1][0]).toFixed(1) + ' 22 L' + X(pts[0][0]).toFixed(1) + ' 22Z');
  const line = document.createElementNS(NS, 'path'); line.setAttribute('class', 's'); line.setAttribute('d', d);
  svg.append(area, line);
  return svg;
}
/* אריח "ציון יחיד": תווית, ערך, שינוי מלפני שבוע (ירוק = לטובה) וקו מגמה */
function scoreTile(label, value, vals, betterUp, fmt) {
  const t = h('div', 'st-sc');
  t.append(h('small', null, label), h('b', null, value));
  const ok = vals.filter((v) => v != null);
  if (ok.length >= 2) {
    const dlt = ok[ok.length - 1] - ok[0];
    if (Math.abs(dlt) >= 0.05) {
      const good = betterUp ? dlt > 0 : dlt < 0;
      t.append(h('span', 'st-trd ' + (good ? 'up' : 'dn'), (dlt > 0 ? '▲ ' : '▼ ') + fmt(Math.abs(dlt))));
    }
  }
  const sv = spark(vals); if (sv) t.append(sv);
  return t;
}
function opsSection(o) {
  const out = [];
  const t = o.trend || { score: [], avail: [], mttr: [] };
  const fmt1 = (v) => (Math.round(v * 10) / 10).toLocaleString(uiLang() === 'en' ? 'en-US' : 'he-IL', { maximumFractionDigits: 1 });
  const sc = h('div', 'st-scores');
  sc.dataset.k = 'ops-scores';
  sc.append(scoreTile(T('studioTwScore'), String(Math.round(o.score)), t.score, true, (v) => String(Math.round(v))),
    scoreTile(T('studioTwAvail'), fmtPct1(o.avail), t.avail, true, fmt1),
    scoreTile(T('studioOpsMttr'), o.mttr == null ? '—' : fmtShort(o.mttr * 60), t.mttr, false, (v) => String(Math.round(v))));
  out.push(sc);
  // התראות פתוחות — לפי ציון העדיפות; ארבע ראשונות, "הכל" מרחיב
  const live = o.open.filter((a) => !a.m);
  if (live.length) {
    const head = h('div', 'st-sec-t st-sec-row');
    head.append(h('span', null, T('studioOpsOpenT')));
    if (live.length > 4) head.append(btn('st-linkb', ui.alAll ? T('studioTwLess') : T('studioTwAll', { n: live.length }), () => { ui.alAll = !ui.alAll; render('none'); }, 'al-all'));
    out.push(head, list(...(ui.alAll ? live : live.slice(0, 4)).map(alertRow)));
  }
  const also = o.digest.top.filter((x) => !live.some((a) => a.c === x.c && a.k === x.k));   // סוגים שהיו היום ונסגרו
  if (also.length) out.push(note(T('studioOpsDigestTop', { l: also.map((x) => opsAlert(x.c, x.k) + ' (' + x.n + ')').join(' · ') })));
  if (o.mu.length) {
    const det = h('details', 'st-details st-dig');
    if (ui.muOpen) det.open = true;
    det.addEventListener('toggle', () => { ui.muOpen = det.open; });
    det.append(h('summary', null, T('studioOpsMutedT', { n: o.mu.length })), list(...o.mu.map((m) => {
      const r = h('div', 'st-row st-ric st-muted');
      const l = h('span', 'st-l'); l.append(h('b', null, opsAlert(m.c, m.k)), h('small', null, T('studioMutedUntil', { t: fmtClock(m.until) })));
      r.append(h('i', 'st-sdot n'), l, btn('st-mini ghost', T('studioUnmute'), () => muteKind(m.c, m.k, 0), 'unmute:' + m.c + m.k));
      return r;
    })));
    out.push(det);
  }
  return out;
}
/* מפת השירות — לפי סדר השרשרת; רכיב עם התראה פתוחה מסומן בצבע החומרה */
function serviceMap(o) {
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
  return [secT(T('studioOpsMap')), map];
}
/* שורת התראה ברשימה: מספר וזמן, "רכיב · מה קרה", גלולת חומרה, ופרטים בשורה אחת. נגיעה → רשומת ההתראה */
function alertRow(a) {
  const rec = a.j ? jobRec(a.j) : null;
  const r = btn('st-alr ' + SEV_CLS[a.s], null, () => { ui.alTab = 'd'; ui.muPick = 0; go('alert', a.no); }, 'al:' + a.no);
  const tg = h('span', 'st-alr-t');
  const id = h('span'); id.append(h('bdi', null, alrNo(a.no)), ' · ', h('bdi', null, opsComp(a.c)));   // הרכיב כאן — בכותרת הוא כבר חלק מהשם
  tg.append(id, h('span', null, opsAgo(a.l)));
  const b = h('b', null, opsAlert(a.c, a.k));
  const sub = h('small');
  if (rec) sub.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')), ' · ');
  sub.append((a.n === 1 ? T('studioOpsEvent1') : T('studioOpsEvents', { n: a.n })) + (a.fl ? ' · ' + T('studioOpsFlap') : '') + (a.ak ? ' · ' + T('studioAlAcked') : ''));
  r.append(tg, b, pill(SEV_CLS[a.s], sevName(a.s)), sub);
  return r;
}
/* v368: התראות דחופות פתוחות (P1–P2, לא מושתקות; v369: ולא "אושרו") — לפי ציון העדיפות */
const urgentAlerts = () => (ui.ops ? ui.ops.open.filter((a) => a.s <= 2 && !a.m && !a.ak) : []);
function urgentBanner() {
  const u = urgentAlerts();
  if (!u.length) return null;
  const b = btn('st-banner warn st-halt st-urg', null, () => go('tower'), 'urgent-banner');
  const t = h('span', null, u.length === 1 ? T('studioUrgent1', { a: opsAlert(u[0].c, u[0].k) }) : T('studioUrgentN', { n: u.length }));
  b.append(ico('alert'), t, ico('chev', 'st-chev'));
  return b;
}
/* v369: רשומת התראה (מסך 2 בתוכנית) — כרטיס כותרת עם פס חומרה ותוויות, טאבים (פרטים · ציר · קשורות), ובתחתית השתקה ואישור */
function evName(e) {
  switch (e) {
    case 'o': return T('studioEvO');
    case 'a': return T('studioEvA');
    case 'x': return T('studioEvX');
    case 'r': return T('studioEvR');
    case 'v': return T('studioEvV');
    default: return T('studioEvK');
  }
}
function fireTxt(fr) {
  if (!fr) return '—';
  if (fr.s === -1) return T('studioAlFireCut');
  if (fr.s === 0) return T('studioAlFireNone');
  return ltr(String(fr.s)) + ' · ' + T('studioSecs', { n: (Math.round(fr.ms / 100) / 10).toLocaleString(uiLang() === 'en' ? 'en-US' : 'he-IL') });
}
let ackBusy = false;
async function ackAlert(no) {
  if (ackBusy) return;
  ackBusy = true; render('none');
  try {
    const j = await net.api('ack', { no });
    const o = j.ok && normOps(j.ops);
    if (o) { ui.ops = o; save(); }
    if (!j.ok) flashSafe(errText(j.error));
  } finally { ackBusy = false; render('none'); }
}
function pageAlert(p) {
  const no = Number(ui.param);
  const all = ui.ops ? ui.ops.open : [];
  const a = all.find((x) => x.no === no);
  p.append(navBar({ back: T('studioTwShort'), title: alrNo(no) }));
  if (!a) { p.append(h('div', 'st-empty st-empty-sm', T('studioAlGone'))); return; }
  const rec = a.j ? jobRec(a.j) : null;
  // כרטיס הכותרת
  const band = h('div', 'st-band ' + SEV_CLS[a.s]);
  band.append(h('small', null, T('studioAlKind', { c: opsComp(a.c) })), h('b', null, opsAlert(a.c, a.k)));
  const pills = h('div', 'st-pills');
  pills.append(pill(SEV_CLS[a.s] + ' pr', sevName(a.s)));
  if (a.fl) pills.append(pill('m', T('studioOpsFlap')));
  pills.append(pill('l', a.ak ? T('studioAlAcked') : T('studioAlOpen')));
  if (a.m) pills.append(pill('l', T('studioAlMuted')));
  band.append(pills);
  p.append(band);
  // טאבים
  const rel = a.sub.map((x) => ({ no: x.no, c: a.c, k: x.k, s: x.s, l: x.l, j: a.j }))
    .concat(all.filter((x) => x.no !== a.no && ((a.j && x.j === a.j) || x.c === a.c)).map((x) => ({ no: x.no, c: x.c, k: x.k, s: x.s, l: x.l, j: x.j })));
  const tab = ui.alTab || 'd';
  const seg = h('div', 'st-seg');
  seg.setAttribute('role', 'tablist');
  for (const [k, lbl] of [['d', T('studioAlTabD')], ['t', T('studioAlTabT', { n: a.h.length })], ['r', T('studioAlTabR', { n: rel.length })]]) {
    const b = btn('st-seg-b' + (tab === k ? ' on' : ''), lbl, () => { ui.alTab = k; render('none'); }, 'altab:' + k);
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', tab === k ? 'true' : 'false');
    seg.append(b);
  }
  p.append(seg);
  if (tab === 'd') {
    const kv = (k, v) => { const d = h('div'); d.append(h('small', null, k)); const sp = h('span'); sp.append(v); d.append(sp); return d; };
    const g = h('div', 'st-kvg');
    g.append(kv(T('studioAlComp'), h('bdi', null, opsComp(a.c))), kv(T('studioAlJobs'), String(a.nj)), kv(T('studioAlTimes'), String(a.n)),
      kv(T('studioAlScore'), h('bdi', null, Math.round(a.ps).toLocaleString(uiLang() === 'en' ? 'en-US' : 'he-IL'))), kv(T('studioAlOpened'), h('bdi', null, fmtClock(a.f || a.l))));
    if (a.c === 'routine' && rec && rec.srv) g.append(kv(T('studioAlFire'), fireTxt(rec.srv.fr)));   // v369: מה Anthropic ענה להפעלה
    const card = h('div', 'st-twcard'); card.append(g);
    p.append(card);
    if (a.fl) p.append(note(T('studioOpsFlapS', { n: a.r + 1 })));
    // תיקון מוכר מספר התיקונים (לעצירה של המגדל) — טקסט בלבד
    const fp = a.k === 'tw_stop' && rec && rec.srv && rec.srv.tw && rec.srv.tw.fp;
    const known = fp && ui.fb ? ui.fb.find((e) => e.fp === fp && e.fix) : null;
    if (known) {
      const kc = h('div', 'st-twcard st-kb');
      const fx = h('p', null, known.fix); fx.dir = 'auto';
      kc.append(h('small', null, T('studioFbKnown')), fx);
      p.append(kc);
    }
    if (rec) p.append(list(rowNav({ tile: tile('film', 'blue'), label: fileTitle(rec.spec.name) || T('studioUntitled'), sub: T('studioAlJob'), onClick: () => go('job', rec.id), k: 'al-job' })));
  } else if (tab === 't') {
    const tl = h('div', 'st-twcard st-tl');
    for (const [t, e] of a.h.slice().reverse()) {
      const ev = h('div', 'st-ev');
      const d = h('span', 'st-ev-d ' + (e === 'x' || e === 'k' ? 'g' : e === 'o' || e === 'r' ? SEV_CLS[a.s] : ''));
      if (e === 'x' || e === 'k') d.append(ico('check'));
      const x = h('span', 'st-l'); x.append(h('b', null, evName(e)), h('small', null, fmtClock(t)));
      ev.append(d, x);
      tl.append(ev);
    }
    p.append(tl);
  } else {
    p.append(rel.length ? list(...rel.map((x) => {
      const r = btn('st-row st-ric', null, () => { if (x.no) { ui.alTab = 'd'; go('alert', x.no); } }, 'alrel:' + x.no + x.k);
      r.append(h('i', 'st-sdot ' + (x.s <= 2 ? 'r' : x.s === 3 ? 'a' : 'n')), rowTxt(opsAlert(x.c, x.k), alrNo(x.no) + ' · ' + opsAgo(x.l)), pill(SEV_CLS[x.s], sevName(x.s)));
      return r;
    })) : h('div', 'st-empty st-empty-sm', T('studioAlNoRel')));
  }
  // פעולות: השתקה (שעה / 4 שעות / יום) ואישור
  const bar = h('div', 'st-abar');
  if (ui.muPick === a.no && !a.m) {
    const ch = h('div', 'st-mupick');
    for (const [hh, lbl] of [[1, T('studioMute1')], [4, T('studioMute4')], [24, T('studioMute24')]]) ch.append(btn('st-mini ghost', lbl, () => { ui.muPick = 0; muteKind(a.c, a.k, hh); }, 'al-m' + hh));
    bar.append(ch);
  }
  const row = h('div', 'st-abar-r');
  row.append(a.m ? btn('st-btn ghost', T('studioUnmute'), () => muteKind(a.c, a.k, 0), 'al-um')
    : btn('st-btn ghost', T('studioAlMute'), () => { ui.muPick = ui.muPick === a.no ? 0 : a.no; render('none'); }, 'al-mute'));
  const ack = btn('st-btn', a.ak ? T('studioAlAcked') : T('studioAlAck'), () => ackAlert(a.no), 'al-ack');
  ack.disabled = !!a.ak || ackBusy || blocked();
  row.append(ack);
  bar.append(row);
  p.append(bar);
}
/* ---------------- v371: תקלות (מסך 2 בתוכנית — Incident + Probable Root Cause + Major Incident) ---------------- */
const incNo = (no) => 'INC' + String(no || 0).padStart(7, '0');
const majNo = (no) => 'MAJ' + String(no || 0).padStart(7, '0');
/* כותרת קצרה לפי הקוד (errText הוא הוראה ארוכה — לא כותרת) */
function incTitle(e) {
  switch (e) {
    case 'no_claim': return T('studioIncNoClaim');
    case 'routine_auth': case 'routine_forbidden': case 'routine_missing': case 'routine_paused': return T('studioIncRoutine');
    case 'routine_rate': return T('studioIncRate');
    case 'no_server': case 'job_timeout': case 'worker_unknown_kind': case 'worker_oom': case 'worker_crash': return T('studioIncServer');
    case 'month_cap': return T('studioIncMonth');
    case 'tower_stop': return T('studioIncTower');
    case 'budget_stop': return T('studioIncBudget');
    case 'stale': return T('studioIncStale');
    case 'net': case 'drive': case 'drive_net': return T('studioIncNet');
    case 'upload_timeout': return T('studioIncUpload');
    case 'lang_unsupported': return T('studioIncLang');
    default: return /^routine_/.test(e) ? T('studioIncRDown') : T('studioIncWorker');
  }
}
function incStName(st) {
  switch (st) {
    case 'o': return T('studioIncStO');
    case 'w': return T('studioIncStW');
    case 'r': return T('studioIncStR');
    default: return T('studioIncStX');
  }
}
const incByName = (by) => (by === 'c' ? T('studioIncByC') : by === 'u' ? T('studioIncByU') : '');
function incEvName(e) {
  switch (e[1]) {
    case 'o': return T('studioIncEvO');
    case 'f': return T('studioIncEvF');
    case 'w': return T('studioIncEvW');
    case 'c': return T('studioIncEvC');
    case 'r': return T('studioIncEvR');
    case 'x': return T('studioIncEvX');
    case 'm': return T('studioIncEvM');
    case 'a': return T('studioIncEvA', { a: opsAlert(e[2], e[3]) });
    default: return T('studioIncEvK', { a: opsAlert(e[2], e[3]) });
  }
}
/* שורש סביר — משפט אחד לכל מועמד, מהקטלוג */
function rcText(r, x) {
  switch (r.t) {
    case 'known': return T('studioRcKnown');
    case 'wide': return T('studioRcWide', { n: r.n || 2 });
    case 'up': return T('studioRcUp', { a: opsAlert(r.c, r.k) });
    case 'same': return T('studioRcSame', { a: opsAlert(r.c, r.k) });
    case 'env': return T('studioRcEnv');
    default: return T('studioRcSelf', { t: incTitle(x.e) });
  }
}
const incStCls = (st) => (st === 'o' ? 'h' : st === 'w' ? 'i' : st === 'r' ? 'g' : 'l');
/* שורת תקלה: מספר · רכיב וזמן, הכותרת, גלולת מצב, והעבודה. compact = בדף העבודה (בלי שם העבודה) */
function incRow(x, compact) {
  const rec = jobRec(x.j);
  const r = btn('st-alr ' + SEV_CLS[x.s], null, () => { ui.incTab = 'd'; go('inc', x.no); }, 'inc:' + x.no);
  const tg = h('span', 'st-alr-t');
  const id = h('span'); id.append(h('bdi', null, incNo(x.no)), ' · ', h('bdi', null, sevName(x.s)));
  tg.append(id, h('span', null, opsAgo(x.st === 'r' || x.st === 'x' ? x.rt || x.l : x.f)));
  const sub = h('small');
  if (!compact && rec) sub.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')), ' · ');
  sub.append([x.by ? incByName(x.by) : '', x.m ? T('studioIncMajorTag') : '', x.ev ? T('studioIncEnvTag') : ''].filter(Boolean).join(' · ') || opsComp(x.c));
  r.append(tg, h('b', null, (compact ? T('studioIncRowT') + ' · ' : '') + incTitle(x.e)), pill(incStCls(x.st), incStName(x.st)), sub);
  return r;
}
/* תקלה רחבה — באנר אחד (בבית ובמגדל): מה נשבר, כמה עבודות, ושההפעלות מחכות. מהבית → המגדל (כמו באנר ההתראות); במגדל → התקלה */
function majorBanner(inTower) {
  if (!majorOn(ui.inc)) return null;
  const mi = ui.inc.mi;
  const first = ui.inc.list.find((x) => x.m === mi.no && (x.st === 'o' || x.st === 'w'));
  const b = btn('st-banner warn st-halt st-urg st-major', null, () => (inTower && first ? (ui.incTab = 'd', go('inc', first.no)) : go('tower')), inTower ? 'major-banner-t' : 'major-banner');
  const t = h('span', 'st-l');
  t.append(h('b', null, T('studioMajorT', { c: opsComp(mi.c) })), h('small', null, T('studioMajorS', { n: mi.n || 2 })));
  b.append(ico('alert'), t, ico('chev', 'st-chev'));
  return b;
}
/* מקטע "תקלות" במגדל: פתוחות ובטיפול קודם, ואז שנסגרו לאחרונה; ארבע ראשונות, "הכל" מרחיב */
function incSection() {
  const L = ui.inc ? ui.inc.list : [];
  if (!L.length) return [];
  const head = h('div', 'st-sec-t st-sec-row');
  head.append(h('span', null, ui.inc.open ? T('studioIncSecN', { n: ui.inc.open }) : T('studioIncSec')));
  if (L.length > 4) head.append(btn('st-linkb', ui.incAll ? T('studioTwLess') : T('studioTwAll', { n: L.length }), () => { ui.incAll = !ui.incAll; render('none'); }, 'inc-all'));
  return [head, list(...(ui.incAll ? L : L.slice(0, 4)).map((x) => incRow(x)))];
}
function incSummary(x) {
  const top = x.rc[0];
  if (x.st === 'o') return T('studioIncSumO', { t: opsAgo(x.f), r: top ? rcText(top, x) : incTitle(x.e) });
  if (x.st === 'w') return T('studioIncSumW', { by: incByName(x.by) || T('studioIncByU') });
  if (x.st === 'r') return T('studioIncSumR', { d: fmtShort(Math.max(60, (x.rt - x.f) / 1000)), by: incByName(x.by) || T('studioIncByU') });
  return T('studioIncSumX');
}
/* v379: דוח אחרי תקלה — כמו ה־Major Incident Workbench: זמן לזיהוי, זמן לתיקון, מה עלה בטעות, וסיכום AI אחד עם הסימן והאזהרה */
let pirBusy = false;
async function pirVote(no, v) {
  if (pirBusy) return;
  pirBusy = true; render('none');
  try {
    const j = await net.api('pirVote', { no, v });
    if (j.ok) setInc(j.inc, j.now); else flashSafe(errText(j.error));
  } finally { pirBusy = false; render('none'); }
}
function pirSection(x) {
  const r = x.pir;
  if (!r) return [];
  const kpi = h('div', 'st-scores'); kpi.dataset.k = 'pir-kpi';
  kpi.append(scoreTile(T('studioPirTti'), r.tti ? fmtShort(r.tti) : T('studioPirNow'), [], false, String),
    scoreTile(T('studioPirFails'), String(x.n), [], false, String), scoreTile(T('studioPirUsd'), fmtUsd(r.usd), [], false, String));   // זמן התיקון — כבר בשורה שבראש הדף
  const out = [secT(T('studioPirT')), kpi];
  const card = h('div', 'st-twcard st-ai'); card.dataset.k = 'pir-sum';
  if (r.ps) {
    const hd = h('small', 'st-ai-h'); const mk = h('i', 'st-ai-m'); mk.append(ico('spark'));
    hd.append(mk, h('span', null, T('studioPirBy', { m: r.ps.m ? modelLabel(r.ps.m) : 'Claude' })));
    const t = h('p', null, r.ps.t); t.dir = 'auto';   // טקסט מ־Claude — רק טקסט
    const ft = h('div', 'st-ai-f');
    ft.append(h('small', null, T('studioPirCheck')));
    const vb = h('span', 'st-ai-v');
    for (const [v, lbl, k] of [[1, '👍', 'pir-up'], [-1, '👎', 'pir-down']]) {
      const b = btn('st-ai-b' + (r.ps.v === v ? ' on' : ''), lbl, () => pirVote(x.no, r.ps.v === v ? 0 : v), k);
      b.setAttribute('aria-pressed', r.ps.v === v ? 'true' : 'false');
      b.setAttribute('aria-label', v === 1 ? T('studioPirUp') : T('studioPirDown'));
      if (pirBusy || blocked()) b.disabled = true;
      vb.append(b);
    }
    ft.append(vb);
    card.append(hd, t, ft);
  } else card.append(h('small', 'st-muted', r.wait ? T('studioPirWait') : T('studioPirNone')));
  out.push(card);
  return out;
}
function pageInc(p) {
  const no = Number(ui.param);
  const x = ui.inc ? ui.inc.list.find((y) => y.no === no) : null;
  p.append(navBar({ back: T('studioTwShort'), title: incNo(no) }));
  if (!x) { p.append(h('div', 'st-empty st-empty-sm', T('studioIncGone'))); return; }
  const rec = jobRec(x.j);
  const band = h('div', 'st-band ' + SEV_CLS[x.s]);
  band.append(h('small', null, T('studioIncKind', { c: opsComp(x.c) })), h('b', null, incTitle(x.e)));
  const pills = h('div', 'st-pills');
  pills.append(pill(SEV_CLS[x.s] + ' pr', sevName(x.s)), pill(incStCls(x.st), incStName(x.st)));
  if (x.m) pills.append(pill('m', T('studioIncMajorTag')));
  if (x.ev) pills.append(pill('l', T('studioIncEnvTag')));
  band.append(pills);
  const sm = h('p', 'st-band-s', incSummary(x));
  band.append(sm);
  p.append(band);
  const tab = ui.incTab || 'd';
  const seg = h('div', 'st-seg');
  seg.setAttribute('role', 'tablist');
  for (const [k, lbl] of [['d', T('studioAlTabD')], ['t', T('studioAlTabT', { n: x.tl.length })], ['r', T('studioAlTabR', { n: x.al.length })]]) {
    const b = btn('st-seg-b' + (tab === k ? ' on' : ''), lbl, () => { ui.incTab = k; render('none'); }, 'inctab:' + k);
    b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', tab === k ? 'true' : 'false');
    seg.append(b);
  }
  p.append(seg);
  if (tab === 'd') {
    const kv = (k, v) => { const d = h('div'); d.append(h('small', null, k)); const sp = h('span'); sp.append(v); d.append(sp); return d; };
    const g = h('div', 'st-kvg');
    g.append(kv(T('studioAlComp'), h('bdi', null, opsComp(x.c))), kv(T('studioIncHandled'), incByName(x.by) || '—'),
      kv(T('studioAlOpened'), h('bdi', null, fmtClock(x.f))),
      kv(x.rt ? T('studioIncClosedAt') : T('studioIncFails'), x.rt ? h('bdi', null, fmtClock(x.rt)) : String(x.n)));
    const card = h('div', 'st-twcard'); card.append(g);
    p.append(card);
    p.append(...pirSection(x));   // v379: דוח אחרי תקלה (P1–P2 שנפתרה)
    // שורש סביר — עד 3, עם פס לפי הסבירות
    if (x.rc.length) {
      const rc = h('div', 'st-twcard st-rc');
      rc.append(h('small', 'st-rc-h', T('studioRcT')));
      x.rc.forEach((r, i) => {
        const row = h('div', 'st-rc-r' + (i ? '' : ' top'));
        const bar = h('span', 'st-rc-bar'); const fill = h('i'); fill.style.width = Math.max(4, r.p) + '%'; bar.append(fill);
        const l = h('span', 'st-l'); l.append(h('b', null, rcText(r, x)), bar);
        row.append(h('span', 'st-rc-n', String(i + 1)), l, h('span', 'st-rc-p', ltr(r.p + '%')));
        rc.append(row);
      });
      p.append(rc);
    }
    // תיקון מוכר מספר התיקונים — טקסט בלבד
    const fp = rec && rec.srv && rec.srv.tw && rec.srv.tw.fp;
    const known = x.rc.some((r) => r.t === 'known') && fp && ui.fb ? ui.fb.find((e) => e.fp === fp && e.fix) : null;
    if (known) {
      const kc = h('div', 'st-twcard st-kb');
      const fx = h('p', null, known.fix); fx.dir = 'auto';
      kc.append(h('small', null, T('studioFbKnown')), fx);
      p.append(kc);
    }
    // קרה כבר — התקלה הדומה האחרונה שנפתרה, ואיך
    if (x.sim) {
      const sim = btn('st-twcard st-sim', null, () => { ui.incTab = 'd'; go('inc', x.sim.no); }, 'inc-sim');
      sim.append(h('small', null, T('studioIncSimT')), h('b', null, T('studioIncSim', { no: incNo(x.sim.no), t: opsAgo(x.sim.f) })),
        h('span', null, T('studioIncSimHow', { by: incByName(x.sim.by) || T('studioIncByU'), d: fmtShort(x.sim.min * 60) })));
      p.append(sim);
    }
    if (rec) p.append(list(rowNav({ tile: tile('film', 'blue'), label: fileTitle(rec.spec.name) || T('studioUntitled'), sub: T('studioAlJob'), onClick: () => go('job', rec.id), k: 'inc-job' })));
  } else if (tab === 't') {
    const tl = h('div', 'st-twcard st-tl');
    for (const e of x.tl.slice().reverse()) {
      const ev = h('div', 'st-ev');
      const good = e[1] === 'r' || e[1] === 'k' || e[1] === 'c' || e[1] === 'w';
      const d = h('span', 'st-ev-d ' + (good ? 'g' : e[1] === 'o' || e[1] === 'f' || e[1] === 'm' ? SEV_CLS[x.s] : ''));
      if (good) d.append(ico('check'));
      const l = h('span', 'st-l'); l.append(h('b', null, incEvName(e)), h('small', null, fmtClock(e[0])));
      ev.append(d, l);
      tl.append(ev);
    }
    p.append(tl);
  } else {
    p.append(x.al.length ? list(...x.al.slice().reverse().map((a) => {
      const open = !a.x && ui.ops && ui.ops.open.some((y) => y.no === a.no);
      const r = open ? btn('st-row st-ric', null, () => { ui.alTab = 'd'; go('alert', a.no); }, 'incal:' + a.no) : h('div', 'st-row st-ric');
      r.append(h('i', 'st-sdot ' + (a.x ? 'g' : a.s <= 2 ? 'r' : a.s === 3 ? 'a' : 'n')), rowTxt(opsAlert(a.c, a.k), alrNo(a.no) + (a.x ? ' · ' + T('studioEvX') : '')), pill(SEV_CLS[a.s], sevName(a.s)));
      return r;
    })) : h('div', 'st-empty st-empty-sm', T('studioAlNoRel')));
  }
  // פעולה אחת לכל מצב: אפשר להמשיך — "המשך מאותה נקודה"; אחרת — לעבודה
  const bar = h('div', 'st-abar');
  const row = h('div', 'st-abar-r');
  if (rec) row.append(btn('st-btn ghost', T('studioIncToJob'), () => go('job', rec.id), 'inc-go-job'));
  if (rec && canResume(rec) && (x.st === 'o')) {
    const rb = btn('st-btn', ui.resuming === rec.id ? T('studioResuming') : rec.srv && rec.srv.ck ? T('studioResumeCk') : T('studioRetryAll'), () => resumeSrv(rec.id), 'inc-resume');
    rb.disabled = !!ui.resuming || blocked();
    row.append(rb);
  }
  if (row.childNodes.length) { bar.append(row); p.append(bar); }
}
/* ---------------- v373: מלאי הסוכנים והרשאות (מסך 5 בתוכנית — AI Control Tower: Discover · Inventory) ---------------- */
function agentName(k) {
  switch (k) {
    case 'main': return T('studioAgMain');
    case 'tl': return T('studioAgTl');
    case 'jg': return T('studioAgJg');
    default: return T('studioAgRv');
  }
}
function agentAbbr(k) {
  switch (k) {
    case 'main': return T('studioAgMainA');
    case 'tl': return T('studioAgTlA');
    case 'jg': return T('studioAgJgA');
    default: return T('studioAgRvA');
  }
}
function effortName(e) {
  switch (e) {
    case 'low': return 'Low';
    case 'medium': return 'Medium';
    case 'high': return 'High';
    case 'max': return 'Max';
    default: return '';
  }
}
const agentModel = (a) => [a.m ? modelLabel(a.m) : '', effortName(a.ef)].filter(Boolean).join(' ');
function agentTile(k) { const t = h('span', 'st-agt a-' + k, agentAbbr(k)); t.setAttribute('aria-hidden', 'true'); return t; }
/* שורה לכל סוכן במגדל: מודל, עבודות, עלות; משמאל — אחוז ההצלחה. נגיעה → מסך המלאי */
function agentsSection() {
  const ag = ui.ag;
  if (!ag || !ag.agents.length) return [];
  return [secT(T('studioAgSec', { n: ag.jobs })), list(...ag.agents.map((a) => {
    const r = btn('st-row st-ric', null, () => go('agents'), 'ag:' + a.k);
    const l = h('span', 'st-l');
    const sub = h('small');
    sub.append(h('bdi', null, agentModel(a)), ' · ' + T('studioAgJobs', { n: a.jobs }) + ' · ');
    sub.append(usdEl(a.usd, a.partial));
    l.append(h('b', null, agentName(a.k)), sub);   // "הנחיות חדשות" — במסך המלאי (כאן השורה קצרה)
    r.append(agentTile(a.k), l, h('span', 'st-v', a.ok == null ? '—' : ltr(a.ok + '%')));
    return r;
  }))];
}
function pageAgents(p) {
  const ag = ui.ag;
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioAgT')), h('p', 'st-lede', ag ? T('studioAgLede', { n: ag.jobs }) : T('studioAgNone')));
  if (ag) for (const a of ag.agents) {
    const card = h('div', 'st-twcard st-agc');
    card.dataset.k = 'agc:' + a.k;
    const head = h('div', 'st-agh');
    const hl = h('span', 'st-l'); const sm = h('small'); sm.append(h('bdi', null, agentModel(a) || '—'));
    hl.append(h('b', null, agentName(a.k)), sm);
    head.append(agentTile(a.k), hl);
    if (a.pvNew) head.append(pill('m', T('studioAgPvNew')));
    const kv = (k, v) => { const d = h('div'); d.append(h('small', null, k)); const sp = h('span'); sp.append(v); d.append(sp); return d; };
    const g = h('div', 'st-kvg');
    g.append(kv(T('studioAgJobsK'), String(a.jobs)), kv(T('studioAgCost'), usdEl(a.usd, a.partial)),
      kv(T('studioAgOk'), a.ok == null ? '—' : ltr(a.ok + '%')), kv(T('studioAgActs'), a.n ? ltr(String(a.n)) + (a.e ? ' · ' + (a.e === 1 ? T('studioTrErr1') : T('studioTrErrs', { n: a.e })) : '') : '—'),
      kv(T('studioAgTime'), a.s >= 60 ? fmtShort(a.s) : '—'), kv(T('studioAgPv'), a.pv ? h('bdi', 'st-mono', a.pv) : '—'));
    if (a.k !== 'main') g.append(kv(T('studioQT'), a.q == null ? '—' : ltr(String(a.q))));   // v374: איכות ממוצעת של הכתוביות
    card.append(head, g);
    p.append(card);
  }
  // הרשאות ורדיוס פגיעה — מה מותר לכל סוכן (אותו דבר לכולם: הם רצים באותו סשן). נאכף ב־setup.sh, בשרתון ובמגדל
  const perms = h('div', 'st-twcard st-perm');
  perms.append(h('small', 'st-rc-h', T('studioPermT')));
  const line = (okv, txt) => { const r = h('div', 'st-perm-r ' + (okv ? 'y' : 'n')); const i = h('i'); i.append(ico(okv ? 'check' : 'x')); r.append(i, h('span', null, txt)); return r; };
  perms.append(line(true, T('studioPermDrive')), line(true, T('studioPermKey')), line(false, T('studioPermPush')), line(false, T('studioPermNotify')), line(false, T('studioPermSessions')));
  perms.append(h('p', 'st-perm-b', T('studioPermBlast')));
  p.append(perms);
  if (ag && ag.ev) p.append(note(T('studioAgEnv', { v: ag.ev.v, n: ag.ev.n })));
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
  refreshJobs(true);   // v376: מצב הבעיה (אובחנה → עקיפה ידועה) מגיע עם רשימת העבודות
}
const fbStage = (st) => { const c = { tr: 'asr', al: 'al', tl: 'tl', rv: 'rv' }[st]; return c ? ckName(c) : ''; };
/* ---------------- v376: בעיות וספרי הפעלה (מסך 3 בתוכנית — Problem · KEDB · LEAP · Playbooks) ---------------- */
const pbNo = (no) => 'B' + no;
const PB_CLS = { n: 'h', d: 'm', w: 'i', f: 'g' };
function pbStName(st) {
  switch (st) {
    case 'n': return T('studioPbStN');
    case 'd': return T('studioPbStD');
    case 'w': return T('studioPbStW');
    default: return T('studioPbStF');
  }
}
const pbTitle = (x) => { const st = fbStage(x.st); return fbWhy(x.why) + (st ? ' · ' + st : ''); };
function pbRow(x) {
  const r = btn('st-alr ' + PB_CLS[x.state], null, () => go('prob', x.no), 'pb:' + x.no);
  const tg = h('span', 'st-alr-t');
  tg.append(h('bdi', null, pbNo(x.no)), h('span', null, opsAgo(x.at)));
  const sub = h('small');
  if (x.state === 'f') sub.append(T('studioPbAfter', { n: x.after }));
  else { sub.append((x.jobs === 1 ? T('studioPbJobs1') : T('studioPbJobsN', { n: x.jobs })) + ' · ' + T('studioPbCost') + ' '); sub.append(usdEl(x.usd)); }
  r.append(tg, h('b', null, pbTitle(x)), pill(PB_CLS[x.state], pbStName(x.state)), sub);
  return r;
}
function pbSection() {
  const L = ui.pb ? ui.pb.list : [];
  if (!L.length) return [];
  const head = h('div', 'st-sec-t st-sec-row');
  head.append(h('span', null, T('studioPbSec')));
  if (L.length > 4) head.append(btn('st-linkb', ui.pbAll ? T('studioTwLess') : T('studioTwAll', { n: L.length }), () => { ui.pbAll = !ui.pbAll; render('none'); }, 'pb-all'));
  return [head, list(...(ui.pbAll ? L : L.slice(0, 4)).map(pbRow))];
}
function rbName(k) {
  switch (k) {
    case 'net': return T('studioRbNet');
    case 'known': return T('studioRbKnown');
    default: return T('studioRbCheap');
  }
}
function rbSection() {
  if (!ui.rb) return [];
  return [secT(T('studioRbSec')), list(...ui.rb.map((x) => {
    const r = h('div', 'st-row');
    r.dataset.k = 'rb:' + x.k;
    r.append(tile(x.r === 's' ? 'check' : 'sliders', x.r === 's' ? 'green' : 'orange'),
      rowTxt(rbName(x.k), x.r === 's' ? T('studioRbSafe') : T('studioRbAsk')),
      h('span', 'st-v st-rbn', x.n ? ltr(x.n + '×') : '—'));   // "החודש" בכותרת המקטע — בשורה רק המספר (ב־320 השם נשבר)
    return r;
  })), note(T('studioRbNote'))];
}
/* ---------------- v377: יעדי שירות, ערך ותחזית (מסך 3 + 8 בתוכנית — SLA · Measure · Process Mining) ---------------- */
const SLA_CLS = { ok: 'g', met: 'g', half: 'i', risk: 'h', over: 'c' };
function slaLvName(lv) {
  switch (lv) {
    case 'half': return T('studioSlaHalf');
    case 'risk': return T('studioSlaRisk');
    case 'over': return T('studioSlaOver');
    case 'met': return T('studioSlaMet');
    default: return T('studioSlaOk');
  }
}
/* פס עם סימונים ב־50% וב־75% — כמו השעון של ServiceNow */
function slaBar(f, lv) {
  const b = h('span', 'st-slabar ' + SLA_CLS[lv]);
  const i = h('i'); i.style.width = Math.round(Math.min(1, f) * 100) + '%';
  b.append(i, h('em', 'm50'), h('em', 'm75'));
  return b;
}
function slaRow(label, valTxt, f, lv, k) {
  const r = h('div', 'st-row st-slarow');
  r.dataset.k = k;
  const l = h('span', 'st-l');
  const v = h('small'); v.append(valTxt);
  l.append(h('b', null, label), v, slaBar(f, lv));
  r.append(l, pill(SLA_CLS[lv], slaLvName(lv)));
  return r;
}
function slaCard(sla) {
  const t = sla.t;
  const rows = [slaRow(T('studioSlaTime'), T('studioSlaOf', { a: fmtShort(t.el), b: approx(fmtShort(t.tg)) }), t.f, t.lv, 'sla:t')];
  if (sla.u) {
    const v = h('span'); v.append(usdEl(sla.u.sp), ' ' + T('studioSlaOfU') + ' ', approx(fmtUsd(sla.u.tg)));
    rows.push(slaRow(T('studioSlaCost'), v, sla.u.f, sla.u.lv, 'sla:u'));
  }
  const out = [secT(T('studioSlaT')), list(...rows)];
  if (t.paused) out.push(note(T('studioSlaPaused')));
  else if (t.pz >= 60) out.push(note(T('studioSlaPz', { t: fmtShort(t.pz) })));
  return out;
}
function valueSection() {
  const va = ui.va;
  if (!va || (!va.n && !va.bn)) return [];
  // הכותרת של המקטע כבר אומרת "ערך ועלות" — בשורה המספר עצמו (בלי כפילות)
  const r = btn('st-row st-ric', null, () => go('value'), 'tower-value');
  const l = h('span', 'st-l'), b = h('b');
  if (!va.n) b.append(T('studioVaNone'));
  else if (va.saved != null) { b.append(T('studioVaSavedK') + ' '); b.append(usdBig(Math.max(0, va.saved))); }
  else b.append(T('studioVaMinS', { n: fmtNum(va.min) }));
  l.append(b);
  if (va.n && va.saved != null) l.append(h('small', null, T('studioVaMinS', { n: fmtNum(va.min) })));
  r.append(tile('chart', 'green'), l, ico('chev', 'st-chev'));
  return [secT(T('studioVaSec')), list(r)];
}
const fmtNum = (n) => { try { return new Intl.NumberFormat(uiLang(), { maximumFractionDigits: n < 10 ? 1 : 0 }).format(n); } catch (e) { return String(Math.round(n)); } };
/* סכום שלם או גדול — בלי אגורות ועם מפריד אלפים ("$2,031", "$5"); קטן — כמו בכל הסטודיו ("$0.08") */
export function fmtUsdWhole(v) {
  v = Number(v) || 0;
  if (v < 100 && !Number.isInteger(v)) return fmtUsd(v);
  try { return '$' + new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(v)); } catch (e) { return '$' + Math.round(v); }
}
const usdBig = (v) => { const b = h('bdi', null, fmtUsdWhole(v)); b.dir = 'ltr'; return b; };
const PRICES = [2, 5, 10, 20];
let priceBusy = false;
async function setPrice(hp) {
  if (priceBusy || !ui.va || ui.va.hp === hp) return;
  const prev = ui.va.hp; ui.va.hp = hp; priceBusy = true; render('none');
  try {
    const j = await net.api('price', { hp });
    if (!j.ok) { ui.va.hp = prev; flashSafe(errText(j.error)); }
    else { jobsAt = 0; await refreshJobs(true); }
  } finally { priceBusy = false; render('none'); }
}
function pageValue(p) {
  const va = ui.va;
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioVaT')));
  if (!va) { p.append(h('div', 'st-empty st-empty-sm', T('studioVaNone'))); return; }
  const cpm = h('span'); cpm.append(va.cpm == null ? '—' : usdEl(va.cpm < 0.01 ? 0.01 : va.cpm));
  const sv = h('span'); sv.append(va.saved == null ? '—' : usdBig(Math.max(0, va.saved)));
  const fc = h('span'); fc.append(va.fc == null ? T('studioVaFcNone') : usdEl(va.fc));
  p.append(secT(T('studioVaMonth')), va.n ? list(kvRow(T('studioVaMin'), fmtNum(va.min)), kvRow(T('studioVaCpm'), cpm, true), kvRow(T('studioVaSavedK'), sv, true),
    kvRow(T('studioVaFc'), fc, true)) : h('div', 'st-empty st-empty-sm', T('studioVaNone')));
  if (va.bn) {
    const pct = ltr(Math.round(va.bn.sh * 100) + '%');
    // שם השלב בשורה, והמספרים מתחתיו — ב־320 שני טקסטים ארוכים זה לצד זה נשברו
    const bn = h('div', 'st-row'); bn.dataset.k = 'va-bn';
    bn.append(rowTxt(stageName(va.bn.s, ''), va.bn.x != null && va.bn.x >= 1.2 ? T('studioVaBn', { p: pct, x: fmtNum(va.bn.x) }) : T('studioVaBnOk', { p: pct })));
    p.append(secT(T('studioVaBnT')), list(bn));
  }
  if (va.ab.n) p.append(secT(T('studioVaAbT')), list(kvRow(T('studioVaAbRs'), String(va.ab.rs)), kvRow(T('studioVaAbQa'), String(va.ab.qa))));
  // המחיר שלך — לחישוב "חסכת" (החלטה 5: מתחילים מ־$5 לדקת סרטון); נקבע רק כאן
  const opts = PRICES.includes(va.hp) ? PRICES : PRICES.concat(va.hp).sort((a, b) => a - b);
  p.append(secT(T('studioVaPriceT')), list(...opts.map((x) => rowRadio({ label: T('studioVaPerMin', { u: fmtUsdWhole(x) }), on: va.hp === x,
    onClick: () => setPrice(x), k: 'hp:' + x, disabled: blocked() || priceBusy }))), note(T('studioVaPriceNote')));
}
/* v378: בדיקת מוכנות ותחזוקה (Instance Scan + CMDB Health) — ממצאים עם עדיפות 1–5, פעולה אחת לכל ממצא, "נקה" לפח של Drive */
const SC_P_CLS = ['', 'c', 'h', 'w', 'i', 'l'];
const scColor = (s) => (s >= 90 ? 'green' : s >= 70 ? 'orange' : 'red');
function scLabel(sc) { return !sc.f.length ? T('studioScAllOk') : sc.s >= 70 ? T('studioScMostly') : T('studioScNeeds'); }
function scFindCount(n) { return n === 1 ? T('studioScFind1') : T('studioScFindN', { n }); }
function scanSection() {
  const sc = ui.sc;
  const sub = !sc ? T('studioScNever') : (sc.f.length ? scFindCount(sc.f.length) : T('studioScAllOk')) + ' · ' + opsAgo(sc.at);
  return [secT(T('studioScSec')), list(rowNav({ tile: tile('shield', sc ? scColor(sc.s) : 'blue'), label: T('studioScT'), sub, value: sc ? String(sc.s) : '', onClick: () => go('scan'), k: 'tower-scan' }))];
}
function scCat(ch) {
  switch (ch) {
    case 'claude': case 'budget': return T('studioScCatSetup');
    case 'drive': return T('studioScCatSec');
    case 'quota': case 'fires': return T('studioScCatEnv');
    default: return T('studioScCatClean');
  }
}
function scCheckName(k) {
  switch (k) {
    case 'claude': return T('studioScChClaude');
    case 'drive': return T('studioScChDrive');
    case 'quota': return T('studioScChQuota');
    case 'fires': return T('studioScChFires');
    case 'budget': return T('studioScChBudget');
    case 'orphans': return T('studioScChOrphans');
    case 'dupes': return T('studioScChDupes');
    case 'ck': return T('studioScChCk');
    default: return T('studioScChOld');
  }
}
/* הכותרת והתיקון לכל ממצא — מחרוזות קבועות */
function scText(x) {
  const one = x.n === 1, sz = x.b ? ' · ' + fmtSize(x.b) : '';
  switch (x.k) {
    case 'claude_missing': return [T('studioScClaudeMissing'), T('studioScFixConnect')];
    case 'claude_untested': return [T('studioScClaudeUntested'), T('studioScFixTest')];
    case 'claude_stale': return [T('studioScClaudeStale', { d: x.d }), T('studioScFixTest')];
    case 'drive_cfg': return [T('studioScDriveCfg'), T('studioScFixVercel')];
    case 'drive_missing': return [T('studioScDriveMissing'), T('studioScFixDrive')];
    case 'drive_revoked': return [T('studioScDriveRevoked'), T('studioScFixDrive')];
    case 'drive_err': return [T('studioScDriveErr'), T('studioScFixRetry')];
    case 'quota_crit': return [T('studioScQuotaCrit', { b: fmtSize(x.b) }), T('studioScFixQuota')];
    case 'quota_low': return [T('studioScQuotaLow', { b: fmtSize(x.b) }), T('studioScFixQuota')];
    case 'fires_high': return [T('studioScFires', { n: x.n, m: x.m }), T('studioScFixFires')];
    case 'budget_low': return [T('studioScBudget', { u: fmtUsdWhole(x.u), need: fmtUsd(x.need) }), T('studioScFixBudget')];
    case 'orphans': return [(one ? T('studioScOrph1') : T('studioScOrphN', { n: x.n })) + sz, T('studioScOrphS')];
    case 'dupes': return [(one ? T('studioScDup1') : T('studioScDupN', { n: x.n })) + sz, T('studioScDupS')];
    case 'ck': return [(one ? T('studioScCk1') : T('studioScCkN', { n: x.n })) + sz, T('studioScCkS')];
    default: return [one ? T('studioScOld1') : T('studioScOldN', { n: x.n }), T('studioScOldS')];
  }
}
function scCleanQ(x) {
  switch (x.k) {
    case 'orphans': return T('studioScQOrph', { n: x.n });
    case 'dupes': return T('studioScQDup', { n: x.n });
    case 'ck': return T('studioScQCk');
    default: return T('studioScQOld', { n: x.n });
  }
}
const SCAN_FRESH = 10 * 60e3;   // סריקה מלפני פחות מ־10 דקות — מציגים אותה
let scanBusy = '';
async function runScan() {
  if (scanBusy) return;
  scanBusy = 'scan'; render('none');
  try {
    const j = await net.api('scan');
    if (j.ok) { ui.sc = normScan(j.sc) || ui.sc; save(); } else flashSafe(errText(j.error));
  } finally { scanBusy = ''; render('none'); }
}
async function runClean(kinds) {
  if (scanBusy) return;
  scanBusy = kinds.length > 1 ? 'all' : kinds[0]; render('none');
  let n = 0;
  try {
    for (const k of kinds) {
      const j = await net.api('clean', { k });
      if (!j.ok) { flashSafe(errText(j.error)); break; }
      n += Number(j.n) || 0;
      ui.sc = normScan(j.sc) || ui.sc;
    }
    if (n) { flashSafe(T('studioScCleaned')); jobsAt = 0; refreshJobs(true); }
    save();
  } finally { scanBusy = ''; render('none'); }
}
function askClean(x) {
  const go2 = () => runClean([x.k]);
  if (typeof askConfirm === 'function') askConfirm(scCleanQ(x), go2, { danger: true, ok: T('studioScClean') }); else go2();
}
function scFindRow(x) {
  const [title, fix] = scText(x);
  const nav = x.k.startsWith('claude_') ? () => go('connect') : x.k === 'drive_missing' || x.k === 'drive_revoked' ? () => go('settings') : x.k === 'budget_low' ? () => go('rules') : null;
  const r = nav ? btn('st-fnd ' + SC_P_CLS[x.p], null, nav, 'sc:' + x.k) : h('div', 'st-fnd ' + SC_P_CLS[x.p]);
  if (!nav) r.dataset.k = 'sc:' + x.k;
  const l = h('span', 'st-l');
  l.append(h('small', null, T('studioScFinding', { c: scCat(x.ch) })), h('b', null, title), h('small', null, fix));
  r.append(h('i', 'st-fnd-p', String(x.p)), l);
  if (nav) r.append(ico('chev', 'st-chev'));
  else if (SC_CLEAN.includes(x.k)) {
    const b = btn('st-mini danger', scanBusy === x.k ? T('studioScCleaning') : T('studioScClean'), () => askClean(x), 'scc:' + x.k);
    if (scanBusy || blocked()) b.disabled = true;
    r.append(b);
  }
  return r;
}
function pageScan(p) {
  const sc = ui.sc;
  p.append(navBar({ back: T('studioTwShort'), title: T('studioScT') }));
  const ab = accessBanner(); if (ab) p.append(ab);
  const hero = h('div', 'st-schero');
  if (!sc) hero.append(h('b', 'st-schero-n', '—'), rowTxt(scanBusy ? T('studioScRunning') : T('studioScNever'), ''));
  else {
    const n = h('b', 'st-schero-n t-' + scColor(sc.s), String(sc.s));
    hero.append(n, rowTxt(scLabel(sc), T('studioScMeta', { n: sc.n, t: opsAgo(sc.at) })));
  }
  p.append(hero);
  if (sc && sc.f.length) p.append(list(...sc.f.map(scFindRow)));
  if (sc && sc.ok.length) {
    const r = btn('st-row', null, () => { ui.scOk = !ui.scOk; render('none'); }, 'sc-ok');
    r.setAttribute('aria-expanded', ui.scOk ? 'true' : 'false');
    r.append(rowTxt(T('studioScOkN', { n: sc.ok.length }), ''), ico('chev', 'st-chev' + (ui.scOk ? ' open' : '')));
    const rows = [r];
    if (ui.scOk) for (const k of sc.ok) { const o = h('div', 'st-row'); o.dataset.k = 'sco:' + k; const c = h('span', 'st-check on lock'); c.append(ico('check')); o.append(c, rowTxt(scCheckName(k), '')); rows.push(o); }
    p.append(h('div', 'st-gap sm'), list(...rows));
  }
  const again = btn('st-btn tint wide', scanBusy === 'scan' ? T('studioScRunning') : T('studioScRun'), () => runScan(), 'sc-run');
  if (scanBusy || blocked()) again.disabled = true;
  p.append(h('div', 'st-gap'), again);
  const cl = sc ? sc.f.filter((x) => SC_CLEAN.includes(x.k)) : [];
  if (cl.length > 1) {
    const all = btn('st-btn danger wide', scanBusy === 'all' ? T('studioScCleaning') : sc.fb ? T('studioScCleanAll', { b: fmtSize(sc.fb) }) : T('studioScCleanAllN'), () => {
      const doIt = () => runClean(cl.map((x) => x.k));
      if (typeof askConfirm === 'function') askConfirm(T('studioScQAll'), doIt, { danger: true, ok: T('studioScClean') }); else doIt();
    }, 'sc-all');
    if (scanBusy || blocked()) all.disabled = true;
    p.append(h('div', 'st-gap sm'), all);
  }
  if (cl.length) p.append(note(T('studioScNote')));
}
/* דף בעיה: מה חוזר, כמה פגע וכמה עלה, העקיפה (או ההצעה שמחכה לך), והתקלות שנגרמו ממנה */
function pageProb(p) {
  const no = Number(ui.param);
  const x = ui.pb ? ui.pb.list.find((y) => y.no === no) : null;
  p.append(navBar({ back: T('studioTwShort'), title: pbNo(no) }));
  if (!x) { p.append(h('div', 'st-empty st-empty-sm', T('studioPbGone'))); return; }
  const band = h('div', 'st-band ' + PB_CLS[x.state]);
  band.append(h('small', null, T('studioPbKind')), h('b', null, pbTitle(x)));
  const pills = h('div', 'st-pills'); pills.append(pill(PB_CLS[x.state] + ' pr', pbStName(x.state))); band.append(pills);
  p.append(band, h('div', 'st-gap sm'));
  const cost = h('span'); cost.append(usdEl(x.usd));
  p.append(list(kvRow(T('studioPbStops'), String(x.n)), kvRow(T('studioPbJobsK'), String(x.jobs)), kvRow(T('studioPbCostK'), cost, true),
    kvRow(T('studioPbAutoK'), String(x.auto)), kvRow(T('studioPbLastK'), opsAgo(x.at))));
  if (x.state === 'f') p.append(note(T('studioPbAfter', { n: x.after })));
  // העקיפה — התיקון שאושר, ומתחתיו הצעה של Claude שמחכה להחלטה שלך (טקסט בלבד)
  p.append(secT(T('studioPbFixT')));
  const fx = h('div', 'st-twcard st-pbfix');
  const ft = h('p', x.fix ? null : 'st-muted', x.fix || T('studioFbNoFix')); if (x.fix) ft.dir = 'auto';
  fx.append(ft);
  if (x.px) {
    const pr = h('span', 'st-fbp'); const pt = h('small', null, x.px); pt.dir = 'auto';
    const bs = h('span', 'st-fbb');
    bs.append(btn('st-mini tint', T('studioFbKeep'), () => decideFix(x.fp, true), 'fbk:' + x.fp), btn('st-mini ghost', T('studioFbDrop'), () => decideFix(x.fp, false), 'fbd:' + x.fp));
    pr.append(h('small', 'st-fbpl', T('studioFbPropL')), pt, bs);
    fx.append(pr);
  }
  p.append(fx);
  const incs = x.inc.map((n) => ui.inc && ui.inc.list.find((y) => y.no === n)).filter(Boolean);
  if (incs.length) p.append(secT(T('studioPbIncT')), list(...incs.map((y) => incRow(y))));
  p.append(note(T('studioPbScoreN')));
}
/* v363: מסך "מגדל הפיקוח" — מה קורה עכשיו, "הרגיל" שלך לכל מצב (נלמד מהעבודות שלך), מתי עוצרים, ועצירות אחרונות */
function pageTower(p) {
  // v369: כותרת כמו בתוכנית — היום והתאריך, ומשפט אחד על המצב
  const nUrg = urgentAlerts().length;
  const hero = h('div', 'st-twhero');
  const dt = new Date();
  hero.append(h('small', null, dt.toLocaleDateString(uiLang() === 'en' ? 'en-US' : 'he-IL', { weekday: 'long' }) + ' · ' + dt.toLocaleDateString(uiLang() === 'en' ? 'en-GB' : 'he-IL', { day: '2-digit', month: '2-digit' })),
    h('h1', 'st-large', !ui.ops ? T('studioTwT') : majorOn(ui.inc) ? T('studioTwHelloMajor') : !nUrg ? T('studioTwHello') : nUrg === 1 ? T('studioTwHello1') : T('studioTwHelloN', { n: nUrg })));
  p.append(navBar({ back: T('studioBack'), title: T('studioTwT') }), hero);
  const ab = accessBanner(); if (ab) p.append(ab);
  const hb = haltBanner(); if (hb) p.append(hb);   // v367: מתג החירום פעיל
  const mb = majorBanner(true); if (mb) p.append(mb);   // v371: תקלה רחבה — הפעלות מחכות
  if (ui.ops) p.append(...opsSection(ui.ops));   // v365/v369: ציונים עם מגמה והתראות פתוחות
  p.append(...incSection());   // v371: תקלות — מה קרה לעבודות (ההתראות שמעל = האותות מהרכיבים)
  // v369: פעולות מהירות — רק מה שקיים
  const qa = h('div', 'st-qa');
  const qbtn = (icon, lbl, fn, k, cls) => { const b = btn('st-qa-b' + (cls ? ' ' + cls : ''), null, fn, k); const i = h('i'); i.append(ico(icon)); b.append(i, h('span', null, lbl)); return b; };
  qa.append(qbtn('plus', T('studioQaNew'), () => { form = freshForm(null); go('new'); }, 'qa-new'));
  const resumable = store.jobs.find((r) => canResume(r));
  if (resumable) qa.append(qbtn('film', T('studioQaResume'), () => go('job', resumable.id), 'qa-resume'));
  qa.append(qbtn('sliders', T('studioRlT'), () => go('rules'), 'qa-rules'));
  if (!ui.halt) qa.append(qbtn('power', T('studioQaHalt'), () => askHalt(), 'qa-halt', 'neg'));   // עצורים — "להחזיר" רק בבאנר שלמעלה
  p.append(secT(T('studioTwQuick')), qa);
  if (ui.ops) p.append(...serviceMap(ui.ops));
  if (ui.api && (ui.api.admin || ui.api.servers)) {   // מצב API: השרת של המערכת
    p.append(list(rowNav({ tile: tile('cloud', ui.api.online ? 'green' : 'orange'), label: T('studioSrvT'),
      sub: ui.api.online ? T('studioSrvOnN', { n: ui.api.online }) : T('studioSrvNone'), onClick: () => go('server'), k: 'tower-srv' })));
  }
  p.append(...agentsSection());   // v373: מלאי הסוכנים — 30 יום
  p.append(...valueSection());    // v377: ערך ועלות החודש
  p.append(...scanSection());     // v378: בדיקת מוכנות ותחזוקה
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
  // v369: "שליטה" (החוקים שלך ומתג החירום) — בפעולות המהירות למעלה, בלי שורות כפולות
  // v376: ספר התיקונים הפך לניהול בעיות (Problem · KEDB) — כל תקלה שחוזרת, מה העקיפה, ומה שווה לתקן בקוד; ואחריו ספרי ההפעלה
  p.append(...pbSection(), ...rbSection());
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
  // v368: "עצירות אחרונות" הוסר — עצירה של המגדל היא התראה דחופה למעלה (נגיעה → העבודה, עם כרטיס העצירה)
}
/* v367: מתג החירום — "עצור את כל הסוכנים" (מבטל את מפתחות העבודות, המגדל עוצר את הסשן, הפעלות מושהות) ו"להחזיר" */
let haltBusy = false;
function askHalt() {
  const n = store.jobs.filter((r) => r.srv && (r.srv.state === 'running' || r.srv.state === 'queued')).length;
  const q = n === 1 ? T('studioHaltQ1') : n ? T('studioHaltQN', { n }) : T('studioHaltQ0');
  if (typeof askConfirm === 'function') askConfirm(q, () => setHalt(true), { danger: true, ok: T('studioHaltOk') });
}
async function setHalt(on) {
  if (haltBusy) return;
  haltBusy = true; render('none');
  try {
    const j = await net.api('halt', { on });
    if (!j.ok) { flashSafe(errText(j.error)); return; }
    ui.halt = num(j.halt);
    flashSafe(on ? (!j.n ? T('studioHaltDone0') : j.n === 1 ? T('studioHaltDone1') : T('studioHaltDoneN', { n: num(j.n) })) : T('studioHaltBack'));
    if (on) await refreshJobs(true);
  } finally { haltBusy = false; render('none'); }
}
function haltBanner() {
  if (!ui.halt) return null;
  const b = h('div', 'st-banner warn st-halt');
  b.dataset.k = 'halt-banner';
  const t = h('span', null, T('studioHaltOnB', { t: fmtClock(ui.halt) }));
  const back = btn('st-mini tint', T('studioHaltBackBtn'), () => setHalt(false), 'halt-back');
  back.disabled = haltBusy || blocked();
  b.append(ico('power'), t, back);
  return b;
}
/* v367: "החוקים שלך" — סיכום בשורה אחת */
const MODE_ORDER = ['haiku-medium', 'haiku-high', 'sonnet-medium', 'sonnet-high', 'opus-medium'];   // לפי הצפוי לשעה (NORM_DEF בשרתון)
export const modeOverMax = (id, mx) => !!mx && MODE_ORDER.indexOf(id) > MODE_ORDER.indexOf(mx);
const ltr = (x) => '\u2066' + x + '\u2069';   // סכום בדולרים בתוך משפט בעברית — בידוד, כדי שלא יתהפך
const budgetTxt = (b) => ltr('$' + (Number.isInteger(b) ? String(b) : b.toFixed(2)));
function rulesSum(rl) {
  const parts = [];
  if (rl.b) parts.push(T('studioRlSumB', { v: budgetTxt(rl.b) }));
  if (rl.mx) parts.push(T('studioRlUpTo', { m: modeShort(modeById(rl.mx)) }));
  if (rl.ab) parts.push(T('studioRlSumAb'));
  if (rl.jx) parts.push(T('studioRlSumJx'));
  return parts.length ? parts.join(' · ') : T('studioRlNone');
}
let rulesBusy = false;
async function setRules(patch) {
  if (rulesBusy) return;
  const prev = ui.rl;
  ui.rl = normRules(Object.assign({}, ui.rl, patch));
  rulesBusy = true; render('none');
  try {
    const j = await net.api('rules', { rl: ui.rl });
    if (j.ok) ui.rl = normRules(j.rl);
    else { ui.rl = prev; flashSafe(errText(j.error)); }
  } finally { rulesBusy = false; render('none'); }
}
function pageRules(p) {
  p.append(navBar({ back: T('studioTwT') }), large(T('studioRlT')), h('p', 'st-lede', T('studioRlLede')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const rl = ui.rl, off = blocked() || rulesBusy;
  // תקציב לעבודה — הגעת אליו: Claude עוצר ושואל בטלפון
  const opts = [0].concat(RULE_BUDGETS);
  if (rl.b && !opts.includes(rl.b)) opts.push(rl.b);
  p.append(secT(T('studioRlBudgetT')), list(...opts.map((b) => rowRadio({ label: b ? budgetTxt(b) : T('studioRlNoBudget'), sub: b ? null : T('studioRlNoBudgetS'),
    on: rl.b === b, onClick: () => setRules({ b }), k: 'rb:' + b, disabled: off }))), note(T('studioRlBudgetNote')));
  // מצב מקסימלי — מצב יקר יותר מחכה לאישור שלך לפני שמתחילים
  const mxs = [''].concat(MODE_ORDER.slice(0, -1));
  p.append(secT(T('studioRlMaxT')), list(...mxs.map((id) => rowRadio({ label: id ? T('studioRlUpTo', { m: modeName(modeById(id)) }) : T('studioRlAllModes'),
    on: rl.mx === id, onClick: () => setRules({ mx: id }), k: 'rm:' + (id || 'all'), disabled: off }))));
  // אישור לפני צריבה — 5 כתוביות לדוגמה בטלפון
  p.append(secT(T('studioRlAbT')), list(rowSwitch({ label: T('studioRlAb'), sub: T('studioRlAbS'), on: rl.ab, onClick: () => { if (!off) setRules({ ab: !rl.ab }); }, k: 'ra' })));
  // v375: שופט האיכות (Haiku, 40 כתוביות לדוגמה בסוף כל עבודה) — פועל כברירת מחדל (החלטה 4 בתוכנית)
  p.append(secT(T('studioRlJgT')), list(rowSwitch({ label: T('studioRlJg'), sub: T('studioRlJgS'), on: !rl.jx, onClick: () => { if (!off) setRules({ jx: !rl.jx }); }, k: 'rj' })));
  // v380: זיכרון המונחים — מילון אחד לכל העבודות (ב־Drive שלך); כל עבודה מקבלת רק את המונחים שמופיעים בסרטון
  p.append(secT(T('studioGlSec')), list(rowNav({ tile: tile('globe', 'blue'), label: T('studioGlT'), sub: gl.st === 'ok' ? T('studioGlN', { n: gl.rows.length }) : T('studioGlSub'), onClick: () => go('gloss'), k: 'rules-gloss' })));
  // v366: מסלול התיקונים — "הצעות לאישור" (ברירת המחדל) או "Claude מחליט לבד".
  // v368: עבר לכאן ממסך המגדל — כל מה שאתה קובע לסוכנים במקום אחד
  const fm = ui.fm === 'auto' ? 'auto' : 'suggest';
  p.append(secT(T('studioFmT')), list(
    rowRadio({ label: T('studioFmSug'), sub: T('studioFmSugS'), on: fm === 'suggest', onClick: () => setFixMode('suggest'), k: 'fm:suggest', disabled: blocked() }),
    rowRadio({ label: T('studioFmAuto'), sub: T('studioFmAutoS'), on: fm === 'auto', onClick: () => setFixMode('auto'), k: 'fm:auto', disabled: blocked() })));
}
/* v367: שער — הגענו לתקציב / לפני הצריבה. הטקסט מהקטלוג; הכתוביות לדוגמה (מהתרגום) — רק כטקסט */
function gateCard(rec, qa) {
  const b = qa.g === 'b';
  const c = h('div', 'st-ask st-gate' + (qa.a ? ' done' : ''));
  c.dataset.k = 'ask';
  if (qa.a) {
    const go2 = qa.a.i === 0 && !qa.a.auto;
    const tx = b ? (go2 ? T('studioGateBGo') : qa.a.auto ? T('studioGateBAuto') : T('studioGateBStop'))
      : (go2 ? T('studioGateRGo') : qa.a.auto ? T('studioGateRAuto') : T('studioGateRStop'));
    c.append(ico('check'), h('span', null, tx));
    return c;
  }
  const head = h('div', 'st-ask-h');
  head.append(ico(b ? 'alert' : 'film'), h('b', null, b ? T('studioGateBT') : T('studioGateRT')));
  c.append(head, h('p', 'st-ask-q', b ? T('studioGateBQ', { u: ltr(fmtUsd(qa.n.usd)), b: budgetTxt(qa.n.cap) }) : T('studioGateRQ', { n: qa.n.cnt })));
  if (!b && qa.n.cues.length) {
    const cl = h('div', 'st-cues');
    for (const cu of qa.n.cues) {
      const r = h('div', 'st-cue');
      const tm = h('bdi', 'st-cue-t', cu.t); tm.dir = 'ltr';
      const x = h('span', 'st-cue-x', cu.x); x.dir = 'auto';
      r.append(tm, x);
      cl.append(r);
    }
    c.append(cl);
  }
  const opts = h('div', 'st-ask-o');
  const lbl = b ? [T('studioGateBGoBtn', { b: budgetTxt(budgetStep(qa)) }), T('studioGateBStopBtn')] : [T('studioGateRGoBtn'), T('studioGateRStopBtn')];
  lbl.forEach((l, i) => {
    const bt = btn('st-btn ' + (i === qa.d ? 'tint' : 'ghost') + ' wide', l, () => sendAnswer(rec.id, qa.id, { i }), 'ask:' + i);
    bt.disabled = askBusy;
    opts.append(bt);
  });
  c.append(opts);
  const until = fmtClock((qa.at || Date.now()) + qa.w * 1000);
  c.append(h('small', 'st-ask-n', b ? T('studioGateBDef', { t: until }) : T('studioGateRDef', { t: until })));
  return c;
}
/* "להמשיך" מגדיל את התקציב בעוד תקציב אחד (החוק שקבעת) */
const budgetStep = (qa) => ui.rl.b || qa.n.cap;
function askCard(rec) {
  const qa = rec.srv && rec.srv.qa;
  if (!qa || FINAL.includes(rec.srv.state)) return null;
  if (qa.g) return gateCard(rec, qa);
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
    case 'jg': return T('studioCostJg');
    default: return T('studioCostSub');
  }
}
function usdEl(v, plus) { const b = h('bdi', null, v == null ? '—' : fmtUsd(v) + (plus ? '+' : '')); b.dir = 'ltr'; return b; }   // "+" בתוך הבידוד — אחרת ב־RTL הוא קופץ לצד השני
/* v374: איכות הכתוביות (מסך 6 בתוכנית — צ'קליסט משוקלל, סף מעבר 70) + שומר ההזרקות. בלי טוקנים — מהקובץ הסופי */
function qName(k) {
  switch (k) {
    case 'cps': return T('studioQCps');
    case 'len': return T('studioQLen');
    case 'lines': return T('studioQLines');
    case 'dur': return T('studioQDur');
    case 'en': return T('studioQEn');
    default: return T('studioQChk');
  }
}
function jgName(k) {
  switch (k) {
    case 'mean': return T('studioJgMean');
    case 'omit': return T('studioJgOmit');
    case 'add': return T('studioJgAdd');
    case 'gram': return T('studioJgGram');
    case 'flu': return T('studioJgFlu');
    default: return T('studioJgTerm');
  }
}
/* ---- v380: זיכרון המונחים ---- */
const gl = { st: '', id: '', rows: [], err: '', busy: false, q: '', en: '', he: '' };
async function glossLoad(force) {
  if (gl.st === 'load' || (gl.st === 'ok' && !force)) return;
  gl.st = 'load'; render('none');
  try { const r = await net.glossLoad(); gl.id = r.id; gl.rows = r.rows; gl.st = 'ok'; gl.err = ''; }
  catch (e) { gl.st = 'err'; gl.err = e && (e.code || e.message) || 'drive'; }
  render('none');
}
async function glossWrite(rows, msg) {
  if (gl.busy || gl.st !== 'ok') return false;
  gl.busy = true; render('none');
  try { gl.id = await net.glossSave(gl.id, rows); gl.rows = rows; if (msg) flashSafe(msg); return true; }
  catch (e) { flashSafe(T('studioGlSaveErr')); return false; }
  finally { gl.busy = false; render('none'); }
}
const glHas = (en) => gl.rows.some((r) => r[0].toLowerCase() === String(en).toLowerCase());
function glRow(r) {
  const row = h('div', 'st-row st-glr');
  const l = btn('st-l st-gle', null, () => { gl.en = r[0]; gl.he = r[1]; render('none'); }, 'gl:' + r[0].toLowerCase());   // נגיעה = לעריכה בטופס
  const en = h('b'); const eb = h('bdi', null, r[0]); eb.dir = 'ltr'; en.append(eb);
  const he = h('small', null, r[1]); he.dir = 'auto';
  l.append(en, he);
  if (r[2]) { const n = h('small', 'st-muted', r[2]); n.dir = 'auto'; l.append(n); }
  const del = btn('st-mini ghost', null, () => { glossWrite(gl.rows.filter((x) => x !== r), T('studioGlDeleted')); }, 'gld:' + r[0].toLowerCase());
  del.append(ico('x')); del.setAttribute('aria-label', T('studioGlDel'));
  if (gl.busy || blocked()) del.disabled = true;
  row.append(l, del);
  return row;
}
function pageGloss(p) {
  p.append(navBar({ back: T('studioRlT'), title: T('studioGlT') }));
  const ab = accessBanner(); if (ab) p.append(ab);
  if (!store.drive || !store.drive.connected) { p.append(h('div', 'st-empty st-empty-sm', T('studioGlNoDrive'))); return; }
  if (gl.st === 'err') {
    p.append(h('div', 'st-empty st-empty-sm', T('studioGlErr')), btn('st-btn tint wide', T('studioGlRetry'), () => glossLoad(true), 'gl-retry'));
    return;
  }
  if (gl.st !== 'ok') { p.append(h('div', 'st-empty st-empty-sm', T('studioGlLoading'))); return; }
  // הוספה / עריכה: אותו מונח באנגלית מתעדכן
  const f = h('div', 'st-twcard st-glf');
  const en = h('input', 'st-in'); en.dir = 'auto'; en.maxLength = 60; en.placeholder = T('studioGlEn'); en.value = gl.en; en.dataset.k = 'gl-en'; en.autocomplete = 'off'; en.spellcheck = false;
  const he = h('input', 'st-in'); he.dir = 'auto'; he.maxLength = 80; he.placeholder = T('studioGlHe'); he.value = gl.he; he.dataset.k = 'gl-he'; he.autocomplete = 'off';
  en.setAttribute('aria-label', T('studioGlEn')); he.setAttribute('aria-label', T('studioGlHe'));
  en.addEventListener('input', () => { gl.en = en.value; });
  he.addEventListener('input', () => { gl.he = he.value; });
  const edit = glHas(gl.en.trim());
  const add = btn('st-btn tint wide', edit ? T('studioGlUpdate') : T('studioGlAdd'), async () => {
    const e2 = glClean(gl.en, 60), h2 = glClean(gl.he, 80);
    if (!e2 || !h2) { flashSafe(T('studioGlNeed')); return; }
    if (!glHas(e2) && gl.rows.length >= GL_MAX) { flashSafe(T('studioGlFull', { n: GL_MAX })); return; }
    const old = gl.rows.find((r) => r[0].toLowerCase() === e2.toLowerCase());
    if (await glossWrite(glUpsert(gl.rows, [[e2, h2, old ? old[2] : '']]), T('studioGlSaved'))) { gl.en = ''; gl.he = ''; render('none'); }
  }, 'gl-add');
  if (gl.busy || blocked()) add.disabled = true;
  f.append(en, he, add);
  p.append(f, note(T('studioGlNote')));
  if (!gl.rows.length) { p.append(h('div', 'st-empty st-empty-sm', T('studioGlEmpty'))); return; }
  if (gl.rows.length > 8) {
    const sq = h('input', 'st-in'); sq.type = 'search'; sq.placeholder = T('studioGlSearch'); sq.value = gl.q; sq.dataset.k = 'gl-q'; sq.setAttribute('aria-label', T('studioGlSearch'));
    sq.addEventListener('input', () => { gl.q = sq.value; render('none'); });
    p.append(h('div', 'st-gap sm'), sq);
  }
  const qq = gl.q.trim().toLowerCase();
  const rows = gl.rows.filter((r) => !qq || r[0].toLowerCase().includes(qq) || r[1].includes(gl.q.trim())).sort((a, b) => a[0].localeCompare(b[0]));
  p.append(secT(T('studioGlN', { n: gl.rows.length })), rows.length ? list(...rows.map(glRow)) : h('div', 'st-empty st-empty-sm', T('studioGlNone')));
}
/* דף העבודה: כמה מונחים מהמילון שימשו, ומונחים חדשים שנקבעו בעבודה — כל אחד ב־+ או "להוסיף הכל" */
function glossJobCard(g) {
  if (gl.st === '' && store.drive && store.drive.connected && g.s.length) setTimeout(() => glossLoad(), 0);
  const fresh = gl.st === 'ok' ? g.s.filter((x) => !glHas(x[0])) : g.s;
  if (!g.u && !fresh.length) return [];
  const card = h('div', 'st-twcard st-glc');
  card.dataset.k = 'gloss';
  if (g.u) card.append(h('p', 'st-perm-b', T('studioGlUsed', { n: g.u })));
  if (fresh.length) {
    card.append(h('b', 'st-glh', T('studioGlNewT')));
    for (const x of fresh.slice(0, 12)) {
      const r = h('div', 'st-row st-glr');
      const l = h('span', 'st-l');
      const en = h('b'); const eb = h('bdi', null, x[0]); eb.dir = 'ltr'; en.append(eb);
      const he = h('small', null, x[1]); he.dir = 'auto';
      l.append(en, he);
      const b = btn('st-mini tint', null, () => glossWrite(glUpsert(gl.rows, [[x[0], x[1], '']]), T('studioGlAdded')), 'gla:' + x[0].toLowerCase());
      b.append(ico('plus')); b.setAttribute('aria-label', T('studioGlAdd'));
      if (gl.st !== 'ok' || gl.busy || blocked()) b.disabled = true;
      r.append(l, b);
      card.append(r);
    }
    if (fresh.length > 1) {
      const all = btn('st-btn ghost wide', T('studioGlAddAll', { n: fresh.length }), () => glossWrite(glUpsert(gl.rows, fresh.map((x) => [x[0], x[1], ''])), T('studioGlAdded')), 'gl-all');
      if (gl.st !== 'ok' || gl.busy || blocked()) all.disabled = true;
      card.append(all);
    }
    if (gl.st === 'err') card.append(h('small', 'st-muted', T('studioGlErr')));
  }
  return [secT(T('studioGlJobT')), card];
}
function qualityCard(q, ij, jd, jm) {
  if (!q && !ij && !jd) return [];
  const card = h('div', 'st-twcard st-qc');
  card.dataset.k = 'quality';
  if (q) {
    const head = h('div', 'st-qh');
    head.append(h('b', 'st-qs', String(q.s)), h('span', 'st-l', T('studioQOf', { n: q.n })), pill(q.s >= Q_PASS ? 'g' : 'h', q.s >= Q_PASS ? T('studioQPass') : T('studioQFail')));
    card.append(head);
    for (const x of q.m) {
      const r = h('div', 'st-perm-r ' + (x.b ? 'n' : 'y'));
      const i = h('i'); i.append(ico(x.b ? 'x' : 'check'));
      const l = h('span', 'st-l'); l.append(qName(x.k));
      if (x.b && x.k !== 'chk') l.append(h('small', null, T('studioQBad', { n: x.b })));
      r.append(i, l, h('span', 'st-qp', ltr(x.g + '/' + x.w)));
      r.dataset.k = 'q:' + x.k;
      card.append(r);
    }
  }
  if (jd) {
    // v375: שופט האיכות — ציון מהמדגם, איזה מודל שפט (כל ממשק AI מראה מי ענה), והבעיות לפי סוג
    const r = h('div', 'st-row st-jg');
    const l = h('span', 'st-l');
    const iss = Object.keys(jd.c).map((k) => jgName(k) + ' ' + jd.c[k]).join(' · ');
    const sm = h('small');
    if (jm) sm.append(h('bdi', null, jm), ' · ');
    sm.append(T('studioJgOf', { n: jd.n, a: jd.a }) + ' · ' + (iss || T('studioJgNone')));
    l.append(h('b', null, T('studioJgT')), sm);
    r.append(l, h('span', 'st-qp', ltr(jd.s + '/100')));
    r.dataset.k = 'q:jg';
    card.append(r);
  }
  if (ij) card.append(h('p', 'st-perm-b', T('studioQInj', { n: ij.n })));
  return [secT(T('studioQT')), card];
}
function costCard(cv, tr) {
  const rows = cv.rows.map((r) => {
    const row = h('div', 'st-row st-cost' + (r.off ? ' off-model' : ''));
    const l = h('span', 'st-l');
    l.append(h('b', null, costLabel(r.k) + (r.nth ? ' ' + r.nth : '')));
    const sm = h('small');
    sm.append(h('bdi', null, r.model), ' · ' + T('studioCostTok', { n: fmtTok(r.tok) }));
    if (r.open) { sm.append(' · ' + T('studioCostOpen') + ' '); sm.append(r.open.usd == null ? T('studioCostTok', { n: fmtTok(r.open.tok) }) : usdEl(r.open.usd)); }
    if (r.usd == null) sm.append(' · ' + T('studioCostNoPrice'));
    const ta = tr && tr.a[r.k];   // v373: עקיבה — בשורה הראשונה של כל סוכן (לא כרטיס נפרד)
    if (ta && r.nth <= 1) sm.append(' · ' + T('studioTrActs', { n: ta.n }) + (ta.s >= 60 ? ' · ' + fmtShort(ta.s) : ''));
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
  out.push(list(...rows, tot));
  if (tr && tr.g.length) {
    // v373: עקיבה — הפעולות הנפוצות (מקופל: פרטים לפי הצורך)
    const tot2 = Object.values(tr.a).reduce((x, a) => ({ n: x.n + a.n, e: x.e + a.e }), { n: 0, e: 0 });
    const det = h('details', 'st-details st-dig');
    det.append(h('summary', null, T('studioTrT', { n: tot2.n }) + (tot2.e ? ' · ' + (tot2.e === 1 ? T('studioTrErr1') : T('studioTrErrs', { n: tot2.e })) : '')), list(...tr.g.map(([k, n, e]) => {
      const r = h('div', 'st-row');
      const lb = h('bdi', null, k.replace(/^vt:/, 'vt · ').replace(/^job:/, 'job.py · '));
      const l = h('span', 'st-l'); const b = h('b'); b.append(lb); l.append(b);
      if (e) l.append(h('small', 'st-neg', e === 1 ? T('studioTrErr1') : T('studioTrErrs', { n: e })));
      r.append(l, h('span', 'st-v', ltr(n + '×')));
      r.dataset.k = 'tr:' + k;
      return r;
    })));
    out.push(det);
  }
  out.push(note(T('studioCostNote')));
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
  const hero = h('div', 'st-twhero');
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
  const ix = ui.inc && ui.inc.list.find((x) => x.j === rec.id);   // v371: התקלה של העבודה — שורה אחת, הפרטים בדף התקלה
  if (ix) p.append(list(incRow(ix, true)));

  // מה קורה עכשיו — משפט אחד + דוגמה חיה
  const nowc = h('div', 'st-nowc');
  const nic = h('span', 'st-nowic');
  nic.append(ico(ph0 === 'wait' ? (run0 && run0.wait === 'wifi' ? 'wifi' : 'cloud') : ph0 === 'error' || ph0 === 'failed' && !recovering(rec) ? 'alert' : ph0 === 'failed' ? 'pause' : ph0 === 'need' || ph0 === 'paused' || ph0 === 'stuck' ? 'pause' : 'up'));
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
  // 10/10/2026: עבודה שהסתיימה — התוצרים עצמם במקום כרטיס "התרגום מוכן!" שני (הראש כבר אומר את זה);
  // עד עכשיו הקישורים היו רק בתוך "פרטים טכניים" המקופלים
  const outs = ph0 === 'done' ? ((rec.srv && rec.srv.out) || []) : [];
  if (outs.length) {
    p.append(secT(T('studioSecResults')), list(...outs.map((o) => rowExt({ href: 'https://drive.google.com/file/d/' + o.id + '/view',
      tile: tile(o.k === 'srt' ? 'globe' : 'film', o.k === 'srt' ? 'blue' : 'green'), label: outShort(o.k), sub: o.size ? fmtSize(o.size) : '', k: 'out:' + o.k })),
    rec.up.folder ? rowExt({ href: 'https://drive.google.com/drive/folders/' + rec.up.folder, tile: tile('cloud', 'teal'), label: T('studioOpenDrive'), k: 'drive-folder' }) : null,
    btn('st-row st-act', T('studioRcpt'), () => shareReceipt(rec), 'receipt')));   // שלב 4: קבלה
  } else if (!quiet && !qaPending(rec) && !tstop) p.append(nowc);   // כרטיס העצירה כבר אומר מה קרה   // שאלה פתוחה — כרטיס השאלה הוא "מה קורה עכשיו"
  // פעולה לפי המצב: בחירה חוזרת / המשך / נסיון חוזר / התחלה
  const acts = [];
  if (ph0 === 'need') acts.push(btn('st-btn wide', T('studioRepickBtn'), () => repickFor(id), 'repick'));
  else if (ph0 === 'paused' || ph0 === 'error') acts.push(btn('st-btn wide', ph0 === 'error' ? T('studioRetry') : T('studioResume'), () => resumeJob(id, true), 'resume'));
  else if (ph0 === 'ready' && rec.up.wait === 'conn_missing') acts.push(btn('st-btn wide', T('studioConnectNow'), () => go('settings'), 'connect-now'));
  // v367: מתג החירום פעיל — "להחזיר" במסך המגדל; מצב מעל המקסימום — "להתחיל בכל זאת"
  else if (ph0 === 'ready' && rec.up.wait === 'halted' && ui.halt) acts.push(btn('st-btn wide', T('studioHaltGo'), () => go('tower'), 'halt-go'));
  else if (ph0 === 'ready' && rec.up.wait === 'rule_mode') acts.push(btn('st-btn wide', T('studioStartAnyway'), () => { rec.up.wait = ''; tryStart(id, true); }, 'start-anyway'));
  else if (ph0 === 'ready' && rec.up.wait === 'major') acts.push(btn('st-btn wide', T('studioStartAnyway'), () => { rec.up.wait = ''; tryStart(id, false, true); }, 'start-major'));   // v371
  else if (ph0 === 'ready' && ui.kinds.includes('tr') && rec.up.wait !== '') acts.push(btn('st-btn wide', T('studioStartNow'), () => { rec.up.wait = ''; tryStart(id); }, 'start-now'));
  else if (recovering(rec)) {
    // v368: תקלה חולפת — ממשיכה לבד בסוף החלון; אפשר להקדים, או לבטל את ההמשך האוטומטי
    acts.push(btn('st-btn wide', ui.resuming === id ? T('studioResuming') : T('studioRecGo'), () => resumeSrv(id), 'resume-srv'),
      btn('st-btn ghost wide', T('studioRecStop'), () => stopRecover(id), 'rec-stop'));
  }
  else if (canResume(rec)) {
    // v361: "המשך מאותה נקודה" — Claude מוריד את נקודת השמירה האחרונה וממשיך ממנה (בלי לתמלל ולתרגם מחדש)
    const ck = rec.srv.ck;
    acts.push(btn('st-btn wide', ui.resuming === id ? T('studioResuming') : ck ? T('studioResumeCk') : T('studioRetryAll'), () => resumeSrv(id), 'resume-srv'));
    // v376: ספר ההפעלה "מצב זול יותר" — משנה את התוצאה, ולכן רק באישור שלך
    const cm = costStop(rec.srv) ? cheaperModes(rec.spec.mode)[0] : '';
    if (cm && !ui.resuming) acts.push(btn('st-btn ghost wide', T('studioCheapGo', { m: modeShort(modeById(cm)) }), () => {
      if (typeof askConfirm === 'function') askConfirm(T('studioCheapQ', { m: modeName(modeById(cm)) }), () => resumeSrv(id, false, false, cm), { ok: T('studioCheapOk') });
      else resumeSrv(id, false, false, cm);
    }, 'resume-cheap'));
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
  if (rec.srv && rec.srv.sla) p.append(...slaCard(rec.srv.sla));   // v377: יעד זמן ותקציב

  if (rec.srv) {   // v374: איכות הכתוביות + שומר ההזרקות · v375: שופט האיכות (והמודל שלו — משורת העלות)
    const jr = (rec.srv.use || []).find((r) => r.k === 'jg');
    p.append(...qualityCard(rec.srv.q, rec.srv.ij, rec.srv.jd, jr ? modelLabel(jr.m) : ''));
  }
  if (rec.srv && rec.srv.gl) p.append(...glossJobCard(rec.srv.gl));   // v380: מונחים חדשים מהעבודה — למילון שלך, באישור
  // v359: עלות — שורה לכל שלב, עלות הפתיחה של כל סוכן־משנה, סכום כולל
  const cv = rec.srv && rec.srv.use ? costView(rec.srv.use, rec.spec.mode) : null;
  if (cv) p.append(...costCard(cv, rec.srv.tr));

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
    kvRow(T('studioEtaK'), (() => { const n = planFor(rec).n || 0; return n ? T('studioEtaN', { n }) : T('studioEtaPrior'); })()),   // 10/10/2026: על מה הצפי מבוסס
    workerMsgRow(rec, ph0),
  ];
  const links = h('div', 'st-wacts');
  if (!outs.length) for (const o of (rec.srv && rec.srv.out) || []) links.append(extLink('st-wbtn', 'https://drive.google.com/file/d/' + o.id + '/view', outShort(o.k) + (o.size ? ' · ' + fmtSize(o.size) : ''), 'out', 'out:' + o.k));
  if (rec.up.folder && !outs.length) links.append(extLink('st-wbtn', 'https://drive.google.com/drive/folders/' + rec.up.folder, T('studioOpenDrive'), 'out', 'drive-folder'));
  if (rec.srv && rec.srv.sess) links.append(extLink('st-wbtn', rec.srv.sess.url, T('studioOpenSess'), 'out', 'session'));
  if (ph0 === 'done' && rec.srv) links.append(btn('st-wbtn', T('studioBenchCopy'), () => copyText(JSON.stringify(benchData(rec)), T('studioBenchCopied')), 'bench-copy'));   // מאגר המדידות
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
  // שלב 4: התראות לטלפון — מתג אחד; בדיקה כשפועל
  if (ui.push == null) refreshPush().then(() => { if (root && ui.view === 'settings') render('none'); });
  const pst = ui.push || 'off';
  const prow = rowSwitch({ label: T('studioPushT'), sub: ui.pushBusy ? T('studioPushBusy') : pst === 'on' ? T('studioPushOnS') : pst === 'denied' ? T('studioPushDenied') : pst === 'na' ? T('studioPushNa') : T('studioPushOffS'),
    on: pst === 'on', onClick: () => (pst === 'on' ? pushOff() : pushOn()), k: 'push' });
  if (pst === 'na' || pst === 'denied' || ui.pushBusy) prow.disabled = true;
  const prows = [prow];
  if (pst === 'on') prows.push(btn('st-row st-act', T('studioPushTest'), pushTest, 'push-test'));
  p.append(secT(T('studioSecPush')), list(...prows));
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
/* ---------------- שלב 4: התראות לטלפון (Web Push, 10/10/2026) ----------------
   המפתח הציבורי מהשרתון; המנוי של הדפדפן נשלח אליו. ההתראות עצמן — רק סוג האירוע ומזהה העבודה (בלי שם קובץ).
   requestPermission בתוך הנגיעה (פעולה ראשונה אחרי הלחיצה). ui.push: on / off / denied / na */
const PUSH_OK = typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export function b64uBytes(s) {
  const str = String(s || '');
  const b = atob((str + '='.repeat((4 - str.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
}
async function pushSub() {
  try { const reg = await navigator.serviceWorker.ready; return await reg.pushManager.getSubscription(); } catch (e) { return null; }
}
async function refreshPush() {
  if (!PUSH_OK) { ui.push = 'na'; return; }
  const sub = await pushSub();
  ui.push = Notification.permission === 'denied' ? 'denied' : sub && Notification.permission === 'granted' ? 'on' : 'off';
}
async function pushOn() {
  if (ui.pushBusy || !PUSH_OK) return;
  ui.pushBusy = true;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') { ui.push = perm === 'denied' ? 'denied' : 'off'; return; }
    render('none');
    const k = await net.api('push', { act: 'key' });
    if (!k.ok || !k.key) throw new Error(k.error || 'key');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(k.key) });
    const lang = String(document.documentElement.lang || 'he').startsWith('en') ? 'en' : 'he';
    const j = await net.api('push', { act: 'on', sub: sub.toJSON(), lang });
    if (!j.ok) throw new Error(j.error || 'on');
    ui.push = 'on';
    flashSafe(T('studioPushOnDone'));
  } catch (e) {
    flashSafe(T('studioPushErr'));
  } finally {
    ui.pushBusy = false;
    if (root) render('none');
  }
}
async function pushOff() {
  if (ui.pushBusy) return;
  ui.pushBusy = true;
  try {
    const sub = await pushSub();
    if (sub) { await net.api('push', { act: 'off', e: sub.endpoint }); await sub.unsubscribe().catch(() => {}); }
    ui.push = 'off';
  } finally {
    ui.pushBusy = false;
    if (root) render('none');
  }
}
async function pushTest() {
  const j = await net.api('push', { act: 'test' });
  flashSafe(j.ok && j.sent ? T('studioPushTestSent') : T('studioPushErr'));
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
/* "קוד ההקמה" של שרת חדש = התבנית מהריפו (infra/cloud-init.yaml, בלי סודות) + רשומה של /etc/snb/worker.env במקום
   שורת הסימון. נבנה בטלפון בלבד: מפתח Anthropic לא נשלח לשום מקום ולא נשמר (לא ב־store ולא ב־ui) — רק בקוד
   שמועתק ומודבק ב־Hetzner ("Cloud config"). הבדיקה על הצורה מונעת הזרקת YAML דרך השדה. */
export const CI_MARK = '  # SNB_SECRETS';
export function cloudInitWithSecrets(tpl, key, token) {
  key = String(key || '').trim();
  token = String(token || '');
  if (!/^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(key)) return { error: 'key' };
  if (!/^[a-z0-9]{12}-[A-Za-z0-9_-]{43}$/.test(token)) return { error: 'token' };
  const t = String(tpl || '');
  if (!t.startsWith('#cloud-config') || t.split(CI_MARK + '\n').length !== 2) return { error: 'tpl' };
  const entry = '  - path: /etc/snb/worker.env\n    permissions: "0600"\n    owner: root:root\n    content: |\n' +
    '      ANTHROPIC_API_KEY=' + key + '\n      SNB_WORKER_TOKEN=' + token + '\n';
  return { text: t.replace(CI_MARK + '\n', entry) };
}
async function copySetupCode(keyIn) {
  const tpl = await net.cloudInitTemplate();
  const r = cloudInitWithSecrets(tpl, keyIn.value, ui.newToken);
  if (r.error) { flashSafe(r.error === 'key' ? T('studioCiBadKey') : T('studioCiFail')); return; }
  if (await copyText(r.text, T('studioCiCopied'))) keyIn.value = '';
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
/* 10/10/2026 (מאגר המדידות, translator/bench.py): הנתונים המדויקים של עבודה שהסתיימה — להעתקה ולהדבקה לסשן הפיתוח.
   מספרים, מודלים וזמנים בלבד: בלי שם הקובץ, בלי תוכן ובלי מזהים של Drive */
/* שלב 4: קבלה לעבודה שהסתיימה — שורות טקסט לשיתוף/העתקה: מה תורגם, מתי, באיזה מצב, כמה זמן, כמה עלה ואיכות.
   הכל מהרשומה שכבר בטלפון (אותם מספרים של כרטיס העלות ומדד האיכות) — בלי פנייה לרשת */
export function receiptText(rec) {
  const sv = rec && rec.srv;
  if (!sv || sv.state !== 'done') return '';
  const m = modeById(rec.spec.mode), cv = costView(sv.use, rec.spec.mode);
  const tok = cv ? cv.rows.reduce((a, r) => a + r.tok, 0) : 0;
  const wall = sv.ended && rec.created ? Math.max(0, (sv.ended - rec.created) / 1000) : 0;
  const L = [T('studioRcptHead'), fileTitle(rec.spec.name) || T('studioUntitled'), ''];
  const kv = (k, v) => { if (v) L.push(k + ': ' + v); };
  kv(T('studioRcptDone'), sv.ended ? fmtDate(sv.ended) : '');
  kv(T('studioDur'), rec.spec.dur ? fmtDur(rec.spec.dur) : '');
  kv(T('studioSecMode'), modeShort(m));
  kv(T('studioRcptWall'), wall ? fmtDur(wall) : '');
  if (cv) kv(T('studioCostTotal'), fmtUsd(cv.total) + (cv.partial ? '+' : '') + ' · ' + T('studioCostTok', { n: tok.toLocaleString(uiLang()) }));
  if (sv.q && sv.q.s != null) kv(T('studioQT'), sv.q.s + '/100');
  if (sv.jd && sv.jd.s != null) kv(T('studioRcptJudge'), sv.jd.s + '/100');
  kv(T('studioJobId'), rec.id);
  return L.join('\n');
}
async function shareReceipt(rec) {
  const txt = receiptText(rec);
  if (!txt) return;
  try { if (navigator.share) { await navigator.share({ title: T('studioRcpt'), text: txt }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  copyText(txt, T('studioRcptCopied'));
}
export function benchData(rec) {
  const srv = rec.srv || {}, sp = rec.spec || {}, stg = (srv.prog && srv.prog.stg) || {};
  const stages = {};
  for (const k of ['tr', 'al', 'tl', 'rv', 'bn', 'sv']) { const x = stg[k]; if (x && x.s > 0 && x.e > x.s) stages[k] = Math.round((x.e - x.s) / 1000); }
  const models = {}, usd = {}, tok = {}, tokd = {};
  for (const r of srv.use || []) {
    models[r.k] = r.m;
    if (r.usd != null) usd[r.k] = Math.round(r.usd * 1e4) / 1e4;
    tokd[r.k] = { i: r.i || 0, o: r.o || 0, cr: r.cr || 0, cw: (r.c5 || 0) + (r.c1 || 0), n: r.n || 0 };
    tok[r.k] = tokd[r.k].i + tokd[r.k].o + tokd[r.k].cr + tokd[r.k].cw;
  }
  const first = Math.min(...Object.values(stg).map((x) => (x && x.s) || Infinity));
  return { date: new Date(rec.created || Date.now()).toISOString().slice(0, 10), dur_s: sp.dur || 0, engine: srv.eng === 'api' ? 'api' : 'routine',
    mode: sp.mode || '', models, usd, tok, tokd, stages_s: stages,
    wall_s: Number.isFinite(first) && srv.ended > first ? Math.round((srv.ended - first) / 1000) : 0,
    quality: srv.q ? srv.q.s : null, cues: srv.q ? srv.q.n : null, judge: srv.jd ? srv.jd.s : null, state: srv.state || '' };
}
/* ת2 (10/10/2026): בידוד קופסת העובד — gVisor, או רגיל עם הסיבה (snb_runtime במארח) */
function isoTxt(hb) {
  if (hb.iso === 'g') return T('studioIsoG');
  switch (hb.iw) {
    case 'mem': return T('studioIsoMem');
    case 'missing': return T('studioIsoMissing');
    case 'selftest': return T('studioIsoSelftest');
    case 'manual': return T('studioIsoManual');
    default: return T('studioIsoR');
  }
}
function pageServer(p) {
  p.append(navBar({ back: T('studioTwT') }), large(T('studioSrvT')), h('p', 'st-lede', T('studioSrvLede')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const a = ui.api;
  if (a) p.append(secT(T('studioApiMonthT')), list(kvRow(T('studioApiMonth'), T('studioApiOf', { a: fmtUsd(a.month), b: fmtUsd(a.cap) }))));
  if (!a || !a.admin) { p.append(note(a && a.online ? T('studioSrvOnN', { n: a.online }) : T('studioSrvNone'))); return; }
  if (ui.newToken) {
    // קוד ההקמה: מדביקים כאן את מפתח Anthropic (לא נשמר ולא נשלח), מעתיקים, ומדביקים ב־Hetzner ב־Cloud config
    const keyIn = h('input', 'st-in'); keyIn.type = 'password'; keyIn.dir = 'ltr'; keyIn.autocomplete = 'off'; keyIn.spellcheck = false;
    keyIn.placeholder = 'sk-ant-…'; keyIn.setAttribute('aria-label', T('studioCiKey'));
    const lab = h('label', 'st-flab'); lab.append(h('span', null, T('studioCiKey')), keyIn);
    const cb = btn('st-btn wide in-card', T('studioCiCopy'), () => copySetupCode(keyIn), 'srv-ci');
    cb.disabled = blocked();
    const box = h('div', 'st-tok st-ci'); box.append(lab, cb);
    p.append(secT(T('studioCiT')), list(box), note(T('studioCiNote')));
    // הטוקן לבד — רק להחלפת מפתחות בשרת קיים (snb-setup); מקופל
    const tk = h('div', 'st-tok'); tk.append(copyBox(ui.newToken, T('studioCopy'), 'srv-token'));
    const more = h('details', 'st-details'); more.append(h('summary', null, T('studioSrvNewT')), list(tk), note(T('studioSrvTokNote')));
    p.append(more);
  }
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
    if (sv.hb && sv.hb.iso && stt !== 'off') l.append(h('small', null, isoTxt(sv.hb) + (sv.hb.al === 'o' ? ' · ' + T('studioAlOnnx') : '')));   // ת2: בידוד הקופסה · שלב 4.1: היישור
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
  const one = (rec) => { const run = runs.get(rec.id); return rec.id + ':' + jobPhase(rec, run) + ':' + modelFor(rec).stages.map((s) => s.state[0]).join('') + ':' + (rec.up.v.done ? 1 : 0) + (rec.up.wait || '') + (rec.srv && rec.srv.use ? 'u' : '') + (rec.srv && rec.srv.qa ? rec.srv.qa.id + (rec.srv.qa.a ? 'a' : '') : '') + (rec.srv && rec.srv.ck ? rec.srv.ck.s : '') + (ui.resuming === rec.id ? 'r' : '') + (rec.srv && rec.srv.tw ? rec.srv.tw.lv + rec.srv.tw.x : '') + (recovering(rec) ? 'R' : ''); };
  const incK = (j) => { const x = ui.inc && ui.inc.list.find((y) => y.j === j); return x ? x.no + x.st + x.s : ''; };
  if (ui.view === 'job') { const r = jobRec(ui.param); return 'job|' + (r ? one(r) : '') + '|' + ui.access + '|' + ui.halt + '|' + ui.kinds.join() + (r && towerStopped(r) && ui.fb ? '|' + ui.fb.filter((e) => e.fix).map((e) => e.fp).join() : '') + '|' + incK(ui.param); }
  if (ui.view === 'home') return 'home|' + store.jobs.map(one).join(',') + '|' + store.drafts.length + '|' + ui.access + '|' + (store.conn ? 1 : 0) + '|' + ui.halt + '|' + urgentAlerts().map((a) => a.id).join() + '|' + (majorOn(ui.inc) ? ui.inc.mi.no + ':' + ui.inc.mi.n : '');
  if (ui.view === 'tower') return 'tower|' + store.jobs.map(one).join(',') + '|' + ui.access + '|' + JSON.stringify(ui.norm) + JSON.stringify(ui.fb) + JSON.stringify(ui.ops) + JSON.stringify(ui.rl) + ui.halt + '|' + (ui.alAll ? 1 : 0) + JSON.stringify(ui.inc) + (ui.incAll ? 1 : 0) + JSON.stringify(ui.ag) + JSON.stringify(ui.pb) + (ui.pbAll ? 1 : 0) + JSON.stringify(ui.rb) + JSON.stringify(ui.sc);
  if (ui.view === 'alert') return 'alert|' + ui.param + '|' + ui.access + '|' + JSON.stringify(ui.ops) + (ui.alTab || 'd') + ui.muPick + ackBusy + JSON.stringify(ui.fb) + store.jobs.map((r) => r.id + (r.srv && r.srv.fr ? r.srv.fr.s : '')).join();
  if (ui.view === 'agents') return 'agents|' + ui.access + '|' + JSON.stringify(ui.ag);
  if (ui.view === 'scan') return 'scan|' + ui.access + '|' + JSON.stringify(ui.sc) + scanBusy + (ui.scOk ? 1 : 0);   // v378
  if (ui.view === 'value') return 'value|' + ui.access + '|' + JSON.stringify(ui.va) + (priceBusy ? 1 : 0);   // v377
  if (ui.view === 'prob') return 'prob|' + ui.param + '|' + ui.access + '|' + JSON.stringify(ui.pb) + JSON.stringify(ui.inc) + (fixBusy ? 1 : 0);   // v376
  if (ui.view === 'inc') return 'inc|' + ui.param + '|' + ui.access + '|' + (pirBusy ? 1 : 0) + JSON.stringify(ui.inc) + ui.incTab + JSON.stringify(ui.fb) + (ui.resuming || '') + store.jobs.map((r) => r.id + (canResume(r) ? 'r' : '')).join();
  if (ui.view === 'server') return 'server|' + ui.access + '|' + JSON.stringify(ui.api) + JSON.stringify(ui.servers) + ui.srvQueue + '|' + (ui.newToken ? 1 : 0) + ui.srvBusy;
  if (ui.view === 'rules') return 'rules|' + ui.access + '|' + JSON.stringify(ui.rl) + ui.fm + gl.st + gl.rows.length;
  if (ui.view === 'gloss') return 'gloss|' + ui.access + '|' + gl.st + (gl.busy ? 1 : 0) + JSON.stringify(gl.rows) + gl.q + '|' + JSON.stringify(store.drive);   // v380
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
  else if (ui.view === 'alert') pageAlert(p);
  else if (ui.view === 'inc') pageInc(p);
  else if (ui.view === 'agents') pageAgents(p);
  else if (ui.view === 'value') pageValue(p);   // v377
  else if (ui.view === 'scan') pageScan(p);   // v378
  else if (ui.view === 'prob') pageProb(p);   // v376
  else if (ui.view === 'rules') pageRules(p);
  else if (ui.view === 'gloss') pageGloss(p);   // v380
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
  else if (ui.view === 'rules' || ui.view === 'alert') refreshStatus(true);
  else if (ui.view === 'gloss') { refreshStatus(true); glossLoad(true); }   // v380: המילון — תמיד הגרסה העדכנית מ־Drive
  else if (ui.view === 'inc') { refreshStatus(true); refreshJobs(true); }
  else if (ui.view === 'agents') refreshJobs(true);
  else if (ui.view === 'value') refreshJobs(true);   // v377
  else if (ui.view === 'scan') { if (!ui.sc || Date.now() - ui.sc.at > SCAN_FRESH) runScan(); else refreshStatus(true); }   // v378: סריקה ישנה — סורקים שוב
  else if (ui.view === 'prob') { refreshStatus(true); refreshJobs(true); }   // v376
  else if (ui.view === 'server') { refreshStatus(true); refreshServers(); }
  else if (ui.view === 'job') { pollNow(); const r = jobRec(ui.param); if (r && towerStopped(r)) refreshStatus(); }   // v364: תיקון מוכר בכרטיס העצירה
}
/* מעקב אחרי עבודה פתוחה: כל 4 שניות כש־Claude עובד, לאט כשמחכים, בכלל לא כשהסתיימה או כשהמסך כבוי */
let pollT = 0;
function schedulePoll() {
  clearTimeout(pollT); pollT = 0;
  if (!root || document.hidden) return;
  let ms = 0;
  // v368: עבודה שמתאוששת — בודקים שוב בסוף החלון (אז השרתון ממשיך אותה)
  const recMs = (list) => { const t = Math.min(...list.filter(recovering).map((r) => r.srv.rw)); return Number.isFinite(t) ? Math.max(2000, Math.min(60000, t - Date.now() + 1500)) : 0; };
  if (ui.view === 'job') { const r = jobRec(ui.param), st = r && r.srv ? r.srv.state : 'new'; ms = st === 'queued' || st === 'running' ? 4000 : st === 'new' && r && r.up.started ? 15000 : r ? recMs([r]) : 0; }
  else if (ui.view === 'home') ms = store.jobs.some((r) => r.srv && (r.srv.state === 'queued' || r.srv.state === 'running')) ? 15000 : recMs(store.jobs);
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
  const jobLink = opt && /^j[A-Za-z0-9_-]{20}$/.test(String(opt.job || '')) ? opt.job : '';   // שלב 4: מההתראה
  if (root) { if (jobLink && jobRec(jobLink)) go('job', jobLink); return; }
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
  refreshStatus(true);
  const jobs0 = refreshJobs(true);
  // מההתראה: לדף העבודה — מיד אם היא כבר בטלפון, אחרת אחרי שהרשימה מהשרתון מגיעה
  if (jobLink) { if (jobRec(jobLink)) go('job', jobLink); else Promise.resolve(jobs0).then(() => { if (root && jobRec(jobLink)) go('job', jobLink); }); }
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
