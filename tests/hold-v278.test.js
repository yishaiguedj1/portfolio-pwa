// v278: לחיצה ארוכה → עריכה/מחיקה (כרטיסים וטאבי רשימות), גרירת טאבי הרשימות, ביטול בלחיצה במקום אחר
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };

// wlOrdered — טהורה
const ctx = {}; vm.runInNewContext(fn('wlOrdered') + ';this.f = wlOrdered;', ctx);
const L = [{ id: 'main' }, { id: 'a' }, { id: 'b' }, { id: 'c' }];
ok(ctx.f(L, []).map((x) => x.id).join() === 'main,a,b,c', 'בלי סדר שמור — סדר היצירה');
ok(ctx.f(L, ['b', 'main', 'a']).map((x) => x.id).join() === 'b,main,a,c', 'סדר שנגרר; רשימה חדשה בסוף');
ok(ctx.f(L, ['zz', 'c']).map((x) => x.id).join() === 'c,main,a,b', 'מזהה שנמחק לא מפריע');
ok(/return wlOrdered\(ls, DB\.wlOrder\);/.test(fn('wlLists')), 'wlLists לפי DB.wlOrder');
ok(/DB\.wlOrder = Array\.isArray\(clean\.wlOrder\)/.test(app) && /DB\.wlOrder = clean\.wlOrder/.test(cloud), 'הסדר נטען מקומית ומהענן');

// כרטיסים
const drag = fn('wireCardDrag');
ok(/if \(!cfg\.canDrag\(\)\) \{[\s\S]{0,220}?cfg\.onHold\(card\)/.test(drag), 'בלי אפשרות גרירה — לחיצה ארוכה ישר לעריכה');
ok(/if \(d\.moved\) \{ try \{ cfg\.onDrop/.test(drag) && /if \(!d\.moved && cfg\.onHold\)/.test(drag), 'שחרור בלי תזוזה = עריכה; גרירה = סדר חדש');
const wire = fn('wireAllCardDrag');
ok(/kind: 'edit'[\s\S]*showEditPositionForm[\s\S]*kind: 'del', fn: \(\) => deletePosition\(p\)/.test(wire), 'תיק: עט = עריכה, X = מחיקה (עם אישור)');
ok(/isIbkrMode\(\) && p\.src !== 'manual'\) \{ flash\(t\('holdIbkrLocked'\)\)/.test(wire), 'מניית IBKR — הודעה, בלי עריכה/מחיקה');
ok(/kind: 'del', fn: \(\) => wlRemove\(\{ sym: card\.dataset\.sym \}\)/.test(wire), 'מעקב: X = הסרה (עם אישור)');
ok(/wireTabDrag\(document\.getElementById\('wlTabs'\)\)/.test(wire), 'טאבי הרשימות מחוברים');

// טאבים
const td = fn('wireTabDrag');
ok(/DB\.wlOrder = \[\.\.\.bar\.querySelectorAll\('\.wl-tab:not\(\.add\)'\)\]/.test(td) && /saveDB\(\)/.test(td), 'גרירת טאב שומרת סדר');
ok(/openWlNameSheet\('rename'\)/.test(td) && /l\.main \? \[\] : \[\{ kind: 'del', fn: \(\) => wlDeleteList\(id\) \}\]/.test(td), 'טאב: עט = שינוי שם, X = מחיקה (לא לרשימה הראשית)');
ok(/flipMove/.test(td) && /wl-tab-ph/.test(td), 'אותו סגנון כמו הכרטיסים: מקום ריק + השכנים מחליקים');

// כפתורים וביטול
const sa = fn('showItemActions');
ok(/'icon-btn act-' \+ a\.kind/.test(sa) && /ICON_EDIT : ICON_CLOSE/.test(sa), 'כפתורים עגולים כמו בהדר: עט ו־X');
ok(/\.item-acts \.act-del \.ic \{ stroke: var\(--loss\); \}/.test(css), 'ה־X באדום');
ok(/document\.addEventListener\('click', \(e\) => \{ if \(_itemActs && _itemActs\.cancelTap\) \{ e\.stopPropagation\(\); e\.preventDefault\(\); clearItemActions\(\); \} \}, true\)/.test(app), 'לחיצה במקום אחר מבטלת ולא עושה פעולה אחרת');
ok(/box\.style\.top = Math\.round\(Math\.max\(8, r\.top - bh - 8\)\)/.test(sa) && /r\.left\)\)\) \+ 'px'/.test(sa), 'הכפתורים צפים ממש מעל, מיושרים לשמאל');
ok(/prefers-reduced-motion[^{]*\{[^}]*\.stock\.holding/.test(css), 'הפחתת תנועה');
console.log('\n' + n + ' בדיקות עברו');
