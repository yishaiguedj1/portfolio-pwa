// v322: מעברים חלקים — שכבת View Transitions בספרייה, גיליון עם רשומת היסטוריה, "חזור" סוגר חלונות באפליקציה (modalPush/modalDone),
// pushState אחרי history.back() נדחה עד שה־back נחת (afterBack). כולל סימולציה של ההיסטוריה למחסנית החלונות.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0, j = src.indexOf('{', i); for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}' && !--d) return src.slice(i, k + 1); } return ''; };

/* ---------- ספרייה: מעברים ---------- */
ok(/function libTransition\(kind, update\)/.test(lib) && /document\.startViewTransition\(run\)/.test(lib) && /dataset\.libVt = kind/.test(lib), 'libTransition — View Transitions עם סוג המעבר על <html> (data-lib-vt)');
ok(/reduceMotion\(\)/.test(fn(lib, 'libTransition')) && /document\.hidden/.test(fn(lib, 'libTransition')), 'בלי אנימציה ב־reduced-motion ובכרטיסייה מוסתרת');
ok(/function renderHome\(kind\) \{ return libTransition\(kind \|\| 'none', renderHomeNow\); \}/.test(lib) && /async function renderHomeNow\(\)/.test(lib), 'renderHome = עטיפה; הציור עצמו ב־renderHomeNow');
ok(/function navigateTo\(kind, y\)[\s\S]{0,200}await renderHomeNow\(\); pinScroll\(y \|\| 0\);/.test(lib), 'הגלילה נקבעת בתוך המעבר, אחרי הבנייה (לא לפני — הדף הישן קפץ לראש לפריים)');
const goView = fn(lib, 'goView');
ok(/navigateTo\('push', 0\)/.test(goView) && !/root\.scrollTop = 0/.test(goView) && /afterBack\(\(\) => history\.pushState/.test(goView), 'goView: מעבר push, בלי איפוס גלילה ישיר, pushState דרך afterBack');
const pop = fn(lib, 'onPop');
ok(/navigateTo\('pop', savedLibScroll\(\)\)/.test(pop), '"חזור" = מעבר pop + הגלילה השמורה של הדף שחוזרים אליו');
ok(/navigateTo\('fade', 0\)/.test(lib) && /renderHome\('fade'\)/.test(lib), 'צ\'יפים / בורר ספרייה / מיון — הצלבה');
ok(!/pushState/.test(pop), 'עדיין אין pushState בתוך popstate (v321)');
const cr = fn(lib, 'closeReader');
ok(/box\.classList\.add\('out'\);/.test(cr) && /await renderHomeNow\(\); pinScroll\(savedLibScroll\(\)\); await gone;/.test(cr) && !/\brenderHome\(\)/.test(cr) && (cr.match(/view\.close\(\)/g) || []).length === 1 && cr.indexOf('view.close()') > cr.indexOf('await gone'), 'סגירת הקורא — הקורא דוהה (CSS על האלמנט — צילום VT לא כולל iframe), הדף מתחתיו מצויר לפני, עם הגלילה השמורה, המנוע נסגר בסוף');
ok(/\.rd\.out \{ animation: rdOut/.test(css) && !/reader-out/.test(css), 'CSS: .rd.out; אין יותר מעבר reader-out ב־VT');
ok(/'rd loading' \+ \(opt && opt\.restored \? ' restored' : ''\)/.test(lib) && /root\.classList\.add\('restored'\)/.test(lib) && /\.rd\.restored \{ animation: none; \}/.test(css) && /\.lib-root\.restored \{ animation: none; \}/.test(css), 'שחזור אחרי רענון — בלי אנימציות כניסה');
ok(/function curtainDown\(\) \{[\s\S]{0,300}classList\.remove\('lib-restoring'\)[\s\S]{0,200}classList\.remove\('lib-curtain'\)/.test(lib) && (lib.match(/curtainDown\(\)/g) || []).length >= 4, 'הווילון יורד כשהדף/העמוד הראשון מוכן (ודוהה)');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const scss = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
ok(/if\(h&&h\.lib\)\{var e=document\.documentElement;e\.classList\.add\('lib-open','lib-curtain','lib-restoring'\);/.test(html) && /h\.lib>=2[^\n]*pwa_reader_v1[^\n]*--curtain/.test(html), 'index.html: וילון לפני הציור הראשון ברענון בתוך הספרייה; בקורא — בצבע דף הקורא');
ok(/html\.lib-curtain body::after \{[^}]*z-index: 910[^}]*var\(--curtain, var\(--bg\)\)/.test(scss) && /html\.lib-restoring body::after \{ opacity: 1/.test(scss), 'styles.css: הווילון מעל הספרייה (900) ומתחת לקורא (920)');
ok(/setTimeout\(down, 6000\);/.test(app) && /catch\(\(\) => \{ down\(\); document\.documentElement\.classList\.remove\('lib-open'\); \}\)/.test(app), 'app.js: הווילון יורד בכל מקרה אחרי 6 שניות או בכשל טעינת הספרייה');
ok(/async function openReader\(id, opt\) \{\s+saveLibScroll\(\);/.test(lib), 'פתיחת ספר שומרת את הגלילה של הדף שמתחת');
ok(/h\('div', 'rd loading' \+/.test(lib) && /box\.classList\.remove\('loading'\)/.test(lib), 'הקורא נפתח במצב טעינה עד העמוד הראשון');
ok(/function pinScroll\(y\)/.test(lib) && /touchstart/.test(fn(lib, 'pinScroll')) && /scrollHeight - r\.clientHeight >= y/.test(fn(lib, 'pinScroll')), 'pinScroll — חוזר ליעד כשהדף מתארך אחרי הציור, נגיעה מבטלת');
ok(/function closeLibrary\(\)/.test(lib) && /classList\.add\('leaving'\)/.test(fn(lib, 'closeLibrary')) && /closeLibrary\(\)/.test(pop), 'יציאה מהספרייה בתנועה (leaving), לא היעלמות');
// CSS
ok(/\.lib-root \{[^}]*view-transition-name: lib-root/.test(css), 'שם View Transition: lib-root');
['push', 'pop', 'fade'].forEach((k) => ok(new RegExp('html\\[data-lib-vt="' + k + '"\\]::view-transition-(old|new)\\(lib-root\\)').test(css), 'CSS למעבר ' + k));
ok(/html\[dir="rtl"\] \{ --vt-x: -100%; \}/.test(css) && /translateX\(var\(--vt-x\)\)/.test(css), 'כיוון המעבר הפוך ב־RTL');
ok(/html\[data-lib-vt\]::view-transition-group\(root\) \{ animation: none; \}/.test(css), 'השורש (האפליקציה מתחת) לא מונפש');
ok(/\.lib-veil\.out \{/.test(css) && /\.lib-veil\.out \.lib-sheet \{/.test(css), 'גיליון נסגר בתנועה (out)');
ok(/\.rd\.loading foliate-view \{ opacity: 0; \}/.test(css) && /\.rd\.loading::before/.test(css), 'מצב טעינה בקורא — סימן טעינה, לא מלבן ריק');
ok(/prefers-reduced-motion: reduce\) \{ \.lib-root, \.lib-root\.leaving, \.rd \{ animation: none !important; \}/.test(css), 'reduced-motion — בלי אנימציות כניסה/יציאה');

/* ---------- ספרייה: גיליון עם רשומת היסטוריה ---------- */
const sheet = fn(lib, 'sheet');
ok(/root\.append\(veil\);[\s\S]{0,400}afterBack\(\(\) => \{[^\n]*history\.pushState\(Object\.assign\(\{\}, st0, \{ sheet: \(st0\.sheet \|\| 0\) \+ 1 \}\)/.test(sheet) && /if \(!\(ua && !ua\.isActive\)\) afterBack/.test(sheet), 'sheet(): רשומת היסטוריה {sheet:n} אחרי הצירוף ל־DOM, רק עם הפעלת משתמש');
ok(/if \(pushed && history\.state && history\.state\.sheet\) \{ sheetSkip\+\+;[^\n]*history\.back\(\); \}/.test(sheet), 'סגירה תוכנתית = history.back() שנבלע (sheetSkip)');
ok(/if \(sheetSkip > 0\) \{ sheetSkip--;/.test(pop) && /if \(veils\.length > \(st\.sheet \|\| 0\)\) \{[\s\S]{0,200}const v = veils\[veils\.length - 1\]; const own = !!v\._pushed; \(v\._close/.test(pop), 'onPop: "חזור" סוגר את הגיליון העליון, ה־back שלנו נבלע');
ok(/if \(ds\.modalPop \|\| ds\.navSkip\) return;/.test(pop) && /dataset\.navSkip = '1';/.test(app) && /dataset\.modalPop = '1';/.test(app), 'onPop: חלון של האפליקציה שנסגר ב"חזור" או ב־back שלה — הספרייה לא מנווטת (modalPop/navSkip)');
ok(/function closeSheetThen\(veil, fn\)/.test(lib), 'closeSheetThen — פתיחת הבא רק אחרי שה־back של הגיליון נחת');
ok(!/close\(\); goView\(/.test(lib) && !/close\(\); collNameSheet\(/.test(lib) && !/close\(\); openResetSheet\(\)/.test(lib) && !/close\(\); collDelete\(/.test(lib), 'אין "close(); X()" שדוחף רשומה בזמן ש־back בדרך');
ok(/const afterBack = \(fn\) => \(typeof window !== 'undefined' && typeof window\.snbAfterBack === 'function'\) \? window\.snbAfterBack\(fn\) : fn\(\);/.test(lib), 'afterBack בספרייה דרך window.snbAfterBack של האפליקציה');
ok(/if \(!restore\) afterBack\(\(\) => history\.pushState\(Object\.assign\(\{\}, history\.state \|\| \{\}, \{ lib: 1 \}\), ''\)\);/.test(lib), 'פתיחת הספרייה מהתפריט — pushState אחרי שסגירת התפריט נחתה');
ok(/h\('button', 'lib-bkrow'\)/.test(lib) && !/'lib-bkrow lib-hide-q'/.test(lib), 'שורת הגיבוי (מעל שדה החיפוש) לא מוסתרת בחיפוש — השדה לא זז מתחת לאצבע');

/* ---------- אפליקציה: "חזור" סוגר חלונות ---------- */
ok(/if \(typeof window !== 'undefined'\) window\.snbAfterBack = afterBack;/.test(app), 'window.snbAfterBack חשוף לספרייה');
ok(/function navSync\(name, opts\) \{[\s\S]{0,200}afterBack\(\(\) => \{/.test(app) && /else if \(target < cur\) navBack\(target - cur\);/.test(app), 'navSync — דרך afterBack ו־navBack');
ok(/_menuModal = modalPush\(\(\) => setMainMenuOpen\(false\)\)/.test(app), 'תפריט ההמבורגר');
ok(/_resetModal = modalPush\(closeResetSheet\)/.test(app) && /if \(_resetModal\) \{ const m = _resetModal; _resetModal = null; modalDone\(m\); \}/.test(app), 'גיליון האיפוס');
ok(/veil\._modal = modalPush\(closeWlSheet\)/.test(app) && /if \(v\._modal\) modalDone\(v\._modal\)/.test(app), 'גיליון שם רשימת מעקב');
ok(/veil\._modal = modalPush\(closeEarnCalSheet\)/.test(app), 'גיליון הדוח');
ok(/const dlgModal = modalPush\(\(\) => done\(false\)\);/.test(app) && /modalDone\(dlgModal\);/.test(app), 'askConfirm/askAlert');
ok((app.match(/wrap\._modal = modalPush\(\(\) => closeSrcPops\(\)\)/g) || []).length === 2 && /if \(w\._modal\) \{ const m = w\._modal; w\._modal = null; modalDone\(m\); \}/.test(app), 'בועת הסינון + תפריט הרשימות');
ok(/modal: modalPush\(clearItemActions\)/.test(app) && /if \(a\.modal\) modalDone\(a\.modal\);/.test(app), 'כפתורי לחיצה ארוכה');

/* ---------- סימולציה: היסטוריה מדומה עם back אסינכרוני ---------- */
function makeHistory() {
  const entries = [{ snb: 0 }]; let idx = 0; const q = []; const ls = [];
  const h = {
    get state() { return entries[idx]; }, get length() { return entries.length; },
    pushState(st) { entries.splice(idx + 1); entries.push(st); idx = entries.length - 1; },
    replaceState(st) { entries[idx] = st; },
    go(d) { q.push(d); }, back() { q.push(-1); },
    flush() { while (q.length) { const d = q.shift(); const t = Math.max(0, Math.min(entries.length - 1, idx + d)); if (t === idx) continue; idx = t; ls.forEach((f) => f()); } },
    on(f) { ls.push(f); }, entries, cur: () => idx,
  };
  return h;
}
const H = makeHistory();
const timers = [];
const sb = {
  history: H, console,
  window: { addEventListener: (ev, f) => { if (ev === 'popstate') H.on(f); } },
  document: { documentElement: { dataset: {} } },
  setTimeout: (f) => { timers.push(f); return 1; },
  currentTabName: () => 'overview', navTabForDepth: (d) => d ? 'settings' : 'overview', navDepth: () => 0, switchTab: () => {},
};
vm.createContext(sb);
const slice = app.slice(app.indexOf('let _navSkipPop = 0;'), app.indexOf('function switchTab(name, opts)'));
vm.runInContext(slice + '\nwireBackNav(); this.modalPush = modalPush; this.modalDone = modalDone; this.afterBack = afterBack; this.navBack = navBack; this._modals = _modals;', sb);
let closed = 0;
// 1) פתיחה → "חזור" של המכשיר סוגר, בלי back נוסף
const m1 = sb.modalPush(() => { closed++; sb.modalDone(m1); });
ok(H.state.modal === 1 && H.length === 2, 'פתיחת חלון = רשומה {modal:1}');
H.go(-1); H.flush(); timers.splice(0).forEach((f) => f());
ok(closed === 1 && sb._modals.length === 0 && H.cur() === 0 && H.state.modal === undefined, '"חזור" סוגר את החלון ונוחת על הרשומה שלפניו');
ok(!sb.document.documentElement.dataset.modalPop, 'דגל modalPop מנוקה אחרי הסגירה');
// 2) סגירה תוכנתית → back שלנו נבלע; pushState שבא מיד אחריו (מעבר טאב) מחכה ל־back
const m2 = sb.modalPush(() => sb.modalDone(m2));
sb.modalDone(m2);
let pushed = false;
sb.afterBack(() => { pushed = true; H.pushState({ snb: 1 }); });
ok(!pushed && H.state.modal === 1, 'pushState אחרי סגירה — נדחה עד שה־back נחת');
H.flush();
ok(pushed && H.cur() === 1 && H.state.snb === 1 && H.length === 2 && H.entries[0].modal === undefined, 'אחרי הנחיתה: הרשומה החדשה מחליפה את רשומת החלון (לא נערמת אחריה)');
// 3) "חזור" על הרשומה החדשה — אין חלון פתוח, לא קוראים לסגירה
H.go(-1); H.flush();
ok(closed === 1 && sb._modals.length === 0, 'בלי חלון פתוח — "חזור" רגיל');
// 4) חלון שנפתח בזמן ש־back בדרך — הרשומה שלו נדחפת רק אחרי הנחיתה
H.pushState({ snb: 1 });
const m3 = sb.modalPush(() => sb.modalDone(m3)); sb.modalDone(m3);
const m4 = sb.modalPush(() => sb.modalDone(m4));
ok(H.state.modal === 1 && !m4.pushed, 'חלון חדש בזמן ש־back בדרך — ממתין');
H.flush();
ok(m4.pushed && H.state.modal === 1 && H.length === 3 && H.entries[1].snb === 1, 'אחרי הנחיתה — רשומת החלון החדש מעל הרשומה הנכונה');
console.log('# ' + n + ' בדיקות עברו');
