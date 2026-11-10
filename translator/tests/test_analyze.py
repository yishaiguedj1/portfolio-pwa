"""ניתוח סרטונים — המתזמר והשלבים הכבדים (translator/analyze.py, ‏vt/vi.py; גל 0, PR 0.2).

| מה | איך |
|---|---|
| חלקי הבנייה (יחידות הראיה, המלאים, "רק על המסך", מועמדי הגבול, הכתוביות, החלונות, vi.json) | על נתונים סינתטיים |
| שומר הזיכרון | עם דגימות מדומות |
| שלב המסך | עם גלאי ו־OCR מדומים, על סרטון אמיתי ש־ffmpeg מייצר |
| vi_run כולו | עם job מדומה — בלי מודלים, בלי רשת ובלי Claude |

מוקים בלבד."""
import io
import json
import re
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import analyze as A  # noqa: E402
from vt import vi as VI  # noqa: E402

HAS_FF = bool(shutil.which("ffmpeg") and shutil.which("ffprobe"))


def W(w, s, e, **k):
    return dict({"w": w, "s": s, "e": e}, **k)


def png(w=1920, h=1080, color=255):
    from PIL import Image
    buf = io.BytesIO()
    Image.new("L", (w, h), color).save(buf, format="PNG")
    return buf.getvalue()


class TestEvidence(unittest.TestCase):
    def test_sentence_pause_speaker(self):
        ws = [W("Hello", 0.0, 0.4, spk="S1", p=0.9), W("world.", 0.5, 3.2, spk="S1", p=0.7),
              W("Next", 3.3, 3.6, spk="S1"), W("part", 3.7, 4.0, spk="S1"),
              W("after", 5.5, 5.9, spk="S1"),                       # שקט של 1.5 שנ׳
              W("other", 6.0, 6.3, spk="S2")]                       # דובר אחר
        ev = A.evidence(ws)
        self.assertEqual([u["text"] for u in ev], ["Hello world.", "Next part", "after", "other"])
        self.assertEqual([u["id"] for u in ev], ["e1", "e2", "e3", "e4"])
        self.assertEqual((ev[0]["w0"], ev[0]["w1"], ev[0]["spk"], ev[0]["conf"]), (0, 1, "S1", 0.8))
        self.assertEqual((ev[0]["t0"], ev[0]["t1"]), (0.0, 3.2))
        self.assertEqual(ev[3]["spk"], "S2")
        self.assertNotIn("conf", ev[1])

    def test_short_sentence_not_closed_and_max(self):
        ws = [W("Hi.", 0, 0.3), W("there", 0.35, 0.7)]
        self.assertEqual(len(A.evidence(ws)), 1, "משפט קצר מ־UNIT_MIN_S לא נסגר בגלל נקודה")
        long = [W("w%d" % i, i * 0.5, i * 0.5 + 0.4) for i in range(80)]   # 40 שנ׳ בלי פיסוק ובלי שקט
        ev = A.evidence(long)
        self.assertGreaterEqual(len(ev), 2)
        self.assertTrue(all(u["t1"] - u["t0"] <= A.UNIT_MAX_S for u in ev))
        self.assertEqual(ev[1]["w0"], ev[0]["w1"] + 1, "טווחי המילים רצופים")
        self.assertEqual(A.evidence([]), [])

    def test_coarse_marked(self):
        ev = A.evidence([W("שלום", 0, 1, c=1), W("לכולם", 1, 2, c=1)])
        self.assertEqual(ev[0]["ts"], "seg")


