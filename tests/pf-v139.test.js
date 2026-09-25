// pf-v139.test.js — מחירים חיים (בקשת המשתמש 25/09/2026: "שמחיר המניות יתעדכן בלייב
// כל כמה שניות כמו TradingView"). Yahoo בזמן אמת, בלי שרתון; עדכון במקום.
// mocks בלבד — בלי רשת.
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
const run = (c) => vm.runInContext(c, sb);

(async () => {
  // --- 1. parseYahooQuote: תאריך+שעה של הדקה האחרונה שנסחרה (שעון הבורסה) ---
  const q = A('parseYahooQuote')({ chart: { result: [{
    meta: { regularMarketPrice: 100, regularMarketTime: 1790280000, gmtoffset: -14400 },
    timestamp: [1790289000, 1790289060, 1790289120],
    indicators: { quote: [{ close: [101, 102, null] }] },
  }] } }, 'X', 1790289130000);
  ok(q.close === 102, 'מחיר = הדקה האחרונה שיש בה מסחר');
  ok(q.mdate === '2026-09-24' && q.mtime === '18:31', 'mdate/mtime של הדקה האחרונה בשעון ניו־יורק (18:31 = אחרי־המסחר)');

  // --- 2. נקודת "עכשיו" בגרף היומי ---
  const live = A('intradayLiveRows');
  const rows = [{ date: '2026-09-24', time: '18:25', close: 100 }, { date: '2026-09-24', time: '18:30', close: 101 }];
  const a = live(rows, { close: 103, mdate: '2026-09-24', mtime: '18:31' });
  ok(a.length === 3 && a[2].close === 103 && a[2].time === '18:31', 'דקה חדשה → נקודה נוספת בסוף');
  const b = live(rows, { close: 104, mdate: '2026-09-24', mtime: '18:30' });
  ok(b.length === 2 && b[1].close === 104, 'אותה דקה → מחליף את הנר האחרון');
  ok(rows[1].close === 101 && rows.length === 2, 'המטמון לא משתנה');
  ok(live(rows, { close: 105, mdate: '2026-09-25', mtime: '09:31' }).length === 2, 'יום אחר → לא מדביק לגרף של אתמול');
  ok(live(rows, null).length === 2, 'בלי ציטוט → כמו שהוא');

  // --- 3. מיזוג: רק סימבולים שזזו ---
  run(`state.quotes = { AAA: { close: 10 }, BBB: { close: 20 } };`);
  const moved = A('liveMerge')({ AAA: { close: 10 }, BBB: { close: 21 }, CCC: { close: 5 } });
  ok(moved.join(',') === 'BBB,CCC', 'זזו: BBB (מחיר חדש) ו־CCC (חדש), לא AAA');
  ok(run('state.quotes.BBB.close') === 21 && run('state.quotes.AAA.close') === 10, 'state.quotes מתמזג, לא מוחלף');

  // --- 4. אילו סימבולים בכל טיק ---
  run(`POSITIONS.length = 0; POSITIONS.push({ sym: 'AAA', shares: 1, avg: 1 }, { sym: 'BBB', shares: 1, avg: 1 });
       WISHLIST.length = 0; WISHLIST.push({ sym: 'WWW' }); state.open = { BBB: true, AAA: false };`);
  ok(A('liveSymbolsFor')(true).join(',') === 'AAA,BBB,WWW', 'טיק מלא: כל התיק + רשימת המעקב');
  ok(A('liveSymbolsFor')(false).join(',') === 'BBB', 'טיק מהיר: רק כרטיסים פתוחים');

  // --- 5. מתי לא לשאול בכלל ---
  const can = A('liveCanTick');
  ok(can() === true, 'רגיל: כן');
  doc.hidden = true; ok(can() === false, 'אפליקציה ברקע: לא'); doc.hidden = false;
  run('state.edit.stocks = true'); ok(can() === false, 'מצב עריכה: לא'); run('state.edit.stocks = false');
  doc.activeElement = { tagName: 'INPUT' }; ok(can() === false, 'בזמן הקלדה בשדה: לא'); doc.activeElement = null;
  run('state.ibkrSyncing = true'); ok(can() === false, 'בזמן סנכרון IBKR: לא'); run('state.ibkrSyncing = false');

  // --- 6. טיק מקצה לקצה עם fetch מדומה ---
  const calls = [];
  run(`fetchJSONTimeout = async (u) => { __calls.push(u); const m = /chart\\/([A-Z]+)/.exec(u);
        return { chart: { result: [{ meta: { gmtoffset: -14400 }, timestamp: [1790289000],
          indicators: { quote: [{ close: [m[1] === 'BBB' ? 22 : 10] }] } }] } }; };
       renderLive = (s) => { __rendered.push(s.join(',')); };
       state.quotes = { AAA: { close: 10 }, BBB: { close: 21 }, WWW: { close: 10 } };`);
  sb.__calls = calls; sb.__rendered = [];
  run('live.on = true; live.n = 0; live.still = 0; live.lastRecover = Date.now();');
  await A('liveTick')();
  ok(calls.filter((u) => /interval=1m/.test(u)).length === 3, 'טיק מלא: השרתון לא זמין → גיבוי ישיר, בקשה לכל סימבול (v164: בדרך כלל בקשה אחת לשרתון)');
  ok(sb.__rendered.join('|') === 'BBB', 'מצייר רק את מה שזז (BBB 21→22)');
  ok(run('state.source') === 'Yahoo' && run('state.live') === true, 'מקור: Yahoo חי');
  calls.length = 0;
  await A('liveTick')();
  ok(calls.length === 1 && /BBB/.test(calls[0]), 'טיק מהיר: רק הכרטיס הפתוח');

  // מחירים לא זזים → האטה לדקה (שוק סגור)
  run('live.n = 0; live.still = 0;');
  for (let i = 0; i < 2 * A('LIVE_IDLE_AFTER') + 2; i++) await A('liveTick')();
  ok(run('live.still') >= run('LIVE_IDLE_AFTER'), 'בלי תזוזה LIVE_IDLE_AFTER טיקים מלאים → מצב איטי (v165: 15 = ~דקה)');

  // Yahoo נכשל → CNBC בבקשה אחת
  run(`fetchJSONTimeout = async (u) => { __calls.push(u); if (/yahoo/.test(u)) throw new Error('blocked');
        return {}; };
       parseCNBCQuotes = () => ({ AAA: { close: 11 }, BBB: { close: 23 } });
       live.n = 0;`);
  calls.length = 0;
  await A('liveTick')();
  ok(calls.filter((u) => /cnbc/.test(u)).length === 1, 'Yahoo חסום → CNBC בבקשה אחת');
  ok(run('state.source') === 'CNBC' && run('state.live') === false, 'CNBC מסומן "דיליי", לא "חי"');

  // --- 6ב. שיא חדש במחיר החי ---
  run(`POSITIONS.length = 0; POSITIONS.push({ sym: 'AAA', shares: 1, avg: 1 });
       state.hist.AAA = [{ date: '2026-09-01', close: 100 }, { date: '2026-09-23', close: 103 }];
       state.quotes.AAA = { close: 108, mdate: '2026-09-24' };`);
  const mt = A('metrics')('AAA');
  ok(mt.ath.price === 108 && mt.ath.date === '2026-09-24', 'מחיר חי מעל השיא ההיסטורי → ATH = המחיר החי והיום');
  run(`state.quotes.AAA = { close: 90, mdate: '2026-09-24' };`);
  ok(A('metrics')('AAA').ath.price === 103, 'מתחת לשיא → ATH מההיסטוריה');

  // --- 7. חיווט: עדכון במקום, לא בנייה מחדש ---
  const rl = src.slice(src.indexOf('function renderLive('), src.indexOf('function intradayLiveRows('));
  ok(!/renderStocks\(|renderAll\(/.test(rl), 'renderLive לא בונה מחדש את רשימת המניות (לא מאפס טפסים/מיון/מדידה)');
  ok(/renderOverview\(true\)/.test(rl), 'renderLive: סקירה במצב קל');
  ok(/if \(!light\) \{\s*try \{ drawPfChart\(\)/.test(src), 'מצב קל: בלי גרף הביצועים');
  ok(/refreshQuotes\(\)\.then\(\(\) => \{ warmHistories\(\); liveStart\(\); \}\)/.test(src), 'הלולאה מתחילה אחרי טעינת המחירים הראשונה');
  ok(/state\.ibkrSyncing = !!busy/.test(src), 'סנכרון IBKR מסמן busy לעצירת הטיק');

  const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
  ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('נכשל:', e && e.stack || e); process.exit(1); });
