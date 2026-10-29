// intraday-tz.test.js — גרף היום בשעון המכשיר + המסחר הלילי (בקשת המשתמש 29/10/2026:
// "למה המחיר האחרון 19:59 ולא השעון שלנו" — להציג לכל משתמש לפי המיקום שלו, ולצייר גם את המסחר הלילי).
// mocks בלבד — בלי רשת.
process.env.TZ = 'Asia/Jerusalem'; // "המכשיר" בישראל
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}

const doc = {
  hidden: false, activeElement: null,
  addEventListener() {}, getElementById: () => null,
  querySelectorAll: () => [], querySelector: () => null,
  createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, style: {} }),
};
const sb = {
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  document: doc, window: {}, navigator: {}, location: {},
  AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout: () => 0, clearTimeout() {}, console: { log() {}, warn() {}, error: console.error },
};
vm.createContext(sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);

// --- 1. המרת שעון הבורסה ↔ שעון המכשיר ---
const exWallToMs = A('exWallToMs'), tzWall = A('tzWall');
const ms = exWallToMs('2026-10-28', '19:59', 'America/New_York'); // EDT (UTC−4)
ok(ms === Date.UTC(2026, 9, 28, 23, 59), '19:59 בניו יורק (שעון קיץ) = 23:59 UTC');
const il = tzWall(ms);
ok(il.date === '2026-10-29' && il.time === '01:59', 'בשעון המכשיר (ישראל, אחרי סוף שעון הקיץ) = 01:59 ב־29/10');
ok(exWallToMs('2026-11-02', '09:30', 'America/New_York') === Date.UTC(2026, 10, 2, 14, 30), 'אחרי מעבר השעון בארה״ב (EST) — UTC−5');
ok(tzWall(Date.UTC(2026, 9, 28, 4, 0), 'America/New_York').time === '00:00', 'חצות — 00 ולא 24');

// --- 2. נקודות הגרף בשעון המכשיר ---
const pts = A('chartPoints')('META', [{ date: '2026-10-28', time: '09:30', close: 1 }, { date: '2026-10-28', time: '19:59', close: 2 }], 'day');
ok(pts[0].time === '15:30' && pts[1].time === '01:59' && pts[1].date === '2026-10-29', 'גרף היום: 09:30/19:59 בניו יורק → 15:30/01:59 בישראל');
const ta = A('chartPoints')('LUMI.TA', [{ date: '2026-10-28', time: '10:00', close: 1 }], 'day');
ok(ta[0].time === '10:00', 'ת״א במכשיר בישראל — אותה שעה');
const daily = A('chartPoints')('META', [{ date: '2026-10-28', close: 1 }], false);
ok(daily[0].date === '2026-10-28' && !daily[0].time, 'גרף יומי — בלי המרה');

// --- 3. המסחר הלילי ---
const rec = A('nightTickRecord');
const t0 = Date.UTC(2026, 9, 29, 0, 5) / 1000; // 20:05 בניו יורק
rec('META', { session: 'night', close: 617, ext: { kind: 'night', price: 617, t: t0 } });
rec('META', { session: 'night', close: 617.5, ext: { kind: 'night', price: 617.5, t: t0 + 20 } });
rec('META', { session: 'night', close: 618, ext: { kind: 'night', price: 618, t: t0 + 120 } });
rec('META', { session: 'regular', close: 1, ext: null });
const ticks = A('NIGHT_TICKS').META;
ok(ticks.length === 2 && ticks[0].close === 617.5 && ticks[1].close === 618, 'דקה אחת = נקודה אחת (האחרונה), מסחר רגיל לא נרשם');
const rows = [{ date: '2026-10-28', time: '19:58', close: 616 }, { date: '2026-10-28', time: '19:59', close: 616.04 }];
const q = { session: 'night', close: 618, ext: { kind: 'night', price: 618, t: t0 + 120 }, mdate: '2026-10-28', mtime: '19:59' };
const out = A('intradayLiveRows')(rows, q, ticks);
ok(out.length === 4 && out[2].time === '20:05' && out[3].close === 618 && out[3].night, 'בלילה — הדקות הליליות אחרי 19:59');
ok(rows.length === 2, 'המטמון לא משתנה');
ok(A('intradayLiveRows')(rows, q, null).length === 2, 'בלי דקות — כמו קודם');
const old = [{ date: '2026-10-26', time: '19:59', close: 1 }];
ok(A('intradayLiveRows')(old, q, ticks).length === 1, 'דקות של לילה אחר (יותר מ־10 שעות אחרי) — לא נדבקות');
rec('META', { session: 'night', close: 600, ext: { kind: 'night', price: 600, t: t0 + 86400 } });
ok(A('NIGHT_TICKS').META.length === 1, 'לילה חדש מאפס את הרשימה');

// --- 4. חיווט ---
ok(/nightTickRecord\(s, got\[s\]\)/.test(src), 'liveMerge רושם את הדקות הליליות');
ok(/intradayLiveRows\(shown, state\.quotes\[sym\], range === 'day' \? NIGHT_TICKS\[sym\] : null\)/.test(src), 'גרף היום מקבל את הדקות הליליות');
const chartSrc = fs.readFileSync(path.join(root, 'chart.js'), 'utf8');
ok(/tz: g\.tz === 'ex' \? 'ex' : 'local'/.test(chartSrc), 'הגרף המתקדם: ברירת המחדל = שעון המכשיר');

console.log('\n' + n + ' בדיקות עברו');
