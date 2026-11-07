/* Cashflow, גל 2 (6/11/2026): שלושת המסכים — בית, חודש ולבדוק — לפי התצוגה המקדימה שהמשתמש אישר.
   הנתונים: רק POST /api/cashflow בשרתון (ibkr-proxy/lib/cashflow.js, גל 1) — דוחות JSON מהמנוע של riseup-finance.
   פרטיות (docs/privacy.md, docs/cashflow.md):
   - שום נתון פיננסי לא נשמר בטלפון: לא localStorage, לא IndexedDB, ולא מטמון ה־SW (POST, no-store). רק בזיכרון של הדף.
   - טקסט חיצוני (בתי עסק, קטגוריות, כינויי חשבון) — רק textContent, אף פעם לא innerHTML. innerHTML רק לאייקונים קבועים.
   - "בדקתי" נשמר בשרת כ־hash של 16 תווים (op seen) — בלי שם בית העסק ובלי סכום.
   - הקריאה לרייזאפ רק דרך השרת; הטלפון לא רואה את הטוקן לעולם. מטמון 15 דק׳ בשרת, ורענון ידני (refresh) ליד הגלובוס.
   תלוי ב־core.js: t, getLang, dialNavBuild, dialHost, wireDial, dialSync, askAlert, appGo. */

let SA = null, root = null, page = null, nav = null, cur = 'home', busy = 0;
const KEYS = ['month', 'home', 'review'];   // מימין לשמאל ב־RTL — הבית באמצע (docs/ui.md, החוגה)
const LBL = { month: 'cfTabMonth', home: 'cfTabHome', review: 'cfTabReview' };
const ICO = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
  month: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  review: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/><path d="M8.5 11h5"/>',
};
const SVG = (inner, sw) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + (sw || 2.2) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
const CHEV_S = '<polyline points="15 6 9 12 15 18"/>', CHEV_E = '<polyline points="9 6 15 12 9 18"/>';

/* המצב — בזיכרון בלבד */
const S = {
  err: '', snap: null, snapAt: 0, fc: null, rev: null, revErr: '', seen: new Set(), keys: new Map(),
  months: new Map(), month: '', monthErr: '', filter: 'all', plan: 0, catsAll: false, view: '',
};
export const _S = S;   // לבדיקות

const T = (k, v) => t(k, v);
function h(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function ico(inner, sw) { const s = h('span', 'cf-ic'); s.innerHTML = SVG(inner, sw); return s; }

/* ---------------------------------------------------------------- תצוגת מספרים ותאריכים (טהורות, נבדקות) */
/* "12,345 ₪"; בלי אגורות מעל 100 ₪; שלילי — "מינוס 1,200 ₪" (סימן מינוס קופץ בתצוגה מימין לשמאל) */
export function money(n) {
  if (n == null || !Number.isFinite(+n)) return '—';
  const a = Math.round(Math.abs(+n) * 100) / 100, big = a >= 100;
  const s = a.toLocaleString('en-US', { minimumFractionDigits: big || Number.isInteger(a) ? 0 : 2, maximumFractionDigits: big ? 0 : 2 }) + ' ₪';
  return +n < 0 && a > 0 ? T('cfMinus') + ' ' + s : s;
}
export function dayMonth(d) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(d || '')); return m ? +m[3] + '.' + +m[2] : ''; }
export function monthLabel(m) { const x = /^(\d{4})-(\d{2})$/.exec(String(m || '')); return x ? x[2] + '/' + x[1] : ''; }
export function addMonth(m, d) {
  const x = /^(\d{4})-(\d{2})$/.exec(String(m || '')); if (!x) return '';
  const i = +x[1] * 12 + (+x[2] - 1) + d;
  return Math.floor(i / 12) + '-' + String((i % 12) + 1).padStart(2, '0');
}
export function pct(n) { return (n > 0 ? '+' : '') + Math.round(n) + '%'; }
function timeLabel(ms) {
  const d = new Date(ms); if (!ms || isNaN(d)) return '';
  try { return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem' }); } catch (e) { return ''; }
}
function bidi(txt) { const b = h('bdi', null, txt); return b; }   // שם בית עסק באנגלית בתוך שורה בעברית

/* "יצאו X מתוך Y צפויים" מתוך budget.breakdown של snapshot: צפוי = קבועות + מעקב + משתנות; יצא = מה שכבר ירד.
   trackingExpected − trackingLeft = ההוצאה בפועל במעקב (max(יעד, בפועל) − max(0, יעד − בפועל) = בפועל) */
export function spendProgress(b) {
  if (!b) return null;
  const spent = (+b.fixedExpensesArrived || 0) + ((+b.trackingExpected || 0) - (+b.trackingLeft || 0)) + (+b.variableExpenseSoFar || 0);
  const planned = (+b.expectedFixedExpenses || 0) + (+b.trackingExpected || 0) + (+b.variableExpenseSoFar || 0);
  return { spent: Math.round(spent * 100) / 100, planned: Math.round(planned * 100) / 100, ratio: planned > 0 ? Math.max(0, Math.min(1, spent / planned)) : 0 };
}

/* ---------------------------------------------------------------- השרת */
function apiBase() { return String(((typeof window !== 'undefined' && window.SNB_ENV) || {}).proxy || ''); }
async function api(op, body) {
  const base = apiBase();
  const u = SA && SA.auth && SA.auth.user && SA.auth.user();
  if (!base) throw new Error('no_server');
  if (!u || typeof u.getIdToken !== 'function') throw new Error('signed_out');
  let tk = '';
  try { tk = (typeof window !== 'undefined' && window.snbIdToken ? await window.snbIdToken(u) : await u.getIdToken()); } catch (e) { throw new Error('signed_out'); }   // גל 3: snbIdToken (cloud.js)
  let r;
  try {
    r = await fetch(base + '/api/cashflow', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({}, body || {}, { op, idToken: tk })) });
  } catch (e) { throw new Error('network'); }
  let j = null;
  try { j = await r.json(); } catch (e) { j = null; }
  if (r.status === 404) throw new Error('off');
  if (!j || !j.ok) throw new Error(String((j && j.error) || ('http_' + r.status)));
  return j;
}
const report = (name, args, refresh) => api('report', Object.assign({ name }, args && args.length ? { args } : {}, refresh ? { refresh: true } : {}));

