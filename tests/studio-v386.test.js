// v386: סטודיו התרגום — מגדל 2.0, מדדי הערכת סוכנים ובקרת הסוכנים (ServiceNow: Agentic evaluation · AI Control Tower):
// שלמות, כלי נכון וקריאות תקינות — מהיומנים, בלי טוקנים, לכל גרסת הנחיות; "מומלץ לפעולה", מחזור החיים של ההנחיות, סיכון מול בקרה.
// הבדיקות המלאות: ibkr-proxy/tests/run.js (בלוק v386), translator/tests/test_worker.py (test_trace, test_off_role).
// הרצה: node tests/studio-v386.test.js
const fs = require('fs');
const path = require('path');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const A = require(path.join(root, 'ibkr-proxy/lib/studioagents.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const now = Date.UTC(2026, 9, 10, 12);
  const job = (i, pv, o) => Object.assign({ id: 'j' + String(i).padStart(20, '0'), kind: 'tr', state: 'done', created: now - (20 - i) * 86400e3, spec: { mode: 'opus-medium' },
    pv: { tl: pv, rb: 'aaaaaaaa' }, prog: { stg: { tl: { s: 1, e: 2 }, rv: { s: 3, e: 4 } } }, use: [{ k: 'tl', m: 'claude-opus-5-5', usd: 1 }],
    tr: { a: { tl: { n: 20, e: 1, s: 100, w: 0 }, main: { n: 40, e: 2, s: 300, w: 1 } } } }, o || {});

  /* ---------- 1. העקיבה: w (מחוץ לתפקיד) ---------- */
  ok(S.normTrace({ a: { tl: { n: 5, e: 1, s: 9, w: 2 } } }).a.tl.w === 2, 'normTrace: w עובר');
  ok(S.normTrace({ a: { tl: { n: 5, e: 1, s: 9 } } }).a.tl.w === undefined, 'normTrace: עקיבה ישנה בלי w — עדיין תקינה');
  ok(S.normTrace({ a: { tl: { n: 5, e: 1, s: 9, w: 6 } } }) === null && S.normTrace({ a: { tl: { n: 5, e: 1, s: 9, w: -1 } } }) === null, 'normTrace: w גדול מהפעולות / שלילי — נזרק כולו');
  const jp = read('translator/job.py');
  ok(/a\['w'\] \+= sum\(1 for k in uses\.values\(\) if off_role\(kind, k\)\)/.test(jp) && /ROLE_SUB_JOB = \('job:vt', 'job:stage'\)/.test(jp), 'העובד: סופר פעולות מחוץ לתפקיד (למתרגם/מבקר — רק vt ו־stage של job.py)');

  /* ---------- 2. ההערכה ---------- */
  const e1 = A.evalOf('tl', [job(1, '11111111'), job(2, '11111111')]);
  ok(e1.c === 100 && e1.t === 100 && e1.v === 95 && e1.sc === 98, 'evalOf: שלמות 100, כלי נכון 100, פעולות תקינות 95 → 98');
  const bad = job(3, '22222222', { state: 'failed', prog: { stg: {} }, tr: { a: { tl: { n: 10, e: 4, s: 50, w: 2 } } } });
  const e2 = A.evalOf('tl', [bad]);
  ok(e2.c === 0 && e2.t === 80 && e2.v === 60 && e2.w === 2 && e2.sc === 47, 'evalOf: לא השלים, 2 מחוץ לתפקיד, 4 נכשלו');
  ok(A.evalOf('tl', [job(4, 'x', { tr: { a: { tl: { n: 10, e: 0, s: 1 } } } })]).t === null, 'עקיבה ישנה בלי w — "כלי נכון" לא נמדד (לא 100)');
  ok(A.completed('main', { state: 'done' }) && !A.completed('main', { state: 'failed' }) && A.completed('jg', { jd: { s: 80 } }) && !A.completed('rv', { prog: { stg: { tl: { e: 1 } } } }),
    'שלמות לפי תפקיד: מנהל העבודה — סיום; השופט — ציון; המבקר — השלב שלו');
  const v = A.agentsView([job(1, '11111111'), job(2, '11111111'), bad], now);
  const tl = v.agents.find((a) => a.k === 'tl');
  ok(tl.vs.length === 2 && tl.vs[0].p === '22222222' && tl.vs[0].sc === 47 && tl.vs[1].p === '11111111' && tl.vs[1].sc === 98, 'לכל גרסת הנחיות — הציון שלה, החדשה ראשונה');
  ok(tl.sc != null && tl.c === 67, 'ההערכה הכוללת של הסוכן ב־30 יום');
  ok(Array.isArray(v.risk) && v.risk.map((r) => r.r).join() === 'inj,cost,loop' && v.risk.map((r) => r.st).join() === 'm,s,s', 'סיכון מול בקרה: הזרקה (בינונית — מסמנת), עלות ולולאות (חזקות — עוצרות)');
  const rv = A.riskView([{ ij: { n: 2 } }, { err: 'budget_stop' }, { err: 'tower_stop', tw: { why: 'calls', lv: 'red' } }, { rh: [1, 2] }, { tw: { why: 'cost', lv: 'warn' } }]);
  ok(rv[0].n === 1 && rv[1].n === 1 && rv[2].n === 2, 'סיכון מול בקרה: כמה פעמים כל בקרה פעלה (אזהרה בלבד — לא נספרת)');
  ok(!JSON.stringify(v).includes('Ackman'), 'בלי שמות קבצים');

  /* ---------- 3. הטלפון ---------- */
  const st = await import(path.join(root, 'studio.js'));
  const nv = st.normAgents(JSON.parse(JSON.stringify(v)));
  const ntl = nv.agents.find((a) => a.k === 'tl');
  ok(ntl.vs.length === 2 && ntl.vs[0].sc === 47 && ntl.c === 67 && nv.risk.length === 3, 'normAgents: הערכה, גרסאות וסיכון עוברים');
  const evil = st.normAgents({ agents: [{ k: 'tl', c: 140, t: -3, v: 'x', vs: [{ p: '<b>', sc: 50 }, { p: 'abcdef12', sc: 101 }] }], risk: [{ r: 'evil', st: 's', n: 1 }, { r: 'inj', st: 'x', n: 1 }] });
  ok(evil.agents[0].c === null && evil.agents[0].t === null && evil.agents[0].v === null && evil.agents[0].vs.length === 1 && evil.agents[0].vs[0].sc === null && evil.risk.length === 0, 'normAgents: מסנן ערכים לא תקינים');
  const recs = st.agentRecs(nv, { 'opus-medium': 2 });
  const kinds = recs.map((r) => r.k);
  ok(kinds.includes('drop') && kinds.includes('shadow') && recs.find((r) => r.k === 'drop').from === 98, 'מומלץ לפעולה: הציון ירד עם ההנחיות החדשות; מצב צל');
  ok(st.agentRecs({ agents: [{ k: 'tl', pvNew: true, vs: [{ p: 'a', jobs: 1, sc: 90 }, { p: 'b', jobs: 5, sc: 92 }], t: 90, w: 3, v: 80, c: 70 }] }, {}).map((r) => r.k).join() === 'new,tool,valid,cmp',
    'מומלץ לפעולה: הנחיות חדשות (בלי ירידה), מחוץ לתפקיד, פעולות שנכשלו, לא השלים');
  ok(st.agentRecs(null, null).length === 0 && st.agentRecs({ agents: [{ k: 'tl', vs: [], t: 100, v: 100, c: 100 }] }, {}).length === 0, 'הכל תקין — בלי המלצות');
  const sj = read('studio.js');
  ok(/const recs = agentRecs\(ag, ui\.sh\);/.test(sj) && /k: 'ag-recs'/.test(sj), 'המגדל: שורה אחת "מומלץ לפעולה" בראש מקטע הסוכנים');
  ok(!/kv\(T\('studioAgPv'\)/.test(sj) && /secT\(T\('studioPvT'\)\)/.test(sj), 'גרסת ההנחיות — רק במחזור החיים (בלי כפילות באריחים)');
  const app = read('app.js');
  for (const k of ['studioRecT', 'studioRecDrop', 'studioRecNew', 'studioRecNew1', 'studioRecTool', 'studioRecTool1', 'studioRecValid', 'studioRecCmp', 'studioRecShadow', 'studioRecShadow1',
    'studioEvSc', 'studioEvLine', 'studioPvT', 'studioPvLive', 'studioPvOld', 'studioPvNote', 'studioRiskT', 'studioRiskInj', 'studioRiskInjC', 'studioRiskCost', 'studioRiskCostC',
    'studioRiskLoop', 'studioRiskLoopC', 'studioRiskS', 'studioRiskM', 'studioRiskW', 'studioRiskNote'])
    ok((app.match(new RegExp('\\b' + k + ': "', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);

  /* ---------- 4. גרסה ---------- */
  const ver = (app.match(/APP_VERSION = '(v\d+)'/) || [])[1] || '';
  ok(+ver.slice(1) >= 383 && swVersionOk(ver), 'APP_VERSION ≥ v383 (נפרס יחד עם שאר הסבבים) ו־sw.js תואם (או גרסה אחת אחורה)');
  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
