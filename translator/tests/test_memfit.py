"""17/11/2026: mem_fit — גם כשאין מקום לעוד עבודה הסוכן שואל את השרתון (mb=0, ובלחץ זיכרון ps=1), כדי שהשרתון ירשום
על הראשונה בתור למה היא מחכה (qw). רק כשתקרת הזיכרון לא ידועה — None (לא שואלים).
הרצה: python3 -m unittest tests.test_memfit   (מתוך translator/)"""
import unittest
import sys
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import agent  # noqa: E402


class Slot:
    def __init__(self, need, peak):
        self.need, self.peak = need, peak
        self.kind, self.dur, self.t0, self.state = 'vi', 4200, 0, Path('/nonexistent')

    def reserved(self):
        return max(self.need, self.peak * agent.MEM_MARGIN)


def fit(lim, avail, psi, slots):
    with mock.patch.object(agent, 'mem_limit_mb', return_value=lim), mock.patch.object(agent, 'mem_pressure', return_value=psi), \
            mock.patch.object(agent, '_meminfo', return_value={'MemAvailable': avail * 1024}), \
            mock.patch.object(agent, 'mem_samples', return_value=[]), mock.patch.object(agent, 'perf_dmax', return_value=None):
        return agent.mem_fit(slots)


class MemFit(unittest.TestCase):
    def test_room(self):
        f = fit(20224, 15000, 0.0, {1: Slot(6800, 3000)})
        self.assertGreater(f['mb'], 5000)
        self.assertNotIn('ps', f)

    def test_full_still_asks_with_zero(self):
        f = fit(20224, 15000, 0.0, {1: Slot(9000, 3000), 2: Slot(8500, 3000)})
        self.assertEqual(f['mb'], 0)
        self.assertIn('a', f)                       # המודל נשלח — השרתון מחשב כמה העבודה צריכה

    def test_pressure(self):
        f = fit(20224, 15000, agent.PSI_MAX + 1, {1: Slot(6800, 3000)})
        self.assertEqual((f['mb'], f.get('ps')), (0, 1))

    def test_unknown_limit(self):
        self.assertIsNone(fit(0, 15000, 0.0, {1: Slot(6800, 3000)}))


if __name__ == '__main__':
    unittest.main()
