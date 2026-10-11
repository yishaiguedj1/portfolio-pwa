// 11/10/2026 — הגיבוי אצל ספק שני (ibkr-proxy/lib/offsite.js): עותק ב־Google Drive של המנהל.
// R2 ו־Drive מדומים; כולל ה־Drive האמיתי של הקוד (driveIo) מול fetch מדומה, והחיבור בשרתון (api/studio.js) דרך הבדיקה המתוזמנת.
// הרצה: node tests/offsite.test.js
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const OFF = require(path.join(root, 'ibkr-proxy/lib/offsite.js'));
const SC = require(path.join(root, 'ibkr-proxy/lib/studioscan.js'));

/* Drive מדומה (בזיכרון) */
function fakeDrive() {
  const files = new Map();
  let seq = 0;
  return {
    files,
    folder: async (name, parent, tag) => {
      for (const [id, f] of files) if (f.folder && f.tag === tag && f.parent === parent && !f.trashed) return id;
      const id = 'F' + (++seq); files.set(id, { folder: true, name, parent, tag }); return id;
    },
    list: async (folderId) => [...files].filter(([, f]) => f.parent === folderId && !f.trashed && !f.folder)
      .map(([id, f]) => ({ id, name: f.name, size: String(f.buf.length), appProperties: f.props })),
    upload: async (folderId, name, buf, mime, props) => { const id = 'D' + (++seq); files.set(id, { parent: folderId, name, buf, mime, props }); return id; },
    trash: async (id) => { files.get(id).trashed = true; },
  };
}
function fakeR2(objs) {
  return {
    objs,
    list: async (p) => [...objs].filter(([k]) => k.startsWith(p)).map(([key, b]) => ({ key, size: b.length })),
    get: async (k) => (objs.has(k) ? objs.get(k) : null),
  };
}

