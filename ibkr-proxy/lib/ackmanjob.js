/* העדכון האוטומטי של תיק אקמן (16/11/2026, בקשת המשתמש: "מתעדכן בדיוק כל פעם שיש עדכון לציבור").
   רץ רק בשרת שלנו (server.js → startAckman, כל 10 דק׳; GET /api/history?job=ackman עם CRON_SECRET):
   1. poll — רשימת ההגשות ב־EDGAR של Pershing Square Inc. (CIK 2026053) ושל חברת הניהול (CIK 1336528). הגשה חדשה:
      · 13F-HR / 13F-HR/A → פענוח (lib/ackman.js), איחוד עם הרבעון (NEW HOLDINGS מוסיף, RESTATEMENT מחליף), CUSIP → סימבול.
      · Form 4 → עסקאות P/S מדויקות במניות שבתיק (תאריך, כמות, מחיר). לא של הכלים של חברת הניהול (HHH/PSUS Holdings).
      · Schedule 13D/A → נספח "Trading Data" (סעיף 5(c)): כל העסקאות במניה רגילה — עסקאות מדויקות; חוזי Forward — לא
        (הם לא מניות וגם לא ב־13F). 13D/G על מנפיק שאינו בתיק (למשל מניות Pershing Square Inc. עצמה) — לא נכנס.
   2. rebuild — מחירים (Yahoo, מטמון ב־R2 לכל סימבול) → lib/ackmanbuild.js → ackman/book.json + ackman/meta.json ב־R2.
      גם פעם ביום אחרי סגירת המסחר בניו יורק — כדי שהשווי היומי יתארך.
   3. serve — POST /api/history {op:'ackman', v} → אותה גרסה: {same:true}; אחרת הספר (gzip כשהדפדפן מקבל).
   הכל מידע ציבורי — אין כאן שום דבר של המשתמש. SEC: User-Agent מזוהה, בקשה אחת בכל פעם עם השהיה. */
'use strict';
const crypto = require('crypto');
const zlib = require('zlib');
const A = require('./ackman');
const AB = require('./ackmanbuild');
const B = require('./ackmanbook');
const R2 = require('./r2');
const DATA = require('./ackman-13f.json');

const SEC_UA = () => process.env.SEC_UA || 'TheSnowball/1.0 data@thesnowball.app';
const YUA = 'Mozilla/5.0 (compatible; portfolio-pwa/1.0)';
const KEY = { state: 'ackman/state.json', book: 'ackman/book.json', meta: 'ackman/meta.json', px: (s) => 'ackman/px/' + String(s).replace(/[^A-Z0-9.\-^]/gi, '') + '.json' };
/* מה שכבר בנתונים שבריפו: 13F שהוגש עד הרבעון האחרון שם, ועסקאות (Form 4 / 13D) עד סוף אותו רבעון */
const LASTQ = DATA.quarters[DATA.quarters.length - 1];
const CUT = { f13: LASTQ.f, trades: LASTQ.p };
const FORM_13F = /^13F-HR(\/A)?$/, FORM_4 = /^4(\/A)?$/, FORM_13D = /^(SC|SCHEDULE) 13D(\/A)?$/, FORM_13G = /^(SC|SCHEDULE) 13G(\/A)?$/;
const pad10 = (c) => String(c).padStart(10, '0');
const sleep = (ms) => (ms > 0 ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const nowMs = (d) => (d && d.now ? d.now() : Date.now());

async function fetchText(url, deps, o) {
  const f = (deps && deps.fetch) || fetch;
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), (o && o.ms) || 15000);
  try {
    const r = await f(url, { headers: Object.assign({ 'User-Agent': (o && o.ua) || SEC_UA(), Accept: '*/*' }, (o && o.headers) || {}), signal: ctl.signal });
    if (r.status !== 200) return { status: r.status };
    return { status: 200, text: await r.text() };
  } catch (e) { return { status: 0 }; } finally { clearTimeout(to); }
}
async function fetchJson(url, deps, o) {
  const r = await fetchText(url, deps, o);
  if (r.status !== 200) return null;
  try { return JSON.parse(r.text); } catch (e) { return null; }
}

