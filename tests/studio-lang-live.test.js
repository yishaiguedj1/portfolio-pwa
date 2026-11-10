// השפה המדוברת בכל רגע (10/11/2026): כתובית בשפה אחרת מגיעה מהעובד עם lg ו־src (vt/lang.py:cue_lang).
// הטלפון: normCues מסנן, הנגן מציג את המקור בשפה שלו ובכיוון שלו, העורך שומר אותם, והמחרוזות בשתי השפות.
// הרצה: node tests/studio-lang-live.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

(async () => {
  const P = await import(path.join(root, 'studioplay.js'));
  const E = await import(path.join(root, 'studiosubs.js'));

  const cs = P.normCues([
    { id: 1, start: 0, end: 2, lines: ['שלום'], en: 'hello' },
    { id: 2, start: 2, end: 4, lines: ['בוקר טוב'], en: 'good morning', lg: 'fr', src: 'bonjour' },
    { id: 3, start: 4, end: 6, lines: ['א'], en: 'a', lg: 'French', src: 'x' },
    { id: 4, start: 6, end: 8, lines: ['ב'], en: 'b', lg: '<b>', src: '<img>' },
    { id: 5, start: 8, end: 10, lines: ['ג'], en: 'c', src: 'בלי שפה' },
  ]);
  ok(cs.length === 5 && cs[1].lg === 'fr' && cs[1].src === 'bonjour', 'normCues — lg תקין ו־src נשמרים');
  ok(cs[0].lg === '' && cs[0].src === '' && cs[2].lg === '' && cs[2].src === '' && cs[3].lg === '' && cs[3].src === '', 'normCues — lg לא תקין: בלי שפה ובלי מקור');
  ok(cs[4].src === '', 'normCues — src בלי lg לא נכנס (המקור באנגלית נשאר en)');
  ok(P.normCues([{ start: 0, end: 1, lines: ['x'], lg: 'he', src: 'y'.repeat(900) }])[0].src.length === 600, 'normCues — src עד 600 תווים');

  const ps = read('studioplay.js');
  ok(/const srcOf = \(c\) => c\.src \|\| c\.en;/.test(ps) && /const srcDir = \(c\) => \(c\.src \? langDir\(c\.lg\) \|\| lineDir\(c\.src\) : 'ltr'\);/.test(ps), 'הנגן — שורת המקור: src בשפה שלו, אחרת האנגלית');
  ok(/const lines = cc === 'en' \? \(srcOf\(c\) \? \[srcOf\(c\)\] : \[\]\) : c\.lines;/.test(ps) && /sub\.dir = cc === 'en' \? srcDir\(c\) : 'rtl';/.test(ps), 'הנגן — מצב המקור: הטקסט והכיוון של כל כתובית לפי השפה שלה');
  ok(/cc === 'both' && srcOf\(c\) && !\(c\.lg && c\.lg === langOf\(opts\.subLang \|\| 'he'\)\)/.test(ps), 'הנגן — "שתיהן": קטע שכבר בשפת הכתוביות בלי שורה כפולה');
  ok(/const hasEn = \(\) => cues\.some\(\(c\) => c\.en \|\| c\.src\);/.test(ps) && /const mixed = \(\) => cues\.some\(\(c\) => c\.lg\);/.test(ps), 'הנגן — יש מקור גם כשרק src');
  ok(ps.indexOf('const mixed = ') < ps.indexOf('mixed()'), 'הנגן — mixed מוגדר לפני השימוש');
  ok(/T\(mixed\(\) \? 'studioPlCcSrcMixL' : 'studioPlCcEnL'\)/.test(ps) && /T\(mixed\(\) \? 'studioPlCcBothMixL' : 'studioPlCcBothL'\)/.test(ps), 'הנגן — בשפות משולבות התפריט אומר "המקור", לא "אנגלית"');

  const j = JSON.parse(E.toCuesJson(cs));
  ok(j[1].lg === 'fr' && j[1].src === 'bonjour' && !('lg' in j[0]) && !('src' in j[0]), 'העורך — toCuesJson שומר lg ו־src רק בקטע בשפה אחרת');
  const ss = read('studiosubs.js');
  ok(/if \(c\.src\) return srcLine\(c\.src, T\('studioSrcOrig'\), null, null, null, c\.lg\);/.test(ss), 'העורך — קטע בשפה אחרת: המקור שלו, בלי סימוני הביטחון של Parakeet');
  ok((ss.match(/if \(c\.en \|\| c\.src\) body\.append\(src\(c\)\)/g) || []).length === 2, 'העורך — שורת המקור מוצגת גם כשיש רק src');
  ok(/d\.dir = lg \? langDir\(lg\) \|\| lineDir\(String\(e\)\) : 'ltr'; d\.lang = lg \|\| 'en';/.test(ss), 'העורך — כיוון ושפה של שורת המקור לפי lg');

  const sj = read('studio.js');
  ok(/const lat = !\/\[\^\\u0000-\\u024f\\u1e00-\\u1eff\\u2000-\\u206f\]\/\.test\(String\(e\)\);/.test(sj) && /d\.dir = lat \? 'ltr' : 'auto'/.test(sj), 'שער ההגהה — מקור שאינו לטיני: כיוון אוטומטי ותווית "מקור"');

  const app = read('app.js');
  for (const k of ['studioSrcOrig', 'studioSrcTag', 'studioPlCcSrcMixL', 'studioPlCcBothMixL']) {
    const m = app.match(new RegExp(k + ':', 'g'));
    ok(m && m.length >= 2, `המחרוזת ${k} — בעברית ובאנגלית`);
  }

  // אותה צורה בכל המקומות: העובד (cli.py), העריכה בשרת (rerender.py) והטלפון
  const cli = read('translator/vt/cli.py');
  const rr = read('translator/rerender.py');
  ok(/L\.cue_lang\(/.test(cli) && /"lg", "src"/.test(cli), 'העובד — cues.final עם lg ו־src');
  ok(/re\.fullmatch\(r'\[a-z\]\{2,3\}'/.test(rr) && /LG_RE = \/\^\[a-z\]\{2,3\}\$\//.test(ps), 'אותו כלל לקוד שפה — בעריכה בשרת ובטלפון');
  ok(/\[:600\]/.test(rr.split('re.fullmatch')[1] || '') && /src: lg \? str\(c\.src, 600\)/.test(ps), 'אותו אורך מקור — 600');

  console.log(`\n${n} בדיקות עברו`);
})().catch((e) => { console.error(e); process.exit(1); });
