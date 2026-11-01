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

        seps, lyrs = [], []

        def fake_script(c, path, args, stage, lo=0.0, hi=1.0, prog=None):
            if args[0] == 'sep':
                seps.append(1)
                out = Path(args[args.index('--out') + 1])
                for n in ('voc.wav', 'inst.wav'):
                    shutil.copy(Path(args[args.index('--src') + 1]), out / n)
                (out / 'sep.json').write_text('{"model": "m", "sec": 1}', encoding='utf-8')   # כמו karaoke.py sep
                return []
            if args[0] == 'lyrics':                     # 01/11/2026: התמלול האוטומטי — כאן טיוטה קבועה
                lyrs.append(args[args.index('--lang') + 1])
                Path(args[args.index('--out') + 1]).write_text('one two three\nfour five six\n', encoding='utf-8')
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
        # 31/10/2026: אותו שיר שוב — ההפרדה מהמטמון (לא נקראת שוב), והתוצרים זהים
        outs.clear()
        rc = J.karaoke.__wrapped__(None) if hasattr(J.karaoke, '__wrapped__') else J.karaoke(None)
        self.assertEqual(rc, 0)
        self.assertEqual(len(seps), 1)
        self.assertEqual([k for k, _, _ in outs], kinds)
        self.assertEqual(len([d for d in J.KA_CACHE.iterdir() if d.is_dir()]), 1)
        # 01/11/2026: בלי מילים — תמלול אוטומטי (al), טיוטת המילים עולה כתוצר, וההודעה אומרת את זה
        outs.clear()
        reports.clear()
        ctx.st['spec'] = dict(ctx.st['spec'], lyr='', al='he')
        rc = J.karaoke.__wrapped__(None) if hasattr(J.karaoke, '__wrapped__') else J.karaoke(None)
        self.assertEqual(rc, 0)
        self.assertEqual(lyrs, ['he'])
        self.assertEqual([k for k, _, _ in outs], kinds + ['lyr'])
        self.assertTrue(outs[-1][1].endswith('(מילים — תמלול אוטומטי).txt'))
        self.assertEqual(J.ka_spec({'lyr': 'x', 'al': 'he'})['al'], '')
        self.assertEqual(J.ka_spec({'lyr': '', 'al': 'fr'})['al'], '')


class Draft(unittest.TestCase):
    """01/11/2026: טיוטת מילים מתמלול — שבירת שורות, ניקוי, לולאות של המודל, והורדת "מילים" בשקט."""

    def test_lines(self):
        ws = [{"w": " שלום", "s": 0, "e": 0.3}, {"w": "עולם.", "s": 0.35, "e": 0.7}, {"w": "מה", "s": 0.75, "e": 0.9},
              {"w": "נשמע?", "s": 2.0, "e": 2.4}] + [{"w": "לה", "s": 2.5 + i * 0.2, "e": 2.6 + i * 0.2} for i in range(6)]
        self.assertEqual(K.draft_lines(ws), ["שלום עולם מה", "נשמע לה לה לה"])
        long = [{"w": f"w{i}", "s": i * 0.3, "e": i * 0.3 + 0.2} for i in range(20)]
        self.assertTrue(all(len(x.split()) <= K.DRAFT_MAXW for x in K.draft_lines(long)))
        self.assertEqual(K.draft_lines([{"w": "...", "s": 0, "e": 1}]), [])

    def test_gate(self):
        import numpy as np
        sr = 16000
        a = np.zeros(sr * 4, np.float32)
        a[: sr * 2] = 0.3 * np.sin(np.arange(sr * 2) * 0.05)       # שירה בשתי השניות הראשונות, אחר כך שקט
        ws = [{"w": "a", "s": 0.5, "e": 0.9}, {"w": "b", "s": 3.0, "e": 3.4}]
        self.assertEqual([w["w"] for w in K.gate(ws, a, sr)], ["a"])


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



