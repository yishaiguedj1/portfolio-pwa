const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1574, height: 2000 } });
  for (const y of ['1965', '1987', '2024']) {
    await p.goto('http://localhost:8790/cover.html?y=' + y); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    await p.locator('.c').screenshot({ path: process.argv[2] + '/cover-' + y + '.png' });
  }
  await b.close();
})();
