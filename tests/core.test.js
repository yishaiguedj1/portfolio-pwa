// שלב 3 בתוכנית שלוש האפליקציות (13/10/2026): core.js + strings-<אפליקציה>.js — הקוד המשותף לדפים העצמאיים.
// (1) הקבצים מעודכנים ל־app.js (tools/coregen.js --check); (2) רצים לבד, בלי app.js; (3) כל מפתח שהמודולים מבקשים קיים.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/* 1. מעודכן */
let fresh = true;
try { execFileSync(process.execPath, [path.join(root, 'tools/coregen.js'), '--check'], { stdio: 'pipe' }); } catch (e) { fresh = false; }
ok(fresh, 'core.js ו־strings-*.js מעודכנים ל־app.js (אחרת: node tools/coregen.js)');

/* 2. רץ לבד */
function boot(app, opts) {
  const o = opts || {};
  const ls = new Map(Object.entries(o.ls || {}));
  const pushes = [], listeners = {}, docListeners = {};
  const sb = {
    console, setTimeout, clearTimeout, Promise, JSON, Object, String, Date, Math,
    localStorage: { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) },
    navigator: { languages: o.langs || ['he-IL'], userActivation: { isActive: true } },
    history: { state: null, pushState(s) { pushes.push(s); this.state = s; }, go() {} },
    document: { addEventListener: (ev, f) => { docListeners[ev] = f; }, documentElement: { dataset: {} } },
    addEventListener: (ev, f) => { listeners[ev] = f; },
    confirm: () => true, alert() {},
    SNB_ENV: o.env,
  };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(read('strings-' + app + '.js') + '\n' + read('core.js') + '\n;this.__t = t; this.__api = { getLang, esc, askConfirm, askConfirmP, askAlert, flash, showItemActions, modalPush, modalDone, afterBack, backPopHandled, wireCoreBack, ibkrProxyBase, ibkrProxyHeaders };', sb);
  return { sb, pushes, listeners, docListeners };
}
for (const app of ['academy', 'studio']) {
  const { sb } = boot(app);
  ok(sb.__t('btnOk') === 'אישור' && sb.__t('btnCancel') === 'ביטול', app + ': t() בעברית כברירת מחדל');
  const en = boot(app, { ls: { pwa_lang_v1: 'en' } }).sb;
  ok(en.__t('btnCancel') === 'Cancel', app + ': אנגלית לפי pwa_lang_v1 (אותו מפתח של האפליקציה)');
  ok(boot(app, { ls: { pwa_lang_v1: 'system' }, langs: ['en-US'] }).sb.__api.getLang() === 'en', app + ': "לפי המכשיר"');
  ok(typeof sb.snbAfterBack === 'function', app + ': window.snbAfterBack קיים (הספרייה והסטודיו קוראים לו)');
  const A = sb.__api;
  ok(A.esc('<a "b">') === '&lt;a &quot;b&quot;&gt;', app + ': esc');
  let yes = 0; A.askConfirm('?', () => { yes++; });
  ok(yes === 1, app + ': askConfirm בלי DOM — נופל ל־confirm (כמו באפליקציה)');
}
const env = boot('academy', { env: { proxy: 'https://api-staging.thesnowball.app/' } }).sb.__api;
ok(env.ibkrProxyBase() === 'https://api-staging.thesnowball.app' && env.ibkrProxyHeaders()['Content-Type'] === 'application/json',
  'כתובת השרתון לפי הסביבה (SNB_ENV) + כותרות, בלי הגדרות IBKR');

/* "חזור": חלון פתוח נסגר, וההיסטוריה שקיצרנו לא מנווטת */
{
  const { sb, listeners } = boot('studio');
  const A = sb.__api;
  A.wireCoreBack();
  ok(typeof listeners.popstate === 'function', 'wireCoreBack רושם popstate');
  let closed = 0;
  const rec = A.modalPush(() => { closed++; });
  ok(rec.pushed && sb.history.state.modal === 1, 'modalPush — רשומת היסטוריה לחלון');
  sb.history.state = null;                               // "חזור" של המכשיר
  ok(A.backPopHandled() === true && closed === 1, '"חזור" סוגר את החלון ונבלע');
  ok(A.backPopHandled() === false, 'בלי חלון — לא נבלע (הדף מטפל בעצמו)');
}

/* 3. כל מפתח שמודול מבקש — קיים */
const ALL = (() => { const a = read('app.js'); const e = a.indexOf('\n};\n', a.indexOf('const STRINGS = {')); return vm.runInNewContext(a.slice(0, e + 3) + ';STRINGS'); })();
for (const [app, mods] of Object.entries(require(path.join(root, 'tools/coregen.js')).APPS)) {
  const S = vm.runInNewContext(read('strings-' + app + '.js') + ';STRINGS');
  const missing = [];   // מפתח שקיים ב־app.js וחסר כאן (מפתח שלא קיים בכלל — גם באפליקציה המאוחדת, לא עניין של הפיצול)
  for (const f of mods) for (const m of read(f).matchAll(/\b[Tt]\(\s*'([A-Za-z_]\w*)'/g)) if (ALL.he[m[1]] && !S.he[m[1]]) missing.push(f + ':' + m[1]);
  ok(missing.length === 0, app + ': כל T(\'מפתח\') במודולים קיים בקובץ המחרוזות' + (missing.length ? ' — חסר: ' + missing.slice(0, 5).join(', ') : ''));
}

/* app.js עדיין מגדיר הכל (מקור האמת) ו־index.html לא טוען את core.js */
const appSrc = read('app.js');
ok(/function backPopHandled\(/.test(appSrc) && /if \(backPopHandled\(\)\) return;/.test(appSrc), 'app.js: wireBackNav משתמש ב־backPopHandled המשותף');
ok(!/core\.js/.test(read('index.html')), 'index.html לא טוען את core.js (האתר המאוחד לא משתנה)');

console.log('# ' + n + ' בדיקות עברו');
