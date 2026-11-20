// ווידג'טים של Invest (20/11/2026): מצלם את חומר הזכוכית מאותו CSS של התצוגה המקדימה שאושרה → PNG ב־xxhdpi (3 פיקסלים ל־dp),
// וממיר את מה שנמתח ל־9-patch. שימוש: node tools/widget-glass.js  (כותב ל־android/app/src/invest/res/drawable(-night)-xxhdpi).
// השוליים לצל ({t,s,b}) חייבים להיות זהים ל־object G ב־SnowballWidget.kt. רק ב־Chromium המקומי — בלי רשת.
const { chromium } = require(process.env.PW_PATH || '/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs'), os = require('os'), { execFileSync } = require('child_process');
const RES = path.join(__dirname, '..', 'android/app/src/invest/res');
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), 'wglass-'));
const T = {
  lt: { body: 'linear-gradient(180deg,rgba(255,255,255,.60),rgba(255,255,255,.30))',
        rim: 'inset 0 1.5px 0 -.5px #fff,inset 0 -1px 0 rgba(255,255,255,.45),inset 1px 0 0 rgba(255,255,255,.3),inset -1px 0 0 rgba(255,255,255,.3),inset 0 0 14px rgba(255,255,255,.35),0 0 0 .5px rgba(0,0,0,.07)',
        sh: (o, b, s) => `0 ${o}px ${b}px ${s}px rgba(0,0,0,.22)`,
        fill: 'rgba(255,255,255,.55)', fillrim: 'inset 0 1px 0 rgba(255,255,255,.9),0 0 0 .5px rgba(0,0,0,.05)' },
  dk: { body: 'linear-gradient(180deg,rgba(255,255,255,.17),rgba(255,255,255,.07))',
        rim: 'inset 0 1.5px 0 -.5px rgba(255,255,255,.42),inset 0 -1px 0 rgba(255,255,255,.10),inset 0 0 12px rgba(255,255,255,.07),0 0 0 .5px rgba(255,255,255,.10)',
        sh: (o, b, s) => `0 ${o}px ${b}px ${s}px rgba(0,0,0,.55)`,
        fill: 'rgba(255,255,255,.10)', fillrim: 'inset 0 1px 0 rgba(255,255,255,.18)' },
};
const TAB_ON = { body: 'linear-gradient(180deg,rgba(70,222,110,.94),rgba(40,192,82,.9))',
  rim: 'inset 0 1.5px 0 -.5px rgba(255,255,255,.8),inset 0 -2px 6px rgba(0,80,20,.18),inset 0 0 12px rgba(255,255,255,.25),0 3px 8px -3px rgba(30,170,70,.55)' };
