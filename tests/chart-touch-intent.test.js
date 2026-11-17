// 17/11/2026 (בקשת המשתמש — לפי ת־גרף): אצבע על גרף בזמן גלילת הדף לא נוגעת בסימון; הסימון נדלק רק בכוונה —
// הקשה, החזקה או גרירה לרוחב. גרף הביצועים, גרף המניה, העוגה, פסי התשואה והדוחות הקרובים.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const fn = (name) => { const i = app.indexOf('function ' + name + '('); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && !--d) return app.slice(i, k + 1); } return ''; };

// הכוונה — טהורה
const ictx = {};
vm.runInNewContext(fn('tgIntent') + ';this.f = tgIntent;', ictx);
const I = ictx.f;
ok(I(0, 0, 0) === 'wait' && I(3, 4, 200) === 'wait', 'בלי תזוזה ובלי החזקה — מחכים');
ok(I(2, -30, 40) === 'scroll' && I(5, 9, 10) === 'scroll', 'תזוזה אנכית — גלילה של הדף');
ok(I(-12, 4, 30) === 'scrub' && I(9, 8, 0) === 'scrub', 'תזוזה לרוחב — סימון');
ok(I(1, 1, 350) === 'scrub' && I(1, 1, 349) === 'wait', 'החזקה של 350ms — סימון');

// השער — אירועים מדומים
const mk = () => { const h = {}; return { h, addEventListener: (t, f) => { (h[t] = h[t] || []).push(f); }, emit(t, e) { for (const f of h[t] || []) f(e); } }; };
const el = mk(), doc = mk();
const log = [];
let now = 1000;
const timers = [];
const gctx = { document: doc, Date: { now: () => now }, setTimeout: (f, ms) => { timers.push({ f, at: now + ms }); return timers.length; }, clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].f = null; } };
vm.runInNewContext(fn('tgIntent') + 'let _tgScrollT = 0;' + fn('touchGate') + ';this.g = touchGate;', gctx);
gctx.g(el, { down: (e) => log.push('down:' + e.id), move: (e) => log.push('move:' + e.id), up: (e) => log.push('up:' + e.id), cancel: (e) => log.push('cancel:' + e.id) });
const P = (id, x, y, type = 'touch') => ({ pointerId: id, pointerType: type, clientX: x, clientY: y, id });
const tick = (ms) => { now += ms; for (const t of timers) if (t.f && t.at <= now) { const f = t.f; t.f = null; f(); } };
// גלילה: למטה 30px ואז ביטול — הגרף לא שומע כלום
el.emit('pointerdown', P(1, 100, 100)); tick(20); el.emit('pointermove', P(1, 101, 70)); tick(20); el.emit('pointercancel', P(1, 101, 60)); tick(500);
ok(log.length === 0, 'גלילה שמתחילה על הגרף — שום אירוע לא מגיע לגרף');
// הקשה: שחרור בלי תזוזה
el.emit('pointerdown', P(2, 100, 100)); tick(80); el.emit('pointerup', P(2, 100, 100));
ok(log.join() === 'down:2,up:2', 'הקשה — הסימון נדלק (down ואז up)');
log.length = 0;
// גרירה לרוחב
el.emit('pointerdown', P(3, 100, 100)); tick(16); el.emit('pointermove', P(3, 112, 102)); el.emit('pointermove', P(3, 130, 140)); el.emit('pointerup', P(3, 130, 140));
ok(log.join() === 'down:3,move:3,move:3,up:3', 'גרירה לרוחב — הסימון זז, ואחר כך גם תנועה אנכית מזיזה אותו');
log.length = 0;
// החזקה
let prevented = 0;
el.emit('pointerdown', P(4, 100, 100)); tick(360);
ok(log.join() === 'down:4', 'החזקה — נדלק בלי תזוזה');
el.emit('touchmove', { cancelable: true, preventDefault: () => prevented++ });
ok(prevented === 1, 'אחרי שנדלק — הדף לא נגלל מתחת לאצבע');
el.emit('pointerup', P(4, 100, 100)); log.length = 0;
el.emit('touchmove', { cancelable: true, preventDefault: () => prevented++ });
ok(prevented === 1, 'בלי נגיעה פעילה — הגלילה חופשית');
// שתי אצבעות — מיד
el.emit('pointerdown', P(5, 100, 100)); el.emit('pointerdown', P(6, 200, 100));
ok(log.join() === 'down:5,down:6', 'אצבע שנייה — שתיהן נמסרות מיד (מדידה)');
el.emit('pointerup', P(5, 100, 100)); el.emit('pointerup', P(6, 200, 100)); log.length = 0;
// עכבר עובר ישר
el.emit('pointerdown', P(7, 1, 1, 'mouse')); el.emit('pointermove', P(7, 1, 30, 'mouse'));
ok(log.join() === 'down:7,move:7', 'עכבר — בלי השער');
log.length = 0;
// נגיעה שעוצרת גלילה בתנופה — לא מסמנת
doc.emit('scroll', {}); tick(50);
el.emit('pointerdown', P(8, 100, 100)); tick(60); el.emit('pointerup', P(8, 100, 100)); tick(500);
ok(log.length === 0, 'נגיעה שעוצרת את התנופה של הדף — לא כוונה');

// החיבורים בקוד
const pf = fn('pfAttachTouch'), sc = fn('scAttach'), pie = fn('pieWireTouch');
ok(/touchGate\(canvas, \{ down, move/.test(pf) && !/addEventListener\('pointer(down|move|up|cancel)'/.test(pf), 'גרף הביצועים — דרך השער');
ok(/touchGate\(canvas, \{ down, move/.test(sc) && !/canvas\.addEventListener\('pointer(down|move|up|cancel)'/.test(sc), 'גרף המניה — דרך השער');
ok(/document\.addEventListener\('click'/.test(pf) && /document\.addEventListener\('click'/.test(sc), 'ניקוי הסימון — בהקשה מחוץ לגרף, לא ב־pointerdown (גלילה לא מנקה)');
ok(/addEventListener\('click'/.test(pie) && !/addEventListener\('pointerdown'/.test(pie), 'העוגה — click: גלילה לא בוחרת פרוסה');
ok(/\.gb-row'\)\.forEach\(\(b\) => b\.addEventListener\('click'/.test(app), 'פסי התשואה — click');
ok(/main \.tabpage :is\([^)]*\.earn-list\):not\(\.stock-chips\) \{ overflow: hidden; touch-action: pan-y; \}/.test(css), 'הדוחות הקרובים — קרוסלה אופקית: אצבע שזזה למעלה/למטה גוללת את הדף');
ok(/#pfChart \{ touch-action: pan-y/.test(css), 'גרף הביצועים — pan-y (הדף נגלל, הגרירה לרוחב לגרף)');
console.log('\n' + n + ' passed');
