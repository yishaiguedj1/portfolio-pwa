'use strict';
/* מעקב תעבורה ואחסון לשירותי הענן (23/10/2026) — מפענחים טהורים, מצב "כבוי" בלי טוקנים, ושליפה מדומה.
   הרצה: node tests/usage-monitor.test.js */
const assert = require('assert');
const U = require('../ibkr-proxy/lib/usage');

// Vercel: תשובה מוכרת → שני פריטים באחוזים; צורה לא מוכרת → shape (לא מנחשים)
const v = U.parseVercel({ bandwidth: 50e9, invocations: 250000 });
assert.strictEqual(v.st, 'ok');
assert.strictEqual(v.items[0].k, 'bw');
assert.strictEqual(v.items[0].used, 50);
assert.strictEqual(v.items[0].pct, 50);
assert.strictEqual(v.items[1].pct, 25);
assert.deepStrictEqual(U.parseVercel({ foo: 1 }), { st: 'err', err: 'shape', items: [] });

// R2: אחסון בבייט ופעולות; בלי נתונים — ok עם null (לא 0)
const r = U.parseR2({ data: { viewer: { accounts: [{ r2StorageAdaptiveGroups: [{ max: { payloadSize: 5e9 } }], r2OperationsAdaptiveGroups: [{ sum: { requests: 1100000 } }] }] } } });
assert.strictEqual(r.items[0].used, 5);
assert.strictEqual(r.items[0].pct, 50);
assert.strictEqual(r.items[1].used, 1100000);
const rEmpty = U.parseR2({ data: { viewer: { accounts: [{ r2StorageAdaptiveGroups: [], r2OperationsAdaptiveGroups: [] }] } } });
assert.strictEqual(rEmpty.items[0].used, null, 'אין נתון = null, לא 0');
assert.deepStrictEqual(U.parseR2({}), { st: 'err', err: 'shape', items: [] });

// Firestore: סכום נקודות של Cloud Monitoring (int64Value כמחרוזת)
assert.strictEqual(U.sumPoints({ timeSeries: [{ points: [{ value: { int64Value: '1200' } }, { value: { int64Value: '300' } }] }, { points: [{ value: { int64Value: '5' } }] }] }), 1505);
assert.strictEqual(U.sumPoints({ timeSeries: [] }), null);
const fs = U.parseFs({ timeSeries: [{ points: [{ value: { int64Value: '25000' } }] }] }, { timeSeries: [{ points: [{ value: { int64Value: '100' } }] }] });
assert.strictEqual(fs.items[0].pct, 50, 'קריאות: 25,000 מתוך 50,000 ביום');
assert.strictEqual(fs.items[1].used, 100);

