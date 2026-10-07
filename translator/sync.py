#!/usr/bin/env python3
"""v360: ההיסט בין הקול שעלה ראשון לבין הקול שבתוך הסרטון — כדי שהתמלול שנעשה מהקול יתאים לציר הזמן של הסרטון.

הטלפון מעתיק את רצועת הקול בלי קידוד (Mediabunny), אבל קובץ חדש יכול להתחיל בהיסט קטן מהסרטון
(חותמת הזמן של החבילה הראשונה, priming של AAC). לכן משווים את שני קובצי ה־WAV (16kHz מונו, של vt ingest)
בקורלציה צולבת (FFT) על הדקות הראשונות.

    python sync.py <קול־ראשון.wav> <קול־מהסרטון.wav>   →  מדפיס: "<היסט בשניות> <ודאות 0..1>"
היסט חיובי = הדיבור מופיע בסרטון מאוחר יותר: זמן_בסרטון = זמן_בקול + היסט.
רק numpy ו־wave (נמצאים בסביבה של vt).
"""
import sys
import wave

import numpy as np

WINDOW_S = 180          # כמה שניות מהתחלה משווים — מספיק גם כשהדקות הראשונות שקטות יחסית
MAX_LAG_S = 10.0        # היסט גדול מזה = לא אותו קובץ / קובץ שנחתך — לא מתקנים לבד


def read_wav(path, max_s):
    with wave.open(str(path), 'rb') as w:
        if w.getsampwidth() != 2:
            raise ValueError('צפוי PCM 16bit')
        sr, ch = w.getframerate(), w.getnchannels()
        raw = w.readframes(int(max_s * sr))
    x = np.frombuffer(raw, dtype='<i2').astype(np.float64)
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x - (x.mean() if len(x) else 0.0), sr


def find_offset(a, b, sr, max_lag_s=MAX_LAG_S):
    """(היסט בשניות, ודאות): b(t + היסט) ≈ a(t). ודאות = מקדם המתאם המנורמל בנקודת השיא (1 = זהים)."""
    if len(a) < sr or len(b) < sr:
        return 0.0, 0.0
    n = 1 << int(np.ceil(np.log2(len(a) + len(b))))
    corr = np.fft.irfft(np.fft.rfft(b, n) * np.conj(np.fft.rfft(a, n)), n)   # corr[k] = Σ a[t]·b[t+k]
    m = int(max_lag_s * sr)
    lags = np.concatenate([np.arange(0, min(m, len(b)) + 1), -np.arange(1, min(m, len(a)) + 1)])
    vals = np.concatenate([corr[:min(m, len(b)) + 1], corr[n - np.arange(1, min(m, len(a)) + 1)]])
    k = int(lags[int(np.argmax(vals))])
    # מקדם מתאם על החפיפה בפועל באותו היסט
    if k >= 0:
        aa, bb = a[:len(b) - k], b[k:k + len(a)]
    else:
        aa, bb = a[-k:-k + len(b)], b[:len(a) + k]
    L = min(len(aa), len(bb))
    aa, bb = aa[:L], bb[:L]
    den = float(np.sqrt(np.dot(aa, aa) * np.dot(bb, bb)))
    conf = float(np.dot(aa, bb) / den) if den > 0 else 0.0
    return k / sr, max(0.0, min(1.0, conf))


def main(argv):
    if len(argv) != 2:
        print('שימוש: sync.py <קול־ראשון.wav> <קול־מהסרטון.wav>', file=sys.stderr)
        return 2
    a, sr = read_wav(argv[0], WINDOW_S)
    b, sr2 = read_wav(argv[1], WINDOW_S + MAX_LAG_S)
    if sr != sr2:
        print('0.000000 0.000')
        return 0
    off, conf = find_offset(a, b, sr)
    print('%.6f %.3f' % (off, conf))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
