"""המיפוי עם Claude (analyze.vi_map, ‏visheet.py; PR 1.2א) — עם llm.ManualEngine ותשובות מוכנות. בלי רשת ובלי עלות.

| מה | איך |
|---|---|
| שלוש הרצאות (אנגלית, עברית, בלי מסך) → vi.json תקין (norm_vi = עצמו), זמן השבב = זמן המילה | "Claude" מדומה שקורא את החלון |
| ניסיון תיקון לסכמה, מיפוי חוזר מעל 30% פסולים, הסלמה ל־haiku-high, חלון חלקי, vi_schema, ‏vi_card, ‏cap | מנועים מדומים |
| הפרומפט: בלי זמנים, השלד בבלוק הקבוע, אותו בלוק לכל החלונות | בדיקת הטקסט שנשלח |
"""
import json
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import analyze as A  # noqa: E402
import llm  # noqa: E402
import vicheck as C  # noqa: E402
import visheet as V  # noqa: E402


def words_of(sents, t=0.0, gap=1.5):
    """משפטים → מילים עם זמן (0.4 שנ׳ למילה) ויחידות דיבור (analyze.evidence)"""
    out = []
    for s in sents:
        for w in s.split():
            out.append({"w": w, "s": round(t, 2), "e": round(t + 0.35, 2), "p": 0.9})
            t += 0.4
        t += gap
    return out


EN = ["Today we talk about gradient descent.", "The learning rate is 0.01 in our runs.",
      "This might reduce training time.", "Next we look at momentum.", "Momentum adds 90% of the last step."]
HE = ["היום נדבר על ירידת גרדיאנט.", "קצב הלמידה הוא 0.01 בניסויים שלנו.", "ייתכן שזה מקצר את האימון.",
      "עכשיו נעבור למומנטום.", "המומנטום מוסיף 90% מהצעד הקודם."]


def lecture(sents, with_screen=True):
    wd = words_of(sents)
    ev = A.evidence(wd)
    slides, ocr = [], []
    if with_screen:
        screen = {"units": [
            {"kind": "slide", "t0": 0.0, "t1": 10.0, "states": [{"t0": 0.0}],
             "ocr": {"lines": [{"text": "Gradient descent", "conf": 90, "box": [0, 0, 100, 20]},
                               {"text": "Step size matters most", "conf": 90, "box": [0, 30, 100, 20]}]}},
            {"kind": "slide", "t0": 10.0, "t1": 30.0, "states": [{"t0": 10.0, "rel": "new"}],
             "ocr": {"lines": [{"text": "Momentum", "conf": 90, "box": [0, 0, 100, 20]}]}}]}
        slides, ocr = A.slides_doc(screen)
        A.screen_only(slides, ocr, wd)
    return wd, ev, slides, ocr


def ids_in(prompt):
    return re.findall(r"^\[((?:e|s)\d+)(?:\|S\d+)?\]", prompt, re.M)


def smart(prompt, he=False):
    """ "Claude" שקורא את החלון: פרק בתחילת החלון, פריט לכל יחידת דיבור עם ציטוט של 3 המילים הראשונות,
    פריט לכל שקף עם שורות "רק על המסך", ושקף בלי שורות — נדחה"""
    lines = [x for x in prompt.splitlines() if re.match(r"^\[(e|s)\d+", x)]
    first = re.match(r"^\[(\w+)", lines[0]).group(1)
    items, drop = [], []
    for ln in lines:
        m = re.match(r"^\[(e\d+)(?:\|S\d+)?\](?: \(\?\))? (.*)$", ln)
        if m:
            txt = m.group(2)
            nums = " ".join(re.findall(r"\d+(?:\.\d+)?%?", txt))
            items.append({"kind": "note", "text": ("נקודה " if he else "נקודה על ") + nums, "ev": [m.group(1)],
                          "q": " ".join(txt.split()[:3]), "src": "speech", "basis": "speaker", "conf": "high"})
            continue
        m = re.match(r"^\[(s\d+)\] slide appears(.*)$", ln)
        if m:
            so = re.findall(r"\[(o\d+\.\d+) so\]", m.group(2))
            if so:
                items.append({"kind": "note", "text": "שקף", "ev": [m.group(1)] + so, "q": "", "src": "screen_only",
                              "basis": "speaker", "conf": "med"})
            else:
                drop.append({"ref": m.group(1), "why": "title_only"})
    d = {"genre": "academic_lecture", "segments": [{"from": first, "type": "content"}],
         "chapters": [{"from": first, "lvl": 1, "cont": False, "title": "פתיחה", "sum": "מה לומדים."}],
         "items": items, "drop": drop}
    return V.TAGS[0] + json.dumps(d, ensure_ascii=False) + V.TAGS[1]


class Scripted:
    """מנוע מדומה עם רשימת תשובות (או פונקציה) — רושם כל קריאה"""
    manual = True

    def __init__(self, answers, structured=False, fits=None):
        self.answers, self.structured, self.fits = answers, structured, fits
        self.calls = []
        self.ledger = llm.Ledger()
        self.cap = None

    def fits_card(self, fixed, prompt, extra="", reserve=0):
        return True if self.fits is None else self.fits(prompt)

    def complete(self, k, fixed, prompt, max_tokens=32000, system_extra="", on_first_token=None, partial_ok=False, fmt=None):
        self.calls.append({"k": k, "fixed": fixed, "prompt": prompt, "fmt": fmt})
        a = self.answers(prompt) if callable(self.answers) else self.answers.pop(0)
        if isinstance(a, Exception):
            raise a
        return llm.Result(a, {}, 0.0, "end_turn")


