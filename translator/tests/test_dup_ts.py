"""09/11/2026: קול שהועתק בטלפון (MediaExtractor + MediaMuxer) מ־MKV עם lacing — כל המסגרות של בלוק באותה חותמת.
aresample=async=1 השמיט דגימות והקול יצא שבור (מתאם ~0 למקור): פרק של 22 דק׳ — 69 מילים, תמלול של 16 דק׳.
vt/media.py מזהה חותמות כפולות ובונה זמנים לפי מספר הדגימות. הבדיקה משחזרת את הקובץ בעזרת setts."""
import shutil
import subprocess
import sys
import tempfile
import unittest
import wave
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

from vt import media  # noqa: E402

SR = 16000


def ff(*a):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *a], check=True)


def pcm(p):
    import numpy as np
    with wave.open(str(p)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def corr(a, b):
    """מתאם חציוני בחלונות של שנייה (1.0 = אותו קול)."""
    import numpy as np
    n = min(len(a), len(b))
    c = [np.corrcoef(a[i:i + SR], b[i:i + SR])[0, 1] for i in range(SR, n - SR, SR)]
    return float(np.median(c))


class DupRatio(unittest.TestCase):
    def test_ratio(self):
        self.assertEqual(media.dup_ts([]), 0.0)
        self.assertEqual(media.dup_ts(['0']), 0.0)
        self.assertEqual(media.dup_ts(['0', '1024', '2048', '3072']), 0.0)
        self.assertAlmostEqual(media.dup_ts(['0', '0', '0', '0', '8192']), 0.75)
        self.assertEqual(media.dup_ts(['N/A', 'N/A', '0', '1024']), 0.0, 'בלי חותמת — לא נספר ככפול')


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg')
class LacedAudio(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = Path(tempfile.mkdtemp())
        t = cls.tmp
        sweep = '0.5*sin(2*PI*(200*t+15*t*t))'
        ff('-f', 'lavfi', '-i', f'aevalsrc={sweep}|{sweep}:s=48000:d=40', '-c:a', 'aac', '-b:a', '128k', str(t / 'clean.mka'))
        # כמו MatroskaExtractor: 8 מסגרות (1024 דגימות כל אחת) בכל בלוק — כולן בחותמת של הבלוק
        ff('-i', str(t / 'clean.mka'), '-c', 'copy', '-bsf:a', "setts=ts='trunc(N/8)*8*1024/48000/TB'", str(t / 'laced.mka'))
        # סרטון שהקול שלו מתחיל 0.5 שנ׳ אחרי התמונה, והחותמות שבורות — ההיסט מתחילת הציר נשמר (first_pts=0)
        ff('-f', 'lavfi', '-i', 'color=black:s=64x64:r=10:d=40', '-i', str(t / 'laced.mka'), '-map', '0:v', '-map', '1:a',
           '-c:v', 'libx264', '-c:a', 'copy', '-bsf:a', "setts=ts='TS+24000*1/48000/TB'", str(t / 'late.mkv'))
        media.extract_audio(t / 'clean.mka', t / 'clean.wav')

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_detect(self):
        self.assertFalse(media.broken_ts(self.tmp / 'clean.mka'))
        self.assertTrue(media.broken_ts(self.tmp / 'laced.mka'))
        self.assertFalse(media.broken_ts(self.tmp / 'missing.mka'), 'כשל בבדיקה — המסלול הרגיל')

    def test_old_path_was_broken(self):
        """השחזור: עם המסנן הישן הקול יוצא שבור — כך נראתה העבודה."""
        t = self.tmp
        ff('-i', str(t / 'laced.mka'), '-map', '0:a:0', '-af', 'aresample=async=1:first_pts=0', '-ac', '1', '-ar', str(SR),
           '-c:a', 'pcm_s16le', str(t / 'old.wav'))
        self.assertLess(corr(pcm(t / 'clean.wav'), pcm(t / 'old.wav')), 0.5)

    def test_extract_fixed(self):
        t = self.tmp
        media.extract_audio(t / 'laced.mka', t / 'laced.wav')
        a, b = pcm(t / 'clean.wav'), pcm(t / 'laced.wav')
        self.assertAlmostEqual(len(a) / SR, len(b) / SR, delta=0.05)
        self.assertGreater(corr(a, b), 0.99)

    def test_start_offset_kept(self):
        t = self.tmp
        self.assertTrue(media.broken_ts(t / 'late.mkv'))
        media.extract_audio(t / 'late.mkv', t / 'late.wav')
        a, b = pcm(t / 'clean.wav'), pcm(t / 'late.wav')
        self.assertAlmostEqual((len(b) - len(a)) / SR, 0.5, delta=0.05)
        self.assertGreater(corr(a, b[SR // 2:]), 0.99, 'זמן 0 = תחילת הציר, כמו קודם')


if __name__ == '__main__':
    unittest.main()
