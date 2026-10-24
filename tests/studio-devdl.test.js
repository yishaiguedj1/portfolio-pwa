// 22/10/2026 (בקשת המשתמש: "כל ההורדות של מנהל ההורדות תמיד מקומית למכשיר, לא לשרת"): הבדיקה וההורדה בטלפון.
// האתר ↔ Studio לאנדרואיד (DlActivity) ↔ sw.js (/share-file). כל צד משתמש באותם שמות — שינוי באחד = גם בשני.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const R = (p) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; };

const st = R('studio.js'), sapp = R('studio-app.js'), sw = R('sw.js');
const K = 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/';
// 23/10/2026: המנוע (DlEngine/DlProbe/DlDeep) עבר ל־src/ytdl — משותף ל־Studio ול־Studio DM
const KY = 'android/app/src/ytdl/java/io/github/yishaiguedj1/snowball/';
const act = R(K + 'DlActivity.kt'), eng = R(KY + 'DlEngine.kt'), svc = R(K + 'DlService.kt'), probe = R(KY + 'DlProbe.kt');
const main = R('android/app/src/main/java/io/github/yishaiguedj1/snowball/MainActivity.kt');
const man = R('android/app/src/studio/AndroidManifest.xml');

// 1. לטלפון כברירת מחדל; "ישר לענן של Studio" רק בבחירה, רק כשהשרתון מתיר ורק במקור שלא חוסם את השרת (22/10/2026)
{
  const fnSrc = (name) => { const a = st.indexOf('function ' + name + '('); return st.slice(a, st.indexOf('\n}\n', a)); };
  const outside = st.replace(fnSrc('linkCheckSrv'), '').replace(fnSrc('startLinkCloud'), '');
  ok(!/urlProbe/.test(outside) && !/src: 'url'/.test(outside), 'השרת רק בשתי פונקציות: linkCheckSrv (דפדפן בלי האפליקציה) ו־startLinkCloud (בחירה)');
  ok(/L\.to = want === 'cloud' && ui\.url \? 'cloud' : devDl\(\) \? 'dev' : 'cloud';/.test(st) && /if \(ui\.url\) linkCheckSrv\(f, L, seq\); else \{ L\.st = 'err'; L\.e = 'app'; \}/.test(st), 'בטלפון — "dev"; בלי האפליקציה — לענן (כשמותר) או הסבר');
  ok(/if \(L && L\.to === 'cloud'\) \{ startLinkCloud\(f\); return; \}/.test(st), 'התחלה לפי הבחירה');
  ok(/cloudBlocked = \(r\) => \/\^youtube\/i/.test(st) && /function cloudOk\(L\) \{ return !!\(ui\.url && L && L\.r && !cloudBlocked\(L\.r\)\); \}/.test(st), 'לענן — רק עם ui.url ובלי יוטיוב (חוסם את השרת)');
  ok(/if \(L\.to === 'cloud' && !cOk\) L\.to = 'dev';/.test(st) && /k: 'link-to:cloud'/.test(st) && /k: 'link-to:dev'/.test(st), 'הבחירה בדף הקישור, וחוזרת לטלפון כשהענן לא מותר');
  for (const k of ['studioLinkToT', 'studioLinkToDev', 'studioLinkToCloud', 'studioLinkToCloudNo', 'studioLinkToCloudOff', 'studioLinkCloudNote'])
    ok((R('app.js').match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, k + ' בעברית ובאנגלית');
}

// 2. הכתובות לאפליקציה = מה ש־DlActivity מקבלת
ok(/'intent:\/\/' \+ kind \+ '\?' \+ qs \+ '#Intent;scheme=snbstudio;package=' \+ DL_PKG/.test(st) && /DL_PKG = 'app\.thesnowball\.studio'/.test(st), 'intent://probe|dl לחבילה של Studio');
ok(/android:host="probe"/.test(man) && /android:host="dl"/.test(man) && /\.DlActivity/.test(man), 'DlActivity מקבלת probe ו־dl');
for (const k of ['u', 'ref', 'n']) ok(new RegExp('getQueryParameter\\("' + k + '"\\)').test(act), 'DlActivity קוראת ' + k);
for (const k of ['v', 'a', 'h', 's0', 's1', 't']) ok(new RegExp('getQueryParameter\\("' + k + '"\\)|num\\("' + k + '"\\)').test(act) && new RegExp('[{ ]' + k + ':').test(st.slice(st.indexOf("dlIntent('dl'"), st.indexOf("dlIntent('dl'") + 400)), 'הורדה: ' + k + ' בשני הצדדים');
ok(/"#probe=\$nonce\." \+ DlEngine\.b64/.test(act) && /"#probe=\$nonce\.!"/.test(act) && /hashArg\('probe'/.test(sapp) && /studioProbeRes\(pr\)/.test(sapp), 'תוצאת הבדיקה חוזרת ב־‎#probe=');
ok(/"#dle=" \+ id \+ "\." \+ code/.test(svc) && /hashArg\('dle'/.test(sapp), 'שגיאת הורדה חוזרת ב־‎#dle=');
ok(/\^\[A-Za-z0-9\]\{6,24\}\$/.test(act) && /\[A-Za-z0-9\]\{6,24\}/.test(st), 'אותו פורמט מזהה (nonce) בשני הצדדים');

// 3. הקובץ חוזר: MainActivity → Chrome POST ‎/share-file (name=video, text) → sw.js → ‎#got=
ok(/getString\(R\.string\.launchUrl\) \+ "share-file"/.test(main) && /FileFormField\("video"/.test(main) && /Params\(null, "text"/.test(main), 'MainActivity: share target ‎/share-file עם video + text');
ok(/SHARE_RE = \/\\\/share-file\$\//.test(sw) && /fd\.get\('video'\)/.test(sw) && /fd\.get\('text'\)/.test(sw), 'sw.js מקבל את אותם שדות');
ok(/putExtra\(Intent\.EXTRA_TEXT, "snbdl:\$id"\)/.test(svc) && /\^snbdl:\//.test(st), 'snbdl:<מזהה> — הקובץ שייך להורדה שהתחילה בדף');
ok(/<data android:mimeType="video\/\*" \/>/.test(man), 'Studio מקבל סרטון בשיתוף (גם מהגלריה)');
ok(/RELATIVE_PATH, "Movies\/Studio"/.test(eng), 'נשמר ב־Movies/Studio (גלוי)');

// 4. sw.js — הרצה ב־vm: POST עם קובץ → IndexedDB + הפניה ל־‎#got=
{
  const a = sw.indexOf('const SHARE_RE'), b = sw.indexOf("self.addEventListener('fetch'");
  const store = new Map();
  const idb = { open: () => { const r = { result: { objectStoreNames: { contains: () => true }, createObjectStore() {},
    transaction: () => { const tx = { objectStore: () => ({ put: (v, k) => { store.set(k, v); setTimeout(() => tx.oncomplete && tx.oncomplete()); } }) }; return tx; } } };
    setTimeout(() => r.onsuccess && r.onsuccess()); return r; } };
  const ctx = { indexedDB: idb, URL, Uint8Array, Array, String, Promise, setTimeout,
    self: { crypto: require('crypto').webcrypto, registration: { scope: 'https://studio.thesnowball.app/' } },
    Response: { redirect: (u, s) => ({ u, s }) } };
  vm.createContext(ctx);
  vm.runInContext(sw.slice(a, b) + '\nthis.shareFile = shareFile; this.SHARE_RE = SHARE_RE;', ctx);
  const file = { size: 10, type: 'video/mp4', name: 'x.mp4' };
  const req = (f, t) => ({ formData: async () => ({ get: (k) => (k === 'video' ? f : k === 'text' ? t : null) }) });
  (async () => {
    const r1 = await ctx.shareFile(req(file, 'snbdl:abc123def'));
    const key = /#got=([a-z0-9]{12})$/.exec(r1.u);
    ok(r1.s === 303 && key && store.get(key[1]).f === file && store.get(key[1]).t === 'snbdl:abc123def', 'sw.js: הקובץ נשמר ומפנה ל־‎#got=');
    const r2 = await ctx.shareFile(req({ size: 5, type: 'text/html' }, ''));
    ok(r2.u === 'https://studio.thesnowball.app/' && store.size === 1, 'sw.js: לא סרטון — בלי שמירה');
    ok(ctx.SHARE_RE.test('/share-file') && !ctx.SHARE_RE.test('/share-file/x'), 'הנתיב');
    done();
  })().catch((e) => { console.error(e); process.exit(1); });
}

// 5. normDevProbe / b64uText — טקסט מאתר חיצוני, רק בצורה הצפויה
function done() {
  const grab = (name) => { const a = st.indexOf('export function ' + name); const b = st.indexOf('\n}\n', a) + 2; return st.slice(a, b).replace(/^export /, ''); };
  const c = {};
  vm.createContext(Object.assign(c, { atob, TextDecoder, Uint8Array, Math, Number, String, Array, JSON }));
  vm.runInContext(grab('b64uText') + grab('normDevProbe') + '\nthis.b = b64uText; this.N = normDevProbe;', c);
  const raw = { t: 'שלום <b>x</b>', u: 'javascript:alert(1)', s: 'Youtube', up: 'ערוץ', d: 61.6, ud: '2026x', lang: 'he',
    ch: [[0, 'פתיחה'], ['x', 5], [70, 'סוף']], sub: [{ l: 'he', n: 'עברית', a: 0 }], rec: 1080,
    q: [{ h: 1080, v: '399', a: '251', c: 'av1', ac: 'opus', fps: 30, hdr: 0, sz: 1e8 }, { h: 720, v: 'bad id', a: '' }],
    ao: { id: '251', ac: 'opus', br: 135, sz: 9e6 }, th: 'data:image/png;base64,AAAA' };
  const b64 = Buffer.from(JSON.stringify(raw)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const r = c.N(JSON.parse(c.b(b64)));
  ok(r.t === 'שלום <b>x</b>' && r.u === '' && r.th === '' && r.ud === '' && r.d === 62, 'normDevProbe: קישור לא http, תמונה לא JPEG ותאריך שבור — נזרקים');
  ok(r.q.length === 1 && r.q[0].v === '399' && r.ch.length === 2 && r.ao.id === '251', 'normDevProbe: רק איכויות/פרקים תקינים');
  ok(c.N({ t: 'x', q: [] }) === null && c.N(null) === null && c.N({ q: [{ v: '1' }] }) === null, 'normDevProbe: בלי איכויות — כלום');
  ok(/r\.th \? '\./.test('') || /th\.style\.backgroundImage = 'url\("' \+ r\.th \+ '"\)'/.test(st), 'התמונה מוצגת רק כ־data: מבודק');

  // 6. האפליקציה: yt-dlp בטלפון, מתעדכן לבד; DlProbe = fetchurl (בדיקת JVM — DlProbeTest)
  const g = R('android/app/build.gradle.kts');
  ok(/"studioImplementation"\("io\.github\.junkfood02\.youtubedl-android:library:/.test(g) && /minSdk = 29/.test(g) && /abiFilters \+= "arm64-v8a"/.test(g), 'gradle: yt-dlp רק ב־Studio, arm64, Android 10+');
  ok(/updateYoutubeDL\(ctx\.applicationContext, YoutubeDL\.UpdateChannel\.NIGHTLY\)/.test(eng), 'yt-dlp מתעדכן מתוך האפליקציה');
  ok(fs.existsSync(path.join(__dirname, '..', 'android/app/src/testStudio/java/io/github/yishaiguedj1/snowball/DlProbeTest.kt')), 'DlProbeTest קיים (רץ ב־android.yml)');
  // ERR_RULES — אותם קודים ואותו סדר כמו fetchurl.py
  const py = R('translator/fetchurl.py');
  const codesPy = [...py.slice(py.indexOf('ERR_RULES = ('), py.indexOf('def err_code')).matchAll(/\('(\w+)', re\.compile/g)].map((m) => m[1]);
  const codesKt = [...probe.slice(probe.indexOf('private val ERR'), probe.indexOf('fun errCode')).matchAll(/"(\w+)" to Regex/g)].map((m) => m[1]);
  assert.deepStrictEqual(codesKt, codesPy); n++;
  // 23/10/2026: (?U) / UNICODE_CHARACTER_CLASS עובד ב־JVM (DlProbeTest עבר) ונזרק באנדרואיד (ICU) — Studio קרס בפתיחת
  // חלון ההורדה. אף Regex בקוד האנדרואיד לא משתמש בהם; וחלון ההורדה בתהליך נפרד, עם דיווח קריסה לאתר
  const ktFiles = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.kt$/.test(e.name)) ktFiles.push(p); } })(path.join(__dirname, '..', 'android/app/src'));
  for (const f of ktFiles) ok(!/\(\?[a-zA-Z]*U|UNICODE_CHARACTER_CLASS|CANON_EQ/.test(fs.readFileSync(f, 'utf8')), path.basename(f) + ': בלי דגלי Regex שאנדרואיד לא מכיר');
  const man = R('android/app/src/studio/AndroidManifest.xml');
  ok((man.match(/android:process=":dl"/g) || []).length === 3, 'DlActivity, DlService ו־DlJob בתהליך נפרד');
  // 23/10/2026: מגבלת 6 השעות של dataSync (targetSdk 35) — אנדרואיד 14+ = UIDT (DlJob), השירות מממש onTimeout
  const dir = 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/';
  ok(/setUserInitiated\(true\)/.test(R(dir + 'DlJob.kt')) && /setNotification\(params/.test(R(dir + 'DlJob.kt')) && /override fun onStopJob[\s\S]*return true/.test(R(dir + 'DlJob.kt')), 'DlJob: UIDT עם התראה, ממשיך אחרי עצירה');
  ok(/override fun onTimeout\(startId: Int, fgsType: Int\)/.test(R(dir + 'DlService.kt')), 'DlService: onTimeout (אנדרואיד 15)');
  ok(/RUN_USER_INITIATED_JOBS/.test(man) && /\.DlJob"[\s\S]*?BIND_JOB_SERVICE/.test(man) && (man.match(/android:process=":dl"/g) || []).length === 3, 'מניפסט: הרשאת UIDT ו־DlJob בתהליך ההורדה');
  ok(/DlJob\.schedule\(this/.test(R(dir + 'DlActivity.kt')), 'DlActivity מתזמן קודם UIDT');
  ok(/setDefaultUncaughtExceptionHandler/.test(R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/DlActivity.kt')), 'קריסה בחלון ההורדה מדווחת לאתר');
  // 23/10/2026: הבדיקה לעומק — דפדפן נסתר בחלון ההורדה; העוגיות רק בקובץ זמני בטלפון; ה־Referer של הזרם חוזר לאתר
  const deep = R(KY + 'DlDeep.kt');
  ok(/fun deep\(/.test(act) && /if \(!miss\) back\(res\) else deep\(u, res\)/.test(act) && /setDataDirectorySuffix\("dl"\)/.test(act), 'DlActivity: בדיקה לעומק לפני דפדפן הציד, WebView בתיקייה של התהליך');
  ok(/addOption\("--cookies", ck\.file\.absolutePath\)/.test(eng) && /File\(ctx\.filesDir, "ck"\)/.test(eng) && /CK_TTL_MS/.test(eng), 'DlEngine: קובץ עוגיות פרטי וזמני ל־yt-dlp');
  ok(!/Log\.|println/.test(deep + act.slice(act.indexOf('fun deep('))), 'בלי לוגים בבדיקה לעומק');
  ok(/const rf = /.test(st) && /th, rf(, alt)? \}/.test(st) && /if \(r\.rf && !L\.ref\) L\.ref = r\.rf/.test(st) && /put\("rf"/.test(deep), 'הזרם שנמצא בדף: ה־Referer (rf) עובר לאתר ולהורדה');
  // 23/10/2026: קובץ זעיר / פרסומת לא מוצע (buffett.cnbc.com — 1KB)
  ok(/DlDeep\.realVideo\(r, pageDur\(\)\)/.test(act) && /DlDeep\.better\(r, bestMedia, pageDur\(\)\)/.test(act) && /if \(b != null\) okMedia\(b\) else hunt\(u, miss\)/.test(act) && /DlDeep\.withAlt\(b, goods, pageDur\(\)\)/.test(act), 'בדיקה לעומק: רק קובץ אמיתי, הטוב ביותר נבחר, השאר — מקורות נוספים; בלי קובץ אמיתי — דפדפן הציד');
  ok(/const alt = Array\.isArray\(r\.alt\)/.test(st) && /th, rf, alt \}/.test(st) && /T\('studioLinkAltT'\)/.test(st) && /linkCheck\(f, a\.u, ref\)/.test(st) && (R('app.js').match(/\bstudioLinkAltT: "/g) || []).length === 2, 'האתר: "מקורות נוספים בדף" — נגיעה בודקת את המקור עם ה־Referer');
  ok(/ref\.isNotEmpty\(\) && !DlDeep\.realVideo\(s, 0\)\) throw IllegalArgumentException\("tiny"\)/.test(act) && /case 'tiny': return T\('studioLinkETiny'\)/.test(st)
    && (R('app.js').match(/\bstudioLinkETiny: "/g) || []).length === 2, 'קובץ זעיר מדפדפן הציד → הודעה ברורה (tiny) בשתי השפות');
  // 23/10/2026: "1KB" = גודל לא ידוע (fmtSize(0)) — שואלים את השרת (HEAD), ובאתר "גודל לא ידוע"
  ok(/fillSize\(s, info, ref, ck\)/.test(eng) && /requestMethod = "HEAD"/.test(eng), 'גודל לא ידוע → HEAD לשרת של הקובץ');
  ok(/rec\.sz \? approx\(fmtSize\(rec\.sz\)\) : T\('studioLinkSzUnknown'\)/.test(st) && !/approx\(fmtSize\(rec\.sz\)\)\)\)/.test(st), 'האתר: "גודל לא ידוע" במקום 1KB');
  ok(/DlDeep\.looksLikeVideo\(/.test(eng) && /IllegalArgumentException\("not_video"\)/.test(eng) && /case 'not_video': return T\('studioLinkENotVideo'\)/.test(st)
    && (R('app.js').match(/\bstudioLinkENotVideo: "/g) || []).length === 2, 'קובץ שירד ואינו סרטון (5KB / דף) — לא נשמר, הודעה בשתי השפות');
  // 23/10/2026 (סרטון המשתמש): "לא נמצא" עובר לאתר רק כשדפדפן הציד נסגר בלי לשלוח — אחרת השליחה נדרסת
  const hunt = R(dir + 'HuntActivity.kt');
  ok(/putExtra\(HuntActivity\.EXTRA_MISS, miss\)/.test(act) && !/launchUrl\) \+ miss\), this, MainActivity/.test(act) && /override fun finish\(\)/.test(hunt) && /if \(!sent && /.test(hunt) && /private fun send\(url: String, ref: String\) \{\s*\n\s*sent = true/.test(hunt), 'דפדפן הציד: "לא נמצא" רק אם נסגר בלי לשלוח');
  ok(/requestMethod = "HEAD"/.test(hunt) && /DlDeep\.MIN_BYTES/.test(hunt), 'דפדפן הציד: קובץ קטן / דף לא נספר כ"נמצא סרטון"');
  ok(/elementFromPoint/.test(deep) && /__snbClick\|\|0/.test(deep), 'בדיקה לעומק: עד 3 ניסיונות ללחוץ ▶ (כולל מרכז הנגן)');
  ok(/name="dlDeep"/.test(R('android/app/src/studio/res/values/strings.xml')) && /name="dlDeep"/.test(R('android/app/src/studio/res/values-en/strings.xml')), 'dlDeep בעברית ובאנגלית');
  for (const k of ['studioLinkEApp', 'studioLinkDlWait', 'studioLinkGot', 'studioLinkEStore', 'studioLinkFailT'])
    ok((R('app.js').match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, k + ' בעברית ובאנגלית');
  // 23/10/2026: תקרת זמן לבדיקה (דפדפן הציד — יותר מדקה בלי תשובה), ניסיונות קצרים, בלי חלופות לקובץ ישיר
  {
    const act = R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/DlActivity.kt'), en2 = R(KY + 'DlEngine.kt');
    ok(/PROBE_REF_MS = 45_000L/.test(act) && /PROBE_MS = 90_000L/.test(act) && /if \(probeSlow\) "slow"/.test(act), 'תקרת זמן לבדיקה → slow');
    ok(/HUNT_ON = setOf\([^)]*"slow"/.test(act), 'slow בדף → הבדיקה לעומק');
    ok(/deepProbe\(h\.url, page, ck, PROBE_REF_MS\)/.test(act) && /DlEngine\.cancel\(it\)/.test(act), 'הבדיקות שבתוך הבדיקה לעומק — מוגבלות ונעצרות');
    ok(/"--retries", 1\)/.test(en2) && /ref\.isNotEmpty\(\) \|\| DlDeep\.isMediaUrl\(url\)\) emptyList\(\)/.test(en2), 'ניסיונות קצרים ובלי חלופות לקובץ');
    ok(/case 'slow': return T\('studioLinkESlow'\)/.test(st) && (R('app.js').match(/\bstudioLinkESlow: "/g) || []).length === 2, 'slow — טקסט בשתי השפות');
    ok(/\(L\.e === 'tiny' \|\| L\.e === 'slow'\) && L\.ref/.test(st), 'slow על קובץ מהציד → לנסות בדפדפן הציד');
  }
  // 23/10/2026 (צילום המשתמש: "בודקים את הקישור…" בלי סוף אחרי דפדפן הציד): הבדיקה נפתחת מדפדפן הציד, לא מהאתר
  {
    const hunt = R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/HuntActivity.kt'), act = R('android/app/src/studio/java/io/github/yishaiguedj1/snowball/DlActivity.kt'), sapp = R('studio-app.js');
    ok(/Intent\(this, DlActivity::class\.java\)\.setData\(Uri\.parse\(q\)\)/.test(hunt) && /snbstudio:\/\/probe\?h=1&n=\$n&u=/.test(hunt), 'דפדפן הציד פותח את הבדיקה בעצמו');
    ok(/getBooleanExtra\(EXTRA_AUTO, false\) != true && VideoUrl\.classify\(page\)/.test(hunt), 'בפתיחה אוטומטית — הדף לא מוצע שוב');
    ok(/fromHunt = d\.getQueryParameter\("h"\) == "1"/.test(act) && /"#share=" \+ Uri\.encode\(huntU\)[\s\S]{0,120}"&probe=" \+ Uri\.encode/.test(act), 'התוצאה חוזרת יחד עם הכתובת');
    ok(/HUNT_ON && !fromHunt/.test(act) && /DlDeep\.fromMedia\(s, u, ref, null\)/.test(act), 'בלי לולאה, והקובץ עם הדף');
    ok(/if \(pre\) \{ L\.n = pre; render\('none'\); return; \}/.test(st) && /if \(pre\) studioProbeRes\(pr\)/.test(st) && /probe: shareProbe/.test(sapp), 'האתר לא פותח שוב את חלון הבדיקה');
  }
  console.log('studio-devdl: ' + n + ' בדיקות עברו');
}
