/* סריקה מקיפה של המעברים — שלוש האפליקציות, כל פריט בחוגה, בכל הדרכים (לחיצה, החלקה בעמוד, גרירת החוגה; איטי ומהיר),
   ובדיקת כל רכיב אחרי הנחיתה ובזמן המעבר (01/11/2026, סבב קפיצות 7 — בקשת המשתמש: "מעבר מקיף על כל אובייקט ואובייקט").
   node tools/qa-sweep.js [--app invest|studio|academy] [--theme dark] — דורש שרת מקומי על 8792 (python3 -m http.server 8792).
   כל הפרה = שורה; בסוף "הפרות: N". בודק:
   - החוגה: גלויה (לא hidden/opacity/visibility), הפריט הפעיל = היעד, בגודל מלא ובשקיפות מלאה, ולפחות 3 פריטים גלויים
   - ההדר: גלוי במקומו
   - הדף: יש תוכן גלוי במסך (לא ריק), ולא נשארו שאריות קובייה (cube-face/in/out/prewarm, העתק, רקע, רצועה, סגנון בשורה)
   - בזמן המעבר (כל פריים): החוגה לא נעלמת, ומרכז המסך לא ריק לשני פריימים רצופים
   - שגיאות בדף */
const { chromium } = require(process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright');
const QM = require('./qa-motion.js');
const fs = require('fs'), os = require('os'), path = require('path'), { execFileSync } = require('child_process');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-sweep-'));
// פריים ריק = ברצועת האמצע (30%–85% מהגובה) כמעט אין קצוות (טקסט, גבולות כרטיסים) — פחות מ־4 לאלף פיקסלים.
// לא פיזור צבעים: עמוד דליל אמיתי (עסקאות בתיק הדמו, הבית של Studio בפסטל) ~5–14 בפיזור, אבל ~11+ בקצוות; מסך ריק ~0
const PYB = 'import sys,json\nfrom PIL import Image, ImageStat, ImageFilter\nout=[]\nfor f in json.loads(sys.argv[1]):\n    im=Image.open(f).convert("L"); w,h=im.size\n    if w!=393: im=im.resize((393,round(h*393/w))); w,h=im.size\n    m=im.crop((0,int(h*.3),w,int(h*.85))); d=im.crop((0,int(h*.88),w,h)).resize((72,16))\n    e=ImageStat.Stat(m.filter(ImageFilter.FIND_EDGES).point(lambda p: 255 if p>40 else 0)).mean[0]/255*1000\n    out.append([round(e,1), round(ImageStat.Stat(d).stddev[0],1)])\nprint(json.dumps(out))';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = 'http://localhost:8792';
const APPS = { invest: '/index.html', studio: '/studio.html', academy: '/academy.html' };
const only = arg('app', null), THEME = arg('theme', 'light'), CPU = +arg('cpu', 1);
let total = 0;
const bad = (app, step, msg) => { total++; console.log('✗ [' + app + '] ' + step + ' — ' + msg); };

const PROBE = () => {
  window.__probe = { on: false, log: [] };
  const P = window.__probe;
  const tick = () => {
    if (P.on) {
      const nav = [...document.querySelectorAll('nav.tabs')].find((n) => !n.hidden && n.getClientRects().length);
      const cs = nav && getComputedStyle(nav);
      const navOk = !!nav && cs.visibility === 'visible' && +cs.opacity > 0.5;
      P.log.push({ t: Math.round(performance.now()), navOk });
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

/* Studio כמו אצל המשתמש: מחובר, מנהל, שרת ו־R2 — כדי שבחוגה יהיו ארבעת הפריטים (קריוקי · תרגום · העבודה · המגדל) */
async function studioMock(ctx) {
  await ctx.route(/\/auth\.js(\?|$)/, (r) => r.fulfill({ contentType: 'application/javascript', body: `(function(){var cbs=[],u={uid:'qa',email:'qa@example.com',displayName:'QA',getIdToken:async()=>'tok'};
    window.firebase=window.firebase||{apps:[1],auth:function(){return {currentUser:u}}};
    window.SnbAuth={start(){setTimeout(()=>cbs.forEach(f=>f('in')),50)},onChange(f){cbs.push(f);return()=>{}},user(){return u},state(){return 'in'},sub(){return null},signIn(){},signOut(){},hasEmail(){return true}};})();` }));
  const jid = (n) => 'j' + String(n).padStart(20, 'Q');
  const JOBS = [1, 2, 3, 4, 5, 6].map((n) => ({ id: jid(n), created: Date.now() - n * 3600e3, state: 'done', fired: Date.now() - n * 3600e3, done: Date.now() - n * 3500e3,
    spec: { name: 'Demo.Show.S01E0' + n + '.720p.mkv', size: 3e8, from: 'en', to: 'he', mode: 'std' }, files: { a: { id: 'fa' + n, size: 1e6 }, v: { id: 'fv' + n, size: 3e8 } } }));
  await ctx.route(/\/api\/studio/, (r) => { let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    const now = Date.now(), J = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
    if (b.op === 'status') return setTimeout(() => J({ ok: true, kinds: [], r2: true, lra: now, lrt: now, lrm: now, lrf: now, api: { month: 0, cap: 100, online: 1, servers: 1, admin: true, ka: true }, conn: { hint: 'x', ok: now }, drive: { connected: true, email: 'qa@example.com' }, now }), 60);
    if (b.op === 'jobs') return setTimeout(() => J({ ok: true, jobs: JOBS, now }), 60);
    if (b.op === 'job') return setTimeout(() => J({ ok: true, job: JOBS.find((x) => x.id === b.job) || null }), 60);
    return J({ ok: false, error: 'x' }); });
}

/* Academy כמו אצל המשתמש: ספרים בספרייה שלי, מכתבים במדף THE SNOWBALL, ספרים בקריאה ושנקראו, אוספים (כמו ensureLibSeeded ב־qa-motion) */
async function academySeed(page) {
  await page.click('.lib-dial .tab[data-tab="mine"]').catch(() => {}); await page.waitForTimeout(500);
  await page.evaluate(async (names) => {
    const dt = new DataTransfer();
    for (const n of names) { const bl = await (await fetch('/.qa-books/' + n)).blob(); dt.items.add(new File([bl], n, { type: 'application/epub+zip' })); }
    const inp = document.querySelector('.lib-root input[type=file]'); inp.files = dt.files; inp.dispatchEvent(new Event('change'));
  }, QM.BOOKS.map((b) => b.name));
  await page.waitForTimeout(9000);
  await page.evaluate(() => new Promise((res) => { const r = indexedDB.open('snb-library'); r.onsuccess = () => { const t = r.result.transaction('books', 'readwrite'); const st = t.objectStore('books'); const q = st.getAll(); q.onsuccess = () => q.result.forEach((x) => {
    if (/מכתב/.test(x.title)) { x.src = 'drive'; x.driveId = 'D' + x.id; x.md5 = 'a'; delete x.owner; }
    if (/Rich Dad Poor|1985|קיצור/.test(x.title)) { x.fraction = 0.3; x.lastRead = Date.now(); }
    if (/Subtle|2010|1966/.test(x.title)) { x.done = true; x.fraction = 1; }
    st.put(x); }); t.oncomplete = res; }; }));
  await page.evaluate(() => { localStorage.setItem('pwa_libcoll_v1', JSON.stringify({ local: { k1: { n: 'השקעות', s: 'mine', b: ['id-qa-m1', 'id-qa-m2', 'id-qa-m5'], u: 1 }, k2: { n: 'פיתוח אישי', s: 'mine', b: ['id-qa-m3', 'id-qa-m4'], u: 1 }, k3: { n: 'המכתבים האהובים', s: 'snb', b: ['id-qa-l1985', 'id-qa-l2024', 'id-qa-z2020'], u: 1 } } })); });
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(3500);
}

async function open(b, app) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true, colorScheme: THEME, locale: 'he-IL' });
  await ctx.addInitScript(({ db, theme }) => {
    try { localStorage.setItem('pwa_db_v1', JSON.stringify(db)); localStorage.setItem('pwa_owner_v1', /\/(index|academy)\.html$/.test(location.pathname) ? 'local' : 'qa'); localStorage.setItem('pwa_theme_v1', theme); localStorage.setItem('pwa_lang_v1', 'he'); } catch (e) {}
  }, { db: QM.DB, theme: THEME });
  await QM.routes(ctx);   // כל הרשת מדומה (בלי שרתים אמיתיים)
  if (app === 'studio') await studioMock(ctx);
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(BASE + APPS[app], { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { const c = document.querySelector('.login-card'); let o = c; while (o && o.parentElement && o.parentElement !== document.body) o = o.parentElement; if (o && o !== document.body) o.remove(); });
  if (app === 'academy') await academySeed(page);
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });   // --cpu 4 — טלפון עמוס (שם נחשפו התקיעות בחימום)
  const dir = fs.mkdtempSync(path.join(TMP, app + '-'));
  return { ctx, page, cdp, errs, cast: QM.makeCaster(cdp, dir) };
}

