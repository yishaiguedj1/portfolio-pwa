"""שבירת שורות (25/10/2026): בחירה של Claude › מודל תחבירי › הכללים. משפטים סינתטיים בלבד, בלי המודל האמיתי."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from vt import hebrew as H  # noqa: E402
from vt import linebreak as LB  # noqa: E402

TEXT = "אתמול בבוקר הלכנו כולנו יחד לבית הספר החדש של העיר"     # 52 תווים — שתי שורות


class FakeModel:
    """עץ תלויות קבוע: "בית הספר" סמיכות, "לבית" ← "הלכנו"."""

    def __init__(self, toks):
        self._toks = toks
        self.asked = []

    def toks(self, text):
        self.asked.append(text)
        return self._toks


def tree_for(words):
    # כל מילה תלויה בקודמת שלה (שרשרת), חוץ מ"הספר" שתלוי ב"לבית" בסמיכות — לחתוך שם יקר
    out = []
    for i, w in enumerate(words):
        if i == 0:
            out.append([w, -1, "root"])
        elif w == "הספר":
            out.append([w, i - 1, "compound:smixut"])
        else:
            out.append([w, i - 1, "conj"])
    return out


class TestHook(unittest.TestCase):
    def tearDown(self):
        H.set_break_chooser(None)

    def test_rules_without_chooser(self):
        lines, ok = H.break_lines(TEXT, 42)
        self.assertTrue(ok)
        self.assertEqual(len(lines), 2)

    def test_pick_wins_and_must_be_valid(self):
        toks = H.normalize_he(TEXT).split(" ")
        ch = LB.Chooser({" ".join(toks): 4})
        H.set_break_chooser(ch)
        lines, ok = H.break_lines(TEXT, 42)
        self.assertEqual(lines[0], " ".join(toks[:4]))
        self.assertEqual(ch.used["pick"], 1)
        ch.picks[" ".join(toks)] = 1                     # שורה עליונה של מילה אחת — ארוכה מ־42 בתחתונה: לא תקפה
        lines2, _ = H.break_lines(TEXT, 42)
        self.assertNotEqual(lines2[0], toks[0])

    def test_tree_avoids_cutting_construct(self):
        toks = H.normalize_he(TEXT).split(" ")
        fm = FakeModel(tree_for(toks))
        ch = LB.Chooser({}, fm)
        H.set_break_chooser(ch)
        lines, ok = H.break_lines(TEXT, 42)
        self.assertTrue(ok)
        self.assertFalse(lines[0].endswith("לבית") and lines[1].startswith("הספר"), lines)
        self.assertEqual(ch.used["tree"], 1)

    def test_manual_break_and_one_line_untouched(self):
        ch = LB.Chooser({}, FakeModel([]))
        H.set_break_chooser(ch)
        self.assertEqual(H.break_lines("שורה א | שורה ב", 42)[0], ["שורה א", "שורה ב"])
        self.assertEqual(H.break_lines("קצר", 42)[0], ["קצר"])
        self.assertEqual(ch.used, {"pick": 0, "tree": 0, "rules": 0})


class TestHaikuFiles(unittest.TestCase):
    def cues(self):
        return [{"id": 1, "he": TEXT}, {"id": 2, "he": "קצר מאוד"}, {"id": 3, "he": "שלום || מה נשמע"},
                {"id": 4, "he": "שבירה | ידנית"}]

    def test_items_only_multi_choice(self):
        items = LB.items_for(self.cues(), 42, None, None)
        self.assertEqual([it["id"] for it in items], [1])
        self.assertGreaterEqual(len(items[0]["cands"]), 2)
        self.assertLessEqual(len(items[0]["cands"]), LB.MAX_CANDS)

    def test_prompt_and_answer_roundtrip(self):
        items = LB.items_for(self.cues(), 42, None, None)
        p = LB.prompt(items)
        self.assertIn("### 1", p)
        self.assertIn("<items>", p)
        ans = "#1 2\n#9 1\n#1 99\nהסבר כלשהו\n"
        got = LB.parse_answer(ans, items)
        self.assertEqual(got, {items[0]["text"]: items[0]["cands"][1]})
        self.assertEqual(LB.parse_answer("#1 0", items), {})

    def test_picks_file(self):
        with tempfile.TemporaryDirectory() as td:
            p = Path(td) / "linebreak.json"
            p.write_text(json.dumps({"v": 1, "picks": {"א ב": 1, "ג": "x", "ד": -2}}), encoding="utf-8")
            self.assertEqual(LB.load_picks(p), {"א ב": 1})
            self.assertEqual(LB.load_picks(Path(td) / "חסר.json"), {})

    def test_model_absent_is_safe(self):
        m = LB.DepModel(Path("/nonexistent/linebreak"))
        self.assertFalse(m.available())
        self.assertIsNone(m.toks("משפט כלשהו"))


if __name__ == "__main__":
    unittest.main()
