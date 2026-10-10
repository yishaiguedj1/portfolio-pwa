/* סטודיו התרגום — שלב 2 (v355): עבודות, מפתח עבודה, החיבור ל־Routine והדיווח מהעובד בענן.
   הטלפון לא מחזיק שום סוד: הכתובת והמפתח של ה־Routine נשמרים רק מוצפנים בכספת (lib/vault.js, AAD = studio|uid|r)
   במסמך studioVault/{uid}, ולא חוזרים לטלפון לעולם. כל הפעלה של ה־Routine מקבלת מפתח עבודה חדש (32 בתים אקראיים):
   נשמר רק ה־SHA-256 שלו, תקף 48 שעות, להפעלה אחת (הפעלה חדשה מחליפה אותו), ואחרי שהעבודה נגמרה הוא רק מחזיר "עצור".
   הקובץ טהור (בלי רשת) — api/studio.js עושה את הקריאות, ו־tests/run.js בודק את שניהם. */
const crypto = require('crypto');
const SLA = require('./studiosla');   // v377: יעדי שירות
const ETA = require('./studioeta');   // 10/10/2026: צפי זמנים נלמד

const ROUTINE_URL_RE = /^https:\/\/api\.anthropic\.com\/v1\/claude_code\/routines\/(trig_[A-Za-z0-9]{8,64})\/fire$/;
const ROUTINE_KEY_RE = /^sk-ant-oat01-[A-Za-z0-9_-]{20,400}$/;
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;
const KEY_RE = /^[A-Za-z0-9_-]{43}$/;
const FILE_ID_RE = /^[A-Za-z0-9_-]{10,100}$/;
// מזהה הסשן בתשובת ההפעלה: בתיעוד session_…, בפועל cse_… (07/10/2026) — שתי קידומות לאותו סשן
const SESSION_RE = /^(?:session|cse)_([A-Za-z0-9]{8,80})$/;
const SESSION_URL_RE = /^https:\/\/claude\.ai\/code\/session_[A-Za-z0-9]{8,80}$/;
const ERR_RE = /^[a-z0-9_]{1,40}$/;
const KEY_TTL = 48 * 3600e3;
const CLAIM_WAIT = { ping: 6 * 60e3, tr: 30 * 60e3 };   // הופעל ולא נלקח בזמן הזה = Claude לא התחיל (סשן שנפל / הנחיה אחרת)
/* השלבים, בסדר — אותם מזהים באפליקציה (studionet.js) ובעובד (translator/job.py) */
const STAGES = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];
const FINAL = ['done', 'failed', 'cancelled'];
const ACTIVE = ['new', 'queued', 'running'];
const KINDS = ['ping', 'tr'];
/* מה העובד בענן יודע לבצע. שלב 2: רק "בדיקת חיבור"; התרגום עצמו מגיע בשלב 3 — אז 'tr' נכנס לכאן, והאפליקציה לא משתנה */
const WORKER_KINDS = ['ping', 'tr'];   // v358: העובד מתרגם (שלב 3)
// 10/10/2026 (בקשת המשתמש): Haiku 5.5 נכנס, Opus High/Max יצאו. הראשון = ברירת המחדל (Sonnet Medium — המומלץ).
const MODES = ['sonnet-medium', 'haiku-medium', 'haiku-high', 'sonnet-high', 'opus-medium'];
// מצבים שהוסרו → המצב הקיים הקרוב (עבודה / טיוטה / חוק שנשמרו לפני ההחלפה ממשיכים לעבוד, לא נופלים)
const LEGACY_MODES = { 'opus-high': 'opus-medium', 'opus-max': 'opus-medium' };
const modeNow = (m) => (MODES.includes(m) ? m : LEGACY_MODES[m] || MODES[0]);
const LANGS = ['en', 'he', 'ar', 'ru', 'es', 'fr', 'de', 'it', 'pt', 'uk', 'pl', 'nl', 'tr', 'fa', 'hi', 'zh', 'ja', 'ko', 'am'];
const STYLES = ['bold', 'classic', 'karaoke'];
const OUTS = ['same', 'compact', 'mkv'];
const OUT_KINDS = ['compact', 'same', 'mkv', 'srt'];   // v358: תוצרים שהעובד מעלה לתיקיית העבודה
const MAX_SIZE = 64 * 1024 ** 3;            // 64GB — הרבה מעל כל ראיון (Drive מקבל עד 5TB)
const MAX_ACTIVE = 5;                       // עבודות פתוחות בבת אחת למשתמש
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
const TRANSIENT_ERRS = ['net', 'drive', 'drive_net'];
const TRANSIENT_KINDS = ['drive:dl_retry', 'drive:up_retry', 'drive:dl_fail', 'drive:up_fail'];
/* עצירה מכוונת — אף פעם לא "חולפת", גם כשבמקרה הייתה תקלת Drive פתוחה (המגדל / התקציב / מתג החירום / ההחלטה שלך) */
const STOP_ERRS = ['tower_stop', 'budget_stop', 'halted', 'upload_timeout', 'lang_unsupported', 'worker_unknown_kind'];
/* האם הכישלון חולף: קוד השגיאה שהעובד דיווח, או התראת Drive פתוחה של העבודה הזו ברגע הכישלון */
function isTransient(err, openKinds) {
  const e = String(err || '');
  if (STOP_ERRS.includes(e)) return false;
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
function normSpec(s) {
  if (!s || typeof s !== 'object') return null;
  const name = clean(s.name, 200), size = Math.floor(Number(s.size) || 0);
  if (!name || !(size > 0) || size > MAX_SIZE) return null;
  const to = uniq(s.to, (c) => LANGS.includes(c)).slice(0, 12);
  if (!to.length) return null;
  return Object.assign({
    name, size,
    type: String(s.type || '').slice(0, 60).replace(/[^\w.+/-]/g, ''),
    dur: Math.max(0, Math.min(24 * 3600, Math.round(Number(s.dur) || 0))),     // שניות (0 = לא ידוע)
    from: s.from === 'auto' || LANGS.includes(s.from) ? s.from : 'auto',
    to,
    mode: modeNow(s.mode),
    out: uniq(s.out, (k) => OUTS.includes(k)),                                  // SRT תמיד; ריק = SRT בלבד
    style: STYLES.includes(s.style) ? s.style : STYLES[0],
    terms: String(s.terms || '').replace(/\u0000/g, '').slice(0, 1000),
  }, s.eng === 'api' ? { eng: 'api', cap: normCap(s.cap) } : {});   // מצב API של המערכת — עם תקרת עבודה ($)
}
/* קובץ שעלה ל־Drive (מה ש־Drive עצמו החזיר — api/studio.js מאמת מולו) */
function normFile(f) {
  if (!f || !FILE_ID_RE.test(String(f.id || ''))) return null;
  const size = Math.floor(Number(f.size) || 0);
  if (!(size > 0)) return null;
  return { id: f.id, name: clean(f.name, 200), size, mime: String(f.mimeType || f.mime || '').slice(0, 80) };
}

/* v358: רשימת התוצרים מהעובד — עד 6, כל אחד מזהה Drive + סוג מוכר (האימות מול Drive — בשרתון) */
function normOut(list) {
  if (!Array.isArray(list)) return null;
  const out = [];
  for (const o of list.slice(0, 6)) {
    const f = normFile(o);
    if (!f || !OUT_KINDS.includes(o && o.k) || out.some((x) => x.k === o.k)) return null;
    out.push({ id: f.id, name: f.name, size: f.size, k: o.k });
  }
  return out.length ? out : null;
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
const isStale = (job, now) => !!job && (job.state === 'running' || job.state === 'queued' && job.claimed) && now - (job.updated || 0) > STALE_MS;
/* אפשר להמשיך? עבודת תרגום עם קבצים, שנכשלה / בוטלה / נתקעה, ולא הופעלה יותר מדי פעמים */
function canResume(job, now) {
  if (!job || job.kind !== 'tr' || !(job.fa || job.fv)) return 'state';
  const st = effState(job, now).state;
  if (!(st === 'failed' || st === 'cancelled' || isStale(job, now))) return 'state';
  if ((job.fires || 0) >= RESUME_MAX) return 'resume_limit';
  return '';
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
// Haiku 5.5 (10/10/2026): הערכה — המחיר פי 20 זול מ־Sonnet, ובמצב Routine הסשן הראשי נשאר Sonnet; יוחלף במדידה מ־NORM_MIN עבודות
const NORM_DEF = { 'sonnet-medium': 3.0, 'haiku-medium': 0.4, 'haiku-high': 0.6, 'sonnet-high': 4.2, 'opus-medium': 6.0 };
const NORM_FIXED = 1.5;
function normSample(job, use, now) {
  const sp = job && job.spec;
  if (!job || job.kind !== 'tr' || (job.fires || 0) > 1 || !sp || !MODES.includes(sp.mode) || !(sp.dur > 0)) return null;
  if (!Array.isArray(use) || !use.length || use.some((r) => r.usd == null)) return null;   // מודל בלי מחירון — לא יודעים כמה עלה
  const u = use.reduce((s, r) => s + (r.usd || 0), 0);
  if (!(u > 0) || u > 1e4) return null;
  return { m: sp.mode, d: Math.round(sp.dur), u: Math.round(u * 100) / 100, at: now };
}
function addSample(list, s) {
  return (Array.isArray(list) ? list : []).filter((x) => x && MODES.includes(x.m) && x.d > 0 && x.u > 0).concat(s ? [s] : []).slice(-NORM_KEEP);
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y), k = s.length >> 1; return s.length % 2 ? s[k] : (s[k - 1] + s[k]) / 2; };
/* לשעת סרטון (אורך מינימלי 10 דק׳ — בסרטון קצר עלות הפתיחה שולטת). ph = החציון, mx = הכבדה ביותר, n = כמה עבודות */
function learnedNorm(list, mode) {
  const rates = addSample(list, null).filter((x) => x.m === mode).map((x) => x.u / (Math.max(x.d, NORM_DUR_MIN) / 3600));
  if (rates.length < NORM_MIN) return null;
  const r2 = (v) => Math.round(v * 100) / 100;
  return { ph: r2(median(rates)), mx: r2(Math.max(...rates)), n: rates.length };
}
/* v384: מצב צל לספים חדשים (ServiceNow: Kill switch · warn_only). כש"הרגיל" של מצב משתנה משמעותית — נלמד לראשונה, או החציון /
   סף העצירה זזו ב־SH_DIFF ומעלה — הספים החדשים רצים SHADOW_N עבודות במצב צל: המגדל אוכף את הישנים (`old`; null = המדידות שלנו)
   ורק מזהיר כשהחדשים היו עוצרים. שינוי קטן (חציון שזז מעט אחרי כל עבודה) — מתעדכן בשקט, בלי צל.
   הרשומה לכל מצב ב־studioStats/{uid}.th: { nm, old, n }. RED_X זהה ל־tower.py */
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
function normsView(list) {
  const out = {};
  for (const m of MODES) {
    const l = learnedNorm(list, m);
    out[m] = l || { ph: NORM_DEF[m], n: addSample(list, null).filter((x) => x.m === m).length, d: true };
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
const COST_STOP = (job) => !!job && (job.err === 'budget_stop' || (job.err === 'tower_stop' && !!job.tw && (job.tw.why === 'cost' || job.tw.why === 'cap')));

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
  return { id: a.id, q, o, d, w };
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
    mx: MODES.includes(o.mx) ? o.mx : '',
    ab: o.ab === true,
    jx: o.jx === true,   // v375: שופט האיכות כבוי (ברירת המחדל — פועל, החלטה 4 בתוכנית)
  };
}
/* המצב יקר מהמקסימום? לפי הצפוי לשעת סרטון (NORM_DEF): Haiku Medium < Haiku High < Sonnet Medium < Sonnet High < Opus Medium */
const modeOver = (mode, mx) => !!mx && MODES.includes(mode) && MODES.includes(mx) && NORM_DEF[mode] > NORM_DEF[mx];
/* כמה כבר עלו הסשנים הקודמים של העבודה (אחרי "המשך") — התקציב הוא לכל העבודה, לא לסשן */
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
      .map((c) => ({ t: CUE_T_RE.test(String((c && c.t) || '')) ? c.t : '', x: clean(c && c.x, 140) })).filter((c) => c.x).slice(0, 5);
    n = { cues, cnt: Math.max(0, Math.min(1e5, Math.floor(Number(g.cnt) || 0))) };
  }
  return { id, g: g.k, q: '', o: ['go', 'stop'], d: 1, w: GATE_WAIT, n };
}

