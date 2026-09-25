// pf-v148.test.js — אבטחה (25/09/2026): מפתח שרתון (X-App-Key), הודעות שגיאה לחסימות,
// ניתוק שמוחק פרטי גישה, מפתח Twelve Data לא בענן, CI בהרשאות קריאה בלבד.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const cloud = fs.readFileSync(path.join(root, 'cloud.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const wf = fs.readFileSync(path.join(root, '.github/workflows/test.yml'), 'utf8');

let n = 0;
function ok(cond, name) { n++; if (!cond) { console.error('FAIL - ' + name); process.exit(1); } console.log('ok - ' + name); }

const store = {};
const sb = {
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
  document: { addEventListener() {}, getElementById: () => null, querySelectorAll: () => [], querySelector: () => null,
    createElement: () => ({ classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} }) },
  window: {}, navigator: {}, location: {}, AbortController, fetch: () => Promise.reject(new Error('no net')),
  setTimeout, clearTimeout, console,
};
vm.createContext(sb);
vm.runInContext(src, sb);
const A = (k) => vm.runInContext(k, sb);

(async () => {
  // --- 1. כותרות לשרתון ---
  ok(!('X-App-Key' in A('ibkrProxyHeaders')()), 'בלי מפתח שמור — לא שולחים X-App-Key');
  A('ibkrSaveCfg')({ appKey: '  abc123  ' });
  ok(A('ibkrProxyHeaders')()['X-App-Key'] === 'abc123', 'מפתח שמור — נשלח כ־X-App-Key (בלי רווחים)');

  const seen = [];
  const fakeFetch = async (url, opts) => { seen.push({ url, opts }); return { status: 200, json: async () => ({ ok: true, referenceCode: '42', status: 'ready', data: { meta: {} } }) }; };
  await A('ibkrRequestReport')(fakeFetch, 'https://p.example', '1234567', '999999', '', '', null);
  await A('ibkrPollStatement')(fakeFetch, 'https://p.example', '1234567', '42', '', { firstDelayMs: 0, sleep: async () => {} });
  ok(seen.length === 2 && seen.every((c) => c.opts.headers['X-App-Key'] === 'abc123'), 'SendRequest וגם GetStatement שולחים את המפתח');
  ok(seen.every((c) => c.opts.method === 'POST' && !/1234567/.test(c.url)), 'POST בלבד, הטוקן לא ב־URL');

  // --- 2. הודעות שגיאה ברורות ---
  const fe = A('ibkrFriendlyErr');
  ok(fe('שרתון: bad_app_key') === A("t('ibkrErrAppKey')"), 'bad_app_key → הסבר איפה להדביק את המפתח');
  ok(fe('שרתון: forbidden_origin') === A("t('ibkrErrOrigin')"), 'forbidden_origin → הסבר');
  ok(/APP_KEY/.test(A("STRINGS.en.ibkrErrAppKey")) && /Redeploy/.test(A("STRINGS.he.ibkrErrAppKey")), 'הודעה בעברית ובאנגלית — מסבירה איך לבטל את APP_KEY');

  // --- 3. שדה בהגדרות + שמירה ---
  ok(!/id="ibkrAppKey"/.test(html), 'v150: שדה "מפתח שרתון" הוסר מההגדרות (APP_KEY לא מוגדר ב־Vercel)');
  ok(/ibkrSaveCfg\(\{ proxyUrl, token, queryId, appKey: '',/.test(src) && /if \(cfg\.appKey\) ibkrSaveCfg\(\{ appKey: '' \}\)/.test(src), 'v150: מפתח ישן שנשמר בטלפון נמחק');

  // --- 4. ניתוק מוחק פרטי גישה ---
  ok(/ibkrSaveCfg\(\{ lastSync: 0, data: null, token: '', queryId: '', appKey: '', statementUrl: '' \}\)/.test(src), 'ניתוק מוחק token, Query ID ומפתח שרתון');
  ok(/removeItem\(LS_TDKEY\)/.test(src), 'איפוס מלא מוחק גם את מפתח Twelve Data');

  // --- 5. ענן ---
  ok(/tdkey: firebase\.firestore\.FieldValue\.delete\(\)/.test(cloud), 'ענן: מפתח Twelve Data לא נשמר, ועותק ישן נמחק');
  ok(!/localStorage\.setItem\(LS_TDKEY, data\.tdkey\)/.test(cloud), 'ענן: המפתח לא נטען מהענן');
  ok(!/appKey|token/.test(cloud.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').replace(/idToken|getIdToken/g, '')), 'ענן: פרטי IBKR לא נכתבים לענן');

  // --- 6. CI ---
  ok(/permissions:\s*\n\s*contents: read/.test(wf), 'CI: הרשאת קריאה בלבד');
  ok(/actions\/checkout@[0-9a-f]{40}/.test(wf) && /actions\/setup-node@[0-9a-f]{40}/.test(wf), 'CI: actions מקובעים ל־SHA');

  const ver = (src.match(/APP_VERSION = '(v\d+)'/) || [])[1];
  ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes('portfolio-pwa-' + ver), 'CACHE_NAME תואם לגרסה');
  console.log('\n' + n + ' בדיקות עברו');
})().catch((e) => { console.error('נכשל:', e && e.stack || e); process.exit(1); });
