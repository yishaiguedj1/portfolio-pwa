// מ2–מ3 (10/10/2026): עורך הכתוביות — פעולות טהורות (טקסט, פיצול, מיזוג, תזמון, הזזה, חיפוש והחלפה, ביטול),
// קבצים כמו vt (SRT עם RLM, cues.final.json), והחיבור לאפליקציה (דף subs, הפקה מחדש, שמירה בגרסאות).
// הפקה מחדש בעובד — translator/tests/test_worker.py (test_rerender); בשרתון — ibkr-proxy/tests/run.js ("מ2").
// הרצה: node tests/studio-subs.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const E = await import(path.join(root, 'studiosubs.js'));
  const P = await import(path.join(root, 'studioplay.js'));
  const N = await import(path.join(root, 'studionet.js'));
  const cue = (i, s, e, lines, en) => ({ i, s, e, lines, en: en || '', spk: '' });
  const base = [cue(1, 1, 4, ['שלום לכולם וברוכים הבאים'], 'Hello everyone and welcome'), cue(2, 4.2, 6, ['היום נדבר']), cue(3, 8, 10, ['על השקעות'])];

  /* ---------- 1. שבירת שורות ---------- */
  ok(E.autoBreak('קצר').join('|') === 'קצר', 'autoBreak: קצר — שורה אחת');
  const long = 'זו כתובית ארוכה שצריך לשבור, כי היא עוברת את המגבלה של ארבעים ושניים';
  const lb = E.autoBreak(long);
  ok(lb.length === 2 && lb.every((x) => x.length <= P.Q_LEN) && lb[0].endsWith(','), 'autoBreak: שתי שורות עד ' + P.Q_LEN + ', אחרי הפסיק');
  ok(E.autoBreak('  א ‮ ב  ').join('|') === 'א ב', 'autoBreak: רווחים ותווי כיווניות');

  /* ---------- 2. טקסט ---------- */
  let c2 = E.setText(base, 1, 'היום\nנדבר על כסף');
  ok(c2 !== base && c2[1].lines.join('|') === 'היום|נדבר על כסף' && base[1].lines.join() === 'היום נדבר', 'setText: ירידות שורה נשמרות, המקור לא משתנה');
  ok(E.setText(base, 1, '   ') === null && E.setText(base, 1, 'היום נדבר') === base, 'setText: ריק = לא (מחיקה מפורשת); בלי שינוי = אותו מערך');
  ok(E.setText(base, 0, 'א\nב\nג\nד\nה').length === 3 && E.setText(base, 0, 'א\nב\nג\nד\nה')[0].lines.length === E.LINES_MAX, 'setText: עד 4 שורות');

  /* ---------- 3. פיצול ומיזוג ---------- */
  const sp = E.splitCue(base, 0, 'שלום לכולם'.length);
  ok(sp.length === 4 && sp[0].lines.join() === 'שלום לכולם' && sp[1].lines.join() === 'וברוכים הבאים' && sp[0].e === sp[1].s && sp[0].s === 1 && sp[1].e === 4,
    'splitCue: במיקום הסמן, הזמן מתחלק בלי רווח ובלי חפיפה');
  ok(sp[0].e > 2 && sp[0].e < 3, 'splitCue: הזמן לפי מספר התווים (' + sp[0].e + ')');
  ok(sp[0].en + ' ' + sp[1].en === 'Hello everyone and welcome' && sp[0].en && sp[1].en, 'splitCue: גם שפת המקור מתחלקת');
  ok(E.splitCue(base, 0, 0)[0].lines.length === 1, 'splitCue: סמן בקצה — באמצע');
  ok(E.splitCue(base, 0, 'שלום לכו'.length)[0].lines.join() === 'שלום לכולם', 'splitCue: סמן באמצע מילה — לרווח הקרוב');
  ok(E.splitCue(base, 2, 2) !== null && E.splitCue([cue(1, 0, 0.3, ['אחת שתיים'])], 0, 3) === null && E.splitCue([cue(1, 0, 5, ['מילה'])], 0, 2) === null, 'splitCue: קצר מדי / מילה אחת — לא');
  const mg = E.mergeCues(base, 0);
  ok(mg.length === 2 && mg[0].s === 1 && mg[0].e === 6 && mg[0].lines.join(' ') === 'שלום לכולם וברוכים הבאים היום נדבר' && E.mergeCues(base, 2) === null, 'mergeCues: עם הבאה (האחרונה — לא)');
  ok(E.deleteCue(base, 1).length === 2 && E.deleteCue(base, 9) === null, 'deleteCue');

  /* ---------- 4. תזמון ---------- */
  ok(E.nudge(base, 1, 's', -0.1)[1].s === 4.1 && E.nudge(base, 1, 's', -1)[1].s === 4, 'nudge: התחלה — לא לתוך הכתובית הקודמת');
  ok(E.nudge(base, 1, 'e', 5)[1].e === 8, 'nudge: סוף — לא לתוך הבאה');
  ok(E.nudge(base, 1, 'e', -5)[1].e === 4.4, 'nudge: לא פחות מ־' + E.MIN_DUR + ' שנ׳');
  ok(E.setEdge(base, 0, 's', -3)[0].s === 0 && E.setEdge(base, 0, 'x', 1) === null && E.setEdge(base, 0, 's', NaN) === null, 'setEdge: לא לפני 0; קצה/זמן לא תקינים');
  ok(E.setEdge(base, 2, 'e', 10) === base, 'setEdge: בלי שינוי = אותו מערך');
  const sh = E.shiftAll(base, 0.5, 1);
  ok(sh[0] === base[0] && sh[1].s === 4.7 && sh[2].e === 10.5, 'shiftAll: מהכתובית והלאה');
  ok(E.shiftAll(base, -2, 1)[1].s === 4, 'shiftAll: לא לתוך הכתובית שלפני');
  ok(E.shiftAll(base, -5)[0].s === 0 && E.shiftAll(base, 0) === null, 'shiftAll: לא לפני 0');

  /* ---------- 5. חיפוש והחלפה ---------- */
  ok(E.findMatches(base, 'נדבר').join() === '1' && E.findMatches(base, ' ').length === 0, 'findMatches');
  const rp = E.replaceAll(base, 'נדבר', 'נשוחח');
  ok(rp.n === 1 && rp.cues[1].lines.join() === 'היום נשוחח' && rp.cues[0] === base[0], 'replaceAll: רק מה שהשתנה');
  ok(E.replaceAll(base, '(.*)', 'x').n === 0 && E.replaceAll(base, 'על', '').cues[2].lines.join() === 'השקעות', 'replaceAll: טקסט רגיל (לא ביטוי רגולרי); שורה שהתרוקנה בחלקה מתנקה');

  /* ---------- 6. ביטול וחזרה ---------- */
  const hst = E.createHistory(base);
  hst.push(E.setText(hst.cur, 1, 'היום נדבר א'), 'txt:1', 1000);
  hst.push(E.setText(hst.cur, 1, 'היום נדבר אב'), 'txt:1', 1500);
  ok(hst.canUndo() && hst.undo() && hst.cur === base && !hst.canUndo(), 'הקלדה רצופה באותה כתובית = צעד ביטול אחד');
  ok(hst.redo() && hst.cur[1].lines.join() === 'היום נדבר אב' && !hst.canRedo(), 'חזרה');
  hst.push(E.mergeCues(hst.cur, 0), '', 9000);
  ok(hst.undo() && hst.cur[1].lines.join() === 'היום נדבר אב', 'פעולה אחרת = צעד נפרד');
  const h2 = E.createHistory(base);
  for (let i = 0; i < E.UNDO_MAX + 20; i++) h2.push(E.nudge(h2.cur, 2, 'e', 0.1), '', i * 9999);
  let u = 0; while (h2.undo()) u++;
  ok(u === E.UNDO_MAX, 'עד ' + E.UNDO_MAX + ' צעדי ביטול');
  ok(!hst.push(null) && !hst.push(hst.cur), 'בלי שינוי — לא נכנס להיסטוריה');

  /* ---------- 7. קבצים (כמו vt) ---------- */
  const srt = E.toSrt(base);
  ok(srt.startsWith('﻿1\n00:00:01,000 --> 00:00:04,000\n‏שלום'), 'toSrt: BOM, זמנים, RLM בתחילת שורה (כמו write_srt של vt)');
  const back = P.normCues(N.parseSrt(srt));
  ok(back.length === 3 && back[2].s === 8 && back[2].lines.join() === 'על השקעות', 'toSrt → parseSrt: אותן כתוביות');
  const js = JSON.parse(E.toCuesJson(E.splitCue(base, 0, 5)));
  ok(js.map((x) => x.id).join() === '1,2,3,4' && js[0].start === 1 && 'en' in js[0] && 'lines' in js[0], 'toCuesJson: הפורמט של cues.final.json, מספור מחדש');
  ok(P.normCues(js).length === 4, 'toCuesJson → normCues (הנגן והעורך קוראים אותו)');
  ok(E.fmtTc(62.44) === '1:02.4' && E.fmtTc(3725) === '1:02:05.0' && E.fmtTc(-1) === '0:00.0', 'fmtTc: עשיריות');
  ok(!/‮/.test(E.toSrt([cue(1, 0, 1, ['א‮ב'])])), 'toSrt: בלי תווי כיווניות מהטקסט');

  /* ---------- 7ב. ייצוא (מ7) ---------- */
  const xv = E.toVtt([cue(1, 1, 2.5, ['שלום <b>&', 'עולם'])]);
  ok(xv.startsWith('WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.500\n\u200fשלום &lt;b&gt;&amp;\n') && !/-->[^ ]/.test(xv.split('\n').slice(4).join('')), 'toVtt: זמנים עם נקודה, RLM, תגיות ו־& בורחים (לא מתפרשים בנגן)');
  const xt = E.toTtml([cue(1, 1, 2.5, ['א <x>', 'ב'])], 'T&"');
  ok(/xml:lang="he"/.test(xt) && /tts:direction="rtl"/.test(xt) && /<p begin="00:00:01\.000" end="00:00:02\.500">א &lt;x&gt;<br\/>ב<\/p>/.test(xt) && /T&amp;&quot;/.test(xt), 'toTtml: עברית מימין לשמאל, XML בטוח');

  /* ---------- 8. העובד — אותו ניקוי וגבולות (translator/rerender.py) ---------- */
  const rr = read('translator/rerender.py');
  ok(/MAX_LINES = 3/.test(rr) && /MIN_DUR = 0\.05/.test(rr) && /from vt\.subs import write_ass, write_ass_compat, write_srt, write_vtt/.test(rr), 'rerender.py: אותן פונקציות של vt build (עיצוב זהה)');

  /* ---------- 9. החיבור לאפליקציה ---------- */
  const sj = read('studio.js');
  ok(/import \{ createSubsEditor, toSrt, toCuesJson, toVtt, toTtml \} from '\.\/studiosubs\.js';/.test(sj) && /'\.\/studiosubs\.js'/.test(read('sw.js')), 'studio.js מייבא את העורך; sw.js שומר אותו לאופליין');
  ok(/x === 'play' \|\| x === 'subs' \|\| x === 'rr' \? \['job', y\]/.test(sj), 'חזור מהעורך / מההפקה — לדף העבודה');
  ok(/if \(ui\.view === 'subs'\) seStop\(\)/.test(sj) && /'subs\|' \+ ui\.param/.test(sj), 'הנגן של העורך נעצר ביציאה; הדף לא נבנה מחדש בזמן הקלדה');
  ok(/net\.api\('cuesSave', \{ job: rec\.id, c, s: s2, ev: rec\.srv\.ev \|\| 0 \}\)/.test(sj) && /\{ snbEdit: 'c' \}/.test(sj), 'שמירה: שני קבצים לתיקיית העבודה ואז cuesSave עם הגרסה (בלי דריסה של שמירה ממקום אחר)');
  ok(/net\.api\('rerender'/.test(sj) && /net\.api\('start', \{ job: j\.job\.id \}\)/.test(sj), 'הפקה מחדש: יצירה ואז start רגיל (כל השמירות)');
  ok(/if \(sj\.kind === 'rr'\) \{/.test(sj), 'עבודות הפקה מחדש — לא ברשימה הראשית');
  const src = read('studiosubs.js');
  // מ9: ביצועים בטלפון חלש (נמדד עם 1,500 כתוביות, מעבד מואט פי 4: בחירה 4 שנ׳ → 67ms, פיצול 2 שנ׳ → 90ms, ביטול 3 שנ׳ → 160ms)
  ok(/const keep = new WeakMap\(\);/.test(src) && /let r = k !== sel \? keep\.get\(c\) : null;/.test(src) && /function choose\(k\)/.test(src) && !/sel = k; paintList\(\)/.test(src),
    'ביצועים: בחירה מציירת שתי שורות; אחרי שינוי מבני — שורות שלא השתנו נשארות ב־DOM (מפתח = אובייקט הכתובית)');
  ok(/\.st-se-row \{[^}]*content-visibility: auto/.test(read('studio.css')), 'ביצועים: שורות מחוץ למסך בלי פריסה (content-visibility)');
  ok(/if \(ONLY === 'studio' \|\| !ONLY\)/.test(read('tools/qa-motion.js')), 'כלי המעברים: תרחישי העורכים (--only studio)');
  ok(/x === 'guide'\) \? \['settings', null\]/.test(sj) && /function pageGuide\(p\)/.test(sj), 'מדריך קצר מההגדרות');
  ok(!/innerHTML/.test(src) && !/fetch\(/.test(src), 'העורך: בלי innerHTML (טקסט רק ב־textContent / value) ובלי רשת');
  // מפתחות התרגום של העורך — בעברית ובאנגלית (הבדיקה של studio-v354 סורקת רק את studio.js)
  const vm = require('vm');
  const sandbox = { localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, classList: { add() {} }, setAttribute() {} }), documentElement: {} }, window: {}, navigator: {}, location: {}, setTimeout, clearTimeout, console };
  vm.createContext(sandbox);
  vm.runInContext(read('app.js') + '\n;globalThis.__S = STRINGS;', sandbox);
  const keys = [...src.matchAll(/(?<![A-Za-z0-9_$])T\(\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]);
  const miss = keys.filter((k) => !sandbox.__S.he[k] || !sandbox.__S.en[k]);
  ok(keys.length > 20 && !miss.length, 'מחרוזות העורך בשתי השפות' + (miss.length ? ': ' + miss.join(',') : ''));
  ok(![...src.matchAll(/(?<![A-Za-z0-9_$])T\(\s*([^'\s)][^,)]*)/g)].length, 'בלי T() דינמי בעורך');
  ok(!/\b(left|right)\s*:/.test(read('studio.css').split('מ2–מ3: עורך הכתוביות')[1]), 'CSS של העורך — רק תכונות לוגיות');

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
