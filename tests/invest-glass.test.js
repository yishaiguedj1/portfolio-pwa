// Invest בזכוכית (17/11/2026): שכבת העיצוב שאושרה בתצוגה המקדימה — invest-glass.css.
// בודק את החיבור (סדר השכבות, הטעינה רק ב־Invest, המטמון) ואת הכללים שאסור שיישברו בשקט:
// הגבלה ל־main/ההדר/החוגה/התפריט (האקדמיה והסטודיו לא מושפעים), ההדר המתכווץ רק בטלפון ובציר גלילה,
// טשטוש התוכן דרך --gb-fx (כבוי בסיבוב הקובייה), טשטוש עדין מאחורי התפריט (הערת המשתמש), ובלי ✓ בהודעות (משמשות גם לשגיאות).
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
const fails = [];
function ok(cond, name) { n++; if (!cond) fails.push(name); else console.log('ok - ' + name); }

const css = R('invest-glass.css');
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
const styles = R('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
const index = R('index.html');

/* ---------- חיבור ---------- */
const firstLayer = styles.match(/@layer\s+[^;{]+[;{]/);
ok(firstLayer && /^@layer\s+invglass,\s*glassbtn;$/.test(firstLayer[0]), 'styles.css: השכבה invglass מוצהרת ראשונה, לפני glassbtn (ה־!important שלה גובר)');
const gi = index.indexOf('href="glass-btn.css"'), ii = index.indexOf('<link rel="stylesheet" href="invest-glass.css">'), di = index.indexOf('href="desktop.css"');
ok(gi > 0 && ii > gi && di > ii, 'index.html: invest-glass.css אחרי glass-btn.css ולפני desktop.css');
for (const f of ['academy.html', 'studio.html', 'admin.html', 'cashflow.html', 'move.html']) ok(!R(f).includes('invest-glass.css'), f + ' לא טוען את invest-glass.css (רק Invest)');
const sw = R('sw.js');
const shell = (sw.match(/const APP_SHELL = \[[\s\S]*?\];/) || [''])[0];
ok(shell.includes("'./invest-glass.css'"), 'sw.js: invest-glass.css ב־APP_SHELL');
ok(/"\.\/invest-glass\.css": "[0-9a-f]{32}"/.test(sw), 'sw.js: טביעה ל־invest-glass.css (swgen)');

/* ---------- מבנה הקובץ ---------- */
ok(/^\s*@layer invglass\s*\{/.test(body), 'הכל בתוך @layer invglass');
let depth = 0, neg = false;
for (const ch of body) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth < 0) neg = true; } }
ok(depth === 0 && !neg, 'סוגריים מאוזנים');

/* ---------- הגבלה ל־Invest ---------- */
const rules = body.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').match(/[^{}]+\{[^{}]*\}/g) || [];
const bad = rules.map((r) => r.slice(0, r.indexOf('{')).trim()).filter((sel) => sel && !/^@/.test(sel))
  .filter((sel) => sel.split(/,(?![^(]*\))/).some((s) => { s = s.trim(); return !/^(html|main|:is\(main, \.appbar\)|\.appbar|html:not\(\.dk\) \.appbar|\.tabs|\.menu-veil|\.toast)(?=[\s:.#[]|$)/.test(s); }));
ok(!bad.length, 'כל כלל מוגבל ל־html / main / ההדר / החוגה / התפריט / ההודעה' + (bad.length ? ' — חריגים: ' + bad.slice(0, 4).join(' | ') : ''));
ok(/main \.card \{/.test(body) && !/(^|[{}])\s*\.card \{/.test(body), 'הכרטיסים רק בתוך main (לא כרטיסי האקדמיה/הסטודיו)');

/* ---------- ההדר המתכווץ ---------- */
ok(/@supports \(animation-timeline: scroll\(\)\)/.test(body), 'ההדר המתכווץ — בציר גלילה של CSS (בלי JS)');
ok(/html:not\(\.dk\) \.appbar \.brand-art \{[^}]*igLogo linear both[^}]*animation-timeline: auto, scroll\(root block\), auto, auto/.test(body), 'הלוגו מתכווץ בגלילה, ושאר אנימציות הלוגו נשמרות');
ok(/artFloat[^}]*artLean[^}]*artAct/.test(body), 'הריחוף, הנטייה והפנים של הלוגו ממשיכים');
ok(/html:not\(\.dk\) \.appbar :is\(#sourceLabel, \.fx-pill\) \{[^}]*igBub/.test(body), 'הבועות מתקפלות בגלילה');
ok(/@media \(min-height: 501px\)/.test(body), 'רק בטלפון לאורך (לא בטלפון לרוחב)');
ok(/html:not\(\.dk\) \.appbar \{ pointer-events: none/.test(body) && /pointer-events: auto/.test(body), 'השטח שהתפנה בהדר לא חוסם הקשות, והכפתורים לחיצים');

/* ---------- זכוכית ---------- */
ok(/main \.search-field \{[^}]*backdrop-filter: var\(--gb-fx\)/.test(body), 'טשטוש בתוך הדף דרך --gb-fx (כבוי בסיבוב הקובייה)');
ok(/\.menu-veil \{[^}]*backdrop-filter: blur\([1-8]px/.test(body), 'מאחורי התפריט — טשטוש עדין (הערת המשתמש)');
ok(!/\.toast::before/.test(body) && !/✓/.test(body), 'בלי ✓ בהודעה (משמשת גם לשגיאות)');
ok(/@media \(prefers-reduced-motion: reduce\)/.test(body), 'מכבד הפחתת תנועה');

if (fails.length) { console.log('\nנכשלו ' + fails.length + '/' + n + ':\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('\n' + n + '/' + n + ' עברו');
