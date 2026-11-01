/* סטודיו התרגום — שלב 2 (v355): עבודות, מפתח עבודה, החיבור ל־Routine והדיווח מהעובד בענן.
   הטלפון לא מחזיק שום סוד: הכתובת והמפתח של ה־Routine נשמרים רק מוצפנים בכספת (lib/vault.js, AAD = studio|uid|r)
   במסמך studioVault/{uid}, ולא חוזרים לטלפון לעולם. כל הפעלה של ה־Routine מקבלת מפתח עבודה חדש (32 בתים אקראיים):
   נשמר רק ה־SHA-256 שלו, תקף 48 שעות, להפעלה אחת (הפעלה חדשה מחליפה אותו), ואחרי שהעבודה נגמרה הוא רק מחזיר "עצור".
   הקובץ טהור (בלי רשת) — api/studio.js עושה את הקריאות, ו־tests/run.js בודק את שניהם. */
const crypto = require('crypto');
const SLA = require('./studiosla');   // v377: יעדי שירות
const ETA = require('./studioeta');   // 10/10/2026: צפי זמנים נלמד
const SU = require('./studiourl');   // 22/10/2026: הורדה מקישור
const SC = require('./studioscan');   // 26/10/2026: כמה זמן הקבצים נשמרים (retention)

const ROUTINE_URL_RE = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/(trig_[A-Za-z0-9]{8,64})\/fire$/;
const ROUTINE_KEY_RE = /^sk-ant-oat01-[A-Za-z0-9_-]{20,400}$/;
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
// מזהה הסשן בתשובת ההפעלה: בתיעוד session_…, בפועל cse_… (07/10/2026) — שתי קידומות לאותו סשן
const SESSION_RE = /^(?:session|cse)_([A-Za-z0-9]{8,80})$/;
const SESSION_URL_RE = /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]{8,80}$/;
const ERR_RE = /^[a-z0-9_]{1,40}$/;
/* 20/10/2026: איפה העובד קרס — "KeyError @ pipeline.py:712 proofread" (crash_where ב־job.py). רק הצורה הזו נשמרת:
   סוג חריגה, שם קובץ של העובד, שורה ופונקציה — בלי טקסט חופשי ובלי נתיבים */
const WHERE_RE = /^[A-Za-z_][A-Za-z0-9_]{0,39} @ [a-z_][a-z0-9_]{0,30}\.py:\d{1,6}( [A-Za-z_][A-Za-z0-9_]{0,39})?$/;
const crashWhere = (msg) => (WHERE_RE.test(String(msg || '')) ? String(msg) : '');
const KEY_TTL = 48 * 3600e3;
const CLAIM_WAIT = { ping: 6 * 60e3, tr: 30 * 60e3 };   // הופעל ולא נלקח בזמן הזה = Claude לא התחיל (סשן שנפל / הנחיה אחרת)
/* השלבים, בסדר — אותם מזהים באפליקציה (studionet.js) ובעובד (translator/job.py) */
const STAGES = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];
const FINAL = ['done', 'failed', 'cancelled'];
const ACTIVE = ['new', 'queued', 'running'];
const KINDS = ['ping', 'tr', 'rr', 'ai', 'dx'];   // 26/10/2026: dx = שמירת התוצרים מ־R2 בתיקייה ב־Drive (בשרת, בלי הטלפון)   // מ2: rr = הפקה מחדש (כתוביות ערוכות / רשימת עריכות → צריבה; בלי טוקנים)
/* מה העובד בענן יודע לבצע. שלב 2: רק "בדיקת חיבור"; התרגום עצמו מגיע בשלב 3 — אז 'tr' נכנס לכאן, והאפליקציה לא משתנה */
const WORKER_KINDS = ['ping', 'tr', 'rr', 'ai', 'dx'];   // v358: העובד מתרגם (שלב 3); מ2: הפקה מחדש
// 10/10/2026 (בקשת המשתמש): Haiku 5.5 נכנס, Opus High/Max יצאו. 15/10: נוסף Sonnet Low (לבדיקות — איך הוא וכמה עולה).
const MODES = ['sonnet-medium', 'haiku-high', 'sonnet-high', 'opus-medium', 'sonnet-low', 'haiku-medium'];   // 20/10/2026: Haiku Medium חזר — רק למנהל / לרשימת "כל המודלים"
/* 15/10/2026 (בקשת המשתמש): לכל המשתמשים רק שני מצבים — "רגיל" (Haiku High, ברירת המחדל) ו"ביצועים" (Sonnet Medium).
   כל השאר — רק למנהל ולמי שברשימת "כל המודלים" במרכז הניהול (sysCfg.amEm, lib/sysflags.js). **= PUBLIC_MODES בטלפון**
   25/10/2026 (בקשת המשתמש): "רגיל" = Haiku Medium (ברירת המחדל), "ביצועים" = Haiku High — רק Haiku למשתמשים */
const PUBLIC_MODES = ['haiku-medium', 'haiku-high'];
const DEFAULT_MODE = 'haiku-medium';
const modeOk = (m, full) => !!full || PUBLIC_MODES.includes(m);
/* 25/10/2026 (בקשת המשתמש): למשתמשים רק "השרת של המערכת" — Claude במפתח של המערכת. המנוי שלי (Routine / ry) והעתק־הדבק
   (cp) — רק למנהל ולמי שברשימת "כל המודלים". **= engFor בטלפון** (connFor) */
const engOk = (spec, full) => !!full || !!(spec && spec.eng === 'api' && spec.cp !== 1 && spec.ry !== 1);
// מצבים שהוסרו → המצב הקיים הקרוב (עבודה / טיוטה / חוק שנשמרו לפני ההחלפה ממשיכים לעבוד, לא נופלים)
const LEGACY_MODES = { 'opus-high': 'opus-medium', 'opus-max': 'opus-medium' };   // 11/10: Haiku Medium יצא (= המחיר של High)
const modeNow = (m) => (MODES.includes(m) ? m : LEGACY_MODES[m] || DEFAULT_MODE);
/* הסקירה (10/10/2026): מה שהעובד יודע היום — מקור אנגלית (או "אוטומטי"), יעד עברית. השאר נדחה כבר ביצירה (לפני העלאה
   של כמה GB והפעלת Claude), לא בעובד. **= LANG_READY בטלפון** (tests/studio-review.test.js). שפה חדשה = כאן + בטלפון + בעובד */
const LANG_READY = { from: ['auto', 'en'], to: ['he'] };
const langReady = (sp) => !!sp && LANG_READY.from.includes(sp.from) && Array.isArray(sp.to) && sp.to.length > 0 && sp.to.every((c) => LANG_READY.to.includes(c));
const LANGS = ['en', 'he', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko', 'am'];
const STYLES = ['bold', 'classic', 'karaoke'];
const OUTS = ['same', 'compact', 'mkv', 'small'];   // סבב 8: small = עותק לוואטסאפ גם בעבודה עצמה
const OUT_KINDS = ['compact', 'same', 'mkv', 'srt', 'cues', 'vtt', 'ass', 'en', 'small', 'aiout', 'meta', 'thumb', 'inst', 'lrc', 'elrc', 'lyr'];   // 26/10/2026: קריוקי — הליווי, LRC ו־Enhanced LRC   // סבב 6: meta = גל הקול וחילופי השוטים; סבב 7: thumb = תמונה ממוזערת   // מ7: aiout = תשובת גיליון ה־AI   // v358: תוצרים שהעובד מעלה; מ1: קבצי עזר (הנגן והעורך), small = עותק לוואטסאפ
const OUT_MAX = 10;
const SUBS_MAX = 5 * 1024 * 1024;           // 22/10/2026: קובץ כתוביות קיים (SRT/VTT/ASS) — סרט של שלוש שעות ≈ 300KB
const SUBS_FPS = ['24000/1001', '24', '25', '30000/1001', '30'];   // = SUBS_FPS ב־job.py (הגריד לתזמון בלי סרטון)
const MAX_SIZE = 64 * 1024 ** 3;            // 64GB — הרבה מעל כל ראיון (Drive מקבל עד 5TB)
const MAX_ACTIVE = 5;                       // עבודות פתוחות בבת אחת למשתמש
// 21/10/2026 (בקשת המשתמש — מבחני עומס של 2–4 סרטונים ארוכים במקביל): למנהל אין מגבלה מעשית. המשאבים ממילא לא לפי משתמש:
// השרת לוקח עבודות מהתור לפי הסדר, לפי הליבות והזיכרון שלו — עבודות של משתמש אחד = אותו דבר כמו של כמה משתמשים
const MAX_ACTIVE_ADMIN = 50;
const maxActive = (admin) => (admin ? MAX_ACTIVE_ADMIN : MAX_ACTIVE);
const MAX_STORED = 100;                     // מעבר לזה — הישנות שהסתיימו נמחקות
const FIRE_HOUR = 20;                       // הפעלות בשעה למשתמש (ל־Routine מותר 30 — שומרים מרווח לתיקונים ול"הפעל עכשיו")
const TEST_GAP = 60e3;                      // בדיקת חיבור — לכל היותר פעם בדקה
/* שלב 3 סבב ה׳: נקודות שמירה — אחרי תמלול (asr), יישור (al), תרגום (tl) וביקורת (rv). כל אחת = ארכיון קטן של הפרויקט
   בתיקיית העבודה ב־Drive (בלי הסרטון והקול). "המשך" מפעיל את ה־Routine שוב, והעובד ממשיך מהאחרונה — בלי לתמלל ולתרגם מחדש */
const CK_STAGES = ['asr', 'al', 'tl', 'rv'];
const CK_MAX_SIZE = 512 * 1024 ** 2;
const STALE_MS = 2 * 3600e3;                // "רצה" בלי שום דיווח שעתיים = הסשן נפל (התרגום מדווח על כל חלק)
/* v368: המתנה לפני כישלון — תקלה חולפת (Drive / רשת) מקבלת חלון התאוששות, ואז "המשך" אוטומטי אחד מנקודת השמירה.
   רק אז "נכשלה" באמת. ההפעלה נספרת במכסה כמו כל הפעלה — לכן פעם אחת לעבודה (החלטה 1 בתוכנית) */
const RECOVER_WAIT = 3 * 60e3, AUTO_RESUME_MAX = 1;
/* 21/10/2026 (סבב הייעול, 12): נפילה בדקות הראשונות אחרי הלקיחה = כמעט תמיד תשתית (עדכון של העובד בדיוק בלקיחה, רשת) —
   ממשיכים אחרי 15 שנ׳ ולא אחרי 3 דק׳. "המשך" אוטומטי עדיין פעם אחת לעבודה (AUTO_RESUME_MAX) */
const EARLY_FAIL_MS = 4 * 60e3, EARLY_WAIT = 15e3;
function recoverWait(job, now) {
  const t0 = job && (job.claimed || job.c0);
  if (!t0 || now - t0 < 0 || now - t0 >= EARLY_FAIL_MS) return RECOVER_WAIT;
  // נשמרה נקודה בהפעלה הזו — העבודה כבר התקדמה; זו לא תקלת תשתית של הרגע הראשון
  return (Array.isArray(job.ck) ? job.ck : []).some((c) => c && c.at >= t0) ? RECOVER_WAIT : EARLY_WAIT;
}
const TRANSIENT_ERRS = ['net', 'drive', 'drive_net', 'store_net', 'url_net', 'url_timeout', 'api_network', 'api_timeout', 'api_rate', 'api_overloaded', 'worker_lost', 'relay_lost'];   // 24/10/2026: relay_lost = הסשן של ה־Routine נגמר באמצע — "המשך" מפעיל חדש   // 14/10/2026: worker_lost = השרת הופעל מחדש באמצע (עדכון / כיבוי) — ממשיכים מנקודת השמירה   // 11/10: store_net = ניתוק מול R2 / Drive   // הסקירה: גם רשת/קצב/עומס מול Anthropic במצב API
/* 11/10/2026 (ביקורת העמידות): כשל דטרמיניסטי — אותה בקשה תיכשל שוב. לא "חולף" גם כשבמקרה נשארה פתוחה התראת Drive
   ישנה מאותה עבודה (קודם: max_tokens אחרי התראת הורדה ישנה קיבל "המשך" אוטומטי ששילם שוב על אותו כשל) */
const DET_ERRS = ['ph_meta', 'ph_words', 'relay_none', 'relay_hub', 'relay_bad', 'worker_oom', 'store_fail', 'max_tokens', 'check_errors', 'model_refusal', 'api_blocked', 'api_bad_request', 'no_api_key', 'sdk_missing', 'mode_unknown', 'cp_empty', 'cp_timeout',
  'url_login', 'url_gone', 'url_geo', 'url_drm', 'url_live', 'url_unsupported', 'url_playlist', 'url_no_video', 'url_private', 'url_bad_url', 'url_dns', 'url_blocked'];   // 22/10/2026: הורדה מקישור — אותו ניסיון ייכשל שוב
const TRANSIENT_KINDS = ['drive:dl_retry', 'drive:up_retry', 'drive:dl_fail', 'drive:up_fail'];
/* עצירה מכוונת — אף פעם לא "חולפת", גם כשבמקרה הייתה תקלת Drive פתוחה (המגדל / התקציב / מתג החירום / ההחלטה שלך) */
const STOP_ERRS = ['tower_stop', 'budget_stop', 'halted', 'upload_timeout', 'lang_unsupported', 'worker_unknown_kind', 'budget_cap', 'api_auth', 'api_quota', 'api_model', 'no_api_key', 'sub_limit'];
/* האם הכישלון חולף: קוד השגיאה שהעובד דיווח, או התראת Drive פתוחה של העבודה הזו ברגע הכישלון */
function isTransient(err, openKinds) {
  const e = String(err || '');
  if (STOP_ERRS.includes(e) || DET_ERRS.includes(e)) return false;
  return TRANSIENT_ERRS.includes(e) || (Array.isArray(openKinds) && openKinds.some((k) => TRANSIENT_KINDS.includes(k)));
}
const RESUME_MAX = 10;                      // הפעלות לעבודה אחת (כולל הראשונה) — מעבר לזה משהו חוזר על עצמו

/* ---------- קלט ---------- */
/* הכתובת והמפתח כמו שהם מודבקים (רווחים, "Bearer " בטעות) — ואז בדיקת צורה קפדנית */
function normRoutine(url, key) {
  const u = String(url || '').trim();
  const k = String(key || '').trim().replace(/^Bearer\s+/i, '');
  const m = ROUTINE_URL_RE.exec(u);
  if (!m) return { error: 'bad_url' };
  if (!ROUTINE_KEY_RE.test(k)) return { error: 'bad_key' };
  return { u, k, trig: m[1] };
}
const hintOf = (trig) => 'trig_…' + String(trig || '').slice(-4);
const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const uniq = (a, ok) => (Array.isArray(a) ? a : []).filter((x, i, arr) => ok(x) && arr.indexOf(x) === i);

/* פרטי העבודה מהטלפון — רק מה שהעובד צריך; הכל נבדק ומוגבל */
/* מ4–מ5: רשימת העריכות של עורך הווידאו — **זהה ל־normEdl ב־studioedl.js ול־norm_edl ב־translator/edl.py** (tests/studio-edl) */
const EDL_SEG_MIN = 0.5, EDL_SEG_MAX = 60, EDL_JOIN = 0.05, EDL_ARS = ['src', '9:16', '1:1', '4:5'], EDL_MAX_T = 24 * 3600;
// סבב 3 (עורך הווידאו ב׳): מהירות, סיבוב, היפוך, זום ומיקום, שמע — זהה ל־studioedl.js ול־translator/edl.py
const EDL_SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4], EDL_ROTS = [0, 90, 180, 270], EDL_Z_MAX = 3, EDL_VOL_MAX = 200, EDL_FADE_MAX = 10;
const EDL_FXS = ['bw', 'warm', 'cool', 'vint'];   // סבב 7
function normEdl(e, dur) {
  if (!e || typeof e !== 'object') return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN), r3 = (x) => Math.round(x * 1000) / 1000;
  const lim = n(dur) > 0 ? Math.min(n(dur), EDL_MAX_T) : EDL_MAX_T;
  const segs = [];
  for (const p of (Array.isArray(e.k) ? e.k : []).slice(0, EDL_SEG_MAX * 4)) {
    if (!Array.isArray(p) || p.length !== 2) continue;
    const a = Math.max(0, n(p[0])), b = Math.min(lim, n(p[1]));
    if (!(a >= 0) || !(b - a >= EDL_SEG_MIN)) continue;
    segs.push([r3(a), r3(b)]);
  }
  segs.sort((x, y) => x[0] - y[0] || x[1] - y[1]);
  const k = [];
  for (const s of segs) {
    const last = k[k.length - 1];
    if (last && s[0] <= last[1] + EDL_JOIN) last[1] = Math.max(last[1], s[1]);
    else k.push(s.slice());
  }
  const ar = EDL_ARS.includes(e.ar) ? e.ar : 'src';
  const z = n(e.z) > 1 ? Math.min(EDL_Z_MAX, Math.round(e.z * 20) / 20) : 1;
  const crop = ar !== 'src' || z > 1;
  const x = n(e.x) >= 0 && n(e.x) <= 1 ? Math.round(e.x * 100) / 100 : 0.5;
  const y = n(e.y) >= 0 && n(e.y) <= 1 ? Math.round(e.y * 100) / 100 : 0.5;
  const ex = {};
  if (crop && y !== 0.5) ex.y = y;
  if (crop && e.af === true) ex.af = true;   // סבב 9: מסגור אוטומטי לדובר
  if (z > 1) ex.z = z;
  if (EDL_SPEEDS.includes(n(e.sp)) && e.sp !== 1) ex.sp = e.sp;
  if (EDL_ROTS.includes(n(e.rt)) && e.rt !== 0) ex.rt = e.rt;
  if (e.fh === true) ex.fh = true;
  if (e.fv === true) ex.fv = true;
  const mu = e.mu === true;
  if (!mu && n(e.vo) >= 0 && n(e.vo) <= EDL_VOL_MAX && Math.round(e.vo) !== 100) ex.vo = Math.round(e.vo);
  if (mu) ex.mu = true;
  for (const f of ['fi', 'fo']) if (!mu && n(e[f]) > 0) { const r = Math.min(EDL_FADE_MAX, Math.round(e[f] * 2) / 2); if (r) ex[f] = r; }
  if (!mu && e.ln === true) ex.ln = true;
  // סבב 7 (עורך הווידאו ג׳): ניקוי רעש · בהירות / ניגודיות / רוויה · מסנן · טשטוש אזור · מעברים · תמונה ממוזערת
  if (!mu && (e.dn === 1 || e.dn === 2)) ex.dn = e.dn;
  for (const [f, lo, hi, st] of [['br', -30, 30, 5], ['ct', -30, 30, 5], ['sa', -100, 100, 10]]) {
    const v = n(e[f]);
    if (v >= lo && v <= hi) { const r = Math.round(v / st) * st; if (r !== 0) ex[f] = r; }
  }
  if (EDL_FXS.includes(e.fx)) ex.fx = e.fx;
  if (Array.isArray(e.bl) && e.bl.length === 4) {
    const [bx, by, bw, bh] = e.bl.map((v) => Math.round(n(v) * 100) / 100);
    if (bx >= 0 && by >= 0 && bw >= 0.05 && bh >= 0.05 && bx + bw <= 1.0001 && by + bh <= 1.0001) ex.bl = [bx, by, bw, bh];
  }
  if (e.tr === true) ex.tr = true;
  if (n(e.th) >= 0 && n(e.th) <= EDL_MAX_T) ex.th = Math.round(e.th * 10) / 10;
  const whole = !k.length || (k.length === 1 && k[0][0] <= EDL_JOIN && n(dur) > 0 && k[0][1] >= n(dur) - EDL_JOIN);
  if (whole && ar === 'src' && !Object.keys(ex).length) return null;
  if (k.length > EDL_SEG_MAX) return null;
  return Object.assign({ k: whole ? [] : k, ar, x: crop ? x : 0.5 }, ex);
}
/* לפני התרגום: רק חיתוך ויחס תמונה (מהירות ושמע משנים את מה שהתמלול שומע) */
function edlPre(e) {
  if (!e) return null;
  return e.k.length || e.ar !== 'src' ? { k: e.k.map((p) => p.slice()), ar: e.ar, x: e.ar === 'src' ? 0.5 : e.x } : null;
}
/* 24/10/2026: תרגום בטלפון — מה הטלפון צורב (השרת לא צורב). same = כמו המקור, small = עותק לוואטסאפ */
const PH_BURN = ['same', 'small'];
const PH_META_MAX = 4 * 1024 * 1024;
const PH_WORDS_MAX = 32 * 1024 * 1024;   // 25/10/2026 (שלב 2): המילים עם הזמנים מהטלפון — שעה ≈ 1MB
/* 29/10/2026 (צילום של המשתמש: 1:20 ש׳ "מחכה שהסרטון יסיים לעלות" על פרק של כ־200MB): העלאה מהדפדפן נעצרת כשהדף ברקע או
   שהמסך כבוי, ואף אחד לא ידע. העובד מדווח wv כל 5 דק׳ כשהוא מחכה לסרטון; השרתון סופר כמה מהסרטון כבר ב־R2 (b), ואם לא זז
   UP_STALL_MS — התראה אחת לטלפון. עוד בתים = מתאפס (עצירה נוספת = התראה נוספת). מחזיר { vst } לכתיבה (null = בלי שינוי) ו־push */