/* הודעת השגיאה לפי הקוד של השרת */
const ERR = {
  off: 'cfErrOff', not_allowed: 'cfErrNotAllowed', wrong_app: 'cfErrNotAllowed', forbidden_origin: 'cfErrNotAllowed', not_connected: 'cfErrNotConnected',
  riseup_token_rejected: 'cfErrToken', network: 'cfErrNetwork', no_server: 'cfErrOff', signed_out: 'cfErrSignedOut', rate: 'cfErrRate', bad_token: 'cfErrSignedOut',
};
export function errKey(code) { return ERR[code] || 'cfErrGeneric'; }

/* ---------------------------------------------------------------- "בדקתי": מפתח של ממצא */
export function findingRaw(month, f) {
  return [month, f.type, f.merchant || '', f.total != null ? f.total : f.amount != null ? f.amount : f.to != null ? f.to : ''].join('|');
}
async function findingKey(month, f) {
  const raw = findingRaw(month, f);
  if (S.keys.has(raw)) return S.keys.get(raw);
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const k = [...new Uint8Array(b)].slice(0, 8).map((x) => x.toString(16).padStart(2, '0')).join('');
  S.keys.set(raw, k);
  return k;
}

/* ---------------------------------------------------------------- הטעינה */
async function loadHome(refresh) {
  try {
    const j = await report('snapshot', [], refresh);
    S.snap = j.report; S.snapAt = j.at || Date.now(); S.err = '';
  } catch (e) { S.err = e.message; }
  paintStatus();
  if (cur === 'home') render();
  if (S.err) return;
  /* ברקע: הנקודה הנמוכה (forecast) והסקירה (monthly-review) — המספר על הכרטיס "לבדוק" */
  report('forecast', [], refresh).then((j) => { S.fc = j.report; }, () => { S.fc = { failed: true }; }).then(() => { if (cur === 'home') render(); });
  loadReview(refresh);
}
async function loadReview(refresh) {
  try {
    const [j, s] = await Promise.all([report('monthly-review', [], refresh), api('seen').catch(() => ({ keys: [] }))]);
    S.rev = j.report; S.revErr = '';
    S.seen = new Set((s && s.keys) || []);
    await Promise.all((S.rev.findings || []).map(async (f) => { f._k = await findingKey(S.rev.month, f); }));
  } catch (e) { S.revErr = e.message; }
  if (cur === 'review' || cur === 'home') render();
}
async function loadMonth(m, refresh) {
  const key = m || '';
  S.monthErr = '';
  try {
    const j = await report('month', m ? ['--month', m] : [], refresh);
    S.months.set(key, j.report);
    if (!m) { S.months.set(j.report.month, j.report); S.month = j.report.month; }
  } catch (e) { S.monthErr = e.message; }
  if (cur === 'month') render();
}

