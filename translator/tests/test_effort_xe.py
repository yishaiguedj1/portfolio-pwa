"""24/10/2026: ניסוי המאמץ (סט הזהב) — spec.xe משנה את המאמץ רק לתפקיד שנבחר (main / tl / rv), השאר לפי המצב."""
from __future__ import annotations
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import llm  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]


class EffortXe(unittest.TestCase):
    def eng(self, xe=None):
        e = llm.Engine(llm.Spec.of('haiku-high'), client=object())
        e.role_effort = llm.norm_xe(xe)
        return e

    def at(self, e, k):
        llm._tl.k = k
        try:
            return e.effort()
        finally:
            llm._tl.k = ''

    def test_default_is_mode(self):
        e = self.eng()
        for k in ('tl', 'rv', 'jg', ''):
            self.assertEqual(self.at(e, k), 'high')
        # 28/10/2026: עריכת המקור — תקרה medium (חשבה פי 3 ותיקנה אותו דבר, והיישור מחכה לה)
        self.assertEqual(self.at(e, 'main'), 'medium')

    def test_role_cap(self):
        self.assertEqual(llm.ROLE_CAP, {'main': 'medium'})
        low = llm.Engine(llm.Spec.of('sonnet-low'), client=object())
        self.assertEqual(self.at(low, 'main'), 'low', 'מתחת לתקרה — המצב')
        self.assertEqual(self.at(self.eng({'main': 'high'}), 'main'), 'high', 'ניסוי המאמץ מעל התקרה')

    def test_override_only_chosen_roles(self):
        e = self.eng({'main': 'medium', 'rv': 'medium'})
        self.assertEqual(self.at(e, 'main'), 'medium')
        self.assertEqual(self.at(e, 'rv'), 'medium')
        self.assertEqual(self.at(e, 'tl'), 'high')
        self.assertEqual(self.at(e, 'jg'), 'high')

    def test_norm_rejects_junk(self):
        self.assertEqual(llm.norm_xe({'main': 'huge', 'jg': 'low', 'rv': 'low', 'x': 1}), {'rv': 'low'})
        self.assertEqual(llm.norm_xe('medium'), {})
        self.assertEqual(llm.norm_xe(None), {})

    def test_all_transports_use_effort(self):
        src = (ROOT / 'translator' / 'llm.py').read_text(encoding='utf-8')
        self.assertNotIn("self.spec.effort or 'medium'", src.replace("or self.spec.effort or 'medium'", ''))
        self.assertGreaterEqual(src.count('self.effort()'), 3)   # API, claude -p, התור

    def test_same_as_server(self):
        js = (ROOT / 'ibkr-proxy' / 'lib' / 'studio.js').read_text(encoding='utf-8')
        m = re.search(r"const XE_KEYS = \[([^\]]*)\], XE_EFFORTS = \[([^\]]*)\]", js)
        self.assertTrue(m)
        keys = tuple(re.findall(r"'([a-z]+)'", m.group(1)))
        effs = tuple(re.findall(r"'([a-z]+)'", m.group(2)))
        self.assertEqual(keys, llm.ROLE_EFFORT_KEYS)
        self.assertEqual(effs, llm.EFFORTS)

    def test_pipeline_sets_it(self):
        src = (ROOT / 'translator' / 'pipeline.py').read_text(encoding='utf-8')
        self.assertIn("eng.role_effort = llm.norm_xe((st.get('spec') or {}).get('xe'))", src)


if __name__ == '__main__':
    unittest.main()