const UP_STALL_MS = 10 * 60e3;
function upStallStep(prev, b, now) {
  const p = prev && typeof prev === 'object' ? prev : null;
  b = Math.max(0, Math.floor(Number(b) || 0));
  if (!p || b > (Number(p.b) || 0)) return { vst: { b, at: now, n: 0 }, push: false };
  if (!p.n && now - (Number(p.at) || 0) >= UP_STALL_MS) return { vst: { b: Number(p.b) || 0, at: Number(p.at) || now, n: 1 }, push: true };
  return { vst: null, push: false };
}
/* 29/10/2026: הסרטון עולה לענן מ־Studio לאנדרואיד (spec.vc, op:'phVp') — p = 0–1, e = קוד כשנעצר. **normVcp זהה בטלפון** */
function normVcp(o, now) {
  if (!o || typeof o !== 'object') return null;
  const p = Number(o.p);
  if (!(Number.isFinite(p) && p >= 0)) return null;
  const out = { p: Math.min(1, Math.round(p * 1000) / 1000), at: typeof now === 'number' ? now : 0 };
  if (/^[a-z0-9_]{2,32}$/.test(String(o.e || ''))) out.e = o.e;
  // 1/11/2026: r = הקצב (בתים לשנייה, ממוצע קצר בטלפון) — "MB ומהירות" בדף העבודה; sr = למה המערכת עצרה את המשימה
  // בפעם האחרונה (JobParameters.getStopReason) — מדידה בלבד
  const r = Math.round(Number(o.r));
  if (r > 0 && r < 1e10) out.r = r;
  const sr = Math.floor(Number(o.sr));
  if (sr > 0 && sr < 100) out.sr = sr;
  return out;
}
const PH_UP_MAX = 4 * 1024 * 1024 * 1024;   // הקול מהטלפון (בפועל עשרות MB לשעה) — תקרה גסה בלבד   // קובץ המדידות מהטלפון (ffprobe + השוטים) — JSON קטן; יותר = לא תקין
/* מצב הצריבה בטלפון (op:'phBurn' מהטלפון) — רק מספרים וקוד: s = run/done/fail, p = 0–1, e = קוד שגיאה, sz = גודל התוצר */
const PBN_S = ['run', 'done', 'fail'];
function normPbn(o, now) {
  if (!o || typeof o !== 'object' || !PBN_S.includes(o.s)) return null;
  const out = { s: o.s, p: o.s === 'done' ? 1 : Math.max(0, Math.min(1, Math.round((Number(o.p) || 0) * 1000) / 1000)), at: typeof now === 'number' ? now : 0 };
  if (o.s === 'fail' && /^[a-z0-9_]{2,32}$/.test(String(o.e || ''))) out.e = o.e;
  const sz = Math.floor(Number(o.sz));
  if (o.s === 'done' && sz > 0 && sz <= MAX_SIZE) out.sz = sz;
  const ms = Math.floor(Number(o.ms));
  if (o.s === 'done' && ms > 0 && ms < 86400e3) out.ms = ms;
  return out;
}
/* 25/10/2026 (שלב 2, "הכל בטלפון"): מה הטלפון עושה לפני שהעבודה מתחילה (op:'phProg') — שלב מתוך רשימה סגורה, ‏p = 0–1
   (‎-1‎ = לא ידוע), ‏e = קוד שגיאה כשנעצר. רק מספרים וקודים — כמו pbn */
const PPR_S = ['models', 'wav', 'asr', 'diar', 'align', 'upw', 'shots', 'upm', 'start', 'err'];
function normPpr(o, now) {
  if (!o || typeof o !== 'object' || !PPR_S.includes(o.s)) return null;
  const p = Number(o.p);
  const out = { s: o.s, p: Number.isFinite(p) && p >= 0 ? Math.min(1, Math.round(p * 1000) / 1000) : -1, at: typeof now === 'number' ? now : 0 };
  if (o.s === 'err') { if (!/^[a-z0-9_]{2,32}$/.test(String(o.e || ''))) return null; out.e = o.e; }
  return out;
}
/* 26/10/2026: קריוקי משיר רגיל — המילים שהודבקו (טקסט מהמשתמש: בלי תווי בקרה וכיווניות, עד KA_LYR_MAX). = clean_lyrics ב־translator/vt/karaoke.py */
const KA_LYR_MAX = 8000;
const KA_OUTS = ['compact', 'same', 'small'];
const KA_AL = ['he', 'en'];   // 01/11/2026: שפת השיר לתמלול האוטומטי (בלי מילים) — = KA_AL ב־studio.js
/* 31/10/2026: עיצוב הקריוקי (ת־קריוקי) — אותם מפתחות וברירות מחדל כמו norm_ky ב־translator/vt/karaoke.py
   (tests/studio-karaoke-design.test.js משווה). u לא־שר · c שר · f מילוי (w/d) · z גודל · cd ספירה · tc פתיחה · dm הכהיה ·
   bg רקע בלי וידאו · sg צבע לכל זמר (4) · sb ביחד */
const KY_DEF = { u: '#FFFFFF', c: '#FFC83D', f: 'w', z: 'M', cd: 1, tc: 1, dm: 1, bg: 'dark', sg: ['#3DD6FF', '#FF5CA8', '#7CE38B', '#B48CFF'], sb: '#FFC83D' };
function normKy(d) {
  d = d && typeof d === 'object' && !Array.isArray(d) ? d : {};
  const hx = (v, dv) => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : dv);
  const sg = Array.isArray(d.sg) ? d.sg : [];
  return {
    u: hx(d.u, KY_DEF.u), c: hx(d.c, KY_DEF.c), f: d.f === 'd' ? 'd' : 'w', z: ['S', 'M', 'L'].includes(d.z) ? d.z : 'M',
    cd: d.cd === 0 ? 0 : 1, tc: d.tc === 0 ? 0 : 1, dm: [0, 1, 2].includes(d.dm) ? d.dm : 1, bg: ['dark', 'grad', 'tint'].includes(d.bg) ? d.bg : 'dark',
    sg: [0, 1, 2, 3].map((i) => hx(sg[i], KY_DEF.sg[i])), sb: hx(d.sb, KY_DEF.sb),
  };
}
function normLyr(t) {
  return String(t == null ? '' : t).replace(/[\u0000-\u0008\u000b-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\r\n?/g, '\n').slice(0, KA_LYR_MAX);
}
function normSpec(s) {
  if (!s || typeof s !== 'object') return null;
  const name = clean(s.name, 200), size = Math.floor(Number(s.size) || 0);
  if (!name || !(size > 0) || size > MAX_SIZE) return null;
  const to = uniq(s.to, (c) => LANGS.includes(c)).slice(0, 12);
  if (!to.length) return null;
  // 22/10/2026: קובץ כתוביות קיים — רק במצב השרת (ה־Routine לא מכיר את המסלול), בלי חיתוך ובלי תוצרי וידאו
  const subs = s.src === 'subs';
  if (subs && (s.eng !== 'api' || size > SUBS_MAX)) return null;
  // 22/10/2026: הורדה מקישור — רק במצב השרת (העובד מוריד ל־R2); בלי חיתוך לפני התרגום (sec במקומו — מורידים רק את הקטע)
  const link = s.src === 'url';
  const url = link ? SU.normSrcUrl(s.url) : '', pick = link ? SU.normPick(s.pick) : null;
  const ref = link && s.ref ? SU.normSrcUrl(s.ref) : '';   // שלב 2: קובץ שנמצא בדף (דפדפן הציד) — הדף שממנו הגיע, ל־Referer
  if (link && (s.eng !== 'api' || !url || !pick)) return null;
  // 24/10/2026 (תרגום בטלפון, שלב 1): הסרטון לא עוזב את הטלפון — עולים רק הקול וקובץ המדידות (phMeta). השרת עושה רק
  // את שלבי הטקסט; הצריבה בטלפון (MediaCodec). רק במצב השרת, בלי חיתוך ובלי תוצרי וידאו בשרת
  const ph = s.ph === 1 && s.eng === 'api' && !subs && !link;
  if (s.ph === 1 && !ph) return null;
  // 26/10/2026: קריוקי — רק במצב השרת (בלי Claude: העובד מפריד, מיישר וצורב), לא קובץ כתוביות ולא בטלפון; חייבים מילים
  // 1/11/2026 (בקשת המשתמש — "תרגום רגיל בשרת, הסרטון עולה דרך האפליקציה"): pu = Studio לאנדרואיד רק מעלה (הקול ואז הסרטון,
  // ב־UIDT — ממשיך במסך כבוי), והשרת עושה הכל כמו בעבודה רגילה (התמלול, השוטים, הצריבה). בלי עיבוד בטלפון ובלי חיתוך
  const pu = s.pu === 1 && s.eng === 'api' && !subs && !link && !ph && s.ka !== 1;
  if (s.pu === 1 && !pu) return null;
  const ka = s.ka === 1;
  // 01/11/2026: בלי מילים = תמלול אוטומטי בעובד (al = שפת השיר: he / en — ivrit לא מזהה שפה בעצמו). = KA_AL בטלפון
  const al = ka && !normLyr(s.lyr).trim() && KA_AL.includes(s.al) ? s.al : '';
  if (ka && (s.eng !== 'api' || subs || ph || s.cp === 1 || s.ry === 1 || (!normLyr(s.lyr).trim() && !al))) return null;
  return Object.assign({
    name, size,
    type: String(s.type || '').slice(0, 60).replace(/[^\w.+/-]/g, ''),
    dur: Math.max(0, Math.min(24 * 3600, Math.round(Number(s.dur) || 0))),     // שניות (0 = לא ידוע)
    from: s.from === 'auto' || LANGS.includes(s.from) ? s.from : 'auto',
    to,
    mode: modeNow(s.mode),
    out: subs || ph ? [] : ka ? uniq(s.out, (k) => KA_OUTS.includes(k)) : uniq(s.out, (k) => OUTS.includes(k)),                      // SRT תמיד; ריק = SRT בלבד (+ VTT/ASS כעזר)
    style: STYLES.includes(s.style) ? s.style : STYLES[0],
    ...(!subs && normSty(s.sty) ? { sty: normSty(s.sty) } : {}),   // 26/10/2026: העיצוב כבר בצריבה הראשונה (עד היום רק בהפקה מחדש)
    terms: String(s.terms || '').replace(/\u0000/g, '').slice(0, 1000),
  }, subs ? Object.assign({ src: 'subs', sdh: s.sdh === 'keep' ? 'keep' : 'rm' }, SUBS_FPS.includes(String(s.fps)) ? { fps: String(s.fps) } : {}) : {},
  link ? Object.assign({ src: 'url', url, pick }, ref ? { ref } : {}) : {},
  ka ? Object.assign({ ka: 1, lyr: normLyr(s.lyr), ky: normKy(s.ky) }, al ? { al } : {}, s.bv === 1 ? { bv: 1 } : {}, Number.isFinite(+s.gv) && +s.gv > 0 ? { gv: Math.min(60, Math.round(+s.gv)) } : {}) : {},   // קריוקי: עם קולות רקע, קול מנחה ב־%
  // 25/10/2026 (שלב 2): pw = גם התמלול והיישור בטלפון — עולים רק המילים עם הזמנים (w) והמדידות (m), בלי קול
  // 25/10/2026 (שלב 3): pt = גם שלבי הטקסט בטלפון (vt בפייתון של Studio) — השרת רק מעביר את הקריאות ל־Claude (התור, המפתח של
  // המערכת) ומחשב את העלות. רק עם pw, ורק במפתח של המערכת (לא העתק־הדבק ולא "המנוי שלי")
  ph ? Object.assign({ ph: 1 }, s.pw === 1 ? { pw: 1 } : {}, s.pw === 1 && s.pt === 1 && s.cp !== 1 && s.ry !== 1 ? { pt: 1 } : {},
    PH_BURN.includes(s.pb) ? { pb: s.pb } : {}, s.vc === 1 ? { vc: 1 } : {}) : {},   // pb = מה הטלפון צורב בסוף (ריק = רק כתוביות)
  // 29/10/2026: vc = Studio לאנדרואיד מעלה גם את הסרטון לענן, ברקע ובלי לעכב את העבודה (לנגן ולשמירה) — העבודה לא מחכה לו
  pu ? { pu: 1, vc: 1 } : {},   // vc — אותו מסלול הסרטון לענן (phVp, ‏phUp עם v) כמו בתרגום בטלפון
  !subs && !link && !ph && !pu && edlPre(normEdl(s.edl)) ? { edl: edlPre(normEdl(s.edl)) } : {},   // מ4: חיתוך לפני התרגום (dur = האורך אחרי החיתוך)
  // 21/10/2026: פיקסלים לשנייה ביחס ל־1080p30 (מהמידות שהטלפון קרא; העובד מתקן אחרי הקליטה) — לצפי של הצריבה
  Number.isFinite(+s.px) && +s.px >= 0.02 && +s.px <= 16 ? { px: Math.round(+s.px * 1000) / 1000 } : {},
  s.eng === 'api' ? Object.assign({ eng: 'api', cap: normCap(s.cap) }, s.cp === 1 ? { cp: 1 } : s.ry === 1 ? { ry: 1 } : {}) : {});   // 24/10/2026: ry = השרת עושה הכל, Claude דרך ה־Routine של המשתמש (lib/relay.js)   // מצב API של המערכת — עם תקרת עבודה ($); סבב 10: cp = העתק־הדבק (Claude של המשתמש)
}
/* קובץ שעלה ל־Drive (מה ש־Drive עצמו החזיר — api/studio.js מאמת מולו) */
function normFile(f) {
  if (!f || !FILE_ID_RE.test(String(f.id || ''))) return null;
  const size = Math.floor(Number(f.size) || 0);
  if (!(size > 0)) return null;
  return { id: f.id, name: clean(f.name, 200), size, mime: String(f.mimeType || f.mime || '').slice(0, 80) };
}

/* v358: רשימת התוצרים מהעובד — עד OUT_MAX, כל אחד מזהה Drive + סוג מוכר (האימות מול Drive — בשרתון) */
function normOut(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const o of list.slice(0, OUT_MAX)) {
    const f = normFile(o);
    if (!f || !OUT_KINDS.includes(o && o.k) || out.some((x) => x.k === o.k)) return null;
    out.push({ id: f.id, name: f.name, size: f.size, k: o.k });
  }
  return out.length ? out : null;
}

/* איכויות צפייה לפי ת־נגן (10/10/2026, translator/ladder.py): הראשונה = המקור עצמו (אותו קובץ, ארוז מחדש בלי קידוד —
   המזהה של fv), אחריה האיכויות הנמוכות מהגבוהה לנמוכה. כל קובץ מאומת מול Drive בשרתון (בתיקיית העבודה, בגודל שדווח).
   הטלפון בונה מהן את רשימות ההשמעה (האינדקס בתחילת כל קובץ) — אין כאן רשימות, רק מה שהנגן צריך לרשימה הראשית */
