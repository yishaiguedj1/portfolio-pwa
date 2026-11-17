// 17/11/2026 (בקשת המשתמש): "פעילה" בחוגה = עמוד לניהול העבודות הפעילות — מה רץ עכשיו ומה בתור, מכל הכלים יחד
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const st = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
const api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');

// הפונקציה הטהורה — מהקוד עצמו
const a = st.indexOf('export function actSplit'), b = st.indexOf('function pageAct(');
const A = new Function("const FINAL = ['done', 'failed', 'cancelled'];\n" + st.slice(a, b).replace(/export /g, '') + '\nreturn { actSplit };')();
const J = (id, state, extra) => Object.assign({ id, srv: Object.assign({ state }, extra && extra.srv), spec: (extra && extra.spec) || {}, up: (extra && extra.up) || {} });
const jobs = [
  J('r1', 'running'), J('d1', 'done'), J('q2', 'queued', { srv: { fired: 20 } }), J('v1', 'queued', { srv: { fired: 5 }, spec: { vi: 1 } }),
  J('q1', 'queued', { srv: { fired: 10 } }), J('n0', 'new'), J('n1', 'new', { up: { started: 1 } }), J('f1', 'failed'),
];
const ph = (r) => r.srv.state === 'new' ? 'video' : r.srv.state;
const [now, q] = A.actSplit(jobs, ph);
ok(now.map((r) => r.id).join() === 'r1,n1', 'רצות עכשיו: גם העלאה מהטלפון; בלי שהסתיימו, שנכשלו ושעוד לא התחילו');
ok(q.map((r) => r.id).join() === 'q1,q2,v1', 'התור — בסדר של השרת: תרגום לפני ניתוח, ואז לפי זמן הכניסה');
ok(/\.sort\(\(a, b\) => \(a\.sm === 1\) - \(b\.sm === 1\) \|\| \(\(a\.spec \|\| \{\}\)\.vi === 1\) - \(\(b\.spec \|\| \{\}\)\.vi === 1\) \|\| \(a\.fired \|\| 0\) - \(b\.fired \|\| 0\)\)/.test(api), 'הסדר בשרתון לא השתנה (אחרת לעדכן את actSplit)');

// החיבור לחוגה ולניווט
ok(/if \(k === 'job' && stDialJob\(\) && stDialJob\(\)\.on\) return \{ v: 'act', p: null \}/.test(st), 'יש עבודה פעילה — "פעילה" פותחת את עמוד הניהול');
ok(/if \(v === 'act'\) return 'job';/.test(st), 'העמוד שייך ל"פעילה" בחוגה');
ok(/else if \(ui\.view === 'act'\) pageAct\(p\);/.test(st), 'הציור');
ok(/x === 'tower' \|\| x === 'act' \|\| x === 'lib' \|\| x === 'home'/.test(st), 'ההורה — עמוד הבית ("חזור")');
ok(/if \(o\.act\) stDialJ = rec\.id; go\('job', rec\.id\);/.test(st), 'לחיצה על שורה — דף העבודה, שנשאר תחת "פעילה"');
ok(/if \(ui\.view === 'act'\) return 'act\|'/.test(st), 'עבודה עברה מהתור לריצה — העמוד נבנה מחדש');
ok(/ui\.view === 'home' \|\| ui\.view === 'vi' \|\| ui\.view === 'act'\) ms = /.test(st) && /\} else if \(ui\.view === 'home' \|\| ui\.view === 'vi' \|\| ui\.view === 'act'\) \{/.test(st), 'מתעדכן כמו הבית (אותו קצב, אותן קריאות)');
ok(/tx\.textContent = o\.act && ph === 'queued' \? nowLine\(rec, run, ph\)/.test(st), 'בתור — למה היא מחכה');
ok(/const rows = jobs\.map\(\(rec\) => projRow\(rec\)\);/.test(st), 'הבית — אותה שורה (projRow)');
ok(/o\.act && ph === 'queued' \? \['amber', T\('studioBQueued'\)\]/.test(st) && /rec\.spec\.vi && \(ph === 'running' \|\| ph === 'queued'\) \? \['green', T\('studioBViRun'\)\]/.test(st), 'התגית: "בתור" בפעילות; ניתוח — "בניתוח", לא "בתרגום"');
// 17/11/2026: למה היא מחכה — מהשרתון (qw) לשורת התור
ok(/qw: s\.qw && s\.qw\.r === 'mem' \? \{ r: 'mem', n: num\(s\.qw\.n\), f: num\(s\.qw\.f\) \}/.test(st), 'הטלפון: qw מנורמל (mem / perf / psi)');
ok(/if \(q && q\.r === 'mem'\) return T\('studioQwMem'/.test(st) && /if \(q && q\.r === 'psi'\) return T\('studioQwPsi'\)/.test(st) && /if \(q && q\.r === 'perf'\) return T\('studioQwPerf'\)/.test(st), 'שורת התור — הסיבה מהשרתון לפני "עכשיו רצה"');
const lib = fs.readFileSync(path.join(root, 'ibkr-proxy/lib/studio.js'), 'utf8'), agent = fs.readFileSync(path.join(root, 'translator/agent.py'), 'utf8');
ok(/qw: qwView\(job\)/.test(lib) && /const JSON_FIELDS = \['mon', 'qw'/.test(lib), 'השרתון: qw בתצוגה ושדה JSON');
ok(/const qw = S\.qwOf\(job, fit\);\s*if \(JSON\.stringify\(qw\) !== JSON\.stringify\(job\.qw \|\| null\)\)/.test(api) && /pk: now, vw: 0, bw: 0, qw: null,/.test(api), 'השרתון: נכתב רק כשהשתנה; בלקיחה — נמחק');
ok(/if psi or free < mem_need\('ai', 0\):\s*free = 0/.test(agent) && /out\['ps'\] = 1/.test(agent), 'הסוכן: בלי מקום — שואל עם mb=0 (ולחץ = ps), לא שותק');
console.log('# ' + n + ' בדיקות');
