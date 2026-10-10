// Google Drive כמקור וכיעד (10/10/2026, בקשת המשתמש): סרטון שכבר ב־Drive מתחיל עבודה בלי העלאה, ובסוף — התוצר לתיקייה שבחרת.
// הרשאת הסטודיו נשארת drive.file: הגישה היא רק לקובץ / לתיקייה שבחרת ב־Google Picker. הרצה: node tests/studio-drive.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const N = await import(path.join(root, 'studionet.js'));
  const ED = await import(path.join(root, 'studioedl.js'));
  const st = read('studio.js');
  const body = st.replace(/^export (const|function) /gm, '$1 ').replace(/^import \{([^}]+)\} from '[^']+';$/gm, 'const {$1} = __stubs;');
  const STUBS = { createNet: () => ({}), probeVideo: async () => ({}), extractAudio: async () => ({}), stageEstimates: N.stageEstimates, progressModel: N.progressModel,
    createBackup: () => ({}), waitOAuthCode: () => {}, normEdl: ED.normEdl, edlDur: ED.edlDur, normPq: (v) => v || 'src', normLadder: () => null };
  const S = new Function('t', '__stubs', body + '\nreturn { normPicker, normDraft, newDraft, normJob };')(undefined, STUBS);

  /* ---------- הגדרות ה־Picker מהשרתון ---------- */
  ok(S.normPicker({ key: 'TESTpickerKEYtestPICKERkey000', app: '123456789012' }).app === '123456789012', 'מפתח + מספר פרויקט תקינים');
  ok(S.normPicker(null) === null && S.normPicker({ key: '<x>', app: '1' }) === null, 'בלי הגדרה / ערכים לא תקינים — בלי כפתור Drive');

  /* ---------- טיוטה ועבודה ---------- */
  const dr = S.normDraft({ id: 'abcd1234', name: 'הרצאה.mkv', size: 900, drive: { id: 'mydrive1234567', dur: 3600 } });
  ok(dr.drive.id === 'mydrive1234567' && dr.drive.dur === 3600, 'טיוטה זוכרת שהמקור ב־Drive (בלי לבחור שוב)');
  ok(!('drive' in S.normDraft({ id: 'abcd1234', name: 'x', drive: { id: 'bad id!' } })), 'מזהה Drive לא תקין — נזרק');
  const fm = { file: { name: 'a.mp4', size: 5, type: 'video/mp4' }, drive: { id: 'mydrive1234567', dur: 61 }, from: 'auto', to: ['he'], mode: 'sonnet-medium', out: { same: true }, style: 'bold', terms: '' };
  ok(S.newDraft(fm, 1, 'abcd1234').drive.id === 'mydrive1234567', 'שמירת טיוטה מהטופס — עם המקור מ־Drive');
  const jb = S.normJob({ id: 'j' + 'A'.repeat(20), spec: { name: 'a.mp4', size: 5 }, up: { ext: true, extReg: true, noAudio: 'drive', v: { done: true, id: 'mydrive1234567', size: 5 },
    dx: { f: 'destFolder1234', n: 'תרגומים', at: 9 } } });
  ok(jb.up.ext && jb.up.extReg && jb.up.v.done && jb.up.noAudio === 'drive', 'עבודה ממקור ב־Drive: בלי העלאה ובלי קול נפרד');
  ok(jb.up.dx.f === 'destFolder1234' && jb.up.dx.n === 'תרגומים', 'זוכרת לאן נשמר התוצר');
  ok(S.normJob({ id: 'j' + 'A'.repeat(20), up: { dx: { f: 'x' } } }).up.dx === null, 'יעד לא תקין — נזרק');

  /* ---------- Drive בטלפון: פרטים, העברה, העתקה ---------- */
  const calls = [];
  const fetch = async (url, o) => {
    calls.push([url, o && o.method || 'GET', o && o.body]);
    if (url.endsWith('/api/studio')) return { status: 200, ok: true, json: async () => ({ ok: true, token: 'TOK', exp: Date.now() + 3600e3 }) };
    return { status: 200, ok: true, json: async () => ({ id: 'X', name: 'הרצאה.mkv', size: '900', mimeType: 'video/x-matroska', videoMediaMetadata: { durationMillis: '61000' } }) };
  };
  const net = N.createNet({ fetch, put: async () => ({}), sleep: async () => {}, base: () => 'https://proxy.example', idToken: async () => 'ID', online: () => true, now: () => Date.now() });
  const m = await net.driveMeta('mydrive1234567');
  ok(m.videoMediaMetadata.durationMillis === '61000' && /files\/mydrive1234567\?fields=id,name,size,mimeType,trashed,videoMediaMetadata/.test(calls[1][0]), 'פרטי הסרטון מ־Drive (כולל אורך) — בלי להוריד');
  await net.driveMove('outvid12345678', 'jobfolder12345', 'destFolder1234');
  const mv = calls[calls.length - 1];
  ok(mv[1] === 'PATCH' && /outvid12345678\?addParents=destFolder1234&removeParents=jobfolder12345/.test(mv[0]), 'הסרטון המתורגם עובר (PATCH addParents/removeParents) — בלי עותק נוסף');
  await net.driveCopy('outsrt12345678', 'destFolder1234', 'הרצאה.he.srt');
  const cp = calls[calls.length - 1];
  ok(cp[1] === 'POST' && /outsrt12345678\/copy/.test(cp[0]) && JSON.parse(cp[2]).parents[0] === 'destFolder1234', 'הכתוביות מועתקות (המקור נשאר לעורך ולסט הזהב)');
  let threw = 0;
  for (const f of [() => net.driveMove('a/b', 'jobfolder12345', 'destFolder1234'), () => net.driveCopy('outsrt12345678', '../x', 'n'), () => net.driveMeta('?q=1')]) { try { await f(); } catch (e) { threw++; } }
  ok(threw === 3, 'מזהים לא תקינים — לא יוצאת בקשה');

  /* ---------- החיבור ---------- */
  ok(/register\(id, 'v', up\.v\.id, up\.folder, true\)/.test(st) && /ext \? \{ ext: true \} : \{\}/.test(st), 'מקור מ־Drive — רישום בשרתון עם ext (מאומת שם: קיים, סרטון, בגודל)');
  ok(/const pr = f\.fileObj \? await probeVideo\(file\) : \{ dur: f\.drive\.dur \|\| 0 \}/.test(st), 'בלי לקרוא את הקובץ בטלפון — האורך מ־Drive');
  ok(/DocsView\(G\.ViewId\.DOCS_VIDEOS\)/.test(st) && /setSelectFolderEnabled\(true\)/.test(st) && /setAppId\(cfg\.app\)/.test(st), 'Google Picker: סרטונים / תיקייה, עם מספר הפרויקט (הרשאה לקובץ שנבחר)');
  ok(/v\.setMode\(G\.DocsViewMode\.LIST\)/.test(st) && /for \(const v of views\) pb\.addView\(v\)/.test(st), 'ה־Picker: רשימה (שם, תאריך, גודל) — בלי ריבועי תמונה ממוזערת');
  ok(/setParent\('root'\), T\('studioPkMine'\)\)/.test(st) && /setStarred\(true\), T\('studioPkStar'\)\)/.test(st) && /T\('studioPkVideos'\)/.test(st), 'ה־Picker: לשוניות — סרטונים · התיקיות שלי · מסומנים בכוכב');
  ok(/typeof v\.setLabel === 'function'/.test(st), 'ה־Picker: שם ללשונית רק כשהגרסה של Google תומכת');
  ok(/if \(pickerClose\(\)\) \{ if \(root\) watch\(\); return; \}/.test(st), '"חזור" כשה־Picker פתוח — סוגר רק אותו');
  ok(/rec\.up\.ext\) \{ if \(\(!rec\.up\.extReg \|\| !rec\.up\.started\) && st === 'new'/.test(st), 'פתיחה מחדש: עבודה מ־Drive שלא נרשמה / התחילה — ממשיכה לבד');
  ok(/for \(const o of vids\) await net\.driveMove/.test(st) && /await net\.driveCopy\(srt\.id/.test(st), 'בסוף: הסרטון עובר, הכתוביות מועתקות');
  const idx = read('index.html'), css = read('studio.css');
  ok(/frame-src[^;]*https:\/\/docs\.google\.com/.test(idx) && /script-src[^;]*https:\/\/apis\.google\.com/.test(idx), 'CSP: ה־Picker (docs.google.com) והסקריפט שלו (apis.google.com)');
  ok(/\.picker-dialog \{ z-index: 1101 !important; \}/.test(css), 'ה־Picker מעל שכבת הסטודיו (900)');
  const job = read('translator/job.py');
  ok(/\(\(ctx\.st\.get\('files'\) or \{\}\)\.get\('v'\) or \{\}\)\.get\('ext'\)/.test(job) && /v\.get\('ext'\)/.test(job), 'העובד: מקור מ־Drive — לא נוגעים בקובץ שלך (בלי החלפה לאיכויות)');
  const app = read('app.js');
  for (const k of ['studioFromDrive', 'studioFromDriveSub', 'studioInDrive', 'studioInDriveNote', 'studioFromDriveBad', 'studioStartNoteDrive', 'studioDxPickT', 'studioDxT', 'studioDxSub', 'studioDxDone', 'studioDxErr', 'studioDxBusy', 'studioPkVideos', 'studioPkMine', 'studioPkStar'])
    ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בשתי השפות: ' + k);
  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
