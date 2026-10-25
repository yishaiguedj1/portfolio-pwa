// 25/10/2026 — הורדה מקישור בלי האפליקציה לאנדרואיד (אייפון, מחשב): רק לענן, יוטיוב נאמר מיד (חוסם את השרת),
// ו"המנוי שלי" עם שרת (ry) מתחיל עבודת קישור. הרצה: node tests/studio-linkweb.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

const m = /export function ytHost\(u\) \{\n([\s\S]*?)\n\}/.exec(src);
ok(m, 'ytHost קיימת');
const ytHost = new Function('u', m[1]);
for (const u of ['https://www.youtube.com/watch?v=x', 'https://youtu.be/x', 'https://m.youtube.com/shorts/x', 'https://music.youtube.com/watch?v=x', ' https://youtube.com/live/x ', 'https://www.youtube-nocookie.com/embed/x'])
  ok(ytHost(u) === true, 'יוטיוב: ' + u.trim());
for (const u of ['https://vimeo.com/1', 'https://www.ted.com/talks/x', 'https://notyoutube.com/x', 'https://youtube.com.evil.example/x', 'לא קישור', ''])
  ok(ytHost(u) === false, 'לא יוטיוב: ' + (u || '(ריק)'));

const lc = src.slice(src.indexOf('function linkCheck('), src.indexOf('function linkCheckSrv('));
ok(/if \(ui\.url && ytHost\(L\.u\)\) \{ L\.st = 'err'; L\.e = 'yt'; \}/.test(lc), 'בלי האפליקציה — יוטיוב נעצר לפני הבדיקה בשרת');
ok(lc.indexOf("L.e = 'yt'") < lc.indexOf('linkCheckSrv(f, L, seq)'), 'שאר האתרים — לבדיקה בשרת');
ok(/case 'yt': return T\('studioLinkEYt'\);/.test(src), 'טקסט לשגיאת יוטיוב');
const sc = src.slice(src.indexOf('function startLinkCloud('), src.indexOf('function startLinkCloud(') + 700);
ok(/!apiMode\(\) && !cpMode\(\) && !ryMode\(\)/.test(sc), '"המנוי שלי" עם שרת — מתחיל עבודת קישור');
ok(/else if \(ryMode\(\)\) spec\.ry = 1;/.test(src.slice(src.indexOf('function startLinkCloud('), src.indexOf('function startLinkCloud(') + 2500)), 'עבודת קישור במנוי — ry');
ok(/sub: devDl\(\) \? T\('studioLinkRowS'\) : T\('studioLinkRowSCloud'\)/.test(src), 'בלי האפליקציה — השורה לא מבטיחה יוטיוב');
for (const k of ['studioLinkEYt', 'studioLinkRowSCloud', 'studioLinkCloudNoteWeb'])
  ok((app.match(new RegExp(k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
ok(!/studioLinkRowSCloud: "[^"]*YouTube/.test(app), 'השורה לענן לא מזכירה יוטיוב');
console.log('\nכל ' + n + ' הבדיקות עברו ✓');
