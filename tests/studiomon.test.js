'use strict';
/* ניטור השרתים (22/10/2026) — היסטוריית הדופק, אזהרות, תצוגה וטוקן הקריאה לווידג׳ט. הרצה: node tests/studiomon.test.js */
const assert = require('assert');
const M = require('../ibkr-proxy/lib/studiomon');
const S = require('../ibkr-proxy/lib/studio');

// נקודה: מדד חסר = null (לא 0), עשרוני אחד
const t0 = 1.7e12;
const p = M.monPoint({ cu: 12.345, mem: 40 }, t0);
assert.deepStrictEqual(p, [Math.round(t0 / 1000), 12.3, 40, null, null, null, null, null]);

// דחיסה: נקודה לכל היותר פעם ב־4 דק׳ — דופק כל 5 דק׳ נכנס תמיד
let h = M.monPush([], { cu: 1 }, t0);
assert.strictEqual(h.length, 1);
h = M.monPush(h, { cu: 2 }, t0 + 60e3);
assert.strictEqual(h.length, 1, 'אותו רגע בערך — לא מוסיפים');
h = M.monPush(h, { cu: 3 }, t0 + 5 * 60e3);
assert.strictEqual(h.length, 2);

// שורות פגומות בהיסטוריה נזרקות, והתקרה 288 (24 שעות)
const bad = [[1, 2], 'x', null];
// 23/10/2026: 24 שעות בדיוק בנקודות מלאות, ומעבר לכך נקודה לשעה (עד 31 ימים), ותקרה קשיחה
let big = [];
for (let i = 0; i < 40 * 12; i++) big = M.monPush(big, { cu: i % 100 }, t0 + i * 5 * 60e3);   // 40 שעות
const dayAgo = (Math.round((t0 + 39 * 3600e3) / 1000)) - 86400;
const full = big.filter((p) => p[0] >= dayAgo);
const older = big.filter((p) => p[0] < dayAgo);
assert.ok(full.length >= 280 && full.length <= 300, 'כ־288 נקודות מלאות ב־24 שעות: ' + full.length);
assert.ok(older.length <= 16 && older.length >= 14, 'שעתיים-שלוש לפני 24 שעות — נקודה לשעה בלבד: ' + older.length);
for (let i = 0; i < M.MON_MAX + 200; i++) big = M.monPush(big, { cu: 1 }, t0 + (1000 + i) * 3600e3);   // הרבה שעות אחורה
assert.ok(big.length <= M.MON_MAX, 'התקרה לא נחצית');
assert.strictEqual(M.monPush(bad, {}, t0).length, 1, 'שורות לא תקינות נזרקות');

// אזהרות: רק מה שחורג מהסף
assert.deepStrictEqual(M.monWarn({ cu: 95, mem: 50, disk: 86, psi: 5 }), ['cu', 'disk']);
assert.deepStrictEqual(M.monWarn(null), []);

// תצוגה: לכל שרת warn ו־mon (חתוך), עבודות בלי מזהים
const v = M.monView([{ id: 'a', hb: { cu: 91 }, mon: [[1]].concat(big) }], [{ sid: 'a', st: 'al', p: 0.4567, secret: 'x' }], t0);
assert.deepStrictEqual(v.servers[0].warn, ['cu']);
assert.ok(v.servers[0].mon.length <= M.MON_MAX && v.servers[0].mon.length > 0, 'ההיסטוריה חתוכה לתקרה ולא ריקה');
assert.deepStrictEqual(v.jobs, [{ sid: 'a', st: 'al', p: 0.457 }]);   // שלוש ספרות אחרי הנקודה

// טוקן קריאה: צורה, hash בלבד, השוואה, ביטול (hash ריק)
const tok = M.monTokNew();
assert.ok(M.MON_TOK_RE.test(tok), 'צורה mon-<48 hex>');
const kh = M.monTokHash(tok);
assert.ok(M.monTokOk(tok, kh));
assert.ok(!M.monTokOk(tok.slice(0, -1) + (tok.endsWith('0') ? '1' : '0'), kh), 'טוקן שגוי נדחה');
assert.ok(!M.monTokOk(tok, ''), 'בלי hash (בוטל) — נדחה');
assert.ok(!M.monTokOk('', kh));
assert.ok(!M.monTokOk(tok, 'zz'));

// normHb מכיר את שדות הניטור (cu, rx, tx, psi) — בלי זה הם נזרקים לפני השמירה
const hb = S.normHb({ cu: 42.36, rx: 12345.6, tx: 99, psi: 3.2, junk: 'x' });
assert.strictEqual(hb.cu, 42.4);
assert.strictEqual(hb.rx, 12345.6);
assert.strictEqual(hb.tx, 99);
assert.strictEqual(hb.psi, 3.2);
assert.ok(!('junk' in hb));

console.log('studiomon: כל הבדיקות עברו');
