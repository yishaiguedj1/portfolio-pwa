'use strict';
/* סבב הייעול שהמשתמש אישר (21/10/2026 ערב) — מספרים מהרשימה בצ'אט, הפירוט בתוכנית־שיפור־מתמיד.md סעיף 8 */
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..');
let n = 0;
const ok = (c, m) => { n++; if (!c) { console.error('FAIL - ' + m); process.exit(1); } console.log('ok - ' + m); };
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');

// 12: נפילה בדקות הראשונות אחרי הלקיחה — ממשיכים אחרי 15 שנ׳
{
  const now = 1e12;
  ok(S.recoverWait({ claimed: now - 60e3 }, now) === S.EARLY_WAIT, '12: נפילה דקה אחרי הלקיחה — 15 שנ׳');
  ok(S.recoverWait({ claimed: now - 30 * 60e3 }, now) === S.RECOVER_WAIT, '12: נפילה באמצע העבודה — 3 דק׳ כמו קודם');
  ok(S.recoverWait({}, now) === S.RECOVER_WAIT, '12: בלי זמן לקיחה — 3 דק׳');
  ok(S.recoverWait({ claimed: now - 60e3, ck: [{ s: 'asr', at: now - 10e3 }] }, now) === S.RECOVER_WAIT, '12: נשמרה נקודה בהפעלה הזו — 3 דק׳ (העבודה התקדמה)');
  ok(S.recoverWait({ claimed: now - 60e3, ck: [{ s: 'asr', at: now - 3600e3 }] }, now) === S.EARLY_WAIT, '12: נקודה מהפעלה קודמת בלבד — 15 שנ׳');
  ok(!/up\.rw = now \+ S\.RECOVER_WAIT/.test(api) && (api.match(/up\.rw = now \+ S\.recoverWait\(job, now\)/g) || []).length === 2, '12: שני המקומות שקובעים חלון התאוששות — דרך recoverWait');
}

