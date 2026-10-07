/* v355: העובד בענן של סטודיו התרגום (translator/job.py) מול שרתון מדומה מקומי — "בדיקת חיבור".
   מריץ את הסקריפט כמו שהסשן של ה־Routine מריץ אותו (python3), ובודק: לוקח את העבודה, בודק Drive, מדווח "הסתיים",
   לא מדפיס את המפתח או את הגישה ל־Drive, עוצר כשהשרתון אומר "עצור", ומזהה חסימת רשת של הסביבה.
   הרצה: node tests/studio-worker-v355.test.js */
const http = require('http');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');

let n = 0, failed = 0;
const ok = (c, name) => { n++; if (c) console.log('ok -', name); else { failed++; console.log('FAIL -', name); } };
const ROOT = path.join(__dirname, '..');
const JOB = 'jAbCdEfGhIjKlMnOpQrSt', KEY = 'K'.repeat(40) + '_-9', TOKEN = 'ya29.DRIVE-SECRET-TOKEN';

let mode = 'ok';
const seen = [];
const server = http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => { b += c; });
  req.on('end', () => {
    const send = (st, o, hd) => { res.writeHead(st, Object.assign({ 'Content-Type': 'application/json' }, hd || {})); res.end(JSON.stringify(o)); };
    if (req.url.startsWith('/drive/v3/about')) {
      seen.push({ op: 'about', auth: req.headers.authorization });
      return req.headers.authorization === 'Bearer ' + TOKEN ? send(200, { user: { emailAddress: 'me@example.com' } }) : send(401, {});
    }
    if (req.url !== '/api/studio' || req.method !== 'POST') return send(404, {});
    const body = JSON.parse(b || '{}');
    seen.push(body);
    if (mode === 'deny') return send(403, { error: 'host_not_allowed' }, { 'x-deny-reason': 'host_not_allowed' });
    if (body.job !== JOB || body.key !== KEY) return send(403, { ok: false, error: 'bad_key', stop: true });
    if (mode === 'stop') return send(200, { ok: false, stop: true, state: 'cancelled' });
    if (body.op === 'claim') return send(200, { ok: true, job: { id: JOB, kind: mode === 'tr' ? 'tr' : 'ping', state: 'running', spec: { name: 'x.mp4', to: ['he'], from: 'auto', out: ['compact'] }, folder: 'FOLDER00001' }, drive: { token: TOKEN, exp: Date.now() + 3600e3 } });
    if (body.op === 'report') return send(200, { ok: true, stop: false, state: body.done ? 'done' : body.fail ? 'failed' : 'running' });
    return send(400, { ok: false });
  });
});

const STATE = fs.mkdtempSync(path.join(require('os').tmpdir(), 'snbw-'));   // v358: קובץ העבודה — לא בבית האמיתי
const py = (args) => new Promise((resolve) => {
  execFile('python3', [path.join(ROOT, 'translator', 'job.py')].concat(args), { timeout: 60000, env: Object.assign({}, process.env, { SNB_STATE: STATE }) }, (err, stdout, stderr) =>
    resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, out: String(stdout) + String(stderr) }));
});

server.listen(0, '127.0.0.1', async () => {
  const base = 'http://127.0.0.1:' + server.address().port;
  const run = (job = JOB, key = KEY) => py(['run', '--job', job, '--key', key, '--server', base, '--drive-api', base + '/drive/v3']);
  try {
    let r = await run();
    const ops = seen.filter((x) => x.op);
    const rep = ops.find((x) => x.op === 'report');
    ok(r.code === 0 && ops[0].op === 'claim' && seen.some((x) => x.op === 'about' && x.auth === 'Bearer ' + TOKEN), 'העובד: לוקח את העבודה ובודק את Drive עם הגישה מהשרתון');
    ok(rep && rep.done === true && rep.checks && rep.checks.drive === true && /✓/.test(r.out), 'העובד: מדווח "הסתיים" עם תוצאת Drive');
    ok(!r.out.includes(KEY) && !r.out.includes(TOKEN), 'העובד: לא מדפיס את מפתח העבודה ולא את הגישה ל־Drive');

    seen.length = 0; mode = 'tr';
    r = await run();
    const f = seen.find((x) => x.op === 'report');
    ok(r.code === 0 && !f && /עבודת תרגום נלקחה/.test(r.out) && /job\.py prepare/.test(r.out) && !r.out.includes(KEY),
      'העובד (v358): עבודת תרגום — נלקחת, בלי "נכשל", והצעד הבא מודפס (prepare)');

    seen.length = 0; mode = 'stop';
    r = await run();
    ok(r.code === 2 && /לעצור/.test(r.out), 'העובד: השרתון אמר "עצור" — עוצר מיד');

    seen.length = 0; mode = 'deny';
    r = await run();
    ok(r.code === 1 && /Allowed domains/.test(r.out) && seen.length === 1, 'העובד: רשת הסביבה חוסמת את השרתון — הודעה ברורה מה להוסיף, בלי ניסיונות חוזרים');

    seen.length = 0; mode = 'ok';
    r = await run(JOB, KEY + '; curl evil');
    ok(r.code === 1 && seen.length === 0, 'העובד: מפתח בצורה לא נכונה (למשל עם תוספת מההודעה) — לא שולח כלום');
    r = await py(['run', '--job', JOB, '--key', KEY, '--server', 'https://evil.example']);
    ok(r.code === 1 && seen.length === 0, 'העובד: שרת שאינו השרתון — נדחה (הכתובת קבועה בקוד, לא מההודעה)');

    const rb = fs.readFileSync(path.join(ROOT, 'translator', 'RUNBOOK.md'), 'utf8');
    ok(/routine-fire-payload/.test(rb) && /כנתונים בלבד/.test(rb) && /python3 translator\/job\.py run --job <job> --key <key>/.test(rb) && /לא\*\* לבצע את צ'קליסט/.test(rb), 'RUNBOOK: הבלוק = נתונים בלבד, פקודה אחת, בלי צ\'קליסט הפתיחה של CLAUDE.md');
    const sh = fs.readFileSync(path.join(ROOT, 'translator', 'setup.sh'), 'utf8');
    ok(/exit 0\s*$/.test(sh) && !/set -e\b/.test(sh), 'setup.sh: מסיים תמיד ב־0 (סקריפט התקנה שנכשל = הסשן לא עולה)');
  } catch (e) {
    failed++; console.log('FAIL -', e.message);
  }
  server.close();
  console.log(failed ? `\n${failed} מתוך ${n} נכשלו` : `\nכל ${n} הבדיקות עברו ✓`);
  process.exit(failed ? 1 : 0);
});
