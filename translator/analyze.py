"""ניתוח סרטונים — המתזמר (גל 0, PR 0.2: שלד והרצה יבשה; docs/studio-video-analysis-plan.md 3.1–3.3, 4.1, 10, 16.2).

job.py auto מפנה לכאן עבודה עם spec.vi. במצב dry (היחיד בגל 0) אין קריאה ל־Claude. סדר השלבים:

| שלב | מה קורה |
|---|---|
| up | קליטה (קישור / קובץ), בדיקת אורך ושפה |
| tr | שמע 16kHz → תמלול (פקודת vt ‏vi-asr) |
| al | מסך: שקפים, OCR, חבילת WebP (‏vi-screen) · זמן לכל מילה ודוברים (‏vi-align) · יחידות ראיה (‏e/s/o), מלאים, "רק על המסך" ומועמדי גבול — כאן, בלי מודל |
| rv | מה שהמיפוי היה שולח, נספר ב־count_tokens (חינם) — בלי לשלוח |
| bn | ‏vi.json, ‏vis, ‏cues (התמליל), ‏small (‏480p), ‏thumb |
| sv | העלאה (‏VI_FILES דרך put_output) |

כל שלב נרשם ב־snb-timing.json: שורה לכל פקודת vt (זמן, שיא MB, מעבד — job.vt), ושורת סיכום לכל שלב (`vi_<שלב>`).
משם הנתונים מגיעים ל־devPull, יחד עם שורת VI_DRY בסוף היומן (דגלי המעבד, הטוקנים, המספרים).
בלי שום טקסט של המשתמש — רק מספרים.

חלק הבנייה (יחידות, מלאים, vi.json) הוא פונקציות טהורות. הבדיקות (tests/test_analyze.py) מריצות אותן על נתונים
סינתטיים, ואת vi_run כולו על סרטון ש־ffmpeg מייצר, עם פקודות vt מדומות.
"""

from __future__ import annotations

import json
import os
import re
import resource
import subprocess
import time
import unicodedata
from pathlib import Path

VI_V = 'snb.video-analysis/1'
VI_LANGS = ('he', 'en')
VI_MAX_S = int(os.environ.get('VI_MAX_S') or 5400)                   # ב־MVP — 90 דק׳ (ה־0.4 מכייל)
VI_WIN_TOK = int(os.environ.get('VI_WIN_TOK') or 12000)              # גודל חלון המיפוי (טוקנים, באומדן)
# קודי השגיאה והאזהרה (נספח 19.3) — = VI_ERR ב־ibkr-proxy/lib/studiovi.js = STRINGS (tests/studio-vi.test.js)
VI_FAIL = ('vi_off', 'vi_lang', 'vi_long', 'vi_card', 'vi_schema', 'cap')
VI_WARN = ('vi_noscreen', 'vi_lowres', 'vi_ocr', 'vi_asr_low', 'vi_partial', 'vi_unver', 'vi_ledger', 'ts_coarse')
VI_ERR = VI_FAIL + VI_WARN
# השיא הצפוי [MB קבוע, MB לדקת סרטון] = MEM_PRIOR['vi'] ב־agent.py (tests/test_analyze.py) — לשומר הזיכרון של ה־OCR
MEM_VI = (4600, 22)
MEM_MARGIN = 1.1
# התוצרים: (סוג, קובץ בתיקיית העבודה, סיומת לשם, mime). = OUT_KINDS בשרתון (vi, vis חדשים); עד OUT_MAX (12)
VI_FILES = (
    ('vi', 'vi.json', ' (ניתוח).json', 'application/json'),
    ('vis', 'screen/vis.bin', ' (שקפים).bin', 'application/octet-stream'),
    ('cues', 'cues.json', '.cues.json', 'application/json'),
    ('small', 'small.mp4', ' (צפייה).mp4', 'video/mp4'),
    ('thumb', 'screen/thumb.jpg', ' (תמונה).jpg', 'image/jpeg'),
)
UNIT_MAX_S = 25.0               # יחידת דיבור — משפט, עד כ־25 שנ׳ (4.1)
UNIT_MIN_S = 3.0                # לא סוגרים משפט קצר מזה בגלל פיסוק
PAUSE_S = 1.0                   # שקט שסוגר יחידה
BOUND_PAUSE = 2.5               # שקט שהוא מועמד לגבול פרק
BOUND_MERGE = 5.0               # מועמדים קרובים — אחד
SO_WIN = 30.0                   # "רק על המסך": מחפשים את המילים בדיבור ±30 שנ׳ סביב השקף
SO_MIN_CONF, SO_MIN_WORDS = 60, 3
SO_HIT = 0.3                    # פחות מ־30% מהמילים התוכניות נאמרו — השורה "רק על המסך"
CUE_MAX_S, CUE_MAX_CH = 7.0, 84
IMG_TOK_DIV = 750               # טוקני תמונה ≈ רוחב × גובה ÷ 750 (התיעוד של Anthropic)
CPU_FLAGS = ('sse4_2', 'avx', 'avx2', 'fma', 'f16c', 'avx_vnni', 'avx512f', 'avx512bw', 'avx512vl', 'avx512_vnni',
             'avx512_bf16', 'amx_tile', 'amx_int8', 'amx_bf16')
