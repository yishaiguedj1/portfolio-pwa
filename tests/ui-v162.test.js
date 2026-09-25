// ui-v162.test.js — דמו: לא נכשל כש־Yahoo מגביל, מסך טעינה עם שלבים ופס התקדמות, שערי מט"ח משלימים אחורה.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
ok(/await pool\(missing, 6, async \(s\) => \{/.test(src), 'v163: רק מה שהשרת לא החזיר — ישירות, 6 במקביל');
ok(/if \(!h\.length\) h = state\.hist\[s\] \|\| \[\];/.test(src), 'נופלים למטמון הקיים');
ok(/const db = got >= 4/.test(src), 'מספיקות 4 מניות כדי לבנות דמו');
ok(/if \(iso < h\[0\]\.date\) \{ if \(bought\) continue; iso = h\[0\]\.date; \}/.test(src), 'היסטוריה קצרה: הקנייה הראשונה ביום הראשון שיש');
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
