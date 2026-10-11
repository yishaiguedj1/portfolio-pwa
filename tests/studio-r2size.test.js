// 11/10/2026 — r2_size: עבודה אמיתית נכשלה בסוף, בשמירת קובצי הטקסט ל־R2. fetch של Node מבקש gzip, ובסוג "דחיס"
// (JSON / טקסט) Cloudflare מחזיר HEAD בלי Content-Length → הגודל נקרא 0 → "ההעלאה לא שלמה". R2 המדומה מתנהג כך עכשיו.
// הרצה: node tests/studio-r2size.test.js
const path = require('path');
let n = 0;
function ok(c, name) { n++; if (!c) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }
const root = path.join(__dirname, '..');
const { fakeR2, ENV } = require('./_r2fake');
const R2 = require(path.join(root, 'ibkr-proxy/lib/r2.js'));
const SR = require(path.join(root, 'ibkr-proxy/lib/studior2.js'));

(async () => {
  const c = R2.config(ENV);
  const json = Buffer.from(JSON.stringify({ cues: Array.from({ length: 50 }, (_, i) => ({ id: i + 1, t: 'שלום עולם ' + i })) }));
  for (const mode of [true, 'always']) {
    R2._reset();
    const R = fakeR2({ squeeze: mode });
    const d = R.deps;
    const k = 'st/ownerUid0001/R2_j' + 'a'.repeat(20) + '_' + 'b'.repeat(12);
    await R2.putBuf(c, d, k, json, 'application/json');
    const h = await R2.head(c, d, k);
    ok(h && h.size === json.length, (mode === 'always' ? 'Cloudflare מתעלם מ־identity' : 'HEAD עם identity') + ' — הגודל הנכון של קובץ JSON');
    const bin = Buffer.alloc(1000, 7);
    await R2.putBuf(c, d, k + 'x', bin, 'video/mp4');
    ok((await R2.head(c, d, k + 'x')).size === 1000, 'סוג לא דחיס — הגודל מהכותרת, כמו קודם');
    ok(await R2.head(c, d, k + 'zz') === null, 'קובץ שלא קיים — null');

    // העלאה מלאה של קובץ טקסט דרך המסלול של העובד/הטלפון: up → PUT → done
    const folder = 'R2_j' + 'c'.repeat(20);
    const st = await SR.upStart(c, d, { uid: 'ownerUid0001', folder, size: json.length, type: 'application/json', name: 'cues.json', by: 'worker' });
    const pr = await R.fetch(st.res.urls[1], { method: 'PUT', body: json });
    ok(pr.status === 200, 'החלק עלה');
    const dn = await SR.upDone(c, d, { id: st.res.id, rec: st.rec, up: st.res.up, uid: 'ownerUid0001' });
    ok(dn.res.ok && dn.res.file.size === json.length, 'סגירת העלאה של JSON — לא r2_size (' + (mode === 'always' ? 'מהרשימה' : 'identity') + ')');
    const srt = Buffer.from('1\n00:00:01,000 --> 00:00:02,000\nשלום\n');
    const s2 = await SR.upStart(c, d, { uid: 'ownerUid0001', folder, size: srt.length, type: 'application/x-subrip', name: 'he.srt', by: 'worker' });
    await R.fetch(s2.res.urls[1], { method: 'PUT', body: srt });
    ok((await SR.upDone(c, d, { id: s2.res.id, rec: s2.rec, up: s2.res.up, uid: 'ownerUid0001' })).res.ok, 'סגירת העלאה של SRT');
  }
  // הכותרת לא חתומה (Cloudflare רשאי לנרמל אותה) — החתימה של HEAD בלי accept-encoding
  const R = fakeR2();
  let seen = null;
  const spy = async (u, init) => { if (init.method === 'HEAD') seen = init.headers; return R.fetch(u, init); };
  R2._reset();
  await R2.putBuf(c, R.deps, 'st/u/x', Buffer.from('{}'), 'application/json');
  await R2.head(c, { fetch: spy, now: R.deps.now }, 'st/u/x');
  ok(seen && seen['accept-encoding'] === 'identity' && !/accept-encoding/.test(seen.Authorization), 'identity נשלח בלי להיכנס לחתימה');
  // "המשך" אוטומטי: דחייה של האחסון (store_fail) קבועה — גם כשנשארה התראת Drive פתוחה (כך קרה: worker_step + up_fail = "חולף")
  const S = require(path.join(root, 'ibkr-proxy/lib/studio.js'));
  const INC = require(path.join(root, 'ibkr-proxy/lib/studioinc.js'));
  ok(S.isTransient('store_fail', ['drive:up_fail']) === false, 'store_fail — לא "חולף" גם עם התראת Drive פתוחה');
  ok(S.isTransient('store_net', []) === true, 'store_net — חולף (ניתוק): "המשך" אוטומטי פעם אחת');
  ok(S.isTransient('worker_step', ['drive:up_fail']) === true, 'worker_step עם התראת Drive — כמו קודם');
  ok(INC.ERR_INFO.store_fail && INC.ERR_INFO.store_fail[0] === 'drive' && INC.ERR_INFO.store_net[0] === 'drive', 'תקלה: הרכיב = האחסון');
  // הטלפון: הסיבה בכרטיס, לא "משהו השתבש (worker_step)"; ובלי כפילות בפרטים הטכניים
  const fs = require('fs');
  const src = fs.readFileSync(path.join(root, 'studio.js'), 'utf8');
  ok(/MSG_CODES = \['worker_step', 'worker', 'store_fail', 'store_net'\]/.test(src) && /cardMsg\(rec, ph\) \|\| errText/.test(src), 'כשל כללי — הכרטיס מציג את מה שהעובד כתב');
  ok(/function workerMsgRow\(rec, ph\) \{\n  if \(cardMsg\(rec, ph\)\) return null;/.test(src), 'אותה הודעה לא מופיעה פעמיים');
  const job = fs.readFileSync(path.join(root, 'translator/job.py'), 'utf8');
  ok(/except \(SystemExit, Exception\) as e:   # noqa: BLE001 — קובץ עזר/.test(job), 'העובד: קובץ עזר שנכשל לא מפיל את סוף העבודה');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
