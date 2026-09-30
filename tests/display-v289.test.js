// v289: כרטיס "תצוגה" מאוחד — שפה (עברית/English/מערכת) → ערכת נושא → מטבע ($ / ₪), שלושה בוררים זהים
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };
const c0 = html.indexOf('class="card display-card"'), card = html.slice(c0, html.indexOf('</div>\n\n', c0));
const iL = card.indexOf('id="langHe"'), iT = card.indexOf('id="themeLight"'), iC = card.indexOf('id="curUSD"');
ok(c0 > 0 && iL > 0 && iT > iL && iC > iT, 'סדר: שפה → ערכת נושא → מטבע, בכרטיס אחד');
ok(/id="langSystem"/.test(card) && /id="curILS"/.test(card), 'שפה עם "מערכת"; מטבע עם שתי האפשרויות');
ok((card.match(/class="lang-toggle"/g) || []).length === 3, 'שלושה בוררים באותו עיצוב');
ok(!/data-i18n="langTitle">שפה<\/span> \/ Language<\/h2>/.test(html) && !/id="setCurBtn"/.test(html), 'כרטיס השפה הנפרד וכפתור המטבע הישן הוסרו');
const ctx = { localStorage: { v: null, getItem() { return this.v; } }, navigator: { languages: ['he-IL'] } };
vm.runInNewContext("const LS_LANG = 'pwa_lang_v1';" + fn('getLang') + fn('getLangMode') + fn('systemLang') + ';this.g = getLang; this.m = getLangMode; this.s = systemLang;', ctx);
ok(ctx.m() === 'he' && ctx.g() === 'he', 'ברירת מחדל: עברית');
ctx.localStorage.v = 'system';
ok(ctx.m() === 'system' && ctx.g() === 'he', 'מערכת בטלפון בעברית → עברית');
ok(ctx.s(['en-US']) === 'en' && ctx.s(['iw']) === 'he' && ctx.s(['ru-RU', 'he']) === 'en', 'מערכת: עברית רק כשהיא השפה הראשונה במכשיר, אחרת אנגלית');
ctx.localStorage.v = 'en';
ok(ctx.g() === 'en', 'אנגלית נשמרת');
ok(/curUsdOpt: '\$ דולר', curIlsOpt: '₪ שקל'/.test(app) && /curUsdOpt: '\$ Dollar', curIlsOpt: '₪ Shekel'/.test(app), 'מחרוזות המטבע בעברית ובאנגלית');
// גרסה + ניקוי מטמון עברו לעמוד "אפשרויות מתקדמות" (רשימה בסגנון iOS); שורת "מחובר — הנתונים נשמרים בענן" הוסרה
const adv = html.slice(html.indexOf('id="tab-advanced"'));
const acc = html.slice(html.indexOf('id="accountCard"'), html.indexOf('</div>', html.indexOf('id="accountCard"')));
ok(/id="appInfoCard"[\s\S]*id="appVersion"[\s\S]*id="clearCache"/.test(adv) && !/id="appVersion"|id="clearCache"/.test(acc), 'גרסה + ניקוי מטמון בעמוד המתקדם, לא בכרטיס החשבון');
ok(!/t\('cloudConnected'\)/.test(fs.readFileSync(path.join(root, 'cloud.js'), 'utf8')), 'שורת "מחובר — הנתונים נשמרים בענן" הוסרה');
ok(/verEl\.textContent = APP_VERSION;/.test(app) && /versionLbl: 'גרסה'/.test(app) && /versionLbl: 'Version'/.test(app), 'שורת "גרסה" — תווית + ערך');
{ const css = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8'); ok(/\.display-card \.lang-opt\.active \{[^}]*background: var\(--primary\)[^}]*color: var\(--on-primary\)/.test(css), 'v293: הבחירה בכרטיס התצוגה בירוק הראשי'); }
console.log('# ' + n + ' בדיקות עברו');
