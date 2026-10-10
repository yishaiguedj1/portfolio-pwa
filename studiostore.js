/* ת4 — העלאה מהטלפון ל־Cloudflare R2 (במקום Drive), מתחדשת אחרי רענון / ניתוק / יציאה מהאפליקציה.
   הטלפון לא מחזיק שום מפתח: השרתון פותח העלאה בחלקים (Multipart) ונותן קישור חתום לכל חלק (שעה),
   והטלפון שולח כל חלק ישירות ל־R2. ב־R2 כל החלקים חוץ מהאחרון באותו גודל — השרתון קובע אותו (ps) פעם אחת להעלאה.
   "מה כבר הגיע" = השרתון שואל את R2 (ListParts) — לא סומכים על הזיכרון של הטלפון, ולא צריך לקרוא ETag מהדפדפן.
   קישור חתום שפג מחזיר 403 בלי CORS — בדפדפן זה נראה כמו שגיאת רשת (status 0), לכן אחרי כל תקלה מבקשים קישורים חדשים.
   בלי DOM: התלויות מוזרקות (api, put, sleep, now, online) — נבדק ב־node. */

export const MAX_FAILS = 12;               // תקלות רצופות בלי שום חלק שהגיע — ואז מוותרים (בלי רשת לא נספר)
export const URL_TTL_MS = 45 * 60e3;       // קישור לחלק חתום לשעה — מחדשים לפני
const backoff = (n) => Math.min(30000, 1000 * 2 ** Math.min(Math.max(n, 1) - 1, 5));
const abortErr = () => { const e = new Error('aborted'); e.name = 'AbortError'; return e; };
const isAbort = (e) => !!e && (e.name === 'AbortError' || e.code === 'aborted');
function fatal(code) { const e = new Error(code); e.code = code; e.fatal = true; return e; }

/* הגבולות של חלק n (1..N) — טהורה, זהה לחישוב בשרתון (partsCheck ב־lib/r2.js) */
export function partRange(size, ps, n) {
  const start = (n - 1) * ps;
  return { start, end: Math.min(size, start + ps) };
}
export const partCount = (size, ps) => Math.max(1, Math.ceil(size / ps));
/* כמה בייטים כבר בשרת, לפי רשימת החלקים שהגיעו */
export function doneBytes(size, ps, done) {
  let b = 0;
  for (const n of done) { const r = partRange(size, ps, n); b += r.end - r.start; }
  return b;
}

/* העלאה של קובץ אחד. o:
     api(op, body) → JSON מהשרתון; slot — מה מעלים (למשל 'v' / 'a'); job
     blob, size, mime, signal, gate(), onProgress(bytes), onWait(err), onState(st)
     st — מצב שמור מהפעם הקודמת ({ up, ps }) כדי להמשיך את אותה העלאה
   מחזיר את תשובת הסיום של השרתון ({ ok, file }) */
