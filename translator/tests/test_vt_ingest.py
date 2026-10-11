"""10/10/2026 (קיצור היישור): vt ingest לא מקודד יותר audio_api.ogg — רק כשמנוע תמלול בענן באמת צריך אותו.
Parakeet (המקומי) קורא את audio16k.wav; הקידוד היה ~7 שנ׳ לכל 5 דק׳, פעמיים בעבודה."""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg')
class IngestNoApiAudio(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.env = dict(os.environ, VT_WORK=str(self.tmp / 'work'))
        self.src = self.tmp / 'in.m4a'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
                        '-c:a', 'aac', str(self.src)], check=True)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def vt(self, *a):
        r = subprocess.run([sys.executable, '-m', 'vt', *a], cwd=str(HERE), env=self.env, capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        return r

    def test_ingest_skips_ogg_and_cloud_asr_creates_it(self):
        self.vt('new', 'p1', '--source', str(self.src), '--force')
        pd = self.tmp / 'work' / 'p1'
        (pd / 'audio_api.ogg').write_bytes(b'old')               # ממקור קודם (לפני צירוף הסרטון)
        self.vt('ingest', 'p1')
        self.assertTrue((pd / 'audio16k.wav').exists())
        self.assertFalse((pd / 'audio_api.ogg').exists(), 'מקור חדש — ה־ogg הישן לא נשאר (לא שייך לו)')
        sys.path.insert(0, str(HERE))
        old = os.environ.get('VT_WORK')
        try:
            from vt import cli
            from vt.project import Project
            os.environ['VT_WORK'] = self.env['VT_WORK']
            out = cli._api_audio(Project('p1'))
        finally:
            sys.path.remove(str(HERE))
            if old is None:
                os.environ.pop('VT_WORK', None)
            else:
                os.environ['VT_WORK'] = old
        self.assertEqual(out.name, 'audio_api.ogg')
        self.assertGreater(out.stat().st_size, 100, 'נוצר כשמנוע בענן מבקש')


if __name__ == '__main__':
    unittest.main()