class AutoSingers(unittest.TestCase):
    """31/10/2026: זיהוי הזמרים בלי סימון במילים — טביעת קול מזויפת (לפי עוצמת הקטע), השרשרת של diarize.assign אמיתית."""

    class Emb:
        def __call__(self, x):
            import numpy as np
            loud = float(np.abs(x).mean()) > 0.2
            rng = np.random.default_rng(int(x.size) % 97)
            v = (np.r_[0.0, 1.0] if loud else np.r_[1.0, 0.0]).repeat(8) + rng.normal(0, 0.05, 16)
            return v / np.linalg.norm(v)

    def run_song(self, amps):
        import types
        from unittest import mock
        import numpy as np
        sr, lines, sig = 16000, [], []
        for li, a in enumerate(amps):                  # שורה = 8 מילים של 0.9 שנ׳ + שנייה שקט
            t0 = li * 9.0
            lines.append({"li": li, "words": [{"w": f"w{li}{k}.", "s": t0 + k, "e": t0 + k + 0.9} for k in range(8)]})
            sig.append(np.full(int(8 * sr), a, np.float32))
            sig.append(np.zeros(sr, np.float32))
        audio = np.concatenate(sig)
        sf = types.SimpleNamespace(read=lambda p, dtype=None: (audio, sr))   # בלי soundfile בסביבת הבדיקות
        with mock.patch.dict(sys.modules, {"soundfile": sf}):
            return K.auto_singers(lines, "v.wav", self.Emb())

    def test_duet(self):
        self.assertEqual(self.run_song([0.1] * 4 + [0.5] * 4 + [0.1] * 2), [1, 1, 1, 1, 2, 2, 2, 2, 1, 1])

    def test_solo_and_weak_singer(self):
        self.assertEqual(self.run_song([0.1] * 8), [])
        self.assertEqual(self.run_song([0.1] * 9 + [0.5]), [])     # שורה אחת בקול אחר — פחות מהמינימום → זמר אחד

    def test_failure_is_one_colour(self):
        def boom(*a, **k):
            raise OSError("no file")
        import types
        from unittest import mock
        with mock.patch.dict(sys.modules, {"soundfile": types.SimpleNamespace(read=boom)}):
            self.assertEqual(K.auto_singers([{"li": 0, "words": [{"w": "a", "s": 0, "e": 1}]}], "x.wav", self.Emb()), [])

    def test_script_marked_lyrics_win(self):
        import os
        import tempfile
        import types
        from unittest import mock
        import karaoke as KA
        with tempfile.TemporaryDirectory() as d:
            lyr = Path(d) / "l.txt"
            a = types.SimpleNamespace(lyrics=str(lyr), voc="v.wav")
            words = [{"w": "a", "li": 0, "s": 0.0, "e": 1.0}]
            with mock.patch.object(K, "auto_singers", return_value=[1, 2]) as au:
                lyr.write_text("[1]\nשלום\n[2]\nעולם\n", encoding="utf-8")
                self.assertEqual(KA.singers(a, words), [])            # יש סימון — build לוקח ממנו
                lyr.write_text("שלום\nעולם\n", encoding="utf-8")
                self.assertEqual(KA.singers(a, words), [1, 2])
                with mock.patch.dict(os.environ, {"SNB_KA_SG": "0"}):
                    self.assertEqual(KA.singers(a, words), [])
                self.assertEqual(au.call_count, 1)


