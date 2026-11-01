/* מרכז המס (01/11/2026, בקשת המשתמש; לפי התצוגה המקדימה שאושרה). שכבה במסך מלא מעל Invest:
   השנה · אם אמכור היום · פעולות. הכל מחושב בטלפון (taxil.js) מעסקאות ה־Flex ששמורות במכשיר, ומהשער היציג
   של בנק ישראל (op:'boifx' בשרתון — מידע ציבורי). שום נתון מס לא נשלח ולא נשמר בשרת.
   נטען רק בלחיצה בתפריט (import דינמי מ־app.js). התלויות מוזרקות (env). כל מחרוזת גלויה = T('tx…') מ־STRINGS. */

let E = { t: (k) => k };
const T = (k, v) => (E && typeof E.t === 'function' ? E.t(k, v) : k);
const LRI = '⁦', PDI = '⁩', MINUS = '−';
const LS_TAX = 'pwa_tax_v1';   // הגדרות אישיות: הכנסה אחרת לכל שנה (מס יסף), הפסד מועבר מלפני הדוחות — ACCOUNT_KEYS

let ROOT = null;
const S = { tab: 'year', year: null, modal: null, sheet: null, fx: {}, fxErr: false, seq: 0, calc: null };

/* ---------- עזרים ---------- */
function h(tag, attrs, kids) {
  const e = document.createElement(tag);
  for (const k of Object.keys(attrs || {})) {
    if (k === 'class') e.className = attrs[k];
    else if (k === 'text') e.textContent = attrs[k];
    else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
    else if (attrs[k] != null && attrs[k] !== false) e.setAttribute(k, attrs[k]);
  }
  for (const c of [].concat(kids || [])) if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  return e;
}
const ils = (v, d) => {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v), s = v < -0.004 ? MINUS : '';
  return LRI + s + '₪' + a.toLocaleString('en-US', { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d == null ? 0 : d }) + PDI;
};
const money = (v, cur) => (cur === 'ILS' ? ils(v, 2) : LRI + (v < 0 ? MINUS : '') + (cur === 'USD' ? '$' : cur + ' ') + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 }) + PDI);
const dmy = (iso) => (iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '');
const qtyTxt = (q) => LRI + (Math.round(q * 1e4) / 1e4).toLocaleString('en-US') + PDI;
const row = (k, v, cls) => h('div', { class: 'tx-row' + (cls ? ' ' + cls : '') }, [h('span', { text: k }), h('span', { class: 'tx-num', text: v })]);
function settings() { try { return JSON.parse(localStorage.getItem(LS_TAX) || 'null') || {}; } catch (e) { return {}; } }
function saveSettings(p) {
  const s = Object.assign(settings(), p);
  try { localStorage.setItem(LS_TAX, JSON.stringify(s)); } catch (e) {}
  return s;
}

/* ---------- הנתונים ---------- */
function ensureCss() {
  if (document.getElementById('txCss')) return Promise.resolve();
  const l = document.createElement('link'); l.id = 'txCss'; l.rel = 'stylesheet'; l.href = 'taxcenter.css';
  const p = new Promise((res) => { l.addEventListener('load', res); l.addEventListener('error', res); setTimeout(res, 1000); });
  document.head.appendChild(l);
  return p;
}
function ensureEngine() {
  if (typeof tiFifo === 'function') return Promise.resolve();
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'taxil.js';
    s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}
