// סטודיו התרגום — מצב "API של המערכת" (שלב 3): השרת שלנו (Hetzner) מושך עבודות מהשרתון, בלי Routine ובלי פורט פתוח.
// כאן: הטלפון (בחירת המנוע, תקרה לעבודה, מסך השרת) והחיבור לשרתון ולעובד. הבדיקות המלאות של התור והטוקן:
// ibkr-proxy/tests/run.js ("מצב API"), translator/tests/test_agent.py, translator/tests/test_infra.py.
// הרצה: node tests/studio-api.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  /* ---------- 1. השרתון — טהור ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const t = S.newServerToken(S.newServerId());
  ok(/^[a-z0-9]{12}-[A-Za-z0-9_-]{43}$/.test(t) && S.parseServerToken(t).sid === t.slice(0, 12) && !S.parseServerToken(t + 'x') && !S.parseServerToken('../' + t),
    'טוקן שרת: מזהה + סוד; צורה אחרת נדחית');
  ok(S.serverMatches({ th: S.keyHash(t) }, t) && !S.serverMatches({ th: S.keyHash(t) }, t.slice(0, 13) + 'A'.repeat(43)) && !S.serverMatches({}, t),
    'טוקן שרת: נבדק מול ה־hash בלבד');
  const hb = S.normHb({ v: 'deadbeef1234567', disk: 120, mem: -3, load: 2.345, busy: 'evil', name: '<b>' });
  ok(hb.v === 'deadbeef1234' && hb.disk === 100 && hb.mem === 0 && hb.load === 2.3 && hb.busy === '' && !('name' in hb), 'דופק: רק מספרים בטווח וגרסה; כל השאר נזרק');
  ok(S.jobCap({ cap: 20 }, 25, 30) === 5 && S.jobCap({ cap: 20 }, 29.2, 30) === 0 && S.jobCap({ cap: 3 }, 0, 30) === 3, 'תקרת עבודה: המינימום בין הבחירה למה שנשאר החודש; פחות מדולר — לא מתחילים');
  ok(S.monthUsed({ m: S.monthKey(Date.UTC(2026, 9, 8)), usd: 4 }, Date.UTC(2026, 9, 20)) === 4 && S.monthUsed({ m: '2026-09', usd: 4 }, Date.UTC(2026, 9, 1)) === 0
    && S.addMonth({ m: '2026-09', usd: 9 }, 1.5, Date.UTC(2026, 9, 2)).usd === 1.5, 'תקציב חודשי: מתאפס בחודש חדש');
  const qj = { kind: 'tr', state: 'queued', eng: 'api', fired: 1000, spec: { eng: 'api' } };
  ok(S.effState(qj, 1000 + 3 * 3600e3).state === 'queued' && S.effState(qj, 1000 + S.API_QUEUE_WAIT + 1).err === 'no_server'
    && S.effState(Object.assign({}, qj, { pk: 2000 }), 2000 + 31 * 60e3).err === 'no_claim', 'תור: מחכה לשרת עד 6 שעות; שרת לקח ולא התחיל תוך 30 דק׳ — נכשלה');
  ok(S.workerJob({ id: 'j', kind: 'tr', eng: 'api', capc: 1250 }).cap === 12.5 && S.workerJob({ id: 'j', kind: 'tr', capc: 1250 }).cap === null, 'העובד מקבל תקרה רק במצב API (נשמרת בסנטים)');
  ok(S.publicJob({ id: 'j', kind: 'tr', state: 'new', spec: { eng: 'api' } }, 1).eng === 'api' && S.publicJob({ id: 'j', kind: 'tr', state: 'new', spec: {} }, 1).eng === 'sub', 'הטלפון יודע באיזה מנוע העבודה');
  const api = read('ibkr-proxy/api/studio.js');
  ok(/const SERVER_OPS = new Set\(\['poll', 'beat'\]\)/.test(api) && /S\.serverMatches\(srv, p\.tok\)/.test(api) && /patchIf\(deps, 'studioJobs', job\.id, \{ sid: p\.sid/.test(api),
    'השרתון: poll/beat רק עם טוקן שרת, ולקיחה בתנאי (שני שרתים לא לוקחים אותה עבודה)');
  ok(/if \(!isAdmin\(user\)\) return res\.status\(403\)\.json\(\{ ok: false, error: 'not_admin' \}\)/.test(api) && /th: S\.keyHash\(token\)/.test(api),
    'השרתון: רק המנהל מנהל שרתים; נשמר רק ה־hash של הטוקן');
  ok(/if \(apiJob\(job\)\) \{\s*const q = await queueApi/.test(api) && !/queueApi[\s\S]{0,600}fire\(deps/.test(api), 'השרתון: עבודת API נכנסת לתור — בלי הפעלת Routine');

  /* ---------- 2. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  ok(st.defaultSettings().cap === 10 && st.normSettings({ cap: 20 }).cap === 20 && st.normSettings({ cap: 999 }).cap === 10 && st.CAPS.join() === '5,10,20,50',
    'הגדרות: תקרה לעבודה — 5/10/20/50, ברירת מחדל 10');
  ok(st.normSettings({ conn: 'api' }).conn === 'api' && st.normSettings({ conn: 'evil' }).conn === 'sub', 'הגדרות: המנוע — המנוי או השרת של המערכת');
  const a = st.normApi({ month: 3.2, cap: 30, online: 1, servers: 2, admin: true, extra: 'x' });
  ok(a.month === 3.2 && a.online === 1 && a.admin === true && !('extra' in a) && st.normApi(null) === null && st.normApi({ month: -5 }).month === 0, 'מצב API מהשרתון — מנוקה');
  const sv = st.normServers([{ id: 'abc123def456', name: '<img src=x>', online: true, hb: { v: 'evil!', disk: 40 }, job: { id: 'jAbCdEfGhIjKlMnOpQrS-', name: 'a.mp4' } }, { id: 'bad' }]);
  ok(sv.length === 1 && sv[0].hb.v === '' && sv[0].hb.disk === 40 && sv[0].job.name === 'a.mp4' && st.srvState(sv[0]) === 'on' && st.srvState({ paused: true, online: true }) === 'paused',
    'מסך השרת: רשימה מנוקה; מושהה גובר על מחובר');
  ok(st.chainFor('server').map((x) => x.v).join() === 'home,settings,tower,server', 'מסך השרת: "חזור" — מגדל הפיקוח ← הגדרות ← בית');
  const src = read('studio.js');
  ok(/if \(apiMode\(\)\) Object\.assign\(spec, \{ eng: 'api', cap: store\.settings\.cap \}\)/.test(src), 'הטופס: במצב API העבודה נשלחת עם המנוע והתקרה');
  ok(/if \(ui\.view === 'server'\) ui\.newToken = ''/.test(src) && /copyBox\(ui\.newToken/.test(src), 'טוקן שרת חדש: מוצג פעם אחת ונמחק מהזיכרון ביציאה מהדף');
  ok(!/localStorage|save\(\)[^\n]*newToken|newToken[^\n]*save\(\)/.test(src.slice(src.indexOf('function addServer'), src.indexOf('function pageServer'))), 'טוקן שרת: לא נשמר בטלפון');
  ok(!/net\.api\('start'[^\n]*conn/.test(src) && /disabled: !ui\.api/.test(src), 'הגדרות: "השרת של המערכת" זמין רק כשהשרתון מחזיר מצב API');

  /* ---------- 3. העובד והשרת ---------- */
  const ag = read('translator/agent.py');
  ok(/def host_info\(/.test(ag) && /'op': op, 'v': 1, 'hb': host_info\(busy\)/.test(ag) && /poll\(server, tok, 'beat', _busy\)/.test(ag), 'הסוכן: דופק עם מצב השרת, וגם באמצע עבודה');
  ok(/rc = run_child\(\['auto'\], AUTO_TIMEOUT_S\)/.test(ag) && /finally:\s*\n\s*_busy = ''\s*\n\s*cleanup\(\)/.test(ag), 'הסוכן: run ואז auto, וניקוי תמיד בסוף');

  /* ---------- 4. מחרוזות ---------- */
  const app = read('app.js');
  for (const k of ['studioSrvT', 'studioSrvLede', 'studioApiCap', 'studioErrMonthCap', 'studioErrNoServer', 'studioSrvTokNote', 'studioSrvRemoveQ']) {
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
  }
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
