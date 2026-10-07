// v357: הסטודיו מתחבר ל־Google Drive בלקוח OAuth נפרד מגיבוי הספרייה, והסשנים של העובד בענן רצים "רזים" ובלי דחיפה.
// למה: עם drive.file כל לקוח רואה רק את מה שהוא יצר — העובד (שיקרא תמלילים, תוכן לא מהימן) לא מגיע לגיבוי הספרייה.
// והסביבה "סטודיו" לא טוענת את CLAUDE.md (כ־100 אלף טוקנים בכל הפעלה) ולא יכולה לדחוף ל־git.
// הרצה: node tests/studio-v357.test.js
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { swVersionOk } = require('./_swver');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

/* ---------- 1. השרתון: שני לקוחות, שתי כספות ---------- */
const gd = read('ibkr-proxy/lib/gdrive.js');
ok(/makeDrive\(\{ idEnv: 'GDRIVE_CLIENT_ID', secretEnv: 'GDRIVE_CLIENT_SECRET', col: 'driveVault', aad: 'gdrive' \}\)/.test(gd), 'גיבוי הספרייה — הלקוח והכספת כמו קודם (driveVault, gdrive)');
ok(/makeDrive\(\{ idEnv: 'STUDIO_GDRIVE_CLIENT_ID', secretEnv: 'STUDIO_GDRIVE_CLIENT_SECRET', col: 'studioDrive', aad: 'sdrive' \}\)/.test(gd), 'הסטודיו — לקוח משלו (STUDIO_GDRIVE_*), כספת משלו (studioDrive) ו־AAD משלו');
const api = read('ibkr-proxy/api/studio.js');
ok(/require\('\.\.\/lib\/gdrive'\)\.studio;/.test(api) && !/require\('\.\.\/lib\/gdrive'\);/.test(api), 'api/studio.js משתמש רק בלקוח של הסטודיו (גם בגישה שהעובד מקבל)');
ok(/op === 'gdConnect' \|\| op === 'gdStatus' \|\| op === 'gdToken' \|\| op === 'gdDisconnect'/.test(api) && /body\.op === 'gdConfig'/.test(api), 'חיבור ה־Drive של הסטודיו — דרך /api/studio');
ok(api.indexOf("body.op === 'gdConfig'") > api.indexOf('if (guard(req, res)) return;'), 'gdConfig רק אחרי בדיקת ה־Origin');

/* ---------- 2. הטלפון ---------- */
const net = read('studionet.js'), st = read('studio.js');
ok(/const driveApi = \(body\) => E\.fetch\(E\.base\(\) \+ '\/api\/studio'/.test(net) && !/\/api\/library/.test(net), 'studionet: החיבור הולך ל־/api/studio, לא לשרתון של הספרייה');
ok(/libApi: \(body\) => net\.driveApi\(body\)/.test(st), 'studio.js: חלון ההסכמה מחבר את לקוח הסטודיו');
const g = st.slice(st.indexOf('function gd()'), st.indexOf('let statusAt'));
ok(/ls: \(\(\) => \{ const m = new Map\(\)/.test(g), 'studio.js: לא כותב להגדרות של גיבוי הספרייה (pwa_libbk_v1) — אחסון בזיכרון');
const lines = read('app.js').split('\n');
const marks = lines.map((l, i) => (l.trim() === '// v354: סטודיו התרגום (studio.js)' ? i : -1)).filter((i) => i >= 0);
const HE = eval('({' + lines[marks[0] + 1] + '})'), EN = eval('({' + lines[marks[1] + 1] + '})');
ok(!/אותו חיבור/.test(HE.studioNeedDrive) && !/same connection/.test(EN.studioNeedDrive), 'בלי "אותו חיבור של גיבוי הספרייה"');
ok(/לא לגיבוי הספרייה/.test(HE.studioDriveNote) && /not the library backup/.test(EN.studioDriveNote), 'ההערה בהגדרות: לסטודיו אין גישה לגיבוי הספרייה');

/* ---------- 3. הסביבה של העובד: בלי CLAUDE.md ובלי דחיפה ---------- */
const sh = read('translator/setup.sh');
ok(/claudeMdExcludes/.test(sh) && /'\*\*\/CLAUDE\.md'/.test(sh), 'setup.sh: הסשנים של הסביבה לא טוענים את CLAUDE.md');
ok(/'Bash\(git push \*\)'/.test(sh) && /'mcp__claude-code-remote'/.test(sh), 'setup.sh: בלי דחיפה ב־git ובלי כלי ניהול הסשנים (deny)');
let ran = false;
try {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'snbw-'));
  const envr = Object.assign({}, process.env, { HOME: home });
  execFileSync('bash', [path.join(root, 'translator/setup.sh')], { env: envr, stdio: 'pipe' });
  execFileSync('bash', [path.join(root, 'translator/setup.sh')], { env: envr, stdio: 'pipe' });   // פעמיים — בלי כפילויות
  const cfg = JSON.parse(fs.readFileSync(path.join(home, '.claude/settings.json'), 'utf8'));
  ok(cfg.claudeMdExcludes.length === 2 && cfg.permissions.deny.length === 3 && cfg.permissions.deny.includes('Bash(git push *)'), 'setup.sh: כותב ~/.claude/settings.json תקין, ובהרצה חוזרת בלי כפילויות');
  fs.rmSync(home, { recursive: true, force: true });
  ran = true;
} catch (e) { if (e && e.code !== 'ENOENT') throw e; }
if (!ran) console.log('# אין bash/python3 — דילוג על הרצת setup.sh');

/* ---------- 4. גרסה ---------- */
const ver = (read('app.js').match(/const APP_VERSION = '(v\d+)'/) || [])[1];
ok(+String(ver).slice(1) >= 357, 'APP_VERSION ≥ v357');
ok(swVersionOk(ver), 'sw.js תואם (שווה או גרסה אחת אחורה בשלב התוכן)');

console.log('# ' + n + ' בדיקות עברו');