/* ---------------------------------------------------------------- המסגרת */
export function openCashflow(opt) {
  SA = (opt && opt.standalone) || null;
  root = h('div', 'cf-root');
  page = h('div', 'cf-page');
  if (SA && SA.shell) root.append(SA.shell.el);
  root.append(page);
  document.body.append(root);
  if (SA) {
    SA.refresh = refreshNow;
    SA.settings = () => go('settings');
  }
  nav = dialNavBuild('cf-dial', T('cfDialAria'), KEYS.map((k) => ({ k, ico: ICO[k], lbl: T(LBL[k]) })), (k) => go(k));
  document.body.append(nav);
  dialHost(HOST);
  wireDial(nav);
  dialSync(true);
  try { history.replaceState(Object.assign({}, history.state || {}, { cf: 'home' }), ''); } catch (e) {}
  window.addEventListener('popstate', (e) => { const v = e.state && e.state.cf; if (v && v !== cur) show(v, true); });
  window.addEventListener('resize', () => dialSync(true));
  paintStatus();
  render();
  document.documentElement.classList.remove('lib-restoring', 'lib-curtain');
  Promise.resolve(SA && SA.ready).then((st) => { if (st !== 'out') loadHome(false); });
}
const HOST = {
  nav: () => nav, keys: () => KEYS, index: (k) => Math.max(0, KEYS.indexOf(k)), cur: () => (KEYS.includes(cur) ? cur : 'home'),
  begin: () => null, drop() {}, land() {}, instant(to) { go(to); },   // בלי קובייה — הלשונית מתחלפת בחצי הגרירה
};
/* מעבר בין מסכים: הבית = רשומת הדף; כל מסך אחר = רשומה אחת מעליו ("חזור" מחזיר לבית, ומהבית יוצא מהדף) */
function go(v) {
  if (v === cur) return;
  try {
    if (cur === 'home') history.pushState(Object.assign({}, history.state || {}, { cf: v }), '');
    else if (v === 'home') { history.back(); return; }
    else history.replaceState(Object.assign({}, history.state || {}, { cf: v }), '');
  } catch (e) {}
  show(v);
}
function show(v) {
  cur = v;
  nav.hidden = v === 'settings';   // אין הגדרות בחוגה (docs/ui.md)
  dialSync(false, KEYS.includes(v) ? v : 'home');
  render();
  root.scrollTop = 0; window.scrollTo(0, 0);
  if (v === 'review' && !S.rev && !S.revErr && !S.err) loadReview(false);
  if (v === 'month' && !S.months.size && !S.monthErr) loadMonth('', false);
}
async function refreshNow() {
  if (busy) return;
  busy = 1;
  root.classList.add('cf-busy');
  try {
    if (cur === 'month') await loadMonth(S.month, true);
    else if (cur === 'review') await loadReview(true);
    else await loadHome(true);
  } finally { busy = 0; root.classList.remove('cf-busy'); }
}

/* הבועה בהדר: "עודכן" + השעה, או "⚠️ ישן" כשחשבון לא התעדכן יותר מיומיים */
function paintStatus() {
  if (!SA || !SA.shell) return;
  const b = h('button', 'cf-upd'); b.type = 'button';
  const stale = !!(S.snap && (S.snap.staleAccounts || []).length);
  if (stale) b.classList.add('old');
  b.append(h('i'), h('span', null, stale ? T('cfStale') : T('cfUpdated')));
  b.append(h('small', null, S.snapAt ? T('cfTodayAt', { t: timeLabel(S.snapAt) }) : '…'));
  b.addEventListener('click', refreshNow);
  SA.shell.setStatus(b);
}

function render() {
  page.textContent = '';
  page.dataset.v = cur;
  if (cur === 'settings') return renderSettings();
  if (S.err) return page.append(errorCard(S.err));
  if (cur === 'month') return renderMonth();
  if (cur === 'review') return renderReview();
  return renderHome();
}
function card(cls) { return h('div', 'card cf-card' + (cls ? ' ' + cls : '')); }
function head(title, small) { const d = h('div', 'cf-h', title); if (small) d.append(h('small', null, small)); return d; }
function row(name, value, extra) {
  const r = h('div', 'cf-row');
  const n = h('span', 'n'); if (name instanceof Node) n.append(name); else n.textContent = name;
  r.append(n);
  if (extra) r.append(extra);
  if (value != null) r.append(h('span', 'v', value));
  return r;
}
function tag(txt, kind) { return h('span', 'cf-tag' + (kind ? ' ' + kind : ''), txt); }
function skeleton(n) { const w = h('div', 'cf-skel'); for (let i = 0; i < n; i++) w.append(card('cf-sk')); return w; }
function src(txt) { return h('div', 'cf-src', txt); }
function bar(ratio, over) { const b = h('div', 'cf-bar'); const i = h('i', over ? 'over' : ''); i.style.width = Math.round(Math.max(0, Math.min(1, ratio)) * 100) + '%'; b.append(i); return b; }
function errorCard(code) {
  const c = card('cf-err');
  c.append(head(T('cfErrTitle')), h('p', null, T(errKey(code))));
  if (code === 'signed_out' && SA && SA.auth) { const b = h('button', 'btn', T('googleSignIn')); b.type = 'button'; b.addEventListener('click', () => SA.auth.signIn()); c.append(b); }
  else if (code !== 'not_allowed' && code !== 'off') { const b = h('button', 'cf-chk', T('cfRetry')); b.type = 'button'; b.addEventListener('click', refreshNow); c.append(b); }
  return c;
}