HEB = re.compile(r'[֐-׿]')
NIQQUD = re.compile(r'[֑-ׇ]')
TOKEN_RE = re.compile(r"[\w֐-׿][\w֐-׿'’.\-]*", re.UNICODE)
SENT_END = re.compile(r'[.?!…]["\'”’)\]]*$')
HE_PREFIX = 'והבלמשכ'
STOP = frozenset('the a an of to in and or is are was were be it this that for on with as at by from we you i'
                 ' של את על עם זה זו לא כן הוא היא הם אני אנחנו גם או כי אם יש אין מה'.split())


def mem_need(dur_s: float) -> int:
    """ההזמנה של העבודה (MB) — אותו חישוב של mem_need בסוכן, לפני הלמידה. לשומר הזיכרון בשלב המסך."""
    a, b = MEM_VI
    return int(round((a + b * max(0.0, dur_s or 0) / 60) * MEM_MARGIN))


# ---------------------------------------------------------------- טקסט

def norm(t: str) -> str:
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFC', str(t or ''))).strip()


def tokens(t: str) -> list[str]:
    """מילים תוכניות להשוואה בין המסך לדיבור: אותיות קטנות, בלי ניקוד וסימנים, בלי מילות קישור."""
    out = []
    for m in TOKEN_RE.finditer(NIQQUD.sub('', unicodedata.normalize('NFC', t or '')).lower()):
        w = m.group(0).strip(".'’-")
        if len(w) >= 2 and w not in STOP:
            out.append(w)
    return out


def variants(w: str) -> set:
    """מילה עברית עם אות שימוש בהתחלה (ו, ה, ב, ל, מ, ש, כ) — גם בלעדיה."""
    out = {w}
    if HEB.match(w) and len(w) >= 4 and w[0] in HE_PREFIX:
        out.add(w[1:])
    return out


def fmt_t(t: float) -> str:
    t = max(0, int(t))
    return f'{t // 3600}:{t // 60 % 60:02d}:{t % 60:02d}' if t >= 3600 else f'{t // 60}:{t % 60:02d}'


# ---------------------------------------------------------------- יחידות ראיה (4.1)

def evidence(words: list[dict]) -> list[dict]:
    """מילים עם זמן → יחידות דיבור e<n>: נסגרות בסוף משפט (אחרי UNIT_MIN_S), בשקט של PAUSE_S, בהחלפת דובר, או
    כשהיחידה מגיעה ל־UNIT_MAX_S. ‏w0/w1 = טווח המילים ב־wd (כולל)."""
    out: list[dict] = []
    cur: list[int] = []

    def close():
        if not cur:
            return
        ws = [words[i] for i in cur]
        u = {'id': 'e%d' % (len(out) + 1), 't0': round(float(ws[0]['s']), 2), 't1': round(float(ws[-1]['e']), 2),
             'text': norm(' '.join(str(w['w']) for w in ws)), 'w0': cur[0], 'w1': cur[-1]}
        spk = ws[0].get('spk')
        if spk and spk != 'S?':
            u['spk'] = str(spk)[:8]
        ps = [w['p'] for w in ws if isinstance(w.get('p'), (int, float))]
        if ps:
            u['conf'] = round(sum(ps) / len(ps), 2)
        if sum(1 for w in ws if w.get('c')) > len(ws) / 2:
            u['ts'] = 'seg'
        out.append(u)
        cur.clear()

    for i, w in enumerate(words):
        if cur:
            prev = words[cur[-1]]
            dur = float(w['e']) - float(words[cur[0]]['s'])
            gap = float(w['s']) - float(prev['e'])
            sent = SENT_END.search(str(prev['w'])) and float(prev['e']) - float(words[cur[0]]['s']) >= UNIT_MIN_S
            spk = (w.get('spk') or '') != (prev.get('spk') or '')
            if sent or gap >= PAUSE_S or dur > UNIT_MAX_S or spk:
                close()
        cur.append(i)
    close()
    return out


