/* 23/10/2026 (בקשת המשתמש: "העלאה שממשיכה גם כשהאפליקציה סגורה"): הסרטון עולה ב־Background Fetch של Chrome.
   ההעלאה עוברת לדפדפן עצמו (התראת התקדמות של המערכת), וממשיכה גם כשסוגרים את Studio או כשהמסך כבה — בניגוד להעלאה
   הרגילה, שהאטה ל־0.8MB/שנ׳ כשהדף היה ברקע (יומני הייצור, 23/10).
   רק בעבודה ששומרת ב־R2 (מצב השרת), רק לסרטון גדול, ורק כשיש נתיב /up באותו מקור (functions/up.js — Chrome לא שולח
   ב־Background Fetch בקשה שצריכה CORS preflight). כל חלק = POST אחד ל־/up עם הקישור החתום שלו (השרתון: op:'r2bg').
   בסוף ההעלאה ה־service worker מסיים אותה ורושם את הסרטון בשרתון (sw.js → op:'r2bgDone'), גם בלי הדף.
   **כל כישלון = ההעלאה הרגילה** (r2Upload) — היא שואלת את השרתון מה הגיע וממשיכה מהחלקים החסרים, ואם הכל כבר שם — רק סוגרת.
   בלי DOM — התלויות מוזרקות (env), נבדק ב־node (tests/studio-bgup.test.js). */
export const BG_MIN = 64 * 1024 * 1024;            // סרטון קטן מזה — ההעלאה הרגילה מספיקה (פחות מחלק אחד של Background Fetch)
export const BG_PREFIX = 'snbup-';                 // מזהה ה־Background Fetch = BG_PREFIX + מזהה העבודה (סרטון אחד לעבודה)
export const BG_DB = 'snb-bgup';                   // מה שה־service worker צריך כדי לסיים: העבודה, הקובץ, מפתח הסיום, השרתון, השפה
/* 24/10/2026 (בטלפון: ההתראה עמדה על 0% עד הסוף): Chrome מראה התקדמות לפי גודל רק כש־downloadTotal > 0 — ואז הסכום הוא
   ההורדה + ההעלאה, וגם בתים שבדרך נספרים. התשובה של /up לכל חלק היא JSON קטן, ולכן מצהירים על תקרה נדיבה לכל חלק:
   הצהרה גבוהה מדי לא מזיקה (בסוף Chrome מצמיד את הסכום למה שהגיע), נמוכה מדי — Chrome מכשיל את ההעלאה. */
export const BG_RESP_MAX = 4096;
const JOB_RE = /^j[A-Za-z0-9_-]{20}$/;

export const bgIdOf = (job) => (JOB_RE.test(String(job || '')) ? BG_PREFIX + job : '');
export const jobOfBgId = (id) => { const j = String(id || '').slice(BG_PREFIX.length); return String(id || '').startsWith(BG_PREFIX) && JOB_RE.test(j) ? j : ''; };

/* מתי מנסים (טהורה): r2 — העבודה ב־R2; ext — סרטון מ־Drive (אין מה להעלות); wifi — "רק ב־Wi‑Fi" (Background Fetch לא שומע
   את ההגדרה); off — הטלפון כבר הראה שהוא לא תומך (נשמר בהגדרות) */
export function bgEligible({ size, r2, ext, wifi, off, api, up }) {
  return !!(r2 && !ext && !wifi && !off && api && up && Number(size) >= BG_MIN);
}

/* יש נתיב /up באותו מקור (functions/up.js; ב־GitHub Pages אין — 404) — פעם אחת לטעינה */
let upP = null;
export function bgUpOk(f) {
  if (!upP) upP = Promise.resolve().then(() => (f || fetch)('/up', { cache: 'no-store' })).then((r) => (r && r.ok ? r.json() : null))
    .then((j) => !!(j && j.up === 1), () => false);
  return upP;
}

/* השרתונים שה־service worker ינסה לפי הסדר: הכתובת של הדף, ובייצור גם הגיבוי ב־Vercel (כמו installFailover) */
const PROD_API = 'https://api.thesnowball.app', VERCEL = 'https://ibkr-proxy-wine.vercel.app';
export const bgApis = (base) => (base === PROD_API ? [PROD_API, VERCEL] : base ? [base] : []);

/* הבקשות: חלק לכל קישור שהשרתון נתן, לפי הסדר. ps = גודל החלק (כולם חוץ מהאחרון) */
export function bgPlan(size, ps, urls) {
  const out = [];
  for (const k of Object.keys(urls || {}).map(Number).filter((n) => Number.isInteger(n) && n >= 1).sort((a, b) => a - b)) {
    const start = (k - 1) * ps, end = Math.min(size, start + ps);
    if (start < size) out.push({ n: k, start, end, url: urls[k] });
  }
  return out;
}

