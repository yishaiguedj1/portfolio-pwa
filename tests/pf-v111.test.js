// pf-v111.test.js — flex_1003 ("הדוח לא זמין"): סיום באתמול, ניסיונות חכמים, הודעות
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

// stub עם ספירת קריאות לכל fd (לפי code של ה־statement)
function stubFetch(scenarios) {
  const code2fd = {};
  const reqCount = {};
  const fn = async (url, opts) => {
    const body = JSON.parse(opts.body || '{}');
    if (url.includes('/api/flex-request')) {
      const fd = body.fd || 'nofd';
      reqCount[fd] = (reqCount[fd] || 0) + 1;
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
  fn.reqCount = reqCount;
  return fn;
}

const ymd = (d) => d.getFullYear().toString().padStart(4, '0') +
  (d.getMonth() + 1).toString().padStart(2, '0') + d.getDate().toString().padStart(2, '0');
const pos9 = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ({ symbol: 'S' + i, qty: 10, asset: 'STK', currency: 'USD', levelOfDetail: 'SUMMARY' }));

async function main() {
  const sb = makeSandbox();
  const fetchFull = vm.runInContext('ibkrFetchFullHistory', sb);
  const retryPlan = vm.runInContext('ibkrChunkRetryPlan', sb);
  const S = vm.runInContext('STRINGS', sb);

  const yest = vm.runInContext('ibkrLastClosedDate', sb)(); // v136: אתמול לפי ניו־יורק
  const yestYmd = ymd(yest);
  const todayYmd = ymd(new Date());
  const t0 = new Date(); t0.setDate(t0.getDate() - 400);
  const startYmd = ymd(t0);

  // --- 1. החלק האחרון מסתיים באתמול — אין יותר חלק "היום" בן־יום־אחד ---
  {
    const fetchFn = stubFetch({ '*': { stmt: [{ ok: true, status: 'ready', data: { positions: pos9, trades: [], cashTransactions: [] } }] } });
    const data = await fetchFull(fetchFn, 'https://proxy', 'tok', 'qid', startYmd, null, { chunkGapMs: 5 });
    const last = data._chunks[data._chunks.length - 1];
    ok(last.td === yestYmd, 'החלק האחרון מסתיים באתמול (' + last.td + ')');
    ok(!data._chunks.some((c) => c.td === todayYmd), 'אף חלק לא מסתיים בהיום — אין חלק "היום" שנידון ל־1003');
    ok(data.latestChunkOk === true, 'סנכרון תקין עד אתמול');
  }

  // --- 2. תכנית ניסיונות: 1003 → 3 ניסיונות בהפוגות ארוכות; אחרת → 2 קצרים ---
  {
    const p1 = retryPlan(new Error('שרתון: flex_1003 — Statement is not available.'));
    ok(p1.attempts === 3 && p1.waitMs === 15000, '1003: 3 ניסיונות × 15 שניות');
    const p2 = retryPlan(new Error('שרתון: flex_1020'));
    ok(p2.attempts === 2 && p2.waitMs === 3000, 'שגיאה אחרת: 2 ניסיונות × 3 שניות');
    const p3 = retryPlan(new Error('boom'));
    ok(p3.attempts === 2, 'שגיאת רשת: ברירת מחדל מהירה');
  }

  // --- 3. 1003 פעמיים ואז הצלחה → 9 פוזיציות (3 קריאות request לחלק) ---
  {
    const chunksOf = vm.runInContext('ibkrDateChunks', sb);
    const chunks = chunksOf(startYmd, yestYmd);
    const [c1, c2] = [chunks[0], chunks[chunks.length - 1]];
    const fetchFn = stubFetch({
      [c1.fd]: { stmt: [{ ok: true, status: 'ready', data: { positions: [], trades: [], cashTransactions: [] } }] },
      [c2.fd]: { stmt: [
        { ok: false, error: 'flex_1003', message: 'Statement is not available.' },
        { ok: false, error: 'flex_1003', message: 'Statement is not available.' },
        { ok: true, status: 'ready', data: { positions: pos9, trades: [], cashTransactions: [] } },
      ] },
    });
    const data = await fetchFull(fetchFn, 'https://proxy', 'tok', 'qid', startYmd, null, { chunkGapMs: 5 });
    ok(data.latestChunkOk === true, 'אחרי שני 1003 וניסיון שלישי מוצלח — תקין');
    ok(data.positions.length === 9, '9 פוזיציות עדכניות');
    ok(fetchFn.reqCount[c2.fd] === 3, 'החלק עם 1003 ניסה 3 פעמים (קיבלנו ' + fetchFn.reqCount[c2.fd] + ')');
  }

  // --- 4. הודעת IBKR המקורית מופיעה בדיאגנוסטיקה ---
  {
    const chunksOf = vm.runInContext('ibkrDateChunks', sb);
    const chunks = chunksOf(startYmd, yestYmd);
    const c2 = chunks[chunks.length - 1];
    const fetchFn = stubFetch({
      // v123: 1003 כבר מקבל את מכסת הניסיונות המלאה (ibkrChunkRetryPlan) —
      // סבב הניסיון הנוסף בסוף ibkrFetchFullHistory לא חוזר על 1003
      [c2.fd]: { stmt: [
        { ok: false, error: 'flex_1003', message: 'Statement is not available.' },
        { ok: false, error: 'flex_1003', message: 'Statement is not available.' },
        { ok: false, error: 'flex_1003', message: 'Statement is not available.' },
        // v136: + ניסיון הגיבוי שמסתיים יום מסחר קודם
        { ok: false, error: 'flex_1003', message: 'Statement is not available.' },
      ] },
    });
    const data = await fetchFull(fetchFn, 'https://proxy', 'tok', 'qid', startYmd, null, { chunkGapMs: 5 });
    const fail = data._chunks.find((c) => !c.ok);
    ok(fail && /Statement is not available/.test(fail.error), 'הודעת IBKR המקורית נשמרת בדיאגנוסטיקה');
    ok(data.latestChunkOk === false, 'אחרי 3 כשלונות — החלק האחרון מסומן ככושל');
  }

  // --- 5. i18n ---
  {
    ok(S.he.ibkrErr1003 && S.en.ibkrErr1003, 'ibkrErr1003 בשתי השפות');
    ok(S.he.importNotAvailable && S.en.importNotAvailable, 'importNotAvailable בשתי השפות');
    ok(/מאוחר|בוקר/.test(S.he.importNotAvailable), 'ההודעה מסבירה לנסות מאוחר יותר');
    ok(!/token|טוקן/.test(S.he.importNotAvailable), 'ההודעה לא שולחת לתקן את החיבור');
  }

  // --- 6. ibkrSyncImport בוחר הודעת "עדיין לא זמין" כשכל הכשלונות 1003 ---
  {
    ok(src.includes("fails.every((c) => /flex_1003/.test(c.error || ''))"), 'זיהוי "הכל 1003" לפני בחירת ההודעה');
    ok(src.includes("notAvail ? t('importNotAvailable') : t('importPartialBlocked')"), 'בחירת הודעה מותנית בסוג הכשל');
  }

  // --- 7. גרסה ---
  {
    ok(/const APP_VERSION = 'v\d+'/.test(src), 'APP_VERSION מוגדר');
    const cacheLine = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE_NAME = '([^']+)'/);
    ok(cacheLine && cacheLine[1].endsWith(src.match(/const APP_VERSION = '(v\d+)'/)[1]), 'CACHE_NAME תואם לגרסה');
  }

  console.log('\n' + n + ' בדיקות עברו');
}

main().catch((e) => { console.error('FAIL -', e); process.exit(1); });
