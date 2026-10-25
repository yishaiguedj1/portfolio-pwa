/* מ1 (10/10/2026): הנגן של סטודיו התרגום — בסגנון YouTube.
   הסרטון המקורי מ־Drive (דרך ה־Service Worker, ./studio-media/<id>) והכתוביות מעליו (עברית / שפת המקור / כבויות),
   נגיעה כפולה בצד = ±10 שנ׳, מהירות, ובפס ההתקדמות — מפת האזהרות (כתוביות שלא עומדות בכללים) כמו "הכי נצפה" ב־YouTube.
   הלוגיקה טהורה (נבדקת ב־node); ה־DOM נבנה רק ב־createPlayer. בלי רשת — studio.js נותן כתובת וכתוביות. */

/* 25/10/2026 (משתמש מאייפון): באייפון אין window.MediaSource — רק ManagedMediaSource (iOS 17.1+). עד היום הנגן בדק רק את
   הראשון, ולכן באייפון תמיד ניגן את הקובץ המקורי בלי בחירת איכות, גם כשהשרת בנה 6 איכויות. hls.js 1.6 בוחר לבד את
   ManagedMediaSource כשאין MediaSource (ומכבה AirPlay לקטעים, כנדרש) */
export function msOf(w) {
  const g = w || (typeof window !== 'undefined' ? window : null);
  return g ? g.MediaSource || g.ManagedMediaSource || null : null;
}
/* כללי הכתוביות — **זהים ל־Q_CPS/Q_LEN/Q_LINES/Q_MIN_DUR ו־_EN_RUN ב־translator/job.py** (מדד האיכות) */
export const Q_CPS = 17, Q_LEN = 42, Q_LINES = 2, Q_MIN_DUR = 0.83;
export const EN_RUN = /[A-Za-z]{2,}(?:[\s,'’-]+[A-Za-z]{2,}){2,}/;
export const ISSUE_KINDS = ['cps', 'len', 'lines', 'dur', 'en'];
const CUES_MAX = 20000, LINE_MAX = 300;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : NaN);
const str = (v, n) => (typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b-\u001f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').slice(0, n) : '');   // מ2: גם סימני כיווניות (RLM של vt ב־SRT) — כמו quality() בעובד

/* cues.final.json של vt (או SRT מפוענח) → [{i, s, e, lines, en, spk}] בשניות, ממוין, בלי פגומות */
export function normCues(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const c of arr.slice(0, CUES_MAX)) {
    if (!c || typeof c !== 'object') continue;
    const s = num(c.start != null ? c.start : c.a != null ? c.a / 1000 : c.s);
    const e = num(c.end != null ? c.end : c.b != null ? c.b / 1000 : c.e);
    let lines = Array.isArray(c.lines) ? c.lines : typeof c.t === 'string' ? c.t.split('\n') : typeof c.he === 'string' ? c.he.split('||') : [];
    lines = lines.map((x) => str(x, LINE_MAX).trim()).filter(Boolean).slice(0, 4);
    if (!(s >= 0) || !(e > s) || !lines.length) continue;
    out.push({ i: Number.isInteger(c.id) ? c.id : out.length + 1, s, e, lines, en: str(c.en, 600), spk: str(c.spk, 20) });
  }
  return out.sort((a, b) => a.s - b.s);
}

/* מה לא עומד בכללים בכתובית אחת (אותן הגדרות של quality() בעובד: תווים בלי ירידת השורה, משך בשניות) */
export function cueIssues(c) {
  const dur = c.e - c.s, chars = c.lines.reduce((a, x) => a + x.length, 0), k = [];
  if (dur <= 0 || chars / dur > Q_CPS) k.push('cps');
  if (c.lines.some((x) => x.length > Q_LEN)) k.push('len');
  if (c.lines.length > Q_LINES) k.push('lines');
  if (dur < Q_MIN_DUR) k.push('dur');
  if (EN_RUN.test(c.lines.join(' '))) k.push('en');
  return k;
}
export function issuesList(cues) {
  const out = [];
  for (const c of cues) { const k = cueIssues(c); if (k.length) out.push({ i: c.i, t: c.s, k }); }
  return out;
}

/* הכתובית שבזמן t (חיפוש בינארי); -1 = אין */
export function cueAt(cues, t) {
  let lo = 0, hi = cues.length - 1;
  while (lo <= hi) {
    const m = (lo + hi) >> 1, c = cues[m];
    if (t < c.s) hi = m - 1; else if (t >= c.e) lo = m + 1; else return m;
  }
  return -1;
}
/* מפת האזהרות בפס: n תאים, בכל אחד כמה כתוביות בעייתיות (0–1 יחסית למקסימום) */
export function heatBins(issues, dur, n = 60) {
  const b = new Array(n).fill(0);
  if (!(dur > 0)) return b;
  for (const x of issues) b[Math.min(n - 1, Math.max(0, Math.floor(x.t / dur * n)))] += 1;
  const mx = Math.max(1, ...b);
  return b.map((v) => Math.round(v / mx * 100) / 100);
}
export function fmtT(sec) {
  const t = Math.max(0, Math.floor(num(sec) || 0)), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
}
export const SPEEDS = [1, 1.25, 1.5, 2, 0.5, 0.75];
export const nextSpeed = (v) => SPEEDS[(SPEEDS.indexOf(v) + 1) % SPEEDS.length] || 1;
/* מצבי הכתוביות: עברית → שפת המקור (אם יש) → כבויות */
export function nextCc(cc, hasEn) { return cc === 'he' ? (hasEn ? 'en' : 'off') : cc === 'en' || cc === 'both' ? 'off' : 'he'; }

/* ---- 23/10/2026 (בקשת המשתמש — "כמו בנגנים מתקדמים"): בחירת רצועת קול ורצועת כתוביות מהנגן ----
   ברירת המחדל = "אוטומטי": הקול — ברירת המחדל שסומנה בקובץ (אחרת הראשונה); הכתוביות — התרגום, וכבויות כשהקול כבר בשפת
   התרגום (אין טעם בכתוביות בעברית מעל קול בעברית). בחירה ידנית נשמרת (העדפה בהגדרות — כמו ב־YouTube) ו"אוטומטי" מחזיר.
   ההעדפה לקול = קוד שפה (רצועה בלי שפה — רק לניגון הזה), לכתוביות = off/he/en/both */
export const CC_MODES = ['off', 'he', 'en', 'both'];
export function normTrackPref(x) {
  const o = x && typeof x === 'object' ? x : {};
  return { a: /^[a-z]{2,3}$/.test(String(o.a || '')) ? o.a : '', cc: CC_MODES.includes(o.cc) ? o.cc : '' };
}
/* איזו רצועה מתנגנת: השפה שנבחרה ידנית, אחרת ברירת המחדל של הקובץ, אחרת הראשונה */
export function pickAudio(alts, prefA) {
  const list = Array.isArray(alts) ? alts : [];
  if (!list.length) return -1;
  const m = prefA ? list.findIndex((a) => a && a.l === prefA) : -1;
  if (m >= 0) return m;
  return Math.max(0, list.findIndex((a) => a && a.d));
}
/* הכתוביות האוטומטיות: התרגום, וכבויות כשהקול בשפת התרגום / בלי כתוביות / סרטון צרוב */
export function autoCc(audioLang, hasCues, burned, subLang) {
  if (burned || !hasCues) return 'off';
  const to = subLang || 'he';
  return audioLang && (audioLang === to || (to === 'he' && audioLang === 'heb') || (to === 'he' && audioLang === 'iw')) ? 'off' : 'he';
}
/* הבחירה בפועל: ידנית כשהיא אפשרית (אנגלית / שתיהן — רק כשיש מקור באנגלית), אחרת האוטומטית */
export function resolveCc(prefCc, auto, hasEn, burned) {
  if (burned) return 'off';
  if (!prefCc) return auto;
  if ((prefCc === 'en' || prefCc === 'both') && !hasEn) return prefCc === 'both' ? 'he' : auto;
  return prefCc;
}

/* ---------------- איכויות צפייה כמו ב־YouTube (10/10/2026) ----------------
   העובד (translator/ladder.py) אורז את המקור עצמו מחדש — אותו קובץ, אותם זרמים, בלי קידוד — ומוסיף איכויות נמוכות קטנות.
   כל קובץ = MP4 מקוטע עם אינדקס (sidx) בתחילתו. כאן: קוראים את תחילת כל קובץ (בקשת טווח אחת), בונים ממנה רשימות HLS
   עם טווחי בתים, ו־hls.js בוחר איכות (אוטומטי לפי מהירות החיבור, או ידני). אותו דבר יעבוד מ־R2 — רק כתובת אחרת לקובץ.
   ברירת המחדל = המקור (האיכות הכי טובה — בקשת המשתמש); "אוטומטי" — בתפריט ההגדרות, כמו ב־YouTube. */
export const HEAD_BYTES = 256 * 1024;
export const SEG_TARGET = 6, SEG_MAX_BYTES = 24 * 1024 * 1024;   // קטע ~6 שנ׳; לא מעל 24MB (= תקרת הטווח המפורש ב־sw.js)
export const Q_HEIGHTS = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];
const C_RE = /^[A-Za-z0-9.-]{3,40}(,[A-Za-z0-9.-]{3,40})?$/;   // 22/10/2026: גם ac-3 / ec-3
const FID = /^[A-Za-z0-9_-]{10,100}$/;
/* מהשרתון (job.hl): הראשונה = המקור, מהגבוהה לנמוכה — כמו normHl בשרתון */
export function normLadder(list, vid) {
  if (!Array.isArray(list) || list.length < 2 || list.length > 8) return null;
  const out = [];
  for (const x of list) {
    if (!x || !FID.test(String(x.id || '')) || out.some((y) => y.id === x.id) || !C_RE.test(String(x.c || ''))) return null;
    const w = Math.floor(+x.w), hh = Math.floor(+x.h), bw = Math.floor(+x.bw), abw = Math.floor(+x.abw);
    if (!(w >= 16 && w <= 8192 && hh >= 16 && hh <= 8192 && bw >= 1000 && abw >= 1000 && abw <= bw)) return null;
    if (out.length && Math.min(w, hh) >= Math.min(out[out.length - 1].w, out[out.length - 1].h)) return null;
    out.push({ id: x.id, w, h: hh, bw, abw, c: x.c });
  }
  return vid && out[0].id !== vid ? null : out;
}
/* 22/10/2026 (בקשת המשתמש: לא לדרוס קול איכותי): עותק הקול לנגן (Opus) — כשהקול המקורי במקור הוא Dolby/DTS/TrueHD.
   **זהה ל־normHla בשרתון**.
   23/10/2026: כמה רצועות קול — רשימה (עד ALT_MAX) עם שפה (קוד) וברירת מחדל; אובייקט יחיד = רשימה של אחת. תמיד רשימה או null */
