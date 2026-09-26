/* לוח המסחר של NYSE ושל הבורסה בת״א — עותק זהה של הפונקציות מ־app.js (הבדיקה tests/widget.test.js
   משווה את הטקסט אחד לאחד — שינוי ב־app.js מחייב עדכון כאן). בלי רשת: חגי NYSE לפי כללים, חגי ת״א לפי
   הלוח העברי של Intl. משמש את /api/widget לתווית "השוק סגור · סיבה". */
'use strict';
const _nyseHolCache = {};
function easterSunday(y) { // אלגוריתם גרגוריאני אנונימי
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: mo, d: da };
}

function nyseHolidays(y) {
  const out = {};
  const key = (m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const dow = (m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const nthDow = (m, wd, n) => { const first = dow(m, 1); let d = 1 + ((wd - first + 7) % 7) + (n - 1) * 7; return d; };
  const lastDow = (m, wd) => { const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); const last = dow(m, dim); return dim - ((last - wd + 7) % 7); };
  const observed = (m, d, name, noFriday) => { // שבת → שישי, ראשון → שני
    const w = dow(m, d);
    if (w === 6) { if (noFriday) return; const dt = new Date(Date.UTC(y, m - 1, d - 1)); out[key(dt.getUTCMonth() + 1, dt.getUTCDate())] = name; }
    else if (w === 0) { const dt = new Date(Date.UTC(y, m - 1, d + 1)); out[key(dt.getUTCMonth() + 1, dt.getUTCDate())] = name; }
    else out[key(m, d)] = name;
  };
  observed(1, 1, 'hdNewYear', true);
  out[key(1, nthDow(1, 1, 3))] = 'hdMlk';
  out[key(2, nthDow(2, 1, 3))] = 'hdPresidents';
  const e = easterSunday(y); const gf = new Date(Date.UTC(y, e.m - 1, e.d - 2)); out[key(gf.getUTCMonth() + 1, gf.getUTCDate())] = 'hdGoodFriday';
  out[key(5, lastDow(5, 1))] = 'hdMemorial';
  observed(6, 19, 'hdJuneteenth');
  observed(7, 4, 'hdIndependence');
  out[key(9, nthDow(9, 1, 1))] = 'hdLabor';
  out[key(11, nthDow(11, 4, 4))] = 'hdThanksgiving';
  observed(12, 25, 'hdChristmas');
  return out;
}

function etDateParts(nowMs) {
  const d = nowMs ? new Date(nowMs) : new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d);
  const g = (t) => (parts.find((p) => p.type === t) || {}).value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
  return { y: +g('year'), m: +g('month'), d: +g('day'), dow: wd, key: g('year') + '-' + g('month') + '-' + g('day') };
}

function marketClosedReason(nowMs) {
  try {
    const p = etDateParts(nowMs);
    if (p.dow === 0 || p.dow === 6) return 'hdWeekend';
    const hol = _nyseHolCache[p.y] || (_nyseHolCache[p.y] = nyseHolidays(p.y));
    return hol[p.key] || null;
  } catch (e) { return null; }
}

function ilDateParts(nowMs) {
  const d = nowMs ? new Date(nowMs) : new Date();
  const g = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
  const pick = (a, t) => (a.find((p) => p.type === t) || {}).value;
  const h = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long' }).formatToParts(d);
  return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pick(g, 'weekday')), mins: (+pick(g, 'hour') % 24) * 60 + (+pick(g, 'minute')), hm: pick(h, 'month'), hd: +pick(h, 'day') };
}

function taseHolidayKey(p) {
  const m = p.hm, d = p.hd;
  if (m === 'Elul' && d === 29) return 'hdTaErevRH';
  if (m === 'Tishri') return ({ 1: 'hdTaRH', 2: 'hdTaRH', 9: 'hdTaErevYK', 10: 'hdTaYK', 14: 'hdTaErevSukkot', 15: 'hdTaSukkot', 21: 'hdTaErevSimchat', 22: 'hdTaSimchat' })[d] || null;
  if ((m === 'Adar' || m === 'Adar II') && d === 14) return 'hdTaPurim';
  if (m === 'Nisan') return ({ 14: 'hdTaErevPesach', 15: 'hdTaPesach', 20: 'hdTaErevPesach', 21: 'hdTaPesach' })[d] || null;
  if (m === 'Iyar' && d >= 3 && d <= 6) { // יום העצמאות: ה׳ באייר, מוקדם לחמישי אם ו׳/שבת, נדחה לשלישי אם שני
    const dow5 = (p.dow + (5 - d) + 7) % 7;
    const obs = dow5 === 5 ? 4 : dow5 === 6 ? 3 : dow5 === 1 ? 6 : 5;
    return d === obs ? 'hdTaIndependence' : null;
  }
  if (m === 'Sivan') return ({ 5: 'hdTaErevShavuot', 6: 'hdTaShavuot' })[d] || null;
  if (m === 'Av' && d === 9 && p.dow !== 6) return 'hdTaTishaBav';
  return null;
}

function taseMarketNow(nowMs) {
  try {
    const p = ilDateParts(nowMs);
    const hol = taseHolidayKey(p);
    if (hol) return { closed: true, reason: hol };
    if (p.dow === 0 || p.dow === 6) return { closed: true, reason: 'hdWeekend' };
    const end = p.dow === 5 ? 14 * 60 : 17 * 60 + 30;
    return { closed: p.mins < 9 * 60 + 59 || p.mins >= end, reason: null };
  } catch (e) { return { closed: false, reason: null }; }
}

module.exports = { easterSunday, nyseHolidays, etDateParts, marketClosedReason, ilDateParts, taseHolidayKey, taseMarketNow };
