/* דף הצפייה ששותף בקישור (11/11/2026, בקשת המשתמש: "לשתף את התוצאה עם חבר בקישור — רק צפייה והורדה, בלי עריכה").
   share.html#<טוקן> — בלי התחברות, בלי Firebase ובלי service worker. הטוקן אחרי ה־# — לא נשלח לשרת של הדפים ולא ב־Referer.
   השרתון (op:'shareView' — ibkr-proxy/api/studio.js → shareOp, ‏lib/studioshare.js) מחזיר רק את מה שבדף התוצאה וקישורים
   חתומים ל־R2 לשעה; הורדה = op:'shareGet' (קישור טרי עם שם הקובץ). הנגן = createPlayer של התרגום; ניתוח = renderVi במצב
   קריאה בלבד (ro — בלי "דווח על טעות"). אין כאן שום פעולה שמשנה משהו. כל טקסט מהעבודה — textContent בלבד.
   המחרוזות — strings-share.js (tools/coregen.js, ‏APPS.share). שמות התוצרים — אותם מפתחות של outName ב־studio.js
   (tests/studio-share.test.js משווה). */
import { createPlayer, normCues, normChapters, fmtT } from './studioplay.js';
import { normVi, renderVi, imgRange } from './studiovi.js';

const IS_DOC = typeof document !== 'undefined';
export const shareLang = (langs) => ((Array.isArray(langs) ? langs : []).some((l) => /^(he|iw)\b/i.test(String(l || ''))) ? 'he' : 'en');
const LANG = shareLang(typeof navigator !== 'undefined' ? navigator.languages || [navigator.language] : []);
export function T(key, vars) {
  const S = typeof STRINGS !== 'undefined' ? STRINGS : { he: {}, en: {} };   // eslint-disable-line no-undef
  let s = (S[LANG] && S[LANG][key]) || S.he[key] || key;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}
