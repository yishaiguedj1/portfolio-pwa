'use strict';
/* ניתוח סרטונים — הקורפוס המוצפן של מאגר הלמידה (10/11/2026, גל 1 — PR 1.3; docs/studio-video-analysis-plan.md 7.3, 7.11).
   נפרד מקורפוס התרגום (learncorpus.js): גרסה, AAD וקידומות משלו — לא מערבבים סכמות.
   - רשימה מותרת: רק השדות כאן יוצאים ממה שהעובד שלח (vi_corpus ב־translator/analyze.py, PR 1.2ב). **VC_V זהה בעובד.**
   - scrubVi: מה שמזהה אדם בתמליל ובטקסט שעל המסך — מייל, טלפון, ת״ז (ספרת ביקורת), כרטיס (Luhn), IBAN, קישור עם
     אסימון בשאילתה, וכל רצף אחר של 9 ספרות ומעלה (לא פחות מ־scrub של התרגום). שמות, שנים, סכומים עם פסיקים
     וסטטיסטיקה — נשארים (בלעדיהם אין מה ללמוד מהרצאה).
   - lid = HMAC-SHA256 (מפתח נגזר מהכספת, 'learn-vi-lid') על מזהה העבודה — לא sha256 גלוי: את מרחב המזהים אפשר לנחש.
   - מפתח לכל רשומה (DEK, AES-256-GCM): הקובץ מוצפן ב־DEK, וה־DEK עטוף ב־KEK (נגזר, 'learn-vi-kek') ונשמר ב־vik/<lid>.
     מחיקה = השמדת ה־DEK העטוף — מחיקה קריפטוגרפית, גם של עותקים שכבר הועתקו.
   המפתחות בדלי snb-learn: viq/<lid>.bin (תור, עד האצווה היומית) → vic/<YYYY-MM>/<lid>.bin; ‏vik/<lid> — ה־DEK העטוף.
   בלי uid, שם קובץ, כותרת או זמן מדויק — רק החודש (m), שהשרתון קובע. טהור, חוץ מהכספת (vault.derive). */
const crypto = require('crypto');
const zlib = require('zlib');
const vault = require('./vault');
const { VI_DROP } = require('./studiovi');

const VC_V = 1;                           // **זהה ל־VC_V ב־translator/analyze.py** (גרסת הקורפוס; VI_V = גרסת vi.json)
const VK_STAGES = ['m0', 'm1', 's0', 'v0'];   // הטיוטות: מיפוי גולמי, אחרי הבדיקות, סינתזה גולמית, אימות (= analyze.py)
const VC_ROLES = ['vm', 'vs', 'vv', 'vl', 'vx', 'vc', 'main'];
const KEEP_MONTHS = 24;                   // כמו התרגום: תוכן 24 חודשים, המדדים לתמיד
const CAP = { tr: 20000, scr: 3000, ocr: 400, st: 40, ol: 400, it: 3000, ev: 32, led: 40000, rej: 2000, tk: 2000, refs: 8, rch: 400, cl: 600 };
const MAX_TXT = 2000, MAX_DR = 400000, MAX_REF = 20000, MAX_TXT_F = 8000, MAX_CL = 200000;
const LID_RE = /^[0-9a-f]{20}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const ID_RE = /^[esocn]\d{1,6}(?:\.\d{1,4})?$/;
const CODE_RE = /^[a-z][a-z0-9_]{0,31}$/;
const SPK_RE = /^S\d{1,2}$/;
const MODEL_RE = /^claude-[a-z0-9-]{1,50}$/;
const HASH_RE = /^[0-9a-f]{8,64}$/;

const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const num = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 1000) / 1000 : null);
const int = (v, hi) => (Number.isInteger(v) && v >= 0 && v <= hi ? v : null);
const code = (v) => (CODE_RE.test(String(v || '')) ? v : null);
const idOf = (v) => (typeof v === 'string' && ID_RE.test(v) ? v : null);

