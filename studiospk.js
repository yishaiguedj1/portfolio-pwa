/* דוברים בכל תמליל (16/11/2026; המשתמש: "לכל דובר — מי הוא, המגדר שלו ובאיזו שפה הוא מדבר; צבע שונה לכל דובר,
   בממשק נקי בזכוכית" — לפי ת־עיצוב). משותף לדף הניתוח (studiovi.js, גם בדף השיתוף) ולעורך הכתוביות (studiosubs.js):
   הפלטה, ראשי התיבות, השם ושורת הפרטים, העיגול וגיליון הדובר (.st-rs — הגיליון והזכוכית של הסטודיו).
   הצבע — ב־CSS לפי data-spk (0–5, studio.css): ‎--sb הבסיס (עיגול, פס) ו־‎--si הדיו (השם; בכהה — גוון בהיר יותר).
   כל טקסט — textContent בלבד (שמות מהמודל ומהמשתמש). */

/* שישה גוונים בסדר הקבוע של הבחירה — כחול, זהב, כתום, סגול, ירוק, ורוד: אותו סדר גוונים כמו הצבעים שנשמרו לפני כן
   (spkc בסטודיו), כך שבחירה ישנה נשארת באותו גוון. כולם באותה בהירות: הבסיס — 5.2:1 לטקסט לבן ו־4.7:1 על הרקע הבהיר;
   הדיו — 5.4:1 לפחות על הכרטיס הכהה */
export const SPK_BASE = ['#016EBE', '#8E6502', '#B74A01', '#904EBA', '#047B59', '#AF4191'];
export const SPK_INK = ['#4AA6FE', '#D39702', '#FB7F40', '#C886F6', '#0DB886', '#ED79CA'];
export const SPK_ORDER = [0, 2, 4, 5, 1, 3];   // ברירת המחדל לפי סדר ההופעה — גוונים רחוקים זה מזה קודם
export const SPK_N = SPK_BASE.length;
export const LABEL_RE = /^S(\d{1,2})$/;
export const LANG_MIN = 0.05;   // שפה נכנסת לשורת הפרטים מ־5% מהדיבור של הדובר (כמו בשורת הפתיחה של הניתוח)

/* מספר צבע לכל דובר: names — לפי סדר ההופעה; over — { שם: 0–5 } הבחירה שלך. בחירה נשמרת (הראשון בסדר — כשתיים זהות);
   השאר מקבלים לפי SPK_ORDER את הגוון הפנוי הבא — כך כל דובר בצבע אחר (עד שישה; מעבר לזה — במעגל) */
export function spkIdx(names, over) {
  const o = over && typeof over === 'object' ? over : {}, m = new Map(), used = new Set();
  for (const n of names || []) {
    const x = o[n];
    if (!m.has(n) && Number.isInteger(x) && x >= 0 && x < SPK_N && !used.has(x)) { m.set(n, x); used.add(x); }
  }
  let k = 0;
  for (const n of names || []) {
    if (m.has(n)) continue;
    let x = SPK_ORDER.find((c) => !used.has(c));
    if (x == null) x = SPK_ORDER[k++ % SPK_N];
    m.set(n, x); used.add(x);
  }
  return m;
}

/* ראשי התיבות בעיגול: באותיות לטיניות — של המילה הראשונה והאחרונה (DL); בכתב אחר — אות אחת; בלי שם — המספר */
export function initials(name, no) {
  const w = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!w.length) return String(no || '');
  const ch = (s) => Array.from(s.replace(/^[^\p{L}\p{N}]+/u, ''))[0] || '';
  const a = ch(w[0]), z = w.length > 1 ? ch(w[w.length - 1]) : '';
  return /^[A-Za-z]$/.test(a) ? (a + (/^[A-Za-z]$/.test(z) ? z : '')).toUpperCase() : a || String(no || '');
}

/* דובר לתצוגה: d = { k, name, role, g, gs, sh, t, lg, ttl, act, orig, kb }; no — המספר בסדר ההופעה; c — מספר הצבע. בלי שם — "דובר N".
   17/11/2026 (מי מדבר): ttl — מי הוא (תואר וארגון), act — השחקן (סרט/סדרה), orig — השם בכתב המקור, kb — מהידע הכללי של המודל */
export function spkView(T, d, no, c) {
  const named = !!(d && d.name);
  return {
    k: d.k, no, c, named, name: named ? d.name : T('studioSpkN', { n: no }), ini: initials(named ? d.name : '', no),
    role: d.role || '', g: d.g === 'm' || d.g === 'f' ? d.g : 'u', gs: d.gs || '', sh: d.sh || 0, t: d.t || 0, lg: Array.isArray(d.lg) ? d.lg : [],
    ttl: d.ttl || '', act: d.act || '', orig: d.orig || '', kb: d.kb === 1,
  };
}