def run_map(sents, he=False, screen=True, eng=None, mode=""):
    wd, ev, slides, ocr = lecture(sents, screen)
    inv = A.inventories(ev, slides, ocr)
    bnd = A.bounds(ev, slides)
    eng = eng or llm.ManualEngine(lambda k, text: smart(text, he))
    dur = wd[-1]["e"] + 1
    m = A.vi_map(eng, mode, "he" if he else "en", ev, slides, ocr, inv, bnd, dur, wd)
    vi = A.build_vi_live("he" if he else "en", dur, "file", "t", m, ev, slides, ocr, "ok", [] if screen else ["vi_noscreen"])
    return vi, m, wd, ev, eng


class TestFixtures(unittest.TestCase):
    """הקבלה של 1.2א: 3 הרצאות → vi.json תקין, וזמן השבב = זמן המילה בדיוק"""

    def check(self, vi, wd, ev):
        self.assertEqual(C.norm_vi(vi), vi, "vi.json תקין — מה שהטלפון יציג")
        self.assertEqual(vi["pv"], V.PV)
        self.assertIn("vi_unver", vi["quality"]["warn"], "עד האימות (1.2ב) — טיוטה")
        self.assertEqual(vi["chapters"][0]["t0"], 0)
        ix = C.Index(ev, [], [], wd)
        for it in vi["items"]:
            if it.get("q"):
                i = C.quote_word(ix.ev[it["ev"][0]], it["q"], wd)
                self.assertEqual(it["t"], wd[i]["s"], "זמן השבב = זמן המילה")
                self.assertEqual(it["t"], ix.ev[it["ev"][0]]["t0"], "הציטוט מתחיל ביחידה")
        self.assertEqual([x["id"] for x in vi["items"]], ["n%d" % i for i in range(1, len(vi["items"]) + 1)])
        self.assertTrue(all(x["ch"] == "c1" for x in vi["items"]))

    def test_english(self):
        vi, m, wd, ev, _ = run_map(EN)
        self.check(vi, wd, ev)
        self.assertEqual(vi["genre"], "academic_lecture")
        self.assertEqual(sum(1 for x in vi["items"] if x["src"] == "screen_only"), 1, "השורה שלא נאמרה (V23)")
        self.assertIn({"ref": "s2", "drop": "title_only"}, vi["ledger"])
        self.assertEqual(vi["quality"]["cov"], 1, "כל השקפים והשורות — נוצלו או נדחו")
        hedge = [x for x in vi["items"] if "might" in (x.get("q") or "")]
        self.assertEqual(hedge[0]["conf"], "med", "הסתייגות שנעלמה — הביטחון יורד")
        self.assertEqual(m["st"]["iss"].get("hedge"), 1)

    def test_hebrew(self):
        vi, m, wd, ev, _ = run_map(HE, he=True)
        self.check(vi, wd, ev)
        self.assertEqual(vi["lang"]["src"], "he")
        self.assertEqual(m["st"]["iss"].get("num_bad", 0), 0, "המספרים מהיחידות — לא מומצאים")

    def test_no_screen(self):
        vi, m, wd, ev, _ = run_map(EN, screen=False)
        self.check(vi, wd, ev)
        self.assertEqual((vi["slides"], vi["ledger"]), ([], []))
        self.assertIn("vi_noscreen", vi["quality"]["warn"])


class TestPrompt(unittest.TestCase):
    def test_no_times_and_same_fixed_block(self):
        wd, ev, slides, ocr = lecture(EN)
        old = A.VI_WIN_TOK
        A.VI_WIN_TOK = 40                       # חלונות קטנים — כמה קריאות
        try:
            sc = Scripted(lambda p: smart(p))
            A.vi_map(sc, "", "en", ev, slides, ocr, A.inventories(ev, slides, ocr), A.bounds(ev, slides), 30, wd)
        finally:
            A.VI_WIN_TOK = old
        self.assertGreater(len(sc.calls), 1)
        self.assertEqual(len({c["fixed"] for c in sc.calls}), 1, "בלוק קבוע אחד לכל החלונות (מטמון)")
        self.assertTrue(sc.calls[0]["fixed"].startswith(V.SYS))
        self.assertIn("## Slides (id: OCR lines)", sc.calls[0]["fixed"])
        self.assertIn("[so] Step size matters most", sc.calls[0]["fixed"])
        for c in sc.calls:
            self.assertEqual(c["k"], "vm")
            self.assertIsNone(c["fmt"], "בלי סכמה בצד השרת — JSON בתגיות")
            self.assertIn(V.TAGS[0], c["prompt"])
            self.assertFalse(re.search(r"\d+:\d\d|\b\d+\.\d+s\b", c["prompt"].split("## Window")[1].split("Map this window")[0]),
                             "בלי זמנים בחלון")
        self.assertIn("This is the beginning", sc.calls[0]["prompt"])
        self.assertIn("continues the talk", sc.calls[1]["prompt"])

    def test_structured_engine_gets_schema(self):
        sc = Scripted(lambda p: smart(p).replace(V.TAGS[0], "").replace(V.TAGS[1], ""), structured=True)
        run_map(EN, eng=sc)
        self.assertIs(sc.calls[0]["fmt"], V.VM_SCHEMA)
        self.assertNotIn(V.TAGS[0], sc.calls[0]["prompt"])

    def test_schema_is_strict(self):
        def walk(s):
            if s.get("type") == "object":
                self.assertFalse(s["additionalProperties"])
                self.assertEqual(sorted(s["required"]), sorted(s["properties"]))
                for v in s["properties"].values():
                    walk(v)
            if s.get("type") == "array":
                walk(s["items"])
        walk(V.VM_SCHEMA)
        self.assertEqual(V.GENRES, C.VI_GENRES)
        self.assertEqual(V.SEG_TYPES, C.VI_SEG)
        self.assertTrue(set(V.DROP_MODEL) < set(C.VI_DROP))
        self.assertEqual(len(V.sys_hash()), 12)

    def test_unit_line_marks_unsure(self):
        self.assertEqual(V.unit_line({"id": "e3", "spk": "S2", "text": "x", "conf": 0.3}), "[e3|S2] (?) x")
        self.assertEqual(V.unit_line({"id": "e3", "text": "x", "conf": 0.9}), "[e3] x")


