"""21/10/2026 (מהיומנים של הייצור): זיהוי השוטים (8.5 דק׳ בסרטון של 87 דק׳) רץ ברקע בזמן הביקורת — הצירוף חוזר מיד,
finish מחכה לו לפני הבנייה הסופית, וכשל ברקע = הרצה חוזרת בתהליכון הראשי."""
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import job  # noqa: E402


class ShotsBg(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.pd = Path(self.tmp.name)
        self.calls, self.reports = [], []
        self.orig = job.vt
        self.release = threading.Event()
        self.fail_bg = False

        def fake_vt(ctx, args, *a, **k):
            self.calls.append((args[0], threading.current_thread().name))
            if args[0] == 'shots':
                if threading.current_thread().name == 'shots':
                    self.release.wait(5)
                    if self.fail_bg:
                        raise SystemExit('✗ vt shots נכשל')
                (self.pd / 'shots.json').write_text('{"shots": []}')
            return []
        job.vt = fake_vt
        rep = self.reports
        self.ctx = SimpleNamespace(name='jx', pdir=self.pd, st={'src': 'v'}, quiet=lambda: self.ctx,
                                   report=lambda *a, **k: rep.append(a))

    def tearDown(self):
        job.vt = self.orig
        job._SHOTS_BG.clear()
        self.tmp.cleanup()

    def test_runs_in_background_and_join_waits(self):
        t0 = time.time()
        job.shots_bg(self.ctx)
        self.assertLess(time.time() - t0, 1, 'חוזר מיד — לא מחכה לשוטים')
        self.assertFalse((self.pd / 'shots.json').exists())
        threading.Timer(0.3, self.release.set).start()
        job.shots_join(self.ctx)
        self.assertTrue((self.pd / 'shots.json').exists(), 'finish מחכה עד שהשוטים נכתבו')
        self.assertEqual([c for c in self.calls if c[0] == 'shots'], [('shots', 'shots')], 'רץ פעם אחת, ברקע')
        self.assertEqual(self.reports[0][0], 'rv', 'מחכים — השלב נשאר הביקורת (לא קופץ)')

    def test_failed_in_background_reruns(self):
        self.fail_bg = True
        self.release.set()
        job.shots_bg(self.ctx)
        job.shots_join(self.ctx)
        self.assertEqual([c[1] for c in self.calls if c[0] == 'shots'], ['shots', 'MainThread'], 'כשל ברקע — שוב, בתהליכון הראשי (שם שגיאה נזרקת כרגיל)')
        self.assertTrue((self.pd / 'shots.json').exists())

    def test_resumed_process_without_shots(self):
        job.shots_join(self.ctx)          # המשך מנקודת שמירה: בתהליך הזה לא רץ כלום, והקובץ חסר
        self.assertEqual([c[0] for c in self.calls], ['shots'])
        self.calls.clear()
        job.shots_join(self.ctx)          # הקובץ קיים — לא שוב
        self.assertEqual(self.calls, [])

    def test_off_switch(self):
        import os
        os.environ['SNB_SHOTS_BG'] = 'off'
        try:
            job.shots_bg(self.ctx)
        finally:
            del os.environ['SNB_SHOTS_BG']
        self.assertEqual(self.calls, [('shots', 'MainThread')])

    def test_finish_joins_before_checkpoint(self):
        src = (Path(job.__file__)).read_text(encoding='utf-8')
        i = src.index('def finish(args)')
        body = src[i:i + 2500]
        self.assertLess(body.index('shots_join(ctx)'), body.index("save_ck(ctx, 'rv')"), 'השוטים נכנסים לנקודת השמירה של הביקורת')


if __name__ == '__main__':
    unittest.main()


class HeavyRetry(unittest.TestCase):
    """21/10/2026: שלוש נפילות ברצף ביישור של אותה עבודה — ניסיון אחרי נפילה רץ במצב חיסכון (בלי arena), הצלחה מנקה."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.orig = (job.HEAVY_DIR, job._vt)
        job.HEAVY_DIR = Path(self.tmp.name) / 'heavy'
        self.seen = []
        self.boom = False

        def fake(ctx, args, stage, lo, hi, t0):
            import os
            self.seen.append(os.environ.get('SNB_ALIGN_ARENA'))
            if self.boom:
                raise SystemExit('נהרג באמצע')
            return []
        job._vt = fake
        self.ctx = SimpleNamespace(st={'job': 'jAbc_' + 'x' * 16}, pdir=Path(self.tmp.name))

    def tearDown(self):
        job.HEAVY_DIR, job._vt = self.orig
        self.tmp.cleanup()

    def test_retry_after_crash_is_low_memory(self):
        import os
        os.environ.pop('SNB_ALIGN_ARENA', None)
        self.boom = True                       # ניסיון ראשון: "נהרג" (בפועל — הקונטיינר נפל והסימן נשאר)
        with self.assertRaises(SystemExit):
            job.vt(self.ctx, ['align', 'x'])
        self.boom = False
        job.vt(self.ctx, ['align', 'x'])       # ה"המשך"
        self.assertEqual(self.seen, [None, 'off'], 'ניסיון ראשון רגיל, אחרי נפילה — בלי arena')
        self.assertIsNone(os.environ.get('SNB_ALIGN_ARENA'), 'הסביבה חוזרת למה שהייתה')
        self.assertFalse(list(job.HEAVY_DIR.glob('*.json')), 'הצליח — הסימן נמחק')
        job.vt(self.ctx, ['align', 'x'])
        self.assertEqual(self.seen[-1], None, 'עבודה שהצליחה — שוב רגיל')

    def test_other_commands_untouched(self):
        job.vt(self.ctx, ['plan', 'x'])
        self.assertFalse(job.HEAVY_DIR.exists() and list(job.HEAVY_DIR.glob('*.json')))
