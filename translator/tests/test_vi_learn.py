"""מאגר הלמידה של הניתוח בעובד (PR 1.2ב, התוכנית 7.2–7.5): vi_facts → ‏normViLx, ‏vi_corpus → ‏normViCorpus (node).

| מה | איך |
|---|---|
| כל מה שהעובד שולח נשאר אחרי הרשימה המותרת של השרתון (אין שדה שנזרק בשקט) | הרצה של normViLx / normViCorpus ב־node |
| השדות של vi_facts ⊆ ה־fixture של הרשימה המותרת (translator/tests/fixtures/vi_facts.json) | השוואת מפתחות |
| ‏VC_V ו־VK_STAGES זהים לשרתון | require של vicorpus.js |
| בלי שם הסרטון / הקישור בקורפוס; הייחוסים מ־ref/desc.json; גדול מדי → בלי הטיוטות | בדיקות יחידה |
"""
import base64
import gzip
import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import analyze as A  # noqa: E402
import fetchurl as F  # noqa: E402
import test_vimap as TV  # noqa: E402

LIB = ROOT.parent / "ibkr-proxy" / "lib"


def node(js, data):
    src = ("let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const x=JSON.parse(d);" + js + "})")
    r = subprocess.run(["node", "-e", src], input=json.dumps(data), capture_output=True, text=True, check=True, timeout=60, cwd=str(LIB))
    return json.loads(r.stdout)


def norm_lx(o):
    return node("console.log(JSON.stringify(require('./studiolearn.js').normViLx(x)))", o)


def norm_vc(o, full=False):
    return node("console.log(JSON.stringify(require('./vicorpus.js').normViCorpus(x, '2026-11', %s)))" % ("true" if full else "false"), o)


def paths(o, pre=""):
    if isinstance(o, dict):
        out = set()
        for k, v in o.items():
            out |= paths(v, pre + "." + k)
        return out
    return {pre}


def run():
    """מיפוי + סינתזה + אימות על ההרצאה הסינתטית, עם ספר חשבונות מלא"""
    m, ix, nums, rest = TV.mapped()
    ids = [it["id"] for it in m["items"]]
    vs = TV.vs_answer({"one": {"text": "סיכום", "from": [ids[0]]}, "bluf": {"text": "בקצרה", "from": [ids[1]]},
                       "take": [{"text": "תובנה", "from": [ids[1]]}], "thesis": None, "big": None, "adds": []})
    eng = TV.Scripted(lambda p: "\n".join("%s|sup" % i for i in TV.claim_ids(p)) if isinstance(p, list) else vs)
    A.vi_synth(eng, m, ix, nums)
    A.vi_verify(eng, m, ix)
    for k, mdl, u, usd in (("vm", "claude-sonnet-5-5", {"i": 4100, "o": 620, "cr": 3000, "c5": 900}, 0.0214),
                           ("vs", "claude-sonnet-5-5", {"i": 2200, "o": 410}, 0.012),
                           ("vv", "claude-haiku-5-5", {"i": 1800, "o": 90, "c1": 40}, 0.0021)):
        eng.ledger.add(k, mdl, u, usd)
    vi = TV.live(m, rest)
    return vi, m, eng, rest