def slides_doc(screen: dict) -> tuple[list[dict], list[dict]]:
    """יחידות המסך (vt/vi.py) → slides (s<n>, רק שקפים) ו־ocr (o<n>.<k>). המספור לפי הסדר בסרטון."""
    slides, ocr = [], []
    n = 0
    for u in screen.get('units') or []:
        if u.get('kind') != 'slide' or not u.get('states'):
            continue
        n += 1
        sid = 's%d' % n
        st = [{'k': k, 't0': round(float(x['t0']), 2)} for k, x in enumerate(u['states'])]
        d = {'id': sid, 't0': round(float(u['t0']), 2), 't1': round(float(u['t1']), 2), 'kind': 'slide', 'states': st,
             'ocr': [], 'so': []}
        if st and u['states'][0].get('rel'):
            d['rel'] = u['states'][0]['rel']
        if isinstance(u.get('img'), dict):
            d['img'] = {k: int(u['img'][k]) for k in ('o', 'l', 'w', 'h') if k in u['img']}
        o = u.get('ocr') or {}
        if o.get('error'):
            d['oerr'] = 1
        for k, ln in enumerate(o.get('lines') or [], 1):
            oid = '%s.%d' % ('o%d' % n, k)
            ocr.append({'id': oid, 'text': norm(ln.get('text')), 'conf': int(ln.get('conf') or 0), 'lang': ln.get('lang') or 'other',
                        'dir': ln.get('dir') or 'ltr', 'box': ln.get('box') or [0, 0, 0, 0]})
            d['ocr'].append(oid)
        slides.append(d)
    return slides, ocr


def screen_only(slides: list[dict], ocr: list[dict], words: list[dict]) -> int:
    """שורות OCR שלא נאמרו בדיבור (‏±SO_WIN סביב השקף) → slide['so']. מחזיר כמה."""
    by_id = {o['id']: o for o in ocr}
    starts = [float(w['s']) for w in words]
    import bisect
    n = 0
    for s in slides:
        a = bisect.bisect_left(starts, s['t0'] - SO_WIN)
        b = bisect.bisect_right(starts, s['t1'] + SO_WIN)
        said = set()
        for w in words[a:b]:
            for t in tokens(str(w['w'])):
                said |= variants(t)
        for oid in s['ocr']:
            o = by_id[oid]
            tk = tokens(o['text'])
            if o['conf'] < SO_MIN_CONF or len(tk) < SO_MIN_WORDS:
                continue
            hit = sum(1 for t in tk if variants(t) & said)
            if hit < SO_HIT * len(tk):
                s['so'].append(oid)
                n += 1
    return n


NUM_RE = re.compile(r'(?<![\w.])[-+]?(?:\$|€|₪)?\d{1,3}(?:[,\d]{0,12})(?:\.\d+)?\s?(?:%|[kKmMbB]\b|אחוז)?')
URL_RE = re.compile(r'\b(?:https?://|www\.)[^\s<>"]{3,120}', re.I)
DOI_RE = re.compile(r'\b10\.\d{4,9}/[^\s"<>]{2,80}')
ARXIV_RE = re.compile(r'\barXiv:\s?\d{4}\.\d{4,5}(?:v\d+)?', re.I)
CITE_RE = re.compile(r'\b[A-Z][a-z]+(?: et al\.?| and [A-Z][a-z]+)?,? \(?(?:19|20)\d{2}\)?')
ENT_RE = re.compile(r'\b(?:[A-Z][a-zA-Z0-9&\-]+(?:\s+[A-Z][a-zA-Z0-9&\-]+){0,3}|[A-Z]{2,}[0-9]*)\b')
CODE_RE = re.compile(r'(?:\bdef |\bclass |\bimport |\breturn\b|\bfunction\b|=>|==|!=|;\s*$|\{|\}|\w+\(.*\))')


