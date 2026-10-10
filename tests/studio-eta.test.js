// צפי זמנים נלמד (10/10/2026): העבודה האמיתית הראשונה — 5 דק׳ סרטון לקחו 13.5 דק׳ מול "כ־7" מהטבלה הישנה.
// השרתון לומד a + b·דקות לכל שלב (ibkr-proxy/lib/studioeta.js); הטלפון מציג מהתוכנית — אותו חישוב בשני הצדדים.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const E = require('../ibkr-proxy/lib/studioeta.js');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

(async () => {
  const N = await import('../studionet.js');
  // 1. אותה תוכנית בטלפון ובשרתון (planFrom = planOf), לכל מצב ואורך
  const model = E.etaModel([], 'a', 0);
  for (const [mode, min] of Object.entries(E.MODE_MIN)) {
    for (const d of [60, 300, 1800, 7200]) {
      const a = E.etaPlan(model, mode, d), b = N.planFrom(model, min, d);
      assert.deepStrictEqual(b.s, a.s, mode + ' ' + d);
      assert.strictEqual(b.t, a.t);
    }
  }
  ok(true, 'התוכנית בטלפון (planFrom) זהה לשרתון (etaPlan) — כל המצבים והאורכים');
  ok(JSON.stringify(N.Q_DEF) === JSON.stringify(model.q), 'אי־הוודאות לפני 8 עבודות — אותו ערך בשני הצדדים (σ=0.35)');
  ok(N.planFrom(null, 105, 300) === null && N.planFrom({ st: { tr: [1, 1] } }, 105, 300) === null, 'מודל חסר / חלקי — הטלפון נופל לטבלה הישנה');

  // 2. מודל ההתקדמות: ρ, טווח, צמצום לקראת הסוף
  const plan = E.etaPlan(model, 'opus-medium', 300);
  const now = 1e12;
  const fresh = N.progressModel({ state: 'running', prog: { st: 'tr', p: 0, stg: { tr: { s: now, e: 0 } } } }, plan.s, { done: true, took: 30 }, now, plan.q);
  ok(fresh.left80 > fresh.left && fresh.left90 > fresh.left80, 'בהתחלה: p50 < p80 < p90');
  ok(Math.abs(fresh.left80 / fresh.left - Math.exp(plan.q[1] * (1 - fresh.pct))) < 0.01, 'p80 = p50 × e^(q80·מה שנשאר)');
  // השלבים הראשונים לקחו פי 2 מהצפוי → שאר השלבים × ‎√2 (עומס בשרת משפיע על כולם)
  const slow = N.progressModel({ state: 'running', prog: { st: 'tl', p: 0, stg: {
    tr: { s: now - 2 * plan.s.tr * 1000 - 2 * plan.s.al * 1000, e: now - 2 * plan.s.al * 1000 }, al: { s: now - 2 * plan.s.al * 1000, e: now }, tl: { s: now, e: 0 } } } }, plan.s, { done: true }, now, plan.q);
  const rv = slow.stages.find((s) => s.id === 'rv');
  ok(Math.abs(slow.rho - 2) < 0.01 && rv.est === Math.round(plan.s.rv * Math.SQRT2), 'שלבים שהתעכבו → ההערכה לשאר גדלה ב־√ρ (לא ב־ρ — לא נבהלים)');
  const late = N.progressModel({ state: 'running', prog: { st: 'sv', p: 0.5, stg: Object.fromEntries(['tr', 'al', 'tl', 'rv', 'bn'].map((k) => [k, { s: now - 10e3, e: now - 5e3 }]).concat([['sv', { s: now - 5e3, e: 0 }]])) } }, plan.s, { done: true }, now, plan.q);
  ok(late.left90 / Math.max(1, late.left) < fresh.left90 / fresh.left, 'לקראת הסוף הטווח מצטמצם');
  const cur = N.progressModel({ state: 'running', prog: { st: 'al', p: 0.02, stg: { tr: { s: now - 200e3, e: now - 100e3 }, al: { s: now - 100e3, e: 0 } } } }, plan.s, { done: true }, now, plan.q);
  ok(cur.stages.find((s) => s.id === 'al').left > 100, 'קצב מוקדם (2%) לא מכריע — ההערכה עדיין שולטת (Raymond Chen: ההערכות המוקדמות הגרועות ביותר)');
  ok(N.progressModel({ state: 'done', prog: {} }, plan.s, { done: true }, now, plan.q).left80 === 0, 'עבודה שהסתיימה — 0');

  // 3. הטלפון: מאיפה התוכנית, שעה יציבה, טווח לפני 8 עבודות, הסבר
  const st = read('studio.js'), app = read('app.js');
  ok(/if \(rec\.srv && rec\.srv\.ep\) return rec\.srv\.ep;/.test(st) && /planFrom\(md, modeById\(rec\.spec\.mode\)\.min/.test(st) && /stageEstimates\(modeById/.test(st), 'התוכנית: מהשרתון (נקבעה בלקיחה) → מהמודל → הטבלה הישנה');
  ok(/raw < prev \|\| raw - prev > Math\.max\(60e3, 0\.1 \* leftSec \* 1000\)/.test(st), 'שעת הסיום: יורדת מיד, עולה רק בפער של דקה / 10%');
  ok(/m\.n >= 8 \|\| m\.left90 - m\.left < 120 \? T\('studioReadyAt'/.test(st) && /T\('studioReadyRange'/.test(st), 'לפני 8 עבודות — טווח ("בין … ל־…"), אחר כך שעה אחת');
  for (const k of ['studioReadyRange', 'studioEtaK', 'studioEtaN', 'studioEtaPrior']) ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);

  // 4. השרתון: היעד = p90, דגימה בסיום, מודל ב־status, הקובץ בלי תלויות
  const api = read('ibkr-proxy/api/studio.js');
  ok(/tg\.t = ETA\.etaTarget\(ep\)/.test(api) && /patch\.ep = ep/.test(api), 'הלקיחה: תוכנית לעבודה + יעד זמן = p90 + דקה');
  ok(/ETA\.etaSample\(Object\.assign\(\{\}, job, up\), now\)/.test(api) && /eta: ETA\.etaView\(st\.et, now\)/.test(api), 'סוף העבודה מלמד; status מחזיר את המודל');
  ok(!/require\(/.test(read('ibkr-proxy/lib/studioeta.js')), 'studioeta.js טהור — בלי require');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + e.message); process.exit(1); });
