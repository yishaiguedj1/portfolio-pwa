// תחזוקה (10/10/2026 — הסיכון מסעיף 15): מכסת ה־localStorage. התיק ו־IBKR קודמים למטמונים שנטענים שוב;
// כשגם זה לא מספיק — הודעה גלויה (לא בליעה בשקט). נתונים אישיים לא נמחקים.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };

// localStorage מדומה עם תקרה (בתווים), כמו בדפדפן: חריגה = QuotaExceededError
function fakeLS(cap) {
  const m = new Map();
  const used = () => [...m.entries()].reduce((a, [k, v]) => a + k.length + v.length, 0);
  return {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] || null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => {
      const prev = m.has(k) ? k.length + m.get(k).length : 0;
      if (used() - prev + k.length + String(v).length > cap) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, String(v));
    },
    _m: m,
  };
}

const src = app.slice(app.indexOf('const LS_CACHE_PREFIXES'), app.indexOf('function loadDB()'));
const flashes = [];
function make(ls) {
  // eslint-disable-next-line no-new-func
  return new Function('localStorage', 'flash', 't', 'LS_DB', src + '; return { saveDBto, lsPutCritical, lsFreeCaches, LS_CACHE_PREFIXES };')(
    ls, (m) => flashes.push(m), (k) => k, 'pwa_db_v1');
}

// 1. המטמונים ברשימה = הקבועים באפליקציה (אחרת שינוי שם של מטמון ישאיר אותו מחוץ לפינוי)
const consts = {};
for (const m of app.matchAll(/const (LS_[A-Z_0-9]+) = '([^']+)'/g)) consts[m[1]] = m[2];
const F = make(fakeLS(1e9));
for (const c of ['LS_HIST', 'LS_HIST_V1', 'LS_INTRA', 'LS_QUOTES', 'LS_FXHIST', 'LS_BENCH', 'LS_WORDMARK', 'LS_LOGO_META', 'LS_EARN'])
  ok(F.LS_CACHE_PREFIXES.includes(consts[c]), 'מטמון ברשימת הפינוי: ' + c + ' = ' + consts[c]);
for (const k of ['pwa_db_v1', 'pwa_ibkr_v1', 'pwa_studio_v1', 'pwa_libbk_v1', 'pwa_stash_v1:abc', 'pwa_predemo_v1'])
  ok(!F.LS_CACHE_PREFIXES.some((p) => k === p || k.startsWith(p)), 'נתון אישי לא נמחק אף פעם: ' + k);

// 2. מלא במטמונים → התיק נשמר (המטמון הגדול יוצא ראשון), נתונים אישיים נשארים
const ls = fakeLS(10000);
ls.setItem('pwa_stash_v1:other', 'x'.repeat(1500));
ls.setItem('pwa_hist_v2_AAPL', 'h'.repeat(4000));
ls.setItem('pwa_hist_v2_NOW', 'h'.repeat(2000));
ls.setItem('pwa_quotes_v2', 'q'.repeat(1500));
const G = make(ls);
ok(G.saveDBto({ v: 1, positions: [], deposits: [], pad: 'p'.repeat(3000) }) === true, 'אחסון מלא במטמונים — התיק נשמר');
ok(ls.getItem('pwa_db_v1') && ls.getItem('pwa_stash_v1:other') && !ls.getItem('pwa_hist_v2_AAPL'), 'המטמון הגדול פונה; המחסן של חשבון אחר נשאר');
ok(flashes.length === 0, 'בלי הודעה כשהצליח');

// 3. מלא בנתונים אישיים בלבד → לא נשמר, והודעה גלויה פעם אחת (לא בכל שמירה)
const ls2 = fakeLS(3000);
ls2.setItem('pwa_stash_v1:other', 'x'.repeat(2500));
const H = make(ls2);
ok(H.saveDBto({ v: 1, positions: [], deposits: [], pad: 'p'.repeat(2000) }) === false && ls2.getItem('pwa_stash_v1:other'), 'אין מה לפנות — לא נשמר, ולא נמחק שום נתון אישי');
H.saveDBto({ v: 1, positions: [], deposits: [], pad: 'p'.repeat(2000) });
ok(flashes.length === 1 && flashes[0] === 'storageFull', 'הודעה גלויה פעם אחת (לא בליעה בשקט, לא הצפה)');

// 4. בקוד: IBKR באותו מסלול, והמחרוזת בשתי השפות
ok(/lsPutCritical\(LS_IBKR, JSON\.stringify\(c\)\)/.test(app), 'IBKR (כולל הדוחות השמורים) — לפני המטמונים');
ok((app.match(/storageFull: "/g) || []).length === 2 && /flash\(t\('storageFull'\)\)/.test(app), 'ההודעה בשתי השפות');
console.log('# ' + n + ' בדיקות עברו');
