"""24/10/2026: תרגום בטלפון (שלב 1) — הסרטון לא עוזב את הטלפון. במקום לצרף סרטון, העובד מקבל קובץ מדידות (ffprobe
של הסרטון + השוטים): media.json של הסרטון, shots.json, והזזת הזמנים לציר של הסרטון. בלי ladder ובלי עותק וידאו."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402


def probe(a_start='0.000000', v_start='0.000000'):
    return {'format': {'duration': '600.5', 'start_time': '0.000000'}, 'streams': [
        {'index': 0, 'codec_type': 'video', 'codec_name': 'h264', 'width': 1920, 'height': 1080, 'avg_frame_rate': '30000/1001',
         'r_frame_rate': '30000/1001', 'start_time': v_start},
        {'index': 1, 'codec_type': 'audio', 'codec_name': 'aac', 'sample_rate': '48000', 'channels': 2, 'start_time': a_start}]}


def meta(**k):
    d = {'v': 1, 'probe': probe(), 'shots': {'threshold': 10.0, 'shots': [{'t': 4.5, 'score': 31.2}, {'t': 90.04, 'score': 12}]}}
    d.update(k)
    return d


class MetaCheck(unittest.TestCase):
    def test_good(self):
        pr, sh = job.ph_meta_check(meta())
        self.assertEqual(len(sh['shots']), 2)
        self.assertEqual(sh['threshold'], 10.0)

    def test_bad(self):
        bad = [None, [], {'v': 2}, meta(probe={'format': {}, 'streams': []}),
               meta(probe=dict(probe(), streams=[{'codec_type': 'audio'}])),                         # בלי וידאו
               meta(probe=dict(probe(), streams=[probe()['streams'][0]])),                          # בלי קול
               meta(probe=dict(probe(), format={'duration': 'x'})),
               meta(probe=dict(probe(), format={'duration': '0'})),
               meta(shots={'threshold': 10, 'shots': [{'t': 9999, 'score': 1}]}),                  # אחרי הסוף
               meta(shots={'threshold': 10, 'shots': [{'t': 'x', 'score': 1}]}),
               meta(shots={'threshold': 0, 'shots': []}),
               meta(shots={'threshold': 10, 'shots': [{'t': 1, 'score': 1}] * (job.PH_SHOTS_MAX + 1)})]
        w = probe()
        w['streams'][0]['width'] = True
        bad.append(meta(probe=w))
        for i, d in enumerate(bad):
            self.assertIsNone(job.ph_meta_check(d), 'נדחה: %d' % i)


class PhoneAttach(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.pd = root / 'proj'
        self.pd.mkdir()
        (self.pd / 'asr').mkdir()
        (self.pd / 'asr' / 'parakeet.json').write_text(json.dumps({'words': [{'w': 'hi', 's': 1.0, 'e': 1.2}]}))
        (self.pd / 'en.aligned.json').write_text(json.dumps({'words': [{'w': 'hi', 's': 1.01, 'e': 1.21}]}))
        # media.json של הפרויקט שתומלל מהקול שעלה — בלי וידאו
        (self.pd / 'media.json').write_text(json.dumps({'path': '/w/source.m4a', 'duration': 600.5, 'size': 777, 'audio': {'t0': 0.0}, 'video': None}))
        self.meta = meta()
        self.saved, self.calls, self.reports = [], [], []
        self.o = (job.vt, job.fetch_input, job.save_state, job.VT_WORK, job.time.sleep)
        job.VT_WORK = root / 'work'
        job.vt = lambda ctx, args, *a, **k: self.calls.append(args[0]) or []
        job.fetch_input = lambda ctx, fid, dest, size, *a: Path(dest).write_text(json.dumps(self.meta))
        job.save_state = lambda st: self.saved.append(dict(st))
        job.time.sleep = lambda s: None
        files = {'a': {'id': 'a1'}, 'm': {'id': 'R2_x_m', 'size': 10}}
        self.ctx = SimpleNamespace(name='jx', pdir=self.pd, st={'src': 'a', 'spec': {'ph': 1, 'eng': 'api'}, 'files': files, 'kind': 'tr'},
                                   report=lambda *a, **k: self.reports.append((a, k)), refresh=lambda: None)

    def tearDown(self):
        job.vt, job.fetch_input, job.save_state, job.VT_WORK, job.time.sleep = self.o
        self.tmp.cleanup()

    def test_attach_late_goes_to_phone(self):
        job.attach_late(self.ctx)
        m = json.loads((self.pd / 'media.json').read_text())
        self.assertEqual((m['video']['width'], m['video']['height'], m['video']['fps']), (1920, 1080, '30000/1001'), 'media.json של הסרטון')
        self.assertEqual(m['path'], '/w/source.m4a', 'המקור בפרויקט נשאר הקול')
        sh = json.loads((self.pd / 'shots.json').read_text())
        self.assertEqual([x['t'] for x in sh['shots']], [4.5, 90.04])
        self.assertEqual(self.ctx.st['src'], 'ph')
        self.assertNotIn('ingest', self.calls, 'בלי סרטון — בלי ingest')
        self.assertNotIn('retime', self.calls, 'בלי היסט — בלי retime')

    def test_audio_offset_shifts_times(self):
        self.meta = meta(probe=probe(a_start='0.021000'))
        job.attach_late(self.ctx)
        w = json.loads((self.pd / 'en.aligned.json').read_text())['words'][0]
        self.assertAlmostEqual(w['s'], 1.031, places=3)
        self.assertIn('retime', self.calls)
        self.assertAlmostEqual(self.ctx.st['sync']['off'], 0.021, places=4)

    def test_bad_meta_fails_with_code(self):
        self.meta = {'v': 1}
        with self.assertRaises(job.StepError) as e:
            job.attach_late(self.ctx)
        self.assertEqual(e.exception.err, 'ph_meta')

    def test_waits_then_parks(self):
        self.ctx.st['files'] = {'a': {'id': 'a1'}}
        import os
        os.environ['SNB_PARK_AFTER'] = '1e-9'
        try:
            with self.assertRaises(job.Park):
                job.attach_late(self.ctx)
        finally:
            del os.environ['SNB_PARK_AFTER']

    def test_reapply_after_restore(self):
        job.ph_reapply(self.ctx)
        self.assertEqual(json.loads((self.pd / 'media.json').read_text())['video']['width'], 1920)
        self.assertEqual(json.loads((self.pd / 'en.aligned.json').read_text())['words'][0]['s'], 1.01, 'המשך — לא מזיזים שוב')

    def test_no_video_prefetch(self):
        self.assertIsNone(job.video_prefetch(self.ctx, None))


class Wiring(unittest.TestCase):
    def test_source_rules(self):
        src = Path(job.__file__).read_text(encoding='utf-8')
        self.assertIn("kind = 'a' if info.get('src') in ('a', 'ph')", src, 'המשך: מורידים שוב את הקול, לא מחכים לסרטון')
        self.assertIn("(('a',) if ph_mode(ctx.st) else ('a', 'v'))", src, 'מאגר הלמידה: בלי עותק וידאו')


if __name__ == '__main__':
    unittest.main()
