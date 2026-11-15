/* earnprev.js — "צפי לדוח הקרוב" (op:'earnPrev' ב־api/history.js, 15/11/2026) — כרטיס "דוחות קרובים" וגיליון הדוח ב־Invest.
   שני מקורות, שניהם מידע שוק ציבורי בלבד (שום נתון של המשתמש לא עובר כאן — רק סימבולים):
   1. האנליסטים — Yahoo quoteSummary (calendarEvents + earningsTrend): קונצנזוס רווח למניה והכנסות לרבעון שמדווח,
      טווח, מספר אנליסטים ומה היה לפני שנה. גם לת״א.
   2. ההנהלה — הצפי שהחברה עצמה פרסמה בהודעת הדוחות הקודמת: SEC EDGAR, טופס 8-K עם סעיף 2.02 (תוצאות) ונספח 99.1.
      אין שם מבנה קבוע (משפטים, תבליטים, טבלאות) — לכן חילוץ זהיר: רק ערכים בצורת צפי (טווח, ±, "צפוי … בערך"),
      תקופה לפי הסימון הקרוב ביותר (רבעון / שנה), ובדיקת סבירות מול קונצנזוס האנליסטים — ערך רחוק ממנו נזרק
      (הכנסות של מגזר, יחידות שגויות). עדיף בלי שורת הנהלה מאשר מספר שגוי. רק חברות שמגישות ל־SEC; ת״א — בלי.
   פלט: { ok, data: { SYM: { a?: {...}, g?: {...} } } } — הצורות ב־analysts() וב־guidance(). */
const UA = 'Mozilla/5.0 (compatible; portfolio-pwa/1.0)';
const SEC_UA = () => process.env.SEC_UA || 'TheSnowball/1.0 data@thesnowball.app';
const SYM_RE = /^[A-Z0-9][A-Z0-9.\-]{0,15}$/;
const MAX_SYMS = 16;
const TTL_A = 3 * 3600e3;    // אומדנים — משתנים לאט
const TTL_G = 12 * 3600e3;   // הגשות ל־SEC — פעם ברבעון
const BUDGET_MS = 20000;
const cache = new Map();     // 'a:SYM' / 'g:SYM' / 'x:ACC' -> { at, v }
function cget(k, ttl) { const h = cache.get(k); return h && Date.now() - h.at < ttl ? h : null; }
function cset(k, v) { cache.set(k, { at: Date.now(), v }); if (cache.size > 600) cache.delete(cache.keys().next().value); return v; }

async function get(url, headers, ms, kind) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms || 8000);
  try {
    const r = await fetch(url, { headers, signal: ctl.signal });
    if (r.status !== 200) { const e = new Error('http_' + r.status); e.status = r.status; throw e; }
    return kind === 'text' ? await r.text() : await r.json();
  } finally { clearTimeout(to); }
}

