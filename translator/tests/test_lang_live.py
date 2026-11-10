"""10/11/2026 — השפה המדוברת בכל רגע (vt/lang.py, ‏vt/vi.py:lang_mix, ‏analyze.cues, ‏rerender.norm_cues, ‏job.shift_words).
מוקים בלבד: מודלים מזויפים, ‏soundfile מזויף (לא מותקן בכל סביבה) — בלי מודל אמיתי, בלי רשת, בלי הוצאה."""
import json
import os
import re
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

import numpy as np

HERE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE))

import analyze as A  # noqa: E402
import job as J  # noqa: E402
import rerender as R  # noqa: E402
from vt import lang as L  # noqa: E402
from vt import vi as V  # noqa: E402

SR = L.SR


class Info:
    def __init__(self, lg, p):
        self.language, self.language_probability = lg, p


class Wd:
    def __init__(self, w, s, e):
        self.word, self.start, self.end = w, s, e


class Sg:
    def __init__(self, text, words):
        self.text, self.words = text, words


class FakeWhisper:
    """faster-whisper מזויף: הזיהוי לפי טבלה (זמן התחלה של הקטע ← שפה), התמלול — מילים קבועות בזמן יחסי."""

    def __init__(self, langs, words=None):
        self.langs, self.words, self.calls = langs, words or {}, []

    def transcribe(self, clip, **kw):
        n = len(self.calls)
        self.calls.append(kw)
        lg, p = self.langs[min(n, len(self.langs) - 1)] if isinstance(self.langs, list) else self.langs
        ws = [Wd(*x) for x in self.words.get(kw.get("language") or lg, [])]
        return iter([Sg("".join(x.word for x in ws), ws)] if ws else []), Info(lg, p)


def fake_sf(audio=None, sr=SR, store=None):
    m = types.ModuleType("soundfile")
    m.read = lambda path, dtype=None: (audio if audio is not None else np.zeros(SR * 60, dtype="float32"), sr)

    def write(path, data, rate):
        if store is not None:
            store.append((len(data), rate))
        Path(path).write_bytes(b"x")
    m.write = write
    return m


class MergeWords(unittest.TestCase):
    def test_replaces_by_midpoint_and_keeps_p(self):
        words = [{"w": "שלום", "s": 0.0, "e": 0.5}, {"w": "הלו", "s": 2.0, "e": 2.4}, {"w": "סוף", "s": 5.0, "e": 5.3}]
        seg = [{"s": 1.8, "e": 3.0, "lg": "en", "wd": [[" hello", 1.9, 2.3, 0.91], [" world", 2.4, 2.8]]}]
        out = L.merge_words(words, seg)
        self.assertEqual([w["w"] for w in out], ["שלום", "hello", "world", "סוף"])
        self.assertEqual(out[1], {"w": "hello", "s": 1.9, "e": 2.3, "lg": "en", "p": 0.91})
        self.assertNotIn("p", out[2])
        self.assertNotIn("lg", out[0])

    def test_segment_without_words_is_ignored(self):
        words = [{"w": "a", "s": 0, "e": 1}]
        self.assertIs(L.merge_words(words, [{"s": 0, "e": 2, "lg": "he", "wd": []}]), words)
        self.assertIs(L.merge_words(words, None), words)


class CueLang(unittest.TestCase):
    def test_src_split_by_speech_times(self):
        seg = [{"s": 10.0, "e": 16.0, "lg": "iw", "tx": "אחת שתיים שלוש ארבע",
                "wd": [[" אחת", 10.1, 10.5], [" שתיים", 10.6, 11.2], [" שלוש", 13.1, 13.6], [" ארבע", 13.7, 14.4]]}]
        cues = [{"id": 1, "start": 9.9, "end": 11.5, "speech_s": 10.0, "speech_e": 11.3, "en": "one two", "lg": "xx"},
                {"id": 2, "start": 13.0, "end": 14.6, "en": "three four"},
                {"id": 3, "start": 20.0, "end": 21.0, "en": "later", "lg": "fr", "src": "old"}]
        self.assertEqual(L.cue_lang(seg, cues), 2)
        self.assertEqual((cues[0]["lg"], cues[0]["src"]), ("he", "אחת שתיים"))   # iw → he
        self.assertEqual((cues[1]["lg"], cues[1]["src"]), ("he", "שלוש ארבע"))
        self.assertNotIn("lg", cues[2])                                            # ישן — נמחק
        self.assertNotIn("src", cues[2])

    def test_single_cue_falls_back_to_tx(self):
        seg = [{"s": 0.0, "e": 4.0, "lg": "fr", "tx": "bonjour à tous", "wd": []}]
        cues = [{"id": 7, "start": 0.2, "end": 3.8, "en": "hello all"}]
        self.assertEqual(L.cue_lang(seg, cues), 1)
        self.assertEqual(cues[0]["src"], "bonjour à tous")

    def test_src_capped(self):
        seg = [{"s": 0.0, "e": 4.0, "lg": "fr", "tx": "x" * 2000, "wd": []}]
        cues = [{"id": 1, "start": 0.0, "end": 4.0, "en": "e"}]
        L.cue_lang(seg, cues)
        self.assertEqual(len(cues[0]["src"]), L.SRC_MAX)