/* ---------- R2 ---------- */
/* deps.store — מחסן בזיכרון לבדיקות ({get(key), put(key, obj)}) במקום R2 */
function r2c(deps) { return (deps && deps.r2c) || R2.config(); }
function r2ok(deps) { return !!(deps && deps.store) || r2c(deps).ok; }
async function r2get(deps, key, max) {
  if (deps && deps.store) return deps.store.get(key);
  const c = r2c(deps); if (!c.ok) return null;
  const t = await R2.getText(c, deps || {}, key, max || 8 * 1024 * 1024);
  if (t == null) return null;
  try { return JSON.parse(t); } catch (e) { return null; }
}
async function r2put(deps, key, obj) {
  if (deps && deps.store) { deps.store.put(key, obj); return true; }
  const c = r2c(deps); if (!c.ok) return false;
  await R2.putText(c, deps || {}, key, JSON.stringify(obj), 'application/json');
  return true;
}
const emptyState = () => ({ v: 1, seen: {}, quarters: [], f13: {}, symbols: {}, exact: [], events: [], log: [] });

/* ---------- זמן ניו יורק ---------- */
function nyParts(ms) {
  const f = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const p = Object.fromEntries(f.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, min: (+p.hour % 24) * 60 + +p.minute };
}
const AFTER_CLOSE = 16 * 60 + 20;   // 16:20 בניו יורק — הסגירה הסופית כבר במחירים
/* היום האחרון שהמסחר בו הסתיים: יום המסחר של היום עוד פתוח → עד אתמול */
function lastClosedDay(dates, ms) {
  const ny = nyParts(ms);
  let i = dates.length - 1;
  while (i > 0 && (dates[i] > ny.date || (dates[i] === ny.date && ny.min < AFTER_CLOSE))) i--;
  return dates[i];
}
/* המטמון של מניה בתיק טרי אם נמשך אחרי הסגירה האחרונה (או ביום בלי מסחר אחריה) */
function pxFresh(cached, ms) {
  if (!cached || !cached.at) return false;
  const ny = nyParts(ms), at = nyParts(Date.parse(cached.at));
  if (ny.min >= AFTER_CLOSE) return at.date === ny.date && at.min >= AFTER_CLOSE;
  return at.date === ny.date || (at.date === B.addDays(ny.date, -1) && at.min >= AFTER_CLOSE);
}

/* ---------- CUSIP → סימבול ---------- */
function cusipIndex(state) {
  const m = new Map();
  for (const src of [DATA.symbols, (state && state.symbols) || {}]) for (const [sym, s] of Object.entries(src)) for (const cu of (s.cu || [])) m.set(String(cu).toUpperCase(), sym);
  return m;
}
/* CUSIP חדש: OpenFIGI (מיפוי ציבורי, בלי מפתח) → טיקר אמריקאי; בלי תשובה — חיפוש לפי שם המנפיק ב־Yahoo */
async function resolveCusip(cusip, issuer, deps) {
  try {
    const f = (deps && deps.fetch) || fetch;
    const r = await f('https://api.openfigi.com/v3/mapping', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ idType: 'ID_CUSIP', idValue: cusip, exchCode: 'US' }]) });
    if (r.status === 200) {
      const j = await r.json();
      const list = (j && j[0] && j[0].data) || [];
      const d = list.find((x) => x.ticker && /common|adr|reit|ordinary|share/i.test(x.securityType || '')) || list.find((x) => x.ticker);
      if (d) return { sym: String(d.ticker).replace(/\//g, '-').toUpperCase(), name: d.name || issuer };
    }
  } catch (e) { /* הבא */ }
  if (issuer) {
    const j = await fetchJson('https://query2.finance.yahoo.com/v1/finance/search?quotesCount=3&newsCount=0&q=' + encodeURIComponent(issuer), deps, { ua: YUA });
    const q = j && (j.quotes || []).find((x) => x.quoteType === 'EQUITY' && /^(NYQ|NMS|NGM|NCM|ASE|PCX|BTS)$/.test(x.exchange || ''));
    if (q && q.symbol) return { sym: String(q.symbol).toUpperCase(), name: q.longname || q.shortname || issuer };
  }
  return null;
}
async function symFor(cusip, name, state, deps, idx) {
  const cu = String(cusip || '').toUpperCase();
  let sym = idx.get(cu);
  if (sym) return sym;
  const got = cu ? await resolveCusip(cu, name, deps) : null;
  sym = got ? got.sym : 'CUSIP-' + cu;
  state.symbols[sym] = Object.assign({ n: got ? got.name : name, cu: [cu], c: 'US' }, got ? {} : { nd: 1 });
  idx.set(cu, sym);
  return sym;
}

