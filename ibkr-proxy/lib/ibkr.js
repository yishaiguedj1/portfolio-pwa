/* Stateless IBKR Flex Web Service proxy.
   אין כאן שום סוד: הטוקן ומזהה השאילתה מגיעים בכל בקשה מהמשתמש.
   POST /api/flex-request   { token, queryId } -> { ok, referenceCode, statementUrl }
   GET  /api/flex-statement?token=..&code=.. [&to=YYYYMMDD]
        -> { ok, status: 'pending'|'ready', data? }  |  { ok:false, error }
*/

const IBKR_HOST = 'https://ndcdyn.interactivebrokers.com';
/* כל שרתי ה-Flex הידועים של IBKR, קשיחים בקוד.
   חשבונות אמריקאים יושבים על ndcdyn, אירופאים/בריטים על gdcdyn —
   טוקן מאזור אחד מקבל 403 מהשרת של האזור השני. */
const IBKR_HOSTS_LIST = [
  'https://ndcdyn.interactivebrokers.com',
  'https://gdcdyn.interactivebrokers.com',
];
const UA = ibkrUserAgent();

/* Hosts that IBKR itself may return in SendRequest <Url>. Strict allowlist —
   the client passes statementUrl back to us, so we never fetch an arbitrary host. */
const IBKR_HOSTS = new Set(['ndcdyn.interactivebrokers.com', 'gdcdyn.interactivebrokers.com']);
/* הנתיבים הרשמיים של Flex Web Service v3 (לפי IBKR והספרייה ibflex).
   שימו לב: הנתיב הישן /Universal/servlet/... מוחזר ממנו כיום תמיד 1001 —
   חובה להשתמש ב-/AccountManagement/FlexWebService. */
const FLEX_SEND_PATH = '/AccountManagement/FlexWebService/SendRequest';
const FLEX_GET_PATH = '/AccountManagement/FlexWebService/GetStatement';
/* IBKR דורש User-Agent מזוהה. ה-edge חוסם מחרוזות לא מוכרות (403) —
   לכן שולחים את הטכנולוגיה האמיתית (Node.js) כפי שהתיעוד מבקש. */
function ibkrUserAgent() {
  return 'Node.js/' + process.version.replace(/^v/, '');
}
function statementBaseFrom(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (u.protocol !== 'https:') return null;
    if (!IBKR_HOSTS.has(u.hostname.toLowerCase())) return null;
    return u.origin;
  } catch {
    return null;
  }
}
/* מחזיר { base, path } מתוך statementUrl ש-IBKR החזיר — רק אם ההוסט והנתיב
   שייכים ל-Flex. אחרת null והקוד ישתמש בברירות המחדל הקשיחות. */
function statementEndpointFrom(url) {
  try {
    const u = new URL(String(url || '').trim());
    if (u.protocol !== 'https:') return null;
    if (!IBKR_HOSTS.has(u.hostname.toLowerCase())) return null;
    const p = u.pathname || '';
    if (!/^\/AccountManagement\/FlexWebService\/(GetStatement|SendRequest)/.test(p)) return null;
    return { base: u.origin, path: p };
  } catch {
    return null;
  }
}

/* ---------- CORS ---------- */
function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ---------- simple per-IP rate limit (best effort on serverless) ---------- */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > 20; // 20 בקשות לדקה ל-IP
}

