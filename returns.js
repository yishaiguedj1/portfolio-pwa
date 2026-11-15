/* =====================================================================
   returns.js — v112 (v128: הנתונים מגיעים רק מסנכרון Flex)
   מנוע תשואות על נתוני IBKR. נבנה מאפס, בלי שום קוד מהמנוע הקודם.
   מודול טהור: אין DOM, אין localStorage, אין רשת — נבדק ב־node.

   עקרונות:
   1. לא משחזרים — קוראים. ה־TWR הרשמי של IBKR נקרא מהדוח ומשורשר
      (chain-link). חישוב עצמאי של TWR מתוך סכומים מצטברים שגוי מתמטית
      כשתזרימים מתרחשים באמצע התקופה — לכן אסור.
   2. כל מספר חייב להיסגר מול הזהות החשבונאית של IBKR:
      Ending = Starting + MTM + Flows + Dividends − Withholding ± Accruals − Fees
   3. כשנתון חסר — לא מנחשים. מחזירים null וה־UI מציג מקף + הסבר.
   ===================================================================== */
'use strict';

/* ---------------- עזרים ---------------- */

function rValidDate(d) { return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''; }

/* isFinite מחמיר: isFinite(null) === true ב־JS — לא מתאים לנו. */
function fin(v) {
  if (v === null || v === undefined || v === '') return false;
  return isFinite(Number(v));
}

/* ---------------- מיזוג דוחות (טווח זמן חופשי) ----------------
   כמה דוחות (למשל שנתיים עוקבות) מתמזגים לאחד:
   עסקאות/תנועות מתאחדות עם מניעת כפילויות, פוזיציות ומזומן מהחדש ביותר,
   תקופות NAV נצברות וממוינות — ה־TWR המשורשר מכסה את כל הטווח. */

function tradeKey(t) {
  // מזהה יציב קודם לשדות — לא למחוק שתי עסקאות זהות לגיטימיות
  const id = String((t && (t.tradeId || t.id)) || '').trim();
  if (id) return 'id:' + id;
  return [t.date, t.symbol, t.qty, t.side, Math.round((Number(t.price) || 0) * 10000)].join('|');
}
function cashKey(c) {
  return [c.date, c.type, Math.round((Number(c.amount) || 0) * 100), (c.description || '').slice(0, 30)].join('|');
}

/* פעולה תאגידית / העברת ניירות (מרכז המס): מזהה, אחרת התוכן */
function taxEvKey(e) {
  const id = String((e && e.id) || '').trim();
  return (e && e.k) + '|' + (id ? 'id:' + id : [e.date, e.type, e.symbol, e.qty].join('|'));
}

/* האם שתי תקופות חופפות (כולל מגע בקצוות)? */
function rPeriodsOverlap(a, b) {
  if (!a || !b || !a.fromDate || !a.toDate || !b.fromDate || !b.toDate) return false;
  // חפיפה אמיתית — לא מגע בנקודת גבול בודדת.
  // תקופות עוקבות (האחת מסתיימת בדיוק כשהשנייה מתחילה) אינן "חופפות" —
  // הן נשמרות ומשורשרות ב־TWR, לא מוחלפות.
  return a.fromDate < b.toDate && b.fromDate < a.toDate;
}

/* מיזוג תקופות: תקופה חדשה מחליפה כל תקופה קיימת שהיא חופפת (עדכון —
   לא כפילות ולא ספירה כפולה של TWR). תקופות נפרדות נשמרות וממוינות. */
