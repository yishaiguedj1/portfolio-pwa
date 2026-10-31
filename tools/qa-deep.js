#!/usr/bin/env node
/* QA עמוק למעברים (28/10/2026, בקשת המשתמש — "שכל מעבר יהיה סטטי כמו אפליקציה שהכל נטען מראש"):
   נכנס לכל תת־תפריט שהכלי הכללי (qa-motion.js) לא מגיע אליו — מנתח החברות (כל לשונית, תת־לשונית, תת־עמוד, גיליון),
   גרף הנרות (טווחים, סוגי גרף, אינדיקטורים, כלים, רשימת מעקב), Academy ו־Studio — ומודד בכל צעד:
     - קפיצות פריסה (layout-shift) · קפיצות גלילה גם בשכבות שנגללות בעצמן (.an-root, .kc-*, .lib-root)
     - הבהובים וריצודים (צילום רציף, אותו ניתוח של qa-motion)
     - "תוכן מאוחר": שינויים במסך אחרי שהמעבר נגמר (מה שנראה כטעינה/רענון) — ms מהפעולה עד שהמסך נרגע
   הרצה: node tools/qa-deep.js --out <dir> [--only an|kc|ac|st|adm] [--landing] [--theme dark] [--cpu 4] [--lat 500] [--rounds 2]
   דורש שרת מקומי על 8792 (python3 -m http.server 8792). כל הרשת מדומה: fund/macro מפיקסטורה ציבורית (tests/fixtures/qa), נרות סינתטיים. */
