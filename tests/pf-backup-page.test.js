// 14/10/2026 (בקשת המשתמש): הגיבוי ל־Google Drive נפתח כעמוד משנה של ההגדרות — כמו עמוד הגיבוי של הספרייה, לא כגיליון
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const app = read('app.js'), html = read('index.html'), css = read('styles.css');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };
const page = html.slice(html.indexOf('id="tab-backup"'), html.indexOf('</section>', html.indexOf('id="tab-backup"')));
ok(page && /class="tabpage"/.test(html.slice(html.indexOf('id="tab-backup"') - 60, html.indexOf('id="tab-backup"') + 40)), 'עמוד #tab-backup');
ok(/id="pfbkBack"[\s\S]*data-i18n="tabSettings"/.test(page) && /id="pfbkTitleEl" data-i18n="pfbkTitle"/.test(page) && /id="pfbkBody"/.test(page), 'חזרה להגדרות, כותרת גדולה, גוף העמוד');
ok(/class="pfbk-hero"[\s\S]*data-i18n="pfbkWhat"/.test(page), 'בראש העמוד: סמל + משפט (כמו בספרייה)');
ok(!/pfbkVeil/.test(html + app) && !/PfbkSheet/.test(app), 'הגיליון הוסר');
ok(/id="pfbkOpen" class="row-link"/.test(html) && /o\.addEventListener\('click', openPfbkPage\)/.test(fn('wirePfbkPage')) && /switchTab\('backup'\)/.test(fn('openPfbkPage')), 'השורה בהגדרות פותחת את העמוד');
ok(/bk\.addEventListener\('click', \(\) => switchTab\('settings'\)\)/.test(fn('wirePfbkPage')), '"‹ הגדרות" חוזר');
ok(/TAB_ORDER = \[[^\]]*'advanced', 'backup'\]/.test(app) && /backup: pfbkPaint/.test(fn('tabRenderer')), 'בסדר הטאבים, ומצויר כשנפתח');
ok(/currentTabName\(\) !== 'backup'\) return;/.test(fn('pfbkPaint')), 'לא מצייר כשהעמוד סגור (רק התווית בהגדרות)');
const ctx = {};
vm.runInNewContext("const TAB_ORDER = ['overview', 'stocks', 'trades', 'wishlist', 'deposits', 'pension', 'settings', 'advanced', 'backup'];" +
  (app.match(/const PAGE_SWIPE_MAIN = [^\n]+/) || [''])[0] + fn('pageSwipeTarget') + ';this.f = pageSwipeTarget; this.m = PAGE_SWIPE_MAIN;', ctx);
ok(ctx.f('backup', false) === 'settings' && ctx.f('backup', true) === null && ctx.m.indexOf('backup') < 0, 'החלקה אחורה → הגדרות; קדימה — כלום');
ok(/modalPush\(/.test(fn('pfbkRsOpen')) && /modalDone\(/.test(fn('pfbkRsClose')) && /pfbkRsOpen\(/.test(fn('pfbkRestore')), 'מסך השחזור — "חזור" של המכשיר סוגר אותו');
ok(/prev === 'backup' && name !== 'backup' && _pfbkRs\) pfbkRsClose\(\)/.test(fn('switchTab')), 'יציאה מהעמוד סוגרת את מסך השחזור');
ok(/\.pfbk-hero \{/.test(css) && /\.pfbk-sec \{/.test(css) && /\.pfbk-big \{/.test(css), 'עיצוב העמוד');
for (const k of ['pfbkItemsN', 'pfbkSecRestore', 'pfbkRsNote']) ok((app.match(new RegExp('\\b' + k + ': ', 'g')) || []).length === 2, 'מחרוזת ' + k + ' בעברית ובאנגלית');
console.log('# ' + n + ' בדיקות עברו');
