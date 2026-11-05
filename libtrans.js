/* Academy Pro F6 (03/11/2026): תרגום ספר שלם — בחינם, דרך מכסת ה־AI הקיימת (op:'bookAi' task:'bilingual', Gemini בשכבה החינמית).
   הספר המקורי לא משתנה: נבנה ספר חדש (מזהה משלו) — "תרגום בלבד" או "דו־לשוני" (המקור ומתחתיו התרגום).
   כל מנה נשמרת במטמון של השרתון — כשהמכסה נגמרת באמצע, הרצה חוזרת (מחר) מקבלת את מה שכבר תורגם בלי לספור מכסה.
   נטען רק כשנכנסים. */

const BLOCK = 'p,h1,h2,h3,h4,h5,h6,li,blockquote,figcaption,dt,dd,td,th,caption';
const MAXP = 1400, MAXN = 40, MAXC = 8800;
const XML_NS = 'http://www.w3.org/XML/1998/namespace', XHTML = 'http://www.w3.org/1999/xhtml';
const INSIDE = /^(li|td|th|dt|dd|caption|figcaption)$/;
const RTL = new Set(['he', 'ar']);
const LANGS = ['he', 'en', 'ar', 'ru', 'fr', 'es', 'de'];

/* ---------- טהורות ---------- */
export function splitLong(t, max = MAXP) {   // פסקה ארוכה → חלקים בסוף משפט (השרתון חותך פסקה ב־1500 תווים)
  const s = String(t || '').replace(/\s+/g, ' ').trim();
  if (s.length <= max) return s ? [s] : [];
  const out = []; let cur = '';
  for (const part of s.split(/(?<=[.!?…:;])\s+/)) {
    if (part.length > max) { if (cur) { out.push(cur); cur = ''; } for (let i = 0; i < part.length; i += max) out.push(part.slice(i, i + max)); continue; }
    if (cur && cur.length + 1 + part.length > max) { out.push(cur); cur = part; } else cur = cur ? cur + ' ' + part : part;
  }
  if (cur) out.push(cur);
  return out;
}
export function planBatches(lens, maxN = MAXN, maxC = MAXC) {   // אורכי החלקים → [התחלה, סוף) לכל בקשה
  const out = []; let a = 0, n = 0, c = 0;
  lens.forEach((L, i) => {
    if (n && (n >= maxN || c + L > maxC)) { out.push([a, i]); a = i; n = 0; c = 0; }
    n++; c += L;
  });
  if (n) out.push([a, lens.length]);
  return out;
}
export function estimate(chars, parts = 0) { return Math.max(1, Math.ceil(chars / (MAXC * 0.92)), Math.ceil(parts / MAXN)); }   // בערך כמה בקשות (מנות לא מתמלאות עד הסוף; עד 40 פסקאות במנה)
export function langOpts(to, from) { return [...new Set([to, 'he', 'en', 'ar', 'ru'])].filter((l) => LANGS.includes(l) && l !== from).slice(0, 3); }   // השפות שהשרתון מכיר (LANGS ב־bookai)
export function trTitle(title, langName) { return String(title || '').trim() + ' · ' + langName; }
export function trId(id, to, mode) { return String(id || 'book') + '-tr-' + to + (mode === 'both' ? '-bi' : ''); }

/* עלה: בלוק בלי בלוק בתוכו, עם טקסט, בלי תמונה; היעד — הצאצא העמוק שמחזיק את כל הטקסט (li > a נשאר קישור) */
export function leafBlocks(doc) {
  const out = [];
  for (const el of doc.querySelectorAll(BLOCK)) {
    if (el.querySelector(BLOCK) || el.querySelector('img,svg,image,math,video,audio')) continue;
    const t = el.textContent.replace(/\s+/g, ' ').trim();
    if (t.length < 2 || !/\p{L}/u.test(t)) continue;
    let tg = el;
    for (;;) {
      const kids = [...tg.childNodes].filter((n) => n.nodeType === 1 || (n.nodeType === 3 && n.nodeValue.trim()));
      if (kids.length === 1 && kids[0].nodeType === 1) tg = kids[0]; else break;
    }
    out.push({ el, tg, t });
  }
  return out;
}

