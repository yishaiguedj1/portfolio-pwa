// 17/11/2026 (בקשת המשתמש — לפי ת־גרף): אצבע על גרף בזמן גלילת הדף לא נוגעת בסימון; הסימון נדלק רק בכוונה —
// הקשה או החזקה. החלקה לרוחב שמתחילה על גרף — מעבר עמוד (2.162.1). גרף הביצועים, גרף המניה, העוגה, פסי התשואה והדוחות הקרובים.
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
ok(I(2, -30, 40) === 'pass' && I(5, 9, 10) === 'pass', 'תזוזה אנכית — גלילה של הדף');
ok(I(-12, 4, 30) === 'pass' && I(9, 8, 0) === 'pass' && I(-40, 2, 200) === 'pass', 'תזוזה לרוחב — החלקה בין העמודים, לא סימון (בקשת המשתמש)');
ok(I(1, 1, 350) === 'scrub' && I(1, 1, 349) === 'wait', 'החזקה של 350ms — סימון');

// השער — אירועים מדומים
const mk = () => { const h = {}; return { h, addEventListener: (t, f) => { (h[t] = h[t] || []).push(f); }, emit(t, e) { for (const f of h[t] || []) f(e); } }; };
const el = mk(), doc = mk();
const log = [];
let now = 1000;
const timers = [];
const gctx = { document: doc, Date: { now: () => now }, setTimeout: (f, ms) => { timers.push({ f, at: now + ms }); return timers.length; }, clearTimeout: (id) => { if (timers[id - 1]) timers[id - 1].f = null; } };
vm.runInNewContext(fn('tgIntent') + 'let _tgScrollT = 0, _tgLive = 0;' + fn('touchGate') + ';this.g = touchGate; this.live = () => _tgLive;', gctx);
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
// החלקה לרוחב — של הדף (מעבר עמוד), הגרף לא שומע כלום, וגם השחרור לא נחשב הקשה
el.emit('pointerdown', P(3, 100, 100)); tick(16); el.emit('pointermove', P(3, 112, 102)); el.emit('pointermove', P(3, 180, 104)); tick(500); el.emit('pointerup', P(3, 180, 104));
ok(log.length === 0 && gctx.live() === 0, 'החלקה לרוחב על הגרף — לא מסמנת (מעבירה עמוד)');
// החזקה ואז גרירה לרוחב — הסימון זז, וההחלקה בין העמודים מתבטלת
el.emit('pointerdown', P(9, 100, 100)); tick(360);
ok(gctx.live() === 1, 'אחרי החזקה — הגרף תפס את האצבע (ההחלקה בין העמודים מתבטלת)');
el.emit('pointermove', P(9, 140, 102)); el.emit('pointermove', P(9, 150, 140)); el.emit('pointerup', P(9, 150, 140));
ok(log.join() === 'down:9,move:9,move:9,up:9' && gctx.live() === 0, 'החזקה וגרירה — הסימון זז לכל כיוון; בשחרור הגרף משחרר');
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
const psb = fn('pageSwipeBlocked');
ok(/canvas:not\(\[data-tg\]\):not\(\[data-pie-touch\]\)/.test(psb) && !/closest\('canvas,/.test(psb), 'מעבר עמוד בהחלקה — גם כשהאצבע מתחילה על גרף עם שער או על העוגה');
ok(/dragBusy\(\) \|\| _tgLive > 0\) \{ cancel\(\); return; \}/.test(app), 'גרף שכבר נדלק — ההחלקה בין העמודים מתבטלת');
ok(/el\.dataset\.tg = '1'/.test(fn('touchGate')) && /touchAction = 'pan-y'/.test(pie), 'הגרף מסומן לשער; העוגה pan-y');
ok(/#pfChart \{ touch-action: pan-y/.test(css), 'גרף הביצועים — pan-y (הדף נגלל, הגרירה לרוחב לגרף)');
console.log('\n' + n + ' passed');
