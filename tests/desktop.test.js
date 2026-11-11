/* תצוגת מחשב (11/11/2026, בקשת המשתמש — docs/desktop-plan.md, התקן: ת־מחשב ב־docs/standards.md):
   הפונקציות הטהורות של לוח הפקודות, ניתוב המקלדת, ההפרדה מהטלפון (כל כלל ב־desktop.css תחת html.dk / .dk-),
   החיבור בכל הדפים ובמטמון, הקורא והנגן במקלדת, ושכבות ה־z מול הסרגל.
   הרצה: node tests/desktop.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = R('app.js'), css = R('desktop.css'), lib = R('library.js'), studio = R('studio.js'), play = R('studioplay.js');
// הפונקציה עד הסוגר התואם (גם פונקציה של שורה אחת). מחרוזות/ביטויים עם סוגריים מסולסלים — לא בפונקציות שנבדקות כאן
const fn = (src, name) => {
  const i = src.indexOf('function ' + name + '('); assert(i >= 0, name);
  let j = src.indexOf('{', src.indexOf(')', i)), d = 0;
  for (; j < src.length; j++) { if (src[j] === '{') d++; else if (src[j] === '}' && --d === 0) break; }
  return src.slice(i, j + 1) + '\n';
};
const line = (re) => { const m = app.match(re); assert(m, String(re)); return m[0]; };

/* ---------- 1. הפונקציות הטהורות ---------- */
const ctx = { String, Math };
vm.createContext(ctx);
vm.runInContext([fn(app, 'deskNorm'), line(/const DESK_FIN = [^\n]*/), line(/const DESK_EN = [^\n]*/), fn(app, 'deskSwap'),
  fn(app, 'deskScore'), fn(app, 'deskMatch'), fn(app, 'deskFilter'), fn(app, 'deskKbd'), fn(app, 'deskModKey')].join('\n')
  + '\nthis.api = { deskNorm, deskSwap, deskScore, deskFilter, deskKbd, deskModKey };', ctx);
const A = ctx.api;

ok(A.deskNorm('  שָׁלוֹם  ') === A.deskNorm('שלום') && !/[\u0591-\u05C7\s]/.test(A.deskNorm(' שָׁלוֹם ')), 'נרמול: בלי ניקוד ובלי רווחים מיותרים');
ok(A.deskNorm('ת״א') === 'תא' && A.deskNorm("ג'ף") === 'גפ', 'נרמול: בלי גרשיים וגרש');
ok(A.deskNorm('מניות ךםןףץ') === 'מניות כמנפצ', 'נרמול: אותיות סופיות = רגילות (חיפוש "מני" מוצא "מניות" גם בסוף מילה)');
ok(A.deskSwap('ndh') === 'מגי' && A.deskSwap('מגי') === 'ndh', 'תיקון פריסה: אותו מקש באנגלית ↔ בעברית, לשני הכיוונים');
ok(A.deskScore('', 'X') === 1, 'שאילתה ריקה — הכל מוצג');
ok(A.deskScore('מנ', 'מניות') === 100 && A.deskScore('יות', 'מניות') === 60 && A.deskScore('מת', 'מניות') === 20 && A.deskScore('zz', 'מניות') === 0,
  'ציון: התחלה 100, בתוך 60, אותיות לפי הסדר 20, אחרת 0');
ok(A.deskScore('מעק', 'פריט', 'מעקב watchlist') === 80 && A.deskScore('watch', 'פריט', 'מעקב watchlist') === 80, 'מילות מפתח: התחלת מילה בהן = 80 (כמו מילה שנייה בתווית)');
ok(A.deskScore('nbh', 'מניות') === 99, 'הוקלד בפריסה האנגלית ("nbh" = "מני") — נמצא, ציון מעט נמוך מהתאמה ישירה');
ok(A.deskScore('ndh', 'META') === 0, 'אין התאמה בשום פריסה — 0');
const items = [{ label: 'עסקאות' }, { label: 'מניות' }, { label: 'מניה חדשה', kw: 'new' }, { label: 'פנסיה' }];
ok(A.deskFilter('מני', items).map((x) => x.label).join() === 'מניות,מניה חדשה', 'סינון: רק המתאימים, ובציון שווה — לפי הסדר המקורי');
ok(A.deskFilter('', items).length === 4, 'בלי שאילתה — כל הרשימה');
ok(A.deskKbd('mod+K', true) === '⌘K' && A.deskKbd('mod+K', false) === 'Ctrl+K', 'תווית: ⌘ במק, Ctrl בשאר');
ok(A.deskKbd('alt+1', true) === '⌥1' && A.deskKbd('shift+Space', false) === 'Shift+Space', 'תווית: Alt/⌥ ו־Shift/⇧');
ok(A.deskModKey({ metaKey: true, ctrlKey: false }, true) && !A.deskModKey({ metaKey: false, ctrlKey: true }, true), 'מק: ⌘ הוא מקש הפקודה, Ctrl לא');
ok(A.deskModKey({ metaKey: false, ctrlKey: true }, false) && !A.deskModKey({ metaKey: true, ctrlKey: false }, false), 'Windows/לינוקס: Ctrl, לא מקש החלונות');

