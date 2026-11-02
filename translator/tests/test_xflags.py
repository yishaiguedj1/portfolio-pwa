"""02/11/2026 — דגלי ניסוי (PR1 1.8): XF_DEFAULT ∪ spec.xf, '-שם' מכבה, רשימה סגורה; ‏T8 — זמן המעבד בציר הזמן"""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import xflags  # noqa: E402


class XFlags(unittest.TestCase):
    def test_flags(self):
        self.assertEqual(xflags.flags({'xf': ['smf', 'zzz', 'gq']}), frozenset({'smf', 'gq'}))
        self.assertEqual(xflags.flags({}), frozenset(xflags.XF_DEFAULT))
        self.assertEqual(xflags.flags({'xf': 'smf'}), frozenset(xflags.XF_DEFAULT))
        self.assertEqual(xflags.flags(None), frozenset(xflags.XF_DEFAULT))

    def test_minus_turns_default_off(self):
        with mock.patch.object(xflags, 'XF_DEFAULT', frozenset({'smf'})):
            self.assertIn('smf', xflags.flags({}))
            self.assertNotIn('smf', xflags.flags({'xf': ['-smf']}))
            self.assertEqual(xflags.flags({'xf': ['-smf', 'gq']}), frozenset({'gq'}))

    def test_on(self):
        self.assertTrue(xflags.on({'spec': {'xf': ['rvs60']}}, 'rvs60'))
        self.assertTrue(xflags.on({'xf': ['rvs60']}, 'rvs60'))
        self.assertFalse(xflags.on({'spec': {}}, 'rvs60'))
        self.assertFalse(xflags.on(None, 'rvs60'))

    def test_same_keys_as_server(self):
        src = (Path(__file__).resolve().parents[2] / 'ibkr-proxy' / 'lib' / 'studio.js').read_text(encoding='utf-8')
        i = src.index('const XF_KEYS = [')
        js = [x.strip().strip("'") for x in src[i:src.index(']', i)].split('[', 1)[1].split(',') if x.strip()]
        self.assertEqual(tuple(js), xflags.XF_KEYS)


class Timeline(unittest.TestCase):
    def test_cpu_kept(self):
        import agent
        with tempfile.TemporaryDirectory() as t:
            d = Path(t) / 'slug'
            d.mkdir()
            (d / 'snb-timing.json').write_text(json.dumps({'vt': [['build', 1.8e9, 12.5, 'main', 900, 2, 30.4], ['x', 1, 2, 'm', 1, 1, 2, 'extra']]}), encoding='utf-8')
            with mock.patch.object(agent.J, 'VT_WORK', Path(t)), mock.patch.object(agent.J, 'vt_slug', lambda j: 'slug'):
                tm = agent.vt_timeline('job1')
        self.assertEqual(tm[0][6], 30.4)        # השביעי = שניות מעבד
        self.assertEqual(len(tm[1]), 7)          # לא יותר משבעה


if __name__ == '__main__':
    unittest.main()
