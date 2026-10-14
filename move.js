/* ============================================================
 * העברת הנתונים לכתובת החדשה (שלב 5 בתוכנית שלוש האפליקציות, 14/10/2026)
 *
 * הנתונים של כל משתמש יושבים באחסון של הדפדפן לפי כתובת (origin). כשהאפליקציה עוברת מ־yishaiguedj1.github.io
 * ל־invest.thesnowball.app, האחסון לא עובר לבד — וכאן מעבירים אותו, בלי שרת ובלי שום דבר בכתובת:
 *   1. בכתובת הישנה (index.html ← app.js) לוחצים "לעבור" → נפתח move.html בכתובת החדשה (חלון שהישנה פתחה).
 *   2. החדשה שולחת לישנה "מוכנה" (postMessage רק למקור המדויק של הישנה).
 *   3. הישנה שולחת את המפתחות האישיים (pwa_*, בלי מטמונים) — רק למקור המדויק של החדשה, ורק לחלון שהיא עצמה פתחה.
 *   4. החדשה מקבלת רק מהמקור המדויק של הישנה ורק מהחלון שפתח אותה, בודקת וכותבת, ומאשרת.
 *   5. הישנה מסמנת pwa_moved_v1 — ומאז כל פתיחה שלה עוברת לכתובת החדשה (firebase-config.js).
 * מה לא עובר: מטמונים (נבנים מחדש), התחברות (מתחברים פעם אחת בכתובת החדשה), הספרים ב־IndexedDB (המדף המשותף
 * יורד מחדש, הספרייה הפרטית — מהגיבוי ב־Drive). רק Invest מקבלת: Academy ו־Studio נטענות מהענן.
 * ============================================================ */