/* ---------- הניקוי ---------- */
const luhn = (d) => { let s = 0; for (let i = 0; i < d.length; i++) { let x = +d[d.length - 1 - i]; if (i % 2) { x *= 2; if (x > 9) x -= 9; } s += x; } return s % 10 === 0; };
/* ת״ז ישראלית: 9 ספרות, ספרת ביקורת (משקלות 1,2 לסירוגין, סכום ספרות) */
const tz = (d) => { if (d.length !== 9) return false; let s = 0; for (let i = 0; i < 9; i++) { let x = +d[i] * ((i % 2) + 1); if (x > 9) x -= 9; s += x; } return s % 10 === 0; };
const SENS_Q = /[?&](?:[^=&#\s]*(?:token|key|sig|signature|secret|auth|session|sid|code|pass|pwd|jwt|access|credential)[^=&#\s]*)=/i;
function scrubVi(s, max) {
  return String(s == null ? '' : s)
    .replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '⟨מייל⟩')
    // קישור: בלי שאילתה / שאילתה בלי אסימון — נשאר (הפניה למאמר היא תוכן); עם אסימון / ערך ארוך אקראי — מוחלף
    .replace(/\b(?:https?:\/\/|www\.)[^\s<>"'⟨⟩]+/gi, (u) => (SENS_Q.test(u) || /[?&][^=&#\s]+=[A-Za-z0-9_\-%.]{24,}/.test(u) ? '⟨קישור⟩' : u))
    .replace(/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g, (m) => (/\d{6}/.test(m.replace(/ /g, '')) ? '⟨IBAN⟩' : m))
    // רצף ספרות (עם רווחים/מקפים): כרטיס (13–19, Luhn), ת״ז (9, ספרת ביקורת), טלפון (+ או 0 בהתחלה, 9–13 ספרות)
    .replace(/(?:\+\d|\b\d)[\d\s().-]{6,24}\d\b/g, (m) => {
      const d = m.replace(/\D/g, '');
      if (d.length >= 13 && d.length <= 19 && luhn(d)) return '⟨כרטיס⟩';
      if (d.length === 9 && /^\d{9}$/.test(m.trim()) && tz(d)) return '⟨ת״ז⟩';
      if ((m.trim()[0] === '+' || /^0\d/.test(m.trim())) && d.length >= 9 && d.length <= 13) return '⟨טלפון⟩';
      // כל רצף אחר של 9 ספרות ומעלה (חשבון, מספר מזהה אחר) — כמו scrub של התרגום; רק רשימת שנים נשארת
      if (d.length >= 9 && !m.trim().split(/[\s().-]+/).every((g) => /^(?:19|20)\d{2}$/.test(g))) return '⟨מספר⟩';
      return m;
    })
    .slice(0, max || MAX_TXT);
}
const rawTxt = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, max || MAX_TXT_F);

/* ---------- הרשימה המותרת ----------
   tr  יחידות הדיבור [id,t0,t1,spk,text,conf] · scr שקפים [id,t0,t1,kind,states[[k,t0]],ocr[[text,conf,lang]]] (בלי תמונות)
   ol  פרקים [id,t0,t1,lvl,title,cue] · it פריטים [id,kind,ch,text,ev[],q,basis,conf,verdict]
   led הפנקס [ref, used_in | reason] · rej דחיות [stage,code,n,sample] · dr הטיוטות {m0,m1,s0,v0} (JSON כטקסט)
   cf  {genre, aud, mode, st:{<תפקיד>:[model,eff]}, pv, sys_hash} · tk [role,in,out,cr,cw,usd,ms] לכל קריאה
   refs [{src,kind,data}] — התיאור, פרקי היוצר, הייחוס האנושי · cl (רק באיסוף המלא) [role,sys_hash,prompt,answer,ms] */
const REF_SRC = ['desc', 'ch', 'deck', 'human', 'gd'];
function normViCorpus(o, month, full) {
  if (!isObj(o) || o.v !== VC_V || !MONTH_RE.test(String(month || ''))) return null;
  const T = full ? rawTxt : scrubVi;
  const out = { v: VC_V, m: month };
  const arr = (a, cap) => (Array.isArray(a) ? a.slice(0, cap) : []);
  out.tr = arr(o.tr, CAP.tr).filter((x) => Array.isArray(x) && idOf(x[0]) && num(x[1], 0, 86400) != null && num(x[2], 0, 86400) != null && typeof x[4] === 'string')
    .map((x) => [x[0], num(x[1], 0, 86400), num(x[2], 0, 86400), SPK_RE.test(String(x[3] || '')) ? x[3] : 'S?', T(x[4], full ? MAX_TXT_F : MAX_TXT), num(x[5], 0, 1)]);
  out.scr = arr(o.scr, CAP.scr).filter((x) => Array.isArray(x) && idOf(x[0]) && num(x[1], 0, 86400) != null && num(x[2], 0, 86400) != null)
    .map((x) => [x[0], num(x[1], 0, 86400), num(x[2], 0, 86400), code(x[3]) || 'slide',
      arr(x[4], CAP.st).filter((y) => Array.isArray(y) && int(y[0], 999) != null && num(y[1], 0, 86400) != null).map((y) => [y[0], num(y[1], 0, 86400)]),
      arr(x[5], CAP.ocr).filter((y) => Array.isArray(y) && typeof y[0] === 'string').map((y) => [T(y[0], full ? MAX_TXT_F : MAX_TXT), int(y[1], 100), /^[a-z]{2,3}$/.test(String(y[2] || '')) ? y[2] : 'und'])]);
  out.ol = arr(o.ol, CAP.ol).filter((x) => Array.isArray(x) && idOf(x[0]) && num(x[1], 0, 86400) != null && typeof x[4] === 'string')
    .map((x) => [x[0], num(x[1], 0, 86400), num(x[2], 0, 86400), int(x[3], 3) || 1, T(x[4], 300), code(x[5])]);
  out.it = arr(o.it, CAP.it).filter((x) => Array.isArray(x) && idOf(x[0]) && typeof x[3] === 'string')
    .map((x) => [x[0], code(x[1]) || 'note', idOf(x[2]), T(x[3], full ? MAX_TXT_F : MAX_TXT), arr(x[4], CAP.ev).filter(idOf), typeof x[5] === 'string' ? T(x[5], 600) : null,
      code(x[6]), code(x[7]), code(x[8])]);
  out.led = arr(o.led, CAP.led).filter((x) => Array.isArray(x) && idOf(x[0]) && (idOf(x[1]) || VI_DROP.includes(x[1]))).map((x) => [x[0], x[1]]);
  out.rej = arr(o.rej, CAP.rej).filter((x) => Array.isArray(x) && code(x[0]) && code(x[1]))
    .map((x) => [x[0], x[1], int(x[2], 1e6) || 0, typeof x[3] === 'string' ? T(x[3], 600) : null]);
  if (isObj(o.dr)) {
    const dr = {};
    for (const st of VK_STAGES) if (o.dr[st] != null) { const s = typeof o.dr[st] === 'string' ? o.dr[st] : JSON.stringify(o.dr[st]); dr[st] = T(s, full ? MAX_DR * 2 : MAX_DR); }
    if (Object.keys(dr).length) out.dr = dr;
  }
  if (isObj(o.cf)) {
    const c = o.cf, cf = {};
    for (const k of ['genre', 'aud', 'mode']) if (/^[a-z][a-z0-9_-]{0,31}$/.test(String(c[k] || ''))) cf[k] = c[k];
    if (isObj(c.st)) {
      const st = {};
      for (const r of VC_ROLES) if (Array.isArray(c.st[r]) && MODEL_RE.test(String(c.st[r][0] || ''))) st[r] = [c.st[r][0], code(c.st[r][1])];
      if (Object.keys(st).length) cf.st = st;
    }
    if (int(c.pv, 999)) cf.pv = c.pv;
    if (HASH_RE.test(String(c.sys_hash || ''))) cf.sys_hash = c.sys_hash;
    if (Object.keys(cf).length) out.cf = cf;
  }
  out.tk = arr(o.tk, CAP.tk).filter((x) => Array.isArray(x) && VC_ROLES.includes(x[0]))
    .map((x) => [x[0], int(x[1], 1e8) || 0, int(x[2], 1e8) || 0, int(x[3], 1e8) || 0, int(x[4], 1e8) || 0, num(x[5], 0, 1e4), int(x[6], 1e8) || 0]);
  out.refs = arr(o.refs, CAP.refs).filter((r) => isObj(r) && REF_SRC.includes(r.src)).map((r) => {
    const data = typeof r.data === 'string' ? T(r.data, MAX_REF)
      : arr(r.data, CAP.rch).filter((y) => Array.isArray(y) && num(y[0], 0, 86400) != null && typeof y[1] === 'string').map((y) => [num(y[0], 0, 86400), T(y[1], 300)]);
    return { src: r.src, kind: code(r.kind) || r.src, data };
  });
  if (full && Array.isArray(o.cl)) {   // 7.10: פרומפט ותשובה גולמיים לכל קריאה — רק באיסוף המלא (learn_full + lrf)
    out.cl = arr(o.cl, CAP.cl).filter((x) => Array.isArray(x) && VC_ROLES.includes(x[0]))
      .map((x) => [x[0], HASH_RE.test(String(x[1] || '')) ? x[1] : null, rawTxt(x[2], MAX_CL), rawTxt(x[3], MAX_CL), int(x[4], 1e8) || 0]);
  }
  for (const k of ['tr', 'scr', 'ol', 'it', 'led', 'rej', 'tk', 'refs']) if (!out[k].length) delete out[k];
  return Object.keys(out).length > 2 ? out : null;
}

/* ---------- המזהה, המפתחות וההצפנה ---------- */
/* null = הכספת לא מוגדרת → לא שומרים כלום (לעולם לא נופלים ל־sha256 גלוי) */
function viLid(jobId) {
  const d = vault.derive('learn-vi-lid');
  if (!d || !/^j[A-Za-z0-9_-]{20}$/.test(String(jobId || ''))) return null;
  return crypto.createHmac('sha256', d.key).update('snb-learn-vi|' + jobId).digest('hex').slice(0, 20);
}
const b64u = (b) => Buffer.from(b).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');
function gcmSeal(buf, key, aad) {
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(aad));
  return b64u(iv) + '.' + b64u(Buffer.concat([c.update(buf), c.final(), c.getAuthTag()]));
}
function gcmOpen(str, key, aad) {
  try {
    const [ivs, cts] = String(str || '').split('.');
    const iv = unb64u(ivs), all = unb64u(cts);
    if (iv.length !== 12 || all.length < 17) return null;
    const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAAD(Buffer.from(aad));
    d.setAuthTag(all.subarray(all.length - 16));
    return Buffer.concat([d.update(all.subarray(0, all.length - 16)), d.final()]);
  } catch (e) { return null; }
}
/* DEK חדש לכל רשומה, עטוף ב־KEK: 'vk1.<kid>.<iv>.<ct>' — kid של הכספת, כדי שהחלפת מפתח תיראה (ולא תפוענח בשקט בטעות) */
const dekNew = () => crypto.randomBytes(32);
function dekWrap(dek, lid) {
  const k = vault.derive('learn-vi-kek');
  if (!k || !LID_RE.test(String(lid)) || !Buffer.isBuffer(dek) || dek.length !== 32) return null;
  return 'vk1.' + k.kid + '.' + gcmSeal(dek, k.key, 'snb-learn-vi|kek|' + lid);
}
function dekUnwrap(str, lid) {
  const [v, kid, ivs, cts] = String(str || '').split('.');
  const k = vault.derive('learn-vi-kek');
  if (v !== 'vk1' || !k || k.kid !== kid || !LID_RE.test(String(lid))) return null;
  const dek = gcmOpen(ivs + '.' + cts, k.key, 'snb-learn-vi|kek|' + lid);
  return dek && dek.length === 32 ? dek : null;
}
/* התוכן: deflate + AES-GCM ב־DEK, ‏AAD = learn-vi|<lid> (קובץ שהועבר ל־lid אחר — לא נפתח) */
const vcSeal = (obj, dek, lid) => 'vc1.' + gcmSeal(zlib.deflateRawSync(Buffer.from(JSON.stringify(obj))), dek, 'snb-learn-vi|' + lid);
function vcOpen(str, dek, lid) {
  const s = String(str || '');
  if (!s.startsWith('vc1.') || !dek) return null;
  const pt = gcmOpen(s.slice(4), dek, 'snb-learn-vi|' + lid);
  try { return pt ? JSON.parse(zlib.inflateRawSync(pt, { maxOutputLength: 64 * 1024 * 1024 }).toString('utf8')) : null; } catch (e) { return null; }
}

const viqKey = (lid) => 'viq/' + lid + '.bin';
const vicKey = (month, lid) => 'vic/' + month + '/' + lid + '.bin';
const vikKey = (lid) => 'vik/' + lid;
/* רק הצורה שלנו — כל מפתח אחר בדלי (או ניסיון ../) = null */
function parseViKey(key) {
  let m = /^viq\/([0-9a-f]{20})\.bin$/.exec(String(key || ''));
  if (m) return { kind: 'viq', lid: m[1], month: '' };
  m = /^vic\/(\d{4}-\d{2})\/([0-9a-f]{20})\.bin$/.exec(String(key || ''));
  if (m) return { kind: 'vic', lid: m[2], month: m[1] };
  m = /^vik\/([0-9a-f]{20})$/.exec(String(key || ''));
  return m ? { kind: 'vik', lid: m[1], month: '' } : null;
}
/* ספירות ללוח (מרשימת המפתחות בלבד — בלי לפתוח פריט) */
function viStats(keys) {
  const out = { n: 0, q: 0, k: 0, mb: 0, months: {} };
  for (const it of keys || []) {
    const p = parseViKey(it.key);
    if (!p) continue;
    if (p.kind === 'vik') { out.k++; continue; }
    out.mb += +it.size || 0;
    if (p.kind === 'viq') out.q++; else { out.n++; out.months[p.month] = (out.months[p.month] || 0) + 1; }
  }
  out.mb = Math.round((out.mb / 1048576) * 100) / 100;
  return out;
}

module.exports = { VC_V, VK_STAGES, VC_ROLES, KEEP_MONTHS, scrubVi, normViCorpus, viLid, dekNew, dekWrap, dekUnwrap, vcSeal, vcOpen,
  viqKey, vicKey, vikKey, parseViKey, viStats, luhn, tz };
