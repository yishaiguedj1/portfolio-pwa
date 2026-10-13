// מנהל הספרייה, ס׳2 (11/10/2026): המעבר מ־Drive לקטלוג ב־R2 + העלאות.
// העיקרון: אף מזהה מקומי לא משתנה ואף קורא לא מוריד שוב — טלפון ישן אחרי המעבר מקבל את אותם מזהים ואותו md5,
// גם כש־Drive לא זמין בכלל. המעבר ממשיך אחרי ניתוק (בלי כפילויות), ומזהה את סוג הקובץ לפי התוכן.
// הרצה: node tests/library-migrate.test.js
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
    LIBRARY_READERS: 'owner@example.com,reader@example.com', LIBRARY_FOLDER_ID: 'FOLDER0000001',
  });
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const C = require(path.join(root, 'ibkr-proxy/lib/libcat.js'));
  const LM = require(path.join(root, 'ibkr-proxy/lib/libmgr.js'));
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

  const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
  const zipHead = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(26), Buffer.from('mimetypeapplication/epub+zip')]);
  const epub = (t) => Buffer.concat([zipHead, Buffer.from('META-INF/container.xml ' + t)]);
  const mobi = (t) => Buffer.concat([Buffer.alloc(60), Buffer.from('BOOKMOBI'), Buffer.from(t)]);
  const jpeg = (t) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from(t)]);

  /* Drive של המנהל: 2 EPUB, AZW3 אחד, קובץ פגום, ומכתב כפול (אותו dc:identifier בשני קבצים — לקח v314) */
  const R = fakeR2();
  const D = { down: false, files: new Map(), media: 0 };
  const put = (id, name, buf) => D.files.set(id, { id, name, buf, parents: ['FOLDER0000001'] });
  put('LETTER000001', 'מכתב 2023.epub', epub('2023'));
  put('LETTER000002', 'מכתב 2022.epub', epub('2022'));
  put('LETTER000003', 'מכתב 1977.azw3', mobi('1977'));
  put('LETTER000004', 'שבור.epub', Buffer.from('this is not a book at all'));
  put('LETTER000005', 'מכתב 2023 עותק.epub', epub('2023-copy'));
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), arrayBuffer: async () => Buffer.from(JSON.stringify(o)), headers: { get: () => 'application/json' } });
  const fetchAll = async (url, opt = {}) => {
    if (url.includes('.r2.cloudflarestorage.com')) return R.fetch(url, opt);
    if (D.down && /googleapis\.com/.test(url)) return J({}, 503);
    if (url.includes('oauth2.googleapis.com/token')) return J({ access_token: 'SA', expires_in: 3600 });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files')) {
      const u = new URL(url);
      if (u.searchParams.get('q')) return J({ files: [...D.files.values()].map((f) => ({ id: f.id, name: f.name, size: String(f.buf.length), md5Checksum: md5(f.buf), modifiedTime: '2026-10-01T00:00:00Z', mimeType: 'application/epub+zip' })) });
      const id = u.pathname.split('/').pop(), f = D.files.get(id);
      if (!f) return J({}, 404);
      if (u.searchParams.get('alt') === 'media') { D.media++; return { status: 200, ok: true, arrayBuffer: async () => f.buf, headers: { get: () => 'application/epub+zip' } }; }
      return J({ parents: f.parents, size: String(f.buf.length), name: f.name });
    }
    return J({}, 404);
  };
  const AI = { gets: [], sets: [], calls: 0, map: new Map() };
  const aiStore = { get: async (k, a) => { AI.gets.push(a.join('|')); return AI.map.get(k + '|' + a.join('|')) || null; }, set: async (k, a, v) => { AI.sets.push(a.join('|')); AI.map.set(k + '|' + a.join('|'), v); }, allow: async () => ({ ok: true }) };
  let ip = 0;
  const call = async (body, idToken = OWNER) => {
    const res = { code: 0, j: null, raw: null, hd: {}, setHeader(k, v) { res.hd[k] = v; }, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, send(b) { res.raw = b; return res; }, end() { return res; } };
    await lib._handler({ method: 'POST', body: Object.assign({ idToken }, body), headers: { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '8.8.' + (ip++ % 250) + '.1' } }, res,
      { verify: { keys }, fetch: fetchAll, aiStore, insight: async () => { AI.calls++; return { insight: { summary: 'x' } }; } });
    return res;
  };
  const readCat = () => JSON.parse(zlib.gunzipSync(R.objs.get(C.KEYS.cat)).toString('utf8'));

  /* 0. לפני המעבר: טלפון ישן כרגיל — רשימה מ־Drive, ומכתב אחד כבר נשמר ב־R2 */
  let r = await call({ op: 'list' }, READER);
  const before = r.j.items.map((i) => i.id + ':' + i.md5).sort().join();
  ok(r.j.items.length === 5, 'לפני המעבר: הרשימה מ־Drive');
  await call({ op: 'file', id: 'LETTER000001', via: 'r2' }, READER);
  ok(R.objs.has('lib/LETTER000001.' + md5(epub('2023')) + '.epub'), 'מכתב אחד כבר שמור ב־R2 (במבנה הישן)');

  /* 1. תוכנית המעבר */
  r = await call({ op: 'migratePlan' }, READER);
  ok(r.code === 403, 'המעבר — רק למנהל');
  r = await call({ op: 'migratePlan' });
  const plan = r.j;
  ok(plan.ok && plan.src === 'drive' && plan.items.length === 5 && plan.items.find((i) => i.id === 'LETTER000001').m === 1 && plan.items.find((i) => i.id === 'LETTER000002').m === 0, 'תוכנית: כל קובץ, ומה כבר ב־R2');

  /* 2. הטלפון של המנהל שולח לכל קובץ את הרשומה שלו (המזהה המקומי, הפרטים, מה שנערך ביד) */
  const recs = [
    { d: 'LETTER000001', book: { id: 'id-urn:uuid:buffett-2023', title: 'מכתב באפט 2023', author: 'וורן באפט', lang: 'he', lock: ['title'] } },
    { d: 'LETTER000002', book: { id: 'id-urn:uuid:buffett-2022', title: 'מכתב באפט 2022', author: 'וורן באפט', st: 'hide' } },
    { d: 'LETTER000003', book: { id: 'id-urn:uuid:buffett-1977', title: 'מכתב באפט 1977', author: 'וורן באפט' } },
    { d: 'LETTER000004', book: { id: 'id-broken', title: 'שבור' } },
    { d: 'LETTER000005', book: { id: 'id-urn:uuid:buffett-2023', title: 'כפול' } },
    { d: 'LETTER-NOPE1', book: { id: 'id-x1', title: 'x' } },
  ];
  const media0 = D.media;
  r = await call({ op: 'migrateCommit', rid: 'mig-0001', items: recs });
  const mj = r.j;
  ok(mj.ok && mj.done.sort().join() === 'LETTER000001,LETTER000002,LETTER000003', 'עברו: שלושת הספרים התקינים');
  ok(mj.bad.length === 1 && mj.bad[0].d === 'LETTER000004' && mj.bad[0].why === 'type', 'קובץ שאינו ספר — נדחה לפי התוכן (לא לפי הסיומת)');
  ok(mj.dup.length === 1 && mj.dup[0].d === 'LETTER000005' && mj.missing.join() === 'LETTER-NOPE1', 'מזהה כפול מדווח למנהל; קובץ שלא ב־Drive — חסר');
  ok(D.media - media0 === 3, 'מה שכבר ב־R2 — הועתק בתוך R2; השאר הורד מ־Drive פעם אחת (כולל הפגום, שנבדק)');
  const cat = readCat();
  const b23 = cat.books['id-urn:uuid:buffett-2023'], b22 = cat.books['id-urn:uuid:buffett-2022'], b77 = cat.books['id-urn:uuid:buffett-1977'];
  ok(b23.files[0].md5 === md5(epub('2023')) && b23.files[0].fmt === 'epub' && R.objs.has('lib/v2/f/' + md5(epub('2023')) + '.epub'), 'קובץ ה־EPUB במקומו החדש, אותו md5');
  ok(b77.files[0].fmt === 'azw3' && R.objs.has('lib/v2/f/' + md5(mobi('1977')) + '.azw3'), 'AZW3 מזוהה לפי התוכן (לא נשמר יותר כ־.epub)');
  ok(b23.legacy.driveId === 'LETTER000001' && b23.st === 'pub' && b22.st === 'hide' && b23.batch === 'migrate', 'מיפוי ישן נשמר; מוסתר אצל המנהל = מוסתר לכולם (לפי בחירתו)');
  ok(b23.lock.join() === 'title' && b23.prov.title === 'user' && b23.prov.author === 'file', 'שדה שנערך ביד — נעול ומסומן "ידני"; השאר מהקובץ');

  /* 3. המשך אחרי ניתוק: אותה מנה שוב — בלי כפילויות */
  const v1 = readCat().v;
  r = await call({ op: 'migrateCommit', rid: 'mig-0002', items: recs.slice(0, 3) });
  ok(r.j.skip.length === 3 && r.j.done.length === 0 && readCat().v === v1, 'מנה שחוזרת — מדולגת, הקטלוג לא משתנה');
  r = await call({ op: 'migratePlan' });
  ok(r.j.items.find((i) => i.id === 'LETTER000003').c === 'id-urn:uuid:buffett-1977', 'התוכנית יודעת מה כבר עבר');

  /* 4. עד הסוף: טלפונים ישנים ממשיכים מ־Drive */
  lib._reset();
  r = await call({ op: 'list' }, READER);
  ok(r.j.items.length === 5, 'לפני "סיום המעבר" — הרשימה עדיין מ־Drive');
  const FOLDER = process.env.LIBRARY_FOLDER_ID;
  delete process.env.LIBRARY_FOLDER_ID; lib._reset();
  r = await call({ op: 'list' }, READER);
  ok(r.code === 503 && r.j.error === 'not_configured' && r.j.diag.folder === 'missing', 'לפני סיום המעבר בלי LIBRARY_FOLDER_ID — "לא מוגדר" עם שם המשתנה');
  process.env.LIBRARY_FOLDER_ID = FOLDER; lib._reset();

  /* 5. סיום המעבר: המקור = R2. טלפון ישן — אותם מזהים ואותו md5, גם כש־Drive לא זמין */
  r = await call({ op: 'migrateFinish', rid: 'mig-fin1' });
  ok(r.j.ok && r.j.src === 'r2' && readCat().cfg.source === 'r2', 'סיום: המקור = R2');
  D.down = true; lib._reset(); gauth._reset();
  r = await call({ op: 'list' }, READER);
  const after = r.j.items.map((i) => i.id + ':' + i.md5).sort();
  ok(r.j.ok && after.length === 2 && after.every((x) => before.includes(x)), 'טלפון ישן: אותם מזהים ואותו md5 (בלי המוסתר) — אפס הורדות חוזרות');
  r = await call({ op: 'file', id: 'LETTER000003', via: 'r2' }, READER);
  ok(r.j.ok && /\/lib\/v2\/f\/[a-f0-9]{32}\.azw3\?/.test(r.j.url), 'קישור לקובץ מהמקום החדש — בלי Drive');
  r = await call({ op: 'file', id: 'LETTER000001' }, READER);
  ok(r.raw && Buffer.compare(r.raw, epub('2023')) === 0, 'טלפון ישן בלי via — הקובץ עצמו מ־R2');
  r = await call({ op: 'file', id: 'id-urn:uuid:buffett-2023', via: 'r2' }, READER);
  ok(r.j.ok && r.j.url, 'גם לפי המזהה של הקטלוג');
  r = await call({ op: 'file', id: 'LETTER000002', via: 'r2' }, READER);
  ok(r.code === 404, 'מוסתר — לא נשלח');

  /* 6. ניתוח ה־AI ששמור לפי המזהה הישן — לא מנותח שוב */
  AI.map.set('ins|LETTER000001|' + md5(epub('2023')), { summary: 'מהמטמון' });
  r = await call({ op: 'insight', id: 'id-urn:uuid:buffett-2023' }, READER);
  ok(r.j.ok && r.j.insight.summary === 'מהמטמון' && AI.calls === 0, 'הניתוח שנשמר לפני המעבר — נמצא (אין קריאה חדשה ל־AI)');

  /* 6א. אחרי המעבר — תיקיית Drive לא נדרשת (12/10/2026: LIBRARY_FOLDER_ID יכול לצאת מ־Vercel) */
  delete process.env.LIBRARY_FOLDER_ID; lib._reset();
  r = await call({ op: 'list' }, READER);
  ok(r.j.ok && r.j.items.length === 2, 'בלי LIBRARY_FOLDER_ID: הרשימה מהקטלוג');
  r = await call({ op: 'file', id: 'LETTER000001', via: 'r2' }, READER);
  ok(r.j.ok && r.j.url, 'בלי LIBRARY_FOLDER_ID: קישור לקובץ');
  r = await call({ op: 'insight', id: 'id-urn:uuid:buffett-2023' }, READER);
  ok(r.j.ok && r.j.insight.summary === 'מהמטמון', 'בלי LIBRARY_FOLDER_ID: ניתוח מכתב');
  r = await call({ op: 'health' }, READER);
  ok(r.j.ok && r.j.count === 2 && r.j.src === 'r2', 'בלי LIBRARY_FOLDER_ID: בדיקת התקינות — מהקטלוג, src=r2');
  r = await call({ op: 'readers' });
  ok(r.code !== 503, 'בלי LIBRARY_FOLDER_ID: ניהול הקוראים לא נחסם');
  process.env.LIBRARY_FOLDER_ID = FOLDER; lib._reset();

  /* 7. העלאת ספר חדש: קישור חתום → קובץ זמני → בדיקה → למקום הסופי */
  r = await call({ op: 'upPlan', items: [{ k: 'b', size: 5000 }, { k: 'b', size: 500 * 1024 * 1024 }, { k: 'c', size: 900 * 1024 }] });
  ok(r.j.ok && r.j.items[0].u && /\/lib\/v2\/in\/[a-f0-9]{32}\?/.test(r.j.items[0].url) && r.j.items[1].err === 'size' && r.j.items[2].err === 'size', 'תוכנית העלאה: קישור לקובץ זמני; גדול מדי — נדחה מראש');
  const up1 = r.j.items[0];
  const nb = epub('new-book');
  ok((await R.fetch(up1.url, { method: 'PUT', body: nb })).status === 200, 'הטלפון מעלה ישירות ל־R2');
  r = await call({ op: 'upCommit', rid: 'up-00001', items: [{ u: up1.u, k: 'b', ext: 'epub', book: { id: 'id-urn:isbn:9789650000001', title: 'ספר חדש', author: 'מחבר', tags: 'השקעות' }, batch: 'imp-0001' }] });
  ok(r.j.ok && r.j.done[0].id === 'id-urn:isbn:9789650000001' && !R.objs.has('lib/v2/in/' + up1.u) && R.objs.has('lib/v2/f/' + md5(nb) + '.epub'), 'אושר: הזמני נמחק, הקובץ לפי md5');
  const added = readCat().books['id-urn:isbn:9789650000001'];
  ok(added.st === 'draft' && added.batch === 'imp-0001' && added.files[0].size === nb.length, 'ספר חדש — טיוטה, עם מספר הייבוא');
  r = await call({ op: 'list' }, READER);
  ok(r.j.items.length === 2, 'טיוטה לא מגיעה לקוראים');
  await call({ op: 'catApply', ops: [{ op: 'state', ids: ['id-urn:isbn:9789650000001'], st: 'pub' }] });
  r = await call({ op: 'list' }, READER);
  const nIt = r.j.items.find((i) => i.md5 === md5(nb));
  ok(nIt && nIt.id === 'v2' + md5(nb) && /\.epub$/.test(nIt.name), 'אחרי פרסום — גם טלפון ישן רואה אותו (מזהה v2+md5)');
  r = await call({ op: 'file', id: nIt.id }, READER);
  ok(r.raw && Buffer.compare(r.raw, nb) === 0, 'וטלפון ישן מוריד אותו');

  /* 8. אותו קובץ שוב = כפול; קובץ שאינו ספר — נדחה והזמני נמחק */
  r = await call({ op: 'upPlan', items: [{ k: 'b', size: nb.length }, { k: 'b', size: 20 }] });
  const [u2, u3] = r.j.items;
  await R.fetch(u2.url, { method: 'PUT', body: nb });
  await R.fetch(u3.url, { method: 'PUT', body: Buffer.from('%PDF-1.7 not ours') });
  r = await call({ op: 'upCommit', items: [{ u: u2.u, k: 'b', ext: 'epub', book: { id: 'id-other', title: 'עוד' } }, { u: u3.u, k: 'b', ext: 'epub', book: { id: 'id-pdf', title: 'PDF' } }] });
  ok(r.j.dup[0].id === 'id-urn:isbn:9789650000001' && r.j.bad[0].why === 'type' && !R.objs.has('lib/v2/in/' + u2.u) && !R.objs.has('lib/v2/in/' + u3.u), 'אותו קובץ = "כבר בספרייה"; PDF נדחה; הזמניים נמחקים');

  /* 9. גרסה מתוקנת לספר קיים */
  r = await call({ op: 'upPlan', items: [{ k: 'b', size: 30 }] });
  const nb2 = epub('new-book-v2');
  await R.fetch(r.j.items[0].url, { method: 'PUT', body: nb2 });
  r = await call({ op: 'upCommit', items: [{ u: r.j.items[0].u, k: 'b', ext: 'epub', id: 'id-urn:isbn:9789650000001' }] });
  const nbk = readCat().books['id-urn:isbn:9789650000001'];
  ok(r.j.done.length === 1 && nbk.files[0].md5 === md5(nb2) && nbk.prev[0].md5 === md5(nb), 'קובץ חדש לספר קיים — הקודם נשמר לביטול');

  /* 10. כריכה */
  r = await call({ op: 'upPlan', items: [{ k: 'c', size: 40 }, { k: 'c', size: 40 }] });
  const [c1, c2] = r.j.items;
  const cv = jpeg('cover-2023');
  await R.fetch(c1.url, { method: 'PUT', body: cv });
  await R.fetch(c2.url, { method: 'PUT', body: Buffer.from('<svg>not jpeg</svg>') });
  r = await call({ op: 'upCommit', items: [{ u: c1.u, k: 'c', id: 'id-urn:uuid:buffett-2023', r: 0.66, src: 'file' }, { u: c2.u, k: 'c', id: 'id-urn:uuid:buffett-2023' }] });
  const cb = readCat().books['id-urn:uuid:buffett-2023'];
  ok(r.j.done.length === 1 && r.j.bad[0].why === 'type' && cb.cover.h === md5(cv) && cb.prov.cover === 'file' && R.objs.has('lib/v2/c/' + md5(cv) + '.jpg'), 'כריכה: רק JPEG, לפי md5, עם מקור');
  r = await call({ op: 'urls', kind: 'c', ids: ['id-urn:uuid:buffett-2023'] }, READER);
  ok(Buffer.compare(Buffer.from(await (await R.fetch(r.j.urls['id-urn:uuid:buffett-2023'])).arrayBuffer()), cv) === 0, 'קורא מוריד את הכריכה');

  /* 11. הרשאות וגבולות */
  r = await call({ op: 'upPlan', items: [{ k: 'b', size: 10 }] }, READER);
  ok(r.code === 403, 'העלאה — רק למנהל');
  r = await call({ op: 'upCommit', items: [{ u: '../../lib/v2/cat.json.gz', k: 'b' }] });
  ok(r.j.bad[0].why === 'u' && R.objs.has(C.KEYS.cat), 'מפתח מהטלפון — לא מתקבל');

  /* 12. חזרה ל־Drive (גלגול לאחור) */
  D.down = false; lib._reset(); gauth._reset();
  r = await call({ op: 'migrateFinish', back: true });
  ok(r.j.src === 'drive', 'אפשר לחזור ל־Drive');
  r = await call({ op: 'list' }, READER);
  ok(r.j.items.length === 5, 'ואז טלפונים ישנים שוב מ־Drive');

  console.log('\n' + n + ' passed');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