function rPeriodsEqual(a, b) {
  // תקופה זהה לחלוטין — אותו טווח ואותם ערכים רשמיים
  return a && b && a.fromDate === b.fromDate && a.toDate === b.toDate &&
    (a.startingValue ?? null) === (b.startingValue ?? null) &&
    (a.endingValue ?? null) === (b.endingValue ?? null) &&
    (a.netFlows ?? 0) === (b.netFlows ?? 0) &&
    (a.twr ?? null) === (b.twr ?? null);
}
function rMergePeriods(existing, incoming) {
  let out = (existing || []).slice();
  const replaced = [];
  for (const np of (incoming || [])) {
    // תקופה זהה לחלוטין שכבר קיימת — לא "מוחלפת", פשוט כפילות
    if (out.some((p) => rPeriodsEqual(p, np))) continue;
    // v127: תקופה קצרה שכולה בתוך תקופה קיימת רחבה יותר (למשל 31/12 בודד
    // מול שנה שלמה) — הקיימת כבר מכסה את הימים האלה. בלי זה היא הייתה
    // "מחליפה" את השנה כולה ומוחקת אותה. טווח זהה עם ערכים שונים — עדיין מחליף.
    if (np.fromDate && np.toDate && out.some((p) => p.fromDate <= np.fromDate && np.toDate <= p.toDate &&
      !(p.fromDate === np.fromDate && p.toDate === np.toDate))) continue;
    for (const p of out) if (rPeriodsOverlap(p, np)) replaced.push(p);
    out = out.filter((p) => !rPeriodsOverlap(p, np));
    out.push(np);
  }
  out.sort((a, b) => (a.fromDate < b.fromDate ? -1 : a.fromDate > b.fromDate ? 1 : 0));
  return { periods: out, replaced: replaced };
}

/* תצוגה מקדימה של מיזוג: מה יתווסף, מה יוחלף, מה כבר קיים וידולג.
   לא משנה דבר — רק מדווח. */
/* ספירת מופעים לפי מפתח — בסיס לאיחוד מודע־מופעים. */
function countKeys(arr, keyFn) {
  const m = new Map();
  for (const x of (arr || [])) {
    const k = keyFn(x);
    m.set(k, (m.get(k) || 0) + 1);
  }
  return m;
}

/* איחוד מודע־מופעים: לכל מפתח נשמר מספר המופעים המקסימלי מבין שני המקורות.
   לא מוחק כפילויות לגיטימיות (למשל שתי הפקדות זהות באותו יום),
   ולא מכפיל רשומה שכבר קיימת (ייבוא חוזר של אותו דוח). */
function unionCount(a, b, keyFn) {
  const ca = countKeys(a, keyFn), cb = countKeys(b, keyFn);
  const out = (a || []).slice();
  const have = countKeys(out, keyFn);
  for (const x of (b || [])) {
    const k = keyFn(x);
    const want = Math.max(ca.get(k) || 0, cb.get(k) || 0);
    const h = have.get(k) || 0;
    if (h < want) { have.set(k, h + 1); out.push(x); }
  }
  return out;
}

/* כמה מופעים חדשים יש ב־incoming לעומת existing (מודע־מופעים).
   מחזיר { added, dup }. */
function countNew(existing, incoming, keyFn) {
  const ce = countKeys(existing, keyFn), ci = countKeys(incoming, keyFn);
  let added = 0, dup = 0;
  for (const [k, cnt] of ci) {
    const a = Math.max(0, cnt - (ce.get(k) || 0));
    added += a; dup += cnt - a;
  }
  return { added: added, dup: dup };
}

function rMergePreview(oldData, newData) {
  const o = oldData || {}, n = newData || {};
  const mp = rMergePeriods(o.navPeriods, n.navPeriods);
  const addedPeriods = mp.periods.filter(
    (p) => !(o.navPeriods || []).some((q) => q.fromDate === p.fromDate && q.toDate === p.toDate));
  // עסקאות/תזרימים: מה כבר קיים לפי מפתח הזהות (מודע־מופעים)
  const tr = countNew(o.trades, n.trades, tradeKey);
  const cx = countNew(o.cashTransactions, n.cashTransactions, cashKey);
  return {
    addedPeriods: addedPeriods,
    replacedPeriods: mp.replaced,
    newTrades: tr.added,
    newCash: cx.added,
    dupTrades: tr.dup,
    dupCash: cx.dup,
  };
}