/* env: { reg() → ServiceWorkerRegistration, Request, put(rec), del(id), base(), lang(), now() }
   o: { api, job, name, blob, size, mime, st, onState, onProgress, signal, title, icon }
   מחזיר { ok:true } כשה־Background Fetch הסתיים בהצלחה, { fallback: '<סיבה>' } כשצריך את ההעלאה הרגילה,
   { unsupported: true } כשהדפדפן לא מקבל העלאה כזו (לא לנסות שוב בטלפון הזה) */
export async function bgUpload(o, env) {
  const id = bgIdOf(o.job);
  if (!id) return { fallback: 'bad_job' };
  let reg;
  try { reg = await env.reg(); } catch (e) { reg = null; }
  if (!reg || !reg.backgroundFetch) return { unsupported: true };
  let bg = null;
  try { bg = await reg.backgroundFetch.get(id); } catch (e) { bg = null; }
  if (!bg || bg.result) {
    if (bg && bg.result === 'success') return { ok: true };   // הסתיים כשהדף היה סגור — ההעלאה הרגילה רק תסגור / תאשר
    const j = await o.api('r2bg', { job: o.job, id: (o.st && o.st.id) || '', size: o.size, type: o.mime || 'application/octet-stream', name: o.name || '' });
    if (!j || !j.ok) return { fallback: (j && j.error) || 'net' };
    if (j.file) return { ok: true };
    if (o.onState) o.onState({ id: j.id, up: j.up, ps: j.ps });
    const plan = bgPlan(o.size, j.ps, j.urls);
    if (!plan.length) return { ok: true };
    await env.put({ id, job: o.job, fid: j.id, up: j.up, fk: j.fk, apis: bgApis(env.base()), l: env.lang(), at: env.now(), exp: j.exp || 0 });
    const reqs = plan.map((p) => new env.Request('/up?u=' + encodeURIComponent(p.url), { method: 'POST', body: o.blob.slice(p.start, p.end),
      headers: { 'Content-Type': 'application/octet-stream' } }));
    try {
      bg = await reg.backgroundFetch.fetch(id, reqs, { title: o.title || 'Studio', downloadTotal: plan.length * BG_RESP_MAX, icons: o.icon ? [{ src: o.icon, sizes: '192x192', type: 'image/png' }] : [] });
    } catch (e) {
      await env.del(id);
      return /TypeError/.test(String(e && e.name)) || /body|upload|not supported/i.test(String(e && e.message)) ? { unsupported: true } : { fallback: 'bg_start' };
    }
  }
  /* מחכים לסוף — עם התקדמות. ביטול (עצירה / מחיקה) = מבטלים גם אצל הדפדפן */
  return new Promise((resolve) => {
    let fin = false;
    const tick = () => {
      if (fin) return;
      // מה שהגיע לפני ה־Background Fetch הזה (חלקים שהשרתון כבר ראה) = הגודל פחות מה שהוא צריך להעלות
      const base = Math.max(0, o.size - (bg.uploadTotal || o.size));
      if (o.onProgress) o.onProgress(Math.min(o.size, base + (bg.uploaded || 0)));
      if (bg.result) { fin = true; cleanup(); resolve(bg.result === 'success' ? { ok: true } : { fallback: 'bg_' + (bg.failureReason || 'fail') }); }
    };
    const iv = setInterval(tick, 2000);   // גם בלי אירוע progress (חלק Chrome לא שולחים אחרי הסיום)
    const onAbort = () => { if (fin) return; fin = true; cleanup(); try { bg.abort(); } catch (e) {} resolve({ aborted: true }); };
    const cleanup = () => { clearInterval(iv); try { bg.removeEventListener('progress', tick); } catch (e) {} if (o.signal) o.signal.removeEventListener('abort', onAbort); };
    try { bg.addEventListener('progress', tick); } catch (e) {}
    if (o.signal) { if (o.signal.aborted) return onAbort(); o.signal.addEventListener('abort', onAbort, { once: true }); }
    tick();
  });
}

/* IndexedDB קטן ומשלו (כמו snb-inbox של שיתוף הקבצים) — בלי לגעת בגרסה של snb-studio */
export function bgDb(idb) {
  const open = () => new Promise((ok, no) => {
    const r = idb.open(BG_DB, 1);
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('u')) r.result.createObjectStore('u'); };
    r.onerror = () => no(r.error);
    r.onsuccess = () => ok(r.result);
  });
  const tx = (mode, fn) => open().then((db) => new Promise((ok, no) => {
    const t = db.transaction('u', mode); const st = t.objectStore('u'); const r = fn(st);
    t.oncomplete = () => ok(r && 'result' in r ? r.result : undefined); t.onerror = () => no(t.error);
  }));
  return {
    put: (rec) => tx('readwrite', (s) => s.put(rec, rec.id)),
    get: (id) => tx('readonly', (s) => s.get(id)),
    del: (id) => tx('readwrite', (s) => s.delete(id)),
  };
}
