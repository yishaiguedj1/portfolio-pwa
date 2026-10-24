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
  const gql = async (url, opt) => { gc++; assert.ok(url.endsWith('/graphql')); assert.ok(JSON.parse(opt.body).query.includes('snb-learn'));
    return { status: 200, json: async () => ({ data: { viewer: { accounts: [{ p0: [{ max: { payloadSize: 4e9, objectCount: 7 } }] }] } } }) }; };
  assert.strictEqual((await U.r2Store({ R2_BUCKET: 'snb-learn' }, gql, now0)).st, 'off');
  assert.strictEqual(gc, 0);
  const rs = await U.r2Store({ CF_USAGE_TOKEN: 't', R2_ACCOUNT_ID: 'a', R2_BUCKET: 'snb-learn' }, gql, now0);
  assert.strictEqual(gc, 1); assert.deepStrictEqual(rs.b, [{ name: 'snb-learn', gb: 4, n: 7 }]);
  const gerr = async () => ({ status: 200, json: async () => ({ errors: [{ message: 'unknown field' }], data: null }) });
  assert.strictEqual((await U.r2Store({ CF_USAGE_TOKEN: 't', R2_ACCOUNT_ID: 'a', R2_BUCKET: 'snb-learn' }, gerr, now0)).err, 'gql');

  console.log('usage-monitor: כל הבדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