const STATE = () => {
  const nav = [...document.querySelectorAll('nav.tabs')].find((n) => !n.hidden && n.getClientRects().length);
  const r = { nav: !!nav, issues: [] };
  if (!nav) { r.issues.push('החוגה לא גלויה'); }
  else {
    const cs = getComputedStyle(nav);
    if (cs.visibility !== 'visible' || +cs.opacity < 0.95) r.issues.push('החוגה מוסתרת (' + cs.opacity + ' ' + cs.visibility + ')');
    const tabs = [...nav.querySelectorAll('.tab')].filter((t) => !t.hidden);
    r.keys = tabs.map((t) => t.dataset.tab);
    const vis = tabs.filter((t) => { const b = t.getBoundingClientRect(); return +getComputedStyle(t).opacity > 0.3 && b.right > 0 && b.left < innerWidth && b.bottom > 0 && b.top < innerHeight; });
    if (vis.length < Math.min(3, tabs.length)) r.issues.push('רק ' + vis.length + ' פריטים גלויים בחוגה (' + vis.map((t) => t.dataset.tab).join(',') + ')');
    // הפעיל = זה שבמרכז ועם הבועה
    const mid = innerWidth / 2;
    const center = tabs.slice().sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return Math.abs(ra.left + ra.width / 2 - mid) - Math.abs(rb.left + rb.width / 2 - mid); })[0];
    r.active = center && center.dataset.tab;
    if (center) {
      const bub = center.querySelector('.tab-bub'), o = bub ? +getComputedStyle(bub).opacity : 1, to = +getComputedStyle(center).opacity;
      if (o < 0.9 || to < 0.9) r.issues.push('הפריט הפעיל (' + r.active + ') לא בשקיפות מלאה: בועה ' + o.toFixed(2) + ', פריט ' + to.toFixed(2));
    }
  }
  // חלון / גיליון פתוח מעל הכל — הסריקה לא רואה את הדף (נמצא 01/11: הודעת מאגר הלמידה כיסתה את כל Studio, והכל "עבר")
  const veil = [...document.querySelectorAll('.dlg-veil, .lib-veil, .modal-veil, [role="dialog"]')].find((v) => !v.matches('.st-root, .lib-root, .cube-ghost') && v.getClientRects().length && getComputedStyle(v).visibility === 'visible' && +getComputedStyle(v).opacity > 0.1);
  if (veil) r.issues.push('חלון פתוח מכסה את המסך: ' + String(veil.className || veil.getAttribute('role')).slice(0, 40) + ' — ' + (veil.textContent || '').trim().slice(0, 40));
  const he = document.elementFromPoint(innerWidth / 2, 56);
  if (!he || he === document.body || he === document.documentElement || he.classList.contains('cube-bd')) r.issues.push('אין הדר גלוי (ראש המסך ריק)');
  const left = document.querySelectorAll('.cube-ghost, .cube-bd, .cube-hold');
  if (left.length) r.issues.push('נשארו ' + left.length + ' שאריות קובייה (' + [...left].map((e) => e.className).join(' | ').slice(0, 120) + ')');
  // .prewarm — חימום מכוון של העמוד השכן מתחת למסך (tabPrewarm: top:100vh, מוסתר) — לא שארית
  for (const e of document.querySelectorAll('.cube-face, .cube-in, .cube-out')) if (!e.classList.contains('prewarm')) r.issues.push('מחלקת קובייה נשארה: ' + (e.id || '') + ' .' + String(e.className).slice(0, 60));
  for (const e of document.querySelectorAll('.tabpage, .st-root, .lib-root')) {
    const s = e.style;
    if (e.classList.contains('prewarm')) continue;
    if (s.transform || s.opacity || s.willChange || s.clipPath || (e.classList.contains('tabpage') && s.position)) r.issues.push('סגנון קובייה נשאר על ' + (e.id || e.className).slice(0, 40) + ': ' + [s.transform, s.opacity, s.willChange, s.clipPath, s.position].filter(Boolean).join(' ').slice(0, 120));
  }
  // תוכן: אלמנטים עם טקסט גלוי במרכז המסך (מתחת להדר, מעל החוגה)
  const navTop = nav ? nav.getBoundingClientRect().top : innerHeight;
  let txt = 0;
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('nav.tabs, .appbar, header')) continue;
    if (!e.childNodes.length || ![...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const b = e.getBoundingClientRect();
    if (b.width < 2 || b.top < 120 || b.bottom > navTop || b.left > innerWidth || b.right < 0) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility !== 'visible' || +cs.opacity < 0.5) continue;
    const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, b.left + b.width / 2)), b.top + b.height / 2);
    if (top && (top === e || e.contains(top) || top.contains(e))) txt++;
  }
  r.txt = txt;
  if (txt < 1) r.issues.push('הדף ריק (' + txt + ' טקסטים גלויים)');
  return r;
};

