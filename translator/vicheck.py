"""ניתוח סרטונים — הבדיקות בקוד והעיגון (גל 1, PR 1.2א; docs/studio-video-analysis-plan.md 4.1–4.2, ‏5.3, ‏19.1).

שני חלקים:
1. **`norm_vi`** — התאום ב־Python של `normVi` (ibkr-proxy/lib/studiovi.js = studiovi.js בטלפון): שדה לא מוכר נזרק,
   ערך מחוץ ל־enum נזרק, הפניה למזהה שלא קיים נזרקת. **זהה** על אותם fixtures (translator/tests/fixtures/vi_ok.json —
   יוצא כמו שנכנס; ‏vi_bad.json → vi_bad.norm.json). שינוי כאן = שינוי בשני קובצי ה־JS, ולהפך.
2. **הבדיקות של המיפוי** (V45, ‏V73, ‏V74, ‏V79) — על כל פריט שחזר מהמודל, לפני שהוא נכנס לתוצר:
   - `ev`: כל מזהה קיים ושייך לחלון (±`WIN_PAD`). מזהה זר נמחק (`ev_bad`). לא נשאר אף אחד — ‏`basis` יורד
     ל־`analyst_inference` ו־`conf` ל־low (`no_ev`).
   - `q`: תת־מחרוזת מדויקת (אחרי NFC ורווחים בלבד) של יחידת דיבור מתוך `ev`. לא — נמחק (`q_bad`).
   - מספרים: כל מספר בטקסט הפריט מופיע ביחידות הראיה של הפריט (או לפחות במלאי — `num_far`). לא מופיע בכלל —
     הפריט נמחק (`num_bad`): מספר מומצא הוא הטעות הכי מזיקה בסיכום.
   - הסתייגויות כלשונן: היחידה אומרת "אולי / probably" והפריט קובע בביטחון — ‏`conf` יורד ל־med (`hedge`).
   - **הזמן** (`anchor`): עם ציטוט — `s` של המילה הראשונה שלו ב־`wd` (בדיוק); בלי — `t0` של היחידה המוקדמת
     (שקף — `t0` של השקף). המודל אף פעם לא כותב זמן.
   - **הפנקס** (`ledger`): כל שקף וכל שורת "רק על המסך" — נוצלה בפריט, או נדחתה עם סיבה. ‏`used` שמצביע על פריט
     שנמחק ("תלוי באוויר") → ‏`drop: unverified` ו־`vi_ledger`.
"""

from __future__ import annotations

import math
import re
import unicodedata

VI_V = 'snb.video-analysis/1'
VI_LANGS = ('he', 'en')
VI_WARN = ('vi_noscreen', 'vi_lowres', 'vi_ocr', 'vi_asr_low', 'vi_partial', 'vi_unver', 'vi_ledger', 'ts_coarse')
VI_SEG = ('content', 'intro', 'qa', 'pitch', 'sponsor', 'self_promo', 'interaction_reminder', 'preview_recap', 'filler',
          'logistics', 'demo', 'exercise')
VI_SRC = ('speech', 'screen_only', 'both')
VI_BASIS = ('speaker', 'analyst_inference', 'external_knowledge')
VI_CONF = ('high', 'med', 'low')
VI_VER = ('sup', 'part', 'uns', 'con', 'unk')
VI_DROP = ('duplicate', 'decorative', 'agenda', 'title_only', 'sponsor', 'filler', 'budget', 'low_salience', 'unverified',
           'asr_noise')
VI_GENRES = ('academic_lecture', 'course_module', 'business_webinar', 'conference_talk', 'panel', 'interview_podcast',
             'software_tutorial', 'product_demo', 'workshop', 'investor_presentation', 'other')
VI_ASRQ = ('high', 'med', 'low')
VI_CAP = {'evidence': 20000, 'slides': 3000, 'ocr': 30000, 'segments': 2000, 'chapters': 400, 'items': 3000, 'ledger': 40000,
          'states': 40, 'refs': 24, 'take': 7, 'warn': 16, 'tpl': 20}
