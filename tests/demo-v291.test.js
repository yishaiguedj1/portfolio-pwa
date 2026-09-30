// v291: תיק הדמו — שורה קבועה בתפריט ההמבורגר; הצעה בראש הסקירה רק כשהחשבון ריק (עד הנתון הראשון, וחוזרת אחרי איפוס)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };
const menu = html.slice(html.indexOf('id="mainMenu"'), html.indexOf('id="cashUsd"'));
ok(/id="menuDemoBtn"/.test(menu) && /data-i18n="demoBtn"/.test(menu), 'שורת "טען תיק דמו" בתפריט ההמבורגר, לפני המזומן');
ok(html.indexOf('id="demoOffer"') > html.indexOf('id="tab-overview"') && html.indexOf('id="demoOffer"') < html.indexOf('ov-stats'), 'ההצעה בראש הסקירה');
ok(html.indexOf('id="demoOffer"') < html.indexOf('id="tab-stocks"'), 'לא בהגדרות');
const ctx = { DB: { positions: [], manualTrades: [], deposits: [], pensionFunds: [], pensionDeposits: [], wishlist: [{ sym: 'AAPL' }] }, ibkrHasImportedData: (d) => !!d, ibkrCfg: () => ({ data: ctx.ibkr }) };
vm.runInNewContext(fn('accountIsEmpty') + ';this.f = accountIsEmpty;', ctx);
ok(ctx.f() === true, 'חשבון ריק (רשימת מעקב לא נחשבת) → ההצעה מוצגת');
for (const k of ['positions', 'manualTrades', 'deposits', 'pensionFunds', 'pensionDeposits']) {
  ctx.DB[k].push({}); ok(ctx.f() === false, 'נתון ב־' + k + ' → ההצעה נעלמת'); ctx.DB[k].length = 0;
}
ctx.ibkr = { positions: [1] }; ok(ctx.f() === false, 'נתוני IBKR → ההצעה נעלמת'); ctx.ibkr = null;
ok(ctx.f() === true, 'אחרי איפוס (שוב ריק) → חוזרת');
ok(/tog\('demoOffer', !on && \(building \|\| accountIsEmpty\(\)\)\)/.test(fn('renderDemoUi')), 'renderDemoUi: ריק או בזמן בנייה, לא במצב דמו');
ok(/if \(isDemoMode\(\)\) \{ demoExit\(\); return; \}/.test(app) && /menuDemoExitSub/.test(fn('renderDemoUi')), 'במצב דמו השורה בתפריט = יציאה מהדמו');
ok(/menuDemoSub: 'האפליקציה במלואה'/.test(app) && /menuDemoSub: 'See the full app'/.test(app), 'מחרוזות בעברית ובאנגלית');
console.log('# ' + n + ' בדיקות עברו');
