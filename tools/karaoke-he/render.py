"""סרטון קריוקי לבדיקה בעין ובאוזן: התוצאה → karaoke.ass (אותו קוד של העובד: vt/karaoke.py) → צריבה על הקליפ המקורי
(720p, עם השירה המקורית — כדי לשמוע אם הצביעה בזמן). שימוש: render.py <res.json> <lyrics.txt> <src.mkv> <out.mp4> [title]"""
import json, os, subprocess, sys, tempfile
from pathlib import Path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'translator'))
from vt import karaoke as K
from vt import config as C

res, lyr, src, out = sys.argv[1:5]
title = sys.argv[5] if len(sys.argv) > 5 else ''
words = json.load(open(res))['words']
lines = K.parse_lyrics(open(lyr, encoding='utf-8').read())
flat = [(li, w) for li, ln in enumerate(lines) for w in ln]
if len(flat) != len(words):
    raise SystemExit(f'✗ {len(words)} מילים בתוצאה מול {len(flat)} במילים — לא אותו טקסט')
for (li, _), w in zip(flat, words):
    w['li'] = li
tl = K.timed_lines(words)
shown = K.layout(tl)
rtl = K.is_rtl([[w['w'] for w in ln['words']] for ln in tl])
ass = K.write_ass(shown, C.STYLES[C.DEFAULT_STYLE], 1280, 720, title, rtl)
with tempfile.TemporaryDirectory() as d:
    p = Path(d) / 'k.ass'
    p.write_text(ass, encoding='utf-8')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', f'scale=1280:720,ass={p}', '-c:v', 'libx264', '-preset', 'veryfast',
                    '-crf', '30', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', out], check=True)
print('✓', out)