export const pctOf = (sh) => Math.round((sh || 0) * 100);
/* השפה העיקרית של הדובר (הכי הרבה דיבור) */
export const mainLg = (s) => (s && s.lg && s.lg.length ? s.lg.reduce((a, x) => (x.sh > a.sh ? x : a)).lg : '');
export function genderWord(T, g) { return g === 'm' ? T('studioSpkM') : g === 'f' ? T('studioSpkF') : T('studioSpkGU'); }
/* מי הוא, בשורה אחת (17/11/2026, המשתמש: "טייטל ברור — שהמשתמש תמיד יבין במי מדובר, קצר ונקי"): התואר · התפקיד בסרטון ·
   "בגילום X" (סרט/סדרה). אין — ריק */
export function spkWho(T, s) {
  return [s.ttl, s.role, s.act ? T('studioSpkAct', { n: s.act }) : ''].filter(Boolean).join(' · ');
}
/* שורת הפרטים: מי הוא (spkWho); כשלא ידוע עליו כלום — המגדר · השפות (מ־5%, עד שלוש). המגדר והשפות תמיד בגיליון */
export function spkLine(T, s, nm) {
  const who = spkWho(T, s);
  if (who) return who;
  const lgs = s.lg.filter((x) => x.sh >= LANG_MIN).sort((a, b) => b.sh - a.sh).slice(0, 3).map((x) => nm(x.lg));
  return [genderWord(T, s.g), lgs.join(', ')].filter(Boolean).join(' · ');
}

/* העיגול: ראשי התיבות בלבן על צבע הדובר. sm / lg — קטן (בראש תור) / גדול (בגיליון) */
export function avatar(h, s, cls) {
  const a = h('span', 'st-spk-av' + (cls ? ' ' + cls : ''), s.ini);
  a.dataset.spk = String(s.c);
  a.setAttribute('aria-hidden', 'true');
  return a;
}

/* שורה ברשימת הדוברים (כרטיס הדוברים בדף הניתוח, הפאנל בעורך): העיגול, השם, שורת הפרטים, האחוז מהדיבור וחץ */
export function spkRow(o) {
  const { T, h, btn, s, nm, k, onOpen, chev } = o;
  const r = btn('st-row st-ric st-spk-row', null, onOpen, k);
  r.dataset.spk = String(s.c);
  const l = h('span', 'st-l');
  const b = h('b'); b.append(h('bdi', null, s.name));   /* bdi ולא dir=auto על b — שם לועזי נשאר מיושר לימין */
  l.append(b, h('small', null, spkLine(T, s, nm)));
  r.append(avatar(h, s), l);
  if (s.sh > 0) { const p = h('bdi', 'st-spk-pc', pctOf(s.sh) + '%'); p.dir = 'ltr'; r.append(p); }
  if (chev) r.append(chev);
  r.setAttribute('aria-label', s.name + ', ' + spkLine(T, s, nm) + (s.sh > 0 ? ', ' + T('studioSpkShareA', { p: pctOf(s.sh) }) : ''));
  return r;
}

/* גיליון הדובר (.st-rs — הגיליון התחתון של הסטודיו, זכוכית): העיגול הגדול, השם והחלק בדיבור; שם ותפקיד (שדות), המגדר
   (בורר) ומאיפה הוא ידוע, השפות עם פס לכל אחת, הצבע ופעולה אחת (act — "רק X בתמליל").
   o: { T, h, btn, s, nm(lg), max, ro, onName(v), onRole(v), onG(g), onColor(i), act: { label, fn }, actLabel(s), onClose() }.
   כל on… מחזיר את הדובר אחרי השינוי (spkView), או null — לא השתנה.
   ro — דף הצפייה ששותף בקישור: בלי עריכה. מחזיר { el, close } — המקבל מוסיף ל־body ו"חזור" סוגר (rsClose / closeSheet) */