/* מטבעות שצריך להם שער (כל מה שאינו שקל), מהתאריך הראשון שמופיע */
function fxNeeds(d) {
  const need = {};
  const add = (cur, date) => {
    cur = String(cur || 'USD').toUpperCase();
    if (cur === 'ILS' || !date) return;
    if (!need[cur] || date < need[cur]) need[cur] = date;
  };
  for (const x of (d.trades || [])) add(x.currency, String(x.date || '').slice(0, 10));
  for (const x of (d.cashTransactions || [])) if (/dividend|withholding|interest|lieu/i.test(x.type || '')) add(x.currency, String(x.date || '').slice(0, 10));
  // פוזיציה בלי עסקאות — מספיקים השערים של השבועיים האחרונים (שער היום לפעמים עוד לא פורסם)
  const back = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
  for (const x of (d.positions || [])) add(x.currency, back);
  return need;
}
function todayISO() { const n = new Date(); return n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); }
async function loadFx(need) {
  const jobs = Object.keys(need).filter((c) => !(S.fx[c] && S.fx[c].from <= need[c]));
  await Promise.all(jobs.map(async (cur) => {
    try {
      const j = await E.api({ op: 'boifx', cur: cur, from: need[cur] });
      if (j && j.ok && Array.isArray(j.rows) && j.rows.length) S.fx[cur] = { from: need[cur], rows: j.rows };
      else S.fxErr = true;
    } catch (e) { S.fxErr = true; }
  }));
}
const fxOf = (cur, d) => (S.fx[cur] ? tiRateOn(S.fx[cur].rows, d) : null);
/* שער היום: השער החי של האפליקציה לדולר; אחרת — השער היציג האחרון */
const fxNow = (cur) => {
  if (cur === 'USD' && E.fx && E.fx() > 0) return E.fx();
  const r = S.fx[cur] && S.fx[cur].rows;
  return r && r.length ? r[r.length - 1][1] : null;
};

function compute() {
  const d = (E.data && E.data()) || {};
  const st = settings();
  const f = tiFifo(d.trades || [], fxOf);
  const divs = tiDividends(d.cashTransactions || [], fxOf);
  const years = tiYears(f.sales, divs, { carry: Number(st.carry0) || 0, other: st.other || {} });
  const nowY = new Date().getFullYear();
  const yIdx = new Map(years.map((y) => [y.year, y]));
  if (!yIdx.has(nowY)) {
    const prev = years.filter((y) => y.year < nowY).pop();
    const cur = tiYear(nowY, f.sales, divs, { carry: prev ? prev.carryOut : Number(st.carry0) || 0, other: (st.other || {})[nowY] });
    years.push(cur); yIdx.set(nowY, cur);
  }
  const priceOf = (sym) => { const q = E.quote && E.quote(sym); return q && q.close > 0 ? q.close : null; };
  const unreal = tiUnrealized(f.open, priceOf, fxNow, 0);
  const health = tiCheck(f.open, d.positions || []);
  return { d, f, divs, years, yIdx, unreal, health, w8: tiW8(divs), nowY, st };
}

/* ---------- פתיחה וסגירה ---------- */
export async function openTaxCenter(env) {
  E = env || E;
  await ensureCss();
  if (ROOT) closeTaxCenter(true);
  const seq = ++S.seq;
  S.tab = 'year'; S.year = null; S.calc = null;
  ROOT = h('div', { class: 'tx-root no-swipe', role: 'dialog', 'aria-modal': 'true', 'aria-label': T('txTitle') });
  document.body.appendChild(ROOT);
  document.documentElement.classList.add('tx-open');
  document.addEventListener('keydown', onEsc, true);
  S.modal = E.modalPush ? E.modalPush(() => closeTaxCenter(true)) : null;
  const d = (E.data && E.data()) || {};
  if (!(d.trades || []).length && !(d.cashTransactions || []).length) { render(); return; }
  render(T('txLoading'));
  try {
    await ensureEngine();
    await loadFx(fxNeeds(d));
  } catch (e) { S.fxErr = true; }
  if (seq !== S.seq || !ROOT) return;
  try { S.calc = compute(); } catch (e) { S.calc = null; S.fxErr = true; }
  render();
}
function onEsc(e) {
  if (e.key !== 'Escape' || !ROOT) return;
  e.stopPropagation(); e.preventDefault();
  if (S.sheet) closeSheet(); else closeTaxCenter();
}
function unwind(recs) {
  let n = 0;
  for (const r of recs) {
    if (!r || r === true || r.done) continue;
    if (r.pushed) n++;
    r.popping = true;
    if (E.modalDone) E.modalDone(r);
  }
  if (n && E.back) E.back(n);
}
function closeTaxCenter(fromPop) {
  if (!ROOT) return;
  document.removeEventListener('keydown', onEsc, true);
  const sh = S.sheet;
  if (sh) closeSheet(true);
  const recs = [sh && sh.modal, S.modal];
  const r = ROOT; ROOT = null; S.seq++; S.modal = null;
  document.documentElement.classList.remove('tx-open');
  if (!fromPop) unwind(recs);
  if (typeof r.animate === 'function' && !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    r.style.pointerEvents = 'none';
    const a = r.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(28px)' }], { duration: 220, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    a.onfinish = () => r.remove();
  } else r.remove();
}

