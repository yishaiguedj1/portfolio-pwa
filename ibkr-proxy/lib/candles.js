/* 27/10/2026 (בקשת המשתמש — "גרף נרות" לפי ת־גרף): נרות OHLCV לגרף הנרות (chart.js בטלפון).
   POST /api/history { op:'candles', sym, iv, to?, pre? }
     iv: '1m'|'2m'|'5m'|'15m'|'30m'|'60m'|'1d'|'1wk'|'1mo' (טווחים אחרים — 3m, 4h, 6M… — מצורפים בטלפון)
     to: שניות UTC — טעינת היסטוריה ישנה יותר (גלילה שמאלה): הנרות שלפני הזמן הזה
     pre: true — כולל טרום/אחרי מסחר (תוך־יומי בלבד)
   -> { ok, iv, t:[שניות UTC], o, h, l, c, v, tz, cur, ex, name, more }
   מקור: Yahoo chart v8 (מידע ציבורי, כמו שאר המחירים). אין כאן שום מידע של המשתמש — לכן בלי appscope.
   מגבלות Yahoo (נמדד): 1m — עד 8 ימים לבקשה ורק 30 יום אחורה; 2m–30m — 60 יום; 60m — 730 יום; יומי ומעלה — הכל.
   ת"א (ILA = אגורות) → שקלים, כמו בשאר השרתון. הגבלת קצב נפרדת (גלילה ומעבר טווחים מהירים — לא על חשבון ה־20 לדקה).
   17/11/2026 (בדיקת העומק של הגרף, docs/chart-deep-audit.md): שבועי וחודשי — צבירה של היומי של Yahoo, לא ה־1wk/1mo שלו.
     שלו שגוי: שבוע חמישי–רביעי בסמלים מלפני 1970 (C-013), שורה כפולה לתקופה הנוכחית (C-003), חודשים חסרים בחוזים (C-023),
     פתיחה/גבוה שלא מהיומי (C-019, ‏C-027), והחודשי רק מ־1985 (C-020). הצבירה: שבוע שני–ראשון ו־1 לחודש, בחצות בשעון הבורסה
     (כמו התוויות של Yahoo). רק באזורי הזמן שהמוסכמות שלהם נבדקו (ניו יורק, שיקגו, UTC); השאר — של Yahoo, עם תיקון השורה הכפולה. */
const IVS = {
  '1m': { win: 7, back: 29 }, '2m': { win: 20, back: 59 }, '5m': { win: 30, back: 59 }, '15m': { win: 59, back: 59 },
  '30m': { win: 59, back: 59 }, '60m': { win: 360, back: 729 }, '1d': { win: 365 * 12 }, '1wk': { win: 0 }, '1mo': { win: 0 },
};
const SYM_RE = /^\^?[A-Z0-9][A-Z0-9.\-=^]{0,15}$/;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
const DAY = 86400;
const cache = new Map();
const hits = new Map();
const PER = { '1wk': 1, '1mo': 1 };
const AGG_TZ = new Set(['America/New_York', 'America/Chicago', 'UTC']);
const FOREIGN = /\.[A-Z]{1,4}$|=X$/;   // בורסה זרה / מט"ח — אזור זמן שלא נבדק, ישר ל־Yahoo (חוסך בקשת יומי)
const noAgg = new Map();               // סמלים שהיומי שלהם הגיע באזור זמן שלא נבדק
const flight = new Map();              // בקשת יומי אחת לסמל גם כשהשבועי והחודשי מתבקשים יחד
const DTF = new Map();
const OFFM = new Map();

