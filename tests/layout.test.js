/* בדיקות פריסה ועיצוב ל־v34: סרגל לשוניות שלא נחתך בקצוות, כותרת לא צפופה,
   פלטת iOS 26 בשתי הערכות, טון רציני (בלי אימוג'י קישוט), ורינדור he/en × בהיר/כהה/מערכת.
   הרצה: node tests/layout.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

const root = path.join(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function block(sel) {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = css.match(new RegExp(esc + '\\s*\\{([^}]*)\\}'));
  return m ? m[1] : '';
}

/* ---------- 1. סרגל הלשוניות: שום לשונית לא נחתכת בקצה ---------- */
const tabs = block('.tabs');
ok(/overflow-x:\s*(auto|scroll)/.test(tabs), '.tabs גולל פנימית — כל הלשוניות נגישות, אין חיתוך קשיח');
ok(css.includes('.tabs::-webkit-scrollbar'), 'סרגל הגלילה של הלשוניות מוסתר (נשאר קפסולה נקייה)');
ok(/scrollbar-width:\s*none/.test(tabs), 'scrollbar-width:none על הלשוניות');
ok(!/width:\s*\d+(\.\d+)?px/.test(tabs), '.tabs בלי רוחב פיקסלים קבוע שמכריח גלישה');
const tab = block('.tab');
ok(/min-width:\s*0/.test(tab), '.tab עם min-width:0 — לא דוחף את הסרגל אל מחוץ למסך');
ok(/white-space:\s*nowrap/.test(tab), 'טקסט הלשונית לא נשבר לשתי שורות');
ok(/flex:\s*1\s+0\s+auto/.test(tab), '.tab גמיש (flex:1 0 auto) — מתמתח כשיש מקום, לא נמעך מתחת לתוכן');
ok(/html,\s*body\s*\{[^}]*overflow-x:\s*(clip|hidden)/.test(css), 'אין גלילה אופקית ברמת העמוד');

/* ---------- 2. כותרת עליונה: אין התנגשות במסכים צרים ---------- */
ok(/\.appbar-title\s*\{[^}]*min-width:\s*0/.test(css), 'בלוק הכותרת יכול להתכווץ (min-width:0 + flex)');
ok(/\.appbar-sub\s*\{[^}]*text-overflow:\s*ellipsis/.test(css), 'שורת המשנה נחתכת ב־… ולא דוחפת את הכפתורים');
ok(/\.appbar-actions\s*\{[^}]*flex:\s*none/.test(css), 'בלוק הכפתורים לא נמעך (flex:none)');

