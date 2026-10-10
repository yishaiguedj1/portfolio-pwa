// v354: סטודיו התרגום — שלב 1 (שלד): נרמול הנתונים, מחרוזות בשתי השפות, שילוב באפליקציה, "חזור", עיצוב ואבטחה.
// הרצה: node tests/studio-v354.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const st = read('studio.js');
const css = read('studio.css');
const app = read('app.js');
const html = read('index.html');
const sw = read('sw.js');
const styles = read('styles.css');

/* ---------- 1. פונקציות טהורות (המודול בלי export, ב־Node 20 של ה־CI) ---------- */
// v355: studio.js מייבא את studionet.js ו־libbackup.js — כאן במקומם תחליפים (הבדיקות של המודולים האלה ב־studio-v355)
const STUBS = { createNet: () => ({ api: async () => ({ ok: false }), driveApi: async () => null, jobFolder: async () => '', upload: async () => ({}) }),
  probeVideo: async () => ({}), extractAudio: async () => ({}), stageEstimates: () => ({}), progressModel: () => ({ stages: [], left: 0, pct: 0 }),
  createBackup: () => ({}), waitOAuthCode: () => {} };
const body = st.replace(/^export (const|function) /gm, '$1 ').replace(/^import \{([^}]+)\} from '[^']+';$/gm, 'const {$1} = __stubs;');
const S = new Function('t', '__stubs', body + '\nreturn { defaultSettings, normSettings, migrateSettings, normDraft, normStore, newDraft, fmtSize, fmtHM, outList, modeById, modeName, langName, fileTitle, fileExt, chainFor, MODES, DEFAULT_MODE, SOURCE_LANGS, TARGET_LANGS, STYLES, OUTS, LS_STUDIO, openStudio };')(undefined, STUBS);
ok(S.LS_STUDIO === 'pwa_studio_v1', 'מפתח האחסון: pwa_studio_v1');
const def = S.defaultSettings();
ok(def.mode === 'sonnet-medium' && S.DEFAULT_MODE === 'sonnet-medium', 'ברירת המחדל: Sonnet 5.5 · Medium (מ־10/10/2026)');
ok(S.MODES.filter((m) => m.rec).length === 1 && S.MODES.find((m) => m.rec).id === 'sonnet-medium', 'בדיוק מצב אחד מסומן "מומלץ" — Sonnet Medium');
ok(S.MODES.map((m) => m.id).sort().join() === 'haiku-high,haiku-medium,opus-medium,sonnet-high,sonnet-medium', 'חמשת המצבים (10/10/2026: Haiku במקום Opus High/Max)');
ok(def.out.same === true && def.out.compact === false && def.out.mkv === false, 'ברירת המחדל לפלט: זהה למקור (+SRT תמיד)');
ok(S.outList(def.out).join() === 'same,srt' && S.outList({ compact: true, mkv: true }).join() === 'compact,mkv,srt', 'SRT תמיד בסוף רשימת הפלטים');
ok(def.to.join() === 'he' && def.style === 'bold' && def.conn === 'sub', 'ברירות מחדל: עברית, מודגש, המנוי שלי');
const bad = S.normSettings({ mode: 'gpt', to: ['xx', 'en', 'en', 'he'], out: { same: 'yes', compact: true }, style: 'neon', conn: 'hack' });
ok(bad.mode === 'sonnet-medium' && bad.to.join() === 'en,he' && bad.out.same === true && bad.out.compact === true && bad.style === 'bold' && bad.conn === 'sub',
  'נרמול הגדרות: ערכים לא מוכרים חוזרים לברירת המחדל, שפות בלי כפילויות');
// 10/10/2026: Opus High/Max הוסרו → Opus Medium; ברירת המחדל הישנה (Opus Medium בלי mv) עוברת פעם אחת ל־Sonnet Medium
ok(S.normSettings({ mode: 'opus-max' }).mode === 'opus-medium' && S.migrateSettings({ mode: 'opus-medium' }).mode === 'sonnet-medium'
  && S.migrateSettings({ mode: 'opus-medium', mv: 2 }).mode === 'opus-medium' && S.migrateSettings({ mode: 'sonnet-high' }).mode === 'sonnet-high'
  && S.migrateSettings({ mode: 'opus-high' }).mode === 'sonnet-medium' && S.migrateSettings(null).mv === 2 && S.modeById('opus-high').id === 'opus-medium',
  'מצבים שהוסרו → Opus Medium; ברירת המחדל הישנה עוברת פעם אחת לחדשה, בחירה אחרת נשמרת');
