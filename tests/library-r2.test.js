// 11/10/2026: ספריית המכתבים המשותפת ב־R2 — Drive נשאר המקום שבו מוסיפים מכתבים; הקוראים מקבלים מ־R2
// (קישור חתום, פעם אחת לכל גרסה), הקטלוג נשמר ב־R2 ומשמש כש־Drive נופל, וגרסה שהוחלפה נמחקת.
// הרצה: node tests/library-r2.test.js
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ENV } = require('./_r2fake');

(async () => {
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, ENV, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com', LIBRARY_FOLDER_ID: 'FOLDER0000001',
  });
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const lib = require(path.join(root, 'ibkr-proxy/api/library.js'));
  gauth._reset(); lib._reset(); R2._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub: 'ownerUid0001', iat: tnow - 5, exp: tnow + 3000, email: 'owner@example.com', email_verified: true });
  const TOK = hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');

  /* Drive (חשבון השירות) ו־R2 מדומים */
  const R = fakeR2();
  const md5 = (b) => crypto.createHash('md5').update(b).digest('hex');
  const D = { down: false, files: new Map(), mediaCalls: 0 };
  const put = (id, name, buf) => D.files.set(id, { id, name, buf, parents: ['FOLDER0000001'] });
  put('LETTER000001', 'מכתב 2023.epub', Buffer.from('PK-epub-2023'));
  put('LETTER000002', 'מכתב 2022.epub', Buffer.from('PK-epub-2022'));
  const J = (o, st = 200) => ({ status: st, ok: st < 300, json: async () => o, text: async () => JSON.stringify(o), arrayBuffer: async () => Buffer.from(JSON.stringify(o)), headers: { get: () => 'application/json' } });
  const fetchAll = async (url, opt = {}) => {
    if (url.includes('.r2.cloudflarestorage.com')) return R.fetch(url, opt);
    if (url.includes('oauth2.googleapis.com/token')) return D.down ? J({}, 400) : J({ access_token: 'SA', expires_in: 3600 });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files')) {
      if (D.down) return J({}, 503);
      const u = new URL(url);
      if (u.searchParams.get('q')) return J({ files: [...D.files.values()].map((f) => ({ id: f.id, name: f.name, size: String(f.buf.length), md5Checksum: md5(f.buf), modifiedTime: '2026-10-01T00:00:00Z', mimeType: 'application/epub+zip' })) });
      const id = u.pathname.split('/').pop(), f = D.files.get(id);
      if (!f) return J({}, 404);
      if (u.searchParams.get('alt') === 'media') { D.mediaCalls++; return { status: 200, ok: true, arrayBuffer: async () => f.buf, headers: { get: () => 'application/epub+zip' } }; }
      return J({ parents: f.parents, size: String(f.buf.length), name: f.name });
    }
    return J({}, 404);
  };
  const call = async (body) => {
    const res = { code: 0, j: null, raw: null, hd: {}, setHeader(k, v) { res.hd[k] = v; }, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, send(b) { res.raw = b; return res; }, end() { return res; } };
    await lib._handler({ method: 'POST', body: Object.assign({ idToken: TOK }, body), headers: { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '9.9.9.9' } }, res, { verify: { keys }, fetch: fetchAll });
    return res;
  };

  /* 1. הקטלוג — מ־Drive, ונשמר ב־R2 */
  let r = await call({ op: 'list' });
  ok(r.j.ok && r.j.items.length === 2 && !r.j.from, 'הקטלוג מ־Drive (המקום שבו מוסיפים מכתבים)');
  const cat = JSON.parse(R.objs.get('lib/catalog.json').toString());
  ok(cat.items.length === 2 && cat.items.every((i) => /^[a-f0-9]{32}$/.test(i.md5)), 'הקטלוג נשמר גם ב־R2');

  /* 2. הורדה בטלפון חדש: פעם ראשונה מ־Drive ונשמר ב־R2, ואז רק קישור */
  const it = r.j.items.find((x) => x.id === 'LETTER000001');
  r = await call({ op: 'file', id: it.id, via: 'r2' });
  const key = 'lib/LETTER000001.' + it.md5 + '.epub';
  ok(r.j && r.j.ok && /\/lib\/LETTER000001\.[a-f0-9]{32}\.epub\?/.test(r.j.url) && R.objs.has(key) && D.mediaCalls === 1, 'פעם ראשונה: מ־Drive → נשמר ב־R2 → קישור חתום');
  ok(Buffer.compare(Buffer.from(await (await R.fetch(r.j.url)).arrayBuffer()), Buffer.from('PK-epub-2023')) === 0, 'הקישור מוריד את המכתב');
  r = await call({ op: 'file', id: it.id, via: 'r2' });
  ok(r.j.ok && r.j.url && D.mediaCalls === 1, 'פעם שנייה: קישור ישר מ־R2 — בלי להוריד מ־Drive');
  r = await call({ op: 'file', id: it.id });
  ok(r.raw && Buffer.compare(r.raw, Buffer.from('PK-epub-2023')) === 0 && D.mediaCalls === 1, 'טלפון ישן (בלי via) — מקבל את הקובץ עצמו, מ־R2');

  /* 3. מכתב שהוחלף (אותו מזהה, תוכן חדש) — גרסה חדשה, הישנה נמחקת */
  put('LETTER000001', 'מכתב 2023.epub', Buffer.from('PK-epub-2023-v2'));
  lib._reset();
  r = await call({ op: 'list' });
  const it2 = r.j.items.find((x) => x.id === 'LETTER000001');
  ok(it2.md5 !== it.md5 && !R.objs.has(key), 'גרסה שהוחלפה ב־Drive — הישנה נמחקת מ־R2');
  r = await call({ op: 'file', id: it2.id, via: 'r2' });
  ok(R.objs.has('lib/LETTER000001.' + it2.md5 + '.epub'), 'הגרסה החדשה נשמרת בשם משלה (לפי md5)');

  /* 4. Drive נופל — הספרייה ממשיכה מ־R2 */
  D.down = true; lib._reset(); gauth._reset();
  r = await call({ op: 'list' });
  ok(r.j.ok && r.j.from === 'r2' && r.j.items.length === 2, 'Drive לא זמין — הקטלוג האחרון מ־R2');
  r = await call({ op: 'file', id: it2.id, via: 'r2' });
  ok(r.j.ok && r.j.url, 'ומכתב שכבר ב־R2 עדיין יורד');
  r = await call({ op: 'file', id: 'LETTER000002', via: 'r2' });
  ok(r.code === 404, 'מכתב שעוד לא נשמר ב־R2 — לא נמצא (לא תקלה כללית)');

  /* 5. בלי R2 — בדיוק כמו קודם */
  D.down = false; lib._reset(); gauth._reset();
  for (const k of Object.keys(ENV)) delete process.env[k];
  r = await call({ op: 'file', id: 'LETTER000002', via: 'r2' });
  ok(r.raw && Buffer.compare(r.raw, Buffer.from('PK-epub-2022')) === 0, 'בלי R2 בשרתון — הקובץ עצמו (גם כשהטלפון מבקש via:r2)');

  /* 6. הטלפון */
  const lj = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
  ok(/op: 'file', idToken: tk, id: it\.id, via: 'r2'/.test(lj) && /\\\.r2\\\.cloudflarestorage\\\.com/.test(lj), 'library.js: מבקש קישור, ומוריד רק מכתובת של R2');

  console.log('\n' + n + ' passed');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
