// v325: QA שלב 4+5 בכלי המדידה — ניתוב /api/ כללי נרשם ראשון (אחרת כל הסטאבים החזירו 503), אופליין עם Service Worker, דמו, גרפים,
// איפוס/IBKR/פנסיה, ספרייה לעומק, עומס, נגישות, מחירים מתגלגלים, מצבי סשן, הזרקת כשלים, צילומי בסיס
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const qa = fs.readFileSync(path.join(root, 'tools', 'qa-motion.js'), 'utf8');
const iCatch = qa.indexOf("await ctx.route(/\\/api\\//, (r) => J(r, { ok: false }, 503));"), iQuotes = qa.indexOf("await ctx.route(/\\/api\\/quotes/");
ok(iCatch > 0 && iQuotes > 0 && iCatch < iQuotes, 'הניתוב הכללי של /api/ נרשם לפני הסטאבים (ב־Playwright המאוחר גובר)');
ok(/const LIVE = \{ tick: 0, fail: false, slowHist: false \}/.test(qa) && /LIVE\.tick\+\+/.test(qa) && /Math\.sin\(LIVE\.tick \/ 3/.test(qa), 'המחירים זזים בכל בקשה (ספרות מתגלגלות בזמן המדידה)');
ok(/const SESSION = String\(arg\('session', 'CLOSED'\)\)/.test(qa) && /x: \{ state: SESSION/.test(qa), 'מצב הסשן בציטוט נשלט מהשורה (--session PRE|POST|OVERNIGHT|REGULAR)');
ok(/if \(LIVE\.fail\) return J\(r, \{ ok: false \}, 503\)/.test(qa) && /LIVE\.slowHist/.test(qa), 'הזרקת כשל רשת והיסטוריה איטית מתוך הצעדים');
ok(/serviceWorkers: 'allow'/.test(qa) && /ctx2\.setOffline\(true\)/.test(qa) && /let page = await ctx\.newPage\(\)/.test(qa), 'מקטע אופליין בהקשר נפרד עם Service Worker');
ok(/SNAP = arg\('snap', ''\), COMPARE = arg\('compare', ''\)/.test(qa) && /const snap = async \(name\) =>/.test(qa), 'צילומי בסיס והשוואה (--snap / --compare)');
ok(/scrollIntoView\(\{ block: 'center', behavior: 'instant' \}\)/.test(qa), 'pre: גלילה למרכז (שורת הטאבים מכסה אלמנט בתחתית)');
['אופליין — ניתוק הרשת ורענון', 'אופליין — הספרייה נפתחת מהמטמון', 'דמו — טעינה מהתפריט', 'דמו — יציאה', 'גרף הביצועים — שתי אצבעות', 'גרף המניה — אצבע אחת', 'חלון אישור → ביטול', 'IBKR — פרטי חיבור שגויים', 'הוספת קרן פנסיה', 'הסתרת מכתב', 'שחזור המכתב המוסתר', 'שינוי כותרת ושמירה', 'שחזור מהקובץ', 'חיפוש בטקסט', 'קפיצה לתוצאה', 'תוכן עניינים → פרק 2', 'סימנייה — הוספה', 'Aa → מצב גלילה', 'ייבוא 50 ספרים נוספים', 'נגישות —', 'ביצועים — טעינה קרה', '12 שניות מחירים מתגלגלים', 'היסטוריה איטית', 'כשל מחירים → סימון "דיליי"/stale', 'ערכה כהה עם כרטיס פתוח', 'הוספת SPX', 'TEVA.TA — מחיר באגורות', 'ערכה כהה בספרייה', 'פתיחת כרטיס < 1200ms'].forEach((k) => ok(qa.includes(k), 'תרחיש: ' + k));
// ext4 (שלב 6) + מדד ריצוד מדויק יותר
ok(/if \(ONLY === 'ext4' \|\| !ONLY\) \{/.test(qa) && (qa.match(/ONLY !== 'ext3' && ONLY !== 'ext4'( && ONLY !== 'studio')?\)/g) || []).length === 2, 'מקטע ext4 קיים (--only ext4) ומקטעי app/lib לא רצים איתו');
['ערוך (מהכרטיס) → טופס', 'מכירה בלי אחזקה → שגיאת ולידציה', 'מכירת יתר → שגיאה', 'עריכת העסקה (שורה) → כמות 7', 'מחיקת העסקה (אישור)', 'עריכת הפקדה (שורה) → סכום +1', 'מחיקת הפקדה (אישור)',
 'מעקב → רשימה חדשה "QA"', 'שינוי שם → QA2', 'לחיצה ארוכה על הטאב → מחיקת הרשימה (אישור)', 'סקירה — נגיעה בעוגה (הרמת פרוסה)', 'גרף רווח — נגיעה בפס', 'מטבע → ₪', '20 טאבים ב־80ms',
 'כרטיס פתוח + 10 שניות חיים — צמתי DOM יציבים', 'לחיצה ארוכה → אסופה חדשה "אסופת QA"', '⋯ → מחיקת האסופה (אישור)', 'סימון → הערה (גיליון) → שמירה', 'סימון → תרגום (סטאב) → תוצאה', 'סימון → ציטוט (כרטיס תמונה)',
 '"מה למדתי" מציג את ההערה', 'הגדרות — ניווט במקלדת (Tab) → Enter על "מתקדמות"'].forEach((n) => ok(qa.includes("'ext4: " + n + "'"), 'תרחיש ext4: ' + n));
ok(qa.includes("ctx.route(/\\/api\\/translate/, (r) => setTimeout(() => J(r, { ok: true, translation: 'תרגום בדיקה'"), 'סטאב תרגום בשרתון המדומה');
ok(/'rev': round\(rev, 2\)/.test(qa) && /r\.diff > 18 && r\.rev < 4/.test(qa), 'ריצוד = קפיצה חדה שמחזירה את התוכן (rev<4) — פריים כפול באנימציה לא נספר');
ok(/opt\.gap \|\| 250/.test(qa), 'תקציב פריימים לצעד (gap)');
ok(/vp\.height - 64/.test(qa) && /מחוץ למסך\/מתחת לשורת הטאבים/.test(qa), 'hold זורק שגיאה ברורה כשהנקודה מתחת לשורת הטאבים');
console.log('# ' + n + ' בדיקות עברו');
