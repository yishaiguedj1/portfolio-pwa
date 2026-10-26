// נתוני Damodaran למנתח החברות (26/10/2026): הקובץ שהשרתון מגיש שלם, והעדכון החודשי האוטומטי בטוח.
// הרצה: node tests/damodaran-tool.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

let n = 0;
const ok = (c, name) => { n++; assert(c, name); console.log('ok -', name); };
const root = path.join(__dirname, '..');
const D = JSON.parse(fs.readFileSync(path.join(root, 'ibkr-proxy/lib/damodaran.json'), 'utf8'));
const py = fs.readFileSync(path.join(root, 'tools/damodaran.py'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/damodaran.yml'), 'utf8');
const req = fs.readFileSync(path.join(root, 'tools/damodaran-requirements.txt'), 'utf8');

/* --- הקובץ --- */
ok(D.erp >= 0.02 && D.erp <= 0.09 && /^\d{4}-\d{2}-\d{2}$/.test(D.erpDate), 'פרמיית השוק סבירה ועם תאריך');
ok(D.crpIL > 0 && D.crpIL < 0.1 && D.taxIL > 0 && D.ratingIL, 'פרמיית ישראל, מס ודירוג');
const ind = D.ind || {}, names = Object.keys(ind);
ok(names.length >= 80 && ind['Total Market'] && ind['Total Market (without financials)'], 'כל הענפים, כולל השוק כולו');
const banks = ind['Bank (Money Center)'];
ok(banks && banks.bl > 0 && banks.bu > 0 && banks.roe > 0 && banks.pbv > 0, 'לבנקים: בטא ממונפת, ROE ו־P/B (השווי לפי עודף תשואה)');
ok(names.every((k) => ind[k].bu == null || (ind[k].bu > 0 && ind[k].bu < 5)), 'בטא לא ממונפת בטווח סביר בכל הענפים');

/* --- הכלי --- */
ok(/ERP_COL = 'ERP \(T12 m with sustainable payout\)'/.test(py), 'ה־ERP — מהעמודה של Damodaran עצמו');
ok(/0\.02 <= v <= 0\.09/.test(py), 'ERP לא סביר לא נכנס');
ok(/0\.85 \* len\(old\.get\('ind'\)/.test(py) && /sys\.exit\(1\)/.test(py), 'ירידה גדולה במספר הענפים = לא דורסים');
ok(/same = /.test(py) && /k != 'asOf'/.test(py), 'כותב רק כשמשהו השתנה (בלי קומיט רק בגלל התאריך)');
ok(/b'PK'/.test(py), 'דף שגיאה במקום קובץ — לא נשמר');

/* --- ה־workflow --- */
ok(/cron: '\d+ \d+ 3 \* \*'/.test(wf), 'רץ פעם בחודש, ב־3 לחודש');
ok(/permissions:\s*\n\s*contents: write/.test(wf) && !/secrets\./.test(wf), 'רק כתיבה לריפו, בלי סודות');
ok((wf.match(/uses: [^@\s]+@[0-9a-f]{40}/g) || []).length === (wf.match(/uses: /g) || []).length, 'כל action מקובע ל־SHA');
ok(/--require-hashes -r tools\/damodaran-requirements\.txt/.test(wf), 'התלויות עם hash');
ok(req.split('\n').filter((l) => /^[a-z]/i.test(l)).every((l) => /==[\d.]+ --hash=sha256:[0-9a-f]{64}$/.test(l)), 'כל תלות בגרסה נעולה ועם hash');
ok(/git add ibkr-proxy\/lib\/damodaran\.json\n/.test(wf) && !/git add -A|git add \./.test(wf), 'מוסיף רק את קובץ הנתונים');
ok(wf.indexOf('analyzer still works') < wf.indexOf('commit if changed'), 'הבדיקות לפני הדחיפה');

console.log(`\nכל ${n} בדיקות נתוני Damodaran עברו`);