/* ---------- קבצים של הגשה ---------- */
function filingBase(cik, acc) { return 'https://www.sec.gov/Archives/edgar/data/' + String(cik).replace(/^0+/, '') + '/' + acc.replace(/-/g, '') + '/'; }
async function filingFiles(cik, acc, deps) {
  const j = await fetchJson(filingBase(cik, acc) + 'index.json', deps);
  return ((j && j.directory && j.directory.item) || []).map((x) => x.name);
}

/* 13F: דף השער + הטבלה */
async function read13f(cik, row, deps) {
  const gap = deps.gap == null ? 250 : deps.gap;
  const names = await filingFiles(cik, row.acc, deps);
  await sleep(gap);
  const prim = names.find((n) => /^primary_doc\.xml$/i.test(n));
  const table = names.find((n) => /\.xml$/i.test(n) && !/^primary_doc\.xml$/i.test(n));
  if (!prim) return null;
  const pt = await fetchText(filingBase(cik, row.acc) + prim, deps);
  await sleep(gap);
  if (pt.status !== 200) return null;
  const primary = A.parse13fPrimary(pt.text);
  let rows = [];
  if (table) {
    const tt = await fetchText(filingBase(cik, row.acc) + table, deps);
    await sleep(gap);
    if (tt.status !== 200) return null;
    rows = A.parse13fTable(tt.text);
  }
  return { form: row.form, filed: row.filed, cik: String(cik).replace(/^0+/, ''), acc: row.acc, primary, rows };
}

/* רבעון אחרי ההגשות החדשות, בצורה הדחוסה של הנתונים: [[sym, shares, value(דולר), 'C'|'P'?]].
   רק תיקוני NEW HOLDINGS (אחזקה חסויה שנחשפה) → נוספים לרבעון שבריפו; דוח מקורי / RESTATEMENT → מחליף */
async function quarterRows(period, filings, state, deps) {
  const fresh = A.consolidateQuarter(filings);
  const onlyAdds = filings.every((f) => f.primary && f.primary.isAmendment && /NEW/i.test(f.primary.amendType || ''));
  const base = DATA.quarters.find((q) => q.p === period);
  const idx = cusipIndex(state);
  const m = new Map();
  const add = (sym, shares, value, pc) => {
    const k = sym + '|' + (pc || '');
    const a = m.get(k) || [sym, 0, 0].concat(pc ? [pc] : []);
    a[1] += shares; a[2] += value;
    m.set(k, a);
  };
  if (onlyAdds && base) for (const [sym, sh, v, pc] of base.h) add(sym, sh, v, pc);
  for (const r of fresh.rows) add(await symFor(r.cusip, r.name, state, deps, idx), Math.round(r.shares), Math.round(r.value), r.pc ? r.pc[0] : '');
  return [...m.values()].sort((a, b) => b[2] - a[2]);
}

/* Form 4 → עסקאות P/S במניות שבתיק; בלי עסקאות של הכלים של חברת הניהול */
function tradesFromForm4(doc, url, state) {
  const sym = String((doc.issuer && doc.issuer.ticker) || '').toUpperCase();
  const known = new Set(Object.keys(DATA.symbols).concat(Object.keys((state && state.symbols) || {})));
  if (!sym || !known.has(sym)) return [];
  const out = [];
  for (const t of doc.tx) {
    if (t.deriv || !/^[PS]$/.test(t.code) || !(t.shares > 0) || !(t.price > 0)) continue;
    const notes = t.footnoteIds.map((k) => doc.notes[k] || '').join(' ');
    if (A.OWN_RE.test(notes)) continue;
    out.push({ date: t.date, sym, qty: t.code === 'P' ? t.shares : -t.shares, price: t.price, src: 'Form 4', url });
  }
  return out;
}
/* נספח Trading Data של 13D → עסקאות במניה רגילה של הקרנות (לא Forward/אופציות, לא הכלים של חברת הניהול) */
function tradesFrom13d(rows, sym, url) {
  return rows.filter((r) => !r.deriv && !A.OWN_RE.test(r.fund || ''))
    .map((r) => ({ date: r.date, sym, qty: r.qty, price: r.price, src: '13D Item 5(c)', url, note: r.fund || '' }));
}
/* הוספה בלי כפילויות: עסקה שכבר דווחה (אותו תאריך ומניה) בהגשה אחרת — לא נכנסת שוב (13D/A חוזר על 60 יום, Form 4 + 13D על אותה עסקה).
   תיקון (4/A) מחליף את מה שדווח לאותם תאריכים */