/* היסט שעון הבורסה (מקומי פחות UTC, בשניות) בזמן t. אזור זמן לא מוכר — UTC */
function offRaw(t, tz) {
  if (!DTF.has(tz)) {
    let f = null;
    try { f = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' }); } catch (e) { /* UTC */ }
    if (DTF.size > 200) DTF.clear();
    DTF.set(tz, f);
  }
  const f = DTF.get(tz);
  if (!f) return 0;
  const p = {};
  for (const x of f.formatToParts(new Date(t * 1000))) p[x.type] = +x.value;
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) / 1000 - t;
}
/* אותו היסט עם מטמון לחודש UTC: היסט זהה בתחילתו ובסופו = אין בו מעבר שעון (16,000 נרות — ‏Intl בכל אחד = ‎~200ms) */
function offAt(t, tz) {
  let mm = OFFM.get(tz);
  if (!mm) { if (OFFM.size > 200) OFFM.clear(); mm = new Map(); OFFM.set(tz, mm); }
  const x = new Date(t * 1000), k = x.getUTCFullYear() * 12 + x.getUTCMonth();
  let v = mm.get(k);
  if (v === undefined) {
    const a = offRaw(Date.UTC(x.getUTCFullYear(), x.getUTCMonth(), 1) / 1000, tz);
    v = a === offRaw(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 1) / 1000 - 1, tz) ? a : null;
    mm.set(k, v);
  }
  return v === null ? offRaw(t, tz) : v;
}
/* שעון הבורסה: { y, m, d } של t */
function lparts(t, tz) {
  const x = new Date((t + offAt(t, tz)) * 1000);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
}
/* חצות מקומית של y-m-d (m מ־1; גלישה מותרת — d=0, ‏m=13) בשניות UTC */
function lmid(y, m, d, tz) {
  const g = Date.UTC(y, m - 1, d) / 1000;
  return g - offAt(g - offAt(g, tz), tz);
}
const dowOf = (p) => new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
/* היום בחודש שבו מתחיל השבוע של p: שני (כמו Yahoo בכל הבורסות שנבדקו, גם ת"א), או wd אחר (0 = ראשון) */
const wstart = (p, wd) => p.d - (dowOf(p) - (wd == null ? 1 : wd) + 7) % 7;
/* תחילת התקופה של t: שבוע (שני, או wd) או 1 לחודש, בחצות בשעון הבורסה */
function pstart(t, tz, iv, wd) {
  const p = lparts(t, tz);
  return lmid(p.y, p.m, iv === '1mo' ? 1 : wstart(p, wd), tz);
}

/* יומי (הפלט של parse) → שבועי/חודשי. פתיחה = של היום הראשון, גבוה/נמוך = הקיצון, סגירה = של האחרון, נפח = הסכום.
   התווית = תחילת התקופה; השבוע של 29/12/1969 (שלילי) — חצות היום הראשון שיש בו נתונים.
   lp — התאריכים המקומיים של הנרות, כשכבר חושבו (השבועי והחודשי מאותו יומי). טהורה. */