/* ---------- ציור ---------- */
const BACK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 6 15 12 9 18"/></svg>';
function render(loading) {
  if (!ROOT) return;
  const y = ROOT.scrollTop;
  ROOT.textContent = '';
  const back = h('button', { class: 'tx-back', type: 'button', 'aria-label': T('txBack'), onclick: () => closeTaxCenter() });
  back.innerHTML = BACK_SVG;   // סמל קבוע — לא נתון
  const wrap = h('div', { class: 'tx-wrap' }, [h('div', { class: 'tx-top' }, [back, h('h1', { text: T('txTitle') })])]);
  ROOT.appendChild(wrap);
  const d = (E.data && E.data()) || {};
  if (!(d.trades || []).length && !(d.cashTransactions || []).length) {
    wrap.appendChild(h('div', { class: 'tx-empty' }, [h('p', { class: 'tx-sub', text: T('txEmpty') })]));
    return;
  }
  if (loading) { wrap.appendChild(h('div', { class: 'tx-empty' }, [h('p', { class: 'tx-sub', text: loading })])); return; }
  const C = S.calc;
  if (!C) {
    wrap.appendChild(h('div', { class: 'tx-empty' }, [h('p', { class: 'tx-sub', text: T('txErr') }),
      h('button', { class: 'tx-btn', type: 'button', text: T('txRetry'), onclick: () => openTaxCenter(E) })]));
    return;
  }
  const seg = h('div', { class: 'tx-seg', role: 'group' });
  for (const [k, lbl] of [['year', T('txTabYear')], ['today', T('txTabToday')], ['act', T('txTabAct')]]) {
    seg.appendChild(h('button', { type: 'button', 'aria-pressed': S.tab === k ? 'true' : 'false', text: lbl, onclick: () => { if (S.tab !== k) { S.tab = k; render(); ROOT.scrollTop = 0; } } }));
  }
  wrap.appendChild(seg);
  const flags = new Set();
  for (const yr of C.years) for (const f of yr.flags) flags.add(f);
  wrap.appendChild(h('div', { class: 'tx-note' }, [h('span', { text: 'ⓘ' }), h('span', {}, [h('b', { text: T('txNoteB') }), ' ' + T('txNote') +
    (S.fxErr ? ' ' + T('txNoteFx') : '') + (flags.has('nominalIls') ? ' ' + T('txNoteIls') : '')])]));
  if (S.tab === 'year') paintYear(wrap, C);
  else if (S.tab === 'today') paintToday(wrap, C);
  else paintActions(wrap, C);
  wrap.appendChild(h('div', { class: 'tx-src', text: T('txSrc') }));
  ROOT.scrollTop = y;
}

