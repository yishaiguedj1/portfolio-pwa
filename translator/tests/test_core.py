"""בדיקות יחידה לליבה: עברית, תזמון, תכנון, תמליל, תרגום, מתאמי תמלול.

הרצה:  python -m unittest discover -s tests -v
"""

import sys
import unittest
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vt import config as C  # noqa: E402
from vt.hebrew import (break_lines, dual_lines, normalize_he, visible_len, rtl, RLM,  # noqa: E402
                       number_ok_in_he, Measurer)
from vt.timing import time_cues  # noqa: E402
from vt.util import FrameGrid  # noqa: E402
from vt.subs import write_ass, write_srt, frame_check  # noqa: E402
from vt.segment import plan, sentences  # noqa: E402
from vt.transcript import import_edit, export_edit, compare  # noqa: E402
from vt.translate import parse_answer, check, apply_merges  # noqa: E402
from vt.asr_api import normalize_elevenlabs, normalize_assemblyai  # noqa: E402
from vt.align import plan_chunks, clean_token  # noqa: E402
from vt.asr_parakeet import tokens_to_words  # noqa: E402


def W(text, s, e, spk="S1"):
    return {"w": text, "s": s, "e": e, "spk": spk, "conf": None}


def words_from(sentence: str, start: float, spk="S1", step=0.3, gap=0.05):
    out, t = [], start
    for tok in sentence.split():
        out.append(W(tok, round(t, 3), round(t + step, 3), spk))
        t += step + gap
    return out


