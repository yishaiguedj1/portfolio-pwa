// Studio — השדרוג המקצועי, סבב 4 (2/11/2026): העורך המקצועי. C1+H1 ציר עם זום, גרירת קצה ופס מילים · B1 לוח בדיקה ·
// B3 הצמדה לחיתוכים בגרירה · B4 פיצול בנשימה · C2 מילים לא בטוחות · C3 שם וצבע לדובר · C4 השוואת גרסאות.
// הרצה: node tests/studio-pro-editor.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const cue = (s, e, text, x) => Object.assign({ i: Math.round(s * 10), s, e, lines: text.split('\n'), en: '', spk: '' }, x || {});

(async () => {
  const SB = await import(path.join(root, 'studiosubs.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. העובד: המילים ב־timeline.json ---------- */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'snb-pe-'));
  fs.writeFileSync(path.join(tmp, 'en.words.json'), JSON.stringify({ words: [{ w: 'old', s: 0, e: 1, conf: 0.9 }] }));
  fs.writeFileSync(path.join(tmp, 'en.aligned.json'), JSON.stringify({ words: [
    { w: 'Hello', s: 0.5, e: 0.9, conf: 0.934 }, { w: 'world', s: 1.0, e: 1.4, conf: null }, { w: '', s: 1.5, e: 1.6 },
    { w: 'back', s: 0.2, e: 0.3, conf: 0.5 }, { w: 'x'.repeat(60), s: 2, e: 1, conf: 0.2 }, 'bad'] }));
  const py = 'import sys, json; sys.path.insert(0, "translator"); import peaks as P; print(json.dumps([P.WD_MAX, P.WD_LEN, P.words(sys.argv[1])]))';
  const [wmax, wlen, wd] = JSON.parse(execFileSync('python3', ['-c', py, tmp], { cwd: root, encoding: 'utf8' }));
  ok(wmax === SB.WD_MAX && wlen === SB.WD_LEN, 'WD_MAX / WD_LEN — זהים בעובד (peaks.py) ובטלפון');
  ok(JSON.stringify(wd) === JSON.stringify([[0.5, 0.9, 'Hello', 93], [1, 1.4, 'world', -1], [2, 2.01, 'x'.repeat(40), 20]]),
    'peaks.words: מהיישור קודם; בסדר עולה בלבד; ביטחון 0–100 (בלי — ‎-1); סוף לפני התחלה מתוקן; מילה עד 40 תווים');
  fs.rmSync(path.join(tmp, 'en.aligned.json'));
  ok(JSON.parse(execFileSync('python3', ['-c', py, tmp], { cwd: root, encoding: 'utf8' }))[2][0][2] === 'old', 'בלי יישור — מהתמלול (en.words.json)');
  fs.rmSync(tmp, { recursive: true, force: true });
  ok(/meta\['wd'\] = wd/.test(read('translator/peaks.py')), 'timeline.json מקבל את wd רק כשיש מילים');

  /* ---------- 2. הטלפון: המילים ---------- */
  const pk = Buffer.alloc(200, 200).toString('base64');
  const W = [[1, 1.4, 'So', 90], [1.5, 2, 'the', 95], [2.1, 2.6, 'light', 30], [3.2, 3.6, 'changes', 88], [3.7, 4.4, 'everything.', -1]];
  const m = SB.normMeta({ v: 1, r: 20, pk, sh: [5], wd: W.concat([[0.5, 0.6, 'back', 10], [9, 'x', 'y', 1], 'z']) });
  ok(m.wd && m.wd.n === 5 && m.wd.w[2] === 'light' && m.wd.c[4] === -1, 'normWords: רק בסדר עולה ותקינות; מילים ישנות = null (normMeta בלי wd)');
  ok(SB.normMeta({ v: 1, r: 20, pk }).wd === null, 'עבודה ישנה בלי מילים — wd = null');
  ok(SB.wordsIn(m.wd, 1.45, 3).join() === '1,3' && SB.wordsIn(m.wd, 10, 12).join() === '0,0', 'wordsIn: לפי מרכז המילה');
  const c1 = cue(1, 4.4, 'כך האור\nמשנה הכל.', { en: 'So the light changes everything.' });
  const un = SB.unsureIn(m.wd, c1);
  ok(un.length === 1 && un[0].w === 'light' && un[0].c === 30, 'C2: unsureIn — ביטחון מתחת ל־50; בלי ציון לא נחשב');
  const mk = SB.markUnsure(c1.en, un);
  ok(mk.length === 1 && c1.en.slice(mk[0][0], mk[0][1]) === 'light', 'C2: markUnsure — המיקום במקור (בלי פיסוק ורישיות)');
  ok(SB.markUnsure('The LIGHT, the light', [{ w: 'light' }, { w: 'light' }]).map((x) => x[0]).join() === '4,15', 'מילה שחוזרת — כל אחת במקומה לפי הסדר');

  /* ---------- 3. B4: נשימה ---------- */
  const br = SB.breathIn(m, c1);
  ok(br && br.a === 2.6 && br.b === 3.2, 'breathIn: הרווח הארוך בין מילים (0.6 שנ׳), לא בקצוות');
  ok(SB.breathIn(m, cue(1, 2.6, 'x y')) === null, 'בלי רווח מספיק — אין נשימה (לא מנחשים מהגל כשיש מילים)');
  const pk2 = new Uint8Array(100).fill(220); for (let i = 40; i < 46; i++) pk2[i] = 60;
  const br2 = SB.breathIn({ r: 20, pk: pk2, wd: null }, cue(0.5, 4, 'a b'));
  ok(br2 && br2.a === 2 && br2.b === 2.3, 'בלי מילים — השקט בגל (25 dB מתחת לשיא, לפחות 0.15 שנ׳)');
  const sp = SB.splitBreath([c1], 0, m);
  ok(sp && sp.length === 2 && sp[0].e === 2.65 && sp[1].s === 3.15 && sp[0].en === 'So the light' && sp[1].en === 'changes everything.',
    'splitBreath: הזמנים בנשימה, המקור לפי המילים');
  ok(sp[0].lines.join(' ') + ' ' + sp[1].lines.join(' ') === 'כך האור משנה הכל.' && sp[1].i === -1, 'הטקסט מתחלק בלי לאבד מילה; השנייה חדשה (i = ‎-1)');
  ok(SB.splitBreath([cue(1, 2.6, 'x y')], 0, m) === null, 'אין נשימה — null');

  /* ---------- 4. B1: לוח הבדיקה ---------- */
  const qs = [cue(0, 1, 'קצר מאוד וארוך מדי לקריאה בשנייה אחת'), cue(1.02, 3, 'צמוד'), cue(4.7, 7, 'ליד חיתוך'), cue(8, 10, 'בסדר')];
  const sc = SB.qcScan(qs, [5]);
  ok(sc.cps.join() === '0' && sc.gap.join() === '0' && sc.cut.join() === '2' && !sc.dur.length && SB.QC_KINDS.length === 6, 'qcScan: קצב, צמודות, ליד חיתוך');
  const fx = SB.qcFix(qs, ['cut', 'gap'], [5]);
  ok(fx.n === 2 && fx.cues[2].s === 5 && fx.cues[1].s - fx.cues[0].e >= SB.GAP_MIN - 1e-6, 'qcFix: הצמדה לחיתוך ושני פריימים בין כתוביות');
  ok(SB.qcFix(qs, [], [5]).n === 0 && SB.qcFix(qs, ['cut'], [5]).cues[0] === qs[0], 'בלי סוגים — כלום; כתוביות שלא נגעו בהן — אותו אובייקט');
  const ext = SB.qcFix([cue(0, 1, 'משפט ארוך שצריך יותר זמן לקריאה'), cue(5, 6, 'הבאה')], ['cps'], []);
  ok(ext.n === 1 && ext.cues[0].e > 1, 'קצב קריאה — הארכה לתוך הרווח (fixOf, כמו ההצעות)');
  ok(SB.suggestions([cue(0, 1, 'משפט ארוך שצריך יותר זמן לקריאה'), cue(5, 6, 'הבאה')], new Set()).length === 1, 'ההצעות (מ6) עובדות כמו קודם אחרי חילוץ fixOf');

  /* ---------- 5. B3 + H1: הצמדה בגרירה ---------- */
  ok(SB.tlSnap(5.1, 's', [5], m.wd, 1 / 20).t === 5 && SB.tlSnap(5.1, 's', [5], m.wd, 1 / 20).kind === 'cut', 'tlSnap: התחלה — על החיתוך');
  ok(Math.abs(SB.tlSnap(4.95, 'e', [5], null, 1 / 20).t - (5 - SB.GAP_MIN)) < 1e-9, 'סוף — שני פריימים לפני החיתוך');
  ok(SB.tlSnap(3.25, 's', [], m.wd, 1 / 20).t === 3.2 && SB.tlSnap(3.25, 's', [], m.wd, 1 / 200) === null, 'גבול מילה — רק בטווח של כמה פיקסלים (תלוי בזום)');

  /* ---------- 6. C3: דוברים ---------- */
  const sk = [cue(0, 1, 'א', { spk: 'S1' }), cue(1, 2, 'ב', { spk: 'S2' }), cue(2, 3, 'ג', { spk: 'S1' })];
  const rn = SB.renameSpk(sk, 'S1', '  דנה  ');
  ok(rn[0].spk === 'דנה' && rn[2].spk === 'דנה' && rn[1] === sk[1] && SB.renameSpk(sk, 'S9', 'x') === null && SB.renameSpk(sk, 'S1', ' ') === null, 'renameSpk: בכל הכתוביות, רק מה שהשתנה');
  ok(SB.renameSpk(sk, 'S1', 'x'.repeat(30))[0].spk.length === SB.SPK_LEN && SB.SPK_LEN === 20 && /\[:20\]/.test(read('translator/rerender.py')), 'שם עד 20 תווים — כמו rerender.py');
  ok(SB.setSpk(sk, 1, 'S1')[1].spk === 'S1' && SB.setSpk(sk, 1, 'S2') === sk && SB.setSpk(sk, 9, 'S1') === null, 'setSpk: דובר לכתובית');
  const col = SB.spkColors(sk, { S2: 4 });
  ok(col.get('S1') === SB.SPK_COLORS[0] && col.get('S2') === SB.SPK_COLORS[4] && SB.spkColors(sk, { S2: 9 }).get('S2') === SB.SPK_COLORS[1], 'spkColors: הצבע שבחרת לפי השם; מספר לא תקין — לפי הסדר');

  /* ---------- 7. C4: גרסאות ---------- */
  const v = S.view ? S.view({ id: 'j1', vh: [{ c: 'A'.repeat(20), s: 'B'.repeat(20), at: 5 }, { c: 'bad id!', at: 6 }] }) : null;
  const sj = read('studio.js');
  ok(/vc: Array\.isArray\(job\.vh\) \? job\.vh\.map\(\(x\) => \(x && FILE_ID_RE\.test\(String\(x\.c \|\| ''\)\) \? x\.c : ''\)\) : \[\]/.test(read('ibkr-proxy/lib/studio.js')) && (!v || (v.vc && v.vc[0] === 'A'.repeat(20) && v.vc[1] === '')),
    'השרתון: vc — מזהה קובץ הכתוביות של כל גרסה (רק מזהה תקין)');
  ok(/vc: \(Array\.isArray\(s\.vc\) \? s\.vc : \[\]\)\.slice\(0, 20\)\.map\(\(x\) => \(FID_RE\.test/.test(sj) && /editDiff\(normCues\(await net\.driveJson\(fileId\)\), se && se\.ed \? se\.ed\.cues\(\) : \[\]\)/.test(sj),
    'הטלפון: ההשוואה = editDiff בין הגרסה לכתוביות שבעורך; השחזור אחרי שרואים');

  /* ---------- 8. החיבור בעורך ---------- */
  const ss = read('studiosubs.js');
  ok(/edge: \(k, e, t\) => me\.ed\.edge\(k, e, t\)/.test(sj) && /hist\.push\(nx, 'edge:' \+ k \+ e, Date\.now\(\)\)/.test(ss), 'C1: גרירת קצה בציר → העורך; גרירה רצופה = צעד ביטול אחד');
  ok(/meta: me\.meta, spkOver: store\.spkc \|\| \{\}, onSpkColor: spkcSet/.test(sj) && /spkc: normSpkc\(src\.spkc\)/.test(sj), 'C3: הצבעים נשמרים בחשבון (pwa_studio_v1) ומנורמלים');
  ok(/'cue-breath:' \+ k/.test(ss) && /qcEl\.hidden = !only/.test(ss) && /st-src-u/.test(ss), 'B4 / B1 / C2 — בממשק');
  ok(/if \(se\.meta\.wd\) se\.tl\.el\.classList\.add\('w'\)/.test(sj) && /\.st-tlw\.w \.st-tl \{ height: 92px; \}/.test(read('studio.css')), 'פס המילים רק כשיש מילים');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