export function spkSheet(o) {
  const { T, h, btn, s } = o;
  const max = o.max || 40;
  const sh = h('div', 'st-rs st-spk-sh');
  sh.dir = 'rtl';
  sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-modal', 'true');
  const box = h('div', 'st-rs-box');
  const top = h('div', 'st-spk-top'); top.dataset.spk = String(s.c);
  const tt = h('div', 'st-spk-tt');
  const ttl = h('h2', 'st-rs-t'); ttl.id = 'st-spk-sht';
  const ttlN = h('bdi', null, s.name); ttl.append(ttlN);
  sh.setAttribute('aria-labelledby', ttl.id);
  tt.append(ttl);
  /* 17/11/2026: מי הוא — השם בכתב המקור · התואר · "בגילום X"; מהידע הכללי של המודל — הערה קטנה */
  const who = h('div', 'st-spk-who');
  const kb = h('div', 'st-spk-kb', T('studioSpkKb'));
  const sub = h('div', 'st-spk-sub');
  tt.append(who, sub, kb);
  const av = avatar(h, s, 'lg');
  top.append(av, tt);
  box.append(h('div', 'st-rs-grab'), top);
  const sec = (t) => { const x = h('div', 'st-sec-t st-spk-sec'); x.append(h('span', null, t)); return x; };

  /* שם ותפקיד */
  const fl = h('div', 'st-list st-spk-fl');
  const field = (lbl, val, ph, k, fn) => {
    const r = h('label', 'st-row');
    const l = h('span', 'st-l'); l.append(h('b', null, lbl));
    const i = h('input', 'st-spk-in'); i.type = 'text'; i.value = val; i.placeholder = ph; i.maxLength = max; i.dir = 'auto';
    i.autocomplete = 'off'; i.spellcheck = false; i.dataset.k = k;
    if (o.ro) i.readOnly = true;
    else i.addEventListener('change', () => fn(i.value.replace(/\s+/g, ' ').trim().slice(0, max), i));
    r.append(l, i);
    return r;
  };
  fl.append(field(T('studioSpkName'), s.named ? s.name : '', s.named ? '' : s.name, 'spk-nm', (v, i) => {
    const nx = o.onName ? o.onName(v) : null;   // מחזיר את הדובר המעודכן (או null — לא השתנה)
    if (!nx) { i.value = s.named ? s.name : ''; return; }
    repaint(nx);
  }));
  if (s.role || !o.ro) fl.append(field(T('studioSpkRole'), s.role, T('studioSpkRoleP'), 'spk-role', (v) => { const nx = o.onRole ? o.onRole(v) : null; if (nx) repaint(nx); }));
  box.append(fl);

  /* המגדר — בורר של שלוש; מתחת: מאיפה הוא ידוע (מה שנאמר בסרטון / הקול / אתה) */
  box.append(sec(T('studioSpkG')));
  const gs = h('div', 'st-seg2 st-spk-g'); gs.setAttribute('role', 'radiogroup'); gs.setAttribute('aria-label', T('studioSpkG'));
  const note = h('div', 'st-spk-note');
  const gsrc = (x) => (x.g === 'u' ? '' : x.gs === 'me' ? T('studioSpkGM') : x.gs === 'text' ? T('studioSpkGT') : x.gs === 'voice' ? T('studioSpkGV') : '');
  for (const [g, lbl] of [['m', T('studioSpkM')], ['f', T('studioSpkF')], ['u', T('studioSpkU')]]) {
    const b = btn(null, null, o.ro ? null : () => {
      const nx = o.onG ? o.onG(g) : null;
      if (nx) repaint(nx);
    }, 'spk-g:' + g);
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', s.g === g ? 'true' : 'false');
    if (o.ro) b.disabled = true;
    b.append(h('b', null, lbl));
    gs.append(b);
  }
  note.textContent = gsrc(s); note.hidden = !note.textContent;
  box.append(gs, note);

  /* השפות — שם, פס ואחוז; מהשפה העיקרית */
  const lgs = s.lg.filter((x) => x.sh > 0).sort((a, b) => b.sh - a.sh);
  if (lgs.length) {
    box.append(sec(T('studioSpkLangs')));
    const ll = h('div', 'st-list st-spk-lgs'); ll.dataset.spk = String(s.c);
    for (const x of lgs) {
      const r = h('div', 'st-row');
      const l = h('span', 'st-l'); l.append(h('b', null, o.nm(x.lg)));
      const bar = h('span', 'st-spk-bar'); const fill = h('i'); fill.style.width = Math.max(2, pctOf(x.sh)) + '%'; bar.append(fill);
      const p = h('bdi', 'st-spk-pc', pctOf(x.sh) + '%'); p.dir = 'ltr';
      r.append(l, bar, p);
      ll.append(r);
    }
    box.append(ll);
  }

  /* הצבע — שישה עיגולים; הבחירה נשמרת לפי שם הדובר (אותו אדם — אותו צבע בכל העבודות) */
  let sws = null;
  if (!o.ro && o.onColor) {
    box.append(sec(T('studioSpkCol')));
    sws = h('div', 'st-spk-sws'); sws.setAttribute('role', 'radiogroup'); sws.setAttribute('aria-label', T('studioSpkCol'));
    for (let i = 0; i < SPK_N; i++) {
      const b = btn('st-spk-c', null, () => { const nx = o.onColor(i); if (nx) repaint(nx); }, 'spk-c:' + i);
      b.dataset.spk = String(i); b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', i === s.c ? 'true' : 'false');
      b.setAttribute('aria-label', T('studioSpkColN', { n: i + 1 }));
      sws.append(b);
    }
    box.append(sws);
  }
  if (o.act) box.append(btn('st-btn wide tint st-spk-act', o.act.label, () => { close(); o.act.fn(); }, 'spk-act'));
  sh.append(box);
  sh.addEventListener('click', (e) => { if (e.target === sh) close(); });

  subOf();
  /* "47% מהדיבור · 20 דק׳" (פחות מדקה — בשניות); מעליו — מי הוא */
  function subOf() {
    who.textContent = [s.orig, s.ttl, s.act ? T('studioSpkAct', { n: s.act }) : ''].filter(Boolean).join(' · ');
    who.hidden = !who.textContent;
    kb.hidden = !s.kb;
    sub.textContent = s.sh > 0 ? (s.t < 60 ? T('studioSpkShareS', { p: pctOf(s.sh), n: Math.max(1, Math.round(s.t)) }) : T('studioSpkShare', { p: pctOf(s.sh), n: Math.round(s.t / 60) })) : '';
    sub.hidden = !sub.textContent;
  }
  /* אחרי שינוי: הכותרת, העיגול, המגדר והצבע — במקום, בלי לבנות את הגיליון מחדש (המקלדת והגלילה נשארות) */
  function repaint(nx) {
    Object.assign(s, nx);
    ttlN.textContent = s.name;
    subOf();
    av.textContent = s.ini;
    for (const x of [top, av, sh.querySelector('.st-spk-lgs')]) if (x) x.dataset.spk = String(s.c);
    for (const b of gs.children) b.setAttribute('aria-checked', b.dataset.k === 'spk-g:' + s.g ? 'true' : 'false');
    note.textContent = gsrc(s); note.hidden = !note.textContent;
    if (sws) for (const b of sws.children) b.setAttribute('aria-checked', b.dataset.k === 'spk-c:' + s.c ? 'true' : 'false');
    const ab = box.querySelector('.st-spk-act');
    if (ab && o.actLabel) ab.textContent = o.actLabel(s);
  }
  function close() { if (sh.isConnected) sh.remove(); if (o.onClose) o.onClose(); return true; }
  return { el: sh, close };
}

