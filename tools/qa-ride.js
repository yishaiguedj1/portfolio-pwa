/* גלילה מהירה במגע — בחוגה ובעמוד, הבאה מתחילה לפני שהקודמת נגמרה — ובדיקה שלא נשאר סגנון של קובייה על אף עמוד (01/11/2026, סבב קפיצות 7).
   דורש שרת מקומי על 8792 (python3 -m http.server 8792). node tools/qa-ride.js → issues 0. לפני התיקון (cubeFaceOff → off): 8 */
const { chromium } = require(process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright');
const QM = require('./qa-motion.js');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 393, height: 852 }, serviceWorkers: 'block', hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(({ db }) => { localStorage.setItem('pwa_db_v1', JSON.stringify(db)); localStorage.setItem('pwa_owner_v1', 'local'); localStorage.setItem('pwa_lang_v1', 'he'); }, { db: QM.DB });
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8792/index.html'); await p.waitForTimeout(3000);
  await p.evaluate(() => { const c = document.querySelector('.login-card'); let o = c; while (o && o.parentElement && o.parentElement !== document.body) o = o.parentElement; if (o) o.remove(); });
  const navY = await p.evaluate(() => { const r = document.querySelector('nav.tabs').getBoundingClientRect(); return r.top + r.height / 2; });
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  const check = () => p.evaluate(() => {
    const cur = currentTabName(); const bad = [];
    for (const s of document.querySelectorAll('.tabpage')) {
      const st = s.style; const vis = s.getClientRects().length > 0;
      if (st.transform || st.opacity || st.position || st.willChange || st.clipPath || s.classList.contains('cube-face') || s.classList.contains('cube-in') || s.classList.contains('cube-out'))
        bad.push(s.id + (vis ? '[vis]' : '') + ' ' + JSON.stringify({ t: st.transform, o: st.opacity, pos: st.position, cls: s.className }));
    }
    return { cur, bad, cubeNow: !!cubeNow, tabCube: !!tabCube };
  });
  let issues = 0;
  for (let round = 0; round < 30; round++) {
    const dir = round % 3 === 2 ? -1 : 1, x0 = 200, steps = 4 + (round % 5), dx = 30 + (round % 4) * 25;
    await touch('touchStart', x0, navY);
    for (let i = 1; i <= steps; i++) { await touch('touchMove', x0 + dir * i * dx / steps * 3, navY); await p.waitForTimeout(8); }
    await touch('touchEnd');
    await p.waitForTimeout(round % 2 ? 60 : 180);   // הבאה מתחילה לפני שהנסיעה נגמרה
    if (round % 5 === 4) {
      await p.waitForTimeout(1500);
      const r = await check();
      if (r.bad.length || r.cubeNow || r.tabCube) { issues++; console.log('round', round, JSON.stringify(r).slice(0, 700)); }
    }
  }
  // גם החלקות מהירות על העמוד עצמו
  for (let round = 0; round < 20; round++) {
    const dir = round % 4 === 3 ? 1 : -1;
    await touch('touchStart', 200, 400);
    for (let i = 1; i <= 5; i++) { await touch('touchMove', 200 + dir * i * 40, 402); await p.waitForTimeout(8); }
    await touch('touchEnd'); await p.waitForTimeout(round % 2 ? 50 : 150);
    if (round % 5 === 4) { await p.waitForTimeout(1500); const r = await check(); if (r.bad.length || r.cubeNow || r.tabCube) { issues++; console.log('page round', round, JSON.stringify(r).slice(0, 700)); } }
  }
  console.log('issues', issues, 'errors', errs.slice(0, 3));
  await b.close();
})();
