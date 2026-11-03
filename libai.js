/* Academy Pro גל 5 (03/11/2026): הקראה (E1), X-Ray (F1), שאל את הספר (F3), תיוג ותקציר (F5), דו־לשוני (F7), טיקרים ל־Invest (G5).
   נטען רק כשנכנסים לכלים. ההקראה — במכשיר בלבד (קול המערכת). השאר — דרך השרתון (op:'bookAi', רק משתמש מחובר),
   שמחזיק מטמון לפי תוכן הבקשה (lib/aicache.js) ולא שומר את טקסט הספר. */

const BLOCK_SEL = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th,dd,dt,figcaption,pre';
const fold = (s) => String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/[״"׳']/g, '');
const STOP = new Set('מה מי איך למה מדוע מתי איפה היכן האם של את על עם זה זו היה היתה הוא היא הם הן אני אנחנו כל גם אבל או לא כן יש אין אל עד מן כי אם the a an is are was were of to in on at what who whom why how when where which did does do and or not with for from by about this that it he she they'.split(' '));

/* ---------- טהורות (נבדקות) ---------- */
export function qTerms(q) {        // מילות השאלה, בלי מילות קישור; בעברית — גם בלי אות שימוש בראש המילה (ו/ה/ב/ל/מ/ש/כ)
  const out = new Set();
  for (const w of fold(q).split(/[^\p{L}\p{N}]+/u)) {
    if (w.length < 2 || STOP.has(w)) continue;
    out.add(w);
    if (/^[והבלמשכ]/.test(w) && w.length >= 4 && !STOP.has(w.slice(1))) out.add(w.slice(1));
  }
  return [...out];
}
export function rankPassages(paras, terms, n) {   // paras: [{sec, j, t}] — הקטעים עם הכי הרבה מילים נדירות מהשאלה, בסדר הספר
  if (!terms.length) return [];
  const F = paras.map((p) => fold(p.t));
  const df = terms.map((t) => F.reduce((a, f) => a + (f.includes(t) ? 1 : 0), 0));
  const N = paras.length || 1;
  const sc = F.map((f, i) => ({ i, s: terms.reduce((a, t, k) => a + (df[k] && f.includes(t) ? Math.log(1 + N / df[k]) : 0), 0) }));
  const top = sc.filter((x) => x.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, n || 12);
  return top.map((x) => {
    const p = paras[x.i]; let t = p.t;
    const nx = paras[x.i + 1];
    if (t.length < 300 && nx && nx.sec === p.sec) t = t + ' ' + nx.t;   // קטע קצר — עם ההמשך שלו, להקשר
    return { sec: p.sec, j: p.j, t: t.slice(0, 1200), at: p.t };
  }).sort((a, b) => a.sec - b.sec || a.j - b.j);
}
export function clipText(text, max) {    // ארוך מדי — ההתחלה (מי הדמויות) והסוף (מה קרה עכשיו)
  const s = String(text || '');
  if (s.length <= max) return s;
  const head = Math.floor(max * 0.35);
  return s.slice(0, head) + '\n…\n' + s.slice(s.length - (max - head - 3));
}
export function sentences(text, max) {   // הקראה: משפטים קצרים — מנוע הדיבור נקטע על קטעים ארוכים
  const s = String(text || '').replace(/\s+/g, ' ').trim(); if (!s) return [];
  const parts = s.match(/[^.!?…:;]+[.!?…:;]*["”’׳״)]*\s*/g) || [s];
  const out = [];
  for (let p of parts) {
    p = p.trim(); if (!p) continue;
    while (p.length > max) { let k = p.lastIndexOf(' ', max); if (k < max / 2) k = max; out.push(p.slice(0, k).trim()); p = p.slice(k).trim(); }
    if (p) out.push(p);
  }
  return out;
}
export const countIn = (text, name) => { const t = fold(text), n = fold(name); if (!n) return 0; let c = 0, i = 0; while ((i = t.indexOf(n, i)) >= 0) { c++; i += n.length; } return c; };
export function citeParts(answer, max) {  // "…כך [2][3]." → טקסט + מספרי מקורות קיימים בלבד
  const out = [];
  String(answer || '').split(/(\[\d{1,2}\])/).forEach((x) => {
    const m = /^\[(\d{1,2})\]$/.exec(x);
    if (m) { const n = +m[1]; if (n >= 1 && n <= max) out.push({ n }); }
    else if (x) out.push({ t: x });
  });
  return out;
}
export function mergeTags(old, add) {    // התגיות הקיימות + החדשות, בלי כפילות (לפי אותיות קטנות/ניקוד)
  const cur = String(old || '').split(/\s*[,;،]\s*/).map((x) => x.trim()).filter(Boolean);
  const seen = new Set(cur.map(fold));
  (add || []).forEach((t) => { t = String(t || '').trim(); if (t && !seen.has(fold(t))) { seen.add(fold(t)); cur.push(t); } });
  return cur.join(', ');
}
export function investLink(base, sym, name) {   // G5: הוספה לרשימת המעקב ב־Invest (#watch — אותו קישור כמו מהדפדפן)
  const s = String(sym || '').toUpperCase().replace(/[^A-Z0-9.\-]/g, '').slice(0, 15);
  if (!s || !base) return '';
  return base + '#watch=' + encodeURIComponent(s) + (name ? '&nm=' + encodeURIComponent(String(name).slice(0, 80)) : '');
}
export function batchParas(paras, from, maxN, maxC) {   // דו־לשוני: כמה פסקאות שנכנסות בבקשה אחת
  const out = []; let tot = 0;
  for (let i = from; i < paras.length && out.length < maxN; i++) {
    const p = paras[i].slice(0, 1500);
    if (out.length && tot + p.length > maxC) break;
    out.push(p); tot += p.length;
  }
  return out;
}
export const xrayKinds = ['person', 'place', 'org', 'term'];
export function groupXray(items) {
  const g = { person: [], place: [], org: [], term: [] };
  (items || []).forEach((x) => { const k = x.kind === 'company' ? 'org' : x.kind; if (g[k]) g[k].push(x); });
  return g;
}

const KIND_KEY = { person: 'aiKPerson', place: 'aiKPlace', org: 'aiKOrg', term: 'aiKTerm' };
const ERR_KEY = { signin: 'aiSignin', limit: 'aiLimit', rate_limited: 'aiLimit', quota: 'aiQuota', no_key: 'aiErr', bad_params: 'aiErr' };
const RATES = [0.8, 1, 1.2, 1.5, 2], SLEEPS = [0, 15, 30, 60];
const LS_TTS = 'pwa_libtts_v1';
const ICO = {
  play: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="5" width="4" height="14" rx="1"/><rect x="13.5" y="5" width="4" height="14" rx="1"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};

export function createAi(E) {
  const { h, T } = E;
  const flash = (m) => E.flash(m);
  const errMsg = (e) => T(ERR_KEY[e && e.message] || 'aiErr');
  const R = () => E.rd();
  const curSec = (r) => { const s = r && r.loc && r.loc.section; return s && s.current >= 0 ? s.current : 0; };
  const linear = (r, i) => { const s = r.book.sections && r.book.sections[i]; return !!s && s.linear !== 'no'; };
  const busy = (box, msg) => { box.textContent = ''; const p = h('p', 'ai-busy', msg || T('aiWorking')); box.append(p); };
  const note = (box, msg) => { box.textContent = ''; box.append(h('p', 'lib-empty', msg)); };
  const row = (title, sub, fn) => {
    const b = h('button', 'lib-row pl-open'); b.type = 'button';
    const l = h('span', 'pl-rl'); l.append(h('span', 'pl-rt', title), h('span', 'pl-rs', sub));
    const ch = h('span', 'pl-chev'); ch.setAttribute('aria-hidden', 'true'); ch.innerHTML = E.chev || '';
    b.append(l, ch); b.addEventListener('click', fn); return b;
  };
  const jump = (q, sec, k) => { const r = R(); if (r) E.findInView(r.view, { q, sec, k: Math.max(0, k | 0) }); };
  const memo = new Map();       // תשובות של הסשן (בנוסף למטמון בשרתון)
  const call = (task, body) => { const key = task + JSON.stringify(body).length + ':' + JSON.stringify(body).slice(-400); if (!memo.has(key)) memo.set(key, E.ai(task, body).catch((e) => { memo.delete(key); throw e; })); return memo.get(key); };

  /* ---------- תפריט הכלים בקורא ---------- */
  function openTools() {
    if (!R()) return;
    E.sheet(T('aiTools'), (sh, close) => {
      const card = h('div', 'lib-ios');
      const then = (fn) => () => E.closeSheetThen(sh.parentNode, fn);
      card.append(
        row(T('aiTts'), T('aiTtsS'), () => { close(); ttsStart(); }),
        row(T('aiXray'), T('aiXrayS'), then(openXray)),
        row(T('aiAsk'), T('aiAskS'), then(openAsk)),
        row(T('aiBi'), T('aiBiS'), then(openBilingual)));
      sh.append(card, h('p', 'pl-note ai-priv', T('aiPriv')));
    });
  }

  /* ---------- E1: הקראה — קול המערכת, פסקה אחרי פסקה מהעמוד הנוכחי, הדף עוקב ---------- */
  const S = { on: false, playing: false, doc: null, index: -1, blocks: [], i: 0, end: 0, bar: null, mark: null, seq: 0 };
  const ttsPrefs = () => { try { const o = JSON.parse(localStorage.getItem(LS_TTS) || '{}'); return { rate: RATES.includes(o.rate) ? o.rate : 1 }; } catch (e) { return { rate: 1 }; } };
  const ttsSave = (p) => { try { localStorage.setItem(LS_TTS, JSON.stringify(p)); } catch (e) {} };
  const synth = () => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
  function unmark() { const m = S.mark; if (m) { m.el.style.backgroundColor = m.bg; m.el.style.borderRadius = m.br; S.mark = null; } }
  function markEl(el) {
    unmark();
    S.mark = { el, bg: el.style.backgroundColor, br: el.style.borderRadius };
    el.style.backgroundColor = 'rgba(64,140,255,.18)'; el.style.borderRadius = '4px';
    const r = R(); if (!r) return;
    try {
      if (r.loc && r.loc.range && r.loc.range.intersectsNode && r.loc.range.intersectsNode(el)) return;
      const rg = el.ownerDocument.createRange(); rg.selectNodeContents(el);
      const cfi = r.view.getCFI(S.index, rg); if (cfi) r.view.goTo(cfi).catch(() => {});
    } catch (e) {}
  }
  function voiceFor(lang) {
    const sy = synth(); const vs = (sy && sy.getVoices()) || [];
    const l = String(lang || '').toLowerCase().slice(0, 2), alt = l === 'he' ? 'iw' : l;
    return vs.find((v) => { const x = String(v.lang || '').toLowerCase(); return x.startsWith(l) || x.startsWith(alt); }) || null;
  }
  function loadDoc() {
    const r = R(); if (!r) return false;
    let c = null; try { const cs = r.view.renderer.getContents(); c = cs && cs[0]; } catch (e) {}
    if (!c || !c.doc) return false;
    const blocks = Array.from(c.doc.querySelectorAll(BLOCK_SEL)).filter((el) => !el.querySelector(BLOCK_SEL) && el.textContent.trim());
    let start = 0;
    try { const n = r.loc && r.loc.range && r.loc.range.startContainer; const el = n && (n.nodeType === 1 ? n : n.parentElement); const b = el && el.closest && el.closest(BLOCK_SEL); const k = blocks.indexOf(b); if (k >= 0) start = k; } catch (e) {}
    Object.assign(S, { doc: c.doc, index: c.index != null ? c.index : curSec(r), blocks, i: start });
    return true;
  }
  function speakNext() {
    const sy = synth(); const r = R();
    if (!S.on || !S.playing || !sy || !r) return;
    if (S.end && Date.now() >= S.end) { ttsStop(); flash(T('aiTtsSlept')); return; }
    if (S.i >= S.blocks.length) {                    // סוף הפרק — לפרק הבא
      let j = S.index + 1; const n = (r.book.sections || []).length;
      while (j < n && !linear(r, j)) j++;
      if (j >= n) { ttsStop(); return; }
      const seq = ++S.seq;
      r.view.goTo(j).then(() => setTimeout(() => { if (S.seq === seq && S.on && S.playing && loadDoc()) speakNext(); }, 450)).catch(() => ttsStop());
      return;
    }
    const el = S.blocks[S.i]; markEl(el);
    const parts = sentences(el.textContent, 220); const lang = (S.doc.documentElement.lang || r.rec.lang || 'he');
    const v = voiceFor(lang); const rate = ttsPrefs().rate; const seq = ++S.seq;
    if (!parts.length) { S.i++; speakNext(); return; }
    parts.forEach((p, k) => {
      const u = new SpeechSynthesisUtterance(p); u.lang = v ? v.lang : lang; if (v) u.voice = v; u.rate = rate;
      if (k === parts.length - 1) u.onend = () => { if (S.seq !== seq) return; S.i++; speakNext(); };
      u.onerror = (e) => { if (S.seq === seq && e && e.error !== 'interrupted' && e.error !== 'canceled') { ttsStop(); flash(T('aiTtsNo')); } };
      sy.speak(u);
    });
  }
  function bar() {
    const r = R(); if (!r) return null;
    if (S.bar && S.bar.isConnected) return S.bar;
    const b = h('div', 'ai-tts'); b.setAttribute('role', 'toolbar'); b.setAttribute('aria-label', T('aiTts'));
    const pp = h('button', 'ai-tts-b ai-tts-pp'); pp.type = 'button';
    const rt = h('button', 'ai-tts-b ai-tts-rate'); rt.type = 'button'; rt.dir = 'ltr'; rt.setAttribute('aria-label', T('aiTtsRate'));
    const sl = h('button', 'ai-tts-b ai-tts-sl'); sl.type = 'button'; sl.setAttribute('aria-label', T('aiTtsSleep'));
    const x = h('button', 'ai-tts-b'); x.type = 'button'; x.innerHTML = ICO.x; x.setAttribute('aria-label', T('aiTtsStop'));
    pp.addEventListener('click', (e) => { e.stopPropagation(); S.playing ? ttsPause() : ttsPlay(); });
    rt.addEventListener('click', (e) => { e.stopPropagation(); const p = ttsPrefs(); p.rate = RATES[(RATES.indexOf(p.rate) + 1) % RATES.length]; ttsSave(p); paint(); if (S.playing) { restart(); } });
    sl.addEventListener('click', (e) => { e.stopPropagation(); const cur = S.end ? Math.round((S.end - Date.now()) / 60000) : 0; const idx = S.end ? SLEEPS.findIndex((m) => m >= cur && m > 0) : 0; const nx = SLEEPS[(idx + 1) % SLEEPS.length] || 0; S.end = nx ? Date.now() + nx * 60000 : 0; paint(); });
    x.addEventListener('click', (e) => { e.stopPropagation(); ttsStop(); });
    b.append(pp, rt, sl, x);
    b._pp = pp; b._rt = rt; b._sl = sl;
    r.els.box.append(b); S.bar = b;
    return b;
  }
  function paint() {
    const b = S.bar; if (!b) return;
    b._pp.innerHTML = S.playing ? ICO.pause : ICO.play; b._pp.setAttribute('aria-label', T(S.playing ? 'aiTtsPause' : 'aiTtsPlay'));
    b._rt.textContent = ttsPrefs().rate + '×';
    const m = S.end ? Math.max(1, Math.round((S.end - Date.now()) / 60000)) : 0;
    b._sl.innerHTML = ICO.moon + (m ? '<span>' + m + '</span>' : '');
    b._sl.classList.toggle('on', !!m);
  }
  function restart() { const sy = synth(); S.seq++; if (sy) sy.cancel(); setTimeout(speakNext, 60); }
  function ttsPlay() { S.playing = true; paint(); restart(); media(); }
  function ttsPause() { const sy = synth(); S.playing = false; S.seq++; if (sy) sy.cancel(); paint(); }
  function ttsStart() {
    if (!synth() || typeof SpeechSynthesisUtterance === 'undefined') { flash(T('aiTtsNo')); return; }
    if (!loadDoc()) return;
    S.on = true; bar(); ttsPlay();
  }
  function ttsStop() {
    const sy = synth(); S.seq++; S.on = false; S.playing = false; S.end = 0;
    if (sy) try { sy.cancel(); } catch (e) {}
    unmark();
    if (S.bar) { S.bar.remove(); S.bar = null; }
    try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'none'; } catch (e) {}
  }
  function media() {
    try {
      const ms = typeof navigator !== 'undefined' && navigator.mediaSession; const r = R(); if (!ms || !r) return;
      if (typeof MediaMetadata !== 'undefined') ms.metadata = new MediaMetadata({ title: r.rec.title || '', artist: r.rec.author || '' });
      ms.setActionHandler('play', () => { if (S.on) ttsPlay(); });
      ms.setActionHandler('pause', () => { if (S.on) ttsPause(); });
      ms.playbackState = 'playing';
    } catch (e) {}
  }

  /* ---------- F1: X-Ray — עד סוף הפרק הנוכחי בלבד (בלי ספוילרים) ---------- */
  async function textUpTo(r, last) {
    const parts = [];
    for (let i = 0; i <= last; i++) if (linear(r, i)) parts.push(await r.secText(i));
    return parts.join('\n');
  }
  function openXray() {
    const r = R(); if (!r) return;
    const cur = curSec(r);
    E.sheet(T('aiXray'), (sh, close) => {
      const lb = E.chapterLabel(cur);
      sh.append(h('p', 'pl-note', lb ? T('aiUpTo', { ch: lb }) : T('aiXrayS')));
      const box = h('div', 'ai-out'); sh.append(box); busy(box);
      (async () => {
        const all = await textUpTo(r, cur);
        if (all.replace(/\s/g, '').length < 200) return note(box, T('aiShort'));
        const j = await call('xray', { text: clipText(all, 118000), title: r.rec.title, author: r.rec.author, lang: E.uiLang() });
        if (!box.isConnected) return;
        box.textContent = '';
        const g = groupXray(j.items);
        if (!xrayKinds.some((k) => g[k].length)) return note(box, T('aiNone'));
        xrayKinds.forEach((k) => {
          if (!g[k].length) return;
          box.append(h('h4', 'ai-h', T(KIND_KEY[k])));
          const card = h('div', 'lib-ios');
          g[k].map((x) => Object.assign({ n: countIn(all, x.name) }, x)).sort((a, b) => b.n - a.n).forEach((x) => {
            const it = h('div', 'ai-xr');
            const b = h('button', 'ai-xr-main'); b.type = 'button';
            const top = h('span', 'ai-xr-top'); const nm = h('b', null, x.name); nm.dir = 'auto';
            top.append(nm); if (x.n) top.append(h('span', 'ai-xr-n', '×' + x.n));
            const d = h('span', 'ai-xr-d', x.desc || ''); d.dir = 'auto';
            b.append(top, d);
            b.addEventListener('click', () => { close(); setTimeout(() => lastHit(r, x.name, cur), 220); });
            it.append(b);
            const url = x.ticker ? investLink(E.investBase(), x.ticker, x.name) : '';
            if (url) {
              const a = h('a', 'px-chip ai-tk', '$' + x.ticker); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.dir = 'ltr';
              a.setAttribute('aria-label', T('aiTicker', { t: x.ticker }));
              it.append(a);
            }
            card.append(it);
          });
          box.append(card);
        });
      })().catch((e) => { if (box.isConnected) note(box, errMsg(e)); });
    });
  }
  async function lastHit(r, name, cur) {   // המופע האחרון עד הפרק הנוכחי
    for (let i = cur; i >= 0; i--) {
      if (!linear(r, i)) continue;
      const t = await r.secText(i); const c = countIn(t, name);
      if (c) { jump(name, i, c - 1); return; }
    }
    flash(T('aiNotFound'));
  }

  /* ---------- F3: שאל את הספר — שליפה מקומית של קטעים, ותשובה רק מהם, עם מקורות ---------- */
  function openAsk() {
    const r = R(); if (!r) return;
    const cur = curSec(r);
    E.sheet(T('aiAsk'), (sh) => {
      let all = false;
      const seg = h('div', 'rd-seg');
      const sb = (on, label) => { const b = h('button', on ? 'on' : '', label); b.type = 'button'; seg.append(b); return b; };
      const b1 = sb(true, T('aiScopeHere')), b2 = sb(false, T('aiScopeAll'));
      [b1, b2].forEach((b, k) => b.addEventListener('click', () => { all = k === 1; b1.classList.toggle('on', !all); b2.classList.toggle('on', all); }));
      const form = h('form', 'ai-askf');
      const inp = h('input', 'ac-search'); inp.type = 'search'; inp.dir = 'auto'; inp.placeholder = T('aiAskPh'); inp.enterKeyHint = 'send'; inp.maxLength = 300;
      const go = h('button', 'adm-btn', T('aiAskGo')); go.type = 'submit';
      form.append(inp, go);
      const box = h('div', 'ai-out');
      sh.append(seg, form, box);
      setTimeout(() => { try { inp.focus(); } catch (e) {} }, 250);
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = inp.value.trim(); if (q.length < 2) return;
        try { inp.blur(); } catch (e2) {}
        busy(box, T('aiSearching'));
        try {
          const last = all ? (r.book.sections || []).length - 1 : cur;
          const paras = [];
          for (let i = 0; i <= last; i++) {
            if (!linear(r, i)) continue;
            (await r.secText(i)).split('\n').forEach((t, j) => { if (t.trim()) paras.push({ sec: i, j, t }); });
          }
          const ps = rankPassages(paras, qTerms(q), 12);
          if (!ps.length) return note(box, T('aiAskNone'));
          busy(box);
          const j = await call('ask', { q, lang: E.uiLang(), title: r.rec.title, passages: ps.map((p) => ({ t: p.t, ch: E.chapterLabel(p.sec) })) });
          if (!box.isConnected) return;
          box.textContent = '';
          const ans = h('div', 'ai-ans' + (j.found ? '' : ' muted')); ans.dir = 'auto';
          citeParts(j.answer, ps.length).forEach((x) => {
            if (x.t) { ans.append(document.createTextNode(x.t)); return; }
            const c = h('button', 'ai-cite', String(x.n)); c.type = 'button'; c.setAttribute('aria-label', T('aiSrc', { n: x.n }));
            c.addEventListener('click', () => openSrc(ps[x.n - 1]));
            ans.append(c);
          });
          box.append(ans);
          const cites = (j.cites || []).filter((n) => ps[n - 1]);
          if (cites.length) {
            box.append(h('h4', 'ai-h', T('aiSources')));
            const card = h('div', 'lib-ios');
            cites.forEach((n) => {
              const p = ps[n - 1];
              const b = h('button', 'lib-row ai-srcrow'); b.type = 'button';
              const l = h('span', 'pl-rl'); const t = h('span', 'pl-rs', p.at.slice(0, 160) + (p.at.length > 160 ? '…' : '')); t.dir = 'auto';
              l.append(h('span', 'pl-rt', '[' + n + '] ' + (E.chapterLabel(p.sec) || '')), t);
              b.append(l); b.addEventListener('click', () => openSrc(p));
              card.append(b);
            });
            box.append(card);
          }
        } catch (err) { if (box.isConnected) note(box, errMsg(err)); }
      });
      async function openSrc(p) {
        if (!p) return;
        const words = p.at.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ');
        const t = await r.secText(p.sec); const lines = t.split('\n');
        const before = lines.slice(0, p.j).join('\n');
        const v = sh.parentNode; E.closeSheetThen(v, () => setTimeout(() => jump(words, p.sec, countIn(before, words)), 200));
      }
    });
  }

  /* ---------- F7: דו־לשוני — הפרק הנוכחי מהעמוד הזה, תרגום לצד כל פסקה ---------- */
  function openBilingual() {
    const r = R(); if (!r) return;
    const cur = curSec(r);
    const ui = E.uiLang(), bl = String(r.rec.lang || '').slice(0, 2);
    const to = bl === ui ? (ui === 'he' ? 'en' : 'he') : ui;
    E.sheet(T('aiBi'), (sh) => {
      const lb = E.chapterLabel(cur);
      sh.append(h('p', 'pl-note', [lb, E.langName(to)].filter(Boolean).join(' · ')));
      const box = h('div', 'ai-bi'); sh.append(box);
      const more = h('button', 'lib-admin-link ai-more', T('aiMore')); more.type = 'button'; more.hidden = true;
      const st = h('div', 'ai-out'); sh.append(st, more);
      let paras = [], at = 0;
      const load = async () => {
        more.hidden = true; busy(st);
        const batch = batchParas(paras, at, 40, 8800);
        try {
          const j = await call('bilingual', { paras: batch, lang: to, title: r.rec.title });
          if (!st.isConnected) return;
          st.textContent = '';
          (j.out || []).forEach((tr, k) => {
            const pr = h('div', 'ai-pair');
            const o = h('p', 'ai-o', batch[k]); o.dir = 'auto'; if (bl) o.lang = bl;
            const t = h('p', 'ai-t', tr || ''); t.dir = 'auto'; t.lang = to;
            pr.append(o, t); box.append(pr);
          });
          at += (j.out || []).length || batch.length;
          more.hidden = at >= paras.length;
        } catch (e) { if (st.isConnected) { note(st, errMsg(e)); more.hidden = false; } }
      };
      more.addEventListener('click', load);
      (async () => {
        const t = await r.secText(cur);
        paras = t.split('\n').filter((x) => x.trim());
        let from = 0;
        try { const s0 = (r.loc.range.toString() || '').replace(/\s+/g, ' ').trim().slice(0, 40); if (s0) { const k = paras.findIndex((p) => p.includes(s0) || s0.startsWith(p.slice(0, 40))); if (k > 0) from = k; } } catch (e) {}
        at = from;
        if (!paras.length) return note(st, T('aiShort'));
        load();
      })();
    });
  }

  /* ---------- F5: תיוג ותקציר — לספר שלך; מציע, ואתה מאשר ---------- */
  function openTagSum(b) {
    E.sheet(T('aiTag'), (sh, close) => {
      const box = h('div', 'ai-out'); sh.append(box); busy(box);
      (async () => {
        const secs = (await E.ftTexts()).get(b.id) || [];
        const text = secs.map((s) => s.t || '').join('\n').slice(0, 14000);
        if (text.replace(/\s/g, '').length < 200 && !String(b.desc || '').trim()) return note(box, T('aiNoText'));
        const j = await call('tagsum', { text, desc: b.desc || '', title: b.title, author: b.author, lang: String(b.lang || '').slice(0, 2) || E.uiLang() });
        if (!box.isConnected) return;
        box.textContent = '';
        box.append(h('h4', 'ai-h', T('aiSum')));
        const ta = h('textarea', 'ai-ta'); ta.dir = 'auto'; ta.rows = 5; ta.value = j.summary || '';
        box.append(ta);
        if (String(b.desc || '').trim()) box.append(h('p', 'pl-note', T('aiSumRepl')));
        const tags = [j.genre].concat(j.tags || []).filter(Boolean);
        const on = new Set(tags);
        if (tags.length) {
          box.append(h('h4', 'ai-h', T('aiTagsT')));
          const row2 = h('div', 'ai-chips');
          tags.forEach((t) => {
            const c = h('button', 'px-chip', t); c.type = 'button'; c.setAttribute('aria-pressed', 'true');
            c.addEventListener('click', () => { if (on.has(t)) on.delete(t); else on.add(t); c.setAttribute('aria-pressed', String(on.has(t))); });
            row2.append(c);
          });
          box.append(row2);
        }
        const save = h('button', 'adm-btn ai-save', T('aiApply')); save.type = 'button';
        save.addEventListener('click', async () => {
          save.disabled = true;
          const vals = { tags: mergeTags(b.tags, tags.filter((t) => on.has(t))) };
          if (ta.value.trim()) vals.desc = ta.value.trim();
          const ok = await E.applyFields(b.id, vals).catch(() => false);
          close(); flash(T(ok ? 'aiSaved' : 'aiErr'));
        });
        box.append(save);
      })().catch((e) => { if (box.isConnected) note(box, errMsg(e)); });
    });
  }

  return { openTools, openXray, openAsk, openBilingual, openTagSum, ttsStart, ttsStop, stop: ttsStop };
}
