/* ניתוח סרטונים — דף הניתוח (10/11/2026, גל 1 — PR 1.5ב; docs/studio-video-analysis-plan.md 9.4–9.7, התצוגה שאושרה ב־1.4).
   שני חלקים:
   1. normVi — האימות של vi.json בטלפון. **זהה ל־normVi ב־ibkr-proxy/lib/studiovi.js** (ול־vicheck.py בעובד, 1.2א):
      tests/studio-vi-page.test.js מריץ את שניהם על אותם fixtures (translator/tests/fixtures/vi_ok.json, ‏vi_bad.json).
      שדה לא מוכר נזרק, ערך מחוץ ל־enum נזרק, הפניה למזהה שלא קיים נזרקת — ומוצג רק מה שעבר.
   2. הדף (renderVi): כותרת רזה ותווית האיכות, השורה האחת והנקודות עם שבב, "בעמוד הזה", הפרקים המקופלים, "מה לא נכנס",
      התמליל המלא; חלונית הראיה (גיליון תחתון לא מודאלי), המיני־נגן (createPlayer של התרגום, עם הסרטון באיכות מלאה — ה4),
      "דווח על טעות" וזיכרון המקום. **כל טקסט מהמודל — textContent בלבד**, אף פעם לא כ־HTML. הנגן, הרשת והמונים
      מגיעים מ־studio.js ב־ctx — המודול לא קורא לרשת בעצמו. */

import { lineDir, langDir } from './studioplay.js';   // כיוון לכל שורה בשפת המקור — אותו כלל כמו בכתוביות של הנגן (שפות משולבות)

/* ---------- 1. vi.json — אותה הסכמה כמו בשרתון (נספח 19.1) ---------- */
export const VI_V = 'snb.video-analysis/1';
export const VI_LANGS = ['he', 'en'];
export const VI_WARN = ['vi_noscreen', 'vi_lowres', 'vi_ocr', 'vi_asr_low', 'vi_partial', 'vi_unver', 'vi_ledger', 'ts_coarse'];
export const VI_SEG = ['content', 'intro', 'qa', 'pitch', 'sponsor', 'self_promo', 'interaction_reminder', 'preview_recap', 'filler', 'logistics', 'demo', 'exercise'];
export const VI_SRC = ['speech', 'screen_only', 'both'];
export const VI_BASIS = ['speaker', 'analyst_inference', 'external_knowledge'];
export const VI_CONF = ['high', 'med', 'low'];
export const VI_VER = ['sup', 'part', 'uns', 'con', 'unk'];
export const VI_DROP = ['duplicate', 'decorative', 'agenda', 'title_only', 'sponsor', 'filler', 'budget', 'low_salience', 'unverified', 'asr_noise'];
export const VI_GENRES = ['academic_lecture', 'course_module', 'business_webinar', 'conference_talk', 'panel', 'interview_podcast', 'software_tutorial', 'product_demo', 'workshop', 'investor_presentation', 'other'];
const VI_ASRQ = ['high', 'med', 'low'];
const VI_CAP = { evidence: 20000, slides: 3000, ocr: 30000, segments: 2000, chapters: 400, items: 3000, ledger: 40000, states: 40, refs: 24, take: 7, warn: 16, tpl: 20 };
// PR 2.1 (V59): סעיפי התבנית לפי ז'אנר — מזהי פריטים בלבד. **זהה ל־VI_TPL ב־vicheck.py ובעותק השני (שרתון/טלפון)**
export const VI_TPL = ['learn', 'board', 'stress', 'exam', 'step', 'offer', 'price', 'check', 'free'];
const VI_TXT = { text: 2000, q: 600, title: 300, sum: 3000, adds: 2000, vtitle: 300 };
const ID = { e: /^e\d{1,6}$/, s: /^s\d{1,5}$/, o: /^o\d{1,5}\.\d{1,4}$/, c: /^c\d{1,4}$/, n: /^n\d{1,5}$/ };
const VI_KEYS = ['v', 'pv', 'lang', 'genre', 'video', 'evidence', 'slides', 'ocr', 'segments', 'chapters', 'items', 'briefing', 'thesis', 'big', 'tpl', 'ledger', 'quality'];
const SPK_RE = /^S\d{1,2}$/, KIND_RE = /^[a-z][a-z_]{0,15}$/, LANG_RE = /^[a-z]{2,3}$/, VSRC_RE = /^[a-z]{1,8}$/;

const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const fin = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const r3 = (v) => Math.round(v * 1000) / 1000;
const CHIP_LEAD = 0.3;   // 4.2 סעיף 3: השבב מנגן 0.3 שנ׳ לפני המילה
const txt = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, max) : null);
const span = (o) => (fin(o.t0, 0, 86400) && fin(o.t1, 0, 86400) && o.t1 >= o.t0 ? { t0: r3(o.t0), t1: r3(o.t1) } : null);
const lst = (a, cap) => (Array.isArray(a) ? a.slice(0, cap) : []);
const ids = (a, ok, cap) => [...new Set(lst(a, cap || 64).filter((x) => typeof x === 'string' && ok(x)))];

