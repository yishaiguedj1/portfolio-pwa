"""25/10/2026 — התיקונים מניתוח האיכות של כל העבודות: מקף עברי, כללי השבירה, '||' בלי זיהוי דוברים, המיזוג,
יציאה לפני חילוף שוט עם זמן קריאה, ורעש בודק התרגום (לועזית, מספרים, שאלות מילוי, מילון)."""

import re
import sys
import unittest
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from vt import config as C  # noqa: E402
from vt.hebrew import break_lines, layout_lines, normalize_he, number_ok_in_he  # noqa: E402
from vt.segment import cps_merge  # noqa: E402
from vt.timing import time_cues  # noqa: E402
from vt.translate import check, untranslated_words  # noqa: E402
from vt.util import FrameGrid  # noqa: E402
import pipeline as P  # noqa: E402


class TestMaqaf(unittest.TestCase):
    def test_prefix_before_digit_or_latin(self):
        self.assertEqual(normalize_he("ב-2010 ה-AI"), "ב־2010 ה־AI")
        self.assertEqual(normalize_he("וב-2024 ל-OpenAI"), "וב־2024 ל־OpenAI")
        self.assertEqual(normalize_he('ה-"גוגל"'), 'ה־"גוגל"')

    def test_between_hebrew_words(self):
        self.assertEqual(normalize_he("בית-ספר רב-גוני"), "בית־ספר רב־גוני")

    def test_unchanged(self):
        for t in ("2010-2012", "COVID-19", "-כן.", "זה - זה", "שאלה? || -כן"):
            self.assertEqual(normalize_he(t), t)


class TestBreakRules(unittest.TestCase):
    """שבירות שהשופטים פסלו בשיפוט עיוור — הכללים המתוקנים (לא קבילות: 28% → 14%)."""
    def _two(self, text):
        lines, ok = break_lines(text, 42)
        self.assertTrue(ok)
        self.assertEqual(len(lines), 2)
        return lines

    def test_number_word_and_counted_noun(self):
        top, _ = self._two("היו לנו יותר משמונה מיליון לקוחות ומכירות טובות מאוד.")
        self.assertTrue(top.endswith("לקוחות"), "'משמונה' = אות שימוש + מילת מספר — לא לשבור לפני 'מיליון'")

    def test_sentence_end_and_comma_win(self):
        top, _ = self._two("אנחנו חייבים לשמוע אותה. ובמקום לחכות לסוף,")
        self.assertTrue(top.endswith("אותה."))
        top, _ = self._two("הם מצאו אותה ישנה על הספה בסלון, עדיין לבושה,")
        self.assertTrue(top.endswith("בסלון,"))

    def test_quotes_counted_by_words(self):
        top, _ = self._two('זה בכלל לא היה "האוס אוף הנייר" אלא משהו אחר לגמרי.')
        self.assertTrue(top.endswith('הנייר"'), "לא שוברים בתוך מירכאות (עד היום נבדק רק כשבמילה האחרונה יש מירכאות)")

    def test_fixed_pairs(self):
        for text, pair in (("אז ביקשנו מהם שוב ושוב לשלוח את הדוחות בזמן,", ("שוב", "ושוב")),
                           ("ואז הוא אמר לנו קודם כל לבדוק את המספרים בעצמנו.", ("קודם", "כל"))):
            top, bot = self._two(text)
            self.assertNotEqual((top.split()[-1], bot.split()[0]), pair, "צירוף קבוע לא נחצה בין השורות: " + text)


class TestBreakRules21(unittest.TestCase):
    """2.1 — מה שהשיפוט העיוור על הבנייה מחדש מצא: אותיות שימוש מדומות, מילת שאלה בסוף שורה, "מאוד", "אחר כך"."""
    def _two(self, text):
        lines, ok = break_lines(text, 42)
        self.assertTrue(ok)
        self.assertEqual(len(lines), 2)
        return lines

    def test_false_prefix(self):
        top, _ = self._two("בסוף כולנו נצטרך להבין שהלקוחות רוצים משהו אחר.")
        self.assertTrue(top.endswith("להבין"), "'להבין' הוא לא ל+בין")
        top, _ = self._two("המניה הזאת נחשבת היום להשקעה הבטוחה ביותר בשוק.")
        self.assertTrue(top.endswith("היום"), "'היום' הוא לא ה+יום, ולא מפרקים 'להשקעה הבטוחה'")

    def test_question_word_starts_line(self):
        _, bot = self._two("בסוף כולם יצטרכו להבין מה הלקוחות באמת רוצים מהם.")
        self.assertTrue(bot.startswith("מה "))

    def test_meod_may_end_line(self):
        top, _ = self._two("אז החברה תושפע מאוד אם המחירים יעלו שוב בשנה הבאה,")
        self.assertTrue(top.endswith("מאוד"))

    def test_achar_kach(self):
        top, bot = self._two("ולכן כשהגענו אחר כך למשרד החדש שלנו בעיר הגדולה,")
        self.assertNotEqual((top.split()[-1], bot.split()[0]), ("אחר", "כך"))


