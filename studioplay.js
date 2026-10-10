/* מ1 (10/10/2026): הנגן של סטודיו התרגום — בסגנון YouTube.
   הסרטון המקורי מ־Drive (דרך ה־Service Worker, ./studio-media/<id>) והכתוביות מעליו (עברית / שפת המקור / כבויות),
   נגיעה כפולה בצד = ±10 שנ׳, מהירות, ובפס ההתקדמות — מפת האזהרות (כתוביות שלא עומדות בכללים) כמו "הכי נצפה" ב־YouTube.
   הלוגיקה טהורה (נבדקת ב־node); ה־DOM נבנה רק ב־createPlayer. בלי רשת — studio.js נותן כתובת וכתוביות. */

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
export function nextCc(cc, hasEn) { return cc === 'he' ? (hasEn ? 'en' : 'off') : cc === 'en' ? 'off' : 'he'; }

/* ---------------- איכויות צפייה כמו ב־YouTube (10/10/2026) ----------------
   העובד (translator/ladder.py) אורז את המקור עצמו מחדש — אותו קובץ, אותם זרמים, בלי קידוד — ומוסיף איכויות נמוכות קטנות.
   כל קובץ = MP4 מקוטע עם אינדקס (sidx) בתחילתו. כאן: קוראים את תחילת כל קובץ (בקשת טווח אחת), בונים ממנה רשימות HLS
   עם טווחי בתים, ו־hls.js בוחר איכות (אוטומטי לפי מהירות החיבור, או ידני). אותו דבר יעבוד מ־R2 — רק כתובת אחרת לקובץ.
   ברירת המחדל = המקור (האיכות הכי טובה — בקשת המשתמש); "אוטומטי" — בתפריט ההגדרות, כמו ב־YouTube. */
export const HEAD_BYTES = 256 * 1024;
export const SEG_TARGET = 6, SEG_MAX_BYTES = 24 * 1024 * 1024;   // קטע ~6 שנ׳; לא מעל 24MB (= תקרת הטווח המפורש ב־sw.js)
export const Q_HEIGHTS = [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144];
const C_RE = /^[A-Za-z0-9.]{3,40}(,[A-Za-z0-9.]{3,40})?$/;
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
export function masterPlaylist(levels) {
  const L = ['#EXTM3U', '#EXT-X-VERSION:7', '#EXT-X-INDEPENDENT-SEGMENTS'];
  for (const l of levels) {
    L.push('#EXT-X-STREAM-INF:BANDWIDTH=' + l.bw + ',AVERAGE-BANDWIDTH=' + l.abw + ',RESOLUTION=' + l.w + 'x' + l.h + ',CODECS="' + l.c + '"', l.uri);
  }
  return L.join('\n') + '\n';
}

/* ---------------- הנגן (DOM) ---------------- */
const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  back: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z', fwd: 'M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z',
  cc: 'M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1z',
  full: 'M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z',
  gear: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.7 7.7 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.7 7.7 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.7 7.7 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.7 7.7 0 0 0 1.7-1l2.5 1 2-3.5zM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
  tune: 'M3 17v2h6v-2zm0-12v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z',
  speed: 'M20.4 8.6 19 10a8 8 0 0 1-.9 8H5.9A8 8 0 0 1 16.1 6l1.4-1.4A10 10 0 0 0 4.2 19l.3.5h15l.3-.5a10 10 0 0 0 .6-10.4zM10.6 15.4a2 2 0 0 0 2.8 0l5.7-8.5-8.5 5.7a2 2 0 0 0 0 2.8z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z', chev: 'M10 6 8.6 7.4 13.2 12l-4.6 4.6L10 18l6-6z', prev: 'M14 6l1.4 1.4L10.8 12l4.6 4.6L14 18l-6-6z',
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

/* opts: { src, fallback, cues, issues, T, burned } — fallback = כתובת לסרטון הצרוב אם המקור לא מתנגן (אז בלי כתוביות מעליו).
   מחזיר { el, video, seek, play, pause, setCues, destroy }. el יציב — studio.js משאיר אותו בין ציורים (וידאו שמוצא מהמסמך נעצר) */
