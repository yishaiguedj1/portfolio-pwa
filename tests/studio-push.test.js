// שלב 4 בסטודיו (10/10/2026): התראות לטלפון — צד הטלפון (המנוי, המתג, הקישור מההתראה).
// השרתון (הצפנה מול וקטור RFC 8291, VAPID בכספת, שליחה בשאלה/סיום, בלי שם קובץ) — ב־ibkr-proxy/tests/run.js.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

(async () => {
  global.atob = global.atob || ((s) => Buffer.from(s, 'base64').toString('binary'));
  const st = await import('../studio.js');
  const key = Buffer.alloc(65, 7); key[0] = 4;
  const k64 = key.toString('base64url');
  ok(Buffer.from(st.b64uBytes(k64)).equals(key), 'המפתח הציבורי (base64url בלי ריפוד) → בתים ל־applicationServerKey');

  const src = read('studio.js'), app = read('app.js'), wp = read('ibkr-proxy/lib/webpush.js');
  const on = src.slice(src.indexOf('async function pushOn()'), src.indexOf('async function pushOff()'));
  ok(/^\s*const perm = await Notification\.requestPermission\(\);/m.test(on.split('try {')[1] || ''), 'requestPermission — הפעולה הראשונה אחרי הלחיצה (בלי await לפניה: אחרת הדפדפן חוסם)');
  ok(/userVisibleOnly: true/.test(on) && /act: 'on', sub: sub\.toJSON\(\), lang/.test(on), 'המנוי נשלח לשרתון עם שפת המכשיר');
  ok(/act: 'off', e: sub\.endpoint/.test(src) && /sub\.unsubscribe\(\)/.test(src), 'כיבוי: מהשרתון ומהדפדפן');
  ok(/rowSwitch\(\{ label: T\('studioPushT'\)/.test(src) && /T\('studioPushTest'\)/.test(src), 'מתג אחד בהגדרות הסטודיו + התראת בדיקה');
  for (const k of ['studioSecPush', 'studioPushT', 'studioPushOnS', 'studioPushOffS', 'studioPushDenied', 'studioPushNa', 'studioPushTest', 'studioPushTestSent', 'studioPushOnDone', 'studioPushErr', 'studioPushBusy'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);
  ok(/const sj = get\('studio'\);/.test(app) && /\/\^j\[A-Za-z0-9_-\]\{20\}\$\/\.test\(sj\)/.test(app) && /m\.openStudio\(\{ job: sj[,}]/.test(app), 'קישור מההתראה (‎#studio=<עבודה>) — רק מזהה בצורה הנכונה');
  ok(/\(\?:tab\|stock\|studio\)=/.test(app), 'קישור שהגיע כשהדף היה ברקע — מטופל בחזרה למסך');
  ok(/const jobLink = opt && \/\^j\[A-Za-z0-9_-\]\{20\}\$\/\.test/.test(src) && /goJobLink\(jobLink, linkView\)/.test(src) && /function goJobLink\(id, view\) \{\n  go\('job', id\);/.test(src), 'הסטודיו נפתח על העבודה');
  ok(/u: SUBJECT \+ \(j \? '#studio=' \+ j : ''\)/.test(wp) && !/spec|name/.test(wp.slice(wp.indexOf('function message'), wp.indexOf('async function sendAll'))), 'השרתון: בהתראה רק סוג האירוע ומזהה העבודה');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + e.message); process.exit(1); });