/* הטוקן מה־# — אותה צורה כמו בשרתון (‎<עבודה>.<סוד>) */
export const TOKEN_RE = /^j[A-Za-z0-9_-]{20}\.[A-Za-z0-9_-]{43}$/;   // הסוד = 32 בתים (16 אקראיים + תג HMAC) ב־base64url
export const tokenFrom = (hash) => { let t = ''; try { t = decodeURIComponent(String(hash || '').replace(/^#/, '')); } catch (e) {} return TOKEN_RE.test(t) ? t : ''; };

/* שמות התוצרים — אותם מפתחות של outName/outShort ב־studio.js */
export const OUT_LABEL = { same: 'studioOutSameShort', compact: 'studioOutCompact', mkv: 'studioOutMkv', small: 'studioOutSmall', en: 'studioOutEnShort',
  inst: 'studioOutInst', lrc: 'studioOutLrc', elrc: 'studioOutElrc', lyr: 'studioOutLyr', vi: 'studioOutVi', srt: 'studioOutSrt' };
const VIDEO = ['compact', 'same', 'mkv', 'small'];
export const outLabel = (k) => T(OUT_LABEL[k] || 'studioOutSrt');
export const fileTitle = (name) => { const t = String(name || '').replace(/\.[A-Za-z0-9]{1,5}$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim(); return t || String(name || ''); };
/* שם הקובץ בהורדה — כמו בטלפון: כתוביות "שם.he.srt", השאר "שם — <סוג>.<סיומת>" */
export function dlName(v, o) {
  const base = String(fileTitle(v && v.n) || 'video').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'video';
  if (o.k === 'srt' || o.k === 'en') return base + '.' + (o.k === 'en' ? 'en' : (v.to && v.to[0]) || 'he') + '.srt';
  const ext = /^[a-z0-9]{1,5}$/.test(String(o.x || '')) ? o.x : o.k === 'mkv' ? 'mkv' : o.k === 'vi' ? 'json' : VIDEO.includes(o.k) ? 'mp4' : 'txt';
  return base + ' — ' + outLabel(o.k) + '.' + ext;
}
export function fmtSize(n) {
  n = Math.max(0, Number(n) || 0);
  const G = 1073741824, M = 1048576;
  if (n >= G) return (n / G).toFixed(n >= 10 * G ? 0 : 1) + 'GB';
  if (n >= M) return Math.round(n / M) + 'MB';
  return Math.max(1, Math.round(n / 1024)) + 'KB';
}
const fmtDay = (ms) => { try { return new Intl.DateTimeFormat(LANG, { day: 'numeric', month: 'short', year: 'numeric' }).format(ms); } catch (e) { return ''; } };
/* איזה סרטון לנגן: תרגום — המקור עם הכתוביות כשיש (כמו בנגן שלך), אחרת הצרוב; קריוקי — הצרוב; ניתוח — המקור */
export function playPlan(k, play, hasCues) {
  const src = (play && play.src) || '', fb = (play && play.fb) || '';
  if (k === 'ka') return fb ? { src: fb, fallback: '', burned: true } : src ? { src, fallback: '', burned: false } : null;
  if (k === 'vi') return src || fb ? { src: src || fb, fallback: src ? fb : '', burned: false } : null;
  if (src && (hasCues || !fb)) return { src, fallback: fb, burned: false };
  return fb ? { src: fb, fallback: '', burned: true } : null;
}

/* ---------- הדף ---------- */
const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
function btn(cls, label, onClick, k) {
  const b = h('button', cls, label); b.type = 'button';
  if (k) b.dataset.k = k;
  if (onClick) b.addEventListener('click', onClick);
  return b;
}
/* האייקונים שהדף ו־renderVi מבקשים (ctx.ico) — אותם ציורים של ICON ב־studio.js */
const ICON = {
  x: '<path d="M7 7l10 10M17 7L7 17"/>',
  chev: '<polyline points="15 6 9 12 15 18"/>',
  down: '<path d="M12 4v11.5M7.5 11l4.5 4.5 4.5-4.5M5 20h14"/>',
  film: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10 9.2v5.6l4.6-2.8z" fill="currentColor" stroke="none"/>',
  globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2M12 3.4c2.4 2.6 3.5 5.5 3.5 8.6s-1.1 6-3.5 8.6c-2.4-2.6-3.5-5.5-3.5-8.6s1.1-6 3.5-8.6z"/>',
};
/* Trusted Types (ב־CSP: require-trusted-types-for 'script'; trusted-types snb-share): הדפדפן חוסם כל הכנסת HTML/סקריפט
   ממחרוזת, חוץ מהמדיניות הזו — והיא מעבירה רק את האייקונים הקבועים שלמעלה. גם אם יום אחד ייכנס כאן באג, תוכן של עבודה
   (שם, כתוביות, ניתוח) לא יכול להפוך לקוד בדף */
const ICON_SET = new Set(Object.values(ICON));
const TT = typeof trustedTypes !== 'undefined' && trustedTypes && trustedTypes.createPolicy
  ? trustedTypes.createPolicy('snb-share', { createHTML: (x) => (ICON_SET.has(x) ? x : '') }) : null;
function ico(k, cls) {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
  s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor'); s.setAttribute('stroke-width', '2.2');
  s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = TT ? TT.createHTML(ICON[k] || '') : (ICON[k] || '');   // קבועים מהקוד — לא קלט
  return s;
}
let root = null, tok = '', S = null, lastErr = '', flashT = 0;
/* כל הדף בתוך st-page (רוחב ומרווחים כמו בסטודיו) */
const paint = (...els) => { const pg = h('div', 'st-page'); pg.append(...els.filter(Boolean)); root.replaceChildren(pg); return pg; };
function flash(m) {
  let f = document.querySelector('.st-sv-flash');
  if (!f) { f = h('div', 'st-sv-flash'); f.setAttribute('role', 'status'); document.body.append(f); }
  f.textContent = m; f.hidden = false;
  clearTimeout(flashT); flashT = setTimeout(() => { f.hidden = true; }, 3200);
}
async function api(body) {
  const base = (typeof window !== 'undefined' && window.SNB_ENV && window.SNB_ENV.proxy) || 'https://ibkr-proxy-wine.vercel.app';
  let r;
  try { r = await fetch(base + '/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), credentials: 'omit', referrerPolicy: 'no-referrer' }); }
  catch (e) { return { ok: false, error: 'net' }; }
  let j = null; try { j = await r.json(); } catch (e) {}
  return j && typeof j === 'object' ? j : { ok: false, error: 'http_' + r.status };
}
/* הקישורים החתומים לשעה — לפני שימוש, אם עומדים לפוג: מבקשים חדשים */
async function fresh() {
  if (S && Date.now() < S.ux - 5 * 60e3) return S;
  const j = await api({ op: 'shareView', t: tok });
  if (j.ok) S = Object.assign(j, { ux: Date.now() + Math.max(0, (j.ux || 0) - (j.now || 0)) });
  else lastErr = String(j.error || '');
  return S;
}
async function getJson(url) {
  if (!url) return null;
  try { const r = await fetch(url, { credentials: 'omit' }); return r.ok ? await r.json() : null; } catch (e) { return null; }
}
async function download(o, b) {
  if (b.disabled) return;
  b.disabled = true;
  const j = await api({ op: 'shareGet', t: tok, id: o.id, name: dlName(S.v, o) });
  b.disabled = false;
  if (!j.ok || typeof j.url !== 'string' || !/^https:\/\//.test(j.url)) { flash(j.error === 'gone' ? T('studioSvGone') : T('studioOutErr')); return; }
  flash(T('studioOutDlStart'));
  location.href = j.url;   // Content-Disposition: attachment — הדפדפן מוריד, הדף נשאר
}
function fileRows() {
  const l = h('div', 'st-list');
  for (const o of S.outs) {
    const r = btn('st-row st-ric st-sv-out', null, (e) => download(o, e.currentTarget), 'dl:' + o.k);
    const t = h('span', 'st-tile ' + (VIDEO.includes(o.k) ? 't-green' : 't-blue'));
    t.append(ico(VIDEO.includes(o.k) ? 'film' : 'globe'));
    const tx = h('span', 'st-l'); tx.append(h('b', null, outLabel(o.k)));
    if (o.size) tx.append(h('small', null, fmtSize(o.size)));
    const d = h('span', 'st-sv-dl'); d.append(ico('down')); d.setAttribute('aria-hidden', 'true');
    r.setAttribute('aria-label', T('studioOutDown') + ' · ' + outLabel(o.k));
    r.append(t, tx, d);
    l.append(r);
  }
  return l;
}
async function poster(ctl) {
  if (!S.thumb) return;
  try {
    const r = await fetch(S.thumb, { credentials: 'omit' });
    if (!r.ok) return;
    const b = await r.blob();
    if (/^image\/(jpeg|png|webp)$/.test(b.type)) ctl.setPoster(URL.createObjectURL(b));
  } catch (e) {}
}
/* קישור שפג באמצע הצפייה (יותר משעה) — מבקשים חדשים וממשיכים מאותה נקודה */
function healOnExpire(ctl, plan) {
  let busy = false;
  ctl.video.addEventListener('error', async () => {
    if (busy || Date.now() < S.ux - 60e3) return;
    busy = true;
    const t = ctl.video.currentTime || 0;
    S.ux = 0;
    const s = await fresh();
    const p = s && playPlan(s.v.k, s.play, plan.cues);
    busy = false;
    if (!p) return;
    ctl.video.src = p.src;
    ctl.seek(t);
  });
}
async function mkTrPlayer() {
  const cues = normCues(await getJson(S.cues));
  const plan = playPlan(S.v.k, S.play, cues.length > 0);
  if (!plan) return null;
  const ctl = createPlayer({ src: plan.src, fallback: plan.fallback, burned: plan.burned, cues: plan.burned && S.v.k === 'ka' ? [] : cues, issues: [], chapters: [], T });
  plan.cues = cues.length > 0;
  healOnExpire(ctl, plan);
  poster(ctl);
  return ctl;
}
function navBar() {
  const bar = h('div', 'st-nav st-sv-nav');
  const s = h('span', 'st-nav-s'), b = h('span', 'st-sv-brand');
  const lg = h('img'); lg.src = 'logo-studio.webp'; lg.alt = ''; lg.width = 28; lg.height = 28; lg.decoding = 'async';
  b.append(lg, h('span', null, 'THE SNOWBALL Studio'));
  s.append(b);
  bar.append(s, h('span', 'st-nav-t'), h('span', 'st-nav-e'));
  return bar;
}
function foot() {
  const f = h('div', 'st-sv-foot');
  f.append(h('p', 'st-note', T('studioSvBy')));
  if (S.v.exp > 0) f.append(h('p', 'st-note', T('studioShrUntil', { t: fmtDay(S.v.exp) })));
  return f;
}
function empty(title, sub, retry) {
  const d = h('div', 'st-empty');
  d.append(h('b', null, title));
  if (sub) d.append(h('span', null, sub));
  paint(navBar(), d, retry ? btn('st-btn wide', T('studioRetry'), () => { start(); }, 'retry') : null);
}
async function slideUrl(cache, s) {
  if (cache.has(s.id)) return cache.get(s.id);
  const st = await fresh();
  if (!st || !st.vis || !s.img) return '';
  let b;
  try {
    const r = await fetch(st.vis, { headers: { Range: imgRange(s) }, credentials: 'omit' });
    if (r.status !== 206 && r.status !== 200) return '';
    b = new Uint8Array(await r.arrayBuffer());
  } catch (e) { return ''; }
  if (b.length !== s.img.l) return '';
  const sig = String.fromCharCode(...b.subarray(0, 12));
  const type = sig.startsWith('RIFF') && sig.slice(8, 12) === 'WEBP' ? 'image/webp' : b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : sig.slice(1, 4) === 'PNG' ? 'image/png' : '';
  if (!type) return '';
  const u = URL.createObjectURL(new Blob([b], { type }));
  cache.set(s.id, u);
  return u;
}
async function pageVi(title) {
  const v = normVi(await getJson(S.vi));
  if (!v) { empty(T('studioViLoadErr'), '', true); return; }
  let cues = null;
  const cache = new Map();
  const view = renderVi({ T, h, btn, ico, fmtT, v, title, ro: true, place: null, now: () => Date.now(), scroller: () => root, flash, t0: 0,
    mkPlayer: () => {
      const plan = playPlan('vi', S.play, false);
      if (!plan) return null;
      const chs = normChapters(v.chapters.map((c) => ({ t: c.t0, title: c.title })), v.video.dur);
      const ctl = createPlayer({ src: plan.src, fallback: plan.fallback, burned: false, cues: cues || [], issues: [], chapters: chs, T, subLang: v.lang.src, orig: true });
      if (!cues) getJson(S.cues).then((j) => { cues = normCues(j); ctl.setCues(cues); });
      healOnExpire(ctl, plan);
      poster(ctl);
      return ctl;
    },
    slideUrl: (s) => slideUrl(cache, s), onUx: () => {}, onVf: () => {}, onPlace: () => {} });
  paint(navBar(), view.el, h('div', 'st-sec-t', T('studioSvFiles')), fileRows(), foot());
}
async function pageTr(title) {
  const t1 = h('h1', 'st-large clamp'); t1.append(h('bdi', null, title));
  const meta = [S.v.k === 'ka' ? T('studioSvKKa') : T('studioSvKTr'), S.v.dur > 0 ? fmtT(S.v.dur) : '', S.v.at > 0 ? fmtDay(S.v.at) : ''].filter(Boolean).join(' · ');
  const box = h('div', 'st-sv-pl');
  paint(navBar(), t1, h('p', 'st-note st-sv-meta', meta), box, h('div', 'st-sec-t', T('studioSvFiles')), fileRows(), foot());
  const ctl = await mkTrPlayer();
  if (ctl) box.append(ctl.el); else box.remove();
}
async function start() {
  empty(T('studioSvLoading'), '');
  S = null;
  if (!tok) { empty(T('studioSvGone'), T('studioSvGoneS')); return; }
  const s = await fresh();
  if (!s) {
    if (lastErr === 'gone') empty(T('studioSvGone'), T('studioSvGoneS'));   // בוטל, פג או נמחק — אותה תשובה
    else empty(T('studioSvErr'), '', true);
    return;
  }
  const title = fileTitle(S.v.n) || T('studioUntitled');
  document.title = title + ' · THE SNOWBALL Studio';
  if (S.v.k === 'vi' && S.vi) await pageVi(title); else await pageTr(title);
}
export function boot() {
  try { if (self !== top) { document.documentElement.style.display = 'none'; return; } } catch (e) { return; }   // לא בתוך מסגרת של אתר אחר
  const de = document.documentElement;
  de.lang = LANG; de.dir = LANG === 'he' ? 'rtl' : 'ltr';
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const theme = () => { de.dataset.theme = mq && mq.matches ? 'dark' : 'light'; };
  theme();
  if (mq && mq.addEventListener) mq.addEventListener('change', theme);
  root = document.getElementById('sv');
  tok = tokenFrom(location.hash);
  start();
}
if (IS_DOC && document.documentElement.dataset.app === 'share') boot();
