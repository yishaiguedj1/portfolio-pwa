// ספריית הסרטונים ב־Drive שלך (17/11/2026, docs/studio-library-research.md): המניפסט (= translator/job.py lib_manifest),
// מה נשלח לשמירה (= normLibDx בשרתון), הלשונית בחוגה וההחלפה של "הסרטונים שלי".
// הרצה: node tests/studio-library.test.js
const fs = require('fs');
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const R = 'R2_jLIBjobAAAAAAAAAAAAAA';

(async () => {
  global.document = { documentElement: { lang: 'he' } };
  global.t = (k) => k;
  const st = await import(path.join(root, 'studio.js'));
  const sj = read('studio.js'), py = read('translator/job.py'), srv = read('ibkr-proxy/lib/studio.js');

  /* ---------- 1. המניפסט ---------- */
  const man = { v: 1, job: 'jLIBjobAAAAAAAAAAAAAA', t: 'הרצאה', k: 'tr', fr: 'en', to: ['he'], d: 61.4, ch: [{ t: 0, n: 'פתיחה' }, { t: -3, n: 'רע' }, { t: 9, n: '' }], at: 5,
    f: [{ r: 'b', k: 'compact', n: 'a.mp4', id: 'driveFile12345', s: 9, md5: 'x' }, { r: 'z', k: 'srt', n: 'a.srt', id: 'driveFile67890', s: 1 }, { r: 'v', id: R + '_aaaaaaaaaaaa' }, { r: 'v', id: 'bad id' }] };
  const m = st.normLibMan(man);
  ok(m && m.job === man.job && m.t === 'הרצאה' && m.fr === 'en' && m.to.join() === 'he' && m.d === 61, 'normLibMan: השדות המוכרים');
  ok(m.ch.length === 1 && m.ch[0].n === 'פתיחה', 'normLibMan: פרק עם זמן שלילי / בלי שם — נזרק');
  ok(m.f.length === 2 && m.f[1].r === 'x' && !m.f.some((x) => x.id.startsWith('R2_')), 'normLibMan: רק קבצים ב־Drive; תפקיד לא מוכר → x');
  ok(st.normLibMan(Object.assign({}, man, { v: 2 })) === null && st.normLibMan(Object.assign({}, man, { f: [] })) === null && st.normLibMan(null) === null, 'normLibMan: גרסה אחרת / בלי קבצים — null');
  ok(/'v': 1, 'job': job, 't': /.test(py) && /'f': files/.test(py), 'המניפסט של העובד — אותם שדות');

  /* ---------- 2. מה נשלח לשמירה ---------- */
  const rec = { id: 'jLIBjobAAAAAAAAAAAAAA', spec: { name: 'Talk.mov', from: 'auto', to: ['he'], dur: 90.6, vi: 0, ka: 0 }, chap: [{ t: 12.4, title: 'פרק' }],
    srv: { fv: R + '_ffffffffffff', sx: 0, out: [{ id: R + '_aaaaaaaaaaaa', k: 'compact' }, { id: R + '_bbbbbbbbbbbb', k: 'cues' }, { id: 'driveFile12345', k: 'srt' }] } };
  const it = st.libItems(rec);
  ok(it.length === 3 && it[0].id === R + '_ffffffffffff' && /\.mov$/.test(it[0].n), 'libItems: המקור ראשון (בסיומת שלו), ואז התוצרים');
  ok(!it.some((x) => x.id === 'driveFile12345'), 'libItems: רק מה שב־R2 (השרתון מעתיק מ־R2)');
  ok(st.libItems(Object.assign({}, rec, { srv: Object.assign({}, rec.srv, { sx: 1 }) })).length === 2, 'libItems: המקור נמחק (sx) — בלעדיו');
  const mt = st.libMeta(rec);
  ok(mt.k === 'tr' && mt.fr === '' && mt.to.join() === 'he' && mt.d === 91 && mt.ch[0].t === 12 && mt.ch[0].n === 'פרק', 'libMeta: שפה "auto" לא נשלחת, פרקים בשניות שלמות');
  ok(/const LIB_MAX = 16/.test(srv) && /LIB_MAX = 16/.test(py) && /slice\(0, 16\)/.test(sj), 'עד 16 קבצים — בטלפון, בשרתון ובעובד');

  const sn = read('studionet.js'), lbody = sn.slice(sn.indexOf('async function libList'), sn.indexOf('async function libThumbs'));
  ok(/e\.status !== 400/.test(lbody) && /qs\.delete\('orderBy'\)/.test(lbody) && /lb\.err = /.test(sj) && /'st-lib-errc'/.test(sj), 'הטעינה: 400 מ־Drive — ניסיון בלי orderBy, וקוד השגיאה על המסך');

  /* ---------- 3. הלשונית והחלפת "הסרטונים שלי" ---------- */
  ok(/const ST_SIB = \['ka', 'home', 'vi', 'job', 'lib', 'tower'\]/.test(sj) && /\{ k: 'lib', ico: ST_DIAL_ICO\.lib, lbl: T\('studioDialLib'\) \}/.test(sj), 'החוגה: ספרייה בין "העבודה" למגדל');
  ok(/x === 'litem' \? \['lib', null\]/.test(sj) && /if \(ch\.some\(\(x\) => x\.v === 'lib'\)\) return 'lib';/.test(sj), 'פריט בספרייה — תחת הלשונית');
  ok(/'rr', 'litem'\]/.test(sj) && /if \(ui\.view === 'litem'\) lpStop\(\);/.test(sj), 'פריט — בלי החלקה (נגן), והנגן נעצר ביציאה');
  ok(/label: T\('studioLibT'\), sub: T\('studioLibRowS'\), onClick: \(\) => go\('lib'\)/.test(sj) && !/onClick: \(\) => goVids\(''\)/.test(sj), 'ההגדרות: הספרייה במקום "הסרטונים שלי"');
  ok(/appProperties has \{ key='snbRole' and value='m' \}/.test(read('studionet.js')) && /prop='snbRole' if lib/.test(py), 'הרשימה = המניפסטים (snbRole=m) שהעובד כותב');
  console.log(n + ' בדיקות עברו');
})().catch((e) => { console.error('✗', e); process.exit(1); });
