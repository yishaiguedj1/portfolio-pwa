/* סטודיו התרגום — כל מה שמדבר עם הרשת (שלב 2, v355). studio.js (הממשק) לא פונה לרשת בעצמו.
   1. השרתון (/api/studio): החיבור ל־Claude, עבודות, גישה זמנית ל־Drive. האימות = ההתחברות של האפליקציה (Firebase).
   2. Google Drive של המשתמש: תיקייה "THE SNOWBALL — סטודיו" ובתוכה תיקייה לכל פרויקט. העלאה מתחדשת (resumable)
      ישירות מהטלפון ל־Drive: הסרטון לא עובר בשרתון ולא נטען כולו לזיכרון — כל פעם נקראת רק החתיכה הנוכחית (Blob.slice),
      ולכן גם קובץ של כמה GB עולה בלי בעיה. כתובת ההעלאה תקפה שבוע: נפל החיבור / רענון → שואלים "כמה הגיע?" וממשיכים
      מאותו בייט. גודל החתיכה מסתגל למהירות (כפולה של 256KB, כמו ש־Drive דורש).
   3. חילוץ הקול בטלפון בלי קידוד מחדש (Mediabunny, vendor/mediabunny — נטען רק כשמתחילים עבודה).
   4. מודל הזמנים של מסך ההתקדמות (טהור).
   בלי DOM: התלויות מוזרקות (createNet(env)), ו־tests/studio-v355 בודק את המנוע ב־node עם Drive מדומה. */

const UP = 'https://www.googleapis.com/upload/drive/v3/files';
const API = 'https://www.googleapis.com/drive/v3/files';
const FOLDER = 'application/vnd.google-apps.folder';
export const ROOT_NAME = 'THE SNOWBALL — סטודיו';
const K256 = 256 * 1024;
export const CHUNK_MIN = 4 * K256, CHUNK_MAX = 128 * K256, CHUNK_START = 16 * K256;   // 1MB · 32MB · 4MB
const STALL_MS = 45000;          // חתיכה בלי שום התקדמות 45 שניות = החיבור נתקע → מנסים שוב
const MAX_FAILS = 12;            // ברצף, כשיש רשת — אחרי זה שגיאה גלויה (והמשתמש יכול "לנסות שוב")
export const STAGES = ['up', 'tr', 'al', 'tl', 'rv', 'bn', 'sv'];

/* ---------------- טהורות ---------------- */
/* "bytes=0-1048575" → 1048576 = הבייט הבא לשלוח. בלי כותרת = עוד לא הגיע כלום */
export function rangeNext(range) { const m = /bytes=(\d+)-(\d+)/.exec(String(range || '')); return m ? +m[2] + 1 : 0; }
export const backoff = (n) => Math.min(30000, 1000 * 2 ** Math.min(Math.max(n, 1) - 1, 5));
/* חתיכה של כ־15 שניות לפי המהירות שנמדדה — לא קטנה מ־1MB ולא גדולה מ־32MB, בכפולות של 256KB */
export function nextChunk(bytesPerSec) {
  if (!(bytesPerSec > 0)) return CHUNK_START;
  return Math.max(CHUNK_MIN, Math.min(CHUNK_MAX, Math.round(bytesPerSec * 15 / K256) * K256));
}
/* v380: זיכרון המונחים — מילון אחד לכל משתמש, קובץ TSV בתיקיית הסטודיו ב־Drive (appProperties snbGloss=1).
   אותו פורמט של tr/glossary.tsv של vt: אנגלית<TAB>עברית (חלופות ב־/)[<TAB>הערה]. glClean/glParse זהים ל־gl_clean/gl_parse
   בעובד (job.py) ול־glClean בשרתון — tests/studio-v380 משווה */
