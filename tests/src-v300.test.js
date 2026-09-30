// v300: שורת המקור ומצב השוק כקפסולות (הצעה א׳ שהמשתמש בחר)
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
vm.runInContext(app + '\n;globalThis.__t = { sourceLabelHTML };', sb, { filename: 'app.js' });
const f = sb.__t.sourceLabelHTML;
const live = f({ source: 'Yahoo', live: true, session: '' });
ok(/src-dot"/.test(live) && /<b>חי<\/b>/.test(live) && /Yahoo/.test(live) && !/src-sess/.test(live) && !/מקור/.test(live), 'חי: נקודה ירוקה + "חי" | Yahoo, בלי "מקור:" ובלי קפסולת מצב שוק');
const post = f({ source: 'Yahoo', live: true, session: 'post' });
ok(/src-sess post/.test(post) && /מסחר־מאוחר/.test(post), 'מסחר מאוחר: קפסולה נפרדת בצבע משלה');
ok(/src-sess pre/.test(f({ source: 'Yahoo', live: true, session: 'pre' })) && /src-sess night/.test(f({ source: 'Yahoo', live: true, session: 'night' })), 'מסחר מוקדם / לילי');
ok(/src-dot off/.test(f({ source: 'CNBC', live: false })) && /דיליי/.test(f({ source: 'CNBC', live: false })), 'גיבוי: נקודה אפורה + "דיליי"');
ok(/שמור/.test(f({ source: 'Yahoo', live: true, stale: true })) && /src-dot off/.test(f({ source: 'Yahoo', live: true, stale: true })), 'נתונים שמורים: "שמור" + נקודה אפורה');
ok(/טוען/.test(f({ source: '' })), 'לפני הנתונים: "טוען…"');
ok(!/<img/.test(f({ source: '<img onerror=x>' })) && /&lt;img/.test(f({ source: '<img onerror=x>' })), 'שם המקור מוצג בבטחה (esc)');
ok(/\.src-pill \{[^}]*var\(--surface-2\)[^}]*var\(--card-border\)/.test(css) && /\.src-dot \{[^}]*var\(--gain\)/.test(css), 'עיצוב: כמו בועת שער הדולר, נקודה בירוק הרווח');
ok(/srcDelayed: 'Delayed'/.test(app) && /srcSaved: 'Saved'/.test(app), 'מחרוזות באנגלית');
console.log('# ' + n + ' בדיקות עברו');
