"""01/11/2026 (שדרוג הסטודיו, A2): בדיקת התאמת מין ומספר לפי הניתוח הדקדוקי (vt.translate.agreement_*)."""
import unittest

from vt import translate as T
from vt import linebreak as LB


class FakeDep:
    """הניתוח מוכן מראש: טקסט → [טוקן, ראש, קשר, חלק דיבר, מין, מספר, גוף]."""

    def __init__(self, table):
        self.table = table

    def toks(self, text):
        return self.table.get(text)


SELF_M = [["אני", 1, "nsubj", "PRON", "", "Sing", "1"], ["חושב", -1, "root", "VERB", "Masc", "Sing", ""],
          ["שזה", 1, "ccomp", "PRON", "", "", ""]]
GIRL = [["הילדה", 1, "nsubj", "NOUN", "Fem", "Sing", ""], ["הלך", -1, "root", "VERB", "Masc", "Sing", "3"],
        ["הביתה", 1, "advmod", "ADV", "", "", ""]]
PEOPLE = [["האנשים", 1, "nsubj", "NOUN", "Masc", "Plur", ""], ["אמר", -1, "root", "VERB", "Masc", "Sing", "3"]]
OK = [["הילדה", 1, "nsubj", "NOUN", "Fem", "Sing", ""], ["הלכה", -1, "root", "VERB", "Fem", "Sing", "3"]]
PAST = [["אני", 1, "nsubj", "PRON", "", "Sing", "1"], ["הלכתי", -1, "root", "VERB", "", "Sing", "1"]]
OLD = [["אני", 1, "nsubj"], ["חושב", -1, "root"]]       # מטמון ישן בלי מורפולוגיה


class AgreementTest(unittest.TestCase):
    def dep(self):
        return FakeDep({"אני חושב שזה": SELF_M, "הילדה הלך הביתה": GIRL, "האנשים אמר": PEOPLE,
                        "הילדה הלכה": OK, "אני הלכתי": PAST, "ישן": OLD})

    def test_self_gender_vs_speaker(self):
        self.assertEqual(T.agreement_slips("אני חושב שזה", "f", self.dep()), [("self", "אני", "חושב")])
        self.assertEqual(T.agreement_slips("אני חושב שזה", "m", self.dep()), [])
        self.assertEqual(T.agreement_slips("אני חושב שזה", "", self.dep()), [])     # מגדר לא ידוע — לא בודקים

    def test_past_first_person_has_no_gender(self):
        self.assertEqual(T.agreement_slips("אני הלכתי", "f", self.dep()), [])

    def test_subject_predicate(self):
        self.assertEqual(T.agreement_slips("הילדה הלך הביתה", "", self.dep()), [("g", "הילדה", "הלך")])
        self.assertEqual(T.agreement_slips("האנשים אמר", "", self.dep()), [("n", "האנשים", "אמר")])
        self.assertEqual(T.agreement_slips("הילדה הלכה", "", self.dep()), [])

    def test_quote_and_missing_model_are_skipped(self):
        self.assertEqual(T.agreement_slips('"הילדה הלך הביתה"', "", self.dep()), [])
        self.assertEqual(T.agreement_slips("הילדה הלך הביתה", "", None), [])
        self.assertEqual(T.agreement_slips("ישן", "f", self.dep()), [])

    def test_issues_codes_and_dedupe_with_word_list(self):
        cues = [{"id": 1, "spk": "S1"}, {"id": 2, "spk": "S1"}, {"id": 3, "spk": "S1"}]
        he = {"1": "אני חושב שזה", "2": "הילדה הלך הביתה", "3": "הילדה הלכה"}
        sp = {"S1": {"name": "דנה", "gender": "נקבה"}}
        out = T.agreement_issues(cues, he, sp, self.dep())
        self.assertEqual(len(out), 2)
        self.assertTrue(out[0].startswith("- #1: [gen] "))
        self.assertTrue(out[1].startswith("- #2: [agr] ") and "במין" in out[1])
        self.assertEqual(len(T.agreement_issues(cues, he, sp, self.dep(), skip={"1"})), 1)
        for line in out:
            m = T.CHECK_CODE_RE.match(line)
            self.assertIn(m.group(2), T.CHECK_CODES)

    def test_check_counts(self):
        cues = [{"id": 1, "spk": "S1", "start": 0, "end": 2, "en": "The girl went home", "budget": 40}]
        issues, stats = T.check(cues, {"1": "הילדה הלך הביתה"}, [], speakers={}, dep=self.dep())
        self.assertEqual(stats["agree"], 1)
        self.assertTrue(any("[agr]" in x for x in issues))

    def test_morph_row(self):
        self.assertEqual(LB._morph({"morph": {"pos": "VERB", "feats": {"Gender": "Fem", "Number": "Sing"}}}),
                         ["VERB", "Fem", "Sing", ""])
        self.assertEqual(LB._morph({}), ["", "", "", ""])


if __name__ == "__main__":
    unittest.main()