# PR 2.1 (V59): סעיפי התבנית לפי ז'אנר (visheet.TPL_SECS) — מזהי פריטים בלבד. **זהה ל־VI_TPL ב־studiovi.js (טלפון ושרתון)**
VI_TPL = ('learn', 'board', 'stress', 'exam', 'step', 'offer', 'price', 'check', 'free')
VI_TXT = {'text': 2000, 'q': 600, 'title': 300, 'sum': 3000, 'adds': 2000, 'vtitle': 300}
ID = {'e': re.compile(r'^e\d{1,6}$'), 's': re.compile(r'^s\d{1,5}$'), 'o': re.compile(r'^o\d{1,5}\.\d{1,4}$'),
      'c': re.compile(r'^c\d{1,4}$'), 'n': re.compile(r'^n\d{1,5}$')}
VI_KEYS = ('v', 'pv', 'lang', 'genre', 'video', 'evidence', 'slides', 'ocr', 'segments', 'chapters', 'items', 'briefing',
           'thesis', 'big', 'tpl', 'ledger', 'quality')
SPK_RE = re.compile(r'^S\d{1,2}$')
KIND_RE = re.compile(r'^[a-z][a-z_]{0,15}$')
LANG_RE = re.compile(r'^[a-z]{2,3}$')
VSRC_RE = re.compile(r'^[a-z]{1,8}$')
CTRL_RE = re.compile('[\u0000-\u0009\u000b-\u001f\u007f]')

WIN_PAD = 10.0        # 4.2 סעיף 1: מזהה שייך לחלון הפרק ±10 שנ׳


# ---------------------------------------------------------------- norm_vi (= normVi)

def _isnum(v) -> bool:
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def _isint(v) -> bool:
    """Number.isInteger: גם 5.0"""
    return _isnum(v) and float(v).is_integer()


def _fin(v, lo, hi) -> bool:
    return _isnum(v) and lo <= v <= hi


def _jround(x: float) -> float:
    """Math.round של JS (חצי — כלפי מעלה), לא העיגול הבנקאי של Python"""
    return math.floor(x + 0.5)


def _r3(v):
    return _num(_jround(v * 1000) / 1000)


def _num(x):
    return int(x) if float(x).is_integer() else x


def _txt(v, mx):
    return CTRL_RE.sub('', v)[:mx] if isinstance(v, str) else None


def _span(o):
    if _fin(o.get('t0'), 0, 86400) and _fin(o.get('t1'), 0, 86400) and o['t1'] >= o['t0']:
        return {'t0': _r3(o['t0']), 't1': _r3(o['t1'])}
    return None


def _list(a, cap):
    return a[:cap] if isinstance(a, list) else []


def _s(v) -> str:
    """String(v || '') — מספיק לבדיקת regex"""
    return v if isinstance(v, str) else ('' if not v else str(v))


def _ids(a, ok, cap=64):
    out = []
    for x in _list(a, cap):
        if isinstance(x, str) and ok(x) and x not in out:
            out.append(x)
    return out


