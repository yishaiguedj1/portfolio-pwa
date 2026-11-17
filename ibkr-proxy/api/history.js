/* POST /api/history  { syms: ['SPY','LUMI.TA',…] (עד 40), range: '1y'|'5y'|'7y'|'10y'|'max' | '1d'|'5d' (תוך־יומי, v228) }
   (^XNDX — Nasdaq-100 כולל דיבידנדים — ההיסטוריה מ־Nasdaq, ראו fetchNasdaqIdx)
   או { op:'candles', sym, iv, to?, pre? } — נרות OHLCV לגרף הנרות (lib/candles.js)
   או { op:'fund', sym } / { op:'macro' } — דוחות כספיים ונתוני מקרו לניתוח חברה (lib/fundamentals.js)
   או { op:'ackman', v? } — תיק אקמן לדמו (lib/ackmanjob.js); GET ?job=ackman — העדכון האוטומטי (רק בשרת שלנו)
   -> { ok, data: { SYM: { t: [ימים מאז 1970], c: [סגירות] } }, failed: [...] }
   מחירי סגירה יומיים מ־Yahoo (מידע ציבורי) — מהשרת, בבקשה אחת לכל הסימבולים.
   למה: בטלפון Yahoo חוסם לפעמים (429 לכתובת של הספק הסלולרי), ולמניות ת"א אין מקור אחר.
   מניות ת"א (ILA = אגורות) מוחזרות בשקלים. אין כאן שום מידע של המשתמש.
   מאובטח כמו שאר השרתון: Origin מאושר בלבד, POST בלבד, גוף קטן, הגבלת קצב. */
const { guard, rateLimited, safeEqual } = require('../lib/ibkr');

const SYM_RE = /^\^?[A-Z0-9][A-Z0-9.\-=^]{0,15}$/; // v255: ^ בהתחלה = מדד (^GSPC); v274: עד 16 תווים (PEPE24478-USD)
const RANGES = new Set(['1y', '5y', '7y', '10y', 'max', '1d', '5d']); // v229: max = מתחילת המסחר (period1=0; range=max של Yahoo מחזיר נרות חודשיים) // 7y = 10y מ־Yahoo, חתוך ל־7 (תיק הדמו)
/* v228: טווחים תוך־יומיים לגרף המניה (1D / 5D). עד עכשיו הטלפון משך אותם ישירות מ־Yahoo (query1 → query2 → Stooq,
   12 שניות timeout לכל אחד) — כש־Yahoo חוסם את הטלפון זה היה איטי בהרבה משאר הטווחים (שמגיעים מהמטמון/השרתון).
   תשובה: { t: [דקות מאז 1970 בשעון הבורסה], c: [סגירות] }. מטמון קצר — המחיר זז. */
/* v230: 1d = חמישה ימים של נרות 5 דק׳ (בטרום־מסחר של יום חדש Yahoo מחזיר רק את הבוקר — האפליקציה מציגה את יום המסחר האחרון, תואם ל־Google);
   5d = נרות 30 דקות — Google מחשב 5D מהנר הראשון של 30 דק׳ (15 דק׳ נתן בסיס אחר לגמרי) */
const INTRA = { '1d': 'interval=5m&range=5d&includePrePost=true', '5d': 'interval=30m&range=5d' };
const INTRA_CACHE_MS = 60 * 1000;
const MAX_SYMS = 40;
const CONCURRENCY = 8;
const PER_FETCH_MS = 8000;
const BUDGET_MS = 22000; // לפני ש־Vercel (maxDuration 30) הורג את הפונקציה
const CACHE_MS = 6 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (compatible; portfolio-pwa/1.0)';
const cache = new Map(); // מופע חם בלבד — "best effort"

function parseIntra(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !Array.isArray(r.timestamp)) return null;
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const closes = q.close || [], opens = q.open || [];
  const div = String((r.meta && r.meta.currency) || '').toUpperCase() === 'ILA' ? 100 : 1;
  const off = Number((r.meta && r.meta.gmtoffset) || 0);
  const t = [], c = [], o = [];
  for (let i = 0; i < r.timestamp.length; i++) {
    const v = closes[i];
    if (!(v > 0)) continue;
    t.push(Math.floor((r.timestamp[i] + off) / 60));
    c.push(Math.round(v / div * 1e4) / 1e4);
    o.push(opens[i] > 0 ? Math.round(opens[i] / div * 1e4) / 1e4 : 0); // v230: 5D של Google מתחיל ממחיר הפתיחה
  }
  return t.length ? { t, c, o } : null;
}

