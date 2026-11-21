// Studio בזכוכית (18/11/2026): שכבת העיצוב שאושרה בתצוגה המקדימה — studio-glass.css.
// בודק את החיבור (סדר השכבות, הטעינה רק ב־Studio, המטמון) ואת הכללים שאסור שיישברו בשקט:
// הגבלה ל־html (הקובץ נטען רק בסטודיו), בלי שאריות של התצוגה (ap-/pv), טשטוש כבוי בסיבוב הקובייה,
// מצב "הפחתת שקיפות", הפחתת תנועה, ובלי שמות מוצרים (בנייה נקייה). ובנוסף — שני התיקונים שנמצאו בתצוגה.
'use strict';
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const R = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
const fails = [];
function ok(cond, name) { n++; if (!cond) fails.push(name); else console.log('ok - ' + name); }

const css = R('studio-glass.css');
const body = css.replace(/\/\*[\s\S]*?\*\//g, '');
const styles = R('styles.css').replace(/\/\*[\s\S]*?\*\//g, '');
const studio = R('studio.html');

/* ---------- חיבור ---------- */
const firstLayer = styles.match(/@layer\s+[^;{]+[;{]/);
ok(firstLayer && /^@layer\s+invglass,\s*acglass,\s*glassbtn,\s*stglass;$/.test(firstLayer[0]), 'styles.css: stglass מוצהרת ראשונה, אחרי glassbtn (כמו בתצוגה שאושרה: חומר הכפתורים מכפתורי הזכוכית)');
// אחרי glassbtn — הצהרת חומר על כפתור משותף לא תיראה; לא משאירים קוד מת
const GB = /(?:^|[\s,(])\.(?:st-btn|st-plus|st-outb|st-pl-b|st-se-b|st-cpill|st-mini|st-jobs-more|tab-disc|tab-glow)(?![\w-])[^{,]*\{[^}]*(?:background|box-shadow|backdrop-filter)\s*:/m;
const gi = studio.indexOf('href="glass-btn.css"'), si = studio.indexOf('<link rel="stylesheet" href="studio-glass.css">'), ci = studio.indexOf('href="studio.css"');
ok(gi > 0 && si > gi && ci > si, 'studio.html: studio-glass.css אחרי glass-btn.css ולפני studio.css');
for (const f of ['index.html', 'academy.html', 'admin.html', 'cashflow.html', 'move.html']) ok(!R(f).includes('studio-glass.css'), f + ' לא טוען את studio-glass.css (רק Studio)');
const sw = R('sw.js');
const shell = (sw.match(/const APP_SHELL = \[[\s\S]*?\];/) || [''])[0];
ok(shell.includes("'./studio-glass.css'"), 'sw.js: studio-glass.css ב־APP_SHELL');
ok(/"\.\/studio-glass\.css": "[0-9a-f]{32}"/.test(sw), 'sw.js: טביעה ל־studio-glass.css (swgen)');

/* ---------- מבנה ---------- */
ok(/^\s*@layer stglass\s*\{/.test(body), 'הכל בשכבה stglass');
let depth = 0, neg = false;
for (const ch of body) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth < 0) neg = true; } }
ok(depth === 0 && !neg, 'סוגריים מאוזנים');
ok(!/\.ap-|\bpv[A-Z-]|data-pvglass|pv-flash/.test(body), 'בלי שאריות של התצוגה המקדימה (ap-/pv)');
function splitSel(sel) { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; else if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }
const rules = body.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').match(/[^{}]+\{[^{}]*\}/g) || [];
const bad = rules.map((r) => r.slice(0, r.indexOf('{')).trim()).filter((sel) => sel && !/^@/.test(sel))
  .filter((sel) => splitSel(sel).some((s) => !/^html(?=[\s:.#[]|$)/.test(s.trim())));
ok(!rules.some((r) => GB.test(r.trim())), 'בלי חומר (רקע/צל/טשטוש) על כפתורי הזכוכית המשותפים — שם הוא לא נראה');
ok(!bad.length, 'כל כלל מתחיל ב־html' + (bad.length ? ' — חריגים: ' + bad.slice(0, 4).join(' | ') : ''));
// הכרטיסים והרשימות בלי טשטוש — זכוכית רק על מה שצף (ביצועים בגלילה)
ok(/html \.st-root :is\(\.st-list, \.st-newcard, \.st-jhero, \.st-stages, \.st-qcard\) \{[^}]*backdrop-filter: none !important/.test(body), 'כרטיסים ורשימות — מילוי רך בלי טשטוש');

/* ---------- זכוכית ותנועה ---------- */
ok(/html \.st-root:is\(\.cube-face, \.cube-ghost\), html \.cube-flat \{ --lg-fx: none; \}/.test(body), 'בלי טשטוש בזמן סיבוב הקובייה');
ok(/@media \(prefers-reduced-transparency: reduce\)/.test(body), 'זכוכית מוצקה כשמבקשים הפחתת שקיפות');
ok(/@media \(prefers-reduced-motion: reduce\)/.test(body), 'מכבד הפחתת תנועה');
ok(/html\[data-theme="dark"\]/.test(body), 'אסימונים לערכה הכהה');
ok(/html \.st-page\.st-dark \{ --lg-card:/.test(body), 'דף כהה (נגן, פריט בספרייה) — אותו חומר בגרסה כהה');
ok(/--lg-tint: linear-gradient\(180deg, rgba\(255, 92, 102/.test(body), 'המבטא האדום של Studio');
ok(!/apple|(?<![-\w])ios\b|iphone|liquid glass|books app/i.test(css), 'בלי שמות מוצרים (לפי ת־עיצוב)');

/* ---------- התיקונים שנמצאו בתצוגה ---------- */
const sj = R('studio.js');
const icons = sj.slice(sj.indexOf('clip: \'<rect'), sj.indexOf('clip: \'<rect') + 600);
ok(/\n\s*redo: '<path /.test(icons), 'הסמל redo בשורה משלו (לא בתוך הערה) — "הפקה מחדש" עם סמל');
const sc = R('studio.css');
ok(/\.st-lc-t \{[^}]*overflow-wrap: anywhere/.test(sc) && /\.st-lib-t \{[^}]*overflow-wrap: anywhere/.test(sc), 'שם קובץ ארוך בלי רווחים נשבר בכרטיס ובדף הפריט (לא נחתך מההתחלה)');

// 18/11/2026: ההדר המתכווץ בגלילה — כמו ב־Invest, אבל על המכל הגולל (scroll(nearest block)), לא על השורש
ok(/html:not\(\.dk\) \.appbar \.brand-art \{[^}]*stLogo linear both[^}]*animation-timeline: auto, scroll\(nearest block\), auto, auto/.test(body), 'הלוגו מתכווץ בגלילה, ושאר אנימציות הלוגו נשמרות');
ok(/html:not\(\.dk\) \.appbar \.appbar-sub \{[^}]*stBub linear both[^}]*scroll\(nearest block\)/.test(body), 'הבועה בהדר מתקפלת ונעלמת בגלילה');
ok(/@keyframes stLogo \{ to \{ scale: \.6; \} \}/.test(body) && /@keyframes stBub/.test(body) && /stScrimUp linear both/.test(body), 'אותם ערכים של Invest (0.6, הבועה, הרצועה עולה)');
ok(!/scroll\(root/.test(body), 'בלי scroll(root) — הדף נגלל בתוך המכל, לא בשורש');

if (fails.length) { console.log('\n' + fails.length + '/' + n + ' נכשלו:\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('\n' + n + ' בדיקות עברו');
