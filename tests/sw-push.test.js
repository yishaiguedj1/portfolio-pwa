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
  ok(/event\.waitUntil\(\(async \(\) => \{[\s\S]{0,400}return self\.registration\.showNotification\(/.test(sw.slice(sw.indexOf("addEventListener('push'"))), 'push → showNotification בתוך waitUntil (אחרת Chrome מציג התראה כללית)');
  // שלב 4 (13/10/2026): הקישור תמיד בכתובת שבה נרשמה ההתראה — מההודעה רק מזהה העבודה (‎#studio=<מזהה>)
  { const a = sw.indexOf('const hm = '), b = sw.indexOf('\n', sw.indexOf('const url = ', a));
    const f = new Function('m', sw.slice(a, b) + '\nreturn url;');
    const id = 'j' + 'A'.repeat(20);
    ok(f({ u: 'https://yishaiguedj1.github.io/portfolio-pwa/#studio=' + id }) === './#studio=' + id
      && f({ u: 'https://studio-staging.thesnowball.app/#studio=' + id }) === './#studio=' + id
      && f({ u: 'https://evil.example/#studio=' + id + 'x' }) === './' && f({ u: 'javascript:alert(1)' }) === './'
      && f({ u: 'https://evil.example/' }) === './' && f({}) === './', 'הקישור מההתראה — רק לאפליקציה שבה נרשמה, ורק ‎#studio=<מזהה>'); }
  ok(/addEventListener\('notificationclick'/.test(sw) && /clients\.openWindow\(url\)/.test(sw) && /w\.focus\(\)/.test(sw), 'נגיעה: חלון פתוח → אליו; אחרת חלון חדש');
  ok(/\.slice\(0, 80\)/.test(sw) && /\.slice\(0, 160\)/.test(sw), 'כותרת ושורה מוגבלות באורך');
}

// מ9: פעולות בהתראה של עבודה שהסתיימה — "צפייה" / "עריכה" (‎&v=play|subs). הצד של האפליקציה נבדק תמיד.
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const st = fs.readFileSync(path.join(__dirname, '..', 'studio.js'), 'utf8');
ok(/const sv = get\('v'\);/.test(app) && /\(sv === 'play' \|\| sv === 'subs' \? '&v=' \+ sv : ''\)/.test(app) && /&v=\(play\|subs\)/.test(fs.readFileSync(path.join(__dirname, '..', 'studio-app.js'), 'utf8')), 'האפליקציה מעבירה רק play/subs מהקישור (ל־Studio העצמאי)');
ok(/function goJobLink\(id, view, kind\) \{[^\n]*\n  go\('job', id, kind\);/.test(st) && /view === 'play' && canPlay\(rec\)/.test(st) && /view === 'subs' && canEdit\(rec\)/.test(st), 'הסטודיו: דף העבודה קודם (חזור → העבודה), נגן/עורך רק כשאפשר');
if (/actions: m\.k === 'done'/.test(sw)) {
  const vm = require('vm');
  const L = {}, shown = [], nav = [], navd = [], live = new Map();
  let wins = [];
  const self = {
    addEventListener: (k, f) => { L[k] = f; },
    registration: { scope: 'https://yishaiguedj1.github.io/portfolio-pwa/',
      showNotification: (t, o) => { shown.push(Object.assign({ title: t }, o)); live.set(o.tag, { title: t, body: o.body, data: o.data, actions: o.actions }); return Promise.resolve(); },
      getNotifications: async (q) => (live.has(q.tag) ? [live.get(q.tag)] : []) },
    clients: { matchAll: async () => wins, openWindow: async (u) => { nav.push(u); } },
  };
  const ctx = { self, caches: {}, fetch: () => Promise.reject(new Error('x')), URL, Promise, console, Response: function () {}, setTimeout };
  vm.runInNewContext(sw, ctx);
  const ev = (o) => Object.assign({ waitUntil: (p) => { ev.p = p; } }, o);
  const J = 'j' + 'A'.repeat(20), U = 'https://yishaiguedj1.github.io/portfolio-pwa/#studio=' + J;
  const push = async (m) => { L.push(ev({ data: { json: () => m } })); await ev.p; return shown[shown.length - 1]; };
  (async () => {
    const a = await push({ t: 'x', b: 'y', k: 'done', j: J, u: U, at: 10 });
    const b = await push({ t: 'x', b: 'y', k: 'ask', j: J, u: U, at: 11 });
    live.clear();
    const c = await push({ t: 'x', b: 'y', k: 'done', j: J, u: 'https://evil.example/' });
    ok(a.actions.map((x) => x.action).join() === 'play,subs' && !b.actions.length && !c.actions.length, 'פעולות רק בהתראת "הסתיימה" עם קישור תקין');
    // 27/10/2026: התקדמות העבודה — אותה התראה (תג לעבודה) מתחלפת בשקט; סוף העבודה מחליף אותה עם צליל; ישנה לא דורסת חדשה
    live.clear();
    const s1 = await push({ t: 'כותבים', b: '▰▱', k: 'stage', j: J, u: U, at: 100 });
    const s2 = await push({ t: 'מתאימים', b: '▰▰', k: 'stage', j: J, u: U, at: 200 });
    ok(s1.tag === 'studio-' + J && s2.tag === s1.tag && s1.silent && !s1.renotify && s2.title === 'מתאימים', 'שלב: אותו תג לעבודה, שקט, מחליף את הקודם');
    const d = await push({ t: 'מוכן', b: '', k: 'done', j: J, u: U, at: 300 });
    ok(d.tag === s1.tag && d.renotify && !d.silent, 'סוף העבודה מחליף את התראת השלב — עם צליל');
    const late = await push({ t: 'בודקים', b: '▰', k: 'stage', j: J, u: U, at: 250 });
    ok(late.title === 'מוכן' && late.silent && live.get(s1.tag).title === 'מוכן', 'התראת שלב שהגיעה באיחור — לא דורסת את "מוכן"');
    // 27/10/2026: הדף מעדכן את ההתראה לפי ההערכה שבמסך — דיווח מהשרתון שמראה פחות לא מחזיר אחורה
    live.clear();
    live.set('studio-' + J, { title: 'בודקים', body: '60%', data: { k: 'stage', st: 'rv', p: 0.6, at: 900 } });
    const back = await push({ t: 'בודקים', b: '10%', k: 'stage', j: J, u: U, at: 1000, st: 'rv', p: 0.1 });
    ok(back.body === '60%' && live.get('studio-' + J).data.p === 0.6, 'שלב: דיווח עם אחוז נמוך יותר באותו שלב — ההתראה נשארת על מה שהדף הראה');
    const fwd = await push({ t: 'צורבים', b: '0%', k: 'stage', j: J, u: U, at: 1100, st: 'bn', p: 0 });
    ok(fwd.title === 'צורבים' && fwd.data.st === 'bn', 'שלב חדש מהשרתון — מחליף');
    const click = async (action, url) => { const e = ev({ action, notification: { close() {}, data: { url } } }); L.notificationclick(e); await ev.p; };
    await click('play', U); await click('subs', U); await click('', U); await click('play', './');
    ok(nav[0] === U + '&v=play' && nav[1] === U + '&v=subs' && nav[2] === U && /portfolio-pwa\/$/.test(nav[3]), 'נגיעה בפעולה → ‎&v=play|subs; בגוף ההתראה — דף העבודה');
    // Studio כבר פתוחה — נגיעה מנווטת אותה לעבודה (גם בהתראת ההעלאה ברקע)
    wins = [{ url: 'https://yishaiguedj1.github.io/portfolio-pwa/', navigate: async (u) => { navd.push(u); }, focus: async () => {} }];
    await click('', U);
    L.backgroundfetchclick(ev({ registration: { id: 'snbup-' + J } })); await ev.p;
    ok(navd[0] === U && navd[1] === U, 'נגיעה בהתראה (גם של ההעלאה ברקע) כש־Studio פתוחה → ישר לעבודה');
    console.log('# ' + n + ' בדיקות עברו');
  })().catch((e) => { console.error(e); process.exit(1); });
} else console.log('# ' + n + ' בדיקות עברו');