/* ---------- 3. פלטת iOS 26 בשתי הערכות ---------- */
const darkCss = css.split('[data-theme="dark"]')[1] || '';
for (const tok of ['--sys-blue', '--sys-green', '--sys-teal', '--sys-purple', '--sys-pink',
                   '--sys-orange', '--sys-yellow', '--sys-mint', '--sys-indigo',
                   '--glass-hi', '--separator', '--link']) {
  const re = new RegExp(tok.replace(/-/g, '\\-') + '\\s*:');
  ok(re.test(css), 'טוקן ' + tok + ' מוגדר בערכת בהיר');
  ok(darkCss.includes(tok + ':'), 'טוקן ' + tok + ' מוגדר גם בערכה הכהה');
}
ok(/--gain:\s*#34C759/i.test(css), 'רווח = systemGreen של iOS בערכת בהיר');
ok(/--loss:\s*#FF3B30/i.test(css), 'הפסד = systemRed של iOS בערכת בהיר');
ok(/--gain:\s*#30D158/i.test(darkCss), 'רווח = systemGreen (dark) בערכה הכהה');
ok(/--loss:\s*#FF453A/i.test(darkCss), 'הפסד = systemRed (dark) בערכה הכהה');
ok(!/text-align:\s*(left|right)/.test(css), 'אין text-align פיזי — בטוח ל־RTL ול־LTR');
ok(css.includes('--glass-hi'), 'הדגשת hairline של Liquid Glass קיימת');

/* ---------- 4. טון רציני: בלי אימוג'י קישוט בכותרות ---------- */
ok(!/[👤🎨📈🏦]/u.test(html), 'אין אימוג׳י קישוט בכותרות ה־HTML');
ok(!/PIE_COLORS/.test(appSrc), 'אין יותר מערך צבעים קשיח לעוגה — הצבעים נגזרים מהערכה');
ok(/function pieColor/.test(appSrc), 'pieColor() קיים — צבעי העוגה עוקבים אחרי ערכת הנושא');

/* ---------- 5. רינדור he/en × בהיר/כהה/מערכת בלי חריגות ---------- */
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
function elStub() {
  const cls = new Set();
  return {
    value: '', textContent: '', innerHTML: '', placeholder: '', title: '',
    classList: {
      add: (c) => cls.add(c), remove: (c) => cls.delete(c),
      toggle: (c, f) => { if (f) cls.add(c); else cls.delete(c); },
      contains: (c) => cls.has(c),
    },
    addEventListener() {}, appendChild() {}, dataset: {}, style: {},
    setAttribute() {}, disabled: false,
  };
}
const els = {};
const docEl = { lang: '', dir: '', dataset: {} };
let sysDark = false;
const matchMedia = () => ({ matches: sysDark, addEventListener() {}, addListener() {} });
const document = {
  addEventListener() {},
  getElementById: (id) => (els[id] || (els[id] = elStub())),
  querySelectorAll: () => [], querySelector: () => null,
  createElement: () => elStub(), documentElement: docEl, title: '',
};
const sandbox = {
  localStorage, document,
  window: { matchMedia }, navigator: {}, location: { reload() {} },
  setTimeout, clearTimeout, confirm: () => true, console,
};
vm.createContext(sandbox);
vm.runInContext(
  appSrc + '\n;globalThis.__lo = { setLang, applyI18n, setThemeMode, applyTheme, resolveTheme, getThemeMode, t, cssVar, LS_THEME };',
  sandbox, { filename: 'app.js' });
vm.runInContext('renderAll = undefined; renderIbkrCard = undefined; renderTdKeyStatus = undefined; updateSourceLabel = undefined;', sandbox);
const T = sandbox.__lo;
ok(!!T, 'מנוע האפליקציה נטען בסביבת טסט');

const combos = [
  ['he', 'light', false], ['he', 'dark', false], ['he', 'system', false],
  ['en', 'light', false], ['en', 'dark', true], ['en', 'system', true],
];
for (const [lang, theme, dark] of combos) {
  sysDark = dark;
  T.setLang(lang);
  T.setThemeMode(theme);
  T.applyI18n();
  T.applyTheme();
  const wantDir = lang === 'he' ? 'rtl' : 'ltr';
  ok(docEl.lang === lang && docEl.dir === wantDir, `רינדור ${lang}/${theme}: dir=${wantDir}`);
  const wantTheme = theme === 'system' ? (dark ? 'dark' : 'light') : theme;
  ok(docEl.dataset.theme === wantTheme, `רינדור ${lang}/${theme}: ערכה=${wantTheme}`);
}
for (const key of ['myAccount', 'themeTitle', 'tdKeyTitle', 'ibkrTitle']) {
  T.setLang('he');
  ok(!/[👤🎨📈🏦]/u.test(T.t(key)), `המפתח ${key} בעברית בלי אימוג׳י`);
  T.setLang('en');
  ok(!/[👤🎨📈🏦]/u.test(T.t(key)), `המפתח ${key} באנגלית בלי אימוג׳י`);
}
T.setLang('he');

console.log('\nכל בדיקות הפריסה עברו: ' + n + ' assertions');

/* ---------- כפתור ניקוי מטמון (v34) ---------- */
ok(html.includes('id="clearCache"'), 'כפתור clearCache קיים ב־index.html');
ok(appSrc.includes("getElementById('clearCache')"), 'app.js מחבר מאזין לכפתור clearCache');
ok(/caches\.delete/.test(appSrc) && /unregister\(\)/.test(appSrc), 'ניקוי המטמון מוחק caches ומבטל רישום SW');

/* ---------- התאמת גודל מספרים אוטומטית (v34) ---------- */
ok(appSrc.includes('function fitNumbers()'), 'fitNumbers קיימת ב־app.js');
ok(/\.stat-value, \.lg-pct, \.pension-total/.test(appSrc), 'fitNumbers מכסה stat-value, lg-pct ו־pension-total');
ok(/renderOverview[\s\S]{0,4000}fitNumbers\(\)/.test(appSrc), 'renderOverview קוראת ל־fitNumbers');
ok(/switchTab[\s\S]{0,1200}fitNumbers\(\)/.test(appSrc), 'switchTab קוראת ל־fitNumbers אחרי מעבר לשונית');
ok(/white-space:\s*nowrap/.test(css), 'מספרים גדולים לא נשברים לשורות');
