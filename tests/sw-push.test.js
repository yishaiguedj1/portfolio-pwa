// שלב 4 בסטודיו (10/10/2026): המאזינים להתראות ב־sw.js. לפי פרוטוקול הפריסה sw.js נכנס רק ב־PR השני —
// לכן כשאין עדיין מאזין, הבדיקה רק מדווחת; כשיש — בודקת אותו.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

if (!/addEventListener\('push'/.test(sw)) {
  console.log('ok - sw.js עוד בלי המאזינים להתראות (נכנסים ב־PR של sw.js)');
} else {
  ok(/event\.waitUntil\(self\.registration\.showNotification\(/.test(sw), 'push → showNotification בתוך waitUntil (אחרת Chrome מציג התראה כללית)');
  ok(/\^https:\\\/\\\/yishaiguedj1\\\.github\\\.io\\\/portfolio-pwa\\\/\(#studio=j\[A-Za-z0-9_-\]\{20\}\)\?\$/.test(sw), 'הקישור מההתראה — רק לאפליקציה, ורק ‎#studio=<מזהה>');
  ok(/addEventListener\('notificationclick'/.test(sw) && /clients\.openWindow\(url\)/.test(sw) && /w\.focus\(\)/.test(sw), 'נגיעה: חלון פתוח → אליו; אחרת חלון חדש');
  ok(/\.slice\(0, 80\)/.test(sw) && /\.slice\(0, 160\)/.test(sw), 'כותרת ושורה מוגבלות באורך');
}
console.log('# ' + n + ' בדיקות עברו');