class TestHebrew(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(normalize_he("שלום ...  עולם ,"), "שלום… עולם,")
        self.assertEqual(normalize_he(RLM + "“מנכ״ל”"), '"מנכ"ל"')

    def test_single_line(self):
        lines, ok = break_lines("אנחנו לא מוכרים מוצר.")
        self.assertEqual(lines, ["אנחנו לא מוכרים מוצר."])
        self.assertTrue(ok)

    def test_break_at_punctuation(self):
        lines, ok = break_lines("אנחנו לא מוכרים מוצר לאנשים, אנחנו מוכרים להם פתרון אמיתי.")
        self.assertTrue(ok)
        self.assertEqual(len(lines), 2)
        self.assertTrue(lines[0].endswith(","))
        for ln in lines:
            self.assertLessEqual(visible_len(ln), 42)

    def test_no_break_after_binding_word(self):
        lines, ok = break_lines("זה היה הרגע שבו הבנתי שהעתיד של החברה תלוי לגמרי בצוות הזה")
        self.assertTrue(ok)
        self.assertNotIn(lines[0].split()[-1], {"של", "את", "על", "עם"})

    def test_number_unit_together(self):
        lines, ok = break_lines("בשנה שעברה גייסנו בסבב האחרון סכום של 300 מיליון דולר מהמשקיעים")
        self.assertTrue(ok)
        self.assertFalse(lines[0].endswith("300"))

    def test_manual_break(self):
        lines, ok = break_lines("שורה ראשונה | שורה שנייה")
        self.assertEqual(lines, ["שורה ראשונה", "שורה שנייה"])

    def test_dual(self):
        self.assertEqual(dual_lines("באמת?", "- כן."), ["-באמת?", "-כן."])

    def test_rtl_mark(self):
        self.assertTrue(rtl("OpenAI הודיעה").startswith(RLM))
        self.assertEqual(visible_len(rtl("abc")), 3)

    def test_numbers(self):
        self.assertTrue(number_ok_in_he("3", "שלושה מוצרים"))
        self.assertTrue(number_ok_in_he("2024", "בשנת 2024"))
        self.assertTrue(number_ok_in_he("1000000", "מיליון משתמשים"))
        self.assertFalse(number_ok_in_he("47", "ארבעים ושבעה"))

    def test_measurer(self):
        st = C.STYLES["bold"].scaled(1920, 1080)
        m = Measurer(C.FONTS_DIR / C.STYLES["bold"].font_file, st.size, st.spacing, st.outline)
        w1 = m.width("אם הם לא הלכו איתך, איזו החלטה אחרת הם")
        # נמדד ב־libass: ~1330px של דיו לבן + מסגרות → ~1375px כולל המסגרת
        self.assertTrue(1300 < w1 < 1420, w1)


class TestTiming(unittest.TestCase):
    def mk(self, s, e, chars=20, i=1):
        return {"id": i, "speech_s": s, "speech_e": e, "chars": chars}

    def test_basic_in_out(self):
        g = FrameGrid(Fraction(25))
        cues = time_cues([self.mk(1.00, 2.50)], g, [], C.TimingRules())
        c = cues[0]
        self.assertEqual(c["fi"], 25 - 1)                 # פריים אחד לפני הדיבור
        self.assertEqual(c["fo"], 63 + 12)                # סוף דיבור + חצי שנייה

    def test_chaining_and_gap(self):
        g = FrameGrid(Fraction(24))
        cues = time_cues([self.mk(1.0, 2.0, i=1), self.mk(2.6, 4.0, i=2)], g, [], C.TimingRules())
        a, b = cues
        self.assertEqual(b["fi"] - a["fo"], 2)            # שרשור ל־2 פריימים

    def test_no_overlap(self):
        g = FrameGrid(Fraction(30000, 1001))
        cues = time_cues([self.mk(1.0, 2.0, i=1), self.mk(2.05, 3.0, i=2)], g, [], C.TimingRules())
        self.assertGreaterEqual(cues[1]["fi"] - cues[0]["fo"], 2)

    def test_min_duration(self):
        g = FrameGrid(Fraction(25))
        c = time_cues([self.mk(5.0, 5.2, chars=3)], g, [], C.TimingRules())[0]
        self.assertGreaterEqual(c["fo"] - c["fi"], 21)   # 5/6 שנ׳ ב־25fps = 20.8

    def test_reading_speed_extends(self):
        g = FrameGrid(Fraction(25))
        c = time_cues([self.mk(1.0, 2.0, chars=60)], g, [], C.TimingRules())[0]
        self.assertGreaterEqual((c["fo"] - c["fi"]) / 25, 60 / 17 - 0.05)

    def test_snap_in_to_cut_after(self):
        g = FrameGrid(Fraction(25))
        # חילוף ב־100 (4.0s), הדיבור מתחיל 0.2s אחריו → כניסה על החילוף
        c = time_cues([self.mk(4.2, 6.0)], g, [100], C.TimingRules())[0]
        self.assertEqual(c["fi"], 100)

    def test_snap_in_cut_just_after_speech_start(self):
        g = FrameGrid(Fraction(25))
        # דיבור מתחיל 4.0s, חילוף ב־4.2s (5 פריימים) → נכנסים על החילוף (אזור אדום)
        c = time_cues([self.mk(4.0, 6.0)], g, [105], C.TimingRules())[0]
        self.assertEqual(c["fi"], 105)

    def test_snap_out_extend_to_cut(self):
        g = FrameGrid(Fraction(25))
        # סוף דיבור 3.0 + 0.5 = 3.5 (88); חילוף ב־3.8 (95) → יציאה 2 פריימים לפני
        c = time_cues([self.mk(1.0, 3.0)], g, [95], C.TimingRules())[0]
        self.assertEqual(c["fo"], 93)

    def test_snap_out_pull_back_before_cut(self):
        g = FrameGrid(Fraction(25))
        # הדיבור נגמר ב־3.0 (75), חילוף ב־3.2 (80) → לא לחצות: יציאה ב־78
        c = time_cues([self.mk(1.0, 3.0)], g, [80], C.TimingRules())[0]
        self.assertEqual(c["fo"], 78)

    def test_cross_cut_when_speech_crosses(self):
        g = FrameGrid(Fraction(25))
        # הדיבור נמשך שנייה אחרי החילוף → הכתובית חוצה ונשארת לפחות חצי שנייה אחריו
        c = time_cues([self.mk(1.0, 4.0)], g, [75], C.TimingRules())[0]
        self.assertGreaterEqual(c["fo"], 75 + 12)

    def test_file_times_hit_exact_frames(self):
        for fps in (Fraction(24000, 1001), Fraction(25), Fraction(30000, 1001), Fraction(60000, 1001), Fraction(50)):
            g = FrameGrid(fps, 0.0)
            cues = [self.mk(1.0 + i * 3.1, 2.7 + i * 3.1, i=i + 1) for i in range(30)]
            time_cues(cues, g, [], C.TimingRules())
            for c in cues:
                c["lines"] = ["שלום"]
            self.assertEqual(frame_check(cues, g), [], str(fps))


class TestSubs(unittest.TestCase):
    def test_ass_and_srt(self):
        g = FrameGrid(Fraction(25))
        cues = [{"id": 1, "speech_s": 1.0, "speech_e": 2.0, "chars": 10, "lines": ["שורה א", "שורה ב"]}]
        time_cues(cues, g, [], C.TimingRules())
        ass = write_ass(cues, C.STYLES["bold"], 1280, 720)
        self.assertIn("PlayResX: 1280", ass)
        self.assertIn(",-1\n", ass.split("[Events]")[0])                # Encoding=-1
        self.assertEqual(ass.count("Dialogue: 0,"), 2)
        self.assertEqual(ass.count("Dialogue: 1,"), 2)                  # שכבת ההעבות
        self.assertIn(RLM + "שורה א", ass)
        srt = write_srt(cues)
        self.assertIn("00:00:00,960 --> ", srt)


class TestSegment(unittest.TestCase):
    def test_sentences_and_plan(self):
        ws = words_from("So we started the company in my garage. It was a crazy time, honestly.", 0.0)
        ws += words_from("Really?", 6.0, spk="S2")
        ws += words_from("Yes, absolutely, and then we raised money from the best investors in the valley, "
                         "which changed everything for us and for the whole team that we had built.", 7.0)
        self.assertGreaterEqual(len(sentences(ws)), 4)
        cues = plan(ws, C.TimingRules(), C.TextRules())
        for c in cues:
            self.assertLessEqual(c["speech_e"] - c["speech_s"], 7.0 + 1e-6)
            self.assertFalse(c["en"].split()[-1].lower() in {"the", "of", "to", "a"})
        self.assertTrue(all("budget" in c for c in cues))

    def test_backchannel_dropped(self):
        ws = words_from("I think the most important thing is focus", 0.0)
        ws += [W("Mm-hmm.", 3.0, 3.3, "S2")]
        ws += words_from("and saying no to almost everything else.", 3.4)
        cues = plan(ws, C.TimingRules(), C.TextRules())
        self.assertFalse(any("Mm-hmm" in c["en"] for c in cues))


class TestTranscript(unittest.TestCase):
    def test_edit_roundtrip(self):
        ws = words_from("Picked off because there's a lot", 0.0)
        ws += words_from("Yeah thanks Gary", 3.0, spk="S1")
        txt = export_edit(ws)
        txt = txt.replace("Yeah thanks Gary", "\n[S2] Yeah, thanks, Gary.")
        new, st = import_edit(ws, txt)
        self.assertEqual([w["w"] for w in new][-3:], ["Yeah,", "thanks,", "Gary."])
        self.assertEqual(new[-1]["spk"], "S2")
        self.assertEqual(new[0]["spk"], "S1")
        self.assertAlmostEqual(new[-1]["s"], ws[-1]["s"], places=3)

    def test_compare(self):
        a = words_from("we raised forty million dollars", 0)
        b = words_from("we raised fourteen million dollars", 0)
        d = compare(a, b)
        self.assertEqual(len(d), 1)
        self.assertEqual(d[0].a, "forty")


class TestTranslate(unittest.TestCase):
    def test_parse_and_check(self):
        cues = [{"id": 1, "en": "We grew 40% in 2024.", "budget": 40, "spk": "S1"},
                {"id": 2, "en": "Is that true?", "budget": 30, "spk": "S2"},
                {"id": 3, "en": "Our ARR is huge.", "budget": 30, "spk": "S1"}]
        he = parse_answer("#1 צמחנו ב־40% ב־2023.\n#2 זה נכון.\n#3 ה־ARR שלנו עצום.")
        issues, st = check(cues, he, [("ARR", ["הכנסות חוזרות שנתיות", "ARR"])])
        txt = "\n".join(issues)
        self.assertIn("2024", txt)
        self.assertIn("שאלה", txt)
        self.assertEqual(st["glossary"], 0)

    def test_nikud_is_error(self):
        cues = [{"id": 1, "en": "Hello there.", "budget": 40, "spk": "S1"},
                {"id": 2, "en": "Thanks.", "budget": 40, "spk": "S2"}]
        issues, st = check(cues, {"1": "שָׁלוֹם לך.", "2": "תודה — באמת."}, [])
        self.assertEqual(sum("ניקוד" in x for x in issues), 1, "ניקוד = שגיאה; מקף/גרש אינם ניקוד")
        self.assertEqual(st["errors"], 1)

    def test_merges(self):
        cues = [{"id": 1, "en": "a", "speech_s": 0, "speech_e": 1, "w1": 1},
                {"id": 2, "en": "b", "speech_s": 1.1, "speech_e": 2, "w1": 2},
                {"id": 3, "en": "um", "speech_s": 2.2, "speech_e": 2.5, "w1": 3}]
        out, w = apply_merges(cues, {"1": "אב", "2": "=", "3": "∅"}, 7.0)
        self.assertEqual(len(out), 1)
        self.assertEqual(out[0]["speech_e"], 2)


class TestAdapters(unittest.TestCase):
    def test_elevenlabs(self):
        d = {"language_code": "en", "words": [
            {"text": "Hello", "start": 0.1, "end": 0.4, "type": "word", "speaker_id": "speaker_1", "logprob": -0.1},
            {"text": " ", "start": 0.4, "end": 0.5, "type": "spacing", "speaker_id": "speaker_1"},
            {"text": "(laughs)", "start": 0.5, "end": 1.0, "type": "audio_event", "speaker_id": "speaker_0"},
            {"text": "there.", "start": 1.0, "end": 1.3, "type": "word", "speaker_id": "speaker_0"}]}
        r = normalize_elevenlabs(d)
        self.assertEqual([w["w"] for w in r["words"]], ["Hello", "there."])
        self.assertEqual([w["spk"] for w in r["words"]], ["S1", "S2"])
        self.assertEqual(len(r["events"]), 1)

    def test_assemblyai(self):
        d = {"words": [{"text": "Hi", "start": 100, "end": 300, "confidence": 0.9, "speaker": "A"},
                       {"text": "there", "start": 320, "end": 600, "confidence": 0.8, "speaker": "B"}]}
        r = normalize_assemblyai(d)
        self.assertAlmostEqual(r["words"][0]["s"], 0.1)
        self.assertEqual(r["words"][1]["spk"], "S2")

    def test_parakeet_tokens(self):
        ws = tokens_to_words([" P", "ick", "ed", " off", ","], [0.08, 0.16, 0.32, 0.4, 0.5], 10.0, 11.0)
        self.assertEqual([w["w"] for w in ws], ["Picked", "off,"])
        self.assertAlmostEqual(ws[0]["s"], 10.08)

    def test_align_chunks(self):
        ws = words_from(" ".join(["word"] * 1500), 0.0, step=0.25, gap=0.05)
        ch = plan_chunks(ws, 170.0)
        self.assertEqual(ch[0][0], 0)
        self.assertEqual(ch[-1][1], len(ws))
        for i0, i1, cs, ce in ch:
            self.assertLessEqual(ce - cs, 171.0)
        self.assertEqual(clean_token("U.S.,"), "US")



class TestMaxDurationHard(unittest.TestCase):
    def test_snap_after_cut_never_exceeds_7s(self):
        from vt.timing import time_cues
        from vt.config import timing_rules
        from vt.util import FrameGrid
        from fractions import Fraction
        g = FrameGrid(Fraction(24000, 1001), 0.0)
        cut = g.frame_floor(10.0)
        cues = [{"speech_s": 10.3, "speech_e": 17.15, "chars": 80},
                {"speech_s": 30.0, "speech_e": 33.0, "chars": 30}]
        out = time_cues(cues, g, [cut], timing_rules())
        mx = int(7 * g.fps_f + 1e-9)
        for c in out:
            self.assertLessEqual(c["fo"] - c["fi"], mx)
        self.assertIn("no_snap_max", out[0]["flags"])


class TestCtcConsensus(unittest.TestCase):
    def test_spoken_forms(self):
        from vt.align_ctc import spoken
        self.assertEqual(spoken("10%"), "tenpercent")
        self.assertEqual(spoken("$100"), "onehundreddollars")
        self.assertEqual(spoken("2005"), "twothousandfive")
        self.assertEqual(spoken("1999"), "nineteenninetynine")
        self.assertEqual(spoken("30,000"), "thirtythousand")
        self.assertEqual(spoken("2.5"), "twopointfive")
        self.assertEqual(spoken("Oscar-nominated."), "oscarnominated")
        self.assertEqual(spoken("don’t"), "don't")
        self.assertEqual(spoken("café"), "cafe")

    def test_median_rejects_outlier_and_keeps_order(self):
        from vt.align_ctc import consensus
        w = [{"w": "a", "s": 1.0, "e": 1.2, "align": "qwen3", "s_ctc": 1.02, "e_ctc": 1.18, "s_asr": 1.01, "e_asr": 1.4},
             # Qwen הקדים בשנייה — שני המקורות האחרים מכריעים
             {"w": "b", "s": 1.2, "e": 1.3, "align": "qwen3", "s_ctc": 2.2, "e_ctc": 2.4, "s_asr": 2.25, "e_asr": 2.5},
             {"w": "c", "s": 2.6, "e": 2.8, "align": "qwen3", "s_ctc": 2.62, "e_ctc": 2.78, "s_asr": 2.58, "e_asr": 2.9}]
        consensus(w)
        self.assertAlmostEqual(w[1]["s"], 2.2, places=2)
        for i in range(len(w) - 1):
            self.assertLessEqual(w[i]["s"], w[i + 1]["s"])
            self.assertLessEqual(w[i]["e"], w[i + 1]["s"] + 1e-9)


class TestRetime(unittest.TestCase):
    def test_retime_updates_speech_and_parts(self):
        from vt.segment import retime
        from vt.config import timing_rules, text_rules
        words = [{"w": "Sure.", "s": 1.5, "e": 1.9, "spk": "S2"},
                 {"w": "Thanks.", "s": 2.0, "e": 2.4, "spk": "S1"}]
        cues = [{"id": 1, "w0": 0, "w1": 1, "speech_s": 1.0, "speech_e": 2.4, "en": "Sure. Thanks.",
                 "parts": [{"spk": "S2", "en": "Sure.", "speech_s": 1.0, "speech_e": 1.4},
                           {"spk": "S1", "en": "Thanks.", "speech_s": 1.5, "speech_e": 2.4}]}]
        st = retime(words, cues, timing_rules(), text_rules())
        self.assertEqual(cues[0]["speech_s"], 1.5)
        self.assertEqual(cues[0]["parts"][0]["speech_e"], 1.9)
        self.assertEqual(cues[0]["parts"][1]["speech_s"], 2.0)
        self.assertEqual(st["moved_over_300ms"], 1)


class TestHebrewLineBreaks(unittest.TestCase):
    """שבירות שנמצאו שגויות במבחן מול TED — לא לחזור עליהן."""
    def _split(self, text):
        from vt.hebrew import break_lines
        lines, ok = break_lines(text, 42)
        self.assertTrue(ok)
        self.assertEqual(len(lines), 2)
        return lines

    def test_fixed_expression_not_split(self):
        top, bottom = self._split("ולמשפחות מעוטות הכנסה בדרך כלל אין את האפשרויות האלה.")
        self.assertFalse(top.endswith("בדרך"))
        top, bottom = self._split("אתה צודק שבפועל אי אפשר לסמוך רק על אלגוריתמים בכלל.")
        self.assertFalse(top.endswith("אי"))

    def test_construct_and_conjunction(self):
        top, bottom = self._split("האלגוריתמים הם חלק אחד, לצד הזמנת התוכן והיחסים שלנו עם הציבור בכל מדינה.")
        self.assertFalse(top.endswith("הזמנת"))
        self.assertTrue(bottom.startswith("והיחסים"))

    def test_number_and_noun(self):
        top, bottom = self._split("היו לכם יותר מ־6 מיליון מנויים וקצב צמיחה בריא.")
        self.assertFalse(top.endswith("מיליון"))

    def test_possessive_and_demonstrative_stay(self):
        top, _ = self._split("פעם פתחתם את האלגוריתם שלכם לכל העולם ואמרתם:")
        self.assertFalse(top.endswith("האלגוריתם"))

    def test_manual_break(self):
        from vt.hebrew import break_lines
        lines, ok = break_lines("כלומר, זה לא היה | \"נשחרר פרק אחרי פרק ונבנה ציפייה\".", 42)
        self.assertEqual(lines[0], "כלומר, זה לא היה")


class TestSmallCopy(unittest.TestCase):
    def test_bitrate_fits_target(self):
        from vt.render import small_bitrate, SMALL_AUDIO_KBPS
        v = small_bitrate(1242.1, 28)                       # שיחת TED של 20:42
        size_mb = (v + SMALL_AUDIO_KBPS) * 1000 * 1242.1 / 8 / 1048576
        self.assertLess(size_mb, 28)
        self.assertGreater(v, 100)

    def test_long_video_too_low(self):
        from vt.render import small_bitrate, SMALL_MIN_VIDEO_KBPS
        self.assertLess(small_bitrate(3600, 28), SMALL_MIN_VIDEO_KBPS)   # שעה לא נכנסת ב־30MB בצורה סבירה

class TestOverlay(unittest.TestCase):
    """צריבה מהירה (v1.3): אותה החלטה כמו libass לכל פריים אמיתי."""

    def test_segments_follow_libass_rule(self):
        from vt.overlay import segments
        # פריימים ב־24fps כמו ש־ffprobe מחזיר ב־MKV (מעוגל למ״ש)
        times = [round(k * 1000 / 24) for k in range(100)]
        ev = [(1.00, 2.00, "0", "a"), (1.00, 2.00, "1", "a2"), (2.08, 3.00, "0", "b")]
        segs = segments(ev, times)
        self.assertEqual(segs[0][:2], (24, 48))          # 1.000 ≤ t < 2.000
        self.assertEqual(segs[0][2], (0, 1))             # שתי השכבות יחד
        self.assertEqual(segs[1][:2], (50, 72))          # 2.083 (פריים 50) — 2.08 ≤ 2.083
        self.assertEqual(len(segs), 2)

    def test_band_from_pos(self):
        from vt.overlay import _band
        head = ["Style: Main,Arimo,88.0,&H00FFFFFF"]
        ev = [(0, 1, "0", "Main,1,0,0,0,,{\\an2\\pos(960.0,938.0)}x"),
              (0, 1, "0", "Main,1,0,0,0,,{\\an2\\pos(960.0,1012.0)}y")]
        y0, y1 = _band(head, ev, 1920, 1080)
        self.assertLess(y0, 938 - 88)
        self.assertGreaterEqual(y1, 1012)
        self.assertEqual(y0 % 2, 0)

    def test_concat_list_offsets(self):
        import json, tempfile
        from vt.overlay import write_list
        with tempfile.TemporaryDirectory() as td:
            times = [round(k * 1000 / 24) for k in range(240)]
            json.dump({"key": "x", "y0": 774, "times": times, "segs": [[24, 48], [120, 200]],
                       "names": ["s00000.png", "s00001.png"]}, open(Path(td) / "segments.json", "w"))
            rows = write_list(Path(td)).read_text().split("\n")
            self.assertEqual(rows[1:5], ["file blank.png", "duration 0.979000", "file s00000.png", "duration 1.000000"])
            clip = write_list(Path(td), 4.0, 9.0).read_text()
            self.assertNotIn("s00000.png", clip)         # לפני תחילת הקטע
            self.assertIn("file s00001.png", clip)


class TestPlayerAss(unittest.TestCase):
    def test_one_event_per_cue(self):
        from vt.subs import write_ass_compat
        g = FrameGrid(Fraction(25))
        cues = [{"id": 1, "speech_s": 1.0, "speech_e": 2.0, "chars": 10, "lines": ["שורה א", "שורה ב"]}]
        time_cues(cues, g, [], C.TimingRules())
        ass = write_ass_compat(cues, C.STYLES["bold"], 1920, 1080)
        self.assertEqual(ass.count("Dialogue:"), 1)
        self.assertIn("\\N" + RLM + "שורה ב", ass)
        self.assertNotIn("\\pos", ass)
        self.assertIn(",2,100,100,68,-1", ass)            # מרכז־תחתית, שוליים כמו בצריבה


class TestEditPatch(unittest.TestCase):
    def test_patch(self):
        from vt.transcript import apply_patch
        t = "[S1] we raised forty million and C is great Yeah thanks Gary"
        out, errs = apply_patch(t, "# הערה\nforty million => $40 million\nC is => C++ is\nYeah thanks Gary => \\n[S2] Yeah, thanks, Gary.")
        self.assertEqual(errs, [])
        self.assertIn("$40 million", out)
        self.assertIn("C++ is", out)
        self.assertTrue(out.endswith("\n[S2] Yeah, thanks, Gary."))

    def test_patch_ambiguous_changes_nothing(self):
        from vt.transcript import apply_patch
        t = "the the end"
        out, errs = apply_patch(t, "the => a")
        self.assertEqual(out, t)
        self.assertEqual(len(errs), 1)


class TestSourceAndFixes(unittest.TestCase):
    def test_source_single_file(self):
        from vt.translate import render_source
        cues = [{"id": i, "en": f"Sentence {i}.", "spk": "S1" if i < 4 else "S2", "budget": 30,
                 "speech_s": float(i)} for i in range(1, 8)]
        src, nb = render_source(cues, {}, size=3)
        self.assertEqual(src.count("#1 ≤30 Sentence 1."), 1)
        self.assertIn("→ batch_001.he.txt", src)
        self.assertEqual((nb, src.count("**") // 2), (3, 3))   # כותרת דובר בתחילת כל חלק ובכל החלפה

    def test_fixes_override(self):
        import tempfile
        from vt.translate import load_answers
        with tempfile.TemporaryDirectory() as td:
            (Path(td) / "batch_001.he.txt").write_text("#1 ישן\n#2 שתיים\n", encoding="utf-8")
            (Path(td) / "fixes.txt").write_text("#1 חדש\n", encoding="utf-8")
            he, dups = load_answers(Path(td))
            self.assertEqual(he["1"], "חדש")
            self.assertEqual(dups, [])


if __name__ == "__main__":
    unittest.main()
