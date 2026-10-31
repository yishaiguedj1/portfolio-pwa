"""קריוקי משיר רגיל (26/10/2026): המילים → שורות, עיגון לתמלול, תצוגה בשתי שורות, מצב לכל מילה, LRC."""
import re
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

from vt import karaoke as K  # noqa: E402


def asr_of(text, t0=5.0, step=0.5):
    return [{"w": w, "s": t0 + i * step, "e": t0 + i * step + 0.4} for i, w in enumerate(text.split())]


class Parse(unittest.TestCase):
    def test_sections_repeat_blank(self):
        lines = K.parse_lyrics("[Verse 1]\nHello darkness, my old friend\n\n(Chorus)\nI've come again (x2)\nOnce more ×3\n")
        self.assertEqual(lines[0], ["Hello", "darkness,", "my", "old", "friend"])
        self.assertEqual(lines[1:3], [["I've", "come", "again"]] * 2)
        self.assertEqual(lines[3:], [["Once", "more"]] * 3)

    def test_long_line_split(self):
        lines = K.parse_lyrics("And the vision that was planted in my brain, still remains within the sound of silence")
        self.assertGreater(len(lines), 1)
        self.assertTrue(all(sum(len(w) + 1 for w in ln) - 1 <= K.MAX_LINE_CHARS for ln in lines))

    def test_clean(self):
        self.assertEqual(K.clean_lyrics("a‏b\r\nc\x00"), "ab\nc")
        self.assertEqual(len(K.clean_lyrics("א" * 20000)), K.LYR_MAX)
        self.assertEqual(K.norm("שָׁלוֹם,"), "שלום")
        self.assertEqual(K.norm("Don't!"), "don't")


class Anchor(unittest.TestCase):
    def test_exact(self):
        lines = K.parse_lyrics("hello darkness my old friend")
        w = K.anchor(lines, asr_of("hello darkness my old friend"))
        self.assertEqual([x["s"] for x in w], [5.0, 5.5, 6.0, 6.5, 7.0])

    def test_missing_words_interpolated(self):
        lines = K.parse_lyrics("hello darkness my old friend")
        w = K.anchor(lines, [{"w": "hello", "s": 1.0, "e": 1.4}, {"w": "friend", "s": 4.0, "e": 4.5}])
        ss = [x["s"] for x in w]
        self.assertEqual(ss[0], 1.0)
        self.assertEqual(ss[-1], 4.0)
        self.assertTrue(all(a <= b for a, b in zip(ss, ss[1:])))
        self.assertTrue(1.4 <= ss[1] < ss[2] < ss[3] < 4.0)

    def test_before_after_anchors(self):
        lines = K.parse_lyrics("oh yeah hello world la la")
        w = K.anchor(lines, [{"w": "hello", "s": 10.0, "e": 10.4}, {"w": "world", "s": 10.5, "e": 11.0}])
        self.assertLess(w[0]["s"], w[1]["s"])
        self.assertLessEqual(w[1]["e"], 10.0)
        self.assertGreaterEqual(w[4]["s"], 11.0)

    def test_no_anchor_spread(self):
        lines = K.parse_lyrics("a b c d")
        w = K.anchor(lines, [{"w": "zzz", "s": 0, "e": 40.0}])
        self.assertEqual(w[0]["s"], 0)
        self.assertTrue(all(x["e"] > x["s"] for x in w))


