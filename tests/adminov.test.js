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
console.log(`\nכל ${n} הבדיקות עברו ✓`);