def inventories(ev: list[dict], slides: list[dict], ocr: list[dict]) -> dict:
    """המלאים (V32) — מה שהמודל צריך לכסות, בלי מודל: מספרים, ישויות, מונחים (כותרות שקפים), הפניות, קוד ושאלות.
    כל פריט עם המזהים שבהם הוא מופיע (ev). מוגבל — זה שלד, לא הניתוח."""
    num, ent, ref = {}, {}, {}

    def add(d, key, val, eid, cap):
        if key not in d and len(d) >= cap:
            return
        x = d.setdefault(key, {'v': val, 'ev': []})
        if eid not in x['ev'] and len(x['ev']) < 8:
            x['ev'].append(eid)

    def scan(text, eid):
        for m in NUM_RE.finditer(text):
            v = m.group(0).strip()
            if sum(ch.isdigit() for ch in v) >= 2 or '%' in v or 'אחוז' in v:
                add(num, v.replace(' ', ''), v, eid, 300)
        for rx in (URL_RE, DOI_RE, ARXIV_RE, CITE_RE):
            for m in rx.finditer(text):
                add(ref, m.group(0).strip().rstrip('.,)'), m.group(0).strip().rstrip('.,)'), eid, 100)
        for m in ENT_RE.finditer(text):
            v = m.group(0)
            if len(v) >= 2 and v.lower() not in STOP and not v.isdigit():
                add(ent, v, v, eid, 200)

    for u in ev:
        scan(u['text'], u['id'])
    by_id = {o['id']: o for o in ocr}
    terms, code = [], []
    for s in slides:
        ls = [by_id[i] for i in s['ocr']]
        for o in ls:
            scan(o['text'], o['id'])
        top = sorted((o for o in ls if o['conf'] >= 50 and 1 <= len(o['text'].split()) <= 8), key=lambda o: (o['box'][1], -o['box'][3]))
        if top:
            terms.append({'v': top[0]['text'], 'ev': [s['id'], top[0]['id']]})
        if sum(1 for o in ls if CODE_RE.search(o['text'])) >= 2:
            code.append({'v': s['id'], 'ev': [s['id']] + [o['id'] for o in ls if CODE_RE.search(o['text'])][:6]})
    qs = [{'v': u['text'][-200:], 'ev': [u['id']]} for u in ev if u['text'].rstrip().endswith('?')][:100]
    # מילה אחת באות גדולה שמופיעה גם באותיות קטנות (So / so) — תחילת משפט, לא שם. צירוף או ראשי תיבות — נשארים
    low = {w for u in ev for w in u['text'].split() if w[:1].islower()}
    ent = {k: v for k, v in ent.items() if ' ' in k or k.isupper() or k.lower() not in low}
    return {'num': list(num.values()), 'ent': list(ent.values())[:150], 'term': terms[:300], 'ref': list(ref.values()),
            'code': code[:50], 'q': qs}


def bounds(ev: list[dict], slides: list[dict]) -> list[dict]:
    """מועמדי גבול לפרקים: שקף חדש (לא חשיפה ולא עריכה), ושקט ארוך בין יחידות דיבור. קרובים — אחד."""
    c = [{'t': s['t0'], 'why': 'slide', 'ev': [s['id']]} for s in slides if s.get('rel', 'new') == 'new']
    for a, b in zip(ev, ev[1:]):
        if b['t0'] - a['t1'] >= BOUND_PAUSE:
            c.append({'t': b['t0'], 'why': 'pause', 'ev': [b['id']]})
    c.sort(key=lambda x: x['t'])
    out: list[dict] = []
    for x in c:
        if out and x['t'] - out[-1]['t'] < BOUND_MERGE:
            out[-1]['ev'] = (out[-1]['ev'] + x['ev'])[:4]
            if x['why'] != out[-1]['why']:
                out[-1]['why'] = 'both'
            continue
        out.append(dict(x, t=round(x['t'], 2)))
    return out


