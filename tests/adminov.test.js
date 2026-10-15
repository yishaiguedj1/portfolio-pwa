/* 15/10/2026: מרכז הניהול — lib/adminov.js (הסקירה, "מחכה לך", "מה רץ איפה") */
'use strict';
const A = require('../ibkr-proxy/lib/adminov');
let n = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL - ' + m); process.exit(1); } n++; console.log('ok - ' + m); };
const now = Date.parse('2026-10-15T08:00:00Z'), H = 3600000;
ok(A.swBuild("const CACHE_NAME = 'portfolio-pwa-v427';") === 427 && A.swBuild('x') === 0, 'swBuild — מספר הבנייה מ־sw.js');
const quiet = A.overview({ now, prodBuild: 427, stagBuild: 427, servers: [{ name: 'snb-2', seen: now - 30e3, online: true }], backup: { okAt: now - 5 * H }, sites: { sd: '' }, gh: { waiting: [], prs: [], tag: 'v2.8.0' } });
ok(quiet.sum.urgent === 0 && quiet.items.length === 0, 'הכל שקט — אין פריטים');
ok(quiet.run.find((x) => x.k === 'prod').v.tag === 'v2.8.0' && quiet.run.every((x) => x.ok), 'מה רץ איפה — הכל תקין');
const busy = A.overview({ now, prodBuild: 424, stagBuild: 428, servers: [{ name: 'snb-2', seen: now - 2 * H, online: false }],
  backup: { okAt: now - 3 * 24 * H }, sites: { sd: 'api' }, gh: { waiting: [{ id: 9, at: now - H }], prs: [{ n: 140, t: 'x', dep: 0 }, { n: 97, dep: 1 }, { n: 96, dep: 1 }] } });
const ks = busy.items.map((x) => x.k);
ok(ks[0] === 'deploy_wait' && ks.includes('site_down') && ks.includes('srv_off') && ks.includes('bk_stale'), 'דחוף: פריסה, כתובת שנפלה, שרת שנעלם, גיבוי ישן');
ok(ks.includes('pr_open') && busy.items.find((x) => x.k === 'pr_dep').v.n === 2, 'PR של הסשנים לחוד, Dependabot בשורה אחת');
ok(!ks.includes('release_due'), 'פריסה מחכה — בלי "כדאי לשחרר" כפול');
ok(busy.items.every((x, i, a) => !i || a[i - 1].sev <= x.sev), 'ממוין לפי דחיפות');
const late = A.overview({ now: Date.parse('2027-01-05T00:00:00Z'), backup: { okAt: Date.parse('2027-01-04T20:00:00Z') }, gh: null });
ok(late.items.some((x) => x.k === 'date_ant_key' && x.v.left === 11), 'תאריך מתקרב — מפתח Anthropic פג בעוד 11 ימים');
ok(A.overview({ now, gh: null }).items.some((x) => x.k === 'bk_none'), 'בלי גיבוי בכלל — דחוף');
ok(quiet.dates.length === A.DATES.length && quiet.dates.every((x, i, a) => !i || a[i - 1].left <= x.left), 'כל התאריכים, מהקרוב לרחוק (למסך המכסות)');
// AI ועלויות
const dk = A.dayKeys(now, 14);
const days = {}; days[dk[13]] = { t: 1650, i: 85, u_a: 3, u_b: 1 }; days[dk[12]] = { t: 300 }; days[dk[5]] = { t: 200 };
const av = A.aiView({ now, days, lim: { total: 2000, user: 150, anon: 40, ins: 100 }, month: { usd: 40, users: 3, cap: 30, top: 25 }, fns: { n: 12, max: 12 } });
ok(av.days.length === 14 && av.today.t === 1650 && av.today.u === 2 && av.pct === 82.5, 'AI: היום — קריאות, קוראים (מספר בלבד), אחוז מהתקרה');
ok(av.wk.t === 1950 && av.wk.p === 200 && av.peak === 1650, 'AI: השבוע מול הקודם, השיא');
ok(av.warn.map((w) => w.k).join() === 'ai_day,ai_ins,st_cap,fn_full', 'AI: אזהרות — תקרה יומית, ניתוחים, תקציב חודשי, פונקציות מלאות');
ok(A.aiView({ now, days: {}, month: null }).warn.length === 0 && A.aiView({ now }).month === null, 'AI: בלי נתונים — בלי אזהרות ובלי מספרים מומצאים');
ok(!JSON.stringify(av).includes('u_a'), 'AI: מזהי הקוראים לא יוצאים');
// סשנים ומשימות
const md = ['# x', '## ⏰ עם תאריך או דחוף', '- [ ] **14/11/2026** — עדכון `BRK_13F` (תיק הדמו).', '- [x] **גמור**', '', '## סטודיו (הערה)',
  '- [ ] **5א — מרכז הניהול** (`admin`). ‹בעבודה: session_01Wfj8Ek (מאגר הלמידה) · 15/10›', '- [ ] בלי הדגשה: [קישור](http://x) ועוד'].join('\n');
