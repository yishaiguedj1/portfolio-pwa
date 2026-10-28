/* 27/10/2026 (בקשת המשתמש — "גרף נרות" לפי ת־גרף): נרות OHLCV לגרף הנרות (chart.js בטלפון).
   POST /api/history { op:'candles', sym, iv, to?, pre? }
     iv: '1m'|'2m'|'5m'|'15m'|'30m'|'60m'|'1d'|'1wk'|'1mo' (טווחים אחרים — 3m, 4h, 6M… — מצורפים בטלפון)
     to: שניות UTC — טעינת היסטוריה ישנה יותר (גלילה שמאלה): הנרות שלפני הזמן הזה
     pre: true — כולל טרום/אחרי מסחר (תוך־יומי בלבד)
   -> { ok, iv, t:[שניות UTC], o, h, l, c, v, tz, cur, ex, name, more }
   מקור: Yahoo chart v8 (מידע ציבורי, כמו שאר המחירים). אין כאן שום מידע של המשתמש — לכן בלי appscope.
   מגבלות Yahoo (נמדד): 1m — עד 8 ימים לבקשה ורק 30 יום אחורה; 2m–30m — 60 יום; 60m — 730 יום; יומי ומעלה — הכל.
   ת"א (ILA = אגורות) → שקלים, כמו בשאר השרתון. הגבלת קצב נפרדת (גלילה ומעבר טווחים מהירים — לא על חשבון ה־20 לדקה). */
const IVS = {
  '1m': { win: 7, back: 29 }, '2m': { win: 20, back: 59 }, '5m': { win: 30, back: 59 }, '15m': { win: 59, back: 59 },
  '30m': { win: 59, back: 59 }, '60m': { win: 360, back: 729 }, '1d': { win: 365 * 12 }, '1wk': { win: 0 }, '1mo': { win: 0 },
};
const SYM_RE = /^\^?[A-Z0-9][A-Z0-9.\-=^]{0,15}$/;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const DAY = 86400;
const cache = new Map();
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 90;
}

/* חלון הבקשה: [p1, p2) בשניות. now מוזרק לבדיקות. null = אין עוד היסטוריה לטווח הזה */
function window_(iv, to, now) {
  const d = IVS[iv];
  const p2 = Math.min(to || now, now);
  if (!d.win) return { p1: 0, p2, more: false };
  const floor = d.back ? now - d.back * DAY : 0;
  if (p2 <= floor + 60) return null;
  const p1 = Math.max(floor, p2 - d.win * DAY);
  return { p1, p2, more: d.back ? p1 > floor + 60 : p1 > 0 };
}

/* תשובת Yahoo → עמודות. נר בלי מחיר (חור בנתונים) — מדולג; גבוה/נמוך עקביים עם פתיחה/סגירה. טהורה. */
function parse(j, iv) {
  const r = j && j.chart && j.chart.result && j.chart.result[0];
  if (!r || !Array.isArray(r.timestamp)) return null;
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const meta = r.meta || {};
  const k = String(meta.currency || '').toUpperCase() === 'ILA' ? 100 : 1;
  const rd = (x) => Math.round(x / k * 1e6) / 1e6;
  const out = { t: [], o: [], h: [], l: [], c: [], v: [] };
  let last = -1;
  /* נר רפאים: בתוך־יומי Yahoo מוסיף בשעת סגירת המסחר הרגיל נר שטוח (פ=ג=נ=ס) בלי נפח — הוא לא נר אמיתי,
     והוא צובע את תווית המחיר האחרון באפור ומציג נפח 0. מדולג (27/10/2026, מול TradingView). */
  const ctp = meta.currentTradingPeriod && meta.currentTradingPeriod.regular;
  const ghost = /m$/.test(iv) && ctp && +ctp.end > 0 ? +ctp.end : 0;
  for (let i = 0; i < r.timestamp.length; i++) {
    const c = q.close && q.close[i];
    if (!(c > 0)) continue;
    const t = r.timestamp[i];
    if (t <= last) continue;   // Yahoo מחזיר לפעמים את הנר האחרון פעמיים
    const o = q.open && q.open[i] > 0 ? q.open[i] : c;
    const h = Math.max(q.high && q.high[i] > 0 ? q.high[i] : c, o, c);
    const l = Math.min(q.low && q.low[i] > 0 ? q.low[i] : c, o, c);
    if (ghost && t === ghost && h === l && !((q.volume && q.volume[i]) > 0)) continue;
    out.t.push(t); out.o.push(rd(o)); out.h.push(rd(h)); out.l.push(rd(l)); out.c.push(rd(c));
    out.v.push(Math.max(0, Math.round((q.volume && q.volume[i]) || 0)));
    last = t;
  }
  /* עם טרום/אחרי Yahoo מוסיף בסוף "נר" חי בזמן המחיר האחרון (למשל 20:50 ב־15m) — שטוח ולא מיושר לטווח.
     בטלפון הוא הופיע כנר אפור בלי תנועה. נקודה שקרובה לנר הקודם פחות מאורך הטווח — מתמזגת לתוכו. */
  const sec = /^(\d+)m$/.test(iv) ? +RegExp.$1 * 60 : 0, n = out.t.length;
  if (sec && n > 1 && out.t[n - 1] - out.t[n - 2] < sec) {
    out.h[n - 2] = Math.max(out.h[n - 2], out.h[n - 1]); out.l[n - 2] = Math.min(out.l[n - 2], out.l[n - 1]);
    out.c[n - 2] = out.c[n - 1]; out.v[n - 2] += out.v[n - 1];
    for (const k of ['t', 'o', 'h', 'l', 'c', 'v']) out[k].pop();
  }
  out.tz = String(meta.exchangeTimezoneName || 'America/New_York');
  out.cur = String(meta.currency || '').toUpperCase() === 'ILA' ? 'ILS' : String(meta.currency || '');
  out.ex = String(meta.exchangeName || '');
  out.name = String(meta.longName || meta.shortName || '');
  out.iv = iv;
  return out;
}

