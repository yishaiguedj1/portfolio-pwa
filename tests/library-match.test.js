// מנהל הספרייה, ס׳6 (11/10/2026; מחקר 05): מנוע ההתאמה — דמיון כותרים ומחברים (גם עברית ↔ אנגלית), ציון ביטחון ודליים,
// מיזוג שדות (שדות מהדורה רק מאותה מהדורה), תיקוני bookmeta (עמודים, Open Library, Apple, ISBN‑10, תמונה ממלאת מקום),
// ו־op:'match' (רק למנהל). הרצה: node tests/library-match.test.js
const path = require('path');
const crypto = require('crypto');
const assert = require('assert');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const root = path.join(__dirname, '..');
const M = require(path.join(root, 'ibkr-proxy/lib/bookmatch.js'));
const BMeta = require(path.join(root, 'ibkr-proxy/lib/bookmeta.js'));

(async () => {
  /* 1. כותרים — הזוגות מאב־הטיפוס במחקר */
  const pos = [['קיצור תולדות האנושות', 'קצור תולדות האנושות'], ['הארי פוטר ואבן החכמים', 'הארי פוטר 1 - הארי פוטר ואבן החכמים'], ['נקסוס', 'נקסוס: היסטוריה קצרה של רשתות מידע'], ['The Intelligent Investor, Rev. Ed', 'The intelligent investor'], ['המשקיע הנבון', 'הַמַּשְׁקִיעַ הַנָּבוֹן']];
  const neg = [['הארי פוטר וחדר הסודות', 'הארי פוטר וגביע האש'], ['קיצור תולדות האנושות', 'קיצור תולדות הילדות'], ['המשקיע הנבון', 'האינטליגנציה הרגשית של המשקיע הנבון']];
  ok(pos.every(([a, b]) => M.titleSim(a, b) >= 0.9), 'כותרים זהים: כתיב חסר/מלא, מספר בסדרה, כותר משנה, Rev. Ed, ניקוד');
  ok(neg.every(([a, b]) => M.titleSim(a, b) < 0.7), 'כותרים שונים: ספר אחר בסדרה, מילה אחת שונה, הכלה באמצע (לא קידומת)');

  /* 2. מחברים בין כתבים */
  ok([['וורן באפט', 'Warren Buffett'], ['בפט, וורן', 'Buffett, Warren E.'], ['גרהם בנגמין', "גראהם, בנג'מין"], ["ג'ייסון צוויג", 'Jason Zweig']].every(([a, b]) => M.nameSim(a, b) >= 0.85), 'מחבר: עברית ↔ אנגלית, "משפחה, פרטי", כתיב שונה');
  ok([['מרי באפט', 'Warren Buffett'], ['Peter Lynch', 'Peter Lynn'], ['Benjamin Graham', 'Benjamin Grant'], ['וורן באפט', 'Sam Harris']].every(([a, b]) => M.nameSim(a, b) < 0.5), 'מחבר: שם פרטי סותר / משפחה קרובה אחרת — נמוך');

  /* 3. ISBN */
  ok(M.isbn13('9654487659') === '9789654487658' && M.isbn13('0-306-40615-2') === '9780306406157' && M.isbn13('9780306406158') === '', 'ISBN: ‏10 → 13, ספרת ביקורת שגויה = ריק');

  /* 4. ציון ביטחון ודליים */
  const rec = (o) => Object.assign({ src: 'nli', title: '', subtitle: '', authors: [], authorSort: '', publisher: '', date: '', year: 0, lang: 'he', isbn: '', desc: '', tags: [], series: '', seriesIndex: '', cover: '' }, o);
  const q = M.queryOf({ title: 'המשקיע הנבון', author: 'בנג׳מין גרהם', lang: 'he', isbn: '9780306406157' });
  ok(q.isbns[0] === '9780306406157' && q.lang === 'he' && q.authors[0] === 'בנג׳מין גרהם', 'שאילתה מספר בקטלוג');
  const sIsbn = M.score(q, rec({ title: 'המשקיע הנבון', isbn: '978-0-306-40615-7', year: 2010, authors: ["בנג'מין גראהם"] }));
  ok(sIsbn.conf >= 0.95 && sIsbn.why[0] === 'isbn' && M.bucketOf(sIsbn.conf) === 'auto', 'ISBN זהה + כותר = אוטומטי');
  const sClash = M.score(q, rec({ title: 'ספר אחר לגמרי', isbn: '9780306406157' }));
  ok(sClash.conf <= 0.5, 'ISBN זהה אבל כותר אחר = התנגשות (לבדיקה, לא אוטומטי)');
  const q2 = M.queryOf({ title: 'המשקיע הנבון', author: 'בנג׳מין גרהם', lang: 'he' });
  const sNo = M.score(q2, rec({ title: 'המשקיע הנבון', authors: ["גראהם, בנג'מין"], year: 2010, isbn: '9789655451230' }));
  ok(sNo.conf >= 0.85, 'בלי ISBN בשאילתה: כותר + מחבר + שפה = גבוה (' + sNo.conf + ')');
  const sEn = M.score(q2, rec({ src: 'google', title: 'The Intelligent Investor', authors: ['Benjamin Graham'], lang: 'en' }));
  ok(sEn.conf < 0.5, 'מהדורה בשפה אחרת עם כותר מתורגם — נמוך (' + sEn.conf + ')');
  const sAuth = M.score(q2, rec({ title: 'המשקיע הנבון', authors: ['מרי באפט'] }));
  ok(sAuth.conf < sNo.conf * 0.75, 'מחבר אחר — עונש');

  /* 5. מיזוג שדות: הטוב ביותר + השלמות מאותה יצירה; הוצאה/ISBN/תאריך רק מאותה מהדורה */
  const cands = [
    rec({ title: 'המשקיע הנבון', subtitle: 'מדריך מעשי', authors: ["בנג'מין גראהם"], publisher: 'סיאל', year: 2010, isbn: '9780306406157', tags: ['השקעות'] }),
    rec({ src: 'google', title: 'המשקיע הנבון', authors: ['Benjamin Graham'], isbn: '9780306406157', desc: 'תקציר מגוגל', cover: 'https://books.google.com/x' }),
    rec({ src: 'openlibrary', title: 'המשקיע הנבון', authors: ['בנג׳מין גרהם'], isbn: '9789654487658', publisher: 'הוצאה אחרת', cover: 'https://covers.openlibrary.org/b/id/1-L.jpg' }),
    rec({ title: 'משהו אחר', authors: ['מישהו'] }),
  ];
  const m = M.matchBook(q, cands);
  ok(m.bucket === 'auto' && m.src === 'nli' && m.f.title === 'המשקיע הנבון' && m.f.pub === 'סיאל' && m.prov.pub === 'nli', 'הטוב ביותר: הספרייה הלאומית (עברית)');
  ok(m.f.desc === 'תקציר מגוגל' && m.prov.desc === 'google', 'תקציר מהמהדורה המקבילה (אותו ISBN)');
  ok(m.f.pub !== 'הוצאה אחרת' && m.covers.length === 2 && m.covers[0].src === 'google', 'הוצאה ממהדורה אחרת — לא; כריכות מאותה יצירה, לפי סדר העדיפות');
  ok(m.alts.length === 3 && m.alts.every((a) => typeof a.conf === 'number'), 'חלופות לבחירה ידנית');
  ok(M.matchBook(q2, []).bucket === 'none', 'בלי מועמדים — "לא נמצא"');

  /* 6. תיקוני bookmeta */
  ok(BMeta.nliPages('7 עמודים לא ממוספרים, 400 עמודים, 1 דף') === 400 && BMeta.nliPages('623 עמודים ;') === 623, 'NLI: עמודים — הגדול, בלי "לא ממוספרים"');
  const ol = BMeta.parseOpenLibrary({ docs: [{ key: '/works/OL273184W', title: 'The intelligent investor', language: ['heb', 'por', 'eng'], isbn: ['9789584248930'], publisher: ['Zar'],
    editions: { docs: [{ language: ['eng'], isbn: ['9780060555665'], publisher: ['Harper'] }] } }] })[0];
  ok(ol.lang === 'en' && ol.isbn === '9780060555665' && ol.publisher === 'Harper', 'Open Library: שפה, ISBN והוצאה מהמהדורה (לא מכל המהדורות)');
  ok(BMeta.parseOpenLibrary({ docs: [{ key: 'x', title: 't', language: ['heb', 'eng'] }] })[0].lang === '', 'Open Library בלי מהדורה וכמה שפות — בלי שפה (לא מנחשים)');
  ok(BMeta.parseGoogle({ items: [{ volumeInfo: { title: 't', language: 'iw' } }] })[0].lang === 'he', 'Google: "iw" = עברית');
  ok(!/country=il/.test(BMeta.appleUrl({ title: 'x', lang: 'he' })), 'Apple: בלי country=il (לא פועל בישראל)');
  const png = Buffer.alloc(1269); Buffer.from([0x89, 0x50, 0x4e, 0x47]).copy(png); png.writeUInt32BE(128, 16); png.writeUInt32BE(170, 20);
  ok(BMeta.isPlaceholder(png, 'image/png') && !BMeta.isPlaceholder(Buffer.alloc(5000), 'image/jpeg'), 'תמונה ממלאת מקום של Google — מזוהה');
  const nliOld = BMeta.mergeByIsbn([Object.assign({}, cands[0], { isbn: '9654487659', cover: '' }), Object.assign({}, cands[1], { isbn: '9789654487658' })]);
  ok(nliOld[0].cover === 'https://books.google.com/x', 'מיזוג: ISBN‑10 של NLI עם ISBN‑13 של Google — אותו ספר');

  /* 7. op:'match' — רק למנהל */
  const fb = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  process.env.LIBRARY_READERS = 'owner@example.com,reader@example.com';
  const gauth = require(path.join(root, 'ibkr-proxy/lib/gauth.js')); gauth._reset();
  const api = require(path.join(root, 'ibkr-proxy/api/bookmeta.js')); api._reset();
  const keys = { k1: fb.publicKey.export({ type: 'spki', format: 'pem' }) };
  const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const t0 = Math.floor(Date.now() / 1000);
  const tok = (email) => { const hd = b64u({ alg: 'RS256', kid: 'k1' }), bd = b64u({ aud: 'yishaiguedj1-c786e', iss: 'https://securetoken.google.com/yishaiguedj1-c786e', sub: 'u' + email.length + 'xxxxxxxx', iat: t0 - 5, exp: t0 + 3000, email, email_verified: true }); return hd + '.' + bd + '.' + crypto.sign('RSA-SHA256', Buffer.from(hd + '.' + bd), fb.privateKey).toString('base64url'); };
  const NLI = '<record xmlns="http://www.loc.gov/MARC21/slim"><controlfield tag="001">99</controlfield><controlfield tag="008">191104s2010    is            000 0 heb d</controlfield><datafield tag="020"><subfield code="a">978-0-306-40615-7</subfield></datafield><datafield tag="100"><subfield code="a">גראהם, בנג\'מין</subfield></datafield><datafield tag="245"><subfield code="a">המשקיע הנבון :</subfield></datafield><datafield tag="264"><subfield code="b">סיאל,</subfield><subfield code="c">2010.</subfield></datafield></record>';
  const asked = [];
  const fake = async (u) => { asked.push(String(u)); if (/alma/.test(u)) return { status: 200, text: async () => NLI }; return { status: 200, json: async () => ({}) }; };
  const call = async (body) => {
    const res = { statusCode: 0, payload: null, headers: {}, setHeader(k, v) { res.headers[k] = v; }, status(c) { res.statusCode = c; return res; }, json(o) { res.payload = o; return res; }, send(b) { res.payload = b; return res; }, end() { return res; } };
    await api({ method: 'POST', body, headers: { origin: 'https://yishaiguedj1.github.io', 'x-forwarded-for': '7.7.7.' + (n % 200) } }, res, { fetch: fake, verify: { keys } });
    return res;
  };
  let r = await call({ op: 'match', books: [{ key: 'id-a', title: 'המשקיע הנבון' }] });
  ok(r.statusCode === 401, 'בלי התחברות — 401');
  r = await call({ op: 'match', idToken: tok('reader@example.com'), books: [{ key: 'id-a', title: 'המשקיע הנבון' }] });
  ok(r.statusCode === 403, 'קורא — 403 (רק המנהל מתאים בכמות)');
  r = await call({ op: 'match', idToken: tok('owner@example.com'), books: [{ key: 'id-a', title: 'המשקיע הנבון', author: 'בנגמין גרהם', lang: 'he' }, { key: 'id-b', title: 'xyzzy plugh' }, {}, {}, {}, { key: 'id-6', title: 'שישי' }] });
  const ra = r.payload.results;
  ok(r.statusCode === 200 && ra.length === 5 && ra[0].key === 'id-a' && ra[0].f.pub === 'סיאל' && ra[0].conf >= 0.85, 'מנהל: עד 5 ספרים; ספר עברי נמצא בספרייה הלאומית עם ציון');
  ok(ra[1].bucket === 'none' && ra[2].why[0] === 'no_query', 'לא נמצא / בלי שאילתה — מסומן, לא שגיאה');
  ok(!asked.some((u) => /itunes/.test(u) && /%D7/.test(u)), 'ספר עברי — לא נשלח ל־Apple');
  api._reset();
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL', e && e.message); process.exit(1); });
