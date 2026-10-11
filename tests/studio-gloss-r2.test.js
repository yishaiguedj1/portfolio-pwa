// 11/10/2026: מילון המונחים ב־R2 — הטלפון (studionet.js): קריאה וכתיבה בקישורים חתומים, מעבר חד־פעמי מ־Drive,
// ונפילה ל־Drive כשהשרתון בלי R2. השרתון והעובד: tests/studio-r2-flow.test.js (סעיף 7), test_glossary_from_r2.
// הרצה: node tests/studio-gloss-r2.test.js
const path = require('path');
const fs = require('fs');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');

(async () => {
  const net = await import(path.join(root, 'studionet.js'));
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  /* השרתון, R2 ו־Drive מדומים */
  const W = { r2: true, obj: null, drive: null, calls: [], puts: 0 };
  const res = (status, body, json) => ({ status, ok: status >= 200 && status < 300, json: async () => json, text: async () => body });
  const fetch = async (url, o = {}) => {
    const m = o.method || 'GET';
    W.calls.push(m + ' ' + url.slice(0, 60));
    if (url === 'https://p/api/studio') {
      const b = JSON.parse(o.body);
      if (b.op === 'glossUrl') return res(200, '', W.r2 ? { ok: true, r2: true, get: 'https://acc.eu.r2/gl?sig=g', put: 'https://acc.eu.r2/gl?sig=p' } : { ok: true, r2: false });
      if (b.op === 'drive') return res(200, '', { ok: true, token: 'DT', exp: Date.now() + 3600e3 });
      return res(400, '', { ok: false, error: 'bad_op' });
    }
    if (url.startsWith('https://acc.eu.r2/gl?sig=g')) return W.obj == null ? res(404, '<Error/>') : res(200, W.obj);
    if (url.startsWith('https://acc.eu.r2/gl?sig=p') && m === 'PUT') { W.obj = String(o.body); W.puts++; return res(200, ''); }
    if (url.startsWith('https://www.googleapis.com/drive/v3/files?q=')) return res(200, '', { files: W.drive == null ? [] : [{ id: 'GLOSSDRIVE01', size: String(W.drive.length) }] });
    if (url.startsWith('https://www.googleapis.com/drive/v3/files/GLOSSDRIVE01?alt=media')) return res(200, W.drive);
    return res(404, '', {});
  };
  const N = net.createNet({ fetch, idToken: async () => 'T', base: () => 'https://p', sleep: async () => {} });

  // 1. מעבר חד־פעמי: אין קובץ ב־R2, יש מילון ב־Drive → נקרא ונכתב ל־R2
  W.drive = 'Moat\tחפיר\n# הערה\nBuyback\tרכישה עצמית\tשם\n';
  let r = await N.glossLoad();
  ok(r.id === 'r2' && r.rows.length === 2 && r.moved === 2 && W.puts === 1, 'אין מילון ב־R2 — המילון מ־Drive עובר אליו פעם אחת');
  ok(JSON.stringify(net.glParse(W.obj)) === JSON.stringify(r.rows) && JSON.stringify(S.glParse(W.obj)) === JSON.stringify(r.rows), 'הקובץ ב־R2 — אותו פורמט (טלפון ושרתון קוראים זהה)');
  // 2. מעכשיו — מ־R2 (Drive לא נקרא)
  W.drive = 'Moat\tמשהו אחר\n'; W.calls = [];
  r = await N.glossLoad();
  ok(r.id === 'r2' && r.rows[0][1] === 'חפיר' && !W.calls.some((c) => c.includes('googleapis')), 'יש מילון ב־R2 — רק משם, בלי Drive');
  // 3. שמירה
  const id = await N.glossSave('r2', net.glUpsert(r.rows, [['Float', 'פלואט', '']]));
  ok(id === 'r2' && S.glParse(W.obj).length === 3 && W.puts === 2, 'שמירה — ישירות ל־R2 בקישור חתום');
  // 4. משתמש חדש בלי Drive מחובר — מתחילים ריק ב־R2
  W.obj = null; W.drive = null; W.puts = 0;
  r = await N.glossLoad();
  ok(r.id === 'r2' && r.rows.length === 0 && W.puts === 0, 'בלי מילון בכלל — ריק, ולא כותבים קובץ ריק');
  // 5. שרתון בלי R2 → Drive בדיוק כמו קודם
  W.r2 = false; W.drive = 'Moat\tחפיר\n';
  r = await N.glossLoad();
  ok(r.id === 'GLOSSDRIVE01' && r.rows.length === 1, 'שרתון בלי R2 — המילון מ־Drive כמו קודם');
  // 6. גלויים בטלפון ובשרתון
  const sj = fs.readFileSync(path.join(root, 'studio.js'), 'utf8'), api = fs.readFileSync(path.join(root, 'ibkr-proxy/api/studio.js'), 'utf8');
  ok(/ui\.r2 = j\.r2 === true/.test(sj) && /if \(!ui\.r2 && \(!store\.drive \|\| !store\.drive\.connected\)\)/.test(sj), 'דף המילון פתוח גם בלי Drive כשהשרתון עם R2');
  ok(/r2: !!R2\.config\(\)\.ok/.test(api) && /S\.glKey\(uid\)/.test(api) && /expires: 300/.test(api), 'השרתון: status אומר אם יש R2; הקישורים — לקובץ של המשתמש, לחמש דקות');
  ok(S.glKey('ownerUid0001') === 'gl/ownerUid0001.tsv' && S.glKey('../x') === '', 'המפתח — מחוץ ל־st/ (קבצי העבודות) ורק למזהה תקין');

  console.log('\n' + n + ' passed');
})().catch((e) => { console.error(e); process.exit(1); });
