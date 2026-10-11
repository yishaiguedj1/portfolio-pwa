// 11/10/2026 (המשך): ניטור השרתים גם מהטלפון, שעת התקלה, והמאמץ במלאי הסוכנים.
// הבדיקות המלאות של השרתון: ibkr-proxy/tests/run.js (בלוק ת7).
// הרצה: node tests/studio-1011b.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/* ---------- 1. ניטור השרתים ---------- */
const api = read('ibkr-proxy/api/studio.js');
ok(/if \(\(op === 'status' \|\| op === 'jobs'\) && watchDue\(now\)\) await checkServers\(deps, now, uid\)/.test(api),
  'GitHub מדלג על ריצות מתוזמנות — גם פתיחת האפליקציה בודקת את השרתים (של מי ששואל)');
ok(/const WATCH_EVERY = 5 \* 60e3/.test(api), 'לכל היותר פעם ב־5 דק׳');
const vj = JSON.parse(read('ibkr-proxy/vercel.json'));
ok(vj.crons.length === 2 && vj.crons.some((c) => c.path === '/api/studio' && /^\d+ \d+ \* \* \*$/.test(c.schedule)), 'קרון יומי של Vercel כרשת ביטחון (Hobby — פעם ביום)');
ok(/process\.env\.CRON_SECRET && auth === 'Bearer ' \+ process\.env\.CRON_SECRET/.test(api), 'הקרון של Vercel עובר גם כשמוגדר STUDIO_WATCH_SECRET');

/* ---------- 2. שעת התקלה ---------- */
const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
const I = require(path.join(root, 'ibkr-proxy/lib/studioinc.js'));
const J = 'j' + 'Q'.repeat(20);
const t0 = 1_800_000_000_000, later = t0 + 5 * 3600e3;
const rj = { id: J, kind: 'tr', state: 'queued', fired: t0, updated: later - 1000 };   // updated זז (צפייה) — לא הכישלון
const e = S.effState(rj, later);
ok(e.state === 'failed' && e.at === t0 + 30 * 60e3, 'הופעלה ולא נלקחה — "נכשלה" ברגע שעבר זמן ההמתנה');
ok(I.jobFacts(rj, e, false).at === t0 + 30 * 60e3, 'התקלה מקבלת את שעת הכישלון, לא את updated (שעת הסנכרון)');
ok(S.publicJob(rj, later).ended === t0 + 30 * 60e3, 'גם הטלפון רואה מתי נכשלה');
const aj = { id: J, kind: 'tr', state: 'queued', eng: 'api', fired: t0, updated: later };
ok(S.effState(aj, t0 + 7 * 3600e3).at === t0 + 6 * 3600e3, 'מצב השרת: "אין שרת זמין" — שש שעות אחרי ההפעלה');
ok(I.jobFacts({ id: J, ended: 77, updated: 99 }, { state: 'failed', err: '', at: 55 }, false).at === 77, 'ended מהעובד גובר');

/* ---------- 3. המאמץ במלאי הסוכנים ---------- */
const A = require(path.join(root, 'ibkr-proxy/lib/studioagents.js'));
const mk = (eng) => ({ kind: 'tr', created: t0, state: 'done', eng, spec: { mode: 'sonnet-high', eng },
  use: [{ k: 'main', m: 'claude-sonnet-5-5', usd: 0.1 }, { k: 'jg', m: 'claude-haiku-5-5', usd: 0.01 }] });
const ag = (eng) => Object.fromEntries(A.agentsView([mk(eng)], t0 + 1000).agents.map((a) => [a.k, a]));
ok(ag('api').jg.ef === 'high' && ag(undefined).jg.ef === 'high', 'השופט — תמיד High (11/10)');
ok(ag('api').main.ef === 'high' && ag(undefined).main.ef === '', 'מנהל העבודה: במצב השרת = המאמץ של העבודה; ב־Routine — לא ידוע (לא ממציאים)');

console.log('\n' + n + ' passed');