export function normVi(o) {
  if (!isObj(o) || o.v !== VI_V) return null;
  const out = { v: VI_V, pv: Number.isInteger(o.pv) && o.pv >= 1 && o.pv <= 999 ? o.pv : 1 };
  const lg = isObj(o.lang) ? o.lang : {};
  out.lang = { src: VI_LANGS.includes(lg.src) ? lg.src : 'en', out: 'he' };
  out.genre = VI_GENRES.includes(o.genre) ? o.genre : 'other';
  const vd = isObj(o.video) ? o.video : {};
  out.video = { dur: fin(vd.dur, 0, 86400) ? r3(vd.dur) : 0 };
  if (VSRC_RE.test(String(vd.src || ''))) out.video.src = vd.src;
  if (txt(vd.title, VI_TXT.vtitle)) out.video.title = txt(vd.title, VI_TXT.vtitle);
  out.evidence = [];
  for (const e of lst(o.evidence, VI_CAP.evidence)) {
    const sp = isObj(e) && ID.e.test(String(e.id || '')) && span(e), t = isObj(e) && txt(e.text, VI_TXT.text);
    if (!sp || t == null) continue;
    const x = Object.assign({ id: e.id }, sp, { spk: SPK_RE.test(String(e.spk || '')) ? e.spk : 'S1', text: t });
    if (fin(e.conf, 0, 1)) x.conf = r3(e.conf);
    if (Number.isInteger(e.w0) && Number.isInteger(e.w1) && e.w0 >= 0 && e.w1 >= e.w0) { x.w0 = e.w0; x.w1 = e.w1; }
    out.evidence.push(x);
  }
  out.ocr = [];
  for (const r of lst(o.ocr, VI_CAP.ocr)) {
    const t = isObj(r) && ID.o.test(String(r.id || '')) && txt(r.text, VI_TXT.text);
    if (t == null || t === false) continue;
    const x = { id: r.id, text: t, conf: fin(r.conf, 0, 100) ? Math.round(r.conf) : 0, lang: LANG_RE.test(String(r.lang || '')) ? r.lang : 'und' };
    if (r.dir === 'rtl' || r.dir === 'ltr') x.dir = r.dir;
    out.ocr.push(x);
  }
  const ocrIds = new Set(out.ocr.map((x) => x.id));
  out.slides = [];
  for (const s of lst(o.slides, VI_CAP.slides)) {
    const sp = isObj(s) && ID.s.test(String(s.id || '')) && span(s);
    if (!sp) continue;
    const x = Object.assign({ id: s.id }, sp, { kind: KIND_RE.test(String(s.kind || '')) ? s.kind : 'slide' });
    const st = lst(s.states, VI_CAP.states).filter((y) => isObj(y) && Number.isInteger(y.k) && y.k >= 0 && y.k < 1000 && fin(y.t0, 0, 86400)).map((y) => ({ k: y.k, t0: r3(y.t0) }));
    if (st.length) x.states = st;
    const im = s.img;
    if (isObj(im) && ['o', 'l', 'w', 'h'].every((k) => Number.isInteger(im[k]) && im[k] >= 0 && im[k] < 2 ** 40) && im.l > 0) x.img = { o: im.o, l: im.l, w: im.w, h: im.h };
    const oc = ids(s.ocr, (y) => ocrIds.has(y), 400);
    if (oc.length) x.ocr = oc;
    const so = ids(s.so, (y) => oc.includes(y), 400);
    if (so.length) x.so = so;
    out.slides.push(x);
  }
  const evIds = new Set([...out.evidence.map((x) => x.id), ...out.slides.map((x) => x.id), ...ocrIds]);
  out.segments = [];
  for (const g of lst(o.segments, VI_CAP.segments)) {
    const sp = isObj(g) && span(g);
    if (sp && VI_SEG.includes(g.type)) out.segments.push(Object.assign(sp, { type: g.type }));
  }
  const chRaw = lst(o.chapters, VI_CAP.chapters).filter((c) => isObj(c) && ID.c.test(String(c.id || '')) && span(c) && txt(c.title, VI_TXT.title));
  const chIds = new Set(chRaw.map((c) => c.id));
  out.items = [];
  for (const it of lst(o.items, VI_CAP.items)) {
    const t = isObj(it) && ID.n.test(String(it.id || '')) && txt(it.text, VI_TXT.text);
    if (!t) continue;
    const x = { id: it.id, kind: KIND_RE.test(String(it.kind || '')) ? it.kind : 'note' };
    if (chIds.has(it.ch)) x.ch = it.ch;
    x.text = t;
    x.ev = ids(it.ev, (y) => evIds.has(y), 32);
    if (fin(it.t, 0, 86400)) x.t = r3(it.t);   // 10/11/2026 (PR 1.2א): זמן המילה של הציטוט (vicheck.anchor בעובד)
    const q = txt(it.q, VI_TXT.q);
    if (q) x.q = q;
    x.src = VI_SRC.includes(it.src) ? it.src : 'speech';
    x.basis = VI_BASIS.includes(it.basis) ? it.basis : 'speaker';
    x.conf = VI_CONF.includes(it.conf) ? it.conf : 'med';
    x.ver = VI_VER.includes(it.ver) ? it.ver : 'unk';
    out.items.push(x);
  }
  const itIds = new Set(out.items.map((x) => x.id));
  out.chapters = chRaw.map((c) => {
    const x = Object.assign({ id: c.id }, span(c), { lvl: Number.isInteger(c.lvl) && c.lvl >= 1 && c.lvl <= 3 ? c.lvl : 1, title: txt(c.title, VI_TXT.title) });
    for (const k of ['sum', 'adds']) { const t = txt(c[k], VI_TXT[k]); if (t) x[k] = t; }
    x.items = ids(c.items, (y) => itIds.has(y), 400);
    return x;
  });
  const one = (v) => (typeof v === 'string' && itIds.has(v) ? v : null);
  const bf = isObj(o.briefing) ? o.briefing : {};
  out.briefing = {};
  if (one(bf.one)) out.briefing.one = bf.one;
  if (one(bf.bluf)) out.briefing.bluf = bf.bluf;
  out.briefing.take = ids(bf.take, (y) => itIds.has(y), VI_CAP.take);
  if (one(o.thesis)) out.thesis = o.thesis;
  if (one(o.big)) out.big = o.big;
  const tp = isObj(o.tpl) ? o.tpl : {}, tpl = {};
  for (const k of VI_TPL) { const x = ids(tp[k], (y) => itIds.has(y), VI_CAP.tpl); if (x.length) tpl[k] = x; }
  if (Object.keys(tpl).length) out.tpl = tpl;
  out.ledger = [];
  for (const l of lst(o.ledger, VI_CAP.ledger)) {
    if (!isObj(l) || !evIds.has(l.ref)) continue;
    if (one(l.used)) out.ledger.push({ ref: l.ref, used: l.used });
    else if (VI_DROP.includes(l.drop)) out.ledger.push({ ref: l.ref, drop: l.drop });
  }
  const q = isObj(o.quality) ? o.quality : {};
  const int = (v) => (Number.isInteger(v) && v >= 0 && v <= 1e5 ? v : 0);
  out.quality = { items: int(q.items), sup: int(q.sup), cov: fin(q.cov, 0, 1) ? r3(q.cov) : 0, asr: VI_ASRQ.includes(q.asr) ? q.asr : 'med',
    warn: [...new Set(lst(q.warn, VI_CAP.warn).filter((c) => VI_WARN.includes(c)))] };
  const ord = {};
  for (const k of VI_KEYS) if (k in out) ord[k] = out[k];
  return ord;
}

