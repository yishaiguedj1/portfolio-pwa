// brand-guard.test.js — שומר סימנים מסחריים (docs/standards.md, 28/10/2026).
// מוצרי ייחוס מוזכרים בשמם רק ב־docs/standards.md. בכל מקום אחר: "לפי ת־<תקן>" או המונח המקצועי.
// מחגר (ratchet): הניקוי נעשה בשלבים (משימות-פתוחות.md), אז מה שקיים היום רשום ב־tests/brand-baseline.json —
// בכל קובץ המספר רק יורד; קובץ שלא ברשימה — אפס. אחרי ניקוי: node tests/brand-guard.test.js --update
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const BASE = path.join(__dirname, 'brand-baseline.json');
let n = 0;
const fails = [];
function ok(cond, name) { n++; if (!cond) fails.push(name); else console.log('ok - ' + name); }

let files = [];
try { files = execSync('git -c core.quotepath=off ls-files', { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean); } catch (e) { /* בלי git — מדלגים */ }
files = [...new Set(files)];   // בזמן מיזוג עם התנגשות git ls-files מחזיר את הקובץ שלוש פעמים (שלבים 1–3)
if (!files.length) { console.log('ok - אין git — מדלגים'); process.exit(0); }

// נוצרים מקבצים אחרים (נבדקים במקור) · ספריות צד שלישי · התקנים עצמם · הבדיקה והרשימה
const SKIP = /^(sw\.js|core\.js|auth\.js|strings-[^/]*\.js|vendor\/|node_modules\/|docs\/standards\.md$|tests\/brand-(guard\.test\.js|baseline\.json)$)/;
const textExt = /\.(js|mjs|md|html|css|json|yml|yaml|py|sh|kt|kts|xml|txt)$/i;

const BRAND = '(?:TradingView|iCharts|Calibre|Caliber|Kindle|Apple Books|Apple|iOS|YouTube|Netflix|Spotify|ServiceNow|OnePlus|Google|' +
  'טריידינג ?וויו|קינדל|קליבר|יוטיוב|נטפליקס|גוגל|אפל(?![א-ת]))';
const rules = [
  // ניסוח של העתקה: "כמו ב־X", "בהשראת X", "ברמה של X", "בסגנון X", "like X", "X-style"
  { key: 'copy', name: 'ניסוח "כמו <מוצר>"',
    re: new RegExp('(?:כמו|בהשראת|ברמה של|בסגנון|זהה ל|מחקה את)[\\s־-]*(?:ש?ב?ה?[־-]?|של\\s+|ה)?' + BRAND + '|\\blike\\s+(?:in\\s+)?' + BRAND + '\\b|\\b' + BRAND + '[- ]style\\b', 'gi') },
  // כתובות של שירות שאנחנו לא מתחברים אליו רשמית (לוגואים / סורק)
  { key: 'tvurl', name: 'כתובת tradingview.com', re: /tradingview\.com/gi },
];
const logoFile = (f) => /^logos\//.test(f) || /(^|\/)ibkr-logo\.[a-z]+$/i.test(f);

const now = {};
const bump = (k, f, c) => { if (c) { (now[k] = now[k] || {})[f] = ((now[k] || {})[f] || 0) + c; } };
for (const f of files) {
  if (SKIP.test(f)) continue;
  if (logoFile(f)) bump('logo', '*', 1);
  if (!textExt.test(f) || !fs.existsSync(path.join(root, f))) continue;
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const r of rules) bump(r.key, f, (src.match(r.re) || []).length);
}

if (process.argv.includes('--update')) {
  const sorted = {};
  for (const k of Object.keys(now).sort()) { sorted[k] = {}; for (const f of Object.keys(now[k]).sort()) sorted[k][f] = now[k][f]; }
  fs.writeFileSync(BASE, JSON.stringify(sorted, null, 1) + '\n');
  console.log('עודכן: tests/brand-baseline.json');
  process.exit(0);
}
const base = fs.existsSync(BASE) ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : {};

const all = rules.concat([{ key: 'logo', name: 'קובצי לוגו של צד שלישי (logos/, ibkr-logo)' }]);
let tighter = 0;
for (const r of all) {
  const cur = now[r.key] || {}, was = base[r.key] || {};
  const grew = Object.keys(cur).filter((f) => cur[f] > (was[f] || 0));
  tighter += Object.keys(was).filter((f) => (cur[f] || 0) < was[f]).length;
  ok(!grew.length, r.name + (grew.length ? ' — נוסף ב: ' + grew.slice(0, 6).map((f) => f + ' (' + cur[f] + '>' + (was[f] || 0) + ')').join(', ') +
    ' — לנסח "לפי ת־<תקן>" (docs/standards.md)' : ': לא נוסף'));
}
if (tighter) console.log('# ' + tighter + ' קבצים נוקו מאז הרשימה — אפשר להדק: node tests/brand-guard.test.js --update');

// התקנים עצמם קיימים והחוקים בהם
const std = fs.readFileSync(path.join(root, 'docs/standards.md'), 'utf8');
for (const t of ['ת־עיצוב', 'ת־קורא', 'ת־גרף', 'ת־ניתוח', 'ת־נגן', 'ת־פיקוח']) ok(std.includes('## ' + t), 'התקן ' + t + ' קיים');
ok(/לא מקור להעתקה/.test(std) && /לומדים מהתנהגות, לא מקוד/.test(std), 'חוקי הבנייה הנקייה בתקנים');

if (fails.length) { console.log('\nFAIL (' + fails.length + '/' + n + '):\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('\n' + n + '/' + n + ' passed');
