// סבב 4: סימונים מהביקורת (מגדר / מי מדבר / מונח — "לבדיקה שלך" בעורך), מונח שתורגם בשתי דרכים (בלי AI),
// והסרת מילות מילוי (um/uh מהתמלול) בהפקה מחדש — בטלפון, בשרתון ובעובד.
// הרצה: node tests/studio-round4.test.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const py = (code) => execFileSync('python3', ['-c', 'import sys, json; sys.path.insert(0, "translator"); import job, edl\n' + code], { cwd: root, encoding: 'utf8' });

(async () => {
  const SB = await import(path.join(root, 'studiosubs.js'));
  const ED = await import(path.join(root, 'studioedl.js'));
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k) => k;
  const ST = await import(path.join(root, 'studio.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

  /* ---------- 1. מונח שתורגם בשתי דרכים ---------- */
  const cs = [
    { i: 1, s: 0, e: 2, lines: ['הבינה המלאכותית'], en: 'Artificial intelligence is' },
    { i: 2, s: 2, e: 4, lines: ['ה־AI הזה'], en: 'This artificial intelligence' },
    { i: 3, s: 4, e: 6, lines: ['ובינות מלאכותיות'], en: 'and artificial intelligences' },
    { i: 4, s: 6, e: 8, lines: ['מחשב חכם'], en: 'artificial intelligence' },
    { i: 5, s: 8, e: 9, lines: ['שלום'], en: 'Hello there' },
    { i: 6, s: 9, e: 10, lines: ['אינטליגנציה'], en: 'intelligent artificially' },
  ];
  const T1 = [['artificial intelligence', 'בינה מלאכותית / AI']];
  ok(JSON.stringify(SB.termIssues(cs, T1)) === '[[4,"artificial intelligence"]]', 'מונח: תחיליות (ה/ו), רבים ונקבה, וחלופה (AI) — לא "שונה"; תרגום אחר — מסומן');
  ok(SB.termIssues(cs, [['artificial intelligence', 'בינה מלאכותית']]).map((x) => x[0]).join() === '2,4', 'בלי החלופה — גם ה־AI מסומן');
  ok(SB.termIssues(cs, [['intelligence', 'בינה']]).every((x) => x[0] !== 6), 'רק מילה שלמה באנגלית (intelligent ≠ intelligence)');
  ok(SB.termIssues(cs, [['x', 'א'], ['', 'ב'], 'bad', ['term', '']]).length === 0 && SB.termIssues(cs, null).length === 0, 'מונחים לא תקינים — מתעלמים');
  ok(SB.termIssues([{ i: 1, s: 0, e: 1, lines: ['בִּינָה מְלָאכוּתִית'], en: 'artificial intelligence' }], T1).length === 0, 'ניקוד בעברית — לא מפריע');
  const fi = SB.flagIndex(cs, [[2, 'rvg'], [2, 'term'], [2, 'rvg'], [99, 'rvs'], ['2', 'x']]);
  ok(fi.size === 1 && fi.get(2).k.join() === 'rvg,term' && fi.get(2).t === 'ה־AI הזה', 'flagIndex: לפי מזהה הכתובית, בלי כפולים, עם הטקסט המקורי (סימון נעלם כשהטקסט נערך)');

  /* ---------- 2. הצורה — זהה בטלפון ובשרתון ---------- */
  ok(ST.RVF_MAX === S.RVF_MAX && JSON.stringify(ST.RVF_CODES) === JSON.stringify(S.RVF_CODES) && ST.FIL_MAX === S.FIL_MAX, 'RVF_MAX / RVF_CODES / FIL_MAX — זהים בטלפון ובשרתון');
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let bad = -1;
  for (let k = 0; k < 400 && bad < 0; k++) {
    const len = Math.floor(rnd() * 6);
    const rv = Array.from({ length: len }, () => [Math.floor(rnd() * 8) - 1, ['g', 's', 't', 'x'][Math.floor(rnd() * 4)]]).sort((a, b) => a[0] - b[0]);
    const fl = Array.from({ length: len }, (_, i) => { const a = i * 2 + rnd(); return [a, a + rnd() * 2.4]; });
    if (JSON.stringify(ST.normRvf(rv)) !== JSON.stringify(S.normRvf(rv)) || JSON.stringify(ST.normFil(fl)) !== JSON.stringify(S.normFil(fl))) bad = k;
  }
  ok(bad < 0, 'normRvf / normFil — הטלפון = השרתון (400 קלטים אקראיים)');
  const pyc = JSON.parse(py('print(json.dumps([job.RVF_MAX, list(job.RVF_CODES), job.FIL_MAX]))'));
  ok(pyc[0] === S.RVF_MAX && JSON.stringify(pyc[1]) === JSON.stringify(S.RVF_CODES) && pyc[2] === S.FIL_MAX, 'אותם קבועים בעובד');

  /* ---------- 3. העובד: הסימונים מהתשובה, מילות המילוי מהתמלול ---------- */
  const rf = JSON.parse(py('print(json.dumps(job.review_flags("!#12 g\\n#4 תיקון\\n- !#3 s\\n!#12 g\\n!#7 x\\n! 9 t\\n!#5 G", {3, 5, 9, 12})))'));
  ok(JSON.stringify(rf) === '[[3,"s"],[5,"g"],[9,"t"],[12,"g"]]', 'review_flags: "!#מספר קוד" (סובלני לתבליט ולאותיות גדולות), רק מספרים קיימים, בלי כפולים; תיקון רגיל (#4) — לא סימון');
  const fil = JSON.parse(py(`
import tempfile, pathlib
d = pathlib.Path(tempfile.mkdtemp()); (d / 'asr').mkdir()
w = [{'w': 'So', 's': 0.0, 'e': 0.3}, {'w': 'um,', 's': 0.5, 'e': 0.9}, {'w': 'we', 's': 1.0, 'e': 1.2},
     {'w': 'Uh', 's': 1.3, 'e': 1.35}, {'w': 'go', 's': 1.4, 'e': 1.6}, {'w': 'hmm', 's': 2.0, 'e': 5.5}, {'w': 'ok', 's': 6.0, 'e': 6.2}, {'w': 'er', 's': 6.4}]
(d / 'asr' / 'parakeet.json').write_text(json.dumps({'words': w}))
(d / 'asr' / 'diff_a_b.json').write_text('x')
print(json.dumps(job.fillers(d)))`));
  ok(JSON.stringify(fil) === '[[0.46,0.94],[6.36,6.84]]', 'fillers: um עם מרווח קטן, בלי לגעת במילה השכנה; קצר מדי (Uh 0.05 שנ׳) וארוך מדי (hmm 3.5 שנ׳) — לא; בלי סוף — הערכה');
  ok(py('print(job.fillers(__import__("pathlib").Path("/nonexistent")))').trim() === '[]', 'fillers: בלי תמלול — רשימה ריקה');
  const jp = read('translator/job.py');
  ok(/rvf, fil = review_flags_file\(ctx\.pdir\), fillers\(ctx\.pdir\)/.test(jp) && /rvf=rvf or None, fil=fil or None\)/.test(jp), 'finish שולח את הסימונים ואת מילות המילוי (תקלה בהם לא מפילה את סוף העבודה)');
  const pp = read('translator/pipeline.py');
  ok(/`!#מספר קוד`/.test(pp) && /review' \/ 'flags\.txt'/.test(pp) && /str\(f\[0\]\) not in got/.test(pp), 'מצב השרת: הביקורת מסמנת באותה תשובה (בלי קריאה נוספת), כתובית שתוקנה — לא מסומנת');
  ok(/review\/flags\.txt/.test(read('translator/REVIEW.md')) && /`g`.*`s`.*`t`/.test(read('translator/REVIEW.md')), 'REVIEW.md (Routine): אותם קודים, לאותו קובץ');

  /* ---------- 4. חיתוך מילות המילוי ---------- */
  const fr = ED.cutFillers([], [[3, 3.4], [10, 10.5], [0.2, 0.6], [20, 20.3]], 30);
  ok(fr && fr.n === 3 && JSON.stringify(fr.segs) === '[[0,3],[3.4,10],[10.5,20],[20.3,30]]' && fr.t === 1.2, 'cutFillers: בלי חיתוך קודם = כל הסרטון; מילה בתחילת הסרטון (היה נשאר קטע של 0.2 שנ׳) — מדלגים');
  ok(ED.cutFillers([[5, 8]], [[3, 3.4], [9, 9.5]], 30) === null, 'רק בתוך מה שכבר נבחר');
  const many = Array.from({ length: 200 }, (_, i) => [i * 2 + 1, i * 2 + 1.3]);
  ok(ED.cutFillers([], many, 400).segs.length === ED.SEG_MAX, 'לא יותר מ־SEG_MAX קטעים');
  ok(ED.cutFillers(null, [[1, 1.5]], 0) === null, 'בלי אורך ובלי קטעים — לא מנחשים');
  const e = ED.normEdl({ k: [[0, 3], [3.4, 10]] }, 10);
  const mc = ED.mapCues(e, [{ s: 2, e: 5 }, { s: 3.05, e: 3.3 }]);
  ok(JSON.stringify(mc.map((c) => [c.s, c.e])) === '[[2,4.6]]', 'mapCues: כתובית שנחתכה ממנה מילת מילוי — רציפה (לא רק החלק הארוך); כולה בתוך החיתוך — יוצאת');
  const pmc = JSON.parse(py('e = edl.norm_edl({"k": [[0, 3], [3.4, 10]]}, 10); print(json.dumps([[c["start"], c["end"]] for c in edl.map_cues(e, [{"start": 2, "end": 5}, {"start": 3.05, "end": 3.3}])]))'));
  ok(JSON.stringify(pmc) === '[[2,4.6]]', 'map_cues בעובד — אותה תוצאה');
  const args = JSON.parse(py('i = {"w": 640, "h": 360, "v": True, "a": True, "dur": 10}\nprint(json.dumps([edl.ffmpeg_args("s", "o", edl.norm_edl({"k": [[0, 3], [3.4, 10]]}, 10), i), edl.ffmpeg_args("s", "o", edl.norm_edl({"k": [[1, 9]]}, 10), i)]))'));
  ok(/atrim=start=0\.000:end=3\.000,asetpts=PTS-STARTPTS,afade=t=in:d=0\.01,afade=t=out:st=2\.990:d=0\.01/.test(args[0].join(' ')) && !/afade/.test(args[1].join(' ')),
    'ffmpeg: כמה קטעים — הדרגה של 10ms בכל תפר (בלי קליק); קטע אחד — בלי');

  /* ---------- 5. הטלפון ---------- */
  const rec = { srv: { state: 'done', kind: 'tr', rvf: [[3, 'g'], [3, 's'], [8, 't']] } };
  ok(ST.afterAdvice(rec).some((a) => a.k === 'rvf' && a.n === 2), 'הצעה אחרי: "N כתוביות לבדיקה שלך" (מספר הכתוביות, לא הסימונים)');
  ok(ST.afterAdvice({ srv: { state: 'done', kind: 'tr', rvf: null } }).every((a) => a.k !== 'rvf'), 'בלי סימונים — בלי הצעה');
  const sj = read('studio.js');
  ok(/flags: seFlags\(rec, cues\), only,/.test(sj) && /seOnly = rec\.id; go\('subs', rec\.id\)/.test(sj), 'העורך נפתח על "רק לבדיקה" מההצעה, עם הסימונים');
  ok(/termIssues\(cues, terms\)/.test(sj) && /rec\.srv\.gl \? rec\.srv\.gl\.s : \[\]/.test(sj), 'מונחים לבדיקה: מילון המונחים + המונחים של העבודה');
  ok(/cutFillers\(ce\.ed\.segs\(\), fil, /.test(sj) && /k: 'ed-fil'/.test(sj), 'דף החיתוך: "הסרת מילות מילוי"');
  const ss = read('studiosubs.js');
  ok(/const flagsOf = \(c\) => \{ const f = flags\.get\(c\.i\); return f && f\.t === textOf\(c\) \? f\.k : \[\]; \};/.test(ss) && /cueIssues\(c\)\.concat\(flagsOf\(c\)\)/.test(ss),
    'העורך: הסימון הוא "בעיה" (בסינון ובספירה) עד שהטקסט נערך');
  ok(/const passes = \(c\) => !cueIssues\(c\)/.test(ss), 'ההצעות האוטומטיות לא מושפעות מהסימונים (אין להן תיקון בקוד)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
