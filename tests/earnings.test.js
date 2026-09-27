/* בדיקות לתאריכי דוחות (earnings) ב־app.js. הרצה: node tests/earnings.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

/* ---------- stubs ---------- */
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
function elStub() {
  return {
    value: '', textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, appendChild() {}, dataset: {}, style: {},
    setAttribute() {},
    disabled: false,
  };
}
const els = {};
const document = {
  addEventListener() {},
  getElementById: (id) => (els[id] || (els[id] = elStub())),
  querySelectorAll: () => [],
  createElement: () => elStub(),
};
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: { reload() {} },
  fetch: async () => { throw new Error('fetch לא הוגדר בטסט'); },
  setTimeout, clearTimeout, confirm: () => true,
  console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { earnFromExt, daysUntil, earnCalEvent, earnGoogleUrl, earnIcs };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- earnFromExt (v220: Yahoo דרך השרתון, במקום Twelve Data) ---------- */
const ts = (iso) => Date.parse(iso) / 1000;
const e1 = T.earnFromExt('AAPL', { t: ts('2026-10-29T20:00:00Z'), est: false });
ok(e1 && e1.date === '2026-10-29' && e1.time === 'amc' && e1.est === false, 'ארה״ב 16:00 בניו־יורק → אחרי הסגירה, תאריך בשעון ניו־יורק');
const e2 = T.earnFromExt('KO', { t: ts('2026-10-20T10:30:00Z'), est: true });
ok(e2 && e2.date === '2026-10-20' && e2.time === 'bmo' && e2.est === true, 'ארה״ב 06:30 בניו־יורק → לפני הפתיחה, משוער');
const e3 = T.earnFromExt('MSFT', { t: ts('2026-10-21T01:30:00Z') });
ok(e3 && e3.date === '2026-10-20' && e3.time === 'amc', 'אחרי חצות UTC אבל עדיין ערב בניו־יורק → התאריך האמריקאי');
const e4 = T.earnFromExt('LUMI.TA', { t: ts('2026-11-17T14:30:00Z') });
ok(e4 && e4.date === '2026-11-17' && e4.time === '', 'ת״א: תאריך בשעון ישראל, בלי לפני/אחרי');
ok(T.earnFromExt('AAPL', null) === null && T.earnFromExt('AAPL', { t: 0 }) === null, 'בלי נתון → null');

// v222: "אחרי הסגירה" בחורף — Yahoo רושם 20:00 UTC = 15:00 בניו־יורק אחרי מעבר לשעון חורף
const e5 = T.earnFromExt('ADBE', { t: ts('2026-12-09T20:00:00Z') });
ok(e5.date === '2026-12-09' && e5.time === 'amc' && e5.ts === ts('2026-12-09T20:00:00Z'), 'חורף (15:00 בניו־יורק) → אחרי הסגירה; שומר את הזמן לאירוע ביומן');

/* ---------- הוספה ליומן (v222) ---------- */
const ev1 = T.earnCalEvent({ sym: 'AAPL', date: '2026-10-29', time: 'amc', ts: ts('2026-10-29T20:00:00Z'), est: true }, 'Apple');
ok(ev1.timed && ev1.end - ev1.start === 1800 && /AAPL/.test(ev1.title) && /Apple/.test(ev1.title), 'אירוע עם שעה: חצי שעה, כותרת עם הסימבול והשם');
const gu = T.earnGoogleUrl(ev1);
ok(gu.startsWith('https://calendar.google.com/calendar/render?action=TEMPLATE&text=') && /&dates=20261029T200000Z\/20261029T203000Z&/.test(gu), 'קישור Google Calendar עם שעות UTC');
const ev2 = T.earnCalEvent({ sym: 'LUMI.TA', date: '2026-11-17', time: '', ts: 0 }, 'לאומי');
ok(!ev2.timed && /dates=20261117\/20261118&/.test(T.earnGoogleUrl(ev2)) && !/\.TA/.test(ev2.title), 'בלי שעה → יום שלם; בלי ".TA" בכותרת');
const ics = T.earnIcs(ev1, ts('2026-09-27T00:00:00Z'));
ok(/^BEGIN:VCALENDAR\r\n/.test(ics) && /\r\nDTSTART:20261029T200000Z\r\n/.test(ics) && /TRIGGER:-P1D/.test(ics) && /TRIGGER:-PT1H/.test(ics) && /END:VCALENDAR\r\n$/.test(ics), '.ics: אירוע עם שעה + תזכורות יום ושעה לפני, שורות CRLF');
const ics2 = T.earnIcs(ev2, 0);
ok(/DTSTART;VALUE=DATE:20261117/.test(ics2) && /DTEND;VALUE=DATE:20261118/.test(ics2) && !/PT1H/.test(ics2), '.ics: יום שלם — תזכורת יום לפני בלבד');
ok(/SUMMARY:[^\r]*\\,|SUMMARY:[^\r,]*\r/.test(T.earnIcs(T.earnCalEvent({ sym: 'X', date: '2026-10-01', time: '' }, 'A, B; C'), 0)), '.ics: פסיקים ונקודה־פסיק מוברחים');

/* השרתון: הדוח הבא מתוך v7/quote */
const Q = require(path.join(__dirname, '..', 'ibkr-proxy', 'api', 'quotes.js'));
const now = Date.parse('2026-09-27T12:00:00Z');
const x1 = Q._extFromQuote({ symbol: 'AAPL', earningsTimestamp: ts('2026-07-30T20:00:00Z'), earningsTimestampStart: ts('2026-10-29T20:00:00Z'), earningsTimestampEnd: ts('2026-10-29T20:00:00Z'), isEarningsDateEstimate: true }, now);
ok(x1.earn && x1.earn.t === ts('2026-10-29T20:00:00Z') && x1.earn.est === true, 'שרתון: הדוח הבא (לא האחרון שכבר עבר), כולל "משוער"');
ok(!Q._extFromQuote({ symbol: 'X', earningsTimestamp: ts('2026-07-30T20:00:00Z') }, now).earn, 'שרתון: רק דוח שעבר → בלי earn');
const appSrc = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
ok(!/twelvedata|tdKey\(|LS_TDKEY/i.test(appSrc), 'Twelve Data הוסר מהאפליקציה (v220)');

/* ---------- daysUntil ---------- */
const today = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const tmr = new Date(today); tmr.setDate(tmr.getDate() + 1);
const in10 = new Date(today); in10.setDate(in10.getDate() + 10);
ok(T.daysUntil(iso(today)) === 0, 'היום -> 0');
ok(T.daysUntil(iso(tmr)) === 1, 'מחר -> 1');
ok(T.daysUntil(iso(in10)) === 10, 'עוד 10 ימים -> 10');

/* ---------- עקביות קבצים ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
for (const id of ['earnCard', 'earnList']) {
  ok(html.includes('id="' + id + '"'), 'אלמנט ' + id + ' קיים ב־index.html');
}
const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
for (const cls of ['.earn-list', '.earn-row', '.wl-earn']) {
  ok(css.includes(cls), 'סגנון ' + cls + ' קיים ב־styles.css');
}

console.log('\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ' + n + ')');
