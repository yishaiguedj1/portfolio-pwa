// סבב קפיצות 8 (02/11/2026): מעבר ממוקד לשכבה (element.startViewTransition) במקום העתק של הדף ב־Studio וב־Academy,
// שמירת ההדר והכרטיס הנגלל בציור במקום של הבית, והגלאים ב־qa-sweep. docs/smooth-architecture.md — סעיף 8
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok' : 'FAIL') + ' - ' + m); if (!c) fail++; };
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; };
const app = read('app.js'), core = read('core.js'), st = read('studio.js'), lib = read('library.js'), css = read('styles.css'), qa = read('tools/qa-sweep.js');

// ---- המנוע בליבה
ok(/function cubeVTPre\(/.test(core) && /function cubeVTFace\(/.test(core) && /function cubeVTTouch\(/.test(core), 'המעבר הממוקד ב־core.js (Academy/Studio)');
ok(/if \(cubeVTOk\(root\)\) \{ const v = cubeVTPre\(root, go\); if \(v\) return v; \}/.test(fn(app, 'cubePre')), 'cubePre: מעבר ממוקד כשנתמך, ואחרת ההעתק הישן');
const okSrc = fn(app, 'cubeVTOk');
ok(/st-root/.test(okSrc) && /lib-root/.test(okSrc) && /startViewTransition/.test(okSrc) && /window\.__cubeVT === false/.test(okSrc) && /cubeReduce\(\)/.test(okSrc), 'רק לשכבות של Studio ו־Academy, רק עם תמיכה, ומתג לנתיב הישן (__cubeVT)');
ok(/::view-transition-new\(root\)/.test(fn(app, 'cubeVTFace')) && /::view-transition-old\(root\)/.test(fn(app, 'cubeVTFace')), 'הפאות = הצילום של היוצא (old) והדף החי (new)');
ok(/pseudoElement: f\.pe/.test(fn(app, 'faceSet')) && /if \(f\.pe\) opt\.pseudoElement = f\.pe;/.test(fn(app, 'cubeRun')), 'cubeSet ו־cubeRun מזיזים את הפסאודו־אלמנטים');
ok(/if \(f && f\.pe\)/.test(fn(app, 'cubeFaceOff')) && /f\.pe\) return;/.test(fn(app, 'cubeClipTop')), 'שחרור פאה וחיתוך — גם לפאה של מעבר ממוקד');
ok(/if \(el && \(el\._cubeVT \|\| cubeVTOk\(el\)\)\) return \{ remove\(\) \{\} \};/.test(fn(app, 'cubeBackdrop')), 'בלי ‎.cube-bd במעבר ממוקד (הרקע של ‎::view-transition)');
ok(/document\.addEventListener\('touchstart', cubeVTTouch, \{ capture: true, passive: true \}\)/.test(app) && /g\.root\._snbStart\(e, tg\)/.test(fn(app, 'cubeVTTouch')), 'נגיעה בזמן המעבר (מגיעה ל־body) — מסיימים, וההחלקה מתחילה מהאלמנט האמיתי');
ok(/root\._snbStart = start;/.test(fn(app, 'snbSwipe')) && /const tg = real \|\| e\.target;/.test(fn(app, 'snbSwipe')), 'snbSwipe: התחלה גם מנגיעה שנותבה');
ok(/\.cube-vt::view-transition-old\(root\), \.cube-vt::view-transition-new\(root\) \{ animation: none; mix-blend-mode: normal;/.test(css) && /\.cube-vt::view-transition \{ background: var\(--bg\); \}/.test(css) && /\.cube-vt::view-transition-group\(root\) \{ animation: cube-vt-keep 20s linear; \}/.test(css),
  'styles.css: בלי הדהייה והמיזוג של הדפדפן, רקע מאחורי הפאות, והמעבר חי עד שהמנוע מסיים');
ok(/root\._cubeVT \|\|/.test(fn(st, 'render')) && /root\._cubeVT \|\|/.test(lib), 'Studio / Academy: באמצע מעבר ממוקד החוגה לא מסונכרנת מחדש (כמו כשההעתק על המסך)');

// ---- זרימה ב־vm: שכבה מדומה עם startViewTransition
{
  const names = ['cubeFace', 'cubeFaceOff', 'cubeWarm', 'cubeWarmEnd', 'cubeSet', 'faceSet', 'cubeTransform', 'cubeVisible', 'cubeVTOk', 'cubeVTFace', 'cubeVTPre', 'cubeVTWire', 'cubeVTTouch', 'cubePre'];
  const src = 'let _cubePre = null, _cubeVTOn = null, cubeNow = null; const _dial = { ride: null }; const CUBE_P = 2.4; const CUBE_RUB = 0.15; const CUBE_WARM_OP = "0.01";'
    + 'const cubeReduce = () => false; const cubeClone = () => { throw new Error("clone"); };'
    + names.map((n) => fn(app, n)).join('\n') + '; this.T = { cubePre, cubeFace, cubeSet, cubeWarm, get on() { return _cubeVTOn; } };';
  const anims = [];
  const mkEl = () => ({ animate(k, o) { const a = { k, o, paused: false, cancelled: false, pause() { this.paused = true; }, cancel() { this.cancelled = true; }, effect: { setKeyframes(x) { a.k = x; } } }; anims.push(a); return a; } });
  const cls = new Set();
  let cb = null, skipped = 0, resReady = null;
  const r = Object.assign(mkEl(), {
    classList: { contains: (c) => c === 'st-root', add: (c) => cls.add(c), remove: (c) => cls.delete(c) },
    startViewTransition(f) { cb = f; return { ready: new Promise((res) => { resReady = res; }), finished: new Promise(() => {}), skipTransition() { skipped++; } }; },
  });
  const ctx = { window: { innerWidth: 400 }, document: { hidden: false, addEventListener() {} }, setTimeout, clearTimeout, console, Math, Promise };
  vm.runInNewContext(src, ctx);
  const T = ctx.T;
  let g = null, c = null;
  const p = T.cubePre(r, (gh) => { g = gh; c = { side: 1, p: 0, out: T.cubeFace(gh, { dead: true }), in: T.cubeFace(r) }; T.cubeSet(c, 0.3); });
  ok(p && typeof p.now === 'function' && cls.has('cube-vt') && r._cubeVT && T.on === r._cubeVT, 'מתחיל מעבר ממוקד (‎.cube-vt) ומחזיר את ה"הכנה"');
  ok(!g && typeof cb === 'function', 'הציור החדש — רק בקריאה של הדפדפן (אחרי הצילום של היוצא)');
  const dom = cb();
  ok(g && g._vtG === g && c.out.pe === '::view-transition-old(root)' && c.in.pe === '::view-transition-new(root)' && c.in.el === r, 'cubeFace: ההעתק → old, השכבה → new');
  ok(dom && typeof dom.then === 'function' && c.warm === true && anims.length === 0, 'עד שהפסאודו־אלמנטים קיימים (ready) הקובייה ממתינה, בלי לכתוב');
  resReady();
  setTimeout(() => {
    ok(c.warm === false && anims.length === 2 && anims.every((a) => a.o.pseudoElement && a.paused), 'ב־ready: מצב הקובייה (p) נכתב — אנימציה מושהית לכל פאה');
    const inA = anims.find((a) => a.o.pseudoElement === '::view-transition-new(root)');
    T.cubeSet(c, 0.6);
    ok(anims.length === 2 && /rotateY/.test(inA.k[0].transform), 'גרירה: אותה אנימציה מתעדכנת (setKeyframes), לא אנימציה חדשה בכל תזוזה');
    g.remove();
    ok(skipped === 1 && !cls.has('cube-vt') && !r._cubeVT && T.on === null && anims.every((a) => a.cancelled) && c.in.off && c.out.off, 'remove: מסיים (skipTransition), מנקה ומכבה את הפאות');
    // now() לפני הצילום: הציור מיד, בלי סיבוב
    cb = null; skipped = 0;
    let g2 = null, faces = null;
    const p2 = T.cubePre(r, (gh) => { g2 = gh; faces = [T.cubeFace(gh, { dead: true }), T.cubeFace(r)]; });
    p2.now();
    ok(g2 && faces.every((f) => f.off) && skipped === 1 && !r._cubeVT, 'now() לפני הצילום: הציור מיד, הפאות כבויות (בלי סיבוב), המעבר מבוטל');
    ok(cb() === undefined, 'הקריאה המאוחרת של הדפדפן לא מציירת שוב');
    end();
  }, 0);
}

function end() {
  // ---- ציור במקום בבית: ההדר והכרטיס הנגלל לא יוצאים מהמסמך
  ok(/shellKeep = oldPg \? \{ ph: null, old: oldPg, map: new Map\(\), hdr:/.test(fn(st, 'render')) && /listSync\(oldPg, kids\);/.test(fn(st, 'render')), 'Studio: ציור במקום של הבית — הילדים עוברים לדף הקיים (listSync)');
  ok(/p\.append\(shellKeep && shellKeep\.hdr \? \(shellKeep\.ph = h\('i'\)\) : SA\.shell\.el\)/.test(st), 'ההדר: מקום שמור בדף החדש, הצומת עצמו נשאר במקומו');
  ok(/o\._jc\(rows\)/.test(fn(st, 'jobsCardIn')) && /wrap\._jc = \(nr\) => \{ rows = nr; listSync\(l, rows\);/.test(fn(st, 'jobsCard')), 'הכרטיס הנגלל של העבודות: אותו כרטיס, שורות חדשות');
  // ---- הגלאים
  ok(/function layerTransient\(/.test(qa) && /r\.kind === 'copy'/.test(qa) && /closest\('\.cube-ghost, \.cube-hold'\)/.test(qa), 'qa-sweep: שכבות זמניות של העתק בזמן מעבר');
  ok(/רענון שקט/.test(qa) && /MOCK\.delay = 5000/.test(qa), 'qa-sweep: רענון שקט בבית של Studio — אף שכבה גדולה לא נהרסת');
  ok(/--oldvt/.test(qa) && /\.cube-vt/.test(qa), 'qa-sweep: הנתיב הישן להשוואה, ומעבר ממוקד שלא הסתיים = שארית');
  if (fail) process.exit(1);
}