/* ---------- 1. האנליסטים (Yahoo) ---------- */
const raw = (o, k) => (o && o[k] && typeof o[k] === 'object' && typeof o[k].raw === 'number' ? o[k].raw : null);
const r4 = (v) => (v == null ? null : Math.round(v * 1e4) / 1e4);
/* תשובת quoteSummary → { d: תאריך הדוח, q: { eps, epsLo, epsHi, rev, revLo, revHi, n, rn, yEps, yRev, end }, y: { eps, rev, end }, cur } — טהורה */
function parseAnalysts(j) {
  const r = j && j.quoteSummary && j.quoteSummary.result && j.quoteSummary.result[0];
  if (!r) return null;
  const ce = (r.calendarEvents && r.calendarEvents.earnings) || {};
  const ed = ((ce.earningsDate || [])[0] || {}).raw;
  const d = ed > 0 ? new Date(ed * 1000).toISOString().slice(0, 10) : null;
  const tr = (r.earningsTrend && r.earningsTrend.trend) || [];
  // הרבעון שמדווח: 0q, אלא אם הוא כבר הסתיים אחרי תאריך הדוח (Yahoo מתעדכן באיחור) — אז זה שלפניו לא קיים, נשארים עם 0q
  const tq = tr.find((t) => t.period === '0q') || {};
  const ty = tr.find((t) => t.period === '0y') || {};
  const ee = tq.earningsEstimate || {}, rv = tq.revenueEstimate || {};
  const q = {
    eps: r4(raw(ce, 'earningsAverage') ?? raw(ee, 'avg')), epsLo: r4(raw(ce, 'earningsLow') ?? raw(ee, 'low')), epsHi: r4(raw(ce, 'earningsHigh') ?? raw(ee, 'high')),
    rev: raw(ce, 'revenueAverage') ?? raw(rv, 'avg'), revLo: raw(ce, 'revenueLow') ?? raw(rv, 'low'), revHi: raw(ce, 'revenueHigh') ?? raw(rv, 'high'),
    n: raw(ee, 'numberOfAnalysts'), rn: raw(rv, 'numberOfAnalysts'), yEps: r4(raw(ee, 'yearAgoEps')), yRev: raw(rv, 'yearAgoRevenue'),
    end: tq.endDate || null,
  };
  const ye = ty.earningsEstimate || {}, yr = ty.revenueEstimate || {};
  const y = { eps: r4(raw(ye, 'avg')), rev: raw(yr, 'avg'), end: ty.endDate || null };
  const cur = ee.earningsCurrency || rv.revenueCurrency || null;
  if (q.eps == null && q.rev == null) return d ? { d } : null;   // בלי כיסוי אנליסטים
  for (const k of Object.keys(q)) if (q[k] == null) delete q[k];
  const out = { d, q, cur };
  if (y.eps != null || y.rev != null) { for (const k of Object.keys(y)) if (y[k] == null) delete y[k]; out.y = y; }
  return out;
}
async function analysts(sym) {
  const hit = cget('a:' + sym, TTL_A); if (hit) return hit.v;
  const { _getCrumb } = require('../api/quotes');
  for (let a = 0; a < 2; a++) {
    const cs = await _getCrumb(a > 0);
    const url = 'https://query2.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(sym) +
      '?modules=calendarEvents,earningsTrend&crumb=' + encodeURIComponent(cs.crumb);
    try { return cset('a:' + sym, parseAnalysts(await get(url, { 'User-Agent': UA, Cookie: cs.cookie }, 7000))); }
    catch (e) { if (!(e.status === 401 || e.status === 403)) { if (e.status === 404) return cset('a:' + sym, null); throw e; } }
  }
  return null;
}

/* ---------- 2. ההנהלה (SEC, הודעת הדוחות הקודמת) ---------- */
/* HTML → טקסט רציף (בלי תגיות, ישויות ורווחים כפולים) — טהורה */
function htmlText(h) {
  // תגיות בתוך שורה (span/font/b/a) נמחקות בלי רווח — אחרת "reporte d"; תגיות מבנה (td/p/div/br) = רווח
  return String(h || '').replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<\/?(?:span|font|b|i|u|em|strong|a|sup|sub|ix:[a-z]+)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d{1,6});/g, (x, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-f]{1,6});/gi, (x, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/g, '&').replace(/&rsquo;/g, '’').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
    .replace(/&plusmn;/g, '±').replace(/&[a-z]+;/gi, ' ')
    .replace(/[\u00a0\u2009\u202f]/g, ' ').replace(/\s+/g, ' ');
}
const UNIT = { billion: 1e9, b: 1e9, bn: 1e9, million: 1e6, m: 1e6, mm: 1e6 };
const NUM = '\\$\\s?\\(?(\\d[\\d,]*(?:\\.\\d+)?)\\)?(?:\\s*(billion|million|bn|B|M|MM)\\b)?';
const num = (s) => Number(String(s).replace(/,/g, ''));
const unitOf = (u) => (u ? UNIT[String(u).toLowerCase()] || null : null);
/* ערך צפי שמתחיל במקום i: טווח ($X עד $Y), ± ($X ± $Y / Z%), או בערך ($X) — [lo, hi, יחידה|null, סוג] */
const RE_RANGE = new RegExp('^' + NUM + '\\s*(?:to|-|–|—|and)\\s*' + NUM.replace('\\$\\s?', '\\$?\\s?'), 'i');
const RE_PM = new RegExp('^' + NUM + ',?\\s*(?:plus or minus|±|\\+/-)\\s*(?:\\$\\s?(\\d[\\d,]*(?:\\.\\d+)?)(?:\\s*(billion|million|bn|B|M|MM)\\b)?|(\\d+(?:\\.\\d+)?)\\s*%)', 'i');
const RE_ONE = new RegExp('^' + NUM, 'i');
function valueAt(s) {
  let m = RE_RANGE.exec(s);
  if (m) { const u = unitOf(m[4]) || unitOf(m[2]); return [num(m[1]), num(m[3]), u, 'r', m[0].length]; }
  m = RE_PM.exec(s);
  if (m) {
    const v = num(m[1]), u = unitOf(m[2]);
    if (m[5]) return [v * (1 - num(m[5]) / 100), v * (1 + num(m[5]) / 100), u, 'p', m[0].length];
    const d = num(m[3]) * ((unitOf(m[4]) || u || 1) / (u || 1));
    return [v - d, v + d, u, 'p', m[0].length];
  }
  m = RE_ONE.exec(s);
  if (m) return [num(m[1]), num(m[1]), unitOf(m[2]), '1', m[0].length];
  return null;
}
/* סימוני תקופה: רבעון ("third quarter of fiscal 2027", "Q2 FY 2027", "FQ1-27") קודם, כדי שה־FY שבתוכו לא ייחשב כשנה */
const RE_QTR = /\b(?:(?:first|second|third|fourth|1st|2nd|3rd|4th)[- ]quarter(?: of)?(?: (?:fiscal|FY))?(?: year)?(?: ?'?\d{2,4})?|F?Q[1-4](?:\s*(?:FY|F)?\s*'?-?\d{2,4})?|(?:current|next|coming) quarter|quarter ending)\b/gi;
const RE_YEAR = /\b(?:full[- ]year|fiscal(?: year)? ?'?\d{2,4}|fiscal year|FY ?'?\d{2,4}|(?:calendar )?year 20\d\d|annual)\b/gi;
function periodBefore(t, at) {
  const w = t.slice(Math.max(0, at - 420), at);
  let q = -1, y = -1, m;
  RE_QTR.lastIndex = 0; while ((m = RE_QTR.exec(w))) q = m.index + m[0].length;
  const masked = w.replace(RE_QTR, (x) => ' '.repeat(x.length));
  RE_YEAR.lastIndex = 0; while ((m = RE_YEAR.exec(masked))) y = m.index + m[0].length;
  return q < 0 && y < 0 ? null : q >= y ? 'q' : 'y';
}
const RE_EXPECT = /\b(?:expect|expects|expected|expecting|guidance|outlook|target|targets|anticipate|anticipates|forecast|project|projects|estimates? that|reaffirm|raising|raises|narrow)/i;
/* מחפש מילת מפתח (הכנסות / רווח למניה) ואחריה ערך בצורת צפי. עד 90 תווים בין המילה לערך (טבלאות: "Revenue $18.0 billion - $18.2 billion").
   טבלה עם כמה עמודות (רבעון | שנה, GAAP | Non-GAAP) — גם הערכים שבאים מיד אחרי הראשון (col > 0). */
