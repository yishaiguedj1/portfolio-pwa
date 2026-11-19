#!/usr/bin/env python3
"""בדיקת העומק של מכפיל באפט — גל 2: השוואת הקוראים הבלתי תלויים של ההודעות לעיתונות (docs/buffett-pe-audit.md).

קלט:
  <BD>/read/<wave>/{A,B,C}/*.jsonl — שורה לכל הודעה לפי הרובריקה (docs/research/buffett-pe/rubric-policy.md)
  <BD>/read/<wave>/batches.json    — הקבוצות: id, ‏list (קובץ של <CIK>/<acc>.txt) — מה שכל קורא היה אמור לקרוא
  <BD>/sys.jsonl                   — מה שהמסווג של המערכת (secsbc.classify) החליט על כל הודעה (tools/buffett-deep/sysclass.js)
פלט (בתוך <BD>/read/<wave>/):
  cmp.jsonl      — שורה להודעה: הערכים של כל קורא בשדות הנבדקים, ההסכמה, הקונצנזוס (cons) והמחלוקות
  disputes.txt   — ההודעות שבהן A ו־B חלוקים ואין עדיין הכרעה של C (רשימה לקורא השלישי, באותו פורמט של batches/*.txt)
  disputes.json  — לכל הודעה כזו: שמות השדות שבמחלוקת (בלי הערכים — הקורא השלישי קורא עיוור)
  cmp.sum.txt    — תקינות, שיעורי הסכמה לכל שדה, ומטריצות הבלבול של הקונצנזוס מול המסווג
שימוש: python3 -I tools/buffett-deep/readcmp.py <BD> [wave=w2]
"""
import collections
import glob
import json
import os
import re
import sys

CAT = ('er', 'pre', 'adj', 'ex', 'partial', 'chg', 'fut', 'pol')
# השדות שמחלוקת בהם שולחת לקורא השלישי (המדיניות + המספרים שגל 3 משווה)
HOT_CAT = ('er', 'adj', 'ex', 'fut', 'chg', 'pol')
EPS = ('eps_gaap', 'eps_adj')
MONEY = ('sbc_rec', 'tax_adj', 'tax_sbc', 'sbc_total')
PS = ('sbc_rec_ps', 'tax_adj_ps')
SHARES = ('sh_dil', 'sh_adj')
HOT_NUM = ('pe', 'eps_gaap', 'eps_adj', 'sbc_rec', 'sbc_rec_ps', 'sh_dil')
UNIT = {'thousands': 1e3, 'thousand': 1e3, 'millions': 1e6, 'million': 1e6, 'billions': 1e9, 'billion': 1e9, 'units': 1, 'dollars': 1}


MONTHS = {m: i + 1 for i, m in enumerate(('jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'))}


def pe_norm(v):
    """תאריך סוף הרבעון כפי שהקורא העתיק → YYYY-MM-DD. הקוראים כותבים גם 'September 30, 2025', ‏'June 30,2026', ‏'9/30/25',
    ‏'31 March 2025', ‏'Mar 29, 2026' (גל 2); מה שלא מתפענח — None"""
    if not isinstance(v, str):
        return None
    t = v.strip().lower().replace('.', '')
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})', t)
    if m:
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
    else:
        m = re.match(r'^([a-z]{3})[a-z]*\s+(\d{1,2})\s*,?\s*(\d{4})$', t) or None
        m2 = re.match(r'^(\d{1,2})\s+([a-z]{3})[a-z]*\s*,?\s*(\d{4})$', t)
        m3 = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{2,4})$', t)
        if m and m.group(1) in MONTHS:
            y, mo, d = int(m.group(3)), MONTHS[m.group(1)], int(m.group(2))
        elif m2 and m2.group(2) in MONTHS:
            y, mo, d = int(m2.group(3)), MONTHS[m2.group(2)], int(m2.group(1))
        elif m3:
            y, mo, d = int(m3.group(3)), int(m3.group(1)), int(m3.group(2))
            y += 2000 if y < 100 else 0
        else:
            return None
    if not (1 <= mo <= 12 and 1 <= d <= 31):
        return None
    return '%04d-%02d-%02d' % (y, mo, d)