/* ---------------------------------------------------------------- בית */
function renderHome() {
  const s = S.snap;
  if (!s) return page.append(skeleton(3));
  const B = s.budget || {}, bd = B.breakdown || {};
  /* הכרטיס הראשי: נשאר החודש, הטבעת (יצאו מתוך צפויים), והיתרה בכל חשבון */
  const hero = card('cf-hero');
  const pr = spendProgress(bd);
  const txt = h('div');
  txt.append(h('div', 'lbl', T('cfLeftMonth') + (B.cashflowMonth ? ' · ' + monthLabel(B.cashflowMonth) : '')), h('div', 'big' + (B.remaining < 0 ? ' cf-loss' : ''), money(B.remaining)));
  if (pr) txt.append(h('div', 'sub', T('cfSpentOf', { a: money(pr.spent), b: money(pr.planned) })));
  hero.append(txt, ring(pr ? pr.ratio : 0));
  const bal = h('div', 'cf-hero-bal');
  for (const a of s.accounts || []) {
    const old = a.daysOld > 2;
    bal.append(row(a.nickname ? bidi(a.nickname) : T('cfAccount'), money(a.balance), tag(old ? T('cfOld', { n: a.daysOld }) : a.daysOld === 0 ? T('cfToday') : T('cfDaysAgo', { n: a.daysOld }), old ? 'warn' : 'ok')));
  }
  if ((s.accounts || []).length > 1) bal.append(row(T('cfTotal'), money(s.totalBalance)));
  hero.append(bal);
  page.append(hero);

  /* נכנס מול צפוי להיכנס · יצא מול צפוי לצאת (קבועות) */
  const flow = card('cf-flow');
  const inA = (+bd.fixedIncomeArrived || 0) + (+bd.variableIncome || 0);
  flow.append(meter(T('cfIncome'), inA, bd.expectedIncome, 'in'), meter(T('cfFixed'), bd.fixedExpensesArrived, bd.expectedFixedExpenses, 'out'));
  page.append(flow);

  /* הנקודה הנמוכה הקרובה (התחזית של רייזאפ — בלי הוצאות משתנות שעוד לא קרו) */
  const fa = S.fc && !S.fc.failed && (S.fc.accounts || [])[0];
  if (fa && fa.path && fa.path.lowest) {
    const low = card('cf-low');
    const t1 = h('div', 't', T('cfLowPoint'));
    const b = h('b', fa.path.lowest.balance < 0 ? 'cf-loss' : '', T('cfLowAt', { a: money(fa.path.lowest.balance), d: dayMonth(fa.path.lowest.date) }));
    t1.append(b);
    low.append(ico('<polyline points="3 7 9 13 13 9 21 17"/><polyline points="15 17 21 17 21 11"/>'), t1, tag(T('cfForecastTag')));
    if (fa.path.firstBelowZero) low.append(h('div', 'cf-note cf-loss', T('cfBelowZero', { d: dayMonth(fa.path.firstBelowZero) })));
    page.append(low);
  }

  /* 3 חריגות מהתכנון */
  const dev = (B.topDeviations || []).slice(0, 3);
  if (dev.length) {
    const c = card();
    c.append(head(T('cfDeviations')));
    for (const d of dev) {
      if (d.kind === 'income-missing') c.append(row(d.name, null, tag(T('cfNotArrived'), 'warn')));
      else if (d.kind === 'income-short') c.append(row(d.name, money(d.diff), h('span', 's', T('cfShort'))));
      else c.append(row(d.name, money(d.diff), h('span', 's', T('cfOver'))));
    }
    page.append(c);
  }

  /* הממצאים לבדיקה (מהסקירה של החודש המלא האחרון) */
  if (S.rev) {
    const open = (S.rev.findings || []).filter((f) => !S.seen.has(f._k)).length;
    const g = h('button', 'card cf-card cf-go'); g.type = 'button';
    g.append(h('span', 'cnt' + (open ? '' : ' zero'), String(open)), h('span', 'gt', open ? T('cfToReview', { m: monthLabel(S.rev.month) }) : T('cfAllReviewed', { m: monthLabel(S.rev.month) })), ico(getLang() === 'he' ? CHEV_S : CHEV_E, 2.4));
    g.addEventListener('click', () => go('review'));
    page.append(g);
  }
  page.append(src(T('cfSource', { m: monthLabel(B.cashflowMonth), t: timeLabel(S.snapAt) })));
}
function ring(ratio) {
  const w = h('div', 'cf-ring');
  const C = 2 * Math.PI * 38;
  w.innerHTML = '<svg viewBox="0 0 92 92" aria-hidden="true"><circle class="bg" cx="46" cy="46" r="38"/><circle class="fg" cx="46" cy="46" r="38" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + (C * (1 - ratio)).toFixed(1) + '"/></svg>';
  const l = h('div', 'rl'); l.append(h('b', null, Math.round(ratio * 100) + '%'), h('small', null, T('cfOut')));
  w.append(l);
  return w;
}
function meter(label, got, expected, kind) {
  const m = h('div', 'cf-meter ' + kind);
  const top = h('div', 'top');
  const a = h('div'); a.append(h('small', null, kind === 'in' ? T('cfGotIn') : T('cfWentOut')), h('b', null, money(got)));
  const b = h('div', 'end'); b.append(h('small', null, kind === 'in' ? T('cfExpIn') : T('cfExpOut')), h('b', null, money(expected)));
  top.append(a, b);
  m.append(h('div', 'lbl', label), top, bar(expected > 0 ? got / expected : 0));
  return m;
}