function rMergeData(a, b) {
  const A = a || {}, B = b || {};
  const trades = unionCount(A.trades, B.trades, tradeKey);
  // 25/10/2026: עסקה שנשמרה לפני ששמרנו את השעה מקבלת אותה ממשיכה חדשה של אותה עסקה (לפי מזהה)
  const tB = new Map();
  for (const x of (B.trades || [])) if (x && x.time && x.tradeId) tB.set(String(x.tradeId), x.time);
  for (let i = 0; i < trades.length; i++) {
    const x = trades[i];
    if (x && !x.time && x.tradeId && tB.has(String(x.tradeId))) trades[i] = Object.assign({}, x, { time: tB.get(String(x.tradeId)) });
  }
  const cashTransactions = unionCount(A.cashTransactions, B.cashTransactions, cashKey);
  const taxEvents = unionCount(A.taxEvents, B.taxEvents, taxEvKey);   // מרכז המס (02/11/2026)
  const seenP = rMergePeriods(A.navPeriods, B.navPeriods);
  const navPeriods = seenP.periods;
  const mA = A.meta || {}, mB = B.meta || {};
  const fds = [mA.fromDate, mB.fromDate].filter(Boolean).sort();
  const tds = [mA.toDate, mB.toDate].filter(Boolean).sort();
  // פוזיציות/מזומן: מהדוח עם תאריך הסיום המאוחר ביותר (לא לפי סדר הבחירה).
  // תאריך חדש יותר גובר תמיד — גם אם הפוזיציות בו ריקות (תיק ריק הוא מידע אמיתי,
  // לא סיבה לדבוק בנתונים ישנים). בתיקו — הייבוא האחרון גובר.
  const tdA = String(mA.toDate || ''), tdB = String(mB.toDate || '');
  const posSrc = tdB > tdA ? B : tdA > tdB ? A : B;
  const cashSrc = tdB > tdA ? B : tdA > tdB ? A : B;
  return {
    meta: {
      fromDate: fds[0] || '', toDate: tds[tds.length - 1] || '',
      baseCurrency: mB.baseCurrency || mA.baseCurrency || 'USD',
      title: 'Merged IBKR reports',
    },
    trades: trades,
    positions: posSrc.positions || [],
    cashTransactions: cashTransactions,
    taxEvents: taxEvents,
    navPeriods: navPeriods,
    navDaily: rMergeNavDaily(A.navDaily, B.navDaily),
    cashBalances: cashSrc.cashBalances || [],
  };
}

/* ---------------- כמה חשבונות IBKR (15/11/2026, בקשת המשתמש) ----------------
   תיק אחד משולב מהדוחות של כמה חשבונות נפרדים (לא חלקי זמן של אותו חשבון — זה rMergeData).
   • עסקאות, תנועות מזומן ואירועי מס — איחוד (כל חשבון כבר בלי כפילויות, והמזהים שונים).
   • פוזיציות ומזומן — של כל החשבונות (ibkrMapImport מאחד מניה שמוחזקת בכמה חשבונות).
   • NAV יומי — סכום. לפני היום הראשון של חשבון הוא 0; אחרי היום האחרון שלו — הימים לא נכנסים
     (הסדרה נגמרת ביום האחרון שמשותף לכולם, כדי שלא ייראה כאילו חשבון נעלם).
   • TWR — לא ממצעים TWR רשמי של חשבונות שונים. לכל חשבון סדרה יומית מעוגנת ל־TWR הרשמי שלו
     (rDailyTwrSeries), והתשואה היומית של התיק = ממוצע התשואות היומיות משוקלל לפי ה־NAV של היום הקודם
     (זה בדיוק ה־TWR היומי של התיק כולו; חשבון חדש נכנס במשקל 0 ביום הראשון שלו — לא נספר כתשואה).
     משורשר לתקופות לפי שנה קלנדרית (navPeriods) + הסדרה עצמה (twrDaily).
   • חשבון בלי NAV יומי, או מטבעות בסיס שונים — אין TWR משולב (לא מנחשים): meta.noDailyTwr / meta.mixedBase.
   flowsOf(data) → {date: תזרים במטבע הבסיס} (ibkrFlowsByDate באפליקציה). רשימה של דוח אחד — מוחזר כמו שהוא.
   info[i] = {id, name, ci} של החשבון ה־i: כל עסקה/תנועה/פוזיציה/מזומן/אירוע מס מקבל acct = id (צבע החשבון בתגית המקור,
   ומרכז המס מחשב לכל חשבון), ו־meta.accts = info — כך גם מכשיר אחר (שמקבל את התיק מהענן) יודע את השמות והצבעים. */
