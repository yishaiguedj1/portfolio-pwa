// 4/11/2026 (המשתמש: "איך חצי מחיר עלה כמו רגיל?"): מה שולם בתור החיסכון לכל שלב, תיעוד היציאה מהתור (btNow),
// שחרור עבודה שהתור שלה אבד, ויעד התקציב בחצי מחיר. הרצה: node tests/studio-bt-audit.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const st = await import(path.join(root, 'studio.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const SLA = require(path.join(root, 'ibkr-proxy/lib/studiosla.js'));
  const M = 'claude-haiku-5-5';
  const row = (k, usd, x) => Object.assign({ k, m: M, n: 4, i: 100, o: 200, cr: 0, c5: 0, c1: 0, usd }, x || {});

  // 1. השרתון: bn/bu — רשות, נשמרים ומצטברים
  const u = S.normUsage([row('main', 0.0082, { n: 1, bn: 1, bu: 0.0082 }), row('tl', 0.0281)]);
  ok(u && u[0].bn === 1 && u[0].bu === 0.0082 && !('bn' in u[1]) && !('bu' in u[1]), 'normUsage: bn/bu נשמרים, ובלעדיהם — לא נוספים');
  ok(S.normUsage([row('tl', 0.01, { bn: -1 })]) === null && S.normUsage([row('tl', 0.01, { bu: 'x' })]) === null, 'normUsage: bn/bu לא תקינים — הכל נזרק');
  const mu = S.mergeUse([row('tl', 0.01, { bn: 2, bu: 0.01 })], [row('tl', 0.02), row('rv', 0.01, { bn: 1, bu: 0.01 })]);
  ok(mu.find((r) => r.k === 'tl').bn === 2 && mu.find((r) => r.k === 'tl').bu === 0.01 && mu.find((r) => r.k === 'rv').bu === 0.01, 'mergeUse: bn/bu עוברים בין הרצות (use0)');

  // 2. הטלפון: סימון לשורה ו"חסכת"
  const cv = st.costView([row('main', 0.0082, { n: 1, bn: 1, bu: 0.0082 }), row('tl', 0.02, { bn: 2, bu: 0.01 }), row('rv', 0.027)], 'haiku-medium');
  ok(cv.rows[0].bt && cv.rows[0].bt.b === 1 && cv.rows[0].bt.n === 1, 'costView: שלב ששולם כולו בתור');
  ok(cv.rows[1].bt && cv.rows[1].bt.b === 2 && cv.rows[1].bt.n === 4 && cv.rows[2].bt === null, 'costView: חלקי / בזמן אמת');
  ok(Math.abs(cv.saved - 0.0182) < 1e-9, 'costView: חסכת = מה ששולם בתור');
  ok(st.costView([row('tl', 0.02)], 'haiku-medium').saved === 0, 'costView: בלי תור — בלי חיסכון');
  const sj = read('studio.js');
  ok(/if \(cv\.saved >= 0\.005\)/.test(sj) && /T\('studioCostSaved'\)/.test(sj) && /T\('studioCostBtPart', r\.bt\)/.test(sj), 'המסך: שורת "חסכת" וסימון לשורה');

  // 3. תיעוד היציאה מהתור
  const api = read('ibkr-proxy/api/studio.js');
  ok(/const btx = \{ t: now, s: body\.src === 'job' \? 'job' : 'x' \}/.test(api) && /\{ spec, btx, updated: now \}/.test(api), 'btNow: נרשם מתי ומאיפה');
  ok(S.JSON_FIELDS.includes('btx'), 'btx נשמר כ־JSON');
  const v = S.publicJob({ id: 'jAAAAAAAAAAAAAAAAAAAA', kind: 'tr', state: 'done', spec: { name: 'a.mp4' }, btx: { t: 1793700000000, s: 'evil' } }, 1793700000000);
  ok(v.btx && v.btx.t === 1793700000000 && v.btx.s === 'x', 'view: btx מנורמל');
  const j = st.normJob({ id: 'jAAAAAAAAAAAAAAAAAAAA', spec: { name: 'a.mp4' }, srv: { id: 'jAAAAAAAAAAAAAAAAAAAA', state: 'done', btx: { t: 1793700000000, s: 'job' } } });
  ok(j.srv.btx && j.srv.btx.s === 'job', 'normJob: btx נשמר');
  ok(/kvRow\(T\('studioBtLeft'\)/.test(sj), 'פרטי העבודה: שורת "יצאה מתור החיסכון"');

  // 4. התור אבד — שחרור
  const now = 1793700000000, sid = 'srvA';
  const pj = { id: 'jAAAAAAAAAAAAAAAAAAAA', bw: now - 16 * 60e3, pk: 0, bs: sid };
  ok(S.bwLost(pj, sid, {}, [], now), 'bwLost: הסוכן לא מכיר אותה 16 דק׳ — משתחררת');
  ok(!S.bwLost(pj, sid, { jAAAAAAAAAAAAAAAAAAAA: { s: 's', t: now } }, [], now), 'bwLost: הסוכן מכיר אותה — לא');
  ok(!S.bwLost(pj, 'srvB', {}, [], now), 'bwLost: שרת אחר — לא');
  ok(!S.bwLost(Object.assign({}, pj, { bw: now - 5 * 60e3 }), sid, {}, [], now), 'bwLost: מוקדם מדי — לא');
  ok(!S.bwLost(Object.assign({}, pj, { bl: S.BL_MAX }), sid, {}, [], now), 'bwLost: אחרי BL_MAX — לא');
  ok(!S.bwLost(pj, sid, {}, [pj.id], now) && !S.bwLost(Object.assign({}, pj, { bs: undefined }), sid, {}, [], now), 'bwLost: התשובות חזרו / חנתה לפני השינוי — לא');
  ok(/bs: p\.sid \}\);/.test(api) && /const bqOn = !!body\.bq && typeof body\.bq === 'object'/.test(api) && /!lost\.includes\(job\.id\)\) continue/.test(api), 'השרתון: חנייה רושמת bs, והלקיחה משחררת עבודה שאבדה');
  const agent = read('translator/agent.py');
  ok(/if op == 'poll' and \(BT_JOBS or time\.time\(\) - _bt_live\['t'\] < BT_LIVE_S\):/.test(agent) && /_bt_live\['t'\] = now/.test(agent), 'הסוכן: bq נשלח גם ריק כשהחוט חי');

  // 5. יעד התקציב בחצי מחיר
  const base = { id: 'jAAAAAAAAAAAAAAAAAAAA', kind: 'tr', state: 'done', c0: now - 3600e3, claimed: now - 3600e3, ended: now, tg: { t: 1372, u: 0.13 }, use: [row('tl', 0.0763)] };
  const full = SLA.slaView(Object.assign({}, base, { spec: {} }), now);
  const half = SLA.slaView(Object.assign({}, base, { spec: { bt: 1 } }), now);
  ok(full.u.tg === 0.13 && half.u.tg === 0.07, 'slaView: בחצי מחיר היעד = 55% מהמלא');
  ok(half.u.f > 1 && full.u.f < 1, 'slaView: $0.076 מול יעד חצי מחיר — מעל היעד');

  const app = read('app.js');
  for (const k of ['studioCostBt', 'studioCostBtPart', 'studioCostSaved', 'studioBtLeft', 'studioBtLeftJob', 'studioBtLeftX'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
  console.log(n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