// 9: חלון עדכון — אחרי קידום תמונת עובד, עובד בגרסה הקודמת לא מקבל עבודה חדשה 20 דק׳
(async () => {
  const A = require(path.join(root, 'ibkr-proxy/api/studio.js'));
  const now = 2e12, sha = 'abcdef1234567890abcdef1234567890abcdef12';
  const dep = (t) => ({ workerRelease: async () => ({ sha, t }) });
  ok(await A._updatePending(dep(now - 5 * 60e3), '000000000000', now) === true, '9: קידום לפני 5 דק׳, העובד בגרסה אחרת — חלון עדכון');
  ok(await A._updatePending(dep(now - 5 * 60e3), sha.slice(0, 12), now) === false, '9: העובד כבר בגרסה החדשה — עבודה כרגיל');
  ok(await A._updatePending(dep(now - 25 * 60e3), '000000000000', now) === false, '9: אחרי 20 דק׳ — עבודה כרגיל גם בלי עדכון (לא תוקעים את התור)');
  ok(await A._updatePending(dep(now - 60e3), 'dev', now) === false, '9: עובד בלי גרסה (dev) — בלי חלון');
  const A2 = require(path.join(root, 'ibkr-proxy/api/studio.js')); A2._reset();
  ok(await A2._updatePending({ fetch: async () => { throw new Error('net'); } }, '000000000000', now) === false, '9: GitHub לא עונה — בלי חלון');
  ok(/if \(await updatePending\(deps, hb\.v, now\)/.test(api) && api.indexOf('updatePending(deps, hb.v') < api.indexOf("query(deps, 'studioJobs', { state: 'queued', eng: 'api', sid: '' }"), '9: הבדיקה לפני חיפוש עבודה בתור');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})();
// 18: צפייה עד הסוף בלי עריכה = אות חיובי
{
  const I = require(path.join(root, 'ibkr-proxy/lib/learnimpact.js'));
  const m = I.IMP_METRICS.find((x) => x[0] === 'wok');
  const done = { st: 'done', k: 'tr', dur: 600 };
  ok(m && m[5](Object.assign({ ux: { pl: { n: 1, cov: 0.95 } } }, done)) === 1 && m[5](Object.assign({ ux: { pl: { n: 1, cov: 0.95 }, e: { s: 1 } } }, done)) === 0
    && m[5](Object.assign({ ux: { pl: { n: 1, cov: 0.3 } } }, done)) === null, '18: wok — נצפה עד הסוף: 1 בלי עריכה, 0 עם; לא נצפה — לא נספר');
}
// 15: ריצת מבחן — במרכז הניהול, הציון מהעובד (goldscore.py = goldCompare; הבדיקה המלאה ב־gold-score.test.js)
{
  const fs = require('fs');
  const adm = fs.readFileSync(path.join(root, 'admin-app.js'), 'utf8'), job = fs.readFileSync(path.join(root, 'translator/job.py'), 'utf8');
  ok(/page\('gold'/.test(adm) && /api\('goldRun', Object\.assign\(\{ ok: true, src: D\.gSrc, modes: sel \}/.test(adm) && /askConfirm\(fmt\(t\('admGoldQ'\)/.test(adm), '15: מסך ריצת המבחן — אומדן ואישור לפני goldRun עם המצבים');
  ok(/gq = gold_score\(ctx\)/.test(job) && /gq=gq\)/.test(job) && fs.existsSync(path.join(root, 'translator/goldscore.py')), '15: העובד מחשב ושולח את הציון בדיווח האחרון');
}
// 16: תזכורת לריצת מבחן — אחרי שינוי בקוד/בהנחיות, או אחרי שבוע. רק תזכורת, שום דבר לא רץ לבד
{
  const AO = require(path.join(root, 'ibkr-proxy/lib/adminov.js'));
  const D = 86400e3, now = 2e12;
  const gold = { kind: 'tr', state: 'done', gd: { r: 'x' }, created: now - 30 * D, ev: 'aaaaaaaaaaaa' };
  const run = (o) => Object.assign({ kind: 'tr', state: 'done', gs: 'jG', created: now - 2 * D, ev: 'aaaaaaaaaaaa', pv: { tl: '11111111' } }, o);
  const job = (o) => Object.assign({ kind: 'tr', state: 'done', created: now - D, ev: 'aaaaaaaaaaaa', pv: { tl: '11111111' } }, o);
  ok(AO.goldDue([job({})], now) === null, '16: בלי עבודת זהב — בלי תזכורת');
  ok(AO.goldDue([gold], now).r === 'wk', '16: עבודת זהב בלי אף ריצה — תזכורת');
  ok(AO.goldDue([gold, run({}), job({})], now) === null, '16: אותה גרסה ופחות משבוע — שקט');
  ok(AO.goldDue([gold, run({}), job({ pv: { tl: '22222222' } })], now).r === 'ver', '16: הנחיות חדשות מאז הריצה — תזכורת');
  ok(AO.goldDue([gold, run({}), job({ ev: 'bbbbbbbbbbbb' })], now).r === 'ver', '16: קוד חדש בעובד מאז הריצה — תזכורת');
  ok(AO.goldDue([gold, run({ created: now - 9 * D }), job({ created: now - 10 * D })], now).r === 'wk', '16: עבר שבוע — תזכורת');
  ok(AO.goldDue([gold, run({ state: 'running' }), job({ ev: 'bbbbbbbbbbbb' })], now) === null, '16: ריצה פתוחה — לא מזכירים');
  const ov = AO.overview({ now, jobs: [gold] });
  ok(ov.items.some((x) => x.k === 'gold_due'), '16: מופיע ב"מחכה לך"');
}
// 21/10/2026 (בקשת המשתמש): המקור באנגלית ליד כל כתובית — בבדיקה לפני הצריבה ובעורך
{
  const fs = require('fs');
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const g = S.normGate({ k: 'r', cnt: 2, cues: [{ t: '0:05', x: 'שלום', e: 'Hello <b>there</b>' }, { t: '0:09', x: 'תודה' }] }, 'g000000000001');
  ok(g.n.cues[0].e === 'Hello <b>there</b>' && !('e' in g.n.cues[1]), 'gate: e = המקור (מוצג רק כטקסט); בלי מקור — בלי e');
  const sj = fs.readFileSync(path.join(root, 'studio.js'), 'utf8'), ss = fs.readFileSync(path.join(root, 'studiosubs.js'), 'utf8'), css = fs.readFileSync(path.join(root, 'studio.css'), 'utf8');
  ok(/if \(cu\.e\) tx\.append\(srcLine\(cu\.e\)\)/.test(sj) && (ss.match(/srcLine\(c\.en, T\('studioSrcEn'\)\)/g) || []).length === 2 && /\.st-src \{/.test(css),
    'המקור מוצג בבדיקה לפני הצריבה ובעורך (שורה סגורה ופתוחה)');
}