function rMergeAccounts(list, flowsOf, info) {
  const pairs = (list || []).map((d, i) => [d, (info || [])[i]]).filter((p) => p[0] && typeof p[0] === 'object');
  const L = pairs.map((p) => p[0]);
  if (L.length <= 1) return L[0] || null;
  const byDate = (a, b) => String((a && a.date) || '').localeCompare(String((b && b.date) || ''));
  const tag = (x, a) => (a && a.id && x && typeof x === 'object' ? Object.assign({}, x, { acct: a.id }) : x);
  const cat = (k) => [].concat(...pairs.map(([d, a]) => (Array.isArray(d[k]) ? d[k].map((x) => tag(x, a)) : [])));
  const metas = L.map((d) => d.meta || {});
  const fds = metas.map((m) => m.fromDate).filter(Boolean).sort();
  const tds = metas.map((m) => m.toDate).filter(Boolean).sort();
  const bases = [...new Set(metas.map((m) => String(m.baseCurrency || 'USD').toUpperCase()))];
  const fields = {};
  for (const m of metas) {
    if (!m.fields || typeof m.fields !== 'object') continue;
    for (const k of Object.keys(m.fields)) if (Array.isArray(m.fields[k])) fields[k] = [...new Set((fields[k] || []).concat(m.fields[k]))].sort();
  }
  const out = {
    meta: { fromDate: fds[0] || '', toDate: tds[0] || '', baseCurrency: bases[0] || 'USD', title: 'Merged IBKR accounts', accounts: L.length },
    trades: cat('trades').sort(byDate),
    positions: cat('positions'),
    cashTransactions: cat('cashTransactions').sort(byDate),
    taxEvents: cat('taxEvents'),
    cashBalances: cat('cashBalances'),
    navPeriods: [],
    navDaily: [],
    twrDaily: [],
  };
  if (Object.keys(fields).length) out.meta.fields = fields;
  if (pairs.every((p) => p[1] && p[1].id)) {
    out.meta.accts = pairs.map(([d, a]) => ({ id: a.id, name: String(a.name || ''), ci: +a.ci || 0,
      from: String((d.meta || {}).fromDate || ''), to: String((d.meta || {}).toDate || '') }));   // התקופה של כל חשבון — לעמוד IBKR
  }
  if (bases.length > 1) { out.meta.mixedBase = true; return out; }
  const acc = [];
  for (const d of L) {
    const nav = (d.navDaily || []).filter((x) => x && rValidDate(x.date || '') && fin(x.total))
      .map((x) => ({ date: x.date, total: Number(x.total) })).sort(byDate);
    if (nav.length < 2) { out.meta.noDailyTwr = true; return out; }
    const fl = (typeof flowsOf === 'function' && flowsOf(d)) || {};
    const ix = rDailyTwrSeries(nav, fl, rNavPeriods(d));
    acc.push({ nav, fl, ix, first: nav[0].date, last: nav[nav.length - 1].date, ni: -1, xi: -1, navNow: 0, ixNow: null });
  }
  const end = acc.map((a) => a.last).sort()[0];
  const dates = [...new Set([].concat(...acc.map((a) => a.nav.map((x) => x.date))))].filter((t) => t <= end).sort();
  if (dates.length < 2) { out.meta.noDailyTwr = true; return out; }
  const r2 = (v) => Math.round(v * 100) / 100;
  const days = [], totals = [];   // days: {date, base, prevTotal, total, g, gain}
  let prevTotal = 0;
  for (let k = 0; k < dates.length; k++) {
    const t = dates[k];
    let total = 0, wSum = 0, wg = 0, gain = 0;
    for (const a of acc) {
      const navPrev = a.navNow, ixPrev = a.ixNow;
      while (a.ni + 1 < a.nav.length && a.nav[a.ni + 1].date <= t) a.ni++;
      while (a.xi + 1 < a.ix.length && a.ix[a.xi + 1].date <= t) a.xi++;
      a.navNow = a.ni >= 0 ? a.nav[a.ni].total : 0;
      a.ixNow = a.xi >= 0 ? a.ix[a.xi].value : null;
      total += a.navNow;
      if (k === 0 || !(navPrev > 0)) continue;   // חשבון שעוד לא התחיל — משקל 0 (גם ביום הראשון שלו)
      const g = (ixPrev > 0 && a.ixNow > 0) ? a.ixNow / ixPrev : 1;
      wSum += navPrev; wg += navPrev * g;
      gain += a.navNow - navPrev - (Number(a.fl[t]) || 0);
    }
    if (k > 0) days.push({ date: t, base: dates[k - 1], prevTotal, total, g: wSum > 0 ? wg / wSum : 1, gain });
    totals.push(total);
    prevTotal = total;
  }
  out.navDaily = dates.map((t, k) => ({ date: t, total: r2(totals[k]) }));
  let v = 100;
  out.twrDaily = [{ date: dates[0], value: 100 }];
  for (const d of days) { v *= d.g; out.twrDaily.push({ date: d.date, value: Math.round(v * 1e6) / 1e6 }); }
  // תקופות לפי שנה קלנדרית — TWR = מכפלת הימים, רווח = סכום הרווח היומי של כל חשבון
  let cur = null;
  const flush = () => {
    if (!cur) return;
    const gainSum = cur.gain;
    out.navPeriods.push({
      fromDate: cur.fromDate, toDate: cur.toDate,
      startingValue: r2(cur.start), endingValue: r2(cur.endV),
      netFlows: r2(cur.endV - cur.start - gainSum),
      twr: Math.round((cur.g - 1) * 100 * 1e6) / 1e6,
    });
  };
  for (const d of days) {
    const y = d.date.slice(0, 4);
    if (!cur || cur.y !== y) { flush(); cur = { y, fromDate: d.date, start: d.prevTotal, g: 1, gain: 0 }; }
    cur.toDate = d.date; cur.endV = d.total; cur.g *= d.g; cur.gain += d.gain;
  }
  flush();
  return out;
}

