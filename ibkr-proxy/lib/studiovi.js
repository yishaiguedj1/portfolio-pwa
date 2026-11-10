'use strict';
/* ניתוח סרטונים (9/11/2026, גל 0 — PR 0.2; docs/studio-video-analysis-plan.md). הכללים של עבודת ניתוח בשרתון — טהור,
   בלי קריאות. עבודת ניתוח = עבודת tr עם spec.vi = 1: אותו תור, אותו שרת ואותם קבצים ב־R2; העובד מנתב ל־analyze.py.
   **זהה לעובד** (translator/analyze.py — tests/studio-vi.test.js משווה): VI_V, ‏VI_LANGS, ‏VI_MAX_S, ‏VI_FAIL, ‏VI_WARN, ‏VI_OUTS (= VI_FILES).
   הנוסח של כל קוד — STRINGS בטלפון (viE_<קוד>). */

const VI_V = 'snb.video-analysis/1';
const VI_LANGS = ['he', 'en'];   // השפות שהניתוח יודע לתמלל; הניתוח עצמו בעברית (to = ['he'])
const VI_FROM = ['auto', 'he', 'en'];   // 10/11/2026 (PR 1.2א, 9.3 סעיף 2): מה הטופס שולח — "אוטומטי" = העובד מזהה (vt/lang.py ‏main_lang); לא he/en → vi_lang
const VI_MAX_S = 5400;           // 90 דק׳ ב־MVP (גל 2 — יותר)
/* 19.3: כישלון עוצר את העבודה; אזהרה נכנסת ל־vi.json (quality.warn) והעבודה ממשיכה */
const VI_FAIL = ['vi_off', 'vi_lang', 'vi_long', 'vi_card', 'vi_schema', 'cap'];
const VI_WARN = ['vi_noscreen', 'vi_lowres', 'vi_ocr', 'vi_asr_low', 'vi_partial', 'vi_unver', 'vi_ledger', 'ts_coarse'];
const VI_ERR = VI_FAIL.concat(VI_WARN);
const VI_OUTS = ['vi', 'vis', 'cues', 'same', 'thumb'];   // התוצרים, בסדר ההעלאה (vtt ו־meta — לא בהרצה יבשה) · 1.2ב: same (איכות מלאה, 4.4) במקום small

/* החלק של הניתוח ב־spec (normSpec): null = לא עבודת ניתוח. הרצה יבשה (dry: בלי Claude; מודדים זמן, זיכרון
   וטוקנים). מה שלא שייך לניתוח — נדחה (bad_spec): קובץ כתוביות, תרגום בטלפון, העלאה מהאפליקציה, קריוקי, Routine,
   העתק־הדבק. מקישור — כן (העובד מוריד ל־R2, כמו בתרגום) */
function viSpec(s) {
  if (!s || s.vi !== 1) return null;
  if (s.eng !== 'api' || s.src === 'subs' || s.ph === 1 || s.nu === 1 || s.ka === 1 || s.cp === 1 || s.ry === 1) return false;
  if (s.dry === 1) return { vi: 1, dry: 1 };
  // 10/11/2026 (PR 1.5א, V130): ניתוח עם Claude — רק עם הצהרת הזכויות מהטופס (vr). העובד מריץ אותו מ־1.2 (עד אז: vi_off, בלי Claude)
  return s.vr === 1 ? { vi: 1, vr: 1 } : false;
}
/* השפות: מקור עברית או אנגלית, יעד עברית בלבד */
const viLangOk = (sp) => !!sp && VI_FROM.includes(sp.from) && Array.isArray(sp.to) && sp.to.length === 1 && sp.to[0] === 'he';
/* האורך מהטלפון (0 = לא ידוע — העובד בודק אחרי הקליטה ומחזיר vi_long) */
const viTooLong = (sp) => !!sp && sp.dur > VI_MAX_S;
/* הסיכום שהעובד מדווח בסוף (vsm, 10.5): n פריטים, ok מאומתים, cov כיסוי ×100, so "רק על המסך", d משך בשניות.
   מספרים שלמים בלבד — בלי טקסט מהסרטון */