class TestRecovery(unittest.TestCase):
    def test_schema_retry_once(self):
        n = []
        sc = Scripted(lambda p: (n.append(1), "oops" if len(n) == 1 else smart(p))[1])
        vi, m, *_ = run_map(EN, eng=sc)
        self.assertEqual(m["st"]["retry"], 1)
        self.assertIn("was invalid", sc.calls[1]["prompt"])
        self.assertNotIn("vi_partial", vi["quality"]["warn"])

    def test_window_fails_partial(self):
        n = []

        def ans(p):
            n.append(1)
            return "bad" if len(n) <= 2 else smart(p)
        old = A.VI_WIN_TOK
        A.VI_WIN_TOK = 40
        try:
            vi, m, *_ = run_map(EN, eng=Scripted(ans))
        finally:
            A.VI_WIN_TOK = old
        self.assertEqual(m["st"]["fail"], 1)
        self.assertIn("vi_partial", vi["quality"]["warn"])
        self.assertTrue(vi["items"], "שאר החלונות נכנסו")

    def test_all_windows_fail(self):
        with self.assertRaises(A.VIFail) as e:
            run_map(EN, eng=Scripted(lambda p: "bad"))
        self.assertEqual(e.exception.code, "vi_schema")

    def test_api_error_partial_and_cap(self):
        with self.assertRaises(A.VIFail) as e:
            run_map(EN, eng=Scripted(lambda p: (_ for _ in ()).throw(llm.LLMError("budget_cap", "x"))))
        self.assertEqual(e.exception.code, "cap")
        with self.assertRaises(A.VIFail) as e:
            run_map(EN, eng=Scripted(lambda p: (_ for _ in ()).throw(llm.LLMError("api_overloaded", "x"))))
        self.assertEqual(e.exception.code, "vi_schema")

    def test_remap_with_feedback(self):
        """5.8: יותר מ־30% פריטים בלי ראיה — מיפוי חוזר אחד, עם "לא נמצאה ראיה ל"; הגרסה הטובה נשארת"""
        n = []

        def ans(p):
            n.append(1)
            if len(n) == 1:
                d = json.loads(smart(p)[len(V.TAGS[0]):-len(V.TAGS[1])])
                for it in d["items"]:
                    it["ev"] = ["e999"]
                return V.TAGS[0] + json.dumps(d) + V.TAGS[1]
            return smart(p)
        sc = Scripted(ans)
        vi, m, *_ = run_map(EN, eng=sc)
        self.assertEqual((m["st"]["remap"], m["st"]["esc"]), (1, 0), "מנוע ידני — בלי הסלמה")
        self.assertIn("Problems: ev_bad", sc.calls[1]["prompt"])
        self.assertTrue(all(x["ev"] for x in vi["items"]))

    def test_escalation_only_haiku_medium(self):
        e = llm.Engine(llm.Spec.of("haiku-medium"), cap_usd=1.0, client=object())
        e2 = A._escalated(e, "haiku-medium")
        self.assertIsNot(e2, e)
        self.assertEqual(e2.spec.model, llm.Spec.of("haiku-high").model)
        self.assertEqual(e2.spec.effort, llm.Spec.of("haiku-high").effort)
        self.assertIs(e2.ledger, e.ledger, "אותו ספר חשבונות ואותה תקרה")
        self.assertEqual(e2.cap, 1.0)
        for mode in ("haiku-high", "sonnet-medium", "opus-medium", ""):
            self.assertIs(A._escalated(e, mode), e, "אף פעם לא ל־Sonnet/Opus, ובלי הסלמה במצבי המנהל")
        self.assertIs(A._escalated(llm.ManualEngine(lambda k, t: ""), "haiku-medium").__class__, llm.ManualEngine)

    def test_card_split_and_fail(self):
        sc = Scripted(lambda p: smart(p), fits=lambda p: len(ids_in(p)) <= 3)
        vi, m, *_ = run_map(EN, eng=sc)
        self.assertGreater(m["st"]["win"], 1, "חלון שלא נכנס לכרטיס — נחצה")
        self.assertTrue(all(len(ids_in(c["prompt"])) <= 3 for c in sc.calls))
        with self.assertRaises(A.VIFail) as e:
            run_map(EN, eng=Scripted(lambda p: smart(p), fits=lambda p: False))
        self.assertEqual(e.exception.code, "vi_card")

    def test_refusal_text_installed(self):
        run_map(EN)
        self.assertEqual(llm.refusal_text("vm"), V.REFUSAL_VI)
        self.assertNotEqual(llm.refusal_text("main"), V.REFUSAL_VI)


