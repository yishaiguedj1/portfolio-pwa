// 03/11/2026 — סבב קפיצות 11: הבועות בהדר בלי טשטוש, כריכות באותה כתובת, הבועה של Invest במקום, וכרטיס הביצועים בלי רענון
const fs = require('fs'), path = require('path'), vm = require('vm');
const R = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.log('FAIL - ' + m); } else console.log('ok - ' + m); };
const gb = R('glass-btn.css'), lib = R('library.js'), app = R('app.js'), qa = R('tools/qa-sweep.js');

// 1. הבועות בהדר — בלי טשטוש, בתוך השכבה glassbtn (רק שם !important גובר על החומר) ואחרי החומר
const layer = gb.slice(gb.indexOf('@layer glassbtn {'));
const rule = /:where\(\.appbar\) :where\(\.appbar-sub > \*, \.fx-pill\) \{ -webkit-backdrop-filter: none !important; backdrop-filter: none !important; \}/;
ok(rule.test(layer), 'בועות ההדר: backdrop-filter none בתוך @layer glassbtn');
const mat = layer.indexOf('-webkit-backdrop-filter: var(--gb-fx) !important'), at = layer.search(rule);
ok(mat > 0 && at > mat, 'הכלל אחרי החומר (בתוך השכבה הסדר קובע)');
ok(/\.cube-flat \{ --gb-fx: none; \}/.test(gb), 'הכיבוי בזמן הקובייה נשאר לשאר הכפתורים');

// 2. העותק של רשימת הספרים — אותו Blob של הכריכה (structuredClone יוצר חדש → coverUrl יוצר כתובת חדשה בכל ציור)
const kb = lib.match(/const keepBlobs = [^\n]+/), bc = lib.match(/const booksCopy = [^\n]+/);
ok(kb && bc && /keepBlobs\(a, structuredClone\(a\)\)/.test(bc[0]), 'booksCopy מחזיר את ה־Blob המקורי');
if (kb && bc) {
  const ctx = { Blob: class Blob { constructor(p) { this.p = p; } }, structuredClone: (x) => JSON.parse(JSON.stringify(x, (k, v) => v)) };
  ctx.structuredClone = (x) => x.map((b) => Object.assign({}, b, { cover: b.cover ? new ctx.Blob(b.cover.p) : b.cover, ann: (b.ann || []).slice() }));
  vm.createContext(ctx); vm.runInContext(kb[0] + '\n' + bc[0] + '\nthis.booksCopy = booksCopy;', ctx);
  const bl = new ctx.Blob([1]), src = [{ id: 'a', cover: bl, ann: [1] }, { id: 'b' }];
  const c = ctx.booksCopy(src);
  ok(c[0].cover === bl, 'הכריכה — אותו אובייקט');
  ok(c[0] !== src[0] && c[0].ann !== src[0].ann, 'שאר הרשומה — עותק (הקוראים משנים לפני putBook)');
  ok(!('cover' in c[1]) || c[1].cover === undefined, 'ספר בלי כריכה — בלי שדה חדש');
}

// 3. הבועה של Invest — אותו צומת כשהמצב מתחלף
const usl = app.slice(app.indexOf('function updateSourceLabel()'), app.indexOf('const FX_SYM'));
ok(/const cur = el\.firstElementChild;/.test(usl) && /cur\.className = nx\.className/.test(usl) && /cur\.innerHTML = nx\.innerHTML; return;/.test(usl), 'updateSourceLabel מעדכן את הבועה הקיימת');
ok(/el\.innerHTML = html;\n\}/.test(usl), 'בלי בועה קיימת — ציור רגיל');

// 4. כרטיס הביצועים — הכפתור לא נבנה מחדש, ושכבת הטעינה לא מכסה גרף קיים
const pt = app.slice(app.indexOf('function renderPfTools()'), app.indexOf('function renderPfTools()') + 1400);
ok(/if \(box\._k === key && box\.firstElementChild\)/.test(pt) && pt.indexOf('box._k === key') < pt.indexOf("box.innerHTML = ''"), 'renderPfTools: אותו תוכן — בלי בנייה מחדש');
ok(/if \(loading && !canvas\._pfMap\) \{\s*loading\.textContent = t\('loadingHist'\);/.test(app), 'שכבת "טוען היסטוריה" רק כשאין גרף');

// 5. הגלאים ב־qa-sweep
ok(/L\.pills\.push/.test(qa) && /שכבות חדשות לבועות בהדר/.test(qa), 'qa-sweep: שכבה חדשה על בועה בהדר בזמן מעבר');
ok(/כריכות קיבלו כתובת חדשה/.test(qa) && /x\.cover = bl/.test(qa), 'qa-sweep: יציבות הכריכות (עם כריכות בזריעה)');
ok(/הבועה נבנתה מחדש בשינוי מצב/.test(qa), 'qa-sweep: הבועה של Invest בשינוי מצב');

console.log(n - bad + '/' + n + ' passed');
process.exit(bad ? 1 : 0);