def norm_vi(o):
    """vi.json → מה שהטלפון מציג (או None). **זהה ל־normVi** — הסדר, התקרות והעיגול."""
    if not isinstance(o, dict) or o.get('v') != VI_V:
        return None
    pv = o.get('pv')
    out = {'v': VI_V, 'pv': int(pv) if _isint(pv) and 1 <= pv <= 999 else 1}
    lg = o.get('lang') if isinstance(o.get('lang'), dict) else {}
    out['lang'] = {'src': lg.get('src') if lg.get('src') in VI_LANGS else 'en', 'out': 'he'}
    out['genre'] = o.get('genre') if o.get('genre') in VI_GENRES else 'other'
    vd = o.get('video') if isinstance(o.get('video'), dict) else {}
    out['video'] = {'dur': _r3(vd['dur']) if _fin(vd.get('dur'), 0, 86400) else 0}
    if VSRC_RE.match(_s(vd.get('src'))):
        out['video']['src'] = vd['src']
    if _txt(vd.get('title'), VI_TXT['vtitle']):
        out['video']['title'] = _txt(vd['title'], VI_TXT['vtitle'])
    out['evidence'] = []
    for e in _list(o.get('evidence'), VI_CAP['evidence']):
        if not isinstance(e, dict) or not ID['e'].match(_s(e.get('id'))):
            continue
        sp, t = _span(e), _txt(e.get('text'), VI_TXT['text'])
        if not sp or t is None:
            continue
        x = dict({'id': e['id']}, **sp)
        x['spk'] = e['spk'] if SPK_RE.match(_s(e.get('spk'))) else 'S1'
        x['text'] = t
        if _fin(e.get('conf'), 0, 1):
            x['conf'] = _r3(e['conf'])
        w0, w1 = e.get('w0'), e.get('w1')
        if _isint(w0) and _isint(w1) and w0 >= 0 and w1 >= w0:
            x['w0'], x['w1'] = int(w0), int(w1)
        out['evidence'].append(x)
    out['ocr'] = []
    for r in _list(o.get('ocr'), VI_CAP['ocr']):
        if not isinstance(r, dict) or not ID['o'].match(_s(r.get('id'))):
            continue
        t = _txt(r.get('text'), VI_TXT['text'])
        if t is None:
            continue
        x = {'id': r['id'], 'text': t, 'conf': int(_jround(r['conf'])) if _fin(r.get('conf'), 0, 100) else 0,
             'lang': r['lang'] if LANG_RE.match(_s(r.get('lang'))) else 'und'}
        if r.get('dir') in ('rtl', 'ltr'):
            x['dir'] = r['dir']
        out['ocr'].append(x)
    ocr_ids = {x['id'] for x in out['ocr']}
    out['slides'] = []
    for s in _list(o.get('slides'), VI_CAP['slides']):
        if not isinstance(s, dict) or not ID['s'].match(_s(s.get('id'))):
            continue
        sp = _span(s)
        if not sp:
            continue
        x = dict({'id': s['id']}, **sp)
        x['kind'] = s['kind'] if KIND_RE.match(_s(s.get('kind'))) else 'slide'
        st = [{'k': int(y['k']), 't0': _r3(y['t0'])} for y in _list(s.get('states'), VI_CAP['states'])
              if isinstance(y, dict) and _isint(y.get('k')) and 0 <= y['k'] < 1000 and _fin(y.get('t0'), 0, 86400)]
        if st:
            x['states'] = st
        im = s.get('img')
        if isinstance(im, dict) and all(_isint(im.get(k)) and 0 <= im[k] < 2 ** 40 for k in ('o', 'l', 'w', 'h')) and im['l'] > 0:
            x['img'] = {k: int(im[k]) for k in ('o', 'l', 'w', 'h')}
        oc = _ids(s.get('ocr'), lambda y: y in ocr_ids, 400)
        if oc:
            x['ocr'] = oc
        so = _ids(s.get('so'), lambda y: y in oc, 400)
        if so:
            x['so'] = so
        out['slides'].append(x)
    ev_ids = {x['id'] for x in out['evidence']} | {x['id'] for x in out['slides']} | ocr_ids
    out['segments'] = []
    for g in _list(o.get('segments'), VI_CAP['segments']):
        sp = _span(g) if isinstance(g, dict) else None
        if sp and g.get('type') in VI_SEG:
            out['segments'].append(dict(sp, type=g['type']))
    ch_raw = [c for c in _list(o.get('chapters'), VI_CAP['chapters'])
              if isinstance(c, dict) and ID['c'].match(_s(c.get('id'))) and _span(c) and _txt(c.get('title'), VI_TXT['title'])]
    ch_ids = {c['id'] for c in ch_raw}
    out['items'] = []
    for it in _list(o.get('items'), VI_CAP['items']):
        if not isinstance(it, dict) or not ID['n'].match(_s(it.get('id'))):
            continue
        t = _txt(it.get('text'), VI_TXT['text'])
        if not t:
            continue
        x = {'id': it['id'], 'kind': it['kind'] if KIND_RE.match(_s(it.get('kind'))) else 'note'}
        if isinstance(it.get('ch'), str) and it['ch'] in ch_ids:
            x['ch'] = it['ch']
        x['text'] = t
        x['ev'] = _ids(it.get('ev'), lambda y: y in ev_ids, 32)
        if _fin(it.get('t'), 0, 86400):                       # 10/11/2026 (PR 1.2א): זמן המילה של הציטוט (vicheck.anchor)
            x['t'] = _r3(it['t'])
        q = _txt(it.get('q'), VI_TXT['q'])
        if q:
            x['q'] = q
        x['src'] = it['src'] if it.get('src') in VI_SRC else 'speech'
        x['basis'] = it['basis'] if it.get('basis') in VI_BASIS else 'speaker'
        x['conf'] = it['conf'] if it.get('conf') in VI_CONF else 'med'
        x['ver'] = it['ver'] if it.get('ver') in VI_VER else 'unk'
        out['items'].append(x)
    it_ids = {x['id'] for x in out['items']}
    out['chapters'] = []
    for c in ch_raw:
        lvl = c.get('lvl')
        x = dict({'id': c['id']}, **_span(c))
        x['lvl'] = int(lvl) if _isint(lvl) and 1 <= lvl <= 3 else 1
        x['title'] = _txt(c['title'], VI_TXT['title'])
        for k in ('sum', 'adds'):
            t = _txt(c.get(k), VI_TXT[k])
            if t:
                x[k] = t
        x['items'] = _ids(c.get('items'), lambda y: y in it_ids, 400)
        out['chapters'].append(x)

    def one(v):
        return v if isinstance(v, str) and v in it_ids else None

    bf = o.get('briefing') if isinstance(o.get('briefing'), dict) else {}
    out['briefing'] = {}
    if one(bf.get('one')):
        out['briefing']['one'] = bf['one']
    if one(bf.get('bluf')):
        out['briefing']['bluf'] = bf['bluf']
    out['briefing']['take'] = _ids(bf.get('take'), lambda y: y in it_ids, VI_CAP['take'])
    if one(o.get('thesis')):
        out['thesis'] = o['thesis']
    if one(o.get('big')):
        out['big'] = o['big']
    tp = o.get('tpl') if isinstance(o.get('tpl'), dict) else {}
    tpl = {k: _ids(tp.get(k), lambda y: y in it_ids, VI_CAP['tpl']) for k in VI_TPL}
    tpl = {k: v for k, v in tpl.items() if v}
    if tpl:
        out['tpl'] = tpl
    out['ledger'] = []
    for l in _list(o.get('ledger'), VI_CAP['ledger']):
        if not isinstance(l, dict) or l.get('ref') not in ev_ids:
            continue
        if one(l.get('used')):
            out['ledger'].append({'ref': l['ref'], 'used': l['used']})
        elif l.get('drop') in VI_DROP:
            out['ledger'].append({'ref': l['ref'], 'drop': l['drop']})
    q = o.get('quality') if isinstance(o.get('quality'), dict) else {}

    def inte(v):
        return int(v) if _isint(v) and 0 <= v <= 1e5 else 0

    warn = []
    for c in _list(q.get('warn'), VI_CAP['warn']):
        if c in VI_WARN and c not in warn:
            warn.append(c)
    out['quality'] = {'items': inte(q.get('items')), 'sup': inte(q.get('sup')),
                      'cov': _r3(q['cov']) if _fin(q.get('cov'), 0, 1) else 0,
                      'asr': q['asr'] if q.get('asr') in VI_ASRQ else 'med', 'warn': warn}
    return {k: out[k] for k in VI_KEYS if k in out}