function viSummary(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
  const n = (x, hi) => (Number.isFinite(+x) && +x >= 0 ? Math.min(hi, Math.round(+x)) : 0);
  return { n: n(o.n, 1e5), ok: n(o.ok, 1e5), cov: n(o.cov, 100), so: n(o.so, 1e5), d: n(o.d, 86400) };
}

/* ---------- גל 1 (PR 1.3, 10/11/2026): vi.json — הסכמה של ה־MVP (נספח 19.1) ----------
   normVi = האימות בטלפון ובשרתון: שדה לא מוכר נזרק, ערך מחוץ ל־enum נזרק, הפניה למזהה שלא קיים נזרקת — ומוצג רק מה
   שעבר. **זהה ל־vicheck.py בעובד** (PR 1.2א) על אותם fixtures: translator/tests/fixtures/vi_ok.json (תקין — יוצא כמו
   שנכנס), vi_bad.json → vi_bad.norm.json (tests/studio-vi.test.js). הטקסט לא עובר HTML כאן — הדף מציג אותו כטקסט בלבד */
const VI_SEG = ['content', 'intro', 'qa', 'pitch', 'sponsor', 'self_promo', 'interaction_reminder', 'preview_recap', 'filler', 'logistics', 'demo', 'exercise'];
const VI_SRC = ['speech', 'screen_only', 'both'];
const VI_BASIS = ['speaker', 'analyst_inference', 'external_knowledge'];
const VI_CONF = ['high', 'med', 'low'];
const VI_VER = ['sup', 'part', 'uns', 'con', 'unk'];
const VI_DROP = ['duplicate', 'decorative', 'agenda', 'title_only', 'sponsor', 'filler', 'budget', 'low_salience', 'unverified', 'asr_noise'];
const VI_GENRES = ['academic_lecture', 'course_module', 'business_webinar', 'conference_talk', 'panel', 'interview_podcast', 'software_tutorial', 'product_demo', 'workshop', 'investor_presentation', 'other'];
const VI_ASRQ = ['high', 'med', 'low'];
/* תקרות: מספר רשומות לכל רשימה ואורך טקסט לכל שדה (הרצאה של 90 דק׳ ≈ 1,000 יחידות דיבור) */
const VI_CAP = { evidence: 20000, slides: 3000, ocr: 30000, segments: 2000, chapters: 400, items: 3000, ledger: 40000, states: 40, refs: 24, take: 7, warn: 16, tpl: 20 };
// PR 2.1 (V59): סעיפי התבנית לפי ז'אנר — מזהי פריטים בלבד. **זהה ל־VI_TPL ב־vicheck.py ובעותק השני (שרתון/טלפון)**
const VI_TPL = ['learn', 'board', 'stress', 'exam', 'step', 'offer', 'price', 'check', 'free'];
const VI_TXT = { text: 2000, q: 600, title: 300, sum: 3000, adds: 2000, vtitle: 300 };
const ID = { e: /^e\d{1,6}$/, s: /^s\d{1,5}$/, o: /^o\d{1,5}\.\d{1,4}$/, c: /^c\d{1,4}$/, n: /^n\d{1,5}$/ };
const VI_KEYS = ['v', 'pv', 'lang', 'genre', 'video', 'evidence', 'slides', 'ocr', 'segments', 'chapters', 'items', 'briefing', 'thesis', 'big', 'tpl', 'ledger', 'quality'];
const SPK_RE = /^S\d{1,2}$/, KIND_RE = /^[a-z][a-z_]{0,15}$/, LANG_RE = /^[a-z]{2,3}$/, VSRC_RE = /^[a-z]{1,8}$/;

const isObj = (o) => !!o && typeof o === 'object' && !Array.isArray(o);
const fin = (v, lo, hi) => typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi;
const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 1e4) / 1e4;
/* טקסט: בלי תווי בקרה (חוץ משורה חדשה), חתוך לתקרה. לא מחרוזת → null */
const txt = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, max) : null);
const span = (o) => (fin(o.t0, 0, 86400) && fin(o.t1, 0, 86400) && o.t1 >= o.t0 ? { t0: r3(o.t0), t1: r3(o.t1) } : null);
const list = (a, cap) => (Array.isArray(a) ? a.slice(0, cap) : []);
const ids = (a, ok, cap) => [...new Set(list(a, cap || 64).filter((x) => typeof x === 'string' && ok(x)))];