(async () => {
  // בלי טוקנים — כולם "off" עם מכסות (בלי נתונים מומצאים), ובלי קריאה לרשת
  let calls = 0;
  const noNet = async () => { calls++; throw new Error('should not fetch'); };
  const off = await U.usageAll({}, noNet, Date.UTC(2026, 9, 24));
  assert.strictEqual(off.vercel.st, 'off');
  assert.strictEqual(off.r2.st, 'off');
  assert.strictEqual(off.firestore.st, 'off');
  assert.strictEqual(off.vercel.items[0].used, null);
  assert.strictEqual(calls, 0, 'בלי טוקנים אין בקשות לרשת');

  // Vercel עם טוקן ותשובה מדומה; R2 מחזיר HTTP 403 — לא מפיל את Vercel
  const seen = [];
  const fake = async (url, opt) => {
    seen.push(url);
    if (url.startsWith('https://api.vercel.com/')) {
      assert.ok(opt.headers.Authorization.startsWith('Bearer '), 'טוקן בכותרת');
      assert.ok(!url.includes('token'), 'הטוקן לא בכתובת');
      return { status: 200, json: async () => ({ bandwidth: 10e9, invocations: 1000 }) };
    }
    return { status: 403, json: async () => ({}) };
  };
  const env = { VERCEL_USAGE_TOKEN: 'vt_test', CF_USAGE_TOKEN: 'cf_test', R2_ACCOUNT_ID: 'acc' };
  const mixed = await U.usageAll(env, fake, Date.UTC(2026, 9, 24));
  assert.strictEqual(mixed.vercel.st, 'ok');
  assert.strictEqual(mixed.vercel.items[0].used, 10);
  assert.strictEqual(mixed.r2.st, 'err');
  assert.strictEqual(mixed.r2.err, 'http_403', 'קוד שגיאה בלבד, בלי פרטי הספק');
  assert.ok(seen.some((u) => u.includes('/v1/usage?from=')), 'שאלה לתחילת החודש');

  // שגיאת רשת בספק אחד לא מפילה את השאר
  const boom = async () => { throw new Error('ECONNRESET'); };
  const down = await U.usageAll({ VERCEL_USAGE_TOKEN: 'x' }, boom, Date.UTC(2026, 9, 24));
  assert.strictEqual(down.vercel.st, 'err');
  assert.strictEqual(down.vercel.err, 'net');
  assert.strictEqual(down.r2.st, 'off');

  // 24/10/2026: האחסון לפי דלי (R2) ו־Drive של הגיבוי
  assert.deepStrictEqual(U.r2Buckets({ R2_BUCKET: 'snb-studio', R2L_BUCKET: 'snb-learn', R2_USAGE_BUCKETS: 'snb-staging, snb-studio,Bad_Name' }), ['snb-studio', 'snb-learn', 'snb-staging'], 'בלי כפילות, רק שמות חוקיים');
  assert.deepStrictEqual(U.r2Buckets({}), []);
  const sq = U.storeQuery(['snb-studio']);
  assert.ok(sq.includes('bucketName:"snb-studio"') && sq.includes('bucketName:"eu_snb-studio"'), 'גם הדלי ב־EU');
  assert.ok(sq.includes('datetime_geq:$s') && sq.includes('orderBy:[datetime_DESC]') && !sq.includes('datetimeHour'), 'שמות השדות לפי התיעוד');
  const ps = U.parseStore({ data: { viewer: { accounts: [{ p0: [], e0: [{ max: { payloadSize: 2.5e9, metadataSize: 5e6, objectCount: 1234 } }], p1: [{ max: { payloadSize: 1e9, objectCount: 10 } }], e1: [] }] } } }, ['snb-studio', 'snb-learn']);
  assert.strictEqual(ps.st, 'ok');
  assert.deepStrictEqual(ps.b, [{ name: 'snb-studio', gb: 2.505, n: 1234 }, { name: 'snb-learn', gb: 1, n: 10 }]);
  assert.deepStrictEqual(U.parseStore({ data: { viewer: { accounts: [{ p0: [], e0: [] }] } } }, ['x-y']).b, [], 'דלי בלי נתון — לא מומצא');
  assert.strictEqual(U.parseStore({}, ['a-b']).err, 'shape');
  assert.deepStrictEqual(U.parseDrive({ storageQuota: { usage: '3200000000', limit: '15000000000' } }), { st: 'ok', gb: 3.2, lim: 15 });
  assert.strictEqual(U.parseDrive({}).st, 'err');
  const now0 = Date.UTC(2026, 9, 24, 12);
  const m1 = U.storeMerge(null, { st: 'ok', b: [{ name: 'snb-studio', gb: 1, n: 2 }] }, { st: 'ok', gb: 3, lim: 15 }, now0);
  assert.strictEqual(m1.r2.b[0].gb, 1); assert.strictEqual(m1.drive.lim, 15);
  const m2 = U.storeMerge(m1, { st: 'off', b: [] }, { st: 'err', err: 'net' }, now0 + 3600e3);
  assert.deepStrictEqual(m2, m1, 'ריצה בלי טוקן / עם תקלה לא מוחקת את מה שנמדד');
  // r2Store: בלי טוקן — off, בלי בקשה; עם טוקן — בקשה אחת ל־GraphQL
  let gc = 0;
  const gql = async (url, opt) => { gc++; assert.ok(url.endsWith('/graphql')); const q = JSON.parse(opt.body).query; assert.ok(q.includes('snb-learn'));
    if (q.includes('ops:')) return { status: 200, json: async () => ({ data: { viewer: { accounts: [{ ops: [{ sum: { requests: 3e6 }, dimensions: { actionType: 'PutObject' } }, { sum: { requests: 2e7 }, dimensions: { actionType: 'GetObject' } }, { sum: { requests: 9e9 }, dimensions: { actionType: 'DeleteObject' } }],
      d0: [{ max: { payloadSize: 30e9 }, dimensions: { date: '2026-10-01' } }, { max: { payloadSize: 34e9 }, dimensions: { date: '2026-10-02' } }] }] } } }) };
    return { status: 200, json: async () => ({ data: { viewer: { accounts: [{ p0: [{ max: { payloadSize: 4e9, objectCount: 7 } }] }] } } }) }; };
  assert.strictEqual((await U.r2Store({ R2_BUCKET: 'snb-learn' }, gql, now0)).st, 'off');
  assert.strictEqual(gc, 0);
  const rs = await U.r2Store({ CF_USAGE_TOKEN: 't', R2_ACCOUNT_ID: 'a', R2_BUCKET: 'snb-learn' }, gql, now0);
  assert.strictEqual(gc, 2, 'גודל ואז עלות'); assert.deepStrictEqual(rs.b, [{ name: 'snb-learn', gb: 4, n: 7 }]);
  // 24 באוקטובר: 32GB ממוצע שיא יומי → 22 מעל החינם × 0.015 = 0.33; A: 3M עד היום → צפי 3M×31/24 = 3.875M → 2.875M × 4.5 = 12.94; B: 20M → 25.83M → 15.83M × 0.36 = 5.70
  assert.deepStrictEqual(rs.cost, { st: 0.33, a: 12.94, b: 5.7, proj: 18.97, mtd: 12.86, gbm: 32, pa: 3875000, pb: 25833333 });
  const gerr = async () => ({ status: 200, json: async () => ({ errors: [{ message: 'unknown field' }], data: null }) });
  assert.strictEqual((await U.r2Store({ CF_USAGE_TOKEN: 't', R2_ACCOUNT_ID: 'a', R2_BUCKET: 'snb-learn' }, gerr, now0)).err, 'gql');

  // העלות — מקרי קצה
  assert.deepStrictEqual(U.opsByClass([{ sum: { requests: 5 }, dimensions: { actionType: 'ListObjects' } }, { sum: { requests: 2 }, dimensions: { actionType: 'Mystery' } }, { sum: { requests: 9 }, dimensions: { actionType: 'AbortMultipartUpload' } }]), { a: 5, b: 2 }, 'לא מוכר = B (זול), מחיקה = חינם');
  assert.strictEqual(U.r2Cost({ gbMonth: 9.2, a: 1000, b: 1000, day: 1, days: 30 }).proj, 0, 'בתוך החינם — אפס');
  assert.strictEqual(U.r2Cost({ gbMonth: 10.1, day: 10, days: 30 }).st, 0.02, 'מעוגל למעלה ל־11GB ($0.015 → סנטים)');
  assert.ok(U.costQuery(['snb-studio']).includes('dimensions{actionType}') && U.costQuery(['snb-studio']).includes('bucketName:"eu_snb-studio"'));
  const mc = U.storeMerge({ r2: { at: 1, b: [{ name: 'x-y', gb: 1, n: 1 }], cost: { proj: 3 } } }, { st: 'ok', b: [{ name: 'x-y', gb: 2, n: 1 }] }, null, 7200e3);
  assert.deepStrictEqual(mc.r2.cost, { proj: 3 }, 'העלות נשארת כשהשאלה עליה נכשלה');

  // 24/10/2026: שגיאה של R2 נשמרת בקוד; מדידה מוצלחת מוחקת אותה
  const me = U.storeMerge(m1, { st: 'err', err: 'gql', b: [] }, null, now0 + 7200e3);
  assert.deepStrictEqual(me.r2e, { err: 'gql', at: Math.round((now0 + 7200e3) / 1000) }); assert.strictEqual(me.r2.b[0].gb, 1, 'הגודל הקודם נשאר');
  assert.strictEqual(U.storeMerge(me, { st: 'off', b: [] }, null, now0).r2e.err, 'gql', 'ריצה בלי טוקן לא מוחקת את השגיאה');
  assert.strictEqual(U.storeMerge(me, { st: 'ok', b: [{ name: 'snb-studio', gb: 2 }] }, null, now0).r2e, undefined);
  // מה שנמדד ב־Vercel (עם טוקן) מוצג בשרת שלנו (בלי טוקן) — רק במקום off
  const kept = U.provKeep(null, { vercel: { st: 'off', items: [] }, r2: { st: 'ok', items: [1] }, firestore: { st: 'err', err: 'api_off' } }, now0);
  assert.deepStrictEqual(Object.keys(kept).sort(), ['firestore', 'r2']); assert.strictEqual(kept.r2.at, now0 / 1000);
  const mg = U.provMerge({ vercel: { st: 'off' }, r2: { st: 'off' }, firestore: { st: 'ok', items: [2] } }, kept);
  assert.deepStrictEqual(mg.r2.items, [1]); assert.deepStrictEqual(mg.firestore.items, [2], 'מדידה מקומית גוברת'); assert.strictEqual(mg.vercel.st, 'off');
  assert.strictEqual(U.provKeep(kept, { r2: { st: 'off' } }, now0 + 1).r2.at, now0 / 1000, 'off לא דורס את השמור');
  // 403 של Google: API כבוי מול חסר תפקיד
  const g403 = (tx) => async () => ({ status: 403, text: async () => tx });
  assert.strictEqual((await U.r2Store({ CF_USAGE_TOKEN: 't', R2_ACCOUNT_ID: 'a', R2_BUCKET: 'snb-learn' }, g403('{"reason":"SERVICE_DISABLED"}'), now0)).err, 'api_off');
  assert.strictEqual((await U.r2Store({ CF_USAGE_TOKEN: 't', R2_ACCOUNT_ID: 'a', R2_BUCKET: 'snb-learn' }, g403('PERMISSION_DENIED'), now0)).err, 'http_403');

  // 24/10/2026: המשתנה של החשבון חייב להיות string! (accountTag לא nullable) — אחרת Cloudflare דוחה את כל השאילתה
  assert.ok(U.storeQuery(['a-b']).startsWith('query($a:string!,') && U.costQuery(['a-b']).startsWith('query($a:string!,'));
  assert.strictEqual(U.gqlMsg({ errors: [{ message: 'Variable "$a" of type "string" used\n in position <x>' }] }), 'Variable "$a" of type "string" used in position x');
  const ge = await U.r2Store({ CF_USAGE_TOKEN: 't', R2_ACCOUNT_ID: 'a', R2_BUCKET: 'snb-learn' }, async () => ({ status: 200, json: async () => ({ errors: [{ message: 'not authorized for that account' }], data: null }) }), now0);
  assert.strictEqual(ge.m, 'not authorized for that account');
  assert.strictEqual(U.storeMerge(null, ge, null, now0).r2e.m, 'not authorized for that account');
  // תקציר לווידג'ט
  assert.strictEqual(U.stoBrief(null), null);
  assert.deepStrictEqual(U.stoBrief({ r2: { at: 5, b: [{ name: 'a', gb: 1.234 }, { name: 'b', gb: 2 }], cost: { proj: 3.5, mtd: 1, st: 9 } }, r2e: { err: 'gql', at: 1 }, drive: { at: 6, gb: 4, lim: 15 } }),
    { r2: { gb: 3.23, at: 5, proj: 3.5, mtd: 1 }, r2e: 'gql', drive: { gb: 4, lim: 15, at: 6 } });

  console.log('usage-monitor: כל הבדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
