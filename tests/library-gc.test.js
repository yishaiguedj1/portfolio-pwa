// מנהל הספרייה, ס׳9 (11/10/2026): הניקוי היומי של R2 והגיבוי של הקטלוג החדש.
// הכלל: מוחקים רק מה שבוודאות לא בשימוש, ותמיד עם השהיה; קטלוג חסר או חשוד — לא נוגעים בכלום.
// הרצה: node tests/library-gc.test.js
const path = require('path');
const zlib = require('zlib');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const GC = require(path.join(root, 'ibkr-proxy/lib/libgc.js'));
const C = require(path.join(root, 'ibkr-proxy/lib/libcat.js'));
const BK = require(path.join(root, 'ibkr-proxy/lib/backup.js'));
const DAY = 864e5, NOW = Date.parse('2026-12-01T03:35:00Z');
const m = (c) => c.repeat(32);

(async () => {
  const cat = C.normCatalog({ v: 9, books: {
    'id-a': { id: 'id-a', title: 'א', st: 'pub', files: [{ fmt: 'epub', md5: m('a'), size: 10 }], cover: { h: m('1') } },
    'id-b': { id: 'id-b', title: 'ב', st: 'pub', del: 1, files: [{ fmt: 'azw3', md5: m('b'), size: 10 }] },
  }, cfg: { source: 'r2', at: NOW - 40 * DAY } });
  ok(cat.cfg.at === NOW - 40 * DAY, 'הקטלוג שומר מתי המדף עבר ל־R2');
  const objs = [
    { key: 'lib/v2/in/' + m('t'), at: NOW - 2 * DAY },
    { key: 'lib/v2/in/' + m('u'), at: NOW - 3600e3 },
    { key: 'lib/v2/f/' + m('a') + '.epub', at: NOW - 90 * DAY },
    { key: 'lib/v2/f/' + m('b') + '.azw3', at: NOW - 90 * DAY },
    { key: 'lib/v2/f/' + m('c') + '.epub', at: NOW - 40 * DAY },
    { key: 'lib/v2/f/' + m('d') + '.epub', at: NOW - 5 * DAY },
    { key: 'lib/v2/f/' + m('e') + '.epub', at: 0 },
    { key: 'lib/v2/c/' + m('1') + '.jpg', at: NOW - 90 * DAY },
    { key: 'lib/v2/c/' + m('2') + '.jpg', at: NOW - 90 * DAY },
    { key: 'lib/LETTER000001.' + m('a') + '.epub', at: NOW - 200 * DAY },
    { key: 'lib/catalog.json', at: NOW - 200 * DAY },
    { key: 'lib/v2/cat.json.gz', at: NOW }, { key: 'lib/v2/pub.json.gz', at: NOW },
  ];
  for (let i = 1; i <= 230; i++) objs.push({ key: C.KEYS.arc(i), at: NOW - (i <= 20 ? 60 : 1) * DAY });
  let p = GC.gcPlan(cat, objs, NOW);
  const del = new Set(p.del);
  ok(del.has('lib/v2/in/' + m('t')) && !del.has('lib/v2/in/' + m('u')), 'קובץ זמני — רק אחרי יום');
  ok(!del.has('lib/v2/f/' + m('a') + '.epub') && !del.has('lib/v2/f/' + m('b') + '.azw3'), 'קובץ של ספר — נשמר, גם של ספר ב״נמחקו לאחרונה״');
  ok(del.has('lib/v2/f/' + m('c') + '.epub') && !del.has('lib/v2/f/' + m('d') + '.epub') && !del.has('lib/v2/f/' + m('e') + '.epub'), 'קובץ יתום — רק אחרי 30 יום, ובלי תאריך — לעולם לא');
  ok(del.has('lib/v2/c/' + m('2') + '.jpg') && !del.has('lib/v2/c/' + m('1') + '.jpg'), 'כריכה יתומה נמחקת, כריכה בשימוש נשמרת');
  ok(del.has('lib/LETTER000001.' + m('a') + '.epub') && del.has('lib/catalog.json'), 'המראה של Drive — נמחקת 30 יום אחרי המעבר');
  ok(!del.has('lib/v2/cat.json.gz') && !del.has('lib/v2/pub.json.gz'), 'הקטלוג ומבט הקוראים — לעולם לא');
  ok(p.why.arc === 20 && !del.has(C.KEYS.arc(230)), 'ארכיון: 200 האחרונות נשמרות תמיד, הישנות מ־30 יום נמחקות');

  p = GC.gcPlan(Object.assign({}, cat, { cfg: { source: 'r2', at: NOW - 10 * DAY } }), objs, NOW);
  ok(!p.del.some((k) => /LETTER|catalog\.json$/.test(k)), 'פחות מ־30 יום מהמעבר — המראה נשארת');
  p = GC.gcPlan(Object.assign({}, cat, { cfg: { source: 'drive', at: NOW - 90 * DAY } }), objs, NOW);
  ok(!p.del.some((k) => /LETTER|catalog\.json$/.test(k)), 'חזרו ל־Drive — המראה נשארת');

  /* בטיחות */
  const emptyCat = C.normCatalog({ v: 9, books: {} });
  p = GC.gcPlan(emptyCat, objs, NOW);
  ok(p.stop === 'orphans' && !p.del.length, 'קטלוג ריק מול קבצים — עוצרים (יותר מחצי יתומים)');
  ok(GC.gcPlan(null, objs, NOW).stop === 'no_cat', 'בלי קטלוג — לא נוגעים');
  const many = []; for (let i = 0; i < 900; i++) many.push({ key: 'lib/v2/in/' + String(i).padStart(32, '0'), at: NOW - 3 * DAY });
  ok(GC.gcPlan(cat, many, NOW).del.length === GC.GC_MAX, 'תקרה על מספר המחיקות בריצה');

  /* runGc */
  const gone = [];
  let r = await GC.runGc({ cat: async () => cat, list: async () => objs, del: async (k) => { gone.push(k); if (k.includes('in/')) throw new Error('x'); } }, NOW);
  ok(r.ok && r.gone === gone.length - 1, 'runGc: תקלה במחיקה אחת לא עוצרת את השאר');
  r = await GC.runGc({ cat: async () => null, list: async () => { throw new Error('לא אמור לקרוא'); }, del: async () => {} }, NOW);
  ok(!r.ok && r.stop === 'no_cat', 'runGc: בלי קטלוג ב־R2 — לא מונה ולא מוחק');

  /* הגיבוי: גם הקטלוג החדש (כבר דחוס — נשמר כמו שהוא) */
  const store = new Map([['lib/v2/cat.json.gz', zlib.gzipSync(Buffer.from('{"v":9}'))]]);
  const rb = await BK.runBackup({ listCol: async () => [], head: async (k) => store.has(k), get: async (k) => { if (!store.has(k)) throw new Error('404'); return store.get(k); }, put: async (k, b) => store.set(k, b), list: async () => [], del: async () => {} }, NOW);
  ok(rb.cat2 && store.get(BK.bkCat2Key(BK.bkDate(NOW))).equals(store.get('lib/v2/cat.json.gz')), 'הגיבוי היומי כולל את הקטלוג של מנהל הספרייה');

  /* החיבור לקרון */
  const fs = require('fs');
  const st = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/if \(r\.done\) await LM\.dailyGc\(deps, now\)/.test(st), 'הקרון: הניקוי רץ פעם ביום, רק אחרי שהקטלוג גובה');
  console.log('# ' + n + ' בדיקות עברו');
})().catch((e) => { console.error('FAIL', e && e.stack); process.exit(1); });