export const ALT_MAX = 4;
function normAlt1(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x) || !FID.test(String(x.id || '')) || x.c !== 'opus') return null;
  const bw = Math.floor(+x.bw), abw = Math.floor(+x.abw), ch = Math.floor(+x.ch);
  if (!(bw >= 8000 && bw <= 2e6 && abw >= 8000 && abw <= bw && ch >= 1 && ch <= 8)) return null;
  const o = { id: x.id, c: 'opus', bw, abw, ch };
  if (/^[a-z]{2,3}$/.test(String(x.l || ''))) o.l = x.l;
  if (x.d === 1) o.d = 1;
  return o;
}
export function normAlt(x) {
  const list = Array.isArray(x) ? x : x ? [x] : [];
  if (!list.length || list.length > ALT_MAX) return null;
  const out = [];
  for (const y of list) { const o = normAlt1(y); if (!o || out.some((z) => z.id === o.id)) return null; out.push(o); }
  return out.filter((o) => o.d).length > 1 ? null : out;
}
/* שם לרצועה בתפריט: שם השפה בשפת הממשק (Intl), אחרת "רצועה N" */
export function altName(a, i, T, ui) {
  if (a && a.l) {
    try { const n = new Intl.DisplayNames([ui || 'he'], { type: 'language' }).of(a.l); if (n && n.toLowerCase() !== a.l) return n; } catch (e) {}
  }
  return T('studioPlTrackN', { n: i + 1 });
}
/* הקודקים של רמה: [וידאו, קול] (הסדר במחרוזת לפי סדר הרצועות בקובץ — לא מניחים) */
const V_PRE = /^(avc[13]|hvc1|hev1|av01|vp09|vp8)\b/;
export function splitCodecs(c) {
  const p = String(c || '').split(',').filter(Boolean);
  return [p.find((x) => V_PRE.test(x)) || '', p.find((x) => !V_PRE.test(x)) || ''];
}
/* הטלפון מנגן את הקול של הרמה בעצמו? (בלי קול — כן) */
export function audioPlayable(c, isType) {
  const a = splitCodecs(c)[1];
  if (!a) return true;
  try { return !!isType('audio/mp4; codecs="' + a + '"'); } catch (e) { return false; }
}
/* ---- הסרת רצועת הקול מ־MP4 מקוטע תוך כדי ניגון (בלי לגעת בקובץ) ----
   כשהטלפון לא מנגן את הקול המקורי: hls.js פותח SourceBuffer אחד לווידאו+קול וקודק קול לא מוכר מפיל את כל הניגון (נבדק
   22/10/2026). לכן: מהאתחול (moov) יוצא trak הקול ו־trex שלו; מכל moof יוצא ה־traf שלו, ו־data_offset של ה־trun שנשארו
   קטן באותו מספר בתים (default_base_moof — ההיסט נמדד מתחילת ה־moof). ה־mdat נשאר כמו שהוא (בתים שלא נקראים). */
const u32 = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
const w32 = (b, i, v) => { b[i] = (v >>> 24) & 255; b[i + 1] = (v >>> 16) & 255; b[i + 2] = (v >>> 8) & 255; b[i + 3] = v & 255; };
const btyp = (b, i) => String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
function bkids(b, s, e) {
  const o = [];
  for (let i = s; i + 8 <= e;) { const sz = u32(b, i); if (sz < 8 || i + sz > e) break; o.push([btyp(b, i), i, sz]); i += sz; }
  return o;
}
function bfind(b, s, e, path) {
  let hit = null;
  for (const n of path) { hit = bkids(b, s, e).find((k) => k[0] === n); if (!hit) return null; s = hit[1] + 8; e = hit[1] + hit[2]; }
  return hit;
}
function bcut(b, rm) {
  rm.sort((x, y) => x[0] - y[0]);
  const o = new Uint8Array(b.length - rm.reduce((a, r) => a + r[1], 0));
  let p = 0, i = 0;
  for (const [s, l] of rm) { o.set(b.subarray(i, s), p); p += s - i; i = s + l; }
  o.set(b.subarray(i), p);
  return o;
}
/* אתחול → { data, ids } — ids = מזהי רצועות הקול שהוסרו (ריק = לא נגענו) */
export function stripInitAudio(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const moov = bkids(b, 0, b.length).find((k) => k[0] === 'moov');
  if (!moov) return { data: b, ids: [] };
  const ids = [], rm = [];
  const kids = bkids(b, moov[1] + 8, moov[1] + moov[2]);
  for (const t of kids.filter((k) => k[0] === 'trak')) {
    const hd = bfind(b, t[1] + 8, t[1] + t[2], ['mdia', 'hdlr']), tk = bfind(b, t[1] + 8, t[1] + t[2], ['tkhd']);
    if (!hd || !tk || btyp(b, hd[1] + 12) !== 'soun') continue;
    ids.push(u32(b, tk[1] + 12 + (b[tk[1] + 8] ? 16 : 8)));
    rm.push([t[1], t[2]]);
  }
  if (!ids.length || ids.length === kids.filter((k) => k[0] === 'trak').length) return { data: b, ids: [] };   // רק קול — לא נוגעים
  const c = b.slice(), up = [];
  for (const m of kids.filter((k) => k[0] === 'mvex')) {
    for (const x of bkids(c, m[1] + 8, m[1] + m[2])) if (x[0] === 'trex' && ids.includes(u32(c, x[1] + 12))) { rm.push([x[1], x[2]]); up.push([m[1], x[2]]); }
  }
  for (const r of rm) w32(c, moov[1], u32(c, moov[1]) - r[1]);
  for (const [at, n] of up) w32(c, at, u32(c, at) - n);
  return { data: bcut(c, rm), ids };
}
/* קטע (moof+mdat, אחד או כמה) → אותו קטע בלי ה־traf של הרצועות שהוסרו */
export function stripFragAudio(buf, ids) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (!ids || !ids.length) return b;
  const c = b.slice(), rm = [];
  for (const m of bkids(c, 0, c.length).filter((k) => k[0] === 'moof')) {
    const trafs = bkids(c, m[1] + 8, m[1] + m[2]).filter((k) => k[0] === 'traf');
    let gone = 0;
    for (const t of trafs) { const h = bfind(c, t[1] + 8, t[1] + t[2], ['tfhd']); if (h && ids.includes(u32(c, h[1] + 12))) { rm.push([t[1], t[2]]); gone += t[2]; } }
    if (!gone) continue;
    w32(c, m[1], m[2] - gone);
    for (const t of trafs) {
      const h = bfind(c, t[1] + 8, t[1] + t[2], ['tfhd']);
      if (!h || ids.includes(u32(c, h[1] + 12))) continue;
      for (const r of bkids(c, t[1] + 8, t[1] + t[2])) if (r[0] === 'trun' && (u32(c, r[1] + 8) & 1)) w32(c, r[1] + 16, (u32(c, r[1] + 16) - gone) >>> 0);
    }
  }
  return rm.length ? bcut(c, rm) : b;
}
/* ---- פענוח Dolby בדפדפן לסרטון שכבר עובד (22/10/2026, בקשת המשתמש) ----
   סרטון עם קול AC-3/E-AC-3 שהטלפון לא מנגן (MKV/MP4 "WEB-DL") מתנגן בלי קול. לעבודות חדשות העובד בונה עותק Opus
   (ladder.py — `hla`); לעבודות שכבר הסתיימו: הנגן מפענח את הקול כאן — @mediabunny/ac3 (FFmpeg ב־WebAssembly, ב־Worker
   מקובץ קבוע — vendor/mediabunny, tools/mb-ac3-vendor.js) — ומנגן אותו ב־Web Audio, מסונכרן לשעון של הווידאו.
   הסנכרון: עוגן (זמן ב־AudioContext ↔ זמן בסרטון) בכל התחלה, וכל קטע מתוזמן לפיו פחות העיכוב של הפלט (outputLatency —
   כולל אוזניות בלוטות' כשהדפדפן מדווח). סטייה מעל AB_DRIFT — עוגן חדש. עצירה / קפיצה / טעינה — הכל נעצר ומתחיל מחדש. */
