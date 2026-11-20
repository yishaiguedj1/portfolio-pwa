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
ok(firstLayer && /^@layer\s+invglass,\s*(acglass,\s*)?glassbtn(,\s*stglass)?;$/.test(firstLayer[0]), 'styles.css: השכבה invglass מוצהרת ראשונה, לפני glassbtn (ה־!important שלה גובר)');
const gi = index.indexOf('href="glass-btn.css"'), ii = index.indexOf('<link rel="stylesheet" href="invest-glass.css">'), di = index.indexOf('href="desktop.css"');
ok(gi > 0 && ii > gi && di > ii, 'index.html: invest-glass.css אחרי glass-btn.css ולפני desktop.css');
for (const f of ['academy.html', 'studio.html', 'admin.html', 'cashflow.html', 'move.html']) ok(!R(f).includes('invest-glass.css'), f + ' לא טוען את invest-glass.css (רק Invest)');
const sw = R('sw.js');
const shell = (sw.match(/const APP_SHELL = \[[\s\S]*?\];/) || [''])[0];
ok(shell.includes("'./invest-glass.css'"), 'sw.js: invest-glass.css ב־APP_SHELL');
ok(/"\.\/invest-glass\.css": "[0-9a-f]{32}"/.test(sw), 'sw.js: טביעה ל־invest-glass.css (swgen)');

/* ---------- מבנה הקובץ ---------- */
ok(/^\s*@layer invglass\s*\{/.test(body), 'השכבה invglass בראש הקובץ (אחריה רק החיפוש בטלפון — מחלקות חדשות)');
let depth = 0, neg = false;
for (const ch of body) { if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth < 0) neg = true; } }
ok(depth === 0 && !neg, 'סוגריים מאוזנים');