/* מה ששינית בדובר, לכל עבודה (store.vsp בסטודיו): { [מזהה העבודה]: { [תווית / שם]: { n, r, g, c } } } — שם ותפקיד (עד 40;
   ריק = "מחקתי" את מה שהעובד מצא), מגדר m/f/u, וצבע 0–5 (לדובר בלי שם — הצבע של דובר עם שם נשמר לפי השם, spkc).
   עד VSP_MAX עבודות (האחרונות), 20 דוברים בכל אחת */
export const VSP_MAX = 100;
export function normVsp(o) {
  const out = {};
  if (!o || typeof o !== 'object' || Array.isArray(o)) return out;
  for (const [id, m] of Object.entries(o).slice(-VSP_MAX)) {
    if (!/^j[A-Za-z0-9_-]{20}$/.test(id) || !m || typeof m !== 'object' || Array.isArray(m)) continue;
    const x = {};
    for (const [k, d] of Object.entries(m).slice(0, 20)) {
      if (!k.trim() || k.length > 20 || /[\u0000-\u001f]/.test(k) || !d || typeof d !== 'object' || Array.isArray(d)) continue;
      const y = {};
      for (const f of ['n', 'r']) if (typeof d[f] === 'string') y[f] = d[f].replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
      if (d.g === 'm' || d.g === 'f' || d.g === 'u') y.g = d.g;
      if (Number.isInteger(d.c) && d.c >= 0 && d.c < SPK_N) y.c = d.c;
      if (Object.keys(y).length) x[k] = y;
    }
    if (Object.keys(x).length) out[id] = x;
  }
  return out;
}
/* שינוי אחד: patch על הדובר k בעבודה id (מחזיר מאגר חדש, מנורמל; העבודה עוברת לסוף — הקיצוץ שומר את האחרונות) */
export function vspSet(all, id, k, patch) {
  const o = Object.assign({}, all || {});
  const m = Object.assign({}, o[id] || {});
  m[k] = Object.assign({}, m[k] || {}, patch);
  delete o[id]; o[id] = m;
  return normVsp(o);
}
/* שינוי שם בעורך: מה ששמרת לדובר עובר מהשם הישן לחדש */
export function vspMove(all, id, from, to) {
  const m = (all || {})[id];
  if (!m || !m[from] || from === to) return all || {};
  const o = Object.assign({}, all), x = Object.assign({}, m);
  x[to] = Object.assign({}, x[from], x[to] || {});
  delete x[from];
  o[id] = x;
  return normVsp(o);
}
