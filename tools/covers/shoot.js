const { chromium } = require(process.env.PW || '/opt/node22/lib/node_modules/playwright');
const years = require('fs').readFileSync(process.argv[3], 'utf8').trim().split('\n').map((l) => l.split(' ')[0]);
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 1574, height: 2000 } });
  for (const y of years) {
    const t2 = y === '2025' ? '&t2=' + encodeURIComponent('מכתב חג ההודיה') : '';
    await p.goto('http://localhost:8790/cover.html?y=' + y + t2); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(150);
    await p.locator('.c').screenshot({ path: process.argv[2] + '/cover-' + y + '.png' });
  }
  await b.close();
})();
