// 20/11/2026 (בקשת המשתמש): בתור — הרבה מקורות יחד באותן הגדרות: בורר מרובה, תיקייה, ZIP, Drive (בחירה מרובה, תיקייה,
// קישור לתיקייה משותפת) ורשימת קישורים. כאן — הפונקציות הטהורות (ZIP בלי ספרייה, קישורים, סינון) והחיווט בטופס
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const st = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
const cut = (a, b) => { const i = st.indexOf(a), j = st.indexOf(b, i); if (i < 0 || j < 0) throw new Error('cut ' + a); return st.slice(i, j); };
const Z = new Function(cut('export const QB_MAX', 'const qbErr =').replace(/export /g, '').replace(/^const qbUse[\s\S]*?(?=\/\* רק סרטונים)/m, '')
  + cut('const zu16 =', '/* בורר זמני').replace(/export /g, '') + '\nreturn { QB_MAX, mediaPick, qbUrls, driveFolderId, zipEocd, zipZ64, zipCd, zipMedia };')();

// 1. סינון: רק סרטונים (בשיר/ניתוח — גם קול), בסדר טבעי, בלי קבצי ._ של מק ובלי קבצים ריקים
const F = (name, size, type, rel) => ({ name, size: size == null ? 10 : size, type: type || '', webkitRelativePath: rel || '' });
const pk = Z.mediaPick([F('ep10.mp4'), F('ep2.mkv'), F('notes.txt'), F('song.mp3'), F('._ep3.mp4'), F('empty.mp4', 0), F('clip', 5, 'video/mp4')], false).map((x) => x.name);
ok(JSON.stringify(pk) === JSON.stringify(['clip', 'ep2.mkv', 'ep10.mp4']), 'mediaPick: סרטונים בלבד, סדר טבעי (2 לפני 10), בלי ._ ובלי ריקים');
ok(Z.mediaPick([F('song.mp3'), F('a.mp4')], true).length === 2 && Z.mediaPick([F('song.mp3')], false).length === 0, 'mediaPick: קול רק בשיר/ניתוח');
ok(Z.mediaPick([F('b.mp4', 1, '', 'S/b/b.mp4'), F('a.mp4', 1, '', 'S/c/a.mp4')], false)[0].name === 'b.mp4', 'mediaPick: מתיקייה — לפי הנתיב המלא');

// 2. רשימת קישורים
const us = Z.qbUrls('https://a.com/v/1\n  https://a.com/v/1 \nראו: https://b.org/x?y=1), וגם http://c.net/z.\njavascript:alert(1)\nftp://x.com/a');
ok(JSON.stringify(us) === JSON.stringify(['https://a.com/v/1', 'https://b.org/x?y=1', 'http://c.net/z']), 'qbUrls: שורה לכל קישור או טקסט חופשי, בלי כפולים, בלי פיסוק בסוף, רק http(s)');
ok(Z.qbUrls('').length === 0 && Z.qbUrls(null).length === 0, 'qbUrls: ריק');

// 3. קישור לתיקייה ב־Drive
const ID = '1AbCdEfGhIjKlMnOpQ_rs-tu';
ok(Z.driveFolderId('https://drive.google.com/drive/folders/' + ID + '?usp=sharing') === ID, 'driveFolderId: drive/folders');
ok(Z.driveFolderId('https://drive.google.com/drive/u/1/folders/' + ID) === ID && Z.driveFolderId('https://drive.google.com/open?id=' + ID) === ID, 'driveFolderId: u/N ו־open?id');
ok(Z.driveFolderId('https://drive.google.com/file/d/' + ID + '/view') === '' && Z.driveFolderId('סרטים') === '' && Z.driveFolderId('https://evil.com/drive.google.com/x') === '', 'driveFolderId: קובץ בודד / טקסט / דומיין אחר — לא תיקייה');
ok(Z.QB_MAX === 40, 'QB_MAX = 40 (= PhCore.Q_MAX)');