export function createTrans(E) {
  const { h, T } = E;
  const flash = (m) => E.flash(m);
  const btn = (cls, txt, fn) => { const b = h('button', cls, txt); b.type = 'button'; if (fn) b.addEventListener('click', fn); return b; };

  async function readDocs(file) {
    const EK = await E.kit();
    const rep = await EK.inspectEpub(file);
    if (!rep.ok) throw new Error('bad');
    const OPF = 'http://www.idpf.org/2007/opf';
    const items = [...rep.opf.getElementsByTagNameNS(OPF, 'item')], byId = new Map(items.map((el) => [el.getAttribute('id'), el]));
    const docs = [];
    for (const r of [...rep.opf.getElementsByTagNameNS(OPF, 'itemref')]) {
      const el = byId.get(r.getAttribute('idref')); if (!el || !/html/.test(el.getAttribute('media-type') || '')) continue;
      if (/\bnav\b/.test(el.getAttribute('properties') || '')) continue;
      const p = EK.resolvePath(rep.opfPath, el.getAttribute('href') || ''), e = p && rep.zip.byName.get(p); if (!e) continue;
      let src; try { src = await EK.readText(file, e, 16 << 20); } catch (er) { continue; }
      const doc = new DOMParser().parseFromString(src, 'application/xhtml+xml');
      if (doc.getElementsByTagName('parsererror').length) continue;   // מסמך שלא נקרא נקי — נשאר כמו שהוא
      const blocks = leafBlocks(doc);
      if (blocks.length) docs.push({ p, doc, blocks });
    }
    return { EK, rep, docs };
  }

  async function translate(b, to, mode, ui) {
    const f = await E.getFile(b.id); if (!f) throw new Error('nofile');
    const { EK, rep, docs } = await readDocs(f);
    const parts = [];   // { d, k, s } — החלק s של הבלוק k במסמך d
    docs.forEach((d, di) => d.blocks.forEach((bl, k) => splitLong(bl.t).forEach((s) => parts.push({ di, k, s }))));
    if (!parts.length) throw new Error('empty');
    const plan = planBatches(parts.map((x) => x.s.length));
    const res = new Array(parts.length).fill(null);
    let done = 0, stop = null;
    ui.prog(0, plan.length);
    const q = plan.map((r, i) => ({ r, i }));
    const worker = async () => {
      while (q.length && !stop && !ui.cancelled()) {
        const { r } = q.shift();
        const paras = parts.slice(r[0], r[1]).map((x) => x.s);
        try {
          const j = await E.ai('bilingual', { paras, lang: to, title: b.title || '' });
          (j.out || []).forEach((t, k) => { res[r[0] + k] = t || null; });
        } catch (e) { const m = e && e.message; if (m === 'quota' || m === 'limit' || m === 'signin' || m === 'rate_limited') stop = m; }
        done++; ui.prog(done, plan.length);
      }
    };
    await Promise.all([worker(), worker()]);
    if (ui.cancelled()) return null;
    /* הרכבה: לכל בלוק — כל החלקים שלו תורגמו? */
    const byBlock = new Map();
    parts.forEach((x, i) => { const key = x.di + ':' + x.k; const o = byBlock.get(key) || { ok: true, t: [] }; if (res[i] == null) o.ok = false; else o.t.push(res[i]); byBlock.set(key, o); });
    let tb = 0, all = 0;
    const put = new Map(), enc = new TextEncoder();
    docs.forEach((d, di) => {
      d.blocks.forEach((bl, k) => {
        all++;
        const o = byBlock.get(di + ':' + k); if (!o || !o.ok || !o.t.length) return;
        tb++;
        const tr = o.t.join(' ');
        if (mode === 'both') {
          const inside = INSIDE.test(bl.el.localName);   // תא/פריט/כיתוב — התרגום בתוכו (אחרת עמודה או פריט נוסף)
          const c = inside ? d.doc.createElementNS(XHTML, 'span') : bl.el.cloneNode(false);
          c.textContent = tr;
          c.setAttribute('class', inside ? 'snb-tr snb-tr-in' : ((bl.el.getAttribute('class') || '') + ' snb-tr').trim());
          c.removeAttribute('id'); c.setAttribute('lang', to); c.setAttributeNS(XML_NS, 'xml:lang', to); c.setAttribute('dir', RTL.has(to) ? 'rtl' : 'ltr');
          if (inside) bl.el.append(c); else bl.el.after(c);
        } else bl.tg.textContent = tr;
      });
      const html = d.doc.documentElement;
      if (mode !== 'both') { html.setAttribute('lang', to); html.setAttributeNS(XML_NS, 'xml:lang', to); html.setAttribute('dir', RTL.has(to) ? 'rtl' : 'ltr'); }
      const head = d.doc.getElementsByTagName('head')[0];
      if (mode === 'both' && head && !d.doc.getElementById('snb-tr-css')) {
        const st = d.doc.createElementNS(XHTML, 'style'); st.setAttribute('id', 'snb-tr-css');
        st.textContent = '.snb-tr { opacity: .78; font-style: italic; } .snb-tr-in { display: block; }'; head.append(st);
      }
      const x = new XMLSerializer().serializeToString(d.doc);
      put.set(d.p, enc.encode(/^<\?xml/.test(x) ? x : '<?xml version="1.0" encoding="utf-8"?>\n' + x));
    });
    if (!tb) throw new Error(stop || 'failed');
    /* OPF: שם חדש, שפה, מזהה חדש (כדי שלא יידרס הספר המקורי), כיוון */
    const opf = rep.opf, name = E.langName(to);
    EK.writeOpfMeta(opf, mode === 'both' ? { title: trTitle(b.title, name) } : { title: trTitle(b.title, name), lang: to });
    const uidId = opf.documentElement.getAttribute('unique-identifier');
    const uidEl = uidId && opf.getElementById ? opf.getElementById(uidId) : null;
    const newId = trId(b.id, to, mode);
    if (uidEl) uidEl.textContent = 'urn:snb:' + newId;
    const spine = opf.getElementsByTagNameNS('http://www.idpf.org/2007/opf', 'spine')[0];
    if (spine && mode !== 'both') spine.setAttribute('page-progression-direction', RTL.has(to) ? 'rtl' : 'ltr');
    const ox = new XMLSerializer().serializeToString(opf);
    put.set(rep.opfPath, enc.encode(/^<\?xml/.test(ox) ? ox : '<?xml version="1.0" encoding="UTF-8"?>\n' + ox));
    const blob = await EK.rewriteZip(f, rep.zip, { put });
    const file = new File([blob], EK.safeFileName(trTitle(b.title, name), 'epub'), { type: 'application/epub+zip' });
    const n = await E.importFiles([file], { id: newId });
    return { n, pct: Math.round(100 * tb / all), stop };
  }

  function openTranslate(b) {
    const ui0 = E.uiLang(), bl = String(b.lang || '').slice(0, 2);
    let to = bl === ui0 ? (ui0 === 'he' ? 'en' : 'he') : ui0, mode = 'replace';
    E.sheet(T('tbBook'), (sh, close) => {
      const box = h('div', 'pl'); sh.append(box);
      box.append(h('p', 'cv-note', T('tbBookS')));
      const seg = (opts, cur, onPick) => {
        const w = h('div', 'cv-seg'); w.setAttribute('role', 'radiogroup');
        const paint = () => [...w.children].forEach((x) => x.setAttribute('aria-checked', String(x.dataset.v === cur)));
        for (const [v, l] of opts) { const x = btn('cv-segb', l, () => { cur = v; paint(); onPick(v); }); x.dataset.v = v; x.setAttribute('role', 'radio'); w.append(x); }
        paint(); return w;
      };
      const langs = langOpts(to, bl).map((l) => [l, E.langName(l)]);
      box.append(h('div', 'pl-gh', T('tbTo')), seg(langs, to, (v) => { to = v; }));
      box.append(h('div', 'pl-gh', T('tbMode')), seg([['replace', T('tbOnly')], ['both', T('tbBoth')]], mode, (v) => { mode = v; }));
      const est = h('p', 'cv-note'); box.append(est);
      const prog = h('div', 'cv-prog'); prog.hidden = true;
      const bar = h('div', 'lib-bar'); const fill = h('i'); fill.style.width = '0%'; bar.append(fill);
      const pl = h('div', 'cv-pl'), pt = h('span', 'cv-pt'); pl.append(pt); prog.append(bar, pl);
      const go = btn('bk-cta', T('tbGo'));
      box.append(h('p', 'cv-note', T('aiPriv')));
      const foot = h('div', 'pl-foot'); foot.append(prog, go); box.append(foot);
      E.getFile(b.id).then(async (f) => {   // הערכה: כמה בקשות מתוך המכסה היומית
        if (!f || !est.isConnected) return;
        try { const { docs } = await readDocs(f); let ch = 0, np = 0; docs.forEach((d) => d.blocks.forEach((y) => { const sp = splitLong(y.t); np += sp.length; ch += y.t.length; })); if (est.isConnected) est.textContent = T('tbEst', { n: estimate(ch, np), m: 150 }); } catch (e) {}
      });
      const lock = { v: null };
      go.addEventListener('click', async () => {
        go.disabled = true; prog.hidden = false;
        try { lock.v = navigator.wakeLock ? await navigator.wakeLock.request('screen') : null; } catch (e) {}
        try {
          const r = await translate(b, to, mode, {
            prog: (i, n) => { fill.style.width = Math.round(100 * i / Math.max(1, n)) + '%'; pt.textContent = T('tbProg', { i, n }); },
            cancelled: () => !sh.isConnected,
          });
          if (!r) return;
          if (r.n) E.afterImport(r.n);
          if (r.pct >= 100) { close(); flash(T('tbDone')); }
          else { pt.textContent = r.stop === 'signin' ? T('aiSignin') : T('tbPartial', { p: r.pct }); go.disabled = false; go.textContent = T('tbAgain'); }
        } catch (e) {
          const m = e && e.message;
          pt.textContent = m === 'signin' ? T('aiSignin') : m === 'quota' || m === 'limit' ? T('tbQuota') : m === 'empty' ? T('tbEmpty') : T('tbFail');
          go.disabled = false;
        } finally { try { if (lock.v) lock.v.release(); } catch (e) {} }
      });
    });
  }

  return { openTranslate, translate };
}
