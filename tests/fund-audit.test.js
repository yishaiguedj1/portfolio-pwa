// 25/10/2026 — בקרת הדיוק של מנתח החברות (שכבות 4–5).
// lib/fundaudit.js (טהור): סט הזהב, הסיכום, הצורה של מה שמגיע מה־Release, ההתראה ותצוגת מרכז הניהול.
// golden.json: צורה תקינה וערכים סבירים. fund-audit.yml: לילי, כותב רק ל־Release, actions מקובעים.
// השרתון (api/studio.js): adminFund רק למנהל, fundWatch שולח התראה אחת לכל ריצה שבה משהו נשבר.
// הרצה: node tests/fund-audit.test.js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');

(async () => {
  const FA = require(path.join(root, 'ibkr-proxy/lib/fundaudit.js'));
  const GOLD = require(path.join(root, 'ibkr-proxy/lib/golden.json'));

  /* ---------- 1. סט הזהב ---------- */
  const cos = Object.entries(GOLD.companies || {});
  ok(GOLD.v === 1 && cos.length >= 25, 'golden.json: לפחות 25 חברות');
  let vals = 0, shape = true;
  for (const [sym, c] of cos) {
    if (!/^[A-Z][A-Z.-]{0,9}$/.test(sym) || !/^\d{10}-\d{2}-\d{6}$/.test(c.acc) || !/^(10-K|20-F|40-F)/.test(c.form)) shape = false;
    for (const [k, by] of Object.entries(c.v)) {
      if (!['rev', 'ni', 'eps', 'ocf', 'ta'].includes(k)) shape = false;
      for (const [end, x] of Object.entries(by)) {
        vals++;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(end) || !Number.isFinite(x)) shape = false;
        if (k === 'eps' ? Math.abs(x) > 1e5 : k !== 'ni' && k !== 'ocf' && x < 1e7) shape = false;   // רווח למניה — לא כפול מיליון; הכנסות/נכסים — בדולרים מלאים
      }
    }
  }
  ok(shape, 'golden.json: סימבול, מספר הגשה, טופס, מדדים מוכרים, תאריכים ומספרים סבירים');
  ok(vals >= 300, 'golden.json: לפחות 300 ערכים (' + vals + ')');
  ok(cos.every(([, c]) => c.v.rev && c.v.ta), 'golden.json: לכל חברה הכנסות וסך נכסים');

  const sym = cos[0][0], g = cos[0][1];
  const ends = Object.keys(g.v.rev);
  const r = { ok: true, src: 'sec', fy: ends.slice().sort(), A: {} };
  for (const [k, by] of Object.entries(g.v)) r.A[k] = r.fy.map((e) => (by[e] != null ? by[e] : null));
  ok(FA.goldCheck(GOLD, sym, r).length === 0, 'goldCheck: אותם ערכים — בלי סטייה');
  const r2 = JSON.parse(JSON.stringify(r)); r2.A.rev[0] *= 1.01;
  const gb = FA.goldCheck(GOLD, sym, r2);
  ok(gb.length === 1 && gb[0].m === 'rev' && gb[0].p === r.fy[0], 'goldCheck: הכנסות שזזו ב־1% — סטייה אחת, במדד ובשנה');
  const r3 = JSON.parse(JSON.stringify(r)); r3.A.rev[0] *= 1.004; r3.A.ta = r3.A.ta.map((x) => (x == null ? x : -x));
  ok(FA.goldCheck(GOLD, sym, r3).length === 0, 'goldCheck: עד 0.5% והסימן (הסימן נבדק מול הדוח עצמו)');
  if (r.A.eps) { const r4 = JSON.parse(JSON.stringify(r)); const i = r4.A.eps.findIndex((x) => x != null); r4.A.eps[i] += 0.02; ok(FA.goldCheck(GOLD, sym, r4).length === 1, 'goldCheck: רווח למניה — עד סנט'); }
  const r5 = JSON.parse(JSON.stringify(r)); r5.A.rev = r5.A.rev.map(() => null);
  ok(FA.goldCheck(GOLD, sym, r5).length === ends.length, 'goldCheck: ערך שנעלם = סטייה');

  /* ---------- 2. הסיכום ---------- */
  const res = [
    { sym, r: Object.assign({}, r2, { face: { n: 10, ok: 9, form: '10-K', url: 'https://www.sec.gov/Archives/edgar/data/1/x.htm' }, checks: [{ k: 'face', m: 'rev', p: '2025-12-31', f: 10, v: 11 }, { k: 'q4', m: 'ni', p: '2024' }] }) },
    { sym: 'ZZZ', r: { ok: true, src: 'sec', fy: [], A: {}, face: { n: 5, ok: 5 }, checks: [{ k: 'fix', m: 'sh' }] } },
    { sym: 'YYY', r: { ok: true, src: 'yahoo' } },
    { sym: 'XXX', r: { ok: false } },
  ];
  const S = FA.summarize(res, GOLD, Date.UTC(2026, 9, 26, 3, 30), 1234);
  ok(S.n === 4 && S.sec === 2 && S.yahoo === 1 && S.fail === 1 && S.ys[0] === 'YYY' && S.fs[0] === 'XXX', 'summarize: מקורות וכשלים');
  ok(S.face.n === 15 && S.face.ok === 14 && S.face.cos === 2 && S.face.coOk === 1 && S.cos.length === 1 && S.cos[0].sym === sym, 'summarize: ההתאמה לדוח, וחברה עם סטייה');
  ok(S.gold.n === 1 && S.gold.bad === 1 && S.items[0].k === 'gold' && S.items[1].k === 'face', 'summarize: סט הזהב ראשון בחריגים, אחריו הדוח');
  ok(S.kinds.face === 1 && S.kinds.fix === 1 && S.kinds.q4 === 1 && S.ni === 4, 'summarize: ספירה לפי סוג');

  /* ---------- 3. מה שמגיע מה־Release — רק הצורה הצפויה ---------- */
  const J = JSON.parse(JSON.stringify(S));
  J.items.push({ sym: '<script>', k: 'face' }, { sym: 'AAA', k: 'x y' });
  J.cos.push({ sym: 'BBB', n: 2, ok: 1, url: 'https://evil.example/x' });
  J.kinds['<b>'] = 5; J.extra = 'x';
  const N = FA.normAudit(J);
  ok(N && N.items.length === S.items.length && N.cos.find((c) => c.sym === 'BBB').url === '' && !('<b>' in N.kinds) && !('extra' in N), 'normAudit: סימבול/סוג לא תקינים נזרקים, קישור רק ל־sec.gov');
  ok(FA.normAudit({ v: 2, at: S.at }) === null && FA.normAudit(null) === null && FA.normAudit({ v: 1, at: 'x' }) === null, 'normAudit: גרסה/תאריך לא תקינים — כלום');

  /* ---------- 4. היסטוריה, התראה ותצוגה ---------- */
  let hist = [];
  const prevS = FA.normAudit(Object.assign({}, J, { at: '2026-10-25T03:30:00.000Z', face: { n: 1000, ok: 1000, cos: 10, coOk: 10 }, gold: { n: 1, bad: 0 }, fail: 0 }));
  hist = FA.pushHist(hist, prevS);
  hist = FA.pushHist(hist, prevS);
  ok(hist.length === 1, 'pushHist: אותה ריצה פעמיים — שורה אחת');
  for (let i = 0; i < 70; i++) hist = FA.pushHist(hist, Object.assign({}, prevS, { at: new Date(Date.UTC(2026, 7, 1) + i * 864e5).toISOString() }));
  ok(hist.length === FA.HIST_MAX, 'pushHist: עד ' + FA.HIST_MAX + ' ריצות');
  const ok0 = Object.assign({}, prevS, { at: '2026-10-26T03:30:00.000Z' });
  const hp = FA.histEntry(prevS);
  ok(FA.auditAlert(ok0, hp) === null, 'auditAlert: בלי שינוי — בלי התראה');
  ok(FA.auditAlert(Object.assign({}, ok0, { gold: { n: 1, bad: 1 } }), hp).join() === 'gold', 'auditAlert: סט הזהב זז');
  ok(FA.auditAlert(Object.assign({}, ok0, { face: { n: 1000, ok: 990, cos: 10, coOk: 9 } }), hp).join() === 'face', 'auditAlert: ההתאמה לדוח ירדה ב־1 נקודה');
  ok(FA.auditAlert(Object.assign({}, ok0, { face: { n: 1000, ok: 996, cos: 10, coOk: 9 } }), hp) === null, 'auditAlert: ירידה קטנה (0.4) — לא מעירים');
  ok(FA.auditAlert(Object.assign({}, ok0, { n: 100, fail: 6 }), hp).join() === 'fail', 'auditAlert: יותר מ־5% מהחברות נכשלו');
  const V = FA.auditView(N, [hp], Date.parse(S.at) + 5 * 3600e3);
  ok(V.age === 5 && V.face.pct === 93.33 && V.face.d === -6.67 && V.gold.bad === 1 && V.alert.includes('gold'), 'auditView: גיל, אחוז, שינוי מהריצה הקודמת והתראה');
  ok(V.gi.length === 1 && V.items.every((x) => x.k !== 'gold') && V.trend.length === 2, 'auditView: הזהב בנפרד, מגמה');

  /* ---------- 5. ה־workflow ---------- */
  const wf = fs.readFileSync(path.join(root, '.github/workflows/fund-audit.yml'), 'utf8');
  ok(/cron: '\d+ \d+ \* \* \*'/.test(wf) && /workflow_dispatch/.test(wf), 'workflow: לילי + ידני');
  ok(/permissions:\s*\n\s*contents: write/.test(wf) && !/secrets\./.test(wf), 'workflow: כותב רק לריפו (Release), בלי סודות');
  ok((wf.match(/uses: [^\n]+/g) || []).every((u) => /@[0-9a-f]{40} #/.test(u)), 'workflow: actions מקובעים ל־SHA');
  ok(/gh release upload fund-audit summary\.json history\.json report\.md/.test(wf) && /--top 500 --out out --hist out\/history\.json/.test(wf), 'workflow: 500 חברות, היסטוריה, ומפרסם את שלושת הקבצים');
  ok(FA.REL === 'https://github.com/yishaiguedj1/portfolio-pwa/releases/download/fund-audit/', 'השרתון קורא מאותו Release');
  const tool = fs.readFileSync(path.join(root, 'tools/fund-audit.js'), 'utf8');
  ok(/FA\.summarize\(/.test(tool) && /FA\.pushHist\(/.test(tool) && !/function goldCheck/.test(tool), 'הכלי משתמש באותה ספרייה (בלי עותק של goldCheck)');

  /* ---------- 6. ההתראה ---------- */
  const W = require(path.join(root, 'ibkr-proxy/lib/webpush.js'));
  const m = W.message('fund_audit', '', 'he'), me = W.message('fund_audit', '', 'en');
  ok(W.KINDS.includes('fund_audit') && m.u === 'https://admin.thesnowball.app/#labFund' && me && /filing/i.test(me.b), 'fund_audit → מרכז הניהול, עמוד דיוק הנתונים, בשתי השפות');

  /* ---------- 7. השרתון ---------- */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'a@example.com', SNB_SITEWATCH: 'off', SNB_ADMINWATCH: 'off', SNB_FUNDWATCH: '', SNB_LEARNWEEK: 'off',
  });
  for (const k of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET', 'R2L_ACCOUNT_ID', 'STUDIO_USERS', 'CRON_SECRET', 'STUDIO_WATCH_SECRET']) delete process.env[k];
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const studio = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  gauth._reset(); studio._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (sub, email) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const A = tok('admUserA0001', 'a@example.com'), B = tok('usrUserB0002', 'b@example.com');
  const db = new Map(), pushed = [];
  let rel = { summary: J, history: [hp] }, relHits = 0;
  const Jr = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), headers: { get: () => null } });
  const fetchAll = async (u, opt = {}) => {
    if (u.startsWith(FA.REL)) { relHits++; const f = u.slice(FA.REL.length); return rel && f === 'summary.json' ? Jr(rel.summary) : rel && f === 'history.json' ? Jr(rel.history) : Jr({}, 404); }
    if (u.includes('oauth2.googleapis.com/token')) return Jr({ access_token: 'SA', expires_in: 3600 });
    const mm = u.match(/\/documents\/([A-Za-z]+)\/([A-Za-z0-9_-]+)/);
    if (mm) {
      const k = mm[1] + '/' + mm[2];
      if ((opt.method || 'GET') === 'GET') return db.has(k) ? Jr({ fields: db.get(k), updateTime: 't1' }) : Jr({}, 404);
      if (opt.method === 'PATCH') { db.set(k, Object.assign({}, db.get(k), JSON.parse(opt.body).fields)); return Jr({}); }
    }
    if (/:runQuery$/.test(u)) return Jr([]);
    if (/push|fcm|mozilla/.test(u)) { pushed.push(u); return Jr({}, 201); }
    return Jr({}, 404);
  };
  let NOW = Date.parse(S.at) + 3600e3;
  const deps = () => ({ verify: { keys }, fetch: fetchAll, now: NOW });
  const callO = async (body) => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    await studio._handler({ method: 'POST', query: {}, body, headers: { origin: 'https://admin.thesnowball.app' }, socket: { remoteAddress: '9.9.9.7' } }, res, deps());
    return res;
  };
  const watch = async () => {
    const res = { code: 0, j: null, setHeader() {}, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, end() { return res; } };
    await studio._handler({ method: 'GET', query: {}, headers: {}, socket: { remoteAddress: '9.9.9.6' } }, res, deps());
    return res;
  };
  ok(['not_admin', 'not_allowed'].includes((await callO({ op: 'adminFund', idToken: B })).j.error), 'adminFund: רק המנהל');
  const af = await callO({ op: 'adminFund', idToken: A });
  ok(af.j.ok && af.j.fa && af.j.fa.gold.bad === 1 && af.j.fa.age === 1 && af.j.fa.cos[0].sym === sym, 'adminFund: התצוגה מהסיכום שב־Release');
  const h0 = relHits; await callO({ op: 'adminFund', idToken: A });
  ok(relHits === h0, 'adminFund: מטמון — לא קורא מ־GitHub בכל כניסה');

  db.set('sysBackup/cfg', { uid: { stringValue: 'admUserA0001' } });
  const w1 = await watch();
  ok(w1.j && w1.j.fa === 1, 'fundWatch: סט הזהב זז — שולח התראה');
  const fw = db.get('sysWatch/fund');
  ok(fw && fw.at.stringValue === N.at && fw.why.stringValue === 'gold,face,fail', 'fundWatch: נרשם איזו ריצה נבדקה ולמה (זהב, ירידה בהתאמה, כשלים)');
  studio._reset();   // מופע חדש — אותה ריצה לא מעירה פעמיים
  const w2 = await watch();
  ok(w2.j.fa === 0, 'fundWatch: אותה ריצה — לא שוב');
  studio._reset(); NOW += 864e5;
  rel = { summary: Object.assign({}, J, { at: new Date(NOW - 3600e3).toISOString(), gold: { n: 1, bad: 0 }, fail: 0, face: { n: 15, ok: 15, cos: 2, coOk: 2 } }), history: [hp] };
  const w3 = await watch();
  ok(w3.j.fa === 0 && db.get('sysWatch/fund').why.stringValue === '', 'fundWatch: ריצה תקינה — בלי התראה');
  studio._reset(); rel = null;
  ok((await watch()).j.fa === 0, 'fundWatch: אין Release עדיין — שקט');
  const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/if \(op === 'adminFund'\)[\s\S]{0,200}isAdmin\(user\)/.test(api), 'adminFund בודק מנהל לפני הכל');

  /* ---------- 8. מרכז הניהול ---------- */
  const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8');
  ok(/page\('labFund'/.test(adm) && /api\('adminFund'\)/.test(adm) && /faRow\(\),\n\s*dmRow\(\)/.test(adm), 'מרכז הניהול: עמוד labFund ושורה במעבדה');
  ok(!/fetch\(/.test(adm.slice(adm.indexOf('async function needFa'), adm.indexOf("page('labFails'"))), 'מרכז הניהול: רק תצוגה (בלי fetch)');
  /* ---------- 7. שכבה 7 (26/10/2026): הצמיחה במסך מול הדוחות ---------- */
  {
    const F = (val, s, e, filed, accn, form = '10-K') => ({ start: s, end: e, val, filed, accn, form });
    const facts = { facts: { 'us-gaap': { Revenues: { units: { USD: [
      F(2817, '2022-01-01', '2022-12-31', '2025-02-27', 'a25'), F(3283, '2023-01-01', '2023-12-31', '2025-02-27', 'a25'), F(4709, '2024-01-01', '2024-12-31', '2025-02-27', 'a25'),
      F(1842, '2023-01-01', '2023-12-31', '2026-02-19', 'a26'), F(3224, '2024-01-01', '2024-12-31', '2026-02-19', 'a26'), F(5481, '2025-01-01', '2025-12-31', '2026-02-19', 'a26'),
      F(9999, '2024-01-01', '2024-12-31', '2026-05-01', 'q26', '10-Q')] } } } } };
    const fy = ['2022-12-31', '2023-12-31', '2024-12-31', '2025-12-31'];
    const good = [null, 3283 / 2817 - 1, 3224 / 1842 - 1, 5481 / 3224 - 1];
    ok(FA.growthAudit(facts, 'Revenues', fy, good, 'rev').length === 0, 'שכבה 7: צמיחה מהדוח האחרון שמציג את שתי השנים — תקין (גם אחרי הצגה מחדש; 10-Q לא נספר)');
    const bad = FA.growthAudit(facts, 'Revenues', fy, [null, 1842 / 2817 - 1, good[2], good[3]], 'rev');
    ok(bad.length === 1 && bad[0].p === '2023-12-31' && Math.abs(bad[0].f - 0.1654) < 1e-4 && bad[0].v < -0.34, 'שכבה 7: צמיחה שמערבבת בסיסים (‎−35% במקום ‎+16.5%) — נתפסת');
    ok(FA.growthAudit(facts, 'Missing', fy, good, 'rev').length === 0 && FA.growthAudit(null, 'Revenues', fy, good, 'rev').length === 0, 'שכבה 7: בלי נתונים — בלי ממצאים (לא מנחשים)');
    const S7 = FA.summarize([{ sym: 'APP', r: { ok: true, src: 'sec', checks: [], gr: bad, grn: 3 } }], null, Date.UTC(2026, 9, 26), 1);
    ok(S7.gr.n === 3 && S7.kinds.gr === 1 && S7.items[0].k === 'gr', 'שכבה 7: נספר בסיכום');
    const N7 = FA.normAudit(S7);
    ok(N7.gr.n === 3 && N7.kinds.gr === 1, 'שכבה 7: עובר את הצורה של ה־Release');
    ok((FA.auditAlert(N7, { k: {} }) || []).includes('gr') && !(FA.auditAlert(N7, { k: { gr: 1 } }) || []).includes('gr'), 'שכבה 7: התראה למנהל כשמספר הפערים עולה');
    const tool = fs.readFileSync(path.join(root, 'tools/fund-audit.js'), 'utf8');
    ok(/growthCheck\(r[,)]/.test(tool) && /analysis\.js/.test(tool) && /AN\.growthOf/.test(tool), 'שכבה 7: הבדיקה הלילית מריצה את הקוד של המסך עצמו (analysis.js) מול companyfacts');
    const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8'), appS = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    ok(/case 'gr': return t\('admFaK_gr'\)/.test(adm) && (appS.match(/admFaK_gr:/g) || []).length === 2 && (appS.match(/admFaK_rst:/g) || []).length === 2, 'שכבה 7: תווית במרכז הניהול בשתי השפות');
  }

  /* ---------- 9. שכבה 8 (26/10/2026): כל ערך מול כמה מקורות — S&P 500 ו־Nasdaq-100 בבדיקה הלילית ---------- */
  {
    const xr = (m, k, p, c, why, extra) => Object.assign({ m, k, p, v: 100e6, raw: 100e6, y: null, n: null, c }, why ? { why } : {}, extra || {});
    const res8 = [
      { sym: 'AAA', r: { ok: true, src: 'sec', checks: [], face: { n: 4, ok: 4 } }, x: [xr('rev', 'A', '2024-12-31', 'ok'), xr('rev', 'Q', '2025-03-31', 'odd', 'a:face', { y: 90e6 }),
        xr('capex', 'A', '2024-12-31', 'def', 'capex_part', { n: 60e6 }), xr('cash', 'A', '2024-12-31', 'okd', 'n_fx', { n: 106e6 })] },
      { sym: 'BBB', xo: 1, r: { ok: true, src: 'sec', checks: [{ k: 'face', m: 'rev', p: '2024-12-31', f: 1, v: 2 }], face: { n: 9, ok: 1 } }, x: [xr('ni', 'A', '2024-12-31', 'bug', null, { raw: 120e6 }),
        xr('eps', 'Q', '2025-03-31', 'spl', 'split_10', { v: 1.5, raw: 1.5, y: 15 }), xr('sh', 'A', '2024-12-31', 'ok')] },
      { sym: 'CCC', r: { ok: true, src: 'sec', checks: [], face: { n: 2, ok: 2 } } },
    ];
    const S8 = FA.summarize(res8, null, Date.UTC(2026, 9, 27, 3, 30), 1);
    ok(S8.n === 2 && S8.sec === 2 && S8.face.n === 6 && !S8.items.some((x) => x.sym === 'BBB'), 'שכבה 8: חברה שרק ברשימה של שכבה 8 (xo) לא נספרת בשכבות 1–7 — ההיסטוריה נשארת על אותן 500');
    ok(S8.x && S8.x.n === 7 && S8.x.cos === 2 && S8.x.p === 3 && S8.x.b === 1 && S8.x.c.okd === 1 && S8.x.c.def === 1 && S8.x.why['def:capex_part'] === 1, 'שכבה 8: ספירה לפי הכרעה והסבר, בעיות (bug/spl/odd) ומתוכן bug');
    ok(S8.x.items.map((r) => r.c).join() === 'bug,spl,odd' && S8.x.items[0].sym === 'BBB' && S8.x.items[0].raw === 120e6 && S8.x.items[2].why === 'a:face', 'שכבה 8: הבעיות לפי חומרה (שונה מ־SEC, פיצול, בלי הסבר) — עם הערך שלנו ו־SEC/Yahoo/Nasdaq');
    ok(FA.summarize([{ sym: 'AAA', r: { ok: true, src: 'sec', checks: [] } }], null, Date.now(), 1).x === undefined, 'שכבה 8: ריצה בלי --xsyms — בלי x (הסיכום כמו קודם)');
    const J8 = JSON.parse(JSON.stringify(S8));
    J8.x.items.push({ sym: '<b>', m: 'rev', k: 'A', p: '2024-12-31', c: 'odd' }, { sym: 'DDD', m: 'zzz', k: 'A', p: '2024-12-31', c: 'odd' }, { sym: 'DDD', m: 'rev', k: 'A', p: 'x', c: 'odd' },
      { sym: 'DDD', m: 'rev', k: 'A', p: '2024-12-31', c: 'odd', why: '<script>', v: 'x' });
    J8.x.c['<b>'] = 5; J8.x.why['bad key'] = 1;
    const N8 = FA.normAudit(J8);
    ok(N8.x.items.length === 4 && N8.x.items[3].why === null && N8.x.items[3].v === null && !('<b>' in N8.x.c) && !('bad key' in N8.x.why) && N8.x.p === 3, 'normAudit שכבה 8: סימבול / מדד / תאריך / הסבר לא תקינים — נזרקים או מתאפסים');
    ok(FA.normAudit(S).x === null, 'normAudit: סיכום ישן בלי שכבה 8 — x = null');
    const he = FA.histEntry(N8), h0 = FA.histEntry(FA.normAudit(S));
    ok(he.xp === 3 && he.xb === 1 && he.xn === 7 && h0.xp === null, 'היסטוריה: xp/xb/xn — null בריצה בלי שכבה 8');
    ok(FA.normHist([h0])[0].xp === null && FA.normHist([he])[0].xp === 3, 'normHist: null נשאר null (לא 0 — אחרת הריצה הראשונה עם שכבה 8 נראית כמו קפיצה)');
    const base8 = Object.assign({}, N8, { gold: { n: 0, bad: 0 }, fail: 0, kinds: {} });
    const prev = (xp, xb) => ({ fo: 1, fn: 1, k: {}, xp, xb });
    ok(FA.auditAlert(base8, prev(null, null)) === null, 'auditAlert שכבה 8: ריצה קודמת בלי שכבה 8 — לא מעירים');
    ok(FA.auditAlert(base8, prev(3, 1)) === null && FA.auditAlert(base8, prev(1, 1)) === null, 'auditAlert שכבה 8: עלייה קטנה (עד 5 / 2%) — רעש של המקורות החיצוניים, בלי התראה');
    ok((FA.auditAlert(base8, prev(3, 0)) || []).join() === 'x', 'auditAlert שכבה 8: עוד ערך שונה מ־SEC (bug) — מעירים');
    const big = Object.assign({}, base8, { x: Object.assign({}, base8.x, { p: 330, b: 1 }) });
    ok((FA.auditAlert(big, prev(300, 1)) || []).join() === 'x' && FA.auditAlert(big, prev(325, 1)) === null, 'auditAlert שכבה 8: עלייה מעל 2% (330 מול 300) — מעירים; 330 מול 325 — לא');
    const V8 = FA.auditView(N8, [Object.assign(prev(2, 1), { at: '2026-10-26T03:30:00.000Z', n: 2, sec: 2 })], Date.parse(N8.at) + 3600e3);
    ok(V8.x && V8.x.p === 3 && V8.x.d === 1 && V8.x.pc[0].k === 'bug' && V8.x.items.length === 4 && V8.x.trend.join() === '2,3', 'auditView שכבה 8: מספר, שינוי מהריצה הקודמת, לפי סוג (bug ראשון), רשימה ומגמה');
    ok(FA.auditView(FA.normAudit(S), [], Date.now()).x === null, 'auditView: בלי שכבה 8 — x = null');
    const tool = fs.readFileSync(path.join(root, 'tools/fund-audit.js'), 'utf8'), xt = fs.readFileSync(path.join(root, 'tools/fund-xcheck.js'), 'utf8');
    ok(/require\('\.\/fund-xcheck\.js'\)/.test(tool) && /XC\.checkOne\(/.test(tool) && /XC\.faceOf\(r\)/.test(tool) && /--xsyms/.test(tool) && !/_cache\.clear\(\)/.test(tool) && !/_cache\.clear\(\)/.test(xt),
      'הכלי הלילי מריץ את אותה השוואה של tools/fund-xcheck.js (בלי עותק), עם הדוח המודפס, ובלי לנקות את המטמון של עובד מקביל');
    ok(/require\.main === module/.test(xt) && /module\.exports = \{ checkOne/.test(xt), 'tools/fund-xcheck.js — גם כלי וגם ספרייה');
    ok(/--hist out\/history\.json --xsyms ibkr-proxy\/lib\/xsyms\.txt/.test(wf) && /head -8 report\.md \| tail -5/.test(wf), 'workflow: שכבה 8 על הרשימה הקבועה, והשורה שלה בהערות ה־Release');
    const xs = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/xsyms.txt'), 'utf8').split('\n').filter(Boolean);
    ok(xs.length >= 500 && xs.length <= 560 && xs.every((s) => /^[A-Z][A-Z0-9.]{0,6}$/.test(s)) && new Set(xs).size === xs.length && xs.join() === xs.slice().sort().join() && ['AAPL', 'MSFT', 'ASML', 'BRK.B'].every((s) => xs.includes(s)),
      'xsyms.txt: S&P 500 ו־Nasdaq-100 — סימבול בכל שורה, ממוין, בלי כפילויות');
    const XS = require(path.join(root, 'tools/xsyms.js'));
    const sp = XS.parseSp('| {{NyseSymbol|MMM}} || 3M\n| {{NasdaqSymbol|AAPL}} || Apple\n| {{NyseSymbol|BRK.B}}\n'), nd = XS.parseNdx({ data: { data: { rows: [{ symbol: 'AAPL' }, { symbol: 'ASML' }, { symbol: '<x>' }] } } });
    ok(sp.join() === 'MMM,AAPL,BRK.B' && nd.join() === 'AAPL,ASML' && XS.merge(sp, nd).join() === 'AAPL,ASML,BRK.B,MMM', 'tools/xsyms.js: ויקיפדיה (S&P 500) + Nasdaq (Nasdaq-100) — איחוד ממוין');
    ok(XS.check(sp, nd) !== null && XS.check(new Array(503).fill('A'), new Array(101).fill('B')) === null, 'tools/xsyms.js: רשימה קטנה מדי (הדף השתנה) — לא דורסים');
    const admX = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8'), appX = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    ok(/if \(v\.x\) faXSection\(p, v\.x\)/.test(admX) && /k === 'x' \? t\('admFaK_x'\)/.test(admX) && ['admFaX', 'admFaXP', 'admFaXS', 'admFaK_x', 'admFaXC_odd', 'admFaXVs'].every((k) => (appX.match(new RegExp('\\b' + k + ':', 'g')) || []).length === 2),
      'מרכז הניהול: שכבה 8 בעמוד labFund, התראה x, מחרוזות בשתי השפות');
  }


  /* 26/10/2026: אי־התאמה לא מוצגת למשתמש — השרתון רושם את המניה, והבקרה הלילית בודקת אותה (בנפרד מ־500 הגדולות) */
  {
    const F = require(path.join(root, 'ibkr-proxy/lib/fundamentals.js'));
    const { fakeR2, ENV } = require('./_r2fake.js');
    const R2L = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
    const S = fakeR2(), deps = Object.assign({}, S.deps, { r2c: R2L.config(ENV), wait: 5000 });
    ok(F.warnKinds({ checks: [{ k: 'qsh' }, { k: 'rst' }, { k: 'face' }, { k: 'bal' }, { k: 'face' }] }).join() === 'bal,face', 'רק סימון אמיתי נרשם — לא תיקון/מידע (qsh, rst…)');
    ok(await F.noteFlags('ZZZ', { checks: [{ k: 'qsh' }] }, deps) === false, 'מניה עם תיקונים בלבד — לא נרשמת');
    ok(await F.noteFlags('ABC', { checks: [{ k: 'face', m: 'rev', p: '2024-12-31' }] }, deps) === true, 'מניה עם אי־התאמה — נרשמת');
    ok(await F.noteFlags('ABC', { checks: [{ k: 'face' }] }, deps) === false, 'פעם ביום למניה במופע');
    const body = S.objs.get('fund/flag/ABC.json') || [...S.objs.entries()].find(([k]) => /fund\/flag\/ABC\.json$/.test(k))?.[1];
    const txt = body ? Buffer.from(body.body || body).toString() : '';
    ok(/"sym":"ABC"/.test(txt) && /"k":\["face"\]/.test(txt) && !/uid|email|@/.test(txt), 'הקובץ: רק הסימבול וסוג הבדיקה — בלי שום פרט על מי פתח');
    const got = await F.flaggedSyms(deps);
    ok(Array.isArray(got) && got.join() === 'ABC', 'הרשימה לבקרה הלילית');
    const SU = FA.summarize([{ sym: 'ABC', uo: 1, r: { ok: true, src: 'sec', checks: [{ k: 'face', m: 'rev', p: '2024-12-31', f: 10, v: 11 }, { k: 'qsh', m: 'sh', p: '2024-12-31' }] } }], null, Date.now(), 0);
    ok(SU.n === 0 && SU.sec === 0 && SU.items.length === 0 && SU.u && SU.u.n === 1 && SU.u.items.length === 1 && SU.u.items[0].k === 'face', 'בסיכום: מניה של משתמש — רק ברשימה נפרדת, בלי לשנות את המספרים של 500');
    const NA = FA.normAudit(JSON.parse(JSON.stringify(SU)));
    ok(NA.u && NA.u.n === 1 && FA.auditView(NA, [], Date.now()).u.items[0].sym === 'ABC', 'השרתון מעביר את הרשימה למרכז הניהול');
    const wf2 = fs.readFileSync(path.join(root, '.github/workflows/fund-audit.yml'), 'utf8');
    ok(/--xsyms ibkr-proxy\/lib\/xsyms\.txt --seen/.test(wf2), 'workflow: --seen — גם המניות שמשתמשים פתחו');
    const an = fs.readFileSync(path.join(root, 'analysis.js'), 'utf8');
    const fl = /const FL_INFO = new Set\((\[[^\]]*\])\)/.exec(an)[1].replace(/'/g, '"');
    ok(JSON.stringify(JSON.parse(fl).sort()) === JSON.stringify([...F.CHECK_INFO].sort()), 'CHECK_INFO בשרתון = FL_INFO במסך');
    ok(/admFaUser/.test(fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8')), 'מרכז הניהול מציג את הרשימה');
  }

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
