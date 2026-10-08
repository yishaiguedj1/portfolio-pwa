/* סטודיו התרגום — שלב 2 (v355): עבודות, מפתח עבודה, החיבור ל־Routine והדיווח מהעובד בענן.
   הטלפון לא מחזיק שום סוד: הכתובת והמפתח של ה־Routine נשמרים רק מוצפנים בכספת (lib/vault.js, AAD = studio|uid|r)
   במסמך studioVault/{uid}, ולא חוזרים לטלפון לעולם. כל הפעלה של ה־Routine מקבלת מפתח עבודה חדש (32 בתים אקראיים):
   נשמר רק ה־SHA-256 שלו, תקף 48 שעות, להפעלה אחת (הפעלה חדשה מחליפה אותו), ואחרי שהעבודה נגמרה הוא רק מחזיר "עצור".
   הקובץ טהור (בלי רשת) — api/studio.js עושה את הקריאות, ו־tests/run.js בודק את שניהם. */
const crypto = require('crypto');

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
const MODES = ['opus-medium', 'opus-high', 'opus-max', 'sonnet-medium', 'sonnet-high'];
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
  return {
    name, size,
    type: String(s.type || '').slice(0, 60).replace(/[^\w.+/-]/g, ''),
    dur: Math.max(0, Math.min(24 * 3600, Math.round(Number(s.dur) || 0))),     // שניות (0 = לא ידוע)
    from: s.from === 'auto' || LANGS.includes(s.from) ? s.from : 'auto',
    to,
    mode: MODES.includes(s.mode) ? s.mode : MODES[0],
    out: uniq(s.out, (k) => OUTS.includes(k)),                                  // SRT תמיד; ריק = SRT בלבד
    style: STYLES.includes(s.style) ? s.style : STYLES[0],
    terms: String(s.terms || '').replace(/\u0000/g, '').slice(0, 1000),
  };
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
const USE_KINDS = ['main', 'tl', 'rv', 'sub'];
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
/* v362: מגדל הפיקוח — מצב מהעובד (ה־Hook בסשן): רמה, סיבה (בעצירה), פי כמה מהרגיל, עלות לפי מחירון ה־API והצפוי עד עכשיו */
const TW_LV = ['ok', 'warn', 'red'];
const TW_WHY = ['cost', 'cap', 'loop', 'calls', 'idle'];
function normTower(t) {
  if (!t || typeof t !== 'object' || !TW_LV.includes(t.lv)) return null;
  const n = (v, max, d) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(Math.min(v, max) * 10 ** d) / 10 ** d : 0);
  const out = { lv: t.lv, x: n(t.x, 1000, 1), usd: n(t.usd, 1e5, 2), exp: n(t.exp, 1e5, 2) };
  if (t.b === 'u') { out.b = 'u'; out.nj = Math.round(n(t.nj, 1000, 0)); }   // v363: "הרגיל" נלמד מהעבודות של המשתמש (nj = כמה)
  if (t.lv === 'red' && FP_RE.test(String(t.fp || ''))) out.fp = t.fp;   // v364: טביעת האצבע של התקלה — לספר התיקונים
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
const NORM_DEF = { 'opus-medium': 6.0, 'opus-high': 8.5, 'opus-max': 13.0, 'sonnet-medium': 3.0, 'sonnet-high': 4.2 };
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
/* עצירה חדשה של המגדל → רשומה (או עוד פעם לרשומה קיימת) */
function fbStop(list, tw, st, now) {
  if (!tw || !FP_RE.test(String(tw.fp || '')) || !TW_WHY.includes(tw.why)) return null;
  const out = fbList(list).map((e) => Object.assign({}, e));
  let e = out.find((x) => x.fp === tw.fp);
  if (!e) { e = { fp: tw.fp, why: tw.why, st: STAGES.includes(st) ? st : '', n: 0, auto: 0, fix: '', at: now }; out.push(e); }
  e.n = (e.n || 0) + 1; e.at = now;
  return out.slice(-FB_MAX);
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
const fbView = (list) => fbList(list).slice().sort((a, b) => (b.at || 0) - (a.at || 0))
  .map((e) => ({ fp: e.fp, why: e.why, st: e.st || '', n: e.n || 0, auto: e.auto || 0, fix: e.fix || '', px: e.px || '', at: e.at || 0 }));

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
  };
}
/* המצב יקר מהמקסימום? לפי הצפוי לשעת סרטון (NORM_DEF): Sonnet Medium < Sonnet High < Opus Medium < Opus High < Opus Max */
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
  };
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
    id: job.id, kind: job.kind, state: job.state, spec: job.spec || null, folder: job.folder || '', files: { a: fileView(job.fa), v: fileView(job.fv) },
    qa: job.qa && job.qa.id ? { id: job.qa.id, q: job.qa.q, a: job.qa.a || null, g: job.qa.g || '' } : null,   // v361: גם השאלה — להמשך בסשן חדש
    ck: Array.isArray(job.ck) ? job.ck.map((c) => ({ s: c.s, id: c.id, size: c.size })) : [] };   // v361: להמשך (מהאחרונה)
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

/* ---------- Firestore (REST) ---------- */
const JSON_FIELDS = ['spec', 'fa', 'fv', 'fo', 'sess', 'prog', 'fh', 'use', 'qa', 'ck', 'use0', 'tw', 'ns', 'fb', 'ls', 'al', 'rl'];
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
  return o;
}

module.exports = {
  ROUTINE_URL_RE, ROUTINE_KEY_RE, JOB_RE, KEY_RE, FILE_ID_RE, KEY_TTL, STAGES, FINAL, ACTIVE, KINDS, WORKER_KINDS,
  MAX_ACTIVE, MAX_STORED, FIRE_HOUR, TEST_GAP,
  normRoutine, hintOf, normSpec, normFile, normOut, OUT_KINDS, normUsage, normAsk, normAnswer, ASK_MAX,
  RULE_BUDGET_MAX, normRules, modeOver, usdOf, GATE_KINDS, GATE_MAX, GATE_WAIT, newGateId, normGate,
  NORM_MIN, NORM_DEF, NORM_FIXED, normSample, addSample, learnedNorm, normsView,
  FB_MAX, FIX_MAX, normFixText, fbList, fbStop, fbFix, fbUsed, fbForWorker, fbView, FIX_MODES, normFixMode, fbDecide,
  CK_STAGES, STALE_MS, RESUME_MAX, normTower, normCk, addCk, lastCk, isStale, canResume, mergeUse, newJobId, newKey, keyHash, keyMatches, fireText, fireError, fireDetail, fireSession, recentFires,
  effState, publicJob, workerJob, applyReport, toFields, fromFields,
};