class Spans(unittest.TestCase):
    def test_detect_spans_filters(self):
        audio = np.zeros(SR * 40, dtype="float32")
        m = FakeWhisper([("en", 0.95), ("he", 0.99), ("fr", 0.5), ("ar", 0.9)])
        spans = [(0, 5), (5, 6), (6, 12), (12, 18), (18, 24)]   # (5,6) קצר מדי — לא נבדק
        got = L.detect_spans(audio, spans, "he", model=m)
        self.assertEqual(got, [{"s": 0.0, "e": 5.0, "lg": "en", "p": 0.95, "i": 0},
                               {"s": 18.0, "e": 24.0, "lg": "ar", "p": 0.9, "i": 4}])
        self.assertEqual(len(m.calls), 4)
        self.assertEqual(m.calls[0]["beam_size"], 1)          # זיהוי בלבד — זול
        self.assertNotIn("language", m.calls[0])

    def test_parakeet_spans_maps_back(self):
        audio = np.zeros(SR * 40, dtype="float32")
        store = []

        def run(wav):
            self.assertTrue(os.path.exists(wav))
            # קטע 1: ‏2 שנ׳ (0–2), שקט 1, קטע 2 מתחיל ב־3
            return {"words": [{"w": "hi", "s": 0.2, "e": 0.6, "conf": 0.8}, {"w": "there", "s": 3.5, "e": 3.9, "conf": 0.7},
                              {"w": "gap", "s": 2.2, "e": 2.6}, {"w": "", "s": 0.1, "e": 0.2}]}
        with mock.patch.dict(sys.modules, {"soundfile": fake_sf(store=store)}):
            out = L.parakeet_spans(audio, [(10.0, 12.0), (20.0, 23.0)], run=run)
        self.assertEqual(out, [[[" hi", 10.2, 10.6, 0.8]], [[" there", 20.5, 20.9, 0.7]]])
        self.assertEqual(store, [((2 + 1 + 3 + 1) * SR, SR)])   # קובץ אחד, שקט אחרי כל קטע

    def test_transcribe_spans_engine_per_language(self):
        audio = np.zeros(SR * 40, dtype="float32")
        found = [{"s": 20.0, "e": 24.0, "lg": "fr", "p": 0.9, "i": 2}, {"s": 2.0, "e": 5.0, "lg": "en", "p": 0.95, "i": 0},
                 {"s": 30.0, "e": 33.0, "lg": "ar", "p": 0.9, "i": 3}]
        m = FakeWhisper(("fr", 0.9), {"fr": [(" bonjour", 0.5, 1.0)]})
        with mock.patch.dict(sys.modules, {"soundfile": fake_sf()}):
            out = L.transcribe_spans(audio, found, model=m, en_run=lambda w: {"words": [{"w": "yes", "s": 0.1, "e": 0.4, "conf": 0.9}]})
        self.assertEqual([g["lg"] for g in out], ["en", "fr"])              # ar — בלי מילים, נזרק; ממוין לפי זמן
        self.assertEqual(out[0]["tx"], "yes")
        self.assertEqual(out[0]["wd"], [[" yes", 2.1, 2.4, 0.9]])
        self.assertEqual((out[1]["tx"], out[1]["wd"]), ("bonjour", [[" bonjour", 20.5, 21.0]]))
        self.assertEqual([c.get("language") for c in m.calls], ["fr", "ar"])   # whisper בשפה שזוהתה

    def test_transcribe_spans_en_falls_back_to_whisper(self):
        audio = np.zeros(SR * 10, dtype="float32")
        m = FakeWhisper(("en", 0.9), {"en": [(" ok", 0.1, 0.3)]})

        def boom(w):
            raise RuntimeError("no parakeet")
        with mock.patch.dict(sys.modules, {"soundfile": fake_sf()}):
            out = L.transcribe_spans(audio, [{"s": 1.0, "e": 4.0, "lg": "en", "p": 0.9, "i": 0}], model=m, en_run=boom)
        self.assertEqual(out[0]["wd"], [[" ok", 1.1, 1.3]])
        self.assertEqual(m.calls[0]["language"], "en")