/* ---------- 2. המודל של הדף (טהור — נבדק בלי DOM) ---------- */
export function viIndex(v) {
  const ev = new Map(v.evidence.map((e) => [e.id, e])), sl = new Map(), slNo = new Map(), oc = new Map();
  v.slides.forEach((s, i) => { sl.set(s.id, s); slNo.set(s.id, i + 1); for (const o of s.ocr || []) oc.set(o, s); });
  return { ev, sl, slNo, oc, ocr: new Map(v.ocr.map((o) => [o.id, o])), it: new Map(v.items.map((x) => [x.id, x])), ch: new Map(v.chapters.map((c, i) => [c.id, i])) };
}
/* העוגן של פריט = מה שהשבב מציג: הזמן הראשון מהראיות (כמו firstT בשרתון), יחידת הדיבור הראשונה (לציטוט), והשקף —
   הראשון שמוזכר בראיות, או השקף שעל המסך בזמן הזה. בלי ראיות — null (אין שבב) */
export function anchorOf(it, ix, slides) {
  let t = null, s = null, e = null;
  for (const id of (it && it.ev) || []) {
    const u = ix.ev.get(id), x = ix.sl.get(id) || ix.oc.get(id), t0 = u ? u.t0 : x ? x.t0 : null;
    if (t0 != null && (t == null || t0 < t)) t = t0;
    if (u && (!e || u.t0 < e.t0)) e = u;
    if (x && !s) s = x;
  }
  if (t == null) return null;
  const w = it && fin(it.t, 0, 86400) ? it.t : null;   // PR 1.2א: זמן המילה הראשונה של הציטוט — מהעובד, מדויק (4.2)
  if (w != null) t = w;
  if (!s) s = (slides || []).find((x) => t >= x.t0 && t < x.t1) || null;
  return { t, e, s, n: s ? ix.slNo.get(s.id) || 0 : 0, w };
}
/* ---------- PR 2.1 (10/11/2026; התוכנית 8.6–8.9): תבניות לפי ז'אנר ותצוגות קהל — מעל אותו JSON, בלי טוקנים ----------
   ההעדפה (store.vw — ACCOUNT_KEYS דרך pwa_studio_v1): a — קהל (ריק = לפי הז'אנר), x — מומחה (בלי הגדרות ודוגמאות),
   c — תמציתי (3 נקודות לפרק, בלי "מה מוסיף" ושקפים). הבלוקים לפי הקהל; עסקים — בלי נוסחאות וגזירות, ו־bluf בראש */
export const VI_AUD = ['st', 'biz', 'res'];
const AUD_BIZ = ['business_webinar', 'investor_presentation', 'product_demo'], AUD_RES = ['conference_talk', 'panel', 'interview_podcast'];
export const viAudAuto = (g) => (AUD_BIZ.includes(g) ? 'biz' : AUD_RES.includes(g) ? 'res' : 'st');
export function normVw(o) {
  const x = isObj(o) ? o : {};
  return { a: VI_AUD.includes(x.a) ? x.a : '', x: x.x === 1 ? 1 : 0, c: x.c === 1 ? 1 : 0 };
}
export const viVw = (v, o) => { const p = normVw(o); p.a = p.a || viAudAuto(v && v.genre); return p; };
const VI_BLOCKS = { st: ['gist', 'lec', 'steps', 'defs', 'pitch', 'chs'], biz: ['gist', 'pitch', 'steps', 'chs'], res: ['gist', 'deep', 'pitch', 'steps', 'chs', 'defs'] };
export const viBlocks = (vw) => VI_BLOCKS[vw && vw.a] || VI_BLOCKS.st;
export const VI_DEFK = ['definition', 'formula', 'derivation', 'example'];
export const VI_CONCISE_N = 3;
const CORE_K = ['claim', 'data', 'caveat', 'action', 'definition', 'formula'];
const hideK = (k, vw) => (vw.x && (k === 'definition' || k === 'example')) || (vw.a === 'biz' && (k === 'formula' || k === 'derivation'));
/* פריטי הפרק לפי התצוגה. תמציתי — עד 3: קודם טענות, נתונים, הסתייגויות, פעולות, הגדרות ונוסחאות; בסדר הזמן */
export function chView(its, vw) {
  const a = its.filter((it) => !hideK(it.kind, vw));
  if (!vw.c) return a;
  const keep = new Set(a.filter((it) => CORE_K.includes(it.kind)).concat(a.filter((it) => !CORE_K.includes(it.kind))).slice(0, VI_CONCISE_N));
  return a.filter((it) => keep.has(it));
}
/* V43: ההגדרות, הנוסחאות, הגזירות והדוגמאות מכל הפרקים — לפי סוג, ובתוכו לפי הסדר */
export const defsOf = (v, vw) => VI_DEFK.filter((k) => !hideK(k, vw)).map((k) => ({ k, its: v.items.filter((it) => it.kind === k && it.ch) })).filter((g) => g.its.length);
/* סעיפי התבנית (v.tpl) → [{k, its}] בסדר המבוקש, רק מה שיש */
export const tplOf = (v, ix, keys) => (keys || VI_TPL).map((k) => ({ k, its: ((v.tpl || {})[k] || []).map((id) => ix.it.get(id)).filter(Boolean) })).filter((g) => g.its.length);

