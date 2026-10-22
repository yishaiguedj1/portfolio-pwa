"""20/10/2026: התקדמות היישור. vt align מדפיס "יישור i/n" ו־"CTC i/n" בלי סימן אחוז — עד היום הטלפון לא קיבל שום
התקדמות בשלב הזה (הפס נתקע בהתחלה, והצפי קפץ ל"עוד 3 שעות"). הפלט כאן הוא בדיוק מה ש־align.py/align_ctc.py מדפיסים."""
import json
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



class LiveUsage(unittest.TestCase):
    """21/10/2026: מצב השרת — העלות נשלחת בזמן ריצה (כל LIVE_EVERY, רק כשהשתנתה), וגם בכשל של שלב הכלים."""

    def setUp(self):
        self.rows = [{'k': 'main', 'm': 'claude-haiku-5-5', 'n': 1, 'i': 10, 'o': 5, 'cr': 0, 'c5': 0, 'c1': 0, 'usd': 0.01}]
        job.LIVE_USAGE = lambda: self.rows
        job._LIVE_SENT.update(sig='', t=0.0)

    def tearDown(self):
        job.LIVE_USAGE = None

    def test_throttle_and_change(self):
        self.assertEqual(job.live_usage(), self.rows)
        self.assertIsNone(job.live_usage(force=True))           # בלי שינוי — לא שולחים שוב
        self.rows = [dict(self.rows[0], usd=0.02)]
        self.assertIsNone(job.live_usage())                     # השתנתה, אבל פחות מ־LIVE_EVERY
        self.assertEqual(job.live_usage(force=True), self.rows)

    def test_usage_safe_prefers_live(self):
        self.assertEqual(job.usage_safe(), self.rows)

    def test_report_attaches(self):
        sent = []

        class C:
            def call(self, op, **body):
                sent.append(body)
                return {}
        ctx = job.Ctx.__new__(job.Ctx)
        ctx.c, ctx.st, ctx.last = C(), {}, ('', 0.0, -1.0)
        ctx.report('al', 0.5, force=True)
        self.assertEqual(sent[-1].get('usage'), self.rows)
        ctx.report('al', 0.9, force=True)
        self.assertNotIn('usage', sent[-1])


class VtOom(unittest.TestCase):
    def test_killed_is_worker_oom(self):
        import subprocess as sp
        real = sp.Popen

        class P:
            def __init__(self, *a, **k):
                self.stdout = iter(['x\n'])

            def wait(self):
                return -9

            def kill(self):
                pass

        class Ctx:
            def event(self, *a):
                pass
        sp.Popen = P
        try:
            with self.assertRaises(SystemExit) as cm:
                job.vt(Ctx(), ['align', 'p'])
        finally:
            sp.Popen = real
        self.assertEqual(getattr(cm.exception, 'err', ''), 'worker_oom')


class LadderHold(unittest.TestCase):
    """21/10/2026: איכויות הצפייה נעצרות בזמן היישור (שיא הזיכרון) וחוזרות אחריו."""

    def test_hold_and_restart(self):
        import tempfile, subprocess as sp
        d = Path(tempfile.mkdtemp())
        old = job.LADDER_DIR
        job.LADDER_DIR = d
        try:
            p = sp.Popen(['sleep', '30'], start_new_session=True)
            (d / 'pid').write_text(str(p.pid))
            (d / 'out').mkdir()
            (d / 'state.json').write_text(json.dumps({'job': 'j', 's': 'run', 'src': '/w/source.mp4'}))
            self.assertEqual(job.ladder_hold(), '/w/source.mp4')
            p.wait(timeout=5)
            self.assertFalse(job.ladder_running())
            self.assertFalse((d / 'out').exists())
            (d / 'state.json').write_text(json.dumps({'job': 'j', 's': 'ok', 'src': '/w/source.mp4'}))
            self.assertIsNone(job.ladder_hold())              # כבר מוכנות — לא נוגעים
        finally:
            job.LADDER_DIR = old

    def test_vt_align_holds(self):
        calls = []
        old = (job.ladder_hold, job.ladder_start, job._vt)
        job.ladder_hold = lambda: calls.append('hold') or '/w/s.mp4'
        job.ladder_start = lambda ctx, src: calls.append('start:' + src)
        job._vt = lambda *a: calls.append('vt') or []
        try:
            job.vt(None, ['align', 'p'])
            job.vt(None, ['plan', 'p'])
        finally:
            job.ladder_hold, job.ladder_start, job._vt = old
        self.assertEqual(calls, ['hold', 'vt', 'start:/w/s.mp4', 'vt'])


