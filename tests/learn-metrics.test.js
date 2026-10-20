// מאגר הלמידה מ׳5 (20/10/2026): המדדים בקוד. SubER בטלפון (studiosubs.js) = SubER בעובד (translator/learnmetrics.py),
// ושניהם = הכלים הפתוחים — הערכים הקבועים כאן חושבו ב־sacrebleu 2.6.0 וב־apptek/SubER (20/10/2026). אין להם תלות ב־CI.
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m); } };
const near = (a, b, m) => ok(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(b)), m + ' — ' + a + ' מול ' + b);

const VEC = {"ter": [[["הוא הלך הביתה מהר.", "אני אוהב את Apple"], ["הוא חזר הביתה מהר", "אני אוהב את אפל"], 37.5, 58.97305407757455], [["the cat sat on the mat", "a b c d e f"], ["the mat sat on the cat", "f e d c b a"], 58.333333333333336, 74.01515666995545], [["ג׳ובס אמר: \"תישארו רעבים\".", "לא", "זה היה ב־2005, בסטנפורד."], ["ג׳ובס אמר \"הישארו רעבים\"", "לא.", "זה היה בסטנפורד ב־2005."], 66.66666666666666, 63.84298043663335], [["", " x "], ["שלום", "x"], 50.0, 40.229885057471265]], "suber": [[[[0, 2, ["שלום לכולם", "ברוכים הבאים"]], [2.5, 4, ["היום נדבר על AI"]]], [[0, 2, ["שלום לכולם ברוכים", "הבאים"]], [2.5, 4, ["היום נדבר על AI."]]], 9.091], [[[0, 1, ["a b c"]], [1, 2, ["d e f"]]], [[0, 1, ["a b"]], [1, 2, ["c d e f"]]], 25.0], [[[0, 1, ["a b c"]]], [[5, 6, ["a b c"]]], 200.0], [[[0, 3, ["הוא אמר שזה עובד", "כמו שצריך"]], [3.04, 5, ["ואז הכל השתנה"]]], [[0, 2.9, ["הוא אמר", "שזה עובד כמו שצריך"]], [3.04, 5.2, ["ואז", "הכל השתנה"]]], 15.385], [[], [[0, 1, ["x y"]]], 100.0]]};