class SepCache(unittest.TestCase):
    """31/10/2026: מטמון ההפרדה — מפתח לפי תוכן ומצב, לכל היותר KA_CACHE_N שירים ו־KA_CACHE_TTL."""
    def test_cache(self):
        import os
        import shutil
        import tempfile
        import time
        import job as J
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, True)
        old = J.KA_CACHE
        J.KA_CACHE = tmp / 'c'
        self.addCleanup(setattr, J, 'KA_CACHE', old)
        a, b = tmp / 'a.wav', tmp / 'b.wav'
        a.write_bytes(b'x' * 100)
        b.write_bytes(b'y' * 100)
        self.assertNotEqual(J.ka_cache_key(a, False), J.ka_cache_key(a, True))       # עם/בלי קולות רקע — הפרדה אחרת
        self.assertNotEqual(J.ka_cache_key(a, False), J.ka_cache_key(b, False))
        self.assertEqual(J.ka_cache_key(a, False), J.ka_cache_key(a, False))
        w = tmp / 'w'
        w.mkdir()
        self.assertFalse(J.ka_cache_get('k0', w))
        for n in ('voc.wav', 'inst.wav', 'sep.json'):
            (w / n).write_text(n)
        for i in range(J.KA_CACHE_N + 2):
            J.ka_cache_put('k' + str(i), w)
            os.utime(J.KA_CACHE / ('k' + str(i)), (time.time() - 100 + i, time.time() - 100 + i))
        J.ka_cache_prune()
        self.assertEqual(len(list(J.KA_CACHE.iterdir())), J.KA_CACHE_N)              # הישנים ביותר נמחקו
        self.assertFalse((J.KA_CACHE / 'k0').exists())
        w2 = tmp / 'w2'
        w2.mkdir()
        self.assertTrue(J.ka_cache_get('k5', w2))
        self.assertEqual((w2 / 'voc.wav').read_text(), 'voc.wav')
        self.assertFalse((w2 / 'inst_bv.wav').exists())
        J.ka_cache_prune(time.time() + J.KA_CACHE_TTL + 200)                          # תפוגה
        self.assertEqual(list(J.KA_CACHE.iterdir()), [])


class SepProgress(unittest.TestCase):
    """31/10/2026 (הצילום: הפס מלא 20+ דק׳ במצב קולות רקע): שני מעברים = פס אחד משוקלל, לא 0–100% פעמיים."""
    def test_two_passes(self):
        import job as J
        p = J.KaSepProg()
        self.assertIsNone(p.feed('⏩ מעברים: 2.75,3.60'))
        w1 = 2.75 / 6.35
        self.assertAlmostEqual(p.feed(' 50%|#####     | 5/10'), 0.5 * w1, places=3)
        self.assertAlmostEqual(p.feed('100%|##########| 10/10'), w1, places=3)
        self.assertAlmostEqual(p.feed('⏱ vocals_mel_band_roformer.ckpt: 600 שנ׳'), w1, places=3)
        self.assertAlmostEqual(p.feed('  0%|          | 0/12'), w1, places=3)        # המעבר השני מתחיל — לא חוזר ל־0
        self.assertAlmostEqual(p.feed(' 50%|#####     | 6/12'), w1 + 0.5 * (1 - w1), places=3)
        self.assertAlmostEqual(p.feed('⏱ bs_roformer_karaoke_anvuew.ckpt: 800 שנ׳'), 1.0, places=3)
        self.assertIsNone(p.feed('ללא אחוזים'))

    def test_one_pass(self):
        import job as J
        p = J.KaSepProg()
        p.feed('⏩ מעברים: 3.60')
        self.assertAlmostEqual(p.feed(' 40%|####'), 0.4, places=3)

    def test_marker_from_sep(self):
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            calls, _ = SepModes.run_sep(self, {'SNB_KA_BV1': '0'})
        self.assertIn('⏩ מעברים: 2.75,3.60', buf.getvalue())