const RE_PRE = /\b(?:expect|expects|we expect|forecasting|forecast|planning for|anticipate|anticipates|guidance|outlook|targets?)\b[^.$]{0,30}$/i;
const RE_NEXT = /^\s*[;,]?\s*(?:and\s+)?(?:\(?\d\)?\s*)?(?:(non-?GAAP|adjusted|GAAP)\s*:?\s*)?(?=\$)/i;
function scan(t, kw, kind) {
  const out = [];
  let m;
  kw.lastIndex = 0;
  while ((m = kw.exec(t))) {
    if (!m[0]) { kw.lastIndex++; continue; }
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 260);
    const k = after.search(/\$/);
    if (k < 0 || k > 90) continue;
    const gap = after.slice(0, k);
    if (/[.;•◦▪]\s/.test(gap) || /\b(?:compared|versus|vs\.?|from|up|down|increased?|decreased?|grew|was|were|declined?|rose)\b/i.test(gap)) continue;   // תוצאה בפועל / השוואה
    const back = t.slice(Math.max(0, m.index - 260), m.index);
    const sent = back.slice(Math.max(back.lastIndexOf('. '), back.lastIndexOf('• '), back.lastIndexOf('◦ ')) + 1) + m[0] + gap;
    if (!RE_EXPECT.test(t.slice(Math.max(0, m.index - 700), m.index + m[0].length + k))) continue;   // אין הקשר של צפי בסביבה
    const p = periodBefore(t, m.index + m[0].length + k);
    const lab0 = t.slice(Math.max(0, m.index - 40), m.index + m[0].length + k);
    const near = t.slice(Math.max(0, m.index - 600), m.index);
    let pos = k, col = 0, lab = lab0;
    while (col < 3) {
      const v = valueAt(after.slice(pos));
      if (!v) break;
      // ערך בודד — רק כשברור שזה צפי: "צפוי … בערך", "guidance of", או "we expect revenue of"
      const single = v[3] === '1';
      const okSingle = !single || (/\b(?:approximately|about|around|roughly)\b|~/i.test(gap) && RE_EXPECT.test(sent)) ||
        /\b(?:guidance|outlook|expected to be|to be)\b/i.test(m[0] + gap) || RE_PRE.test(back.slice(-40));
      // ערך בודד ומיד אחריו עוד ערך = שורה בטבלת תוצאות לפי תקופות (רבעונים קודמים | צפי) — לא צפי אחד
      const nx0 = single ? /^\s{0,3}\$/.exec(after.slice(pos + v[4])) : null;
      if (okSingle && !nx0 && (single ? col === 0 : true)) {
        let adj = -1;
        if (kind === 'eps') adj = /non-?GAAP|adjusted/i.test(lab) ? 1 : /\bGAAP\b/.test(lab) ? 0 : col > 0 && /non-?GAAP|adjusted/i.test(near) ? 1 : -1;
        out.push({ p, lo: v[0], hi: v[1], u: v[2], f: v[3], adj, col, at: m.index });
      }
      if (single) break;
      pos += v[4];
      const nx = RE_NEXT.exec(after.slice(pos));
      if (!nx || nx[0].length > 25) break;
      lab = nx[1] || '';
      pos += nx[0].length;
      col++;
    }
  }
  return out;
}
const RE_REV = /\b(?:total |net |GAAP |non-GAAP |consolidated )?(?:revenues?|net sales|sales)\b(?: of| to be| is expected to be| are expected to be| expected to be| will be| in the range of| guidance(?: to| of)?| between| outlook(?: of)?)?/gi;
const RE_EPS = /\b(?:(?:non-GAAP|adjusted|GAAP) )?(?:diluted )?(?:earnings per (?:diluted )?share|EPS|net income per (?:diluted )?share)(?: \((?:EPS|diluted)\))?(?:,? diluted)?(?: of| to be| is expected to be| expected to be| will be| in the range of| between)?/gi;
const SEG = /\b(?:segment|data center|cloud|services|subscription|product|AI|gaming|automotive|commercial|government|international|U\.S\.|recurring|ARR|digital|organic|comparable|same[- ]store|comp)\s+$/i;

