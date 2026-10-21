/* 21/10/2026 (מחקר הצפי השני, בקשת המשתמש: "הדיוק של הזמנים הכי מדויק שקיים, והגרפים בקצב של ההתקדמות האמיתית"):
   1. השלב הנוכחי — ההתפלגות המותנית (לוג־נורמלית): שלב שחורג לא נתקע על "פחות מדקה", מה שנשאר בו גדל.
   2. הפס זוחל בשלב בלי דיווח פנימי, ולא חוזר אחורה; "לוקח יותר מהרגיל" מעבר ל־p90.
   3. הצפי בשרתון: פיקסלים לשנייה (הצריבה), ליבות השרת ועבודות במקביל; הטלפון והשרתון מחשבים אותו דבר.
   4. עיגול כמו אצל המקצוענים (בלי דיוק מדומה) ושעת סיום יציבה. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let n = 0;
const ok = (c, name) => { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); };
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const N = await import(path.join(root, 'studionet.js'));
  const E = require(path.join(root, 'ibkr-proxy/lib/studioeta.js'));

  /* ---------- 1. ההתפלגות המותנית ---------- */
  ok(Math.abs(N.normInv(0.9) - 1.2815516) < 1e-6 && Math.abs(N.normCdf(1.2815516) - 0.9) < 1e-6 && Math.abs(N.normInv(0.5)) < 1e-9, 'Φ ו־Φ⁻¹ מדויקים');
  const cq = (t) => N.condQuantile(300, 0.45, t, 0.5);
  ok(Math.abs(cq(0) - 300) < 1e-6, 'לפני שהשלב התחיל — החציון = הצפי');
  ok([0, 100, 200, 300, 600, 1200].every((t, i, a) => i === 0 || cq(t) > cq(a[i - 1])), 'ככל שעובר זמן — המשך הצפוי של השלב גדל (לא קבוע)');
  ok(cq(600) - 600 > 60 && cq(1200) - 1200 > 60, 'שלב שחרג פי 2–4 — עדיין נשארות כמה דקות (לא "פחות מדקה" לנצח)');
  ok(N.condQuantile(300, 0.45, 100, 0.9) > cq(100), 'p90 המותנה מעל החציון המותנה');
  ok(N.creep(0, 300) === 0 && N.creep(300, 300) > 0.5 && N.creep(1e6, 300) < 0.9001 && N.creep(1e6, 300) > 0.89, 'זחילה: 0 בהתחלה, ~57% בזמן הצפוי, לא עוברת 90% של השלב');

  /* ---------- 2. מודל המסך ---------- */
  const est = { tr: 300, al: 300, tl: 300, rv: 300, bn: 300, sv: 60 };
  const now = 2e12;
  const at = (el, p, st = 'rv') => N.progressModel({ state: 'running', prog: { st, p, stg: Object.assign(
    { tr: { s: now - 9e6, e: now - 8.7e6 }, al: { s: now - 8.7e6, e: now - 8.4e6 }, tl: { s: now - 8.4e6, e: now - 8.1e6 } }, { [st]: { s: now - el * 1000, e: 0 } }) } },
  est, { done: true, took: 60 }, now);
  const pcts = [0, 60, 150, 300, 600, 1200].map((el) => at(el, 0).pct);
  ok(pcts.every((v, i) => i === 0 || v > pcts[i - 1]), 'שלב בלי דיווח (תשובה של Claude) — הטבעת ממשיכה לזוז עם הזמן');
  const rvRow = (el, p) => at(el, p).stages.find((s) => s.id === 'rv');
  ok(rvRow(600, 0).left > 60 && rvRow(1200, 0).left > 60, 'שלב שחרג — הזמן שנשאר בו לא קורס ל־10 שנ׳');
  ok(!rvRow(200, 0).over && rvRow(1200, 0).over, '"לוקח יותר מהרגיל" רק מעבר ל־p90 של השלב');
  ok(rvRow(150, 0.9).left < rvRow(150, 0.1).left, 'דיווח אמיתי (90%) גובר על הזחילה');
  ok(rvRow(150, 0.9).pv === 0.9, 'הפס = מה שדווח כשהוא מקדים את הזחילה');
  const fin = N.progressModel({ state: 'done', prog: {} }, est, { done: true }, now);
  ok(fin.pct === 1 && fin.left === 0, 'סיום — 100%, 0');
  {   // 21/10/2026: אחרי "המשך" — שלב מהסשן הקודם שאחרי השלב הנוכחי לא מסומן ✓
    const m = N.progressModel({ state: 'running', prog: { st: 'tr', p: 0.2, stg: { tr: { s: now - 60e3, e: 0 }, al: { s: now - 2e6, e: now - 1e6 } } } }, est, { done: true, took: 60 }, now);
    ok(m.stages.find((s) => s.id === 'al').state !== 'done' && m.stages.find((s) => s.id === 'tr').state === 'now', 'אחרי "המשך": היישור הישן לא ✓ בזמן שהתמליל רץ שוב');
    const m2 = N.progressModel({ state: 'running', prog: { st: 'tl', p: 0.2, stg: { tr: { s: now - 9e5, e: now - 8e5, a: 6e4 }, al: { s: 0, e: 0, a: 3e5 }, tl: { s: now - 6e4, e: 0 } } } }, est, { done: true, took: 60 }, now);
    ok(m2.stages.find((s) => s.id === 'tr').took === 160, 'שלב שנעשה בשני סשנים — הזמן של שניהם (סכום השלבים = הזמן שעבר)');
  }

  /* ---------- 3. לא חוזר אחורה ---------- */
  const memo = new Map();
  ok(N.monoPct(memo, 'j:1:h', 0.4) === 0.4 && N.monoPct(memo, 'j:1:h', 0.35) === 0.4 && N.monoPct(memo, 'j:1:h', 0.5) === 0.5, 'הטבעת לא יורדת באותה הפעלה');
  ok(N.monoPct(memo, 'j:2:h', 0.1) === 0.1, '"המשך" (הפעלה חדשה) — מתחילה מהנקודה האמיתית');

  /* ---------- 4. הצפי בשרתון: פיקסלים, ליבות, במקביל ---------- */
  const m0 = E.etaModel([], 'a', now);
  const p1 = E.planOf(m0.st, 'haiku-high', 3600), p4k = E.planOf(m0.st, 'haiku-high', 3600, { px: 8 });
  ok(p4k.s.bn > p1.s.bn * 5 && p4k.s.tr === p1.s.tr && p4k.s.tl === p1.s.tl, '4K60 (×8 פיקסלים) — רק הצריבה ארוכה יותר (×8^0.85)');
  const p16 = E.planOf(m0.st, 'haiku-high', 3600, { c: 16 }), pcc = E.planOf(m0.st, 'haiku-high', 3600, { cc: 1 });
  ok(p16.s.al < p1.s.al && p16.s.al > p1.s.al / 2 && p16.s.tl === p1.s.tl, '16 ליבות — תמלול/יישור/צריבה מהירים יותר, אבל לא פי 2 (מקבול לא מושלם); Claude — אותו דבר');
  ok(pcc.s.al === Math.round(p1.s.al * 1.5) && pcc.s.tl === p1.s.tl, 'עבודה נוספת רצה בשרת — השלבים שמוגבלים במעבד גדלים (הקצב בפועל מתקן תוך כדי)');
  // למידה: דגימות מ־16 ליבות מנורמלות ל־8 — המודל לא "חושב" שהשרת מהיר יותר משהוא
  const smp = (c, cc) => ({ e: 'a', m: 'haiku-high', d: 1800, at: now, s: { tr: 600 * Math.pow(8 / c, 0.8) * (1 + 0.5 * cc), al: 400 * Math.pow(8 / c, 0.8) * (1 + 0.5 * cc), tl: 60, rv: 100, bn: 500, sv: 40 }, f: { c, cc } });
  const mA = E.etaModel([smp(8, 0), smp(8, 0), smp(8, 0), smp(8, 0)], 'a', now), mB = E.etaModel([smp(16, 0), smp(16, 0), smp(16, 0), smp(16, 0)], 'a', now);
  ok(Math.abs(mA.st.al[1] - mB.st.al[1]) < 0.01 && Math.abs(mA.st.al[0] - mB.st.al[0]) < 0.2, 'דגימות משרת של 16 ליבות מנורמלות — אותו מודל כמו משרת של 8');
  const mC = E.etaModel([smp(8, 1), smp(8, 1), smp(8, 1), smp(8, 1)], 'a', now);
  ok(JSON.stringify(mC.st.al) === JSON.stringify(E.etaModel([], 'a', now).st.al) && mC.st.tl[1] !== E.etaModel([], 'a', now).st.tl[1],
    'עבודה שרצה במקביל לאחרת לא מלמדת את השלבים שמוגבלים במעבד (לא מייצגת עבודה לבד), כן את Claude');
  const ep = E.etaPlan(m0, 'haiku-high', 3600, { px: 1 }), ep4 = E.replanPx(ep, 3600, 8);
  ok(ep4.s.bn === p4k.s.bn && ep4.s.tr === ep.s.tr && ep4.t === Object.values(ep4.s).reduce((a, b) => a + b, 0), 'replanPx: רק הצריבה מחושבת מחדש, והסכום מתעדכן');
  ok(E.replanPx(ep, 3600, 99) === null && E.replanPx(null, 3600, 2) === null, 'replanPx: ערך לא סביר — כלום');
  const sj = E.etaSample({ kind: 'tr', fires: 1, eng: 'api', hc: 16, cc: 1, pxm: 2000, spec: { dur: 600, mode: 'haiku-high' },
    prog: { stg: { tr: { s: 1, e: 9e4 }, al: { s: 1, e: 9e4 }, tl: { s: 1, e: 9e4 } } } }, now);
  ok(sj.f && sj.f.c === 16 && sj.f.cc === 1 && sj.f.px === 2, 'הדגימה שומרת את הגורמים של העבודה');
  ok(E.normEtSamples([sj])[0].f.px === 2, 'והם שורדים את הנירמול');
  ok(E.pxOf(1920, 1080, 30) === 1 && E.pxOf(3840, 2160, 60) === 8 && E.pxOf(1280, 720) === Math.round(1280 * 720 / (1920 * 1080) * 1000) / 1000 && E.pxOf(0, 1) === null,
    'pxOf: ביחס ל־1080p30, בלי קצב — 30');
  // אותו חישוב בעובד (job.px_of)
  const py = execFileSync('python3', ['-c', 'import sys; sys.path.insert(0, "translator"); import job; print(job.px_of({"video": {"width": 1280, "height": 720, "fps_float": 59.94}}))'], { cwd: root }).toString().trim();
  ok(+py === E.pxOf(1280, 720, 59.94), 'px זהה בעובד ובשרתון (' + py + ')');
  // הטלפון והשרתון: אותה תוכנית לעבודה שעוד לא נלקחה, גם עם px
  const pf = N.planFrom(m0, 76, 3600, 2.5), po = E.planOf(m0.st, 'haiku-high', 3600, { px: 2.5 });
  ok(JSON.stringify(pf.s) === JSON.stringify(po.s) && N.PX_EXP === E.PX_EXP, 'planFrom (טלפון) = planOf (שרתון) גם עם px');

  /* ---------- 5. מה שמוצג ---------- */
  const st = read('studio.js');
  ok(/if \(m >= 10\) m = Math\.round\(m \/ \(m >= 60 \? 10 : 5\)\) \* \(m >= 60 \? 10 : 5\);/.test(st), 'עיגול: עד 10 דק׳ בדקות, עד שעה ל־5, מעל שעה ל־10');
  ok(/const raw = leftSec > 3600 \? Math\.ceil\(r0 \/ 300e3\) \* 300e3 : r0;/.test(st), 'שעת סיום מעל שעה — מעוגלת קדימה ל־5 דק׳');
  ok((st.match(/fmtLeft\(shownLeft\(rec, m\)\)/g) || []).length >= 2, 'אותו מספר ברשימה, בבית ובמסך העבודה (p80 היציב)');
  ok(/shownPct\(r, hs\.pct/.test(st) && /shownPct\(jobRec\(id\) \|\| rec, mm && \(mm\.pv != null \? mm\.pv : mm\.p\)/.test(st), 'הטבעת והפס של השלב — לא חוזרים אחורה, והפס כולל זחילה');
  ok(/spec\.px = Math\.round/.test(st), 'הטלפון שולח את המידות (px) כבר ביצירה');
  const app = read('app.js');
  ok(/studioStageLong: "לוקח יותר מהרגיל · עוד \{t\}"/.test(app) && /studioHOnly: "\{h\} ש׳"/.test(app), 'המחרוזות בעברית (ובאנגלית — i18n-coverage)');
  console.log('\n' + n + ' בדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
