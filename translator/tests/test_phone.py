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


def words_doc(**k):
    d = {'v': 1, 'words': [{'w': 'Hello', 's': 0.5, 'e': 0.9, 'spk': 'S1', 'align': 'ok'},
                           {'w': 'world.', 's': 0.95, 'e': 1.4, 'spk': 'S1'},
                           {'w': 'Thanks', 's': 3.0, 'e': 3.4, 'spk': 'S2', 'align': 'approx'}],
         'diarize': {'speakers': 2, 'segments': 3, 'seconds': 1.2, 'junk': 'x'}}
    d.update(k)
    return d


class PhoneWords(unittest.TestCase):
    """25/10/2026 (שלב 2): גם התמלול והיישור בטלפון — עולים רק המילים עם הזמנים והמדידות."""

    def test_check_good(self):
        r = job.pw_check(words_doc(), 600)
        self.assertEqual([w['w'] for w in r['words']], ['Hello', 'world.', 'Thanks'])
        self.assertEqual(r['words'][0], {'w': 'Hello', 's': 0.5, 'e': 0.9, 'spk': 'S1', 'align': 'ok'})
        self.assertEqual(r['engine'], 'parakeet')
        self.assertEqual(r['diarize'], {'speakers': 2, 'segments': 3, 'seconds': 1.2}, 'רק מספרים מוכרים')

    def test_check_bad(self):
        W = words_doc()['words']
        bad = [None, {'v': 2, 'words': W}, words_doc(words=[]), words_doc(words='x'),
               words_doc(words=[dict(W[0], w='')]), words_doc(words=[dict(W[0], w='a' * 65)]), words_doc(words=[dict(W[0], w='a\x01b')]),
               words_doc(words=[dict(W[0], s='1')]), words_doc(words=[dict(W[0], e=0.1)]),                 # סוף לפני ההתחלה
               words_doc(words=[dict(W[0], s=700, e=701)]),                                                # אחרי סוף הסרטון
               words_doc(words=[W[2], dict(W[0], s=1.0, e=1.1)]),                                          # חוזר אחורה
               words_doc(words=[dict(W[0], spk='<b>')]), words_doc(words=[dict(W[0], align='x')]),
               words_doc(words=[dict(W[0], s=float('nan'))])]
        for i, d in enumerate(bad):
            self.assertIsNone(job.pw_check(d, 600), i)
        self.assertIsNone(job.pw_check(words_doc(words=[W[0]] * (job.PW_WORDS_MAX + 1)), None), 'יותר מדי מילים')

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.pd = root / 'proj'
        self.calls, self.cks, self.reports = [], [], []
        self.o = (job.vt, job.fetch_input, job.save_state, job.VT_WORK, job.ensure_env, job.inject_guard, job.save_ck)
        job.VT_WORK = root / 'work'

        def vt(ctx, args, *a, **k):
            self.calls.append(args[0])
            if args[0] == 'new':
                self.pd.mkdir(exist_ok=True)
            return []
        job.vt = vt
        job.fetch_input = lambda ctx, fid, dest, size, *a: Path(dest).write_text(json.dumps(meta() if fid == 'R2_x_m' else words_doc()))
        job.save_state = lambda st: None
        job.ensure_env = lambda *a, **k: None
        job.inject_guard = lambda *a, **k: None
        job.save_ck = lambda ctx, s, *a: self.cks.append(s)
        files = {'m': {'id': 'R2_x_m', 'size': 10}, 'w': {'id': 'R2_x_w', 'size': 10}}
        self.ctx = SimpleNamespace(name='jx', pdir=self.pd, st={'spec': {'ph': 1, 'pw': 1, 'eng': 'api', 'name': 'talk.mp4'}, 'files': files, 'kind': 'tr'},
                                   report=lambda *a, **k: self.reports.append((a, k)), refresh=lambda: None)

    def tearDown(self):
        job.vt, job.fetch_input, job.save_state, job.VT_WORK, job.ensure_env, job.inject_guard, job.save_ck = self.o
        self.tmp.cleanup()

    def test_prepare_from_phone(self):
        self.assertTrue(job.pw_mode(self.ctx.st))
        self.assertFalse(job.pw_mode({'spec': {'pw': 1}}), 'רק בתרגום בטלפון')
        self.assertEqual(job.prepare_pw(self.ctx), 0)
        self.assertEqual(self.calls, ['new', 'edit-export'], 'בלי ingest, asr ו־shots — הכל מהטלפון')
        asr = json.loads((self.pd / 'asr' / 'parakeet.json').read_text())
        self.assertEqual(len(asr['words']), 3)
        self.assertEqual(asr['words'][2]['spk'], 'S2')
        m = json.loads((self.pd / 'media.json').read_text())
        self.assertEqual(m['video']['width'], 1920)
        self.assertEqual(len(json.loads((self.pd / 'shots.json').read_text())['shots']), 2)
        self.assertEqual(self.ctx.st['src'], 'ph')
        self.assertEqual(self.cks, ['asr'])

    def test_prepare_bad_words(self):
        job.fetch_input = lambda ctx, fid, dest, size, *a: Path(dest).write_text(json.dumps(meta() if fid == 'R2_x_m' else {'v': 1, 'words': []}))
        with self.assertRaises(job.StepError) as e:
            job.prepare_pw(self.ctx)
        self.assertEqual(e.exception.err, 'ph_words')

    def test_prepare_missing_files(self):
        self.ctx.st['files'] = {'m': {'id': 'R2_x_m'}}
        with self.assertRaises(job.StepError) as e:
            job.prepare_pw(self.ctx)
        self.assertEqual(e.exception.err, 'ph_words')

    def test_aligned_from_phone_times(self):
        self.pd.mkdir()
        ws = [{'w': 'Hello', 's': 0.5, 'e': 0.9, 'spk': 'S1'}, {'w': 'there', 's': 0.9, 'e': 1.2, 'spk': 'S1', 'edited': True}]
        (self.pd / 'en.words.json').write_text(json.dumps({'source': 'parakeet', 'words': ws}))
        job.pw_aligned(self.ctx)
        d = json.loads((self.pd / 'en.aligned.json').read_text())
        self.assertEqual(d['words'], ws, 'הזמנים מהטלפון כמו שהם')
        self.assertEqual((d['stats']['aligned'], d['stats']['kept_approx']), (1, 1))
        self.assertIn('בטלפון', d['aligner'])

    def test_align_run_skips_vt_align(self):
        self.pd.mkdir()
        (self.pd / 'en.words.json').write_text(json.dumps({'words': [{'w': 'a', 's': 0, 'e': 0.2}]}))
        job.align_run(self.ctx)
        self.assertEqual(self.calls, ['retime'], 'בלי vt align — רק retime מהזמנים של הטלפון')
        self.assertTrue((self.pd / 'en.aligned.json').exists())