SCREEN = {"units": [
    {"id": "s1", "t0": 0, "t1": 9, "kind": "cam", "states": [{"t0": 0}]},
    {"id": "s2", "t0": 10, "t1": 40, "kind": "slide",
     "states": [{"id": "s2.1", "t0": 10, "t1": 20, "frame_t": 15, "rel": "new"}, {"id": "s2.2", "t0": 20, "t1": 40, "frame_t": 30, "rel": "reveal"}],
     "img": {"o": 0, "l": 100, "w": 1280, "h": 720},
     "ocr": {"lines": [
         {"text": "Gradient descent", "conf": 93, "lang": "en", "dir": "ltr", "box": [80, 40, 400, 50]},
         {"text": "Gradient descent converges quickly", "conf": 90, "lang": "en", "dir": "ltr", "box": [80, 200, 600, 40]},
         {"text": "Learning rate schedule warmup", "conf": 88, "lang": "en", "dir": "ltr", "box": [80, 300, 600, 40]},
         {"text": "והמודל לומד מהנתונים", "conf": 85, "lang": "he", "dir": "rtl", "box": [80, 400, 600, 40]},
         {"text": "noise words appear here", "conf": 40, "lang": "en", "dir": "ltr", "box": [80, 500, 600, 40]}]}},
    {"id": "s3", "t0": 300, "t1": 360, "kind": "slide",
     "states": [{"id": "s3.1", "t0": 300, "t1": 360, "frame_t": 330, "rel": "new"}],
     "img": {"o": 100, "l": 50, "w": 1280, "h": 720},
     "ocr": {"lines": [], "words": 0, "conf": 0, "error": "tesseract (1): x"}}]}


class TestScreen(unittest.TestCase):
    def test_slides_doc(self):
        sl, ocr = A.slides_doc(SCREEN)
        self.assertEqual([s["id"] for s in sl], ["s1", "s2"], "רק שקפים, מספור מחדש")
        self.assertEqual(sl[0]["states"], [{"k": 0, "t0": 10.0}, {"k": 1, "t0": 20.0}])
        self.assertEqual(sl[0]["img"], {"o": 0, "l": 100, "w": 1280, "h": 720})
        self.assertEqual(sl[0]["ocr"], ["o1.1", "o1.2", "o1.3", "o1.4", "o1.5"])
        self.assertEqual(sl[1].get("oerr"), 1)
        self.assertEqual(ocr[3]["dir"], "rtl")

    def test_screen_only(self):
        sl, ocr = A.slides_doc(SCREEN)
        ws = [W("so", 12, 12.2), W("the", 12.3, 12.4), W("gradient", 12.5, 13), W("descent", 13.1, 13.6),
              W("המודל", 14, 14.4), W("לומד", 14.5, 14.9), W("נתונים", 15, 15.5),
              W("warmup", 200, 200.5)]                                    # מחוץ לחלון של השקף
        n = A.screen_only(sl, ocr, ws)
        self.assertEqual(sl[0]["so"], ["o1.3"], "רק השורה שלא נאמרה; ביטחון נמוך ושורה קצרה — לא נבדקות")
        self.assertEqual(n, 1)

    def test_tokens_and_variants(self):
        self.assertEqual(A.tokens("The Gradient, of DESCENT!"), ["gradient", "descent"])
        self.assertEqual(A.tokens("שָׁלוֹם"), ["שלום"])
        self.assertEqual(A.variants("והמודל"), {"והמודל", "המודל"})
        self.assertEqual(A.variants("model"), {"model"})