// 4. ZIP — כותב קטן לבדיקה (stored + deflate, תיקיות, __MACOSX, מוצפן)
function zip(ents) {
  const loc = [], cd = []; let off = 0;
  for (const e of ents) {
    const name = Buffer.from(e.name), raw = Buffer.from(e.data || '');
    const m = e.m == null ? 0 : e.m, comp = m === 8 ? zlib.deflateRawSync(raw) : raw;
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(e.enc ? 1 : 0x800, 6); lh.writeUInt16LE(m, 8);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(e.enc ? 1 : 0x800, 8); c.writeUInt16LE(m, 10);
    c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(off, 42);
    loc.push(lh, name, comp); cd.push(c, name);
    off += 30 + name.length + comp.length;
  }
  const cdb = Buffer.concat(cd), eo = Buffer.alloc(22);
  eo.writeUInt32LE(0x06054b50, 0); eo.writeUInt16LE(ents.length, 8); eo.writeUInt16LE(ents.length, 10); eo.writeUInt32LE(cdb.length, 12); eo.writeUInt32LE(off, 16);
  return Buffer.concat([...loc, cdb, eo]);
}
const big = 'V'.repeat(5000);
const zb = zip([{ name: 'סדרה/פרק 2.mp4', data: 'AAAA' }, { name: 'סדרה/פרק 10.mkv', data: big, m: 8 }, { name: 'סדרה/', data: '' }, { name: '__MACOSX/סדרה/._פרק 2.mp4', data: 'x' },
  { name: 'readme.txt', data: 'hi' }, { name: 'secret.mp4', data: 'S', enc: 1 }, { name: 'song.mp3', data: 'M' }]);
const e = Z.zipEocd(new Uint8Array(zb));
ok(e && e.n === 7 && e.z64 == null, 'zipEocd: מוצא את סוף הספרייה');
const cd = Z.zipCd(new Uint8Array(zb.subarray(e.cdOff, e.cdOff + e.cdSize)), e.n);
ok(cd.length === 7 && cd[0].name === 'סדרה/פרק 2.mp4' && cd[1].m === 8 && cd[1].us === 5000 && cd[5].enc, 'zipCd: שמות בעברית (UTF-8), שיטה, גודל, מוצפן');
ok(Z.zipEocd(new Uint8Array(100)) === null, 'zipEocd: לא ZIP — null');
// ZIP64: שדה extra עם הגודל והמיקום
const c64 = Buffer.alloc(46 + 1 + 4 + 24); c64.writeUInt32LE(0x02014b50, 0); c64.writeUInt32LE(0xffffffff, 20); c64.writeUInt32LE(0xffffffff, 24);
c64.writeUInt16LE(1, 28); c64.writeUInt16LE(28, 30); c64.writeUInt32LE(0xffffffff, 42); c64.write('a', 46);
c64.writeUInt16LE(1, 47); c64.writeUInt16LE(24, 49); c64.writeUInt32LE(0, 51); c64.writeUInt32LE(2, 55); c64.writeUInt32LE(7, 59); c64.writeUInt32LE(1, 63); c64.writeUInt32LE(5, 67);
const z64 = Z.zipCd(new Uint8Array(c64), 1)[0];
ok(z64.us === 2 * 2 ** 32 && z64.cs === 7 + 2 ** 32 && z64.lho === 5, 'zipCd: ZIP64 — גודל ומיקום מעל 4GB');
const loc = Buffer.alloc(20 + 22); loc.writeUInt32LE(0x07064b50, 0); loc.writeUInt32LE(1234, 8); loc.writeUInt32LE(0x06054b50, 20); loc.writeUInt16LE(0xffff, 30);
ok(Z.zipEocd(new Uint8Array(loc)).z64 === 1234, 'zipEocd: ZIP64 — המיקום של הרשומה');
const r64 = Buffer.alloc(56); r64.writeUInt32LE(0x06064b50, 0); r64.writeUInt32LE(70, 32); r64.writeUInt32LE(900, 40); r64.writeUInt32LE(3, 52);
const zz = Z.zipZ64(new Uint8Array(r64));
ok(zz.n === 70 && zz.cdSize === 900 && zz.cdOff === 3 * 2 ** 32, 'zipZ64');

