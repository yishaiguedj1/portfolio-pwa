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

const shell = createShell({ app: 'admin', title: t('admT'), logo: 'logo-header.png', items: [], onSettings: () => {} });
const root = h('main', 'adm');
const side = h('nav', 'adm-side');
const tabs = h('nav', 'adm-tabs');
const wrap = h('div', 'adm-wrap'); wrap.append(side, root);
document.body.append(shell.el, wrap, tabs);
const done = () => de.classList.remove('lib-restoring', 'lib-curtain');

/* ---------------- הניווט (15/10/2026, התצוגה המקדימה שאושרה) ----------------
   כמו ב־iOS: חמש לשוניות קבועות (בטלפון למטה, במחשב — פס צד), בכל לשונית רשימה קצרה של שורות אינפורמטיביות
   (ערך, מגמה, גרף קטן, שורת מצב אחת), ומשורה נכנסים פנימה (לכל היותר שלוש רמות; "‹" חוזר). מסך שעוד לא נבנה = "בקרוב",
   בלי מספרים מומצאים. כל מסך: { tab, title, parent?, render(p) } */
const TABS = [['ov', () => t('admTabOv'), '◉'], ['apps', () => t('admTabApps'), '▦'], ['sys', () => t('admTabSys'), '⚙'], ['imp', () => t('admTabImp'), '✦'], ['find', () => t('admTabFind'), '⌕']];
const D = { ov: null, lab: null, ovAt: 0, ai: null, aiAt: 0, tk: null, tkAt: 0, tkOpen: {}, apps: null, appsAt: 0 };   // הנתונים מהשרתון (adminOv, learn) — נטענים פעם אחת ומתרעננים בחזרה לדף
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
  const iv = A2 && A2.invest, ac = A2 && A2.academy;
  p.append(list(
    row({ c: 'invest', ic: '↗', t: 'Invest', s: iv && iv.users != null ? fmt(t('admAppInvestS2'), { n: iv.users, i: iv.ibkr == null ? '—' : iv.ibkr }) : t('admLoading'), on: () => go('invest') }),
    row({ c: 'academy', ic: '▤', t: 'Academy', s: ac && ac.cat ? fmt(t('admAppAcademyS2'), { n: ac.cat.pub, r: ac.readers == null ? '—' : ac.readers }) : A2 ? t('admUnknown') : t('admLoading'), on: () => go('academy') }),
    row({ c: 'studio', ic: '▶', t: 'Studio', s: k ? fmt(t('admAppStudioS'), { n: k.n || 0, c: usd(k.cpm, 3) }) : t('admSoon'), v: k && k.ok != null ? pctTxt(k.ok) : '', tr: k && k.ok != null ? t('admKok') : '', sp: v ? spark((v.wk || []).map((x) => x.n), COL.studio) : null, on: () => go('studio') })));
  p.append(grp(t('admSecShared')), list(row({ c: 'gray', ic: '👥', t: t('admUsers'), s: A2 && A2.invest.users != null ? fmt(t('admUsersS'), { n: A2.invest.users, s: A2.shared.sess == null ? '—' : A2.shared.sess }) : t('admSoon') }), soonRow('blue', '∑', t('admUsage')), soonRow('orange', '✉', t('admFeedback')), soonRow('purple', '📣', t('admMsgs'))));
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
    soonRow('purple', '✦', t('admStudioAgents')), soonRow('blue', '☁', t('admStudioSrv'))));
  p.append(grp(t('admLabT')), list(row({ c: 'purple', ic: '✦', t: t('admLabT'), s: v ? fmt(t('admLabS'), { n: v.n || 0 }) : '', on: () => go('lab') })));
} });
page('sys', { tab: 'sys', title: () => t('admTabSys'), render(p) {
  const o = D.ov, run = (o && o.run) || [];
  const dep = o ? o.items.find((x) => x.k === 'deploy_wait') : null;
  const prod = run.find((x) => x.k === 'prod'), stag = run.find((x) => x.k === 'stag');
  const ai = D.ai, k = D.lab && D.lab.view && D.lab.view.k;
  if (!ai) needAi();
  p.append(list(
    row({ c: 'orange', ic: '$', t: t('admAiCost'), s: ai && ai.month ? fmt(t('admAiCostS'), { u: usd(ai.month.usd), n: ai.today.t }) : k ? fmt(t('admAiCostS2'), { u: usd(k.usd) }) : '', badge: ai ? ai.warn.filter((w) => w.sev <= 2).length : 0, on: () => go('ai') }),
    row({ c: 'blue', ic: '%', t: t('admQuota'), s: o && o.dates && o.dates[0] ? fmt(t('admQuotaS'), { n: o.dates[0].left }) : '', on: () => go('quota') }),
    row({ c: dep ? 'orange' : 'green', ic: '⇪', t: t('admInfra'), s: dep ? t('admItDeploy') : prod && prod.v.b ? fmt(t('admRunBuild'), { b: prod.v.b }) + (stag && stag.v.ahead === 1 ? ' · ' + t('admRunAhead1') : stag && stag.v.ahead > 1 ? ' · ' + fmt(t('admRunAhead'), { n: stag.v.ahead }) : '') : '', badge: dep ? 1 : 0, on: () => go('infra') })));
  p.append(grp(t('admSecCtl')), list(soonRow('gray', '⚙', t('admCfg')), soonRow('red', '⏻', t('admMaint'))));
  p.append(grp(t('admSecSec')), list(soonRow('green', '🔒', t('admSecLog')), soonRow('gray', '⚿', t('admSecrets'))));
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
  const L = (D.lab && D.lab.insL) || {};
  p.append(list(
    row({ c: 'purple', ic: '✦', t: t('admLabT'), s: top ? ((lang === 'he' && L[top.k]) || top.k) : t('admLabNone'), v: v ? (v.ins || []).length : '', tr: t('admInsShort'), on: () => go('lab') }),
    row({ c: 'blue', ic: '◇', t: t('admClaudeT'), s: t('admClaudeShort'), on: () => go('claude') }),
    row({ c: 'gray', ic: '⇄', t: t('admTeam'), s: D.tk && D.tk.tk ? fmt(t('admTeamS'), { n: D.tk.tk.items.length, w: D.tk.tk.items.filter((x) => x.w).length }) : '', on: () => go('team') })));
} });
/* ---- סשנים ומשימות (15/10/2026): משימות-פתוחות.md מהריפו — מה בעבודה ובידי איזה סשן, מה עם תאריך, PR פתוחים ---- */
async function needTasks() {
  if (D.tk && Date.now() - D.tkAt < 60000) return;
  const r = await api('adminTasks');
  if (r.ok) { D.tk = r; D.tkAt = Date.now(); if (cur === 'team' || cur === 'imp') paint(); }
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
  if ((d.prs || []).length) p.append(grp(t('admTeamPr')), list(...d.prs.map((x) => { const s = h('bdi', null, x.t || ''); return row({ c: 'orange', ic: '⇄', t: fmt(t('admItPr'), { n: x.n }), s, on: open(gh + '/pull/' + x.n) }); })));
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
page('lab', { tab: 'imp', parent: 'imp', title: () => t('admLabT'), render(p) { p.append(labCard(D.lab || { ok: false })); } });
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

if (first === 'out') { loginGate({ app: 'admin', auth: A, logo: 'logo-header.png', name: t('admT') }); done(); }
else boot();

async function load() {
  const [ov, lab] = await Promise.all([api('adminOv'), api('learn')]);
  D.ov = ov.ok ? ov.ov : null; D.lab = lab; D.ovAt = Date.now();
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

/* ---- מעבדת השיפור: המדדים מול החודש הקודם, והמסקנות המדורגות ---- */
function labCard(lab) {
  const card = h('section', 'card adm-card');
  card.append(h('h2', null, t('admLabT')));
  if (!lab.ok) { card.append(h('p', 'adm-note', t('admErr'))); return card; }
  const v = lab.view || {}, k = v.k || {}, kp = v.kp || {};
  card.append(h('p', 'adm-sub', fmt(t('admLabS'), { n: v.n || 0 })));
  const pct = (x) => (x == null ? '—' : Math.round(x * 100) + '%');
  const KP = [['n', t('admKn'), (x) => (x == null ? '—' : x)], ['ok', t('admKok'), pct], ['cpm', t('admKcpm'), (x) => (x == null ? '—' : '$' + x.toFixed(3))],
    ['spm', t('admKspm'), (x) => (x == null ? '—' : Math.round(x))], ['ch', t('admKch'), pct], ['q', t('admKq'), (x) => (x == null ? '—' : Math.round(x))], ['jd', t('admKjd'), (x) => (x == null ? '—' : Math.round(x))]];
  const grid = h('div', 'adm-kpis');
  for (const [key, lbl, f] of KP) {
    if (k[key] == null && kp[key] == null) continue;
    const tile = h('div', 'adm-kpi');
    tile.append(h('span', 'adm-kl', lbl), h('b', null, f(k[key])), h('small', null, f(kp[key])));
    grid.append(tile);
  }
  card.append(grid);
  card.append(h('div', 'adm-lbl', t('admInsT')));
  const ins = v.ins || [];
  if (!ins.length) card.append(h('p', 'adm-dim', t('admLabNone')));
  const L = lab.insL || {};
  const lst = h('div', 'ios-list');
  for (const x of ins) {
    const r = h('div', 'ios-row adm-ins s' + x.sev);
    r.append(h('span', 'adm-dot'), h('span', 'adm-ttx', (lang === 'he' && L[x.k]) || x.k), (() => { const m = h('small', null, x.imp ? '≈ $' + x.imp : ''); m.dir = 'ltr'; return m; })());
    lst.append(r);
  }
  card.append(lst);
  return card;
}
