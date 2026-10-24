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

  console.log('usage-monitor: כל הבדיקות עברו');
})().catch((e) => { console.error(e); process.exit(1); });
