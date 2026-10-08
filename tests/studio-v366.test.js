// v366: סטודיו התרגום — מסלול התיקונים: "הצעות לאישור" (ברירת המחדל — כמו Supervised ב־ServiceNow ומאמר ידע שעובר בדיקה)
// או "Claude מחליט לבד". במסלול ההצעות התיקון של Claude משמש רק את העבודה שבה נכתב, ולעבודות הבאות עובר רק אחרי "לשמור".
// הבדיקות המלאות: ibkr-proxy/tests/run.js (השרתון), translator/tests/test_worker.py (test_fix_mode).
// הרצה: node tests/studio-v366.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון — טהור ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const FP = 'a1b2c3d4e5f6';
  const base = S.fbStop([], { fp: FP, why: 'loop' }, 'tl', 5);
  ok(S.normFixMode() === 'suggest' && S.normFixMode('auto') === 'auto' && S.normFixMode('x') === 'suggest' && S.FIX_MODES.join() === 'suggest,auto',
    'ברירת המחדל — "הצעות לאישור"; רק שני מסלולים');
  let fb = S.fbFix(base, FP, 'מריצים פעם אחת', 6);
  ok(fb[0].fix === '' && fb[0].px === 'מריצים פעם אחת' && S.fbForWorker(fb).length === 0, 'הצעות: התיקון נשמר כהצעה, והעובד לא מקבל אותו');
  ok(S.fbView(fb)[0].px === 'מריצים פעם אחת', 'הטלפון רואה את ההצעה');
  ok(S.fbDecide(fb, FP, true, 7)[0].fix === 'מריצים פעם אחת' && !S.fbDecide(fb, FP, true, 7)[0].px, '"לשמור" — ההצעה הופכת לתיקון');
  ok(S.fbDecide(fb, FP, false, 7)[0].fix === '' && !S.fbDecide(fb, FP, false, 7)[0].px, '"לא" — ההצעה נמחקת');
  ok(S.fbDecide(base, FP, true, 7) === null && S.fbDecide(fb, 'ffffffffffff', true, 7) === null, 'בלי הצעה / טביעה לא מוכרת — אין מה להחליט');
  ok(S.fbFix(base, FP, 'מריצים פעם אחת', 6, 'auto')[0].fix === 'מריצים פעם אחת', 'עצמאי: התיקון נשמר מיד');
  ok(S.workerJob({ id: 'j', kind: 'tr' }, null, [], 'auto').fm === 'auto' && S.workerJob({ id: 'j', kind: 'tr' }).fm === 'suggest', 'העובד יודע באיזה מסלול');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/op === 'fixMode'/.test(api) && /op === 'fbDecide'/.test(api) && /fm: S\.normFixMode\(st\.fm\)/.test(api) && /body\.fix\.t, now, stats\.fm\)/.test(api),
    'השרתון: בחירת מסלול, החלטה על הצעה, המסלול ב־status, והדיווח לפי המסלול');

  /* ---------- 2. העובד ---------- */
  const job = read('translator/job.py');
  ok(/'fm': 'auto' if job\.get\('fm'\) == 'auto' else 'suggest'/.test(job) && /נשלח למשתמש כהצעה/.test(job), 'job.py: שומר את המסלול, ואומר ל־Claude שהתיקון ממתין לאישור');

  /* ---------- 3. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const v = st.normFb([{ fp: FP, why: 'loop', st: 'tl', n: 1, fix: '', px: 'הצעה'.repeat(60) }]);
  ok(v[0].px.length === 160 && st.normFb([{ fp: FP, why: 'loop', px: 5 }])[0].px === '', 'normFb: ההצעה — רק מחרוזת, עד 160');
  const sj = read('studio.js');
  ok(/rowRadio\(\{ label: T\('studioFmSug'\)/.test(sj) && /rowRadio\(\{ label: T\('studioFmAuto'\)/.test(sj), 'מסך המגדל: שתי אפשרויות בחירה');
  ok(/ui\.fm = j\.fm === 'auto' \? 'auto' : 'suggest'/.test(sj), 'ברירת המחדל בטלפון — הצעות');
  ok(/const pt = h\('small', null, e\.px\)/.test(sj) && !/innerHTML[^;]*px/.test(sj), 'ההצעה מוצגת כטקסט בלבד');
  ok(/net\.api\('fixMode'/.test(sj) && /net\.api\('fbDecide'/.test(sj), 'הבחירה וההחלטה נשמרות בשרתון');
  const app = read('app.js');
  for (const k of ['studioFmT', 'studioFmSug', 'studioFmSugS', 'studioFmAuto', 'studioFmAutoS', 'studioFbPropL', 'studioFbKeep', 'studioFbDrop', 'studioFbKept', 'studioFbDropped'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');
  const css = read('studio.css');
  ok(/\.st-fbp \{/.test(css) && /\.st-mini \{/.test(css), 'עיצוב: ההצעה וכפתורי "לשמור / לא"');

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 366 && swVersionOk(ver, sw), 'APP_VERSION ≥ v366 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
