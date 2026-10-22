'use strict';
/* הורדה מקישור (22/10/2026, בקשת המשתמש: "כל וידאו שקיים בתוך לינק" — כמו IDM). טהור — נבדק ב־node.
   הזרימה: הטלפון שולח קישור (op:'urlProbe') → מסמך ב־studioProbe → העובד לוקח אותו (op:'pq' עם טוקן השרת), מריץ
   yt-dlp בלי הורדה ומחזיר סיכום (translator/fetchurl.py: summarize) → הטלפון מציג איכויות וכתוביות → עבודה עם
   spec.src = 'url' → העובד מוריד ישר ל־R2 (קול קודם) ורושם את הקבצים (op:'srcFile').
   הבדיקה כאן היא רק צורה (כתובת פנימית מילולית נדחית כבר כאן); את ה־DNS בודק העובד, וחומת האש של המארח חוסמת
   גם היא רשתות פנימיות ואת שירות המטא־דאטה. הסיכום מהעובד = טקסט מאתר חיצוני — נשמר רק בצורה קבועה ונקייה. */

const URL_MAX = 2048;
const PROBE_TTL = 10 * 60e3;          // בדיקה שלא נלקחה / לא חזרה תוך 10 דק׳ — "לא ענה"
const PROBE_RUN_MAX = 3 * 60e3;       // לקחו ולא החזירו תוך 3 דק׳ — נכשלה
const PROBE_KEEP = 60 * 60e3;         // בדיקות ישנות של המשתמש נמחקות אחרי שעה
const PROBE_ERRS = ['bad_url', 'private', 'dns', 'blocked', 'login', 'geo', 'live', 'gone', 'unsupported', 'drm', 'playlist',
  'no_video', 'timeout', 'net', 'no_tool', 'fail', 'no_server'];
const H_MAX = 4320;
const FMT_ID_RE = /^[\w.+-]{1,60}$/;
const VC = ['av1', 'vp9', 'vp8', 'h264', 'h265', 'other', ''];
const AC = ['opus', 'aac', 'mp3', 'vorbis', 'ac3', 'eac3', 'flac', 'other', ''];
const TH_MAX = 80 * 1024;             // תמונה קטנה (data:image/jpeg;base64) — בלי קישור חיצוני (CSP)

function clean(s, n) {
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f‪-‮⁦-⁩]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
}

const PRIV4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^22[4-9]\./, /^2[3-5]\d\./];

/* קישור מהמשתמש → מנורמל, או '' . גם טקסט ששותף ("צפו בזה https://…") — הקישור הראשון בו */
function normSrcUrl(input) {
  let s = String(input == null ? '' : input).trim();
  if (!/^https?:\/\//i.test(s)) { const m = /https?:\/\/[^\s<>"'‎‏]+/i.exec(s); s = m ? m[0].replace(/[.,;:!?)\]}»]+$/, '') : ''; }
  if (!s || s.length > URL_MAX || /[\s\u0000-\u001f\u007f]/.test(s)) return '';
  let u;
  try { u = new URL(s); } catch (e) { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  if (u.username || u.password) return '';
  if (u.port && !['80', '443', '8080', '8443'].includes(u.port)) return '';
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || /\.(localhost|local|internal|lan|home\.arpa)$/.test(host)) return '';
  if (host.startsWith('[')) return '';                                   // IPv6 מילולי — לא צריך את זה לווידאו
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) { if (PRIV4.some((r) => r.test(host))) return ''; }
  else if (!host.includes('.') || /^\d+$/.test(host)) return '';
  return u.toString();
}

/* מה המשתמש בחר בטלפון: v/a = מזהי הפורמט מהבדיקה, h = גובה, sec = [מ, עד] בשניות, ch = פרקים לנגן */
function normPick(p) {
  if (!p || typeof p !== 'object') return null;
  const out = {};
  if (FMT_ID_RE.test(String(p.v || ''))) out.v = String(p.v);
  if (FMT_ID_RE.test(String(p.a || ''))) out.a = String(p.a);
  const h = Math.floor(Number(p.h) || 0);
  out.h = h >= 0 && h <= H_MAX ? h : 0;
  if (Array.isArray(p.sec) && p.sec.length === 2) {
    const a = Math.max(0, Math.floor(Number(p.sec[0]) || 0)), b = Math.floor(Number(p.sec[1]) || 0);
    if (b > a && b <= 24 * 3600) out.sec = [a, b];
  }
  if (p.ch === 1) out.ch = 1;
  return out;
}

const int = (v, max) => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 && n <= max ? n : 0; };

