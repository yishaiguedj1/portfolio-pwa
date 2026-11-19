#!/usr/bin/env python3
"""בדיקת העומק של מכפיל באפט — גל 2: טקסט קריא של כל הודעה לעיתונות, לקוראים הבלתי תלויים (docs/buffett-pe-audit.md).

נכתב בנפרד מ־secsbc.text (שפה אחרת, ומבנה אחר): הטבלאות נשמרות — כל שורה בשורה משלה, התאים מופרדים ב־" | " — כדי שהקורא
יראה לאיזו שורת יעד (רווח למניה / EBITDA / תפעולי) שורת התגמול מתאימה. שני פלטים לכל הודעה:
- <BD_DIR>/prt/<CIK>/<acc>.txt — הטקסט המלא (כל הנספחים שנשמרו, לפי הסדר).
- <BD_DIR>/prs/<CIK>/<acc>.txt — הקטעים לקורא: הכותרת, כל משפט/שורה עם "non-GAAP"/"adjusted" + "exclud"/"per share",
  כל שורת התאמה / רווח / מניות עם הקשר, וכל הופעה של תגמול במניות עם הקשר רחב (25 שורות אחרי, 8 לפני), ממוזגים בלי כפילויות. מכוון ל־recall: מה שלא נכנס כאן
  לא יכול להכריע את השאלה. כשהטקסט המלא קצר מ־100 אלף תווים (כמעט כל ההודעות; לקח הפיילוט, 19/11: בקטעים חסרה טבלת ההתאמה שבה התגמול *לא* מופיע) — הקטעים = הטקסט המלא.
שימוש: BD_DIR=<dir> python3 tools/buffett-deep/prtext.py [--cik 1090872]
"""
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

BD = os.environ.get('BD_DIR', '.')
CACHE = os.environ.get('BD_CACHE', os.path.join(BD, 'cache'))
BLOCK = {'p', 'div', 'br', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'title'}
CELL = {'td', 'th'}


class Txt(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.lines, self.cur, self.cells, self.skip, self.pre = [], [], None, 0, ''

    def flush(self):
        s = re.sub(r'\s+', ' ', ''.join(self.cur)).strip()
        if s:
            self.lines.append(s)
        self.cur = []

    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style'):
            self.skip += 1
        elif tag == 'tr':
            self.flush()
            self.cells = []
        elif tag in CELL and self.cells is not None:
            self.cur = []
        elif tag in BLOCK:
            if self.cells is None:
                self.flush()

    def handle_endtag(self, tag):
        if tag in ('script', 'style'):
            self.skip = max(0, self.skip - 1)
        elif tag in CELL and self.cells is not None:
            s = re.sub(r'\s+', ' ', ''.join(self.cur)).strip()
            if s in ('(', '$(', '($'):          # סוגר פותח בתא נפרד — מצטרף למספר שאחריו
                self.pre = '('
            elif s and s not in ('$', ')', '%'):
                self.cells.append(self.pre + s)
                self.pre = ''
            elif s in (')', '%') and self.cells:
                self.cells[-1] += s
            self.cur = []
        elif tag == 'tr' and self.cells is not None:
            if self.cells:
                self.lines.append(' | '.join(self.cells))
            self.cells = None
            self.cur = []
        elif tag in BLOCK and self.cells is None:
            self.flush()

    def handle_data(self, data):
        if not self.skip:
            self.cur.append(data)


def to_lines(raw):
    if '<' not in raw[:5000]:
        return [re.sub(r'\s+', ' ', x).strip() for x in raw.split('\n') if x.strip()]
    p = Txt()
    try:
        p.feed(raw)
        p.close()
    except Exception:
        pass
    p.flush()
    return p.lines


SBC = re.compile(r'(stock|share|equity)[- ]?based|stock compensation|share-based payment|equity compensation|stock[- ]settled', re.I)
NG = re.compile(r'non-?gaap|adjusted|core earnings|cash eps|excluding|exclud', re.I)
PS = re.compile(r'per (diluted )?share|\beps\b|net income|earnings', re.I)
REC = re.compile(r'reconcil|specified items|special items|non-?gaap|as adjusted|tax (effect|impact)|weighted[- ]average|diluted', re.I)
CHG = re.compile(r'no longer|will (now )?(include|exclude)|beginning (with|in)|going forward|change[sd]? (in|to) (our|its) non-?gaap', re.I)


def snippets(lines):
    keep = set(range(min(40, len(lines))))   # הכותרת והפתיחה
    for i, s in enumerate(lines):
        if SBC.search(s):
            keep.update(range(max(0, i - 8), min(len(lines), i + 26)))
        elif NG.search(s) or REC.search(s) or PS.search(s):
            # שורות ההתאמה והרווח — גם בלי תגמול (כדי שהקורא יראה שהוא *לא* ברשימה), עם הקשר
            keep.update(range(max(0, i - 3), min(len(lines), i + 4)))
        elif CHG.search(s) and NG.search(s):
            keep.update(range(max(0, i - 2), min(len(lines), i + 3)))
    out, prev = [], -2
    for i in sorted(keep):
        if i != prev + 1:
            out.append('[…]')
        out.append(lines[i])
        prev = i
    return out


def path_of(url):
    u = url.split('://', 1)[1]
    host, p = u.split('/', 1)
    return os.path.join(CACHE, host, p)


def main():
    only = sys.argv[sys.argv.index('--cik') + 1] if '--cik' in sys.argv else None
    prd = os.path.join(BD, 'pr')
    n = 0
    for fn in sorted(os.listdir(prd)):
        if only and fn != str(int(only)) + '.json':
            continue
        m = json.load(open(os.path.join(prd, fn)))
        cik = str(int(m['cik']))
        for it in m['items']:
            if not it.get('got'):
                continue
            acc = it['acc'].replace('-', '')
            base = 'https://www.sec.gov/Archives/edgar/data/%s/%s/' % (cik, acc)
            full = ['# %s · %s · %s %s · items %s' % (m['sym'], it['filed'], it['form'], it['acc'], it['items'])]
            for nm in it['got']:
                f = path_of(base + nm)
                if not os.path.exists(f):
                    continue
                raw = open(f, encoding='utf-8', errors='replace').read()
                full.append('=== %s ===' % nm)
                full.extend(to_lines(raw))
            for d, lines in (('prt', full), ('prs', full if sum(map(len, full)) < 100000 else full[:1] + snippets(full[1:]))):
                od = os.path.join(BD, d, cik)
                os.makedirs(od, exist_ok=True)
                with open(os.path.join(od, it['acc'] + '.txt'), 'w') as fo:
                    fo.write('\n'.join(lines) + '\n')
            n += 1
    print('הודעות:', n)


if __name__ == '__main__':
    main()
