/* שלב 6 בתוכנית שלוש האפליקציות (15/10/2026): הנתונים של Academy עוברים ממסמך התיק (users/{uid}.lib)
   למסמך משלה (academyUsers/{uid}.lib) — ibkr-proxy/lib/libmove.js (Firestore מדומה), הספרייה, auth.js והכללים. */
'use strict';
const fs = require('fs');
const path = require('path');
const LMV = require('../ibkr-proxy/lib/libmove.js');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0, bad = 0;
const ok = (c, name) => { n++; if (c) console.log('ok - ' + name); else { bad++; console.log('נכשל: ' + name); } };

/* Firestore מדומה ב־REST: מסמכים לפי נתיב, GET (עם mask), PATCH עם updateMask (שדה במסכה בלי ערך = נמחק) */
function fakeFs(docs) {
  const calls = [];
  const fetch = async (url, o) => {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname.split('/documents/')[1]);
    calls.push((o.method || 'GET') + ' ' + p);
    if ((o.method || 'GET') === 'GET') {
      const d = docs[p];
      if (!d) return { status: 404, json: async () => ({}) };
      const mask = u.searchParams.getAll('mask.fieldPaths');
      const f = mask.length ? Object.fromEntries(Object.entries(d).filter(([k]) => mask.includes(k))) : d;
      return { status: 200, json: async () => ({ fields: JSON.parse(JSON.stringify(f)) }) };
    }
    const body = JSON.parse(o.body);
    const d = docs[p] = docs[p] || {};
    for (const k of u.searchParams.getAll('updateMask.fieldPaths')) { if (k in body.fields) d[k] = body.fields[k]; else delete d[k]; }
    return { status: 200, json: async () => ({}) };
  };
  return { fetch, calls, token: async () => 'tk' };
}
const I = (x) => ({ integerValue: String(x) });
const M = (o) => ({ mapValue: { fields: o } });
const S = (x) => ({ stringValue: x });
const DAY = 864e5;

