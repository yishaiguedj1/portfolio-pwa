// v290: "חזור" של המכשיר — מתקדמות → הגדרות → סקירה → יציאה (רשומות בהיסטוריה לפי עומק)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };
// היסטוריה מדומה
const H = { stack: [{ state: null }], i: 0, pops: 0,
  get state() { return this.stack[this.i].state; },
  pushState(s) { this.stack = this.stack.slice(0, this.i + 1); this.stack.push({ state: s }); this.i++; },
  go(d) { this.i += d; this.pops++; } };
const ctx = { history: H };
vm.runInNewContext('let _navSkipPop = 0, _backPending = 0; const _afterBack = [];' + fn('afterBack') + fn('navBack') + fn('navDepth') + fn('navTabForDepth') + fn('navCurDepth') + fn('navSync') + ';this.sync = navSync; this.tab = navTabForDepth; this.skip = () => _navSkipPop;', ctx);
ctx.sync('settings'); ok(H.stack.length === 2 && H.state.snb === 1, 'הגדרות = רשומה ברמה 1');
ctx.sync('advanced'); ok(H.stack.length === 3 && H.state.snb === 2, 'מתקדמות = רשומה ברמה 2');
ok(ctx.tab(1) === 'settings' && ctx.tab(0) === 'overview' && ctx.tab(2) === 'advanced', 'חזור: מתקדמות → הגדרות → סקירה');
ctx.sync('stocks'); ok(H.i === 0 && H.pops === 1 && ctx.skip() === 1, 'מעבר ישיר לטאב ראשי מקצר את ההיסטוריה (בלי לטפל ב־popstate שלו)');
ctx.sync('stocks'); ok(H.pops === 1 && H.stack[H.i].state === null, 'טאב ראשי → טאב ראשי: בלי רשומות');
ok(/navSync\(name, opts\); \/\/ v290/.test(fn('switchTab')) && /if \(\(opts && opts\.fromPop\)/.test(fn('navSync')), 'switchTab מסנכרן; מעבר מ־popstate לא יוצר רשומה');
ok(/_navSkipPop\+\+; \/\/ v290/.test(fn('dropAppNavEntry')), 'חזרה פנימית מקישור הווידג׳ט לא נחשבת "חזור" של המשתמש');
ok(!/history\.replaceState\(null,/.test(app), 'ניקוי ה־hash שומר את מצב ההיסטוריה');
ok(/wireBackNav\(\); \/\/ v290/.test(app), 'מאזין popstate מחובר');
console.log('# ' + n + ' בדיקות עברו');
