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
  const on = src.slice(src.indexOf('async function pushOn('), src.indexOf('async function pushOff()'));
  ok(/^\s*const perm = await Notification\.requestPermission\(\);/m.test(on.split('try {')[1] || ''), 'requestPermission — הפעולה הראשונה אחרי הלחיצה (בלי await לפניה: אחרת הדפדפן חוסם)');
  ok(/userVisibleOnly: true/.test(on) && /act: 'on', sub: sub\.toJSON\(\), lang/.test(on), 'המנוי נשלח לשרתון עם שפת המכשיר');
  ok(/act: 'off', e: sub\.endpoint/.test(src) && /sub\.unsubscribe\(\)/.test(src), 'כיבוי: מהשרתון ומהדפדפן');
  ok(/rowSwitch\(\{ label: T\('studioPushT'\)/.test(src) && /T\('studioPushTest'\)/.test(src), 'מתג אחד בהגדרות הסטודיו + התראת בדיקה');
  for (const k of ['studioSecPush', 'studioPushT', 'studioPushOnS', 'studioPushOffS', 'studioPushDenied', 'studioPushNa', 'studioPushTest', 'studioPushTestSent', 'studioPushOnDone', 'studioPushErr', 'studioPushBusy'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);
  ok(/const sj = get\('studio'\);/.test(app) && /\/\^j\[A-Za-z0-9_-\]\{20\}\$\/\.test\(sj\)/.test(app) && /location\.replace\(APP_PAGE\.studio \+ '#studio=' \+ sj/.test(app) && /\[#&\]studio=\(j\[A-Za-z0-9_-\]\{20\}\)/.test(fs.readFileSync(path.join(__dirname, '..', 'studio-app.js'), 'utf8')), 'קישור מההתראה (‎#studio=<עבודה>) — רק מזהה בצורה הנכונה, עובר ל־Studio העצמאי');
  ok(/\(\?:tab\|stock\|studio(\|chart)?\)=/.test(app), 'קישור שהגיע כשהדף היה ברקע — מטופל בחזרה למסך');
  ok(/const jobLink = opt && \/\^j\[A-Za-z0-9_-\]\{20\}\$\/\.test/.test(src) && /goJobLink\(jobLink, linkView, 'none'\)/.test(src) && /function goJobLink\(id, view, kind\) \{[^\n]*\n  go\('job', id, kind\);/.test(src), 'הסטודיו נפתח על העבודה');
  ok(/u: SUBJECT \+ \(j \? '#studio=' \+ j : ''\)/.test(wp) && !/spec|name/.test(wp.slice(wp.indexOf('function message'), wp.indexOf('async function sendAll'))), 'השרתון: בהתראה רק סוג האירוע ומזהה העבודה');
  {
    // 27/10/2026: פעילות כברירת מחדל — בלי לחיצה בהגדרות; כיבוי ידני או סירוב נשמרים (pno), ולא שואלים שוב
    const au = src.slice(src.indexOf('async function pushAuto('), src.indexOf('async function pushOn('));
    ok(/store\.settings\.pno/.test(au) && /perm !== 'granted' && !byUser/.test(au) && /return pushOn\(true\)/.test(au), 'pushAuto: בלי הרשאה — רק בלחיצה; כיבית/סירבת — לא שוב');
    ok(/function startFromForm\(\) \{\n  const f = form;\n  pushAuto\(true\);/.test(src), 'הבקשה בלחיצה על "תרגם" — לפני כל await');
    ok(/refreshStatus\(true\)\)\.then\(\(\) => pushAuto\(false\)\)/.test(src), 'הרשאה שכבר ניתנה — מנוי בשקט בפתיחה');
    const off = src.slice(src.indexOf('async function pushOff('), src.indexOf('async function pushTest('));
    ok(/store\.settings\.pno = 1/.test(off) && /auto === true\) \{ store\.settings\.pno = 1/.test(on) && /delete store\.settings\.pno/.test(on), 'pno: כיבוי/סירוב מסמנים, הדלקה ידנית מוחקת');
  }
  {
    // 27/10/2026: נגיעה בהתראה כשהדף פתוח — הודעה מ־sw.js פותחת את העבודה; עבודה שלא רצה — התראת השלב נסגרת
    const sa = fs.readFileSync(path.join(__dirname, '..', 'studio-app.js'), 'utf8');
    ok(/serviceWorker\.addEventListener\('message'/.test(sa) && /d\.snb === 'studioJob'/.test(sa) && /openStudio\(\{ standalone: sa, job: d\.j/.test(sa), 'studio-app: הודעת studioJob → העבודה');
    ok(/if \(!shadeGone\.has\(rec\.id\)\) \{ shadeGone\.add\(rec\.id\); shadeEnd\(rec\.id\); \}/.test(src) && /n\.data && n\.data\.k === 'stage'\) n\.close\(\)/.test(src), 'עבודה שהסתיימה/בוטלה — התראת השלב נסגרת (רק היא)');
  }
  {
    // 27/10/2026: הווילון כל שנייה (טיימר משלו), עם שורת ההעלאה — מגה־בייטים ומהירות; גם בהעלאה ברקע
    ok(/const SHADE_MS = 1000/.test(src) && /shadeT = setInterval\(\(\) => \{ if \(root\) shadeSync\(\); \}, SHADE_MS\)/.test(src), 'הווילון מתעדכן כל שנייה');
    const ul = src.slice(src.indexOf('function shadeUpLine('), src.indexOf('function shadeSync('));
    ok(/T\('studioShadeUpOf'/.test(ul) && /T\('studioPerSec'/.test(ul) && /run\.phase !== 'video'/.test(ul), 'שורת ההעלאה: עלו X מתוך Y · מהירות');
    ok(!/if \(run && run\.bg\) continue;/.test(src) && /\(ul \? '\\n' \+ ul : ''\)/.test(src), 'גם בהעלאה ברקע — השורה בהתראה שלנו');
  }
  ok(/function shadeUpBlock\(rec, run, now, curSt\)/.test(src) && /shadeBar\(up, uiLang\(\)\) \+ '  ' \+ Math\.round\(up \* 100\) \+ '%/.test(src) && /shadeUpBlock\(rec, run, now, s\.id\)/.test(src), 'פס ההעלאה — אותו עיצוב כמו פס השלבים');
  ok(/shadeDir\(\) \+ T\('studioShadeUp'\)/.test(src) && /\\u200F/.test(src) && (app.match(/studioShadeUp: "/g) || []).length === 2 && (app.match(/studioShadeUpOf: "/g) || []).length === 2, 'חלק ההעלאה: שם משלו, כל שורה מימין לשמאל (RLM), בשתי השפות');
  ok(/a: shadeIso\(fmtSize\(sent\)\), b: shadeIso\(fmtSize\(size\)\)/.test(src) && /v: shadeIso\(fmtSize\(r\.v\)\)/.test(src) && /'\\u2066' \+ x \+ '\\u2069'/.test(src), 'כל גודל ומהירות מבודדים — הסדר מימין לשמאל נשמר');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + e.message); process.exit(1); });
