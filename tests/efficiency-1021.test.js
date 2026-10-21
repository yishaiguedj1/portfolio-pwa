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
