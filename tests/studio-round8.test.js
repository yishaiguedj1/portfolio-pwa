// סבב 8: טיוטות העורך בטלפון (IndexedDB), העותק לוואטסאפ גם בעבודה עצמה (ושיתוף ישיר), וייצוא EBU STL.
// הרצה: node tests/studio-round8.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const SB = await import(path.join(root, 'studiosubs.js'));
  const P = await import(path.join(root, 'studioplay.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const st = read('studio.js');

  /* ---------- 1. EBU STL ---------- */
  const cues = [{ s: 1, e: 2.5, lines: ['שלום', 'עולם'] }, { s: 3600 + 61.52, e: 3600 + 63, lines: ['ב־2026 — "ציטוט"…'] }, { s: 70, e: 71, lines: ['שָׁלוֹם €'] }];
  const b = SB.toStl(cues, 'כותרת', Date.UTC(2026, 9, 11));
  const asc = (a, z) => String.fromCharCode(...b.slice(a, z));
  ok(b.length === 1024 + 128 * 3, 'GSI של 1024 בתים + TTI של 128 לכל כתובית');
  ok(asc(0, 3) === '850' && asc(3, 11) === 'STL25.01' && asc(12, 14) === '04' && asc(238, 243) === '00003' && asc(243, 248) === '00003' && asc(274, 277) === 'ISR',
    'GSI: דף קוד 850, STL25.01, טבלת תווים 04 (עברית), 3 בלוקים ו־3 כתוביות, ישראל');
  ok(asc(224, 230) === '261011' && asc(264, 272) === '00000100', 'GSI: תאריך יצירה ותחילת הכתובית הראשונה');
  ok(Array.from(b.slice(16, 21)).join() === '235,229,250,248,250' && b[48] === 0x20, 'GSI: הכותרת בעברית ב־ISO 8859-8, מרופדת ברווחים');
  const tti = (i) => b.slice(1024 + 128 * i, 1024 + 128 * (i + 1));
  const t0 = tti(0);
  ok(t0[0] === 0 && t0[1] === 1 && t0[2] === 0 && t0[3] === 0xff && Array.from(t0.slice(5, 9)).join() === '0,0,1,0' && Array.from(t0.slice(9, 13)).join() === '0,0,2,13',
    'TTI: מספר כתובית (LE), בלוק אחרון, זמני כניסה ויציאה בשעות/דקות/שניות/פריימים (25)');
  ok(t0[13] === 20 && t0[14] === 2, 'שתי שורות — שורה 20, ממורכז');
  ok(Array.from(t0.slice(16, 25)).join() === '249,236,229,237,138,242,229,236,237' && t0[25] === 0x8f && t0[127] === 0x8f,
    'הטקסט: "שלום" ב־8859-8, מעבר שורה 0x8A, השאר 0x8F');
  const t1 = tti(1);
  ok(Array.from(t1.slice(5, 9)).join() === '1,1,1,13' && t1[13] === 22, 'שעה + פריימים מעוגלים; שורה אחת — שורה 22');
  const txt1 = Array.from(t1.slice(16)).filter((x) => x !== 0x8f);
  ok(txt1[0] === 0xe1 && txt1[1] === 0x2d && txt1[7] === 0x2d && txt1.slice(-4).every((x, i) => x === [0x22, 0x2e, 0x2e, 0x2e][i]),
    'מקף עברי → "-", גרשיים → \'"\', שלוש נקודות → "..."');
  const t2 = Array.from(tti(2).slice(16)).filter((x) => x !== 0x8f);
  ok(t2.join() === '249,236,229,237,32,63', 'ניקוד יורד; תו שאין בטבלה → "?"');
  const long = SB.toStl([{ s: 0, e: 1, lines: ['א'.repeat(90), 'ב'.repeat(90)] }]);
  ok(long.length === 1152 && long[1024 + 127] !== 0x8f && long[1024 + 16 + 90] === 0x8a, 'טקסט ארוך — נחתך ב־112 בתים (לא גולש לבלוק הבא)');
  ok(SB.toStl([], 'x').length === 1024, 'בלי כתוביות — רק GSI');
  ok(/toStl\(se\.ed\.cues\(\), ttl, Date\.now\(\)\)/.test(st) && /label: 'EBU STL'/.test(st) && /typeof txt === 'string' \? mime \+ ';charset=utf-8' : mime/.test(st),
    'בעורך: שורת EBU STL בייצוא (קובץ בינארי — בלי charset)');

  /* ---------- 2. טיוטות העורך ---------- */
  const STUBS = Object.assign({}, P, SB, { createNet: () => ({}), probeVideo: async () => ({}), extractAudio: async () => ({}), uploadBoth: async () => {}, stageEstimates: () => ({}),
    progressModel: () => ({ stages: [], left: 0, pct: 0 }), createBackup: () => ({}), waitOAuthCode: () => {} });
  const body = st.replace(/^export (const|function|async function) /gm, '$1 ').replace(/^import \{([^}]+)\} from '[^']+';$/gm, 'const {$1} = __stubs;')
    .replace(/^import \* as (\w+) from '[^']+';$/gm, 'const $1 = __stubs;');
  const X = new Function('t', '__stubs', body + '\nreturn { draftRec, draftUse, DRAFT_MAX, OUTS, shareVideoName };')(undefined, STUBS);
  const cs = P.normCues([{ id: 1, start: 0, end: 1.5, lines: ['שלום'] }, { id: 2, start: 2, end: 3, lines: ['עולם'] }]);
  const d = X.draftRec(cs, 3, 1000);
  ok(d && d.v === 1 && d.ev === 3 && d.at === 1000 && P.normCues(JSON.parse(d.c)).map((c) => c.lines[0]).join() === 'שלום,עולם', 'draftRec: הכתוביות (כמו cues.final.json) + הגרסה שעליה נערכו');
  ok(X.draftUse(d, 3) === 'same' && X.draftUse(d, 5) === 'old' && X.draftUse(d, 2) === '', 'draftUse: אותה גרסה — חוזרת לבד; גרסה ישנה — באישור; חדשה מהשמורה (לא הגיוני) — לא');
  ok(X.draftUse(null, 0) === '' && X.draftUse({ v: 1, ev: 0, c: 'x{' }, 0) === '' && X.draftUse({ v: 1, ev: 0, c: '[]' }, 0) === '' && X.draftUse({ v: 2, ev: 0, c: d.c }, 0) === '',
    'טיוטה פגומה / ריקה / פורמט אחר — מתעלמים');
  ok(X.draftRec([{ s: 0, e: 1, lines: ['א'.repeat(X.DRAFT_MAX)] }], 0, 0) === null, 'טיוטה ענקית — לא נשמרת');
  ok(/indexedDB\.open\('snb-studio', 3\)/.test(st) && /if \(!r\.result\.objectStoreNames\.contains\(n\)\) r\.result\.createObjectStore\(n\)/.test(st) && /IDB_STORES = \['handles', 'drafts', 'thumbs'\]/.test(st),
    'IndexedDB: גרסה 3 — הטיוטות והתמונות הממוזערות במאגרים נפרדים, השדרוג לא מוחק את הידיות');
  ok(/seDraftSoon\(me, rec\); \} \}\);/.test(st) && /}, 1500\);/.test(st), 'שמירת טיוטה שנייה וחצי אחרי העריכה האחרונה');
  ok(/me\.saved = ver;[^\n]*clearTimeout\(me\.drT\); draftDel\(rec\.id\);/.test(st) && /draftDel\(rec\.id\); save\(\); seStop\(\); se = null;/.test(st) && /handleOp\('del', id\); draftDel\(id\);/.test(st),
    'הטיוטה נמחקת אחרי שמירה, שחזור גרסה ומחיקת עבודה');
  ok(/me\.ed\.applyCues\(normCues\(JSON\.parse\(d\.c\)\)\)/.test(st) && /danger: true, onNo: \(\) => draftDel\(rec\.id\)/.test(st), 'חזרה = צעד ביטול אחד; גרסה ישנה — חלון אישור (לא = מחיקה)');

  /* ---------- 3. העותק לוואטסאפ ---------- */
  ok(X.OUTS.join() === 'same,compact,mkv,small' && S.normSpec({ name: 'a.mp4', size: 10, from: 'en', to: ['he'], mode: 'sonnet-medium', out: ['small', 'x'] }).out.join() === 'small',
    'small בטופס ובשרתון (normSpec)');
  const jp = read('translator/job.py');
  ok(/\('small', '\{n\}\.he\.small\.mp4', ' \(עברית, קטן\)\.mp4', 'video\/mp4'\)/.test(jp) && /SMALL_ALT = '\{n\}\.he\.compact\.small\.mp4'/.test(jp) && /SMALL_MB = 28/.test(jp) && /const SMALL_MB = 28;/.test(st),
    'העובד: העותק עולה מהצרוב (מקור או דחוס), 28MB — אותו יעד בטלפון');
  ok(/if \(o\.k === 'small'\) return shareSmall\(rec, o\);/.test(st) && /navigator\.share\(\{ files: \[f\], title: f\.name \}\)/.test(st) && /e\.name === 'NotAllowedError'\) \{ flashSafe\(T\('studioShAgain'\)\)/.test(st),
    'שיתוף הקובץ עצמו (וואטסאפ); אישור הנגיעה פג בזמן ההורדה — הקובץ מוכן לנגיעה הבאה');
  ok(X.shareVideoName({ spec: { name: 'My_Talk 2026.mp4', to: ['he'] } }) === 'My Talk 2026.mp4', 'שם הקובץ לשיתוף — שם הסרטון');
  const nt = read('studionet.js');
  ok(/async function driveBlob\(id, max\)/.test(nt) && /content-length'\)\) > lim\) throw/.test(nt) && /driveText, driveBlob, driveJson/.test(nt), 'studionet.driveBlob: עם תקרת גודל (לא נטען קובץ ענק לזיכרון)');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL - ' + (e && e.stack || e)); process.exit(1); });
