/* מרכז הניהול (שלב 5א, 14/10/2026) — הדף הרביעי, למנהל בלבד. סבב 2 בתוכנית ("מרכז הניהול" במסמך המחקר):
   המעטפת + "לנתח עם Claude" (המטרה הראשית) + מעבדת השיפור על מאגר הלמידה.
   ⛔ הניתוח — Claude שבמנוי של המשתמש בלבד (שיחה ב־claude.ai / סשן Claude Code), אף פעם לא ה־API (tests/learn-claude).
   לפני הקובץ: firebase-config.js, strings-admin.js, core.js, auth.js. בלי Service Worker משלו (נתונים חיים תמיד).
   ההגנה האמיתית בשרתון (isAdmin על כל פעולה); כאן רק מסתירים את המסך ממי שאינו מנהל. */
import { createShell, APP_URL, loginGate, accountCard } from './shell.js';

const de = document.documentElement;
const lang = getLang();
de.lang = lang;
de.dir = lang === 'he' ? 'rtl' : 'ltr';
wireCoreBack();
if (window.SNB_ENV && window.SNB_ENV.name === 'staging') { const s = document.createElement('div'); s.className = 'env-strip'; s.textContent = t('envStaging'); document.body.prepend(s); }
setTimeout(() => de.classList.remove('lib-restoring', 'lib-curtain'), 6000);

// 21/10/2026: למרכז הניהול אין Service Worker — אבל בכתובת הזו נשאר בטלפון אחד ישן של Invest, שהגיש את הדף של Invest
// בכניסה לשורש. כאן מסירים כל Service Worker ומטמון שלו (גם sw.js עצמו מוחק את עצמו בכתובת הזו)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
  if (window.caches) caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
}
const A = window.SnbAuth;
A.start();
const first = await new Promise((res) => { const to = setTimeout(() => res('boot'), 8000); A.onChange((st) => { clearTimeout(to); res(st); }); });
A.onChange((st) => { if (st !== first && (st === 'in' || st === 'out')) location.reload(); });

const h = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const fmt = (s, o) => String(s).replace(/\{(\w+)\}/g, (_, k) => (o[k] != null ? o[k] : ''));
const day = (ms) => (ms ? new Date(ms).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'numeric' }) : '—');

async function api(op, body) {
  const u = A.user();
  if (!u) return { ok: false, error: 'signin' };
  let tk = ''; try { tk = await u.getIdToken(); } catch (e) {}
  try {
    const r = await fetch(ibkrProxyBase() + '/api/studio', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, ibkrProxyHeaders()),
      body: JSON.stringify(Object.assign({}, body || {}, { op, idToken: tk })) });
    const j = await r.json().catch(() => null);
    return j && typeof j === 'object' ? j : { ok: false, error: 'http_' + r.status };
  } catch (e) { return { ok: false, error: 'net' }; }
}
async function copyText(s) {
  try { await navigator.clipboard.writeText(s); flash(t('admCopied')); return true; } catch (e) { flash(t('admCopyFail')); return false; }
}
function download(name, text) {
  const a = h('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' })); a.download = name;
  document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

const shell = createShell({ app: 'admin', title: t('admT'), logo: 'logo-invest.webp', logoLg: 'logo-invest-lg.webp', items: [], onSettings: () => {} });
const root = h('main', 'adm');
const side = h('nav', 'adm-side');
const tabs = h('nav', 'adm-tabs');
const wrap = h('div', 'adm-wrap'); wrap.append(side, root);
document.body.append(shell.el, wrap, tabs);
if (typeof sysCfgBoot === 'function') sysCfgBoot();   // 15/10/2026: הפס של מצב התחזוקה — גם כאן, כדי לזכור לכבות
const done = () => de.classList.remove('lib-restoring', 'lib-curtain');

/* ---------------- הניווט (15/10/2026, התצוגה המקדימה שאושרה) ----------------
   כמו ב־iOS: חמש לשוניות קבועות (בטלפון למטה, במחשב — פס צד), בכל לשונית רשימה קצרה של שורות אינפורמטיביות
   (ערך, מגמה, גרף קטן, שורת מצב אחת), ומשורה נכנסים פנימה (לכל היותר שלוש רמות; "‹" חוזר). מסך שעוד לא נבנה = "בקרוב",
   בלי מספרים מומצאים. כל מסך: { tab, title, parent?, render(p) } */
const TABS = [['ov', () => t('admTabOv'), '◉'], ['apps', () => t('admTabApps'), '▦'], ['sys', () => t('admTabSys'), '⚙'], ['imp', () => t('admTabImp'), '✦'], ['find', () => t('admTabFind'), '⌕']];
const D = { bk: null, fb: null, us: null, ag: null, srv: null, sec: null, log: null, users: null, cfg: null, ov: null, lab: null, ovAt: 0, ai: null, aiAt: 0, tk: null, tkAt: 0, tkOpen: {}, apps: null, appsAt: 0, rd: null, rdAt: 0, dm: undefined };   // הנתונים מהשרתון (adminOv, learn) — נטענים פעם אחת ומתרעננים בחזרה לדף
const PAGES = {};
const page = (k, o) => { PAGES[k] = o; };
let cur = 'ov';
function go(k, push = true) {
  if (!PAGES[k]) k = 'ov';
  cur = k;
  if (push) { try { history.pushState({ adm: k }, '', '#' + k); } catch (e) {} }
  paint();
  try { window.scrollTo(0, 0); } catch (e) {}
}
window.addEventListener('popstate', (e) => { const k = (e.state && e.state.adm) || (location.hash || '#ov').slice(1); cur = PAGES[k] ? k : 'ov'; paint(); });
function badges() {
  const items = (D.ov && D.ov.items) || [];
  const by = { ov: items.filter((x) => x.sev <= 2).length, apps: 0, sys: items.filter((x) => /^(deploy_wait|site_down|srv_off|bk_)/.test(x.k)).length, imp: 0, find: 0 };
  return by;
}
function paintNav() {
  const tab = PAGES[cur].tab, b = badges();
  const mk = (cls) => TABS.map(([k, name, ic]) => {
    const a = h('button', cls + (k === tab ? ' on' : '')); a.type = 'button';
    const i = h('i', null, ic); i.setAttribute('aria-hidden', 'true');
    a.append(i, h('span', null, name()));
    if (b[k]) a.append(h('span', 'adm-bdg', String(b[k])));
    a.addEventListener('click', () => go(k));
    return a;
  });
  tabs.replaceChildren(...mk('adm-tab'));
  side.replaceChildren(h('div', 'adm-sbrand', t('admT')), ...mk('adm-sitem'));
}
function paint() {
  paintNav();
  const P = PAGES[cur];
  const p = h('div', 'adm-page');
  const nb = h('div', 'adm-nb');
  if (P.parent) { const back = h('button', 'adm-back', '‹ ' + PAGES[P.parent].title()); back.type = 'button'; back.addEventListener('click', () => history.length > 1 ? history.back() : go(P.parent)); nb.append(back); }
  p.append(nb, h('h1', 'adm-h1', P.title()));
  P.render(p);
  root.replaceChildren(p);
}

/* ---- אבני בניין: שורה אינפורמטיבית, קבוצה, אריח, גרף קטן ---- */
const COL = { green: '#30D158', orange: '#F5A524', red: '#FF453A', blue: '#0A84FF', purple: '#5E5CE6', gray: '#8E8E93', invest: '#30D158', academy: '#4699FF', studio: '#FF4656' };
function spark(vals, color) {
  const v = (vals || []).filter((x) => typeof x === 'number' && isFinite(x));
  if (v.length < 2) return null;
  const mx = Math.max(...v), mn = Math.min(...v), NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 54 22'); svg.setAttribute('class', 'adm-sp');
  const pl = document.createElementNS(NS, 'polyline');
  pl.setAttribute('points', v.map((x, i) => (i * 54 / (v.length - 1)).toFixed(1) + ',' + (19 - (x - mn) / (mx - mn || 1) * 16).toFixed(1)).join(' '));
  pl.setAttribute('fill', 'none'); pl.setAttribute('stroke', color); pl.setAttribute('stroke-width', '2'); pl.setAttribute('stroke-linecap', 'round'); pl.setAttribute('stroke-linejoin', 'round');
  svg.append(pl);
  return svg;
}
/* o = { c, ic, t, s (מחרוזת או צומת), v, tr, trc ('up'|'dn'|''), sp, badge, meter: [אחוז, 'w'|'x'|''], on } */
function row(o) {
  const r = h(o.on ? 'button' : 'div', 'adm-r'); if (o.on) { r.type = 'button'; r.addEventListener('click', o.on); }
  const ic = h('span', 'adm-ic', o.ic || ''); ic.style.background = COL[o.c] || o.c || COL.gray; ic.setAttribute('aria-hidden', 'true');
  const m = h('span', 'adm-m'), tx = h('span', 'adm-tx');
  tx.append(h('b', null, o.t));
  if (o.s) { const sm = h('small'); if (typeof o.s === 'string') sm.textContent = o.s; else sm.append(o.s); tx.append(sm); }
  if (o.meter) { const mt = h('span', 'adm-mtr'), mi = h('i', o.meter[1] || ''); mi.style.width = Math.max(0, Math.min(100, o.meter[0])) + '%'; mt.append(mi); tx.append(mt); }
  m.append(tx);
  if (o.sp) m.append(o.sp);
  if (o.v != null && o.v !== '') { const vv = h('span', 'adm-val'); vv.append(h('b', null, String(o.v))); if (o.tr) vv.append(h('small', o.trc || '', o.tr)); m.append(vv); }
  if (o.badge) m.append(h('span', 'adm-bdg', String(o.badge)));
  if (o.on) m.append(h('span', 'adm-ch', '‹'));
  r.append(ic, m);
  return r;
}
const list = (...rows) => { const l = h('div', 'adm-list'); l.append(...rows.filter(Boolean)); return l; };
const grp = (txt, link) => { const g = h('div', 'adm-grp'); g.append(h('span', null, txt)); if (link) { const a = h('button', 'adm-link', link[0]); a.type = 'button'; a.addEventListener('click', link[1]); g.append(a); } return g; };
function tileEl(c, k, v, tr, trc, vals) {
  const d = h('div', 'adm-t');
  const kk = h('div', 'adm-tk'); kk.style.color = COL[c]; const dot = h('i'); dot.style.background = COL[c]; kk.append(dot, h('span', null, k));
  const f = h('div', 'adm-tf'); f.append(h('small', trc || '', tr || ''));
  const sp = spark(vals, COL[c]); if (sp) f.append(sp);
  d.append(kk, h('b', null, v), f);
  return d;
}
const tiles = (...t) => { const g = h('div', 'adm-tiles'); g.append(...t.filter(Boolean)); return g; };
const soonRow = (c, ic, title, sub) => row({ c, ic, t: title, s: sub || t('admSoon') });
const ago = (ms) => { if (!ms) return '—'; const m = Math.round((Date.now() - ms) / 60000); return m < 1 ? t('admNow') : m < 60 ? fmt(t('admMinAgo'), { n: m }) : m < 1440 ? fmt(t('admHrAgo'), { n: Math.round(m / 60) }) : fmt(t('admDayAgo'), { n: Math.round(m / 1440) }); };
const pctTxt = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
const usd = (x, d) => (x == null ? '—' : '$' + Number(x).toFixed(d == null ? 2 : d));

/* ---- "מחכה לך": כל קוד מהשרתון → שורה (כותרת, מצב, פעולה). מילולי — לכל קוד טקסט משלו ---- */
function itemRow(x) {
  const v = x.v || {}, c = x.sev === 1 ? 'red' : x.sev === 2 ? 'orange' : 'gray';
  const gh = 'https://github.com/yishaiguedj1/portfolio-pwa';
  const open = (u) => () => { try { window.open(u, '_blank', 'noopener'); } catch (e) {} };
  switch (x.k) {
    case 'deploy_wait': return row({ c: 'orange', ic: '⇪', t: t('admItDeploy'), s: fmt(t('admItDeployS'), { a: ago(v.at) }), on: open(gh + '/actions/runs/' + v.id) });
    case 'site_down': return row({ c, ic: '!', t: t('admItSite'), s: (v.l || []).join(' · ') });
    case 'srv_off': return row({ c, ic: '☁', t: fmt(t('admItSrv'), { n: v.n }), s: fmt(t('admItSrvS'), { a: ago(v.seen) }) });
    case 'bk_none': return row({ c, ic: '⟲', t: t('admItBkNone') });
    case 'bk_stale': return row({ c, ic: '⟲', t: t('admItBkStale'), s: fmt(t('admItLast'), { a: ago(v.at) }) });
    case 'bk_err': return row({ c, ic: '⟲', t: t('admItBkErr'), s: v.e });
    case 'pr_open': { const s = h('bdi', null, v.t || ''); return row({ c: 'orange', ic: '⇄', t: fmt(t('admItPr'), { n: v.n }), s, on: open(gh + '/pull/' + v.n) }); }
    case 'pr_dep': return row({ c: 'gray', ic: '⇡', t: fmt(t('admItDep'), { n: v.n }), on: open(gh + '/pulls') });
    case 'date_ant_key': return row({ c, ic: '⧗', t: t('admItAnt'), s: fmt(t('admItDate'), { d: v.d }), v: v.left, tr: t('admDays') });
    case 'date_brk13f': return row({ c, ic: '⧗', t: t('admItBrk'), s: fmt(t('admItDate'), { d: v.d }), v: v.left, tr: t('admDays') });
    case 'date_sec_txt': return row({ c, ic: '⧗', t: t('admItSec'), s: fmt(t('admItDate'), { d: v.d }), v: v.left, tr: t('admDays') });
    case 'date_drill': return row({ c, ic: '⧗', t: t('admItDrill'), s: fmt(t('admItDate'), { d: v.d }), v: v.left, tr: t('admDays') });
    case 'gold_due': return row({ c: 'orange', ic: '◎', t: t('admItGold'), s: v.r === 'ver' ? t('admItGoldVer') : v.at ? fmt(t('admItLast'), { a: ago(v.at) }) : t('admItGoldNever'), on: () => go('gold') });
    case 'release_due': return row({ c: 'gray', ic: '⇪', t: t('admItRel'), s: fmt(t('admItRelS'), { p: v.p, s: v.s }) });
    default: return null;
  }
}
function runRow(x) {
  const v = x.v || {}, c = x.ok ? 'green' : 'orange';
  switch (x.k) {
    case 'prod': return row({ c, ic: '◉', t: t('admRunProd'), s: v.b ? fmt(t('admRunBuild'), { b: v.b }) + (v.tag ? ' · ' + v.tag : '') : t('admUnknown') });
    case 'stag': return row({ c, ic: '⚗', t: t('admRunStag'), s: v.b ? fmt(t('admRunBuild'), { b: v.b }) + (v.ahead === 1 ? ' · ' + t('admRunAhead1') : v.ahead > 1 ? ' · ' + fmt(t('admRunAhead'), { n: v.ahead }) : '') : t('admUnknown') });
    case 'srv': return row({ c: v.paused ? 'gray' : c, ic: '☁', t: v.n, s: v.paused ? t('admRunPaused') : fmt(t('admItLast'), { a: ago(v.seen) }) });
    case 'backup': return row({ c, ic: '⟲', t: t('admRunBk'), s: v.at ? fmt(t('admItLast'), { a: ago(v.at) }) : t('admItBkNone') });
    case 'sites': return row({ c, ic: '◎', t: t('admRunSites'), s: (v.down || []).length ? (v.down || []).join(' · ') : t('admRunSitesOk') });
    default: return null;
  }
}

