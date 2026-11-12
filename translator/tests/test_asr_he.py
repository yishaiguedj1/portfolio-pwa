"""התמלול העברי לניתוח (vt/asr_he.py, גל 0 — PR 0.1): חלוקת VAD, בדיקת הכיסוי מול zipformer, זיהוי חורים,
בחירת הקטעים לפענוח חוזר והנפילות. מוקים בלבד — בלי מודלים, בלי רשת, בלי קול אמיתי."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from vt import asr_he as A  # noqa: E402


def truth(sentences, gap=1.2, word=0.4, t0=0.5):
    """ציר זמן סינתטי: משפטים (רשימות מילים), כל מילה word שנ׳, שקט gap בין משפטים → [{w, s, e}], הסוף."""
    out, t = [], t0
    for sent in sentences:
        for w in sent:
            out.append({"w": w, "s": round(t, 2), "e": round(t + word * 0.9, 2)})
            t += word
        t += gap
    return out, t + 0.5


class FakeZf:
    def __init__(self, words):
        self.words, self.calls = words, []

    def many(self, audio, spans):
        self.calls.append(list(spans))
        return [[dict(w) for w in A.words_in(self.words, s, e)] for s, e in spans]


class FakeIvrit:
    """many — הטקסט של המילים בכל קטע, חוץ ממה שבטווחי ההשמטה (omit); one — תמיד הכל (פענוח בחלקים קטנים מחזיר)."""

    def __init__(self, words, omit=(), phantom=None, deaf=(), loop=()):
        self.words, self.omit, self.phantom, self.deaf, self.loop = words, list(omit), phantom, list(deaf), list(loop)
        self.many_calls, self.one_calls = [], []

    def _text(self, s, e, omit):
        if any(a < e and b > s for a, b in self.deaf):
            return ""
        ws = [w["w"] for w in A.words_in(self.words, s, e)
              if not any(a <= w["s"] < b for a, b in omit)]
        if not ws and self.phantom and self.phantom[0] < e and self.phantom[1] > s:
            return "תודה רבה שצפיתם"
        return " ".join(ws)

    def _r(self, s, e, text):
        lp, nsp, cr = -0.3, 0.05, 1.4
        if text == "תודה רבה שצפיתם":
            nsp = 0.9
        if any(a < e and b > s for a, b in self.loop):
            cr = 3.1
        return {"text": text, "lp": lp, "nsp": nsp, "cr": cr}

    def many(self, audio, spans):
        self.many_calls.append(list(spans))
        return [self._r(s, e, self._text(s, e, self.omit)) for s, e in spans]

    def one(self, audio, span, temps=(0.0, 0.2, 0.4)):
        self.one_calls.append(span)
        s, e = span
        return self._r(s, e, self._text(s, e, ()))


def zeros(total):
    return np.zeros(int(total * A.SR), dtype=np.float32)


class TestText(unittest.TestCase):
    def test_norm_words(self):
        self.assertEqual(A.norm_words('שָׁלוֹם, עוֹלָם! "AI" ש״ח'), ['שלום', 'עולם', 'ai', 'שח'])
        self.assertEqual(A.norm_words('  — , . '), [])
        self.assertEqual(A.norm_words('50% ו-3'), ['50%', 'ו3'])

    def test_similarity(self):
        self.assertEqual(A.similarity('אחת שתיים', 'אחת, שתיים.'), 1.0)
        self.assertLess(A.similarity('אחת שתיים שלוש ארבע', 'אחת'), 0.5)


class TestPlan(unittest.TestCase):
    def test_join_short_gaps_up_to_target(self):
        segs = A.plan_segments([(0, 3), (3.4, 6), (6.3, 9), (9.2, 12)], 20, seg_max=14, target=10, gap=0.6)
        self.assertEqual(segs, [(0.0, 9.0), (9.2, 12.0)])

    def test_long_gap_not_joined(self):
        self.assertEqual(A.plan_segments([(0, 3), (5, 7)], 10, gap=0.6), [(0.0, 3.0), (5.0, 7.0)])

    def test_split_long(self):
        segs = A.plan_segments([(0, 30)], 40, seg_max=14)
        self.assertEqual(len(segs), 3)
        self.assertTrue(all(e - s <= 14 for s, e in segs))
        self.assertEqual((segs[0][0], segs[-1][1]), (0.0, 30.0))

    def test_split_long_cuts_in_silence(self):
        # 12/11/2026: קטע של 30 שנ׳ — החיתוך השווה (10, 20) נופל באמצע מילה; יש שקט ב־9.0 וב־21.0
        audio = np.random.RandomState(1).uniform(-0.3, 0.3, int(30 * A.SR)).astype(np.float32)
        for q in (9.0, 21.0):
            audio[int((q - 0.1) * A.SR):int((q + 0.1) * A.SR)] = 0
        segs = A.plan_segments([(0, 30)], 30, seg_max=14, audio=audio)
        self.assertEqual(len(segs), 3)
        self.assertAlmostEqual(segs[0][1], 9.0, delta=0.06)
        self.assertAlmostEqual(segs[1][1], 21.0, delta=0.06)
        self.assertTrue(all(e - s <= 14 for s, e in segs))
        self.assertEqual((segs[0][0], segs[-1][1]), (0.0, 30.0))

    def test_quiet_cut_bounds_and_fallback(self):
        self.assertEqual(A.quiet_cut(None, 5.0, 4.0, 6.0), 5.0)
        audio = np.ones(int(10 * A.SR), dtype=np.float32)
        audio[int(1.0 * A.SR):int(1.3 * A.SR)] = 0                # שקט מחוץ לחלון — לא נבחר
        self.assertAlmostEqual(A.quiet_cut(audio, 5.0, 4.0, 6.0), 5.0, delta=0.02)

    def test_split_span_no_words_cuts_in_silence(self):
        audio = np.random.RandomState(2).uniform(-0.3, 0.3, int(10 * A.SR)).astype(np.float32)
        audio[int(4.2 * A.SR):int(4.5 * A.SR)] = 0
        ps = A.split_span(0, 10, [], parts=2, audio=audio)
        self.assertAlmostEqual(ps[0][1], 4.35, delta=0.1)

    def test_overlap_and_clamp(self):
        segs = A.plan_segments([(-1, 2), (1.5, 3), (9, 12)], 10)
        self.assertEqual(segs, [(0.0, 3.0), (9.0, 10.0)])

    def test_module_constants_read_at_call_time(self):
        old = A.SEG_TARGET
        try:
            A.SEG_TARGET = 4.0
            self.assertEqual(len(A.plan_segments([(0, 3), (3.3, 6)], 10)), 2)
        finally:
            A.SEG_TARGET = old

    def test_tile_covers_everything(self):
        tl = A.tile([(2, 5), (130, 135)], 140, piece=60)
        self.assertEqual(tl[0], (0.0, 2.0, 0))
        self.assertEqual(tl[1], (2, 5, 1))
        gaps = [x for x in tl if x[2] == 0]
        self.assertTrue(all(e - s <= 60 for s, e, _ in gaps))
        flat = sorted(tl)
        for a, b in zip(flat, flat[1:]):
            self.assertAlmostEqual(a[1], b[0], places=2)
        self.assertEqual(flat[-1][1], 140)


class TestZipformerWords(unittest.TestCase):
    def test_tokens_to_words(self):
        toks = [' ע', 'וצ', 'מת', 'ה', ' חו', 'דר', 'ת', '.', ' AI']
        ts = [0.72, 0.8, 0.92, 1.08, 1.2, 1.32, 1.4, 1.5, 2.0]
        ws = A.zf_words(toks, ts, off=10.0, end=13.0)
        self.assertEqual([w['w'] for w in ws], ['עוצמתה', 'חודרת.', 'AI'])
        self.assertEqual(ws[0]['s'], 10.72)
        self.assertEqual(ws[0]['e'], 11.2)            # תחילת המילה הבאה
        self.assertLessEqual(ws[-1]['e'] - ws[-1]['s'], 0.8 + 1e-9)

    def test_space_token_and_punct_only(self):
        ws = A.zf_words([' ', 'שלום', ' ,'], [0.1, 0.2, 0.5])
        self.assertEqual([w['w'] for w in ws], ['שלום'])


class TestCoverage(unittest.TestCase):
    def setUp(self):
        self.words, _ = truth([['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י']], gap=0)

    def test_hole_found_where_ivrit_skipped(self):
        text = 'א ב ג י'                                   # ד–ט (6 מילים, 2.4 שנ׳) חסרים
        hs = A.holes(text, self.words)
        self.assertEqual(len(hs), 1)
        self.assertAlmostEqual(hs[0][0], self.words[3]['s'])
        self.assertAlmostEqual(hs[0][1], self.words[8]['e'])

    def test_no_hole_for_short_or_soft_differences(self):
        self.assertEqual(A.holes('א ב ג ד ו ז ח ט י', self.words), [])                 # מילה אחת חסרה
        zw = [{'w': 'לרפובליקיניזם', 's': 0, 'e': 0.5}, {'w': 'הלאומנות', 's': 0.5, 'e': 1},
              {'w': 'והאמונה', 's': 1, 'e': 1.5}, {'w': 'שהמדינה', 's': 1.5, 'e': 2}]
        self.assertEqual(A.holes('לרפובליקניזם על אומנות והאמונה שהמדינה', zw), [])  # איות שונה ≠ חור

    def test_suspicious_reasons(self):
        self.assertEqual(A.suspicious({'nw': 3, 'nz': 10}), ['cover'])
        self.assertEqual(A.suspicious({'nw': 9, 'nz': 10, 'holes': [(1, 3)]}), ['hole'])
        self.assertEqual(A.suspicious({'nw': 9, 'nz': 10, 'cr': 3.0}), ['loop'])
        self.assertEqual(A.suspicious({'nw': 9, 'nz': 10, 'lp': -1.4}), ['lp'])
        self.assertEqual(A.suspicious({'nw': 2, 'nz': 2}), [])                       # מעט מילים — אין על מה לשפוט
        self.assertEqual(A.suspicious({'nw': 10, 'nz': 10, 'cr': 1.5, 'lp': -0.2}), [])

    def test_phantom(self):
        self.assertTrue(A.phantom({'nz': 0, 'nw': 3, 'nsp': 0.9}))
        self.assertTrue(A.phantom({'nz': 0, 'nw': 3, 'lp': -1.5}))
        self.assertFalse(A.phantom({'nz': 0, 'nw': 3, 'nsp': 0.1, 'lp': -0.2, 'cr': 1.2}))
        self.assertFalse(A.phantom({'nz': 2, 'nw': 3, 'nsp': 0.9}))

    def test_split_span_at_largest_gaps(self):
        zw = [{'w': 'x', 's': 0.5, 'e': 1.0}, {'w': 'y', 's': 1.1, 'e': 3.0}, {'w': 'z', 's': 6.0, 'e': 7.0},
              {'w': 'w', 's': 7.1, 'e': 9.5}]
        parts = A.split_span(0.0, 10.0, zw, parts=2)
        self.assertEqual(len(parts), 2)
        self.assertAlmostEqual(parts[0][1], 4.5)                    # אמצע השקט בין 3.0 ל־6.0
        eq = A.split_span(0.0, 9.0, [], parts=3)
        self.assertEqual(eq, [(0.0, 3.0), (3.0, 6.0), (6.0, 9.0)])
        self.assertEqual(A.split_span(0.0, 3.0, []), [(0.0, 3.0)])  # קצר מדי לחלוקה

    def test_split_at_respects_min(self):
        self.assertEqual(A.split_at(0, 10, [0.5, 4, 5, 9.5]), [(0, 4), (4, 10)])
        self.assertEqual(A.split_at(0, 10, [3, 7]), [(0, 3), (3, 7), (7, 10)])

    def test_assign_by_midpoint(self):
        class G:
            def __init__(self, s, e, t):
                self.start, self.end, self.text = s, e, t
                self.avg_logprob, self.no_speech_prob, self.compression_ratio = -0.2, 0.1, 1.3
        r = A.assign([(0, 5), (5, 10), (10, 15)], [G(0, 5, ' אחת'), G(10, 15, 'שלוש ')])
        self.assertEqual([x['text'] for x in r], ['אחת', '', 'שלוש'])
        self.assertIsNone(r[1]['lp'])


class TestTranscribe(unittest.TestCase):
    def setUp(self):
        s1 = ['ש%d' % i for i in range(12)]
        s2 = ['ק%d' % i for i in range(12)]
        s3 = ['ר%d' % i for i in range(8)]
        self.words, self.total = truth([s1, s2, s3])
        sent = []
        t = 0.5
        for n in (12, 12, 8):
            sent.append((t - 0.1, t + n * 0.4))
            t += n * 0.4 + 1.2
        self.sent = sent

    def vad_all(self, audio):
        return list(self.sent)

    def test_clean_run_no_repair(self):
        zf, iv = FakeZf(self.words), FakeIvrit(self.words)
        r = A.transcribe(zeros(self.total), iv, zf, vad_fn=self.vad_all)
        self.assertEqual(r['engine'], 'ivrit+zf')
        self.assertEqual(r['quality'], 'ok')
        self.assertEqual(r['stats']['n_susp'], 0)
        self.assertEqual(iv.one_calls, [])
        self.assertEqual(sum(len(g['text'].split()) for g in r['segments']), 32)
        tiled = sorted(x for call in zf.calls for x in call)        # zipformer עבר על כל ציר הזמן
        self.assertEqual(tiled[0][0], 0.0)
        self.assertAlmostEqual(tiled[-1][1], self.total, places=2)

    def test_omission_found_and_redecoded(self):
        w = self.words
        omit = [(w[15]['s'], w[21]['e'])]                            # 7 מילים מתוך המשפט השני
        zf, iv = FakeZf(w), FakeIvrit(w, omit=omit)
        r = A.transcribe(zeros(self.total), iv, zf, vad_fn=self.vad_all)
        st = r['stats']
        self.assertEqual(st['n_susp'], 1)
        self.assertEqual(st['n_w2'], 1)
        g = [x for x in r['segments'] if x['src'] == 'w2'][0]
        self.assertIn('text0', g)
        self.assertEqual(len(g['text'].split()), 12)
        self.assertEqual(r['quality'], 'ok')

    def test_hole_inside_long_segment(self):
        """השמטה של 5 מילים בתוך קטע ארוך — ספירת המילים עוד מעל COVER, אבל החור נתפס."""
        long = [['מ%d' % i for i in range(30)]]
        w, total = truth(long)
        omit = [(w[10]['s'], w[14]['e'])]
        zf, iv = FakeZf(w), FakeIvrit(w, omit=omit)
        r = A.transcribe(zeros(total), iv, zf, vad_fn=lambda a: [(0.4, w[-1]['e'] + 0.1)])
        self.assertGreaterEqual(r['stats']['n_hole'], 1)
        self.assertEqual(sum(len(g['text'].split()) for g in r['segments']), 30)

    def test_gap_rescue(self):
        """ה־VAD לא שמע את המשפט השני — zipformer שמע ברווח, ונוצר קטע חדש."""
        zf, iv = FakeZf(self.words), FakeIvrit(self.words)
        r = A.transcribe(zeros(self.total), iv, zf, vad_fn=lambda a: [self.sent[0], self.sent[2]])
        self.assertEqual(r['stats']['n_gap'], 1)
        self.assertEqual(sum(len(g['text'].split()) for g in r['segments']), 32)
        self.assertTrue(any(g.get('gap') for g in r['segments']))

    def test_phantom_dropped(self):
        zf, iv = FakeZf(self.words), FakeIvrit(self.words, phantom=(self.total - 0.5, self.total))
        spans = self.sent + [(self.total - 0.45, self.total - 0.05)]
        r = A.transcribe(zeros(self.total), iv, zf, vad_fn=lambda a: spans)
        self.assertEqual(r['stats']['n_drop'], 1)
        d = [g for g in r['segments'] if g['src'] == 'drop'][0]
        self.assertEqual(d['text'], '')
        self.assertEqual(d['text0'], 'תודה רבה שצפיתם')

    def test_zipformer_substitutes_when_ivrit_deaf(self):
        w = self.words
        zf, iv = FakeZf(w), FakeIvrit(w, deaf=[(self.sent[1][0], self.sent[1][1])])
        r = A.transcribe(zeros(self.total), iv, zf, vad_fn=self.vad_all)
        g = [x for x in r['segments'] if x['src'] in ('zf', 'mix')]
        self.assertEqual(len(g), 1)
        self.assertEqual(len(g[0]['text'].split()), 12)
        self.assertGreater(r['stats']['zf_share'], A.ZF_SHARE_LOW)
        self.assertEqual(r['quality'], 'low')

    def test_loop_retried_with_temperature(self):
        w = self.words
        zf, iv = FakeZf(w), FakeIvrit(w, loop=[(self.sent[0][0], self.sent[0][1])])
        r = A.transcribe(zeros(self.total), iv, zf, vad_fn=self.vad_all)
        g = r['segments'][0]
        self.assertIn('loop', g.get('why', []))
        self.assertTrue(iv.one_calls)                              # ניסיון חוזר עם temperature fallback
        self.assertIn(g['src'], ('zf', 'mix'))                      # עדיין בלולאה → הטקסט של zipformer
        self.assertEqual(len(g['text'].split()), 12)

    def test_without_ivrit_zipformer_only(self):
        r = A.transcribe(zeros(self.total), None, FakeZf(self.words), vad_fn=self.vad_all)
        self.assertEqual((r['engine'], r['quality']), ('zf', 'low'))
        self.assertTrue(all(g['src'] == 'zf' for g in r['segments']))
        self.assertEqual(sum(len(g['text'].split()) for g in r['segments']), 32)

    def test_without_zipformer_no_repair(self):
        w = self.words
        iv = FakeIvrit(w, omit=[(w[15]['s'], w[21]['e'])])
        r = A.transcribe(zeros(self.total), iv, None, vad_fn=self.vad_all)
        self.assertEqual(r['engine'], 'ivrit')
        self.assertEqual(r['stats']['n_susp'], 0)
        self.assertEqual(iv.one_calls, [])

    def test_output_shape(self):
        r = A.transcribe(zeros(self.total), FakeIvrit(self.words), FakeZf(self.words), vad_fn=self.vad_all)
        self.assertEqual(r['v'], A.V)
        for g in r['segments']:
            self.assertTrue({'s', 'e', 'text', 'src', 'nw', 'nz'} <= set(g))
            self.assertNotIn('zt', g)                                 # טקסט הביניים של zipformer לא בפלט
        self.assertIn('vad', r['timing'])


class TestReady(unittest.TestCase):
    def test_missing_models(self):
        old = (A.IVRIT_DIR, A.ZF_DIR)
        try:
            A.IVRIT_DIR, A.ZF_DIR = '/nonexistent/ivrit', '/nonexistent/zf'
            self.assertFalse(A.ivrit_ready())
            self.assertFalse(A.zf_ready())
        finally:
            A.IVRIT_DIR, A.ZF_DIR = old

    def test_no_engine_raises(self):
        with self.assertRaises(RuntimeError):
            A.transcribe(zeros(1), None, None, vad_fn=lambda a: [])


if __name__ == '__main__':
    unittest.main()
