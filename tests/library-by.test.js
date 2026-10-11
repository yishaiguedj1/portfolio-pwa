// מנהל הספרייה, ס׳8 (11/10/2026): פרויקט בן־יהודה — 26 אלף יצירות ברשות הרבים בעברית.
// הקטלוג (CSV) נמשך פעם ביום לזיכרון של השרתון; חיפוש לפי יוצר/כותר עם סינון סוגה; הורדה ישר לקובץ זמני ב־R2
// (הפניות ידניות — כל יעד נבדק, בלי SSRF), ומשם אותו upCommit של העלאה מהטלפון. הכל מדומה — בלי פנייה לבן־יהודה.
// הרצה: node tests/library-by.test.js
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const zlib = require('zlib');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ENV } = require('./_r2fake');

(async () => {
  const BY = require(path.join(root, 'ibkr-proxy/lib/benyehuda.js'));

  /* 1. CSV + קטלוג */
  const csv = 'ID,path,title,authors,translators,original_language,genre,source_edition\n' +
    '10,/p10,"שירים, ""ראשונים""",חיים נחמן ביאליק,,he,poetry.poetry,\n' +
    '11,/p11,אגרות ביאליק,חיים נחמן ביאליק,,he,letters.letters,\n' +
    '12,/p12,"על ביאליק\nמאמר",יוסף חיים ברנר,,he,article.article,\n' +
    '13,/p13,המלט,ויליאם שייקספיר,שאול טשרניחובסקי,en,drama.drama,\n' +
    'x,/bad,שורה פגומה,מישהו,,he,prose.prose,\n' +
    '14,/p14,,בלי כותר,,he,prose.prose,\n';
  const rows = BY.parseCsv(csv);
  ok(rows[1][2] === 'שירים, "ראשונים"' && rows[3][2] === 'על ביאליק\nמאמר', 'CSV: פסיק ומרכאות כפולות בתוך שדה, ושורה חדשה בתוך שדה');
  const cat = BY.parseCatalog(csv);
  ok(cat.length === 4 && cat.every((x) => x.id > 0 && x.t), 'קטלוג: רק שורות עם מזהה וכותר');
  ok(cat.find((x) => x.id === 11).g === 'מכתבים' && cat.find((x) => x.id === 13).g === 'מחזות', 'סוגה בעברית מה־genre');

  /* 2. חיפוש */
  let s = BY.search(cat, 'ביאליק');
  ok(s.total === 3 && s.items[2].id === 12, 'חיפוש יוצר: היצירות שלו קודם, ואז יצירות שמזכירות אותו');
  ok(BY.search(cat, 'חיים נחמן ביאליק').items.every((x) => x.a === 'חיים נחמן ביאליק'), 'שם מלא = כל היצירות של היוצר');
  ok(BY.search(cat, 'ביאליק', 60, 'מכתבים').total === 1, 'סינון לפי סוגה');
  ok(BY.search(cat, 'טשרניחובסקי').items[0].tr === 'שאול טשרניחובסקי', 'חיפוש גם לפי מתרגם');
  ok(BY.search(cat, 'בִּיאָלִיק').total === 3 && BY.search(cat, 'א').total === 0, 'ניקוד לא מפריע; מילה של אות אחת — בלי תוצאות');
  ok(BY.search(cat, 'ביאליק', 1).items.length === 1 && BY.search(cat, 'ביאליק', 1).total === 3, 'תקרה על הרשימה, והמספר האמיתי נשמר');

  /* 3. הפניות מותרות */
  ok(BY.dlAllowed('https://benyehuda.org/download/10.epub') && BY.dlAllowed('https://bybeprod.s3.amazonaws.com/x?sig=1'), 'מותר: בן־יהודה ו־S3');
  ok(!BY.dlAllowed('http://benyehuda.org/x') && !BY.dlAllowed('https://evil.example/x') && !BY.dlAllowed('https://169.254.169.254/') && !BY.dlAllowed('https://s3.amazonaws.com.evil.example/'), 'אסור: http, מארח זר, כתובת פנימית, סיומת מזויפת');

  /* 4. השרתון: byFind / byAdd */
  const sa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  Object.assign(process.env, ENV, {
    GDRIVE_SA_KEY: JSON.stringify({ client_email: 'sa@p.iam.gserviceaccount.com', private_key: sa.privateKey.export({ type: 'pkcs8', format: 'pem' }) }),
    LIBRARY_READERS: 'owner@example.com,reader@example.com',
  });
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js'));
  const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
  const C = require(path.join(root, 'ibkr-proxy/lib/libcat.js'));
  const LM = require(path.join(root, 'ibkr-proxy/lib/libmgr.js'));
  const lib = require(path.join(root, 'ibkr-proxy/api/library.js'));
  gauth._reset(); lib._reset(); R2._reset(); LM._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const tnow = Math.floor(Date.now() / 1000);
  const tok = (email, sub) => {
    const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub, iat: tnow - 5, exp: tnow + 3000, email, email_verified: true });
    return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url');
  };
  const OWNER = tok('owner@example.com', 'ownerUid0001'), READER = tok('reader@example.com', 'readerUid001');
  const epub = fs.readFileSync(path.join(__dirname, 'fixtures/books/he-plain.epub'));
  const R = fakeR2();
  const W = { cat: 0, dl: [], evil: false };
  const res0 = (st, body, hd = {}) => ({ status: st, ok: st < 300, text: async () => String(body), json: async () => JSON.parse(body), arrayBuffer: async () => (Buffer.isBuffer(body) ? body : Buffer.from(String(body))), headers: { get: (k) => hd[k.toLowerCase()] || null } });
  const fetchAll = async (url, opt = {}) => {
    if (url.includes('.r2.cloudflarestorage.com')) return R.fetch(url, opt);
    if (url === BY.CAT_URL) { W.cat++; return res0(200, csv); }
    W.dl.push(url);
    if (opt.redirect !== 'manual' && /benyehuda|amazonaws|evil/.test(url)) return res0(500, 'follow');
    const m = /benyehuda\.org\/download\/(\d+)\.epub$/.exec(url);
    if (m) {
      if (m[1] === '99') return res0(302, '', { location: 'https://evil.example/steal' });
      if (m[1] === '98') return res0(404, '');
      return res0(302, '', { location: '/rails/active_storage/blobs/' + m[1] });
    }
    const a = /benyehuda\.org\/rails\/active_storage\/blobs\/(\d+)$/.exec(url);
    if (a) return res0(302, '', { location: 'https://bybeprod.s3.amazonaws.com/f' + a[1] + '?X-Amz-Signature=1' });
    if (/^https:\/\/bybeprod\.s3\.amazonaws\.com\/f\d+/.test(url)) return res0(200, epub, { 'content-length': String(epub.length) });
    return res0(404, '');
  };
  let ip = 0;
  const call = async (body, idToken = OWNER) => {
    const res = { code: 0, j: null, hd: {}, setHeader(k, v) { res.hd[k] = v; }, status(c) { res.code = c; return res; }, json(o) { res.j = o; return res; }, send() { return res; }, end() { return res; } };
    await lib._handler({ method: 'POST', body: Object.assign({ idToken }, body), headers: { origin: 'https://yishaiguedj1.github.io' }, socket: { remoteAddress: '9.9.' + (ip++ % 250) + '.1' } }, res, { verify: { keys }, fetch: fetchAll });
    return res;
  };

  let r = await call({ op: 'byFind', q: 'ביאליק' }, READER);
  ok(r.code === 403, 'קורא רגיל — אין גישה לבן־יהודה (רק מנהל)');
  r = await call({ op: 'byFind', q: 'ביאליק' });
  ok(r.code === 200 && r.j.total === 3 && r.j.items[0].a === 'חיים נחמן ביאליק', 'מנהל: חיפוש בקטלוג');
  await call({ op: 'byFind', q: 'ברנר', g: 'מאמרים' });
  r = await call({ op: 'byFind', q: 'ביאליק', g: 'לא סוגה' });
  ok(W.cat === 1 && r.j.total === 3, 'הקטלוג נמשך פעם אחת (בזיכרון), וסוגה לא מוכרת = בלי סינון');

  r = await call({ op: 'byAdd', ids: [10, 11, 98, 99, 'x', 12, 13, 14] });
  ok(r.code === 200 && r.j.items.length === 5, 'עד 5 יצירות בבקשה, רק מזהים מספריים');
  const by = Object.fromEntries(r.j.items.map((x) => [x.id, x]));
  ok(by[10].u && /\.r2\.cloudflarestorage\.com\//.test(by[10].url) && by[10].size === epub.length, 'יצירה → קובץ זמני ב־R2 + קישור קריאה חתום');
  ok(by[98].err === 'not_found' && by[99].err === 'by_redirect', '404 = לא נמצאה; הפניה למארח זר — נחסמת לפני הבקשה');
  ok(!W.dl.some((u) => u.includes('evil')), 'אף בקשה לא יצאה למארח הזר');
  ok(R.objs.has(C.KEYS.tmp(by[10].u)) && Buffer.compare(R.objs.get(C.KEYS.tmp(by[10].u)), epub) === 0, 'הקובץ ב־R2 זהה לבייט');
  r = await call({ op: 'byAdd', ids: [] });
  ok(r.code === 400, 'בלי מזהים — 400');

  /* 5. משם — אותו upCommit של העלאה מהטלפון */
  r = await call({ op: 'upCommit', rid: 'by-000001', items: [{ u: by[10].u, k: 'b', ext: 'epub', book: { id: 'by-10', title: 'שירים', author: 'חיים נחמן ביאליק' } }] });
  ok(r.code === 200 && r.j.done.length === 1 && !R.objs.has(C.KEYS.tmp(by[10].u)), 'upCommit: הספר נכנס לקטלוג, הקובץ הזמני נמחק');
  r = await call({ op: 'upCommit', items: [{ u: by[11].u, k: 'b', ext: 'epub', book: { id: 'by-11', title: 'אגרות' } }] });
  ok(r.j.dup.length === 1, 'אותו קובץ פעמיים — כפילות, לא ספר שני');
  const cj = JSON.parse(zlib.gunzipSync(R.objs.get(C.KEYS.cat)).toString('utf8'));
  ok(cj.books['by-10'] && !cj.books['by-11'], 'בקטלוג: ספר אחד');

  /* 6. הטלפון */
  const adm = fs.readFileSync(path.join(root, 'libadmin.js'), 'utf8');
  ok(/api\('byFind'/.test(adm) && /api\('byAdd'/.test(adm) && /chunk\(ids, 5\)/.test(adm), 'libadmin: חיפוש והוספה במנות של 5');
  ok(/r2\\\.cloudflarestorage\\\.com/.test(adm), 'הטלפון מוריד רק מקישור של R2');
  ok(/const pre = it\.pre && !it\.fixed/.test(adm), 'קובץ שכבר ב־R2 לא מועלה שוב — אלא אם תוקן בטלפון');
  ok(/webkitdirectory/.test(adm) && /EK\.readZip/.test(adm), 'הוספה מתיקייה שלמה ומ־ZIP');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL', e && e.stack); process.exit(1); });
