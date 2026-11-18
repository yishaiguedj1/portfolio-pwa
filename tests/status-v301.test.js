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
ok(/st-pill open"/.test(open) && /<i><\/i>/.test(open) && /<span class="sub-cap"><i><\/i>השוק<\/span><b class="sub-val">פתוח<\/b>/.test(open) && !/Yahoo/.test(open) && !/דיליי/.test(open), 'פתוח וחי: נקודה + "השוק" למעלה, "פתוח" מודגש למטה, בלי שם המקור');
const openD = f({ source: 'CNBC', live: false, session: '' }, WED);
ok(/st-pill open delay/.test(openD) && /<span class="sub-cap"><i><\/i><\/span><b class="sub-val">פתוח<small> · דיליי<\/small><\/b>/.test(openD) && !/CNBC/.test(openD), 'פתוח בגיבוי (18/11): נקודה אפורה + "פתוח · דיליי" בשורה אחת, בלי "השוק"');
ok(/st-pill open delay/.test(f({ source: 'Yahoo', live: true, stale: true, session: '' }, WED)), 'נתונים שמורים = דיליי');
for (const [k, lbl] of [['pre', 'מוקדם'], ['post', 'מאוחר'], ['night', 'לילי']]) {
  const h = f({ source: 'Yahoo', live: true, session: k }, WED);
  ok(new RegExp('st-pill ' + k + '"').test(h) && h.includes(lbl) && /<svg/.test(h) && /<i><\/i>/.test(h), k + ': קפסולה צבעונית + אייקון + נקודה חיה');
  ok(new RegExp('st-pill ' + k + ' delay').test(f({ source: 'CNBC', live: false, session: k }, WED)), k + ' בדיליי: נקודה אפורה');
}
const sat = f({ source: 'CNBC', live: false, session: 'pre' }, SAT);
ok(/st-pill closed/.test(sat) && /<b class="sub-val">סגור<small> · סופ״ש<\/small><\/b>/.test(sat) && !/<i>/.test(sat) && !/דיליי/.test(sat), 'שבת: "סגור · סופ״ש" גם כשהגיבוי אומר "מסחר מוקדם"; מנעול בלי נקודה');
// 18/11/2026 (בקשת המשתמש): בחג — "סגור · חג", בלי שם החג (ארוך, נחתך בבועה)
const xmas = f({ source: 'Yahoo', live: true, session: 'closed' }, XMAS), labor = f({ source: 'Yahoo', live: true, session: '' }, LABOR);
ok(/<b class="sub-val">סגור<small> · חג<\/small><\/b>/.test(xmas) && !/חג המולד/.test(xmas), 'חג: "סגור · חג" בלי שם החג');
ok(/<b class="sub-val">סגור<small> · חג<\/small><\/b>/.test(labor) && !/יום העבודה/.test(labor), 'גם ביום העבודה');
ok(/st-pill night/.test(f({ source: 'Yahoo', live: true, session: 'night' }, SAT)), 'מסחר לילי גובר על "סופ״ש" (יום ראשון בערב)');
const closedNoReason = f({ source: 'Yahoo', live: true, session: 'closed' }, WED);
ok(/st-pill closed/.test(closedNoReason) && />השוק<\/span><b class="sub-val">סגור<\/b>/.test(closedNoReason.replace(/<svg.*<\/svg>/, '')), 'סגור בלי סיבה (סגירה מיוחדת/אחרי השעות)');
ok(/טוען/.test(f({ source: '' }, WED)), 'לפני הנתונים: "טוען…"');
ok(/\.st-pill \{[^}]*border-radius: var\(--pill\)/.test(css) && /\.st-pill\.open i \{[^}]*var\(--gain\)/.test(css) && /\.st-pill\.delay i \{[^}]*var\(--on-surface-var\)/.test(css), 'עיצוב: גלולה, נקודה ירוקה בפתוח, אפורה בדיליי');
ok(/stOpen: 'Market open'/.test(app) && /stClosedWith: 'Closed · \{r\}'/.test(app) && /stClosedFull: 'Market closed'/.test(app), 'מחרוזות באנגלית');
ok(/hdNewYear: '1 בינואר'/.test(app) && /hdPresidents: 'יום הנשיאים'/.test(app), 'שמות חגים מתוקנים באפליקציה');
const wm = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/widget-model.js'), 'utf8');
ok(/hdNewYear: '1 בינואר'/.test(wm) && /hdLabor: 'יום העבודה'/.test(wm), 'ובווידג׳ט');
ok(/state\.session = sess === 'regular' \? '' : sess;/.test(app), '"סגור" מהמקור נשמר');
// 18/11/2026 (בקשת המשתמש, צילום — הטקסט בבועות ההדר גלש ונחתך): שורה אחת, ומה שלא נכנס יורד בשלבים
ok(/stShHoliday: 'חג'/.test(app) && /stShHoliday: 'Holiday'/.test(app) && /fxPillCap: 'דולר'/.test(app) && /fxPillCap: 'USD'/.test(app), 'מחרוזות קצרות: "חג", "דולר"');
const idx = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
ok(/<span data-i18n="fxPillCap">דולר<\/span>/.test(idx) && /id="fxPill"[^>]*aria-label="שער הדולר"/.test(idx), 'בועת השער: "דולר" בבועה, "שער הדולר" לקורא המסך');
{
  const fitSrc = app.slice(app.indexOf('function hdrPillFit('), app.indexOf('function hdrPillsFit('));
  const mk = (need) => { const cls = new Set(); const kids = [{ w: 30, cap: true }, { w: need }];
    const p = { classList: { add: (c) => cls.add(c), remove: (...c) => c.forEach((x) => cls.delete(x)) }, clientWidth: 110,
      get children() { return kids.map((k) => ({ getClientRects: () => [1], get scrollWidth() { return k.cap && cls.has('pf1') ? 7 : !k.cap && cls.has('pf3') ? k.w - 30 : !k.cap && cls.has('pf2') ? k.w - 20 : k.w; } })); } };
    return { p, cls }; };
  const c2 = vm.createContext({ getComputedStyle: () => ({ columnGap: '4px', paddingLeft: '10px', paddingRight: '10px' }) });
  vm.runInContext(fitSrc + ';globalThis.fit = hdrPillFit;', c2);
  const a = mk(50); c2.fit(a.p); const b = mk(70); c2.fit(b.p); const c = mk(85); c2.fit(c.p); const d = mk(110); c2.fit(d.p);
  ok(a.cls.size === 0 && [...b.cls].join() === 'pf1' && [...c.cls].join() === 'pf1,pf2' && [...d.cls].join() === 'pf1,pf2,pf3', 'hdrPillFit: נכנס — בלי שינוי; אחרת בלי הכיתוב, ואז בלי התוספת, ואז ערך קטן');
}
const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8'), shell = fs.readFileSync(path.join(root, 'shell.js'), 'utf8');
ok(/function hdrPillFit\(/.test(core) && /pillFitSoon\(cur\);/.test(shell) && /pillFitSoon\(node\);/.test(shell), 'Academy/Studio: אותה התאמה (core.js + statusSet)');
const ig = fs.readFileSync(path.join(root, 'invest-glass.css'), 'utf8'), sg = fs.readFileSync(path.join(root, 'studio-glass.css'), 'utf8'), ag = fs.readFileSync(path.join(root, 'academy-glass.css'), 'utf8');
ok(/#fxPill\)\.pf1 :is\(\.sub-cap, \.fx-pill-label\) \{ font-size: 0 !important/.test(ig) && /\.st-pill\.pf2 \.sub-val small \{ display: none/.test(ig) && /\.st-cpill\.pf1 \.sub-cap \{ font-size: 0/.test(sg) && /\.lib-bkpill\.pf1 \.sub-cap \{ font-size: 0/.test(ag), 'CSS: שלבי ההתאמה בשלוש האפליקציות');
for (const [nm, css2, sel] of [['Invest', ig, ':is(#sourceLabel .st-pill, .fx-pill) {'], ['Studio', sg, '.appbar .st-cpill {'], ['Academy', ag, '.appbar .lib-bkpill {']]) {
  const r = css2.slice(css2.indexOf(sel), css2.indexOf('}', css2.indexOf(sel)));
  ok(/height: 40px !important/.test(r) && /gap: 4px !important/.test(r) && /padding: 0 10px !important/.test(r) && /flex-wrap: nowrap !important/.test(r) && /overflow: hidden !important/.test(r) && !/max-content/.test(r), nm + ': אותה בועה — 40, שורה אחת, ברוחב העמודה');
}
ok(!/lib-bkpill \.sub-cap::after/.test(ag), 'Academy: בלי "·" בין "גיבוי" למצב');
// 18/11/2026 (בקשת המשתמש — הנקודה נחתכה): אותה נקודה של בועת השער — 6px, מהבהבת, צבע לפי המצב, דיליי אפורה עם טבעת; בלי חיתוך
ok(/#sourceLabel \.st-pill i \{ width: 6px !important; height: 6px !important;[^}]*animation: livePulse 2s ease-in-out infinite !important;/.test(ig) && /\.st-pill\.pre i \{ background: #FF9F0A/.test(ig) && /\.st-pill\.delay i \{ animation: none !important; background: #8E8E93/.test(ig) && /:is\(#sourceLabel \.st-pill \.sub-cap, #fxPill \.fx-pill-label\) \{ overflow: visible !important; \}/.test(ig), 'נקודת השוק = נקודת השער (מהבהבת, לא נחתכת)');
console.log('# ' + n + ' בדיקות עברו');