(function (root) {
  'use strict';
  // הכתובת הישנה → החדשה (Invest). אותה טבלה ב־firebase-config.js (MOVE_TO) — tests/move.test.js משווה
  var MOVES = {
    'https://yishaiguedj1.github.io': 'https://invest.thesnowball.app',
    'https://staging.thesnowball.app': 'https://invest-staging.thesnowball.app'
  };
  // לא עוברים: מצב רגעי של התחברות/טעינה מחדש/חלון הסכמה, וסימן ההעברה עצמו
  var SKIP = ['pwa_owner_rl', 'pwa_auth_rl', 'pwa_oauth_v1', 'pwa_sess_v1', 'pwa_cloud_user_v1', 'pwa_libscroll_v1', 'pwa_moved_v1'];
  // = LS_CACHE_PREFIXES ב־app.js (הבדיקה משווה) — מטמונים נבנים מחדש בכתובת החדשה
  var CACHE = ['pwa_hist_v2_', 'pwa_hist_v1_', 'pwa_intra_v1_', 'pwa_quotes_v2', 'pwa_fxhist_v1', 'pwa_bench_v1', 'pwa_wordmarks_v4', 'pwa_logo_meta_v1', 'pwa_earn_v1'];
  var KEY_RE = /^pwa_[A-Za-z0-9_:.@-]{1,120}$/;
  var MAX_BYTES = 8e6;          // כל ה־localStorage של הדפדפן (5MB) נכנס בנוחות
  var WAIT_MS = 30e3;           // הכתובת החדשה לא ענתה — חלון חסום / נפתח בלי קשר לישנה (למשל מתוך האפליקציה באנדרואיד)
  var NONCE_RE = /^[a-f0-9]{32}$/;

  function targetOf(origin) { return Object.prototype.hasOwnProperty.call(MOVES, origin) ? MOVES[origin] : ''; }
  function sourceOf(origin) {
    for (var k in MOVES) if (Object.prototype.hasOwnProperty.call(MOVES, k) && MOVES[k] === origin) return k;
    return '';
  }
  function portable(k) {
    k = String(k);
    if (!KEY_RE.test(k) || SKIP.indexOf(k) >= 0) return false;
    for (var i = 0; i < CACHE.length; i++) if (k.indexOf(CACHE[i]) === 0) return false;
    return true;
  }
  function collect(store) {
    var d = {};
    for (var i = 0; i < store.length; i++) {
      var k = store.key(i);
      if (k != null && portable(k)) d[k] = String(store.getItem(k));
    }
    return d;
  }
  // מה שמגיע מהחלון השני — רק מפתחות מוכרים עם ערך מחרוזת, בגודל סביר. אחרת כלום
  function clean(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    var out = {}, n = 0, size = 0;
    for (var k in d) {
      if (!Object.prototype.hasOwnProperty.call(d, k) || !portable(k) || typeof d[k] !== 'string') continue;
      size += k.length + d[k].length;
      if (size > MAX_BYTES) return null;
      out[k] = d[k]; n++;
    }
    return n ? out : null;
  }
  // יש כבר תיק בכתובת החדשה (מישהו השתמש בה לפני ההעברה) — שואלים לפני שמחליפים
  function hasData(json) {
    try {
      var o = JSON.parse(json || 'null');
      if (!o || typeof o !== 'object') return false;
      return ['positions', 'deposits', 'manualTrades', 'wishlist', 'pensionFunds'].some(function (k) { return Array.isArray(o[k]) && o[k].length > 0; });
    } catch (e) { return false; }
  }
  function conflict(store, d) {
    var cur = store.getItem('pwa_db_v1');
    return hasData(cur) && cur !== d.pwa_db_v1;
  }
  function apply(store, d) {
    var n = 0;
    for (var k in d) if (Object.prototype.hasOwnProperty.call(d, k)) { store.setItem(k, d[k]); n++; }
    return n;
  }
  function nonce(cr) {
    var a = new Uint8Array(16);
    cr.getRandomValues(a);
    var s = '';
    for (var i = 0; i < a.length; i++) s += (a[i] < 16 ? '0' : '') + a[i].toString(16);
    return s;
  }

  /* ---------- הכתובת הישנה: חייב לרוץ בתוך הלחיצה (window.open לפני כל המתנה) ----------
     cb.done() — הנתונים עברו; cb.fail(code) — 'blocked' (החלון לא נפתח) / 'timeout' (לא ענה) / 'kept' (בחרו להשאיר את מה שיש בחדשה) */
  function send(win, cb) {
    var to = targetOf(win.location.origin);
    if (!to) return false;
    var n = nonce(win.crypto);
    // שפת הדף החדש = שפת האפליקציה (לא של הדפדפן — ברירת המחדל שלנו עברית)
    var lang = 'he';
    try { lang = typeof win.getLang === 'function' ? win.getLang() : (win.document.documentElement.lang || 'he'); } catch (e) {}
    var w = win.open(to + '/move.html#n=' + n + '&l=' + (lang === 'en' ? 'en' : 'he'), '_blank');
    if (!w) { cb.fail('blocked'); return true; }
    var over = false;
    var timer = win.setTimeout(function () { finish(); cb.fail('timeout'); }, WAIT_MS);
    function finish() { over = true; win.clearTimeout(timer); win.removeEventListener('message', on); }
    function on(e) {
      if (over || e.origin !== to || e.source !== w || !e.data || e.data.n !== n) return;
      if (e.data.t === 'snb-move-ready') {
        // החדשה ענתה — מכאן מחכים בלי הגבלה: אולי היא שואלת את המשתמש ("להחליף?"). עד 411 הזמן נגמר באמצע
        // השאלה, והישנה לא סימנה שעברנו — ההפניה ממנה לא עבדה (נמצא בטלפון)
        win.clearTimeout(timer);
        w.postMessage({ t: 'snb-move-data', n: n, d: collect(win.localStorage) }, to);
      } else if (e.data.t === 'snb-move-done') {
        finish();
        try { win.localStorage.setItem('pwa_moved_v1', String(Date.now())); } catch (err) {}
        cb.done(to);
      } else if (e.data.t === 'snb-move-no') {
        finish();   // המשתמש בחר לא להחליף תיק שכבר יש בכתובת החדשה — הישנה נשארת כמו שהיא
        cb.fail('kept');
      }
    }
    win.addEventListener('message', on);
    return true;
  }

  /* ---------- הכתובת החדשה (move.html) ---------- */
  var TXT = {
    he: { title: 'מעבירים את הנתונים', wait: 'מתחברים לכתובת הישנה…', none: 'את המעבר מתחילים בכתובת הישנה — פתחו את THE SNOWBALL ולחצו "לעבור".',
      bad: 'הנתונים שהגיעו לא תקינים. לא שונה כלום.', conflict: 'בכתובת החדשה כבר יש תיק. להחליף אותו בנתונים מהכתובת הישנה?',
      replace: 'להחליף', keep: 'להשאיר את מה שיש', done: 'הנתונים עברו ✓ בכתובת החדשה מתחברים פעם אחת עם Google — והתיק כאן.', kept: 'לא שונה כלום.', open: 'לפתוח את THE SNOWBALL',
      full: 'אין מספיק מקום באחסון של הדפדפן. לא שונה כלום.' },
    en: { title: 'Moving your data', wait: 'Connecting to the old address…', none: 'Start the move from the old address — open THE SNOWBALL and tap "Move".',
      bad: 'The data that arrived is not valid. Nothing was changed.', conflict: 'The new address already has a portfolio. Replace it with the data from the old address?',
      replace: 'Replace', keep: 'Keep what is here', done: 'Your data has moved ✓ Sign in with Google once at the new address and your portfolio is here.', kept: 'Nothing was changed.', open: 'Open THE SNOWBALL',
      full: 'Not enough browser storage. Nothing was changed.' }
  };
  function receive(win) {
    var doc = win.document;
    var lang = /(?:^#|&)l=en(?:&|$)/.test(win.location.hash || '') ? 'en' : 'he';   // מהכתובת הישנה — שפת האפליקציה, לא של הדפדפן
    var T = TXT[lang];
    doc.documentElement.lang = lang;
    doc.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr';
    var box = doc.getElementById('move');
    var el = function (tag, cls, txt) { var x = doc.createElement(tag); if (cls) x.className = cls; if (txt) x.textContent = txt; return x; };
    var show = function (msg, btns) {
      box.replaceChildren(el('h1', '', T.title), el('p', 'mv-msg', msg));
      if (btns && btns.length) { var row = el('div', 'mv-btns'); btns.forEach(function (b) { row.appendChild(b); }); box.appendChild(row); }
    };
    var btn = function (txt, cls, on) { var b = el('button', cls, txt); b.type = 'button'; b.addEventListener('click', on); return b; };
    var openApp = function () { win.location.replace(win.location.origin + '/'); };

    var m = /(?:^#|&)n=([a-f0-9]{32})(?:&|$)/.exec(win.location.hash || '');
    var from = sourceOf(win.location.origin);
    try { win.history.replaceState(null, '', win.location.pathname); } catch (e) {}
    var op = win.opener;
    if (!m || !from || !op) { show(T.none, [btn(T.open, 'btn', openApp)]); return; }
    var n = m[1];
    show(T.wait);
    var over = false;
    var reply = function (t, extra) { var o = { t: t, n: n }; for (var k in extra || {}) o[k] = extra[k]; try { op.postMessage(o, from); } catch (e) {} };
    var write = function (d) {
      try { var c = apply(win.localStorage, d); reply('snb-move-done', { k: c }); show(T.done, [btn(T.open, 'btn', openApp)]); }
      catch (e) { show(T.full, [btn(T.open, 'btn', openApp)]); }
    };
    win.addEventListener('message', function (e) {
      if (over || e.origin !== from || e.source !== op || !e.data || e.data.n !== n || e.data.t !== 'snb-move-data') return;
      over = true;
      var d = clean(e.data.d);
      if (!d) { show(T.bad, [btn(T.open, 'btn', openApp)]); return; }
      if (!conflict(win.localStorage, d)) { write(d); return; }
      show(T.conflict, [
        btn(T.replace, 'btn', function () { write(d); }),
        btn(T.keep, 'btn secondary-btn', function () { reply('snb-move-no'); show(T.kept, [btn(T.open, 'btn', openApp)]); })
      ]);
    });
    reply('snb-move-ready');
  }

  var api = { MOVES: MOVES, SKIP: SKIP, CACHE: CACHE, NONCE_RE: NONCE_RE, targetOf: targetOf, sourceOf: sourceOf, portable: portable,
    collect: collect, clean: clean, hasData: hasData, conflict: conflict, apply: apply, nonce: nonce, send: send, receive: receive };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.SnbMove = api;
    // move.html: המסמך מסמן את עצמו — מקבלים. לא בתוך מסגרת (clickjacking)
    var d = root.document;
    if (d && d.documentElement && d.documentElement.getAttribute('data-move') === 'in') {
      if (root.self !== root.top) { d.documentElement.style.display = 'none'; return; }
      receive(root);
    }
  }
})(typeof window !== 'undefined' ? window : null);
