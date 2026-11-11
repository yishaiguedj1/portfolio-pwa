#!/usr/bin/env node
/* QA תצוגת מחשב (11/11/2026, פרויקט "תצוגה למחשב" — docs/desktop-plan.md):
   מצלם את כל האפליקציות ברוחבי מחשב — Invest (כל לשונית + כרטיס מניה + המנתח), Academy (מדפים, דף ספר, קורא),
   Studio (בית, מגדל, עבודה, הגדרות), Cashflow ומרכז הניהול — ובודק בכל צילום כללי פריסה של מחשב:
     - אין גלילה אופקית · התוכן ממורכז ולא נמתח מקצה לקצה · אין כפתור קטן מ־24px (WCAG 2.5.8) במצב עכבר / 40px במצב מגע
     - מצב הקלט (html[data-input]) תואם להתקן (עכבר/מגע) · הסרגל הצדדי קיים ברוחב מחשב
   הרצה: node tools/qa-desktop.js --out <dir> [--width 1440] [--height 900] [--theme light|dark] [--touch] [--only inv|ac|st|cf|adm] [--lang en] [--scale 1] [--mobile] [--quick] [--htag] [--scrollbars]
   דורש שרת מקומי על 8792 (python3 -m http.server 8792 בשורש הריפו). כל הרשת מדומה (qa-motion.js) — שום בקשה לא יוצאת. */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright');
const QM = require('./qa-motion.js');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = path.resolve(String(arg('out', 'qa-desktop-out')));
const W = +arg('width', 1440), H = +arg('height', 900), THEME = String(arg('theme', 'light')), TOUCH = !!arg('touch', false);
const ONLY = String(arg('only', '')), LANG = String(arg('lang', 'he')), SCALE = +arg('scale', 1);
// --mobile: טלפון/טאבלט אמיתי (isMobile + מגע); --quick: רק המסכים הראשיים (לסריקת גדלים — tools/qa-sizes.sh)
const MOBILE = !!arg('mobile', false), QUICK = !!arg('quick', false);
// --scrollbars: פסי גלילה קבועים (ברירת המחדל ב־Windows) — headless מסתיר אותם, ואז לא רואים גלילה אופקית שנגרמת מהם
const BARS = !!arg('scrollbars', false);
const BASE = 'http://localhost:8792';
// בטלפון — הקשה (pointerType touch), אחרת לחיצת עכבר: מצב הקלט של האפליקציה נשאר נכון
const press = (loc, o) => (MOBILE || TOUCH ? loc.tap(o) : loc.click(o));
fs.mkdirSync(OUT, { recursive: true });
const tag = (arg('htag', false) ? W + 'x' + H : W) + (MOBILE ? 'm' : TOUCH ? 't' : '') + (BARS ? 'w' : '') + (THEME === 'dark' ? 'd' : '') + (LANG === 'en' ? 'e' : '');
const report = [];

async function newCtx(browser) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: SCALE, serviceWorkers: 'block',
    hasTouch: TOUCH || MOBILE, isMobile: MOBILE, colorScheme: THEME === 'dark' ? 'dark' : 'light', locale: LANG === 'en' ? 'en-US' : 'he-IL' });
  await QM.routes(ctx);
  await ctx.addInitScript(({ db, theme, lang }) => {
    try { if (!localStorage.getItem('__qa_seeded')) { localStorage.setItem('pwa_db_v1', JSON.stringify(db)); localStorage.setItem('pwa_owner_v1', 'local'); localStorage.setItem('pwa_theme_v1', theme); localStorage.setItem('pwa_lang_v1', lang); localStorage.setItem('__qa_seeded', '1'); } } catch (e) {}
  }, { db: QM.DB, theme: THEME, lang: LANG });
  return ctx;
}

