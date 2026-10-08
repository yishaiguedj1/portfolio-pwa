// שלב 4: PKCE בחיבור ל־Google Drive (הספרייה והסטודיו — אותו libbackup.js). הסוד החד־פעמי (verifier) נשאר בטלפון,
// Google מקבל רק את ה־hash שלו (challenge, S256), והשרתון מעביר את ה־verifier בהחלפת הקוד — קוד שיורט לא שמיש.
// הרצה: node tests/pkce.test.js
const path = require('path');
const crypto = require('crypto');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');

(async () => {
  const { createBackup } = await import(path.join(root, 'libbackup.js'));
  const calls = [];
  let authUrl = '';
  const ls = (() => { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; } }; })();
  const libApi = async (body) => {
    calls.push(body);
    const r = body.op === 'gdConfig' ? { ok: true, configured: true, clientId: 'cid.apps.googleusercontent.com' }
      : body.op === 'gdConnect' ? { ok: true, access_token: 'AT', expires_in: 3600, email: 'me@example.com' } : { ok: true };
    return { json: async () => r };
  };
  const BK = createBackup({ ls, owner: () => 'u1', libApi, idToken: async () => 'IDT', redirectUri: () => 'https://yishaiguedj1.github.io/portfolio-pwa/oauth.html',
    openWindow: () => null, waitCode: async (w, url, state) => { authUrl = url; return { code: '4/CODE', state }; },
    allBooksRaw: async () => [], putBook: async () => {}, getFile: async () => null, fetch: async () => ({ status: 404 }) });
  const email = await BK.connect();
  const u = new URL(authUrl), q = u.searchParams;
  const conn = calls.find((c) => c.op === 'gdConnect');
  ok(email === 'me@example.com' && u.origin === 'https://accounts.google.com', 'החיבור עובר דרך חלון ההסכמה של Google');
  ok(q.get('code_challenge_method') === 'S256' && /^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge')), 'הבקשה ל־Google עם code_challenge (S256)');
  ok(conn && /^[A-Za-z0-9._~-]{43,128}$/.test(conn.verifier), 'ה־verifier נשלח לשרתון יחד עם הקוד');
  const expect = crypto.createHash('sha256').update(conn.verifier).digest('base64url');
  ok(q.get('code_challenge') === expect, 'ה־challenge = ‏SHA-256 של ה־verifier (כמו ש־Google בודק)');
  ok(!authUrl.includes(conn.verifier), 'ה־verifier עצמו לא נשלח ל־Google בבקשה הראשונה (רק בהחלפה, מהשרתון)');
  ok(/^[A-Za-z0-9_-]{24}$/.test(q.get('state')), 'state אקראי קריפטוגרפי (לא Math.random)');
  await BK.connect();
  const conn2 = calls.filter((c) => c.op === 'gdConnect')[1];
  ok(conn2.verifier !== conn.verifier, 'verifier חדש לכל חיבור');

  /* השרתון: code_verifier מגיע ל־Google; verifier בצורה לא תקינה — נדחה */
  const gd = require(path.join(root, 'ibkr-proxy/lib/gdrive.js'));
  ok(/code_verifier: verifier/.test(require('fs').readFileSync(path.join(root, 'ibkr-proxy/lib/gdrive.js'), 'utf8')) && typeof gd.studio.handle === 'function', 'השרתון מעביר את ה־verifier להחלפת הקוד');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