function paintYear(wrap, C) {
  const ys = C.years.map((y) => y.year).sort((a, b) => a - b);
  if (S.year == null || !ys.includes(S.year)) S.year = C.nowY;
  const chips = h('div', { class: 'tx-chips' });
  for (const yr of ys.slice(-6)) chips.appendChild(h('button', { class: 'tx-chip', type: 'button', 'aria-pressed': yr === S.year ? 'true' : 'false', text: String(yr), onclick: () => { S.year = yr; render(); } }));
  wrap.appendChild(chips);
  const Y = C.yIdx.get(S.year);
  const cur = S.year === C.nowY;
  // המס
  const c1 = h('div', { class: 'tx-card' }, [
    h('span', { class: 'tx-hero-k', text: T(cur ? 'txDueNow' : 'txDue', { y: S.year }) }),
    h('span', { class: 'tx-hero-v', text: ils(Y.due) }),
  ]);
  c1.appendChild(row(T('txGains'), ils(Y.gains)));
  if (Y.losses > 0) c1.appendChild(row(T('txLosses'), ils(-Y.losses)));
  if (Y.carryUsed > 0) c1.appendChild(row(T('txCarryUsed'), ils(-Y.carryUsed)));
  if (Y.offIncome > 0) c1.appendChild(row(T('txOffInc'), ils(-Y.offIncome)));
  c1.appendChild(row(T('txCgTax'), ils(Y.cgTax), 'tx-tot'));
  if (Y.carryOut > 0) c1.appendChild(row(T('txCarryOut', { y: S.year + 1 }), ils(Y.carryOut)));
  wrap.appendChild(c1);
  // דיבידנדים וריבית
  if (Y.div.n || Y.interest.n) {
    const c2 = h('div', { class: 'tx-card' }, [h('p', { class: 'tx-h', text: T('txDivs') })]);
    c2.appendChild(row(T('txGross'), ils(Y.div.gross + Y.interest.gross)));
    c2.appendChild(row(T('txWh'), ils(Y.div.wh + Y.interest.wh)));
    if (Y.creditLost > 0.5) c2.appendChild(row(T('txCreditLost'), ils(Y.creditLost), 'tx-loss'));
    c2.appendChild(row(T('txExtra'), ils(Y.extraInc), 'tx-tot'));
    wrap.appendChild(c2);
  }
  // מס יסף
  const c3 = h('div', { class: 'tx-card' }, [h('p', { class: 'tx-h', text: T('txSurtax') })]);
  const other = (C.st.other || {})[S.year];
  if (other == null) c3.appendChild(h('p', { class: 'tx-sub', text: T('txSurtaxHint') }));
  else c3.appendChild(row(T('txSurtaxDue'), ils(Y.surtax), 'tx-tot'));
  c3.appendChild(numField('txOther', T('txOtherL', { y: S.year }), other, (v) => {
    const o = Object.assign({}, settings().other || {});
    if (v == null) delete o[S.year]; else o[S.year] = v;
    saveSettings({ other: o }); recompute();
  }));
  wrap.appendChild(c3);
  // מכירות השנה
  const ys2 = C.f.sales.filter((s) => s.sellDate.slice(0, 4) === String(S.year));
  if (ys2.length) {
    const c4 = h('div', { class: 'tx-card' }, [h('p', { class: 'tx-h', text: T('txSales', { n: ys2.length }) })]);
    for (const s of ys2.slice().reverse()) {
      c4.appendChild(h('button', { class: 'tx-item', type: 'button', onclick: () => openLots(s.sym, [s], true) }, [
        h('span', { class: 'tx-tag', text: s.sym.slice(0, 5) }),
        h('span', {}, [h('div', { class: 'tx-nm', text: s.sym }), h('div', { class: 'tx-ds', text: dmy(s.sellDate) + ' · ' + T('txUnits', { n: qtyTxt(s.qty) }) })]),
        h('span', { class: 'tx-end' }, [h('span', { class: 'tx-num ' + (s.taxable < 0 ? 'tx-loss' : ''), text: ils(s.taxable) }), h('span', { class: 'tx-ds', text: T('txTaxable') })]),
      ]));
    }
    wrap.appendChild(c4);
  }
  // הפסד מועבר מלפני הדוחות
  const first = C.years.length ? Math.min(...C.years.map((y) => y.year)) : C.nowY;
  const c5 = h('div', { class: 'tx-card' }, [h('p', { class: 'tx-h', text: T('txCarry0H') }), h('p', { class: 'tx-sub', text: T('txCarry0S', { y: first }) })]);
  c5.appendChild(numField('txCarry0', T('txCarry0L'), C.st.carry0, (v) => { saveSettings({ carry0: v }); recompute(); }));
  wrap.appendChild(c5);
}

