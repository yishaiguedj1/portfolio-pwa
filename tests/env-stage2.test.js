// שלב 2 בסביבות (12/10/2026): אותם קבצים בכל הסביבות, הסביבה לפי הכתובת; פריסה לאתר החי רק אחרי בדיקות + אישור.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓ ' + name); };

function envAt(hostname) {
  const cls = new Set();
  const win = {};
  const ctx = vm.createContext({ window: win, location: { hostname }, document: { documentElement: { classList: { add: (c) => cls.add(c) } } } });
  vm.runInContext(read('firebase-config.js'), ctx);
  return { env: win.SNB_ENV, fb: win.FIREBASE_CONFIG, cls, envFor: win.snbEnvFor };
}

t('הסביבה לפי הכתובת', () => {
  assert.strictEqual(envAt('yishaiguedj1.github.io').env.name, 'prod');
  assert.strictEqual(envAt('thesnowball.app').env.name, 'prod');
  assert.strictEqual(envAt('staging.thesnowball.app').env.name, 'staging');
  assert.strictEqual(envAt('thesnowball.pages.dev').env.name, 'staging');
  assert.strictEqual(envAt('claude-x.thesnowball.pages.dev').env.name, 'staging');
  assert.strictEqual(envAt('localhost').env.name, 'local');
});

t('הניסוי אף פעם לא מתחבר לפרויקט ה־Firebase של הייצור', () => {
  const prod = envAt('yishaiguedj1.github.io');
  const st = envAt('staging.thesnowball.app');
  assert.strictEqual(prod.fb.projectId, 'yishaiguedj1-c786e');
  assert.notStrictEqual(st.fb.projectId, 'yishaiguedj1-c786e');
  assert.notStrictEqual(st.fb.apiKey, prod.fb.apiKey);
  assert.ok(st.cls.has('env-staging') && !prod.cls.has('env-staging'));
  assert.strictEqual(envAt('localhost').fb.projectId, 'yishaiguedj1-c786e', 'בדיקות מקומיות — כמו קודם');
  assert.strictEqual(st.fb.projectId, 'snowball-staging-758f6');
  const csp = read('index.html').match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const d of ['connect-src', 'frame-src']) {
    const dir = csp.split(';').find((x) => x.trim().startsWith(d + ' '));
    assert.ok(dir.includes('https://' + st.fb.authDomain), 'authDomain של הניסוי ב־' + d);
  }
});

t('כתובת השרתון באפליקציה מגיעה מהסביבה', () => {
  const app = read('app.js');
  assert.ok(/const IBKR_PROXY_DEFAULT = \(typeof window !== 'undefined' && window\.SNB_ENV && window\.SNB_ENV\.proxy\) \|\| 'https:\/\/ibkr-proxy-wine\.vercel\.app';/.test(app));
  assert.ok(/window\.SNB_ENV\.name === 'staging'[\s\S]{0,200}env-strip/.test(app), 'פס "סביבת ניסוי"');
  assert.ok(/\.env-strip \{[^}]*pointer-events: none/.test(read('styles.css')), 'הפס לא חוסם נגיעות');
  const html = read('index.html');
  assert.ok(html.indexOf('firebase-config.js') < html.indexOf('src="app.js"'), 'ההגדרות נטענות לפני האפליקציה');
});

