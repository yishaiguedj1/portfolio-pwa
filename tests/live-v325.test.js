// v325: כשל רצוף בלולאה החיה → הקפסולה עוברת ל"דיליי" (stale) במקום להישאר "חי" עם מחירים ישנים; חזרה → "חי" מיד
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const qa = fs.readFileSync(path.join(root, 'tools', 'qa-motion.js'), 'utf8');

ok(/const LIVE_STALE_MS = 30000;/.test(app), 'סף כשל רצוף: 30 שניות (LIVE_STALE_MS)');
const tick = app.slice(app.indexOf('async function liveTick()'), app.indexOf('function liveSchedule()'));
ok(/\} else if \(full && !state\.stale && state\.quotesAt && Date\.now\(\) - state\.quotesAt > LIVE_STALE_MS\) \{\s*\n[^\n]*\n[^\n]*\n\s*state\.stale = true;\s*\n\s*updateSourceLabel\(\);/.test(tick), 'טיק מלא בלי מחירים מעבר לסף → state.stale=true + ציור הקפסולה');
ok(!/setBanner\(t\('noPrices/.test(tick), 'בלי באנר אדום בכשל של הלולאה (הבאנר רק כשאין מחירים בכלל)');
ok(/if \(state\.stale\) \{ setBanner\(null\); state\.stale = false; updateSourceLabel\(\); \}/.test(tick), 'מחירים חזרו → stale מתאפס והקפסולה מצוירת מיד (גם בטיק חלקי)');
ok(!/state\.live = false/.test(tick), 'הכשל לא נוגע ב־state.live — אחרי החזרה הקפסולה "חי" בלי לחכות לטיק מלא');

// הקפסולה הטהורה: stale → "דיליי" ונקודה אפורה; לא stale → חי
const ctx = { console, Intl, Date };
vm.createContext(ctx);
const pure = app.slice(app.indexOf('function sourceLabelHTML('), app.indexOf('function updateSourceLabel()'));
vm.runInContext('const t = (k) => k; const esc = (x) => String(x); const marketStatusKind = () => ({ kind: \'open\' }); const SRC_SESS_ICONS = {};\n' + pure + '\nglobalThis.sourceLabelHTML = sourceLabelHTML;', ctx);
const tue = Date.UTC(2026, 9, 6, 15, 0); // יום ג׳ 11:00 ניו־יורק — שוק פתוח
const liveHtml = ctx.sourceLabelHTML({ source: 'Yahoo', live: true, stale: false, session: '' }, tue);
const staleHtml = ctx.sourceLabelHTML({ source: 'Yahoo', live: true, stale: true, session: '' }, tue);
ok(!/srcDelayed/.test(liveHtml) && !/ delay/.test(liveHtml), 'קפסולה: חי = בלי "דיליי"');
ok(/srcDelayed/.test(staleHtml) && / delay/.test(staleHtml), 'קפסולה: stale = "· דיליי" + מחלקת delay (נקודה אפורה)');

ok(/LIVE\.fail = true; for \(let i = 0; i < 110; i\+\+\)/.test(qa) && /55 שניות/.test(qa), 'כלי: צעד הכשל ממתין עד 55 שניות (סף 30 + טיק מלא)');
ok(/row\.flicker > 0 && !opt\.flickerOk/.test(qa) && (qa.match(/flickerOk: true/g) || []).length >= 2, 'כלי: הבהוב מכוון (החלפת ערכת קורא לבן/שחור) מסומן flickerOk');
ok(/await page\.click\('#stockList \.stock >> nth=1 >> \.stock-head'\)/.test(qa), 'כלי: מדידת פתיחת כרטיס בלחיצה אמיתית (לחיצה סינתטית נספרת ב־CLS)');
// v325 — שני באגים חזותיים שנמצאו בכלי המדידה
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
ok(/@keyframes tabIn \{ from \{ opacity: \.55;/.test(css), 'tabIn לא מתחיל מ־opacity:0 (פריים ריק במעבר טאב — הבהוב שחור במצב כהה)');
ok(/\.stock\.anim \.stock-body > \* \{ overflow: visible; align-self: start; min-width: 0; max-width: 100%; \}/.test(css), 'גוף הכרטיס בזמן האנימציה: min-width:0 (ב־320px הוא היה ברוחב התוכן והתכווץ בסוף — קפיצה אופקית)');
ok(/function navScrollTop\(\) \{[\s\S]*?de\.dataset\.navScroll = '1';[\s\S]*?window\.scrollTo\(0, 0\);/.test(app) && /cancelScrollRestore\(\);\n  navScrollTop\(\);\n\}/.test(app), 'switchTab: הגלילה לראש העמוד מסומנת data-nav-scroll (navScrollTop)');
ok(/!document\.documentElement\.dataset\.navScroll\) M\.cur\.scrollJumps\.push\(\{ el: 'window'/.test(qa), 'כלי: קפיצת חלון מסומנת data-nav-scroll לא נספרת');
console.log('# ' + n + ' בדיקות עברו');
