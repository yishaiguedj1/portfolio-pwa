"""כתוביות צרובות במקור (16/11/2026): זיהוי, ובמצב הסתרה (רקע כהה) — מלבן אטום מעליהן. תיבות סינתטיות בלבד."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vt import burnin as B  # noqa: E402
from vt import config as C  # noqa: E402
from vt.sty import apply_sty  # noqa: E402
from vt.subs import write_ass  # noqa: E402

HAS_FF = shutil.which('ffmpeg') is not None
STYLE = C.STYLES['bold']
WD, HD = 1920, 1080
ST = STYLE.scaled(WD, HD)


class Meas:
    def width(self, line):
        return 30.0 * len(line)


M = Meas()
CORNER = [0.0, 0.88, 0.08, 0.95]          # לוגו בפינה
NAME = [0.05, 0.7, 0.3, 0.73]             # שם דובר משמאל


def sub_line(w, y=0.88):
    """שורת כתובית ממורכזת ברוחב w (כמו שהגלאי מוציא — מכווצת)."""
    return [round(0.5 - w / 2, 3), y, round(0.5 + w / 2, 3), y + 0.02]


def subs_video(sec=60, extra=()):
    """2 פריימים לשנייה: כתובית מתחלפת כל 2 שנ׳ (רוחב משתנה), שנייה של שקט בין כל 3."""
    frames, n = [], int(sec * 2)
    for k in range(n):
        t = k / 2
        blk = int(t // 2)
        bs = list(extra)
        if blk % 3 != 2:
            bs.append(sub_line(0.3 + 0.1 * (blk % 4)))
        if bs:
            frames.append([t, bs])
    return {'v': 1, 'fps': 2, 'n': n, 'frames': frames}


def cue(i, s, e, lines):
    return {'id': i, 'start': s, 'end': e, 'lines': lines}


class TestHardsub(unittest.TestCase):
    def test_changing_centered_lines_found(self):
        d = B.hardsub(subs_video(), WD, HD)
        self.assertIsNotNone(d)
        x1, y1, x2, y2 = d['z']
        self.assertLess(x1, 0.36)
        self.assertGreater(x2, 0.64)
        self.assertGreater(y1, 0.8)
        self.assertLess(y2, 0.95)
        self.assertGreater(d['sh'], 0.5)

    def test_static_watermark_and_banner_not(self):
        n = 120
        wm = {'n': n, 'frames': [[k / 2, [sub_line(0.2, 0.92)]] for k in range(n)]}
        self.assertIsNone(B.hardsub(wm, WD, HD))
        ban = {'n': n, 'frames': [[k / 2, [[0.0, 0.85, 1.0, 0.88]]] for k in range(n)]}
        self.assertIsNone(B.hardsub(ban, WD, HD))

    def test_side_text_and_top_not(self):
        n = 120
        side = {'n': n, 'frames': [[k / 2, [[0.05, 0.86, 0.05 + 0.1 * (k % 3 + 1), 0.88]]] for k in range(n)]}
        self.assertIsNone(B.hardsub(side, WD, HD))
        top = {'n': n, 'frames': [[k / 2, [[0.5 - 0.05 * (k % 4 + 1), 0.1, 0.5 + 0.05 * (k % 4 + 1), 0.12]]] for k in range(n)]}
        self.assertIsNone(B.hardsub(top, WD, HD))

    def test_rare_lines_not(self):
        d = subs_video()
        d['frames'] = d['frames'][:8]          # 8 מתוך 120 — פחות מ־12%
        self.assertIsNone(B.hardsub(d, WD, HD))
        self.assertIsNone(B.hardsub({}, WD, HD))
        self.assertIsNone(B.hardsub({'n': 0, 'frames': []}, WD, HD))

    def test_two_boxes_one_row_merge(self):
        ls = B.sub_lines([B.grow([0.3, 0.88, 0.48, 0.9], WD, HD), B.grow([0.52, 0.88, 0.7, 0.9], WD, HD)])
        self.assertEqual(len(ls), 1)
        self.assertEqual(ls[0][1], [0, 1])

    def test_norm_hz(self):
        self.assertEqual(B.norm_hz([0.2, 0.8, 0.8, 0.95]), [0.2, 0.8, 0.8, 0.95])
        for bad in (None, [0.2, 0.8, 0.8], [0.2, 0.8, 0.2, 0.95], [-0.1, 0.8, 0.8, 0.9], ['a', 0, 1, 1], 'x', [0, 0.5, 1, 1.2]):
            self.assertIsNone(B.norm_hz(bad), bad)


class TestHide(unittest.TestCase):
    def test_without_subs_keeps_other_text(self):
        d = subs_video(extra=[CORNER, NAME])
        w = B.without_subs(d, WD, HD)
        for _, bs in w['frames']:
            self.assertIn(CORNER, bs)
            self.assertIn(NAME, bs)
            self.assertEqual(len(bs), 2)

    def test_place_does_not_lift_over_hidden_subs(self):
        d = subs_video()
        c1 = [cue(1, 0.0, 3.5, ['שלום לכולם'])]
        B.place(c1, d, ST, M, WD, HD)
        self.assertTrue(c1[0].get('lift') or c1[0].get('top'))        # בלי הסתרה — עוקפת
        c2 = [cue(1, 0.0, 3.5, ['שלום לכולם'])]
        B.place(c2, B.without_subs(d, WD, HD), ST, M, WD, HD)
        self.assertFalse(c2[0].get('lift') or c2[0].get('top'))       # במצב הסתרה — במקומה

    def test_cover_continuous_and_bridged(self):
        """כתוביות צרובות עם שקט של שנייה-שתיים ביניהן — כיסוי רציף אחד (בלי הבהוב ובלי חור), עד אחרי הצרובה האחרונה."""
        d = subs_video(20)
        cs = [cue(1, 0.3, 3.5, ['שלום'])]
        ev = B.cover(cs, d, None, ST, M, WD, HD)
        self.assertEqual(ev[0][0], 0.0)
        for x, y in zip(ev, ev[1:]):
            self.assertLessEqual(y[0] - x[1], 1e-6)                    # אין רגע בלי כיסוי
        last = max(t for t, _ in d['frames'])
        self.assertGreaterEqual(ev[-1][1], last + B.HS_PRE - 1e-6)
        z = B.hardsub(d, WD, HD)['z']
        for _, _, r in ev:                                             # כל האזור, בכל רגע
            self.assertTrue(r[0] <= z[0] and r[1] <= z[1] and r[2] >= z[2] and r[3] >= z[3], r)
        cr = B.cue_rect(cs[0], ST, M, WD, HD)
        r = next(x[2] for x in ev if x[0] <= 1.0 <= x[1])
        self.assertTrue(r[1] <= cr[1] and r[3] >= cr[3])               # גם הכתובית שלנו בתוך המלבן

    def test_long_silence_not_covered(self):
        sl = [sub_line(0.4 + 0.05 * (k % 3)) for k in range(20)]
        d = {'n': 60, 'frames': [[k / 2, [sl[k % 20]]] for k in range(0, 7)] + [[k / 2, [sl[k % 20]]] for k in range(30, 37)]}
        ev = B.cover([], d, None, ST, M, WD, HD)
        self.assertEqual(len(ev), 2)
        self.assertLess(ev[0][1], 5.0)
        self.assertGreater(ev[1][0], 13.0)

    def test_cover_zone_only(self):
        cs = [cue(1, 1.0, 2.0, ['א']), cue(2, 5.0, 6.0, ['ב'])]
        z = [0.3, 0.84, 0.7, 0.92]
        ev = B.cover(cs, None, z, ST, M, WD, HD)
        self.assertEqual([(s, e) for s, e, _ in ev], [(1.0, 2.0), (5.0, 6.0)])
        self.assertLess(ev[0][2][0], 0.3)
        self.assertEqual(B.cover(cs, None, None, ST, M, WD, HD), [])

    def test_full_band(self):
        ev = B.cover([cue(1, 1.0, 2.0, ['א'])], None, [0.3, 0.84, 0.7, 0.92], ST, M, WD, HD, full=True, dur=30.0)
        self.assertEqual((ev[0][0], ev[-1][1]), (0.0, 30.0))
        for x, y in zip(ev, ev[1:]):
            self.assertLessEqual(y[0] - x[1], 1e-6)

    def test_top_cue_not_merged(self):
        cs = [dict(cue(1, 0.0, 3.0, ['למעלה']), top=True)]
        ev = B.cover(cs, subs_video(4), None, ST, M, WD, HD)
        self.assertGreater(ev[0][2][1], 0.7)                           # רק הצרובות, בלי פס מהראש עד התחתית

    def test_join_short_gaps(self):
        cs = [cue(1, 0.0, 1.0, ['א']), cue(2, 1.2, 2.0, ['ב'])]
        ev = B.cover(cs, None, [0.3, 0.84, 0.7, 0.92], ST, M, WD, HD)
        self.assertEqual(ev[0][1], 1.2)


class TestLeaks(unittest.TestCase):
    Z = [0.3, 0.84, 0.7, 0.93]

    def ev(self):
        return [(0.0, 5.0, B._pad(self.Z))]

    def test_kinds(self):
        burn = sub_line(0.7)                                           # במקור: כתובית צרובה רחבה מהמלבן
        frag = [0.17, 0.88, 0.25, 0.9]                                 # הקצה שלה שמבצבץ משמאל למלבן
        ours = [0.42, 0.87, 0.58, 0.89]                                # העברית שלנו — בתוך המלבן
        logo = [0.0, 0.88, 0.06, 0.94]                                 # לוגו בפינה — גם במקור, רחוק מהאזור
        chk = {'n': 3, 'frames': [[1.0, [frag, ours, logo], [burn, logo]],
                                   [6.0, [burn], [burn]],               # אין כיסוי בכלל ברגע הזה
                                   [7.0, [ours], []]]}
        lk = B.leaks(chk, self.ev(), [cue(1, 0.5, 4.0, ['שלום'])], self.Z, ST, M, WD, HD)
        self.assertEqual([t for t, _ in lk], [1.0, 6.0])

    def test_clean(self):
        chk = {'n': 1, 'frames': [[1.0, [[0.42, 0.87, 0.58, 0.89]], [sub_line(0.3)]]]}
        self.assertEqual(B.leaks(chk, self.ev(), [], self.Z, ST, M, WD, HD), [])

    def test_hide_rounds(self):
        cs = [cue(1, 0.5, 4.0, ['שלום'])]
        writes = []
        frag = [0.18, 0.88, 0.24, 0.9]
        seq = [{'n': 10, 'frames': [[8.0, [sub_line(0.5)], [sub_line(0.5)]]]}, {'n': 10, 'frames': []}]
        ev, res = B.hide(cs, subs_video(5), None, ST, M, WD, HD, writes.append, lambda: seq.pop(0))
        self.assertEqual(res, {'n': 20, 'lk': 1, 'ok': 1})
        self.assertEqual(len(writes), 2)                              # כתיבה, תיקון
        self.assertTrue(any(s <= 8.0 <= e for s, e, _ in ev))          # הדליפה מכוסה
        # דולף שוב ושוב (בכל בדיקה במקום אחר) — אחרי שני תיקונים פס רציף, ובסוף ok=0
        frag = [0.17, 0.88, 0.25, 0.9]
        three = [{'n': 5, 'frames': [[t, [frag], [sub_line(0.7)]]]} for t in (1.0, 30.0, 60.0)]
        ev, res = B.hide(cs, subs_video(5), None, ST, M, WD, HD, lambda e: None, lambda: three.pop(0), dur=9.0)
        self.assertEqual((res['ok'], res.get('full'), res['n'], res['lk']), (0, 1, 15, 3))
        self.assertTrue(any(s <= 30.0 <= e for s, e, _ in ev))
        # אי אפשר לבדוק
        ev, res = B.hide(cs, subs_video(5), None, ST, M, WD, HD, lambda e: None, lambda: None)
        self.assertEqual(res, {'n': 0, 'lk': 0, 'ok': 0})
        self.assertTrue(ev)

    def test_zone_lift(self):
        cs = [cue(1, 0, 1, ['א']), dict(cue(2, 1, 2, ['ב']), top=True), dict(cue(3, 2, 3, ['ג']), lift=0.1)]
        self.assertEqual(B.zone_lift(cs, [0.3, 0.7, 0.7, 0.8], ST, HD), 1)
        self.assertGreater(cs[0]['lift'], 0.1)
        self.assertNotIn('lift', cs[1])
        self.assertEqual(cs[2]['lift'], 0.1)
        cs = [cue(1, 0, 1, ['א'])]
        self.assertEqual(B.zone_lift(cs, [0.3, 0.86, 0.7, 0.97], ST, HD), 0)   # הצרובות במקום של שלנו — לא זזות

    def test_cover_ass_under_cues(self):
        cs = [cue(1, 0.0, 2.0, ['שלום'])]
        ev = B.cover(cs, None, [0.3, 0.84, 0.7, 0.92], ST, M, WD, HD)
        txt = B.cover_ass(write_ass(cs, STYLE, WD, HD), ev, WD, HD)
        lines = txt.splitlines()
        i = next(k for k, x in enumerate(lines) if '\\p1' in x)
        j = next(k for k, x in enumerate(lines) if x.startswith('Dialogue:') and '\\p1' not in x)
        self.assertLess(i, j)
        self.assertIn('\\1a&H00&', lines[i])
        self.assertTrue(lines[i].startswith('Dialogue: 0,0:00:00.00,0:00:02.00,Main'))
        self.assertEqual(B.cover_ass('x', ev, WD, HD), 'x')
        self.assertEqual(B.cover_ass(txt, [], WD, HD), txt)

    def test_opaque_box_only_when_hiding(self):
        self.assertEqual(apply_sty(STYLE, {'bx': 1}).outline_colour, '&H60000000')
        self.assertEqual(apply_sty(STYLE, {'bx': 1}, hide=True).outline_colour, '&H00000000')


class TestProbe(unittest.TestCase):
    @unittest.skipUnless(HAS_FF, 'ffmpeg')
    def test_probe_samples_and_classifies(self):
        from vt import media
        with tempfile.TemporaryDirectory() as td:
            src = Path(td) / 'v.mp4'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i',
                            'color=gray:s=320x180:d=12:r=10', '-pix_fmt', 'yuv420p', str(src)], check=True)
            seen = []

            class Fake:
                def __init__(self, *a, **k):
                    pass

                def frame(self, img, t=None):
                    seen.append(img.shape)
                    k = len(seen)
                    return [sub_line(0.2 + 0.1 * (k % 4))] if k % 5 else []
            old_d, old_a = B.Detector, B.available
            B.Detector, B.available = Fake, lambda: True
            try:
                d = media.hardsub_probe(src, 12)
            finally:
                B.Detector, B.available = old_d, old_a
            self.assertEqual(len(seen), 12)
            self.assertEqual(seen[0][1:], (640, 3))
            self.assertIsNotNone(d)
            self.assertIn('z', d)

    def test_probe_without_models(self):
        from vt import media
        old = B.available
        B.available = lambda: False
        try:
            self.assertIsNone(media.hardsub_probe(Path('/nonexistent.mp4')))
            self.assertIsNone(media.burn_scan(Path('/nonexistent.mp4')))
        finally:
            B.available = old


class TestRerenderHide(unittest.TestCase):
    def test_hide_burned_scans_and_drops_old_lift(self):
        import rerender as R
        from vt import media
        calls = []

        def fake_scan(src):
            calls.append(src)
            return subs_video(10)
        old = media.burn_scan
        media.burn_scan = fake_scan
        try:
            cs = [dict(cue(1, 0.0, 3.0, ['שלום']), lift=0.2)]
            ev, res = R.hide_burned(cs, '/x.mp4', [0.3, 0.84, 0.7, 0.92], apply_sty(STYLE, {'bx': 1}, hide=True), WD, HD)
        finally:
            media.burn_scan = old
        self.assertEqual(len(calls), 1)
        self.assertNotIn('lift', cs[0])                                # ההרמה מעל הצרובות — כבר לא
        self.assertTrue(ev)

    def test_hide_burned_scan_fails_uses_zone(self):
        import rerender as R
        from vt import media

        def boom(src):
            raise RuntimeError('x')
        old = media.burn_scan
        media.burn_scan = boom
        try:
            cs = [cue(1, 0.0, 3.0, ['שלום'])]
            ev, res = R.hide_burned(cs, '/x.mp4', [0.3, 0.84, 0.7, 0.92], STYLE, WD, HD)
        finally:
            media.burn_scan = old
        self.assertEqual([(s, e) for s, e, _ in ev], [(0.0, 3.0)])
        self.assertEqual(res['ok'], 0)                                 # בלי סריקה — לא נבדק
        media.burn_scan = boom
        try:
            ev, res = R.hide_burned([cue(1, 0.0, 3.0, ['שלום'])], '/x.mp4', [0.3, 0.84, 0.7, 0.92], STYLE, WD, HD, crop=True)
        finally:
            media.burn_scan = old
        self.assertEqual(ev, [])                                       # מסגרת חתוכה בלי סריקה — בלי כיסוי שגוי


class TestJob(unittest.TestCase):
    """job.py: הבדיקה המהירה ברקע, הדיווח לטלפון (hs), והגיבוי מהסריקה המלאה לפני הבנייה."""
    def setUp(self):
        import job
        from types import SimpleNamespace
        self.job = job
        self.tmp = tempfile.TemporaryDirectory()
        self.pd = Path(self.tmp.name)
        self.reps = []
        self.st = {'kind': 'tr', 'spec': {'out': ['compact']}}
        self.ctx = SimpleNamespace(name='jh', pdir=self.pd, st=self.st, report=lambda *a, **k: self.reps.append(k))
        job._HS_RUN.clear()

    def tearDown(self):
        self.job._HS_RUN.clear()
        self.tmp.cleanup()

    def test_wanted(self):
        w = self.job.hs_wanted
        self.assertTrue(w(self.st))
        self.assertFalse(w({'kind': 'tr', 'spec': {'out': []}}))                     # רק כתוביות — אין מה להסתיר
        self.assertFalse(w({'kind': 'tr', 'spec': {'out': ['compact'], 'ka': 1}}))     # קריוקי
        self.assertFalse(w({'kind': 'rr', 'spec': {'out': ['compact']}}))
        self.assertFalse(w({'kind': 'tr', 'spec': {'out': ['compact'], 'src': 'subs'}}))

    def test_save_reports_only_when_found(self):
        self.job.hs_save(self.ctx, None)
        self.assertEqual(json.loads((self.pd / 'hardsub.json').read_text()), {})
        self.assertEqual(self.reps, [])
        self.job.hs_save(self.ctx, {'z': [0.3, 0.8, 0.7, 0.9], 'sh': 0.5})
        self.assertEqual(self.reps, [{'hs': {'z': [0.3, 0.8, 0.7, 0.9], 'sh': 0.5}}])

    def test_probe_once_in_background(self):
        import threading
        src = self.pd / 'v.mp4'
        src.write_bytes(b'x')
        done, calls = threading.Event(), []
        orig = self.job.subprocess.run

        def fake_run(cmd, **k):
            calls.append(cmd)
            done.set()
            from types import SimpleNamespace
            return SimpleNamespace(returncode=0, stdout='log\n{"z": [0.3, 0.8, 0.7, 0.9], "sh": 0.4}\n')
        self.job.subprocess.run = fake_run
        try:
            self.assertTrue(self.job.hs_probe_bg(self.ctx, src))
            self.assertFalse(self.job.hs_probe_bg(self.ctx, src))                      # פעם אחת לעבודה
            done.wait(5)
            for _ in range(50):
                if self.reps:
                    break
                import time
                time.sleep(0.05)
        finally:
            self.job.subprocess.run = orig
        self.assertEqual(len(calls), 1)
        self.assertEqual(self.reps[0]['hs']['sh'], 0.4)
        self.assertTrue((self.pd / 'hardsub.json').exists())
        self.job._HS_RUN.clear()
        self.assertFalse(self.job.hs_probe_bg(self.ctx, src))                          # הקובץ קיים — לא שוב

    def test_full_fallback(self):
        (self.pd / 'burned.json').write_text(json.dumps(subs_video()))
        (self.pd / 'source.mp4').write_bytes(b'x')
        from vt import media
        orig = media.probe
        media.probe = lambda p: {'video': {'width': 1920, 'height': 1080}}
        try:
            d = self.job.hs_full(self.ctx)
            self.assertIsNotNone(d)
            self.assertEqual(len(self.reps), 1)
            self.assertIsNone(self.job.hs_full(self.ctx))                              # כבר נבדק
        finally:
            media.probe = orig

    def test_built_reports_check(self):
        self.assertIsNone(self.job.hs_built(self.ctx))
        (self.pd / 'out').mkdir()
        (self.pd / 'hardsub.json').write_text(json.dumps({'z': [0.3, 0.8, 0.7, 0.9], 'sh': 0.5}))
        (self.pd / 'out' / 'hide.json').write_text(json.dumps({'n': 120, 'lk': 2, 'ok': 1, 'ev': 9, 'z': [0.29, 0.8, 0.71, 0.9]}))
        self.assertEqual(self.job.hs_built(self.ctx), {'n': 120, 'lk': 2, 'ok': 1})
        self.assertEqual(self.reps[-1], {'hs': {'z': [0.29, 0.8, 0.71, 0.9], 'sh': 0.5, 'v': {'n': 120, 'lk': 2, 'ok': 1}}})

    def test_quiet_ctx_passes_hs(self):
        seen = []
        orig = self.job.Ctx.report
        self.job.Ctx.report = lambda self_, st=None, p=None, msg=None, force=False, **extra: seen.append(extra)
        try:
            q = object.__new__(self.job.QuietCtx)
            q.report('rv', 0.5, 'x')
            q.report(hs={'z': [0.3, 0.8, 0.7, 0.9]})
        finally:
            self.job.Ctx.report = orig
        self.assertEqual(seen, [{'hs': {'z': [0.3, 0.8, 0.7, 0.9]}}])


@unittest.skipUnless(os.environ.get('SNB_BURN_DIR') and B.available() and HAS_FF, 'המודלים של PP-OCRv3 (SNB_BURN_DIR) ו־ffmpeg')
class TestRealHide(unittest.TestCase):
    """מקצה לקצה עם הגלאי האמיתי (16/11/2026, "בודקים ומוודאים"): סרטון עם כתוביות באנגלית צרובות (שתי שורות, שורה
    מקצה לקצה, הבזק קצר) → זיהוי → הסתרה עם בדיקה → צריבה → בדיקה עצמאית על הקובץ הסופי, 5 פריימים לשנייה בשלב אחר."""

    def test_hidden_completely(self):
        import numpy as np
        from vt import media
        from vt.hebrew import Measurer
        from vt.sty import box_ass
        from vt.util import write_text
        f = str(C.FONTS_DIR / 'Arimo-Bold.ttf')
        subs = [('So what are we going to talk about', 0, 2.6, 'h-60'), ('First line of two', 3, 5.6, 'h-95'),
                ('and the second line', 3, 5.6, 'h-60'), ('A very long subtitle line that goes almost edge to edge of it', 6, 8.6, 'h-60'),
                ('Quick', 9.2, 9.6, 'h-60'), ('Then we moved on', 10.2, 11.6, 'h-60'), ('Last words here', 12.2, 13.6, 'h-60')]
        dt = ','.join(f"drawtext=fontfile={f}:text='{t}':fontsize=26:fontcolor=white:borderw=2:bordercolor=black:"
                      f"x=(w-tw)/2:y={y}:enable='between(t,{a},{b})'" for t, a, b, y in subs)
        with tempfile.TemporaryDirectory() as td:
            src, ass, out = Path(td) / 'v.mp4', Path(td) / 'he.ass', Path(td) / 'o.mp4'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', 'testsrc2=s=640x360:r=25:d=14',
                            '-vf', 'hue=s=0.3,' + dt, '-pix_fmt', 'yuv420p', str(src)], check=True)
            W, H = 640, 360
            bd = media.burn_scan(src)
            hs = B.hardsub(bd, W, H)
            self.assertIsNotNone(hs)
            style = apply_sty(STYLE, {'bx': 1}, hide=True)
            st = style.scaled(W, H)
            meas = Measurer(C.FONTS_DIR / style.font_file, st.size, st.spacing, st.outline)
            cues = [cue(1, 0.3, 2.4, ['אז על מה נדבר']), cue(2, 3.2, 5.4, ['שורה ראשונה', 'והשורה השנייה']), cue(3, 6.3, 8.0, ['שורה ארוכה'])]
            B.place(cues, B.without_subs(bd, W, H, hs['z']), st, meas, W, H)
            B.zone_lift(cues, hs['z'], st, H)
            base = box_ass(write_ass(cues, style, W, H, 't'))
            ev, res = B.hide(cues, bd, hs['z'], st, meas, W, H, lambda e: write_text(ass, B.cover_ass(base, e, W, H)),
                             lambda: media.hide_check(src, ass), dur=14.0)
            self.assertEqual(res['ok'], 1, res)
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src), '-vf',
                            f"subtitles={ass}:fontsdir={C.FONTS_DIR}", str(out)], check=True)
            fh = B.frame_height(W, H)
            n = B.W * fh * 3

            def frames(path):
                b = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-an', '-vf',
                                    f'fps=fps=5:start_time=0.1,scale={B.W}:{fh},format=rgb24', '-f', 'rawvideo', 'pipe:1'],
                                   capture_output=True, check=True).stdout
                return [np.frombuffer(b[i:i + n], np.uint8).reshape(fh, B.W, 3) for i in range(0, len(b) - n + 1, n)]
            d1, d2 = B.Detector(), B.Detector()
            chk = {'frames': []}
            for k, (a, b) in enumerate(zip(frames(out), frames(src))):
                t = round(0.1 + k / 5, 3)
                ba = d1.frame(a, t)
                if ba:
                    chk['frames'].append([t, ba, d2.frame(b, t)])
            self.assertEqual(B.leaks(chk, ev, cues, hs['z'], st, meas, W, H), [])


if __name__ == '__main__':
    unittest.main()
