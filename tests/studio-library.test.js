// ספריית הסרטונים ב־Drive שלך (17/11/2026, docs/studio-library-research.md): המניפסט (= translator/job.py lib_manifest),
// מה נשלח לשמירה (= normLibDx בשרתון), הלשונית בחוגה וההחלפה של "הסרטונים שלי".
// הרצה: node tests/studio-library.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const R = 'R2_jLIBjobAAAAAAAAAAAAAA';

(async () => {
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k) => k;
  const st = await import(path.join(root, 'studio.js'));
  const sj = read('studio.js'), py = read('translator/job.py'), srv = read('ibkr-proxy/lib/studio.js');

  /* ---------- 1. המניפסט ---------- */
  const man = { v: 1, job: 'jLIBjobAAAAAAAAAAAAAA', t: 'הרצאה', k: 'tr', fr: 'en', to: ['he'], d: 61.4, ch: [{ t: 0, n: 'פתיחה' }, { t: -3, n: 'רע' }, { t: 9, n: '' }], at: 5,
    f: [{ r: 'b', k: 'compact', n: 'a.mp4', id: 'driveFile12345', s: 9, md5: 'x' }, { r: 'z', k: 'srt', n: 'a.srt', id: 'driveFile67890', s: 1 }, { r: 'v', id: R + '_aaaaaaaaaaaa' }, { r: 'v', id: 'bad id' }] };
  const m = st.normLibMan(man);
  ok(m && m.job === man.job && m.t === 'הרצאה' && m.fr === 'en' && m.to.join() === 'he' && m.d === 61, 'normLibMan: השדות המוכרים');
  ok(m.ch.length === 1 && m.ch[0].n === 'פתיחה', 'normLibMan: פרק עם זמן שלילי / בלי שם — נזרק');
  ok(m.f.length === 2 && m.f[1].r === 'x' && !m.f.some((x) => x.id.startsWith('R2_')), 'normLibMan: רק קבצים ב־Drive; תפקיד לא מוכר → x');
  ok(st.normLibMan(Object.assign({}, man, { v: 2 })) === null && st.normLibMan(Object.assign({}, man, { f: [] })) === null && st.normLibMan(null) === null, 'normLibMan: גרסה אחרת / בלי קבצים — null');
  ok(/'v': 1, 'job': job, 't': /.test(py) && /'f': files/.test(py), 'המניפסט של העובד — אותם שדות');

  /* ---------- 2. מה נשלח לשמירה ---------- */
  const rec = { id: 'jLIBjobAAAAAAAAAAAAAA', spec: { name: 'Talk.mov', from: 'auto', to: ['he'], dur: 90.6, vi: 0, ka: 0 }, chap: [{ t: 12.4, title: 'פרק' }],
    srv: { fv: R + '_ffffffffffff', sx: 0, out: [{ id: R + '_aaaaaaaaaaaa', k: 'compact' }, { id: R + '_bbbbbbbbbbbb', k: 'cues' }, { id: 'driveFile12345', k: 'srt' }] } };
  const it = st.libItems(rec);
  ok(it.length === 3 && it[0].id === R + '_ffffffffffff' && /\.mov$/.test(it[0].n), 'libItems: המקור ראשון (בסיומת שלו), ואז התוצרים');
  ok(!it.some((x) => x.id === 'driveFile12345'), 'libItems: רק מה שב־R2 (השרתון מעתיק מ־R2)');
  ok(st.libItems(Object.assign({}, rec, { srv: Object.assign({}, rec.srv, { sx: 1 }) })).length === 2, 'libItems: המקור נמחק (sx) — בלעדיו');
  const mt = st.libMeta(rec);
  ok(mt.k === 'tr' && mt.fr === '' && mt.to.join() === 'he' && mt.d === 91 && mt.ch[0].t === 12 && mt.ch[0].n === 'פרק', 'libMeta: שפה "auto" לא נשלחת, פרקים בשניות שלמות');
  ok(/const LIB_MAX = 16/.test(srv) && /LIB_MAX = 16/.test(py) && /slice\(0, 16\)/.test(sj), 'עד 16 קבצים — בטלפון, בשרתון ובעובד');

  const sn = read('studionet.js'), lbody = sn.slice(sn.indexOf('async function libList'), sn.indexOf('async function libThumbs'));
  ok(/e\.status !== 400/.test(lbody) && /qs\.delete\('orderBy'\)/.test(lbody) && /lb\.err = /.test(sj) && /'st-lib-errc'/.test(sj), 'הטעינה: 400 מ־Drive — ניסיון בלי orderBy, וקוד השגיאה על המסך');

  /* ---------- 3. הלשונית והחלפת "הסרטונים שלי" ---------- */
  ok(/const ST_SIB = \['ka', 'home', 'vi', 'job', 'lib', 'tower'\]/.test(sj) && /\{ k: 'lib', ico: ST_DIAL_ICO\.lib, lbl: T\('studioDialLib'\) \}/.test(sj), 'החוגה: ספרייה בין "העבודה" למגדל');
  ok(/x === 'litem' \? \['lib', null\]/.test(sj) && /if \(ch\.some\(\(x\) => x\.v === 'lib'\)\) return 'lib';/.test(sj), 'פריט בספרייה — תחת הלשונית');
  ok(/'rr', 'litem'\]/.test(sj) && /if \(ui\.view === 'litem'\) lpStop\(\);/.test(sj), 'פריט — בלי החלקה (נגן), והנגן נעצר ביציאה');
  ok(/label: T\('studioLibT'\), sub: T\('studioLibRowS'\), onClick: \(\) => go\('lib'\)/.test(sj) && !/onClick: \(\) => goVids\(''\)/.test(sj), 'ההגדרות: הספרייה במקום "הסרטונים שלי"');
  ok(/appProperties has \{ key='snbRole' and value='m' \}/.test(read('studionet.js')) && /prop='snbRole' if lib/.test(py), 'הרשימה = המניפסטים (snbRole=m) שהעובד כותב');
  /* ---------- 17/11/2026: Google דוחה את הסוד של לקוח ה־Drive בשרת (invalid_client) — התיקון למנהל ---------- */
  const PROD = { appId: '1:286578855160:web:abc', projectId: 'yishaiguedj1-c786e' };
  ok(st.gcClientUrl('286578855160-abc.apps.googleusercontent.com', PROD) === 'https://console.cloud.google.com/auth/clients/286578855160-abc.apps.googleusercontent.com?project=yishaiguedj1-c786e',
    'הקישור ללקוח במסוף — עם הפרויקט כשמספר הפרויקט במזהה הוא של Firebase שבדף');
  ok(st.gcClientUrl('111-abc.apps.googleusercontent.com', PROD) === 'https://console.cloud.google.com/auth/clients/111-abc.apps.googleusercontent.com' && st.gcClientUrl('', PROD) === 'https://console.cloud.google.com/auth/clients',
    'לקוח מפרויקט אחר — בלי פרויקט; בלי מזהה — רשימת הלקוחות');
  const fix = sj.slice(sj.indexOf('const lbFixable'), sj.indexOf('/* ---- פריט בספרייה'));
  ok(/ui\.api && ui\.api\.admin\) && \/invalid_client\|gd_http_401\//.test(fix) && /p\.append\(lbFixable\(\) \? lbFix\(\) : btn\('st-btn wide', T\('studioLibRetry'\)/.test(sj),
    'כרטיס התיקון — רק למנהל, רק כש־Google דחה את הלקוח; לאחרים "לנסות שוב"');
  ok(/inp\.type = 'password'/.test(fix) && /inp\.autocomplete = 'off'/.test(fix) && /net\.api\('gdSecret', \{ s \}\)/.test(fix) && /lbFx\.v = '';/.test(fix) && !/localStorage|sessionStorage/.test(fix),
    'הסוד — שדה סיסמה, נשלח פעם אחת לשרתון ונמחק מהזיכרון; לא נשמר בטלפון');
  ok(/j\.drive === 'ok'\) \{ flashSafe\(T\('studioLibFixOk'\)\); lb\.st = ''; lb\.err = ''; lbLoad\(\)/.test(fix) && /j\.drive === 'revoked' \|\| j\.drive === 'not_connected'\) \{[^}]*lb\.st = 'conn'/.test(fix),
    'אחרי השמירה: Drive עובד — הספרייה נטענת מחדש; ההרשאה בוטלה — כפתור החיבור');
  const srvS = read('ibkr-proxy/api/studio.js');
  ok(/if \(op === 'gdSecret'\) \{[\s\S]{0,400}if \(!isAdmin\(user\)\) return res\.status\(403\)/.test(srvS) && /body\.op === 'gdCheck'/.test(srvS), 'השרתון: gdSecret — מנהל בלבד; gdCheck — הבדיקה הציבורית');

  /* ---------- 18/11/2026: עריכה ישר מהרשת (⋯ ולחיצה ארוכה), מחיקה שמנתקת את העבודה, והמכסה ב־TB ---------- */
  ok(st.fmtSize(5124 * 1073741824) === '5TB' && st.fmtSize(466 * 1073741824) === '466GB' && st.fmtSize(1536 * 1073741824) === '1.5TB' && st.fmtSize(12 * 1099511627776) === '12TB',
    'המד: 5124GB → "5TB" (לא נקרא כמו 500GB), מתחת ל־TB — GB כמו קודם');
  const jA = { id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { name: 'Talk.mp4', to: ['he'] }, up: { dx: { j: 'jDXdxDXdxDXdxDXdxDXdx' } } };
  const jB = { id: 'jBBBBBBBBBBBBBBBBBBBB', spec: { name: 'Other.mp4', to: ['he'] }, up: {} };
  ok(st.libOldJob({ job: 'jDXdxDXdxDXdxDXdxDXdx', name: 'x.mp4' }, [jB, jA]) === jA, 'קובץ ישן → העבודה לפי עבודת השמירה (snbJob)');
  const nb = st.shareVideoName(jB).replace(/\.mp4$/, '');
  ok(st.libOldJob({ job: '', name: nb + ' — זהה למקור.mp4' }, [jA, jB]) === jB && st.libOldJob({ job: '', name: nb + 'X — a.mp4' }, [jA, jB]) === null,
    'קובץ ישן בלי עבודת שמירה תואמת → לפי השם שנתנו לקובץ (רק התאמה מלאה של הבסיס)');
  ok(st.libOldJob({ name: 'x.mp4' }, null) === null, 'קובץ ישן: בלי עבודות — null');
  ok(/'nextPageToken,files\(' \+ VID_FIELDS \+ \(old \? ',appProperties' : ''\)/.test(sn) && /appProperties\.snbJob/.test(sn), 'הקבצים הישנים: מזהה עבודת השמירה מ־appProperties');
  ok(/menu: \(at\) => lbItemMenu\(at, x\)/.test(sj) && /menu: \(at\) => lbOldMenu\(at, x\)/.test(sj), 'הרשת: תפריט לכל פריט ולכל קובץ ישן');
  const card = sj.slice(sj.indexOf('function lbCard('), sj.indexOf('function lbMenu('));
  ok(/addEventListener\('contextmenu'/.test(card) && /e\.preventDefault\(\)/.test(card) && /'st-lc-more'/.test(card) && /aria-haspopup', 'menu'/.test(card) && !/btn\('st-lc'[^;]*\.append\([^;]*st-lc-more/.test(card),
    'הכרטיס: לחיצה ארוכה ו־⋯ (כפתור ליד הכרטיס, לא בתוכו)');
  const mnu = sj.slice(sj.indexOf('function lbMenu('), sj.indexOf('const lbDriveFolder'));
  ok(/'st-rs st-cm-veil'/.test(mnu) && /rsClose\(\)/.test(mnu) && /role', 'menu'/.test(mnu) && /role', 'menuitem'/.test(mnu) && /a\.danger && i/.test(mnu), 'התפריט: "חזור" ונגיעה בחוץ סוגרים (st-rs), תפקידי נגישות, קו לפני הפעולה ההרסנית');
  const im = sj.slice(sj.indexOf('function lbItemMenu('), sj.indexOf('export function libOldJob'));
  ok(/rec \? \{ k: 'job'/.test(im) && /go\('job', rec\.id\)/.test(im) && /k: 'del'[^}]*lbDel\(it\)[^}]*danger: true/.test(im), 'פריט: פתיחת העבודה (כשהיא קיימת), Drive, הסרה (אחרונה)');
  const del = sj.slice(sj.indexOf('function lbDel('), sj.indexOf('/* ---- "הוספה לספרייה"'));
  ok(/if \(ui\.view === 'litem'\) back\(\); else lbPaint\(\)/.test(del) && /net\.api\('libDrop', \{ job: m\.job, m: it\.id \}\)/.test(del) && /m\.job && !home/.test(del) && /studioLibDelQHome/.test(del),
    'מחיקה: מהרשת נשארים ברשת; העבודה מתנתקת (libDrop); עבודה שמנגנת מהקבצים — אזהרה');
  ok(st.bidiIso('A "b"') === '⁨A "b"⁩' && /bidiIso\(m\.t \|\| T\('studioUntitled'\)\)/.test(del) && /n: bidiIso\(fileTitle\(x\.name\)\)/.test(sj), 'חלון האישור: שם באנגלית מבודד (המירכאות לא קופצות)');
  const srvA = read('ibkr-proxy/api/studio.js');
  ok(/if \(op === 'libDrop'\) \{[\s\S]{0,700}if \(!lb \|\| lb\.home \|\| String\(lb\.m \|\| ''\) !== String\(body\.m \|\| ''\)\)[\s\S]{0,200}vlib: null/.test(srvA), 'השרתון: libDrop — רק המניפסט של העבודה, לא כשעברה הביתה');
  const appS = read('app.js');
  ok(['studioLibJob', 'studioLibDelQHome'].every((k) => (appS.match(new RegExp(k + ': "', 'g')) || []).length === 2), 'מחרוזות חדשות בעברית ובאנגלית');
  const cssS = read('studio.css');
  ok(/\.st-cm \{[^}]*position: fixed[^}]*backdrop-filter/.test(cssS) && /prefers-reduced-motion: reduce\) \{ \.st-cm \{ animation: none/.test(cssS) && /prefers-reduced-transparency: reduce\) \{ \.st-cm/.test(cssS) && /\.st-rs\.st-cm-veil \{[^}]*blur\(5px\)/.test(cssS),
    'העיצוב: זכוכית צפה, טשטוש עדין מאחור, בלי תנועה/שקיפות לפי הגדרות הנגישות');
  /* 18/11/2026: "שמירה לספרייה" — בראש דף הניתוח (ctx.libAct, לא בדף ששותף) ובכרטיס הראש של התרגום והקריוקי ליד "צפייה" */
  const viS = read('studiovi.js');
  ok(/el\.append\(hd\);\s*if \(ctx\.libAct\) el\.append\(ctx\.libAct\);/.test(viS) && /libAct: libBtn\(rec\)/.test(sj), 'דף הניתוח: "שמירה לספרייה" מיד מתחת לכותרת');
  ok(/const hacts = h\('div', 'st-hacts'\);[\s\S]{0,300}T\('studioPlWatch'\)[\s\S]{0,120}hacts\.append\(libBtn\(rec, true\)\);\s*hero\.append\(hacts\)/.test(sj) && !/function libRow\(/.test(sj), 'התרגום והקריוקי: "לספרייה" ליד "צפייה" בכרטיס הראש (במקום השורה ברשימה)');
  ok(/if \(st \+ ':' \+ pc === key\) return;/.test(sj) && /b\.disabled = true;/.test(sj) && /go\('litem', lv\.m\)/.test(sj), 'הכפתור: מצויר מחדש רק כשהמצב משתנה, כבוי בזמן השמירה, "בספרייה" פותח את הפריט');
  ok(['studioLibSave', 'studioLibRunS'].every((k) => (appS.match(new RegExp(k + ': "', 'g')) || []).length === 2) && !/studioLibAdd/.test(appS), 'מחרוזות הכפתור בעברית ובאנגלית, והישנות הוסרו');
  ok(/\.st-hacts > \.st-btn, \.st-hlib > \.st-btn \{ flex: 1 1 0/.test(cssS) && /\.st-hlib \{ display: contents; \}/.test(cssS), 'העיצוב: זוג כפתורים ברוחב שווה');
  // 18/11/2026: סמל התרגום (שני כרטיסים) — בחוגה, ב"עבודה חדשה" ובמגדל; וסוג העבודה בסמל על כל כרטיס בספרייה
  ok(/home: ICO_TR,/.test(sj) && /\n  trans: ICO_TR,/.test(sj) && /ico\(kaTab \? 'note' : viTab \? 'lect' : 'trans'\)/.test(sj) && /qbtn\('trans', T\('studioQaNew'\)/.test(sj), 'סמל התרגום: לשונית, עבודה חדשה, מגדל');
  ok(/const LIB_KIND_ICO = \{ tr: 'trans', ka: 'note', vi: 'lect' \};/.test(sj) && /if \(!o\.big && \(o\.state \|\| LIB_KIND_ICO\[o\.k\]\)\)/.test(sj) && /const tr = o\.k === 'tr' \|\| \(o\.k === 'vi' && o\.tv === 1\);/.test(sj) && /if \(tr\) tg\.append\(trIco\(o\.fr, o\.to, 'st-lp-k st-lp-tr'\)\)/.test(sj), 'הספרייה: סמל הסוג בתגית, תרגום (וניתוח שתורגם) — בועות עם האותיות, לא בדף הפריט');
  ok(/\.st-lp-k \{[^}]*inline-size: 18px/.test(cssS) && /\.st-lp-k\.st-lp-tr \{ inline-size: 24px/.test(cssS) && /\.st-lp-lang\.ic \{/.test(cssS), 'העיצוב: סמל 18px, בועות 24px, סמל לבד — עיגול');
  ok(st.langGlyph('en') === 'A' && st.langGlyph('he') === 'א' && st.langGlyph('zh') === '文' && st.langGlyph('pt-BR') === 'Ã' && st.langGlyph('xx') === 'X' && st.langGlyph('') === '', 'האות של כל שפה');
  ok(['SOURCE_LANGS', 'TARGET_LANGS'].every((k) => st[k].every((c) => st.LANG_GLYPH[c])), 'לכל שפת מקור ויעד יש אות');
  ok(st.normLibMan(Object.assign({}, man, { k: 'vi', tv: 1 })).tv === 1 && st.normLibMan(Object.assign({}, man, { tv: 1 })).tv === 0 && st.normLibMan(man).tv === 0, 'normLibMan: tv רק בניתוח');
  ok(st.libSrc('tr', '') === 'en' && st.libSrc('tr', 'ru') === 'ru' && st.libSrc('vi', '') === '' && st.libSrc('ka', '') === '' && /fr: libSrc\(m\.k, m\.fr\)/.test(sj)
    && /spec\.get\('from'\) not in \('auto', 'en', None\)/.test(py), 'תרגום ממקור אוטומטי = אנגלית — כל עוד העובד מתרגם רק מאנגלית (אחרת: לדווח את השפה שזוהתה)');
  ok(st.viTr({ vi: 1, vt: 1 }) && !st.viTr({ vi: 1 }) && !st.viTr({ vt: 1 }), 'viTr: ניתוח שגם תרגם');
  ok(/ch, \.\.\.\(m\.tv === 1 && m\.k === 'vi' \? \{ tv: 1 \} : \{\}\) \};/.test(srv) && /if m\.get\('tv'\) == 1:\n\s+out\['tv'\] = 1/.test(py), 'tv עובר בשרתון ובעובד');
  console.log(n + ' בדיקות עברו');
})().catch((e) => { console.error('✗', e); process.exit(1); });