export const AB_AHEAD = 2;          // שניות קול מתוזמנות מראש
export const AB_DRIFT = 0.12;       // סטייה בין הקול לווידאו שמצדיקה עוגן חדש
export const AB_CODECS = { ac3: 'ac-3', eac3: 'ec-3' };
/* האם צריך לפענח בעצמנו: קודק Dolby שהדפדפן לא מכיר */
export function needAudioBridge(codec, isType) {
  const c = AB_CODECS[codec];
  if (!c) return false;
  try { return !isType('audio/mp4; codecs="' + c + '"'); } catch (e) { return true; }
}
/* טהורה: מתי (בשעון ה־AudioContext) ומאיזה היסט בקטע מתחילים, לפי העוגן */
export function abWhen(anchor, ts, rate, now) {
  const when = anchor.c + (ts - anchor.v) / rate - anchor.lat;
  if (when >= now) return { when, off: 0 };
  return { when: now, off: (now - when) * rate };
}
/* v = אלמנט הווידאו, open() = Promise ל־{ buffers(start) } (איטרטור של {buffer, timestamp}), mkCtx = () => AudioContext */
export function createAudioBridge(v, open, mkCtx, opt = {}) {
  const sleep = opt.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  let ctx = null, gain = null, gen = 0, nodes = new Set(), anchor = null, sink = null, dead = false, timer = 0;
  const stop = () => {
    gen++; anchor = null;
    for (const n of nodes) { try { n.stop(); } catch (e) {} try { n.disconnect(); } catch (e) {} }
    nodes.clear();
  };
  // opt.vol — כשהקול של הווידאו מושתק בכוונה (רצועה אחרת מקובץ מקומי), לא לפי v.muted
  const vol = () => { if (gain) gain.gain.value = opt.vol ? opt.vol() : v.muted ? 0 : (v.volume == null ? 1 : v.volume); };
  async function run() {
    stop();
    if (dead || v.paused || v.ended || v.seeking) return;
    const g = gen;
    if (!ctx) { ctx = mkCtx(); gain = ctx.createGain(); gain.connect(ctx.destination); vol(); }
    try { if (ctx.state === 'suspended') await ctx.resume(); } catch (e) {}
    if (!sink) sink = await open();
    if (g !== gen) return;
    const rate = v.playbackRate || 1, t0 = v.currentTime;
    anchor = { c: ctx.currentTime, v: t0, lat: Math.max(0, Number(ctx.outputLatency) || Number(ctx.baseLatency) || 0), rate };
    try {
      for await (const { buffer, timestamp } of sink.buffers(Math.max(0, t0 - 0.05))) {
        if (g !== gen) return;
        const end = timestamp + buffer.duration;
        if (end <= t0) continue;
        const w = abWhen(anchor, timestamp, rate, ctx.currentTime);
        if (w.off >= buffer.duration) continue;
        const n = ctx.createBufferSource();
        n.buffer = buffer; n.playbackRate.value = rate; n.connect(gain);
        n.onended = () => { nodes.delete(n); try { n.disconnect(); } catch (e) {} };
        n.start(w.when, w.off);
        nodes.add(n);
        while (g === gen && abWhen(anchor, end, rate, 0).when - ctx.currentTime > AB_AHEAD) await sleep(200);
      }
    } catch (e) { if (opt.onError) opt.onError(e); }
  }
  function check() {   // סטייה בין הקול לווידאו — עוגן חדש
    if (!anchor || v.paused || v.seeking || !ctx) return;
    const want = anchor.v + (ctx.currentTime - anchor.c) * anchor.rate;
    if (Math.abs(v.currentTime - want) > AB_DRIFT) run();
  }
  const on = { playing: run, seeked: run, ratechange: run, pause: stop, waiting: stop, seeking: stop, emptied: stop, ended: stop, volumechange: vol };
  for (const k of Object.keys(on)) v.addEventListener(k, on[k]);
  timer = setInterval(check, 1000);
  if (!v.paused) run();
  return {
    destroy() {
      dead = true; stop(); clearInterval(timer);
      for (const k of Object.keys(on)) v.removeEventListener(k, on[k]);
      try { if (ctx) ctx.close(); } catch (e) {}
    },
    state: () => ({ on: !!anchor, nodes: nodes.size, ctx: !!ctx }),
  };
}

/* ברירת המחדל: Mediabunny + @mediabunny/ac3 מ־vendor (נטענים רק כשיש קול כזה) */
let abReg = null;
export async function decodeDolby(url) {
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  const MB = await import('./vendor/mediabunny/mediabunny.min.mjs');
  const input = new MB.Input({ source: new MB.UrlSource(url), formats: MB.ALL_FORMATS });
  const tr = await input.getPrimaryAudioTrack();
  const isType = (t) => { const M = msOf(); return !!(M && M.isTypeSupported(t)); };
  if (!tr || !needAudioBridge(tr.codec, isType)) return null;
  if (!abReg) abReg = import('./vendor/mediabunny/mediabunny-ac3.min.mjs').then((m) => m.registerAc3Decoder());
  await abReg;
  if (!(await tr.canDecode())) return null;
  return { open: async () => new MB.AudioBufferSink(tr), ctx: () => new AudioContext({ latencyHint: 'playback' }) };
}

/* ---- 25/10/2026 (בקשת המשתמש): הסרטון שנצרב בטלפון — קובץ מקומי (Movies/Studio) עם כל רצועות הקול של המקור ----
   הדפדפן מנגן רק את הרצועה הראשונה בקובץ. רצועה אחרת — פענוח שלה (Mediabunny מתוך הקובץ, בלי רשת), באותו גשר של Dolby,
   והקול של הווידאו מושתק. השפה = קוד ISO מהקובץ ('und' = בלי) */
export function trackLang(code) { const c = String(code || '').toLowerCase(); return /^[a-z]{2,3}$/.test(c) && c !== 'und' ? c : ''; }
export async function localTracks(file) {
  if (typeof window === 'undefined' || !file) return [];
  const MB = await import('./vendor/mediabunny/mediabunny.min.mjs');
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const trs = await input.getAudioTracks();
  return trs.map((t, i) => ({ i, l: trackLang(t.languageCode), d: !!(t.disposition && t.disposition.default), c: t.codec || '' }));
}
export async function localDecode(file, idx) {
  if (typeof window === 'undefined' || !window.AudioContext || !file) return null;
  const MB = await import('./vendor/mediabunny/mediabunny.min.mjs');
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const tr = (await input.getAudioTracks())[idx];
  if (!tr) return null;
  if (AB_CODECS[tr.codec]) { if (!abReg) abReg = import('./vendor/mediabunny/mediabunny-ac3.min.mjs').then((m) => m.registerAc3Decoder()); await abReg; }
  if (!(await tr.canDecode())) return null;
  return { open: async () => new MB.AudioBufferSink(tr), ctx: () => new AudioContext({ latencyHint: 'playback' }) };
}
/* איזו רצועה צריכה את הגשר: כל רצועה חוץ מהראשונה (שהדפדפן מנגן), וגם הראשונה כשהדפדפן לא מכיר את הקודק שלה */
export function fileNeedsBridge(tracks, i, isType) { return i > 0 || !!(tracks[i] && needAudioBridge(tracks[i].c, isType)); }