async function fetchYahoo(sym, iv, w, pre) {
  const qs = 'interval=' + iv + '&period1=' + Math.floor(w.p1) + '&period2=' + Math.floor(w.p2) +
    (pre && /m$/.test(iv) ? '&includePrePost=true' : '') + '&events=div%2Csplits';
  for (const host of ['query1', 'query2']) {
    const ctl = new AbortController();
    const to = setTimeout(() => ctl.abort(), 9000);
    try {
      const r = await fetch('https://' + host + '.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?' + qs,
        { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: ctl.signal });
      if (r.status === 404) return { err: 'not_found' };
      if (r.status !== 200) continue;
      const v = parse(await r.json(), iv);
      if (v) return v;
    } catch (e) { /* המארח הבא */ } finally { clearTimeout(to); }
  }
  return null;
}

async function handle(body, res, ip, nowMs) {
  if (limited(ip || 'x')) return res.status(429).json({ ok: false, error: 'rate_limited' });
  const sym = String((body && body.sym) || '').trim().toUpperCase();
  const iv = String((body && body.iv) || '');
  const to = Number(body && body.to) || 0;
  const pre = !!(body && body.pre);
  if (!SYM_RE.test(sym) || !IVS[iv] || to < 0 || !isFinite(to)) return res.status(400).json({ ok: false, error: 'bad_params' });
  const now = Math.floor((nowMs || Date.now()) / 1000);
  const w = window_(iv, to, now);
  if (!w) return res.status(200).json({ ok: true, iv, t: [], o: [], h: [], l: [], c: [], v: [], more: false });
  // מטמון: הנרות האחרונים מתעדכנים (15 שנ׳ תוך־יומי, דקה יומי ומעלה); היסטוריה ישנה (to) — 10 דקות
  const key = sym + '|' + iv + '|' + (to ? Math.floor(to / 60) : 0) + '|' + (pre ? 1 : 0);
  const ttl = to ? 600000 : /m$/.test(iv) ? 15000 : 60000;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return res.status(200).json(hit.v);
  const v = await fetchYahoo(sym, iv, w, pre);
  if (!v) return res.status(502).json({ ok: false, error: 'upstream' });
  if (v.err) return res.status(200).json({ ok: false, error: v.err });
  const out = Object.assign({ ok: true }, v, { more: w.more });
  if (to) { // רק מה שלפני to (Yahoo מחזיר לפעמים נר אחד אחרי)
    const k = out.t.findIndex((x) => x >= to);
    if (k >= 0) for (const f of ['t', 'o', 'h', 'l', 'c', 'v']) out[f] = out[f].slice(0, k);
  }
  cache.set(key, { at: Date.now(), v: out });
  if (cache.size > 600) cache.clear();
  return res.status(200).json(out);
}

module.exports = { handle, _parse: parse, _window: window_, _cache: cache, IVS };