class Layout(unittest.TestCase):
    def setUp(self):
        lines = K.parse_lyrics("one two three\nfour five six\nseven eight nine")
        asr = asr_of("one two three four five six", 2.0, 0.5) + asr_of("seven eight nine", 20.0, 0.5)
        self.lines = K.timed_lines(K.anchor(lines, asr))
        self.shown = K.layout(self.lines)

    def test_rows_and_timing(self):
        self.assertEqual([x["row"] for x in self.shown], [0, 1, 0])
        for ln, sh in zip(self.lines, self.shown):
            self.assertLessEqual(sh["show"], ln["s"] - K.LEAD_S + 1e-9)
            self.assertGreater(sh["hide"], ln["e"])
        self.assertTrue(self.shown[2]["cd"])                # שקט ארוך לפני השורה השלישית — נקודות
        self.assertFalse(self.shown[1]["cd"])

    def test_events_per_word(self):
        ev = K.events(self.shown)
        first = [e for e in ev if e[2] == 0]
        self.assertEqual([e[3] for e in first], [-1, 0, 1, 2])
        for a, b, *_ in ev:
            self.assertLess(a, b)

    def test_ass_and_rtl(self):
        from vt import config as C
        ass = K.write_ass(self.shown, C.STYLES["bold"], 1920, 1080, "T")
        self.assertIn(K.SUNG, ass)
        self.assertNotIn("\\k", ass)                          # מצב לכל מילה, לא \k (ראו בראש vt/karaoke.py)
        self.assertIn("●", ass)
        heb = K.parse_lyrics("שלום עולם זה שיר")
        self.assertTrue(K.is_rtl(heb))
        self.assertFalse(K.is_rtl(K.parse_lyrics("hello world")))

    def test_lrc(self):
        lrc = K.write_lrc(self.lines, "T")
        self.assertTrue(lrc.startswith("[ti:T]\n[00:02.00]one two three"))
        e = K.write_lrc(self.lines, enhanced=True)
        self.assertIn("<00:02.50>two", e)


if __name__ == "__main__":
    unittest.main()


class Flow(unittest.TestCase):
    """job.py karaoke מקצה לקצה: ההפרדה והיישור מדומים (בלי מודלים), השאר אמיתי — build, רקע, צריבה ב־vt, מיקס, העלאה."""

    def test_flow(self):
        import json
        import os
        import shutil
        import subprocess
        import tempfile
        if not shutil.which('ffmpeg'):
            self.skipTest('בלי ffmpeg')
        try:
            import vt.render  # noqa: F401
        except Exception:                                   # noqa: BLE001
            self.skipTest('בלי סביבת vt')
        tmp = Path(tempfile.mkdtemp())
        old = {k: os.environ.get(k) for k in ('VT_WORK', 'SNB_STATE')}

        def restore():
            for k, v in old.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v
            import importlib as il
            import job as JJ
            il.reload(JJ)                                   # בלי השינויים של הבדיקה — לבדיקות אחרות באותו תהליך
            shutil.rmtree(tmp, ignore_errors=True)
        self.addCleanup(restore)
        os.environ['VT_WORK'] = str(tmp / 'w')
        os.environ['SNB_STATE'] = str(tmp / 's')
        import importlib
        import job as J
        importlib.reload(J)
        J.VT_PY = sys.executable
        song = tmp / 'song.mp3'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'lavfi', '-i', 'sine=f=440:d=8', '-ac', '2', str(song)], check=True)
        reports, outs = [], []

        class C:
            def report(self, st=None, p=None, msg=None, force=False, **kw):
                reports.append((st, kw))

            def event(self, *a):
                pass
        ctx = C()
        ctx.st = {'job': 'jtest1234', 'spec': {'name': 'Song.mp3', 'ka': 1, 'lyr': 'one two three\nfour five six', 'gv': 20,
                                               'out': ['compact']}, 'files': {'v': {'id': 'R2_x_aaaaaaaaaaaa', 'name': 'Song.mp3', 'size': 1}}}
        ctx.name = 'jtest1234'
        real_script = J.script

        def fake_script(c, path, args, stage, lo=0.0, hi=1.0, prog=None):
            if args[0] == 'sep':
                out = Path(args[args.index('--out') + 1])
                for n in ('voc.wav', 'inst.wav'):
                    shutil.copy(Path(args[args.index('--src') + 1]), out / n)
                return []
            if args[0] == 'align':
                lines = K.parse_lyrics(Path(args[args.index('--lyrics') + 1]).read_text(encoding='utf-8'))
                words = K.anchor(lines, asr_of('one two three four five six', 1.0, 0.8))
                Path(args[args.index('--out') + 1]).write_text(json.dumps({'words': words}), encoding='utf-8')
                return []
            return real_script(c, path, args, stage, lo, hi, prog)
        J.script = fake_script
        J.Ctx = lambda st: ctx
        J.load_state = lambda: ctx.st
        J.url_fetch = lambda c: None
        J.ensure_env = lambda c, st='tr': None
        J.vt_env = lambda: dict(os.environ, PYTHONPATH=str(HERE))
        J.fetch_input = lambda c, fid, dest, size, cb=None: (Path(dest).parent.mkdir(parents=True, exist_ok=True), shutil.copy(song, dest))
        J.put_output = lambda c, p, name, k, mime, cb=None: (outs.append((k, name, Path(p).stat().st_size)), 'R2_x_' + k.ljust(12, 'z'))[1]
        rc = J.karaoke.__wrapped__(None) if hasattr(J.karaoke, '__wrapped__') else J.karaoke(None)
        self.assertEqual(rc, 0)
        kinds = [k for k, _, _ in outs]
        self.assertEqual(kinds, ['compact', 'inst', 'lrc', 'elrc', 'ass'])
        self.assertTrue(all(s > 0 for _, _, s in outs))
        self.assertTrue(any(kw.get('done') for _, kw in reports))
        self.assertEqual(outs[0][1], 'Song (קריוקי).mp4')