class SepModes(unittest.TestCase):
    """31/10/2026: overlap ו"עם קולות רקע" במעבר אחד (SNB_KA_OV / SNB_KA_BV1) — בלי מודלים, separate מדומה."""
    def run_sep(self, env, backing=True):
        import argparse
        import os
        import shutil
        import tempfile
        import karaoke as KA
        tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, tmp, True)
        calls = []

        def fake(src, out, model, prefix):
            calls.append((Path(src).name, model))
            (out / (prefix + '_voc.wav')).write_text('v:' + model)
            (out / (prefix + '_inst.wav')).write_text('i:' + model)
            return {'model': model, 'sec': 1.0, 'ac': 0, 'ov': KA.sep_overlap()}
        old = {k: os.environ.get(k) for k in ('SNB_KA_OV', 'SNB_KA_BV1')}
        sv = (KA.separate, KA.sep_ready, KA.subprocess.run)
        KA.separate, KA.sep_ready = fake, lambda m='': True
        KA.subprocess.run = lambda cmd, check=True: Path(cmd[-1]).write_text('mix')
        os.environ.update(env)
        try:
            src = tmp / 'song.wav'
            src.write_text('s')
            KA.cmd_sep(argparse.Namespace(src=str(src), out=str(tmp / 'o'), model='', kmodel='', backing=backing))
            return calls, tmp / 'o'
        finally:
            KA.separate, KA.sep_ready, KA.subprocess.run = sv
            for k, v in old.items():
                os.environ.pop(k, None) if v is None else os.environ.__setitem__(k, v)

    def test_one_pass(self):
        import json
        import karaoke as KA
        calls, o = self.run_sep({'SNB_KA_BV1': '1'})
        self.assertEqual(calls, [('song.wav', KA.KAR_DEFAULT)])                     # מעבר אחד, על השיר עצמו
        self.assertEqual((o / 'voc.wav').read_text(), 'v:' + KA.KAR_DEFAULT)        # הקול הראשי — ליישור ולקול המנחה
        self.assertTrue((o / 'lead.wav').exists() and (o / 'inst_bv.wav').exists() and not (o / 'inst.wav').exists())
        self.assertEqual(json.loads((o / 'sep.json').read_text())['one'], 1)

    def test_two_pass(self):
        import karaoke as KA
        calls, o = self.run_sep({'SNB_KA_BV1': '0'})
        self.assertEqual(calls, [('song.wav', KA.SEP_DEFAULT), ('voc.wav', KA.KAR_DEFAULT)])
        self.assertTrue((o / 'inst.wav').exists() and (o / 'inst_bv.wav').exists() and (o / 'lead.wav').exists())
        calls, o = self.run_sep({'SNB_KA_BV1': '1'}, backing=False)                  # בלי קולות רקע — תמיד Kim
        self.assertEqual(calls, [('song.wav', KA.SEP_DEFAULT)])

    def test_overlap(self):
        import os
        import karaoke as KA
        old = os.environ.pop('SNB_KA_OV', None)
        try:
            self.assertEqual(KA.sep_overlap(), KA.OV_DEFAULT)
            os.environ['SNB_KA_OV'] = '1'
            self.assertEqual(KA.sep_overlap(), 1)
            os.environ['SNB_KA_OV'] = '9'
            self.assertEqual(KA.sep_overlap(), KA.OV_DEFAULT)
        finally:
            os.environ.pop('SNB_KA_OV', None)
            if old is not None:
                os.environ['SNB_KA_OV'] = old


class Relevel(unittest.TestCase):
    """01/11/2026: audio-separator מנרמל כל פלט לחוד — relevel מחזיר קול וליווי לרמת השיר, ב־float (שיא מעל 1 נשמר)."""
    def test_gains(self):
        try:
            import numpy as np
        except ImportError:
            self.skipTest('numpy')
        import sys
        from types import SimpleNamespace
        from unittest import mock
        import karaoke as KA
        rng = np.random.default_rng(1)
        v, i = rng.normal(0, .3, (44100 * 2, 2)), rng.normal(0, .5, (44100 * 2, 2))
        fs = {'s': v + i, 'a': v * 0.7, 'b': i * 0.6}                 # כמו אחרי הנרמול של audio-separator
        wr = {}
        sf = SimpleNamespace(read=lambda p, dtype=None, always_2d=True: (fs[p], 44100),
                             write=lambda p, x, sr, subtype=None: wr.__setitem__(p, (x, subtype)))
        with mock.patch.dict(sys.modules, {'soundfile': sf}):
            g = KA.relevel(Path('s'), Path('a'), Path('b'))
        self.assertAlmostEqual(g[0], 1 / 0.7, places=2)
        self.assertAlmostEqual(g[1], 1 / 0.6, places=2)
        self.assertEqual(wr['a'][1], 'FLOAT')
        self.assertTrue(np.allclose(wr['a'][0] + wr['b'][0], fs['s'], atol=1e-3))   # הסכום = השיר, באותה עוצמה
        fs['b'] = np.zeros_like(i)                                       # ליווי שקט — לא מחלקים באפס, לא מנפחים
        with mock.patch.dict(sys.modules, {'soundfile': sf}):
            g = KA.relevel(Path('s'), Path('a'), Path('b'))
        self.assertEqual(g[1], 1.0)


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
