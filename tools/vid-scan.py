#!/usr/bin/env python3
"""סורק הקלטת מסך מהטלפון ומחפש קפיצות ופריימים ריקים (29/10/2026, סבב קפיצות 4 — docs/smooth-plan.md סעיף 10).

  python3 tools/vid-scan.py <קובץ.mp4> [--fps 60]

  HOLE <זמן> [רצועות] — פריים שבו המרקם ברצועה צונח מתחת ל־45% מהשכנים (פריים שחור/לבן/ריק — שכבה שלא נצבעה)
  POP  <זמן> [רצועות] — שינוי חד באזור כשלפני ואחרי המסך שקט (תוכן מאוחר, "רענון", קפיצה)
אחרי כל ממצא — לחתוך ולראות: ffmpeg -ss <t-0.05> -t 0.2 -i <קובץ> -vf "fps=60,scale=150:-1,tile=12x1" -frames:v 1 out.png
POP שנגרם ממגע (טולטיפ, לחיצה) הוא לא באג — רואים את נקודת המגע בחיתוך. דורש ffmpeg ו־numpy.
"""
import subprocess
import sys

import numpy as np


def frames(path, fps, w, h):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vf', f'fps={fps},scale={w}:{h}',
                          '-f', 'rawvideo', '-pix_fmt', 'gray', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w).astype(np.float32)


def holes(fr, fps, bands=8, top=6):
    bh = (fr.shape[1] - top) // bands
    tex = np.array([[f[top + b * bh:top + (b + 1) * bh].std() for b in range(bands)] for f in fr])
    out = []
    for i in range(len(fr)):
        med = np.median(tex[max(0, i - 20):i + 20], axis=0)
        bad = [b for b in range(bands) if med[b] > 12 and tex[i, b] < 0.45 * med[b]]
        if len(bad) >= 3:
            out.append((i / fps, bad))
    return out


def pops(fr, fps, bands=12, top=4):
    fr = fr[:, top:, :]
    d = np.abs(np.diff(fr, axis=0))
    bh = fr.shape[1] // bands
    band = np.array([[x[b * bh:(b + 1) * bh].mean() for b in range(bands)] for x in d])
    tot = d.mean(axis=(1, 2))
    w = max(3, fps // 5)
    out = []
    for i in range(w, len(d) - w - 1):
        if band[i].max() > 5 and tot[i - w:i].max() < 1.5 and tot[i + 1:i + w + 1].max() < 1.5:
            out.append(((i + 1) / fps, [b for b in range(bands) if band[i, b] > 3]))
    return out


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    path = sys.argv[1]
    fps = int(sys.argv[sys.argv.index('--fps') + 1]) if '--fps' in sys.argv else 60
    for t, b in holes(frames(path, fps, 36, 78), fps):
        print(f'HOLE {t:.3f}s {b}')
    for t, b in pops(frames(path, 30, 72, 157), 30):
        print(f'POP  {t:.2f}s {b}')


if __name__ == '__main__':
    main()