function parseChart(j) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !Array.isArray(r.timestamp)) return null;
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const closes = q.close || [];
  const div = String((r.meta && r.meta.currency) || '').toUpperCase() === 'ILA' ? 100 : 1;
  const off = Number((r.meta && r.meta.gmtoffset) || 0);
  const t = [], c = [];
  let last = -1;
  for (let i = 0; i < r.timestamp.length; i++) {
    const v = closes[i];
    if (!(v > 0)) continue;
    const day = Math.floor((r.timestamp[i] + off) / 86400);
    const px = Math.round(v / div * 1e4) / 1e4;
    if (day === last) { c[c.length - 1] = px; continue; }
    t.push(day); c.push(px); last = day;
  }
  return t.length ? { t, c } : null;
}

/* 16/11/2026: מדדי השוואה כולל דיבידנדים לגרף הביצועים (תקן המקצוע — GIPS). S&P 500 TR ‏(^SP500TR) — מ־Yahoo כרגיל, מ־1988.
   Nasdaq-100 TR ‏(^XNDX) — ב־Yahoo יש רק מחיר נוכחי, בלי היסטוריה: ההיסטוריה מהמפרסם הרשמי (Nasdaq Global Index Watch, מ־1999),
   והיום — מ־Yahoo (אותה סדרה: הסגירה הקודמת שם = הסגירה האחרונה אצל Nasdaq, נבדק 16/11/2026). ערך מוכן — לא מחשבים דיבידנדים בעצמנו. */
const NQ_IDX = { '^XNDX': 'XNDX' };
const NQ_DAYS = { '1y': 366, '5y': 1827, '7y': 7 * 366, '10y': 3653 };
/* טהורה: aaData של Nasdaq → { t: [ימים מאז 1970], c: [ערכים] }, ישן → חדש. TimeStamp = חצות בניו־יורק (04:00/05:00Z) של יום המסחר */
function parseNasdaqIdx(j) {
  const rows = [];
  for (const x of (j && j.aaData) || []) {
    const m = /-?\d+/.exec(String((x && x.TimeStamp) || ''));
    const v = Number(x && x.Value);
    if (m && v > 0) rows.push([Math.floor(+m[0] / 86400000), Math.round(v * 1e4) / 1e4]);
  }
  rows.sort((a, b) => a[0] - b[0]);
  const t = [], c = [];
  for (const [d, v] of rows) { if (t.length && t[t.length - 1] === d) { c[c.length - 1] = v; continue; } t.push(d); c.push(v); }
  return t.length ? { t, c } : null;
}
async function fetchNasdaqIdx(sym, range, deadline) {
  const left = deadline - Date.now();
  if (left < 1500) return null;
  const days = NQ_DAYS[range];
  const day = (ms) => new Date(ms).toISOString().slice(0, 10) + 'T00:00:00.000';
  const from = days ? day(Date.now() - (days + 7) * 86400000) : '1990-01-01T00:00:00.000';
  const ctl = new AbortController();
  const to = setTimeout(() => ctl.abort(), Math.min(15000, left));
  try {
    const [r, live] = await Promise.all([
      fetch('https://indexes.nasdaqomx.com/Index/HistoryData', {
        method: 'POST', signal: ctl.signal,
        headers: { 'User-Agent': UA, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: 'id=' + NQ_IDX[sym] + '&startDate=' + from + '&endDate=' + day(Date.now() + 86400000) + '&timeOfDay=EOD',
      }),
      fetch('https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=1d&range=5d',
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal })
        .then((y) => (y.status === 200 ? y.json() : null)).then(parseChart).catch(() => null),
    ]);
    if (r.status !== 200) return null;
    const v = parseNasdaqIdx(await r.json());
    if (!v) return null;
    // היום (המסחר עוד פתוח / Nasdaq עוד לא פרסמה) — הערך החי מ־Yahoo, רק ימים שאחרי הסגירה האחרונה של Nasdaq
    if (live) for (let i = 0; i < live.t.length; i++) if (live.t[i] > v.t[v.t.length - 1]) { v.t.push(live.t[i]); v.c.push(live.c[i]); }
    return v;
  } catch (e) { return null; } finally { clearTimeout(to); }
}

