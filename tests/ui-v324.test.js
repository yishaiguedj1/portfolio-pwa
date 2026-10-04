// v324: QA שלב 3 — מחוות, טפסים ושמירה, דליפות, שינוי גודל/מקלדת, סימון בקורא, ערכת קורא, קישור עמוק; ותיקון ✕ כפול בקורא
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const qa = fs.readFileSync(path.join(root, 'tools', 'qa-motion.js'), 'utf8');
ok(/function readerExit\(\)[^\n]*\n\s*if \(!rd \|\| rd\.closing\) return;/.test(lib), '✕/Escape פעמיים מהר — היציאה השנייה נבלעת (לא שתי חזרות כפולות)');
ok(/const ensureLibSeeded = async \(\) => \{/.test(qa) && (qa.match(/await ensureLibSeeded\(\)/g) || []).length >= 2, 'כלי: זריעת הספרייה משותפת למקטע הספרייה ולשלב 3');
ok(/if \(ONLY === 'ext' \|\| !ONLY\) \{/.test(qa) && /const swipe = async \(x1, y1, x2, y2/.test(qa) && /const swipeY = \(\) =>/.test(qa), 'כלי: מקטע ext עם החלקת מגע מנקודה שאינה חסומה');
['החלקה לעמוד הבא', 'החלקה קצרה — לא מחליפה עמוד', 'החלקה קצרה במעקב = רשימה אחרת', 'הוספת הפקדה (טופס)', 'ההפקדה נוספה ונשמרה אחרי רענון', 'הוספת מניה (טופס)', 'המניה נשמרה אחרי רענון', 'מחיקת המניה (לחיצה ארוכה → אישור)', '6 טאבים מהר', 'כפול מהיר על כרטיס', 'הצרה ל־360×780 עם כרטיס פתוח', 'בדיקת דליפות', 'הגדרות → English', 'קישור עמוק #stock=AAPL', 'סימון טקסט → בועה', 'הדגשה בצבע', 'ההדגשה נשמרה', 'Aa → ערכה שחורה', 'רענון בערכה שחורה', '✕ פעמיים מהר', 'מקלדת (חלון נמוך) בחיפוש'].forEach((k) => ok(qa.includes(k), 'תרחיש: ' + k));
ok(/DEPOSITS\.length/.test(qa) && /DB\.positions\.map/.test(qa), 'ספירות דרך הנתונים (לא דרך DOM במצב עריכה)');
ok(/indexedDB\.open\('snb-library'\)[^\n]*'id-qa-m6'/.test(qa), 'שמירת ההדגשה נבדקת ב־IndexedDB');
console.log('# ' + n + ' בדיקות עברו');
// באגים שנמצאו ב־CPU×4: אחרי לחיצה ארוכה העמוד הבהב (tabIn רץ מחדש) והכרטיס שהוחזר ל־DOM רץ cardIn מחדש
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
ok(/html\.drag-active \.tabpage \{ transform: none !important; \}/.test(css) && !/html\.drag-active \.tabpage \{[^}]*animation: none/.test(css), 'drag-active לא מבטל את אנימציית העמוד (ביטול+החזרה = הרצה מחדש של tabIn)');
ok((app.match(/card\.addEventListener\('animationend', \(\) => card\.classList\.remove\('enter'\), \{ once: true \}\)/g) || []).length === 2, 'מחלקת enter מוסרת אחרי הכניסה (מניות + מעקב) — החזרה ל־DOM לא מריצה cardIn שוב');
console.log('# ' + n + ' בדיקות עברו');