const fs = require('fs');
const path = require('path');
const { chromium } = require(process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright');
const QM = require('./qa-motion.js');

const args = process.argv.slice(2);
const arg = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : d; };
const OUT = path.resolve(String(arg('out', 'qa-deep-out')));
const THEME = arg('theme', 'light'), CPU = +arg('cpu', 1), LAT = +arg('lat', 350), ONLY = String(arg('only', '')), ROUNDS = +arg('rounds', 1), WIDTH = +arg('width', 390);
const DISCOVER = !!arg('discover', false), FRAMES = !!arg('frames', false);
// --landing (29/10/2026): במקום הצילום הרציף — "נחיתה": עוצרים את הקובייה בפריים האחרון שלה (עוד בתוך האנימציה) ומשווים לדף אחרי שנרגע. הבדל מעל 4.5 = משהו
// שנצבע אחרת בזמן הסיבוב ו"קופץ" כשהוא נגמר (בטלפון: זכוכית ההדר כפס אטום שחתך את הכותרת הגדולה בכל מעבר)
const LANDING = !!arg('landing', false);
// --snow (31/10/2026, כפתורי כדור שלג): בכל צעד — כל <button>/[role=button] גלוי שלא קיבל את השלג (snow-cap ברקע) ואינו פטור (@snow-exempt ב־snow.css)
// נרשם ל־snow.txt (מחלקה · צעד), וכל צעד מצולם ל־snow-NNN.png. מטרה: "כל הכפתורים במערכת, ללא יוצא מן הכלל"
const SNOW = !!arg('snow', false);
const SNOW_EXEMPT = (() => { try { const s = fs.readFileSync(path.join(__dirname, '..', 'snow.css'), 'utf8'); const m = s.match(/\/\* @snow-exempt([\s\S]*?)\*\//); return m ? [...new Set(m[1].match(/\b[a-z][\w-]+-[\w-]+\b|\b(?:card|tab)\b/g))] : []; } catch (e) { return []; } })();
const snowMiss = new Map();
// --prof <ביטוי>: פרופיל CPU לצעדים ששמם מתאים — הפונקציות הכבדות (זמן עצמי) והמשימות הארוכות (28/10/2026)
const PROF = arg('prof', '') ? new RegExp(String(arg('prof', ''))) : null;
const BASE = 'http://localhost:8792';
fs.mkdirSync(OUT, { recursive: true });
const FIX = path.join(__dirname, '..', 'tests', 'fixtures', 'qa');
const FUND = JSON.parse(fs.readFileSync(path.join(FIX, 'fund-AAPL.json'), 'utf8'));
const MACRO = JSON.parse(fs.readFileSync(path.join(FIX, 'macro.json'), 'utf8'));
const PX = { AAPL: 228.4, MSFT: 512.1, GOOGL: 186.2, NVDA: 174.9, META: 731.5, AMZN: 228.1, 'BRK-B': 489.3, KO: 69.1, UNH: 352.6, NOW: 178.2, INTU: 701.4, UBER: 92.3, TSLA: 251, GOOG: 187 };

/* נרות סינתטיים: הליכה אקראית דטרמיניסטית לפי סימבול ומרווח, עד "עכשיו" או עד to */
const STEP = { '1m': 60, '2m': 120, '5m': 300, '15m': 900, '30m': 1800, '60m': 3600, '1d': 86400, '1wk': 604800, '1mo': 2629800 };
function candles(sym, iv, to) {
  const st = STEP[iv] || 86400, end = to || Math.floor(Date.now() / 1000), n = 320;
  let seed = [...(sym + iv)].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const out = { ok: true, iv, t: [], o: [], h: [], l: [], c: [], v: [], more: !to };
  let p = (PX[sym] || 100) * (to ? 0.7 : 0.85);
  for (let i = n; i > 0; i--) {
    const t = Math.floor((end - i * st) / st) * st, o = p, c = Math.max(1, o * (1 + (rnd() - 0.48) * 0.03));
    out.t.push(t); out.o.push(+o.toFixed(2)); out.c.push(+c.toFixed(2)); out.h.push(+(Math.max(o, c) * (1 + rnd() * 0.01)).toFixed(2)); out.l.push(+(Math.min(o, c) * (1 - rnd() * 0.01)).toFixed(2)); out.v.push(Math.round(1e6 + rnd() * 4e6));
    p = c;
  }
  return out;
}
function fund(sym) {
  const k = (PX[sym] || 100) / FUND.price;
  return Object.assign({}, FUND, { sym, price: PX[sym] || FUND.price, prev: (PX[sym] || FUND.price) * 0.99, sharesOut: FUND.sharesOut / k });
}

async function routes(ctx) {
  await QM.routes(ctx);
  // כמו בייצור: השרתון שלנו (לא Vercel) — אחרת lite() מכבה את הטעינה המוקדמת. כל /api/ מדומה, שום בקשה לא יוצאת
  await ctx.route(/\/firebase-config\.js/, async (r) => { const res = await r.fetch(); const b = (await res.text()).replace("var PROXY = 'https://ibkr-proxy-wine.vercel.app'", "var PROXY = 'https://api.thesnowball.app'"); r.fulfill({ response: res, body: b }); });
  const J = (r, o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } });
  // נרשם אחרון = גובר; מה שאינו fund/macro/candles — לניתוב של qa-motion (fallback)
  await ctx.route(/\/api\/history/, (r) => {
    let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
    if (b.op === 'fund') return setTimeout(() => J(r, fund(b.sym)), LAT);
    if (b.op === 'macro') return setTimeout(() => J(r, MACRO), LAT);
    if (b.op === 'fundFlags') return J(r, { ok: true, flags: {} });
    if (b.op === 'candles') return setTimeout(() => J(r, candles(b.sym, b.iv, b.to)), LAT);
    return r.fallback();
  });
}

/* מדידה נוספת בדף: גלילה בכל מיכל שנגלל, ושינויי DOM אחרי הפעולה */
const INIT2 = `(() => {
  const D = window.__deep = { muts: [], t0: 0, jumps: [], on: false };
  D.mark = () => { D.t0 = performance.now(); D.muts = []; D.jumps = []; D.on = true; D.pos = new Map(); };
  // צעד של רענון: הדף החדש ממשיך למדוד מהרגע הראשון (אחרת קפיצות של הטעינה עצמה לא נספרות)
  try { const n = sessionStorage.getItem('__qa_mark'); if (n) { sessionStorage.removeItem('__qa_mark'); D.mark(); if (window.__motion) window.__motion.mark(n); } } catch (e) {}
  D.take = () => { D.on = false; return { muts: D.muts.slice(), jumps: D.jumps.slice() }; };
  const vis = (n) => { const e = n && (n.nodeType === 1 ? n : n.parentElement); return !!(e && e.isConnected); };   // בלי getBoundingClientRect — כפה פריסה בכל מוטציה
  const desc = (n) => { const e = n.nodeType === 1 ? n : n.parentElement; return e ? e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\\s+/).slice(0, 2).join('.') : '') : '?'; };
  const moObs = new MutationObserver((ms) => { if (!D.on) return; const t = Math.round(performance.now() - D.t0); for (const m of ms) { const n = m.type === 'attributes' ? m.target : (m.addedNodes[0] || m.removedNodes[0] || m.target);
    if (m.type === 'attributes' && !/^(class|style|hidden)$/.test(m.attributeName)) continue;
    if (!vis(m.target)) continue; D.muts.push([t, m.type[0], desc(m.target), m.type === 'attributes' ? m.attributeName : (m.addedNodes.length + '/' + m.removedNodes.length)]); if (D.muts.length > 400) D.muts.shift(); } })
  ;
  const obs = () => moObs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
  if (document.documentElement) obs(); else document.addEventListener('readystatechange', obs, { once: true });
  // 28/10/2026: מאירועי scroll ולא מסריקה בכל פריים (querySelectorAll + scrollTop בכל פריים כפו פריסה והכבידו על האנימציות)
  const SEL = '.an-root, .lib-root, .kc-watch, .st-root, .st-page, main, [data-scroll]', SC = new Map();
  document.addEventListener('scroll', (ev) => {
    const el = ev.target; if (!el || el.nodeType !== 1 || !el.matches(SEL)) return;
    const y = el.scrollTop, t = performance.now(), p = SC.get(el), M = window.__motion || {};
    SC.set(el, { y, t, d: p ? y - p.y : 0 });
    if (!p || !D.on) return;
    const d = y - p.y, still = t - p.t > 40 || Math.abs(p.d) < 6;
    if (Math.abs(d) > 120 && still && !el.dataset.navScroll && !M.touching && !M.expectScroll) D.jumps.push({ el: desc(el), from: Math.round(p.y), to: Math.round(y), t: Math.round(t - D.t0) });
  }, { capture: true, passive: true });
})();`;

(async () => {
  // --raster (29/10/2026): מעבדה לצביעה מאוחרת (ס2/הפאה הלבנה) — צביעה בתהליך יחיד ומעבד איטי; בטלפון הצביעה של שכבה חדשה מאחרת
  const RASTER = !!arg('raster', false);
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium', args: RASTER ? ['--enable-gpu-rasterization', '--num-raster-threads=1', '--enable-zero-copy=false'] : [] });
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', hasTouch: true, isMobile: true,
    colorScheme: THEME === 'dark' ? 'dark' : 'light', locale: 'he-IL' });
  await routes(ctx);
  await ctx.addInitScript(QM.INIT);
  await ctx.addInitScript(INIT2);
  await ctx.addInitScript(({ db, theme }) => {
    try { if (!localStorage.getItem('__qa_seeded')) { localStorage.setItem('pwa_db_v1', JSON.stringify(db)); localStorage.setItem('pwa_owner_v1', 'local'); localStorage.setItem('pwa_theme_v1', theme); localStorage.setItem('pwa_lang_v1', 'he'); localStorage.setItem('__qa_seeded', '1'); } } catch (e) {}
  }, { db: QM.DB, theme: THEME });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 160)));
  const cdp = await ctx.newCDPSession(page);
  if (CPU > 1 || RASTER) await cdp.send('Emulation.setCPUThrottlingRate', { rate: Math.max(CPU, RASTER ? 6 : 1) });
  const caster = QM.makeCaster(cdp, OUT);
  const sleep = (ms) => page.waitForTimeout(ms);
  const back = () => page.goBack().catch(() => {});
  const results = [];

  /* צעד: פעולה → המתנה → מדידה. tail = הזמן מהפעולה ועד המסגרת האחרונה שהשתנתה (diff>2.5) */
  async function step(name, fn, opt = {}) {
    if (LANDING) return landing(name, fn, opt);
    const settle = opt.settle || 1400;
    if (opt.pre) { try { await page.locator(opt.pre).first().evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' })); await sleep(250); } catch (e) {} }
    await page.evaluate((x) => { window.__motion.expectScroll = !!x; }, !!opt.scroll);
    const bg = await page.evaluate(() => { const c = getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [242, 242, 247]; return c.slice(0, 3).map(Number); });
    await page.evaluate((n) => { window.__motion.mark(n); window.__deep.mark(); }, name);
    await caster.start();
    const prof = PROF && PROF.test(name);
    if (prof) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
      await page.evaluate(() => { window.__lt = []; try { new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask' }); } catch (e) {} window.__lt0 = performance.now(); }); }
    const t0 = Date.now(); let err = ''; const nErr = errors.length;
    try { await fn(); } catch (e) { err = String(e.message).split('\n')[0].slice(0, 140); }
    await page.waitForTimeout(settle);
    const frames = await caster.stop();
    if (prof) {
      const { profile } = await cdp.send('Profiler.stop');
      const lt = await page.evaluate(() => (window.__lt || []).map(([a, d]) => Math.round(a - window.__lt0) + '+' + d));
      const by = new Map(), dt = profile.timeDeltas || [], idx = new Map(profile.nodes.map((n) => [n.id, n]));
      (profile.samples || []).forEach((id, i) => { const n = idx.get(id), cf = n.callFrame, k = (cf.functionName || '(anon)') + ' ' + (cf.url || '').split('/').pop() + ':' + (cf.lineNumber + 1); by.set(k, (by.get(k) || 0) + (dt[i] || 0) / 1000); });
      const top = [...by].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => '    ' + v.toFixed(0).padStart(5) + 'ms  ' + k).join('\n');
      console.log('  ⏱ ' + name + ' · משימות ארוכות (התחלה+משך): ' + (lt.join(' ') || '—') + '\n' + top);
    }
    if (!err && errors.length > nErr) err = 'שגיאת דף: ' + errors.slice(nErr).join(' · ').slice(0, 200);
    const [m] = await page.evaluate(() => window.__motion.take());
    const dp = await page.evaluate(() => window.__deep.take());
    const fr = QM.analyzeFrames(frames, bg, 0);
    // זנב: המסגרת האחרונה עם שינוי מורגש, במילישניות מתחילת הצילום
    let tail = 0; const ft0 = frames.length ? frames[0].t : 0;
    (fr.diffs || []).forEach((d, i) => { if (d > 2.5 && frames[i]) tail = Math.round(frames[i].t - ft0); });
    // "קפיצות" מאוחרות: מסגרת עם שינוי חד אחרי ששתי מסגרות לפניה היו שקטות, אחרי 450ms (מעבר שכבר נגמר)
    const late = [];
    (fr.diffs || []).forEach((d, i) => { if (i > 2 && d > 6 && (fr.diffs[i - 1] < 1 && fr.diffs[i - 2] < 1) && frames[i] && frames[i].t - ft0 > (opt.lateAfter || 450)) late.push(Math.round(frames[i].t - ft0) + 'ms:' + d.toFixed(0)); });
    if (!err && opt.expect) { const ok = await page.locator(opt.expect).first().count().catch(() => 0); if (!ok) err = 'לא במקום הצפוי (' + opt.expect + ')'; }
    if (!err && opt.dialIs) { const k = await dialCur(opt.dialIs[0]); if (k !== opt.dialIs[1]) err = 'החוגה על ' + k + ' במקום ' + opt.dialIs[1]; }
    const row = { name, cls: +(m ? m.cls : 0).toFixed(4), shifts: m ? m.shifts.slice(0, 5) : [], gaps: m ? m.frameGaps : [], jumps: (m ? m.scrollJumps : []).concat(dp.jumps), flash: fr.flash, flicker: fr.flicker, tail, late, err, diffs: (fr.diffs || []).map((d, i) => [frames[i] ? Math.round(frames[i].t - ft0) : 0, +d.toFixed(1)]), muts: dp.muts.filter((x) => x[0] > (opt.lateAfter || 450)).slice(0, 12) };
    row.bad = row.cls > (opt.cls == null ? 0.01 : opt.cls) || row.jumps.length > 0 || row.flash > 0 || row.flicker > 0 || late.length > 0 || !!err;
    const keep = FRAMES || row.bad;
    if (keep) { const d = path.join(OUT, String(results.length).padStart(3, '0') + '-' + name.replace(/[^\w֐-׿-]+/g, '_')); fs.mkdirSync(d, { recursive: true }); frames.forEach((f, i) => { try { fs.renameSync(f.f, path.join(d, 'f' + String(i).padStart(3, '0') + '-' + Math.round(f.t - ft0) + '.jpg')); } catch (e) {} }); }
    else frames.forEach((f) => { try { fs.unlinkSync(f.f); } catch (e) {} });
    if (SNOW) { const miss = await page.evaluate((ex) => { const out = []; document.querySelectorAll('button, [role=button]').forEach((b) => { const r = b.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight) return;
        const cs = getComputedStyle(b); if (cs.visibility === 'hidden' || +cs.opacity === 0) return; const cl = [...b.classList]; if (cl.some((c) => ex.includes(c))) return; if (b.closest('.an-seg, .kc-seg, .mg-seg, .st-seg2, .adm-seg, .fb-seg, .rd-seg') && !b.matches('.on, .active, [aria-pressed="true"]')) return;
        if (/snow-cap/.test(cs.backgroundImage)) return; const ch = b.querySelector('.tab-disc, i'); if (ch && /snow-cap/.test(getComputedStyle(ch).backgroundImage)) return;
        out.push((cl.join('.') || '(בלי מחלקה)') + ' «' + (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 24) + '» ' + (b.parentElement ? b.parentElement.className.toString().split(' ')[0] : '')); }); return out; }, SNOW_EXEMPT);
      miss.forEach((k) => { if (!snowMiss.has(k)) snowMiss.set(k, name); });
      fs.writeFileSync(path.join(OUT, 'snow.txt'), [...snowMiss].map(([k, n]) => k + '  ·  ' + n).join('\n') + '\n');
      await page.screenshot({ path: path.join(OUT, 'snow-' + String(results.length).padStart(3, '0') + '.png') }).catch(() => {}); }
    results.push(row);
    process.stdout.write((row.bad ? '✗ ' : '✓ ') + name + '  cls=' + row.cls + ' jumps=' + row.jumps.length + ' flash=' + row.flash + ' flicker=' + row.flicker + ' tail=' + tail + (late.length ? ' late=' + late.join(',') : '') + (row.err ? '  ERR ' + row.err : '') + '\n');
  }
  const click = (sel) => page.locator(sel).first().click({ timeout: 5000 });
  /* מגע אמיתי (CDP): החלקת עמוד וגרירת החוגה (29/10/2026, הסבב השלישי — החוגה החדשה לא נבדקה בגרירה) */
  const tswipe = async (dx, y = 600, n = 10) => { const x0 = dx > 0 ? 60 : WIDTH - 60;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= n; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / n, y }] }); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  const dialDrag = async (sel, dx, hold) => { const r = await page.locator(sel).first().boundingBox(); if (!r) throw new Error('אין ' + sel);
    const y = r.y + r.height * 0.45, x0 = WIDTH / 2 - dx / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / 14, y }] }); await sleep(16); }
    if (hold) await sleep(hold);   // עצירה לפני השחרור — בלי תנופה
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
  // פריט בחוגה: לחיצה אמיתית כשהוא על המסך; פריט שמחוץ למסך (בחוגה של שבעה, הקצוות בחוץ) — click() של הדף, כמו קפיצה ישירה
  const tapTab = async (sel) => { const vis = await page.evaluate((q) => { const e = document.querySelector(q); if (!e) throw new Error('אין ' + q); const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth; }, sel);
    if (vis) return page.locator(sel).first().click({ timeout: 5000 }); return jsClick(sel); };
  // הפריט הנבחר בחוגה = הקרוב למרכז המסך (ב־Academy/Studio אין מחלקה — רק מיקום)
  const dialCur = (sel) => page.evaluate((q) => { let best = '', d = 1e9; document.querySelectorAll(q + ' .tab').forEach((b) => { const r = b.getBoundingClientRect(), x = Math.abs(r.left + r.width / 2 - innerWidth / 2); if (x < d) { d = x; best = b.dataset.tab; } }); return best; }, sel);
  const jsClick = (sel) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) throw new Error('אין ' + q); e.click(); }, sel);
  const dump = async (root) => page.evaluate((r) => [...document.querySelectorAll(r + ' button, ' + r + ' [role=tab]')].filter((b) => { const x = b.getBoundingClientRect(); return x.width > 0; }).map((b) => b.className + ' | ' + (b.getAttribute('aria-label') || b.textContent.trim()).slice(0, 30)).join('\n'), root);

  await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2500);
  await tapTab('.tab[data-tab="stocks"]'); await sleep(800);

  if (DISCOVER) {
    await page.click('#stockList .stock >> nth=0 >> .stock-head'); await sleep(1500);
    await click('.stock.open .an-open-btn'); await sleep(2500);
    console.log('--- ניתוח ---\n' + await dump('.an-root'));
    await page.screenshot({ path: path.join(OUT, 'an.png') });
    await back(); await sleep(1200);
    await click('.stock.open .kc-open-btn'); await sleep(3500);
    console.log('--- גרף ---\n' + await dump('body'));
    await page.screenshot({ path: path.join(OUT, 'kc.png') });
    await browser.close(); return;
  }


  const openCard = async (n) => { await page.evaluate(() => window.scrollTo(0, 0)); if (!(await page.$('.stock.open'))) { await page.click('#stockList .stock >> nth=' + (n || 0) + ' >> .stock-head'); await sleep(1300); } };
  const anTab = (k) => click('.an-seg-main button[data-k="' + k + '"]');
  const anScroll = (y) => page.evaluate((y) => { const r = document.querySelector('.an-root'); if (r) r.scrollTop = y; }, y);
  const nth = (sel, i) => page.locator(sel).nth(i).click({ timeout: 5000 });


  /* ---------- Invest: טעינה קרה בכל לשונית, תתי־עמודים, מעקב ---------- */
  async function invest(round) {
    const R = ' #' + round;
    for (const t of ['overview', 'stocks', 'trades', 'wishlist', 'deposits', 'pension']) {
      await tapTab('.tab[data-tab="' + t + '"]'); await sleep(900);
      await step('Invest: רענון בלשונית ' + t + R, async () => { await page.evaluate((n) => sessionStorage.setItem('__qa_mark', n), t); await page.reload({ waitUntil: 'load' }); }, { settle: 4500, lateAfter: 1200, expect: '#tab-' + t + '.active' });
    }
    if (ONLY === 'inv0') return;
    if (ONLY === 'inv1') { for (const t of ['stocks', 'overview', 'wishlist', 'trades', 'overview']) await step('Invest: לשונית ' + t + R, () => tapTab('.tab[data-tab="' + t + '"]'), { scroll: true, settle: 1600, lateAfter: 300, expect: '#tab-' + t + '.active' }); return; }
    for (const t of ['overview', 'stocks', 'trades', 'wishlist', 'deposits', 'pension', 'overview']) await step('Invest: לשונית ' + t + R, () => tapTab('.tab[data-tab="' + t + '"]'), { scroll: true, settle: 1600, lateAfter: 900, expect: '#tab-' + t + '.active' });
    await step('Invest: הגדרות' + R, async () => { await jsClick('#menuBtn'); await sleep(350); await jsClick('#langBtn'); }, { scroll: true, settle: 1500, lateAfter: 900 });
    for (const id of ['advancedOpen', 'pfbkOpen', 'feedbackOpen']) {
      if (!(await page.$('#' + id + ':visible'))) continue;
      await step('Invest: תת־עמוד ' + id + R, () => click('#' + id), { pre: '#' + id, scroll: true, settle: 1500, lateAfter: 900 });
      await step('Invest: חזור מ־' + id + R, back, { scroll: true, settle: 1500, lateAfter: 900, expect: '#tab-settings.active' });
    }
    await step('Invest: חזור ← סקירה' + R, back, { scroll: true, settle: 1500, lateAfter: 900 });
    await step('Invest: מטבע ₪' + R, () => click('#curToggleBtn'), { settle: 1500, lateAfter: 900 });
    await step('Invest: מטבע $' + R, () => click('#curToggleBtn'), { settle: 1500, lateAfter: 900 });
    await tapTab('.tab[data-tab="wishlist"]'); await sleep(900);
    const wc = '#tab-wishlist .stock >> nth=0 >> .stock-head';
    if (await page.locator(wc).count()) {
      await step('Invest: מעקב — פתיחת כרטיס' + R, () => page.click(wc), { settle: 1800, lateAfter: 1000 });
      await step('Invest: מעקב — סגירת כרטיס' + R, () => page.click(wc), { settle: 1500, lateAfter: 1000 });
    }
    await tapTab('.tab[data-tab="stocks"]'); await sleep(900);
    for (const i of [0, 3, 6]) {
      await step('Invest: מניות — כרטיס ' + i + R, () => page.click('#stockList .stock >> nth=' + i + ' >> .stock-head'), { pre: '#stockList .stock >> nth=' + i, settle: 2000, lateAfter: 1000 });
      for (const rg of ['1D', '5D', '1M', 'YTD', '1Y']) await step('Invest: כרטיס ' + i + ' טווח ' + rg + R, () => page.locator('.stock.open .range-btn').filter({ hasText: new RegExp('^' + rg) }).first().click({ timeout: 4000 }), { settle: 1500, lateAfter: 900 });
      await step('Invest: מניות — סגירת כרטיס ' + i + R, () => page.click('.stock.open .stock-head'), { settle: 1500, lateAfter: 1000 });
    }
    await investDial(round);
  }
  async function investDial(round) {
    const R = ' #' + round;
    await tapTab('.tab[data-tab="overview"]'); await sleep(1200); await page.evaluate(() => window.scrollTo(0, 0));
    for (const dx of [-300, -300, -300, 300, 300, 300]) await step('Invest: החלקת עמוד ' + (dx < 0 ? '←' : '→') + ' (' + await dialCur('nav.tabs') + ')' + R, () => tswipe(dx, 520), { scroll: true, settle: 1600, lateAfter: 900 });
    await step('Invest: חוגה — הגדרות' + R, () => tapTab('nav.tabs .tab[data-tab="settings"]'), { scroll: true, settle: 1600, lateAfter: 900, expect: '#tab-settings.active' });
    await step('Invest: חוגה — סקירה' + R, () => tapTab('nav.tabs .tab[data-tab="overview"]'), { scroll: true, settle: 1600, lateAfter: 900, expect: '#tab-overview.active' });
    await step('Invest: גרירת החוגה פריט אחד' + R, () => dialDrag('nav.tabs', -60, 120), { scroll: true, settle: 1700, lateAfter: 1000 });
    await step('Invest: גרירת החוגה שלושה פריטים בתנופה' + R, () => dialDrag('nav.tabs', -200), { scroll: true, settle: 1900, lateAfter: 1100 });
    await step('Invest: גרירת החוגה חזרה' + R, () => dialDrag('nav.tabs', 260, 120), { scroll: true, settle: 1900, lateAfter: 1100 });
    await page.evaluate(() => window.scrollTo(0, 500)); await sleep(400);
    await step('Invest: מאמצע הגלילה — החלקה' + R, () => tswipe(-300, 520), { scroll: true, settle: 1600, lateAfter: 900 });
    await step('Invest: חוגה — סקירה (סוף)' + R, () => tapTab('nav.tabs .tab[data-tab="overview"]'), { scroll: true, settle: 1600, lateAfter: 900, expect: '#tab-overview.active' });
  }


  /* ---------- Academy: מדפים, צ'יפים, אסופה, דף ספר, קורא, חיפוש, תפריט, רענונים ---------- */
  async function academy(round) {
    const R = ' #' + round;
    const goAc = async () => { await page.evaluate(() => sessionStorage.setItem('__qa_mark', 'academy')); await page.goto(BASE + '/academy.html', { waitUntil: 'load' }); };
    if (round === 1) {
      await page.goto(BASE + '/academy.html', { waitUntil: 'load' }); await sleep(2000);
      await page.click('.lib-dial .tab[data-tab="mine"]'); await sleep(700);
      await page.evaluate(async (names) => { const dt = new DataTransfer(); for (const n of names) { const bl = await (await fetch('/.qa-books/' + n)).blob(); dt.items.add(new File([bl], n, { type: 'application/epub+zip' })); } const inp = document.querySelector('input[type=file]'); inp.files = dt.files; inp.dispatchEvent(new Event('change')); }, QM.BOOKS.map((x) => x.name));
      await sleep(9000);
    }
    await step('Academy: פתיחה (קר)' + R, goAc, { settle: 3000, lateAfter: 1200, expect: '.lib-dial' });
    await step('Academy: מדף THE SNOWBALL' + R, () => click('.lib-dial .tab[data-tab="snb"]'), { settle: 1200 });
    await step('Academy: הספרייה שלי' + R, () => click('.lib-dial .tab[data-tab="mine"]'), { settle: 1200, expect: '.lib-chip' });
    await step('Academy: צ\'יפ הכל' + R, () => page.locator('.lib-chip').filter({ hasText: /^הכל$/ }).first().click(), { settle: 1200, expect: '.lib-item' });
    for (const i of [2, 3]) await step('Academy: צ\'יפ כותב ' + i + R, () => nth('.lib-chip', i), { settle: 1200 });
    await step('Academy: צ\'יפ מדף' + R, () => click('.lib-chip.shelf'), { settle: 1200, expect: '.col-card' });
    await step('Academy: אסופה' + R, () => nth('.col-card.auto', 0), { settle: 1400, expect: '.col-hero' });
    await step('Academy: חזור ← מדף' + R, back, { settle: 1200, expect: '.col-card' });
    await step('Academy: הכל' + R, () => page.locator('.lib-chip').filter({ hasText: /^הכל$/ }).first().click(), { settle: 1200, expect: '.lib-item' });
    await step('Academy: גלילה' + R, () => page.evaluate(() => { document.querySelector('.lib-root').scrollTop = 600; }), { scroll: true, settle: 800 });
    await step('Academy: דף ספר' + R, () => page.evaluate(() => { const it = [...document.querySelectorAll('.lib-item')].find((x) => { const r = x.getBoundingClientRect(); return r.top > 120 && r.bottom < innerHeight - 80; }); it.click(); }), { settle: 1500, expect: '.bk-cta' });
    await step('Academy: חזור ← הכל (גלילה שמורה)' + R, back, { settle: 1400, expect: '.lib-item' });
    await step('Academy: דף ספר (2)' + R, () => nth('.lib-item', 0), { pre: '.lib-item', settle: 1500, expect: '.bk-cta' });
    await step('Academy: רענון בדף ספר' + R, async () => { await page.evaluate(() => sessionStorage.setItem('__qa_mark', 'bk')); await page.reload({ waitUntil: 'load' }); }, { settle: 3500, lateAfter: 1500, expect: '.bk-cta' });
    await step('Academy: קריאה' + R, () => click('.bk-cta'), { settle: 3000, lateAfter: 1800, expect: '.rd' });
    await step('Academy: רענון בקורא' + R, async () => { await page.evaluate(() => sessionStorage.setItem('__qa_mark', 'rd')); await page.reload({ waitUntil: 'load' }); }, { settle: 4000, lateAfter: 2500, expect: '.rd' });
    await step('Academy: סגירת הקורא' + R, () => page.keyboard.press('Escape'), { settle: 1500 });
    if (await page.$('.rd')) await step('Academy: סגירת הקורא (2)' + R, () => page.keyboard.press('Escape'), { settle: 1500 });
    await step('Academy: חזור ← בית' + R, back, { settle: 1400, expect: '.lib-dial' });
    await page.evaluate(() => { document.querySelector('.lib-root').scrollTop = 220; }); await sleep(300);
    await step('Academy: חיפוש (בית גלול — השדה לא קופץ)' + R, () => page.type('.lib-search input', 'rich', { delay: 60 }), { settle: 1000, cls: 0.5, lateAfter: 900 });   // חיפוש בתוך הטקסט מופיע 280ms אחרי ההקלדה — בכוונה
    await step('Academy: ניקוי חיפוש (גלול)' + R, () => page.fill('.lib-search input', ''), { settle: 1000, cls: 0.5 });
    await page.evaluate(() => { document.querySelector('.lib-root').scrollTop = 0; }); await sleep(300);
    await step('Academy: חיפוש' + R, () => page.fill('.lib-search input', 'rich'), { settle: 1000, cls: 0.5, lateAfter: 900 });
    await step('Academy: ניקוי חיפוש' + R, () => page.fill('.lib-search input', ''), { settle: 1000, cls: 0.5 });
    await step('Academy: תפריט ראשי' + R, () => click('.appbar .icon-btn[aria-label="תפריט ראשי"]'), { settle: 1000 });
    await step('Academy: חזור ← סוגר תפריט' + R, back, { settle: 1000, expect: '.lib-dial' });
    await step('Academy: מסך הגיבוי' + R, () => click('.lib-bkpill'), { settle: 1200 });
    await step('Academy: חזור ← מגיבוי' + R, back, { settle: 1200, expect: '.lib-dial' });
    await step('Academy: רענון בבית' + R, async () => { await page.evaluate(() => sessionStorage.setItem('__qa_mark', 'home')); await page.reload({ waitUntil: 'load' }); }, { settle: 3000, lateAfter: 1200, expect: '.lib-dial' });
    await academyDial(round);
  }
  async function academyDial(round) {
    const R = ' #' + round;
    if (!/academy\.html/.test(page.url())) { await page.goto(BASE + '/academy.html', { waitUntil: 'load' }); await sleep(2500); }
    for (const k of ['settings', 'snb', 'mine', 'notes', 'snb']) await step('Academy: חוגה — ' + k + R, () => click('.lib-dial .tab[data-tab="' + k + '"]'), { settle: 1500, lateAfter: 900, dialIs: ['.lib-dial', k] });
    for (const dx of [-300, -300, -300, 300, 300, 300]) await step('Academy: החלקת עמוד ' + (dx < 0 ? '←' : '→') + ' (' + await dialCur('.lib-dial') + ')' + R, () => tswipe(dx, 560), { settle: 1600, lateAfter: 900 });
    await step('Academy: גרירת החוגה פריט אחד' + R, () => dialDrag('.lib-dial', -70, 120), { settle: 1700, lateAfter: 1000 });
    await step('Academy: גרירת החוגה בתנופה' + R, () => dialDrag('.lib-dial', 220), { settle: 1900, lateAfter: 1100 });
    await step('Academy: חוגה — הספרייה שלי' + R, () => click('.lib-dial .tab[data-tab="mine"]'), { settle: 1500, lateAfter: 900 });
    await page.evaluate(() => { document.querySelector('.lib-root').scrollTop = 500; }); await sleep(400);
    await step('Academy: מאמצע הגלילה — חוגה ← THE SNOWBALL' + R, () => click('.lib-dial .tab[data-tab="snb"]'), { settle: 1600, lateAfter: 900 });
    await step('Academy: חוגה — הספרייה שלי (מראש העמוד)' + R, () => click('.lib-dial .tab[data-tab="mine"]'), { settle: 1500, lateAfter: 900 });
  }

  /* ---------- מנתח החברות ---------- */
  async function toInvest() { if (!/index\.html/.test(page.url())) { await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await sleep(2000); } }
  async function analysis(round) {
    const R = ' #' + round;
    await toInvest();
    await tapTab('.tab[data-tab="stocks"]'); await sleep(700);
    await openCard(0);
    await step('ניתוח: פתיחה (נטען מראש)' + R, () => click('.stock.open .an-open-btn'), { pre: '.stock.open .an-open-btn', expect: '.an-root .an-keys', settle: 1800 });
    for (const m of ['1Y', '3Y', '10Y', 'MAX', '5Y']) await step('ניתוח: טווח ראש ' + m + R, () => page.locator('.an-hrng .range-btn').filter({ hasText: m }).first().click(), { expect: '.an-pxc svg, .an-pxc canvas' });
    await step('ניתוח: עובדה → גיליון' + R, () => nth('.an-fact', 0), { expect: '.an-sheet' });
    await step('ניתוח: חזור ← סוגר גיליון' + R, back, { expect: '.an-root:not(:has(.an-sheet))' });
    await step('ניתוח: אריח תמחור → תת־עמוד' + R, () => nth('.an-key', 0), { expect: '.an-subw' });
    await step('ניתוח: חזור ← תמונה' + R, back, { expect: '.an-keys' });
    await step('ניתוח: אריח צמיחה → תת־עמוד' + R, () => nth('.an-key', 1), { expect: '.an-subw' });
    await step('ניתוח: חזור (כפתור) ← תמונה' + R, () => click('.an-back'), { expect: '.an-keys' });
    await step('ניתוח: גלילה למטה' + R, () => anScroll(900), { scroll: true });
    await step('ניתוח: תחזיות → תת־עמוד' + R, () => click('.an-nrow'), { pre: '.an-nrow', expect: '.an-subw', scroll: true });
    await step('ניתוח: חזור ← תמונה (גלילה שמורה)' + R, back, { expect: '.an-keys', scroll: true });
    await step('ניתוח: לשונית דוחות' + R, () => anTab('rep'), { expect: '.an-rcards' });
    for (const [i, n] of [[1, 'מאזן'], [2, 'תזרים'], [3, 'יחסים'], [0, 'רווח והפסד']]) await step('ניתוח: דוחות → ' + n + R, () => nth('.an-page .an-seg.sm button', i), { expect: '.an-rcards' });
    await step('ניתוח: גלילה בדוחות' + R, () => anScroll(1400), { scroll: true });
    await step('ניתוח: דוחות → מאזן (גלול)' + R, () => nth('.an-page .an-seg.sm button', 1), { expect: '.an-rcards', scroll: true });
    await step('ניתוח: כרטיס דוח → תת־עמוד' + R, () => nth('.an-rcard', 1), { pre: '.an-rcard >> nth=1', expect: '.an-subw .an-chart', scroll: true });
    for (const n of ['5', 'הכל', '10']) await step('ניתוח: תת־עמוד טווח ' + n + R, async () => { const b = page.locator('.an-subw .an-ctl button').filter({ hasText: n }); if (await b.count()) await b.first().click(); }, {});
    await step('ניתוח: חזור ← דוחות (גלילה שמורה)' + R, back, { expect: '.an-rcards' });
    await step('ניתוח: לשונית הערכת שווי' + R, () => anTab('val'), { expect: '.an-page' });
    if (round === 1 && DISCOVER) console.log(await dump('.an-page'));
    const valBtns = await page.locator('.an-page button:visible').count();
    for (let i = 0; i < Math.min(valBtns, 6); i++) {
      const lbl = (await page.locator('.an-page button:visible').nth(i).textContent().catch(() => '')).trim().slice(0, 18);
      await step('ניתוח: שווי — כפתור ' + i + ' (' + lbl + ')' + R, () => page.locator('.an-page button:visible').nth(i).click({ timeout: 4000 }), { settle: 1200 });
      if (await page.$('.an-subw, .an-sheet')) await step('ניתוח: שווי — חזור ' + i + R, back, { expect: '.an-seg-main' });
    }
    await step('ניתוח: לשונית השוואה' + R, () => anTab('cmp'), { expect: '.an-page' });
    await step('ניתוח: גלילה בהשוואה' + R, () => anScroll(700), { scroll: true });
    await step('ניתוח: לשונית תמונה (מהשוואה)' + R, () => anTab('snap'), { expect: '.an-keys' });
    await step('ניתוח: לשונית השוואה (קפיצה)' + R, () => anTab('cmp'), { expect: '.an-page' });
    await step('ניתוח: חזור ← תמונה' + R, back, { expect: '.an-keys' });
    // החלקה בין הלשוניות (מגע)
    const sw = async (dx) => { const y = 600, x0 = dx < 0 ? 330 : 60; await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] }); for (let k = 1; k <= 12; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * k / 12, y }] }); await sleep(16); } await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    await step('ניתוח: החלקה ← דוחות' + R, () => sw(260), { settle: 1800, lateAfter: 1500 });
    await step('ניתוח: החלקה ← הערכת שווי' + R, () => sw(260), { settle: 1800, lateAfter: 1500 });
    await step('ניתוח: החלקה → חזרה' + R, () => sw(-260), { settle: 1800, lateAfter: 1500 });
    await step('ניתוח: סגירה (חזור×)' + R, async () => { for (let k = 0; k < 4 && await page.$('.an-root'); k++) { await back(); await sleep(450); } }, { settle: 1500, expect: '#tab-stocks.active', lateAfter: 2500 });
    // פתיחה קרה — מניה שלא נטענה מראש
    await page.click('.stock.open .stock-head').catch(() => {}); await sleep(900);
    await page.click('#stockList .stock >> nth=4 >> .stock-head'); await sleep(250);
    await step('ניתוח: פתיחה מיד (קר)' + R, () => jsClick('.stock.open .an-open-btn'), { expect: '.an-root', settle: 2500 });
    await step('ניתוח: סגירה (כפתור)' + R, () => click('.an-back'), { settle: 1200, expect: '#tab-stocks.active' });
    await page.click('.stock.open .stock-head').catch(() => {}); await sleep(900);
  }

  /* ---------- גרף הנרות ---------- */
  async function chart(round) {
    const R = ' #' + round;
    await toInvest();
    await tapTab('.tab[data-tab="stocks"]'); await sleep(700);
    await openCard(1);
    await step('גרף: פתיחה' + R, () => click('.stock.open .kc-open-btn'), { pre: '.stock.open .kc-open-btn', expect: '.kc-grid canvas', settle: 2500 });
    await step('גרף: אינטרוול (בורר)' + R, () => nth('.kc-pk', 0), { settle: 1000 });
    if (DISCOVER) console.log('--- בורר ---\n' + await dump('body'));
    const pick = async (txt) => { const b = page.locator('.kc-sheet button, .kc-pick button, .kc-wheel ~ * button').filter({ hasText: new RegExp('^\\s*' + txt + '\\s*$') }); if (await b.count()) await b.first().click({ timeout: 3000 }); else throw new Error('אין ' + txt); };
    await step('גרף: אינטרוול 1H' + R, () => pick('1H|1h|שעה'), { settle: 2000 });
    for (const [i, tf] of [[0, '1W'], [0, '15m'], [0, '1D']]) {
      await page.locator('.kc-pk').nth(i).click().catch(() => {}); await sleep(700);
      await step('גרף: אינטרוול ' + tf + R, () => pick(tf), { settle: 2000 });
    }
    for (const rg of ['3M', '1Y', '5Y', '1M']) {
      await page.locator('.kc-pk').nth(1).click().catch(() => {}); await sleep(700);
      await step('גרף: טווח ' + rg + R, () => pick(rg), { settle: 2000 });
    }
    for (const [i, n] of [[0, 'רשימת מעקב'], [1, 'כלי ציור'], [2, 'אינדיקטורים'], [3, 'עוד'], [4, 'הגדרות']]) {
      await step('גרף: ' + n + R, () => nth('.kc-mb', i), { settle: 1100 });
      if (DISCOVER && round === 1) console.log('--- ' + n + ' ---\n' + await dump('body'));
      await step('גרף: חזור ← סוגר ' + n + R, back, { settle: 1100, expect: '.kc-grid' });
    }
    await step('גרף: חיפוש מניה' + R, () => click('.kc-symbtn'), { settle: 1100 });
    await step('גרף: חזור ← סוגר חיפוש' + R, back, { settle: 1100, expect: '.kc-grid' });
    await step('גרף: סגירה' + R, back, { settle: 1500, expect: '#tab-stocks.active' });
    await page.click('.stock.open .stock-head').catch(() => {}); await sleep(900);
  }

  /* נחיתה: הפריים האחרון של הסיבוב (הגאומטריה כבר סופית, הסגנון עוד של "בזמן הקובייה") מול הדף שנרגע — ממוצע הפרש לכל רצועה של שמינית מסך (0–255). מעבר בלי קובייה — מדלגים */
  async function landing(name, fn, opt = {}) {
    let err = '';
    if (!landing.css) { landing.css = 1; await ctx.addInitScript(() => { const f = () => { const s = document.createElement('style'); s.textContent = '.brand-snow, .brand-snow * { animation: none !important; }'; document.head.appendChild(s); }; if (document.head) f(); else document.addEventListener('DOMContentLoaded', f); }); }
    await page.addStyleTag({ content: '.brand-snow, .brand-snow * { animation: none !important; }' }).catch(() => {});
    try { await fn(); } catch (e) { err = String(e.message).split('\n')[0].slice(0, 140); }
    if (err) { const d = path.join(OUT, 'err'); fs.mkdirSync(d, { recursive: true }); await page.screenshot({ path: path.join(d, String(results.length).padStart(3, '0') + '.png') }).catch(() => {}); }   // 29/10/2026: מה היה על המסך כשהצעד נכשל
    // הקובייה = אנימציית WAAPI עם perspective מחוץ ללוגו (גם לסיבוב של הלוגו יש perspective — זוהה בטעות כקובייה, 29/10/2026).
    // ב־Academy הקובייה מתחילה אחרי ציור אסינכרוני — מחכים לה עד 1.5 שנ׳
    if (!opt.noLand) await page.waitForFunction(() => document.getAnimations().some((x) => !x.animationName && !x.transitionProperty && x.effect && x.effect.target && !x.effect.target.closest('.brand') && x.effect.getKeyframes().some((k) => /perspective/.test(k.transform || ''))), null, { timeout: 1500, polling: 'raf' }).catch(() => {});
    const n = opt.noLand ? 0 : await page.evaluate(() => { const a = document.getAnimations().filter((x) => !x.animationName && !x.transitionProperty && x.effect && x.effect.target && !x.effect.target.closest('.brand') && x.effect.getKeyframes && x.effect.getKeyframes().some((k) => /perspective/.test(k.transform || '')));
      a.forEach((x) => { x.pause(); x.currentTime = x.effect.getTiming().duration - 0.5; });
      // שאר האנימציות (שלג, ניצוצות — el.animate) — מוקפאות בתחילתן בשני הצילומים, כדי שרק הנחיתה תיספר
      // מעבר CSS (transition — למשל הכפתור הנבחר בבורר שזז למקומו) הוא תנועה מכוונת: מסיימים אותו, אחרת הוא נספר כ"קפיצה" (29/10/2026)
      // אנימציה שמונעת מגלילה (hdrScrim — scroll-timeline) לא קשורה לזמן: לא נוגעים בה (finish כפה את הכהות המלאה של ההדר).
      // וכך גם אנימציה סופית מכוונת (הכפתור הנבחר בבורר הניתוח זז יחד עם הקובייה — el.animate): היא מסתיימת. רק אינסופית (שלג, ניצוצות) מוקפאת
      if (a.length) document.getAnimations().forEach((x) => { if (!a.includes(x) && x.timeline === document.timeline) { try { if (x.transitionProperty || (x.effect && x.effect.getTiming().iterations !== Infinity)) x.finish(); else { x.pause(); x.currentTime = 0; } } catch (e) {} } });
      if (a.length) window.__qaLand = (JSON.stringify([...document.querySelectorAll('.lib-root, .st-root, .an-root')].map((r) => { const h = r.querySelector('.appbar'); return [r.className.slice(0, 40), r.scrollTop, r.scrollHeight, h ? getComputedStyle(h, '::before').opacity : '-', r.style.transform.slice(0, 50)]; })) + JSON.stringify([...document.querySelectorAll('.cube-hold')].map((c) => { const q = (r) => { const e = r.querySelector('.an-seg-main, .lib-seg'); return e ? Math.round(e.getBoundingClientRect().top * 10) / 10 : null; }; const live = c.previousElementSibling && document.querySelector('.an-root:not(.cube-ghost):not(.cube-hold), .lib-root:not(.cube-ghost):not(.cube-hold)'); return { st: c.scrollTop, sh: c.scrollHeight, ch: c.clientHeight, seg: q(c), live: live ? q(live) : null, lst: live ? live.scrollTop : null, ltr: live ? live.style.transform.slice(0, 60) : null }; })) + JSON.stringify(document.getAnimations().map((x) => { const t = x.effect && x.effect.target; return [x.animationName || x.transitionProperty || x.id || 'waapi', t ? (t.tagName + '.' + String(t.className).slice(0, 40)) : '', Math.round(x.currentTime), x.playState]; })));
      return a.length; });
    if (n && process.env.QA_LAND_DBG) console.log('LANDDBG', name, await page.evaluate(() => window.__qaLand));
    const d = path.join(OUT, 'landing'); fs.mkdirSync(d, { recursive: true });
    const base = path.join(d, String(results.length).padStart(3, '0') + '-' + name.replace(/[^\w֐-׿-]+/g, '_'));
    let bands = [], worst = 0;
    if (n) {
      await sleep(250); await page.screenshot({ path: base + '-a.png' });
      await page.evaluate(() => document.getAnimations().forEach((x) => { try { x.play(); } catch (e) {} }));
      await sleep(opt.settle || 1400);
      await page.evaluate(() => document.getAnimations().forEach((x) => { if (x.timeline !== document.timeline) return; try { x.pause(); x.currentTime = 0; } catch (e) {} }));
      await sleep(120); await page.screenshot({ path: base + '-b.png' });
      await page.evaluate(() => document.getAnimations().forEach((x) => { try { x.play(); } catch (e) {} }));
      const PYL = 'import sys,json\nfrom PIL import Image,ImageChops\na=Image.open(sys.argv[1]).convert("L");b=Image.open(sys.argv[2]).convert("L");w,h=a.size;a=a.resize((w//8,h//8),Image.BOX);b=b.resize((w//8,h//8),Image.BOX);w,h=a.size;o=[]\nfor i in range(8):\n  box=(0,h*i//8,w,h*(i+1)//8);d=ImageChops.difference(a.crop(box),b.crop(box));o.append(round(sum(k*v for k,v in enumerate(d.histogram()))/(d.size[0]*d.size[1]),2))\nprint(json.dumps(o))';
      try { bands = JSON.parse(require('child_process').execFileSync('python3', ['-c', PYL, base + '-a.png', base + '-b.png']).toString()); } catch (e) { err = err || 'השוואה נכשלה'; }
      worst = Math.max(0, ...bands);
    } else await sleep(opt.settle || 1400);
    if (!err && opt.expect) { const ok = await page.locator(opt.expect).first().count().catch(() => 0); if (!ok) err = 'לא במקום הצפוי (' + opt.expect + ')'; }
    // מוקטן פי 8 (ממוצע) — בלי הבדלי החלקת הקצוות של טקסט בשכבה מסתובבת; פס/שטח שנצבע אחרת נשאר. הפס האטום נמדד 7–19, טשטוש הרקע מאחורי ההדר ~4
    const row = { name, landing: bands, cube: n, err, cls: 0, jumps: [], flash: 0, flicker: 0, late: [], shifts: [], muts: [] };
    row.bad = worst > (opt.landTol || 4.5) || !!err;
    if (!row.bad) { try { fs.unlinkSync(base + '-a.png'); fs.unlinkSync(base + '-b.png'); } catch (e) {} }
    results.push(row);
    process.stdout.write((row.bad ? '✗ ' : '✓ ') + name + (n ? '  נחיתה=' + JSON.stringify(bands) : '  (בלי קובייה)') + (err ? '  ERR ' + err : '') + '\n');
  }

  /* ---------- Studio (studio.html, 29/10/2026 — סרטון המשתמש: קפיצות ורענונים בכל מעבר): חשבון ונתונים מדומים, כל עמוד ראשי,
     עמודי המשנה של המגדל וההגדרות, עבודה פתוחה, וחזרה מאמצע עמוד גלול ---------- */
  async function studio(round) {
    const R = ' #' + round;
    if (round === 1) {
      await ctx.route(/\/auth\.js(\?|$)/, (r) => r.fulfill({ contentType: 'application/javascript', body: `(function(){var cbs=[],u={uid:'qa',email:'qa@example.com',displayName:'QA',getIdToken:async()=>'tok'};
        window.firebase=window.firebase||{apps:[1],auth:function(){return {currentUser:u}}};
        window.SnbAuth={start(){setTimeout(()=>cbs.forEach(f=>f('in')),50)},onChange(f){cbs.push(f);return()=>{}},user(){return u},state(){return 'in'},sub(){return null},signIn(){},signOut(){},hasEmail(){return true}};})();` }));
      const jid = (n) => 'j' + String(n).padStart(20, 'Q');
      const JOBS = [1, 2, 3, 4, 5, 6].map((n) => ({ id: jid(n), created: Date.now() - n * 3600e3, state: 'done', fired: Date.now() - n * 3600e3, done: Date.now() - n * 3500e3,
        spec: { name: 'Demo.Show.S01E0' + n + '.720p.mkv', size: 3e8, from: 'en', to: 'he', mode: 'std' }, files: { a: { id: 'fa' + n, size: 1e6 }, v: { id: 'fv' + n, size: 3e8 } } }));
      await ctx.route(/\/api\/studio/, (r) => { let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
        const now = Date.now(), J = (o) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } }).catch(() => {});
        if (b.op === 'status') return setTimeout(() => J({ ok: true, kinds: [], conn: { hint: 'x', ok: now }, drive: { connected: true, email: 'qa@example.com' }, now }), LAT);
        if (b.op === 'jobs') return setTimeout(() => J({ ok: true, jobs: JOBS, now }), LAT);
        if (b.op === 'job') return setTimeout(() => J({ ok: true, job: JOBS.find((x) => x.id === b.job) || null }), LAT);
        return r.fallback(); });
      await ctx.addInitScript(() => { try { if (location.pathname.endsWith('/studio.html') && !localStorage.getItem('__qa_st')) { localStorage.setItem('pwa_owner_v1', 'qa'); localStorage.setItem('__qa_st', '1'); } } catch (e) {} });
    }
    const stBack = () => page.locator('.st-root:not(.cube-ghost) .st-nav-s button').first().click({ timeout: 5000 });
    const row = (txt) => page.locator('.st-root:not(.cube-ghost) .st-page').locator('button.st-row, button.row-link').filter({ hasText: txt }).first().click({ timeout: 5000 });
    const swipe = async (dx) => { const y = 600, x0 = dx > 0 ? 60 : 330;
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] });
      for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + dx * i / 10, y }] }); await sleep(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); };
    const scrollMid = () => page.evaluate(() => { const r = document.querySelector('.st-root'); r.scrollTop = Math.round((r.scrollHeight - r.clientHeight) / 2); });
    await step('סטודיו: פתיחה' + R, async () => { await page.goto(BASE + '/studio.html', { waitUntil: 'load' }); }, { settle: 3000, expect: '.st-page', lateAfter: 1500, noLand: true });
    await page.locator('.dlg-ok').click({ timeout: 1500 }).catch(() => {}); await sleep(500);
    await step('סטודיו: מגדל' + R, () => click('button[aria-label="מגדל הפיקוח"]'), { settle: 1500, expect: '.st-back' });
    await step('סטודיו: מגדל ← בית' + R, stBack, { settle: 1500, expect: '.st-newcard' });
    await step('סטודיו: עבודה' + R, () => page.locator('.st-proj').first().click({ timeout: 5000 }), { settle: 1500, expect: '.st-back' });
    await step('סטודיו: עבודה ← בית' + R, stBack, { settle: 1500, expect: '.st-newcard' });
    await step('סטודיו: עבודה (2)' + R, () => page.locator('.st-proj').nth(2).click({ timeout: 5000 }), { settle: 1500, expect: '.st-back' });
    await step('סטודיו: עבודה ← בית (2)' + R, stBack, { settle: 1500, expect: '.st-newcard' });
    await step('סטודיו: מגדל (2)' + R, () => click('button[aria-label="מגדל הפיקוח"]'), { settle: 1500 });
    for (const t of ['תקציב לעבודה', 'מילון המונחים', 'עוד חוקים']) {
      await step('סטודיו: מגדל ← ' + t + R, () => row(t), { settle: 1500, expect: '.st-back' });
      await step('סטודיו: חזור ← מגדל (' + t + ')' + R, stBack, { settle: 1400 });
    }
    await step('סטודיו: חוגה ← הגדרות' + R, () => tapTab('.st-dial .tab[data-tab="settings"]'), { settle: 1600, scroll: true, dialIs: ['.st-dial', 'settings'] });   // 29/10/2026: המגדל בקצה החוגה — החלקה משם לא מגיעה להגדרות
    for (const t of ['Claude', 'ברירות מחדל', 'אחסון והעלאה', 'התראות', 'מדריך קצר', 'אפשרויות מתקדמות']) {
      await step('סטודיו: הגדרות ← ' + t + R, () => row(t), { settle: 1500, expect: '.st-back', pre: '.st-page button.st-row, .st-page button.row-link' });
      await step('סטודיו: חזור ← הגדרות (' + t + ')' + R, stBack, { settle: 1400 });
    }
    await scrollMid(); await sleep(400);
    await step('סטודיו: מאמצע ההגדרות ← אפשרויות מתקדמות' + R, () => row('אפשרויות מתקדמות'), { settle: 1500, expect: '.st-back' });
    await step('סטודיו: חזור ← אמצע ההגדרות' + R, stBack, { settle: 1400 });
    await step('סטודיו: הגדרות ← בית' + R, stBack, { settle: 1500, expect: '.st-newcard' });
    for (const k of ['tower', 'job', 'settings', 'home', 'job', 'tower', 'home']) await step('סטודיו: חוגה — ' + k + R, () => tapTab('.st-dial .tab[data-tab="' + k + '"]'), { settle: 1600, lateAfter: 900, dialIs: ['.st-dial', k] });
    for (const dx of [-300, -300, -300, 300, 300, 300]) await step('סטודיו: החלקת עמוד ' + (dx < 0 ? '←' : '→') + ' (' + await dialCur('.st-dial') + ')' + R, () => tswipe(dx, 600), { settle: 1600, lateAfter: 900 });
    await step('סטודיו: גרירת החוגה פריט אחד' + R, () => dialDrag('.st-dial', -70, 120), { settle: 1700, lateAfter: 1000 });
    await step('סטודיו: גרירת החוגה בתנופה' + R, () => dialDrag('.st-dial', 220), { settle: 1900, lateAfter: 1100 });
    await step('סטודיו: חוגה — בית' + R, () => tapTab('.st-dial .tab[data-tab="home"]'), { settle: 1600, lateAfter: 900, expect: '.st-newcard' });
    await step('סטודיו: פרויקט חדש' + R, () => click('.st-newcard'), { settle: 1600, lateAfter: 900 });
    await step('סטודיו: חזור ← בית (מפרויקט חדש)' + R, () => page.keyboard.press('Escape'),   // CloseWatcher (כמו "חזור" באנדרואיד) — goBack היה עוזב את הדף
      { settle: 1600, lateAfter: 900, expect: '.st-newcard' });
    await scrollMid(); await sleep(400);
    await step('סטודיו: מאמצע הבית — עבודה' + R, () => page.locator('.st-proj').nth(4).click({ timeout: 5000 }), { settle: 1600, lateAfter: 900, expect: '.st-back' });
    await step('סטודיו: חזור ← אמצע הבית' + R, stBack, { settle: 1600, lateAfter: 900, expect: '.st-newcard' });
  }

  /* ---------- מרכז הניהול (admin.html): מנהל מדומה, נתונים בהשהיה — כל לשונית ותת־עמוד, בלי "טוען…" שמתחלף אחרי הכניסה ---------- */
  async function admin(round) {
    const R = ' #' + round;
    if (round === 1) {
      await ctx.route(/\/auth\.js(\?|$)/, (r) => r.fulfill({ contentType: 'application/javascript', body: `(function(){var cbs=[],u={uid:'qa',email:'',getIdToken:async()=>'tok'};
        window.SnbAuth={start(){setTimeout(()=>cbs.forEach(f=>f('in')),50)},onChange(f){cbs.push(f);return()=>{}},user(){return u},state(){return 'in'},sub(){return null},signIn(){},signOut(){}};})();` }));
      const ADM = { adminOv: { ov: { items: [], run: [], dates: [] } }, learn: { view: null }, adminBackups: { bk: { warn: [], r2: null, off: null, keep: 30 } },
        adminLog: { log: { items: [], n7: 0, days: 30 } }, adminTasks: { tk: { items: [] }, ck: { open: [] } } };
      await ctx.route(/\/api\/studio/, (r) => { let b = {}; try { b = JSON.parse(r.request().postData() || '{}'); } catch (e) {}
        const J = (rr, o) => rr.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o), headers: { 'access-control-allow-origin': '*' } });
        const o = ADM[b.op] ? Object.assign({ ok: true }, ADM[b.op]) : { ok: false, error: 'x' }; setTimeout(() => J(r, o), LAT); });
    }
    await step('מנהל: פתיחה' + R, async () => { await page.goto(BASE + '/admin.html#ov', { waitUntil: 'load' }); }, { settle: 2500, expect: '.adm-page', lateAfter: 1200 });
    const tab = (n) => page.locator('.adm-tab').filter({ hasText: n }).first().click({ timeout: 5000 });   // 29/10/2026: לפי השם (נוספה "פעילות" — הסדר זז)
    const rowT = (txt) => page.locator('.adm-page button.adm-r').filter({ hasText: txt }).first().click({ timeout: 5000 });
    await step('מנהל: לשונית מערכת' + R, () => tab('מערכת'), { settle: 1400 });
    await step('מנהל: גיבויים' + R, () => rowT('גיבוי'), { settle: 1400, expect: '.adm-back' });
    await step('מנהל: חזור ← מערכת' + R, back, { settle: 1200 });
    await step('מנהל: יומן' + R, () => rowT('יומן'), { settle: 1400, expect: '.adm-back', scroll: true });
    await step('מנהל: חזור ← מערכת (2)' + R, back, { settle: 1200, scroll: true });
    for (const n of ['פעילות', 'אפליקציות', 'שיפור', 'חיפוש', 'סקירה']) await step('מנהל: לשונית ' + n + R, () => tab(n), { settle: 1400, scroll: true });
    const loads = await page.evaluate(() => [...document.querySelectorAll('.adm-page p')].filter((e) => /טוען/.test(e.textContent)).length);
    if (loads) console.log('  (במסך האחרון עוד ' + loads + ' שורות "טוען…" — נתונים שהמוק לא מחזיר)');
  }

  for (let r = 1; r <= ROUNDS; r++) {
    if (ONLY === 'adm') { await admin(r); continue; }
    if (!ONLY || /^inv/.test(ONLY)) await invest(r);
    if (!ONLY || ONLY === 'ac') await academy(r);
    if (!ONLY || ONLY === 'an') await analysis(r);
    if (!ONLY || ONLY === 'kc') await chart(r);
    if (!ONLY || ONLY === 'adm') await admin(r);
    if (!ONLY || ONLY === 'st') await studio(r);
    if (ONLY === 'dial') { await investDial(r); await academyDial(r); }
  }
  const bad = results.filter((r) => r.bad);
  const md = ['# QA עמוק — ' + new Date().toISOString().slice(0, 16) + ' · ' + THEME + ' · cpu×' + CPU + ' · lat ' + LAT + 'ms', '', 'צעדים: ' + results.length + ' · בעייתיים: ' + bad.length, '',
    ...bad.map((r) => '- ✗ **' + r.name + '** cls=' + r.cls + ' jumps=' + JSON.stringify(r.jumps) + ' flash=' + r.flash + ' flicker=' + r.flicker + ' late=' + r.late.join(',') + (r.landing ? ' landing=' + JSON.stringify(r.landing) : '') + (r.err ? ' ERR ' + r.err : '') + (r.shifts.length ? '\n  shifts: ' + JSON.stringify(r.shifts) : '') + (r.muts.length ? '\n  muts: ' + JSON.stringify(r.muts) : ''))];
  fs.writeFileSync(path.join(OUT, 'report.md'), md.join('\n') + '\n');
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(results, null, 1));
  if (SNOW) fs.writeFileSync(path.join(OUT, 'snow.txt'), [...snowMiss].map(([k, n]) => k + '  ·  ' + n).join('\n') + '\n');
  await browser.close();
})().catch((e) => { console.error('QA נכשל:', e); process.exit(1); });