def cues(words: list[dict]) -> list[dict]:
    """התמליל בשפת המקור ככתוביות לנגן (normCues בטלפון): עד CUE_MAX_S שנ׳ ו־CUE_MAX_CH תווים, בשתי שורות לכל היותר."""
    out, cur = [], []

    def close():
        if not cur:
            return
        text = norm(' '.join(str(w['w']) for w in cur))
        mid = len(text) // 2
        if len(text) > CUE_MAX_CH // 2:
            sp = text.rfind(' ', 0, mid + 8)
            lines = [text[:sp].strip(), text[sp:].strip()] if sp > 0 else [text]
        else:
            lines = [text]
        c = {'id': len(out) + 1, 'start': round(float(cur[0]['s']), 3), 'end': round(max(float(cur[-1]['e']), float(cur[0]['s']) + 0.3), 3),
             'lines': [x for x in lines if x]}
        if cur[0].get('spk') and cur[0]['spk'] != 'S?':
            c['spk'] = str(cur[0]['spk'])[:8]
        out.append(c)
        cur.clear()

    for w in words:
        if cur:
            text = ' '.join(str(x['w']) for x in cur + [w])
            if (float(w['e']) - float(cur[0]['s']) > CUE_MAX_S or len(text) > CUE_MAX_CH
                    or float(w['s']) - float(cur[-1]['e']) >= PAUSE_S or SENT_END.search(str(cur[-1]['w']))):
                close()
        cur.append(w)
    close()
    return out


# ---------------------------------------------------------------- מה המיפוי היה שולח (rv במצב dry)

def windows(ev: list[dict], slides: list[dict], ocr: list[dict], win_tok: int = VI_WIN_TOK, est=None) -> list[str]:
    """חלונות המיפוי: בלוק לכל יחידת ראיה עם המזהה בלבד (בלי זמנים — 19.2), והשקפים שמתחילים בתוך החלון עם ה־OCR.
    החלון נסגר כשהאומדן עובר את win_tok. זה מה שנספר — לא הפרומפט הסופי (visheet.py, גל 1)."""
    est = est or _est_tokens
    by_id = {o['id']: o for o in ocr}
    items = [(u['t0'], '[%s%s] %s' % (u['id'], '|' + u['spk'] if u.get('spk') else '', u['text'])) for u in ev]
    for s in slides:
        lines = ' / '.join(by_id[i]['text'] for i in s['ocr'] if by_id[i]['text'])
        items.append((s['t0'], '[%s] %s' % (s['id'], lines or '—')))
    items.sort(key=lambda x: x[0])
    out, cur, tok = [], [], 0
    for _, line in items:
        t = est(line)
        if cur and tok + t > win_tok:
            out.append('\n'.join(cur))
            cur, tok = [], 0
        cur.append(line)
        tok += t
    if cur:
        out.append('\n'.join(cur))
    return out


def _est_tokens(text: str) -> int:
    try:
        import llm
        return llm.est_tokens(text)
    except Exception:  # noqa: BLE001
        a = sum(1 for ch in text if ord(ch) < 128)
        return int(a / 3.0 + (len(text) - a) / 1.3) + 1


def count_tokens(wins: list[str], mode: str = '', counter=None) -> dict:
    """count_tokens של ה־API (חינם, מכסה נפרדת) על כל חלון. בלי מפתח / תקלה — האומדן, ו־src='est'."""
    est = sum(_est_tokens(w) for w in wins)
    if not wins:
        return {'win': 0, 'tok': 0, 'est': 0, 'src': 'none'}
    try:
        if counter is None:
            import llm
            eng = llm.Engine(llm.Spec.of(mode or 'haiku-high') if mode else llm.judge_spec())
            cl, model = eng._client_or_new(), eng.spec.model

            def counter(text):
                r = cl.messages.count_tokens(model=model, messages=[{'role': 'user', 'content': text}])
                return int(getattr(r, 'input_tokens', 0) or 0)
        tot = 0
        for w in wins:
            for k in range(3):
                try:
                    tot += counter(w)
                    break
                except Exception as e:  # noqa: BLE001 — 429: מחכים ומנסים שוב
                    if k == 2 or 'rate' not in str(e).lower():
                        raise
                    time.sleep(5 * (k + 1))
        return {'win': len(wins), 'tok': tot, 'est': est, 'src': 'api'}
    except Exception as e:  # noqa: BLE001
        return {'win': len(wins), 'tok': est, 'est': est, 'src': 'est', 'why': type(e).__name__[:40]}


# ---------------------------------------------------------------- vi.json