class TestDialogueLayout(unittest.TestCase):
    def test_honored_without_parts(self):
        lines, ok = layout_lines("באמת? || כן.", parts=False)
        self.assertTrue(ok)
        self.assertEqual(lines, ["באמת?", "-כן."], "'||' בלי זיהוי דוברים — עדיין שתי שורות עם מקף")

    def test_too_long_without_parts_falls_back(self):
        a = "ש" * 45
        lines, _ = layout_lines(a + " || כן.", parts=False)
        self.assertFalse(any(x.startswith("-") for x in lines), "לא נכנס כדיאלוג ואין parts — שבירה רגילה")
        lines, ok = layout_lines(a + " || כן.", parts=True)
        self.assertEqual(lines[1], "-כן.")
        self.assertFalse(ok)


def _refit(c):
    """כמו ב־build: '|' = שבירה ידנית, אחרת שורה אחת עד 42 ושתיים עד 84."""
    t = c["he"]
    if re.search(r"(?<!\|)\|(?!\|)", t):                    # '|' בודד = שבירה ידנית ('||' = שני דוברים)
        lines = [x.strip() for x in re.split(r"(?<!\|)\|(?!\|)", t)]
    else:
        lines = [t] if len(t) <= 42 else [t[:len(t) // 2], t[len(t) // 2:]]
    c["lines"] = lines
    c["chars"] = sum(len(x) for x in lines) + len(lines) - 1
    ok = all(len(x) <= 42 for x in lines) and len(lines) <= 2
    c["_fits"] = ok
    return ok


class TestCpsMerge(unittest.TestCase):
    def cues(self, a, b, flags=("reading_speed",), spk="S1"):
        return [{"id": 1, "spk": spk, "speech_s": 0.0, "speech_e": 1.0, "he": a, "en": "a", "flags": list(flags)},
                {"id": 2, "spk": spk, "speech_s": 1.2, "speech_e": 3.6, "he": b, "en": "b", "flags": []}]

    def test_dialogue_not_merged(self):
        out, n = cps_merge(self.cues("מה? || כן.", "ואז הלכנו הביתה."), C.TIMING, C.TEXT, _refit)
        self.assertEqual(n, 0)

    def test_break_at_join_point(self):
        a, b = "ש" * 30 + ".", "ת" * 30 + "."
        out, n = cps_merge(self.cues(a, b), C.TIMING, C.TEXT, _refit)
        self.assertEqual(n, 1)
        self.assertEqual(out[0]["lines"], [a, b], "שתי הכתוביות = שתי השורות")

    def test_one_line_when_it_fits(self):
        out, n = cps_merge(self.cues("כן.", "בטח."), C.TIMING, C.TEXT, _refit)
        self.assertEqual((n, out[0]["lines"]), (1, ["כן. בטח."]))

    def test_short_cue_merged_only_with_known_speaker(self):
        out, n = cps_merge(self.cues("נכון.", "וזה מה שעשינו.", flags=("under_min_duration",)), C.TIMING, C.TEXT, _refit)
        self.assertEqual(n, 1)
        out, n = cps_merge(self.cues("נכון.", "וזה מה שעשינו.", flags=("under_min_duration",), spk="S?"),
                           C.TIMING, C.TEXT, _refit)
        self.assertEqual(n, 0, "בלי זיהוי דוברים — מילה קצרה היא לרוב התשובה של הדובר השני")


class TestPullBackBeforeCut(unittest.TestCase):
    def test_keeps_reading_time(self):
        g = FrameGrid(Fraction(25))
        rules = C.TimingRules()
        c = time_cues([{"id": 1, "speech_s": 1.0, "speech_e": 2.0, "chars": 60}], g, [55], rules)[0]
        self.assertGreaterEqual(c["fo"] - c["fi"], c["need"], "לא נסוגים לפני החילוף אם לא נשאר זמן לקרוא")
        self.assertEqual(c.get("snap_out"), "cross_cut")

    def test_short_text_still_pulls_back(self):
        g = FrameGrid(Fraction(25))
        c = time_cues([{"id": 1, "speech_s": 1.0, "speech_e": 3.0, "chars": 20}], g, [80], C.TimingRules())[0]
        self.assertEqual((c["fo"], c.get("snap_out")), (78, "before_cut"))


class TestCheckNoise(unittest.TestCase):
    def run_check(self, pairs, glossary=()):
        cues = [{"id": i + 1, "en": en, "budget": 84} for i, (en, _he) in enumerate(pairs)]
        he = {str(i + 1): h for i, (_en, h) in enumerate(pairs)}
        return check(cues, he, list(glossary))

    def test_latin_only_for_untranslated_words(self):
        issues, st = self.run_check([("Now we have AI.", "עכשיו יש לנו AI."),
                                     ("go to example.com/start", "היכנסו ל־example.com/start"),
                                     ("become more AI native.", "ולהפוך ל־AI native.")])
        self.assertEqual(st["latin"], 1)
        self.assertTrue(any("#3:" in x and "native" in x for x in issues))
        self.assertEqual(untranslated_words("OpenAI ו־CEO של Apple"), [])

    def test_latin_brand_not_sent_to_fixer(self):
        issues, _ = self.run_check([("Now we have AI.", "עכשיו יש לנו AI.")])
        hard, soft = P.parse_issues("\n".join(issues))
        self.assertEqual((hard, soft), ({}, {}), "שם מותג / ראשי תיבות בלועזית — לא נשלחים למתקן")

    def test_numbers_in_context(self):
        issues, st = self.run_check([("In the 1990s we grew.", "בשנות ה־90 צמחנו."),
                                     ("after 9/11 everything changed", "אחרי 11 בספטמבר הכל השתנה"),
                                     ("it was about 10 feet tall", "הוא היה בגובה שלושה מטרים"),
                                     ("for 20 years", "במשך עשרים שנה"),
                                     ("We raised 300", "גייסנו"),
                                     ("million dollars last year.", "300 מיליון דולר בשנה שעברה.")])
        self.assertEqual(st["numbers"], 0, issues)
        self.assertTrue(number_ok_in_he("100", "מאה אנשים"))

    def test_digit_at_sentence_start_is_fine(self):
        issues, st = self.run_check([("300 people came.", "300 אנשים באו.")])
        self.assertFalse(any("ספרה בתחילת" in x for x in issues))

    def test_tag_question_is_not_a_question(self):
        issues, st = self.run_check([("It's simple, right?", "זה פשוט."), ("What do you do?", "מה אתה עושה.")])
        self.assertEqual(st["questions"], 1)
        self.assertTrue(any(x.startswith("- #2:") for x in issues))

    def test_glossary_latin_kept_and_head_word(self):
        gl = [("AI", ["בינה מלאכותית"]), ("lemonade stand", ["דוכן לימונדה"])]
        issues, st = self.run_check([("AI is here.", "ה־AI כבר כאן."),
                                     ("and we sold it at the lemonade stand", "ומכרנו את זה בדוכן")], gl)
        self.assertEqual(st["glossary"], 0, issues)
        self.assertEqual(st["glossary_soft"], 2)
        issues, st = self.run_check([("and we sold it at the lemonade stand", "ומכרנו את זה בעמדה")], gl)
        self.assertEqual(st["glossary"], 1, "נוסח אחר לגמרי — עדיין התראה")

    def test_dialogue_part_too_long_is_hard(self):
        t = "החברה שלנו רואה תוצאות טובות בהרבה מבעבר והעסק גדל. || באמת?"
        issues, _ = self.run_check([("Our company sees much better results and the business grew. Really?", t)])
        hard, _ = P.parse_issues("\n".join(issues))
        self.assertIn("1", hard, "דיאלוג שלא נכנס בשורה לכל דובר — חובה לקצר, אחרת המקף הולך לאיבוד")
        issues, _ = self.run_check([("Really? Yes.", "באמת? || כן.")])
        self.assertFalse(any("דיאלוג (||)" in x for x in issues))

    def test_no_valid_two_line_break_is_hard(self):
        long7 = " ".join(["אבגדהוזחטי"] * 7)                 # 76 תווים: 3 מילים = 32 | 43, ‏4 מילים = 43 | 32
        issues, _ = self.run_check([("x", long7)])
        hard, _ = P.parse_issues("\n".join(issues))
        self.assertIn("1", hard, "עד 84 תווים אבל בלי חלוקה לשתי שורות של עד 42 — חובה לקצר")
        issues, _ = self.run_check([("x", " ".join(["אבגדהוזחט"] * 7))])     # 69 תווים: 39 | 29
        self.assertFalse(any("אין חלוקה" in x for x in issues))

    def test_glossary_definite_article_absorbed(self):
        gl = [("United Nations", ['האו"ם']), ("New York Times", ["הניו יורק טיימס"])]
        issues, st = self.run_check([("We met at the United Nations,", 'נפגשנו באו"ם,'),
                                     ("I read it in the New York Times", "קראתי את זה בניו יורק טיימס")], gl)
        self.assertEqual((st["glossary"], st["glossary_soft"]), (0, 0), issues)


if __name__ == "__main__":
    unittest.main()
