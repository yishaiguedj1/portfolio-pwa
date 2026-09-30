// v301: קפסולת מצב השוק בלבד (בלי שם המקור) — פתוח/מוקדם/מאוחר/לילי/סגור, נקודה אפורה + "דיליי" כשלא חי
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const store = {};
function elStub() { return { value: '', textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, appendChild() {}, dataset: {}, style: {}, setAttribute() {}, removeAttribute() {}, querySelectorAll: () => [], querySelector: () => null }; }
const sb = { localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem() {} },
  document: { addEventListener() {}, getElementById: () => elStub(), querySelectorAll: () => [], createElement: () => elStub() },
  window: {}, navigator: {}, location: { reload() {} }, AbortController, fetch: async () => { throw new Error('x'); }, setTimeout, clearTimeout, console };
vm.createContext(sb);
vm.runInContext(app + '\n;globalThis.__t = { sourceLabelHTML, marketStatusKind, setLang: typeof setLang === "function" ? setLang : null };', sb, { filename: 'app.js' });
const f = sb.__t.sourceLabelHTML;
const WED = Date.parse('2026-09-30T15:00:00Z'); // יום רביעי, יום מסחר
const SAT = Date.parse('2026-10-03T15:00:00Z');
const XMAS = Date.parse('2026-12-25T15:00:00Z');
const LABOR = Date.parse('2026-09-07T15:00:00Z');
const open = f({ source: 'Yahoo', live: true, session: '' }, WED);
ok(/st-pill open"/.test(open) && /<i><\/i>/.test(open) && /השוק פתוח/.test(open) && !/Yahoo/.test(open) && !/דיליי/.test(open), 'פתוח וחי: נקודה + "השוק פתוח", בלי שם המקור');
const openD = f({ source: 'CNBC', live: false, session: '' }, WED);
ok(/st-pill open delay/.test(openD) && /· דיליי/.test(openD) && !/CNBC/.test(openD), 'פתוח בגיבוי: נקודה אפורה + "· דיליי"');
ok(/st-pill open delay/.test(f({ source: 'Yahoo', live: true, stale: true, session: '' }, WED)), 'נתונים שמורים = דיליי');
for (const [k, lbl] of [['pre', 'מסחר־מוקדם'], ['post', 'מסחר־מאוחר'], ['night', 'מסחר־לילי']]) {
  const h = f({ source: 'Yahoo', live: true, session: k }, WED);
  ok(new RegExp('st-pill ' + k + '"').test(h) && h.includes(lbl) && /<svg/.test(h) && /<i><\/i>/.test(h), k + ': קפסולה צבעונית + אייקון + נקודה חיה');
  ok(new RegExp('st-pill ' + k + ' delay').test(f({ source: 'CNBC', live: false, session: k }, WED)), k + ' בדיליי: נקודה אפורה');
}
const sat = f({ source: 'CNBC', live: false, session: 'pre' }, SAT);
ok(/st-pill closed/.test(sat) && /השוק סגור · סופ״ש/.test(sat) && !/<i>/.test(sat) && !/דיליי/.test(sat), 'שבת: סגור + סופ״ש גם כשהגיבוי אומר "מסחר מוקדם"; מנעול בלי נקודה');
ok(/השוק סגור · חג המולד/.test(f({ source: 'Yahoo', live: true, session: 'closed' }, XMAS)), 'חג: שם החג');
ok(/השוק סגור · יום העבודה/.test(f({ source: 'Yahoo', live: true, session: '' }, LABOR)), 'שם חג מתוקן: "יום העבודה"');
ok(/st-pill night/.test(f({ source: 'Yahoo', live: true, session: 'night' }, SAT)), 'מסחר לילי גובר על "סופ״ש" (יום ראשון בערב)');
const closedNoReason = f({ source: 'Yahoo', live: true, session: 'closed' }, WED);
ok(/st-pill closed/.test(closedNoReason) && />השוק סגור<\/span>/.test(closedNoReason.replace(/<svg.*<\/svg>/, '')), 'סגור בלי סיבה (סגירה מיוחדת/אחרי השעות)');
ok(/טוען/.test(f({ source: '' }, WED)), 'לפני הנתונים: "טוען…"');
ok(/\.st-pill \{[^}]*border-radius: var\(--pill\)/.test(css) && /\.st-pill\.open i \{[^}]*var\(--gain\)/.test(css) && /\.st-pill\.delay i \{[^}]*var\(--on-surface-var\)/.test(css), 'עיצוב: גלולה, נקודה ירוקה בפתוח, אפורה בדיליי');
ok(/stOpen: 'Market open'/.test(app) && /stClosedWith: 'Closed · \{r\}'/.test(app) && /stClosedFull: 'Market closed'/.test(app), 'מחרוזות באנגלית');
ok(/hdNewYear: '1 בינואר'/.test(app) && /hdPresidents: 'יום הנשיאים'/.test(app), 'שמות חגים מתוקנים באפליקציה');
const wm = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/widget-model.js'), 'utf8');
ok(/hdNewYear: '1 בינואר'/.test(wm) && /hdLabor: 'יום העבודה'/.test(wm), 'ובווידג׳ט');
ok(/state\.session = sess === 'regular' \? '' : sess;/.test(app), '"סגור" מהמקור נשמר');
console.log('# ' + n + ' בדיקות עברו');
