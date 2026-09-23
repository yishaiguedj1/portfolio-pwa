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
  '\n;globalThis.__t = { parseEarningsCalendar, daysUntil };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- parseEarningsCalendar ---------- */
// מבנה data[]
const j1 = { data: [
  { symbol: 'NVDA', date: '2099-02-10', time: 'amc' },
  { symbol: 'AAPL', date: '2099-01-05', time: 'bmo' },
  { symbol: 'OLD', date: '2020-01-01', time: '' },
  { symbol: 'BAD', date: 'not-a-date' },
] };
const r1 = T.parseEarningsCalendar(j1);
ok(r1.NVDA && r1.NVDA.date === '2099-02-10' && r1.NVDA.time === 'amc', 'מבנה data[] מפוענח');
ok(r1.AAPL && r1.AAPL.date === '2099-01-05', 'סימבול שני מפוענח');
ok(!r1.OLD, 'דוח מהעבר מסונן');
ok(!r1.BAD, 'תאריך לא תקין מסונן');

// מבנה earnings{} (מיפוי סימבול -> מערך)
const j2 = { earnings: {
  NVDA: [{ date: '2099-03-01', time: 'amc' }, { date: '2099-06-01', time: '' }],
  MSFT: [{ date: '2099-02-01' }],
} };
const r2 = T.parseEarningsCalendar(j2);
ok(r2.NVDA && r2.NVDA.date === '2099-03-01', 'מבנה earnings{} מפוענח — נבחר המוקדם ביותר');
ok(r2.MSFT && r2.MSFT.date === '2099-02-01', 'סימבול שני במבנה earnings{}');

// קלטים משובשים לא מפילים
ok(JSON.stringify(T.parseEarningsCalendar(null)) === '{}', 'null -> ריק');
ok(JSON.stringify(T.parseEarningsCalendar({ status: 'error' })) === '{}', 'שגיאת API -> ריק');
ok(JSON.stringify(T.parseEarningsCalendar({ data: 'x' })) === '{}', 'data לא-מערך -> ריק');

// סימבול באותיות קטנות מנורמל
const r3 = T.parseEarningsCalendar({ data: [{ symbol: 'nvda', date: '2099-04-01' }] });
ok(r3.NVDA && r3.NVDA.date === '2099-04-01', 'סימבול מנורמל לאותיות גדולות');

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