# ---------------------------------------------------------------- טקסט והשוואה

def norm_ws(t: str) -> str:
    """4.2 סעיף 2: רק NFC ורווחים — בלי אותיות קטנות, בלי פיסוק"""
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(t or ''))).strip()


NUM_RE = re.compile(r'(?<![\d.])\d+(?:[.,]\d+)*')   # גם "ב30" (אות שימוש צמודה)
HEDGE_RE = re.compile(r'\b(?:maybe|might|perhaps|probably|possibly|likely|unlikely|seems?|suggests?|could|may|'
                      r'i think|we think|i believe|we believe|not sure|roughly|approximately|about(?=\s+\d))\b|'
                      r'(?:אולי|כנראה|ייתכן|יתכן|נראה ש|נראה כי|אני חושב|אנחנו חושבים|לדעתי|לדעתם|לדעתו|בערך|כמעט|סביר|משער)', re.I)


def nums(text: str) -> set:
    """מספרים מנורמלים: 1,200 = 1200; ‏3.50 = 3.5; ‏0.3 = .3 לא. מספר בספרה אחת (בלי נקודה) — לא נבדק (מנייה רגילה)."""
    out = set()
    for m in NUM_RE.finditer(str(text or '')):
        v = m.group(0)
        parts = [v.replace(',', '')] if re.fullmatch(r'\d{1,3}(?:,\d{3})+(?:\.\d+)?', v) else v.split(',')   # 1,200 / ‏1,2,3
        for p in parts:
            if not p or (len(p) < 2 and '.' not in p):
                continue
            try:
                f = float(p)
            except ValueError:
                continue
            out.add(('%.6f' % f).rstrip('0').rstrip('.'))
    return out


