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
document.body.append(shell.el, root);
const done = () => de.classList.remove('lib-restoring', 'lib-curtain');

if (first === 'out') { loginGate({ app: 'admin', auth: A, logo: 'logo-header.png', name: t('admT') }); done(); }
else boot();

async function boot() {
  root.append(h('p', 'adm-wait', t('admLoading')));
  const lab = await api('learn');
  root.replaceChildren();
  done();
  if (lab.error === 'not_admin' || lab.error === 'not_allowed') {
    root.append(h('p', 'adm-note', t('admNoAdmin')), accountCard(A, 'icon-192.png'));
    return;
  }
  root.append(h('h2', 'adm-hero', t('admT')));
  root.append(claudeCard(), labCard(lab));
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