/* ---------- minimal XML -> tree (Flex uses attributes, no mixed content) ---------- */
function decodeEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function parseXml(xml) {
  xml = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '');
  const root = { tag: '#root', attrs: {}, children: [] };
  const stack = [root];
  const re = /<([^>]+)>/g;
  let m;
  while ((m = re.exec(xml))) {
    const raw = m[1].trim();
    if (!raw || raw.startsWith('!')) continue;
    if (raw[0] === '/') { // closing
      if (stack.length > 1) stack.pop();
      continue;
    }
    const selfClose = raw.endsWith('/');
    const body = selfClose ? raw.slice(0, -1).trim() : raw;
    const sp = body.search(/\s/);
    const tag = sp === -1 ? body : body.slice(0, sp);
    const attrs = {};
    const are = /([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g;
    let am;
    while ((am = are.exec(body))) attrs[am[1]] = decodeEntities(am[2]);
    const node = { tag, attrs, children: [] };
    stack[stack.length - 1].children.push(node);
    if (!selfClose) stack.push(node);
  }
  return root;
}

function findKids(node, tag) {
  const out = [];
  const walk = (n) => {
    for (const c of n.children || []) {
      if (c.tag === tag) out.push(c);
      walk(c);
    }
  };
  walk(node);
  return out;
}
function firstKid(node, tag) {
  const k = findKids(node, tag);
  return k.length ? k[0] : null;
}
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
};
/* Flex dateTime: "20240102;093000" or "2024-01-02;09:30:00" -> "2024-01-02" */
function flexDate(dt) {
  if (!dt) return '';
  const d = String(dt).split(';')[0].replace(/-/g, '');
  if (/^\d{8}$/.test(d)) return d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8);
  return String(dt).split(';')[0];
}

