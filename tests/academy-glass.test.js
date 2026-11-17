// Academy בזכוכית (17/11/2026): שכבת העיצוב שאושרה בתצוגה המקדימה — academy-glass.css.
// בודק את החיבור (סדר השכבות, הטעינה רק ב־Academy, המטמון) ואת הכללים שאסור שיישברו בשקט:
// הגבלה ל־html (הקובץ נטען רק באקדמיה), בלי שאריות של התצוגה (ap-/pv), טשטוש כבוי בסיבוב הקובייה,
// מצב "הפחתת שקיפות", הפחתת תנועה, ובלי שמות מוצרים (בנייה נקייה).
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
const fails = [];
function ok(cond, name) { n++; if (!cond) fails.push(name); else console.log('ok - ' + name); }

const css = R('academy-glass.css');
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
const styles = R('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
const academy = R('academy.html');

/* ---------- חיבור ---------- */
const firstLayer = styles.match(/@layer\s+[^;{]+[;{]/);
ok(firstLayer && /^@layer\s+invglass,\s*acglass,\s*glassbtn;$/.test(firstLayer[0]), 'styles.css: acglass מוצהרת ראשונה, לפני glassbtn');
const gi = academy.indexOf('href="glass-btn.css"'), ai = academy.indexOf('<link rel="stylesheet" href="academy-glass.css">'), li = academy.indexOf('href="library.css"');
ok(gi > 0 && ai > gi && li > ai, 'academy.html: academy-glass.css אחרי glass-btn.css ולפני library.css');
for (const f of ['index.html', 'studio.html', 'admin.html', 'cashflow.html', 'move.html']) ok(!R(f).includes('academy-glass.css'), f + ' לא טוען את academy-glass.css (רק Academy)');
const sw = R('sw.js');
const shell = (sw.match(/const APP_SHELL = \[[\s\S]*?\];/) || [''])[0];
ok(shell.includes("'./academy-glass.css'"), 'sw.js: academy-glass.css ב־APP_SHELL');
ok(/"\.\/academy-glass\.css": "[0-9a-f]{32}"/.test(sw), 'sw.js: טביעה ל־academy-glass.css (swgen)');

/* ---------- מבנה ---------- */
ok(/^\s*@layer acglass\s*\{/.test(body), 'הכל בשכבה acglass');
let depth = 0, neg = false;
for (const ch of body) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth < 0) neg = true; } }
ok(depth === 0 && !neg, 'סוגריים מאוזנים');
ok(!/\.ap-|\bpv[A-Z-]|data-pvglass|pv-flash/.test(body), 'בלי שאריות של התצוגה המקדימה (ap-/pv)');
function splitSel(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
const rules = body.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').match(/[^{}]+\{[^{}]*\}/g) || [];
const bad = rules.map((r) => r.slice(0, r.indexOf('{')).trim()).filter((sel) => sel && !/^@/.test(sel))
  .filter((sel) => splitSel(sel).some((s) => !/^html(?=[\s:.#[]|$)/.test(s.trim())));
ok(!bad.length, 'כל כלל מתחיל ב־html' + (bad.length ? ' — חריגים: ' + bad.slice(0, 4).join(' | ') : ''));

/* ---------- זכוכית ותנועה ---------- */
ok(/html \.lib-root:is\(\.cube-face, \.cube-ghost\), html \.cube-flat \{ --lg-fx: none; \}/.test(body), 'בלי טשטוש בזמן סיבוב הקובייה');
ok(/@media \(prefers-reduced-transparency: reduce\)/.test(body), 'זכוכית מוצקה כשמבקשים הפחתת שקיפות');
ok(/@media \(prefers-reduced-motion: reduce\)/.test(body), 'מכבד הפחתת תנועה');
ok(/html\[data-theme="dark"\]/.test(body), 'אסימונים לערכה הכהה');
ok(/--lg-tint: linear-gradient\(180deg, rgba\(96, 168, 255/.test(body), 'המבטא הכחול של Academy');
ok(!/apple|(?<![-\w])ios\b|iphone|liquid glass|books app/i.test(css), 'בלי שמות מוצרים (לפי ת־עיצוב)');

if (fails.length) { console.log('\n' + fails.length + '/' + n + ' נכשלו:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('\n' + n + ' בדיקות עברו');