const HL_MAX = 8;
const HL_C_RE = /^[A-Za-z0-9.-]{3,40}(,[A-Za-z0-9.-]{3,40})?$/;   // 22/10/2026: גם ac-3 / ec-3 (Dolby — נשאר במקור)
function normHl(list, vid) {
  if (!Array.isArray(list) || list.length < 2 || list.length > HL_MAX) return null;
  const out = [];
  for (const x of list) {
    if (!x || typeof x !== 'object' || !FILE_ID_RE.test(String(x.id || '')) || out.some((y) => y.id === x.id)) return null;
    const w = Math.floor(Number(x.w)), h = Math.floor(Number(x.h)), bw = Math.floor(Number(x.bw)), abw = Math.floor(Number(x.abw)), size = Math.floor(Number(x.size));
    if (!(w >= 16 && w <= 8192 && h >= 16 && h <= 8192 && bw >= 1000 && bw <= 5e8 && abw >= 1000 && abw <= bw && size > 0)) return null;
    if (!HL_C_RE.test(String(x.c || ''))) return null;
    const short = Math.min(w, h);
    if (out.length && short >= Math.min(out[out.length - 1].w, out[out.length - 1].h)) return null;   // מהגבוהה לנמוכה, בלי כפילות
    out.push({ id: x.id, w, h, bw, abw, c: x.c, size });
  }
  return vid && out[0].id !== vid ? null : out;
}
/* 22/10/2026 (בקשת המשתמש: לא לדרוס קול איכותי): עותק הקול לנגן — Opus בלבד, לצד המקור שבו נשאר הקול המקורי (Dolby/DTS…).
   הטלפון משתמש בו רק כשהוא לא מנגן את הקול המקורי בעצמו. **זהה ל־normAlt ב־studioplay.js** */
// 23/10/2026: כמה רצועות קול — רשימה (עד HLA_MAX), לכל אחת שפה (קוד ISO בלבד) ו־d = ברירת המחדל. אובייקט יחיד (עבודה
// מלפני 23/10 / עובד ישן) = רשימה של אחת. תמיד מחזיר רשימה או null; פריט לא תקין — כל הרשימה נזרקת
const HLA_MAX = 4;
const HLA_LANG_RE = /^[a-z]{2,3}$/;
function normHla1(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || !FILE_ID_RE.test(String(x.id || '')) || x.c !== 'opus') return null;
  const bw = Math.floor(Number(x.bw)), abw = Math.floor(Number(x.abw)), ch = Math.floor(Number(x.ch)), size = Math.floor(Number(x.size));
  if (!(bw >= 8000 && bw <= 2e6 && abw >= 8000 && abw <= bw && ch >= 1 && ch <= 8 && size > 0)) return null;
  const o = { id: x.id, c: 'opus', bw, abw, ch, size };
  if (HLA_LANG_RE.test(String(x.l || ''))) o.l = x.l;
  if (x.d === 1) o.d = 1;
  return o;
}
function normHla(x) {
  const list = Array.isArray(x) ? x : x ? [x] : [];
  if (!list.length || list.length > HLA_MAX) return null;
  const out = [];
  for (const y of list) { const o = normHla1(y); if (!o || out.some((z) => z.id === o.id)) return null; out.push(o); }
  if (out.filter((o) => o.d).length > 1) return null;
  return out;
}

/* v359: הטוקנים והעלות של העבודה (מהעובד, בדיווח האחרון — finish/fail). עד 6 שורות: סוג (תיאום/תרגום/ביקורת/סוכן־משנה),
   מזהה מודל רק בתבנית claude-…, וכל השאר מספרים. משהו לא תקין → null (וכל הנתון נזרק — לא חלקי) */
const USE_KINDS = ['main', 'tl', 'rv', 'jg', 'sub'];   // v375: jg = שופט האיכות (Haiku)
const USE_MODEL_RE = /^claude-[a-z0-9-]{1,50}$/;
const USE_INTS = ['n', 'i', 'o', 'cr', 'c5', 'c1', 'op'];
const USE_USD = ['usd', 'oc'];
function normUsage(list) {
  if (!Array.isArray(list) || !list.length || list.length > 6) return null;
  const out = [];
  for (const r of list) {
    if (!r || typeof r !== 'object' || Array.isArray(r) || !USE_KINDS.includes(r.k) || !USE_MODEL_RE.test(String(r.m || ''))) return null;
    const row = { k: r.k, m: r.m };
    for (const f of USE_INTS) {
      if (r[f] == null && f === 'op') continue;
      const v = r[f];
      if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > 1e11) return null;
      row[f] = v;
    }
    for (const f of USE_USD) {
      if (!(f in r)) continue;
      const v = r[f];
      if (v === null) { row[f] = null; continue; }           // מודל בלי מחירון
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1e5) return null;
      row[f] = Math.round(v * 1e4) / 1e4;
    }
    out.push(row);
  }
  return out;
}

/* v361: נקודת שמירה מהעובד (האימות מול Drive — בשרתון, כמו התוצרים) */
function normCk(c) {
  if (!c || typeof c !== 'object' || !CK_STAGES.includes(c.s) || !FILE_ID_RE.test(String(c.id || ''))) return null;
  const size = Math.floor(Number(c.size) || 0);
  if (!(size > 0) || size > CK_MAX_SIZE) return null;
  return { s: c.s, id: c.id, size };
}
/* הרשימה השמורה: אחת לכל שלב (חדשה מחליפה ישנה של אותו שלב), לפי סדר השלבים */
function addCk(list, ck, now) {
  const out = (Array.isArray(list) ? list : []).filter((x) => x && CK_STAGES.includes(x.s) && x.s !== ck.s);
  out.push(Object.assign({}, ck, { at: now }));
  return out.sort((a, b) => CK_STAGES.indexOf(a.s) - CK_STAGES.indexOf(b.s)).slice(-CK_STAGES.length);
}
const lastCk = (list) => (Array.isArray(list) && list.length ? list[list.length - 1] : null);
/* העבודה "רצה" אבל לא דיווחה שעתיים — הסשן נפל (מיכל שנסגר, תקלה בצד של Claude) */
const isStale = (job, now) => !!job && (job.state === 'running' || job.state === 'queued' && job.claimed && !job.vw) && now - (job.updated || 0) > STALE_MS;   // vw: מחכה לסרטון בתור — לא תקועה
/* אפשר להמשיך? עבודת תרגום עם קבצים, שנכשלה / בוטלה / נתקעה, ולא הופעלה יותר מדי פעמים */
function canResume(job, now) {
  if (!job || job.kind !== 'tr' || !(job.fa || job.fv)) return 'state';
  if (job.sx > 0) return 'src_gone';   // 26/10/2026: סרטון המקור כבר נמחק (יום מפתיחת הפרויקט)
  const st = effState(job, now).state;
  if (!(st === 'failed' || st === 'cancelled' || isStale(job, now))) return 'state';
  if ((job.fires || 0) >= RESUME_MAX) return 'resume_limit';
  return '';
}
/* 25/10/2026: המשוב שלך על התרגום (בקשת המשתמש, לפי התצוגה המקדימה) — 👍/👎 (r: 1 / -1, 0 = לא דירגת),
   מה לא היה טוב (קודים קבועים בלבד, רק עם 👎) והכתוביות שסימנת בנגן (מזהי vt). בלי טקסט חופשי.
   **RATE_WHY, RATE_FLAG_MAX ו־normRate זהים ב־studio.js (הטלפון)** — tests/studio-rate.test.js */
const RATE_WHY = ['acc', 'nat', 'tim', 'nm', 'brk', 'ovl', 'mis', 'oth'];
const RATE_FLAG_MAX = 60;
function normRate(o) {
  if (!o || typeof o !== 'object') return null;
  const r = o.r === 1 || o.r === -1 ? o.r : 0;
  const w = r === -1 && Array.isArray(o.w) ? RATE_WHY.filter((k) => o.w.includes(k)) : [];
  const c = Array.isArray(o.c) ? [...new Set(o.c.filter((x) => Number.isInteger(x) && x >= 0 && x < 1e6))].sort((a, b) => a - b).slice(0, RATE_FLAG_MAX) : [];
  if (!r && !c.length) return null;
  const at = Number.isFinite(+o.at) && +o.at > 0 ? Math.floor(+o.at) : 0;
  return Object.assign({ r }, w.length ? { w } : {}, c.length ? { c } : {}, at ? { at } : {});
}
/* 25/10/2026: עבודה "חדשה" שהשרתון מתחיל לבד בבדיקה המתוזמנת (startAll ב־api/studio.js). sw = קוד הסירוב האחרון.
   סירוב חולף (START_RETRY) — שוב אחרי START_GAP; בלי סירוב — "התחל" לא הגיע: מקישור (הטלפון מתחיל ביצירה) אחרי
   START_URL_WAIT, אחרת אחרי START_IDLE מהכתיבה האחרונה (הקול עלה, ו"התחל" לא הגיע). סירוב שצריך אותך (חוקים, מתג החירום,
   מצב נעול...) — לא. START_RETRY זהה ל־START_RETRY ב־studio.js (הטלפון) */
const START_RETRY = ['maint', 'flag_off', 'major'];
const START_GAP = 2 * 60e3, START_URL_WAIT = 3 * 60e3, START_IDLE = 10 * 60e3;
function startDue(job, now, age) {
  if (!job || job.state !== 'new' || !['tr', 'rr', 'ai', 'dx'].includes(job.kind)) return false;
  if (!(now - (job.created || 0) < age) || effState(job, now).state !== 'new') return false;
  if (job.sw) return START_RETRY.includes(job.sw) && now - (job.swt || 0) >= START_GAP;
  if (job.spec && job.spec.src === 'url') return now - (job.created || 0) >= START_URL_WAIT;
  return now - (job.updated || job.created || 0) >= START_IDLE;
}
/* v368: מתי ממשיכים לבד (0 = לא): נכשלה בתקלה חולפת, עוד לא המשכנו לבד, ואפשר להמשיך */
function recoverAt(job, now) {
  if (!job || !job.rw || (job.ar || 0) >= AUTO_RESUME_MAX) return 0;
  if (effState(job, now).state !== 'failed' || canResume(job, now)) return 0;
  return job.rw;
}
/* v362: מגדל הפיקוח — מצב מהעובד (ה־Hook בסשן): רמה, סיבה (בעצירה), פי כמה מהרגיל, עלות לפי מחירון ה־API והצפוי עד עכשיו */
const TW_LV = ['ok', 'warn', 'red'];
const TW_WHY = ['cost', 'cap', 'loop', 'calls', 'idle'];
function normTower(t) {
  if (!t || typeof t !== 'object' || !TW_LV.includes(t.lv)) return null;
  const n = (v, max, d) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(Math.min(v, max) * 10 ** d) / 10 ** d : 0);
  const out = { lv: t.lv, x: n(t.x, 1000, 1), usd: n(t.usd, 1e5, 2), exp: n(t.exp, 1e5, 2) };
  if (t.b === 'u') { out.b = 'u'; out.nj = Math.round(n(t.nj, 1000, 0)); }   // v363: "הרגיל" נלמד מהעבודות של המשתמש (nj = כמה)
  if (t.lv === 'red' && FP_RE.test(String(t.fp || ''))) out.fp = t.fp;   // v364: טביעת האצבע של התקלה — לספר התיקונים
  if (t.shn != null) { out.shn = Math.round(n(t.shn, 3, 0)); if (t.sh === 1 && t.lv === 'warn') out.sh = 1; }   // v384: מצב צל — "בספים החדשים היה נעצר"
  if (t.lv === 'red') {
    if (!TW_WHY.includes(t.why)) return null;
    out.why = t.why;
    if (t.n != null) out.n = Math.round(n(t.n, 1000, 0));
    if (t.min != null) out.min = Math.round(n(t.min, 1440, 0));
  }
  return out;
}

/* v363: "הרגיל" נלמד מהעבודות של המשתמש — לכל עבודת תרגום שהסתיימה בהפעלה אחת: המצב, אורך הסרטון והעלות
   (מחירון ה־API, מהדיווח של העובד). החציון לשעת סרטון, לכל מצב, מ־NORM_MIN עבודות; עד אז — המדידות שלנו (NORM_DEF,
   **זהה ל־PER_HOUR + FIXED ב־translator/tower.py** — הבדיקה משווה). עבודה שהופעלה שוב (המשך אחרי עצירה/תקלה) לא נכנסת:
   הסשנים הנוספים מנפחים את העלות, ותקלה לא אמורה ללמד את המגדל ש"זה רגיל". */
const NORM_MIN = 3, NORM_KEEP = 40, NORM_DUR_MIN = 600;
// Haiku 5.5 (10/10/2026): מחושב ממאגר המדידות — הטוקנים של Sonnet Medium (5 דק׳ TED) במחיר של Haiku (פי 20 זול) ×1.3
// (הטוקנייזר שלו סופר יותר) = ‎~0.2$ לשעה במצב API; ב־Routine הסשן המתזמר נשאר Sonnet (‎~1.1$). 0.6/0.8 = בין השניים,
// כך שאף מנוע לא מגיע ל"חריג" (פי 2) בלי סיבה. יוחלף ב"רגיל" הנלמד מ־NORM_MIN עבודות.
// Sonnet Low (15/10/2026): הערכה — פחות חשיבה מ־Medium; יוחלף ב"רגיל" הנלמד
const NORM_DEF = { 'sonnet-medium': 3.0, 'haiku-high': 0.8, 'haiku-medium': 0.7, 'sonnet-high': 4.2, 'opus-medium': 6.0, 'sonnet-low': 2.2 };
const NORM_FIXED = 1.5;
/* 11/10/2026: מצב השרת (API) — בלי סשן Claude מתזמר: אין "עלות פתיחה" של ~127K טוקנים, ומנהל העבודה רץ במודל של המצב.
   מהמדידות (5 דק׳ TED, translator/bench: ‎$0.565 / 0.345 / 0.215 / 0.045 / 0.04 לעבודה) × 12, מעוגל מעלה; הקבוע = השופט
   ושאר מה שלא תלוי באורך. עד 11/10 השרת השתמש בערכי ה־Routine — "הרגיל" ל־Haiku High היה $0.80 ($0.54 בפועל), והתקציב
   לעבודה של 5 דק׳ ‎~$1.55 (בפועל $0.04). **זהה ל־NORM_DEF_API / NORM_FIXED_API בטלפון** (studio.js). */