function numField(id, label, val, onSave) {
  const inp = h('input', { id: id, type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: '₪' });
  if (val != null && isFinite(val)) inp.value = String(val);
  inp.addEventListener('change', () => {
    const v = inp.value === '' ? null : Math.max(0, Number(inp.value) || 0);
    onSave(v);
  });
  return h('div', { class: 'tx-field' }, [h('label', { for: id, text: label }), inp]);
}
function recompute() { try { S.calc = compute(); } catch (e) {} render(); }

function paintToday(wrap, C) {
  const ok = C.unreal.filter((u) => !u.missing);
  const Y = C.yIdx.get(C.nowY);
  const val = ok.reduce((a, u) => a + u.value, 0);
  const fxPart = ok.reduce((a, u) => a + Math.max(0, u.gIls - u.taxable), 0);
  // המס הנוסף על השנה אם מוכרים הכל היום: אותה שנה עם המכירות הדמיוניות פחות השנה כפי שהיא
  // (דרך tiYear — כך הקיזוז, ההפסד המועבר והקיזוז מול דיבידנד נשארים נכונים)
  const today = todayISO();
  const fake = ok.map((u) => Object.assign({}, u, { sellDate: today }));
  const Yall = tiYear(C.nowY, C.f.sales.concat(fake), C.divs, { carry: Y.carryIn, other: (C.st.other || {})[C.nowY] });
  const extra = Math.max(0, Yall.due - Y.due);
  const miss = new Set(C.unreal.filter((u) => u.missing).map((u) => u.sym)).size;
  const none = !ok.length;
  const c1 = h('div', { class: 'tx-card' }, [h('div', { class: 'tx-two' }, [
    h('div', { class: 'tx-tile' }, [h('span', { class: 'tx-k', text: T('txValue') }), h('span', { class: 'tx-v', text: none ? '—' : ils(val) })]),
    h('div', { class: 'tx-tile' }, [h('span', { class: 'tx-k', text: T('txTaxAll') }), h('span', { class: 'tx-v', text: none ? '—' : ils(extra) })]),
  ]), none ? null : h('p', { class: 'tx-sub', text: T('txNet', { v: ils(val - extra), fx: ils(fxPart) }) }),
  miss ? h('p', { class: 'tx-sub', text: T('txMissing', { n: miss }) }) : null]);
  wrap.appendChild(c1);
  // לפי סימבול
  const by = new Map();
  for (const u of C.unreal) { const a = by.get(u.sym) || []; a.push(u); by.set(u.sym, a); }
  const list = [...by.entries()].map(([sym, ls]) => ({ sym, ls, tx: ls.reduce((a, u) => a + (u.missing ? 0 : u.taxable), 0), miss: ls.some((u) => u.missing) }))
    .sort((a, b) => b.tx - a.tx);
  const bad = new Set(C.health.map((x) => x.sym));
  const c2 = h('div', { class: 'tx-card' });
  for (const it of list) {
    const since = it.ls.map((u) => u.date).sort()[0];
    const tax = it.tx * Y.rate;
    const end = it.miss ? [h('span', { class: 'tx-num', text: '—' }), h('span', { class: 'tx-ds', text: T('txNoPrice') })]
      : bad.has(it.sym) ? [h('span', { class: 'tx-num', text: '—' }), h('span', { class: 'tx-ds', text: T('txMismatch') })]
      : it.tx < 0 ? [h('span', { class: 'tx-num tx-gain', text: ils(tax) }), h('span', { class: 'tx-ds', text: T('txLossRec', { v: ils(-it.tx) }) })]
      : [h('span', { class: 'tx-num', text: ils(tax) }), h('span', { class: 'tx-ds', text: T('txOn', { v: ils(it.tx) }) })];
    c2.appendChild(h('button', { class: 'tx-item', type: 'button', onclick: () => openLots(it.sym, it.ls, false) }, [
      h('span', { class: 'tx-tag', text: it.sym.slice(0, 5) }),
      h('span', {}, [h('div', { class: 'tx-nm', text: it.sym }), h('div', { class: 'tx-ds', text: T(it.ls.length === 1 ? 'txLotSince1' : 'txLotsSince', { n: it.ls.length, d: since ? since.slice(5, 7) + '/' + since.slice(0, 4) : '' }) })]),
      h('span', { class: 'tx-end' }, end),
    ]));
  }
  if (!list.length) c2.appendChild(h('p', { class: 'tx-sub', text: T('txNoOpen') }));
  wrap.appendChild(c2);
}

