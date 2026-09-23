/* בדיקות ערכת נושא ל־v29: בהיר/כהה/מערכת, שמירה מקומית, ושילוב עם שפה וכיוון.
   הרצה: node tests/theme.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

const root = path.join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------- stubs ---------- */
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
  querySelectorAll: () => [],
  querySelector: () => null,
  createElement: () => elStub(),
  documentElement: docEl,
  title: '',
};
const sandbox = {
  localStorage, document,
  window: { matchMedia }, navigator: {}, location: { reload() {} },
  setTimeout, clearTimeout, confirm: () => true, console,
};
vm.createContext(sandbox);
vm.runInContext(
  appSrc + '\n;globalThis.__th = { getThemeMode, setThemeMode, resolveTheme, applyTheme, renderThemeToggle, LS_THEME, setLang, getLang, t, cssVar, applyI18n };',
  sandbox, { filename: 'app.js' });
// מנטרלים רינדורים כבדים — כאן נבדקת מכניקת הערכה/שפה, לא הציור
vm.runInContext('renderAll = undefined; renderIbkrCard = undefined; renderTdKeyStatus = undefined; updateSourceLabel = undefined;', sandbox);
const T = sandbox.__th;
ok(!!T, 'מנוע הערכה נטען');

/* ---------- 1. ברירת מחדל: מערכת ---------- */
Object.keys(store).forEach((k) => delete store[k]);
ok(T.getThemeMode() === 'system', 'ברירת מחדל: system');
sysDark = false;
ok(T.resolveTheme() === 'light', 'מערכת בהירה → light');
sysDark = true;
ok(T.resolveTheme() === 'dark', 'מערכת כהה → dark');
sysDark = false;

/* ---------- 2. בחירה ידנית נשמרת ומוחלת ---------- */
T.setThemeMode('dark');
ok(store[T.LS_THEME] === 'dark', 'הבחירה נשמרת ב־localStorage');
ok(docEl.dataset.theme === 'dark', 'data-theme=dark על <html>');
ok(els.themeDark.classList.contains('active'), 'כפתור כהה מסומן');
ok(!els.themeLight.classList.contains('active'), 'כפתור בהיר לא מסומן');
T.setThemeMode('light');
ok(docEl.dataset.theme === 'light', 'data-theme=light');
ok(els.themeLight.classList.contains('active'), 'כפתור בהיר מסומן');
T.setThemeMode('system');
ok(docEl.dataset.theme === 'light', 'system + מערכת בהירה → light');
ok(els.themeSystem.classList.contains('active'), 'כפתור מערכת מסומן');
sysDark = true;
T.applyTheme();
ok(docEl.dataset.theme === 'dark', 'system עוקב אחרי מערכת כהה');
sysDark = false;
T.applyTheme();

/* ---------- 3. ערך לא תקין נופל ל־system ---------- */
store[T.LS_THEME] = 'junk';
ok(T.getThemeMode() === 'system', 'ערך לא תקין → system');
delete store[T.LS_THEME];

/* ---------- 4. שילוב שפה + ערכה + כיוון ---------- */
T.setThemeMode('dark');
T.setLang('en');
ok(docEl.dir === 'ltr' && docEl.lang === 'en', 'אנגלית: dir=ltr');
ok(docEl.dataset.theme === 'dark', 'הערכה נשמרת אחרי החלפת שפה');
ok(T.t('themeDark') === 'Dark', 'מחרוזת ערכה באנגלית');
T.setLang('he');
ok(docEl.dir === 'rtl' && docEl.lang === 'he', 'עברית: dir=rtl');
ok(docEl.dataset.theme === 'dark', 'הערכה נשמרת גם בחזרה לעברית');
ok(T.t('themeDark') === 'כהה', 'מחרוזת ערכה בעברית');
T.applyI18n();
ok(docEl.dataset.theme === 'dark', 'applyI18n לא דורס את הערכה');

/* ---------- 5. cssVar נופל לברירת מחדל בלי דפדפן ---------- */
ok(T.cssVar('--gain', '#137333') === '#137333', 'cssVar מחזיר fallback בטסטים');
ok(T.cssVar('--nope', 'x') === 'x', 'cssVar למפתח לא קיים');

/* ---------- 6. כפתורי הערכה קיימים ב־HTML עם מפתחות i18n ---------- */
for (const [id, key] of [['themeLight', 'themeLight'], ['themeSystem', 'themeSystem'], ['themeDark', 'themeDark']]) {
  ok(html.includes('id="' + id + '"'), 'כפתור ' + id + ' קיים ב־HTML');
  ok(html.includes('data-i18n="' + key + '"'), 'ל־' + id + ' יש data-i18n=' + key);
}
ok(html.includes('pwa_theme_v1'), 'סקריפט ה־pre-paint קיים ב־<head>');
ok(html.includes('id="themeColorMeta"'), 'meta theme-color עם id לעדכון דינמי');

/* ---------- 7. טוקני הערכה ב־CSS ---------- */
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
ok(css.includes('[data-theme="dark"]'), 'בלוק ערכת כהה קיים ב־CSS');
for (const tok of ['--bg', '--surface', '--glass', '--primary', '--gain', '--loss', '--on-surface']) {
  const inDark = css.split('[data-theme="dark"]')[1] || '';
  ok(inDark.includes(tok + ':'), 'טוקן ' + tok + ' מוגדר גם בערכה הכהה');
}
ok(!/text-align:\s*(left|right)/.test(css), 'אין text-align פיזי ב־CSS');
ok(css.includes('backdrop-filter'), 'אפקט זכוכית (backdrop-filter) קיים');

console.log('\nכל בדיקות הערכה עברו: ' + n + ' assertions');
