// pf-v110.test.js — רגרסיית יבוא IBKR: חלק אחרון נכשל → אין התקנה שקטה של פוזיציות ישנות
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let n = 0;
function ok(cond, name) {
  n++;
  if (!cond) { console.error('FAIL - ' + name); process.exit(1); }
  console.log('ok - ' + name);
}

// סנדבוקס עם כל app.js (צריך state/t/localStorage ברמה העליונה)
function makeSandbox() {
  const store = {};
  const sb = {
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    document: {
      addEventListener() {},
      getElementById: () => null,
      querySelectorAll: () => [], querySelector: () => null,
      createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }),
    },
    window: {}, navigator: {}, location: {},
    AbortController, fetch: (...a) => fetch(...a),
    setTimeout, clearTimeout, console,
  };
  vm.createContext(sb);
  vm.runInContext(src, sb);
  return sb;
}

// stub ל־fetchFn: תסריט תגובות לפי fd של החלק (ה־statement מזוהה לפי code)
function stubFetch(scenarios) {
  // scenarios: { [fd]: { req: [resp...], stmt: [resp...] } }
  const code2fd = {};
  const fn = async (url, opts) => {
    const body = JSON.parse(opts.body || '{}');
    if (url.includes('/api/flex-request')) {
      const fd = body.fd || 'nofd';
      const sc = scenarios[fd] || scenarios['*'] || {};
      const r = (sc.req || []).shift() || { ok: true, referenceCode: 'RC-' + fd };
      if (r.referenceCode) code2fd[r.referenceCode] = fd;
      return { json: async () => r };
    }
    if (url.includes('/api/flex-statement')) {
      const fd = code2fd[body.code] || 'nofd';
      const sc = scenarios[fd] || scenarios['*'] || {};
      const r = (sc.stmt || []).shift() || { ok: true, status: 'ready', data: {} };
      return { json: async () => r };
    }
    throw new Error('unexpected url ' + url);
  };
  return fn;
}

const pos5 = [1, 2, 3, 4, 5].map((i) => ({ symbol: 'S' + i, qty: 10, asset: 'STK', currency: 'USD', levelOfDetail: 'SUMMARY' }));
const pos9 = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ symbol: 'S' + i, qty: 10, asset: 'STK', currency: 'USD', levelOfDetail: 'SUMMARY' }));
const trades = (k, base) => new Array(k).fill(0).map((_, i) => ({ date: '2026-0' + (1 + (i % 5)) + '-1' + (i % 9), symbol: 'S1', quantity: 1, price: (base || 0) + 100 + i, buySell: 'BUY' }));