const tp = A.tasksParse(md, Date.parse('2026-11-10T00:00:00Z'));
ok(tp.items.length === 3 && tp.secs.map((x) => x.s).join('|') === 'עם תאריך או דחוף|סטודיו', 'משימות: רק פתוחות, לפי מקטע (בלי אימוג׳י ובלי סוגריים)');
ok(tp.items[0].t === 'עדכון BRK_13F' && tp.items[0].left === 4, 'משימות: תאריך בלבד בהדגשה — הכותרת מהמשך השורה, וכמה ימים נשארו');
ok(tp.items[1].w && tp.items[1].w.by === 'session_01Wfj8Ek' && tp.items[1].w.n === 'מאגר הלמידה' && tp.items[1].w.d === '15/10' && tp.items[1].t === '5א — מרכז הניהול', 'משימות: בעבודה — הסשן, השם והתאריך');
ok(tp.items[2].t === 'בלי הדגשה: קישור ועוד' && tp.items.every((x) => !/[*`[\]]/.test(x.t)), 'משימות: בלי Markdown בפלט');
// האפליקציות
const cat = { at: now - H, cfg: { source: 'r2' }, hist: [{ at: now - H }, { at: now - 9 * 24 * H }], books: [
  { id: 'a', st: 'pub', files: [{ fmt: 'epub', size: 2 * 1048576 }], cover: { md5: 'x' } }, { id: 'b', st: 'pub', files: [{ fmt: 'azw3', size: 1048576 }] },
  { id: 'c', st: 'draft' }, { id: 'd', st: 'hide' }, { id: 'e', st: 'pub', del: now }] };
const ap = A.appsView({ now, counts: { users: 7, ibkr: 2, lib: null, studio: 3, sess: -1 }, cat, readers: 4 });
const cs = ap.academy.cat;
ok(cs.n === 4 && cs.pub === 2 && cs.draft === 1 && cs.hide === 1 && cs.del === 1 && cs.noCover === 1 && cs.mb === 3 && cs.ch7 === 1 && cs.fm.epub === 1, 'אפליקציות: הקטלוג — מצבים, בלי כריכה, נפח, שינויים בשבוע');
ok(ap.invest.users === 7 && ap.invest.ibkr === 2 && ap.academy.backup === null && ap.shared.sess === null && ap.academy.readers === 4, 'אפליקציות: ספירות — לא נמדד = null (לא אפס)');
ok(A.appsView({ now }).academy.cat === null, 'אפליקציות: בלי קטלוג — null');
// בדיקות בטלפון
const md2 = ['## בדיקות בטלפון שעוד לא אושרו', '- [ ] עותק לוואטסאפ', '- [ ] STL', '- [ ] Academy:', '  - הוספה של כמה ספרים', '  - חיפוש בבן־יהודה', '## סטודיו', '- [ ] משהו אחר'].join('\n');
const tk2 = A.tasksParse(md2, now);
ok(tk2.items.every((x) => /^[0-9a-f]{12}$/.test(x.id)) && tk2.items[0].id === A.tasksParse(md2, now + 1e9).items[0].id, 'בדיקות: מזהה יציב לכל משימה');
const cv = A.checksView(tk2, { [tk2.items[1].id]: { st: 'ok', at: 1 }, [tk2.items[0].id]: { st: 'no', n: 'לא נפתח', at: 2 } });
ok(cv.open.length === 2 && cv.open[0].t === 'עותק לוואטסאפ' && cv.open[0].st === 'no' && cv.open[0].n === 'לא נפתח' && cv.done.length === 1, 'בדיקות: רק המקטע של הבדיקות; "עובד" יורד, "לא עובד" נשאר עם ההערה');
ok(tk2.items[2].t === 'Academy: הוספה של כמה ספרים · חיפוש בבן־יהודה', 'משימות: תתי־סעיפים אחרי נקודתיים נכנסים לכותרת');
ok(A.noteClean('a <b>`x`\n') === 'a b x' && A.noteClean('x'.repeat(400)).length === 300, 'בדיקות: הערה נקייה (בלי תגיות, עד 300)');
// בדיקת מוכנות
const good = { now, cache: { invest: 'no-cache', academy: 'no-cache', studio: 'no-cache' }, builds: { invest: 427, academy: 427, studio: 427 },
  sess: { last: [['t', 'who:ok', 'invest']] }, links: 3, api: { main: true, fb: true }, sec: '2027-10-14T00:00:00Z' };
const rg = A.readyView(good);
ok(rg.pass === rg.n - (rg.checks.find((x) => x.k === 'dates').ok ? 0 : 1) && rg.checks.find((x) => x.k === 'cache').ok, 'מוכנות: הכל תקין');
const rb = A.readyView(Object.assign({}, good, { cache: { invest: 'max-age=14400', academy: 'no-cache', studio: null }, builds: { invest: 427, academy: 426, studio: 427 }, sess: { last: [['t', 'mint:sign_http_404', 'studio']] }, links: 2, api: { main: false, fb: true } }));
const kb = rb.checks.filter((x) => !x.ok).map((x) => x.k);
ok(['cache', 'live', 'api', 'sess', 'links'].every((k) => kb.includes(k)) && rb.checks[0].sev === 1, 'מוכנות: כל כשל נתפס, הדחופים קודם');
ok(rb.checks.find((x) => x.k === 'cache').v.bad.join() === 'invest' && rb.checks.find((x) => x.k === 'cache').v.miss.join() === 'studio', 'מוכנות: איזו כתובת דורסת את המטמון ואיזו לא ענתה');
ok(!A.readyView({ now }).checks.find((x) => x.k === 'sess').ok, 'מוכנות: מה שלא נקרא — לא "עבר"');
// התראה לטלפון (בדיקה מתוזמנת)
const bad1 = A.readyView(Object.assign({}, good, { cache: { invest: 'max-age=14400', academy: 'no-cache', studio: 'no-cache' } }));
const okBk = { okAt: now - H };
let w1 = A.watchStep({}, bad1, okBk, now);
ok(!w1.send.length && w1.patch.pp === 'cache', 'התראה: כשל ראשון — עוד לא שולחים (אולי באמצע פריסה)');
let w2 = A.watchStep(w1.patch, bad1, okBk, now + H);
ok(w2.send.join() === 'ready_fail' && w2.patch.fp === 'cache', 'התראה: אותו כשל שעה אחר כך — שולחים');
const w3 = A.watchStep(Object.assign({}, w1.patch, w2.patch), bad1, okBk, now + 2 * H);
ok(!w3.send.length && !w3.patch, 'התראה: אותו כשל שוב — לא שולחים שוב');
ok(A.watchStep(Object.assign({}, w1.patch, w2.patch), rg, okBk, now + 3 * H).patch.fp === '', 'התראה: תוקן — נמחק מהרשימה');
const b1 = A.watchStep({}, rg, { okAt: now - 3 * 24 * H }, now);
ok(b1.send.includes('bk_fail') && !A.watchStep(b1.patch, rg, { okAt: now - 3 * 24 * H }, now + H).send.includes('bk_fail'), 'התראה: הגיבוי — פעם ביום');
const WP = require('../ibkr-proxy/lib/webpush.js');
ok(/admin\.html#ready$/.test(WP.message('ready_fail', '', 'he').u) && /#studio=/.test(WP.message('done', 'jabcdefghij0123456789', 'he').u), 'התראה: של המנהל נפתחת במרכז הניהול, של עבודה — בסטודיו');
ok(['bk_fail', 'ready_fail'].every((k) => WP.KINDS.includes(k) && WP.TEXT.he[k] && WP.TEXT.en[k]), 'התראה: הסוגים החדשים בשתי השפות');
// נתיב הפריסה
const lv = A.laneView([{ n: 140, t: 'ממתין לתור אחרי #139 — 2.9.0 (429): x', at: 3 }, { n: 139, t: '(428): מגדל המשתמשים', at: 1 }, { n: 97, t: 'bump', dep: 1 }, { n: 141, t: 'מסמכים', at: 2 }], []);
ok(lv.holder.n === 139 && lv.holder.b === 428 && lv.holder.t === 'מגדל המשתמשים' && lv.queue.map((x) => x.n).join() === '140' && lv.queue[0].b === 429 && lv.queue[0].t === 'x' && lv.queue[0].after === 139 && lv.other.map((x) => x.n).join() === '141' && !lv.free, 'נתיב: מי מחזיק, מי בתור, ומה בלי גרסה (בלי Dependabot)');
ok(A.laneView([], []).free && !A.laneView([], [{ id: 1 }]).free && A.laneView([], [{ id: 1 }]).deploy === 1, 'נתיב: פנוי רק כשאין PR עם גרסה ואין פריסה שמחכה');
ok(A.laneView([{ n: 5, t: '2.9.0 (429): שחרור' }], []).holder.rel === '2.9.0', 'נתיב: PR של שחרור — גרסת המערכת');
// משתמשים והרשאות (15/10/2026)
const uv = A.usersView({ admins: ['Boss@Example.com', 'bad'], acEnv: ['boss@example.com', '*', ' r@example.com ', ''], acApp: [{ email: 'old@example.com', at: 1 }, { email: 'New@Example.com', at: 9 }, { email: 'x' }],
  stEnv: ['s@example.com', 's@example.com'], am: ['m@example.com'], ibEnv: [], counts: { ibkr: 2, lib: null, studio: 3 } });
ok(uv.admins.join() === 'boss@example.com' && uv.ac.open && uv.ac.env.join() === 'boss@example.com,r@example.com', 'משתמשים: מנהלים, "*" = פתוח לכל מחובר (לא מייל), מיילים מנורמלים');
ok(uv.ac.app.map((x) => x.e).join() === 'new@example.com,old@example.com' && uv.ac.store === 'ok', 'משתמשים: קוראים מהאפליקציה — החדש ראשון, לא תקין נזרק');
ok(uv.st.env.length === 1 && uv.st.am.join() === 'm@example.com' && uv.st.conn === 3 && uv.ib.on === 2 && uv.ac.backup === null, 'משתמשים: Studio, IBKR והספירות (לא נמדד = null)');
ok(A.usersView({ acApp: [], acErr: 'fs_http_403' }).ac.store === 'no_access' && A.usersView({}).ac.store === 'none' && !A.usersView({}).ac.open, 'משתמשים: אין גישה לרשימה — לא "ריק"');
ok(!/uid/i.test(JSON.stringify(uv)), 'משתמשים: בלי uid');
// יומן פעולות (15/10/2026)
ok(A.logEntry('xx', 'a', 'b@example.com', now) === null && A.logEntry('fl_off', 'learn<b>', 'Boss@Example.com', now).d === 'learn b' && A.logEntry('ac_add', 'x', 'לא מייל', now).w === '', 'יומן: רק סוגים מהקטלוג, פרט מנוקה, מייל תקין בלבד');
ok(A.cfgLogKind({ mt: { on: true, msg: 'm' } }, { mtOn: 0 }, now)[0] === 'mt_on' && A.cfgLogKind({ mt: { on: true } }, { mtOn: 1, mtTil: 0 }, now)[0] === 'mt_upd' && A.cfgLogKind({ mt: { on: true } }, { mtOn: 1, mtTil: now - 1 }, now)[0] === 'mt_on', 'יומן: תחזוקה — הדלקה מול עדכון (תחזוקה שפגה = הדלקה חדשה)');
ok(A.cfgLogKind({ flag: 'push', on: false }, {}, now).join() === 'fl_off,push' && A.cfgLogKind({ am: 'a@example.com', on: true }, {}, now)[0] === 'am_add' && A.cfgLogKind({}, {}, now) === null, 'יומן: דגלים ומודלים');
const lg = [{ id: 'a', k: 'fl_on', d: 'x', w: 'boss@example.com', at: now - H }, { id: 'b', k: 'ac_add', d: 'r@example.com', w: 'other@example.com', at: now - 3 * H }, { id: 'c', k: 'mt_on', at: now - 100 * 24 * H }, { id: 'd', k: 'zz', at: now }];
const lv2 = A.logView(lg, now, 'Boss@example.com');
ok(lv2.items.map((x) => x.k).join() === 'fl_on,ac_add' && lv2.items[0].w === '' && lv2.items[1].w === 'other@example.com' && lv2.n7 === 2, 'יומן: החדש ראשון, "אני" בלי מייל, ישן וסוג לא מוכר לא מוצגים');
ok(A.logOld(lg, now).join() === 'c', 'יומן: מה שישן מ־90 יום נמחק');
// סודות ותאריכים (15/10/2026)
const SV = A.secretsView({ now, host: 'vercel', has: (n) => ['GDRIVE_SA_KEY', 'R2_ACCESS_KEY_ID', 'SNB_SESSION_KEY'].includes(n), vaults: { ibkr: 2, routine: null } });
const sk = (k) => SV.items.find((x) => x.k === k);
ok(sk('sa').set === true && sk('gd_lib').set === false && sk('gd_lib').sev === 1 && sk('vault').sev === 2 && sk('cron').sev === 4, 'סודות: חובה חסר = אדום, מומלץ = כתום, רשות = שקט');
ok(sk('r2').part === '1/2' && sk('sess').set === null && A.secretsView({ now, host: 'srv', has: (n) => n === 'SNB_SESSION_KEY' }).items.find((x) => x.k === 'sess').set === true, 'סודות: חלקי = "1/2"; סוד של השרת נבדק רק כשהבקשה רצה בשרת');
ok(sk('ant').set === null && sk('ant').date.d === '2027-01-16' && sk('ibkr').n === 2 && sk('routine').n === null, 'סודות: מה שלא נקרא מכאן = לא ידוע, עם התאריך; כספות — מספר בלבד');
ok(!/"(GDRIVE|R2_|SNB_)/.test(JSON.stringify(SV)) && SV.bad === SV.items.filter((x) => x.sev <= 2).length && SV.dates.every((x, i, a) => !i || a[i - 1].left <= x.left), 'סודות: בלי שמות משתנים וערכים בתשובה; תאריכים מהקרוב');
// סוכנים ומודלים, שרתים ומשאבים (15/10/2026)
const D30 = 30 * 24 * H;
const mv = A.modesView({ now, modes: ['haiku-high', 'opus-medium', 'sonnet-low'], pub: ['haiku-high'], dflt: 'haiku-high', def: { 'haiku-high': 0.8 }, defApi: { 'haiku-high': 0.55 },
  jobs: [{ kind: 'tr', created: now - H, state: 'done', spec: { mode: 'haiku-high', eng: 'api' }, use: [{ usd: 0.1 }], use0: [{ usd: 0.05 }] },
    { kind: 'tr', created: now - 2 * H, state: 'failed', spec: { mode: 'haiku-high' }, use: [{ usd: 0.2 }] },
    { kind: 'tr', created: now - D30 - H, state: 'done', spec: { mode: 'opus-medium' } }, { kind: 'rr', created: now, spec: { mode: 'opus-medium' } }] });
const mh = mv.modes[0];
ok(mv.jobs === 2 && mh.pub && mh.def && mh.n === 2 && mh.ok === 0.5 && Math.abs(mh.usd - 0.35) < 1e-9 && mh.api === 1 && mh.ph === 0.8 && mh.pha === 0.55, 'מצבים: פתוח לכולם, ברירת המחדל, עבודות, הצלחה, עלות כולל "המשך", מנוע');
ok(mv.modes[1].n === 0 && mv.modes[1].ok === null && mv.modes[2].ph === null && !mv.modes[1].pub, 'מצבים: ישן מ־30 יום והפקה מחדש לא נספרים; בלי נתון = null');
const sa = A.serversAdmin([{ id: 's1', name: 'snb-2', online: true, paused: false, seen: now, hb: { disk: 90, mem: 40, iso: 'g', ev: [[1, 'up']] } },
  { id: 's2', name: 'old', online: false, paused: false, seen: now - 9 * H, ba: now, hb: null }], { s1: { st: 'al', p: 0.4 } }, now);
ok(sa.servers[0].n === 'snb-2' && sa.servers[0].job.st === 'al' && sa.servers[0].warn.join() === 'disk' && sa.servers[1].warn.join() === 'auth,down' && sa.online === 1 && sa.warn === 2, 'שרתים: מקוון ראשון, דיסק מלא, טוקן שנדחה, לא מדווח, השלב הנוכחי');
ok(!/"s1"|"s2"|"id"/.test(JSON.stringify(sa)), 'שרתים: בלי מזהי שרת ועבודה');
console.log(`\nכל ${n} הבדיקות עברו ✓`);