/* מספר ימים בין שני תאריכי ISO (b − a), ערך מוחלט. */
function rDaysBetween(a, b) {
  const pa = String(a).split('-'), pb = String(b).split('-');
  const da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
  return Math.abs(Math.round((db - da) / 86400000));
}

/* סדרת TWR משולבת: יומית (מ־NAV יומי) כשיש, ולפניה — נקודות התקופות
   הרשמיות, מחוברות בנקודת תפר רשמית. בלי NAV יומי — נקודות התקופות בלבד. */
function rCombinedTwrSeries(periods, navDaily, flowsByDate) {
  const pr = rTwrIndexSeries(periods);
  const daily = rDailyTwrSeries(navDaily, flowsByDate, periods);
  if (daily.length < 2) return pr;
  const d0 = daily[0].date;
  // נקודת תפר: שורת תקופה בתאריך ההתחלה היומי או עד 4 ימים לפניו (סופ"ש/חג)
  let seam = null;
  for (const r of pr) if (r.date <= d0 && rDaysBetween(r.date, d0) <= 4) seam = r;
  if (!seam) return daily;
  const k = seam.value / 100;
  return pr.filter((r) => r.date < seam.date)
    .concat(daily.map((r) => ({ date: r.date, value: r.value * k })));
}

/* איחוד NAV יומי לפי תאריך — החדש (b) גובר ביום חופף. ממוין ישן -> חדש. */
function rMergeNavDaily(a, b) {
  const m = new Map();
  for (const src of [a || [], b || []]) {
    for (const d of src) {
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && fin(d.total)) m.set(d.date, Number(d.total));
    }
  }
  return [...m.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1)).map(([date, total]) => ({ date: date, total: total }));
}