/* ---------- הגבלה ל־Invest ---------- */
const rules = body.replace(/@keyframes[^{]+\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g, '').match(/[^{}]+\{[^{}]*\}/g) || [];
const bad = rules.map((r) => r.slice(0, r.indexOf('{')).trim()).filter((sel) => sel && !/^@/.test(sel))
  .filter((sel) => sel.split(/,(?![^(]*\))/).some((s) => { s = s.trim(); return !/^(html|main|:is\(main, \.appbar\)|\.appbar|html:not\(\.dk\) \.appbar|\.tabs|\.menu-veil|\.toast|\.ms(-[a-z0-9]+)?|\.pah(-[a-z0-9-]+)?)(?=[\s:.#[]|$)/.test(s); }));
ok(!bad.length, 'כל כלל מוגבל ל־html / main / ההדר / החוגה / התפריט / ההודעה / מסך החיפוש / ניהול ההתראות' + (bad.length ? ' — חריגים: ' + bad.slice(0, 4).join(' | ') : ''));
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

/* ---------- מנתח החברות וגרף הנרות (17/11/2026) ---------- */
const acI = body.indexOf('מנתח החברות וגרף הנרות') > -1 ? body : css;
const acRules = rules.map((r) => r.slice(0, r.indexOf('{')).trim()).filter((sel) => /\.(an|kc)-/.test(sel));
ok(acRules.length >= 40, 'הסעיפים של הניתוח והגרף בשכבה (' + acRules.length + ' כללים)');
ok(acRules.every((sel) => sel.split(/,(?![^(]*\))/).every((x) => /^html(\[data-theme="dark"\])? (:is\()?\.(an-root|an-sheet|kc-root)|^html(\[data-theme="dark"\])? :is\(\.an-sheet, \.an-root\)|^html \.an-root|^html :is\(\.an-root, \.kc-root\)/.test(x.trim()))),
  'כל כלל של הניתוח/הגרף מוגבל ל־.an-root / .an-sheet / .kc-root');
ok(!/\.ap-[a-z]/.test(css.replace(/-webkit-tap/g, '')), 'בלי מזהי התצוגה המקדימה (html.ap-*) בקובץ');
for (const k of ['grid', 'axis', 'text', 'label', 'vol', 'font', 'r']) ok(new RegExp('html \\{[^}]*--kc-cv-' + k + ':').test(body), 'טוקן הקנבס --kc-cv-' + k + ' מוגדר');
for (const k of ['grid', 'axis', 'label']) ok(new RegExp('html\\[data-theme="dark"\\] \\{[^}]*--kc-cv-' + k + ':').test(body), 'טוקן הקנבס --kc-cv-' + k + ' בכהה');
const cj = R('chart.js');
const pal = (cj.match(/function palette\(\) \{[\s\S]*?\n\}/) || [''])[0];
for (const k of ['text', 'grid', 'axis', 'label', 'font']) ok(new RegExp("tk\\('--kc-cv-" + k + "', ").test(pal), 'palette(): ' + k + ' מטוקן, עם ברירת המחדל הקודמת');
ok(/^\s*font: tk\('--kc-cv-font'/m.test(pal), 'palette(): font בשורה משלו — לא בתוך הערה (עד 17/11 הצירים לא קיבלו את הגופן)');
ok(/vol: \+css\('--kc-cv-vol'\) \|\| 0\.55/.test(pal) && /upColor: rgba\(p\.up, p\.vol\)/.test(cj), 'עמודות הנפח — מהטוקן, ברירת מחדל 0.55');
ok((cj.match(/borderRadius: p\.rad \}/g) || []).length === 2, 'תוויות הסמן — רדיוס מהטוקן');
ok(/'#089981'/.test(pal) && /'#E5E5EA'/.test(pal), 'הפלטות "קלאסי" ו"שחור־לבן" לא השתנו');
const appS = R('app.js');
ok(/kcColApp: 'ברירת מחדל'/.test(appS) && /kcColApp: 'Default'/.test(appS), 'שם הפלטה בהגדרות הגרף — "ברירת מחדל" (בנייה נקייה, לא שם של מוצר)');

/* ---------- חיפוש בטלפון (17/11/2026) ---------- */
const app = R('app.js');
ok(/<button id="msBtn" class="icon-btn" type="button" data-i18n-aria="msAria"/.test(index), 'index.html: כפתור החיפוש בהדר');
ok(/\.appbar \.appbar-actions > #msBtn \{ grid-column: 7;/.test(body), 'הכפתור בעמודה 7 — ליד ☰, לא על כפתור המטבע');
ok(/html\.dk \.appbar #msBtn \{ display: none;/.test(body), 'במחשב הכפתור מוסתר (יש ⌘K)');
/* 20/11/2026 (בקשת המשתמש): כשהתפריט פתוח — הכפתור מתחלף לפעמון ופותח את ניהול כל התראות המחיר */
ok(!/menu-open > #msBtn \{ opacity: 0/.test(body), 'כשהתפריט פתוח — הכפתור לא נעלם');
ok(/btnFacesHTML\(ICON_FIND, ICON_BELL\)/.test(app), 'פני הכפתור: חיפוש / פעמון (אותה החלפה של הגלובוס והמטבע)');
ok(/if \(mainMenuOpen\(\)\) \{ setMainMenuOpen\(false\); openAlertsHub\(\); \} else msOpen\(\);/.test(app), 'בתפריט פתוח — ניהול ההתראות; אחרת — החיפוש');
ok(/msb\.setAttribute\('aria-label', open \? t\('kcPriceAlerts'\) : t\('msAria'\)\)/.test(app), 'התווית הנגישה מתחלפת עם הפנים');
ok(/allAlerts: \(\) => openAlertsHub\(\)/.test(app) && /function allAlertsLink\(sh, inRow\)/.test(cj) && /const al = allAlertsLink\(sh\); if \(al\) b\.appendChild\(al\);/.test(cj) && /allAlertsLink\(sh, true\),\n\s+noteToggle\(note\),\n\s+a0 \? btn\('kc-btn danger'/.test(cj),
  'מכל חלונית התראה (גרף + כרטיס המניה) — קישור "כל ההתראות"; בכרטיס — בשורת הכפתורים, ו"הערה" מימין ל"הסרה"');
ok(/note\.hidden = !note\.value;/.test(cj) && (cj.match(/noteToggle\(note\)/g) || []).length === 3, 'תיבת ההערה מוסתרת עד הנגיעה ב"הערה" (או כשיש הערה)');
ok(/allAlerts: null/.test(app) && /\.kc-root\.kc-float\.kc-over \{ z-index: 960; \}/.test(R('chart.css')) && /^\.pah \{ position: fixed; inset: 0; z-index: 950;/m.test(body),
  'מתוך המסך: בלי קישור לעצמו, והחלונית מעליו');
ok(/export function removeAlert\(sym, id, env\)/.test(cj) && /bgSoon\(\);\n\}/.test(cj.slice(cj.indexOf('export function removeAlert'))), 'מחיקה דרך chart.js — עם סנכרון לרקע');
ok(/modalPush\(\(\) => closeAlertsHub\(true\)\)/.test(app), '"חזור" סוגר את המסך');
{ // הסדר: החברה עם ההתראה הקרובה ביותר ליעד ראשונה; בתוך החברה — מהקרובה לרחוקה, שהופעלו בסוף
  const src = app.slice(app.indexOf('function pahGroups('), app.indexOf('function pahTime('));
  const pahGroups = new Function(src + '; return pahGroups;')();
  const px = (s) => ({ AAA: 100, BBB: 50, CCC: 10 }[s] || 0);
  const g = pahGroups({
    AAA: [{ id: 1, p: 120 }, { id: 2, p: 95 }, { id: 3, p: 99, done: true }],
    BBB: [{ id: 4, p: 51 }],
    CCC: [{ id: 5, p: 5, done: true }],
    DDD: [{ id: 6, p: 7 }],
  }, px);
  ok(g.map((x) => x.s).join() === 'BBB,AAA,DDD,CCC', 'סדר החברות לפי ההתראה הקרובה (בלי מחיר — אחריהן, רק הופעלו — בסוף): ' + g.map((x) => x.s).join());
  ok(g[1].list.map((x) => x.a.id).join() === '2,1,3', 'בתוך החברה: 5% לפני 20%, שהופעלה בסוף');
}
for (const k of ['kcAllAlerts', 'pahEmpty', 'pahEmptySub', 'pahActive', 'pahFired', 'pahPickPh', 'pahFiredAt', 'pahDelQ', 'pahDeleted']) ok(new RegExp('\\n  ' + k + ': ').test(app) && app.split('\n  ' + k + ': ').length === 3, 'מחרוזת ' + k + ' בעברית ובאנגלית');
ok(/\n  initMobileSearch\(\);/.test(app) && /function msOpen\(\)[\s\S]{0,3000}modalPush\(\(\) => msClose\(true\)\)/.test(app), 'נפתח בהפעלה, ו"חזור" סוגר (modalPush)');
ok(/function msOpen\(\)[\s\S]{0,3000}visualViewport/.test(app) && /bottom: calc\(var\(--ms-kb\)/.test(body), 'השדה נצמד מעל המקלדת (visualViewport)');
ok(/function msPaint\(\)[\s\S]{0,2500}deskCmdList\(\)[\s\S]{0,4000}deskInvestCmds\(q\)/.test(app), 'אותו מנוע של לוח הפקודות במחשב');
ok(/function msMark\(label, q\) \{[\s\S]{0,300}esc\(L\.slice\(0, i\)\)/.test(app), 'ההדגשה עוברת esc — בלי HTML מהקלט');
ok(/sc\(it\) >= 60\)\) hits = hits\.filter/.test(app), 'התאמה רופפת רק כשאין התאמה אמיתית');
for (const k of ['msTitle', 'msPh', 'msMarket', 'msNoneSub', 'msClose']) ok((app.match(new RegExp('\\n  ' + k + ': ', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');

/* ---------- 20/11/2026: כל הכרטיסים בזכוכית של כרטיס המניה ---------- */
ok(/main \.card \{ background: var\(--gl-card\) !important;[^}]*box-shadow: var\(--gl-card-sh\) !important;[^}]*border-radius: var\(--radius-xl\)/.test(body), 'כרטיסי העמודים — אותו חומר של כרטיס המניה (--gl-card), לא מילוי אטום');
ok(!/main \.card \{[^}]*--lg-card/.test(body), 'אין מילוי אטום (--lg-card) על כרטיסי העמודים');
ok(/\.stock, \[data-theme="dark"\] \.stock \{ background: var\(--gl-card\)/.test(styles), 'כרטיס המניה עצמו על --gl-card (המקור שהכרטיסים מחקים)');
ok(/html \.an-root :is\(\.an-card, \.an-rcard\) \{ background: var\(--gl-card\)/.test(body), 'מנתח החברות — הכרטיסים באותה זכוכית');
ok(/main \.card :is\(input[^{]*select, textarea\) \{ background: var\(--lg-fill\)[^}]*border-color: transparent/.test(body), 'שדות בתוך כרטיס — מילוי רך בלי מסגרת');

if (fails.length) { console.log('\nנכשלו ' + fails.length + '/' + n + ':\n- ' + fails.join('\n- ')); process.exit(1); }
console.log('\n' + n + '/' + n + ' עברו');