// [שם, רוחב, גובה, רדיוס, שוליים {t,s,b}, סוג]
const A = [
  ['glass_card', 120, 74, 22, { t: 1, s: 3, b: 6 }, 'glass', [3, 8, -4]],
  ['glass_pill', 80, 34, 17, { t: 1, s: 2, b: 3 }, 'glass', [2, 5, -2]],
  ['glass_tab', 80, 44, 22, { t: 1, s: 2, b: 4 }, 'glass', [2, 6, -3]],
  ['glass_tab_on', 80, 44, 22, { t: 1, s: 2, b: 4 }, 'on', null],
  ['glass_fill', 60, 20, 10, { t: 0, s: 0, b: 0 }, 'fill', null],
  ['glass_circle', 36, 36, 18, { t: 1, s: 2, b: 3 }, 'glass', [2, 5, -2]],
  ['glass_arrow', 44, 44, 22, { t: 1, s: 2, b: 4 }, 'glass', [2, 6, -3]],
  ['logo_disc', 40, 40, 20, { t: 1, s: 2, b: 4 }, 'disc', null],
  // גלולת השינוי היומי (‎--gain 16% / ‎--loss 14% / אפור) ונקודות המצב — תמונות, לא cornerRadius (שלא נחתך בכל מכשיר)
  ['day_pos', 60, 20, 8, { t: 0, s: 0, b: 0 }, 'day:pos', null],
  ['day_neg', 60, 20, 8, { t: 0, s: 0, b: 0 }, 'day:neg', null],
  ['day_flat', 60, 20, 8, { t: 0, s: 0, b: 0 }, 'day:flat', null],
  ['dot_pos', 6, 6, 3, { t: 0, s: 0, b: 0 }, 'dot:pos', null],
  ['dot_neg', 6, 6, 3, { t: 0, s: 0, b: 0 }, 'dot:neg', null],
  ['dot_flat', 6, 6, 3, { t: 0, s: 0, b: 0 }, 'dot:flat', null],
];
const NOTCH = { '': { L: 84, p: 2, g: 7, f: 16 } };
const meta = {};
const COL = { lt: { pos: '#16A34A', neg: '#DC2626', flat: '#8E9490' }, dk: { pos: '#34C759', neg: '#FF453A', flat: '#8E9490' } };
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ deviceScaleFactor: 3, viewport: { width: 400, height: 300 } });
  for (const th of ['lt', 'dk']) for (const [n, w, h, r, m, kind, sh] of A) {
    if (kind === 'on' && th === 'dk') continue;
    const t = T[th];
    let bg, bs;
    if (kind === 'glass') { bg = t.body; bs = t.rim + ',' + t.sh(...sh); }
    else if (kind === 'on') { bg = TAB_ON.body; bs = TAB_ON.rim; }
    else if (kind === 'fill') { bg = t.fill; bs = t.fillrim; }
    else if (kind.startsWith('day:')) { const k = kind.slice(4), c = COL[th][k];
      bg = k === 'flat' ? (th === 'lt' ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.07)') : `color-mix(in srgb, ${c} ${k === 'pos' ? 16 : 14}%, transparent)`;
      bs = 'inset 0 1px 0 rgba(255,255,255,' + (th === 'lt' ? '.35' : '.12') + ')'; }
    else if (kind.startsWith('dot:')) { bg = COL[th][kind.slice(4)]; bs = 'none'; }
    else { bg = '#fff'; bs = 'inset 0 1px 0 #fff,0 0 0 .5px rgba(0,0,0,' + (th === 'lt' ? '.08' : '0') + '),0 3px 8px -3px rgba(0,0,0,' + (th === 'lt' ? '.25' : '.6') + ')'; }
    const W = w + 2 * m.s, H = h + m.t + m.b;
    await p.setViewportSize({ width: W, height: H });
    await p.setContent(`<html><body style="margin:0;background:transparent"><div style="position:absolute;left:${m.s}px;top:${m.t}px;width:${w}px;height:${h}px;border-radius:${r}px;background:${bg};box-shadow:${bs}"></div></body></html>`);
    await p.screenshot({ path: `${OUT}/${th}-${n}.png`, omitBackground: true });
  }
  // הכרטיס העליון בתיק — שקע ללוגו (20/11/2026). הגיאומטריה זהה ל־NOTCH ב־SnowballWidget.kt:
  // הכרטיס לא גדל (בקשת המשתמש) — השקע רדוד, ושורת השם מתחילה מתחת לתחתיתו. לוגו L בריפוד עליון p → מרכז ‎cy = p + L/2; ראש הכרטיס הגלוי ב־75dp (כותרת 74 + CARD_T); רדיוס השקע = L/2 + g; f = עיגול הכתפיים
  for (const [k, n] of Object.entries(NOTCH)) for (const th of ['lt', 'dk']) {
    const t = T[th], m = { t: 1, s: 3, b: 6 }, W = 240, R = n.L / 2 + n.g, c = n.p + n.L / 2 - 75, d = Math.round(R + c), h = 74;
    const X0 = W / 2, f = n.f, xf = Math.sqrt((R + f) ** 2 - (f - c) ** 2);
    const fx = X0 - xf, fy = f, dl = Math.hypot(fx - X0, fy - c), P1 = [X0 + (fx - X0) * R / dl, c + (fy - c) * R / dl], P2 = [W - P1[0], P1[1]];
    const notch = `L ${fx},0 A ${f} ${f} 0 0 1 ${P1[0]},${P1[1]} A ${R} ${R} 0 0 0 ${P2[0]},${P2[1]} A ${f} ${f} 0 0 1 ${W - fx},0`;
    const pth = `M 22,0 ${notch} L ${W - 22},0 A 22 22 0 0 1 ${W},22 L ${W},${h - 22} A 22 22 0 0 1 ${W - 22},${h} L 22,${h} A 22 22 0 0 1 0,${h - 22} L 0,22 A 22 22 0 0 1 22,0 Z`;
    const rim = `M ${fx},0 A ${f} ${f} 0 0 1 ${P1[0]},${P1[1]} A ${R} ${R} 0 0 0 ${P2[0]},${P2[1]} A ${f} ${f} 0 0 1 ${W - fx},0`;
    // המסגרת של השקע = המסגרת של הכרטיס, ברצף אחד: הקו הלבן העליון, הזוהר הפנימי והטבעת הדקה מצוירים על כל הקו העליון
    // (פינה → שקע → פינה) ב־SVG, ולא ב־box-shadow (שלא הולך אחרי clip-path). ‎rim(th) = אותם ערכים כמו T.
    const top = `M 0,22 A 22 22 0 0 1 22,0 ${notch} L ${W - 22},0 A 22 22 0 0 1 ${W},22`;
    const ds = th === 'lt' ? 'drop-shadow(0 2px 3px rgba(0,0,0,.16))' : 'drop-shadow(0 2px 3px rgba(0,0,0,.45))';
    const hi = th === 'lt' ? '#fff' : 'rgba(255,255,255,.42)', glow = th === 'lt' ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.07)';
    const ring = th === 'lt' ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.10)';
    const inner = t.rim.split(',').filter(x => x.trim().startsWith('inset') && !x.includes('1.5px') && !x.includes(' 0 0 1')).join(',');
    await p.setViewportSize({ width: W + 2 * m.s, height: h + m.t + m.b });
    await p.setContent(`<html><body style="margin:0;background:transparent"><div style="position:absolute;left:${m.s}px;top:${m.t}px;width:${W}px;height:${h}px;filter:${ds}">
      <svg width="${W}" height="${h}" style="position:absolute;inset:0;overflow:visible"><path d="${pth}" fill="none" stroke="${ring}" stroke-width="1"/></svg>
      <div style="position:absolute;inset:0;clip-path:path('${pth}');background:${t.body};box-shadow:${inner}"></div>
      <svg width="${W}" height="${h}" style="position:absolute;inset:0;overflow:visible"><defs><clipPath id="c"><path d="${pth}"/></clipPath><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${th === 'lt' ? 5 : 4}"/></filter></defs>
        <g clip-path="url(#c)"><path d="${pth}" fill="none" stroke="${glow}" stroke-width="10" filter="url(#g)"/><path d="${top}" fill="none" stroke="${hi}" stroke-width="2"/></g></svg></div></body></html>`);
    await p.screenshot({ path: `${OUT}/${th}-glass_card_notch${k}.png`, omitBackground: true });
    meta[`glass_card_notch${k}`] = { sx: [m.s + 24, m.s + W - 25], sy: m.t + h - 24 };
  }
  await b.close();
  // 9-patch: עמודה אמצעית נמתחת לרוחב, שורה אמצעית לגובה (הגוף משתנה רק לגובה, אז המתיחה לרוחב מדויקת)
  execFileSync('python3', ['-c', `import os, sys
from PIL import Image
src, res = sys.argv[1], sys.argv[2]
import json; meta = json.loads(sys.argv[3])
nine = {'glass_card', 'glass_pill', 'glass_tab', 'glass_tab_on', 'glass_fill', 'day_pos', 'day_neg', 'day_flat'}
for f in sorted(os.listdir(src)):
    th, n = f[:2], f[3:-4]
    d = os.path.join(res, 'drawable-xxhdpi' if th == 'lt' else 'drawable-night-xxhdpi')
    os.makedirs(d, exist_ok=True)
    im = Image.open(os.path.join(src, f)).convert('RGBA')
    if n in nine:
        w, h = im.size
        o = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0)); o.paste(im, (1, 1))
        for x in range(w // 2 - 1, w // 2 + 1): o.putpixel((x + 1, 0), (0, 0, 0, 255))
        o.putpixel((0, h // 2 + 1), (0, 0, 0, 255))
        o.save(os.path.join(d, n + '.9.png'), optimize=True)
    elif n in meta:
        w, h = im.size; mt = meta[n]
        o = Image.new('RGBA', (w + 2, h + 2), (0, 0, 0, 0)); o.paste(im, (1, 1))
        for x in mt['sx']:
            for k in range(3): o.putpixel((x * 3 + k + 1, 0), (0, 0, 0, 255))
        for k in range(3): o.putpixel((0, mt['sy'] * 3 + k + 1), (0, 0, 0, 255))
        o.save(os.path.join(d, n + '.9.png'), optimize=True)
    else:
        im.save(os.path.join(d, n + '.png'), optimize=True)
`, OUT, RES, JSON.stringify(meta)]);
  fs.rmSync(OUT, { recursive: true, force: true });
  console.log('נכתב: drawable-xxhdpi + drawable-night-xxhdpi');
})();
