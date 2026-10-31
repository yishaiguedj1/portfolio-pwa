#!/usr/bin/env python3
# מחולל תמונות השלג של הכפתורים (31/10/2026, "כפתורי כדור שלג" — לפי ת־עיצוב).
# מייצר SVG (מסנני שלג: קצה לא סדיר, צל כחול מתחת לשפה, קו אור, גרעין, נצנוצים), מצייר ב־Playwright ושומר WebP לשורש:
#   snow-cap-r[-dark].webp  — כיפה לכפתור עגול (נמתחת 100%×100%, נחתכת לפי העיגול)
#   snow-cap-p[-dark].webp  — רצועה ארוכה לקפסולות/מלבנים (גובה = גובה הכפתור, ממורכזת; זליגות בגדלים ומרווחים שונים)
#   snow-tex.webp, snow-spk.webp — אריחי המרקם (בכפל) והנצנוצים של גוף הכפתור
# הרצה: python3 tools/snowbtn-gen.py   (דורש Playwright ו־Pillow; הכיפות לא נערכות ביד)
import os, json, random, subprocess, tempfile
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def cr(pts):
    d = f'M{pts[0][0]:.2f} {pts[0][1]:.2f}'
    for i in range(len(pts) - 1):
        p0 = pts[max(i - 1, 0)]; p1 = pts[i]; p2 = pts[i + 1]; p3 = pts[min(i + 2, len(pts) - 1)]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6); c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f' C{c1[0]:.2f} {c1[1]:.2f} {c2[0]:.2f} {c2[1]:.2f} {p2[0]:.2f} {p2[1]:.2f}'
    return d

FILT = '''<filter id="f" x="-10%" y="-30%" width="120%" height="160%" color-interpolation-filters="sRGB">
<feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="5" result="n"/>
<feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" xChannelSelector="R" yChannelSelector="G" result="d"/>
<feGaussianBlur in="d" stdDeviation=".35" result="S"/>
<feFlood flood-color="#fff" result="W"/><feComposite in="W" in2="S" operator="out" result="O"/>
<feOffset in="O" dy="-2.6" result="O1"/><feGaussianBlur in="O1" stdDeviation="1.5" result="O2"/>
<feComposite in="O2" in2="S" operator="in" result="sh0"/>
<feColorMatrix in="sh0" type="matrix" values="0 0 0 0 .58 0 0 0 0 .67 0 0 0 0 .82 0 0 0 .6 0" result="sh"/>
<feOffset in="O" dy="-.7" result="B1"/><feGaussianBlur in="B1" stdDeviation=".35" result="B2"/>
<feComposite in="B2" in2="S" operator="in" result="b0"/>
<feColorMatrix in="b0" type="matrix" values="0 0 0 0 .86 0 0 0 0 .91 0 0 0 0 .98 0 0 0 .6 0" result="bl"/>
<feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="1" seed="9" result="g"/>
<feDiffuseLighting in="g" surfaceScale="1" diffuseConstant="1" lighting-color="#fff" result="gl"><feDistantLight azimuth="250" elevation="62"/></feDiffuseLighting>
<feComponentTransfer in="gl" result="g2"><feFuncR type="linear" slope=".08" intercept=".95"/><feFuncG type="linear" slope=".08" intercept=".95"/><feFuncB type="linear" slope=".05" intercept=".97"/></feComponentTransfer>
<feBlend in="d" in2="g2" mode="multiply" result="base"/>
<feTurbulence type="turbulence" baseFrequency=".95" numOctaves="1" seed="21" result="sp"/>
<feColorMatrix in="sp" type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 12 0 0 0 -9.8" result="spk"/>
<feMerge result="m"><feMergeNode in="base"/><feMergeNode in="sh"/><feMergeNode in="bl"/><feMergeNode in="spk"/></feMerge>
<feComposite in="m" in2="S" operator="in"/>
</filter>'''

