// v318: שתי ספריות (THE SNOWBALL / הספרייה שלי) + גיבוי הספרייה הפרטית ל־Google Drive של המשתמש — מנוע הגיבוי מול Drive מדומה
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const bkSrc = fs.readFileSync(path.join(root, 'libbackup.js'), 'utf8');

/* ---------- Drive מדומה (בזיכרון) ---------- */
function fakeDrive() {
  const files = new Map(); let seq = 0; const log = [];
  const mk = (o) => { const id = 'F' + (++seq); files.set(id, Object.assign({ id, parents: [], appProperties: {}, trashed: false, data: '' }, o)); return files.get(id); };
  const resp = (status, body, headers) => ({
    status, ok: status >= 200 && status < 300,
    headers: { get: (k) => (headers || {})[k] || null },
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body || {})),
    json: async () => (typeof body === 'string' ? JSON.parse(body) : body),
    blob: async () => new Blob([body && body.data != null ? body.data : body]),
  });
  const pub = (f) => ({ id: f.id, name: f.name, size: String(Buffer.byteLength(f.data || '')), md5Checksum: 'm' + f.id + '-' + (f.v || 0), appProperties: f.appProperties, parents: f.parents, trashed: f.trashed });
  function matchQ(f, q) {
    if (/trashed=false/.test(q) && f.trashed) return false;
    const ap = q.match(/appProperties has \{ key='(\w+)' and value='1' \}/); if (ap && f.appProperties[ap[1]] !== '1') return false;
    if (/mimeType='application\/vnd.google-apps.folder'/.test(q) && f.mimeType !== 'application/vnd.google-apps.folder') return false;
    const ps = [...q.matchAll(/'(\w+)' in parents/g)].map((m) => m[1]);
    if (ps.length && !ps.some((p) => f.parents.includes(p))) return false;
    return true;
  }
  async function parseMultipart(body) {
    const t = await body.text();
    const parts = t.split(/--snb\w+/).filter((x) => x.includes('Content-Type'));
    const meta = JSON.parse(parts[0].split('\r\n\r\n')[1]);
    const data = parts[1].slice(parts[1].indexOf('\r\n\r\n') + 4).replace(/\r\n$/, '');
    return { meta, data };
  }
  async function fetch(url, opt = {}) {
    const m = opt.method || 'GET';
    log.push(m + ' ' + url.replace(/\?.*/, ''));
    const u = new URL(url);
    if (u.pathname === '/drive/v3/about') return resp(200, { storageQuota: { limit: '16106127360', usage: '3435973836' }, user: { emailAddress: 'me@example.com' } });
    let mm = u.pathname.match(/^\/(upload\/)?drive\/v3\/files(?:\/(\w+))?$/);
    if (!mm) return resp(404, {});
    const [, up, id] = mm;
    if (up) {
      if (u.searchParams.get('uploadType') === 'resumable') {
        const meta = JSON.parse(opt.body || '{}');
        return resp(200, '', { Location: 'https://upload.example/session?' + encodeURIComponent(JSON.stringify({ id: id || '', meta })) });
      }
      const { meta, data } = await parseMultipart(opt.body);
      let f = id ? files.get(id) : mk({ name: meta.name, parents: meta.parents || [], appProperties: meta.appProperties || {} });
      if (!f) return resp(404, {});
      if (meta.name) f.name = meta.name;
      f.data = data; f.v = (f.v || 0) + 1;
      return resp(200, pub(f));
    }
    if (!id && m === 'GET') return resp(200, { files: [...files.values()].filter((f) => matchQ(f, u.searchParams.get('q') || '')).map(pub) });
    if (!id && m === 'POST') { const meta = JSON.parse(opt.body); return resp(200, pub(mk({ name: meta.name, mimeType: meta.mimeType, parents: meta.parents || [], appProperties: meta.appProperties || {} }))); }
    const f = files.get(id);
    if (!f) return resp(404, {});
    if (m === 'GET' && u.searchParams.get('alt') === 'media') return resp(200, { data: f.data });
    if (m === 'GET') return resp(200, pub(f));
    if (m === 'PATCH') { const b = JSON.parse(opt.body || '{}'); Object.assign(f, b); if (b.trashed) for (const c of files.values()) if (c.parents.includes(f.id)) c.trashed = true; return resp(200, pub(f)); }
    return resp(400, {});
  }
  // סשן resumable
  const outer = async (url, opt) => {
    if (url.startsWith('https://upload.example/session?')) {
      const { id, meta } = JSON.parse(decodeURIComponent(url.split('?')[1]));
      const data = await opt.body.text();
      let f = id ? files.get(id) : mk({ name: meta.name, parents: meta.parents || [], appProperties: meta.appProperties || {} });
      f.data = data; f.v = (f.v || 0) + 1; if (meta.name) f.name = meta.name;
      return resp(200, pub(f));
    }
    return fetch(url, opt);
  };
  return { fetch: outer, files, log };
}