def num(v):
    """ערך מספרי כפי שהקורא העתיק — מספר, או מחרוזת כמו "$(1.04)" / "1,043" → float; אחרת None"""
    if isinstance(v, bool) or v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip()
    neg = s.startswith('(') and s.endswith(')') or s.startswith('-') or s.startswith('−')
    s = re.sub(r'[^0-9.]', '', s)
    if not s or s.count('.') > 1:
        return None
    try:
        x = float(s)
    except ValueError:
        return None
    return -x if neg else x


def unit_of(j):
    u = str(((j.get('nums') or {}).get('unit')) or '').lower()
    for k, f in UNIT.items():
        if k in u:
            return f
    return None


def ex_norm(j):
    """ex כפי שנקרא: True / False / 'partial' (תגמול מיוחד בלבד — לפי הרובריקה ex=false) / None (לא ברור)"""
    if j.get('partial') is True:
        return 'partial'
    return j.get('ex') if j.get('ex') in (True, False) else None


def pol_of(j):
    """המדיניות כפי שהשרת משתמש בה: True — הרווח המותאם למניה מוציא את התגמול השוטף; False — לא מוציא, רק תגמול מיוחד (partial),
    או שאין רווח מותאם למניה בכלל (adj=false, AAPL); None — לא ברור"""
    if j.get('adj') is False:
        return False
    e = ex_norm(j)
    return True if e is True else False if e in (False, 'partial') else None


def val(j, f):
    if f == 'ex':
        return ex_norm(j)
    if f == 'pol':
        return pol_of(j)
    if f in CAT:
        v = j.get(f)
        return v if v in (True, False) or isinstance(v, str) else None
    v = (j.get('nums') or {}).get(f)
    return (pe_norm(v) or v) if f == 'pe' else v


def same(f, a, b, ja=None, jb=None):
    """האם שני ערכים של אותו שדה מסכימים. מחזיר (bool, הערה)"""
    if f in CAT:
        return a == b, ''
    if f == 'pe':
        na, nb = pe_norm(a), pe_norm(b)
        return (na == nb) if na and nb else (a is None and b is None), ''
    x, y = num(a), num(b)
    if x is None or y is None:
        return (x is None and y is None), ''
    if f in EPS or f in PS:
        return abs(x - y) <= 0.0051, ''
    if f in MONEY:
        ua, ub = unit_of(ja or {}), unit_of(jb or {})
        if ua and ub:
            x, y = x * ua, y * ub
        if x == y or (y and abs(x / y - 1) <= 0.005):
            return True, ''
        if x and y:
            r = abs(x / y)
            for k in (1e3, 1e6, 1e-3, 1e-6):
                if abs(r / k - 1) <= 0.005:
                    return False, 'scale'
        return False, ''
    if f in SHARES:
        # מניות — טבלה של מניות יכולה להיות ביחידה אחרת מהסכומים: מספיק שהספרות מסכימות (יחס של 1000^k)
        if x == y or (y and abs(x / y - 1) <= 0.005):
            return True, ''
        if x and y:
            r = abs(x / y)
            for k in (1e3, 1e6, 1e-3, 1e-6):
                if abs(r / k - 1) <= 0.005:
                    return True, 'scale'
        return False, ''
    return a == b, ''


def load(path):
    rows, bad = {}, []
    for f in sorted(glob.glob(path)):
        for i, l in enumerate(open(f, encoding='utf-8')):
            l = l.strip()
            if not l:
                continue
            try:
                j = json.loads(l)
            except Exception:
                bad.append('%s:%d' % (os.path.basename(f), i + 1))
                continue
            a = j.get('acc')
            if a in rows:
                bad.append('dup:' + str(a))
            rows[a] = j
    return rows, bad


def majority(f, vals, js):
    """הכרעה: ערך שלפחות שני קוראים מסכימים עליו; אחרת None + 'split'"""
    ks = [k for k in vals]
    for i, a in enumerate(ks):
        for b in ks[i + 1:]:
            ok, _ = same(f, vals[a], vals[b], js[a], js[b])
            if ok:
                return vals[a], ''
    return None, 'split'