(async () => {
  // העתקה: הישן עובר כמו שהוא, mv נרשם, המסמך הישן לא נמחק עדיין
  {
    const docs = { 'users/u12345678': { db: S('{"positions":[]}'), lib: M({ p: M({ k1: M({ c: S('cfi1') }) }), s: M({ th: S('auto') }) }) } };
    const F = fakeFs(docs);
    const r = await LMV.move({ fetch: F.fetch, token: F.token }, 'u12345678', 1000);
    const nd = docs['academyUsers/u12345678'];
    ok(r.st === 'copied' && r.had === true, 'העתקה: מסמך חדש נוצר');
    ok(nd && +nd.mv.integerValue === 1000 && nd.lib.mapValue.fields.p.mapValue.fields.k1.mapValue.fields.c.stringValue === 'cfi1' && nd.lib.mapValue.fields.s,
      'העתקה: ההתקדמות וההגדרות עברו כמו שהן, ו־mv = מתי');
    ok(docs['users/u12345678'].lib && docs['users/u12345678'].db, 'העתקה: המסמך הישן נשאר כגיבוי (והתיק לא נגע)');
    ok(!F.calls.some((c) => /^PATCH users\//.test(c)), 'העתקה: בלי כתיבה למסמך התיק');
    // אחרי פחות משבוע — כלום
    const r2 = await LMV.move({ fetch: F.fetch, token: F.token }, 'u12345678', 1000 + 6 * DAY);
    ok(r2.st === 'wait' && docs['users/u12345678'].lib, 'פחות משבוע: לא מוחקים');
    // אחרי שבוע — השדה lib נמחק מהתיק, dl נרשם, התיק עצמו נשאר
    const r3 = await LMV.move({ fetch: F.fetch, token: F.token }, 'u12345678', 1000 + 7 * DAY);
    ok(r3.st === 'deleted' && !('lib' in docs['users/u12345678']) && docs['users/u12345678'].db && +docs['academyUsers/u12345678'].dl.integerValue === 1000 + 7 * DAY,
      'שבוע אחרי: lib נמחק ממסמך התיק (רק השדה), dl נרשם');
    const before = F.calls.length;
    const r4 = await LMV.move({ fetch: F.fetch, token: F.token }, 'u12345678', 2000 + 8 * DAY);
    ok(r4.st === 'done' && F.calls.length - before === 1, 'אחרי המחיקה: קריאה אחת בלבד, בלי כתיבה');
  }
  // במסמך החדש כבר יש התקדמות (נכתבה לפני שההעברה הצליחה) — איחוד לפי ספר, החדש גובר
  {
    const docs = {
      'users/u22222222': { lib: M({ p: M({ a: M({ t: I(1) }), b: M({ t: I(1) }) }), s: M({ th: S('old') }) }) },
      'academyUsers/u22222222': { lib: M({ p: M({ b: M({ t: I(9) }) }) }) },
    };
    const F = fakeFs(docs);
    await LMV.move({ fetch: F.fetch, token: F.token }, 'u22222222', 5);
    const p = docs['academyUsers/u22222222'].lib.mapValue.fields.p.mapValue.fields;
    ok(+p.a.mapValue.fields.t.integerValue === 1 && +p.b.mapValue.fields.t.integerValue === 9, 'איחוד: ספר שרק בישן עובר, ספר שבשניהם — מהחדש');
    ok(docs['academyUsers/u22222222'].lib.mapValue.fields.s.mapValue.fields.th.stringValue === 'old', 'איחוד: הגדרות מהישן כשאין בחדש');
  }
  // משתמש בלי נתונים ישנים — mv בלבד, ואחרי שבוע dl בלי לגעת בתיק
  {
    const docs = { 'users/u33333333': { db: S('{}') } };
    const F = fakeFs(docs);
    const r = await LMV.move({ fetch: F.fetch, token: F.token }, 'u33333333', 1);
    ok(r.st === 'copied' && r.had === false && !docs['academyUsers/u33333333'].lib, 'בלי נתונים ישנים: רק mv');
    await LMV.move({ fetch: F.fetch, token: F.token }, 'u33333333', 1 + 8 * DAY);
    ok(docs['academyUsers/u33333333'].dl && !F.calls.some((c) => /^PATCH users\//.test(c)), 'בלי נתונים ישנים: dl בלי כתיבה לתיק');
  }
  // uid לא תקין — לא נוגעים בכלום
  {
    const F = fakeFs({});
    let err = '';
    try { await LMV.move({ fetch: F.fetch, token: F.token }, '../users/x', 1); } catch (e) { err = e.message; }
    ok(err === 'bad_uid' && !F.calls.length, 'uid לא תקין — נדחה בלי קריאה');
  }
  // Firestore נכשל — שגיאה (הטלפון ינסה שוב), בלי מחיקה
  {
    const docs = { 'users/u44444444': { lib: M({ p: M({}) }) }, 'academyUsers/u44444444': { mv: I(1), lib: M({}) } };
    const F = fakeFs(docs);
    const fetch = async (u, o) => ((o.method || 'GET') === 'PATCH' ? { status: 503, json: async () => ({}) } : F.fetch(u, o));
    let err = '';
    try { await LMV.move({ fetch, token: F.token }, 'u44444444', 10 * DAY); } catch (e) { err = e.message; }
    ok(err === 'fs_http_503' && docs['users/u44444444'].lib, 'תקלה בכתיבה — שגיאה, הנתונים הישנים נשארים');
  }

  // הטלפון: הספרייה כותבת וקוראת רק את המסמך של Academy, ומחכה להעברה
  const lib = read('library.js');
  ok(/collection\(LIB_COL\)/.test(lib) && /const LIB_COL = 'academyUsers'/.test(lib) && !/collection\('users'\)/.test(lib), 'library.js: רק academyUsers — לא מסמך התיק');
  ok(/async function pullCloud\(\) \{\n  if \(!userRef\(\)\) return 0;\n  await libMoved\(\);/.test(lib), 'library.js: הקריאה מהענן אחרי ההעברה');
  ok(/movedSettled !== curUid\(\)\) \{ libMoved\(\)\.then\(flushProgress\)/.test(lib), 'library.js: הכתיבה אחרי ההעברה');
  ok(/op: 'libMove'/.test(lib) && /localStorage\.setItem\(LS_LIBMV, uid\)/.test(lib), 'library.js: קורא לשרתון עד שההעברה הסתיימה, ואז לא שוב');
  // auth.js (Academy/Studio): לא קורא את מסמך התיק
  const auth = read('auth.js'), tpl = read('tools/auth.tpl.js');
  ok(!/collection\('users'\)/.test(auth) && !/collection\('users'\)/.test(tpl) && /collection\('academyUsers'\)/.test(tpl), 'auth.js: Academy בודקת את המסמך שלה, Studio בלי מסמך — לא את התיק');
  // השרתון: op libMove לכל משתמש מחובר (לא תלוי ברשימת הקוראים), לפני בדיקת הקוראים
  const api = read('ibkr-proxy/api/library.js');
  ok(api.indexOf("body.op === 'libMove'") > 0 && api.indexOf("body.op === 'libMove'") < api.indexOf('readerAllowed(user)'), 'השרתון: libMove לפני בדיקת הקוראים');
  // הכללים
  const rules = read('firestore/firestore.rules');
  ok(/match \/academyUsers\/\{uid\}/.test(rules) && /appIs\('academy'\)/.test(rules) && /appIs\('invest'\)/.test(rules) && /hasOnly\(\['lib'\]\)/.test(rules), 'הכללים: מסמך לכל אפליקציה, Academy כותבת רק lib');

  console.log('# ' + (n - bad) + ' בדיקות עברו' + (bad ? ', ' + bad + ' נכשלו' : ''));
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
