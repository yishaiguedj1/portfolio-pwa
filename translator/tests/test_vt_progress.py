"""20/10/2026: התקדמות היישור. vt align מדפיס "יישור i/n" ו־"CTC i/n" בלי סימן אחוז — עד היום הטלפון לא קיבל שום
התקדמות בשלב הזה (הפס נתקע בהתחלה, והצפי קפץ ל"עוד 3 שעות"). הפלט כאן הוא בדיוק מה ש־align.py/align_ctc.py מדפיסים."""
import re
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))
import job  # noqa: E402


class VtFrac(unittest.TestCase):
    def test_align_lines(self):
        f = job.vt_frac
        self.assertAlmostEqual(f('align', '[vt 14:58:01]   יישור 1/40 (0.4/15.0 דק׳, 12 שנ׳)'), 0.8 / 40)
        self.assertAlmostEqual(f('align', '[vt 14:59:01]   יישור 40/40 (15.0/15.0 דק׳, 300 שנ׳)'), 0.8)
        self.assertAlmostEqual(f('align', '[vt 15:00:01]   CTC 10/20 (7.5/15.0 דק׳, 30 שנ׳)'), 0.9)
        self.assertAlmostEqual(f('align', '[vt 15:00:31]   CTC 20/20 (15.0/15.0 דק׳, 60 שנ׳)'), 1.0)
        self.assertIsNone(f('align', '[vt 15:01:00] יושרו 2100 מילים · חשודות 3'))
        self.assertIsNone(f('align', '[vt 15:01:00] מודל היישור נטען (4 שנ׳)'))

    def test_percent_any_command(self):
        self.assertAlmostEqual(job.vt_frac('asr', 'תמלול 42%'), 0.42)
        self.assertEqual(job.vt_frac('render', '150%'), 1.0)
        self.assertIsNone(job.vt_frac('asr', 'CTC 3/4'))        # ספירת חלונות — רק ב־align

    def test_matches_vt_output(self):
        """הביטויים חייבים להתאים למה ש־vt באמת מדפיס (אחרת שוב בלי התקדמות)."""
        a = (HERE / 'vt' / 'align.py').read_text(encoding='utf-8')
        c = (HERE / 'vt' / 'align_ctc.py').read_text(encoding='utf-8')
        self.assertTrue(re.search(r'log\(f"  יישור \{ci \+ 1\}/\{len\(chunks\)\}', a))
        self.assertTrue(re.search(r'log\(f"  CTC \{ci \+ 1\}/\{len\(plan\)\}', c))


if __name__ == '__main__':
    unittest.main()


class SpeedSafe(unittest.TestCase):
    """20/10/2026: האצות בלי שינוי בתוצאה — נמדדו בתמונת העובד (יומן העבודה)."""

    def test_svt_lp_cores(self):
        import os
        sys.path.insert(0, str(HERE))
        from vt import render
        old = os.environ.get('SNB_SVT_LP')
        try:
            os.environ['SNB_SVT_LP'] = '8'
            self.assertEqual(render.svt_lp(), 8)
            self.assertIn('lp=8:enable-tf=0', ' '.join(render.enc_args('av1', 40, 10, 'enable-tf=0')))
            del os.environ['SNB_SVT_LP']
            self.assertTrue(4 <= render.svt_lp() <= 16)
        finally:
            if old is None:
                os.environ.pop('SNB_SVT_LP', None)
            else:
                os.environ['SNB_SVT_LP'] = old

    def test_release_before_ctc(self):
        src = (HERE / 'vt' / 'cli.py').read_text(encoding='utf-8')
        body = src[src.index('def cmd_align'):src.index('def cmd_retime')]
        self.assertLess(body.index('_release_memory()'), body.index('ctc_align(words'))


class RenderProgress(unittest.TestCase):
    """21/10/2026: vt render מריץ כמה מעברים, וכל אחד מדפיס "צריבה: N%" מאפס — הפס בטלפון חזר אחורה בכל מעבר"""

    def feed(self, args, lines):
        rp = job.RenderProg(args)
        return [rp.feed(x) for x in lines]

    def test_burn_then_compact_never_back(self):
        got = self.feed(['p', '--compact', '--burn'], ['[vt] צורב → p.he.mp4 (av1)', '[vt] צריבה: 50% · 1 דק׳', '[vt] צריבה: 100% · 2 דק׳',
                                                     '[vt] צורב → p.he.compact.mp4 (av1)', '[vt] צריבה: 10% · 0.1 דק׳', '[vt] צריבה: 100%'])
        vals = [x for x in got if x is not None]
        self.assertEqual(vals, sorted(vals), 'עולה בלבד — גם כשהמעבר השני מתחיל מ־0%')
        self.assertAlmostEqual(vals[2], 1.0 / 1.75, 3, 'הצריבה הזהה = 1.0 מתוך 1.75 (זהה + דחוס)')
        self.assertAlmostEqual(vals[-1], 1.0)

    def test_small_copy_passes(self):
        got = self.feed(['p', '--compact', '--small', '28'], ['צורב → p.compact', 'צריבה: 100%', 'עותק קטן 1/2: 50%', 'עותק קטן 2/2: 100%'])
        w = job.RENDER_W
        tot = w['compact'] + w['small1'] + w['small2']
        self.assertAlmostEqual(got[2], (w['compact'] + w['small1'] * 0.5) / tot, 3)
        self.assertAlmostEqual(got[3], 1.0)

    def test_default_is_compact_and_mkv_first(self):
        self.assertEqual(job.RenderProg(['p']).passes, ['compact'], 'בלי דגלים — רק הדחוס (כמו cmd_render)')
        rp = job.RenderProg(['p', '--mkv', '--burn'])
        self.assertEqual(rp.passes, ['mkv', 'same'])
        self.assertIsNone(rp.feed('צריבה: 40%'), 'לפני שהצריבה התחילה (עוד ב־MKV) — לא מנחשים')
        self.assertGreater(rp.feed('צורב → x'), 0)

    def test_matches_vt_output(self):
        r = (HERE / 'vt' / 'render.py').read_text(encoding='utf-8')
        self.assertIn('log(f"צורב → ', r)
        self.assertIn('run_progress(cmd, total, "צריבה", every=0.02)', r)
        self.assertIn('"עותק קטן 1/2"', r)
        self.assertIn('"עותק קטן 2/2"', r)
        c = (HERE / 'vt' / 'cli.py').read_text(encoding='utf-8')
        i_mkv, i_burn, i_comp, i_small = (c.index(x) for x in ('if a.mkv:', 'if a.burn:', 'if a.compact:', 'if a.small:'))
        self.assertTrue(i_mkv < i_burn < i_comp < i_small, 'סדר המעברים ב־cmd_render = הסדר ב־RenderProg')


class PxOf(unittest.TestCase):
    def test_px(self):
        self.assertEqual(job.px_of({'video': {'width': 1920, 'height': 1080, 'fps_float': 30}}), 1.0)
        self.assertEqual(job.px_of({'video': {'width': 3840, 'height': 2160, 'fps_float': 60}}), 8.0)
        self.assertEqual(job.px_of({'video': {'width': 1280, 'height': 720}}), round(1280 * 720 / (1920 * 1080), 3), 'בלי קצב — 30')
        self.assertIsNone(job.px_of({}))
        self.assertIsNone(job.px_of({'video': {'width': 0, 'height': 1080}}))
