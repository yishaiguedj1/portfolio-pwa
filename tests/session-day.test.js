// session-day.test.js — 18/11/2026 (בקשת המשתמש): התווית של השינוי היומי בכרטיס — "היום" רק מפתיחת המסחר הרגיל
// ועד תחילת המסחר הלילי (20:00 ניו־יורק); אחר כך "אתמול", ואחרי סופ״ש/חג — שם היום. + התוויות "שווי"/"שינוי".
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const retSrc = fs.readFileSync(path.join(root, 'returns.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function ok(cond, name) {
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}

const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: {
    hidden: false, activeElement: null, addEventListener() {}, getElementById: () => null,
    querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }),
  },
  window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(retSrc, sb);
vm.runInContext(src, sb);
const run = (c) => vm.runInContext(c, sb);
const TZ = 'Asia/Jerusalem';
// נובמבר 2026: ניו־יורק = UTC−5, ישראל = UTC+2. il('2026-11-18 20:14') = הרגע בשעון ישראל
const il = (s) => Date.parse(s.replace(' ', 'T') + ':00+02:00');
const info = (sym, s) => run('sessionDayInfo(' + JSON.stringify(sym) + ', ' + il(s) + ', "' + TZ + '")');
const lbl = (sym, s) => run('sessionDayLabel(' + JSON.stringify(sym) + ', ' + il(s) + ', "' + TZ + '")');
const is = (sym, s, k, key, name) => { const i = info(sym, s); ok(k === null ? i === null : (i && i.k === k && i.key === key), name + ' (' + JSON.stringify(i) + ')'); };

// ארה״ב — יום רביעי 18/11
is('MSFT', '2026-11-18 20:14', null, null, 'מסחר רגיל — היום');
is('MSFT', '2026-11-18 23:30', null, null, 'אחרי־מסחר — עדיין היום');
is('MSFT', '2026-11-19 02:59', null, null, 'דקה לפני המסחר הלילי — היום');
is('MSFT', '2026-11-19 03:01', 'yest', '2026-11-18', 'המסחר הלילי התחיל — אתמול');
is('MSFT', '2026-11-19 16:00', 'yest', '2026-11-18', 'טרום־מסחר — עדיין אתמול');
is('MSFT', '2026-11-19 16:31', null, null, 'המסחר הרגיל נפתח — היום');
is('BRK-B', '2026-11-19 10:00', 'yest', '2026-11-18', 'מניה עם מקף (סוג מניה) — כמו ארה״ב');
// סופ״ש
is('MSFT', '2026-11-21 10:00', 'yest', '2026-11-20', 'שבת — יום ו׳ היה אתמול');
is('MSFT', '2026-11-22 10:00', 'dow', '2026-11-20', 'ראשון — שם היום (שישי), לא "אתמול"');
is('MSFT', '2026-11-23 10:00', 'dow', '2026-11-20', 'שני בבוקר — שישי');
ok(lbl('MSFT', '2026-11-22 10:00') === 'שישי' && lbl('MSFT', '2026-11-19 10:00') === 'אתמול' && lbl('MSFT', '2026-11-18 20:14') === 'היום', 'התוויות בעברית');
// חג: חג ההודיה 26/11/2026 — השוק סגור
is('MSFT', '2026-11-26 20:00', 'yest', '2026-11-25', 'בחג ההודיה — רביעי היה אתמול');
is('MSFT', '2026-11-27 10:00', 'dow', '2026-11-25', 'יום ו׳ אחרי החג — רביעי');
ok(lbl('MSFT', '2026-11-27 10:00') === 'רביעי', 'שם היום אחרי חג');
// מה שנסחר מסביב לשעון / לא בארה״ב — תמיד "היום"
for (const s of ['BTC-USD', 'EURUSD=X', 'CL=F', '^GSPC', 'VOD.L']) is(s, '2026-11-22 10:00', null, null, s + ' — היום');
// ת״א (ב׳–ו׳, אין מסחר לילי)
is('LUMI.TA', '2026-11-18 09:00', 'yest', '2026-11-17', 'ת״א לפני הפתיחה — אתמול');
is('LUMI.TA', '2026-11-18 10:30', null, null, 'ת״א במסחר — היום');
is('LUMI.TA', '2026-11-18 23:30', null, null, 'ת״א בערב — היום');
is('LUMI.TA', '2026-11-21 10:00', 'yest', '2026-11-20', 'ת״א בשבת — אתמול');
is('LUMI.TA', '2026-11-22 10:00', 'dow', '2026-11-20', 'ת״א בראשון — שישי');
is('LUMI.TA', '2026-09-22 07:00', 'dow', '2026-09-18', 'ת״א אחרי יום כיפור (ב׳ 21/9), 08:00 שעון קיץ — שישי');
// הכרטיס
const subSrc = src.slice(src.indexOf('function stockSubHTML('), src.indexOf('const SKEL_HTML'));
ok(/sessionDayLabel\(p && p\.sym\)/.test(subSrc), 'הכרטיס משתמש בתווית יום המסחר');
ok(/subValLbl/.test(subSrc) && /subGlLbl/.test(subSrc), 'התוויות "שווי" ו"שינוי מהקנייה" בכרטיס');
ok(/subValLbl: 'שווי', subGlLbl: 'שינוי מהקנייה'/.test(src) && /subValLbl: 'Value', subGlLbl: 'Gain'/.test(src), 'מחרוזות בשתי השפות');
ok(/dayYest: 'אתמול'/.test(src) && /dayYest: 'Yesterday'/.test(src), '"אתמול" בשתי השפות');
ok(/\.stock-sub \.sub-lbl \{[^}]*color: var\(--on-surface-var\)/.test(css), 'התווית אפורה (משתנה צבע)');
ok(/\.stock-sub \{[^}]*grid-template-columns: minmax\(0, 1fr\)/.test(css) && /\.stock-sub > \.day-chg \{[^}]*white-space: nowrap/.test(css), 'שורות המשנה בעמודה אחת והגלולה לא נשברת (2.184.1)');
ok(!/<span class="sub-val">[^;]*chev/.test(subSrc), 'בלי החץ ▾ ליד השווי (2.184.1)');
ok(/'<span class="sub-val wl-ath">'/.test(subSrc) && /t\('subAthLbl'\)/.test(subSrc) && !/chev/.test(subSrc), 'מעקב: השיא במקום החץ ▾ (2.184.2)');
ok(/subAthLbl: 'מהשיא'/.test(src) && /subAthLbl: 'From ATH'/.test(src), 'תווית השיא בשתי השפות');
ok(!/wl-ath[\s\S]{0,400}fmtPx\(m\.ath\.price/.test(subSrc), 'מעקב: בלי מחיר השיא בשורה — רק "מהשיא" והאחוז (19/11)');
