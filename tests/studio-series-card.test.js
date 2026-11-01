// A1 + A5 (1/11/2026): כרטיס הסדרה בטלפון ותיקון לאחור בין פרקים — העריכה בשרתון (smEdit, x = מה שנמחק לא חוזר),
// מפתח הסדרה בטלפון זהה לשרתון, השוואת הכרטיס לפני/אחרי, החלפת כתיב בעברית עם אותיות השימוש, והחיבור בדפים.
// מסלול ה־API המלא (smGet/smEdit מול R2 מדומה) — tests/studio-r2-flow.test.js סעיף 7ב.
// הרצה: node tests/studio-series-card.test.js
const path = require('path');
const fs = require('fs');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));

(async () => {
  const C = await import(path.join(root, 'studiosubs.js'));
  // 1. מפתח הסדרה — אותו דבר בטלפון ובשרתון
  for (const nm of ['How.I.Met.Your.Mother.S01E02.720p.mkv', 'How I Met Your Mother - 1x05 - Okay.avi', 'The.Office.US.2005.S02E01.mp4', 'Lost Season 2 - S02E04.mkv', 'איך פגשתי את אמא עונה 1 S01E03.mp4', 'interview.mp4', 'S01E01.mkv']) {
    const a = S.seriesOf(nm), b = C.seriesOfName(nm);
    ok((a && a.k) === (b && b.k) && (a ? a.e === b.e : b === null), 'מפתח הסדרה זהה לשרתון: ' + nm);
  }
  ok(C.seriesOfName('Show.S02E07.mkv').s === 2, 'מספר העונה (למיון הפרקים)');

  // 2. smEdit
  const ser = S.seriesOf('Show.S01E01.mkv');
  let d = S.smMerge({}, ser, { gl: [['Scherbatsky', 'שרבטסקי'], ['Metro', 'מטרו']], ch: [['רובין', 'm', ''], ['טד', 'm', 'מספר']] }, 10);
  const e1 = S.smEdit(d, 'show', { gl: [['scherbatsky', 'שרבצקי']], ch: [['רובין', 'f']] }, 20);
  ok(e1.s.show.gl[0][1] === 'שרבצקי' && e1.s.show.gl.length === 2 && e1.s.show.ch[0][1] === 'f' && e1.s.show.at === 20, 'עריכה מחליפה שורה קיימת (בלי קשר לאותיות גדולות)');
  ok(S.smEdit(d, 'show', {}, 20) === null && S.smEdit(d, 'nope', { gl: [['A', 'א']] }, 20) === null && S.smEdit(d, 'show', { gl: [['x://y', 'z']] }, 20) === null, 'בלי שינוי תקין / סדרה לא קיימת — null');
  ok(S.smEdit(d, 'show', { gl: [['A', 'א']] }, 5).s.show.at === 11, 'at תמיד עולה (גרסה)');
  let e2 = S.smEdit(e1, 'show', { glx: ['Metro'], chx: ['טד'] }, 30);
  ok(e2.s.show.gl.length === 1 && e2.s.show.ch.length === 1 && e2.s.show.x.includes('metro') && e2.s.show.x.includes('טד'), 'מחיקה — נכנסת ל־x');
  e2 = S.smParse(JSON.stringify(e2));
  ok(e2.s.show.x.length === 2, 'x נשמר בקובץ');
  const e3 = S.smMerge(e2, S.seriesOf('Show.S01E02.mkv'), { gl: [['Metro', 'מטרו'], ['New', 'חדש']], ch: [['טד', 'm', '']] }, 40);
  ok(!e3.s.show.gl.some((r) => r[0] === 'Metro') && e3.s.show.gl.some((r) => r[0] === 'New') && !e3.s.show.ch.some((r) => r[0] === 'טד'), 'מה שמחקת לא חוזר מהפרק הבא');
  const e4 = S.smEdit(e3, 'show', { gl: [['Metro', 'מטרו ניוז']] }, 50);
  ok(e4.s.show.gl.some((r) => r[0] === 'Metro') && !e4.s.show.x.includes('metro'), 'הוספה מחדש — יוצא מ־x');
  ok(!S.smForWorker(e4, S.seriesOf('Show.S01E03.mkv')).x, 'x לא נשלח לעובד');
  ok(Object.keys(S.smEdit(e4, 'show', { drop: true }, 60).s).length === 0, 'drop — הסדרה כולה');
  ok(S.smEdit(d, 'show', { gl: Array.from({ length: 40 }, (_, i) => ['T' + i, 'ט' + i]) }, 20).s.show.gl.length === 2 + S.SM_EDIT_MAX, 'עד SM_EDIT_MAX שורות בעריכה');
  const v = S.smView(S.smMerge(e4, S.seriesOf('Other.S01E01.mkv'), { gl: [['A', 'א']] }, 70));
  ok(v.length === 2 && v[0].k === 'other' && !('x' in v[0]), 'smView — החדשה ראשונה, בלי x');

  // 3. A5 — מה השתנה, והחלפה בכתוביות
  const ch = C.smChanges({ gl: [['Scherbatsky', 'שרבטסקי'], ['Metro', 'מטרו']], ch: [['רובין', 'm', ''], ['טד', 'm', '']] },
    { gl: [['Scherbatsky', 'שרבצקי'], ['Metro', 'מטרו']], ch: [['רובינה', 'm', ''], ['טד', 'f', '']] });
  ok(JSON.stringify(ch.rep) === JSON.stringify([['שרבטסקי', 'שרבצקי'], ['רובין', 'רובינה']]) && JSON.stringify(ch.gen) === JSON.stringify([['טד', 'm', 'f']]), 'smChanges — כתיב, שינוי שם ומגדר');
  ok(C.smChanges({ gl: [['A', 'א']] }, { gl: [['A', 'א'], ['B', 'ב']] }).rep.length === 0, 'הוספה בלבד — אין מה להחליף');
  ok(C.heReplace('ושרבטסקי אמר לשרבטסקיה. שרבטסקי!', 'שרבטסקי', 'שרבצקי')[0] === 'ושרבצקי אמר לשרבטסקיה. שרבצקי!', 'החלפה: אותיות שימוש כן, מילה ארוכה יותר לא');
  ok(C.heReplace("במקלרנ'ס", "מקלרנ'ס", 'מקלרנס')[1] === 1 && C.heReplace('a.b', 'a.b', 'x')[0] === 'x' && C.heReplace('axb', 'a.b', 'x')[1] === 0, 'תווים מיוחדים — כפשוטם');
  const cues = [{ s: 0, e: 1, lines: ['שלום שרבטסקי'] }, { s: 1, e: 2, lines: ['אין כאן', 'וגם לא כאן'] }, { s: 2, e: 3, lines: ['לרובין יש', 'שרבטסקי'] }];
  const r = C.cuesReplace(cues, ch.rep);
  ok(r.hit === 2 && r.cues[0].lines[0] === 'שלום שרבצקי' && r.cues[2].lines[0] === 'לרובינה יש' && r.cues[1] === cues[1] && cues[0].lines[0] === 'שלום שרבטסקי', 'cuesReplace — רק המושפעות, המקור לא משתנה');
  ok(C.cuesWith(cues, 'רובין') === 1 && C.cuesWith(cues, 'טד') === 0, 'cuesWith — בכמה כתוביות השם מופיע');

  // 4. החיבור
  const sj = fs.readFileSync(path.join(root, 'studio.js'), 'utf8'), api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/op === 'smGet' \|\| op === 'smEdit'/.test(api) && /S\.smKey\(uid\)/.test(api.slice(api.indexOf("op === 'smGet' ||"), api.indexOf("op === 'smGet' ||") + 900)), 'השרתון: רק הקובץ של המשתמש (uid מהטוקן)');
  ok(/limited\('sm:' \+ uid/.test(api), 'השרתון: הגבלת קצב לעריכה');
  ok(require(path.join(root, 'ibkr-proxy/lib/appscope.js')).scopeFor('studio', 'smEdit').join() === 'studio', 'SCOPE: רק מ־Studio');
  ok(/else if \(ui\.view === 'series'\) pageSeries\(p\)/.test(sj) && /else if \(ui\.view === 'ser'\) pageSer\(p\)/.test(sj) && /go\('series'\)/.test(sj), 'הדפים מחוברים');
  ok(/x === 'ser' \? \['series', null\]/.test(sj), '"חזור": סדרה ← סדרות ← חוקים');
  const fx = sj.slice(sj.indexOf('async function smFixRun'), sj.indexOf('function smFixCard'));
  ok(/net\.driveJson/.test(fx) && /net\.api\('cuesSave'/.test(fx) && !/smEdit|smGet/.test(fx), 'A5: הכתוביות מ־Drive ונשמרות כמו בעורך — לא דרך הכרטיס בשרתון');
  ok(/on: hit > 0 && !\(\(r\.srv\.ev \|\| 0\) > 0\)/.test(sj), 'A5: פרק שנערך ידנית — לא מסומן מראש');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
