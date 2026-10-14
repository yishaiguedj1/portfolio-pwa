// שלב 5 בתוכנית שלוש האפליקציות (14/10/2026): הייצור עובר ל־invest/academy/studio.thesnowball.app.
// כתובת השרתון לפי הסביבה + גיבוי חם ל־Vercel (firebase-config.js), העברת הנתונים מהכתובת הישנה (move.js + move.html),
// ההפניה מהכתובת הישנה אחרי ההעברה (הסקריפט המוטבע), השורש thesnowball.app → Invest, הפריסה והאימות, ו־assetlinks.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
let n = 0;
const ok = (c, m) => { assert.ok(c, m); n++; console.log('ok - ' + m); };
const VERCEL = 'https://ibkr-proxy-wine.vercel.app', API = 'https://api.thesnowball.app';

(async () => {
  // ---------- firebase-config.js: השרתון לפי הכתובת
  function envAt(host, fetchFn, ss) {
    const window = { fetch: fetchFn, sessionStorage: ss, navigator: { onLine: true } };
    const document = { documentElement: { classList: { add() {} } } };
    vm.runInNewContext(read('firebase-config.js'), { window, document, location: { hostname: host }, URL });
    return window;
  }
  {
    const e = (h) => envAt(h).SNB_ENV;
    ok(['invest', 'academy', 'studio'].every((a) => e(a + '.thesnowball.app').proxy === API) && e('thesnowball.app').proxy === API,
      'הייצור ב־thesnowball.app מדבר עם השרת שלנו (api.thesnowball.app) — באותו אתר, בשביל עוגיית החיבור המשותף');
    ok(e('invest.thesnowball.app').proxyBackup === VERCEL && e('yishaiguedj1.github.io').proxy === VERCEL && !e('yishaiguedj1.github.io').proxyBackup,
      'Vercel = הגיבוי החם בייצור; ב־github.io נשאר Vercel (בלי גיבוי — הוא עצמו)');
    ok(e('invest-staging.thesnowball.app').proxy === 'https://api-staging.thesnowball.app' && !e('invest-staging.thesnowball.app').proxyBackup,
      'הניסוי — רק השרתון שלו, בלי גיבוי (Vercel מאמת מול ה־Firebase של הייצור)');
  }

  // ---------- הגיבוי החם: השרת לא עונה → אותה בקשה ל־Vercel, ו־5 דקות ישר לשם
  {
    const ss = { m: {}, getItem(k) { return this.m[k] || null; }, setItem(k, v) { this.m[k] = String(v); } };
    let down = true;
    const calls = [];
    const f = (url, init) => { calls.push(url); if (url.startsWith(API) && down) return Promise.reject(new TypeError('Failed to fetch')); return Promise.resolve({ status: 200, url }); };
    const w = envAt('invest.thesnowball.app', f, ss);
    let r = await w.fetch(API + '/api/quotes', { method: 'POST', body: '{}' });
    ok(r.url === VERCEL + '/api/quotes' && calls.join() === [API + '/api/quotes', VERCEL + '/api/quotes'].join(), 'השרת לא עונה (TypeError) → אותה בקשה ל־Vercel');
    calls.length = 0;
    r = await w.fetch(API + '/api/history', {});
    ok(calls.join() === VERCEL + '/api/history', 'אחרי נפילה — הבקשות הבאות ישר ל־Vercel (בלי לחכות לשרת שנפל)');
    ss.m.snb_api_down = String(Date.now() - 1); down = false; calls.length = 0;
    r = await w.fetch(API + '/api/history', {});
    ok(calls.join() === API + '/api/history', 'אחרי 5 דקות — חוזרים לשרת שלנו');
    down = true; calls.length = 0; ss.m = {};
    await w.fetch(API + '/api/session', {}).then(() => ok(false, 'session'), () => {});
    ok(calls.join() === API + '/api/session', '/api/session לא עובר ל־Vercel (העוגייה רק על השרת שלנו) — החיבור המשותף פשוט לא זמין');
    calls.length = 0;
    const ac = { aborted: true };
    await w.fetch(API + '/api/quotes', { signal: ac }).then(() => ok(false, 'abort'), () => {});
    ok(calls.length === 1 && !ss.m.snb_api_down, 'בקשה שבוטלה לא עוברת לגיבוי ולא מסמנת נפילה');
    calls.length = 0;
    await w.fetch('https://query1.finance.yahoo.com/x', {});
    ok(calls.join() === 'https://query1.finance.yahoo.com/x', 'בקשות לכתובות אחרות — בלי שינוי');
    const f2 = (url) => { calls.push(url); return Promise.resolve({ status: 503 }); };
    calls.length = 0;
    const w2 = envAt('invest.thesnowball.app', f2, ss);
    r = await w2.fetch(API + '/api/studio', { method: 'POST' });
    ok(r.status === 503 && calls.length === 1, 'השרת ענה (גם 5xx) — הבקשה כבר הגיעה, לא שולחים שוב (בלי כפילות של פעולה)');
  }

  // ---------- CSP, רשימת המקורות בשרתון, assetlinks
  for (const p of ['index.html', 'academy.html', 'studio.html']) {
    const cs = /connect-src ([^;]+)/.exec(read(p))[1].split(/\s+/);
    ok(cs.includes(API), p + ': api.thesnowball.app ב־connect-src');
  }
  {
    const { originAllowed } = require('../ibkr-proxy/lib/ibkr.js');
    ok(['invest', 'academy', 'studio', 'account'].every((a) => originAllowed('https://' + a + '.thesnowball.app')), 'השרתון (שלנו ו־Vercel) מקבל את מקורות הייצור');
    ok(!originAllowed('https://evil.thesnowball.app') && !originAllowed('https://invest.thesnowball.app.evil.com') && !originAllowed('http://invest.thesnowball.app'),
      'רשימה סגורה — לא כל תת־דומיין, לא סיומת מזויפת, לא http');
    const al = JSON.parse(read('.well-known/assetlinks.json'))[0];
    ok(al.target.package_name === 'io.github.yishaiguedj1.snowball' && al.target.sha256_cert_fingerprints.length === 1 && /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(al.target.sha256_cert_fingerprints[0]),
      'assetlinks.json בכתובת החדשה — אותה חבילה ואותה טביעת חתימה (האפליקציה לאנדרואיד בלי שורת כתובת)');
  }

  // ---------- move.js: מה עובר
  const MV = require('../move.js');
  {
    const lsc = /const LS_CACHE_PREFIXES = (\[[^\]]*\])/.exec(read('app.js'))[1];
    ok(JSON.stringify(MV.CACHE) === JSON.stringify(eval(lsc)), 'move.js: המטמונים = LS_CACHE_PREFIXES של app.js (לא עוברים — נבנים מחדש)');
    const acc = eval(/const ACCOUNT_KEYS = (\[[^\]]*\])/.exec(read('app.js'))[1]);
    ok(acc.every(MV.portable) && MV.portable('pwa_stash_v1:abcDEF123') && MV.portable('pwa_owner_v1') && MV.portable('pwa_lang_v1'),
      'move.js: כל המפתחות האישיים (ACCOUNT_KEYS), המחסנים של חשבונות, הבעלים וההגדרות עוברים');
    ok(!MV.portable('pwa_hist_v2_AAPL') && !MV.portable('pwa_sess_v1') && !MV.portable('pwa_oauth_v1') && !MV.portable('pwa_moved_v1') && !MV.portable('foo') && !MV.portable('pwa_x<y'),
      'move.js: לא עוברים — מטמונים, מצב רגעי של התחברות, סימן ההעברה, מפתחות זרים');
    const store = (o) => { const m = Object.assign({}, o); return { get length() { return Object.keys(m).length; }, key: (i) => Object.keys(m)[i], getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
    const old = store({ pwa_db_v1: '{"positions":[{"sym":"X"}]}', pwa_ibkr_v1: '{"token":"t"}', pwa_hist_v2_X: 'big', pwa_sess_v1: '1', other: 'x' });
    const d = MV.collect(old);
    ok(Object.keys(d).sort().join() === 'pwa_db_v1,pwa_ibkr_v1', 'collect: רק המפתחות שעוברים');
    ok(MV.clean(d) && !MV.clean(null) && !MV.clean([]) && !MV.clean({ pwa_db_v1: 5 }) && !MV.clean({ evil: 'x' }) && !MV.clean({ pwa_db_v1: 'x'.repeat(8e6 + 1) }),
      'clean: מה שמגיע מהחלון השני — רק מפתחות מוכרים עם מחרוזות, בגודל סביר');
    ok(!MV.conflict(store({}), d) && !MV.conflict(store({ pwa_db_v1: '{"positions":[]}' }), d) && MV.conflict(store({ pwa_db_v1: '{"deposits":[{"a":1}]}' }), d) && !MV.conflict(store({ pwa_db_v1: d.pwa_db_v1 }), d),
      'conflict: שואלים רק כשבכתובת החדשה כבר יש תיק אחר עם נתונים');
    ok(MV.targetOf('https://yishaiguedj1.github.io') === 'https://invest.thesnowball.app' && MV.targetOf('https://staging.thesnowball.app') === 'https://invest-staging.thesnowball.app' && !MV.targetOf('https://evil.com') && !MV.targetOf('constructor'),
      'הכתובת הישנה → Invest בכתובת החדשה (ייצור וניסוי)');
  }

  // ---------- move.js: ההעברה מקצה לקצה בין שני "חלונות", עם ניסיון התערבות של אתר זר
  {
    const OLD = 'https://yishaiguedj1.github.io', NEW = 'https://invest.thesnowball.app';
    const mkStore = (o) => { const m = Object.assign({}, o); return { get length() { return Object.keys(m).length; }, key: (i) => Object.keys(m)[i], getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, m }; };
    const listeners = new Map();
    const sent = [];
    const mkWin = (origin, store) => {
      const w = { location: { origin, hash: '', pathname: '/move.html', replace(u) { w.went = u; } }, localStorage: store, crypto: require('crypto').webcrypto,
        setTimeout: (fn, ms) => { w._t = fn; return 1; }, clearTimeout: () => { w._t = null; },
        addEventListener: (t, fn) => { listeners.set(w, fn); }, removeEventListener: () => { listeners.delete(w); },
        history: { replaceState() {} }, navigator: { language: 'he' } };
      return w;
    };
    // הודעה בין חלונות: נמסרת רק כשמקור היעד תואם (כמו בדפדפן)
    const deliver = (from, to, data, target) => { sent.push({ from: from.location.origin, target, data }); if (to.location.origin !== target) return; const fn = listeners.get(to); if (fn) fn({ origin: from.location.origin, source: from, data: JSON.parse(JSON.stringify(data)) }); };
    const oldWin = mkWin(OLD, mkStore({ pwa_db_v1: '{"positions":[{"sym":"Q"}]}', pwa_ibkr_v1: '{"token":"SECRET"}', pwa_hist_v2_Q: 'cache' }));
    const newWin = mkWin(NEW, mkStore({}));
    const els = [];
    newWin.document = { documentElement: {}, getElementById: () => ({ replaceChildren: (...c) => els.splice(0, els.length, ...c), appendChild: (c) => els.push(c) }),
      createElement: (tag) => ({ tag, set textContent(v) { this.t = v; }, get textContent() { return this.t; }, appendChild() {}, addEventListener(e, fn) { this.on = fn; } }) };
    let opened = '';
    oldWin.open = (url) => { opened = url; newWin.location.hash = url.slice(url.indexOf('#')); newWin.opener = oldWin; return newWin; };
    oldWin.postMessage = (d, t) => deliver(newWin, oldWin, d, t);   // החדשה כותבת ל־opener
    newWin.postMessage = (d, t) => deliver(oldWin, newWin, d, t);
    // אתר זר שמנסה להשתיל נתונים ולגנוב
    const evil = mkWin('https://evil.example', mkStore({}));
    let res = null;
    ok(MV.send(oldWin, { done: (to) => { res = 'done:' + to; }, fail: (c) => { res = 'fail:' + c; } }) === true && /^https:\/\/invest\.thesnowball\.app\/move\.html#n=[a-f0-9]{32}&l=he$/.test(opened),
      'send: החלון נפתח בתוך הלחיצה, עם מזהה חד־פעמי ב־# (לא נשלח לשרת)');
    // הודעה מזויפת לחלון הישן לפני ה"מוכנה" — מאתר זר: נבלעת
    listeners.get(oldWin)({ origin: evil.location.origin, source: evil, data: { t: 'snb-move-ready', n: opened.split('n=')[1].split('&')[0] } });
    ok(!sent.some((s) => s.data && s.data.d), 'הכתובת הישנה לא שולחת נתונים להודעה מאתר זר (גם עם המזהה הנכון)');
    MV.receive(newWin);
    ok(res === 'done:' + NEW && newWin.localStorage.m.pwa_db_v1 === '{"positions":[{"sym":"Q"}]}' && newWin.localStorage.m.pwa_ibkr_v1 === '{"token":"SECRET"}' && !newWin.localStorage.m.pwa_hist_v2_Q,
      'receive: הנתונים עברו (תיק, IBKR), בלי מטמונים');
    ok(sent.filter((s) => s.data && s.data.d).every((s) => s.target === NEW) && sent.filter((s) => s.from === NEW).every((s) => s.target === OLD),
      'כל הודעה נשלחת רק למקור המדויק של הצד השני');
    ok(!!oldWin.localStorage.m.pwa_moved_v1, 'הכתובת הישנה מסומנת — מעכשיו כל פתיחה שלה עוברת לחדשה');
    // החדשה מתעלמת מנתונים מאתר זר
    const w3 = mkWin(NEW, mkStore({}));
    w3.document = newWin.document;
    w3.location.hash = '#n=' + 'a'.repeat(32); w3.opener = oldWin;
    MV.receive(w3);
    listeners.get(w3)({ origin: 'https://evil.example', source: evil, data: { t: 'snb-move-data', n: 'a'.repeat(32), d: { pwa_db_v1: '{"positions":[{"sym":"EVIL"}]}' } } });
    listeners.get(w3)({ origin: OLD, source: evil, data: { t: 'snb-move-data', n: 'a'.repeat(32), d: { pwa_db_v1: '{"positions":[{"sym":"EVIL"}]}' } } });
    ok(!w3.localStorage.m.pwa_db_v1, 'receive: נתונים מאתר זר, או מחלון שאינו זה שפתח — נבלעים');
    // נפתח ישירות (בלי חלון שפתח אותו) — רק הסבר
    const w4 = mkWin(NEW, mkStore({})); w4.document = newWin.document; w4.location.hash = '#n=' + 'b'.repeat(32);
    MV.receive(w4);
    ok(!listeners.has(w4) && els.some((e) => /כתובת הישנה/.test(e.t || '')), 'receive: נפתח בלי הכתובת הישנה — רק הסבר איך מתחילים');
    // השפה — של האפליקציה (מהכתובת הישנה), לא של הדפדפן: דפדפן באנגלית + אפליקציה בעברית = עברית
    const w5 = mkWin(NEW, mkStore({})); w5.document = newWin.document; w5.navigator = { language: 'en-US' }; w5.location.hash = '#n=' + 'c'.repeat(32) + '&l=he';
    MV.receive(w5);
    ok(els.some((e) => /מעבירים/.test(e.t || '')), 'receive: השפה לפי האפליקציה (‎&l=), גם כשהדפדפן באנגלית');
    const w6 = mkWin(NEW, mkStore({})); w6.document = newWin.document; w6.location.hash = '#n=' + 'd'.repeat(32) + '&l=en';
    MV.receive(w6);
    ok(els.some((e) => /Moving your data/.test(e.t || '')), 'receive: אפליקציה באנגלית — באנגלית');
    // החלון נחסם
    let r2 = null;
    const ow = mkWin(OLD, mkStore({})); ow.open = () => null;
    MV.send(ow, { done() {}, fail: (c) => { r2 = c; } });
    ok(r2 === 'blocked', 'send: הדפדפן חסם את החלון → הודעה, בלי לסמן מעבר');
  }

  // ---------- הסקריפט המוטבע: ההפניה מהכתובת הישנה
  {
    const snip = (p) => { const m = /\(function\(\)\{try\{var M=\{'yishaiguedj1[\s\S]*?catch\(e\)\{\}\}\)\(\);/.exec(read(p)); return m && m[0]; };
    const s0 = snip('index.html');
    ok(s0 && snip('academy.html') === s0 && snip('studio.html') === s0, 'אותה הפניה בסקריפט המוטבע של שלושת הדפים');
    const go = (host, pathname, search, hash, moved) => {
      let to = '';
      const ctx = { location: { hostname: host, pathname, search: search || '', hash: hash || '', replace(u) { to = u; } },
        localStorage: { getItem: (k) => (k === 'pwa_moved_v1' && moved ? '1' : null) }, document: { documentElement: { style: {} } }, window: {} };
      vm.runInNewContext(s0, ctx);
      return to;
    };
    ok(go('yishaiguedj1.github.io', '/portfolio-pwa/', '', '#stock=AAPL', true) === 'https://invest.thesnowball.app/#stock=AAPL', 'אחרי ההעברה: github.io → Invest, עם הקישור העמוק');
    ok(go('yishaiguedj1.github.io', '/portfolio-pwa/studio.html', '', '#studio=jAAAA', true) === 'https://studio.thesnowball.app/#studio=jAAAA'
      && go('yishaiguedj1.github.io', '/portfolio-pwa/academy.html', '', '', true) === 'https://academy.thesnowball.app/'
      && go('yishaiguedj1.github.io', '/portfolio-pwa', '', '', true) === 'https://invest.thesnowball.app/', 'academy.html / studio.html → הכתובת של כל אפליקציה');
    ok(go('staging.thesnowball.app', '/index.html', '', '', true) === 'https://invest-staging.thesnowball.app/', 'הניסוי: staging.thesnowball.app → invest-staging');
    ok(!go('yishaiguedj1.github.io', '/portfolio-pwa/', '', '', false), 'לפני ההעברה — לא עוברים (עד ש"לכולם" יידלק)');
    ok(!go('yishaiguedj1.github.io', '/portfolio-pwa/oauth.html', '', '', true) && !go('yishaiguedj1.github.io', '/portfolio-pwa/', '?stay', '', true) && !go('invest.thesnowball.app', '/', '', '', true),
      'לא עוברים: חלון ההסכמה (oauth.html), ‎?stay (ניסיון חוזר), והכתובת החדשה עצמה');
    for (const o of Object.keys(MV.MOVES)) {
      const h = new URL(o).hostname;
      ok(go(h, h === 'yishaiguedj1.github.io' ? '/portfolio-pwa/' : '/', '', '', true) === MV.MOVES[o] + '/', 'אותה טבלה בהפניה וב־move.js: ' + h);
    }
    ok(/if \(window\.SNB_MOVING\) return;/.test(read('app.js')) && /SNB_MOVING\) await new Promise/.test(read('academy-app.js')) && /SNB_MOVING\) await new Promise/.test(read('studio-app.js')),
      'בזמן ההפניה האפליקציה לא מתחילה (לא כותבת ולא מסנכרנת מהכתובת הישנה)');
  }

  // ---------- move.html: בלי רשת, בלי מסגרות
  {
    const h = read('move.html');
    ok(/default-src 'none'/.test(h) && /script-src 'self'/.test(h) && !/connect-src/.test(h) && /data-move="in"/.test(h) && /src="move\.js"/.test(h),
      'move.html: בלי שום חיבור לרשת — רק הודעה מהחלון שפתח אותו');
    ok(/self !== root\.top/.test(read('move.js')), 'move.js: לא מקבל בתוך מסגרת (clickjacking)');
    ok(/'\.\/move\.js'/.test(read('sw.js')) && /<script src="move\.js" defer><\/script>\s*<script src="app\.js"/.test(read('index.html')), 'move.js נטען לפני app.js ובמעטפת (אופליין)');
  }

  // ---------- השורש thesnowball.app → Invest
  {
    const src = read('functions/index.js').replace(/export function/g, 'function') + '\nmodule.exports = { apexTarget, onRequest };';
    const m = { exports: {} };
    vm.runInNewContext(src, { module: m, URL, Response: { redirect: (u, s) => ({ u, s }) } });
    ok(m.exports.apexTarget('https://thesnowball.app/') === 'https://invest.thesnowball.app/' && !m.exports.apexTarget('https://invest.thesnowball.app/') && !m.exports.apexTarget('https://staging.thesnowball.app/'),
      'thesnowball.app → Invest; שאר הכתובות לא');
    const r = m.exports.onRequest({ request: { url: 'https://thesnowball.app/?x=1', method: 'GET' }, env: {}, next: () => 'next' });
    ok(r.u === 'https://invest.thesnowball.app/?x=1' && r.s === 301, 'העברה קבועה (301)');
  }

  // ---------- הפריסה לייצור והאימות
  {
    const w = read('.github/workflows/deploy.yml');
    ok(/deploy-cf:[\s\S]*?needs: \[staging, approve\][\s\S]*?--project-name thesnowball-prod/.test(w), 'deploy: אחרי האישור — גם ל־thesnowball-prod (Cloudflare)');
    ok(/verify-and-tag:[\s\S]*?needs: \[staging, deploy, deploy-cf\]/.test(w) && /invest\.thesnowball\.app[\s\S]*?--live-root/.test(w) && /thesnowball\.app לא מעביר ל־Invest/.test(w),
      'verify: כל קובץ ב־Invest, השורש של Academy ו־Studio, וההעברה מ־thesnowball.app — לפני התגית');
    const SG = require('../tools/swgen.js');
    const sw = read('sw.js');
    const pages = { 'academy.thesnowball.app': read('academy.html'), 'studio.thesnowball.app': read('studio.html') };
    const fake = (good) => async (u) => { const x = new URL(u); const b = x.pathname === '/sw.js' ? sw : x.pathname === '/' ? (good ? pages[x.hostname] : read('index.html')) : null; return { ok: !!b, status: b ? 200 : 404, arrayBuffer: async () => Buffer.from(b) }; };
    ok((await SG.liveRoot('https://academy.thesnowball.app/', fake(true))).ok && (await SG.liveRoot('https://studio.thesnowball.app/', fake(true))).ok, 'swgen --live-root: השורש = academy.html / studio.html מהטביעות');
    ok(!(await SG.liveRoot('https://academy.thesnowball.app/', fake(false))).ok, 'swgen --live-root: השורש מגיש דף אחר → נכשל');
  }

  console.log('\n' + n + ' בדיקות עברו ✓');
})().catch((e) => { console.error(e); process.exit(1); });
