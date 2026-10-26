"""25/10/2026 (ניתוח האיכות): הסתייגות שנשמטה ([hdg] בבודק + ההנחיות) והגהה בחלקים לתמליל ארוך."""

from __future__ import annotations

import shutil
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace as NS

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402
import pipeline as P  # noqa: E402
from vt.transcript import apply_patch  # noqa: E402
from vt.translate import CHECK_CODE_RE, CHECK_CODES, check, hedge_kept_he, hedges_in  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_pipeline import Client, Ctx, FakeJ, msg  # noqa: E402


def run_check(pairs):
    cues = [{"id": i + 1, "en": en, "budget": 84} for i, (en, _h) in enumerate(pairs)]
    he = {str(i + 1): h for i, (_e, h) in enumerate(pairs)}
    return check(cues, he, [])


def hdg_ids(issues):
    return [CHECK_CODE_RE.match(x).group(1) for x in issues if CHECK_CODE_RE.match(x).group(2) == "hdg"]


class TestHedgeDetect(unittest.TestCase):
    def test_english_hedges(self):
        self.assertEqual(hedges_in("we believe this happened around nine in the morning"), ["we believe", "around nine"])
        self.assertEqual(hedges_in("You probably should be a seller."), ["probably"])
        self.assertEqual(hedges_in("I don't think advertising companies can track"), ["I don't think"])
        self.assertEqual(hedges_in("It may be the case."), ["may"])
        self.assertEqual(hedges_in("for about 50 years"), ["about 50"])
        # לא הסתייגות: החודש, "think about", "believe in", "kind of" (מילת מילוי), "try to", "about" בלי מספר
        for en in ("In May 2020 we launched.", "I think about it a lot.", "We believe in people.",
                   "That kind of working mode.", "It's kind of interesting.", "We try not to think in those terms.",
                   "Let's talk about Netflix."):
            self.assertEqual(hedges_in(en), [], en)

    def test_hebrew_kept(self):
        for he in ("אולי לא מספיק.", "כנראה כדאי למכור.", "לדעתי מהנדסים הם מנכ\"לים טובים.", "זה קרה בסביבות תשע.",
                   "תמשיכי צפונה כשלוש שעות.", "כ־3 שעות", "אני לא חושב שהן יכולות", "נראה לי שזה נכון"):
            self.assertTrue(hedge_kept_he(he), he)
        for he in ("חברות פרסום לא עוקבות אחרי מיקום.", "אז בבועות כדאי למכור.", "זה קרה בתשע בבוקר."):
            self.assertFalse(hedge_kept_he(he), he)


class TestHedgeCheck(unittest.TestCase):
    def test_dropped_hedge_flagged_soft(self):
        self.assertEqual(CHECK_CODES["hdg"], "s")
        issues, st = run_check([("So in bubbles, you probably should be a seller.", "אז בבועות כדאי למכור."),
                                ("Prices go up.", "המחירים עולים."),
                                ("Maybe a good example is Coca Cola.", "אולי דוגמה טובה היא קוקה קולה.")])
        self.assertEqual(hdg_ids(issues), ["1"], issues)
        self.assertEqual(st["hedges"], 1)
        hard, soft = P.parse_issues("\n".join(issues))
        self.assertIn("1", soft)
        self.assertNotIn("1", hard)
        self.assertEqual(P.CODE_RANK["hdg"], P.CODE_RANK["q"], "הסתייגות = משמעות, באותה דרגה של שאלה שנבלעה")

    def test_hedge_moved_to_neighbor_or_merged(self):
        # סדר המילים בעברית: "לדעתי" עבר לכתובית הקודמת / לכתובית שאוחדה ('=' אחריה) — לא חסר
        issues, _ = run_check([("Engineers make good CEOs,", "לדעתי מהנדסים"),
                               ("I think, and it serves me to this day.", "הם מנכ\"לים טובים, וזה משרת אותי עד היום.")])
        self.assertEqual(hdg_ids(issues), [], issues)
        issues, _ = run_check([("We were not safe,", "לא היינו בטוחים,"),
                               ("I guess, so we left", "אז עזבנו, כנראה"),
                               ("and that was it.", "=")])
        self.assertEqual(hdg_ids(issues), [], issues)

    def test_merged_cue_not_checked(self):
        issues, _ = run_check([("We came here", "באנו לכאן, אחרי"), ("maybe in 1980.", "=")])
        self.assertEqual(hdg_ids(issues), [], "כתובית '=' לא נבדקת לבד")