/* השורה האחת והנקודות (3–5): one ← bluf ← thesis; הנקודות מ־take, בלי השורה עצמה */
export function briefOf(v, ix) {
  const one = ix.it.get(v.briefing.one) || ix.it.get(v.briefing.bluf) || ix.it.get(v.thesis) || null;
  return { one, pts: v.briefing.take.map((id) => ix.it.get(id)).filter((x) => x && x !== one).slice(0, 5) };
}
/* הפריטים של פרק: מה שהפרק מפנה אליו, ואחריו פריטים שמצביעים על הפרק ולא נכנסו */
export function chapterItems(v, ix, c) {
  const out = c.items.map((id) => ix.it.get(id)).filter(Boolean), seen = new Set(c.items);
  for (const x of v.items) if (x.ch === c.id && !seen.has(x.id)) out.push(x);
  return out;
}
/* השקפים הממוזערים של פרק: מה שהפריטים שלו מפנים אליו; בלי — השקפים שבטווח הזמן של הפרק. עד 8 */
export function chapterSlides(v, ix, c, its) {
  const out = [], seen = new Set();
  for (const x of its) {
    const a = anchorOf(x, ix, v.slides);
    if (a && a.s && !seen.has(a.s.id)) { seen.add(a.s.id); out.push(a.s); }
  }
  if (!out.length) for (const s of v.slides) if (s.t0 >= c.t0 && s.t0 < c.t1 && s.img) out.push(s);
  return out.slice(0, 8);
}
const words = (s) => (String(s || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’.\-]*/gu) || []).length;
/* זמן הקריאה של הדף (כ־200 מילים לדקה), לפחות דקה */
export function readMin(v) {
  let w = 0;
  for (const x of v.items) w += words(x.text);
  for (const c of v.chapters) w += words(c.title) + words(c.sum) + words(c.adds);
  return Math.max(1, Math.round(w / 200));
}
export const viDraft = (v) => !!v && v.quality.warn.includes('vi_unver');
/* "מה לא נכנס" (V79): רק מה שנדחה מסיבה שמעניינת את הקורא — לא כפילות, קישוט, מילוי, כותרת או סדר יום */
const LEFT_SHOW = ['sponsor', 'budget', 'low_salience', 'unverified', 'asr_noise'];
export function leftOf(v, ix) {
  const out = [];
  for (const l of v.ledger) {
    if (!l.drop || !LEFT_SHOW.includes(l.drop)) continue;
    const e = ix.ev.get(l.ref), s = ix.sl.get(l.ref) || ix.oc.get(l.ref), o = ix.ocr.get(l.ref);
    out.push({ ref: l.ref, why: l.drop, t: e ? e.t0 : s ? s.t0 : 0, n: s ? ix.slNo.get(s.id) || 0 : 0, text: e ? e.text : o ? o.text : '' });
  }
  return out.sort((a, b) => a.t - b.t);
}
/* הפריט הפעיל בזמן הניגון: העוגן האחרון שלפני הזמן, עד 40 שנ׳ אחריו (בלי גלילה אוטומטית — רק הדגשה) */
export function activeAt(anchors, t) {
  let best = null;
  for (const [id, a] of anchors) { const d = t - a; if (d >= -1 && d < 40 && (best == null || a > anchors.get(best))) best = id; }
  return best;
}
export const chapterAt = (v, t) => v.chapters.findIndex((c) => t >= c.t0 && t < c.t1);
/* הסמן של "השמע מהשקף" בתוך vis.bin: טווח בתים סגור (Range) */
export const imgRange = (s) => (s && s.img ? 'bytes=' + s.img.o + '-' + (s.img.o + s.img.l - 1) : '');
/* ציטוט עם הקטע שמודגש: [לפני, המודגש, אחרי] (q בתוך הטקסט; לא נמצא — בלי הדגשה) */
export function markSplit(text, q) {
  const s = String(text || ''), k = String(q || '').trim();
  const i = k ? s.toLowerCase().indexOf(k.toLowerCase()) : -1;
  return i < 0 ? [s, '', ''] : [s.slice(0, i), s.slice(i, i + k.length), s.slice(i + k.length)];
}

/* ---------- 3. זיכרון המקום (V37): גלילה, פרקים פתוחים וזמן הסרטון — ב־store.vip (pwa_studio_v1, ב־ACCOUNT_KEYS) ----------
   עד 45 דק׳ — חזרה שקטה; אחרי פער (ונעצר באמצע הסרטון) — "המשך מ־23:10". רק מספרים ומזהי פרקים, בלי טקסט */
export const VI_QUIET_MS = 45 * 60 * 1000, VI_PLACE_MAX = 30;
export function normPlace(o) {
  if (!isObj(o) || !(Number.isFinite(+o.at) && +o.at > 0)) return null;
  const n = (x, hi) => (Number.isFinite(+x) && +x >= 0 ? Math.min(hi, Math.round(+x)) : 0);
  return { y: n(o.y, 1e6), op: Array.isArray(o.op) ? [...new Set(o.op.filter((x) => typeof x === 'string' && ID.c.test(x)))].slice(0, 400) : [], t: n(o.t, 86400), at: Math.round(+o.at) };
}
export function normPlaces(o) {
  const out = {};
  if (!isObj(o)) return out;
  const rows = Object.entries(o).filter(([k]) => /^j[A-Za-z0-9_-]{20}$/.test(k)).map(([k, x]) => [k, normPlace(x)]).filter(([, x]) => x);
  rows.sort((a, b) => b[1].at - a[1].at);
  for (const [k, x] of rows.slice(0, VI_PLACE_MAX)) out[k] = x;
  return out;
}
export const placeMode = (pl, now) => (!pl ? '' : now - pl.at > VI_QUIET_MS && pl.t >= 5 ? 'ask' : 'quiet');

/* ---------- 4. הדף ----------
   ctx: { T, h, btn, ico, fmtT, title, v (מנורמל), src: שפת המקור, place, now(), scroller(), flash(m),
          mkPlayer() → createPlayer (או null), slideUrl(slide) → Promise<כתובת blob|''>, onUx(k, v), onVf(id, why), onPlace(pl), t0 }
   מחזיר { el, closeSheet() → true אם הייתה פתוחה, destroy() }. הדף נבנה פעם אחת לפתיחה; studio.js מצרף את אותו el בכל ציור */