const NORM_DEF_API = { 'sonnet-medium': 2.6, 'haiku-high': 0.55, 'haiku-medium': 0.5, 'sonnet-high': 4.2, 'opus-medium': 7.0, 'sonnet-low': 1.8 };
const NORM_FIXED_API = 0.05;
const engKey = (e) => (e === 'api' || e === 'a' ? 'a' : 'r');
const normDef = (mode, eng) => (engKey(eng) === 'a' ? NORM_DEF_API : NORM_DEF)[mode];
const normFixed = (eng) => (engKey(eng) === 'a' ? NORM_FIXED_API : NORM_FIXED);
function normSample(job, use, now) {
  const sp = job && job.spec;
  if (!job || job.kind !== 'tr' || (job.fires || 0) > 1 || !sp || !MODES.includes(sp.mode) || !(sp.dur > 0)) return null;
  if (sp.xe || sp.xg) return null;   // 24/10/2026: ניסוי המאמץ / בלי מילון — לא מה שהמצב עולה בדרך כלל
  if (!Array.isArray(use) || !use.length || use.some((r) => r.usd == null)) return null;   // מודל בלי מחירון — לא יודעים כמה עלה
  const u = use.reduce((s, r) => s + (r.usd || 0), 0);
  if (!(u > 0) || u > 1e4) return null;
  return { m: sp.mode, d: Math.round(sp.dur), u: Math.round(u * 100) / 100, at: now, e: engKey(job.eng) };   // e: המנוע — העלות שונה בסדר גודל
}
function addSample(list, s) {
  return (Array.isArray(list) ? list : []).filter((x) => x && MODES.includes(x.m) && x.d > 0 && x.u > 0).concat(s ? [s] : []).slice(-NORM_KEEP);
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
/* לשעת סרטון (אורך מינימלי 10 דק׳ — בסרטון קצר עלות הפתיחה שולטת). ph = החציון, mx = הכבדה ביותר, n = כמה עבודות */
/* eng: 'r' (Routine) / 'a' (השרת). דגימה בלי מנוע (לפני 11/10) לא נלמדת — אי אפשר לדעת מאיזה מנוע היא */
function learnedNorm(list, mode, eng) {
  const e = engKey(eng);
  const rates = addSample(list, null).filter((x) => x.m === mode && x.e === e).map((x) => x.u / (Math.max(x.d, NORM_DUR_MIN) / 3600));
  if (rates.length < NORM_MIN) return null;
  const r2 = (v) => Math.round(v * 100) / 100;
  return { ph: r2(median(rates)), mx: r2(Math.max(...rates)), n: rates.length };
}
/* v384: מצב צל לספים חדשים (ServiceNow: Kill switch · warn_only). כש"הרגיל" של מצב משתנה משמעותית — נלמד לראשונה, או החציון /
   סף העצירה זזו ב־SH_DIFF ומעלה — הספים החדשים רצים SHADOW_N עבודות במצב צל: המגדל אוכף את הישנים (`old`; null = המדידות שלנו)
   ורק מזהיר כשהחדשים היו עוצרים. שינוי קטן (חציון שזז מעט אחרי כל עבודה) — מתעדכן בשקט, בלי צל.
   הרשומה לכל מצב ב־studioStats/{uid}.thr: { nm, old, n } (לא th — זה ה־hash של טוקן השרת ב־studioServers, ו־JSON_FIELDS חל על כל המסמכים). RED_X זהה ל־tower.py */
const SHADOW_N = 3, SH_DIFF = 0.25, RED_X = 4;
const redOf = (nm) => (nm ? Math.max(RED_X, 2 * nm.mx / nm.ph) : RED_X);
function thStep(prev, nm) {
  const clean = (x) => (x && x.ph > 0 ? { ph: x.ph, mx: Math.max(x.mx || x.ph, x.ph), n: x.n || 0 } : null);
  nm = clean(nm);
  if (!prev || typeof prev !== 'object') return { next: { nm, old: null, n: 0 }, sh: null };   // הרשומה הראשונה — הספים כבר בתוקף, בלי צל
  const pn = clean(prev.nm);
  const changed = !pn !== !nm || (pn && nm && (Math.abs(nm.ph / pn.ph - 1) >= SH_DIFF || Math.abs(redOf(nm) / redOf(pn) - 1) >= SH_DIFF));
  const next = changed ? { nm, old: pn, n: SHADOW_N } : { nm, old: clean(prev.old), n: Math.max(0, Math.min(SHADOW_N, prev.n | 0)) };
  if (!next.n) return { next, sh: null };
  const sh = { n: next.n, old: next.old };
  next.n -= 1;
  return { next, sh };
}
/* לטלפון: מצבים שהספים שלהם עוד במצב צל — כמה עבודות עד אכיפה */
function thView(th) {
  const out = {};
  for (const m of MODES) { const e = th && th[m]; if (e && e.n > 0) out[m] = e.n; }
  return out;
}
/* v384: "המשך" חוזר — 3 ב־24 שעות לאותה עבודה = לולאה: ההמשך האוטומטי נעצר, וידני רק באישור (lo) */
const LOOP_N = 3, LOOP_WIN = 24 * 3600e3;
const loopRecent = (job, now) => (Array.isArray(job.rh) ? job.rh : []).filter((t) => typeof t === 'number' && now - t < LOOP_WIN && t <= now);
/* לטלפון (מסך "מגדל הפיקוח"): לכל מצב — הנלמד, או ברירת המחדל (d: true) */
function normsView(list, eng) {
  const out = {}, e = engKey(eng);
  for (const m of MODES) {
    const l = learnedNorm(list, m, e);
    out[m] = l || { ph: normDef(m, e), n: addSample(list, null).filter((x) => x.m === m && x.e === e).length, d: true };
  }
  return out;
}

/* v364: ספר התיקונים — כל עצירה של המגדל נרשמת לפי טביעת אצבע (סוג · שלב · השגיאה שחזרה, בלי טקסט חופשי) ב־studioStats/{uid}.fb.
   התיקון = משפט קצר ש־Claude רושם אחרי שאבחן את העצירה (בהמשך העבודה). בעבודה הבאה, כשאותה תקלה מתחילה לחזור, המגדל מזכיר
   לו את התיקון לפני העצירה ("טופל לבד"). הטקסט מגיע מסשן שמעבד תוכן לא מהימן — מוגבל באורך, בלי כתובות וקוד, מוצג כטקסט בלבד,
   ובחזרה ל־Claude הוא ממוסגר כמידע (tower.py) */
const FP_RE = /^[0-9a-f]{12}$/;
const FB_MAX = 30, FIX_MAX = 160;
function normFixText(t) {
  const x = clean(t, 400).replace(/https?:\/\/\S+|www\.\S+/gi, '').replace(/[`<>{}\[\]\\$|]/g, '').replace(/\s+/g, ' ').trim().slice(0, FIX_MAX);
  return x.length >= 4 ? x : '';
}
function fbList(a) {
  return (Array.isArray(a) ? a : []).filter((e) => e && FP_RE.test(String(e.fp || '')) && TW_WHY.includes(e.why)).slice(-FB_MAX);
}
/* v376: מספר קבוע לכל בעיה (B1, B2…) — רשומה ישנה בלי מספר מקבלת לפי סדר ההופעה, אחרי הגבוה שכבר ניתן */
function fbNumber(list) {
  let top = list.reduce((m, e) => Math.max(m, Number.isInteger(e.no) && e.no > 0 ? e.no : 0), 0);
  for (const e of list) if (!(Number.isInteger(e.no) && e.no > 0)) e.no = ++top;
  return list;
}
/* עצירה חדשה של המגדל → רשומה (או עוד פעם לרשומה קיימת) */
function fbStop(list, tw, st, now) {
  if (!tw || !FP_RE.test(String(tw.fp || '')) || !TW_WHY.includes(tw.why)) return null;
  const out = fbList(list).map((e) => Object.assign({}, e));
  let e = out.find((x) => x.fp === tw.fp);
  if (!e) { e = { fp: tw.fp, why: tw.why, st: STAGES.includes(st) ? st : '', n: 0, auto: 0, fix: '', at: now }; out.push(e); }
  e.n = (e.n || 0) + 1; e.at = now;
  return fbNumber(out).slice(-FB_MAX);
}
/* v366: מסלול התיקונים של המשתמש — "הצעות לאישור" (ברירת המחדל, כמו Supervised ב־ServiceNow ומאמר ידע שעובר בדיקה לפני פרסום)
   או "עצמאי" (Claude מחליט לבד). ההצעה משמשת את Claude בעבודה שבה נכתבה; לעבודות הבאות היא עוברת רק אחרי אישור */
const FIX_MODES = ['suggest', 'auto'];
const normFixMode = (m) => (m === 'auto' ? 'auto' : 'suggest');
/* Claude רשם תיקון לתקלה (רק לרשומה שכבר קיימת אצל המשתמש). במסלול "הצעות" — הצעה (px); תיקון קודם שאושר נשאר בשימוש עד ההחלטה */
function fbFix(list, fp, text, now, mode) {
  const t = normFixText(text);
  const out = fbList(list).map((e) => Object.assign({}, e));
  const e = out.find((x) => x.fp === fp);
  if (!e || !t) return null;
  if (normFixMode(mode) === 'auto') { e.fix = t; e.fx = now; delete e.px; delete e.pa; }
  else if (t !== e.fix) { e.px = t; e.pa = now; }
  return out;
}
/* v366: המשתמש החליט על הצעה — לשמור (הופכת לתיקון) או לא (נמחקת; התיקון הקודם, אם יש, נשאר) */
function fbDecide(list, fp, ok, now) {
  const out = fbList(list).map((e) => Object.assign({}, e));
  const e = out.find((x) => x.fp === fp);
  if (!e || !e.px) return null;
  if (ok === true) { e.fix = e.px; e.fx = now; }
  delete e.px; delete e.pa;
  return out;
}
/* 14/10/2026: מחיקת רשומה מספר התיקונים (מהטלפון) — כשהתקלה תוקנה בקוד או שהתיקון שגוי. null = אין כזו */
function fbRemove(list, fp) {
  const all = fbList(list);
  const out = all.filter((x) => x.fp !== fp);
  return out.length === all.length ? null : out;
}
/* המגדל הזכיר תיקון מוכר לפני שהתקלה הגיעה לעצירה */
function fbUsed(list, fp, now) {
  const out = fbList(list).map((e) => Object.assign({}, e));
  const e = out.find((x) => x.fp === fp);
  if (!e) return null;
  e.auto = (e.auto || 0) + 1; e.ua = now;
  return out;
}
/* לעובד: רק תקלות שיש להן תיקון (שאושר — הצעה שממתינה לא נכנסת) */
const fbForWorker = (list) => fbList(list).filter((e) => e.fix).map((e) => ({ fp: e.fp, why: e.why, st: e.st, fix: e.fix }));
/* לטלפון: הכל, מהחדשה */
const fbView = (list) => fbNumber(fbList(list).map((e) => Object.assign({}, e))).sort((a, b) => (b.at || 0) - (a.at || 0))
  .map((e) => ({ no: e.no, fp: e.fp, why: e.why, st: e.st || '', n: e.n || 0, auto: e.auto || 0, fix: e.fix || '', px: e.px || '', at: e.at || 0 }));
/* v376: מצבים שעולים בהמשך תור (מצב זול יותר אחרי עצירה על עלות) — לפי הצפוי לשעה, מהקרוב ביותר */
const cheaperModes = (mode) => MODES.filter((m) => NORM_DEF[m] < (NORM_DEF[modeNow(mode)] || 0)).sort((a, b) => NORM_DEF[b] - NORM_DEF[a]);
const COST_STOP = (job) => !!job && (job.err === 'budget_stop' || job.err === 'budget_cap' || (job.err === 'tower_stop' && !!job.tw && (job.tw.why === 'cost' || job.tw.why === 'cap')));

/* v361: הטוקנים של כמה סשנים (הפעלה + המשכים) — סכום לפי סוג ומודל */
function mergeUse(a, b) {
  const rows = [];
  for (const r of [].concat(Array.isArray(a) ? a : [], Array.isArray(b) ? b : [])) {
    const k = rows.find((x) => x.k === r.k && x.m === r.m);
    if (!k) { rows.push(Object.assign({}, r)); continue; }
    for (const f of USE_INTS) if (r[f] != null) k[f] = (k[f] || 0) + r[f];
    for (const f of USE_USD) if (f in r) k[f] = k[f] === null || r[f] === null ? null : Math.round(((k[f] || 0) + (r[f] || 0)) * 1e4) / 1e4;
  }
  return rows.length ? rows.slice(0, 6) : null;
}

/* שאלה קצרה מהעובד באמצע העבודה (שלב 3, סבב ד׳): מזהה, שאלה, עד 4 תשובות מוכנות, ברירת מחדל וזמן המתנה.
   הטקסט מגיע מ־Claude ומוצג בטלפון כטקסט (textContent) — כאן רק אורך ותווים. שאלה חדשה מחליפה קודמת */
const ASK_ID_RE = /^q[a-z0-9]{1,12}$/;
const ASK_WAIT_MAX = 30 * 60;
const ASK_MAX = 5;                       // שאלות לעבודה — Claude אמור לשאול לכל היותר 2 (RUNBOOK); מעבר לזה לולאה
function normAsk(a) {
  if (!a || typeof a !== 'object' || !ASK_ID_RE.test(String(a.id || ''))) return null;
  const q = clean(a.q, 300);
  if (!q) return null;
  const o = (Array.isArray(a.o) ? a.o : []).slice(0, 12).map((x) => clean(x, 80)).filter(Boolean).slice(0, 4);
  const d = Number.isInteger(a.d) && a.d >= 0 && a.d < o.length ? a.d : (o.length ? 0 : -1);
  const w = Math.max(60, Math.min(ASK_WAIT_MAX, Math.round(Number(a.w) || 480)));
  // 20/10/2026: nb = שאלה שלא עוצרת את העבודה (העובד ממשיך עם ברירת המחדל; אפשר לענות גם אחרי הסוף ולתקן לפיה)
  return a.nb === 1 ? { id: a.id, q, o, d, w, nb: 1 } : { id: a.id, q, o, d, w };
}
/* התשובה מהטלפון: אחת מהתשובות המוכנות (i) או טקסט חופשי (t) — רק כשאין תשובות מוכנות */
function normAnswer(qa, body) {
  if (!qa || qa.a || String(body.qid || '') !== qa.id) return null;
  if (qa.o.length) {
    const i = Number(body.i);
    return Number.isInteger(i) && i >= 0 && i < qa.o.length ? { i, t: qa.o[i] } : null;
  }
  const t = clean(body.t, 200);
  return t ? { i: -1, t } : null;
}

/* ---------- v367: החוקים שלך, מתג החירום ושערי אישור (AI Control Tower — Govern / Secure) ----------
   חוקים (studioStats/{uid}.rl): תקציב לעבודה בדולרים לפי מחירון ה־API (0 = בלי), מצב מקסימלי ('' = כל המצבים),
   אישור לפני צריבה. הפרה = התראה, והפעולה מחכה לך בטלפון ("שער" — שאלה שהשרתון בונה, בלי טקסט מ־Claude) */
const RULE_BUDGET_MAX = 500;
function normRules(r) {
  const o = r && typeof r === 'object' ? r : {};
  const b = Number(o.b);
  return {
    b: Number.isFinite(b) && b >= 1 ? Math.min(RULE_BUDGET_MAX, Math.round(b * 2) / 2) : 0,
    mx: MODES.includes(o.mx) ? o.mx : LEGACY_MODES[o.mx] || '',   // 11/10: מקסימום במצב שהוסר → הקרוב (לא "בלי הגבלה")
    ab: o.ab === true,
    jx: o.jx === true,   // v375: שופט האיכות כבוי (ברירת המחדל — פועל, החלטה 4 בתוכנית)
    am: o.am === true,   // סבב 10: בדיקת משמעות אוטומטית לכתוביות שהשופט סימן (בטלפון, עם אומדן ואישור)
  };
}
/* המצב יקר מהמקסימום? לפי הצפוי לשעת סרטון (NORM_DEF): Haiku Medium < Haiku High < Sonnet Medium < Sonnet High < Opus Medium */
const modeOver = (mode, mx) => !!mx && MODES.includes(mode) && MODES.includes(mx) && NORM_DEF[mode] > NORM_DEF[mx];
/* כמה כבר עלו הסשנים הקודמים של העבודה (אחרי "המשך") — התקציב הוא לכל העבודה, לא לסשן */
/* 25/10/2026 (שלב 3 של "תרגום בטלפון"): העלות של עבודה שהטלפון מריץ — נספרת כאן, מכל תשובה של Claude שהשרת שלנו העביר
   (העונה בשרת מחשב את המחיר), לא מהדיווח של הטלפון. שורה לכל שלב (k), בפורמט של normUsage */
function useAdd(list, k, m, u, usd) {
  const out = (Array.isArray(list) ? list : []).map((r) => Object.assign({}, r));
  k = USE_KINDS.includes(k) ? k : 'main';
  let r = out.find((x) => x && x.k === k);
  if (!r) {
    if (out.length >= 6) r = out[out.length - 1];
    else { r = { k, m: USE_MODEL_RE.test(String(m || '')) ? m : 'claude-unknown', n: 0, i: 0, o: 0, cr: 0, c5: 0, c1: 0, usd: 0 }; out.push(r); }
  }
  r.n = (r.n || 0) + 1;
  for (const f of ['i', 'o', 'cr', 'c5', 'c1']) {
    const v = Number(u && u[f]);
    r[f] = (r[f] || 0) + (Number.isFinite(v) && v >= 0 && v < 1e9 ? Math.round(v) : 0);
  }
  const d = Number(usd);
  r.usd = Math.round(((typeof r.usd === 'number' ? r.usd : 0) + (Number.isFinite(d) && d >= 0 && d < 1e4 ? d : 0)) * 1e4) / 1e4;
  return out;
}
const usdOf = (use) => Math.round((Array.isArray(use) ? use : []).reduce((s, r) => s + (r && typeof r.usd === 'number' ? r.usd : 0), 0) * 100) / 100;
/* שער: b = הגענו לתקציב (להמשיך / לעצור), r = לפני הצריבה (לצרוב / רק קובץ כתוביות). ברירת המחדל — הזהירה (d = 1) */
const GATE_KINDS = ['b', 'r'];
const GATE_MAX = 8;                      // שערים לעבודה — מעבר לזה משהו חוזר על עצמו
const GATE_WAIT = 30 * 60;
const CUE_T_RE = /^\d{1,2}:\d{2}(?::\d{2})?$/;
const newGateId = () => 'g' + crypto.randomBytes(6).toString('hex');
function normGate(g, id) {
  if (!g || typeof g !== 'object' || !GATE_KINDS.includes(g.k)) return null;
  let n;
  if (g.k === 'b') {
    const usd = Number(g.usd), cap = Number(g.cap);
    if (!(usd >= 0 && usd < 1e5) || !(cap > 0 && cap < 1e5)) return null;
    n = { usd: Math.round(usd * 100) / 100, cap: Math.round(cap * 100) / 100 };
  } else {
    // 5 כתוביות לדוגמה מהתרגום — תוכן מהסרטון: בטלפון רק כטקסט
    const cues = (Array.isArray(g.cues) ? g.cues : []).slice(0, 20)
      .map((c) => Object.assign({ t: CUE_T_RE.test(String((c && c.t) || '')) ? c.t : '', x: clean(c && c.x, 140) },
        clean(c && c.e, 160) ? { e: clean(c && c.e, 160) } : {})).filter((c) => c.x).slice(0, 5);   // 21/10: e = המקור באנגלית של אותו זמן
    n = { cues, cnt: Math.max(0, Math.min(1e5, Math.floor(Number(g.cnt) || 0))) };
  }
  return { id, g: g.k, q: '', o: ['go', 'stop'], d: 1, w: GATE_WAIT, n };
}

/* ---------- מזהים ומפתחות ---------- */
const newJobId = () => 'j' + crypto.randomBytes(15).toString('base64url');
const newKey = () => crypto.randomBytes(32).toString('base64url');
const keyHash = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
function keyMatches(job, key, f) {
  f = f || 'kh';   // 24/10/2026: rkh = מפתח ההעברה של ה־Routine (lib/relay.js) — נפרד ממפתח העובד, ופותח רק את פעולות ההעברה
  if (!job || !job[f] || !KEY_RE.test(String(key || ''))) return false;
  const a = Buffer.from(keyHash(key), 'hex'), b = Buffer.from(String(job[f]), 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/* מה נשלח ל־Routine: רק מזהה העבודה ומפתח העבודה. הסשן מקבל את זה עטוף כ"נתונים לא מהימנים";
   ההנחיה השמורה (מאשף החיבור) אומרת לו לקרוא רק את שתי השורות ולפעול לפי translator/RUNBOOK.md */
const fireText = (jobId, key) => 'SNOWBALL-STUDIO\njob=' + jobId + '\nkey=' + key + '\n';
function fireError(status, j) {
  const msg = String((j && j.error && j.error.message) || '');
  if (status === 401) return 'routine_auth';
  if (status === 403) return 'routine_forbidden';
  if (status === 404) return 'routine_missing';
  if (status === 429) return 'routine_rate';
  if (status === 400) return /paus/i.test(msg) ? 'routine_paused' : 'routine_bad';
  if (status >= 500) return 'routine_down';
  return 'routine_http_' + status;
}
/* v356: פרטים לאבחון הפעלה שנכשלה — הסטטוס, סוג השגיאה של Anthropic ומזהה הבקשה (לפנייה לתמיכה).
   רק תווים בטוחים ובלי ההודעה החופשית — מוצג בטלפון כמו שהוא */
function fireDetail(status, j, reqId) {
  const type = String((j && j.error && j.error.type) || '').replace(/[^a-z_]/g, '').slice(0, 40);
  const rid = String(reqId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 80);
  return ['HTTP ' + (Number(status) | 0), type, rid].filter(Boolean).join(' · ');
}
/* הסשן מתוך תשובה מוצלחת. הכתובת בטלפון תמיד בצורת session_ (כך נפתח סשן ב־claude.ai) — אם לא הגיעה כזו, נבנית מהמזהה.
   מבנה לא מוכר → null, וזה עדיין לא כשל: ההפעלה הצליחה (ראו fire ב־api/studio.js) */
function fireSession(j) {
  const m = SESSION_RE.exec(String((j && j.claude_code_session_id) || ''));
  if (!m) return null;
  const url = String((j && j.claude_code_session_url) || '');
  return { id: m[0], url: SESSION_URL_RE.test(url) ? url : 'https://claude.ai/code/session_' + m[1] };
}
/* תקציב ההפעלות: חותמות הזמן של השעה האחרונה */
const recentFires = (fh, now) => (Array.isArray(fh) ? fh : []).filter((t) => now - t < 3600e3).slice(-50);

/* 15/10/2026: עבודה בשרת שלנו שמחכה לסרטון חוזרת לתור (park) — רק תרגום במצב API, רצה, ורק כשהסרטון באמת חסר */
const parkable = (job) => !!(job && job.kind === 'tr' && job.state === 'running' && job.spec && job.spec.eng === 'api' && !(job.fv && job.fv.id));
/* ---------- מצב העבודה ---------- */
/* הופעל ולא נלקח בזמן סביר → נכשל (נבדק בכל קריאה; נשמר בכתיבה הבאה) */
function effState(job, now) {
  // v356: הפעלה "לא ודאית" (5xx/רשת — warn) שלא נלקחה: השגיאה של Anthropic, לא "לא התחיל" (שמפנה לרשת של הסביבה)
  if (job && job.state === 'queued' && job.eng === 'api') {
    // מצב API: העבודה בתור עד ששרת פנוי לוקח אותה. שרת לקח ולא התחיל בזמן / אף שרת לא לקח — נכשלה
    // 15/10/2026: חזרה לתור עד שהסרטון יגיע (vw = מתי) — לא "אין שרת"; 12 שעות בלי סרטון = כמו בעובד
    if (job.vw && !job.pk) return now - job.vw > PARK_MAX ? { state: 'failed', err: 'upload_timeout', at: job.vw + PARK_MAX } : { state: 'queued', err: '' };
    if (job.pk && now - job.pk > CLAIM_WAIT.tr) return { state: 'failed', err: 'no_claim', at: job.pk + CLAIM_WAIT.tr };
    if (!job.pk && job.fired && now - job.fired > API_QUEUE_WAIT) return { state: 'failed', err: 'no_server', at: job.fired + API_QUEUE_WAIT };
    return { state: 'queued', err: '' };
  }
  // at = הרגע שבו העבודה נחשבה "נכשלה" (בלי ended במסמך — הכישלון נגזר מהזמן). 11/10: בלעדיו התקלה קיבלה את updated,
  // שזז בכל צפייה (למשל רישום הסשן) — ובמגדל הופיעה שעת הסנכרון במקום שעת התקלה
  if (job && job.state === 'queued' && job.fired && now - job.fired > (CLAIM_WAIT[job.kind] || CLAIM_WAIT.tr)) return { state: 'failed', err: job.warn || 'no_claim', at: job.fired + (CLAIM_WAIT[job.kind] || CLAIM_WAIT.tr) };
  return { state: job ? job.state : 'failed', err: job ? job.err || '' : '' };
}
const fileView = (f) => (f && f.id ? Object.assign({ id: f.id, name: f.name || '', size: f.size || 0, at: f.at || 0 }, f.ext ? { ext: true } : {}, f.bx ? { bx: true } : {}) : null);   // ext = מקור מ־Drive של המשתמש (נבחר ב־Picker) — לא בתיקיית העבודה, ולא נוגעים בו
/* בחירת קבצים ותיקיות מ־Drive (Google Picker): מפתח דפדפן (מוגבל לאתר ול־Picker API — ב־Vercel, לא בריפו) ומספר הפרויקט
   (מהמזהה של לקוח ה־OAuth של הסטודיו — "123…-xxx.apps.googleusercontent.com"). בלי מפתח — אין כפתור Drive בטלפון */
function pickerCfg(env, clientId) {
  const key = String((env && env.STUDIO_PICKER_KEY) || '').trim();
  const app = String((env && env.STUDIO_PICKER_APP) || '').trim() || ((/^(\d{6,20})-/.exec(String(clientId || '')) || [])[1] || '');
  return /^[A-Za-z0-9_-]{20,80}$/.test(key) && /^\d{6,20}$/.test(app) ? { key, app } : null;
}
/* קובץ וידאו מ־Drive כמקור (Picker): קיים, לא בפח, בגודל של המקור, וסרטון (לפי הסוג או הסיומת) */
const EXT_VIDEO_RE = /\.(mp4|m4v|mov|mkv|webm|avi|mts|m2ts|3gp)$/i;
function extVideoOk(meta) {
  if (!meta || meta.trashed) return false;
  const mt = String(meta.mimeType || '');
  return /^video\//.test(mt) || ((mt === 'application/octet-stream' || mt === '') && EXT_VIDEO_RE.test(String(meta.name || '')));
}
/* מה הטלפון רואה — בלי המפתח (גם לא ה־hash) */
function publicJob(job, now) {
  const e = effState(job, now);
  return {
    id: job.id, kind: job.kind, state: job.rdy && e.state === 'running' ? 'done' : e.state, bg: job.rdy && e.state === 'running' ? 1 : 0, err: e.err, created: job.created || 0, updated: job.updated || 0,
    fired: job.fired || 0, claimed: job.claimed || 0, ended: job.ended || e.at || 0,
    spec: job.spec || null, files: { a: fileView(job.fa), v: fileView(job.fv), s: fileView(job.fsu), r: fileView(job.fsr), o: Array.isArray(job.fo) ? job.fo : [], c: fileView(job.fc), q: fileView(job.fq), m: fileView(job.fph), w: fileView(job.fpw) },
    folder: FILE_ID_RE.test(String(job.folder || '')) ? job.folder : '',
    rp: job.rp || '', ev: job.ev || 0, vh: Array.isArray(job.vh) ? job.vh.map((x) => (x && x.at) || 0) : [],   // מ2: הפקה מחדש (העבודה המקורית), גרסת הכתוביות, מתי נשמרה כל גרסה קודמת
    sess: job.sess && job.sess.url ? { url: job.sess.url } : null,
    prog: job.prog || null, ed: job.ed || '',
    use: Array.isArray(job.use) ? job.use : Array.isArray(job.use0) ? job.use0 : null,   // v359: טוקנים ועלות (v361: כולל סשנים קודמים)
    qa: job.qa && job.qa.id ? job.qa : null,        // שאלה מ־Claude (והתשובה, אם כבר ענית)
    cp: cpView(job.cp),                             // סבב 10: העתק־הדבק — בקשה שמחכה לתשובה שלך
    ck: lastCk(job.ck) ? { s: lastCk(job.ck).s, at: lastCk(job.ck).at || 0 } : null,   // v361: נקודת השמירה האחרונה
    stale: isStale(job, now),                       // v361: "רצה" בלי דיווח שעתיים — אפשר להמשיך
    fires: job.fires || 0,
    tw: job.tw && TW_LV.includes(job.tw.lv) ? job.tw : null,   // v362: מגדל הפיקוח
    rec: recoverAt(job, now),                       // v368: תקלה חולפת — ממשיכה לבד מהרגע הזה (0 = לא)
    eng: job.eng === 'api' || job.spec && job.spec.eng === 'api' ? 'api' : 'sub',   // מצב API: השרת של המערכת
    sid: job.eng === 'api' && SRV_ID_RE.test(String(job.sid || '')) ? job.sid : '',
    ry: job.spec && job.spec.ry === 1 ? 1 : 0, rc: job.spec && job.spec.ry === 1 ? (Number(job.rcl) || 0) : 0,   // 24/10/2026: "המנוי שלי" דרך השרת — מתי ה־Routine שלך התחבר (0 = עוד לא)
    urt: normRate(job.urt),                         // 25/10/2026: המשוב שלך (👍/👎, סיבות, כתוביות שסימנת)
    sw: job.state === 'new' && typeof job.sw === 'string' ? job.sw.slice(0, 40) : '',   // 25/10/2026: למה העבודה לא התחילה (קוד הסירוב האחרון)
    vw: job.vw && !job.pk ? 1 : 0,                   // 15/10/2026: מחכה לסרטון בתור — השרת פנוי בינתיים
    fr: job.fr && typeof job.fr.s === 'number' ? { s: job.fr.s, ms: Math.max(0, Math.round(job.fr.ms || 0)) } : null,   // v369: תוצאת ההפעלה האחרונה
    tr: normTrace(job.tr),                          // v373: עקיבה — פעולות לכל סוכן והקבוצות הנפוצות
    q: normQuality(job.q), ij: normInj(job.ij),     // v374: מדד האיכות ושומר ההזרקות
    jd: normJudge(job.jd),                          // v375: שופט האיכות
    rvf: normRvf(job.rvf), fil: normFil(job.fil),   // סבב 4: סימונים מהביקורת, מילות מילוי
    ep: ETA.normEp(job.ep),                         // 10/10/2026: צפי הזמנים של העבודה (נקבע בלקיחה)
    gl: normGl(job.gl),                             // v380: מונחים מהמילון שלך שימשו + מונחים חדשים להצעה
    nt: noteView(job),                              // v382: הערה לעובד — מחכה לנקודת השמירה הבאה / נקראה
    sla: SLA.slaView(job, now),                     // v377: יעד זמן ותקציב (השעון עוצר כשמחכים לך)
    gd: normGd(job.gd), gs: JOB_RE.test(String(job.gs || '')) ? job.gs : '', gq: normGq(job.gq), sm: job.sm ? 1 : 0,   // v387: סט הזהב — ייחוס, מקור ההרצה, הציון
    hl: normHl(job.hl, job.fv && job.fv.id),       // איכויות הצפייה (הראשונה = המקור עצמו)
    hla: normHl(job.hl, job.fv && job.fv.id) ? normHla(job.hla) : null,   // 22/10/2026: עותק הקול לנגן (הקול המקורי נשאר במקור)
    pbn: normPbn(job.pbn, job.pbn && job.pbn.at),   // 24/10/2026: הצריבה בטלפון (תרגום בטלפון)
    ppr: normPpr(job.ppr, job.ppr && job.ppr.at),   // 25/10/2026: מה הטלפון עושה לפני ההתחלה (שלב 2)
    vcp: job.spec && job.spec.vc === 1 ? normVcp(job.vcp, job.vcp && job.vcp.at) : null,   // 29/10/2026: הסרטון עולה לענן מ־Studio לאנדרואיד
    sx: job.sx > 0 ? job.sx : 0,                    // 26/10/2026: מתי סרטון המקור נמחק (0 = עוד שמור)
    rt: SC.retention(job, process.env.FIREBASE_PROJECT_ID || 'yishaiguedj1-c786e'),   // עד מתי המקור (s) ועד מתי העבודה (j)
  };
}
/* v387: סט הזהב (Agentic evaluation · golden dataset) — עבודה שהסתיימה + תרגום אנושי לייחוס (קובץ SRT בתיקיית העבודה ב־Drive).
   gd = הייחוס {r מזהה הקובץ, n גודל, at}; gs = עבודה שהיא הרצה חוזרת של עבודת זהב (המקור); gq = הציון מול הייחוס {s chrF, tm כיסוי זמן, n כתוביות, at}.
   הציון מחושב בטלפון (studionet.goldCompare — דטרמיניסטי, בלי AI). הרצה חוזרת = עבודות חדשות עם אותו מקור — רק בלחיצה, אחרי אומדן ואישור */
// הסקירה (10/10): עד MAX_ACTIVE (5) — כל הסט רץ ביחד, בלי לעקוף את מגבלת העבודות הפעילות (מבחן TED = 4 הרצאות)
const GOLD_MAX = 5, GOLD_REF_MAX = 2 * 1024 * 1024;
function normGd(o) {
  if (!o || typeof o !== 'object' || !FILE_ID_RE.test(String(o.r || ''))) return null;
  return { r: o.r, n: Number.isInteger(o.n) && o.n > 0 && o.n <= GOLD_REF_MAX ? o.n : 0, at: typeof o.at === 'number' ? o.at : 0 };
}
function normGq(o) {
  if (!o || typeof o !== 'object') return null;
  const p = (v) => (Number.isInteger(v) && v >= 0 && v <= 100 ? v : null);
  const sc = p(o.s), tm = p(o.tm), n = Number.isInteger(o.n) && o.n > 0 && o.n <= 1e5 ? o.n : null;
  return sc == null || tm == null || n == null ? null : { s: sc, tm, n, at: typeof o.at === 'number' ? o.at : 0 };
}
/* עבודות שבסט הזהב (שהסתיימו, עם ייחוס וקבצים) */
const goldSources = (jobs) => (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.kind === 'tr' && j.state === 'done' && normGd(j.gd) && (j.fa || j.fv) && !(j.sx > 0) && FILE_ID_RE.test(String(j.folder || '')));
/* הרצה חוזרת של עבודת זהב — עבודה חדשה עם אותו מקור (אותם קבצים ותיקייה), "חדשה" עד שמתחילים אותה */
/* ---------- מ2 (10/10/2026): עורך הכתוביות והפקה מחדש ----------
   הגרסה הערוכה = קובץ cues חדש (JSON, אותו פורמט של cues.final.json) + SRT בתיקיית העבודה; העבודה מחליפה אליהם את
   ה־cues/srt שבתוצרים, והקודמים נשמרים בהיסטוריה (vh, עד VH_MAX) — "חזרה לגרסה" בלי להעלות שוב.
   הפקה מחדש = עבודה חדשה (rr) מאותו מקור ובאותה תיקייה: הכתוביות הנוכחיות → צריבה (בלי Claude, בלי טוקנים) */
const VH_MAX = 20;
const CUES_MAX = 4 * 1024 * 1024;   // קובץ כתוביות ערוך (JSON / SRT) — שעתיים של כתוביות הן פחות מ־1MB
const RR_OUTS = ['compact', 'same', 'mkv', 'small'];
function cuesSwap(job, c, s, now) {
  const fo = Array.isArray(job.fo) ? job.fo.slice() : [];
  const old = { c: (fo.find((o) => o.k === 'cues') || {}).id || '', s: (fo.find((o) => o.k === 'srt') || {}).id || '', at: now };
  const put = (f, k) => { const i = fo.findIndex((o) => o.k === k); const row = { id: f.id, name: f.name, size: f.size, k }; if (i >= 0) fo[i] = row; else fo.push(row); };
  put(c, 'cues'); put(s, 'srt');
  const vh = (Array.isArray(job.vh) ? job.vh : []).concat(old.c ? [old] : []).slice(-VH_MAX);
  return { fo, vh, ev: (job.ev || 0) + 1 };
}
/* סבב 7: כותרת ולוגו בהפקה מחדש — **זהה ל־normOv בטלפון (studioedl.js) ול־norm_ov ב־rerender.py**.
   t = כותרת (עד OV_T_MAX תווים, בלי תווי בקרה / כיווניות / { } \ — נכנסת ל־ASS בלבד), ta = 0 כל הסרטון / 5 רק בהתחלה,
   lg = לוגו (data:image/png|jpeg|webp;base64, עד OV_LG_MAX — מוקטן בטלפון), lp = פינה (tl/tr/bl/br), ls = רוחב באחוזים (8–30, זוגי) */
const OV_T_MAX = 60, OV_LG_MAX = 65536, OV_POS = ['tl', 'tr', 'bl', 'br'];
const OV_BAD = /[\u0000-\u001f\u007f\u200e\u200f\u202a-\u202e\u2066-\u2069{}\\]/g;
const OV_LG_RE = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
function normOv(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  const t = typeof o.t === 'string' ? o.t.replace(OV_BAD, '').replace(/\s+/g, ' ').trim().slice(0, OV_T_MAX).trim() : '';
  if (t) { out.t = t; if (o.ta === 5) out.ta = 5; }
  if (typeof o.lg === 'string' && o.lg.length <= OV_LG_MAX && OV_LG_RE.test(o.lg)) {
    out.lg = o.lg;
    out.lp = OV_POS.includes(o.lp) ? o.lp : 'tr';
    const ls = Math.round(Number(o.ls) / 2) * 2;
    out.ls = Number.isFinite(ls) && ls >= 8 && ls <= 30 ? ls : 14;
  }
  return Object.keys(out).length ? out : null;
}
/* סבב 5: עיצוב הכתוביות (מ־26/10/2026 גם בטופס ובזמן העבודה, לא רק בהפקה מחדש) — **זהה ל־normSty בטלפון (studioplay.js) ול־norm_sty ב־translator/vt/sty.py** */
const STY_COLORS = ['w', 'y', 'c'];
function normSty(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  const k = Math.round(Number(o.k) / 10) * 10;
  if (Number.isFinite(k) && k >= 70 && k <= 150 && k !== 100) out.k = k;
  if (typeof o.c === 'string' && STY_COLORS.includes(o.c) && o.c !== 'w') out.c = o.c;
  if (o.bx === true || o.bx === 1) out.bx = 1;
  const y = Math.round(Number(o.y));
  if (Number.isFinite(y) && y > 0 && y <= 40) out.y = y;
  return Object.keys(out).length ? out : null;
}
function rrSpec(parent, body) {
  const out = uniq(Array.isArray(body && body.out) ? body.out : [], (k) => RR_OUTS.includes(k));
  const sp = parent.spec || {};
  return { name: sp.name || '', size: sp.size || 0, type: sp.type || '', dur: sp.dur || 0, from: sp.from || 'auto', to: sp.to || ['he'], mode: modeNow(sp.mode),
    out: out.length ? out : ['compact'], style: STYLES.includes(body && body.style) ? body.style : STYLES.includes(sp.style) ? sp.style : STYLES[0], terms: '',
    ...(edlPre(normEdl(sp.edl)) ? { edl0: edlPre(normEdl(sp.edl)) } : {}),                     // מ5: החיתוך שלפני התרגום (המקור → הכתוביות)
    ...(normEdl(body && body.edl, sp.dur) ? { edl: normEdl(body.edl, sp.dur) } : {}),   // מ5: חיתוך אחרי התרגום (על ציר הזמן של הכתוביות)
    ...(normSty(body && body.sty) ? { sty: normSty(body.sty) } : {}),                  // סבב 5: עיצוב הכתוביות
    ...(normOv(body && body.ov) ? { ov: normOv(body.ov) } : {}),                       // סבב 7: כותרת ולוגו
    ...(body && body.prv === true ? { prv: 1 } : {}),                                  // סבב 10: צריבה לבדיקה (קטע קצר) — נשמרת לצד ההפקה המלאה
    ...(sp.eng === 'api' ? { eng: 'api', cap: CAP_MIN_JOB } : {}) };   // באותו מנוע כמו המקור; במצב השרת — בלי טוקנים, התקרה המינימלית
}
function rrJob(parent, body, id, uid, now) {
  const fc = (Array.isArray(parent.fo) ? parent.fo : []).find((o) => o.k === 'cues');
  return { id, uid, kind: 'rr', state: 'new', created: now, updated: now, spec: rrSpec(parent, body), fv: parent.fv || null, fc: fc ? { id: fc.id, name: fc.name, size: fc.size } : null,
    folder: parent.folder, rp: parent.id };
}
/* מ7: גיליון ה־AI בהפעלה אחת — הבקשה (תור, JSON) כבר בתיקיית העבודה; המצב — ברירת המחדל (מ־15/10: Haiku High) */
const AI_Q_MAX = 512 * 1024;
function aiJob(parent, fq, mode, id, uid, now) {
  const sp = parent.spec || {};
  return { id, uid, kind: 'ai', state: 'new', created: now, updated: now, folder: parent.folder, rp: parent.id, fq,
    spec: { name: sp.name || '', size: sp.size || 0, type: '', dur: 0, from: sp.from || 'auto', to: sp.to || ['he'], mode: modeNow(mode || DEFAULT_MODE), out: [], style: STYLES[0], terms: '',
      ...(sp.eng === 'api' ? Object.assign({ eng: 'api', cap: CAP_MIN_JOB }, sp.ry === 1 ? { ry: 1 } : {}) : {}) } };   // 24/10/2026: ry — גם הבקשה מהגיליון במנוי שלך
}
/* 26/10/2026 (בקשת המשתמש): שמירה ב־Drive בלי שהסרטון עובר בטלפון — העובד בשרת מעתיק את התוצרים מ־R2 לתיקייה שבחרת
   ב"הסרטונים שלי" (לקוח ה־OAuth של הסטודיו, drive.file — רק תיקיות שהאפליקציה יצרה). it = עד DX_MAX קבצים מהתוצרים של
   העבודה, כל אחד עם השם שלו ב־Drive; f = התיקייה. רק תווים בטוחים בשם */
const DX_MAX = 6;
const dxName = (x) => String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f<>"\\/:*?|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
function normDx(o, outs) {
  if (!o || typeof o !== 'object' || !FILE_ID_RE.test(String(o.f || '')) || String(o.f).startsWith('R2_')) return null;
  const have = new Map((Array.isArray(outs) ? outs : []).filter((x) => x && FILE_ID_RE.test(String(x.id || ''))).map((x) => [String(x.id), x]));
  const it = [], seen = new Set();
  for (const x of Array.isArray(o.it) ? o.it.slice(0, DX_MAX) : []) {
    const id = String(x && x.id || ''), n = dxName(x && x.n);
    if (!have.has(id) || seen.has(id) || !n || !id.startsWith('R2_')) return null;
    seen.add(id); it.push({ id, n, s: Math.max(0, Math.floor(+have.get(id).size || 0)) });
  }
  return it.length ? { f: String(o.f), n: dxName(o.n).slice(0, 120), it } : null;
}
function dxJob(parent, dx, id, uid, now) {
  const sp = parent.spec || {};
  return { id, uid, kind: 'dx', state: 'new', created: now, updated: now, folder: parent.folder, rp: parent.id,
    spec: { name: sp.name || '', size: 0, type: '', dur: 0, from: sp.from || 'auto', to: sp.to || ['he'], mode: modeNow(sp.mode || DEFAULT_MODE), out: [], style: STYLES[0], terms: '',
      eng: 'api', cap: CAP_MIN_JOB, dx } };
}
/* פריט 15 (21/10/2026, "ריצת מבחן"): mode = מצב אחר מזה של המקור (השוואה בין מצבים על אותו סרטון); gr = קובץ הייחוס
   (באותה תיקייה) — העובד מחשב את הציון בעצמו בסוף (translator/goldscore.py), בלי שהטלפון פתוח */
/* 24/10/2026 (ניסוי המאמץ): מאמץ אחר לתפקיד אחד בהרצה של סט הזהב — main = ההגהה והתדריך, tl = התרגום, rv = הביקורת.
   = ROLE_EFFORT_KEYS / EFFORTS ב־translator/llm.py (norm_xe). רק מ־goldRun (מנהל) — לא מהטופס */
const XE_KEYS = ['main', 'tl', 'rv'], XE_EFFORTS = ['low', 'medium', 'high', 'max'];
function normXe(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return null;
  const o = {};
  for (const k of XE_KEYS) if (XE_EFFORTS.includes(x[k])) o[k] = x[k];
  return Object.keys(o).length ? o : null;
}
function goldClone(src, id, uid, now, mode, xe) {
  const out = Array.from(new Set((Array.isArray(src.spec && src.spec.out) ? src.spec.out : []).concat(['srt'])));   // ההשוואה צריכה SRT
  const gd = normGd(src.gd), spec = Object.assign({}, src.spec, { out }, mode ? { mode: modeNow(mode) } : {});
  // 24/10/2026: ההשוואה בין המצבים רצה על השרת של המערכת — בלי ה־Routine (ry) ובלי העתק־הדבק (cp), כך שכל ההרצות
  // באותם תנאים ולא תלויות בסשן של המשתמש; הניסוי (xe) רק כשנבחר
  delete spec.ry; delete spec.cp; delete spec.xe; delete spec.xg;
  const v = xe && (xe.xe || xe.xg) ? xe : { xe };   // וריאנט: { xe, xg } (או מאמץ לבד — הצורה הישנה)
  const x = normXe(v.xe);
  if (x) spec.xe = x;
  if (v.xg === 1) spec.xg = 1;   // 24/10/2026: ניסוי "בלי מילון מונחים" — העובד כותב glossary.tsv בלי מונחים
  return { id, uid, kind: 'tr', state: 'new', created: now, updated: now, spec, fa: src.fa || null, fv: src.fv || null, folder: src.folder, gs: src.id, gr: gd ? gd.r : '' };
}
/* פריט 13 (21/10/2026): עבודת בדיקה אחרי עדכון של העובד — הדקה הראשונה של עבודת הזהב, רק SRT, במצב ברירת המחדל.
   sm = 1: לא בסט הזהב, לא במדדים (gs — כמו הרצה של סט הזהב), בלי ציון (בלי gr). רק עבודת זהב של השרת (eng api) ובלי חיתוך משלה */
const SMOKE_S = 60;
function smokeJob(src, id, uid, now) {
  const sp = src && src.spec;
  if (!sp || sp.eng !== 'api' || sp.edl || !(sp.dur > SMOKE_S + 5)) return null;
  const c = goldClone(src, id, uid, now, DEFAULT_MODE);
  c.spec = Object.assign({}, c.spec, { out: ['srt'], dur: SMOKE_S, edl: { k: [[0, SMOKE_S]], ar: 'src', x: 0.5 } });
  return Object.assign(c, { gr: '', sm: 1 });
}
/* v373: עקיבה מהעובד (מהיומנים, בלי טוקנים): לכל סוכן n פעולות, e שנכשלו, s שניות; וקבוצות [מפתח, n, e].
   רק מספרים ומפתחות בצורה קבועה (שם כלי, או job:/vt: + פקודה) — בלי טקסט חופשי. לא תקין — נזרק כולו */
const TR_KEY_RE = /^(?:(?:job|vt):[a-z][a-z_-]{1,19}|[A-Za-z]{1,24})$/;
function normTrace(t) {
  if (!t || typeof t !== 'object' || !t.a || typeof t.a !== 'object') return null;
  const int = (v, hi) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= hi ? v : null);
  const a = {};
  for (const [k, v] of Object.entries(t.a)) {
    if (!USE_KINDS.includes(k) || !v || typeof v !== 'object') return null;
    const n = int(v.n, 1e6), e = int(v.e, 1e6), sec = int(v.s, 1e7);
    if (n == null || e == null || sec == null || e > n) return null;
    a[k] = { n, e, s: sec };
    if (v.w != null) { const w = int(v.w, 1e6); if (w == null || w > n) return null; a[k].w = w; }   // v386: פעולות מחוץ לתפקיד (אופציונלי — עקיבה ישנה בלי)
  }
  if (!Object.keys(a).length) return null;
  const g = [];
  for (const x of (Array.isArray(t.g) ? t.g : []).slice(0, 8)) {
    if (!Array.isArray(x) || !TR_KEY_RE.test(String(x[0] || ''))) return null;
    const n = int(x[1], 1e6), e = int(x[2], 1e6);
    if (n == null || e == null || e > n) return null;
    g.push([x[0], n, e]);
  }
  return { a, g };
}
/* v374: מדד האיכות של הכתוביות (מהעובד, בלי טוקנים): s = 0–100, n כתוביות, m = מדדים קבועים {k, w משקל, g נקודות, b כתוביות שנכשלו} */
const Q_KEYS = ['cps', 'len', 'lines', 'dur', 'en', 'chk'];
function normQuality(q) {
  if (!q || typeof q !== 'object' || !Array.isArray(q.m)) return null;
  const int = (v, hi) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= hi ? v : null);
  const s = int(q.s, 100), n = int(q.n, 1e6);
  if (s == null || n == null || !n || q.m.length !== Q_KEYS.length) return null;
  const m = [];
  for (const x of q.m) {
    if (!x || !Q_KEYS.includes(x.k) || m.some((y) => y.k === x.k)) return null;
    const w = int(x.w, 100), g = int(x.g, 100), b = int(x.b, 1e6);
    if (w == null || g == null || b == null || g > w) return null;
    m.push({ k: x.k, w, g, b });
  }
  if (m.reduce((t, x) => t + x.g, 0) !== s) return null;
  return { s, n, m };
}
/* v374: שומר ההזרקות — כמה שורות סומנו ובאילו סוגים (קודים קבועים, בלי טקסט) */
const INJ_CODES = ['ign', 'role', 'tag', 'cmd', 'key'];
function normInj(o) {
  if (!o || typeof o !== 'object' || !Number.isInteger(o.n) || o.n < 1 || o.n > 1e5) return null;
  const c = (Array.isArray(o.c) ? o.c : []).filter((x) => INJ_CODES.includes(x));
  return { n: o.n, c: Array.from(new Set(c)) };
}
/* v375: שופט האיכות (Haiku, על מדגם): s = 0–100, n כתוביות שנשפטו מתוך t במדגם, a בעבודה, c = כמה מכל סוג בעיה (קודים קבועים) */
const JG_CODES = ['mean', 'omit', 'add', 'gram', 'flu', 'term'];
const JG_F_MAX = 40;   // **זהה ל־JG_F_MAX בעובד (job.py) ובטלפון**
/* סבב 4: סימונים מהביקורת — [[מספר כתובית, קוד]] (g מגדר, s מי מדבר, t מונח). **RVF_MAX/RVF_CODES זהים בעובד ובטלפון**.
   רק מספרים וקודים מהקטלוג, ממוינים ובלי כפולים — לא תקין נזרק כולו */
const RVF_CODES = ['g', 's', 't'];
const RVF_MAX = 40;
function normRvf(o) {
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
/* סבב 4: מילות מילוי מהתמלול — [[התחלה, סוף]] בשניות, ממוין ובלי חפיפות, כל אחת 0.15–2 שנ׳. **FIL_MAX זהה בעובד** */
const FIL_MAX = 300;
function normFil(o) {
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
function normJudge(o) {
  if (!o || typeof o !== 'object') return null;
  const int = (v, lo, hi) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  const s = int(o.s, 0, 100), n = int(o.n, 1, 200), t = int(o.t, 1, 200), a = int(o.a, 1, 1e6);
  if (s == null || n == null || t == null || a == null || n > t || t > a) return null;
  const c = {};
  for (const [k, v] of Object.entries(o.c && typeof o.c === 'object' ? o.c : {})) {
    const x = int(v, 1, 200);
    if (!JG_CODES.includes(k) || x == null) return null;
    c[k] = x;
  }
  const bad = Object.values(c).reduce((x, y) => x + y, 0);
  if (bad > n) return null;
  // סבב 2: מספרי הכתוביות שהשופט סימן (מזהי vt) — רק מספרים, ממוינים, בלי כפולים, לכל היותר כמו הבעיות שנספרו
  let f;
  if (o.f != null) {
    if (!Array.isArray(o.f) || o.f.length > Math.min(JG_F_MAX, bad)) return null;
    f = [];
    for (const x of o.f) { if (int(x, 1, 1e6) == null || (f.length && x <= f[f.length - 1])) return null; f.push(x); }
  }
  return f && f.length ? { s, n, t, a, c, f } : { s, n, t, a, c };
}
/* v380: זיכרון המונחים — u = כמה מונחים מהמילון שלך שימשו, s = עד 30 מונחים חדשים מהעבודה [[אנגלית, עברית]].
   הטקסט נכתב בסשן שמעבד תוכן לא מהימן — רק אחרי ניקוי (glClean, זהה לעובד ולטלפון), ובטלפון רק כטקסט ורק באישורך */
const GL_SUG = 30;
const glClean = (v, n) => { const s = String(v == null ? '' : v).replace(/[\x00-\x1f\x7f<>`]/g, ' ').replace(/\s+/g, ' ').trim(); return s.includes('://') ? '' : s.slice(0, n); };
function normGl(o) {
  if (!o || typeof o !== 'object') return null;
  const u = Number.isInteger(o.u) && o.u >= 0 && o.u <= 400 ? o.u : 0;
  const s = [], seen = new Set();
  for (const x of (Array.isArray(o.s) ? o.s : []).slice(0, GL_SUG)) {
    if (!Array.isArray(x)) continue;
    const en = glClean(x[0], 60), he = glClean(x[1], 80);
    if (!en || !he || seen.has(en.toLowerCase())) continue;
    seen.add(en.toLowerCase());
    s.push([en, he]);
  }
  return u || s.length ? { u, s } : null;
}
/* 11/10/2026: המילון עצמו ב־R2 (כשמוגדר) — gl/<uid>.tsv, מחוץ ל־st/ (שם — רק קבצי עבודות; הסריקה לא רואה בו "יתום").
   glParse/glFormat — אותו קוד של הטלפון (studionet.js) ושל gl_parse בעובד; tests/studio-gloss-r2 משווה */
const GL_MAX = 400;
const GL_HEAD = '# מילון המונחים של סטודיו התרגום — אנגלית<TAB>עברית (חלופות מופרדות ב־/)<TAB>הערה. כל עבודה מקבלת רק את המונחים שמופיעים בסרטון.\n';
const glKey = (uid) => (/^[A-Za-z0-9]{6,128}$/.test(String(uid || '')) ? 'gl/' + uid + '.tsv' : '');
function glParse(text) {
  const rows = [], seen = new Set();
  for (const line of String(text || '').split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    const c = line.split('\t');
    if (c.length < 2) continue;
    const en = glClean(c[0], 60), he = glClean(c[1], 80), n = c.length > 2 ? glClean(c[2], 100) : '';
    if (!en || !he || seen.has(en.toLowerCase())) continue;
    seen.add(en.toLowerCase());
    rows.push([en, he, n]);
    if (rows.length >= GL_MAX) break;
  }
  return rows;
}
const glFormat = (rows) => GL_HEAD + rows.map((r) => r[0] + '\t' + r[1] + (r[2] ? '\t' + r[2] : '')).join('\n') + (rows.length ? '\n' : '');
/* 28/10/2026: זיכרון סדרה (ניתוח 5 פרקים מול כתוביות אנושיות: אותו שם בשלושה כתיבים בין פרקים, מגדר דמות שנקבע מחדש
   בכל פרק). קובץ אחד לכל משתמש ב־R2 (sm/<uid>.json) — לכל סדרה (מפתח משם הקובץ: מה שלפני S01E02 / 1x02) השמות והמונחים
   שנקבעו בפרקים הקודמים, והדמויות עם המגדר. בלקיחה העובד מקבל רק את הסדרה של העבודה; בסוף העבודה (smPut) — מה שנקבע בה.
   הראשון שנקבע גובר (עקביות); המילון שלך גובר על הכל (בעובד). normSm זהה ל־sm_valid בעובד — tests/studio-series משווה */
const SM_SER = 60, SM_GL = 150, SM_CH = 40, SM_BYTES = 512 * 1024;
const smKey = (uid) => (/^[A-Za-z0-9]{6,128}$/.test(String(uid || '')) ? 'sm/' + uid + '.json' : '');
const SER_RE = /^(.*?)[\s\-–_.([]*(?:s(\d{1,2})[\s._-]*e(\d{1,3})|(\d{1,2})x(\d{2,3}))(?![\p{L}\p{N}])/iu;
function seriesOf(name) {
  const base = String(name || '').replace(/\.[A-Za-z0-9]{2,4}$/, '').replace(/[._]+/g, ' ');
  const m = base.match(SER_RE);
  if (!m) return null;
  const n = m[1].replace(/[\s\-–]*(?:season|עונה)\s*\d{1,2}[\s\-–]*$/iu, ' ').replace(/\(\s*(19|20)\d\d\s*\)|\b(19|20)\d\d\s*$/g, ' ').replace(/[\s\-–[(]+$/, '').replace(/\s+/g, ' ').trim();
  const k = n.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  return k.length >= 2 ? { k: k.slice(0, 60), n: glClean(n, 60), e: +(m[3] || m[5]) || 0 } : null;
}
function smRows(v, max, cell) {
  const out = [], seen = new Set();
  for (const r of Array.isArray(v) ? v.slice(0, max * 2) : []) {
    const x = Array.isArray(r) ? cell(r) : null;
    if (!x || seen.has(x[0].toLowerCase())) continue;
    seen.add(x[0].toLowerCase());
    out.push(x);
    if (out.length >= max) break;
  }
  return out;
}
const smGl = (v) => smRows(v, SM_GL, (r) => { const en = glClean(r[0], 60), he = glClean(r[1], 80); return en && he ? [en, he] : null; });
const smCh = (v) => smRows(v, SM_CH, (r) => { const nm = glClean(r[0], 40), g = r[1] === 'm' || r[1] === 'f' ? r[1] : ''; return nm && g ? [nm, g, glClean(r[2], 60)] : null; });
/* מה שהעובד שלח (smPut) / הסדרה מהקובץ → {gl, ch} נקי */
function normSm(v) {
  const o = v && typeof v === 'object' ? v : {};
  return { gl: smGl(o.gl), ch: smCh(o.ch) };
}
/* הקובץ → {v, s: {k: {n, at, ep, gl, ch}}} — מה שלא תקין נזרק */
function smParse(text) {
  let j = null;
  try { j = JSON.parse(String(text || '')); } catch (e) { j = null; }
  const s = {};
  for (const [k, x] of Object.entries(j && j.s && typeof j.s === 'object' ? j.s : {}).slice(0, SM_SER)) {
    if (!/^[\p{L}\p{N} ]{2,60}$/u.test(k) || !x || typeof x !== 'object') continue;
    s[k] = Object.assign({ n: glClean(x.n, 60), at: Math.max(0, +x.at || 0), ep: Math.max(0, Math.floor(+x.ep || 0)) }, normSm(x));
  }
  return { v: 1, s };
}
/* מיזוג: שורה קיימת נשארת (הראשון גובר), חדשה נוספת; דמות בלי מגדר קודם — מקבלת. הסדרות הישנות ביותר יוצאות מעל SM_SER */
function smMerge(doc, ser, add, now) {
  const d = smParse(JSON.stringify(doc || {}));
  const cur = d.s[ser.k] || { n: ser.n, at: 0, ep: 0, gl: [], ch: [] };
  const a = normSm(add);
  const have = new Set(cur.gl.map((r) => r[0].toLowerCase())), chave = new Set(cur.ch.map((r) => r[0].toLowerCase()));
  const next = { n: cur.n || ser.n, at: now, ep: cur.ep + 1,
    gl: cur.gl.concat(a.gl.filter((r) => !have.has(r[0].toLowerCase()))).slice(0, SM_GL),
    ch: cur.ch.concat(a.ch.filter((r) => !chave.has(r[0].toLowerCase()))).slice(0, SM_CH) };
  d.s[ser.k] = next;
  const keys = Object.keys(d.s).sort((x, y) => d.s[y].at - d.s[x].at);
  for (const k of keys.slice(SM_SER)) delete d.s[k];
  return d;
}
/* לעובד: הסדרה של העבודה (או null) */
function smForWorker(doc, ser) {
  const x = ser && doc && doc.s && doc.s[ser.k];
  return x && (x.gl.length || x.ch.length) ? { n: x.n, ep: x.ep, gl: x.gl, ch: x.ch } : null;
}
const jobSeries = (job) => seriesOf((job.fv && job.fv.name) || (job.fa && job.fa.name) || (job.fsu && job.fsu.name) || '');
/* 28/10/2026: ניסוי "טיוטה אחת" (ניתוח 7 פרקים: ההכרעה בין שתי הטיוטות של Haiku לא עדיפה על מקרה מול התרגום האנושי,
   והן ~30–35% מעלות הפרק). 28/10/2026 (ערב, ניתוח פרקים 16–20 — 10 פרקים מול האדם, החלטת המשתמש): הניסוי הסתיים —
   טיוטה אחת לכל עבודה (xd = 1; בלי הטיוטה השנייה B ובלי ההכרעה). ~45% פחות בעלות התרגום ב־high, 30–100 שנ׳ פחות.
   xd נשאר בעבודה ובמאגר — כך ההשוואה לפני/אחרי ממשיכה. DUAL_AB_UNTIL — רק לבדיקות ולתיעוד */
const DUAL_AB_UNTIL = Date.UTC(2026, 9, 28, 18);
function dualAb(job, now) {   // eslint-disable-line no-unused-vars
  return 1;
}
/* 28/10/2026 (ניתוח פרקים 16–20, החלטת המשתמש): ניסוי "ביקורת ב־medium גם במצב high" — הביקורת ב־high חושבת ~145K
   טוקנים בשביל ~1.2K של תשובה (99%), ‎$0.08 לפרק מול ‎$0.024–0.029 ב־medium, ומול האדם לא נראה הבדל (high ‏+29/‎−17,
   medium ‏+16/‎−5). חצי מהעבודות (xr = 1): פרק של סדרה שמספרו 0 או 1 מודולו 4 — מוצלב עם medium (אי־זוגי) / high (זוגי)
   של המשתמש: בפרקי high (זוגיים) חצי עם וחצי בלי; לא סדרה — לפי זוגיות המזהה. העובד מוריד רק מ־high/max, לא מעלה.
   נקבע פעם אחת בלקיחה הראשונה. המסקנה: ציון השופט, ההתאמה לתרגום האנושי והעלות — ב־high בלבד */
const RV_AB_UNTIL = Date.UTC(2026, 10, 30);
function rvAb(job, now) {
  if (!(now < RV_AB_UNTIL)) return 0;
  const s = jobSeries(job);
  if (s && s.e > 0) return s.e % 4 === 0 || s.e % 4 === 1 ? 1 : 0;
  const id = String((job && job.id) || '');
  return id ? id.charCodeAt(id.length - 1) % 2 : 0;
}
/* v382: הערה לעובד (Pause + corrective input) — טקסט שלך מהטלפון לעבודה שרצה. נמסרת לעובד בתשובה לדיווח הבא על
   נקודת שמירה (nt → nh עם d = מתי נקראה). עד NOTE_MAX לעבודה, NOTE_LEN תווים; בלי תווי בקרה, תגיות וגרשיים הפוכים */
const NOTE_MAX = 5, NOTE_LEN = 300;
function normNoteText(v) {
  const s = String(v == null ? '' : v).replace(/[\x00-\x09\x0b-\x1f\x7f<>`]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  return s.length >= 2 ? s.slice(0, NOTE_LEN) : '';
}
function noteView(job) {
  const p = job.nt && normNoteText(job.nt.t) ? { t: normNoteText(job.nt.t), at: job.nt.at || 0 } : null;
  const h = (Array.isArray(job.nh) ? job.nh : []).filter((x) => x && normNoteText(x.t)).slice(-NOTE_MAX).map((x) => ({ t: normNoteText(x.t), at: x.at || 0, d: x.d || 0 }));
  return p || h.length ? { p, h, n: job.nn || h.length + (p ? 1 : 0), max: NOTE_MAX } : null;
}
/* v373: גרסת ההנחיות של כל סוכן (8 תווים מ־sha1): rb = RUNBOOK (מנהל העבודה), tl = TRANSLATE, rv = REVIEW, jg = JUDGE (v375) */
function normPv(p) {
  if (!p || typeof p !== 'object') return null;
  const out = {};
  for (const k of ['rb', 'tl', 'rv', 'jg']) if (/^[0-9a-f]{8}$/.test(String(p[k] || ''))) out[k] = p[k];
  return Object.keys(out).length ? out : null;
}
/* מה העובד מקבל: מה להוריד ולאן להעלות — שום דבר מעבר לעבודה הזו */
/* סבב 10: העתק־הדבק לעבודה מלאה — כל בקשה ל־Claude = קובץ בתיקיית העבודה (העובד מעלה), התשובה = קובץ שהטלפון מעלה.
   job.cp = { n (מספר רץ), r (תפקיד), f (הבקשה), fs, at, a (התשובה), as, ad }. רק מספרים ומזהי קבצים — בלי טקסט ברשומה */
const CP_ROLES = ['main', 'tl', 'rv', 'jg'];
const CP_N_MAX = 200, CP_FILE_MAX = 2 * 1024 * 1024;
function normCpq(x) {
  if (!x || typeof x !== 'object') return null;
  const n = Number(x.n);
  if (!Number.isInteger(n) || n < 1 || n > CP_N_MAX || !CP_ROLES.includes(x.r) || !FILE_ID_RE.test(String(x.id || ''))) return null;
  return { n, r: x.r, id: x.id };
}
const cpView = (cp) => (cp && cp.n ? { n: cp.n, r: cp.r, f: cp.f, at: cp.at || 0, a: !!cp.a } : null);
const cpWorker = (cp) => (cp && cp.n ? { n: cp.n, a: cp.a || '', as: cp.as || 0 } : null);
/* 26/10/2026: מקור שנבחר ברשימת הקבצים של Studio (gbrowse, drive.readonly) — רק כשהעובד הוא השרת שלנו (מצב השרת,
   גם העתק־הדבק והמנוי דרך השרת). Routine מריץ Claude עם כלים על תוכן לא מהימן — הגישה הרחבה לא מגיעה אליו */
const bxOk = (job) => !!(job && ['tr', 'rr', 'ai'].includes(job.kind) && job.spec && job.spec.eng === 'api' && job.spec.ph !== 1);
function workerJob(job, nm, fb, fm, rl, gl) {
  return { nm: nm || null,   // v363: "הרגיל" של המשתמש למצב הזה (או null — המגדל משתמש במדידות שלנו)
    gl: Array.isArray(gl) ? gl : null,   // 11/10: המילון מ־R2 (null = אין שם — העובד קורא מ־Drive כמו קודם)
    rl: normRules(rl),       // v367: החוקים שלך — תקציב ואישור לפני צריבה
    bx: job.bx || 0,         // v367: כמה פעמים אישרת להמשיך מעבר לתקציב (התקציב גדל בכל פעם)
    u0: usdOf(job.use0),     // v367: מה שהסשנים הקודמים כבר עלו
    fm: normFixMode(fm),     // v366: מסלול התיקונים — העובד אומר ל־Claude אם התיקון נשמר או מחכה לאישור
    fb: fb || [],            // v364: ספר התיקונים — תקלות מוכרות עם התיקון שלהן
    ls: job.ls && FP_RE.test(String(job.ls.fp || '')) ? job.ls : null,   // v364: העצירה שלפני ההמשך (לאבחון)
    cap: job.eng === 'api' && job.capc > 0 ? job.capc / 100 : null,   // מצב API: תקרת העבודה ($; נשמרת בסנטים) — כבר אחרי התקציב החודשי שנשאר
    id: job.id, kind: job.kind, state: job.state, spec: job.spec || null, folder: job.folder || '', files: { a: fileView(job.fa), v: fileView(job.fv), s: fileView(job.fsu), r: fileView(job.fsr), c: fileView(job.fc), q: fileView(job.fq), m: fileView(job.fph), w: fileView(job.fpw) },
    qa: job.qa && job.qa.id ? { id: job.qa.id, q: job.qa.q, a: job.qa.a || null, g: job.qa.g || '' } : null,   // v361: גם השאלה — להמשך בסשן חדש
    ck: Array.isArray(job.ck) ? job.ck.map((c) => ({ s: c.s, id: c.id, size: c.size })) : [],   // v361: להמשך (מהאחרונה)
    sh: job.sh && job.sh.n > 0 ? { n: job.sh.n, old: job.sh.old || null } : null,   // v384: מצב צל — המגדל אוכף את הספים הישנים
    notes: (Array.isArray(job.nh) ? job.nh : []).map((x) => normNoteText(x && x.t)).filter(Boolean).slice(-NOTE_MAX),
    gref: job.gs && FILE_ID_RE.test(String(job.gr || '')) ? job.gr : null,   // פריט 15: הייחוס של סט הזהב — העובד מחשב את הציון
    cp: cpWorker(job.cp) };   // סבב 10: העתק־הדבק   // v382: ההערות שכבר נקראו — להמשך בסשן חדש
}
/* 21/10/2026: כמה זמן (ms) כבר הושקע בשלב בסשנים קודמים — הצבור (a) ועוד הקטע שנסגר */
function stgSpent(x) { return !x ? 0 : Math.max(0, (+x.a || 0) + (x.e > 0 && x.s > 0 ? x.e - x.s : 0)); }
/* 21/10/2026: המתנה לסרטון מהטלפון (wv0 → עכשיו) לא נספרת בשלב שבו חיכינו — כמו בשעון של יעד הזמן (pz).
   השלב פשוט "התחיל מאוחר יותר" בזמן ההמתנה; שלב שכבר נסגר — לא לפני הסגירה */
function excludeWait(prog, st, from, to) {
  const x = prog && prog.stg && prog.stg[st];
  if (!x || !(x.s > 0) || !(from > 0) || !(to > from) || x.s > from) return prog;
  const s = Math.min(x.s + (to - from), x.e > 0 ? x.e : to);
  return Object.assign({}, prog, { stg: Object.assign({}, prog.stg, { [st]: Object.assign({}, x, { s }) }) });
}
/* 21/10/2026: "המשך" — השלב שנעצר בו נפתח מיד (מהרגע הזה, עם הזמן שכבר הושקע). עד היום הוא נשאר סגור עד הדיווח
   הראשון של העובד, והטלפון הראה אותו ✓ ("הסתיים") בזמן שהעבודה מורידה את הנקודה ומתחילה אותו שוב */
function resumeProg(prog, now) {
  if (!prog || !prog.st || !prog.stg || !prog.stg[prog.st] || !(prog.stg[prog.st].e > 0)) return null;
  return Object.assign({}, prog, { stg: Object.assign({}, prog.stg, { [prog.st]: { s: now, e: 0, a: stgSpent(prog.stg[prog.st]) } }) });
}
/* דיווח מהעובד → התקדמות חדשה. כל שלב מקבל זמן התחלה וסיום אמיתיים (המסך מציג "✓ 8 דק׳") */
function applyReport(job, r, now) {
  const prog = Object.assign({ st: '', p: 0, stg: {} }, job.prog || {});
  prog.stg = Object.assign({}, prog.stg);
  const closeCur = () => { if (prog.st && prog.stg[prog.st] && !prog.stg[prog.st].e) prog.stg[prog.st] = Object.assign({}, prog.stg[prog.st], { e: now }); };
  // 28/10/2026: אחרי rd (התוצרים כבר אצלך) העובד משלים ברקע איכויות צפייה ולמידה — השלב והאחוז לא זזים, רק ההודעה
  if (job.rdy && r.done !== true && r.fail !== true) {
    if (r.msg != null) prog.msg = clean(r.msg, 240);
    prog.at = now;
    return { prog, updated: now };
  }
  const st = STAGES.includes(r.st) ? r.st : '';
  if (st && st !== prog.st) {
    closeCur();
    prog.stg[st] = { s: now, e: 0, a: stgSpent(prog.stg[st]) };
    // 21/10/2026: "המשך" מנקודת שמירה מוקדמת — העבודה חזרה לשלב קודם, ומה שאחריו ייעשה שוב. בלי זה "מתאימים כל
    // משפט" נשאר ✓ (נסגר בכשל) בזמן ש"כותבים כל מילה" רץ מחדש. הזמן שכבר הושקע בהם נשמר (a) — סכום השלבים = הזמן שעבר
    for (const k of STAGES.slice(STAGES.indexOf(st) + 1)) if (prog.stg[k]) prog.stg[k] = { s: 0, e: 0, a: stgSpent(prog.stg[k]) };
    prog.st = st; prog.p = 0; delete prog.eta;
  }
  // v361: אחרי "המשך" — השלב שבו העבודה נעצרה נפתח שוב (נסגר כשהיא נכשלה). 21/10/2026: מהרגע הזה, והזמן הקודם נצבר
  // (עד היום s נשאר הישן, והזמן שבין הכשל ל"המשך" נספר כעבודה בשלב)
  else if (st && prog.stg[st] && prog.stg[st].e && r.done !== true && r.fail !== true) prog.stg[st] = { s: now, e: 0, a: stgSpent(prog.stg[st]) };
  if (r.p != null && Number.isFinite(+r.p)) prog.p = Math.max(0, Math.min(1, +r.p));
  if (r.msg != null) prog.msg = clean(r.msg, 240);
  if (r.ex != null) prog.ex = clean(r.ex, 240);
  if (r.eta != null && Number.isFinite(+r.eta)) prog.eta = Math.max(0, Math.min(48 * 3600, Math.round(+r.eta)));   // שניות שנשארו לשלב (העובד יודע הכי טוב)
  if (r.checks && typeof r.checks === 'object') prog.ck = { drive: r.checks.drive === true, server: true };
  // 28/10/2026 (ניתוח הזמנים): התוצרים עלו והעובד רק משלים ברקע (איכויות צפייה, מאגר הלמידה — ~5 דק׳ בפרק של 22 דק׳).
  // r = מתי הם הגיעו אליך: הטלפון מציג "מוכן" מכאן, והצפי לומד את השמירה עד כאן (לא את הרקע)
  const sv = prog.stg.sv;
  if (r.done !== true && r.fail !== true && prog.st === 'sv' && sv && sv.s > 0 && !(sv.r > 0) && +r.p >= 1 && Array.isArray(r.out) && r.out.length) {
    prog.stg.sv = Object.assign({}, sv, { r: now });
  }
  prog.at = now;
  const out = { prog, updated: now };
  if (r.rd === true && r.done !== true && r.fail !== true && !job.rdy) { closeCur(); prog.p = 1; out.rdy = now; out.ended = now; }   // 28/10/2026: התוצרים מוכנים — בטלפון העבודה "הסתיימה" (publicJob), והעובד משלים ברקע
  if (r.done === true) { closeCur(); prog.p = 1; out.state = 'done'; if (!job.rdy) out.ended = now; }
  else if (r.fail === true) { closeCur(); out.state = 'failed'; out.err = ERR_RE.test(String(r.err || '')) ? r.err : 'worker'; out.ended = now; }
  return out;
}

/* ---------- מצב "API של המערכת": השרת שלנו (Hetzner) ---------- */
/* השרת לא מקבל חיבורים — הוא שואל (poll) ומדווח דופק (beat). מזוהה בטוקן שרת: "<מזהה 12>-<סוד 43>". נשמר רק ה־hash */
const SRV_ID_RE = /^[a-z0-9]{12}$/;
const SRV_TOKEN_RE = /^([a-z0-9]{12})-([A-Za-z0-9_-]{43})$/;
const SRV_MAX = 5;                          // שרתים רשומים
const SRV_ONLINE_MS = 12 * 60e3;            // שואל כל 20 שנ׳; באמצע עבודה — דופק כל 5 דק׳
const PARK_MAX = 12 * 3600e3;               // 15/10/2026: עבודה שחזרה לתור עד שהסרטון יגיע — עד 12 שעות (כמו upload_timeout בעובד)
const API_QUEUE_WAIT = 6 * 3600e3;          // עבודה בתור בלי שאף שרת לקח אותה — "אין שרת זמין"
const CAP_DEF = 10, CAP_MAX = 100, CAP_MIN_JOB = 1;
const normCap = (c) => Math.max(CAP_MIN_JOB, Math.min(CAP_MAX, Math.round(Number(c) || CAP_DEF)));
const newServerId = () => crypto.randomBytes(8).toString('hex').slice(0, 12);
// הסוד — אותיות קטנות וספרות בלבד (172 ביט): בקונסולה של Hetzner מהטלפון תווים עם Shift (כמו _) מגיעים משובשים,
// וטוקן עם _ אי אפשר להדביק (לקח 09/10/2026). הצורה נשארת זו של SRV_TOKEN_RE — טוקנים ישנים ממשיכים לעבוד.
const newServerToken = (sid) => sid + '-' + crypto.randomBytes(22).toString('hex').slice(0, 43);
function parseServerToken(t) {
  const m = SRV_TOKEN_RE.exec(String(t || ''));
  return m ? { sid: m[1], tok: m[0] } : null;
}
function serverMatches(srv, tok) {
  // 10/10/2026: בין v384 לתיקון 'th' היה ב־JSON_FIELDS — שרת שנוצר אז נשמר עם th בגרשיים (JSON). מקבלים את שתי הצורות.
  let th = String((srv && srv.th) || '');
  if (/^"[0-9a-f]{64}"$/.test(th)) th = th.slice(1, -1);
  if (!srv || !/^[0-9a-f]{64}$/.test(th)) return false;
  const a = Buffer.from(keyHash(tok), 'hex'), b = Buffer.from(th, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/* הדופק מהשרת — רק מספרים וגרסה; כל השאר נזרק */
function normHb(h) {
  h = h && typeof h === 'object' ? h : {};
  const n = (x, lo, hi) => (Number.isFinite(+x) ? Math.max(lo, Math.min(hi, Math.round(+x * 10) / 10)) : null);
  return { v: /^[0-9a-f]{7,40}$|^dev$/.test(String(h.v || '')) ? String(h.v).slice(0, 12) : '',
    disk: n(h.disk, 0, 100), free: n(h.free, 0, 1e5), mem: n(h.mem, 0, 100), load: n(h.load, 0, 512), up: n(h.up, 0, 1e9),
    busy: JOB_RE.test(String(h.busy || '')) ? h.busy : '',
    st: /^[a-z0-9_-]{1,24}$/.test(String(h.st || '')) ? h.st : '', p: n(h.p, 0, 1),   // 15/10/2026: השלב הנוכחי של העבודה (הדופק)
    // ת2: בידוד הקופסה — g = gVisor, r = רגיל (runc) + הסיבה מקטלוג קבוע
    iso: h.iso === 'g' || h.iso === 'r' ? h.iso : '', iw: h.iso === 'r' && ['mem', 'missing', 'selftest', 'manual'].includes(h.iw) ? h.iw : '',
    al: h.al === 'o' || h.al === 't' ? h.al : '',   // שלב 4.1: מנוע היישור (o = ONNX INT8)
    // 21/10/2026: ליבות מותרות (לצפי — מנרמל זמנים בין שרתים), עבודות שרצות עכשיו ותקרת הזיכרון של הקונטיינר (MB)
    cpu: n(h.cpu, 0, 512), nj: n(h.nj, 0, 16), mx: n(h.mx, 0, 4e6),
    // 22/10/2026 (ניטור): מעבד בפועל %, קצב רשת (בייטים לשנייה), לחץ זיכרון %
    cu: n(h.cu, 0, 100), rx: n(h.rx, 0, 1e12), tx: n(h.tx, 0, 1e12), psi: n(h.psi, 0, 100),
    dl: h.dl === 1 ? 1 : 0,   // 26/10/2026: פחות מ־8GB פנויים — העובד לא לוקח עבודה חדשה (translator/agent.py — disk_low)
    ev: normEv(h.ev) };   // ת7: יומן השרת — האירועים האחרונים (קודים מקטלוג קבוע + זמן)
}
/* 21/10/2026: כמה עבודות במקביל בשרת אחד — הסוכן שולח כמה זיכרון פנוי לעוד עבודה (mb) ואת המודל שלו לשיא של כל סוג
   (הוא מודד ולומד את השיא האמיתי; translator/agent.py — mem_fit). מספרים בלבד, בגבולות סבירים */
function normFit(f) {
  if (!f || typeof f !== 'object') return null;
  const n = (x, lo, hi) => (Number.isFinite(+x) && +x >= lo && +x <= hi ? +x : null);
  const o = { mb: n(f.mb, 0, 4e6), a: n(f.a, 100, 1e5), b: n(f.b, 0, 1e4), ra: n(f.ra, 100, 1e5), rb: n(f.rb, 0, 1e4), ai: n(f.ai, 50, 1e5) };
  return Object.values(o).every((v) => v != null) ? o : null;
}
/* השיא הצפוי של עבודה (MB) לפי המודל של השרת: תרגום / הפקה מחדש לפי האורך, גיליון AI — קבוע */
function peakNeed(job, fit) {
  const m = ((job && job.spec && job.spec.dur) || 3600) / 60;
  if (job && (job.kind === 'ai' || job.kind === 'dx' || (job.spec && job.spec.src === 'subs'))) return fit.ai;   // 26/10/2026: dx — רק העתקה   // 22/10/2026: קובץ כתוביות — בלי מודלים כבדים
  if (job && job.kind === 'rr') return fit.ra + fit.rb * m;
  return fit.a + fit.b * m;
}
/* ת7 (11/10/2026): יומן השרת במקום אחד — העובד שולח בכל פנייה את 12 האירועים האחרונים שלו ([שניות, קוד]), ומסך השרת
   מציג אותם. רק קודים מהקטלוג (בלי טקסט חופשי, בלי מזהי עבודות) — מה שלא מתאים נזרק */
const SRV_EV = ['up', 'job', 'done', 'fail', 'stop', 'oom', 'timeout', 'crash', 'auth', 'net', 'warm', 'lost', 'park'];   // 14/10: lost = עבודה נקטעה בהפעלה מחדש; 15/10: park = חזרה לתור עד שהסרטון יגיע
function normEv(a) {
  const out = [];
  for (const x of Array.isArray(a) ? a.slice(-12) : []) {
    if (!Array.isArray(x) || x.length !== 2) continue;
    const t = Math.round(Number(x[0])), k = String(x[1] || '');
    if (!(t > 1.6e9 && t < 4e9) || !SRV_EV.includes(k)) continue;
    out.push([t, k]);
  }
  return out;
}
/* ת7 — ניטור: שרת שכבר דיווח ושותק מעל SRV_DOWN_MS "נפל". שרת שעוד לא התחבר (seen 0 — למשל קוד הקמה שמחכה למלאי)
   לא נחשב; ומי שכבר סומן (dn) לא מתריע שוב עד שיחזור. העובד שואל כל 20 שנ׳, באמצע עבודה דופק כל 5 דק׳,
   ובתקלה בשרתון מחכה עד 5 דק׳ — רבע שעה = בלי התראות שווא */
const SRV_DOWN_MS = 15 * 60e3;
function serversDown(list, now) {
  return (Array.isArray(list) ? list : []).filter((s) => s && SRV_ID_RE.test(String(s.id || '')) && s.seen > 0 && now - s.seen > SRV_DOWN_MS && !s.dn);
}
/* 15/10/2026: שרת קיים שפונה עם טוקן שלא תואם (10/10 — שינוי בשרתון שבר את כל הטוקנים, והשרתים קיבלו 401 בשקט עד
   שמישהו נכנס לקונסולה). השרתון רושם `ba` (פנייה אחרונה שנדחתה) לכל היותר פעם ב־BAD_AUTH_GAP; פנייה תקינה מאפסת */
const BAD_AUTH_GAP = 10 * 60e3;
const badAuthDue = (srv, now) => !!srv && !(srv.ba > 0 && now - srv.ba < BAD_AUTH_GAP);
function serverView(s, now) {
  if (!s || !SRV_ID_RE.test(String(s.id || ''))) return null;
  return { id: s.id, name: clean(s.name, 40) || s.id, created: s.created || 0, seen: s.seen || 0, ba: s.ba > 0 ? s.ba : 0,
    online: !!s.seen && now - s.seen < SRV_ONLINE_MS, paused: s.paused === true, hb: s.hb ? normHb(s.hb) : null };
}
/* תקציב חודשי למשתמש (מפתח ה־API של המערכת): מה שכבר נוצל החודש — לפי העלות שהעובד דיווח */
const monthKey = (now) => new Date(now).toISOString().slice(0, 7);
const monthUsed = (mu, now) => (mu && mu.m === monthKey(now) ? Math.max(0, +mu.usd || 0) : 0);
const addMonth = (mu, usd, now) => ({ m: monthKey(now), usd: Math.round((monthUsed(mu, now) + Math.max(0, +usd || 0)) * 1e4) / 1e4 });
// usdOf — מוגדר למעלה (v367), מעוגל לסנטים
/* תקרת העבודה בפועל: מה שהמשתמש בחר, אבל לא יותר ממה שנשאר החודש. פחות מדולר — לא מתחילים */
function jobCap(spec, used, month, prev) {
  if (spec && spec.cp === 1) return CAP_MIN_JOB;   // סבב 10: העתק־הדבק — בלי טוקנים מהמפתח שלנו (התקציב החודשי לא נוגע)
  if (spec && spec.ry === 1) return Math.max(CAP_MIN_JOB, normCap(spec.cap) - Math.max(0, Number(prev) || 0));   // 24/10/2026: המנוי שלך (Routine) — התקרה שלך לעבודה, בלי התקציב החודשי של המערכת
  const left = Math.max(0, month - used);
  // 14/10/2026: התקרה היא לכל העבודה, לא לכל הפעלה — "המשך" מקבל רק את מה שנשאר אחרי הסשנים הקודמים (prev = use0)
  const cap = Math.min(normCap(spec && spec.cap) - Math.max(0, Number(prev) || 0), left);
  return cap >= CAP_MIN_JOB ? Math.round(cap * 100) / 100 : 0;
}

/* ---------- Firestore (REST) ---------- */
/* 21/10/2026: מדידת ההעלאה מהטלפון (job.utl) — רק מספרים: זמן מהיצירה, החילוץ, העלאת הקול/הסרטון (ms), בייטים, זמן ברקע,
   ניסיונות, Wake Lock, סוג רשת, זיכרון וליבות של הטלפון. **UTL_KEYS זהה ל־UTL_KEYS ב־studio.js** */
const UTL_KEYS = ['c2s', 'ex', 'ab', 'a', 'v', 'vb', 'hid', 'hn', 'rs', 'wt', 'wl', 'wlr', 'nt', 'dl', 'dm', 'hc', 'vf', 'bg', 'dvp', 'dvs', 'dvn', 'vh', 'np'];   // 1/11/2026: np = הפרוטוקול של חלק בהעלאה (1 = http/1.1, 2 = h2, 3 = h3; protoCode ב־studiostore.js)   // 25/10/2026: המכשיר — dvp/dvs/dvn (devCodes ב־studio.js)   // vf = הסרטון עלה לפני שהחילוץ הסתיים · bg = ההעלאה ברקע (1 הצליחה, 2 חזרה לרגילה, 3 לא נתמכת)
function normUtl(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const out = {};
  for (const k of UTL_KEYS) { const v = Number(o[k]); if (Number.isFinite(v) && v >= 0 && v <= 1e11) out[k] = Math.round(v); }
  return Object.keys(out).length ? out : null;
}
const JSON_FIELDS = ['mon', 'uh', 'sto', 'upv', 'spec','fa', 'fv', 'fsu', 'fo', 'sess', 'prog', 'fh', 'use', 'qa', 'ck', 'use0', 'tw', 'ns', 'fb', 'ls', 'al', 'hb', 'rl', 'mu', 'fr', 'inc', 'mi', 'tr', 'pv', 'q', 'ij', 'jd', 'tg', 'sc', 'et', 'ep', 'wp', 'gl', 'nt', 'nh', 'thr', 'sh', 'rh', 'gd', 'gq', 'fc', 'vh', 'fq', 'hl', 'hla', 'rvf', 'fil', 'cp', 'lx', 'eh', 'lr', 'ux', 'utl', 'pbr', 'fph', 'pbn', 'fpw', 'ppr', 'urt', 'fsr', 'vst', 'vcp'];   // 29/10/2026: vst = כמה מהסרטון ב־R2 בפעם האחרונה שזז (העלאה תקועה — upStallStep)   // 26/10/2026: fsr = רצועת הכתוביות שבקובץ, עזר להגהה   // 25/10/2026: ppr = ההתקדמות בטלפון לפני ההתחלה (שלב 2)   // 25/10/2026: fpw = המילים עם הזמנים מהטלפון (שלב 2)   // 24/10/2026: fph = קובץ המדידות מהטלפון, pbn = הצריבה בטלפון   // 22/10/2026: pbr = סיכום בדיקת קישור (studioProbe)   // 15/10/2026: מ׳3 — מה קרה אחרי העבודה (ux)   // 14/10/2026: מאגר הלמידה — עובדות מהעובד, היסטוריית הכשלים, הרשומה   // סבב 4: סימונים מהביקורת, מילות מילוי   // איכויות הצפייה   // v387: סט הזהב   // v384: מצב צל וזיהוי "המשך" חוזר   // v382: הערה לעובד   // v380: זיכרון המונחים   // שלב 4: מנויי התראות (Web Push)   // 10/10/2026: צפי הזמנים (דגימות + התוכנית של העבודה)   // v378: בדיקת המוכנות   // v377: יעדי השירות   // v375: שופט האיכות   // v374: מדד האיכות ושומר ההזרקות   // v373: עקיבה וגרסאות ההנחיות   // v371: תקלות ותקלה רחבה
function toFields(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || k === 'id' || k.startsWith('_')) continue;
    if (JSON_FIELDS.includes(k)) out[k] = { stringValue: JSON.stringify(v == null ? null : v) };
    else if (typeof v === 'number') out[k] = { integerValue: String(Math.round(v)) };
    else if (typeof v === 'boolean') out[k] = { booleanValue: v };
    else if (v === null) out[k] = { nullValue: null };
    else out[k] = { stringValue: String(v) };
  }
  return out;
}
function fromFields(f) {
  const o = {};
  for (const [k, v] of Object.entries(f || {})) {
    if (!v || typeof v !== 'object') continue;
    if ('stringValue' in v) { if (JSON_FIELDS.includes(k)) { try { o[k] = JSON.parse(v.stringValue); } catch (e) { o[k] = null; } } else o[k] = v.stringValue; }
    else if ('integerValue' in v) o[k] = +v.integerValue;
    else if ('doubleValue' in v) o[k] = +v.doubleValue;
    else if ('booleanValue' in v) o[k] = !!v.booleanValue;
    else o[k] = null;
  }
  if (o.spec && typeof o.spec === 'object' && LEGACY_MODES[o.spec.mode]) o.spec.mode = LEGACY_MODES[o.spec.mode];   // עבודה שנשמרה במצב שהוסר
  return o;
}

module.exports = { UP_STALL_MS, upStallStep, normVcp, bxOk, RATE_WHY, RATE_FLAG_MAX, normRate, START_RETRY, startDue, useAdd, PH_BURN, PH_META_MAX, PH_WORDS_MAX, PH_UP_MAX, normPbn, normPpr, PPR_S, SUBS_MAX, SUBS_FPS, MAX_ACTIVE_ADMIN, maxActive, UTL_KEYS, normUtl, crashWhere, glKey, glParse, glFormat, GL_MAX, smKey, seriesOf, normSm, smParse, smMerge, smForWorker, jobSeries, SM_BYTES, dualAb, DUAL_AB_UNTIL, rvAb, RV_AB_UNTIL, JSON_FIELDS, normCpq, cpView, cpWorker, CP_ROLES, CP_N_MAX, CP_FILE_MAX,
  MODES, LEGACY_MODES, modeNow, PUBLIC_MODES, DEFAULT_MODE, modeOk, engOk, LANG_READY, langReady,
  SHADOW_N, SH_DIFF, RED_X, thStep, thView, LOOP_N, LOOP_WIN, loopRecent,
  GOLD_MAX, GOLD_REF_MAX, normGd, normGq, goldSources, goldClone, normXe, XE_KEYS, XE_EFFORTS, smokeJob, SMOKE_S, VH_MAX, CUES_MAX, RR_OUTS, normEdl, edlPre, AI_Q_MAX, aiJob, DX_MAX, normDx, dxJob, dxName, cuesSwap, rrSpec, rrJob,
  normTrace, normPv, normQuality, normInj, Q_KEYS, INJ_CODES, normJudge, JG_CODES, normRvf, RVF_MAX, RVF_CODES, normFil, FIL_MAX, normSty, normOv, normGl, glClean, normNoteText, noteView, NOTE_MAX,
  ROUTINE_URL_RE, ROUTINE_KEY_RE, JOB_RE, KEY_RE, FILE_ID_RE, KEY_TTL, STAGES, FINAL, ACTIVE, KINDS, WORKER_KINDS,
  MAX_ACTIVE, MAX_STORED, FIRE_HOUR, TEST_GAP,
  normRoutine, hintOf, normSpec, normLyr, normKy, KY_DEF, KA_LYR_MAX, KA_OUTS, KA_AL, normFile, normOut, OUT_KINDS, OUT_MAX, normHl, normHla, HL_MAX, pickerCfg, extVideoOk, normUsage, normAsk, normAnswer, ASK_MAX,
  RULE_BUDGET_MAX, normRules, modeOver, usdOf, GATE_KINDS, GATE_MAX, GATE_WAIT, newGateId, normGate,
  NORM_MIN, NORM_DEF, NORM_FIXED, NORM_DEF_API, NORM_FIXED_API, normDef, normFixed, engKey, normSample, addSample, learnedNorm, normsView,
  FB_MAX, FIX_MAX, normFixText, fbList, fbNumber, cheaperModes, COST_STOP, fbStop, fbFix, fbUsed, fbForWorker, fbView, FIX_MODES, normFixMode, fbDecide, fbRemove,
  CK_STAGES, STALE_MS, RESUME_MAX, RECOVER_WAIT, AUTO_RESUME_MAX, EARLY_FAIL_MS, EARLY_WAIT, recoverWait, TRANSIENT_ERRS, TRANSIENT_KINDS, STOP_ERRS, DET_ERRS, isTransient, recoverAt, normTower, normCk, addCk, lastCk, isStale, canResume, mergeUse, newJobId, newKey, keyHash, keyMatches, fireText, fireError, fireDetail, fireSession, recentFires,
  effState, publicJob, workerJob, applyReport, resumeProg, stgSpent, excludeWait, toFields, fromFields, normFit, peakNeed,
  SRV_ID_RE, SRV_MAX, SRV_ONLINE_MS, SRV_DOWN_MS, serversDown, BAD_AUTH_GAP, badAuthDue, API_QUEUE_WAIT, CAP_DEF, CAP_MAX, CAP_MIN_JOB, normCap, newServerId, newServerToken, parseServerToken,
  serverMatches, normHb, normEv, SRV_EV, parkable, PARK_MAX, serverView, monthKey, monthUsed, addMonth, jobCap,
};
