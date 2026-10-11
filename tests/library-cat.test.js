// מנהל הספרייה, ס׳1 (11/10/2026): הקטלוג ב־R2 דרך השרתון — קריאה לקוראים (מלא / הפרש / "אין שינוי"), קישורים חתומים,
// עריכה של המנהל בכתיבה מותנית (שני כותבים במקביל — אף אחד לא נדרס), בקשה חוזרת, ביטול, והרשאות.
// הרצה: node tests/library-cat.test.js
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ENV } = require('./_r2fake');

(async () => {
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, ENV, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com,reader@example.com',
  });
  delete process.env.LIBRARY_FOLDER_ID;     // הקטלוג ב־R2 לא צריך את תיקיית Drive
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const LM = require(path.join(root, 'ibkr-proxy/lib/libmgr.js'));
  const C = require(path.join(root, 'ibkr-proxy/lib/libcat.js'));
  const lib = require(path.join(root, 'ibkr-proxy/api/library.js'));
  gauth._reset(); lib._reset(); R2._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (email, sub) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const OWNER = tok('owner@example.com', 'ownerUid0001'), READER = tok('reader@example.com', 'readerUid001');
  const R = fakeR2();
  const fetchAll = async (url, opt = {}) => (url.includes('.r2.cloudflarestorage.com') ? R.fetch(url, opt) : { status: 404, ok: false, json: async () => ({}) });
  const call = async (body, idToken = OWNER) => {
    const res = { code: 0, j: null, hd: {}, setHeader(k, v) { res.hd[k] = v; }, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, send() { return res; }, end() { return res; } };
    await lib._handler({ method: 'POST', body: Object.assign({ idToken }, body), headers: { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '9.9.9.' + (n % 200) } }, res, { verify: { keys }, fetch: fetchAll });
    return res;
  };
  const deps = { fetch: R.fetch, sleep: async () => {} };
  const readGz = (k) => JSON.parse(zlib.gunzipSync(R.objs.get(k)).toString('utf8'));

  /* 1. קטלוג ריק */
  let r = await call({ op: 'me' });
  ok(r.j.ok && r.j.admin && r.j.cat === true, 'me: מנהל + יש קטלוג ב־R2');
  r = await call({ op: 'cat' }, READER);
  ok(r.j.ok && r.j.v === 0 && r.j.full && Object.keys(r.j.full.books).length === 0 && r.j.src === 'drive', 'קורא: קטלוג ריק, המקור עדיין Drive');

  /* 2. הוספה (רק מהשרתון — כמו שהייבוא יעשה) */
  const F = (c) => ({ fmt: 'epub', md5: c.repeat(32), size: 1200 });
  for (const [i, y] of [[1, 2021], [2, 2022], [3, 2023]]) {
    await LM.writeCat(deps, (cat) => C.applyOps(cat, [{ op: 'add', book: { id: 'id-letter-' + y, title: 'מכתב באפט ' + y, author: 'וורן באפט', st: y === 2023 ? 'draft' : 'pub', files: [F(String(i))], cover: { h: 'c' + i + 'c'.repeat(15), r: 0.66 } } }], { now: Date.now(), internal: true }));
    R.objs.set(C.KEYS.file(F(String(i))), Buffer.from('PK-epub-' + y));
  }
  ok(readGz(C.KEYS.cat).v === 3 && readGz(C.KEYS.pub).v === 3 && R.objs.has(C.KEYS.arc(3)), 'כל כתיבה: קטלוג + מבט קורא + ארכיון לגרסה');
  ok(Object.keys(readGz(C.KEYS.pub).books).join() === 'id-letter-2021,id-letter-2022', 'מבט הקורא בלי הטיוטה');
  ok(R.meta.get(C.KEYS.cat).am.v === '3', 'מספר הגרסה גם בפרטי הקובץ (בדיקה זולה בלי הורדה)');

  /* 3. קורא: מלא, ואז "אין שינוי" */
  lib._reset();
  r = await call({ op: 'cat' }, READER);
  ok(r.j.v === 3 && r.j.full && Object.keys(r.j.full.books).length === 2 && !('lock' in r.j.full.books['id-letter-2021']), 'קורא: תמונה מלאה בלי טיוטות ובלי שדות ניהול');
  r = await call({ op: 'cat', have: 3 }, READER);
  ok(r.j.same === true && !r.j.full, 'קורא מעודכן: "אין שינוי"');

  /* 4. הרשאות */
  r = await call({ op: 'adminCat' }, READER);
  ok(r.code === 403 && r.j.error === 'not_admin', 'קורא לא מקבל את תצוגת המנהל');
  r = await call({ op: 'catApply', ops: [{ op: 'del', ids: ['id-letter-2021'] }] }, READER);
  ok(r.code === 403, 'קורא לא עורך');
  r = await call({ op: 'catApply', ops: [{ op: 'add', book: { id: 'id-evil', title: 'x', st: 'pub' } }] });
  ok(r.code === 400 && r.j.error === 'bad_op', 'גם המנהל לא מוסיף ספר ישירות מהטלפון (רק דרך העלאה)');
  r = await call({ op: 'adminCat' });
  ok(r.j.full.books['id-letter-2023'].st === 'draft' && r.j.full.hist.length === 3 && !('inv' in r.j.full.hist[0]) && r.j.full.hist[2].undo, 'מנהל: גם טיוטות, ויומן בלי הערכים הקודמים');

  /* 5. עריכה של המנהל + גוף גדול */
  const big = 'א'.repeat(1500);
  r = await call({ op: 'catApply', rid: 'req-000001', ops: [{ op: 'bulk', ids: ['id-letter-2021', 'id-letter-2022', 'id-letter-2023'], f: { series: 'מכתבי באפט', desc: big }, num: { start: 2021 } }, { op: 'state', ids: ['id-letter-2023'], st: 'pub' }] });
  ok(r.j.ok && r.j.v === 4 && r.j.n === 3, 'עריכה מרובה + פרסום = גרסה אחת');
  r = await call({ op: 'catApply', rid: 'req-000001', ops: [{ op: 'bulk', ids: ['id-letter-2021'], f: { series: 'שוב' } }] });
  ok(r.j.ok && r.j.dup && r.j.v === 4 && readGz(C.KEYS.cat).v === 4, 'בקשה חוזרת (אותו rid) — לא מוחלת פעמיים');
  r = await call({ op: 'cat', have: 3 }, READER);
  ok(r.j.v === 4 && r.j.up.length === 3 && r.j.rm.length === 0 && r.j.up.find((b) => b.id === 'id-letter-2023').seriesIdx === '2023', 'קורא: רק ההפרש (כולל הספר שפורסם)');
  const huge = Array.from({ length: 40 }, (_, i) => ({ op: 'set', id: 'id-letter-2021', f: { desc: 'ב'.repeat(1400) + i } }));
  r = await call({ op: 'catApply', ops: huge });
  ok(r.j.ok, 'עריכה של המנהל עד 64KB עוברת');
  r = await call({ op: 'cat', pad: 'x'.repeat(5000) }, READER);
  ok(r.code === 413 || r.code === 400, 'בקשה רגילה מעל 4KB — נחסמת');

  /* 6. שני כותבים במקביל: הראשון נכשל ב־412, טוען שוב ומחיל מחדש — שום עריכה לא אובדת */
  const v0 = readGz(C.KEYS.cat).v;
  let calls = 0;
  const res6 = await LM.writeCat(deps, (cat) => {
    calls++;
    if (calls === 1) {   // מכשיר אחר כותב בדיוק עכשיו
      const other = C.applyOps(cat, [{ op: 'note', id: 'id-letter-2022', text: 'ממכשיר אחר' }], { now: Date.now() }).cat;
      R.objs.set(C.KEYS.cat, zlib.gzipSync(Buffer.from(JSON.stringify(other))));
    }
    return C.applyOps(cat, [{ op: 'set', id: 'id-letter-2021', f: { pub: 'ברקשייר' } }], { now: Date.now() });
  });
  const after = readGz(C.KEYS.cat);
  ok(calls === 2 && res6.v === v0 + 2 && after.books['id-letter-2022'].note === 'ממכשיר אחר' && after.books['id-letter-2021'].pub === 'ברקשייר', 'כתיבה במקביל: 412 → טעינה מחדש → שתי העריכות נשמרות');

  /* 7. 429 (כתיבה שנייה באותה שנייה) — מחכים ומנסים שוב */
  R.rate429 = true;
  R.lastPut.set(C.KEYS.cat, R.now);
  let slept = 0;
  const once = { n: 0 };
  const d7 = { fetch: async (u, o) => { if (o && o.method === 'PUT' && once.n++ === 1) R.now += 1000; return R.fetch(u, o); }, sleep: async (ms) => { slept += ms; R.now += 2000; } };
  LM._reset();
  const r7 = await LM.writeCat(d7, (cat) => C.applyOps(cat, [{ op: 'set', id: 'id-letter-2022', f: { pub: 'X' } }], { now: Date.now() }));
  ok(r7.v === after.v + 1 && slept >= 1100, 'R2 מחזיר 429 — מחכים שנייה ומצליחים');
  R.rate429 = false;

  /* 8. ביטול */
  const vBefore = readGz(C.KEYS.cat).v;
  r = await call({ op: 'catApply', ops: [{ op: 'del', ids: ['id-letter-2022'] }] });
  ok(r.j.ok && readGz(C.KEYS.cat).books['id-letter-2022'].del, 'מחיקה = לסל');
  r = await call({ op: 'cat', have: vBefore }, READER);
  ok(r.j.rm.some((x) => x.id === 'id-letter-2022'), 'אצל הקורא — הסרה');
  r = await call({ op: 'undo', v: r.j.v });
  ok(r.j.ok && !readGz(C.KEYS.cat).books['id-letter-2022'].del, 'ביטול מחזיר את הספר');
  r = await call({ op: 'undo', v: 9999 });
  ok(r.code === 409 && r.j.error === 'no_version', 'ביטול גרסה שלא קיימת = 409');

  /* 9. קישורים חתומים */
  r = await call({ op: 'urls', ids: ['id-letter-2021', 'id-letter-2022', 'id-nope'] }, READER);
  ok(Object.keys(r.j.urls).length === 2 && /lib\/v2\/f\/1{32}\.epub\?/.test(r.j.urls['id-letter-2021']), 'קישורים לקבצים — רק לספרים שפורסמו');
  ok(Buffer.compare(Buffer.from(await (await R.fetch(r.j.urls['id-letter-2021'])).arrayBuffer()), Buffer.from('PK-epub-2021')) === 0, 'הקישור מוריד את הקובץ');
  r = await call({ op: 'urls', kind: 'c', ids: ['id-letter-2022'] }, READER);
  ok(/lib\/v2\/c\/c2c{15}\.jpg\?/.test(r.j.urls['id-letter-2022']), 'קישור לכריכה');
  await call({ op: 'catApply', ops: [{ op: 'state', ids: ['id-letter-2022'], st: 'draft' }] });
  r = await call({ op: 'urls', ids: ['id-letter-2022'] }, READER);
  ok(!r.j.urls['id-letter-2022'], 'טיוטה — בלי קישור לקורא');
  r = await call({ op: 'urls', ids: ['id-letter-2022'] });
  ok(!!r.j.urls['id-letter-2022'], 'למנהל — יש (תצוגה מקדימה)');

  /* 10. שמירה מפני מחיקה גורפת */
  let sc = C.emptyCatalog();
  for (let i = 0; i < 12; i++) sc = C.applyOps(sc, [{ op: 'add', book: { id: 'id-s' + i, title: 'ס' + i } }], { now: 1, internal: true }).cat;
  R.objs.set(C.KEYS.cat, zlib.gzipSync(Buffer.from(JSON.stringify(sc)))); LM._reset();
  let thrown = '';
  try { await LM.writeCat(deps, (cat) => C.applyOps(cat, [{ op: 'del', ids: Object.keys(cat.books) }, { op: 'purge', ids: Object.keys(cat.books) }], { now: 3 })); } catch (e) { thrown = e.message; }
  ok(thrown === 'shrink', 'מחיקה לצמיתות של יותר מ־30% מהקטלוג בפעולה אחת — נחסמת (shrink)');

  /* 11. בלי R2 */
  for (const k of Object.keys(ENV)) delete process.env[k];
  R2._reset(); lib._reset();
  r = await call({ op: 'cat' }, READER);
  ok(r.code === 503 && r.j.error === 'no_r2', 'בלי R2 — 503 ברור (הטלפון נשאר על Drive)');

  console.log('\n' + n + ' passed');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