EDIT_HEAD = "# קובץ הגהה\n# הערה\n\n"


def long_edit(n_lines=12, words=500):
    lines = []
    for i in range(n_lines):
        body = " ".join(f"w{i}x{j}" for j in range(words))
        lines.append(f"[S1 00:{i:02d}:00.000] Line{i} start {body} the guts and the machine end{i}.")
    return EDIT_HEAD + "\n".join(lines) + "\n"


class TestProofChunks(unittest.TestCase):
    def test_chunks_cover_lines(self):
        text = long_edit(12, 500)
        spans = P.proof_chunks(text, 2500)
        self.assertGreaterEqual(len(spans), 2)
        self.assertEqual(spans[0][0], len(EDIT_HEAD), "שורות ההערה בראש — לא בחלק")
        self.assertEqual(spans[-1][1], len(text))
        for (a, b), (c, _d) in zip(spans, spans[1:]):
            self.assertEqual(b, c, "בלי חור ובלי חפיפה")
            self.assertEqual(text[b - 1], "\n", "בגבול שורה")
        # שארית קטנה מצטרפת לחלק האחרון
        self.assertEqual(len(P.proof_chunks(EDIT_HEAD + "[S1] " + "a " * 2600 + "\n[S1] b c\n", 2500)), 1)

    def test_part_patch_local_and_unique(self):
        text = long_edit(12, 500)
        spans = P.proof_chunks(text, 2500)
        a, b = spans[1]
        # "the guts and the machine" מופיע בכל שורה — בחלק 2 התיקון חל רק על המופע שבו, וההקשר מורחב לייחודיות בכל הקובץ
        line_in = text[a:b].splitlines()[0]
        tag = line_in.split(" start ")[0].split("] ")[1]                 # LineN
        n = int(tag[4:])
        patch = f"`the guts and the machine end{n}. => the guts of the machine end{n}.`\nnonexistent words => x\n"
        cur, ok, dropped = P.valid_patch_part(text, patch, a, b)
        self.assertEqual(len(ok), 1, ok)
        self.assertEqual([d.split(":")[0] for d in dropped], ["nf"])
        out, errs = apply_patch(text, "\n".join(ok) + "\n")
        self.assertEqual(errs, [])
        self.assertEqual(out, cur, "vt מחיל בדיוק את מה שהסימולציה חישבה")
        self.assertEqual(cur.count("the guts of the machine"), 1)
        # ביטוי שמופיע פעמיים בתוך החלק — עמום, נזרק
        cur2, ok2, dr2 = P.valid_patch_part(text, "the guts and the machine => the guts of the machine\n", a, b)
        self.assertEqual(ok2, [])
        self.assertEqual(dr2[0].split(":")[0], "amb")
        # מה שההגהה הראשית כבר תיקנה — בשקט
        fixed = text[:a] + text[a:b].replace("Line", "Lyne", 1) + text[b:]
        _c, ok3, dr3 = P.valid_patch_part(fixed, f"Line{n} start => Lyne{n} start\n", a, b)
        self.assertEqual((ok3, dr3), ([], []))