# ---------------------------------------------------------------- האינדקס והעיגון

class Index:
    """המזהים של העבודה: יחידות דיבור, שקפים ושורות OCR (מזהה → שקף)."""

    def __init__(self, ev: list[dict], slides: list[dict], ocr: list[dict], words: list[dict] | None = None):
        self.ev = {u['id']: u for u in ev}
        self.sl = {s['id']: s for s in slides}
        self.oc = {o['id']: o for o in ocr}
        self.oc_sl = {oid: s for s in slides for oid in s.get('ocr') or []}
        self.so = {oid for s in slides for oid in s.get('so') or []}
        self.words = words or []

    def t0(self, rid: str):
        if rid in self.ev:
            return float(self.ev[rid]['t0'])
        s = self.sl.get(rid) or self.oc_sl.get(rid)
        return float(s['t0']) if s else None

    def text(self, rid: str) -> str:
        if rid in self.ev:
            return self.ev[rid]['text']
        if rid in self.oc:
            return self.oc[rid]['text']
        s = self.sl.get(rid)
        return ' '.join(self.oc[o]['text'] for o in (s or {}).get('ocr') or [] if o in self.oc)

    def slide_of(self, rid: str):
        return self.sl.get(rid) or self.oc_sl.get(rid)

    def known(self, rid) -> bool:
        return isinstance(rid, str) and (rid in self.ev or rid in self.sl or rid in self.oc)


def quote_word(u: dict, q: str, words: list[dict]) -> int | None:
    """המילה הראשונה של הציטוט q ביחידה u → האינדקס שלה ב־wd (u.w0..u.w1). None = לא נמצא / אין מילים.
    הטקסט של היחידה = המילים מחוברות ברווח (analyze.evidence); בונים מחדש את המיפוי תו → מילה."""
    qn = norm_ws(q)
    if not qn or 'w0' not in u or not words:
        return None
    pos, offs, parts = 0, [], []
    for i in range(int(u['w0']), min(int(u['w1']), len(words) - 1) + 1):
        w = norm_ws(words[i].get('w'))
        if not w:
            continue
        if parts:
            pos += 1
        offs.append((pos, pos + len(w), i))
        parts.append(w)
        pos += len(w)
    joined = ' '.join(parts)
    at = joined.find(qn)
    if at < 0:
        return None
    for a, b, i in offs:
        if a <= at < b or at < a:
            return i
    return None