/* "1080p" — לפי הצלע הקצרה (אנכי 1080×1920 הוא 1080p, כמו ב־YouTube) */
export const qShort = (l) => Math.min(l.w || l.width || 0, l.h || l.height || 0);
export const qLabel = (l) => qShort(l) + 'p';
export const qHd = (l) => qShort(l) >= 720;
/* העדפה שנשמרת: 'src' (המקור — ברירת המחדל), 'auto', או גובה */
export function normPq(v) { return v === 'auto' || v === 'src' ? v : Q_HEIGHTS.includes(v) ? v : 'src'; }
/* האיכות שנבחרת בפועל מתוך מה שהנגן יכול לנגן (hls.js מסנן קודקים שהטלפון לא מכיר): -1 = אוטומטי */
export function pickLevel(levels, pq) {
  if (!levels.length || pq === 'auto') return -1;
  let best = 0;
  levels.forEach((l, i) => { if (qShort(l) > qShort(levels[best]) || (qShort(l) === qShort(levels[best]) && (l.bitrate || 0) > (levels[best].bitrate || 0))) best = i; });
  if (pq === 'src') return best;
  let pick = -1;   // הגבוהה שלא מעל מה שנבחר; אין כזו — הנמוכה ביותר
  levels.forEach((l, i) => { if (qShort(l) <= pq && (pick < 0 || qShort(l) > qShort(levels[pick]))) pick = i; });
  if (pick >= 0) return pick;
  levels.forEach((l, i) => { if (pick < 0 || qShort(l) < qShort(levels[pick])) pick = i; });
  return pick;
}
/* תחילת קובץ MP4 מקוטע: סוף האתחול (ftyp+moov) והקטעים מה־sidx הראשון (= translator/ladder.py sidx_index).
   need = כמה בתים צריך כשהאינדקס לא נכנס בקריאה הראשונה */
export function parseMp4Head(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let i = 0, moovEnd = 0, sidx = null;
  while (i + 8 <= b.length) {
    let sz = dv.getUint32(i), hd = 8;
    const t = String.fromCharCode(b[i + 4], b[i + 5], b[i + 6], b[i + 7]);
    if (sz === 1) { if (i + 16 > b.length) break; sz = dv.getUint32(i + 8) * 4294967296 + dv.getUint32(i + 12); hd = 16; }
    if (sz < hd) return null;
    if (t === 'moov') moovEnd = i + sz;
    if (t === 'sidx') { sidx = { o: i, sz, c: i + hd }; break; }
    if (t === 'moof') break;
    i += sz;
  }
  if (!moovEnd || !sidx) return moovEnd && i + 8 > b.length ? { need: b.length * 2 } : null;
  if (sidx.o + sidx.sz > b.length) return { need: sidx.o + sidx.sz };
  let p = sidx.c;
  const ver = b[p]; p += 4;
  const ts = dv.getUint32(p + 4); p += 8;
  let fo;
  if (ver === 0) { fo = dv.getUint32(p + 4); p += 8; } else { fo = dv.getUint32(p + 8) * 4294967296 + dv.getUint32(p + 12); p += 16; }
  const n = dv.getUint16(p + 2); p += 4;
  let off = sidx.o + sidx.sz + fo;
  const segs = [];
  for (let k = 0; k < n; k++) {
    const size = dv.getUint32(p) & 0x7fffffff, d = dv.getUint32(p + 4) / (ts || 1);
    p += 12;
    segs.push({ o: off, s: size, d });
    off += size;
  }
  return { init: moovEnd, segs };
}
/* קטעים סמוכים יחד עד ~SEG_TARGET שניות (פחות בקשות; מקור עם מפתח כל חצי שנייה לא הופך לאלפי בקשות) */
export function groupSegs(segs, target = SEG_TARGET, maxBytes = SEG_MAX_BYTES) {
  const out = [];
  let cur = null;
  for (const x of segs) {
    if (cur && cur.d < target && cur.s + x.s <= maxBytes) { cur.s += x.s; cur.d += x.d; continue; }
    cur = { o: x.o, s: x.s, d: x.d };
    out.push(cur);
  }
  return out;
}
export function mediaPlaylist(url, init, segs) {
  const td = Math.max(1, Math.ceil(Math.max(0, ...segs.map((x) => x.d))));
  const L = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-TARGETDURATION:' + td, '#EXT-X-PLAYLIST-TYPE:VOD', '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-MAP:URI="' + url + '",BYTERANGE="' + init + '@0"'];
  for (const x of segs) L.push('#EXTINF:' + x.d.toFixed(3) + ',', '#EXT-X-BYTERANGE:' + x.s + '@' + x.o, url);
  L.push('#EXT-X-ENDLIST');
  return L.join('\n') + '\n';
}
export function masterPlaylist(levels, alts) {
  const L = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS'];
  // 22/10/2026: עותק הקול לנגן — רצועת קול חלופית לכל הרמות; בקודקים של הרמה רק הווידאו + opus (הקול שבקטעים מוסר בטלפון).
  // 23/10/2026: כמה רצועות — EXT-X-MEDIA לכל אחת באותה קבוצה, DEFAULT לברירת המחדל של המקור (אחרת הראשונה)
  const list = !alts ? [] : Array.isArray(alts) ? alts : [alts];
  const di = Math.max(0, list.findIndex((a) => a.d));
  list.forEach((a, i) => L.push('#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="a",NAME="' + (list.length === 1 ? 'main' : 'a' + i) + '"'
    + (a.l ? ',LANGUAGE="' + a.l + '"' : '') + ',DEFAULT=' + (i === di ? 'YES' : 'NO') + ',AUTOSELECT=YES,CHANNELS="' + a.ch + '",URI="' + a.uri + '"'));
  const alt = list[di] || null;
  for (const l of levels) {
    const c = alt ? [splitCodecs(l.c)[0], 'opus'].filter(Boolean).join(',') : l.c;
    L.push('#EXT-X-STREAM-INF:BANDWIDTH=' + (l.bw + (alt ? alt.bw : 0)) + ',AVERAGE-BANDWIDTH=' + (l.abw + (alt ? alt.abw : 0)) + ',RESOLUTION=' + l.w + 'x' + l.h + ',CODECS="' + c + '"' + (alt ? ',AUDIO="a"' : ''), l.uri);
  }
  return L.join('\n') + '\n';
}

/* פרקים (מ"רעיונות" / מהעורך): [{t, title}] — ממוינים, בלי זמן כפול, בתוך אורך הסרטון, עד 30; טקסט נקי בלבד */
export const CHAP_MAX = 30;
export function normChapters(a, dur) {
  const out = [], d = Number(dur) > 0 ? Number(dur) : Infinity;
  for (const x of Array.isArray(a) ? a : []) {
    if (!x || typeof x !== 'object') continue;
    const t = Math.round(Number(x.t) * 10) / 10, title = String(x.title == null ? '' : x.title).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (!(t >= 0) || t >= d || !title || out.some((y) => Math.abs(y.t - t) < 1)) continue;
    out.push({ t, title });
  }
  return out.sort((x, y) => x.t - y.t).slice(0, CHAP_MAX);
}
/* הפרק שבו t נמצא (‎-1 = לפני הפרק הראשון) */
export function chapterAt(chs, t) {
  let i = -1;
  for (let k = 0; k < chs.length; k++) { if (chs[k].t <= t + 0.05) i = k; else break; }
  return i;
}

/* ---------------- הנגן (DOM) ---------------- */
const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  aud: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  back: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z', fwd: 'M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z',
  cc: 'M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1z',
  full: 'M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z',
  gear: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.7 7.7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.7 7.7 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  tune: 'M3 17v2h6v-2zm0-12v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z',
  speed: 'M20.4 8.6 19 10a8 8 0 0 1-.9 8H5.9A8 8 0 0 1 16.1 6l1.4-1.4A10 10 0 0 0 4.2 19l.3.5h15l.3-.5a10 10 0 0 0 .6-10.4zM10.6 15.4a2 2 0 0 0 2.8 0l5.7-8.5-8.5 5.7a2 2 0 0 0 0 2.8z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z', chev: 'M10 6 8.6 7.4 13.2 12l-4.6 4.6L10 18l6-6z', prev: 'M14 6l1.4 1.4L10.8 12l4.6 4.6L14 18l-6-6z',
  chap: 'M3 13h2v-2H3zm0 4h2v-2H3zm0-8h2V7H3zm4 4h14v-2H7zm0 4h14v-2H7zM7 7v2h14V7z',
};
function icon(k) {
  const s = document.createElementNS(SVG, 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(SVG, 'path'); p.setAttribute('d', PATHS[k]); p.setAttribute('fill', 'currentColor'); s.append(p);
  return s;
}
function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
function ib(cls, k, label, fn) {
  const b = el('button', 'st-pl-b ' + cls); b.type = 'button'; b.setAttribute('aria-label', label); b.append(icon(k));
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(e); });
  return b;
}