ok(S.normSettings({ to: [] }).to.join() === 'he', 'תמיד לפחות שפת יעד אחת');
ok(S.normDraft({ id: '../x' }) === null && S.normDraft({ id: '<b>' }) === null && S.normDraft(null) === null, 'מזהה טיוטה לא תקין — נדחה');
const d = S.normDraft({ id: 'dabc123', name: 'x'.repeat(500), size: '3447000000', from: 'zz', terms: 'y'.repeat(5000), mode: 'sonnet-high', created: 5 });
ok(d && d.name.length === 200 && d.size === 3447000000 && d.from === 'auto' && d.terms.length === 1000 && d.mode === 'sonnet-high', 'נרמול טיוטה: אורכים מוגבלים, שפה לא מוכרת = זיהוי אוטומטי');
const store = S.normStore({ drafts: [{ id: 'd1aaaa' }, { id: 'd1aaaa' }, { id: 'bad id' }, 7], settings: null });
ok(store.drafts.length === 1 && store.settings.mode === 'sonnet-medium', 'נרמול אחסון: בלי כפילויות ובלי זבל');
ok(S.normStore(null).drafts.length === 0 && S.normStore('x').drafts.length === 0, 'אחסון ריק/פגום — ריק');
const nd = S.newDraft({ file: { name: 'a.mp4', size: 1024, type: 'video/mp4' }, from: 'en', to: ['he', 'ar'], mode: 'haiku-high', out: { same: false, compact: true }, style: 'karaoke', terms: 'Ackman' }, 9, 'dnew01');
ok(nd.name === 'a.mp4' && nd.size === 1024 && nd.to.join() === 'he,ar' && nd.mode === 'haiku-high' && nd.out.compact && !nd.out.same && nd.style === 'karaoke' && nd.created === 9,
  'טיוטה מהטופס — רק פרטי הקובץ והבחירות');
ok(!('blob' in nd) && !('file' in nd) && Object.keys(nd).every((k) => typeof nd[k] !== 'object' || Array.isArray(nd[k]) || k === 'out'), 'הקובץ עצמו לא נשמר בטיוטה');
ok(S.fmtSize(3447000000) === '3.2GB' && S.fmtSize(150 * 1048576) === '150MB' && S.fmtSize(2048) === '2KB' && S.fmtSize(12 * 1073741824) === '12GB', 'גדלים: GB/MB/KB');
ok(S.fmtHM(105) === '1:45' && S.fmtHM(85) === '1:25' && S.fmtHM(160) === '2:40', 'זמן לשעת ראיון: שעות:דקות');
ok(S.modeName(S.modeById('opus-medium')) === 'Opus 5.5 · Medium' && S.modeName(S.modeById('haiku-high')) === 'Haiku 5.5 · High' && S.modeById('nope').id === 'sonnet-medium', 'שם מצב + נפילה לברירת המחדל');
ok(S.langName('he', 'he') === 'עברית' && S.langName('en', 'en') === 'English', 'שמות שפות מ־Intl (בלי רשת)');
ok(S.fileTitle('Ackman_TKP_interview.mp4') === 'Ackman TKP interview' && S.fileTitle('הרצאה.mkv') === 'הרצאה' && S.fileTitle('.mp4') === '.mp4' && S.fileExt('a.MkV') === 'MKV' && S.fileExt('noext') === '', 'שם תצוגה וסוג מהקובץ');
ok(S.TARGET_LANGS.includes('he') && S.TARGET_LANGS.includes('en') && S.SOURCE_LANGS.includes('en'), 'רשימות השפות');
ok(S.STYLES.join() === 'bold,classic,karaoke' && S.OUTS.join() === 'same,compact,mkv', 'סגנונות ופלטים כמו בתצוגה המקדימה');