def anchor(it: dict, ix: Index) -> float | None:
    """4.2: הזמן של פריט. ציטוט ביחידת הדיבור הראשונה — ‏`s` של המילה הראשונה שלו ב־wd, בדיוק. אחרת — ה־t0 המוקדם
    מבין יחידות הראיה (שקף / שורת OCR — ה־t0 של השקף)."""
    ev = it.get('ev') or []
    if it.get('q') and ev and ev[0] in ix.ev:
        i = quote_word(ix.ev[ev[0]], it['q'], ix.words)
        if i is not None:
            return round(float(ix.words[i]['s']), 3)
    ts = [t for t in (ix.t0(r) for r in ev) if t is not None]
    return round(min(ts), 3) if ts else None


# ---------------------------------------------------------------- בדיקת פריט

def check_item(it: dict, ix: Index, span: tuple[float, float], inv_nums: set) -> tuple[dict | None, list[str]]:
    """פריט אחד מהמיפוי → (הפריט אחרי הבדיקות, או None אם נמחק; קודי הבעיות). לא משנה את הקלט."""
    x = dict(it)
    issues: list[str] = []
    lo, hi = span[0] - WIN_PAD, span[1] + WIN_PAD
    raw = [r for r in (it.get('ev') or []) if isinstance(r, str)]
    ok = []
    for r in raw:
        t = ix.t0(r) if ix.known(r) else None
        if t is None or not (lo <= t <= hi):
            issues.append('ev_bad')
            continue
        if r not in ok:
            ok.append(r)
    x['ev'] = ok[:32]
    if not ok:
        issues.append('no_ev')
        if x.get('basis', 'speaker') == 'speaker':
            x['basis'] = 'analyst_inference'
        x['conf'] = 'low'
    # הציטוט: תת־מחרוזת של יחידת דיבור מ־ev — היחידה שמכילה אותו עוברת לראש (העיגון לפיה)
    q = norm_ws(it.get('q'))
    if q:
        hit = next((r for r in ok if r in ix.ev and q in norm_ws(ix.ev[r]['text'])), None)
        if hit is None:
            issues.append('q_bad')
            x.pop('q', None)
        else:
            x['q'] = q
            x['ev'] = [hit] + [r for r in ok if r != hit]
    else:
        x.pop('q', None)
    # V45: מספרים — ביחידות של הפריט; אחרת במלאי (מרוחק); אחרת — מומצא
    tn = nums(it.get('text'))
    if tn:
        near = set()
        for r in x['ev']:
            near |= nums(ix.text(r))
        for n in sorted(tn - near):
            if n in inv_nums:
                issues.append('num_far')
            else:
                issues.append('num_bad')
                return None, issues
    # הסתייגויות כלשונן: היחידה מסתייגת והפריט קובע בביטחון גבוה
    src_text = ' '.join(ix.text(r) for r in x['ev'] if r in ix.ev)
    if src_text and HEDGE_RE.search(src_text) and not HEDGE_RE.search(str(it.get('text') or '')) and x.get('conf') == 'high':
        issues.append('hedge')
        x['conf'] = 'med'
    # תווית המקור (V42): בלי יחידת דיבור — רק מסך; בלי מסך — רק דיבור
    has_sp = any(r in ix.ev for r in x['ev'])
    has_sc = any(r in ix.sl or r in ix.oc for r in x['ev'])
    if x['ev']:
        x['src'] = 'both' if has_sp and has_sc else 'screen_only' if has_sc else 'speech'
    t = anchor(x, ix)
    if t is not None:
        x['t'] = t
    return x, issues


