"""סבב 6 (11/10/2026): גל הקול וחילופי השוטים לעורך הכתוביות בטלפון — מ־audio16k.wav ומ־shots.json של vt. בלי טוקנים.

רץ בסביבת vt (numpy), מ־finish. הפלט = out/timeline.json:
  {"v": 1, "r": 20, "pk": "<base64: בית לכל 1/r שנ׳ — עוצמה בסולם dB, 0–255>", "sh": [שניות של חילופי שוטים],
   "wd": [[התחלה, סוף, "מילה", ביטחון 0–100 או ‎-1], …]}   ← סבב 4 של השדרוג (2/11/2026): זמן לכל מילה ומילים לא בטוחות בעורך
כך הטלפון לא צריך לפענח שעה של קול (זיכרון וסוללה) כדי לצייר את הציר.
**R / PK_MAX / SH_MAX / WD_MAX / WD_LEN זהים ל־normMeta בטלפון (studiosubs.js)**.
"""
import argparse
import base64
import json
import sys
import wave
from pathlib import Path

R = 20                    # נקודות לשנייה
PK_MAX = 4 * 3600 * R     # עד 4 שעות
SH_MAX = 5000
WD_MAX = 60000            # מילים — כ־6 שעות דיבור רצוף
WD_LEN = 40               # תווים למילה
DB_FLOOR = -60.0


def peaks(path):
    """בית לכל 50ms: השיא בבלוק, בסולם dB (‎-60…0 → 0…255)."""
    import numpy as np
    with wave.open(str(path), 'rb') as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        if sw != 2 or sr < R:
            raise SystemExit('✗ קובץ הקול לא בפורמט הצפוי (16 ביט).')
        hop = sr // R
        out = bytearray()
        rest = np.zeros(0, dtype=np.float32)
        while len(out) < PK_MAX:
            buf = w.readframes(hop * R * 60)          # דקה בכל פעם — בלי לטעון את כל הקובץ לזיכרון
            if not buf:
                break
            a = np.frombuffer(buf, dtype='<i2').astype(np.float32)
            if ch > 1:
                a = a[: len(a) // ch * ch].reshape(-1, ch).mean(axis=1)
            a = np.concatenate([rest, a])
            m = len(a) // hop
            blk = np.abs(a[: m * hop]).reshape(m, hop).max(axis=1) / 32768.0 if m else np.zeros(0, dtype=np.float32)
            rest = a[m * hop:]
            db = 20 * np.log10(np.maximum(blk, 1e-6))
            out += np.clip((db - DB_FLOOR) / -DB_FLOOR * 255, 0, 255).astype(np.uint8).tobytes()
        if len(rest) > hop // 2 and len(out) < PK_MAX:
            v = float(np.abs(rest).max()) / 32768.0
            out.append(int(max(0.0, min(255.0, (20 * np.log10(max(v, 1e-6)) - DB_FLOOR) / -DB_FLOOR * 255))))
    return bytes(out[:PK_MAX])


def shots(path):
    try:
        raw = json.loads(Path(path).read_text(encoding='utf-8')).get('shots') or []
    except (OSError, ValueError, AttributeError):
        return []
    out = []
    for s in raw:
        t = s.get('t') if isinstance(s, dict) else s
        if isinstance(t, (int, float)) and t == t and 0 < t < 86400:
            out.append(round(float(t), 3))
    return sorted(set(out))[:SH_MAX]


def words(pd):
    """סבב 4 של השדרוג: המילים של המקור עם הזמנים והביטחון — מהיישור (en.aligned.json), ואם אין — מהתמלול (en.words.json).
    אותו בסיס זמן כמו הכתוביות (shift_words בעובד מזיז את שני הקבצים). ביטחון: conf 0–1 ← 0–100, בלי ציון = ‎-1."""
    for name in ('en.aligned.json', 'en.words.json'):
        try:
            raw = json.loads((Path(pd) / name).read_text(encoding='utf-8')).get('words')
        except (OSError, ValueError, AttributeError):
            continue
        if not isinstance(raw, list):
            continue
        out, last = [], -1.0
        for w in raw:
            if not isinstance(w, dict):
                continue
            t, s, e, c = str(w.get('w') or '').strip()[:WD_LEN], w.get('s'), w.get('e'), w.get('conf')
            if not t or not isinstance(s, (int, float)) or not isinstance(e, (int, float)) or not (0 <= s < 86400) or s != s or e != e:
                continue
            s = round(float(s), 2)
            if s < last:
                continue                              # רק בסדר עולה (הטלפון מחפש בחיפוש בינארי)
            e = round(max(float(e), s + 0.01), 2)
            cc = int(min(100, max(0, float(c) * 100)) + 0.5) if isinstance(c, (int, float)) and c == c else -1
            out.append([s, e, t, cc])
            last = s
            if len(out) >= WD_MAX:
                break
        return out
    return []


def main(argv=None):
    p = argparse.ArgumentParser(description='גל הקול וחילופי השוטים לעורך הכתוביות')
    p.add_argument('--project', required=True)
    p.add_argument('--out', required=True)
    a = p.parse_args(argv)
    pd = Path(a.project)
    wav = pd / 'audio16k.wav'
    if not wav.exists():
        print('· אין audio16k.wav — בלי גל קול')
        return 0
    pk = peaks(wav)
    meta = {'v': 1, 'r': R, 'pk': base64.b64encode(pk).decode('ascii'), 'sh': shots(pd / 'shots.json')}
    wd = words(pd)
    if wd:
        meta['wd'] = wd
    Path(a.out).write_text(json.dumps(meta, separators=(',', ':')), encoding='utf-8')
    print('✓ גל הקול: %d שנ׳, %d חילופי שוטים, %d מילים' % (len(pk) // R, len(meta['sh']), len(wd)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