function addTrades(state, trades, acc, replace) {
  if (!trades.length) return 0;
  const keys = new Set(trades.map((t) => t.date + '|' + t.sym));
  if (replace) state.exact = state.exact.filter((x) => !keys.has(x.date + '|' + x.sym));
  const taken = new Set(state.exact.filter((x) => x.acc !== acc).map((x) => x.date + '|' + x.sym));
  let n = 0;
  for (const t of trades) {
    if (t.date <= CUT.trades || taken.has(t.date + '|' + t.sym)) continue;
    state.exact.push(Object.assign({ acc }, t));
    n++;
  }
  return n;
}

/* ---------- 1. בדיקת הגשות חדשות ---------- */
async function handle(cik, row, state, d) {
  const gap = d.gap == null ? 250 : d.gap;
  const base = filingBase(cik, row.acc);
  const url = base + String(row.doc || '').replace(/^xsl[^/]+\//, '');
  if (FORM_13F.test(row.form)) {
    if (row.filed <= CUT.f13) return false;
    const f = await read13f(cik, row, d);
    if (!f || !f.primary.period) throw new Error('13f');
    if (String(cik) === A.CIK.psinc && !(f.primary.included || []).length) return false;   // Holdco בלי מנהלים כלולים
    const p = f.primary.period;
    state.f13[p] = (state.f13[p] || []).filter((x) => x.acc !== f.acc).concat([f]);
    const h = await quarterRows(p, state.f13[p], state, d);
    const accs = [...new Set(((DATA.quarters.find((x) => x.p === p) || {}).a || []).concat(state.f13[p].map((x) => x.acc)))];
    state.quarters = state.quarters.filter((x) => x.p !== p).concat([{ p, f: f.filed, a: accs, h }]).sort((a, b) => (a.p < b.p ? -1 : 1));
    state.events.push({ kind: '13F', form: row.form, filed: row.filed, period: p, n: h.length, acc: row.acc, url: base });
    return true;
  }
  if (FORM_4.test(row.form)) {
    const t = await fetchText(url, d);
    await sleep(gap);
    if (t.status !== 200) throw new Error('f4');
    const tr = tradesFromForm4(A.parseForm4(t.text), url, state);
    const n = addTrades(state, tr, row.acc, /\/A$/.test(row.form));
    if (n) state.events.push({ kind: 'F4', form: row.form, filed: row.filed, sym: tr[0].sym, n, acc: row.acc, url });
    return n > 0;
  }
  // 13D / 13G: לפי המנפיק — רק מניה שבתיק (או מניה חדשה ב־13D)
  const names = await filingFiles(cik, row.acc, d);
  await sleep(gap);
  const pt = await fetchText(base + 'primary_doc.xml', d);
  await sleep(gap);
  if (pt.status !== 200) throw new Error('13dg');
  const doc = A.parse13dg(pt.text);
  if (!doc.issuer.cusip || doc.issuer.cik === A.CIK.psinc) return false;
  const idx = cusipIndex(state);
  const isD = FORM_13D.test(row.form);
  if (!idx.get(doc.issuer.cusip) && !isD) return false;
  const sym = await symFor(doc.issuer.cusip, doc.issuer.name, state, d, idx);
  const own = doc.persons.filter((p) => A.OWN_RE.test(p.name)).reduce((s, p) => s + p.shares, 0);
  let n = 0;
  if (isD) {
    for (const nm of names.filter((x) => /ex-?99/i.test(x) && /\.html?$/i.test(x)).slice(0, 8)) {
      const ex = await fetchText(base + nm, d);
      await sleep(gap);
      if (ex.status !== 200) continue;
      const rows = A.parseTradingData(ex.text);
      if (rows.length) n += addTrades(state, tradesFrom13d(rows, sym, base + nm), row.acc, false);
    }
  }
  state.events.push({ kind: isD ? '13D' : '13G', form: row.form, filed: row.filed, sym, event: doc.event, shares: Math.max(0, doc.shares - own), pct: doc.pct, n, acc: row.acc, url: base });
  return true;
}

async function poll(deps) {
  const d = deps || {};
  const gap = d.gap == null ? 250 : d.gap;
  const state = Object.assign(emptyState(), (await r2get(d, KEY.state)) || {});
  let changed = false;
  for (const cik of [A.CIK.psinc, A.CIK.pscm]) {
    const sub = await fetchJson('https://data.sec.gov/submissions/CIK' + pad10(cik) + '.json', d);
    await sleep(gap);
    const r = sub && sub.filings && sub.filings.recent;
    if (!r || !Array.isArray(r.form)) continue;
    const rows = r.form.map((form, i) => ({ form, acc: r.accessionNumber[i], filed: r.filingDate[i], doc: r.primaryDocument[i] }))
      .filter((x) => x.filed > CUT.trades && !state.seen[x.acc] && (FORM_13F.test(x.form) || FORM_4.test(x.form) || FORM_13D.test(x.form) || FORM_13G.test(x.form)))
      .sort((a, b) => (a.filed < b.filed ? -1 : a.filed > b.filed ? 1 : 0));
    for (const row of rows) {
      try {
        if (await handle(cik, row, state, d)) changed = true;
        state.seen[row.acc] = row.filed;
      } catch (e) { /* נכשל (רשת / SEC) — ננסה שוב בסיבוב הבא */ }
    }
  }
  state.lastPoll = new Date(nowMs(d)).toISOString();
  state.events = state.events.slice(-200);
  await r2put(d, KEY.state, state);
  return { state, changed };
}

/* ---------- 2. מחירים ובנייה ---------- */
function firstNeeded(sym, state) {
  for (const q of DATA.quarters.concat((state && state.quarters) || [])) if (q.h.some((r) => r[0] === sym)) return q.p;
  return null;
}
/* מניה שכבר לא בתיק — ההיסטוריה שלה לא משתנה (מהמטמון); מניה בתיק ו־SPY — רענון אחרי כל סגירה */
async function priceSeries(sym, held, deps, state) {
  const d = deps || {};
  const cached = await r2get(d, KEY.px(sym), 4 * 1024 * 1024);
  if (cached && (!held || pxFresh(cached, nowMs(d)))) return cached;
  const first = firstNeeded(sym, state) || '2005-01-01';
  const p1 = Math.floor(Date.parse(B.addDays(first, -200)) / 1000), p2 = Math.floor(nowMs(d) / 1000);
  for (const host of ['query1', 'query2']) {
    const j = await fetchJson('https://' + host + '.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&events=div%2Csplits&period1=' + p1 + '&period2=' + p2, d, { ua: YUA, ms: 20000 });
    const s = j && B.seriesFromYahoo(j);
    if (s && s.d.length) { s.at = new Date(nowMs(d)).toISOString(); await r2put(d, KEY.px(sym), s); return s; }
  }
  return cached || null;
}

function bookVersion(book) {
  const last = book.navDaily[book.navDaily.length - 1] || {};
  return crypto.createHash('sha1').update(JSON.stringify([book.meta.toDate, book.positions.map((p) => [p.symbol, p.qty, p.markPrice]), book.trades.length, book.cashTransactions.length, last.total || last.nav || 0])).digest('hex').slice(0, 12);
}
/* מה השתנה בכמויות בין שני ספרים — לחלון "מה חדש" באפליקציה */
function diffBooks(prevPos, next) {
  const m0 = new Map((prevPos || []).map((p) => [p.symbol, p.qty]));
  const m1 = new Map(next.positions.map((p) => [p.symbol, p.qty]));
  const out = [];
  for (const [s, q] of m1) { const q0 = m0.get(s) || 0; if (Math.abs(q - q0) > 0.5) out.push({ sym: s, from: q0, to: q }); }
  for (const [s, q0] of m0) if (!m1.has(s)) out.push({ sym: s, from: q0, to: 0 });
  return out;
}

async function rebuild(deps, st) {
  const d = deps || {};
  const state = st || Object.assign(emptyState(), (await r2get(d, KEY.state)) || {});
  const extra = { quarters: state.quarters, symbols: state.symbols, exact: state.exact.map((x) => ({ date: x.date, sym: x.sym, qty: x.qty, price: x.price, src: x.src, url: x.url, note: x.note || '' })) };
  const need = AB.neededSymbols(DATA, extra, null);
  const last = state.quarters.length && state.quarters[state.quarters.length - 1].p > LASTQ.p ? state.quarters[state.quarters.length - 1] : LASTQ;
  const heldNow = new Set(last.h.map((r) => r[0]).concat(['SPY']).concat(state.exact.map((x) => x.sym)));
  const px = {}, missing = [];
  for (const sym of need) {
    const s = await priceSeries(sym, heldNow.has(sym), d, state);
    if (s) px[sym] = s; else missing.push(sym);
    await sleep(d.gap == null ? 150 : d.gap);
  }
  if (!px.SPY || missing.some((s) => heldNow.has(s))) return { ok: false, error: 'prices', missing };
  const asOf = lastClosedDay(px.SPY.d, nowMs(d));
  const book = AB.build(DATA, extra, px, { asOf });
  const v = bookVersion(book);
  const prev = await r2get(d, KEY.meta);
  const built = new Date(nowMs(d)).toISOString();
  if (prev && prev.v === v) { await r2put(d, KEY.meta, Object.assign(prev, { built, lastPoll: state.lastPoll || '' })); return { ok: true, same: true, v }; }
  const changes = prev ? diffBooks(prev.positions, book) : [];
  const meta = {
    v, asOf, built, lastPoll: state.lastPoll || '',
    lastQ: book.ackman.quarters[book.ackman.quarters.length - 1].period,
    positions: book.positions.map((p) => ({ symbol: p.symbol, qty: p.qty })),
    changes: changes.length ? changes : ((prev && prev.changes) || []),
    changedAt: changes.length ? asOf : ((prev && prev.changedAt) || ''),
    missing,
  };
  Object.assign(book.ackman, { v, asOf, lastPoll: meta.lastPoll, events: state.events.slice(-60), changes: meta.changes, changedAt: meta.changedAt });
  await r2put(d, KEY.book, book);
  await r2put(d, KEY.meta, meta);
  _mem = { at: 0, meta: null, v: '', gz: null, raw: null };
  return { ok: true, v, changes };
}

/* ---------- 3. השעון: בדיקה כל 10 דק׳ + בנייה יומית אחרי הסגירה ---------- */
let _busy = false;
async function tick(deps) {
  const d = deps || {};
  if (!r2ok(d)) return { ok: false, error: 'no_r2' };
  if (_busy) return { ok: true, busy: true };
  _busy = true;
  try {
    const { state, changed } = await poll(d);
    const meta = await r2get(d, KEY.meta);
    const ny = nyParts(nowMs(d));
    const builtNy = meta && meta.built ? nyParts(Date.parse(meta.built)) : null;
    const daily = ny.min >= AFTER_CLOSE && (!builtNy || builtNy.date < ny.date || builtNy.min < AFTER_CLOSE);
    if (changed || daily || !meta) return Object.assign({ polled: true }, await rebuild(d, state));
    return { ok: true, polled: true, changed: false };
  } finally { _busy = false; }
}

/* ---------- 4. הגשה לאפליקציה ---------- */
let _mem = { at: 0, meta: null, v: '', gz: null, raw: null };
async function serve(req, body, res, deps) {
  const d = deps || {};
  try {
    const now = Date.now();
    if (!_mem.meta || now - _mem.at > 60e3) { _mem.meta = await r2get(d, KEY.meta); _mem.at = now; }
    const meta = _mem.meta;
    if (!meta) return res.status(200).json({ ok: false, error: 'not_ready' });
    const want = String((body && body.v) || '').slice(0, 20);
    if (want && want === meta.v) return res.status(200).json({ ok: true, same: true, v: meta.v, asOf: meta.asOf });
    if (!_mem.raw || _mem.v !== meta.v) {
      const book = await r2get(d, KEY.book, 24 * 1024 * 1024);
      if (!book) return res.status(200).json({ ok: false, error: 'not_ready' });
      _mem.raw = Buffer.from(JSON.stringify({ ok: true, v: meta.v, asOf: meta.asOf, book }));
      _mem.gz = zlib.gzipSync(_mem.raw, { level: 9 });
      _mem.v = meta.v;
    }
    const ae = String((req && req.headers && (req.headers['accept-encoding'] || req.headers['Accept-Encoding'])) || '');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (/\bgzip\b/.test(ae)) {
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Origin, Accept-Encoding');
      res.statusCode = 200;
      return res.end(_mem.gz);
    }
    res.statusCode = 200;
    return res.end(_mem.raw);
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'failed' });
  }
}

module.exports = { poll, rebuild, tick, serve, handle, quarterRows, tradesFromForm4, tradesFrom13d, addTrades, diffBooks, bookVersion, nyParts, lastClosedDay, pxFresh, KEY, CUT,
  _reset: () => { _mem = { at: 0, meta: null, v: '', gz: null, raw: null }; _busy = false; } };