def main():
    bd = sys.argv[1]
    wave = sys.argv[2] if len(sys.argv) > 2 else 'w2'
    wd = os.path.join(bd, 'read', wave)
    batches = json.load(open(os.path.join(wd, 'batches.json')))
    want = {}
    for b in batches:
        for l in open(b['list']):
            l = l.strip()
            if l:
                ck, acc = l.split('/')
                want[acc[:-4]] = (int(ck), b['id'], l)
    S = {}
    for l in open(os.path.join(bd, 'sys.jsonl')):
        o = json.loads(l)
        S.setdefault(o['acc'], o)
    R, BAD = {}, {}
    for who in ('A', 'B', 'C'):
        R[who], BAD[who] = load(os.path.join(wd, who, '*.jsonl'))
    out, disp, sumy = [], {}, []
    agree = collections.Counter()
    tot = collections.Counter()
    notes = collections.Counter()
    for acc, (ck, bid, line) in sorted(want.items(), key=lambda kv: (kv[1][1], kv[0])):
        js = {w: R[w][acc] for w in ('A', 'B', 'C') if acc in R[w]}
        s = S.get(acc) or {}
        row = dict(acc=acc, cik=ck, sym=s.get('sym'), filed=s.get('filed'), batch=bid, readers=''.join(sorted(js)),
                   picked=s.get('sys'), sys_c=s.get('c'), sys_all=s.get('call'))
        ab = [w for w in ('A', 'B') if w in js]
        dis = []
        # המספרים נבדקים רק כששני הקוראים קבעו שזו הודעת תוצאות (בעדכון תחזית אין רבעון — ABBV בפיילוט)
        both_er = len(ab) == 2 and js['A'].get('er') is True and js['B'].get('er') is True
        for f in CAT + ('pe',) + EPS + MONEY + PS + SHARES:
            vs = {w: val(js[w], f) for w in js}
            row[f] = vs
            if len(ab) == 2 and (f in CAT or both_er):
                ok, note = same(f, vs['A'], vs['B'], js['A'], js['B'])
                if not ok and f in ('ex', 'fut') and js['A'].get('adj') is False and js['B'].get('adj') is False:
                    # בלי רווח מותאם ex/fut לא רלוונטיים (null או false — אותה משמעות; pol=false אצל שניהם)
                    ok, note = True, 'no-adj'
                if not ok and f in SHARES:
                    # בהפסד המניות המדוללות של GAAP = הבסיסיות, והמדולל המותאם גבוה יותר — קורא אחד רושם אותו ב־sh_dil
                    # והשני ב־sh_adj (ALNY בפיילוט). הסכמה אם הערך של אחד מופיע באחד משני השדות של השני
                    oth = {'sh_dil': 'sh_adj', 'sh_adj': 'sh_dil'}[f]
                    xa = [v for v in (vs['A'], val(js['A'], oth)) if v is not None]
                    xb = [v for v in (vs['B'], val(js['B'], oth)) if v is not None]
                    if xa and xb and any(same(f, a, b)[0] for a in xa for b in xb):
                        ok, note = True, 'swap'
                tot[f] += 1
                agree[f] += ok
                if note:
                    notes[f + ':' + note] += 1
                if not ok and f == 'sbc_rec_ps' and num(val(js['A'], 'sbc_rec')) is not None and \
                        same('sbc_rec', val(js['A'], 'sbc_rec'), val(js['B'], 'sbc_rec'), js['A'], js['B'])[0]:
                    note = 'has-total'     # שניהם מסכימים על הסכום הכולל; הערך למניה רק אצל אחד — לא מחלוקת
                    notes[f + ':' + note] += 1
                    continue
                if not ok and (f in HOT_CAT or f in HOT_NUM):
                    dis.append(f)
        cons = {}
        for f in CAT + ('pe',) + EPS + MONEY + PS + SHARES:
            vs = {w: val(js[w], f) for w in js}
            if len(vs) >= 2:
                v, why = majority(f, vs, js)
                if why and f in ('ex', 'fut') and sum(1 for w in js if js[w].get('adj') is False) >= 2:
                    v, why = None, ''   # בלי רווח מותאם (רוב הקוראים) — לא רלוונטי; המדיניות ב־pol
                if why and f in SHARES:
                    # sh_dil/sh_adj בהחלפה (ראו למעלה): הערך שמופיע אצל שני קוראים לפחות, באחד משני השדות
                    oth = {'sh_dil': 'sh_adj', 'sh_adj': 'sh_dil'}[f]
                    sets = {w: [x for x in (vs[w], val(js[w], oth)) if x is not None] for w in vs}
                    cand = [x for w in sets for x in sets[w]
                            if sum(1 for w2 in sets if any(same(f, x, y)[0] for y in sets[w2])) >= 2]
                    if cand and f == 'sh_dil':
                        v, why = max(cand, key=lambda x: num(x) or 0), ''
                cons[f] = v if not why else 'SPLIT'
        row['dis'] = dis
        row['cons'] = cons
        row['quote'] = {w: (js[w].get('quote') or '')[:300] for w in js}
        row['conf'] = {w: js[w].get('conf') for w in js}
        out.append(row)
        if dis and 'C' not in js:
            disp[acc] = dict(line=line, fields=dis)
    with open(os.path.join(wd, 'cmp.jsonl'), 'w') as fo:
        for r in out:
            fo.write(json.dumps(r, ensure_ascii=False) + '\n')
    with open(os.path.join(wd, 'disputes.txt'), 'w') as fo:
        for a, d in disp.items():
            fo.write(d['line'] + '\n')
    json.dump(disp, open(os.path.join(wd, 'disputes.json'), 'w'), ensure_ascii=False, indent=0)
    # הקבוצות לקורא השלישי — כמו בגל: עד ~350 אלף תווים לקבוצה, קובץ מעל 300 אלף לבד (big)
    cb, cur, size = [], [], 0
    prt = os.path.join(bd, 'prt')

    def flush():
        if cur:
            i = 'c%02d' % len(cb)
            p = os.path.join(wd, 'cbatches', i + '.txt')
            os.makedirs(os.path.dirname(p), exist_ok=True)
            open(p, 'w').write(''.join(a['line'] + '\n' for a in cur))
            cb.append(dict(id=i, list=p, n=len(cur), chars=sum(a['sz'] for a in cur),
                           syms=sorted({(S.get(a['acc']) or {}).get('sym') or '?' for a in cur}),
                           big=[a['line'] for a in cur if a['sz'] > 300000],
                           fields={a['acc']: a['fields'] for a in cur}))
    for a, d in disp.items():
        fp = os.path.join(prt, d['line'])
        sz = os.path.getsize(fp) if os.path.exists(fp) else 0
        if cur and (size + sz > 350000 or sz > 300000 or size > 300000):
            flush()
            cur, size = [], 0
        cur.append(dict(acc=a, sz=sz, **d))
        size += sz
    flush()
    json.dump(cb, open(os.path.join(wd, 'cbatches.json'), 'w'), ensure_ascii=False)

    P = sumy.append
    P('גל 2 — השוואת הקוראים (%s). הודעות ברשימות: %d' % (wave, len(want)))
    for who in ('A', 'B', 'C'):
        got = set(R[who]) & set(want)
        extra = set(R[who]) - set(want)
        P('קורא %s: %d שורות · חסרות %d · עודפות %d · פגומות/כפולות %d' % (
            who, len(R[who]), len(set(want) - got) if who != 'C' else len(disp), len(extra), len(BAD[who])))
        if BAD[who]:
            P('  פגומות: ' + ', '.join(BAD[who][:20]))
        if who in ('A', 'B') and set(want) - got:
            P('  חסרות: ' + ', '.join(sorted(set(want) - got)[:40]))
    P('')
    P('הסכמה A מול B לכל שדה (מתוך הודעות ששניהם קראו):')
    for f in CAT + ('pe',) + EPS + MONEY + PS + SHARES:
        if tot[f]:
            P('  %-11s %4d/%-4d  %5.1f%%' % (f, agree[f], tot[f], 100.0 * agree[f] / tot[f]))
    if notes:
        P('  הערות: ' + ', '.join('%s=%d' % kv for kv in sorted(notes.items())))
    P('')
    P('מחלוקות בשדות החמים (%s / %s): %d הודעות (ממתינות לקורא C: %d)' % (
        ','.join(HOT_CAT), ','.join(HOT_NUM), sum(1 for r in out if r['dis']), len(disp)))
    fc = collections.Counter(f for r in out for f in r['dis'])
    P('  לפי שדה: ' + ', '.join('%s=%d' % kv for kv in fc.most_common()))
    split = [r for r in out if any(v == 'SPLIT' for v in r['cons'].values())]
    P('  ללא הכרעה גם אחרי C (SPLIT): %d' % sum(1 for r in split if 'C' in r['readers']))

    # מטריצות בלבול: הקונצנזוס מול המסווג
    def cm(title, rows, fx, fy):
        c = collections.Counter((fx(r), fy(r)) for r in rows)
        xs = sorted({k[0] for k in c}, key=str)
        ys = sorted({k[1] for k in c}, key=str)
        P(title)
        P('  %-12s' % 'קוראים\\מערכת' + ''.join('%9s' % str(y) for y in ys))
        for x in xs:
            P('  %-12s' % str(x) + ''.join('%9d' % c[(x, y)] for y in ys))

    have = [r for r in out if r['cons'] and r.get('sys_c')]
    P('')
    P('מטריצות בלבול — הקונצנזוס של הקוראים מול secsbc.classify (sys_c = 2 הנספחים שהשרת קורא; sys_all = כל הנספחים)')
    cm('er (הודעת תוצאות):', have, lambda r: r['cons'].get('er'), lambda r: r['sys_c'].get('er'))
    er = [r for r in have if r['cons'].get('er') is True]
    cm('ex (כפי שנקרא: True / False / partial / None) — בהודעות תוצאות:', er, lambda r: r['cons'].get('ex'), lambda r: r['sys_c'].get('ex'))
    cm('pol (מוציא? בלי רווח מותאם = False) — בהודעות תוצאות:', er, lambda r: r['cons'].get('pol'), lambda r: r['sys_c'].get('ex'))
    cm('pol — בהודעות תוצאות, כל הנספחים:', er, lambda r: r['cons'].get('pol'), lambda r: (r.get('sys_all') or {}).get('ex'))
    pk = [r for r in er if r.get('picked')]
    cm('pol — רק ההודעות שהשרת בוחר (picked):', pk, lambda r: r['cons'].get('pol'), lambda r: r['sys_c'].get('ex'))
    cm('fut — בהודעות תוצאות:', er, lambda r: r['cons'].get('fut'), lambda r: r['sys_c'].get('fut'))
    P('')
    P('אי־התאמות pol (קונצנזוס מול sys_c), הודעות תוצאות:')
    for r in er:
        ce, se = r['cons'].get('ex'), r['sys_c'].get('ex')
        cb = r['cons'].get('pol')
        if cb in (True, False) and cb != se:
            P('  %-6s %s %s picked=%s cons=%s sys=%s h=%s' % (r['sym'], r['acc'], r['filed'], r.get('picked'), ce, se, r['sys_c'].get('h')))
    P('אי־התאמות er:')
    for r in have:
        if r['cons'].get('er') in (True, False) and r['cons'].get('er') != r['sys_c'].get('er'):
            P('  %-6s %s %s picked=%s cons=%s sys=%s' % (r['sym'], r['acc'], r['filed'], r.get('picked'), r['cons'].get('er'), r['sys_c'].get('er')))
    P('לא ברור (pol=None בקונצנזוס) בהודעות תוצאות: ' + ', '.join('%s:%s' % (r['sym'], r['acc']) for r in er if r['cons'].get('pol') is None))
    P('חלקי (partial): ' + ', '.join('%s:%s' % (r['sym'], r['acc']) for r in er if r['cons'].get('ex') == 'partial'))
    P('שינוי מדיניות (chg≠none): ' + ', '.join('%s:%s:%s' % (r['sym'], r['acc'], r['cons'].get('chg')) for r in have if r['cons'].get('chg') not in (None, 'none')))
    open(os.path.join(wd, 'cmp.sum.txt'), 'w').write('\n'.join(sumy) + '\n')
    print('\n'.join(sumy[:40]))


if __name__ == '__main__':
    main()