/* ---------------- המסכים ---------------- */
page('ov', { tab: 'ov', title: () => t('admTabOv'), render(p) {
  const o = D.ov, v = D.lab && D.lab.view;
  p.append(h('p', 'adm-dt', new Date().toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }) + (D.ovAt ? ' · ' + fmt(t('admUpdated'), { a: ago(D.ovAt) }) : '')));
  if (!o) { p.append(h('p', 'adm-note', t('admErr'))); return; }
  const items = o.items.map(itemRow).filter(Boolean);
  p.append(grp(items.length ? fmt(t('admWaitN'), { n: items.length }) : t('admWait0')), items.length ? list(...items) : list(row({ c: 'green', ic: '✓', t: t('admAllGood') })));
  if (!D.tk) needTasks();
  const ck = (D.tk && D.tk.ck && D.tk.ck.open) || [];
  if (ck.length) p.append(grp(fmt(t('admChkN'), { n: ck.length }), ck.length > 3 ? [t('studioSeeAll'), () => go('checks')] : null), list(...ck.slice(0, 3).map(checkRow)));
  if (v && v.k) {
    const wk = v.wk || [];
    p.append(grp(t('admSec30')), tiles(
      tileEl('purple', t('admKn'), String(v.k.n || 0), v.kp && v.kp.n != null ? fmt(t('admPrev'), { n: v.kp.n }) : '', '', wk.map((x) => x.n)),
      tileEl('green', t('admKok'), pctTxt(v.k.ok), '', '', wk.map((x) => x.ok)),
      tileEl('orange', t('admKcpm'), usd(v.k.cpm, 3), '', '', wk.map((x) => x.cpm)),
      tileEl('green', t('admKjd'), v.k.jd == null ? '—' : String(Math.round(v.k.jd)), '', '', wk.map((x) => x.jd))));
  }
  p.append(grp(t('admSecRun')), list(...o.run.map(runRow).filter(Boolean)));
} });
page('apps', { tab: 'apps', title: () => t('admTabApps'), render(p) {
  const v = D.lab && D.lab.view, k = v && v.k;
  const A2 = D.apps;
  if (!A2) needApps();
  if (!D.us) needUsage();
  if (!D.fb) needFb();
  if (!D.cfg) needCfg();
  const iv = A2 && A2.invest, ac = A2 && A2.academy;
  p.append(list(
    row({ c: 'invest', ic: '↗', t: 'Invest', s: iv && iv.users != null ? fmt(t('admAppInvestS2'), { n: iv.users, i: iv.ibkr == null ? '—' : iv.ibkr }) : t('admLoading'), on: () => go('invest') }),
    row({ c: 'academy', ic: '▤', t: 'Academy', s: ac && ac.cat ? fmt(t('admAppAcademyS2'), { n: ac.cat.pub, r: ac.readers == null ? '—' : ac.readers }) : A2 ? t('admUnknown') : t('admLoading'), on: () => go('academy') }),
    row({ c: 'studio', ic: '▶', t: 'Studio', s: k ? fmt(t('admAppStudioS'), { n: k.n || 0, c: usd(k.cpm, 3) }) : t('admSoon'), v: k && k.ok != null ? pctTxt(k.ok) : '', tr: k && k.ok != null ? t('admKok') : '', sp: v ? spark((v.wk || []).map((x) => x.n), COL.studio) : null, on: () => go('studio') })));
  p.append(grp(t('admSecShared')), list(row({ c: 'gray', ic: '👥', t: t('admUsers'), s: A2 && A2.invest.users != null ? fmt(t('admUsersS'), { n: A2.invest.users, s: A2.shared.sess == null ? '—' : A2.shared.sess }) : t('admLoading'), on: () => go('users') }), row({ c: 'blue', ic: '∑', t: t('admUsage'), s: D.us && D.us.jobs ? fmt(t('admUsS'), { n: D.us.jobs.n }) : '', on: () => go('usage') }), row({ c: 'orange', ic: '✉', t: t('admFeedback'), s: D.fb ? (D.fb.open ? fmt(t('admFbOpenN'), { n: D.fb.open }) : t('admFbNone')) : '', badge: D.fb ? D.fb.open : 0, on: () => go('feedback') }), row({ c: 'purple', ic: '📣', t: t('admMsgs'), s: D.cfg && D.cfg.an ? t('admAnOn') : t('admAnOffS'), on: () => go('news') })));
} });
/* ---- Invest ו־Academy (15/10/2026): מספרים בלבד מהשרתון (adminApps — ספירות ב־Firestore והקטלוג ב־R2). לא נמדד = "—" ---- */
async function needApps() {
  if (D.apps && Date.now() - D.appsAt < 60000) return;
  const r = await api('adminApps');
  if (r.ok) { D.apps = r.apps; D.appsAt = Date.now(); if (['apps', 'invest', 'academy'].includes(cur)) paint(); }
}
const nn = (x) => (x == null ? '—' : String(x));
const openApp = (k) => () => { try { window.open(APP_URL[k], '_self'); } catch (e) {} };
page('invest', { tab: 'apps', parent: 'apps', title: () => 'Invest', render(p) {
  const a = D.apps;
  if (!a) { needApps(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const iv = a.invest;
  p.append(tiles(tileEl('invest', t('admInvUsers'), nn(iv.users), '', '', []), tileEl('red', t('admInvIbkr'), nn(iv.ibkr), iv.users && iv.ibkr != null ? Math.round(iv.ibkr / iv.users * 100) + '%' : '', '', [])));
  p.append(grp(t('admSecData')), list(
    row({ c: 'red', ic: '⟲', t: t('admInvIbkrT'), s: t('admInvIbkrS'), v: nn(iv.ibkr) })));
  p.append(list(row({ c: 'invest', ic: '↗', t: t('admOpenApp'), on: openApp('invest') })));
} });
page('academy', { tab: 'apps', parent: 'apps', title: () => 'Academy', render(p) {
  const a = D.apps;
  if (!a) { needApps(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  if (!D.ai) needAi();
  const ac = a.academy, c = ac.cat;
  if (c) p.append(h('p', 'adm-dt', fmt(t('admAcUpd'), { a: ago(c.at) }) + (c.ch7 ? ' · ' + fmt(t('admAcCh7'), { n: c.ch7 }) : '')));
  p.append(tiles(tileEl('academy', t('admAcPub'), c ? String(c.pub) : '—', c && c.draft ? fmt(t('admAcDraft'), { n: c.draft }) : '', '', []),
    tileEl('purple', t('admAcReaders'), nn(ac.readers), '', '', []),
    tileEl('green', t('admAcBackup'), nn(ac.backup), '', '', []),
    tileEl('blue', t('admAiCalls'), D.ai ? String(D.ai.today.t) : '—', D.ai ? t('admToday') : '', '', D.ai ? D.ai.days.map((x) => x.t) : [])));
  if (c) {
    const fm = Object.entries(c.fm || {}).sort((x, y) => y[1] - x[1]).map(([k, v]) => k.toUpperCase() + ' ' + v).join(' · ');
    p.append(grp(t('admAcSecCat')), list(
      row({ c: c.noCover ? 'orange' : 'green', ic: '▣', t: t('admAcNoCover'), v: c.noCover }),
      c.hide ? row({ c: 'gray', ic: '◌', t: t('admAcHide'), v: c.hide }) : null,
      c.del ? row({ c: 'gray', ic: '⌫', t: t('admAcDel'), s: t('admAcDelS'), v: c.del }) : null,
      row({ c: 'gray', ic: '▤', t: t('admAcFiles'), s: fm || '—', v: '\u2066' + c.mb + ' MB\u2069' }),
      row({ c: c.src === 'r2' ? 'green' : 'orange', ic: '☁', t: t('admAcSrc'), s: c.src === 'r2' ? 'Cloudflare R2' : 'Google Drive' })));
  } else p.append(h('p', 'adm-note', t('admAcNoCat')));
  p.append(list(row({ c: 'academy', ic: '↗', t: t('admAcManage'), on: openApp('academy') }), row({ c: 'orange', ic: '$', t: t('admAiCost'), on: () => go('ai') })));
} });
page('studio', { tab: 'apps', parent: 'apps', title: () => 'Studio', render(p) {
  if (!D.ag) needAg();
  if (!D.srv) needSrv();
  const v = D.lab && D.lab.view;
  p.append(h('p', 'adm-dt', t('admLab30')));
  if (v && v.k) {
    const wk = v.wk || [];
    p.append(tiles(
      tileEl('green', t('admKok'), pctTxt(v.k.ok), '', '', wk.map((x) => x.ok)),
      tileEl('purple', t('admKcpm'), usd(v.k.cpm, 3), '', '', wk.map((x) => x.cpm)),
      tileEl('orange', t('admKch'), pctTxt(v.k.ch), '', '', []),
      tileEl('green', t('admKjd'), v.k.jd == null ? '—' : String(Math.round(v.k.jd)), '', '', wk.map((x) => x.jd))));
  }
  p.append(grp(t('admSecStudioTower')), list(
    row({ c: 'red', ic: '!', t: t('admStudioTower'), s: t('admStudioTowerS'), on: () => { try { window.open(APP_URL.studio, '_self'); } catch (e) {} } }),
    row({ c: 'purple', ic: '✦', t: t('admStudioAgents'), s: D.ag ? fmt(t('admAgDt'), { n: D.ag.ag.jobs }) : '', on: () => go('agents') }),
    row({ c: !D.srv ? 'blue' : D.srv.warn ? 'orange' : 'green', ic: '☁', t: t('admStudioSrv'), s: D.srv ? fmt(t('admSvS'), { n: D.srv.online, m: D.srv.servers.length }) : '', badge: D.srv ? D.srv.warn : 0, on: () => go('servers') })));
  p.append(grp(t('admLabT')), list(row({ c: 'purple', ic: '✦', t: t('admLabT'), s: v ? fmt(t('admLabS'), { n: v.n || 0 }) : '', on: () => go('lab') })));
} });
page('sys', { tab: 'sys', title: () => t('admTabSys'), render(p) {
  const o = D.ov, run = (o && o.run) || [];
  const dep = o ? o.items.find((x) => x.k === 'deploy_wait') : null;
  const prod = run.find((x) => x.k === 'prod'), stag = run.find((x) => x.k === 'stag');
  const ai = D.ai, k = D.lab && D.lab.view && D.lab.view.k;
  if (!ai) needAi();
  if (!D.rd) needReady();
  p.append(list(
    row({ c: 'orange', ic: '$', t: t('admAiCost'), s: ai && ai.month ? fmt(t('admAiCostS'), { u: usd(ai.month.usd), n: ai.today.t }) : k ? fmt(t('admAiCostS2'), { u: usd(k.usd) }) : '', badge: ai ? ai.warn.filter((w) => w.sev <= 2).length : 0, on: () => go('ai') }),
    row({ c: 'blue', ic: '▦', t: t('admMonRow'), s: t('admMonRowS'), on: () => go('mon') }),
    row({ c: 'blue', ic: '%', t: t('admQuota'), s: o && o.dates && o.dates[0] ? fmt(t('admQuotaS'), { n: o.dates[0].left }) : '', on: () => go('quota') }),
    row({ c: !D.rd ? 'gray' : D.rd.pass === D.rd.n ? 'green' : D.rd.checks[0].sev === 1 ? 'red' : 'orange', ic: '✓', t: t('admRdT'), s: D.rd ? fmt(t('admRdS'), { p: D.rd.pass, n: D.rd.n }) : t('admLoading'), badge: D.rd ? D.rd.n - D.rd.pass : 0, on: () => go('ready') }),
    row({ c: !D.bk ? 'gray' : D.bk.warn.length ? 'orange' : 'green', ic: '⟲', t: t('admBkT'), s: !D.bk ? t('admLoading') : D.bk.warn.length ? fmt(t('admBkWarnN'), { n: D.bk.warn.length }) : fmt(t('admBkOkS'), { d: D.bk.r2 && D.bk.r2.last ? D.bk.r2.last.split('-').reverse().slice(0, 2).join('/') : '—' }), badge: D.bk ? D.bk.warn.filter((w) => /none|err/.test(w)).length : 0, on: () => go('backups') }),
    row({ c: !D.push ? 'gray' : D.push.n && D.push.me ? 'green' : 'orange', ic: '◉', t: t('admPushT'), s: !D.push ? '' : !D.push.n ? t('admPushOffS') : !D.push.me ? t('admPushNotMe') : fmt(t('admPushOnS'), { n: D.push.n }), on: () => go('push') }),
    row({ c: dep ? 'orange' : 'green', ic: '⇪', t: t('admInfra'), s: dep ? t('admItDeploy') : prod && prod.v.b ? fmt(t('admRunBuild'), { b: prod.v.b }) + (stag && stag.v.ahead === 1 ? ' · ' + t('admRunAhead1') : stag && stag.v.ahead > 1 ? ' · ' + fmt(t('admRunAhead'), { n: stag.v.ahead }) : '') : '', badge: dep ? 1 : 0, on: () => go('infra') })));
  if (!D.cfg) needCfg();
  const cf = D.cfg, mOn = !!(cf && cf.m), nOff = cf ? cf.flags.filter((f) => !f.on).length : 0;
  p.append(grp(t('admSecCtl')), list(
    row({ c: mOn ? 'red' : 'gray', ic: '⏻', t: t('admMaint'), s: !cf ? t('admLoading') : mOn ? t('admMaintOn') + (cf.m.msg ? ' · ' + cf.m.msg : '') : t('admMaintOffS'), badge: mOn ? 1 : 0, on: () => go('maint') }),
    row({ c: nOff ? 'orange' : 'green', ic: '⚙', t: t('admCfg'), s: !cf ? t('admLoading') : nOff ? fmt(t('admFlagsOffN'), { n: nOff }) : t('admFlagsAll'), on: () => go('flags') }),
    row({ c: 'studio', ic: '✦', t: t('admModels'), s: !cf ? t('admLoading') : cf.am && cf.am.length ? fmt(t('admModelsN'), { n: cf.am.length }) : t('admModelsMe'), on: () => go('models') })));
  if (!D.log) needLog();
  if (!D.sec) needSec();
  if (!D.bk) needBk();
  const lg = D.log;
  p.append(grp(t('admSecSec')), list(row({ c: 'green', ic: '☰', t: t('admLogT'), s: !lg ? t('admLoading') : lg.items.length ? fmt(t('admLogS'), { n: lg.n7, a: ago(lg.items[0].at) }) : t('admLogNone'), on: () => go('log') }), row({ c: !D.sec ? 'gray' : D.sec.bad ? 'orange' : 'green', ic: '⚿', t: t('admSecrets'), s: !D.sec ? t('admLoading') : D.sec.bad ? fmt(t('admScBadN'), { n: D.sec.bad }) : fmt(t('admScOkS'), { n: D.sec.dates[0] ? D.sec.dates[0].left : '—' }), badge: D.sec ? D.sec.items.filter((x) => x.sev === 1).length : 0, on: () => go('secrets') })));
} });
/* ---- משתמשים והרשאות (15/10/2026, מסך 3 בתוכנית 5א): מי מורשה לאן. נערך כאן רק מה שהשרתון שומר (קוראי Academy);
   "כל המודלים" ב־Studio — במסך המודלים (בלי כפילות); מה שבמשתני Vercel — מוצג עם מנעול, משתנה שם ---- */
async function needUsers(set) {
  const r = await api('adminUsers', set ? { set } : {});
  if (set) D.log = null;
  if (r.ok) { D.users = r.users; if (cur === 'users') paint(); }
  return r;
}
function emRow(e, sub, del) {
  const r = h('div', 'ios-row adm-trow');
  const tx = h('span', 'adm-ttx'); const b = h('b'); b.append(h('bdi', null, e)); b.style.overflowWrap = 'anywhere'; tx.append(b);
  if (sub) tx.append(h('small', null, sub));
  r.append(tx);
  if (del) { const d = h('button', 'mini-btn danger', t('admModelsDel')); d.type = 'button'; d.addEventListener('click', del); r.append(d); }
  return r;
}
const iosList = (rows) => { const l = h('div', 'ios-list'); l.append(...rows); return l; };
page('users', { tab: 'apps', parent: 'apps', title: () => t('admUsersT'), render(p) {
  const U = D.users;
  if (!U) { needUsers(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const env = t('admUsEnv');
  p.append(h('div', 'adm-lbl', t('admUsAdmins')), iosList(U.admins.length ? U.admins.map((e) => emRow(e, env)) : [h('div', 'ios-row adm-dim', '—')]));
  // Academy: מי קורא את המדף של THE SNOWBALL
  p.append(grp('Academy'));
  const card = h('section', 'card adm-card');
  card.append(h('p', 'adm-sub', U.ac.open ? t('admUsAcOpen') : t('admUsAcSub')));
  if (U.ac.store === 'ok') {
    const inp = h('input', 'adm-search'); inp.type = 'email'; inp.placeholder = t('admModelsPh'); inp.setAttribute('aria-label', t('admModelsPh')); inp.dir = 'ltr'; inp.autocomplete = 'off';
    const add = h('button', 'btn', t('admModelsAdd')); add.type = 'button';
    const doAdd = async () => {
      const e = inp.value.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { flash(t('admModelsBad')); return; }
      add.disabled = true; const r = await needUsers({ k: 'ac', email: e, on: true }); add.disabled = false;
      flash(r.ok ? t('admSaved') : t('admErr'));
    };
    add.addEventListener('click', doAdd);
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doAdd(); });
    const br = h('div', 'btn-row'); br.append(add);
    card.append(inp, br);
  } else card.append(h('p', 'adm-note', t('admUsAcNoStore')));
  const acRows = U.ac.env.map((e) => emRow(e, env)).concat(U.ac.app.map((x) => emRow(x.e, fmt(t('admUsAdded'), { d: day(x.at) }),
    () => askConfirm(fmt(t('admUsAcDelQ'), { e: x.e }), async () => { const r = await needUsers({ k: 'ac', email: x.e, on: false }); flash(r.ok ? t('admSaved') : t('admErr')); }, { danger: true, ok: t('admModelsDel') }))));
  p.append(card, h('div', 'adm-lbl', fmt(t('admUsReaders'), { n: U.ac.env.length + U.ac.app.length })), iosList(acRows.length ? acRows : [h('div', 'ios-row adm-dim', U.ac.open ? t('admUsAcOpenRow') : '—')]));
  // Studio: STUDIO_USERS + מי שברשימת "כל המודלים" (מקבל גם את הסטודיו)
  p.append(grp('Studio'), list(
    row({ c: 'studio', ic: '▶', t: t('admUsStEnv'), s: U.st.env.length ? U.st.env.join(' · ') : t('admUsNone'), v: U.st.env.length || '', tr: U.st.env.length ? env : '' }),
    row({ c: 'studio', ic: '✦', t: t('admModels'), s: U.st.am.length ? U.st.am.join(' · ') : t('admModelsMe'), v: U.st.am.length || '', on: () => go('models') }),
    U.st.conn != null ? row({ c: 'gray', ic: '☁', t: t('admUsStConn'), v: U.st.conn }) : null));
  // IBKR: הסנכרון ברקע — המנהל + IBKR_SYNC_USERS
  p.append(grp(t('admUsIb')), list(
    row({ c: 'invest', ic: '⟳', t: t('admUsIbEnv'), s: U.ib.env.length ? U.ib.env.join(' · ') : t('admUsIbMe'), v: U.ib.env.length || '', tr: U.ib.env.length ? env : '' }),
    U.ib.on != null ? row({ c: 'gray', ic: '◉', t: t('admUsIbOn'), v: U.ib.on }) : null));
  p.append(h('p', 'adm-foot', t('admUsFoot')));
} });
/* ---- יומן פעולות (15/10/2026, מסך 6 בתוכנית 5א): מה שונה ממרכז הניהול, מי ומתי. נרשם בשרתון (sysLog), 90 יום ---- */
async function needLog() {
  const r = await api('adminLog');
  if (r.ok) { D.log = r.log; if (['log', 'sys'].includes(cur)) paint(); }
}
const FLN = (k) => (FL[k] ? FL[k][0]() : k);
function logRow(x) {
  const d = x.d || '';
  const L = {
    mt_on: ['red', '⏻', t('admLgMtOn'), d], mt_upd: ['orange', '⏻', t('admLgMtUpd'), d], mt_off: ['green', '⏻', t('admLgMtOff'), ''],
    fl_on: ['green', '⚙', fmt(t('admLgFlOn'), { n: FLN(d) }), ''], fl_off: ['orange', '⚙', fmt(t('admLgFlOff'), { n: FLN(d) }), ''],
    am_add: ['studio', '✦', t('admLgAmAdd'), d], am_del: ['gray', '✦', t('admLgAmDel'), d],
    ac_add: ['academy', '▤', t('admLgAcAdd'), d], ac_del: ['gray', '▤', t('admLgAcDel'), d],
    srv_pause: ['orange', '☁', t('admLgSrvPause'), d], srv_resume: ['green', '☁', t('admLgSrvResume'), d], srv_del: ['red', '☁', t('admLgSrvDel'), d],
    an_on: ['purple', '📣', t('admLgAnOn'), d], an_off: ['gray', '📣', t('admLgAnOff'), ''], fb_done: ['green', '✉', t('admLgFbDone'), ''], fb_del: ['gray', '✉', t('admLgFbDel'), ''],
    ck_ok: ['green', '✓', t('admLgCkOk'), d], ck_no: ['red', '✕', t('admLgCkNo'), d], ck_clr: ['gray', '↺', t('admLgCkClr'), d] }[x.k];
  if (!L) return null;
  const sub = h('span');
  if (L[3]) sub.append(h('bdi', null, L[3]));
  if (x.w) { if (L[3]) sub.append(' · '); sub.append(h('bdi', null, x.w)); }
  return row({ c: L[0], ic: L[1], t: L[2], s: sub.childNodes.length ? sub : '', v: clock(x.at) });
}
page('log', { tab: 'sys', parent: 'sys', title: () => t('admLogT'), render(p) {
  const lg = D.log;
  if (!lg) { needLog(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  if (!lg.items.length) { p.append(list(row({ c: 'gray', ic: '☰', t: t('admLogNone') })), h('p', 'adm-foot', fmt(t('admLogFoot'), { n: lg.days }))); return; }
  const dk = (ms) => new Date(ms).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { timeZone: 'Asia/Jerusalem', weekday: 'long', day: 'numeric', month: 'numeric' });
  let g = null, rows = [];
  const flush = () => { if (rows.length) p.append(grp(g), list(...rows)); rows = []; };
  for (const x of lg.items) { const k = dk(x.at); if (k !== g) { flush(); g = k; } rows.push(logRow(x)); }
  flush();
  p.append(h('p', 'adm-foot', fmt(t('admLogFoot'), { n: lg.days })));
} });
/* ---- סודות ותאריכים (15/10/2026): הקטלוג של SECURITY.md — רק "מוגדר / חסר", אף פעם לא ערך. נגיעה = מה הוא פותח ואיך מחליפים ---- */
async function needSec() {
  const r = await api('adminSecrets');
  if (r.ok) { D.sec = r.sec; if (['secrets', 'sys'].includes(cur)) paint(); }
}
const SC = {
  sa: () => [t('admScSa'), t('admScSaS'), t('admScSaR')], vault: () => [t('admScVault'), t('admScVaultS'), t('admScVaultR')],
  gd_lib: () => [t('admScGdLib'), t('admScGdLibS'), t('admScGdR')], gd_st: () => [t('admScGdSt'), t('admScGdStS'), t('admScGdR')],
  r2: () => [t('admScR2'), t('admScR2S'), t('admScR2R')], r2l: () => [t('admScR2l'), t('admScR2lS'), t('admScR2R')],
  gemini: () => ['Gemini', t('admScGemS'), t('admScKeyR')], mistral: () => ['Mistral', t('admScMisS'), t('admScKeyR')],
  books: () => ['Google Books', t('admScBooksS'), t('admScKeyR')], picker: () => [t('admScPicker'), t('admScPickerS'), t('admScKeyR')],
  cron: () => [t('admScCron'), t('admScCronS'), t('admScRandR')], watch: () => [t('admScWatch'), t('admScWatchS'), t('admScRandR')],
  gh: () => [t('admScGh'), t('admScGhS'), t('admScGhR')], sess: () => [t('admScSess'), t('admScSessS'), t('admScSessR')],
  ant: () => [t('admScAnt'), t('admScAntS'), t('admScAntR')], apk: () => [t('admScApk'), t('admScApkS'), t('admScApkR')],
  srv_tok: () => [t('admScSrvTok'), t('admScSrvTokS'), t('admScSrvTokR')], ibkr: () => ['IBKR', t('admScIbkrS'), t('admScIbkrR')],
  routine: () => ['Routine', t('admScRtS'), t('admScRtR')] };
const WHERE = { vercel: () => t('admScWVercel'), srv: () => t('admScWSrv'), gh: () => 'GitHub Secrets', worker: () => t('admScWWorker'), vault: () => t('admScWVault') };
function secRow(x) {
  const L = SC[x.k] && SC[x.k]();
  if (!L) return null;
  const st = x.n != null ? fmt(t('admScUsers'), { n: x.n }) : x.set === true ? t('admScSet') : x.set === false ? (x.part ? fmt(t('admScPart'), { p: x.part }) : x.r === 3 ? t('admScOpt') : t('admScMissing')) : '—';
  const c = x.sev === 1 ? 'red' : x.sev === 2 ? 'orange' : x.set === true ? 'green' : 'gray';
  const sub = x.date ? fmt(t('admScUntil'), { d: x.date.d.split('-').reverse().join('/'), n: x.date.left }) : L[1];
  return row({ c, ic: x.set === true ? '✓' : x.set === false ? (x.sev <= 2 ? '!' : '○') : '⚿', t: L[0], s: sub, v: st,
    on: () => askAlert(L[0] + '\n\n' + L[1] + '\n\n' + t('admScHow') + ' ' + L[2]) });
}
page('secrets', { tab: 'sys', parent: 'sys', title: () => t('admSecrets'), render(p) {
  const S2 = D.sec;
  if (!S2) { needSec(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  p.append(h('p', 'adm-dt', (S2.bad ? fmt(t('admScBadN'), { n: S2.bad }) : t('admScAllOk')) + ' · ' + (S2.host === 'srv' ? t('admScFromSrv') : t('admScFromVercel'))));
  p.append(grp(t('admSecDates')), list(...S2.dates.map((d) => row({ c: d.left <= 14 ? 'orange' : 'gray', ic: '⧗', t: (RD_DN[d.k] || (() => d.k))(), s: d.d.split('-').reverse().join('/'), v: d.left, tr: t('admDays') }))));
  const bad = S2.items.filter((x) => x.sev <= 2);
  if (bad.length) p.append(grp(t('admScNeed')), list(...bad.map(secRow)));
  for (const w of ['vercel', 'srv', 'worker', 'gh', 'vault']) {
    const its = S2.items.filter((x) => x.w === w && x.sev > 2);
    if (its.length) p.append(grp(WHERE[w]()), list(...its.map(secRow)));
  }
  p.append(h('p', 'adm-foot', t('admScFoot')));
} });
/* ---- Studio: סוכנים ומודלים, שרתים ומשאבים (15/10/2026). של כל המערכת (30 יום, כל המשתמשים) — המגדל בסטודיו נשאר לעבודות שלי.
   מספרים מצטברים בלבד מהשרתון (adminAgents/adminServers) ---- */
async function needAg() {
  const r = await api('adminAgents');
  if (r.ok) { D.ag = { ag: r.ag, md: r.md }; if (['agents', 'studio'].includes(cur)) paint(); }
}
async function needSrv() {
  const r = await api('adminServers');
  if (r.ok) { D.srv = r.srv; if (['servers', 'studio'].includes(cur)) paint(); }
}
page('agents', { tab: 'apps', parent: 'studio', title: () => t('admStudioAgents'), render(p) {
  const G = D.ag;
  if (!G) { needAg(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  p.append(h('p', 'adm-dt', fmt(t('admAgDt'), { n: G.ag.jobs })));
  const ag = G.ag.agents || [];
  if (ag.length) p.append(grp(t('admAgSec')), list(...ag.map((a) => {
    const sub = h('span'); if (a.m) sub.append(h('bdi', null, a.m), ' · '); sub.append((a.ef || '—') + ' · ' + fmt(t('admAgJobs'), { n: a.jobs, u: usd(a.usd) }));
    return row({ c: a.sc == null ? 'gray' : a.sc >= 80 ? 'green' : a.sc >= 60 ? 'orange' : 'red', ic: '◇', t: (ROLE[a.k] || (() => a.k))(), s: sub, v: a.sc == null ? '—' : a.sc, tr: t('admAgScore') });
  })));
  else p.append(list(row({ c: 'gray', ic: '◇', t: t('admAgNone') })));
  p.append(grp(t('admAgModes'), [t('admModels'), () => go('models')]), list(...G.md.modes.map((m) => row({ c: m.pub ? 'studio' : 'gray', ic: m.def ? '★' : '◎', t: modeName(m.m),
    s: [m.pub ? t('admAgPub') : t('admAgList'), fmt(t('admAgN'), { n: m.n }), m.ok == null ? '' : pctTxt(m.ok)].filter(Boolean).join(' · '),
    v: m.pha == null ? '' : usd(m.pha), tr: m.pha == null ? '' : t('admAgPerHr') }))));
  const RK = { inj: () => t('admAgRInj'), cost: () => t('admAgRCost'), loop: () => t('admAgRLoop') };
  p.append(grp(t('admAgRisk')), list(...(G.ag.risk || []).map((r) => row({ c: r.n ? 'orange' : 'green', ic: r.st === 's' ? '⏹' : '⚑', t: (RK[r.r] || (() => r.r))(), s: r.st === 's' ? t('admAgStop') : t('admAgMark'), v: r.n }))));
  p.append(h('p', 'adm-foot', t('admAgFoot')));
} });
const SV_EV = { up: () => t('studioSrvEvUp'), job: () => t('studioSrvEvJob'), done: () => t('studioSrvEvDone'), fail: () => t('studioSrvEvFail'), stop: () => t('studioSrvEvStop'),
  oom: () => t('studioSrvEvOom'), timeout: () => t('studioSrvEvTimeout'), crash: () => t('studioSrvEvCrash'), auth: () => t('studioSrvEvAuth'), net: () => t('studioSrvEvNet'),
  warm: () => t('studioSrvEvWarm'), lost: () => t('studioSrvEvLost'), park: () => t('studioSrvEvPark') };
const ISO = { mem: () => t('studioIsoMem'), missing: () => t('studioIsoMissing'), selftest: () => t('studioIsoSelftest'), manual: () => t('studioIsoManual') };
const STG = { up: () => t('studioStgUp'), tr: () => t('studioStgTr'), al: () => t('studioStgAl'), tl: () => t('admRoleTl'), rv: () => t('studioStgRv'), bn: () => t('studioStgBn'), sv: () => t('studioStgSv') };
const upTxt = (s) => (s == null ? '—' : s < 3600 ? fmt(t('admMinAgo'), { n: Math.round(s / 60) }) : s < 86400 ? fmt(t('admHrAgo'), { n: Math.round(s / 3600) }) : fmt(t('admDayAgo'), { n: Math.round(s / 86400) }));
page('servers', { tab: 'apps', parent: 'studio', title: () => t('admStudioSrv'), render(p) {
  const V = D.srv;
  if (!V) { needSrv(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  p.append(h('p', 'adm-dt', fmt(t('admSvS'), { n: V.online, m: V.servers.length })));
  if (!V.servers.length) p.append(list(row({ c: 'gray', ic: '☁', t: t('admSvNone') })));
  for (const x of V.servers) {
    const hb = x.hb || {};
    const st = x.warn.includes('auth') ? ['red', t('admSvAuth')] : x.paused ? ['gray', t('admRunPaused')] : x.online ? ['green', x.job ? fmt(t('admSvBusy'), { s: (STG[x.job.st] || (() => '—'))() }) + (x.job.p != null ? ' · ' + Math.round(x.job.p * 100) + '%' : '') : t('admSvIdle')] : ['red', t('admSvDown')];
    const rows = [row({ c: st[0], ic: '◉', t: st[1], s: fmt(t('admItLast'), { a: ago(x.seen) }) + (hb.v ? ' · ' + hb.v : '') })];
    if (hb.disk != null) rows.push(row({ c: x.warn.includes('disk') ? 'orange' : 'gray', ic: '▤', t: t('admSvDisk'), s: hb.free != null ? fmt(t('admSvFree'), { n: hb.free }) : '', v: Math.round(hb.disk) + '%', meter: [hb.disk, hb.disk >= 85 ? 'w' : ''] }));
    if (hb.mem != null) rows.push(row({ c: x.warn.includes('mem') ? 'orange' : 'gray', ic: '▦', t: t('admSvMem'), v: Math.round(hb.mem) + '%', meter: [hb.mem, hb.mem >= 90 ? 'w' : ''] }));
    if (hb.load != null) rows.push(row({ c: 'gray', ic: '∿', t: t('admSvLoad'), s: hb.up != null ? fmt(t('admSvUp'), { a: upTxt(hb.up) }) : '', v: hb.load }));
    if (hb.iso) rows.push(row({ c: hb.iso === 'g' ? 'green' : 'orange', ic: '⛨', t: hb.iso === 'g' ? t('studioIsoG') : (ISO[hb.iw] || (() => t('studioIsoR')))(), s: hb.al === 'o' ? t('admSvAlO') : hb.al === 't' ? t('admSvAlT') : '' }));
    if (hb.ev && hb.ev.length) rows.push(row({ c: 'gray', ic: '☰', t: t('studioSrvEvT'), s: hb.ev.slice(-3).reverse().map((e) => (SV_EV[e[1]] || (() => e[1]))()).join(' · ') }));
    const br = h('div', 'btn-row adm-srvbtns');
    const pz = h('button', 'btn secondary-btn', x.paused ? t('admSvResume') : t('admSvPause')); pz.type = 'button';
    pz.addEventListener('click', () => {
      const go2 = async () => { pz.disabled = true; const r = await api('srvPause', { sid: x.id, paused: !x.paused }); D.log = null; if (r.ok) needSrv(); else { pz.disabled = false; flash(t('admErr')); } };
      if (x.paused) go2(); else askConfirm(fmt(t('admSvPauseQ'), { n: x.n }), go2, { ok: t('admSvPause') });
    });
    const rm = h('button', 'mini-btn danger', t('admModelsDel')); rm.type = 'button';
    rm.addEventListener('click', () => askConfirm(fmt(t('admSvDelQ'), { n: x.n }), async () => { const r = await api('srvRemove', { sid: x.id }); D.log = null; flash(r.ok ? t('admSaved') : t('admErr')); if (r.ok) needSrv(); }, { danger: true, ok: t('admModelsDel') }));
    br.append(pz, rm);
    p.append(grp(x.n), list(...rows), br);
  }
  // 17/10/2026 (session_01V9f): עדכון הגדרת השרת בלי שרת חדש — ידני במסוף של Hetzner (infra/worker/snb-host-apply). רק מציגים ומעתיקים, לא מריצים
  // 20/10/2026 (session_01V9f): המסוף של Hetzner לא מעביר Shift — ':' יוצא ';' והפקודה נחתכת. לכן בלי ':' '_' '$' '|' ואותיות גדולות:
  // שורה 1 מציגה את מזהה התמונה של prod, ובשורה 2 מקלידים אותו במקום image-id
  const HOST_CMD = 'docker images ghcr.io/yishaiguedj1/snb-worker\ndocker run --rm -u0 --mount type=bind,source=/,target=/h --entrypoint /opt/snb-host/apply image-id\nsnb-update';
  const hostRow = row({ c: 'blue', ic: '⌘', t: t('admSvHost'), s: t('admSvHostS'), on: () => {
    const pre = h('pre', 'adm-code', HOST_CMD); pre.dir = 'ltr';
    askConfirm(t('admSvHostQ'), () => copyText(HOST_CMD), { body: pre, ok: t('admSvHostCopy') });
  } });
  p.append(list(hostRow));
  p.append(list(row({ c: 'gray', ic: '↗', t: t('admSvRebuild'), s: t('admSvRebuildS'), on: () => { try { window.open('https://github.com/yishaiguedj1/portfolio-pwa/actions/workflows/server.yml', '_blank', 'noopener'); } catch (e) {} } })),
    h('p', 'adm-foot', t('admSvFoot')));
} });
/* ---- ניטור שרתים (22/10/2026): היסטוריית הדופק לכל שרת — נקודה כל 5 דק׳, 24 שעות. גרפים ב־SVG בלי ספרייה.
   הנתונים מגיעים מ־op adminMon (השרתון מחשב warn ו־mon); המסך רק מציג ---- */
const MON_I = { cu: 1, mem: 2, disk: 3, psi: 6, nj: 7 };
const MON_C = { cu: '#0A84FF', mem: '#5E5CE6', disk: '#30D158', net: '#F5A524', psi: '#FF453A' };   // נקודות הדופק: MON_KEYS בשרתון
const monVal = (p, k) => {
  if (k === 'net') return p[4] == null && p[5] == null ? null : (p[4] || 0) + (p[5] || 0);
  return p[MON_I[k]] == null ? null : p[MON_I[k]];
};
const monRate = (b) => (b == null ? '—' : b < 1024 ? Math.round(b) + ' B/s' : b < 1048576 ? (b / 1024).toFixed(1) + ' KB/s' : (b / 1048576).toFixed(2) + ' MB/s');
const MON_RANGE = { '24h': 86400, '31d': 31 * 86400 };   // זהה לחלון של השרתון: 24 שעות מלאות + נקודה לשעה עד 31 ימים
const monRangePts = (pts, r) => { const cut = Date.now() / 1000 - MON_RANGE[r]; return (pts || []).filter((p) => p[0] >= cut); };
const HIST_I = { vbw: 1, vinv: 2, rst: 3, rops: 4, rrd: 5, rwr: 6 };   // זהה ל־HIST_KEYS בשרתון (lib/usage.js)
const HIST_C = { vbw: '#0A84FF', vinv: '#5E5CE6', rst: '#30D158', rops: '#F5A524', rrd: '#FF453A', rwr: '#8E8E93' };
function histBlk(key, label, hist) {
  const data = (hist || []).map((p) => [p[0], p[HIST_I[key]]]).filter((x) => x[1] != null);
  if (data.length < 2) return null;   // 24/10/2026: בלי נקודות — לא מציגים קופסה ריקה (שש קופסאות "עוד אין" היו רוב המסך)
  const last = data[data.length - 1][1], v = data.map((x) => x[1]), pc = (n) => Math.round(n) + '%';
  return monRow(label, pc(last), seriesSvg(data, HIST_C[key], 100, last >= 80 ? 80 : null), last >= 80, { avg: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v) }, pc);
}
const monPct = (v) => (v == null ? '—' : Math.round(v) + '%');
const monOpen = (u) => () => { try { window.open(u, '_blank', 'noopener'); } catch (e) {} };
function seriesSvg(data, c, top, warnAt) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 320, H = 64, t0 = data[0][0], t1 = data[data.length - 1][0];
  const mx = top || Math.max(1, ...data.map((x) => x[1])) * 1.15;
  const X = (ts) => ((ts - t0) / Math.max(1, t1 - t0)) * W;
  const Y = (v) => H - 3 - (Math.min(v, mx) / mx) * (H - 6);
  const d = data.map((x, i) => (i ? 'L' : 'M') + X(x[0]).toFixed(1) + ' ' + Y(x[1]).toFixed(1)).join(' ');
  const mk = (tag, a) => { const e = document.createElementNS(NS, tag); Object.keys(a).forEach((n) => e.setAttribute(n, a[n])); return e; };
  const svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none', class: 'adm-mon-svg', role: 'img' });
  svg.append(mk('path', { d: d + ' L' + W + ' ' + H + ' L0 ' + H + ' Z', fill: c, 'fill-opacity': '.16' }),
    mk('path', { d, fill: 'none', stroke: c, 'stroke-width': '2', 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }));
  if (warnAt != null) svg.append(mk('line', { x1: 0, x2: W, y1: Y(warnAt), y2: Y(warnAt), stroke: '#FF453A', 'stroke-dasharray': '3 3', 'stroke-opacity': '.7', 'vector-effect': 'non-scaling-stroke' }));
  return svg;
}
function monChart(pts, k, top, warnAt) {
  const data = (pts || []).map((p) => [p[0], monVal(p, k)]).filter((x) => x[1] != null);
  if (data.length < 2) return null;
  return seriesSvg(data, MON_C[k], top, warnAt);
}
/* 24/10/2026 (בקשת המשתמש: "כתב קריא, נקי כמו Apple"): שורה לכל מדד — שם וממוצע/שיא, גרף קטן, והערך הנוכחי בגדול.
   הסף מסומן רק כשהמדד חורג (בלי קווים אדומים על כל גרף) */
function monStat(pts, k) {
  const v = (pts || []).map((p) => monVal(p, k)).filter((x) => x != null);
  return v.length ? { avg: v.reduce((a, b) => a + b, 0) / v.length, max: Math.max(...v) } : null;
}
function monRow(label, cur, svg, warn, st, fmtV, note) {
  const r = h('div', 'adm-mr' + (warn ? ' warn' : ''));
  const tx = h('div', 'adm-mr-tx');
  tx.append(h('b', null, label));
  const iso = (x) => '\u2066' + x + '\u2069';   // מספר עם יחידה בתוך שורה עברית — בלי היפוך
  if (st) tx.append(h('small', null, fmt(t('admMonAvgMax'), { a: iso(fmtV(st.avg)), m: iso(fmtV(st.max)) })));
  if (note) tx.append(h('small', null, note));
  r.append(tx);
  if (svg) { const g = h('div', 'adm-mr-g'); g.append(svg); r.append(g); }
  const v = h('span', 'adm-mr-v'), m = /^([\d.,]+) (\S+)$/.exec(cur);   // "39.4 KB/s" → המספר בגדול, היחידה קטנה
  if (m) v.append(m[1], h('small', null, m[2])); else v.textContent = cur;
  r.append(v);
  return r;
}
function monCard(x, r) {
  const hb = x.hb || {}, pts = monRangePts(x.mon, r), w = x.warn || [];
  const st = !x.online ? ['gray', t('admMonOff')] : w.length ? ['orange', t('admMonWarn')] : ['green', t('admMonOk')];
  const net = hb.rx == null && hb.tx == null ? null : (hb.rx || 0) + (hb.tx || 0);
  const hd = h('div', 'adm-sv-hd');
  const nm = h('div', 'adm-sv-nm');
  nm.append(h('b', null, x.name));
  const sub = [x.online ? (hb.busy ? t('admMonBusy') : t('admMonIdle')) : '', x.seen ? fmt(t('admMonSeen'), { a: ago(x.seen) }) : ''].filter(Boolean).join(' · ');
  if (sub) nm.append(h('small', null, sub));
  hd.append(nm, h('span', 'adm-sv-st adm-sv-' + st[0], st[1]));
  const card = h('div', 'adm-sv');
  card.append(hd);
  const pc = (v) => monPct(v);
  const M = [['cu', t('admMonCpu'), monPct(hb.cu), 100, 90, pc], ['mem', t('admSvMem'), monPct(hb.mem), 100, 90, pc], ['disk', t('admSvDisk'), monPct(hb.disk), 100, 85, pc],
    ['net', t('admMonNet'), monRate(net), null, null, monRate], ['psi', t('admMonPsi'), monPct(hb.psi), 100, 20, pc]];
  for (const [k, label, cur, top, at, f] of M) {
    const warn = w.includes(k), note = k === 'disk' && hb.free != null ? fmt(t('admMonFree'), { g: Math.round(hb.free) }) : '';
    card.append(monRow(label, cur, monChart(pts, k, top, warn ? at : null), warn, monStat(pts, k), f, note));
  }
  return card;
}
const STO_NAME = { 'snb-studio': () => t('admStoStudio'), 'snb-learn': () => t('admStoLearn'), 'snb-staging': () => t('admStoStg') };
const gbTxt = (g) => (g == null ? '—' : '\u2066' + (g < 1 ? Math.round(g * 1000) + ' MB' : (g < 10 ? g.toFixed(2) : Math.round(g)) + ' GB') + '\u2069');   // בידוד — בלי היפוך בשורה עברית
const meterOf = (pc) => [pc, pc >= 90 ? 'x' : pc >= 80 ? 'w' : ''];
const colOf = (pc) => (pc >= 90 ? 'red' : pc >= 80 ? 'orange' : 'green');
function storeRows(S, servers) {
  const out = [], r2 = S && S.r2, dr = S && S.drive;
  if (r2 && r2.b && r2.b.length) {
    const tot = r2.b.reduce((a, b) => a + (b.gb || 0), 0), pc = Math.round(tot / 10 * 100);   // 10GB חינם — משותף לכל הדליים
    // מעל 10GB משלמים — אז לא "305%" באדום אלא הגודל וכמה מעל החינם (העלות בשורה הבאה)
    out.push(tot > 10 ? row({ c: 'blue', ic: '☁', t: t('admStoR2'), s: fmt(t('admStoOver'), { g: gbTxt(tot - 10) }) + ' · ' + fmt(t('admStoAt'), { a: ago(r2.at * 1000) }), v: gbTxt(tot) })
      : row({ c: colOf(pc), ic: '☁', t: t('admStoR2'), s: fmt(t('admStoOf'), { u: gbTxt(tot), l: gbTxt(10) }) + ' · ' + fmt(t('admStoAt'), { a: ago(r2.at * 1000) }), v: pc + '%', meter: meterOf(pc) }));
    const C = r2.cost, usd = (x) => '$' + (x || 0).toFixed(2);
    if (C) {
      const parts = [[C.st, 'admStoCSt'], [C.a, 'admStoCA'], [C.b, 'admStoCB']].filter((x) => x[0] > 0).map((x) => fmt(t(x[1]), { v: usd(x[0]) }));
      out.push(row({ c: C.proj > 0 ? 'orange' : 'green', ic: '$', t: t('admStoCost'), s: parts.length ? parts.join(' · ') : t('admStoCFree'),
        v: usd(C.proj), tr: fmt(t('admStoCostMtd'), { m: usd(C.mtd) }) }));
    }
    for (const b of r2.b) out.push(row({ c: 'gray', ic: '▤', t: (STO_NAME[b.name] || (() => b.name))(), s: b.n == null ? b.name : fmt(t('admStoFiles'), { n: b.n.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US') }), v: gbTxt(b.gb) }));
  } else out.push(row({ c: 'gray', ic: '☁', t: t('admStoR2'), s: t('admStoR2Off') }));
  if (dr && dr.gb != null) {
    const pc = dr.lim ? Math.round(dr.gb / dr.lim * 100) : null;
    out.push(row({ c: pc == null ? 'blue' : colOf(pc), ic: '◫', t: t('admStoDrive'), s: (dr.lim ? fmt(t('admStoOf'), { u: gbTxt(dr.gb), l: gbTxt(dr.lim) }) : gbTxt(dr.gb)) + ' · ' + fmt(t('admStoAt'), { a: ago(dr.at * 1000) }), v: pc == null ? '' : pc + '%', meter: pc == null ? null : meterOf(pc) }));
  } else out.push(row({ c: 'gray', ic: '◫', t: t('admStoDrive'), s: t('admStoDriveOff') }));
  for (const x of servers || []) {
    const hb = x.hb || {};
    if (hb.disk == null) continue;
    out.push(row({ c: colOf(hb.disk), ic: '▣', t: fmt(t('admStoSrv'), { n: x.name }), s: hb.free == null ? '' : fmt(t('admMonFree'), { g: Math.round(hb.free) }), v: Math.round(hb.disk) + '%', meter: meterOf(hb.disk) }));
  }
  return out;
}
const PROV_NAME = { vercel: () => t('admProvVercel'), r2: () => t('admProvR2'), fs: () => t('admProvFs') };
const PROV_ITEM = { bw: () => t('admProvBw'), inv: () => t('admProvInv'), store: () => t('admProvStore'), ops: () => t('admProvOps'), reads: () => t('admProvReads'), writes: () => t('admProvWrites') };
function provRow(name, P, skip) {
  if (!P || P.st === 'off') return row({ c: 'gray', ic: '☁', t: name, s: t('admProvOff') });
  if (P.st === 'err') return row({ c: 'red', ic: '!', t: name, s: t('admProvErr') + ' · ' + (P.err || '') });
  const items = (P.items || []).filter((x) => !skip || !skip.includes(x.k));
  const parts = items.filter((x) => x.used != null).map((x) => (PROV_ITEM[x.k] || (() => x.k))() + ': ' + fmt(t('admProvOf'), { u: String(x.used), l: x.lim }) + ' ' + x.unit);
  const worst = Math.max(0, ...items.map((x) => x.pct || 0));
  return row({ c: worst >= 80 ? 'orange' : 'green', ic: '☁', t: name, s: parts.join(' · ') || (skip ? '' : t('admProvOff')), v: worst ? Math.round(worst) + '%' : '', meter: worst ? [worst, worst >= 80 ? 'w' : ''] : null });
}
page('mon', { tab: 'sys', parent: 'sys', title: () => t('admMonT'), render(p) {
  if (!D.monT) needMon();
  const V = D.mon;
  if (!V) { p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const M = V.mon;
  p.append(h('p', 'adm-dt', t('admMonDt')));
  p.append(grp(t('admMonSrv')));
  if (!M.servers.length) p.append(list(row({ c: 'gray', ic: '☁', t: t('admMonNone') })));
  const rng = h('div', 'adm-seg');
  for (const r of ['24h', '31d']) {
    const on = (D.mr || '24h') === r;
    const b = h('button', 'adm-seg-b' + (on ? ' on' : ''), r === '24h' ? t('admMonRange24') : t('admMonRange31'));
    b.type = 'button'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.addEventListener('click', () => { D.mr = r; paint(); });
    rng.append(b);
  }
  p.append(rng);
  for (const x of M.servers) p.append(monCard(x, D.mr || '24h'));
  p.append(grp(t('admMonJobs')));
  const jobs = M.jobs || [];
  if (!jobs.length) p.append(list(row({ c: 'gray', ic: '◎', t: t('admMonJobsNone') })));
  else p.append(list(...jobs.map((j) => {
    const s = M.servers.find((x) => x.id === j.sid), pc = j.p == null ? null : Math.round(j.p * 100);
    return row({ c: 'blue', ic: '◎', t: (STG[j.st] || (() => j.st || '—'))(), s: s ? s.name : '', v: pc == null ? '' : pc + '%', meter: pc == null ? null : [pc, ''] });
  })));
  // 23/10/2026: שימוש בשירותי הענן — רק מספרים מהספקים עצמם; ספק בלי טוקן = "לא מוגדר", בלי מספר מומצא
  p.append(grp(t('admProvT')));
  const PV = D.prov;
  if (!PV) p.append(list(row({ c: 'gray', ic: '⋯', t: t('admLoading') })));
  else p.append(list(...[[PROV_NAME.vercel(), PV.vercel], [PROV_NAME.r2(), PV.r2, D.sto && D.sto.r2 ? ['store'] : null], [PROV_NAME.fs(), PV.firestore]].map(([name, P, sk]) => provRow(name, P, sk))), h('p', 'adm-foot', t('admProvNote')));
  // 24/10/2026 (בקשת המשתמש): כל מקומות האחסון שלנו במקום אחד — דליי R2, ה־Drive של הגיבוי והדיסק של כל שרת
  p.append(grp(t('admStoT')));
  p.append(list(...storeRows(D.sto, M.servers)), h('p', 'adm-foot', t('admStoNote')));
  // 23/10/2026: היסטוריית אחוזי השימוש של כל פרמטר (עד 31 ימים, נקודה לשעה)
  p.append(grp(t('admProvHist')));
  const HB = [['vbw', PROV_NAME.vercel() + ' · ' + PROV_ITEM.bw()], ['vinv', PROV_NAME.vercel() + ' · ' + PROV_ITEM.inv()], ['rst', PROV_NAME.r2() + ' · ' + PROV_ITEM.store()],
    ['rops', PROV_NAME.r2() + ' · ' + PROV_ITEM.ops()], ['rrd', PROV_NAME.fs() + ' · ' + PROV_ITEM.reads()], ['rwr', PROV_NAME.fs() + ' · ' + PROV_ITEM.writes()]];
  const hrows = HB.map(([k, label]) => histBlk(k, label, monRangePts(D.provHist, D.mr || '24h'))).filter(Boolean);
  if (hrows.length) { const hcard = h('div', 'adm-sv'); hcard.append(...hrows); p.append(hcard); }
  else p.append(list(row({ c: 'gray', ic: '◷', t: t('admMonHistWait') })));
  p.append(grp(t('admMonTokT')));
  const on = !!(V.tok && V.tok.on);
  p.append(list(row({ c: on ? 'green' : 'gray', ic: '⚿', t: on ? fmt(t('admMonTokOn'), { a: ago(V.tok.at) }) : t('admMonTokOff') })));
  const tb = h('div', 'btn-row adm-srvbtns');
  const mk = h('button', 'btn secondary-btn', on ? t('admMonTokRotate') : t('admMonTokMake')); mk.type = 'button';
  mk.addEventListener('click', async () => {
    mk.disabled = true; const r = await api('monTok', {}); mk.disabled = false;
    if (!r.ok) { flash(t('admErr')); return; }
    needMon();
    const pre = h('pre', 'adm-code', r.tok); pre.dir = 'ltr';
    askConfirm(t('admMonTokNew'), () => copyText(r.tok), { body: pre, ok: t('admMonTokCopy') });
  });
  tb.append(mk);
  if (on) {
    const rv = h('button', 'mini-btn danger', t('admMonTokRev')); rv.type = 'button';
    rv.addEventListener('click', () => askConfirm(t('admMonTokRevQ'), async () => { const r = await api('monTok', { rev: true }); if (r.ok) needMon(); else flash(t('admErr')); }, { danger: true, ok: t('admMonTokRev') }));
    tb.append(rv);
  }
  p.append(tb);
  p.append(list(row({ c: 'blue', ic: '▣', t: t('admMonApk'), s: t('admMonApkS'), on: monOpen('https://github.com/yishaiguedj1/portfolio-pwa/releases/download/android-latest/the-snowball-admin.apk') })));
} });
async function needMon() {
  clearTimeout(D.monT); D.monT = 0;
  const [r, pv] = await Promise.all([api('adminMon'), api('provUsage')]);
  if (r.ok) D.mon = r;
  if (pv.ok) { D.prov = pv.prov; D.provHist = pv.hist || []; D.sto = pv.sto || null; }
  if (cur === 'mon') { D.monT = setTimeout(needMon, 30000); paint(); }   // מתרענן כל 30 שנ׳ כל עוד המסך פתוח
}
/* ---- שימוש ומשפכים (15/10/2026): כמה נכנסו לכל אפליקציה ועד איפה הגיעו. רק ספירות קיימות + עבודות 30 יום — בלי מעקב חדש ---- */
async function needUsage() {
  const r = await api('adminUsage');
  if (r.ok) { D.us = r.us; if (['usage', 'apps'].includes(cur)) paint(); }
}
const FUN = { acc: () => t('admUfAcc'), sess: () => t('admUfSess'), ibkr: () => t('admUfIbkr'), open: () => t('admUfOpen'), backup: () => t('admUfBackup'),
  conn: () => t('admUfConn'), job: () => t('admUfJob'), done: () => t('admUfDone') };
function funnel(steps, c) {
  const base = steps[0] && steps[0].n;
  return list(...steps.map((x, i) => row({ c: i ? 'gray' : c, ic: String(i + 1), t: FUN[x.k](), v: x.n == null ? '—' : x.n,
    tr: i && base && x.n != null ? Math.round(x.n / base * 100) + '%' : '', meter: base && x.n != null ? [x.n / base * 100, ''] : null })));
}
page('usage', { tab: 'apps', parent: 'apps', title: () => t('admUsage'), render(p) {
  const U = D.us;
  if (!U) { needUsage(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  if (U.jobs) {
    const wk = U.jobs.wk;
    p.append(tiles(tileEl('studio', t('admUsJobs'), String(U.jobs.n), fmt(t('admUsDone'), { n: U.jobs.done }), '', wk.map((x) => x.n)),
      tileEl('purple', t('admUsWkU'), String(wk[3].u), fmt(t('admUsPrevWk'), { n: wk[2].u }), '', wk.map((x) => x.u))));
  }
  p.append(grp('Invest'), funnel(U.invest, 'invest'), grp('Academy'), funnel(U.academy, 'academy'), grp('Studio'), funnel(U.studio, 'studio'));
  p.append(h('p', 'adm-foot', t('admUgFoot')));
} });
/* ---- משוב ופניות (15/10/2026): מה שמשתמשים שלחו מההגדרות של כל אפליקציה (fbSend). "טופל", לענות במייל, מחיקה ---- */
async function needFb(set) {
  const r = await api('adminFb', set ? { set } : {});
  if (r.ok) { D.fb = r.fb; if (['feedback', 'apps'].includes(cur)) paint(); }
  if (set) D.log = null;
  return r;
}
const FBK = { bug: () => t('fbKBug'), idea: () => t('fbKIdea'), other: () => t('fbKOther') };
const APPC = { invest: 'invest', academy: 'academy', studio: 'studio' };
function fbCard(x) {
  const c = h('section', 'card adm-card adm-fb' + (x.st === 'd' ? ' done' : ''));
  const top = h('div', 'adm-fbtop');
  const chip = h('span', 'adm-chip', (FBK[x.k] || FBK.other)()); chip.style.background = COL[x.k === 'bug' ? 'red' : x.k === 'idea' ? 'purple' : 'gray'];
  const ap = h('span', 'adm-chip', x.app ? x.app.replace(/^./, (m) => m.toUpperCase()) : '—'); ap.style.background = COL[APPC[x.app]] || COL.gray;
  top.append(chip, ap, h('small', null, [day(x.at) + ' ' + clock(x.at), x.ver, x.plat].filter(Boolean).join(' · ')));
  const tx = h('p', 'adm-fbtx', x.t); tx.setAttribute('dir', 'auto');
  const br = h('div', 'btn-row');
  if (x.em) { const a = h('a', 'btn secondary-btn', t('admFbReply')); a.href = 'mailto:' + encodeURIComponent(x.em) + '?subject=' + encodeURIComponent('THE SNOWBALL'); br.append(a); }
  const st = h('button', x.st === 'd' ? 'btn secondary-btn' : 'btn', x.st === 'd' ? t('admFbReopen') : t('admFbDone')); st.type = 'button';
  st.addEventListener('click', async () => { st.disabled = true; const r = await needFb({ id: x.id, st: x.st === 'd' ? 'n' : 'd' }); if (!r.ok) { st.disabled = false; flash(t('admErr')); } });
  const del = h('button', 'mini-btn danger', t('admModelsDel')); del.type = 'button';
  del.addEventListener('click', () => askConfirm(t('admFbDelQ'), async () => { const r = await needFb({ id: x.id, st: 'x' }); flash(r.ok ? t('admSaved') : t('admErr')); }, { danger: true, ok: t('admModelsDel') }));
  br.append(st, del);
  c.append(top, tx);
  if (x.em) { const em = h('p', 'adm-sub'); em.append(h('bdi', null, x.em)); c.append(em); }
  c.append(br);
  return c;
}
page('feedback', { tab: 'apps', parent: 'apps', title: () => t('admFeedback'), render(p) {
  const F = D.fb;
  if (!F) { needFb(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const open = F.items.filter((x) => x.st === 'n'), done = F.items.filter((x) => x.st === 'd');
  p.append(h('p', 'adm-dt', open.length ? fmt(t('admFbOpenN'), { n: open.length }) : t('admFbNone')));
  if (open.length) p.append(...open.map(fbCard));
  if (done.length) p.append(grp(fmt(t('admFbDoneN'), { n: done.length })), ...done.slice(0, 30).map(fbCard));
  p.append(h('p', 'adm-foot', t('admFbFoot')));
} });
/* ---- הודעות ומה חדש (15/10/2026): הודעה שאתה כותב — פעם אחת בכל מכשיר, לאפליקציות שבחרת, עד מתי שבחרת (sysCfg.an*).
   "מה חדש" — אוטומטי אחרי כל שחרור לייצור, מ־CHANGELOG.md (newsShow ב־core) ---- */
page('news', { tab: 'apps', parent: 'apps', title: () => t('admMsgs'), render(p) {
  const cf = D.cfg;
  if (!cf) { needCfg(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const an = cf.an, d = cf.anD || {};
  const card = h('section', 'card adm-card');
  card.append(h('h2', null, an ? t('admAnOn') : t('admAnNew')));
  if (an) card.append(h('p', 'adm-sub', [an.apps.map((a) => a.replace(/^./, (m) => m.toUpperCase())).join(' · '), an.til ? fmt(t('admMaintTil'), { t: day(an.til) + ' ' + clock(an.til) }) : t('admMaintDurInf')].join(' · ')));
  const ti = h('input', 'adm-search'); ti.maxLength = 60; ti.placeholder = t('admAnTitleP'); ti.setAttribute('dir', 'auto'); ti.value = d.t || '';
  const bo = h('textarea', 'adm-search adm-note-in'); bo.rows = 4; bo.maxLength = 400; bo.placeholder = t('admAnBodyP'); bo.setAttribute('dir', 'auto'); bo.value = d.b || '';
  const apps = new Set(d.apps && d.apps.length ? d.apps : ['invest', 'academy', 'studio']);
  const seg = h('div', 'adm-seg');
  for (const a of ['invest', 'academy', 'studio']) {
    const b = h('button', 'mini-btn', a.replace(/^./, (m) => m.toUpperCase())); b.type = 'button'; b.setAttribute('aria-pressed', apps.has(a) ? 'true' : 'false');
    b.addEventListener('click', () => { if (apps.has(a)) apps.delete(a); else apps.add(a); b.setAttribute('aria-pressed', apps.has(a) ? 'true' : 'false'); });
    seg.append(b);
  }
  let dur = 7;
  const dseg = h('div', 'adm-seg');
  const DUR = [[0, t('admMaintDurInf')], [1, t('admAnDur1')], [7, t('admAnDur7')], [30, t('admAnDur30')]];
  const paintD = () => [...dseg.children].forEach((b, i) => b.setAttribute('aria-pressed', DUR[i][0] === dur ? 'true' : 'false'));
  for (const [n2, lbl] of DUR) { const b = h('button', 'mini-btn', lbl); b.type = 'button'; b.addEventListener('click', () => { dur = n2; paintD(); }); dseg.append(b); }
  paintD();
  const br = h('div', 'btn-row');
  const pub = h('button', 'btn', an ? t('admAnRepub') : t('admAnPub')); pub.type = 'button';
  pub.addEventListener('click', () => {
    if (!(ti.value.trim() || bo.value.trim()) || !apps.size) { flash(t('admAnNeed')); return; }
    askConfirm(t('admAnQ'), async () => {
      const r = await needCfg({ an: { on: true, t: ti.value, b: bo.value, apps: [...apps], til: dur ? Date.now() + dur * 864e5 : 0 } });
      flash(r.ok ? t('admSaved') : t('admErr'));
    }, { ok: t('admAnPub') });
  });
  br.append(pub);
  if (an) { const off = h('button', 'btn secondary-btn', t('admAnOff')); off.type = 'button'; off.addEventListener('click', async () => { const r = await needCfg({ an: { on: false } }); flash(r.ok ? t('admSaved') : t('admErr')); }); br.append(off); }
  card.append(h('div', 'adm-lbl', t('admAnTitleL')), ti, h('div', 'adm-lbl', t('admAnBodyL')), bo, h('div', 'adm-lbl', t('admAnApps')), seg, h('div', 'adm-lbl', t('admMaintDur')), dseg, br);
  p.append(card, grp(t('admNewsT')), list(row({ c: 'green', ic: '★', t: t('admNewsAuto'), s: t('admNewsAutoS') })), h('p', 'adm-foot', t('admAnFoot')));
} });
/* ---- גיבויים (17/10/2026, "מה עובר" למרכז הניהול): הגיבוי היומי ל־R2 ו"ספק שני" (Drive שלך). קריאה בלבד — שחזור ידני (SECURITY/infra) ---- */
async function needBk() {
  const r = await api('adminBackups');
  if (r.ok) { D.bk = r.bk; if (['backups', 'sys'].includes(cur)) paint(); }
}
const BKW = { r2_none: () => t('admBkR2None'), r2_stale: () => t('admBkR2Stale'), off_none: () => t('admBkOffNone'), off_stale: () => t('admBkOffStale'), off_err: () => t('admBkOffErr') };
page('backups', { tab: 'sys', parent: 'sys', title: () => t('admBkT'), render(p) {
  const B = D.bk;
  if (!B) { needBk(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  if (B.warn.length) p.append(grp(t('admSecWaitInfra')), list(...B.warn.map((w) => row({ c: /none|err/.test(w) ? 'red' : 'orange', ic: '!', t: BKW[w](), s: w === 'off_err' && B.off ? B.off.err : '' }))));
  const r2 = B.r2;
  p.append(grp(t('admBkR2')));
  if (!r2) p.append(list(row({ c: 'gray', ic: '☁', t: t('admBkR2Off') })));
  else p.append(list(row({ c: r2.n ? 'green' : 'red', ic: '☁', t: fmt(t('admBkDays'), { n: r2.n, k: B.keep }), s: r2.last ? fmt(t('admBkLast'), { d: r2.last.split('-').reverse().join('/') }) : '' }),
    ...r2.days.slice(0, 7).map((x) => row({ c: x.fs ? 'gray' : 'orange', ic: x.fs ? '✓' : '!', t: x.d.split('-').reverse().join('/'), s: [x.fs ? 'Firestore' : '', x.cat || x.cat2 ? t('admBkCat') : ''].filter(Boolean).join(' · ') || t('admBkPart'), v: '\u2066' + x.mb + ' MB\u2069' }))));
  const o = B.off;
  p.append(grp(t('admBkOff')), list(o && o.owner
    ? row({ c: o.err ? 'red' : o.okAt ? 'green' : 'orange', ic: '⟲', t: o.mine ? t('admBkOffMine') : t('admBkOffOther'), s: [o.okAt ? fmt(t('admItLast'), { a: ago(o.okAt) }) : '', o.up ? fmt(t('admBkUp'), { n: o.up }) : '', o.left ? fmt(t('admBkLeft'), { n: o.left }) : ''].filter(Boolean).join(' · ') })
    : row({ c: 'orange', ic: '⟲', t: t('admBkOffNoOwner'), s: t('admBkOffNoOwnerS') })));
  p.append(h('p', 'adm-foot', t('admBkFoot')));
} });
/* ---- מצב תחזוקה והגדרות ודגלים (15/10/2026, בקשת המשתמש — ServiceNow: System Maintenance / System Properties).
   השרתון אוכף (lib/sysflags.js, sysBlock); האפליקציות מקבלות את המצב ב־op ציבורי cfg ומציגות פס ---- */
async function needCfg(set) {
  const r = await api('adminCfg', set ? { set } : {});
  if (set) { D.users = null; D.log = null; }   // הרשימה של "כל המודלים" מוצגת גם במשתמשים
  if (r.ok) { D.cfg = r.cfg; if (['maint', 'flags', 'models', 'sys', 'news', 'apps'].includes(cur)) paint(); }
  return r;
}
const clock = (ms) => new Date(ms).toLocaleTimeString(lang === 'he' ? 'he-IL' : 'en-GB', { timeZone: 'Asia/Jerusalem', hour: '2-digit', minute: '2-digit' });
page('maint', { tab: 'sys', parent: 'sys', title: () => t('admMaint'), render(p) {
  const cf = D.cfg;
  if (!cf) { needCfg(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const mt = cf.mt, on = !!cf.m;
  const card = h('section', 'card adm-card');
  card.append(h('h2', null, on ? t('admMaintOn') : t('admMaintOff')),
    h('p', 'adm-sub', on ? fmt(t('admMaintSince'), { a: ago(mt.at) }) + (mt.til ? ' · ' + fmt(t('admMaintTil'), { t: clock(mt.til) }) : '') : t('admMaintOffS')));
  const msg = h('textarea', 'adm-search adm-note-in'); msg.rows = 2; msg.maxLength = 140; msg.placeholder = t('admMaintMsgP'); msg.setAttribute('dir', 'auto'); msg.value = mt.msg || '';
  let dur = 0;
  const seg = h('div', 'adm-seg');
  const DUR = [[0, t('admMaintDurInf')], [30, t('admMaintDur30')], [60, t('admMaintDur60')], [180, t('admMaintDur180')]];
  const paintSeg = () => [...seg.children].forEach((b, i) => b.setAttribute('aria-pressed', DUR[i][0] === dur ? 'true' : 'false'));
  for (const [m, lbl] of DUR) { const b = h('button', 'mini-btn', lbl); b.type = 'button'; b.addEventListener('click', () => { dur = m; paintSeg(); }); seg.append(b); }
  paintSeg();
  const br = h('div', 'btn-row');
  const save = async (want) => {
    const r = await needCfg({ mt: { on: want, msg: msg.value, til: want && dur ? Date.now() + dur * 60e3 : 0 } });
    flash(r.ok ? t('admSaved') : t('admErr'));
  };
  if (on) {
    const upd = h('button', 'btn secondary-btn', t('admMaintUpd')); upd.type = 'button'; upd.addEventListener('click', () => save(true));
    const off = h('button', 'btn', t('admMaintStop')); off.type = 'button'; off.addEventListener('click', () => save(false));
    br.append(off, upd);
    card.append(h('div', 'adm-lbl', t('admMaintMsgL')), msg, br);
  } else {
    const go2 = h('button', 'btn danger-btn', t('admMaintGo')); go2.type = 'button';
    go2.addEventListener('click', () => askConfirm(t('admMaintQ'), () => save(true), { danger: true, ok: t('admMaintGo') }));
    br.append(go2);
    card.append(h('div', 'adm-lbl', t('admMaintMsgL')), msg, h('div', 'adm-lbl', t('admMaintDur')), seg, br);
  }
  p.append(card, h('p', 'adm-foot', t('admMaintFoot')));
} });
const FL = {
  st_api: [() => t('admFlStApi'), () => t('admFlStApiS')], st_routine: [() => t('admFlStRt'), () => t('admFlStRtS')],
  st_url: [() => t('admFlStUrl'), () => t('admFlStUrlS')],
  st_auto: [() => t('admFlStAuto'), () => t('admFlStAutoS')], learn: [() => t('admFlLearn'), () => t('admFlLearnS')], learn_full: [() => t('admFlFull'), () => t('admFlFullS')],
  push: [() => t('admFlPush'), () => t('admFlPushS')], iv_live: [() => t('admFlLive'), () => t('admFlLiveS')],
};
const APPN = { studio: 'Studio', invest: 'Invest', all: () => t('admFlAll') };
page('flags', { tab: 'sys', parent: 'sys', title: () => t('admCfg'), render(p) {
  const cf = D.cfg;
  if (!cf) { needCfg(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const rows = cf.flags.filter((f) => FL[f.k]).map((f) => {
    const r = h('div', 'adm-r adm-flr');   // בלי אייקון — המתג עצמו מראה את המצב (מינימליזם)
    const m = h('span', 'adm-m'), tx = h('span', 'adm-tx');
    const an = APPN[f.app];
    tx.append(h('b', null, FL[f.k][0]()), h('small', null, (typeof an === 'function' ? an() : an) + ' · ' + FL[f.k][1]()));
    const sw = h('button', 'adm-sw'); sw.type = 'button'; sw.setAttribute('role', 'switch'); sw.setAttribute('aria-checked', f.on ? 'true' : 'false'); sw.setAttribute('aria-label', FL[f.k][0]()); sw.append(h('i'));
    const set = async (on) => { sw.disabled = true; const r2 = await needCfg({ flag: f.k, on }); sw.disabled = false; flash(r2.ok ? t('admSaved') : t('admErr')); };
    sw.addEventListener('click', () => (f.on ? askConfirm(fmt(t('admFlOffQ'), { n: FL[f.k][0]() }), () => set(false), { danger: true, ok: t('admFlOff') }) : set(true)));
    m.append(tx, sw); r.append(m);
    return r;
  });
  p.append(list(...rows), h('p', 'adm-foot', t('admFlFoot')));
} });
/* 15/10/2026 (בקשת המשתמש): מצבי התרגום בסטודיו — לכולם "רגיל" (Haiku High) ו"ביצועים" (Sonnet Medium); כאן — מי מקבל את
   כל המודלים (גם Sonnet Low/High ו־Opus). המנהל תמיד. השרתון אוכף (modeOk ב־api/studio.js), וגם פותח לרשימה את הסטודיו */
page('models', { tab: 'sys', parent: 'sys', title: () => t('admModels'), render(p) {
  const cf = D.cfg;
  if (!cf) { needCfg(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const card = h('section', 'card adm-card');
  card.append(h('p', 'adm-sub', t('admModelsSub')));
  const inp = h('input', 'adm-search'); inp.type = 'email'; inp.placeholder = t('admModelsPh'); inp.setAttribute('aria-label', t('admModelsPh')); inp.dir = 'ltr'; inp.autocomplete = 'off';
  const add = h('button', 'btn', t('admModelsAdd')); add.type = 'button';
  const doAdd = async () => {
    const e = inp.value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) { flash(t('admModelsBad')); return; }
    add.disabled = true; const r = await needCfg({ am: e, on: true }); add.disabled = false;
    flash(r.ok ? t('admSaved') : t('admErr'));
  };
  add.addEventListener('click', doAdd);
  inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') doAdd(); });
  const br = h('div', 'btn-row'); br.append(add);
  card.append(inp, br);
  const rows = [h('div', 'ios-row adm-dim', t('admModelsMeRow'))].concat((cf.am || []).map((e) => {
    const r = h('div', 'ios-row adm-trow');
    const tx = h('span', 'adm-ttx'); const b = h('b'); b.append(h('bdi', null, e)); b.style.overflowWrap = 'anywhere'; tx.append(b);
    const del = h('button', 'mini-btn danger', t('admModelsDel')); del.type = 'button';
    del.addEventListener('click', () => askConfirm(fmt(t('admModelsDelQ'), { e }), async () => { const r2 = await needCfg({ am: e, on: false }); flash(r2.ok ? t('admSaved') : t('admErr')); }, { danger: true, ok: t('admModelsDel') }));
    r.append(tx, del);
    return r;
  }));
  const l = h('div', 'ios-list'); l.append(...rows);
  p.append(card, h('div', 'adm-lbl', t('admModelsList')), l, h('p', 'adm-foot', t('admModelsFoot')));
} });
page('infra', { tab: 'sys', parent: 'sys', title: () => t('admInfra'), render(p) {
  const o = D.ov;
  if (!o) { p.append(h('p', 'adm-note', t('admErr'))); return; }
  const inf = o.items.filter((x) => /^(deploy_wait|site_down|srv_off|bk_|pr_|release_due)/.test(x.k)).map(itemRow).filter(Boolean);
  if (inf.length) p.append(grp(t('admSecWaitInfra')), list(...inf));
  p.append(grp(t('admSecRun')), list(...o.run.map(runRow).filter(Boolean)));
  const dates = o.items.filter((x) => /^date_/.test(x.k)).map(itemRow).filter(Boolean);
  if (dates.length) p.append(grp(t('admSecDates')), list(...dates));
} });
/* ---- AI ועלויות (15/10/2026): Studio — ממאגר הלמידה (30 יום), Academy — מוני ה־AI היומיים, השרת — ההוצאה החודשית.
   נטען רק בכניסה למסך (adminAi); בלי נתונים — "—", לא ממציאים ---- */
const ROLE = { main: () => t('admRoleMain'), tl: () => t('admRoleTl'), rv: () => t('admRoleRv'), jg: () => t('admRoleJg'), sub: () => t('admRoleSub') };
const modeName = (m) => String(m || '').replace(/-/g, ' · ').replace(/^./, (c) => c.toUpperCase());
async function needAi() {
  if (D.ai && Date.now() - D.aiAt < 60000) return;
  const r = await api('adminAi');
  if (r.ok) { D.ai = r.ai; D.aiAt = Date.now(); if (['ai', 'quota', 'sys', 'academy'].includes(cur)) paint(); }
}
function aiWarnRow(w) {
  const v = w.v || {}, c = w.sev === 1 ? 'red' : w.sev === 2 ? 'orange' : 'gray';
  switch (w.k) {
    case 'ai_day': return row({ c, ic: '!', t: t('admAiWDay'), s: fmt(t('admOfMax'), { n: v.n, m: v.m }), meter: [v.n / v.m * 100, w.sev === 1 ? 'x' : 'w'] });
    case 'ai_ins': return row({ c, ic: '!', t: t('admAiWIns'), s: fmt(t('admOfMax'), { n: v.n, m: v.m }), meter: [v.n / v.m * 100, 'w'] });
    case 'st_cap': return row({ c, ic: '!', t: t('admAiWCap'), s: fmt(t('admAiWCapS'), { p: v.p }), meter: [v.p, 'w'] });
    case 'fn_full': return row({ c, ic: '∑', t: t('admAiWFn'), s: fmt(t('admOfMax'), { n: v.n, m: v.m }) });
    default: return null;
  }
}
page('ai', { tab: 'sys', parent: 'sys', title: () => t('admAiCost'), render(p) {
  const ai = D.ai, v = D.lab && D.lab.view, k = v && v.k;
  if (!ai) needAi();
  const parts = [];
  if (k) parts.push(fmt(t('admAiHeroSt'), { u: usd(k.usd) }));
  if (ai) parts.push(fmt(t('admAiHeroAc'), { n: ai.today.t }));
  p.append(h('p', 'adm-dt', parts.join(' · ') || t('admLoading')));
  if (ai && ai.warn.length) p.append(grp(t('admSecWaitInfra')), list(...ai.warn.map(aiWarnRow)));
  if (k) {
    const wk = v.wk || [];
    p.append(grp(t('admAiSecSt')), tiles(
      tileEl('orange', t('admAiSpend'), usd(k.usd), v.kp && v.kp.n ? fmt(t('admPrev'), { n: usd(v.kp.usd) }) : '', '', []),
      tileEl('purple', t('admKcpm'), usd(k.cpm, 3), '', '', wk.map((x) => x.cpm)),
      tileEl('green', t('admKch'), pctTxt(k.ch), '', '', []),
      tileEl('blue', t('admAiTpm'), k.tpm == null ? '—' : (k.tpm / 1000).toFixed(1) + 'K', '', '', [])));
    const roles = (v.roles || []).filter((r) => r.usd > 0);
    if (roles.length) p.append(grp(t('admAiSecRole')), list(...roles.map((r) => row({ c: 'purple', ic: '◇', t: (ROLE[r.k] || (() => r.k))(), s: r.m ? h('bdi', null, r.m) : '', v: usd(r.usd), tr: Math.round(r.sh * 100) + '%', meter: [r.sh * 100, ''] }))));
    const eng = v.eng || [];
    if (eng.length) p.append(grp(t('admAiSecEng')), list(...eng.map((e) => row({ c: e.e === 'api' ? 'blue' : 'green', ic: e.e === 'api' ? '☁' : '◆', t: e.e === 'api' ? t('admAiEngApi') : t('admAiEngSub'), s: fmt(t('admAiEngS'), { n: e.n || 0, c: usd(e.cpm, 3) }), v: usd(e.usd) }))));
    const modes = (v.modes || []).filter((m) => m.n);
    if (modes.length) p.append(grp(t('admAiSecMode')), list(...modes.map((m) => row({ c: 'gray', ic: '◎', t: modeName(m.m), s: fmt(t('admAiModeS'), { n: m.done || 0, c: usd(m.cpm, 3) }), v: m.jd != null ? String(Math.round(m.jd)) : m.q != null ? String(Math.round(m.q)) : '', tr: m.jd != null ? t('admKjd') : m.q != null ? t('admKq') : '' }))));
  }
  if (ai) {
    const L = ai.lim;
    p.append(grp(t('admAiSecAc')), list(
      row({ c: 'academy', ic: '✦', t: t('admAiCalls'), s: fmt(t('admOfMax'), { n: ai.today.t, m: L.total }), meter: [ai.pct, ai.pct >= 100 ? 'x' : ai.pct >= 80 ? 'w' : ''], sp: spark(ai.days.map((x) => x.t), COL.academy) }),
      row({ c: 'academy', ic: '▤', t: t('admAiIns'), s: fmt(t('admOfMax'), { n: ai.today.i, m: L.ins }), meter: [L.ins ? ai.today.i / L.ins * 100 : 0, ''] }),
      row({ c: 'academy', ic: '👥', t: t('admAiReaders'), s: fmt(t('admAiReadersS'), { m: L.user }), v: ai.today.u }),
      row({ c: 'gray', ic: '∑', t: t('admAiWeek'), v: ai.wk.t, tr: ai.wk.p ? (ai.wk.t >= ai.wk.p ? '▲ ' : '▼ ') + Math.abs(Math.round((ai.wk.t / ai.wk.p - 1) * 100)) + '%' : '', trc: ai.wk.t > ai.wk.p ? 'up' : 'dn' })));
    if (ai.month) {
      const m = ai.month;
      p.append(grp(t('admAiSecSrv')), list(
        row({ c: 'studio', ic: '☁', t: t('admAiMonth'), s: fmt(t('admAiMonthS'), { n: m.users }), v: usd(m.usd) }),
        row({ c: m.cap && m.top >= 0.8 * m.cap ? 'orange' : 'gray', ic: '∑', t: t('admAiTop'), s: fmt(t('admAiTopS'), { c: usd(m.cap, 0) }), v: usd(m.top), meter: [m.cap ? m.top / m.cap * 100 : 0, m.cap && m.top >= 0.8 * m.cap ? 'w' : ''] })));
    }
  }
  p.append(h('p', 'adm-foot', t('admAiNote')));
} });
/* ---- בדיקת מוכנות (15/10/2026, Instance Scan): כל בדיקה נולדה מתקלה שכבר הייתה אצלנו. בשורה — מה נבדק, ובכשל גם מה עושים ---- */
async function needReady(fresh) {
  if (!fresh && D.rd && Date.now() - D.rdAt < 60000) return;
  const r = await api('adminReady', fresh ? { fresh: 1 } : {});
  if (r.ok) { D.rd = r.rd; D.rdAt = Date.now(); if (['ready', 'sys'].includes(cur)) paint(); }
}
const RD_DN = { ant_key: () => t('admItAnt'), brk13f: () => t('admItBrk'), sec_txt: () => t('admItSec'), drill: () => t('admItDrill') };
function readyRow(x) {
  const v = x.v || {};
  const T = { cache: [t('admRdCache'), t('admRdCacheOk'), fmt(t('admRdCacheBad'), { h: [...(v.bad || []), ...(v.miss || [])].join(' · ') }), t('admRdCacheFix')],
    live: [t('admRdLive'), fmt(t('admRdLiveOk'), { b: (v.b || {}).invest || '—' }), Object.entries(v.b || {}).map(([k, b]) => k + ' ' + (b || '—')).join(' · '), t('admRdLiveFix')],
    api: [t('admRdApi'), t('admRdApiOk'), t('admRdApiBad'), t('admRdApiFix')],
    fb: [t('admRdFb'), t('admRdFbOk'), t('admRdFbBad'), t('admRdFbFix')],
    sess: [t('admRdSess'), t('admRdSessOk'), v.read ? fmt(t('admRdSessBad'), { n: v.n }) : t('admRdNoRead'), t('admRdSessFix')],
    links: [t('admRdLinks'), t('admRdLinksOk'), v.n == null ? t('admRdNoRead') : fmt(t('admRdLinksBad'), { n: v.n }), t('admRdLinksFix')],
    sec: [t('admRdSec'), fmt(t('admRdSecOk'), { n: v.left }), v.left == null ? t('admRdNoRead') : fmt(t('admRdSecBad'), { n: v.left }), t('admRdSecFix')],
    dates: [t('admRdDates'), fmt(t('admRdDatesOk'), { n: v.next }), (v.soon || []).map((d) => (RD_DN[d.k] || (() => d.k))() + ' · ' + d.left).join(' · '), t('admRdDatesFix')] }[x.k];
  if (!T) return null;
  if (x.ok) return row({ c: 'green', ic: '✓', t: T[0], s: T[1] });
  const sub = h('span'); sub.append(h('span', null, T[2])); const fx = h('span', 'adm-fix', T[3]); sub.append(fx);
  return row({ c: x.sev === 1 ? 'red' : 'orange', ic: '!', t: T[0], s: sub });
}
page('ready', { tab: 'sys', parent: 'sys', title: () => t('admRdT'), render(p) {
  const r = D.rd;
  if (!r) { needReady(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  p.append(h('p', 'adm-dt', fmt(t('admRdHead'), { a: ago(r.at), p: r.pass, n: r.n })));
  const bad = r.checks.filter((x) => !x.ok), good = r.checks.filter((x) => x.ok);
  if (bad.length) p.append(grp(t('admRdBad')), list(...bad.map(readyRow)));
  if (good.length) p.append(grp(t('admRdGood')), list(...good.map(readyRow)));
  p.append(list(row({ c: 'blue', ic: '⟲', t: t('admRdAgain'), on: async () => { p.querySelector('.adm-dt').textContent = t('admLoading'); await needReady(true); } })));
  p.append(h('p', 'adm-foot', t('admRdFoot')));
} });
/* ---- התראות לטלפון (15/10/2026, On-call): רק מה שלא יכול לחכות. משתמש בהתראות שכבר קיימות ב־Studio (Web Push) ---- */
const PUSH_KINDS = [['red', '!', () => t('admPushSite'), () => t('admPushSiteS')], ['red', '☁', () => t('admPushSrv'), () => t('admPushSrvS')], ['red', '▶', () => t('admPushMajor'), () => t('admPushMajorS')],
  ['orange', '✓', () => t('admPushReady'), () => t('admPushReadyS')], ['orange', '⟲', () => t('admPushBk'), () => t('admPushBkS')]];
page('push', { tab: 'sys', parent: 'sys', title: () => t('admPushT'), render(p) {
  const P = D.push || { n: 0, me: false };
  const on = P.n > 0 && P.me;
  p.append(h('p', 'adm-dt', on ? fmt(t('admPushOnS'), { n: P.n }) : !P.n ? t('admPushOffS') : t('admPushNotMe')));
  p.append(grp(t('admPushSec')), list(...PUSH_KINDS.map(([c, ic, tt, ss]) => row({ c, ic, t: tt(), s: ss(), v: on ? t('studioOnShort') : t('studioOffShort') }))));
  if (P.n) p.append(list(row({ c: 'blue', ic: '◉', t: t('admPushTest'), on: async () => { const j = await api('push', { act: 'test' }); flash(j.ok && j.sent ? t('admPushSent') : t('admErr')); } })));
  else p.append(list(row({ c: 'studio', ic: '↗', t: t('admPushHow'), s: t('admPushHowS'), on: () => { try { window.open(APP_URL.studio, '_self'); } catch (e) {} } })));
  p.append(h('p', 'adm-foot', t('admPushFoot')));
} });
page('quota', { tab: 'sys', parent: 'sys', title: () => t('admQuota'), render(p) {
  const ai = D.ai, o = D.ov;
  if (!ai) needAi();
  const DN = { ant_key: () => t('admItAnt'), brk13f: () => t('admItBrk'), sec_txt: () => t('admItSec'), drill: () => t('admItDrill') };
  if (o && o.dates) p.append(grp(t('admSecDates')), list(...o.dates.map((d) => row({ c: d.left <= 7 ? 'red' : d.left <= 30 ? 'orange' : 'gray', ic: '⧗', t: (DN[d.k] || (() => d.k))(), s: d.d, v: d.left, tr: t('admDays') }))));
  if (ai) {
    const L = ai.lim, rows = [];
    if (ai.fns) rows.push(row({ c: ai.fns.n >= ai.fns.max ? 'orange' : 'green', ic: '▲', t: t('admQFn'), s: fmt(t('admOfMax'), { n: ai.fns.n, m: ai.fns.max }), meter: [ai.fns.n / ai.fns.max * 100, ai.fns.n >= ai.fns.max ? 'w' : ''] }));
    rows.push(row({ c: 'academy', ic: '✦', t: t('admQAiDay'), v: L.total, tr: t('admQPerDay') }));
    rows.push(row({ c: 'academy', ic: '👤', t: t('admQAiUser'), s: fmt(t('admQAnon'), { n: L.anon }), v: L.user, tr: t('admQPerDay') }));
    rows.push(row({ c: 'academy', ic: '▤', t: t('admQAiIns'), v: L.ins, tr: t('admQPerDay') }));
    if (ai.month) rows.push(row({ c: 'studio', ic: '☁', t: t('admQStCap'), v: usd(ai.month.cap, 0), tr: t('admQPerMonth') }));
    p.append(grp(t('admQSecLim')), list(...rows));
  }
  p.append(h('p', 'adm-foot', t('admQNote')));
} });
page('imp', { tab: 'imp', title: () => t('admTabImp'), render(p) {
  if (!D.tk) needTasks();
  const v = D.lab && D.lab.view;
  const top = v && (v.ins || [])[0];
  p.append(list(
    row({ c: 'purple', ic: '✦', t: t('admLabT'), s: top ? insName(top.k) : t('admLabNone'), v: v ? (v.ins || []).length : '', tr: t('admInsShort'), on: () => go('lab') }),
    row({ c: 'blue', ic: '◇', t: t('admClaudeT'), s: t('admClaudeShort'), on: () => go('claude') }),
    row({ c: 'orange', ic: '◎', t: t('admGoldT'), s: t('admGoldShort'), on: () => go('gold') }),
    row({ c: 'gray', ic: '⇄', t: t('admTeam'), s: D.tk && D.tk.tk ? fmt(t('admTeamS'), { n: D.tk.tk.items.length, w: D.tk.tk.items.filter((x) => x.w).length }) : '', on: () => go('team') })));
} });
/* ---- ריצת מבחן (פריט 15 בסבב הייעול, 21/10/2026): עבודת זהב (תרגום אנושי לייחוס) × כמה מצבים, על השרת של המערכת.
   אומדן ואישור לפני; העבודות נוצרות ב־goldRun ומתחילות ב־start (כל השמירות הרגילות); הציון (chrF++, כיסוי זמן) — מהעובד ---- */
// ניסוי המאמץ: pr = ההגהה והביקורת במאמץ בינוני; all = גם התרגום (פריט 8 בסבב הייעול)
const GOLD_XES = { pr: { main: 'medium', rv: 'medium' }, all: { main: 'medium', tl: 'medium', rv: 'medium' } }, GOLD_MAX = 5;   // = S.GOLD_MAX בשרתון
const GOLD_MODES = ['haiku-medium', 'haiku-high', 'sonnet-low', 'sonnet-medium', 'sonnet-high', 'opus-medium'];
const jobUsd = (j) => (Array.isArray(j.use) ? j.use : []).reduce((a, r) => a + (r && typeof r.usd === 'number' ? r.usd : 0), 0);
async function needGold(force) {
  if (D.gj && !force && Date.now() - D.gjAt < 30000) return;
  const [j, s] = await Promise.all([api('jobs'), api('status')]);
  D.gj = j.ok ? { jobs: j.jobs || [], nA: (s && s.normA) || {} } : { err: true }; D.gjAt = Date.now();
  if (cur === 'gold') paint();
}
function goldEst(src, m) {
  const ph = D.gj && D.gj.nA[m] && typeof D.gj.nA[m].ph === 'number' ? D.gj.nA[m].ph : null;
  const dur = (src && src.spec && +src.spec.dur) || 0;
  return ph == null || !dur ? null : ph * dur / 3600 + 0.05;
}
page('gold', { tab: 'imp', parent: 'imp', title: () => t('admGoldT'), render(p) {
  if (!D.gj) { needGold(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  if (D.gj.err) { p.append(h('p', 'adm-note', t('admErr'))); return; }
  const jobs = D.gj.jobs.filter((j) => !j.sm), srcs = jobs.filter((j) => j.gd && j.state === 'done' && !j.gs);
  p.append(h('p', 'adm-sub', t('admGoldSub')));
  if (!srcs.length) { p.append(list(row({ c: 'gray', ic: '◎', t: t('admGoldNone'), s: t('admGoldNoneS') }))); return; }
  if (!srcs.some((j) => j.id === D.gSrc)) D.gSrc = srcs[0].id;
  if (!D.gModes) D.gModes = new Set(['haiku-high']);
  const src = srcs.find((j) => j.id === D.gSrc);
  p.append(grp(t('admGoldSrc')), list(...srcs.map((j) => row({ c: j.id === D.gSrc ? 'orange' : 'gray', ic: j.id === D.gSrc ? '●' : '○',
    t: (j.spec && j.spec.name) || j.id, s: modeName(j.spec && j.spec.mode) + (j.gq ? ' · chrF++ ' + j.gq.s : ''), on: () => { D.gSrc = j.id; paint(); } }))));
  p.append(grp(t('admGoldModes')), list(...GOLD_MODES.map((m) => { const e = goldEst(src, m); return row({ c: D.gModes.has(m) ? 'blue' : 'gray', ic: D.gModes.has(m) ? '✓' : '',
    t: modeName(m), v: e == null ? '' : '≈' + usd(e), on: () => { if (D.gModes.has(m)) D.gModes.delete(m); else D.gModes.add(m); paint(); } }); })));
  // 24/10/2026: ניסוי המאמץ — כל מצב שנבחר רץ פעמיים (רגיל + הגהה וביקורת במאמץ בינוני)
  const xeRow = (k, tt, ss) => row({ c: D.gXe === k ? 'purple' : 'gray', ic: D.gXe === k ? '✓' : '', t: tt, s: ss, on: () => { D.gXe = D.gXe === k ? '' : k; paint(); } });
  p.append(list(xeRow('pr', t('admGoldXe'), t('admGoldXeS')), xeRow('all', t('admGoldXeAll'), t('admGoldXeAllS'))));
  const k = D.gXe ? 2 : 1, sel = GOLD_MODES.filter((m) => D.gModes.has(m)), tot = k * sel.reduce((a, m) => a + (goldEst(src, m) || 0), 0);
  const runs = jobs.filter((j) => j.gs === D.gSrc);
  const busy = runs.some((j) => ['new', 'queued', 'running'].includes(j.state));
  const go1 = h('button', 'btn', fmt(t('admGoldRun'), { n: k * sel.length, u: usd(tot) })); go1.type = 'button'; go1.disabled = !sel.length || busy || k * sel.length > GOLD_MAX;
  go1.addEventListener('click', () => askConfirm(fmt(t('admGoldQ'), { n: k * sel.length, u: usd(tot) }), async () => {
    go1.disabled = true;
    const r = await api('goldRun', Object.assign({ ok: true, src: D.gSrc, modes: sel }, D.gXe ? { xe: GOLD_XES[D.gXe], both: true } : {}));
    if (!r.ok) { flash(t('admErr') + ' · ' + (r.error || '')); go1.disabled = false; return; }
    let bad = 0;
    for (const j of r.jobs || []) { const s2 = await api('start', { job: j.id }); if (!s2.ok) bad++; }
    flash(bad ? fmt(t('admGoldStartBad'), { n: bad }) : t('admGoldStarted'));
    needGold(true);
  }));
  const br = h('div', 'btn-row'); br.append(go1);
  p.append(br);
  if (busy) p.append(h('p', 'adm-foot', t('admGoldBusy')));
  if (runs.length) {
    const stTxt = (j) => (j.state === 'done' ? (j.gq ? 'chrF++ ' + j.gq.s + ' · ' + fmt(t('admGoldTm'), { n: j.gq.tm }) : t('admGoldNoScore')) : j.state === 'failed' ? t('admGoldFailed') : t('admGoldRunning'));
    p.append(grp(t('admGoldRes'), [t('admGoldRefresh'), () => needGold(true)]), list(...runs.sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 18).map((j) =>
      row({ c: j.state === 'done' ? (j.gq ? 'green' : 'gray') : j.state === 'failed' ? 'red' : 'blue', ic: '◎', t: modeName(j.spec && j.spec.mode) + (j.spec && j.spec.xe ? ' · ' + (j.spec.xe.tl ? t('admGoldXeTagAll') : t('admGoldXeTag')) : '') + ' · ' + day(j.created), s: stTxt(j),
        v: jobUsd(j) ? usd(jobUsd(j)) : '' }))));
  }
  p.append(h('p', 'adm-foot', t('admGoldFoot')));
} });
/* ---- סשנים ומשימות (15/10/2026): משימות-פתוחות.md מהריפו — מה בעבודה ובידי איזה סשן, מה עם תאריך, PR פתוחים ---- */
async function needTasks() {
  if (D.tk && Date.now() - D.tkAt < 60000) return;
  const r = await api('adminTasks');
  if (r.ok) { D.tk = r; D.tkAt = Date.now(); if (['team', 'imp', 'ov', 'checks', 'check'].includes(cur)) paint(); }
}
const sessShort = (x) => String(x || '').replace(/^session_/, '').slice(0, 6);
page('team', { tab: 'imp', parent: 'imp', title: () => t('admTeam'), render(p) {
  const d = D.tk;
  if (!d) { needTasks(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const gh = 'https://github.com/yishaiguedj1/portfolio-pwa';
  const open = (u) => () => { try { window.open(u, '_blank', 'noopener'); } catch (e) {} };
  const items = (d.tk && d.tk.items) || [];
  if (!d.tk) p.append(h('p', 'adm-note', t('admErr')));
  else p.append(h('p', 'adm-dt', fmt(t('admTeamS'), { n: items.length, w: items.filter((x) => x.w).length })));
  const wk = items.filter((x) => x.w);
  p.append(grp(t('admTeamNow')), wk.length ? list(...wk.map((x) => row({ c: 'purple', ic: '◇', t: x.t, s: [x.w.n || sessShort(x.w.by), x.w.d].filter(Boolean).join(' · ') }))) : list(row({ c: 'gray', ic: '—', t: t('admTeamNone') })));
  const L = d.lane;
  if (L) {
    // נתיב הפריסה: מי מחזיק, מה בתור ובאיזה סדר למזג (CLAUDE.md סעיף 11) — במקום רשימת ה־PR
    const lr = [];
    lr.push(L.holder ? row({ c: 'orange', ic: '⇪', t: fmt(t('admLaneHeld'), { n: L.holder.n, b: L.holder.b }) + (L.holder.rel ? ' · ' + L.holder.rel : ''), s: h('bdi', null, L.holder.t), on: open(gh + '/pull/' + L.holder.n) })
      : row({ c: L.deploy ? 'orange' : 'green', ic: L.deploy ? '⇪' : '✓', t: L.deploy ? t('admLaneDeploy') : t('admLaneFree') }));
    if (L.holder && L.deploy) lr.push(row({ c: 'orange', ic: '⧗', t: t('admLaneDeploy') }));
    L.queue.forEach((x, i) => lr.push(row({ c: 'gray', ic: String(i + 2), t: fmt(t('admItPr'), { n: x.n }) + (x.b ? ' · ' + fmt(t('admRunBuild'), { b: x.b }) : ''), s: h('bdi', null, x.t), on: open(gh + '/pull/' + x.n) })));
    for (const x of L.other) lr.push(row({ c: 'gray', ic: '⇄', t: fmt(t('admItPr'), { n: x.n }), s: h('bdi', null, x.t), on: open(gh + '/pull/' + x.n) }));
    p.append(grp(t('admLaneT')), list(...lr));
    if (L.holder && L.queue.length) p.append(h('p', 'adm-foot', fmt(t('admLaneOrder'), { n: L.holder.n })));
  }
  const dated = items.filter((x) => x.left != null).sort((a, b) => a.left - b.left);
  if (dated.length) p.append(grp(t('admSecDates')), list(...dated.map((x) => row({ c: x.left <= 7 ? 'red' : x.left <= 30 ? 'orange' : 'gray', ic: '⧗', t: x.t, v: x.left, tr: t('admDays') }))));
  if (d.tk) {
    const rows = [];
    for (const sc of d.tk.secs) {
      const on = !!D.tkOpen[sc.s];
      rows.push(row({ c: 'gray', ic: on ? '▾' : (de.dir === 'rtl' ? '◂' : '▸'), t: sc.s, v: sc.n, on: () => { D.tkOpen[sc.s] = !on; paint(); } }));
      if (on) for (const x of items.filter((y) => y.s === sc.s)) rows.push(row({ c: x.w ? 'purple' : 'gray', ic: x.w ? '◇' : '·', t: x.t, s: x.w ? sessShort(x.w.by) + ' · ' + x.w.d : '' }));
    }
    p.append(grp(t('admTeamBy')), list(...rows));
  }
  const src = h('a'); src.append(h('bdi', null, t('admTeamSrc'))); src.href = gh + '/blob/main/' + encodeURIComponent('משימות-פתוחות.md'); src.target = '_blank'; src.rel = 'noopener';
  const f = h('p', 'adm-foot'); f.append(t('admTeamNote') + ' ', src); p.append(f);
} });
/* ---- לבדוק בטלפון (15/10/2026, "אימות אחרי שינוי" של ServiceNow): המקטע ברשימה בריפו + התשובה שלך.
   "עובד" יורד מהרשימה; "לא עובד" נשאר עם ההערה, והסשן רואה אותה במשיכה (tools/learn-pull.js → checks.json) ---- */
function checkRow(x) {
  return row({ c: x.st === 'no' ? 'red' : 'blue', ic: x.st === 'no' ? '!' : '☐', t: x.t, s: x.st === 'no' ? fmt(t('admChkNo'), { n: x.n || '—' }) : '', on: () => { D.ckSel = x.id; go('check'); } });
}
page('checks', { tab: 'ov', parent: 'ov', title: () => t('admChkT'), render(p) {
  const ck = D.tk && D.tk.ck;
  if (!ck) { needTasks(); p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  p.append(h('p', 'adm-dt', t('admChkS')));
  p.append(ck.open.length ? list(...ck.open.map(checkRow)) : list(row({ c: 'green', ic: '✓', t: t('admChkNone') })));
  if (ck.done.length) p.append(grp(fmt(t('admChkDone'), { n: ck.done.length })), list(...ck.done.map((x) => row({ c: 'green', ic: '✓', t: x.t, s: day(x.at), on: () => { D.ckSel = x.id; go('check'); } }))));
} });
page('check', { tab: 'ov', parent: 'checks', title: () => t('admChkOne'), render(p) {
  const ck = D.tk && D.tk.ck, x = ck && [...ck.open, ...ck.done].find((y) => y.id === D.ckSel);
  if (!x) { p.append(h('p', 'adm-note', t('admChkGone'))); return; }
  const card = h('section', 'card adm-card');
  card.append(h('h2', null, x.t), h('p', 'adm-sub', x.st === 'ok' ? fmt(t('admChkWasOk'), { d: day(x.at) }) : x.st === 'no' ? fmt(t('admChkWasNo'), { d: day(x.at) }) : t('admChkAsk')));
  const note = h('textarea', 'adm-search adm-note-in'); note.id = 'admChkNote'; note.rows = 3; note.maxLength = 300; note.placeholder = t('admChkNoteP'); note.setAttribute('dir', 'auto'); note.value = x.n || '';
  note.hidden = x.st !== 'no';
  const br = h('div', 'btn-row');
  const bOk = h('button', 'btn', t('admChkOk')); bOk.type = 'button';
  const bNo = h('button', 'btn secondary-btn', x.st === 'no' ? t('admChkSend') : t('admChkBad')); bNo.type = 'button';
  const save = async (st) => {
    bOk.disabled = bNo.disabled = true;
    const j = await api('adminCheck', { id: x.id, st, note: note.value, t: x.t }); D.log = null;
    bOk.disabled = bNo.disabled = false;
    if (!j.ok) { flash(t('admErr')); return; }
    Object.assign(x, { st, n: st === 'no' ? note.value.trim() : '', at: Date.now() });
    if (st === 'ok') { ck.open = ck.open.filter((y) => y !== x); if (!ck.done.includes(x)) ck.done.unshift(x); }
    else if (!ck.open.includes(x)) { ck.done = ck.done.filter((y) => y !== x); ck.open.unshift(x); }
    flash(st === 'ok' ? t('admChkSavedOk') : t('admChkSavedNo'));
    history.length > 1 ? history.back() : go('checks');
  };
  bOk.addEventListener('click', () => save('ok'));
  bNo.addEventListener('click', () => { if (note.hidden) { note.hidden = false; note.focus(); bNo.textContent = t('admChkSend'); return; } save('no'); });
  br.append(bOk, bNo);
  card.append(note, br);
  p.append(card);
  if (x.st) { const u = h('button', 'mini-btn', t('admChkUndo')); u.type = 'button'; u.addEventListener('click', async () => { const j = await api('adminCheck', { id: x.id, st: '', t: x.t }); D.log = null; if (j.ok) { delete x.st; x.n = ''; ck.done = ck.done.filter((y) => y !== x); if (!ck.open.includes(x)) ck.open.push(x); paint(); } }); card.append(u); }
  p.append(h('p', 'adm-foot', t('admChkFoot')));
} });
page('claude', { tab: 'imp', parent: 'imp', title: () => t('admClaudeT'), render(p) { p.append(claudeCard()); } });
page('find', { tab: 'find', title: () => t('admTabFind'), render(p) {
  const inp = h('input', 'adm-search'); inp.type = 'search'; inp.placeholder = t('admFindPh'); inp.setAttribute('aria-label', t('admFindPh'));
  const res = h('div');
  const run = () => {
    const q = inp.value.trim().toLowerCase();
    const hits = Object.entries(PAGES).filter(([k]) => k !== 'find').map(([k, P]) => [k, P, P.title()]).filter(([, , tt]) => !q || tt.toLowerCase().includes(q));
    res.replaceChildren(list(...hits.map(([k, P, tt]) => row({ c: 'gray', ic: '›', t: tt, s: P.parent ? PAGES[P.parent].title() : '', on: () => go(k) }))));
  };
  inp.addEventListener('input', run);
  p.append(inp, res);
  run();
  setTimeout(() => { try { inp.focus(); } catch (e) {} }, 50);
} });

if (first === 'out') { loginGate({ app: 'admin', auth: A, logo: 'logo-invest.webp', logoLg: 'logo-invest-lg.webp', name: t('admT') }); done(); }
else boot();

async function load() {
  const [ov, lab] = await Promise.all([api('adminOv'), api('learn')]);
  D.ov = ov.ok ? ov.ov : null; D.push = ov.ok ? ov.push : null; D.lab = lab; D.ovAt = Date.now();
  return { ov, lab };
}
async function boot() {
  root.append(h('p', 'adm-wait', t('admLoading')));
  const { ov, lab } = await load();
  done();
  if ([ov.error, lab.error].some((e) => e === 'not_admin' || e === 'not_allowed')) {
    root.replaceChildren(h('p', 'adm-note', t('admNoAdmin')), accountCard(A, 'icon-192.png'));
    return;
  }
  const k = (location.hash || '#ov').slice(1);
  cur = PAGES[k] ? k : 'ov';
  try { history.replaceState({ adm: cur }, '', '#' + cur); } catch (e) {}
  paint();
  document.addEventListener('visibilitychange', async () => { if (!document.hidden && Date.now() - D.ovAt > 60000) { await load(); paint(); } });
}

/* ---- לנתח עם Claude: חבילה להדבקה, קובץ, וטוקן לסשן של Claude Code ---- */
function claudeCard() {
  const card = h('section', 'card adm-card');
  card.append(h('h2', null, t('admClaudeT')), h('p', 'adm-sub', t('admClaudeS')));
  const row = h('div', 'btn-row');
  const bCopy = h('button', 'btn', t('admCopyBrief')); bCopy.type = 'button';
  const bFile = h('button', 'btn secondary-btn', t('admDownload')); bFile.type = 'button';
  let pack = null;
  const getPack = async () => { if (pack) return pack; const j = await api('learnBrief'); if (j.ok) pack = j; else flash(t('admErr')); return j.ok ? j : null; };
  bCopy.addEventListener('click', async () => { bCopy.disabled = true; const p = await getPack(); bCopy.disabled = false; if (p) copyText(p.brief); });
  bFile.addEventListener('click', async () => {
    bFile.disabled = true; const p = await getPack(); bFile.disabled = false;
    if (p) download('snb-learn-' + new Date(p.at).toISOString().slice(0, 10) + '.json', JSON.stringify({ brief: p.brief, records: p.records }, null, 1));
  });
  row.append(bCopy, bFile);
  card.append(row);
  // הטוקן לסשן — מוצג פעם אחת
  const tk = h('div', 'adm-tok');
  const bTok = h('button', 'btn secondary-btn', t('admTokNew')); bTok.type = 'button';
  const shown = h('div', 'adm-shown'); shown.hidden = true;
  const list = h('div', 'ios-list adm-toks');
  bTok.addEventListener('click', async () => {
    bTok.disabled = true;
    const j = await api('atNew', { name: 'Claude Code' });
    bTok.disabled = false;
    if (!j.ok) { flash(t('admErr')); return; }
    const cmd = 'SNB_LEARN_TOKEN=' + j.token + ' node tools/learn-pull.js';
    shown.replaceChildren(h('p', 'adm-sub', t('admTokOnce')), codeRow(j.token), h('p', 'adm-sub', t('admTokCmd')), codeRow(cmd));
    shown.hidden = false;
    paintToks();
  });
  const paintToks = async () => {
    const j = await api('atList');
    list.replaceChildren(h('div', 'adm-lbl', t('admTokList')));
    const act = (j.tokens || []).filter((x) => x.exp > Date.now());
    if (!act.length) { list.append(h('div', 'ios-row adm-dim', t('admTokNone'))); return; }
    for (const x of act) {
      const r = h('div', 'ios-row adm-trow');
      const tx = h('span', 'adm-ttx'); tx.append(h('b', null, x.n), h('small', null, fmt(t('admTokMeta'), { a: day(x.at), e: day(x.exp), u: x.uses })));
      const del = h('button', 'mini-btn danger', t('admTokDel')); del.type = 'button';
      del.addEventListener('click', () => askConfirm(t('admTokDelQ'), async () => { await api('atDel', { id: x.id }); paintToks(); }, { danger: true }));
      r.append(tx, del); list.append(r);
    }
  };
  tk.append(bTok, shown, list);
  card.append(tk);
  paintToks();
  return card;
}
function codeRow(text) {
  const r = h('div', 'adm-code');
  const c = h('code', null, text); c.dir = 'ltr';
  const b = h('button', 'mini-btn', t('admCopy')); b.type = 'button';
  b.addEventListener('click', () => copyText(text));
  r.append(c, b);
  return r;
}

/* ---- מעבדת השיפור (מ׳6, 20/10/2026): מסך ראשי + עמודי משנה. כל החישובים בשרתון (learnView ב־lib/studiolearn.js) — כאן רק מציגים.
   הכי חשוב עכשיו → אריחים מול 30 הימים הקודמים (עם מגמה שבועית) → שורה לכל נושא. עמוד המשנה של מסקנה = מה לעשות + המספרים.
   בלי מספרים מומצאים: נתון שחסר = "—" */
const LV = () => (D.lab && D.lab.ok && D.lab.view) || null;
const nz = (x) => x != null && isFinite(x);
const pcTxt = (x) => (nz(x) ? (Math.abs(x) < 0.1 && x !== 0 ? (x * 100).toFixed(1) : Math.round(x * 100)) + '%' : '—');
const usdTxt = (x, d) => (nz(x) ? '$' + (x >= 100 ? Math.round(x).toLocaleString('en-US') : x.toFixed(d != null ? d : x < 1 ? 3 : 2)) : '—');
const numTxt = (x) => (nz(x) ? (Math.abs(x) >= 1000 ? Math.round(x).toLocaleString('en-US') : String(Math.round(x * 10) / 10)) : '—');
const kTok = (x) => (!nz(x) ? '—' : x >= 1e6 ? (x / 1e6).toFixed(1) + 'M' : x >= 1e3 ? Math.round(x / 1e3) + 'K' : String(x));
const durTxt = (s) => (!nz(s) ? '—' : s < 90 ? Math.round(s) + t('admSecU') : s < 5400 ? Math.round(s / 60) + t('admMinU') : (s / 3600).toFixed(1) + t('admHrU'));
const ltr = (s) => '⁦' + s + '⁩';
function modeTxt(m) { return String(m || '—').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '); }
const roleTxt = (k) => (ROLE[k] ? ROLE[k]() : k || '—');
function stgTxt(k) {
  switch (k) {
    case 'up': return t('admStgUp');
    case 'tr': return t('admStgTr');
    case 'al': return t('admStgAl');
    case 'tl': return t('admStgTl');
    case 'rv': return t('admStgRv');
    case 'bn': return t('admStgBn');
    case 'sv': return t('admStgSv');
    default: return k || '—';
  }
}
function jgTxt(k) {
  switch (k) {
    case 'mean': return t('studioJgMean');
    case 'omit': return t('studioJgOmit');
    case 'add': return t('studioJgAdd');
    case 'gram': return t('studioJgGram');
    case 'flu': return t('studioJgFlu');
    case 'term': return t('studioJgTerm');
    default: return k || '—';
  }
}
function qTxt(k) {
  switch (k) {
    case 'cps': return t('studioQCps');
    case 'len': return t('studioQLen');
    case 'lines': return t('studioQLines');
    case 'dur': return t('studioQDur');
    case 'en': return t('studioQEn');
    case 'chk': return t('studioQChk');
    default: return k || '—';
  }
}
function stTxt(s) {
  switch (s) {
    case 'done': return t('admJsDone');
    case 'failed': return t('admJsFail');
    case 'cancelled': return t('admJsCancel');
    default: return s || '—';
  }
}
/* כל מסקנה: שם, ומה לעשות (מהקוד — השרתון שולח רק קוד ומספרים) */
function insName(k) {
  switch (k) {
    case 'fail_top': return t('admI_fail_top');
    case 'first_pass': return t('admI_first_pass');
    case 'cache_low': return t('admI_cache_low');
    case 'cost_role': return t('admI_cost_role');
    case 'think_heavy': return t('admI_think_heavy');
    case 'truncated': return t('admI_truncated');
    case 'cache_miss': return t('admI_cache_miss');
    case 'fix_heavy': return t('admI_fix_heavy');
    case 'rv_idle': return t('admI_rv_idle');
    case 'rv_heavy': return t('admI_rv_heavy');
    case 'judge_top': return t('admI_judge_top');
    case 'q_metric': return t('admI_q_metric');
    case 'edits_after': return t('admI_edits_after');
    case 'ai_after': return t('admI_ai_after');
    case 'slow_stage': return t('admI_slow_stage');
    case 'wait_user': return t('admI_wait_user');
    case 'sla_over': return t('admI_sla_over');
    case 'eta_off': return t('admI_eta_off');
    case 'rv_unrev': return t('admI_rv_unrev');
    case 'asr_weak': return t('admI_asr_weak');
    case 'align_weak': return t('admI_align_weak');
    case 'sync_low': return t('admI_sync_low');
    case 'mode_value': return t('admI_mode_value');
    case 'ver_worse': return t('admI_ver_worse');
    case 'ver_better': return t('admI_ver_better');
    case 'inject_seen': return t('admI_inject_seen');
    case 'gold': return t('admI_gold');
    case 'need_data': return t('admI_need_data');
    case 'num_drop': return t('admI_num_drop');
    case 'omit_cues': return t('admI_omit_cues');
    case 'tm_late': return t('admI_tm_late');
    case 'shot_near': return t('admI_shot_near');
    case 'name_var': return t('admI_name_var');
    case 'gl_miss': return t('admI_gl_miss');
    default: return k;
  }
}
function insAct(k) {
  switch (k) {
    case 'fail_top': return t('admA_fail_top');
    case 'first_pass': return t('admA_first_pass');
    case 'cache_low': return t('admA_cache_low');
    case 'cost_role': return t('admA_cost_role');
    case 'think_heavy': return t('admA_think_heavy');
    case 'truncated': return t('admA_truncated');
    case 'cache_miss': return t('admA_cache_miss');
    case 'fix_heavy': return t('admA_fix_heavy');
    case 'rv_idle': return t('admA_rv_idle');
    case 'rv_heavy': return t('admA_rv_heavy');
    case 'judge_top': return t('admA_judge_top');
    case 'q_metric': return t('admA_q_metric');
    case 'edits_after': return t('admA_edits_after');
    case 'ai_after': return t('admA_ai_after');
    case 'slow_stage': return t('admA_slow_stage');
    case 'wait_user': return t('admA_wait_user');
    case 'sla_over': return t('admA_sla_over');
    case 'eta_off': return t('admA_eta_off');
    case 'rv_unrev': return t('admA_rv_unrev');
    case 'asr_weak': return t('admA_asr_weak');
    case 'align_weak': return t('admA_align_weak');
    case 'sync_low': return t('admA_sync_low');
    case 'mode_value': return t('admA_mode_value');
    case 'ver_worse': return t('admA_ver_worse');
    case 'ver_better': return t('admA_ver_better');
    case 'inject_seen': return t('admA_inject_seen');
    case 'gold': return t('admA_gold');
    case 'need_data': return t('admA_need_data');
    case 'num_drop': return t('admA_num_drop');
    case 'omit_cues': return t('admA_omit_cues');
    case 'tm_late': return t('admA_tm_late');
    case 'shot_near': return t('admA_shot_near');
    case 'name_var': return t('admA_name_var');
    case 'gl_miss': return t('admA_gl_miss');
    default: return '';
  }
}
/* המספרים של מסקנה — [תווית, ערך]. לכל שדה ב־v משמעות לפי המסקנה (m = מודל ב־cost_role, מדד ב־q_metric) */
function insFacts(x) {
  const v = x.v || {}, out = [];
  const add = (l, val) => { if (val != null && val !== '—' && val !== '') out.push([l, val]); };
  if (v.e) add(t('admFCode'), ltr(v.e));
  if (v.r) add(t('admFRole'), roleTxt(v.r));
  if (v.s) add(t('admFStage'), stgTxt(v.s));
  if (v.st) add(t('admFStage'), stgTxt(v.st));
  if (v.c) add(t('admFJudge'), jgTxt(v.c));
  if (x.k === 'q_metric' && v.m) add(t('admFMetric'), qTxt(v.m));
  else if (v.m) add(t('admFModel'), ltr(String(v.m).replace(/^claude-/, '')));
  if (x.k === 'mode_value') { add(t('admFModeA'), modeTxt(v.a)); add(t('admFModeB'), modeTxt(v.b)); add(t('admFSave'), pcTxt(v.sv)); add(t('admFDq'), numTxt(v.d)); }
  if (x.k === 'ver_worse' || x.k === 'ver_better') { add(t('admFVerDim'), verDim(v.d)); add(t('admFVerNew'), ltr(v.a)); add(t('admFVerOld'), ltr(v.b)); if (v.k) add(t('admFVerMet'), verMetName(v.k)); add(t('admFVerN'), numTxt(v.na)); add(t('admFVerNb'), numTxt(v.nb)); }
  if (nz(v.p)) add(t('admFShare'), pcTxt(v.p));
  if (nz(v.n)) add(t('admFN'), numTxt(v.n));
  if (nz(v.j)) add(t('admFJobs'), numTxt(v.j));
  if (nz(v.usd)) add(t('admFUsd'), usdTxt(v.usd, 2));
  if (nz(v.spm)) add(t('admFSpm'), numTxt(v.spm));
  if (x.k === 'gold' && nz(v.s)) add(t('admFGold'), numTxt(v.s));
  if (nz(v.em)) add(t('admMxEmpty'), pcTxt(v.em));
  if (nz(v.sh)) add(t('admMxShort'), pcTxt(v.sh));
  if (nz(v.lt)) add(t('admMxLate'), pcTxt(v.lt));
  if (nz(v.ct)) add(t('admMxCut'), pcTxt(v.ct));
  if (nz(v.x)) add(t('admMxGlMix'), numTxt(v.x));
  if (x.imp) add(t('admFImp'), usdTxt(x.imp, 2));
  return out;
}
const SEV_C = { 1: 'red', 2: 'orange', 3: 'gray' };
const sevTxt = (s) => (s === 1 ? t('admSev1') : s === 2 ? t('admSev2') : t('admSev3'));
/* מגמה מול התקופה הקודמת: חץ + האם זה לטובה (dir: 1 = גבוה עדיף, -1 = נמוך עדיף) */
function trend(a, b, dir, f) {
  if (!nz(a) || !nz(b)) return ['', ''];
  if (a === b) return ['=', ''];
  const up = a > b;
  return [(up ? '↑ ' : '↓ ') + f(Math.abs(a - b)), (up ? dir > 0 : dir < 0) ? 'up' : 'dn'];
}
function labTile(c, lbl, key, dir, f, fd) {
  const v = LV(); if (!v) return null;
  const a = (v.k || {})[key], b = (v.kp || {})[key];
  if (a == null && b == null) return null;
  const [tr, trc] = trend(a, b, dir, fd || f);
  return tileEl(c, lbl, f(a), tr || (nz(b) ? fmt(t('admWas'), { v: f(b) }) : ''), trc, (v.wk || []).map((w) => w[key]));
}
function labHero(v) {
  const top = (v.ins || [])[0];
  const card = h('button', 'adm-top s' + (top ? top.sev : 3)); card.type = 'button';
  if (!top) { card.disabled = true; card.append(h('small', null, t('admNowTop')), h('b', null, t('admLabNone'))); return card; }
  const hd = h('small', null, t('admNowTop') + ' · ' + sevTxt(top.sev));
  card.append(hd, h('b', null, insName(top.k)), h('span', null, insAct(top.k)));
  if (top.imp) { const m = h('em', null, fmt(t('admImpMo'), { v: usdTxt(top.imp, 2) })); card.append(m); }
  card.addEventListener('click', () => { D.labI = 0; go('labIn'); });
  return card;
}
const needLab = (p) => { const v = LV(); if (!v) p.append(h('p', 'adm-note', D.lab && D.lab.error ? t('admErr') : t('admLoading'))); return v; };

page('lab', { tab: 'imp', parent: 'imp', title: () => t('admLabT'), render(p) {
  const v = needLab(p); if (!v) return;
  const k = v.k || {};
  p.append(h('p', 'adm-dt', fmt(t('admLabDt'), { n: v.n || 0, m: v.n90 || 0, d: v.first ? day(v.first) : '—' })));
  p.append(labHero(v));
  p.append(list(row({ c: 'green', ic: '↗', t: t('admImT'), s: imHeadline(v.im), on: () => go('labImp') }), wkRow(v)));
  p.append(grp(t('admLab30')), tiles(
    labTile('purple', t('admKn'), 'n', 1, numTxt),
    labTile('green', t('admKok'), 'ok', 1, pcTxt),
    labTile('blue', t('admKcpm'), 'cpm', -1, (x) => usdTxt(x, 3)),
    labTile('orange', t('admKspm'), 'spm', -1, numTxt),
    labTile('green', t('admKq'), 'q', 1, numTxt),
    labTile('purple', t('admKjd'), 'jd', 1, numTxt)));
  const fails = v.fails || [], roles = v.roles || [], stg = (v.stages || []).slice().sort((a, b) => b.sh - a.sh)[0];
  p.append(grp(t('admLabMore')), list(
    row({ c: 'orange', ic: '!', t: t('admLabIns'), s: (v.ins || []).length ? insName(v.ins[0].k) : t('admLabNone'), v: (v.ins || []).length, on: () => go('labIns') }),
    row({ c: 'blue', ic: '$', t: t('admLabCost'), s: roles.length ? fmt(t('admLabCostS'), { r: roleTxt(roles[0].k), p: pcTxt(roles[0].sh) }) : '', v: usdTxt(k.usd, 2), on: () => go('labCost') }),
    row({ c: 'orange', ic: '◷', t: t('admLabTime'), s: stg ? fmt(t('admLabTimeS'), { s: stgTxt(stg.k), p: pcTxt(stg.sh) }) : '', v: nz(k.spm) ? numTxt(k.spm) : '', tr: nz(k.spm) ? t('admSpmU') : '', on: () => go('labTime') }),
    row({ c: 'green', ic: '✓', t: t('admLabQual'), s: (v.jc && v.jc.c && v.jc.c[0]) ? fmt(t('admLabQualS'), { c: jgTxt(v.jc.c[0].k) }) : '', v: nz(k.jd) ? numTxt(k.jd) : nz(k.q) ? numTxt(k.q) : '', on: () => go('labQual') }),
    mxRow(v),
    verRow(v),
    dmRow(),
    row({ c: 'red', ic: '✕', t: t('admLabFails'), s: fails.length ? ltr(fails[0].e) + ' · ' + fails[0].n : t('admLabFailsNone'), v: fails.length ? fails.reduce((a, x) => a + x.n, 0) : 0, on: () => go('labFails') }),
    row({ c: 'purple', ic: '⇆', t: t('admLabModes'), s: (v.modes || []).map((x) => modeTxt(x.m)).join(' · '), v: (v.modes || []).length, on: () => go('labModes') }),
    row({ c: 'blue', ic: '↻', t: t('admLabAfter'), s: fmt(t('admLabAfterS'), { e: (v.follow || {}).ed || 0, r: (v.follow || {}).rr || 0 }), v: nz(k.ht) ? pcTxt(k.ht) : '', tr: nz(k.ht) ? 'HTER' : '', on: () => go('labAfter') }),
    row({ c: 'gray', ic: '≡', t: t('admLabRecent'), s: (v.recent || [])[0] ? day(v.recent[0].at) + ' · ' + modeTxt(v.recent[0].mode) : '', v: (v.recent || []).length, on: () => go('labRecent') }),
    row({ c: 'gray', ic: '▤', t: t('admLabData'), s: labDataSub(), on: () => go('labData') })));
  p.append(list(row({ c: 'blue', ic: '◇', t: t('admClaudeT'), s: t('admClaudeShort'), on: () => go('claude') })));
} });
function labDataSub() {
  const c = (D.lab && D.lab.corpus) || {}, d = (D.lab && D.lab.dev) || {};
  return fmt(t('admLabDataS'), { c: c.on ? (c.n || 0) + (c.q || 0) : '—', d: d.on ? t('admOn') : t('admOff') });
}
/* ---- השפעת המאגר לאורך זמן (21/10/2026, בקשת המשתמש: "כמה השתפר מנקודה לנקודה רק בזכות המאגר, ומאיפה בדיוק") ----
   כל החישוב בשרתון (lib/learnimpact.js → view.im); כאן רק הצגה. טווח מותאם = op learnImpact */
const IMV = () => { const v = LV(); return v && v.im ? (D.imCu && D.imR === 'cu' ? Object.assign({}, v.im, { cmp: Object.assign({}, v.im.cmp, D.imCu.cmp) }) : v.im) : null; };
function imName(k) {
  switch (k) {
    case 'tot': return t('admImM_tot'); case 'act': return t('admImM_act'); case 'up': return t('admImM_up'); case 'eta': return t('admImM_eta');
    case 'tr': return t('admImM_tr'); case 'al': return t('admImM_al'); case 'rv': return t('admImM_rv'); case 'bn': return t('admImM_bn'); case 'sv': return t('admImM_sv');
    case 'ok': return t('admImM_ok'); case 'crash': return t('admImM_crash'); case 'fail': return t('admImM_fail');
    case 'cpm': return t('admImM_cpm'); case 'tpm': return t('admImM_tpm');
    case 'q': return t('admImM_q'); case 'jd': return t('admImM_jd'); case 'ht': return t('admImM_ht'); case 'wok': return t('admImM_wok'); case 'num': return t('admImM_num'); case 'glm': return t('admImM_glm');
    default: return k;
  }
}
function imFam(f) {
  switch (f) { case 'speed': return t('admImFspeed'); case 'rel': return t('admImFrel'); case 'cost': return t('admImFcost'); case 'qual': return t('admImFqual'); default: return f; }
}
function imSrc(s) {
  switch (s) { case 'devlog': return t('admImSrcDev'); case 'lab': return t('admImSrcLab'); case 'user': return t('admImSrcUser'); case 'ops': return t('admImSrcOps'); default: return s; }
}
const IM_FMT = { eta: pcTxt, wok: pcTxt, cpm: (x) => usdTxt(x, 3), ok: pcTxt, crash: pcTxt, fail: pcTxt, ht: pcTxt, num: pcTxt, glm: pcTxt, q: numTxt, jd: numTxt, tpm: numTxt };
const imVal = (k, x) => (IM_FMT[k] || ((y) => (nz(y) ? numTxt(y) + ' ' + t('admImSec') : '—')))(x);
const imLtr = (x) => '\u2066' + x + '\u2069';      // סימן לפני המספר גם בעברית (בלי זה "15%−")
const imSign = (x) => (Math.abs(x) < 1e-9 ? '' : x > 0 ? '+' : '−');
function imDelta(c) {          // "−42%" בירוק כשלטובה, באדום כשלרעה
  if (!c || c.v === 'few' || !nz(c.d)) return ['', ''];
  const relK = nz(c.rel) && ['tot', 'act', 'up', 'tr', 'al', 'rv', 'bn', 'sv', 'cpm', 'tpm'].includes(c.k);
  const txt = relK ? (Math.round(c.rel * 100) === 0 ? '0%' : imSign(c.rel) + Math.abs(Math.round(c.rel * 100)) + '%') : imSign(c.d) + imVal(c.k, Math.abs(c.d));
  return [imLtr(txt), c.v === 'up' ? 'up' : c.v === 'dn' ? 'dn' : ''];
}
function imSave(sv) {
  if (!sv || !nz(sv.v) || sv.v === 0) return '';
  const a = Math.abs(sv.v), sign = sv.v > 0 ? '' : '−';
  return (sign ? imLtr(sign + ' ') : '') + (sv.u === 'min' ? fmt(t('admImUmin'), { v: numTxt(a) }) : sv.u === 'usd' ? fmt(t('admImUusd'), { v: usdTxt(a, 2) }) : fmt(t('admImUjobs'), { v: numTxt(a) }));
}
function imRow(c, ci) {         // ci = גם רווח הסמך (בעמוד של שיפור; ברשימה הכללית — רק לפני/אחרי והחיסכון)
  const [dt, dc] = imDelta(c), [vt, vc] = verV(c.v);
  let s = c.v === 'few' ? fmt(t('admImFewS'), { a: c.na, b: c.nb }) : fmt(t('admImAB'), { a: imVal(c.k, c.a), b: imVal(c.k, c.b) }) + (!ci && imSave(c.sv) ? ' · ' + imSave(c.sv) : '');
  if (ci && c.v !== 'few') {           // בעמוד של שיפור: שורה שנייה — רווח הסמך והחיסכון (בשורה אחת זה נחתך)
    const sec = !IM_FMT[c.k];                      // שניות — היחידה פעם אחת בסוף ("90%: −29.9 עד 6.9 שנ׳")
    const nv = (x) => imLtr((x < 0 ? '−' : '') + (sec ? numTxt(Math.abs(x)) : imVal(c.k, Math.abs(x))));
    const ciTxt = nz(c.lo) ? fmt(t('admImCI'), { lo: nv(c.lo), hi: nv(c.hi) }) + (sec ? ' ' + t('admImSec') : '') : '';
    const sm = h('span'); sm.append(s, h('br'), [ciTxt, imSave(c.sv)].filter(Boolean).join(' · '));
    s = sm;
  }
  return row({ c: vc, ic: c.v === 'up' ? '↑' : c.v === 'dn' ? '↓' : c.v === 'eq' ? '=' : '·', t: imName(c.k), s, v: dt || vt, tr: dt ? vt : '', trc: dc });
}
function imHeadline(im) {      // השורה בעמוד המעבדה
  if (!im || !im.start) return t('admImWait');
  const all = (im.cmp.all || { m: [] }).m.filter((c) => c.v === 'up').sort((a, b) => Math.abs(b.rel || 0) - Math.abs(a.rel || 0)).slice(0, 2);
  return fmt(t('admImSince'), { d: day(im.start) }) + (all.length ? ' · ' + all.map((c) => imName(c.k) + ' ' + imDelta(c)[0]).join(' · ') : '');
}
function imRangeSeg(p) {
  const seg = h('div', 'adm-seg'), R = [['d7', t('admImR7')], ['d30', t('admImR30')], ['d90', t('admImR90')], ['all', t('admImRall')], ['cu', t('admImRcu')]];
  const cur2 = D.imR || 'all';
  for (const [k, lbl] of R) {
    const b = h('button', 'mini-btn', lbl); b.type = 'button'; b.setAttribute('aria-pressed', k === cur2 ? 'true' : 'false');
    b.addEventListener('click', () => { D.imR = k; paint(); });
    seg.append(b);
  }
  p.append(seg);
  if (cur2 === 'cu') {
    const f = h('input', 'adm-search'); f.type = 'date'; f.value = D.imF || '';
    const to = h('input', 'adm-search'); to.type = 'date'; to.value = D.imT || '';
    const go2 = h('button', 'btn', t('admImGo')); go2.type = 'button';
    go2.addEventListener('click', async () => {
      const a = Date.parse(f.value), b = Date.parse(to.value) + 864e5 - 1;
      if (!(a > 0 && b > a)) { flash(t('admImBadR')); return; }
      D.imF = f.value; D.imT = to.value;
      const r = await api('learnImpact', { from: a, to: b });
      if (r.ok) { D.imCu = r.im; paint(); } else flash(t('admErr'));
    });
    p.append(h('div', 'adm-lbl', t('admImFrom')), f, h('div', 'adm-lbl', t('admImTo')), to, h('div', 'btn-row', go2));
  }
}
page('labImp', { tab: 'imp', parent: 'lab', title: () => t('admImT'), render(p) {
  const v = needLab(p); if (!v) return;
  const im = IMV();
  if (!im) { p.append(list(row({ c: 'gray', ic: '—', t: t('admImWait') }))); return; }
  // 1. "מאיפה השיפור" — השיפורים, גם אלה שעוד לא נפרסו
  const live = (im.imps || []).filter((x) => x.st === 'live');
  p.append(h('p', 'adm-dt', im.start ? fmt(t('admImDt'), { d: day(im.start), n: (im.vol || {}).jobs || 0, m: numTxt((im.vol || {}).min || 0) }) : t('admImWait')));
  if (im.start) {
    imRangeSeg(p);
    const rk = D.imR || 'all', C = im.cmp[rk];
    if (rk === 'cu' && !C) p.append(h('p', 'adm-note', t('admImPick')));
    if (C) {
      p.append(h('p', 'adm-dt', fmt(t('admImRng'), { a: day(C.from), b: day(C.to), n: C.nb })));
      // 2. כותרת: המדדים הראשיים
      const H = im.head.map((k) => C.m.find((c) => c.k === k)).filter((c) => c && c.v !== 'few');
      if (H.length) p.append(tiles(...H.slice(0, 6).map((c) => { const [dt, dc] = imDelta(c); return tileEl(verV(c.v)[1], imName(c.k), dt || '—', fmt(t('admImAB'), { a: imVal(c.k, c.a), b: imVal(c.k, c.b) }), dc, (im.wk || []).map((w) => w[c.k])); })));
      // 3. כל המדדים לפי משפחה
      for (const f of ['speed', 'rel', 'cost', 'qual']) {
        const rows2 = C.m.filter((c) => c.f === f && (c.na || c.nb));
        if (rows2.length) p.append(grp(imFam(f)), list(...rows2.map((c) => imRow(c))));
      }
    }
  }
  p.append(grp(t('admImWhere')), list(...(im.imps || []).map((x) => {
    const tg = (x.c || []).filter((c) => c.tg && c.v !== 'few'), best = tg.sort((a, b) => (b.good || 0) - (a.good || 0))[0];
    const nm = (lang === 'he' ? x.he : x.en) || [x.id];
    return row({ c: x.st !== 'live' ? 'gray' : best ? verV(best.v)[1] : 'blue', ic: x.id.slice(1), t: nm[0],
      s: x.st !== 'live' ? t('admImStWait') : fmt(t('admImStLive'), { d: day(x.at) }) + (best ? ' · ' + imName(best.k) + ' ' + imDelta(best)[0] : ' · ' + t('admVvFew')),
      v: best && imSave(best.sv) ? imSave(best.sv) : '', on: () => { D.imI = x.id; go('labImpI'); } });
  })));
  // 4. פירוק: הכולל = השיפורים + "לא מוסבר"
  if ((im.dec || []).length) {
    p.append(grp(t('admImDec')));
    for (const d of im.dec) {
      const rows3 = d.parts.map((x) => { const imp = (im.imps || []).find((y) => y.id === x.id) || {}; const nm = (lang === 'he' ? imp.he : imp.en) || [x.id];
        return row({ c: x.tg ? 'green' : 'gray', ic: x.id.slice(1), t: nm[0], v: imLtr(imSign(x.d) + imVal(d.k, Math.abs(x.d))) }); });
      rows3.push(row({ c: 'gray', ic: '…', t: t('admImRest'), v: imLtr(imSign(d.rest) + imVal(d.k, Math.abs(d.rest))) }));
      p.append(h('p', 'adm-dt', imName(d.k) + ' · ' + t('admImTotal') + ' ' + imLtr(imSign(d.d) + imVal(d.k, Math.abs(d.d)))), list(...rows3));
    }
  }
  p.append(h('p', 'adm-foot', t('admImFoot')));
} });
page('labImpI', { tab: 'imp', parent: 'labImp', title: () => { const im = IMV(), x = im && (im.imps || []).find((y) => y.id === D.imI); return x ? ((lang === 'he' ? x.he : x.en) || [x.id])[0] : t('admImT'); }, render(p) {
  const im = IMV(), x = im && (im.imps || []).find((y) => y.id === D.imI);
  if (!x) { p.append(h('p', 'adm-note', t('admLoading'))); return; }
  const nm = (lang === 'he' ? x.he : x.en) || [x.id, ''];
  p.append(h('p', 'adm-dt', (x.st === 'live' ? fmt(t('admImStLive'), { d: day(x.at) }) : t('admImStWait')) + ' · ' + imSrc(x.src)));
  p.append(list(row({ c: 'purple', ic: '?', t: t('admImHyp'), s: nm[1] || '' })));
  if (x.st !== 'live') { p.append(h('p', 'adm-foot', t('admImWaitFoot'))); return; }
  const tg = (x.c || []).filter((c) => c.tg), ot = (x.c || []).filter((c) => !c.tg && c.v !== 'few');
  if (tg.length) p.append(grp(t('admImTg')), list(...tg.map((c) => imRow(c, true))));
  if (ot.length) p.append(grp(t('admImOther')), list(...ot.map((c) => imRow(c, true))));
  p.append(h('p', 'adm-foot', t('admImIFoot')));
} });

page('labIns', { tab: 'imp', parent: 'lab', title: () => t('admLabIns'), render(p) {
  const v = needLab(p); if (!v) return;
  const ins = v.ins || [];
  p.append(h('p', 'adm-dt', t('admLabInsS')));
  if (!ins.length) { p.append(list(row({ c: 'gray', ic: '—', t: t('admLabNone') }))); return; }
  for (const s of [1, 2, 3]) {
    const g = ins.map((x, i) => [x, i]).filter(([x]) => x.sev === s);
    if (!g.length) continue;
    p.append(grp(sevTxt(s)), list(...g.map(([x, i]) => row({ c: SEV_C[s], ic: String(i + 1), t: insName(x.k), s: insAct(x.k), v: x.imp ? usdTxt(x.imp, 2) : '', tr: x.imp ? t('admPerMo') : '', on: () => { D.labI = i; go('labIn'); } }))));
  }
} });
page('labIn', { tab: 'imp', parent: 'labIns', title: () => { const v = LV(), x = v && (v.ins || [])[D.labI || 0]; return x ? insName(x.k) : t('admLabIns'); }, render(p) {
  const v = needLab(p); if (!v) return;
  const x = (v.ins || [])[D.labI || 0];
  if (!x) { p.append(h('p', 'adm-note', t('admLabNone'))); return; }
  const top = h('div', 'adm-insh');
  top.append(h('span', 'adm-chip', sevTxt(x.sev))); top.lastChild.style.background = COL[SEV_C[x.sev]];
  if (x.imp) top.append(h('small', null, fmt(t('admImpMo'), { v: usdTxt(x.imp, 2) })));
  p.append(top, grp(t('admWhatDo')), (() => { const d = h('div', 'adm-list adm-txt'); d.append(h('p', null, insAct(x.k))); return d; })());
  const f = insFacts(x);
  if (f.length) p.append(grp(t('admNumbers')), list(...f.map(([l, val]) => row({ c: 'gray', ic: '#', t: l, v: val }))));
  p.append(h('p', 'adm-foot', t('admInsFoot')), list(row({ c: 'blue', ic: '◇', t: t('admClaudeT'), s: t('admClaudeShort'), on: () => go('claude') })));
} });
page('labCost', { tab: 'imp', parent: 'lab', title: () => t('admLabCost'), render(p) {
  const v = needLab(p); if (!v) return;
  p.append(tiles(
    labTile('blue', t('admKusd'), 'usd', -1, (x) => usdTxt(x, 2)),
    labTile('blue', t('admKcpm'), 'cpm', -1, (x) => usdTxt(x, 3)),
    labTile('green', t('admKch'), 'ch', 1, pcTxt),
    labTile('purple', t('admKtpm'), 'tpm', -1, kTok)));
  const roles = v.roles || [];
  p.append(grp(t('admByRole')), roles.length ? list(...roles.map((r) => row({ c: 'blue', ic: '$', t: roleTxt(r.k),
    s: [nz(r.ch) ? fmt(t('admCacheP'), { p: pcTxt(r.ch) }) : '', r.sav > 0.01 ? fmt(t('admSavable'), { v: usdTxt(r.sav, 2) }) : '', r.m ? ltr(r.m.replace(/^claude-/, '')) : '', fmt(t('admCalls'), { n: r.calls })].filter(Boolean).join(' · '),
    v: usdTxt(r.usd, 2), tr: pcTxt(r.sh), meter: [r.sh * 100, ''] }))) : list(row({ c: 'gray', ic: '—', t: t('admNoData') })));
  const tk = v.tok || {}, all = (tk.i || 0) + (tk.o || 0) + (tk.cr || 0) + (tk.cw || 0);
  if (all) p.append(grp(t('admTok90')), list(
    row({ c: 'gray', ic: '→', t: t('admTokI'), v: kTok(tk.i), meter: [tk.i / all * 100, ''] }),
    row({ c: 'green', ic: '↺', t: t('admTokCr'), v: kTok(tk.cr), meter: [tk.cr / all * 100, ''] }),
    row({ c: 'orange', ic: '+', t: t('admTokCw'), v: kTok(tk.cw), meter: [tk.cw / all * 100, 'w'] }),
    row({ c: 'purple', ic: '←', t: t('admTokO'), v: kTok(tk.o), meter: [tk.o / all * 100, ''] })));
} });
page('labTime', { tab: 'imp', parent: 'lab', title: () => t('admLabTime'), render(p) {
  const v = needLab(p); if (!v) return;
  p.append(tiles(labTile('orange', t('admKspm'), 'spm', -1, numTxt), labTile('purple', t('admKmin'), 'min', 1, numTxt)));
  const st = v.stages || [];
  p.append(grp(t('admByStage')), st.length ? list(...st.map((s) => row({ c: 'orange', ic: '◷', t: stgTxt(s.k), s: fmt(t('admStgS'), { t: durTxt(s.sec) }),
    v: numTxt(s.spm), tr: t('admSpmU'), meter: [s.sh * 100, s.sh >= 0.35 ? 'w' : ''] }))) : list(row({ c: 'gray', ic: '—', t: t('admNoData') })));
  const vt = v.vt || [];
  if (vt.length) p.append(grp(t('admVt')), list(...vt.map((x) => row({ c: 'gray', ic: '›', t: ltr('vt ' + x.c), s: fmt(t('admVtS'), { n: x.n, m: durTxt(x.mx) }), v: durTxt(x.sec), tr: pcTxt(x.sh), meter: [x.sh * 100, ''] }))));
} });
page('labQual', { tab: 'imp', parent: 'lab', title: () => t('admLabQual'), render(p) {
  const v = needLab(p); if (!v) return;
  p.append(tiles(labTile('green', t('admKq'), 'q', 1, numTxt), labTile('purple', t('admKjd'), 'jd', 1, numTxt),
    labTile('orange', t('admKht'), 'ht', -1, pcTxt), labTile('blue', t('admKedr'), 'edr', -1, pcTxt)));
  const jc = v.jc || {}, qf = v.qf || {};
  p.append(grp(fmt(t('admJudgeG'), { n: jc.n || 0 })), (jc.c || []).length ? list(...jc.c.map((x) => row({ c: 'purple', ic: '⚖', t: jgTxt(x.k), v: numTxt(x.n), tr: pcTxt(x.sh), meter: [x.sh * 100 * 4, x.sh >= 0.2 ? 'x' : x.sh >= 0.08 ? 'w' : ''] })))
    : list(row({ c: 'gray', ic: '—', t: t('admNoData') })));
  p.append(grp(fmt(t('admQfG'), { n: qf.n || 0 })), (qf.m || []).some((x) => x.b) ? list(...qf.m.filter((x) => x.b).map((x) => row({ c: 'green', ic: '✓', t: qTxt(x.k), v: numTxt(x.b), tr: pcTxt(x.sh), meter: [x.sh * 100 * 5, x.sh >= 0.15 ? 'x' : x.sh >= 0.05 ? 'w' : ''] })))
    : list(row({ c: 'gray', ic: '—', t: t('admNoData') })));
  p.append(h('p', 'adm-foot', t('admQualFoot')));
} });
/* מ׳5: המדדים בקוד — מה כל שלב שינה, תזמון, עקביות, השמטות. הכל מחושב בשרתון (learnView.mx), כאן רק תצוגה */
function mxRow(v) {
  const m = v.mx;
  return row({ c: 'green', ic: '∑', t: t('admLabMx'), s: m && m.st && m.st.dz && nz(m.st.dz.ch) ? fmt(t('admLabMxS'), { p: pcTxt(m.st.dz.ch) }) : t('admNoData'), v: m ? numTxt(m.n) : '', tr: m ? t('admMxJobs') : '', on: () => go('labMx') });
}
const MX_PAIR = { df: () => t('admMxDf'), fr: () => t('admMxFr'), rz: () => t('admMxRz'), dz: () => t('admMxDz') };
/* בחציון: כמה שניות לפני / אחרי המילה — במילים, בלי סימן (+/− מתהפך בעברית) */
const sideTxt = (x, before, after) => (nz(x) ? fmt(t(x < 0 ? before : after), { v: Math.abs(x).toFixed(2) }) : '');
page('labMx', { tab: 'imp', parent: 'lab', title: () => t('admLabMx'), render(p) {
  const v = needLab(p); if (!v) return;
  const m = v.mx;
  if (!m) { p.append(list(row({ c: 'gray', ic: '—', t: t('admNoData') })), h('p', 'adm-foot', t('admMxFoot'))); return; }
  const meter = (x, w, bad) => [Math.min(100, (x || 0) * 100 * (w || 1)), bad ? 'x' : ''];
  p.append(h('p', 'adm-dt', fmt(t('admMxDt'), { n: m.n, c: numTxt(m.st.n) })));
  p.append(grp(t('admMxStG')), list(...['df', 'fr', 'rz', 'dz'].map((k) => { const x = m.st[k] || {};
    return row({ c: k === 'dz' ? 'purple' : 'green', ic: '✎', t: MX_PAIR[k](), s: [nz(x.t) ? 'TER ' + numTxt(x.t) : '', nz(x.c) ? 'chrF++ ' + numTxt(x.c) : ''].filter(Boolean).map(ltr).join(' · '),
      v: nz(x.ch) ? pcTxt(x.ch) : '—', tr: t('admMxChanged'), meter: meter(x.ch) }); })));
  const tm = m.tm || {};
  if (tm.n) p.append(grp(t('admMxTmG')), list(
    row({ c: 'orange', ic: '◷', t: t('admMxLate'), s: sideTxt(tm.in, 'admMxInB', 'admMxInA'), v: pcTxt(tm.late), meter: meter(tm.late, 5, tm.late >= 0.1) }),
    row({ c: 'orange', ic: '◷', t: t('admMxCut'), s: sideTxt(tm.out, 'admMxOutB', 'admMxOutA'), v: pcTxt(tm.cut), meter: meter(tm.cut, 5, tm.cut >= 0.1) }),
    row({ c: 'gray', ic: '∅', t: t('admMxNw'), v: pcTxt(tm.nw), meter: meter(tm.nw, 5) }),
    ...(nz(tm.shb) ? [row({ c: 'blue', ic: '▮', t: t('admMxShot'), s: t('admMxShotS'), v: pcTxt(tm.shb), meter: meter(tm.shb, 10, tm.shb >= 0.05) })] : [])));
  const cs = m.cs || {}, om = m.om || {};
  p.append(grp(t('admMxCsG')), list(
    row({ c: 'purple', ic: 'א', t: t('admMxNm'), s: fmt(t('admMxNmS'), { n: numTxt(cs.nm) }), v: nz(cs.nmv) ? pcTxt(cs.nmv) : '—', meter: meter(cs.nmv, 5, cs.nmv >= 0.1) }),
    row({ c: 'purple', ic: '≡', t: t('admMxGl'), s: fmt(t('admMxGlS'), { n: numTxt(cs.gl), x: numTxt(cs.glx) }), v: nz(cs.glm) ? pcTxt(cs.glm) : '—', meter: meter(cs.glm, 5, cs.glm >= 0.1) })));
  p.append(grp(t('admMxOmG')), list(
    row({ c: 'red', ic: '∅', t: t('admMxEmpty'), v: pcTxt(om.e), meter: meter(om.e, 20, om.e >= 0.02) }),
    row({ c: 'red', ic: '…', t: t('admMxShort'), s: nz(om.r50) ? fmt(t('admMxRatio'), { v: numTxt(om.r50) }) : '', v: pcTxt(om.s), meter: meter(om.s, 20, om.s >= 0.02) }),
    row({ c: 'red', ic: '#', t: t('admMxNum'), s: fmt(t('admMxNumS'), { n: numTxt(om.num) }), v: nz(om.numm) ? pcTxt(om.numm) : '—', meter: meter(om.numm, 5, om.numm >= 0.05) })));
  p.append(h('p', 'adm-foot', t('admMxFoot')));
} });
/* מ׳7 (20/10/2026): הלולאה — לפני ואחרי לכל גרסה (learnView.ver) והשבוע מול השבוע שעבר (learnView.ws). החישוב בשרתון */
function verDim(d) {
  switch (d) {
    case 'env': return t('admVdEnv');
    case 'tl': return t('admVdTl');
    case 'rv': return t('admVdRv');
    case 'rb': return t('admVdRb');
    case 'jg': return t('admVdJg');
    default: return ltr(String(d || ''));
  }
}
function verV(v) {
  switch (v) {
    case 'up': return [t('admVvUp'), 'green'];
    case 'dn': return [t('admVvDn'), 'red'];
    case 'eq': return [t('admVvEq'), 'gray'];
    case 'mix': return [t('admVvMix'), 'orange'];
    case 'few': return [t('admVvFew'), 'gray'];
    default: return [t('admVvQ'), 'blue'];
  }
}
function verMetName(k) {
  switch (k) {
    case 'q': return t('admKq');
    case 'jd': return t('admKjd');
    case 'ok': return t('admKok');
    case 'cpm': return t('admKcpm');
    case 'spm': return t('admKspm');
    case 'ht': return t('admKht');
    case 'num': return t('admMxNum');
    default: return ltr(String(k || ''));
  }
}
const VER_FMT = { q: numTxt, jd: numTxt, ok: pcTxt, cpm: (x) => usdTxt(x, 3), spm: numTxt, ht: pcTxt, num: pcTxt };
function verRow(v) {
  const x = (v.ver || [])[0];
  return row({ c: 'purple', ic: '⇄', t: t('admLabVer'), s: x ? verDim(x.d) + ' · ' + verV(x.v)[0] : t('admLabVerNone'), v: (v.ver || []).length || '', on: () => go('labVer') });
}
function wkRow(v) {
  const w = v.ws || { k: {} };
  return row({ c: 'blue', ic: '7', t: t('admLabWk'), s: fmt(t('admLabWkS'), { n: numTxt(w.k.n || 0), m: numTxt(w.k.min || 0) }), v: (w.nv || []).length ? '⇄ ' + w.nv.length : '', on: () => go('labWk') });
}
page('labVer', { tab: 'imp', parent: 'lab', title: () => t('admLabVer'), render(p) {
  const v = needLab(p); if (!v) return;
  const vs = v.ver || [];
  if (!vs.length) { p.append(list(row({ c: 'gray', ic: '—', t: t('admLabVerNone') })), h('p', 'adm-foot', t('admVerFoot'))); return; }
  for (const x of vs) {
    // 21/10/2026: באיזו שכבה הושוו (מצב · מנוע) — השוואה רק בתוך אותו מצב (studiolearn verStratum)
    p.append(grp(verDim(x.d) + ' · ' + verV(x.v)[0]), h('p', 'adm-dt', fmt(t('admVerDt'), { d: day(x.at), a: x.na, b: x.nb }) + (x.sk ? ' · ' + x.sk.split('|').join(' · ') : '')));
    p.append(list(...x.m.map((m) => { const f = VER_FMT[m.k] || numTxt, [mt, mc] = verV(m.v);
      return row({ c: mc, ic: m.v === 'up' ? '↑' : m.v === 'dn' ? '↓' : m.v === 'eq' ? '=' : '·', t: verMetName(m.k),
        s: fmt(t('admVerAb'), { a: f(m.a), b: f(m.b) }), v: mt }); })));
  }
  p.append(h('p', 'adm-foot', t('admVerFoot')));
} });
page('labWk', { tab: 'imp', parent: 'lab', title: () => t('admLabWk'), render(p) {
  const v = needLab(p); if (!v) return;
  const w = v.ws || { k: {}, kp: {} }, k = w.k || {}, kp = w.kp || {};
  const tl = (c, lbl, key, dir, f) => { if (k[key] == null && kp[key] == null) return null; const [tr, trc] = trend(k[key], kp[key], dir, f);
    return tileEl(c, lbl, f(k[key]), tr || (nz(kp[key]) ? fmt(t('admWas'), { v: f(kp[key]) }) : ''), trc, []); };
  p.append(h('p', 'adm-dt', t('admWkDt')), tiles(
    tl('purple', t('admKn'), 'n', 1, numTxt), tl('purple', t('admKmin'), 'min', 1, numTxt), tl('blue', t('admWkUsd'), 'usd', -1, (x) => usdTxt(x, 2)),
    tl('blue', t('admKcpm'), 'cpm', -1, (x) => usdTxt(x, 3)), tl('green', t('admKq'), 'q', 1, numTxt), tl('purple', t('admKjd'), 'jd', 1, numTxt),
    tl('green', t('admKok'), 'ok', 1, pcTxt), tl('orange', t('admKht'), 'ht', -1, pcTxt)));
  const nv = w.nv || [];
  p.append(grp(t('admWkNv')), nv.length ? list(...nv.map((x) => { const [vt, vc] = verV(x.v); return row({ c: vc, ic: '⇄', t: verDim(x.d), v: vt, on: () => go('labVer') }); }))
    : list(row({ c: 'gray', ic: '—', t: t('admWkNone') })));
  const top = (v.ins || [])[0];
  if (top) p.append(grp(t('admNowTop')), list(row({ c: SEV_C[top.sev], ic: '!', t: insName(top.k), s: insAct(top.k), on: () => { D.labI = 0; go('labIn'); } })));
} });
/* ---- Studio DM (24/10/2026): יומני ההורדות מהטלפונים (DmLog → dmLog → adminDm) — 14 הימים האחרונים, כבר מנוקים, בלי משתמשים.
   הכל מחושב בשרתון (lib/dmlog.js dmView), כאן רק תצוגה ---- */
async function needDm() {
  const r = await api('adminDm');
  D.dm = r.ok ? (r.dm || null) : null;
  if (['labDm', 'lab'].includes(cur)) paint();
}
function dmRow() {
  if (D.dm === undefined) { D.dm = 0; needDm(); }
  const s = D.dm && D.dm.st;
  return row({ c: 'studio', ic: '⇣', t: t('admDmT'), s: s && s.n ? fmt(t('admDmS'), { n: s.n, u: s.users }) : t('admNoData'), v: s && s.ok != null ? s.ok + '%' : '', tr: s && s.ok != null ? t('admDmOk') : '', on: () => go('labDm') });
}
page('labDm', { tab: 'imp', parent: 'lab', title: () => t('admDmT'), render(p) {
  if (D.dm === undefined || D.dm === 0) { if (D.dm === undefined) { D.dm = 0; needDm(); } p.append(h('p', 'adm-dt', t('admLoading'))); return; }
  const V = D.dm;
  if (!V || !V.st || !V.st.n) { p.append(list(row({ c: 'gray', ic: '—', t: t('admNoData') })), h('p', 'adm-foot', t('admDmFoot'))); return; }
  const s = V.st, k = s.k || {}, days = V.days || [];
  p.append(tiles(
    tileEl('green', t('admDmOk'), s.ok == null ? '—' : s.ok + '%', fmt(t('admDmEnded'), { n: (k.done || 0) + (k.fail || 0) }), '', days.map((d) => (d.done + d.fail ? d.done / (d.done + d.fail) : null))),
    tileEl('studio', t('admDmDone'), numTxt(k.done || 0), fmt(t('admDmUsers'), { n: s.users }), '', days.map((d) => d.done)),
    tileEl('red', t('admDmFail'), numTxt(k.fail || 0), fmt(t('admDmStop'), { n: k.stop || 0 }), '', days.map((d) => d.fail)),
    tileEl('blue', t('admDmSpeed'), s.bps50 ? (s.bps50 / 1048576).toFixed(1) + ' MB/s' : '—', t('admDmMed'), '', null)));
  const tot = Math.max(1, k.fail || 0);
  p.append(grp(t('admDmCodes')), (s.codes || []).length ? list(...s.codes.map(([c, n]) => row({ c: 'red', ic: '✕', t: ltr(c), v: n, meter: [n / tot * 100, n / tot >= 0.3 ? 'x' : ''] })))
    : list(row({ c: 'green', ic: '✓', t: t('admLabFailsNone') })));
  p.append(grp(t('admDmSites')), list(...(s.doms || []).map(([d, v]) => { const e = (v.done || 0) + (v.fail || 0);
    return row({ c: v.fail > v.done ? 'orange' : 'blue', ic: '◎', t: ltr(d), s: fmt(t('admDmSiteS'), { d: v.done || 0, f: v.fail || 0, s: v.stop || 0 }), v: e ? Math.round(v.done / e * 100) + '%' : '—', meter: [e ? v.done / e * 100 : 0, v.fail > v.done ? 'w' : ''] }); })));
  if ((V.fails || []).length) p.append(grp(t('admDmLast')), list(...V.fails.map((f) => {
    const sm = h('span'); sm.setAttribute('dir', 'auto');
    sm.textContent = [day(f.t) + ' ' + clock(f.t), f.dom, f.name, f.ex, f.model].filter(Boolean).join(' · ') + (f.msg ? '\n' + f.msg : '') + ((f.tail || []).length ? '\n' + f.tail.join('\n') : '');
    sm.style.whiteSpace = 'pre-wrap';
    return row({ c: 'red', ic: f.kind === 'yt' ? '▶' : '⇣', t: ltr(f.code || '?'), s: sm });
  })));
  p.append(h('p', 'adm-foot', t('admDmFoot')));
} });
page('labFails', { tab: 'imp', parent: 'lab', title: () => t('admLabFails'), render(p) {
  const v = needLab(p); if (!v) return;
  p.append(tiles(labTile('green', t('admKok'), 'ok', 1, pcTxt), labTile('purple', t('admKdone'), 'done', 1, numTxt)));
  const f = v.fails || [];
  p.append(grp(t('admFailsG')), f.length ? list(...f.map((x) => row({ c: x.fin ? 'red' : 'orange', ic: '✕', t: ltr(x.e),
    s: [fmt(t('admFailsFin'), { n: x.fin }), x.st ? stgTxt(x.st) : '', x.usd ? fmt(t('admFailsUsd'), { v: usdTxt(x.usd, 2) }) : ''].filter(Boolean).join(' · '), v: x.n }))) : list(row({ c: 'green', ic: '✓', t: t('admLabFailsNone') })));
  p.append(h('p', 'adm-foot', t('admFailsFoot')));
} });
page('labModes', { tab: 'imp', parent: 'lab', title: () => t('admLabModes'), render(p) {
  const v = needLab(p); if (!v) return;
  const line = (x) => [fmt(t('admModeN'), { n: x.n }), nz(x.jd) ? fmt(t('admModeJd'), { v: numTxt(x.jd) }) : nz(x.q) ? fmt(t('admModeQ'), { v: numTxt(x.q) }) : '', nz(x.ok) ? fmt(t('admModeOk'), { v: pcTxt(x.ok) }) : '', nz(x.spm) ? fmt(t('admModeSpm'), { v: numTxt(x.spm) }) : ''].filter(Boolean).join(' · ');
  const m = v.modes || [];
  p.append(grp(t('admModesG')), m.length ? list(...m.map((x) => row({ c: 'purple', ic: '⇆', t: modeTxt(x.m), s: line(x), v: usdTxt(x.cpm, 3), tr: t('admPerMin') }))) : list(row({ c: 'gray', ic: '—', t: t('admNoData') })));
  const e = v.eng || [];
  if (e.length) p.append(grp(t('admEngG')), list(...e.map((x) => row({ c: 'blue', ic: x.e === 'api' ? '▣' : '◇', t: x.e === 'api' ? t('admEngApi') : t('admEngSub'), s: line(x), v: usdTxt(x.cpm, 3), tr: t('admPerMin') }))));
} });
page('labAfter', { tab: 'imp', parent: 'lab', title: () => t('admLabAfter'), render(p) {
  const v = needLab(p); if (!v) return;
  p.append(tiles(labTile('orange', t('admKht'), 'ht', -1, pcTxt), labTile('red', t('admKsb'), 'sb', -1, pcTxt), labTile('blue', t('admKedr'), 'edr', -1, pcTxt), labTile('green', t('admKcov'), 'cov', 1, pcTxt), labTile('purple', t('admKsga'), 'sga', 1, pcTxt)));
  const f = v.follow || {}, u = f.ux || {}, n = (x) => numTxt(x || 0);
  p.append(grp(t('admAfterJobs')), list(
    row({ c: 'orange', ic: '✎', t: t('admAfterEd'), v: n(f.ed) }),
    row({ c: 'blue', ic: '↻', t: t('admAfterRr'), v: n(f.rr) }),
    row({ c: 'purple', ic: '✦', t: t('admAfterAi'), v: n(f.ai) }),
    row({ c: 'gray', ic: '★', t: t('admAfterGold'), v: n(f.gold) })));
  const e = u.e, pl = u.pl, o = u.o, sg = u.sg, ai = u.ai, gl = u.gl;
  const rows = [];
  if (e) rows.push(row({ c: 'orange', ic: '✎', t: t('admUxE'), s: fmt(t('admUxES'), { s: n(e.s), n: n(e.n), w: durTxt(e.ws) }), v: n(e.jobs) }));
  if (pl) rows.push(row({ c: 'blue', ic: '▶', t: t('admUxPl'), s: fmt(t('admUxPlS'), { n: n(pl.n), t: durTxt(pl.sec) }), v: n(pl.jobs) }));
  if (o) rows.push(row({ c: 'green', ic: '↓', t: t('admUxO'), s: fmt(t('admUxOS'), { d: n(o.dl), s: n(o.sh), x: n(o.dx) }), v: n(o.jobs) }));
  if (sg) rows.push(row({ c: 'purple', ic: '✓', t: t('admUxSg'), s: fmt(t('admUxAR'), { a: n(sg.a), r: n(sg.r) }), v: n(sg.jobs) }));
  if (ai) rows.push(row({ c: 'purple', ic: '✦', t: t('admUxAi'), s: fmt(t('admUxAiS'), { q: n(ai.q), a: n(ai.a), r: n(ai.r) }), v: n(ai.jobs) }));
  if (gl) rows.push(row({ c: 'gray', ic: 'Aa', t: t('admUxGl'), s: fmt(t('admUxGlS'), { a: n(gl.a) }), v: n(gl.jobs) }));
  p.append(grp(t('admAfterUx')), rows.length ? list(...rows) : list(row({ c: 'gray', ic: '—', t: t('admNoData') })), h('p', 'adm-foot', t('admAfterFoot')));
} });
page('labRecent', { tab: 'imp', parent: 'lab', title: () => t('admLabRecent'), render(p) {
  const v = needLab(p); if (!v) return;
  const r = v.recent || [];
  if (!r.length) { p.append(list(row({ c: 'gray', ic: '—', t: t('admNoData') }))); return; }
  p.append(list(...r.map((x, i) => row({ c: x.st === 'done' ? 'green' : x.st === 'failed' ? 'red' : 'gray', ic: x.st === 'done' ? '✓' : x.st === 'failed' ? '✕' : '·',
    t: day(x.at) + ' · ' + modeTxt(x.mode), s: [stTxt(x.st), x.err ? ltr(x.err) : '', durTxt(x.dur), nz(x.jd) ? fmt(t('admModeJd'), { v: numTxt(x.jd) }) : nz(x.q) ? fmt(t('admModeQ'), { v: numTxt(x.q) }) : ''].filter(Boolean).join(' · '),
    v: usdTxt(x.usd, 2), on: () => { D.labJ = i; go('labRec'); } }))));
} });
page('labRec', { tab: 'imp', parent: 'labRecent', title: () => t('admLabRec'), render(p) {
  const v = needLab(p); if (!v) return;
  const x = (v.recent || [])[D.labJ || 0];
  if (!x) { p.append(h('p', 'adm-note', t('admNoData'))); return; }
  const kv = (l, val) => (val == null || val === '' || val === '—' ? null : row({ c: 'gray', ic: '#', t: l, v: val }));
  p.append(h('p', 'adm-dt', ltr(x.id) + ' · ' + day(x.at)), list(
    kv(t('admRState'), stTxt(x.st)), kv(t('admFCode'), x.err ? ltr(x.err) : ''), kv(t('admRMode'), modeTxt(x.mode)),
    kv(t('admREng'), x.eng === 'api' ? t('admEngApi') : x.eng ? t('admEngSub') : ''), kv(t('admRDur'), durTxt(x.dur)), kv(t('admRRun'), durTxt(x.run)),
    kv(t('admFUsd'), usdTxt(x.usd, 3)), kv(t('admKch'), pcTxt(x.ch)), kv(t('admKq'), numTxt(x.q)), kv(t('admKjd'), numTxt(x.jd)), kv(t('admRFires'), numTxt(x.fires))));
  p.append(h('p', 'adm-foot', t('admRecFoot')));
} });
page('labData', { tab: 'imp', parent: 'lab', title: () => t('admLabData'), render(p) {
  const v = needLab(p); if (!v) return;
  const c = D.lab.corpus || {}, d = D.lab.dev || {};
  const mb = (b) => (nz(b) ? ltr((b / 1048576 >= 10 ? Math.round(b / 1048576) : (b / 1048576).toFixed(1)) + ' MB') : '—');
  p.append(grp(t('admDataRec')), list(row({ c: 'purple', ic: '≡', t: t('admDataRecT'), s: fmt(t('admDataRecS'), { n: v.n90 || 0 }), v: numTxt(v.n) })));
  p.append(grp(t('admDataCorpus')), c.on ? list(
    row({ c: 'blue', ic: 'T', t: t('admDataTxt'), s: c.q ? fmt(t('admDataQ'), { n: c.q }) : '', v: numTxt(c.n || 0) }),
    row({ c: 'orange', ic: '✎', t: t('admDataEd'), s: c.qe ? fmt(t('admDataQ'), { n: c.qe }) : '', v: numTxt(c.ne || 0) }),
    row({ c: 'green', ic: '♪', t: t('admDataMedia'), s: fmt(t('admDataMediaS'), { a: c.na || 0, v: c.nv || 0, m: mb(c.mb) }), v: numTxt((c.na || 0) + (c.nv || 0)) }),
    row({ c: 'gray', ic: '▤', t: t('admDataSize'), v: mb(c.bytes) })) : list(row({ c: 'gray', ic: '—', t: c.error ? t('admErr') : t('admDataOff') })));
  const days = Object.entries(d.days || {}).sort((a, b) => (a[0] < b[0] ? 1 : -1)).slice(0, 7);
  p.append(grp(t('admDataDev')), list(
    row({ c: d.on ? 'green' : 'gray', ic: d.on ? '●' : '○', t: t('admDataDevFlag'), s: d.on ? t('admDataDevOnS') : t('admDataDevOffS'), v: d.on ? t('admOn') : t('admOff'), on: () => go('flags') }),
    ...(d.r2 ? [row({ c: 'purple', ic: 'J', t: t('admDataDevJ'), v: numTxt(d.j || 0) }), row({ c: 'blue', ic: 'M', t: t('admDataDevM'), v: numTxt(d.m || 0) }),
      row({ c: 'red', ic: 'E', t: t('admDataDevE'), v: numTxt(d.e || 0) }), row({ c: 'gray', ic: '▤', t: t('admDataSize'), v: mb(d.bytes) })] : [])));
  if (days.length) p.append(grp(t('admDataDays')), list(...days.map(([k, n]) => row({ c: 'gray', ic: '·', t: ltr(k), v: numTxt(n) }))));
  p.append(h('p', 'adm-foot', t('admDataFoot')));
} });
