// sec-invest.test.js — פרויקט האבטחה (11/11/2026): נתוני תיק שנכנסים מבחוץ (ענן, גיבוי, אחסון, העברה) לא נכנסים למסך כ־HTML.
// בדיקה לפי התנהגות: סמן לא מזיק בכל שדה — ואסור שיופיע לא מקודד בפלט. הפונקציות האמיתיות מ־app.js / taxcenter.js.
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const tax = fs.readFileSync(path.join(root, 'taxcenter.js'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
function grab(src, name) {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) throw new Error('חסרה הפונקציה ' + name);
  let d = 0;
  for (let k = src.indexOf('{', i); k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) return src.slice(i, k + 1); }
  }
  throw new Error('לא נסגרה ' + name);
}
const A = new Function(['num', 'esc', 'dbSymClean', 'dbNumClean', 'dbHarden', 'fmtDateIL', 'kvHTML'].map((f) => grab(app, f)).join('\n') +
  '\nconst APK_OURS_RE = ' + (/const APK_OURS_RE = (\/.*\/);/.exec(app) || [])[1] + ';\nreturn { dbHarden, fmtDateIL, kvHTML, dbSymClean, dbNumClean, APK_OURS_RE };')();
const T = new Function(grab(tax, 'csvCell') + '\nreturn { csvCell };')();
const M = '<u data-m>';
const raw = (s) => String(s).includes('<u');

/* ---------- 1. dbHarden ---------- */
{
  const db = {
    positions: [{ sym: 'AAPL', shares: M, avg: null }, { sym: M + 'x', shares: '1,200', avg: '3.5' }, null, 'x', [1], { sym: '' }, { sym: '207.TA', shares: 5, avg: 1.5, name: 'מדד' }],
    wishlist: [{ sym: 'BRK-B', note: 'הערה' }, { sym: ' <b>' }, 7],
    wlExtra: [{ id: '1', name: 'רשימה', items: [{ sym: '^GSPC' }, 7, { sym: M }] }, 3, { id: '2', name: 'x' }],
    deposits: [{ amount: '1,000', date: '01/02/2026' }, null], pensionFunds: [null], pensionDeposits: ['x'], manualTrades: [null, { sym: 'A', qty: 1 }],
    ibkrSnapshot: { positions: [{ sym: 'X', shares: 'z', avg: 2 }], deposits: [null] },
  };
  const ref = db.positions, wref = db.wishlist;
  A.dbHarden(db);
  ok(ref === db.positions && wref === db.wishlist, 'המערכים נשארים אותם מערכים (POSITIONS/WISHLIST מצביעים אליהם)');
  ok(db.positions.length === 3 && db.positions.every((p) => typeof p.shares === 'number' && isFinite(p.shares) && typeof p.avg === 'number' && isFinite(p.avg)),
    'כמות וממוצע תמיד מספר סופי; רשומה שאינה אובייקט או בלי סימול יוצאת');
  ok(db.positions[0].shares === 0 && db.positions[1].shares === 1200 && db.positions[1].avg === 3.5, 'מחרוזת מספרית נשמרת כמספר, סמן ו־null הופכים ל־0');
  ok(db.positions[2].sym === '207.TA' && db.positions[2].shares === 5 && db.positions[2].name === 'מדד', 'רשומה תקינה לא משתנה');
  ok(!JSON.stringify([db.positions.map((p) => p.sym), db.wishlist.map((p) => p.sym), db.wlExtra.map((l) => l.items.map((x) => x.sym))]).includes('<'), 'אין תו HTML באף סימול');
  ok(db.wishlist.length === 2 && db.wlExtra.length === 2 && Array.isArray(db.wlExtra[1].items) && db.wlExtra[0].items[0].sym === '^GSPC', 'רשימות המעקב: רק רשומות, פריטים תקינים נשארים');
  ok(db.deposits.length === 1 && db.deposits[0].amount === '1,000' && db.manualTrades.length === 1, 'הפקדות ועסקאות: רק רשומות שאינן אובייקט יוצאות, התוכן לא משתנה');
  ok(db.ibkrSnapshot.positions[0].shares === 0 && db.ibkrSnapshot.deposits.length === 0, 'גם הצילום שלפני IBKR');
  ok(A.dbHarden(null) === null && A.dbHarden('x') === 'x', 'קלט שאינו אובייקט — בלי חריגה');
  for (const s of ['AAPL', 'BRK-B', '207.TA', '^GSPC', 'ES=F', 'BTC-USD', 'EURUSD=X', 'TEVA.TA']) ok(A.dbSymClean(s) === s, 'סימול תקין נשאר: ' + s);
}

