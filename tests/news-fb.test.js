/* 15/10/2026: מרכז הניהול ← משוב והודעות — הצד של האפליקציות (core): "מה חדש" מ־CHANGELOG, ההודעה מהמנהל, שורת המשוב */
'use strict';
const fs = require('fs'), path = require('path');
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0;
const ok = (c, m) => { if (!c) { console.error('FAIL - ' + m); process.exit(1); } n++; console.log('ok - ' + m); };
const core = read('core.js');
const changelogItems = new Function(core.match(/function changelogItems[\s\S]*?\n}\n/)[0] + 'return changelogItems;')();
const md = '# x\n## לא פורסם\n- חדש\n## 2.0.0 — 1/1/2027\n- **מרכז הניהול: יומן** — מה ומתי\n- Studio: שני מצבים (Haiku)\n- `קוד` קצר\n- ' + 'א'.repeat(120) + '\n## 1.9.0 — x\n- ישן\n';
const it = changelogItems(md, '2.0.0');
ok(it.join('|') === 'מרכז הניהול: יומן|Studio: שני מצבים|קוד קצר|' + 'א'.repeat(88) + '…', 'מה חדש: רק הגרסה הזו, בלי ** ו־`, רק הכותרת (עד — או סוגריים), עד 90 תווים');
ok(changelogItems(md, '3.0.0').length === 0 && changelogItems(md, '2.0').length === 0, 'מה חדש: גרסה שלא בקובץ — כלום (ו־2.0 לא תופס את 2.0.0)');
ok(changelogItems(read('CHANGELOG.md'), '2.12.0').length >= 3, 'מה חדש: הקובץ האמיתי נקרא');
ok(/if \(!seen \|\| getLang\(\) !== 'he'/.test(core) && /LS_RELSEEN, rel\)/.test(core), 'מה חדש: לא בהתקנה ראשונה, רק בעברית, פעם אחת לכל גרסה');
ok(/an\.apps\.includes\(app\) && get\(LS_ANSEEN\) !== String\(an\.id\)/.test(core) && /setTimeout\(\(\) => newsWhenIdle\(j\.cfg\), 1800\)/.test(core), 'הודעה: רק לאפליקציות שנבחרו, פעם אחת לכל הודעה, אחרי שהדף נפתח');
ok(/id="feedbackOpen"[\s\S]{0,400}data-i18n="fbRowT"/.test(read('index.html')) && /getElementById\('feedbackOpen'\)[\s\S]{0,120}feedbackOpen\(\)/.test(read('app.js')), 'משוב: שורה בהגדרות של Invest');
ok(/f\.id = 'feedbackOpen'[\s\S]{0,400}feedbackOpen\(\)/.test(read('shell.js')), 'משוב: שורה בהגדרות של Academy ו־Studio (advancedRow)');
ok(/op: 'fbSend'/.test(core) && /if \(!tk\) \{ askAlert\(t\('fbSignIn'\)\)/.test(core), 'משוב: נשלח עם טוקן; בלי חיבור — הודעה');
console.log(`\nכל ${n} הבדיקות עברו ✓`);
// 29/10/2026 (סרטון המשתמש — "מה חדש" קפץ באמצע החלקה): מחכה לשקט — 2.5 שנ׳ בלי נגיעה/גלילה/מעבר, והנגיעות נספרות מהפתיחה
ok(/const NEWS_IDLE_MS = 2500;/.test(core) && /function newsIdleWire\(\)/.test(core) && /newsIdleWire\(\);\n  maintPaint/.test(core) && /cubeNow\) \|\| \(typeof _dial !== 'undefined' && \(_dial\.drag \|\| _dial\.ride\)\)\) return setTimeout/.test(core), 'מה חדש: לא באמצע ניווט — מחכה לשקט');