// מחכים שהמעבר באמת נגמר (אין העתק / רקע / פאה, חוץ מחימום מכוון) — לפחות 900ms, לכל היותר 6 שנ׳. תחת עומס פריים = 100–200ms,
// ובדיקה אחרי זמן קבוע (1.6 שנ׳) תפסה מעבר באמצע ודיווחה "שארית"; מה שלא נגמר אחרי 6 שנ׳ — באמת תקוע (ומדווח ב־check)
async function settle(page) {
  await page.waitForTimeout(900);
  for (let i = 0; i < 51; i++) {
    const busy = await page.evaluate(() => !!document.querySelector('.cube-ghost, .cube-bd, .cube-hold, .cube-face:not(.prewarm), .cube-in:not(.prewarm), .cube-out'));
    if (!busy) break;
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(250);
}
async function touchDrag(cdp, x0, y, dx, steps, gap) {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / steps, y: y + i * 0.3 }] }); await new Promise((r) => setTimeout(r, gap)); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}

async function check(app, S, step, want) {
  const st = await S.page.evaluate(STATE);
  for (const i of st.issues) bad(app, step, i);
  if (want && st.active && st.active !== want) bad(app, step, 'הפריט הפעיל בחוגה ' + st.active + ' ולא ' + want);
  const log = await S.page.evaluate(() => { const l = window.__probe.log; window.__probe.log = []; window.__probe.on = false; return l; });
  const navGone = log.filter((x) => !x.navOk).length;
  if (navGone) bad(app, step, 'בזמן המעבר החוגה נעלמה ב־' + navGone + ' פריימים');
  const fr = S.casting ? await S.cast.stop() : [];
  S.casting = false;
  if (fr.length) {
    const sd = JSON.parse(execFileSync('python3', ['-c', PYB, JSON.stringify(fr.map((x) => x.f))]).toString());
    // ריק = פחות מ־4 לאלף, וגם פחות מחצי מהדף שלפני המעבר, מהדף שאחריו ומהעמוד הדליל ביותר באפליקציה (S.base — נסיעה של שני
    // פריטים עוברת דרך עמוד שלישי, למשל העסקאות הריקות בתיק הדמו) (עמוד ריק מטבעו — "מה למדתי" בלי הדגשות — אינו "הבהוב";
    // דף שנחת ריק — נתפס ב־STATE: אין טקסט גלוי)
    const ref = Math.min(sd[0][0], sd[sd.length - 1][0], S.base || Infinity), dref = Math.min(sd[0][1], sd[sd.length - 1][1]);
    let run = 0, worst = 0, dock = 0;
    for (const [m, d] of sd) { run = m < Math.min(4, ref * 0.5) ? run + 1 : 0; worst = Math.max(worst, run); if (d < Math.min(6, dref * 0.4)) dock++; }
    if (worst >= 1) bad(app, step, 'בזמן המעבר: ' + worst + ' פריימים רצופים שבהם אמצע המסך ריק (מתוך ' + sd.length + ')');
    if (dock) bad(app, step, 'בזמן המעבר: ' + dock + ' פריימים בלי חוגה (תחתית המסך אחידה)');
    // שומרים את הפריימים של צעד שנכשל (KEEP=<תיקייה>) — כדי לראות בעין מה היה על המסך
    if ((worst >= 1 || dock) && process.env.KEEP) { const d = path.join(process.env.KEEP, app + '-' + step.replace(/[^\w\u0590-\u05ff]+/g, '_')); fs.mkdirSync(d, { recursive: true }); fr.forEach((x, i) => { try { fs.copyFileSync(x.f, path.join(d, String(i).padStart(3, '0') + '-' + sd[i][0] + '.jpg')); } catch (e) {} }); }
    for (const x of fr) { try { fs.unlinkSync(x.f); } catch (e) {} }
  }
  if (S.errs.length) { bad(app, step, 'שגיאות: ' + S.errs.join(' | ')); S.errs.length = 0; }
  return st;
}
let CUR = null;
const arm = async (page) => { await page.evaluate(() => { window.__probe.log = []; window.__probe.on = true; }); if (CUR && !CUR.casting) { await CUR.cast.start(); CUR.casting = true; } };