class AlignCkWatch(unittest.TestCase):
    """21/10/2026: התקדמות היישור עולה לענן בתוך נקודת התמלול — "המשך" ממשיך מהקטע שנעצר בו."""

    def test_saves_when_part_changes(self):
        import tempfile, threading, time as T
        d = Path(tempfile.mkdtemp())
        saved = []

        class C:
            pdir = d
            st = {'ck_pr': 1}
        old = (job.save_ck, job.ALIGN_CK_EVERY)
        job.save_ck = lambda ctx, s, extra=None: saved.append((s, extra))
        job.ALIGN_CK_EVERY = 0.05
        stop = threading.Event()
        try:
            th = threading.Thread(target=job.align_ck_watch, args=(C(), stop))
            th.start()
            T.sleep(0.12)
            self.assertEqual(saved, [])                   # עוד אין קובץ
            (d / 'align.part.json').write_text('{}')
            T.sleep(0.15)
            self.assertEqual(saved, [('asr', {'pr': 1})])  # פעם אחת — הקובץ לא השתנה מאז
            stop.set()
            th.join(1)
        finally:
            job.save_ck, job.ALIGN_CK_EVERY = old

    def test_needs_proofread_in_ck(self):
        import tempfile, threading
        d = Path(tempfile.mkdtemp())
        (d / 'align.part.json').write_text('{}')

        class C:
            pdir = d
            st = {}
        saved = []
        old = (job.save_ck, job.ALIGN_CK_EVERY)
        job.save_ck = lambda *a, **k: saved.append(a)
        job.ALIGN_CK_EVERY = 0.01
        try:
            job.align_ck_watch(C(), threading.Event())    # מצב Routine — חוזר מיד, בלי לשמור
        finally:
            job.save_ck, job.ALIGN_CK_EVERY = old
        self.assertEqual(saved, [])


class AlignPartCache(unittest.TestCase):
    """21/10/2026: vt align — תוצאות כל קטע בקובץ; מפתח אחר (מילים / חלוקה) = לא נקרא."""

    def test_roundtrip_and_key(self):
        import tempfile
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from vt.align import PartCache
        f = Path(tempfile.mkdtemp()) / 'align.part.json'
        a = PartCache(f, 'q', [['a', 1.0, 1.5]])
        a.put(0, [(1.25, 1.5), None], force=True)
        b = PartCache(f, 'q', [['a', 1.0, 1.5]])
        self.assertEqual(b.get(0), [[1.25, 1.5], None])
        self.assertIsNone(PartCache(f, 'q', [['b', 1.0, 1.5]]).get(0))      # מילים אחרות
        self.assertIsNone(PartCache(f, 'c', [['a', 1.0, 1.5]]).get(0))      # החלק של CTC נפרד
        self.assertIsNone(PartCache(None, 'q', []).get(0))

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


    def test_rerender_flags(self):
        # 22/10/2026: ההפקה מחדש (rerender.py) — אותם מעברים באותו סדר, כך שהפס בטלפון רק עולה
        self.assertEqual(job.rr_render_flags(['mkv', 'same', 'small']), ['--mkv', '--burn', '--small'])
        self.assertEqual(job.rr_render_flags(['small']), ['--compact', '--small'], 'עותק קטן בלי צרוב — הדחוס נבנה קודם')
        self.assertEqual(job.RenderProg(job.rr_render_flags(['same', 'compact'])).passes, ['same', 'compact'])
        rp = job.RenderProg(job.rr_render_flags(['same', 'compact']))
        vals = [rp.feed(x) for x in ('צורב → a', 'צריבה: 100%', 'צורב → b', 'צריבה: 10%')]
        self.assertEqual(vals, sorted(vals), 'עולה בלבד')
        r = (HERE / 'rerender.py').read_text(encoding='utf-8')
        i_mkv, i_same, i_comp, i_small = (r.index(x) for x in ("if 'mkv' in want:", "if 'same' in want:", "if 'compact' in want", "if 'small' in want:"))
        self.assertTrue(i_mkv < i_same < i_comp < i_small, 'סדר המעברים ב־rerender.py = הסדר ב־RenderProg')


class PxOf(unittest.TestCase):
    def test_px(self):
        self.assertEqual(job.px_of({'video': {'width': 1920, 'height': 1080, 'fps_float': 30}}), 1.0)
        self.assertEqual(job.px_of({'video': {'width': 3840, 'height': 2160, 'fps_float': 60}}), 8.0)
        self.assertEqual(job.px_of({'video': {'width': 1280, 'height': 720}}), round(1280 * 720 / (1920 * 1080), 3), 'בלי קצב — 30')
        self.assertIsNone(job.px_of({}))
        self.assertIsNone(job.px_of({'video': {'width': 0, 'height': 1080}}))


class CkNext(unittest.TestCase):
    """21/10/2026: "המשך" מנקודת התמלול עם ההגהה בפנים — היישור, לא "כותבים כל מילה" שכבר הסתיים."""

    def test_stage(self):
        self.assertEqual(job.ck_next('asr', {'pr': 1})[0], 'al')
        self.assertEqual(job.ck_next('asr', {})[0], 'tr')
        self.assertEqual(job.ck_next('al', {'pr': 1})[0], 'tl')