/* סבב 5: עיצוב הכתוביות (מעל הסגנון שנבחר — מודגש / קלאסי). **זהה ל־normSty בשרתון ול־norm_sty ב־rerender.py**.
   k = גודל באחוזים (70–150, צעד 10), c = צבע (w לבן, y צהוב, c תכלת), bx = רקע כהה מאחורי הטקסט, y = הרמה מהתחתית (0–40% מהגובה).
   רק מה ששונה מברירת המחדל נשמר; הכל ברירת מחדל — null */
export const STY_COLORS = { w: '#FFFFFF', y: '#FFE14D', c: '#7FE7FF' };
export const STY_K = [70, 150], STY_Y = 40;
export function normSty(o) {
  if (!o || typeof o !== 'object') return null;
  const out = {};
  const k = Math.round(Number(o.k) / 10) * 10;
  if (Number.isFinite(k) && k >= STY_K[0] && k <= STY_K[1] && k !== 100) out.k = k;
  if (typeof o.c === 'string' && o.c in STY_COLORS && o.c !== 'w') out.c = o.c;
  if (o.bx === true || o.bx === 1) out.bx = 1;
  const y = Math.round(Number(o.y));
  if (Number.isFinite(y) && y > 0 && y <= STY_Y) out.y = y;
  return Object.keys(out).length ? out : null;
}

/* opts: { src, fallback, cues, issues, chapters, T, burned } — fallback = כתובת לסרטון הצרוב אם המקור לא מתנגן (אז בלי כתוביות מעליו).
   מחזיר { el, video, seek, play, pause, setCues, setChapters, destroy }. el יציב — studio.js משאיר אותו בין ציורים (וידאו שמוצא מהמסמך נעצר) */
