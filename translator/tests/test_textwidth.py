"""25/10/2026 (שלב 3 של "תרגום בטלפון"): מדידת רוחב בלי PIL — vt/textwidth.py מתוך fonts/metrics.json.

הטבלה = מה ש־PIL מחזיר בתמונת העובד (Pillow 12.3.0, פריסה בסיסית — בלי fribidi). נבדק גם מול התמונה עצמה
(4,000 שורות, 25/10/2026). כאן: הטבלה מעודכנת לגופנים, זהה ל־PIL הבסיסי באותה גרסה, ו־Measurer עובד בלי PIL."""
import hashlib
import json
import random
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from vt import textwidth as TW  # noqa: E402

FONTS = ROOT / 'fonts'
HE = 'שלום עולם אנחנו בונים מוצרים מצוינים והלקוחות אוהבים אותם כי האיכות חשובה לנו מנכ"ל שָׁלוֹם ממממ'.split()
EN = "Apple Google AVATAR WWDC Wa. fi office GPT-4 Mr. O'Neil café naïve".split()
PUNCT = [',', '.', '?', '!', ':', '-', '–', '—', '"', "'", '…', '(', ')', '%', '$', '₪', '/', '“', '”', '€', '½']


def corpus(n, seed=11):
    r = random.Random(seed)
    out = []
    for _ in range(n):
        parts = []
        for _ in range(r.randint(1, 9)):
            w = r.choice(HE) if r.random() < 0.65 else r.choice(EN)
            if r.random() < 0.3:
                w += r.choice(PUNCT)
            parts.append(w)
        out.append((' '.join(parts), r.choice(sorted(TW.table()['fonts'])), r.randint(8, 320)))
    return out


def pil_basic():
    try:
        from PIL import Image, ImageFont
    except ImportError:
        return None
    if Image.__version__ != TW.table().get('pillow'):
        return None                       # FreeType אחר = hinting אחר; הטבלה נבדקת רק מול הגרסה של התמונה
    return ImageFont


class Table(unittest.TestCase):
    def test_fonts_match(self):
        t = TW.table()
        for fn, d in t['fonts'].items():
            self.assertEqual(hashlib.sha256((FONTS / fn).read_bytes()).hexdigest(), d['sha256'],
                             'הגופן השתנה — python3 tools/fontmetrics.py')

    def test_styles_covered(self):
        from vt import config as C
        names = {s.font_file for s in C.STYLES.values()} if hasattr(C, 'STYLES') else set()
        for fn in names:
            self.assertIn(fn, TW.table()['fonts'], 'גופן של סגנון בלי טבלה: ' + fn)

    def test_same_as_pil_basic(self):
        IF = pil_basic()
        if IF is None:
            self.skipTest('אין Pillow בגרסה של תמונת העובד')
        cache = {}
        bad = []
        for s, fn, size in corpus(1500):
            k = (fn, size)
            if k not in cache:
                cache[k] = IF.truetype(str(FONTS / fn), size, layout_engine=IF.Layout.BASIC)
            a, b = cache[k].getlength(s), TW.font(fn, size).getlength(s)
            if a != b:
                bad.append((s, fn, size, a, b))
        self.assertEqual(bad[:5], [])

    def test_known_values(self):
        # נמדד בתמונת העובד (ghcr.io/yishaiguedj1/snb-worker:prod, ‏25/10/2026)
        self.assertEqual(TW.font('Arimo-Bold.ttf', 48).getlength('AV To'), 140.0)
        self.assertEqual(TW.font('Arimo-Bold.ttf', 48).getlength('שלום עולם'), 234.0)


class NoPil(unittest.TestCase):
    def test_measurer_without_pil(self):
        """בפייתון בלי ספריות (כמו בטלפון): Measurer לא נופל, ונותן את אותו רוחב כמו עם PIL."""
        code = ('import sys, json; sys.path.insert(0, %r)\n'
                'from vt.hebrew import Measurer\n'
                'from vt import config as C\n'
                'm = Measurer(C.FONTS_DIR / "Arimo-Bold.ttf", 48.7, 1.0, 2.5)\n'
                'print(json.dumps([m.width(x) for x in %r]))\n') % (str(ROOT), ['שלום עולם, זה Apple!', 'א', ''])
        r = subprocess.run([sys.executable, '-I', '-S', '-c', code], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        got = json.loads(r.stdout)
        self.assertGreater(got[0], 100)
        self.assertEqual(got[2], 0.0)
        if pil_basic() is not None:
            try:
                from fontTools.ttLib import TTFont  # noqa: F401
            except ImportError:
                return
            from vt.hebrew import Measurer
            from vt import config as C
            m = Measurer(C.FONTS_DIR / 'Arimo-Bold.ttf', 48.7, 1.0, 2.5)
            if m.font.layout_engine == pil_basic().Layout.BASIC:
                self.assertEqual(got, [m.width(x) for x in ['שלום עולם, זה Apple!', 'א', '']])

    def test_no_heavy_imports(self):
        """המודול עצמו — ספרייה סטנדרטית בלבד."""
        src = (ROOT / 'vt' / 'textwidth.py').read_text(encoding='utf-8')
        for bad in ('import PIL', 'from PIL', 'import fontTools', 'from fontTools', 'numpy'):
            self.assertNotIn(bad, src)


if __name__ == '__main__':
    unittest.main()
