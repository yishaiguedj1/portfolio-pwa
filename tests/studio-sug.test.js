// מ6 (10/10/2026): הצעות לתיקון בעורך הכתוביות (בדיקות הקוד — חינם) ואומדן + אישור לפני כל התחלה (כלל 2).
// הרצה: node tests/studio-sug.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const E = await import(path.join(root, 'studiosubs.js'));
  const P = await import(path.join(root, 'studioplay.js'));
  const cue = (i, s, e, lines) => ({ i, s, e, lines, en: '', spk: '' });
  const cs = [
    cue(1, 1, 2, ['זו כתובית ארוכה מאוד שנאמרת מהר מדי לקריאה נוחה']),   // ארוכה + מהירה → שבירה והארכה
    cue(2, 5, 5.3, ['קצר']),                                               // קצרה → הארכה (גם אחורה)
    cue(3, 5.4, 7, ['שורה']),
    cue(4, 9, 10, ['a', 'b', 'c']),                                        // שלוש שורות → שבירה
    cue(5, 11, 11.2, ['קצרה מאוד כאן']), cue(6, 11.25, 13, ['צמודה']),     // אין מקום → מיזוג
    cue(7, 20, 22, ['this is not translated at all']),                     // אנגלית — לא כאן (גיליון ה־AI)
    cue(8, 30, 33, ['תקינה']),
  ];
  const all = E.suggestions(cs, null, 99);
  ok(JSON.stringify(all.map((g) => [g.i, g.k])) === '[[0,"wrapext"],[1,"ext"],[3,"wrap"],[4,"merge"]]', 'סוגי ההצעות: שבירה+הארכה, הארכה, שבירה, מיזוג; אנגלית ותקינה — בלי');
  ok(all.every((g) => !P.cueIssues(g.cues[g.i]).some((k) => k !== 'en')), 'כל הצעה באמת פותרת את הבעיה');
  ok(all.every((g) => g.cues !== cs && cs[g.i].lines.length) && cs[0].e === 2, 'הצעה = מערך חדש (המקור לא משתנה; "ביטול" רגיל)');
  const ex = all.find((g) => g.k === 'ext').cues;
  ok(ex[1].s >= cs[0].e + E.GAP_MIN - 1e-9 && ex[1].e <= cs[2].s - E.GAP_MIN + 1e-9 && ex[1].e - ex[1].s >= P.Q_MIN_DUR, 'הארכה: לא נוגעת בשכנות (רווח של שני פריימים)');
  ok(all.find((g) => g.k === 'merge').cues.length === cs.length - 1, 'מיזוג: כתובית אחת פחות');
  ok(E.suggestions(cs).length === E.SUG_MAX, 'עד ' + E.SUG_MAX + ' הצעות על המסך');
  const no = new Set([all[0].key]);
  ok(E.suggestions(cs, no, 99)[0].i === 1, '"לא להציע שוב" — לפי טביעה');
  const moved = cs.map((c) => Object.assign({}, c, { s: c.s + 100, e: c.e + 100 }));
  ok(E.suggestions(moved, no, 99)[0].i === 1 && E.sugKey(cs[0], 'wrapext') === all[0].key, 'הטביעה לפי הטקסט והסוג — שורדת הזזה');
  ok(/^[a-z]{2,8}[0-9a-z]{1,8}$/.test(all[0].key), 'הטביעה בלי טקסט (נשמרת במכשיר בלבד)');

  /* ---------- העורך ---------- */
  const src = read('studiosubs.js');
  ok(/const sugEl = el\('div', 'st-sg'\)/.test(src) && /if \(structural\) \{ paintList\(\); paintSug\(\); \}/.test(src), 'פס ההצעות מתעדכן אחרי שינוי מבני (לא בכל הקלדה — בלי קפיצה מתחת לאצבע)');
  const sj = read('studio.js');
  ok(/dismissed: new Set\(store\.sugx \|\| \[\]\), onDismiss:/.test(sj) && /const sugx = \(Array\.isArray\(src\.sugx\)/.test(sj), '"לא להציע שוב" נשמר (pwa_studio_v1 — כבר ב־ACCOUNT_KEYS)');

  /* ---------- אומדן לפני התחלה (כלל 2) ---------- */
  const body = sj.replace(/^export (const|function) /gm, '$1 ').replace(/^import \{([^}]+)\} from '[^']+';$/gm, 'const {$1} = __stubs;');
  const N = await import(path.join(root, 'studionet.js')), ED = await import(path.join(root, 'studioedl.js'));
  const STUBS = { createNet: () => ({}), probeVideo: async () => ({}), extractAudio: async () => ({}), stageEstimates: N.stageEstimates, progressModel: N.progressModel, createBackup: () => ({}), waitOAuthCode: () => {}, normEdl: ED.normEdl, edlDur: ED.edlDur, normPq: (v) => (v === 'auto' || [4320, 2160, 1440, 1080, 720, 480, 360, 240, 144].includes(v) ? v : 'src'), normLadder: () => null };
  const S = new Function('t', '__stubs', body + '\nreturn { startEstimate, NORM_FIXED };')(undefined, STUBS);
  const e1 = S.startEstimate('sonnet-medium', 1800, null, null, false);
  ok(e1.min === 43 && e1.usd === 3 && e1.left === null && !e1.over, 'Routine: זמן (85 דק׳ לשעה × חצי שעה) ושווה ערך בדולרים (כולל העלות הקבועה)');
  ok(/export const NORM_FIXED = 1\.5;/.test(sj) && /const NORM_FIXED = 1\.5;/.test(read('ibkr-proxy/lib/studio.js')), 'NORM_FIXED זהה בטלפון ובשרתון');
  const e2 = S.startEstimate('sonnet-medium', 3600, { 'sonnet-medium': { ph: 4, mx: 6, n: 5 } }, { month: 18, cap: 20 }, true);
  ok(e2.usd === 5.5 && e2.left === 2 && e2.over, 'מצב השרת: "הרגיל" שלך, כמה נשאר החודש, ויותר ממה שנשאר — מסומן');
  ok(S.startEstimate('sonnet-medium', 0, null, null, false).min === 0, 'בלי אורך — בלי אומדן (לא ממציאים)');
  ok(/const est = startEstimate\(spec\.mode, spec\.dur, ui\.norm, ui\.api, apiMode\(\)\);/.test(sj) && /if \(!yes \|\| form !== f\) \{ ui\.starting = false;/.test(sj)
    && sj.indexOf('const est = startEstimate(') < sj.indexOf("const j = await net.api('create', { spec });"), 'האישור לפני שנוצרת עבודה ולפני ההעלאה; "ביטול" — חוזרים לטופס');

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