class TestMerge(unittest.TestCase):
    def test_chapters_cont_levels_snap(self):
        wd, ev, slides, ocr = lecture(EN + EN)
        ix = C.Index(ev, slides, ocr, wd)
        e = [u["id"] for u in ev]
        wins = [{"t0": ev[0]["t0"], "t1": ev[4]["t1"]}, {"t0": ev[5]["t0"], "t1": ev[-1]["t1"]}]

        def out(chs, segs):
            return {"d": {"genre": "other", "segments": segs, "chapters": chs, "items": [], "drop": []}, "res": []}
        outs = [out([{"from": e[1], "lvl": 2, "cont": False, "title": "א", "sum": ""},
                     {"from": e[3], "lvl": 2, "cont": False, "title": "ב", "sum": "ס"}], [{"from": e[2], "type": "qa"}]),
                out([{"from": e[5], "lvl": 1, "cont": True, "title": "המשך", "sum": ""},
                     {"from": e[7], "lvl": 1, "cont": False, "title": "ג", "sum": ""}], [{"from": e[6], "type": "qa"}])]
        mm = A.merge_map(wins, outs, ix, [], slides, 100.0)
        ch = mm["chapters"]
        self.assertEqual([c["title"] for c in ch], ["א", "ב", "ג"], "cont — בלי פרק חדש")
        self.assertEqual((ch[0]["t0"], ch[0]["lvl"]), (0, 1), "הראשון — מ־0 וברמה 1")
        self.assertEqual(ch[0]["t1"], ch[2]["t0"], "רמה 1 — עד הפרק הבא ברמה 1")
        self.assertEqual(ch[1]["t1"], ch[2]["t0"])
        self.assertEqual(ch[2]["t1"], 100.0)
        self.assertNotIn("sum", ch[0])
        sg = mm["segments"]
        self.assertEqual([g["type"] for g in sg], ["content", "qa"], "רצף מאותו סוג — אחד")
        self.assertEqual(sg[-1]["t1"], 100.0)
        mm = A.merge_map(wins, [out([], []), {"d": None, "res": []}], ix, [], slides, 100.0)
        self.assertEqual(mm["chapters"][0]["title"], "כל ההרצאה")


if __name__ == "__main__":
    unittest.main()


# ---------------------------------------------------------------- הסינתזה והאימות (PR 1.2ב)

def claim_ids(prompt):
    """הטענות בבקשת האימות (בלוקים, או טקסט שטוח במנוע ידני)"""
    txt = prompt if isinstance(prompt, str) else "\n".join(b.get("text", "") for b in prompt if b.get("type") == "text")
    return re.findall(r"Claim (n\d+):", txt)


def vs_answer(d):
    return V.TAGS[0] + json.dumps(d, ensure_ascii=False) + V.TAGS[1]


def mapped(sents=EN):
    vi, m, wd, ev, _ = run_map(sents)
    wd, ev, slides, ocr = lecture(sents)
    ix, nums = A.vi_index(ev, slides, ocr, wd, A.inventories(ev, slides, ocr))
    return m, ix, nums, (ev, slides, ocr, wd[-1]["e"] + 1)


def live(m, rest):
    ev, slides, ocr, dur = rest
    return A.build_vi_live("en", dur, "file", "t", m, ev, slides, ocr, "ok", [])


class TestSynth(unittest.TestCase):
    def test_briefing_take_adds_and_checks(self):
        m, ix, nums, rest = mapped()
        n0 = len(m["items"])
        ids = [it["id"] for it in m["items"]]
        d = {"one": {"text": "השיעור על ירידת גרדיאנט", "from": [ids[0]]},
             "bluf": {"text": "קצב הלמידה 0.01", "from": [ids[1]]},
             "take": [{"text": "תובנה %d" % i, "from": [ids[i % len(ids)]]} for i in range(7)],
             "thesis": {"text": "קצב 77 מנצח", "from": [ids[1]]},             # מספר מומצא — נמחק
             "big": {"text": "התמונה הגדולה", "from": []},                      # בלי from — הוסק
             "adds": [{"ch": "c1", "text": "תוספת לפרק"}, {"ch": "c1", "text": "שנייה — לא נכנסת"}, {"ch": "c9", "text": "x"}]}
        eng = Scripted([vs_answer(d)])
        A.vi_synth(eng, m, ix, nums)
        st = m["st"]["syn"]
        self.assertEqual((st["ok"], st["retry"]), (1, 0))
        self.assertEqual(eng.calls[0]["k"], "vs")
        self.assertNotRegex(eng.calls[0]["prompt"], r"\d+\.\d+s|\d+:\d\d", "בלי זמנים בסינתזה")
        new = m["items"][n0:]
        self.assertEqual([x["id"] for x in new], ["n%d" % (n0 + i + 1) for i in range(len(new))], "מזהים חדשים ברצף")
        self.assertEqual(len(m["briefing"]["take"]), A.TAKE_MAX, "3–5 תובנות")
        self.assertNotIn("thesis", m, "מספר שלא בהערות — נמחק")
        self.assertEqual(st["iss"].get("num_bad"), 1)
        big = next(x for x in new if x["kind"] == "big")
        self.assertEqual((big["basis"], big["conf"], big["ev"]), ("analyst_inference", "low", []))
        self.assertEqual(m["big"], big["id"])
        one = next(x for x in new if x["kind"] == "one")
        self.assertEqual(one["ev"], m["items"][0]["ev"], "הראיות — של ההערות")
        self.assertEqual(one["t"], m["items"][0]["t"])
        c1 = next(c for c in m["chapters"] if c["id"] == "c1")
        self.assertEqual(c1["adds"], "תוספת לפרק", "תוספת אחת לפרק ראשי")
        vi = live(m, rest)
        self.assertEqual(C.norm_vi(vi), vi, "התוצר תקין אחרי הסינתזה")
        self.assertIn("vi_unver", vi["quality"]["warn"], "עוד לא אומת")
        self.assertNotIn("vi_partial", vi["quality"]["warn"])

    def test_schema_retry_then_fail_is_partial(self):
        m, ix, nums, rest = mapped()
        before = json.dumps(m["items"])
        eng = Scripted(["not json", "still not"])
        A.vi_synth(eng, m, ix, nums)
        self.assertEqual((m["st"]["syn"]["ok"], m["st"]["syn"]["retry"]), (0, 2))
        self.assertIn("invalid", eng.calls[1]["prompt"], "ניסיון התיקון עם המשוב")
        self.assertEqual(json.dumps(m["items"]), before, "המיפוי נשאר כמו שהוא")
        self.assertIn("vi_partial", live(m, rest)["quality"]["warn"])

    def test_llm_error_does_not_raise(self):
        m, ix, nums, rest = mapped()
        A.vi_synth(Scripted([llm.LLMError("budget_cap")]), m, ix, nums)
        self.assertEqual((m["st"]["syn"]["ok"], m["st"]["syn"]["err"]), (0, "budget_cap"))
        self.assertIn("vi_partial", live(m, rest)["quality"]["warn"])


