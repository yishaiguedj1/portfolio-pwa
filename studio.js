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
import { STAGES, createNet, probeVideo, extractAudio, uploadBoth, stageEstimates, progressModel, monoPct, planFrom, Q_DEF, glClean, glUpsert, GL_MAX, parseSrt, goldCompare, GOLD_REF_MAX, inspectSource, QUIET_DB, subsPlan, kaPlan, kaMdlOk, lyrGuess } from './studionet.js';
import { createBackup, waitOAuthCode } from './libbackup.js';
// ת4: מזהים של R2 (העלאה ותוצרים בעבודה במצב שרת)
import { isR2Folder, isR2Id } from './studiostore.js';
import { bgEligible, bgUpload, bgIdOf, bgDb, bgUpOk } from './studiobg.js';
import { createPlayer, normCues, issuesList, fmtT, normLadder, normAlt, normPq, normTrackPref, normChapters, normSty, STY_COLORS, STY_Y } from './studioplay.js';
import { createSubsEditor, toSrt, toCuesJson, toVtt, toTtml, toStl, termIssues, flagIndex, normMeta, createTimeline, editDiff, editStats, importSubs } from './studiosubs.js';
import { listTracks, extractTracks, cuesToFile, lang2 } from './studiotracks.js';
import { createEdlEditor, normEdl, edlPre, edlDur, outDur, silenceSegs, removeRange, addRange, segAt, intersectSegs, cutFillers, normOv, OV_T_MAX, OV_LG_MAX, OV_POS, previewEdl, PV_LEN } from './studioedl.js';
import { AI_KINDS, aiRow, normQueue, aiPrompt, parseAnswer, normItems, applyItems, aiEstimate, AI_MAX_ROWS, AI_NOTE_MAX, TEXT_KINDS, AI_T_ROWS, aiTRow, parseText, parseRanges, parseChapters } from './studioai.js';

const T = (k, v) => (typeof t === 'function' ? t(k, v) : k);
export const LS_STUDIO = 'pwa_studio_v1';

/* מצבי התרגום — המספרים מהמבחן מול המתרגם האנושי של TED (נספח ה׳ בתוכנית). q = איכות, u = שימוש במנוי (מתוך 5,
   לפי הצפוי לשעה — NORM_DEF בשרתון), min = הערכת זמן לשעת ראיון בדקות.
   10/10/2026 (בקשת המשתמש): נוסף Haiku 5.5 (עוד לא נבדק במבחן, לכן q = 1 עד שיימדד); Opus High/Max הוסרו.
   15/10/2026 (בקשת המשתמש): לכל המשתמשים רק שני מצבים (tier) — "רגיל" = Haiku High (ברירת המחדל) ו"ביצועים" = Sonnet Medium.
   כל השאר — רק למנהל ולמי שברשימת "כל המודלים" במרכז הניהול (ui.mf מהשרתון, שאוכף — modeOk). נוסף Sonnet Low לבדיקות */
export const MODES = [
  { id: 'opus-medium', fam: 'opus', effort: 'Medium', q: 4, u: 5, min: 105 },
  { id: 'sonnet-medium', fam: 'sonnet', effort: 'Medium', q: 2, u: 3, min: 85 },
  { id: 'sonnet-high', fam: 'sonnet', effort: 'High', q: 3, u: 4, min: 95 },
  { id: 'sonnet-low', fam: 'sonnet', effort: 'Low', q: 1, u: 2, min: 80 },   // 15/10: עוד לא נבדק — הערכה עד שיימדד
  // Haiku: min מהמדידות — זמן קבוע (תמלול, יישור, צריבה ‎~52 דק׳ לשעה) + חלק ה־LLM (Opus ‎~53) × המהירות היחסית
  { id: 'haiku-high', fam: 'haiku', effort: 'High', q: 1, u: 1, min: 76, tier: 'perf' },
  { id: 'haiku-medium', fam: 'haiku', effort: 'Medium', q: 1, u: 1, min: 74, tier: 'std' },   // 25/10/2026: "רגיל" — ברירת המחדל
];
// 25/10/2026 (בקשת המשתמש): "רגיל" = Haiku Medium (ברירת המחדל), "ביצועים" = Haiku High
export const DEFAULT_MODE = 'haiku-medium';
export const PUBLIC_MODES = ['haiku-medium', 'haiku-high'];   // **= PUBLIC_MODES בשרתון** (lib/studio.js)
export const modeOk = (id, full) => !!full || PUBLIC_MODES.includes(id);
/* 25/10/2026 (בקשת המשתמש): למשתמשים רק "השרת של המערכת" — המנוי שלי והעתק־הדבק רק למנהל / "כל המודלים" (ui.mf).
   **= engOk בשרתון** — השרתון אוכף, כאן רק מה שמוצג ונשלח */
export const connFor = (conn, full) => (full ? conn : 'api');
/* המצב שהמשתמש יכול להשתמש בו: מצב סגור (טיוטה / הגדרה ישנה, או שהוסר מהרשימה) → ברירת המחדל */
export const modeFor = (id, full) => { const k = modeNow(id); return modeOk(k, full) ? k : DEFAULT_MODE; };
// מצבים שהוסרו → המצב הקיים הקרוב (= LEGACY_MODES בשרתון ובעובד): עבודה / טיוטה / חוק ישנים ממשיכים לעבוד
// 11/10/2026 (בקשת המשתמש): Haiku Medium יצא — המחיר כמו High (‎$0.04 מול $0.045 לעבודה של 5 דק׳), אז נשאר רק High
export const LEGACY_MODES = { 'opus-high': 'opus-medium', 'opus-max': 'opus-medium' };   // 20/10/2026: Haiku Medium חזר כמצב (לא ממופה יותר ל־High)
export const modeNow = (id) => (MODES.some((m) => m.id === id) ? id : LEGACY_MODES[id] || DEFAULT_MODE);
/* שפות: התמלול (Parakeet v2/v3, ivrit.ai, Omnilingual) מכסה גם שפות שלא ברשימה — זו רשימת הבחירה המהירה */
export const SOURCE_LANGS = ['en', 'he', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko'];
/* הסקירה (10/10/2026): מה שהעובד יודע היום (= LANG_READY בשרתון). השאר מוצג "בקרוב" ולא נבחר — לא נכשלים אחרי ההעלאה */
export const LANG_READY = { from: ['auto', 'en'], to: ['he'] };
export const langReady = (from, to) => LANG_READY.from.includes(from) && Array.isArray(to) && to.length > 0 && to.every((c) => LANG_READY.to.includes(c));
/* מ1: כל סוגי התוצרים (= OUT_KINDS בשרתון). MAIN — שורות ב"התוצרים"; השאר קבצי עזר (הנגן, העורך) */
export const OUT_ALL = ['compact', 'same', 'mkv', 'srt', 'cues', 'vtt', 'ass', 'en', 'small', 'aiout', 'meta', 'thumb', 'inst', 'lrc', 'elrc'];   // סבב 6: meta — לציר בעורך; סבב 7: thumb — תמונה ממוזערת
export const OUT_MAIN = ['compact', 'same', 'mkv', 'small', 'srt', 'en', 'inst', 'lrc', 'elrc'];   // 26/10/2026: קריוקי — הליווי ו־LRC
export const TARGET_LANGS = ['he', 'en', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko', 'am'];
const QUICK_LANGS = ['he', 'en', 'ar', 'ru', 'es', 'fr'];
export const STYLES = ['bold', 'classic', 'karaoke'];
export const OUTS = ['same', 'compact', 'mkv', 'small'];   // סבב 8: small = עותק קטן לוואטסאפ (עד 28MB) גם בעבודה עצמה
export const CONNS = ['sub', 'copy', 'api'];
export const CAPS = [5, 10, 20, 50];   // מצב API: תקרה לעבודה אחת ($) — השרתון מגביל גם לפי מה שנשאר החודש
const TERMS_MAX = 1000;
const SMALL_MB = 28;          // סבב 8: יעד העותק לוואטסאפ — small_copy ב־vt/render.py
const COMPACT_RATIO = 0.53;   // "דחוס" ≈ חצי מהמקור (נמדד על הראיון של אקמן)
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const FID_RE = /^[A-Za-z0-9_-]{10,100}$/;
const UPURI_RE = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/;   // כתובת העלאה של Drive — לא שום כתובת אחרת
const R2_UPID_RE = /^[A-Za-z0-9+/=._~-]{8,600}$/;   // ת4: מזהה של העלאה בחלקים ב־R2 (לא כתובת — הקישורים מגיעים מהשרתון)
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
  return { mode: DEFAULT_MODE, to: ['he'], out: { same: true, compact: false, mkv: false }, style: 'bold', conn: 'sub', wifi: false, cap: 10, mv: 4, pq: 'src' };   // pq: איכות הצפייה בנגן (ברירת מחדל = המקור)
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
  s.pq = normPq(o.pq);
  s.pt = normTrackPref(o.pt);   // 23/10/2026: הקול והכתוביות שנבחרו ידנית בנגן (ריק = אוטומטי)
  if (Number.isFinite(+o.op1) && +o.op1 > 0) s.op1 = Math.floor(+o.op1);
  if (o.pno === 1) s.pno = 1;   // 27/10/2026: כיבית את ההתראות במכשיר הזה — לא מדליקים אותן שוב אוטומטית (pushAuto)
  // 26/10/2026: כמה פעמים העלאה ברקע נתקעה (מהשנייה — לא מנסים חודש). bgSt של 2.52.2 נספר לפי Chrome בלבד, שבאנדרואיד לא
  // מדווח — "תקיעות" שלא היו; לכן נזרק, ו־bgNo שהוא קבע (bgSt ≥ 2) נמחק. מעכשיו הספירה לפי השרתון — bgS2
  if (Number.isFinite(+o.bgS2) && +o.bgS2 > 0) s.bgS2 = Math.min(9, Math.floor(+o.bgS2));
  const stale = Number(o.bgSt) >= 2;
  if (!stale && Number.isFinite(+o.bgNo) && +o.bgNo > 0) s.bgNo = Math.floor(+o.bgNo);   // 23/10/2026: מתי הדפדפן סירב להעלאה ברקע (ננסה שוב אחרי חודש)   // מתי Google סירב לבורר במסך מלא (ננסה שוב אחרי חודש)
  if (Number.isFinite(+o.bgSl) && +o.bgSl > 0) s.bgSl = Math.floor(+o.bgSl);   // 28/10/2026: מתי העלאה ברקע הייתה איטית (ACCOUNT_KEYS — pwa_studio_v1 כולו)
  if (o.ky && typeof o.ky === 'object') s.ky = normKy(o.ky);   // 31/10/2026: עיצוב הקריוקי (ברירת המחדל לשיר הבא)
  const sty = normSty(o.sty); if (sty) s.sty = sty;   // סבב 5: עיצוב הכתוביות האחרון (ברירת המחדל להפקה הבאה)
  if (o.lg && typeof o.lg === 'object') { const ov = normOv({ lg: o.lg.d, lp: o.lg.p, ls: o.lg.s }); if (ov) s.lg = { d: ov.lg, p: ov.lp, s: ov.ls }; }   // סבב 7: הלוגו שלך
  return s;
}
/* מצב "API של המערכת" מהשרתון (status): התקציב החודשי, כמה שרתים מחוברים, והאם אתה המנהל */
export function normApi(a) {
  if (!a || typeof a !== 'object') return null;
  const n = (x) => (Number.isFinite(+x) && +x >= 0 ? +x : 0);
  return { month: n(a.month), cap: n(a.cap), online: Math.floor(n(a.online)), servers: Math.floor(n(a.servers)), admin: a.admin === true, ka: a.ka === true, nc: a.nc === true };   // nc — המנהל: בלי תקרה חודשית של המערכת (29/10/2026)
}
/* השרתים (srvList, למנהל) — רק מה שמוצג; השם טקסט בלבד */
export function normServers(list) {
  if (!Array.isArray(list)) return null;
  const n = (x) => (Number.isFinite(+x) ? +x : null);
  return list.slice(0, 10).filter((x) => x && /^[a-z0-9]{12}$/.test(String(x.id || ''))).map((x) => ({
    id: x.id, name: String(x.name || x.id).slice(0, 40), seen: Math.max(0, n(x.seen) || 0), ba: Math.max(0, n(x.ba) || 0), online: x.online === true, paused: x.paused === true,
    hb: x.hb && typeof x.hb === 'object' ? { v: /^[0-9a-f]{7,12}$|^dev$/.test(String(x.hb.v || '')) ? x.hb.v : '', disk: n(x.hb.disk), mem: n(x.hb.mem), free: n(x.hb.free),
      iso: x.hb.iso === 'g' || x.hb.iso === 'r' ? x.hb.iso : '', iw: ['mem', 'missing', 'selftest', 'manual'].includes(x.hb.iw) ? x.hb.iw : '',
      al: x.hb.al === 'o' || x.hb.al === 't' ? x.hb.al : '',
      ev: Array.isArray(x.hb.ev) ? x.hb.ev.slice(-12).filter((e) => Array.isArray(e) && e.length === 2 && Number.isFinite(+e[0]) && /^[a-z]{2,8}$/.test(String(e[1]))).map((e) => [+e[0], String(e[1])]) : [] } : null,   // ת7: יומן השרת
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
    ...(d.drive && FID_RE.test(String(d.drive.id || '')) ? { drive: Object.assign({ id: d.drive.id, dur: Math.max(0, Math.floor(Number(d.drive.dur) || 0)) }, d.drive.bx === true ? { bx: true } : {}) } : {}),   // מקור מ־Drive (נבחר ב־Picker)
  };
}
const num = (x) => Math.max(0, Math.floor(Number(x) || 0));
/* סבב 10: העתק־הדבק — הבקשה הנוכחית (מספר, תפקיד, קובץ הבקשה) והאם כבר הודבקה תשובה. = cpView בשרתון */
export const CP_ROLES = ['main', 'tl', 'rv', 'jg'], CP_TEXT_MAX = 2 * 1024 * 1024;
export function normCp(x) {
  if (!x || typeof x !== 'object' || !Number.isInteger(x.n) || x.n < 1 || x.n > 200 || !CP_ROLES.includes(x.r) || !FID_RE.test(String(x.f || ''))) return null;
  return { n: x.n, r: x.r, f: x.f, at: num(x.at), a: x.a === true };
}
/* עבודה (שלב 2): הפרטים ששלחנו לשרתון, מצב ההעלאה בטלפון (כתובות ההעלאה של Drive, כמה עלה) והמצב האחרון מהשרתון */
/* 24/10/2026 — תרגום בטלפון (שלב 1): הסרטון לא עוזב את הטלפון. Studio לאנדרואיד (PhActivity/PhService) בוחר אותו, מחלץ את
   הקול, מודד (ffprobe + השוטים), מעלה רק אותם במפתח של העבודה (op:'phKey'), ובסוף צורב בעצמו (MediaCodec). האתר רק יוצר את
   העבודה ומוסר. pb — מה הטלפון צורב (same / small); הצריבה מדווחת ב־pbn (**normPbn זהה לשרתון**) */
export const PH_BURN = ['same', 'small'];
const PH_PID_RE = /^p[0-9a-f]{16}$/;
export function normPbn(o) {
  if (!o || typeof o !== 'object' || !['run', 'done', 'fail'].includes(o.s)) return null;
  const out = { s: o.s, p: o.s === 'done' ? 1 : Math.max(0, Math.min(1, Number(o.p) || 0)), at: num(o.at) };
  if (o.s === 'fail' && /^[a-z0-9_]{2,32}$/.test(String(o.e || ''))) out.e = o.e;
  if (o.s === 'done' && num(o.sz) > 0) out.sz = num(o.sz);
  return out;
}
/* 25/10/2026 (שלב 2, "הכל בטלפון"): מה הטלפון עושה לפני שהעבודה מתחילה (op:'phProg') — **normPpr זהה לשרתון** */
export const PPR_S = ['models', 'wav', 'asr', 'diar', 'align', 'upw', 'shots', 'upm', 'start', 'err'];
export function normPpr(o) {
  if (!o || typeof o !== 'object' || !PPR_S.includes(o.s)) return null;
  const p = Number(o.p);
  const out = { s: o.s, p: Number.isFinite(p) && p >= 0 ? Math.min(1, Math.round(p * 1000) / 1000) : -1, at: num(o.at) };
  if (o.s === 'err') { if (!/^[a-z0-9_]{2,32}$/.test(String(o.e || ''))) return null; out.e = o.e; }
  return out;
}
/* 29/10/2026: הסרטון עולה לענן מ־Studio לאנדרואיד (spec.vc) — p = 0–1, e = קוד כשנעצר. **normVcp זהה לשרתון** */
export function normVcp(o) {
  if (!o || typeof o !== 'object') return null;
  const p = Number(o.p);
  if (!(Number.isFinite(p) && p >= 0)) return null;
  const out = { p: Math.min(1, Math.round(p * 1000) / 1000), at: num(o.at) };
  if (/^[a-z0-9_]{2,32}$/.test(String(o.e || ''))) out.e = o.e;
  return out;
}
/* ‎#phpick=<pid>.<base64url של JSON> מ־PhActivity (או ‎!<קוד>) → { pid, name, size, dur, w, h } / { e } / null. טהור */
export function parsePhPick(arg) {
  const a = String(arg || '');
  const m = /^!([a-z_]{1,20})$/.exec(a);
  if (m) return { e: m[1] };
  const k = /^(p[0-9a-f]{16})\.([A-Za-z0-9_-]{8,6000})(?:\.([A-Za-z0-9_-]{8,800000}))?$/.exec(a);   // 30/10/2026: מקטע שלישי — הכתוביות שבקובץ (phSubs)
  if (!k) return null;
  let o = null;
  try { o = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(k[2].replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((k[2].length + 3) % 4)), (c) => c.charCodeAt(0)))); } catch (e) { return null; }
  if (!o || o.pid !== k[1]) return null;
  const size = Math.floor(Number(o.size) || 0), dur = Number(o.dur) || 0;
  if (!(size > 0)) return null;
  return { pid: k[1], name: String(o.name || 'video.mp4').replace(/[\u0000-\u001f]/g, '').slice(0, 200) || 'video.mp4', size,
    dur: dur > 0 && dur < 86400 ? dur : 0, w: Math.max(0, Math.floor(Number(o.w) || 0)), h: Math.max(0, Math.floor(Number(o.h) || 0)),
    cap: Math.max(0, Math.min(99, Math.floor(Number(o.cap) || 0))),   // 25/10/2026: מה Studio הזה יודע (PH_CAP_PT = גם שלבי הטקסט)
    oh: /^[0-9a-f]{16}$/.test(String(o.oh || '')) ? o.oh : '', z: k[3] || '' };   // 30/10/2026: טביעת האצבע (osHash) והכתוביות — מהאפליקציה
}
/* 25/10/2026 (שלב 3): Studio לאנדרואיד שיודע להריץ גם את שלבי הטקסט (vt בפייתון של האפליקציה) מדווח cap ≥ 3 בבחירה.
   ישן — בלי pt (אחרת העבודה הייתה מחכה בתור לטלפון שלא יודע לקחת אותה) */
export const PH_CAP_PT = 3;
export const PH_CAP_VC = 4;   // 30/10/2026: Studio שמעלה גם את הסרטון לענן (spec.vc). ישן יותר מתעלם מ־vc — הסרטון נשאר רק בטלפון
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
  if (edlPre(normEdl(sp.edl))) spec.edl = edlPre(normEdl(sp.edl));   // מ4: חיתוך לפני התרגום (הכתוביות על ציר הזמן שאחרי החיתוך)
  if (num(sp.px) >= 0.02 && num(sp.px) <= 16) spec.px = num(sp.px);   // 21/10/2026: פיקסלים לשנייה מול 1080p30 — לצפי
  // 31/10/2026 (הצילום: עבודת קריוקי עם שלבי תרגום, תקציב ועיצוב כתוביות): בלי זה — אחרי רענון / סנכרון מהשרת השיר נהיה
  // "תרגום". המילים עצמן לא נשמרות בטלפון (רק בשרת)
  if (sp.ka === 1) Object.assign(spec, { ka: 1 }, sp.bv === 1 ? { bv: 1 } : {}, num(sp.gv) > 0 ? { gv: Math.min(60, Math.round(num(sp.gv))) } : {});
  if (sp.src === 'subs') { spec.src = 'subs'; spec.sdh = sp.sdh === 'keep' ? 'keep' : 'rm'; spec.out = []; }   // 22/10/2026: קובץ כתוביות קיים
  if (sp.ph === 1) { spec.ph = 1; spec.out = []; if (PH_BURN.includes(sp.pb)) spec.pb = sp.pb; if (sp.pw === 1) spec.pw = 1; if (sp.pw === 1 && sp.pt === 1) spec.pt = 1; }   // pt — שלב 3: גם שלבי הטקסט · pw — שלב 2: גם התמלול והיישור בטלפון   // 24/10/2026: תרגום בטלפון — הצריבה בטלפון
  const u = j.up && typeof j.up === 'object' ? j.up : {};
  const part = (x) => {
    x = x && typeof x === 'object' ? x : {};
    const r2 = x.r2 && typeof x.r2 === 'object' && R2_UPID_RE.test(String(x.r2.up || '')) && FID_RE.test(String(x.r2.id || '')) ? { id: x.r2.id, up: x.r2.up, ps: num(x.r2.ps) } : null;
    return Object.assign({ done: x.done === true, id: FID_RE.test(String(x.id || '')) ? x.id : '', size: num(x.size),
      uri: UPURI_RE.test(String(x.uri || '')) ? String(x.uri).slice(0, 2000) : '', sent: num(x.sent) }, r2 ? { r2 } : {});   // ת4: העלאה ל־R2 שבדרך
  };
  const up = { folder: FID_RE.test(String(u.folder || '')) ? u.folder : '', a: part(u.a), v: part(u.v),
    noAudio: typeof u.noAudio === 'string' ? u.noAudio.slice(0, 20) : '', started: num(u.started),
    wait: typeof u.wait === 'string' ? u.wait.slice(0, 40) : '', wt: num(u.wt), took: num(u.took),   // wt = מתי נדחה (לניסיון החוזר)
    ext: u.ext === true, extReg: u.extReg === true,   // מקור מ־Drive: בלי העלאה; extReg = נרשם בשרתון
    bx: u.bx === true,   // 26/10/2026: נבחר ברשימת הקבצים של Studio (השרתון מאמת בחיבור של הרשימה)
    link: u.link === true,   // 22/10/2026: מקישור — העובד מוריד; בלי העלאה מהטלפון
    ph: PH_PID_RE.test(String(u.ph || '')) ? u.ph : '',   // 24/10/2026: תרגום בטלפון — Studio לאנדרואיד מעלה (הסרטון נשאר בטלפון)
    dx: u.dx && FID_RE.test(String(u.dx.f || '')) ? { f: u.dx.f, n: String(u.dx.n || '').slice(0, 120), at: num(u.dx.at),   // התוצר נשמר בתיקייה שבחרת ב־Drive
      j: JOB_RE.test(String(u.dx.j || '')) ? u.dx.j : '', st: ['run', 'ok', 'err'].includes(u.dx.st) ? u.dx.st : 'ok', p: Math.max(0, Math.min(1, +u.dx.p || 0)), e: String(u.dx.e || '').slice(0, 40), mv: u.dx.mv ? 1 : 0 } : null,   // 26/10/2026: שמירה בשרת (j = עבודת dx)
    tl: normUtl(u.tl) };
  const fp = j.fp && typeof j.fp === 'object' ? { name: String(j.fp.name || '').slice(0, 200), size: num(j.fp.size), lm: num(j.fp.lm) } : null;
  const s = j.srv && typeof j.srv === 'object' ? j.srv : null;
  const srv = s ? {
    state: STATES.includes(s.state) ? s.state : 'new', err: String(s.err || '').slice(0, 40), fired: num(s.fired), ended: num(s.ended),
    prog: s.prog && typeof s.prog === 'object' && !Array.isArray(s.prog) ? s.prog : null,
    sess: s.sess && typeof s.sess.url === 'string' && /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]+$/.test(s.sess.url) ? { url: s.sess.url } : null,
    ed: typeof s.ed === 'string' ? s.ed.slice(0, 140) : '',   // v356: פרטי ההפעלה שנכשלה (סטטוס · סוג · מזהה בקשה)
    // v358: התוצרים בתיקיית העבודה ב־Drive (מהשרתון: files.o; בשמירה המקומית: out)
    out: (Array.isArray(s.out) ? s.out : s.files && Array.isArray(s.files.o) ? s.files.o : []).slice(0, 10)
      .filter((o) => o && FID_RE.test(String(o.id || '')) && OUT_ALL.includes(o.k))
      .map((o) => ({ id: o.id, k: o.k, size: num(o.size) })),
    use: normUse(s.use),   // v359: טוקנים ועלות (מהעובד, דרך השרתון)
    eng: s.eng === 'api' ? 'api' : 'sub',   // מצב API: העבודה רצה על השרת של המערכת (בתור עד ששרת פנוי)
    vw: s.vw === 1 || s.vw === true,   // 15/10/2026: מחכה לסרטון בתור — השרת פנוי בינתיים
    urt: normRate(s.urt),   // 25/10/2026: המשוב שלך על התרגום (👍/👎, סיבות, כתוביות שסימנת)
    sw: typeof s.sw === 'string' ? s.sw.slice(0, 40) : '',   // 25/10/2026: למה העבודה לא התחילה (קוד הסירוב בשרתון — גם ממכשיר אחר)
    uw: s.uw === 1,   // 25/10/2026: בתור, והשרת מתחלף לגרסה חדשה של העובד (חלון העדכון — דקה־שתיים)
    ry: s.ry === 1, rc: num(s.rc),   // 24/10/2026: "המנוי שלי" דרך השרת — ומתי ה־Routine שלך התחבר (0 = עוד לא)
    qa: normQa(s.qa),      // שאלה מ־Claude באמצע העבודה (והתשובה)
    ck: normCk(s.ck),      // v361: נקודת השמירה האחרונה (אחרי איזה שלב)
    stale: s.stale === true, fires: num(s.fires),
    tw: normTw(s.tw),      // v362: מגדל הפיקוח
    rw: num(s.rec),        // v368: תקלה חולפת — ממשיכה לבד מהרגע הזה (0 = לא)
    fr: s.fr && typeof s.fr.s === 'number' && s.fr.s >= -1 && s.fr.s < 600 ? { s: s.fr.s, ms: num(s.fr.ms) } : null,   // v369: תוצאת ההפעלה האחרונה
    tr: normTrace(s.tr),   // v373: עקיבה
    q: normQuality(s.q), ij: normInj(s.ij),   // v374: מדד האיכות ושומר ההזרקות
    jd: normJudge(s.jd),                      // v375: שופט האיכות
    rvf: normRvf(s.rvf), fil: normFil(s.fil), // סבב 4: סימונים מהביקורת, מילות מילוי
    gl: normGl(s.gl),                         // v380: זיכרון המונחים
    nt: normNote(s.nt),                       // v382: הערה לעובד
    sla: normSla(s.sla),                      // v377: יעדי זמן ותקציב
    ep: normEp(s.ep),                         // 10/10/2026: צפי הזמנים של העבודה (מהשרתון, נקבע בלקיחה)
    gd: normGd(s.gd), gs: JOB_RE.test(String(s.gs || '')) ? s.gs : '', gq: normGq(s.gq),   // v387: סט הזהב
    kind: s.kind === 'rr' ? 'rr' : 'tr', rp: JOB_RE.test(String(s.rp || '')) ? s.rp : '',   // מ2: הפקה מחדש (והעבודה המקורית)
    ev: num(s.ev), vh: (Array.isArray(s.vh) ? s.vh : []).slice(0, 20).map(num),   // מ2: גרסת הכתוביות, ומתי נשמרה כל גרסה קודמת
    folder: FID_RE.test(String(s.folder || '')) ? s.folder : '',
    hl: normLadder(s.hl),                     // איכויות הצפייה (הראשונה = המקור עצמו)
    hla: s.hl ? normAlt(s.hla) : null,        // 22/10/2026: עותק הקול לנגן (הקול המקורי — Dolby/DTS… — נשאר במקור)
    cp: normCp(s.cp),                         // סבב 10: העתק־הדבק — בקשה שמחכה לתשובה שלך
    pbn: normPbn(s.pbn),                      // 24/10/2026: הצריבה בטלפון
    ppr: normPpr(s.ppr),                      // 25/10/2026: מה הטלפון עושה לפני ההתחלה (שלב 2)
    vcp: normVcp(s.vcp),                      // 29/10/2026: הסרטון עולה לענן מ־Studio לאנדרואיד (spec.vc)
    fv: s.files && s.files.v && FID_RE.test(String(s.files.v.id || '')) ? s.files.v.id : '',   // 29/10/2026: הסרטון בענן (בעבודת טלפון — לא מהדף)
    bg: s.bg === 1 ? 1 : 0,                   // 28/10/2026: התוצרים מוכנים והעובד משלים איכויות צפייה ברקע — ממשיכים לרענן
    sx: num(s.sx),                            // 26/10/2026: מתי סרטון המקור נמחק (0 = עוד שמור)
    rt: s.rt && typeof s.rt === 'object' ? { s: num(s.rt.s), j: num(s.rt.j) } : null,   // עד מתי המקור (s) ועד מתי הקבצים (j)
    w: !!(s.files && s.files.w && s.files.w.id),   // 25/10/2026: המילים מהטלפון הגיעו (שלב 2)
    m: !!(s.files && s.files.m && s.files.m.id),   // 24/10/2026: המדידות מהטלפון הגיעו
  } : null;
  const chap = normChapters(j.chap);   // פרקים בנגן (מ"רעיונות"); נשמרים בטלפון עם העבודה
  const vm = j.vm && num(j.vm.w) > 0 && num(j.vm.h) > 0 ? { w: Math.min(num(j.vm.w), 16384), h: Math.min(num(j.vm.h), 16384) } : null;   // סבב 2: מידות הסרטון (מהבדיקה בטלפון)
  const gref = FID_RE.test(String(j.gref || '')) ? j.gref : '';   // שלב 4: רצועת ההשוואה מהסרטון (בתיקיית העבודה) — לסט הזהב כשהעבודה מסתיימת
  const org = normOrg(j.org);   // 28/10/2026: מאיפה הגיע כל קובץ (מוצג במסך העבודה)
  return { id: j.id, created: num(j.created), spec, up, fp, srv, ...(chap.length ? { chap } : {}), ...(vm ? { vm } : {}), ...(gref ? { gref } : {}), ...(org ? { org } : {}) };
}
/* 28/10/2026 (בקשת המשתמש: "שלכל כתוביות או קובץ אודיו יהיה המקור של מאיפה הוא הגיע בדיוק"): v = הסרטון
   (ph טלפון · dr Drive · bx רשימת הקבצים של Studio ב־Drive · ln קישור · dl הורד בטלפון מקישור · pa Studio לאנדרואיד),
   h = האתר; s = קובץ הכתוביות, r = העזר להגהה, g = ההשוואה — {k: file שצירפת · trk רצועה בקובץ · net מהרשת, l: שפה, p: המקור ברשת} */
const ORG_V = ['ph', 'dr', 'bx', 'ln', 'dl', 'pa'], ORG_T = ['file', 'trk', 'net'];
export const NS_NAME = { os: 'OpenSubtitles', wz: 'Wizdom' };
export function normOrg(o) {
  if (!o || typeof o !== 'object') return null;
  const host = (x) => (/^[a-z0-9][a-z0-9.-]{0,79}$/i.test(String(x || '')) ? String(x).toLowerCase() : '');
  const lng = (x) => (/^[a-z]{2,3}$/.test(String(x || '')) ? x : '');
  const t = (x) => (x && typeof x === 'object' && ORG_T.includes(x.k)
    ? Object.assign({ k: x.k }, lng(x.l) ? { l: x.l } : {}, x.k === 'net' && Object.hasOwn(NS_NAME, String(x.p)) ? { p: x.p } : {}) : null);
  const out = {};
  if (o.v && typeof o.v === 'object' && ORG_V.includes(o.v.k)) out.v = Object.assign({ k: o.v.k }, host(o.v.h) ? { h: host(o.v.h) } : {});
  for (const k of ['s', 'r', 'g']) { const x = t(o[k]); if (x) out[k] = x; }
  return Object.keys(out).length ? out : null;
}
const hostOf = (u) => { try { return new URL(String(u || '')).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
/* רצועה בטופס → המקור שלה */
function orgTrk(f, id) {
  const t = id != null && f.trk ? f.trk.tracks.find((x) => x.id === id) : null;
  return t ? (t.net ? { k: 'net', p: t.net.src, l: t.lang } : { k: 'trk', l: t.lang }) : null;
}
/* הטופס → org של העבודה. v — כשנקבע מבחוץ (קישור / תרגום בטלפון); r רק כשהעזר באמת נשלח (eng api) */
function orgOf(f, v, eng) {
  const k = f.trk;
  return normOrg({
    v: v || (f.drive ? { k: f.drive.bx ? 'bx' : 'dr' } : f.dl ? { k: 'dl', h: hostOf(f.dl.u) } : f.fileObj ? { k: 'ph' } : null),
    s: f.subs ? (f.subs.trk != null ? orgTrk(f, f.subs.trk) : { k: 'file' }) : null,
    r: k && k.src == null && k.hlp != null && eng === 'api' ? orgTrk(f, k.hlp) : null,
    g: k && k.ref != null ? orgTrk(f, k.ref) : null });
}
function orgVText(v) {
  const h0 = v.h || '—';
  return v.k === 'ln' ? T('studioOrgLn', { h: h0 }) : v.k === 'dl' ? T('studioOrgDl', { h: h0 }) : v.k === 'dr' ? T('studioOrgDr') : v.k === 'bx' ? T('studioOrgBx') : v.k === 'pa' ? T('studioOrgPa') : T('studioOrgPh');
}
function orgTText(x) {
  const l = x.l ? langName(x.l, uiLang()) : '';
  if (x.k === 'net') return T('studioNsBy') + ' · ' + nsSrcName(x.p) + (l ? ' · ' + l : '');
  return x.k === 'trk' ? T('studioOrgTrk', { l: l || T('studioTrkUnd') }) : T('studioOrgFile');
}
function orgRows(rec) {
  const o = rec.org;
  if (!o) return [];
  const rows = [];
  if (o.v) rows.push(rowTxtRow('film', 'blue', T('studioOrgV'), orgVText(o.v)), rowTxtRow('mic', 'purple', T('studioOrgA'), T('studioOrgFromV')));
  if (o.s) rows.push(rowTxtRow('cc', 'orange', T('studioOrgS'), orgTText(o.s)));
  if (o.r) rows.push(rowTxtRow('cc', 'orange', T('studioOrgR'), orgTText(o.r)));
  if (o.g) rows.push(rowTxtRow('check', 'green', T('studioOrgG'), orgTText(o.g)));
  return rows.length ? [secT(T('studioOrgT')), list(...rows)] : [];
}
/* v387: סט הזהב — אותה בדיקה כמו בשרתון (lib/studio.js normGd / normGq) */
const FID_GD = /^[A-Za-z0-9_-]{10,100}$/;
export function normGd(o) {
  if (!o || typeof o !== 'object' || !FID_GD.test(String(o.r || ''))) return null;
  return { r: o.r, n: Number.isInteger(o.n) && o.n > 0 && o.n <= GOLD_REF_MAX ? o.n : 0, at: num(o.at) };
}
export function normGq(o) {
  if (!o || typeof o !== 'object') return null;
  const p = (v) => (Number.isInteger(v) && v >= 0 && v <= 100 ? v : null);
  const sc = p(o.s), tm = p(o.tm), n = Number.isInteger(o.n) && o.n > 0 && o.n <= 1e5 ? o.n : null;
  return sc == null || tm == null || n == null ? null : { s: sc, tm, n, at: num(o.at) };
}
export const NORM_FIXED = 1.5;   // **זהה ל־NORM_FIXED בשרתון** (lib/studio.js) — העלות הקבועה של עבודה (פתיחה, מדריכים)
// 11/10/2026: מצב השרת — בלי סשן מתזמר (**זהה ל־NORM_DEF_API / NORM_FIXED_API בשרתון**; tests/studio-v363 משווה)
export const NORM_DEF_API = { 'sonnet-medium': 2.6, 'haiku-high': 0.55, 'haiku-medium': 0.5, 'sonnet-high': 4.2, 'opus-medium': 7.0, 'sonnet-low': 1.8 };
export const NORM_FIXED_API = 0.05;
/* מ6 (כלל 2): אומדן לפני כל התחלה — זמן (דקות לשעת וידאו של המצב × האורך) ועלות ("הרגיל" שלך, אחרת ברירת המחדל).
   במצב השרת — גם כמה נשאר מהתקציב החודשי. טהור */
export function startEstimate(mode, dur, norm, api, apiOn) {
  const d = dur > 0 ? dur : 0, m = modeById(mode);
  if (!d) return { min: 0, usd: 0, left: null, over: false };
  const usd = Math.round((goldEstimate([{ spec: { mode: m.id, dur: d } }], norm) + (apiOn ? NORM_FIXED_API : NORM_FIXED)) * 100) / 100;   // + הקבוע לעבודה (ב־Routine — פתיחת הסשן)
  const left = apiOn && api && !api.nc ? Math.max(0, Math.round((api.cap - api.month) * 100) / 100) : null;
  return { min: Math.max(1, Math.round(m.min * d / 3600)), usd, left, over: left != null && usd > left };
}
function estText(e, apiOn) {
  const t = e.min < 60 ? T('studioMinShort', { m: e.min }) : T('studioHMShort', { t: fmtHM(e.min) });
  if (!apiOn) return T('studioEstSub', { t, usd: fmtUsd(e.usd) });
  return T('studioEstApi', { t, usd: fmtUsd(e.usd), left: fmtUsd(e.left || 0) }) + (e.over ? ' ' + T('studioEstOver') : '') + keepLine();
}
/* 26/10/2026 (בעקבות Vid Hub): כמה זמן נשמר — כבר לפני ההתחלה (עד היום רק בדף העבודה, אחריה). רק במצב השרת (R2) */
function keepLine() {
  const k = ui.kt;
  if (!k || !ui.r2) return '';
  const hrs = Math.round(k.s / 3600e3), days = Math.round(k.j / 86400e3);
  return ' ' + T('studioEstKeep', { s: hrs <= 24 ? T('studioKeepDay') : T('studioKeepHours', { n: hrs }), d: days });
}
/* ---------- סבב 2: הצעות לפני ההתחלה — מהבדיקה של הסרטון בטלפון (חינם). לכל הצעה פעולה אחת ----------
   bad = כנראה אין מה לתרגם (אין קול / שקט), warn = כדאי לבדוק (שפה, כבר תורגם), tip = חוסך זמן וכסף (שקט בקצוות) */
export const EDGE_MIN = 10;
// 21/10/2026 (סבב הייעול, 1): בסרטון ארוך הצריבה היא החלק הכבד בסוף (23 דק׳ מתוך 68 בסרטון של 87 דק׳ — 0.26 דק׳ לכל דקה).
// הצעה לוותר עליה: הנגן מציג את הכתוביות מעל המקור, ואפשר לצרוב אחר כך ב"הפקה מחדש"
export const LONG_BURN_S = 30 * 60, BURN_MIN_PER_MIN = 0.26;      // שניות של שקט בהתחלה / בסוף שמצדיקות הצעה לחתוך
const ADV_ORDER = { bad: 0, warn: 1, tip: 2 };
export function sourceAdvice(m, ctx) {
  const out = [], c = ctx || {};
  const prev = (c.jobs || []).find((r) => r && r.srv && r.srv.state === 'done' && r.srv.kind !== 'rr' && r.spec && r.spec.name === c.name && r.spec.size === c.size && c.name);
  if (prev) out.push({ k: 'dup', sev: 'warn', act: 'open', id: prev.id });
  if (m && m.dur > 0) {
    const silent = m.db != null && m.db < QUIET_DB;
    if (!m.audio) out.push({ k: 'noaudio', sev: 'bad', act: 'repick' });
    else if (silent) out.push({ k: 'silent', sev: 'bad', act: 'repick' });
    const to = (c.to && c.to[0]) || 'he';
    if (m.lang && m.audio && (c.from === 'auto' || c.from === 'en')) {
      if (m.lang === to) out.push({ k: 'same', sev: 'warn', act: 'repick', lang: m.lang });
      else if (m.lang !== 'en') out.push({ k: 'lang', sev: 'warn', act: 'repick', lang: m.lang });
    }
    const lead = m.lead || 0, trail = m.trail || 0;
    if (m.audio && !silent && !c.edl && (lead >= EDGE_MIN || trail >= EDGE_MIN) && m.dur - lead - trail >= 20) {
      const a = lead >= EDGE_MIN ? Math.max(0, lead - 1) : 0, b = trail >= EDGE_MIN ? Math.min(m.dur, m.dur - trail + 1) : m.dur;
      out.push({ k: 'edges', sev: 'tip', act: 'cut', a: Math.round(a * 10) / 10, b: Math.round(b * 10) / 10, save: Math.round(a + (m.dur - b)) });
    }
    if (m.dur >= LONG_BURN_S && c.out && OUTS.some((k) => c.out[k])) out.push({ k: 'burn', sev: 'tip', act: 'noburn', save: Math.round(m.dur / 60 * BURN_MIN_PER_MIN) });
  }
  return out.sort((x, y) => ADV_ORDER[x.sev] - ADV_ORDER[y.sev]);
}
/* הצעות אחרי שהעבודה הסתיימה — מהשופט וממידות הסרטון (בעיות קצב/אורך — כבר בעורך, עם הצעות תיקון משלהן). "בדיקת משמעות" = תרגום חוזר רק של מה שהשופט סימן */
/* סבב 4: סימונים מהביקורת ומילות מילוי — אותה בדיקה כמו בשרתון (normRvf / normFil); לא תקין — null */
export const RVF_CODES = ['g', 's', 't'];
export const RVF_MAX = 40;   // **זהה בעובד ובשרתון**
export function normRvf(o) {
  if (!Array.isArray(o) || !o.length || o.length > RVF_MAX) return null;
  const out = [];
  for (const x of o) {
    if (!Array.isArray(x) || x.length !== 2 || !Number.isInteger(x[0]) || x[0] < 1 || x[0] > 1e6 || !RVF_CODES.includes(x[1])) return null;
    const l = out[out.length - 1];
    if (l && (x[0] < l[0] || (x[0] === l[0] && RVF_CODES.indexOf(x[1]) <= RVF_CODES.indexOf(l[1])))) return null;
    out.push([x[0], x[1]]);
  }
  return out;
}
export const FIL_MAX = 300;  // **זהה בעובד ובשרתון**
export function normFil(o) {
  if (!Array.isArray(o) || !o.length || o.length > FIL_MAX) return null;
  const out = [];
  for (const x of o) {
    if (!Array.isArray(x) || x.length !== 2 || typeof x[0] !== 'number' || typeof x[1] !== 'number') return null;
    const a = Math.round(x[0] * 100) / 100, b = Math.round(x[1] * 100) / 100;
    if (!(a >= 0) || !(b - a >= 0.149) || b - a > 2.001 || a > 86400 || (out.length && a < out[out.length - 1][1])) return null;
    out.push([a, b]);
  }
  return out;
}
export function afterAdvice(rec, o) {
  const out = [], sv = rec && rec.srv, x = o || {};
  if (!sv || sv.state !== 'done' || sv.kind === 'rr') return out;
  if (sv.rvf && sv.rvf.length) out.push({ k: 'rvf', act: 'subs', n: new Set(sv.rvf.map((f) => f[0])).size });   // סבב 4: לבדיקה שלך
  if (askFixDue(sv.qa)) out.push({ k: 'ask', act: 'ai' });   // 20/10/2026: התשובה שלך הגיעה אחרי התרגום — לתקן לפיה
  if (sv.jd && sv.jd.f && sv.jd.f.length) out.push({ k: 'jd', act: 'ai', n: sv.jd.f.length });
  if (rec.vm && rec.vm.h > rec.vm.w && !x.rrDone && !(sv.sx > 0)) out.push({ k: 'vert', act: 'rr' });   // 26/10/2026: בלי מקור — לא מציעים לצרוב מחדש
  return out;
}
/* v387: אומדן להרצת סט הזהב — "הרגיל" לשעה של כל מצב (נלמד או ברירת המחדל) × אורך הסרטון. טהור */
export function goldEstimate(gold, norm) {
  let usd = 0;
  for (const r of gold || []) {
    const ph = norm && norm[r.spec.mode] ? norm[r.spec.mode].ph : 3;
    usd += ph * (r.spec.dur > 0 ? r.spec.dur : 3600) / 3600;
  }
  return Math.round(usd * 100) / 100;
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
        .map((c) => Object.assign({ t: /^\d{1,2}:\d{2}(?::\d{2})?$/.test(String(c.t || '')) ? c.t : '', x: c.x.slice(0, 140) },
          typeof c.e === 'string' && c.e ? { e: c.e.slice(0, 160) } : {})) };   // 21/10: e = המקור באנגלית של אותו זמן
  } else if (q.nb === 1) {
    // 20/10/2026: שאלה שלא עוצרת את העבודה. u = לפי מה התרגום נעשה (מספר, ‎-1 שיקול דעת, ‎-2 התשובה הפתוחה; אין = עוד לא התחיל)
    out.nb = 1;
    if (Number.isInteger(q.u) && q.u >= -2 && q.u < o.length) out.u = q.u;
  }
  return out;
}
/* 20/10/2026: ענית על שאלה שלא עצרה את העבודה, והתרגום נעשה לפי משהו אחר — לתקן את הכתוביות לפי התשובה? טהור */
export function askFixDue(qa) {
  if (!qa || qa.nb !== 1 || !qa.a || qa.a.auto) return false;
  const used = qa.u !== undefined ? qa.u : qa.d;
  return qa.a.i >= 0 ? qa.a.i !== used : used !== -2;
}
/* v367: החוקים שלך (מהשרתון, op status) — אותה בדיקה כמו בשרתון (lib/studio.js normRules) */
export const RULE_BUDGETS = [5, 10, 20, 40];
export function normRules(r) {
  const o = r && typeof r === 'object' ? r : {};
  const n = typeof o.b === 'number' ? o.b : NaN;   // הסקירה: כמו בשרתון — עיגול לחצי דולר, עד 500 (מה שמוצג = מה שנשמר)
  const b = Number.isFinite(n) && n >= 1 ? Math.min(500, Math.round(n * 2) / 2) : 0;
  // v375: jx = שופט האיכות כבוי · 11/10: מקסימום במצב שהוסר → הקרוב (לא "בלי הגבלה")
  return { b, mx: MODES.some((m) => m.id === o.mx) ? o.mx : LEGACY_MODES[o.mx] || '', ab: o.ab === true, jx: o.jx === true, am: o.am === true };   // סבב 10: am = בדיקת משמעות אוטומטית (עם אומדן ואישור)
}
/* v362: מגדל הפיקוח — אותה בדיקה כמו בשרתון (lib/studio.js normTower) */
const TW_WHY = ['cost', 'cap', 'loop', 'calls', 'idle'];
export function normTw(t) {
  if (!t || typeof t !== 'object' || !['ok', 'warn', 'red'].includes(t.lv)) return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  return { lv: t.lv, x: n(t.x), usd: n(t.usd), exp: n(t.exp), why: TW_WHY.includes(t.why) ? t.why : '', n: n(t.n), min: n(t.min),
    nj: t.b === 'u' ? n(t.nj) : 0,     // v363: "הרגיל" נלמד מ־nj עבודות שלך (0 = המדידות שלנו)
    fp: /^[0-9a-f]{12}$/.test(String(t.fp || '')) ? t.fp : '',   // v364: טביעת האצבע של העצירה (ספר התיקונים)
    sh: t.sh === 1 && t.lv === 'warn', shn: Number.isInteger(t.shn) && t.shn > 0 && t.shn <= 3 ? t.shn : 0 };   // v384: מצב צל
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
const INC_ST = ['o', 'w', 'r', 'x'], INC_EV = ['o', 'f', 'w', 'c', 'r', 'x', 'm', 'a', 'k'], RC_T = ['known', 'wide', 'up', 'code', 'env', 'same', 'self'];
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
  const out = { t: { tg, el, pz: num(o.t.pz, 1e7) || 0, f, lv: o.t.lv, paused: o.t.paused === true }, pf: num(o.pf, 1) || 0, at: Date.now() };   // 21/10/2026: at = מתי הגיע — הזמן ממשיך לרוץ בין עדכונים (slaLiveT)
  if (o.u && typeof o.u === 'object') {
    const ut = num(o.u.tg, 1e5), sp = num(o.u.sp, 1e5), uf = num(o.u.f, 1e4);
    if (ut && sp != null && uf != null && SLA_LV.includes(o.u.lv)) out.u = { tg: ut, sp, f: uf, lv: o.u.lv };
  }
  // 30/10/2026: הצפי לסוף (זמן בשניות, עלות בדולרים) — רק בזמן ריצה
  if (o.fc && typeof o.fc === 'object' && num(o.fc.t, 1e7)) {
    out.fc = { t: o.fc.t };
    if (out.u && num(o.fc.u, 1e5) != null) out.fc.u = o.fc.u;
    if (out.fc.u != null && num(o.fc.k, 1e9)) out.fc.k = Math.round(o.fc.k);
  }
  return out;
}
/* v377: ערך ועלות החודש, תחזית, צוואר בקבוק ומסלולים חריגים (lib/studiosla.js valueView) */
/* v383: תקציב שגיאות (lib/studioslo.js sloView) — יעד 95% בלי התערבות, כמה נשאר, קצב שריפה ב־7 ימים, העבודות שאכלו ממנו */
const SLO_ST = ['ok', 'warn', 'fast', 'out', 'few'], SLO_C = ['fail', 'stale', 'resume'];
/* v384: מצב צל — לכל מצב תרגום, כמה עבודות עוד רק מזהירות בספים החדשים */
export function normSh(o) {
  const out = {};
  if (o && typeof o === 'object') for (const m of MODES.map((x) => x.id)) if (Number.isInteger(o[m]) && o[m] > 0 && o[m] <= 3) out[m] = o[m];
  return out;
}
export function normSlo(o) {
  if (!o || typeof o !== 'object' || !SLO_ST.includes(o.st)) return null;
  const int = (v, hi) => (Number.isInteger(v) && v >= 0 && v <= hi ? v : 0);
  const n = int(o.n, 1e5), bad = Math.min(n, int(o.bad, 1e5));
  return { t: int(o.t, 100) || 95, n, good: n - bad, bad, att: n ? Math.round((n - bad) / n * 1000) / 10 : null, left: int(o.left, 100),
    burn: typeof o.burn === 'number' && o.burn >= 0 && o.burn < 1e3 ? o.burn : 0, n7: int(o.n7, 1e5), st: o.st, min: int(o.min, 100) || 20,
    list: (Array.isArray(o.list) ? o.list : []).filter((x) => x && JOB_RE.test(String(x.j || '')) && SLO_C.includes(x.c)).slice(0, 10).map((x) => ({ j: x.j, c: x.c, at: num(x.at) })) };
}
/* v385: ציון חריגה 0–10 (lib/studioanom.js anomView) — צורה קבועה */
export const AN_KEYS = ['t:tr', 't:al', 't:tl', 't:rv', 't:bn', 't:sv', 'u:main', 'u:tl', 'u:rv', 'u:jg'];
const AN_C = ['vt', 'claude', 'drive'], AN_TR = ['u', 'd', 'f'];
export function normAn(o) {
  if (!o || typeof o !== 'object') return null;
  const int = (v, hi) => (Number.isInteger(v) && v >= 0 && v <= hi ? v : 0);
  const sc = (v) => (typeof v === 'number' && v >= 0 && v <= 10 ? Math.round(v * 10) / 10 : null);
  const pos = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 1e6 ? v : null);
  const out = { n: int(o.n, 1e5), min: int(o.min, 100) || 5, hi: sc(o.hi) || 6, j: {}, m: [] };
  if (o.j && typeof o.j === 'object') for (const id of Object.keys(o.j).slice(0, 20)) {
    if (!JOB_RE.test(id) || !Array.isArray(o.j[id])) continue;
    const rows = o.j[id].filter((r) => Array.isArray(r) && AN_KEYS.includes(r[0]) && sc(r[1]) != null && pos(r[2]) != null && pos(r[3]) != null)
      .slice(0, AN_KEYS.length).map((r) => (pos(r[4]) != null ? [r[0], sc(r[1]), r[2], r[3], r[4]] : [r[0], sc(r[1]), r[2], r[3]]));   // r[4] = שניות בתוכנית (זמן)
    if (rows.length) out.j[id] = rows;
  }
  for (const r of Array.isArray(o.m) ? o.m.slice(0, AN_KEYS.length) : []) {
    if (!r || !AN_KEYS.includes(r.k) || !AN_C.includes(r.c) || sc(r.s) == null || pos(r.v) == null || pos(r.med) == null) continue;
    out.m.push({ k: r.k, c: r.c, s: sc(r.s), v: r.v, med: r.med, tr: AN_TR.includes(r.tr) ? r.tr : 'f', f: int(r.f, 5), fn: int(r.fn, 5), p: r.p === true,
      j: JOB_RE.test(String(r.j || '')) ? r.j : '', at: num(r.at) });
  }
  return out;
}
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
const SC_KINDS = ['claude_missing', 'claude_untested', 'claude_stale', 'drive_cfg', 'drive_missing', 'drive_revoked', 'drive_err', 'quota_crit', 'quota_low', 'fires_high', 'budget_low', 'offsite_none', 'offsite_stale', 'orphans', 'dupes', 'ck', 'old'];
const SC_CHECKS = ['claude', 'drive', 'quota', 'fires', 'budget', 'offsite', 'orphans', 'dupes', 'ck', 'old'];   // 11/10/2026: offsite = הגיבוי ל־Drive
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
  if (kaMdlOk(o.k)) out.k = { st: Object.fromEntries(Object.entries(o.k.st).filter(([k]) => ['tr', 'al', 'bn', 'sv', 'tb'].includes(k)).map(([k, v]) => [k, v.slice()])) };   // 31/10/2026: קריוקי
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
/* v382: הערה לעובד — p = מחכה לנקודת השמירה הבאה, h = נקראו (d = מתי), n מתוך max לעבודה. הטקסט שלך — מוצג רק כטקסט */
const NOTE_LEN = 300;
const noteText = (v) => { const s = String(v == null ? '' : v).replace(/[\x00-\x09\x0b-\x1f\x7f<>`]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim(); return s.length >= 2 ? s.slice(0, NOTE_LEN) : ''; };
export function normNote(o) {
  if (!o || typeof o !== 'object') return null;
  const p = o.p && noteText(o.p.t) ? { t: noteText(o.p.t), at: num(o.p.at) } : null;
  const h = (Array.isArray(o.h) ? o.h : []).slice(-5).map((x) => x && noteText(x.t) ? { t: noteText(x.t), at: num(x.at), d: num(x.d) } : null).filter(Boolean);
  const max = Math.max(1, Math.min(10, num(o.max) || 5));
  return p || h.length ? { p, h, n: Math.min(max, num(o.n) || h.length + (p ? 1 : 0)), max } : null;
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
  // סבב 2: מספרי הכתוביות שהשופט סימן (מזהי vt) — אותה בדיקה כמו בשרתון
  const f = [];
  for (const x of Array.isArray(o.f) ? o.f.slice(0, JG_F_MAX) : []) if (int(x, 1, 1e6) != null && (!f.length || x > f[f.length - 1])) f.push(x);
  return f.length ? { s, n, t, a, c, f } : { s, n, t, a, c };
}
export const JG_F_MAX = 40;   // **זהה ל־JG_F_MAX בעובד ובשרתון**
export function normAgents(o) {
  if (!o || typeof o !== 'object' || !Array.isArray(o.agents)) return null;
  const num = (v, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(hi, v)) : 0);
  const agents = o.agents.filter((x) => x && ['main', 'tl', 'rv', 'jg'].includes(x.k)).slice(0, 4).map((x) => ({
    k: x.k, m: /^claude-[a-z0-9-]{1,50}$/.test(String(x.m || '')) ? x.m : '', ef: ['low', 'medium', 'high', 'max'].includes(x.ef) ? x.ef : '',
    jobs: num(x.jobs, 1e4), usd: num(x.usd, 1e6), partial: x.partial === true, ok: typeof x.ok === 'number' ? num(x.ok, 100) : null,
    n: num(x.n, 1e8), e: num(x.e, 1e8), s: num(x.s, 1e9), pv: /^[0-9a-f]{8}$/.test(String(x.pv || '')) ? x.pv : '', pvs: num(x.pvs, 100), pvNew: x.pvNew === true, q: typeof x.q === 'number' ? num(x.q, 100) : null,
    ...normEval(x), vs: (Array.isArray(x.vs) ? x.vs : []).filter((v) => v && /^[0-9a-f]{8}$/.test(String(v.p || ''))).slice(0, 3)
      .map((v) => Object.assign({ p: v.p, jobs: num(v.jobs, 1e4), at: num(v.at, 1e14) }, normEval(v))) }));
  const ev = o.ev && /^[0-9a-f]{12}$/.test(String(o.ev.v || '')) ? { v: o.ev.v, n: num(o.ev.n, 1e3) } : null;
  const risk = (Array.isArray(o.risk) ? o.risk : []).filter((r) => r && RISK_KEYS.includes(r.r) && ['w', 'm', 's'].includes(r.st)).slice(0, 3).map((r) => ({ r: r.r, st: r.st, n: num(r.n, 1e4) }));
  return { jobs: num(o.jobs, 1e4), agents, ev, risk };
}
/* v386: מדדי הערכת סוכנים — שלמות (c), כלי נכון (t), קריאות תקינות (v), ציון (sc); w = פעולות מחוץ לתפקיד */
const RISK_KEYS = ['inj', 'cost', 'loop'];
function normEval(x) {
  const p = (v) => (Number.isInteger(v) && v >= 0 && v <= 100 ? v : null);
  return { c: p(x.c), t: p(x.t), v: p(x.v), sc: p(x.sc), w: Number.isInteger(x.w) && x.w >= 0 ? Math.min(x.w, 1e6) : 0 };
}
/* v386: "מומלץ לפעולה" (AI Control Tower) — מה כדאי לבדוק עכשיו; טהור. sh = מצב הצל של הספים (v384) */
export const REC_DROP = 5, REC_TOOL = 95, REC_VALID = 85, REC_CMP = 80;
export function agentRecs(ag, sh) {
  const out = [];
  for (const a of (ag && ag.agents) || []) {
    const [v0, v1] = a.vs || [];
    if (v0 && v1 && v0.sc != null && v1.sc != null && v0.sc < v1.sc - REC_DROP) out.push({ k: 'drop', a: a.k, from: v1.sc, to: v0.sc });
    else if (a.pvNew && v0 && v0.jobs < 3) out.push({ k: 'new', a: a.k, n: 3 - v0.jobs });
    if (a.t != null && a.t < REC_TOOL && a.w) out.push({ k: 'tool', a: a.k, n: a.w });
    if (a.v != null && a.v < REC_VALID) out.push({ k: 'valid', a: a.k, n: a.v });
    if (a.c != null && a.c < REC_CMP) out.push({ k: 'cmp', a: a.k, n: 100 - a.c });
  }
  const shn = Object.values(sh || {}).filter((n) => n > 0);
  if (shn.length) out.push({ k: 'shadow', n: Math.max(...shn) });
  return out;
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
  if (!s || s.sx > 0 || !(rec.up.a.done || rec.up.v.done || rec.up.started)) return false;
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
  return !!(s && s.qa && !s.qa.a && !s.qa.nb && (s.state === 'queued' || s.state === 'running'));   // שאלה שלא עוצרת — לא "מחכה לך"
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
  const sugx = (Array.isArray(src.sugx) ? src.sugx : []).filter((x) => typeof x === 'string' && /^[a-z]{2,8}[0-9a-z]{1,8}$/.test(x)).slice(-500);   // מ6: "לא להציע שוב" (טביעות, בלי טקסט)
  const amd = (Array.isArray(src.amd) ? src.amd : []).filter((x) => typeof x === 'string' && JOB_RE.test(x)).slice(-200);   // סבב 10: עבודות שכבר הוצעה להן בדיקת משמעות אוטומטית
  // 29/10/2026 (S1 בסרטון): מצב השרת האחרון — הקפסולה בהדר נכונה כבר בציור הראשון ("שרת המערכת", לא "חיבור Claude" שמתחלף)
  const st = src.st && typeof src.st === 'object' ? { api: normApi(src.st.api), mf: src.st.mf === true } : null;
  return { settings: migrateSettings(src.settings), drafts, jobs, conn: c, drive: d, sugx, amd, st };
}
/* 10/10/2026: ברירת המחדל עברה מ־Opus Medium ל־Sonnet Medium — הגדרות שנשמרו לפני כן (בלי mv) עם הברירה הישנה עוברות פעם אחת
   לחדשה. בחירה אחרת שנשמרה (Sonnet High וכו׳) נשארת
   15/10/2026: ברירת המחדל עברה ל־Haiku High ("רגיל") — מי שנשאר על הברירה הקודמת (Sonnet Medium) עובר פעם אחת (mv 3) */
export function migrateSettings(o) {
  const s = normSettings(o);
  const mv = o && typeof o === 'object' ? o.mv : 0;
  if (mv !== 2 && mv !== 3 && mv !== 4 && /^opus-(medium|high|max)$/.test(o && o.mode)) s.mode = DEFAULT_MODE;   // רק Opus
  // 25/10/2026: "רגיל" = Haiku Medium ו"ביצועים" = Haiku High — מי שנשמר על "רגיל" הקודם (Haiku High) נשאר "רגיל", ומי שעל
  // "ביצועים" הקודם (Sonnet Medium) נשאר "ביצועים". פעם אחת (mv 4)
  if (mv !== 4 && o && o.mode === 'haiku-high') s.mode = DEFAULT_MODE;
  else if (mv !== 4 && o && o.mode === 'sonnet-medium') s.mode = 'haiku-high';
  s.mv = 4;
  return s;
}
/* טיוטה מהטופס: רק פרטי הקובץ (שם, גודל, סוג) — הקובץ עצמו לא נשמר */
export function newDraft(form, created, id) {
  const f = form.file || {};
  return normDraft({
    id, created, name: f.name, size: f.size, type: f.type,
    from: form.from, to: form.to, mode: form.mode, out: form.out, style: form.style, terms: form.terms,
    drive: form.drive ? Object.assign({ id: form.drive.id, dur: form.drive.dur || 0 }, form.drive.bx ? { bx: true } : {}) : null,
  });
}
/* 3.2GB · 312MB · 84KB (יחידות של 1024, בלי רווח — כמו בשאר האפליקציה) */
export function fmtSize(n) {
  n = Math.max(0, Number(n) || 0);
  const G = 1073741824, M = 1048576;
  if (n >= G) return (n / G).toFixed(n >= 10 * G ? 0 : 1) + 'GB';
  if (n >= M) return Math.round(n / M) + 'MB';
  if (n <= 0) return '0KB';   // 26/10/2026: עד היום "1KB" גם כשלא עלה כלום ("עלו 1KB מתוך 187MB" — נראה כמו תקיעה באמצע)
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
/* 1/11/2026 (צילום מהטלפון: "עלו 70MB מתוך 99MB · ממשיך כשההעלאה חוזרת", וההתראה של Background Fetch תקועה ב־0%): כשהעבודה
   כבר רצה בשרת (הקול עלה), jobPhase מחזיר queued/running לפני שבודק את הסרטון — ולכן העלאה שנעצרה (Background Fetch שנתקע
   ובוטל, דף שנטען מחדש בלי הרשאה לקובץ) נשארה בלי כפתור ובלי המשך. upHalt: הסרטון מהטלפון הזה לא הסתיים ואין העלאה פעילה —
   'need' (צריך לבחור שוב) / 'paused' (אפשר להמשיך) / '' */
export function upHalt(rec, run) {
  const up = rec && rec.up, s = rec && rec.srv ? rec.srv.state : 'new';
  if (!up || up.v.done || up.noAudio || up.link || up.ext || up.ph || !rec.fp) return '';
  if (s !== 'queued' && s !== 'running') return '';
  if (run && run.active) return '';
  return run && run.need ? 'need' : 'paused';
}

/* 26/10/2026: מה להגיד כשאין רשת בדף העבודה — רק כשהעבודה כבר בשרת (ההעלאה מהטלפון מציגה "מחכים לחיבור" משלה) */
export function offlineNote(rec, run, offline) {
  if (!offline || !rec) return '';
  const ph = jobPhase(rec, run);
  return ph === 'queued' || ph === 'running' ? 'studioOfflRun' : ph === 'done' ? 'studioOfflDone' : '';
}
/* 23/10/2026: העלאה שנחסמת (CORS / קישור חתום / חיבור שנתקע) נראתה "תקועה" בלי מילה — הטלפון ניסה שוב בשקט.
   upBlockStep מעדכן את מצב החסימה בכל ניסיון חוזר (onWait); upBlocked אומר מתי להגיד למשתמש: ניסיונות רצופים
   בלי שום בייט שהתקדם, ולפחות UP_BLOCK_MS. טביעת ההתקדמות = הבייטים של הקול + הסרטון + ההעלאה הנוכחית. */
export const UP_BLOCK_N = 3, UP_BLOCK_MS = 45000;
export function upBlockStep(b, fp, code, now) {
  if (!b || b.fp !== fp) return { fp, n: 1, t0: now, code: String(code || 'net') };
  return { fp, n: b.n + 1, t0: b.t0, code: String(code || b.code || 'net') };
}
export function upBlocked(b, fp, now) {
  if (!b || b.fp !== fp || b.n < UP_BLOCK_N || now - b.t0 < UP_BLOCK_MS) return '';
  return b.code === 'stalled' ? 'stall' : 'net';
}

/* ---------------- מחרוזות לפי מזהה (כל מפתח מילולי) ---------------- */
function modeSub(id) {
  switch (id) {
    case 'opus-medium': return T('studioMsOpusMed');
    case 'sonnet-high': return T('studioMsSonHigh');
    case 'haiku-high': return T('studioMsHaiHigh');
    case 'sonnet-low': return T('studioMsSonLow');
    case 'haiku-medium': return T('studioMsHaiMed');
    default: return T('studioMsSonMed');
  }
}
function effortSub(id) {
  switch (id) {
    case 'opus-medium': return T('studioEfOpusMed');
    case 'sonnet-high': return T('studioEfSonHigh');
    case 'haiku-high': return T('studioEfHaiHigh');
    case 'sonnet-low': return T('studioEfSonLow');
    case 'haiku-medium': return T('studioEfHaiMed');
    default: return T('studioEfSonMed');
  }
}
function modeSum(id) {
  switch (id) {
    case 'opus-medium': return T('studioSumOpusMed');
    case 'sonnet-high': return T('studioSumSonHigh');
    case 'haiku-high': return T('studioSumHaiHigh');
    case 'sonnet-low': return T('studioSumSonLow');
    case 'haiku-medium': return T('studioSumHaiMed');
    default: return T('studioSumSonMed');
  }
}
function outName(k) {
  switch (k) {
    case 'same': return T('studioOutSame');
    case 'compact': return T('studioOutCompact');
    case 'mkv': return T('studioOutMkv');
    case 'small': return T('studioOutSmall');   // מ1
    case 'thumb': return T('studioOutThumb');   // סבב 7
    case 'en': return T('studioOutEn');
    case 'inst': return T('studioOutInst');   // 26/10/2026: קריוקי
    case 'lrc': return T('studioOutLrc');
    case 'elrc': return T('studioOutElrc');
    case 'ass': return T('studioOutAss');
    default: return T('studioOutSrt');
  }
}
function outSub(k) {
  switch (k) {
    case 'same': return T('studioOutSameS');
    case 'compact': return T('studioOutCompactS');
    case 'mkv': return T('studioOutMkvS');
    case 'small': return T('studioRrSmallSub');   // סבב 8
    default: return T('studioOutSrtS');
  }
}
const outShort = (k) => (k === 'srt' ? 'SRT' : k === 'en' ? T('studioOutEnShort') : k === 'same' ? T('studioOutSameShort') : outName(k));
const modeShort = (m) => FAM_NAME[m.fam] + ' ' + m.effort;   // לשורות צרות ("Opus Medium")
function styleName(k) {
  switch (k) {
    case 'classic': return T('studioStyleClassic');
    case 'karaoke': return T('studioStyleKaraoke');
    default: return T('studioStyleBold');
  }
}
/* שלבי העבודה — שם פשוט ומשפט הסבר (מהתוכנית: "שגם ילד וגם אדם מבוגר יבינו") */
function stageName(id, to, subs) {
  if (subs === 'ka' && (id === 'up' || id === 'tr' || id === 'al' || id === 'bn')) return id === 'up' ? T('studioStgUpKa') : id === 'tr' ? T('studioStgTrKa') : id === 'al' ? T('studioStgAlKa') : T('studioStgBnKa');   // 26/10/2026: קריוקי
  if (subs && (id === 'up' || id === 'tr' || id === 'al' || id === 'bn')) return id === 'up' ? T('studioStgUpSubs') : id === 'tr' ? T('studioStgTrSubs') : id === 'al' ? T('studioStgAlSubs') : T('studioStgBnSubs');   // 22/10/2026
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
function stageSub(id, subs) {
  if (subs === 'ka' && (id === 'up' || id === 'tr' || id === 'al' || id === 'bn')) return id === 'up' ? T('studioStgUpKaS') : id === 'tr' ? T('studioStgTrKaS') : id === 'al' ? T('studioStgAlKaS') : T('studioStgBnKaS');
  if (subs && (id === 'up' || id === 'tr' || id === 'al' || id === 'bn')) return id === 'up' ? T('studioStgUpSubsS') : id === 'tr' ? T('studioStgTrSubsS') : id === 'al' ? T('studioStgAlSubsS') : T('studioStgBnSubsS');
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
    case 'user_paused': return T('studioErrPaused');   // 29/10/2026: המנהל השהה את החשבון
    case 'no_server': return T('studioErrNoServer');
    case 'worker_oom': return T('studioErrOom');
    case 'worker_crash': return T('studioErrCrash');
    case 'worker_lost': return T('studioErrLost');   // 14/10/2026   // 11/10/2026: קריסה ≠ זיכרון (ההודעה המשותפת הטעתה — PR #66)
    case 'not_admin': return T('studioErrNotAdmin');
    case 'mode_locked': return T('studioErrModeLocked');   // 15/10: המצב לא פתוח לחשבון הזה
    case 'eng_locked': return T('studioErrEngLocked');   // 25/10: רק השרת של המערכת לחשבון הזה
    case 'net': case 'http_0': return T('studioErrNet');
    case 'drive_full': return T('studioErrDriveFull');
    case 'not_connected': case 'revoked': case 'drive_auth': return T('studioErrDrive');
    case 'conn_missing': return T('studioErrConn');
    case 'gd_not_configured': return T('studioDriveNoCfg');
    case 'gd_popup': return T('studioDrivePopup');
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
    case 'lang_unsupported': return T('studioLangSoon');
    case 'ka_lyrics': return T('studioKaNeedLyr');   // 26/10/2026: קריוקי
    case 'ka_noaudio': return T('studioKaNoAudio');
    case 'bad_url': return T('studioErrBadUrl');
    case 'bad_key': return T('studioErrBadKey');
    case 'vault_not_configured': return T('studioErrVault');
    case 'stalled': return T('studioErrNet');
    case 'resume_limit': return T('studioErrResumeLimit');
    case 'tower_stop': return T('studioErrTower');
    case 'halted': return T('studioErrHalted');
    case 'maint': return T('studioErrMaint') + (extra && extra.msg ? ' · ' + extra.msg : '');   // 15/10/2026: מצב תחזוקה
    case 'flag_off': return T('studioErrFlagOff');
    case 'gold_full': return T('studioErrGoldFull');   // v387: סט הזהב
    case 'src_gone': return T('studioSrcGone');   // 26/10/2026: סרטון המקור נשמר יום מפתיחת הפרויקט
    case 'gold_busy': return T('studioErrGoldBusy');
    case 'no_gold': return T('studioGoldNone');
    case 'no_srt': return T('studioGoldNoSrt');
    case 'rule_mode': return T('studioErrRuleMode');
    case 'major': return T('studioErrMajor');   // v371
    case 'mode': return T('studioErrMode');   // v376
    case 'budget_stop': case 'budget_cap': return T('studioErrBudgetStop');
    case 'api_quota': return T('studioErrApiQuota');   // 21/10/2026
    case 'sub_limit': return T('studioErrSubLimit');   // 24/10/2026: ה־Routine — מגבלת המנוי
    case 'cli_missing': case 'cli_error': return T('studioErrCli');
    case 'relay_none': return T('studioErrRyNone');   // 24/10/2026: "המנוי שלי" דרך השרת
    case 'relay_lost': return T('studioErrRyLost');
    case 'relay_hub': case 'relay_error': case 'relay_bad': return T('studioErrRy');
    case 'api_auth': case 'api_model': case 'no_api_key': return T('studioErrApiKey');   // הסקירה: קודי מצב API
    case 'api_network': case 'api_timeout': case 'api_rate': case 'api_overloaded': return T('studioErrApiNet');
    case 'model_refusal': case 'api_blocked': return T('studioErrRefusal');   // 30/10/2026: api_blocked = מסנן התוכן חסם את התשובה
    case 'check_errors': return T('studioErrChecks');
    case 'max_tokens': return T('studioErrMaxTok');   // 11/10/2026
    case 'store_net': return T('studioErrStoreNet');   // 11/10/2026: האחסון (R2 / Drive) — ניתוק / חסימה
    case 'store_fail': return T('studioErrStoreFail');
    case 'ph_meta': return T('studioErrPhMeta');   // 24/10/2026: תרגום בטלפון
    case 'ph_words': return T('studioErrPhWords');   // 25/10/2026: שלב 2
    case 'cp_timeout': case 'cp_empty': return T('studioErrCp');   // סבב 10: העתק־הדבק — לא הודבקה תשובה
    case 'r2_needed': return T('studioLinkApiOnly');
    default:
      if (/^url_/.test(String(code || ''))) return urlErrText(code);   // 22/10/2026: הורדה מקישור
      return T('studioErrGeneric', { c: String(code || '?').slice(0, 30) });
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
    drive: d && d.drive && d.name ? Object.assign({ id: d.drive.id, name: d.name, size: d.size, type: d.type, dur: d.drive.dur || 0 }, d.drive.bx ? { bx: true } : {}) : null,   // או סרטון שכבר ב־Drive
    from: d ? d.from : 'auto',
    to: s.to.slice(), mode: s.mode, out: Object.assign({}, s.out), style: s.style === 'karaoke' ? 'bold' : s.style,
    sty: normSty(store.settings.sty),   // 26/10/2026: העיצוב האחרון שבחרת = ברירת המחדל
    terms: d ? d.terms : '',
    subs: null, sdh: 'rm', trk: null,   // שלב 4: רצועות הכתוביות שבתוך הסרטון (רק בזיכרון)   // 22/10/2026: קובץ כתוביות קיים (בזיכרון בלבד — בלי טיוטה) ומה עושים עם SDH
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
/* 21/10/2026 (מחקר הצפי): דיוק שמוצג רק עד כמה שהוא אמיתי — עד 10 דק׳ בדקות, עד שעה בעיגול ל־5 דק׳,
   מעל שעה ל־10 דק׳; בלי שניות בראש המסך. צפי של "43 דקות" מבטיח דיוק שאין לנו, והמספר קופץ בכל רענון */
function fmtLeft(sec) {             // "55 דקות" / "שעה ו־40 דק׳" — בראש מסך ההתקדמות
  let m = Math.round(Math.max(0, sec) / 60);
  if (m < 1) return T('studioLt1');
  if (m >= 10) m = Math.round(m / (m >= 60 ? 10 : 5)) * (m >= 60 ? 10 : 5);
  if (m < 60) return T('studioMinLong', { m });
  return m % 60 ? T('studioHM', { h: Math.floor(m / 60), m: m % 60 }) : T('studioHOnly', { h: m / 60 });
}
function fmtSecShort(sec) {         // מתחת לדקה וחצי — בשניות ("40 שנ׳"), אחרת כמו fmtShort
  return sec < 90 ? T('studioSecs', { n: Math.max(1, Math.round(sec)) }) : fmtShort(sec);
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
    if (SA && SA.ready) await SA.ready;   // 14/10/2026: הדף מצויר לפני שהחיבור ענה — פעולות שצריכות חשבון מחכות לו
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
/* 26/10/2026: רשימת הקבצים ב־Drive (במקום Google Picker) — חיבור שלישי, נפרד: drive.readonly, ופעולות gb… בשרתון
   (lib/gdrive.js → browse). הגישה הרחבה לא מגיעה לחיבור של הסטודיו, שהעובד ב־Routine מקבל */
const SCOPE_BROWSE = 'openid email https://www.googleapis.com/auth/drive.readonly';
let gbc = null, gbAsked = false;
function gb() {
  if (!gbc) gbc = createBackup({
    owner: () => { try { return localStorage.getItem('pwa_owner_v1') || 'local'; } catch (e) { return 'local'; } },
    libApi: (body) => net.driveApi(Object.assign({}, body, { op: String(body.op || '').replace(/^gd/, 'gb') })), idToken: idTok,
    scopes: SCOPE_BROWSE,
    redirectUri: () => new URL('oauth.html', document.baseURI).href,
    openWindow: () => { try { return window.open('', 'snb-oauth', 'popup,width=480,height=700'); } catch (e) { return null; } },
    waitCode: waitOAuthCode,
    allBooksRaw: async () => [], putBook: async () => {}, getFile: async () => null,
    ls: (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; })(),
  });
  return gbc;
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
    ui.normR = normNorms(j.norm) || ui.normR;
    ui.normA = normNorms(j.normA) || ui.normA;   // 11/10: הרגיל לפי המנוע — curNorm() בוחר
    ui.sh = normSh(j.sh);   // v384: מצב צל לכל מצב (כמה עבודות עד אכיפה)
    ui.fb = normFb(j.fb) || ui.fb;
    ui.fm = j.fm === 'auto' ? 'auto' : 'suggest';   // v366: מסלול התיקונים (ברירת מחדל — הצעות לאישור)
    ui.ops = normOps(j.ops) || ui.ops;
    setInc(j.inc, j.now);   // v371: תקלות ותקלה רחבה
    ui.rl = normRules(j.rl);
    ui.halt = num(j.halt);
    ui.api = normApi(j.api) || ui.api;   // מצב API של המערכת: תקציב חודשי ושרתים
    ui.eta = normEta(j.eta) || ui.eta;   // 10/10/2026: מודל הצפי (לעבודות שעוד לא נלקחו)
    ui.sc = normScan(j.sc) || ui.sc;   // v378: בדיקת המוכנות האחרונה
    ui.kt = j.kt && j.kt.s > 0 && j.kt.j > 0 ? { s: +j.kt.s, j: +j.kt.j } : null;   // 26/10: כמה זמן הקבצים נשמרים (לאומדן)
    ui.r2 = j.r2 === true;              // 11/10: האחסון שלנו (R2) מוגדר — המילון שם, בלי צורך ב־Drive
    ui.gb = j.gb === true;              // 26/10/2026: רשימת הקבצים ב־Drive מוגדרת בשרתון
    if (j.gb === 'r' && !gbAsked) { gbAsked = true; gb().config().then((c) => { if (c.configured) { ui.gb = true; gbAsked = 'y'; if (root) render('none'); } }).catch(() => {}); }   // השרת שלנו בלי המשתנים — אולי ב־Vercel
    else if (j.gb === 'r' && gbAsked === 'y') ui.gb = true;
    if (!lrnBusy) ui.lrn = j.lrn !== false;   // 14/10/2026: מאגר הלמידה — דולק כברירת מחדל
    ui.lra = num(j.lra);                       // 15/10 (מ׳1): ההודעה על מאגר הלמידה כבר נקראה
    ui.lrt = num(j.lrt);                       // 15/10: הנוסח שאומר שגם הטקסט נשמר — נקרא
    ui.lrm = num(j.lrm);                       // מ׳4: הנוסח שאומר שגם הקול ועותק ב־240p נשמרים — נקרא
    ui.url = j.url === true;                   // 22/10/2026: הורדה מקישור (כל מי שמורשה לסטודיו מ־30/10, הדגל, R2)
    ui.yc = j.yc === true;                     // 25/10/2026: יוטיוב לענן דרך חשבון ייעודי בשרת (הוגדר במרכז הניהול ולא נחסם)
    ui.mf = j.mf === true;                     // 15/10: כל מצבי התרגום (המנהל / רשימת "כל המודלים") — אחרת רק "רגיל" ו"ביצועים"
    store.st = { api: ui.api || null, mf: ui.mf };   // 29/10/2026 (S1): לפתיחה הבאה
    ui.lrf = num(j.lrf);                       // 15/10: הנוסח של האיסוף המלא (תקופת הפיתוח) — נקרא
    save();
    lrnNotice();
  } else ui.access = j.error === 'signin' || j.error === 'no_auth' ? 'signin' : j.error === 'not_allowed' ? 'denied' : j.error === 'net' ? 'offline' : j.error === 'fs_http_429' ? 'quota' : 'error';
  repaint();
}
/* 28/10/2026: מכסת הקריאות של Firestore מתאפסת בחצות בשעון קליפורניה — השעה הזו בשעון המקומי */
function quotaReset(now = Date.now()) {
  try {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' });
    const p = {}; for (const x of f.formatToParts(new Date(now))) p[x.type] = +x.value;
    const left = (86400 - ((p.hour % 24) * 3600 + p.minute * 60 + p.second)) * 1000;
    return new Date(now + left).toLocaleTimeString(uiLang() === 'en' ? 'en-GB' : 'he-IL', { hour: '2-digit', minute: '2-digit' });
  } catch (e) { return '10:00'; }
}
let jobsAt = 0;
const JOBS_FULL_MS = 5 * 60e3;
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
  ui.slo = normSlo(j.slo) || ui.slo;   // v383: תקציב שגיאות
  ui.an = normAn(j.an) || ui.an;   // v385: ציון חריגה
  const have = new Map(store.jobs.map((x) => [x.id, x]));
  const ids = new Set();
  const rr = new Map(), pv = new Map();
  for (const sj of j.jobs) {
    if (!sj || !JOB_RE.test(String(sj.id || ''))) continue;
    if (sj.sm === 1) continue;   // פריט 13: עבודת הבדיקה אחרי עדכון של העובד — רק במרכז הניהול ובהתראות, לא ברשימה
    if (sj.kind === 'dx' || sj.kind === 'ai') continue;   // 26/10/2026: עבודות משנה (שמירה ב־Drive, גיליון ה־AI) — נעקבות לפי המזהה, לא ברשימה
    if (sj.kind === 'rr') { const x = normJob({ id: sj.id, srv: sj }); if (x && x.srv.rp) (sj.spec && sj.spec.prv === 1 ? pv : rr).set(x.srv.rp, x); continue; }   // מ2; סבב 10: צריבה לבדיקה — בנפרד
    ids.add(sj.id);
    const loc = have.get(sj.id);
    if (loc) adoptSrv(loc, sj);
    else {                         // עבודה ממכשיר אחר / אחרי ניקוי — מה שכבר עלה רשום בשרתון
      const rec = recFromSrv(sj);
      if (rec) store.jobs.push(rec);
    }
  }
  const keep = (x) => ids.has(x.id) || (runs.get(x.id) && runs.get(x.id).active);
  for (const x of store.jobs) if (!keep(x)) { idbOp('thumbs', 'del', x.id); thumbs.delete(x.id); }   // 21/10/2026: עבודה שנמחקה (גם אחרי חודש, בשרתון) — גם התמונה
  store.jobs = store.jobs.filter(keep).sort((a, b) => b.created - a.created);
  rrJobs = rr; rrPv = pv;
  save();
  // v371: התקלה הרחבה עברה — עבודות שחיכו לה מתחילות לבד
  if (ui.inc && !majorOn(ui.inc)) for (const r of store.jobs.filter((x) => x.up.wait === 'major' && !x.up.started)) { r.up.wait = ''; tryStart(r.id); }
  // 25/10/2026: סירוב חולף (תחזוקה, דגל כבוי) — שוב לבד כל START_GAP. עבודה שהשרתון כבר התחיל (גם מהבדיקה המתוזמנת) — בלי המתנה
  for (const r of store.jobs) {
    if (r.srv && r.srv.state !== 'new') { if (r.up.wait && !r.up.started) { r.up.wait = ''; r.up.started = r.srv.fired || Date.now(); } continue; }
    if (startRetryDue(r.up, Date.now()) && (r.up.link || r.up.ext || r.up.a.done || r.up.v.done)) tryStart(r.id);
  }
  goldAuto();   // שלב 4
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
// סבב 8: גרסה 2 — גם 'drafts' (טיוטות העורך). שדרוג לא מוחק: רק מה שחסר נוצר
// 21/10/2026: גרסה 3 — גם 'thumbs' (התמונות הממוזערות של העבודות)
const IDB_STORES = ['handles', 'drafts', 'thumbs'];
function hdb() {
  return new Promise((ok, no) => {
    const r = indexedDB.open('snb-studio', 3);
    r.onupgradeneeded = () => { for (const n of IDB_STORES) if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
}
async function idbOp(store, mode, id, val) {
  if (typeof indexedDB === 'undefined') return null;
  try {
    const db = await hdb();
    return await new Promise((ok) => {
      const tx = db.transaction(store, mode === 'get' ? 'readonly' : 'readwrite'), os = tx.objectStore(store);
      const rq = mode === 'get' ? os.get(id) : mode === 'put' ? os.put(val, id) : os.delete(id);
      rq.onsuccess = () => ok(mode === 'get' ? rq.result || null : null); rq.onerror = () => ok(null);
    });
  } catch (e) { return null; }
}
const handleOp = (mode, id, val) => idbOp('handles', mode, id, val);

/* ---------------- 21/10/2026 (בקשת המשתמש — לפי ת־נגן): תמונה ממוזערת לכל עבודה ----------------
   פריים מהסרטון עצמו, בטלפון בלבד (בלי שרת ובלי עלות): מהקובץ המקומי כשמתחילים עבודה, ואחרת מהסרטון בענן דרך ה־SW
   (אותה כתובת של הנגן — באותו מקור, כך שהקנבס לא "מוכתם"). JPEG קטן ב־IndexedDB ('thumbs', לפי מזהה העבודה).
   הפריים הראשון שאינו כהה/אחיד מבין כמה נקודות (פתיח שחור לא נבחר); עבודה אחת בכל פעם, עד THUMB_WAIT לכל אחת */
export const THUMB_W = 320, THUMB_WAIT = 20000;
export const THUMB_AT = [0.2, 0.08, 0.4, 0.6];   // חלקים מהאורך — לפי הסדר
export function thumbTimes(dur) {   // טהורה: מתי לנסות (שניות). אורך לא ידוע — שתי נקודות קבועות
  const d = Number(dur) || 0;
  if (!(d > 0) || !isFinite(d)) return [1, 0];
  return THUMB_AT.map((f) => Math.max(0, Math.min(d - 0.1, Math.round(d * f * 10) / 10)));
}
export function thumbOk(mean, sd) { return mean > 24 && mean < 235 && sd > 14; }   // טהורה: לא שחור, לא לבן, לא אחיד
const thumbs = new Map();          // מזהה → כתובת data: ('' = לא הצליח בסשן הזה)
const thumbWait = new Map();       // מזהה → [פונקציות שמחכות לתמונה]
let thumbChain = Promise.resolve();   // אחרי thumbsLoad (בהמשך) — קודם מה ששמור, ורק אז פריימים חדשים
function grabFrame(src, wait) {
  return new Promise((ok) => {
    if (typeof document === 'undefined' || !src) { ok(''); return; }
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'metadata'; v.setAttribute('playsinline', '');
    let best = null, done = false, times = [];
    const end = (u) => { if (done) return; done = true; clearTimeout(to); try { v.removeAttribute('src'); v.load(); } catch (e) {} ok(u || (best && best.u) || ''); };
    const to = setTimeout(() => end(''), wait || THUMB_WAIT);
    const shot = () => {
      try {
        const w = v.videoWidth, hh = v.videoHeight;
        if (!w || !hh) return null;
        const c = document.createElement('canvas');
        c.width = THUMB_W; c.height = Math.max(1, Math.round(THUMB_W * hh / w));
        const x = c.getContext('2d');
        x.drawImage(v, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height).data;
        let n = 0, sm = 0, sq = 0;
        for (let i = 0; i < d.length; i += 64) { const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; n++; sm += l; sq += l * l; }
        const mean = sm / n, sd = Math.sqrt(Math.max(0, sq / n - mean * mean));
        return { u: c.toDataURL('image/jpeg', 0.72), mean, sd };
      } catch (e) { return null; }
    };
    const next = () => {
      if (!times.length) { end(''); return; }
      const t = times.shift();
      if (Math.abs(v.currentTime - t) < 0.05) onSeek(); else v.currentTime = t;
    };
    const onSeek = () => {
      if (done) return;
      const r = shot();
      if (r && (!best || r.sd > best.sd)) best = r;
      if (r && thumbOk(r.mean, r.sd)) { end(r.u); return; }
      next();
    };
    v.addEventListener('seeked', onSeek);
    v.addEventListener('error', () => end(''));
    v.addEventListener('loadedmetadata', () => { times = thumbTimes(v.duration); next(); }, { once: true });
    v.src = src;
  });
}
/* מאיפה לקחת פריים — מהקטן לגדול: איכות הצפייה הנמוכה ביותר (H.264 קטן), העותק הצרוב (הקטן קודם), ואז המקור.
   עד 21/10 רק המקור — סרטון כבד (או בקודק שהטלפון לא מפענח) לא הספיק בזמן, ולחלק מהעבודות לא הייתה תמונה */
function thumbSources(rec) {
  if (!rec || !net || typeof net.mediaUrl !== 'function') return [];
  const out = [], add = (id, wait) => { const u = id && net.mediaUrl(id); if (u && !out.some((x) => x.u === u)) out.push({ u, wait }); };
  const hl = rec.srv && Array.isArray(rec.srv.hl) ? rec.srv.hl : null;
  if (hl && hl.length > 1) add(hl[hl.length - 1].id, 12000);
  for (const k of ['small', 'compact', 'same']) { const o = outOf(rec, k); if (o) add(o.id, 15000); }
  add(rec.up && rec.up.v && rec.up.v.id, 25000);
  return out;
}
/* כל התמונות השמורות נטענות לזיכרון פעם אחת, מיד כשהמודול נטען — כך הרשימה מצוירת איתן מהפריים הראשון,
   בלי סמל שמתחלף לתמונה בכל פתיחה */
function thumbsLoad() {
  if (typeof indexedDB === 'undefined') return Promise.resolve();
  return hdb().then((db) => new Promise((ok) => {
    try {
      const os = db.transaction('thumbs', 'readonly').objectStore('thumbs'), rq = os.openCursor();
      // 29/10/2026: כל תמונה גם מפוענחת מראש (thumbEl) — הציור הראשון של הבית (מחכה עד 400ms) כבר עם התמונות, בלי אריח ריק
      const dec = [];
      rq.onsuccess = () => { const c = rq.result; if (!c) { Promise.all(dec).then(() => ok()); return; } if (typeof c.value === 'string' && c.value && !thumbs.has(c.key)) { thumbs.set(c.key, c.value); try { dec.push(thumbEl(c.key, c.value).decode().catch(() => {})); } catch (e) {} } c.continue(); };
      rq.onerror = () => ok();
    } catch (e) { ok(); }
  })).catch(() => {});
}
function thumbSet(id, u) {
  thumbs.set(id, u);
  const w = thumbWait.get(id); thumbWait.delete(id);
  if (w) for (const f of w) { try { f(u); } catch (e) {} }
}
/* התמונה של העבודה: מיד אם בזיכרון; אחרת קוראים מ־IndexedDB, ואם אין — פריים מהסרטון (בתור). cb נקרא כשיש.
   עוד אין סרטון בענן (עולה) — לא נרשם ככישלון, ומנסים שוב בציור הבא; ניסיון שנכשל — לא שוב בסשן הזה */
const thumbBusy = new Set();
/* 21/10/2026: עבודה שבוטלה לפני שהסרטון עלה — אין ממה לקחת פריים; עבודות אחרות של אותו קובץ (שם + גודל) נותנות אותה תמונה */
function thumbSibs(rec) {
  const sp = rec && rec.spec;
  if (!sp || !sp.name || !sp.size || typeof store === 'undefined' || !store || !Array.isArray(store.jobs)) return [];
  return store.jobs.filter((x) => x && x.id !== rec.id && x.spec && x.spec.name === sp.name && x.spec.size === sp.size);
}
function thumbFor(rec, cb, file) {
  if (!rec || !rec.id) return '';
  const id = rec.id, have = thumbs.get(id);
  if (have) return have;
  if (have === '' && !file) return '';
  if (cb) { const w = thumbWait.get(id) || []; w.push(cb); thumbWait.set(id, w); }
  if (thumbBusy.has(id)) return '';
  thumbBusy.add(id);
  thumbChain = thumbChain.then(async () => {
    let u = thumbs.get(id) || '', tried = false;
    if (!u && !file) u = await idbOp('thumbs', 'get', id) || '';
    const sibs = file ? [] : thumbSibs(rec);
    if (!u) for (const x of sibs) { u = thumbs.get(x.id) || ''; if (u) break; }   // אותו קובץ בעבודה אחרת — אותה תמונה
    if (!u) {
      const srcs = file ? [{ u: URL.createObjectURL(file), wait: THUMB_WAIT }] : thumbSources(rec);
      for (const x of sibs) for (const y of thumbSources(x)) if (!srcs.some((z) => z.u === y.u)) srcs.push(y);
      for (const x of srcs) { tried = true; u = await grabFrame(x.u, x.wait); if (u) break; }
      if (file) URL.revokeObjectURL(srcs[0].u);
      if (u) idbOp('thumbs', 'put', id, u);
    }
    thumbBusy.delete(id);
    if (u || tried) thumbSet(id, u || ''); else thumbWait.delete(id);
  }).catch(() => { thumbBusy.delete(id); thumbSet(id, ''); });
  return '';
}
/* ציור התמונה על אריח (.st-thumb) — דהייה כשהיא מגיעה אחרי הציור; בלי תמונה נשאר סמל הסרט */
/* 29/10/2026 (פרויקט "עמודים סטטיים", ס2/ס3 — "הבית מופיע בלי הכרטיסים", "כרטיס ריק אחרי הנחיתה"): התמונה = <img> מפוענח
   ששמור בזיכרון לפי עבודה, לא background-image. רקע מ־data: מפוענח מחדש בכל ציור של הבית, והאריח נשאר ריק כמה פריימים
   בטלפון. אותו צומת עובר מציור לציור (גם בהעתק של הקובייה — cloneNode חולק את אותה תמונה מפוענחת) */
const thumbEls = new Map();
function thumbEl(id, u) {
  let im = thumbEls.get(id);
  if (!im || im._u !== u) {
    im = new Image(); im.className = 'st-tim'; im.alt = ''; im.decoding = 'sync'; im._u = u; im.src = u;
    try { im.decode().catch(() => {}); } catch (e) {}
    thumbEls.set(id, im);
    if (thumbEls.size > 80) thumbEls.delete(thumbEls.keys().next().value);
  }
  return im;
}
function paintThumb(th, rec) {
  const put = (u) => { th.prepend(thumbEl(rec.id, u)); th.classList.add('img'); };
  const t0 = Date.now();
  const u = thumbFor(rec, (x) => { if (!x) return; if (Date.now() - t0 > 250) th.classList.add('in'); put(x); });   // דהייה רק לתמונה חדשה שמגיעה אחרי שהמסך כבר מוצג
  if (u) put(u);
}
export const thumbsReady = thumbChain = thumbsLoad();   // מיד בטעינת המודול — studio-app.js מחכה לו (עד 400ms) לפני הציור הראשון

/* סבב 8: טיוטת עורך הכתוביות — שינויים שלא נשמרו שורדים רענון וסגירה (בטלפון בלבד, לפי מזהה העבודה).
   ev = הגרסה בשרתון שעליה נערך; טיוטה על גרסה ישנה יותר — רק באישור (אחרת הייתה דורסת שמירה מאוחרת) */
export const DRAFT_MAX = 4 * 1048576;
export function draftRec(cues, ev, now) {
  const c = toCuesJson(cues);
  return c.length > DRAFT_MAX ? null : { v: 1, ev: Math.max(0, Math.floor(Number(ev) || 0)), at: Math.floor(Number(now) || 0), c };
}
export function draftUse(d, ev) {   // 'same' | 'old' | '' — מה לעשות בטיוטה שנמצאה
  if (!d || d.v !== 1 || typeof d.c !== 'string' || d.c.length > DRAFT_MAX) return '';
  let cues;
  try { cues = normCues(JSON.parse(d.c)); } catch (e) { return ''; }
  if (!cues.length) return '';
  return d.ev === Math.max(0, Math.floor(Number(ev) || 0)) ? 'same' : d.ev < (Number(ev) || 0) ? 'old' : '';
}
const draftDel = (id) => idbOp('drafts', 'del', id);
const canPickHandle = () => typeof window !== 'undefined' && typeof window.showOpenFilePicker === 'function';
async function pickWithHandle() {
  try {
    const [hnd] = await window.showOpenFilePicker({ multiple: false, types: [{ description: 'Video', accept: { 'video/*': ['.mp4', '.mov', '.mkv', '.m4v', '.webm', '.avi'] } }] });
    return { file: await hnd.getFile(), handle: hnd };
  } catch (e) { return e && e.name === 'AbortError' ? { cancel: true } : null; }
}

/* ---------------- 21/10/2026: מדידת ההעלאה מהטלפון (פרויקט השיפור המתמיד) ----------------
   הצילום של המשתמש: "מוציאים את הקול ושולחים אותו קודם" — 17 דק׳, בזמן שהסרטון המלא עלה אחר כך ב־4–6MB/שנ׳. בלי מדידה
   מהטלפון אי אפשר לדעת אם זה החילוץ, דף מואט ברקע או משהו אחר. רק מספרים (בלי שמות) → op:'upTel' → job.utl.
   **UTL_KEYS זהה ל־UTL_KEYS בשרתון (lib/studio.js)** */
export const UTL_KEYS = ['c2s', 'ex', 'ab', 'a', 'v', 'vb', 'hid', 'hn', 'rs', 'wt', 'wl', 'wlr', 'nt', 'dl', 'dm', 'hc', 'vf', 'bg', 'dvp', 'dvs', 'dvn'];   // 25/10/2026: dvp/dvs/dvn — המכשיר (devCodes)   // bg — ההעלאה ברקע: 1 הצליחה, 2 חזרה לרגילה, 3 הדפדפן לא תומך
export function normUtl(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out = {};
  for (const k of UTL_KEYS) { const v = Number(o[k]); if (Number.isFinite(v) && v >= 0 && v <= 1e11) out[k] = Math.round(v); }
  return Object.keys(out).length ? out : null;
}
const NET_CODE = { wifi: 1, cellular: 2, ethernet: 3 };
/* 25/10/2026 (משתמש מאייפון — ולא ידענו מאיזה מכשיר עבד): רק קודים, בלי מחרוזת הדפדפן. dvp: 1 iOS (גם iPad שמציג את עצמו
   כמק) · 2 אנדרואיד · 3 מחשב · 4 אחר. dvs: 1 בדפדפן · 2 מותקן במסך הבית. dvn (התראות לטלפון): 1 מאושר · 2 נחסם · 3 לא נשאל ·
   4 לא נתמך (באייפון — רק כשמותקן במסך הבית) */
export function devCodes(nav, win) {
  const ua = String((nav && nav.userAgent) || ''), tp = (nav && nav.maxTouchPoints) || 0;
  const dvp = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && tp > 1) ? 1 : /Android/.test(ua) ? 2 : /Windows|Macintosh|Linux|CrOS/.test(ua) ? 3 : 4;
  let st = false;
  try { st = !!(nav && nav.standalone) || !!(win && win.matchMedia && win.matchMedia('(display-mode: standalone)').matches); } catch (e) {}
  const N = win && win.Notification, p = N && N.permission;
  return { dvp, dvs: st ? 2 : 1, dvn: !N ? 4 : p === 'granted' ? 1 : p === 'denied' ? 2 : 3 };
}
function utlOf(rec) {
  const tl = rec.up.tl || (rec.up.tl = {});
  try { if (typeof navigator !== 'undefined') Object.assign(tl, devCodes(navigator, typeof window !== 'undefined' ? window : null)); } catch (e) {}
  try {
    const c = navigator.connection;
    if (c) { tl.nt = NET_CODE[c.type] || (c.type ? 4 : 0); if (c.downlink > 0) tl.dl = Math.round(c.downlink * 10); }
    if (navigator.deviceMemory) tl.dm = Math.round(navigator.deviceMemory * 10);
    if (navigator.hardwareConcurrency) tl.hc = navigator.hardwareConcurrency;
  } catch (e) {}
  return tl;
}
function utlAdd(rec, k, v) { const tl = utlOf(rec); tl[k] = Math.round((tl[k] || 0) + v); }
function utlSend(id) {
  const rec = jobRec(id), tl = rec && normUtl(rec.up.tl);
  if (tl) { try { Promise.resolve(net.api('upTel', { job: id, tl })).catch(() => {}); } catch (e) {} }
}
let wlDenied = false;
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('visibilitychange', () => {        // כמה זמן הדף היה ברקע בזמן העלאה (Chrome מאט / עוצר דף מוסתר)
    const now = Date.now();
    for (const [id, r] of runs) {
      if (!r || !r.active) continue;
      if (document.visibilityState === 'hidden') r.hid0 = now;
      else if (r.hid0) { const rec = jobRec(id); if (rec) { utlAdd(rec, 'hid', now - r.hid0); utlAdd(rec, 'hn', 1); } r.hid0 = 0; }
    }
  });
}

/* ---------------- ההעלאה — רצה ברקע גם כשיוצאים מהסטודיו (כל עוד האפליקציה פתוחה) ---------------- */
const runs = new Map();           // id → { active, phase, p, sent, total, rate, wait, err, need, ctl, file, t0 }
let wl = null, wlWant = false;    // מסך דולק בזמן העלאה (אנדרואיד משהה לשוניות ברקע)
async function wakeOn() {
  wlWant = true;
  if (wl || typeof navigator === 'undefined' || !navigator.wakeLock || document.visibilityState !== 'visible') return;
  try {
    wl = await navigator.wakeLock.request('screen');
    wl.addEventListener('release', () => {
      wl = null;
      for (const [id, r] of runs) if (r && r.active) { const rec = jobRec(id); if (rec) utlAdd(rec, 'wlr', 1); }   // המסך יכול לכבות באמצע
    });
  } catch (e) { wl = null; wlDenied = true; }
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
/* 27/10/2026 (בטלפון: "עלו 140MB" ואז 120MB): התצוגה של ההעלאה לא יורדת — במעבר מההעלאה ברקע לרגילה (היא סופרת
   רק חלקים שהשרתון אישר) ובחלק שנכשל באמצע (הבתים שלו נשלחים שוב) הבתים שהוצגו כבר נספרו. עד שההעלאה משיגה — עומד */
function upHi(run, key, b) {
  if (run.hiK !== key) { run.hiK = key; run.hi = 0; }
  if (b > run.hi) run.hi = b;
  return run.hi;
}
function tickRate(run, bytes) {
  const now = Date.now();
  if (!run.rs || bytes < run.rs.b) { run.rs = { t: now, b: bytes }; return; }
  const dt = (now - run.rs.t) / 1000;
  if (dt >= 2) { const r = (bytes - run.rs.b) / dt; run.rate = run.rate ? run.rate * 0.65 + r * 0.35 : r; run.rs = { t: now, b: bytes }; }
}
const isAbortErr = (e) => !!e && (e.name === 'AbortError' || e.code === 'aborted');
/* 25/10/2026 (צילום מהטלפון: "עלו 38MB מתוך 90MB · ממשיך כשההעלאה חוזרת" אחרי שההתראה אמרה שהסרטון עלה): כש־Background Fetch
   מסתיים בלי הדף, ה־service worker רושם את הסרטון בשרתון (r2bgDone) — אבל המצב בטלפון (up.v) נשאר במה שנשמר לפני הסגירה.
   השרתון הוא מקור האמת: סרטון שרשום שם = עלה, גם כאן (בלי לגעת בהעלאה שרצה עכשיו בדף — היא נסגרת לבד) */
/* עבודה ממכשיר אחר / אחרי ניקוי / הרצת זהב — מה שכבר רשום בשרתון. 25/10/2026: עבודה מקישור / מ־Drive — בלי העלאה מהטלפון
   הזה (עד היום חיכתה כאן לקובץ שלא יגיע, ולא יכלה להתחיל), וקוד הסירוב מהשרתון (sw) */
export function recFromSrv(sj) {
  const f = sj.files || {}, link = !!(sj.spec && sj.spec.src === 'url'), ext = !!(f.v && f.v.ext), sw = sj.state === 'new' && typeof sj.sw === 'string' ? sj.sw : '';
  return normJob({ id: sj.id, created: sj.created, spec: sj.spec, srv: sj,
    up: { a: { done: !!f.a || link || ext, id: f.a && f.a.id, size: f.a && f.a.size }, v: { done: !!f.v || link, id: f.v && f.v.id, size: f.v && f.v.size },
      link, ext, extReg: ext, noAudio: link ? 'link' : ext ? 'ext' : '', wait: sw, wt: sw ? Date.now() : 0 } });
}
function adoptSrv(rec, sj) {
  rec.srv = normJob({ id: rec.id, srv: sj }).srv;
  const fv = sj && sj.files && sj.files.v, run = runs.get(rec.id);
  if (!fv || !FID_RE.test(String(fv.id || '')) || fv.ext || rec.up.v.done || (run && run.active)) return;
  rec.up.v = { done: true, id: String(fv.id), size: num(fv.size) || rec.spec.size, uri: '', sent: num(fv.size) || rec.spec.size };
  if (run && run.need) runs.delete(rec.id);
  if (bgStore) bgStore.del(bgIdOf(rec.id)).catch(() => {});
}
async function register(id, which, fid, folder, ext, bx) {
  const j = await net.api('file', Object.assign({ job: id, which, id: fid, folder }, ext ? { ext: true } : {}, ext && bx ? { bx: true } : {}));
  if (!j.ok) throw Object.assign(new Error(j.error || 'file'), { code: j.error || 'file' });
  const rec = jobRec(id); if (rec && j.job) rec.srv = normJob({ id, srv: j.job }).srv;
}
/* v361: "המשך" — השרתון מפעיל את ה־Routine שוב עם מפתח חדש; העובד ממשיך מנקודת השמירה האחרונה */
async function resumeSrv(id, ov, mo, mode, lo) {
  const rec = jobRec(id); if (!rec || ui.resuming) return;
  ui.resuming = id; render('none');
  const j = await net.api('resume', Object.assign({ job: id }, ov ? { ov: true } : {}, mo ? { mo: true } : {}, mode ? { mode } : {}, lo ? { lo: true } : {}));
  ui.resuming = '';
  if (j.job) rec.srv = normJob({ id, srv: j.job }).srv;
  if (j.ok && mode && j.job && j.job.spec && j.job.spec.mode === mode) rec.spec.mode = mode;   // v376: עברנו למצב הזול יותר
  // v367: מצב מעל המקסימום שבחוקים — הפעולה מחכה לאישור שלך
  if (!j.ok && j.error === 'rule_mode' && typeof askConfirm === 'function') askConfirm(T('studioRuleModeQ'), () => resumeSrv(id, true, mo, mode), { ok: T('studioStartAnyway') });
  else if (!j.ok && j.error === 'major' && typeof askConfirm === 'function') askConfirm(T('studioMajorQ', { c: opsComp(j.mi && j.mi.c) }), () => resumeSrv(id, ov, true, mode, lo), { ok: T('studioStartAnyway') });   // v371
  // v384: "המשך" שלישי ב־24 שעות — כנראה לולאה; ממשיכים רק באישור מפורש
  else if (!j.ok && j.error === 'loop' && typeof askConfirm === 'function') askConfirm(T('studioLoopQ', { n: Math.max(3, j.n | 0) }), () => resumeSrv(id, ov, mo, mode, true), { ok: T('studioLoopOk'), danger: true });
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
async function tryStart(id, ov, mo, ow) {
  const rec = jobRec(id); if (!rec || rec.up.started) return;
  // v367: ov = "להתחיל בכל זאת" (מצב מעל המקסימום) · v371: mo = להתחיל למרות תקלה רחבה
  const j = await net.api('start', Object.assign({ job: id }, ov ? { ov: true } : {}, mo ? { mo: true } : {}, ow ? { ow: true } : {}));
  // 29/10/2026 (למנהל): משתמש אחר מתרגם עכשיו — להתחיל בכל זאת (ow), או לחכות ולקבל התראה כשיסיים (adminWait)
  if (!j.ok && j.error === 'others_busy' && j.ob && typeof askConfirm === 'function') {
    askConfirm(T('studioBusyQ', { n: String(j.ob.nm || ''), p: Math.round((Number(j.ob.p) || 0) * 100) }), () => tryStart(id, ov, mo, true),
      { ok: T('studioStartAnyway'), cancel: T('studioBusyWait'), onNo: async () => { const w = await net.api('adminWait', { on: true }); flashSafe(w.ok ? T('studioBusyWaitOk') : errText(w.error)); } });
    return;
  }
  if (j.job) rec.srv = normJob({ id, srv: j.job }).srv;
  startDone(rec, j);
  save(); paintSoon();
}
/* 25/10/2026: תוצאת "התחל" — מהטלפון (tryStart) או מהיצירה של עבודה מקישור (create עם start:true) */
function startDone(rec, j) {
  if (j.ok) { rec.up.started = Date.now(); rec.up.wait = ''; rec.up.wt = 0; }
  else { rec.up.wait = String(j.error || 'failed').slice(0, 40); rec.up.wt = Date.now(); }
}
/* 25/10/2026: המשוב שלך על התרגום (בקשת המשתמש, לפי התצוגה המקדימה). נגיעה אחת ב־👍/👎; אחרי 👎 — "מה לא היה טוב?"
   (קודים קבועים) ואפשר לסמן כתוביות בנגן. לשרתון רק קודים ומספרי כתוביות (op:'rate'), בלי טקסט.
   **RATE_WHY, RATE_FLAG_MAX ו־normRate זהים בשרתון (lib/studio.js)** — tests/studio-rate.test.js */
export const RATE_WHY = ['acc', 'nat', 'tim', 'nm', 'brk', 'ovl', 'mis', 'oth'];
export const RATE_FLAG_MAX = 60;
export function normRate(o) {
  if (!o || typeof o !== 'object') return null;
  const r = o.r === 1 || o.r === -1 ? o.r : 0;
  const w = r === -1 && Array.isArray(o.w) ? RATE_WHY.filter((k) => o.w.includes(k)) : [];
  const c = Array.isArray(o.c) ? [...new Set(o.c.filter((x) => Number.isInteger(x) && x >= 0 && x < 1e6))].sort((a, b) => a - b).slice(0, RATE_FLAG_MAX) : [];
  if (!r && !c.length) return null;
  const at = Number.isFinite(+o.at) && +o.at > 0 ? Math.floor(+o.at) : 0;
  return Object.assign({ r }, w.length ? { w } : {}, c.length ? { c } : {}, at ? { at } : {});
}
/* 25/10/2026: סירוב חולף — הטלפון מנסה שוב לבד (הבדיקה המתוזמנת בשרתון עושה את אותו דבר גם כשהטלפון סגור).
   **START_RETRY זהה ל־START_RETRY בשרתון (lib/studio.js)**. major — בנפרד (כשהתקלה הרחבה עוברת) */
export const START_RETRY = ['maint', 'flag_off', 'major'];
const START_GAP = 2 * 60e3;
export function startRetryDue(up, now) {
  return !!up && !up.started && START_RETRY.includes(up.wait) && up.wait !== 'major' && now - (up.wt || 0) >= START_GAP;
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
  { const tl = utlOf(rec); tl.rs = (tl.rs || 0) + 1; if (!tl.c2s && rec.created) tl.c2s = Math.max(0, run.t0 - rec.created); }
  const upFp = () => (Number(rec.up.a.sent) || 0) + (Number(rec.up.v.sent) || 0) + (Number(run.sent) || 0);
  const onWaitT = (e) => {
    utlAdd(rec, 'wt', 1);
    run.blk = upBlockStep(run.blk, upFp(), e && (e.code || e.message), Date.now());
    if (!run.blkEv && upBlocked(run.blk, upFp(), Date.now())) { run.blkEv = run.evd = true; opsEvent(id, [{ c: 'phone', k: 'stall' }]); }   // מגדל הפיקוח — פעם אחת להעלאה
    paintSoon();
  };
  try {
    if (!up.folder) { up.folder = await net.jobFolder(id, fileTitle(rec.spec.name)); save(); }
    if (rec.spec.src === 'subs') {   // 22/10/2026: קובץ כתוביות — העלאה אחת קטנה, רישום (s) והתחלה. הקובץ במקום של הקול (up.a)
      run.phase = 'audio'; run.p = 0; run.total = rec.spec.size; run.sent = 0; paintSoon();
      if (!up.a.done) {
        if (!file) throw Object.assign(new Error('repick'), { code: 'repick' });
        const f = await net.upload({ blob: file, size: file.size, mime: file.type || 'text/plain', signal: sig, gate: () => gate(run),
          r2: up.a.r2, onR2: (x) => { up.a.r2 = x; save(); },
          meta: { name: rec.spec.name, parents: [up.folder], appProperties: { snbJob: id, snbPart: 's' } },
          onProgress: (b) => { run.sent = b; run.p = b / file.size; paintSoon(); }, onWait: onWaitT });
        await register(id, 's', f.id, up.folder);
        up.a = { done: true, id: f.id, size: Number(f.size) || file.size, uri: '', sent: file.size };
        up.v = Object.assign({}, up.v, { done: true });   // אין סרטון — "ההעלאה" הסתיימה
        up.took = Math.round((Date.now() - run.t0) / 1000);
        save();
      }
      if (!up.started) await tryStart(id);
      run.phase = 'done';
      return;
    }
    if (up.ph) { run.phase = 'done'; return; }   // 24/10/2026: תרגום בטלפון — Studio לאנדרואיד מעלה ומתחיל (PhService)
    if (up.link) {   // 22/10/2026: מקישור — אין מה להעלות: העובד מוריד ישר ל־R2 ורושם את הקבצים בעצמו
      run.phase = 'prep'; paintSoon();
      if (!up.started) await tryStart(id);
      run.phase = 'done';
      return;
    }
    if (up.ext) {   // סרטון מ־Drive: נשאר במקומו — רק רישום בשרתון (מאומת מול Drive: קיים, בגודל, סרטון) והתחלה
      run.phase = 'prep'; paintSoon();
      if (!up.extReg) { await register(id, 'v', up.v.id, up.folder, true, up.bx); up.extReg = true; save(); }
      if (!up.started) await tryStart(id);
      run.phase = 'done';
      return;
    }
    // 1+2. הקול והסרטון — uploadBoth (studionet.js): הסרטון מתחיל מיד במקביל לחילוץ, הקול עולה ראשון כשהוא מוכן, והסרטון
    // שסיים לפני החילוץ עוצר אותו (21/10/2026 — "הקול לקח 17 דק׳")
    let tx = 0, ta = 0, tv = 0;
    let audioSettle = null;   // 23/10/2026: הסרטון ברקע מתחיל רק אחרי הקול (Background Fetch אי אפשר להשהות כמו vGate)
    const audioSettled = new Promise((r) => { audioSettle = r; });
    if (up.a.done || up.noAudio) audioSettle();
    await uploadBoth({
      signal: sig, gate: () => gate(run),
      needAudio: !up.a.done && !up.noAudio, needVideo: !up.v.done,
      onPhase: (ph) => {
        run.phase = ph; run.p = 0; run.rs = null;
        if (ph === 'video') { run.total = file.size; run.sent = up.v.sent || 0; run.p = run.sent / file.size; }
        paintSoon();
      },
      extract: (signal) => {
        tx = Date.now();
        return extractAudio(file, { onProgress: (p) => { if (run.phase === 'extract') { run.p = p; paintSoon(); } }, signal })
          .finally(() => utlAdd(rec, 'ex', Date.now() - tx));
      },
      noAudio: (why, videoFirst) => { up.noAudio = why; if (videoFirst) utlOf(rec).vf = 1; save(); audioSettle(); },
      upAudio: (ex) => {
        const size = ex.blob.size;
        run.sent = 0; run.total = size;
        utlOf(rec).ab = size;
        ta = Date.now();
        return net.upload({ blob: ex.blob, size, mime: ex.blob.type, signal: sig, gate: () => gate(run),
          r2: up.a.r2, onR2: (x) => { up.a.r2 = x; save(); },
          meta: { name: fileTitle(rec.spec.name) + ' — ' + T('studioAudioFile') + '.' + ex.ext, parents: [up.folder], appProperties: { snbJob: id, snbPart: 'a' } },
          onProgress: (b) => { run.sent = b; run.p = b / size; tickRate(run, b); paintSoon(); },
          onWait: onWaitT }).finally(() => utlAdd(rec, 'a', Date.now() - ta));
      },
      audioDone: async (f, ex) => {
        await register(id, 'a', f.id, up.folder);
        up.a = { done: true, id: f.id, size: Number(f.size) || ex.blob.size, uri: '', sent: ex.blob.size };
        up.took = Math.round((Date.now() - run.t0) / 1000);
        save();
        utlSend(id);                           // כבר עכשיו — גם אם הסרטון ייתקע, יודעים כמה לקח הקול
        audioSettle();
      },
      start: () => (up.a.done ? tryStart(id) : null),
      upVideo: async (vGate) => {
        utlOf(rec).vb = file.size;
        const vProg = (b) => {
          up.v.sent = b;
          if (run.phase === 'video') { const s = upHi(run, 'v', b); run.sent = s; run.p = s / file.size; tickRate(run, s); }
          paintSoon(); saveSoon();
        };
        // 29/10/2026 (בטלפון: העלאה איטית ונתקעת, "כשנכנסים לאפליקציה לזמן מה זה מסתדר"): Background Fetch שולח חלק אחד
        // בכל פעם בעדיפות נמוכה (פי ~5 לאט), וההעלאה הרגילה קופאת כשהדף ברקע. לכן לפי מצב הדף: מוצג — הרגילה; ברקע
        // BG_HAND_MS (והקול כבר עלה) — החלקים החסרים עוברים ל־Background Fetch (אותה העלאה ב־R2, אותו גודל חלק); חוזרים
        // לדף — מיד חזרה לרגילה, שממשיכה מהחלקים שהגיעו. בכל מקרה הרגילה מסיימת (סוגרת / ממשיכה)
        const bgOk = await bgCan(rec, file);
        let aDone = false, bgOff = false, bgRe = 0, cur = null;
        const shown = () => typeof document === 'undefined' || document.visibilityState === 'visible';
        const handOk = () => bgOk && !bgOff && aDone && !shown();
        const flip = (want, ms) => {   // signal שנעצר בעצירה / מחיקה, וגם כש־want() מחזיק ms — אז flipped() = מחליפים דרך
          const c = new AbortController(), ab = () => c.abort();
          let t = 0, fl = false;
          const chk = () => { clearTimeout(t); if (want()) t = setTimeout(() => { if (want() && !c.signal.aborted) { fl = true; c.abort(); } }, ms); };
          if (sig.aborted) c.abort(); else sig.addEventListener('abort', ab, { once: true });
          document.addEventListener('visibilitychange', chk); chk();
          return { signal: c.signal, chk, flipped: () => fl && !sig.aborted,
            done: () => { clearTimeout(t); sig.removeEventListener('abort', ab); document.removeEventListener('visibilitychange', chk); } };
        };
        audioSettled.then(() => { aDone = true; if (cur) cur.chk(); });
        tv = Date.now();
        try {
          if (bgOk && shown()) await Promise.race([bgAbort(id), new Promise((r) => setTimeout(r, 3000))]);   // העלאה ברקע מפעם קודמת שעוד רצה — לא במקביל לרגילה (אותם חלקים); בלי לחכות לנצח ל־ready
          for (;;) {
            if (handOk()) {
              await vGate();
              const f = cur = flip(shown, 0);
              run.bg = true;
              let r = null;
              try { r = await bgTry(rec, id, file, f.signal, vProg); } catch (e) { if (!f.flipped()) throw e; } finally { f.done(); cur = null; run.bg = false; }
              // נכשל / לא נתמך — עד סוף ההעלאה הזו רק הרגילה. 29/10/2026: נתקע כשהדף מוסתר — הרגילה קפואה ממילא, אז Background
              // Fetch חדש מהחלקים שכבר הגיעו (עד BG_RE פעמים); השרתון מתריע לטלפון אם גם זה לא זז (upStallCheck)
              if (r && !r.ok && !(r.stall && r.hid && ++bgRe <= BG_RE)) bgOff = true;
            }
            const f = cur = flip(handOk, BG_HAND_MS);
            try {
              return await net.upload({ blob: file, size: file.size, mime: file.type || 'application/octet-stream', signal: f.signal, gate: vGate,
                uri: up.v.uri || '', onUri: (u) => { up.v.uri = u; save(); }, r2: up.v.r2, onR2: (x) => { up.v.r2 = x; save(); },
                meta: { name: rec.spec.name, parents: [up.folder], appProperties: { snbJob: id, snbPart: 'v' } },
                onProgress: vProg,
                onWait: onWaitT });
            } catch (e) { if (!f.flipped()) throw e; } finally { f.done(); cur = null; }
          }
        } finally { utlAdd(rec, 'v', Date.now() - tv); }
      },
      videoDone: async (f) => {
        await register(id, 'v', f.id, up.folder);
        up.v = { done: true, id: f.id, size: Number(f.size) || file.size, uri: '', sent: file.size };
        if (!up.took) up.took = Math.round((Date.now() - run.t0) / 1000);
        save();
        handleOp('get', id).then((hd) => { if (hd && hd.inbox) inboxOp('del', hd.inbox); handleOp('del', id); });   // 22/10/2026: העותק מההורדה בטלפון — לא צריך יותר (המקור ב־Movies/Studio)
      },
    });
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
    if (run.hid0) { utlAdd(rec, 'hid', Date.now() - run.hid0); run.hid0 = 0; }
    { const tl = utlOf(rec); tl.wl = wl ? 1 : wlDenied ? 2 : 0; }
    save(); wakeOffIfIdle(); repaint();
    utlSend(id);
  }
}
/* v365: אירוע למגדל הפיקוח מהטלפון — בלי לחכות ובלי לעצור כלום אם נכשל */
function opsEvent(id, ev) { try { net.api('event', { job: id, ev }).catch(() => {}); } catch (e) {} }
/* v368: חלון חסימה לעדכון — גרסה חדשה של האפליקציה לא מרעננת את הדף באמצע העלאה (app.js שואל לפני הרענון) */
if (typeof window !== 'undefined') window.snbStudioBusy = () => Array.from(runs.values()).some((r) => r && r.active);
function stopRun(id) { const r = runs.get(id); if (r && r.active) r.ctl.abort(); }

/* ---------------- 23/10/2026: הסרטון ב־Background Fetch (studiobg.js) — ממשיך גם כשהאפליקציה סגורה ---------------- */
const BG_RE = 2;          // 29/10/2026: כמה פעמים מתחילים Background Fetch מחדש אחרי תקיעה כשהדף מוסתר
const BG_HAND_MS = 8000;   // 29/10/2026: כמה זמן הדף ברקע לפני שההעלאה עוברת ל־Background Fetch (מעבר מהיר בין אפליקציות — לא מחליפים)
const BG_RETRY_MS = 30 * 86400e3;   // דפדפן שסירב — מנסים שוב אחרי חודש (עדכון של Chrome)
const bgStore = typeof indexedDB !== 'undefined' ? bgDb(indexedDB) : null;
const bgEnv = {
  reg: () => navigator.serviceWorker.ready,
  Request: typeof Request !== 'undefined' ? Request : null,
  put: (x) => (bgStore ? bgStore.put(x) : null), del: (k) => (bgStore ? bgStore.del(k).catch(() => {}) : null),
  base: () => proxyBase(), lang: () => uiLang(), now: () => Date.now(),
  visible: () => typeof document === 'undefined' || document.visibilityState === 'visible',
  // 27/10/2026: העלאה ברקע של עבודה אחרת נשארת רק כשהסרטון שלה עוד לא נרשם והעבודה לא הסתיימה (bgSweep)
  keep: (job) => { const r = jobRec(job); return !!(r && r.up && !(r.up.v && r.up.v.done) && !(r.srv && ['done', 'failed', 'cancelled'].includes(r.srv.state))); },
};
async function bgCan(rec, file) {
  const s = store.settings, up = rec.up;
  return bgEligible({ size: file.size, r2: isR2Folder(up.folder), ext: !!up.ext, wifi: s.wifi, off: !!(s.bgNo && Date.now() - s.bgNo < BG_RETRY_MS),   // 29/10/2026: bgSl לא חוסם — הרקע רק כשהדף ברקע
    // 29/10/2026: רק באנדרואיד — במחשב הדף ממשיך להעלות גם ברקע (ובמהירות מלאה), ובאייפון אין Background Fetch
    api: typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent || '') && !!navigator.serviceWorker && typeof BackgroundFetchManager !== 'undefined' && !!bgStore,
    up: await bgUpOk() });
}
/* מנסה; בכל מקרה ממשיכים אחר כך בהעלאה הרגילה — היא רק סוגרת כשהכל הגיע, או ממשיכה מהחלקים החסרים */
/* 26/10/2026: מה כבר ב־R2 (השרתון) — ההתקדמות האמיתית בזמן העלאה ברקע (Chrome באנדרואיד לא תמיד מדווח לדף) */
function bgPoll(id, up) {
  return async () => {
    const st = up.v.r2 || {};
    if (!st.id || !st.up) return null;
    const j = await net.api('r2parts', { job: id, id: st.id, up: st.up });
    return j && j.ok ? j : null;
  };
}
async function bgTry(rec, id, file, sig, onProgress) {
  const up = rec.up;
  const r = await bgUpload({ api: net.api, job: id, name: rec.spec.name, blob: file, size: file.size, mime: file.type || 'application/octet-stream',
    st: up.v.r2, onState: (x) => { up.v.r2 = x; save(); }, onProgress, signal: sig, title: T('studioBgTitle'), icon: 'icon-studio-192.png', poll: bgPoll(id, up) }, bgEnv)
    .catch(() => ({ fallback: 'bg_err' }));
  utlOf(rec).bg = r.ok ? 1 : r.unsupported ? 3 : r.stall ? 4 : r.slow ? 5 : 2;   // 4 = Chrome קיבל ולא התקדם
  if (r.unsupported) { store.settings.bgNo = Date.now(); save(); }
  if (r.slow) { store.settings.bgSl = Date.now(); save(); }   // 5 = Chrome התקדם אבל לאט מההעלאה הרגילה
  // 26/10/2026: נתקע — הפעם ממשיכים בהעלאה הרגילה; פעם שנייה בטלפון הזה = לא מנסים חודש. הצליח — מתחילים לספור מחדש
  if (r.stall) { const st = (store.settings.bgS2 || 0) + 1; store.settings.bgS2 = st; if (st >= 2) store.settings.bgNo = Date.now(); save(); }
  else if (r.ok && store.settings.bgS2) { delete store.settings.bgS2; save(); }
  if (r.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
  return r;
}
/* אחרי רענון בלי הקובץ: Background Fetch שעדיין רץ / שהסתיים — מחכים לו, סוגרים ורושמים (בלי בלוב: רק כשכל החלקים
   הגיעו — ההעלאה הרגילה צריכה את הקובץ לחלקים חסרים). false = אין כזה / נכשל → "בחרו שוב" כמו היום */
async function bgResume(id) {
  const rec = jobRec(id); if (!rec) return false;
  const up = rec.up, st = up.v.r2 || {};
  if (up.v.done || !isR2Folder(up.folder) || !st.id || !(up.a.done || up.noAudio)) return false;
  let bg = null;
  try { const reg = navigator.serviceWorker && await navigator.serviceWorker.ready; bg = reg && reg.backgroundFetch && await reg.backgroundFetch.get(bgIdOf(id)); } catch (e) { bg = null; }
  if (!bg || bg.result === 'failure') return false;
  const prev = runs.get(id);
  if (prev && prev.active) return true;
  const size = rec.spec.size;
  const run = { active: true, phase: 'video', p: 0, sent: 0, total: size, rate: 0, wait: '', err: '', need: false, file: null, t0: Date.now(), ctl: new AbortController(), bg: true };
  runs.set(id, run); paintSoon();
  try {
    const r = await bgUpload({ api: net.api, job: id, size, st, signal: run.ctl.signal, poll: bgPoll(id, up),
      onProgress: (b) => { const s = upHi(run, 'v', b); run.sent = s; run.p = s / size; tickRate(run, s); paintSoon(); } }, bgEnv).catch(() => ({ fallback: 'bg_err' }));
    if (!r.ok) throw new Error('bg');
    const j = await net.api('r2done', { job: id, id: st.id, up: st.up });
    if (!j.ok) throw new Error('bg');
    await register(id, 'v', st.id, up.folder);
    up.v = { done: true, id: st.id, size, uri: '', sent: size };
    save();
    if (!up.started) await tryStart(id);
    run.phase = 'done';
    return true;
  } catch (e) {
    Object.assign(run, { phase: 'need', need: true });
    return false;
  } finally { run.active = false; repaint(); }
}
/* מחיקה / ביטול של עבודה שהסרטון שלה עולה ברקע בלי הדף (אחרי רענון) */
async function bgAbort(id) {
  try {
    const reg = navigator.serviceWorker && await navigator.serviceWorker.ready;
    const bg = reg && reg.backgroundFetch && await reg.backgroundFetch.get(bgIdOf(id));
    if (bg && !bg.result) await bg.abort();
  } catch (e) {}
  if (bgStore) bgStore.del(bgIdOf(id)).catch(() => {});
}
/* המשך אחרי רענון / עצירה: הקובץ מהזיכרון, מהידית השמורה, או שמבקשים לבחור שוב (ובודקים שזה אותו קובץ) */
async function resumeJob(id, byUser) {
  const rec = jobRec(id); if (!rec) return;
  const run = runs.get(id);
  let file = run && run.file;
  if (!file) {
    const hnd = await handleOp('get', id);
    if (hnd && hnd.inbox) { const e = await inboxOp('get', hnd.inbox); if (e && e.f instanceof Blob) file = e.f; }   // 22/10/2026: מההורדה בטלפון
    else if (hnd && typeof hnd.getFile === 'function') {
      try {
        let perm = typeof hnd.queryPermission === 'function' ? await hnd.queryPermission({ mode: 'read' }) : 'granted';
        if (perm !== 'granted' && byUser && typeof hnd.requestPermission === 'function') perm = await hnd.requestPermission({ mode: 'read' });
        if (perm === 'granted') file = await hnd.getFile();
      } catch (e) {}
    }
  }
  // 23/10/2026: אין קובץ (אין ידית שמורה), אבל הסרטון כבר עולה ברקע / עלה — מצטרפים, בלי "בחרו שוב"
  if (!file && await bgResume(id)) return;
  if (!file || !sameFile(file, rec.fp)) {
    if (file && byUser) flashSafe(T('studioWrongFile'));
    runs.set(id, Object.assign(run || {}, { active: false, need: true, phase: 'need' }));
    repaint();
    return;
  }
  startRun(id, file);
}
/* 1/11/2026: חזרה לאפליקציה — העלאה של סרטון שנעצרה בזמן שהעבודה כבר רצה ממשיכה לבד (ידית עם הרשאה / Background Fetch
   שעוד רץ); אחרת המסך מראה "לבחור שוב" (upHalt) */
function upRevive() {
  for (const rec of store.jobs) { const r = runs.get(rec.id); if (upHalt(rec, r) === 'paused' && !(r && r.phase === 'error')) resumeJob(rec.id, false); }   // שגיאה — רק בכפתור
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
  inp.accept = f.ka ? 'audio/*,video/*,.mp3,.m4a,.wav,.flac,.ogg,.opus,.mkv,.mov,.mp4,.webm' : 'video/*,.mkv,.mov,.mp4,.m4v,.webm,.avi';   // קריוקי — גם שיר בלי וידאו
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
const kaJob = (id) => !!(store && store.jobs && store.jobs.some((r) => r && r.id === id && r.spec && r.spec.ka));
export function chainFor(v, p) {
  if ((v === 'lang' && p !== 'def') || v === 'tracks' || v === 'link' || v === 'linkfmt' || v === 'linksec' || v === 'fmthelp' || v === 'grab' || v === 'cutsrc' || v === 'dpick') { v = 'new'; p = form && form.ka ? 'ka' : null; }   // הטופס (והקובץ) לא שורדים רענון; 30/10: טופס של שיר — תחת הקריוקי
  const parent = (x, y) => (x === 'home' ? null : x === 'connect' || (x === 'def' && y === 'cap') ? ['eng', null] : x === 'def' || (x === 'lang' && y === 'def') ? ['defs', null] : (x === 'lang' || x === 'tower' || x === 'guide' || x === 'adv' || x === 'eng' || x === 'defs' || x === 'store' || x === 'push') ? ['settings', null] : x === 'gloss' ? ['rules', null] : x === 'alert' || x === 'inc' ? ['alerts', null] : x === 'prob' ? ['probs', null] : x === 'rules' || x === 'towerx' || x === 'rlb' || x === 'rlm' ? ['tower', null] : x === 'agents' || x === 'server' || x === 'value' || x === 'scan' || x === 'slo' || x === 'anom' || TW_SUBS.includes(x) ? ['towerx', null] : x === 'edit' ? ['project', y] : x === 'play' || x === 'subs' || x === 'rr' ? ['job', y] : x === 'cut' || x === 'sty' || x === 'ov' ? ['rr', y] : x === 'ai' ? ['subs', y] : x === 'ideas' ? ['job', y] : x === 'vids' ? (vidsParent(y) || ['store', null]) : x === 'kasty' ? ['new', 'ka'] : (x === 'new' && y === 'ka') || (x === 'job' && kaJob(y)) ? ['ka', null] : ['home', null]);   // 30/10: שיר — תחת הקריוקי
  const out = [{ v, p }];
  for (let c = parent(v, p); c; c = parent(c[0], c[1])) out.unshift({ v: c[0], p: c[1] });
  return out;
}

function leaving() {              // יציאה מדף: המפתח שהודבק באשף לא נשאר בזיכרון
  if (ui.view === 'play') playClose();   // מ1: הנגן נעצר ומשחרר את הסרטון
  if (ui.view === 'subs') seStop();      // מ2: הנגן של העורך נעצר; העריכה נשארת בזיכרון
  if (ui.view === 'cut' || ui.view === 'cutsrc') ceStop();   // מ4–מ5: החיתוך עצמו נשמר (rrEdl / form.edl)
  if (ui.view === 'sty') syStop();   // סבב 5: העיצוב עצמו נשמר (rrOpt.sty / ההגדרות)
  if (ui.view === 'ov') ovpStop();   // סבב 7: הכותרת והלוגו נשמרים (ovT / ההגדרות)
  if (ui.view === 'connect') ui.wiz = { url: ui.wiz.url, key: '', busy: false, err: '' };
  if (ui.view === 'server') ui.newToken = '';   // טוקן שרת מוצג פעם אחת — יציאה מהדף מוחקת אותו מהזיכרון
}
function go(view, param, kind) {
  if (!root) return;
  const p = param == null ? null : param;
  // 29/10/2026 (בטלפון: מפרויקט שהסתיים צריך כמה "חזור"): אותו דף פעמיים ברצף (פתיחה מההתראה כשהעבודה כבר פתוחה,
  // לחיצה כפולה) נכנס פעמיים למחסנית — ו"חזור" הראשון רק הנפיש מהעבודה לאותה עבודה. הדף כבר מוצג — רק מציירים
  if (view === ui.view && p === ui.param) { repaint(); return; }
  scrolls[viewKey()] = root.scrollTop;
  leaving();
  ui.view = view; ui.param = p;
  if (CW_OK) { stack.push({ v: view, p }); syncState(); }
  else afterBack(() => { try { history.pushState(cleanState({ studio: depth() + 1, sv: view, sp: p }), ''); } catch (e) {} });
  render(kind || 'push');
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
    const was = stack.pop();
    while (stack.length > 1 && stack[stack.length - 1].v === was.v && stack[stack.length - 1].p === was.p) stack.pop();   // 29/10/2026: עותק של אותו דף — לא עוד "חזור"
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
  if (window.snbMenuClose && window.snbMenuClose()) { if (root) watch(); return; }   // התפריט של ההדר המשותף פתוח — "חזור" סוגר רק אותו
  // חלון אישור של האפליקציה (askConfirm) פתוח — "חזור" = הביטול שלו (יש לו רשומה משלו, והוא מוריד אותה)
  if (vlUp()) { if (root) watch(); return; }   // 26/10/2026: ״הסרטונים שלי״ — ״חזור״ בתוך תיקייה = תיקייה אחת למעלה
  if (rsClose()) { if (root) watch(); return; }   // 25/10/2026: הגיליון "מה לא היה טוב?" — "חזור" סוגר רק אותו   // ה־Picker של Google פתוח — "חזור" סוגר רק אותו
  const plm = document.querySelector('.st-pl-menu:not([hidden])');   // תפריט ההגדרות של הנגן — "חזור" סוגר אותו (לפי ת־נגן)
  const dlg = document.querySelector('.dlg-veil.on');
  if (dlg) { const b = dlg.querySelector('.dlg-cancel') || dlg.querySelector('.dlg-ok'); if (b) b.click(); }
  else if (plm) plm.click();
  else back();
  if (root) watch();
}
function onPop(e) {
  if (!root) return;
  const ds = document.documentElement.dataset;
  if (ds.modalPop || ds.navSkip) return;   // חלון של האפליקציה נסגר ב"חזור" / back פנימי שלה — לא ניווט של הסטודיו
  if (swipePop > 0) { swipePop--; return; }   // 14/10/2026: חזרה לבית בהחלקה — הדף כבר צויר
  const uaT = !!(e && e.hasUAVisualTransition);   // Chrome כבר הנפיש "חזור" משלו (משיכה מצד המסך) — בלי אנימציה שנייה
  const st = history.state || {};
  if (!st.studio && SA) return;            // עצמאי — יציאה מהדף, אין לאן לחזור בתוכו
  if (!st.studio) { closeStudio(uaT); appToOverview(); return; }
  if (CW_OK) return;                       // עם CloseWatcher הדפים לא ברשומות (כאן רק "קדימה" חזרה לרשומה שלנו)
  scrolls[viewKey()] = root.scrollTop;
  leaving();
  ui.view = st.sv || 'home'; ui.param = st.sp == null ? null : st.sp;
  render('pop', uaT);
}
/* ---------------- 14/10/2026: החלקה (core: snbSwipe — אותה חוקיות כמו ב־Invest ו־Academy) ----------------
   עמודים ראשיים = האחים של החוגה (ST_SIB); בעמוד משנה — החלקה אחורה = "חזור" (כמו האפשרויות המתקדמות ב־Invest).
   בלי "החלקה קצרה" לטאבים (בקשת המשתמש) — פרטים · ציר · קשורות רק בלחיצה.
   29/10/2026 (בקשת המשתמש): החוגה של Invest אחד לאחד, באדום — מימין לשמאל: הגדרות · העבודות (הבית, במרכז) · העבודה
   (הפעילה, ואם אין — האחרונה שהסתיימה) · מגדל הפיקוח. מה שמחוץ לחוגה ממופה לאח שלו (stKeyOf) */
const ST_SIB = ['ka', 'home', 'job', 'tower'];   // 30/10/2026 (בקשת המשתמש): מימין לשמאל — קריוקי · תרגום סרטונים (הראשי) · העבודה · המגדל; ההגדרות — רק מהתפריט   // 30/10/2026: קריוקי — כלי נפרד עם רשימה משלו (בקשת המשתמש)
const ST_NOSWIPE = ['play', 'subs', 'cut', 'cutsrc', 'tracks', 'dpick', 'vids', 'link', 'linkfmt', 'linksec', 'fmthelp', 'grab', 'sty', 'ov', 'new', 'edit', 'lang', 'connect', 'ai', 'rr'];   // עורכים, נגן וטפסים — בלי
const ST_TAB_KEYS = ['d', 't', 'r'];
let swipePop = 0;
let stDialJ = '';                 // העבודה שהחוגה פתחה — נשארת "העבודה" גם כשאחרת נעשית פעילה
function stDialJob() {            // הפעילה (בתור / רצה / בהעלאה), ואם אין — האחרונה שהסתיימה
  const on = store.jobs.find((r) => r && r.srv && !FINAL.includes(r.srv.state) && (r.srv.state !== 'new' || r.up.started));
  return on ? { rec: on, on: true } : (() => { const d = store.jobs.find((r) => r && r.srv && r.srv.state === 'done'); return d ? { rec: d, on: false } : null; })();
}
function stDialKeys() { const j = stDialJob() || (stDialJ && ui.view === 'job' && ui.param === stDialJ); return ST_SIB.filter((k) => (k !== 'job' || j) && (k !== 'ka' || kaOk())); }
function stKeyOf(v, p) {          // לאיזה פריט בחוגה שייך הדף
  const ch = chainFor(v, p);
  if (ch.some((x) => x.v === 'tower')) return 'tower';
  const j = ch.find((x) => x.v === 'job'), dj = stDialJob();
  if (j && (j.p === stDialJ || (dj && dj.rec.id === j.p))) return 'job';   // "העבודה" — משותפת לשני הכלים
  return ch.some((x) => x.v === 'ka') ? 'ka' : 'home';
}
function stSibTarget(k) {
  if (k === 'job') { const cur = ui.view === 'job' && stKeyOf(ui.view, ui.param) === 'job' ? ui.param : null, dj = stDialJob(); const id = cur || (dj && dj.rec.id); return id ? { v: 'job', p: id } : null; }
  return ST_SIB.includes(k) ? { v: k, p: null } : null;
}
function stSibOk() {              // דף ראשי שהבית נמצא ישר מתחתיו
  if (ui.view === 'job' ? stKeyOf('job', ui.param) !== 'job' : (!ST_SIB.includes(ui.view) || ui.param != null)) return false;
  if (CW_OK) return ui.view === 'home' ? stack.length <= 1 : stack.length === 2 && stack[0].v === 'home';
  return ui.view === 'home' ? depth() <= 1 : depth() === 2;
}
/* המחסנית / ההיסטוריה אחרי מעבר לאח (החלקה, חוגה): הבית לבד, או הבית ומעליו האח */
function stSibCommit(v, p) {
  if (v === 'job') stDialJ = p;
  if (CW_OK) { stack = v === 'home' ? [{ v: 'home', p: null }] : [{ v: 'home', p: null }, { v, p }]; syncState(); return; }
  // בלי CloseWatcher (דפדפן ישן): רק רשומה אחת אחורה / קדימה / במקום — בלי history.go עם ספירת רשומות (לקח v350–v352);
  // מעמוד משנה עמוק — האח מחליף את הרשומה הנוכחית
  const d = depth();
  if (v === 'home' && d === 2) { swipePop++; afterBack(() => { try { history.back(); } catch (e) {} }); return; }
  if (d <= 1 && v !== 'home') { afterBack(() => { try { history.pushState(cleanState({ studio: 2, sv: v, sp: p }), ''); } catch (e) {} }); return; }
  afterBack(() => { try { history.replaceState(cleanState({ studio: Math.max(1, d), sv: v, sp: p }), ''); } catch (e) {} });
}
function stSibPage(k) {           // הדף של אח בחוגה: ציור (באמצע קובייה), ביטול, אישור
  const t = stSibTarget(k);
  if (!t) return null;
  const pv = ui.view, pp = ui.param, y = root.scrollTop, key = viewKey();
  return {
    from: stKeyOf(pv, pp), to: k,
    render() { scrolls[key] = y; leaving(); ui.view = t.v; ui.param = t.p; render('sib'); if (root && scrolls[viewKey()]) root.scrollTop = scrolls[viewKey()]; },
    undo() { ui.view = pv; ui.param = pp; render('none'); if (root) root.scrollTop = y; },
    commit() { stSibCommit(t.v, t.p); stDialSync(true); },
  };
}
function stSwipePage(next) {
  if (ui.view === 'settings') return next ? null : stSibPage('home');   // 30/10/2026: ההגדרות (מהתפריט) — החלקה אחורה = "חזור" לעמוד הראשי
  if (stSibOk()) { const ks = stDialKeys(), k = ks[ks.indexOf(stKeyOf(ui.view, ui.param)) + (next ? 1 : -1)]; return k ? stSibPage(k) : null; }
  if (next || !CW_OK || stack.length < 2) return null;
  const back = stack[stack.length - 2], pv = ui.view, pp = ui.param, y = root.scrollTop, key = viewKey();
  return {
    from: stKeyOf(pv, pp), to: stKeyOf(back.v, back.p),
    render() { scrolls[key] = y; leaving(); ui.view = back.v; ui.param = back.p; render('sibpop'); },
    undo() { ui.view = pv; ui.param = pp; render('none'); if (root) root.scrollTop = y; },
    commit() { stack.pop(); syncState(); stDialSync(true); },
  };
}
/* ---- החוגה (המנוע ב־core: dialHost/wireDial — אותו של Invest) ---- */
const ST_DIAL_ICO = {
  // 30/10/2026 (בקשת המשתמש): הבית = תרגום סרטונים (מסך + כתובית), הקריוקי = תו, העבודה = משותפת לשניהם (פעימה)
  home: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M10.2 7.6v4.8l4-2.4z"/><path d="M7 16h5.5M14.5 16H17"/>',
  job: '<path d="M3 12h3.8l2.4-6.5 5.6 13 2.4-6.5H21"/>',
  tower: '<path d="M9.2 21l.9-8.5h3.8l.9 8.5M7 21h10M6.5 8.5h11l-1.6 4h-7.8zM12 8.5V4.5M9.8 4.5h4.4"/>',
  ka: '<circle cx="8.5" cy="17.5" r="3"/><path d="M11.5 17.5V3.5c0 2.6 4.8 3.4 4.8 7.2"/>',
};
let dialNav = null, dialPrev = null, stDialC = null;
function stDialNav() {
  if (dialNav || typeof dialNavBuild !== 'function') return dialNav;
  dialNav = dialNavBuild('st-dial', T('studioDialAria'), [
    { k: 'ka', ico: ST_DIAL_ICO.ka, lbl: T('studioDialKa') },
    { k: 'home', ico: ST_DIAL_ICO.home, lbl: T('studioDialHome') },
    { k: 'job', ico: ST_DIAL_ICO.job, lbl: T('studioDialLast') }, { k: 'tower', ico: ST_DIAL_ICO.tower, lbl: T('studioDialTower') },
  ], stDialTo);
  return dialNav;
}
const STUDIO_DIAL = {
  nav: () => dialNav, keys: stDialKeys, index: (k) => Math.max(0, stDialKeys().indexOf(k)),
  cur: () => (stDialC ? stDialC.from : stKeyOf(ui.view, ui.param)),
  begin(cur, to, side) {          // כמו ההחלקה (snbSwipe): העתק של השכבה יוצא, האח נצבע בשכבה עצמה
    if (!root || cubeReduce() || document.hidden) return null;
    const bd = cubeBackdrop(root);
    if (!to) { stDialC = { side, p: 0, rub: true, out: cubeFace(root, { dead: true }), bd, from: cur }; return stDialC; }
    const pg = stSibPage(to);
    if (!pg) { bd.remove(); return null; }
    // 29/10/2026 (סבב קפיצות 4): ההעתק נצבע שני פריימים לפני שהאח מצויר (core: cubePre). עד אז הקובייה "ממתינה" —
    // cubeSet רק שומר את p, ו־land/drop משלימים את ההכנה קודם
    const c = { side, p: 0, bd, from: cur, to };
    stDialC = c;
    const build = (ghost) => {
      c.pre = null;
      try { pg.render(); } catch (e) { ghost.remove(); bd.remove(); c.dead = true; if (stDialC === c) stDialC = null; return; }
      Object.assign(c, { out: cubeFace(ghost, { dead: true }), in: cubeFace(root), ghost, pg });
      delete c.warm;
      cubeSet(c, c.p || 0);
    };
    if (typeof cubePre === 'function') c.pre = cubePre(root, build); else build(cubeClone(root));
    return c.dead ? null : c;
  },
  drop(c) {
    if (c.pre) c.pre.now();
    if (c.dead) return;
    cubeSet(c, 0);
    if (c.pg) { try { c.pg.undo(); } catch (e) {} }
    cubeFaceOff(c.in); if (c.rub) cubeFaceOff(c.out);
    if (c.ghost) c.ghost.remove();
    c.bd.remove();
    if (stDialC === c) stDialC = null;
  },
  land(c) {
    if (c.pre) c.pre.now();
    if (c.dead) return;
    cubeSet(c, 1);
    cubeFaceOff(c.in); c.ghost.remove(); c.bd.remove();
    if (stDialC === c) stDialC = null;
    stSibCommit(ui.view, ui.param);   // האח כבר מצויר (begin)
    onEnter();
  },
  instant(to) { stDialTo(to, 'none'); },
};
function stDialTo(k, kind) {      // לחיצה על פריט: קובייה לכיוון שלו (כמו לשונית ב־Invest)
  if (!root) return;
  const t = stSibTarget(k);
  if (!t) return;
  if (ui.view === t.v && ui.param === t.p) { if (stSibOk()) { try { root.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { root.scrollTop = 0; } } else stSibCommit(t.v, t.p); return; }
  const ks = stDialKeys(), cur = stKeyOf(ui.view, ui.param), fwd = ks.indexOf(k) > ks.indexOf(cur);
  scrolls[viewKey()] = root.scrollTop;
  leaving();
  ui.view = t.v; ui.param = t.p;
  stSibCommit(t.v, t.p);
  render(kind || (k === cur ? 'pop' : fwd ? 'dfwd' : 'dback'));
}
/* מצב החוגה: גלויה רק בעמודים שאפשר לנווט מהם (לא בעורכים, בנגן ובטפסים); הכיתוב של "העבודה" — פעילה / אחרונה */
function stDialSync(instant) {
  if (!dialNav) return;
  const show = !!root && !ST_NOSWIPE.includes(ui.view) && !chainFor(ui.view, ui.param).some((x) => x.v === 'settings');   // בהגדרות — בלי חוגה
  dialNav.hidden = !show;
  document.documentElement.classList.toggle('st-dock', show);
  const dj = stDialJob(), jb = dialNav.querySelector('.tab[data-tab="job"]');
  const kb = dialNav.querySelector('.tab[data-tab="ka"]');
  if (kb) kb.hidden = !stDialKeys().includes('ka');
  if (jb) { jb.hidden = !stDialKeys().includes('job'); dialLabel(jb, dj && dj.on ? T('studioDialOn') : T('studioDialLast')); }
  if (show && !stDialC) dialSync(instant);
}
function segAfter() { const seg = root && root.querySelector('.st-page > .st-seg'); const out = []; for (let e = seg && seg.nextElementSibling; e; e = e.nextElementSibling) out.push(e); return out; }
function stTab(k, v) {            // טאב פנימי — התוכן נכנס מהצד של הטאב החדש (כמו החלפת רשימת מעקב)
  const was = ST_TAB_KEYS.indexOf(ui[k] || 'd'), now = ST_TAB_KEYS.indexOf(v);
  if (was === now) return;
  ui[k] = v;
  render('none');
  if (typeof cubeSlideIn === 'function') cubeSlideIn(segAfter(), cubeSideFwd(now > was));
}
function wireStSwipe() {
  if (typeof snbSwipe !== 'function' || !root) return;
  snbSwipe({ root: root, page: stSwipePage, dial: () => stKeyOf(ui.view, ui.param),
    ok: () => !!root && !ST_NOSWIPE.includes(ui.view) && !document.querySelector('.dlg-veil.on, .st-pl-menu:not([hidden]), .st-rs') });
}
/* כמו בספרייה (v350, בקשת המשתמש): "חזור" מדף הבית של הסטודיו — לסקירה. מטאב ראשי app.js כבר עבר אליה בפתיחה */
function appToOverview() {
  try { if (typeof switchTab === 'function' && typeof currentTabName === 'function' && currentTabName() !== 'overview') switchTab('overview'); } catch (e) {}
}
/* רענון בזמן שהסטודיו פתוח — index.html מוריד וילון בצבע הרקע עד שהדף הראשון מוכן (כמו בספרייה) */
function curtainDown(instant) {   // 14/10/2026: instant — פתיחה רגילה בדף העצמאי: הדף מופיע שלם בבת אחת (כמו Invest), בלי דהייה
  const e = document.documentElement;
  if (!e.classList.contains('lib-restoring')) return;
  if (instant) {
    // הלוגו בהדר — כבר מפוענח כשהדף מופיע (בלי "קפיצה" שלו פריים אחר כך); לכל היותר 400ms
    const lg = document.querySelector('.appbar .brand-logo');
    const go = () => { e.classList.remove('lib-restoring', 'lib-curtain'); e.style.removeProperty('--curtain'); };
    if (lg && lg.decode) Promise.race([lg.decode().catch(() => {}), new Promise((r) => setTimeout(r, 400))]).then(go);
    else go();
    return;
  }
  e.classList.remove('lib-restoring');
  setTimeout(() => { e.classList.remove('lib-curtain'); e.style.removeProperty('--curtain'); }, 400);
}

/* ---------------- רכיבים ---------------- */
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const ICON = {   // סמלים קבועים בלבד — אף פעם לא תוכן חיצוני
  more: '<circle cx="5.5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="18.5" cy="12" r="1.3" fill="currentColor"/>',   // 26/10/2026: "הסרטונים שלי"
  trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12.2a1 1 0 0 0 1 .8h7.2a1 1 0 0 0 1-.8L17.5 7M10.2 11v5.5M13.8 11v5.5"/>',
  folder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 9.7v8.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>',   // 26/10/2026: רשימת הקבצים ב־Drive
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  back: '<polyline points="9 6 15 12 9 18"/>',
  chev: '<polyline points="15 6 9 12 15 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<polyline points="5 12.5 10 17 19 7"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  note: '<circle cx="8.5" cy="17.5" r="3"/><path d="M11.5 17.5V3.5c0 2.6 4.8 3.4 4.8 7.2"/>',   // 30/10/2026: הקריוקי
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
  clock: '<circle cx="12" cy="12" r="8.6"/><path d="M12 7.5V12l3 2"/>',   // v385
  coin: '<circle cx="12" cy="12" r="8.6"/><path d="M14.6 9.2c-.5-.9-1.5-1.4-2.6-1.4-1.6 0-2.7.8-2.7 2s1.1 1.7 2.7 2 2.9.8 2.9 2.1-1.2 2.1-2.9 2.1c-1.2 0-2.3-.6-2.8-1.6M12 6v1.8M12 16.2V18"/>',
  power: '<path d="M17.7 7a8 8 0 1 1-11.4 0"/><path d="M12 3.5v8"/>',
  sliders: '<path d="M5 20v-6M5 10V4M12 20v-8M12 8V4M19 20v-4M19 12V4M2.5 14h5M9.5 8h5M16.5 16h5"/>',  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',   // v377: ערך ועלות
  share: '<path d="M12 15V3.5M7.5 8l4.5-4.5L16.5 8"/><path d="M8 11H6.5A1.5 1.5 0 0 0 5 12.5v6A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5v-6a1.5 1.5 0 0 0-1.5-1.5H16"/>',
  down: '<path d="M12 4v11.5M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',   // סבב 1: שיתוף / הורדה של התוצרים
  cc: '<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M10.2 10.3a2 2 0 1 0 0 3.4M16.2 10.3a2 2 0 1 0 0 3.4"/>',   // 22/10/2026: קובץ כתוביות
  edit: '<path d="M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4"/>',
  thumbUp: '<path d="M7 11v9H4v-9h3zM7 11l4-7c1.5 0 2.5 1 2.2 2.6L12.6 10H19a2 2 0 0 1 2 2.3l-1.2 6A2 2 0 0 1 17.8 20H7"/>',   // 25/10/2026: המשוב שלך
  thumbDn: '<path d="M17 13V4h3v9h-3zM17 13l-4 7c-1.5 0-2.5-1-2.2-2.6l.6-3.4H5a2 2 0 0 1-2-2.3l1.2-6A2 2 0 0 1 6.2 4H17"/>',
  flag: '<path d="M5 21V4h11l-1.5 4L16 12H5"/>',
  clip: '<rect x="8" y="3" width="8" height="4" rx="1.5"/><path d="M16 5h2a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2"/>',   // 22/10/2026: הדבקה redo: '<path d="M20 8H9a5 5 0 0 0 0 10h3M16 4l4 4-4 4"/>',   // מ2: עריכת כתוביות, הפקה מחדש
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
  else { lead = btn('st-back', null, o.go || back, 'nav-back'); const l = h('span', 'st-back-l'); l.append(h('bdi', null, o.back)); lead.append(ico('back'), l); }
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
/* ---------- מאגר הלמידה מ׳3 (15/10/2026): מה קרה אחרי העבודה ----------
   תוספות מספרים לכל עבודת תרגום (צפייה, הורדות ושיתוף, הצעות, גיליון ה־AI, מונחים), נשלחות יחד (op:'learnUx') אחרי
   8 שנ׳ שקט / כשהאפליקציה יורדת לרקע. השרתון מחליט אם לשמור (המתג של מאגר הלמידה). **UX_SHAPE זהה לשרתון (lib/studiolearn.js)** */
export const UX_SHAPE = { e: ['s', 'ws', 'n', 'cd', 'wd', 'm', 'wa', 'ca', 'sb', 'sr', 'txt', 'tm', 'sp', 'mg', 'add', 'del', 'mx'], pl: ['n', 'sec', 'cov'], o: ['dl', 'sh', 'dx'], sg: ['a', 'r'], ai: ['q', 'a', 'r'], gl: ['a'], pv: ['h', 'f', 'st', 'er'] };   // pv — 25/10/2026: איך הנגן ניגן (playStats)
const uxQ = new Map();
let uxT = 0;
function uxAdd(rec, g, k, v = 1) {
  if (!rec || !rec.srv || rec.srv.kind !== 'tr' || !(UX_SHAPE[g] || []).includes(k) || !(v > 0)) return;
  const m = uxQ.get(rec.id) || {}, x = m[g] || (m[g] = {});
  x[k] = k === 'cov' ? Math.max(x[k] || 0, Math.min(1, v)) : (x[k] || 0) + Math.round(v);
  uxQ.set(rec.id, m);
  clearTimeout(uxT); uxT = setTimeout(uxFlush, 8000);
}
function uxFlush() {
  clearTimeout(uxT); uxT = 0;
  for (const [id, ux] of uxQ) { uxQ.delete(id); try { Promise.resolve(net.api('learnUx', { job: id, ux })).catch(() => {}); } catch (e) {} }
}
/* 26/10/2026 (Vid Hub, שלב א׳): המסלול שלפני העבודה — צעדים קבועים ו"למה ויתרת?", מונים בלבד (lib/studiofnl.js).
   נאסף בזיכרון ונשלח 8 שנ׳ אחרי הצעד האחרון / כשהדף יורד לרקע. FNL_STEPS/FNL_WHY = אותן רשימות בשרתון */
export const FNL_STEPS = ['pick', 'link', 'est', 'quit', 'start', 'cut', 'sty', 'lyr'];
export const FNL_WHY = ['exp', 'slow', 'test', 'later'];
const fnlQ = { s: {}, w: {} };
let fnlT = 0;
function fnlAdd(k, grp) {
  const g = grp === 'w' ? 'w' : 's';
  if (!(g === 'w' ? FNL_WHY : FNL_STEPS).includes(k)) return;
  fnlQ[g][k] = (fnlQ[g][k] || 0) + 1;
  clearTimeout(fnlT); fnlT = setTimeout(fnlFlush, 8000);
}
/* האומדן לפני ההתחלה — צעד 'est'; "לא" = 'quit', ובטופס עולה שאלה אחת בנגיעה: למה (f.why, whyCard) */
function estAsk(est, f) {
  fnlAdd('est');
  return new Promise((ok) => askConfirm(cpMode() ? T('studioEstCp') : estText(est, apiMode()), () => ok(true),
    { ok: T('studioEstGo'), onNo: () => { fnlAdd('quit'); if (f && !f.whyDone) f.why = 1; ok(false); } }));
}
function fnlFlush() {
  clearTimeout(fnlT); fnlT = 0;
  if (!Object.keys(fnlQ.s).length && !Object.keys(fnlQ.w).length) return;
  const body = {}; if (Object.keys(fnlQ.s).length) body.s = fnlQ.s; if (Object.keys(fnlQ.w).length) body.w = fnlQ.w;
  fnlQ.s = {}; fnlQ.w = {};
  try { Promise.resolve(net.api('fnl', body)).catch(() => {}); } catch (e) {}
}
/* 25/10/2026 (משתמש מאייפון — באייפון הנגן לא הציע איכויות, ולא היה איך לדעת): איך הנגן ניגן — h באיכויות (hls), f כקובץ
   (בלי MSE / תקלה / בלי איכויות), st = עצירות לטעינה אחרי שהניגון התחיל, er = שגיאות של הסרטון. מחזיר פונקציה שמסיימת */
function playStats(rec, ctl) {
  const v = ctl && ctl.video;
  if (!rec || !v || !v.addEventListener) return () => {};
  let on = false, st = 0, er = 0, mode = '';
  const playing = () => { if (!on) { on = true; try { mode = ctl.quality().mode; } catch (e) {} } };
  const waiting = () => { if (on && !v.seeking) st++; };
  const error = () => { er++; };
  v.addEventListener('playing', playing); v.addEventListener('waiting', waiting); v.addEventListener('error', error);
  let done = false;
  return () => {
    if (done) return; done = true;
    v.removeEventListener('playing', playing); v.removeEventListener('waiting', waiting); v.removeEventListener('error', error);
    if (on) uxAdd(rec, 'pv', mode === 'hls' ? 'h' : 'f');
    if (st) uxAdd(rec, 'pv', 'st', st);
    if (er) uxAdd(rec, 'pv', 'er', er);
  };
}
const bothTrack = (a, b) => () => { a(); b(); };
/* כיסוי הצפייה בנגן: כל שנייה בסרטון שנוגנה (לא בהשהיה) נספרת פעם אחת. מחזיר פונקציה שמסיימת וסופרת.
   25/10/2026 (מיפוי האיסוף של session_01UZAW): עד היום הצפייה נספרה רק בסגירת הנגן — אפליקציה שנסגרה / נהרגה בדף הנגן
   איבדה את כל הצפייה. עכשיו `watchFlush` (בירידה לרקע ו־pagehide) מדווח את מה שנצבר מאז הדיווח הקודם, והנגן ממשיך לספור */
const watchers = new Set();
export function watchFlush() { for (const w of watchers) w.report(); }
export function watchTrack(rec, v) {
  if (!rec || !v || !v.addEventListener) return () => {};
  let seen = null, secs = 0, played = false, sentN = false, sentSecs = 0;
  const tick = () => {
    const d = v.duration;
    if (!(d > 0) || !isFinite(d) || v.paused) return;
    if (!seen) seen = new Uint8Array(Math.ceil(d));
    const k = Math.floor(v.currentTime || 0);
    if (k >= 0 && k < seen.length && !seen[k]) { seen[k] = 1; secs++; }
  };
  const onPlay = () => { played = true; };
  v.addEventListener('timeupdate', tick); v.addEventListener('play', onPlay);
  const w = {
    report() {                                     // רק מה שעוד לא דווח: n פעם אחת לנגן, השניות כהפרש, cov = המקסימום (בשרתון)
      if (!played) return;
      if (!sentN) { sentN = true; uxAdd(rec, 'pl', 'n'); }
      if (secs > sentSecs) { uxAdd(rec, 'pl', 'sec', secs - sentSecs); sentSecs = secs; }
      if (seen && seen.length && secs) uxAdd(rec, 'pl', 'cov', secs / seen.length);
    },
  };
  watchers.add(w);
  let done = false;
  return () => {
    if (done) return; done = true;
    v.removeEventListener('timeupdate', tick); v.removeEventListener('play', onPlay);
    watchers.delete(w);
    w.report();
  };
}
/* סבב 1: שורת תוצר. 22/10/2026 (דיווח המשתמש: "חלון של Drive עם שגיאה ולא קורה כלום" — הקבצים ב־R2, והקישור היה תמיד ל־Drive):
   נגיעה = הורדה לטלפון (R2 — קישור חתום עם שם הקובץ להורדה; Drive — כמו קודם); הכפתור בצד: כתוביות ועותק לוואטסאפ — שיתוף,
   סרטון — שמירה בתיקייה שבוחרים ב־Drive (רק כשהבורר של Drive זמין; אחרת הורדה) */
const isTextOut = (k) => k === 'srt' || k === 'en';
function rowOut(rec, o) {
  const r = h('div', 'st-row st-ric st-outr');
  const a = h('a', 'st-outa'); a.dataset.k = 'out:' + o.k;
  if (isR2Id(o.id)) {
    a.href = '#'; a.setAttribute('role', 'button');
    a.addEventListener('click', (e) => { e.preventDefault(); downloadOut(rec, o); });
  } else { a.href = 'https://drive.google.com/file/d/' + o.id + '/view'; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
  a.append(tile(isTextOut(o.k) ? 'globe' : 'film', isTextOut(o.k) ? 'blue' : 'green'), rowTxt(outShort(o.k), o.size ? fmtSize(o.size) : ''));
  const sh = isTextOut(o.k) || o.k === 'small';   // סבב 8: העותק לוואטסאפ — שיתוף, לא הורדה
  const dx = !sh && driveOk();                     // סרטון — שמירה ב־Drive
  const b = btn('st-outb', null, () => (dx ? goVids('O:' + rec.id + ':' + o.id) : shareOut(rec, o)), (dx ? 'out-dx:' : 'out-sh:') + o.k);
  b.setAttribute('aria-label', (sh ? T('studioOutShare') : dx ? T('studioOutDx') : T('studioOutDown')) + ' · ' + outShort(o.k));
  b.append(ico(sh ? 'share' : dx ? 'cloud' : 'down'));
  r.append(a, b);
  return r;
}
/* שם הקובץ בהורדה: כתוביות — "שם.he.srt"; סרטון — "שם — <סוג>.mp4" */
function outDlName(rec, o) {
  if (isTextOut(o.k)) return outFileName(rec, o.k);
  if (o.k === 'small') return shareVideoName(rec);
  return shareVideoName(rec).replace(/\.mp4$/, '') + ' — ' + outShort(o.k) + (o.k === 'mkv' ? '.mkv' : '.mp4');
}
/* הורדה לטלפון: קישור חתום (שעה) עם Content-Disposition: attachment — הדפדפן מוריד (מנהל ההורדות), הדף נשאר */
async function downloadOut(rec, o) {
  // 25/10/2026 (מיפוי האיסוף של session_01UZAW): נספר רק כשההורדה באמת יצאה — עד היום גם קישור שנכשל נספר כהורדה
  if (!isR2Id(o.id)) { uxAdd(rec, 'o', 'dl'); window.open('https://drive.google.com/uc?export=download&id=' + encodeURIComponent(o.id), '_blank', 'noopener'); return; }
  try {
    const g = await net.r2Get(o.id, outDlName(rec, o));
    uxAdd(rec, 'o', 'dl');   // מ׳3
    flashSafe(T('studioOutDlStart'));
    location.href = g.url;
  } catch (e) { flashSafe(T('studioOutErr')); }
}
export function outFileName(rec, k) {   // "שם הסרטון.he.srt" — בלי תווים שמערכות קבצים לא מקבלות
  const base = String(fileTitle(rec && rec.spec && rec.spec.name) || 'video').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'video';
  const to = (rec && rec.spec && Array.isArray(rec.spec.to) && rec.spec.to[0]) || 'he';
  return base + '.' + (k === 'en' ? 'en' : to) + '.srt';
}
/* סבב 8: העותק לוואטסאפ — שיתוף הקובץ עצמו (שליחה בצ'אט בלי הורדה ידנית). נגיעה ראשונה מורידה (עד ~28MB); אם אישור
   הנגיעה פג בזמן ההורדה — הקובץ שמור, והנגיעה הבאה משתפת מיד */
const shareReady = new Map();
export const shareVideoName = (rec) => outFileName(rec, 'srt').replace(/\.[a-z]{2}\.srt$/, '') + '.mp4';
async function shareSmall(rec, o) {
  let f = shareReady.get(o.id);
  if (!f) {
    flashSafe(T('studioShPrep'));
    try { f = new File([await net.driveBlob(o.id, 64 * 1048576)], shareVideoName(rec), { type: 'video/mp4' }); } catch (e) { flashSafe(T('studioOutErr')); return; }
    shareReady.clear(); shareReady.set(o.id, f);
  }
  try {
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: f.name }); uxAdd(rec, 'o', 'sh'); return; }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    if (e && e.name === 'NotAllowedError') { flashSafe(T('studioShAgain')); return; }   // ההורדה לקחה יותר מדי — הנגיעה הבאה
  }
  uxAdd(rec, 'o', 'dl');                            // בלי שיתוף — הקובץ ירד לטלפון
  const u = URL.createObjectURL(f), x = document.createElement('a');
  x.href = u; x.download = f.name; document.body.append(x); x.click(); x.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
async function shareOut(rec, o) {
  if (!isTextOut(o.k) && o.k !== 'small') return downloadOut(rec, o);
  if (o.k === 'small') return shareSmall(rec, o);   // מ׳3: 'sh' נספר רק אחרי שהשיתוף הצליח (ביטול — לא נספר)
  if (!isTextOut(o.k)) { downloadOut(rec, o); return; }
  let txt;
  try { txt = await net.driveText(o.id); } catch (e) { flashSafe(T('studioOutErr')); return; }
  const name = outFileName(rec, o.k), f = new File([txt], name, { type: 'text/plain' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: name }); uxAdd(rec, 'o', 'sh'); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }   // אחרת (בלי שיתוף / פג אישור הנגיעה) — הורדה
  uxAdd(rec, 'o', 'dl');
  const u = URL.createObjectURL(f), x = document.createElement('a');
  x.href = u; x.download = name; document.body.append(x); x.click(); x.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
/* שורה עם עיגול סימון (בחירה מרובה) */
function rowCheck(o) {
  const r = o.locked ? h('div', 'st-row') : btn('st-row', null, o.disabled ? null : o.onClick, o.k);
  if (o.disabled) { r.disabled = true; r.classList.add('off'); }
  const c = h('span', 'st-check' + (o.on ? ' on' : '') + (o.locked ? ' lock' : '')); c.append(ico('check'));
  if (!o.locked) { r.setAttribute('role', 'checkbox'); r.setAttribute('aria-checked', o.on ? 'true' : 'false'); }
  r.append(c, rowTxt(o.label, o.sub));
  if (o.value) r.append(h('span', 'st-v', o.value));
  if (o.badge) r.append(h('span', 'st-badge gray', o.badge));
  return r;
}
/* שורה עם עיגול בחירה (אחת מכמה) */
function rowRadio(o) {
  const r = btn('st-row', null, o.disabled ? null : o.onClick, o.k);
  r.setAttribute('role', 'radio'); r.setAttribute('aria-checked', o.on ? 'true' : 'false');
  if (o.disabled) { r.disabled = true; r.classList.add('off'); }
  const rd = h('span', 'st-radio' + (o.on ? ' on' : '')); rd.append(ico('check'));   // 25/10/2026: ✓ בסוף השורה (CSS), לפי ת־עיצוב
  r.append(rd, rowTxt(o.label, o.sub));
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
/* 11/10/2026: כשל כללי של שלב בכלים (worker_step / store_*) — הכרטיס מציג את מה שהעובד כתב ("ההעלאה לאחסון נכשלה (r2_size)")
   ולא "משהו השתבש (worker_step)"; אז השורה בפרטים הטכניים מיותרת (בלי כפילות) */
const MSG_CODES = ['worker_step', 'worker', 'store_fail', 'store_net'];
function cardMsg(rec, ph) {
  const m = workerMsg(rec, ph);
  return m && MSG_CODES.includes(rec.srv && rec.srv.err) ? m.replace(/^[\s\u2717\u00b7]+/, '') : '';
}
function workerMsgRow(rec, ph) {
  if (cardMsg(rec, ph)) return null;
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
  if (ui.access === 'signin' && SA && SA.auth && SA.auth.state() === 'out') {   // עצמאי בלי חיבור — כפתור כניסה (בתיק — מסך ההתחברות שלו)
    return btn('st-btn wide st-signin', T('googleSignIn'), () => { SA.auth.signIn().then((ok) => { if (!ok) flashSafe(T('loginFailed')); }); }, 'signin');
  }
  if (ui.access === 'signin') return banner('warn', T('studioErrSignin'));
  if (ui.access === 'denied') return banner('warn', T('studioErrDenied'));
  if (ui.access === 'offline') return banner('info', T('studioOffline'));
  if (ui.access === 'quota') return banner('info', T('studioErrQuota', { t: quotaReset() }));   // 28/10/2026: מכסת Firestore — לא "השרתון לא ענה"
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

/* בורר מצב התרגום — 25/10/2026 (בקשת המשתמש: נקי ומינימלי לפי ת־עיצוב): כרטיס אחד — בורר מקטעים "רגיל" / "ביצועים"
   (+ "כל המודלים" רק למנהל ולמי שברשימה — ui.mf), ומתחתיו שורה אחת על המצב שנבחר: השם, ומדדי איכות, עלות וזמן.
   עד 25/10 — כרטיס גדול עם סרט, שלושה אריחים, כרטיס בחירה נפרד ופסקת מבחן מתחתיו (אותו מידע שלוש פעמים) */
const tierName = (m) => (m.tier === 'std' ? T('studioTierStd') : m.tier === 'perf' ? T('studioTierPerf') : modeShort(m));
function modePicker(cur, onPick) {
  const m = modeById(modeFor(cur, ui.mf));
  const card = h('div', 'st-modecard');
  const seg = (ids, label, aria, many) => {
    const ef = h('div', 'st-seg2' + (many ? ' many' : '')); ef.setAttribute('role', 'radiogroup'); ef.setAttribute('aria-label', aria);
    for (const x of ids.map(modeById)) {
      const b = btn(null, null, () => onPick(x.id), 'm:' + x.id);
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', x.id === m.id ? 'true' : 'false');
      b.append(h('b', null, label(x)), h('small', null, label === tierName ? modeShort(x) : effortSub(x.id)));
      ef.append(b);
    }
    return ef;
  };
  card.append(seg(PUBLIC_MODES, tierName, T('studioGrpMain')));
  if (ui.mf) {
    const lab = h('div', 'st-modelab'); lab.append(h('small', null, T('studioGrpLab') + ' · ' + T('studioGrpLabS')));
    card.append(lab, seg(MODE_ORDER.filter((id) => !PUBLIC_MODES.includes(id)), modeShort, T('studioGrpLab'), true));
  }
  const bars = (n, cls) => { const b = h('span', 'st-bars' + (cls ? ' ' + cls : '')); for (let i = 0; i < 5; i++) b.append(h('i', i < n ? 'on' : null)); return b; };
  const info = h('div', 'st-modeinfo');
  const nm = h('div', 'st-modenm'); nm.append(h('small', null, modeSub(m.id)));   // שם המודל כבר בבורר — כאן רק במה הוא טוב
  const stat = (lbl, val) => { const d = h('span', 'st-mstat'); d.append(h('small', null, lbl), val); return d; };
  const stats = h('div', 'st-mstats'); stats.setAttribute('aria-hidden', 'true');
  stats.append(stat(T('studioQuality'), bars(m.q)), stat(T('studioUsage'), bars(m.u, 'amber')), stat(T('studioHourEst'), h('b', null, T('studioHrs', { t: fmtHM(m.min) }))));
  info.append(nm, stats);
  card.append(info);
  // v367: מעל המצב המקסימלי שבחוקים שלך — לפני שמתחילים נשאל אותך
  const over = modeOverMax(m.id, ui.rl.mx) ? banner('warn', T('studioRlOverForm', { m: modeShort(modeById(ui.rl.mx)) })) : null;
  return [card, over].filter(Boolean);
}
/* מה לקבל — שלוש אפשרויות + SRT קבוע. ההערכה לפי גודל הקובץ (כשיש) */
function outRows(out, size, onToggle) {
  const est = size ? { same: approx(fmtSize(size)), compact: approx(fmtSize(size * COMPACT_RATIO)), mkv: approx(fmtSize(size)), small: approx(fmtSize(SMALL_MB * 1048576)) } : {};
  const rows = OUTS.map((k) => rowCheck({ label: outName(k), sub: outSub(k), value: est[k], on: !!out[k], onClick: () => onToggle(k), k: 'o:' + k }));
  return list(...rows);   // 25/10/2026: SRT (תמיד) — הערה מתחת לרשימה, לא שורה נעולה
}
/* מראה הכתוביות — שלושה כרטיסים עם דוגמה על "תמונה" כהה */
function stylePicker(cur, onPick) {
  const g = h('div', 'st-styles'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', T('studioSecStyle'));
  for (const k of STYLES.filter((x) => x !== 'karaoke')) {   // 26/10/2026: קריוקי לא קיים בצריבה (תרגום — המילים בעברית לא נאמרות בסרטון)
    const b = btn('st-sty' + (k === cur ? ' on' : ''), null, () => onPick(k), 's:' + k);
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', k === cur ? 'true' : 'false');
    const s = h('span', 's s-' + k);
    s.textContent = T('studioSample');
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
  const pl = (md && planFrom(md, modeById(rec.spec.mode).min, rec.spec.dur || 0, rec.spec.px)) || { s: stageEstimates(modeById(rec.spec.mode).min, rec.spec.dur || 0), q: Q_DEF, n: 0 };
  if (rec.spec.ka) return kaPlan(pl, rec.spec.dur, rec.spec.bv === 1, ui.eta && ui.eta.k);   // 26/10/2026: קריוקי (= השרתון בלקיחה)
  return rec.spec.src === 'subs' ? subsPlan(pl) : pl;   // 22/10/2026: קובץ כתוביות — בלי תמלול, יישור וצריבה (= השרתון בלקיחה)
}
function modelFor(rec) {
  const run = runs.get(rec.id);
  const pl = planFor(rec);
  const m = progressModel({ state: rec.srv ? rec.srv.state : 'new', prog: rec.srv && rec.srv.prog }, pl.s, upState(rec, run), Date.now(), pl.q);
  m.n = pl.n || 0;
  return m;
}
/* שעת הסיום שמוצגת (p80) — יציבה: יורדת מיד, עולה רק כשהפער גדול מדקה או מ־10% ממה שנשאר (מחקר הצפי, 10/10/2026) */
/* 21/10/2026: עולה רק כשהפער גדול מ־3 דק׳ או מ־10% (היסטרזיס — שעה שקופצת קדימה ואחורה מאבדת אמון), ומעל שעה
   השעה מעוגלת קדימה ל־5 דק׳ ("בסביבות 14:35", לא 14:33) */
const etaEnd = new Map(), pctMemo = new Map();
function shownEnd(id, leftSec) {
  const now = Date.now(), r0 = now + leftSec * 1000, prev = etaEnd.get(id);
  const raw = leftSec > 3600 ? Math.ceil(r0 / 300e3) * 300e3 : r0;
  if (!prev || raw < prev || raw - prev > Math.max(180e3, 0.1 * leftSec * 1000) || prev < now) { etaEnd.set(id, raw); return raw; }
  return prev;
}
/* 21/10/2026: אותו מספר בכל מקום — ברשימה, בבית ובמסך העבודה (עד היום הרשימה הראתה p50 והמסך p80) */
const shownLeft = (rec, m) => Math.max(0, (shownEnd(rec.id, m.left80) - Date.now()) / 1000);
/* הטבעת והפס לא חוזרים אחורה באותה הפעלה ("המשך" — הפעלה חדשה, מותר להתחיל מנקודה אחרת) */
const pctKey = (rec, x) => rec.id + ':' + ((rec.srv && rec.srv.fires) || 0) + ':' + (x || '');
const shownPct = (rec, v, x) => monoPct(pctMemo, pctKey(rec, x), v || 0);
function videoLine(rec, run) {    // "עלו 1.2GB מתוך 3.2GB · 4.3MB לשנייה · נשארו 8 דק׳"
  const sent = run && run.phase === 'video' ? run.sent || 0 : rec.up.v.sent || 0, size = rec.spec.size;
  const parts = [T('studioUpOf', { a: fmtSize(sent), b: fmtSize(size) })];
  // 26/10/2026: ברקע — המספר לפי מה שכבר ב־R2 (השרתון, כל 20 שנ׳); ממשיך גם כשסוגרים את Studio
  if (run && run.active && run.phase === 'video' && run.bg) parts.push(T('studioBgNote'));
  else if (run && run.active && run.phase === 'video' && run.rate > 0) {
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
  if (rec.up.ph && (!rec.srv || !rec.srv.state || rec.srv.state === 'new')) {   // 25/10/2026: העבודה עוד בטלפון — לא "הקבצים מוכנים בענן"
    const q = rec.srv && rec.srv.ppr;
    if (q && q.s === 'err') return { pct: 0, big: T('studioPhStopBig'), sub: '' };
    return { pct: q && q.p >= 0 ? q.p : 0, big: T('studioPhBig'), sub: q ? pprText(q) : T('studioPhBigS') };
  }
  if (ph === 'ready') return { pct: 1, check: true, big: T('studioReadyBig'),
    sub: rec.up.wait === 'worker_not_ready' ? T('studioWaitWorkerS') : rec.up.wait === 'conn_missing' ? T('studioNeedConnS') : T('studioTotalEst', { t: fmtLeft(m.left80) }) };
  const u = uploadLeft(rec, run);
  // ההעלאה עצרה / מחכה — בלי "נשארו בערך": מה שנשאר תלוי בחזרה של הרשת או בבחירה מחדש
  if (ph === 'need' || ph === 'paused' || ph === 'error') return { pct: u.pct, big: T('studioUpStopBig'), sub: T('studioUpOf', { a: fmtSize(u.done), b: fmtSize(u.all) }) };
  if (ph === 'wait') return { pct: u.pct, big: T('studioUpWaitBig'), sub: T('studioUpOf', { a: fmtSize(u.done), b: fmtSize(u.all) }) };
  const parked = (!rec.srv || rec.srv.state === 'new') && !rec.up.started;
  if (parked) return { pct: u.pct, big: T('studioLeftBig', { t: fmtLeft(u.left) }), sub: T('studioUpLeftS') };
  if (m.bg) return { pct: 1, check: true, big: T('studioNowBg'), sub: '' };   // 28/10/2026: התוצרים אצלך, הרקע לא נספר
  // p80 (שמרני — להקדים ולא לאחר); לפני 8 עבודות שהמודל למד מהן — טווח p50–p90, כי עוד אין מספיק נתונים לשעה אחת
  const end = shownEnd(rec.id, m.left80), now = Date.now();
  const sub = m.n >= 8 || m.left90 - m.left < 120 ? T('studioReadyAt', { t: fmtClock(end) })
    : T('studioReadyRange', { a: fmtClock(now + m.left * 1000), b: fmtClock(now + m.left90 * 1000) });
  return { pct: m.pct, big: T('studioLeftBig', { t: fmtLeft(Math.max(0, (end - now) / 1000)) }), sub };
}
const SRV_DIED = new Set(['worker_lost', 'worker_crash', 'worker_oom']);
/* מה קורה עכשיו — משפט אחד */
function nowLine(rec, run, ph) {
  if (run && run.active && (ph === 'extract' || ph === 'audio' || ph === 'video')) {
    const bk = upBlocked(run.blk, (Number(rec.up.a.sent) || 0) + (Number(rec.up.v.sent) || 0) + (Number(run.sent) || 0), Date.now());
    if (bk) { const t = fmtSecShort((Date.now() - run.blk.t0) / 1000); return bk === 'stall' ? T('studioUpBlockStall', { t }) : T('studioUpBlockNet', { t }); }
  }
  if (ph === 'wait') return run.wait === 'wifi' ? T('studioWaitWifi') : T('studioWaitNet');
  if (ph === 'extract') {             // 21/10/2026: הסרטון עולה במקביל לחילוץ (uploadBoth)
    const vp = rec.spec && rec.spec.size > 0 && rec.up.v.sent > 0 ? Math.min(99, Math.floor(100 * rec.up.v.sent / rec.spec.size)) : 0;
    return vp > 0 ? T('studioNowExtractPar', { p: vp }) : T('studioNowExtract');
  }
  if (ph === 'audio') return T('studioNowAudio');
  if (ph === 'video') return rec.up.noAudio ? T('studioNowVideoOnly') : T('studioNowVideo');
  if (ph === 'need') return T('studioNeedFile');
  if (ph === 'paused') return T('studioPausedNow');
  if (ph === 'error') return errText(run.err);
  if (ph === 'ready') return rec.up.wait === 'worker_not_ready' ? T('studioWaitWorker') : rec.up.wait ? errText(rec.up.wait) : T('studioReady');
  if (ph === 'queued' && rec.spec.pt) return T('studioPhPtQ');   // שלב 3: הטלפון לוקח את העבודה ומתרגם בעצמו
  if (ph === 'queued') return rec.srv && rec.srv.vw ? (rec.spec.ph ? T('studioPhWaitM') : T('studioNowParked')) : rec.srv && rec.srv.uw ? T('studioNowSrvUpd') : rec.srv && rec.srv.eng === 'api' ? T('studioNowQueuedApi') : T('studioNowQueued');
  if (ph === 'running' && ryWaiting(rec, Date.now())) return T('studioNowRyWait');
  // 31/10/2026: בקריוקי אין מודל שפה — "Claude עובד על הסרטון" הטעה
  if (ph === 'running') return (rec.srv && rec.srv.prog && rec.srv.prog.msg) || (rec.spec && rec.spec.ka ? T('studioNowRunningKa') : T('studioNowRunning'));
  if (ph === 'done') return T('studioNowDone');
  // 21/10/2026: נפילה של השרת (לרוב זיכרון ביישור) הוצגה כ"הקשר עם האחסון או עם הרשת נקטע" — מטעה; לכשל כזה ההודעה שלו
  if (ph === 'failed') return recovering(rec) ? (SRV_DIED.has(rec.srv && rec.srv.err) ? errText(rec.srv.err) : T('studioRecLine')) : cardMsg(rec, ph) || errText(rec.srv && rec.srv.err);
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
/* 21/10/2026 (בקשת המשתמש): בבית הכרטיס של העבודות בגובה של המסך — כמה עבודות שנכנסות בשלמותן (לפחות JOBS_MIN, עד JOBS_MAX),
   כך שהעמוד כולו סטטי ו"עבודות קודמות" תמיד גלוי בלי לגלול. הכרטיס נגלל בתוכו באצבע ונעצר בתחילת שורה (scroll-snap).
   מקום הגלילה נשמר בין ציורים (ui.jobsY); שינוי גודל (סיבוב / מקלדת) — מחשבים מחדש */
export const JOBS_MIN = 2, JOBS_MAX = 8;
export function jobsFit(heights, avail) {   // טהורה: כמה שורות נכנסות בשלמותן בגובה הפנוי
  let n = 0, sum = 0;
  for (const x of heights) { if (sum + x > avail + 0.5) break; sum += x; n++; }
  return Math.max(Math.min(JOBS_MIN, heights.length), Math.min(n, JOBS_MAX));
}
function jobsCard(rows) {
  const l = list(...rows);
  if (rows.length <= 3) return l;   // עד 3 עבודות — תמיד נכנסות, בלי כרטיס נגלל
  l.classList.add('st-jobs');
  const wrap = h('div', 'st-jobs-w');
  /* "עבודות קודמות": השורה האחרונה שנראית עולה לראש הכרטיס (עבודות חדשות + אחת להמשכיות, כמו דפדוף ב־iOS);
     בסוף הרשימה הכפתור לא נעלם — "חזרה לאחרונות" גולל לראש הכרטיס */
  const more = btn('st-jobs-more', '', () => {
    const max = l.scrollHeight - l.clientHeight;
    if (l.scrollTop >= max - 2) { l.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    const lt = l.getBoundingClientRect().top, lb = lt + l.clientHeight;
    const last = rows.filter((r) => r.getBoundingClientRect().top < lb - 4).pop();
    const to = last ? l.scrollTop + last.getBoundingClientRect().top - lt : l.scrollTop + l.clientHeight;
    l.scrollTo({ top: Math.min(to, max), behavior: 'smooth' });
  }, 'jobs-more');
  const paint = () => {
    const lb = l.getBoundingClientRect().bottom;
    const left = rows.filter((r) => r.getBoundingClientRect().bottom > lb + 2).length;   // שורות שעוד לא נראו במלואן (מתחת לנראה)
    more.textContent = left ? T('studioJobsMore', { n: left }) : T('studioJobsTop');
    more.hidden = l.scrollHeight <= l.clientHeight + 2;   // הכל נכנס — אין לאן לגלול
  };
  const fit = () => {
    if (!l.isConnected) { removeEventListener('resize', onRs); return; }
    const sc = l.closest('.st-root') || document.scrollingElement || document.documentElement;
    const st = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top;
    const top = l.getBoundingClientRect().top - st + (sc.scrollTop || 0);   // מראש העמוד, בלי תלות בגלילה
    const pb = parseFloat(getComputedStyle(sc).paddingBottom) || 0;   // הריפוד בתחתית השכבה (28px + אזור הבטוח)
    const mb = (more.offsetHeight || 37) + 8;   // הכפתור והרווח שמעליו
    const avail = (sc.clientHeight || innerHeight) - top - mb - Math.max(16, pb);
    const n = jobsFit(rows.map((r) => r.offsetHeight), avail);
    let hh = 0;
    for (let i = 0; i < n && i < rows.length; i++) hh += rows[i].offsetHeight;
    l.style.maxHeight = hh + 'px';
    paint();
  };
  let rsT = 0;
  const onRs = () => { clearTimeout(rsT); rsT = setTimeout(fit, 120); };
  addEventListener('resize', onRs);
  // גובה השורות משתנה אחרי הציור (הגופן נטען, שם שנשבר לשתי שורות) — מחשבים שוב, אחרת עבודה אחת יותר מדי והעמוד נגלל
  if (typeof ResizeObserver === 'function') { const ro = new ResizeObserver(() => { if (!l.isConnected) { ro.disconnect(); return; } onRs(); }); rows.forEach((r) => ro.observe(r)); }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (l.isConnected) fit(); });
  l.addEventListener('scroll', () => { ui.jobsY = l.scrollTop; paint(); }, { passive: true });
  requestAnimationFrame(() => {
    if (!l.isConnected) return;
    fit();
    if (ui.jobsY) l.scrollTop = ui.jobsY;
    paint();
  });
  wrap.append(l, more);
  return wrap;
}
/* 30/10/2026 (בקשת המשתמש — "שני כלים נפרדים לגמרי"): קריוקי = לשונית משלה בחוגה, רשימה משלה ופרויקט חדש משלו.
   הטופס פותח ישר במצב קריוקי (form.ka קבוע — אין מתג), והבית של התרגום לא מציג שירים */
function pageKa(p) { pageHome(p, true); }
function pageHome(p, kaTab) {
  const pon = apiMode() ? ui.api.online > 0 : !!store.conn;
  const pill = btn('st-cpill' + (pon ? ' on' : ''), null, () => go('eng'), 'cpill');
  const lbl = apiMode() ? T('studioConnApiOn') : store.conn ? T('studioConnOn') : T('studioConnPill');
  // 29/10/2026 (בקשת המשתמש — אותו עיצוב של בועות ההדר, לפי ת־עיצוב): בהדר — כיתוב קטן (נקודה + השרת/Claude) והמצב מודגש מתחתיו
  if (SA && SA.shell) {
    const cap = h('span', 'sub-cap'); cap.append(h('i'), document.createTextNode(apiMode() ? T('studioCapSrv') : T('studioCapClaude')));
    pill.append(cap, h('b', 'sub-val', pon ? T('studioVOn') : apiMode() ? T('studioVOff') : T('studioVConnect')));
    pill.setAttribute('aria-label', lbl);
  } else pill.append(h('i'), h('span', null, lbl));
  if (SA && SA.shell) { SA.shell.setStatus(pill); p.append(SA.shell.el); }   // עצמאי: ההדר המשותף — הלוגו של Studio במקום הכותרת, הקפסולה בהדר
  else p.append(navBar({ back: 'THE SNOWBALL', end: pill, go: SA ? () => { appGo(SA.home || './'); } : null }), large(T('studioTitle')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const hb = haltBanner(); if (hb) p.append(hb);   // v367: מתג החירום פעיל — כאן רואים למה עבודות לא מתחילות
  const mb = majorBanner(); if (mb) p.append(mb);   // v371: תקלה רחבה — במקום הבאנר של ההתראות (היא כבר אומרת את החשוב)
  const ub = mb ? null : urgentBanner(); if (ub) p.append(ub);   // v368: התראה דחופה (P1–P2) — מיד; הקלות — רק בסיכום במגדל
  const nc = btn('st-newcard', null, () => { form = freshForm(null); if (kaTab) form.ka = true; go('new', kaTab ? 'ka' : null); }, 'new');
  const plus = h('span', 'st-plus'); plus.append(ico(kaTab ? 'note' : 'plus'));
  nc.append(plus, kaTab ? rowTxt(T('studioKaNew'), T('studioKaNewSub')) : rowTxt(T('studioNew'), T('studioNewSub')));
  p.append(nc);
  const jobs = store.jobs.filter((rec) => !rec.spec.ka === !kaTab);   // 30/10/2026: שירים — רק בלשונית הקריוקי
  const drafts = kaTab ? [] : store.drafts;
  if (!drafts.length && !jobs.length) {
    const e = h('div', 'st-empty');
    const ic = h('span', 'st-empty-ic'); ic.append(ico(kaTab ? 'note' : 'film'));
    if (kaTab) e.append(ic, h('b', null, T('studioKaEmptyT')), h('p', null, T('studioKaEmptyS')));
    else e.append(ic, h('b', null, T('studioEmptyT')), h('p', null, T('studioEmptyS')));
    p.append(e);
    return;
  }
  if (jobs.length) {
    const rows = jobs.map((rec) => {
      const r = btn('st-proj', null, () => go('job', rec.id), 'j:' + rec.id);
      const th = h('span', 'st-thumb'); th.append(ico('film'));
      paintThumb(th, rec);
      const bar = h('span', 'st-tprog'); const bi = h('i'); bar.append(bi); th.append(bar);
      const info = h('span', 'st-pinfo');
      const nm = h('b'); nm.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')));
      const stat = h('span', 'st-pstat');
      const bd = h('span', 'st-badge'); const tx = h('span', 'st-ptx');
      stat.append(bd, tx);
      const sm = h('small');
      if (rec.spec.ka) sm.append(T('studioKaRow')); else sm.append(langsText(rec.spec.from, rec.spec.to) + ' · ', h('bdi', 'st-nw', modeShort(modeById(rec.spec.mode))));
      info.append(nm, sm, stat);
      r.append(th, info);
      live(r, () => {             // אחוז ומצב — מתעדכנים במקום
        const run = runs.get(rec.id), ph = jobPhase(rec, run), m = modelFor(rec);
        const [c, l] = qaPending(rec) ? ['amber', T('studioBAsk')] : recovering(rec) ? ['amber', T('studioBRecover')] : badgeFor(ph);
        bd.className = 'st-badge ' + c; bd.textContent = l;
        const upping = ph === 'extract' || ph === 'audio' || ph === 'video';
        tx.textContent = upping ? Math.round(100 * (ph === 'video' ? run.p || 0 : m.stages[0].p || 0)) + '%' + (ph === 'video' && !rec.up.noAudio ? ' · ' + T('studioVideoShort') : '')
          : m.bg ? T('studioNowBg') : ph === 'running' || ph === 'queued' ? T('studioLeftShort', { t: fmtLeft(shownLeft(rec, m)) }) : '';
        const pct = ph === 'done' ? 1 : ph === 'video' ? run.p || 0 : upping ? m.stages[0].p || 0 : ph === 'running' || ph === 'queued' ? shownPct(rec, m.pct, 'h') : m.pct;
        bar.hidden = FINAL.includes(ph) || ph === 'ready';
        bi.style.width = Math.round(100 * pct) + '%';
      });
      return r;
    });
    p.append(secT(kaTab ? T('studioKaSecJobs') : T('studioSecJobs')), jobsCard(rows));
  }
  if (!drafts.length) return;
  const rows = drafts.map((d) => {
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

/* סבב 2: בדיקת הסרטון ברקע מרגע הבחירה (Mediabunny, חלונות קצרים) — לא חוסמת שום דבר; תקלה = בלי הצעות */
function inspectFor(f, file) {
  f.sa = { st: 'run' };
  inspectSource(file).then((m) => {
    if (form !== f || f.fileObj !== file) return;
    f.sa = { st: 'ok', m };
    if (m.dur) f.dur = m.dur;
    render('none');
  }, () => { if (form === f && f.fileObj === file) { f.sa = { st: 'err' }; render('none'); } });
}
function advText(a) {
  switch (a.k) {
    case 'dup': return [T('studioAdvDup'), T('studioAdvDupS')];
    case 'noaudio': return [T('studioAdvNoAudio'), T('studioAdvRepickS')];
    case 'silent': return [T('studioAdvSilent'), T('studioAdvRepickS')];
    case 'same': return [T('studioAdvSame', { l: langName(a.lang, uiLang()) }), T('studioAdvSameS')];
    case 'lang': return [T('studioAdvLang', { l: langName(a.lang, uiLang()) }), T('studioAdvLangS')];
    case 'burn': return [T('studioAdvBurn', { m: a.save }), T('studioAdvBurnS')];
    default: return [T('studioAdvEdges', { t: fmtDur(a.save) }), T('studioAdvEdgesS')];
  }
}
function advRows(f, pick) {
  const sa = f.sa && f.sa.st === 'ok' ? f.sa.m : null;
  const list0 = sourceAdvice(sa, { name: f.file && f.file.name, size: f.file && f.file.size, from: f.from, to: f.to, edl: f.edl, out: f.out, jobs: store.jobs })
    .filter((a) => !(f.saX && f.saX.includes(a.k)));
  if (!list0.length) return null;
  return list(...list0.map((a) => {
    const [t1, t2] = advText(a);
    const r = h('div', 'st-row st-ric st-adv ' + a.sev);
    r.dataset.k = 'adv:' + a.k;
    r.append(tile(a.sev === 'tip' ? 'spark' : 'alert', a.sev === 'bad' ? 'red' : a.sev === 'warn' ? 'orange' : 'green'), rowTxt(t1, t2));
    const go2 = a.act === 'open' ? () => go('job', a.id)
      : a.act === 'cut' ? () => { f.edl = normEdl({ k: [[a.a, a.b]], ar: 'src', x: 0.5 }, sa.dur); flashSafe(T('studioAdvCutOk')); render('none'); }
      : a.act === 'noburn' ? () => { for (const k of OUTS) f.out[k] = false; flashSafe(T('studioAdvBurnOk')); render('none'); }
      : pick;
    const lbl = a.act === 'open' ? T('studioAdvOpen') : a.act === 'cut' ? T('studioAdvCut') : a.act === 'noburn' ? T('studioAdvNoBurn') : T('studioReplace');
    const b = btn('st-mini tint', lbl, go2, 'adv-go:' + a.k);
    const x = btn('st-advx', null, () => { f.saX = (f.saX || []).concat(a.k); render('none'); }, 'adv-x:' + a.k);
    x.setAttribute('aria-label', T('studioAdvHide')); x.append(ico('x'));
    r.append(b, x);
    return r;
  }));
}
/* 26/10/2026 (Vid Hub, שלב א׳): "למה לא עכשיו?" — פעם אחת לטופס, ארבע תשובות קבועות + סגירה. רק קוד נשלח (fnlAdd) */
function whyCard(f) {
  const c = h('div', 'st-why');
  const top = h('div', 'st-why-t'); top.append(h('b', null, T('studioWhyT')));
  const x = btn('st-advx', null, () => { f.why = 0; f.whyDone = 1; render('none'); }, 'why-x'); x.append(ico('x')); x.setAttribute('aria-label', T('studioCancel'));
  top.append(x);
  const ch = h('div', 'st-chips');
  ch.append(...FNL_WHY.map((k) => btn('st-chip', whyTxt(k), () => { fnlAdd(k, 'w'); f.why = 0; f.whyDone = 1; render('none'); flashSafe(T('studioWhyThanks')); }, 'why:' + k)));
  c.append(top, ch);
  return c;
}
const whyTxt = (k) => (k === 'exp' ? T('studioWhy_exp') : k === 'slow' ? T('studioWhy_slow') : k === 'test' ? T('studioWhy_test') : T('studioWhy_later'));
function pageForm(p, editing) {
  if (!form) {
    const d = editing ? store.drafts.find((x) => x.id === ui.param) : null;
    if (editing && !d) { back(); return; }
    form = freshForm(d);
  }
  if (!editing && ui.param === 'ka') form.ka = true;   // 30/10/2026: הכלי בכתובת הדף — טופס שנבנה מחדש נשאר קריוקי
  const f = form;
  const saveTop = btn('st-txt bold', T('studioSave'), saveForm, 'nav-save');
  saveTop.disabled = !f.file || !!f.subs;
  // 30/10/2026: לשיר אין טיוטה — הטיוטות שייכות לתרגום (hidden לא הספיק: ה־CSS של הכפתור גובר)   // 22/10/2026: קובץ כתוביות — בלי טיוטה (הקובץ רק בזיכרון)
  p.append(navBar({ cancel: T('studioCancel'), title: f.ka ? T('studioKaNew') : editing ? T('studioEditT') : T('studioNew'), end: f.ka ? null : saveTop }));
  if (f.why) p.append(whyCard(f));   // 26/10/2026 (Vid Hub): אחרי "לא" באומדן — שאלה אחת בנגיעה

  // הסרטון — מהטלפון. הקובץ נשאר בזיכרון רק עד ההתחלה; בטיוטה נשמרים רק השם, הגודל והסוג
  const inp = h('input', 'st-file'); inp.type = 'file'; inp.hidden = true;
  inp.accept = f.ka ? 'audio/*,video/*,.mp3,.m4a,.flac,.wav,.ogg,.opus,.mkv,.mp4,.webm' : 'video/*,.mkv,.mov,.mp4,.m4v,.webm,.avi';
  const took = (file, handle) => {
    f.fileObj = file; f.handle = handle || null; f.drive = null; f.file = { name: file.name, size: file.size, type: file.type || '' };
    fnlAdd('pick');   // 26/10/2026: המסלול שלפני העבודה
    f.edl = null; f.dur = 0; inspectFor(f, file);   // סבב 2: קובץ חדש — חיתוך ישן לא שייך לו; בדיקה ברקע (חינם)
    if (!f.ka) tracksFor(f, file);   // שלב 4: רצועות כתוביות בתוך הסרטון (30/10/2026: לא בשיר — שם מילים, לא כתוביות)
    render('none');
  };
  inp.addEventListener('change', () => { const file = inp.files && inp.files[0]; if (file) took(file, null); });
  const pick = () => {
    if (canPickHandle()) { pickWithHandle().then((r) => { if (r && r.file) took(r.file, r.handle); else if (!r) inp.click(); }); return; }
    inp.click();
  };
  let card;
  if (f.link && f.linkOk && f.link.st === 'ok') {   // 22/10/2026: מקישור — הכרטיס של הסרטון (נגיעה = חזרה לדף הקישור)
    card = btn('st-filecard st-lk-fc', null, () => go('link'), 'file');
    const c = linkCard(f.link, true), meta = h('small', 'st-ok', T('studioLinkFcNote', { q: qLabel((f.link.r.q.find((o) => o.v === f.link.v) || {}).h || 0), s: linkSize(f.link) ? approx(fmtSize(linkSize(f.link))) : T('studioLinkSzUnknown') }));
    c.querySelector('.st-l').append(meta);
    card.append(...c.childNodes);
  } else if (f.file) {
    card = btn('st-filecard', null, f.ph ? phPick : f.drive && f.drive.bx ? () => go('dpick') : pick, 'file');   // 26/10/2026: מ־Drive — החלפה מהרשימה   // תרגום בטלפון — החלפה דרך האפליקציה
    card.setAttribute('aria-label', T('studioReplace') + ': ' + f.file.name);
    const th = h('span', 'st-thumb'); th.append(ico('film'));
    const txt = h('span', 'st-l');
    const nm = h('b'); nm.append(fileNameEl(f.file.name));
    const sz = h('small'); sz.append(fmtSize(f.file.size) + ' · ', h('span', 'st-linkish', T('studioReplace')));
    txt.append(nm, sz, f.ph ? phNote(f.ph) : f.drive ? h('small', 'st-ok', T('studioInDriveNote')) : f.fileObj ? h('small', 'st-ok', T('studioPhoneOnly')) : h('small', 'st-warn', T('studioRepick')));
    card.append(th, txt);
  } else {
    // 25/10/2026: השורה הראשונה בקבוצת המקורות (לא כרטיס נפרד) — בולטת, וממנה ישר לבורר
    // 29/10/2026 (הצילום: 1:20 ש׳ מחכים להעלאה מהדפדפן): עם Studio לאנדרואיד — הבחירה דרך האפליקציה. הסרטון לא עולה מהדפדפן
    // (שקופא ברקע): האפליקציה מעלה את הקול, מודדת, ומעלה את הסרטון לענן ברקע (UIDT) — והעבודה לא מחכה לו
    // 31/10/2026 (בקשת המשתמש: "לא בחרתי הכל בטלפון אלא תרגום רגיל על השרת"): הבחירה הראשית שוב מהדפדפן — הסרטון עולה ל־R2
    // במלואו, השרת צורב, והתוצאה באיכות המלאה להורדה. עבודת טלפון (phPick) — רק כשבוחרים בה במפורש (phRow)
    card = btn('st-row st-ric st-pickrow', null, pick, 'file');
    const plus = h('span', 'st-plus'); plus.append(ico('film'));
    card.append(plus, f.ka ? rowTxt(T('studioKaPick'), T('studioKaPickS')) : rowTxt(T('studioPick'), T('studioNewSub')), ico('chev', 'st-chev'));
  }
  if (f.subs) subsSection(p, f);   // 22/10/2026: קובץ כתוביות קיים — במקום הסרטון
  else {
    p.append(inp, secT(f.ka ? T('studioKaSecSong') : T('studioSecVideo')));
    const pickRow = card.classList.contains('st-row') ? card : null;   // 25/10/2026: בלי קובץ — הבורר והמקורות האחרים בקבוצה אחת
    if (!pickRow) p.append(card);
    if (!pickRow && f.ph && (f.ph.cap || 0) < PH_CAP_VC) {   // הקישור לעדכון — מחוץ לכפתור של הכרטיס
      const a = h('a', 'st-btn wide', T('studioLinkApk')); a.href = DL_APK; a.rel = 'noopener'; a.dataset.k = 'ph-apk';
      p.append(a);
    }
    const subsRow = rowNav({ tile: tile('cc', 'orange'), label: T('studioSubsPick'), sub: subsOk() ? T('studioSubsPickS') : T('studioSubsApiOnly'), onClick: () => pickSubs(f), k: 'subs-pick' });
    // 22/10/2026: הורדה מקישור — שורה ראשונה (המנהל / "כל המודלים", כשהשרתון אומר שאפשר)
    // 25/10/2026: בלי האפליקציה לאנדרואיד (אייפון, מחשב) ההורדה רק לענן — ויוטיוב חוסם את השרת, אז לא מבטיחים אותו
    const linkRow = devDl() || ui.url ? rowNav({ tile: tile('link', 'red'), label: T('studioLinkRow'), sub: devDl() ? T('studioLinkRowS') : T('studioLinkRowSCloud'), onClick: () => go('link'), k: 'link' }) : null;
    // 24/10/2026: תרגום בטלפון — הסרטון לא עוזב את הטלפון (Studio לאנדרואיד בוחר, מודד, מעלה רק את הקול וצורב בסוף)
    // 29/10/2026: הבחירה הראשית כבר דרך האפליקציה — כאן הדרך הישנה, מהדפדפן (חיתוך לפני התרגום, כתוביות שבתוך הקובץ)
    // 31/10/2026: הפוך — הבחירה הראשית מהדפדפן (תרגום וצריבה בשרת), וכאן הבחירה המפורשת בתרגום בטלפון דרך האפליקציה
    const phRow = phOk() && !f.file && !f.ka ? rowNav({ tile: tile('spark', 'gray'), label: T('studioPickPh'), sub: T('studioPickPhS'), onClick: phPick, k: 'ph-pick' }) : null;
    // 25/10/2026 (שלב 2): גם התמלול, הדוברים והיישור בטלפון — הקול לא עוזב אותו. פעם ראשונה: הורדת המודלים (Wi‑Fi)
    const pwRow = f.ph ? rowSwitch({ label: T('studioPhPw'), sub: T('studioPhPwS'), on: f.pw === true, onClick: () => { f.pw = f.pw !== true; render('none'); }, k: 'ph-pw' }) : null;   // 30/10/2026 (בקשת המשתמש): כבוי כברירת מחדל
    // 25/10/2026 (בקשת המשתמש — "נקי ומסודר לפי ת־עיצוב"): כל המקורות בקבוצה אחת, במקום שלוש קבוצות נפרדות
    // 26/10/2026 (בקשת המשתמש): "מ־Google Drive" = רשימה שלנו (pageDrivePick), לא Google Picker — הסרטון נשאר ב־Drive, בלי העלאה
    const driveRow = ui.gb ? rowNav({ tile: tile('cloud', 'teal'), label: T('studioFromDrive'), value: f.drive ? T('studioInDrive') : '', sub: f.drive ? null : T('studioFromDriveSub'), onClick: () => { if (dp.st !== 'ok') dp.st = ''; go('dpick'); }, k: 'from-drive' }) : null;
    // 26/10/2026: קריוקי משיר רגיל — הליווי בלי הקול, והמילים נצבעות כשהן נשמעות (רק בשרת שלנו)
    // 30/10/2026: הקריוקי עבר ללשונית משלו (pageKa) — בלי מתג כאן
    p.append(list(pickRow, f.ka ? null : phRow, f.ka ? null : pwRow, linkRow, f.ka ? null : subsRow, driveRow));
    const tk = f.trk && f.trk.tracks.length ? f.trk.tracks : null;   // שלב 4
    const hl = tk && f.trk.hlp != null && f.trk.src == null && hlpEngine() ? tk.find((t) => t.id === f.trk.hlp) : null;   // 26/10/2026
    const nsN = tk ? tk.filter((t) => t.net).length : 0, hv = nsN ? nsHave(f) : null, nid = f.ns && f.ns.id;   // 28/10/2026: גם מהרשת
    if (tk) p.append(list(rowNav({ tile: tile('cc', 'orange'), label: nsN ? nid ? nsIdText(nid) : T('studioNsRow') : T('studioTrkRow'), value: nsN ? fmtNum(tk.length) : T('studioTrkN', { n: fmtNum(tk.length) }),
      sub: hl ? T('studioTrkHlpRow', { l: trkLabel(hl) }) : nsN ? (nid && nid.by === 'h' ? T('studioNsIdH') : T('studioNsIdN')) : T('studioTrkRowS'), onClick: () => go('tracks'), k: 'tracks' }),
      hv && rowNav({ tile: tile('check', 'green'), label: T('studioNsHave', { l: langName(hv.l, uiLang()) }), sub: hv.ex ? T('studioNsHaveS', { n: fmtNum(hv.n), k: fmtNum(hv.ex) }) : T('studioNsHaveS0', { n: fmtNum(hv.n) }), onClick: () => go('tracks'), k: 'ns-have' })));
    const adv = f.ka ? null : advRows(f, pick);   // 30/10/2026: עצות של תרגום (שפה, צריבה) — לא לשיר
    if (adv) p.append(h('div', 'st-gap sm'), adv);
    if (!f.ka && (f.fileObj || (f.drive && !f.drive.bx))) p.append(list(rowNav({ tile: tile('film', 'blue'), label: T('studioEdBefore'), value: f.edl ? edlSum(f.edl, f.dur || 0) : T('studioEdOptional'), onClick: () => { fnlAdd('cut'); go('cutsrc'); }, k: 'cutsrc' })));   // מ4
    if (isIOS()) p.append(note(T('studioIosTip')));
  }

  if (f.ka) {   // 26/10/2026: קריוקי — המילים, הקול, ומה לקבל (בלי שפות ובלי מצב תרגום)
    kaSection(p, f);
    p.append(secT(T('studioSecOut')), list(...KA_OUTS.map((k) => rowCheck({ label: outName(k), sub: outSub(k), on: !!f.out[k], onClick: () => { f.out[k] = !f.out[k]; render('none'); }, k: 'o:' + k }))), note(T('studioKaOutNote')));
    const ky = normKy(store.settings.ky);   // 31/10/2026: עיצוב הקריוקי — דף משלו (במקום עיצוב הכתוביות של הסרטונים)
    p.append(list(rowNav({ tile: tile('edit', 'purple'), label: T('studioKyT'), value: kySchName(kySchemeOf(ky)), onClick: () => go('kasty'), k: 'kasty' })));
    const startKa = btn('st-btn wide', ui.starting ? T('studioStarting') : T('studioKaStart'), startFromForm, 'start');
    startKa.disabled = !(f.fileObj || f.drive || (f.link && f.linkOk)) || !kaLyr(f.lyr).trim() || ui.starting;
    const ft = h('div', 'st-foot'); ft.append(startKa, h('p', 'st-foot-n', !kaLyr(f.lyr).trim() ? T('studioKaNeedLyr') : T('studioKaStartNote'))); p.append(ft);
    return;
  }
  // שפות
  const ul = uiLang();
  p.append(secT(T('studioSecLangs')), list(
    rowNav({ tile: tile('mic', 'blue'), label: T('studioFrom'), value: f.from === 'auto' ? T('studioAuto') : langName(f.from, ul), onClick: () => go('lang', 'from'), k: 'from' }),
    rowNav({ tile: tile('globe', 'teal'), label: T('studioTo'), value: langsSum(f.to), onClick: () => go('lang', 'to'), k: 'to' })));
  // 25/10/2026: שורת השבבים מתחת ל"לתרגם ל־" הוסרה — השורה עצמה פותחת את רשימת השפות (בחירה מרובה), בלי כפילות

  // 25/10/2026: שדה "שמות ומונחים" הוסר מהטופס (בקשת המשתמש) — מילון המונחים בחוקים נשאר

  // מצב התרגום — המומלץ מסומן ונבחר מראש
  p.append(secT(T('studioSecMode')), ...modePicker(f.mode, (id) => { f.mode = id; render('none'); }));
  // מה לקבל — "זהה למקור" כברירת מחדל, SRT תמיד
  if (f.subs) {   // 22/10/2026: בלי סרטון — קובצי כתוביות בלבד (VTT ו־ASS עולים תמיד כקובצי עזר)
    p.append(secT(T('studioSecOut')), list(rowCheck({ on: true, locked: true, label: T('studioOutSrt'), sub: T('studioOutSrtS') }),
      rowCheck({ on: true, locked: true, label: 'WebVTT · ASS', sub: T('studioSubsOutAux') }),
      (() => { const r = h('div', 'st-row st-muted'); r.append(rowTxt(T('studioSubsOutVideo'), T('studioSubsOutVideoS'))); return r; })()));
  } else {
    p.append(secT(T('studioSecOut')), outRows(f.out, f.file ? f.file.size : 0, (k) => { f.out[k] = !f.out[k]; render('none'); }), note(T('studioOutSrtNote')));
    p.append(secT(T('studioSecStyle')), stylePicker(f.style, (k) => { f.style = k; render('none'); }));
    // 26/10/2026 (בעקבות Vid Hub): גודל, צבע, רקע וגובה כבר בטופס — הצריבה הראשונה משתמשת בהם (עד היום רק בהפקה מחדש)
    if (OUTS.some((k) => f.out[k])) p.append(styFold('form', f.sty || {}, (patch) => {
      fnlAdd('sty');
      const next = normSty(Object.assign({}, f.sty || {}, patch));
      f.sty = next || null;
      store.settings.sty = next || undefined; if (!next) delete store.settings.sty; save();   // ברירת המחדל לעבודה הבאה
      render('none');
    }));
  }

  // התחלה: יוצרים עבודה בשרתון ומעלים ל־Drive (הקול קודם). טיוטה — אפשרות משנית
  const startBtn = btn('st-btn wide', ui.starting ? T('studioStarting') : T('studioStart'), startFromForm, 'start');
  startBtn.disabled = !(f.fileObj || f.drive || f.subs || f.ph || (f.link && f.linkOk)) || ui.starting;   // ph — תרגום בטלפון
  if (f.subs) { const ft = h('div', 'st-foot'); ft.append(startBtn, h('p', 'st-foot-n', T('studioSubsStartNote'))); p.append(ft); return; }   // בלי טיוטה: הקובץ רק בזיכרון
  // 25/10/2026: כפתור אחד, דבוק לתחתית המסך. הטיוטה — "שמירה" בסרגל העליון (עד היום גם כפתור שני כאן, אותה פעולה)
  const foot = h('div', 'st-foot');
  foot.append(startBtn, h('p', 'st-foot-n', !f.file && !f.ph && !(f.link && f.linkOk) ? T('studioPickToStart') : !f.fileObj && !f.drive && !f.ph && !(f.link && f.linkOk) ? T('studioRepickNote') : f.drive ? T('studioStartNoteDrive') : T('studioStartNote')));
  p.append(foot);
}
/* "התחלה" לקובץ כתוביות: אומדן ואישור → עבודה בשרתון → העלאה (קובץ קטן) → רישום → תור השרת */
function startSubs(f) {
  if (ui.access === 'signin' || ui.access === 'denied') { flashSafe(ui.access === 'signin' ? T('studioErrSignin') : T('studioErrDenied')); return; }
  if (!subsOk()) { flashSafe(T('studioSubsApiOnly')); return; }
  if (!ui.r2 && (!store.drive || !store.drive.connected)) {
    if (typeof askConfirm === 'function') askConfirm(T('studioNeedDrive'), connectDrive, { ok: T('studioDriveConnect') });
    else connectDrive();
    return;
  }
  if (!langReady(f.from, f.to)) { flashSafe(errText('lang_unsupported')); return; }
  ui.starting = true; render('none');
  (async () => {
    const s = f.subs;
    const spec = { name: s.name, size: s.size, type: s.type, dur: Math.round(s.imp.stats.dur / 1000), from: f.from, to: f.to,
      mode: modeFor(f.mode, ui.mf), out: [], style: f.style, terms: f.terms, src: 'subs', sdh: f.sdh === 'keep' ? 'keep' : 'rm' };
    if (apiMode()) Object.assign(spec, { eng: 'api', cap: store.settings.cap });
    else if (ryMode()) Object.assign(spec, { eng: 'api', cap: store.settings.cap, ry: 1 });
    else Object.assign(spec, { eng: 'api', cap: store.settings.cap, cp: 1 });
    const est = startEstimate(spec.mode, spec.dur, curNorm(), ui.api, apiMode());
    if (est.min && typeof askConfirm === 'function') {
      const yes = await estAsk(est, f);
      if (!yes || form !== f) { ui.starting = false; render('none'); return; }
    }
    const j = await net.api('create', { spec });
    ui.starting = false;
    if (!j.ok || !j.job) { flashSafe(errText(j.error)); render('none'); return; }
    fnlAdd('start');
    const rec = normJob({ id: j.job.id, created: j.job.created || Date.now(), spec: j.job.spec || spec, srv: j.job,
      fp: { name: s.name, size: s.size, lm: 0 }, org: orgOf(f, null, spec.eng), up: Object.assign({ noAudio: 'subs' }, isR2Folder(j.job.folder) ? { folder: j.job.folder } : {}) });
    store.jobs.unshift(rec);
    save();
    const blob = new Blob([s.bytes], { type: s.type || 'text/plain' });
    const refText = trkRefSrt(f);   // שלב 4: רצועת ההשוואה — לתיקיית העבודה; בסוף העבודה → סט הזהב
    if (refText) await refUpload(rec, refText);
    form = null;
    if (!root) { startRun(rec.id, blob); return; }
    replaceView('job', rec.id);
    startRun(rec.id, blob);
  })();
}
/* 22/10/2026: קובץ כתוביות קיים (SRT / VTT / ASS) — במקום תמלול. נקרא בטלפון (importSubs = המפענח של העובד),
   ומה שמצאנו מוצג לפני ההתחלה. רק במצב השרת (ה־Routine לא מכיר את המסלול) */
const SUBS_MAX = 5 * 1024 * 1024;   // = SUBS_MAX בשרתון
const subsOk = () => apiMode() || cpMode();
/* 26/10/2026: קריוקי משיר רגיל — רץ כולו בשרת שלנו (הפרדה, יישור, צריבה; בלי Claude), ולכן בכל מנוע כשיש שרת ואחסון */
const kaOk = () => !!(ui.api && ui.api.servers > 0 && ui.r2 && (ui.api.admin || ui.api.ka));   // ka מהשרתון — 30/10/2026: כל מי שמורשה לסטודיו
export const KA_LYR_MAX = 8000;   // = KA_LYR_MAX בשרתון ו־LYR_MAX ב־translator/vt/karaoke.py
const KA_OUTS = ['compact', 'same', 'small'];
/* 31/10/2026: עיצוב הקריוקי (ת־קריוקי) — אותם מפתחות וברירות מחדל כמו norm_ky ב־translator/vt/karaoke.py
   (tests/studio-karaoke-design.test.js משווה). u לא־שר · c שר · f מילוי (w/d) · z גודל · cd ספירה · tc פתיחה · dm הכהיה ·
   bg רקע בלי וידאו · sg צבע לכל זמר (4) · sb ביחד */
export const KY_DEF = { u: '#FFFFFF', c: '#FFC83D', f: 'w', z: 'M', cd: 1, tc: 1, dm: 1, bg: 'dark', sg: ['#3DD6FF', '#FF5CA8', '#7CE38B', '#B48CFF'], sb: '#FFC83D' };
export function normKy(d) {
  d = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  const hx = (v, dv) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : dv);
  const sg = Array.isArray(d.sg) ? d.sg : [];
  return {
    u: hx(d.u, KY_DEF.u), c: hx(d.c, KY_DEF.c), f: d.f === 'd' ? 'd' : 'w', z: ['S', 'M', 'L'].includes(d.z) ? d.z : 'M',
    cd: d.cd === 0 ? 0 : 1, tc: d.tc === 0 ? 0 : 1, dm: [0, 1, 2].includes(d.dm) ? d.dm : 1, bg: ['dark', 'grad', 'tint'].includes(d.bg) ? d.bg : 'dark',
    sg: [0, 1, 2, 3].map((i) => hx(sg[i], KY_DEF.sg[i])), sb: hx(d.sb, KY_DEF.sb),
  };
}

const KA_GV = [0, 10, 20, 30];
/* המילים מהמשתמש — בלי תווי בקרה וכיווניות (= normLyr בשרתון) */
export function kaLyr(t) {
  return String(t == null ? '' : t).replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\r\n?/g, '\n').slice(0, KA_LYR_MAX);
}
/* השדות של הקריוקי ל־spec (קובץ או קישור). המנוע — תמיד השרת שלנו */
function kaSpec(f, spec) {
  if (!f.ka) return spec;
  const out = KA_OUTS.filter((k) => f.out[k]);
  Object.assign(spec, { ka: 1, lyr: kaLyr(f.lyr), ky: normKy(f.ky || store.settings.ky), out: out.length ? out : ['compact'], eng: 'api', cap: store.settings.cap },
    f.bv === true ? { bv: 1 } : {}, f.gv > 0 ? { gv: f.gv } : {});
  delete spec.cp; delete spec.ry; delete spec.edl;
  return spec;
}
/* 26/10/2026: חיפוש מילים ב־LRCLIB — השאילתה משם הקובץ / הכותרת של הקישור, התוצאה הקרובה באורך לשיר קודם.
   נגיעה בתוצאה = המילים בשדה (טקסט בלבד). f.lq השאילתה, f.lr התוצאות (null = עוד לא חיפשו), f.lb בחיפוש, f.le שגיאה */
const kaDur = (f) => Math.round(f.dur || (f.link && f.link.r && Number(f.link.r.d)) || 0);
function kaFind(f) {
  const box = h('div', 'st-ka-find');
  // 30/10/2026: כמו הכתוביות — שיר חדש (קובץ / קישור) = שאילתה חדשה וחיפוש אוטומטי, כל עוד המשתמש לא כתב בעצמו
  const nm = (f.file && f.file.name) || (f.link && f.link.r && f.link.r.t) || '';
  if (f.lq == null || (nm && nm !== f.lqn && !f.lqe)) { f.lq = lyrGuess(nm); f.lqn = nm; f.lr = null; f.le = ''; f.la = false; }
  if (nm && !f.la && !f.lb && f.lr == null && !String(f.lyr || '').trim() && String(f.lq || '').trim().length >= 2) { f.la = true; setTimeout(() => go(), 0); }
  const inp = h('input', 'st-in st-ka-q'); inp.type = 'search'; inp.dir = 'auto'; inp.value = f.lq; inp.placeholder = T('studioKaFindPh');
  inp.setAttribute('aria-label', T('studioKaFindPh')); inp.maxLength = 120;
  inp.addEventListener('input', () => { f.lq = inp.value; f.lqe = true; });
  async function go() {
    if (f.lb || String(f.lq || '').trim().length < 2) return;
    f.lb = true; f.lw = false; f.le = ''; fnlAdd('lyr'); render('none');
    // 31/10/2026: המאגר עמוס — ממשיכים לנסות לבד עד דקה (lrcWait), ובינתיים אומרים את זה
    const r = await net.lyricsSearch(f.lq, kaDur(f), undefined, () => { if (!f.lw) { f.lw = true; if (form === f) render('none'); } });
    f.lb = false; f.lw = false; f.lr = r.ok ? r.list : []; f.le = r.ok ? '' : r.error === 'busy' ? 'busy' : 'err';
    if (form === f) render('none');
  }
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  const b = btn('st-btn st-ka-go', f.lb ? '…' : T('studioKaFind'), go, 'ka-find');
  b.disabled = !!f.lb;
  const row = h('div', 'st-ka-qrow'); row.append(inp, b); box.append(row);
  if (f.lb && f.lw) box.append(note(T('studioKaFindWait')));
  else if (f.le) box.append(note(f.le === 'busy' ? T('studioKaFindBusy') : T('studioKaFindErr')));
  else if (Array.isArray(f.lr) && !f.lr.length) box.append(note(T('studioKaFindNone')));
  else if (Array.isArray(f.lr)) {
    box.append(list(...f.lr.map((x, i) => rowNav({ label: x.t || '—', sub: [x.a, x.d ? '\u2066' + fmtDur(x.d) + '\u2069' : '', x.m ? T('studioKaFindLen') : ''].filter(Boolean).join(' · '),
      onClick: () => { f.lyr = x.plain; f.lr = null; render('none'); flashSafe(T('studioKaFindUsed')); }, k: 'ka-res:' + i }))), note(T('studioKaFindSrc')));
  }
  return box;
}
function kaSection(p, f) {
  const ta = h('textarea', 'st-ask-in st-ka-lyr');
  ta.dir = 'auto'; ta.rows = 8; ta.maxLength = KA_LYR_MAX; ta.value = f.lyr || ''; ta.placeholder = T('studioKaLyrPh');
  ta.setAttribute('aria-label', T('studioKaLyr'));
  ta.addEventListener('input', () => { f.lyr = ta.value; });
  p.append(secT(T('studioKaLyr')), kaFind(f), ta, note(T('studioKaLyrNote')));
  const chip = (lbl, on, fn, k) => { const b = btn('st-chip' + (on ? ' on' : ''), lbl, fn, k); b.setAttribute('aria-pressed', on ? 'true' : 'false'); return b; };
  const gv = h('div', 'st-chips');
  gv.append(...KA_GV.map((x) => chip(x ? '\u2066' + x + '%\u2069' : T('studioKaGv0'), (f.gv || 0) === x, () => { f.gv = x; render('none'); }, 'ka-gv:' + x)));
  p.append(secT(T('studioKaVoice')), list(rowSwitch({ label: T('studioKaBv'), sub: T('studioKaBvS'), on: f.bv === true, onClick: () => { f.bv = f.bv !== true; render('none'); }, k: 'ka-bv' })),
    secT(T('studioKaGv')), gv);
}
/* ---------- 31/10/2026: עיצוב הקריוקי (ת־קריוקי, docs/standards.md) — דף משלו במקום "עיצוב הכתוביות" של הסרטונים.
   תצוגה חיה בראש הדף (אותה פריסה של vt/karaoke.py: שתי שורות מתחלפות, מילוי לאורך המילה, ספירה, סמן זמר), ההגדרות
   נשמרות ב־store.settings.ky (ברירת המחדל לשיר הבא) ונשלחות ב־spec.ky ---------- */
export const KY_SCHEMES = [
  { k: 'gold', u: '#FFFFFF', c: '#FFC83D' }, { k: 'sky', u: '#FFFFFF', c: '#3DD6FF' }, { k: 'rose', u: '#FFFFFF', c: '#FF5CA8' },
  { k: 'mint', u: '#FFFFFF', c: '#30D158' }, { k: 'night', u: '#9AA6B8', c: '#FFFFFF' }];
const kySchName = (k) => (k === 'gold' ? T('studioKySch_gold') : k === 'sky' ? T('studioKySch_sky') : k === 'rose' ? T('studioKySch_rose') : k === 'mint' ? T('studioKySch_mint') : k === 'night' ? T('studioKySch_night') : T('studioKySch_custom'));
export const kySchemeOf = (ky) => { const x = KY_SCHEMES.find((s) => s.u === ky.u && s.c === ky.c); return x ? x.k : 'custom'; };
const KY_SG_RE = /^\s*[[(]\s*(?:(?:p|זמר|זמרת|singer|voice|קול)\s*)?([1-4])\s*[\])]\s*:?\s*/i;   // = _SINGER ב־vt/karaoke.py
const KY_ALL_RE = /^\s*[[(]\s*(?:ביחד|יחד|כולם|שניהם|both|all|together|1\s*[+&]\s*2(?:\s*[+&]\s*[34])*)\s*[\])]\s*:?\s*/i;
/* שורות לתצוגה מהמילים שהודבקו (עד 4), עם הזמר של כל שורה (null = לא סומן) */
export function kyPvLines(text) {
  const out = []; let cur = null;
  for (const raw of kaLyr(text).split('\n')) {
    let line = raw.trim();
    const ms = line.match(KY_SG_RE), m = ms || line.match(KY_ALL_RE);
    if (m) { cur = ms ? +ms[1] : 0; line = line.slice(m[0].length).trim(); }
    if (!line || /^\s*[[(].*[\])]\s*$/.test(line)) continue;
    out.push({ t: line.split(/\s+/).slice(0, 7).join(' '), sg: cur });
    if (out.length === 4) break;
  }
  return out;
}
function kySet(patch) { store.settings.ky = normKy(Object.assign({}, normKy(store.settings.ky), patch)); save(); render('none'); }
function kyPreview(f) {
  const ky = normKy(store.settings.ky);
  let lines = kyPvLines(f && f.lyr);
  if (lines.length < 2) lines = [T('studioKyS1'), T('studioKyS2'), T('studioKyS3'), T('studioKyS4')].map((t, i) => ({ t, sg: [1, 2, 1, 0][i] }));
  const rtl = /[֐-׿]/.test(lines.map((x) => x.t).join(''));
  const ttl = (f && f.fileObj && f.fileObj.name ? f.fileObj.name.replace(/\.[^.]+$/, '') : T('studioKySampleT')).slice(0, 60);
  const wrap = h('div', 'st-ky-wrap');
  const stage = h('div', 'st-ky-stage'); stage.dir = rtl ? 'rtl' : 'ltr';
  const vid = ui.kyPv !== 'n';
  stage.classList.add(vid ? 'v' : 'bg-' + ky.bg);
  stage.style.setProperty('--ky-u', ky.u); stage.style.setProperty('--ky-c', ky.c);
  stage.style.setProperty('--ky-fs', { S: 4.6, M: 5.6, L: 6.6 }[ky.z] + 'cqi');
  const scrim = h('div', 'st-ky-scrim'); scrim.style.opacity = vid ? [0, 0.7, 1][ky.dm] : 0;
  const card = h('div', 'st-ky-title', ttl);
  const inter = h('div', 'st-ky-inter', T('studioKyInter'));
  const rows = [0, 1].map(() => { const r = h('div', 'st-ky-row'); r.append(h('div', 'st-ky-dots'), h('div', 'st-ky-line')); return r; });
  const lyr = h('div', 'st-ky-lyr'); lyr.append(...rows);
  stage.append(scrim, inter, card, lyr);
  const colOf = (sg) => (sg == null ? ky.c : sg === 0 ? ky.sb : ky.sg[sg - 1]);
  const nSg = Math.max(2, ...lines.map((x) => x.sg || 0));
  // הזמנים — שורה של 3 שנ', הפסקה ארוכה לפני השלישית (ספירה + "נגינה"); הפריסה = layout() בעובד
  const starts = [1.2, 4.6, 16, 19.4].slice(0, lines.length), LOOP = 24, PRE = 4, LEAD = 0.6, HOLD = 0.5;
  const tl = lines.map((x, k) => {
    const ws = x.t.split(' '), tot = ws.reduce((a, w) => a + w.length + 1, 0); let t = starts[k];
    const words = ws.map((w) => { const d = 3 * (w.length + 1) / tot; const o = { w, s: t, e: t + d * 0.92 }; t += d; return o; });
    return { s: starts[k], e: words[words.length - 1].e, words, sg: x.sg };
  });
  const free = [0, 0];
  const shown = tl.map((ln, k) => {
    const row = k % 2; let show = Math.min(Math.max(free[row], ln.s - PRE, 0), Math.max(0, ln.s - LEAD));
    let hide = ln.e + HOLD; const nx = tl[k + 2]; if (nx) hide = Math.min(hide, Math.max(ln.e + 0.15, nx.s - PRE));
    free[row] = hide;
    return Object.assign({}, ln, { row, show, hide, cd: ln.s - (k ? tl[k - 1].e : 0) >= 4 || k === 0 });
  });
  const built = [null, null];
  const build = (row, li) => {
    const el = rows[row].lastChild; el.textContent = '';
    if (li < 0) return;
    const ln = shown[li];
    rows[row].style.setProperty('--ky-c', colOf(ln.sg));
    if (ln.sg != null) { const mk = h('span', 'st-ky-mk', ln.sg ? String(ln.sg) : Array.from({ length: nSg }, (_, i) => i + 1).join('+')); mk.dir = 'ltr'; el.append(mk); }
    for (const w of ln.words) { const s = h('span', 'st-ky-w', w.w); const on = h('span', 'st-ky-on', w.w); on.setAttribute('aria-hidden', 'true'); s.append(on); el.append(s); }
  };
  const frame = (t) => {
    card.style.opacity = ky.tc && t < shown[0].show ? 1 : 0;
    for (const row of [0, 1]) {
      const li = shown.findIndex((l) => l.row === row && t >= l.show && t < l.hide);
      if (built[row] !== li) { build(row, li); built[row] = li; }
      rows[row].style.opacity = li < 0 ? 0 : 1;
      const dots = rows[row].firstChild; dots.textContent = '';
      if (li < 0) continue;
      const ln = shown[li], ws = rows[row].lastChild.querySelectorAll('.st-ky-w');
      ln.words.forEach((w, i) => {
        const p = ky.f === 'd' ? (t >= w.s ? 1 : 0) : t <= w.s ? 0 : t >= w.e ? 1 : (t - w.s) / (w.e - w.s);
        ws[i].style.setProperty('--p', (p * 100).toFixed(1) + '%');
      });
      if (ky.cd && ln.cd && t >= ln.s - 3 && t < ln.s) for (let k = 0; k < 3; k++) dots.append(h('i', k >= Math.ceil(ln.s - t) ? 'off' : null));
    }
    inter.style.opacity = shown.length > 2 && t > shown[1].hide + 0.4 && t < shown[2].show - 0.2 ? 1 : 0;
  };
  const t0 = performance.now();
  const tick = (now) => { if (!stage.isConnected) return; frame(((now - t0) / 1000) % LOOP); requestAnimationFrame(tick); };
  if (reduceMotion()) frame(starts[0] + 1.4); else requestAnimationFrame((now) => { frame(0); tick(now); });
  const pv = h('div', 'st-seg2 st-ky-pvseg'); pv.setAttribute('role', 'radiogroup');
  for (const [k, l] of [['v', T('studioKyPvV')], ['n', T('studioKyPvN')]]) {
    const b = btn(null, null, () => { ui.kyPv = k; render('none'); }, 'ky-pv:' + k);
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', (ui.kyPv === 'n' ? 'n' : 'v') === k ? 'true' : 'false'); b.append(h('b', null, l)); pv.append(b);
  }
  wrap.append(stage, pv);
  return wrap;
}
/* בחירה אחת מתוך כמה (st-seg2) */
function kySeg(items, cur, onPick, k, aria) {
  const g = h('div', 'st-seg2'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', aria);
  for (const [v, l] of items) {
    const b = btn(null, null, () => onPick(v), k + ':' + v);
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', v === cur ? 'true' : 'false'); b.append(h('b', null, l)); g.append(b);
  }
  return g;
}
function kyColor(val, aria, onSet, k) {
  const i = h('input', 'st-ky-col'); i.type = 'color'; i.value = val.toLowerCase(); i.setAttribute('aria-label', aria); i.dataset.k = k;
  i.addEventListener('change', () => onSet(i.value.toUpperCase()));
  return i;
}
function pageKaSty(p) {
  const ky = normKy(store.settings.ky), f = form && form.ka ? form : null;
  p.append(navBar({ back: T('studioKaNew') }), large(T('studioKyT')), kyPreview(f));
  // צבעים — ערכות מוכנות + מותאם (שני צבעים)
  const sch = kySchemeOf(ky), custom = sch === 'custom' || ui.kyCustom;
  const chips = h('div', 'st-ky-schemes');
  for (const x of KY_SCHEMES.concat([{ k: 'custom' }])) {
    const on = x.k === 'custom' ? custom : !custom && sch === x.k;
    const b = btn('st-ky-sch' + (on ? ' on' : ''), null, () => { if (x.k === 'custom') { ui.kyCustom = true; render('none'); } else { ui.kyCustom = false; kySet({ u: x.u, c: x.c }); } }, 'ky-sch:' + x.k);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const sw = h('span', 'st-ky-sw' + (x.k === 'custom' ? ' any' : ''));
    if (x.u) { sw.style.setProperty('--a', x.c); sw.style.setProperty('--b', x.u); sw.append(h('span', null, T('studioKySwTxt'))); }
    b.append(sw, h('small', null, kySchName(x.k)));
    chips.append(b);
  }
  const colRows = [chips];
  if (custom) {
    const r = h('div', 'st-row st-ky-pair');
    r.append(rowTxt(T('studioKySch_custom')), h('span', 'st-ky-pl', T('studioKyUns')), kyColor(ky.u, T('studioKyUns'), (v) => kySet({ u: v }), 'ky-u'),
      h('span', 'st-ky-pl', T('studioKySung')), kyColor(ky.c, T('studioKySung'), (v) => kySet({ c: v }), 'ky-c'));
    colRows.push(r);
  }
  p.append(secT(T('studioKyColors')), list(...colRows));
  // זמרים — צבע לכל זמר בדואט (+ "ביחד"); החלוקה מהסימון במילים
  const nSg = Math.max(2, Math.min(4, ui.kySgN || (ky.sg[3] !== KY_DEF.sg[3] ? 4 : ky.sg[2] !== KY_DEF.sg[2] ? 3 : 2)));
  const sgRow = (lbl, val, mk, onSet, k) => { const r = h('div', 'st-row st-ky-sg'); const m = h('span', 'st-ky-mk', mk); m.dir = 'ltr'; m.style.setProperty('--ky-c', val); r.append(kyColor(val, lbl, onSet, k), rowTxt(lbl), m); return r; };
  const sgs = [];
  for (let i = 0; i < nSg; i++) sgs.push(sgRow(T('studioKySinger', { n: i + 1 }), ky.sg[i], String(i + 1), (v) => { const a = ky.sg.slice(); a[i] = v; kySet({ sg: a }); }, 'ky-sg:' + i));
  sgs.push(sgRow(T('studioKyAll'), ky.sb, Array.from({ length: nSg }, (_, i) => i + 1).join('+'), (v) => kySet({ sb: v }), 'ky-sb'));
  if (nSg < 4) sgs.push(btn('st-row st-act', '+ ' + T('studioKyAdd'), () => { ui.kySgN = nSg + 1; render('none'); }, 'ky-sg-add'));
  p.append(secT(T('studioKySingers')), list(...sgs), note(T('studioKySingersNote')));
  // מילים
  const it = (lbl, ctl, sub) => { const r = h('div', 'st-row st-ky-it'); r.append(rowTxt(lbl, sub), ctl); return r; };
  p.append(secT(T('studioKyWords')), list(
    it(T('studioKyFill'), kySeg([['w', T('studioKyWipe')], ['d', T('studioKyWord')]], ky.f, (v) => kySet({ f: v }), 'ky-f', T('studioKyFill'))),
    it(T('studioKySize'), kySeg([['S', 'S'], ['M', 'M'], ['L', 'L']], ky.z, (v) => kySet({ z: v }), 'ky-z', T('studioKySize'))),
    rowSwitch({ label: T('studioKyCd'), on: !!ky.cd, onClick: () => kySet({ cd: ky.cd ? 0 : 1 }), k: 'ky-cd' }),
    rowSwitch({ label: T('studioKyTc'), on: !!ky.tc, onClick: () => kySet({ tc: ky.tc ? 0 : 1 }), k: 'ky-tc' })));
  // רקע
  p.append(secT(T('studioKyBg')), list(
    it(T('studioKyPvV'), kySeg([[0, T('studioKyDim0')], [1, T('studioKyDim1')], [2, T('studioKyDim2')]], ky.dm, (v) => { ui.kyPv = 'v'; kySet({ dm: v }); }, 'ky-dm', T('studioKyDim')), T('studioKyDim')),
    it(T('studioKyBgN'), kySeg([['dark', T('studioKyBgDark')], ['grad', T('studioKyBgGrad')], ['tint', T('studioKyBgTint')]], ky.bg, (v) => { ui.kyPv = 'n'; kySet({ bg: v }); }, 'ky-bg', T('studioKyBgN')))),
  note(T('studioKyNote')));
}
function pickSubs(f) {
  if (!subsOk()) { flashSafe(T('studioSubsApiOnly')); return; }
  const inp = h('input'); inp.type = 'file'; inp.hidden = true;
  inp.accept = '.srt,.vtt,.ass,.ssa,text/plain,text/vtt,application/x-subrip';
  inp.addEventListener('change', async () => {
    const file = inp.files && inp.files[0];
    inp.remove();
    if (!file) return;
    if (file.size > SUBS_MAX || !file.size) { flashSafe(T('studioSubsBig')); return; }
    let bytes;
    try { bytes = new Uint8Array(await file.arrayBuffer()); } catch (e) { flashSafe(T('studioSubsBad')); return; }
    const imp = importSubs(bytes, { sdh: f.sdh !== 'keep' });
    if (!imp.stats.n) { flashSafe(T('studioSubsBad')); return; }
    f.subs = { name: file.name, size: file.size, type: file.type || '', bytes, imp };
    f.file = { name: file.name, size: file.size, type: file.type || '' };
    f.fileObj = null; f.handle = null; f.drive = null; f.edl = null; f.sa = null; f.trk = null;
    if (f.from === 'auto') f.from = 'en';
    render('none');
  });
  document.body.append(inp);
  inp.click();
}
function subsSection(p, f) {
  const s = f.subs, st = s.imp.stats;
  const card = btn('st-filecard', null, () => pickSubs(f), 'subs-file');
  card.setAttribute('aria-label', T('studioReplace') + ': ' + s.name);
  const th = h('span', 'st-thumb'); th.append(ico('cc'));
  const txt = h('span', 'st-l');
  const nm = h('b'); nm.append(fileNameEl(s.name));
  const sz = h('small'); sz.append(fmtSize(s.size) + ' · ' + T('studioSubsCount', { n: fmtNum(st.n) }) + ' · ' + fmtDur(st.dur / 1000) + ' · ', h('span', 'st-linkish', T('studioReplace')));
  txt.append(nm, sz, h('small', 'st-ok', st.fmt.toUpperCase() + (st.fixed ? ' · ' + T('studioSubsEncFixed') : '')));
  card.append(th, txt);
  p.append(secT(T('studioSecSubs')), card);
  if (s.trk && f.trk) {   // שלב 4: מרצועה שבתוך הסרטון — רצועה אחרת / השוואה
    const ref = f.trk.ref != null ? f.trk.tracks.find((t) => t.id === f.trk.ref) : null;
    p.append(list(rowNav({ tile: tile('cc', 'orange'), label: T('studioTrkFrom'), value: trkLabel(f.trk.tracks.find((t) => t.id === f.trk.src) || {}), sub: f.file ? f.trk.vname : '', onClick: () => go('tracks'), k: 'tracks' }),
      f.trk.tracks.some((t) => t.kind === 'text' && t.id !== f.trk.src) && rowNav({ tile: tile('check', 'green'), label: T('studioTrkCmp'), value: ref ? trkLabel(ref) : T('studioTrkRefNone'), onClick: () => go('tracks'), k: 'tracks-ref' })));
  }
  // הסרטון — שלב הבא (צריבה, סנכרון ומין הדוברים מהקול)
  const vr = h('div', 'st-row st-ric st-muted'); vr.append(tile('film', 'blue'), rowTxt(T('studioSubsAddVideo'), T('studioSubsAddVideoS')));
  p.append(secT(T('studioSubsVideoT')), list(vr));
  // מה מצאנו בקובץ
  const rows = [];
  const sdhN = st.sdh + st.labels;
  if (sdhN || f.sdh === 'keep') {
    rows.push(rowSwitch({ label: T('studioSubsSdh'), sub: T('studioSubsSdhS', { n: fmtNum(st.sdh), m: fmtNum(s.imp.names.length) }), on: f.sdh !== 'keep',
      onClick: () => { f.sdh = f.sdh === 'keep' ? 'rm' : 'keep'; s.imp = importSubs(s.bytes, { sdh: f.sdh !== 'keep' }); render('none'); }, k: 'subs-sdh' }));
  }
  if (st.it || st.top || st.pit) rows.push(rowCheck({ on: true, locked: true, label: T('studioSubsFmt'), sub: T('studioSubsFmtS', { i: fmtNum(st.it + st.pit), t: fmtNum(st.top) }) }));
  const cl = st.ads + st.overlaps + st.dups + st.sorted;
  if (cl) rows.push(rowCheck({ on: true, locked: true, label: T('studioSubsClean'), sub: [st.ads ? T('studioSubsAds', { n: fmtNum(st.ads) }) : '', st.overlaps + st.dups ? T('studioSubsOverlaps', { n: fmtNum(st.overlaps + st.dups) }) : '', st.sorted ? T('studioSubsSorted') : ''].filter(Boolean).join(' · ') }));
  if (st.dual) rows.push(rowCheck({ on: true, locked: true, label: T('studioSubsDual'), sub: T('studioSubsDualS', { n: fmtNum(st.dual) }) }));
  if (s.imp.names.length) {
    const r = h('div', 'st-row st-muted');
    r.append(rowTxt(T('studioSubsNames'), s.imp.names.slice(0, 8).map((x) => x[0]).join(', ') + (s.imp.names.length > 8 ? '…' : '')));
    rows.push(r);
  }
  if (rows.length) p.append(secT(T('studioSubsFound')), list(...rows));
  p.append(note(T('studioSubsGenderNote')));
}
/* ---------------- שלב 4 (22/10/2026): כתוביות בתוך הסרטון (MKV / MP4) ----------------
   הרשימה נקראת מתחילת הקובץ מיד אחרי הבחירה; החילוץ — מעבר אחד על הקובץ, בטלפון (studiotracks.js). רצועה לתרגום
   הופכת את הטופס למסלול "קובץ כתוביות"; רצועת השוואה עולה לתיקיית העבודה ונכנסת לסט הזהב בסוף (goldAuto) */
function tracksFor(f, file) {
  f.trk = null;
  f._rb = file && file.remote ? file : null;
  nsFor(f, file);   // 28/10/2026: כתוביות רשמיות מהרשת — לכל סרטון, גם בלי רצועות בקובץ
  if (!/\.(mkv|mk3d|webm|mp4|m4v|mov)$/i.test(file.name || '')) return;
  listTracks(file).then((L) => {
    if (form !== f || !(f.fileObj === file || (f._rb === file && f.drive && f.drive.id === file.id)) || !L || !L.tracks.length) return;   // _rb — הסרטון ב־Drive (dpPick)
    // 26/10/2026: רצועה באנגלית = עזר להגהת התמלול, מראש — רק כשהקובץ בטלפון (מ־Drive החילוץ קורא את כל הקובץ ברשת)
    const h0 = trkSet(f, file, L.tracks, !file.remote);
    if (h0) trkEnsure(f, [h0.id]); else render('none');
  }, () => {});
}
/* הרצועות שבקובץ → f.trk. כתוביות מהרשת שכבר הגיעו — נשארות (עם מה שכבר ירד והבחירות שלהן). מחזיר את העזר שנבחר מראש */
function trkSet(f, file, tracks, auto) {
  const old = f.trk;
  f.trk = { file, vname: file.name, tracks, x: {}, src: null, ref: null, hlp: null, p: 0, busy: false };
  if (old) { for (const id of Object.keys(old.x)) if (id.startsWith('n:')) f.trk.x[id] = old.x[id]; for (const c of ['src', 'ref', 'hlp']) if (String(old[c]).startsWith('n:')) f.trk[c] = old[c]; }
  const h0 = hlpEngine() && auto ? trkHlpAuto(tracks) : null;
  nsMerge(f, file);
  if (h0) f.trk.hlp = h0.id;
  return h0;
}
/* 30/10/2026 (בקשת המשתמש — "גם במצב הכל בטלפון ימשכו כתוביות מכל המקורות וגם מהקובץ"): בבחירה דרך האפליקציה הדף
   לא רואה את הקובץ. מהרשת — לפי טביעת האצבע שהאפליקציה חישבה (oh; Studio ישן — לפי השם בלבד); מהקובץ — הרצועות
   שהאפליקציה כבר חילצה (z), מוכנות בלי חילוץ נוסף */
/* 30/10/2026 (הצילום: "הסרטון הפסיק לעלות ל־R2"): Studio ישן מתעלם מ־vc ומעלה רק את הקול — אומרים (הקישור לעדכון — מתחת לכרטיס) */
function phNote(P) {
  if ((P.cap || 0) >= PH_CAP_VC) return h('small', 'st-ok', T('studioPhNote'));
  return h('small', 'st-warn', T('studioPhOld'));
}
function phTracks(f, r) {
  const vf = { name: r.name, size: r.size, oh: r.oh || '', ph: r.pid };
  f.trk = null;
  nsFor(f, vf);
  if (!r.z) return;
  phSubs(r.z).then((L) => {
    if (form !== f || !f.ph || f.ph.pid !== r.pid || !L.length) return;
    const tracks = L.map((t) => ({ id: 'p:' + t.i, kind: 'text', fmt: 'srt', lang: lang2(t.l) || '', name: t.t, def: false, forced: t.f, sdh: /\bSDH\b|hearing/i.test(t.t) }));
    trkSet(f, vf, tracks, true);
    for (const t of L) f.trk.x['p:' + t.i] = { st: 'ok', text: t.x, n: t.x.split(' --> ').length - 1 };
    render('none');
  }, () => {});
}
/* המקטע z: base64url → deflate בלי כותרת → [{i,l,t,f,x}] (PhCore.packSubs) */
async function phSubs(z) {
  const b = Uint8Array.from(atob(String(z).replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((z.length + 3) % 4)), (c) => c.charCodeAt(0));
  const txt = await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  const a = JSON.parse(txt);
  return (Array.isArray(a) ? a : []).filter((t) => t && Number.isInteger(t.i) && typeof t.x === 'string' && t.x.length).slice(0, 16)
    .map((t) => ({ i: t.i, l: String(t.l || '').slice(0, 12), t: String(t.t || '').replace(/[\u0000-\u001f]/g, '').slice(0, 80), f: t.f === true, x: t.x.slice(0, 2e6) }));
}
function trkLabel(t) {
  if (!t || t.id == null) return '';
  const l = t.lang ? langName(t.lang, uiLang()) : T('studioTrkUnd');
  return l + (t.name ? ' · ' + t.name : '');
}
function trkSub(f, t) {
  const x = f.trk.x[t.id];
  if (t.net) return x && x.st === 'run' ? T('studioNsLoading') : x && x.st === 'err' ? T('studioTrkErr') : nsSub(t);
  const flags = [t.kind === 'text' ? t.fmt.toUpperCase() : t.codec, t.def ? T('studioTrkDef') : '', t.forced ? T('studioTrkForced') : '', t.sdh ? 'SDH' : ''].filter(Boolean).join(' · ');
  if (t.kind === 'image') return flags + ' · ' + T('studioTrkImage');
  if (t.kind !== 'text') return flags + ' · ' + T('studioTrkOther');
  if (x && x.st === 'run') return T('studioTrkX', { p: Math.round(f.trk.p * 100) });
  if (x && x.st === 'ok') return flags + ' · ' + T('studioSubsCount', { n: fmtNum(x.n) });
  if (x && x.st === 'err') return T('studioTrkErr');
  return flags;
}
/* חילוץ של מה שחסר — מעבר אחד על הקובץ לכל הרצועות שביקשו */
async function trkEnsure(f, ids) {
  const k = f.trk;
  const need = ids.filter((id) => !k.x[id] || k.x[id].st === 'err');
  // 28/10/2026: כבר ירד → רק לצייר (בלי זה בחירה חוזרת של אותה רצועה לא הופיעה); חילוץ שרץ → נאסף בסופו (למטה)
  if (!need.length || k.busy) { if (form === f) render('none'); return; }
  k.busy = true; k.p = 0;
  for (const id of need) k.x[id] = { st: 'run' };
  render('none');
  let lastR = 0;
  const loc = need.filter((id) => !String(id).startsWith('n:'));   // n: — מהרשת (28/10/2026), במקביל לחילוץ
  const dl = Promise.all(need.filter((id) => String(id).startsWith('n:')).map((id) => nsLoad(f, k, id)));
  try {
    if (loc.length) {
      const X = await extractTracks(k.file, loc, (p) => { k.p = p; if (p - lastR > 0.04) { lastR = p; if (form === f) render('none'); } });
      for (const t of X.tracks) if (loc.includes(t.id)) k.x[t.id] = t.text ? { st: 'ok', text: t.text, n: t.n } : { st: 'err' };
    }
  } catch (e) { for (const id of loc) k.x[id] = { st: 'err' }; }
  await dl;
  k.busy = false;
  const more = [k.src, k.hlp, k.ref].filter((id) => id != null && !k.x[id]);   // נבחרו בזמן שהחילוץ רץ
  if (more.length) { trkEnsure(f, more); return; }
  if (k.src != null && k.x[k.src] && k.x[k.src].st === 'ok' && !f.subs) trkApply(f);
  if (form === f) render('none');
}
const trkBytes = (x) => new TextEncoder().encode(x.text);
function trkApply(f) {
  const k = f.trk, t = k.tracks.find((x) => x.id === k.src), x = k.x[k.src];
  if (!t || !x || x.st !== 'ok') return;
  const bytes = trkBytes(x), imp = importSubs(bytes, { sdh: f.sdh !== 'keep' });
  if (!imp.stats.n) { k.x[k.src] = { st: 'err' }; k.src = null; flashSafe(T('studioSubsBad')); return; }
  const base = String(fileTitle(k.vname) || 'video').slice(0, 120);
  f.subs = { name: base + '.' + (t.lang || 'und') + '.' + t.fmt, size: bytes.length, type: 'text/plain', bytes, imp, trk: t.id };
  if (t.lang && SOURCE_LANGS.includes(t.lang)) f.from = t.lang;
  else if (f.from === 'auto') f.from = 'en';
}
function trkChooseSrc(f, id) {
  const k = f.trk;
  if (id == null) { k.src = null; f.subs = null; render('none'); return; }   // חזרה לתמלול מהקול
  if (!subsOk()) { flashSafe(T('studioSubsApiOnly')); return; }
  k.src = id; if (k.ref === id) k.ref = null;
  f.subs = null;
  if (k.x[id] && k.x[id].st === 'ok') { trkApply(f); render('none'); return; }
  trkEnsure(f, [id]);
}
function trkChooseRef(f, id) {
  const k = f.trk;
  k.ref = id;
  if (id != null) trkEnsure(f, [id]); else render('none');
}
/* רצועת ההשוואה כ־SRT (סט הזהב משווה SRT) — אחרי אותו מפענח, עם הסרת SDH */
function trkRefSrt(f) {
  const k = f && f.trk;
  const x = k && k.ref != null ? k.x[k.ref] : null;
  if (!x || x.st !== 'ok') return '';
  const imp = importSubs(trkBytes(x), { sdh: true });
  const txt = cuesToFile('srt', imp.cues.map((c) => ({ s: c.s, e: c.e, t: c.lines.join('\n') })));
  return txt.length <= GOLD_REF_MAX ? txt : '';
}
/* 26/10/2026 (בקשת המשתמש): רצועת הכתוביות שבקובץ, בשפת המקור, כעזר להגהת התמלול — רק כשהשרת שלנו מגיה
   (pipeline.py: SUBREF_NOTE). התרגום עצמו נשאר מהקול. בפורמט שהעובד קורא: שורה לכל כתובית, `[HH:MM:SS] טקסט` */
const hlpEngine = () => apiMode() || cpMode() || ryMode();
export function trkHlpAuto(tracks) {
  const en = (tracks || []).filter((t) => t.kind === 'text' && t.lang === 'en');
  return en.find((t) => !t.forced && !t.sdh) || en.find((t) => !t.forced) || null;
}
/* cues = התוצאה של importSubs — הזמנים במילישניות (28/10/2026: עד היום נכתבו כשניות, פי 1000 — העובד פסל את העזר
   בכל הפרקים ("כיסוי 0") וההגהה רצה בלעדיו) */
export function hlpText(cues) {
  const two = (n) => String(n).padStart(2, '0');
  const out = [];
  let n = 0;
  for (const c of cues || []) {
    const t = Math.max(0, Math.floor((Number(c.s) || 0) / 1000));
    const body = (c.lines || []).join(' ').replace(/[\u0000-\u001f\u007f<>]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!body) continue;
    const line = '[' + two(Math.floor(t / 3600)) + ':' + two(Math.floor(t / 60) % 60) + ':' + two(t % 60) + '] ' + body;
    n += line.length + 1;
    if (n > SUBS_MAX) break;
    out.push(line);
  }
  return out.length ? out.join('\n') + '\n' : '';
}
function trkHlpTxt(f) {
  const k = f && f.trk;
  const x = k && k.src == null && k.hlp != null ? k.x[k.hlp] : null;
  if (!x || x.st !== 'ok') return '';
  return hlpText(importSubs(trkBytes(x), { sdh: true }).cues);
}
function trkChooseHlp(f, id) {
  f.trk.hlp = id;
  if (id != null) trkEnsure(f, [id]); else render('none');
}
/* חילוץ שעוד רץ בלחיצה על "התחלה" — מחכים לו (עד דקה), אחרת מתחילים בלי העזר */
async function trkWait(f) {
  for (let i = 0; i < 120 && f.trk && f.trk.busy; i++) await new Promise((r) => setTimeout(r, 500));
}
async function hlpUpload(rec, text) {
  try {
    const folder = rec.up.folder || await net.jobFolder(rec.id, fileTitle(rec.spec.name));
    if (!rec.up.folder && folder) rec.up.folder = folder;
    const id = await net.textUpload(folder, 'en.ref.txt', 'text/plain', text, { snbHlp: '1' });
    await net.api('file', { job: rec.id, which: 'r', id, folder });
  } catch (e) { /* העזר רשות — העבודה ממשיכה בלעדיו */ }
}
async function refUpload(rec, text) {
  try {
    const folder = rec.up.folder || await net.jobFolder(rec.id, fileTitle(rec.spec.name));
    if (!rec.up.folder && folder) rec.up.folder = folder;
    rec.gref = await net.goldUpload(folder, text);
    save();
  } catch (e) { /* ההשוואה רשות — העבודה ממשיכה בלעדיה */ }
}
async function trkSave(f, t) {
  await trkEnsure(f, [t.id]);
  const x = f.trk && f.trk.x[t.id];
  if (!x || x.st !== 'ok') return;
  const name = String(fileTitle(f.trk.vname) || 'video').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) + '.' + (t.lang || 'und') + '.' + t.fmt;
  const file = new File([x.text], name, { type: 'text/plain' });
  try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  const u = URL.createObjectURL(file), a = document.createElement('a');
  a.href = u; a.download = name; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(u), 5000);
}
/* ---------------- 28/10/2026: כתוביות רשמיות מהרשת (בקשת המשתמש — "כמו VLC / BS Player / Stremio") ----------------
   הטלפון פונה ישירות (studionet: subsFind/subsGet) — בלי מפתחות ובלי השרת שלנו. מה שנמצא נכנס לרשימת הרצועות כרצועה
   וירטואלית ('n:' + id), כך שתרגום מכתוביות, עזר להגהה, השוואה ושמירה עובדים כמו ברצועה מהקובץ. רמת ההתאמה: h = לפי
   טביעת האצבע (מדויק), r = אותה הוצאה, n = לפי השם בלבד. לתרגום מכתוביות (בלי תמלול) — רק h (אין מול מה לאמת);
   לעזר ולהשוואה — גם השאר: העובד מאמת לפי טקסט מול התמליל (subref_grade), כי שם קובץ יכול להטעות (פרק 7 שהוא פרק 8) */
const nsCache = new Map();   // שם|גודל → התוצאה (בזיכרון, לאותו קובץ — בלי לחפש שוב)
const nsSrcName = (p) => (p === 'os' ? T('studioNsViaOs') : NS_NAME[p] || '');
function nsFor(f, file) {
  f.ns = null;
  if (!file || !(file.size > 0) || !net.subsFind) return;
  const key = String(file.name || '') + '|' + file.size;
  f._nsKey = key;
  const done = (v) => { if (form !== f || f._nsKey !== key) return; f.ns = v; nsMerge(f, file); render('none'); };
  if (nsCache.has(key)) { done(nsCache.get(key)); return; }
  f.ns = { st: 'run' };
  net.subsFind(file, file.name).then((r) => {
    const v = r && r.ok && r.list.length ? { st: 'ok', id: r.id, list: r.list } : { st: 'none' };
    nsCache.set(key, v); done(v);
  }, () => done({ st: 'none' }));
}
/* התוצאה → רצועות וירטואליות. אנגלית מהרשת כעזר להגהה אוטומטי — רק כשאין אנגלית בקובץ, ורק h/r */
function nsMerge(f, file) {
  const ns = f.ns;
  if (!ns || ns.st !== 'ok') return;
  if (!f.trk) f.trk = { file, vname: file.name, tracks: [], x: {}, src: null, ref: null, hlp: null, p: 0, busy: false };
  const k = f.trk, have = new Set(k.tracks.map((t) => t.id));
  for (const it of ns.list) if (!have.has('n:' + it.id)) k.tracks.push({ id: 'n:' + it.id, kind: 'text', lang: it.lang, name: it.rel, fmt: 'srt', net: it });
  if (k.hlp == null && k.src == null && hlpEngine() && !k.tracks.some((t) => !t.net && t.kind === 'text' && t.lang === 'en')) {
    const en = k.tracks.find((t) => t.net && t.lang === 'en' && t.net.m !== 'n');
    if (en) { k.hlp = en.id; trkEnsure(f, [en.id]); }
  }
}
async function nsLoad(f, k, id) {
  try {
    const t = k.tracks.find((x) => x.id === id);
    const b = t && t.net ? await net.subsGet(t.net, f.ns && f.ns.id) : null;
    const imp = b ? importSubs(b, { sdh: false }) : null;
    k.x[id] = imp && imp.stats.n
      ? { st: 'ok', text: cuesToFile('srt', imp.cues.map((c) => ({ s: c.s, e: c.e, t: c.lines.join('\n') }))), n: imp.stats.n } : { st: 'err' };
  } catch (e) { k.x[id] = { st: 'err' }; }
}
const nsBadge = (m) => (m === 'h' ? [T('studioNsMh'), 'green'] : m === 'r' ? [T('studioNsMr'), 'gray'] : [T('studioNsMn'), 'amber']);
function nsSub(t) {
  return T('studioNsBy') + ' · ' + nsSrcName(t.net.src) + (t.net.m === 'h' ? ' · ' + T('studioNsMh') : t.net.m === 'r' ? ' · ' + T('studioNsMr') : ' · ' + T('studioNsMn'));
}
/* מה זוהה: "איך פגשתי את אמא · עונה 1 · פרק 1" */
function nsIdText(id) {
  if (!id) return '';
  return (id.t || '') + (id.type === 'series' ? ' · ' + T('studioNsEp', { s: id.s, e: id.e }) : '');
}
/* כתוביות רשמיות בשפת התרגום (לשורה הירוקה בטופס) */
function nsHave(f) {
  const k = f.trk;
  if (!k) return null;
  const to = normTo(f.to);
  const L = k.tracks.filter((t) => t.net && to.includes(t.lang));
  return L.length ? { l: L[0].lang, n: L.length, ex: L.filter((t) => t.net.m === 'h').length } : null;
}
/* שורה ברשימת "מהרשת": הלחיצה בוחרת (שפת התרגום → השוואה; אחרת → עזר להגהה), ⤴ שומר/משתף */
function nsRow(f, t, role) {
  const k = f.trk, on = role && k[role] === t.id;
  const r = h('div', 'st-row st-ric'); r.dataset.k = 'ns:' + t.id;
  const main = btn('st-nsb', null, role ? () => (role === 'ref' ? trkChooseRef(f, on ? null : t.id) : trkChooseHlp(f, on ? null : t.id)) : null, 'ns-pick:' + t.id);
  if (role) { main.setAttribute('role', 'checkbox'); main.setAttribute('aria-checked', on ? 'true' : 'false'); }
  const bd = nsBadge(t.net.m);
  main.append(tile('cc', t.lang === 'en' ? 'blue' : 'green'), rowTxt(t.name || nsSrcName(t.net.src), trkSub(f, t)), h('span', 'st-badge ' + bd[1], bd[0]));
  if (on) main.append(ico('check', 'st-nsck'));
  const b = btn('st-outb', null, () => trkSave(f, t), 'ns-save:' + t.id);
  b.setAttribute('aria-label', T('studioTrkSave') + ' · ' + trkLabel(t));
  b.disabled = k.busy;
  b.append(ico('share'));
  r.append(main, b);
  return r;
}
function nsSection(p, f) {
  const k = f.trk, ns = f.ns;
  const net0 = k.tracks.filter((t) => t.net);
  if (!net0.length) return;
  const to = normTo(f.to);
  const langs = [...new Set(net0.map((t) => t.lang))];
  const first = [...to, 'en'].filter((l, i, a) => langs.includes(l) && a.indexOf(l) === i);
  const shown = ui.nsAll ? first.concat(langs.filter((l) => !first.includes(l)).sort()) : first;
  if (ns && ns.id) p.append(note(nsIdText(ns.id) + ' · ' + (ns.id.by === 'h' ? T('studioNsIdH') : T('studioNsIdN'))));
  if (net0.some((t) => to.includes(t.lang) && t.net.m === 'h')) p.append(note(T('studioNsHeNote')));
  k.nsx = k.nsx || {};
  for (const l of shown) {
    const L = net0.filter((t) => t.lang === l);
    const role = to.includes(l) ? 'ref' : k.src == null && hlpEngine() ? 'hlp' : null;
    const sel = L.find((t) => role && k[role] === t.id);
    let vis = k.nsx[l] ? L : L.slice(0, 3);
    if (sel && !vis.includes(sel)) vis = vis.concat(sel);
    const rows = vis.map((t) => nsRow(f, t, role));
    if (vis.length < L.length) rows.push(btn('st-row st-linkrow', T('studioNsMore', { n: fmtNum(L.length - vis.length) }), () => { k.nsx[l] = 1; render('none'); }, 'ns-more:' + l));
    p.append(secT(T('studioNsT', { l: langName(l, uiLang()), n: fmtNum(L.length) })), list(...rows));
  }
  if (langs.length > first.length) p.append(h('div', 'st-gap sm'), list(btn('st-row st-linkrow', ui.nsAll ? T('studioNsFewer') : T('studioNsAll', { n: fmtNum(langs.length) }), () => { ui.nsAll = !ui.nsAll; render('none'); }, 'ns-all')));
  p.append(note(T('studioNsNote')));
}
/* 28/10/2026: מה מוצג בכל בחירה. רצועה מהרשת נשארת גם אחרי שבוטלה (כבר ירדה — k.x), כדי שאפשר לבחור בה שוב.
   עזר להגהה = לא בשפת התרגום; השוואה = בשפת התרגום (או שפה לא ידועה) — עזר והשוואה הם שני תפקידים שונים,
   ושניהם יכולים להיות פעילים יחד: אנגלית לעזר + עברית להשוואה */
export function trkLists(k, to) {
  const text = k.tracks.filter((t) => t.kind === 'text' && (!t.net || t.id === k.src || t.id === k.hlp || t.id === k.ref || k.x[t.id]));
  const tgt = (t) => !t.lang || t.lang === 'und' || to.includes(t.lang);
  return {
    text,
    hlp: text.filter((t) => !to.includes(t.lang) || t.id === k.hlp),
    ref: text.filter((t) => t.id !== k.src && (tgt(t) || t.id === k.ref)),
  };
}
function pageTracks(p) {
  const f = form;
  if (!f || !f.trk) { back(); return; }
  const k = f.trk, to = normTo(f.to);
  // 28/10/2026: מהרשת — לתרגום רק "מדויק" שלא בשפת התרגום; לעזר/להשוואה — מה שנבחר (או ירד) בסעיף "מהרשת"
  const { text, hlp, ref: refs } = trkLists(k, to);
  const srcL = text.filter((t) => !t.net || !to.includes(t.lang) || t.id === k.src)
    .concat(k.tracks.filter((t) => t.net && t.net.m === 'h' && !to.includes(t.lang) && !text.includes(t)).slice(0, 3));
  const hasLoc = k.tracks.some((t) => !t.net);
  p.append(navBar({ back: f.id ? T('studioEditT') : T('studioNew'), title: hasLoc ? T('studioTrkRow') : T('studioNsRow') }));
  p.append(note(k.vname));
  if (k.file && k.file.remote && /\.(mkv|mk3d|webm)$/i.test(k.vname)) p.append(note(T('studioTrkDriveN', { s: fmtSize(k.file.size) })));   // 26/10/2026: ב־MKV החילוץ קורא את כל הקובץ מ־Drive
  if (srcL.length) {
    p.append(secT(T('studioTrkSrcT')), list(
      rowRadio({ on: k.src == null, label: T('studioTrkAudio'), sub: T('studioTrkAudioS'), onClick: () => trkChooseSrc(f, null), k: 'trk-src:a' }),
      ...srcL.map((t) => rowRadio({ on: k.src === t.id, label: trkLabel(t), sub: trkSub(f, t), disabled: !subsOk() || k.busy, onClick: () => trkChooseSrc(f, t.id), k: 'trk-src:' + t.id }))));
    if (!subsOk()) p.append(note(T('studioSubsApiOnly')));
    if (k.src == null && hlpEngine()) p.append(secT(T('studioTrkHlpT')), list(   // 26/10/2026: מהקול — הרצועה כעזר להגהה
      rowRadio({ on: k.hlp == null, label: T('studioTrkHlpNone'), onClick: () => trkChooseHlp(f, null), k: 'trk-hlp:0' }),
      ...hlp.map((t) => rowRadio({ on: k.hlp === t.id, label: trkLabel(t), sub: trkSub(f, t), onClick: () => trkChooseHlp(f, t.id), k: 'trk-hlp:' + t.id }))),
      note(T('studioTrkHlpNote')));
    if (refs.length) p.append(secT(T('studioTrkRefT')), list(
      rowRadio({ on: k.ref == null, label: T('studioTrkRefNone'), onClick: () => trkChooseRef(f, null), k: 'trk-ref:0' }),
      ...refs.map((t) => rowRadio({ on: k.ref === t.id, label: trkLabel(t), sub: trkSub(f, t), onClick: () => trkChooseRef(f, t.id), k: 'trk-ref:' + t.id }))),
      note(T('studioTrkRefNote')));
  }
  nsSection(p, f);
  if (hasLoc) p.append(secT(T('studioTrkAllT')), list(...k.tracks.filter((t) => !t.net).map((t) => {
    const r = h('div', 'st-row st-ric'); r.dataset.k = 'trk:' + t.id;
    r.append(tile('cc', t.kind === 'text' ? 'orange' : 'blue'), rowTxt(trkLabel(t) || T('studioTrkUnd'), trkSub(f, t)));
    if (t.kind === 'text') {
      const b = btn('st-outb', null, () => trkSave(f, t), 'trk-save:' + t.id);
      b.setAttribute('aria-label', T('studioTrkSave') + ' · ' + trkLabel(t));
      b.disabled = k.busy;
      b.append(ico('share'));
      r.append(b);
    }
    return r;
  })));
}
/* ---------------- 22/10/2026: הורדה מקישור (בקשת המשתמש: "כל וידאו שקיים בתוך לינק" — כמו IDM) ----------------
   מדביקים קישור → הטלפון בודק (yt-dlp ב־Studio לאנדרואיד, בלי הורדה) → איכויות, גודל, פרקים → "הוספה" → "התחלה" →
   הטלפון מוריד ל־Movies/Studio → הקובץ חוזר לכאן ועולה כמו כל סרטון מהטלפון (הקול קודם). כל מונח עם הסבר פשוט. */
/* גובה → תווית: 2160 = 4K, 0 = קובץ בלי גובה ידוע ("הכי טוב שיש") */
export function qLabel(h) {
  return h >= 4000 ? '8K' : h >= 2000 ? '4K' : h > 0 ? h + 'p' : T('studioLinkBest');
}
/* האיכות המומלצת מתוך הבדיקה: 1080 (או הכי קרוב מתחתיו), כמו fetchurl.recommended */
export function linkRec(r) {
  const q = (r && r.q) || [];
  if (!q.length) return null;
  const below = q.filter((o) => o.h <= 1080);
  return below.length ? below.reduce((a, b) => (b.h > a.h ? b : a)) : q.reduce((a, b) => (b.h < a.h ? b : a));
}
/* מה שנבחר → pick של ה־spec (= normPick בשרתון) */
export function linkPick(L) {
  const o = L && L.r && (L.r.q || []).find((x) => x.v === L.v);
  if (!o) return null;
  const pick = { v: o.v, a: o.a || '', h: o.h };
  if (L.sec && L.sec[1] > L.sec[0]) pick.sec = [Math.floor(L.sec[0]), Math.ceil(L.sec[1])];
  if (L.ch && L.r.ch && L.r.ch.length) pick.ch = 1;
  return pick;
}
/* הגודל המשוער של הבחירה (חלק מהסרטון — בחלק יחסי) */
export function linkSize(L) {
  const o = L && L.r && (L.r.q || []).find((x) => x.v === L.v);
  if (!o) return 0;
  const d = L.r.d || 0;
  return L.sec && d > 0 ? Math.round(o.sz * Math.min(1, (L.sec[1] - L.sec[0]) / d)) : o.sz;
}
/* "1:02:03" / "2:30" / "45" → שניות; לא תקין → NaN */
export function parseClock(s) {
  const m = /^\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*$|^\s*(\d{1,5})\s*$/.exec(String(s || ''));
  if (!m) return NaN;
  if (m[4] != null) return +m[4];
  return (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]);
}
const linkCodec = (c) => ({ av1: 'AV1', vp9: 'VP9', h264: 'H.264', h265: 'H.265', vp8: 'VP8' }[c] || '');
const linkAudio = (c) => ({ opus: 'Opus', aac: 'AAC', mp3: 'MP3', flac: 'FLAC', vorbis: 'Vorbis', ac3: 'AC-3', eac3: 'E-AC-3' }[c] || '');
/* שגיאת בדיקה → טקסט פשוט + מה עושים */
function linkErrText(e) {
  switch (e) {
    case 'blocked': return T('studioLinkEBlocked');
    case 'login': return T('studioLinkELogin');
    case 'gone': return T('studioLinkEGone');
    case 'geo': return T('studioLinkEGeo');
    case 'drm': return T('studioLinkEDrm');
    case 'live': return T('studioLinkELive');
    case 'playlist': return T('studioLinkEPlaylist');
    case 'unsupported': case 'no_video': return T('studioLinkENone');
    case 'tiny': return T('studioLinkETiny');
    case 'slow': return T('studioLinkESlow');   // 23/10/2026: הבדיקה בטלפון עברה את תקרת הזמן
    case 'not_video': return T('studioLinkENotVideo');
    case 'private': case 'bad_url': case 'dns': return T('studioLinkEBad');
    case 'no_take': return T('studioLinkENoTake');   // 24/10/2026: הבדיקה בשרת לא נלקחה — העובד לא שאל
    case 'timeout': case 'net': case 'no_server': return T('studioLinkENet');
    case 'app': return T('studioLinkEApp');
    case 'yt': return T('studioLinkEYt');
    case 'noapp': return T('studioLinkENoApp');
    case 'store': return T('studioLinkEStore');
    default: return T('studioLinkEFail');
  }
}
/* קודי url_* של עבודה שנכשלה (העובד) → אותם טקסטים */
function urlErrText(code) { return linkErrText(String(code || '').replace(/^url_/, '')); }
let linkSeq = 0;
/* 22/10/2026 (בקשת המשתמש: "כל ההורדות של מנהל ההורדות תמיד מקומית למכשיר, לא לשרת"): הבדיקה וההורדה רצות בטלפון —
   Studio לאנדרואיד (DlActivity: yt-dlp בתוך האפליקציה). יוטיוב חוסם את השרת (כתובת של חוות שרתים), לא את הטלפון.
   האתר מבקש בכתובת intent://probe|dl?…, והתשובה חוזרת ב־hash (‎#probe=, ‎#dle=) או כקובץ (‎/share-file → ‎#got=). */
export function devDl() { return grabOk(); }
/* "לענן של Studio" (בחירת המשתמש 22/10/2026): רק כשהשרתון מתיר (ui.url — מנהל/"כל המודלים" + הדגל) ובמקור שלא חוסם
   את השרת. יוטיוב חוסם כתובות של חוות שרתים ("not a bot") — שם רק לטלפון */
export const cloudBlocked = (r) => /^youtube/i.test(String((r && r.s) || '')) && !ui.yc;   // 25/10/2026: עם החשבון הייעודי בשרת — גם יוטיוב
function cloudOk(L) { return !!(ui.url && L && L.r && !cloudBlocked(L.r)); }
const DL_PKG = 'app.thesnowball.studio', DLP_KEY = 'pwa_studio_dlp', PROBE_WAIT_MS = 240e3;
const LINK_POLL_MS = 1500, LINK_WAIT_MS = 300e3;   // הבדיקה בשרת (בדפדפן בלי האפליקציה). 24/10/2026: 150 שנ׳ היה צמוד מדי (סריקת התור + הבדיקה עצמה)
const dlNonce = () => Array.from({ length: 12 }, () => 'abcdefghijkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 32)]).join('');
const DL_APK = 'https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/the-snowball-studio.apk';
/* 23/10/2026: Studio ישנה (בלי DlActivity) → Chrome לא עושה כלום בשקט. עם browser_fallback_url הוא חוזר אלינו עם
   השגיאה ‎noapp‎ (‎#probe=<n>.!noapp / ‎#dle=<n>.noapp), והדף אומר לעדכן את האפליקציה */
function dlIntent(kind, q) {
  q = Object.assign({}, q, { l: uiLang() });   // 23/10/2026: החלון וההתראות בשפה של Studio (DlLang)
  const qs = Object.keys(q).filter((k) => q[k] !== '' && q[k] != null).map((k) => k + '=' + encodeURIComponent(q[k])).join('&');
  let fb = '';
  try { fb = location.origin + location.pathname + (kind === 'probe' ? '#probe=' + q.n + '.!noapp' : '#dle=' + q.n + '.noapp'); } catch (e) {}
  return 'intent://' + kind + '?' + qs + '#Intent;scheme=snbstudio;package=' + DL_PKG + (fb ? ';S.browser_fallback_url=' + encodeURIComponent(fb) : '') + ';end';
}
/* Chrome פותח אפליקציה רק מתוך נגיעה (user activation). קישור שהגיע בשיתוף (הבועה, "שיתוף ← Studio") טוען את הדף בלי
   נגיעה — שם ה־intent נחסם בשקט והדף חיכה לשווא (23/10/2026). בלי נגיעה פעילה — כפתור "בדיקת הקישור" */
function hasTap() {
  try { return !navigator.userActivation || navigator.userActivation.isActive; } catch (e) { return true; }
}
const PROBE_SLOW_MS = 15e3;
function apkBtn() {   // הגרסה החדשה של Studio לאנדרואיד (מותקנת מעל הקיימת)
  const a = h('a', 'st-btn wide', T('studioLinkApk')); a.href = DL_APK; a.rel = 'noopener'; a.dataset.k = 'link-apk';
  const w = h('div'); w.append(h('div', 'st-gap sm'), a);
  return w;
}
function probeGo(f, L) {
  const seq = ++linkSeq;
  L.st = 'busy'; L.slow = false; L.at = Date.now();
  render('none');
  location.href = dlIntent('probe', { u: L.u, ref: L.ref, n: L.n });
  const live = () => seq === linkSeq && f.link === L && L.st === 'busy';
  setTimeout(() => { if (live()) { L.slow = true; render('none'); } }, PROBE_SLOW_MS);
  setTimeout(() => { if (live()) { L.st = 'err'; L.e = 'timeout'; render('none'); } }, PROBE_WAIT_MS);
}
/* base64url (UTF-8) → מחרוזת */
export function b64uText(b) {
  const t = String(b || '').replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(t + '==='.slice((t.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
/* תוצאת הבדיקה מהטלפון — רק מה שבצורה הצפויה (טקסט מאתר חיצוני מוצג רק כטקסט; תמונה רק data:image/jpeg) */
export function normDevProbe(r) {
  if (!r || typeof r !== 'object' || typeof r.t !== 'string' || !Array.isArray(r.q)) return null;
  const s = (v, n) => String(v == null ? '' : v).slice(0, n);
  const n = (v, a, b) => { const x = Math.round(Number(v) || 0); return Math.max(a, Math.min(b, x)); };
  const fid = (v) => (/^[\w.+-]{1,60}$/.test(String(v || '')) ? String(v) : '');
  const q = r.q.slice(0, 20).map((o) => ({ h: n(o && o.h, 0, 8640), v: fid(o && o.v), a: fid(o && o.a), c: s(o && o.c, 10), ac: s(o && o.ac, 10),
    fps: n(o && o.fps, 0, 480), hdr: o && o.hdr ? 1 : 0, sz: n(o && o.sz, 0, 1e13) })).filter((o) => o.v);
  if (!q.length) return null;
  const ch = Array.isArray(r.ch) ? r.ch.slice(0, 30).filter((c) => Array.isArray(c) && typeof c[1] === 'string').map((c) => [n(c[0], 0, 1e6), s(c[1], 80)]) : [];
  const sub = Array.isArray(r.sub) ? r.sub.slice(0, 40).filter((x) => x && typeof x.l === 'string').map((x) => ({ l: s(x.l, 20), n: s(x.n, 60), a: x.a ? 1 : 0 })) : [];
  const ao = r.ao && fid(r.ao.id) ? { id: fid(r.ao.id), ac: s(r.ao.ac, 10), br: n(r.ao.br, 0, 10000), sz: n(r.ao.sz, 0, 1e13) } : null;
  const u = /^https?:\/\//i.test(String(r.u || '')) ? s(r.u, 2048) : '';
  const rf = /^https?:\/\//i.test(String(r.rf || '')) ? s(r.rf, 2048) : '';   // בדיקה לעומק: הזרם שנמצא בדף → הדף (Referer)
  const alt = Array.isArray(r.alt) ? r.alt.slice(0, 8).filter((a) => a && /^https?:\/\//i.test(String(a.u || '')) && String(a.u).length <= 2048)
    .map((a) => ({ u: String(a.u), h: n(a.h, 0, 8640), d: n(a.d, 0, 1e6), sz: n(a.sz, 0, 1e13) })) : [];
  const th = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(String(r.th || '')) && String(r.th).length <= 72000 ? String(r.th) : '';
  return { t: s(r.t, 200) || 'video', u, s: s(r.s, 40), up: s(r.up, 100), d: n(r.d, 0, 1e6), ud: /^\d{8}$/.test(r.ud || '') ? r.ud : '',
    lang: s(r.lang, 10), ch, sub, q, rec: n(r.rec, 0, 8640), ao, drm: r.drm ? 1 : 0, th, rf, alt };
}
function linkCheck(f, raw, ref, pre, want) {
  // ref — שלב 2: קובץ/זרם שנמצא בדף (דפדפן הציד) → הדף, והטלפון מוריד עם ה־Referer שלו
  const L = f.link = { u: String(raw || '').trim(), ref: /^https?:\/\//i.test(String(ref || '')) ? String(ref).slice(0, 2048) : '', st: 'busy', e: '', r: null, v: '', sec: null, ch: 1, at: Date.now() };
  const seq = ++linkSeq;
  // 24/10/2026: "ישר לענן של Studio" מ־Studio DM — הענן נבחר מראש (רק כשמותר: ui.url, ומקור שלא חוסם — cloudOk בציור)
  // 31/10/2026 (בקשת המשתמש): הענן הוא ברירת המחדל כשמותר (ui.url); מקור שחוסם את השרת יורד לטלפון (cloudOk בציור)
  L.to = ui.url || !devDl() ? 'cloud' : 'dev';   // want === 'cloud' ("ישר לענן" מ־Studio DM) — מתקיים ממילא
  if (!devDl()) {   // בלי האפליקציה: רק לענן (כשמותר — ui.url), אחרת הסבר
    // 25/10/2026: יוטיוב חוסם את השרת ("not a bot") — אומרים מיד, במקום בדיקה שתיכשל או עבודה שתיפול באמצע
    if (ui.url && !ui.yc && ytHost(L.u)) { L.st = 'err'; L.e = 'yt'; }
    else if (ui.url) linkCheckSrv(f, L, seq); else { L.st = 'err'; L.e = 'app'; }
    render('none'); return;
  }
  if (pre) { L.n = pre; render('none'); return; }   // הבדיקה כבר רצה בטלפון (דפדפן הציד) — התוצאה מגיעה מיד
  L.n = dlNonce();
  if (!hasTap()) { L.st = 'tap'; render('none'); return; }
  probeGo(f, L);
}
function linkCheckSrv(f, L, seq) {   // הבדיקה בשרת — רק בדפדפן בלי האפליקציה (ההורדה אז רק לענן)
  (async () => {
    let j = await net.api('urlProbe', L.ref ? { url: L.u, ref: L.ref } : { url: L.u });
    while (j && j.ok && j.probe && (j.probe.st === 'q' || j.probe.st === 'r') && Date.now() - L.at < LINK_WAIT_MS) {
      await sleep(LINK_POLL_MS);
      if (seq !== linkSeq || form !== f || f.link !== L || L.blind) return;
      j = await net.api('urlProbe', { pid: j.probe.id });
    }
    if (seq !== linkSeq || f.link !== L || L.blind) return;
    if (!j || !j.ok) { L.st = 'err'; L.e = j && j.error === 'bad_url' ? 'bad_url' : j && j.error === 'flag_off' ? 'flag' : j && j.error ? 'srv:' + j.error : 'net'; }
    else if (j.probe.st === 'd' && j.probe.r) { L.st = 'ok'; fnlAdd('link'); L.r = j.probe.r; const rec = linkRec(L.r); L.v = rec ? rec.v : ''; }
    else { L.st = 'err'; L.e = j.probe.st === 'e' ? j.probe.e : j.probe.st === 'q' ? 'no_take' : 'timeout'; }   // 24/10/2026: q = אף שרת לא לקח את הבדיקה
    render('none');
  })();
}
/* התשובה מ־DlActivity: ‎#probe=<n>.<base64url> או ‎#probe=<n>.!<קוד> (studio-app.js → hashchange) */
export function studioProbeRes(arg) {
  const m = /^([A-Za-z0-9]{6,24})\.(!?)([A-Za-z0-9_-]*)$/.exec(String(arg || ''));
  const f = form, L = f && f.link;
  if (!m || !L || L.n !== m[1] || L.st !== 'busy') return false;
  if (m[2]) {
    if (m[3] === 'cancel') { f.link = null; linkSeq++; }
    else { L.st = 'err'; L.e = m[3].slice(0, 20) || 'fail'; }
  } else {
    let r = null;
    try { r = normDevProbe(JSON.parse(b64uText(m[3]))); } catch (e) {}
    if (!r) { L.st = 'err'; L.e = 'fail'; }
    else { L.st = 'ok'; fnlAdd('link'); L.r = r; if (r.rf && !L.ref) L.ref = r.rf; const rec = linkRec(r); L.v = rec ? rec.v : ''; }
  }
  render('none');
  return true;
}
/* הכרטיס של הסרטון (בדף הקישור ובטופס) */
function linkCard(L, small) {
  const r = L.r, c = h('div', 'st-lk-card' + (small ? ' sm' : ''));
  const th = h('span', 'st-thumb' + (r.th ? ' img' : ''));
  if (r.th) th.style.backgroundImage = 'url("' + r.th + '")';
  th.append(ico('film'));
  if (r.d) th.append(h('b', 'st-lk-dur', fmtDur(r.d)));
  const t = h('span', 'st-l'), nm = h('b'); nm.setAttribute('dir', 'auto'); nm.textContent = r.t;
  const sub = h('small');
  sub.append(h('bdi', null, r.s || ''), r.up ? ' · ' : '', r.up ? h('bdi', null, r.up) : '');
  t.append(nm, sub);
  c.append(th, t);
  if (!small) {
    const tags = h('div', 'st-lk-tags'), top = (r.q || []).reduce((a, b) => Math.max(a, b.h), 0);
    if (r.ch && r.ch.length) tags.append(h('span', 'st-lk-tag', T('studioLinkTagCh', { n: fmtNum(r.ch.length) })));
    if (r.sub && r.sub.some((s) => !s.a)) tags.append(h('span', 'st-lk-tag', T('studioLinkTagSubs')));
    if (top) tags.append(h('span', 'st-lk-tag', T('studioLinkTagTop', { q: qLabel(top) })));
    if (tags.childNodes.length) t.append(tags);
  }
  return c;
}
/* 26/10/2026 (בקשת המשתמש): סרטון מ־Google Drive בעיצוב של Studio, במקום Google Picker. אחרונים · תיקיות · מסומנים, חיפוש
   בשם. הבחירה = מזהה הקובץ: הסרטון נשאר ב־Drive, בלי העלאה מהטלפון, והשרת מוריד אותו בעצמו (רק במצב השרת — bxOk בשרתון) */
const dp = { st: '', tab: 'r', q: '', path: [], items: [], next: '', busy: false, seq: 0, email: '', err: '' };
const dpPaint = () => { if (root && ui.view === 'dpick') render('none'); };
const dpKey = () => dp.tab + '|' + (dp.path.length ? dp.path[dp.path.length - 1].id : '') + '|' + dp.q.trim();
async function dpLoad(more) {
  const seq = ++dp.seq, key = dpKey();
  dp.busy = true; if (!more) { dp.items = []; dp.next = ''; } dp.err = ''; dpPaint();
  try {
    const top = dp.path[dp.path.length - 1];
    const r = await net.browseList(() => gb().token(), { tab: dp.tab, q: dp.q, parent: top ? top.id : 'root', page: more ? dp.next : '' });
    if (seq !== dp.seq || key !== dpKey()) return;
    dp.items = (more ? dp.items : []).concat(r.files); dp.next = r.next; dp.st = 'ok';
  } catch (e) {
    if (seq !== dp.seq) return;
    const c = e && e.code;
    if (c === 'not_connected' || c === 'revoked' || c === 'drive_http_401' || c === 'drive_http_403') dp.st = 'conn';
    else { dp.st = dp.st === 'ok' ? 'ok' : 'err'; dp.err = c || 'drive'; }
  } finally { if (seq === dp.seq) { dp.busy = false; dpPaint(); } }
}
function dpConnect() {
  if (dp.busy) return;
  let pr;
  try { pr = gb().connect(store.drive && store.drive.email || ''); } catch (e) { pr = Promise.reject(e); }   // החלון נפתח כאן, בתוך הלחיצה
  dp.busy = true; dpPaint();
  pr.then((em) => { dp.email = em || ''; dp.busy = false; dp.st = 'ok'; dpLoad(); })
    .catch((e) => {
      const c = e && e.code;
      dp.busy = false; dpPaint();
      flashSafe(c === 'gd_popup' ? T('studioDrivePopup') : c === 'gd_denied' || c === 'gd_cancel' ? T('studioDriveCancel') : c === 'gd_not_configured' ? T('studioDriveNoCfg') : c === 'gd_no_scope' ? T('studioDpNoScope') : T('studioDriveErr'));
    });
}
function dpPick(f, x) {
  if (!x || x.folder || !(x.size > 0)) return;
  f.drive = { id: x.id, name: x.name, size: x.size, type: x.type, dur: x.dur, bx: true };
  f.fileObj = null; f.handle = null; f.edl = null; f.sa = null; f.trk = null; f.link = null; f.linkOk = false;
  f.file = { name: x.name, size: x.size, type: x.type };
  if (x.w > 0 && x.h > 0) f.vm = { w: x.w, h: x.h };
  // רצועות הכתוביות שבתוך הסרטון — כמו מקובץ בטלפון, בקריאה חלקית מ־Drive (רק תחילת הקובץ / ה־moov)
  try { f._rb = net.rangeBlob((force) => gb().token(force), x.id, x.size, x.name); tracksFor(f, f._rb); } catch (e) { f._rb = null; }
  back();
}
function dpRow(f, x) {
  const r = btn('st-row st-ric st-dp-row', null, () => {
    if (x.folder) { dp.path.push({ id: x.id, n: x.name }); dp.q = ''; dpLoad(); return; }
    dpPick(f, x);
  }, 'dp:' + x.id);
  if (x.folder) r.append(tile('folder', 'gray'));
  else {
    const th = h('span', 'st-thumb st-dp-th'); th.append(ico('film'));
    if (x.th) {
      const im = h('img'); im.alt = ''; im.decoding = 'async'; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
      im.addEventListener('load', () => th.classList.add('ok'));
      im.addEventListener('error', () => im.remove());
      im.src = x.th; th.append(im);
    }
    if (x.dur) th.append(h('span', 'st-dp-dur', fmtDur(x.dur)));
    r.append(th);
  }
  const l = h('span', 'st-l'), nm = h('b'), bd = h('bdi', null, x.folder ? x.name : fileTitle(x.name)); bd.dir = 'auto'; nm.append(bd);   // בלי סיומת (כמו ברשימת העבודות) — ב־RTL "mp4." קפץ לצד השני
  l.append(nm);
  if (!x.folder) l.append(h('small', null, [x.size ? fmtSize(x.size) : '', x.at ? fmtDay(x.at) : ''].filter(Boolean).join(' · ')));
  r.append(l);
  if (x.folder) r.append(ico('chev', 'st-chev'));
  return r;
}
const fmtDay = (ms) => { try { return new Intl.DateTimeFormat(uiLang(), { day: 'numeric', month: 'short', year: new Date(ms).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }).format(ms); } catch (e) { return ''; } };
function pageDrivePick(p) {
  const f = form;
  if (!f) { back(); return; }
  p.append(navBar({ back: f.id ? T('studioEditT') : T('studioNew'), title: T('studioDpT') }));
  if (!ui.gb) { p.append(h('div', 'st-empty st-empty-sm', T('studioDriveNoCfg'))); return; }
  if (dp.st === '') { dp.st = 'load'; setTimeout(() => dpLoad(), 0); }   // לא בתוך הציור
  if (dp.st === 'conn') {
    const c = h('div', 'st-dp-conn');
    const ic = h('span', 'st-dp-ic'); ic.append(ico('cloud'));
    c.append(ic, h('b', null, T('studioDpConnT')), h('p', null, T('studioDpConnS')));
    const b = btn('st-btn wide', dp.busy ? T('studioDriveBusy') : T('studioDriveConnect'), dpConnect, 'dp-conn');
    b.disabled = dp.busy;
    p.append(c, b, note(T('studioDpConnN')));
    return;
  }
  // חיפוש בשם (בכל ה־Drive) — בלי לבנות את הדף מחדש בכל הקשה
  const sq = h('input', 'st-in st-dp-q'); sq.type = 'search'; sq.placeholder = T('studioDpSearch'); sq.value = dp.q; sq.dataset.k = 'dp-q';
  sq.setAttribute('aria-label', T('studioDpSearch')); sq.autocomplete = 'off'; sq.spellcheck = false;
  let tmr = 0;
  sq.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { if (dp.q !== sq.value) { dp.q = sq.value; dpLoad(); } }, 350); });
  p.append(sq);
  if (!dp.q.trim()) {
    const seg = h('div', 'st-seg'); seg.setAttribute('role', 'tablist');
    for (const [k, lbl] of [['r', T('studioDpTabR')], ['f', T('studioDpTabF')], ['s', T('studioDpTabS')]]) {
      const b = btn('st-seg-b' + (dp.tab === k ? ' on' : ''), lbl, () => { if (dp.tab === k) return; dp.tab = k; dp.path = []; dpLoad(); }, 'dptab:' + k);
      b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', dp.tab === k ? 'true' : 'false');
      seg.append(b);
    }
    p.append(seg);
  }
  if (dp.path.length && !dp.q.trim()) {
    const up = btn('st-dp-up', null, () => { dp.path.pop(); dpLoad(); }, 'dp-up');
    up.append(ico('back'), h('bdi', null, dp.path.length > 1 ? dp.path[dp.path.length - 2].n : dp.tab === 's' ? T('studioPkStar') : T('studioPkMine')));
    p.append(up, secT(dp.path[dp.path.length - 1].n));
  }
  if (dp.st === 'err' && !dp.items.length) {
    p.append(h('div', 'st-empty st-empty-sm', errText(dp.err)), btn('st-btn tint wide', T('studioGlRetry'), () => dpLoad(), 'dp-retry'));
    return;
  }
  if (!dp.items.length) {
    if (dp.busy) { const ld = h('div', 'st-lk-ld'); ld.append(h('span', 'st-spin'), h('span', null, T('studioDpLoading'))); p.append(ld); }
    else p.append(h('div', 'st-empty st-empty-sm', dp.q.trim() ? T('studioDpNone') : T('studioDpEmpty')));
    return;
  }
  p.append(list(...dp.items.map((x) => dpRow(f, x))));
  if (dp.next) {
    const more = btn('st-btn tint wide', dp.busy ? T('studioDpLoading') : T('studioDpMore'), () => dpLoad(true), 'dp-more');
    more.disabled = dp.busy;
    p.append(h('div', 'st-gap sm'), more);
  }
  p.append(note(T('studioDpNote')));
}
function pageLink(p) {
  const f = form;
  if (!f) { back(); return; }
  const L = f.link || null;
  const add = btn('st-txt bold', T('studioLinkAdd'), () => { if (L && L.st === 'ok') { f.linkOk = true; back(); } }, 'link-add');
  add.disabled = !(L && L.st === 'ok' && L.v);
  p.append(navBar({ back: f.id ? T('studioEditT') : T('studioNew'), title: T('studioLinkT'), end: add }));
  // שדה הקישור + "הדבקה"
  const box = h('div', 'st-lk-in');
  const inp = h('input', 'st-in'); inp.type = 'url'; inp.inputMode = 'url'; inp.dir = 'ltr'; inp.autocomplete = 'off'; inp.spellcheck = false;
  inp.placeholder = T('studioLinkPh'); inp.value = L ? (L.r && L.r.u) || L.u : ''; inp.dataset.k = 'link-in'; inp.setAttribute('aria-label', T('studioLinkT'));
  let tmr = 0;
  const kick = () => { clearTimeout(tmr); const v = inp.value.trim(); if (/https?:\/\/\S+\.\S+/i.test(v) && (!f.link || f.link.u !== v)) tmr = setTimeout(() => linkCheck(f, v), 500); };
  inp.addEventListener('input', kick);
  inp.addEventListener('paste', () => setTimeout(kick, 0));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { clearTimeout(tmr); if (inp.value.trim()) linkCheck(f, inp.value.trim()); } });
  const paste = btn('st-lk-paste', null, async () => {
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch (e) { inp.focus(); flashSafe(T('studioLinkPasteNo')); return; }
    if (!t || !/https?:\/\//i.test(t)) { flashSafe(T('studioLinkPasteNone')); return; }
    inp.value = t.trim(); linkCheck(f, inp.value);
  }, 'link-paste');
  paste.append(ico('copy'), h('span', null, T('studioLinkPaste')));
  if (L && L.u) {
    const x = btn('st-lk-x', '×', () => { f.link = null; f.linkOk = false; linkSeq++; render('none'); }, 'link-clear');
    x.setAttribute('aria-label', T('studioLinkClear'));
    box.append(inp, x);
  } else box.append(inp, paste);
  p.append(h('div', 'st-gap sm'), box);
  if (!L) {
    p.append(note(T('studioLinkSites')));
    p.append(secT(T('studioLinkHowT')), list(
      rowTxtRow('share', 'blue', T('studioLinkHow1'), T('studioLinkHow1S')),
      rowTxtRow('clip', 'teal', T('studioLinkHow2'), T('studioLinkHow2S')),
      grabOk() ? rowNav({ tile: tile('globe', 'red'), label: T('studioHuntT'), sub: T('studioHuntS'), onClick: () => huntOpen(inp.value.trim()), k: 'hunt' }) : null,
      grabOk() ? rowNav({ tile: tile('spark', 'red'), label: T('studioGrabT'), sub: T('studioGrabS'), onClick: () => go('grab'), k: 'grab' }) : null,
      rowNav({ tile: tile('help', 'gray'), label: T('studioFmtHelpT'), sub: T('studioFmtHelpS'), onClick: () => go('fmthelp'), k: 'fmthelp' })));
    return;
  }
  if (L.st === 'tap') {   // הגיע בשיתוף — Chrome פותח את Studio רק מנגיעה
    p.append(note(T('studioLinkTapS')), h('div', 'st-gap sm'), btn('st-btn wide', T('studioLinkTapB'), () => probeGo(f, L), 'link-tap'));
    return;
  }
  if (L.st === 'busy') {
    const ld = h('div', 'st-lk-ld'); ld.dataset.k = 'link-busy';
    ld.append(h('span', 'st-spin'), h('span', null, T('studioLinkChecking')));
    p.append(ld, note(L.slow ? T('studioLinkSlow') : T('studioLinkCheckingS')));
    if (L.slow) p.append(h('div', 'st-gap sm'), btn('st-btn tint wide', T('studioLinkRetry'), () => probeGo(f, L), 'link-again'), apkBtn());
    if (L.slow && blindOk(L, true)) p.append(h('div', 'st-gap sm'), btn('st-btn wide', T('studioLinkBlind'), () => linkBlind(f), 'link-blind'), note(T('studioLinkBlindS')));
    return;
  }
  if (L.st === 'err') {
    const msg = L.e === 'flag' ? T('studioErrFlagOff') : /^srv:/.test(L.e) ? errText(L.e.slice(4)) : linkErrText(L.e);
    const card = h('div', 'st-lk-err'); card.dataset.k = 'link-err';
    card.append(ico('alert'), h('span', null, msg));
    p.append(card, h('div', 'st-gap sm'), btn('st-btn tint wide', T('studioLinkRetry'), () => linkCheck(f, L.u, L.ref), 'link-retry'));
    if (L.e === 'noapp') p.append(apkBtn());
    // 24/10/2026 (כמו ב־Studio DM — ההורדה עצמה היא הבדיקה): הבדיקה בשרת לא חזרה → להוריד בענן בלי לחכות לה
    if (blindOk(L)) p.append(h('div', 'st-gap sm'), btn('st-btn wide', T('studioLinkBlind'), () => linkBlind(f), 'link-blind'), note(T('studioLinkBlindS')));
    if (L.e === 'blocked' || L.e === 'login' || L.e === 'unsupported' || L.e === 'no_video') p.append(note(T('studioLinkUpload')));
    // הניסוי: דף שהשרת לא מצא בו סרטון (נשלח מהבועה) — דפדפן הציד רואה את מה שהנגן מבקש בפועל
    // קובץ זעיר מדפדפן הציד → חוזרים לדף (L.ref) ומנגנים את הסרטון עצמו
    if (grabOk() && ((!L.ref && (L.e === 'unsupported' || L.e === 'no_video' || L.e === 'fail' || L.e === 'slow')) || ((L.e === 'tiny' || L.e === 'slow') && L.ref))) p.append(h('div', 'st-gap sm'), btn('st-btn wide', T('studioHuntTry'), () => huntOpen(L.ref || L.u), 'link-hunt'));
    return;
  }
  // יש תוצאה
  const r = L.r, rec = linkRec(r), cur = (r.q || []).find((o) => o.v === L.v) || rec;
  p.append(linkCard(L));
  if (L.ref) { let hst = ''; try { hst = new URL(L.ref).hostname.replace(/^www\./, ''); } catch (e) {} if (hst) p.append(note(T('studioLinkFromPage', { h: hst }))); }
  p.append(secT(T('studioLinkQT')));
  const recB = btn('st-lk-rec' + (cur && rec && cur.v === rec.v ? ' on' : ''), null, () => { L.v = rec.v; render('none'); }, 'link-rec');
  const star = h('span', 'st-lk-star'); star.append(ico('spark'));
  recB.append(star, rowTxt(T('studioLinkRec', { q: qLabel(rec.h) }), T('studioLinkRecS') + ' · ' + (rec.sz ? approx(fmtSize(rec.sz)) : T('studioLinkSzUnknown'))));
  if (cur && cur.v === rec.v) recB.append(ico('check', 'st-chk'));
  p.append(recB);
  if ((r.q || []).length > 1) {
    const grid = h('div', 'st-lk-qs'); grid.setAttribute('role', 'radiogroup'); grid.setAttribute('aria-label', T('studioLinkQT'));
    for (const o of r.q) {
      const b = btn('st-lk-q' + (o.v === L.v ? ' on' : ''), null, () => { L.v = o.v; render('none'); }, 'link-q:' + o.v);
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', o.v === L.v ? 'true' : 'false');
      b.append(h('b', null, qLabel(o.h)), h('small', null, o.sz ? approx(fmtSize(o.sz)) : ' '));
      grid.append(b);
    }
    p.append(grid);
  }
  if (cur) p.append(note(T('studioLinkPickS', { v: linkCodec(cur.c) || T('studioLinkVideo'), a: linkAudio(cur.ac) || T('studioLinkAudioW') })));
  // 23/10/2026 (בקשת המשתמש: "כמה שיותר אופציות של איכויות ומקורות"): שאר הקבצים האמיתיים שהבדיקה לעומק מצאה בדף
  if (r.alt && r.alt.length) {
    const ref = L.ref || L.u;
    p.append(secT(T('studioLinkAltT')), list(...r.alt.map((a, i) => {
      let hst = ''; try { hst = new URL(a.u).hostname.replace(/^www\./, ''); } catch (e) {}
      const sub = [a.d ? fmtDur(a.d) : '', a.sz ? approx(fmtSize(a.sz)) : '', hst].filter(Boolean).join(' · ');
      return rowNav({ tile: tile('film', 'gray'), label: a.h ? T('studioLinkAltUpTo', { q: qLabel(a.h) }) : T('studioLinkAltQ'), sub, onClick: () => linkCheck(f, a.u, ref), k: 'link-alt:' + i });
    })));
  }
  // לאן להוריד: ישר לענן של Studio (ברירת המחדל, 31/10/2026) או לטלפון — כשהמקור לא חוסם את השרת
  if (devDl()) {
    const cOk = cloudOk(L);
    if (L.to === 'cloud' && !cOk) L.to = 'dev';
    const cr = rowRadio({ on: L.to === 'cloud', label: T('studioLinkToCloud'),
      sub: cOk ? T('studioLinkToCloudS') : !ui.url ? T('studioLinkToCloudOff') : T('studioLinkToCloudNo'),
      onClick: () => { if (cOk) { L.to = 'cloud'; render('none'); } }, k: 'link-to:cloud' });
    if (!cOk) cr.classList.add('off');
    p.append(secT(T('studioLinkToT')), list(
      rowRadio({ on: L.to !== 'cloud', label: T('studioLinkToDev'), sub: T('studioLinkToDevS'), onClick: () => { L.to = 'dev'; render('none'); }, k: 'link-to:dev' }), cr));
  }
  // עוד
  const sec = L.sec ? fmtDur(L.sec[0]) + '–' + fmtDur(L.sec[1]) : T('studioLinkSecAll');
  p.append(secT(T('studioLinkMoreT')), list(
    rowNav({ tile: tile('clock', 'blue'), label: T('studioLinkSec'), value: sec, onClick: () => go('linksec'), k: 'link-sec' }),
    r.ch && r.ch.length ? rowSwitch({ label: T('studioLinkCh'), sub: T('studioLinkChS', { n: fmtNum(r.ch.length) }), on: !!L.ch, onClick: () => { L.ch = L.ch ? 0 : 1; render('none'); }, k: 'link-ch' }) : null,
    rowNav({ tile: tile('sliders', 'gray'), label: T('studioLinkAll'), sub: T('studioLinkAllS'), onClick: () => go('linkfmt'), k: 'link-all' }),
    rowNav({ tile: tile('help', 'gray'), label: T('studioFmtHelpT'), sub: T('studioFmtHelpS'), onClick: () => go('fmthelp'), k: 'fmthelp' })));
  p.append(note(L.to !== 'cloud' ? T('studioLinkSrvNote') : devDl() ? T('studioLinkCloudNote') : T('studioLinkCloudNoteWeb')));   // 25/10: בלי האפליקציה אין "להוריד לטלפון"
  const go2 = btn('st-btn wide', T('studioLinkAdd'), () => { f.linkOk = true; back(); }, 'link-add2');
  go2.disabled = !L.v;
  p.append(h('div', 'st-gap'), go2);
  // 23/10/2026 (בקשת המשתמש): "רק להוריד" — הקובץ נשאר ב־Movies/Studio, בלי טופס התרגום
  if (devDl()) {
    const dl = btn('st-btn ghost wide', T('studioLinkOnly'), () => dlOnly(L), 'link-only');
    dl.disabled = !L.v;
    p.append(h('div', 'st-gap sm'), dl);
  }
}
/* שלב 1.5 (22/10/2026): בועת ההורדה בדפדפן — רק באפליקציית Studio לאנדרואיד. הבועה = APK נפרד, Studio Bubble
   (Play Protect חסם את Studio כולו כשהשירות היה בתוכה). האתר לא יודע אם היא מותקנת/פועלת — העמוד מסביר, מוריד ופותח את
   ההגדרות (GrabSetupActivity: s=app — פרטי האפליקציה, אחרת — נגישות; לא מותקנת → ה־APK דרך browser_fallback_url) */
function grabOk() {
  try { return typeof inApk === 'function' && inApk() && /Android/i.test(navigator.userAgent); } catch (e) { return false; }
}
const GRAB_PKG = 'app.thesnowball.bubble', HUNT_PKG = 'app.thesnowball.studio';
const BUBBLE_APK = 'https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/the-snowball-bubble.apk';
function grabOpen(s) {
  location.href = 'intent://grab?s=' + s + '#Intent;scheme=snbstudio;package=' + GRAB_PKG + ';S.browser_fallback_url=' + encodeURIComponent(BUBBLE_APK) + ';end';
}
/* שלב 2: דפדפן הציד (HuntActivity ב־APK) — עם הכתובת שבשדה, אם יש */
function huntOpen(u) {
  const q = (/^https?:\/\/\S+$/i.test(u || '') ? '?u=' + encodeURIComponent(u) + '&' : '?') + 'l=' + uiLang();
  location.href = 'intent://hunt' + q + '#Intent;scheme=snbstudio;package=' + HUNT_PKG + ';end';
}
function pageGrab(p) {
  p.append(navBar({ back: T('studioLinkT'), title: T('studioGrabT') }));
  p.append(note(T('studioGrabIntro')));
  const step = (n, label, sub, act, below) => {
    const r = h('div', 'st-row st-ric st-grab-st');
    const num = h('span', 'st-grab-n', String(n)), txt = rowTxt(label, sub);
    if (act && below) { const col = h('span', 'st-grab-col'); col.append(txt, act); r.append(num, col); }
    else { r.append(num, txt); if (act) r.append(act); }
    return r;
  };
  const dl = h('a', 'st-btn sm tint', T('studioGrabDl')); dl.href = BUBBLE_APK; dl.rel = 'noopener'; dl.dataset.k = 'grab-dl';
  p.append(secT(T('studioGrabHowT')), list(
    step(1, T('studioGrab0'), T('studioGrab0S'), dl),
    step(2, T('studioGrab1'), T('studioGrab1S'), btn('st-btn sm tint', T('studioGrabOpen'), () => grabOpen('a11y'), 'grab-a11y')),
    step(3, T('studioGrab2'), T('studioGrab2S')),
    step(4, T('studioGrab3'), T('studioGrab3S'))));
  p.append(secT(T('studioGrabGreyT')), list(
    step('!', T('studioGrabPp'), T('studioGrabPpS')),
    step('!', T('studioGrabGrey'), T('studioGrabGreyS'), btn('st-btn sm tint', T('studioGrabOpenApp'), () => grabOpen('app'), 'grab-app'), true)));
  p.append(secT(T('studioGrabPrivT')), list(
    rowTxtRow('shield', 'gray', T('studioGrabPriv1'), T('studioGrabPriv1S')),
    rowTxtRow('alert', 'gray', T('studioGrabPriv2'), T('studioGrabPriv2S'))));
}
function rowTxtRow(icon, color, label, sub) {
  const r = h('div', 'st-row st-ric'); r.append(tile(icon, color), rowTxt(label, sub)); return r;
}
/* כל האיכויות — כל אחת בשורה עם הסבר פשוט (קודק, קצב פריימים, HDR, גודל) */
function pageLinkFmt(p) {
  const f = form, L = f && f.link;
  if (!L || !L.r) { back(); return; }
  p.append(navBar({ back: T('studioLinkT'), title: T('studioLinkAll') }));
  const rec = linkRec(L.r);
  p.append(secT(T('studioLinkQT')), list(...(L.r.q || []).map((o) => {
    const bits = [linkCodec(o.c), o.fps > 30 ? o.fps + 'fps' : '', o.hdr ? 'HDR' : '', linkAudio(o.ac)].filter(Boolean).join(' · ');
    return rowRadio({ on: o.v === L.v, label: qLabel(o.h) + (rec && o.v === rec.v ? ' · ' + T('studioLinkRecTag') : ''),
      sub: (bits ? bits + ' · ' : '') + (o.sz ? approx(fmtSize(o.sz)) : T('studioLinkSzUnknown')) + (o.c === 'av1' ? ' — ' + T('studioFmtAv1Short') : o.c === 'h264' ? ' — ' + T('studioFmtH264Short') : ''),
      onClick: () => { L.v = o.v; render('none'); }, k: 'lf:' + o.v });
  })));
  if (L.r.ao) p.append(secT(T('studioLinkAudioT')), list(rowTxtRow('mic', 'teal', linkAudio(L.r.ao.ac) + (L.r.ao.br ? ' · ' + L.r.ao.br + 'kbps' : ''), T('studioLinkAudioS'))));
  p.append(note(T('studioLinkNoReenc')));
}
/* רק חלק מהסרטון — מ/עד (שעות:דקות:שניות) או נגיעה בפרק */
function pageLinkSec(p) {
  const f = form, L = f && f.link;
  if (!L || !L.r) { back(); return; }
  const d = L.r.d || 0;
  p.append(navBar({ back: T('studioLinkT'), title: T('studioLinkSec') }));
  p.append(note(T('studioLinkSecNote')));
  const row = h('div', 'st-lk-sec');
  const mk = (val, lab, k) => { const w = h('label', 'st-lk-tf'); const i = h('input', 'st-in'); i.inputMode = 'numeric'; i.dir = 'ltr'; i.value = val; i.dataset.k = k; i.placeholder = '0:00'; w.append(h('small', null, lab), i); return [w, i]; };
  const [wa, ia] = mk(fmtDur(L.sec ? L.sec[0] : 0), T('studioLinkFrom'), 'sec-a');
  const [wb, ib] = mk(fmtDur(L.sec ? L.sec[1] : d), T('studioLinkTo'), 'sec-b');
  row.append(wa, h('span', 'st-lk-dash', '–'), wb);
  p.append(h('div', 'st-gap sm'), row);
  const apply = () => {
    const a = parseClock(ia.value), b = parseClock(ib.value);
    if (!(a >= 0) || !(b > a) || (d && b > d + 1)) { flashSafe(T('studioLinkSecBad')); return; }
    L.sec = a <= 0 && (!d || b >= d) ? null : [a, Math.min(b, d || b)];
    back();
  };
  p.append(h('div', 'st-gap sm'), btn('st-btn wide', T('studioLinkSecOk'), apply, 'sec-ok'),
    h('div', 'st-gap sm'), btn('st-btn tint wide', T('studioLinkSecAllBtn'), () => { L.sec = null; back(); }, 'sec-all'));
  if (L.r.ch && L.r.ch.length) {
    const chs = L.r.ch;
    p.append(secT(T('studioLinkChT')), list(...chs.map((c, i) => {
      const end = i + 1 < chs.length ? chs[i + 1][0] : d;
      const r = rowNav({ label: c[1], value: fmtDur(c[0]), onClick: () => { L.sec = [c[0], end]; back(); }, k: 'ch:' + i });
      return r;
    })));
  }
}
/* מה זה אומר — הסבר פשוט לכל מונח, בלי ז׳רגון */
const FMT_HELP = [
  ['studioFmtQ', 'studioFmtQS'], ['studioFmt4k', 'studioFmt4kS'], ['studioFmtOrig', 'studioFmtOrigS'], ['studioFmtAv1', 'studioFmtAv1S'],
  ['studioFmtVp9', 'studioFmtVp9S'], ['studioFmtH264', 'studioFmtH264S'], ['studioFmtOpus', 'studioFmtOpusS'], ['studioFmtAac', 'studioFmtAacS'],
  ['studioFmtFps', 'studioFmtFpsS'], ['studioFmtHdr', 'studioFmtHdrS'], ['studioFmtSize', 'studioFmtSizeS'], ['studioFmtSec', 'studioFmtSecS'],
  ['studioFmtSrv', 'studioFmtSrvS'],
];
function pageFmtHelp(p) {
  p.append(navBar({ back: form && form.link ? T('studioLinkT') : T('studioNew'), title: T('studioFmtHelpT') }));
  p.append(note(T('studioFmtHelpLede')));
  const L = (k) => {
    switch (k) {   // מפתחות מילוליים — בדיקת התרגום אוסרת מפתח במשתנה
      case 'studioFmtQ': return [T('studioFmtQ'), T('studioFmtQS')];
      case 'studioFmt4k': return [T('studioFmt4k'), T('studioFmt4kS')];
      case 'studioFmtOrig': return [T('studioFmtOrig'), T('studioFmtOrigS')];
      case 'studioFmtAv1': return [T('studioFmtAv1'), T('studioFmtAv1S')];
      case 'studioFmtVp9': return [T('studioFmtVp9'), T('studioFmtVp9S')];
      case 'studioFmtH264': return [T('studioFmtH264'), T('studioFmtH264S')];
      case 'studioFmtOpus': return [T('studioFmtOpus'), T('studioFmtOpusS')];
      case 'studioFmtAac': return [T('studioFmtAac'), T('studioFmtAacS')];
      case 'studioFmtFps': return [T('studioFmtFps'), T('studioFmtFpsS')];
      case 'studioFmtHdr': return [T('studioFmtHdr'), T('studioFmtHdrS')];
      case 'studioFmtSize': return [T('studioFmtSize'), T('studioFmtSizeS')];
      case 'studioFmtSec': return [T('studioFmtSec'), T('studioFmtSecS')];
      default: return [T('studioFmtSrv'), T('studioFmtSrvS')];
    }
  };
  const groups = [[T('studioFmtGQ'), FMT_HELP.slice(0, 3)], [T('studioFmtGV'), FMT_HELP.slice(3, 6)], [T('studioFmtGA'), FMT_HELP.slice(6, 8)], [T('studioFmtGM'), FMT_HELP.slice(8)]];
  for (const [title, items] of groups) {
    p.append(secT(title), list(...items.map(([k]) => {
      const [a, b] = L(k), r = h('div', 'st-row st-help'); r.append(rowTxt(a, b)); return r;
    })));
  }
}
/* "התחלה" לעבודה מקישור: אומדן ואישור → ההורדה בטלפון (DlActivity) → הקובץ חוזר (studioGot) → עבודה רגילה מהטלפון.
   הטופס נשמר ב־sessionStorage — החזרה של הקובץ טוענת את הדף מחדש (POST ל־/share-file) */
function startLink(f) {
  const L = f.link;
  if (L && L.to === 'cloud') { startLinkCloud(f); return; }   // הבחירה "לענן של Studio"
  if (!L || L.st !== 'ok' || ui.starting) return;
  if (ui.access === 'signin' || ui.access === 'denied') { flashSafe(ui.access === 'signin' ? T('studioErrSignin') : T('studioErrDenied')); return; }
  if (!devDl()) { flashSafe(T('studioLinkEApp')); return; }
  if (!langReady(f.from, f.to)) { flashSafe(errText('lang_unsupported')); return; }
  const pick = linkPick(L);
  if (!pick) return;
  ui.starting = true; render('none');
  (async () => {
    const dur = pick.sec ? pick.sec[1] - pick.sec[0] : L.r.d || 0;
    const est = startEstimate(modeFor(f.mode, ui.mf), dur, curNorm(), ui.api, apiMode());
    if (est.min && !f.ka && typeof askConfirm === 'function') {   // קריוקי — בלי Claude, בלי אומדן
      const yes = await estAsk(est, f);
      if (!yes || form !== f) { ui.starting = false; render('none'); return; }
    }
    const n = dlNonce();
    const ch = pick.ch && L.r.ch ? L.r.ch.map((c) => [c[0] - (pick.sec ? pick.sec[0] : 0), c[1]]).filter((c) => c[0] >= 0) : [];
    const pend = { n, at: Date.now(), dur, f: { from: f.from, to: f.to, mode: f.mode, out: f.out, style: f.style, sty: f.sty || null, terms: f.terms, edl: null,
      ...(f.ka ? { ka: true, lyr: kaLyr(f.lyr), bv: f.bv === true, gv: f.gv || 0 } : {}) },   // 30/10/2026: שיר שהורד בטלפון חוזר לטופס של הקריוקי
      t: L.r.t, u: L.r.u || L.u, ch, th: L.r.th || '' };
    try { sessionStorage.setItem(DLP_KEY, JSON.stringify(pend)); } catch (e) {}
    ui.starting = false; ui.dlWait = n; render('none');
    flashSafe(T('studioLinkDlWait'));
    location.href = dlIntent('dl', { u: L.r.u || L.u, ref: L.ref, n, v: pick.v, a: pick.a, h: pick.h,
      s0: pick.sec ? pick.sec[0] : '', s1: pick.sec ? pick.sec[1] : '', t: L.r.t });
  })();
}
/* "רק להוריד לטלפון": ההורדה ב־DlActivity עם o=1 — בסוף "נשמר בטלפון" עם פתיחה בנגן, בלי לחזור לאתר */
function dlOnly(L) {
  const pick = L && L.st === 'ok' ? linkPick(L) : null;
  if (!pick) return;
  flashSafe(T('studioLinkOnlyWait'));
  location.href = dlIntent('dl', { u: L.r.u || L.u, ref: L.ref, n: dlNonce(), v: pick.v, a: pick.a, h: pick.h,
    s0: pick.sec ? pick.sec[0] : '', s1: pick.sec ? pick.sec[1] : '', t: L.r.t, o: 1 });
}
/* 24/10/2026: "להוריד בענן בלי בדיקה" — רק כשהבדיקה בשרת לא חזרה (לא כשהאתר עצמו סירב), בדפדפן בלי האפליקציה,
   כשמותר ענן (ui.url) ולא ביוטיוב (חוסם את השרת). השם — מהכתובת; האורך והגודל — אחרי ההורדה */
const BLIND_ERRS = ['timeout', 'no_take', 'net'];
export function blindOk(L, busy) {
  if (!L || !ui.url || devDl() || !L.u) return false;
  if (!busy && !BLIND_ERRS.includes(L.e) && !/^srv:(?!bad_url|flag_off)/.test(L.e || '')) return false;
  try { new URL(L.u); } catch (e) { return false; }
  return !ytHost(L.u) || !!ui.yc;
}
/* יוטיוב (כל הכתובות שלו) — חוסם את השרת שלנו, לכן רק בטלפון עם Studio לאנדרואיד */
export function ytHost(u) {
  try { return /(^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$/i.test(new URL(String(u || '').trim()).hostname); } catch (e) { return false; }
}
export function urlTitle(u) {
  try {
    const x = new URL(u), seg = x.pathname.split('/').filter(Boolean).pop() || '';
    let t = seg;
    try { t = decodeURIComponent(seg); } catch (e) {}
    t = t.replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_+-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return (t || x.hostname.replace(/^www\./, '')).slice(0, 120);
  } catch (e) { return 'video'; }
}
function linkBlind(f) {
  const L = f && f.link;
  if (!blindOk(L, L && L.st === 'busy')) return;
  L.r = { t: urlTitle(L.u), u: L.u, d: 0, q: [], s: '', ch: [] };
  L.blind = 1; L.st = 'ok';
  startLinkCloud(f);
}
function blindUndo(L) { if (L && L.blind) { L.blind = 0; L.r = null; L.st = 'err'; L.e = L.e || 'timeout'; } }
function startLinkCloud(f) {   // ישר לענן של Studio (העובד מוריד) — כשהמשתמש בחר ובמקור שלא חוסם את השרת
  const L = f.link;
  if (!L || L.st !== 'ok' || ui.starting) return;
  if (ui.access === 'signin' || ui.access === 'denied') { flashSafe(ui.access === 'signin' ? T('studioErrSignin') : T('studioErrDenied')); return; }
  if (!apiMode() && !cpMode() && !ryMode() && !(f.ka && kaOk())) { flashSafe(T('studioLinkApiOnly')); return; }   // 25/10: גם "המנוי שלי" כשיש שרת (ry)
  if (!f.ka && !langReady(f.from, f.to)) { flashSafe(errText('lang_unsupported')); return; }
  const pick = L.blind ? { h: 0 } : linkPick(L);   // 24/10/2026: "בלי בדיקה" — העובד בוחר לבד (הכי טוב עד 1080p, fetchurl.selector)
  if (!pick) return;
  ui.starting = true; render('none');
  (async () => {
    const dur = pick.sec ? pick.sec[1] - pick.sec[0] : L.r.d || 0;
    const o = L.blind ? {} : L.r.q.find((x) => x.v === pick.v) || {};
    const spec = { name: L.r.t, size: L.blind ? 1 : Math.max(1, linkSize(L)), type: 'video/url', dur, from: f.from, to: f.to, mode: modeFor(f.mode, ui.mf),
      out: OUTS.filter((k) => f.out[k]), style: f.style, ...(f.sty ? { sty: f.sty } : {}), terms: f.terms, src: 'url', url: L.r.u || L.u, pick, eng: 'api', cap: store.settings.cap };
    if (L.ref) spec.ref = L.ref;
    if (f.ka) kaSpec(f, spec);   // 26/10/2026: קריוקי מקישור — כמו בסרטונים
    else if (cpMode()) spec.cp = 1;
    else if (ryMode()) spec.ry = 1;   // 24/10/2026: המנוי שלך — Claude דרך ה־Routine, לא מהמפתח של המערכת
    if (o.h > 0) spec.px = Math.round(Math.max(0.02, Math.min(16, (o.h * o.h * 16 / 9) / (1920 * 1080))) * 1000) / 1000;
    const est = startEstimate(spec.mode, spec.dur, curNorm(), ui.api, apiMode());
    if (est.min && !f.ka && typeof askConfirm === 'function') {
      const yes = await estAsk(est, f);
      if (!yes || form !== f) { ui.starting = false; blindUndo(L); render('none'); return; }
    }
    // 25/10/2026: start — השרתון מתחיל כבר ביצירה. באייפון Safari מקפיא את הדף כשעוברים לאפליקציה אחרת, ו"התחל" נפרד
    // לא הגיע (פרק של משתמש חיכה כך שעתיים)
    const j = await net.api('create', { spec, start: true });
    ui.starting = false;
    if (!j.ok || !j.job) { flashSafe(errText(j.error)); blindUndo(L); render('none'); return; }
    fnlAdd('start');
    const rec = normJob({ id: j.job.id, created: j.job.created || Date.now(), spec: j.job.spec || spec, srv: j.job,
      fp: { name: L.r.t, size: spec.size, lm: 0 }, org: normOrg({ v: { k: 'ln', h: hostOf(L.ref || spec.url) } }), up: { link: true, noAudio: 'link', a: { done: true }, v: { done: true }, folder: j.job.folder || '' } });   // אין מה להעלות מהטלפון
    if (j.start) startDone(rec, j.start);   // שרתון ישן בלי start — runJob מתחיל כמו קודם
    utlOf(rec);
    if (pick.ch && L.r.ch) rec.chap = normChapters(L.r.ch.map((c) => ({ t: c[0] - (pick.sec ? pick.sec[0] : 0), title: c[1] })).filter((c) => c.t >= 0), dur);
    if (L.r.th) { thumbs.set(rec.id, L.r.th); idbOp('thumbs', 'put', rec.id, L.r.th); }   // התמונה מהבדיקה — בלי לחכות לסרטון
    store.jobs.unshift(rec);
    if (f.id) store.drafts = store.drafts.filter((d) => d.id !== f.id);
    save();
    if (j.start) utlSend(rec.id);   // 25/10/2026: בלי runJob — המכשיר נשלח כאן
    form = null;
    if (!root) { if (!j.start) startRun(rec.id, null); return; }
    replaceView('job', rec.id);
    if (!j.start) startRun(rec.id, null);
  })();
}
/* ההורדה הסתיימה: sw.js שמר את הקובץ (IndexedDB snb-inbox) והעביר לכאן עם ‎#got=<מפתח>. הטופס מההורדה (אם יש) —
   ההתחלה ממשיכה לבד (האומדן כבר אושר). סרטון ששותף מהגלריה — טופס חדש עם הקובץ */
export function studioGot(key) { return gotFile(key); }
async function gotFile(key) {
  if (!/^[A-Za-z0-9]{6,40}$/.test(String(key || ''))) return false;
  const e = await inboxOp('get', key);
  if (!e || !e.f || !(e.f instanceof Blob)) return false;
  const file = e.f.name ? e.f : new File([e.f], 'video.mp4', { type: e.f.type || 'video/mp4' });
  let pend = null;
  try { pend = JSON.parse(sessionStorage.getItem(DLP_KEY) || 'null'); } catch (x) {}
  const mine = pend && /^snbdl:/.test(String(e.t || '')) && String(e.t).slice(6) === pend.n;
  if (!mine) pend = null;
  try { if (mine) sessionStorage.removeItem(DLP_KEY); } catch (x) {}
  ui.dlWait = '';
  form = freshForm(null);
  const f = form;
  if (pend && pend.f) for (const k of ['from', 'to', 'mode', 'out', 'style', 'sty', 'terms']) if (pend.f[k] != null) f[k] = k === 'sty' ? normSty(pend.f[k]) : pend.f[k];
  if (pend && pend.f && pend.f.ka === true) Object.assign(f, { ka: true, lyr: kaLyr(pend.f.lyr), bv: pend.f.bv === true, gv: KA_GV.includes(pend.f.gv) ? pend.f.gv : 0 });   // 30/10/2026
  f.fileObj = file; f.handle = { inbox: key }; f.drive = null; f.file = { name: file.name, size: file.size, type: file.type || '' };
  f.dl = pend ? { t: pend.t, ch: pend.ch || [], th: pend.th || '', u: pend.u || '' } : null;   // u — לשם האתר במקור (org)
  inspectFor(f, file); if (!f.ka) tracksFor(f, file);
  if (root) { if (ui.view !== 'new') go('new', f.ka ? 'ka' : null, 'none'); else render('none'); }
  if (mine) { flashSafe(T('studioLinkGot')); f.estOk = true; startFromForm(); }
  return true;
}
/* תיבת הקבצים שהגיעו מ־/share-file (sw.js כותב, הדף קורא) — מסד נפרד, בלי תלות בגרסה של snb-studio */
function inboxOp(mode, key) {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((ok) => {
    const r = indexedDB.open('snb-inbox', 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('f')) r.result.createObjectStore('f'); };
    r.onerror = () => ok(null);
    r.onsuccess = () => {
      try {
        const tx = r.result.transaction('f', mode === 'get' ? 'readonly' : 'readwrite'), os = tx.objectStore('f');
        if (mode === 'clean') {   // שבוע — אחר כך נמחק (הסרטון נשאר ב־Movies/Studio)
          const q = os.openCursor();
          q.onsuccess = () => { const c = q.result; if (!c) return ok(null); if (!c.value || Date.now() - (c.value.at || 0) > 7 * 864e5) c.delete(); c.continue(); };
          q.onerror = () => ok(null);
          return;
        }
        const q = mode === 'get' ? os.get(key) : os.delete(key);
        q.onsuccess = () => ok(mode === 'get' ? q.result || null : null); q.onerror = () => ok(null);
      } catch (x) { ok(null); }
    };
  });
}
/* שגיאה בהורדה בטלפון (‎#dle=<n>.<קוד>) */
export function studioDlErr(arg) {
  const m = /^([A-Za-z0-9]{6,24})\.([a-z_]{1,20})$/.exec(String(arg || ''));
  if (!m) return false;
  try { const p = JSON.parse(sessionStorage.getItem(DLP_KEY) || 'null'); if (p && p.n === m[1]) sessionStorage.removeItem(DLP_KEY); } catch (e) {}
  if (ui.dlWait === m[1]) ui.dlWait = '';
  flashSafe(T('studioLinkFailT') + ' — ' + linkErrText(m[2]));
  render('none');
  return true;
}

/* ---------------- 24/10/2026: תרגום בטלפון (שלב 1) — הסרטון לא עוזב את הטלפון ----------------
   האתר: בחירה (intent ל־PhActivity → ‎#phpick=), יצירת העבודה (spec.ph), מפתח לעבודה (phKey) ומסירה לאפליקציה (intent ph).
   האפליקציה (PhService): הקול → העלאה → התחלה → השוטים וה־ffprobe → העלאה. בסוף — "לצרוב בטלפון" (intent phburn). */
const phOk = () => devDl() && ui.r2 && (apiMode() || cpMode() || ryMode());
function phIntent(kind, q) {
  q = Object.assign({}, q, { l: uiLang() });
  try { q.w = location.origin + '/'; } catch (e) {}
  const qs = Object.keys(q).filter((k) => q[k] !== '' && q[k] != null).map((k) => k + '=' + encodeURIComponent(q[k])).join('&');
  let fb = '';
  try { fb = location.origin + location.pathname + '#phpick=!noapp'; } catch (e) {}
  return 'intent://' + kind + '?' + qs + '#Intent;scheme=snbstudio;package=' + DL_PKG + (fb ? ';S.browser_fallback_url=' + encodeURIComponent(fb) : '') + ';end';
}
function phPick() {
  if (!phOk()) { flashSafe(T('studioLinkEApp')); return; }
  location.href = phIntent('phpick', {});
}
/* ‎#phpick= מ־PhActivity: הסרטון נבחר והועתק לאחסון של Studio — הטופס עם הקובץ (בלי לקרוא אותו כאן) */
export function studioPhPick(arg) {
  const r = parsePhPick(arg);
  if (!r) return false;
  if (r.e) { if (r.e !== 'cancel') flashSafe(T('studioPhFail') + ' — ' + phErrText(r.e)); return true; }
  if (!form) form = freshForm(null);
  const f = form;
  f.ph = { pid: r.pid, w: r.w, h: r.h, dur: r.dur, cap: r.cap };   // 30/10/2026: cap נשמר — בלעדיו גם pt (שלב 3) לא הופעל אף פעם
  f.fileObj = null; f.handle = null; f.drive = null; f.link = null; f.linkOk = false; f.edl = null;
  f.file = { name: r.name, size: r.size, type: 'video/*' }; f.dur = r.dur;
  phTracks(f, r);
  if (root) { if (ui.view !== 'new') go('new', null, 'none'); else render('none'); }
  return true;
}
const PH_ERR_RE = /^(space|no_audio|no_video|probe|noapp|models_wifi|models_sha|models_net|models_io|no_speech)$/;
function phErrText(c) {
  switch (c) {
    case 'models_wifi': return T('studioPhEWifi');
    case 'models_sha': case 'models_net': case 'models_io': return T('studioPhEModels');
    case 'no_speech': return T('studioPhENoSpeech');
    case 'space': return T('studioPhESpace');
    case 'no_audio': return T('studioPhENoAudio');
    case 'no_video': case 'probe': return T('studioPhEProbe');
    case 'noapp': return T('studioLinkEApp');
    default: return T('studioPhEGen');
  }
}
function phPb(f) {
  const o = f.out || {};
  if (o.same || o.compact || o.mkv) return 'same';
  return o.small ? 'small' : '';
}
function startPhone(f) {
  const P = f.ph;
  if (!P || ui.starting) return;
  if (ui.access === 'signin' || ui.access === 'denied') { flashSafe(ui.access === 'signin' ? T('studioErrSignin') : T('studioErrDenied')); return; }
  if (!phOk()) { flashSafe(T('studioLinkApiOnly')); return; }
  if (!langReady(f.from, f.to)) { flashSafe(errText('lang_unsupported')); return; }
  ui.starting = true; render('none');
  (async () => {
    const spec = { name: f.file.name, size: f.file.size, type: 'video/*', dur: P.dur || 0, from: f.from, to: f.to, mode: modeFor(f.mode, ui.mf),
      out: [], style: f.style, terms: f.terms, ph: 1, eng: 'api', cap: store.settings.cap };
    if (f.pw === true) spec.pw = 1;   // שלב 2: הכל בטלפון — רק כשהופעל (30/10/2026: כבר לא ברירת המחדל)
    spec.vc = 1;   // 29/10/2026: האפליקציה מעלה גם את הסרטון לענן, ברקע (לנגן מכל מכשיר, לשמירה ולהפקה מחדש) — העבודה לא מחכה לו
    const pb = phPb(f); if (pb) spec.pb = pb;
    if (cpMode()) spec.cp = 1; else if (ryMode()) spec.ry = 1;
    else if (spec.pw && (P.cap || 0) >= PH_CAP_PT) spec.pt = 1;   // שלב 3: גם שלבי הטקסט בטלפון — השרת רק מעביר ל־Claude
    if (P.w > 0 && P.h > 0) spec.px = Math.round(Math.max(0.02, Math.min(16, P.w * P.h / (1920 * 1080))) * 1000) / 1000;
    // קודם יוצרים את העבודה ומבקשים מפתח (רשת — בלי נגיעה), ורק אז האומדן: הנגיעה ב"להתחיל" היא זו שפותחת את
    // האפליקציה (Chrome פותח intent רק מתוך נגיעה; אחרי await של רשת — כבר לא). ביטול — העבודה נמחקת. העבודה נשארת
    // "חדשה" עד שהאפליקציה מעלה את הקול ומתחילה אותה — לא עולה כלום עד אז
    const j = await net.api('create', { spec });
    if (!j.ok || !j.job) { ui.starting = false; flashSafe(errText(j.error)); render('none'); return; }
    fnlAdd('start');
    // 30/10/2026: עזר להגהה (מהקובץ / מהרשת) — עולה כבר עכשיו, במקביל: העבודה מתחילה רק כשהאפליקציה העלתה את הקול
    const ht = f.trk && f.trk.hlp != null && !f.trk.busy ? trkHlpTxt(f) : '';
    if (ht) hlpUpload({ id: j.job.id, spec: j.job.spec || spec, up: { folder: j.job.folder || '' } }, ht);
    const k = await phKeyFor(j.job.id);
    if (!k) { ui.starting = false; net.api('remove', { job: j.job.id }).catch(() => {}); flashSafe(errText('phkey')); render('none'); return; }
    const est = startEstimate(spec.mode, spec.dur, curNorm(), ui.api, apiMode());
    if (est.min && typeof askConfirm === 'function') {
      const yes = await estAsk(est, f);
      if (!yes || form !== f) { ui.starting = false; net.api('remove', { job: j.job.id }).catch(() => {}); render('none'); return; }
    }
    ui.starting = false;
    const rec = normJob({ id: j.job.id, created: j.job.created || Date.now(), spec: j.job.spec || spec, srv: j.job,
      fp: { name: f.file.name, size: f.file.size, lm: 0 }, vm: P.w && P.h ? { w: P.w, h: P.h } : null, org: orgOf(f, { k: 'pa' }, ht ? 'api' : ''),
      up: { ph: P.pid, noAudio: 'ph', a: { done: true }, v: { done: true }, folder: j.job.folder || '' } });   // האפליקציה מעלה, לא הדף
    store.jobs.unshift(rec);
    if (f.id) store.drafts = store.drafts.filter((d) => d.id !== f.id);
    save();
    const refText = trkRefSrt(f);   // רצועת ההשוואה — לתיקיית העבודה (סט הזהב בסוף)
    if (refText) refUpload(rec, refText);
    form = null;
    if (root) replaceView('job', rec.id);
    // חלון האישור סוגר את עצמו ב־history.back (אסינכרוני) — ניווט בהיסטוריה אחרי ה־intent מבטל אותו. לכן אחרי afterBack
    // (כמו appGo); ההפעלה מהנגיעה עוד בתוקף. לא נפתח — הכפתור "להמשיך באפליקציה" בדף העבודה
    const hand = () => setTimeout(() => phHand(rec, 'ph'), 250);   // אחרי שדף העבודה סיים להתעדכן בהיסטוריה (replaceState מבטל ניווט שבדרך)
    if (typeof afterBack === 'function') afterBack(hand); else hand();
  })();
}
/* המפתח של העבודה בשביל האפליקציה — יציב בשרתון (אותו מפתח כל עוד הוא בתוקף), אז מבקשים אותו מראש ושומרים בזיכרון:
   כל כפתור פותח את האפליקציה ישר מהנגיעה, בלי בקשה ברשת באמצע */
const phKeys = new Map();
async function phKeyFor(id) {
  const c = phKeys.get(id);
  if (c && c.exp - Date.now() > 3600e3) return c.k;
  const k = await net.api('phKey', { job: id });
  if (!k || !k.ok || !k.key) return '';
  phKeys.set(id, { k: k.key, exp: Number(k.exp) || 0 });
  return k.key;
}
/* 24/10/2026 (בטלפון: הצריבה הופיעה רק בהתראה): נגיעה ב"לצרוב" — הדף ממשיך לשאול את השרתון (העבודה כבר "הסתיימה",
   ועד עכשיו עבודה שהסתיימה לא נבדקה שוב) עד שהצריבה מסתיימת או נכשלת */
const phBurnTap = new Map(), PH_BURN_WAIT = 5 * 60e3;
const phBurnLive = (r) => !!(r && r.spec && r.spec.ph && r.srv && (r.srv.pbn && r.srv.pbn.s === 'run'
  || Date.now() - (phBurnTap.get(r.id) || 0) < PH_BURN_WAIT && !(r.srv.pbn && r.srv.pbn.at > phBurnTap.get(r.id) - 60e3 && r.srv.pbn.s !== 'run')));   // דקה — שעון הטלפון מול השרתון
/* 29/10/2026: הסרטון עולה לענן מ־Studio לאנדרואיד (דיווח מהדקות האחרונות) — הדף ממשיך לשאול גם אחרי שהעבודה הסתיימה */
const vcLive = (r) => !!(r && r.spec && r.spec.vc && r.srv && !r.srv.fv && r.srv.vcp && !r.srv.vcp.e && Date.now() - r.srv.vcp.at < PPR_LIVE);
/* הטלפון עובד על עבודה "הכל בטלפון" (דיווח מהדקות האחרונות) — הדף ממשיך לשאול, והכפתור "להמשיך באפליקציה" לא מוצג */
const PPR_LIVE = 3 * 60e3;
const phPrepLive = (r) => !!(r && r.spec && r.spec.pw && r.srv && r.srv.state === 'new' && r.srv.ppr && r.srv.ppr.s !== 'err' && Date.now() - r.srv.ppr.at < PPR_LIVE);
function pprText(q) {
  const pc = q.p >= 0 ? ' · ' + Math.round(q.p * 100) + '%' : '';
  switch (q.s) {
    case 'models': return T('studioPhStModels') + pc;
    case 'wav': return T('studioPhStWav');
    case 'asr': return T('studioPhStAsr') + pc;
    case 'diar': return T('studioPhStDiar');
    case 'align': return T('studioPhStAlign') + pc;
    case 'upw': return T('studioPhStUpw');
    case 'shots': return T('studioPhStShots');
    case 'upm': return T('studioPhStUpm');
    default: return T('studioPhStStart');
  }
}
function phHand(rec, kind) {
  const c = phKeys.get(rec.id);
  if (!rec.up.ph || !c) return false;
  if (kind === 'phburn') { phBurnTap.set(rec.id, Date.now()); setTimeout(schedulePoll, 0); }
  location.href = phIntent(kind, Object.assign({ pid: rec.up.ph, j: rec.id, k: c.k, b: proxyBase(), pb: rec.spec.pb || '' }, kind === 'phburn' ? { pb: rec.spec.pb || 'same' } : {},
    kind === 'ph' && rec.spec.pw ? { pw: 1 } : {}, kind === 'ph' && rec.spec.pt ? { pt: 1 } : {}, rec.spec.vc ? { vc: 1 } : {}));
  return true;
}
/* שגיאה מהאפליקציה (‎#studio=<עבודה>&phe=<קוד>) */
export function studioPhErr(id, code) {
  if (!/^[a-z0-9_]{1,24}$/.test(String(code || ''))) return false;
  flashSafe(T('studioPhFail') + ' — ' + (PH_ERR_RE.test(code) ? phErrText(code) : errText(code)));
  return true;
}
/* הכרטיס בדף העבודה: הסרטון בטלפון · המדידות · הצריבה (מצב מהשרתון — pbn — וכפתור) */
function phCard(rec) {
  const srv = rec.srv || {}, b = srv.pbn, st = srv.state;
  const card = h('div', 'st-card st-ph');
  card.append(h('b', null, T('studioPhCardT')));
  const lines = [srv.m ? T('studioPhMeasured') : rec.spec.pw ? T('studioPhNotMeasuredPw') : T('studioPhNotMeasured')];
  const burning = phBurnLive(rec);
  if (b && b.s === 'done' && !burning) lines.push(T('studioPhBurned', { s: b.sz ? fmtSize(b.sz) : '' }));
  else if (b && b.s === 'fail' && !burning) lines.push(T('studioPhBurnFail') + (b.e ? ' (' + b.e + ')' : ''));
  if (st === 'done' && rec.up.ph && b && b.s === 'done') lines.push(T('studioPhKept'));   // 25/10/2026: הסרטון נשמר בטלפון לצריבה נוספת עד מחיקת הפרויקט
  // 29/10/2026: הסרטון גם לענן (spec.vc) — Studio לאנדרואיד מעלה אותו ברקע; העבודה לא מחכה לו (לנגן מכל מכשיר ולשמירה)
  if (rec.spec.vc) {
    const v = srv.vcp;
    if (srv.fv) lines.push(T('studioVcDone'));
    else if (v && v.e) lines.push(T('studioVcStop'));
    else if (v) lines.push(T('studioVcUp', { p: Math.round(v.p * 100) }));
  }
  for (const l of lines) card.append(h('small', null, l));
  if (rec.spec.pw && st === 'new' && srv.ppr) {   // שלב 2: התמלול/היישור בטלפון — שלב ופס שמתעדכנים במקום
    const cur = () => { const x = jobRec(rec.id) || rec; return x.srv && x.srv.ppr; };
    if (srv.ppr.s === 'err') card.append(h('small', 'st-warn', T('studioPhStopped') + ' — ' + (PH_ERR_RE.test(srv.ppr.e) ? phErrText(srv.ppr.e) : errText(srv.ppr.e))));
    else {
      const pb = h('span', 'st-pbar'), pi = h('i'); pb.append(pi);
      card.append(live(h('small'), (el) => { const q = cur(); el.textContent = q && q.s !== 'err' ? pprText(q) : ''; }),
        live(pb, () => { const q = cur(); pi.style.width = (q && q.p >= 0 ? Math.round(q.p * 100) : 0) + '%'; pb.classList.toggle('ind', !(q && q.p >= 0)); }));
    }
  }
  if (burning) {   // הצריבה רצה — אחוז ופס שמתעדכנים במקום
    const cur = () => { const x = jobRec(rec.id) || rec, q = x.srv && x.srv.pbn; return q && q.s === 'run' ? q.p || 0 : 0; };
    const pb = h('span', 'st-pbar'), pi = h('i'); pb.append(pi);
    card.append(live(h('small'), (el) => { el.textContent = T('studioPhBurning', { p: Math.round(cur() * 100) }); }), live(pb, () => { pi.style.width = Math.round(cur() * 100) + '%'; }));
  }
  const here = !!(rec.up.ph && devDl());
  const ready = here && phKeys.has(rec.id);
  if (here && !ready) phKeyFor(rec.id).then((k) => { if (k && root && ui.view === 'job' && ui.param === rec.id) render('none'); });   // מראש — לפני הנגיעה
  const go = (cls, label, kind) => { const x = btn(cls, ready ? label : T('studioPhKeyBusy'), () => phHand(rec, kind), 'ph-' + kind); x.disabled = !ready; card.append(h('div', 'st-gap sm'), x); };
  // שלב 3 (pt): בתור = הטלפון עוד לא לקח את העבודה (נעצר / האפליקציה נסגרה) — להמשיך שם
  if ((st === 'new' && !phPrepLive(rec) || !srv.m && (st === 'queued' || st === 'running') || rec.spec.pt && st === 'queued')) {   // האפליקציה עוד לא העלתה הכל (או לא נפתחה) — להמשיך שם
    if (here) go(st === 'new' ? 'st-btn wide' : 'st-btn ghost wide', st === 'new' ? T('studioPhStartApp') : T('studioPhResume'), 'ph'); else card.append(h('small', 'st-warn', T('studioPhOtherDev')));
  } else if (!burning && st === 'done' && rec.spec.pb && !(b && (b.s === 'run' || b.s === 'done'))) {
    if (here) go('st-btn wide', T('studioPhBurnGo'), 'phburn'); else card.append(h('small', 'st-warn', T('studioPhOtherDev')));
  } else if (!burning && st === 'done' && b && b.s === 'done' && here) go('st-btn ghost wide', T('studioPhBurnAgain'), 'phburn');
  return card;
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
/* 24/10/2026: בחרת בשרת של המערכת (או בהעתק־הדבק) — ההתחלה מחכה לתשובה מהשרתון, ובלעדיה לא מתחילים.
   עד היום עבודה מהורדה בטלפון (gotFile) התחילה מיד אחרי טעינת הדף, לפני ש־ui.api הגיע — ונפלה בשקט ל־Routine */
export const engKnown = (conn, api) => !(conn === 'api' || conn === 'copy') || !!api;
async function engSettle() {
  for (let i = 0; i < 2 && !engKnown(connNow(), ui.api); i++) { statusAt = 0; await refreshStatus(true); }
  return engKnown(connNow(), ui.api);
}
function startFromForm() {
  const f = form;
  pushAuto(true);   // 27/10/2026: ההתראות פעילות כברירת מחדל — הבקשה בלחיצה הזו (פעם אחת)
  if (f && !ui.starting && !engKnown(connNow(), ui.api)) {
    ui.starting = true; render('none');
    engSettle().then((ok) => {
      ui.starting = false;
      if (form !== f) return;
      if (ok) startFromForm(); else { flashSafe(T('studioEngWait')); render('none'); }
    });
    return;
  }
  // 24/10/2026: "המנוי שלי" — מחכים לתשובה פעם אחת כדי לדעת אם יש שרת (אז העבודה רצה בו, ו־Claude דרך ה־Routine).
  // אין תשובה — ממשיכים כמו קודם (רק ה־Routine), לא חוסמים
  if (f && !ui.starting && connNow() === 'sub' && !ui.api && !f.ryTried) {
    f.ryTried = true; ui.starting = true; render('none');
    statusAt = 0;
    refreshStatus(true).catch(() => {}).then(() => { ui.starting = false; if (form === f) startFromForm(); });
    return;
  }
  if (f && f.subs && !ui.starting) { startSubs(f); return; }   // 22/10/2026: קובץ כתוביות קיים
  if (f && f.link && f.linkOk && !ui.starting) { startLink(f); return; }   // 22/10/2026: מקישור — העובד מוריד
  if (f && f.ph && !ui.starting) { startPhone(f); return; }   // 24/10/2026: תרגום בטלפון — Studio לאנדרואיד מעלה
  if (!f || !(f.fileObj || f.drive) || ui.starting) return;
  if (ui.access === 'signin' || ui.access === 'denied') { flashSafe(ui.access === 'signin' ? T('studioErrSignin') : T('studioErrDenied')); return; }
  // 11/10/2026: במצב השרת עם R2 הקבצים לא עוברים דרך Drive — חיבור Drive נדרש רק למקור מ־Drive / Routine
  // 26/10/2026: מקור מהרשימה של Studio (bx) — רק כשהשרת שלנו מתרגם; את Drive הוא קורא בחיבור של הרשימה, לא של הסטודיו
  const bx = !!(f.drive && f.drive.bx);
  if (bx && !(apiMode() || cpMode() || ryMode())) { flashSafe(T('studioDpEng')); return; }
  const needDrive = !((apiMode() || cpMode() || (bx && ryMode()) || (f.ka && kaOk())) && ui.r2 && (!f.drive || bx));
  if (needDrive && (!store.drive || !store.drive.connected)) {
    if (typeof askConfirm === 'function') askConfirm(T('studioNeedDrive'), connectDrive, { ok: T('studioDriveConnect') });
    else connectDrive();
    return;
  }
  if (!f.ka && !langReady(f.from, f.to)) { flashSafe(errText('lang_unsupported')); return; }   // לפני ההעלאה, לא אחריה
  if (f.ka && (!kaOk() || !kaLyr(f.lyr).trim())) { flashSafe(kaOk() ? T('studioKaNeedLyr') : T('studioKaNoSrv')); return; }
  ui.starting = true; render('none');
  (async () => {
    const file = f.fileObj || f.drive;   // מ־Drive: הפרטים מ־Drive (בלי לקרוא את הקובץ בטלפון)
    const sm = f.sa && f.sa.st === 'ok' ? f.sa.m : null;   // סבב 2: הבדיקה מהבחירה — בלי לקרוא את הקובץ שוב
    const pr = f.fileObj ? (sm && sm.dur ? { dur: sm.dur } : await probeVideo(file)) : { dur: f.drive.dur || 0 };
    const ed = edlPre(normEdl(f.edl, pr.dur || 0));   // מ4: חיתוך לפני התרגום — האורך (ומכאן ההערכות) אחרי החיתוך
    const spec = { name: file.name, size: file.size, type: file.type || '', dur: ed ? edlDur(ed, pr.dur || 0) : pr.dur || 0, from: f.from, to: f.to,
      mode: modeFor(f.mode, ui.mf), out: OUTS.filter((k) => f.out[k]), style: f.style, ...(f.sty ? { sty: f.sty } : {}), terms: f.terms };   // 15/10: מצב שסגור למשתמש → ברירת המחדל
    if (ed) spec.edl = ed;
    // 21/10/2026: מידות הסרטון (מהבדיקה בבחירה) → px לצפי של הצריבה; הקצב לא ידוע כאן — 30 פריימים (העובד מתקן אחרי הקליטה)
    if (sm && sm.w > 0 && sm.h > 0) spec.px = Math.round(Math.max(0.02, Math.min(16, sm.w * sm.h / (1920 * 1080))) * 1000) / 1000;
    if (apiMode()) Object.assign(spec, { eng: 'api', cap: store.settings.cap });   // השרת של המערכת — בלי Routine
    else if (cpMode()) Object.assign(spec, { eng: 'api', cap: store.settings.cap, cp: 1 });   // סבב 10: העתק־הדבק — השרת מתמלל וצורב, Claude שלך מתרגם
    else if (ryMode()) Object.assign(spec, { eng: 'api', cap: store.settings.cap, ry: 1 });   // 24/10/2026: המנוי שלך — השרת עושה הכל, Claude דרך ה־Routine
    kaSpec(f, spec);   // 26/10/2026: קריוקי — בלי Claude, בלי אומדן עלות
    // מ6 (כלל 2): אומדן ואישור לפני ההתחלה — עוד לפני שנוצרת עבודה ולפני ההעלאה
    const est = startEstimate(spec.mode, spec.dur, curNorm(), ui.api, apiMode());
    if (est.min && !f.ka && !f.estOk && typeof askConfirm === 'function') {   // estOk — מקישור: האומדן אושר לפני ההורדה בטלפון
      const yes = await estAsk(est, f);
      if (!yes || form !== f) { ui.starting = false; render('none'); return; }
    }
    if (f.dl && f.dl.t) spec.name = (f.dl.t + '.' + ((file.name.match(/\.(\w{2,4})$/) || [0, 'mp4'])[1])).slice(0, 200);   // השם מהאתר, לא שם הקובץ
    const j = await net.api('create', { spec });
    ui.starting = false;
    if (!j.ok || !j.job) { flashSafe(errText(j.error)); render('none'); return; }
    fnlAdd('start');
    const ext = !f.fileObj;
    const rec = normJob({ id: j.job.id, created: j.job.created || Date.now(), spec: j.job.spec || spec, srv: j.job,
      fp: { name: file.name, size: file.size, lm: file.lastModified || 0 }, vm: sm && sm.w && sm.h ? { w: sm.w, h: sm.h } : null, org: orgOf(f, null, spec.eng),
      up: Object.assign(ext ? { ext: true, bx: !!f.drive.bx, noAudio: 'drive', a: {}, v: { done: true, id: f.drive.id, size: f.drive.size } } : {},
        isR2Folder(j.job.folder) ? { folder: j.job.folder } : {}) });   // ת4: עבודה במצב שרת — התיקייה ב־R2 (בלי תיקייה ב־Drive)
    store.jobs.unshift(rec);
    if (f.id) store.drafts = store.drafts.filter((d) => d.id !== f.id);   // טיוטה שהתחילה — כבר עבודה
    save();
    if (f.dl && f.dl.ch && f.dl.ch.length) rec.chap = normChapters(f.dl.ch.map((c) => ({ t: c[0], title: c[1] })), spec.dur);   // הפרקים מהאתר
    if (f.handle) handleOp('put', rec.id, f.handle);   // {inbox} — מההורדה בטלפון: הקובץ ב־snb-inbox (המשך אחרי רענון)
    if (f.dl && f.dl.th) { thumbs.set(rec.id, f.dl.th); idbOp('thumbs', 'put', rec.id, f.dl.th); }
    else if (f.fileObj) thumbFor(rec, null, f.fileObj);   // 21/10/2026: התמונה מהקובץ שבטלפון — בלי לחכות שיעלה
    if (f.trk && f.trk.hlp != null && spec.eng === 'api') {   // 26/10/2026: עזר להגהה — לפני ההתחלה, כדי שהעובד יראה אותו בלקיחה
      await trkWait(f);
      const ht = trkHlpTxt(f);
      if (ht) await hlpUpload(rec, ht);
    }
    form = null;
    if (!root) { startRun(rec.id, ext ? null : file); return; }
    replaceView('job', rec.id);
    startRun(rec.id, ext ? null : file);
  })();
}

/* ---------------- "הסרטונים שלי" ב־Google Drive (26/10/2026, בקשת המשתמש — במקום Google Picker) ----------------
   תיקייה אחת ב־Drive לכל מה שנשמר מ־Studio, עם תיקיות משנה שמנהלים כאן כמו ב־Files של Apple: יצירה, שינוי שם, העברה,
   מחיקה (לפח של Drive). בגישה של הסטודיו (drive.file) — האפליקציה רואה רק מה שהיא יצרה, לא את שאר ה־Drive.
   השמירה: תוצרים ב־R2 (מצב השרת) — העובד בשרת מעתיק (עבודת dx), הסרטון לא עובר בטלפון; תוצרים ב־Drive (Routine) —
   העברה בתוך Drive. ui.param: '' = ניהול · 'S:<עבודה>' = לשמור את העבודה · 'O:<עבודה>:<תוצר>' = תוצר אחד · 'F:<תיקייה>' */
const DX_MOVE = ['same', 'compact', 'small', 'mkv'];
const vl = { st: '', root: '', path: [], items: [], next: '', busy: false, seq: 0, err: '', q: '', mv: null };
const vlPaint = () => { if (root && ui.view === 'vids') render('none'); };
const vlTop = () => vl.path[vl.path.length - 1] || null;
const driveOk = () => !!(store.drive && store.drive.configured !== false);
export function vlParse(p) {
  const m = /^([SOF]):([A-Za-z0-9_-]{6,120})(?::([A-Za-z0-9_-]{10,200}))?$/.exec(String(p || ''));
  return m ? { k: m[1], id: m[2], o: m[3] || '' } : null;
}
/* מאיפה נכנסו ל״הסרטונים שלי״ — לרענון (chainFor): מדף העבודה, אחרת מעמוד האחסון */
export function vidsParent(p) { const x = vlParse(p); return x && x.k !== 'F' ? ['job', x.id] : null; }
function vlAct() {
  const x = vlParse(ui.param);
  if (!x || x.k === 'F') return null;
  const rec = jobRec(x.id);
  if (!rec || !rec.srv) return null;
  if (x.k === 'S') return { k: 'S', rec };
  const o = (rec.srv.out || []).find((y) => y.id === x.o);
  return o ? { k: 'O', rec, o } : null;
}
/* הדרך לתיקייה: השורש, ובכניסה לתיקייה של עבודה (F) — גם היא */
function vlStart(param) {
  const x = vlParse(param);
  vl.path = vl.root ? [{ id: vl.root, n: T('studioVidsT') }] : [];
  if (vl.root && x && x.k === 'F' && x.id !== vl.root) {
    const rec = store.jobs.find((r) => r.up.dx && r.up.dx.f === x.id);
    vl.path.push({ id: x.id, n: rec ? rec.up.dx.n : '' });
  }
}
function goVids(param) {
  vl.q = ''; vl.mv = null; vl.st = ''; vl.items = []; vl.next = '';
  vlStart(param);
  go('vids', param || '');
}
async function vlLoad(more) {
  const seq = ++vl.seq;
  vl.busy = true; if (!more) { vl.items = []; vl.next = ''; } vl.err = ''; vlPaint();
  try {
    if (!vl.root) {
      const r0 = await net.vidsRoot(T('studioVidsRoot'));
      if (seq !== vl.seq) return;
      vl.root = r0; vlStart(ui.param);
    }
    const r = await net.vidsList(vlTop().id, { q: vl.q, page: more ? vl.next : '' });
    if (seq !== vl.seq) return;
    vl.items = (more ? vl.items : []).concat(r.files); vl.next = r.next; vl.st = 'ok';
  } catch (e) {
    if (seq !== vl.seq) return;
    const c = e && e.code;
    if (c === 'not_connected' || c === 'revoked' || c === 'not_allowed') vl.st = 'conn';
    else if (c === 'drive_http_404' && vl.path.length > 1) { vl.path = vl.path.slice(0, 1); vl.busy = false; vlLoad(); return; }   // התיקייה נמחקה בינתיים
    else { vl.st = vl.st === 'ok' ? 'ok' : 'err'; vl.err = c || 'drive'; }
  } finally { if (seq === vl.seq) { vl.busy = false; vlPaint(); } }
}
const vlOpen = (x) => { vl.path.push({ id: x.id, n: x.name }); vl.q = ''; vlLoad(); };
/* "חזור" בתוך תיקייה — תיקייה אחת למעלה (כמו ב־Files), לא יציאה מהדף */
function vlUp() { if (ui.view !== 'vids' || vl.path.length < 2 || vl.q.trim()) return false; vl.path.pop(); vlLoad(); return true; }
function vlThumb(x) {
  const th = h('span', 'st-thumb st-dp-th'); th.append(ico('film'));
  if (x.th) {
    const im = h('img'); im.alt = ''; im.decoding = 'async'; im.loading = 'lazy'; im.referrerPolicy = 'no-referrer';
    im.addEventListener('load', () => th.classList.add('ok'));
    im.addEventListener('error', () => im.remove());
    im.src = x.th; th.append(im);
  }
  if (x.dur) th.append(h('span', 'st-dp-dur', fmtDur(x.dur)));
  return th;
}
function vlRow(x, picking) {
  const r = h('div', 'st-row st-ric st-vl-row' + (vl.mv && vl.mv.id === x.id ? ' dim' : ''));
  const main = btn('st-vl-main', null, () => {
    if (x.folder) { if (!(vl.mv && vl.mv.id === x.id)) vlOpen(x); return; }
    if (!picking && x.url) window.open(x.url, '_blank', 'noopener');
  }, 'vl:' + x.id);
  main.append(x.folder ? tile('folder', 'blue') : /^video\//.test(x.type) ? vlThumb(x) : tile('globe', 'blue'));   // כתוביות — כמו בשורת התוצר
  const l = h('span', 'st-l'), nm = h('b'), bd = h('bdi', null, x.folder ? x.name : fileTitle(x.name)); bd.dir = 'auto'; nm.append(bd);
  l.append(nm, h('small', null, [x.folder ? '' : x.size ? fmtSize(x.size) : '', x.at ? fmtDay(x.at) : ''].filter(Boolean).join(' · ')));
  main.append(l);
  if (x.folder && picking) main.append(ico('chev', 'st-chev'));   // בניהול — ⋯ בצד, בלי חץ נוסף
  r.append(main);
  if (!picking) {
    const m = btn('st-outb', null, () => vlMenu(x), 'vlm:' + x.id);
    m.setAttribute('aria-label', T('studioVidsMore') + ' · ' + x.name);
    m.append(ico('more'));
    r.append(m);
  }
  return r;
}
/* גיליון קטן מלמטה (אותו עיצוב של "מה לא היה טוב?") — "חזור" סוגר אותו (rsClose) */
function vlSheet(title, body) {
  rsClose();
  const veil = h('div', 'st-rs'); veil.setAttribute('role', 'dialog'); veil.setAttribute('aria-modal', 'true'); veil.setAttribute('aria-label', title);
  const box = h('div', 'st-rs-box');
  const t = h('h2', 'st-rs-t'); const tb = h('bdi', null, title); tb.dir = 'auto'; t.append(tb);
  box.append(h('div', 'st-rs-grab'), t, ...body.filter(Boolean));
  veil.append(box);
  veil.addEventListener('click', (e) => { if (e.target === veil) rsClose(); });
  document.body.append(veil);
  return box;
}
function vlMenu(x) {
  const act = (k, icn, label, fn, danger) => { const b = btn('st-row st-ric' + (danger ? ' st-vl-danger' : ''), null, () => { rsClose(); fn(); }, 'vla:' + k); b.append(tile(icn, danger ? 'red' : 'gray'), rowTxt(label, '')); return b; };
  vlSheet(x.folder ? x.name : fileTitle(x.name), [list(
    !x.folder && x.url ? act('open', 'out', T('studioVidsOpen'), () => window.open(x.url, '_blank', 'noopener')) : null,
    act('ren', 'edit', T('studioVidsRename'), () => vlName(x)),
    act('mv', 'folder', T('studioVidsMove'), () => { vl.mv = { id: x.id, name: x.folder ? x.name : fileTitle(x.name), parent: x.parent || (vlTop() && vlTop().id) || '' }; vl.path = vl.path.slice(0, 1); vl.q = ''; vlLoad(); }),
    act('del', 'trash', T('studioVidsDel'), () => vlDel(x), true))]);
}
export const vlCleanName = (s) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>"\\/:*?|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
/* שם — לתיקייה חדשה (x = null) או לשינוי שם (הסיומת של קובץ נשארת) */
function vlName(x) {
  const inp = h('input', 'st-in st-ask-in'); inp.type = 'text'; inp.maxLength = 120; inp.autocomplete = 'off'; inp.dir = 'auto';
  inp.value = x ? (x.folder ? x.name : fileTitle(x.name)) : ''; inp.placeholder = T('studioVidsNameP'); inp.dataset.k = 'vl-name';
  const ext = x && !x.folder ? (/(\.[A-Za-z0-9]{2,5}(?:\.[A-Za-z0-9]{2,5})?)$/.exec(x.name) || [])[1] || '' : '';
  const ok = btn('st-btn wide', x ? T('studioVidsSave') : T('studioVidsCreate'), async () => {
    const n = vlCleanName(inp.value);
    if (!n) { inp.focus(); return; }
    rsClose();
    try {
      if (x) { if (n + ext !== x.name) await net.driveRename(x.id, n + ext); }
      else await net.vidsFolder(vlTop().id, n);
      vlLoad();
    } catch (e) { flashSafe(T('studioVidsErr')); }
  }, 'vl-name-ok');
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok.click(); } });
  vlSheet(x ? T('studioVidsRename') : T('studioVidsNew'), [inp, ok]);
  try { inp.focus(); if (x) inp.select(); } catch (e) {}
}
function vlDel(x) {
  const go2 = async () => { try { await net.driveTrash(x.id); vl.items = vl.items.filter((y) => y.id !== x.id); vlPaint(); flashSafe(T('studioVidsDelDone')); } catch (e) { flashSafe(T('studioVidsErr')); } };
  if (typeof askConfirm === 'function') askConfirm(x.folder ? T('studioVidsDelQF', { n: x.name }) : T('studioVidsDelQ', { n: fileTitle(x.name) }), go2, { danger: true, ok: T('studioVidsDel') });
  else go2();
}
async function vlMoveHere() {
  const m = vl.mv, top = vlTop();
  if (!m || !top || vl.busy) return;
  if (m.parent === top.id) { vl.mv = null; vlLoad(); return; }
  vl.busy = true; vlPaint();
  try { await net.driveMoveTo(m.id, m.parent, top.id); vl.mv = null; flashSafe(T('studioVidsMoved', { n: top.n })); }
  catch (e) { flashSafe(T('studioVidsErr')); }
  vl.busy = false; vlLoad();
}
/* השמירה עצמה: עבודה שלמה — תיקייה לכל סרטון (בשם שלו) בתוך התיקייה שבחרת; תוצר אחד — ישר לתיקייה */
async function vlSaveHere(a) {
  const top = vlTop();
  if (!top || vl.busy || !a) return;
  const rec = a.rec, outs = (rec.srv && rec.srv.out) || [];
  const items = a.k === 'O' ? [a.o] : outs.filter((o) => DX_MOVE.includes(o.k)).concat(outs.filter((o) => o.k === 'srt'));
  if (!items.length) return;
  let dest = { id: top.id, name: top.n || T('studioVidsT') };
  vl.busy = true; vlPaint();
  try {
    if (a.k === 'S') { const f = await net.vidsSub(top.id, vlCleanName(fileTitle(rec.spec.name)) || 'video'); dest = { id: f.id, name: f.name }; }
  } catch (e) { vl.busy = false; vlPaint(); flashSafe(T('studioVidsErr')); return; }
  vl.busy = false;
  back();
  dxStart(rec, dest, items);
}
/* ההעברה: בשרת (R2 → Drive, עבודת dx — אפשר לסגור את האפליקציה), או בתוך Drive (עבודה של Routine) */
let dxBusy = '';
async function dxStart(rec, dest, items) {
  if (dxBusy === rec.id || (rec.up.dx && rec.up.dx.st === 'run')) return;
  if (items.every((o) => isR2Id(o.id))) {
    dxBusy = rec.id; repaint();
    try {
      const j = await net.api('dxRun', { job: rec.id, dx: { f: dest.id, n: dest.name, it: items.map((o) => ({ id: o.id, n: outDlName(rec, o) })) } });
      if (!j.ok || !j.job) { flashSafe(j.error === 'dx_busy' ? T('studioDxBusy') : j.error === 'dx_folder' ? T('studioVidsErr') : errText(j.error)); return; }
      const k = await startSub(j.job.id);
      if (!k.ok) { flashSafe(errText(k.error)); return; }
      rec.up.dx = { f: dest.id, n: dest.name.slice(0, 120), at: 0, j: j.job.id, st: 'run', p: 0, e: '' };
      save(); uxAdd(rec, 'o', 'dx'); dxKick();
    } finally { dxBusy = ''; repaint(); }
    return;
  }
  dxBusy = rec.id; repaint();
  try {   // Routine: הקבצים כבר ב־Drive — הסרטונים עוברים (בלי עותק), הכתוביות מועתקות (העורך וסט הזהב קוראים מהעותק בתיקיית העבודה)
    const folder = jobFolder(rec), from = rec.up.dx && rec.up.dx.mv ? rec.up.dx.f : folder;
    let mv = 0;
    for (const o of items) {
      if (isR2Id(o.id)) await net.r2ToDrive(o.id, dest.id, outDlName(rec, o));
      else if (DX_MOVE.includes(o.k) && from) { await net.driveMove(o.id, from, dest.id); mv = 1; }
      else await net.driveCopy(o.id, dest.id, outDlName(rec, o));
    }
    rec.up.dx = { f: dest.id, n: dest.name.slice(0, 120), at: Date.now(), j: '', st: 'ok', p: 1, e: '', mv };
    save(); uxAdd(rec, 'o', 'dx');
    flashSafe(T('studioDxDone', { n: dest.name }));
  } catch (e) { flashSafe(T('studioDxErr')); }
  finally { dxBusy = ''; repaint(); }
}
/* מעקב אחרי שמירה בשרת — גם כשהדף של העבודה לא פתוח (כל 4 שנ׳ כל עוד משהו רץ) */
let dxT = 0;
function dxKick() { clearTimeout(dxT); dxT = setTimeout(dxTick, 4000); }
async function dxTick() {
  dxT = 0;
  const run = store.jobs.filter((r) => r.up.dx && r.up.dx.st === 'run' && JOB_RE.test(String(r.up.dx.j || '')));
  if (!run.length || !root) return;
  if (document.hidden) { dxKick(); return; }
  for (const r of run) {
    const x = await net.api('job', { job: r.up.dx.j });
    const d = r.up.dx;
    if (!x.ok || !x.job) { if (x.error === 'not_found') { d.st = 'err'; d.e = 'gone'; } continue; }
    const s = String(x.job.state || '');
    if (s === 'done') { d.st = 'ok'; d.at = Date.now(); d.p = 1; flashSafe(T('studioDxDone', { n: d.n })); }
    else if (s === 'failed' || s === 'cancelled') { d.st = 'err'; d.e = String(x.job.err || 'failed').slice(0, 40); flashSafe(T('studioDxFail')); }
    else d.p = Math.max(0, Math.min(1, +(x.job.prog && x.job.prog.p) || 0));
  }
  save(); repaint();
  dxKick();
}
/* השורה בדף העבודה */
function dxRow(rec) {
  const d = rec.up.dx, run = dxBusy === rec.id || (d && d.st === 'run');
  const sub = run ? (d && d.st === 'run' ? T('studioDxSrv', { p: Math.round((d.p || 0) * 100) }) : T('studioDxBusy'))
    : d && d.st === 'err' ? T('studioDxFail') : d ? T('studioDxDone', { n: d.n }) : T('studioDxSub');
  return rowNav({ tile: tile('cloud', 'green'), label: T('studioDxT'), sub, onClick: () => (run ? null : d && d.st === 'ok' ? goVids('F:' + d.f) : goVids('S:' + rec.id)), k: 'dx' });
}
function pageVids(p) {
  const a = vlAct(), x = vlParse(ui.param);
  if (x && x.k !== 'F' && !a) { back(); return; }
  const picking = !!a || !!vl.mv, top = vlTop();
  const inSub = vl.path.length > 1;
  const title = inSub && !picking ? top.n : '';
  const cancel = vl.mv ? btn('st-txt', T('studioCancel'), () => { vl.mv = null; vlLoad(); }, 'vl-mv-x') : null;
  const jr = x ? jobRec(x.k === 'F' ? (store.jobs.find((r) => r.up.dx && r.up.dx.f === x.id) || {}).id : x.id) : null;
  p.append(navBar({ back: jr ? fileTitle(jr.spec.name) || T('studioUntitled') : T('studioStoreT'), title, end: cancel }));
  if (picking) p.append(large(vl.mv ? T('studioVidsMoveT') : T('studioDxPickT')));
  else if (!inSub) p.append(large(T('studioVidsT')));
  if (!driveOk()) { p.append(h('div', 'st-empty st-empty-sm', T('studioDriveNoCfg'))); return; }
  if (!store.drive || !store.drive.connected || vl.st === 'conn') {
    const c = h('div', 'st-dp-conn');
    const ic = h('span', 'st-dp-ic'); ic.append(ico('cloud'));
    c.append(ic, h('b', null, T('studioVidsConnT')), h('p', null, T('studioVidsConnS')));
    const b = btn('st-btn wide', ui.driveBusy ? T('studioDriveBusy') : T('studioDriveConnect'), () => { vl.st = ''; connectDrive(); }, 'vl-conn');
    b.disabled = !!ui.driveBusy || blocked();
    p.append(c, b);
    return;
  }
  if (vl.st === '') { vl.st = 'load'; setTimeout(() => vlLoad(), 0); }   // לא בתוך הציור
  if (!picking) {   // חיפוש בשם בכל "הסרטונים שלי" — בלי לבנות את הדף מחדש בכל הקשה
    const sq = h('input', 'st-in st-dp-q'); sq.type = 'search'; sq.placeholder = T('studioVidsSearch'); sq.value = vl.q; sq.dataset.k = 'vl-q';
    sq.setAttribute('aria-label', T('studioVidsSearch')); sq.autocomplete = 'off'; sq.spellcheck = false;
    let tmr = 0;
    sq.addEventListener('input', () => { clearTimeout(tmr); tmr = setTimeout(() => { if (vl.q !== sq.value) { vl.q = sq.value; vlLoad(); } }, 350); });
    p.append(sq);
  }
  if (inSub && !vl.q.trim()) {
    const up = btn('st-dp-up', null, () => vlUp(), 'vl-up');
    up.append(ico('back'), h('bdi', null, vl.path[vl.path.length - 2].n || T('studioVidsT')));
    p.append(up);
  }
  if (a) p.append(note(a.k === 'S' ? T('studioVidsSaveN') : T('studioVidsSave1N', { n: outShort(a.o.k) })));
  else if (vl.mv) p.append(note(T('studioVidsMoveN', { n: vl.mv.name })));
  if (vl.st === 'err' && !vl.items.length) {
    p.append(h('div', 'st-empty st-empty-sm', errText(vl.err)), btn('st-btn tint wide', T('studioGlRetry'), () => vlLoad(), 'vl-retry'));
  } else {
    const shown = picking ? vl.items.filter((y) => y.folder) : vl.items;   // בבחירת מקום — רק תיקיות
    const rows = [];
    if (!vl.q.trim() && vl.st === 'ok') { const nb = btn('st-row st-ric', null, () => vlName(null), 'vl-new'); nb.append(tile('plus', 'blue'), rowTxt(T('studioVidsNew'), '')); rows.push(nb); }   // פעולה, לא מעבר — בלי חץ
    rows.push(...shown.map((y) => vlRow(y, picking)));
    if (rows.length) p.append(list(...rows));
    if (!shown.length) {
      if (vl.busy) { const ld = h('div', 'st-lk-ld'); ld.append(h('span', 'st-spin'), h('span', null, T('studioDpLoading'))); p.append(ld); }
      else if (!picking) p.append(h('div', 'st-empty st-empty-sm', vl.q.trim() ? T('studioDpNone') : T('studioVidsEmpty')));
    }
    if (vl.next) {
      const more = btn('st-btn tint wide', vl.busy ? T('studioDpLoading') : T('studioDpMore'), () => vlLoad(true), 'vl-more');
      more.disabled = vl.busy;
      p.append(h('div', 'st-gap sm'), more);
    }
  }
  if (picking && top) {
    const foot = h('div', 'st-foot');
    const go1 = btn('st-btn wide', vl.busy ? T('studioDriveBusy') : vl.mv ? T('studioVidsMoveHere') : T('studioVidsSaveHere'), () => (vl.mv ? vlMoveHere() : vlSaveHere(a)), 'vl-here');
    go1.disabled = vl.busy || vl.st !== 'ok';
    const where = h('small', 'st-vl-where'); const wb = h('bdi', null, top.n || T('studioVidsT')); wb.dir = 'auto'; where.append(wb);
    foot.append(where, go1);
    p.append(foot);
  }
}

function pageLang(p) {
  const which = ui.param;
  const def = which === 'def';
  const target = def ? store.settings : form;
  if (!target || (which !== 'from' && which !== 'to' && !def)) { back(); return; }
  const multi = which !== 'from';
  p.append(navBar({ back: def ? T('studioDefsT') : (form.id ? T('studioEditT') : T('studioNew')) }),
    large(multi ? T('studioTo') : T('studioFrom')));
  const ul = uiLang();
  const sub = (c) => { const n = nativeName(c); return n !== langName(c, ul) ? n : null; };
  const rows = [];
  if (!multi) {
    rows.push(rowRadio({ label: T('studioAuto'), on: target.from === 'auto', onClick: () => { target.from = 'auto'; back(); }, k: 'l:auto' }));
    for (const c of SOURCE_LANGS) {
      const off = !LANG_READY.from.includes(c);
      rows.push(rowRadio({ label: langName(c, ul), sub: sub(c), on: target.from === c, disabled: off, badge: off ? T('studioSoon') : null, onClick: () => { target.from = c; back(); }, k: 'l:' + c }));
    }
  } else {
    for (const c of TARGET_LANGS) {
      const off = !LANG_READY.to.includes(c) && !target.to.includes(c);   // שנבחרה פעם — אפשר רק להסיר
      rows.push(rowCheck({ label: langName(c, ul), sub: sub(c), on: target.to.includes(c), disabled: off, badge: off ? T('studioSoon') : null, onClick: () => toggleLang(target, c, def), k: 'l:' + c }));
    }
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
/* סבב 10: העתק־הדבק — "העתקת הבקשה" → מדביקים בשיחה עם Claude → מדביקים כאן את התשובה → העבודה ממשיכה.
   הבקשה והתשובה = קבצים בתיקיית העבודה; כאן רק הטקסט שהדבקת עד השליחה (לא נשמר) */
let cpBusy = false;
async function cpCopy(rec) {
  const cp = rec.srv.cp;
  try {
    const t = await net.driveText(cp.f);
    await navigator.clipboard.writeText(t);
    flashSafe(T('studioCpCopied'));
  } catch (e) { flashSafe(T('studioCpCopyErr')); }
}
async function cpSend(rec) {
  const cp = rec.srv.cp, txt = String(ui.cpDraft || '').trim();
  if (!txt) { flashSafe(T('studioCpEmpty')); return; }
  if (txt.length > CP_TEXT_MAX) { flashSafe(T('studioCpBig')); return; }
  cpBusy = true; repaint();
  try {
    const fid = await net.textUpload(jobFolder(rec), T('studioCpAnsName', { n: cp.n }) + '.txt', 'text/plain', txt, { snbCp: 'a' });
    const j = await net.api('cpAnswer', { job: rec.id, n: cp.n, f: fid });
    if (j.job) rec.srv = normJob({ id: rec.id, srv: j.job }).srv;
    if (!j.ok) flashSafe(j.error === 'cp_seq' ? T('studioCpSeq') : errText(j.error));
    else { ui.cpDraft = ''; save(); flashSafe(T('studioCpSent')); }
  } catch (e) { flashSafe(errText((e && e.code) || 'drive')); }
  finally { cpBusy = false; repaint(); }
}
function cpCard(rec) {
  const cp = rec.srv && rec.srv.cp;
  if (!cp || FINAL.includes(rec.srv.state)) return null;
  const c = h('div', 'st-ask' + (cp.a ? ' done' : ''));
  c.dataset.k = 'cp';
  c.append(h('b', null, cp.a ? T('studioCpDone', { n: cp.n }) : T('studioCpT', { n: cp.n })));
  if (cp.a) return c;   // נשלחה — שורה אחת; הבקשה הבאה (אם תהיה) תחליף אותה
  c.append(h('p', null, cpStep(cp.r)));
  const row = h('div', 'st-ntb');
  const cb = btn('st-btn tint', T('studioCpCopy'), () => cpCopy(rec), 'cp-copy');
  const ob = h('a', 'st-btn ghost'); ob.href = 'https://claude.ai/new'; ob.target = '_blank'; ob.rel = 'noopener noreferrer'; ob.textContent = T('studioCpOpen'); ob.dataset.k = 'cp-open';
  row.append(cb, ob);
  const ta = h('textarea', 'st-in st-ask-in'); ta.rows = 4; ta.dir = 'auto'; ta.dataset.k = 'cp-t';
  ta.placeholder = T('studioCpPh'); ta.setAttribute('aria-label', T('studioCpPh')); ta.value = ui.cpDraft || '';
  ta.addEventListener('input', () => { ui.cpDraft = ta.value; });
  const send = btn('st-btn wide in-card', cpBusy ? T('studioNtSending') : T('studioCpSend'), () => cpSend(rec), 'cp-send');
  if (cpBusy || blocked()) send.disabled = true;
  c.append(row, ta, send);
  return c;
}
function cpStep(r) {   // מה הבקשה הזו — בשפה פשוטה
  switch (r) {
    case 'tl': return T('studioCpTl');
    case 'rv': return T('studioCpRv');
    default: return T('studioCpMain');
  }
}
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
  t.textContent = tw.sh ? T('studioShWarn') : (tw.lv === 'warn' ? T('studioTwWarn', { x: fmtX(tw.x) }) : T('studioTwOk', { x: fmtX(tw.x) }));   // v384: מצב צל
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
    case 'drive': return T('studioCmpStore');   // 11/10/2026: R2 או Drive — "אחסון"
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
    case 'claude:loop': return T('studioAlClaudeLoop');   // v384
    case 'claude:anomaly': return T('studioAlClaudeAnom');   // v385
    case 'drive:anomaly': return T('studioAlDriveAnom');
    case 'vt:anomaly': return T('studioAlVtAnom');
    case 'claude:sla_time': return T('studioAlSlaTime');   // v377
    case 'claude:sla_cost': return T('studioAlSlaCost');
    case 'server:down': return T('studioAlServerDown');   // ת7: הבדיקה המתוזמנת
    case 'server:auth': return T('studioAlServerAuth');   // 15/10: הטוקן נדחה
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
/* קו מגמה (13/10/2026, בקשת המשתמש: "יותר מגניב וחדשני, אבל נקי"): עקומה חלקה (Catmull-Rom), צבע שמתחזק לכיוון היום
   ונקודה זוהרת בקצה — בלי מילוי ובלי צירים. ציר הזמן משמאל לימין גם ב־RTL. tone: 'up' (לטובה, ירוק) / 'dn' (כתום) */
let sparkN = 0;
function spark(vals, tone) {
  const pts = vals.map((v, i) => [i, v]).filter((x) => x[1] != null);
  if (pts.length < 2) return null;
  const ys = pts.map((x) => x[1]), lo = Math.min(...ys), hi = Math.max(...ys), span = hi - lo || 1;
  const X = (i) => 2 + (i / Math.max(6, pts[pts.length - 1][0])) * 94, Y = (v) => 20 - ((v - lo) / span) * 16;
  const P = pts.map((x) => [X(x[0]), Y(x[1])]);
  let d = 'M' + P[0][0].toFixed(1) + ' ' + P[0][1].toFixed(1);
  for (let k = 0; k < P.length - 1; k++) {
    const a = P[k - 1] || P[k], b = P[k], c = P[k + 1], e = P[k + 2] || c;
    d += ' C' + (b[0] + (c[0] - a[0]) / 6).toFixed(1) + ' ' + (b[1] + (c[1] - a[1]) / 6).toFixed(1) + ' ' + (c[0] - (e[0] - b[0]) / 6).toFixed(1) + ' ' + (c[1] - (e[1] - b[1]) / 6).toFixed(1) + ' ' + c[0].toFixed(1) + ' ' + c[1].toFixed(1);
  }
  const NS = 'http://www.w3.org/2000/svg', id = 'stsp' + (++sparkN);
  const wrap = h('span', 'st-spark ' + (tone || 'up')); wrap.setAttribute('aria-hidden', 'true');
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 24'); svg.setAttribute('preserveAspectRatio', 'none');
  const defs = document.createElementNS(NS, 'defs'), g = document.createElementNS(NS, 'linearGradient');
  g.setAttribute('id', id); g.setAttribute('x1', '0'); g.setAttribute('x2', '1'); g.setAttribute('y1', '0'); g.setAttribute('y2', '0');
  for (const [o, op] of [['0', '.08'], ['.55', '.55'], ['1', '1']]) { const st = document.createElementNS(NS, 'stop'); st.setAttribute('offset', o); st.setAttribute('stop-color', 'currentColor'); st.setAttribute('stop-opacity', op); g.append(st); }
  defs.append(g);
  const line = document.createElementNS(NS, 'path'); line.setAttribute('d', d); line.setAttribute('stroke', 'url(#' + id + ')');
  svg.append(defs, line);
  const end = P[P.length - 1], dot = h('i');
  dot.style.insetInlineStart = end[0] + '%'; dot.style.top = (end[1] / 24 * 100) + '%';
  wrap.append(svg, dot);
  return wrap;
}
/* ציון יחיד בתוך כרטיס הציונים: תווית, ערך + השינוי מלפני שבוע באותה שורה (ירוק = לטובה), וקו מגמה */
function scoreTile(label, value, vals, betterUp, fmt) {
  const t = h('div', 'st-sc');
  const top = h('span', 'st-sch'); top.append(h('small', null, label));   // התווית, ובצד השני — השינוי (כך למספר יש את כל הרוחב)
  const ok = vals.filter((x) => x != null);
  let tone = 'up';
  if (ok.length >= 2) {
    const dlt = ok[ok.length - 1] - ok[0];
    const good = betterUp ? dlt >= 0 : dlt <= 0; tone = good ? 'up' : 'dn';
    if (Math.abs(dlt) >= 0.05) top.append(h('span', 'st-trd ' + tone, (dlt > 0 ? '▲' : '▼') + '\u2009' + fmt(Math.abs(dlt))));
  }
  t.append(top, h('b', 'st-scv', value));
  const sv = spark(vals, tone); if (sv) t.append(sv);
  return t;
}
function opsScores(o) {   // v369: שלושת הציונים עם מגמה לשבוע
  const t = o.trend || { score: [], avail: [], mttr: [] };
  const fmt1 = (v) => (Math.round(v * 10) / 10).toLocaleString(uiLang() === 'en' ? 'en-US' : 'he-IL', { maximumFractionDigits: 1 });
  const sc = h('div', 'st-scores');
  sc.dataset.k = 'ops-scores';
  sc.append(scoreTile(T('studioTwScore'), String(Math.round(o.score)), t.score, true, (v) => String(Math.round(v))),
    scoreTile(T('studioTwAvail'), fmtPct1(o.avail), t.avail, true, fmt1),
    scoreTile(T('studioOpsMttr'), o.mttr == null ? '—' : fmtShort(o.mttr * 60), t.mttr, false, (v) => String(Math.round(v))));
  return sc;
}
/* v368: התראות מושתקות — מקופלות, עם "בטל השתקה" */
function mutedBlock(o) {
  const det = h('details', 'st-details st-dig');
  if (ui.muOpen) det.open = true;
  det.addEventListener('toggle', () => { ui.muOpen = det.open; });
  det.append(h('summary', null, T('studioOpsMutedT', { n: o.mu.length })), list(...o.mu.map((m) => {
    const r = h('div', 'st-row st-ric st-muted');
    const l = h('span', 'st-l'); l.append(h('b', null, opsAlert(m.c, m.k)), h('small', null, T('studioMutedUntil', { t: fmtClock(m.until) })));
    r.append(h('i', 'st-sdot n'), l, btn('st-mini ghost', T('studioUnmute'), () => muteKind(m.c, m.k, 0), 'unmute:' + m.c + m.k));
    return r;
  })));
  return det;
}
/* מפת השירות — לפי סדר השרשרת; רכיב עם התראה פתוחה מסומן בצבע החומרה */
function serviceMapEl(o) {
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
  return map;
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
/* התראה בסיכום של המגדל (13/10/2026, בקשת המשתמש — נקי ומינימליסטי): נקודה בצבע החומרה, מה קרה, ושורה אחת של פרטים.
   המספר, גלולת החומרה והפס בצד — רק ברשימה המלאה (alertRow) */
function alertMini(a) {
  const r = btn('st-row st-ric st-am', null, () => { ui.alTab = 'd'; ui.muPick = 0; go('alert', a.no); }, 'al:' + a.no);
  const l = h('span', 'st-l');
  const sub = h('small'); sub.append(h('bdi', null, opsComp(a.c)), ' · ' + opsAgo(a.l) + ' · ' + (a.n === 1 ? T('studioOpsEvent1') : T('studioOpsEvents', { n: a.n })));
  l.append(h('b', null, opsAlert(a.c, a.k)), sub);
  const d = h('i', 'st-am-d ' + SEV_CLS[a.s]); d.title = sevName(a.s);
  r.append(d, l, ico('chev', 'st-chev'));
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
  p.append(navBar({ back: T('studioTwAlertsT'), title: alrNo(no) }));
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
    const b = btn('st-seg-b' + (tab === k ? ' on' : ''), lbl, () => stTab('alTab', k), 'altab:' + k);
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
/* כותרת קצרה לפי הקוד (errText הוא הוראה ארוכה — לא כותרת) */
function incTitle(e) {
  switch (e) {
    case 'no_claim': return T('studioIncNoClaim');
    case 'routine_auth': case 'routine_forbidden': case 'routine_missing': case 'routine_paused': return T('studioIncRoutine');
    case 'routine_rate': return T('studioIncRate');
    case 'no_server': case 'job_timeout': case 'worker_unknown_kind': case 'worker_oom': case 'worker_crash': case 'worker_lost': return T('studioIncServer');
    case 'month_cap': return T('studioIncMonth');
    case 'tower_stop': return T('studioIncTower');
    case 'budget_stop': case 'budget_cap': return T('studioIncBudget');
    case 'api_quota': return T('studioIncApiQuota');
    case 'sub_limit': return T('studioIncSubLimit');
    case 'api_auth': case 'api_model': case 'no_api_key': return T('studioIncApiKey');
    case 'api_network': case 'api_timeout': case 'api_rate': case 'api_overloaded': return T('studioIncApiNet');
    case 'stale': return T('studioIncStale');
    case 'net': case 'drive': case 'drive_net': case 'store_net': return T('studioIncNet');
    case 'store_fail': return T('studioErrStoreFail');   // 11/10/2026
    case 'upload_timeout': return T('studioIncUpload');
    case 'ph_meta': return T('studioErrPhMeta');
    case 'ph_words': return T('studioErrPhWords');
    case 'lang_unsupported': return T('studioIncLang');
    case 'ka_lyrics': return T('studioKaNeedLyr');
    case 'ka_noaudio': return T('studioKaNoAudio');
    case 'max_tokens': return T('studioIncMaxTok');
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
    case 'code': return T('studioRcCode', { t: incTitle(x.e) });   // 11/10/2026: קוד שמסביר את עצמו (למשל max_tokens)
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
  p.append(navBar({ back: T('studioTwAlertsT'), title: incNo(no) }));
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
    const b = btn('st-seg-b' + (tab === k ? ' on' : ''), lbl, () => stTab('incTab', k), 'inctab:' + k);
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
function recText(r) {
  const a = r.a ? agentName(r.a) : '';
  switch (r.k) {
    case 'drop': return T('studioRecDrop', { a, from: r.from, to: r.to });
    case 'new': return r.n === 1 ? T('studioRecNew1', { a }) : T('studioRecNew', { a, n: r.n });
    case 'tool': return r.n === 1 ? T('studioRecTool1', { a }) : T('studioRecTool', { a, n: r.n });
    case 'valid': return T('studioRecValid', { a, n: r.n });
    case 'cmp': return T('studioRecCmp', { a, n: r.n });
    default: return r.n === 1 ? T('studioRecShadow1') : T('studioRecShadow', { n: r.n });
  }
}
function riskName(r) {
  switch (r) {
    case 'inj': return T('studioRiskInj');
    case 'cost': return T('studioRiskCost');
    default: return T('studioRiskLoop');
  }
}
function riskCtl(r) {
  switch (r) {
    case 'inj': return T('studioRiskInjC');
    case 'cost': return T('studioRiskCostC');
    default: return T('studioRiskLoopC');
  }
}
const RISK_ST = { w: 'h', m: 'w', s: 'g' };
function riskSt(st) { return st === 's' ? T('studioRiskS') : st === 'm' ? T('studioRiskM') : T('studioRiskW'); }
const pctOr = (v) => (v == null ? '—' : ltr(v + '%'));
function pageAgents(p) {
  const ag = ui.ag;
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioAgT')), h('p', 'st-lede', ag ? T('studioAgLede', { n: ag.jobs }) : T('studioAgNone')));
  // v386: מומלץ לפעולה — בראש
  const recs = ag ? agentRecs(ag, ui.sh) : [];
  if (recs.length) p.append(secT(T('studioRecT')), list(...recs.map((r, i) => {
    const row = h('div', 'st-row st-ric');
    row.dataset.k = 'rec:' + i;
    row.append(tile(r.k === 'shadow' ? 'shield' : 'alert', r.k === 'drop' || r.k === 'valid' || r.k === 'cmp' ? 'orange' : 'blue'), rowTxt(recText(r)));
    return row;
  })));
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
      kv(T('studioAgTime'), a.s >= 60 ? fmtShort(a.s) : '—'), kv(T('studioEvSc'), a.sc == null ? '—' : ltr(String(a.sc))));   // v386: גרסת ההנחיות — במחזור החיים למטה
    if (a.k !== 'main') g.append(kv(T('studioQT'), a.q == null ? '—' : ltr(String(a.q))));   // v374: איכות ממוצעת של הכתוביות
    card.append(head, g);
    if (a.sc != null) card.append(h('p', 'st-evl', T('studioEvLine', { c: pctOr(a.c), t: pctOr(a.t), v: pctOr(a.v) })));   // v386: שלמות · כלי נכון · קריאות תקינות
    p.append(card);
  }
  // v386: מחזור החיים של ההנחיות — לכל סוכן: הגרסה הפעילה והקודמות, עם הציון של כל אחת
  const life = ag ? ag.agents.filter((a) => a.vs.length) : [];
  if (life.length) {
    const rows = [];
    for (const a of life) a.vs.forEach((v, i) => {
      const r = h('div', 'st-row st-ric');
      r.dataset.k = 'pv:' + a.k + ':' + v.p;
      const sub = h('small');
      sub.append(h('bdi', 'st-mono', v.p), ' · ' + T('studioAgJobs', { n: v.jobs }) + ' · ' + opsAgo(v.at));
      const l = h('span', 'st-l'); l.append(h('b', null, agentName(a.k)), sub);
      const val = h('span', 'st-v'); val.append(v.sc == null ? '—' : ltr(String(v.sc)));
      r.append(agentTile(a.k), l, pill(i ? 'i' : 'g', i ? T('studioPvOld') : T('studioPvLive')), val);
      rows.push(r);
    });
    p.append(secT(T('studioPvT')), list(...rows), note(T('studioPvNote')));
  }
  p.append(...goldSection());   // v387: סט הזהב
  // v386: סיכון מול בקרה — מה מגן מכל סיכון, כמה חזק, וכמה פעמים פעל
  if (ag && ag.risk.length) p.append(secT(T('studioRiskT')), list(...ag.risk.map((x) => {
    const r = h('div', 'st-row');
    r.dataset.k = 'risk:' + x.r;
    const val = h('span', 'st-v'); val.append(ltr(String(x.n)));
    r.append(rowTxt(riskName(x.r), riskCtl(x.r)), pill(RISK_ST[x.st], riskSt(x.st)), val);
    return r;
  })), note(T('studioRiskNote')));
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
/* 14/10/2026: מחיקת רשומה מספר התיקונים — באישור (הרסני); אחרי המחיקה חוזרים לרשימת הבעיות */
function delFix(fp) {
  if (fixBusy) return;
  askConfirm(T('studioFbDelQ'), async () => {
    fixBusy = true;
    try {
      const j = await net.api('fbDel', { fp });
      const fb = normFb(j.fb); if (fb) ui.fb = fb;
      flashSafe(j.ok ? T('studioFbDeleted') : errText(j.error));
      if (j.ok && ui.pb) ui.pb = Object.assign({}, ui.pb, { list: ui.pb.list.filter((y) => y.fp !== fp) });
    } finally { fixBusy = false; render('none'); }
    refreshJobs(true);
  }, { danger: true, ok: T('studioFbDelOk') });
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
/* 21/10/2026 (דיווח המשתמש: "29 דק׳" עמד, וקפץ ל־4 דקות יותר רק אחרי יציאה וכניסה): הזמן שעבר ממשיך לרוץ בין
   העדכונים מהשרתון — לא כשהשעון עוצר (מחכים לך) או כשהעבודה הסתיימה; לכל היותר 10 דק׳ קדימה מהעדכון האחרון */
export function slaLiveT(sla, now, running) {
  const t = sla.t;
  const add = running && !t.paused && sla.at ? Math.max(0, Math.min(600, (now - sla.at) / 1000)) : 0;
  const el = Math.round(t.el + add);
  return { el, f: t.tg > 0 ? el / t.tg : t.f };
}
/* 21/10/2026: "מאז ההתחלה 47 דק׳ · 25 מהן חיכינו לך או לסרטון" — מהיצירה עד הסוף (או עכשיו), מול שעון היעד */
export function slaWall(r, now) {
  const s = r && r.srv && r.srv.sla;
  if (!s || !(r.created > 0)) return '';
  const end = r.srv.ended > 0 && r.srv.state !== 'running' && r.srv.state !== 'queued' ? r.srv.ended : now;
  const wall = Math.max(0, Math.round((end - r.created) / 1000));
  const el = slaLiveT(s, now, r.srv.state === 'running').el;
  const wait = Math.max(0, wall - el);
  const head = T('studioSlaWall', { t: fmtShort(wall) });
  if (s.t.paused) return head + ' · ' + T('studioSlaWaitNow');
  return wait >= 60 ? head + ' · ' + T('studioSlaWaitOf', { t: fmtShort(wait) }) : head;
}
function slaCard(rec) {
  const id = rec.id, cur = () => { const r = jobRec(id); return r && r.srv && r.srv.sla ? r : null; };
  const sla = rec.srv.sla, t = sla.t;
  // השורות מתעדכנות במקום (live) — בכל טיק ובכל עדכון מהשרתון, בלי לבנות את הדף מחדש
  const paint = (row, val, f, lv) => {
    const v = row.querySelector('small'); if (v) v.replaceChildren(val);
    const i = row.querySelector('.st-slabar i'); if (i) i.style.width = Math.round(Math.min(1, f) * 100) + '%';
    const b = row.querySelector('.st-slabar'); if (b) b.className = 'st-slabar ' + SLA_CLS[lv];
    const pl = row.lastElementChild; if (pl && pl.dataset.lv !== lv) { const n = pill(SLA_CLS[lv], slaLvName(lv)); n.dataset.lv = lv; row.replaceChild(n, pl); }
  };
  const tRow = slaRow(T('studioSlaTime'), '', t.f, t.lv, 'sla:t');
  const rows = [live(tRow, (row) => {
    const r = cur(); if (!r) return;
    const s = r.srv.sla, x = slaLiveT(s, Date.now(), r.srv.state === 'running');
    // 30/10/2026 (בקשת המשתמש): הצפי לסוף ליד היעד — אותו צפי שבמרכז הניהול; לא פחות מהזמן שכבר עבר
    const fc = s.fc && r.srv.state === 'running' ? ' · ' + T('studioSlaFc') + ' ' + approx(fmtShort(Math.max(s.fc.t, x.el))) : '';
    paint(row, T('studioSlaOf', { a: fmtShort(x.el), b: approx(fmtShort(s.t.tg)) }) + fc, x.f, s.t.lv);
  })];
  if (sla.u && !rec.spec.ka) {   // 31/10/2026: קריוקי — בלי Claude, בלי תקציב
    rows.push(live(slaRow(T('studioSlaCost'), '', sla.u.f, sla.u.lv, 'sla:u'), (row) => {
      const r = cur(); if (!r || !r.srv.sla.u) return;
      const u = r.srv.sla.u, v = h('span');
      v.append(usdEl(u.sp), ' ' + T('studioSlaOfU') + ' ', approx(fmtUsd(u.tg)));
      const fc = r.srv.sla.fc;
      if (fc && fc.u != null && r.srv.state === 'running') {
        v.append(' · ' + T('studioSlaFc') + ' ', approx(fmtUsd(Math.max(fc.u, u.sp))));
        if (fc.k) v.append(' · ' + T('studioSlaFcTok', { n: approx(fmtTok(fc.k)) }));   // 30/10/2026: גם צפי הטוקנים
      }
      paint(row, v, u.f, u.lv);
    }));
  }
  const out = [secT(T('studioSlaT')), list(...rows)];
  // 21/10/2026 (המשתמש: "נוצר ב־12:00 ועברו 14 דקות?"): גם הזמן מאז ההתחלה — וכמה ממנו השעון עצר
  const wn = note('');
  out.push(live(wn, (el) => {
    const r = cur(); if (!r) return;
    const w = slaWall(r, Date.now());
    if (w) el.textContent = w;
  }));
  return out;
}
/* v383: תקציב שגיאות — שורה במגדל (כמה נשאר) → דף slo */
const SLO_TILE = { ok: 'green', warn: 'orange', fast: 'orange', out: 'red', few: 'blue' };
function sloSub(sl) { return sl.st === 'few' ? T('studioSloFew', { g: sl.good, n: sl.n, m: sl.min }) : T('studioSloAtt', { a: fmtNum(sl.att), t: sl.t }); }
function sloRows() {   // אמינות (תקציב שגיאות) וחריגות — שורות לקבוצה "מצב השירות" במגדל
  const sl = ui.slo, an = ui.an;
  const rows = [];
  if (sl && sl.n) rows.push(rowNav({ tile: tile('shield', SLO_TILE[sl.st]), label: T('studioSloT'), sub: sloSub(sl),
    value: sl.st === 'few' ? '' : sl.st === 'out' ? T('studioSloOut') : ltr(sl.left + '%'), onClick: () => go('slo'), k: 'tower-slo' }));
  // v385: ציון חריגה — מה חריג בהתמדה (לא קפיצה בודדת)
  if (an && an.n) {
    const act = an.m.filter((r) => r.p), top = an.m.length ? an.m[0] : null;
    rows.push(rowNav({ tile: tile('chart', act.length ? 'orange' : an.m.length ? 'green' : 'blue'), label: T('studioAnT'), sub: anSub(an),
      value: top ? ltr(fmtNum(top.s)) : '', onClick: () => go('anom'), k: 'tower-anom' }));
  }
  return rows;
}
/* v385: ציון חריגה */
function anSub(an) {
  const act = an.m.filter((r) => r.p);
  if (!an.m.length) return T('studioAnFew', { n: Math.max(1, an.min + 1 - an.n) });
  if (!act.length) return T('studioAnOk');
  return act.length === 1 ? T('studioAnAct1', { m: anName(act[0].k) }) : T('studioAnAct', { n: act.length });
}
function anName(k) {
  switch (k) {
    case 't:tr': return T('studioAnTr');
    case 't:al': return T('studioAnAl');
    case 't:tl': return T('studioAnTl');
    case 't:rv': return T('studioAnRv');
    case 't:bn': return T('studioAnBn');
    case 't:sv': return T('studioAnSv');
    case 'u:tl': return T('studioAnUTl');
    case 'u:rv': return T('studioAnURv');
    case 'u:jg': return T('studioAnUJg');
    default: return T('studioAnUMain');
  }
}
const anCls = (s, hi) => (s >= 8 ? 'c' : s >= hi ? 'h' : s >= 3 ? 'w' : 'g');
function anChip(s, hi, tr) {
  const c = pill(anCls(s, hi), '');
  c.append(ltr(fmtNum(s) + (tr === 'u' ? ' ▲' : tr === 'd' ? ' ▼' : '')));
  return c;
}
const anRatio = (v, med) => (med > 0 ? fmtNum(Math.round(v / med * 10) / 10) : '—');
/* בדף העבודה: השלבים שחרגו מהרגיל שלך, בערכים של העבודה הזו (זמן / עלות) */
function anJobRows(rec) {
  const an = ui.an, rows = an && an.j[rec.id];
  const dur = rec.spec && rec.spec.dur > 0 ? rec.spec.dur : 0;
  if (!rows || !dur) return [];
  const show = rows.filter((r) => r[1] >= 3);
  if (!show.length) return [];
  return [secT(T('studioAnJobT')), list(...show.map(([k, sc, v, med, ps0]) => {
    const r = h('div', 'st-row');
    r.dataset.k = 'an:' + k;
    const sub = h('span');
    // 11/10/2026: בזמן — v ו־med הם יחס לצפי (1 = כצפוי), לא שניות לדקה: × שניות השלב בתוכנית של העבודה = זמן אמיתי
    if (k[0] === 't') { const ps = ps0 || planFor(rec).s[k.slice(2)] || 0; sub.append(T('studioAnVsT', { a: fmtSecShort(v * ps), b: fmtSecShort(med * ps) })); }
    else { sub.append(usdEl(v * dur / 3600), ' · ' + T('studioAnVsU') + ' '); sub.append(usdEl(med * dur / 3600)); }
    const l = h('span', 'st-l'), sm = h('small'); sm.append(sub); l.append(h('b', null, anName(k)), sm);
    r.append(l, anChip(sc, an.hi));
    return r;
  })), note(T('studioAnJobNote'))];
}
function pageAnom(p) {
  const an = ui.an;
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioAnT')));
  if (!an || !an.n) { p.append(h('div', 'st-empty st-empty-sm', T('studioAnNone'))); return; }
  const act = an.m.filter((r) => r.p), top = an.m.length ? an.m[0] : null;
  const hero = h('div', 'st-schero');
  hero.append(h('b', 'st-schero-n' + (top ? ' t-' + (act.length ? 'orange' : 'green') : ''), top ? ltr(fmtNum(top.s)) : '—'),
    rowTxt(!an.m.length ? T('studioAnFewT') : act.length ? T('studioAnActT') : T('studioAnOkT'), anSub(an)));
  p.append(hero);
  // רק מה שמעל הרגיל; השאר — שורה אחת (מינימליזם)
  const up = an.m.filter((m) => m.s > 0 || m.p), rest = an.m.length - up.length;
  if (an.m.length) {
    p.append(secT(T('studioAnByM')), list(...up.map((m) => {
      const r = m.j && jobRec(m.j) ? btn('st-row st-ric', null, () => go('job', m.j), 'anm:' + m.k) : h('div', 'st-row st-ric');
      if (!r.dataset.k) r.dataset.k = 'anm:' + m.k;
      const sub = T('studioAnX', { x: anRatio(m.v, m.med) }) + (m.f ? ' · ' + T('studioAnFreq', { f: m.f, n: m.fn }) : '');
      r.append(tile(m.k[0] === 't' ? 'clock' : 'coin', m.p ? 'orange' : m.s >= 3 ? 'blue' : 'green'), rowTxt(anName(m.k), sub), anChip(m.s, an.hi, m.tr));
      return r;
    }), rest ? h('div', 'st-row st-muted', rest === 1 ? T('studioAnRest1') : T('studioAnRest', { n: rest })) : null));
  }
  p.append(note(T('studioAnNote')));
}
function sloCause(c) {
  switch (c) {
    case 'fail': return T('studioSloCFail');
    case 'stale': return T('studioSloCStale');
    default: return T('studioSloCResume');
  }
}
function pageSlo(p) {
  const sl = ui.slo;
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioSloT')));
  if (!sl || !sl.n) { p.append(h('div', 'st-empty st-empty-sm', T('studioSloNone'))); return; }
  // אותו כרטיס ציון של בדיקת המוכנות: המספר (כמה נשאר) ומשפט אחד
  const hero = h('div', 'st-schero');
  const col = { ok: 'green', warn: 'orange', fast: 'orange', out: 'red', few: '' }[sl.st];
  hero.append(h('b', 'st-schero-n' + (col ? ' t-' + col : ''), sl.st === 'few' ? '—' : ltr(sl.left + '%')),
    rowTxt(sl.st === 'few' ? T('studioSloFewT') : sl.st === 'out' ? T('studioSloOutT') : sl.st === 'fast' ? T('studioSloFastT') : T('studioSloLeftT'), sloSub(sl)));
  p.append(hero);
  const rows = [kvRow(T('studioSloN'), String(sl.n)), kvRow(T('studioSloGood'), String(sl.good)), kvRow(T('studioSloBad'), String(sl.bad))];
  if (sl.n7) rows.push(kvRow(T('studioSloBurn'), ltr('×' + fmtNum(sl.burn)), true));
  p.append(secT(T('studioSloWin')), list(...rows));
  if (sl.n7) p.append(note(sl.burn > 1 ? T('studioSloBurnHi') : T('studioSloBurnOk')));
  if (sl.list.length) {
    p.append(secT(T('studioSloUsed')), list(...sl.list.map((x) => {
      const rec = jobRec(x.j);
      const name = rec ? fileTitle(rec.spec.name) || T('studioUntitled') : T('studioSloGone');
      return rec ? rowNav({ tile: tile('film', x.c === 'resume' ? 'orange' : 'red'), label: name, sub: sloCause(x.c) + ' · ' + opsAgo(x.at), onClick: () => go('job', x.j), k: 'slo-j:' + x.j })
        : kvRow(name, sloCause(x.c));
    })));
  }
  p.append(note(T('studioSloNote')));
}
function valueRow() {
  const va = ui.va;
  if (!va || (!va.n && !va.bn)) return null;
  // הכותרת של המקטע כבר אומרת "ערך ועלות" — בשורה המספר עצמו (בלי כפילות)
  const r = btn('st-row st-ric', null, () => go('value'), 'tower-value');
  const l = h('span', 'st-l'), b = h('b');
  if (!va.n) b.append(T('studioVaNone'));
  else if (va.saved != null) { b.append(T('studioVaSavedK') + ' '); b.append(usdBig(Math.max(0, va.saved))); }
  else b.append(T('studioVaMinS', { n: fmtNum(va.min) }));
  l.append(b);
  if (va.n && va.saved != null) l.append(h('small', null, T('studioVaMinS', { n: fmtNum(va.min) })));
  r.append(tile('chart', 'green'), l, ico('chev', 'st-chev'));
  return r;
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
  // v383: "עברו 'המשך'" עבר לתקציב השגיאות (שם רואים גם אילו עבודות ולמה) — כאן רק ההמתנה לתשובה שלך
  if (va.ab.n) p.append(secT(T('studioVaAbT')), list(kvRow(T('studioVaAbQa'), String(va.ab.qa))));
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
function scanRow() {
  const sc = ui.sc;
  const sub = !sc ? T('studioScNever') : (sc.f.length ? scFindCount(sc.f.length) : T('studioScAllOk')) + ' · ' + opsAgo(sc.at);
  return rowNav({ tile: tile('shield', sc ? scColor(sc.s) : 'blue'), label: T('studioScT'), sub, value: sc ? String(sc.s) : '', onClick: () => go('scan'), k: 'tower-scan' });
}
function scCat(ch) {
  switch (ch) {
    case 'claude': case 'budget': return T('studioScCatSetup');
    case 'drive': case 'offsite': return T('studioScCatSec');
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
    case 'offsite': return T('studioScChOffsite');
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
    case 'offsite_none': return [T('studioScOffNone'), T('studioScFixOff')];   // 11/10/2026
    case 'offsite_stale': return [T('studioScOffStale', { d: x.d }), T('studioScFixOff')];
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
  const nav = x.k.startsWith('claude_') ? () => go('connect') : x.k === 'drive_missing' || x.k === 'drive_revoked' ? () => go('store') : x.k === 'budget_low' ? () => go('rlb') : null;
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
  p.append(navBar({ back: T('studioTwProbsT'), title: pbNo(no) }));
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
  p.append(h('div', 'st-gap sm'), btn('st-btn danger wide', T('studioFbDel'), () => delFix(x.fp), 'fbx:' + x.fp));
}
/* v363: מסך "מגדל הפיקוח" — מה קורה עכשיו, "הרגיל" שלך לכל מצב (נלמד מהעבודות שלך), מתי עוצרים, ועצירות אחרונות */
/* 13/10/2026 (בקשת המשתמש: "עמוד קצר יותר, אבל כמה שיותר מידע בקלות ובממשק נקי — לפי ת־עיצוב יודעים"): כמו "סיכום" ב־Health.
   למעלה מה שצריך לראות במבט: המשפט על המצב, שלושת הציונים, מה דורש תשומת לב (2 הראשונות) ופעולות מהירות; ואז שתי
   קבוצות של שורות (סמל, שם, הערך שלה, חץ) — "מצב השירות" ו"סוכנים ועלות" — וכל נושא בעמוד משנה משלו (התראות ותקלות,
   מפת השירות, בעיות ותיקונים, הרגיל ומתי עוצרים; השאר — העמודים שכבר היו). "עכשיו" — רק כשיש עבודה שרצה */
const TW_SUBS = ['alerts', 'smap', 'probs', 'norm'];
/* 15/10/2026 (בקשת המשתמש, תצוגה מקדימה שאושרה): מגדל הפיקוח של המשתמשים — מינימלי ובשפה פשוטה. רק מה שרלוונטי לו:
   משפט אחד על המצב, מה מחכה לו (שאלה / אישור), העבודות שדורשות תשומת לב, כמה זה עלה החודש, החוקים שלו ועצירה.
   כל הטכני (מפת השירות, ציונים, תקלות, סוכנים, בעיות, יעדי שירות, חריגות, בדיקת מוכנות, הרגיל והספים) — במגדל המלא
   (pageTowerFull, 'towerx'), שרק המנהל רואה, ובהמשך עובר למרכז הניהול. בלי כפילות: כל פריט כאן מוביל למקום שבו מטפלים בו */
function pageTower(p) {
  const tr = store.jobs.filter((r) => r.spec && (!r.kind || r.kind === 'tr'));
  const waits = tr.filter((r) => qaPending(r));
  const noEng = ui.access === 'ok' && !engReady();   // 15/10/2026: בלי חיבור ל־Claude — הכותרת לא אומרת "הכל עובד"
  const hero = h('div', 'st-ut-hero' + (waits.length || noEng ? ' wait' : ''));
  const hi = h('span', 'st-ut-hic'); hi.textContent = waits.length || noEng ? '!' : '✓';
  const ht = h('span', 'st-ut-ht');
  // 15/10/2026: משפט המשנה אומר מה קורה עכשיו — כמה רצות, או מתי הסתיימה האחרונה (במקום "אין שום דבר" קבוע)
  const nRun = tr.filter((r) => r.srv && (r.srv.state === 'running' || r.srv.state === 'queued')).length;
  const last = tr.find((r) => r.srv && r.srv.state === 'done' && r.srv.ended);
  ht.append(h('b', null, !waits.length && noEng ? T('studioUtNeedClaude') : !waits.length ? T('studioUtHello') : waits.length === 1 ? T('studioUtWait1') : T('studioUtWaitN', { n: waits.length })),
    h('small', null, waits.length ? T('studioUtWaitS') : noEng ? T('studioUtNeedClaudeS') : nRun ? (nRun === 1 ? T('studioUtRun1') : T('studioUtRunN', { n: nRun }))
      : last ? T('studioUtLast', { a: opsAgo(last.srv.ended) }) : T('studioUtHelloS')));
  hero.append(hi, ht);
  const dt = new Date();
  p.append(navBar({ back: T('studioBack'), title: T('studioTwT') }), large(T('studioTwT')),
    h('p', 'st-ut-date', dt.toLocaleDateString(uiLang() === 'en' ? 'en-US' : 'he-IL', { weekday: 'long', day: 'numeric', month: 'long' })));
  if (ui.access === 'ok') p.append(hero);   // לא מחובר — הבאנר שמתחת מסביר; בלי "הכל עובד" שסותר אותו
  const ab = accessBanner(); if (ab) p.append(ab);
  const hb = haltBanner(); if (hb) p.append(hb);
  // מחכה לך — שאלה או אישור, כפתור אחד שמוביל לעבודה (שם עונים)
  if (waits.length) p.append(secT(T('studioUtSecWait')), list(...waits.map((rec) => {
    const gate = !!(rec.srv.qa && rec.srv.qa.g);
    const r = h('div', 'st-row st-ut-row');
    const l = h('span', 'st-l'); const b = h('b'); b.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')));
    const q = h('small', null, gate ? (rec.srv.qa.g === 'b' ? T('studioUtGateB') : T('studioUtGateR')) : String(rec.srv.qa.q || '').slice(0, 90)); q.dir = 'auto';
    l.append(b, q);
    r.append(h('span', 'st-ut-dot wait'), l, btn('st-mini tint', gate ? T('studioUtApprove') : T('studioUtAnswer'), () => go('job', rec.id), 'ut-w:' + rec.id));
    return r;
  })));
  // העבודות שלך — רק מה שרץ או נעצר, והאחרונה שהסתיימה (הרשימה המלאה — בבית)
  const act = tr.filter((r) => !qaPending(r) && r.srv && (r.srv.state === 'running' || r.srv.state === 'queued' || canResume(r) || recovering(r)));
  const lastDone = tr.find((r) => r.srv && r.srv.state === 'done');
  const shown = act.slice(0, 4).concat(lastDone && act.length < 4 ? [lastDone] : []);
  if (shown.length) {
    const hd = h('div', 'st-sec-t st-sec-row'); hd.append(h('span', null, T('studioUtSecJobs')), btn('st-linkb', T('studioSeeAll'), () => go('home'), 'ut-all'));
    p.append(hd, list(...shown.map((rec) => {
      const r = btn('st-row st-ut-row', null, () => go('job', rec.id), 'ut-j:' + rec.id);
      const dot = h('span', 'st-ut-dot');
      const l = h('span', 'st-l'); const b = h('b'); b.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')));
      const sm = h('small'); const bar = h('span', 'st-ut-bar'); const bi = h('i'); bar.append(bi);
      l.append(b, sm, bar);
      const tail = h('span', 'st-ut-tail');
      r.append(dot, l, tail);
      live(r, () => {
        const ph = jobPhase(rec, runs.get(rec.id)), m = modelFor(rec);
        const run = ph === 'running' || ph === 'queued';
        const stop = canResume(rec) && !recovering(rec);
        dot.className = 'st-ut-dot ' + (run || ph === 'done' ? 'ok' : stop ? 'bad' : 'wait');
        sm.textContent = recovering(rec) ? T('studioBRecover') : run ? T('studioBRunning') + ' · ' + (m.bg ? T('studioNowBg') : T('studioLeftShort', { t: fmtLeft(shownLeft(rec, m)) }))
          : stop ? T('studioUtStopped') + (rec.srv.err ? ' — ' + errText(rec.srv.err) : '') : badgeFor(ph)[1];
        bar.hidden = !run; bi.style.width = Math.round(100 * (run ? shownPct(rec, m.pct, 'h') : m.pct || 0)) + '%';
        tail.replaceChildren(stop ? btn('st-mini ghost', T('studioUtResume'), () => go('job', rec.id), 'ut-r:' + rec.id) : ico('chev', 'st-chev'));
      });
      return r;
    })));
  }
  // החודש — כמה עלה (ומתוך כמה, כשיש תקציב חודשי במצב השרת) וכמה דקות תורגמו
  const va = ui.va;
  if (va && va.n) {
    const tiles = h('div', 'st-ut-tiles');
    const t1 = h('div', 'st-ut-tile'); t1.append(h('span', null, T('studioUtCost')), (() => { const b = h('b'); b.append(usdEl(va.usd)); return b; })());
    const cap = ui.api && !ui.api.nc && ui.api.cap;
    if (cap) { t1.append(h('small', null, T('studioUtOf', { x: ltr(fmtUsdWhole(cap)) }))); const m = h('span', 'st-ut-meter'); const mi = h('i'); mi.style.width = Math.min(100, Math.round(100 * va.usd / cap)) + '%'; m.append(mi); t1.append(m); }
    const t2 = h('div', 'st-ut-tile'); t2.append(h('span', null, T('studioUtMin')), h('b', null, fmtNum(va.min)), h('small', null, va.n === 1 ? T('studioUtVid1') : T('studioUtVids', { n: va.n })));
    tiles.append(t1, t2);
    p.append(secT(T('studioUtSecMonth')), tiles);
  }
  // החוקים שלך — כל שורה פותחת את הדף שבו קובעים אותם (מקום אחד לכל הגדרה)
  const rl = ui.rl || {};
  const mx = rl.mx && modeById(rl.mx);
  // 15/10/2026: מה חסר כדי שהכל יעבוד — רק כשמשהו באמת חסר (כשהכל מוגדר — המקטע לא מופיע; הפרטים בהגדרות)
  const miss = [];
  if (noEng) miss.push(rowNav({ tile: tile('key', 'orange'), label: T('studioUtConnect'), sub: T('studioUtConnectS'), onClick: () => go('eng'), k: 'ut-nc' }));
  if (ui.push === 'off') miss.push(rowNav({ tile: tile('bell', 'orange'), label: T('studioUtNeedPush'), sub: T('studioUtNeedPushS'), onClick: () => go('push'), k: 'ut-np' }));
  if (miss.length) p.append(secT(T('studioUtSecSetup')), list(...miss));
  if (ui.push == null) refreshPush().then(() => { if (root && ui.view === 'tower') render('none'); });
  // 15/10/2026 (המשתמש): כל שורה משנה את מה שכתוב בה — תקציב ומצב בעמוד בחירה משלהם (כמו בהגדרות של iOS), צריבה במתג כאן
  const off = blocked() || rulesBusy;
  const abSw = rowSwitch({ label: T('studioUtAskRender'), sub: T('studioRlAbS'), on: rl.ab, onClick: () => { if (!off) setRules({ ab: !rl.ab }); }, k: 'ut-ra' });
  if (off) abSw.disabled = true;
  p.append(secT(T('studioUtSecRules')), list(
    rowNav({ label: T('studioUtBudget'), value: rl.b ? budgetTxt(rl.b) : T('studioUtNoLimit'), onClick: () => go('rlb'), k: 'ut-rb' }),
    rowNav({ label: T('studioUtMax'), value: mx ? modeShort(mx) : T('studioUtNoLimit'), onClick: () => go('rlm'), k: 'ut-rm' }),
    abSw,
    rowNav({ label: T('studioUtGloss'), value: gl.st === 'ok' ? T('studioUtGlossN', { n: gl.rows.length }) : '', onClick: () => go('gloss'), k: 'ut-rg' }),
    rowNav({ label: T('studioUtMore'), sub: T('studioUtMoreS'), onClick: () => go('rules'), k: 'ut-rr' })));
  if (!ui.halt) p.append(h('div', 'st-gap sm'), btn('st-btn danger wide', T('studioUtStop'), () => askHalt(), 'ut-halt'), h('p', 'st-ut-cap', T('studioUtStopS')));
  // המנהל — המגדל המלא (בהמשך: מרכז הניהול)
  if (ui.api && ui.api.admin) p.append(h('div', 'st-gap sm'), list(rowNav({ tile: tile('shield', 'blue'), label: T('studioUtFull'), sub: T('studioUtFullS'), onClick: () => go('towerx'), k: 'ut-full' })));
}
/* המגדל המלא — למנהל בלבד (עד שהוא עובר למרכז הניהול) */
function pageTowerFull(p) {
  // v369: כותרת כמו בתוכנית — היום והתאריך, ומשפט אחד על המצב
  const nUrg = urgentAlerts().length;
  const hero = h('div', 'st-twhero');
  const dt = new Date();
  hero.append(h('small', null, dt.toLocaleDateString(uiLang() === 'en' ? 'en-US' : 'he-IL', { weekday: 'long' }) + ' · ' + dt.toLocaleDateString(uiLang() === 'en' ? 'en-GB' : 'he-IL', { day: '2-digit', month: '2-digit' })),
    h('h1', 'st-large', !ui.ops ? T('studioTwT') : majorOn(ui.inc) ? T('studioTwHelloMajor') : !nUrg ? T('studioTwHello') : nUrg === 1 ? T('studioTwHello1') : T('studioTwHelloN', { n: nUrg })));
  p.append(navBar({ back: T('studioTwShort'), title: T('studioTwT') }), hero);
  const ab = accessBanner(); if (ab) p.append(ab);
  const hb = haltBanner(); if (hb) p.append(hb);   // v367: מתג החירום פעיל
  const mb = majorBanner(true); if (mb) p.append(mb);   // v371: תקלה רחבה — הפעלות מחכות
  if (ui.ops) p.append(opsScores(ui.ops));   // v369: שלושת הציונים עם מגמה
  // מה דורש תשומת לב — שתי ההתראות הראשונות לפי ציון העדיפות, ושורה לכל ההתראות והתקלות
  const live = ui.ops ? ui.ops.open.filter((a) => !a.m) : [];
  const nInc = ui.inc ? ui.inc.open : 0;
  if (ui.ops || nInc) {
    const sub = live.length || nInc ? [live.length ? T('studioTwAlN', { n: live.length }) : '', nInc ? T('studioTwIncN', { n: nInc }) : ''].filter(Boolean).join(' · ') : T('studioTwQuiet');
    // 13/10/2026: כותרת קטנה מעל הכרטיס עם "הכל ›" (כמו ב־Health), ובכרטיס — עד שתי התראות בשתי שורות; שקט = שורה אחת
    const hd = h('div', 'st-sec-t st-sec-row'); hd.append(h('span', null, T('studioTwAttnT')), btn('st-linkb', T('studioSeeAll'), () => go('alerts'), 'tw-alerts'));
    p.append(hd, list(...live.slice(0, 2).map(alertMini), live.length || nInc ? (live.length > 2 || nInc ? h('div', 'st-am-more', sub) : null)
      : rowNav({ tile: tile('alert', 'green'), label: T('studioTwQuiet'), onClick: () => go('alerts'), k: 'tw-quiet' })));
  }
  // v369: פעולות מהירות — רק מה שקיים
  const qa = h('div', 'st-qa');
  const qbtn = (icon, lbl, fn, k, cls) => { const b = btn('st-qa-b' + (cls ? ' ' + cls : ''), null, fn, k); const i = h('i'); i.append(ico(icon)); b.append(i, h('span', null, lbl)); return b; };
  qa.append(qbtn('plus', T('studioQaNew'), () => { form = freshForm(null); go('new'); }, 'qa-new'));
  const resumable = store.jobs.find((r) => canResume(r));
  if (resumable) qa.append(qbtn('film', T('studioQaResume'), () => go('job', resumable.id), 'qa-resume'));
  qa.append(qbtn('sliders', T('studioRlT'), () => go('rules'), 'qa-rules'));
  if (!ui.halt) qa.append(qbtn('power', T('studioQaHalt'), () => askHalt(), 'qa-halt', 'neg'));   // עצורים — "להחזיר" רק בבאנר שלמעלה
  p.append(qa);
  // עכשיו — רק כשמשהו רץ (בלי שורה "אין עבודה פעילה")
  const act = store.jobs.filter((r) => r.srv && (r.srv.state === 'running' || r.srv.state === 'queued'));
  if (act.length) p.append(setCard(T('studioTwSecNow'), list(...act.map((rec) => {
    const tw = rec.srv.tw;
    const sub = !tw ? T('studioTwWaitRep') : tw.sh ? T('studioShWarn') : tw.lv === 'warn' ? T('studioTwWarnS', { x: fmtX(tw.x) }) : T('studioTwOkS', { x: fmtX(tw.x) });
    const r = btn('st-row st-ric', null, () => go('job', rec.id), 'tw:' + rec.id);
    const l = h('span', 'st-l'); const b = h('b'); b.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled'))); l.append(b, h('small', null, sub));
    r.append(tile('shield', tw && tw.lv === 'warn' ? 'orange' : 'green'), l, ico('chev', 'st-chev'));
    return r;
  }))));
  // מצב השירות — מפת השירות, השרת, אמינות וחריגות, בדיקת המוכנות, בעיות ותיקונים
  const health = [];
  if (ui.ops) {
    const bad = OPS_COMPONENTS.filter((c) => ui.ops.comp[c]);
    const worst = bad.length ? Math.min(...bad.map((c) => ui.ops.comp[c])) : 0;
    health.push(rowNav({ tile: tile('shield', !bad.length ? 'green' : worst <= 2 ? 'red' : 'orange'), label: T('studioOpsMap'),
      sub: !bad.length ? T('studioTwMapOk') : bad.map(opsComp).join(' · '), onClick: () => go('smap'), k: 'tw-smap' }));
  }
  if (ui.api && (ui.api.admin || ui.api.servers)) {   // מצב API: השרת של המערכת
    health.push(rowNav({ tile: tile('cloud', ui.api.online ? 'green' : 'orange'), label: T('studioSrvT'),
      sub: ui.api.online ? T('studioSrvOnN', { n: ui.api.online }) : T('studioSrvNone'), onClick: () => go('server'), k: 'tower-srv' }));
  }
  health.push(...sloRows(), scanRow());
  const pbOpen = ui.pb ? ui.pb.open : 0;
  if ((ui.pb && ui.pb.list.length) || ui.rb) {
    const top = ui.pb && ui.pb.list.find((x) => x.state !== 'f');
    health.push(rowNav({ tile: tile('sliders', pbOpen ? 'orange' : 'green'), label: T('studioTwProbsT'), sub: top ? pbTitle(top) : T('studioTwProbsNone'),
      value: pbOpen ? ltr(String(pbOpen)) : '', onClick: () => go('probs'), k: 'tw-probs' }));
  }
  p.append(setCard(T('studioTwGrpHealth'), list(...health)));
  // סוכנים ועלות — הסוכנים, ערך ועלות, הרגיל ומתי עוצרים
  const ag = [];
  if (ui.ag && ui.ag.agents.length) {
    const recs = agentRecs(ui.ag, ui.sh);   // v386: "מומלץ לפעולה" — הפירוט בבקרת הסוכנים
    ag.push(rowNav({ tile: tile(recs.length ? 'alert' : 'spark', recs.length ? 'orange' : 'green'), label: T('studioTwAgentsT'),
      sub: recs.length ? recText(recs[0]) : T('studioTwAgentsS', { n: ui.ag.agents.length, j: ui.ag.jobs }), value: recs.length ? ltr(String(recs.length)) : '', onClick: () => go('agents'), k: 'tw-agents' }));
  }
  const vr = valueRow(); if (vr) ag.push(vr);
  ag.push(rowNav({ tile: tile('coin', 'blue'), label: T('studioTwNormT'), sub: T('studioTwNormS'), onClick: () => go('norm'), k: 'tw-norm' }));
  p.append(setCard(T('studioTwGrpAgents'), list(...ag)));
}
/* התראות ותקלות — כל ההתראות הפתוחות (לפי ציון העדיפות), סיכום 24 שעות, מושתקות, ותקלות */
function pageAlerts(p) {
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioTwAlertsT')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const o = ui.ops;
  const live = o ? o.open.filter((a) => !a.m) : [];
  if (live.length) p.append(setCard(T('studioOpsOpenT'), list(...live.map(alertRow))));
  if (o) {
    const also = o.digest.top.filter((x) => !live.some((a) => a.c === x.c && a.k === x.k));   // סוגים שהיו היום ונסגרו
    if (also.length) p.append(note(T('studioOpsDigestTop', { l: also.map((x) => opsAlert(x.c, x.k) + ' (' + x.n + ')').join(' · ') })));
    if (o.mu.length) p.append(mutedBlock(o));
  }
  const L = ui.inc ? ui.inc.list : [];
  if (L.length) p.append(setCard(ui.inc.open ? T('studioIncSecN', { n: ui.inc.open }) : T('studioIncSec'), list(...L.map((x) => incRow(x)))));
  if (!live.length && !L.length) p.append(setCard(null, list(h('div', 'st-row st-muted', T('studioTwQuiet')))));
}
/* מפת השירות — הרכיבים לפי סדר השרשרת, רכיב עם התראה פתוחה בצבע החומרה */
function pageSmap(p) {
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioOpsMap')));
  if (ui.ops) p.append(setCard(null, serviceMapEl(ui.ops)), note(T('studioTwMapNote')));
}
/* בעיות ותיקונים — כל בעיה שחוזרת (ספר התיקונים) וספרי ההפעלה של החודש */
function pageProbs(p) {
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioTwProbsT')));
  const L = ui.pb ? ui.pb.list : [];
  if (L.length) p.append(setCard(T('studioPbSec'), list(...L.map(pbRow))));
  const rb = rbSection();
  if (rb.length) p.append(setCard(T('studioRbSec'), rb[1]), rb[2]);
}
/* הרגיל ומתי עוצרים — מה עולה עבודה רגילה בכל מצב (נלמד מהעבודות שלך), והספים של המגדל */
function pageNorm(p) {
  p.append(navBar({ back: T('studioTwShort') }), large(T('studioTwNormT')));
  const nm = curNorm();
  let learned = false;
  if (nm) {
    const ids = MODE_ORDER.slice().reverse().filter((id) => nm[id] && (modeOk(id, ui.mf) || nm[id].n));   // 15/10: מצב סגור — רק אם כבר עבדת בו   // 11/10: כל המצבים (מהיקר לזול) — טבלת מחירים אחת, גם למצב שעוד לא נלמד
    const rows = ids.map((id) => {
      const v = nm[id];
      if (!v.d) learned = true;
      const left = Math.max(1, 3 - v.n);
      let sub = !v.d ? T('studioTwNormU', { n: v.n }) : T('studioTwNormD') + ' · ' + (left === 1 ? T('studioTwNormLeft1') : T('studioTwNormLeft', { n: left }));
      const shn = ui.sh && ui.sh[id];
      if (shn) sub += ' · ' + (shn === 1 ? T('studioShRow1') : T('studioShRow', { n: shn }));   // v384: הספים החדשים עוד רק מזהירים
      const r = h('div', 'st-row');
      const val = h('span', 'st-v'); val.append(usdEl(v.ph));
      r.append(rowTxt(modeName(modeById(id)), sub), val);
      r.dataset.k = 'nm:' + id;
      return r;
    });
    p.append(setCard(T('studioTwSecNorm'), list(...rows)));
  }
  const rule = (txt) => h('div', 'st-row st-rule', txt);   // כללים — טקסט רגיל, לא כותרות
  p.append(setCard(T('studioTwSecRules'), list(rule(learned ? T('studioTwR1U') : T('studioTwR1')), rule(T('studioTwR2')), rule(T('studioTwR3')), rule(T('studioTwR4'))), note(T('studioTwRulesNote'))));
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
const MODE_ORDER = ['haiku-medium', 'haiku-high', 'sonnet-low', 'sonnet-medium', 'sonnet-high', 'opus-medium'];   // לפי הצפוי לשעה (NORM_DEF בשרתון)
export const modeOverMax = (id, mx) => !!mx && MODE_ORDER.indexOf(id) > MODE_ORDER.indexOf(mx);
const ltr = (x) => '\u2066' + x + '\u2069';   // סכום בדולרים בתוך משפט בעברית — בידוד, כדי שלא יתהפך
const budgetTxt = (b) => ltr('$' + (Number.isInteger(b) ? String(b) : b.toFixed(2)));
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
/* תקציב לעבודה — הגעת אליו: Claude עוצר ושואל בטלפון. משותף לעמוד החוקים ולעמוד הבחירה מהמגדל (sec = עם כותרת) */
function rulesBudget(p, sec) {
  const rl = ui.rl, off = blocked() || rulesBusy;
  const opts = [0].concat(RULE_BUDGETS);
  if (rl.b && !opts.includes(rl.b)) opts.push(rl.b);
  if (sec) p.append(secT(T('studioRlBudgetT')));
  p.append(list(...opts.map((b) => rowRadio({ label: b ? budgetTxt(b) : T('studioRlNoBudget'), sub: b ? null : T('studioRlNoBudgetS'),
    on: rl.b === b, onClick: () => setRules({ b }), k: 'rb:' + b, disabled: off }))), note(T('studioRlBudgetNote')));
}
/* מצב מקסימלי — מצב יקר יותר מחכה לאישור שלך לפני שמתחילים. לכל מצב — כמה עולה עבודה רגילה לשעת סרטון (הרגיל שלך) */
function rulesMax(p, sec) {
  const rl = ui.rl, off = blocked() || rulesBusy;
  const mxs = [''].concat(MODE_ORDER.filter((id) => modeOk(id, ui.mf)).slice(0, -1));   // 15/10: רק המצבים הפתוחים למשתמש
  if (sec) p.append(secT(T('studioRlMaxT')));
  p.append(list(...mxs.map((id) => rowRadio({ label: id ? T('studioRlUpTo', { m: modeName(modeById(id)) }) : T('studioRlAllModes'),
    sub: id ? normHint(id) : null, on: rl.mx === id, onClick: () => setRules({ mx: id }), k: 'rm:' + (id || 'all'), disabled: off }))));
  if (!sec) p.append(note(T('studioRlMaxNote')));
}
/* "כ־$X לשעת סרטון" — מהרגיל שנלמד (או ברירת המחדל), כדי שיהיה ברור מה כל בחירה אומרת */
function normHint(id) {
  try { const n = curNorm(); const x = n && n[id]; return x && x.ph ? T('studioRlPerHour', { u: ltr(fmtUsd(x.ph)) }) : null; } catch (e) { return null; }
}
function pageRuleBudget(p) {
  p.append(navBar({ back: T('studioTwT') }), large(T('studioUtBudget')), h('p', 'st-lede', T('studioRlBudgetLede')));
  rulesBudget(p, false);
}
function pageRuleMax(p) {
  p.append(navBar({ back: T('studioTwT') }), large(T('studioUtMax')), h('p', 'st-lede', T('studioRlMaxLede')));
  rulesMax(p, false);
}
function pageRules(p) {
  /* 25/10/2026 (בקשת המשתמש — בלי כפילויות): התקציב, המצב המקסימלי, האישור לפני צריבה והמילון — במגדל עצמו (כל שורה שם
     פותחת את העמוד שלה). כאן רק מה שאין שם: שופט האיכות, בדיקת המשמעות ומסלול התיקונים */
  p.append(navBar({ back: T('studioTwT') }), large(T('studioUtMore')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const rl = ui.rl, off = blocked() || rulesBusy;
  // v375: שופט האיכות (Haiku, 40 כתוביות לדוגמה בסוף כל עבודה) — פועל כברירת מחדל (החלטה 4 בתוכנית)
  p.append(secT(T('studioRlJgT')), list(rowSwitch({ label: T('studioRlJg'), sub: T('studioRlJgS'), on: !rl.jx, onClick: () => { if (!off) setRules({ jx: !rl.jx }); }, k: 'rj' }),
    // סבב 10: אחרי השופט — בדיקת משמעות לכתוביות שסימן, אוטומטית כשנכנסים לעבודה (תמיד עם אומדן ואישור לפני שמתחילים)
    rowSwitch({ label: T('studioRlAm'), sub: T('studioRlAmS'), on: rl.am, onClick: () => { if (!off) setRules({ am: !rl.am }); }, k: 'ram' })));
  // v366: מסלול התיקונים — "הצעות לאישור" (ברירת המחדל) או "Claude מחליט לבד".
  // v368: עבר לכאן ממסך המגדל — כל מה שאתה קובע לסוכנים במקום אחד
  const fm = ui.fm === 'auto' ? 'auto' : 'suggest';
  p.append(secT(T('studioFmT')), list(
    rowRadio({ label: T('studioFmSug'), sub: T('studioFmSugS'), on: fm === 'suggest', onClick: () => setFixMode('suggest'), k: 'fm:suggest', disabled: blocked() }),
    rowRadio({ label: T('studioFmAuto'), sub: T('studioFmAutoS'), on: fm === 'auto', onClick: () => setFixMode('auto'), k: 'fm:auto', disabled: blocked() })));
}
/* v367: שער — הגענו לתקציב / לפני הצריבה. הטקסט מהקטלוג; הכתוביות לדוגמה (מהתרגום) — רק כטקסט */
/* 21/10/2026 (בקשת המשתמש): המקור באנגלית של אותה כתובית — מתחת לתרגום, קטן ואפור, משמאל לימין (מיושר לצד השני),
   עם תווית EN קטנה: ברור שזו שפה אחרת, וברור שזה אותו קטע (באותה שורה). אותה צורה בבדיקה לפני הצריבה ובעורך */
function srcLine(e) {
  const d = h('div', 'st-src'); d.dir = 'ltr'; d.lang = 'en';
  const tag = h('span', 'st-src-l', 'EN'); tag.setAttribute('aria-label', T('studioSrcEn'));
  d.append(tag, h('span', 'st-src-x', e));
  return d;
}
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
      const tx = h('div', 'st-cue-b');
      const x = h('span', 'st-cue-x', cu.x); x.dir = 'auto';
      tx.append(x);
      if (cu.e) tx.append(srcLine(cu.e));      // 21/10 (בקשת המשתמש): המקור באנגלית מתחת לתרגום — השוואה ישירה
      r.append(tm, tx);
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
  if (!qa || (FINAL.includes(rec.srv.state) && !(qa.nb && !qa.a && rec.srv.state === 'done'))) return null;
  if (qa.g) return gateCard(rec, qa);
  const c = h('div', 'st-ask' + (qa.a ? ' done' : ''));
  c.dataset.k = 'ask';
  if (qa.a && qa.nb) {                          // 20/10/2026: ענית — נכנס לתרגום אם הוא עוד לא התחיל, אחרת הצעה בסוף
    c.append(ico('check'), h('span', null, qa.u === undefined ? T('studioAskNbSoon', { a: qa.a.t }) : askFixDue(qa) ? T('studioAskNbLate', { a: qa.a.t }) : T('studioAskDone', { a: qa.a.t })));
    return c;
  }
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
  if (qa.nb) {   // 20/10/2026: העבודה לא מחכה — עונים מתי שנוח, ובסוף אפשר לתקן לפי התשובה
    c.append(h('small', 'st-ask-n', qa.d >= 0 ? T('studioAskNb', { a: qa.o[qa.d] }) : T('studioAskNbFree')));
    return c;
  }
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
  if (!ui.r2 && (!store.drive || !store.drive.connected)) { p.append(h('div', 'st-empty st-empty-sm', T('studioGlNoDrive'))); return; }
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
function glossJobCard(g, rec) {
  if (gl.st === '' && (ui.r2 || store.drive && store.drive.connected) && g.s.length) setTimeout(() => glossLoad(), 0);
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
      const b = btn('st-mini tint', null, () => { uxAdd(rec, 'gl', 'a'); glossWrite(glUpsert(gl.rows, [[x[0], x[1], '']]), T('studioGlAdded')); }, 'gla:' + x[0].toLowerCase());
      b.append(ico('plus')); b.setAttribute('aria-label', T('studioGlAdd'));
      if (gl.st !== 'ok' || gl.busy || blocked()) b.disabled = true;
      r.append(l, b);
      card.append(r);
    }
    if (fresh.length > 1) {
      const all = btn('st-btn ghost wide', T('studioGlAddAll', { n: fresh.length }), () => { uxAdd(rec, 'gl', 'a', fresh.length); glossWrite(glUpsert(gl.rows, fresh.map((x) => [x[0], x[1], ''])), T('studioGlAdded')); }, 'gl-all');
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
/* ---------------- v387: סט הזהב (golden dataset) — השוואה דטרמיניסטית לתרגום אנושי ---------------- */
let goldBusy = '';
const srtOut = (rec) => ((rec.srv && rec.srv.out) || []).find((o) => o.k === 'srt') || null;
function pickSrt(cb) {
  const inp = document.createElement('input'); inp.type = 'file';
  inp.accept = '.srt,application/x-subrip,text/plain';
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f) cb(f); });
  inp.click();
}
function goldMark(rec) {
  pickSrt(async (f) => {
    if (f.size > GOLD_REF_MAX) { flashSafe(T('studioGoldBig')); return; }
    const text = await f.text().catch(() => '');
    if (!parseSrt(text).length) { flashSafe(T('studioGoldBad')); return; }
    goldBusy = rec.id; render('none');
    try {
      const folder = rec.up.folder || await net.jobFolder(rec.id, fileTitle(rec.spec.name));
      await goldAttach(rec, await net.goldUpload(folder, text));
    } catch (e) { flashSafe(T('studioGoldErr')); } finally { goldBusy = ''; render('none'); }
  });
}
async function goldAttach(rec, ref, quiet) {
  const j = await net.api('gold', { job: rec.id, ref });
  if (j.job) rec.srv = normJob({ id: rec.id, srv: j.job }).srv;
  if (!j.ok) { if (!quiet) flashSafe(errText(j.error)); return; }
  save();
  await goldScore(rec, true);
}
/* שלב 4: רצועת ההשוואה מהסרטון עלתה עם העבודה (rec.gref) — כשהעבודה מסתיימת עם SRT, היא נכנסת לסט הזהב ומקבלת ציון. פעם אחת לכל עבודה */
const goldTried = new Set();
function goldAuto() {
  for (const rec of store.jobs) {
    const s = rec.srv;
    if (!rec.gref || !s || s.state !== 'done' || s.gd || !srtOut(rec) || goldBusy || goldTried.has(rec.id)) continue;
    goldTried.add(rec.id);
    goldBusy = rec.id;
    goldAttach(rec, rec.gref, true).catch(() => {}).finally(() => { goldBusy = ''; repaint(); });
    return;
  }
}
async function goldScore(rec, inner) {
  const src = rec.srv && rec.srv.gs ? jobRec(rec.srv.gs) : rec;
  const ref = src && src.srv && src.srv.gd, out = srtOut(rec);
  if (!ref) { flashSafe(T('studioGoldNoRef')); return; }
  if (!out) { flashSafe(T('studioGoldNoSrt')); return; }
  if (!inner) { goldBusy = rec.id; render('none'); }
  try {
    const [hyp, rf] = await Promise.all([net.driveText(out.id), net.driveText(ref.r)]);
    const gq = goldCompare(hyp, rf);
    if (!gq) { flashSafe(T('studioGoldBad')); return; }
    const j = await net.api('goldScore', { job: rec.id, gq });
    if (j.job) { rec.srv = normJob({ id: rec.id, srv: j.job }).srv; save(); }
    if (!j.ok) flashSafe(errText(j.error));
  } catch (e) { flashSafe(T('studioGoldErr')); } finally { if (!inner) { goldBusy = ''; render('none'); } }
}
function goldUnmark(rec) {
  const go2 = async () => {
    goldBusy = rec.id; render('none');
    try { const j = await net.api('gold', { job: rec.id, ref: null }); if (j.job) { rec.srv = normJob({ id: rec.id, srv: j.job }).srv; save(); } if (!j.ok) flashSafe(errText(j.error)); }
    finally { goldBusy = ''; render('none'); }
  };
  if (typeof askConfirm === 'function') askConfirm(T('studioGoldOffQ'), go2, { ok: T('studioGoldOff'), danger: true }); else go2();
}
const goldScoreTxt = (gq) => T('studioGoldScore', { tm: gq.tm });   // הציון עצמו — בערך שבצד (בלי כפילות)
/* בדף עבודה שהסתיימה (עם SRT): להוסיף לסט הזהב / הציון / הרצה חוזרת מול המקור */
function goldCard(rec) {
  const s = rec.srv;
  if (!s || s.state !== 'done' || !srtOut(rec)) return [];
  const busy = goldBusy === rec.id;
  if (s.gs) {
    const src = jobRec(s.gs), sgq = src && src.srv && src.srv.gq;
    const rows = [];
    if (s.gq) {
      const r = h('div', 'st-row'); r.dataset.k = 'gold:score';
      const val = h('span', 'st-v'); val.append(ltr(String(s.gq.s)));
      r.append(rowTxt(T('studioGoldRunT'), goldScoreTxt(s.gq) + (sgq ? ' · ' + T('studioGoldSrc', { s: sgq.s }) : '')), val);
      rows.push(r);
    } else rows.push(btn('st-row st-act', busy ? T('studioGoldCalc') : T('studioGoldCalcGo'), () => goldScore(rec), 'gold:calc'));
    return [secT(T('studioGoldT')), list(...rows)];
  }
  if (s.gd) {
    const rows = [];
    const r = h('div', 'st-row'); r.dataset.k = 'gold:score';
    const val = h('span', 'st-v'); val.append(s.gq ? ltr(String(s.gq.s)) : '—');
    r.append(rowTxt(T('studioGoldIn'), s.gq ? goldScoreTxt(s.gq) : T('studioGoldNoScore')), val);
    rows.push(r);
    if (!s.gq) rows.push(btn('st-row st-act', busy ? T('studioGoldCalc') : T('studioGoldCalcGo'), () => goldScore(rec), 'gold:calc'));
    rows.push(btn('st-row st-act danger', T('studioGoldOff'), () => goldUnmark(rec), 'gold:off'));
    return [secT(T('studioGoldT')), list(...rows)];
  }
  // 25/10/2026: שורה אחת עם הסבר קצר (במקום כותרת, כפתור ופסקת הסבר)
  const add = btn('st-row st-ric', null, busy ? null : () => goldMark(rec), 'gold:add');
  add.append(tile('spark', 'orange'), rowTxt(busy ? T('studioGoldAdding') : T('studioGoldAdd'), T('studioGoldAddS')), ico('chev', 'st-chev'));
  return [h('div', 'st-gap'), list(add)];
}
/* בבקרת הסוכנים: העבודות שבסט הזהב, הציון האחרון של כל אחת, והרצה חוזרת — רק בלחיצה, אחרי אומדן ואישור */
function goldSection() {
  const gold = store.jobs.filter((r) => r.srv && r.srv.state === 'done' && r.srv.gd && !r.srv.gs);
  const runs = store.jobs.filter((r) => r.srv && r.srv.gs);
  const rows = gold.map((g) => {
    const last = runs.filter((r) => r.srv.gs === g.id && r.srv.gq).sort((a, b) => b.created - a.created)[0];
    const sub = (g.srv.gq ? T('studioGoldOwn', { s: g.srv.gq.s }) : T('studioGoldNoScore')) + (last ? ' · ' + T('studioGoldLast', { s: last.srv.gq.s }) : '');
    return rowNav({ tile: tile('film', 'orange'), label: fileTitle(g.spec.name) || T('studioUntitled'), sub, value: last ? ltr(String(last.srv.gq.s)) : '', onClick: () => go('job', g.id), k: 'gold:' + g.id });
  });
  if (!rows.length) return [secT(T('studioGoldT')), list(h('div', 'st-row st-muted', T('studioGoldNone')))];
  const active = runs.some((r) => ['new', 'queued', 'running'].includes(r.srv.state));
  const run = btn('st-btn wide', active ? T('studioGoldRunning') : T('studioGoldRun', { n: gold.length }), active || goldBusy ? null : () => goldRunAsk(gold), 'gold-run');
  if (active) run.disabled = true;
  return [secT(T('studioGoldT')), list(...rows), run, note(T('studioGoldRunNote'))];
}
function goldRunAsk(gold) {
  const usd = goldEstimate(gold, curNorm());
  const go2 = () => goldRun();
  if (typeof askConfirm === 'function') askConfirm(gold.length === 1 ? T('studioGoldRunQ1', { usd: fmtUsd(usd) }) : T('studioGoldRunQ', { n: gold.length, usd: fmtUsd(usd) }), go2, { ok: T('studioGoldRunOk') });
}
async function goldRun() {
  if (goldBusy) return;
  goldBusy = 'run'; render('none');
  try {
    const j = await net.api('goldRun', { ok: true });
    if (!j.ok || !Array.isArray(j.jobs)) { flashSafe(errText(j.error)); return; }
    for (const sj of j.jobs) {
      const rec = recFromSrv(sj);
      if (rec && !jobRec(rec.id)) store.jobs.unshift(rec);
    }
    save();
    for (const sj of j.jobs) await tryStart(sj.id);   // כל השמירות הרגילות של "התחלה"
    flashSafe(T('studioGoldStarted', { n: j.jobs.length }));
  } finally { goldBusy = ''; render('none'); }
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
/* ---------------- מ1: הנגן ---------------- */
// הסרטון המקורי (מה שהטלפון העלה) עם הכתוביות מעליו; לא מתנגן (MKV / קודק) — הסרטון הצרוב. הכתוביות מ־cues.final.json
// (או מה־SRT בעבודות ישנות). אלמנט הנגן נשמר בין ציורים — וידאו שמוצא מהמסמך נעצר.
const outOf = (rec, k) => ((rec.srv && rec.srv.out) || []).find((o) => o.k === k) || null;
const burnedOut = (rec) => outOf(rec, 'compact') || outOf(rec, 'same') || outOf(rec, 'small');
/* איכויות הצפייה של העבודה → מה שהנגן צריך (כתובת מלאה דרך ה־SW לכל קובץ); רק כשהראשונה היא הסרטון שהנגן מנגן */
/* 26/10/2026: סרטון המקור נמחק (יום מפתיחת הפרויקט) — הנגן מנגן את הצרוב, ואין הפקה מחדש */
const srcGone = (rec) => !!(rec && rec.srv && rec.srv.sx > 0);
// 29/10/2026: בעבודת טלפון הסרטון עולה מ־Studio לאנדרואיד (spec.vc) — המזהה מהשרתון, לא מההעלאה של הדף
const srcVid = (rec) => (!srcGone(rec) && ((rec.up.v && rec.up.v.id) || (rec.spec && rec.spec.ph && rec.srv && rec.srv.fv))) || '';
/* עד מתי אפשר לצרוב מחדש / עד מתי הקבצים נשמרים — שורה אחת מתחת לתוצרים */
function keepNote(rec) {
  const rt = rec.srv && rec.srv.rt;
  if (!rt) return null;
  const a = [srcGone(rec) ? T('studioSrcGoneS') : rt.s > 0 ? T('studioKeepSrc', { t: fmtDate(rt.s) }) : '', rt.j > 0 ? T('studioKeepJob', { t: fmtDate(rt.j) }) : ''].filter(Boolean);
  return a.length ? note(a.join(' · ')) : null;
}
/* שורת "הפקה מחדש" — אחרי שהמקור נמחק: הסבר במקום מעבר */
const rrRow = (rec, k) => (srcGone(rec)
  ? rowNav({ tile: tile('redo', 'green'), label: T('studioRrTitle'), sub: T('studioSrcGoneS'), onClick: () => flashSafe(T('studioSrcGone')), k })
  : rowNav({ tile: tile('redo', 'green'), label: T('studioRrTitle'), sub: rrSub(rec), onClick: () => go('rr', rec.id), k }));
function ladderOf(rec) {
  const hl = rec && rec.srv && rec.srv.hl, vid = srcVid(rec);
  if (!hl || !vid || hl[0].id !== vid || rec.spec.edl) return null;
  const out = [];
  for (const l of hl) { const u = net.mediaUrl(l.id); if (!u) return null; out.push(Object.assign({}, l, { url: new URL(u, location.href).href })); }
  return out;
}
/* 22/10/2026: עותק הקול לנגן (Opus) — הנגן משתמש בו רק כשהטלפון לא מנגן את הקול המקורי.
   23/10/2026: רשימה — עותק לכל רצועת קול (שפות); כמה רצועות = תמיד דרך העותקים, עם בחירה בתפריט */
function altOf(rec) {
  const list = rec && rec.srv && rec.srv.hla;
  if (!list || !list.length || !ladderOf(rec)) return null;
  const out = [];
  for (const a of list) { const u = net.mediaUrl(a.id); if (!u) return null; out.push(Object.assign({}, a, { url: new URL(u, location.href).href })); }
  return out;
}
const pqSave = (q) => { if (store.settings.pq !== q) { store.settings.pq = q; save(); } };
const ptSave = (p) => { const n = normTrackPref(p); if (JSON.stringify(store.settings.pt) !== JSON.stringify(n)) { store.settings.pt = n; save(); } };
/* 25/10/2026 (בקשת המשתמש): הסרטון שנצרב בטלפון — בנגן שלנו, מהקובץ שבטלפון (Movies/Studio; לא עולה לשום מקום).
   הדף לא רואה את הקבצים של האפליקציה: בפעם הראשונה בוחרים את הקובץ (ידית שמורה לפי העבודה — 'po:<מזהה>'), ואחר כך
   הוא נפתח ישר. הקובץ נבדק לפי הגודל שהאפליקציה דיווחה (pbn.sz) — צריבה חדשה = בוחרים שוב */
export const phOutName = (name, small) => (String(name || '').replace(/\.[^.]*$/, '').replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 90).trim() || 'video') + (small ? ' — עברית קטן' : ' — עברית') + '.mp4';   // = PhCore.outName
const phLocal = (rec) => !!(rec && rec.up && rec.up.ph && rec.srv && rec.srv.pbn && rec.srv.pbn.s === 'done' && !phBurnLive(rec));
const canPlay = (rec) => !!(rec && (outOf(rec, 'cues') || outOf(rec, 'srt')) && (srcVid(rec) || burnedOut(rec) || phLocal(rec)));
let pl = null;                    // { id, st: 'load'|'ok'|'err', ctl, cues, iss, err }
function playClose() { if (pl && pl.wt) pl.wt(); if (pl && pl.ctl) pl.ctl.destroy(); if (pl && pl.url) { try { URL.revokeObjectURL(pl.url); } catch (e) {} } pl = null; }
/* הקובץ מהטלפון לפי הידית השמורה (בלי לשאול) — רק כשהגודל תואם לצריבה האחרונה */
const phSizeOk = (rec, f) => !!f && (!(rec.srv.pbn.sz > 0) || f.size === rec.srv.pbn.sz);
async function phFileSaved(rec, byUser) {
  const hnd = await handleOp('get', 'po:' + rec.id);
  if (!hnd || typeof hnd.getFile !== 'function') return null;
  try {
    let perm = typeof hnd.queryPermission === 'function' ? await hnd.queryPermission({ mode: 'read' }) : 'granted';
    if (perm !== 'granted' && byUser && typeof hnd.requestPermission === 'function') perm = await hnd.requestPermission({ mode: 'read' });
    if (perm !== 'granted') return null;
    const f = await hnd.getFile();
    return phSizeOk(rec, f) ? f : null;
  } catch (e) { return null; }
}
/* "לבחור את הסרטון" (בתוך הלחיצה — הרשאה / בורר) */
async function phPickPlay(rec) {
  const me = pl;
  const use = (f, hnd) => {
    if (!phSizeOk(rec, f)) { flashSafe(T('studioPlPhWrong')); return; }
    if (hnd) handleOp('put', 'po:' + rec.id, hnd);
    if (pl !== me) return;
    me.st = 'load'; plPaint(); playLoad(rec, f);
  };
  const f0 = await phFileSaved(rec, true);
  if (f0) { use(f0, null); return; }
  if (canPickHandle()) {
    try {
      const [hnd] = await window.showOpenFilePicker({ multiple: false, startIn: 'videos', types: [{ description: 'Video', accept: { 'video/mp4': ['.mp4'] } }] });
      use(await hnd.getFile(), hnd);
    } catch (e) { if (!(e && e.name === 'AbortError')) pickInput((f) => use(f, null)); }
    return;
  }
  pickInput((f) => use(f, null));
}
const plPaint = () => queueMicrotask(() => { if (shapeKey() !== lastShape) render('none'); });   // מ9: גם כשהטעינה מיידית (מהעורך) — בלי ציור מקונן
async function playLoad(rec, phFile) {
  const me = pl;
  try {
    const co = outOf(rec, 'cues'), so = outOf(rec, 'srt');
    let cues = se && se.id === rec.id && se.ed ? se.ed.cues() : [];   // מ9: כבר בעורך — בלי טעינה (ובלי מסך "טוען" שמהבהב)
    if (!cues.length && co) cues = normCues(await net.driveJson(co.id));
    if (!cues.length && so) cues = normCues(parseSrt(await net.driveText(so.id)));
    if (pl !== me) return;
    const srcId = srcVid(rec), bo = burnedOut(rec);
    if (!srcId && !bo && phLocal(rec)) {   // 25/10/2026: הסרטון שנצרב בטלפון — מהקובץ שבטלפון
      const f = phFile || await phFileSaved(rec, false);
      if (pl !== me) return;
      if (!f) { me.st = 'pick'; plPaint(); return; }
      me.url = URL.createObjectURL(f);
      me.cues = cues; me.iss = issuesList(cues);
      me.ctl = createPlayer({ src: me.url, burned: true, localFile: f, decodeAudio: null, cues, issues: me.iss, chapters: rec.chap || [], T,
        pref: store.settings.pt, onPref: ptSave, ...rateFlagOpts(rec), poster: thumbFor(rec, (u) => { if (pl === me && me.ctl) me.ctl.setPoster(u); }) });
      me.wt = bothTrack(watchTrack(rec, me.ctl.video), playStats(rec, me.ctl));
      me.st = 'ok'; plPaint(); return;
    }
    const src = srcId ? net.mediaUrl(srcId) : '', fb = bo ? net.mediaUrl(bo.id) : '';
    if (!src && !fb) { me.st = 'err'; me.err = 'nosw'; plPaint(); return; }
    me.cues = cues; me.iss = issuesList(cues);
    me.ctl = createPlayer({ src: src || fb, fallback: src ? fb : '', burned: !src, cues, issues: me.iss, chapters: rec.chap || [], T,
      ladder: src ? ladderOf(rec) : null, alt: src ? altOf(rec) : null, pq: store.settings.pq, onPq: pqSave,   // איכויות לפי ת־נגן
      pref: store.settings.pt, onPref: ptSave,   // 23/10/2026: קול וכתוביות — אוטומטי, או מה שנבחר ידנית
      ...rateFlagOpts(rec),   // 25/10/2026: דגל — סימון הכתובית שעל המסך (המשוב שלך)
      poster: thumbFor(rec, (u) => { if (pl === me && me.ctl) me.ctl.setPoster(u); }) });   // 21/10/2026: התמונה לפני הניגון
    me.wt = bothTrack(watchTrack(rec, me.ctl.video), playStats(rec, me.ctl));   // מ׳3: כמה מהסרטון נצפה · 25/10/2026: ואיך ניגן
    me.st = 'ok';
  } catch (e) {
    if (pl !== me) return;
    me.st = 'err'; me.err = (e && e.code) || 'drive';
  }
  plPaint();
}
function rvfSub(rvf) {
  const ks = new Set((rvf || []).map((f) => f[1]));
  return ['g', 's', 't'].filter((k) => ks.has(k)).map((k) => issueName('rv' + k)).join(' · ');
}
let seOnly = '';   // סבב 4: העורך נפתח על "רק לבדיקה" (מההצעה בדף העבודה)
/* סבב 4: סימונים לעורך — מהביקורת (rvf) ומונח שתורגם בשתי דרכים (מילון המונחים + המונחים של העבודה, בלי AI) */
function seFlags(rec, cues) {
  const terms = (gl.st === 'ok' ? gl.rows : []).map((r) => [r[0], r[1]]).concat(rec.srv.gl ? rec.srv.gl.s : []);
  return flagIndex(cues, (rec.srv.rvf || []).map(([i, k]) => [i, 'rv' + k]).concat(termIssues(cues, terms).map(([i]) => [i, 'term'])));
}
function issueName(k) {
  switch (k) {
    case 'rvg': return T('studioIsRvg');      // סבב 4: לבדיקה — מהביקורת ומבדיקת המונחים
    case 'rvs': return T('studioIsRvs');
    case 'rvt': return T('studioIsRvt');
    case 'term': return T('studioIsTerm');
    case 'cps': return T('studioIsCps');
    case 'len': return T('studioIsLen');
    case 'lines': return T('studioIsLines');
    case 'dur': return T('studioIsDur');
    default: return T('studioIsEn');
  }
}
function pagePlay(p) {
  const rec = jobRec(ui.param);
  if (!rec || !canPlay(rec)) { back(); return; }
  p.classList.add('st-dark');
  p.append(navBar({ back: fileTitle(rec.spec.name) || T('studioUntitled') }));
  if (!pl || pl.id !== rec.id) { playClose(); pl = { id: rec.id, st: 'load', ctl: null, cues: [], iss: [], err: '' }; playLoad(rec); }
  if (pl.st === 'load') { p.append(h('div', 'st-pl-ph', T('studioPlLoading'))); return; }
  if (pl.st === 'pick') {   // 25/10/2026: הסרטון שנצרב בטלפון — בפעם הראשונה בוחרים אותו
    const nm = h('bdi', null, phOutName(rec.spec.name, rec.spec.pb === 'small'));
    const tx = h('div', 'st-empty st-empty-sm'); tx.append(T('studioPlPhPick') + ' ', nm);
    p.append(tx, btn('st-btn wide', T('studioPlPhPickB'), () => phPickPlay(rec), 'pl-pick'));
    return;
  }
  if (pl.st === 'err') {
    const bo = burnedOut(rec);
    p.append(h('div', 'st-empty st-empty-sm', pl.err === 'nosw' ? T('studioPlNoSw') : T('studioPlLoadErr')));
    if (bo) p.append(list(isR2Id(bo.id) ? rowOut(rec, bo) : rowExt({ href: 'https://drive.google.com/file/d/' + bo.id + '/view', tile: tile('film', 'green'), label: T('studioPlOpenDrive'), k: 'pl-drive' })));
    return;
  }
  p.append(pl.ctl.el);
  // הכתוביות שלא עומדות בכללים — נגיעה קופצת אליהן (מפת החום בפס מראה איפה)
  if (pl.iss.length) {
    const rows = pl.iss.slice(0, 50).map((x) => {
      const r = btn('st-row st-ric', null, () => { pl.ctl.seek(Math.max(0, x.t - 0.3)); pl.ctl.play(); }, 'iss:' + x.i);
      const c = pl.cues.find((q) => q.i === x.i);
      const tm = h('span', 'st-pl-tm'); tm.append(h('bdi', null, fmtT(x.t)));
      r.append(tm, rowTxt(c ? c.lines.join(' ') : '#' + x.i, x.k.map(issueName).join(' · ')));
      return r;
    });
    p.append(secT(T('studioPlIssues', { n: pl.iss.length })), list(...rows));
    if (pl.iss.length > 50) p.append(note(T('studioPlIssuesMore', { n: pl.iss.length - 50 })));
  } else p.append(note(T('studioPlNoIssues')));
}
/* ---------------- מ2–מ3: עורך הכתוביות והפקה מחדש ----------------
   הכתוביות מ־cues.final.json; עריכה בזיכרון (שורדת יציאה מהדף, לא רענון); "שמירה" = שני קבצים לתיקיית העבודה ב־Drive
   (cues JSON + SRT) ו־op:'cuesSave' — הקודמת נשמרת בהיסטוריה. "הפקה מחדש" = עבודת rr: צריבה מהכתוביות הנוכחיות, בלי תרגום */
const jobFolder = (rec) => (rec && ((rec.up && rec.up.folder) || (rec.srv && rec.srv.folder))) || '';
const canEdit = (rec) => !!(rec && rec.srv && rec.srv.state === 'done' && rec.srv.kind === 'tr' && outOf(rec, 'cues') && jobFolder(rec));
const RR_OUTS = ['compact', 'same', 'mkv', 'small'];
const RR_STYLES = ['bold', 'classic'];     // מה שהצריבה של vt יודעת (קריוקי — רק בתרגום מלא, בעתיד)
let rrJobs = new Map();                    // העבודה המקורית → ההפקה מחדש האחרונה (מ־op:'jobs'; לא ברשימה הראשית)
let rrPv = new Map();                      // סבב 10: העבודה המקורית → הצריבה לבדיקה האחרונה (קטע קצר)
const rrRunning = (x) => !!(x && ['new', 'queued', 'running'].includes(x.srv.state));
let se = null;                             // { id, st, ed, ctl, saved, saving, err, upT, saveB }
const seDirty = () => !!(se && se.ed && se.ed.ver() !== se.saved);
function seDraftSoon(me, rec) {   // סבב 8: שנייה וחצי אחרי העריכה האחרונה — לא בכל הקשה
  clearTimeout(me.drT);
  me.drT = setTimeout(() => {
    if (se !== me || !me.ed) return;
    const r = me.ed.ver() !== me.saved ? draftRec(me.ed.cues(), rec.srv.ev, Date.now()) : null;
    if (r) idbOp('drafts', 'put', rec.id, r); else draftDel(rec.id);
  }, 1500);
}
function seStop() { if (se && se.tl) { se.tl.destroy(); se.tl = null; } if (se && se.wt) { se.wt(); se.wt = null; } if (se && se.ctl) { se.ctl.destroy(); se.ctl = null; } }   // יציאה מהדף: הנגן נעצר, העריכה נשמרת בזיכרון
async function seLoad(rec) {
  const me = se;
  try {
    const mo = outOf(rec, 'meta');   // סבב 6: גל הקול וחילופי השוטים (במקביל לכתוביות; בלעדיו — העורך כמו קודם)
    const [cj, mj] = await Promise.all([net.driveJson(outOf(rec, 'cues').id), mo ? net.driveJson(mo.id).catch(() => null) : null]);
    const cues = normCues(cj);
    if (se !== me) return;
    me.meta = normMeta(mj);
    // סבב 4: מילון המונחים (לבדיקת מונח שתורגם בשתי דרכים) — לא מחכים לו יותר מ־2.5 שנ׳
    if (gl.st === '' && store.drive && store.drive.connected) { await Promise.race([glossLoad(), new Promise((r) => setTimeout(r, 2500))]); if (se !== me) return; }
    if (!cues.length) { me.st = 'err'; me.err = 'empty'; render('none'); return; }
    const only = seOnly === rec.id; seOnly = '';
    me.at = -1;   // 21/10/2026: נפתח על נקודה מסוימת (רק לבדיקה) — הנגן מציג את הפריים שלה, לא את התמונה של העבודה
    me.ed = createSubsEditor({ cues, T, issueName, flash: flashSafe, onAi: () => go('ai', rec.id), flags: seFlags(rec, cues), only, shots: me.meta ? me.meta.sh : [],
      dismissed: new Set(store.sugx || []), onDismiss: (key) => { store.sugx = (store.sugx || []).concat(key).slice(-500); save(); uxAdd(rec, 'sg', 'r'); },
      onSugFix: () => uxAdd(rec, 'sg', 'a'),
      getTime: () => (me.ctl ? me.ctl.video.currentTime || 0 : 0),
      seek: (t) => { if (me.ctl) me.ctl.seek(Math.max(0, t - 0.05)); }, play: () => { if (me.ctl) me.ctl.play(); },
      onChange: () => { seAct(me); seSavePaint(); if (me.tl) me.tl.draw(); clearTimeout(me.upT); me.upT = setTimeout(() => { if (me.ctl) me.ctl.setCues(me.ed.cues()); }, 200); seDraftSoon(me, rec); } });
    if (only) { const k = me.ed.firstShown(); if (k >= 0) me.at = Math.max(0, me.ed.cues()[k].s - 0.05); }
    me.saved = me.ed.ver(); me.st = 'ok';
    me.base = cues; me.act = 0; me.last = 0;   // מ׳3: מה נטען — להשוואה בשמירה
    // סבב 8: טיוטה שנשארה מהפעם הקודמת (רענון / האפליקציה נסגרה) — חוזרת כצעד ביטול אחד ("ביטול" = הגרסה השמורה)
    const d = await idbOp('drafts', 'get', rec.id), use = draftUse(d, rec.srv.ev);
    if (se === me && use) {
      const back = () => { me.ed.applyCues(normCues(JSON.parse(d.c))); flashSafe(T('studioSeDraftBack')); };
      if (use === 'same') back();
      else if (typeof askConfirm === 'function') askConfirm(T('studioSeDraftOld', { t: fmtClock(d.at) }), back, { ok: T('studioSeDraftUse'), danger: true, onNo: () => draftDel(rec.id) });
    } else if (d && !use) draftDel(rec.id);
  } catch (e) {
    if (se !== me) return;
    me.st = 'err'; me.err = (e && e.code) || 'drive';
  }
  render('none');
}
/* מ׳3: זמן עבודה פעיל בעורך — הפרש בין שינויים רצופים, עד דקה (הפסקה ארוכה לא נספרת) */
function seAct(me) { const t = Date.now(); if (me.last && t - me.last < 60000) me.act += t - me.last; me.last = t; }
function seSavePaint() {
  const b = se && se.saveB;
  if (!b) return;
  const d = seDirty();
  b.disabled = !d || se.saving;
  b.textContent = se.saving ? T('studioSaving') : d ? T('studioSeSave') : T('studioSeSavedShort');
}
async function seSave(then) {
  const rec = se && jobRec(se.id);
  if (!rec || !se.ed || se.saving) return;
  const me = se, cues = me.ed.cues(), ver = me.ed.ver();
  if (!cues.length) { flashSafe(T('studioSeEmpty')); return; }
  me.saving = true; seSavePaint();
  try {
    const folder = jobFolder(rec), base = (fileTitle(rec.spec.name) || 'subs').slice(0, 80) + ' (' + T('studioSeVerName', { n: (rec.srv.ev || 0) + 1 }) + ')';
    const c = await net.textUpload(folder, base + '.cues.json', 'application/json', toCuesJson(cues), { snbEdit: 'c' });
    const s2 = await net.textUpload(folder, base + '.he.srt', 'application/x-subrip', toSrt(cues), { snbEdit: 's' });
    const diff = me.base ? editDiff(me.base, cues) : [], ws = Math.round((me.act || 0) / 1000);   // מ׳3: מה השתנה מאז הטעינה / השמירה הקודמת
    const learn = diff.length ? { pe: Object.assign(editStats(diff, cues, me.base), { ws }), pt: { ws, ch: diff } } : {};
    const j = await net.api('cuesSave', Object.assign({ job: rec.id, c, s: s2, ev: rec.srv.ev || 0 }, learn));
    if (j.job) rec.srv = normJob({ id: rec.id, srv: j.job }).srv;
    if (!j.ok) flashSafe(j.error === 'stale' ? T('studioSeStale') : errText(j.error));
    else { me.saved = ver; me.base = cues; me.act = 0; clearTimeout(me.drT); draftDel(rec.id); save(); flashSafe(T('studioSeSaved')); if (then) then(); }
  } catch (e) {
    flashSafe(errText((e && e.code) || 'drive'));
  } finally {
    me.saving = false; seSavePaint(); repaint();
  }
}
function seRestore(rec, i) {
  const doIt = async () => {
    const j = await net.api('cuesRestore', { job: rec.id, i, ev: rec.srv.ev || 0 });
    if (j.job) rec.srv = normJob({ id: rec.id, srv: j.job }).srv;
    if (!j.ok) { flashSafe(j.error === 'stale' ? T('studioSeStale') : j.error === 'file_missing' ? T('studioSeVerGone') : errText(j.error)); repaint(); return; }
    draftDel(rec.id); save(); seStop(); se = null; flashSafe(T('studioSeRestored')); render('none');   // העורך נטען מחדש מהגרסה ששוחזרה
  };
  if (typeof askConfirm === 'function') askConfirm(seDirty() ? T('studioSeRestoreQDirty') : T('studioSeRestoreQ'), doIt, { ok: T('studioSeRestore'), danger: seDirty() }); else doIt();
}
function pageSubs(p) {
  const rec = jobRec(ui.param);
  if (!rec || !canEdit(rec)) { back(); return; }
  p.classList.add('st-dark');
  if (!se || se.id !== rec.id) { seStop(); se = { id: rec.id, st: 'load', ed: null, ctl: null, saved: 0, saving: false, err: '', upT: 0, saveB: null }; seLoad(rec); }
  const saveB = btn('st-txt bold', '', () => seSave(), 'se-save');
  se.saveB = saveB; seSavePaint();
  p.append(navBar({ back: fileTitle(rec.spec.name) || T('studioUntitled'), title: T('studioSeTitle'), end: se.st === 'ok' ? saveB : null }));
  if (se.st === 'load') { p.append(h('div', 'st-pl-ph', T('studioSeLoading'))); return; }
  if (se.st === 'err') { p.append(h('div', 'st-empty st-empty-sm', T('studioSeLoadErr'))); return; }
  if (!se.ctl) {
    const srcId = srcVid(rec), bo = burnedOut(rec);
    const src = srcId ? net.mediaUrl(srcId) : '', fb = bo ? net.mediaUrl(bo.id) : '';
    if (src || fb) {
      const me = se;
      const at = me.at >= 0 ? me.at : -1;
      se.ctl = createPlayer({ src: src || fb, fallback: src ? fb : '', burned: !src, cues: se.ed.cues(), T,
        ladder: src ? ladderOf(rec) : null, pq: store.settings.pq, onPq: pqSave, pref: store.settings.pt, onPref: ptSave,
        poster: at >= 0 ? '' : thumbFor(rec, (u) => { if (se === me && me.ctl && !(me.at >= 0)) me.ctl.setPoster(u); }),   // 21/10/2026: לפי ת־נגן
        onTime: (t) => { if (me.ed && me.ctl) me.ed.time(t, !me.ctl.video.paused); } });
      se.wt = watchTrack(rec, se.ctl.video);   // 25/10/2026: גם הצפייה בעורך הכתוביות
      if (at >= 0) {   // נפתח על נקודה — הפריים של הנקודה (גם אחרי שהסרטון נטען: לפני כן הדפדפן יכול להתעלם מהקפיצה)
        se.ctl.seek(at);
        se.ctl.video.addEventListener('loadedmetadata', () => { if (se === me && me.ctl && me.ctl.video.currentTime < 0.01) me.ctl.seek(at); }, { once: true });
      }
    }
  }
  if (aiPreset && aiPreset.id === rec.id) queueMicrotask(() => { if (ui.view === 'subs' && aiPreset) go('ai', rec.id); });   // סבב 2
  if (seOnly === rec.id && se.ed) { seOnly = ''; se.ed.showOnly(true); }   // סבב 4: העורך כבר טעון — רק "לבדיקה"
  const top = h('div', 'st-se-top');
  if (se.ctl) top.append(se.ctl.el); else top.append(h('div', 'st-pl-ph', T('studioPlNoSw')));
  if (se.ctl && se.meta && !se.tl) {   // סבב 6: הציר — גל הקול, הכתוביות לפי דובר, חילופי השוטים
    const me = se;
    se.tl = createTimeline({ meta: se.meta, cues: () => me.ed.cues(), sel: () => me.ed.selected(), video: se.ctl.video, colors: () => me.ed.colors(),
      seek: (t) => { if (me.ctl) me.ctl.seek(t); }, pick: (k) => me.ed.select(k) });
    se.tl.el.setAttribute('aria-label', T('studioTlL'));
  }
  if (se.tl) { top.append(se.tl.el); requestAnimationFrame(() => se && se.tl && se.tl.draw()); }
  p.append(top, se.ed.el);
  // הפקה מחדש וגרסאות — מתחת לרשימה (פעולות של כל הקובץ)
  p.append(list(rrRow(rec, 'se-rr')));
  // מ7: ייצוא — הכתוביות כמו שהן עכשיו בעורך (גם לפני שמירה), קובץ להורדה
  const ex = h('details', 'st-details');
  const dl = (ext, mime, txt) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: typeof txt === 'string' ? mime + ';charset=utf-8' : mime }));
    a.download = (fileTitle(rec.spec.name) || 'subs').slice(0, 80) + '.he.' + ext;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
  const ttl = fileTitle(rec.spec.name) || '';
  ex.append(h('summary', null, T('studioExT')), list(
    rowNav({ label: 'SRT', sub: T('studioExSrt'), onClick: () => dl('srt', 'application/x-subrip', toSrt(se.ed.cues())), k: 'ex-srt' }),
    rowNav({ label: 'WebVTT', sub: T('studioExVtt'), onClick: () => dl('vtt', 'text/vtt', toVtt(se.ed.cues())), k: 'ex-vtt' }),
    rowNav({ label: 'TTML', sub: T('studioExTtml'), onClick: () => dl('ttml', 'application/ttml+xml', toTtml(se.ed.cues(), ttl)), k: 'ex-ttml' }),
    rowNav({ label: 'EBU STL', sub: T('studioExStl'), onClick: () => dl('stl', 'application/octet-stream', toStl(se.ed.cues(), ttl, Date.now())), k: 'ex-stl' })));   // סבב 8: לשידור
  p.append(ex);
  const vh = rec.srv.vh || [];
  if (vh.length) {
    const det = h('details', 'st-details');
    det.append(h('summary', null, T('studioSeVers', { n: vh.length })), list(...vh.map((at, i) => i).reverse().map((i) => {
      const r = btn('st-row', null, () => seRestore(rec, i), 'se-ver:' + i);
      r.append(rowTxt(T('studioSeVerName', { n: i + 1 }), vh[i] ? fmtClock(vh[i]) : ''), h('span', 'st-v', T('studioSeRestore')));
      return r;
    })));
    p.append(det);
  }
}
/* ---------- הפקה מחדש ---------- */
/* 22/10/2026: מה קורה עכשיו בהפקה מחדש (טהורה): wait = בתור, start = נלקחה ועוד לא דיווחה, up/bn/sv = מורידים / צורבים /
   שומרים, עם אחוז וזמן שנשאר בשלב לפי הקצב (מ־3% ואחרי 20 שנ׳ — לפני זה המספר קופץ) */
export function rrNow(srv, now) {
  const st = (srv && srv.state) || '', pr = (srv && srv.prog) || {};
  const p = typeof pr.p === 'number' && pr.p >= 0 ? Math.min(1, pr.p) : 0;
  if (st !== 'running') return { k: 'wait', p: 0, left: null };
  const k = ['up', 'bn', 'sv'].includes(pr.st) ? pr.st : 'start';
  if (k === 'start') return { k, p: 0, left: null };
  const s0 = pr.stg && pr.stg[k] && pr.stg[k].s, el = s0 ? (now - s0) / 1000 : 0;
  const left = p >= 0.03 && p < 1 && el >= 20 ? el / p * (1 - p) : null;
  return { k, p, left };
}
function rrSub(rec) {
  const r = rrJobs.get(rec.id);
  if (!r) return T('studioRrSub');
  const st = r.srv.state;
  return st === 'done' ? T('studioRrDone') : st === 'failed' || st === 'cancelled' ? T('studioRrFailed') : T('studioRrRunning');
}
const rrOpt = { out: { compact: true }, style: '' };
const rrEdl = new Map();                   // מ5: העבודה → החיתוך שאחרי התרגום (עד ההפקה; בזיכרון)
let ce = null;                             // מ4–מ5: דף החיתוך הפתוח { key, ctl, ed, url }
function ceStop() { if (ce) { if (ce.wt) ce.wt(); if (ce.ed) ce.ed.destroy(); if (ce.ctl) ce.ctl.destroy(); if (ce.url) try { URL.revokeObjectURL(ce.url); } catch (e) {} } ce = null; }
const fmtMin = (sec) => fmtT(sec);
function edlSum(e, dur) {
  if (!e) return T('studioEdNone');
  const parts = [];
  if (e.k.length) parts.push(e.k.length === 1 ? T('studioEdSumShort1', { t: fmtMin(edlDur(e, dur)) }) : T('studioEdSumShort', { n: e.k.length, t: fmtMin(edlDur(e, dur)) }));
  if (e.ar !== 'src') parts.push(e.ar);
  if (e.af) parts.push(T('studioEdAfShort'));   // סבב 9
  if (e.sp) parts.push('\u2066' + e.sp + '×\u2069');
  if (e.rt) parts.push(e.rt + '°');
  if (e.z) parts.push(T('studioEdZoom') + ' \u2066' + e.z + '×\u2069');
  if (e.mu) parts.push(T('studioEdMuted'));
  else if (e.vo != null || e.ln || e.fi || e.fo || e.dn) parts.push(T('studioEdGrpAudio'));
  if (e.br || e.ct || e.sa || e.fx) parts.push(T('studioEdGrpColor'));   // סבב 7
  if (e.bl) parts.push(T('studioEdBlur'));
  if (e.tr) parts.push(T('studioEdTr'));
  if (e.th != null) parts.push(T('studioEdThumb'));
  return parts.join(' · ');
}
/* עמוד החיתוך — אחרי התרגום (p = מזהה העבודה): הנגן על המקור עם הכתוביות; עבודה שנחתכה כבר לפני התרגום — על הסרטון הצרוב
   (אותו ציר זמן של הכתוביות). לפני התרגום (p = null): הקובץ מהטלפון, עוד לפני ההעלאה */
function pageCut(p, before) {
  const rec = before ? null : jobRec(ui.param);
  if (before ? !(form && (form.fileObj || form.drive)) : !rec || !canEdit(rec)) { back(); return; }
  const key = before ? 'form' : rec.id;
  p.classList.add('st-dark');
  p.append(navBar({ back: before ? (form.id ? T('studioEditT') : T('studioNew')) : T('studioRrTitle'), title: T('studioEdTitle') }));
  if (!ce || ce.key !== key) {
    ceStop();
    ce = { key, ctl: null, ed: null, url: '', cues: null };
    let src = '', fb = '', burned = false, cues = [], edl = null, dur = 0;
    if (before) { if (form.fileObj) ce.url = src = URL.createObjectURL(form.fileObj); else { src = net.mediaUrl(form.drive.id); dur = form.drive.dur || 0; } edl = form.edl || null; burned = true; }   // עוד אין כתוביות — בלי כפתור CC
    else {
      const e0 = rec.spec.edl || null, bo = burnedOut(rec);
      if (!e0 && srcVid(rec)) { src = net.mediaUrl(srcVid(rec)); fb = bo ? net.mediaUrl(bo.id) : ''; cues = se && se.id === rec.id && se.ed ? se.ed.cues() : []; }
      else if (bo) { src = net.mediaUrl(bo.id); burned = true; }
      edl = rrEdl.get(rec.id) || null; dur = rec.spec.dur || 0;
    }
    if (!src) { p.append(h('div', 'st-empty st-empty-sm', T('studioPlNoSw'))); ce = null; return; }
    const me = ce;
    ce.ctl = createPlayer({ src, fallback: fb, burned, cues, T, poster: rec ? thumbFor(rec, (u) => { if (ce === me && me.ctl) me.ctl.setPoster(u); }) : '' });
    ce.wt = watchTrack(rec, ce.ctl.video);   // בלי עבודה (חיתוך לפני התרגום) — לא נספר
    ce.ed = createEdlEditor({ video: ce.ctl.video, frame: ce.ctl.el, dur, edl, T, flash: flashSafe, full: !before,   // סבב 3: מהירות, סיבוב, מסגור ושמע — רק בהפקה מחדש
      onChange: (e) => { if (before) { if (form) form.edl = e; } else if (e) rrEdl.set(key, e); else rrEdl.delete(key); } });
  }
  const top = h('div', 'st-se-top'); top.append(ce.ctl.el);
  p.append(top, ce.ed.el, note(before ? T('studioEdNoteBefore') : T('studioEdNoteAfter')));
  if (before) return;
  // מ8: לפי התמליל (חינם — הזמנים של הכתוביות): הסרת שקטים, ובחירה של מה נשאר
  if (!ce.cues) {
    ce.cues = se && se.id === rec.id && se.ed ? se.ed.cues() : [];
    const co = outOf(rec, 'cues');
    if (!ce.cues.length && co) { const me = ce; net.driveJson(co.id).then((j) => { if (ce === me) { me.cues = normCues(j); render('none'); } }, () => {}); }
  }
  if (!ce.cues.length || rec.spec.edl) return;   // נחתך כבר לפני התרגום — ציר הזמן של הנגן הוא הצרוב (פשוט: בלי כלי התמליל)
  const cs = ce.cues, dur = rec.spec.dur || 0;
  const fil = rec.srv.fil;   // סבב 4: מילות מילוי מהתמלול (um/uh) — חיתוך בתוך מה שכבר נבחר
  p.append(secT(T('studioEdByText')), list(rowNav({ tile: tile('spark', 'green'), label: T('studioEdSilence'), sub: T('studioEdSilenceS'),
    onClick: () => ce.ed.set(intersectSegs(silenceSegs(cs, ce.ctl.video.duration || dur), ce.ed.segs()), T('studioEdSilenceNo')), k: 'ed-silence' }),   // בתוך מה שכבר נבחר
    fil ? rowNav({ tile: tile('spark', 'teal'), label: T('studioEdFil'), sub: T('studioEdFilS', { n: fil.length }),
      onClick: () => {
        const r = cutFillers(ce.ed.segs(), fil, ce.ctl.video.duration || dur);
        if (!r) { flashSafe(T('studioEdFilNo')); return; }
        ce.ed.set(r.segs, T('studioEdFilNo'));
        flashSafe(T('studioEdFilDone', { n: r.n, t: r.t }));
      }, k: 'ed-fil' }) : null));
  const det = h('details', 'st-details');
  det.append(h('summary', null, T('studioEdPick', { n: cs.length })));
  const box = h('div', 'st-list st-ed-cues');
  const paint = () => {
    const segs = ce.ed.segs();
    box.replaceChildren(...cs.slice(0, 2000).map((c, i) => {
      const on = segAt(segs, (c.s + c.e) / 2) >= 0;
      const r = btn('st-row st-ed-cue' + (on ? '' : ' off'), null, () => {
        const sg = ce.ed.segs();
        ce.ed.set(on ? removeRange(sg, c.s, c.e) : addRange(sg, c.s, c.e), T('studioEdRemoveNo')); paint();
      }, 'ed-cue:' + i);
      const ck = h('span', 'st-check' + (on ? ' on' : '')); ck.append(ico('check'));
      const tm = h('small', 'st-ai-tm'); tm.append(h('bdi', null, fmtT(c.s)));
      const tx = h('span', 'st-l'); const d = h('div'); d.dir = 'rtl'; d.textContent = c.lines.join(' '); tx.append(tm, d);
      r.setAttribute('role', 'checkbox'); r.setAttribute('aria-checked', on ? 'true' : 'false');
      r.append(ck, tx);
      return r;
    }));
  };
  det.addEventListener('toggle', () => { if (det.open) paint(); });
  det.append(box);
  p.append(det);
}

let rrBusy = false;
/* 20/10/2026: עבודת משנה (הפקה מחדש / בדיקה / AI) בזמן תקלה רחבה — השרתון מחזיר major. עד היום ההודעה הבזיקה והעבודה
   נשארה "ממתין להתחלה" בלי דרך להמשיך; עכשיו שואלים כמו בעבודה הראשית, ו"להתחיל בכל זאת" = mo */
async function startSub(id) {
  const k = await net.api('start', { job: id });
  if (k.ok || k.error !== 'major' || typeof askConfirm !== 'function') return k;
  const yes = await new Promise((ok) => askConfirm(T('studioMajorQ', { c: opsComp(k.mi && k.mi.c) }), () => ok(true), { ok: T('studioStartAnyway'), onNo: () => ok(false) }));
  return yes ? net.api('start', { job: id, mo: true }) : k;
}
async function rrStart(rec, prv) {
  if (rrBusy) return;
  const all = RR_OUTS.filter((k) => rrOpt.out[k]);
  // סבב 10: הבדיקה — צרוב אחד (איכות מקור אם נבחרה, אחרת דחוס), PV_LEN שניות מהמקום בעורך; העריכה השמורה לא נמחקת
  const out = prv ? [all.includes('same') ? 'same' : 'compact'] : all;
  if (!out.length) { flashSafe(T('studioRrPick')); return; }
  const t0 = se && se.id === rec.id && se.ctl && se.ctl.video ? se.ctl.video.currentTime || 0 : 0;
  const edl = prv ? previewEdl(rrEdl.get(rec.id) || null, rec.spec.dur || 0, t0) : rrEdl.get(rec.id) || null;
  rrBusy = true; repaint();
  try {
    const j = await net.api('rerender', Object.assign({ job: rec.id, out, style: rrOpt.style || (RR_STYLES.includes(rec.spec.style) ? rec.spec.style : 'bold'), edl, sty: rrSty(), ov: rrOv(rec.id) }, prv ? { prv: true } : {}));
    if (!j.ok || !j.job) { flashSafe(j.error === 'rr_busy' ? T('studioRrBusy') : errText(j.error)); return; }
    const x = normJob({ id: j.job.id, srv: j.job });
    if (x) (prv ? rrPv : rrJobs).set(rec.id, x);
    const k = await startSub(j.job.id);
    if (k.job && x) x.srv = normJob({ id: x.id, srv: k.job }).srv;
    if (!k.ok) flashSafe(errText(k.error)); else if (!prv) rrEdl.delete(rec.id);
  } catch (e) {
    flashSafe(errText((e && e.code) || 'net'));
  } finally { rrBusy = false; repaint(); schedulePoll(); }
}
function rrCancel(x) {   // ההפקה בלבד — התרגום והכתוביות של העבודה המקורית לא נוגעים
  const doIt = async () => {
    try {
      const j = await net.api('cancel', { job: x.id });
      if (j.job) x.srv = normJob({ id: x.id, srv: j.job }).srv;
      if (!j.ok) flashSafe(errText(j.error));
    } catch (e) { flashSafe(errText((e && e.code) || 'net')); }
    repaint();
  };
  if (typeof askConfirm === 'function') askConfirm(T('studioRrCancelQ'), doIt, { danger: true, ok: T('studioRrCancel') }); else doIt();
}
async function rrKick(x) {   // הפקה שנוצרה ולא התחילה — מתחילים שוב (עם השאלה על התקלה הרחבה)
  if (rrBusy) return;
  rrBusy = true; repaint();
  try {
    const k = await startSub(x.id);
    if (k.job) x.srv = normJob({ id: x.id, srv: k.job }).srv;
    if (!k.ok) flashSafe(errText(k.error));
  } catch (e) { flashSafe(errText((e && e.code) || 'net')); }
  finally { rrBusy = false; repaint(); schedulePoll(); }
}
/* ---------- סבב 5: עיצוב הכתוביות (גודל, צבע, רקע, גובה) — תצוגה חיה על הסרטון, ואותה הגדרה בצריבה ---------- */
const rrSty = () => normSty(rrOpt.sty !== undefined ? rrOpt.sty : store.settings.sty);
function stySum(st) {
  if (!st) return T('studioStyDef');
  const parts = [];
  if (st.k) parts.push('\u2066' + st.k + '%\u2069');
  if (st.c) parts.push(styColName(st.c));
  if (st.bx) parts.push(T('studioStyBox'));
  if (st.y) parts.push(T('studioStyLifted'));
  return parts.join(' · ');
}
function styColName(c) { return c === 'y' ? T('studioStyYellow') : c === 'c' ? T('studioStyCyan') : T('studioStyWhite'); }
let sy = null;   // { key, ctl, cues } — הנגן של דף העיצוב (נשאר בין ציורים)
function syStop() { if (sy && sy.wt) sy.wt(); if (sy && sy.ctl) sy.ctl.destroy(); sy = null; }
function syPeek(me) {   // עוצרים על כתובית של שתי שורות (או הארוכה) — רואים את העיצוב בלי לנגן
  const cs = me.cues || [];
  if (!cs.length || !me.ctl) return;
  const c = cs.find((x) => x.lines.length >= 2) || cs.reduce((a, b) => (b.lines.join('').length > a.lines.join('').length ? b : a), cs[0]);
  const go = () => { try { me.ctl.pause(); me.ctl.seek((c.s + c.e) / 2); } catch (e) {} };
  if (me.ctl.video.readyState >= 1) go(); else me.ctl.video.addEventListener('loadedmetadata', go, { once: true });
}
function stySet(patch) {
  const next = normSty(Object.assign({}, rrSty() || {}, patch));
  rrOpt.sty = next;
  store.settings.sty = next || undefined; if (!next) delete store.settings.sty; save();   // ההגדרה האחרונה = ברירת המחדל להפקה הבאה
  if (sy && sy.ctl) sy.ctl.setStyle(next);
  render('none');
}
/* 26/10/2026 (בעקבות Vid Hub): הבקרות של העיצוב — משותפות לטופס, לדף העבודה (בזמן שהיא רצה) ולהפקה מחדש */
function styControls(st, set) {
  const out = [];
  const chipRow = (items) => { const r = h('div', 'st-chips st-sty-row'); r.append(...items); return r; };
  const chip = (lbl, on, fn, k) => { const b = btn('st-chip' + (on ? ' on' : ''), lbl, fn, k); b.setAttribute('aria-pressed', on ? 'true' : 'false'); return b; };
  const k = st.k || 100, sizes = [80, 90, 100, 120, 140].concat(st.k && ![80, 90, 100, 120, 140].includes(st.k) ? [st.k] : []).sort((a, b) => a - b);   // שורה אחת (מינימליזם)
  out.push(secT(T('studioStySize')), chipRow(sizes.map((x) => chip('\u2066' + x + '%\u2069', x === k, () => set({ k: x }), 'sty-k:' + x))));
  out.push(secT(T('studioStyColor')), chipRow(Object.keys(STY_COLORS).map((c) => {
    const b = chip('', (st.c || 'w') === c, () => set({ c }), 'sty-c:' + c);
    const dot = h('span', 'st-sty-dot'); dot.style.background = STY_COLORS[c];
    b.append(dot, document.createTextNode(styColName(c)));
    return b;
  })));
  out.push(list(rowSwitch({ label: T('studioStyBox'), sub: T('studioStyBoxS'), on: !!st.bx, onClick: () => set({ bx: !st.bx }), k: 'sty-bx' })));
  const ys = [0, 10, 20, 30, STY_Y];
  out.push(secT(T('studioStyHeight')), chipRow(ys.map((y) => chip(y ? '\u2066+' + y + '%\u2069' : T('studioStyBottom'), (st.y || 0) === y, () => set({ y }), 'sty-y:' + y))));
  return out;
}
/* תצוגה מיידית בלי סרטון — אותו CSS של הכתוביות בנגן (setStyle), על "תמונה" כהה */
function stySample(st) {
  const box = h('div', 'st-pl hide st-sty-pv' + (st.bx ? ' boxed' : ''));
  box.setAttribute('aria-hidden', 'true');
  box.style.setProperty('--sub-k', String((st.k || 100) / 100));
  box.style.setProperty('--sub-c', STY_COLORS[st.c || 'w']);
  box.style.setProperty('--sub-lift', (st.y || 0) + '%');
  const sub = h('div', 'st-pl-sub'), d = h('div');
  d.append(h('span', null, T('studioStySample1')), document.createElement('br'), h('span', null, T('studioStySample2')));
  sub.append(d); box.append(sub);
  return box;
}
/* מקטע מתקפל: "עיצוב הכתוביות · <סיכום>" → תצוגה + הבקרות. key = איזה מקטע פתוח (ui.styOpen) */
function styFold(key, st, set) {
  const open = ui.styOpen === key;
  const wrap = h('div', 'st-sty-fold');
  wrap.append(list(rowNav({ label: T('studioStyT'), value: stySum(normSty(st)), onClick: () => { ui.styOpen = open ? '' : key; render('none'); }, k: 'styfold:' + key })));
  if (open) wrap.append(stySample(st || {}), ...styControls(st || {}, set));
  return wrap;
}
/* העיצוב של עבודה שכבר רצה — נשמר מיד בעבודה, ונשלח לשרתון אחרי 600ms בלי נגיעה (רק הבחירה האחרונה) */
const styT = new Map();
function jobStySet(rec, patch) {
  const next = normSty(Object.assign({}, rec.spec.sty || {}, patch));
  if (next) rec.spec.sty = next; else delete rec.spec.sty;
  store.settings.sty = next || undefined; if (!next) delete store.settings.sty;   // גם ברירת המחדל לעבודה הבאה
  save();
  clearTimeout(styT.get(rec.id));
  styT.set(rec.id, setTimeout(() => {
    styT.delete(rec.id);
    Promise.resolve(net.api('sty', { job: rec.id, sty: rec.spec.sty || null })).then((k) => { if (k && !k.ok && k.error !== 'state') flashSafe(errText(k.error)); }, () => {});
  }, 600));
  render('none');
}
/* אפשר לשנות עד שהצריבה מתחילה: עבודת תרגום עם תוצר וידאו, שלא בטלפון, ושעוד לא הגיעה לשלב הצריבה */
function styEditable(rec) {
  const sp = rec && rec.spec || {};
  if (sp.ph || sp.src === 'subs' || !(sp.out || []).some((k) => OUTS.includes(k))) return false;
  const st = rec.srv && rec.srv.state;
  if (st && st !== 'new' && st !== 'queued' && st !== 'running') return false;
  const stg = rec.srv && rec.srv.prog && rec.srv.prog.st;
  return !stg || !['bn', 'sv'].includes(stg);
}
function pageSty(p) {
  const rec = jobRec(ui.param);
  if (!rec || !canEdit(rec)) { back(); return; }
  p.classList.add('st-dark');
  p.append(navBar({ back: T('studioRrTitle'), title: T('studioStyT') }));
  if (!sy || sy.key !== rec.id) {
    syStop();
    sy = { key: rec.id, ctl: null, cues: se && se.id === rec.id && se.ed ? se.ed.cues() : null };
    const src = srcVid(rec) ? net.mediaUrl(srcVid(rec)) : '';
    if (src) { const me = sy; sy.ctl = createPlayer({ src, cues: sy.cues || [], T, pq: store.settings.pq, poster: thumbFor(rec, (u) => { if (sy === me && me.ctl) me.ctl.setPoster(u); }) }); sy.wt = watchTrack(rec, sy.ctl.video); }
    const me = sy, co = outOf(rec, 'cues');
    if (!me.cues && co) net.driveJson(co.id).then((j) => { if (sy === me) { me.cues = normCues(j); if (me.ctl) { me.ctl.setCues(me.cues); syPeek(me); } } }, () => {});
    else syPeek(me);
  }
  const st = rrSty() || {};
  if (sy.ctl) { sy.ctl.setStyle(st); const top = h('div', 'st-se-top'); top.append(sy.ctl.el); p.append(top); }
  else p.append(h('div', 'st-pl-ph', T('studioPlNoSw')));
  p.append(...styControls(st, stySet));
  if (rrSty()) p.append(btn('st-btn ghost wide', T('studioStyReset'), () => { rrOpt.sty = null; delete store.settings.sty; save(); if (sy && sy.ctl) sy.ctl.setStyle(null); render('none'); }, 'sty-reset'));
  p.append(note(T('studioStyNote')));
}
/* ---------- סבב 7: כותרת ולוגו (בהפקה מחדש) — הכותרת לכל עבודה, הלוגו נשמר בהגדרות (המותג שלך) ---------- */
const ovT = new Map();   // העבודה → { t, ta }
function rrOv(id) {
  const t = ovT.get(id) || {}, lg = store.settings.lg || {};
  return normOv({ t: t.t, ta: t.ta, lg: lg.d, lp: lg.p, ls: lg.s });
}
function ovPosName(k) { return k === 'tl' ? T('studioOvPos_tl') : k === 'bl' ? T('studioOvPos_bl') : k === 'br' ? T('studioOvPos_br') : T('studioOvPos_tr'); }
function ovSum(o) {
  if (!o) return T('studioOvNone');
  return [o.t ? T('studioOvTitle') : '', o.lg ? T('studioOvLogo') : ''].filter(Boolean).join(' · ');
}
/* הלוגו מהטלפון → PNG / WebP קטן (עד OV_LG_MAX כ־data URL): הצד הארוך עד 320, ואז מקטינים עד שנכנס */
async function logoFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('img')); i.src = url; });
    for (let side = 320; side >= 64; side = Math.round(side * 0.75)) {
      const k = Math.min(1, side / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.max(1, Math.round(img.naturalWidth * k)), hh = Math.max(1, Math.round(img.naturalHeight * k));
      const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
      cv.getContext('2d').drawImage(img, 0, 0, w, hh);
      for (const [type, q] of [['image/png'], ['image/webp', 0.9], ['image/webp', 0.75]]) {
        const d = cv.toDataURL(type, q);
        if (d.startsWith('data:' + type) && d.length <= OV_LG_MAX && normOv({ lg: d })) return d;
      }
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}
let ovp = null;   // { key, ctl, tEl, lEl }
function ovpStop() { if (ovp && ovp.wt) ovp.wt(); if (ovp && ovp.ctl) ovp.ctl.destroy(); ovp = null; }
function ovPaint(o) {
  if (!ovp || !ovp.ctl) return;
  ovp.tEl.textContent = (o && o.t) || ''; ovp.tEl.hidden = !(o && o.t);
  ovp.lEl.hidden = !(o && o.lg);
  if (o && o.lg) { ovp.lEl.src = o.lg; ovp.lEl.className = 'st-ov-l ' + o.lp; ovp.lEl.style.width = o.ls + '%'; }
}
function pageOv(p) {
  const rec = jobRec(ui.param);
  if (!rec || !canEdit(rec)) { back(); return; }
  p.classList.add('st-dark');
  p.append(navBar({ back: T('studioRrTitle'), title: T('studioOvT') }));
  if (!ovp || ovp.key !== rec.id) {
    ovpStop();
    ovp = { key: rec.id, ctl: null, tEl: h('div', 'st-ov-t'), lEl: document.createElement('img') };
    ovp.lEl.alt = ''; ovp.lEl.className = 'st-ov-l';
    const src = srcVid(rec) ? net.mediaUrl(srcVid(rec)) : '';
    if (src) { const me = ovp; ovp.ctl = createPlayer({ src, cues: [], T, burned: true, pq: store.settings.pq, poster: thumbFor(rec, (u) => { if (ovp === me && me.ctl) me.ctl.setPoster(u); }) }); ovp.wt = watchTrack(rec, ovp.ctl.video); ovp.ctl.el.append(ovp.tEl, ovp.lEl); }
  }
  const o = rrOv(rec.id) || {}, cur = ovT.get(rec.id) || {}, lg = store.settings.lg || null;
  if (ovp.ctl) { const top = h('div', 'st-se-top'); top.append(ovp.ctl.el); p.append(top); ovPaint(o); }
  const setT = (patch) => { ovT.set(rec.id, Object.assign({}, ovT.get(rec.id) || {}, patch)); ovPaint(rrOv(rec.id)); };   // תמיד מהעדכני (לא מהציור)
  // הכותרת: טקסט (לא נשמר בטלפון אחרי היציאה מהאפליקציה) + כמה זמן
  const inp = document.createElement('input'); inp.type = 'text'; inp.className = 'st-ask-in'; inp.dir = 'auto'; inp.maxLength = OV_T_MAX;
  inp.placeholder = T('studioOvTitlePh'); inp.value = cur.t || ''; inp.dataset.k = 'ov-t';
  inp.addEventListener('input', () => setT({ t: inp.value }));
  const taRow = h('div', 'st-chips st-sty-row');
  for (const [ta, lbl] of [[0, T('studioOvAll')], [5, T('studioOvFirst5')]]) {
    const on = (cur.ta === 5 ? 5 : 0) === ta;
    const b = btn('st-chip' + (on ? ' on' : ''), lbl, () => { setT({ ta }); render('none'); }, 'ov-ta:' + ta); b.setAttribute('aria-pressed', on ? 'true' : 'false'); taRow.append(b);
  }
  const box = h('div', 'st-ov-in'); box.append(inp);
  p.append(secT(T('studioOvTitle')), box, taRow);
  // הלוגו: מהטלפון, פינה, גודל — נשמר בהגדרות לכל ההפקות
  const fileIn = document.createElement('input'); fileIn.type = 'file'; fileIn.accept = 'image/png,image/jpeg,image/webp'; fileIn.hidden = true;
  fileIn.addEventListener('change', async () => {
    const f = fileIn.files && fileIn.files[0]; fileIn.value = '';
    if (!f) return;
    const d = await logoFromFile(f).catch(() => null);
    if (!d) { flashSafe(T('studioOvLogoBad')); return; }
    store.settings.lg = { d, p: (lg && lg.p) || 'tr', s: (lg && lg.s) || 14 }; save(); render('none');
  });
  p.append(secT(T('studioOvLogo')), fileIn, list(rowNav({ tile: tile('film', 'orange'), label: lg ? T('studioOvLogoChange') : T('studioOvLogoPick'), onClick: () => fileIn.click(), k: 'ov-lg' })));
  if (lg) {
    const pos = h('div', 'st-chips st-sty-row');
    for (const k of OV_POS) {
      const on = (o.lp || 'tr') === k;
      const b = btn('st-chip' + (on ? ' on' : ''), ovPosName(k), () => { store.settings.lg = Object.assign({}, lg, { p: k }); save(); render('none'); }, 'ov-lp:' + k);
      b.setAttribute('aria-pressed', on ? 'true' : 'false'); pos.append(b);
    }
    const sz = h('div', 'st-chips st-sty-row');
    for (const k of [10, 14, 18, 24]) {
      const on = (o.ls || 14) === k;
      const b = btn('st-chip' + (on ? ' on' : ''), '\u2066' + k + '%\u2069', () => { store.settings.lg = Object.assign({}, lg, { s: k }); save(); render('none'); }, 'ov-ls:' + k);
      b.setAttribute('aria-pressed', on ? 'true' : 'false'); sz.append(b);
    }
    p.append(pos, sz, btn('st-btn ghost wide', T('studioOvLogoX'), () => { delete store.settings.lg; save(); render('none'); }, 'ov-lg-x'));
  }
  p.append(note(T('studioOvNote')));
}
function pageRr(p) {
  const rec = jobRec(ui.param);
  if (!rec || !canEdit(rec)) { back(); return; }
  if (srcGone(rec) && !rrJobs.get(rec.id)) { flashSafe(T('studioSrcGone')); back(); return; }   // 26/10/2026: בלי מקור אין הפקה מחדש
  p.append(navBar({ back: fileTitle(rec.spec.name) || T('studioUntitled') }), large(T('studioRrTitle')));
  const r = rrJobs.get(rec.id), st = r ? r.srv.state : '';
  if (r && (st === 'new' || st === 'queued' || st === 'running')) {
    // 22/10/2026: המצב האמיתי — עד היום "צורבים" הופיע גם כשהעבודה רק נלקחה או עוד הורידה את הסרטון, והפס עמד על 0
    const n = rrNow(r.srv, Date.now());
    const stg = n.k === 'up' ? T('studioRrStUp') : n.k === 'sv' ? T('studioRrStSv') : n.k === 'bn' ? T('studioRrStBn') : n.k === 'start' ? T('studioRrStStart') : T('studioRrStWait');
    const c = h('div', 'st-nowc'), ic = h('span', 'st-nowic'), l = h('span', 'st-l'), pb = h('span', 'st-pbar'), pi = h('i');
    pb.append(pi); pi.style.width = Math.round(100 * n.p) + '%';
    const sub = n.k === 'wait' || n.k === 'start' ? '' : '\u2066' + Math.round(100 * n.p) + '%\u2069' + (n.left != null ? ' · ' + T('studioLeftShort', { t: fmtLeft(n.left) }) : '');
    ic.append(ico('redo')); l.append(h('b', null, stg), pb); if (sub) l.append(h('span', 'st-s', sub)); c.append(ic, l);
    p.append(c);
    if (st === 'new' && !rrBusy) p.append(btn('st-btn wide', T('studioStartAnyway'), () => rrKick(r), 'rr-kick'));   // 20/10/2026: נחסמה בתקלה רחבה
    if (!rrBusy) p.append(btn('st-btn danger wide', T('studioRrCancel'), () => rrCancel(r), 'rr-cancel'));   // 20/10/2026: אפשר לעצור הפקה (ממתינה / רצה)
  } else if (r && st === 'done' && r.srv.out.length) {
    p.append(secT(T('studioRrReady')), list(...r.srv.out.map((o) => rowOut(rec, o))));   // 22/10/2026: הורדה / שמירה ב־Drive (לא קישור ל־Drive — הקבצים ב־R2)
  } else if (r && (st === 'failed' || st === 'cancelled' && r.srv.err)) p.append(banner('warn', T('studioRrFailedL', { e: errText(r.srv.err) })));   // ביטול ביד — בלי באנר כישלון
  const active = r && ['new', 'queued', 'running'].includes(st);
  if (active) return;
  // סבב 10: הצריבה לבדיקה — מצב / התוצאה (קטע קצר), לצד ההפקה המלאה
  const pv = rrPv.get(rec.id), pst = pv ? pv.srv.state : '';
  if (rrRunning(pv)) p.append(list(rowNav({ tile: tile('redo', 'blue'), label: T('studioRrPvRun'), value: pst === 'running' ? Math.round(100 * ((pv.srv.prog && pv.srv.prog.p) || 0)) + '%' : '', k: 'rr-pv-run' })));
  else if (pv && pst === 'done' && pv.srv.out.length) p.append(list(...pv.srv.out.map((o) => rowOut(rec, o))));
  else if (pv && (pst === 'failed' || pst === 'cancelled')) p.append(banner('warn', T('studioRrFailedL', { e: errText(pv.srv.err) })));
  const dirty = seDirty() && se.id === rec.id;
  p.append(list(rowNav({ tile: tile('film', 'blue'), label: T('studioEdTitle'), value: edlSum(rrEdl.get(rec.id), rec.spec.dur), onClick: () => go('cut', rec.id), k: 'rr-cut' })));
  p.append(secT(T('studioRrOuts')), list(...RR_OUTS.map((k) => rowCheck({ label: outName(k), sub: k === 'small' ? T('studioRrSmallSub') : outSub(k), on: !!rrOpt.out[k],
    onClick: () => { rrOpt.out[k] = !rrOpt.out[k]; repaint(); }, k: 'rr-o:' + k }))));
  const cur = rrOpt.style || (RR_STYLES.includes(rec.spec.style) ? rec.spec.style : 'bold');
  p.append(secT(T('studioSecStyle')), list(...RR_STYLES.map((k) => rowRadio({ label: styleName(k), on: k === cur, onClick: () => { rrOpt.style = k; repaint(); }, k: 'rr-s:' + k })),
    rowNav({ tile: tile('edit', 'purple'), label: T('studioStyT'), value: stySum(rrSty()), onClick: () => go('sty', rec.id), k: 'rr-sty' }),   // סבב 5
    rowNav({ tile: tile('film', 'orange'), label: T('studioOvT'), value: ovSum(rrOv(rec.id)), onClick: () => go('ov', rec.id), k: 'rr-ov' })));   // סבב 7
  if (dirty) p.append(note(T('studioRrDirty')));
  p.append(btn('st-btn wide', rrBusy ? T('studioStarting') : dirty ? T('studioRrSaveGo') : T('studioRrGo'), rrBusy ? null : () => (dirty ? seSave(() => rrStart(rec)) : rrStart(rec)), 'rr-go'));
  // סבב 10: קודם קטע קצר — לראות את העיצוב והחיתוך בתוך דקה, לפני צריבה של כל הסרטון
  if (!rrRunning(rrPv.get(rec.id))) p.append(btn('st-btn wide tint', T('studioRrPvGo', { n: PV_LEN }), rrBusy ? null : () => (dirty ? seSave(() => rrStart(rec, true)) : rrStart(rec, true)), 'rr-pv'));
  p.append(note(T('studioRrNote')));
}
/* ---------------- מ7: גיליון ה־AI ----------------
   תור בקשות (פעולה קבועה או הוראה משלך, על הכתובית שנבחרה / עם בעיות / הכל) → העתק־הדבק ל־Claude שלך (בלי עלות נוספת)
   או הפעלה אחת (Routine / שרת — אומדן ואישור) → השוואה ישן ← חדש עם אישור לכל כתובית → צעד ביטול אחד בעורך */
let ai = null;   // { id, base, ver, queue, k, n, scope, mode: ''|'copy'|'run', answer, items, acc:Set, busy, model, err }
function aiKindName(k) {
  switch (k) {
    case 'meaning': return T('studioAiMeaning');
    case 'short': return T('studioAiShort');
    case 'natural': return T('studioAiNatural');
    case 'en': return T('studioAiEn');
    default: return T('studioAiFree');
  }
}
/* סבב 2: הכתוביות שהשופט סימן (מזהי vt) → שורות לגיליון ה־AI. טהור */
export function jdRows(cues, ids) {
  const want = new Set(ids || []);
  return cues.map((c, i) => (want.has(c.i) ? aiRow(c, i + 1) : null)).filter(Boolean).slice(0, AI_MAX_ROWS);
}
let aiPreset = null;
/* 20/10/2026: ההוראה לגיליון ה־AI — התשובה שלך במקום מה שהתרגום הניח. השאלה מ־Claude: רק טקסט, מקוצר (AI_NOTE_MAX) */
export function askFixNote(qa) {
  const q = String((qa && qa.q) || '').replace(/\s+/g, ' ').trim().slice(0, 110);
  const a = String((qa && qa.a && qa.a.t) || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return T('studioAskFixN', { q, a }).slice(0, AI_NOTE_MAX);
}   // { id, ids } — "בדיקת משמעות" מהצעות העבודה: העורך נטען ואז גיליון ה־AI עם הבקשה מוכנה
function aiScopeRows(cues, scope, sel) {
  const idx = scope === 'sel' ? (sel >= 0 ? [sel] : []) : scope === 'iss' ? cues.map((c, i) => (issuesList([c]).length ? i : -1)).filter((i) => i >= 0) : cues.map((c, i) => i);
  return idx.slice(0, AI_MAX_ROWS).map((i) => aiRow(cues[i], i + 1));
}
function aiShowResult(items, model) {
  ai.items = items; ai.acc = new Set(items.filter((x) => x.lines).map((x) => x.id)); ai.model = model; ai.busy = false;
  if (!items.length) flashSafe(T('studioAiNone'));
  render('none');
}
/* בקשה (תור) בהפעלה אחת — אומדן ואישור, העלאת הבקשה לתיקיית העבודה, aiRun + start, ומעקב עד התשובה.
   מחזיר { res, model } או null (בוטל); זורק { code } בתקלה. alive() = הדף עוד מחכה */
async function aiJobRun(rec, queue, alive) {
  const est = aiEstimate(queue);
  const yes = typeof askConfirm === 'function' ? await new Promise((ok) => askConfirm(T('studioAiEstQ', { n: est.rows, usd: fmtUsd(est.usd) }), () => ok(true), { ok: T('studioEstGo'), onNo: () => ok(false) })) : true;
  if (!yes) return null;
  if (alive.start) alive.start();
  const qid = await net.textUpload(jobFolder(rec), (fileTitle(rec.spec.name) || 'ai').slice(0, 80) + ' (AI).request.json', 'application/json', JSON.stringify(queue), { snbAi: 'q' });
  const j = await net.api('aiRun', { job: rec.id, q: qid });
  if (!j.ok || !j.job) throw Object.assign(new Error('x'), { code: j.error });
  const k = await startSub(j.job.id);
  if (!k.ok) throw Object.assign(new Error('x'), { code: k.error });
  for (let t = 0; t < 225 && alive(); t++) {                    // עד ~15 דק׳, כל 4 שנ׳
    await new Promise((r) => setTimeout(r, 4000));
    const x = await net.api('job', { job: j.job.id });
    const v = x.ok && x.job ? normJob({ id: j.job.id, srv: x.job }) : null;
    if (!v) continue;
    if (v.srv.state === 'done') {
      const o = v.srv.out.find((y) => y.k === 'aiout');
      return { res: o ? await net.driveJson(o.id) : null, model: v.srv.use && v.srv.use.length ? v.srv.use[0].m : '' };
    }
    if (v.srv.state === 'failed' || v.srv.state === 'cancelled') throw Object.assign(new Error('x'), { code: v.srv.err || 'failed' });
  }
  return null;
}
const aiErr = (code) => (code === 'ai_busy' ? T('studioAiBusy') : errText(code));
async function aiRunJob(rec) {
  const me = ai;
  const alive = () => ai === me;
  alive.start = () => { me.busy = true; me.err = ''; render('none'); };
  try {
    const r = await aiJobRun(rec, me.queue, alive);
    if (r && alive()) aiShowResult(normItems(r.res && r.res.items, me.queue), r.model);
  } catch (e) {
    if (alive()) { me.busy = false; me.err = (e && e.code) || 'net'; flashSafe(aiErr(me.err)); render('none'); }
  }
}
function pageAi(p) {
  const rec = jobRec(ui.param);
  if (!rec || !canEdit(rec) || !se || se.id !== rec.id || !se.ed) { back(); return; }
  const cues = se.ed.cues();
  if (!ai || ai.id !== rec.id) ai = { id: rec.id, base: cues, ver: se.ed.ver(), queue: [], k: 'meaning', n: '', scope: se.ed.selected() >= 0 ? 'sel' : 'iss', mode: '', answer: '', items: null, acc: new Set(), busy: false, model: '', err: '' };
  if (aiPreset && aiPreset.id === rec.id) {   // סבב 2: בדיקת משמעות לכתוביות שהשופט סימן — הבקשה כבר בתור, נשאר אומדן ואישור
    const free = aiPreset.free, rows = free ? aiScopeRows(cues, 'all', -1) : jdRows(cues, aiPreset.ids), run = aiPreset.run;   // 20/10/2026: free = תיקון לפי תשובה
    aiPreset = null;
    if (rows.length && !ai.items) { ai.k = free ? 'free' : 'meaning'; ai.queue = normQueue(ai.queue.concat([{ k: ai.k, rows, n: free || '' }])); ai.base = cues; ai.ver = se.ed.ver(); }
    if (run && rows.length && !ai.items && !ai.busy) queueMicrotask(() => { if (ui.view === 'ai' && ai && ai.id === rec.id && !ai.busy) aiRunJob(rec); });   // סבב 10: הכלל — האומדן והאישור מיד
  }
  p.append(navBar({ back: T('studioSeTitle'), title: T('studioAiTitle') }));
  // תוצאות — השוואה ואישור
  if (ai.items) {
    const fixes = ai.items.filter((x) => x.lines);
    p.append(note(ai.model ? T('studioAiBy', { m: modelLabel(ai.model) }) : T('studioAiByCopy')));
    if (!ai.items.length) p.append(h('div', 'st-empty st-empty-sm', T('studioAiNone')));
    p.append(list(...ai.items.map((it) => {
      const c = ai.base[it.id - 1];
      const r = it.lines ? btn('st-row st-ai-r', null, () => { if (ai.acc.has(it.id)) ai.acc.delete(it.id); else ai.acc.add(it.id); render('none'); }, 'ai-it:' + it.id) : h('div', 'st-row st-ai-r');
      const ck = it.lines ? h('span', 'st-check' + (ai.acc.has(it.id) ? ' on' : '')) : h('span', 'st-ai-warn'); ck.append(ico(it.lines ? 'check' : 'alert'));
      const tx = h('span', 'st-l');
      const tm = h('small', 'st-ai-tm'); tm.append(h('bdi', null, c ? fmtT(c.s) : '#' + it.id));
      const old = h('div', 'st-ai-old'); old.dir = 'rtl'; old.textContent = c ? c.lines.join(' / ') : '';
      const nw = h('div', it.lines ? 'st-ai-new' : 'st-ai-note'); nw.dir = 'rtl'; nw.textContent = it.lines ? it.lines.join(' / ') : it.note;
      tx.append(tm, old, nw); r.append(ck, tx);
      if (it.lines) { r.setAttribute('role', 'checkbox'); r.setAttribute('aria-checked', ai.acc.has(it.id) ? 'true' : 'false'); }
      return r;
    })));
    const n = fixes.filter((x) => ai.acc.has(x.id)).length;
    const go2 = btn('st-btn wide', n === 1 ? T('studioAiApply1') : T('studioAiApply', { n }), () => {
      const r = applyItems(se.ed.cues(), ai.base, fixes, ai.acc);
      if (r.n) se.ed.applyCues(r.cues);
      uxAdd(rec, 'ai', 'q', fixes.length); uxAdd(rec, 'ai', 'a', r.n); uxAdd(rec, 'ai', 'r', fixes.length - n);   // מ׳3
      flashSafe(r.skipped ? T('studioAiApplied2', { n: r.n, s: r.skipped }) : T('studioAiApplied', { n: r.n }));
      ai = null; back();
    }, 'ai-apply');
    go2.disabled = !n;
    p.append(h('div', 'st-gap'), go2, h('div', 'st-gap sm'), btn('st-btn tint wide', T('studioAiAgain'), () => { ai.items = null; ai.mode = ''; ai.answer = ''; render('none'); }, 'ai-again'));
    return;
  }
  // הבקשה
  p.append(secT(T('studioAiWhat')), list(...AI_KINDS.map((k) => rowRadio({ label: aiKindName(k), on: ai.k === k, onClick: () => { ai.k = k; render('none'); }, k: 'ai-k:' + k }))));
  if (ai.k === 'free') {
    const ta = h('textarea', 'st-ta'); ta.rows = 2; ta.maxLength = 300; ta.value = ai.n; ta.dir = 'auto'; ta.dataset.k = 'ai-n';
    ta.placeholder = T('studioAiFreePh'); ta.setAttribute('aria-label', T('studioAiFree'));
    ta.addEventListener('input', () => { ai.n = ta.value; });
    p.append(ta);
  }
  const sel = se.ed.selected(), nIss = cues.filter((c) => issuesList([c]).length).length;
  p.append(secT(T('studioAiWhich')), list(
    rowRadio({ label: T('studioAiSel'), disabled: sel < 0, on: ai.scope === 'sel', onClick: () => { ai.scope = 'sel'; render('none'); }, k: 'ai-s:sel' }),
    rowRadio({ label: T('studioAiIss', { n: nIss }), disabled: !nIss, on: ai.scope === 'iss', onClick: () => { ai.scope = 'iss'; render('none'); }, k: 'ai-s:iss' }),
    rowRadio({ label: T('studioAiAll', { n: cues.length }), on: ai.scope === 'all', onClick: () => { ai.scope = 'all'; render('none'); }, k: 'ai-s:all' })));
  p.append(btn('st-btn tint wide', T('studioAiAdd'), () => {
    const rows = aiScopeRows(se.ed.cues(), ai.scope, se.ed.selected());
    const q = normQueue(ai.queue.concat([{ k: ai.k, rows, n: ai.n }]));
    if (q.length === normQueue(ai.queue).length) { flashSafe(T('studioAiAddNo')); return; }
    ai.queue = q; ai.base = se.ed.cues(); ai.ver = se.ed.ver(); ai.mode = ''; render('none');
  }, 'ai-add'));
  if (!ai.queue.length) { p.append(note(T('studioAiNote'))); return; }
  // התור + איך להריץ
  p.append(secT(T('studioAiQueue', { n: ai.queue.length })), list(...ai.queue.map((r, i) => {
    const row = h('div', 'st-row');
    row.append(rowTxt(aiKindName(r.k), (r.n ? '«' + r.n + '» · ' : '') + T('studioAiRows', { n: r.rows.length })),
      btn('st-mini danger', T('studioSeDel'), () => { ai.queue.splice(i, 1); render('none'); }, 'ai-rm:' + i));
    return row;
  })));
  if (ai.busy) { p.append(h('div', 'st-empty st-empty-sm', T('studioAiRunning'))); return; }
  const prompt = aiPrompt(ai.queue);
  p.append(secT(T('studioAiHow')), list(
    rowNav({ tile: tile('copy', 'blue'), label: T('studioAiCopy'), sub: T('studioAiCopyS'), onClick: () => { copyText(prompt, T('studioAiCopied')); ai.mode = 'copy'; render('none'); }, k: 'ai-copy' }),
    rowNav({ tile: tile('spark', 'green'), label: T('studioAiRun'), sub: T('studioAiRunS', { usd: fmtUsd(aiEstimate(ai.queue).usd) }), onClick: () => aiRunJob(rec), k: 'ai-run' })));
  if (ai.mode === 'copy') {
    const ta = h('textarea', 'st-ta'); ta.rows = 6; ta.value = ai.answer; ta.dir = 'auto'; ta.dataset.k = 'ai-ans';
    ta.placeholder = T('studioAiPastePh'); ta.setAttribute('aria-label', T('studioAiPaste'));
    ta.addEventListener('input', () => { ai.answer = ta.value; });
    p.append(secT(T('studioAiPaste')), ta, h('div', 'st-gap sm'), btn('st-btn wide', T('studioAiCheck'), () => aiShowResult(parseAnswer(ai.answer, ai.queue), ''), 'ai-check'));
  }
}
/* ---------------- מ8: רעיונות (AI לווידאו) ----------------
   על כל התמליל: פרקים, כותרת ותיאור ליוטיוב, קטעים לשורטס (חיתוך 9:16 בלחיצה), ושאלה על הסרטון.
   אותן שתי דרכים של גיליון ה־AI (העתק־הדבק / הפעלה אחת עם אומדן), והתשובה — טקסט להעתקה */
let idea = null;   // { id, cues, k, n, mode, answer, text, model, busy }
function ideaKindName(k) {
  switch (k) {
    case 'chap': return T('studioIdChap');
    case 'yt': return T('studioIdYt');
    case 'hl': return T('studioIdHl');
    default: return T('studioIdAsk');
  }
}
const ideaQueue = () => [{ k: idea.k, n: idea.n, rows: idea.cues.slice(0, AI_T_ROWS).map((c, i) => aiTRow(c, i + 1)) }];
function pageIdeas(p) {
  const rec = jobRec(ui.param);
  if (!rec || !canEdit(rec)) { back(); return; }
  if (!idea || idea.id !== rec.id) {
    idea = { id: rec.id, cues: se && se.id === rec.id && se.ed ? se.ed.cues() : null, k: 'chap', n: '', mode: '', answer: '', text: null, model: '', busy: false };
    if (!idea.cues) { const me = idea; net.driveJson(outOf(rec, 'cues').id).then((j) => { if (idea === me) { me.cues = normCues(j); render('none'); } }, () => { if (idea === me) { me.cues = []; render('none'); } }); }
  }
  p.append(navBar({ back: fileTitle(rec.spec.name) || T('studioUntitled'), title: T('studioIdTitle') }));
  if (!idea.cues) { p.append(h('div', 'st-empty st-empty-sm', T('studioSeLoading'))); return; }
  if (!idea.cues.length) { p.append(h('div', 'st-empty st-empty-sm', T('studioSeLoadErr'))); return; }
  if (idea.text != null) {
    p.append(note(idea.model ? T('studioAiBy', { m: modelLabel(idea.model) }) : T('studioAiByCopy')));
    let shown = false;
    if (idea.k === 'hl') {
      const rs = parseRanges(idea.text);
      shown = rs.length > 0;
      if (rs.length) p.append(secT(T('studioIdHlT')), list(...rs.map((r, i) => rowNav({ tile: tile('film', 'blue'), label: r.title || fmtT(r.a), sub: '\u2066' + fmtT(r.a) + '–' + fmtT(r.b) + '\u2069 · ' + T('studioIdHlGo'),   // טווח מבודד — לא מתהפך ב־RTL
        onClick: () => { rrEdl.set(rec.id, normEdl({ k: [[r.a, r.b]], ar: '9:16', x: 0.5, af: true }, rec.spec.dur || 0)); rrOpt.out = { compact: true }; go('rr', rec.id); }, k: 'id-hl:' + i }))));   // סבב 9: שורטס — המסגרת עוקבת אחרי הדובר (af)
    }
    if (idea.k === 'chap') {   // פרקים → לנגן: פס עם מפרידים, שם הפרק בשורת הזמן ורשימה בגלגל השיניים
      const chs = normChapters(parseChapters(idea.text));
      if (chs.length) p.append(list(rowNav({ tile: tile('film', 'green'), label: rec.chap ? T('studioIdChapRep') : T('studioIdChapAdd'), sub: T('studioIdChapN', { n: chs.length }),
        onClick: () => { rec.chap = chs; save(); if (pl && pl.id === rec.id && pl.ctl) pl.ctl.setChapters(chs); if (canPlay(rec)) go('play', rec.id); else { flashSafe(T('studioIdChapOk')); render('none'); } }, k: 'id-chap' })));
    }
    const box = h('div', 'st-idea'); box.dir = 'auto'; box.textContent = idea.text || T('studioAiNone');
    if (!shown) p.append(box);   // שורטס — הקטעים כבר ברשימה; הטקסט עדיין להעתקה
    p.append(h('div', 'st-gap sm'), btn('st-btn wide', T('studioIdCopy'), () => copyText(idea.text), 'id-copy'),
      h('div', 'st-gap sm'), btn('st-btn tint wide', T('studioAiAgain'), () => { idea.text = null; idea.mode = ''; idea.answer = ''; render('none'); }, 'id-again'));
    return;
  }
  p.append(secT(T('studioAiWhat')), list(...TEXT_KINDS.map((k) => rowRadio({ label: ideaKindName(k), on: idea.k === k, onClick: () => { idea.k = k; idea.mode = ''; render('none'); }, k: 'id-k:' + k }))));
  if (rec.chap && idea.k === 'chap') p.append(list(rowNav({ tile: tile('film', 'orange'), label: T('studioIdChapIn', { n: rec.chap.length }), sub: T('studioIdChapDel'),
    onClick: () => { const del = () => { delete rec.chap; save(); if (pl && pl.id === rec.id && pl.ctl) pl.ctl.setChapters([]); render('none'); }; if (typeof askConfirm === 'function') askConfirm(T('studioIdChapDelQ'), del, { danger: true, ok: T('studioIdChapDel') }); else del(); }, k: 'id-chapdel' })));
  if (idea.k === 'ask') {
    const ta = h('textarea', 'st-ta'); ta.rows = 2; ta.maxLength = 300; ta.value = idea.n; ta.dir = 'auto'; ta.dataset.k = 'id-n';
    ta.placeholder = T('studioIdAskPh'); ta.setAttribute('aria-label', T('studioIdAsk'));
    ta.addEventListener('input', () => { idea.n = ta.value; });
    p.append(ta);
  }
  if (idea.busy) { p.append(h('div', 'st-empty st-empty-sm', T('studioAiRunning'))); return; }
  const ok2 = () => (idea.k !== 'ask' || idea.n.trim() ? true : (flashSafe(T('studioIdAskNo')), false));
  p.append(secT(T('studioAiHow')), list(
    rowNav({ tile: tile('copy', 'blue'), label: T('studioAiCopy'), sub: T('studioAiCopyS'), onClick: () => { if (!ok2()) return; copyText(aiPrompt(ideaQueue()), T('studioAiCopied')); idea.mode = 'copy'; render('none'); }, k: 'id-copyreq' }),
    rowNav({ tile: tile('spark', 'green'), label: T('studioAiRun'), sub: T('studioAiRunS', { usd: fmtUsd(aiEstimate(ideaQueue()).usd) }), onClick: async () => {
      if (!ok2()) return;
      const me = idea, alive = () => idea === me;
      alive.start = () => { me.busy = true; render('none'); };
      try {
        const r = await aiJobRun(rec, ideaQueue(), alive);
        if (r && alive()) { me.busy = false; me.text = parseText(r.res && r.res.text); me.model = r.model; render('none'); }
      } catch (e) { if (alive()) { me.busy = false; flashSafe(aiErr((e && e.code) || 'net')); render('none'); } }
    }, k: 'id-run' })));
  if (idea.mode === 'copy') {
    const ta = h('textarea', 'st-ta'); ta.rows = 6; ta.value = idea.answer; ta.dir = 'auto'; ta.dataset.k = 'id-ans';
    ta.placeholder = T('studioIdPastePh'); ta.setAttribute('aria-label', T('studioAiPaste'));
    ta.addEventListener('input', () => { idea.answer = ta.value; });
    p.append(secT(T('studioAiPaste')), ta, h('div', 'st-gap sm'), btn('st-btn wide', T('studioAiCheck'), () => { idea.text = parseText(idea.answer); idea.model = ''; render('none'); }, 'id-check'));
  }
}
/* סבב 10: הכלל "בדיקת משמעות אוטומטית" — פעם אחת לעבודה: העורך נטען, גיליון ה־AI עם הכתוביות שהשופט סימן, ואומדן לאישור */
export function amDue(rec, rl, done) {
  return !!(rl && rl.am && rec && rec.srv && rec.srv.state === 'done' && rec.srv.kind === 'tr' && rec.srv.jd && Array.isArray(rec.srv.jd.f) && rec.srv.jd.f.length
    && !(done || []).includes(rec.id));
}
function amMaybe(rec) {
  if (!amDue(rec, ui.rl, store.amd) || !canEdit(rec)) return;
  store.amd = (store.amd || []).concat(rec.id).slice(-200); save();   // גם אם לא יאושר — לא שוב
  aiPreset = { id: rec.id, ids: rec.srv.jd.f, run: true };
  flashSafe(T('studioAmGo'));
  queueMicrotask(() => { if (ui.view === 'job' && ui.param === rec.id) go('subs', rec.id); });
}
/* ---------------- 25/10/2026: המשוב שלך על התרגום (לפי התצוגה המקדימה שאושרה) ----------------
   כרטיס "איך יצא התרגום?" בדף העבודה (👍/👎 — נשמר מיד), אחרי 👎 גיליון "מה לא היה טוב?" (קודים קבועים + "לסמן כתוביות
   בנגן"), ודגל בנגן שמסמן את הכתובית שעל המסך. נשלח op:'rate' — רק קודים ומספרי כתוביות */
let rateChg = '';                          // העבודה שבה נגעת ב"שינוי" — שוב שני האגודלים
const rateOk = (rec) => !!(rec && rec.srv && rec.srv.kind === 'tr' && rec.srv.state === 'done');
function whyName(k) {
  switch (k) {
    case 'acc': return T('studioRateWAcc');
    case 'nat': return T('studioRateWNat');
    case 'tim': return T('studioRateWTim');
    case 'nm': return T('studioRateWNm');
    case 'brk': return T('studioRateWBrk');
    case 'ovl': return T('studioRateWOvl');
    case 'mis': return T('studioRateWMis');
    default: return T('studioRateWOth');
  }
}
async function rateSend(rec, patch, quiet) {
  const prev = rec.srv.urt;
  rec.srv.urt = normRate(Object.assign({ r: 0 }, prev || {}, patch, { at: Date.now() }));   // מיד על המסך; השרתון מאשר
  save();
  if (!quiet) render('none');
  let j = null;
  try { j = await net.api('rate', Object.assign({ job: rec.id }, patch)); } catch (e) { j = null; }
  if (j && j.ok) { rec.srv.urt = normRate(j.urt); save(); return true; }
  rec.srv.urt = prev; save();
  if (!quiet) render('none');
  flashSafe(T('studioRateErr'));
  return false;
}
function rsClose() { const v = document.querySelector('.st-rs'); if (v) { v.remove(); return true; } return false; }
function rateSheet(rec) {
  rsClose();
  const u = rec.srv.urt || {}, sel = new Set(u.w || []);
  const veil = h('div', 'st-rs'); veil.setAttribute('role', 'dialog'); veil.setAttribute('aria-modal', 'true'); veil.setAttribute('aria-label', T('studioRateWhyT'));
  const box = h('div', 'st-rs-box');
  const chips = h('div', 'st-rs-chips');
  for (const k of RATE_WHY) {
    const c = btn('st-rs-chip', whyName(k), () => { if (sel.has(k)) sel.delete(k); else sel.add(k); c.classList.toggle('on', sel.has(k)); c.setAttribute('aria-pressed', sel.has(k) ? 'true' : 'false'); }, 'why:' + k);
    c.classList.toggle('on', sel.has(k)); c.setAttribute('aria-pressed', sel.has(k) ? 'true' : 'false');
    chips.append(c);
  }
  const n = (u.c || []).length;
  box.append(h('div', 'st-rs-grab'), h('h2', 'st-rs-t', T('studioRateWhyT')), h('div', 'st-rs-s', T('studioRateWhyS')), chips);
  if (canPlay(rec)) box.append(list(rowNav({ tile: tile('flag', 'red'), label: T('studioRateFlagRow'), sub: n ? T('studioRateFlagged', { n }) : '',
    onClick: () => { rateSend(rec, { r: -1, w: [...sel] }, true); rsClose(); go('play', rec.id); }, k: 'rate-flag' })));   // הסיבות נשמרות גם בדרך לנגן
  box.append(btn('st-btn wide', T('studioRateSend'), () => { rsClose(); rateSend(rec, { r: -1, w: [...sel] }); }, 'rate-send'));   // השורה בכרטיס כבר אומרת "תודה — נשמר"
  veil.append(box);
  veil.addEventListener('click', (e) => { if (e.target === veil) rsClose(); });
  document.body.append(veil);
  const f = chips.querySelector('button'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {}
}
function rateCard(rec) {
  const u = rec.srv.urt, r = u ? u.r : 0;
  if (r && rateChg !== rec.id) {
    const d = h('div', 'st-rate done');
    d.append(ico('check'), h('span', 'st-rate-l', T('studioRateSaved')), btn('st-rate-chg', T('studioRateChange'), () => { rateChg = rec.id; render('none'); }, 'rate-chg'));
    return d;
  }
  const d = h('div', 'st-rate');
  const b = (k, icn, lbl, on) => { const x = btn('st-rate-b ' + k + (on ? ' on' : ''), null, null, 'rate-' + k); x.append(ico(icn)); x.setAttribute('aria-label', lbl); return x; };
  const up = b('up', 'thumbUp', T('studioRateUp'), r === 1), dn = b('dn', 'thumbDn', T('studioRateDn'), r === -1);
  up.addEventListener('click', () => { rateChg = ''; rateSend(rec, { r: 1 }); });
  dn.addEventListener('click', () => { rateChg = ''; rateSend(rec, { r: -1 }).then((ok) => { if (ok) rateSheet(rec); }); });   // 👎 נשמר מיד — גם אם סוגרים את הגיליון
  d.append(h('span', 'st-rate-l', T('studioRateQ')), up, dn);
  return d;
}
const rateFlagT = new Map();               // סימונים בנגן — נשלחים שנייה וחצי אחרי האחרון (לא בכל נגיעה)
function rateFlagOpts(rec) {
  if (!rateOk(rec)) return {};
  return { flags: (rec.srv.urt && rec.srv.urt.c) || [], flagMax: RATE_FLAG_MAX, onFlag: (ids) => {
    clearTimeout(rateFlagT.get(rec.id));
    rateFlagT.set(rec.id, setTimeout(() => { rateFlagT.delete(rec.id); rateSend(rec, { c: ids }, true); }, 1500));
  } };
}
function pageJob(p) {
  const rec = jobRec(ui.param);
  if (!rec) { back(); return; }
  const id = rec.id;
  amMaybe(rec);
  p.append(navBar({ back: T('studioShort') }));
  const t1 = h('h1', 'st-large clamp'); t1.append(h('bdi', null, fileTitle(rec.spec.name) || T('studioUntitled')));
  p.append(t1);
  const ab = accessBanner(); if (ab) p.append(ab);
  const run0 = runs.get(id), ph0 = jobPhase(rec, run0);
  const toTxt = langsSum(rec.spec.to);

  // למעלה: טבעת + "נשארו בערך…" + "יהיה מוכן בסביבות…" — 25/10/2026: כרטיס אחד, ובתוכו גם "מה קורה עכשיו" (עד היום שני כרטיסים)
  const hero = h('div', 'st-jhero');
  const htop = h('div', 'st-jtop');
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
  htop.append(ring, ht);
  hero.append(htop);
  live(hero, () => {
    const r = jobRec(id); if (!r) return;
    const run = runs.get(id), ph = jobPhase(r, run), hs = heroState(r, run, ph);
    const pv = hs.check ? hs.pct : shownPct(r, hs.pct, ph === 'failed' || ph === 'cancelled' || ph === 'stuck' ? '' : 'h');
    arc.style.strokeDashoffset = String(Math.round(170 * (1 - pv)));
    pctEl.textContent = hs.check ? '✓' : Math.round(pv * 100) + '%';
    ring.classList.toggle('ok', !!hs.check);
    big.textContent = hs.big; sub.textContent = hs.sub; sub.hidden = !hs.sub;
  });
  p.append(hero);
  // 26/10/2026 (בעקבות Vid Hub): הטלפון בלי רשת בזמן שהעבודה רצה בשרת — פס קטן, נעלם לבד כשהחיבור חוזר (offlineNote)
  p.append(live(h('p', 'st-offl'), (el) => { const r = jobRec(id), t = r && offlineNote(r, runs.get(id), navigator.onLine === false); el.hidden = !t; if (t) el.textContent = t === 'studioOfflRun' ? T('studioOfflRun') : T('studioOfflDone'); }));
  const ask = askCard(rec);   // שאלה מ־Claude — מעל הכל, כי היא מחכה לך
  if (ask) p.append(ask);
  if (rec.spec.ph) p.append(phCard(rec));   // 24/10/2026: תרגום בטלפון — הסרטון, המדידות והצריבה בטלפון
  const cpc = cpCard(rec);   // סבב 10: העתק־הדבק — בקשה שמחכה לתשובה מ־Claude שלך
  if (cpc) p.append(cpc);
  const tstop = towerStopCard(rec);   // v362: מגדל הפיקוח עצר — מה קרה, מה זה אומר, המספרים
  if (tstop) p.append(tstop);
  const tline = towerLine(rec);
  if (tline) p.append(tline);
  const ix = ui.inc && ui.inc.list.find((x) => x.j === rec.id);   // v371: התקלה של העבודה — שורה אחת, הפרטים בדף התקלה
  if (ix) p.append(list(incRow(ix, true)));
  // 26/10/2026 (בעקבות Vid Hub): העיצוב אפשר לשנות גם בזמן ההמתנה — העובד שואל לפני הבנייה, עד שהצריבה מתחילה
  if (styEditable(rec) && !rec.spec.ka) p.append(styFold('job:' + rec.id, rec.spec.sty || {}, (patch) => jobStySet(rec, patch)));

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
  const outs = ph0 === 'done' ? ((rec.srv && rec.srv.out) || []).filter((o) => OUT_MAIN.includes(o.k)) : [];   // קבצי עזר (cues/vtt/ass) — לנגן ולעורך
  // 21/10/2026: התוצרים עלו והעובד עוד משלים ברקע (איכויות צפייה לנגן, עותק למאגר הלמידה) — הם כבר שלך, בלי לחכות
  const early = ph0 !== 'done' && rec.srv && rec.srv.state === 'running' ? (rec.srv.out || []).filter((o) => OUT_MAIN.includes(o.k)) : [];
  // 21/10/2026 (תוכנית השיפור 3.13ג): הכתוביות עולות לפני הצריבה — הנגן זמין עם הסרטון המקורי, בלי לחכות לצריבה
  const burning = early.length && !early.some((o) => o.k !== 'srt' && o.k !== 'en');
  if (early.length && burning && canPlay(rec)) p.append(btn('st-btn wide', T('studioPlWatch'), () => go('play', id), 'play'));
  if (early.length) p.append(secT(T('studioSecResults')), list(...early.map((o) => rowOut(rec, o))), note(burning ? T('studioOutEarlySubs') : T('studioOutEarly')));
  if (outs.length) {
    if (canPlay(rec)) hero.append(btn('st-btn in-card', T('studioPlWatch'), () => go('play', id), 'play'));   // מ1: הנגן — 25/10/2026: בתוך כרטיס הראש
    p.append(secT(T('studioSecResults')), list(...outs.map((o) => rowOut(rec, o)),
    canEdit(rec) ? rowNav({ tile: tile('edit', 'blue'), label: T('studioSeTitle'), sub: rec.srv.ev ? T('studioSeEdited', { n: rec.srv.ev }) : '', onClick: () => go('subs', id), k: 'subs' }) : null,   // מ2
    canEdit(rec) ? rrRow(rec, 'rr') : null,
    canEdit(rec) ? rowNav({ tile: tile('spark', 'teal'), label: T('studioIdTitle'), sub: T('studioIdSub'), onClick: () => go('ideas', id), k: 'ideas' }) : null,   // מ8
    driveOk() && outs.some((o) => DX_MOVE.includes(o.k) || o.k === 'srt') ? dxRow(rec) : null,   // 26/10/2026: ״הסרטונים שלי״ ב־Drive   // התוצר לתיקייה שבחרת ב־Drive
    jobFolder(rec) && !isR2Folder(jobFolder(rec)) ? rowExt({ href: 'https://drive.google.com/drive/folders/' + jobFolder(rec), tile: tile('cloud', 'teal'), label: T('studioOpenDrive'), k: 'drive-folder' }) : null,
    btn('st-row st-act', T('studioRcpt'), () => shareReceipt(rec), 'receipt')));   // שלב 4: קבלה
    const kn = keepNote(rec);   // 26/10/2026: עד מתי אפשר לצרוב מחדש ועד מתי הקבצים נשמרים
    if (kn) p.append(kn);
    if (rateOk(rec)) p.append(rateCard(rec));   // 25/10/2026: איך יצא התרגום? (המשוב שלך)
    const aa = canEdit(rec) ? afterAdvice(rec, { rrDone: !!(rrJobs.get(rec.id) && rrJobs.get(rec.id).srv && rrJobs.get(rec.id).srv.state === 'done') }) : [];
    if (aa.length) p.append(secT(T('studioAdvAfterT')), list(...aa.map((a) => rowNav(a.k === 'jd'
      ? { tile: tile('spark', 'teal'), label: T('studioAdvJd', { n: a.n }), sub: T('studioAdvJdS'), onClick: () => { aiPreset = { id: rec.id, ids: rec.srv.jd.f }; go('subs', rec.id); }, k: 'adv-jd' }
      : a.k === 'ask' ? { tile: tile('help', 'orange'), label: T('studioAdvAsk'), sub: T('studioAdvAskS', { a: rec.srv.qa.a.t }), onClick: () => { aiPreset = { id: rec.id, free: askFixNote(rec.srv.qa), run: true }; go('subs', rec.id); }, k: 'adv-ask' }
      : a.k === 'rvf' ? { tile: tile('edit', 'orange'), label: T('studioAdvRvf', { n: a.n }), sub: rvfSub(rec.srv.rvf), onClick: () => { seOnly = rec.id; go('subs', rec.id); }, k: 'adv-rvf' }   // סבב 4
      : { tile: tile('film', 'blue'), label: T('studioAdvVert'), sub: T('studioAdvVertS'), onClick: () => go('rr', rec.id), k: 'adv-vert' }))));   // סבב 2: הצעות אחרי
  } else if (!quiet && !qaPending(rec) && !tstop) { nowc.classList.add('in'); hero.append(nowc); }   // 25/10/2026: בתוך כרטיס הראש
    // כרטיס העצירה כבר אומר מה קרה   // שאלה פתוחה — כרטיס השאלה הוא "מה קורה עכשיו"
  // פעולה לפי המצב: בחירה חוזרת / המשך / נסיון חוזר / התחלה
  const acts = [];
  const uh = upHalt(rec, run0);
  if (uh) acts.push(uh === 'need' ? btn('st-btn wide', T('studioRepickBtn'), () => repickFor(id), 'repick') : btn('st-btn wide', T('studioResume'), () => resumeJob(id, true), 'resume'));
  else if (ph0 === 'need') acts.push(btn('st-btn wide', T('studioRepickBtn'), () => repickFor(id), 'repick'));
  else if (ph0 === 'paused' || ph0 === 'error') acts.push(btn('st-btn wide', ph0 === 'error' ? T('studioRetry') : T('studioResume'), () => resumeJob(id, true), 'resume'));
  else if (ph0 === 'ready' && rec.up.wait === 'conn_missing') acts.push(btn('st-btn wide', T('studioConnectNow'), () => go('eng'), 'connect-now'));
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
    const cm = costStop(rec.srv) ? cheaperModes(rec.spec.mode).filter((x) => modeOk(x, ui.mf))[0] : '';   // 15/10: רק מצב פתוח (השרתון אוכף)
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
    if (rec.spec.ka && (s.id === 'tl' || s.id === 'rv')) continue;   // 26/10/2026: קריוקי — בלי תרגום וביקורת
    const row = h('div', 'st-stg ' + s.state);
    const dot = h('span', 'dot');
    if (s.state === 'done') dot.append(ico('check'));
    else if (s.state === 'now') dot.append(h('span', 'st-spin'));
    const txt = h('span', 'st-l');
    const sk = rec.spec.ka ? 'ka' : rec.spec.src === 'subs';
    txt.append(h('b', null, stageName(s.id, toTxt, sk)), h('small', null, stageSub(s.id, sk)));
    const tm = h('span', 'st-stg-t');
    row.append(dot, txt, tm);
    if (s.state === 'now') { const pb = h('span', 'st-pbar'); const pi = h('i'); pb.append(pi); txt.append(pb); live(pb, () => { const mm = modelFor(jobRec(id) || rec).stages.find((x) => x.id === s.id); pi.style.width = Math.round(100 * shownPct(jobRec(id) || rec, mm && (mm.pv != null ? mm.pv : mm.p), s.id)) + '%'; }); }
    // 21/10: "לוקח יותר מהרגיל" — שורה מתחת לפס, לא ליד הזמן (טקסט ארוך שלא נשבר דחס את שם השלב לעמודה צרה)
    const ov = s.state === 'now' ? h('small', 'st-stg-ov', T('studioStageLong')) : null;
    if (ov) { ov.hidden = !s.over; txt.append(ov); }
    live(tm, () => {
      const mm = modelFor(jobRec(id) || rec).stages.find((x) => x.id === s.id) || s;
      if (ov) ov.hidden = !(mm.state === 'now' && mm.over);
      tm.textContent = mm.state === 'done' ? (mm.took ? '✓ ' + fmtShort(mm.took) : '✓') : mm.state === 'now' ? T('studioStageLeft', { t: fmtShort(mm.left) }) : approx(fmtShort(mm.est));
    });
    stl.append(row);
  }
  if (ph0 === 'done') {   // 25/10/2026: הסתיימה — השלבים מקופלים בשורה אחת (כמה לקח בסך הכל); בזמן עבודה — גלויים
    const tot = m0.stages.reduce((a, x) => a + (x.took || 0), 0);
    const sd = h('details', 'st-stdet'); sd.dataset.k = 'stages';
    const sm = h('summary', 'st-row st-ric'); sm.append(tile('check', 'green'), rowTxt(T('studioSecStages'), tot ? T('studioStagesDone', { t: fmtShort(tot) }) : null), ico('chev', 'st-chev'));
    sd.append(sm, stl);
    p.append(h('div', 'st-gap'), list(sd));
  } else p.append(secT(T('studioSecStages')), stl);
  if (rec.srv && rec.srv.sla) p.append(...slaCard(rec));   // v377: יעד זמן ותקציב
  p.append(...anJobRows(rec));   // v385: השלבים שחרגו מהרגיל שלך

  if (rec.srv) {   // v374: איכות הכתוביות + שומר ההזרקות · v375: שופט האיכות (והמודל שלו — משורת העלות)
    const jr = (rec.srv.use || []).find((r) => r.k === 'jg');
    p.append(...qualityCard(rec.srv.q, rec.srv.ij, rec.srv.jd, jr ? modelLabel(jr.m) : ''));
  }
  if (rec.srv && rec.srv.gl) p.append(...glossJobCard(rec.srv.gl, rec));   // v380: מונחים חדשים מהעבודה — למילון שלך, באישור
  p.append(...goldCard(rec));   // v387: סט הזהב — תרגום אנושי לייחוס, והציון מולו
  p.append(...orgRows(rec));   // 28/10/2026: מאיפה הגיע כל קובץ
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
    // 29/10/2026: באייפון אין העלאה ברקע בדפדפן בכלל — אומרים את זה, ומפנים לדרך שעוקפת: Google Drive מעלה ברקע, ואז "מ־Google Drive"
    let ios = false;
    try { ios = devCodes(navigator, window).dvp === 1; } catch (e) {}
    p.append(h('div', 'st-gap sm'), vc, note(ios ? (ui.gb ? T('studioKeepOpenIosD') : T('studioKeepOpenIos')) : T('studioKeepOpen')));
  }

  // פרטים טכניים — מוסתרים, למי שסקרן
  const det = h('details', 'st-details');
  if (ui.det) det.open = true;
  det.addEventListener('toggle', () => { ui.det = det.open; });
  const sum = h('summary', null, T('studioTech'));
  const rows = [
    kvRow(T('studioFile'), (() => { const s2 = h('span'); s2.append(fileNameEl(rec.spec.name || '—'), ' · ' + fmtSize(rec.spec.size)); return s2; })(), true),
    rec.spec.dur ? kvRow(T('studioDur'), fmtDur(rec.spec.dur), true) : null,
    rec.spec.ka ? null : kvRow(T('studioSecLangs'), langsText(rec.spec.from, rec.spec.to)),   // 30/10/2026: קריוקי — בלי Claude, בלי שפות ומודל
    rec.spec.ka ? null : kvRow(T('studioSecMode'), modeName(modeById(rec.spec.mode))),
    kvRow(T('studioSecOut'), (rec.spec.ka ? rec.spec.out : rec.spec.out.concat('srt')).map(outShort).join(' + ')),
    rec.spec.ka ? null : kvRow(T('studioSecStyle'), styleName(rec.spec.style)),
    rec.up.a.done ? kvRow(T('studioAudioK'), fmtSize(rec.up.a.size)) : rec.up.noAudio && rec.up.noAudio !== 'video_first' ? kvRow(T('studioAudioK'), T('studioNoAudio')) : null,
    kvRow(T('studioCreated'), fmtDate(rec.created)),
    kvRow(T('studioJobId'), rec.id, true),
    rec.srv && rec.srv.ed ? kvRow(T('studioErrCodeL'), rec.srv.ed, true) : null,
    kvRow(T('studioEtaK'), (() => { const n = planFor(rec).n || 0; return n ? T('studioEtaN', { n }) : T('studioEtaPrior'); })()),   // 10/10/2026: על מה הצפי מבוסס
    workerMsgRow(rec, ph0),
  ];
  const links = h('div', 'st-wacts');
  if (!outs.length) for (const o of (rec.srv && rec.srv.out) || []) links.append(isR2Id(o.id) ? btn('st-wbtn', outShort(o.k) + (o.size ? ' · ' + fmtSize(o.size) : ''), () => downloadOut(rec, o), 'out:' + o.k) : extLink('st-wbtn', 'https://drive.google.com/file/d/' + o.id + '/view', outShort(o.k) + (o.size ? ' · ' + fmtSize(o.size) : ''), 'out', 'out:' + o.k));
  if (rec.up.folder && !isR2Folder(rec.up.folder) && !outs.length) links.append(extLink('st-wbtn', 'https://drive.google.com/drive/folders/' + rec.up.folder, T('studioOpenDrive'), 'out', 'drive-folder'));
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
      bgAbort(id);
      if (removing) {
        if (!fin) await net.api('cancel', { job: id });
        const j = await net.api('remove', { job: id });
        if (!j.ok && j.error !== 'no_job') { flashSafe(errText(j.error)); return; }
        store.jobs = store.jobs.filter((x) => x.id !== id); runs.delete(id); handleOp('del', id); draftDel(id); handleOp('del', 'po:' + id); idbOp('thumbs', 'del', id); thumbs.delete(id); save();
        flashSafe(T('studioJobDeleted')); back();
      } else {
        const j = await net.api('cancel', { job: id });
        if (j.job) { const r = jobRec(id); if (r) r.srv = normJob({ id, srv: j.job }).srv; }
        save(); repaint();
      }
    };
    if (typeof askConfirm === 'function') askConfirm(removing ? (isR2Folder(jobFolder(rec)) ? T('studioJobDelQR2') : T('studioJobDelQ')) : T('studioJobCancelQ'), doIt, { danger: true, ok: removing ? T('studioDeleteOk') : T('studioJobCancelOk') });
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
/* מ9: מדריך קצר — למשתמשים נוספים: מה עושים, באיזה סדר, ומה עולה כסף */
function pageGuide(p) {
  p.append(navBar({ back: T('studioSettings') }), large(T('studioGuide')));
  const sec = (t, ...ls) => { p.append(secT(t)); for (const l of ls) p.append(note(l)); };
  sec(T('studioGd1'), T('studioGd1a'), T('studioGd1b'));
  sec(T('studioGd2'), T('studioGd2a'), T('studioGd2b'), T('studioGd2c'));
  sec(T('studioGd3'), T('studioGd3a'), T('studioGd3b'));
  sec(T('studioGd4'), T('studioGd4a'));
  sec(T('studioGd5'), T('studioGd5a'));
}
/* כרטיס בעמוד ההגדרות — כמו בהגדרות של Invest (.card מ־styles.css): כותרת בתוך הכרטיס, השורות בלי רקע משלהן */
/* 25/10/2026 (בקשת המשתמש — לפי ת־עיצוב): הכותרת קטנה ואפורה מעל הקבוצה, והקבוצה עצמה היא הכרטיס (עד היום — כרטיס עם
   כותרת גדולה בפנים, ובתוכו עוד רשימה עם רקע משלה: כרטיס בתוך כרטיס) */
function setCard(title, ...nodes) {
  const c = h('section', 'st-setgrp');
  if (title) c.append(secT(title));
  c.append(...nodes.filter(Boolean));
  return c;
}
/* עמוד ההגדרות (13/10/2026, בקשת המשתמש: "מסודר, נקי ואינטואיטיבי — לפי ת־עיצוב הייתה מתכננת"): כמו ב־Invest, ובשאר
   כמו בהגדרות של iOS — עמוד ראשי קצר עם שורות (סמל, שם, המצב הנוכחי, חץ), וכל נושא בעמוד משנה משלו:
     תרגום — Claude (מי מתרגם + החיבור / השרת), ברירות מחדל לכל פרויקט, מגדל הפיקוח
     כללי  — אחסון והעלאה (Google Drive, רק ב־Wi‑Fi), התראות, מדריך קצר
   ככה כל אפשרות נמצאת במקום אחד, והמצב שלה גלוי בלי להיכנס (מחובר / לא, פועל / כבוי) */
function engLabel() { return apiMode() ? T('studioConnApi') : cpMode() ? T('studioConnCopy') : T('studioConnSub'); }
function engReady() {                      // יש מי שיתרגם: Routine מחובר, או שרת פעיל במצב השרת / העתק־הדבק
  if (apiMode() || cpMode()) return !!(ui.api && ui.api.online);
  return !!store.conn;
}
function pageSettings(p) {
  const s = store.settings, m = modeById(s.mode);
  p.append(navBar({ back: T('studioDialHome'), go: () => stDialTo('home') }));   // בלי כותרת "הגדרות" — בקשת המשתמש; 30/10/2026: "‹ תרגום סרטונים" — לעמוד הראשי
  // באותה שפת עיצוב כמו ההגדרות של Invest: כרטיס החשבון של Invest בראש העמוד (shell.js, רק בדף העצמאי — בתיק
  // החשבון בהגדרות של Invest), "אפשרויות מתקדמות" ו"תצוגה" — ואז ההגדרות של הסטודיו בכרטיסים (.card מ־styles.css)
  const C = SA && SA.cards, A = SA && SA.auth;
  const ab = C && A && A.state() === 'out' ? null : accessBanner();   // לא מחובר — הכניסה בכרטיס החשבון (בלי כפילות)
  if (ab) p.append(ab);
  if (C) p.append(C.account());   // 25/10/2026: החשבון למעלה; התצוגה והמתקדמות — בסוף העמוד (מה שמשתמשים בו פחות)
  if (ui.push == null) refreshPush().then(() => { if (root && (ui.view === 'settings' || ui.view === 'push')) render('none'); });
  const ready = engReady(), apiOn = apiMode() || cpMode();
  const dr = store.drive, drOk = !!(dr && dr.connected);
  const pushOnNow = ui.push === 'on';
  p.append(setCard(T('studioGrpTr'), list(
    rowNav({ tile: tile('key', ready ? 'green' : 'orange'), label: 'Claude', sub: engLabel() + ' · ' + (ready ? T('studioConnOnShort') : T('studioNotConn')), onClick: () => go('eng'), k: 'eng' }),
    rowNav({ tile: tile('sliders', 'blue'), label: T('studioDefsT'), sub: modeShort(m) + ' · ' + langsSum(s.to), onClick: () => go('defs'), k: 'defs' }),
    rowNav({ tile: tile('shield', 'green'), label: T('studioTwT'), sub: T('studioTwRowS'), onClick: () => go('tower'), k: 'tower' }))));
  // שורת האחסון: מחובר — המייל של Drive (בבידוד: שם לטיני בתוך טקסט עברי); לא — "Google Drive · לא מחובר"
  const srow = rowNav({ tile: tile('cloud', drOk ? 'blue' : 'orange'), label: T('studioStoreT'), sub: drOk && dr.email ? null : 'Google Drive · ' + T('studioDriveNot'), onClick: () => go('store'), k: 'store' });
  if (drOk && dr.email) { const sm = h('small'); sm.append(h('bdi', null, dr.email)); srow.querySelector('.st-l').append(sm); }
  p.append(setCard(T('studioGrpGen'), list(
    srow,
    rowNav({ tile: tile('bell', 'red'), label: T('studioSecPush'), value: pushOnNow ? T('studioOnShort') : T('studioOffShort'), onClick: () => go('push'), k: 'push' }),
    rowNav({ tile: tile('help', 'blue'), label: T('studioGuide'), onClick: () => go('guide'), k: 'guide' }))));   // מ9: מדריך קצר
  p.append(setCard(T('studioLrnGrp'), list(lrnRow(), lrnForgetRow())));   // 25/10/2026: מאגר הלמידה — קבוצה משלו
  if (C) p.append(C.display(), C.advRow(() => go('adv')));
}
/* 14/10/2026 (בקשת המשתמש): מאגר הלמידה — אפשר לבטל. בלי שם ובלי פרטים אישיים; מה שכבר נאסף לא מקושר לחשבון */
function lrnRow() {
  const lr = rowSwitch({ label: T('studioLrnT'), sub: ui.lrn === false ? T('studioLrnOff') : T('studioLrnOn'), on: ui.lrn !== false, onClick: () => setLrn(ui.lrn === false), k: 'lrn' });
  if (lrnBusy || blocked()) lr.disabled = true;
  return lr;
}
let lrnBusy = false;
/* 15/10/2026 (מ׳1): הודעה אחת בכניסה הראשונה — מה נאסף ושאפשר לכבות. כל סגירה ("הבנתי", "חזור", לחיצה בחוץ) = נקראה;
   היא לא מכבה כלום בעצמה — הבחירה רק במתג בהגדרות */
let lrnAsked = false;
export const LRN_TV = 4;   // **זהה ל־LRN_TV/LRN_MV/LRN_FV בשרתון** — גרסת הנוסח (2 = גם טקסט הכתוביות ושמות הדוברים, 3 = גם הקול ועותק ב־240p — מ׳4, 4 = האיסוף המלא בתקופת הפיתוח)
const LRN_MV = 3;          // הנוסח הרגיל (כשהדגל learn_full כבוי)
/* 15/10/2026: כשהאיסוף המלא דולק (הדגל learn_full במרכז הניהול) — נוסח 4, שאומר שגם שם הקובץ, הטקסט המלא, הלוגים והשגיאות
   נשמרים; מי שקרא רק את 3 רואה אותו פעם אחת. כבוי — נוסח 3 כמו קודם */
const lrnFullOn = () => { try { const c = typeof sysCfgCached === 'function' ? sysCfgCached() : null; return !!(c && c.f && c.f.learn_full === true); } catch (e) { return false; } };
function lrnNotice() {
  const full = lrnFullOn();
  if (lrnAsked || (full ? ui.lrf : ui.lrm) || ui.access !== 'ok' || typeof askConfirm !== 'function') return;   // מי שקרא רק את הנוסח הקודם — רואה את החדש
  lrnAsked = true;
  setTimeout(() => askConfirm(full ? T('studioLrnAckQF') : T('studioLrnAckQ'), () => {
    ui.lra = ui.lrt = ui.lrm = Date.now();
    if (full) ui.lrf = ui.lrm;
    net.api('learnPref', { ack: true, tv: full ? LRN_TV : LRN_MV }).catch(() => {});
  }, { alert: true, ok: T('studioLrnAckOk') }), 700);
}
/* 15/10/2026 (מ׳1): "מחק את התרומות שלי" — הרשומות של כל העבודות שלך במאגר (גם של עבודות שנמחקו). באישור הרסני */
let lrnForgetBusy = false;
function lrnForgetRow() {
  // 25/10/2026: פעולה הרסנית = טקסט אדום בשורה, לפי ת־עיצוב (ההסבר בחלון האישור)
  const r = btn('st-row st-act danger', T('studioLrnForget'), () => askConfirm(T('studioLrnForgetQ'), lrnForget, { danger: true, ok: T('studioLrnForgetOk') }), 'lrnf');
  if (lrnForgetBusy || blocked()) r.disabled = true;
  return r;
}
async function lrnForget() {
  if (lrnForgetBusy) return;
  lrnForgetBusy = true; render('none');
  try {
    const j = await net.api('learnForget', {});
    flashSafe(j.ok ? T('studioLrnForgetDone', { n: num(j.n) }) : errText(j.error));
  } catch (e) { flashSafe(errText('net')); }
  finally { lrnForgetBusy = false; render('none'); }
}
async function setLrn(on) {
  if (lrnBusy) return;
  const prev = ui.lrn; ui.lrn = on; lrnBusy = true; render('none');
  try {
    const j = await net.api('learnPref', { on });
    if (!j.ok) { ui.lrn = prev; flashSafe(errText(j.error)); }
    else ui.lrn = j.lrn !== false;
  } catch (e) { ui.lrn = prev; flashSafe(errText('net')); }
  finally { lrnBusy = false; render('none'); }
}
/* Claude — מי עושה את העבודה, והחיבור: Routine (המנוי שלי) או השרת של המערכת (תקציב, תקרה לעבודה, השרת) */
function pageEng(p) {
  const s = store.settings;
  p.append(navBar({ back: T('studioSettings') }), large('Claude'));
  const ab = accessBanner(); if (ab) p.append(ab);
  // "המנוי שלי" (Routine) או "השרת של המערכת" (מפתח API בשרת שלנו, תקציב חודשי). העתק־הדבק — בשלב 7
  const isApi = apiMode();
  const pick = (c) => () => { s.conn = c; save(); render('none'); };
  if (ui.mf) p.append(setCard(T('studioWhoT'), list(   // 25/10/2026: למשתמשים — רק השרת של המערכת, בלי בחירה
    rowRadio({ label: T('studioConnSub'), sub: T('studioConnSubS'), on: !isApi && !cpMode(), onClick: pick('sub'), k: 'cn:sub' }),
    rowRadio({ label: T('studioConnCopy'), sub: T('studioConnCopyS'), on: cpMode(), onClick: pick('copy'), disabled: !ui.api, badge: ui.api ? null : T('studioSoon'), k: 'cn:copy' }),   // סבב 10
    rowRadio({ label: T('studioConnApi'), sub: T('studioConnApiS'), on: isApi, onClick: pick('api'), disabled: !ui.api, badge: ui.api ? null : T('studioSoon'), k: 'cn:api' }))));
  const c = store.conn;
  if (isApi) {
    // השרת של המערכת: בלי אשף ובלי Routine — רק התקציב, התקרה לעבודה והשרת
    const a = ui.api;
    p.append(setCard(T('studioSecApi'), list(
      kvRow(T('studioApiMonth'), a.nc ? T('studioApiNoCap', { a: fmtUsd(a.month) }) : T('studioApiOf', { a: fmtUsd(a.month), b: fmtUsd(a.cap) })),
      rowNav({ label: T('studioApiCap'), value: '$' + s.cap, onClick: () => go('def', 'cap'), k: 'def:cap' }),
      rowNav({ tile: tile('cloud', a.online ? 'green' : 'orange'), label: T('studioSrvT'), sub: a.online ? T('studioSrvOnN', { n: a.online }) : T('studioSrvNone'), onClick: () => go('server'), k: 'server' }))));
  } else if (!ui.mf) {
    // 25/10/2026: משתמש בלי "כל המודלים" — אין Routine; השרת עוד לא ענה / לא מוגדר — בלי אשף
  } else if (c) {
    const st = c.ok ? T('studioConnChecked', { t: fmtDate(c.ok) }) : T('studioConnUnchecked');
    const head = h('div', 'st-row st-ric');
    const hn = h('span', 'st-l'); hn.append(h('b', null, T('studioConnOn')));
    const hs = h('small'); hs.append(h('bdi', null, c.hint), ' · ' + st); hn.append(hs);
    head.append(tile('key', 'green'), hn);
    const busy = testRun && (testRun.st === 'fire' || testRun.st === 'wait');
    const tb = btn('st-row st-act', busy ? T('studioTesting') : T('studioTestConn'), runTest, 'test');
    tb.disabled = !!busy || blocked();
    p.append(setCard(T('studioSecConnect'), list(head, tb,
      rowNav({ label: T('studioReconnect'), onClick: () => go('connect'), k: 'wizard' }),
      btn('st-row st-act danger', T('studioDisconn'), disconnectClaude, 'disconnect')), testLine()));
  } else {
    p.append(setCard(T('studioSecConnect'), list(
      rowNav({ tile: tile('key', 'orange'), label: T('studioWizard'), sub: T('studioNotConn') + ' · ' + T('studioWizardS'), onClick: () => go('connect'), k: 'wizard' }))));
  }
}
/* ברירות מחדל לכל פרויקט — מה שהטופס של פרויקט חדש מתחיל ממנו */
function pageDefs(p) {
  const s = store.settings, m = modeById(s.mode);
  p.append(navBar({ back: T('studioSettings') }), large(T('studioDefsT')));
  p.append(setCard(null, list(
    rowNav({ label: T('studioSecMode'), value: modeShort(m), onClick: () => go('def', 'mode'), k: 'def:mode' }),
    rowNav({ label: T('studioTo'), value: langsSum(s.to), onClick: () => go('lang', 'def'), k: 'def:to' }),
    rowNav({ label: T('studioSecOut'), value: outList(s.out).map(outShort).join(' + '), onClick: () => go('def', 'out'), k: 'def:out' }),
    rowNav({ label: T('studioSecStyle'), value: styleName(s.style), onClick: () => go('def', 'style'), k: 'def:style' })), note(T('studioDefNote'))));
}
/* אחסון והעלאה — איפה הסרטונים נשמרים (Google Drive, חיבור נפרד מגיבוי הספרייה, v357) ואיך מעלים */
function pageStore(p) {
  const s = store.settings;
  p.append(navBar({ back: T('studioSettings') }), large(T('studioStoreT')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const dr = store.drive;
  const drow = h('div', 'st-row st-ric');
  const dl = h('span', 'st-l'); dl.append(h('b', null, 'Google Drive'));
  const dsub = h('small'); if (dr && dr.connected && dr.email) dsub.append(h('bdi', null, dr.email)); else dsub.textContent = T('studioDriveNot');
  dl.append(dsub);
  drow.append(tile('cloud', 'blue'), dl);
  const drows = [drow];
  if (!dr || !dr.connected) { const b = btn('st-row st-act', ui.driveBusy ? T('studioDriveBusy') : T('studioDriveConnect'), connectDrive, 'drive-connect'); b.disabled = ui.driveBusy || blocked(); drows.push(b); }
  if (dr && dr.connected) drows.push(rowNav({ tile: tile('folder', 'blue'), label: T('studioVidsT'), sub: T('studioVidsRowS'), onClick: () => goVids(''), k: 'vids' }));   // 26/10/2026
  p.append(setCard(T('studioSecDrive'), list(...drows), note(T('studioDriveNote'))));
  p.append(setCard(T('studioSecUpload'), list(
    rowSwitch({ label: T('studioWifiOnly'), sub: typeKnown() ? T('studioWifiOnlyS') : T('studioWifiUnknown'), on: s.wifi, onClick: () => { s.wifi = !s.wifi; save(); render('none'); }, k: 'wifi' }))));
}
/* התראות לטלפון (שלב 4) — מתג אחד; בדיקה כשפועל */
function pagePush(p) {
  p.append(navBar({ back: T('studioSettings') }), large(T('studioSecPush')));
  if (ui.push == null) refreshPush().then(() => { if (root && (ui.view === 'settings' || ui.view === 'push')) render('none'); });
  const pst = ui.push || 'off';
  const prow = rowSwitch({ label: T('studioPushT'), sub: ui.pushBusy ? T('studioPushBusy') : pst === 'on' ? T('studioPushOnS') : pst === 'denied' ? T('studioPushDenied') : pst === 'na' ? T('studioPushNa') : T('studioPushOffS'),
    on: pst === 'on', onClick: () => (pst === 'on' ? pushOff() : pushOn(false)), k: 'push' });
  if (pst === 'na' || pst === 'denied' || ui.pushBusy) prow.disabled = true;
  const prows = [prow];
  if (pst === 'on') prows.push(btn('st-row st-act', T('studioPushTest'), pushTest, 'push-test'));
  p.append(setCard(null, list(...prows)));
}
/* "אפשרויות מתקדמות" — העמוד של Invest אחד לאחד (shell.js): האפליקציה לאנדרואיד, גרסה וניקוי מטמון. רק בדף העצמאי */
function pageAdvanced(p) {
  p.append(navBar({ back: T('studioSettings') }), large(T('advancedTitle')));
  const C = SA && SA.cards;
  if (C) p.append(...C.advanced());
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
/* 27/10/2026 (בקשת המשתמש: "שההתראות יהיו פעילות בברירת מחדל"): בלי לחיצה בהגדרות. הרשאה שכבר ניתנה → מנוי בשקט
   בפתיחת Studio; עוד לא נשאלת → הבקשה בלחיצה על "תרגם" (Chrome מבקש הפעלת משתמש). כיבית בעצמך, או סירבת לבקשה → pno, ולא שואלים שוב */
async function pushAuto(byUser) {
  if (!PUSH_OK || ui.pushBusy || store.settings.pno || ui.access === 'signin' || ui.access === 'denied') return;
  const perm = Notification.permission;
  if (perm === 'denied' || (perm !== 'granted' && !byUser)) return;
  if (perm === 'granted') { if (ui.push == null) await refreshPush(); if (ui.push === 'on') return; }
  return pushOn(true);
}
async function pushOn(auto) {
  if (ui.pushBusy || !PUSH_OK) return;
  ui.pushBusy = true;
  try {
    const perm = await Notification.requestPermission();   // ראשון — בתוך הנגיעה
    if (perm !== 'granted') { ui.push = perm === 'denied' ? 'denied' : 'off'; if (auto === true) { store.settings.pno = 1; save(); } return; }
    if (store.settings.pno) { delete store.settings.pno; save(); }
    render('none');
    const k = await net.api('push', { act: 'key' });
    if (!k.ok || !k.key) throw new Error(k.error || 'key');
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uBytes(k.key) });
    const lang = String(document.documentElement.lang || 'he').startsWith('en') ? 'en' : 'he';
    const j = await net.api('push', { act: 'on', sub: sub.toJSON(), lang });
    if (!j.ok) throw new Error(j.error || 'on');
    ui.push = 'on';
    if (auto !== true) flashSafe(T('studioPushOnDone'));
  } catch (e) {
    if (auto !== true) flashSafe(T('studioPushErr'));
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
    store.settings.pno = 1; save();
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
const connNow = () => connFor(store.settings.conn, ui.mf);   // 25/10/2026: מה שבשימוש בפועל (למשתמשים — תמיד השרת)
const apiMode = () => connNow() === 'api' && !!ui.api;
// 24/10/2026: "המנוי שלי" + יש שרת במערכת — העבודה רצה בשרת שלנו, ו־Claude דרך ה־Routine שלך (ry). בלי שרת — כמו קודם
/* העבודה רצה בשרת, אבל ה־Routine שלך עוד לא התחבר אחרי 2 דק׳ (לרוב: הכתובת של התור חסרה ברשימת הכתובות של הסביבה) */
export const ryWaiting = (rec, now) => !!(rec && rec.srv && rec.srv.ry && !rec.srv.rc && rec.srv.fired > 0 && now - rec.srv.fired > 120e3);
export const ryOn = (conn, api) => conn === 'sub' && !!api && api.servers > 0;
const ryMode = () => ryOn(connNow(), ui.api);
const cpMode = () => connNow() === 'copy' && !!ui.api;   // סבב 10: העתק־הדבק — דרך השרת של המערכת (בלי עלות API)
const curNorm = () => (apiMode() ? ui.normA || ui.normR : ui.normR);   // "הרגיל" של המנוע שבשימוש
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
/* סבב 1: אחוז מהתקציב החודשי של השרת (מצב API) — העבודה מתוך התקרה החודשית. במנוי (Routine) Anthropic לא חושפת את מצב המכסה —
   לא ממציאים מספר. טהור */
export function quotaPct(rec, api) {
  const sv = rec && rec.srv, cv = sv ? costView(sv.use, rec.spec.mode) : null;
  if (!sv || sv.eng !== 'api' || !cv || !(cv.total > 0) || !api || api.nc || !(api.cap > 0)) return null;
  const pct = cv.total / api.cap * 100;
  return { pct: pct < 1 ? Math.round(pct * 10) / 10 : Math.round(pct), cap: api.cap };
}
export function receiptText(rec, api) {
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
  const qp = quotaPct(rec, api);
  if (qp) kv(T('studioRcptQuota'), T('studioRcptQuotaV', { p: qp.pct, cap: fmtUsdWhole(qp.cap) }));
  if (sv.q && sv.q.s != null) kv(T('studioQT'), sv.q.s + '/100');
  if (sv.jd && sv.jd.s != null) kv(T('studioRcptJudge'), sv.jd.s + '/100');
  kv(T('studioJobId'), rec.id);
  return L.join('\n');
}
async function shareReceipt(rec) {
  const txt = receiptText(rec, ui.api);
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
    quality: srv.q ? srv.q.s : null, cues: srv.q ? srv.q.n : null, judge: srv.jd ? srv.jd.s : null, state: srv.state || '',
    gold: srv.gq ? { chrf_doc: srv.gq.s, cover: srv.gq.tm, n: srv.gq.n } : null };   // v387: סט הזהב — chrF++ מסמך (אותה נוסחה של tedeval) מול הייחוס שהעלית
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
/* ת7 (11/10/2026): יומן השרת — קודים קבועים מהעובד (normEv בשרתון) */
function srvEvText(k) {
  switch (k) {
    case 'up': return T('studioSrvEvUp');
    case 'job': return T('studioSrvEvJob');
    case 'done': return T('studioSrvEvDone');
    case 'fail': return T('studioSrvEvFail');
    case 'stop': return T('studioSrvEvStop');
    case 'oom': return T('studioSrvEvOom');
    case 'timeout': return T('studioSrvEvTimeout');
    case 'crash': return T('studioSrvEvCrash');
    case 'auth': return T('studioSrvEvAuth');
    case 'net': return T('studioSrvEvNet');
    case 'warm': return T('studioSrvEvWarm');
    case 'lost': return T('studioSrvEvLost');
    case 'park': return T('studioSrvEvPark');
    default: return '';
  }
}
export function srvEvents(hb) {   // טהורה: מהחדש לישן, רק קודים מוכרים, עד 8
  const a = hb && Array.isArray(hb.ev) ? hb.ev : [];
  return a.filter((x) => Array.isArray(x) && x.length === 2 && Number(x[0]) > 0 && srvEvText(String(x[1])))
    .map((x) => ({ t: Number(x[0]) * 1000, k: String(x[1]) })).reverse().slice(0, 8);
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
    if (sv.ba && sv.ba > sv.seen) l.append(h('small', 'st-warn', T('studioSrvAuthBad', { t: fmtDate(sv.ba) })));   // 15/10: הטוקן נדחה — מה עושים
    if (sv.hb && sv.hb.iso && stt !== 'off') l.append(h('small', null, isoTxt(sv.hb) + (sv.hb.al === 'o' ? ' · ' + T('studioAlOnnx') : '')));   // ת2: בידוד הקופסה · שלב 4.1: היישור
    if (sv.job) { const js = h('small'); js.append(T('studioSrvJob') + ' '); js.append(h('bdi', null, sv.job.name ? fileTitle(sv.job.name) : T('studioSrvJobOther'))); l.append(js); }
    const evs = srvEvents(sv.hb);
    if (evs.length) {   // ת7: יומן השרת — מקופל; בלי להיכנס לקונסולה של Hetzner
      const det = h('details', 'st-details st-srvev'); det.dataset.k = 'srv-ev:' + sv.id;
      det.append(h('summary', null, T('studioSrvEvT')));
      for (const e of evs) det.append(h('small', null, fmtDate(e.t) + ' · ' + srvEvText(e.k)));
      l.append(det);
    }
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
  p.append(navBar({ back: k === 'cap' ? 'Claude' : T('studioDefsT') }));   // חזרה לעמוד שממנו באים (13/10/2026)
  if (k === 'mode') p.append(large(T('studioSecMode')), ...modePicker(s.mode, (id) => set(() => { s.mode = id; })));
  else if (k === 'out') p.append(large(T('studioSecOut')), outRows(s.out, 0, (o) => set(() => { s.out[o] = !s.out[o]; })));
  else if (k === 'style') p.append(large(T('studioSecStyle')), stylePicker(s.style, (st) => set(() => { s.style = st; })));
  else if (k === 'cap') { p.append(large(T('studioApiCap')), list(...CAPS.map((c) => rowRadio({ label: '$' + c, on: s.cap === c, onClick: () => set(() => { s.cap = c; }), k: 'cap:' + c }))), note(T('studioApiCapNote'))); return; }
  else back();
}

/* אשף החיבור — שלושת השלבים של ההגדרה החד־פעמית: סביבה, Routine עם טריגר API, הדבקה ובדיקה.
   המפתח שמודבק נשלח לשרתון ונשמר שם רק מוצפן; בטלפון הוא רק בשדה, עד שהשמירה הצליחה (או שיוצאים מהדף) */
function pageConnect(p) {
  p.append(navBar({ back: 'Claude' }), large(T('studioWizT')), h('p', 'st-lede', T('studioWizLede')));
  const ab = accessBanner(); if (ab) p.append(ab);
  const link = (href, k, label) => {
    const a = h('a', 'st-wbtn'); a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.dataset.k = k;
    a.append(ico('out'), h('span', null, label));
    return a;
  };
  let host = 'ibkr-proxy-wine.vercel.app';
  try { host = new URL(proxyBase()).host || host; } catch (e) {}
  // 24/10/2026: תור ההעברה ("המנוי שלי" דרך השרת) — ה־Routine פונה אליו ישירות
  const hub = typeof window !== 'undefined' && window.SNB_ENV && window.SNB_ENV.name === 'staging' ? 'api-staging.thesnowball.app' : 'api.thesnowball.app';
  const hosts = Array.from(new Set([host, hub])).concat(HOSTS_EXTRA).join('\n');
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
  const one = (rec) => { const run = runs.get(rec.id); return rec.id + ':' + jobPhase(rec, run) + ':' + modelFor(rec).stages.map((s) => s.state[0]).join('') + ':' + (rec.up.v.done ? 1 : 0) + (rec.up.wait || '') + (rec.srv && rec.srv.use ? 'u' : '') + (rec.srv && rec.srv.qa ? rec.srv.qa.id + (rec.srv.qa.a ? 'a' : '') : '') + (rec.srv && rec.srv.ck ? rec.srv.ck.s : '') + (ui.resuming === rec.id ? 'r' : '') + (rec.srv && rec.srv.tw ? rec.srv.tw.lv + rec.srv.tw.x + (rec.srv.tw.sh ? 's' : '') : '') + (recovering(rec) ? 'R' : '') + (rec.srv && rec.srv.nt ? 'n' + rec.srv.nt.h.length + (rec.srv.nt.p ? 'p' : '') : '') + (rec.srv && rec.srv.cp ? 'c' + rec.srv.cp.n + (rec.srv.cp.a ? 'a' : '') : '') + (cpBusy ? 'B' : '') + (rec.srv && rec.srv.out.length ? 'o' + rec.srv.out.length : '')
    + (rec.spec.ph && rec.srv ? 'P' + (rec.srv.m ? 1 : 0) + (rec.srv.pbn ? rec.srv.pbn.s + (rec.srv.pbn.at || '') : '') + (phBurnLive(rec) ? 'b' : '') + (phKeys.has(rec.id) ? 'k' : '') + (rec.srv.ppr ? (rec.srv.ppr.s === 'err' ? 'E' : phPrepLive(rec) ? 'L' : '') : '') + (rec.spec.vc ? 'V' + (rec.srv.fv ? 1 : rec.srv.vcp ? (rec.srv.vcp.e ? 'e' : Math.round(rec.srv.vcp.p * 20)) : '') : '') : ''); };   // 24/10/2026: תרגום בטלפון — המדידות והצריבה   // v382: הערה שנקראה / ממתינה; סבב 10: העתק־הדבק
  const incK = (j) => { const x = ui.inc && ui.inc.list.find((y) => y.j === j); return x ? x.no + x.st + x.s : ''; };
  if (ui.view === 'job') { const r = jobRec(ui.param); return 'job|' + (r ? one(r) : '') + '|' + ui.access + '|' + ui.halt + '|' + ui.kinds.join() + (r && towerStopped(r) && ui.fb ? '|' + ui.fb.filter((e) => e.fix).map((e) => e.fp).join() : '') + '|' + incK(ui.param) + '|' + (r && r.up.dx ? r.up.dx.st + Math.round(r.up.dx.p * 20) + r.up.dx.n : '') + (dxBusy === ui.param ? 'X' : ''); }   // 26/10/2026: השמירה ב־Drive
  if (ui.view === 'home') return 'home|' + store.jobs.map(one).join(',') + '|' + store.drafts.length + '|' + ui.access + '|' + (store.conn ? 1 : 0) + '|' + ui.halt + '|' + urgentAlerts().map((a) => a.id).join() + '|' + (majorOn(ui.inc) ? ui.inc.mi.no + ':' + ui.inc.mi.n : '');
  if (ui.view === 'tower' || ui.view === 'towerx' || TW_SUBS.includes(ui.view)) return ui.view + '|' + store.jobs.map(one).join(',') + '|' + ui.access + '|' + JSON.stringify(curNorm()) + JSON.stringify(ui.fb) + JSON.stringify(ui.ops) + JSON.stringify(ui.rl) + ui.halt + '|' + (ui.alAll ? 1 : 0) + JSON.stringify(ui.inc) + (ui.incAll ? 1 : 0) + JSON.stringify(ui.ag) + JSON.stringify(ui.pb) + (ui.pbAll ? 1 : 0) + JSON.stringify(ui.rb) + JSON.stringify(ui.sc) + JSON.stringify(ui.va) + JSON.stringify(ui.slo) + JSON.stringify(ui.sh) + JSON.stringify(ui.an);   // v383 · v384
  if (ui.view === 'alert') return 'alert|' + ui.param + '|' + ui.access + '|' + JSON.stringify(ui.ops) + (ui.alTab || 'd') + ui.muPick + ackBusy + JSON.stringify(ui.fb) + store.jobs.map((r) => r.id + (r.srv && r.srv.fr ? r.srv.fr.s : '')).join();
  if (ui.view === 'agents') return 'agents|' + ui.access + '|' + JSON.stringify(ui.ag);
  if (ui.view === 'scan') return 'scan|' + ui.access + '|' + JSON.stringify(ui.sc) + scanBusy + (ui.scOk ? 1 : 0);   // v378
  if (ui.view === 'value') return 'value|' + ui.access + '|' + JSON.stringify(ui.va) + (priceBusy ? 1 : 0);   // v377
  if (ui.view === 'slo') return 'slo|' + ui.access + '|' + JSON.stringify(ui.slo) + store.jobs.length;   // v383
  if (ui.view === 'anom') return 'anom|' + ui.access + '|' + JSON.stringify(ui.an) + store.jobs.length;   // v385
  if (ui.view === 'prob') return 'prob|' + ui.param + '|' + ui.access + '|' + JSON.stringify(ui.pb) + JSON.stringify(ui.inc) + (fixBusy ? 1 : 0);   // v376
  if (ui.view === 'inc') return 'inc|' + ui.param + '|' + ui.access + '|' + (pirBusy ? 1 : 0) + JSON.stringify(ui.inc) + ui.incTab + JSON.stringify(ui.fb) + (ui.resuming || '') + store.jobs.map((r) => r.id + (canResume(r) ? 'r' : '')).join();
  if (ui.view === 'server') return 'server|' + ui.access + '|' + JSON.stringify(ui.api) + JSON.stringify(ui.servers) + ui.srvQueue + '|' + (ui.newToken ? 1 : 0) + ui.srvBusy;
  if (ui.view === 'rules' || ui.view === 'rlb' || ui.view === 'rlm') return ui.view + '|' + ui.access + '|' + JSON.stringify(ui.rl) + ui.fm + gl.st + gl.rows.length + (rulesBusy ? 'b' : '');
  if (ui.view === 'subs') { const r = jobRec(ui.param); return 'subs|' + ui.param + '|' + (se ? se.st : '') + '|' + ui.access + '|' + (r && r.srv ? r.srv.ev + ':' + r.srv.vh.length : '') + (r && rrJobs.get(r.id) ? rrJobs.get(r.id).srv.state : ''); }   // מ2: לא נבנה מחדש בזמן הקלדה
  if (ui.view === 'rr') { const x = rrJobs.get(ui.param), v = rrPv.get(ui.param); return 'rr|' + ui.param + '|' + ui.access + '|' + (x ? x.srv.state + JSON.stringify(x.srv.prog) + x.srv.out.length : '') + '|' + (v ? v.srv.state + JSON.stringify(v.srv.prog) + v.srv.out.length : '') + (rrBusy ? 1 : 0) + JSON.stringify(rrOpt) + (seDirty() ? 'd' : ''); }
  if (ui.view === 'ideas') return 'ideas|' + ui.param + '|' + ui.access + '|' + (idea ? idea.k + idea.mode + (idea.busy ? 'b' : '') + (idea.cues ? idea.cues.length : 'l') + (idea.text != null ? 't' + idea.text.length : '') : '');   // מ8
  if (ui.view === 'ai') return 'ai|' + ui.param + '|' + ui.access + '|' + (ai ? ai.k + ai.scope + ai.mode + ai.queue.length + (ai.busy ? 'b' : '') + (ai.items ? 'i' + ai.items.length + ':' + [...ai.acc].join('.') : '') : '');   // מ7
  if (ui.view === 'cut' || ui.view === 'cutsrc') return ui.view + '|' + ui.param + '|' + (ce ? ce.key + (ce.cues ? ce.cues.length : '') : '') + '|' + ui.access;   // מ4–מ5: לא נבנה מחדש בזמן עריכה
  if (ui.view === 'play') return 'play|' + ui.param + '|' + (pl ? pl.st + pl.iss.length : '') + '|' + ui.access;   // מ1: הנגן לא נבנה מחדש
  if (ui.view === 'gloss') return 'gloss|' + ui.access + '|' + gl.st + (gl.busy ? 1 : 0) + JSON.stringify(gl.rows) + gl.q + '|' + JSON.stringify(store.drive);   // v380
  if (ui.view === 'settings' || ui.view === 'connect' || ui.view === 'eng' || ui.view === 'store' || ui.view === 'push') return ui.view + '|' + (ui.push || '') + (ui.pushBusy ? 'b' : '') + '|' + (testRun ? testRun.st + (testRun.claimed ? 'c' : '') : '') + '|' + ui.access + '|' + JSON.stringify(store.conn) + JSON.stringify(store.drive) + ui.driveBusy + store.settings.conn + store.settings.cap + JSON.stringify(ui.api) + '|' + ui.lrn + (lrnBusy ? 'b' : '') + (lrnForgetBusy ? 'f' : '');
  return ui.view + '|' + ui.access;
}
let paintT = 0;
function paintSoon() { if (!paintT) paintT = setTimeout(() => { paintT = 0; livePaint(); }, 250); }
/* 27/10/2026 (המשתמש: "השלבים לא מתעדכנים בווילון ההתראות"): השרתון שולח התראת שלב רק כשהעובד מדווח — בשלבים של Claude
   (תרגום, בדיקה) כמעט אין אחוזים, וההתראה נשארה על 0% כל השלב. כש־Studio פתוחה הדף מעדכן את אותה התראה (התג של העבודה)
   כל SHADE_MS לפי ההערכה שבמסך — אותו נוסח של השרתון (stageText ב־webpush.js); sw.js לא נותן לדיווח ישן להחזיר אחורה.
   רק כשההתראות דלוקות, ולא בזמן ההעלאה ברקע (ל־Chrome יש התראה משלו) */
/* 27/10/2026 (בקשת המשתמש: "נתונים יותר מעודכנים — יש דיליי קל ביחס לעמוד העבודה"): כל שנייה (shadeT), לא רק כשהדף מצויר מחדש */
const SHADE_MS = 1000, shadeLast = new Map(), shadeGone = new Set(), shadeRate = new Map();
let shadeT = 0;
/* שורת ההעלאה בהתראה: "עלו 140MB מתוך 520MB · 4.2MB לשנייה". המהירות — מדגימה משלה כל שנייה (ממוצע נע קצר),
   כדי שתגיב מהר יותר מ־run.rate (דגימה כל 2 שנ׳) */
function shadeUpLine(rec, run, now) {
  if (!run || !run.active || run.phase !== 'video') { shadeRate.delete(rec.id); return ''; }
  const sent = run.sent || 0, size = rec.spec.size || run.total || 0;
  let r = shadeRate.get(rec.id);
  if (!r || sent < r.b) { r = { t: now, b: sent, v: run.rate || 0 }; shadeRate.set(rec.id, r); }
  else if (now - r.t >= 900) { const v = (sent - r.b) / ((now - r.t) / 1000); r.v = r.v ? r.v * 0.5 + v * 0.5 : v; r.t = now; r.b = sent; }
  const parts = [T('studioShadeUpOf', { a: shadeIso(fmtSize(sent)), b: shadeIso(fmtSize(size)) })];
  if (r.v > 0) parts.push(T('studioPerSec', { v: shadeIso(fmtSize(r.v)) }));
  return shadeDir() + parts.join(' · ');
}
/* כיוון השורה: "81MB" בתחילתה (אות לטינית ראשונה) הופכת שורה בעברית לשמאל־לימין — הפס מתהפך והמספרים מתערבבים
   (צילום מהטלפון, 27/10/2026). RLM בתחילת כל שורה בעברית */
const shadeDir = () => (uiLang() === 'en' ? '' : '\u200F');
/* כל "81MB" מבודד (LRI…PDI): בלי זה "162MB · 436KB" נדבקים לרצף אחד משמאל לימין, והמהירות נקראת לפני הגודל ("מסודר
   בסדר הגיוני", 27/10/2026). בתוך הבידוד המספר והיחידה נשארים "81MB" */
const shadeIso = (x) => (uiLang() === 'en' ? x : '\u2066' + x + '\u2069');
/* בקשת המשתמש: "בר התקדמות להעלאה שנראה בדיוק כמו של השלבים", "מסודר כמו החלק העליון" — אותו מבנה: שם, ואז פס ואחוז,
   ואז כמה עלה ומהירות. כשההעלאה עצמה השלב הנוכחי — השורה הראשונה כבר הפס שלה, ומוסיפים רק את השורה האחרונה */
function shadeUpBlock(rec, run, now, curSt) {
  const ln = shadeUpLine(rec, run, now);
  if (!ln) return '';
  if (curSt === 'up') return ln;
  const size = rec.spec.size || run.total || 0, up = size > 0 ? Math.max(0, Math.min(1, (run.sent || 0) / size)) : 0;
  return shadeDir() + T('studioShadeUp') + '\n' + shadeDir() + shadeBar(up, uiLang()) + '  ' + Math.round(up * 100) + '%\n' + ln;
}
/* 27/10/2026: עבודה שכבר לא רצה (בוטלה, נגמרה בלי שהתראת הסוף הגיעה) — התראת השלב נסגרת (sw.js מחזיר רק כשהמשתמש סגר) */
function shadeEnd(id) {
  navigator.serviceWorker.ready.then((reg) => reg.getNotifications({ tag: 'studio-' + id }))
    .then((ns) => { for (const n of ns) if (n.data && n.data.k === 'stage') n.close(); }).catch(() => {});
}
let shadeAt = 0;
export function shadeBar(p, lang) {
  const n = 10, f = Math.max(0, Math.min(n, Math.round((Number(p) || 0) * n)));
  return (lang === 'en' ? '\u2066' : '\u2067') + '▰'.repeat(f) + '▱'.repeat(n - f) + '\u2069';
}
function shadeSync() {
  const now = Date.now();
  if (now - shadeAt < SHADE_MS - 150 || ui.push !== 'on' || typeof navigator === 'undefined' || !navigator.serviceWorker) return;
  shadeAt = now;
  for (const rec of store.jobs) {
    const run = runs.get(rec.id), ph = jobPhase(rec, run);
    if (ph !== 'running' && ph !== 'queued' && ph !== 'audio' && ph !== 'video' && ph !== 'extract') {
      shadeLast.delete(rec.id);
      if (!shadeGone.has(rec.id)) { shadeGone.add(rec.id); shadeEnd(rec.id); }
      continue;
    }
    shadeGone.delete(rec.id);
    const s = modelFor(rec).stages.find((x) => x.state === 'now');
    if (!s) continue;
    const p = Math.max(0, Math.min(1, shownPct(rec, s.pv != null ? s.pv : s.p, 'sh:' + s.id)));
    const sk = rec.spec.ka ? 'ka' : rec.spec.src === 'subs';
    const title = stageName(s.id, langsSum(rec.spec.to), sk);
    const ul = shadeUpBlock(rec, run, now, s.id);
    // 27/10/2026 ("מסודר בכל ההתראה"): כמו חלק ההעלאה — פס ואחוז בשורה אחת, "שלב 2 מתוך 7" מתחת (בלי שבירה באמצע), כל שורה מימין לשמאל
    const body = shadeDir() + shadeBar(p, uiLang()) + '  ' + Math.round(p * 100) + '%\n' + shadeDir() + T('studioShadeOf', { n: STAGES.indexOf(s.id) + 1, t: STAGES.length }) + (ul ? '\n' + ul : '');
    const key = title + '|' + body;
    if (shadeLast.get(rec.id) === key) continue;
    shadeLast.set(rec.id, key);
    navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, icon: 'icon-192.png', badge: 'favicon-48.png', lang: 'he', dir: 'auto',
      tag: 'studio-' + rec.id, renotify: false, silent: true, data: { url: './#studio=' + rec.id, at: Date.now(), k: 'stage', st: s.id, p } })).catch(() => {});
  }
}
function livePaint() {
  if (!root) return;
  shadeSync();
  if (shapeKey() !== lastShape) { render('none'); return; }
  for (const el of root.querySelectorAll('[data-live]')) { try { if (el._live) el._live(el); } catch (e) {} }
}
const repaint = () => { if (root) livePaint(); };
function render(kind, still, pre) {     // kind: none (ציור מחדש במקום) / push / pop; still = בלי אנימציה (Chrome כבר הנפיש); pre = העתק מוכן (cubePre)
  if (!root) return;
  /* 29/10/2026 (סבב קפיצות 4): ההעתק נצבע שני פריימים לפני הציור החדש (core: cubePre) — אחרת בטלפון פריים ריק בתחילת
     כל מעבר. בזמן ההמתנה ציור במקום (רענון חי) מחכה: הציור של המעבר יבוא מיד */
  const anim0 = (kind === 'push' || kind === 'dfwd' || kind === 'pop' || kind === 'dback') && !still && !reduceMotion() && !document.hidden;
  if (!pre && anim0 && typeof cubePre === 'function' && root.firstChild) { cubePre(root, (g) => { if (root) render(kind, still, g); else g.remove(); }); return; }
  if (!pre && kind === 'none' && typeof cubePreBusy === 'function' && cubePreBusy()) return;
  const seq = ++renderSeq;
  if (kind !== 'none') rsClose();   // מעבר דף — הגיליון של המשוב לא נשאר מעל
  const keepY = kind === 'none' ? root.scrollTop : ((kind === 'pop' || kind === 'sibpop' || kind === 'dfwd' || kind === 'dback') ? (scrolls[viewKey()] || 0) : 0);
  const ae = document.activeElement;
  const fk = ae && root.contains(ae) && ae.dataset ? ae.dataset.k : null;   // הפוקוס חוזר לאותו רכיב אחרי ציור מחדש
  if (ui.view === 'home' || ui.view === 'ka') form = null;   // יציאה מהטופס בלי שמירה — הטיוטה לא נשמרת
  const p = h('div', 'st-page');
  if (ui.view === 'new') pageForm(p, false);
  else if (ui.view === 'edit') pageForm(p, true);
  else if (ui.view === 'lang') pageLang(p);
  else if (ui.view === 'project') pageProject(p);
  else if (ui.view === 'job') pageJob(p);
  else if (ui.view === 'play') pagePlay(p);   // מ1
  else if (ui.view === 'subs') pageSubs(p);   // מ2: עורך הכתוביות
  else if (ui.view === 'rr') pageRr(p);       // מ2: הפקה מחדש
  else if (ui.view === 'cut') pageCut(p, false);      // מ5: חיתוך אחרי התרגום
  else if (ui.view === 'sty') pageSty(p);            // סבב 5: עיצוב הכתוביות
  else if (ui.view === 'ov') pageOv(p);              // סבב 7: כותרת ולוגו
  else if (ui.view === 'ai') pageAi(p);               // מ7: גיליון ה־AI
  else if (ui.view === 'ideas') pageIdeas(p);         // מ8: רעיונות
  else if (ui.view === 'guide') pageGuide(p);         // מ9: מדריך
  else if (ui.view === 'adv') pageAdvanced(p);       // אפשרויות מתקדמות (כמו ב־Invest)
  else if (ui.view === 'cutsrc') pageCut(p, true);    // מ4: חיתוך לפני התרגום
  else if (ui.view === 'tracks') pageTracks(p);      // שלב 4: כתוביות בתוך הסרטון
  else if (ui.view === 'link') pageLink(p);          // 22/10/2026: הורדה מקישור
  else if (ui.view === 'dpick') pageDrivePick(p);    // 26/10/2026: סרטון מ־Drive — הרשימה שלנו
  else if (ui.view === 'vids') pageVids(p);          // 26/10/2026: ״הסרטונים שלי״ ב־Drive
  else if (ui.view === 'linkfmt') pageLinkFmt(p);
  else if (ui.view === 'linksec') pageLinkSec(p);
  else if (ui.view === 'fmthelp') pageFmtHelp(p);
  else if (ui.view === 'grab') pageGrab(p);
  else if (ui.view === 'settings') pageSettings(p);
  else if (ui.view === 'eng') pageEng(p);             // 13/10/2026: עמודי המשנה של ההגדרות
  else if (ui.view === 'defs') pageDefs(p);
  else if (ui.view === 'store') pageStore(p);
  else if (ui.view === 'push') pagePush(p);
  else if (ui.view === 'tower') pageTower(p);
  else if (ui.view === 'towerx') pageTowerFull(p);
  else if (ui.view === 'alerts') pageAlerts(p);     // 13/10/2026: עמודי המשנה של המגדל
  else if (ui.view === 'smap') pageSmap(p);
  else if (ui.view === 'probs') pageProbs(p);
  else if (ui.view === 'norm') pageNorm(p);
  else if (ui.view === 'alert') pageAlert(p);
  else if (ui.view === 'inc') pageInc(p);
  else if (ui.view === 'agents') pageAgents(p);
  else if (ui.view === 'value') pageValue(p);   // v377
  else if (ui.view === 'slo') pageSlo(p);   // v383
  else if (ui.view === 'anom') pageAnom(p);   // v385
  else if (ui.view === 'scan') pageScan(p);   // v378
  else if (ui.view === 'prob') pageProb(p);   // v376
  else if (ui.view === 'rules') pageRules(p);
  else if (ui.view === 'rlb') pageRuleBudget(p);
  else if (ui.view === 'rlm') pageRuleMax(p);
  else if (ui.view === 'gloss') pageGloss(p);   // v380
  else if (ui.view === 'server') pageServer(p);
  else if (ui.view === 'def') pageDef(p);
  else if (ui.view === 'connect') pageConnect(p);
  else if (ui.view === 'ka' && kaOk()) pageKa(p);
  else if (ui.view === 'kasty' && kaOk()) pageKaSty(p);   // 31/10/2026: עיצוב הקריוקי   // 30/10/2026: קריוקי — כלי נפרד
  else pageHome(p);
  if (!root || seq !== renderSeq) { if (pre) pre.remove(); return; }   // הדף חזר אחורה תוך כדי בנייה (טיוטה שנמחקה וכו') — הציור החדש כבר במקום
  /* 14/10/2026 (בקשת המשתמש): מעבר בין דפים = קובייה, כמו בשלוש האפליקציות (core: cubeClone/cubeGhostRun) — הדף היוצא =
     העתק של השכבה, החדש נצבע בשכבה עצמה מתחתיו. בלי המנוע — הכניסה הישנה (in-push/in-pop) */
  const fwd = kind === 'push' || kind === 'dfwd';
  const anim = (fwd || kind === 'pop' || kind === 'dback') && !still && !reduceMotion() && !document.hidden;
  // 29/10/2026: החוגה זזה יחד עם הקובייה (אותו קפיץ). באמצע החלקה / נסיעה של החוגה (sib, העתק על המסך) — המנוע מזיז אותה
  if (kind !== 'sib' && kind !== 'sibpop' && !(kind === 'none' && root.nextElementSibling && root.nextElementSibling.classList.contains('cube-ghost'))) stDialSync(!anim);
  const ghost = pre || (anim && typeof cubeClone === 'function' && root.firstChild ? cubeClone(root) : null);
  if (anim && !ghost) p.classList.add(fwd ? 'in-push' : 'in-pop');
  // 29/10/2026 (בטלפון: תפריט ההמבורגר ב־Studio שקוף, התוכן חד מאחוריו — שונה מ־Academy): שכבת הטשטוש של התפריט (shell.js)
  // יושבת בתוך השכבה; ציור דף מחדש (רענון הרשימה) מחק אותה. נשארת כל עוד התפריט פתוח
  const veil = root.querySelector(':scope > .menu-veil');
  root.replaceChildren(p);
  if (veil) root.append(veil);
  if (SA && SA.shell && SA.shell.el.isConnected && typeof animSync === 'function') animSync(SA.shell.el);   // הלוגו ממשיך מאותו רגע (core)
  root.scrollTop = keepY;
  if (ghost) cubeGhostRun(root, ghost, cubeSideFwd(fwd));
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
  else if (ui.view === 'settings' || ui.view === 'connect' || ui.view === 'eng' || ui.view === 'store') refreshStatus();
  else if (ui.view === 'tower' || ui.view === 'towerx' || TW_SUBS.includes(ui.view)) { refreshStatus(true); refreshJobs(true); }
  else if (ui.view === 'rules' || ui.view === 'alert' || ui.view === 'rlb' || ui.view === 'rlm') refreshStatus(true);
  else if (ui.view === 'gloss') { refreshStatus(true); glossLoad(true); }   // v380: המילון — תמיד הגרסה העדכנית מ־Drive
  else if (ui.view === 'inc') { refreshStatus(true); refreshJobs(true); }
  else if (ui.view === 'agents') refreshJobs(true);
  else if (ui.view === 'value' || ui.view === 'slo' || ui.view === 'anom') refreshJobs(true);   // v377 · v383 · v385
  else if (ui.view === 'scan') { if (!ui.sc || Date.now() - ui.sc.at > SCAN_FRESH) runScan(); else refreshStatus(true); }   // v378: סריקה ישנה — סורקים שוב
  else if (ui.view === 'prob') { refreshStatus(true); refreshJobs(true); }   // v376
  else if (ui.view === 'server') { refreshStatus(true); refreshServers(); }
  else if (ui.view === 'rr') { refreshJobs(true); }   // מ2: ההפקה האחרונה של העבודה
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
  if (ui.view === 'job') { const r = jobRec(ui.param), st = r && r.srv ? r.srv.state : 'new'; ms = st === 'queued' || st === 'running' || (r && r.srv && r.srv.bg) || phBurnLive(r) || phPrepLive(r) ? 4000 : st === 'new' && r && r.up.started || vcLive(r) ? 15000 : r ? recMs([r]) : 0; }
  else if (ui.view === 'home') ms = store.jobs.some((r) => r.srv && (r.srv.state === 'queued' || r.srv.state === 'running' || r.srv.bg)) ? 30000 : recMs(store.jobs);   // 26/10/2026: 30 שנ׳ (op:'jobs' = כל העבודות שלך — קריאה מ־Firestore לכל אחת)
  else if (ui.view === 'rr') { ms = rrRunning(rrJobs.get(ui.param)) || rrRunning(rrPv.get(ui.param)) ? 4000 : 0; }   // מ2; סבב 10: גם הבדיקה
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
      if (j.ok && j.job && r) { adoptSrv(r, j.job); save(); goldAuto(); }
    } else if (ui.view === 'rr' && (rrJobs.get(ui.param) || rrPv.get(ui.param))) {
      for (const x of [rrJobs.get(ui.param), rrPv.get(ui.param)].filter(rrRunning)) {
        const j = await net.api('job', { job: x.id });
        if (j.ok && j.job) x.srv = normJob({ id: x.id, srv: j.job }).srv;
      }
    } else if (ui.view === 'home') {
      // 28/10/2026: op:'jobs' = קריאה של כל העבודות שלך (70+) מ־Firestore. בזמן עבודה רצה — רק היא (op:'job' = קריאה אחת),
      // והרשימה המלאה לכל היותר פעם ב־JOBS_FULL_MS. 30 שנ׳ × כל הרשימה × כמה שעות של פרקים = המכסה היומית (28/10)
      const isLive = (r) => r.srv && (r.srv.state === 'queued' || r.srv.state === 'running' || r.srv.bg);
      const live = store.jobs.filter(isLive);
      if (live.length && live.length <= 4 && Date.now() - jobsAt < JOBS_FULL_MS) {
        for (const r of live) {
          const j = await net.api('job', { job: r.id });
          if (j.ok && j.job) adoptSrv(r, j.job);
          else if (j.error === 'fs_http_429') ui.access = 'quota';
        }
        save();
        if (!live.every(isLive)) await refreshJobs(true);   // עבודה הסתיימה — פעם אחת הרשימה המלאה (התראות, תקלות, הפקות)
      } else await refreshJobs(true);
    } else if (ui.view === 'server') await refreshServers();
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
  document.documentElement.classList.remove('studio-open', 'st-dock');
  if (dialNav) { dialNav.remove(); dialNav = null; stDialC = null; if (typeof dialHost === 'function') dialHost(dialPrev); dialPrev = null; }
  if (!r) return;
  if (instant || reduceMotion()) { r.remove(); return; }   // Chrome כבר הנפיש את היציאה — בלי אנימציה שנייה
  r.classList.add('leaving');
  setTimeout(() => r.remove(), 260);
}
/* שלב 3ד בתוכנית שלוש האפליקציות: הסטודיו כדף עצמאי (studio.html) — opt.standalone = { auth: SnbAuth, home }.
   כמו בספרייה: הבית מחליף את רשומת הדף ("חזור" ממנו יוצא מהדף), "THE SNOWBALL" עובר ל־Invest, ובלי חיבור — כפתור כניסה. */
let SA = null;
/* 22/10/2026: "שיתוף ← Studio" / הבועה — טופס חדש ודף הקישור, והבדיקה מתחילה מיד (בלי להדביק).
   גם כש־Studio כבר פתוחה: אנדרואיד מעביר את הקישור ללשונית הקיימת כשינוי ב־hash, בלי טעינה (studio-app.js → hashchange) */
export function studioShare(text, ref, pr, to) {
  const shared = typeof text === 'string' ? text.trim().slice(0, 4096) : '';
  if (!root || !shared || !/https?:\/\//i.test(shared)) return false;
  // 23/10/2026: מדפדפן הציד — הבדיקה כבר רצה בטלפון (DlActivity), והתוצאה הגיעה יחד עם הכתובת (pr = ‎<n>.<תוצאה>).
  // האתר לא פותח שוב את חלון הבדיקה (בלי נגיעה של המשתמש Chrome חוסם — "בודקים את הקישור…" בלי סוף)
  const pre = /^([A-Za-z0-9]{6,24})\./.exec(String(pr || ''));
  const L0 = form && form.link;
  if (pre && L0 && L0.n === pre[1] && L0.st === 'busy') return studioProbeRes(pr);   // הדף עוד מחכה לבדיקה הזו
  form = freshForm(null); go('new', null, 'none'); go('link', null, 'none'); linkCheck(form, shared, ref, pre ? pre[1] : '', to);
  if (pre) studioProbeRes(pr);
  return true;
}
export function openStudio(opt) {
  ensureCss();
  if (!root) SA = opt && opt.standalone ? opt.standalone : null;
  if (SA) { SA.settings = () => go('settings'); SA.tower = () => go('tower'); }
  const jobLink = opt && /^j[A-Za-z0-9_-]{20}$/.test(String(opt.job || '')) ? opt.job : '';   // שלב 4: מההתראה
  const linkView = opt && (opt.view === 'play' || opt.view === 'subs') ? opt.view : '';          // פעולה בהתראה: צפייה / עריכה
  if (root) { if (jobLink) { if (jobRec(jobLink)) goJobLink(jobLink, linkView); else Promise.resolve(refreshJobs(true)).then(() => { if (root && jobRec(jobLink)) goJobLink(jobLink, linkView); }); } return; }
  const restore = opt && opt.restore && opt.restore.studio ? opt.restore : null;   // רענון בזמן שהסטודיו היה פתוח
  store = load();
  if (store.st) { if (!ui.api) ui.api = store.st.api; ui.mf = store.st.mf; }   // 29/10/2026 (S1): עד שהסטטוס חוזר — המצב האחרון
  root = h('div', 'st-root no-swipe');
  root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', T('studioTitle'));
  root.tabIndex = -1;
  root.addEventListener('pointerup', () => { if (CW_OK && root && !cw) watch(); }, true);   // נגיעה = הפעלת משתמש → מאזין חדש אם חסר
  wireStSwipe();                          // 14/10/2026: החלקה בין עמודים ובין טאבים (core: snbSwipe)
  if (!CW_OK && !window._stKey) {          // עם CloseWatcher גם Escape הוא בקשת סגירה — בלי מאזין משלנו
    window._stKey = true;
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !root || e.defaultPrevented) return;
      if (document.querySelector('.dlg-veil')) return;   // חלון אישור של האפליקציה פתוח — הוא סוגר את עצמו
      const plm = document.querySelector('.st-pl-menu:not([hidden])');
      e.preventDefault(); if (plm) plm.click(); else back();
    });
  }
  if (!window._stVis) {                    // חזרה לאפליקציה: מסך דולק שוב (אם מעלים) ומעקב מחדש
    window._stVis = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') { if (wlWant) wakeOn(); if (root) pollNow(); upRevive(); }
      else { clearTimeout(pollT); pollT = 0; watchFlush(); uxFlush(); fnlFlush(); }   // מ׳3: מה שנאסף נשלח לפני שהאפליקציה יורדת לרקע
    });
    window.addEventListener('pagehide', () => { watchFlush(); uxFlush(); fnlFlush(); });   // 25/10/2026: גם כשהדף נסגר / נהרג
    window.addEventListener('offline', repaint); window.addEventListener('online', () => { repaint(); if (root) pollNow(); });   // 26/10/2026: הפס "אין חיבור" בדף העבודה
  }
  document.body.append(root);
  if (stDialNav()) {                       // 29/10/2026: החוגה — מעל השכבה; המארח של המנוע עובר לסטודיו עד הסגירה
    document.body.append(dialNav);
    if (_dial.host !== STUDIO_DIAL) { dialPrev = _dial.host; dialHost(STUDIO_DIAL); }
    wireDial(dialNav);
    if (!window._stDialRz) { window._stDialRz = true; window.addEventListener('resize', () => { if (root) stDialSync(true); }); }
  }
  if (typeof growWatch === 'function') growWatch(root, '.st-banner', () => ui.view + '|' + (ui.param || ''));   // 14/10/2026: פס שמופיע בדף מוצג — נפתח ברכות
  document.documentElement.classList.add('studio-open');
  if (SA && !restore) { try { history.replaceState(cleanState({ studio: 1, sv: 'home', sp: null }), ''); } catch (e) {} }   // עצמאי — הבית הוא הדף
  else if (!restore) afterBack(() => { try { history.pushState(cleanState({ studio: 1, sv: 'home', sp: null }), ''); } catch (e) {} });
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
  curtainDown(!restore || !!SA);           // 30/10/2026 (סבב 5, R9): גם רענון בדף העצמאי — בבת אחת, בלי דהייה. 14/10/2026: הווילון של studio.html — יורד כשהדף הראשון מצויר
  try { root.focus({ preventScroll: true }); } catch (e) {}
  Promise.resolve(refreshStatus(true)).then(() => pushAuto(false)).catch(() => {});
  if (!shadeT) shadeT = setInterval(() => { if (root) shadeSync(); }, SHADE_MS);   // הווילון — כל שנייה
  dxKick();   // 26/10/2026: שמירה ב־Drive שרצה בשרת — ממשיכים לעקוב
  const jobs0 = refreshJobs(true);
  inboxOp('clean');   // 22/10/2026: קבצים מההורדה בטלפון שלא נכנסו לעבודה — אחרי שבוע
  // מההתראה: לדף העבודה — מיד אם היא כבר בטלפון, אחרת אחרי שהרשימה מהשרתון מגיעה
  if (jobLink) { if (jobRec(jobLink)) goJobLink(jobLink, linkView, 'none'); else Promise.resolve(jobs0).then(() => { if (root && jobRec(jobLink)) goJobLink(jobLink, linkView); }); }
  // 22/10/2026: "שיתוף ← Studio" — טופס חדש ודף הקישור, והבדיקה מתחילה מיד (בלי להדביק)
  if (opt) studioShare(opt.share, opt.ref, opt.probe, opt.to);
  if (opt && opt.got) studioGot(opt.got);      // 22/10/2026: הקובץ מההורדה בטלפון / מהגלריה (sw.js → ‎#got=)
  if (opt && opt.dle) studioDlErr(opt.dle);
  // העלאות שנקטעו (רענון): ממשיכים לבד כשיש ידית לקובץ עם הרשאה; אחרת המסך מבקש לבחור שוב
  for (const rec of store.jobs) {
    const done = rec.up.v.done && (rec.up.a.done || rec.up.noAudio);
    const st = rec.srv ? rec.srv.state : 'new';
    if (rec.up.ext) { if ((!rec.up.extReg || !rec.up.started) && st === 'new' && !(runs.get(rec.id) && runs.get(rec.id).active)) startRun(rec.id, null); continue; }   // מ־Drive — בלי קובץ בטלפון
    if (rec.up.link) { if (!rec.up.started && st === 'new' && !(runs.get(rec.id) && runs.get(rec.id).active)) startRun(rec.id, null); continue; }   // 22/10/2026: מקישור
    if (rec.up.ph) continue;   // 24/10/2026: תרגום בטלפון — האפליקציה מעלה, לא הדף
    if (!done && !FINAL.includes(st) && !(runs.get(rec.id) && runs.get(rec.id).active) && rec.fp) resumeJob(rec.id, false);
  }
}

/* קישור מההתראה: דף העבודה, ומשם הנגן / העורך כשאפשר — "חזור" מהם חוזר לעבודה */
function goJobLink(id, view, kind) {   // 14/10/2026: מיד בפתיחה (kind = 'none') — הדף מופיע כמו שהוא, בלי קובייה על דף שעוד נכנס
  if (!(ui.view === 'job' && ui.param === id) && !(view && ui.view === view && ui.param === id)) go('job', id, kind);   // 29/10/2026: כבר בדף — לא עוד רשומה
  const rec = jobRec(id);
  if (view === 'play' && canPlay(rec)) go('play', id, kind);
  else if (view === 'subs' && canEdit(rec)) go('subs', id, kind);
}

export const _test = {
  state: () => ({ open: !!root, view: ui.view, param: ui.param, drafts: store.drafts.length, jobs: store.jobs.length, form: !!form, cw: CW_OK, watching: !!cw, stack: stack.length,
    access: ui.access, conn: !!store.conn, test: testRun ? testRun.st : '', runs: [...runs.entries()].map(([id, r]) => ({ id, phase: r.phase, active: r.active, wait: r.wait, err: r.err, p: r.p })) }),
  closeRequest: () => closeRequest(),   // QA: כמו "חזור" של אנדרואיד (Playwright לא יכול לשלוח אותו)
};
