// ui-v154.test.js — המבורגר פתוח: גלובוס → הגדרות, מטבע → בהיר/כהה, המבורגר → ✕, באנימציה.
// בסגירה הכל חוזר. בלי כפתורים כפולים בתוך התפריט. אותו סגנון כפתור בדיוק.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

ok(!/id="menuSettingsBtn"/.test(html) && !/id="menuThemeBtn"/.test(html), 'אין כפתורי הגדרות/ערכה כפולים בתוך התפריט');
ok(/langBtn\.innerHTML = btnFacesHTML\(ICON_GLOBE, ICON_GEAR\)/.test(src), 'גלובוס ↔ גלגל שיניים');
ok(/btn\.innerHTML = btnFacesHTML\(ICON_MENU, ICON_CLOSE\)/.test(src), 'המבורגר ↔ ✕');
ok(/#curToggleBtn \.face-alt/.test(src) && /resolveTheme\(\) === 'dark' \? ICON_SUN : ICON_MOON/.test(src), 'מטבע ↔ שמש/ירח (הערכה שאליה עוברים)');
ok(/if \(mainMenuOpen\(\)\) \{ e\.stopPropagation\(\); setThemeMode/.test(src), 'תפריט פתוח: כפתור המטבע מחליף ערכה והתפריט נשאר פתוח');
ok(/if \(mainMenuOpen\(\)\) \{\s*setMainMenuOpen\(false\);\s*switchTab\('settings'\)/.test(src), 'תפריט פתוח: הגלובוס פותח הגדרות וסוגר את התפריט');
ok(/acts\.classList\.toggle\('menu-open', open\)/.test(src), 'מצב אחד מרכזי (setMainMenuOpen) — פתיחה, סגירה, Escape, לחיצה בחוץ');
ok(/\.menu-open \.icon-btn \.face-alt \{ opacity: 1; transform: none; \}/.test(css) && /cubic-bezier/.test(css), 'מעבר מונפש (סיבוב+כיווץ+דהייה)');
ok(!/\.menu-open \.icon-btn \{[^}]*background/.test(css), 'אותו סגנון כפתור — בלי צבע רקע אחר במצב תפריט');
ok(/prefers-reduced-motion[\s\S]{0,200}\.icon-btn \.face/.test(css), 'מכבד "הפחת תנועה" במכשיר');
ok(/menuCloseAria: 'סגירת התפריט'/.test(src) && /menuCloseAria: 'Close menu'/.test(src), 'תווית נגישות בעברית ובאנגלית');
const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
console.log('\n' + n + ' בדיקות עברו');
