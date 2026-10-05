// v329: סרט סימנייה בעיצוב קינדל — תמיד בראש העמוד, מתאר אפור כשכבוי, ירוק מלא כשפעיל, אנימציה בשלבים
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const lib = fs.readFileSync(path.join(root, 'library.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'library.css'), 'utf8');
ok(/const ribbon = h\('button', 'rd-ribbon'\);[\s\S]{0,300}ribbon\.innerHTML = RIBBON_SVG;[\s\S]{0,120}toggleBookmark\(\)/.test(lib), 'הסרט הוא כפתור — נגיעה מוסיפה/מסירה סימנייה');
ok(/e\.stopPropagation\(\); toggleBookmark\(\)/.test(lib), 'נגיעה בסרט לא פותחת/סוגרת את הסרגלים');
ok(/class="rb-out"[\s\S]{0,80}class="rb-fill"/.test(lib), 'שתי שכבות: מתאר + מילוי');
ok(!/\.rd-ribbon \{[^}]*opacity: 0/.test(css) && !/\.rd\.chrome \.rd-ribbon \{ opacity: 0/.test(css), 'תמיד גלוי (גם כשאין סימנייה, גם כשהסרגל פתוח)');
ok(/\.rd-ribbon \.rb-out \{ fill: var\(--rd-page[^}]*stroke: color-mix\(in srgb, var\(--rd-ink2/.test(css), 'כבוי: מתאר אפור בצבע הדף (מתאים לכל ערכות הקורא)');
ok(/\.rd-ribbon \.rb-fill \{ fill: var\(--primary\)/.test(css) && /\.rd-ribbon\.on \.rb-fill \{ clip-path: inset\(0 0 0 0\); \}/.test(css), 'פעיל: ירוק מלא (הירוק של הכפתורים)');
ok(/\.rd\.chrome \.rd-ribbon \{ top: calc\(61px/.test(css), 'סרגל פתוח — הסרט יורד מתחתיו');
ok(/@keyframes rbDrop/.test(css) && /@keyframes rbPour/.test(css) && /@keyframes rbDrain/.test(css) && /@keyframes rbRise/.test(css), 'אנימציה בשלבים: נשמט + נשפך / מתרוקן + מתקפל');
ok(/if \(animate && was !== on && !reduceMotion\(\)\)/.test(lib) && /markBookmark\(true\);\s*if \(typeof flash/.test(lib) && /else markBookmark\(true\);/.test(lib), 'אנימציה רק בפעולת המשתמש (לא בהחלפת עמוד), גם בהסרה');
ok(/rb\.setAttribute\('aria-pressed', String\(on\)\)/.test(lib), 'נגישות: aria-pressed + תווית לפי המצב');
ok(/prefers-reduced-motion: reduce\) \{ \.rd-ribbon, \.rd-ribbon svg/.test(css), 'reduced-motion');
console.log('# ' + n + ' בדיקות עברו');