const WHY = ['wrong', 'ts', 'missing', 'attrib', 'overgen', 'shallow', 'unclear', 'long', 'other'];
export function renderVi(ctx) {
  const { T, h, btn, fmtT, v } = ctx;
  const ix = viIndex(v), br = briefOf(v, ix), dir = langDir(v.lang.src) || 'ltr';
  const anchors = new Map(), ptEls = new Map();   // מזהה פריט → זמן העוגן / הרכיבים שלו (להדגשה בזמן ניגון)
  const opened = new Set();
  const t0 = Date.now();
  let ctl = null, sh = null, alive = true, lastY = 0, plT = 0, curItem = null, visT = t0, rdMs = 0, txRows = null;
  const el = h('div', 'st-vi');
  el.dir = 'rtl';
  const tm = (t) => { const b = h('bdi', 'st-vi-t', fmtT(t)); b.dir = 'ltr'; return b; };
  const srcTxt = (tag, cls, s) => { const x = h(tag, cls, s); x.lang = v.lang.src; x.dir = s ? lineDir(s, dir) : dir; return x; };   // משולבת: לפי המילים
  const chipOf = (it) => {
    const a = anchorOf(it, ix, v.slides);
    if (!a) return null;
    anchors.set(it.id, a.t);
    const c = btn('st-vi-ev', null, () => { ctx.onUx('ch'); openSheet(it, a); }, 'ev:' + it.id);
    c.append(tm(a.t));
    if (a.n) c.append(' · ' + T('studioViSlide', { n: a.n }));
    return c;
  };
  const tagsOf = (it) => [
    it.src === 'screen_only' ? h('span', 'st-vi-tag', T('studioViScreenOnly')) : null,
    it.basis === 'analyst_inference' ? h('span', 'st-vi-tag', T('studioViBasisInf')) : it.basis === 'external_knowledge' ? h('span', 'st-vi-tag', T('studioViBasisExt')) : null,
  ].filter(Boolean);
  const point = (it, cls) => {
    const li = h('li', cls);
    const p = h('p', null, it.text);
    const c = chipOf(it);
    p.append(...tagsOf(it));
    if (c) p.append(c);
    li.append(p);
    if (it.q) { const q = h('p', 'st-vi-q'); q.append(srcTxt('bdi', null, '“' + it.q + '”')); li.append(q); }
    if (anchors.has(it.id)) { const a = ptEls.get(it.id) || []; a.push(li); ptEls.set(it.id, a); }
    return li;
  };

  /* המיני־נגן: נבנה רק בלחיצה הראשונה על "נגן מכאן"; דביק, נעלם בגלילה למטה וחוזר בגלילה למעלה */
  const mini = h('div', 'st-vi-mini');
  mini.hidden = true;
  const nowL = h('span', 'st-vi-now');
  const mrow = h('div', 'st-vi-mrow');
  const backB = btn('st-linkb', T('studioViBackTxt'), () => {
    const on = curItem && ptEls.get(curItem);
    const tgt = (on && on[0]) || el.querySelector('.st-vi-gist');
    if (tgt && tgt.scrollIntoView) tgt.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 'vi-back');
  const xB = btn('st-vi-x', null, () => { closePlayer(); }, 'vi-plx');
  xB.append(ctx.ico('x')); xB.setAttribute('aria-label', T('studioViClosePl'));
  mrow.append(nowL, backB, xB);
  const plBox = h('div', 'st-vi-plbox');
  mini.append(plBox, mrow);
  function playAt(t) {
    if (!ctl) {
      ctl = ctx.mkPlayer();
      if (!ctl) { ctx.flash(T('studioPlLoadErr')); return; }
      plBox.append(ctl.el);
      ctl.video.addEventListener('timeupdate', paint);
    }
    mini.hidden = false; mini.classList.remove('away');
    ctl.seek(Math.max(0, t)); ctl.play();
    ctx.onUx('pl');
  }
  function closePlayer() {
    if (ctl) { try { ctl.destroy(); } catch (e) {} ctl = null; }
    plBox.textContent = ''; mini.hidden = true; curItem = null;
    for (const a of ptEls.values()) for (const x of a) x.classList.remove('on');
    savePlace();
  }
  function paint() {
    if (!ctl) return;
    const t = ctl.video.currentTime || 0, ci = chapterAt(v, t);
    nowL.textContent = ci >= 0 ? v.chapters[ci].title : '';
    const id = activeAt(anchors, t);
    if (id !== curItem) {
      for (const a of ptEls.values()) for (const x of a) x.classList.remove('on');
      for (const x of ptEls.get(id) || []) x.classList.add('on');
      curItem = id;
    }
    if (txRows) { let cur = null; for (const r of txRows) if (r.t <= t) cur = r; for (const r of txRows) { if (r === cur) r.el.setAttribute('aria-current', 'true'); else r.el.removeAttribute('aria-current'); } }
    const now = Date.now();
    if (now - plT > 5000) { plT = now; savePlace(); }
  }

  /* הכותרת הרזה ותווית האיכות */
  const hd = h('header', 'st-vi-hd');
  hd.append(h('h1', 'st-large clamp', ctx.title || (v.video.title || '')));   // כמו דף העבודה
  const meta = h('div', 'st-vi-meta');
  meta.append(tm(v.video.dur), ' · ' + (v.lang.src === 'he' ? T('studioViInHe') : T('studioViInEn')) + ' · ' + T('studioViRead', { n: readMin(v) }));
  const trust = h('div', 'st-vi-trust');
  const tq = h('div');   // שתי שורות קבועות — בלי נקודה מפרידה שנשארת לבד בקצה שורה
  if (v.quality.items > 0) { const b = h('b'); const nn = h('bdi', null, v.quality.sup + '/' + v.quality.items); nn.dir = 'ltr'; b.dir = 'auto'; b.append(nn, ' ' + T('studioViSupL')); tq.append(b, h('span', 'st-vi-dot', '·')); }   // auto: בממשק באנגלית — כל פריט בסדר שלו בתוך הדף (rtl)
  tq.append(h('bdi', null, T('studioViAsr', { q: v.quality.asr === 'high' ? T('studioViAsrHi') : v.quality.asr === 'low' ? T('studioViAsrLo') : T('studioViAsrMd') })));
  trust.append(h('div', null, v.slides.length ? T('studioViAutoTS') : T('studioViAutoT')), tq);
  hd.append(meta, trust);
  el.append(mini);
  if (viDraft(v)) {   // 3.5: הנקודות לא אומתו מול התמליל — ו"אמת שוב" (PR 1.2ג; ctx.draftAct — הכפתור מ־studio.js)
    const db = h('div', 'st-banner warn st-vi-draft', T('studioViDraft'));
    if (ctx.draftAct) db.append(ctx.draftAct);
    el.append(db);
  }
  el.append(hd);
  const mode = placeMode(ctx.place, ctx.now());
  if (mode === 'ask') {
    const rb = btn('st-btn tint sm st-vi-resume', T('studioViResume', { t: fmtT(ctx.place.t) }), () => { rb.remove(); restore(ctx.place); playAt(ctx.place.t); }, 'vi-resume');
    el.append(rb);
  }

  /* PR 2.1 (V87, ‏V88, ‏V90): התצוגה — קהל, מתחיל/מומחה, תמציתי/מלא — מעל אותו JSON. שינוי בונה מחדש רק את הגוף */
  let vw = viVw(v, ctx.vw);
  const body = h('div', 'st-vi-body');
  // מקופל בשורה אחת ("תצוגה · סטודנט · מלא"); בפתיחה — שלוש בחירות st-seg2, כמו בשאר הסטודיו
  const vwRow = h('details', 'st-list st-vi-vw');
  const vwS = h('summary', 'st-row'), vwL = h('span', 'st-l'), vwV = h('span', 'st-vi-vwv'), vwChv = ctx.ico('chev', 'st-chev');
  vwL.append(h('b', null, T('studioViVw'))); vwS.append(vwL, vwV, vwChv); vwRow.append(vwS);
  const vwBox = h('div', 'st-vi-vwb');
  vwRow.append(vwBox);
  vwRow.addEventListener('toggle', () => vwChv.classList.toggle('open', vwRow.open));
  const AUD = [['st', T('studioViAudSt')], ['biz', T('studioViAudBiz')], ['res', T('studioViAudRes')]], LV = [[0, T('studioViLvBeg')], [1, T('studioViLvExp')]], LN = [[0, T('studioViLenFull')], [1, T('studioViLenShort')]];
  const seg = (opts, cur, set, k) => {
    const g = h('div', 'st-seg2'); g.setAttribute('role', 'radiogroup'); g.setAttribute('aria-label', T('studioViVw'));
    for (const [val, lbl] of opts) {
      const b = btn(null, null, () => { if (val === cur) return; set(val); if (ctx.onVw) ctx.onVw(normVw(vw)); paintVw(); build(); }, 'vw' + k + ':' + val);
      b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', val === cur ? 'true' : 'false'); b.append(h('b', null, lbl));
      g.append(b);
    }
    return g;
  };
  const lbl = (opts, val) => (opts.find((o) => o[0] === val) || opts[0])[1];
  function paintVw() {
    vwV.textContent = [lbl(AUD, vw.a), lbl(LV, vw.x), lbl(LN, vw.c)].join(' · ');
    const two = h('div', 'st-vi-vw2');
    two.append(seg(LV, vw.x, (x) => { vw.x = x; }, 'x'), seg(LN, vw.c, (x) => { vw.c = x; }, 'c'));
    vwBox.textContent = ''; vwBox.append(seg(AUD, vw.a, (x) => { vw.a = x; }, 'a'), two);
  }
  const list = (its, cls, tag) => { const ul = h(tag || 'ul', cls); for (const it of its) ul.append(point(it, 'st-vi-note')); return ul; };
  const card = (cls, ttl, sub) => { const c = h('div', 'st-vi-card ' + cls); c.append(h('h2', 'st-vi-ct', ttl)); if (sub) c.append(h('p', 'st-vi-cs', sub)); return c; };
  const TPL_T = { learn: T('studioViTpLearn'), board: T('studioViTpBoard'), stress: T('studioViTpStress'), exam: T('studioViTpExam'), offer: T('studioViTpOffer'), price: T('studioViTpPrice'), check: T('studioViTpCheck'), free: T('studioViTpFree') };
  const DEF_T = { definition: T('studioViDfDef'), formula: T('studioViDfFor'), derivation: T('studioViDfDer'), example: T('studioViDfEx') };
  const groups = (c, gs, names) => { for (const g of gs) c.append(h('h3', 'st-vi-gt', names[g.k]), list(vw.c ? g.its.slice(0, VI_CONCISE_N) : g.its, 'st-vi-notes')); return c; };
  const chEls = [];
  const BLK = {
    gist() {   // השורה האחת והנקודות; עסקים — השורה התחתונה (bluf) קודם
      const top = vw.a === 'biz' ? ix.it.get(v.briefing.bluf) || br.one : br.one, pts = br.pts.filter((x) => x !== top).slice(0, vw.c ? VI_CONCISE_N : 5);
      if (!top && !pts.length) return null;
      const g = h('div', 'st-vi-card st-vi-gist');   // כמו .st-jhero (זכוכית, --gl-card-sh)
      if (top) { const one = h('p', 'st-vi-one', top.text); const c = chipOf(top); if (c) one.append(c); g.append(one); }
      if (pts.length) { const ul = h('ul', 'st-vi-pts'); for (const it of pts) ul.append(point(it, 'st-vi-pt')); g.append(ul); }
      return g;
    },
    deep() {   // חוקר: התזה והתמונה הרחבה
      const gs = [[T('studioViThesis'), ix.it.get(v.thesis)], [T('studioViBig'), ix.it.get(v.big)]].filter((x) => x[1]);
      if (!gs.length) return null;
      const c = h('div', 'st-vi-card st-vi-deep');
      for (const [t, it] of gs) c.append(h('h3', 'st-vi-gt', t), list([it], 'st-vi-notes'));
      return c;
    },
    lec() { const gs = tplOf(v, ix, ['learn', 'board', 'stress', 'exam']); return gs.length ? groups(card('st-vi-lec', T('studioViLec')), gs, TPL_T) : null; },
    steps() { const gs = tplOf(v, ix, ['step']); if (!gs.length) return null; const c = card('st-vi-steps', T('studioViSteps')); c.append(list(gs[0].its, 'st-vi-notes st-vi-ol', 'ol')); return c; },
    pitch() { const gs = tplOf(v, ix, ['offer', 'price', 'check', 'free']); return gs.length ? groups(card('st-vi-pitch', T('studioViPitch'), T('studioViPitchS')), gs, TPL_T) : null; },
    defs() {   // V43 — מקופל; נבנה בפתיחה הראשונה
      const gs = defsOf(v, vw);
      if (!gs.length) return null;
      const d = h('details', 'st-list st-vi-defs');
      const s = h('summary', 'st-row'), l = h('span', 'st-l'), chv = ctx.ico('chev', 'st-chev');
      l.append(h('b', null, T('studioViDefs'))); s.append(l, chv); d.append(s);
      let built = false;
      d.addEventListener('toggle', () => { chv.classList.toggle('open', d.open); if (!d.open || built) return; built = true; d.append(groups(h('div', 'st-vi-chb'), gs, DEF_T)); if (ctl) paint(); });
      return d;
    },
    chs() { return chaptersBlock(); },
  };
  function build() {
    body.textContent = '';
    anchors.clear(); ptEls.clear(); chEls.length = 0; curItem = null;
    for (const k of viBlocks(vw)) { const x = BLK[k](); if (x) body.append(...[].concat(x)); }
    if (ctl) paint();
  }

  /* "בעמוד הזה" והפרקים המקופלים: הכותרת היא המסקנה, "פרק 3 מתוך 7" */
  const n = v.chapters.length;
  function chaptersBlock() {
    if (!n) return null;
    const out = [sec(T('studioViOnPage'))];
    const toc = h('nav', 'st-list st-vi-toc');   // .st-list/.st-row — אותה רשימה כמו בכל הסטודיו
    toc.setAttribute('aria-label', T('studioViChs'));
    v.chapters.forEach((c, i) => {
      const r = btn('st-row', null, () => { const d = chEls[i]; if (!d) return; d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 'toc:' + c.id);
      const l = h('span', 'st-l'); l.append(h('b', null, c.title));
      r.append(l, tm(c.t0));
      toc.append(r);
    });
    out.push(toc);
    const allB = btn('st-linkb', T('studioViOpenAll'), () => {
      const open = chEls.every((d) => d.open);
      for (const d of chEls) d.open = !open;
      allB.textContent = open ? T('studioViOpenAll') : T('studioViCloseAll');
    }, 'vi-all');
    out.push(sec(T('studioViChs'), allB));
    const chs = h('div', 'st-vi-chs');
    v.chapters.forEach((c, i) => {
      const d = h('details', 'st-list st-vi-ch');
      d.dataset.c = c.id;
      const s = h('summary', 'st-row');
      const k = h('span', 'st-l');
      const sm = h('small'); sm.append(T('studioViChOf', { i: i + 1, n }) + ' · ', tm(c.t0));
      k.append(h('b', null, c.title), sm);
      const chv = ctx.ico('chev', 'st-chev');
      s.append(k, chv);
      d.append(s);
      let built = false;
      d.addEventListener('toggle', () => {
        chv.classList.toggle('open', d.open);
        if (!d.open) return;
        if (!opened.has(c.id)) { opened.add(c.id); ctx.onUx('ex'); }
        if (built) return;
        built = true;
        const body = h('div', 'st-vi-chb');
        if (c.sum) body.append(h('p', 'st-vi-sum', c.sum));
        const its = chView(chapterItems(v, ix, c), vw);
        if (its.length) body.append(list(its, 'st-vi-notes'));
        if (c.adds && !vw.c) body.append(h('p', 'st-vi-adds', c.adds));
        const sls = vw.c ? [] : chapterSlides(v, ix, c, its);
        if (sls.length) {
          const th = h('div', 'st-vi-thumbs');
          for (const s2 of sls) {
            const b = btn('st-vi-th', null, () => openSheet(null, { t: s2.t0, s: s2, n: ix.slNo.get(s2.id) || 0, e: null }), 'th:' + s2.id);
            const f = h('span', 'st-vi-sl');
            b.append(f, h('small', null, T('studioViSlide', { n: ix.slNo.get(s2.id) || 0 })));
            if (s2.img) ctx.slideUrl(s2).then((u) => { if (u && alive) { const im = h('img'); im.alt = ''; im.decoding = 'async'; im.src = u; f.append(im); } }, () => {});
            th.append(b);
          }
          body.append(th);
        }
        body.append(btn('st-linkb st-vi-miss', T('studioViMiss'), (e) => { ctx.onUx('ms'); ctx.flash(T('studioViThanks')); e.currentTarget.disabled = true; }, 'miss:' + c.id));
        d.append(body);
        if (ctl) paint();
      });
      chEls.push(d);
      chs.append(d);
    });
    out.push(chs);
    return out;
  }
  paintVw();
  el.append(vwRow, body);
  build();

  /* "מה לא נכנס" — הפנקס */
  const left = leftOf(v, ix);
  if (left.length) {
    el.append(sec(T('studioViLeft')));
    const ul = h('ul', 'st-list st-vi-left');
    for (const x of left.slice(0, 12)) {
      const li = h('li', 'st-row'), l = h('span', 'st-l'), b = h('b');
      b.append(whyLeft(x.why) + ' · ', x.n ? T('studioViSlide', { n: x.n }) : tm(x.t));
      l.append(b);
      if (x.text) { const q = h('small'); q.append(srcTxt('bdi', 'st-vi-lq', '“' + x.text.slice(0, 120) + (x.text.length > 120 ? '…' : '') + '”')); l.append(q); }
      li.append(l);
      ul.append(li);
    }
    if (left.length > 12) { const li = h('li', 'st-row st-vi-more'); li.append(h('span', 'st-l', T('studioMoreN', { n: left.length - 12 }))); ul.append(li); }
    el.append(ul);
  }

  /* התמליל המלא — מקופל; השורות נבנות בפתיחה הראשונה. נגיעה בשורה = ניגון ממנה */
  if (v.evidence.length) {
    const d = h('details', 'st-list st-vi-tx');
    const s = h('summary', 'st-row'), l = h('span', 'st-l'), chv = ctx.ico('chev', 'st-chev');
    l.append(h('b', null, T('studioViTx'))); s.append(l, chv);
    d.append(s);
    d.addEventListener('toggle', () => {
      chv.classList.toggle('open', d.open);
      if (!d.open || txRows) return;
      const box = srcTxt('div', 'st-vi-txb', null);
      txRows = v.evidence.slice().sort((a, b) => a.t0 - b.t0).slice(0, 3000).map((e) => {
        const r = btn('st-vi-txr', null, () => playAt(e.t0), 'tx:' + e.id);
        const sp = h('span', null, e.text); sp.dir = lineDir(e.text, dir);   // שורת תמליל בשפה אחרת (עברית בסרטון באנגלית) — בכיוון שלה
        r.append(tm(e.t0), sp);
        box.append(r);
        return { t: e.t0, el: r };
      });
      d.append(box);
      if (ctl) paint();
    });
    el.append(d);
  }
  if (!v.items.length) el.append(h('div', 'st-empty st-empty-sm', T('studioViNone')));

  function sec(t, end) { const s = h('div', end ? 'st-sec-t st-sec-row' : 'st-sec-t'); s.append(h('span', null, t)); if (end) s.append(end); return s; }   // = secT של הסטודיו
  function whyLeft(k) {
    switch (k) {
      case 'sponsor': return T('studioViLeftSponsor');
      case 'budget': return T('studioViLeftBudget');
      case 'unverified': return T('studioViLeftUnver');
      case 'asr_noise': return T('studioViLeftAsr');
      default: return T('studioViLeftLow');
    }
  }
  function whyName(k) {
    switch (k) {
      case 'wrong': return T('studioViWhyWrong');
      case 'ts': return T('studioViWhyTs');
      case 'missing': return T('studioViWhyMissing');
      case 'attrib': return T('studioViWhyAttrib');
      case 'overgen': return T('studioViWhyOvergen');
      case 'shallow': return T('studioViWhyShallow');
      case 'unclear': return T('studioViWhyUnclear');
      case 'long': return T('studioViWhyLong');
      default: return T('studioViWhyOther');
    }
  }

  /* חלונית הראיה (V77): הגיליון של הסטודיו (.st-rs — כמו גיליון הדירוג, זכוכית). "חזור" / נגיעה ברקע סוגרים (closeSheet מ־closeRequest) */
  function openSheet(it, a) {
    closeSheet();
    ctx.onUx('sh');
    sh = h('div', 'st-rs st-vi-sh');
    sh.dir = 'rtl';   // כמו הדף: התוכן בעברית גם בממשק באנגלית
    sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
    const box = h('div', 'st-rs-box st-vi-shin');
    const ttl = h('h2', 'st-rs-t'); ttl.id = 'st-vi-sht'; ttl.append(tm(a.t)); if (a.n) ttl.append(' · ' + T('studioViSlide', { n: a.n }));
    sh.setAttribute('aria-labelledby', ttl.id);
    box.append(h('div', 'st-rs-grab'), ttl);
    if (a.e) {
      const [pre, mk, post] = markSplit(a.e.text, it && it.q);
      const bq = srcTxt('blockquote', 'st-vi-bq', null); bq.dir = lineDir(a.e.text, dir);
      bq.append(pre);
      if (mk) bq.append(h('mark', null, mk));
      bq.append(post);
      box.append(bq);
    }
    if (it) box.append(h('p', 'st-vi-sht', it.text));
    if (a.s) {
      const f = h('div', 'st-vi-sl st-vi-shsl');
      box.append(f);
      const ocr = () => {   // בלי תמונה (או שלא נטענה) — שורות הטקסט מהשקף; בלי אף אחת — בלי מסגרת ריקה
        if (!f.isConnected) return;
        const lines = (a.s.ocr || []).map((id) => ix.ocr.get(id)).filter(Boolean).slice(0, 6);
        f.className = 'st-vi-shsl';
        for (const o of lines) { const p = h('p', null, o.text); p.dir = o.dir || 'auto'; f.append(p); }
        if (!lines.length) f.remove();
      };
      if (a.s.img) ctx.slideUrl(a.s).then((u) => { if (!u) { ocr(); return; } if (sh && f.isConnected) { const im = h('img'); im.alt = T('studioViSlide', { n: a.n }); im.src = u; f.append(im); } }, ocr);
      else ocr();
    }
    const acts = h('div', 'st-vi-acts');
    acts.append(btn('st-btn wide st-vi-play', T('studioViPlayHere'), () => { const t = a.w != null ? Math.max(0, a.w - CHIP_LEAD) : a.e ? a.e.t0 : a.t; closeSheet(); playAt(t); }, 'sh-play'));
    if (it) {
      const why = h('div', 'st-rs-chips st-vi-why');
      why.hidden = true; why.setAttribute('role', 'group'); why.setAttribute('aria-label', T('studioViWhyT'));
      for (const k of WHY) {
        why.append(btn('st-rs-chip', whyName(k), (e) => {
          e.currentTarget.classList.add('on'); e.currentTarget.setAttribute('aria-pressed', 'true');
          ctx.onVf(it.id, k, ctl ? ctl.video.currentTime || 0 : a.t);
          ctx.flash(T('studioViThanks'));
          setTimeout(closeSheet, 300);
        }, 'why:' + k));
      }
      acts.append(btn('st-btn wide ghost st-vi-rep', T('studioViReport'), () => { why.hidden = !why.hidden; }, 'sh-rep'));
      box.append(acts, why);
    } else box.append(acts);
    sh.append(box);
    sh.addEventListener('click', (e) => { if (e.target === sh) closeSheet(); });
    document.body.append(sh);
  }
  function closeSheet() { if (!sh) return false; const was = sh.isConnected; sh.remove(); sh = null; return was; }   // rsClose של הסטודיו יכול להסיר אותה קודם

  /* זיכרון המקום */
  function placeNow() {
    const sc = ctx.scroller();
    return { y: sc ? sc.scrollTop : 0, op: chEls.filter((d) => d.open).map((d) => d.dataset.c), t: ctl ? ctl.video.currentTime || 0 : ctx.place ? ctx.place.t : 0, at: ctx.now() };
  }
  function savePlace() { if (alive) ctx.onPlace(normPlace(placeNow())); }
  function restore(pl) {
    if (!pl) return;
    for (const d of chEls) if (pl.op.includes(d.dataset.c)) d.open = true;
    requestAnimationFrame(() => { const sc = ctx.scroller(); if (sc) sc.scrollTop = pl.y; });
  }
  if (mode === 'quiet') queueMicrotask(() => restore(ctx.place));
  if (ctx.t0 > 0) queueMicrotask(() => playAt(ctx.t0));   // קישור עמוק עם ‎&t= (V125)

  /* גלילה: המיני־נגן נעלם למטה וחוזר למעלה; המקום נשמר אחרי שהגלילה נרגעת */
  let scT = 0, scEl = null;
  const onScroll = () => {
    const sc = scEl, y = sc.scrollTop;
    if (!mini.hidden) mini.classList.toggle('away', y > lastY + 6 && y > 120);
    lastY = y;
    clearTimeout(scT); scT = setTimeout(savePlace, 800);
  };
  queueMicrotask(() => { scEl = ctx.scroller(); if (scEl) { lastY = scEl.scrollTop; scEl.addEventListener('scroll', onScroll, { passive: true }); } });
  const onVis = () => { if (document.hidden) { rdMs += Date.now() - visT; savePlace(); } else visT = Date.now(); };
  document.addEventListener('visibilitychange', onVis);
  ctx.onUx('o');

  function destroy() {
    if (!alive) return;
    savePlace();
    alive = false;
    closeSheet();
    if (ctl) { try { ctl.destroy(); } catch (e) {} ctl = null; }
    clearTimeout(scT);
    if (scEl) scEl.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVis);
    if (!document.hidden) rdMs += Date.now() - visT;
    ctx.onUx('rd', Math.min(4 * 3600, Math.round(rdMs / 1000)));
    if (n) {
      ctx.onUx('cov', opened.size / n);
      const vh = (typeof window !== 'undefined' && window.innerHeight) || 800;
      let lv = 0;
      chEls.forEach((d, i) => { if (d.getBoundingClientRect && d.getBoundingClientRect().top < vh / 2) lv = i + 1; });
      if (lv) ctx.onUx('lv', lv);
    }
  }
  return { el, closeSheet, destroy, sheetOpen: () => !!sh };
}