class TestInventories(unittest.TestCase):
    def test_all_kinds(self):
        ev = [{"id": "e1", "text": "So the accuracy rose to 93.5% in 2024 according to Smith et al. 2020."},
              {"id": "e2", "text": "OpenAI and the GPU team. See https://example.org/paper for details, so read it."},
              {"id": "e3", "text": "OpenAI said 3 things. Is that right?"}]
        code = [{"text": "def train(model):", "conf": 80, "lang": "en", "dir": "ltr", "box": [0, 10, 100, 20]},
                {"text": "return loss.backward()", "conf": 80, "lang": "en", "dir": "ltr", "box": [0, 40, 100, 20]}]
        scr = {"units": [{"kind": "slide", "t0": 0, "t1": 5, "states": [{"t0": 0}], "ocr": {"lines": code}}]}
        sl, ocr = A.slides_doc(scr)
        inv = A.inventories(ev, sl, ocr)
        nums = [x["v"] for x in inv["num"]]
        self.assertIn("93.5%", nums)
        self.assertIn("2024", nums)
        self.assertNotIn("3", nums, "ספרה בודדת — לא מספר לכיסוי")
        refs = [x["v"] for x in inv["ref"]]
        self.assertIn("https://example.org/paper", refs)
        self.assertTrue(any(r.startswith("Smith et al") for r in refs), refs)
        ents = {x["v"]: x["ev"] for x in inv["ent"]}
        self.assertEqual(ents.get("OpenAI"), ["e2", "e3"])
        self.assertIn("GPU", ents)
        self.assertNotIn("So", ents, "מילה שמופיעה גם באותיות קטנות — תחילת משפט, לא שם")
        self.assertEqual(inv["q"], [{"v": "OpenAI said 3 things. Is that right?", "ev": ["e3"]}])
        self.assertEqual(inv["term"][0]["v"], "def train(model):")
        self.assertEqual(inv["code"][0]["ev"][0], "s1")

    def test_bounds(self):
        ev = [{"id": "e1", "t0": 0, "t1": 5}, {"id": "e2", "t0": 5.5, "t1": 9}, {"id": "e3", "t0": 12, "t1": 15},
              {"id": "e4", "t0": 60, "t1": 70}]
        sl = [{"id": "s1", "t0": 13, "rel": "new"}, {"id": "s2", "t0": 40, "rel": "reveal"}, {"id": "s3", "t0": 100}]
        b = A.bounds(ev, sl)
        self.assertEqual([(x["t"], x["why"]) for x in b], [(12, "both"), (60, "pause"), (100, "slide")])
        self.assertEqual(b[0]["ev"], ["e3", "s1"])


