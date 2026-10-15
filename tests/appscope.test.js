/* שלב 7 בתוכנית שלוש האפליקציות (15/10/2026): כל פעולה בשרתון מקבלת בקשות רק מהאפליקציה שלה — ibkr-proxy/lib/appscope.js + guard */
'use strict';
const path = require('path');
const { appDenied, tokenApp, endpointOf } = require('../ibkr-proxy/lib/appscope.js');
const { guard } = require('../ibkr-proxy/lib/ibkr.js');
let n = 0, bad = 0;
const ok = (c, name) => { n++; if (c) console.log('ok - ' + name); else { bad++; console.log('נכשל: ' + name); } };

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const tok = (app) => b64({ alg: 'RS256', kid: 'k' }) + '.' + b64(Object.assign({ sub: 'u1' }, app ? { app } : {})) + '.sig';
const PROD = { FIREBASE_PROJECT_ID: 'yishaiguedj1-c786e' };
const STG = { FIREBASE_PROJECT_ID: 'snowball-staging-758f6' };
const O = { invest: 'https://invest.thesnowball.app', academy: 'https://academy.thesnowball.app', studio: 'https://studio.thesnowball.app' };
const req = (ep, origin, extra) => ({ url: '/api/' + ep, headers: origin ? { origin } : {}, ...extra });
const deny = (ep, origin, body, env) => appDenied(req(ep, origin), body || {}, env || PROD);

// מטריצה: מקור × פעולה
const OWN = { 'flex-request': 'invest', 'flex-statement': 'invest', 'ibkr-sync': 'invest', library: 'academy', translate: 'academy', bookmeta: 'academy', studio: 'studio' };
for (const [ep, owner] of Object.entries(OWN)) {
  for (const app of Object.keys(O)) {
    const d = deny(ep, O[app], { op: 'x' });
    ok(app === owner ? d === '' : d === 'wrong_app', `${app} → /api/${ep}: ${app === owner ? 'מותר' : 'חסום'}`);
  }
}
// מידע ציבורי — פתוח לכולן
for (const ep of ['quotes', 'history', 'search', 'wordmark', 'widget']) {
  ok(Object.values(O).every((o) => deny(ep, o) === ''), `/api/${ep} פתוח לכל האפליקציות`);
}
// הגיבוי של Invest ל־Drive עובר דרך gd* של הספרייה — רק אלה
ok(deny('library', O.invest, { op: 'gdToken' }) === '' && deny('library', O.invest, { op: 'gdConnect' }) === '', 'Invest → /api/library gd*: מותר (גיבוי ל־Drive)');
ok(deny('library', O.invest, { op: 'list' }) === 'wrong_app' && deny('library', O.invest, { op: 'libMove' }) === 'wrong_app', 'Invest → /api/library שאר הפעולות: חסום');
ok(deny('library', O.studio, { op: 'gdToken' }) === 'wrong_app', 'Studio → /api/library gd*: חסום (ל־Studio לקוח Drive משלו)');
// מקור בלי אפליקציה ("הכל", github.io, localhost, בלי מקור) — כמו קודם
for (const o of ['https://thesnowball.app', 'https://yishaiguedj1.github.io', 'http://localhost:8080', '']) {
  ok(deny('ibkr-sync', o) === '' && deny('studio', o) === '', `מקור ${o || '(בלי)'} — לא נחסם לפי מקור`);
}
// הניסוי: <אפליקציה>-staging
ok(deny('ibkr-sync', 'https://academy-staging.thesnowball.app', {}, STG) === 'wrong_app' && deny('library', 'https://academy-staging.thesnowball.app', {}, STG) === '', 'ניסוי: Academy חסומה מ־IBKR, מותרת בספרייה');
ok(deny('ibkr-sync', 'https://staging.thesnowball.app', {}, STG) === '', 'ניסוי: האתר המאוחד — הכל');
// הטוקן: גם ממקור "נקי", טוקן של אפליקציה אחרת נחסם
ok(tokenApp(tok('academy')) === 'academy' && tokenApp('x.y') === '' && tokenApp(tok('')) === '', 'tokenApp קורא את טענת app');
ok(deny('ibkr-sync', '', { idToken: tok('academy') }) === 'wrong_app', 'טוקן של Academy → IBKR: חסום (גם בלי מקור)');
ok(deny('ibkr-sync', O.invest, { idToken: tok('academy') }) === 'wrong_app', 'מקור Invest + טוקן Academy: חסום');
ok(deny('ibkr-sync', O.invest, { idToken: tok('invest') }) === '', 'מקור Invest + טוקן Invest: מותר');
ok(deny('studio', O.studio, { idToken: tok('all') }) === '' && deny('studio', O.studio, { idToken: tok('') }) === '', "טוקן 'all' / Google ישיר (בלי app): מותר");
ok(deny('studio', O.studio, { idToken: 'garbage' }) === '', 'טוקן לא קריא — לא נחסם כאן (הפעולה מאמתת)');
ok(endpointOf('/api/flex-request?x=1') === 'flex-request' && endpointOf('/x') === '', 'endpointOf');

// דרך guard — כמו בבקשה אמיתית
function fakeRes() { const r = { code: 0, body: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.status = (c) => { r.code = c; return r; }; r.json = (b) => { r.body = b; return r; }; r.end = () => r; return r; }
{
  const res = fakeRes();
  const stop = guard({ url: '/api/ibkr-sync', method: 'POST', headers: { origin: O.academy }, body: JSON.stringify({ op: 'pull', idToken: tok('academy') }) }, res);
  ok(stop === true && res.code === 403 && res.body.error === 'wrong_app', 'guard: Academy → ibkr-sync = 403 wrong_app (גוף כמחרוזת)');
  const res2 = fakeRes();
  ok(guard({ url: '/api/ibkr-sync', method: 'POST', headers: { origin: O.invest }, body: { op: 'status' } }, res2) === false, 'guard: Invest → ibkr-sync עובר');
  const res3 = fakeRes();
  ok(guard({ url: '/api/studio', method: 'OPTIONS', headers: { origin: O.academy } }, res3) === true && res3.code === 204, 'guard: preflight לא נחסם (הבקשה עצמה כן)');
}
// כל פעולה בשרתון שמאמתת טוקן של משתמש — ברשימה
{
  const fs = require('fs');
  const dir = path.join(__dirname, '..', 'ibkr-proxy', 'api');
  const { SCOPE } = require('../ibkr-proxy/lib/appscope.js');
  const missing = fs.readdirSync(dir).filter((f) => /verifyIdToken|ibkrBg|vault/.test(fs.readFileSync(path.join(dir, f), 'utf8'))).map((f) => f.replace(/\.js$/, '')).filter((x) => !SCOPE[x]);
  ok(!missing.length, 'כל פעולה עם נתוני משתמש שייכת לאפליקציה' + (missing.length ? ' — חסר: ' + missing.join(', ') : ''));
}

console.log('# ' + (n - bad) + ' בדיקות עברו' + (bad ? ', ' + bad + ' נכשלו' : ''));
process.exit(bad ? 1 : 0);
