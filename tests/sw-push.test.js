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

// מ9: פעולות בהתראה של עבודה שהסתיימה — "צפייה" / "עריכה" (‎&v=play|subs). הצד של האפליקציה נבדק תמיד.
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const st = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
ok(/const sv = get\('v'\);/.test(app) && /openStudio\(\{ job: sj, view: sv === 'play' \|\| sv === 'subs' \? sv : '' \}\)/.test(app), 'האפליקציה מעבירה רק play/subs מהקישור');
ok(/function goJobLink\(id, view\) \{\n  go\('job', id\);/.test(st) && /view === 'play' && canPlay\(rec\)/.test(st) && /view === 'subs' && canEdit\(rec\)/.test(st), 'הסטודיו: דף העבודה קודם (חזור → העבודה), נגן/עורך רק כשאפשר');
if (/actions: m\.k === 'done'/.test(sw)) {
  const vm = require('vm');
  const L = {}, shown = [], nav = [];
  const self = {
    addEventListener: (k, f) => { L[k] = f; },
    registration: { scope: 'https://yishaiguedj1.github.io/portfolio-pwa/', showNotification: (t, o) => { shown.push(o); return Promise.resolve(); } },
    clients: { matchAll: async () => [], openWindow: async (u) => { nav.push(u); } },
  };
  const ctx = { self, caches: {}, fetch: () => Promise.reject(new Error('x')), URL, Promise, console, Response: function () {}, setTimeout };
  vm.runInNewContext(sw, ctx);
  const ev = (o) => Object.assign({ waitUntil: (p) => { ev.p = p; } }, o);
  const J = 'j' + 'A'.repeat(20), U = 'https://yishaiguedj1.github.io/portfolio-pwa/#studio=' + J;
  L.push(ev({ data: { json: () => ({ t: 'x', b: 'y', k: 'done', j: J, u: U }) } }));
  L.push(ev({ data: { json: () => ({ t: 'x', b: 'y', k: 'ask', j: J, u: U }) } }));
  L.push(ev({ data: { json: () => ({ t: 'x', b: 'y', k: 'done', j: J, u: 'https://evil.example/' }) } }));
  ok(shown[0].actions.map((a) => a.action).join() === 'play,subs' && !shown[1].actions.length && !shown[2].actions.length, 'פעולות רק בהתראת "הסתיימה" עם קישור תקין');
  (async () => {
    const click = async (action, url) => { const e = ev({ action, notification: { close() {}, data: { url } } }); L.notificationclick(e); await ev.p; };
    await click('play', U); await click('subs', U); await click('', U); await click('play', './');
    ok(nav[0] === U + '&v=play' && nav[1] === U + '&v=subs' && nav[2] === U && /portfolio-pwa\/$/.test(nav[3]), 'נגיעה בפעולה → ‎&v=play|subs; בגוף ההתראה — דף העבודה');
    console.log('# ' + n + ' בדיקות עברו');
  })().catch((e) => { console.error(e); process.exit(1); });
} else console.log('# ' + n + ' בדיקות עברו');