class TestOutputs(unittest.TestCase):
    def test_cues(self):
        ws = [W("word%d" % i, i * 0.5, i * 0.5 + 0.4, spk="S1") for i in range(40)]
        cs = A.cues(ws)
        self.assertTrue(all(c["end"] - c["start"] <= A.CUE_MAX_S + 0.5 for c in cs))
        self.assertTrue(all(sum(len(x) for x in c["lines"]) <= A.CUE_MAX_CH for c in cs))
        self.assertTrue(all(1 <= len(c["lines"]) <= 2 for c in cs))
        self.assertEqual(cs[0]["spk"], "S1")
        self.assertEqual([c["id"] for c in cs], list(range(1, len(cs) + 1)))
        self.assertEqual(A.cues([]), [])

    def test_windows_ids_no_times(self):
        ev = [{"id": "e%d" % i, "t0": i * 10.5, "t1": i * 10.5 + 9, "text": "word " * 30, "spk": "S1"} for i in range(1, 9)]
        sl = [{"id": "s1", "t0": 31.0, "ocr": ["o1.1"]}]
        ocr = [{"id": "o1.1", "text": "Slide title"}]
        ws = A.windows(ev, sl, ocr, win_tok=100, est=lambda t: len(t) // 4)
        self.assertGreater(len(ws), 1)
        joined = "\n".join(ws)
        self.assertIn("[e1|S1]", joined)
        self.assertIn("[s1] Slide title", joined)
        self.assertNotIn("31.0", joined, "בלי זמנים — המודל מצטט מזהים בלבד (19.2)")
        self.assertLess(joined.index("[e2|S1]"), joined.index("[s1]"), "השקף לפי הזמן שלו (31.0 — אחרי e2, לפני e3)")
        self.assertLess(joined.index("[s1]"), joined.index("[e3|S1]"))

    def test_count_tokens(self):
        r = A.count_tokens(["aaa", "bbbbbb"], counter=lambda t: len(t))
        self.assertEqual((r["win"], r["tok"], r["src"]), (2, 9, "api"))

        def bad(t):
            raise ValueError("no key")
        r = A.count_tokens(["aaa"], counter=bad)
        self.assertEqual(r["src"], "est")
        self.assertEqual(r["tok"], r["est"])
        self.assertEqual(A.count_tokens([], counter=bad)["win"], 0)

    def test_build_and_summary(self):
        wd = {"words": [W("a", 0, 1)], "ts": "word"}
        vi = A.build_vi("he", 3600.4, "file", "שם", wd, {"w": 1920, "h": 1080, "img": "webp"}, [], [], [], {}, [], 7, "ok",
                        {"tok": 10}, ["vi_ocr", "nonsense", "ts_coarse"])
        self.assertEqual(vi["v"], A.VI_V)
        self.assertEqual(vi["dry"], 1)
        self.assertEqual(vi["lang"], {"src": "he", "out": "he"})
        self.assertEqual(vi["wd"], [["a", 0.0, 1.0]])
        self.assertEqual(vi["quality"]["warn"], ["vi_ocr", "ts_coarse"])
        self.assertEqual(vi["chapters"], [])
        self.assertEqual(A.summary(vi), {"n": 0, "ok": 0, "cov": 0, "so": 7, "d": 3600})
        self.assertTrue(all(isinstance(v, int) for v in A.summary(vi).values()))

    def test_warnings(self):
        self.assertEqual(A.warnings({"noscreen": True}, "ok", {"ts": "word", "words": [1]}, True), ["vi_noscreen"])
        self.assertEqual(A.warnings({}, "low", {"ts": "seg", "words": [1]}, False), ["vi_noscreen", "vi_asr_low", "ts_coarse"])
        w = A.warnings({"lowres": True, "stats": {"ocr_err": 2}}, "ok", {"ts": "none", "words": []}, True)
        self.assertEqual(w, ["vi_lowres", "vi_ocr"])
        self.assertTrue(set(A.VI_WARN) >= {"vi_noscreen", "vi_lowres", "vi_ocr", "vi_asr_low", "ts_coarse"})

    def test_files_and_constants(self):
        self.assertEqual([k for k, *_ in A.VI_FILES], ["vi", "vis", "cues", "small", "thumb"])
        self.assertLessEqual(len(A.VI_FILES), 12, "OUT_MAX")
        self.assertEqual(len(set(A.VI_ERR)), len(A.VI_ERR))
        self.assertEqual(A.mem_need(0), round(4600 * 1.1))

    def test_stage_rows_and_cpu(self):
        rows = {"vt": [["vi-asr", 100.0, 50.0, "M", 2000, 1, 120.0], ["vi-screen", 160.0, 20.0, "M", 900, 1, 40.0],
                       ["vi_tr", 99.0, 61.0, "M", 2000, 1, 120.0], ["old", 10.0, 5.0, "M", 9000, 1, 1.0]]}
        self.assertEqual(A.stage_rows(rows, 100.0), (70.0, 2000, 160.0))
        self.assertEqual(A.stage_rows(rows, 150.0), (20.0, 900, 40.0))
        f = A.cpu_facts()
        self.assertIsInstance(f, dict)
        if f:
            self.assertTrue(set(f["flags"]) <= set(A.CPU_FLAGS))


class FakePool:
    def __init__(self, n):
        self.max = self.limit = n

    def set_limit(self, n):
        self.limit = max(1, min(self.max, n))


class TestVtVi(unittest.TestCase):
    def test_words_from_segments(self):
        ws = VI.words_from_segments([{"s": 0, "e": 2, "text": "שלום עולם"}, {"s": 3, "e": 3, "text": "x"}, {"s": 5, "e": 6, "text": ""}])
        self.assertEqual([(w["w"], w["s"], w["e"], w["li"], w["c"]) for w in ws], [("שלום", 0.0, 1.0, 0, 1), ("עולם", 1.0, 2.0, 0, 1)])

    def test_guard(self):
        pool = FakePool(4)
        seq = iter([(500, 4000), (4300, 4000), (4400, 4000), (1000, 600), (1000, 3000), (1000, 3000)])
        cur = {}

        def nxt():
            cur["r"], cur["a"] = next(seq)
        g = VI.MemGuard(pool, budget_mb=4600, rss=lambda: cur["r"], avail=lambda: cur["a"])
        lims = []
        for _ in range(6):
            nxt()
            g.step()
            lims.append(pool.limit)
        self.assertEqual(lims, [4, 3, 2, 1, 2, 3], "מעל 90% מההזמנה / מעט פנוי — יורד; מרווח — חוזר לאט")
        self.assertEqual((g.peak, g.cuts, g.low), (4400, 3, 1))
        g2 = VI.MemGuard(FakePool(2), rss=lambda: 10_000, avail=lambda: None)
        g2.step()
        self.assertEqual(g2.pool.limit, 2, "בלי הזמנה ובלי מידע על הפנוי — לא נוגעים")

    def test_webp_and_thumb(self):
        data, w, h, kind = VI.webp(png(1920, 1080))
        self.assertEqual((w, h), (1280, 720))
        self.assertIn(kind, ("webp", "jpeg"))
        self.assertGreater(len(data), 10)
        data, w, h, _ = VI.webp(png(640, 360))
        self.assertEqual((w, h), (640, 360), "לא מגדילים")
        with tempfile.TemporaryDirectory() as td:
            VI.thumb(png(1920, 1080), Path(td) / "t.jpg")
            from PIL import Image
            with Image.open(Path(td) / "t.jpg") as im:
                self.assertEqual(im.size, (480, 270))


def _video(path, secs=6, audio=True):
    from tests.test_slides import _encoder
    cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", f"color=c=white:s=640x360:d={secs}:r=5"]
    if audio:
        cmd += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={secs}", "-c:a", "aac", "-shortest"]
    subprocess.run(cmd + _encoder() + ["-y", str(path)], check=True)


@unittest.skipUnless(HAS_FF, "ffmpeg לא מותקן")
class TestScreenStage(unittest.TestCase):
    def test_screen_with_fakes(self):
        with tempfile.TemporaryDirectory() as td:
            src = Path(td) / "v.mp4"
            _video(src)
            units = json.loads(json.dumps(SCREEN["units"]))
            for u in units:
                u.pop("img", None)
                u.pop("ocr", None)
            fake = {"dur": 6.0, "units": units, "stats": {"slide_s": 5.0, "units": 3}}
            seen = []

            def frame(t):
                seen.append(t)
                return png(1920, 1080)
            r = VI.screen(str(src), Path(td) / "out", procs=2, detect=lambda: fake, frame=frame,
                          ocr_fn=lambda b: {"lines": [{"text": "x"}], "words": 1, "conf": 90})
            self.assertEqual(sorted(seen), [30.0, 330.0], "פריים אחד לשקף — המצב האחרון")
            sl = [u for u in r["units"] if u["kind"] == "slide"]
            self.assertEqual(sl[0]["img"]["o"], 0)
            self.assertEqual(sl[1]["img"]["o"], sl[0]["img"]["l"], "חבילה צמודה")
            vis = (Path(td) / "out" / "vis.bin").read_bytes()
            self.assertEqual(len(vis), sl[0]["img"]["l"] + sl[1]["img"]["l"])
            self.assertTrue((Path(td) / "out" / "thumb.jpg").is_file())
            self.assertEqual(r["stats"]["ocr_n"], 2)
            self.assertEqual(r["stats"]["ocr_conf"], 90)
            self.assertFalse(r["noscreen"])
            self.assertFalse(r["lowres"] is True and r["h"] >= 480)

    def test_audio_only(self):
        with tempfile.TemporaryDirectory() as td:
            src = Path(td) / "a.m4a"
            subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
                            "-c:a", "aac", "-y", str(src)], check=True)
            r = VI.screen(str(src), Path(td) / "o")
            self.assertTrue(r["noscreen"])
            self.assertEqual(r["units"], [])