class TestProofreadParts(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.pd = self.tmp / "job"
        (self.pd / "tr").mkdir(parents=True)
        self.ctx, self.J = Ctx(self.pd), FakeJ(self.pd)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_pl(self, edit):
        (self.pd / "en.edit.txt").write_text(edit, encoding="utf-8")
        calls = []

        def h(kw):
            content = kw["messages"][0]["content"]
            sysx = " ".join(b["text"] for b in kw["system"])
            calls.append((sysx, kw["system"][0]["text"], content))
            if "<transcript>" in content:
                return msg("=== PATCH ===\nLine0 start => Line0 begins\n=== BRIEF ===\nתדריך: Line\n"
                           "=== GLOSSARY ===\nNetflix\tנטפליקס\n=== QUESTIONS ===\n[]")
            import re
            ends = re.findall(r"machine (end\d+)\.", content)
            return msg("\n".join(f"the guts and the machine {e}. => the guts of the machine {e}." for e in ends))

        client = Client(h)
        eng = llm.Engine(llm.Spec.of("haiku-high"), client=client)
        pl = P.Pipeline(self.ctx, self.J, eng)
        pl.proofread()
        return calls, client

    def test_long_transcript_gets_part_pass(self):
        edit = long_edit(12, 500)
        calls, _ = self.run_pl(edit)
        parts = [c for c in calls if "קטע אחד מתמליל" in c[0]]
        self.assertEqual(len(parts), len(P.proof_chunks(
            apply_patch(edit, "Line0 start => Line0 begins\n")[0])), "חלק לכל קטע")
        self.assertTrue(all("<brief>" in c[2] and "<glossary>" in c[2] for c in parts), "עם התדריך והמילון של ההגהה הראשית")
        self.assertEqual({c[1] for c in calls}, {calls[0][1]}, "אותו בלוק קבוע של ההגהה הראשית — קוראים מהמטמון")
        patch = (self.pd / "en.patch.txt").read_text(encoding="utf-8")
        out, errs = apply_patch(edit, patch)
        self.assertEqual(errs, [], "כל השורות חלות ב־vt, לפי הסדר")
        self.assertEqual(out.count("the guts of the machine"), 12, "תיקון בכל שורה, מכל החלקים")
        self.assertIn("Line0 begins", out, "התיקון של ההגהה הראשית נשמר")

    def test_short_transcript_one_call(self):
        calls, _ = self.run_pl(long_edit(2, 500))
        self.assertEqual(len(calls), 1)

    def test_failed_part_skipped(self):
        edit = long_edit(12, 500)
        orig = P.Pipeline.proof_parts

        def flaky(self, fixed, cur, brief, gl, terms, *rest):
            real = self.eng.complete

            def complete(k, fixed, prompt, **kw):
                if "(חלק 2 מתוך" in prompt:
                    raise llm.LLMError("api_error")
                return real(k, fixed, prompt, **kw)
            self.eng.complete = complete
            return orig(self, fixed, cur, brief, gl, terms, *rest)
        P.Pipeline.proof_parts = flaky
        try:
            self.run_pl(edit)
        finally:
            P.Pipeline.proof_parts = orig
        out, errs = apply_patch(edit, (self.pd / "en.patch.txt").read_text(encoding="utf-8"))
        self.assertEqual(errs, [])
        self.assertTrue(0 < out.count("the guts of the machine") < 12, "החלק שנכשל — בלעדיו; השאר תוקנו")


class TestPrompts(unittest.TestCase):
    def test_hedge_in_every_writer(self):
        for name in ("TL_TASK", "RV_TASK", "FIX_TASK", "QC_TASK", "PROOF_TASK", "PROOF_PART_TASK"):
            self.assertIn("הסתייגות", getattr(P, name), name)
        self.assertIn("kind of", P.TL_TASK, "מילת מילוי — מותר להשמיט (בלי לכפות)")
        root = Path(__file__).resolve().parents[1]
        for f in ("TRANSLATE.md", "REVIEW.md"):
            self.assertIn("הסתייגות", (root / f).read_text(encoding="utf-8"), f)


if __name__ == "__main__":
    unittest.main()
