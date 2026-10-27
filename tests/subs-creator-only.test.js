// 27/10/2026 (החלטת המשתמש): כתוביות קיימות — רק של היוצר, אף פעם לא אוטומטיות (יוטיוב או אתר אחר),
// ו־Studio DM זהה ל־Studio: אותה רשימת שפות, אותו מסלול. בשרת — שער איכות לפני שהן נכנסות להגהה.
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..');
let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok - ' : 'FAIL - ') + m); if (!c) fails++; };
const read = (p) => fs.readFileSync(path.join(R, p), 'utf8');
function walk(d, out = []) {
  for (const e of fs.readdirSync(path.join(R, d), { withFileTypes: true })) {
    const p = d + '/' + e.name;
    if (e.isDirectory()) walk(p, out); else if (/\.(kt|py)$/.test(e.name)) out.push(p);
  }
  return out;
}
const files = walk('android/app/src').concat(walk('translator').filter((p) => !p.includes('/tests/')));
const bad = files.filter((p) => /--write-auto-subs|writeautomaticsub/.test(read(p)));
ok(!bad.length, 'אף אפליקציה ואף שרת לא מורידים כתוביות אוטומטיות' + (bad.length ? ': ' + bad.join(', ') : ''));
const dl = read('android/app/src/ytdl/java/io/github/yishaiguedj1/snowball/DlEngine.kt');
ok(/--no-write-auto-subs/.test(dl) && !/auto: Boolean/.test(dl), 'DlEngine: ‎--no-write-auto-subs‎ ובלי אפשרות לאוטומטיות');
const sv = read('translator/fetchurl.py');
const m = dl.match(/const val SUBS = "([^"]+)"/);
ok(m && /'--no-write-auto-subs'/.test(sv), 'רשימה אחת בטלפון, ובשרת בלי אוטומטיות');
ok(/const val SUBS = DlEngine\.SUBS/.test(read('android/app/src/studio/java/io/github/yishaiguedj1/snowball/DlWork.kt')), 'Studio — הרשימה של DlEngine');
ok(/DlEngine\.SUBS/.test(read('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmEngine.kt')), 'DM — אותה רשימה');
const ds = read('android/app/src/dmcore/java/io/github/yishaiguedj1/snowball/dm/DmSubs.kt');
ok(/filter \{ !it\.auto \}/.test(ds) && !/anyAuto/.test(ds), 'DmSubs.pick — רק של היוצר');
const pl = read('translator/pipeline.py');
ok(/def subref_grade\(/.test(pl) && /self\.sub_ref\(edit\)/.test(pl) && /if q\['g'\] == 'lo':\s+return \[\]/.test(pl), 'שער האיכות: נמוכה — לא נכנסת להגהה');
const en = read('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmEngine.kt');
ok(/DmStore\.ping\(\); DmNotif\.update\(ctx\)/.test(en), 'פס ההתקדמות באפליקציה מתעדכן יחד עם ההתראה (DmStore.ping)');
const ui = read('android/app/src/dm/java/io/github/yishaiguedj1/snowball/dm/DmUi.kt');
ok(/mutableStateOf\(true\)/.test(ui) && /if \(!audio\) ListItem\(headlineContent = \{ Text\(stringResource\(R\.string\.dmSubs\)\)/.test(ui), '"עם כתוביות" תמיד מוצג ומסומן כברירת מחדל');
console.log(fails ? `FAIL ${fails}` : 'all ok');
process.exit(fails ? 1 : 0);