(async () => {
  const B = await import(path.join(root, 'libbackup.js'));
  /* ---------- טהורות ---------- */
  ok(B.safeName('מכתב "באפט": 1987', 'וורן/באפט', '.epub') === 'מכתב באפט 1987 — וורן באפט.epub', 'שם קובץ בדרייב: קריא ונקי מתווים אסורים');
  ok(B.extOf('x.AZW3') === '.azw3' && B.extOf('x') === '.epub', 'סיומת הקובץ נשמרת');
  ok(B.isPrivate({ src: 'drive', owner: 'u' }, 'u') === false && B.isPrivate({ owner: 'u' }, 'u') && !B.isPrivate({ owner: 'v' }, 'u'), 'פרטי = לא מכתב Drive, ושל החשבון הנוכחי בלבד');
  const now = 10 * 864e5;
  ok(!B.backupDue({ email: '' }, [{ bkD: 1 }], now) && !B.backupDue({ email: 'a', auto: false }, [{ bkD: 1 }], now), 'אוטומטי: לא כשלא מחובר / כבוי');
  ok(B.backupDue({ email: 'a', freq: 'change', lastAt: now - 1000 }, [{ bkD: 1, bk: {} }], now) && !B.backupDue({ email: 'a', freq: 'change', lastAt: now - 1000 }, [{ bk: {} }], now), 'אוטומטי "בכל שינוי": רק כשיש שינוי (או עבר יום)');
  ok(!B.backupDue({ email: 'a', freq: 'weekly', lastAt: now - 3 * 864e5 }, [{ bkD: 1 }], now) && B.backupDue({ email: 'a', freq: 'weekly', lastAt: now - 8 * 864e5 }, [], now), 'אוטומטי שבועי: לפי הזמן');
  const L = new Map([['A', {}], ['C', {}]]);
  const p1 = B.planBook({ cover: {} }, {}, L), p2 = B.planBook({ cover: {}, bkD: 1 }, { file: { id: 'A' }, cover: { id: 'C' } }, L), p3 = B.planBook({}, { file: { id: 'A' }, cover: { id: 'C' } }, L), p4 = B.planBook({}, { file: { id: 'GONE' } }, L);
  ok(p1.file === 'create' && p1.cover === 'create' && p2.file === 'update' && p2.cover === 'update' && p3.file === '' && p3.cover === 'remove' && p4.file === 'create', 'תוכנית לכל ספר: יצירה / עדכון / הסרת כריכה / העלאה מחדש כשנמחק מהדרייב');

  /* ---------- המנוע מול Drive מדומה ---------- */
  const D = fakeDrive();
  const store = {}; const ls = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } };
  const books = new Map(); const fileStore = new Map();
  const put = async (b) => { books.set(b.id, JSON.parse(JSON.stringify(Object.assign({}, b, { cover: undefined })))); if (b.cover) books.get(b.id).cover = b.cover; };
  const all = async () => [...books.values()].map((b) => Object.assign({}, b));
  let apiCalls = [];
  const libApi = async (body) => { apiCalls.push(body.op); const r = body.op === 'gdToken' ? { ok: true, access_token: 'AT', expires_in: 3600, email: 'me@example.com' } : body.op === 'gdStatus' ? { ok: true, connected: true, email: 'me@example.com' } : { ok: true }; return { json: async () => r }; };
  const imported = [];
  const importFiles = async (files, extra, out) => {
    for (const f of files) {
      const txt = await f.text(); const id = 'id-' + txt.slice(0, 6);
      fileStore.set(id, new Blob([txt])); imported.push(id);
      await put({ id, title: 'מהקובץ', author: 'כותב', owner: 'u1', bkD: Date.now(), fraction: 0 });
      if (out) out.push(id);
    }
    return files.length;
  };
  const env = { fetch: D.fetch, ls, owner: () => 'u1', libApi, idToken: async () => 'IDT', allBooksRaw: all, putBook: put, getFile: async (id) => fileStore.get(id) || null,
    importFiles, applyEdit: (r, e) => Object.assign(r, { title: e.title }), mergeAnn: (a, b) => b };
  const BK = B.createBackup(env);
  BK.saveSettings({ email: 'me@example.com' });
  const coverBlob = new Blob(['JPEGDATA'], { type: 'image/jpeg' });
  await put({ id: 'id-AAAAAA', title: 'ספר ראשון', author: 'כותבת', owner: 'u1', src: undefined, cover: coverBlob, coverRatio: 0.66, bkD: 1, fraction: 0.4, cfi: 'epubcfi(/6/4)', lastRead: 5, ann: [{ id: 'h1' }], edit: { title: 'ספר ראשון' } });
  fileStore.set('id-AAAAAA', new File(['AAAAAA-תוכן הספר'], 'first.epub'));
  await put({ id: 'id-BBBBBB', title: 'ספר של חשבון אחר', owner: 'u2' });
  fileStore.set('id-BBBBBB', new Blob(['BBBBBB']));
  await put({ id: 'id-letter', title: 'מכתב באפט 1987', src: 'drive', owner: '' });
  let prog = [];
  const s1 = await BK.backupNow((d, t) => prog.push(d + '/' + t));
  const filesArr = [...D.files.values()];
  const rootF = filesArr.find((f) => f.appProperties.snbRoot === '1'), dataF = filesArr.find((f) => f.appProperties.snbData === '1');
  const bookF = filesArr.find((f) => f.appProperties.snbBook === '1');
  const manF = filesArr.find((f) => f.appProperties.snbManifest === '1');
  ok(rootF && rootF.name === B.ROOT_NAME && dataF && dataF.parents[0] === rootF.id, 'נוצרה תיקייה גלויה "THE SNOWBALL — הספרייה שלי" + תת־תיקיית נתונים');
  ok(bookF && bookF.parents[0] === rootF.id && bookF.name === 'ספר ראשון — כותבת.epub' && bookF.data === 'AAAAAA-תוכן הספר', 'הספר הועלה לתיקייה הגלויה בשם קריא');
  ok(!filesArr.some((f) => /BBBBBB|1987/.test(f.name || '') || /BBBBBB/.test(f.data || '')), 'רק הספרים הפרטיים של החשבון הנוכחי — לא מכתבי THE SNOWBALL ולא ספר של חשבון אחר');
  const man = JSON.parse(manF.data);
  const e1 = man.books['id-AAAAAA'];
  ok(manF.parents[0] === dataF.id && e1 && e1.file.id === bookF.id && e1.cover && e1.prog.fraction === 0.4 && e1.ann.length === 1 && e1.edit.title === 'ספר ראשון', 'library.json: קובץ, כריכה, התקדמות, הדגשות ופרטים שנערכו');
  ok(s1.count === 1 && s1.lastAt > 0 && s1.bytes > 0 && prog.join() === '1/1', 'מצב הגיבוי: זמן, מספר ספרים ונפח');
  ok(!books.get('id-AAAAAA').bkD && books.get('id-AAAAAA').bk.f === bookF.id, 'אחרי הגיבוי — הספר מסומן כמגובה');
  // גיבוי חוזר בלי שינוי — בלי העלאות
  const nUp = D.log.filter((l) => /upload/.test(l)).length;
  await BK.backupNow();
  ok(D.log.filter((l) => /upload/.test(l)).length === nUp + 1, 'גיבוי חוזר בלי שינוי — רק עדכון library.json, בלי להעלות שוב את הספר והכריכה');
  // עריכה: שינוי שם → שינוי שם בדרייב
  const b1 = books.get('id-AAAAAA'); b1.title = 'שם חדש'; await put(b1);
  await BK.backupNow();
  ok(bookF.name === 'שם חדש — כותבת.epub' && bookF.v === 1, 'שם שנערך — שם הקובץ בדרייב מתעדכן (בלי להעלות שוב)');
  // המשתמש מחק את הקובץ ידנית מהדרייב → מועלה שוב
  bookF.trashed = true;
  await BK.backupNow();
  const again = [...D.files.values()].filter((f) => f.appProperties.snbBook === '1' && !f.trashed);
  ok(again.length === 1 && again[0].id !== bookF.id, 'ספר שנמחק ידנית מהדרייב — מועלה שוב');
  // סקירה + שחזור אחרי איפוס
  let o = await BK.overview();
  ok(o.exists && o.books.length === 1 && o.books[0].onPhone && o.books[0].title === 'שם חדש', 'רשימת הגיבוי: הספר מסומן "בטלפון"');
  books.delete('id-AAAAAA'); fileStore.delete('id-AAAAAA');           // איפוס הספרייה שלי (הגיבוי נשאר)
  o = await BK.overview();
  ok(!o.books[0].onPhone, 'אחרי איפוס — "רק בגיבוי"');
  const nR = await BK.restore(null);
  const r1 = books.get('id-AAAAAA');
  ok(nR === 1 && r1 && r1.title === 'ספר ראשון' && r1.fraction === 0.4 && r1.cfi === 'epubcfi(/6/4)' && r1.ann.length === 1 && !r1.bkD && r1.bk, 'שחזור מלא: הקובץ, הפרטים שנערכו, ההתקדמות וההדגשות');
  // שחזור לא מוריד שוב ספר שכבר בטלפון
  imported.length = 0;
  await BK.restore(null);
  ok(!imported.length, 'שחזור "הכל" — רק מה שחסר בטלפון');
  // כריכה מותאמת חוזרת
  r1.coverCustom = 1; r1.cover = new Blob(['MYCOVER'], { type: 'image/jpeg' }); r1.bkD = Date.now(); await put(r1);
  await BK.backupNow();
  books.delete('id-AAAAAA');
  await BK.restore(['id-AAAAAA']);
  const r2 = books.get('id-AAAAAA');
  ok(r2.coverCustom === 1 && r2.cover && (await r2.cover.text()) === 'MYCOVER', 'כריכה שהמשתמש בחר — חוזרת בשחזור');
  // מחיקה מהגיבוי בלבד
  await BK.removeFromBackup(['id-AAAAAA']);
  o = await BK.overview();
  ok(!o.books.length && books.get('id-AAAAAA') && books.get('id-AAAAAA').bkX === 1, 'מחיקה מהגיבוי: הקובץ לפח בדרייב, הספר בטלפון נשאר ולא מגובה שוב');
  await BK.backupNow();
  ok(!(await BK.overview()).books.length, 'ספר שהוסר מהגיבוי לא חוזר אליו בגיבוי הבא');
  // קובץ גדול — resumable
  await put({ id: 'id-BIGBIG', title: 'ספר גדול', owner: 'u1', bkD: 1 });
  fileStore.set('id-BIGBIG', new Blob(['BIGBIG' + 'x'.repeat(5.5 * 1024 * 1024)]));
  await BK.backupNow();
  const big = [...D.files.values()].find((f) => /ספר גדול/.test(f.name || ''));
  ok(big && big.data.length > 5 * 1024 * 1024, 'קובץ מעל 5MB — מועלה ב־resumable');
  // נפח ב־Drive
  const qu = await BK.quota();
  ok(qu.limit === 16106127360 && qu.usage > 0, 'נפח Drive: שימוש ומגבלה');
  // מחיקת כל הגיבוי
  await BK.deleteAll();
  ok(rootF.trashed && !BK.settings().root && !(await BK.overview()).exists, 'מחיקת הגיבוי: התיקייה לפח של Drive, ההגדרות מתאפסות');
  // ניתוק
  await BK.disconnect();
  ok(!BK.settings().email && apiCalls.includes('gdDisconnect') && BK.settings().freq === 'change', 'ניתוק: החיבור נמחק (גם בשרתון), ההעדפות נשמרות');
  // הגדרות לכל חשבון
  const BK2 = B.createBackup(Object.assign({}, env, { owner: () => 'u2' }));
  BK.saveSettings({ email: 'me@example.com' });
  ok(!BK2.settings().email && BK.settings().email, 'הגדרות הגיבוי נפרדות לכל חשבון');
  ok(/'pwa_libbk_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]), 'מפתח הגיבוי ב־ACCOUNT_KEYS (הפרדת חשבונות)');
  // 401 באמצע — גישה חדשה ופעם אחת בלבד
  let first = true;
  const D2 = fakeDrive();
  const f401 = async (u, o2) => { if (first && /drive\/v3\/files\?/.test(u)) { first = false; return { status: 401, ok: false, headers: { get: () => null }, text: async () => '' }; } return D2.fetch(u, o2); };
  apiCalls = [];
  const BK3 = B.createBackup(Object.assign({}, env, { fetch: f401, owner: () => 'u9' }));
  BK3.saveSettings({ email: 'x' });
  await BK3.backupNow();
  ok(apiCalls.filter((x) => x === 'gdToken').length === 2, 'גישה שפגה באמצע (401) — מבקשים חדשה וממשיכים');

  /* ---------- הממשק (טקסט) ---------- */
  ok(/function shelfSeg\(/.test(lib) && /role', 'tablist'/.test(lib) && /\.lib-seg::before/.test(css), 'בורר מקטעים בסגנון iOS בין THE SNOWBALL לספרייה שלי');
  ok(/const shelfOf = \(b\) => \(b && b\.src === 'drive' \? 'snb' : 'mine'\)/.test(lib), 'ההפרדה: מכתב Drive = THE SNOWBALL, כל השאר = הספרייה שלי');
  ok(/if \(mine\) tr\.append\(more, add\)/.test(lib), 'הוספת ספר רק בספרייה שלי');
  ok(/filter\(\(r\) => shelfOf\(r\.b\) === ui\.shelf\)/.test(lib), 'חיפוש בתוך הטקסט — רק בספרייה שנבחרה');
  ok(/if \(rec\.src !== 'drive'\) rec\.bkD = Date\.now\(\)/.test(lib) && /if \(cur\.src !== 'drive'\) cur\.bkD = Date\.now\(\)/.test(lib), 'ייבוא ועריכה מסמנים את הספר לגיבוי');
  ok(/function openResetSheet\(/.test(lib) && /libResetKeep/.test(lib) && /BK\.deleteAll\(\)/.test(lib), 'איפוס הספרייה שלי — עם בחירה להשאיר או למחוק את הגיבוי');
  ok(/function askRemoveBacked\(/.test(lib), 'מחיקת ספר מגובה — מהטלפון בלבד או גם מהגיבוי');
  ok(/function renderBackup\(/.test(lib) && /function renderBackupBooks\(/.test(lib) && /bkSelect/.test(lib), 'מסך גיבוי + ספרים בגיבוי (נגיעה, לחיצה ארוכה, בחירה מרובה)');
  ok(/const p = BK\.connect\(signedEmail\(\)\);/.test(lib) && /const w = E\.openWindow \? E\.openWindow\(\) : null;\n    return \(async/.test(bkSrc), 'חלון ההסכמה נפתח בתוך הלחיצה (לפני כל המתנה) — לא נחסם');
  ok(!/refresh_token/.test(bkSrc) && !/refresh_token/.test(lib), 'ההרשאה הקבועה לא מגיעה לטלפון');
  ok(/drive\.file/.test(B.SCOPES) && !/auth\/drive[ "']/.test(bkSrc), 'הרשאה drive.file בלבד (לא כל הדרייב)');
  const oauthJs = fs.readFileSync(path.join(root, 'oauth.js'), 'utf8'), oauthHtml = fs.readFileSync(path.join(root, 'oauth.html'), 'utf8');
  ok(/history\.replaceState/.test(oauthJs) && /BroadcastChannel\('snb-oauth'\)/.test(oauthJs) && /default-src 'none'/.test(oauthHtml) && !/<script>/.test(oauthHtml), 'oauth.html: CSP מחמיר, בלי סקריפט inline, הקוד נמחק מהכתובת');
  ok(/localStorage\.removeItem\('pwa_oauth_v1'\)/.test(bkSrc) && /waitCode: waitOAuthCode/.test(lib), 'הקוד נמחק מהאחסון מיד אחרי השימוש (v355: בפונקציה המשותפת ב־libbackup.js)');
  // כל מחרוזת בספרייה — בעברית ובאנגלית
  const keys = [...new Set([...lib.matchAll(/T\('([A-Za-z]+)'/g)].map((m) => m[1]))];
  const heBlock = app.slice(app.indexOf('he: {'), app.indexOf('en: {')), enBlock = app.slice(app.indexOf('en: {'));
  const miss = keys.filter((k) => !new RegExp('\\b' + k + ':').test(heBlock) || !new RegExp('\\b' + k + ':').test(enBlock));
  ok(!miss.length, 'כל ' + keys.length + ' המחרוזות של הספרייה קיימות בעברית ובאנגלית' + (miss.length ? ' (חסר: ' + miss + ')' : ''));
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