t('הניסוי מדבר עם השרתון שלו, הייצור עם שלו', () => {
  assert.strictEqual(envAt('staging.thesnowball.app').env.proxy, 'https://api-staging.thesnowball.app');
  assert.strictEqual(envAt('thesnowball.pages.dev').env.proxy, 'https://api-staging.thesnowball.app');
  assert.strictEqual(envAt('yishaiguedj1.github.io').env.proxy, 'https://ibkr-proxy-wine.vercel.app');
  assert.strictEqual(envAt('localhost').env.proxy, 'https://ibkr-proxy-wine.vercel.app');
  const csp = read('index.html').match(/Content-Security-Policy" content="([^"]+)"/)[1];
  const cs = csp.split(';').find((x) => x.trim().startsWith('connect-src '));
  assert.ok(cs.split(/\s+/).includes('https://api-staging.thesnowball.app'), 'השרתון של הניסוי ב־connect-src');
  const job = read('translator/job.py');
  assert.ok(job.includes("'https://api-staging.thesnowball.app'"), 'אותה כתובת ברשימה הסגורה של העובד');
});

t('השרתון: כתובות הניסוי מותרות, אתרים זרים לא', () => {
  const { originAllowed } = require('../ibkr-proxy/lib/ibkr.js');
  for (const o of ['https://yishaiguedj1.github.io', 'https://staging.thesnowball.app', 'https://thesnowball.pages.dev', 'https://main.thesnowball.pages.dev', 'http://localhost:8080']) assert.ok(originAllowed(o), o);
  for (const o of ['https://evil.pages.dev', 'https://thesnowball.pages.dev.evil.com', 'http://staging.thesnowball.app', 'https://x.staging.thesnowball.app', 'https://thesnowball.app.evil.com', '']) assert.ok(!originAllowed(o), o);
  process.env.SNB_EXTRA_ORIGINS = 'https://thesnowball.app, javascript:alert(1)';
  try {
    assert.ok(originAllowed('https://thesnowball.app'));
    assert.ok(!originAllowed('javascript:alert(1)'));
  } finally { delete process.env.SNB_EXTRA_ORIGINS; }
});

t('פס הפריסה: בדיקות → ניסוי → אישור → Pages → אימות ותגית', () => {
  assert.ok(!fs.existsSync(path.join(root, '.github/workflows/release.yml')), 'release.yml הוחלף ב־deploy.yml');
  const w = read('.github/workflows/deploy.yml');
  assert.ok(/workflow_run:\s*\n\s*workflows: \[tests\][\s\S]*branches: \[main\]/.test(w), 'רץ רק אחרי הבדיקות על main');
  assert.ok(/conclusion == 'success'/.test(w), 'רק כשהבדיקות ירוקות');
  assert.ok(/workflow_run\.event == 'push' && github\.event\.workflow_run\.head_branch == 'main' && github\.event\.workflow_run\.head_repository\.full_name == github\.repository/.test(w), 'רק push ל־main בריפו הזה — לא PR ולא fork');
  assert.ok(/approve:[\s\S]*?needs: staging[\s\S]*?environment: production/.test(w), 'אישור בסביבה production');
  assert.ok(/deploy:[\s\S]*?needs: \[staging, approve\][\s\S]*?name: github-pages/.test(w), 'Pages רק אחרי האישור');
  assert.ok(/verify-and-tag:[\s\S]*?needs: \[staging, deploy(, deploy-cf)?\][\s\S]*?swgen\.js --live[\s\S]*?tag -a/.test(w));
  assert.ok(!/ref: \$\{\{ env\.SHA \}\}/.test(w) && /head_sha/.test(w), 'לא מושכים ישירות קומיט מהאירוע');
  assert.strictEqual((w.match(/ref: main\n/g) || []).length, 4, 'כל שלב מושך את main (כולל deploy-cf — שלב 5)');
  assert.strictEqual((w.match(/merge-base --is-ancestor "\$SHA" HEAD \|\|[^\n]*\n\s*git checkout -q --detach "\$SHA"/g) || []).length, 4, 'ובודק שהקומיט ב־main לפני שעובר אליו');
  assert.ok(/^permissions:\s*\n\s*contents: read/m.test(w), 'הרשאות מינימליות כברירת מחדל');
  for (const u of w.match(/uses: \S+/g)) assert.ok(/@[0-9a-f]{40}$/.test(u), 'מקובע ל־SHA: ' + u);
  // הניסוי: העלאה ישירה מ־Actions (לא החיבור ל־Git של Cloudflare) — רק קומיט שהבדיקות שלו ירוקות, רק הקבצים שב־git
  assert.ok(/staging:[\s\S]*?npx --yes wrangler@\d+\.\d+\.\d+"[\s\S]*?git archive "\$SHA"[\s\S]*?pages deploy "\$site" --project-name thesnowball[\s\S]*?approve:/.test(w), 'העלאה לניסוי בתוך שלב staging, גרסת wrangler מקובעת');
  assert.ok(/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/.test(w) && !/run:[^\n]*\$\{\{ secrets\./.test(w), 'הסוד רק דרך env');
  assert.ok(/if: steps\.cf\.outputs\.up == 'yes'[\s\S]*?swgen\.js --live "\$URL"/.test(w), 'אחרי ההעלאה — כל קובץ בניסוי מול הטביעה');
  assert.ok(!/--commit-message "\$\{\{/.test(w), 'בלי ביטוי בתוך פקודה');
  const test = read('.github/workflows/test.yml');
  assert.ok(/^name: tests$/m.test(test), 'שם ה־workflow שהפריסה מחכה לו');
});

t('פרודקשן רק כשגרסת המערכת עלתה; התגית = vX.Y.Z', () => {
  const w = read('.github/workflows/deploy.yml');
  assert.ok(/approve:[\s\S]*?if: needs\.staging\.outputs\.release == 'yes'/.test(w), 'אישור רק לגרסה חדשה');
  assert.ok(/git ls-remote --tags origin "refs\/tags\/v\$rel"/.test(w), 'גרסה חדשה = אין לה עוד תגית');
  assert.ok(/TAG: v\$\{\{ needs\.staging\.outputs\.rel \}\}/.test(w) && /tag -a "\$TAG"/.test(w));
  const app = read('app.js');
  const rel = app.match(/const APP_RELEASE = '(\d+\.\d+\.\d+)'/);
  assert.ok(rel, 'APP_RELEASE ב־app.js');
  assert.ok(read('CHANGELOG.md').split('\n').some((l) => l.startsWith('## ' + rel[1] + ' ')), 'הגרסה הנוכחית מתועדת ב־CHANGELOG.md');
  assert.ok(/^## לא פורסם$/m.test(read('CHANGELOG.md')), 'מקטע "לא פורסם" לשינויים שבניסוי');
});

console.log(`\n${n} בדיקות עברו`);
