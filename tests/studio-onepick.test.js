// בורר הקבצים של Google במסך מלא (trigger_onepick, 11/10/2026): משיכת סרטון ובחירת תיקייה לשמירה בסטודיו,
// עם נפילה אוטומטית לבורר הנוכחי (Google Picker) כש־Google לא מציג בורר ללקוח האתר.
// הרצה: node tests/studio-onepick.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz0123';

(async () => {
  const B = await import(path.join(root, 'libbackup.js'));

  /* ---------- 1. מזהים מהבורר ---------- */
  ok(B.pickedIds(ID + ',' + ID + ',bad id,<x>,short') .join() === ID, 'pickedIds: רק מזהה Drive תקין, בלי כפולים');
  ok(B.pickedIds('').length === 0 && B.pickedIds(null).length === 0, 'pickedIds: ריק — רשימה ריקה');
  ok(B.pickedIds(Array.from({ length: 30 }, (_, i) => ID + i).join(',')).length === 20, 'pickedIds: עד 20');

  /* ---------- 2. כתובת הבקשה ל־Google ---------- */
  const calls = [];
  let authUrl = '', reply = null;
  const ls = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; })();
  const libApi = async (body) => {
    calls.push(body);
    const r = body.op === 'gdConfig' ? { ok: true, configured: true, clientId: 'cid.apps.googleusercontent.com' }
      : body.op === 'gdConnect' ? { ok: true, access_token: 'AT', expires_in: 3600, email: '' } : { ok: true };
    return { json: async () => r };
  };
  let opened = 0;
  const BK = B.createBackup({ ls, owner: () => 'u1', libApi, idToken: async () => 'IDT', redirectUri: () => 'https://yishaiguedj1.github.io/portfolio-pwa/oauth.html',
    openWindow: () => { opened++; return null; }, waitCode: async (w, url, state) => { authUrl = url; return Object.assign({ state }, reply); },
    allBooksRaw: async () => [], putBook: async () => {}, getFile: async () => null, fetch: async () => ({ status: 404 }) });

  reply = { code: '4/CODE', picked: ID };
  const pr = BK.pick({ types: ['video/mp4', 'video/webm'] }, 'me@example.com');
  ok(opened === 1, 'החלון נפתח מיד, בתוך הלחיצה (לפני כל await)');
  const ids = await pr;
  const q = new URL(authUrl).searchParams;
  ok(ids.join() === ID, 'מחזיר את הקובץ שנבחר');
  ok(q.get('trigger_onepick') === 'true' && q.get('mimetypes') === 'video/mp4,video/webm', 'trigger_onepick + סוגי הקבצים (רק סרטונים)');
  ok(q.get('scope') === B.SCOPE_FILE && !q.has('include_granted_scopes'), 'רק drive.file — בלי הרשאות נוספות (תנאי של Google לבורר)');
  ok(q.get('prompt') === 'consent' && q.get('access_type') === 'offline' && q.get('code_challenge_method') === 'S256' && q.get('login_hint') === 'me@example.com',
    'PKCE, הרשאה קבועה (העובד), והחשבון המחובר מראש');
  ok(calls.some((c) => c.op === 'gdConnect' && c.code === '4/CODE' && c.verifier), 'הקוד מוחלף בשרתון (אותו gdConnect, עם ה־verifier)');

  reply = { code: '4/CODE2', picked: ID };
  await BK.pick({ folder: true });
  const q2 = new URL(authUrl).searchParams;
  ok(q2.get('allow_folder_selection') === 'true' && q2.get('mimetypes') === B.FOLDER_MIME, 'בחירת תיקייה: allow_folder_selection + סוג התיקייה');

  reply = { code: '4/CODE3' };
  ok((await BK.pick({})).length === 0, 'Google החזיר קוד בלי בורר (לקוח לא נתמך) — רשימה ריקה, והאפליקציה עוברת לבורר הנוכחי');
  const err = async (rep) => { reply = rep; try { await BK.pick({}); return ''; } catch (e) { return e.code; } };
  ok(await err({ error: 'access_denied' }) === 'gd_denied', 'ביטול — gd_denied (לא נופלים לבורר אחר)');
  ok(await err({ error: 'invalid_request' }) === 'gd_pick_bad', 'Google דחה את הפרמטרים — gd_pick_bad (נופלים לבורר הנוכחי)');
  ok(await err({ error: 'popup_blocked' }) === 'gd_popup', 'חלון חסום — gd_popup');
  reply = null;
  ok(await err(null) === 'gd_cancel', 'החלון נסגר בלי תשובה — gd_cancel');

  reply = { code: '4/C' };
  await BK.connect();
  const q3 = new URL(authUrl).searchParams;
  ok(q3.get('scope') === B.SCOPES && q3.get('include_granted_scopes') === 'true' && !q3.has('trigger_onepick'), 'החיבור הרגיל לא השתנה');

  /* ---------- 3. עמוד החזרה מעביר את המזהים — מסונן ---------- */
  const runOauth = (search) => {
    const out = {};
    const ctx = { self: 1, top: 1, location: { search, pathname: '/oauth.html' }, history: { replaceState() {} }, URLSearchParams, Date, setTimeout: () => {}, window: { close() {} },
      BroadcastChannel: function () { return { postMessage: (m) => { out.m = m; }, close() {} }; },
      localStorage: { setItem() {} }, document: { documentElement: { style: {} }, getElementById: () => null } };
    ctx.top = ctx.self;
    vm.runInNewContext(read('oauth.js'), ctx);
    return out.m;
  };
  const m1 = runOauth('?code=4/X&state=S&picked_file_ids=' + ID + ',' + encodeURIComponent('<script>'));
  ok(m1.code === '4/X' && m1.picked === ID, 'oauth.js מעביר את picked_file_ids — רק מזהים תקינים');
  ok(runOauth('?code=4/X&state=S').picked === '', 'בלי בחירה — ריק');
  ok(/picked: typeof m\.picked === 'string'/.test(read('libbackup.js')), 'waitOAuthCode מעביר את הבחירה הלאה');

  /* ---------- 4. הסטודיו: מתי הבורר החדש, ומתי נופלים ---------- */
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k) => k;
  const st = await import(path.join(root, 'studio.js'));
  const now = Date.UTC(2026, 9, 11);
  ok(st.onepickOk({}, now) && st.onepickOk({ op1: now - 31 * 864e5 }, now) && !st.onepickOk({ op1: now - 864e5 }, now), 'אחרי ש־Google סירב — הבורר הנוכחי לחודש, ואז מנסים שוב');
  ok(st.normSettings({ op1: now }).op1 === now && !('op1' in st.normSettings({ op1: -5 })) && !('op1' in st.defaultSettings()), 'normSettings: op1 נשמר רק כשיש');
  ok(st.canPickDrive(null, {}, { configured: true }, now) && !st.canPickDrive(null, {}, null, now) && !st.canPickDrive(null, { op1: now }, { configured: true }, now)
    && st.canPickDrive({ key: 'k', app: '1' }, { op1: now }, null, now), 'שורת "מ־Google Drive": בורר חדש (Drive מוגדר) או מפתח Picker');
  const sj = read('studio.js');
  const dp = sj.slice(sj.indexOf('async function drivePick(kind)'), sj.indexOf('async function legacyPick(kind)'));
  ok(/^async function drivePick\(kind\) \{\n  if \(onepickOk\(store\.settings, Date\.now\(\)\)\) \{\n    let ids, why = 'picker';\n    try \{ ids = await gd\(\)\.pick\(/.test(dp), 'gd().pick נקרא ראשון — בלי await לפני (החלון בתוך הלחיצה)');
  ok(/if \(c === 'gd_denied' \|\| c === 'gd_cancel'\) return null;/.test(dp) && /if \(ids\) \{ store\.settings\.op1 = Date\.now\(\); save\(\); \}/.test(dp) && /return legacyPick\(kind\)/.test(dp),
    'ביטול = ביטול; Google לא הציג בורר = זוכרים ועוברים לבורר הנוכחי בלי לחיצה נוספת');
  ok(/net\._forget\(\)/.test(dp) && /net\.driveMeta\(ids\[0\]\)/.test(dp), 'אחרי הבחירה — גישה חדשה ופרטי הקובץ מ־Drive');
  ok(/x\.meta \|\| await net\.driveMeta\(x\.id\)/.test(sj) && /dest = await drivePick\('folder'\)/.test(sj), 'משיכת סרטון ושמירה בתיקייה — שתיהן דרך הבורר החדש');
  ok(/if \(canPick\(\)\) p\.append\(list\(rowNav\(\{ tile: tile\('cloud', 'teal'\)/.test(sj) && /canPick\(\) && outs\.some/.test(sj), 'השורות מוצגות גם בלי מפתח Picker');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