class Ctx:
    def __init__(self, st, pdir):
        self.st, self._pdir, self.name, self.reports = st, pdir, "jtestvi", []

    @property
    def pdir(self):
        return self._pdir

    def report(self, st=None, p=None, msg=None, force=False, **extra):
        self.reports.append(dict({"st": st, "p": p, "msg": msg}, **extra))


class FakeJ:
    """job מדומה: הקליטה מחזירה את הסרטון הסינתטי, ופקודות ה־vt כותבות את מה שהשלבים האמיתיים היו כותבים."""

    def __init__(self, ctx, src):
        self.ctx, self.src, self.calls, self.put = ctx, src, [], []
        self.Ctx = lambda st: ctx
        self.lid = "en"                     # מה ש־vi-asr "מזהה" כשמבקשים auto (vt/lang.py ‏main_lang)
        self.LIVE_USAGE = None

    def load_state(self):
        return self.ctx.st

    def url_fetch(self, ctx):
        self.calls.append("url_fetch")

    def wait_video(self, ctx, st, msg):
        return {"id": "r2:v", "size": 1}

    def in_path(self, ctx, f, kind):
        return self.src

    def fetch_input(self, ctx, fid, dest, size, cb):
        cb(1.0)

    def ensure_env(self, ctx, st):
        pass

    def note_timing(self, ctx, cmd, t0, t1, rss=0, cpu=None):
        p = ctx.pdir / "snb-timing.json"
        d = json.loads(p.read_text()) if p.exists() else {"vt": []}
        d["vt"].append([cmd, round(t0, 1), round(t1 - t0, 2), "M", int(rss or 0), 1, cpu])
        p.write_text(json.dumps(d))

    def vt(self, ctx, args, stage=None, lo=0.0, hi=1.0):
        import time
        t0 = time.time()
        self.calls.append(args[0])
        out = Path(args[args.index("--out") + 1])
        if args[0] == "vi-asr":
            ws = [W("Gradient", 1.0, 1.5, p=0.9), W("descent", 1.6, 2.2), W("works.", 2.3, 4.5), W("Next", 6.0, 6.5)]
            lg = args[args.index("--lang") + 1]
            lg = self.lid if lg == "auto" else lg
            VI.write(out, {"v": 1, "lang": lg, "engine": "x", "quality": "ok", "words": ws if lg in ("he", "en") else [], "stats": {}})
        elif args[0] == "vi-align":
            tr = json.loads(Path(args[1]).read_text())
            VI.write(out, {"v": 1, "lang": tr["lang"], "aligner": "x", "ts": "word", "words": tr["words"], "stats": {"n": 4}})
        elif args[0] == "vi-screen":
            out.mkdir(parents=True, exist_ok=True)
            (out / "vis.bin").write_bytes(b"RIFF" + b"\0" * 96)
            (out / "thumb.jpg").write_bytes(b"\xff\xd8\xff" + b"\0" * 20)
            VI.write(out / "screen.json", dict(SCREEN, w=1280, h=720, noscreen=False, lowres=False, img="webp",
                                               stats={"ocr_err": 1, "ocr_n": 2, "procs": 4}))
        elif args[0] == "vi-small":
            out.write_bytes(b"\0" * 64)
        self.note_timing(ctx, args[0], t0, time.time() + 0.01, 1234, 2.0)

    def put_output_retry(self, ctx, p, name, k, mime, cb):
        cb(1.0)
        self.put.append((k, p.name, name, mime))
        return "r2:" + k