async function main() {
  const sb = makeSandbox();
  const fetchFull = vm.runInContext('ibkrFetchFullHistory', sb);
  const isComplete = vm.runInContext('ibkrSyncIsComplete', sb);
  const chunksOf = vm.runInContext('ibkrDateChunks', sb);

  // מבנה החלקים: startYmd של לפני 400 יום → בדיוק שני חלקים, האחרון עד היום
  const t0 = new Date(); t0.setDate(t0.getDate() - 400);
  const ymd = (d) => d.getFullYear().toString().padStart(4, '0') +
    (d.getMonth() + 1).toString().padStart(2, '0') + d.getDate().toString().padStart(2, '0');
  const startYmd = ymd(t0);
  const yest = vm.runInContext('ibkrLastClosedDate', sb)(); // v136: אתמול לפי ניו־יורק
  const chunks = chunksOf(startYmd, ymd(yest));
  ok(chunks.length === 2, 'שני חלקים ל־400 יום (קיבלנו ' + chunks.length + ')');
  const [c1, c2] = chunks;

  // --- 1. החלק האחרון נכשל → הפוזיציות מסומנות כלא־עדכניות, הייבוא חסום ---
  {
    const fetchFn = stubFetch({
      [c1.fd]: { stmt: [{ ok: true, status: 'ready', data: { positions: pos5, trades: trades(13), cashTransactions: [] } }] },
      [c2.fd]: { stmt: [{ ok: false, error: 'flex_1020' }, { ok: false, error: 'flex_1020' }] }, // נכשל גם בניסיון החוזר
    });
    const data = await fetchFull(fetchFn, 'https://proxy', 'tok', 'qid', startYmd, null, { chunkGapMs: 5 });
    ok(data.latestChunkOk === false, 'latestChunkOk=false כשהחלק האחרון נכשל');
    ok(data.positionsAsOf === c1.td, 'positionsAsOf מצביע על החלק הישן');
    ok(data.positions.length === 5, 'פוזיציות הגיבוי נשמרות (5) אך מסומנות כישנות');
    ok(data.trades.length === 13, 'רק עסקאות החלק שהצליח (13)');
    ok(isComplete(data) === false, 'ibkrSyncIsComplete=false → הייבוא ייחסם');
    const fails = data._chunks.filter((c) => !c.ok);
    ok(fails.length === 1 && fails[0].fd === c2.fd, 'הדיאגנוסטיקה מסמנת את החלק האחרון כנכשל');
  }

  // --- 2. שני החלקים הצליחו → 9 פוזיציות מהחלק האחרון ---
  {
    const fetchFn = stubFetch({
      [c1.fd]: { stmt: [{ ok: true, status: 'ready', data: { positions: pos5, trades: trades(5, 0), cashTransactions: [] } }] },
      [c2.fd]: { stmt: [{ ok: true, status: 'ready', data: { positions: pos9, trades: trades(8, 1000), cashTransactions: [] } }] },
    });
    const data = await fetchFull(fetchFn, 'https://proxy', 'tok', 'qid', startYmd, null, { chunkGapMs: 5 });
    ok(data.latestChunkOk === true, 'latestChunkOk=true כששני החלקים הצליחו');
    ok(data.positions.length === 9, 'הפוזיציות נלקחו מהחלק האחרון (9), לא מהישן (5)');
    ok(data.positionsAsOf === c2.td, 'positionsAsOf = החלק האחרון');
    ok(isComplete(data) === true, 'ibkrSyncIsComplete=true → מותר לייבא');
    ok(data.trades.length === 13, 'עסקאות משני החלקים מוזגו (5+8)');
  }

  // --- 3. החלק האחרון הצליח עם 0 פוזיציות → תיק ריק לגיטימי, לא "ישן" ---
  {
    const fetchFn = stubFetch({
      [c1.fd]: { stmt: [{ ok: true, status: 'ready', data: { positions: pos5, trades: [], cashTransactions: [] } }] },
      [c2.fd]: { stmt: [{ ok: true, status: 'ready', data: { positions: [], trades: [], cashTransactions: [] } }] },
    });
    const data = await fetchFull(fetchFn, 'https://proxy', 'tok', 'qid', startYmd, null, { chunkGapMs: 5 });
    ok(data.latestChunkOk === true, 'latestChunkOk=true גם כשהפוזיציות ריקות');
    ok(data.positions.length === 0, 'תיק ריק נשמר כריק — לא נופל לגיבוי הישן');
    ok(isComplete(data) === true, 'תיק ריק לגיטימי לא נחסם');
  }

  // --- 4. ניסיון חוזר אוטומטי: כשל ראשון, הצלחה בשני → תקין ---
  {
    const fetchFn = stubFetch({
      [c1.fd]: { stmt: [{ ok: true, status: 'ready', data: { positions: pos5, trades: [], cashTransactions: [] } }] },
      [c2.fd]: { stmt: [{ ok: false, error: 'timeout' }, { ok: true, status: 'ready', data: { positions: pos9, trades: trades(3, 2000), cashTransactions: [] } }] },
    });
    const data = await fetchFull(fetchFn, 'https://proxy', 'tok', 'qid', startYmd, null, { chunkGapMs: 5 });
    ok(data.latestChunkOk === true, 'ניסיון חוזר הצליח → latestChunkOk=true');
    ok(data.positions.length === 9, 'אחרי ניסיון חוזר: 9 פוזיציות עדכניות');
    ok(data._chunks.filter((c) => !c.ok).length === 0, 'אין חלקים כושלים אחרי ניסיון חוזר מוצלח');
  }

  // --- 5. החלק הראשון נכשל, האחרון הצליח → עדיין תקין (אין גיבוי ישן דרוס) ---
  {
    const fetchFn = stubFetch({
      [c1.fd]: { stmt: [{ ok: false, error: 'x' }, { ok: false, error: 'x' }] },
      [c2.fd]: { stmt: [{ ok: true, status: 'ready', data: { positions: pos9, trades: trades(4, 3000), cashTransactions: [] } }] },
    });
    const data = await fetchFull(fetchFn, 'https://proxy', 'tok', 'qid', startYmd, null, { chunkGapMs: 5 });
    ok(data.latestChunkOk === true, 'כשל בחלק הישן לא חוסם כשהאחרון הצליח');
    ok(data.positions.length === 9, '9 פוזיציות מהחלק האחרון');
    ok(isComplete(data) === true, 'מותר לייבא (הדיאגנוסטיקה תראה את החלק החסר)');
  }

  // --- 6. i18n: מחרוזת החסימה קיימת בשתי השפות ---
  {
    const S = vm.runInContext('STRINGS', sb);
    ok(S.he.importPartialBlocked && S.en.importPartialBlocked, 'importPartialBlocked בעברית ובאנגלית');
    ok(!/5 מניות|9/.test(S.he.importPartialBlocked), 'המחרוזת גנרית (לא מזכירה מספרים ספציפיים)');
  }

  // --- 7. ibkrSyncImport לא שומר נתונים חלקיים (בדיקת קוד סטטית) ---
  // הדרישה הסמנטית: בדיקת ibkrSyncIsComplete בתוך ibkrSyncImport, לפני כל
  // נתיב ששומר/מייבא (ibkrFinishImport / saveDB). שם המשתנה אינו חלק מהחוזה.
  {
    const syncFn = src.slice(src.indexOf('async function ibkrSyncImport'));
    const syncBody = syncFn.slice(0, syncFn.indexOf('\n}\n'));
    const checkIdx = syncBody.indexOf('ibkrSyncIsComplete(');
    ok(checkIdx > 0, 'ibkrSyncImport בודק שלמות לפני שמירה');
    const importIdx = syncBody.indexOf('ibkrReviewImport(');
    ok(importIdx === -1 || checkIdx < importIdx,
      'הבדיקה מתבצעת לפני כל יבוא — אין דריסת נתונים טובים בחלקיים');
    ok(/ibkrSyncIsComplete\([\s\S]{0,800}return ibkrShowErr/.test(syncBody),
      'כשלון שלמות -> חזרה מוקדמת עם שגיאה, בלי יבוא');
  }

  // --- 8. גרסה דינמית ---
  ok(/const APP_VERSION = 'v\d+'/.test(src), 'APP_VERSION מוגדר');
  const cacheLine = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE_NAME = '([^']+)'/);
  ok(cacheLine && cacheLine[1].endsWith(src.match(/const APP_VERSION = '(v\d+)'/)[1]), 'CACHE_NAME תואם לגרסה');

  console.log('\n' + n + ' בדיקות עברו');
}

main().catch((e) => { console.error('FAIL -', e); process.exit(1); });