/* ---------- 2. מחרוזות: כל מפתח בסטודיו קיים בעברית ובאנגלית ---------- */
const store2 = {};
const sandbox = {
  localStorage: { getItem: (k) => (k in store2 ? store2[k] : null), setItem: (k, v) => { store2[k] = String(v); }, removeItem: (k) => { delete store2[k]; } },
  document: { addEventListener() {}, getElementById: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {}, setAttribute() {}, dataset: {}, style: {} }),
    querySelectorAll: () => [], createElement: () => ({ classList: { add() {}, remove() {} }, style: {}, setAttribute() {} }), documentElement: { lang: '', dir: '' }, title: '' },
  window: {}, navigator: {}, location: { reload() {} }, setTimeout, clearTimeout, console,
};
vm.createContext(sandbox);
vm.runInContext(app + '\n;globalThis.__S = STRINGS;', sandbox, { filename: 'app.js' });
const STR = sandbox.__S;
const code = st.replace(/video\/\*/g, 'video/x').replace(/\/\*[\s\S]*?\*\//g, '')   // 'video/*' ב־accept הוא לא תחילת הערה
 .replace(/^\s*\/\/.*$/gm, '');
const keys = new Set([...code.matchAll(/(?<![A-Za-z0-9_$])T\(\s*'([A-Za-z0-9_]+)'/g)].map((m) => m[1]));
ok(keys.size > 100, 'נמצאו מפתחות בסטודיו (' + keys.size + ')');
const miss = [...keys].filter((k) => !STR.he[k] || !STR.en[k]);
ok(miss.length === 0, 'כל מפתח בסטודיו קיים בעברית ובאנגלית' + (miss.length ? ': ' + miss.join(',') : ''));
const dyn = [...code.matchAll(/(?<![A-Za-z0-9_$])T\(\s*([^'\s)][^,)]*)/g)].map((m) => m[1]);
ok(dyn.length === 0, 'אין קריאות T() דינמיות — כל מפתח מילולי' + (dyn.length ? ': ' + dyn.join(',') : ''));
for (const k of ['menuStudio', 'menuStudioSub', 'studioOpenErr']) ok(STR.he[k] && STR.en[k], 'מחרוזת האפליקציה ' + k + ' בשתי השפות');
ok(STR.he.studioRibbonRec.includes('מומלץ') && STR.he.studioRibbonRec.includes('ברירת מחדל'), 'הסרט של המומלץ: "מומלץ · ברירת מחדל"');
ok(STR.he.studioApprox.includes('{v}') && STR.en.studioApprox.includes('{v}') && STR.he.studioMoreN.includes('{n}') && STR.en.studioMoreN.includes('{n}') && STR.he.studioHrs.includes('{t}') && STR.en.studioRibbonSel.includes('{name}'), 'משתנים במחרוזות — בשתי השפות');
ok(!/~/.test(STR.he.studioApprox + STR.he.studioHrs) && !/\+/.test(STR.he.studioMoreN), 'בעברית "כ־" ו"ועוד" — בלי טילדה ופלוס שמתהפכים ב־RTL');
const enHeb = Object.keys(STR.en).filter((k) => /^studio|^menuStudio/.test(k) && /[֐-׿]/.test(STR.en[k]));
ok(enHeb.length === 0, 'אין עברית במחרוזות האנגליות של הסטודיו' + (enHeb.length ? ': ' + enHeb.join(',') : ''));

/* ---------- 3. שילוב באפליקציה ---------- */
ok(/<button id="menuStudioBtn" class="row-link menu-row"/.test(html) && /data-i18n="menuStudio"/.test(html) && /data-i18n="menuStudioSub"/.test(html), 'שורה בתפריט ההמבורגר');
ok(/\.studio-ic \{ background:/.test(styles), 'אייקון אדום לשורה בתפריט');
ok(/getElementById\('menuStudioBtn'\)[\s\S]{0,300}setMainMenuOpen\(false\)[\s\S]{0,500}import\('\.\/studio\.js'\)\.then\(\(m\) => m\.openStudio\(\)\)/.test(app), 'טעינה בעצלתיים בלחיצה (import דינמי, אחרי סגירת התפריט)');
ok(/getElementById\('menuStudioBtn'\)[\s\S]{0,600}if \(navCurDepth\(\) === 0 && currentTabName\(\) !== 'overview'\) switchTab\('overview'\);[\s\S]{0,80}import\('\.\/studio\.js'\)/.test(app), 'פתיחה מטאב ראשי — הסקירה מתחת ("חזור" מהסטודיו נוחת עליה, כמו בספרייה)');
ok(!/<script[^>]+studio\.js/.test(html) && !/<link[^>]+studio\.css/.test(html), 'הסטודיו לא נטען עם האפליקציה');
ok(/hs && hs\.studio[\s\S]{0,500}import\('\.\/studio\.js'\)\.then\(\(m\) => m\.openStudio\(\{ restore: hs \}\)\)/.test(app), 'רענון בזמן שהסטודיו פתוח — חוזרים לאותו דף');
ok(/if\(h&&\(h\.lib\|\|h\.studio\)\)/.test(html) && /h\.lib\?'lib-open':'studio-open'/.test(html), 'וילון הרענון ב־index.html — גם לסטודיו');
ok(/'pwa_studio_v1'/.test(app.match(/const ACCOUNT_KEYS = \[[^\]]*\]/)[0]), 'מפתח הסטודיו ב־ACCOUNT_KEYS (הפרדת חשבונות)');
ok(/classList\.contains\('studio-open'\)\) return false/.test(app.match(/function liveCanTick\(\) \{[\s\S]*?\n\}/)[0]), 'לולאת המחירים מושהית כשהסטודיו פתוח');
const swVer = +((sw.match(/const CACHE_NAME = 'portfolio-pwa-v(\d+)'/) || [])[1] || 0);
if (swVer >= 354) ok(/const STUDIO_SHELL = \[[^\]]*'\.\/studio\.js'[^\]]*'\.\/studio\.css'/.test(sw) && /caches\.match\('\.\/studio\.js'\)/.test(sw), 'sw.js: קבצי הסטודיו נטענים מראש בעדכון אצל מי שנכנס אליו (אופליין)');
else ok(true, 'sw.js עוד בגרסה הקודמת (שלב התוכן בפרוטוקול הדו־שלבי)');

/* ---------- 4. "חזור" והיסטוריה ---------- */
ok(/function cleanState\(extra\) \{ const st = Object\.assign\(\{\}, history\.state \|\| \{\}, extra\);/.test(st), 'רשומות הסטודיו שומרות את שדות האפליקציה (snb) — "חזור" של האפליקציה לא מחליף טאב');
ok((st.match(/history\.pushState\(/g) || []).length === 2 && (st.match(/history\.pushState\(cleanState\(/g) || []).length === 2, 'כל pushState דרך cleanState');
ok((st.match(/afterBack\(\(\) => \{ try \{ history\.pushState/g) || []).length === 2 && /afterBack\(\(\) => \{ try \{ history\.back\(\); \}/.test(st) && /afterBack\(\(\) => \{ try \{ if \(root && history\.state && history\.state\.studio\) history\.replaceState/.test(st), 'pushState/replaceState/back אחרי back ממתין (snbAfterBack, לקח v322)');
// לקח v350–v352: "חזור" כניווט בהיסטוריה = צילום של Chrome במשיכה מהצד ("קפיצה") — CloseWatcher כשיש
ok(/const CW_OK = typeof window !== 'undefined' && typeof window\.CloseWatcher === 'function';/.test(st), 'CloseWatcher כשהדפדפן תומך');
ok(/if \(CW_OK\) \{ stack\.push\(\{ v: view, p \}\); syncState\(\); \}/.test(st) && /else afterBack\(\(\) => \{ try \{ history\.pushState\(cleanState\(\{ studio: depth\(\) \+ 1/.test(st), 'עם CloseWatcher — דף חדש בלי רשומה (replaceState בלבד); בלי — רשומה לכל דף');
ok(/w = new CloseWatcher\(\)/.test(st) && /w\.onclose = \(\) => \{ if \(cw === w\) \{ cw = null; closeRequest\(\); \} \}/.test(st) && /if \(root\) watch\(\);/.test(st), 'בקשת סגירה → חזרה, ומאזין חדש אחריה');
ok(/querySelector\('\.dlg-veil\.on'\)[\s\S]{0,120}\.dlg-cancel/.test(st), '"חזור" כשחלון האישור פתוח — סוגר רק אותו');
ok(/if \(!CW_OK && !window\._stKey\)/.test(st), 'Escape משלנו רק בלי CloseWatcher (שם Escape הוא בקשת סגירה)');
ok(/const uaT = !!\(e && e\.hasUAVisualTransition\);/.test(st) && /closeStudio\(uaT\); appToOverview\(\);/.test(st) && /render\('pop', uaT\)/.test(st), 'Chrome כבר הנפיש — בלי אנימציה שנייה; יציאה → סקירה');
ok(S.chainFor('home', null).map((x) => x.v).join() === 'home' && S.chainFor('def', 'out').map((x) => x.v).join() === 'home,settings,def' && S.chainFor('edit', 'dx1234').map((x) => x.v + (x.p || '')).join() === 'home,projectdx1234,editdx1234' && S.chainFor('lang', 'to').map((x) => x.v).join() === 'home,new' && S.chainFor('lang', 'def').map((x) => x.v).join() === 'home,settings,lang',
  'רענון עם CloseWatcher: המסלול עד הדף (דף שפות של טופס → טופס חדש)');
ok(/if \(!root \|\| seq !== renderSeq\) return;/.test(st), 'חזרה תוך כדי בניית דף — הציור הישן לא דורס את החדש');
ok(/if \(ds\.modalPop \|\| ds\.navSkip\) return;/.test(st) && /if \(!st\.studio\) \{ closeStudio\(uaT\); appToOverview\(\); return; \}/.test(st), 'popstate: מתעלם מסגירת חלון של האפליקציה, ויוצא כשנגמרות רשומות הסטודיו');
ok(!/history\.go\(/.test(st), 'בלי history.go עם ספירת רשומות');

/* ---------- 5. עיצוב ---------- */
const z = +((css.match(/\.st-root \{[^}]*z-index: (\d+)/) || [])[1] || 0);
ok(z === 900, 'שכבת הסטודיו: 900 (כמו הספרייה)');
const zz = (re) => +((css.match(re) || [])[1] || 0);
ok(zz(/html\.studio-open \.dlg-veil \{ z-index: (\d+)/) > z && zz(/#toast\.toast \{ z-index: (\d+)/) > z, 'חלון האישור וההודעות מעל הסטודיו (לקח v317)');
ok(/\.st-root \{[^}]*background: var\(--bg\)/.test(css), 'שכבה אטומה — האפליקציה לא מבצבצת');
ok(/class="st-root no-swipe"|'st-root no-swipe'/.test(st), 'החלקה בין עמודים חסומה בסטודיו (no-swipe)');
ok(!/(margin|padding)-(left|right)\s*:|text-align:\s*(left|right)|(^|[\s;{])(left|right)\s*:/m.test(css), 'יישור לוגי בלבד (start/end), בלי left/right');
for (const v of ['999px', '12px', '16px', '22px', '28px']) ok(!new RegExp('border-radius:\\s*' + v + '\\s*[;}]').test(css), 'עיגול ' + v + ' דרך המשתנה');
ok(/@media \(prefers-reduced-motion: reduce\)/.test(css), 'תנועה מופחתת — בלי אנימציות');
ok(/from \{ opacity: \.55;/.test(css) && !/stPush \{ from \{ opacity: 0/.test(css), 'מעבר דף מתחיל מ־.55 — בלי פריים ריק (לקח v325)');
ok(/\[data-theme="dark"\] \.st-root \{[^}]*--st-card: #1C1C1E/.test(css), 'מצב כהה: כרטיסים אטומים');
ok(/\[dir="ltr"\] \.st-back svg \{ transform: scaleX\(-1\); \}/.test(css) && /\[dir="ltr"\] \.st-chev/.test(css), 'חצים מתהפכים באנגלית');
const varsUsed = [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]);
const defined = new Set([...styles.matchAll(/(--[a-z0-9-]+)\s*:/g), ...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const undef = [...new Set(varsUsed)].filter((v) => !defined.has(v));
ok(undef.length === 0, 'כל משתנה CSS בסטודיו מוגדר (שם שגוי נכשל בשקט — לקח v132)' + (undef.length ? ': ' + undef.join(',') : ''));

/* ---------- 6. אבטחה ופרטיות ---------- */
const inner = st.split('\n').filter((l) => /innerHTML/.test(l));
ok(inner.length === 1 && /s\.innerHTML = ICON\[k\];/.test(inner[0]), 'innerHTML רק לסמלים הקבועים — כל טקסט דרך textContent');
ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(st), 'הממשק לא פונה לרשת בעצמו — רק דרך studionet.js (שלב 2)');
ok(!/localStorage\.setItem\((?!LS_STUDIO)/.test(st), 'כותב רק למפתח שלו ב־localStorage');
// שלב 2: יש שדה למפתח של ה־Routine — שדה סיסמה, נמחק מהזיכרון אחרי שמירה מוצלחת וביציאה מהדף, ולעולם לא נכנס לאחסון
ok(/keyIn\.type = 'password'/.test(st) && /w\.key = '';/.test(st) && /ui\.wiz = \{ url: ui\.wiz\.url, key: '', busy: false, err: '' \}/.test(st)
  && !JSON.stringify(S.normStore({ settings: { k: 'sk-ant-oat01-' + 'a'.repeat(30) }, conn: { hint: 'trig_…abcd', k: 'sk-ant-oat01-' + 'a'.repeat(30), u: 'https://x' } })).includes('sk-ant'), 'המפתח של ה־Routine: שדה סיסמה, נמחק אחרי השמירה וביציאה, ולא נכנס לאחסון בטלפון');
ok(/\.rel = 'noopener noreferrer'/.test(st) && /'https:\/\/claude\.ai\/code'/.test(st), 'קישור חיצוני (claude.ai/code) עם noopener');   // v356: דרך link() של האשף
ok(!/\bconfirm\(|\balert\(|\bprompt\(/.test(code.replace(/askConfirm\(/g, '')), 'בלי חלונות הדפדפן — askConfirm של האפליקציה (dlg-v297)');

console.log('\n' + n + ' בדיקות עברו');