function normVi(o) {
  if (!isObj(o) || o.v !== VI_V) return null;
  const out = { v: VI_V, pv: Number.isInteger(o.pv) && o.pv >= 1 && o.pv <= 999 ? o.pv : 1 };
  const lg = isObj(o.lang) ? o.lang : {};
  out.lang = { src: VI_LANGS.includes(lg.src) ? lg.src : 'en', out: 'he' };
  out.genre = VI_GENRES.includes(o.genre) ? o.genre : 'other';
  const vd = isObj(o.video) ? o.video : {};
  out.video = { dur: fin(vd.dur, 0, 86400) ? r3(vd.dur) : 0 };
  if (VSRC_RE.test(String(vd.src || ''))) out.video.src = vd.src;
  if (txt(vd.title, VI_TXT.vtitle)) out.video.title = txt(vd.title, VI_TXT.vtitle);
  // יחידות הראיה: דיבור, שקפים, שורות OCR
  out.evidence = [];
  for (const e of list(o.evidence, VI_CAP.evidence)) {
    const sp = isObj(e) && ID.e.test(String(e.id || '')) && span(e), t = isObj(e) && txt(e.text, VI_TXT.text);
    if (!sp || t == null) continue;
    const x = Object.assign({ id: e.id }, sp, { spk: SPK_RE.test(String(e.spk || '')) ? e.spk : 'S1', text: t });
    if (fin(e.conf, 0, 1)) x.conf = r3(e.conf);
    if (Number.isInteger(e.w0) && Number.isInteger(e.w1) && e.w0 >= 0 && e.w1 >= e.w0) { x.w0 = e.w0; x.w1 = e.w1; }
    out.evidence.push(x);
  }
  out.ocr = [];
  for (const r of list(o.ocr, VI_CAP.ocr)) {
    const t = isObj(r) && ID.o.test(String(r.id || '')) && txt(r.text, VI_TXT.text);
    if (t == null || t === false) continue;
    const x = { id: r.id, text: t, conf: fin(r.conf, 0, 100) ? Math.round(r.conf) : 0, lang: LANG_RE.test(String(r.lang || '')) ? r.lang : 'und' };
    if (r.dir === 'rtl' || r.dir === 'ltr') x.dir = r.dir;
    out.ocr.push(x);
  }
  const ocrIds = new Set(out.ocr.map((x) => x.id));
  out.slides = [];
  for (const s of list(o.slides, VI_CAP.slides)) {
    const sp = isObj(s) && ID.s.test(String(s.id || '')) && span(s);
    if (!sp) continue;
    const x = Object.assign({ id: s.id }, sp, { kind: KIND_RE.test(String(s.kind || '')) ? s.kind : 'slide' });
    const st = list(s.states, VI_CAP.states).filter((y) => isObj(y) && Number.isInteger(y.k) && y.k >= 0 && y.k < 1000 && fin(y.t0, 0, 86400)).map((y) => ({ k: y.k, t0: r3(y.t0) }));
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
  for (const g of list(o.segments, VI_CAP.segments)) {
    const sp = isObj(g) && span(g);
    if (sp && VI_SEG.includes(g.type)) out.segments.push(Object.assign(sp, { type: g.type }));
  }
  // הפריטים — לפני הפרקים (הפרק מפנה אליהם), אבל הפרק של פריט חייב להיות פרק קיים
  const chRaw = list(o.chapters, VI_CAP.chapters).filter((c) => isObj(c) && ID.c.test(String(c.id || '')) && span(c) && txt(c.title, VI_TXT.title));
  const chIds = new Set(chRaw.map((c) => c.id));
  out.items = [];
  for (const it of list(o.items, VI_CAP.items)) {
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
  // התדריך, התזה והתמונה הגדולה — רק מזהי פריטים קיימים
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
  // פנקס הכיסוי: כל יחידת ראיה — או נוצלה בפריט, או נדחתה מסיבה ידועה
  out.ledger = [];
  for (const l of list(o.ledger, VI_CAP.ledger)) {
    if (!isObj(l) || !evIds.has(l.ref)) continue;
    if (one(l.used)) out.ledger.push({ ref: l.ref, used: l.used });
    else if (VI_DROP.includes(l.drop)) out.ledger.push({ ref: l.ref, drop: l.drop });
  }
  const q = isObj(o.quality) ? o.quality : {};
  const int = (v) => (Number.isInteger(v) && v >= 0 && v <= 1e5 ? v : 0);
  out.quality = { items: int(q.items), sup: int(q.sup), cov: fin(q.cov, 0, 1) ? r3(q.cov) : 0, asr: VI_ASRQ.includes(q.asr) ? q.asr : 'med',
    warn: [...new Set(list(q.warn, VI_CAP.warn).filter((c) => VI_WARN.includes(c)))] };
  // הסדר של נספח 19.1 (vi.json תקין יוצא בדיוק כמו שנכנס)
  const ord = {};
  for (const k of VI_KEYS) if (k in out) ord[k] = out[k];
  return ord;
}

/* ---------- המדדים (7.6) — התאום ב־JS של translator/vimetrics.py (PR 1.2ב), על vi.json המנורמל ----------
   **זהה ל־vimetrics.py** על אותו fixture: translator/tests/fixtures/vi_metrics.json ({in, ref, out}). רק מה שאפשר לחשב
   מ־vi.json עצמו (ועם ref — מול ייחוס): נאמנות, כיסוי, צורה ומבנה. ts_acc/wer/ocr_conf — בעובד, מול התמליל והזהב */
const words = (s) => (String(s || '').match(/[\p{L}\p{N}][\p{L}\p{N}'’.\-]*/gu) || []).length;
function firstT(it, byId) {
  let t = null;
  for (const id of it.ev || []) { const e = byId.get(id); if (e && (t == null || e.t0 < t)) t = e.t0; }
  return t;
}
/* F1 של הגבולות: גבול = t0 של כל פרק חוץ מהראשון; התאמה אחד־לאחד בחלון ±tol שניות (חמדני, מהקרוב לרחוק) */
function boundF1(pred, ref, tol) {
  if (!pred.length && !ref.length) return null;
  const pairs = [];
  pred.forEach((p, i) => ref.forEach((r, j) => { const d = Math.abs(p - r); if (d <= tol) pairs.push([d, i, j]); }));
  pairs.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]);
  const ui = new Set(), uj = new Set();
  let tp = 0;
  for (const [, i, j] of pairs) if (!ui.has(i) && !uj.has(j)) { ui.add(i); uj.add(j); tp++; }
  const pr = pred.length ? tp / pred.length : 0, rc = ref.length ? tp / ref.length : 0;
  return pr + rc > 0 ? r4((2 * pr * rc) / (pr + rc)) : 0;
}
const bounds = (chs) => (chs || []).map((c) => c.t0).filter((t) => fin(t, 0, 86400)).sort((a, b) => a - b).slice(1);
function viMetrics(vi, ref) {
  const v = normVi(vi);
  if (!v) return null;
  const its = v.items, n = its.length, dur = v.video.dur;
  const cnt = (f) => its.filter(f).length;
  const rate = (k) => (n ? r4(k / n) : null);
  const outW = its.reduce((s, it) => s + words(it.text), 0) + v.chapters.reduce((s, c) => s + words(c.sum) + words(c.adds), 0);
  const trW = v.evidence.reduce((s, e) => s + words(e.text), 0);
  const byId = new Map([...v.evidence, ...v.slides].map((x) => [x.id, x]));
  for (const s of v.slides) for (const oid of s.ocr || []) byId.set(oid, s);
  const used = new Set();
  for (const it of its) for (const id of it.ev) { const x = byId.get(id); if (x && ID.s.test(x.id)) used.add(x.id); }
  for (const l of v.ledger) if (l.used) { const x = byId.get(l.ref); if (x && ID.s.test(x.id)) used.add(x.id); }
  const ts = its.map((it) => firstT(it, byId)).filter((t) => t != null);
  const mid = dur > 0 && ts.length ? ts.filter((t) => t >= dur / 3 && t < (2 * dur) / 3).length / ts.length : null;
  const out = {
    n, support_rate: rate(cnt((x) => x.ver === 'sup')), part_rate: rate(cnt((x) => x.ver === 'part')),
    unknown_rate: rate(cnt((x) => x.ver === 'unk')),
    unsupported_per_1k: outW > 0 ? r4((cnt((x) => x.ver === 'uns' || x.ver === 'con') * 1000) / outW) : null,
    so_share: rate(cnt((x) => x.src === 'screen_only')), inf_share: rate(cnt((x) => x.basis !== 'speaker')),
    kf_total: v.slides.length, kf_used: used.size, kf_cov: v.slides.length ? r4(used.size / v.slides.length) : null,
    mid_ratio: mid == null ? null : r4(mid * 3),
    density: dur > 0 ? r4((n * 600) / dur) : null,                // פריטים לעשר דקות
    len_ratio: trW > 0 ? r4(outW / trW) : null,                     // מילות פלט למילת תמליל
    out_words: outW, n_ch: v.chapters.length,
  };
  const rc = ref && Array.isArray(ref.chapters) ? ref.chapters.filter((c) => isObj(c) && fin(c.t0, 0, 86400)) : null;
  if (rc) { const p = bounds(v.chapters), r = bounds(rc); out.ch_f1_5 = boundF1(p, r, 5); out.ch_f1_10 = boundF1(p, r, 10); }
  return out;
}
/* עלות לשעת הרצאה (5.4, המעבדה): דולר × 3600 ÷ משך. משך לא ידוע — null */
const viCostHour = (usd, dur) => (fin(usd, 0, 1e6) && fin(dur, 1, 86400) ? r4((usd * 3600) / dur) : null);

/* ---------- PR 1.6 (10/11/2026): חבילת הייחוס של סט הזהב — snb.vi-ref/1 (התוכנית 6.3) ----------
   המנהל עורך ומאשר בעמוד "ייחוס" (op viRef, מנהל בלבד). נשמרת בעבודת הניתוח עצמה (vrf, ב־JSON_FIELDS) — לא בריפו.
   bounds = גבולות פרקים (רמה 1–2), units = יחידות תוכן במשקל 1–3, qa = שאלות עם תשובה, זמן ודגל "רק על המסך",
   slides = שקפי מפתח, he = קטע תמליל ידני בעברית, meta = רישיון, דרגה (a/b) וז'אנר. שדה לא מוכר — נזרק */
const VR_V = 'snb.vi-ref/1', VR_MAX = 48000, VR_CAP = { bounds: 80, units: 80, qa: 30, slides: 40 };
const VR_TIERS = ['a', 'b'];
function normViRef(o) {
  if (!isObj(o)) return null;
  const tt = (v) => (fin(v, 0, 86400) ? Math.round(v) : null);
  const s = (v, max) => { const x = txt(v, max); return x ? x.trim() : ''; };
  const bounds = list(o.bounds, VR_CAP.bounds).filter(isObj).map((b) => ({ t0: tt(b.t0), lv: b.lv === 2 ? 2 : 1, title: s(b.title, 160) }))
    .filter((b) => b.t0 != null).sort((a, b) => a.t0 - b.t0 || a.lv - b.lv);
  const units = list(o.units, VR_CAP.units).filter(isObj).map((u) => ({ text: s(u.text, 400), w: [1, 2, 3].includes(u.w) ? u.w : 1 })).filter((u) => u.text);
  const qa = list(o.qa, VR_CAP.qa).filter(isObj).map((x) => ({ q: s(x.q, 300), a: s(x.a, 400), t: tt(x.t), so: x.so === 1 ? 1 : 0 })).filter((x) => x.q && x.a);
  const slides = list(o.slides, VR_CAP.slides).filter(isObj).map((x) => ({ t: tt(x.t), text: s(x.text, 400) })).filter((x) => x.t != null && x.text);
  const m = isObj(o.meta) ? o.meta : {};
  const meta = { lic: s(m.lic, 80), tier: VR_TIERS.includes(m.tier) ? m.tier : 'a', genre: VI_GENRES.includes(m.genre) ? m.genre : 'other' };
  const out = { v: VR_V, bounds, units, qa, slides, he: s(o.he, 4000), meta };
  if (!bounds.length && !units.length && !qa.length) return null;   // ייחוס ריק — לא ייחוס
  return Buffer.byteLength(JSON.stringify(out)) <= VR_MAX ? out : null;
}
/* מה שהעובד צריך לציון מול הייחוס: תחילת הפרקים ברמה 1, בשניות (גם הראשון — viMetrics מדלג עליו) */
const viRefBounds = (ref) => (ref && Array.isArray(ref.bounds) ? ref.bounds.filter((b) => b.lv === 1).map((b) => b.t0).slice(0, VR_CAP.bounds) : []);
const normVrb = (a) => (Array.isArray(a) ? a.filter((t) => fin(t, 0, 86400)).map(Math.round).sort((x, y) => x - y).slice(0, VR_CAP.bounds) : []);
/* הציון של הרצת זהב מול הייחוס (העובד — vimetrics.py, בדיווח האחרון): F1 של הגבולות ב־±5 וב־±10 שנ׳, 0..1. חסר — null */
function normVq(o) {
  if (!isObj(o)) return null;
  const p = (v) => (fin(v, 0, 1) ? r4(v) : null);
  const f5 = p(o.f5), f10 = p(o.f10);
  return f5 == null && f10 == null ? null : { f5, f10 };
}

/* ---------------------------------------------------------------- השופט בזוגות והקריטריון (PR 1.6, התוכנית 6.5 ו־6.7)
   **תאום של translator/vimetrics.py** (wilson_lb, ‏boot_lb, ‏decide) — אותו מחולל (LCG) ואותו סדר חיבור, כך שהתוצאה זהה
   (tests/fixtures/vi-decide.json נבדק בשני הצדדים). השרתון מכריע על כל המקורות של הגל יחד; העובד שופט זוג אחד */
const VJ_HARD = ['support_rate', 'ts_acc', 'kf_cov'], VJ_NO_REG = -0.02, VJ_BOOT_N = 1000, VJ_BOOT_SEED = 7, VJ_COST_UP = 0.10, VJ_TIME_UP = 0.05;
const VJ_W = ['X', 'Y', 'tie'];
function wilsonLb(k, n, z = 1.96) {
  if (!(n > 0)) return null;
  const p = k / n, d = 1 + z * z / n;
  return r4((p + z * z / (2 * n) - z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d);
}
/* מחולל קבוע (LCG, ‏31 ביט) — = _lcg ב־vimetrics.py. הביטים העליונים (הנמוכים ב־LCG מחזוריים) */
function lcg(seed) {
  let s = seed >>> 0;
  return (n) => { s = ((Math.imul(s, 1103515245) + 12345) >>> 0) & 0x7fffffff; return Math.floor(s / 65536) % n; };
}
/* diffs = {סרטון: [הפרשים]} → הגבול התחתון (2.5%) של ממוצע ההפרש, ב־bootstrap שדוגם סרטונים (לא פריטים) */
function bootLb(diffs, n = VJ_BOOT_N, seed = VJ_BOOT_SEED) {
  const vids = Object.keys(diffs || {}).sort().filter((v) => (diffs[v] || []).some((x) => x != null));
  if (!vids.length) return null;
  const rnd = lcg(seed), means = [];
  for (let i = 0; i < n; i++) {
    let t = 0, c = 0;
    for (let k = 0; k < vids.length; k++) for (const x of diffs[vids[rnd(vids.length)]]) if (x != null) { t += x; c++; }
    means.push(t / c);
  }
  means.sort((a, b) => a - b);
  return r4(means[Math.floor(0.025 * n)]);
}
/* rows — שורה לכל זוג (אותו סרטון): {vid, w: 'X'|'Y'|'tie' (X = A הבסיס, Y = B המועמדת), a: {מדדים, usd, sec}, b: {…}, b_uns}.
   → {pass, wins, losses, ties, wlb, reg: {מדד: lb}, hard, cost, time, why} */
function viDecide(rows) {
  const rs = (Array.isArray(rows) ? rows : []).filter(isObj);
  const w = rs.filter((r) => r.w === 'Y').length, lo = rs.filter((r) => r.w === 'X').length;
  const out = { wins: w, losses: lo, ties: rs.length - w - lo, wlb: wilsonLb(w, w + lo), reg: {}, why: [] };
  if (out.wlb == null || out.wlb <= 0.5) out.why.push('wins');
  for (const k of VJ_HARD) {
    const d = {};
    for (const r of rs) {
      const a = (r.a || {})[k], b = (r.b || {})[k];
      if (typeof a === 'number' && typeof b === 'number') (d[String(r.vid)] = d[String(r.vid)] || []).push(b - a);
    }
    out.reg[k] = bootLb(d);
    if (out.reg[k] != null && out.reg[k] < VJ_NO_REG) out.why.push('reg_' + k);
  }
  out.hard = rs.reduce((s, r) => s + (Math.floor(+r.b_uns) || 0), 0);
  if (out.hard > 0) out.why.push('hard');
  const tot = (side, f) => rs.reduce((s, r) => s + (+((r[side] || {})[f]) || 0), 0);
  const ca = tot('a', 'usd'), cb = tot('b', 'usd'), ta = tot('a', 'sec'), tb = tot('b', 'sec');
  out.cost = ca > 0 ? r4(cb / ca - 1) : null;
  out.time = ta > 0 ? r4(tb / ta - 1) : null;
  if (out.cost != null && out.cost > VJ_COST_UP) out.why.push('cost');
  if (out.time != null && out.time > VJ_TIME_UP) out.why.push('time');
  out.pass = !out.why.length;
  return out;
}
/* מה שהעובד מדווח בסוף עבודת השופט (analyze.vi_judge): {v, p: [{j, wa, w, ex, ey, yu, a, b}], usd} — רק מספרים ומזהים.
   j = השיבוט של B, ‏wa = הזרוע שלו; ex/ey = נקודות MQM; yu = טענות לא נתמכות ב־B ששתי ההרצות הסכימו עליהן; a/b = המדדים */
function normVjd(o) {
  if (!isObj(o) || !Array.isArray(o.p)) return null;
  const m = (x) => { const r = {}; if (isObj(x)) for (const k of VJ_HARD) if (fin(x[k], 0, 1)) r[k] = r4(x[k]); return r; };
  const n = (v, hi) => (fin(v, 0, hi) ? Math.floor(v) : 0);
  const p = o.p.slice(0, 8).filter(isObj).filter((x) => /^j[A-Za-z0-9_-]{20}$/.test(String(x.j || '')) && Number.isInteger(x.wa) && x.wa >= 1 && x.wa < 8)
    .map((x) => ({ j: String(x.j), wa: x.wa, w: VJ_W.includes(x.w) ? x.w : null, ex: n(x.ex, 1e5), ey: n(x.ey, 1e5), yu: n(x.yu, 1e3), a: m(x.a), b: m(x.b) }));
  return p.length ? { v: 1, p, usd: fin(o.usd, 0, 100) ? r4(o.usd) : null } : null;
}

module.exports = { VI_V, VI_LANGS, VI_FROM, VI_MAX_S, VI_FAIL, VI_WARN, VI_ERR, VI_OUTS, viSpec, viLangOk, viTooLong, viSummary,
  VI_SEG, VI_SRC, VI_BASIS, VI_CONF, VI_VER, VI_DROP, VI_GENRES, VI_CAP, VI_TPL, normVi, viMetrics, viCostHour, boundF1,
  VR_V, VR_MAX, VR_CAP, normViRef, viRefBounds, normVrb, normVq, VJ_HARD, wilsonLb, bootLb, viDecide, normVjd };