class Detect(unittest.TestCase):
    def test_hebrew_goes_to_ivrit(self):
        words = [{"s": 1.0 + i * 0.4, "e": 1.3 + i * 0.4, "conf": 0.1} for i in range(10)]   # רצף בביטחון נמוך
        small = FakeWhisper(("he", 0.97), {"he": [(" שגוי", 0.0, 0.5)]})
        ivrit = FakeWhisper(("he", 0.99), {"he": [(" שלום", 0.2, 0.6), (" לכולם", 0.7, 1.2)]})
        with mock.patch.dict(sys.modules, {"soundfile": fake_sf()}):
            got = L.detect("x.wav", words, model=small, he_model=ivrit)
        self.assertEqual(len(got), 1)
        g = got[0]
        self.assertEqual((g["lg"], g["tx"]), ("he", "שלום לכולם"))
        self.assertAlmostEqual(g["wd"][0][1], g["s"] + 0.2, places=3)
        self.assertEqual(ivrit.calls[0]["language"], "he")
        self.assertTrue(small.calls[0]["word_timestamps"])

    def test_english_and_alias(self):
        self.assertEqual(L.norm_lg("iw"), "he")
        self.assertEqual(L.norm_lg("EN"), "en")
        self.assertEqual(L.norm_lg(None), "")
        words = [{"s": 1.0 + i * 0.4, "e": 1.3 + i * 0.4, "conf": 0.1} for i in range(10)]
        with mock.patch.dict(sys.modules, {"soundfile": fake_sf()}):
            self.assertEqual(L.detect("x.wav", words, model=FakeWhisper(("en", 0.99), {"en": [(" a", 0, 1)]})), [])


class LangMix(unittest.TestCase):
    def setUp(self):
        os.environ.pop("SNB_LID", None)

    def test_hebrew_video_with_english_span(self):
        words = [{"w": "שלום", "s": 0.5, "e": 1.0, "li": 0}, {"w": "hello", "s": 6.5, "e": 7.0, "li": 1},
                 {"w": "world", "s": 7.2, "e": 7.8, "li": 1}, {"w": "תודה", "s": 12.5, "e": 13.0, "li": 2}]
        segs = [{"s": 0.0, "e": 4.0}, {"s": 6.0, "e": 9.0}, {"s": 12.0, "e": 15.0}]
        m = FakeWhisper([("he", 0.99), ("en", 0.97), ("he", 0.99)])
        with mock.patch.dict(sys.modules, {"soundfile": fake_sf()}):
            out, st = V.lang_mix("x.wav", words, segs, "he", model=m,
                                 en_run=lambda w: {"words": [{"w": "Hello", "s": 0.4, "e": 1.0, "conf": 0.9},
                                                             {"w": "world.", "s": 1.1, "e": 1.8, "conf": 0.8}]})
        self.assertEqual([w["w"] for w in out], ["שלום", "Hello", "world.", "תודה"])
        self.assertEqual([w.get("lg") for w in out], [None, "en", "en", None])
        self.assertNotIn("li", out[1])                     # בלי li — היישור העברי לא נוגע בה
        self.assertEqual(st["lid_n"], 1)

    def test_kill_switch_and_missing_model(self):
        words = [{"w": "a", "s": 0, "e": 1}]
        with mock.patch.dict(os.environ, {"SNB_LID": "off"}):
            self.assertEqual(V.lang_mix("x.wav", words, [], "he", model=FakeWhisper(("en", 1)))[0], words)
        with mock.patch.object(L, "ready", return_value=False):
            out, st = V.lang_mix("x.wav", words, [], "he")
        self.assertIs(out, words)
        self.assertEqual(st, {"lid_n": 0})

    def test_failure_keeps_words(self):
        words = [{"w": "a", "s": 0, "e": 1}]
        bad = fake_sf(sr=8000)
        with mock.patch.dict(sys.modules, {"soundfile": bad}):
            out, st = V.lang_mix("x.wav", words, [{"s": 0, "e": 5}], "he", model=FakeWhisper(("en", 1)))
        self.assertIs(out, words)
        self.assertEqual(st["lid_n"], 0)


