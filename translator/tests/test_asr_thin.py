"""05/11/2026: תמלול כמעט ריק מהקול שעלה מהטלפון (67 מילים בפרק של 23 דק׳, ו־2,500 מאותו פרק מהסרטון).
העובד מזהה את זה מיד אחרי התמלול (asr_thin) ומתמלל מחדש מהסרטון, במקום להמשיך עם תמליל ריק שהיישור נופל עליו."""
import json
import sys
import tempfile
import unittest
import wave
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402


def project(d: Path, minutes: float, n_words: int, sp=0.6, wav_ok=True):
    (d / 'asr').mkdir(parents=True, exist_ok=True)
    words = [{'w': 'w', 's': i * 1.0, 'e': i * 1.0 + 0.3} for i in range(n_words)]
    au = {} if sp is None else {'sp': sp}
    (d / 'asr' / 'parakeet.json').write_text(json.dumps({'words': words, 'audio': au}), encoding='utf-8')
    if not wav_ok:
        (d / 'audio16k.wav').write_text('not a wav')
        return
    with wave.open(str(d / 'audio16k.wav'), 'wb') as w:        # כותרת אמיתית; הדגימות ריקות — רק getnframes נקרא
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(16000)
        w.writeframes(b'\0\0' * int(minutes * 60 * 16000))


class AsrThin(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.d = Path(self.tmp.name)

    def tearDown(self):
        self.tmp.cleanup()

    def test_the_broken_episode(self):
        project(self.d, 22.8, 67)
        n, m = job.asr_thin(self.d)
        self.assertEqual(n, 67)
        self.assertAlmostEqual(m, 22.8, places=1)

    def test_normal_episode(self):
        project(self.d, 22.8, 2500)
        self.assertIsNone(job.asr_thin(self.d))

    def test_short_clip(self):
        project(self.d, 1.0, 3)                 # בדיקת העובד (דקה) — מעט מילים זה טבעי
        self.assertIsNone(job.asr_thin(self.d))

    def test_little_speech(self):
        project(self.d, 20.0, 40, sp=0.05)      # סרטון כמעט בלי דיבור (מוזיקה, טבע) — לא קול פגום
        self.assertIsNone(job.asr_thin(self.d))

    def test_no_audio_stats(self):
        project(self.d, 20.0, 40, sp=None)      # בלי sp — רק לפי מילים לדקה
        self.assertEqual(job.asr_thin(self.d)[0], 40)

    def test_unreadable(self):
        project(self.d, 20.0, 40, wav_ok=False)
        self.assertIsNone(job.asr_thin(self.d))
        self.assertIsNone(job.asr_thin(self.d / 'missing'))


class PrepareFallsBackToVideo(unittest.TestCase):
    """prepare: קול מהטלפון → תמליל ריק → מחכים לסרטון ומתמללים ממנו; src = 'v' (בלי צירוף סרטון ב־align)."""

    def run_prepare(self, thin):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        pd = Path(tmp.name)
        calls, saved = [], {}
        st = {'files': {'a': {'id': 'A1', 'size': 10, 'name': 'x.m4a'}}, 'spec': {'name': 'ep.mkv'}}
        ctx = SimpleNamespace(st=st, name='ep', pdir=pd, report=lambda *a, **k: None, event=lambda *a, **k: None)
        stubs = {
            'load_state': lambda: st, 'Ctx': lambda s: ctx, 'pw_mode': lambda s: False, 'url_fetch': lambda c: None,
            'in_path': lambda c, f, k: pd / ('in.' + k), 'fetch_input': lambda *a, **k: calls.append('fetch-a'),
            'edl_src': lambda c, s, k: s, 'ensure_env': lambda c: None,
            'prepare_video_src': lambda c: calls.append('video') or pd / 'in.v',
            'vt': lambda c, a, *r: calls.append(a[0] + (':' + a[a.index('--source') + 1].rsplit('.', 1)[1] if '--source' in a else '')),
            'asr_thin': lambda p: (67, 22.8) if thin and 'video' not in calls else None,
            'lang_safe': lambda c: calls.append('lang'), 'inject_guard': lambda c: None,
            'save_state': lambda s: saved.update(src=s.get('src')), 'save_ck': lambda c, s: None,
        }
        old = {k: getattr(job, k) for k in stubs}
        for k, v in stubs.items():
            setattr(job, k, v)
        try:
            job.prepare(SimpleNamespace())
        finally:
            for k, v in old.items():
                setattr(job, k, v)
        return calls, saved['src']

    def test_thin_audio_redone_from_video(self):
        calls, src = self.run_prepare(thin=True)
        self.assertEqual(calls, ['fetch-a', 'new:a', 'ingest', 'asr', 'video', 'new:v', 'ingest', 'asr', 'shots', 'lang', 'edit-export'])
        self.assertEqual(src, 'v')

    def test_good_audio_unchanged(self):
        calls, src = self.run_prepare(thin=False)
        self.assertEqual(calls, ['fetch-a', 'new:a', 'ingest', 'asr', 'lang', 'edit-export'])
        self.assertEqual(src, 'a')


if __name__ == '__main__':
    unittest.main()