/* ---------- Flex statement -> clean JSON ---------- */
function statementToJson(tree) {
  const st = firstKid(tree, 'FlexStatement') || { attrs: {}, children: [] };
  const a = st.attrs || {};
  const out = {
    meta: {
      accountId: a.accountId || '',
      fromDate: flexDate(a.fromDate),
      toDate: flexDate(a.toDate),
      baseCurrency: a.baseCurrency || 'USD',
    },
    trades: [],
    positions: [],
    cashTransactions: [],
    nav: null,
    cashBalances: [],
  };

  for (const t of findKids(st, 'Trade')) {
    const x = t.attrs;
    out.trades.push({
      symbol: x.symbol || '',
      date: flexDate(x.dateTime || x.date || x.tradeDate),
      qty: num(x.quantity),
      price: num(x.tradePrice),
      proceeds: num(x.proceeds),
      commission: num(x.ibCommission),
      commissionCurrency: x.ibCommissionCurrency || '',
      taxes: num(x.taxes),
      netCash: num(x.netCash),
      realized: num(x.fifoPnlRealized),
      side: x.buySell || '',
      openClose: x.openCloseIndicator || '',
      exchange: x.exchange || '',
      tradeId: x.tradeID || x.transactionID || '',
      currency: x.currency || '',
      fxToBase: num(x.fxRateToBase) || 1,
    });
  }
  // פוזיציות: מעדיפים SUMMARY לכל סימבול; לסימבול שאין לו SUMMARY מצרפים LOT-ים.
  // (LOT הוא פירוט כפול של אותה פוזיציה — לא סופרים פעמיים.)
  const posSums = new Map(), posLots = new Map();
  const pAdd = (a, b) => (isFinite(a) ? a : 0) + (isFinite(b) ? b : 0);
  for (const p of findKids(st, 'OpenPosition')) {
    const x = p.attrs;
    const lod = String(x.levelOfDetail || '').toUpperCase();
    const sym = String(x.symbol || '').trim();
    const qty = num(x.position);
    if (!sym || !isFinite(qty) || qty === 0) continue;
    const pos = {
      symbol: sym,
      asset: x.assetCategory || '',
      qty: qty,
      markPrice: num(x.markPrice),
      marketValue: num(x.positionValue),
      costBasis: num(x.costBasisMoney),
      unrealized: num(x.fifoPnlUnrealized),
      currency: x.currency || '',
      fxToBase: num(x.fxRateToBase) || 1,
      levelOfDetail: lod || 'SUMMARY',
    };
    if (lod === 'LOT') {
      const a = posLots.get(sym);
      if (!a) posLots.set(sym, { ...pos, lots: 1 });
      else {
        a.qty = pAdd(a.qty, pos.qty);
        a.marketValue = pAdd(a.marketValue, pos.marketValue);
        a.costBasis = pAdd(a.costBasis, pos.costBasis);
        a.unrealized = pAdd(a.unrealized, pos.unrealized);
        a.lots++;
      }
    } else {
      // SUMMARY או levelOfDetail חסר (נתוני בדיקה ישנים) — מעדיפים
      posSums.set(sym, pos);
    }
  }
  for (const p of posSums.values()) out.positions.push(p);
  for (const [sym, a] of posLots) {
    if (posSums.has(sym) || a.qty === 0) continue;
    a.markPrice = a.qty ? a.marketValue / a.qty : NaN;
    out.positions.push(a);
  }
  for (const c of findKids(st, 'CashTransaction')) {
    const x = c.attrs;
    out.cashTransactions.push({
      date: flexDate(x.dateTime || x.date),
      amount: num(x.amount),
      currency: x.currency || '',
      fxToBase: num(x.fxRateToBase) || 1,
      type: x.type || '',
      description: x.description || '',
    });
  }
  /* Transfers: הפקדות/משיכות בין חשבונות (כולל INTERNAL) — נחשבות תזרים.
     direction=IN → סכום חיובי, OUT → שלילי.
     גיבוי: אם ה־direction לא אמין, בודקים את התיאור "TRANSFER FROM X TO Y". */
  for (const c of findKids(st, 'Transfer')) {
    const x = c.attrs;
    const amt = num(x.cashTransfer);
    if (!isFinite(amt) || amt === 0) continue;
    let dir = String(x.direction || '').toUpperCase();
    const acctId = String(x.accountId || '').toUpperCase();
    const desc = String(x.description || '').toUpperCase();
    // גיבוי מהתיאור: "TRANSFER FROM {accountId} TO ..." = OUT
    if (acctId && desc.includes('TRANSFER FROM ' + acctId + ' TO')) {
      dir = 'OUT';
    } else if (acctId && desc.includes(' TO ' + acctId)) {
      // "TRANSFER FROM X TO {accountId}" = IN (ברירת מחדל)
      if (dir !== 'OUT') dir = 'IN';
    }
    const signed = dir === 'OUT' ? -Math.abs(amt) : Math.abs(amt);
    out.cashTransactions.push({
      date: flexDate(x.dateTime || x.date),
      amount: signed,
      currency: x.currency || '',
      fxToBase: num(x.fxRateToBase) || 1,
      type: 'Transfer ' + (dir === 'OUT' ? 'OUT' : 'IN'),
      description: x.description || '',
    });
  }
  /* ChangeInNAV: שורה אחת = סיכום תקופה; כמה שורות = פירוט יומי (Level=Detail).
     twr הוא אחוז (12.34 = 12.34%). בריבוי שורות מרכיבים TWR תקופתי. */
  out.navHistory = [];
  for (const el of findKids(st, 'ChangeInNAV')) {
    const x = el.attrs;
    out.navHistory.push({
      fromDate: flexDate(x.fromDate),
      toDate: flexDate(x.toDate),
      startingValue: num(x.startingValue),
      endingValue: num(x.endingValue),
      twr: x.twr !== undefined && x.twr !== '' ? num(x.twr) : null,
      mtm: num(x.mtm),
      // תזרימים חיצוניים בתקופה (הפקדות/משיכות/העברות) — בלעדיהם כל הפקדה
      // נספרת כ"רווח". אותם שדות ש־IBKR מנטרל בחישוב ה־TWR.
      flows: ['depositsWithdrawals', 'assetTransfers', 'internalCashTransfers', 'debitCardActivity', 'billPay']
        .reduce((a, k) => a + num(x[k]), 0),
    });
  }
  /* NAV יומי (סעיף Flex: "Net Asset Value (NAV) in Base") — שורה לכל יום
     דיווח. מאפשר תשואה לכל טווח (חודש/שנה/YTD) ולא רק לתקופות הדוח. */
  const navDay = new Map();
  for (const el of findKids(st, 'EquitySummaryByReportDateInBase')) {
    const x = el.attrs || {};
    const date = flexDate(x.reportDate || x.date);
    if (x.total === undefined || x.total === '') continue; // num() מחזיר 0 לחסר — לא NAV אמיתי
    if (/^\d{4}-\d{2}-\d{2}$/.test(date || '')) navDay.set(date, num(x.total));
  }
  out.navDaily = [...navDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, total]) => ({ date, total }));
  if (out.navHistory.length === 1) {
    const r = out.navHistory[0];
    out.nav = { startingValue: r.startingValue, endingValue: r.endingValue, twr: r.twr, mtm: r.mtm };
  } else if (out.navHistory.length > 1) {
    let f = 1, twrOk = true, mtmSum = 0;
    for (const r of out.navHistory) {
      if (r.twr === null || !isFinite(r.twr)) { twrOk = false; break; }
      f *= 1 + r.twr / 100;
    }
    for (const r of out.navHistory) mtmSum += r.mtm || 0;
    const first = out.navHistory[0], last = out.navHistory[out.navHistory.length - 1];
    out.nav = {
      startingValue: first.startingValue,
      endingValue: last.endingValue,
      twr: twrOk ? (f - 1) * 100 : null,
      mtm: mtmSum,
    };
  }
  for (const tag of ['CashReport', 'CashBalances', 'ForexBalances']) {
    for (const sec of findKids(st, tag)) {
      for (const c of sec.children || []) {
        const x = c.attrs || {};
        const cur = x.currency || x.curr || '';
        const bal = x.cashBalance !== undefined ? num(x.cashBalance)
          : x.cash !== undefined ? num(x.cash)
          : x.balance !== undefined ? num(x.balance) : null;
        if (cur && bal !== null) out.cashBalances.push({ currency: cur, balance: bal });
      }
    }
  }
  return out;
}