export function createPlayer(opts) {
  const T = opts.T || ((k) => k);
  let cues = opts.cues || [], issues = opts.issues || [];
  let cc = opts.burned ? 'off' : 'he', hideT = 0, lastTap = 0, tapT = 0, dragging = false, destroyed = false;
  const wrap = el('div', 'st-pl'); wrap.dir = 'ltr';
  const v = el('video', 'st-pl-v'); v.playsInline = true; v.preload = 'metadata'; v.setAttribute('playsinline', '');
  const sub = el('div', 'st-pl-sub'); sub.dir = 'rtl'; sub.setAttribute('aria-live', 'off');
  const ui = el('div', 'st-pl-ui');
  const top = el('div', 'st-pl-top'), mid = el('div', 'st-pl-mid'), bot = el('div', 'st-pl-bot');
  const ccB = ib('cc', 'cc', T('studioPlCc'), () => { cc = nextCc(cc, cues.some((c) => c.en)); paintCc(); paintSub(); });
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
  time.append(cur, tot);
  const bar = el('div', 'st-pl-bar'), track = el('div', 'st-pl-track'), buf = el('i', 'buf'), played = el('i', 'pl'), knob = el('span', 'st-pl-knob');
  const heat = el('div', 'st-pl-heat');
  track.append(buf, played); bar.append(heat, track, knob);
  bar.setAttribute('role', 'slider'); bar.setAttribute('aria-label', T('studioPlSeek')); bar.tabIndex = 0;
  bot.append(time, bar);
  ui.append(top, mid, bot);
  const rl = el('div', 'st-pl-rip l'), rr = el('div', 'st-pl-rip r');
  const err = el('div', 'st-pl-err'); err.hidden = true;
  wrap.append(v, sub, rl, rr, ui, err);

  /* ---- איכות: hls.js על הקבצים שהעובד ארז (opts.ladder), ברירת מחדל = המקור ---- */
  let pq = normPq(opts.pq), hls = null, levels = [], autoNow = -1, mode = 'file';
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
    mode = 'file'; levels = [];
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
      if (typeof window === 'undefined' || !window.MediaSource) throw new Error('mse');
      if (!window.Hls) await import(opts.hlsUrl || './vendor/hls/hls.light.min.js');
      const Hls = window.Hls;
      if (!Hls || !Hls.isSupported()) throw new Error('hls');
      const heads = await Promise.all(ladder.map((l) => head(l.url).catch(() => null)));
      if (!heads[0] || destroyed) throw new Error('top');
      const texts = new Map(), base = new URL('./studio-pl/', location.href).href, lv = [];
      ladder.forEach((l, i) => {
        if (!heads[i]) return;
        const uri = base + i + '.m3u8';
        texts.set(uri, mediaPlaylist(l.url, heads[i].init, groupSegs(heads[i].segs)));
        lv.push(Object.assign({}, l, { uri }));
      });
      texts.set(base + 'm.m3u8', masterPlaylist(lv));
      const Base = Hls.DefaultConfig.loader;
      class PL extends Base {   // הרשימות נבנו כאן — בלי רשת
        load(ctx, cfg, cb) {
          const t = texts.get(ctx.url);
          if (t == null) { super.load(ctx, cfg, cb); return; }
          const st = this.stats, now = performance.now();
          st.loading.start = st.loading.first = st.loading.end = now; st.loaded = st.total = t.length;
          setTimeout(() => cb.onSuccess({ url: ctx.url, data: t }, st, ctx, null), 0);
        }
      }
      hls = new Hls({ pLoader: PL, enableWorker: false, capLevelToPlayerSize: false, startLevel: -1, abrEwmaDefaultEstimate: 4e6,
        maxBufferLength: 30, backBufferLength: 30, fragLoadPolicy: { default: { maxTimeToFirstByteMs: 15000, maxLoadTimeMs: 120000,
          timeoutRetry: { maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0 }, errorRetry: { maxNumRetry: 3, retryDelayMs: 1000, maxRetryDelayMs: 8000 } } } });
      let healed = false;
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        levels = hls.levels.slice();
        mode = 'hls';
        const i = pickLevel(levels, pq);
        if (i >= 0) { hls.startLevel = i; hls.currentLevel = i; }
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
    } else {
      box.append(mRow('prev', page === 'q' ? T('studioPlQuality') : T('studioPlSpeed'), null, () => openMenu('')));
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
  function closeMenu() { menu.hidden = true; wrap.classList.remove('menu'); poke(); }
  wrap.addEventListener('fullscreenchange', () => { if (!menu.hidden) closeMenu(); });

  function paintCc() {
    ccB.classList.toggle('on', cc !== 'off');
    ccL.textContent = cc === 'en' ? T('studioPlCcEn') : cc === 'he' ? T('studioPlCcHe') : '';
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
    for (const x of lines) { const d = el('div', null, x); sub.append(d); }
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
  v.addEventListener('timeupdate', () => { paintBar(); paintSub(); if (opts.onTime) opts.onTime(v.currentTime); });
  v.addEventListener('progress', paintBar);
  v.addEventListener('loadedmetadata', () => { paintBar(); paintHeat(); });
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
  v.addEventListener('seeked', () => { paintBar(); paintSub(); });

  paintCc(); paintPlay(); paintBar();
  if (opts.burned) ccB.disabled = true;
  if (ladder && !opts.burned) startHls(); else v.src = opts.src || opts.fallback || '';
  return {
    el: wrap, video: v,
    seek(t) { v.currentTime = Math.max(0, t || 0); paintBar(); paintSub(); poke(); },
    play() { const p = v.play(); if (p && p.catch) p.catch(() => {}); },
    pause() { v.pause(); },
    setCues(c, iss) { cues = c || []; issues = iss || issuesList(cues); shown = -2; paintSub(); paintHeat(); },
    quality: () => ({ mode, pq, levels: levels.map(qLabel), now: qNow() }),   // QA ובדיקות
    destroy() {
      if (destroyed) return; destroyed = true; clearTimeout(hideT); clearTimeout(tapT);
      if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
      menu.remove();
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
    },
  };
}
