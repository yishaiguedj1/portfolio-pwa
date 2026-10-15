// השרתון נפרס ב־Vercel רק מ־main (15/10/2026): תצוגות מקדימות של ענפים גמרו את מכסת 100 הפריסות ביום.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let fails = 0;
const ok = (c, m) => { if (c) console.log('✓', m); else { fails++; console.log('✗', m); } };
const dir = path.join(__dirname, '..', 'ibkr-proxy');
const cfg = JSON.parse(fs.readFileSync(path.join(dir, 'vercel.json'), 'utf8'));
const de = cfg.git && cfg.git.deploymentEnabled;
ok(de && de.main === true, 'vercel.json: main נפרס');
ok(de && de['**'] === false, 'vercel.json: כל ענף אחר (גם עם /) — בלי פריסה');
const run = (ref) => {
  try { execFileSync('sh', ['ignore-build.sh'], { cwd: dir, env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref, VERCEL_GIT_PREVIOUS_SHA: '' }, stdio: 'ignore' }); return 0; }
  catch (e) { return e.status; }
};
ok(run('claude/studio-direct-api') === 0, 'ignore-build.sh: ענף אחר — מדלג');
ok(run('main') === 1, 'ignore-build.sh: main בלי פריסה קודמת — פורס');
console.log(fails ? `FAIL ${fails}` : 'PASS');
process.exit(fails ? 1 : 0);
