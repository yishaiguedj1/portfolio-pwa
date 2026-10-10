// מ1 (10/10/2026): הנגן של הסטודיו — כתוביות מעל המקור, מפת אזהרות בפס, ±10, מהירות; הסרטון מ־Drive דרך ה־Service Worker
// (./studio-media/<id>, האסימון מהדף ולא בכתובת); קבצי העזר (cues/vtt/ass/en) עולים עם התוצרים.
// הרצה: node tests/studio-play.test.js
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const P = await import(path.join(root, 'studioplay.js'));
  const N = await import(path.join(root, 'studionet.js'));

  /* ---------- 1. הכתוביות ---------- */
  const raw = [
    { id: 1, start: 1, end: 3, lines: ['שלום לכולם'], en: 'Hello everyone', spk: 'S1' },
    { id: 2, start: 3.2, end: 3.6, lines: ['קצר'] },                                        // קצרה מדי
    { id: 3, start: 4, end: 5, lines: ['זו כתובית ארוכה מאוד שנאמרת מהר מדי לקריאה נוחה'] },   // מהירה + ארוכה
    { id: 4, start: 6, end: 9, lines: ['this is not translated at all'] },                   // אנגלית
    { id: 5, start: 10, end: 13, lines: ['א', 'ב', 'ג'] },                                    // שלוש שורות
    { start: 'x', end: 2, lines: ['פגומה'] }, { start: 5, end: 4, lines: ['הפוכה'] }, { start: 1, end: 2, lines: [] },
  ];
  const cues = P.normCues(raw);
  ok(cues.length === 5 && cues[0].en === 'Hello everyone' && cues[0].spk === 'S1', 'normCues: cues.final.json של vt; פגומות / הפוכות / ריקות — בחוץ');
  ok(P.normCues(N.parseSrt('1\n00:00:01,000 --> 00:00:02,500\nשורה\nשנייה\n')).map((c) => c.lines.length).join() === '1', 'normCues: גם SRT מפוענח (עבודות ישנות בלי cues)');
  const iss = P.issuesList(cues);
  const kinds = (i) => (iss.find((x) => x.i === i) || { k: [] }).k.join();
  ok(kinds(1) === '' && kinds(2) === 'dur' && kinds(3) === 'cps,len' && kinds(4) === 'en' && kinds(5) === 'lines', 'cueIssues: קצב, אורך שורה, שורות, משך, אנגלית');
  // אותם כללים כמו quality() בעובד — לכל סוג, אותו מספר כתוביות שנכשלות (כשיש python3)
  const srt = cues.map((c, i) => {
    const t = (s) => { const ms = Math.round(s * 1000); return '00:00:' + String(Math.floor(ms / 1000)).padStart(2, '0') + ',' + String(ms % 1000).padStart(3, '0'); };
    return (i + 1) + '\n' + t(c.s) + ' --> ' + t(c.e) + '\n' + c.lines.join('\n');
  }).join('\n\n') + '\n';
  const tmp = path.join(require('os').tmpdir(), 'snb-play-' + process.pid + '.srt');
  fs.writeFileSync(tmp, srt);
  const py = spawnSync('python3', ['-c', 'import sys,json; sys.path.insert(0, sys.argv[1]); import job; q = job.quality(sys.argv[2]); print(json.dumps({m["k"]: m["b"] for m in q["m"]}))',
    path.join(root, 'translator'), tmp], { encoding: 'utf8' });
  fs.unlinkSync(tmp);
  if (py.status === 0) {
    const b = JSON.parse(py.stdout.trim().split('\n').pop());
    ok(P.ISSUE_KINDS.every((k) => b[k] === iss.filter((x) => x.k.includes(k)).length), 'מפת האזהרות = מדד האיכות של העובד (אותן כתוביות נכשלות בכל כלל)');
  }
  const src = read('studioplay.js'), job = read('translator/job.py');
  ok(/Q_CPS, Q_LEN, Q_LINES, Q_MIN_DUR, Q_PASS = 17, 42, 2, 0\.83, 70/.test(job) && /export const Q_CPS = 17, Q_LEN = 42, Q_LINES = 2, Q_MIN_DUR = 0\.83;/.test(src), 'הספים זהים לעובד');

  /* ---------- 2. הזמן ---------- */
  ok(P.cueAt(cues, 2) === 0 && P.cueAt(cues, 3) === -1 && P.cueAt(cues, 3.3) === 1 && P.cueAt(cues, 12.9) === 4 && P.cueAt(cues, 99) === -1 && P.cueAt([], 1) === -1, 'cueAt: חיפוש בינארי, [התחלה, סוף)');
  const hb = P.heatBins([{ t: 0 }, { t: 1 }, { t: 59 }], 60, 60);
  ok(hb.length === 60 && hb[0] === 1 && hb[1] === 1 && hb[59] === 1 && hb[30] === 0 && P.heatBins([], 0, 10).every((x) => x === 0), 'heatBins: מפת האזהרות בפס');
  ok(P.fmtT(65) === '1:05' && P.fmtT(3725) === '1:02:05' && P.fmtT(-3) === '0:00', 'fmtT');
  ok(P.nextCc('he', true) === 'en' && P.nextCc('he', false) === 'off' && P.nextCc('en', true) === 'off' && P.nextCc('off', true) === 'he', 'כתוביות: עברית → שפת המקור → כבויות');
  ok(P.SPEEDS.map(P.nextSpeed).join() === '1.25,1.5,2,0.5,0.75,1', 'מהירות במעגל');

  /* ---------- 3. הסרטון מ־Drive דרך ה־Service Worker ---------- */
  const msgs = [];
  let listener = null;
  const net = N.createNet({ sw: { controller: {}, addEventListener: (t, f) => { listener = f; } },
    fetch: async (u) => { if (/oauth|token/.test(u)) return { ok: true, json: async () => ({ ok: true, token: 'TOK', exp: Date.now() + 3600e3 }) }; return { ok: true, json: async () => ({ ok: true, token: 'TOK', exp: Date.now() + 3600e3 }) }; } });
  ok(net.mediaUrl('abcdefghij12') === N.MEDIA_PATH + 'abcdefghij12' && net.mediaUrl('../etc') === '' && typeof listener === 'function', 'mediaUrl: רק מזהה תקין; מאזין לבקשת אסימון מה־SW');
  const port = { postMessage: (m) => msgs.push(m) };
  listener({ data: { snbMedia: 'zzzzzzzzzzzz' }, ports: [port] });
  ok(msgs.length === 1 && msgs[0].t === '', 'קובץ שהדף לא ביקש — בלי אסימון');
  ok(N.createNet({ sw: null }).mediaUrl('abcdefghij12') === '', 'בלי Service Worker שולט — בלי כתובת (הנגן נופל ל־Drive)');
  const sw = read('sw.js');
  if (/MEDIA_RE/.test(sw)) {
    ok(/const MEDIA_RE = \/\\\/studio-media\\\/\(\[A-Za-z0-9_-\]\{10,200\}\)\$\//.test(sw) && N.MEDIA_PATH === './studio-media/', 'sw.js: אותו נתיב כמו בדף');
    ok(/mm = url\.origin === self\.location\.origin && MEDIA_RE\.exec/.test(sw) && /Range: 'bytes=' \+ r\[0\]/.test(sw) && /Authorization: 'Bearer '/.test(sw) && !/access_token/.test(sw), 'sw.js: רק מאותו מקור, Range מועבר, האסימון בכותרת ולא בכתובת');
    ok(/const STUDIO_SHELL = \[[^\]]*'\.\/studioplay\.js'/.test(sw), 'sw.js: studioplay.js בקבצי הסטודיו (אופליין)');
    ok(/status === 401 \|\| res\.status === 403\) && i === 0\) \{ mediaTok\.delete\(id\); continue; \}/.test(sw) && !/cache\.put\([^)]*studio-media/.test(sw), 'sw.js: אסימון שפג — פעם אחת חדש; בלי מטמון לסרטונים');
  }
  ok(/media-src 'self' blob:/.test(read('index.html')), 'CSP: media-src (הנגן והתצוגה המקדימה של העורך)');

  /* ---------- 4. קבצי העזר ---------- */
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const st = await import(path.join(root, 'studio.js'));
  ok(JSON.stringify(st.OUT_ALL) === JSON.stringify(S.OUT_KINDS) && S.OUT_MAX === 10, 'סוגי התוצרים זהים בטלפון ובשרתון');
  ok(/AUX_FILES = \(\s*\n\s*\('cues', 'cues\.final\.json'/.test(job) && /for k, fname, suffix, mime in AUX_FILES:/.test(job) && /קובץ עזר; התוצרים העיקריים כבר עלו/.test(job), 'העובד מעלה את קבצי העזר (תקלה בהם לא מפילה את העבודה)');
  const sj = read('studio.js');
  ok(/canPlay\(rec\)\) p\.append\(btn\('st-btn wide', T\('studioPlWatch'\)/.test(sj) && /x === 'play' \? \['job', y\]/.test(sj), 'דף העבודה: "צפייה" → דף הנגן (חזור → העבודה)');
  ok(/if \(ui\.view === 'play'\) playClose\(\)/.test(sj) && /if \(ui\.view === 'play'\) return 'play\|'/.test(sj), 'הנגן נעצר ביציאה, ולא נבנה מחדש בכל עדכון');
  ok(!/innerHTML/.test(src), 'הנגן בלי innerHTML (טקסט הכתוביות — רק textContent)');

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