class Design(unittest.TestCase):
    """31/10/2026: עיצוב הקריוקי (ת־קריוקי) — דואט, מילוי מימין לשמאל, כרטיס פתיחה, נגינה, הכהיה, רקע."""

    def _shown(self, txt, gap=9.0, start=5.0):
        lines = K.parse_lyrics(txt)
        words, t = [], start
        for li, ln in enumerate(lines):
            for w in ln:
                words.append({"w": w, "li": li, "s": t, "e": t + 0.4})
                t += 0.5
            t += gap if li == 1 else 1.0
        tl = K.timed_lines(words)
        K.assign_singers(tl, K.parse_singers(txt))
        return K.layout(tl)

    def test_singers(self):
        txt = "[1]\nשורה ראשונה כאן\n[זמר 2] שורה שנייה כאן\n[Chorus]\nעוד שורה\n[ביחד]\nכולם שרים\n(both) together now"
        self.assertEqual(K.parse_lyrics(txt), [["שורה", "ראשונה", "כאן"], ["שורה", "שנייה", "כאן"], ["עוד", "שורה"],
                                               ["כולם", "שרים"], ["together", "now"]])
        self.assertEqual(K.parse_singers(txt), [1, 2, 2, 0, 0])
        self.assertEqual(K.parse_singers("just one singer\nno tags"), [])

    def test_norm_ky(self):
        d = K.norm_ky({"u": "#abcdef", "c": "red", "f": "d", "z": "L", "cd": 0, "dm": 7, "bg": "x", "sg": ["#000000"], "evil": 1})
        self.assertEqual(d["u"], "#ABCDEF")
        self.assertEqual(d["c"], K.KY_DEF["c"])
        self.assertEqual((d["f"], d["z"], d["cd"], d["tc"], d["dm"], d["bg"]), ("d", "L", 0, 1, 1, "dark"))
        self.assertEqual(d["sg"], ["#000000"] + K.KY_DEF["sg"][1:])
        self.assertNotIn("evil", d)
        self.assertEqual(K.norm_ky(None), K.norm_ky({}))
        self.assertEqual(K.ass_colour("#FFC83D"), K.SUNG)

    def test_wipe_rtl_duet(self):
        from vt import config as C
        sh = self._shown("[1]\nהלילה יורד לאט\n[2] ואני שר לך\n[ביחד]\nכל האורות כבים", start=8.0)
        st = K.states(sh, True)
        mid = [x for x in st if 0 < x[4] < 1]
        self.assertTrue(mid)                                  # מצבים באמצע מילה
        ass = K.write_ass(sh, C.STYLES["bold"], 1920, 1080, "שיר", True, {"sg": ["#00FF00", "#0000FF"]}, True)
        self.assertNotIn("\\k", ass)
        clips = re.findall(r"\\clip\((\d+),\d+,(\d+),\d+\)", ass)
        self.assertTrue(clips)
        self.assertTrue(all(int(b) == 1920 for a, b in clips))   # מימין לשמאל: הקצה הימני קבוע
        self.assertIn("\\c&H0000FF00", ass)                   # זמר 1
        self.assertIn("\\c&H00FF0000", ass)                   # זמר 2
        self.assertIn("Style: Tag", ass)
        self.assertIn("}1+2", ass)                            # סמן "ביחד"
        self.assertIn("נגינה", ass)                           # הפסקה של 9 שנ'
        self.assertIn("\\p1", ass)                            # הכהיה
        self.assertIn("}‏שיר", ass)                           # כרטיס פתיחה (השורה הראשונה אחרי 1.5 שנ')
        for ln in ass.splitlines():
            if ln.startswith("Dialogue:"):
                self.assertIn("\\an2", ln)                    # הצריבה המהירה — רק רצועת הכתוביות
                self.assertIn("\\pos(", ln)

    def test_ltr_word_mode_options(self):
        from vt import config as C
        sh = self._shown("hello there my friend\nsing it now")
        ass = K.write_ass(sh, C.STYLES["bold"], 1920, 1080, "", False, {"f": "w"}, False)
        clips = re.findall(r"\\clip\((\d+),\d+,(\d+),\d+\)", ass)
        self.assertTrue(clips and all(a == "0" for a, b in clips))   # משמאל לימין: הקצה השמאלי קבוע
        self.assertNotIn("\\p1", ass)                         # בלי וידאו — בלי הכהיה
        self.assertNotIn("Instrumental", ass)
        w = K.write_ass(sh, C.STYLES["bold"], 1920, 1080, "T", False, {"f": "d", "cd": 0, "tc": 0}, True)
        self.assertNotIn("\\clip", w)
        self.assertNotIn("●", w)
        self.assertEqual(len(K.states(sh, False)), len(K.events(sh)))

    def test_bg(self):
        for bg in ("dark", "grad", "tint"):
            b = K.bg_ppm({"bg": bg}, 48, 27)
            self.assertTrue(b.startswith(b"P6 48 27 255\n"))
            self.assertEqual(len(b), len(b"P6 48 27 255\n") + 48 * 27 * 3)


class Autocast(unittest.TestCase):
    """31/10/2026: autocast (bfloat16) רק במעבד שתומך בו בחומרה; SNB_KA_AUTOCAST גובר."""
    def test_flags(self):
        import os
        import karaoke as KA
        old = os.environ.pop('SNB_KA_AUTOCAST', None)
        try:
            self.assertFalse(KA.autocast_ok('flags : fpu avx2 avx512f'))
            self.assertTrue(KA.autocast_ok('flags : fpu avx512f avx512_bf16'))
            self.assertTrue(KA.autocast_ok('flags : fpu amx_bf16 amx_tile'))
            os.environ['SNB_KA_AUTOCAST'] = '1'
            self.assertTrue(KA.autocast_ok('flags : fpu'))
            os.environ['SNB_KA_AUTOCAST'] = '0'
            self.assertFalse(KA.autocast_ok('flags : avx512_bf16'))
        finally:
            os.environ.pop('SNB_KA_AUTOCAST', None)
            if old is not None:
                os.environ['SNB_KA_AUTOCAST'] = old