/* טקסט הודעת הדוחות + קונצנזוס → { q?: { rev?, eps? }, y?: {…} } כש־rev/eps = [lo, hi] (eps גם adj: 0/1) — טהורה */
function extractGuidance(text, a) {
  const t = htmlText(text);
  const cand = { q: {}, y: {} };
  const cons = (p, k) => (a ? (p === 'q' ? a.q && a.q[k] : a.y && a.y[k]) : null);
  // התקופה: אם יש קונצנזוס — לפי איזו תקופה הערך מתאים (רבעון ושנה רחוקים פי ~4); אחרת לפי הסימון בטקסט
  const fit = (mid, k, lo, hi, p0) => {
    const ok = ['q', 'y'].filter((p) => { const r = cons(p, k); return r > 0 && mid / r > lo && mid / r < hi; });
    if (ok.length) return ok.includes(p0) ? p0 : ok[0];
    return cons('q', k) > 0 || cons('y', k) > 0 ? null : p0;
  };
  for (const c of scan(t, RE_REV, 'rev')) {
    if (SEG.test(t.slice(Math.max(0, c.at - 30), c.at))) continue;   // הכנסות של מגזר / מוצר
    let mult = c.u;
    if (!mult) {
      const refs = [cons('q', 'rev'), cons('y', 'rev')].filter((r) => r > 0);
      mult = [1e9, 1e6, 1e3].find((x) => refs.some((ref) => { const r = ((c.lo + c.hi) / 2) * x / ref; return r > 0.8 && r < 1.25; })) || null;
      if (!mult) continue;   // בלי יחידה ובלי קונצנזוס תואם — לא מנחשים
    }
    const lo = c.lo * mult, hi = c.hi * mult, mid = (lo + hi) / 2;
    if (!(mid >= 1e6) || hi < lo) continue;
    const p = fit(mid, 'rev', 0.8, 1.25, c.p);   // רחוק מהקונצנזוס — כנראה לא סך ההכנסות
    if (!p) continue;
    if (!cand[p].rev) cand[p].rev = [Math.round(lo), Math.round(hi)];
  }
  const eps = { q: [], y: [] };
  for (const c of scan(t, RE_EPS, 'eps')) {
    if (c.u || !(c.hi >= c.lo) || c.hi > 5000) continue;
    const mid = (c.lo + c.hi) / 2;
    const p = fit(mid, 'eps', 0.75, 1.33, c.p);
    if (!p) continue;
    eps[p].push(c);
  }
  for (const p of ['q', 'y']) {
    const l = eps[p];
    if (!l.length) continue;
    // מתואם קודם (הקונצנזוס הוא מתואם), אחר כך בלי סימון, אחרון GAAP; בתיקו — הגבוה (מתואם בדרך כלל גבוה מ־GAAP)
    const pick = l.slice().sort((x, y) => (y.adj === 1) - (x.adj === 1) || (x.adj === 0) - (y.adj === 0) || (y.lo + y.hi) - (x.lo + x.hi))[0];
    cand[p].eps = [r4(pick.lo), r4(pick.hi)];
    if (pick.adj === 0) cand[p].gaap = 1;   // רק GAAP — הקונצנזוס מתואם, ההשוואה חלקית
  }
  const out = {};
  for (const p of ['q', 'y']) if (cand[p].rev || cand[p].eps) out[p] = cand[p];
  return out;
}

