// 26/10/2026: התוסף ל־Chrome — סנכרון הסימניות וההיסטוריה עם Studio Browser (android/chrome-ext).
// core.js / status.js טהורים — מועתקים ל־.mjs זמני (node 20 לא מזהה ESM בקובץ .js) ונבדקים כאן.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const EXT = path.join(ROOT, 'android/chrome-ext');
const R = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let n = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL: ' + m); process.exit(1); } n++; };

(async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cx-'));
  for (const f of ['core', 'status']) fs.writeFileSync(path.join(tmp, f + '.mjs'), fs.readFileSync(path.join(EXT, f + '.js'), 'utf8'));
  const C = await import(path.join(tmp, 'core.mjs'));
  const St = await import(path.join(tmp, 'status.mjs'));

  // --- המפתח זהה ל־BrSync.key (אותן דוגמאות של BrSyncTest)
  const k = C.key('https://www.ynet.co.il/');
  for (const u of ['http://ynet.co.il', 'https://YNET.co.il/', 'https://www.ynet.co.il:443/', 'https://ynet.co.il/#top', 'https://ynet.co.il/?utm_source=x&fbclid=y']) ok(C.key(u) === k, 'key: ' + u);
  ok(C.key('https://a.com/p/') === C.key('https://a.com/p'), 'key: / בסוף');
  ok(C.key('https://a.com/%c3%a9') === C.key('https://a.com/%C3%A9'), 'key: אחוזים');
  ok(C.key('https://a.com/p?id=1') !== C.key('https://a.com/p?id=2'), 'key: פרמטר אמיתי');
  ok(C.key('https://a.com/#/inbox') !== C.key('https://a.com/#/sent'), 'key: עוגן של אפליקציה');
  ok(C.key('https://a.com/Path') !== C.key('https://a.com/path'), 'key: אותיות בנתיב');
  ok(C.key('https://a.com:8080/') !== C.key('https://a.com/'), 'key: פורט');
  ok(C.key('https://a.com/x?b=2&utm_medium=m&a=1') === 'a.com/x?b=2&a=1', 'key: מסיר utm ושומר סדר');
  const kt = R('android/app/src/testBrowser/java/io/github/yishaiguedj1/snowball/br/BrSyncTest.kt');
  ok(/a\.com\/x\?b=2&a=1/.test(kt), 'אותה דוגמה גם ב־BrSyncTest');

  // --- העץ של Chrome
  const tree = [{ id: '0', children: [
    { id: '1', folderType: 'bookmarks-bar', title: 'סרגל', children: [{ id: '10', title: 'ynet', url: 'https://www.ynet.co.il/', dateAdded: 5 }, { id: '11', title: 'js', url: 'javascript:void(0)' }, { id: '12', title: 'חדשות', children: [{ id: '13', title: 'cnn', url: 'https://cnn.com/' }] }] },
    { id: '2', folderType: 'other', title: 'אחרות', children: [] },
    { id: '3', folderType: 'mobile', title: 'בנייד', children: [{ id: '30', title: 'a', url: 'https://a.com/' }] },
  ] }];
  const flat = C.flatten(tree);
  ok(flat.length === 3 && !flat.some((m) => m.u.startsWith('javascript')), 'flatten: רק http/https');
  ok(flat.find((m) => m.id === '13').p === 'חדשות' && flat.find((m) => m.id === '13').r === 'b', 'flatten: נתיב ושורש');
  ok(C.mobileFolderId(tree) === '3', 'תיקיית "בנייד"');
  ok(C.mobileFolderId([{ children: [{ id: '1' }, { id: '2' }] }]) === '2', 'בלי "בנייד" — "אחרות"');

  // --- פעולות מהטלפון
  const ops = { ops: [
    { s: 1, k: 'add', id: 'a1', u: 'http://ynet.co.il', t: 'ynet' },          // כבר קיימת — רק קישור
    { s: 2, k: 'add', id: 'a2', u: 'https://new.com/', t: 'new' },
    { s: 3, k: 'add', id: 'a3', u: 'https://www.new.com', t: 'dup' },         // כפולה באותה אצווה
    { s: 4, k: 'del', id: 'n13' },
    { s: 5, k: 'add', id: 'a5', u: 'https://tmp.com/', t: 'x' }, { s: 6, k: 'del', id: 'a5' }, // נוספה ונמחקה לפני שהגיעה
    { s: 7, k: 'ren', id: 'n30', t: 'A!' },
    { s: 0, k: 'add', id: 'a0', u: 'https://old.com/' },                     // כבר טופלה (s ≤ ack)
  ] };
  const p = C.planOps(flat, ops, { ack: 0 });
  ok(p.creates.length === 1 && p.creates[0].u === 'https://new.com/' && p.creates[0].aid === 'a2', 'add: רק החדשה, בלי כפולה');
  ok(p.alias.a1 === 'n10' && p.alias.a3 === 'a2', 'add: מקשרים מזהה זמני לקיימת');
  ok(p.deletes.join() === '13', 'del לפי מזהה');
  ok(p.renames.length === 1 && p.renames[0].id === '30', 'ren');
  ok(p.ack === 7 && p.hold === 0, 'ack = האחרונה');
  const again = C.planOps(flat, ops, { ack: 7, alias: p.alias });
  ok(!again.creates.length && !again.deletes.length && again.ack === 7, 'אותו קובץ פעמיים — כלום');
  ok(C.planOps(flat, { ops: [{ s: 9, k: 'del', id: 'a1' }] }, { ack: 8, alias: { a1: 'n10' } }).deletes.join() === '10', 'del לפי מזהה זמני שקושר');
  ok(C.planOps(flat, { ops: [{ s: 1, k: 'add', id: 'x', u: 'ftp://x' }] }, null).creates.length === 0, 'add: רק http/https');

  // --- מחיקה גדולה מחכה לאישור
  const many = Array.from({ length: 40 }, (_, i) => ({ id: String(100 + i), u: `https://s${i}.com/`, t: '', r: 'o', p: '' }));
  const dOps = { ops: [{ s: 1, k: 'add', id: 'a1', u: 'https://z.com/' }].concat(many.slice(0, 15).map((m, i) => ({ s: 2 + i, k: 'del', id: 'n' + m.id }))) };
  const h = C.planOps(many, dOps, { ack: 0 });
  ok(h.hold === 15 && h.deletes.length === 0 && h.ack === 1 && h.creates.length === 1, 'מחיקה גדולה: עוצרים לפניה, מה שלפניה כן');
  const hy = C.planOps(many, dOps, { ack: 1 }, true);
  ok(hy.hold === 0 && hy.deletes.length === 15 && hy.ack === 16, 'אחרי אישור — מוחקים');
  ok(C.planOps(many, { ops: many.slice(0, 5).map((m, i) => ({ s: i + 1, k: 'del', id: 'n' + m.id })) }, null).hold === 0, 'מחיקה קטנה — בלי לחכות');

  // --- ביקורים מהטלפון
  const pv = C.planVisits({ vis: [{ u: 'https://a.com/', at: 10 }, { u: 'https://www.a.com', at: 20 }, { u: 'https://b.com/', at: 5 }, { u: 'chrome://x', at: 30 }] }, { vat: 8 });
  ok(pv.add.length === 1 && pv.add[0].at === 10 && pv.vat === 20, 'ביקורים: רק חדשים, בלי כפולים');

  // --- המצב
  const now = Date.UTC(2026, 9, 26);
  const st = C.buildState({ flat, hist: [{ url: 'https://h.com/', title: 'H', lastVisitTime: now - 1000 }, { url: 'https://old.com/', lastVisitTime: now - 40 * 86400000 }], prev: { rev: 4 }, ack: 7, alias: { a1: 'n10', zz: 'n999' }, vat: 20, origin: ['n30'], now, hold: 0 });
  ok(st.rev === 5 && st.marks.length === 3 && st.hist.length === 1, 'state: סימניות והיסטוריה של 30 יום');
  ok(st.marks.find((m) => m.id === 'n30').o === 'a' && st.marks.find((m) => m.id === 'n10').o === 'c', 'state: מאיפה הגיעה');
  ok(st.alias.a1 === 'n10' && !st.alias.zz, 'state: מזהה זמני שמצביע על כלום יוצא');
  ok(C.sameState(st, JSON.parse(JSON.stringify({ ...st, at: 1, rev: 9 }))) && !C.sameState(st, { ...st, ack: 8 }), 'sameState');

  // --- הכותרת בחלון
  ok(St.describe({ last: { at: now - 120000, ok: true, added: 3 } }, now).sub === 'לפני 2 דקות · 3 סימניות חדשות הגיעו מהטלפון', 'תיאור: אחרי סנכרון');
  ok(St.describe({ last: { at: now, err: 'auth' } }, now).warn, 'תיאור: שגיאה');
  ok(St.describe({ last: { at: now }, hold: 12 }, now).title === 'מחכה לאישור שלך', 'תיאור: מחכה לאישור');

  // --- המבנה של התוסף
  const man = JSON.parse(R('android/chrome-ext/manifest.json'));
  ok(man.manifest_version === 3 && man.background.type === 'module', 'MV3 + service worker כמודול');
  ok(JSON.stringify(man.oauth2.scopes) === '["https://www.googleapis.com/auth/drive.appdata"]', 'רק drive.appdata');
  ok(/^[A-Za-z0-9+/=]{300,}$/.test(man.key), 'key קבוע → מזהה תוסף קבוע (ללקוח ה־OAuth)');
  for (const p of ['bookmarks', 'history', 'identity', 'storage', 'alarms']) ok(man.permissions.includes(p), 'הרשאה: ' + p);
  ok(!man.permissions.includes('tabs') && !man.host_permissions.some((h) => !/googleapis\.com/.test(h)), 'בלי הרשאות מעבר לנדרש');
  for (const f of ['popup.html', 'welcome.html']) ok(!/<script>(?!<\/)/.test(R('android/chrome-ext/' + f)) && !/ on[a-z]+=/.test(R('android/chrome-ext/' + f)), f + ': בלי סקריפט מוטבע (CSP של MV3)');
  ok(!/innerHTML/.test(R('android/chrome-ext/popup.js')), 'החלון בלי innerHTML');
  ok(/'appDataFolder'/.test(R('android/chrome-ext/drive.js')) && !/thesnowball|vercel/i.test(fs.readdirSync(EXT).filter((f) => f.endsWith('.js')).map((f) => R('android/chrome-ext/' + f)).join('')), 'רק Drive של המשתמש — לא השרת שלנו');
  ok(/chrome-ext/.test(R('.github/workflows/android.yml')) && /studio-browser-chrome\.zip/.test(R('.github/workflows/android.yml')), 'התוסף נארז לקישור הקבוע');

  console.log(`chrome-ext: ${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
