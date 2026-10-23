"""ניטור השרתים — קצב הרשת מהדגימות (agent.rate_pair / net_rate). 22/10/2026.
הרצה: python3 -m unittest tests.test_monitor   (מתוך translator/)"""
import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import agent  # noqa: E402


class RatePair(unittest.TestCase):
    def test_rate_from_two_samples(self):
        # 10 שניות, 1000 בייטים קבלה ו־500 שליחה → 100 B/s ו־50 B/s
        self.assertEqual(agent.rate_pair(100.0, 0, 0, 110.0, 1000, 500), {'rx': 100, 'tx': 50})

    def test_no_base_gives_nothing(self):
        # דגימה ראשונה (t0 = 0) — לא מנחשים קצב
        self.assertEqual(agent.rate_pair(0.0, 0, 0, 110.0, 1000, 500), {})

    def test_counter_reset_gives_nothing(self):
        # מונה ירד (אתחול של הממשק / השרת) — לא מציגים קצב שלילי
        self.assertEqual(agent.rate_pair(100.0, 5000, 5000, 110.0, 1000, 500), {})

    def test_zero_elapsed_gives_nothing(self):
        self.assertEqual(agent.rate_pair(100.0, 0, 0, 100.0, 10, 10), {})


if __name__ == '__main__':
    unittest.main()
