// ניתוח סרטונים, גל 1 — PR 1.5ב (10/11/2026): דף הניתוח (studiovi.js; התוכנית 9.4–9.7).
// normVi בטלפון = normVi בשרתון (אותם fixtures), המודל של הדף, רינדור מ־fixture ב־DOM מדומה (שבב → זמן, חלונית הראיה,
// "חזור" סוגר אותה, טקסט מהמודל עם HTML מוצג כטקסט), "דווח על טעות", זיכרון המקום, והחיבורים ב־studio.js.
// הרצה: node tests/studio-vi-page.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const fx = (f) => JSON.parse(read('translator/tests/fixtures/' + f));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* DOM מדומה — מספיק לדף: עץ, טקסט, מאפיינים, אירועים, details */
function mkDoc() {
  const listeners = new Map();
  class El {
    constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.parent = null; this._t = ''; this.className = ''; this.attrs = {}; this.dataset = {}; this.style = {}; this.ev = {}; this.hidden = false; this._open = false; this.scrollTop = 0; }
    get textContent() { return this._t + this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join(''); }
    set textContent(v) { this._t = v == null ? '' : String(v); this.children = []; }
    append(...xs) { for (const x of xs) { if (x == null) continue; if (typeof x === 'string') this.children.push(x); else { if (x.parent) x.remove(); x.parent = this; this.children.push(x); } } }
    remove() { if (this.parent) { this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } }
    get isConnected() { let p = this; while (p.parent) p = p.parent; return p === doc.body; }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
    removeAttribute(k) { delete this.attrs[k]; }
    addEventListener(k, f) { (this.ev[k] = this.ev[k] || []).push(f); }
    removeEventListener(k, f) { this.ev[k] = (this.ev[k] || []).filter((x) => x !== f); }
    fire(k) { for (const f of this.ev[k] || []) f({ currentTarget: this, target: this }); }
    click() { if (!this.disabled) this.fire('click'); }
    get classList() { const self = this; const set = () => new Set(self.className.split(/\s+/).filter(Boolean)); return {
      add(c) { const s = set(); s.add(c); self.className = [...s].join(' '); }, remove(c) { const s = set(); s.delete(c); self.className = [...s].join(' '); },
      toggle(c, on) { const s = set(); if (on === undefined ? !s.has(c) : on) s.add(c); else s.delete(c); self.className = [...s].join(' '); }, contains(c) { return set().has(c); } }; }
    get open() { return this._open; }
    set open(v) { const was = this._open; this._open = !!v; if (was !== this._open) this.fire('toggle'); }
    all(pred, out = []) { for (const c of this.children) if (typeof c !== 'string') { if (pred(c)) out.push(c); c.all(pred, out); } return out; }
    byCls(c) { return this.all((x) => x.className.split(/\s+/).includes(c)); }
    byK(k) { return this.all((x) => x.dataset.k === k)[0]; }
    querySelector(sel) { const c = sel.replace(/^\./, ''); return this.byCls(c)[0] || null; }
    scrollIntoView() { this.scrolled = (this.scrolled || 0) + 1; }
    getBoundingClientRect() { return { top: 0 }; }
  }
  const doc = { body: new El('body'), hidden: false, createElement: (t) => new El(t),
    addEventListener: (k, f) => listeners.set(k, f), removeEventListener: (k) => listeners.delete(k) };
  return { doc, El };
}

