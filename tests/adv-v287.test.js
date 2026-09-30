// v287: "אפשרויות מתקדמות" — שורה בהגדרות (מתחת ל"תצוגה") שפותחת עמוד משלה; הווידג׳ט עבר לעמוד
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };
const set = html.slice(html.indexOf('id="tab-settings"'), html.indexOf('id="tab-advanced"'));
const iDisp = set.indexOf('data-i18n="displayTitle"'), iAdv = set.indexOf('id="advancedCard"'), iIbkr = set.indexOf('id="ibkrCard"');
ok(iDisp > 0 && iAdv > iDisp && iIbkr > iAdv, 'בהגדרות: תצוגה → אפשרויות מתקדמות → IBKR');
ok(/id="advancedOpen"[\s\S]*data-i18n="advancedTitle"/.test(set) && !/id="widgetCard"/.test(set), 'בהגדרות רק שורת קישור; הווידג׳ט לא שם');
const pg = html.slice(html.indexOf('id="tab-advanced"'));
ok(/class="tabpage"/.test(html.slice(html.indexOf('id="tab-advanced"') - 60, html.indexOf('id="tab-advanced"') + 40)) && /id="advancedBack"/.test(pg) && /id="widgetCard"/.test(pg), 'עמוד advanced: חזרה + כרטיס הווידג׳ט');
ok(/advancedTitle: 'אפשרויות מתקדמות'/.test(app) && /advancedTitle: 'Advanced options'/.test(app), 'מחרוזת בעברית ובאנגלית');
ok(/getElementById\('advancedOpen'\)[\s\S]{0,200}switchTab\('advanced'\)/.test(app) && /advB\.addEventListener\('click', \(\) => switchTab\('settings'\)\)/.test(app), 'פתיחה וחזרה');
ok(/advanced: renderSettingsLive/.test(app) && /currentTabName\(\) !== 'advanced' && !tabShouldRender\('settings'\)/.test(fn('renderSettingsLive')), 'הווידג׳ט מצויר כשהעמוד פתוח');
const ctx = {};
vm.runInNewContext("const TAB_ORDER = ['overview', 'stocks', 'trades', 'wishlist', 'deposits', 'pension', 'settings', 'advanced'];" +
  "const PAGE_SWIPE_MAIN = TAB_ORDER.filter((t) => t !== 'settings' && t !== 'advanced');" + fn('pageSwipeTarget') + ';this.f = pageSwipeTarget;', ctx);
ok(ctx.f('advanced', false) === 'settings' && ctx.f('advanced', true) === null, 'החלקה אחורה מהעמוד → הגדרות; קדימה — כלום');
ok(ctx.f('pension', true) === 'settings' && ctx.f('settings', true) === null, 'העמוד לא נכנס לסבב העמודים הראשיים');
ok(/PAGE_SWIPE_MAIN = TAB_ORDER\.filter\(\(t\) => t !== 'settings' && t !== 'advanced'\)/.test(app), 'advanced מחוץ לעמודים הראשיים');
console.log('# ' + n + ' בדיקות עברו');
