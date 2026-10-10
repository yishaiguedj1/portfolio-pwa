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

/* ---------------- הנגן (DOM) ---------------- */
const SVG = 'http://www.w3.org/2000/svg';
const PATHS = {
  play: 'M8 5v14l11-7z', pause: 'M6 5h4v14H6zm8 0h4v14h-4z',
  back: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z', fwd: 'M12 5V1l5 5-5 5V7a6 6 0 1 0 6 6h2a8 8 0 1 1-8-8z',
  cc: 'M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1z',
  full: 'M7 14H5v5h5v-2H7zm-2-4h2V7h3V5H5zm12 7h-3v2h5v-5h-2zM14 5v2h3v3h2V5z',
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
  const spB = el('button', 'st-pl-b sp'); spB.type = 'button'; spB.setAttribute('aria-label', T('studioPlSpeed'));
  spB.addEventListener('click', (e) => { e.stopPropagation(); v.playbackRate = nextSpeed(v.playbackRate); spB.textContent = v.playbackRate + '×'; poke(); });
  spB.textContent = '1×';
  const fsB = ib('fs', 'full', T('studioPlFull'), () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); else wrap.requestFullscreen && wrap.requestFullscreen(); } catch (e) {}
  });
  top.append(ccB, spB, fsB);
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
    if (!v.paused) hideT = setTimeout(() => { if (!dragging) wrap.classList.add('hide'); }, 2800);
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
  v.src = opts.src || opts.fallback || '';
  return {
    el: wrap, video: v,
    seek(t) { v.currentTime = Math.max(0, t || 0); paintBar(); paintSub(); poke(); },
    play() { const p = v.play(); if (p && p.catch) p.catch(() => {}); },
    pause() { v.pause(); },
    setCues(c, iss) { cues = c || []; issues = iss || issuesList(cues); shown = -2; paintSub(); paintHeat(); },
    destroy() { if (destroyed) return; destroyed = true; clearTimeout(hideT); clearTimeout(tapT); try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {} },
  };
}
