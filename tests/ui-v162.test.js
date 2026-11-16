// ui-v162.test.js — דמו: לא נכשל כש־Yahoo מגביל, מסך טעינה עם שלבים ופס התקדמות, שערי מט"ח משלימים אחורה.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
ok(/try \{ j = await ackFetch\('', 45000\); \}/.test(src) && /ui\.fail\(err === 'not_ready' \? t\('ackNotReady'\) : t\('demoFail'\)\)/.test(src), 'v783: תיק הדמו (אקמן) — הספר מהשרתון בבקשה אחת; עוד לא מוכן — הודעה ברורה');
ok(/\} catch \(e\) \{\s*ui\.fail\(t\('demoFail'\)\);/.test(src), 'שגיאה לא צפויה — הודעה במסך, לא קריסה שקטה');
ok(/\[t\('demoStepPrices'\), t\('demoStepFx'\), t\('demoStepBuild'\), t\('demoStepSave'\)\]/.test(src), 'ארבעה שלבים');
for (const k of ['demoProgTitle', 'demoStepPrices', 'demoStepFx', 'demoStepBuild', 'demoStepSave', 'demoStepOf', 'btnClose']) {
  ok((src.match(new RegExp('\\n  ' + k + ': ', 'g')) || []).length === 2, 'מחרוזת בעברית ובאנגלית: ' + k);
}
ok(/const v = Math\.max\(ctl\.shown, Math\.min\(1, f \|\| 0\)\);/.test(src), 'הפס לא חוזר אחורה');
ok(/role="progressbar"/.test(src) && /aria-live/.test(src), 'נגישות: progressbar + aria-live');
ok(/\.demo-step\[data-state="now"\] \.ds-dot \{[^}]*animation: dsSpin/.test(css) && /\.demo-step\[data-state="done"\] \.ds-dot \{[^}]*background: var\(--primary\)/.test(css), 'שלב פעיל מסתובב, שלב שהושלם ירוק עם ✓');
ok(/\.demo-prog-bar span \{[^}]*transition: width/.test(css), 'פס מונפש');
ok(/prefers-reduced-motion: reduce\) \{\s*\.demo-step\[data-state="now"\]/.test(css), 'מכבד "הפחת תנועה"');
ok(/const tooShort = \(c\) =>/.test(src) && /firstHave <= addDaysISO\(earliest, 10\)/.test(src), 'שערי מט"ח: מטמון קצר מדי מושלם אחורה');
console.log('\n' + n + ' בדיקות עברו');
