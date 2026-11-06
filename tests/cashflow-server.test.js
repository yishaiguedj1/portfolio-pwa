// cashflow-server.test.js — 6/11/2026: Cashflow, גל 1 — מודול השרת (ibkr-proxy/lib/cashflow.js).
// 1. נקודת הקצה: מקור, כבוי, טוקן, אפליקציה, בעלים, חיבור/ניתוק, דוח, מטמון, 401 של רייזאפ.
// 2. האחסון: קובץ 0600, רק ערך מוצפן — הטוקן לא מופיע בקובץ.
// 3. החיבורים: SERVER_ONLY, appscope, העותק של המנוע (בלי השכבה האישית), סביבה נקייה לתהליך.
// הכל מדומה — בלי רייזאפ, בלי טוקן אמיתי.
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.join(__dirname, '..');
let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
function mkRes() {
  return { c: 0, j: null, h: {}, status(c) { this.c = c; return this; }, json(o) { this.j = o; return this; }, end() { return this; }, setHeader(k, v) { this.h[k] = v; } };
}
process.env.IBKR_VAULT_KEY = Buffer.alloc(32, 7).toString('base64');
const PAT = ['riseup', 'pat'].join('_') + '_' + 'T'.repeat(40);   // נבנה בזמן ריצה — אין מחרוזת בצורת טוקן בריפו
const CF = 'https://cashflow.thesnowball.app', INV = 'https://invest.thesnowball.app', ALL = 'https://thesnowball.app';