/* ---------- IBKR calls ---------- */
/* קריאה ל־IBKR עם הגבלת זמן: אחרת Vercel הורג את הפונקציה אחרי maxDuration
   והאפליקציה מקבלת תשובה לא־JSON — ונראית "תקועה". */
async function ibkrGet(url, timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || IBKR_CALL_BUDGET_MS);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    const text = await r.text();
    return { status: r.status, text };
  } finally { clearTimeout(timer); }
}

function errorXml(text) {
  // Flex returns <Status>Fail</Status> (SendRequest) or <Status>Error</Status>
  // with <ErrorCode>1018</ErrorCode><ErrorMessage>..</ErrorMessage>
  const mCode = text.match(/<ErrorCode>\s*(\d+)\s*<\/ErrorCode>/);
  const mMsg = text.match(/<ErrorMessage>\s*([^<]*)\s*<\/ErrorMessage>/);
  const mStatus = text.match(/<Status>\s*([^<]*)\s*<\/Status>/);
  if (mStatus && /fail|error/i.test(mStatus[1])) {
    return { code: mCode ? mCode[1] : '?', message: mMsg ? mMsg[1].trim() : 'Flex error' };
  }
  return null;
}

/* מנסה כל הוסט קשיח של IBKR לפי הסדר; הראשון עם HTTP 200 מנצח.
   תשובת 200 עם XML שגיאה היא תשובה סופית — לא מנסים הוסט נוסף.
   ההוסטים קשיחים בקוד, לעולם לא נגזרים מקלט משתמש. */
const IBKR_CALL_BUDGET_MS = 24000; // תקציב זמן כולל לכל ההוסטים — מתחת ל־maxDuration=30 של Vercel
async function ibkrGetMulti(path, firstHost, budgetMs) {
  const hosts = firstHost
    ? [firstHost, ...IBKR_HOSTS_LIST.filter((h) => h !== firstHost)]
    : [...IBKR_HOSTS_LIST];
  const deadline = Date.now() + (budgetMs || IBKR_CALL_BUDGET_MS);
  let last = { status: 0, text: '' };
  for (const host of hosts) {
    const left = deadline - Date.now();
    if (left < 2000) break; // לא מתחילים הוסט נוסף בלי זמן להשלים אותו
    try {
      const r = await ibkrGet(host + path, left);
      if (r.status === 200) return r;
      last = r;
    } catch (e) { last = { status: 0, text: '' }; }
  }
  return last;
}

module.exports = {
  IBKR_HOST, IBKR_HOSTS, IBKR_HOSTS_LIST, FLEX_SEND_PATH, FLEX_GET_PATH, ibkrUserAgent,
  statementBaseFrom, statementEndpointFrom, cors, rateLimited, parseXml, findKids, firstKid,
  statementToJson, ibkrGet, ibkrGetMulti, errorXml, flexDate, num,
};