function aggregate(d, iv, lp) {
  const out = { t: [], o: [], h: [], l: [], c: [], v: [] };
  let key = null;
  for (let i = 0; i < d.t.length; i++) {
    const p = lp ? lp[i] : lparts(d.t[i], d.tz);
    const dd = iv === '1mo' ? 1 : wstart(p);
    const k = Date.UTC(p.y, p.m - 1, dd);
    if (k !== key) {
      key = k;
      let t0 = lmid(p.y, p.m, dd, d.tz);
      if (t0 <= 0) { t0 = lmid(p.y, p.m, p.d, d.tz); if (t0 <= 0) t0 = d.t[i]; }
      out.t.push(t0); out.o.push(d.o[i]); out.h.push(d.h[i]); out.l.push(d.l[i]); out.c.push(d.c[i]); out.v.push(d.v[i]);
    } else {
      const n = out.t.length - 1;
      if (d.h[i] > out.h[n]) out.h[n] = d.h[i];
      if (d.l[i] < out.l[n]) out.l[n] = d.l[i];
      out.c[n] = d.c[i]; out.v[n] += d.v[i];
    }
  }
  return Object.assign(out, { tz: d.tz, cur: d.cur, ex: d.ex, name: d.name, iv });
}

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
  } else if (sec && n > 1 && (out.t[n - 1] - out.t[n - 2]) % sec) {
    /* 28/10/2026 (מול TradingView): בדקות הראשונות של נר חדש Yahoo עוד לא מחזיר אותו — רק את הנקודה החיה (10:15:37).
       היא הפכה לנר בזמן לא מיושר, ובטלפון נוצרו כמה נרונים כאלה שהקפיאו את הנר האחרון. מיישרים לתחילת הנר (מעוגן לנר הקודם) */
    out.t[n - 1] = out.t[n - 2] + Math.floor((out.t[n - 1] - out.t[n - 2]) / sec) * sec;
  }
  out.tz = String(meta.exchangeTimezoneName || 'America/New_York');
  out.cur = String(meta.currency || '').toUpperCase() === 'ILA' ? 'ILS' : String(meta.currency || '');
  out.ex = String(meta.exchangeName || '');
  out.name = String(meta.longName || meta.shortName || '');
  out.iv = iv;
  /* C-003 (17/11/2026): בשבועי/חודשי Yahoo מוסיף שורה חיה בזמן העסקה האחרונה, רק עם היום הנוכחי — והשורה הרגילה
     של אותה תקופה עד אתמול (AAPL נובמבר: 522,761,100 + 11,588,219 = סכום היומי; כך גם TEVA.TA). באותה תקופה — מתמזגת;
     תקופה חדשה (היום הראשון שלה) — מתויגת בתחילת התקופה. כאן רק מה שלא נצבר מהיומי (בורסות זרות, מט"ח).
     השבוע של Yahoo מתחיל ביום של השורות הקודמות (שני; חמישי בסמלים מלפני 1970 — C-013, למשל ‎^N225) */
  const m = out.t.length - 1;
  if (PER[iv] && m >= 0) {
    let wd = 1;
    if (iv === '1wk' && m >= 2) { const a = dowOf(lparts(out.t[m - 1], out.tz)); if (a === dowOf(lparts(out.t[m - 2], out.tz))) wd = a; }
    const ps = (t) => pstart(t, out.tz, iv, wd);
    if (m > 0 && ps(out.t[m]) === ps(out.t[m - 1])) {
      out.h[m - 1] = Math.max(out.h[m - 1], out.h[m]); out.l[m - 1] = Math.min(out.l[m - 1], out.l[m]);
      out.c[m - 1] = out.c[m]; out.v[m - 1] += out.v[m];
      for (const k of ['t', 'o', 'h', 'l', 'c', 'v']) out[k].pop();
    } else out.t[m] = ps(out.t[m]);
  }
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
  const pre = !!(body && body.pre) && /m$/.test(iv);   // טרום/אחרי — רק בתוך־יומי (מפתח מטמון אחד ליומי ומעלה)
  if (!SYM_RE.test(sym) || !IVS[iv] || to < 0 || !isFinite(to)) return res.status(400).json({ ok: false, error: 'bad_params' });
  const now = Math.floor((nowMs || Date.now()) / 1000);
  const w = window_(iv, to, now);
  if (!w) return res.status(200).json({ ok: true, iv, t: [], o: [], h: [], l: [], c: [], v: [], more: false });
  // מטמון: הנרות האחרונים מתעדכנים (15 שנ׳ תוך־יומי, דקה יומי ומעלה); היסטוריה ישנה (to) — 10 דקות
  const key = sym + '|' + iv + '|' + (to ? Math.floor(to / 60) : 0) + '|' + (pre ? 1 : 0);
  const ttl = to ? 600000 : /m$/.test(iv) ? 15000 : 60000;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return res.status(200).json(hit.v);
  if (PER[iv] && !to && !FOREIGN.test(sym) && !noAgg.has(sym)) {
    /* שבועי/חודשי מהיומי (כל ההיסטוריה מ־1970 — בקשה אחת לשניהם, ושניהם נשמרים במטמון) */
    let p = flight.get(sym);
    if (!p) { p = fetchYahoo(sym, '1d', { p1: 0, p2: now }, false).finally(() => flight.delete(sym)); flight.set(sym, p); }
    const d = await p;
    if (d && d.err) return res.status(200).json({ ok: false, error: d.err });
    if (d && d.t.length && AGG_TZ.has(d.tz)) {
      let mine = null;
      if (cache.size > 600) cache.clear();
      const lp = d.t.map((t) => lparts(t, d.tz));
      for (const q of ['1wk', '1mo']) {
        const a = Object.assign({ ok: true }, aggregate(d, q, lp), { more: false });
        cache.set(sym + '|' + q + '|0|0', { at: Date.now(), v: a });
        if (q === iv) mine = a;
      }
      return res.status(200).json(mine);
    }
    if (d && d.t.length) { if (noAgg.size > 2000) noAgg.clear(); noAgg.set(sym, 1); }
  }
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

module.exports = { handle, _parse: parse, _window: window_, _cache: cache, _aggregate: aggregate, _pstart: pstart, _noAgg: noAgg, IVS };
