"""ייבוא קובץ כתוביות (22/10/2026): קידוד, SRT/VTT/ASS, ניקוי, SDH, הטיה ומיקום, המרה ל־vt."""
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import subsimport as S  # noqa: E402

# קובצי הדוגמה ב־JSON (base64) — קובצי כתוביות לא נכנסים לריפו כקבצים (studio-v358: שומר פרטיות)
import base64  # noqa: E402
import json  # noqa: E402
import tempfile  # noqa: E402
FX = Path(tempfile.mkdtemp(prefix="subsfx-"))
for _n, _b in json.loads((HERE / "fixtures" / "subs.json").read_text()).items():
    (FX / _n).write_bytes(base64.b64decode(_b))


def imp(name, **kw):
    return S.import_subs((FX / name).read_bytes(), **kw)


class Decode(unittest.TestCase):
    def test_encodings_same_result(self):
        a, b = imp("show.srt"), imp("show.utf16.srt")
        self.assertEqual(a["cues"], b["cues"])
        self.assertEqual((a["enc"], a["fixed"]), ("utf-8", False))
        self.assertEqual((b["enc"], b["fixed"]), ("utf-16", True))

    def test_cp1252_fixed(self):
        r = imp("show.cp1252.srt")
        self.assertEqual((r["enc"], r["fixed"]), ("windows-1252", True))
        self.assertIn("- Café liar.", r["cues"][2]["lines"])

    def test_bom(self):
        r = S.import_subs(b"\xef\xbb\xbf1\n00:00:01,000 --> 00:00:02,000\nHi\n")
        self.assertEqual(r["cues"][0]["lines"], ["Hi"])


class Srt(unittest.TestCase):
    def test_show(self):
        r = imp("show.srt")
        st = r["stats"]
        self.assertEqual(st["n"], 5)
        self.assertEqual((st["ads"], st["dups"], st["overlaps"], st["labels"], st["dual"], st["top"], st["it"], st["pit"]),
                         (1, 1, 1, 2, 1, 1, 1, 1))
        self.assertEqual(r["names"], [("Michael", 1), ("Sarah", 1)])
        c = r["cues"]
        self.assertEqual(c[0]["lines"], ["Previously on The Show..."])
        self.assertTrue(c[0]["it"])
        self.assertEqual(c[1]["e"], 8500)                       # החפיפה תוקנה — נגמרת כשהבאה מתחילה
        self.assertEqual((c[2]["spk"], c[2]["spk2"]), ("", "Sarah"))
        self.assertTrue(c[3]["top"])
        self.assertEqual((c[4]["s"], c[4]["e"], c[4]["lines"]), (15000, 19000, ["Fine, you win."]))

    def test_keep_sdh(self):
        r = imp("show.srt", sdh=False)
        self.assertIn(["[DOOR SLAMS]"], [c["lines"] for c in r["cues"]])
        self.assertEqual(r["stats"]["labels"], 0)

    def test_glued_blocks_and_order(self):
        t = ("2\n00:00:05,000 --> 00:00:06,000\nB\n3\n00:00:07,000 --> 00:00:08,000\nC\n\n"
             "1\n00:00:01,000 --> 00:00:02,000\nA\n")
        r = S.import_subs(t.encode())
        self.assertEqual([c["lines"][0] for c in r["cues"]], ["A", "B", "C"])
        self.assertEqual(r["stats"]["sorted"], 1)

    def test_repeat_without_overlap_kept(self):
        # "Hey." / "Hey." משני דוברים — דיבור שחוזר, לא כפילות (פרק אמיתי, 22/10/2026)
        t = "1\n00:00:01,000 --> 00:00:02,000\nHey.\n\n2\n00:00:02,100 --> 00:00:03,000\nHey.\n"
        r = S.import_subs(t.encode())
        self.assertEqual((r["stats"]["n"], r["stats"]["dups"]), (2, 0))

    def test_sign_is_not_label(self):
        r = S.import_subs(b"1\n00:00:01,000 --> 00:00:02,000\nWARNING: HIGH VOLTAGE\n")
        self.assertEqual(r["cues"][0]["lines"], ["WARNING: HIGH VOLTAGE"])
        self.assertEqual(r["stats"]["labels"], 0)


