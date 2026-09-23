/* בדיקות לגרף NAV אמיתי מ־IBKR. הרצה: node tests/ibkr-nav.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

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
  documentElement: elStub(),
};
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: { reload() {} },
  fetch: async () => { throw new Error('fetch לא הוגדר בטסט'); },
  setTimeout, clearTimeout, confirm: () => true, requestAnimationFrame: (f) => f(),
  console,
};
vm.createContext(sandbox);
const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8') +
  '\n;globalThis.__t = { ibkrNavHistory, renderPfNote, isIbkrMode };';
vm.runInContext(src, sandbox, { filename: 'app.js' });
const T = sandbox.__t;
ok(!!T, 'app.js נטען בלי שגיאות תחביר');

/* ---------- ibkrNavHistory: ניקוי ומיון ---------- */
function setNavHistory(rows) {
  store['pwa_ibkr_v1'] = JSON.stringify({ data: { navHistory: rows, nav: null, meta: {} } });
}
setNavHistory([
  { toDate: '2024-01-03', endingValue: 10890 },
  { toDate: '2024-01-01', endingValue: 11000 },
  { toDate: '2024-01-02', endingValue: 12100 },
  { toDate: '2024-01-02', endingValue: 12200 }, // כפילות — האחרונה מנצחת
  { toDate: '2024-01-04', endingValue: 'oops' }, // ערך שבור — מסונן
  { toDate: 'bad', endingValue: 5 }, // תאריך שבור — מסונן
  { fromDate: '2024-01-05', endingValue: 13000 }, // בלי toDate — נופל ל־fromDate
]);
const pts = T.ibkrNavHistory();
ok(pts.length === 4, 'ארבע נקודות תקינות אחרי סינון וכפילות');
ok(pts[0].date === '2024-01-01' && pts[3].date === '2024-01-05', 'ממוין לפי תאריך');
ok(pts[1].value === 12200, 'כפילות תאריך: האחרונה מנצחת');
ok(pts.every((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && isFinite(p.value)), 'כל הנקודות תקינות');

setNavHistory(null);
ok(T.ibkrNavHistory().length === 0, 'אין navHistory -> ריק');
setNavHistory([{ toDate: '2024-01-01', endingValue: 11000 }]);
ok(T.ibkrNavHistory().length === 1, 'נקודה אחת לא מספיקה לגרף (נדרשות 2+)');

/* ---------- renderPfNote: הערה לפי מקור הנתונים ---------- */
vm.runInContext('DB.source = "ibkr"', sandbox);
ok(T.isIbkrMode() === true, 'מצב IBKR פעיל בטסט');
setNavHistory([
  { toDate: '2024-01-01', endingValue: 11000 },
  { toDate: '2024-01-02', endingValue: 12100 },
]);
T.renderPfNote();
const noteEl = document.getElementById('pfNoteEl');
ok(/IBKR/.test(noteEl.textContent), 'עם היסטוריית NAV — הערה על שווי אמיתי מ־IBKR');
setNavHistory(null);
T.renderPfNote();
ok(/שקלים/.test(noteEl.textContent), 'בלי היסטוריה — חזרה להערת השחזור (שקלים)');
vm.runInContext('DB.source = "manual"', sandbox);

/* ---------- עקביות HTML ---------- */
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
ok(html.includes('id="pfNoteEl"'), 'אלמנט pfNoteEl קיים ב־index.html');
ok(!/id="pfNoteEl"[^>]*data-i18n/.test(html) && !/data-i18n="pfNote"/.test(html),
  'ההערה לא קשורה יותר ל־data-i18n (הטקסט דינמי)');

console.log('\nכל הבדיקות עברו ✓ (סה"כ אסרטים: ' + n + ')');