/* ---------- 2. ניתוב המקלדת (deskKey) — עם תחליפים ---------- */
function keyCtx(over) {
  const log = [];
  const c = Object.assign({
    log, _desk: { pal: null, help: null },
    deskIsMac: () => false, deskModKey: (e, mac) => (mac ? !!e.metaKey && !e.ctrlKey : !!e.ctrlKey && !e.metaKey),
    deskPalette: () => log.push('pal'), deskPalClose: () => log.push('close'), deskSettings: () => log.push('set'), deskHelp: () => log.push('help'),
    deskPages: () => [{ k: 'a' }, { k: 'b' }], deskGo: (p) => log.push('go:' + p.k), deskBusy: () => false, deskTyping: (el) => !!(el && el.typing),
    deskK1: () => true, deskStandalone: () => false, deskSearchField: () => ({ focus: () => log.push('focus'), select() {} }),
  }, over || {});
  vm.createContext(c);
  vm.runInContext(fn(app, 'deskKey') + '\nthis.deskKey = deskKey;', c);
  return c;
}
const ev = (o) => Object.assign({ defaultPrevented: false, isComposing: false, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, key: '', code: '', target: null, preventDefault() { this.defaultPrevented = true; } }, o);
let K = keyCtx();
K.deskKey(ev({ ctrlKey: true, code: 'KeyK', key: 'ל' }));
ok(K.log.join() === 'pal', 'Ctrl+K לפי המקש הפיזי — גם כשבמקלדת העברית e.key הוא "ל"');
K = keyCtx({ _desk: { pal: {}, help: null } }); K.deskKey(ev({ ctrlKey: true, code: 'KeyK' }));
ok(K.log.join() === 'close', 'Ctrl+K כשהלוח פתוח — סוגר אותו');
K = keyCtx(); K.deskKey(ev({ ctrlKey: true, code: 'Comma' }));
ok(K.log.join() === 'set', 'Ctrl+, — הגדרות');
K = keyCtx(); K.deskKey(ev({ altKey: true, code: 'Digit2', key: '™' }));
ok(K.log.join() === 'go:b', 'Alt+2 — העמוד השני (לפי code; במק ⌥2 נותן תו אחר)');
K = keyCtx(); K.deskKey(ev({ ctrlKey: true, code: 'Digit1' }));
ok(K.log.join() === '', 'Ctrl+1 בלשונית רגילה — נשאר של הדפדפן (מעבר ללשונית)');
K = keyCtx({ deskStandalone: () => true }); K.deskKey(ev({ ctrlKey: true, code: 'Digit1' }));
ok(K.log.join() === 'go:a', 'Ctrl+1 בחלון מותקן — העמוד הראשון (שם הדפדפן לא שומר אותו)');
K = keyCtx(); K.deskKey(ev({ code: 'Slash', key: '/' }));
ok(K.log.join() === 'focus', '/ — לשדה החיפוש של העמוד');
K = keyCtx(); K.deskKey(ev({ code: 'Slash', key: '?', shiftKey: true }));
ok(K.log.join() === 'help', '? — חלון הקיצורים');
K = keyCtx({ deskK1: () => false }); K.deskKey(ev({ code: 'Slash', key: '/' })); K.deskKey(ev({ code: 'Slash', key: '?', shiftKey: true }));
ok(K.log.join() === '', 'קיצורים של מקש אחד כבויים — / ו־? לא עושים כלום (WCAG 2.1.4)');
K = keyCtx({ deskK1: () => false }); K.deskKey(ev({ ctrlKey: true, code: 'KeyK' }));
ok(K.log.join() === 'pal', 'הכיבוי לא נוגע בקיצורים עם מקש עזר');
K = keyCtx(); K.deskKey(ev({ code: 'Slash', key: '/', target: { typing: true } }));
ok(K.log.join() === '', 'בשדה טקסט — / נשאר תו רגיל');
K = keyCtx({ deskBusy: () => true }); K.deskKey(ev({ altKey: true, code: 'Digit1' })); K.deskKey(ev({ code: 'Slash' }));
ok(K.log.join() === '', 'קורא / נגן מלא / חלון פתוח — המקשים שלהם, לא שלנו');
K = keyCtx(); K.deskKey(ev({ ctrlKey: true, code: 'KeyK', defaultPrevented: true }));
ok(K.log.join() === '', 'אירוע שכבר טופל — לא נוגעים');

