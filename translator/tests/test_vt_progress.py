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