/* ---------------- TWR יומי מ־NAV יומי ----------------
   r_t = (NAV_t − F_t) / NAV_{t−1} − 1, כש־F_t = תזרים חיצוני באותו יום
   (הפקדה חיובית, משיכה שלילית, במטבע הבסיס). כך הפקדה לא נספרת כתשואה.
   עיגון: בכל תקופה רשמית של IBKR (TWR רשמי) מכפלת הימים מתוקנת גאומטרית
   כך שתהיה שווה בדיוק ל־TWR הרשמי — נקודות העוגן רשמיות, הצורה בין לבין
   מה־NAV היומי. מחזיר [{date, value}] (מדד שמתחיל ב־100), או [] אם אין די
   נתונים. */
function rDailyTwrSeries(navDaily, flowsByDate, periods) {
  const rows = (navDaily || []).filter((d) => d && d.date && fin(d.total))
    .slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const flows = flowsByDate || {};
  // תשואות יומיות (מתחילים מהיום הראשון עם בסיס חיובי)
  const days = [];
  for (let i = 1; i < rows.length; i++) {
    const prev = Number(rows[i - 1].total), cur = Number(rows[i].total);
    if (!(prev > 0)) continue;
    const f = Number(flows[rows[i].date]) || 0;
    const g = (cur - f) / prev;
    if (!(g > 0) || !isFinite(g)) continue;
    days.push({ date: rows[i].date, g: g, base: rows[i - 1].date });
  }
  if (!days.length) return [];
  // עיגון לתקופות רשמיות
  for (const p of (periods || [])) {
    if (!p || !fin(p.twr) || !p.fromDate || !p.toDate) continue;
    const inP = days.filter((d) => d.date >= p.fromDate && d.date <= p.toDate);
    if (!inP.length) continue;
    // מעגנים רק כשה־NAV היומי מכסה את כל התקופה (עד שבוע מכל קצה) —
    // עיגון TWR של שנה שלמה על כיסוי חלקי היה מעוות את הצורה
    if (rDaysBetween(p.fromDate, inP[0].base) > 7 || rDaysBetween(inP[inP.length - 1].date, p.toDate) > 7) continue;
    let raw = 1;
    for (const d of inP) raw *= d.g;
    const target = 1 + Number(p.twr) / 100;
    if (!(raw > 0) || !(target > 0)) continue;
    const adj = Math.pow(target / raw, 1 / inP.length);
    for (const d of inP) d.g *= adj;
  }
  const out = [{ date: days[0].base, value: 100 }];
  let v = 100;
  for (const d of days) {
    v *= d.g;
    out.push({ date: d.date, value: v });
  }
  return out;
}

/* ---------------- תקופות NAV ממקור טוקן ----------------
   מאחד את שני המקורות למבנה אחד: [{fromDate,toDate,twr,...}].
   נתוני טוקן (פרוקסי): data.navHistory = [{fromDate,toDate,twr,...}]. */

function rNavPeriods(data) {
  const d = data || {};
  if ((d.navPeriods || []).length) {
    return d.navPeriods
      .filter((p) => p && (fin(p.twr) || fin(p.startingValue)))
      .map((p) => ({
        fromDate: String(p.fromDate || '').slice(0, 10),
        toDate: String(p.toDate || '').slice(0, 10),
        startingValue: fin(p.startingValue) ? Number(p.startingValue) : null,
        endingValue: fin(p.endingValue) ? Number(p.endingValue) : null,
        netFlows: Number(p.netFlows) || 0,
        twr: fin(p.twr) ? Number(p.twr) : null,
        source: 'ibkr',
      }))
      .sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
  }
  const nh = d.navHistory || [];
  const out = [];
  for (const r of nh) {
    const twr = (r.twr === null || r.twr === undefined || r.twr === '') ? null : Number(r.twr);
    out.push({
      fromDate: String(r.fromDate || '').slice(0, 10),
      toDate: String(r.toDate || '').slice(0, 10),
      startingValue: fin(r.startingValue) ? Number(r.startingValue) : null,
      endingValue: fin(r.endingValue) ? Number(r.endingValue) : null,
      netFlows: 0,
      twr: (twr !== null && isFinite(twr)) ? twr : null,
      source: 'ibkr',
    });
  }
  // גם nav בודד (תקופת הדוח כולה) — אם אין פירוט
  if (!out.length && d.nav) {
    const n = d.nav;
    const twr = (n.twr === null || n.twr === undefined || n.twr === '') ? null : Number(n.twr);
    out.push({
      fromDate: String((d.meta || {}).fromDate || '').slice(0, 10),
      toDate: String((d.meta || {}).toDate || '').slice(0, 10),
      startingValue: fin(n.startingValue) ? Number(n.startingValue) : null,
      endingValue: fin(n.endingValue) ? Number(n.endingValue) : null,
      netFlows: 0,
      twr: (twr !== null && isFinite(twr)) ? twr : null,
      source: 'ibkr',
    });
  }
  return out.sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
}