BAD = ('no_ev', 'q_bad', 'num_bad', 'ev_bad')


def bad_rate(results: list[tuple[dict | None, list[str]]]) -> float:
    """5.8: חלק הפריטים שנפסלו או תוקנו בגלל ראיה (מחיקה / מזהה זר / ציטוט / מספר) — מעל 0.3 ממפים שוב."""
    if not results:
        return 0.0
    return sum(1 for x, iss in results if x is None or any(i in BAD for i in iss)) / len(results)


def feedback(results: list[tuple[dict | None, list[str]]], raw: list[dict]) -> str:
    """המשוב למיפוי החוזר (5.8): "לא נמצאה ראיה ל: …" — הפריטים הבעייתיים, בקצרה."""
    lines = []
    for (x, iss), it in zip(results, raw):
        bad = [i for i in iss if i in BAD]
        if x is None or bad:
            lines.append('- "%s": %s' % (str(it.get('text') or '')[:80], ', '.join(sorted(set(bad))) or 'removed'))
    head = ('Problems: ev_bad = an id that is not in this window; no_ev = no supporting id; q_bad = the quote is not an exact '
            'substring of the first speech unit; num_bad = a number that does not appear in the units.')
    return head + '\n' + '\n'.join(lines[:12])


# ---------------------------------------------------------------- הפנקס (V79)

def ledger(slides: list[dict], items: list[dict], drops: dict) -> tuple[list[dict], int, int]:
    """כל שקף וכל שורת "רק על המסך" (V23) — ‏used (הפריט הראשון שמפנה אליו או לשורה שלו) או drop עם סיבה.
    drops = {ref: why} מהמודל. מה שלא נוצל ולא נדחה — ‏low_salience (ונספר כ"פספוס"). מחזיר (הפנקס, פספוסים, שימושים)."""
    first: dict[str, str] = {}
    for it in items:
        for r in it.get('ev') or []:
            first.setdefault(r, it['id'])
    out, miss, used = [], 0, 0
    for s in slides:
        refs = [s['id']] + [o for o in s.get('so') or []]
        for ref in refs:
            u = first.get(ref) or (first.get(s['id']) if ref != s['id'] else None)
            if ref == s['id'] and not u:
                u = next((first[o] for o in s.get('ocr') or [] if o in first), None)
            if u:
                out.append({'ref': ref, 'used': u})
                used += 1
            elif ref in drops:
                out.append({'ref': ref, 'drop': drops[ref]})
            else:
                out.append({'ref': ref, 'drop': 'low_salience'})
                miss += 1
    return out, miss, used


def dangling(led: list[dict], item_ids: set) -> int:
    """V79: ‏used שמצביע על פריט שלא קיים (נמחק אחרי הבדיקות) → ‏drop: unverified. מחזיר כמה תוקנו."""
    n = 0
    for l in led:
        if 'used' in l and l['used'] not in item_ids:
            l.pop('used')
            l['drop'] = 'unverified'
            n += 1
    return n


# ---------------------------------------------------------------- הסינתזה והאימות (PR 1.2ב)
SYN_EV_MAX = 12                      # ראיות לפריט סינתזה — של ההערות שהוא נשען עליהן, לפי הסדר
_CONF_RANK = {'high': 2, 'med': 1, 'low': 0}