(async () => {
  const CFL = require(root + '/ibkr-proxy/lib/cashflow.js');
  const tokens = { tOwner: { uid: 'owner1', app: 'cashflow', email: 'me@x.com' }, tAll: { uid: 'owner1', app: 'all' }, tInv: { uid: 'owner1', app: 'invest' }, tOther: { uid: 'other1', app: 'cashflow' } };
  const mem = {};
  const store = { get: (u) => mem[u] || null, put: (u, r) => { mem[u] = r; }, del: (u) => { delete mem[u]; } };
  const runs = [];
  let runImpl = async (name, args, pat) => ({ name, args, ok: pat === PAT });
  let t = Date.UTC(2026, 10, 6, 10, 0, 0);
  const H = CFL.makeHandler({
    env: { SNB_CASHFLOW: 'on', SNB_SESSION_ENV: 'prod' },
    now: () => t,
    verify: async (tok) => { if (!tokens[tok]) throw new Error('bad'); return tokens[tok]; },
    store,
    run: async (name, args, pat) => { runs.push({ name, args, pat }); return runImpl(name, args, pat); },
    owner: (u) => u.uid === 'owner1',
  });
  const call = async (body, origin = CF, method = 'POST') => { const res = mkRes(); await H({ method, headers: { origin }, body }, res); return res; };

  // ---------------------------------------------------------------- 1. נקודת הקצה
  ok((await call({ op: 'status', idToken: 'tOwner' }, INV)).c === 403, 'מקור של אפליקציה אחרת (Invest) — 403');
  ok((await call({ op: 'status', idToken: 'tOwner' }, 'https://evil.com')).c === 403, 'מקור זר — 403');
  ok((await call({}, CF, 'OPTIONS')).c === 204, 'OPTIONS — 204');
  const off = CFL.makeHandler({ env: { SNB_CASHFLOW: 'off' }, verify: async () => tokens.tOwner, store, run: runImpl, owner: () => true });
  { const res = mkRes(); await off({ method: 'POST', headers: { origin: CF }, body: { op: 'status', idToken: 'tOwner' } }, res); ok(res.c === 503 && res.j.error === 'off', 'כבוי כברירת מחדל — 503'); }
  ok((await call({ op: 'status', idToken: 'nope' })).c === 401, 'טוקן לא תקין — 401');
  ok((await call({ op: 'status', idToken: 'tInv' })).c === 403, 'טוקן של Invest — wrong_app');
  ok((await call({ op: 'status', idToken: 'tOther' })).j.error === 'not_allowed', 'לא הבעלים — 403');
  ok((await call({ op: 'status', idToken: 'tAll' }, ALL)).j.connected === false, 'האתר המאוחד + טוקן all — מותר, לא מחובר');
  ok((await call({ op: 'connect', idToken: 'tOwner', pat: 'abc' })).j.error === 'bad_pat', 'טוקן רייזאפ בפורמט שגוי — 400');
  ok((await call({ op: 'report', idToken: 'tOwner', name: 'snapshot' })).c === 409, 'דוח לפני חיבור — 409');

  let r = await call({ op: 'connect', idToken: 'tOwner', pat: PAT });
  ok(r.j.ok && r.j.connected, 'חיבור — נשמר');
  ok(mem.owner1 && !JSON.stringify(mem.owner1).includes(PAT) && /^v1\./.test(mem.owner1.v), 'נשמר רק מוצפן (כספת v1), בלי הטוקן בגלוי');
  ok(!JSON.stringify(r.j).includes(PAT), 'הטוקן לא חוזר בתשובה');
  r = await call({ op: 'status', idToken: 'tOwner' });
  ok(r.j.connected && r.j.expiresInDays === 30, 'סטטוס — מחובר, 30 ימים לפקיעה');
  ok(r.h['Cache-Control'] === 'no-store', 'no-store');

  r = await call({ op: 'report', idToken: 'tOwner', name: 'snapshot' });
  ok(r.j.ok && r.j.report.ok && r.j.cached === false && runs.at(-1).pat === PAT, 'דוח — רץ עם הטוקן המפוענח');
  r = await call({ op: 'report', idToken: 'tOwner', name: 'snapshot' });
  ok(r.j.cached === true && runs.length === 1, 'דוח שני — מהמטמון, בלי קריאה לרייזאפ');
  r = await call({ op: 'report', idToken: 'tOwner', name: 'snapshot', refresh: true });
  ok(r.j.cached === false && runs.length === 2, 'refresh — עוקף את המטמון');
  t += 16 * 60 * 1000;
  r = await call({ op: 'report', idToken: 'tOwner', name: 'snapshot' });
  ok(r.j.cached === false && runs.length === 3, 'אחרי 15 דק׳ — רץ מחדש');
  ok((await call({ op: 'report', idToken: 'tOwner', name: 'bridge' })).j.error === 'bad_report', 'דוח לא ברשימה — 400');
  r = await call({ op: 'report', idToken: 'tOwner', name: 'month', args: ['--month', '2026-10'] });
  ok(r.j.ok && runs.at(-1).args.join(' ') === '--month 2026-10', 'ארגומנטים עוברים');
  runImpl = async () => { throw new Error('get_budget: RiseUp PAT was rejected (401).'); };
  r = await call({ op: 'report', idToken: 'tOwner', name: 'forecast' });
  ok(r.j.error === 'riseup_token_rejected', '401 מרייזאפ — riseup_token_rejected');
  ok((await call({ op: 'disconnect', idToken: 'tOwner' })).j.connected === false && !mem.owner1, 'ניתוק — נמחק');
  ok((await call({ op: 'nope', idToken: 'tOwner' })).j.error === 'bad_op', 'פעולה לא מוכרת — 400');

  // ---------------------------------------------------------------- 2. האחסון
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-'));
  const fsStore = CFL.fileStore({ SNB_CASHFLOW_DIR: dir });
  const V = require(root + '/ibkr-proxy/lib/vault.js');
  fsStore.put('u1', { v: V.seal({ pat: PAT }, 'cashflow|pat|u1'), at: 1 });
  const file = path.join(dir, 'cashflow-vault.json');
  ok((fs.statSync(file).mode & 0o777) === 0o600, 'הקובץ 0600');
  ok(!fs.readFileSync(file, 'utf8').includes(PAT), 'הטוקן לא בקובץ');
  ok(V.open(fsStore.get('u1').v, 'cashflow|pat|u1').pat === PAT, 'נפתח עם ה־AAD של המשתמש');
  ok(V.open(fsStore.get('u1').v, 'cashflow|pat|u2') === null, 'לא נפתח למשתמש אחר (AAD)');
  fsStore.del('u1');
  ok(fsStore.get('u1') === null, 'מחיקה מהקובץ');

  // ---------------------------------------------------------------- 3. החיבורים
  const S = require(root + '/ibkr-proxy/server.js');
  ok(S.SERVER_ONLY.cashflow === 'lib/cashflow.js', 'SERVER_ONLY כולל את cashflow');
  const A = require(root + '/ibkr-proxy/lib/appscope.js');
  ok(JSON.stringify(A.scopeFor('cashflow')) === '["cashflow"]', 'appscope — cashflow רק ל־cashflow');
  const eng = path.join(root, 'ibkr-proxy/lib/cashflow');
  ok(fs.existsSync(path.join(eng, 'SOURCE.md')) && !fs.existsSync(path.join(eng, 'config')), 'עותק המנוע — עם SOURCE.md ובלי השכבה האישית');
  const runner = await import(path.join(eng, 'scripts/lib/runner.mjs'));
  ok([...CFL.REPORTS].every((x) => runner.REPORTS[x]), 'כל דוח שהמודול מתיר קיים במנוע');
  let threw = false; try { runner.reportCommand('snapshot', ['$(id)']); } catch (e) { threw = true; }
  ok(threw, 'המנוע דוחה ארגומנט מסוכן');
  const src = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/cashflow.js'), 'utf8');
  ok(/cleanEnv: true/.test(src) && /transport: 'http'/.test(src), 'התהליך רץ בסביבה נקייה וב־HTTP ישיר');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
