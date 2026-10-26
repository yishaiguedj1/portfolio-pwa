// 25/10/2026 (עבודה אמיתית מאייפון: פרק שחיכה שעתיים ל"התחל" שלא הגיע, ולא יכול היה להתחיל ממחשב):
// 1. START_RETRY זהה בטלפון ובשרתון. 2. עבודה מקישור נשלחת עם start:true (השרתון מתחיל ביצירה).
// 3. עבודה מקישור / מ־Drive ממכשיר אחר — בלי העלאה מהטלפון הזה, עם קוד הסירוב מהשרתון.
// 4. הניסיון החוזר בטלפון — רק לסירוב חולף, ורק אחרי START_GAP. הרצה: node tests/studio-start.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');

/* 1 */
const phoneRetry = JSON.parse(st.match(/export const START_RETRY = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
ok(JSON.stringify(phoneRetry) === JSON.stringify(S.START_RETRY), 'START_RETRY זהה בטלפון ובשרתון');
ok(!S.START_RETRY.includes('halted') && !S.START_RETRY.includes('rule_mode') && !S.START_RETRY.includes('loop'), 'סירוב שצריך אותך (מתג החירום, החוקים, לולאה) — לא מתחיל לבד');

/* 2 */
ok(/net\.api\('create', \{ spec, start: true \}\)/.test(st), 'עבודה מקישור נשלחת עם start:true');
ok(/if \(j\.start\) startDone\(rec, j\.start\)/.test(st) && /if \(!j\.start\) startRun\(rec\.id, null\)/.test(st), 'התשובה של ההתחלה נשמרת; שרתון ישן בלי start — "התחל" כמו קודם');
ok(/body\.start === true && spec\.src === 'url'/.test(api) && /const sa = recent \? await startAll\(deps, now, recent\)/.test(api), 'השרתון: מתחיל ביצירה, ומהבדיקה המתוזמנת');

/* 3 + 4 — הפונקציות עצמן, עם normJob שמחזיר את מה שקיבל */
const grab = (name) => { const a = st.indexOf('export function ' + name + '('); return st.slice(a, st.indexOf('\n}\n', a) + 2).replace(/^export /, ''); };
// eslint-disable-next-line no-new-func
const lib = new Function('normJob', 'START_RETRY', 'START_GAP', grab('recFromSrv') + grab('startRetryDue') + 'return { recFromSrv, startRetryDue };')((x) => x, phoneRetry, 2 * 60e3);
let r = lib.recFromSrv({ id: 'j1', state: 'new', sw: 'flag_off', spec: { src: 'url' }, files: {} });
ok(r.up.link === true && r.up.a.done && r.up.v.done && r.up.noAudio === 'link' && r.up.wait === 'flag_off' && r.up.wt > 0,
  'עבודה מקישור ממכשיר אחר — בלי העלאה מכאן, עם קוד הסירוב מהשרתון');
r = lib.recFromSrv({ id: 'j2', state: 'new', spec: {}, files: { v: { id: 'x', ext: true } } });
ok(r.up.ext === true && r.up.extReg === true && r.up.v.done && r.up.a.done && !r.up.link, 'סרטון מ־Drive ממכשיר אחר — רשום, בלי העלאה');
r = lib.recFromSrv({ id: 'j3', state: 'queued', sw: 'flag_off', spec: {}, files: { a: { id: 'a' } } });
ok(r.up.wait === '' && r.up.a.done && !r.up.v.done && !r.up.link, 'עבודה רגילה שכבר התחילה — בלי המתנה, הסרטון עוד לא עלה');
const now = 1e12;
ok(lib.startRetryDue({ wait: 'flag_off', wt: now - 3 * 60e3 }, now) === true, 'סירוב חולף, עברו 3 דק׳ — מנסים שוב');
ok(lib.startRetryDue({ wait: 'flag_off', wt: now - 30e3 }, now) === false, 'סירוב חולף, עברו 30 שנ׳ — עוד לא');
ok(lib.startRetryDue({ wait: 'halted', wt: 0 }, now) === false && lib.startRetryDue({ wait: 'rule_mode', wt: 0 }, now) === false, 'מתג החירום / החוקים — לא לבד');
ok(lib.startRetryDue({ wait: 'major', wt: 0 }, now) === false, 'תקלה רחבה — בנפרד (כשהיא עוברת)');
ok(lib.startRetryDue({ wait: 'maint', wt: 0, started: now }, now) === false, 'עבודה שכבר התחילה — לא');

console.log('\nכל ' + n + ' הבדיקות עברו ✓');