async function sweep(b, app) {
  const S = await open(b, app);
  CUR = S;
  const st0 = await check(app, S, 'פתיחה', null);
  const keys = st0.keys || [];
  console.log('[' + app + '] פריטים בחוגה: ' + keys.join(', ') + ' · טקסטים בדף: ' + st0.txt);
  if (!keys.length) { await S.ctx.close(); return; }
  // הבסיס: צפיפות הקצוות של כל עמוד במנוחה — הדליל ביותר
  const shots = [];
  for (const k of keys) {
    await S.page.evaluate((k) => { const t = [...document.querySelectorAll('nav.tabs .tab')].find((x) => x.dataset.tab === k && !x.hidden); if (t) t.click(); }, k);
    await settle(S.page);
    const f = path.join(TMP, app + '-base-' + k + '.jpg'); await S.page.screenshot({ path: f, type: 'jpeg', quality: 60 }); shots.push(f);
  }
  const bs = JSON.parse(execFileSync('python3', ['-c', PYB, JSON.stringify(shots)]).toString()).map((x) => x[0]);
  S.base = Math.min(...bs);
  console.log('[' + app + '] בסיס (קצוות לאלף, לכל עמוד): ' + keys.map((k, i) => k + ' ' + bs[i]).join(' · '));
  await S.page.evaluate(() => { window.__probe.log = []; });
  const navBox = await S.page.evaluate(() => { const n = [...document.querySelectorAll('nav.tabs')].find((x) => !x.hidden && x.getClientRects().length); const r = n.getBoundingClientRect(); return { y: r.top + r.height * 0.45 }; });
  // 1. לחיצה על כל פריט, הלוך ושוב (כל זוג)
  for (const a of keys) for (const k of keys) {
    if (a === k) continue;
    await S.page.evaluate((a) => { const t = [...document.querySelectorAll('nav.tabs .tab')].find((x) => x.dataset.tab === a && !x.hidden); if (t) t.click(); }, a);
    await settle(S.page);
    await arm(S.page);
    await S.page.evaluate((k) => { const t = [...document.querySelectorAll('nav.tabs .tab')].find((x) => x.dataset.tab === k && !x.hidden); if (t) t.click(); }, k);
    await settle(S.page);
    await check(app, S, 'לחיצה ' + a + ' → ' + k, k);
  }
  // 2. החלקה על הדף — לכל כיוון, מכל פריט (איטי ומהיר)
  for (const speed of [['איטית', 12, 16], ['מהירה', 4, 6]]) {
    for (const dir of [-1, 1]) {
      for (let i = 0; i < keys.length; i++) {
        await arm(S.page);
        await touchDrag(S.cdp, dir < 0 ? 300 : 90, 470, dir * 200, speed[1], speed[2]);
        await settle(S.page);
        await check(app, S, 'החלקה ' + speed[0] + ' ' + (dir < 0 ? 'שמאלה' : 'ימינה') + ' #' + (i + 1), null);
      }
    }
  }
  // 3. גרירת החוגה — פריט אחד ושניים, לשני הכיוונים
  for (const span of [70, 150]) for (const dir of [-1, 1]) for (let i = 0; i < 3; i++) {
    await arm(S.page);
    await touchDrag(S.cdp, dir < 0 ? 280 : 110, navBox.y, dir * span, 8, 12);
    await settle(S.page);
    await check(app, S, 'גרירת חוגה ' + span + 'px ' + (dir < 0 ? 'שמאלה' : 'ימינה') + ' #' + (i + 1), null);
  }
  // 4. רצף מהיר — הבא לפני שהקודם נגמר (חוגה ועמוד לסירוגין), ואז בדיקה אחת
  await arm(S.page);
  for (let i = 0; i < 16; i++) {
    const onNav = i % 2 === 0, dir = i % 5 === 4 ? 1 : -1;
    await touchDrag(S.cdp, dir < 0 ? 280 : 110, onNav ? navBox.y : 470, dir * (onNav ? 90 : 180), 4, 6);
    await S.page.waitForTimeout(i % 3 ? 70 : 160);
  }
  await settle(S.page);
  await check(app, S, 'רצף מהיר (16 מחוות)', null);
  await S.ctx.close();
}

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium' });
  for (const app of Object.keys(APPS)) { if (!only || only === app) { try { await sweep(b, app); } catch (e) { bad(app, 'הסריקה', String(e.message).slice(0, 200)); } } }
  await b.close();
  console.log('הפרות: ' + total);
  process.exit(total ? 1 : 0);
})();
