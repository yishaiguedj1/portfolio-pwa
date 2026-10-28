'use strict';
/* הגשר ל־IB Gateway — שלב 1 ב־מחקר-מסחר-IBKR.md (28/10/2026): Paper, ‏Read-Only. רק בחדר האפליקציה בשרת שלנו.

   למה בלי ספרייה (@stoqey/ib): לשרתון אין אף תלות (infra/app/Dockerfile — בלי npm install, בלי שרשרת אספקה).
   צריך רק חלק קטן מה־TWS API — חיבור, אחזקות, יתרות ופקודות פתוחות — וזה כאן, כ־200 שורות.

   הפרוטוקול (TWS API, סוקט TCP): כל הודעה = אורך (4 בתים, big-endian) + שדות טקסט שכל אחד נגמר ב־\0.
   פתיחה: "API\0" + "v100..176" → השרת עונה בגרסה ובשעה → startApi (71) → nextValidId (9) = מחוברים.
   הגרסה המקסימלית נעולה ל־176: כך צורת ההודעות קבועה (ב־194 השתנתה הודעת השגיאה), גם כשה־Gateway יתעדכן.
   מתוך כל הודעה קוראים רק את השדות הראשונים שצריך — השאר נשאר בהודעה ולא מפריע.

   המצב (G.st):  off — לא מוגדר (IBGW_HOST ריק) · down — ה־Gateway לא עונה / אין לו קשר ל־IBKR (1100)
                 needs2FA — הקונטיינר עונה אבל ה־API סגור: עוד לא נכנס (2FA בטלפון, או הכניסה של יום ראשון)
                 connected — מחוברים, הנתונים זורמים.
   הנתונים החיים — רק בזיכרון של התהליך (לא Firestore, לא דיסק, לא לוג). בלוג — רק מעבר בין מצבים. */
const net = require('net');

const MIN_V = 100, MAX_V = 176;
const MSG = { TICK: 1, ORDER_STATUS: 3, ERR: 4, OPEN_ORDER: 5, NEXT_ID: 9, MANAGED: 15, CUR_TIME: 49, OPEN_END: 53,
  POSITION: 61, POSITION_END: 62, ACCT_SUM: 63, ACCT_SUM_END: 64 };
const OUT = { REQ_ALL_OPEN: 16, REQ_CUR_TIME: 49, REQ_POSITIONS: 61, REQ_ACCT_SUM: 62, START_API: 71 };
const SUM_REQ = 9001;
const SUM_TAGS = 'NetLiquidation,TotalCashValue,BuyingPower,AvailableFunds,GrossPositionValue';
const DONE = new Set(['Filled', 'Cancelled', 'ApiCancelled', 'Inactive']);
// קודים של IBKR: 1100 = הקשר בין ה־Gateway ל־IBKR נפל · 1101/1102 = חזר · 2110 = הקשר לשרת שבור
const LINK_DOWN = new Set([1100, 2110]), LINK_UP = new Set([1101, 1102]);
const T = { HS: 8e3, PING: 60e3, IDLE: 180e3, BACK0: 15e3, BACK_MAX: 120e3, ORD_FRESH: 20e3, ORD_WAIT: 3e3, ALERT: 120e3, BOOT: 600e3 };