def grad(y1, y2):
    return (f'<linearGradient id="w" gradientUnits="userSpaceOnUse" x1="0" y1="{y1}" x2="0" y2="{y2}"><stop offset="0" stop-color="#FFFFFF"/>'
            '<stop offset=".35" stop-color="#F7FAFE"/><stop offset="1" stop-color="#EAF1FB"/></linearGradient>')

def drop(dark, d1, b1, d2, b2):
    c1, c2 = ('rgba(0,0,0,.45)', 'rgba(0,0,0,.2)') if dark else ('rgba(60,90,140,.30)', 'rgba(60,90,140,.14)')
    bright = '<feComponentTransfer in="SourceGraphic" result="src"><feFuncR type="linear" slope=".92"/><feFuncG type="linear" slope=".93"/><feFuncB type="linear" slope=".95"/></feComponentTransfer>' if dark else '<feOffset in="SourceGraphic" result="src"/>'
    return (f'<filter id="ds" x="-5%" y="-5%" width="110%" height="140%" color-interpolation-filters="sRGB">{bright}'
            f'<feDropShadow in="src" dx="{d1 * .3:.2f}" dy="{d1}" stdDeviation="{b1}" flood-color="{c1}" result="a"/>'
            f'<feDropShadow in="a" dx="{d2 * .15:.2f}" dy="{d2}" stdDeviation="{b2}" flood-color="{c2}"/></filter>')

# כיפה לעיגול — שפה סימטרית עם זליגות בגדלים שונים (הצורה שאושרה בתצוגה המקדימה)
ROUND_PTS = [(-2,52),(4,38),(8,32),(10.5,30),(11,29.42),(13.0,29.96),(14.8,30.44),(16,29.95),(17.2,29.04),(19.0,26.58),(21,23.77),(24.0,22.9),(27,22.59),(28.2,23.11),(29.2,23.44),(30,23.4),(30.8,23.34),(31.8,22.88),(33,22.2),(35.2,22.11),(37.5,22.49),(40.1,24.24),(42.4,25.48),(44.0,25.68),(45.6,25.54),(47.9,24.4),(50.5,22.73),(53.0,22.34),(55.4,22.4),(56.4,22.93),(57.4,23.3),(58.0,23.34),(58.6,23.27),(59.6,22.87),(60.6,22.3),(62.8,22.14),(65,22.36),(66.6,23.63),(68.0,24.51),(69,24.62),(70.0,24.47),(71.4,23.77),(73,22.71),(74.8,22.71),(76.5,23.55),(78.7,26.79),(80.6,29.36),(82.0,30.43),(83.4,30.91),(85.3,29.96),(87.5,28.3),(89.5,30),(92,32),(96,38),(102,52)]

def round_svg(dark):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%">' + FILT + grad(0, 30) + drop(dark, 2.4, .9, 5, 2.6) +
            f'<g filter="url(#ds)"><g filter="url(#f)"><path d="{cr(ROUND_PTS)} L102 -10 L-2 -10 Z" fill="url(#w)"/></g></g></svg>')

# רצועה לקפסולות: גובה 100 = גובה הכפתור. בסיס ~17% (שכבה דקה), זליגות 2–12 יחידות עומק, ברוחב ובמרווח משתנים — כמו שלג שנשפך
STRIP_W = 1400
def strip_pts(seed=11):
    rnd = random.Random(seed)
    drips, x = [], 8.0
    while x < STRIP_W:
        size = rnd.random() ** 1.6                       # רוב הזליגות קטנות, מעטות גדולות
        drips.append((x, 2 + size * 10.5, 5 + size * 9 + rnd.random() * 3))
        x += 16 + rnd.random() * 30
    def y(px):
        v = 17 + 0.9 * __import__('math').sin(px / 37.0) + 0.5 * __import__('math').sin(px / 13.0 + 1.3)
        for c, d, w in drips:
            t = abs(px - c) / w
            if t < 1: v += d * (1 - t * t) ** 2          # זליגה רכה: מעוגלת בקצה, בלי שיניים
        return v
    return [(px, round(y(px), 2)) for px in [i * 2.5 for i in range(-4, int(STRIP_W / 2.5) + 5)]]