def build_vi(lang: str, dur: float, src_kind: str, title: str, wd: dict, screen: dict, ev: list[dict], slides: list[dict],
             ocr: list[dict], inv: dict, bnd: list[dict], n_so: int, asr_q: str, tok: dict, warn: list[str]) -> dict:
    """vi.json בלי Claude (נספח 19.1, תת־קבוצה): הראיות, השקפים, ה־OCR, המלאים ומועמדי הגבול. הפרקים והפריטים ריקים —
    הם של Claude (גל 1). dry = מה שנמדד ונספר."""
    words = wd.get('words') or []
    return {
        'v': VI_V, 'pv': 0, 'dry': 1, 'lang': {'src': lang, 'out': 'he'}, 'genre': 'other',
        'video': {'dur': round(dur, 2), 'src': src_kind, 'title': title[:200], 'w': screen.get('w') or 0, 'h': screen.get('h') or 0},
        'wd': [[str(w['w']), round(float(w['s']), 2), round(float(w['e']), 2)] for w in words],
        'evidence': ev, 'slides': slides, 'ocr': ocr, 'inv': inv, 'bounds': bnd,
        'segments': [], 'chapters': [], 'items': [], 'briefing': None, 'ledger': [],
        'quality': {'items': 0, 'sup': 0, 'cov': 0, 'asr': asr_q, 'ts': wd.get('ts') or 'none', 'so': n_so,
                    'img': screen.get('img') or '', 'warn': [x for x in warn if x in VI_WARN]},
        'tok': tok,
    }


def summary(vi: dict) -> dict:
    """הסיכום שעולה למסמך העבודה (10.5): מספרים שלמים בלבד. n = פריטים, ok = מאומתים, cov = כיסוי ×100,
    so = "רק על המסך", d = משך (שנ׳). במצב dry אין פריטים — n ו־ok הם 0."""
    q = vi.get('quality') or {}
    return {'n': int(q.get('items') or 0), 'ok': int(q.get('sup') or 0), 'cov': int(round(100 * float(q.get('cov') or 0))),
            'so': int(q.get('so') or 0), 'd': int(round(float((vi.get('video') or {}).get('dur') or 0)))}


def warnings(screen: dict, asr_q: str, wd: dict, has_video: bool) -> list[str]:
    w = []
    if not has_video or screen.get('noscreen'):
        w.append('vi_noscreen')
    if screen.get('lowres'):
        w.append('vi_lowres')
    if (screen.get('stats') or {}).get('ocr_err'):
        w.append('vi_ocr')
    if asr_q == 'low':
        w.append('vi_asr_low')
    if wd.get('ts') in ('seg', 'none') and wd.get('words'):
        w.append('ts_coarse')
    return w


# ---------------------------------------------------------------- מדידה

def cpu_facts() -> dict:
    """דגלי המעבד שקובעים מהירות (AVX2/AVX-512/AMX — ה־0.6 בוחר לפיהם), ושם הדגם."""
    try:
        txt = Path('/proc/cpuinfo').read_text(encoding='utf-8', errors='replace')
    except OSError:
        return {}
    fl, model = set(), ''
    for line in txt.splitlines():
        if line.startswith('flags') and not fl:
            fl = set(line.split(':', 1)[1].split())
        elif line.startswith('model name') and not model:
            model = line.split(':', 1)[1].strip()[:60]
    return {'flags': [f for f in CPU_FLAGS if f in fl], 'model': model}


def _hwm_mb() -> int:
    try:
        for line in Path('/proc/self/status').read_text().splitlines():
            if line.startswith('VmHWM:'):
                return int(int(line.split()[1]) / 1024)
    except (OSError, ValueError, IndexError):
        pass
    return int(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024)


def stage_rows(timing: dict, t_from: float) -> tuple[float, int, float]:
    """שורות snb-timing.json מאז t_from → (שניות, שיא MB, שניות מעבד) של הפקודות שרצו בשלב."""
    secs, mb, cpu = 0.0, 0, 0.0
    for x in (timing or {}).get('vt') or []:
        if isinstance(x, list) and len(x) >= 5 and isinstance(x[1], (int, float)) and x[1] >= t_from - 1 and not str(x[0]).startswith('vi_'):
            secs += float(x[2] or 0)
            mb = max(mb, int(x[4] or 0))
            if len(x) >= 7 and isinstance(x[6], (int, float)):
                cpu += float(x[6])
    return secs, mb, cpu