/* ---------------------------------------------------------------- מסגרות (טהור) */
function frame(fields) {
  const body = Buffer.from(fields.map((f) => (f == null ? '' : String(f)) + '\0').join(''), 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  return Buffer.concat([len, body]);
}
function hello() {
  const v = Buffer.from('v' + MIN_V + '..' + MAX_V, 'utf8');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(v.length);
  return Buffer.concat([Buffer.from('API\0', 'latin1'), len, v]);
}
/* buf → { msgs: [[שדות]], rest } — הודעה חלקית נשארת ב־rest. אורך לא סביר = זרם שבור (null) */
function unframe(buf) {
  const msgs = [];
  let i = 0;
  while (buf.length - i >= 4) {
    const n = buf.readUInt32BE(i);
    if (n > 16 * 1024 * 1024) return null;
    if (buf.length - i - 4 < n) break;
    const parts = buf.slice(i + 4, i + 4 + n).toString('utf8').split('\0');
    if (parts.length && parts[parts.length - 1] === '') parts.pop();
    msgs.push(parts);
    i += 4 + n;
  }
  return { msgs, rest: buf.slice(i) };
}
const num = (x) => { const v = parseFloat(x); return Number.isFinite(v) && Math.abs(v) < 1e300 ? v : null; };   // 1.7976931348623157E308 = "לא הוגדר" ב־IBKR

/* ---------------------------------------------------------------- המצב */
function fresh() {
  return { st: 'off', since: 0, sv: 0, sock: null, buf: Buffer.alloc(0), got: false, hsTimer: null, nextTry: 0, back: T.BACK0,
    lastRx: 0, lastPing: 0, link: true, pos: new Map(), posAt: 0, sum: new Map(), sumAt: 0,
    orders: new Map(), pend: null, pendAt: 0, ordAt: 0, ordWait: [], okSeen: false, boot: 0, alerted: false, downAt: 0, owner: '' };
}
let G = fresh();

function cfg(env) {
  const e = env || process.env;
  const host = String(e.IBGW_HOST || '').trim();
  const port = +e.IBGW_PORT || 4004;
  const cid = +e.IBGW_CLIENT_ID || 7;
  return { host: /^[a-z0-9][a-z0-9.-]{0,62}$/i.test(host) ? host : '', port: port > 0 && port < 65536 ? port : 4004,
    cid: cid >= 0 && cid < 1e6 ? Math.floor(cid) : 7, mode: e.IBGW_MODE === 'live' ? 'live' : 'paper' };
}

function setSt(st, now) {
  if (G.st === st) return;
  if (st !== 'connected' && G.st === 'connected') G.downAt = now;
  if (st === 'connected') { G.okSeen = true; G.alerted = false; G.downAt = 0; }
  if (!G.downAt && st !== 'connected' && st !== 'off') G.downAt = now;
  G.st = st; G.since = now;
  console.log('[ibgw]', st);                       // רק המצב — אף נתון של החשבון
}

function send(fields) {
  if (G.sock && !G.sock.destroyed) G.sock.write(frame(fields));
}

function drop(st, now) {
  const s = G.sock;
  G.sock = null;
  clearTimeout(G.hsTimer);
  if (s) { s.removeAllListeners(); s.on('error', () => {}); s.destroy(); }
  G.buf = Buffer.alloc(0); G.sv = 0;
  G.pos.clear(); G.sum.clear(); G.orders.clear(); G.pend = null; G.posAt = G.sumAt = G.ordAt = 0;
  for (const w of G.ordWait.splice(0)) w();
  G.nextTry = now + G.back;
  G.back = Math.min(G.back * 2, T.BACK_MAX);
  setSt(st, now);
}

/* ---------------------------------------------------------------- הודעות נכנסות */
function onMsg(f, now) {
  const id = +f[0];
  if (id === MSG.NEXT_ID) {
    G.back = T.BACK0;
    if (G.link) setSt('connected', now);
    send([OUT.REQ_POSITIONS, 1]);
    send([OUT.REQ_ACCT_SUM, 1, SUM_REQ, 'All', SUM_TAGS]);
    reqOrders();
  } else if (id === MSG.POSITION) {
    // 61: גרסה, חשבון, conId, סימבול, סוג, תפוגה, מימוש, צד, מכפיל, בורסה, מטבע, סימבול מקומי, tradingClass, כמות, עלות ממוצעת
    const key = f[2] + '|' + f[3], q = num(f[14]);
    if (!q) G.pos.delete(key);
    else G.pos.set(key, { s: String(f[4] || ''), t: String(f[5] || ''), c: String(f[11] || ''), q, avg: num(f[15]) });
  } else if (id === MSG.POSITION_END) G.posAt = now;
  else if (id === MSG.ACCT_SUM) {
    // 63: גרסה, reqId, חשבון, תגית, ערך, מטבע
    if (+f[2] === SUM_REQ) G.sum.set(f[3] + '|' + f[4], { k: String(f[4] || ''), v: num(f[5]), c: String(f[6] || '') });
  } else if (id === MSG.ACCT_SUM_END) G.sumAt = now;
  else if (id === MSG.OPEN_ORDER) {
    // 5 (מגרסה 145 בלי שדה גרסה): orderId, ‏11 שדות חוזה, ואז צד, כמות, סוג, מחיר לימיט, מחיר עזר, tif
    const o = { id: +f[1], s: String(f[3] || ''), t: String(f[4] || ''), c: String(f[10] || ''), side: String(f[13] || ''),
      q: num(f[14]), type: String(f[15] || ''), lmt: num(f[16]), aux: num(f[17]), tif: String(f[18] || ''), st: '', filled: 0 };
    const m = G.pend || G.orders;
    const was = G.orders.get(o.id) || m.get(o.id);
    if (was) { o.st = was.st; o.filled = was.filled; }
    m.set(o.id, o);
  } else if (id === MSG.ORDER_STATUS) {
    // 3 (מגרסה 131 בלי שדה גרסה): orderId, סטטוס, בוצע, נותר
    const oid = +f[1], st = String(f[2] || '');
    for (const m of [G.pend, G.orders]) {
      if (!m || !m.has(oid)) continue;
      if (DONE.has(st)) m.delete(oid);
      else Object.assign(m.get(oid), { st, filled: num(f[3]) || 0 });
    }
  } else if (id === MSG.OPEN_END) {
    if (G.pend) { G.orders = G.pend; G.pend = null; }
    G.ordAt = now;
    for (const w of G.ordWait.splice(0)) w();
  } else if (id === MSG.ERR) {
    // 4: גרסה, id, קוד, הודעה — רק הקוד נשמר (ההודעה יכולה להכיל פרטי חשבון)
    const code = +f[3];
    if (LINK_DOWN.has(code)) { G.link = false; setSt('down', now); }
    else if (LINK_UP.has(code)) { G.link = true; if (G.sv) setSt('connected', now); }
  }
}

function onData(chunk) {
  const now = Date.now();
  G.lastRx = now;
  G.got = true;
  G.buf = Buffer.concat([G.buf, chunk]);
  const u = unframe(G.buf);
  if (!u) return drop('down', now);
  G.buf = u.rest;
  for (const f of u.msgs) {
    if (!G.sv) {
      // ההודעה הראשונה: גרסת השרת ושעת החיבור
      const v = +f[0];
      if (!(v >= MIN_V && v <= MAX_V)) return drop('down', now);
      G.sv = v;
      clearTimeout(G.hsTimer);
      send([OUT.START_API, 2, cfg().cid, '']);
      continue;
    }
    onMsg(f, now);
  }
}

function reqOrders() {
  G.pend = new Map();
  G.pendAt = Date.now();
  send([OUT.REQ_ALL_OPEN, 1]);
}

/* ---------------------------------------------------------------- חיבור ותחזוקה (כל 5 שנ׳ מהבודק — server.js startPx) */
function tick(deps = {}) {
  const now = (deps.now && deps.now()) || Date.now();
  const c = cfg(deps.env);
  if (!c.host) { if (G.st !== 'off') { drop('off', now); G.back = T.BACK0; } return G.st; }
  if (!G.boot) G.boot = now;
  if (G.sock) {
    if (G.sv && now - G.lastPing > T.PING) { G.lastPing = now; send([OUT.REQ_CUR_TIME, 1]); }
    if (G.sv && G.lastRx && now - G.lastRx > T.IDLE) drop('down', now);   // אין תשובה גם לפינג — חיבור מת
    return G.st;
  }
  if (now < G.nextTry) return G.st;
  const mk = deps.connect || ((o) => net.connect(o));
  const s = mk({ host: c.host, port: c.port });
  G.sock = s; G.got = false; G.lastRx = now; G.lastPing = now; G.link = true;
  if (s.setNoDelay) s.setNoDelay(true);
  s.on('connect', () => { s.__opened = true; s.write(hello()); });
  s.on('data', onData);
  // הקונטיינר קיבל את החיבור (socat) אבל ה־API לא עונה = ה־Gateway עוד לא נכנס (2FA)
  s.on('close', () => { if (G.sock === s) drop(!G.sv && s.__opened ? 'needs2FA' : 'down', Date.now()); });
  s.on('error', () => {});
  G.hsTimer = setTimeout(() => { if (G.sock === s && !G.sv) drop(s.__opened ? 'needs2FA' : 'down', Date.now()); }, T.HS);
  if (G.hsTimer.unref) G.hsTimer.unref();
  return G.st;
}

/* ---------------------------------------------------------------- תמונת מצב לטלפון */
function stateView(now) {
  return { st: G.st, since: G.since, mode: cfg().mode, ro: true };
}
async function live(deps = {}) {
  const now = (deps.now && deps.now()) || Date.now();
  // בקשה שלא נענתה (בלי openOrderEnd) לא תוקעת: אחרי 10 שנ׳ מבקשים מחדש
  if (G.st === 'connected' && now - G.ordAt > T.ORD_FRESH && (!G.pend || Date.now() - G.pendAt > 10e3)) {
    reqOrders();
    await new Promise((r) => { const tm = setTimeout(r, deps.wait != null ? deps.wait : T.ORD_WAIT); G.ordWait.push(() => { clearTimeout(tm); r(); }); });
  }
  const out = stateView(now);
  if (G.st !== 'connected') return out;
  const by = (a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0);
  out.pos = [...G.pos.values()].map((p) => Object.assign({}, p)).sort(by);
  // יתרות: סכום על כל החשבונות, לפי תגית ומטבע (בלי מספר החשבון)
  const sum = {};
  for (const x of G.sum.values()) {
    if (x.v == null) continue;
    const k = x.k + '|' + x.c;
    sum[k] = (sum[k] || 0) + x.v;
  }
  out.sum = Object.entries(sum).map(([k, v]) => ({ k: k.split('|')[0], c: k.split('|')[1], v }));
  out.ord = [...G.orders.values()].map((o) => Object.assign({}, o)).sort((a, b) => a.id - b.id);
  out.at = Math.max(G.posAt, G.sumAt, G.ordAt) || now;
  return out;
}

/* ---------------------------------------------------------------- התראה לטלפון כשהסשן נפל
   פעם אחת לכל נפילה, אחרי 2 דק׳ רצופות (הפעלה מחדש של הלילה לא מתריעה). אחרי עלייה של התהליך — רק אחרי 10 דק׳
   בלי חיבור (הסשן אולי עוד לא הספיק להתחבר). מחזיר את המצב להתראה, או '' */
function alertDue(now) {
  if (G.st === 'connected' || G.st === 'off' || G.alerted || !G.downAt) return '';
  if (now - G.downAt < T.ALERT) return '';
  if (!G.okSeen && now - G.boot < T.BOOT) return '';
  G.alerted = true;
  return G.st;
}
function owner(uid) {
  const e = String(process.env.IBGW_OWNER || '').trim();
  if (/^[A-Za-z0-9]{6,128}$/.test(e)) return e;
  if (uid && /^[A-Za-z0-9]{6,128}$/.test(uid)) G.owner = uid;
  return G.owner;
}

/* שורה למגדל (lib/services.js) */
function svcView() {
  if (G.st === 'off') return { st: 'off' };
  return { st: G.st === 'connected' ? 'ok' : G.st === 'needs2FA' ? 'warn' : 'down', gw: G.st, at: G.since };
}

module.exports = { MIN_V, MAX_V, MSG, OUT, T, SUM_REQ, frame, hello, unframe, cfg, tick, live, stateView, alertDue, owner, svcView,
  _state: () => G, _reset: () => { if (G.sock) { G.sock.removeAllListeners(); G.sock.on('error', () => {}); G.sock.destroy(); } clearTimeout(G.hsTimer); G = fresh(); } };
