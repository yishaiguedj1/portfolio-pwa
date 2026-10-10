// v377: סטודיו התרגום — מגדל הפיקוח 2.0, סבב "יעדי שירות, ערך ותחזית" (ServiceNow: SLA · Measure · Process Mining):
// יעד זמן (ההערכה שראית בהתחלה) ויעד תקציב ("הרגיל" שלך) לכל עבודה, סימונים ב־50%/75%, "בסיכון" כשמפגרת, הפרה = התראה P3;
// השעון עוצר כשמחכים לך / לסרטון / בין עצירה ל"המשך". ערך החודש מול מתרגם אנושי, עלות לדקה, תחזית, צוואר בקבוק ומסלולים חריגים.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v377).
// הרצה: node tests/studio-v377.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון ---------- */
  const L = require(path.join(root, 'ibkr-proxy/lib/studiosla.js'));
  const net = await import(path.join(root, 'studionet.js'));
  // יעד הזמן = אותה טבלה של מסך ההתקדמות בטלפון (stageEstimates)
  for (const [mode, min] of Object.entries(L.MODE_MIN)) {
    const a = L.stageTargets(mode, 4620), b = net.stageEstimates(min, 4620);
    ok(L.STAGES.every((s) => a[s] === b[s]), 'יעד הזמן לכל שלב = מסך ההתקדמות (' + mode + ')');
  }
  const st = await import(path.join(root, 'studio.js'));
  ok(st.MODES.every((m) => L.MODE_MIN[m.id] === m.min), 'MODE_MIN בשרתון = min של MODES בטלפון');
  ok(L.MARKS.join() === '0.5,0.75' && L.HP_DEF === 5, 'סימונים ב־50%/75%; מחיר מתרגם ברירת מחדל $5 (החלטה 5)');
  const ops = require(path.join(root, 'ibkr-proxy/lib/studioops.js'));
  ok(ops.KINDS['claude:sla_time'] === 3 && ops.KINDS['claude:sla_cost'] === 3, 'הפרה = P3 (בסיכום היומי)');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/if \(!job\.c0\) patch\.c0 = now;/.test(api) && /if \(job\.kind === 'tr' && !job\.tg\)/.test(api), 'היעדים והשעון נקבעים פעם אחת, בלקיחה');
  ok(/body\.wv === true/.test(api) && /\(body\.st \|\| body\.done === true \|\| body\.fail === true\)/.test(api), 'המתנה לסרטון: אירוע בודד לא מסיים אותה');
  ok(/patch\.pz = \(job\.pz \|\| 0\) \+ Math\.max\(0, now - job\.ended\)/.test(api), '"המשך": הזמן מאז העצירה לא נספר');
  ok(/va: L\.valueView\(list, now, ic \? ic\.hpc : 0\)/.test(api) && /op === 'price'/.test(api), 'הערך מגיע עם רשימת העבודות; המחיר נשמר ב־op אחד');
  ok(/sla: SLA\.slaView\(job, now\)/.test(read('ibkr-proxy/lib/studio.js')) && /'tg'(, 'sc')?(, 'et', 'ep')?(, 'wp')?\]/.test(read('ibkr-proxy/lib/studio.js')), 'publicJob מחזיר את היעדים');

  /* ---------- 2. העובד ---------- */
  ok(/ctx\.report\(stage, None, msg, force=True, wv=True\)/.test(read('translator/job.py')), 'העובד: מחכים לסרטון — wv (השעון עוצר)');

  /* ---------- 3. הטלפון ---------- */
  const s1 = st.normSla({ t: { tg: 4000, el: 900, pz: 120, f: 0.23, lv: 'ok', paused: true }, pf: 0.3, u: { tg: 9.2, sp: 1.1, f: 0.12, lv: 'ok' } });
  ok(s1 && s1.t.paused && s1.u.tg === 9.2, 'normSla: תקין');
  ok(st.normSla({ t: { tg: 1, el: 1, f: 1, lv: 'evil' } }) === null && st.normSla({ t: { tg: 0, el: 1, f: 1, lv: 'ok' } }) === null && st.normSla('x') === null
    && !st.normSla({ t: { tg: 1, el: 1, f: 1, lv: 'ok' }, u: { tg: 1, sp: -1, f: 1, lv: 'ok' } }).u, 'normSla: רמה לא מוכרת / בלי יעד — נזרק');
  const v = st.normValue({ m: '2026-10', n: 2, min: 60, usd: 3, cpm: 0.1, hp: 5, hpd: true, saved: 147, fc: 4.89, bn: { s: 'tl', sh: 0.97, x: 1.7, n: 1 }, ab: { n: 3, rs: 1, qa: 1 } });
  ok(v && v.bn.s === 'tl' && v.ab.rs === 1 && v.hp === 5, 'normValue: תקין');
  ok(st.normValue({ m: 'evil' }) === null && !st.normValue({ m: '2026-10', bn: { s: 'evil', sh: 1 } }).bn, 'normValue: חודש / שלב לא מוכר — נזרק');
  ok(st.chainFor('value').map((x) => x.v).join() === 'home,settings,tower,value', 'רענון בדף הערך — חוזר דרך המגדל');
  const sj = read('studio.js');
  ok(/if \(rec\.srv && rec\.srv\.sla\) p\.append\(\.\.\.slaCard\(rec\.srv\.sla\)\)/.test(sj) && /h\('em', 'm50'\), h\('em', 'm75'\)/.test(sj), 'דף העבודה: כרטיס יעדים עם סימונים ב־50%/75%');
  ok(/p\.append\(\.\.\.valueSection\(\)\)/.test(sj) && /function pageValue\(p\)/.test(sj) && /else if \(ui\.view === 'value'\) pageValue\(p\)/.test(sj), 'מגדל: ערך ועלות → דף');
  ok(/net\.api\('price', \{ hp \}\)/.test(sj) && (sj.match(/setPrice\(/g) || []).length === 2, 'המחיר נקבע במקום אחד (דף הערך)');
  ok(/case 'claude:sla_time'/.test(sj) && /case 'claude:sla_cost'/.test(sj), 'תוויות להתראות ההפרה');
  const app = read('app.js');
  for (const k of ['studioSlaT', 'studioSlaTime', 'studioSlaCost', 'studioSlaOf', 'studioSlaOfU', 'studioSlaOk', 'studioSlaHalf', 'studioSlaRisk', 'studioSlaOver', 'studioSlaMet',
    'studioSlaPaused', 'studioSlaPz', 'studioAlSlaTime', 'studioAlSlaCost', 'studioVaSec', 'studioVaT', 'studioVaMinS', 'studioVaNone', 'studioVaMonth',
    'studioVaMin', 'studioVaCpm', 'studioVaSavedK', 'studioVaFc', 'studioVaFcNone', 'studioVaBnT', 'studioVaBn', 'studioVaBnOk', 'studioVaAbT', 'studioVaAbRs', 'studioVaAbQa',
    'studioVaPriceT', 'studioVaPerMin', 'studioVaPriceNote'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/const APP_VERSION = '(v\d+)'/) || [])[1];
  const sw = (read('sw.js').match(/CACHE_NAME = '[^']*-(v\d+)'/) || [])[1];
  ok(+ver.slice(1) >= 377 && swVersionOk(ver, sw), 'APP_VERSION ≥ v377 ו־sw.js תואם או גרסה אחת אחורה');
  console.log('\nכל ' + n + ' הבדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
