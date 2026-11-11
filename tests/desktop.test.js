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
ok(A.deskKbd('ctrl+alt+1', false) === 'Ctrl+Alt+1' && A.deskKbd('ctrl+alt+1', true) === '⌃⌥1', 'תווית: Ctrl+Alt / ⌃⌥');
{
  const c = {}; vm.createContext(c); vm.runInContext(fn(app, 'deskOS') + fn(app, 'deskPageMod') + '\nthis.deskOS = deskOS; this.deskPageMod = deskPageMod;', c);
  const O = (ud, np, ua) => c.deskOS({ userAgentData: ud ? { platform: ud } : undefined, platform: np, userAgent: ua || '' });
  ok(O('macOS', 'MacIntel') === 'mac' && O(null, 'MacIntel', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit Safari') === 'mac', 'מק (Chrome ו־Safari)');
  ok(O(null, 'MacIntel', 'Mozilla/5.0 (iPad; CPU OS 18_0) AppleWebKit') === 'mac' && O(null, 'iPhone', 'iPhone') === 'mac', 'iPad עם מקלדת / אייפון — ⌘');
  ok(O('Windows', 'Win32') === 'win' && O(null, 'Win32', 'Windows NT 10.0') === 'win', 'Windows (Chrome/Edge ו־Firefox)');
  ok(O('Chrome OS', 'Linux x86_64', 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)') === 'cros', 'ChromeOS');
  ok(O('Android', 'Linux x86_64', 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0)') === 'gbook', 'Googlebook: ה־UA של ChromeOS, ‏platform "Android"');
  ok(O(null, 'Linux x86_64', 'Mozilla/5.0 (X11; Linux x86_64) Firefox/140.0') === 'linux' && O('Linux', 'Linux x86_64', 'X11; Linux x86_64') === 'linux', 'Linux (וגם אנדרואיד שמבקש אתר מחשב)');
  ok(c.deskPageMod('mac', false) === 'alt' && c.deskPageMod('win', false) === 'alt' && c.deskPageMod('cros', false) === 'ctrl+alt'
    && c.deskPageMod('gbook', false) === 'ctrl+alt' && c.deskPageMod('linux', false) === 'ctrl+alt' && c.deskPageMod('cros', true) === 'mod', 'מקש העמודים לפי מערכת, ובחלון מותקן Mod');
}
{
  const c = {}; vm.createContext(c); vm.runInContext(fn(app, 'deskWheelDx') + '\nthis.f = deskWheelDx;', c);
  const W = (o) => Object.assign({ deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false, metaKey: false }, o);
  ok(c.f(W({}), true, 0, 500) === -100 && c.f(W({}), false, 0, 500) === 100, 'גלגלת למטה = קדימה בכיוון הקריאה (RTL — scrollLeft שלילי)');
  ok(c.f(W({}), true, -500, 500) === 0 && c.f(W({ deltaY: -100 }), true, 0, 500) === 0, 'בקצה השורה — 0, והדף ממשיך להיגלל');
  ok(c.f(W({ deltaX: 120 }), true, 0, 500) === 0 && c.f(W({ ctrlKey: true }), true, 0, 500) === 0, 'משטח מגע שכבר אופקי / Ctrl (הגדלה) — לא נוגעים');
  ok(c.f(W({ deltaMode: 1, deltaY: 3 }), false, 0, 500) === 96, 'גלילה בשורות (Firefox) — 32px לשורה');
}
ok(/addEventListener\('mouseover', deskWheelOver, \{ passive: true \}\)/.test(fn(app, 'deskInit')) && /addEventListener\('wheel', deskWheel, \{ passive: false \}\)/.test(fn(app, 'deskWheelOver')), 'הגלגלת: מאזין לא פסיבי רק על השורה שמתחת לעכבר');
ok(/html\.dk :is\(\.chip-row, \.ranges\) \{ scrollbar-width: none; \}/.test(css), 'שורות אופקיות במחשב — בלי פס גלילה (Windows)');
ok(/@media \(min-width: 2200px\)[\s\S]*?--dk-max: 1600px[\s\S]*?repeat\(4,/.test(css) && /@media \(min-width: 3000px\)[\s\S]*?--dk-max: 1920px/.test(css), 'מסכים גדולים מאוד — תוכן רחב יותר ועמודות נוספות');
ok(/html\.dk \.appbar-row \{ max-width: calc\(var\(--dk-max\) - 48px\)/.test(css), 'ההדר ברוחב התוכן');
// 11/11/2026 (כל גודל מסך ויחס תצוגה — tools/qa-sizes.sh): טלפון לרוחב, מסך צר במיוחד, בלי נעילת כיוון
{
  const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
  const st = R('styles.css');
  const land = (st.match(/@media \(orientation: landscape\) and \(max-height: 500px\) \{[\s\S]*?\n\}/) || [''])[0];
  ok(/html:not\(\.dk\) \.tabs \{ transform: scale\(/.test(land) && /--dock-pad:/.test(land) && /grid-template-rows: 56px/.test(land), 'טלפון לרוחב: הדר בשורה אחת וחוגה מוקטנת');
  ok(land && !/^\s+\.(?!appbar)/m.test(land.replace(/^@media[^\n]*\n/, '')) && land.split('\n').slice(1, -1).filter((l) => /\{/.test(l)).every((l) => /^\s+html:not\(\.dk\)/.test(l)), 'טלפון לרוחב — כל כלל תחת html:not(.dk) (לא נוגע במחשב)');
  ok(['library.css', 'studio.css'].every((f) => (R(f).match(/var\(--dock-pad, var\(--dock-h, 120px\)\)/g) || []).length === 2) && /padding-bottom: calc\(var\(--dock-pad, var\(--dock-h\)\)/.test(st), 'הריפוד מתחת לתוכן לפי --dock-pad בשלוש האפליקציות');
  ok(/@media \(max-width: 319px\) \{\s*\.brand-logo \{ width: 84px/.test(st) && /@media \(max-width: 319px\) \{ \.sh-r1 \.stock-price \{ font-size: 20px/.test(st), 'מסך צר במיוחד (280): הדר ומחיר המניה נכנסים');
  ok(st.indexOf('@media (max-width: 319px) { .sh-r1') > st.indexOf('@media (max-width: 374px) { .sh-r1'), 'כלל ה־280 של המחיר אחרי כלל ה־374 (אחרת הוא נדרס)');
  ok(!/"orientation"/.test(R('manifest.webmanifest')), 'המניפסט בלי נעילת כיוון — טאבלט, מתקפל ומחשב אנדרואיד (Googlebook) בחלון חופשי');
  ok(/SIZES="280 653 m\n/.test(R('tools/qa-sizes.sh')) && /\n5120 1440 -/.test(R('tools/qa-sizes.sh')) && /\n1080 1920 -/.test(R('tools/qa-sizes.sh')), 'סריקת הגדלים: מ־280 ועד 5120, כולל מסך לאורך');
}
ok(/DESK_MIN_FINE = 900/.test(app) && /fine \? DESK_MIN_FINE : DESK_MIN/.test(fn(app, 'deskWide')), 'עם עכבר — מסגרת המחשב כבר מ־900 (חלון בחצי מסך)');

/* ---------- 2. ניתוב המקלדת (deskKey) — עם תחליפים ---------- */
function keyCtx(over) {
  const log = [];
  const c = Object.assign({
    log, _desk: { pal: null, help: null },
    deskIsMac: () => false, deskModKey: (e, mac) => (mac ? !!e.metaKey && !e.ctrlKey : !!e.ctrlKey && !e.metaKey),
    deskPalette: () => log.push('pal'), deskPalClose: () => log.push('close'), deskSettings: () => log.push('set'), deskHelp: () => log.push('help'),
    deskPages: () => [{ k: 'a' }, { k: 'b' }], deskGo: (p) => log.push('go:' + p.k), deskBusy: () => false, deskTyping: (el) => !!(el && el.typing),
    deskK1: () => true, deskStandalone: () => false, deskSearchField: () => ({ focus: () => log.push('focus'), select() {} }), deskOS: () => 'win', deskGridKey: () => false,
  }, over || {});
  vm.createContext(c);
  vm.runInContext(fn(app, 'deskPageMod') + fn(app, 'deskPageHit') + fn(app, 'deskKey') + '\nthis.deskKey = deskKey;', c);
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
// 11/11/2026 (מחקר 05): לפי מערכת — ב־Linux, ‏ChromeOS ו־Googlebook ‏Alt+1–8 של המדף/הלשוניות; שם Ctrl+Alt
K = keyCtx({ deskOS: () => 'cros' }); K.deskKey(ev({ altKey: true, code: 'Digit1' }));
ok(K.log.join() === '', 'ChromeOS: Alt+1 נשאר של המדף');
K = keyCtx({ deskOS: () => 'gbook' }); K.deskKey(ev({ altKey: true, ctrlKey: true, code: 'Digit2' }));
ok(K.log.join() === 'go:b', 'Googlebook: Ctrl+Alt+2 — העמוד השני');
K = keyCtx({ deskOS: () => 'linux' }); K.deskKey(ev({ altKey: true, code: 'Digit1' })); K.deskKey(ev({ altKey: true, ctrlKey: true, code: 'Digit1' }));
ok(K.log.join() === 'go:a', 'Linux: Alt+1 של הדפדפן, Ctrl+Alt+1 שלנו');
K = keyCtx({ deskOS: () => 'win' }); K.deskKey(ev({ altKey: true, ctrlKey: true, code: 'Digit1' }));
ok(K.log.join() === '', 'Windows: ‏Ctrl+Alt = AltGr (מקלדות אירופיות) — לא מעבר עמוד');
K = keyCtx({ deskOS: () => 'cros', deskStandalone: () => true }); K.deskKey(ev({ ctrlKey: true, code: 'Digit2' }));
ok(K.log.join() === 'go:b', 'חלון מותקן — Ctrl+2 בכל מערכת');
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

/* ---------- 8. גל 2 — עכבר (11/11/2026) ---------- */
const g2 = { Math, String, Array, document: { documentElement: { dataset: { input: 'touch' } } } };
vm.createContext(g2);
vm.runInContext([fn(app, 'deskCtxMouse'), fn(app, 'deskTipPos'), fn(app, 'deskDropFiles'), fn(app, 'deskDropWho'), 'const _desk = { drops: [] };'].join('\n')
  + '\nthis.api = { deskCtxMouse, deskTipPos, deskDropFiles, deskDropWho, _desk };', g2);
const G = g2.api;
ok(G.deskCtxMouse({ pointerType: 'mouse' }) && !G.deskCtxMouse({ pointerType: 'touch' }) && !G.deskCtxMouse({ pointerType: 'pen' }), 'לחיצה ימנית: רק מעכבר (pointerType) — מגע ארוך לא פותח פעמיים');
ok(!G.deskCtxMouse({}), 'לחיצה ימנית בלי pointerType — לפי הקלט האחרון (מגע → לא)');
g2.document.documentElement.dataset.input = 'mouse';
ok(G.deskCtxMouse({}), 'לחיצה ימנית בלי pointerType — הקלט האחרון עכבר → כן');
const tp = G.deskTipPos({ top: 100, bottom: 140, left: 500, width: 40 }, 80, 26, 1440, 900);
ok(tp.top === 148 && tp.left === 480, 'בועית: מתחת לכפתור, ממורכזת');
ok(G.deskTipPos({ top: 860, bottom: 896, left: 10, width: 36 }, 120, 26, 1440, 900).top === 826, 'בועית: בתחתית החלון — מעל הכפתור');
ok(G.deskTipPos({ top: 10, bottom: 50, left: 1420, width: 20 }, 120, 26, 1440, 900).left === 1316, 'בועית: לא חורגת מקצה החלון');
ok(G.deskDropFiles({ types: ['Files'] }) && !G.deskDropFiles({ types: ['text/plain', 'text/uri-list'] }) && !G.deskDropFiles(null), 'גרירה: רק קבצים (לא טקסט/קישור מהדף)');
const hA = { ok: () => true, take() {} }, hB = { ok: () => false, take() {} };
G._desk.drops.push(hA, hB);
ok(G.deskDropWho() === hA, 'גרירה: מי שמקבל — האחרון שנרשם ופתוח');
ok(/contextmenu[\s\S]{0,200}deskCtxMouse\(e\)[\s\S]{0,120}onHold\(\)/.test(fn(lib, 'wireHold')), 'Academy: לחיצה ימנית על ספר/אוסף = לחיצה ארוכה');
ok((app.match(/contextmenu', \(e\) => \{\n\s+const (c|tb) = !drag && [^\n]*deskCtxMouse\(e\)/g) || []).length === 2, 'Invest: לחיצה ימנית על כרטיס מניה ועל טאב מעקב = לחיצה ארוכה');
ok(/function tabActs\(tab\)/.test(app) && /tabActs\(bar\.querySelector/.test(app), 'Invest: הפעולות של טאב — פונקציה אחת ללחיצה ארוכה ולימנית');
ok(/deskDropOn\(\{ ok: \(\) => !!root && !rd, label: \(\) => T\('libDropT'\), take: dropBooks \}\)/.test(lib) && /BOOK_EXT\.test/.test(fn(lib, 'dropBooks')), 'Academy: ספרים שנגררים לחלון — רק קבצי ספרים, לא בזמן קריאה');
ok(/deskDropOn\(\{ ok: \(\) => !!root, label: \(\) => T\('studioDropT'\), take: dropMedia \}\)/.test(studio) && /LIST_MAX/.test(fn(studio, 'dropMedia')) && /formTake\(f, file, handle\)/.test(studio), 'Studio: סרטון שנגרר — לטופס (עוד סרטונים — לרשימה עד LIST_MAX)');
ok(/\.dk-tip \{[^}]*pointer-events: none/.test(css) && /\.dk-drop \{[^}]*pointer-events: none/.test(css), 'הבועית ושכבת הגרירה לא חוסמות את העכבר');
ok(/'mouseover', deskTipOver/.test(app) && /e\.key === 'Escape'\) deskTipHide\(\)/.test(app), 'בועית: נפתחת בריחוף ונסגרת ב־Esc');

/* ---------- 9. גל 3 — חלוניות (11/11/2026) ---------- */
ok(/@media \(min-width: 1280px\) \{\s*html\.dk :is\(#stockList, #wishlistList\):has\(> \.stock\.open\) \{ grid-template-columns: minmax\(320px, 380px\) minmax\(0, 1fr\)/.test(css), 'מפקח: מ־1280 הרשימה צרה והכרטיס הפתוח לצידה');
ok(/> \.stock\.open \{\s*grid-column: 2; grid-row: 1 \/ span 999; position: sticky; top: calc\(var\(--dk-top/.test(css), 'מפקח: הכרטיס הפתוח נצמד מתחת להדר');
ok(/--dk-top/.test(fn(app, 'deskTop')) && /deskTop\(\);/.test(fn(app, 'deskSync')), 'מפקח: גובה ההדר נמדד (deskTop) ב־deskSync');
ok(/c === 'Backslash' && _desk\.side\) \{ e\.preventDefault\(\); return deskSideToggle\(\); \}/.test(fn(app, 'deskKey')), 'סרגל: ⌘\\ / Ctrl+\\ מסתיר ומציג');
ok(/LS_DKSIDE/.test(fn(app, 'deskSideToggle')) && /if \(deskSideHidden\(\)\) document\.documentElement\.classList\.add\('dk-hide'\)/.test(app), 'סרגל: ההעדפה נשמרת במכשיר ומוחלת לפני הציור הראשון');
ok(/html\.dk\.dk-hide \{ --dk-off: 0px; \}/.test(css) && /html\.dk\.dk-hide \.dk-showbtn \{ display: grid/.test(css), 'סרגל מוסתר: התוכן מתרחב וכפתור בפינה מחזיר');
ok(/\['mod\+\\\\', t\('dkSideHide'\)\]/.test(fn(app, 'deskHelp')) && /dkSideShow/.test(fn(app, 'deskCmdList')), 'סרגל: בחלון הקיצורים ובלוח הפקודות');
ok(/deskKbd\(pm \+ '\+' \+ \(i \+ 1\), mac\)/.test(fn(app, 'deskCmdList')), 'לוח הפקודות: מקש העמודים לפי המערכת (Ctrl+Alt בלינוקס/Googlebook)');

/* ---------- 10. גל 4 — מקלדת עמוקה (11/11/2026) ---------- */
const g4 = { Math, String };
vm.createContext(g4);
vm.runInContext([fn(app, 'scKeyStep'), fn(app, 'scRangeKey'), fn(app, 'deskGridIdx'), 'const defaults = { size: 19 };', fn(lib, 'readerSize')].join('\n')
  + '\nthis.api = { scKeyStep, scRangeKey, deskGridIdx, readerSize };', g4);
const K4 = g4.api, J = (x) => JSON.stringify(x);
ok(J(K4.scKeyStep(null, 50, 'ArrowLeft', false)) === J({ mode: 'tip', i: 49, pinned: true }), 'גרף: חץ ראשון — הנקודה האחרונה (היום)');
ok(K4.scKeyStep({ mode: 'tip', i: 10 }, 50, 'ArrowLeft', false).i === 9 && K4.scKeyStep({ mode: 'tip', i: 49 }, 50, 'ArrowRight', false).i === 49, 'גרף: ← אחורה בזמן, → קדימה, לא מעבר לקצה');
ok(K4.scKeyStep({ mode: 'tip', i: 5 }, 50, 'Home', false).i === 0 && K4.scKeyStep(null, 50, 'End', false).i === 49, 'גרף: Home/End');
const m1 = K4.scKeyStep({ mode: 'tip', i: 20 }, 50, 'ArrowLeft', true), m2 = K4.scKeyStep(m1, 50, 'ArrowLeft', true);
ok(m1.mode === 'm' && m1.a === 20 && m1.b === 19 && m2.a === 20 && m2.b === 18, 'גרף: Shift+חץ — מדידה, העוגן נשאר והקצה זז');
ok(K4.scKeyStep({ mode: 'tip', i: 7, pick: true }, 50, 'ArrowRight', true).pick === true, 'גרף: בבחירת תאריך — הסמן נשאר סמן הבחירה (בלי מדידה)');
ok(K4.scKeyStep(null, 50, 'a', false) === null && K4.scKeyStep(null, 1, 'ArrowLeft', false) === null, 'גרף: מקש אחר / גרף בלי נתונים — לא נוגעים');
ok(K4.scRangeKey('1', 6, 3) === 0 && K4.scRangeKey('9', 6, 3) === -1 && K4.scRangeKey('4', 6, 3) === -1, 'טווח: 1–9 לפי הסדר (לא קיים / כבר נבחר — כלום)');
ok(K4.scRangeKey('+', 6, 3) === 2 && K4.scRangeKey('-', 6, 3) === 4 && K4.scRangeKey('+', 6, 0) === -1 && K4.scRangeKey('−', 6, 5) === -1, 'טווח: + קצר יותר, − ארוך יותר, עד הקצוות');
ok(K4.deskGridIdx(-1, 5, 'ArrowDown') === 0 && K4.deskGridIdx(2, 5, 'ArrowDown') === 3 && K4.deskGridIdx(4, 5, 'ArrowDown') === 4 && K4.deskGridIdx(0, 5, 'ArrowUp') === 0 && K4.deskGridIdx(2, 5, 'End') === 4 && K4.deskGridIdx(0, 0, 'Home') === null, 'טבלה: ↑ ↓ Home End');
ok(K4.readerSize(19, 'Equal') === 20 && K4.readerSize(30, 'Equal') === 30 && K4.readerSize(14, 'Minus') === 14 && K4.readerSize(25, 'Digit0') === 19 && K4.readerSize(19, 'KeyA') === null, 'קורא: ⌘= ⌘− בטווח 14–30, ⌘0 — ברירת המחדל');
ok(/canvas\.tabIndex = 0;/.test(fn(app, 'scAttach')) && /addEventListener\('keydown', \(e\) => scKey\(canvas, sym, e\)\)/.test(fn(app, 'scAttach')), 'גרף: מגיעים אליו ב־Tab ועונה למקלדת');
ok(/if \(canvas\._sc && !canvas\._sc\.pick\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); scSet\(canvas, null\); \}/.test(fn(app, 'scKey')), 'גרף: Esc מנקה סמן — ורק אז נבלע');
ok(/if \(deskGridKey\(e\)\) return;/.test(fn(app, 'deskKey')) && (R('index.html').match(/class="rows" data-dk-grid tabindex="0"/g) || []).length === 2, 'טבלאות: העסקאות וההפקדות במקלדת');
ok(/e\.code === 'KeyF' && !e\.shiftKey\) \{ e\.preventDefault\(\); openToc\('find'\)/.test(fn(lib, 'readerModKey')) && /if \(readerModKey\(e\)\) return;/.test(fn(lib, 'readerKey')), 'קורא: ⌘F — החיפוש בספר');
ok(/if \(start === 'find'\) setTimeout/.test(lib), 'קורא: החיפוש נפתח ישר בלשונית שלו');
ok(/e\.key !== 'Enter' \|\| !\(e\.metaKey \|\| e\.ctrlKey\)[\s\S]{0,200}cueStep\(k, hist\.cur\.length, e\.shiftKey\)/.test(R('studiosubs.js')), 'עורך הכתוביות: ⌘↩ לשורה הבאה, ⇧ לקודמת');
ok(/invest: \[\['← →'/.test(app) && /\['mod\+↩', \(\) => t\('dkKeyCueNext'\)\]/.test(app) && /\['mod\+F', \(\) => t\('dkKeyBookFind'\)\]/.test(app), 'חלון הקיצורים: הקיצורים החדשים בכל אפליקציה');

console.log('\n' + n + ' בדיקות עברו');
