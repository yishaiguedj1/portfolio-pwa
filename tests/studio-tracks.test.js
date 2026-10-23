// 23/10/2026: בחירת קול וכתוביות מהנגן — אוטומטי כברירת מחדל, ידני כשבוחרים (ונשמר)
const fs = require('fs'), path = require('path');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
(async () => {
  const P = await import('../studioplay.js');
  ok(JSON.stringify(P.normTrackPref(null)) === '{"a":"","cc":""}' && JSON.stringify(P.normTrackPref({ a: 'heb', cc: 'both' })) === '{"a":"heb","cc":"both"}'
    && JSON.stringify(P.normTrackPref({ a: 'Hebrew', cc: 'x' })) === '{"a":"","cc":""}', 'העדפה: שפה רק כקוד, כתוביות רק מהרשימה; ריק = אוטומטי');
  const A = [{ l: 'eng' }, { l: 'heb', d: 1 }, { l: 'fra' }];
  ok(P.pickAudio(A, '') === 1 && P.pickAudio(A, 'fra') === 2 && P.pickAudio(A, 'deu') === 1 && P.pickAudio([{}, {}], '') === 0 && P.pickAudio([], 'eng') === -1,
    'קול: השפה שנבחרה, אחרת ברירת המחדל של הקובץ, אחרת הראשונה');
  ok(P.autoCc('eng', true, false) === 'he' && P.autoCc('heb', true, false) === 'off' && P.autoCc('he', true, false) === 'off' && P.autoCc('', true, false) === 'he'
    && P.autoCc('eng', false, false) === 'off' && P.autoCc('eng', true, true) === 'off', 'כתוביות אוטומטיות: התרגום, וכבויות מעל קול בעברית / בלי כתוביות / בצרוב');
  ok(P.resolveCc('', 'he', true, false) === 'he' && P.resolveCc('off', 'he', true, false) === 'off' && P.resolveCc('en', 'he', false, false) === 'he'
    && P.resolveCc('both', 'off', false, false) === 'he' && P.resolveCc('both', 'he', true, false) === 'both' && P.resolveCc('he', 'he', true, true) === 'off',
    'הבחירה בפועל: ידנית כשאפשר; אנגלית בלי מקור → אוטומטי; צרוב → כבויות');
  ok(P.nextCc('he', true) === 'en' && P.nextCc('en', true) === 'off' && P.nextCc('both', true) === 'off' && P.nextCc('off', true) === 'he', 'כפתור הכתוביות — מחזור כמו קודם, ו"שתיהן" → כבויות');
  const st = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
  ok(/s\.pt = normTrackPref\(o\.pt\)/.test(st) && /pref: store\.settings\.pt, onPref: ptSave/.test(st), 'ההעדפה נשמרת בהגדרות הסטודיו ועוברת לנגן ולעורך');
  const sp = fs.readFileSync(path.join(__dirname, '..', 'studioplay.js'), 'utf8');
  ok(/page === 't'/.test(sp) && /savePref\(\{ cc: '' \}\)/.test(sp) && /savePref\(\{ a: '' \}\)/.test(sp), 'בתפריט: "אוטומטי" מחזיר לברירת המחדל בשני העמודים');
  console.log(`studio-tracks: ${pass} עברו, ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})();
