// 27/10/2026 (בקשת המשתמש: "במיוחד ההיסטוריה"): sync.js של התוסף מול Chrome ו־Drive מדומים — ההיסטוריה בשני הכיוונים:
// כל ביקור בזמן המדויק, ביקור מהטלפון חוזר בלי כפולה (ההד), מחיקה מהטלפון מוחקת ב־Chrome רק אותו, מחיקה ב־Chrome מגיעה.
const fs = require('fs'), path = require('path'), os = require('os');
const EXT = path.join(__dirname, '..', 'android/chrome-ext');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cxs-'));
for (const f of ['core', 'sync']) fs.writeFileSync(path.join(tmp, f + '.mjs'), fs.readFileSync(path.join(EXT, f + '.js'), 'utf8').replace(/from '\.\/([a-z]+)\.js'/g, "from './$1.mjs'"));
fs.writeFileSync(path.join(tmp, 'drive.mjs'), [
  'export const files = {};',
  "export async function token() { return 't'; }",
  'export async function forget() {}',
  'export async function readJson(t, n) { return files[n] ? JSON.parse(files[n]) : null; }',
  'export async function writeJson(t, n, o) { files[n] = JSON.stringify(o); }',
].join('\n'));
(async () => {
  let NOW = Date.UTC(2026, 9, 27, 10);
  Date.now = () => NOW;
  const store = {}; const L = {}; const on = (k) => ({ addListener: (f) => { (L[k] = L[k] || []).push(f); } });
  let vid = 1; const V = [];   // { visitId, url, title, visitTime }
  const visit = (url, title, t) => V.push({ visitId: String(vid++), url, title, visitTime: t });
  globalThis.chrome = {
    storage: { local: { get: async (k) => { const o = {}; for (const x of [].concat(k)) if (x in store) o[x] = structuredClone(store[x]); return o; }, set: async (o) => { Object.assign(store, structuredClone(o)); } } },
    runtime: { onInstalled: on('i'), onStartup: on('s'), onMessage: on('m') },
    alarms: { create() {}, onAlarm: on('a') },
    bookmarks: { getTree: async () => [{ id: '0', children: [{ id: '1', folderType: 'bookmarks-bar', children: [] }, { id: '2', folderType: 'other', children: [] }, { id: '3', folderType: 'mobile', children: [] }] }],
      onCreated: on('b'), onRemoved: on('b'), onChanged: on('b'), onMoved: on('b') },
    history: {
      onVisited: on('hv'), onVisitRemoved: on('hr'),
      search: async ({ startTime }) => { const m = new Map(); for (const v of V) if (v.visitTime >= startTime) { const c = m.get(v.url); if (!c || c.lastVisitTime < v.visitTime) m.set(v.url, { url: v.url, title: v.title, lastVisitTime: v.visitTime }); } return [...m.values()]; },
      getVisits: async ({ url }) => V.filter((v) => v.url === url).map((v) => ({ visitId: v.visitId, visitTime: v.visitTime })),
      addUrl: async ({ url }) => { visit(url, '', NOW); },
      deleteRange: async ({ startTime, endTime }) => { for (let i = V.length - 1; i >= 0; i--) if (V[i].visitTime >= startTime && V[i].visitTime < endTime) V.splice(i, 1); L.hr.forEach((f) => f({ allHistory: false, urls: [] })); },
    },
    identity: { getProfileUserInfo: async () => ({ email: 'x' }) },
  };
  const drive = await import(path.join(tmp, 'drive.mjs'));
  await import(path.join(tmp, 'sync.mjs'));
  store.on = true;
  const sync = () => new Promise((r) => L.m[0]({ cmd: 'sync' }, {}, r));
  const hist = () => JSON.parse(drive.files['state.json']).hist.map((v) => v.u.replace('https://', '') + '@' + Math.round((v.at - Date.UTC(2026, 9, 27)) / 60000)).sort();
  let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('FAIL', m); }  };
  const H = Date.UTC(2026, 9, 27);
  // 1) Chrome: a.com פעמיים, b.com פעם — שלושה ביקורים
  visit('https://a.com/', 'A', H + 60 * 60000); visit('https://a.com/', 'A', H + 120 * 60000); visit('https://b.com/', 'B', H + 180 * 60000);
  await sync();
  ok(JSON.stringify(hist()) === JSON.stringify(['a.com/@120', 'a.com/@60', 'b.com/@180']), 'כל ביקור עובר לטלפון, בזמן המדויק: ' + hist());
  // 2) ביקור בטלפון (c.com ב־200) — נכנס ל־Chrome בזמן הסנכרון (NOW=600), חוזר לטלפון בזמן שלו, בלי כפולה
  NOW = H + 600 * 60000;
  drive.files['ops.json'] = JSON.stringify({ v: 1, ops: [], vis: [{ u: 'https://c.com/', t: 'C', at: H + 200 * 60000 }] });
  await sync();
  ok(V.some((v) => v.url === 'https://c.com/' && v.visitTime === NOW), 'ביקור מהטלפון נכנס ל־Chrome');
  ok(JSON.stringify(hist()) === JSON.stringify(['a.com/@120', 'a.com/@60', 'b.com/@180', 'c.com/@200']), 'חוזר לטלפון בזמן של הטלפון (בלי כפולה): ' + hist());
  await sync();
  ok(V.filter((v) => v.url === 'https://c.com/').length === 1, 'אותו קובץ פעמיים — לא נכנס שוב');
  // 3) מחיקה בטלפון: a.com@60 (ביקור של Chrome) ו־c.com@200 (ההד) — נמחקים ב־Chrome בדיוק הם
  NOW = H + 700 * 60000;
  drive.files['ops.json'] = JSON.stringify({ v: 1, ops: [{ s: 1, k: 'hdel', u: 'https://a.com/', at: H + 60 * 60000 }, { s: 2, k: 'hdel', u: 'https://c.com/', at: H + 200 * 60000 }], vis: [{ u: 'https://c.com/', t: 'C', at: H + 200 * 60000 }] });
  await sync();
  ok(V.length === 2 && V.some((v) => v.url === 'https://a.com/' && v.visitTime === H + 120 * 60000) && !V.some((v) => v.url === 'https://c.com/'), 'מחיקה מהטלפון מוחקת ב־Chrome רק את הביקור הזה');
  ok(JSON.stringify(hist()) === JSON.stringify(['a.com/@120', 'b.com/@180']), 'והמצב לטלפון בלעדיהם: ' + hist());
  // 4) מחיקה ב־Chrome (b.com) → נעלם מהמצב (הטלפון ימחק — "היה ועכשיו לא")
  V.splice(V.findIndex((v) => v.url === 'https://b.com/'), 1); L.hr.forEach((f) => f({ allHistory: false, urls: ['https://b.com/'] }));
  await sync();
  ok(JSON.stringify(hist()) === JSON.stringify(['a.com/@120']), 'מחיקה ב־Chrome: ' + hist());
  // 5) ביקור חדש ב־Chrome — סריקה חלקית תופסת
  NOW = H + 800 * 60000; visit('https://d.com/', 'D', NOW - 1000);
  await sync();
  ok(hist().includes('d.com/@800'), 'ביקור חדש ב־Chrome מגיע');
  const st = JSON.parse(drive.files['state.json']);
  ok(st.vat === H + 200 * 60000 && st.ack === 2 && st.hfrom > 0, 'ack/vat/hfrom');
  console.log(fails ? 'chrome-ext-sync: ' + fails + ' נכשלו' : 'chrome-ext-sync: הכל עבר'); process.exit(fails ? 1 : 0);

})().catch((e) => { console.log('FAIL', e); process.exit(1); });