class TestVerify(unittest.TestCase):
    def synth(self):
        m, ix, nums, rest = mapped()
        ids = [it["id"] for it in m["items"]]
        A.vi_synth(Scripted([vs_answer({"one": {"text": "סיכום", "from": [ids[0]]}, "bluf": None, "take": [
            {"text": "תובנה", "from": [ids[1]]}], "thesis": None, "big": None, "adds": []})]), m, ix, nums)
        return m, ix, rest

    def test_planted_unsupported(self):
        """קבלה: טענה סותרת נמחקת (גם מהפרק ומהתקציר); לא נתמכת — "הוסק" בביטחון נמוך"""
        m, ix, rest = self.synth()
        one = m["briefing"]["one"]
        first = m["items"][0]["id"]
        verd = {one: "con", first: "uns"}

        def ans(p):
            return "\n".join("%s|%s" % (i, verd.get(i, "sup")) for i in claim_ids(p))
        eng = Scripted(ans)
        A.vi_verify(eng, m, ix)
        st = m["st"]["vv"]
        self.assertEqual(eng.calls[0]["k"], "vv")
        self.assertTrue(any(b.get("type") == "search_result" for b in eng.calls[0]["prompt"]), "הראיות כ־search_result")
        self.assertEqual((st["ok"], st["con"], st["uns"]), (1, 1, 1))
        ids = {x["id"] for x in m["items"]}
        self.assertNotIn(one, ids)
        self.assertNotIn("one", m["briefing"])
        self.assertTrue(all(one not in c["items"] for c in m["chapters"]))
        x = next(it for it in m["items"] if it["id"] == first)
        self.assertEqual((x["ver"], x["basis"], x["conf"]), ("uns", "analyst_inference", "low"))
        vi = live(m, rest)
        self.assertNotIn("vi_unver", vi["quality"]["warn"])
        self.assertEqual(vi["quality"]["sup"], sum(1 for it in vi["items"] if it["ver"] == "sup"))
        self.assertEqual(C.norm_vi(vi), vi)

    def test_missing_verdict_is_unknown(self):
        m, ix, rest = self.synth()
        A.vi_verify(Scripted(lambda p: "nothing useful"), m, ix)
        self.assertTrue(all(it["ver"] == "unk" for it in m["items"]))
        self.assertEqual(m["st"]["vv"]["ok"], 1, "הקריאה הצליחה — פשוט בלי פסק")

    def test_failed_call_stays_unverified(self):
        m, ix, rest = self.synth()
        A.vi_verify(Scripted([llm.LLMError("http_500")]), m, ix)
        self.assertEqual((m["st"]["vv"]["ok"], m["st"]["vv"]["fail"]), (0, 1))
        self.assertIn("vi_unver", live(m, rest)["quality"]["warn"], "טיוטה — לא אומתה")

    def test_batches_and_cap(self):
        m, ix, rest = self.synth()
        old = A.VV_BATCH
        A.VV_BATCH = 2
        try:
            n = len([it for it in m["items"] if it["ev"]])
            eng = Scripted([llm.LLMError("budget_cap")])
            A.vi_verify(eng, m, ix)
        finally:
            A.VV_BATCH = old
        self.assertEqual(len(eng.calls), 1, "בתקרה — לא ממשיכים")
        self.assertEqual(m["st"]["vv"]["fail"], -(-n // 2), "כל האצוות שלא רצו — נכשלו")

    def test_judge_engine(self):
        eng = llm.Engine(llm.Spec("anthropic", "claude-sonnet-5-5", "medium"), cap_usd=1.0, transport="api")
        j = A.judge_engine(eng)
        self.assertEqual((j.spec.model, j.spec.effort), llm.JUDGE[1:])
        self.assertIs(j.ledger, eng.ledger, "ספר חשבונות ותקרה משותפים")
        man = Scripted([])
        self.assertIs(A.judge_engine(man), man)


class _Ctx:
    def __init__(self, st, pdir):
        self.st, self.pdir, self.reports = st, pdir, []

    def report(self, st=None, p=None, msg=None, force=False, **extra):
        self.reports.append(dict({"st": st, "p": p, "msg": msg}, **extra))


class _J:
    """job מדומה לאימות החוזר: הקלט = ה־vi.json של הניתוח; בלי vt (בלי תמלול, מסך או וידאו)"""

    def __init__(self, src, ctx):
        self.src, self.put, self.got, self.LIVE_USAGE = src, [], [], None
        self.Ctx = lambda st: ctx
        self.load_state = lambda: ctx.st

    def fetch_input(self, ctx, fid, dest, size, cb):
        self.got.append(fid)
        Path(dest).write_bytes(Path(self.src).read_bytes())
        cb(1.0)

    def note_timing(self, ctx, cmd, t0, t1, rss=0, cpu=None):
        pass

    def vt(self, *a, **k):
        raise AssertionError("אימות חוזר בלי vt")

    def put_output_retry(self, ctx, p, name, k, mime, cb):
        cb(1.0)
        self.put.append((k, name, mime, json.loads(Path(p).read_text(encoding="utf-8"))))
        return "R2_vinew"


class TestReverify(unittest.TestCase):
    """PR 1.2ג — "אמת שוב": רק האימות על ה־vi.json שנשמר (spec.vo). בלי מיפוי ובלי סינתזה"""

    def draft(self):
        """ניתוח שהאימות שלו נכשל (תקלה ב־API): טיוטה — לא אומתה"""
        m, ix, nums, rest = mapped()
        ids = [it["id"] for it in m["items"]]
        A.vi_synth(Scripted([vs_answer({"one": {"text": "סיכום", "from": [ids[0]]}, "bluf": None, "take": [
            {"text": "תובנה", "from": [ids[1]]}], "thesis": None, "big": None, "adds": []})]), m, ix, nums)
        A.vi_verify(Scripted([llm.LLMError("http_500")]), m, ix)
        vi = live(m, rest)
        self.assertIn("vi_unver", vi["quality"]["warn"])
        return vi

    def run_vo(self, vi, eng):
        import tempfile
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        src = Path(td.name) / "in.json"
        src.write_text(json.dumps(vi, ensure_ascii=False), encoding="utf-8")
        ctx = _Ctx({"spec": {"vi": 1, "vo": 1, "from": "auto", "to": ["he"], "mode": ""},
                    "files": {"i": {"id": "R2_viold", "name": "t (ניתוח).json", "size": 1}}}, Path(td.name) / "p")
        J = _J(src, ctx)
        import io
        from contextlib import redirect_stdout
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = A.vi_run(J, None, engine=eng)
        return rc, ctx, J, buf.getvalue()

    def test_rebuild_is_identity(self):
        """בלי אימות — vi_from_file ואז vi_rebuild מחזירים את אותו קובץ (גם vi_unver, הכיסוי והאזהרות)"""
        vi = self.draft()
        m, ix = A.vi_from_file(json.loads(json.dumps(vi)))
        self.assertEqual(A.vi_rebuild(vi, m), vi)
        self.assertEqual(ix.text(vi["items"][0]["ev"][0]), next(e["text"] for e in vi["evidence"] if e["id"] == vi["items"][0]["ev"][0]))

    def test_success_clears_draft(self):
        """קבלה: אימות חוזר שהצליח מוריד את vi_unver; רק vv נקרא — בלי מיפוי ובלי סינתזה"""
        vi = self.draft()
        eng = Scripted(lambda p: "\n".join("%s|sup" % i for i in claim_ids(p)))
        rc, ctx, J, out = self.run_vo(vi, eng)
        self.assertEqual(rc, 0)
        self.assertEqual({c["k"] for c in eng.calls}, {"vv"}, "רק האימות")
        self.assertEqual(J.got, ["R2_viold"])
        [(k, name, mime, nv)] = J.put
        self.assertEqual((k, name, mime), ("vi", "t (ניתוח).json", "application/json"))
        self.assertNotIn("vi_unver", nv["quality"]["warn"])
        self.assertEqual(nv["quality"]["sup"], len(nv["items"]))
        self.assertEqual([it["id"] for it in nv["items"]], [it["id"] for it in vi["items"]], "אותם פריטים")
        self.assertEqual(nv["evidence"], vi["evidence"])
        self.assertEqual(C.norm_vi(nv), nv)
        last = ctx.reports[-1]
        self.assertTrue(last.get("done"))
        self.assertEqual(last["out"], [{"id": "R2_vinew", "name": "t (ניתוח).json", "size": last["out"][0]["size"], "k": "vi"}])
        self.assertEqual(last["vsm"]["ok"], len(nv["items"]))
        self.assertNotIn("lx", last, "בלי מאגר הלמידה")
        self.assertEqual([r["st"] for r in ctx.reports if r["st"] and r["p"] == 0], ["up", "rv", "sv"])
        facts = json.loads([x for x in out.splitlines() if x.startswith("VI_VV ")][0][6:])
        self.assertEqual(facts["vv"]["ok"], 1)

    def test_fail_again_keeps_draft(self):
        """קבלה: אימות שנכשל שוב — הקובץ נשאר טיוטה, והעבודה מסתיימת (לא נכשלת)"""
        vi = self.draft()
        rc, ctx, J, out = self.run_vo(vi, Scripted(lambda p: llm.LLMError("http_500")))
        self.assertEqual(rc, 0)
        nv = J.put[0][3]
        self.assertIn("vi_unver", nv["quality"]["warn"])
        self.assertTrue(ctx.reports[-1].get("done"))
        self.assertIn("טיוטה", ctx.reports[-1]["msg"])

    def test_bad_input_fails(self):
        rc = None
        with self.assertRaises(SystemExit):
            rc = self.run_vo({"v": A.VI_V, "items": []}, Scripted([]))
        self.assertIsNone(rc)

    def test_gate(self):
        """בלי SNB_VI_LIVE — נדחה לפני הקריאה (בלי הוצאה)"""
        import os
        os.environ.pop("SNB_VI_LIVE", None)
        vi = self.draft()
        import tempfile
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        ctx = _Ctx({"spec": {"vi": 1, "vo": 1, "from": "auto", "to": ["he"]}, "files": {"i": {"id": "R2_x", "size": 1}}}, Path(td.name))
        J = _J(Path(td.name) / "none", ctx)
        with self.assertRaises(SystemExit):
            A.vi_run(J, None)
        self.assertEqual(ctx.reports[-1]["err"], "vi_off")
        self.assertEqual(J.got, [])



class _JJ(_J):
    """job מדומה לשופט: כל מזהה — הקובץ שלו"""

    def __init__(self, files, ctx):
        super().__init__(None, ctx)
        self.files = files

    def fetch_input(self, ctx, fid, dest, size, cb):
        self.got.append(fid)
        Path(dest).write_text(json.dumps(self.files[fid], ensure_ascii=False), encoding="utf-8")
        cb(1.0)


class TestJudge(unittest.TestCase):
    """PR 1.6 — השופט בזוגות (spec.vj): כל זוג פעמיים בסדר הפוך, בלי תוצרים — רק vjd בדיווח. מוקים בלבד (בלי הוצאה)"""

    def pair_vis(self):
        m, ix, nums, rest = mapped()
        ids = [it["id"] for it in m["items"]]
        A.vi_synth(Scripted([vs_answer({"one": {"text": "סיכום", "from": [ids[0]]}, "bluf": None, "take": [
            {"text": "תובנה", "from": [ids[1]]}], "thesis": None, "big": None, "adds": []})]), m, ix, nums)
        A.vi_verify(Scripted(lambda p: "\n".join("%s|sup" % i for i in claim_ids(p))), m, ix)
        x = live(m, rest)
        y = json.loads(json.dumps(x))
        y["items"][0]["text"] = "BETTER " + y["items"][0]["text"]
        return x, y

    def run_vj(self, eng, pairs=None, ref=None):
        import io
        import tempfile
        from contextlib import redirect_stdout
        x, y = self.pair_vis()
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        jx, jy = "j" + "a" * 20, "j" + "b" * 20
        pairs = pairs if pairs is not None else [{"x": {"id": "R2_x", "size": 1, "j": jx, "wa": 0}, "y": {"id": "R2_y", "size": 1, "j": jy, "wa": 1}}]
        ctx = _Ctx({"spec": {"vi": 1, "vj": 1, "from": "auto", "to": ["he"], "mode": ""}, "vjp": pairs,
                    "vref": ref if ref is not None else {"bounds": [{"t0": 0, "lv": 1, "title": "פתיחה"}], "units": [{"w": 3, "text": "יחידה"}]}},
                   Path(td.name) / "p")
        J = _JJ({"R2_x": x, "R2_y": y}, ctx)
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = A.vi_run(J, None, engine=eng)
        return rc, ctx, J, jy

    @staticmethod
    def fair(p):
        """שופט עקבי: מעדיף את הניתוח עם BETTER, בכל סדר"""
        a = p.split("=== Analysis A ===")[1].split("=== Analysis B ===")[0]
        return '{"w":"A","a":[],"b":["uns:ma","flu:mi"]}' if "BETTER" in a else '{"w":"B","a":["uns:ma","flu:mi"],"b":[]}'

    def test_pair_both_orders(self):
        eng = Scripted(self.fair)
        rc, ctx, J, jy = self.run_vj(eng)
        self.assertEqual(rc, 0)
        self.assertEqual(len(eng.calls), 2, "פעמיים — בסדר הפוך")
        self.assertTrue(all(c["fixed"] == V.VJ_SYS for c in eng.calls))
        self.assertIn("יחידה", eng.calls[0]["prompt"], "יחידות הייחוס בבקשה")
        self.assertEqual(sorted(J.got), ["R2_x", "R2_y"])
        self.assertEqual(J.put, [], "בלי תוצרים")
        last = ctx.reports[-1]
        self.assertTrue(last.get("done"))
        self.assertNotIn("out", last)
        [r] = last["vjd"]["p"]
        self.assertEqual((r["j"], r["wa"], r["w"]), (jy, 1, "Y"))
        self.assertEqual((r["ex"], r["ey"], r["yu"]), (12, 0, 0))
        self.assertIn("support_rate", r["a"])
        self.assertEqual(last["vjd"]["h"], V.vj_hash())

    def test_disagree_is_tie_and_uns_needs_both(self):
        """שופט שתמיד בוחר A (הטיית מיקום) — תיקו; טענה לא נתמכת ב־B רק בהרצה אחת — לא נספרת"""
        eng = Scripted(lambda p: '{"w":"A","a":[],"b":["uns:cr"]}')
        rc, ctx, J, jy = self.run_vj(eng)
        r = ctx.reports[-1]["vjd"]["p"][0]
        self.assertEqual(r["w"], "tie")
        self.assertEqual(r["yu"], 0)
        self.assertEqual((r["ex"], r["ey"]), (25, 25))

    def test_all_fail(self):
        """השופט נכשל בכל הזוגות — העבודה נכשלת (לא "נשפט")"""
        with self.assertRaises(SystemExit):
            self.run_vj(Scripted(lambda p: llm.LLMError("http_500")))

    def test_no_pairs(self):
        with self.assertRaises(SystemExit):
            self.run_vj(Scripted([]), pairs=[])



class TestRefDraft(unittest.TestCase):
    """PR 1.6 (ה5) — טיוטת ייחוס (spec.vp): קריאה אחת למודל של העבודה, בלי תוצרים — vpd בדיווח. מוקים בלבד (בלי הוצאה)"""

    def run_vp(self, eng):
        import io
        import tempfile
        from contextlib import redirect_stdout
        m, ix, nums, rest = mapped()
        vi = live(m, rest)
        td = tempfile.TemporaryDirectory()
        self.addCleanup(td.cleanup)
        ctx = _Ctx({"spec": {"vi": 1, "vp": 1, "from": "auto", "to": ["he"], "mode": "sonnet-medium"},
                    "files": {"i": {"id": "R2_vi", "size": 1}}}, Path(td.name) / "p")
        J = _JJ({"R2_vi": vi}, ctx)
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = A.vi_run(J, None, engine=eng)
        return rc, ctx, J, vi

    def test_draft(self):
        ans = json.dumps({"bounds": [{"t0": 0, "lv": 1, "title": "פתיחה"}], "units": [{"w": 3, "text": "יחידה"}, "x"],
                          "qa": [{"q": "ש", "a": "ת", "t": 5, "so": 0}], "slides": [], "junk": 1}, ensure_ascii=False)
        eng = Scripted(["הנה:\n" + ans])
        rc, ctx, J, vi = self.run_vp(eng)
        self.assertEqual(rc, 0)
        [c] = eng.calls
        self.assertEqual((c["k"], c["fixed"]), ("vs", V.VP_SYS))
        self.assertIn(vi["evidence"][0]["text"], c["prompt"], "התמליל בבקשה")
        self.assertNotIn(vi["evidence"][0]["id"] + "]", c["prompt"], "בלי מזהים")
        self.assertEqual(J.put, [], "בלי תוצרים")
        last = ctx.reports[-1]
        self.assertTrue(last.get("done"))
        d = last["vpd"]
        self.assertEqual(d["units"], [{"w": 3, "text": "יחידה"}], "פריט שאינו אובייקט נזרק")
        self.assertNotIn("junk", d)
        self.assertEqual(d["meta"]["tier"], "a")

    def test_bad_answer_fails(self):
        with self.assertRaises(SystemExit):
            self.run_vp(Scripted(["לא JSON"]))
        rc = None
        with self.assertRaises(SystemExit):
            rc = self.run_vp(Scripted([llm.LLMError("http_500")]))
        self.assertIsNone(rc)

    def test_parse(self):
        self.assertIsNone(V.parse_vp('{"bounds":[],"units":[],"qa":[]}'), "טיוטה ריקה — לא טיוטה")
        self.assertEqual(V.parse_vp('{"units":[{"w":1,"text":"a"}]}')["bounds"], [])


class TestApplyVerdict(unittest.TestCase):
    IT = {"id": "n1", "text": "x", "ev": ["e1", "e2"], "basis": "speaker", "conf": "high", "ver": "unk"}

    def test_cite_off(self):
        x, iss = C.apply_verdict(self.IT, "sup", {"e9"}, True)
        self.assertEqual((x["ver"], x["conf"], iss), ("part", "med", ["cite_off"]), "הציטוט לא מה־ev — part")
        x, iss = C.apply_verdict(self.IT, "sup", {"e2"}, True)
        self.assertEqual((x["ver"], iss), ("sup", []))
        x, _ = C.apply_verdict(self.IT, "sup", set(), False)
        self.assertEqual(x["ver"], "sup", "מנוע בלי Citations — לא נענשים")
        x, iss = C.apply_verdict(self.IT, "sup", set(), True)
        self.assertEqual((x["ver"], iss), ("part", ["cite_off"]), "בתשובה יש ציטוטים, אבל לא לשורה הזו — part")

    def test_cite_none(self):
        """10/11/2026: בתשובה כולה אין אף ציטוט (cited=None) — הפסק נשאר, עם cite_none (עד היום: כל sup → part)"""
        x, iss = C.apply_verdict(self.IT, "sup", None, True)
        self.assertEqual((x["ver"], x["conf"], iss), ("sup", "high", ["cite_none"]))
        x, iss = C.apply_verdict(self.IT, "part", None, True)
        self.assertEqual((x["ver"], iss), ("part", []))

    def test_parse_vv_cites(self):
        text = "n1|sup|the market grew\nn2|sup|— \nn3|part|half of it\n"
        refs = ["e1", "e2", "e3"]
        i1, i3 = text.index("the market"), text.index("half")
        cites = [{"at": i1, "n": 15, "refs": [{"r": 0}]}, {"at": i3, "n": 9, "refs": [{"r": 2}, {"r": 99}]}]
        got = V.parse_vv(text, cites, refs)
        self.assertEqual(got, {"n1": ("sup", {"e1"}), "n2": ("sup", set()), "n3": ("part", {"e3"})}, "ציטוט שייך לשורה שלו; מצביע מחוץ לטווח — מתעלמים")
        self.assertEqual(V.parse_vv(text, None, refs)["n1"], ("sup", None), "בלי אף ציטוט — None")
        self.assertEqual(V.parse_vv(text, [], refs)["n2"], ("sup", None))
        self.assertEqual(V.parse_vv("**n7** | sup | x")["n7"][0], "sup", "הפורמט עם הציטוט עדיין נקרא")

    def test_prompt_asks_quote(self):
        self.assertIn("<claim id>|<verdict>|<support>", V.VV_SYS, "קטע מהראיה בכל שורה — בלעדיו אין Citations")
        self.assertIn("cite the evidence for each line", V.VV_SYS, "11/11: בקשה מפורשת לצטט (תיעוד ה־Citations)")
        self.assertNotIn("No other text", V.VV_SYS, "פרומפט 'פורמט בלבד' → מעט או אפס ציטוטים")
        self.assertNotIn("<verdict>\nCite", V.VV_SYS)
        blocks, _ = V.vv_blocks([{"id": "n1", "text": "x", "ev": [{"id": "s1", "text": "y"}]}])
        self.assertIn("cite the evidence for each line", blocks[-1]["text"], "גם השורה האחרונה בבקשה — לא סותרת את ההנחיה")
        self.assertGreaterEqual(V.PV, 3, "שינוי בפרומפט — PV עולה")
        self.assertGreaterEqual(A.VV_MAX_OUT, 6000, "החשיבה של haiku-high (~2.8K) + 30 שורות עם ציטוט — בלי קטיעה ושליחה כפולה")

    def test_codes(self):
        self.assertEqual(C.apply_verdict(self.IT, "con", set(), True), (None, ["vv_con"]))
        self.assertEqual(C.apply_verdict(self.IT, None, set(), True)[0]["ver"], "unk")
        self.assertEqual(self.IT["ver"], "unk", "לא משנה את הקלט")