/* ---------------------------------------------------------------- חודש */
function renderMonth() {
  const M = S.months.get(S.month || '');
  if (S.monthErr) page.append(errorCard(S.monthErr));
  if (!M) { if (!S.monthErr) page.append(skeleton(3)); return; }
  const curM = M.currentCashflowMonth;
  const oldest = addMonth(curM, -11);
  /* בורר החודשים: הקודם מימין (RTL), הבא משמאל; עד החודש הנוכחי (חלקי) ועד 12 חודשים אחורה */
  const pick = h('div', 'cf-mpick');
  const prev = h('button'); prev.type = 'button'; prev.setAttribute('aria-label', T('cfPrevMonth')); prev.innerHTML = SVG(getLang() === 'he' ? CHEV_E : CHEV_S, 2.4);
  const next = h('button'); next.type = 'button'; next.setAttribute('aria-label', T('cfNextMonth')); next.innerHTML = SVG(getLang() === 'he' ? CHEV_S : CHEV_E, 2.4);
  prev.disabled = M.month <= oldest; next.disabled = M.month >= curM;
  prev.addEventListener('click', () => pickMonth(addMonth(M.month, -1)));
  next.addEventListener('click', () => pickMonth(addMonth(M.month, 1)));
  const lab = h('span', 'm', monthLabel(M.month));
  pick.append(prev, lab);
  if (M.isPartialMonth) pick.append(tag(T('cfPartial'), 'pri'));
  pick.append(next);
  page.append(pick);

  const T0 = M.totals || {}, AV = M.averages || {}, bz = M.business;
  const bizTotal = bz && bz.configured ? +bz.total || 0 : 0;
  /* מתג הכל / פרטי / עסק */
  const seg = h('div', 'cf-seg'); seg.setAttribute('role', 'tablist');
  for (const k of ['all', 'private', 'business']) {
    const b = h('button', S.filter === k ? 'on' : '', T(FILTERS[k])); b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', S.filter === k ? 'true' : 'false');
    b.addEventListener('click', () => { S.filter = k; render(); });
    seg.append(b);
  }
  const spend = S.filter === 'business' ? bizTotal : S.filter === 'private' ? (T0.spending || 0) - bizTotal : T0.spending;
  const tiles = h('div', 'cf-tiles');
  const tile = (l, v, avg, loss) => { const c = h('div', 'card cf-tile'); c.append(h('div', 'l', l), h('div', 'v' + (loss ? ' cf-loss' : ''), money(v))); if (avg != null) c.append(h('div', 'd', T('cfAvg', { a: money(avg) }))); return c; };
  if (S.filter === 'business') tiles.append(tile(T('cfBizSpend'), bizTotal, bz && bz.configured ? bz.averageTotal : null), tile(T('cfBizCount'), null, null));
  else {
    const net = (T0.income || 0) - spend;
    tiles.append(tile(T('cfIncome'), T0.income, AV.income), tile(T('cfSpending'), spend, S.filter === 'all' ? AV.spending : null), tile(T('cfNet'), net, null, net < 0));
  }
  if (S.filter === 'business') tiles.lastChild.querySelector('.v').textContent = String(bz && bz.configured ? bz.count : 0);
  page.append(tiles);
  if (S.filter === 'all') {
    if (+T0.savingsTransfers > 0) page.append(row(T('cfSavings'), money(T0.savingsTransfers), null));
    const ch = netChart(M);
    if (ch) page.append(ch);
  }
  page.append(seg);

  if (S.filter === 'business') {
    const c = card();
    c.append(head(bz && bz.name ? bz.name : T('cfFBusiness')));
    if (!bz || !bz.configured) c.append(h('p', 'cf-note', T('cfBizNotSet')));
    else if (!(bz.transactions || []).length) c.append(h('p', 'cf-note', T('cfBizNone')));
    else for (const x of bz.transactions) c.append(row(txLine(x), money(x.amount)));
    page.append(c);
  } else {
    page.append(categoriesCard(M.categories || [], M.averageOf || []));
    if (S.filter === 'private' && bizTotal > 0) page.lastChild.append(h('p', 'cf-note', T('cfPrivNote', { a: money(bizTotal) })));
    if (!(bz && bz.configured) && S.filter === 'private') page.lastChild.append(h('p', 'cf-note', T('cfBizNotSet')));
  }

  /* חיובים גדולים */
  const L = M.largeCharges;
  if (L && (L.top || []).length) {
    const c = card();
    c.append(head(T('cfLarge'), T('cfLargeFrom', { a: money(L.threshold) })));
    for (const x of L.top) c.append(row(txLine(x), money(x.amount)));
    page.append(c);
  }
  /* יעדים: יצא · צפוי לצאת · נשאר להוציא */
  const tr = (M.tracking || []).filter((x) => x.target > 0);
  if (tr.length) {
    const c = card();
    c.append(head(T('cfGoals')));
    for (const x of tr) {
      const it = h('div', 'cf-cat');
      const top = h('div', 'top');
      top.append(h('span', 'n', x.name), h('span', 's' + (x.over >= 1 ? ' cf-loss' : ''), x.over >= 1 ? T('cfOverBy', { a: money(x.over) }) : T('cfLeftToSpend', { a: money(x.left) })));
      it.append(top, bar(x.target > 0 ? x.actual / x.target : 0, x.over >= 1), h('div', 'cf-sub', T('cfOutOf', { a: money(x.actual), b: money(x.target) })));
      c.append(it);
    }
    page.append(c);
  }
  /* מה אם: הוצאה חודשית חדשה (שכירות וסופר) — החישוב בטלפון, מהעודף הממוצע שהמנוע החזיר */
  const su = M.surplus;
  if (su && su.average != null) {
    const c = card('cf-wi');
    c.append(head(T('cfWhatIf'), T('cfWhatIfSub')));
    const val = h('span', 'v', money(S.plan));
    const top = h('div', 'cf-wirow'); top.append(h('span', null, T('cfNewMonthly')), val);
    const rng = h('input', 'cf-range'); rng.type = 'range'; rng.min = '0'; rng.max = '15000'; rng.step = '100'; rng.value = String(S.plan);
    rng.setAttribute('aria-label', T('cfNewMonthly'));
    const now = h('div', 'cf-wirow'); now.append(h('span', null, T('cfSurplusNow')), h('span', 'v', money(su.average)));
    const after = h('div', 'cf-wirow res'); const av = h('span', 'v'); after.append(h('span', null, T('cfAfter')), av);
    const note = h('div', 'cf-note');
    const upd = () => {
      S.plan = +rng.value || 0;
      val.textContent = money(S.plan);
      const a = su.average - S.plan;
      av.textContent = money(a); av.classList.toggle('cf-loss', a < 0);
      note.textContent = T('cfWhatIfNote', { m: monthLabel(M.month), a: money(su.averageWithoutLargeCharges - S.plan) });
    };
    rng.addEventListener('input', upd);
    upd();
    c.append(top, rng, now, after, note);
    page.append(c);
  }
  page.append(src(T('cfSourceMonth', { m: monthLabel(M.month) })));
}
/* נטו מול החודשים הקודמים: עמודות מעל ומתחת לקו האפס, מהישן לחדש (ב־RTL הישן מימין); החודש הנבחר מודגש */
export function netBars(M) {
  const per = ((M.surplus || {}).perMonth || []).filter((x) => x && x.month && Number.isFinite(+x.surplus));
  if (!per.length || !M.totals) return [];
  const out = per.map((x) => ({ month: x.month, net: +x.surplus, sel: false })).concat([{ month: M.month, net: +M.totals.net || 0, sel: true }]);
  return out.sort((a, b) => (a.month < b.month ? -1 : 1));
}
function netChart(M) {
  const L = netBars(M);
  if (L.length < 2) return null;
  const max = Math.max(1, ...L.map((x) => Math.abs(x.net)));
  const c = card('cf-chart');
  c.append(head(T('cfVsMonths')));
  const g = h('div', 'cf-bars');
  for (const x of L) {
    const col = h('div', 'col' + (x.sel ? ' sel' : '') + (x.net < 0 ? ' neg' : ''));
    const up = h('div', 'up'), dn = h('div', 'dn');
    const b = h('i'); b.style.height = Math.max(3, Math.round(Math.abs(x.net) / max * 100)) + '%';
    const v = h('span', 'val'); const vb = h('bdi', null, (x.net > 0 ? '+' : x.net < 0 ? '−' : '') + Math.round(Math.abs(x.net)).toLocaleString('en-US')); vb.dir = 'ltr'; v.append(vb);
    if (x.net < 0) { dn.append(b, v); } else { up.append(v, b); }
    col.append(up, dn, h('span', 'ml', monthLabel(x.month).slice(0, 2)));
    g.append(col);
  }
  c.append(g);
  return c;
}
function pickMonth(m) {
  S.month = m;
  if (!S.months.has(m)) loadMonth(m, false);
  render();
}
function txLine(x) {
  const w = h('span');
  w.append(document.createTextNode(dayMonth(x.billingDate || x.date) + (x.installment ? ' · ' + T('cfInst', { n: x.installment }) : '') + ' · '), bidi(x.merchant || ''));
  return w;
}
function categoriesCard(cats, avgOf) {
  const c = card();
  c.append(head(T('cfCats'), T('cfVsAvg', { n: avgOf.length || 3 })));
  const list = cats.filter((x) => x.amount > 0 || x.average > 0);
  const max = Math.max(1, ...list.map((x) => Math.max(x.amount || 0, x.average || 0)));
  const shown = S.catsAll ? list : list.slice(0, 8);
  for (const x of shown) {
    const it = h('div', 'cf-cat');
    const top = h('div', 'top');
    top.append(h('span', 'n', x.name));
    if (x.notable && x.changePct != null) { const tg = tag('', x.changePct > 0 ? 'warn' : 'ok'); const b = h('bdi', null, pct(x.changePct)); b.dir = 'ltr'; tg.append(b); top.append(tg); }
    top.append(h('span', 'v', money(x.amount)));
    const b = bar(x.amount / max, x.notable && x.changePct > 0);
    if (x.average > 0) { const mk = h('b'); mk.style.insetInlineStart = Math.round(Math.min(1, x.average / max) * 100) + '%'; b.append(mk); }
    it.append(top, b);
    c.append(it);
  }
  if (list.length > 8) { const more = h('button', 'cf-more', S.catsAll ? T('cfLess') : T('cfMore', { n: list.length - 8 })); more.type = 'button'; more.addEventListener('click', () => { S.catsAll = !S.catsAll; render(); }); c.append(more); }
  const lg = h('div', 'cf-legend'); lg.append(h('span', null, T('cfThisMonth')), h('span', 'avg', T('cfAverage')));
  c.append(lg);
  return c;
}