async function fetchOne(sym, range, deadline) {
  const key = sym + '|' + range;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < (INTRA[range] ? INTRA_CACHE_MS : CACHE_MS)) return hit.v;
  if (NQ_IDX[sym] && !INTRA[range]) {
    const v = await fetchNasdaqIdx(sym, range, deadline);
    if (v) { cache.set(key, { at: Date.now(), v }); if (cache.size > 400) cache.clear(); }
    return v;
  }
  for (const host of ['query1', 'query2']) {
    const left = deadline - Date.now();
    if (left < 500) return null;
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), Math.min(PER_FETCH_MS, left));
    try {
      const url = 'https://' + host + '.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) +
        '?' + (INTRA[range] || (range === 'max' ? 'interval=1d&period1=0&period2=' + Math.floor(Date.now() / 1000)
          : 'interval=1d&range=' + (range === '7y' ? '10y' : range)));
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
      if (r.status !== 200) continue;
      const j = await r.json();
      let v = INTRA[range] ? parseIntra(j) : parseChart(j);
      if (v && range === '7y') {
        const from = Math.floor(Date.now() / 86400000) - 7 * 366;
        const k = v.t.findIndex((d) => d >= from);
        v = k > 0 ? { t: v.t.slice(k), c: v.c.slice(k) } : v;
      }
      if (v) {
        cache.set(key, { at: Date.now(), v });
        if (cache.size > 400) cache.clear();
        return v;
      }
    } catch (e) { /* המארח הבא */ } finally { clearTimeout(to); }
  }
  return null;
}

module.exports = async (req, res) => {
  /* 16/11/2026: העדכון האוטומטי של תיק אקמן (lib/ackmanjob.js) — GET ?job=ackman, כל 10 דק׳ מהשרת שלנו (server.js — startAckman).
     ב־Vercel לא רץ בכלל (אין שם קרון לדקות, ואף אחד מבחוץ לא יכול להפעיל אותו) */
  if (req.method === 'GET' && String((req.query && req.query.job) || '') === 'ackman') {
    if (process.env.VERCEL) return res.status(404).json({ ok: false, error: 'not_here' });
    const secret = process.env.CRON_SECRET;
    if (secret && !safeEqual(String(req.headers.authorization || ''), 'Bearer ' + secret)) return res.status(401).json({ ok: false });
    try { return res.status(200).json(await require('../lib/ackmanjob').tick()); }
    catch (e) { return res.status(502).json({ ok: false, error: String((e && e.message) || 'failed').slice(0, 30) }); }
  }
  if (guard(req, res)) return;
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0] || (req.socket && req.socket.remoteAddress) || 'unknown';
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  /* 27/10/2026: נרות OHLCV לגרף הנרות (lib/candles.js) — הגבלת קצב משלו (גלילה ומעבר טווחים לא על חשבון ה־20 לדקה) */
  if (body && body.op === 'candles') return require('../lib/candles').handle(body, res, ip);
  if (rateLimited(ip)) return res.status(429).json({ ok: false, error: 'rate_limited' });
  /* 25/10/2026: דוחות כספיים לניתוח חברה (op:'fund' {sym}) ונתוני מקרו למחשבון (op:'macro') — lib/fundamentals.js.
     כאן ולא בפונקציה חדשה: ב־Vercel Hobby כבר 12 מתוך 12. מידע ציבורי בלבד, כמו המחירים. */
  if (body && (body.op === 'fund' || body.op === 'macro' || body.op === 'fundFlags')) return require('../lib/fundamentals').handle(body, res);
  /* 01/11/2026: שער יציג של בנק ישראל למרכז המס (lib/boifx.js) — מידע ציבורי, מטמון 6 שעות */
  if (body && body.op === 'boifx') return require('../lib/boifx').handle(body, res);
  /* 15/11/2026: צפי לדוח הקרוב — קונצנזוס האנליסטים (Yahoo) וצפי ההנהלה מהודעת הדוחות הקודמת (SEC), lib/earnprev.js */
  if (body && body.op === 'earnPrev') return require('../lib/earnprev').handle(body, res);
  /* 16/11/2026: תיק אקמן לדמו של Invest — הספר המוכן מ־R2 (lib/ackmanjob.js), {v} = הגרסה שכבר בטלפון → {same:true}. מידע ציבורי */
  if (body && body.op === 'ackman') return require('../lib/ackmanjob').serve(req, body, res);
  const range = RANGES.has(body && body.range) ? body.range : '5y';
  const raw = Array.isArray(body && body.syms) ? body.syms : [];
  const syms = [...new Set(raw.map((s) => String(s || '').trim().toUpperCase()))].filter((s) => SYM_RE.test(s));
  if (!syms.length || syms.length > MAX_SYMS || raw.length > MAX_SYMS) {
    return res.status(400).json({ ok: false, error: 'bad_params' });
  }
  const deadline = Date.now() + BUDGET_MS;
  const data = {}, failed = [];
  let i = 0;
  const worker = async () => {
    while (i < syms.length) {
      const s = syms[i++];
      const v = await fetchOne(s, range, deadline);
      if (v) data[s] = v; else failed.push(s);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, syms.length) }, worker));
  return res.status(200).json({ ok: true, data, failed });
};

module.exports._parseChart = parseChart;
module.exports._parseIntra = parseIntra;
module.exports._parseNasdaqIdx = parseNasdaqIdx;
module.exports._fetchNasdaqIdx = fetchNasdaqIdx;
module.exports._cache = cache;