export async function r2Upload(o, env = {}) {
  const E = Object.assign({ sleep: (ms) => new Promise((r) => setTimeout(r, ms)), now: () => Date.now(), online: () => true, conc: 2 }, env);
  const size = o.size;
  let st = Object.assign({}, o.st || {});
  let done = new Set(), urls = new Map(), urlAt = 0, fails = 0;
  const live = new Map();           // חלק בדרך → כמה בייטים ממנו כבר יצאו
  const stopped = () => o.signal && o.signal.aborted;
  const report = () => { if (!o.onProgress) return; let b = doneBytes(size, st.ps, done); for (const v of live.values()) b += v; o.onProgress(Math.min(size, b)); };
  const take = (j) => {
    if (j.up && j.ps) { if (j.up !== st.up || j.ps !== st.ps) { st = { up: j.up, ps: j.ps }; if (o.onState) o.onState(st); } }
    if (Array.isArray(j.done)) done = new Set(j.done.map(Number));
    if (j.urls && typeof j.urls === 'object') { urls = new Map(Object.entries(j.urls).map(([k, v]) => [Number(k), v])); urlAt = E.now(); }
  };
  const missing = () => { const out = []; for (let n = 1; n <= partCount(size, st.ps); n++) if (!done.has(n)) out.push(n); return out; };
  /* פותח / ממשיך: השרתון בודק ב־R2 מה הגיע ומחזיר קישורים לחלקים החסרים (עד כמה עשרות בכל פעם) */
  async function sync() {
    const j = await o.api(st.up ? 'r2parts' : 'r2up', { job: o.job, slot: o.slot, size, type: o.mime || 'application/octet-stream', up: st.up || '' });
    if (j && j.ok) { take(j); return j; }
    const err = (j && j.error) || 'net';
    if (err === 'r2_gone' && st.up) { st = {}; if (o.onState) o.onState(st); return sync(); }     // ההעלאה פגה / בוטלה — מתחילים חדשה
    if (/^(signin|forbidden|bad_|r2_off|not_found|too_big|r2_full)/.test(err)) throw fatal(err);
    throw Object.assign(new Error(err), { code: 'net' });
  }
  async function sendPart(n) {
    const { start, end } = partRange(size, st.ps, n);
    live.set(n, 0);
    try {
      const r = await E.put(urls.get(n), o.blob.slice(start, end), {}, (b) => { live.set(n, Math.min(b, end - start)); report(); }, o.signal);
      if (r.status === 200) { done.add(n); urls.delete(n); return true; }
      if (r.status === 404) throw Object.assign(new Error('r2_gone'), { code: 'net', gone: true });
      if (r.status >= 400 && r.status < 500 && r.status !== 403 && r.status !== 408 && r.status !== 429) throw fatal('r2_http_' + r.status);
      throw Object.assign(new Error(r.stalled ? 'stalled' : 'r2_http_' + r.status), { code: r.stalled ? 'stalled' : 'net' });
    } finally { live.delete(n); report(); }
  }

  for (;;) {
    if (stopped()) throw abortErr();
    if (o.gate) await o.gate();
    try {
      if (!st.up || !urls.size || E.now() - urlAt > URL_TTL_MS) {
        const j = await sync();
        if (j.file) { if (o.onProgress) o.onProgress(size); return j; }     // כבר הושלם (רענון אחרי הסיום)
      }
      report();
      const todo = missing();
      if (!todo.length) {
        const j = await o.api('r2done', { job: o.job, slot: o.slot, up: st.up });
        if (j && j.ok) { if (o.onProgress) o.onProgress(size); return j; }
        if (j && Array.isArray(j.missing) && j.missing.length) { done = new Set([...done].filter((n) => !j.missing.includes(n))); urls.clear(); continue; }
        if (j && j.error === 'r2_gone') { st = {}; if (o.onState) o.onState(st); urls.clear(); continue; }
        throw Object.assign(new Error((j && j.error) || 'net'), { code: 'net' });
      }
      const ready = todo.filter((n) => urls.has(n));
      if (!ready.length) throw Object.assign(new Error('r2_nourls'), { code: 'net' });   // אין קישורים לחלקים החסרים — מבקשים שוב (עם המתנה)
      /* כמה חלקים במקביל: מי שסיים לוקח את הבא */
      let i = 0, sent = 0;
      const worker = async () => { while (i < ready.length) { if (stopped()) throw abortErr(); const n = ready[i++]; if (await sendPart(n)) { sent++; fails = 0; } } };
      await Promise.all(Array.from({ length: Math.min(E.conc, ready.length) }, worker));
      if (!sent) throw Object.assign(new Error('r2_none'), { code: 'net' });
    } catch (e) {
      if (isAbort(e) || stopped()) throw abortErr();
      if (e.fatal) throw e;
      if (e.gone && st.up) { urls.clear(); }
      if (E.online && !E.online()) fails = Math.min(fails, 3);     // בלי רשת מחכים כמה שצריך — זו לא שגיאה
      else fails++;
      if (fails > MAX_FAILS) throw e;
      urls.clear();                                                // אחרי תקלה — קישורים חדשים + "מה הגיע?" מהשרתון
      if (o.onWait) o.onWait(e);
      await E.sleep(backoff(fails || 1));
    }
  }
}
