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

// 19/11/2026: "מהשיא" רק בחלק מכרטיסי המעקב — ההיסטוריה של מניות המעקב לא נטענה. wlWarmHist: מטמון טרי מיד,
// חסר/ישן — בקשה אחת לשרתון; כשל → המטמון הישן; כל סימבול פעם אחת; ובסוף ציור מחדש
(async () => {
  const run = (c) => vm.runInContext(c, sb);
  ok(/listSync\(list, out\);\s*try \{ fitWatchSubs\(\); \} catch \(e\) \{\}\s*try \{ wlWarmHist\(items\.map/.test(src), 'renderWishlist מחמם את היסטוריית המעקב');
  const now = Date.now();
  const recs = { FRESH: { at: now - 3600e3, rows: [{ date: '2026-01-02', close: 10 }] }, OLD: { at: now - 3 * 864e5, rows: [{ date: '2025-01-02', close: 7 }] } };
  const asked = [];
  let renders = 0;
  sb.loadHistCacheRec = (s) => recs[s] || null;
  sb.histBatchWarm = async (syms) => { asked.push(...syms); run('state.hist').NEW = [{ date: '2026-11-18', close: 5 }]; };
  sb.renderWishlist = () => { renders++; };
  sb.restoreHistRows = (s, r) => { run('state.hist')[s] = r.rows; return r.rows; };
  run('wlWarmHist(["FRESH", "OLD", "NEW"])');
  ok(run('state.hist').FRESH && !asked.includes('FRESH'), 'מטמון טרי — מיד, בלי רשת');
  await new Promise((r) => setTimeout(r, 0));
  ok(asked.join() === 'OLD,NEW', 'ישן וחסר — בבקשה אחת');
  ok(run('state.hist').NEW && run('state.hist').OLD && run('state.hist').OLD[0].close === 7, 'מה שהשרתון לא החזיר — מהמטמון הישן');
  ok(renders === 1, 'ציור מחדש אחד בסוף');
  run('wlWarmHist(["FRESH", "OLD", "NEW"])');
  await new Promise((r) => setTimeout(r, 0));
  ok(asked.length === 2 && renders === 1, 'כל סימבול פעם אחת בסשן');
})().catch((e) => { console.error('FAIL - ' + e.message); process.exit(1); });

// 19/11/2026: "מהשיא" וגלולת היום לעולם לא מתנגשים — הכל בשורה אחת, הסכום בכסף תמיד, ורק גודל הטקסט בשורה (--wk)
// משתנה לפי האורך שלה, עם רווח WK_GAP (החלטות המשתמש)
{
  ok(/\.stock\[data-watch\] \.stock-sub > \.day-chg \{ font-size: calc\(14px \* var\(--wk\)\)/.test(css) && /\.stock\[data-watch\] \.stock-sub \.day-amt \{ font-size: calc\(13\.5px \* var\(--wk\)\)/.test(css), 'עיצוב: כל הגדלים בשורה לפי --wk, כולל הסכום');
  ok(!/day-amt \{ display: none/.test(css) && !/wk-stack/.test(css), 'הסכום לא מוסתר, ואין מעבר לשתי שורות');
  ok(/function fitNumbers\(page\) \{\s*try \{ fitWatchSubs\(\); \}/.test(src), 'fitNumbers מתאים גם את שורות המעקב (טיק חי, מעבר טאב, שינוי רוחב)');
  const mk = (ath, pill) => {
    const st = {};
    const sub = { textContent: ath + '|' + pill, clientWidth: 280,
      style: { setProperty: (k, v) => { st[k] = +v; }, removeProperty: (k) => { delete st[k]; } } };
    sub.k = () => st['--wk'] || 1;
    sub.w = { ath, pill };
    const a = { get scrollWidth() { return sub.w.ath * sub.k() + 2; } }, p = { get offsetWidth() { return sub.w.pill * sub.k() + 8; } }; // ריפוד לא ליניארי
    sub.querySelector = (q) => (q === '.wl-ath' ? a : p);
    return sub;
  };
  let subs = [];
  const list = { clientWidth: 300, querySelectorAll: () => subs };
  sb.document.getElementById = (id) => (id === 'wishlistList' ? list : null);
  const fit = () => run('fitWatchSubs()');
  const gapOk = (x) => x.clientWidth - x.querySelector('.wl-ath').scrollWidth - x.querySelector('.day-chg').offsetWidth >= 22;
  subs = [mk(90, 120), mk(110, 240), mk(120, 320)];
  fit();
  ok(subs[0].k() === 1, 'שורה קצרה — בגודל המלא');
  ok(subs[1].k() < 1 && subs[2].k() < subs[1].k(), 'שורה ארוכה — קטנה, וארוכה יותר — קטנה יותר (לכל כרטיס לפי האורך שלו)');
  ok(subs.every(gapOk), 'בכל הכרטיסים רווח של 22 לפחות — בלי התנגשות');
  ok(subs[2].k() >= 0.5 && 280 - (120 * subs[2].k() + 2) - (320 * subs[2].k() + 8) < 22 + 0.03 * 440, 'הקטנה מינימלית — לא יותר ממה שצריך');
  const k1 = subs[1].k();
  subs[1].textContent += 'x'; subs[1].w = { ath: 90, pill: 100 };
  fit();
  ok(subs[1].k() === k1, 'טיק חי שקיצר את הטקסט — הגודל לא קופץ בחזרה');
  subs[1].textContent += 'y'; subs[1].w = { ath: 110, pill: 300 };
  fit();
  ok(subs[1].k() < k1 && gapOk(subs[1]), 'טיק חי שהאריך — קטן עוד, עם רווח');
  sb.document.getElementById = () => null;
}
