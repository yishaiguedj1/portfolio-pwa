/* כניסה עם מייל רגיל, קישור ומיזוג חשבונות (26/10/2026, בקשת המשתמש).
   1) הרשאות לפי כל המיילים המאומתים: הראשי + מייל Google שקושר (accounts:lookup עם הטוקן של המשתמש, מטמון, בלי מפתח בקוד).
   2) /api/session op:'merge' — רק עם טוקן טרי של החשבון השני, busy → 409.
   3) lib/acmerge.js — מיזוג התיק (Invest), הספרייה (Academy) והעבודות של Studio כולל הקבצים ב־R2, ומחיקת החשבון השני.
   4) acclink.js — הודעות לפי קוד ושיטות הכניסה; החיבור ב־cloud.js / shell.js / index.html / auth.js.
   הרצה: node tests/acc-email.test.js */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const G = require(path.join(ROOT, 'ibkr-proxy/lib/gauth.js'));
const S = require(path.join(ROOT, 'ibkr-proxy/lib/session.js'));
const M = require(path.join(ROOT, 'ibkr-proxy/lib/acmerge.js'));
const SF = require(path.join(ROOT, 'ibkr-proxy/lib/sysflags.js'));
const { fakeR2, ENV } = require('./_r2fake.js');

(async () => {
  /* ---------------------------------------------------------------- 1. הרשאות לפי מיילים */
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
  const keys = { k1: fb.publicKey };
  const now = Math.floor(Date.now() / 1000);
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const tok = (claims) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' });
    const bd = b64u(Object.assign({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub: 'uidYahoo1', iat: now - 10, exp: now + 3000, auth_time: now - 20 }, claims));
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  };
  const cfgText = read('firebase-config.js');
  let lookups = 0, cfgReads = 0, lookupStatus = 200;
  const fakeFetch = async (url, init) => {
    if (/firebase-config\.js$/.test(url)) { cfgReads++; return { status: 200, text: async () => cfgText }; }
    if (/accounts:lookup\?key=AIza/.test(url)) {
      lookups++;
      const idt = JSON.parse(init.body).idToken;
      const sub = JSON.parse(Buffer.from(idt.split('.')[1], 'base64').toString()).sub;
      return { status: lookupStatus, json: async () => ({ users: [{ localId: sub, providerUserInfo: [{ providerId: 'password', email: 'me@yahoo.com' }, { providerId: 'google.com', email: 'Me.Linked@Gmail.com' }] }] }) };
    }
    return { status: 404, json: async () => ({}) };
  };
  G._reset();
  const yahooOnly = await G.verifyIdToken(tok({ email: 'me@yahoo.com', email_verified: true, firebase: { sign_in_provider: 'password', identities: { email: ['me@yahoo.com'] } } }), { keys, fetch: fakeFetch });
  ok(lookups === 0 && JSON.stringify(G.emailsOf(yahooOnly)) === '["me@yahoo.com"]', 'מייל רגיל בלי Google — בלי פנייה נוספת, רק המייל הראשי (מאומת)');
  const unver = await G.verifyIdToken(tok({ email: 'me@yahoo.com', email_verified: false, firebase: { sign_in_provider: 'password', identities: { email: ['me@yahoo.com'] } } }), { keys, fetch: fakeFetch });
  ok(G.emailsOf(unver).length === 0 && !G.readerAllowed(unver, 'me@yahoo.com'), 'מייל שלא אומת — בלי הרשאות');
  const linked = await G.verifyIdToken(tok({ email: 'me@yahoo.com', email_verified: true, firebase: { sign_in_provider: 'custom', identities: { email: ['me@yahoo.com'], 'google.com': ['1234'] } } }), { keys, fetch: fakeFetch });
  ok(lookups === 1 && cfgReads === 1 && G.emailsOf(linked).join(',') === 'me@yahoo.com,me.linked@gmail.com', 'Yahoo ראשי + Google מקושר — מייל ה־Google נוסף (המפתח נקרא מ־firebase-config.js באתר, לא מהקוד)');
  process.env.LIBRARY_ADMINS = 'me.linked@gmail.com';
  ok(G.isAdmin(linked) && !G.isAdmin(yahooOnly), 'מנהל לפי מייל ה־Google המקושר');
  delete process.env.LIBRARY_ADMINS;
  ok(G.readerAllowed(linked, 'x@y.com, me.linked@gmail.com') && G.hasEmail(linked, ['me@yahoo.com']), 'קוראי Academy / רשימות לפי כל אחד מהמיילים');
  ok(SF.amHas({ amEm: 'me.linked@gmail.com' }, linked) && SF.tsHas({ tsEm: 'me@yahoo.com' }, linked) && !SF.tsHas({ tsEm: 'me@yahoo.com' }, unver), '"כל המודלים" וחשבונות הבדיקה — לפי המיילים המאומתים');
  await G.verifyIdToken(tok({ email: 'me@yahoo.com', email_verified: true, firebase: { identities: { 'google.com': ['1234'] } } }), { keys, fetch: fakeFetch });
  ok(lookups === 1, 'מטמון לפי uid — בלי פנייה חוזרת');
  const gm = await G.verifyIdToken(tok({ sub: 'uidGmail22', email: 'a@gmail.com', email_verified: true, firebase: { identities: { 'google.com': ['9'], email: ['a@gmail.com'] } } }), { keys, fetch: fakeFetch });
  ok(lookups === 1 && G.emailsOf(gm).join() === 'a@gmail.com', 'חשבון Gmail רגיל — בלי פנייה נוספת');
  lookupStatus = 500;
  const fail = await G.verifyIdToken(tok({ sub: 'uidOther333', email: 'z@outlook.com', email_verified: true, firebase: { identities: { 'google.com': ['9'] } } }), { keys, fetch: fakeFetch });
  ok(G.emailsOf(fail).join() === 'z@outlook.com', 'תקלה בפנייה — רק המייל הראשי, לא נכשל');
  ok(!/AIza[0-9A-Za-z_-]{30,}/.test(read('ibkr-proxy/lib/gauth.js')), 'אין מפתח Google בקוד השרתון');

  /* ---------------------------------------------------------------- 2. op:'merge' */
  let NOW = Date.UTC(2026, 9, 26, 12);
  const sec = () => Math.floor(NOW / 1000);
  const T = {
    a: () => ({ uid: 'uidA111111', authTime: sec() - 9999, provider: 'custom' }),
    bFresh: () => ({ uid: 'uidB222222', authTime: sec() - 20, provider: 'google.com' }),
    bOld: () => ({ uid: 'uidB222222', authTime: sec() - 3600, provider: 'google.com' }),
    bCustom: () => ({ uid: 'uidB222222', authTime: sec() - 5, provider: 'custom' }),
    aFresh: () => ({ uid: 'uidA111111', authTime: sec() - 5, provider: 'password' }),
  };
  const merges = [];
  let busy = false, vsWrites = [];
  const H = S.makeHandler({
    fetch: async (url, init) => { if (init && init.method === 'PATCH') vsWrites.push(url); return { status: 200, json: async () => ({}) }; },
    now: () => NOW, token: async () => 'tk',
    verify: async (t) => { if (!T[t]) throw new Error('bad_token'); return T[t](); },
    merge: async (from, to) => { merges.push([from, to]); return busy ? { busy: true } : { inv: 3, ac: true, jobs: 2, files: 5, kept: 0 }; },
    env: Object.assign({}, process.env, { SNB_SESSION_KEY: Buffer.alloc(32, 7).toString('base64') }),
  });
  const call = async (body) => {
    const res = { code: 0, h: {}, body: null, setHeader(k, v) { this.h[k.toLowerCase()] = v; }, getHeader(k) { return this.h[k.toLowerCase()]; },
      status(c) { this.code = c; return this; }, json(o) { this.body = o; return this; }, end() { return this; } };
    await H({ method: 'POST', headers: { origin: 'https://invest.thesnowball.app', 'x-forwarded-for': '10.1.1.' + (++n % 200) }, body }, res);
    return res;
  };
  let r = await call({ op: 'merge', idToken: 'a', idTokenB: 'bOld' });
  ok(r.code === 403 && r.body.error === 'not_fresh' && !merges.length, 'בלי התחברות טרייה לחשבון השני — אין מיזוג');
  r = await call({ op: 'merge', idToken: 'a', idTokenB: 'bCustom' });
  ok(r.code === 403 && !merges.length, 'טוקן מותאם של החשבון השני לא מוכיח בעלות');
  r = await call({ op: 'merge', idToken: 'a', idTokenB: 'aFresh' });
  ok(r.code === 400 && !merges.length, 'אותו חשבון — 400');
  r = await call({ op: 'merge', idToken: 'nope', idTokenB: 'bFresh' });
  ok(r.code === 401 && !merges.length, 'טוקן לא תקין — 401');
  busy = true;
  r = await call({ op: 'merge', idToken: 'a', idTokenB: 'bFresh' });
  ok(r.code === 409 && r.body.error === 'busy', 'עבודה רצה בחשבון השני → 409 busy');
  busy = false; vsWrites = [];
  r = await call({ op: 'merge', idToken: 'a', idTokenB: 'bFresh' });
  ok(r.code === 200 && r.body.ok && r.body.jobs === 2 && merges[merges.length - 1].join() === 'uidB222222,uidA111111', 'מיזוג: B → A');
  ok(vsWrites.some((u) => /sessions\/uidB222222/.test(u)), 'העוגיות של החשבון השני מתבטלות (vs)');

  /* ---------------------------------------------------------------- 3. acmerge */
  const inv = M.investMerge(
    { positions: [{ sym: 'AAPL', qty: 1 }], manualTrades: [{ id: 't1', sym: 'NVDA', date: '2026-01-02', side: 'buy', qty: 1, price: 100 }], deposits: [{ date: '01/01/2026', amount: 100 }], cash: { usd: 0, ils: 0 }, wishlist: [{ sym: 'KO' }] },
    { positions: [{ sym: 'aapl', qty: 9 }, { sym: 'MSFT', qty: 2 }], manualTrades: [{ id: 't1', sym: 'NVDA', date: '2026-01-02', side: 'buy', qty: 1, price: 100 }, { id: 't9', sym: 'TSLA', date: '2026-02-02', side: 'buy', qty: 1, price: 5 }],
      deposits: [{ date: '01/01/2026', amount: 100 }, { date: '02/02/2026', amount: 50 }], cash: { usd: 7, ils: 0 }, wishlist: [{ sym: 'ko' }, { sym: 'PEP' }], stockOrder: ['X'] });
  ok(inv.n === 5, 'Invest: נוספו רק מה שחסר (מניה, עסקה, הפקדה, מזומן, מעקב)');
  const inv2 = { positions: [], stockOrder: ['A'] }; M.investMerge(inv2, { stockOrder: ['B'], demo: true, wlOrder: ['w'] });
  ok(inv2.stockOrder[0] === 'A' && inv2.wlOrder[0] === 'w' && inv2.demo === undefined, 'שדות אחרים — רק כש־A עוד אין, ובלי מצב דמו');
  const A0 = { positions: [{ sym: 'AAPL', qty: 1 }] };
  M.investMerge(A0, { positions: [{ sym: 'AAPL', qty: 9 }] });
  ok(A0.positions.length === 1 && A0.positions[0].qty === 1, 'Invest: מה שכבר ב־A לא נדרס');
  ok(JSON.stringify(M.fsToJs(M.jsToFs({ a: [1, 2.5, 'x', true, null, { b: 'c' }] }))) === '{"a":[1,2.5,"x",true,null,{"b":"c"}]}', 'המרה Firestore ↔ JS הלוך וחזור');

  // Firestore מדומה + R2 מדומה
  const R = fakeR2();
  Object.assign(process.env, ENV);
  const docs = new Map();
  const put = (col, id, fields) => docs.set(col + '/' + id, { fields });
  put('users', 'uidB222222', { v: { integerValue: '1' }, db: M.jsToFs({ positions: [{ sym: 'MSFT', qty: 2 }], deposits: [] }) });
  put('users', 'uidA111111', { v: { integerValue: '1' }, db: M.jsToFs({ positions: [{ sym: 'AAPL', qty: 1 }], deposits: [] }) });
  put('academyUsers', 'uidB222222', { lib: { mapValue: { fields: { p: { mapValue: { fields: { book1: { stringValue: 'b' }, book2: { stringValue: 'b2' } } } } } } } });
  put('academyUsers', 'uidA111111', { lib: { mapValue: { fields: { p: { mapValue: { fields: { book1: { stringValue: 'a' } } } } } } } });
  put('studioJobs', 'jobDone1', { uid: { stringValue: 'uidB222222' }, state: { stringValue: 'done' }, kind: { stringValue: 'tr' }, folder: { stringValue: 'R2_jobDone1' } });
  put('studioUp', 'R2_jobDone1_aaaaaaaaaaaa', { f: { stringValue: 'R2_jobDone1' }, uid: { stringValue: 'uidB222222' }, k: { stringValue: 'st/uidB222222/R2_jobDone1_aaaaaaaaaaaa' } });
  put('studioVault', 'uidB222222', { r: { stringValue: 'enc' } });
  put('studioStats', 'uidB222222', { hpc: { integerValue: '500' } });
  R.objs.set('st/uidB222222/R2_jobDone1_aaaaaaaaaaaa', Buffer.from('video'));
  R.meta && R.meta.set('st/uidB222222/R2_jobDone1_aaaaaaaaaaaa', { type: 'video/mp4' });
  const fsFetch = async (url, init = {}) => {
    if (/r2\.cloudflarestorage\.com/.test(url)) return R.fetch(url, init);
    const m = /documents(\/[^?:]*)?(:runQuery)?(\?.*)?$/.exec(url);
    const p = (m[1] || '').replace(/^\//, ''), method = init.method || 'GET';
    const resp = (status, j) => ({ status, json: async () => j });
    if (m[2]) {
      const q = JSON.parse(init.body).structuredQuery;
      const f = q.where.fieldFilter;
      const out = [...docs.entries()].filter(([k, d]) => k.startsWith(q.from[0].collectionId + '/') && d.fields[f.field.fieldPath] && d.fields[f.field.fieldPath].stringValue === f.value.stringValue)
        .map(([k, d]) => ({ document: { name: 'projects/x/databases/(default)/documents/' + k, fields: d.fields } }));
      return resp(200, out);
    }
    if (method === 'GET') return docs.has(p) ? resp(200, docs.get(p)) : resp(404, {});
    if (method === 'DELETE') { docs.delete(p); return resp(200, {}); }
    if (method === 'PATCH') { const cur = docs.get(p) || { fields: {} }; Object.assign(cur.fields, JSON.parse(init.body).fields); docs.set(p, cur); return resp(200, cur); }
    return resp(400, {});
  };
  const deps = { fetch: fsFetch, token: async () => 'tk', nowMs: () => R.now };
  put('studioJobs', 'jobRun9', { uid: { stringValue: 'uidB222222' }, state: { stringValue: 'running' }, kind: { stringValue: 'tr' }, folder: { stringValue: 'R2_jobRun9' } });
  let out = await M.mergeAccounts(deps, 'uidB222222', 'uidA111111');
  ok(out.busy && docs.has('users/uidB222222'), 'עבודה רצה בחשבון השני — לא נוגעים בכלום');
  docs.delete('studioJobs/jobRun9');
  out = await M.mergeAccounts(deps, 'uidB222222', 'uidA111111');
  const adb = M.fsToJs(docs.get('users/uidA111111').fields.db);
  ok(out.inv === 1 && adb.positions.map((p) => p.sym).join() === 'AAPL,MSFT', 'Invest: התיק של B נוסף לתיק של A');
  const lp = docs.get('academyUsers/uidA111111').fields.lib.mapValue.fields.p.mapValue.fields;
  ok(out.ac && lp.book1.stringValue === 'a' && lp.book2.stringValue === 'b2', 'Academy: לפי ספר — A גובר, מה שחסר נוסף');
  ok(out.jobs === 1 && docs.get('studioJobs/jobDone1').fields.uid.stringValue === 'uidA111111', 'Studio: העבודה עברה ל־A');
  ok(R.objs.has('st/uidA111111/R2_jobDone1_aaaaaaaaaaaa') && !R.objs.has('st/uidB222222/R2_jobDone1_aaaaaaaaaaaa'), 'Studio: הקובץ ב־R2 עבר למפתח של A');
  const up = docs.get('studioUp/R2_jobDone1_aaaaaaaaaaaa').fields;
  ok(up.uid.stringValue === 'uidA111111' && up.k.stringValue === 'st/uidA111111/R2_jobDone1_aaaaaaaaaaaa', 'Studio: רשומת ההעלאה מצביעה על A');
  ok(out.stats && docs.has('studioStats/uidA111111'), 'Studio: ההגדרות של B עוברות כש־A עוד אין');
  ok(!docs.has('users/uidB222222') && !docs.has('academyUsers/uidB222222') && !docs.has('studioVault/uidB222222') && !docs.has('studioStats/uidB222222'), 'המסמכים של B (כולל הכספות) נמחקו');
  await assert.rejects(() => M.mergeAccounts(deps, 'uidA111111', 'uidA111111'), /bad_uid/);
  ok(true, 'מיזוג חשבון לעצמו — נדחה');

  /* ---------------------------------------------------------------- 4. הטלפון */
  const src = read('acclink.js');
  const mod = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));
  ok(mod.errKey('auth/invalid-credential') === 'accErrCred' && mod.errKey('auth/email-already-in-use') === 'accErrInUse' && mod.errKey('auth/popup-closed-by-user') === ''
    && mod.errKey('auth/operation-not-allowed') === 'accErrOff' && mod.errKey('x') === 'accErrGen', 'הודעה לפי קוד השגיאה של Firebase (ביטול = בלי הודעה)');
  const mm = mod.methodsOf({ email: 'me@yahoo.com', emailVerified: false, providerData: [{ providerId: 'password', email: 'me@yahoo.com' }, { providerId: 'google.com', email: 'me@gmail.com' }] });
  ok(mm.google === 'me@gmail.com' && mm.mail === 'me@yahoo.com' && !mm.verified && mm.n === 2, 'שיטות הכניסה של החשבון');
  ok(mod.methodsOf({ providerData: [{ providerId: 'google.com', email: 'g@gmail.com' }] }).mail === null, 'רק Google — בלי מייל וסיסמה');
  ok(!/\bfetch\(/.test(src.replace(/await fetch\(base \+ '\/api\/session'/, '')), 'acclink.js פונה רק ל־/api/session (המיזוג)');
  ok(/window\.__snbHold = true/.test(src) && /held\(\)/.test(read('cloud.js')), 'בזמן מיזוג — cloud.js לא דורס את המסמך הממוזג');
  const app = read('app.js');
  const tks = new Set([...src.matchAll(/\bt\('([A-Za-z]\w*)'/g)].map((x) => x[1]));
  const heBlock = app.slice(app.indexOf('const STRINGS = {'), app.indexOf("  googleSignIn: 'Sign in with Google'"));
  const enBlock = app.slice(app.indexOf("  googleSignIn: 'Sign in with Google'"));
  const miss = [...tks].filter((k) => !heBlock.includes('  ' + k + ':') || !enBlock.includes('  ' + k + ':'));
  ok(miss.length === 0, 'כל מחרוזת של acclink.js בעברית ובאנגלית' + (miss.length ? ': ' + miss.join(',') : ''));
  for (const f of ['strings-academy.js', 'strings-studio.js', 'strings-admin.js']) ok(read(f).includes('"accMergeQ":'), f + ' כולל את המחרוזות (coregen)');
  ok(/id="emailLoginBtn"/.test(read('index.html')) && /emailLoginBtn/.test(read('cloud.js')) && /emailLoginBtn/.test(read('shell.js')), 'כפתור "כניסה עם מייל" ב־Invest וב־Academy/Studio');
  ok(/accMethods/.test(read('cloud.js')) && /accMethods/.test(read('shell.js')), 'שורת "שיטות כניסה" בכרטיס החשבון בשלוש האפליקציות');
  ok(/emailLinkLanding\(\)/.test(read('auth.js')) && /window\.SnbAcct/.test(read('auth.js')), 'auth.js (Academy/Studio) — אותם אזורים <auth>: חזרה מקישור במייל + SnbAcct');
  const sw = read('sw.js');
  ok((sw.match(/'\.\/acclink\.js'/g) || []).length === 3, 'acclink.js בשלוש המעטפות של sw.js');
  ok(/'acclink\.js'\]/.test(read('tools/coregen.js')), 'coregen אוסף את המחרוזות של acclink.js');

  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error('נכשל:', e && e.message); process.exit(1); });