export const GL_MAX = 400, GL_NAME = 'מילון מונחים.tsv';
const GL_HEAD = '# מילון המונחים של סטודיו התרגום — אנגלית<TAB>עברית (חלופות מופרדות ב־/)<TAB>הערה. כל עבודה מקבלת רק את המונחים שמופיעים בסרטון.\n';
export function glClean(v, n) {
  const s = String(v == null ? '' : v).replace(/[\x00-\x1f\x7f<>`]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.includes('://') ? '' : s.slice(0, n);
}
export function glParse(text) {
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
export const glFormat = (rows) => GL_HEAD + rows.map((r) => r[0] + '\t' + r[1] + (r[2] ? '\t' + r[2] : '')).join('\n') + (rows.length ? '\n' : '');
/* הוספה/עדכון (אותו מונח באנגלית — בלי תלות באותיות גדולות — מתעדכן), עד GL_MAX. מחזיר מערך חדש */
export function glUpsert(rows, add) {
  const out = rows.map((r) => r.slice());
  for (const a of add) {
    const en = glClean(a[0], 60), he = glClean(a[1], 80), n = glClean(a[2], 100);
    if (!en || !he) continue;
    const i = out.findIndex((r) => r[0].toLowerCase() === en.toLowerCase());
    if (i >= 0) out[i] = [en, he, n]; else if (out.length < GL_MAX) out.push([en, he, n]);
  }
  return out;
}

/* זמן משוער לכל שלב, בשניות. מהתוכנית: ראיון של 77 דק׳ ב־Opus 5.5 · Medium = תמלול 8, יישור 5, תרגום 50, בדיקה 12,
   צריבה 23, שמירה 3 דקות. כלומר דקות עבודה לכל דקת סרטון. התרגום והבדיקה גדלים/קטנים לפי המצב (min של המצב מול 105 של
   המומלץ); השאר לא תלוי במצב. ההעלאה נמדדת בטלפון. כשהעבודות האמיתיות יצטברו — הקצב יכויל מהן (שלב 3). */
const RATE = { tr: 8 / 77, al: 5 / 77, tl: 50 / 77, rv: 12 / 77, bn: 23 / 77, sv: 3 / 77 };
export function stageEstimates(modeMin, durSec) {
  const durMin = (durSec > 0 ? durSec : 3600) / 60, k = (modeMin > 0 ? modeMin : 105) / 105;
  const out = {};
  for (const s of STAGES.slice(1)) out[s] = Math.round(RATE[s] * durMin * (s === 'tl' || s === 'rv' ? k : 1) * 60);
  return out;
}
/* 10/10/2026: צפי נלמד (studioeta.js בשרתון). העבודה מקבלת בלקיחה תוכנית (ep: p50 לכל שלב + אי־ודאות);
   לעבודה שעוד לא נלקחה — המודל מ־status. planFrom = planOf בשרתון (tests/studio-eta.test.js משווה). */
export const Q_DEF = [0, 0.295, 0.449];          // לפני 8 עבודות: σ=0.35 → p80 = ×1.34, p90 = ×1.57 (זהה לשרתון)
const ETA_ST = ['tr', 'al', 'tl', 'rv', 'bn', 'sv'];
export function planFrom(model, modeMin, durSec) {
  if (!model || !model.st) return null;
  const m = (durSec > 0 ? durSec : 3600) / 60, k = (modeMin > 0 ? modeMin : 105) / 105, s = {};
  let t = 0;
  for (const x of ETA_ST) {
    const ab = model.st[x];
    if (!Array.isArray(ab)) return null;
    s[x] = Math.round((ab[0] + ab[1] * m) * ((x === 'tl' || x === 'rv') ? k : 1));
    t += s[x];
  }
  return { s, t, q: Array.isArray(model.q) && model.q.length === 3 ? model.q : Q_DEF, n: model.n || 0 };
}
/* מצב המסך: לכל שלב — הסתיים (כמה לקח) / עכשיו (כמה נשאר + אחוז) / מחכה (הערכה). והסכום: כמה נשאר בסך הכל.
   10/10/2026 (מחקר הצפי): השלב הנוכחי = שילוב של ההערכה עם הקצב בפועל לפי כמה התקדם (w = p/(p+0.15));
   שלבים שלא התחילו = ההערכה × ‎√ρ (ρ = בפועל/צפוי של השלבים שכבר הסתיימו בעבודה הזו — עומס בשרת משפיע על כולם);
   left = p50, left80/left90 = לפי אי־ודאות העבר, שמצטמצמת ככל שמתקדמים.
   job = מה שהשרתון מחזיר (prog.stg: זמני התחלה וסיום אמיתיים מהעובד); up = מצב ההעלאה בטלפון {p, left, done} */
export function progressModel(job, est, up, now, q) {
  const prog = (job && job.prog) || {};
  const stg = prog.stg || {};
  const cur = prog.st || '';
  const ended = job && job.state === 'done';
  // v361: נכשלה / בוטלה — השלב שבו נעצרה נסגר בשרתון, אבל הוא לא "הושלם" (בלי ✓; "המשך" פותח אותו מחדש)
  const stopped = job && (job.state === 'failed' || job.state === 'cancelled');
  const qq = Array.isArray(q) && q.length === 3 ? q : Q_DEF;
  // ρ: כמה לקחו השלבים שהסתיימו מול ההערכה שלהם (0.5–3)
  let dT = 0, dE = 0;
  for (const s of STAGES) {
    if (s === 'up' || !(stg[s] && stg[s].e && stg[s].s)) continue;
    dT += Math.max(0, (stg[s].e - stg[s].s) / 1000); dE += est[s] || 60;
  }
  const rho = dE > 0 && dT > 0 ? Math.max(0.5, Math.min(3, dT / dE)) : 1, adj = Math.sqrt(rho);
  const stages = [];
  let left = 0, doneW = 0, allW = 0;
  for (const s of STAGES) {
    const e0 = s === 'up' ? Math.max(30, up && up.est ? up.est : 60) : est[s] || 60;
    const e = s === 'up' ? e0 : Math.round(e0 * adj);
    allW += e0;
    let row;
    if (s === 'up') {
      if (up && up.done) row = { id: s, state: 'done', took: up.took || 0 };
      else row = { id: s, state: up && up.active ? 'now' : 'wait', left: up && up.left > 0 ? up.left : e, p: up ? up.p || 0 : 0, est: e };
    } else if (stopped && s === cur) row = { id: s, state: 'wait', est: e };
    else if (ended || (stg[s] && stg[s].e)) row = { id: s, state: 'done', took: stg[s] && stg[s].e ? Math.max(0, Math.round((stg[s].e - stg[s].s) / 1000)) : 0 };
    else if (s === cur && stg[s]) {
      const el = Math.max(0, (now - stg[s].s) / 1000), p = Math.max(0, Math.min(0.99, prog.p || 0));
      // העובד יודע הכי טוב (eta); אחרת שילוב: ההערכה בהתחלה, הקצב בפועל ככל שמתקדמים (לא קופצים מיד לקצב — הוא רועש בהתחלה)
      let l;
      if (prog.eta != null) l = Math.max(0, prog.eta - Math.max(0, (now - (prog.at || now)) / 1000));
      else {
        const w = p > 0 ? p / (p + 0.15) : 0, tot = (1 - w) * e + (p > 0 ? w * el / p : 0);
        l = tot - el;
      }
      l = Math.max(10, Math.round(l));
      row = { id: s, state: 'now', left: l, p, est: e, slow: el > e * 1.5 && el > 300 };
    } else row = { id: s, state: 'wait', est: e };
    if (row.state === 'done') doneW += e0;
    else if (row.state === 'now') { left += row.left; doneW += e0 * (row.p || 0); }
    else left += row.est;
    stages.push(row);
  }
  const pct = ended ? 1 : Math.max(0, Math.min(0.99, doneW / allW));
  const k = (i) => Math.exp((qq[i] || 0) * (1 - pct));   // האי־ודאות קטנה ככל שנשאר פחות
  const l50 = ended ? 0 : Math.round(left * k(0));
  return { stages, left: l50, left80: ended ? 0 : Math.max(l50, Math.round(left * k(1))), left90: ended ? 0 : Math.max(l50, Math.round(left * k(2))), pct, rho };
}

const abortErr = () => { const e = new Error('aborted'); e.name = 'AbortError'; return e; };
const isAbort = (e) => !!e && (e.name === 'AbortError' || e.code === 'aborted');
function fatal(code) { const e = new Error(code); e.code = code; e.fatal = true; return e; }
async function driveErr(r) {
  let j = null; try { j = await r.json(); } catch (e) {}
  const reason = (((j && j.error && j.error.errors) || [])[0] || {}).reason || '';
  if (/storageQuotaExceeded|quotaExceeded/.test(reason)) return fatal('drive_full');
  const e = new Error('drive_http_' + r.status); e.code = e.message; e.status = r.status; return e;
}

/* PUT של חתיכה עם התקדמות בתוך החתיכה (XHR — ל־fetch אין התקדמות העלאה) וזיהוי חיבור תקוע.
   Drive מחזיר 308 בלי Location ("עוד לא הסתיים") — XHR מחזיר אותו כמו שהוא, עם כותרת Range. */
export function xhrPut(url, body, headers, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    let last = Date.now(), stalled = false, user = false;
    const tick = setInterval(() => { if (Date.now() - last > STALL_MS) { stalled = true; x.abort(); } }, 5000);
    const end = () => clearInterval(tick);
    x.open('PUT', url);
    for (const [k, v] of Object.entries(headers || {})) x.setRequestHeader(k, v);
    if (x.upload) x.upload.onprogress = (e) => { last = Date.now(); if (onProgress) onProgress(e.loaded); };
    x.onload = () => { end(); let json = null; try { json = JSON.parse(x.responseText || 'null'); } catch (e) {} resolve({ status: x.status, range: x.getResponseHeader('Range'), json }); };
    x.onerror = () => { end(); resolve({ status: 0 }); };
    x.onabort = () => { end(); if (user) reject(abortErr()); else resolve({ status: 0, stalled }); };
    if (signal) {
      if (signal.aborted) { end(); reject(abortErr()); return; }
      signal.addEventListener('abort', () => { user = true; x.abort(); }, { once: true });
    }
    x.send(body == null ? null : body);
  });
}

/* ---------------- חילוץ הקול (Mediabunny) ---------------- */
const MB_URL = './vendor/mediabunny/mediabunny.min.mjs';
let mbLoad = null;
export const loadMediabunny = () => (mbLoad = mbLoad || import(MB_URL).catch((e) => { mbLoad = null; throw e; }));
/* קריאה מהירה (פחות משנייה גם לקובץ ענק — רק הכותרות): אורך + האם יש קול */
export async function probeVideo(file, load) {
  try {
    const MB = await (load || loadMediabunny)();
    const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(file) });
    const dur = await input.computeDuration();
    const at = await input.getPrimaryAudioTrack();
    return { dur: Number.isFinite(dur) ? Math.round(dur) : 0, audio: at ? String(at.codec || '') : '' };
  } catch (e) { return { dur: 0, audio: '', err: 'probe' }; }
}
/* רצועת הקול בלי קידוד מחדש (העתקה) — Opus/Vorbis ל־WebM, כל השאר ל־M4A (המיכל שהספייק בדק על הראיון של אקמן).
   כשההעתקה בלתי אפשרית (קודק שהמיכל לא מקבל, ואין מקודד בדפדפן) — בלי קול, והעבודה מתחילה מהסרטון המלא */
export async function extractAudio(file, o = {}) {
  const MB = await (o.load || loadMediabunny)();
  const input = new MB.Input({ formats: MB.ALL_FORMATS, source: new MB.BlobSource(file) });
  const at = await input.getPrimaryAudioTrack();
  if (!at) return { none: 'no_audio' };
  const webm = at.codec === 'opus' || at.codec === 'vorbis';
  const output = new MB.Output({ format: webm ? new MB.WebMOutputFormat() : new MB.Mp4OutputFormat(), target: new MB.BufferTarget() });
  const conv = await MB.Conversion.init({ input, output, video: { discard: true }, showWarnings: false });
  if (!conv.isValid) return { none: 'codec' };
  if (o.onProgress) conv.onProgress = (p) => o.onProgress(Math.max(0, Math.min(1, p)));
  if (o.signal) { if (o.signal.aborted) throw abortErr(); o.signal.addEventListener('abort', () => { conv.cancel().catch(() => {}); }, { once: true }); }
  await conv.execute();
  if (o.signal && o.signal.aborted) throw abortErr();
  const buf = output.target.buffer;
  return { blob: new Blob([buf], { type: webm ? 'audio/webm' : 'audio/mp4' }), ext: webm ? 'webm' : 'm4a', codec: String(at.codec || '') };
}

/* ---------------- השרתון + Drive ---------------- */
/* ---------- v387: סט הזהב — השוואה דטרמיניסטית לתרגום אנושי (בלי AI, בלי טוקנים) ---------- */
export const GOLD_REF_NAME = 'תרגום אנושי (ייחוס).srt', GOLD_REF_MAX = 2 * 1024 * 1024;
const tc = (h, m, s, ms) => ((+h * 60 + +m) * 60 + +s) * 1000 + +ms;
/* SRT → [{a, b, t}] (מילישניות, טקסט בלי תגיות). שורה פגומה — מדלגים */
export function parseSrt(text) {
  const out = [];
  const blocks = String(text || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const b of blocks) {
    const lines = b.split('\n').filter((l) => l.trim() !== '');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const m = /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/.exec(lines[i]);
    if (!m) continue;
    const t = lines.slice(i + 1).join(' ').replace(/<[^>]*>/g, '').replace(/\{[^}]*\}/g, '').replace(/\s+/g, ' ').trim();
    const a = tc(m[1], m[2], m[3], m[4].padEnd(3, '0')), z = tc(m[5], m[6], m[7], m[8].padEnd(3, '0'));
    if (z > a && t) out.push({ a, b: z, t });
  }
  return out.sort((x, y) => x.a - y.a);
}
/* chrF++ — port זהה ל־translator/tedeval.py (תואם sacrebleu: nc 6, nw 2, β 2, בלי lowercase, בלי רווחים בתווים).
   מאגר המדידות ו"סט הזהב" מודדים באותה נוסחה; שינוי כאן = גם שם (tests/studio-v387 בודק את אותם ערכי sacrebleu) */
const CHRF_PUNCT = new Set(Array.from('!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~'));
function chrfWords(s) {
  const out = [];
  for (const w of String(s).split(/\s+/).filter(Boolean)) {
    const a = Array.from(w);
    if (a.length === 1) out.push(w);
    else if (CHRF_PUNCT.has(a[a.length - 1])) out.push(a.slice(0, -1).join(''), a[a.length - 1]);
    else if (CHRF_PUNCT.has(a[0])) out.push(a[0], a.slice(1).join(''));
    else out.push(w);
  }
  return out;
}
function ngramStat(h, r, n) {
  const count = (a) => { const m = new Map(); for (let i = 0; i + n <= a.length; i++) { const g = a.slice(i, i + n).join('\u0001'); m.set(g, (m.get(g) || 0) + 1); } return m; };
  const gh = count(h), gr = count(r);
  let th = 0, tr = 0, mt = 0;
  for (const v of gh.values()) th += v;
  for (const v of gr.values()) tr += v;
  for (const [g, v] of gh) mt += Math.min(v, gr.get(g) || 0);
  return [mt, th, tr];
}
export function chrfpp(hyp, ref, nc = 6, nw = 2, beta = 2) {
  const ch = Array.from(String(hyp || '').split(/\s+/).join('')), cr = Array.from(String(ref || '').split(/\s+/).join(''));
  const hw = chrfWords(hyp || ''), rw = chrfWords(ref || ''), st = [];
  for (let n = 1; n <= nc; n++) st.push(ngramStat(ch, cr, n));
  for (let n = 1; n <= nw; n++) st.push(ngramStat(hw, rw, n));
  let ap = 0, ar = 0, eff = 0;
  for (const [m, ht, rt] of st) if (ht > 0 && rt > 0) { ap += m / ht; ar += m / rt; eff++; }
  if (!eff) return 0;
  ap /= eff; ar /= eff;
  if (ap + ar === 0) return 0;
  const b2 = beta * beta;
  return 100 * (1 + b2) * ap * ar / (b2 * ap + ar);
}
/* נרמול עברית לפני השוואה — זהה ל־norm_he: תווי כיוון וניקוד החוצה, גרשיים/מקף/שלוש־נקודות אחידים */
export function normHe(s) {
  return String(s || '').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g, '').replace(/[\u05b0-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]/g, '')
    .replace(/[״“”]/g, '"').replace(/[׳‘’]/g, "'").replace(/[־–—]/g, '-').replace(/…/g, '...').split(/\s+/).filter(Boolean).join(' ');
}
const SOUND_ONLY = /^[\s(\[][^)\]]*[)\]][\s.!?]*$/;     // (מחיאות כפיים) — יורדת משני הצדדים, כמו ב־tedeval
/* כמה מזמן הדיבור בתרגום האנושי מכוסה בכתוביות שלנו (%) */
export function timeCover(hyp, ref) {
  let tot = 0, cov = 0;
  for (const c of ref) {
    tot += c.b - c.a;
    for (const x of hyp) { if (x.b <= c.a) continue; if (x.a >= c.b) break; cov += Math.min(c.b, x.b) - Math.max(c.a, x.a); }
  }
  return tot ? Math.round(Math.min(1, cov / tot) * 1000) / 10 : 0;
}
/* הציון של עבודה מול הייחוס (כמו chrf_doc של tedeval): s = chrF++ על כל הטקסט המנורמל לפי סדר הזמן
   (בלי כתוביות של צלילים, ובלי שלנו לפני הכתובית הראשונה בייחוס), tm = כיסוי הזמן, n = כתוביות בייחוס */
export function goldCompare(hypText, refText) {
  const r = parseSrt(refText).filter((c) => !SOUND_ONLY.test(c.t));
  if (!r.length) return null;
  const h = parseSrt(hypText).filter((c) => !SOUND_ONLY.test(c.t) && (c.a + c.b) / 2 >= r[0].a);
  const doc = (cs) => normHe(cs.map((c) => c.t).join(' '));
  return { s: Math.round(chrfpp(doc(h), doc(r))), tm: Math.round(timeCover(h, r)), n: r.length };
}

export function createNet(env) {
  const E = Object.assign({ fetch: (...a) => fetch(...a), now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), put: xhrPut }, env);
  let dtok = null;      // { at, exp } — גישה זמנית ל־Drive (שעה), רק בזיכרון

  async function api(op, body) {
    let tk = '';
    try { tk = await E.idToken(); } catch (e) {}
    if (!tk) return { ok: false, error: 'signin' };
    let r;
    try {
      r = await E.fetch(E.base() + '/api/studio', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, E.headers ? E.headers() : {}),
        body: JSON.stringify(Object.assign({}, body || {}, { op, idToken: tk })) });
    } catch (e) { return { ok: false, error: 'net' }; }
    let j = null; try { j = await r.json(); } catch (e) {}
    return j && typeof j === 'object' ? j : { ok: false, error: 'http_' + r.status };
  }

  async function driveToken(force) {
    if (!force && dtok && dtok.exp - 120e3 > E.now()) return dtok.at;
    const j = await api('drive');
    if (!j.ok || !j.token) { const e = new Error(j.error || 'drive'); e.code = j.error || 'drive'; e.fatal = j.error === 'not_connected' || j.error === 'revoked' || j.error === 'not_allowed'; throw e; }
    dtok = { at: j.token, exp: Math.min(j.exp || 0, E.now() + 3500e3) || E.now() + 3000e3 };
    return dtok.at;
  }
  /* בקשה ל־Drive עם הגישה הזמנית: 401 = גישה חדשה פעם אחת; 429/5xx = עוד שני ניסיונות */
  async function dreq(method, url, body) {
    let force = false;
    for (let a = 0; ; a++) {
      const r = await E.fetch(url, { method, body: body ? JSON.stringify(body) : undefined,
        headers: Object.assign({ Authorization: 'Bearer ' + await driveToken(force) }, body ? { 'Content-Type': 'application/json; charset=UTF-8' } : {}) });
      force = false;
      if (r.status === 401 && a === 0) { force = true; continue; }
      if ((r.status === 429 || r.status >= 500) && a < 2) { await E.sleep(800 * (a + 1)); continue; }
      if (r.status < 200 || r.status >= 300) throw await driveErr(r);
      return r.json();
    }
  }
  const q = (s) => encodeURIComponent(s);
  async function folder(name, key, val, parent, description) {
    const qs = "appProperties has { key='" + key + "' and value='" + val + "' } and trashed=false and mimeType='" + FOLDER + "'" + (parent ? " and '" + parent + "' in parents" : '');
    const j = await dreq('GET', API + '?q=' + q(qs) + '&fields=files(id)&pageSize=5&spaces=drive');
    if (j && j.files && j.files.length) return j.files[0].id;
    const meta = { name, mimeType: FOLDER, appProperties: { [key]: val } };
    if (parent) meta.parents = [parent];
    if (description) meta.description = description;
    return (await dreq('POST', API + '?fields=id', meta)).id;
  }
  /* תיקיית הפרויקט (נמצאת לפי המזהה — גם אחרי רענון / ממכשיר אחר, בלי ליצור כפילות) */
  async function jobFolder(jobId, title) {
    const root = await folder(ROOT_NAME, 'snbStudio', '1', '', 'הסרטונים והתרגומים של סטודיו התרגום ב־THE SNOWBALL.');
    return folder(String(title || jobId).slice(0, 180), 'snbJob', jobId, root);
  }
  async function initUpload(meta, size, mime) {
    for (let a = 0; a < 2; a++) {
      const r = await E.fetch(UP + '?uploadType=resumable&fields=id,name,size,mimeType,parents', { method: 'POST',
        headers: { Authorization: 'Bearer ' + await driveToken(a > 0), 'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mime || 'application/octet-stream', 'X-Upload-Content-Length': String(size) },
        body: JSON.stringify(meta) });
      if (r.status === 401 && a === 0) continue;
      const loc = r.headers && r.headers.get ? r.headers.get('Location') : '';
      if (r.status >= 200 && r.status < 300 && loc) return loc;
      throw await driveErr(r);
    }
    throw fatal('drive_auth');
  }

  /* העלאה של קובץ אחד. o: { blob, size, mime, meta, uri, onUri, onProgress(bytes), onWait(why|err), gate(), signal }
     מחזיר את הקובץ ש־Drive יצר ({ id, name, size, mimeType, parents }). אפשר לעצור (signal) ולהמשיך אחר כך עם אותה כתובת */
  async function upload(o) {
    const size = o.size, mime = o.mime || 'application/octet-stream';
    let uri = o.uri || '', next = 0, fails = 0, need = !!uri, chunk = CHUNK_START;
    const stopped = () => o.signal && o.signal.aborted;
    for (;;) {
      if (stopped()) throw abortErr();
      if (o.gate) await o.gate();
      try {
        if (!uri) { uri = await initUpload(o.meta, size, mime); next = 0; need = false; if (o.onUri) o.onUri(uri); }
        if (need) {           // "כמה הגיע?" — אחרי רענון, אחרי תקלה, ואחרי חיבור שנתקע
          const s = await E.put(uri, null, { 'Content-Range': 'bytes */' + size }, null, o.signal);
          if (s.status === 200 || s.status === 201) { if (o.onProgress) o.onProgress(size); return s.json || {}; }
          if (s.status === 404 || s.status === 410) { uri = ''; continue; }      // הכתובת פגה (שבוע) — מתחילים כתובת חדשה
          if (s.status !== 308) throw Object.assign(new Error('drive_http_' + s.status), { code: 'drive_http_' + s.status });
          next = rangeNext(s.range); need = false;
          if (o.onProgress) o.onProgress(next);
        }
        if (next >= size) throw Object.assign(new Error('drive_range'), { code: 'net' });   // הכל הגיע אבל לא נסגר — שואלים שוב
        const end = Math.min(size, next + chunk) - 1;
        const t0 = E.now(), start = next;
        const r = await E.put(uri, o.blob.slice(start, end + 1), { 'Content-Range': 'bytes ' + start + '-' + end + '/' + size, 'Content-Type': mime },
          (b) => { if (o.onProgress) o.onProgress(start + Math.min(b, end + 1 - start)); }, o.signal);
        if (r.status === 200 || r.status === 201) { if (o.onProgress) o.onProgress(size); return r.json || {}; }
        if (r.status === 308) {
          const got = rangeNext(r.range);
          if (got > start) { fails = 0; chunk = nextChunk((got - start) / Math.max(0.2, (E.now() - t0) / 1000)); }
          next = got;
          if (o.onProgress) o.onProgress(next);
          continue;
        }
        if (r.status === 404 || r.status === 410) { uri = ''; continue; }
        if (r.status === 403) { let reason = ''; try { reason = JSON.stringify(r.json || ''); } catch (e) {} if (/storageQuotaExceeded|quotaExceeded/.test(reason)) throw fatal('drive_full'); }
        if (r.status >= 400 && r.status < 500 && r.status !== 408 && r.status !== 429) throw fatal('drive_http_' + r.status);
        throw Object.assign(new Error(r.stalled ? 'stalled' : 'drive_http_' + r.status), { code: r.stalled ? 'stalled' : 'net' });
      } catch (e) {
        if (isAbort(e) || stopped()) throw abortErr();
        if (e.fatal) throw e;
        if (E.online && !E.online()) fails = Math.min(fails, 3);     // בלי רשת מחכים כמה שצריך — זו לא שגיאה
        else fails++;
        if (fails > MAX_FAILS) throw e;
        need = !!uri;
        chunk = Math.max(CHUNK_MIN, Math.round(chunk / 2 / K256) * K256);   // אחרי תקלה — חתיכה קטנה יותר
        if (o.onWait) o.onWait(e);
        await E.sleep(backoff(fails || 1));
      }
    }
  }

  /* חיבור Drive (חלון ההסכמה; libbackup.js מקבל Response) — v357: לקוח OAuth נפרד לסטודיו, דרך /api/studio ולא השרתון של הספרייה */
  const driveApi = (body) => E.fetch(E.base() + '/api/studio', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, E.headers ? E.headers() : {}), body: JSON.stringify(body) });

  /* תבנית "קוד ההקמה" של השרת (infra/cloud-init.yaml) — מאותו אתר שממנו נטענה האפליקציה, כלומר אותו מקור אמון
     כמו הקוד עצמו. בלי מטמון: גרסה ישנה של התבנית = שרת שמוקם בהגדרה ישנה */
  async function cloudInitTemplate() {
    try { const r = await E.fetch('infra/cloud-init.yaml', { cache: 'no-store' }); if (r.ok) return await r.text(); } catch (e) {}
    return '';
  }

  /* v380: המילון ב־Drive — {id, rows}. אין קובץ = רשימה ריקה (נוצר בשמירה הראשונה, בתיקיית הסטודיו) */
  async function glossLoad() {
    const qs = "appProperties has { key='snbGloss' and value='1' } and trashed=false";
    const j = await dreq('GET', API + '?q=' + q(qs) + '&fields=files(id,size)&pageSize=3&spaces=drive');
    const f = j && j.files && j.files[0];
    if (!f) return { id: '', rows: [] };
    const r = await E.fetch(API + '/' + f.id + '?alt=media', { headers: { Authorization: 'Bearer ' + await driveToken() } });
    if (!r.ok) throw await driveErr(r);
    return { id: f.id, rows: glParse(await r.text()) };
  }
  async function glossSave(id, rows) {
    const body = glFormat(rows);
    if (id) {
      const r = await E.fetch(UP + '/' + id + '?uploadType=media&fields=id', { method: 'PATCH', body,
        headers: { Authorization: 'Bearer ' + await driveToken(), 'Content-Type': 'text/tab-separated-values; charset=UTF-8' } });
      if (!r.ok) throw await driveErr(r);
      return id;
    }
    const root = await folder(ROOT_NAME, 'snbStudio', '1', '', 'הסרטונים והתרגומים של סטודיו התרגום ב־THE SNOWBALL.');
    const b = 'snb' + Math.random().toString(36).slice(2);
    const meta = { name: GL_NAME, parents: [root], mimeType: 'text/tab-separated-values', appProperties: { snbGloss: '1' } };
    const mp = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b +
      '\r\nContent-Type: text/tab-separated-values; charset=UTF-8\r\n\r\n' + body + '\r\n--' + b + '--';
    const r = await E.fetch(UP + '?uploadType=multipart&fields=id', { method: 'POST', body: mp,
      headers: { Authorization: 'Bearer ' + await driveToken(), 'Content-Type': 'multipart/related; boundary=' + b } });
    if (!r.ok) throw await driveErr(r);
    return (await r.json()).id;
  }

  /* v387: סט הזהב — קובץ טקסט מ־Drive (התוצר שלנו / הייחוס), והעלאת הייחוס לתיקיית העבודה */
  async function driveText(id) {
    const r = await E.fetch(API + '/' + encodeURIComponent(id) + '?alt=media', { headers: { Authorization: 'Bearer ' + await driveToken() } });
    if (!r.ok) throw await driveErr(r);
    return r.text();
  }
  async function goldUpload(folderId, text) {
    const b = 'snb' + Math.random().toString(36).slice(2);
    const meta = { name: GOLD_REF_NAME, parents: [folderId], mimeType: 'application/x-subrip', appProperties: { snbRef: '1' } };
    const mp = '--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + JSON.stringify(meta) + '\r\n--' + b +
      '\r\nContent-Type: application/x-subrip; charset=UTF-8\r\n\r\n' + text + '\r\n--' + b + '--';
    const r = await E.fetch(UP + '?uploadType=multipart&fields=id', { method: 'POST', body: mp,
      headers: { Authorization: 'Bearer ' + await driveToken(), 'Content-Type': 'multipart/related; boundary=' + b } });
    if (!r.ok) throw await driveErr(r);
    return (await r.json()).id;
  }


  return { api, driveApi, driveToken, jobFolder, upload, cloudInitTemplate, glossLoad, glossSave, driveText, goldUpload, _forget: () => { dtok = null; } };
}
