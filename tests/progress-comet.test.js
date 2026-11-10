// progress-comet.test.js — ת־פס: פס התקדמות "שביט" בכל המערכת (10/11/2026, בקשת המשתמש — לפי סרטון מהטלפון).
// 1. styles.css מגדיר את המנגנון פעם אחת: מסילות, מילויים, זוהר (::after), נשימה, מצב עומד, תנועה מופחתת.
// 2. כל מסילה ברשימה — עם --cmt-c ברכיב (הצבע שהיה לה), וכלל הרכיב לא מחזיר background/overflow: hidden שמסתירים את האפקט.
// 3. הנגן: מחלקות cmt-on (מנגן) ו־cmt-drag (גרירה) ב־studioplay.js, והכללים שלהן ב־studio.css; בלי ידית.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let n = 0;
const fails = [];
function ok(cond, name) { n++; if (!cond) fails.push(name); else console.log('ok - ' + name); }
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');

const styles = read('styles.css');
const blk = strip(styles.slice(styles.indexOf('ת־פס — פס התקדמות')));
ok(styles.includes('ת־פס — פס התקדמות'), 'בלוק ת־פס קיים בסוף styles.css');

// [מסילה, קובץ הרכיב, המילוי]
const BARS = [
  ['demo-prog-bar', 'styles.css', 'span'], ['ip-bar', 'styles.css', 'span'],
  ['lib-bar', 'library.css', 'i'], ['lib-mini', 'library.css', 'i'],
  ['st-tprog', 'studio.css', 'i'], ['st-pbar', 'studio.css', 'i'], ['st-ut-bar', 'studio.css', 'i'], ['st-pl-track', 'studio.css', '.pl'],
  ['adm-lbar', 'admin.css', 'i'],
];
const trackList = (blk.match(/:where\(([^)]*)\)\s*\{\s*--cmt-h:/) || [, ''])[1].split(',').map((x) => x.trim());
const fillList = (blk.match(/:where\(([^)]*)\)\s*\{\s*--cmt-to:/) || [, ''])[1].split(',').map((x) => x.trim());
for (const [t, file, f] of BARS) {
  ok(trackList.includes('.' + t), 'מסילה ברשימה: .' + t);
  ok(fillList.includes('.' + t + ' > ' + f), 'מילוי ברשימה: .' + t + ' > ' + f);
  const css = strip(read(file));
  const own = [...css.matchAll(new RegExp('(^|\\n)([^{}\\n]*\\.' + t.replace(/-/g, '\\-') + '(?![\\w-])[^{}\\n]*)\\{([^}]*)\\}', 'g'))];
  ok(own.some((m) => /--cmt-c\s*:/.test(m[3])), 'צבע הפס נשמר (--cmt-c) ב־' + file + ': .' + t);
  const bad = own.filter((m) => !/:where|\.st-pbar\.ind|\.st-pl-track \.buf|:not\(\.cmt-on\)|cmt-drag|focus-visible/.test(m[2]) && (/overflow\s*:\s*hidden/.test(m[3]) || /(^|;)\s*background\s*:(?!\s*var\(--cmt-bg\))/.test(m[3])));
  ok(!bad.length, 'בלי רקע/overflow שמסתירים את השביט: .' + t + (bad.length ? ' — ' + bad.map((m) => m[2].trim()).join(' | ') : ''));
}
ok(/@property --cmt-h\s*\{[^}]*<color>/.test(blk) && /@property --cmt-g\s*\{[^}]*<number>/.test(blk), '@property: --cmt-h (צבע) ו־--cmt-g (מספר) — מעבר רך בין מנגן לעומד');
ok(/::after\s*\{[^}]*radial-gradient[^}]*mask-image[^}]*conic-gradient/.test(blk), 'הזוהר: טיפה רכה מחודדת בראש');
ok(/@keyframes cmtBreath/.test(blk) && /animation:\s*cmtBreath/.test(blk), 'הזוהר נושם');
ok(/:dir\(rtl\)\s*\{[^}]*--cmt-to:\s*270deg/.test(blk), 'בעברית הראש בצד שמאל (:dir(rtl))');
ok(/:where\(\.lib-mini, \.lib-cont \.lib-bar, \.ac-progress \.lib-bar\)\s*\{[^}]*--cmt-g:\s*0/.test(blk), 'התקדמות קריאה — פס עומד בלי זוהר');
ok(/prefers-reduced-motion[\s\S]*animation:\s*none/.test(blk) && /html\.calm, html\.hush/.test(blk), 'תנועה מופחתת / מצב שקט — בלי נשימה');
ok(/:root:not\(\[data-theme="dark"\]\)\s*\{[^}]*--cmt-gk:\s*100%/.test(blk), 'מצב בהיר — זוהר צבעוני');

const studio = strip(read('studio.css'));
ok(/\.st-pl-bar:not\(\.cmt-on\) \.st-pl-track\s*\{[^}]*--cmt-g:\s*0/.test(studio), 'נגן בהשהיה — בלי זוהר');
ok(/\.st-pl-bar\.cmt-drag \.st-pl-track\s*\{[^}]*height:\s*8px/.test(studio), 'נגן בגרירה — המסילה מתעבה');
ok(/\.st-pl-knob\s*\{\s*display:\s*none/.test(studio), 'נגן — בלי ידית');
ok(/\.st-pl-track i\s*\{[^}]*padding:\s*0/.test(studio), 'מילוי הנגן בלי ריפוד (.pl של הספרייה לא מנפח אותו)');
ok(/\.st-pbar\.ind\s*\{[^}]*clip-path/.test(studio), 'פס בלי אחוז — הפס הנע לא יוצא מהמסילה');
const play = read('studioplay.js');
ok(/bar\.classList\.toggle\('cmt-on', !v\.paused && !v\.ended\)/.test(play), 'studioplay: cmt-on לפי ניגון');
ok(/bar\.classList\.add\('cmt-drag'\)/.test(play) && /bar\.classList\.remove\('cmt-drag'\)/.test(play), 'studioplay: cmt-drag בגרירה');
ok(/kc-cell::before\s*\{[^}]*#fff 96%[^}]*drop-shadow/.test(strip(read('chart.css'))), 'קו הטעינה בגרף — שביט עם ראש לבן וזוהר');

console.log(n + ' בדיקות, ' + fails.length + ' נכשלו');
if (fails.length) { for (const f of fails) console.log('FAIL - ' + f); process.exit(1); }
