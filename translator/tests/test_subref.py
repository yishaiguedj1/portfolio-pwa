"""26/10/2026: רצועת הכתוביות שבקובץ (files.r) — עזר להגהת התמלול."""

from __future__ import annotations

import shutil
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402
import pipeline as P  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parent))
from test_hedge_proof import long_edit  # noqa: E402
from test_pipeline import Client, Ctx, FakeJ, msg  # noqa: E402

REF = "[00:00:01] Hello from Nvidia.\n[00:05:00] The guts of the machine.\n[00:11:10] Goodbye.\n"


class TestRefLines(unittest.TestCase):
    def test_parse_and_clean(self):
        lines = P.ref_lines("junk\n[00:00:01] Hi <i>there</i>\x07\n[1:02:03.500] Late line\n[00:00:09]   \nno tag here\n")
        self.assertEqual([t for t, _ in lines], [1.0, 3723.0])
        self.assertEqual(lines[0][1], "[00:00:01] Hi  i there /i")
        self.assertEqual(lines[1][1], "[01:02:03] Late line")

    def test_cap(self):
        big = "".join(f"[00:00:{i % 60:02d}] " + "x" * 300 + "\n" for i in range(2000))
        self.assertLessEqual(sum(len(l) + 1 for _, l in P.ref_lines(big)), P.SUBREF_MAX)

    def test_window(self):
        lines = P.ref_lines(REF)
        part = "[S1 00:04:50.000] a b c\n[S2 00:05:10.000] d e\n"
        self.assertEqual(P.ref_window(lines, part), "[00:05:00] The guts of the machine.")
        self.assertEqual(P.ref_window(lines, "no tags"), "")


class TestProofreadWithRef(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.pd = self.tmp / "job"
        (self.pd / "tr").mkdir(parents=True)
        self.ctx, self.J = Ctx(self.pd), FakeJ(self.pd)
        self.got = []

        def fetch_input(ctx, fid, dest, size, on_progress=None):
            self.got.append(fid)
            if fid == "bad":
                raise SystemExit("✗ ההורדה מהאחסון נכשלה")
            Path(dest).write_text(REF, encoding="utf-8")
        self.J.fetch_input = fetch_input

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def run_pl(self, edit, rid):
        if rid:
            self.ctx.st["files"] = {"r": {"id": rid, "size": len(REF)}}
        (self.pd / "en.edit.txt").write_text(edit, encoding="utf-8")
        calls = []

        def h(kw):
            content = kw["messages"][0]["content"]
            calls.append((" ".join(b["text"] for b in kw["system"]), kw["system"][0]["text"], content))
            if "<transcript>" in content:
                return msg("=== PATCH ===\n=== BRIEF ===\nתדריך\n=== GLOSSARY ===\n=== QUESTIONS ===\n[]")
            return msg("")
        pl = P.Pipeline(self.ctx, self.J, llm.Engine(llm.Spec.of("haiku-high"), client=Client(h)))
        pl.proofread()
        return calls

    def test_ref_in_prompt_not_in_fixed(self):
        calls = self.run_pl(long_edit(2, 50), "R2_job_abcdefghijkl")
        self.assertEqual(len(calls), 1)
        _sx, fixed, content = calls[0]
        self.assertIn("<existing_subtitles>", content)
        self.assertIn("[00:05:00] The guts of the machine.", content)
        self.assertLess(content.index("<existing_subtitles>"), content.index("<transcript>"))
        self.assertNotIn("existing_subtitles", fixed, "הבלוק הקבוע לא משתנה — המטמון נשמר")
        self.assertTrue((self.pd / "en.ref.txt").exists())
        self.run_pl(long_edit(2, 50), "R2_job_abcdefghijkl")
        self.assertEqual(self.got, ["R2_job_abcdefghijkl"], "מורד פעם אחת")

    def test_no_ref(self):
        calls = self.run_pl(long_edit(2, 50), "")
        self.assertNotIn("existing_subtitles", calls[0][2])
        self.assertEqual(self.got, [])

    def test_failed_download_continues(self):
        calls = self.run_pl(long_edit(2, 50), "bad")
        self.assertNotIn("existing_subtitles", calls[0][2])
        self.assertFalse((self.pd / "en.ref.txt").exists())

    def test_parts_get_their_window(self):
        calls = self.run_pl(long_edit(12, 500), "R2_job_abcdefghijkl")
        # החלקים רצים במקביל — הסדר שבו הקריאות נרשמות משתנה; ממיינים לפי מספר החלק
        parts = sorted((c[2] for c in calls if "(חלק " in c[2]),
                       key=lambda t: int(t.split("(חלק ", 1)[1].split()[0]))
        self.assertGreaterEqual(len(parts), 2)
        self.assertIn("The guts of the machine", parts[0], "חלק 1 (דקות 0–4) — כולל את הכתובית של 5:00 במרווח")
        self.assertNotIn("Goodbye", parts[0])
        self.assertIn("Goodbye", parts[-1])


if __name__ == "__main__":
    unittest.main()