export function createPlayer(opts) {
  const T = opts.T || ((k) => k);
  let cues = opts.cues || [], issues = opts.issues || [], chs = normChapters(opts.chapters), chNow = -2;
  let pref = normTrackPref(opts.pref);
  const hasEn = () => cues.some((c) => c.en);
  const curLang = () => { const i = audNow(), L = audList(); return i >= 0 && L[i] ? L[i].l || '' : ''; };
  const ccAuto = () => autoCc(curLang(), cues.length > 0, !!opts.burned, opts.subLang);
  const savePref = (p) => { pref = normTrackPref(Object.assign({}, pref, p)); if (opts.onPref) opts.onPref(pref); };
  let cc = resolveCc(pref.cc, autoCc('', (opts.cues || []).length > 0, !!opts.burned, opts.subLang), (opts.cues || []).some((c) => c.en), !!opts.burned), hideT = 0, lastTap = 0, tapT = 0, dragging = false, destroyed = false;
  const wrap = el('div', 'st-pl' + (opts.burned ? ' burned' : '')); wrap.dir = 'ltr';
  const v = el('video', 'st-pl-v'); v.playsInline = true; v.preload = 'metadata'; v.setAttribute('playsinline', '');
  // 21/10/2026 (בקשת המשתמש — כמו ב־YouTube): תמונה לפני הניגון. קפיצה לנקודה (seek) מורידה אותה ומציגה את הפריים של הנקודה
  const setPoster = (u) => { if (typeof u === 'string' && /^(data:image\/(jpeg|png|webp);base64,|blob:)/.test(u)) v.poster = u; };
  setPoster(opts.poster);
  const sub = el('div', 'st-pl-sub'); sub.dir = 'rtl'; sub.setAttribute('aria-live', 'off');
  const ui = el('div', 'st-pl-ui');
  const top = el('div', 'st-pl-top'), mid = el('div', 'st-pl-mid'), bot = el('div', 'st-pl-bot');
  // 25/10/2026: בסרטון צרוב — רק המקור באנגלית מעל (העברית כבר בתמונה), בלי לשמור העדפה
  const ccB = ib('cc', 'cc', T('studioPlCc'), () => { if (opts.burned) cc = cc === 'en' ? 'off' : 'en'; else { cc = nextCc(cc, hasEn()); savePref({ cc }); } paintCc(); paintSub(); });
  const ccL = el('span', 'st-pl-ccl'); ccB.append(ccL);
  // ההגדרות — כמו ב־YouTube: גלגל שיניים → איכות / מהירות (בתוך הנגן, גם במסך מלא)
  const gearB = ib('gear', 'gear', T('studioPlSettings'), () => openMenu(''));
  const hdB = el('span', 'st-pl-hd', 'HD'); hdB.hidden = true; gearB.append(hdB);
  const menu = el('div', 'st-pl-menu'); menu.hidden = true; menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', T('studioPlSettings'));
  menu.addEventListener('click', (e) => { e.stopPropagation(); if (e.target === menu) closeMenu(); });
  const fsB = ib('fs', 'full', T('studioPlFull'), () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); else wrap.requestFullscreen && wrap.requestFullscreen(); } catch (e) {}
  });
  top.append(ccB, gearB, fsB);
  const backB = ib('sm', 'back', T('studioPlBack'), () => jump(-10));
  const playB = ib('bg', 'play', T('studioPlPlay'), () => toggle());
  const fwdB = ib('sm', 'fwd', T('studioPlFwd'), () => jump(10));
  mid.append(backB, playB, fwdB);
  const time = el('div', 'st-pl-time'), cur = el('span'), tot = el('span');
  // הפרק הנוכחי באמצע שורת הזמן (כמו ב־YouTube) — נגיעה = רשימת הפרקים
  const chapB = el('button', 'st-pl-chb'); chapB.type = 'button'; chapB.hidden = true;
  const chapL = el('span', 'st-pl-chl'); chapL.dir = 'auto'; chapB.append(chapL, icon('chev'));
  chapB.addEventListener('click', (e) => { e.stopPropagation(); openMenu('c'); });
  time.append(cur, chapB, tot);
  const bar = el('div', 'st-pl-bar'), track = el('div', 'st-pl-track'), buf = el('i', 'buf'), played = el('i', 'pl'), knob = el('span', 'st-pl-knob');
  const heat = el('div', 'st-pl-heat'), marks = el('div', 'st-pl-chs');
  track.append(buf, played); bar.append(heat, track, marks, knob);
  bar.setAttribute('role', 'slider'); bar.setAttribute('aria-label', T('studioPlSeek')); bar.tabIndex = 0;
  bot.append(time, bar);
  ui.append(top, mid, bot);
  const rl = el('div', 'st-pl-rip l'), rr = el('div', 'st-pl-rip r');
  const err = el('div', 'st-pl-err'); err.hidden = true;
  wrap.append(v, sub, rl, rr, ui, err);

  /* ---- איכות: hls.js על הקבצים שהעובד ארז (opts.ladder), ברירת מחדל = המקור ---- */
  let pq = normPq(opts.pq), hls = null, levels = [], autoNow = -1, mode = 'file', altsNow = [];
  const ladder = Array.isArray(opts.ladder) && opts.ladder.length > 1 ? opts.ladder : null;
  function qNow() {
    if (mode !== 'hls' || !levels.length) return '';
    if (pq === 'auto') return T('studioPlAutoNow', { q: autoNow >= 0 && levels[autoNow] ? qLabel(levels[autoNow]) : '' }).replace(/\s*\(\)$/, '');
    const i = hls ? hls.currentLevel : -1;
    return i >= 0 && levels[i] ? qLabel(levels[i]) : '';
  }
  function paintHd() {
    const i = mode === 'hls' && hls ? (pq === 'auto' ? autoNow : hls.currentLevel) : -1;
    hdB.hidden = !(i >= 0 && levels[i] && qHd(levels[i]));
  }
  function setPq(next) {
    pq = normPq(next);
    if (hls && levels.length) hls.currentLevel = pickLevel(levels, pq);   // ידני — מיד (כמו ב־YouTube); אוטומטי — לפי החיבור
    if (opts.onPq) opts.onPq(pq);
    paintHd();
  }
  function toFile(t) {   // בלי hls (אין MSE / אין hls.js / תקלה) — הקובץ כמו קודם, מאותו מקום
    if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
    mode = 'file'; levels = []; altsNow = [];
    v.src = opts.src || opts.fallback || '';
    if (t) { const go = () => { v.currentTime = t; v.removeEventListener('loadedmetadata', go); }; v.addEventListener('loadedmetadata', go); }
    paintHd();
  }
  async function head(url) {
    let n = HEAD_BYTES;
    for (let k = 0; k < 3; k++) {
      const r = await fetch(url, { headers: { Range: 'bytes=0-' + (n - 1) } });
      if (!(r.status === 206 || r.status === 200)) throw new Error('head ' + r.status);
      const x = parseMp4Head(await r.arrayBuffer());
      if (!x) throw new Error('head');
      if (!x.need) return x;
      n = Math.min(x.need + 1024, 8 * 1024 * 1024);
    }
    throw new Error('head');
  }
  async function startHls() {
    try {
      if (!msOf()) throw new Error('mse');   // 25/10/2026: באייפון אין MediaSource — יש ManagedMediaSource (iOS 17.1+), ו־hls.js יודע לעבוד איתו
      // 22/10/2026: הקול המקורי שהטלפון לא מנגן (Dolby/DTS…) + עותק Opus → hls.js המלא (רצועות קול חלופיות — הגרסה המקוצרת
      // לא תומכת), והקול מוסר מהקטעים. טלפון שמנגן את הקול המקורי — כמו קודם, בקול המקורי
      const isType = (t) => msOf().isTypeSupported(t);
      // 23/10/2026: כמה רצועות קול — תמיד דרך העותקים (MSE מנגן רק רצועה אחת מהקובץ), כדי שאפשר יהיה לבחור
      const alts0 = (opts.alt ? (Array.isArray(opts.alt) ? opts.alt : [opts.alt]) : []).filter((a) => a && a.url);
      const alts = alts0.length && (alts0.length > 1 || !audioPlayable(ladder[0].c, isType)) && isType('audio/mp4; codecs="opus"') ? alts0 : null;
      const alt = alts ? alts[0] : null;
      altsNow = alts && alts.length > 1 ? alts : [];
      const full = './vendor/hls/hls.min.js';
      if (!window.Hls || (alt && !window.HlsAlt)) { await import(alt ? full : (opts.hlsUrl || './vendor/hls/hls.light.min.js')); if (alt) window.HlsAlt = true; }
      const Hls = window.Hls;
      if (!Hls || !Hls.isSupported()) throw new Error('hls');
      const heads = await Promise.all(ladder.map((l) => head(l.url).catch(() => null)));
      if (!heads[0] || destroyed) throw new Error('top');
      const ahs = alts ? await Promise.all(alts.map((a) => head(a.url).catch(() => null))) : [];
      if (alts && ahs.some((x) => !x)) throw new Error('alt');
      const texts = new Map(), base = new URL('./studio-pl/', location.href).href, lv = [];
      ladder.forEach((l, i) => {
        if (!heads[i]) return;
        const uri = base + i + '.m3u8';
        texts.set(uri, mediaPlaylist(l.url, heads[i].init, groupSegs(heads[i].segs)));
        lv.push(Object.assign({}, l, { uri }));
      });
      (alts || []).forEach((a, i) => texts.set(base + 'a' + i + '.m3u8', mediaPlaylist(a.url, ahs[i].init, groupSegs(ahs[i].segs))));
      texts.set(base + 'm.m3u8', masterPlaylist(lv, alts ? alts.map((a, i) => Object.assign({}, a, { uri: base + 'a' + i + '.m3u8' })) : null));
      const Base = Hls.DefaultConfig.loader;
      const strip = new Map();   // לכל קובץ (כתובת): מזהי רצועות הקול שהוסרו מהאתחול שלו
      class FL extends Base {    // הקטעים של הווידאו — בלי רצועת הקול המקורית
        load(ctx, cfg, cb) {
          const frag = ctx.frag, ok = cb.onSuccess;
          if (alt && frag && frag.type === 'main') {
            cb = Object.assign({}, cb, { onSuccess: (r, st, c, n) => {
              if (r && r.data instanceof ArrayBuffer) {
                const key = String(ctx.url).split('#')[0];
                if (frag.sn === 'initSegment') { const x = stripInitAudio(r.data); strip.set(key, x.ids); r.data = x.data.buffer; }
                else r.data = stripFragAudio(r.data, strip.get(key) || []).buffer;
              }
              ok(r, st, c, n);
            } });
          }
          super.load(ctx, cfg, cb);
        }
      }
      class PL extends Base {   // הרשימות נבנו כאן — בלי רשת
        load(ctx, cfg, cb) {
          const t = texts.get(ctx.url);
          if (t == null) { super.load(ctx, cfg, cb); return; }
          const st = this.stats, now = performance.now();
          st.loading.start = st.loading.first = st.loading.end = now; st.loaded = st.total = t.length;
          setTimeout(() => cb.onSuccess({ url: ctx.url, data: t }, st, ctx, null), 0);
        }
      }
      hls = new Hls({ pLoader: PL, ...(alt ? { fLoader: FL } : {}), enableWorker: false, capLevelToPlayerSize: false, startLevel: -1, abrEwmaDefaultEstimate: 4e6,
        maxBufferLength: 30, backBufferLength: 30, fragLoadPolicy: { default: { maxTimeToFirstByteMs: 15000, maxLoadTimeMs: 120000,
          timeoutRetry: { maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0 }, errorRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 8000 } } } });
      let healed = false;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        levels = hls.levels.slice();
        mode = 'hls';
        const i = pickLevel(levels, pq);
        if (i >= 0) { hls.startLevel = i; hls.currentLevel = i; }
        if (altsNow.length > 1) setAudio(pickAudio(altsNow, pref.a));   // 23/10/2026: הקול שנבחר (שפה) / ברירת המחדל של הקובץ
        paintHd();
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (e, d) => { autoNow = d.level; paintHd(); if (!menu.hidden) openMenu(menu.dataset.p || ''); });
      hls.on(Hls.Events.ERROR, (e, d) => {
        if (!d || !d.fatal) return;
        if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !healed) { healed = true; hls.recoverMediaError(); return; }
        toFile(v.currentTime || 0);
      });
      hls.attachMedia(v);
      hls.loadSource(base + 'm.m3u8');
    } catch (e) {
      if (!destroyed) toFile(0);
    }
  }

  /* ---- התפריט ---- */
  const speedName = (r) => (r === 1 ? T('studioPlNormal') : r + '×');
  function mRow(k, label, val, fn, opt) {
    const b = el('button', 'st-pl-mr' + (opt && opt.on ? ' on' : '')); b.type = 'button';
    if (k) b.append(icon(k)); else { const c = el('span', 'st-pl-mc'); if (opt && opt.on) c.append(icon('check')); b.append(c); }
    const t = el('span', 'st-pl-ml', label);
    if (opt && opt.tm) { t.dir = 'auto'; b.append(el('span', 'st-pl-mt', opt.tm)); }
    if (opt && opt.hd) t.append(el('sup', 'st-pl-mhd', 'HD'));
    b.append(t);
    if (val != null) { b.append(el('span', 'st-pl-mv', val)); b.append(icon('chev')); }
    if (opt && opt.on) b.setAttribute('aria-checked', 'true');
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
    return b;
  }
  function openMenu(page) {
    const box = el('div', 'st-pl-mbox');
    menu.dataset.p = page;
    menu.dir = (typeof document !== 'undefined' && document.documentElement.dir) || 'rtl';
    if (!page) {
      if (mode === 'hls' && levels.length > 1) box.append(mRow('tune', T('studioPlQuality'), qNow(), () => openMenu('q')));
      box.append(mRow('speed', T('studioPlSpeed'), speedName(v.playbackRate), () => openMenu('s')));
      const ai = audNow();
      if (ai >= 0) box.append(mRow('aud', T('studioPlAudio'), altName(audList()[ai], ai, T, uiLang()), () => openMenu('a')));
      if (cues.length && !ccB.disabled) box.append(mRow('cc', T('studioPlCc'), ccName(cc), () => openMenu('t')));
      if (chs.length) box.append(mRow('chap', T('studioPlChaps'), String(chs.length), () => openMenu('c')));
    } else {
      box.append(mRow('prev', page === 'q' ? T('studioPlQuality') : page === 'c' ? T('studioPlChaps') : page === 'a' ? T('studioPlAudio') : page === 't' ? T('studioPlCc') : T('studioPlSpeed'), null, () => openMenu('')));
      box.lastChild.classList.add('st-pl-mhead');
      if (page === 'q') {
        const order = levels.map((l, i) => i).sort((a, b) => qShort(levels[b]) - qShort(levels[a]) || (levels[b].bitrate || 0) - (levels[a].bitrate || 0));
        const top = order[0];
        box.append(mRow('', pq === 'auto' ? qNow() : T('studioPlAuto'), null, () => { setPq('auto'); closeMenu(); }, { on: pq === 'auto' }));
        for (const i of order) {
          const l = levels[i], sel = pq !== 'auto' && hls && hls.currentLevel === i;
          box.append(mRow('', i === top ? T('studioPlSrcQ', { q: qLabel(l) }) : qLabel(l), null,
            () => { setPq(i === top ? 'src' : qShort(l)); closeMenu(); }, { on: sel, hd: qHd(l) }));
        }
      } else if (page === 'a') {
        const L = audList(), ai = audNow(), auto = pickAudio(L, '');
        box.append(mRow('', T('studioPlAutoNow', { q: altName(L[auto], auto, T, uiLang()) }), null, () => { savePref({ a: '' }); setAudio(auto); closeMenu(); }, { on: !pref.a && !audManual }));
        L.forEach((a, i) => box.append(mRow('', altName(a, i, T, uiLang()), null, () => {
          audManual = true; if (a.l) savePref({ a: a.l }); setAudio(i); closeMenu();
        }, { on: (!!pref.a || audManual) && i === ai })));
      } else if (page === 't' && opts.burned) {   // צרוב: כבויות / המקור באנגלית מעל
        for (const m of ['off', 'en']) box.append(mRow('', ccName(m), null, () => { setCc(m); closeMenu(); }, { on: cc === m }));
      } else if (page === 't') {
        const en = hasEn();
        box.append(mRow('', T('studioPlAutoNow', { q: ccName(ccAuto()) }), null, () => { savePref({ cc: '' }); setCc(ccAuto()); closeMenu(); }, { on: !pref.cc }));
        for (const m of CC_MODES) {
          if ((m === 'en' || m === 'both') && !en) continue;
          box.append(mRow('', ccName(m), null, () => { savePref({ cc: m }); setCc(m); closeMenu(); }, { on: !!pref.cc && cc === m }));
        }
      } else if (page === 'c') {
        const ci = chapterAt(chs, v.currentTime || 0);
        chs.forEach((c, i) => box.append(mRow('', c.title, null, () => { seekTo(c.t); closeMenu(); }, { on: i === ci, tm: fmtT(c.t) })));
      } else {
        for (const r of [0.5, 0.75, 1, 1.25, 1.5, 2]) {
          box.append(mRow('', speedName(r), null, () => { v.playbackRate = r; closeMenu(); }, { on: v.playbackRate === r }));
        }
      }
    }
    menu.replaceChildren(box);
    // מחוץ למסך מלא — גיליון בתחתית המסך (הנגן נמוך מדי לרשימה של 9 איכויות); במסך מלא — בתוך הנגן
    const host = typeof document !== 'undefined' && document.fullscreenElement === wrap ? wrap : document.body;
    if (menu.parentNode !== host) host.append(menu);
    menu.classList.toggle('in', host === wrap);
    menu.hidden = false;
    wrap.classList.add('menu');
    clearTimeout(hideT);
  }
  let audManual = false;
  function ccName(m) { return m === 'off' ? T('studioPlCcOff') : m === 'en' ? T('studioPlCcEnL') : m === 'both' ? T('studioPlCcBothL') : T('studioPlCcHeL'); }
  function setCc(m) { cc = m; paintCc(); paintSub(); }
  function setAudio(i) {
    if (fileAud()) { setFileAudio(i); return; }
    if (!hls || i < 0) return;
    if (hls.audioTrack !== i) hls.audioTrack = i;
    if (!pref.cc) setCc(ccAuto());               // הכתוביות האוטומטיות תלויות בשפת הקול
  }
  // 23/10/2026: כמה רצועות קול — הרצועה שמתנגנת עכשיו (hls.audioTracks באותו סדר של העותקים), ‎-1 = אין בחירה
  function audNow() {
    if (fileAud()) return fNow;
    if (mode !== 'hls' || !hls || altsNow.length < 2 || !hls.audioTracks || hls.audioTracks.length !== altsNow.length) return -1;
    return Math.max(0, Math.min(altsNow.length - 1, hls.audioTrack | 0));
  }
  // 25/10/2026: קובץ מקומי עם כמה רצועות קול (localFile)
  let ftr = [], fNow = 0, fBridge = null, fSeq = 0;
  const fileAud = () => mode === 'file' && ftr.length > 1;
  const audList = () => (fileAud() ? ftr : altsNow);
  const isTypeA = (t) => { try { const M = msOf(); return !!(M && M.isTypeSupported(t)); } catch (e) { return false; } };
  async function setFileAudio(i, force) {
    if (i < 0 || i >= ftr.length || (i === fNow && !force)) return;
    const seq = ++fSeq;
    fNow = i;
    if (fBridge) { fBridge.destroy(); fBridge = null; }
    if (!fileNeedsBridge(ftr, i, isTypeA)) { v.muted = false; wrap.classList.remove('ab'); }
    else {
      try {
        const D = await (opts.decodeTrack || localDecode)(opts.localFile, ftr[i].i);
        if (destroyed || seq !== fSeq) return;
        if (!D) throw new Error('decode');
        v.muted = true;
        fBridge = createAudioBridge(v, D.open, D.ctx, { vol: () => (v.volume == null ? 1 : v.volume), onError: () => {} });
        wrap.classList.add('ab');
      } catch (e) { if (seq === fSeq) { fNow = 0; v.muted = false; } }
    }
    if (!pref.cc && !opts.burned) setCc(ccAuto());
  }
  async function fileTracks() {
    if (!opts.localFile) return;
    try {
      const list = await (opts.listTracks || localTracks)(opts.localFile);
      if (destroyed || !list || !list.length) return;
      if (list.length < 2 && !fileNeedsBridge(list, 0, isTypeA)) return;
      ftr = list.length > 1 ? list : [];
      if (!ftr.length) { ftr = list; await setFileAudio(0, true); ftr = []; return; }   // רצועה אחת שהדפדפן לא מכיר
      const want = pickAudio(ftr, pref.a);
      await setFileAudio(want, true);
    } catch (e) {}
  }
  function uiLang() { return (typeof document !== 'undefined' && document.documentElement.lang) || 'he'; }
  function closeMenu() { menu.hidden = true; wrap.classList.remove('menu'); poke(); }
  wrap.addEventListener('fullscreenchange', () => { if (!menu.hidden) closeMenu(); });

  function paintCc() {
    ccB.classList.toggle('on', cc !== 'off');
    ccL.textContent = cc === 'en' ? T('studioPlCcEn') : cc === 'he' ? T('studioPlCcHe') : cc === 'both' ? T('studioPlCcBoth') : '';
    ccB.setAttribute('aria-pressed', cc !== 'off' ? 'true' : 'false');
  }
  let shown = -2;
  function paintSub() {
    const i = cc === 'off' ? -1 : cueAt(cues, v.currentTime);
    const key = i + cc;
    if (key === shown) return;
    shown = key;
    sub.replaceChildren();
    if (i < 0) return;
    const c = cues[i];
    const lines = cc === 'en' ? (c.en ? [c.en] : []) : c.lines;
    sub.dir = cc === 'en' ? 'ltr' : 'rtl';
    for (const x of lines) { const d = el('div'); d.append(el('span', null, x)); sub.append(d); }   // span — הרקע של "עם רקע" לפי אורך השורה
    if (cc === 'both' && c.en) { const d = el('div', 'st-pl-sub2'); d.dir = 'ltr'; d.append(el('span', null, c.en)); sub.append(d); }   // 23/10/2026: שתי השפות — המקור מתחת
  }
  function paintBar() {
    const d = v.duration || 0, t = v.currentTime || 0, f = d > 0 ? Math.min(1, t / d) : 0;
    played.style.width = (f * 100) + '%';
    knob.style.left = (f * 100) + '%';
    let b = 0;
    try { for (let i = 0; i < v.buffered.length; i++) if (v.buffered.start(i) <= t) b = Math.max(b, v.buffered.end(i)); } catch (e) {}
    buf.style.width = (d > 0 ? Math.min(1, b / d) * 100 : 0) + '%';
    cur.textContent = fmtT(t); tot.textContent = d > 0 ? fmtT(d) : '';
    bar.setAttribute('aria-valuenow', String(Math.round(t))); bar.setAttribute('aria-valuemax', String(Math.round(d)));
  }
  function paintHeat() {
    heat.replaceChildren();
    const d = v.duration || 0;
    if (!(d > 0) || !issues.length) return;
    const bins = heatBins(issues, d, 60);
    bins.forEach((h, i) => { if (h > 0) { const s = el('i'); s.style.left = (i / 60 * 100) + '%'; s.style.height = Math.max(20, h * 100) + '%'; heat.append(s); } });
  }
  function paintChap() {
    const i = chs.length ? chapterAt(chs, v.currentTime || 0) : -1;
    if (i === chNow) return;
    chNow = i;
    chapB.hidden = i < 0;
    chapL.textContent = i >= 0 ? chs[i].title : '';
    chapB.setAttribute('aria-label', i >= 0 ? T('studioPlChapNow', { t: chs[i].title }) : '');
  }
  function paintMarks() {   // מפרידים על הפס בתחילת כל פרק (חוץ מהראשון)
    marks.replaceChildren();
    const d = v.duration || 0;
    if (!(d > 0) || !Number.isFinite(d)) return;   // סרטון בלי אורך ידוע (עדיין) — בלי מפרידים; durationchange יצייר
    for (const c of chs) if (c.t > 0.5 && c.t < d - 0.5) { const m = el('i'); m.style.left = (c.t / d * 100) + '%'; marks.append(m); }
  }
  function seekTo(t) { v.currentTime = Math.max(0, t || 0); paintBar(); paintSub(); paintChap(); poke(); }
  function paintPlay() {
    playB.replaceChildren(icon(v.paused ? 'play' : 'pause'));
    playB.setAttribute('aria-label', v.paused ? T('studioPlPlay') : T('studioPlPause'));
  }
  function poke() {
    wrap.classList.remove('hide');
    clearTimeout(hideT);
    if (!v.paused) hideT = setTimeout(() => { if (!dragging && menu.hidden) wrap.classList.add('hide'); }, 2800);
  }
  function toggle() { if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); } else v.pause(); poke(); }
  function jump(dt) {
    const d = v.duration || 0;
    v.currentTime = Math.max(0, Math.min(d > 0 ? d - 0.05 : Infinity, (v.currentTime || 0) + dt));
    const r = dt < 0 ? rl : rr;
    r.textContent = (dt < 0 ? '−' : '+') + Math.abs(dt) + ' ' + T('studioPlSec');
    r.classList.add('on'); setTimeout(() => r.classList.remove('on'), 450);
    poke();
  }
  function seekX(x) {
    const r = bar.getBoundingClientRect(), d = v.duration || 0;
    if (!(r.width > 0) || !(d > 0)) return;
    v.currentTime = Math.max(0, Math.min(1, (x - r.left) / r.width)) * d;
    paintBar(); paintSub();
  }
  // נגיעה: אחת = הצגה/הסתרה של הפקדים; כפולה בשליש הימני/השמאלי = ±10 (כמו ב־YouTube; לפי הצד הפיזי, גם ב־RTL)
  wrap.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.st-pl-b, .st-pl-bar')) return;
    const now = Date.now(), r = wrap.getBoundingClientRect(), x = (e.clientX - r.left) / Math.max(1, r.width);
    if (now - lastTap < 300 && (x < 0.35 || x > 0.65)) { clearTimeout(tapT); lastTap = 0; jump(x < 0.35 ? -10 : 10); return; }
    lastTap = now;
    clearTimeout(tapT);
    tapT = setTimeout(() => { if (wrap.classList.contains('hide')) poke(); else if (!v.paused) wrap.classList.add('hide'); }, 280);
  });
  bar.addEventListener('pointerdown', (e) => { dragging = true; try { bar.setPointerCapture(e.pointerId); } catch (x) {} seekX(e.clientX); poke(); e.stopPropagation(); });
  bar.addEventListener('pointermove', (e) => { if (dragging) seekX(e.clientX); });
  const endDrag = () => { if (dragging) { dragging = false; poke(); } };
  bar.addEventListener('pointerup', endDrag); bar.addEventListener('pointercancel', endDrag);
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); jump(e.key === 'ArrowRight' ? 5 : -5); }
    else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggle(); }
  });
  v.addEventListener('timeupdate', () => { paintBar(); paintSub(); paintChap(); if (opts.onTime) opts.onTime(v.currentTime); });
  v.addEventListener('progress', paintBar);
  v.addEventListener('loadedmetadata', () => { paintBar(); paintHeat(); paintMarks(); });
  v.addEventListener('durationchange', () => { paintHeat(); paintMarks(); });
  v.addEventListener('play', () => { paintPlay(); poke(); });
  v.addEventListener('pause', () => { paintPlay(); poke(); });
  v.addEventListener('error', () => {
    if (hls) return;   // ב־hls התקלות מגיעות מ־hls.js (ERROR) — שם הנפילה לקובץ
    if (opts.fallback && v.src.indexOf(opts.fallback) < 0) {   // המקור לא מתנגן (קודק / MKV) — הסרטון הצרוב, בלי כתוביות מעליו
      const t = v.currentTime || 0;
      cc = 'off'; paintCc(); paintSub(); ccB.disabled = true;
      v.src = opts.fallback; v.currentTime = t;
      return;
    }
    err.hidden = false; err.textContent = T('studioPlErr');
    if (opts.onError) opts.onError();
  });
  // רצועת הזמנים של הכתוביות — גם כשהווידאו עומד (seek ידני)
  v.addEventListener('seeked', () => { paintBar(); paintSub(); paintChap(); });

  paintCc(); paintPlay(); paintBar(); paintChap();
  if (opts.burned) ccB.disabled = !hasEn();
  if (ladder && !opts.burned) startHls(); else v.src = opts.src || opts.fallback || '';
  // 22/10/2026: קול Dolby שהטלפון לא מנגן — פענוח בדפדפן (רק כשמנגנים קובץ, לא hls — שם יש עותק Opus)
  let bridge = null, bridgeSrc = '';
  async function audioFix() {
    const dec = opts.decodeAudio === undefined ? decodeDolby : opts.decodeAudio;
    if (!dec || destroyed || opts.localFile || mode !== 'file' || !v.currentSrc || bridgeSrc === v.currentSrc) return;
    bridgeSrc = v.currentSrc;
    if (bridge) { bridge.destroy(); bridge = null; }
    try {
      const D = await dec(v.currentSrc);
      if (!D || destroyed || bridgeSrc !== v.currentSrc) return;
      bridge = createAudioBridge(v, D.open, D.ctx, { onError: () => {} });
      wrap.classList.add('ab');
    } catch (e) {}
  }
  v.addEventListener('loadedmetadata', audioFix);
  if (opts.localFile) fileTracks();
  return {
    el: wrap, video: v,
    seek: seekTo,
    setPoster,
    play() { const p = v.play(); if (p && p.catch) p.catch(() => {}); },
    pause() { v.pause(); },
    setCues(c, iss) {
      cues = c || []; issues = iss || issuesList(cues); shown = -2;
      if (opts.burned) ccB.disabled = !hasEn();
      if (!ccB.disabled) { cc = resolveCc(pref.cc, ccAuto(), hasEn(), !!opts.burned); paintCc(); }   // 23/10/2026: הכתוביות הגיעו — ברירת המחדל מחדש
      paintSub(); paintHeat();
    },
    /* סבב 5: תצוגה של העיצוב (גודל, צבע, רקע, גובה) — כמו שהצריבה תצא, בקירוב */
    setStyle(o) {
      const st = normSty(o) || {};
      wrap.style.setProperty('--sub-k', String((st.k || 100) / 100));
      wrap.style.setProperty('--sub-c', STY_COLORS[st.c || 'w']);
      wrap.style.setProperty('--sub-lift', (st.y || 0) + '%');
      wrap.classList.toggle('boxed', !!st.bx);
    },
    setChapters(c) { chs = normChapters(c); chNow = -2; paintChap(); paintMarks(); if (!menu.hidden && menu.dataset.p === 'c') openMenu('c'); },
    chapters: () => chs.slice(),   // QA ובדיקות
    quality: () => ({ mode, pq, levels: levels.map(qLabel), now: qNow() }),   // QA ובדיקות
    audioBridge: () => (bridge ? bridge.state() : fBridge ? fBridge.state() : null),   // QA ובדיקות
    audio: () => ({ list: audList().map((a) => a.l || ''), now: audNow() }),             // QA ובדיקות
    destroy() {
      if (destroyed) return; destroyed = true; clearTimeout(hideT); clearTimeout(tapT);
      if (bridge) { bridge.destroy(); bridge = null; }
      if (fBridge) { fBridge.destroy(); fBridge = null; }
      if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
      menu.remove();
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
    },
  };
}