/* הסיכום מהעובד → צורה קבועה (fetchurl.summarize). לא תקין — null */
function normProbe(r) {
  if (!r || typeof r !== 'object') return null;
  const q = (Array.isArray(r.q) ? r.q : []).slice(0, 12).map((o) => o && FMT_ID_RE.test(String(o.v || '')) ? {
    h: int(o.h, H_MAX), v: String(o.v), a: FMT_ID_RE.test(String(o.a || '')) ? String(o.a) : '',
    c: VC.includes(o.c) ? o.c : 'other', ac: AC.includes(o.ac) ? o.ac : 'other', fps: int(o.fps, 480), hdr: o.hdr ? 1 : 0, sz: int(o.sz, 1e12),
  } : null).filter(Boolean);
  if (!q.length) return null;
  const fm = (Array.isArray(r.fm) ? r.fm : []).slice(0, 60).map((f) => f && FMT_ID_RE.test(String(f.id || '')) && ['v', 'a', 'av'].includes(f.k) ? {
    id: String(f.id), k: f.k, h: int(f.h, H_MAX), fps: int(f.fps, 480), c: VC.includes(f.c) ? f.c : 'other', ac: AC.includes(f.ac) ? f.ac : 'other',
    hdr: f.hdr ? 1 : 0, sz: int(f.sz, 1e12), br: int(f.br, 1e6),
  } : null).filter(Boolean);
  const ch = (Array.isArray(r.ch) ? r.ch : []).slice(0, 30).map((c) => Array.isArray(c) && clean(c[1], 80) ? [int(c[0], 24 * 3600), clean(c[1], 80)] : null).filter(Boolean);
  const sub = (Array.isArray(r.sub) ? r.sub : []).slice(0, 40).map((s) => s && /^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$/.test(String(s.l || '')) ? { l: String(s.l), n: clean(s.n, 60), a: s.a ? 1 : 0 } : null).filter(Boolean);
  const ao = r.ao && FMT_ID_RE.test(String(r.ao.id || '')) ? { id: String(r.ao.id), ac: AC.includes(r.ao.ac) ? r.ao.ac : 'other', br: int(r.ao.br, 1e5), sz: int(r.ao.sz, 1e12) } : null;
  const th = typeof r.th === 'string' && r.th.length <= TH_MAX && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(r.th) ? r.th : '';
  return {
    t: clean(r.t, 200) || 'video', u: normSrcUrl(r.u) || '', s: clean(r.s, 40), up: clean(r.up, 100), d: int(r.d, 48 * 3600),
    ud: /^\d{8}$/.test(String(r.ud || '')) ? String(r.ud) : '', lang: /^[A-Za-z-]{0,10}$/.test(String(r.lang || '')) ? String(r.lang || '') : '',
    ch, sub, q, rec: int(r.rec, H_MAX), ao, fm, th,
  };
}

/* מצב בדיקה (המסמך) → מה שהטלפון מקבל */
function probeView(p, now) {
  if (!p) return null;
  let st = p.st, e = p.e || '';
  if (st === 'q' && now - (p.at || 0) > PROBE_TTL) { st = 'e'; e = 'no_server'; }
  if (st === 'r' && now - (p.rt || p.at || 0) > PROBE_RUN_MAX) { st = 'e'; e = 'timeout'; }
  return { id: p.id, st, e: st === 'e' ? (PROBE_ERRS.includes(e) ? e : 'fail') : '', r: st === 'd' ? (p.pbr || null) : null, at: p.at || 0 };
}

/* גודל משוער של הבחירה (לאומדן ולתקרת הגודל של העבודה): הסכום של הווידאו והקול מהבדיקה */
function pickSize(probe, pick) {
  if (!probe || !pick) return 0;
  const o = (probe.q || []).find((x) => x.v === pick.v) || null;
  let sz = o ? o.sz : 0;
  if (!o) {
    const v = (probe.fm || []).find((f) => f.id === pick.v), a = (probe.fm || []).find((f) => f.id === pick.a);
    sz = (v ? v.sz : 0) + (a && pick.a !== pick.v ? a.sz : 0);
  }
  if (pick.sec && probe.d > 0) sz = Math.round(sz * Math.min(1, (pick.sec[1] - pick.sec[0]) / probe.d));
  return sz;
}

module.exports = { URL_MAX, PROBE_TTL, PROBE_RUN_MAX, PROBE_KEEP, PROBE_ERRS, FMT_ID_RE, TH_MAX, normSrcUrl, normPick, normProbe, probeView, pickSize };
