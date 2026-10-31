// 30/10/2026 — סבב קפיצות 6 (docs/smooth-architecture.md, שלב 1): סידור לפי רשימה במקום בנייה מחדש
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
const fn = (src, name) => { const i = src.indexOf('function ' + name + '('); if (i < 0) return ''; let d = 0; for (let k = src.indexOf('{', i); k < src.length; k++) { if (src[k] === '{') d++; else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); } } return ''; };

// DOM מינימלי: רשימת ילדים מקושרת, וספירה של כל הכנסה/הוצאה
function Parent() {
  const kids = [];
  const p = { kids, moves: 0, removes: 0 };
  const link = () => kids.forEach((k, i) => { k.nextSibling = kids[i + 1] || null; });
  Object.defineProperty(p, 'firstChild', { get: () => kids[0] || null });
  p.removeChild = (c) => { kids.splice(kids.indexOf(c), 1); p.removes++; link(); };
  p.insertBefore = (c, ref) => { const i = kids.indexOf(c); if (i >= 0) kids.splice(i, 1); const j = ref ? kids.indexOf(ref) : kids.length; kids.splice(j, 0, c); p.moves++; link(); };
  p.set = (arr) => { kids.splice(0, kids.length, ...arr); link(); };
  return p;
}
const ctx = {};
vm.runInNewContext(fn(app, 'listSync') + 'this.listSync = listSync;', ctx);
ok(typeof ctx.listSync === 'function', 'listSync קיימת');
ok(fn(core, 'listSync') === fn(app, 'listSync'), 'listSync בליבה (core.js = app.js)');
const N = (k) => ({ k });
{
  const [a, b, c, d] = ['a', 'b', 'c', 'd'].map(N);
  const p = Parent(); p.set([a, b, c, d]);
  ctx.listSync(p, [a, b, c, d]);
  ok(p.moves === 0 && p.removes === 0, 'אותה רשימה — אף צומת לא זז');
  ctx.listSync(p, [a, c, d]);
  ok(p.kids.join() === [a, c, d].join() && p.moves === 0 && p.removes === 1, 'סינון — רק מה שיצא יוצא, השאר לא זזים');
  ctx.listSync(p, [a, b, c, d]);
  ok(p.kids.map((x) => x.k).join('') === 'abcd' && p.moves === 1, 'ביטול הסינון — רק החוזר נכנס');
  const e = N('e');
  ctx.listSync(p, [e, a, b, c, d]);
  ok(p.kids.map((x) => x.k).join('') === 'eabcd' && p.moves === 2, 'כרטיס חדש בראש — הכנסה אחת (המונה מצטבר: 1 קודם)');
  ctx.listSync(p, [d, c, b, a]);
  ok(p.kids.map((x) => x.k).join('') === 'dcba', 'מיון הפוך — הסדר נכון');
  ctx.listSync(p, []);
  ok(p.kids.length === 0, 'רשימה ריקה — הכל יוצא');
}
// renderStocks: כרטיס שלא השתנה = הצומת הקיים
const rs = fn(app, 'renderStocks');
ok(!/list\.innerHTML\s*=\s*''/.test(rs), 'renderStocks: בלי ניקוי של הרשימה');
ok(/nodeKeep\(was, p, card\)/.test(rs), 'renderStocks: שימוש חוזר רק באותו אובייקט ובאותו HTML (nodeKeep)');
// nodeKeep: אותו אובייקט + אותו HTML = הצומת הישן; אחרת החדש נרשם
{
  const c2 = {};
  vm.runInNewContext(fn(app, 'nodesOf') + fn(app, 'nodeKeep') + 'this.nodesOf = nodesOf; this.nodeKeep = nodeKeep;', c2);
  const p1 = {}, p2 = {};
  const mk = (h) => ({ outerHTML: h });
  const a = mk('<a>1</a>'); ok(c2.nodeKeep(new Map(), p1, a) === null && a._k === p1 && a._sig === '<a>1</a>', 'nodeKeep: צומת חדש נרשם עם מפתח וחתימה');
  const was = c2.nodesOf({ children: [a] });
  ok(c2.nodeKeep(was, p1, mk('<a>1</a>')) === a, 'nodeKeep: אותו אובייקט ואותו HTML — הצומת הקיים');
  ok(c2.nodeKeep(was, p1, mk('<a>2</a>')) === null, 'nodeKeep: HTML אחר — נבנה מחדש');
  ok(c2.nodeKeep(was, p2, mk('<a>1</a>')) === null, 'nodeKeep: אובייקט אחר (נתונים חדשים) — נבנה מחדש, כי מאזינים סוגרים עליו');
}
for (const f of ['renderWishlist', 'renderTrades']) {
  const src = fn(app, f);
  ok(!/list\.innerHTML\s*=\s*''/.test(src) && /nodeKeep\(was, /.test(src) && /listSync\(list, out\)/.test(src), f + ': בלי ניקוי, שימוש חוזר, וסידור דרך listSync');
}
ok(/listSync\(list, out\)/.test(rs), 'renderStocks: הסידור דרך listSync');

// R8 (אנדרואיד): מסך הפתיחה עובר ל־Chrome ונשאר עד הציור הראשון, בצבע הדף (בהיר/כהה)
{
  const A = 'android/app/src/main/';
  const rd = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  const kt = rd(A + 'java/io/github/yishaiguedj1/snowball/MainActivity.kt'), man = rd(A + 'AndroidManifest.xml');
  ok(/PwaWrapperSplashScreenStrategy\(this, R\.mipmap\.ic_launcher_foreground, getColor\(R\.color\.splash_bg\)/.test(kt) && /l\.launch\(builder, null, sp,/.test(kt), 'MainActivity: מסך פתיחה שמועבר ל־Chrome, בצבע splash_bg');
  ok(/override fun onEnterAnimationComplete\(\)[\s\S]{0,120}onActivityEnterAnimationComplete\(\)/.test(kt), 'MainActivity: מעביר את סוף אנימציית הכניסה למסך הפתיחה');
  ok(/androidx\.core\.content\.FileProvider[\s\S]{0,120}\$\{applicationId\}\.twasplash[\s\S]{0,200}@xml\/twa_splash_paths/.test(man) && /"\$packageName\.twasplash"/.test(kt), 'Manifest: FileProvider עם אותה רשות כמו בקוד');
  ok(/files-path path="twa_splash\/"/.test(rd(A + 'res/xml/twa_splash_paths.xml')), 'twa_splash_paths: התיקייה שהספרייה כותבת אליה');
  ok(/splash_bg">#F2F2F7/.test(rd(A + 'res/values/colors.xml')) && /splash_bg">#000000/.test(rd(A + 'res/values-night/colors.xml')), 'splash_bg: בהיר = --bg של הדף, כהה = שחור');
}
// ש2 (31/10/2026): שכבה יציבה לעמוד הפעיל ב־Invest — בלי קידום במגע ובלי הורדה בנחיתה
{
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  ok(/\n\.tabpage\.active \{ will-change: transform; \}/.test(css), 'styles: העמוד הפעיל בשכבה יציבה (will-change: transform)');
  ok(/function cubeFaceOff\(f\) \{ if \(f && f\.el\) \{ f\.el\.style\.cssText = f\.css;/.test(app), 'cubeFaceOff מחזיר רק את הסגנון שבשורה — הכלל של העמוד הפעיל נשאר');
}
console.log(n + ' בדיקות עברו');
