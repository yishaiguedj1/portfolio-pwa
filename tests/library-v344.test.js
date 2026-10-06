// v344 (בקשת המשתמש 06/10/2026): דפדוף מהיר ברצף — אנימציה מהירה יותר לפי הקצב, ותמיד האנימציה החדשה (בלי נפילה למעבר הפשוט)
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'pagecurl.js'), 'utf8');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const M = {}, names = [...src.matchAll(/^export (?:function|const) (\w+)/gm)].map((m) => m[1]);
new Function('M', src.replace(/^export /gm, '').replace(/^const (VS|FS|BLUR|COMP|QUAD|LIGHT)\b/gm, 'var $1') + '\n' + names.map((k) => 'M.' + k + ' = ' + k + ';').join('\n'))(M);

// משך הדפדוף: v345 — מהירות קבועה (SPEED) + בלימה; רצף — מהיר יותר
const sp = 1.12;
const d = [0, 1, 2, 3].map((r) => M.rushDur(0.6, sp, r));
ok(d[0] > d[1] && d[1] > d[2] && d[2] > d[3], 'כל דרגת רצף — מהיר יותר: ' + d.map(Math.round).join(' → '));
ok(M.rushDur(0.6, sp, 9) === d[3] && M.rushDur(0.6, sp, -1) === d[0], 'דרגת הרצף מוגבלת ל־0..3');
ok(/rush = now - lastBegin < RUSH_GAP \? Math\.min\(3, rush \+ 1\) : 0/.test(src) && /RUSH_GAP = 1000/.test(src), 'רצף = התחלה פחות משנייה אחרי הקודמת; עצירה — חוזר לאיטי');
ok(/const dur = rushDur\(dist, SPEED, s\.rush \|\| 0\)/.test(src), 'המשך מחושב לפי הרצף של המחווה');

// תמיד האנימציה החדשה: 'wait' במקום כשל, ממתין אחד לכל מחווה
ok(/if \(g \|\| busy\) return 'wait'/.test(src), 'דפדוף קודם שעוד מסתיים — מחכים (לא מעבר פשוט)');
ok(/ensureNeighbor\(dir > 0 \? 'next' : 'prev'\); return 'wait'/.test(src), 'פרק שכן שעוד נטען — מחכים לו');
ok(/d0\.readyState !== 'complete'/.test(src) && /r\.pages < 3\) return 'wait'/.test(src), 'המנוע באמצע טעינת פרק — מחכים (לא משכפלים דף ריק)');
ok(/turn\(\) \{ if \(g && !g\.anim\) animateTo\(true\); \}/.test(src), 'מחווה שהסתיימה בזמן ההמתנה — הדף מתהפך עד הסוף');
ok(/function curlWait\(w\)/.test(lib) && /CURL_WAIT_MS = 2500/.test(lib), 'ממתין עם גבול זמן (רק אחרי 2.5 שנ׳ — מעבר רגיל)');
ok(/if \(!ct\.on && !ct\.wait\)/.test(lib), 'ממתין אחד לכל מחווה — לא בכל תנועת אצבע (באג שנמצא בבדיקה: כמה דפים בהחלקה אחת)');
ok(/if \(ct\.wait\) \{ e\.stopPropagation\(\); if \(e\.type === 'touchend'\) ct\.wait\.up = true;/.test(lib), 'שחרור בזמן ההמתנה — ממשיך לחכות ומתהפך כשמוכן');

// נגיעה באזור החתוך (clip-path) בזמן דפדוף — לא נבלעת
ok(/for \(const ty of \['touchstart', 'touchmove', 'touchend', 'touchcancel'\]\) box\.addEventListener\(ty/.test(lib), 'גם שכבת הקורא מקשיבה (התצוגה חתוכה בזמן דפדוף)');
ok(/closest\('\.rd-topbar, \.rd-botbar, \.tr-card/.test(lib), 'לא מסרגלים/כרטיסים/כפתורים');

// כיוון בזמן מעבר פרק
ok(/rd\.curlDir = /.test(lib) && /readingDir\(rd\.book, rd\.rec && rd\.rec\.title\) === 'rtl'/.test(lib), 'כיוון ההחלקה — ממסמך עם תוכן בלבד, אחרת שמור/כיוון הספר (מסמך ריק הפך "קדימה" ל"אחורה")');

// טעינה מראש מיידית
const pre = lib.slice(lib.indexOf('function curlPrebuild()'), lib.indexOf('function curlPrebuild()') + 600);
ok(/if \(curlT\) return;/.test(pre) && /, 40\);/.test(pre) && !/clearTimeout\(curlT\)/.test(pre), 'הפרקים השכנים נטענים מיד אחרי כל דפדוף — לא דחייה שמתאפסת בדפדוף מהיר');
console.log(n + ' בדיקות עברו');
