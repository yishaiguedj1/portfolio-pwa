// v297: חלון אישור/הודעה שלנו במקום confirm/alert של הדפדפן (בלי "…github.io says") + כרטיס החשבון בסגנון Apple ID
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };

// אין confirm/alert/prompt של הדפדפן מחוץ לנפילה של askConfirm (סביבה בלי DOM)
const body = fn('askConfirm');
const rest = (app.replace(body, '') + '\n' + cloud).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
ok(!/(^|[^.\w])(confirm|alert|prompt)\(/m.test(rest), 'אין confirm/alert/prompt של הדפדפן בקוד (רק askConfirm/askAlert)');
ok(/askConfirmP\(t\('demoConfirm'\)\)/.test(app), 'תיק הדמו — גרסת Promise');

// נפילה סינכרונית בלי DOM — ההתנהגות בבדיקות לא משתנה
let asked = [];
const sb = { t: (k) => k, confirm: (m) => { asked.push(m); return sb._yes; }, alert: (m) => asked.push('A:' + m), document: { getElementById: () => null }, _yes: true };
vm.createContext(sb);
vm.runInContext(fn('dlgAvailable') + '\nlet _dlgClose = null;\n' + body + '\n' + fn('askAlert') + '\n' + fn('askConfirmP') + ';this.askConfirm = askConfirm; this.askAlert = askAlert; this.askConfirmP = askConfirmP;', sb);
let hit = 0;
sb.askConfirm('X', () => hit++);
ok(hit === 1 && asked[0] === 'X', 'בלי DOM: אישור → הפעולה רצה מיד (סינכרוני)');
sb._yes = false; let no = 0;
sb.askConfirm('Y', () => hit++, { onNo: () => no++ });
ok(hit === 1 && no === 1, 'בלי DOM: ביטול → הפעולה לא רצה, onNo נקרא');
sb.askAlert('Z');
ok(asked.includes('A:Z'), 'askAlert בלי DOM → alert');
sb._yes = true;
sb.askConfirmP('P').then((v) => {
  ok(v === true, 'askConfirmP מחזיר true באישור');
  // עיצוב: בלי כותרת, קפסולת זכוכית, גלולות
  ok(!/dlg-title|dlg-head/.test(body) && /className = 'dlg-msg'/.test(body), 'בלי כותרת — רק הטקסט');
  ok(/\.dlg \{[^}]*width: fit-content/.test(css) && /\.dlg \{[^}]*backdrop-filter/.test(css), 'בגודל התוכן, זכוכית כמו ה־Toast');
  ok(/\.dlg-ok\.danger \{[^}]*var\(--loss\)/.test(css) && /\.dlg-ok \{[^}]*var\(--primary\)/.test(css), 'אישור ירוק, פעולה הרסנית אדומה');
  ok(/Escape/.test(body) && /e\.target === veil/.test(body), 'Esc / נגיעה ברקע = ביטול');
  // כרטיס החשבון
  ok(/class="acc-id"/.test(cloud) && /'acc-out', OUT_IC, t\('signOut'\), signOut/.test(cloud), 'חשבון: תמונה+שם+מייל, התנתקות כשורת רשימה אדומה');
  ok(/t\('localModeTitle'\), t\('localModeSub'\)/.test(cloud) && /localModeTitle: 'Local mode'/.test(app), 'מצב מקומי: כותרת + שורת משנה (עברית ואנגלית)');
  ok(/#accountCard > h2 \{ display: none; \}/.test(css), 'בלי הכותרת "החשבון שלי"');
  console.log('# ' + n + ' בדיקות עברו');
});