class Stages:
    """זמן לכל שלב של הניתוח: ‏vi_<שלב> ב־snb-timing.json (job.note_timing) — השניות, השיא (הפקודות שרצו בשלב או
    המתזמר עצמו) והמעבד. ‏report = ctx.report של השלב (התקדמות בטלפון)."""

    def __init__(self, J, ctx):
        self.J, self.ctx, self.cur, self.t0, self.out = J, ctx, None, 0.0, {}

    def go(self, st: str, msg: str | None = None):
        self.end()
        self.cur, self.t0 = st, time.time()
        self._cpu0 = _cpu_now()
        self.ctx.report(st, 0, msg, force=True)

    def end(self):
        if not self.cur:
            return
        t1 = time.time()
        timing = _read_json(self.ctx.pdir / 'snb-timing.json')
        _, mb, cpu = stage_rows(timing, self.t0)
        own = _cpu_now() - self._cpu0
        mb = max(mb, _hwm_mb() if self.cur in ('up', 'bn', 'sv', 'rv') else 0)
        self.J.note_timing(self.ctx, 'vi_' + self.cur, self.t0, t1, mb, cpu + own)
        self.out[self.cur] = {'s': round(t1 - self.t0, 1), 'mb': int(mb), 'cpu': round(cpu + own, 1)}
        self.cur = None


def _cpu_now() -> float:
    r = resource.getrusage(resource.RUSAGE_SELF)
    return r.ru_utime + r.ru_stime