function paintActions(wrap, C) {
  const Y = C.yIdx.get(C.nowY);
  const c1 = h('div', { class: 'tx-card' }, [h('p', { class: 'tx-h', text: T('txBeforeEnd', { y: C.nowY }) })]);
  const harvest = tiHarvest(C.unreal.filter((u) => !C.health.some((x) => x.sym === u.sym)), Y);
  let n1 = 0;
  for (const hv of harvest) {
    if (hv.saves > 0.5) { n1++; c1.appendChild(alertRow('g', '₪', T('txHarvest', { s: hv.sym, v: ils(hv.saves), l: ils(hv.loss) }))); }
    if (hv.onIncome > 0.5) { n1++; c1.appendChild(alertRow('o', '!', T('txHarvestInc', { s: hv.sym, v: ils(hv.onIncome) }))); }
  }
  for (const u of C.unreal) {
    if (!u.missing && u.gIls < -1 && u.taxable === 0) { n1++; c1.appendChild(alertRow('o', '$', T('txFxLoss', { s: u.sym, d: dmy(u.date) }))); }
  }
  if (!n1) c1.appendChild(h('p', { class: 'tx-sub', text: T('txNothing') }));
  wrap.appendChild(c1);
  // דוח ומקדמה חצי־שנתיים — 91(ד)(2ג)(ב)
  const half = (a, b) => C.f.sales.filter((s) => s.sellDate >= a && s.sellDate <= b).reduce((x, s) => x + s.taxable, 0);
  const yS = String(C.nowY);
  const h1 = half(yS + '-01-01', yS + '-06-30'), h2 = half(yS + '-07-01', yS + '-12-31');
  const c2 = h('div', { class: 'tx-card' }, [h('p', { class: 'tx-h', text: T('txChecks') })]);
  if (h1 > 0) c2.appendChild(alertRow('o', '31/7', T('txSemi1', { v: ils(h1 * Y.rate) })));
  if (h2 > 0) c2.appendChild(alertRow('o', '31/1', T('txSemi2', { v: ils(h2 * Y.rate), y: C.nowY + 1 })));
  for (const w of C.w8) c2.appendChild(alertRow('r', Math.round(w.rate * 100) + '%', T('txW8', { s: w.sym, d: dmy(w.date), v: ils(w.lostIls) })));
  for (const m of C.health) c2.appendChild(alertRow('o', '⇄', T('txHealth', { s: m.sym, b: qtyTxt(m.broker), l: qtyTxt(m.lots) })));
  const noLots = C.f.issues.filter((i) => i.type === 'noLots');
  for (const i of noLots) c2.appendChild(alertRow('o', '?', T('txNoLots', { s: i.sym, d: dmy(i.date) })));
  const noFx = C.f.issues.filter((i) => i.type === 'noFx').length;
  if (noFx) c2.appendChild(alertRow('r', '₪', T('txNoFx', { n: noFx })));
  const nTr = ((C.d.trades) || []).length;
  if (!noFx && !C.health.length && !noLots.length) c2.appendChild(alertRow('g', '✓', T('txAllOk', { n: nTr })));
  wrap.appendChild(c2);
  wrap.appendChild(h('div', { class: 'tx-card' }, [
    h('div', { class: 'tx-row' }, [h('span', { class: 'tx-h', text: T('txReport') }), h('span', { class: 'tx-pill', text: T('txSoon') })]),
    h('p', { class: 'tx-sub', text: T('txReportS') }),
  ]));
}
function alertRow(kind, icon, text) {
  return h('div', { class: 'tx-alert' }, [h('span', { class: 'tx-ic ' + kind, text: icon }), h('span', { text: text })]);
}