class SameFileAsPhone(unittest.TestCase):
    """הקובץ שה־Kotlin מייצר (PhCoreTest משווה אליו) — מה שהעובד מקבל. ffprobe ו־scdet אמיתיים."""
    FX = Path(__file__).resolve().parents[2] / 'android/app/src/testStudio/resources/ph'

    def test_phone_meta_accepted(self):
        d = json.loads((self.FX / 'meta.expect.json').read_text(encoding='utf-8'))
        chk = job.ph_meta_check(d)
        self.assertIsNotNone(chk, 'מה שהטלפון שולח עובר את הבדיקה של העובד')
        self.assertEqual(chk[1]['shots'], [{'t': 6.006, 'score': 21.895}])

    def test_summarize_same_as_phone_info(self):
        sys.path.insert(0, str(Path(job.__file__).parent))
        from vt import media
        o = media.summarize(json.loads((self.FX / 'probe.json').read_text(encoding='utf-8')), 'x')
        e = json.loads((self.FX / 'info.expect.json').read_text(encoding='utf-8'))
        self.assertEqual((o['video']['width'], o['video']['fps'], o['audio']['t0']), (e['w'], e['fps'], e['at0']))


FF = __import__('shutil').which('ffmpeg') and __import__('shutil').which('ffprobe')
KT = Path(__file__).resolve().parents[2] / 'android/app/src/studio/java/io/github/yishaiguedj1/snowball/PhCore.kt'


