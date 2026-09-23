/* בדיקות כיסוי i18n ל־v28: כל מפתח בשימוש קיים בעברית ובאנגלית, והמילונים סימטריים.
   הרצה: node tests/i18n-coverage.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

let n = 0;
const ok = (cond, name) => { n++; assert(cond, name); console.log('ok -', name); };

const root = path.join(__dirname, '..');
const appSrc = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const cloudSrc = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

/* ---------- sandbox (מינימלי — רק מה שמנוע ה־i18n צריך) ---------- */
const store = {};
const localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
function elStub() {
  return {
    value: '', textContent: '', innerHTML: '', placeholder: '', title: '',
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, appendChild() {}, dataset: {}, style: {},
    setAttribute() {}, disabled: false,
  };
}
const els = {};
const docEl = { lang: '', dir: '' };
const document = {
  addEventListener() {},
  getElementById: (id) => (els[id] || (els[id] = elStub())),
  querySelectorAll: () => [],
  createElement: () => elStub(),
  documentElement: docEl,
  title: '',
};
const sandbox = {
  localStorage, document,
  window: {}, navigator: {}, location: { reload() {} },
  setTimeout, clearTimeout, confirm: () => true, console,
};
vm.createContext(sandbox);
vm.runInContext(
  appSrc + '\n;globalThis.__i18n = { STRINGS, t, getLang, setLang, applyI18n, LS_LANG };',
  sandbox, { filename: 'app.js' });
const I = sandbox.__i18n;
ok(!!I && !!I.STRINGS, 'מנוע ה־i18n נטען');

const { STRINGS, t, getLang, setLang, applyI18n } = I;
const heKeys = new Set(Object.keys(STRINGS.he));
const enKeys = new Set(Object.keys(STRINGS.en));

/* ---------- 1. סימטריה בין השפות ---------- */
const onlyHe = [...heKeys].filter((k) => !enKeys.has(k));
const onlyEn = [...enKeys].filter((k) => !heKeys.has(k));
ok(onlyHe.length === 0, 'אין מפתח חסר באנגלית' + (onlyHe.length ? ': ' + onlyHe.join(',') : ''));
ok(onlyEn.length === 0, 'אין מפתח חסר בעברית' + (onlyEn.length ? ': ' + onlyEn.join(',') : ''));
ok(heKeys.size > 150, 'המילון לא ריק (' + heKeys.size + ' מפתחות)');

/* ערכים לא ריקים */
for (const k of heKeys) {
  ok(typeof STRINGS.he[k] === 'string' && STRINGS.he[k].length > 0, 'ערך עברי לא ריק: ' + k);
  ok(typeof STRINGS.en[k] === 'string' && STRINGS.en[k].length > 0, 'ערך אנגלי לא ריק: ' + k);
}

/* ---------- 2. מפתחות מ־HTML ---------- */
const htmlKeys = new Set();
for (const m of html.matchAll(/data-i18n(?:-html|-ph|-aria|-title)?="([^"]+)"/g)) htmlKeys.add(m[1]);
ok(htmlKeys.size > 40, 'נמצאו תגיות i18n ב־HTML (' + htmlKeys.size + ')');
const htmlMissing = [...htmlKeys].filter((k) => !heKeys.has(k) || !enKeys.has(k));
ok(htmlMissing.length === 0, 'כל מפתחות ה־HTML קיימים בשתי השפות' + (htmlMissing.length ? ': ' + htmlMissing.join(',') : ''));

/* ---------- 3. מפתחות מקריאות t('...') ---------- */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}
function tKeys(src, name) {
  src = stripComments(src);
  const keys = new Set();
  for (const m of src.matchAll(/(^|[^a-zA-Z0-9_$])t\(\s*['"]([A-Za-z0-9_]+)['"]/gm)) keys.add(m[2]);
  // קריאות דינמיות t(x) אסורות — כל מפתח חייב להיות מילולי
  // (מדלגים על מנוע ה־i18n עצמו: function t(key, vars) ו־t(el.dataset...))
  const dyn = [];
  for (const m of src.matchAll(/(^|[^a-zA-Z0-9_$])t\(\s*([^'"\s)][^,)]*)/gm)) {
    const lineStart = src.lastIndexOf('\n', m.index) + 1;
    const line = src.slice(lineStart, src.indexOf('\n', m.index));
    if (/function t\(|dataset\.|getLang\(\)/.test(line)) continue;
    if (/t\(label\)/.test(line)) continue; // RANGES: המפתח מילולי במערך, t() ברינדור
    dyn.push(m[2].trim().slice(0, 20));
  }
  ok(dyn.length === 0, 'אין קריאות t() דינמיות ב־' + name + (dyn.length ? ': ' + dyn.join(',') : ''));
  // מפתחות טווחי הגרף חיים במערכי RANGES/PF_RANGES כמחרוזות מילוליות
  for (const m of src.matchAll(/\['[a-z0-9]+',\s*'([A-Za-z0-9_]+)'\]/g)) keys.add(m[1]);
  return keys;
}
const jsKeys = new Set([...tKeys(appSrc, 'app.js'), ...tKeys(cloudSrc, 'cloud.js')]);
ok(jsKeys.size > 60, 'נמצאו קריאות t() בקוד (' + jsKeys.size + ')');
const jsMissing = [...jsKeys].filter((k) => !heKeys.has(k) || !enKeys.has(k));
ok(jsMissing.length === 0, 'כל מפתחות ה־t() קיימים בשתי השפות' + (jsMissing.length ? ': ' + jsMissing.join(',') : ''));

/* ---------- 4. התנהגות ---------- */
Object.keys(store).forEach((k) => delete store[k]);
// מנטרלים רינדורים כבדים — כאן נבדקת מכניקת השפה, לא הציור
vm.runInContext('renderAll = undefined; renderIbkrCard = undefined; renderTdKeyStatus = undefined; updateSourceLabel = undefined;', sandbox);
ok(getLang() === 'he', 'ברירת מחדל: עברית');
ok(t('appTitle') === 'תיק ההשקעות', 't() בעברית');
ok(t('todayChg', { v: '+1.5%' }) === 'היום +1.5%', 'אינטרפולציה בעברית');
setLang('en');
ok(store[I.LS_LANG] === 'en', 'השפה נשמרת ב־localStorage');
ok(t('appTitle') === 'Portfolio', 't() באנגלית');
ok(t('todayChg', { v: '+1.5%' }) === 'Today +1.5%', 'אינטרפולציה באנגלית');
applyI18n();
ok(docEl.lang === 'en' && docEl.dir === 'ltr', 'dir/lang מתחלפים לאנגלית');
setLang('he');
applyI18n();
ok(docEl.lang === 'he' && docEl.dir === 'rtl', 'dir/lang חוזרים לעברית');
ok(t('noSuchKey_xyz') === 'noSuchKey_xyz', 'מפתח חסר מחזיר את המפתח עצמו');

/* ---------- 5. אזהרות על מפתחות לא מנוצלים (לא נכשל) ---------- */
const used = new Set([...htmlKeys, ...jsKeys]);
const unused = [...heKeys].filter((k) => !used.has(k));
if (unused.length) console.log('warn - מפתחות לא מנוצלים (' + unused.length + '): ' + unused.join(', '));

console.log('\nכל בדיקות ה־i18n עברו: ' + n + ' assertions');