/* ---------- גיליון החישוב: שני החישובים זה לצד זה ---------- */
function openLots(sym, items, sold) {
  closeSheet(true);
  const veil = h('div', { class: 'tx-veil', onclick: () => closeSheet() });
  const sh = h('div', { class: 'tx-sheet', role: 'dialog', 'aria-label': sym }, [h('div', { class: 'tx-grab' }), h('p', { class: 'tx-h', text: sym })]);
  for (const u of items) {
    if (u.missing) continue;
    const cur = u.cur;
    const buyIls = sold ? u.costIls : u.qty * u.unit * u.fx;
    const sellIls = sold ? u.proceedsIls : buyIls + u.gIls;
    const cost = sold ? u.cost : u.qty * u.unit;
    const proc = sold ? u.proceeds : cost + u.gFx / u.fxNow;
    const fxS = sold ? u.fxSell : u.fxNow;
    const lowIls = u.taxable === u.gIls && u.taxable !== 0;
    const lowFx = u.taxable === u.gFx && u.taxable !== 0 && !lowIls;
    const head = (sold ? T('txLotSold', { b: dmy(u.buyDate), s: dmy(u.sellDate) }) : T('txLotOpen', { b: dmy(u.date) })) + ' · ' + T('txUnits', { n: qtyTxt(u.qty) });
    const box = h('div', { class: 'tx-lot' }, [
      h('span', { class: 'tx-ds', text: head }),
      h('div', { class: 'tx-two' }, [
        h('div', { class: 'tx-tile' + (lowIls ? ' tx-win' : '') }, [h('span', { class: 'tx-k', text: T('txInIls') }), h('span', { class: 'tx-v', text: ils(u.gIls) }),
          h('span', { class: 'tx-f', text: LRI + ils(sellIls) + ' − ' + ils(buyIls) + PDI })]),
        h('div', { class: 'tx-tile' + (lowFx ? ' tx-win' : '') }, [h('span', { class: 'tx-k', text: T('txInCur', { c: cur }) }), h('span', { class: 'tx-v', text: ils(u.gFx) }),
          h('span', { class: 'tx-f', text: LRI + '(' + money(proc, cur) + ' − ' + money(cost, cur) + ') × ' + fxS.toFixed(3) + PDI })]),
      ]),
      h('p', { class: 'tx-sub', text: explain(u) }),
    ]);
    sh.appendChild(box);
  }
  document.body.appendChild(veil); document.body.appendChild(sh);
  S.sheet = { veil, sh, modal: E.modalPush ? E.modalPush(() => closeSheet(true)) : null };
}
function explain(u) {
  if (u.nominal) return T('txExplIls', { v: ils(u.taxable) });
  if (u.taxable === 0) return T('txExplZero');
  const tax = ils(Math.abs(u.taxable) * tiRules(new Date().getFullYear()).rate);
  return u.taxable > 0 ? T('txExplGain', { v: ils(u.taxable), t: tax }) : T('txExplLoss', { v: ils(-u.taxable) });
}
function closeSheet(fromPop) {
  const s = S.sheet;
  if (!s) return;
  S.sheet = null;
  s.veil.remove(); s.sh.remove();
  if (!fromPop) unwind([s.modal]);
  else if (s.modal && E.modalDone && !s.modal.done) { s.modal.popping = true; E.modalDone(s.modal); }
}