/* ---------- 3. ההפרדה מהטלפון: כל כלל ב־desktop.css שייך למחשב ---------- */
const bare = css.replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/@layer/.test(bare), 'desktop.css מחוץ ל־@layer (ה־CSS של האפליקציות לא בשכבות — שכבה הייתה מפסידה)');
const sels = [];
(function walk(src) {
  let i = 0;
  while (i < src.length) {
    const o = src.indexOf('{', i); if (o < 0) break;
    const head = src.slice(i, o).trim();
    let d = 1, j = o + 1;
    while (j < src.length && d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; }
    const body = src.slice(o + 1, j - 1);
    if (head.startsWith('@media') || head.startsWith('@supports')) walk(body);
    else if (!head.startsWith('@')) {   // פסיק ברמה העליונה בלבד — לא בתוך :is(…)
      let dd = 0, cur = '';
      for (const ch of head) { if (ch === '(') dd++; else if (ch === ')') dd--; if (ch === ',' && !dd) { sels.push(cur.trim()); cur = ''; } else cur += ch; }
      if (cur.trim()) sels.push(cur.trim());
    }
    i = j;
  }
})(bare);
ok(sels.length > 60, 'נמצאו הכללים (' + sels.length + ')');
const stray = sels.filter((s) => !/html\.dk\b|\.dk-/.test(s));
ok(stray.length === 0, 'כל בורר מוגבל ל־html.dk או לרכיב .dk- — אף כלל לא חל על הטלפון' + (stray.length ? ': ' + stray.slice(0, 5).join(' | ') : ''));
ok(/html\.dk nav\.tabs \{ display: none !important; \}/.test(css), 'החוגה מוסתרת רק במחשב');
ok(/html\.dk body \{ padding-inline-start: var\(--dk-off\); \}/.test(css), 'התוכן זז מצד ההתחלה (לוגי — ימין בעברית, שמאל באנגלית)');
ok(!/(?:^|[;{\s])(?:margin|padding)-(?:left|right)\s*:|(?:^|[;{\s])(?:left|right)\s*:/m.test(bare.replace(/inset-inline[^;]*;/g, '')), 'רק כיוונים לוגיים (start/end), בלי left/right');
ok(/@media \(any-pointer: coarse\)/.test(css) && /@media \(pointer: coarse\)/.test(css), 'מידות לפי הקלט: מחשב מגע וטאבלט');
ok(/prefers-contrast: more/.test(css) && /forced-colors: active/.test(css) && /prefers-reduced-motion: reduce/.test(css) && /prefers-reduced-transparency/.test(css),
  'נגישות: ניגודיות גבוהה, צבעים כפויים, תנועה ושקיפות מופחתות');
ok(/:focus-visible \{ outline: 2px solid var\(--dk-ring\); outline-offset: 2px; \}/.test(css), 'טבעת פוקוס: outline של 2px (לא צל — נעלם בצבעים כפויים), רק ב־:focus-visible');
const dkRow = +((css.match(/--dk-row: (\d+)px;[^\n]*עכבר|--dk-row: (\d+)px;/) || [])[1] || 0);
ok(dkRow >= 36, 'שורה בסרגל ≥36 גם בעכבר — ב־Mac עם מסך מגע האצבע נראית לדף כמו עכבר (מחקר 02)');

/* ---------- 4. שכבות: הסרגל מתחת לשכבות האפליקציה, השכבות מתחילות אחריו ---------- */
const zSide = +(css.match(/\.dk-side \{[^}]*z-index: (\d+)/) || [])[1];
ok(zSide === 899, 'הסרגל ב־z 899 — מתחת ל־.lib-root/.st-root (900)');
ok(/html\.dk :is\(\.lib-root, \.st-root\) \{ inset-inline-start: var\(--dk-off\); \}/.test(css), 'Academy/Studio: השכבה מתחילה אחרי הסרגל — הקורא, הגיליונות והנגן המלא שבתוכה מכסים גם אותו');
ok(/html\.dk \.dlg-veil \{ z-index: 1003; \}/.test(css) && /html\.dk \.pf-sheet-veil \{ z-index: 960;/.test(css) && /html\.dk \.login-overlay \{ z-index: 1002; \}/.test(css),
  'Invest: דיאלוג, גיליון והתחברות מעל הסרגל');
const zAdm = +(css.match(/html\.dk \.adm-side \{[^}]*z-index: (\d+)/) || [])[1];
ok(zAdm === 899, 'מרכז הניהול: אותו סרגל באותה שכבה');

/* ---------- 5. חיבור: כל הדפים, המטמון, הליבה, כפתורי הזכוכית ---------- */
for (const [page, after] of [['index.html', 'glass-btn.css'], ['academy.html', 'library.css'], ['studio.html', 'studio.css'], ['admin.html', 'admin.css'], ['cashflow.html', 'cashflow.css']]) {
  const h = R(page), a = h.indexOf('href="' + after + '"'), d = h.indexOf('<link rel="stylesheet" href="desktop.css" media="(min-width: 600px)">');
  ok(a > 0 && d > a, page + ': desktop.css אחרי ' + after + ', עם media (בטלפון לא חוסם ציור)');
}
const sw = R('sw.js');
for (const list of ['APP_SHELL', 'LIB_SHELL', 'STUDIO_SHELL', 'FLOW_SHELL']) {
  const m = sw.match(new RegExp('const ' + list + ' = \\[[\\s\\S]*?\\];'));
  ok(m && m[0].includes("'./desktop.css'"), 'sw.js: desktop.css ב־' + list);
}
const core = R('core.js');
ok(/function deskInit\(/.test(core) && /function deskKey\(/.test(core) && /function cubeDesk\(/.test(core), 'המודול בליבה — מגיע לכל האפליקציות (core.js נוצר מ־app.js)');
const coreRegion = app.slice(app.lastIndexOf('/* <core> */', app.indexOf('const DESK_MIN')), app.indexOf('/* </core> */', app.indexOf('const DESK_MIN')));
ok(coreRegion.includes('function deskInit(') && coreRegion.includes('const DESK_MIN = 1024'), 'ב־app.js — בתוך אזור <core>');
const gb = R('glass-btn.css');
const ex = (gb.match(/\/\* @glass-exempt([\s\S]*?)\*\//) || [, ''])[1];
ok(['dk-item', 'dk-help-x', 'dk-sw'].every((c) => new RegExp('\\b' + c + '\\b').test(ex)), 'כפתורי המחשב ברשימת הפטורים של כפתורי הזכוכית (שורות, מתג, סגירה)');
for (const k of ['dkSideAria', 'dkFind', 'dkPalPh', 'dkPalNone', 'dkKeysTitle', 'dkKeys1', 'dkCmdLang', 'dkKeyPagePrev', 'dkKeyFull']) {
  ok(new RegExp('\\n  ' + k + ': "').test(app.slice(0, app.indexOf('\nen: {'))) && new RegExp('\\n  ' + k + ': "').test(app.slice(app.indexOf('\nen: {'))), 'מחרוזת ' + k + ' בעברית ובאנגלית');
}
ok(/sub: \(\) => t\('appInvestSub'\)/.test(app) && !/menuInvestSub/.test(app), 'האפליקציות בסרגל — מפתחות שקיימים בטבלה');

/* ---------- 6. הקובייה כבויה במחשב (אין גרירת עמודים בעכבר) ---------- */
ok(/function cubeDesk\(\)/.test(app) && /cubeDesk\(\)/.test(fn(app, 'tabCubeOk')), 'Invest: מעבר עמוד במחשב — בלי קובייה');
ok(/cubeDesk/.test(lib) && /cubeDesk/.test(studio), 'Academy ו־Studio: אותו שער');

/* ---------- 7. מקלדת בקורא ובנגן ---------- */
const rk = fn(lib, 'readerKey');
ok(/ArrowLeft'[^:]*\? \(\) => v\.goLeft\(\)/.test(rk) && /ArrowRight'[^:]*\? \(\) => v\.goRight\(\)/.test(rk), 'קורא: ← → לפי כיוון הספר (goLeft/goRight — בספר עברי ← = הבא)');
ok(/PageDown/.test(rk) && /PageUp/.test(rk) && /e\.shiftKey/.test(rk), 'קורא: רווח/PageDown קדימה, Shift+רווח/PageUp אחורה');
ok(/\.lib-veil, \.dlg-veil, \.dk-veil/.test(rk) && /isContentEditable/.test(rk), 'קורא: לא כשגיליון/חלון פתוח ולא כשמקלידים');
ok(/else readerKey\(e\)/.test(fn(lib, 'wireDoc')), 'קורא: גם כשהפוקוס בתוך הספר (ה־iframe)');
ok(/c === 'KeyK'/.test(play) && /c === 'KeyF'/.test(play) && /removeEventListener\('keydown', deskKeys\)/.test(play), 'נגן: K/F לפי המקש הפיזי, והמאזין יורד ב־destroy');
ok(/!deskK1\(\)/.test(play), 'נגן: K/F נכבים עם שאר הקיצורים של מקש אחד');
ok(/p\.dataset\.v = ui\.view;/.test(studio) && /\.st-page\[data-v\]/.test(css), 'Studio: רוחב הדף לפי סוגו (טפסים ופרטים בעמודת קריאה)');

console.log('\n' + n + ' בדיקות עברו');