(async () => {
  const S = await import(path.join(root, 'studiosubs.js'));
  const toJs = (subs) => subs.map(([s, e, lines]) => ({ s, e, lines }));
  for (const [h, r, want] of VEC.suber) near(S.suber(toJs(h), toJs(r)), want, 'SubER בטלפון = apptek/SubER');

  // אקראי: אותה תוצאה בטלפון ובעובד
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const V = ['שלום', 'עולם', 'אני', 'הוא', 'run,', 'fast.', '"Yes"', 'ג׳ובס', 'ב־2020', 'Apple', 'apple', 'x', 'y', '!', '…', '<i>a</i>'];
  const sent = (n) => Array.from({ length: n }, () => pick(V)).join(' ');
  const gen = () => { let t = 0; const out = []; const k = 1 + Math.floor(rnd() * 7); for (let i = 0; i < k; i++) { t += pick([0, 0.04, 0.5, 1]); const d = pick([0.5, 1, 1.7, 2.5]); out.push([Math.round(t * 1000) / 1000, Math.round((t + d) * 1000) / 1000, Array.from({ length: 1 + Math.floor(rnd() * 2) }, () => sent(Math.floor(rnd() * 6)))]); t += d; } return out; };
  const cases = [];
  for (let i = 0; i < 160; i++) {
    const r = gen();
    const h = rnd() < 0.6 ? r.map(([s, e, ls]) => { const s2 = Math.max(0, s + pick([0, 0, 0.1, -0.3, 1])); return [s2, Math.max(s2, e + pick([0, 0.2, -0.2])), ls.map((l) => (rnd() < 0.6 ? l : sent(Math.floor(rnd() * 6))))]; }) : gen();
    cases.push([h, r]);
  }
  const py = JSON.parse(execFileSync('python3', ['-c', [
    'import sys, json; sys.path.insert(0, "translator"); import learnmetrics as L',
    'd = json.load(sys.stdin)',
    'print(json.dumps({"s": [L.suber_counts(h, r) for h, r in d["s"]], "v": [L.suber(h, r) for h, r in d["v"]],',
    '  "t": [[L.ter_corpus(h, r), L.chrf_corpus(h, r)] for h, r, a, b in d["t"]]}))'].join('\n')], { cwd: root, input: JSON.stringify({ s: cases, v: VEC.suber.map((x) => x.slice(0, 2)), t: VEC.ter }) }).toString());
  let same = 0;
  cases.forEach(([h, r], k) => { const j = S.suberCounts(toJs(h), toJs(r)); if (j.sb === py.s[k][0] && j.sr === py.s[k][1]) same++; else console.log('שונה', JSON.stringify([h, r]), j, py.s[k]); });
  ok(same === cases.length, 'SubER בטלפון = בעובד ב־' + same + '/' + cases.length + ' מקרים אקראיים');
  VEC.suber.forEach((x, k) => near(py.v[k], x[2], 'SubER בעובד = apptek/SubER'));
  VEC.ter.forEach((x, k) => { near(py.t[k][0], x[2], 'TER בעובד = sacrebleu'); near(py.t[k][1], x[3], 'chrF++ בעובד = sacrebleu'); });

  // TER בטלפון (בלי זמנים) = TER של sacrebleu
  for (const [h, r, ter] of VEC.ter) {
    let e = 0, n = 0;
    h.forEach((x, k) => { const [a, b] = S.terEdits(pySplitLower(x), pySplitLower(r[k])); e += a; n += b; });
    near(100 * e / n, ter, 'TER בטלפון = sacrebleu');
  }
  function pySplitLower(s) { return s.toLowerCase().split(/\s+/).filter(Boolean); }

  // editStats עם הגרסה הקודמת = גם SubER
  const before = [{ s: 0, e: 2, lines: ['שלום לכולם', 'ברוכים הבאים'] }], after = [{ s: 0, e: 2, lines: ['שלום לכולם ברוכים', 'הבאים'] }];
  const es = S.editStats(S.editDiff(before, after), after, before);
  ok(es.sb === 1 && es.sr === 6 && !('sb' in S.editStats([], after)), 'editStats: SubER רק כשיש גרסה קודמת — הזזת שבירה אחת (' + es.sb + '/' + es.sr + ')');

  // השרתון: normLx מקבל רק את הצורה של mx, ו־learnView מסכם
  const LR = require(path.join(root, 'ibkr-proxy/lib/studiolearn.js'));
  const lx = LR.normLx({ mx: { v: 1, st: { n: 100, 'df.ch': 20, 'df.t': 12.5, 'dz.ch': 30, txt: 'סוד' }, tm: { n: 100, late: 15, cut: 10, nw: 0, 'in.p50': 0.1 }, cs: { 'nm.n': 10, 'nm.var': 2, 'gl.n': 20, 'gl.miss': 4, 'gl.mix': 1 },
    om: { 'om.e': 3, 'om.s': 2, 'num.n': 40, 'num.miss': 4, 'om.r50': 0.8 }, bad: { x: 1 }, 'זדון': { a: 1 } } });
  ok(lx.mx && Object.keys(lx.mx).join() === 'st,tm,cs,om' && lx.mx.st['df.t'] === 12.5 && !('txt' in lx.mx.st), 'normLx: רק st/tm/cs/om ורק מספרים');
  const now0 = Date.UTC(2026, 9, 20);
  const recs = [1, 2, 3].map((i) => LR.learnRec({ id: 'j' + String(i).repeat(20), kind: 'tr', state: 'done', created: now0 - i * 3600e3, ended: now0, spec: { dur: 600, mode: 'haiku-high' },
    lx: { mx: { st: { n: 100, 'df.ch': 20, 'df.t': 10 + i, 'dz.ch': 30 }, tm: { n: 100, late: 15, cut: 10, nw: 0, 'in.p50': 0.1, 'sh.near': 20, 'sh.bad': 12 }, cs: { 'nm.n': 4, 'nm.var': 1, 'gl.n': 5, 'gl.miss': 1, 'gl.mix': 0 },
      om: { 'om.e': 3, 'om.s': 2, 'num.n': 10, 'num.miss': 2, 'om.r50': 0.8 } } },
    ux: { e: { s: 1, wd: 5, wa: 100, sb: 8, sr: 120 } } }, now0, () => ({ state: 'done' })));
  const view = LR.learnView(recs, now0), mx = view.mx;
  ok(mx && mx.n === 3 && mx.st.n === 300 && mx.st.df.ch === 0.2 && mx.st.df.t === 12 && mx.st.dz.ch === 0.3, 'learnView.mx: שלבים — חלק ששונה וממוצע משוקלל');
  ok(mx.tm.late === 0.15 && mx.tm.cut === 0.1 && mx.tm.shb === 0.06 && mx.cs.nmv === 0.25 && mx.cs.glm === 0.2 && mx.om.numm === 0.2 && mx.om.e === 0.03, 'learnView.mx: תזמון, עקביות, השמטות ' + JSON.stringify([mx.tm, mx.cs, mx.om]));
  const codes = view.ins.map((x) => x.k);
  ok(['num_drop', 'omit_cues', 'tm_late', 'shot_near', 'name_var', 'gl_miss'].every((k) => codes.includes(k)), 'שש המסקנות החדשות: ' + codes.join(','));
  ok(view.k.sb === rnd3(24 / 360), 'SubER במדדים = סכום העריכות ÷ סכום אסימוני הייחוס (' + view.k.sb + ')');
  function rnd3(x) { return Math.round(x * 1000) / 1000; }
  const m2 = LR.mergeUx({ e: { sb: 5, sr: 100 } }, { e: { sb: 3, sr: 90 } });
  ok(m2.e.sb === 8 && m2.e.sr === 90, 'mergeUx: sb מצטבר, sr — האחרון');
  ok(/lx\.mx/.test(LR.learnBrief(view, now0)) && /מדדים בקוד/.test(LR.learnBrief(view, now0)), 'החבילה ל־Claude כוללת את המדדים ואת המילון שלהם');

  console.log(`learn-metrics: ${pass} עברו, ${fail} נכשלו`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