class VttAss(unittest.TestCase):
    def test_vtt(self):
        r = imp("talk.vtt")
        self.assertEqual([c["lines"] for c in r["cues"]], [["It began in 1999."], ["Second line"]])
        self.assertTrue(r["cues"][0]["top"])
        self.assertEqual(r["cues"][0]["s"], 1000)

    def test_ass(self):
        r = imp("ep.ass")
        self.assertEqual(r["stats"]["n"], 3)                    # תגובה וציור — לא כתוביות
        self.assertTrue(r["cues"][0]["it"])                    # {\i1} נמשך על פני \N
        self.assertEqual(r["cues"][0]["spk"], "Anna")
        self.assertTrue(r["cues"][1]["top"])
        self.assertEqual(r["cues"][2]["lines"], ["Text, with commas, kept"])


class ToVt(unittest.TestCase):
    def test_template_cues(self):
        cues, spk = S.to_vt(imp("show.srt"))
        self.assertEqual(spk, {"S1": {"name": "Michael"}, "S2": {"name": "Sarah"}})
        self.assertTrue(all(c["tpl"] == 1 for c in cues))
        self.assertEqual([c["id"] for c in cues], [1, 2, 3, 4, 5])
        d = cues[2]
        self.assertEqual([p["en"] for p in d["parts"]], ["I was at work.", "Liar."])
        self.assertEqual(d["parts"][1]["spk"], "S2")
        self.assertEqual((cues[0].get("it"), cues[3].get("top")), (1, 1))

    def test_transcript(self):
        t = S.transcript(imp("show.srt"))
        self.assertIn("[0:00:06 Michael] Where were you last night?", t)


if __name__ == "__main__":
    unittest.main()


class VtBuild(unittest.TestCase):
    """vt import-subs → tr-merge → build, בלי סרטון: הזמנים נשמרים, ההטיה והמיקום יוצאים בקבצים."""

    def test_end_to_end(self):
        import json
        import os
        import tempfile
        try:
            import fontTools  # noqa: F401 — build מודד רוחב בגופן
        except ImportError:
            self.skipTest("fontTools לא מותקן (בסביבת vt בלבד)")
        from vt import cli
        with tempfile.TemporaryDirectory() as w:
            old = os.environ.get("VT_WORK")
            os.environ["VT_WORK"] = w
            try:
                cli.main(["import-subs", "t1", "--file", str(FX / "show.srt")])
                d = Path(w) / "t1"
                cues = json.loads((d / "cues.en.json").read_text(encoding="utf-8"))
                meta = json.loads((d / "project.json").read_text(encoding="utf-8"))
                self.assertEqual(meta["src"], "subs")
                self.assertEqual(json.loads((d / "media.json").read_text())["video"], None)
                ans = []
                for c in cues:
                    ans.append(f"#{c['id']} " + ("כן || לא" if c.get("parts") else "שלום לכם"))
                (d / "tr").mkdir(exist_ok=True)
                (d / "tr" / "batch_001.he.txt").write_text("\n".join(ans) + "\n", encoding="utf-8")
                cli.main(["tr-merge", "t1"])
                cli.main(["build", "t1"])
                fin = json.loads((d / "out" / "cues.final.json").read_text(encoding="utf-8"))
                by = {c["id"]: c for c in fin}
                for c in cues:
                    self.assertLess(abs(by[c["id"]]["start"] - c["speech_s"]), 0.045)   # פריים אחד ב־23.976
                srt = (d / "out" / "he.srt").read_text(encoding="utf-8-sig")
                self.assertIn("<i>", srt)
                self.assertIn("{\\an8}", srt)
                vtt = (d / "out" / "he.vtt").read_text(encoding="utf-8")
                self.assertIn(" line:0", vtt)
                ass = (d / "out" / "he.ass").read_text(encoding="utf-8")
                self.assertIn("\\an8", ass)
                self.assertIn("\\i1", ass)
            finally:
                if old is None:
                    os.environ.pop("VT_WORK", None)
                else:
                    os.environ["VT_WORK"] = old