def strip_svg(dark):
    pts = strip_pts()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {STRIP_W} 100" width="100%" height="100%">' + FILT.replace('x="-10%"', 'x="-1%"').replace('width="120%"', 'width="102%"') + grad(0, 34) + drop(dark, 3.2, 1.2, 6.5, 3.4) +
            f'<g filter="url(#ds)"><g filter="url(#f)"><path d="{cr(pts)} L{STRIP_W + 10} -10 L-10 -10 Z" fill="url(#w)"/></g></g></svg>')

TEX = ('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 160 160"><filter id="t" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">'
       '<feTurbulence type="fractalNoise" baseFrequency=".07" numOctaves="3" seed="7" stitchTiles="stitch" result="n"/>'
       '<feDiffuseLighting in="n" surfaceScale="3.2" diffuseConstant="1" lighting-color="#fff" result="v"><feDistantLight azimuth="235" elevation="48"/></feDiffuseLighting>'
       '<feTurbulence type="fractalNoise" baseFrequency=".7" numOctaves="1" seed="3" stitchTiles="stitch" result="g"/>'
       '<feDiffuseLighting in="g" surfaceScale="1" diffuseConstant="1" lighting-color="#fff" result="gv"><feDistantLight azimuth="235" elevation="60"/></feDiffuseLighting>'
       '<feBlend in="v" in2="gv" mode="multiply"/>'
       '<feComponentTransfer><feFuncR type="linear" slope=".17" intercept=".83"/><feFuncG type="linear" slope=".15" intercept=".85"/><feFuncB type="linear" slope=".09" intercept=".91"/></feComponentTransfer>'
       '</filter><rect width="160" height="160" filter="url(#t)"/></svg>')
SPK = ('<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 120 120"><filter id="s" x="0" y="0" width="100%" height="100%"><feTurbulence type="turbulence" baseFrequency=".6" numOctaves="1" seed="31" stitchTiles="stitch"/>'
       '<feColorMatrix values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 14 0 0 0 -11.75"/></filter><rect width="120" height="120" filter="url(#s)"/></svg>')

# שם, SVG, רוחב, גובה (פיקסלים בציור), איכות WebP
JOBS = [('snow-cap-r', round_svg(False), 240, 240, 82), ('snow-cap-r-dark', round_svg(True), 240, 240, 82),
        ('snow-cap-p', strip_svg(False), STRIP_W * 1.4, 140, 80), ('snow-cap-p-dark', strip_svg(True), STRIP_W * 1.4, 140, 80),
        ('snow-tex', TEX, 160, 160, 78), ('snow-spk', SPK, 120, 120, 85)]

RENDER = r'''
const { chromium } = require(process.env.PW_PATH || 'playwright');
const jobs = JSON.parse(require('fs').readFileSync(process.argv[2], 'utf8'));
(async () => { const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 1 });
  for (const j of jobs) { await p.setViewportSize({ width: Math.ceil(j.w), height: Math.ceil(j.h) });
    await p.setContent('<html><body style="margin:0;background:transparent"><div id="x" style="width:' + j.w + 'px;height:' + j.h + 'px">' + j.svg + '</div></body></html>');
    await p.locator('#x').screenshot({ path: j.png, omitBackground: true }); }
  await b.close(); })();'''

def main():
    tmp = tempfile.mkdtemp()
    jobs = [{'svg': s, 'w': w, 'h': h, 'png': os.path.join(tmp, n + '.png')} for n, s, w, h, q in JOBS]
    jf = os.path.join(tmp, 'jobs.json'); json.dump(jobs, open(jf, 'w'))
    js = os.path.join(tmp, 'render.js'); open(js, 'w').write(RENDER)
    env = dict(os.environ); env.setdefault('NODE_PATH', '/opt/node22/lib/node_modules')
    subprocess.run(['node', js, jf], check=True, env=env)
    for (n, s, w, h, q), j in zip(JOBS, jobs):
        out = os.path.join(ROOT, n + '.webp')
        Image.open(j['png']).save(out, 'WEBP', quality=q, method=6)
        print(n, os.path.getsize(out))

if __name__ == '__main__':
    main()