/* ---------------------------------------------------------------- לבדוק */
/* סוג הממצא → [כותרת, "לא ידוע", "צעד הבא"] — מפתחות קבועים (coregen אוסף רק מפתחות שכתובים במלואם) */
const TY = {
  'new-recurring': ['cfTyNewRec', 'cfUNewRec', 'cfNNewRec'], 'new-installments': ['cfTyInst', 'cfUInst', 'cfNInst'],
  'new-subscription-like': ['cfTySub', 'cfUSub', 'cfNSub'], 'new-large': ['cfTyLarge', 'cfULarge', 'cfNLarge'],
  'new-abroad': ['cfTyAbroad', 'cfUAbroad', 'cfNAbroad'], 'price-increase': ['cfTyPrice', 'cfUPrice', 'cfNPrice'],
  duplicate: ['cfTyDup', 'cfUDup', 'cfNDup'], 'double-recurring': ['cfTyDouble', 'cfUDouble', 'cfNDouble'],
  'after-cancellation': ['cfTyCancel', 'cfUCancel', 'cfNCancel'],
};
const tyT = (f, i) => T((TY[f.type] || ['cfTyOther', 'cfUOther', 'cfNOther'])[i]);
const FILTERS = { all: 'cfFAll', private: 'cfFPrivate', business: 'cfFBusiness' };
const KIND = { 'price-increase': 'warn', duplicate: 'warn', 'double-recurring': 'warn', 'after-cancellation': 'warn', 'new-abroad': 'warn' };
function renderReview() {
  const R = S.rev;
  if (S.revErr) return page.append(errorCard(S.revErr));
  if (!R) return page.append(skeleton(2));
  const all = R.findings || [];
  const open = all.filter((f) => !S.seen.has(f._k)), done = all.filter((f) => S.seen.has(f._k));
  const sum = h('div', 'cf-sum');
  sum.append(h('b', null, T('cfFindings', { n: all.length })), document.createTextNode(' ' + T('cfInMonth', { m: monthLabel(R.month) }) + (done.length ? ' · ' + T('cfChecked', { n: done.length }) : '')));
  page.append(sum);
  if (!all.length) { const c = card('cf-empty'); c.append(head(T('cfNoFindings')), h('p', 'cf-note', T('cfNoFindingsSub', { m: monthLabel(R.previousMonth) }))); page.append(c); }
  for (const f of open) page.append(findingCard(f));
  if (done.length) {
    const c = card('cf-done');
    c.append(head(T('cfDone')));
    for (const f of done) {
      const r = row(findingTitle(f), money(findingAmount(f)));
      const u = h('button', 'cf-undo', T('cfUndo')); u.type = 'button'; u.addEventListener('click', () => mark(f, false));
      r.append(u);
      c.append(r);
    }
    page.append(c);
  }
  page.append(src(T('cfSourceReview', { m: monthLabel(R.month), p: monthLabel(R.previousMonth) })));
}
function findingAmount(f) { return f.total != null ? f.total : f.amount != null ? f.amount : f.to; }
function findingMerchant(f) { return f.merchant || ((f.transactions || [])[0] || {}).merchant || ''; }
function findingTitle(f) { const w = h('span'); w.append(document.createTextNode(tyT(f, 0) + ' · '), bidi(findingMerchant(f))); return w; }
function findingCard(f) {
  const c = card('cf-find');
  const hd = h('div', 'hd');
  hd.append(tag(tyT(f, 0), KIND[f.type] || 'pri'));
  if (f.type === 'price-increase' && f.changePct != null) { const v = h('span', 'v'); const b = h('bdi', null, pct(f.changePct)); b.dir = 'ltr'; v.append(b); hd.append(v); }
  else if (f.type === 'duplicate') hd.append(h('span', 'v', T('cfTwice', { a: money(f.amount) })));
  else hd.append(h('span', 'v', money(findingAmount(f))));
  c.append(hd);
  const mer = h('div', 'mer'); mer.append(bidi(findingMerchant(f))); c.append(mer);
  /* שורת הפרטים: תאריכים, מעבר מחיר, תשלומים */
  const tx = f.transactions || [];
  let det = '';
  if (f.type === 'price-increase') det = T('cfFromTo', { a: money(f.from), b: money(f.to) }) + ' · ' + dayMonth((tx[tx.length - 1] || {}).date);
  else if (f.type === 'new-installments') det = T('cfInstDet', { n: f.payments, a: money(f.perPayment) });
  else if (f.type === 'duplicate') det = (f.daysApart === 0 ? T('cfSameDay') : T('cfDaysApart', { n: f.daysApart })) + ' · ' + dayMonth((tx[tx.length - 1] || {}).date);
  else det = tx.slice(0, 3).map((x) => dayMonth(x.billingDate || x.date)).filter(Boolean).join(', ');
  if (det) c.append(h('div', 'tx', det));
  const dl = h('dl');
  for (const [k, v] of [['cfUnknown', tyT(f, 1)], ['cfNext', tyT(f, 2)]]) {
    const d = h('div'); d.append(h('dt', null, T(k) + ' '), h('dd', null, v)); dl.append(d);
  }
  c.append(dl);
  const acts = h('div', 'acts');
  const b = h('button', 'cf-chk'); b.type = 'button';
  b.innerHTML = SVG('<polyline points="5 12.5 10 17 19 7"/>', 2.4);
  b.append(document.createTextNode(T('cfCheckedBtn')));
  b.addEventListener('click', () => mark(f, true));
  acts.append(b);
  c.append(acts);
  return c;
}
async function mark(f, on) {
  if (!f._k) return;
  const before = new Set(S.seen);
  if (on) S.seen.add(f._k); else S.seen.delete(f._k);
  render();
  try { const j = await api('seen', { key: f._k, on }); S.seen = new Set(j.keys || []); }
  catch (e) { S.seen = before; render(); askAlert(T(errKey(e.message))); }
}

/* ---------------------------------------------------------------- הגדרות (מהתפריט ☰ → הגלובוס) */
function renderSettings() {
  const C = SA && SA.cards;
  const bar0 = h('div', 'cf-navbar');
  const back = h('button', 'cf-back'); back.type = 'button';
  back.innerHTML = SVG(getLang() === 'he' ? CHEV_E : CHEV_S, 2.4);
  back.append(document.createTextNode(T('cfTabHome')));
  back.addEventListener('click', () => go('home'));
  bar0.append(back);
  page.append(bar0, h('h1', 'cf-large', T('cfSettings')));
  if (!C) return;
  if (S.view === 'adv') { page.append(...C.advanced()); return; }
  page.append(C.account(), C.display(), C.advRow(() => { S.view = 'adv'; render(); }));
}