class Align(unittest.TestCase):
    def test_en_aligns_only_primary_words(self):
        tr = {"lang": "en", "words": [{"w": "a", "s": 0, "e": 1}, {"w": "ב", "s": 1, "e": 2, "lg": "he"}, {"w": "c", "s": 2, "e": 3}]}
        seen = []

        def align_words(ws, wav, device=None):
            seen.extend(w["w"] for w in ws)
            return [dict(w, s=w["s"] + 0.1) for w in ws], {"n": len(ws)}
        fake = types.ModuleType("vt.align")
        fake.align_words = align_words
        with mock.patch.dict(sys.modules, {"vt.align": fake}), \
                mock.patch("vt.diarize.diarize", return_value={}), mock.patch.object(V, "_release_memory"):
            r = V.align(tr, "x.wav")
        self.assertEqual(seen, ["a", "c"])
        self.assertEqual([w["s"] for w in r["words"]], [0.1, 1, 2.1])

    def test_he_ctc_only_words_with_li(self):
        from vt import align_he
        tr = {"lang": "he", "words": [{"w": "א", "s": 0, "e": 1, "li": 0, "c": 1}, {"w": "ok", "s": 1.2, "e": 1.6, "lg": "en"}]}
        got = []

        def ctc(model, d, audio, ws):
            got.extend(w["w"] for w in ws)
            return [{"s": 0.2, "e": 0.8} for _ in ws]
        with mock.patch.object(align_he, "load_ctc", return_value=(None, None)), \
                mock.patch.object(align_he, "load_audio", return_value=None), mock.patch.object(align_he, "ctc_align", ctc), \
                mock.patch("vt.diarize.diarize", return_value={}), mock.patch.object(V, "_release_memory"):
            r = V.align(tr, "x.wav")
        self.assertEqual(got, ["א"])
        self.assertEqual((r["words"][0]["s"], r["words"][1]["s"]), (0.2, 1.2))
        self.assertNotIn("c", r["words"][0])


class Cues(unittest.TestCase):
    def test_cue_breaks_on_language_switch(self):
        words = [{"w": "שלום", "s": 0.0, "e": 0.4}, {"w": "לכולם", "s": 0.5, "e": 0.9},
                 {"w": "hello", "s": 1.0, "e": 1.3, "lg": "en"}, {"w": "all", "s": 1.4, "e": 1.7, "lg": "en"},
                 {"w": "תודה", "s": 1.8, "e": 2.1}]
        out = A.cues(words)
        self.assertEqual([c["lines"] for c in out], [["שלום לכולם"], ["hello all"], ["תודה"]])
        self.assertEqual([c.get("lg") for c in out], [None, "en", None])

    def test_rerender_keeps_lg_src(self):
        raw = [{"start": 0, "end": 2, "lines": ["שלום"], "en": "hi", "lg": "fr", "src": "  bonjour\x07 "},
               {"start": 3, "end": 5, "lines": ["א"], "lg": "French", "src": "x"},
               {"start": 6, "end": 8, "lines": ["ב"], "lg": "ar", "src": ""}]
        out = R.norm_cues(raw)
        self.assertEqual((out[0]["lg"], out[0]["src"]), ("fr", "bonjour"))
        self.assertNotIn("lg", out[1])
        self.assertEqual(out[2]["lg"], "ar")
        self.assertNotIn("src", out[2])

    def test_build_keeps_lg_src(self):
        src = (HERE / "vt" / "cli.py").read_text(encoding="utf-8")
        self.assertRegex(src, r"L\.cue_lang\(")
        keep = re.search(r'keep\s*=\s*\(([^)]*)\)', src) or re.search(r'keep\s*=\s*\[([^\]]*)\]', src) or re.search(r'keep\s*=\s*\{([^}]*)\}', src)
        self.assertTrue(keep and '"lg"' in keep.group(1) and '"src"' in keep.group(1))


class Shift(unittest.TestCase):
    def test_foreign_words_shift_with_video(self):
        with tempfile.TemporaryDirectory() as td:
            pd = Path(td)
            (pd / "asr").mkdir()
            (pd / "foreign.json").write_text(json.dumps({"v": 1, "seg": [
                {"s": 1.0, "e": 3.0, "lg": "he", "tx": "x", "wd": [[" א", 1.2, 1.6], [" ב", 2.0, 2.5, 0.9]]}]}), encoding="utf-8")
            J.shift_words(pd, 0.5)
            g = json.loads((pd / "foreign.json").read_text(encoding="utf-8"))["seg"][0]
        self.assertEqual((g["s"], g["e"]), (1.5, 3.5))
        self.assertEqual(g["wd"], [[" א", 1.7, 2.1], [" ב", 2.5, 3.0, 0.9]])


if __name__ == "__main__":
    unittest.main()