@unittest.skipUnless(FF, 'אין ffmpeg')
class BurnSync(unittest.TestCase):
    """24/10/2026 (בטלפון: הווידאו איחר ב־5 שנ׳ אחרי הקול). הצינור של PhCore: ffmpeg → פריימים nv12 בקצב קבוע → מקודד
    (כאן libx264 במקום MediaCodec) → אריזה עם הקול מהמקור. מקור שהווידאו בו מתחיל אחרי הקול, וקובץ TS שמתחיל אחרי 0:
    הבהירות של כל פריים = 8 × הזמן במקור, ולכן בזמן T בתוצר רואים בדיוק את הפריים של זמן T (הקול לא זז)."""

    def run_ff(self, *a):
        import subprocess
        return subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-y', '-loglevel', 'error', *a], check=True, capture_output=True)

    def luma(self, f, t):
        import subprocess
        o = subprocess.run(['ffmpeg', '-hide_banner', '-ss', str(t), '-i', str(f), '-frames:v', '1', '-vf',
                            'signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-f', 'null', '-'], capture_output=True, text=True).stderr
        return float(o.split('YAVG=')[1].split()[0])

    def pipeline(self, d, src, fps='24/1', w=160, h=120):
        import subprocess
        raw = subprocess.run(['ffmpeg', '-hide_banner', '-nostdin', '-loglevel', 'error', '-i', str(src), '-map', '0:v:0', '-vf', 'format=nv12',
                              '-fps_mode', 'cfr', '-r', fps, '-an', '-sn', '-f', 'rawvideo', '-pix_fmt', 'nv12', 'pipe:1'], check=True, capture_output=True).stdout
        (d / 'r.nv12').write_bytes(raw)
        self.run_ff('-f', 'rawvideo', '-pix_fmt', 'nv12', '-s', f'{w}x{h}', '-r', fps, '-i', str(d / 'r.nv12'), '-c:v', 'libx264', '-bf', '0', str(d / 'v.mp4'))
        self.run_ff('-i', str(d / 'v.mp4'), '-i', str(src), '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy', '-c:a', 'copy', str(d / 'out.mp4'))
        return d / 'out.mp4'

    def source(self, d):
        self.run_ff('-f', 'lavfi', '-i', "color=c=gray:s=160x120:r=24,geq=lum='mod(T*8\\,250)':cb=128:cr=128", '-f', 'lavfi', '-i',
                    'sine=f=440:sample_rate=48000', '-t', '25', '-c:v', 'libx264', '-bf', '3', '-c:a', 'aac', str(d / 'lum.mp4'))
        return d / 'lum.mp4'

    def test_video_starts_after_audio(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t); lum = self.source(d)
            self.run_ff('-itsoffset', '4.958', '-i', str(lum), '-i', str(lum), '-map', '0:v', '-map', '1:a', '-c', 'copy', '-t', '25', str(d / 'late.mp4'))
            out = self.pipeline(d, d / 'late.mp4')
            for T in (8, 14, 20):
                self.assertAlmostEqual(self.luma(out, T), 8 * (T - 4.958), delta=2.5, msg=f'T={T}')

    def test_ts_not_starting_at_zero(self):
        with tempfile.TemporaryDirectory() as t:
            d = Path(t); lum = self.source(d)
            self.run_ff('-i', str(lum), '-c', 'copy', '-f', 'mpegts', '-output_ts_offset', '1.4', str(d / 'b.ts'))
            out = self.pipeline(d, d / 'b.ts')
            for T in (6, 12, 18):
                self.assertAlmostEqual(self.luma(out, T), 8 * T, delta=2.5, msg=f'T={T}')

    def test_kotlin_has_no_double_shift(self):
        src = KT.read_text(encoding='utf-8')
        body = src[src.index('fun burnArgs'):src.index('fun mp4Audio')]
        self.assertNotIn('setpts', body.split('*/')[-1] if '*/' in body else body)
        self.assertNotIn('"-itsoffset"', body)
        self.assertIn('"-fps_mode", "cfr"', body)


class Wiring(unittest.TestCase):
    def test_source_rules(self):
        src = Path(job.__file__).read_text(encoding='utf-8')
        self.assertIn("kind = 'a' if info.get('src') in ('a', 'ph')", src, 'המשך: מורידים שוב את הקול, לא מחכים לסרטון')
        self.assertIn("(('a',) if ph_mode(ctx.st) else ('a', 'v'))", src, 'מאגר הלמידה: בלי עותק וידאו')


if __name__ == '__main__':
    unittest.main()