/* בדיקות הפריסה של מחשב על הדף הנוכחי */
async function audit(page, name) {
  const r = await page.evaluate(({ touch }) => {
    const de = document.documentElement, vw = innerWidth;
    const out = { name: '', hscroll: de.scrollWidth > vw + 1, input: de.dataset.input || '', desk: de.classList.contains('dk') };
    const small = [];
    const min = touch ? 40 : 24;
    document.querySelectorAll('button, [role=button], a[href], [role=tab], input[type=checkbox], select').forEach((b) => {
      const x = b.getBoundingClientRect(); if (!x.width || !x.height) return;
      if (x.bottom < 0 || x.top > innerHeight || x.right < 0 || x.left > vw) return;
      const cs = getComputedStyle(b); if (cs.visibility === 'hidden' || +cs.opacity === 0 || cs.pointerEvents === 'none') return;
      if (b.closest('[inert], [aria-hidden="true"], .cube-ghost')) return;
      if (Math.min(x.width, x.height) < min) small.push((b.id ? '#' + b.id : '.' + String(b.className || b.tagName).split(' ')[0]) + ' ' + Math.round(x.width) + '×' + Math.round(x.height));
    });
    out.small = [...new Set(small)].slice(0, 12);
    const main = document.querySelector('main, .lib-home, .st-page, .cf-root, .adm-page');
    if (main) { const m = main.getBoundingClientRect(); out.main = Math.round(m.width); out.mainX = Math.round(m.left); }
    const sb = document.querySelector('.dk-side'); out.side = sb ? Math.round(sb.getBoundingClientRect().width) : 0;
    // רכיב שבורח מהמסך בלי מכל גלילה (body עם overflow-x מסתיר את הגלילה — לכן בודקים רכיבים, לא רק scrollWidth)
    const esc = [], clip = [], tiny = [];
    const nm = (b) => (b.id ? '#' + b.id : '.' + (String(b.className && b.className.baseVal !== undefined ? b.className.baseVal : b.className || b.tagName).split(' ')[0] || b.tagName.toLowerCase()));
    const clipX = (el) => { for (let p = el.parentElement; p && p !== document.body && p !== de; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflowX !== 'visible' || s.position === 'fixed') return true; } return false; };
    const shown = (el) => { const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0 && !el.closest('[inert], [aria-hidden="true"], .cube-ghost, [hidden]'); };
    for (const el of document.body.querySelectorAll('*')) {
      if (el.closest('svg') && el.tagName !== 'svg') continue;
      const x = el.getBoundingClientRect(); if (x.width < 2 || x.height < 2) continue;
      if (x.bottom < 0 || x.top > innerHeight) continue;
      const leaf = el.childElementCount === 0 && (el.textContent || '').trim().length > 0;
      if ((x.right > vw + 2 || x.left < -2) && (leaf || el.matches('button, input, img, canvas, .card')) && shown(el) && !clipX(el)) esc.push(nm(el) + ' ' + Math.round(x.left) + '…' + Math.round(x.right));
      if (!leaf || !shown(el)) continue;
      const cs = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX !== 'visible' && cs.textOverflow !== 'ellipsis' && !/(auto|scroll)/.test(cs.overflowX) && el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA') clip.push(nm(el) + ' «' + el.textContent.trim().slice(0, 18) + '»');
      if (parseFloat(cs.fontSize) < 11 && x.right > 0 && x.left < vw) tiny.push(nm(el) + ' ' + cs.fontSize);
    }
    // פס גלילה אופקי גלוי (Windows / "תמיד להציג פסי גלילה" ב־Mac): שורת כפתורים שנגללת ופס שתופס מקום מתחתיה
    const bars = [];
    for (const el of document.body.querySelectorAll('*')) {
      const cs = getComputedStyle(el); if (!/(auto|scroll)/.test(cs.overflowX) || el.scrollWidth <= el.clientWidth + 1) continue;
      if (el.offsetHeight - el.clientHeight - (parseFloat(cs.borderTopWidth) || 0) - (parseFloat(cs.borderBottomWidth) || 0) > 2 && shown(el)) { const x = el.getBoundingClientRect(); if (x.bottom > 0 && x.top < innerHeight) bars.push(nm(el)); }
    }
    out.bars = [...new Set(bars)].slice(0, 10);
    out.esc = [...new Set(esc)].slice(0, 10); out.clip = [...new Set(clip)].slice(0, 10); out.tiny = [...new Set(tiny)].slice(0, 10);
    return out;
  }, { touch: TOUCH || MOBILE });
  r.name = name; report.push(r);
  process.stdout.write((r.hscroll ? '✗ גלילה אופקית · ' : '') + name + ' · תוכן ' + (r.main || '-') + 'px · צד ' + r.side + ' · קלט ' + (r.input || '-') + (r.small.length ? ' · קטנים: ' + r.small.length : '') + (r.esc.length ? ' · ✗ בורחים: ' + r.esc.slice(0, 3).join(', ') : '') + (r.clip.length ? ' · ✗ חתוך: ' + r.clip.slice(0, 3).join(', ') : '') + (r.tiny.length ? ' · גופן קטן: ' + r.tiny.length : '') + (r.bars.length ? ' · ✗ פס גלילה: ' + r.bars.slice(0, 4).join(', ') : '') + '\n');
}
async function shot(page, name, opt = {}) {
  await page.waitForTimeout(opt.wait || 700);
  await page.screenshot({ path: path.join(OUT, tag + '-' + name + '.png'), fullPage: !!opt.full });
  await audit(page, name);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', ignoreDefaultArgs: BARS ? ['--hide-scrollbars'] : [] });
  const errors = [];
  const watch = (page) => page.on('pageerror', (e) => errors.push(page.url().split('/').pop() + ': ' + String(e.message).slice(0, 160)));

  /* ---------- Invest ---------- */
  if (!ONLY || ONLY === 'inv') {
    const ctx = await newCtx(browser); const page = await ctx.newPage(); watch(page);
    await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await page.waitForTimeout(2600);
    if (TOUCH || MOBILE) await page.touchscreen.tap(W / 2, H - 10).catch(() => {}); else await page.mouse.move(W / 2, H / 2);
    for (const t of ['overview', 'stocks', 'trades', 'deposits', 'wishlist', 'pension', 'settings']) {
      await page.evaluate((n) => switchTab(n), t); await shot(page, 'inv-' + t, { wait: 900 });
    }
    await page.evaluate(() => switchTab('stocks')); await page.waitForTimeout(600);
    await press(page.locator('#stockList .stock .stock-head').first(), { timeout: 4000 }).catch(() => {});
    await shot(page, 'inv-stock-open', { wait: 1400 });
    await press(page.locator('.stock.open .an-open-btn').first(), { timeout: 4000 }).catch(() => {});
    await shot(page, 'inv-analysis', { wait: 2600 });
    await page.keyboard.press('Escape'); await page.waitForTimeout(600);
    await page.evaluate(() => switchTab('overview')); await page.waitForTimeout(500);
    if (!QUICK) { await press(page.locator('#menuBtn'), { timeout: 3000 }).catch(() => {}); await shot(page, 'inv-menu', { wait: 700 }); }
    if (W >= 1024 && !QUICK) {
    // לוח הפקודות (Ctrl+K) עם חיפוש מניה, ובפריסה הלא נכונה ("ndh" → "מגי"); ואז חלון הקיצורים (?)
    await page.keyboard.press('Escape').catch(() => {}); await page.waitForTimeout(300);
    await page.keyboard.press('Control+KeyK'); await page.waitForTimeout(350); await shot(page, 'inv-palette', { wait: 200 });
    await page.keyboard.type('me'); await shot(page, 'inv-palette-q', { wait: 300 });
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    await page.keyboard.press('Shift+Slash'); await shot(page, 'inv-help', { wait: 400 });
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    }
    await ctx.close();
  }

  /* ---------- Academy ---------- */
  if (!ONLY || ONLY === 'ac') {
    const ctx = await newCtx(browser); const page = await ctx.newPage(); watch(page);
    await ctx.addInitScript(() => { try { localStorage.setItem('pwa_libshelf_v1', 'mine'); } catch (e) {} });
    await page.goto(BASE + '/academy.html', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await press(page.locator('.lib-dial .tab[data-tab="mine"], .dk-side [data-k="mine"]').first(), { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.evaluate(async (names) => {
      const dt = new DataTransfer();
      for (const n of names) { const bl = await (await fetch('/.qa-books/' + n)).blob(); dt.items.add(new File([bl], n, { type: 'application/epub+zip' })); }
      const inp = document.querySelector('.lib-root input[type=file]'); if (!inp) return; inp.files = dt.files; inp.dispatchEvent(new Event('change'));
    }, QM.BOOKS.map((b) => b.name)).catch(() => {});
    await page.waitForTimeout(8000);
    await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(2500);
    await shot(page, 'ac-mine');
    await press(page.locator('.lib-dial .tab[data-tab="snb"], .dk-side [data-k="snb"]').first(), { timeout: 4000 }).catch(() => {});
    await shot(page, 'ac-snb', { wait: 1200 });
    await press(page.locator('.lib-dial .tab[data-tab="mine"], .dk-side [data-k="mine"]').first(), { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(800);
    await press(page.locator('.lib-chip:nth-child(2)').first(), { timeout: 4000 }).catch(() => {});   // "הכל" — רשת הספרים (המדף נפתח על האסופות)
    await page.waitForTimeout(900);
    await shot(page, 'ac-all');
    await page.evaluate(() => { const it = document.querySelector('.lib-item'); if (it) it.click(); }).catch(() => {});
    await shot(page, 'ac-book', { wait: 1400 });
    await press(page.locator('.bk-cta').first(), { timeout: 4000 }).catch(() => {});
    await shot(page, 'ac-reader', { wait: 2600 });
    await ctx.close();
  }

  /* ---------- Studio ---------- */
  if (!ONLY || ONLY === 'st') {
    const ctx = await newCtx(browser);
    await ctx.route(/\/auth\.js(\?|$)/, (r) => r.fulfill({ contentType: 'application/javascript', body: `(function(){var cbs=[],u={uid:'qa',email:'qa@example.com',displayName:'QA',getIdToken:async()=>'tok'};
      window.firebase=window.firebase||{apps:[1],auth:function(){return {currentUser:u}}};
      window.SnbAuth={start(){setTimeout(()=>cbs.forEach(f=>f('in')),50)},onChange(f){cbs.push(f);return()=>{}},user(){return u},state(){return 'in'},sub(){return null},signIn(){},signOut(){},hasEmail(){return true}};})();` }));
    const jid = (n) => 'j' + String(n).padStart(20, 'Q');
    const JOBS = [1, 2, 3, 4, 5, 6].map((n) => ({ id: jid(n), created: Date.now() - n * 3600e3, state: 'done', fired: Date.now() - n * 3600e3, done: Date.now() - n * 3500e3,
      spec: { name: 'Demo.Show.S01E0' + n + '.720p.mkv', size: 3e8, from: 'en', to: 'he', mode: 'std' }, files: { a: { id: 'fa' + n, size: 1e6 }, v: { id: 'fv' + n, size: 3e8 } } }));
    await ctx.route(/\/api\/studio/, (r) => { let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      const now = Date.now(), J = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
      if (b.op === 'status') return J({ ok: true, kinds: [], conn: { hint: 'x', ok: now }, drive: { connected: true, email: 'qa@example.com' }, now });
      if (b.op === 'jobs') return J({ ok: true, jobs: JOBS, now });
      if (b.op === 'job') return J({ ok: true, job: JOBS.find((x) => x.id === b.job) || null });
      return r.fallback(); });
    await ctx.addInitScript(() => { try { if (location.pathname.endsWith('/studio.html') && !localStorage.getItem('__qa_st')) { localStorage.setItem('pwa_owner_v1', 'qa'); localStorage.setItem('__qa_st', '1'); } } catch (e) {} });
    const page = await ctx.newPage(); watch(page);
    await page.goto(BASE + '/studio.html', { waitUntil: 'load' }); await page.waitForTimeout(3000);
    await press(page.locator('.dlg-ok'), { timeout: 1500 }).catch(() => {});
    await shot(page, 'st-home', { wait: 900 });
    await press(page.locator('button[aria-label="מגדל הפיקוח"], .dk-side [data-k="tower"]').first(), { timeout: 4000 }).catch(() => {});
    await shot(page, 'st-tower', { wait: 1400 });
    await press(page.locator('.st-root:not(.cube-ghost) .st-nav-s button').first(), { timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(900);
    await press(page.locator('.st-proj').first(), { timeout: 4000 }).catch(() => {});
    await shot(page, 'st-job', { wait: 1500 });
    await page.keyboard.press('Escape'); await page.waitForTimeout(900);
    await press(page.locator('.dk-side .dk-set').first(), { timeout: 4000 }).catch(() => {});
    await shot(page, 'st-settings', { wait: 1500 });
    await ctx.close();
  }

  /* ---------- Cashflow (בלי נתונים: כרטיס החיבור / המצב הריק) ---------- */
  if (!ONLY || ONLY === 'cf') {
    const ctx = await newCtx(browser);
    await ctx.route(/\/auth\.js(\?|$)/, (r) => r.fulfill({ contentType: 'application/javascript', body: `(function(){var cbs=[],u={uid:'qa',email:'qa@example.com',displayName:'QA',getIdToken:async()=>'tok'};
      window.SnbAuth={start(){setTimeout(()=>cbs.forEach(f=>f('in')),50)},onChange(f){cbs.push(f);return()=>{}},user(){return u},state(){return 'in'},sub(){return null},signIn(){},signOut(){},hasEmail(){return true}};})();` }));
    await ctx.route(/\/api\/cashflow/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'not_connected' }), headers: { 'access-control-allow-origin': '*' } }));
    await ctx.addInitScript(() => { try { localStorage.setItem('pwa_owner_v1', 'qa'); } catch (e) {} });
    const page = await ctx.newPage(); watch(page);
    await page.goto(BASE + '/cashflow.html', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await shot(page, 'cf-home');
    await ctx.close();
  }

  /* ---------- מרכז הניהול ---------- */
  if (!ONLY || ONLY === 'adm') {
    const ctx = await newCtx(browser);
    await ctx.route(/\/auth\.js(\?|$)/, (r) => r.fulfill({ contentType: 'application/javascript', body: `(function(){var cbs=[],u={uid:'qa',email:'',getIdToken:async()=>'tok'};
      window.SnbAuth={start(){setTimeout(()=>cbs.forEach(f=>f('in')),50)},onChange(f){cbs.push(f);return()=>{}},user(){return u},state(){return 'in'},sub(){return null},signIn(){},signOut(){}};})();` }));
    const ADM = { adminOv: { ov: { items: [], run: [], dates: [] } }, learn: { view: null }, adminBackups: { bk: { warn: [], r2: null, off: null, keep: 30 } },
      adminLog: { log: { items: [], n7: 0, days: 30 } }, adminTasks: { tk: { items: [] }, ck: { open: [] } } };
    await ctx.route(/\/api\/studio/, (r) => { let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
      const o = ADM[b.op] ? Object.assign({ ok: true }, ADM[b.op]) : { ok: false, error: 'x' };
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } }); });
    const page = await ctx.newPage(); watch(page);
    await page.goto(BASE + '/admin.html#ov', { waitUntil: 'load' }); await page.waitForTimeout(2500);
    await shot(page, 'adm-ov');
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT, tag + '-report.json'), JSON.stringify({ w: W, h: H, theme: THEME, touch: TOUCH, report, errors }, null, 1));
  if (errors.length) console.log('שגיאות בדף:\n' + [...new Set(errors)].slice(0, 15).join('\n'));
  const bad = report.filter((r) => r.hscroll).length, esc = report.filter((r) => r.esc.length).length, clip = report.filter((r) => r.clip.length).length;
  console.log('סה״כ ' + report.length + ' צילומים · גלילה אופקית: ' + bad + ' · בורחים: ' + esc + ' · חתוכים: ' + clip + ' · שגיאות: ' + errors.length);
})().catch((e) => { console.error(e); process.exit(1); });