(async () => {
  const blob = new Blob([zb]);
  const vids = await Z.zipMedia(blob, false);
  ok(vids.length === 2 && vids[0].name === 'פרק 2.mp4' && vids[1].name === 'פרק 10.mkv', 'zipMedia: רק סרטונים (בלי תיקייה, __MACOSX, טקסט, מוצפן)');
  ok(await vids[0].text() === 'AAAA' && await vids[1].text() === big, 'zipMedia: התוכן — חתיכה מהקובץ (stored) ופריסה (deflate)');
  ok((await Z.zipMedia(blob, true)).some((x) => x.name === 'song.mp3'), 'zipMedia: בשיר — גם קול');
  let thr = false; try { await Z.zipMedia(new Blob([Buffer.alloc(64)]), false); } catch (x) { thr = x.code === 'zip'; }
  ok(thr, 'zipMedia: לא ZIP — שגיאה zip');

  // 5. החיווט בטופס
  ok(/if \(f && f\.qd && qbN\(f\) && !ui\.starting && !f\.qgo\) return quBatchGo\(f\);/.test(cut('function startFromForm', 'if (f && f.subs && !ui.starting)')), 'startFromForm: בתור עם כמה מקורות — quBatchGo');
  ok(/if \(quiet\) return true;/.test(cut('function quHold', 'function quDrMenu')), 'quHold: quiet — בלי הודעה ומעבר לכל אחד');
  const qf = cut('const QB_SRC', 'async function qbSpec');
  for (const k of ['fileObj', 'drive', 'link', 'edl', 'trk', 'sa', 'qb', 'subs', 'ph', 'id']) ok(qf.includes("'" + k + "'"), 'qbForm: העותק בלי ' + k + ' של המקור הראשון');
  ok(/to: 'cloud'/.test(qf) && /blind: blind \? 1 : 0/.test(qf), 'qbForm: קישור — לענן; בלי בדיקה = העובד בוחר (הכי טוב עד 1080)');
  ok(/const rec = linkRec\(j\.probe\.r\)/.test(cut('async function qbProbe1', 'const qbErr')), 'קישורים: האיכות = linkRec (1080 או מתחתיו)');
  ok(/\(f\.qd && !f\.subs && !f\.ph\) \{ dpToggle\(f, x\); return; \}/.test(st) && /const fid = driveFolderId\(sq\.value\);/.test(st), 'Drive: בחירה מרובה בתור, וקישור לתיקייה בשדה החיפוש');
  ok(/qbm && fs\.length > 1/.test(st) && /if \(canPickHandle\(\) && !qbm\)/.test(st), 'הבורר הראשי בתור — מרובה (בלי showOpenFilePicker של קובץ אחד)');
  ok(/'link', 'qlinks', 'linkfmt'/.test(st) && /v === 'qlinks'/.test(st) && /ui\.view === 'qlinks'\) pageQLinks\(p\)/.test(st), 'qlinks: בנתב, בלי החלקה, ובריענון — חזרה לטופס');
  // 6. כתוביות לכל מקור — אותה שרשרת כמו בסרטון בודד, ועריכה לכל עבודה
  const tk = cut('async function qbTrk(x)', '/* ZIP');
  ok(/net\.subsFind\(file, file\.name/.test(tk) && /nsCache/.test(tk) && /listTracks\(file\)/.test(tk) && /trkSet\(g, file, L\.tracks, !file\.remote\)/.test(tk) && /nsMerge\(g, file\)/.test(tk), 'qbTrk: מהרשת (subsFind, אותו מטמון) ומהקובץ (listTracks → trkSet → nsMerge) — כמו tracksFor');
  ok(/if \(x\.g\) Object\.assign\(g, \{ trk: x\.g\.trk, ns: x\.g\.ns/.test(st), 'qbForm: העבודה מקבלת את הכתוביות שנמצאו');
  ok(/x\.pp !== 2\) && Date\.now\(\) - t0 < QB_TRK_WAIT/.test(cut('async function quBatchGo', 'function pageQLinks')), 'quBatchGo: מחכה לכתוביות לפני השמירה');
  const mn = cut('function quDrPrep', 'function quDrSub');
  ok(/tracksFor\(f, f\.fileObj\)/.test(mn) && /inspectFor\(f, f\.fileObj\)/.test(mn) && /quDrOpen\(it, 'tracks'\)/.test(mn) && /quDrOpen\(it, 'cutsrc'\)/.test(mn), 'עריכת עבודה מהתור: הגדרות, כתוביות, חיתוך — עם הבדיקות של הקובץ');
  // 20/11/2026: בתוך Studio לאנדרואיד — בחירה מרובה באפליקציה (ההעלאה ממנה) ויוטיוב שיורד בטלפון
  {
    const ql = cut('export function phQList', 'const qdrClone');
    const Q = new Function('btoa', ql.replace(/export /g, '') + '\nreturn phQList;')((t) => Buffer.from(t, 'binary').toString('base64'));
    const P = 'p0123456789abcdef', J = 'j' + 'A'.repeat(20), K = 'k'.repeat(43), U = 'https://www.youtube.com/watch?v=aB_c-1&t=5';
    ok(Q([{ p: P, j: J, k: K }]) === P + '.' + J + '.' + K, 'phQList: בלי קישור — כמו קודם (phq)');
    const it = Q([{ p: P, j: J, k: K, u: U }]).split('.');
    ok(it.length === 4 && Buffer.from(it[3], 'base64url').toString() === U && /^[A-Za-z0-9_-]+$/.test(it[3]), 'phQList: קישור — base64url בסוף (= PhCore.qItem)');
    ok(Q([{ p: P, j: J, k: K, u: 'javascript:alert(1)' }]) === '', 'phQList: רק http(s)');
    const pr = cut('async function qbProbe1', 'const qbErr =');
    ok(/if \(!ui\.yc && ytHost\(x\.u\)\) \{ if \(qbYdOk\(f\)\) Object\.assign\(x, \{ st: 'ok', yd: 1 \}\)/.test(pr) && pr.indexOf('ytHost') < pr.indexOf('if (!ui.url)'), 'יוטיוב בתור: בתוך האפליקציה — יורד בטלפון (גם בלי השרת)');
    const fm = cut('function qbForm', 'async function qbSpec');
    ok(/ph: \{ pid: phPidNew\(\), nu: 1, yd: 1, u: x\.u/.test(fm) && /x\.t === 'p'\) Object\.assign\(g, \{ ph: Object\.assign\(\{\}, x\.ph\)/.test(fm), 'qbForm: יוטיוב ובחירה מהאפליקציה — עבודה דרך האפליקציה (ph.nu)');
    ok(/if \(g\.ph\) return g\.ph\.nu \? phSpecOf\(g\) : null;/.test(st) && /if \(P\.nu && P\.yd\) spec\.yd = 1;/.test(st), 'qbSpec → phSpecOf, ועם yd');
    ok(/phIntent\('phq2', \{ b: proxyBase\(\), q \}, 'yqold'\)/.test(st) && /if \(r\.e === 'yqold'\) \{ flashSafe\(T\('studioQbYdOld'\)\); phYdDrop\(\);/.test(st), 'phq2 — Studio ישן מחזיר yqold: הודעה ומחיקת העבודות שלא יתחילו');
    ok(/nuPickOk\(f\) \? \{ k: 'qb-app'/.test(st) && /nuPick\(true, true\)/.test(st) && /const qbm = qbUse\(f\);/.test(st), 'בורר מרובה דרך האפליקציה — בשורה "כמה קבצים" ובבורר הראשי בתור');
    const pk2 = cut('export function studioPhPicks', '/* Studio ישן קיבל phq2');
    ok(/if \(!qa\) \{ studioPhPick\(parts\[0\]\); rest = parts\.slice\(1\); \}/.test(pk2) && /t: 'p', ph: \{ pid: r\.pid/.test(pk2), '‎#phpicks=: הראשון לטופס (או הכל לרשימה), השאר — פריטי p');
    const pid = new Function('crypto', cut('export const phPidNew', '/* "להוסיף N').replace('export ', '') + '\nreturn phPidNew;')(require('crypto').webcrypto)();
    ok(/^p[0-9a-f]{16}$/.test(pid), 'phPidNew = PhCore.PID_RE');
    const app = fs.readFileSync(path.join(__dirname, '..', 'studio-app.js'), 'utf8');
    ok(/if \(pks\) studioPhPicks\(pks\);/.test(app) && /if \(phpicks\) studioPhPicks\(phpicks\);/.test(app), 'studio-app: ‎#phpicks= בטעינה ובשינוי hash');
    const D = 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/', A = (f) => fs.readFileSync(path.join(__dirname, '..', D + f), 'utf8');
    ok(/EXTRA_ALLOW_MULTIPLE/.test(A('PhActivity.kt')) && /"#phpicks=" \+ ok\.joinToString\("~"\)/.test(A('PhActivity.kt')), 'האפליקציה: בחירה מרובה → ‎#phpicks=');
    ok(/fun idOf\(pid: String\)/.test(A('PhUpJob.kt')) && /JobInfo\.Builder\(idOf\(pid\)/.test(A('PhUpJob.kt')), 'PhUpJob: משימה לכל סרטון (מזהה קבוע אחד החליף את הקודם — בתור רק האחרון עלה)');
    ok(/vLock\.tryAcquire/.test(A('PhWork.kt')) && /PhYt\.fetch\(ctx, pid, r, stopped\)/.test(A('PhWork.kt')), 'PhWork: הסרטונים עולים אחד אחרי השני; קישור יורד לפני הקול');
    ok(/DlProbe\.DEFAULT_H/.test(A('PhYt.kt')) && /subs = DlEngine\.SUBS/.test(A('PhYt.kt')), 'PhYt: ברירת המחדל של הורדה מקישור (1080, הקול הטוב ביותר, כתוביות היוצר)');
    ok(/android:host="phq2"/.test(fs.readFileSync(path.join(__dirname, '..', 'android/app/src/studio/AndroidManifest.xml'), 'utf8')), 'phq2 במניפסט');
  }
  console.log('# ' + n + ' בדיקות');
})().catch((x) => { console.error('FAIL - ' + x.stack); process.exit(1); });
