"""vimetrics.py (PR 1.2ב): התאום של viMetrics (ibkr-proxy/lib/studiovi.js) — על ה־fixture המשותף, ומול node על קלטים נוספים."""
import copy
import json
import shutil
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import vimetrics as M  # noqa: E402

FX = ROOT / "tests" / "fixtures"


def fx(name):
    return json.loads((FX / name).read_text(encoding="utf-8"))


def js_metrics(cases):
    """viMetrics של השרתון על אותם קלטים (node)"""
    src = ("const VI=require(%r);let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
           "console.log(JSON.stringify(JSON.parse(d).map(([v,r])=>VI.viMetrics(v,r))))})") % str(ROOT.parent / "ibkr-proxy" / "lib" / "studiovi.js")
    r = subprocess.run(["node", "-e", src], input=json.dumps(cases), capture_output=True, text=True, check=True, timeout=60)
    return json.loads(r.stdout)


class TestTwin(unittest.TestCase):
    def test_fixture(self):
        d = fx("vi_metrics.json")
        self.assertEqual(json.dumps(M.metrics(fx(d["in"]), d["ref"])), json.dumps(d["out"]), "= הפלט שבקובץ (= viMetrics)")
        self.assertNotIn("ch_f1_5", M.metrics(fx(d["in"])), "בלי ייחוס — בלי F1")
        self.assertIsNone(M.metrics({"v": "x"}))

    def test_words(self):
        self.assertEqual(M.words("שלום, עולם! 3.5% don't _x a-b"), 6)
        self.assertEqual(M.words(None), 0)

    def test_bound_f1(self):
        self.assertIsNone(M.bound_f1([], [], 5))
        self.assertEqual(M.bound_f1([100, 200], [103, 300], 5), 0.5)
        self.assertEqual(M.bound_f1([100, 101], [100], 5), 0.6667, "אחד־לאחד")

    @unittest.skipUnless(shutil.which("node"), "node לא מותקן")
    def test_same_as_js(self):
        ok, bad = fx("vi_ok.json"), fx("vi_bad.json")
        he = copy.deepcopy(ok)
        for it in he["items"]:
            it["text"] = "הטענה של המרצה — 12% ירידה, בערך. don't"
        he["chapters"][0]["adds"] = "מוסיף לתמונה: א־ב, ג.ד"
        empty = dict(copy.deepcopy(ok), items=[], slides=[], ledger=[])
        cases = [[ok, None], [bad, {"chapters": [{"t0": 0}, {"t0": 33}]}], [he, {"chapters": "x"}], [empty, None], [{"v": 1}, None]]
        self.assertEqual(js_metrics(cases), [M.metrics(v, r) for v, r in cases])

    def test_worker_extra(self):
        vi = {"video": {"dur": 120}, "ocr": [{"conf": 80}, {"conf": 91}, {"conf": "x"}]}
        wl = [{"w": "a", "s": 0.0, "e": 0.5, "p": 0.9}, {"w": "b", "s": 1.0, "e": 1.5, "p": 0.2}, {"w": "c", "s": 2.0, "e": 2.5}]
        self.assertEqual(M.worker_extra(vi, wl), {"ocr_conf": 85.5, "asr_conf": 0.55, "asr_low": 0.5, "wpm": 1.5, "speech_share": 0.0125})
        self.assertEqual(M.worker_extra({}, []), {"ocr_conf": None, "asr_conf": None, "asr_low": None, "wpm": None, "speech_share": None})


if __name__ == "__main__":
    unittest.main()
