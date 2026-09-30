#!/usr/bin/env node
/* v277: לוגואי ת"א לווידג׳ט (אנדרואיד) — PNG מוכן 128×128 מה־SVG של TradingView (18×18 בלי viewBox, שב־AndroidSVG יוצא זעיר).
   לכל מזהה ב־TASE_LOGOS (app.js) שאין לו קובץ ב־logos/ta/ — מוריד, מצייר ב־Chromium (Playwright) ושומר; מעדכן את
   ibkr-proxy/lib/ta-logos.json. מניה חדשה ב־TASE_LOGOS → להריץ: node tools/ta-logos.js
   (Playwright מקומי; ב־CI לא רץ). מידע ציבורי בלבד. */
const fs = require('fs');
const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const blk = app.slice(app.indexOf('const TASE_LOGOS'), app.indexOf("').split(' ')", app.indexOf('const TASE_LOGOS')));
const ids = [...new Set((blk.match(/[A-Z0-9\-]+:([a-z0-9\-]+)/g) || []).map((x) => x.split(':')[1]))];
const dir = path.join(root, 'logos', 'ta');
const need = ids.filter((id) => !fs.existsSync(path.join(dir, id + '.png')));
(async () => {
  console.log('ids', ids.length, 'missing', need.length);
  const exe = process.env.CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
  const proxy = process.env.HTTPS_PROXY ? ['--proxy-server=' + process.env.HTTPS_PROXY, '--ignore-certificate-errors'] : [];
  const b = await chromium.launch({ executablePath: exe, args: proxy });
  const p = await b.newPage({ viewport: { width: 128, height: 128 }, deviceScaleFactor: 1 });
  const bad = [];
  for (const id of need) {
    try {
      const r = await fetch('https://s3-symbol-logo.tradingview.com/' + id + '.svg');
      let svg = r.status === 200 ? await r.text() : '';
      if (!/<svg/.test(svg)) { bad.push(id); continue; }
      const m = /<svg[^>]*\bwidth="([\d.]+)"[^>]*\bheight="([\d.]+)"/.exec(svg);
      if (!/viewBox=/.test(svg)) svg = svg.replace('<svg', '<svg viewBox="0 0 ' + (m ? m[1] : 18) + ' ' + (m ? m[2] : 18) + '"');
      svg = svg.replace(/\bwidth="[\d.]+"/, 'width="128"').replace(/\bheight="[\d.]+"/, 'height="128"');
      await p.setContent('<html><body style="margin:0;background:transparent">' + svg + '</body></html>');
      await p.screenshot({ path: path.join(dir, id + '.png'), clip: { x: 0, y: 0, width: 128, height: 128 }, omitBackground: true });
    } catch (e) { bad.push(id + ' (' + e.message + ')'); }
  }
  await b.close();
  const have = fs.readdirSync(dir).filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')).filter((id) => ids.includes(id)).sort();
  fs.writeFileSync(path.join(root, 'ibkr-proxy', 'lib', 'ta-logos.json'), JSON.stringify(have) + '\n');
  console.log('png', have.length, 'failed', bad.length ? bad.join(', ') : 0);
})().catch((e) => { console.error(e); process.exit(1); });