def synth_item(st: dict | None, kind: str, by_id: dict, ix: Index, inv_nums: set) -> tuple[dict | None, list[str]]:
    """משפט סינתזה {text, from} → פריט (kind = one/bluf/take/thesis/big), או None. לא משנה את הקלט.
    - from: רק הערות קיימות (from_bad); בלי אף אחת — "הוסק", ביטחון נמוך, בלי ראיות (no_from).
    - ev: הראיות של ההערות, בלי כפילות, עד SYN_EV_MAX. ‏t — הראיה המוקדמת.
    - מספר שלא בהערות ולא בראיות שלהן — num_bad (נמחק); רק במלאי — num_far.
    - basis: ‏big תמיד "הוסק"; אחרת "speaker" רק אם כל ההערות הן של הדובר. ‏conf = הנמוך מבין ההערות (בהסקה — עד med).
    - הסתייגות בהערות שנעלמה — hedge (high → med)."""
    issues: list[str] = []
    if not st or not str(st.get('text') or '').strip():
        return None, ['empty']
    src = [by_id[i] for i in dict.fromkeys(st.get('from') or []) if i in by_id]
    if len(src) < len(st.get('from') or []):
        issues.append('from_bad')
    ev: list[str] = []
    for n in src:
        for r in n.get('ev') or []:
            if r not in ev:
                ev.append(r)
    x = {'kind': kind, 'text': str(st['text']).strip(), 'ev': ev[:SYN_EV_MAX]}
    if not src:
        issues.append('no_from')
        x.update(basis='analyst_inference', conf='low')
    else:
        sp = kind != 'big' and all(n.get('basis') == 'speaker' for n in src)
        x['basis'] = 'speaker' if sp else 'analyst_inference'
        lo = min(_CONF_RANK.get(n.get('conf'), 1) for n in src)
        if not sp:
            lo = min(lo, 1)
        x['conf'] = next(k for k, v in _CONF_RANK.items() if v == lo)
    tn = nums(x['text'])
    if tn:
        near = set()
        for n in src:
            near |= nums(n.get('text'))
        for r in x['ev']:
            near |= nums(ix.text(r))
        for n in sorted(tn - near):
            if n in inv_nums:
                issues.append('num_far')
            else:
                issues.append('num_bad')
                return None, issues
    base = ' '.join(str(n.get('text') or '') for n in src)
    if base and HEDGE_RE.search(base) and not HEDGE_RE.search(x['text']) and x['conf'] == 'high':
        issues.append('hedge')
        x['conf'] = 'med'
    has_sp = any(r in ix.ev for r in x['ev'])
    has_sc = any(r in ix.sl or r in ix.oc for r in x['ev'])
    x['src'] = 'both' if has_sp and has_sc else 'screen_only' if has_sc else 'speech'
    t = anchor(x, ix)
    if t is not None:
        x['t'] = t
    return x, issues


VV_DROP = ('con',)                    # סותרת את הראיה — נמחקת (V78)


def apply_verdict(it: dict, verdict: str | None, cited: set, has_cites: bool) -> tuple[dict | None, list[str]]:
    """פסק האימות על פריט → (הפריט, או None אם נמחק; קודים). לא משנה את הקלט.
    - con → נמחק. ‏uns → "הוסק" בביטחון נמוך (V78: לא מוצג כדברי הדובר).
    - sup בלי ציטוט מתוך ה־ev של הפריט (כשהמנוע מחזיר Citations) → part: המצביע השני לא מאשר (5.3 סעיף 3).
    - בלי פסק (חסר בתשובה) → unk."""
    x = dict(it)
    iss: list[str] = []
    if verdict not in ('sup', 'part', 'uns', 'con'):
        x['ver'] = 'unk'
        return x, ['vv_none']
    if verdict in VV_DROP:
        return None, ['vv_con']
    if verdict == 'sup' and has_cites and x.get('ev') and not (cited & set(x['ev'])):
        verdict = 'part'
        iss.append('cite_off')
    if verdict == 'uns':
        iss.append('vv_uns')
        if x.get('basis') == 'speaker':
            x['basis'] = 'analyst_inference'
        x['conf'] = 'low'
    if verdict == 'part' and x.get('conf') == 'high':
        x['conf'] = 'med'
    x['ver'] = verdict
    return x, iss