/* ---------------- המנוע: שרשור TWR רשמי ----------------
   TWR מצטבר = Π(1 + twr_i/100) − 1. twr_i באחוזים, כמו ש־IBKR מדווח.
   זו הדרך היחידה הנכונה — חישוב עצמאי מסכומים מצטברים שגוי כשתזרימים
   מתרחשים באמצע התקופה (אומת: 97.6% מחושב מול 18.80% רשמי). */

function rChainTwr(periods) {
  const ps = (periods || []).filter((p) => p && fin(p.twr));
  if (!ps.length) return null;
  let g = 1;
  for (const p of ps) {
    const r = Number(p.twr) / 100;
    if (!(r > -1) || !isFinite(r)) return null;
    g *= 1 + r;
  }
  if (!isFinite(g) || g <= 0) return null;
  return (g - 1) * 100;
}

/* סדרת מדד TWR לגרף: מתחילה ב־100 בתחילת התקופה הראשונה,
   כל נקודה = סוף תקופה עם הערך המשורשר עד אליה. */
function rTwrIndexSeries(periods) {
  const ps = (periods || []).filter((p) => p && fin(p.twr) && p.fromDate && p.toDate);
  if (!ps.length) return [];
  const out = [{ date: ps[0].fromDate, value: 100 }];
  let cum = 100;
  for (const p of ps) {
    cum *= 1 + Number(p.twr) / 100;
    if (!isFinite(cum) || cum <= 0) return [];
    out.push({ date: p.toDate, value: cum });
  }
  return out;
}

/* ---------------- רווח/הפסד כלכלי ----------------
   הזהות של IBKR (אומתה מול דוח אמיתי):
   Ending = Starting + MTM + Flows + Dividends − Withholding ± Accruals − Fees
   רווח = Σ(Ending − Starting − NetFlows) על פני התקופות. */

function rGain(data) {
  const ps = rNavPeriods(data).filter((p) =>
    fin(p.startingValue) && fin(p.endingValue));
  if (!ps.length) return null;
  let g = 0;
  for (const p of ps) g += p.endingValue - p.startingValue - (Number(p.netFlows) || 0);
  return isFinite(g) ? g : null;
}

/* ---------------- סכומי רכיבים (אגרגציה פשוטה — לא "חישוב") ---------------- */

function rSums(data) {
  const out = { realized: 0, unrealized: 0, dividends: 0, withholding: 0, commissions: 0, fees: 0 };
  const d = data || {};
  for (const t of (d.trades || [])) {
    const fx = Number(t.fxToBase) || 1;
    const rl = Number(t.realized);
    if (isFinite(rl)) out.realized += rl * fx;
    const cm = Number(t.commission);
    if (isFinite(cm)) out.commissions += Math.abs(cm) * fx;
  }
  for (const p of (d.positions || [])) {
    const fx = Number(p.fxToBase) || 1;
    const un = Number(p.unrealized);
    if (isFinite(un)) out.unrealized += un * fx;
  }
  for (const c of (d.cashTransactions || [])) {
    const fx = Number(c.fxToBase) || 1;
    const amt = Number(c.amount);
    if (!isFinite(amt)) continue;
    const type = String(c.type || '');
    if (/dividend/i.test(type) && !/withholding/i.test(type)) out.dividends += amt * fx;
    else if (/withholding/i.test(type)) out.withholding += amt * fx; // שלילי בדוח
    else if (/fee/i.test(type) && !/receiv/i.test(type)) out.fees += amt * fx;
  }
  return out;
}