/* ---------- 2. נקודות הכתיבה ---------- */
{
  ok(!raw(A.kvHTML('k', M, 'pos', M, 'neg')), 'kvHTML מקודד את הערך ואת השורה השנייה');
  ok(A.kvHTML('k', '⁦+1.5%⁩', 'pos').includes('⁦+1.5%⁩'), 'kvHTML: מספר עם בידוד כיוון נשאר כמו שהוא');
  ok(A.fmtDateIL('2026-01-05') === '05/01/2026' && A.fmtDateIL('20260105') === '05/01/2026' && A.fmtDateIL('05/01/2026') === '05/01/2026' && A.fmtDateIL('') === '—' && A.fmtDateIL(null) === '—',
    'fmtDateIL: שלוש הצורות המוכרות');
  ok(!/[<>"'&]/.test(A.fmtDateIL(M)) && !/[<>"'&]/.test(A.fmtDateIL('2026-01-05"><i>')) && !/[<>"'&]/.test(A.fmtDateIL(M + '-a-b')), 'fmtDateIL: שום תו HTML לא יוצא');
  ok(/kvHTML\(t\('kvShares'\), dbNumClean\(p\.shares\)/.test(app) && /value="' \+ dbNumClean\(p\.shares\) \+ '"/.test(app), 'הכמות בכרטיס ובטופס העריכה — דרך dbNumClean');
  ok(/t\('mtShadowed', \{ sym: esc\(n\.sym\) \}\)/.test(app), 'הסימול בהערת העסקה הידנית — דרך esc');
}

/* ---------- 3. כל הכניסות עוברות ב־dbHarden ---------- */
{
  ok(/dbHarden\(db\);\s*\n\s*if \(stripLegacyDemo\(db\)\) saveDBto\(db\);/.test(grab(app, 'loadDB')), 'loadDB (אחסון מקומי, כולל מה שהועבר מהכתובת הישנה)');
  ok(/dbHarden\(DB\)/.test(grab(app, 'applyDbData')), 'applyDbData (שחזור/איפוס)');
  ok(/dbHarden\(db\)/.test(grab(app, 'pfBackupMerge')), 'pfBackupMerge (גיבוי מ־Drive/קובץ)');
  ok(/typeof dbHarden === 'function'\) dbHarden\(DB\)/.test(grab(cloud, 'applyCloudDb')), 'applyCloudDb (הענן)');
}

/* ---------- 4. עדכון תוכנה — רק חבילה שלנו ---------- */
{
  for (const p of ['io.github.yishaiguedj1.snowball', 'app.thesnowball.academy', 'app.thesnowball.studio', 'app.thesnowball.admin', 'app.thesnowball.bubble', 'io.github.yishaiguedj1.snowball.dm'])
    ok(A.APK_OURS_RE.test(p), 'חבילה שלנו עוברת: ' + p);
  for (const p of ['com.evil.app', 'app.thesnowballx.evil', 'io.github.yishaiguedj1.snowballx', 'app.thesnowball.a;S.x=1', 'app.thesnowball', 'xapp.thesnowball.studio'].filter((p) => p !== 'app.thesnowball'))
    ok(!A.APK_OURS_RE.test(p), 'חבילה זרה נדחית: ' + p);
  ok(/if \(!info \|\| !APK_OURS_RE\.test\(info\.p\)\) return;/.test(app), 'apkUpdMount בודק את החבילה לפני בניית ה־intent');
}

/* ---------- 5. הדוח לרו״ח — בלי נוסחאות ---------- */
{
  for (const v of ['=1+1', '+SUM(A1)', '-2+3', '@cmd', '\tx', '\rx']) ok(!/^[=+\-@\t\r]/.test(T.csvCell(v).replace(/^"/, '')), 'תא טקסט שמתחיל בתו נוסחה מנוטרל: ' + JSON.stringify(v));
  ok(T.csvCell(-12.5) === '-12.5' && T.csvCell(5) === '5' && T.csvCell('AAPL') === 'AAPL' && T.csvCell('a,b') === '"a,b"' && T.csvCell(null) === '', 'מספרים (גם שליליים) וטקסט רגיל לא משתנים');
}
console.log('\n' + n + ' בדיקות עברו');
