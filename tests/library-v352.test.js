// v352 (המשתמש: "עדיין יש את הקפיצה" במשיכה משמאל אחרי v350–v351): "חזור" של אנדרואיד בקורא = CloseWatcher —
// בקשת סגירה, לא ניווט בהיסטוריה, ולכן Chrome לא מחליק צילום של הרשומה הקודמת. בלי תמיכה — השומר בהיסטוריה (v350/v351).
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const lib = fs.readFileSync(path.join(__dirname, '..', 'library.js'), 'utf8');
const body = (name) => { const i = lib.indexOf('function ' + name + '('); return lib.slice(i, lib.indexOf('\n}\n', i)); };
const watch = body('readerWatch'), req = body('readerCloseRequest'), rearm = body('readerRearm'), cr = body('closeReader');
ok(/const CW_OK = typeof window !== 'undefined' && typeof window\.CloseWatcher === 'function';/.test(lib), 'זיהוי תמיכה ב־CloseWatcher');
ok(/guard: CW_OK \? 0 : 1/.test(lib), 'עם CloseWatcher — רשומה אחת לקורא, בלי שומר');
ok(/if \(CW_OK\) readerWatch\(\);/.test(lib), 'המאזין נוצר עם הקורא (בתוך הלחיצה)');
ok(/new CloseWatcher\(\)/.test(watch) && /w\.onclose = /.test(watch) && /rd\.cw\.destroy\(\)/.test(watch), 'מאזין אחד בכל רגע — הקודם משוחרר');
ok(/lib-veil:not\(\.out\)/.test(req) && /hideSel\(\)/.test(req) && /hideTr\(\)/.test(req), 'בקשת סגירה סוגרת קודם גיליון / סימון / כרטיס תרגום');
ok(/< BACK_TWICE_MS\) \{ readerExit\(\); return; \}/.test(req) && /flash\(T\('rdBackTwice'\)\)/.test(req) && /readerWatch\(\);\s*$/.test(req.trim() + '\n'), 'ראשון = בועה + מאזין חדש; שני תוך 2 שנ׳ = יציאה');
ok(/if \(CW_OK\) \{ if \(rd && !rd\.cw && !rd\.closing\) readerWatch\(\); return; \}/.test(rearm), 'נגיעה בספר מחדשת מאזין חסר (הפעלת משתמש)');
ok(/if \(r\.cw\) r\.cw\.destroy\(\)/.test(cr), 'סגירת הקורא משחררת את המאזין');
ok(/rd && !rd\.armed && !CW_OK/.test(lib), 'עם CloseWatcher — בלי רשומת קורא שנייה (readerArm)');
console.log(n + ' בדיקות עברו');