/* ההגשה האחרונה עם תוצאות (8-K, סעיף 2.02) ב־submissions → { acc, fd, cik } — טהורה */
function lastResults(sb) {
  const r = sb && sb.filings && sb.filings.recent;
  if (!r || !Array.isArray(r.form)) return null;
  for (let i = 0; i < r.form.length && i < 120; i++) {
    if (r.form[i] === '8-K' && /(^|,)\s*2\.02/.test(r.items && r.items[i] || '')) return { acc: r.accessionNumber[i], fd: r.filingDate[i] };
  }
  return null;
}
/* דף האינדקס של ההגשה → הקישור לנספח 99.1 (או 99.01 / 99) — טהורה */
function exhibitHref(idx) {
  let best = null, rank = 9;
  for (const row of String(idx || '').split(/<tr/i)) {
    const ty = (row.match(/>\s*(EX-99(?:\.\d+)?)\s*</i) || [])[1];
    const href = (row.match(/href="(\/Archives\/[^"]+\.html?)"/i) || [])[1];
    if (!ty || !href) continue;
    const r = /^EX-99\.0?1$/i.test(ty) ? 0 : /^EX-99$/i.test(ty) ? 1 : 2;
    if (r < rank) { best = href; rank = r; }
  }
  return best;
}
async function guidance(sym, a) {
  if (/\.TA$/i.test(sym)) return null;   // ת״א — לא ב־SEC
  const hit = cget('g:' + sym, TTL_G); if (hit) return hit.v;
  const F = require('./fundamentals');
  const H = { 'User-Agent': SEC_UA() };
  const cik = (await F.cikMap()).get(F.secSym(sym));
  if (!cik) return cset('g:' + sym, null);
  const last = lastResults(await get('https://data.sec.gov/submissions/CIK' + cik + '.json', H, 8000));
  if (!last) return cset('g:' + sym, null);
  const fd = last.fd;
  const key = 'x:' + last.acc;
  let ex = cget(key, 30 * 24 * 3600e3);
  if (!ex) {
    const base = 'https://www.sec.gov/Archives/edgar/data/' + Number(cik) + '/' + last.acc.replace(/-/g, '') + '/';
    const href = exhibitHref(await get(base + last.acc + '-index.htm', H, 8000, 'text'));
    const html = href ? await get('https://www.sec.gov' + href, H, 10000, 'text') : '';
    ex = cset(key, html.length > 2e6 ? html.slice(0, 2e6) : html);   // מטמון לפי ההגשה — הטקסט לא משתנה
  }
  const g = ex.v ? extractGuidance(ex.v, a) : {};
  return cset('g:' + sym, Object.keys(g).length ? Object.assign({ fd }, g) : null);
}

/* ---------- op:'earnPrev' { syms } ---------- */
async function handle(body, res) {
  const raw0 = Array.isArray(body && body.syms) ? body.syms : [];
  const syms = [...new Set(raw0.map((s) => String(s || '').trim().toUpperCase()))].filter((s) => SYM_RE.test(s));
  if (!syms.length || raw0.length > MAX_SYMS) return res.status(400).json({ ok: false, error: 'bad_params' });
  const deadline = Date.now() + BUDGET_MS;
  const data = {};
  let i = 0;
  const worker = async () => {
    while (i < syms.length && Date.now() < deadline) {
      const s = syms[i++];
      const o = {};
      try { const a = await analysts(s); if (a) o.a = a; } catch (e) { /* בלי אנליסטים */ }
      if (Date.now() < deadline) { try { const g = await guidance(s, o.a); if (g) o.g = g; } catch (e) { /* בלי צפי הנהלה */ } }
      data[s] = o;
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, syms.length) }, worker));   // SEC: עד 10 בקשות בשנייה
  res.setHeader && res.setHeader('Cache-Control', 'private, max-age=1800');
  return res.status(200).json({ ok: true, data });
}

module.exports = { handle, parseAnalysts, extractGuidance, htmlText, valueAt, periodBefore, lastResults, exhibitHref, _cache: cache };