(async () => {
  const VI = require(path.join(root, 'ibkr-proxy/lib/studiovi.js'));
  const SL = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));
  const P = await import(path.join(root, 'studiovi.js'));
  const src = read('studiovi.js'), sj = read('studio.js'), css = read('studio.css'), sw = read('sw.js'), app = read('app.js'), sa = read('studio-app.js');

  /* ---------- 1. normVi: הטלפון = השרתון ---------- */
  const good = fx('vi_ok.json'), bad = fx('vi_bad.json'), badN = fx('vi_bad.norm.json');
  ok(same(P.normVi(good), good) && same(P.normVi(good), VI.normVi(good)), 'vi_ok: יוצא כמו שנכנס, כמו בשרתון');
  ok(same(P.normVi(bad), badN) && same(P.normVi(bad), VI.normVi(bad)), 'vi_bad → vi_bad.norm, כמו בשרתון');
  const muts = [null, {}, { v: 'x' }, Object.assign({}, good, { v: 'snb.video-analysis/2' }), Object.assign({}, good, { items: 'x', chapters: [{ id: 'c1' }] }),
    Object.assign({}, good, { quality: { warn: ['vi_unver', 'zzz', 'vi_unver'], asr: 'bad', items: -1 } }), Object.assign({}, good, { lang: { src: 'fr' }, genre: 'x', pv: 0 })];
  ok(muts.every((m) => same(P.normVi(m), VI.normVi(m))), 'קלטים פגומים — אותו פלט בטלפון ובשרתון (' + muts.length + ')');
  for (const k of ['VI_V', 'VI_LANGS', 'VI_WARN', 'VI_SEG', 'VI_SRC', 'VI_BASIS', 'VI_CONF', 'VI_VER', 'VI_DROP', 'VI_GENRES']) ok(same(P[k], VI[k]), k + ' = השרתון');
  ok(same(SL.VF_WHY, eval(/export const VF_WHY = (\[[^\]]*\])/.exec(sj)[1])), 'VF_WHY בטלפון = השרתון (studiolearn)');

  /* ---------- 2. המודל של הדף ---------- */
  const v = P.normVi(good), ix = P.viIndex(v);
  const a1 = P.anchorOf(ix.it.get('n1'), ix, v.slides), a2 = P.anchorOf(ix.it.get('n2'), ix, v.slides);
  ok(a1 && a1.t === 12.5 && a1.e.id === 'e1', 'העוגן: הזמן הראשון מהראיות ויחידת הדיבור');
  ok(a2 && a2.t === 600 && a2.s.id === 's1' && a2.n === 1, 'העוגן: שקף מהראיות → "שקף 1"');
  ok(P.anchorOf({ ev: [] }, ix, v.slides) === null, 'פריט בלי ראיות — בלי שבב');
  const aw = P.anchorOf({ ev: ['e1'], t: 13.25 }, ix, v.slides), an = P.anchorOf({ ev: ['e1'], t: '13' }, ix, v.slides);
  ok(aw.t === 13.25 && aw.w === 13.25 && an.w === null && an.t === a1.t, 'PR 1.2א: זמן המילה מהעובד (t) גובר על תחילת היחידה; t לא מספר — מתעלמים');
  ok(/const CHIP_LEAD = 0\.3;/.test(src) && /const t = a\.w != null \? Math\.max\(0, a\.w - CHIP_LEAD\) : a\.e \? a\.e\.t0 : a\.t;/.test(src), 'נגן מכאן: 0.3 שנ׳ לפני המילה (4.2 סעיף 3)');
  const br = P.briefOf(v, ix);
  ok(br.one.id === 'n2' && same(br.pts.map((x) => x.id), ['n1', 'n3']), 'השורה האחת (one) והנקודות — בלי השורה עצמה');
  ok(same(P.chapterItems(v, ix, v.chapters[0]).map((x) => x.id), ['n1']), 'הפריטים של פרק');
  ok(P.readMin(v) >= 1, 'זמן קריאה — לפחות דקה');
  ok(!P.viDraft(v) && P.viDraft(P.normVi(Object.assign({}, good, { quality: { warn: ['vi_unver'] } }))), 'טיוטה = vi_unver');
  const vl = P.normVi(Object.assign({}, good, { ledger: [{ ref: 'e1', drop: 'low_salience' }, { ref: 's3', drop: 'decorative' }, { ref: 's2', drop: 'unverified' }] }));
  const left = P.leftOf(vl, P.viIndex(vl));
  ok(left.length === 2 && left.every((x) => x.why !== 'decorative') && left[0].t <= left[1].t, '"מה לא נכנס": בלי קישוט/כפילות, לפי הזמן');
  ok(P.activeAt(new Map([['n1', 10], ['n2', 100]]), 105) === 'n2' && P.activeAt(new Map([['n1', 10]]), 200) === null, 'הנקודה הפעילה: העוגן האחרון, עד 40 שנ׳');
  ok(P.imgRange({ img: { o: 100, l: 50 } }) === 'bytes=100-149' && P.imgRange({}) === '', 'טווח הבתים של תמונת שקף ב־vis.bin');
  ok(same(P.markSplit('Most of it happens in deep sleep.', 'deep sleep'), ['Most of it happens in ', 'deep sleep', '.']) && same(P.markSplit('abc', 'x'), ['abc', '', '']), 'הדגשת הציטוט בתוך הראיה');

  /* ---------- 3. זיכרון המקום ---------- */
  const now = 1.8e12, pl = P.normPlace({ y: 812.4, op: ['c1', 'bad', 'c1'], t: 1390.6, at: now - 1000, x: 'zzz' });
  ok(same(pl, { y: 812, op: ['c1'], t: 1391, at: now - 1000 }), 'normPlace: מספרים ומזהי פרקים בלבד');
  ok(P.normPlace({ y: 1 }) === null, 'בלי זמן שמירה — אין מקום');
  ok(P.placeMode(pl, now) === 'quiet' && P.placeMode(Object.assign({}, pl, { at: now - 2 * 3600e3 }), now) === 'ask' && P.placeMode(Object.assign({}, pl, { t: 0, at: 1 }), now) === 'quiet' && P.placeMode(null, now) === '', 'עד 45 דק׳ — חזרה שקטה; אחרי פער — "המשך מ־"');
  const many = {}; for (let i = 0; i < 40; i++) many['j' + String(i).padStart(20, '0')] = { at: 1000 + i, t: 1 };
  many.bad = { at: 5 };
  const np = P.normPlaces(many);
  ok(Object.keys(np).length === P.VI_PLACE_MAX && !np.bad && np['j' + String(39).padStart(20, '0')], 'normPlaces: עד 30 העבודות האחרונות, מזהה עבודה בלבד');

  /* ---------- 4. רינדור מ־fixture ---------- */
  const { doc } = mkDoc();
  global.document = doc;
  global.requestAnimationFrame = (f) => f();
  const T = (k, o) => k + (o ? JSON.stringify(o) : '');
  const h = (tag, cls, txt) => { const e = doc.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const btn = (cls, label, fn, k) => { const b = h('button', cls, label); if (k) b.dataset.k = k; if (fn) b.addEventListener('click', fn); return b; };
  const ux = [], vf = [], places = [], seeks = [];
  let mk = 0;
  const scroller = h('div', 'st-root');
  const evil = JSON.parse(JSON.stringify(good));
  evil.items[0].text = '<img src=x onerror=alert(1)>';
  const ctx = (vv, extra) => Object.assign({ T, h, btn, ico: (k) => h('svg', 'ic-' + k), fmtT: (s) => String(Math.floor(s)), v: vv, title: 'דמו', place: null, now: () => now,
    scroller: () => scroller, flash: () => {}, t0: 0, slideUrl: () => Promise.resolve('blob:x'),
    mkPlayer: () => { mk++; const video = h('video'); video.currentTime = 0; return { el: h('div', 'st-pl'), video, seek: (t) => { seeks.push(t); video.currentTime = t; }, play() {}, destroy() { this.dead = true; } }; },
    onUx: (k, x) => ux.push([k, x == null ? 1 : x]), onVf: (id, why, sec) => vf.push([id, why, sec]), onPlace: (x) => places.push(x) }, extra);
  const pg = P.renderVi(ctx(P.normVi(evil)));
  await new Promise((r) => setTimeout(r, 0));
  const el = pg.el;
  ok(el.byCls('st-vi-gist').length === 1 && el.byCls('st-vi-one')[0].textContent.startsWith('הקיבוע'), 'השורה האחת בראש הדף');
  ok(el.byCls('st-vi-pt').length === 2, 'שתי נקודות מתחת לשורה');
  const p1 = el.byCls('st-vi-pt')[0];
  ok(p1.textContent.includes('<img src=x onerror=alert(1)>') && p1.all((x) => x.tagName === 'IMG').length === 0, 'טקסט מהמודל עם HTML — מוצג כטקסט, בלי רכיב');
  ok(!/innerHTML|outerHTML|insertAdjacentHTML/.test(src), 'studiovi.js בלי innerHTML');
  const chip = el.byK('ev:n1');
  ok(chip && chip.textContent.startsWith('12'), 'שבב → הזמן (12.5 שנ׳)');
  ok(el.byK('ev:n2').textContent.includes('studioViSlide{"n":1}'), 'שבב עם שקף: "12:34 · שקף 1"');
  ok(el.byCls('st-vi-q')[0].all((x) => x.lang === 'en' && x.dir === 'ltr').length === 1, 'הציטוט בשפת המקור, משמאל לימין');
  ok(el.byCls('st-vi-ch').length === 3 && el.byCls('st-vi-chb').length === 0, 'שלושה פרקים, מקופלים (הגוף נבנה בפתיחה)');
  ok(el.byCls('st-vi-toc')[0].byCls('st-row').length === 3 && el.byCls('st-vi-toc')[0].className.includes('st-list'), '"בעמוד הזה" — שורה לכל פרק (.st-list/.st-row של הסטודיו)');
  ok(el.byCls('st-vi-trust')[0].textContent.includes('2/4'), 'תווית האיכות: 2/4 אומתו');
  ok(!el.byCls('st-vi-draft').length, 'בלי vi_unver — בלי פס טיוטה');
  ok(ux.some(([k]) => k === 'o'), 'מונה פתיחה (o)');
  // פרק נפתח → הערות, שקף ממוזער, "חסר כאן משהו"
  const ch2 = el.byCls('st-vi-ch')[1];
  ch2.open = true;
  ok(ch2.byCls('st-vi-chb').length === 1 && ch2.byCls('st-vi-note').length >= 1 && ux.some(([k]) => k === 'ex'), 'פתיחת פרק — הגוף נבנה, מונה ex');
  ok(ch2.byCls('st-vi-th').length >= 1, 'שקף ממוזער בפרק');
  ch2.byCls('st-vi-miss')[0].click();
  ok(ux.some(([k]) => k === 'ms') && ch2.byCls('st-vi-miss')[0].disabled, '"חסר כאן משהו" — מונה ms, פעם אחת');
  // חלונית הראיה
  chip.click();
  const sh = doc.body.byCls('st-vi-sh')[0];
  ok(sh && pg.sheetOpen() && ux.some(([k]) => k === 'ch') && ux.some(([k]) => k === 'sh'), 'שבב → חלונית הראיה (מונים ch, sh)');
  ok(sh.className.split(' ').includes('st-rs') && sh.byCls('st-rs-box').length === 1 && sh.byCls('st-rs-grab').length === 1 && sh.byCls('st-rs-t').length === 1 && sh.getAttribute('aria-modal') === 'true',
    'החלונית — הגיליון של הסטודיו (.st-rs / .st-rs-box, כמו גיליון הדירוג)');
  ok(sh.byK('sh-play').className.includes('st-btn wide') && sh.byK('sh-rep').className.includes('st-btn wide ghost'), 'הכפתורים — st-btn wide (ו־ghost) של הסטודיו');
  const bq = sh.byCls('st-vi-bq')[0];
  ok(bq && bq.lang === 'en' && bq.all((x) => x.tagName === 'MARK').length === 1, 'הציטוט בשפת המקור, והקטע מהפריט מודגש');
  ok(pg.closeSheet() === true && !doc.body.byCls('st-vi-sh').length && pg.closeSheet() === false, '"חזור" (closeSheet) סוגר את החלונית, ואחר כך לא עושה כלום');
  // תמונת שקף שלא נטענה: שורות הטקסט מהשקף (בלי מסגרת 16:9 ריקה); החלונית בכיוון התוכן
  const pgN = P.renderVi(ctx(P.normVi(good), { slideUrl: () => Promise.resolve(''), onUx: () => {}, onPlace: () => {}, onVf: () => {} }));
  pgN.el.byK('ev:n2').click();
  await new Promise((r) => setTimeout(r, 0));
  const shN = doc.body.byCls('st-vi-sh')[0], fN = shN.byCls('st-vi-shsl')[0];
  ok(shN.dir === 'rtl' && fN && !shN.byCls('st-vi-sl').length && fN.all((x) => x.tagName === 'P').length === 2 && !fN.all((x) => x.tagName === 'IMG').length, 'שקף בלי תמונה — שתי שורות ה־OCR, בלי מסגרת ריקה; dir=rtl');
  pgN.closeSheet();
  const gN = JSON.parse(JSON.stringify(good)); gN.slides[0].ocr = []; gN.items.find((x) => x.id === 'n4').ev = ['e1'];
  const pgM = P.renderVi(ctx(P.normVi(gN), { slideUrl: () => Promise.resolve(''), onUx: () => {}, onPlace: () => {}, onVf: () => {} }));
  pgM.el.byK('ev:n2').click();
  await new Promise((r) => setTimeout(r, 0));
  ok(!doc.body.byCls('st-vi-sh')[0].byCls('st-vi-shsl').length, 'בלי תמונה ובלי OCR — בלי מסגרת בכלל');
  pgM.closeSheet(); pgN.destroy(); pgM.destroy();
  ok(el.byCls('st-vi-trust')[0].children.filter((c) => typeof c !== 'string').length === 2, 'שורת האמינות — שתי שורות (בלי נקודה לבד בקצה)');
  // דווח על טעות
  el.byK('ev:n1').click();
  const sh2 = doc.body.byCls('st-vi-sh')[0];
  const why = sh2.byCls('st-vi-why')[0];
  ok(why.hidden, 'שבבי הסיבה מוסתרים עד "דווח על טעות"');
  sh2.byK('sh-rep').click();
  ok(!why.hidden && why.byCls('st-rs-chip').length === 9, '"דווח על טעות" — תשע סיבות');
  sh2.byK('why:ts').click();
  ok(same(vf[0].slice(0, 2), ['n1', 'ts']), 'הסיבה נרשמת: {id הפריט, why}');
  pg.closeSheet();
  // נגן מכאן — הנגן נבנה רק עכשיו
  ok(mk === 0 && el.byCls('st-vi-mini')[0].hidden, 'בלי נגן לפני "נגן מכאן"');
  el.byK('ev:n2').click();
  doc.body.byCls('st-vi-sh')[0].byK('sh-play').click();
  ok(mk === 1 && !el.byCls('st-vi-mini')[0].hidden && seeks[0] === 610 && ux.some(([k]) => k === 'pl'), '"נגן מכאן" — הנגן נבנה ומנגן מהראיה (610)');
  ok(!doc.body.byCls('st-vi-sh').length, 'החלונית נסגרת כשמנגנים');
  // תמליל מלא — נגיעה בשורה מנגנת ממנה
  const tx = el.byCls('st-vi-tx')[0];
  tx.open = true;
  ok(tx.byCls('st-vi-txr').length === 3, 'התמליל המלא — שורה לכל יחידת דיבור');
  tx.byCls('st-vi-txr')[0].click();
  ok(seeks[seeks.length - 1] === 12.5 && mk === 1, 'שורה בתמליל → ניגון משם (אותו נגן)');
  pg.destroy();
  ok(places.length > 0 && places[places.length - 1].op.includes('c2') && ux.some(([k]) => k === 'rd') && ux.some(([k, x]) => k === 'cov' && x > 0), 'יציאה: המקום נשמר (פרק פתוח), זמן קריאה וכיסוי');

  /* טיוטה, "המשך מ־", קישור עמוק */
  const vd = P.normVi(Object.assign({}, good, { quality: { warn: ['vi_unver'] } }));
  const pd = P.renderVi(ctx(vd, { place: { y: 10, op: [], t: 300, at: now - 3 * 3600e3 } }));
  ok(pd.el.byCls('st-vi-draft').length === 1, 'vi_unver — פס טיוטה');
  const rb = pd.el.byK('vi-resume');
  ok(rb && rb.textContent.includes('300'), 'אחרי פער — "המשך מ־"');
  seeks.length = 0; rb.click();
  ok(seeks[0] === 300, '"המשך מ־" מנגן מהמקום');
  pd.destroy();

  /* PR 1.2ג — "אמת שוב": הכפתור מ־studio.js (ctx.draftAct) בפס הטיוטה בלבד; עבודת־הבת לא ברשימה; כשהיא מסתיימת — הקובץ החדש נטען */
  const act = h('span', 'st-vi-vv');
  const pa = P.renderVi(ctx(vd, { draftAct: act }));
  ok(pa.el.byCls('st-vi-draft')[0].children.includes(act), 'vi_unver — "אמת שוב" בתוך פס הטיוטה');
  pa.destroy();
  const pna = P.renderVi(ctx(P.normVi(good), { draftAct: h('span', 'st-vi-vv') }));
  ok(!pna.el.byCls('st-vi-vv').length, 'ניתוח מאומת — בלי "אמת שוב"');
  pna.destroy();
  ok(/draftAct: vvBtn\(rec, me\)/.test(sj) && /net\.api\('viVerify', \{ job: rec\.id \}\)/.test(sj) && /T\('studioViVvBusy'\)/.test(sj) && /T\('studioViVv'\)/.test(sj),
    'studio.js: הכפתור קורא ל־op:viVerify, ובזמן שהאימות רץ — "מאמתים…"');
  ok(/if \(sj\.spec && sj\.spec\.vo === 1\) \{[^\n]*vv\.set\(sj\.rp[^\n]*continue; \}/.test(sj) && /vvJobs = vv;\s*\n\s*vaSync\(\);/.test(sj),
    'studio.js: עבודת "אמת שוב" לא ברשימה — רק מצבה לפי ההורה, ו־vaSync אחרי כל סנכרון');
  ok(/o && va\.fid && o\.id !== va\.fid[\s\S]{0,200}viLoad\(rec\)/.test(sj), 'studio.js: vi.json חדש בתוצרים של ההורה — הדף טוען אותו מחדש');
  ok(/case 'vv_limit': return T\('studioErrVvLimit'\)/.test(sj) && /case 'vv_busy': return T\('studioErrVvBusy'\)/.test(sj), 'studio.js: הודעות השגיאה של "אמת שוב"');
  ok(['studioViVv', 'studioViVvBusy', 'studioErrVvLimit', 'studioErrVvBusy'].every((k) => (app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2), 'מחרוזות "אמת שוב" — בעברית ובאנגלית');
  ok(/\.st-vi-vv \{[^}]*margin-inline-start: auto/.test(css), 'CSS: הכפתור בקצה הפס (יישור לוגי)');
  seeks.length = 0;
  const pk = P.renderVi(ctx(v, { t0: 754 }));
  await new Promise((r) => setTimeout(r, 0));
  ok(seeks[0] === 754, 'קישור עמוק ‎&t= — הנגן נפתח מהזמן');
  pk.destroy();

  /* ---------- 5. החיבורים ב־studio.js ---------- */
  ok(/if \(viPageOk\(rec\)\) \{ pageVi\(p, rec\); return; \}/.test(sj), 'עבודת ניתוח שהסתיימה → דף הניתוח');
  ok(/const viPageOk = \(rec\) => !!\(rec && rec\.spec && rec\.spec\.vi && !rec\.spec\.dry && rec\.srv && rec\.srv\.state === 'done' && outOf\(rec, 'vi'\)\)/.test(sj), 'הרצה יבשה — נשארת בדף העבודה');
  ok(/if \(ui\.view === 'job' && va && va\.id === ui\.param\) return 'vi\|'/.test(sj) && /if \(ui\.view === 'job'\) vaClose\(\)/.test(sj), 'הדף לא נבנה מחדש בכל עדכון, ונסגר ביציאה');
  ok(/if \(va && va\.view && va\.view\.closeSheet\(\)\) \{ if \(root\) watch\(\); return; \}[\s\S]{0,200}if \(rsClose\(\)\)/.test(sj), '"חזור" סוגר קודם את חלונית הראיה');
  ok(/const p = net\.driveJson\(fid\)\.then\(normVi\);/.test(sj) && /await viFetch\(outOf\(rec, 'vi'\)\.id\)/.test(sj), 'vi.json עובר normVi (viFetch)');
  ok(/b\.length !== s\.img\.l/.test(sj) && /'image\/webp'/.test(sj), 'תמונת שקף: בדיוק האורך מהטווח, והסוג לפי החתימה');
  ok(/createPlayer\(\{ src: src \|\| fb[^\n]*subLang: me\.v\.lang\.src/.test(sj), 'המיני־נגן = createPlayer של התרגום (ה4), הכתוביות כבויות כשהקול באותה שפה');
  ok(/onVf: \(id, why, sec\) => vfAdd\(rec, id, why, sec\)/.test(sj) && /m\.vf = \(m\.vf \|\| \[\]\)\.concat\(\{ id, why, at:/.test(sj), '"דווח על טעות" → ux.vf');
  ok(/k === 'lv' \? Math\.round\(v\)/.test(sj), 'lv — האחרון, לא סכום (כמו UX_LAST בשרתון)');
  ok(/vip: normPlaces\(src\.vip\)/.test(sj), 'המקום נשמר ב־store (pwa_studio_v1 — ב־ACCOUNT_KEYS)');
  ok(!/firestore|collection\(|getDoc/i.test(src), 'אין קריאת Firestore לפריט');
  ok(/\(\?:&t=\(\\d\{1,5\}\)\)\?/.test(sa) && /t: link && link\[3\] \? \+link\[3\] : 0/.test(sa) && /t: jl\[3\] \? \+jl\[3\] : 0/.test(sa), 'studio-app.js: ‎&t= בקישור (גם כשהסטודיו פתוח)');
  ok(/viLinkT = \{ id: jobLink, t: Math\.min\(86400/.test(sj), 'openStudio מעביר את ‎&t= לדף');

  /* ---------- 6. קבצים, מחרוזות ועיצוב ---------- */
  ok(/const STUDIO_SHELL = \[[^\]]*'\.\/studiovi\.js'/.test(sw), 'sw.js: studiovi.js בקבצי הסטודיו (אופליין)');
  ok(/studio: \[[^\]]*'studiovi\.js'/.test(read('tools/coregen.js')), 'coregen: המחרוזות של studiovi.js');
  const keys = [...new Set([...src.matchAll(/(?<![A-Za-z0-9_$])T\(\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]))];
  const dyn = [...src.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(?<![A-Za-z0-9_$])T\(\s*([^'\s)][^,)]*)/g)];
  ok(keys.length > 40 && dyn.length === 0, 'כל המפתחות מילוליים (' + keys.length + ')');
  const miss = keys.filter((k) => (app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length !== 2);
  ok(miss.length === 0, 'כל מפתח בעברית ובאנגלית' + (miss.length ? ': ' + miss : ''));
  ok(/\.st-rs \{ position: fixed;[^}]*z-index: 1100/.test(css) && /sh = h\('div', 'st-rs st-vi-sh'\)/.test(src), 'החלונית — .st-rs מעל החוגה (z-index 1100)');
  ok(/\.st-root :is\([^)]*\.st-vi-card\) \{ box-shadow: var\(--gl-card-sh\); \}/.test(css) && /\.st-vi-mini \{[^}]*background: var\(--gl-bar\);[^}]*backdrop-filter: var\(--gl-fx\)/.test(css), 'זכוכית: הכרטיס (--gl-card-sh) והמיני־נגן (--gl-bar, --gl-fx)');
  ok(["'st-large clamp'", "'st-banner warn st-vi-draft'", "'st-sec-t st-sec-row'", "'st-linkb'", "'st-list st-vi-ch'", "'st-list st-vi-tx'", "'st-list st-vi-left'", "'st-rs-box st-vi-shin'"].every((c) => src.includes(c)), 'רכיבי הסטודיו: כותרת, פס, כותרות סעיפים, קישורים, רשימות, גיליון');
  ok(/\[data-theme="dark"\] \.st-vi-trust b/.test(css), 'כהה: תווית האיכות');
  const viCss = css.slice(css.indexOf('ניתוח סרטונים, דף הניתוח'));
  ok(!/(?:^|[;{\s])(?:left|right)\s*:|text-align:\s*(?:left|right)|margin-(?:left|right)|padding-(?:left|right)/.test(viCss), 'יישור לוגי בלבד');
  ok(!/border-radius:\s*\d+px[^;]*;/.test(viCss.replace(/border-radius: 2px;|border-radius: 4px;/g, '')), 'עיגולי פינות — משתנים');
  ok(/\.st-vi-ev \{[^}]*min-height: 26px; min-width: 24px/.test(css), 'שבב — יעד מגע של 24×24 לפחות');
  ok((src.match(/ctx\.ico\('chev', 'st-chev'\)/g) || []).length === 2 && (src.match(/chv\.classList\.toggle\('open', d\.open\)/g) || []).length === 2 && !/st-vi-chv/.test(css), 'חץ הפרק — .st-chev של הסטודיו (סגור הצידה, פתוח למטה)');

  // תמונת שקף — קטע בתים דרך studionet.js בלבד (הממשק לא פונה לרשת בעצמו)
  const N = await import(path.join(root, 'studionet.js'));
  const seen = [];
  const net = N.createNet({ sw: { controller: {}, addEventListener: () => {} },
    fetch: async (u, o) => { seen.push([u, o && o.headers && o.headers.Range]); return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; } });
  const bb = await net.mediaBytes('abcdefghij12', 'bytes=10-12');
  ok(bb && bb.length === 3 && seen.length === 1 && /studio-media\/abcdefghij12$/.test(seen[0][0]) && seen[0][1] === 'bytes=10-12', 'mediaBytes — טווח דרך ה־SW');
  ok(await net.mediaBytes('abcdefghij12', 'bytes=5-1') === null && await net.mediaBytes('abcdefghij12', 'bytes=0-99999999') === null
    && await net.mediaBytes('abcdefghij12', 'bytes=0-') === null && await net.mediaBytes('../x', 'bytes=0-1') === null && seen.length === 1, 'mediaBytes — טווח הפוך, ענק, פתוח או מזהה לא תקין: בלי בקשה');
  ok(await N.createNet({ sw: null }).mediaBytes('abcdefghij12', 'bytes=0-1') === null, 'mediaBytes — בלי SW שולט: null');
  ok(/net\.mediaBytes\(vo\.id, imgRange\(s\)\)/.test(sj) && !/(?<![A-Za-z0-9_$.])fetch\(/.test(sj), 'studio.js — רק net.mediaBytes, בלי fetch');

  // כתוביות בשפת המקור (10/11/2026): כיוון לכל שורה, גם בשפות משולבות
  const PL = await import(path.join(root, 'studioplay.js'));
  ok(PL.langDir('he') === 'rtl' && PL.langDir('ar') === 'rtl' && PL.langDir('fa-IR') === 'rtl' && PL.langDir('en') === 'ltr' && PL.langDir('ru') === 'ltr' && PL.langDir('') === '', 'langDir — עברית/ערבית/פרסית מימין, השאר משמאל');
  ok(PL.lineDir('שלום לכולם', 'ltr') === 'rtl' && PL.lineDir('Hello everyone', 'rtl') === 'ltr' && PL.lineDir('مرحبا بكم') === 'rtl' && PL.lineDir('Привет всем') === 'ltr', 'lineDir — שורה בשפה אחת: הכיוון שלה, בלי קשר לשפת הסרטון');
  ok(PL.lineDir('אז ה-transformer לוקח את ה-embedding', 'rtl') === 'rtl' && PL.lineDir('So we say שלום to everyone', 'ltr') === 'ltr' && PL.lineDir('Machine learning זה תחום', 'rtl') === 'rtl' && PL.lineDir('הסבר על machine learning model', 'rtl') === 'rtl', 'lineDir — שורה משולבת: הכיוון של שפת הסרטון');
  ok(PL.lineDir('ואז ממשיכים בעברית עם API חדש', 'ltr') === 'rtl' && PL.lineDir('So we say שלום to everyone', 'rtl') === 'ltr' && PL.lineDir('the word שלום means peace', 'ltr') === 'ltr', 'lineDir — רוב של יותר מפי 2 גובר על שפת הסרטון');
  ok(PL.lineDir('אני אוהב את הספר הזה מאוד, really') === 'rtl' && PL.lineDir('I really love this book so much, תודה') === 'ltr' && PL.lineDir('Hi שלום') === 'ltr' && PL.lineDir('12:30 — 45%') === 'auto', 'lineDir — בלי שפת סרטון: הרוב; תיקו — המילה הראשונה; בלי אותיות — auto');
  const ps = read('studioplay.js');
  ok(/orig: true,/.test(sj) && /subLang: me\.v\.lang\.src, orig: true/.test(sj), 'נגן הניתוח — orig: הכתוביות = התמליל בשפת המקור');
  ok(/const orig = !!opts\.orig && !opts\.burned/.test(ps) && /let cc = orig \? ccAuto\(\)/.test(ps) && /orig \? \(cues\.length \? 'he' : 'off'\)/.test(ps), 'orig — דולקות מההתחלה כשיש תמליל (לא כבויות "כי הקול באותה שפה")');
  ok(/else if \(orig\) \{ cc = cc === 'off' \? 'he' : 'off'; ccTouched = true; \} else \{ cc = nextCc/.test(ps) && /for \(const m of \['he', 'off'\]\) box\.append\(mRow\('', ccName\(m\), null, \(\) => \{ ccTouched = true; setCc\(m\); closeMenu\(\); \}/.test(ps), 'orig — דולק/כבוי בלבד, בלי לשמור להעדפה של נגן התרגום');
  ok(/if \(orig\) d\.dir = lineDir\(x, oBase\)/.test(ps) && /if \(!orig\) \{ cc = 'off'; paintCc\(\); paintSub\(\); ccB\.disabled = true; \}/.test(ps), 'orig — כל שורה בכיוון שלה, והתמליל נשאר גם בקובץ החלופי');
  ok(/orig \? T\('studioPlCcSrcL'\)/.test(ps) && /orig \? srcTag\(\)/.test(ps), 'orig — התפריט "שפת המקור (התמליל)", והתווית = שפת הסרטון');
  ok(/x\.dir = s \? lineDir\(s, dir\) : dir/.test(src) && /sp\.dir = lineDir\(e\.text, dir\)/.test(src) && /bq\.dir = lineDir\(a\.e\.text, dir\)/.test(src) && /dir = langDir\(v\.lang\.src\) \|\| 'ltr'/.test(src), 'הדף — ציטוטים ושורות התמליל בכיוון שלהם (שפות משולבות)');

  // 2.141.2 (הקלטת המשתמש מהדפדפן: מלבן שחור "טוען את הסרטון והכתוביות…" בכל כניסה ל"אחרונה"): הניתוח נשאר בזיכרון
  {
    const vm = require('vm');
    const a = sj.indexOf('const vaKeep = new Map();'), b = sj.indexOf('function pageVi(');
    ok(a > 0 && b > a, 'vaKeep / viFetch / viWarm / vaClose לפני pageVi');
    const freed = [], calls = [];
    const ctx = { URL: { revokeObjectURL: (u) => freed.push(u) }, document: { hidden: false }, Map, Set, Promise,
      net: { driveJson: (id) => { calls.push(id); return Promise.resolve({ id }); } }, normVi: (j) => ({ n: j.id }),
      outOf: (r, k) => r.out[k], viPageOk: (r) => !!r.ok, stDialJob: () => ctx.__j, __j: null };
    vm.runInNewContext('let va = null;' + sj.slice(a, b) + ';this.t = { vaKeep, vaPut, vaClose, viFetch, viWarm, setVa: (x) => { va = x; } };', ctx);
    const t = ctx.t, urls = (...x) => new Map(x.map((u, i) => [i, u]));
    t.setVa({ id: 'j1', fid: 'f1', st: 'ok', v: { n: 1 }, cues: [1], urls: urls('u1'), view: { destroy() {} } });
    t.vaClose();
    ok(t.vaKeep.get('j1') && t.vaKeep.get('j1').v.n === 1 && t.vaKeep.get('j1').cues[0] === 1 && !freed.length, 'יציאה מהדף — הניתוח, התמליל והשקפים נשמרים (לא משוחררים)');
    t.setVa({ id: 'j2', fid: 'f2', st: 'load', v: null, urls: urls('u2'), view: null });
    t.vaClose();
    ok(!t.vaKeep.has('j2') && freed.join() === 'u2', 'דף שלא נטען — משוחרר כמו קודם');
    for (const k of ['j3', 'j4', 'j5']) t.vaPut(k, { fid: k, v: {}, cues: null, urls: urls('u-' + k) });
    ok(t.vaKeep.size === 3 && !t.vaKeep.has('j1') && freed.includes('u1'), 'עד שלושה בזיכרון — הישן יוצא והשקפים שלו משוחררים');
    const p1 = t.viFetch('f9'), p2 = t.viFetch('f9');
    ok(p1 === p2 && calls.length === 1, 'בקשה אחת לקובץ — החימום והדף חולקים אותה');
    ctx.__j = { rec: { id: 'j8', ok: true, out: { vi: { id: 'f8' } } } };
    t.viWarm(); t.viWarm();
    await new Promise((r) => setTimeout(r, 0));
    ok(calls.filter((c) => c === 'f8').length === 1 && t.vaKeep.get('j8') && t.vaKeep.get('j8').v.n === 'f8', '"אחרונה" היא ניתוח — נטען ברקע פעם אחת ונשמר');
    ok(/if \(k && k\.fid === fid\) \{ vaKeep\.delete\(rec\.id\); Object\.assign\(va, \{ st: 'ok', v: k\.v, cues: k\.cues, urls: k\.urls \}\); \}/.test(sj)
      && /const v = await viFetch\(outOf\(rec, 'vi'\)\.id\);/.test(sj) && /^\s*viWarm\(\);/m.test(sj.slice(sj.indexOf('function render('), sj.indexOf('function render(') + 400)), 'pageVi מצייר מהזיכרון כשהקובץ זהה; render מחמם');
    ok(/if \(va\.st === 'load'\) \{ p\.append\(h\('div', 'st-empty st-empty-sm', T\('studioPlLoading'\)\)\)/.test(sj), 'טעינה ראשונה — שורה בהירה, לא מלבן נגן שחור');
  }

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
