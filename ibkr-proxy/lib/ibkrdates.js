/* תאריכי הסנכרון של IBKR — אותו חישוב בדיוק כמו באפליקציה (app.js: ibkrDateChunks, ibkrLastClosedDate,
   ibkrHasWeekday, ibkrAutoTargetMs). הסנכרון ברקע שומר דוח לכל חלק לפי "fd|td", והאפליקציה משתמשת בו רק
   כשהחלק שלה זהה — לכן כל שינוי באפליקציה חייב להיות גם כאן (tests/run.js משווה את התוצאות). */
const ymd = (d) => d.getFullYear().toString().padStart(4, '0') + (d.getMonth() + 1).toString().padStart(2, '0') + d.getDate().toString().padStart(2, '0');
const fromYmd = (s) => new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8));

function dateChunks(startYmd, endYmd) {
  const chunks = [];
  if (!(startYmd <= endYmd)) return chunks;
  for (let y = +startYmd.slice(0, 4); y <= +endYmd.slice(0, 4); y++) {
    const fd = String(y) + '0101' > startYmd ? String(y) + '0101' : startYmd;
    const td = String(y) + '1231' < endYmd ? String(y) + '1231' : endYmd;
    const leapFull = fd === String(y) + '0101' && td === String(y) + '1231' && new Date(y, 1, 29).getMonth() === 1;
    if (leapFull) { chunks.push({ fd, td: String(y) + '1230' }); chunks.push({ fd: String(y) + '1231', td }); }
    else chunks.push({ fd, td });
  }
  return chunks;
}
/* יום המסחר האחרון שנסגר בניו־יורק = "אתמול" לפי שעון ניו־יורק (לקח v136) */
function lastClosedYmd(nowMs) {
  const n = new Date(nowMs || Date.now());
  let iso = '';
  try { iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(n); } catch (e) {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso = new Date(n.getTime() - 5 * 3600000).toISOString().slice(0, 10);
  const d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  d.setDate(d.getDate() - 1);
  return ymd(d);
}
function hasWeekday(a, b) {
  if (!(a <= b)) return false;
  const d = fromYmd(a);
  for (let i = 0; i < 7 && ymd(d) <= b; i++) { const w = d.getDay(); if (w !== 0 && w !== 6) return true; d.setDate(d.getDate() + 1); }
  return false;
}
function nextYmd(s) { const d = fromYmd(s); d.setDate(d.getDate() + 1); return ymd(d); }
/* רגע היעד האחרון: היום ב־14:00 שעון ישראל (או אתמול אם עוד לא הגענו) — כמו ibkrAutoTargetMs */
const AUTO_HOUR_IL = 14;
function autoTargetMs(ms) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' })
    .formatToParts(new Date(ms)).forEach((x) => { p[x.type] = +x.value; });
  const offset = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(ms / 1000) * 1000;
  let t = Date.UTC(p.year, p.month - 1, p.day, AUTO_HOUR_IL, 0, 0) - offset;
  if (t > ms) t -= 24 * 3600 * 1000;
  return t;
}
module.exports = { dateChunks, lastClosedYmd, hasWeekday, nextYmd, autoTargetMs, ymd };