(async () => {
  const day = Date.parse('2026-10-11T03:40:00Z');
  const objs = new Map([
    ['bk/2026-10-11/fs.json.gz', Buffer.from('fs')], ['bk/2026-10-11/catalog.json.gz', Buffer.from('cat')], ['bk/2026-10-11/cat2.json.gz', Buffer.from('cat2')],
    ['bk/2026-10-10/fs.json.gz', Buffer.from('old')], ['gl/abcdef123.tsv', Buffer.from('moat\tחפיר\n')],
    ...Array.from({ length: 30 }, (_, i) => ['lib/v2/f/' + String(i).padStart(32, '0') + '.epub', Buffer.alloc(1000 + i, 1)]),
    ['lib/v2/c/' + 'c'.repeat(32) + '.jpg', Buffer.alloc(500, 2)],
    ['st/u/R2_jxxxxxxxxxxxxxxxxxxxx_aaaaaaaaaaaa', Buffer.alloc(9999, 3)],   // סרטון של הסטודיו — לא נכנס
  ]);
  const D = fakeDrive(), R = fakeR2(objs);
  const io = { r2: R, drive: D };

  /* ---------- ריצה ראשונה ---------- */
  let r = await OFF.runOffsite(io, day, {});
  ok(r.ok && r.day === '2026-10-11' && r.daily === 4, 'יום: שלושת קובצי הגיבוי של היום + מילון המונחים');
  const days = [...D.files.values()].filter((f) => f.props && f.props.snbD);
  ok(days.some((f) => f.name === '2026-10-11 · fs.json.gz') && days.some((f) => f.name === '2026-10-11 · gl-abcdef123.tsv'), 'שמות ברורים לפי תאריך');
  ok(!days.some((f) => f.props.snbK === 'bk/2026-10-10/fs.json.gz'), 'רק הגיבוי של היום (לא של אתמול)');
  ok(r.up === OFF.RUN_MAX_FILES && r.left === 31 - OFF.RUN_MAX_FILES, 'ספרים וכריכות: בהדרגה, עד התקציב לריצה (השאר בריצה הבאה)');
  ok(![...D.files.values()].some((f) => f.props && String(f.props.snbK || '').startsWith('st/')), 'סרטוני הסטודיו לא נכנסים לגיבוי');
  const names = [...D.files.values()].filter((f) => f.folder).map((f) => f.name);
  ok(names.includes(OFF.ROOT_NAME) && names.includes('ימים') && names.includes('ספרים וכריכות'), 'תיקייה גלויה ב־Drive עם שתי תת־תיקיות');

  /* ---------- ריצה שנייה באותו יום: רק מה שחסר ---------- */
  r = await OFF.runOffsite(io, day + 600e3, { day: r.day });
  ok(r.daily === 0 && r.up === 31 - OFF.RUN_MAX_FILES && r.left === 0, 'אותו יום — בלי כפילות; משלים את מה שחסר');
  const fl = [...D.files.values()].filter((f) => f.props && String(f.props.snbK || '').startsWith('lib/v2/'));
  ok(fl.length === 31 && new Set(fl.map((f) => f.props.snbK)).size === 31, 'כל קובץ פעם אחת');
  ok(Buffer.compare(fl.find((f) => f.props.snbK.endsWith('.jpg')).buf, objs.get('lib/v2/c/' + 'c'.repeat(32) + '.jpg')) === 0, 'התוכן זהה ל־R2');
  ok((await OFF.runOffsite(io, day + 1200e3, { day: r.day })).up === 0, 'הכל מגובה — אין מה להעלות');

  /* ---------- אסון: R2 התרוקן — הגיבוי לא נמחק ---------- */
  const R0 = fakeR2(new Map());
  r = await OFF.runOffsite({ r2: R0, drive: D }, day + 86400e3, { day: '2026-10-11' });
  ok(r.ok && r.up === 0 && r.day === '2026-10-11', 'R2 ריק: אין גיבוי חדש ליום (fs.json.gz חסר) — והמצב לא מתקדם');
  ok([...D.files.values()].filter((f) => f.props && String(f.props.snbK || '').startsWith('lib/v2/') && !f.trashed).length === 31, 'מחיקה המונית ב־R2 לא מוחקת אף ספר מהגיבוי');

  /* ---------- שמירה 14 יום ---------- */
  const old = [...D.files.entries()].find(([, f]) => f.props && f.props.snbD);
  old[1].props = Object.assign({}, old[1].props, { snbD: '2026-09-20' });
  objs.set('bk/2026-10-12/fs.json.gz', Buffer.from('fs12'));
  r = await OFF.runOffsite(io, Date.parse('2026-10-12T03:40:00Z'), { day: '2026-10-11' });
  ok(r.day === '2026-10-12' && r.gone === 1 && old[1].trashed, 'גיבוי יומי ישן מ־14 יום — לפח של Drive (רק "ימים")');
  ok(OFF.expiredDays([{ appProperties: { snbD: 'x' } }, { appProperties: {} }], day).length === 0, 'קובץ בלי תאריך תקין — לא נוגעים');

  /* ---------- תכנון טהור ---------- */
  const p = OFF.planFiles([{ key: 'a', size: 10 }, { key: 'b', size: OFF.FILE_MAX + 1 }, { key: 'c', size: 0 }, { key: 'd', size: 5 }], new Set(['d']), 5, 100);
  ok(p.up.length === 1 && p.up[0].key === 'a' && p.left === 0, 'planFiles: קיים / ריק / גדול מדי — לא מעלים');
  const p2 = OFF.planFiles([{ key: 'a', size: 60 }, { key: 'b', size: 60 }], new Set(), 5, 100);
  ok(p2.up.length === 1 && p2.left === 1, 'planFiles: תקרת בייטים לריצה');
  const p3 = OFF.planFiles([{ key: 'a', size: 300 }], new Set(), 5, 100);
  ok(p3.up.length === 1, 'planFiles: קובץ ראשון גדול מהתקציב עדיין עולה (לא נתקעים לנצח)');

  /* ---------- תקציב זמן ---------- */
  let t = 0;
  const D2 = fakeDrive();
  r = await OFF.runOffsite({ r2: R, drive: D2, clock: () => (t += 1000) }, day, { day: '2026-10-11' }, 4000);
  ok(r.up < OFF.RUN_MAX_FILES && r.left > 0, 'עד סוף זמן הפונקציה — מפסיקים ומשאירים לריצה הבאה');

  /* ---------- driveIo מול fetch מדומה ---------- */
  const calls = [];
  const fakeFetch = async (url, opt = {}) => {
    calls.push((opt.method || 'GET') + ' ' + url.split('?')[0]);
    const res = (status, body, hd) => ({ status, headers: { get: (k) => (hd || {})[k.toLowerCase()] || null }, json: async () => body });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?') && (opt.method || 'GET') === 'GET') return res(200, { files: [] });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?fields=id') && opt.method === 'POST') return res(200, { id: 'FOLDER1' });
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable')) return res(200, {}, { location: 'https://www.googleapis.com/upload/drive/v3/files?upload_id=X' });
    if (url.startsWith('https://www.googleapis.com/upload/drive/v3/files?upload_id=X') && opt.method === 'PUT') return res(200, { id: 'NEW1' });
    if (opt.method === 'PATCH') return res(200, {});
    return res(500, {});
  };
  const dio = OFF.driveIo(fakeFetch, 'TOKEN');
  ok(await dio.folder('x', null, 'root') === 'FOLDER1', 'driveIo: תיקייה חדשה כשאין');
  ok(await dio.upload('FOLDER1', 'a.gz', Buffer.from('z'), 'application/gzip', { snbK: 'k' }) === 'NEW1', 'driveIo: העלאה מתחדשת');
  await dio.trash('NEW1');
  ok(calls.some((c) => c.startsWith('PATCH ')), 'driveIo: מחיקה = פח (PATCH trashed), לא DELETE');
  const bad = OFF.driveIo(async (url, opt = {}) => ({ status: 200, headers: { get: () => 'https://evil.example/upload' }, json: async () => ({}) }), 'T');
  let threw = false; try { await bad.upload('F', 'a', Buffer.from('1'), 'text/plain', {}); } catch (e) { threw = /gd_http/.test(e.message); }
  ok(threw, 'driveIo: כתובת העלאה שאינה של Google — לא שולחים אליה את הקובץ');

  /* ---------- בדיקת המוכנות ---------- */
  const now = Date.parse('2026-10-11T12:00:00Z');
  ok(SC.scanFindings({ offsite: { day: '' } }, now).f[0].k === 'offsite_none', 'מוכנות: הגיבוי עוד לא רץ — ממצא');
  ok(SC.scanFindings({ offsite: { day: '2026-10-10' } }, now).f.length === 0 && SC.scanFindings({ offsite: { day: '2026-10-10' } }, now).ok.includes('offsite'), 'מוכנות: גובה אתמול — עובר');
  ok(SC.scanFindings({ offsite: { day: '2026-10-07' } }, now).f[0].k === 'offsite_stale', 'מוכנות: לפני 4 ימים — ממצא');
  ok(!SC.scanFindings({}, now).ok.includes('offsite'), 'בלי עובדה (לא מנהל) — הבדיקה לא רצה');

  /* ---------- הטלפון: סוגי הממצא מוכרים ומתורגמים ---------- */
  const fs = require('fs');
  const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8'), app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  ok(/'offsite_none', 'offsite_stale'/.test(src) && /case 'offsite_none'/.test(src) && /case 'offsite_stale'/.test(src), 'הטלפון מכיר את סוגי הממצא');
  ok((app.match(/studioScOffNone:/g) || []).length === 2 && (app.match(/studioScFixOff:/g) || []).length === 2, 'מחרוזות בעברית ובאנגלית');
  const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/const ob = await offsiteBackup\(deps, now\)/.test(api) && /offsiteOwner\(deps, uid\)/.test(api), 'השרתון: רץ מהבדיקה המתוזמנת, הבעלים נרשם מהמנהל');

  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