class TestFacts(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vi, cls.m, cls.eng, rest = run()
        ev, slides, ocr, dur = rest
        wd = TV.words_of(TV.EN)
        stages = {k: {"s": 61.0, "mb": 900 if k == "rv" else 0, "cpu": 1.0} for k in ("up", "tr", "al", "rv", "bn", "sv")}
        cls.lx = A.vi_facts({"mode": "sonnet-medium", "xf": ["-vv"], "name": "הרצאה סודית.mp4", "url": "https://x.test/v?id=1"},
                            "en", dur, cls.vi, cls.m, cls.eng, cls.eng, stages,
                            {"engine": "parakeet", "quality": "ok"}, wd, {"vo": "1.1", "stats": {"units": 2}}, 1, len(ocr))

    def test_server_keeps_everything(self):
        out = norm_lx(self.lx)
        self.assertEqual(paths(out), paths(self.lx), "כל שדה שהעובד שולח עובר את normViLx")
        self.assertEqual(out["counts"], self.lx["counts"])
        self.assertEqual(out["roles"]["vm"]["cw"], 900)
        self.assertEqual(out["roles"]["vv"]["cw"], 40)

    def test_subset_of_fixture(self):
        fx = json.loads((ROOT / "tests" / "fixtures" / "vi_facts.json").read_text(encoding="utf-8"))["out"]
        allowed = paths(fx) | {".roles." + r + p[len(".roles.vm"):] for r in A.LX_ROLES for p in paths(fx) if p.startswith(".roles.vm.")}
        extra = {p for p in paths(self.lx) if not p.startswith((".counts.cov3",)) and p not in allowed}
        self.assertEqual(extra, set(), "רק מה שברשימה המותרת (fixture)")

    def test_values(self):
        lx = self.lx
        self.assertEqual((lx["lang"], lx["mode"], lx["out"]), ({"src": "en", "out": "he"}, "sonnet-medium", {"st": "done"}))
        self.assertEqual(lx["roles"]["vm"]["eff"] if "eff" in lx["roles"]["vm"] else None, None, "מנוע מדומה — בלי מאמץ")
        self.assertEqual(lx["counts"]["claims"], len(self.vi["items"]))
        self.assertEqual(lx["counts"]["sup"], self.vi["quality"]["sup"])
        self.assertEqual(len(lx["counts"]["cov3"]), 3)
        self.assertEqual(lx["t"]["rv"], round(61 / 60, 3), "דקות")
        self.assertEqual(lx["mem"], {"rv": 900})
        self.assertEqual(lx["pv"], {"vp": str(__import__("visheet").PV), "vo": "1.1"})
        self.assertEqual(lx["xf"], ["-vv"])
        self.assertEqual(lx["asr"]["eng"], "parakeet")
        self.assertTrue(0 <= lx["scr"]["ocr_conf"] <= 1, "0–1 (vimetrics נותן 0–100)")
        self.assertNotIn("סודית", json.dumps(lx, ensure_ascii=False))

    def test_failed_run(self):
        lx = A.vi_facts({"mode": "haiku-medium"}, "he", 600.0, None, None, None, None, {}, {}, [], {}, 0, 0, st="failed", err="vi_schema")
        self.assertEqual(lx["out"], {"st": "failed", "err": "vi_schema"})
        self.assertEqual(norm_lx(lx)["out"], lx["out"])
        self.assertIsNone(A.facts_safe(None, "he", 1, None, None, None, None, {}, {}, [], {}, 0, 0), "תקלה — None, לא נופל")


class TestCorpus(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vi, cls.m, cls.eng, _ = run()
        cls.refs = [{"src": "ch", "kind": "yt", "data": [[0.0, "Intro"], [65.5, "Momentum"]]}, {"src": "desc", "kind": "yt", "data": "About"}]
        cls.vc = A.vi_corpus({"mode": "sonnet-medium", "name": "הרצאה סודית.mp4", "url": "https://x.test/v?id=1"},
                             cls.vi, cls.m, cls.eng, cls.eng, cls.refs)

    def test_constants_match_server(self):
        js = node("const V=require('./vicorpus.js');console.log(JSON.stringify([V.VC_V,V.VK_STAGES]))", 0)
        self.assertEqual(js, [A.VC_V, list(A.VK_STAGES)])

    def test_server_keeps_everything(self):
        vc, out = self.vc, norm_vc(self.vc)
        for k in ("tr", "scr", "ol", "it", "led", "rej", "tk", "refs"):
            self.assertEqual(len(out.get(k) or []), len(vc[k]), k)
        self.assertEqual(sorted(out["dr"]), sorted(vc["dr"]), "כל הטיוטות")
        self.assertEqual(sorted(out["dr"]), ["m0", "m1", "s0", "v0"])
        self.assertEqual(out["cf"]["st"], {k: [v[0], v[1]] for k, v in vc["cf"]["st"].items()})
        self.assertEqual(out["cf"]["pv"], vc["cf"]["pv"])
        self.assertEqual(out["cf"]["sys_hash"], vc["cf"]["sys_hash"])
        self.assertEqual([x[0] for x in out["it"]], [x[0] for x in vc["it"]])
        self.assertEqual([x[8] for x in out["it"]], [x[8] for x in vc["it"]], "הפסקים")
        self.assertEqual([x[2] for x in out["it"]], [x[2] for x in vc["it"]], "הפרק של כל פריט")
        self.assertEqual(out["refs"], self.refs)

    def test_no_title_or_url(self):
        s = json.dumps(self.vc, ensure_ascii=False)
        self.assertNotIn("סודית", s)
        self.assertNotIn("x.test", s)

    def test_put_drops_drafts_when_too_big(self):
        class C:
            def __init__(self):
                self.got = []

            def raw(self, op, **kw):
                self.got.append(json.loads(gzip.decompress(base64.b64decode(kw["lc"]))))
                return {"saved": True}
        ctx = type("X", (), {"c": C()})()
        old = A.VC_MAX_B64
        try:
            A.VC_MAX_B64 = len(base64.b64encode(gzip.compress(json.dumps({k: v for k, v in self.vc.items() if k != "dr"},
                                                                          ensure_ascii=False, separators=(",", ":")).encode())))
            self.assertTrue(A.vi_learn_put(None, ctx, self.vc))
        finally:
            A.VC_MAX_B64 = old
        self.assertNotIn("dr", ctx.c.got[0])
        self.assertIn("tr", ctx.c.got[0])

    def test_put_never_raises(self):
        class Boom:
            def raw(self, op, **kw):
                raise OSError("net")
        self.assertFalse(A.vi_learn_put(None, type("X", (), {"c": Boom()})(), self.vc))


class TestRefs(unittest.TestCase):
    def test_meta_json(self):
        with tempfile.TemporaryDirectory() as d:
            pd = Path(d)
            self.assertEqual(A.vi_refs(pd, {}), [], "בלי ref/desc.json — בלי ייחוס")
            (pd / "ref").mkdir()
            (pd / "ref" / "desc.json").write_text(json.dumps({"desc": "תיאור", "ch": [[0, "פתיחה"], ["x", "y"], [12.5, ""]]}), encoding="utf-8")
            got = A.vi_refs(pd, {"url": "https://www.youtube.com/watch?v=x"})
            self.assertEqual(got, [{"src": "desc", "kind": "yt", "data": "תיאור"}, {"src": "ch", "kind": "yt", "data": [[0.0, "פתיחה"]]}])

    def test_ref_meta(self):
        info = {"description": "a\x00b\nline", "chapters": [{"start_time": 0, "title": "Intro"}, {"start_time": "bad"},
                                                         {"start_time": 61.234, "title": " Next‮ "}], "formats": [{"url": "https://signed"}]}
        self.assertEqual(F.ref_meta(info), {"desc": "a b\nline", "ch": [[0.0, "Intro"], [61.23, "Next"]]})
        self.assertIsNone(F.ref_meta({"description": "", "chapters": []}))

    def test_get_subs_meta_same_request(self):
        seen = []
        with tempfile.TemporaryDirectory() as d:
            def run_(cmd, **kw):
                seen.append(cmd)
                Path(d, "ref.info.json").write_text(json.dumps({"description": "desc", "chapters": []}), encoding="utf-8")
                from types import SimpleNamespace
                return SimpleNamespace(returncode=0, stderr="", stdout="")
            F.get_subs("https://x.test/v", d, run=run_, meta=True)
            self.assertEqual(len(seen), 1, "בקשה אחת — כמו בתרגום")
            self.assertIn("--write-info-json", seen[0])
            self.assertFalse(Path(d, "ref.info.json").exists(), "ה־info.json (עם קישורים חתומים) נמחק")
            self.assertEqual(json.loads(Path(d, "desc.json").read_text(encoding="utf-8")), {"desc": "desc", "ch": []})
            seen.clear()
            F.get_subs("https://x.test/v", d, run=run_)
            self.assertNotIn("--write-info-json", seen[0], "בתרגום — בלי שינוי")


if __name__ == "__main__":
    unittest.main()