/* ---------- מזהים ומפתחות ---------- */
const newJobId = () => 'j' + crypto.randomBytes(15).toString('base64url');
const newKey = () => crypto.randomBytes(32).toString('base64url');
const keyHash = (k) => crypto.createHash('sha256').update(String(k)).digest('hex');
function keyMatches(job, key) {
  if (!job || !job.kh || !KEY_RE.test(String(key || ''))) return false;
  const a = Buffer.from(keyHash(key), 'hex'), b = Buffer.from(String(job.kh), 'hex');
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

/* ---------- מצב העבודה ---------- */
/* הופעל ולא נלקח בזמן סביר → נכשל (נבדק בכל קריאה; נשמר בכתיבה הבאה) */
function effState(job, now) {
  // v356: הפעלה "לא ודאית" (5xx/רשת — warn) שלא נלקחה: השגיאה של Anthropic, לא "לא התחיל" (שמפנה לרשת של הסביבה)
  if (job && job.state === 'queued' && job.eng === 'api') {
    // מצב API: העבודה בתור עד ששרת פנוי לוקח אותה. שרת לקח ולא התחיל בזמן / אף שרת לא לקח — נכשלה
    if (job.pk && now - job.pk > CLAIM_WAIT.tr) return { state: 'failed', err: 'no_claim' };
    if (!job.pk && job.fired && now - job.fired > API_QUEUE_WAIT) return { state: 'failed', err: 'no_server' };
    return { state: 'queued', err: '' };
  }
  if (job && job.state === 'queued' && job.fired && now - job.fired > (CLAIM_WAIT[job.kind] || CLAIM_WAIT.tr)) return { state: 'failed', err: job.warn || 'no_claim' };
  return { state: job ? job.state : 'failed', err: job ? job.err || '' : '' };
}
const fileView = (f) => (f && f.id ? { id: f.id, name: f.name || '', size: f.size || 0, at: f.at || 0 } : null);
/* מה הטלפון רואה — בלי המפתח (גם לא ה־hash) */
function publicJob(job, now) {
  const e = effState(job, now);
  return {
    id: job.id, kind: job.kind, state: e.state, err: e.err, created: job.created || 0, updated: job.updated || 0,
    fired: job.fired || 0, claimed: job.claimed || 0, ended: job.ended || 0,
    spec: job.spec || null, files: { a: fileView(job.fa), v: fileView(job.fv), o: Array.isArray(job.fo) ? job.fo : [] },
    sess: job.sess && job.sess.url ? { url: job.sess.url } : null,
    prog: job.prog || null, ed: job.ed || '',
    use: Array.isArray(job.use) ? job.use : Array.isArray(job.use0) ? job.use0 : null,   // v359: טוקנים ועלות (v361: כולל סשנים קודמים)
    qa: job.qa && job.qa.id ? job.qa : null,        // שאלה מ־Claude (והתשובה, אם כבר ענית)
    ck: lastCk(job.ck) ? { s: lastCk(job.ck).s, at: lastCk(job.ck).at || 0 } : null,   // v361: נקודת השמירה האחרונה
    stale: isStale(job, now),                       // v361: "רצה" בלי דיווח שעתיים — אפשר להמשיך
    fires: job.fires || 0,
    tw: job.tw && TW_LV.includes(job.tw.lv) ? job.tw : null,   // v362: מגדל הפיקוח
    rec: recoverAt(job, now),                       // v368: תקלה חולפת — ממשיכה לבד מהרגע הזה (0 = לא)
    eng: job.eng === 'api' || job.spec && job.spec.eng === 'api' ? 'api' : 'sub',   // מצב API: השרת של המערכת
    sid: job.eng === 'api' && SRV_ID_RE.test(String(job.sid || '')) ? job.sid : '',
    fr: job.fr && typeof job.fr.s === 'number' ? { s: job.fr.s, ms: Math.max(0, Math.round(job.fr.ms || 0)) } : null,   // v369: תוצאת ההפעלה האחרונה
    tr: normTrace(job.tr),                          // v373: עקיבה — פעולות לכל סוכן והקבוצות הנפוצות
    q: normQuality(job.q), ij: normInj(job.ij),     // v374: מדד האיכות ושומר ההזרקות
    jd: normJudge(job.jd),                          // v375: שופט האיכות
    ep: ETA.normEp(job.ep),                         // 10/10/2026: צפי הזמנים של העבודה (נקבע בלקיחה)
    gl: normGl(job.gl),                             // v380: מונחים מהמילון שלך שימשו + מונחים חדשים להצעה
    nt: noteView(job),                              // v382: הערה לעובד — מחכה לנקודת השמירה הבאה / נקראה
    sla: SLA.slaView(job, now),                     // v377: יעד זמן ותקציב (השעון עוצר כשמחכים לך)
    gd: normGd(job.gd), gs: JOB_RE.test(String(job.gs || '')) ? job.gs : '', gq: normGq(job.gq),   // v387: סט הזהב — ייחוס, מקור ההרצה, הציון
  };
}
/* v387: סט הזהב (Agentic evaluation · golden dataset) — עבודה שהסתיימה + תרגום אנושי לייחוס (קובץ SRT בתיקיית העבודה ב־Drive).
   gd = הייחוס {r מזהה הקובץ, n גודל, at}; gs = עבודה שהיא הרצה חוזרת של עבודת זהב (המקור); gq = הציון מול הייחוס {s chrF, tm כיסוי זמן, n כתוביות, at}.
   הציון מחושב בטלפון (studionet.goldCompare — דטרמיניסטי, בלי AI). הרצה חוזרת = עבודות חדשות עם אותו מקור — רק בלחיצה, אחרי אומדן ואישור */
const GOLD_MAX = 10, GOLD_REF_MAX = 2 * 1024 * 1024;
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
const goldSources = (jobs) => (Array.isArray(jobs) ? jobs : []).filter((j) => j && j.kind === 'tr' && j.state === 'done' && normGd(j.gd) && (j.fa || j.fv) && FILE_ID_RE.test(String(j.folder || '')));
/* הרצה חוזרת של עבודת זהב — עבודה חדשה עם אותו מקור (אותם קבצים ותיקייה), "חדשה" עד שמתחילים אותה */
function goldClone(src, id, uid, now) {
  const out = Array.from(new Set((Array.isArray(src.spec && src.spec.out) ? src.spec.out : []).concat(['srt'])));   // ההשוואה צריכה SRT
  return { id, uid, kind: 'tr', state: 'new', created: now, updated: now, spec: Object.assign({}, src.spec, { out }), fa: src.fa || null, fv: src.fv || null, folder: src.folder, gs: src.id };
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
  if (Object.values(c).reduce((x, y) => x + y, 0) > n) return null;
  return { s, n, t, a, c };
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
function workerJob(job, nm, fb, fm, rl) {
  return { nm: nm || null,   // v363: "הרגיל" של המשתמש למצב הזה (או null — המגדל משתמש במדידות שלנו)
    rl: normRules(rl),       // v367: החוקים שלך — תקציב ואישור לפני צריבה
    bx: job.bx || 0,         // v367: כמה פעמים אישרת להמשיך מעבר לתקציב (התקציב גדל בכל פעם)
    u0: usdOf(job.use0),     // v367: מה שהסשנים הקודמים כבר עלו
    fm: normFixMode(fm),     // v366: מסלול התיקונים — העובד אומר ל־Claude אם התיקון נשמר או מחכה לאישור
    fb: fb || [],            // v364: ספר התיקונים — תקלות מוכרות עם התיקון שלהן
    ls: job.ls && FP_RE.test(String(job.ls.fp || '')) ? job.ls : null,   // v364: העצירה שלפני ההמשך (לאבחון)
    cap: job.eng === 'api' && job.capc > 0 ? job.capc / 100 : null,   // מצב API: תקרת העבודה ($; נשמרת בסנטים) — כבר אחרי התקציב החודשי שנשאר
    id: job.id, kind: job.kind, state: job.state, spec: job.spec || null, folder: job.folder || '', files: { a: fileView(job.fa), v: fileView(job.fv) },
    qa: job.qa && job.qa.id ? { id: job.qa.id, q: job.qa.q, a: job.qa.a || null, g: job.qa.g || '' } : null,   // v361: גם השאלה — להמשך בסשן חדש
    ck: Array.isArray(job.ck) ? job.ck.map((c) => ({ s: c.s, id: c.id, size: c.size })) : [],   // v361: להמשך (מהאחרונה)
    sh: job.sh && job.sh.n > 0 ? { n: job.sh.n, old: job.sh.old || null } : null,   // v384: מצב צל — המגדל אוכף את הספים הישנים
    notes: (Array.isArray(job.nh) ? job.nh : []).map((x) => normNoteText(x && x.t)).filter(Boolean).slice(-NOTE_MAX) };   // v382: ההערות שכבר נקראו — להמשך בסשן חדש
}
/* דיווח מהעובד → התקדמות חדשה. כל שלב מקבל זמן התחלה וסיום אמיתיים (המסך מציג "✓ 8 דק׳") */
function applyReport(job, r, now) {
  const prog = Object.assign({ st: '', p: 0, stg: {} }, job.prog || {});
  prog.stg = Object.assign({}, prog.stg);
  const closeCur = () => { if (prog.st && prog.stg[prog.st] && !prog.stg[prog.st].e) prog.stg[prog.st] = Object.assign({}, prog.stg[prog.st], { e: now }); };
  const st = STAGES.includes(r.st) ? r.st : '';
  if (st && st !== prog.st) {
    closeCur();
    prog.stg[st] = { s: now, e: 0 };
    prog.st = st; prog.p = 0; delete prog.eta;
  }
  // v361: אחרי "המשך" — השלב שבו העבודה נעצרה נפתח שוב (נסגר כשהיא נכשלה)
  else if (st && prog.stg[st] && prog.stg[st].e && r.done !== true && r.fail !== true) prog.stg[st] = Object.assign({}, prog.stg[st], { e: 0 });
  if (r.p != null && Number.isFinite(+r.p)) prog.p = Math.max(0, Math.min(1, +r.p));
  if (r.msg != null) prog.msg = clean(r.msg, 240);
  if (r.ex != null) prog.ex = clean(r.ex, 240);
  if (r.eta != null && Number.isFinite(+r.eta)) prog.eta = Math.max(0, Math.min(48 * 3600, Math.round(+r.eta)));   // שניות שנשארו לשלב (העובד יודע הכי טוב)
  if (r.checks && typeof r.checks === 'object') prog.ck = { drive: r.checks.drive === true, server: true };
  prog.at = now;
  const out = { prog, updated: now };
  if (r.done === true) { closeCur(); prog.p = 1; out.state = 'done'; out.ended = now; }
  else if (r.fail === true) { closeCur(); out.state = 'failed'; out.err = ERR_RE.test(String(r.err || '')) ? r.err : 'worker'; out.ended = now; }
  return out;
}

/* ---------- מצב "API של המערכת": השרת שלנו (Hetzner) ---------- */
/* השרת לא מקבל חיבורים — הוא שואל (poll) ומדווח דופק (beat). מזוהה בטוקן שרת: "<מזהה 12>-<סוד 43>". נשמר רק ה־hash */
const SRV_ID_RE = /^[a-z0-9]{12}$/;
const SRV_TOKEN_RE = /^([a-z0-9]{12})-([A-Za-z0-9_-]{43})$/;
const SRV_MAX = 5;                          // שרתים רשומים
const SRV_ONLINE_MS = 12 * 60e3;            // שואל כל 20 שנ׳; באמצע עבודה — דופק כל 5 דק׳
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
  if (!srv || !/^[0-9a-f]{64}$/.test(String(srv.th || ''))) return false;
  const a = Buffer.from(keyHash(tok), 'hex'), b = Buffer.from(srv.th, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
/* הדופק מהשרת — רק מספרים וגרסה; כל השאר נזרק */
function normHb(h) {
  h = h && typeof h === 'object' ? h : {};
  const n = (x, lo, hi) => (Number.isFinite(+x) ? Math.max(lo, Math.min(hi, Math.round(+x * 10) / 10)) : null);
  return { v: /^[0-9a-f]{7,40}$|^dev$/.test(String(h.v || '')) ? String(h.v).slice(0, 12) : '',
    disk: n(h.disk, 0, 100), free: n(h.free, 0, 1e5), mem: n(h.mem, 0, 100), load: n(h.load, 0, 512), up: n(h.up, 0, 1e9),
    busy: JOB_RE.test(String(h.busy || '')) ? h.busy : '',
    // ת2: בידוד הקופסה — g = gVisor, r = רגיל (runc) + הסיבה מקטלוג קבוע
    iso: h.iso === 'g' || h.iso === 'r' ? h.iso : '', iw: h.iso === 'r' && ['mem', 'missing', 'selftest', 'manual'].includes(h.iw) ? h.iw : '',
    al: h.al === 'o' || h.al === 't' ? h.al : '' };   // שלב 4.1: מנוע היישור (o = ONNX INT8)
}
function serverView(s, now) {
  if (!s || !SRV_ID_RE.test(String(s.id || ''))) return null;
  return { id: s.id, name: clean(s.name, 40) || s.id, created: s.created || 0, seen: s.seen || 0,
    online: !!s.seen && now - s.seen < SRV_ONLINE_MS, paused: s.paused === true, hb: s.hb ? normHb(s.hb) : null };
}
/* תקציב חודשי למשתמש (מפתח ה־API של המערכת): מה שכבר נוצל החודש — לפי העלות שהעובד דיווח */
const monthKey = (now) => new Date(now).toISOString().slice(0, 7);
const monthUsed = (mu, now) => (mu && mu.m === monthKey(now) ? Math.max(0, +mu.usd || 0) : 0);
const addMonth = (mu, usd, now) => ({ m: monthKey(now), usd: Math.round((monthUsed(mu, now) + Math.max(0, +usd || 0)) * 1e4) / 1e4 });
// usdOf — מוגדר למעלה (v367), מעוגל לסנטים
/* תקרת העבודה בפועל: מה שהמשתמש בחר, אבל לא יותר ממה שנשאר החודש. פחות מדולר — לא מתחילים */
function jobCap(spec, used, month) {
  const left = Math.max(0, month - used);
  const cap = Math.min(normCap(spec && spec.cap), left);
  return cap >= CAP_MIN_JOB ? Math.round(cap * 100) / 100 : 0;
}

/* ---------- Firestore (REST) ---------- */
const JSON_FIELDS = ['spec', 'fa', 'fv', 'fo', 'sess', 'prog', 'fh', 'use', 'qa', 'ck', 'use0', 'tw', 'ns', 'fb', 'ls', 'al', 'hb', 'rl', 'mu', 'fr', 'inc', 'mi', 'tr', 'pv', 'q', 'ij', 'jd', 'tg', 'sc', 'et', 'ep', 'wp', 'gl', 'nt', 'nh', 'th', 'sh', 'rh', 'gd', 'gq'];   // v387: סט הזהב   // v384: מצב צל וזיהוי "המשך" חוזר   // v382: הערה לעובד   // v380: זיכרון המונחים   // שלב 4: מנויי התראות (Web Push)   // 10/10/2026: צפי הזמנים (דגימות + התוכנית של העבודה)   // v378: בדיקת המוכנות   // v377: יעדי השירות   // v375: שופט האיכות   // v374: מדד האיכות ושומר ההזרקות   // v373: עקיבה וגרסאות ההנחיות   // v371: תקלות ותקלה רחבה
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

module.exports = {
  MODES, LEGACY_MODES, modeNow,
  SHADOW_N, SH_DIFF, RED_X, thStep, thView, LOOP_N, LOOP_WIN, loopRecent,
  GOLD_MAX, GOLD_REF_MAX, normGd, normGq, goldSources, goldClone,
  normTrace, normPv, normQuality, normInj, Q_KEYS, INJ_CODES, normJudge, JG_CODES, normGl, glClean, normNoteText, noteView, NOTE_MAX,
  ROUTINE_URL_RE, ROUTINE_KEY_RE, JOB_RE, KEY_RE, FILE_ID_RE, KEY_TTL, STAGES, FINAL, ACTIVE, KINDS, WORKER_KINDS,
  MAX_ACTIVE, MAX_STORED, FIRE_HOUR, TEST_GAP,
  normRoutine, hintOf, normSpec, normFile, normOut, OUT_KINDS, normUsage, normAsk, normAnswer, ASK_MAX,
  RULE_BUDGET_MAX, normRules, modeOver, usdOf, GATE_KINDS, GATE_MAX, GATE_WAIT, newGateId, normGate,
  NORM_MIN, NORM_DEF, NORM_FIXED, normSample, addSample, learnedNorm, normsView,
  FB_MAX, FIX_MAX, normFixText, fbList, fbNumber, cheaperModes, COST_STOP, fbStop, fbFix, fbUsed, fbForWorker, fbView, FIX_MODES, normFixMode, fbDecide,
  CK_STAGES, STALE_MS, RESUME_MAX, RECOVER_WAIT, AUTO_RESUME_MAX, TRANSIENT_ERRS, TRANSIENT_KINDS, STOP_ERRS, isTransient, recoverAt, normTower, normCk, addCk, lastCk, isStale, canResume, mergeUse, newJobId, newKey, keyHash, keyMatches, fireText, fireError, fireDetail, fireSession, recentFires,
  effState, publicJob, workerJob, applyReport, toFields, fromFields,
  SRV_ID_RE, SRV_MAX, SRV_ONLINE_MS, API_QUEUE_WAIT, CAP_DEF, CAP_MAX, CAP_MIN_JOB, normCap, newServerId, newServerToken, parseServerToken,
  serverMatches, normHb, serverView, monthKey, monthUsed, addMonth, jobCap,
};