/* ---------------- XIRR (מתמטיקה סטנדרטית) ----------------
   מוסכמת סימנים: כסף שיוצא מכיס המשקיע = שלילי, שנכנס = חיובי.
   התחלה והפקדות שליליים, משיכות וסיום חיוביים. */

function rXirrFlows(data) {
  const ps = rNavPeriods(data).filter((p) =>
    fin(p.startingValue) && fin(p.endingValue) && p.fromDate && p.toDate);
  if (!ps.length) return null;
  const start = ps[0], end = ps[ps.length - 1];
  const flows = [];
  if (start.startingValue > 0 && start.fromDate) flows.push({ d: start.fromDate, amt: -start.startingValue });
  for (const c of ((data && data.cashTransactions) || [])) {
    const type = String(c.type || ''), desc = String(c.description || '');
    const isFlow = /deposit|withdraw/i.test(type) || /^transfer (in|out)$/i.test(type.trim()) ||
      (/transfer/i.test(desc) && /deposit|withdraw|transfer/i.test(type));
    if (!isFlow) continue;
    const amt = Number(c.amount);
    const dt = String(c.date || '').slice(0, 10);
    if (!amt || !rValidDate(dt)) continue;
    const fx = Number(c.fxToBase) || 1;
    flows.push({ d: dt, amt: -(amt * fx) }); // הפקדה (חיובי בדוח) = כסף שיצא מהכיס
  }
  if (end.endingValue > 0 && end.toDate) flows.push({ d: end.toDate, amt: end.endingValue });
  flows.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const hasNeg = flows.some((f) => f.amt < 0), hasPos = flows.some((f) => f.amt > 0);
  return (hasNeg && hasPos) ? flows : null;
}

function rXirr(flows) {
  if (!flows || flows.length < 2) return null;
  const t0 = Date.parse(flows[0].d);
  if (!isFinite(t0)) return null;
  const yrs = flows.map((f) => {
    const tt = Date.parse(f.d);
    return isFinite(tt) ? (tt - t0) / 31557600000 : NaN;
  });
  if (yrs.some((y) => !isFinite(y) || y < 0)) return null;
  const npv = (r) => flows.reduce((s, f, i) => s + f.amt / Math.pow(1 + r, yrs[i]), 0);
  const dnpv = (r) => flows.reduce((s, f, i) => s + f.amt * -yrs[i] / Math.pow(1 + r, yrs[i] + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(r), dv = dnpv(r);
    if (!isFinite(f) || !isFinite(dv) || Math.abs(dv) < 1e-12) return null;
    const nr = r - f / dv;
    if (!isFinite(nr) || nr <= -0.9999) return null;
    if (Math.abs(nr - r) < 1e-9) return nr * 100;
    r = nr;
  }
  return null;
}

/* ---------------- בחירת מקור ----------------
   'official' — יש TWR רשמי של IBKR (ודאות מלאה).
   'nav' — יש ערכי NAV אבל בלי TWR (לא מחשבים TWR מסכומים — מחזירים null).
   'none' — אין נתוני ביצועים. */

function rSourceKind(data) {
  const ps = rNavPeriods(data);
  if (ps.some((p) => fin(p.twr))) return 'official';
  if (ps.some((p) => fin(p.startingValue) && fin(p.endingValue))) return 'nav';
  return 'none';
}

/* תשואת הכותרת: TWR רשמי משורשר על כל התקופות, או null (בלי ניחושים). */
function rHeadlineTwr(data) {
  if (rSourceKind(data) !== 'official') return null;
  return rChainTwr(rNavPeriods(data));
}

/* ייצוא ל־node (טסטים) */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    rMergeData, rMergePeriods, rMergePreview,
    rPeriodsOverlap, rPeriodsEqual, countKeys, unionCount, countNew,
    rNavPeriods, rChainTwr, rTwrIndexSeries, rGain, rSums, rXirrFlows, rXirr,
    rSourceKind, rHeadlineTwr,
    rMergeNavDaily, rDailyTwrSeries, rCombinedTwrSeries, rDaysBetween,
    rMergeAccounts,
  };
}
