"""21/10/2026: זיהוי השוטים מתחיל מרגע שהסרטון ירד ברקע, מושהה בתמלול וביישור, והתוצאה נלקחת בצירוף (job.early_shots_*)."""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ['VT_PY'] = sys.executable
import job as J  # noqa: E402

HAS_FF = shutil.which('ffmpeg') is not None


class EarlyShots(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.pd = self.tmp / 'proj'
        self.pd.mkdir()
        J._EARLY.update(p=None, out=None, t0=0.0, hold=0)

    def tearDown(self):
        p = J._EARLY.get('p')
        if p is not None and p.poll() is None:
            J._signal_group(p, J.signal.SIGKILL)
        J._EARLY.update(p=None, out=None, t0=0.0, hold=0)
        shutil.rmtree(self.tmp, ignore_errors=True)

    def ctx(self, **spec):
        return NS(st={'job': 'jEARLY', 'spec': spec}, pdir=self.pd, name='jearly')

    @unittest.skipUnless(HAS_FF, 'ffmpeg')
    def test_detect_hold_take(self):
        src = self.tmp / 'v.mp4'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'color=red:s=320x180:d=2:r=25',
                        '-f', 'lavfi', '-i', 'color=blue:s=320x180:d=2:r=25', '-filter_complex', '[0][1]concat=n=2:v=1[v]',
                        '-map', '[v]', '-c:v', 'libx264', '-preset', 'ultrafast', str(src)], check=True)
        J.early_shots_hold(True)                                      # תמלול רץ — מתחיל מושהה
        self.assertTrue(J.early_shots_start(self.ctx(), src))
        time.sleep(1.0)
        st = Path('/proc/%d/stat' % J._EARLY['p'].pid).read_text().split()[2]
        self.assertEqual(st, 'T', 'מושהה בזמן פקודה כבדה')
        J.early_shots_hold(False)
        self.assertFalse(J.early_shots_start(self.ctx(), src), 'פעם אחת')
        c = self.ctx()
        self.assertTrue(J.early_shots_take(c))
        d = json.loads((self.pd / 'shots.json').read_text())
        self.assertEqual(len(d['shots']), 1)
        self.assertAlmostEqual(d['shots'][0]['t'], 2.0, places=1)
        self.assertFalse(J.early_shots_take(c), 'אחרי הלקיחה — אין יותר')

    def test_edl_or_off_or_missing(self):
        src = self.tmp / 'v.mp4'
        src.write_bytes(b'x')
        self.assertFalse(J.early_shots_start(self.ctx(edl={'k': [[0, 5]]}), src), 'חיתוך לפני התרגום — לא')
        self.assertFalse(J.early_shots_start(self.ctx(), self.tmp / 'none.mp4'), 'בלי קובץ — לא')
        os.environ['SNB_EARLY_SHOTS'] = 'off'
        try:
            self.assertFalse(J.early_shots_start(self.ctx(), src))
        finally:
            del os.environ['SNB_EARLY_SHOTS']

    def test_failed_detection_falls_back(self):
        src = self.tmp / 'bad.mp4'
        src.write_bytes(b'not a video')
        self.assertTrue(J.early_shots_start(self.ctx(), src))
        self.assertFalse(J.early_shots_take(self.ctx()) and (self.pd / 'shots.json').exists() and
                         json.loads((self.pd / 'shots.json').read_text())['shots'], 'קובץ פגום — לא שוטים מומצאים')


if __name__ == '__main__':
    unittest.main()