@unittest.skipUnless(HAS_FF, "ffmpeg לא מותקן")
class TestViRun(unittest.TestCase):
    def setUp(self):
        self.td = tempfile.TemporaryDirectory()
        self.dir = Path(self.td.name)
        self.src = self.dir / "in.mp4"
        _video(self.src)

    def tearDown(self):
        self.td.cleanup()

    def run_vi(self, engine=None, lid="en", **spec):
        st = {"job": "jtestvi", "spec": dict({"vi": 1, "dry": 1, "from": "en", "to": ["he"], "name": "הרצאה.mp4", "mode": ""}, **spec),
              "files": {"v": {"id": "r2:v", "size": 1}}}
        ctx = Ctx(st, self.dir / "proj")
        J = FakeJ(ctx, self.src)
        J.lid = lid
        self.ctx, self.J = ctx, J
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = A.vi_run(J, None, engine=engine)
        return rc, ctx, J, buf.getvalue()

    def test_dry_run_end_to_end(self):
        os.environ.pop("ANTHROPIC_API_KEY", None)
        rc, ctx, J, out = self.run_vi()
        self.assertEqual(rc, 0)
        stg = [r["st"] for r in ctx.reports if r["st"] and r["p"] == 0]
        self.assertEqual(stg, ["up", "tr", "al", "rv", "bn", "sv"], "השלבים לפי perf.STAGES")
        last = ctx.reports[-1]
        self.assertTrue(last.get("done"))
        self.assertEqual(last["vsm"]["d"], 6)
        self.assertEqual([o["k"] for o in last["out"]], ["vi", "vis", "cues", "small", "thumb"])
        self.assertEqual(J.calls, ["url_fetch", "vi-asr", "vi-screen", "vi-align", "vi-small"])
        vi = json.loads((ctx.pdir / "vi.json").read_text())
        self.assertEqual(vi["v"], A.VI_V)
        self.assertEqual([u["text"] for u in vi["evidence"]], ["Gradient descent works.", "Next"])
        self.assertEqual(vi["quality"]["so"], 2, "o1.3 ו־o1.4 לא נאמרו; o1.2 נאמרה בחלקה; o1.1 קצרה; o1.5 בביטחון נמוך")
        self.assertIn("vi_ocr", vi["quality"]["warn"])
        self.assertEqual(vi["tok"]["src"], "est")
        self.assertGreater(vi["tok"]["img"], 0)
        tm = json.loads((ctx.pdir / "snb-timing.json").read_text())["vt"]
        names = [r[0] for r in tm]
        for s in ("vi_up", "vi_tr", "vi_al", "vi_rv", "vi_bn", "vi_sv", "vi-wav", "vi-asr"):
            self.assertIn(s, names)
        al = [r for r in tm if r[0] == "vi_al"][0]
        self.assertEqual(al[4], 1234, "שיא השלב = השיא של הפקודות שרצו בו")
        line = [x for x in out.splitlines() if x.startswith("VI_DRY ")][0]
        facts = json.loads(line[7:])
        self.assertEqual(set(facts["stg"]), {"up", "tr", "al", "rv", "bn", "sv"})
        self.assertNotIn("הרצאה", line, "בלי שם הקובץ — רק מספרים")
        cues = json.loads((ctx.pdir / "cues.json").read_text())
        self.assertEqual(cues[0]["lines"], ["Gradient descent works."])

    def test_refusals(self):
        os.environ.pop("SNB_VI_LIVE", None)
        for spec, err in (({"from": "fr"}, "vi_lang"), ({"dry": 0}, "vi_off")):
            with self.assertRaises(SystemExit):
                self.run_vi(**spec)
            self.assertEqual(self.ctx.reports[-1]["err"], err)
            self.assertEqual(self.J.calls, [], "נדחה לפני הקליטה — בלי הוצאה")
        with self.assertRaises(SystemExit):
            self.run_vi(**{"from": "auto", "lid": "fr"})
        self.assertEqual(self.ctx.reports[-1]["err"], "vi_lang", "זוהתה שפה שלא נתמכת")
        self.assertNotIn("vi-screen", self.J.calls)

    def test_auto_lang(self):
        """9.3 סעיף 2: "אוטומטי" — vi-asr מקבל auto, והשפה שזוהתה נכנסת ל־vi.json"""
        rc, ctx, J, out = self.run_vi(**{"from": "auto", "lid": "he"})
        self.assertEqual(rc, 0)
        vi = json.loads((ctx.pdir / "vi.json").read_text())
        self.assertEqual(vi["lang"]["src"], "he")
        self.assertIn('"lang":"he"', [x for x in out.splitlines() if x.startswith("VI_DRY ")][0])

    def test_live_end_to_end(self):
        """1.2א: עבודה לא יבשה עם מנוע מדומה (ManualEngine) — vi.json עם פרקים ופריטים, "טיוטה — לא אומתה", ו־VI_RUN"""
        import llm
        seen = []

        def ask(k, text):
            seen.append(text)
            e = re.findall(r"^\[(e\d+)", text, re.M)
            d = {"genre": "academic_lecture", "segments": [{"from": e[0], "type": "content"}],
                 "chapters": [{"from": e[0], "lvl": 1, "cont": False, "title": "ירידת גרדיאנט", "sum": "השיטה עובדת."}],
                 "items": [{"kind": "claim", "text": "ירידת גרדיאנט עובדת", "ev": [e[0]], "q": "descent works.", "src": "speech",
                            "basis": "speaker", "conf": "high"}],
                 "drop": []}
            return "<json>" + json.dumps(d, ensure_ascii=False) + "</json>"
        rc, ctx, J, out = self.run_vi(engine=llm.ManualEngine(ask), dry=0)
        self.assertEqual(rc, 0)
        self.assertEqual(len(seen), 1)
        self.assertNotIn("1.6", seen[0].split("## Window")[1], "בלי זמנים בחלון")
        vi = json.loads((ctx.pdir / "vi.json").read_text())
        self.assertEqual(vi["chapters"][0]["title"], "ירידת גרדיאנט")
        it = vi["items"][0]
        self.assertEqual((it["id"], it["ch"], it["t"], it["src"]), ("n1", "c1", 1.6, "speech"), "זמן המילה descent")
        self.assertIn("vi_unver", vi["quality"]["warn"])
        self.assertNotIn("tok", vi, "vi.json חי עובר norm_vi — העלות רק בדיווח ובעובדות")
        self.assertTrue(callable(J.LIVE_USAGE), "העלות בזמן ריצה — כמו בתרגום")
        self.assertEqual(ctx.reports[-1]["msg"], "הניתוח מוכן")
        facts = json.loads([x for x in out.splitlines() if x.startswith("VI_RUN ")][0][7:])
        self.assertEqual(facts["map"]["win"], 1)
        self.assertEqual(facts["map"]["pv"], 1)
        self.assertEqual(facts["tok"]["src"], "usage")

    def test_live_fail_reports_code(self):
        import llm
        with self.assertRaises(SystemExit):
            self.run_vi(engine=llm.ManualEngine(lambda k, t: "not json"), dry=0)
        r = self.ctx.reports[-1]
        self.assertEqual((r["err"], r["fail"]), ("vi_schema", True))
        self.assertNotIn("vi-small", self.J.calls, "בלי תוצרים")

    def test_live_gate_env(self):
        os.environ["SNB_VI_LIVE"] = "1"
        try:
            self.assertTrue(A.live_ok())
        finally:
            os.environ.pop("SNB_VI_LIVE", None)
        self.assertFalse(A.live_ok())

    def test_too_long(self):
        old = A.VI_MAX_S
        A.VI_MAX_S = 3
        try:
            st = {"job": "jtestvi", "spec": {"vi": 1, "dry": 1, "from": "he", "to": ["he"], "name": "x"}, "files": {"v": {"id": "r2:v"}}}
            ctx = Ctx(st, self.dir / "p2")
            with self.assertRaises(SystemExit):
                A.vi_run(FakeJ(ctx, self.src), None)
            self.assertEqual(ctx.reports[-1]["err"], "vi_long")
        finally:
            A.VI_MAX_S = old


if __name__ == "__main__":
    unittest.main()
