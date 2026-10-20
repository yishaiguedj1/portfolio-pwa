# הכוריאוגרפיה של הפנים החיות (20/10/2026): מדפיס את ה־@keyframes של faceAct (פריימים מ־face-<app>.webp)
# ושל artAct (תנועת הראש) על אותו ציר של 20 שניות — תזמון אנושי: מצמוץ נסגר ב־60ms ונפתח ב־240ms,
# קפיצת מבט ב־40ms והראש נמשך אחריה באיחור, הרמת גבות של "שלום", חיוך שנבנה, צחקוק ומצמוץ של צחוק.
# שימוש: python3 tools/brand-face-timeline.py  → להדביק ב־styles.css במקום הבלוק המסומן.
PERIOD = 20000
NAMES = ['base', 'b1', 'b2', 'b3', 'gl1', 'gl2', 'gr1', 'gr2', 's1', 's2', 'br', 's2b']   # הסדר בגיליון (brand-face.py)
def blink(t, base='base', closed='b3'):
    return [(t, 'b1'), (t + 30, 'b2'), (t + 60, closed), (t + 160, 'b2'), (t + 220, 'b1'), (t + 300, base)]
ev = [(0, 'base'), (900, 'gl1'), (940, 'gl2'), (2400, 'gl1'), (2440, 'base')]
ev += blink(3300)
ev += [(4600, 'br'), (5100, 's1'), (5350, 'base')]
ev += [(6100, 's1'), (6350, 's2'), (7200, 's2b'), (7330, 's2'), (8600, 's1'), (8950, 'base')]
ev += blink(9800)
ev += [(11000, 'gr1'), (11040, 'gr2'), (12300, 'gr1'), (12340, 'base')]
ev += blink(13200)
ev += [(14300, 'gl1'), (15400, 'base'), (16200, 's1'), (17500, 'base')]
ev += blink(18200) + blink(18650)
n = len(NAMES)
print('@keyframes faceAct {')
for t, f in sorted(ev):
    i = NAMES.index(f)
    print(f'  {t / PERIOD * 100:.3f}% {{ background-position-x: {i / (n - 1) * 100:.4f}%; }}')
print(f'  100% {{ background-position-x: 0%; }}\n}}')
def T(ty=0, sc=1, ry=0, rx=0, r=0):
    return f'perspective(520px) translateY({ty}px) scale({sc}) rotateY({ry}deg) rotateX({rx}deg) rotate({r}deg)'
head = [(0, T()), (1050, T(0, 1, -4.5, 0, -.6)), (2300, T(0, 1, -4.5, 0, -.6)), (2700, T()),
        (4550, T()), (4750, T(-2.2, 1.02, 0, 5, 0)), (5400, T()),
        (6100, T()), (6500, T(-1, 1.03, 0, 0, -1.5)), (6800, T(0, 1.03, 0, 0, -1.5)), (7000, T(-1.7, 1.035, 0, 0, -1.5)),
        (7200, T(0, 1.035, 0, 0, -1.2)), (7400, T(-1.2, 1.03, 0, 0, -1.2)), (7700, T(-.4, 1.03, 0, 0, -1)), (8950, T()),
        (11150, T(0, 1, 4.5, 0, .6)), (12300, T(0, 1, 4.5, 0, .6)), (12700, T()),
        (14400, T(0, 1, -2.4, 0, -.3)), (15500, T()), (16200, T()), (16600, T(0, 1.015, 0, 0, -.8)), (17500, T(0, 1.015, 0, 0, -.8)), (18000, T()), (20000, T())]
print('@keyframes artAct {')
for t, v in head:
    print(f'  {t / PERIOD * 100:.3f}% {{ transform: {v}; animation-timing-function: cubic-bezier(.4, 0, .25, 1); }}')
print('}')
