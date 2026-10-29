// 29/10/2026: ניטור משתמשים במרכז הניהול (ibkr-proxy/lib/usermon.js) — מי עובד עכשיו, כמה כל משתמש תרגם ועלה, הטיימליין,
// ההתראות למנהל (עבודה של משתמש אחר בווילון, סוף, 80% מהתקרה, סיכום יומי), תקרה והשהיה לכל משתמש, והשומר "עבודה של אחר".
// הרצה: node tests/usermon.test.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const UM = require(path.join(root, 'ibkr-proxy/lib/usermon.js'));
  const W = require(path.join(root, 'ibkr-proxy/lib/webpush.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const now = Date.UTC(2026, 9, 29, 10, 0, 0);
  const A = 'adminUid0001', B = 'userBbb00002', C = 'userCcc00003';
  const J = (i) => 'j' + String(i).padStart(20, 'x');
  const use = (usd, i) => [{ k: 'tl', m: 'claude-sonnet-5-5', n: 1, i, o: 1000, cr: 0, c5: 0, c1: 0, usd }];

  /* ---- זהות ---- */
  const id = UM.idOf({ name: ' דנה\u0007 <b>כהן</b> ', email: 'Dana@Example.com' });
  ok(id.nm === 'דנה bכהן/b' && id.em === 'dana@example.com', 'השם מנוקה (בלי תווי בקרה וסוגריים), המייל באותיות קטנות');
  ok(UM.idOf({ email: 'not-an-email' }).em === '' && UM.label('', 'ron@x.io') === 'ron' && UM.label('רון', 'ron@x.io') === 'רון', 'מייל לא תקין נזרק; בלי שם — מה שלפני @');

  /* ---- עבודה חיה ---- */
  const run = { id: J(1), uid: B, kind: 'tr', state: 'running', created: now - 20 * 60e3, c0: now - 20 * 60e3,
    spec: { eng: 'api', dur: 2880, mode: 'sonnet-medium', to: ['he'] }, use: use(1.2, 500000), tw: { lv: 'ok', usd: 1.84 },
    prog: { st: 'tl', p: 0.4, stg: { up: { s: 1, e: 2 }, tr: { s: 2, e: 3 }, al: { s: 3, e: 4 }, tl: { s: 4 } } } };
  const r = UM.liveRow(run, { nm: 'דנה כהן', em: 'dana@example.com' }, now);
  ok(r.nm === 'דנה כהן' && r.usd === 1.84 && r.tok === 501000 && r.p > 0.2 && r.p < 1 && r.left > 0 && r.exp >= r.usd && r.our, 'שורה חיה: שם, עלות (המגדל — החי ביותר), טוקנים, אחוז, זמן וצפי');
  ok(r.stg.up === 'd' && r.stg.tl === 'n' && r.by.tl.tok === 501000 && !('name' in r), 'שורה חיה: השלבים, העלות לפי סוכן — ובלי שם הקובץ');
  ok(UM.liveRow(Object.assign({}, run, { spec: { eng: 'api', ry: 1, dur: 60 } }), {}, now).our === false, 'במנוי של המשתמש (Routine) — לא עולה לנו');
  ok(UM.isLive(run) && !UM.isLive(Object.assign({}, run, { state: 'done' })) && !UM.isLive(Object.assign({}, run, { kind: 'ping' })), 'חי = בתור או רץ, לא בדיקת חיבור');

  /* ---- משתמשים ---- */
  const jobs = [run,
    { id: J(2), uid: C, kind: 'tr', state: 'done', created: now - 3 * 86400e3, updated: now - 3 * 86400e3 + 1, spec: { eng: 'api', dur: 600 }, use: use(2.71, 1e6), q: { s: 86 } },
    { id: J(3), uid: C, kind: 'tr', state: 'failed', created: now - 2 * 86400e3, updated: now - 2 * 86400e3, ended: now - 2 * 86400e3, err: 'tower_stop', spec: { eng: 'api', dur: 300 }, use: use(0.4, 1000) },
    { id: J(4), uid: A, kind: 'tr', state: 'done', created: now - 86400e3, updated: now - 86400e3, spec: { eng: 'api', ry: 1, dur: 720 }, use: use(9, 9) },
    { id: J(5), uid: C, kind: 'tr', state: 'done', created: now - 40 * 86400e3, updated: now - 40 * 86400e3, spec: { eng: 'api', dur: 60 }, use: use(5, 5) }];
  const stats = [{ id: A, nm: 'ישי', em: 'admin@x.io', ls: now - 60e3 }, { id: B, nm: 'דנה כהן', em: 'dana@example.com', ls: now - 30e3, fs: now - 2 * 86400e3, mc: 50, mu: { m: S.monthKey(now), usd: 40.5 } },
    { id: C, nm: 'רון לוי', em: 'ron@x.io', ls: now - 3600e3, ps: 1, tt: { usd: 100, tok: 5e6, n: 20, sec: 36000, ok: 20, bf: 1 } }, { id: 'bad id!' }];
  const us = UM.usersView(stats, jobs, now, { cap: 30, me: A });
  const rb = us.rows.find((x) => x.u === B), rc = us.rows.find((x) => x.u === C), ra = us.rows.find((x) => x.u === A);
  ok(us.rows[0].u === B && rb.live && rb.cap === 50 && rb.mc === 50 && rb.mo === 40.5, 'משתמשים: מי שעובד עכשיו ראשון; תקרה אישית');
  ok(rc.d30.n === 2 && rc.d30.ok === 1 && rc.d30.f === 1 && rc.d30.usd === 3.11 && rc.d30.tok === 1003000 && rc.ps && rc.cap === 30, '30 יום: ספירה, הצלחות, תקלות, עלות וטוקנים; מושהה; תקרת המערכת');
  ok(rc.all.usd === 100 && rc.all.n === 20, 'מאז ומעולם: מהסכום המצטבר');
  ok(ra.me && ra.d30.usd === 0 && ra.d30.n === 1, 'עבודה במנוי של המשתמש — נספרת, אבל לא עולה לנו');
  ok(!us.rows.some((x) => x.u === 'bad id!') && us.active.d1 === 3 && us.nw === 1, 'מזהה לא תקין נזרק; פעילים היום; חדשים השבוע');

  /* ---- סכומים מצטברים ---- */
  const tt = UM.addTotal(UM.addTotal(null, { usd: 1.005, tok: 10, n: 1, sec: 60, ok: 1 }), { usd: 2, tok: 5 });
  ok(tt.usd === 3.005 && tt.tok === 15 && tt.n === 1 && tt.sec === 60, 'סכום מצטבר: מתווסף');
  ok(UM.addTotal({ usd: -5, n: 'x' }, { usd: -1 }).usd === 0, 'סכום מצטבר: שלילי / לא מספר = 0');
  const bf = UM.backfill(jobs.filter((j) => j.uid === C));
  ok(bf.bf === 1 && bf.n === 2 && bf.usd === 8.11 && bf.sec === 660, 'מילוי ראשון: רק עבודות שהסתיימו (n = שהצליחו); עלות גם של מה שנעצר');

  /* ---- הטיימליין ---- */
  const logs = [{ k: 'us_pause', d: 'רון לוי', w: 'admin@x.io', at: now - 5 * 60e3 }, { k: 'mt_on', d: '', w: '', at: now - 60 * 86400e3 }];
  const tl = UM.timeline(jobs, logs, stats, now);
  ok(tl.every((e, i) => !i || tl[i - 1].at >= e.at) && tl.length <= UM.TL_MAX, 'טיימליין: החדש למעלה');
  ok(tl.some((e) => e.t === 'js' && e.j === J(1) && e.live) && tl.some((e) => e.t === 'jd' && e.j === J(2) && e.usd === 2.71 && e.q === 86)
    && tl.some((e) => e.t === 'jf' && e.err === 'tower_stop'), 'טיימליין: התחלה (חיה), סיום עם עלות ואיכות, עצירה עם הסיבה');
  ok(tl.some((e) => e.t === 'ad' && e.u === A && e.k === 'us_pause') && !tl.some((e) => e.k === 'mt_on'), 'טיימליין: פעולות המנהל (עם המשתמש לפי המייל), רק 30 יום');
  ok(tl.some((e) => e.t === 'nu' && e.u === B) && !tl.some((e) => e.j === J(5)), 'טיימליין: משתמש חדש; עבודה מלפני 30 יום לא נכנסת');

  /* ---- תקרה, השהיה ---- */
  ok(UM.normCap(25) === 25 && UM.normCap('') === 0 && UM.normCap(0) === 0 && UM.normCap(0.4) === -1 && UM.normCap(20000) === -1 && UM.normCap('abc') === -1, 'תקרה: 1–10,000, ריק/0 = של המערכת');
  ok(UM.capOf({ mc: 50 }, 30) === 50 && UM.capOf({ mc: 0 }, 30) === 30 && UM.capOf({ mc: 3.5 }, 30) === 30 && UM.paused({ ps: 1 }) && !UM.paused({ ps: 0 }), 'תקרה אישית / של המערכת; השהיה');
  ok(UM.capWarn({ mc: 50 }, 40, 30, now).cap === 50 && UM.capWarn({ mc: 50, m80: S.monthKey(now) }, 45, 30, now) === null && UM.capWarn({}, 10, 30, now) === null, '80%: פעם אחת בחודש');
  ok(UM.watchFor(run, A) && !UM.watchFor(run, B) && !UM.watchFor(run, '') && !UM.watchFor(Object.assign({}, run, { kind: 'ping' }), A), 'התראה למנהל רק על עבודה של משתמש אחר');

  /* ---- ההתראות (webpush.message) ---- */
  const wm = W.message('watch', J(1), 'he', { nm: 'דנה כהן', st: 'tl', p: 0.58, usd: 1.84, left: 840 }, now);
  ok(wm.t.includes('דנה כהן') && wm.t.includes('לא שלך') && wm.b.includes('58%') && wm.b.includes('$1.84') && wm.b.includes('14'), 'בווילון: השם, "לא שלך", אחוז, עלות וזמן');
  ok(wm.u === 'https://admin.thesnowball.app/#live=' + J(1) && wm.k === 'watch' && wm.p === 0.58 && wm.at === now, 'נגיעה = העבודה החיה במרכז הניהול');
  ok(W.message('watch', 'bad', 'he', { nm: 'x' }, now) === null, 'בלי מזהה עבודה — לא נשלחת');
  const we = W.message('watch_end', J(1), 'en', { nm: 'Dana', ok: true, usd: 3.02, min: 22 }, now);
  ok(we.t.includes('Dana') && we.b.includes('$3.02') && we.b.includes('22'), 'סוף העבודה — עם העלות והזמן');
  ok(/80%/.test(W.message('cap80', '', 'he', { nm: 'רון', usd: 40, cap: 50 }, now).t) && W.message('daily', '', 'he', { u: 4, n: 3, usd: 6.42 }, now).b.includes('$6.42')
    && W.message('watch_clear', '', 'he', {}, now).u.endsWith('#ov'), '80% / הסיכום היומי / "אין אחרים"');
  ok(UM.KINDS.every((k) => W.KINDS.includes(k)), 'הסוגים החדשים ברשימת ההתראות');
  ok(!/מתרגמת|מתרגם עכשיו|סיים לתרגם|סיימה/.test(read('ibkr-proxy/lib/usermon.js')), 'נוסח בלי מגדר (לא יודעים מי המשתמש)');

  /* ---- הסיכום היומי ---- */
  ok(UM.dailyDue(Date.UTC(2026, 9, 29, 17, 30), '') === '' && UM.dailyDue(Date.UTC(2026, 9, 29, 19, 5), '') === '2026-10-29'
    && UM.dailyDue(Date.UTC(2026, 9, 29, 19, 5), '2026-10-29') === '', 'סיכום יומי: אחרי 21:00 בישראל, פעם אחת ביום');
  const ds = UM.dailySum(stats, jobs, now);
  ok(ds.n === 2 && ds.u >= 2 && ds.usd === 1.2, 'סיכום יומי: תרגומים מ־24 השעות האחרונות; עלות — רק מה שעלה לנו');

  /* ---- sw.js: התראת המנהל — תג משלה, שקטה ונשארת, נפתחת במרכז הניהול ---- */
  const sw = read('sw.js'), L = {}, live = new Map(), shown = [];
  const ctx = { self: { addEventListener: (k, f) => { L[k] = f; }, registration: { scope: 'https://studio.thesnowball.app/',
    getNotifications: async ({ tag }) => (live.has(tag) ? [live.get(tag)] : []),
    showNotification: async (title, o) => { const x = Object.assign({ title }, o); live.set(o.tag, x); shown.push(x); } },
    clients: { matchAll: async () => [], openWindow: async (u) => { ctx.opened = u; } }, location: { origin: 'https://studio.thesnowball.app' }, skipWaiting() {} },
    caches: { open: async () => ({}), keys: async () => [], match: async () => null }, fetch: async () => ({}), URL, Response, Request: function () {}, console, setTimeout, Date, indexedDB: undefined };
  vm.createContext(ctx);
  vm.runInContext(sw, ctx);
  let wp = null;
  const ev = (o) => Object.assign({ waitUntil: (p) => { wp = p; } }, o);
  const push = async (m) => { L.push(ev({ data: { json: () => m } })); await wp; return shown[shown.length - 1]; };
  const a1 = await push({ t: '👤 דנה · תרגום רץ · לא שלך', b: '40%', k: 'watch', j: J(1), u: 'https://admin.thesnowball.app/#live=' + J(1), at: 100, p: 0.4 });
  ok(a1.tag === 'watch-' + J(1) && a1.silent && !a1.renotify && a1.data.url === 'https://admin.thesnowball.app/#live=' + J(1), 'sw: תג לכל עבודה של אחר, שקטה, קישור למרכז הניהול');
  const own = await push({ t: 'מתרגמים', b: '10%', k: 'stage', j: J(1), u: 'https://studio.thesnowball.app/#studio=' + J(1), at: 110, st: 'tl', p: 0.1 });
  ok(own.tag === 'studio-' + J(1) && live.has('watch-' + J(1)), 'sw: ההתראה שלך (studio-) וזו של המנהל (watch-) — שתיים נפרדות');
  const back = await push({ t: 'x', b: '20%', k: 'watch', j: J(1), u: 'https://admin.thesnowball.app/#live=' + J(1), at: 120, p: 0.2 });
  ok(back.body === '40%', 'sw: דיווח עם אחוז נמוך יותר לא מחזיר אחורה');
  const end = await push({ t: '■ דנה · התרגום הסתיים', b: '$3', k: 'watch_end', j: J(1), u: 'https://admin.thesnowball.app/#live=' + J(1), at: 200 });
  ok(end.tag === 'watch-' + J(1) && end.renotify && !end.silent, 'sw: הסוף מחליף אותה — עם צליל');
  const evil = await push({ t: 'x', b: 'y', k: 'watch', j: J(1), u: 'https://evil.example/#live=' + J(1), at: 300, p: 0.9 });
  ok(evil.data.url === './', 'sw: קישור שאינו מרכז הניהול — לא נפתח');
  let shownN = shown.length;
  L.notificationclose(ev({ notification: { title: 'a', body: 'b', tag: 'watch-' + J(1), data: { k: 'watch', at: Date.now() } } })); await wp;
  ok(shown.length === shownN + 1, 'sw: התראת המעקב נשארת לאורך כל העבודה (נסגרה — חוזרת)');

  /* ---- השרתון: החיבורים (מקור) ---- */
  const api = read('ibkr-proxy/api/studio.js');
  ok(/op === 'adminLive'[\s\S]{0,400}if \(!isAdmin\(user\)\) return res\.status\(403\)/.test(api) && /op === 'adminAct'[\s\S]{0,400}if \(!isAdmin\(user\)\) return res\.status\(403\)/.test(api)
    && /op === 'adminUserSet'[\s\S]{0,200}if \(!isAdmin\(user\)\) return res\.status\(403\)/.test(api) && /op === 'adminWait'[\s\S]{0,200}if \(!isAdmin\(user\)\) return res\.status\(403\)/.test(api),
    'השרתון: כל פעולות הניטור — מנהל בלבד');
  ok(/error: 'others_busy'/.test(api) && /isAdmin\(user\) && body\.ow !== true && job\.kind === 'tr'/.test(api), 'השרתון: המנהל מתחיל תרגום בזמן שמשתמש אחר עובד — קודם שואלים');
  ok(/UM\.paused\(await readStats\(deps, u\)\)\) return \{ error: 'user_paused' \}/.test(api) && /sysBlock\(deps, \{ kind: 'tr', spec \}, now, false, isAdmin\(user\), uid\)/.test(api), 'השרתון: משתמש מושהה — בלי עבודות חדשות');
  ok(!/jobCap\([^\n]*USER_MONTH\(\)/.test(api) && (api.match(/userMonth\(st/g) || []).length >= 5 && /return \{ month: S\.monthUsed\(st\.mu, now\), cap: userMonth\(st\)/.test(api), 'השרתון: התקרה החודשית — האישית של המשתמש בכל מקום שבודק אותה');
  ok(/return n \+ await watchPush\(deps, job, x, now\)/.test(api) && /await watchEnd\(deps, Object\.assign\(\{ id \}, job, up\), kind === 'done', now\)/.test(api), 'השרתון: התראה למנהל בכל עדכון בווילון ובסוף');
  ok(/await seenUser\(deps, user, now\)/.test(api) && /if \(u === uid\) return res\.status\(400\)/.test(api), 'השרתון: השם נרשם בכל כניסה (פעם ב־6 שעות); אי אפשר להשהות את עצמך');

  /* ---- הטלפון ---- */
  const adm = read('admin-app.js'), st = read('studio.js');
  ok(/\['act', \(\) => t\('admTabAct'\), '◷'\]/.test(adm) && ['now', 'live', 'act', 'people', 'user', 'use'].every((k) => adm.includes("page('" + k + "'")), 'מרכז הניהול: לשונית "פעילות" והמסכים');
  ok(/setInterval\(\(\) => \{ if \(booted && !document\.hidden && LIVE_PAGES\.includes\(cur\)\) needLive\(\); \}, 10000\)/.test(adm), 'עכשיו במערכת: כל 10 שנ׳ — רק כשהמסך גלוי ובמסכים החיים');
  ok(/busyGuard\(\(\) => askConfirm\(fmt\(t\('admGoldQ'\)/.test(adm) && /api\('start', \{ job: j\.id, ow: true \}\)/.test(adm), 'ריצת בדיקה: קודם שומר "עבודה של אחר"');
  ok(/j\.error === 'others_busy'/.test(st) && /net\.api\('adminWait', \{ on: true \}\)/.test(st) && /case 'user_paused'/.test(st), 'Studio: "להתחיל בכל זאת / לחכות", והודעה למשתמש מושהה');

  /* ---- שימוש ומשאבים, תקרה גבוהה והתראת סכום (29/10/2026, סבב 2) ---- */
  const tj = (o) => Object.assign({ kind: 'tr', state: 'done', uid: B, spec: { eng: 'api', dur: 600 } }, o);
  ok(UM.typeOf(tj({ spec: { ka: 1 } })) === 'ka' && UM.typeOf(tj({ spec: { src: 'subs' } })) === 'sub' && UM.typeOf(tj({ spec: { ph: 1 } })) === 'ph'
    && UM.typeOf(tj({ spec: { src: 'url' } })) === 'url' && UM.typeOf(tj({})) === 'vid' && UM.typeOf({ kind: 'rr' }) === 'rr' && UM.typeOf({ kind: 'zz' }) === 'oth',
    'שימוש: סוג העבודה — סרטון, קישור, קובץ כתוביות, קריוקי, בטלפון, הפקה מחדש; סוג חדש = "אחר"');
  ok(UM.engOf(tj({})) === 'api' && UM.engOf(tj({ spec: { eng: 'api', ry: 1 } })) === 'ry' && UM.engOf(tj({ spec: { eng: 'api', cp: 1 } })) === 'cp' && UM.engOf(tj({ spec: {} })) === 'rt', 'שימוש: המנוע');
  const H = 3600e3;
  const uj = [
    tj({ id: J(31), created: now - 5 * H, claimed: now - 5 * H + 30e3, ended: now - 4 * H, use: use(1.5, 1000), sid: 's1' }),
    tj({ id: J(32), created: now - 4.5 * H, claimed: now - 4.5 * H + 60e3, ended: now - 3.5 * H, use: use(0.5, 1000), sid: 's1', spec: { eng: 'api', ka: 1, dur: 200 } }),
    tj({ id: J(33), created: now - 2 * 86400e3, state: 'failed', err: 'api_rate', use: use(0.2, 10) }),
    tj({ id: J(34), created: now - 10 * 86400e3, use: use(9, 10), spec: { eng: 'api', ry: 1, dur: 60 } }),
    { id: J(35), kind: 'ping', created: now - H },
    tj({ id: J(36), created: now - 40 * 86400e3, use: use(5, 10) }),
    tj({ id: J(37), created: now - 600e3, claimed: now - 500e3, state: 'running', use: use(0.1, 10) }),
  ];
  const ug = UM.usage(uj, [{ id: B, mu: { m: '2026-10', usd: 20 } }, { id: C, mu: { m: '2026-09', usd: 99 } }], now, { max: 400 });
  ok(ug.n === 5 && ug.ok === 3 && ug.f === 1 && ug.live === 1 && ug.usd === 2.3 && ug.types[0].k === 'vid' && ug.types.find((x) => x.k === 'ka').n === 1,
    'שימוש: 30 יום בלבד, בלי ping; עלות = רק המפתח של המערכת (המנוי של המשתמש = 0)');
  ok(ug.days.length === 30 && ug.days[29].n === 3 && ug.hours.reduce((a, b) => a + b, 0) === 5 && ug.eng.api === 4 && ug.eng.ry === 1, 'שימוש: לפי יום (היום אחרון), לפי שעה, לפי מנוע');
  ok(ug.peak.c === 2 && ug.wait.n === 3 && ug.wait.max === 100 && ug.run.p50 === 60 && ug.srv[0].s === 's1' && ug.srv[0].n === 2, 'שימוש: שיא במקביל, המתנה בתור, זמן ריצה, שרתים');
  ok(ug.errs[0].e === 'api_rate' && ug.mo.usd === 20 && ug.mo.dim === 31 && ug.mo.proj > 20 && ug.wk.cur.n === 4, 'שימוש: כשלים, החודש (רק החודש הנוכחי) ותחזית, השבוע');
  const big = UM.usage(Array.from({ length: 12 }, (_, i) => tj({ id: J(50 + i), created: now - H * (i + 1), claimed: now - H * (i + 1) + 1200e3, state: i < 4 ? 'failed' : 'done' })), [], now, { max: 12 });
  ok(['wait', 'fail', 'cut'].every((k) => big.rec.some((r) => r.k === k)) && UM.usage([], [], now, {}).rec.length === 0, 'שימוש: המלצות — המתנה ארוכה, כשלים, רשימה חלקית; ריק = "מספיק"');
  ok(UM.CAP_DEF === 10000 && /const USER_MONTH = \(\) => \{ const c = Number\(cfgC\.v && cfgC\.v\.ucap\);[^\n]*: UM\.CAP_DEF; \};/.test(api) && !/STUDIO_API_USER_MONTH_USD\) \|\| 30/.test(api),
    'תקרה: ברירת המחדל גבוהה ($10,000) — "שלא יוגבלו פתאום"; המנהל קובע ב־sysCfg.ucap');
  ok((api.match(/await capWarm\(deps, now\);/g) || []).length >= 4 && /if \(body\.def !== undefined\)[\s\S]{0,300}patchDoc\(deps, 'sysCfg', 'main', \{ ucap: c/.test(api), 'תקרה: ההגדרה נטענת לפני כל חישוב, ונשמרת מהמסך');
  ok(UM.spendStep({}, 9, now) === null && UM.spendStep({}, 27, now).s === 25 && UM.spendStep({ msx: '2026-10:25' }, 40, now) === null
    && UM.spendStep({ msx: '2026-10:25' }, 120, now).v === '2026-10:100' && UM.spendStep({ msx: '2026-09:100' }, 12, now).s === 10, 'התראת סכום: פעם אחת לכל סף בחודש, מתאפסת בחודש חדש');
  const sm = W.message('spend', '', 'he', { nm: 'רון', usd: 52.1, s: 50, cap: 10000 }, now);
  ok(sm && /\$50 החודש/.test(sm.t) && /#people$/.test(sm.u) && /#use$/.test(W.message('daily', '', 'he', { u: 1, n: 1, usd: 1, mo: 5 }, now).u)
    && /החודש \$5\.00/.test(W.message('daily', '', 'he', { u: 1, n: 1, usd: 1, mo: 5 }, now).b), 'התראת סכום וסיכום יומי עם סכום החודש — נפתחים במסכים הנכונים');
  ok(/if \(sp\) await notify\(deps, adm, 'spend'/.test(api) && /\|spend\)\$\//.test(read('sw.js')) && /people\|use\|act\|ov/.test(read('sw.js')), 'התראת סכום: נשלחת ומוצגת');
  // מרכז הניהול: כל מסך — שם אחד (מסך כפול דורס את הקודם בשקט), וכל מפתח מחרוזת — פעם אחת בכל שפה
  const pk = [...adm.matchAll(/^page\('([a-zA-Z]+)'/gm)].map((m) => m[1]);
  ok(pk.length > 20 && new Set(pk).size === pk.length, 'מרכז הניהול: אין שני מסכים באותו שם');
  const app = read('app.js'), kc = {};
  for (const m of app.matchAll(/\b(adm[A-Za-z0-9]+): "/g)) kc[m[1]] = (kc[m[1]] || 0) + 1;
  ok(Object.values(kc).every((c) => c <= 2), 'מרכז הניהול: אין מפתח מחרוזת כפול (הכפול האחרון דורס)');
  ok(/page\('use', \{ tab: 'act', parent: 'act'/.test(adm) && /go\('use'\)/.test(adm) && /function defDlg\(\)/.test(adm), 'מרכז הניהול: מסך שימוש ומשאבים, ותקרת ברירת המחדל');

  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
