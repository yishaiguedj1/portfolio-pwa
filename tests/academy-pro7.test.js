// Academy Pro F6 (03/11/2026): תרגום ספר שלם — libtrans.js. החלוקה למנות, השפות והמזהה — כאן;
// הניתוח של מסמכי הספר (DOMParser) ובניית הספר — ב־QA בדפדפן. הרצה: node tests/academy-pro7.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const lib = read('library.js'), tr = read('libtrans.js'), bai = read('ibkr-proxy/lib/bookai.js');

(async () => {
  const X = await import(path.join(root, 'libtrans.js'));

  const long = 'This is a sentence. '.repeat(200);
  const sp = X.splitLong(long);
  ok(sp.length === 3 && sp.every((s) => s.length <= 1400) && sp.join(' ') === long.trim(), 'פסקה ארוכה מתחלקת בסוף משפט, בלי לאבד טקסט');
  ok(X.splitLong('x'.repeat(3000)).map((s) => s.length).join() === '1400,1400,200' && X.splitLong('  ').length === 0, 'משפט ארוך בלי נקודה — חיתוך קשיח; ריק — כלום');
  ok(JSON.stringify(X.planBatches([100, 100, 8700, 50])) === '[[0,2],[2,4]]', 'מנות: לא עוברים 8800 תווים');
  ok(X.planBatches(new Array(85).fill(10)).map((r) => r[1] - r[0]).join() === '40,40,5', 'מנות: עד 40 פסקאות בבקשה (כמו בשרתון)');
  const lim = /bilingual: (\d+)/.exec(bai), cut = /slice\(0, (\d+)\)\.map\(\(p\) => one\(p, (\d+)\)\)/.exec(bai);
  ok(lim && +lim[1] >= 8800 && cut && +cut[1] >= 40 && +cut[2] >= 1400, 'המגבלות תואמות את bookai (סך התווים, מספר הפסקאות, אורך פסקה)');
  ok(X.langOpts('he', 'en').join() === 'he,ar,ru' && X.langOpts('en', 'he')[0] === 'en', 'שפות היעד: בלי שפת הספר, היעד המוצע ראשון');
  ok(X.langOpts('xx', '').every((l) => /^(he|en|ar|ru|fr|es|de)$/.test(l)), 'שפות היעד: רק מה שהשרתון מכיר');
  ok(X.trId('id-abc', 'he', 'replace') === 'id-abc-tr-he' && X.trId('id-abc', 'he', 'both') === 'id-abc-tr-he-bi', 'מזהה חדש — הספר המקורי לא נדרס, והרצה חוזרת מעדכנת את אותו ספר');
  ok(X.trTitle('ספר', 'אנגלית') === 'ספר · אנגלית' && X.estimate(0) === 1 && X.estimate(80000) === 10 && X.estimate(500, 85) === 3, 'שם הספר המתורגם, והערכת הבקשות');

  ok(/import\('\.\/libtrans\.js'\)/.test(lib) && /'libtrans\.js'/.test(read('tools/coregen.js')) && /'\.\/libtrans\.js'/.test(read('sw.js')), 'libtrans.js נטען רק כשנכנסים, ב־coregen וב־LIB_SHELL');
  ok(/trK\(\)\.then\(\(R\) => R\.openTranslate\(b\)\)/.test(lib) && /ai: aiCall/.test(lib.slice(lib.indexOf('async function trK'))), 'נקודת הכניסה בדף הספר, והבקשות דרך bookAi');
  ok(/E\.ai\('bilingual'/.test(tr) && /E\.importFiles\(\[file\], \{ id: newId \}\)/.test(tr) && /wakeLock/.test(tr), 'bilingual של השרתון, ספר חדש במזהה משלו, המסך לא נכבה');
  ok(/'quota' \|\| m === 'limit'/.test(tr) && /tbPartial/.test(tr), 'מכסה שנגמרה — הספר נשמר חלקי ומודיעים');
  ok(!/\b(confirm|alert|prompt)\(/.test(tr) && !/onclick=/.test(tr) && !/innerHTML/.test(tr) && !/fetch\(/.test(tr), 'libtrans: בלי confirm/alert/prompt, onclick, innerHTML ו־fetch');
  const strs = read('strings-academy.js');
  ['tbBook', 'tbRow', 'tbBookS', 'tbEst', 'tbProg', 'tbPartial', 'tbQuota', 'tbDone'].forEach((k) => ok(strs.includes('"' + k + '"'), 'מחרוזת ב־strings-academy: ' + k));
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL -', e); process.exit(1); });