def _read_json(p: Path):
    try:
        return json.loads(Path(p).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


# ---------------------------------------------------------------- המתזמר

def probe(src: Path) -> dict:
    p = subprocess.run(['ffprobe', '-v', 'error', '-print_format', 'json', '-show_streams', '-show_format', str(src)],
                       capture_output=True, text=True, timeout=120)
    info = json.loads(p.stdout or '{}') if p.returncode == 0 else {}
    ss = info.get('streams') or []
    vs = [x for x in ss if x.get('codec_type') == 'video' and not (x.get('disposition') or {}).get('attached_pic')]
    return {'dur': float((info.get('format') or {}).get('duration') or 0), 'video': bool(vs),
            'audio': any(x.get('codec_type') == 'audio' for x in ss),
            'h': int(vs[0].get('height') or 0) if vs else 0}


def vi_run(J, args) -> int:
    """עבודת ניתוח במצב dry. J = המודול job (כמו pipeline.run_auto)."""
    ctx = J.Ctx(J.load_state())
    spec = ctx.st.get('spec') or {}
    lang = spec.get('from')
    if lang not in VI_LANGS:
        ctx.report(fail=True, err='vi_lang', msg='כרגע עברית ואנגלית', force=True)
        raise SystemExit('✗ ניתוח: שפת המקור לא נתמכת (רק עברית ואנגלית).')
    if spec.get('dry') != 1:                          # גל 0: רק הרצה יבשה. הניתוח עם Claude — מגל 1
        ctx.report(fail=True, err='vi_off', msg='הניתוח עוד לא פתוח', force=True)
        raise SystemExit('✗ ניתוח: בגל 0 יש רק הרצה יבשה.')
    S = Stages(J, ctx)
    pd = ctx.pdir
    pd.mkdir(parents=True, exist_ok=True)
    # 1. קליטה
    S.go('up', 'מורידים את הסרטון')
    J.url_fetch(ctx)
    files = ctx.st.get('files') or {}
    f = files.get('v') if (files.get('v') or {}).get('id') else None
    f = f or J.wait_video(ctx, 'up', 'מחכה שהסרטון יסיים לעלות')
    src = J.in_path(ctx, f, 'v')
    J.fetch_input(ctx, f['id'], src, int(f.get('size') or 0), lambda x: ctx.report('up', x))
    J.ensure_env(ctx, 'tr')
    info = probe(src)
    dur = info['dur']
    if dur > VI_MAX_S:
        ctx.report(fail=True, err='vi_long', msg='עד %d דקות' % (VI_MAX_S // 60), force=True)
        raise SystemExit('✗ ניתוח: הסרטון ארוך מ־%d דק׳.' % (VI_MAX_S // 60))
    if not info['audio'] and not info['video']:
        ctx.report(fail=True, err='vi_schema', msg='אין בקובץ שמע או וידאו', force=True)
        raise SystemExit('✗ ניתוח: אין בקובץ שמע או וידאו.')
    # 2. תמלול
    S.go('tr', 'מתמללים')
    wav = pd / 'audio16k.wav'
    tr_p, wd_p, scr = pd / 'vi.tr.json', pd / 'vi.wd.json', pd / 'screen'
    if info['audio']:
        t0 = time.time()
        subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', str(src), '-vn', '-ac', '1', '-ar', '16000', str(wav)],
                       check=True, timeout=3600)
        J.note_timing(ctx, 'vi-wav', t0, time.time())
        J.vt(ctx, ['vi-asr', str(wav), '--lang', lang, '--out', str(tr_p)], 'tr')
    tr = _read_json(tr_p) or {'lang': lang, 'words': [], 'quality': 'low'}
    # 3. מסך ויישור
    S.go('al', 'מזהים שקפים ומיישרים')
    if info['video']:
        J.vt(ctx, ['vi-screen', str(src), '--out', str(scr), '--mem-mb', str(mem_need(dur))], 'al', 0.0, 0.5)
    screen = _read_json(scr / 'screen.json') or {'units': [], 'noscreen': True}
    if tr.get('words'):
        J.vt(ctx, ['vi-align', str(tr_p), str(wav), '--out', str(wd_p)], 'al', 0.5, 0.95)
    wd = _read_json(wd_p) or {'words': tr.get('words') or [], 'ts': 'seg' if tr.get('words') else 'none'}
    words = wd.get('words') or []
    ev = evidence(words)
    slides, ocr = slides_doc(screen)
    n_so = screen_only(slides, ocr, words)
    inv = inventories(ev, slides, ocr)
    bnd = bounds(ev, slides)
    # 4. מה היה נשלח ל־Claude — נספר בלבד
    S.go('rv', 'סופרים את הטוקנים (בלי לשלוח)')
    tok = count_tokens(windows(ev, slides, ocr), spec.get('mode') or '')
    tok['img'] = sum(int(s['img']['w']) * int(s['img']['h']) // IMG_TOK_DIV for s in slides if s.get('img'))
    tok['h'] = int(round(tok['tok'] * 3600 / dur)) if dur > 0 else 0
    # 5. בנייה
    S.go('bn', 'בונים את התוצרים')
    warn = warnings(screen, tr.get('quality') or 'ok', wd, info['video'])
    title = os.path.splitext(str(spec.get('name') or ctx.name))[0][:120]
    src_kind = 'yt' if spec.get('src') == 'url' and 'youtu' in str(spec.get('url') or '') else 'url' if spec.get('src') == 'url' else 'file'
    vi = build_vi(lang, dur, src_kind, title, wd, screen, ev, slides, ocr, inv, bnd, n_so, tr.get('quality') or 'ok', tok, warn)
    (pd / 'vi.json').write_text(json.dumps(vi, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    (pd / 'cues.json').write_text(json.dumps(cues(words), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    if info['video']:
        J.vt(ctx, ['vi-small', str(src), '--out', str(pd / 'small.mp4')], 'bn', 0.1, 1.0)
    # 6. שמירה
    S.go('sv', 'שומרים')
    res = [(k, pd / fn, title + sfx, mime) for k, fn, sfx, mime in VI_FILES if (pd / fn).is_file() and (pd / fn).stat().st_size > 0]
    total = sum(p.stat().st_size for _, p, _, _ in res) or 1
    done, up = 0, []
    for k, p, name, mime in res:
        size = p.stat().st_size
        fid = J.put_output_retry(ctx, p, name, k, mime, lambda x, b=done, s=size: ctx.report('sv', (b + x * s) / total))
        done += size
        up.append({'id': fid, 'name': name, 'size': size, 'k': k})
    S.end()
    vs = summary(vi)
    facts = {'v': 1, 'lang': lang, 'dur': round(dur), 'stg': S.out, 'cpu': cpu_facts(), 'tok': tok, 'ev': len(ev), 'sl': len(slides),
             'ocr': len(ocr), 'so': n_so, 'w': len(words), 'ts': wd.get('ts'), 'asr': tr.get('quality'), 'warn': warn,
             'scr': {k: v for k, v in (screen.get('stats') or {}).items() if isinstance(v, (int, float))}}
    print('VI_DRY ' + json.dumps(facts, separators=(',', ':')), flush=True)
    # vsm (לא vs: בדיווח של התרגום vs = גודל הגרסה הארוזה של איכויות הצפייה) — מספרים שלמים בלבד; השרתון שומר ב־job.vsm
    ctx.report(done=True, out=up, vsm=vs, msg='הניתוח היבש מוכן', force=True)
    for p in (src, wav):
        try:
            p.unlink()
        except OSError:
            pass
    print('✓ הניתוח היבש מוכן: ' + ', '.join(o['k'] for o in up))
    return 0
