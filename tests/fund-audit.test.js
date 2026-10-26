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
    ok(/growthCheck\(r\)/.test(tool) && /analysis\.js/.test(tool) && /AN\.growthOf/.test(tool), 'שכבה 7: הבדיקה הלילית מריצה את הקוד של המסך עצמו (analysis.js) מול companyfacts');
    const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8'), appS = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    ok(/case 'gr': return t\('admFaK_gr'\)/.test(adm) && (appS.match(/admFaK_gr:/g) || []).length === 2 && (appS.match(/admFaK_rst:/g) || []).length === 2, 'שכבה 7: תווית במרכז הניהול בשתי השפות');
  }

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
