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
      realized: num(x.fifoPnlRealized),
      side: x.buySell || '',
      currency: x.currency || '',
      fxToBase: num(x.fxRateToBase) || 1,
    });
  }
  for (const p of findKids(st, 'OpenPosition')) {
    const x = p.attrs;
    out.positions.push({
      symbol: x.symbol || '',
      qty: num(x.position),
      markPrice: num(x.markPrice),
      marketValue: num(x.positionValue),
      costBasis: num(x.costBasisMoney),
      unrealized: num(x.fifoPnlUnrealized),
      currency: x.currency || '',
    });
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
  const navEl = firstKid(st, 'ChangeInNAV');
  if (navEl) {
    const x = navEl.attrs;
    out.nav = {
      startingValue: num(x.startingValue),
      endingValue: num(x.endingValue),
      twr: x.twr !== undefined && x.twr !== '' ? num(x.twr) : null,
      mtm: num(x.mtm),
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
async function ibkrGet(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  const text = await r.text();
  return { status: r.status, text };
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
async function ibkrGetMulti(path, firstHost) {
  const hosts = firstHost
    ? [firstHost, ...IBKR_HOSTS_LIST.filter((h) => h !== firstHost)]
    : [...IBKR_HOSTS_LIST];
  let last = { status: 0, text: '' };
  for (const host of hosts) {
    try {
      const r = await ibkrGet(host + path);
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
