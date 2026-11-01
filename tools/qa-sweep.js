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
// פריים ריק = רצועת האמצע (30%–85% מהגובה) כמעט אחידה — אותו סף של tools/vid-scan.py (EMPTY)
const PYB = 'import sys,json\nfrom PIL import Image, ImageStat\nout=[]\nfor f in json.loads(sys.argv[1]):\n    im=Image.open(f).convert("L"); w,h=im.size\n    m=im.crop((0,int(h*.3),w,int(h*.85))).resize((72,86)); d=im.crop((0,int(h*.88),w,h)).resize((72,16))\n    out.append([round(ImageStat.Stat(m).stddev[0],1), round(ImageStat.Stat(d).stddev[0],1)])\nprint(json.dumps(out))';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const BASE = 'http://localhost:8792';
const APPS = { invest: '/index.html', studio: '/studio.html', academy: '/academy.html' };
const only = arg('app', null), THEME = arg('theme', 'light');
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

async function open(b, app) {
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true, colorScheme: THEME, locale: 'he-IL' });
  await ctx.addInitScript(({ db, theme }) => {
    try { localStorage.setItem('pwa_db_v1', JSON.stringify(db)); localStorage.setItem('pwa_owner_v1', location.pathname.endsWith('/index.html') ? 'local' : 'qa'); localStorage.setItem('pwa_theme_v1', theme); localStorage.setItem('pwa_lang_v1', 'he'); } catch (e) {}
  }, { db: QM.DB, theme: THEME });
  await QM.routes(ctx);   // כל הרשת מדומה (בלי שרתים אמיתיים)
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message).slice(0, 160)));
  await page.goto(BASE + APPS[app], { waitUntil: 'load' });
  await page.waitForTimeout(3500);
  await page.evaluate(() => { const c = document.querySelector('.login-card'); let o = c; while (o && o.parentElement && o.parentElement !== document.body) o = o.parentElement; if (o && o !== document.body) o.remove(); });
  const cdp = await ctx.newCDPSession(page);
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
  const he = document.elementFromPoint(innerWidth / 2, 56);
  if (!he || he === document.body || he === document.documentElement || he.classList.contains('cube-bd')) r.issues.push('אין הדר גלוי (ראש המסך ריק)');
  const left = document.querySelectorAll('.cube-ghost, .cube-bd, .cube-hold');
  if (left.length) r.issues.push('נשארו ' + left.length + ' שאריות קובייה (' + [...left].map((e) => e.className).join(' | ').slice(0, 120) + ')');
  for (const e of document.querySelectorAll('.cube-face, .cube-in, .cube-out, .prewarm')) r.issues.push('מחלקת קובייה נשארה: ' + (e.id || e.className).slice(0, 60));
  for (const e of document.querySelectorAll('.tabpage, .st-root, .lib-root')) {
    const s = e.style;
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
  if (txt < 2) r.issues.push('הדף ריק (' + txt + ' טקסטים גלויים)');
  return r;
};

async function settle(page) { await page.waitForTimeout(1600); }
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
    // יחסי: ריק = פחות מחצי מהמרקם של הדף שלפני המעבר ושל הדף שאחריו (דף דליל בצבעי פסטל — כ־14 גם כשהוא תקין)
    const ref = Math.min(sd[0][0], sd[sd.length - 1][0]), dref = Math.min(sd[0][1], sd[sd.length - 1][1]);
    let run = 0, worst = 0, dock = 0;
    for (const [m, d] of sd) { run = m < Math.min(14, ref * 0.5) ? run + 1 : 0; worst = Math.max(worst, run); if (d < Math.min(6, dref * 0.4)) dock++; }
    if (worst >= 1) bad(app, step, 'בזמן המעבר: ' + worst + ' פריימים רצופים שבהם אמצע המסך ריק (מתוך ' + sd.length + ')');
    if (dock) bad(app, step, 'בזמן המעבר: ' + dock + ' פריימים בלי חוגה (תחתית המסך אחידה)');
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
