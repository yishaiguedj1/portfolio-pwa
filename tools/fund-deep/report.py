#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""בדיקת העומק של מנתח החברות (docs/fund-deep-audit.md) — הדוחות: לכל חברה ולגל כולו.

  python3 -I tools/fund-deep/report.py --w <scratch>/w1 [--syms AAPL,MSFT]

קלט (מ־verify.py): out/<SYM>.json — ערכי הבסיס והוורדיקטים; out/<SYM>.der.json — נגזרים, צמיחה, מחירים, מכפילים;
out/<SYM>.meta.json — הפיצולים.
פלט: report/<SYM>.md לכל חברה, report/_wave.md (טבלה לכל חברה + הפערים לפי מדד על פני החברות), report/_wave.json.
הכל נתונים ציבוריים של חברות (SEC/Nasdaq) — בלי שום מידע של משתמש.
"""
import argparse
import collections
import glob
import json
import os

OK_V = ('V3', 'V2', 'V1')                 # שווה לערך המודפס האחרון (+ אישורים)
OK_D = ('DER', 'DERCF', 'DERX', 'CX0')    # נגזר ממספרים מודפסים (מצטבר, רבעון רביעי) ושווה; CX0 = אין השקעות הוניות בדוח
EMPTY = ('NONE',)                         # אין ערך אצלנו ואין במקורות — אין מה להציג
SOFT = ('NOFACE', 'ALTCF', 'ALT', 'PUB')  # לא בדוחות עצמם / שורה אחרת / פורסם בהודעה לעיתונות — לאימות נוסף
BAD = ('DIFF', 'MISS', 'EXTRA', 'OLD')    # טעות או חוסר — כל אחד עד השורש
MONEY_PS = ('eps', 'dps')
SHARES = ('sh',)
NAMES = {
    'rev': 'הכנסות', 'gp': 'רווח גולמי', 'cogs': 'עלות המכר', 'op': 'רווח תפעולי', 'ni': 'רווח נקי', 'eps': 'רווח למניה',
    'sh': 'מניות (מדולל)', 'ocf': 'תזרים מפעילות', 'capex': 'השקעות הוניות', 'sbc': 'תגמול במניות', 'dep': 'פחת והפחתות',
    'int': 'הוצאות מימון', 'cash': 'מזומן', 'msec': 'ניירות ערך סחירים', 'debt': 'חוב', 'eq': 'הון עצמי', 'ta': 'סך נכסים',
    'tl': 'סך התחייבויות', 'ca': 'נכסים שוטפים', 'cl': 'התחייבויות שוטפות', 're': 'עודפים', 'ppe': 'רכוש קבוע', 'dps': 'דיבידנד למניה',
    'divp': 'דיבידנד ששולם', 'buy': 'רכישה עצמית', 'pretax': 'רווח לפני מס', 'tax': 'מס', 'netcash': 'מזומן נטו', 'roic': 'ROIC',
    'roe': 'ROE', 'cashT': 'מזומן וני״ע', 'ebitda': 'EBITDA', 'ffo': 'FFO', 'de': 'חוב/הון', 'fcf': 'תזרים חופשי', 'cov': 'כיסוי ריבית',
    'pe': 'מכפיל רווח', 'pfcf': 'מכפיל תזרים', 'pofcf': 'מכפיל תזרים בניכוי תגמול', 'ps': 'מכפיל מכירות', 'evebit': 'EV/EBIT',
    'pb': 'מכפיל הון', 'pffo': 'מכפיל FFO',
}


def fmt(k, v):
    if v is None:
        return '—'
    if isinstance(v, str):
        return v
    if k in MONEY_PS:
        return '%.2f' % v
    if k in SHARES:
        return '%.1fM' % (v / 1e6)
    if abs(v) >= 1e5:
        return '{:,.1f}M'.format(v / 1e6)
    if abs(v) < 5:
        return '%.4f' % v
    return '%.2f' % v


def pct(v):
    return '—' if v is None else '%.2f%%' % (v * 100)


def esc(s):
    return str(s if s is not None else '').replace('|', '\\|').replace('\n', ' ')


def load(w, sym):
    p = os.path.join(w, 'out', sym)
    raw = json.load(open(p + '.json', encoding='utf-8'))
    der = json.load(open(p + '.der.json', encoding='utf-8')) if os.path.exists(p + '.der.json') else []
    meta = json.load(open(p + '.meta.json', encoding='utf-8')) if os.path.exists(p + '.meta.json') else {}
    return raw, der, meta


def summary(raw, der):
    c = collections.Counter(x['verdict'] for x in raw)
    L = collections.Counter(x['layer'] if x['layer'] != 'growth' else 'growth:' + x.get('cls', '') for x in der)
    n = len(raw)
    ok = sum(c[v] for v in OK_V + OK_D + EMPTY)
    return dict(n=n, ok=ok, okp=ok / n if n else 0, v=dict(c), layers=dict(L),
                bad=sum(c[v] for v in BAD), soft=sum(c[v] for v in SOFT))


def company_md(sym, raw, der, meta):
    s = summary(raw, der)
    out = ['# %s — בדיקת העומק' % sym, '']
    out.append('ערכי בסיס: **%d** · מאומתים או נגזרים־מאומתים: **%d (%.1f%%)** · פערים: **%d** · הגדרה/לא בדוחות: **%d**' %
               (s['n'], s['ok'], s['okp'] * 100, s['bad'], s['soft']))
    out.append('')
    out.append('ורדיקטים: ' + ' · '.join('%s=%d' % (k, v) for k, v in sorted(s['v'].items())))
    if s['layers']:
        out.append('')
        out.append('שכבות נגזרות: ' + ' · '.join('%s=%d' % (k, v) for k, v in sorted(s['layers'].items())))
    if meta.get('splits') is not None:
        out.append('')
        out.append('פיצולים לפי SEC (אותה תקופה בשתי הגשות): %s · לפי השרתון: %s' % (
            ', '.join('×%g (%s–%s)' % (x[2], x[0], x[1]) for x in meta.get('splits') or []) or 'אין',
            ', '.join('%s ×%g' % (x[0], x[1]) for x in meta.get('snap_splits') or []) or 'אין'))
    # פערים בערכי הבסיס
    bad = [x for x in raw if x['verdict'] in BAD + SOFT]
    if bad:
        out += ['', '## ערכי בסיס — פערים ושאלות הגדרה', '', '| ורדיקט | מדד | תצוגה | סוף תקופה | שלנו | צפוי | שורה בדוח | למה |', '|---|---|---|---|---|---|---|---|']
        order = {v: i for i, v in enumerate(BAD + SOFT)}
        for x in sorted(bad, key=lambda x: (order[x['verdict']], x['m'], x['mode'], x['end'])):
            out.append('| %s | %s | %s | %s | %s | %s | %s | %s |' % (
                x['verdict'], NAMES.get(x['m'], x['m']), x['mode'], x['end'], fmt(x['m'], x['ours']), fmt(x['m'], x.get('exp')),
                esc(x.get('line')), esc(x.get('why'))[:160]))
    # נגזרים שהמסך מציג אחרת מהאמת
    imp = [x for x in der if x['layer'] == 'impact']
    if imp:
        out += ['', '## נגזרים — מה שהמסך מציג אחרת מהאמת (בעיגול של המסך)', '']
        by = collections.defaultdict(list)
        for x in imp:
            by[x['k']].append(x)
        for k, xs in sorted(by.items(), key=lambda kv: -len(kv[1])):
            ex = ', '.join('%s %s: %s→%s' % (x['mode'], x['per'], fmt(k, x['screen']), fmt(k, x['truth'])) for x in xs[:6])
            out.append('- **%s** (%d): %s%s' % (NAMES.get(k, k), len(xs), ex, ' …' if len(xs) > 6 else ''))
    form = [x for x in der if x['layer'] in ('formula', 'mformula')]
    out += ['', '## נוסחאות — המימוש העצמאי מול המסך על אותו קלט', '',
            'אי־התאמות: **%d**%s' % (len(form), '' if not form else ' — ' + ', '.join('%s %s' % (x.get('k'), x.get('per') or x.get('ym')) for x in form[:10]))]
    gr = [x for x in der if x['layer'] == 'growth']
    if gr:
        out += ['', '## צמיחה שנה מול שנה', '', '| סוג | תצוגה | תקופה | מדד | במסך | אמת | מקור האמת |', '|---|---|---|---|---|---|---|']
        for x in gr:
            out.append('| %s | %s | %s (%s) | %s | %s | %s | %s |' % (x['cls'], x['mode'], x['per'], x['end'], NAMES.get(x['k'], x['k']),
                                                                 pct(x['screen']), pct(x['truth']), esc(x['src'])))
    px = [x for x in der if x['layer'] == 'px']
    out += ['', '## מחירים חודשיים מול Nasdaq', '', 'פערים: **%d**' % len(px)]
    for x in px[:12]:
        out.append('- %s' % (x.get('err') or '%s: במסך %s · Nasdaq %s' % (x['ym'], fmt('eps', x['screen']), fmt('eps', x['nasdaq']))))
    mi = [x for x in der if x['layer'] == 'mimpact']
    if mi:
        out += ['', '## היסטוריית המכפילים — השפעת הפערים (ערכי אמת + מחירי Nasdaq)', '']
        by = collections.defaultdict(list)
        for x in mi:
            by[x['k']].append(x)
        for k, xs in sorted(by.items(), key=lambda kv: -len(kv[1])):
            dd = [abs((x['screen'] or 0) - (x['truth'] or 0)) for x in xs if x['screen'] is not None and x['truth'] is not None]
            out.append('- **%s**: %d חודשים (%s–%s), פער טיפוסי %s, מרבי %s' % (
                NAMES.get(k, k), len(xs), xs[0]['ym'], xs[-1]['ym'], '%.2f' % sorted(dd)[len(dd) // 2] if dd else '—', '%.2f' % max(dd) if dd else '—'))
    df = [x for x in der if x['layer'] == 'def']
    if df:
        out += ['', '## הגדרות (לא טעות — לבדיקה)', '']
        for x in df:
            if x['k'] == 'fx_mix':
                out.append('- **ערבוב מטבעות**: %s — מכפיל הרווח במסך %s; אחרי המרה בשער ECB (%s %s לדולר, בלי יחס ADR): %s' % (
                    x['note'], '%.2f' % x['screen'], '%.4f' % x['rate'] if x.get('rate') else '—', x['cur'],
                    '%.2f' % x['fixed'] if x.get('fixed') else 'אין שער'))
            if x['k'] == 'mcap_shares':
                out.append('- שווי שוק: המסך מכפיל ב־%s מניות (ממוצע מדולל של הרבעון האחרון); בעמוד השער %s מניות בפועל (%s) — הפרש %s' % (
                    fmt('sh', x['screen']), fmt('sh', x['cover']), x['cover_date'], pct(x['diff'])))
    return '\n'.join(out) + '\n', s


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--w', required=True)
    ap.add_argument('--syms', default='')
    o = ap.parse_args()
    syms = [x for x in o.syms.split(',') if x] or sorted(os.path.basename(p)[:-5] for p in glob.glob(os.path.join(o.w, 'out', '*.json'))
                                                        if not p.endswith(('.der.json', '.meta.json')))
    rd = os.path.join(o.w, 'report')
    os.makedirs(rd, exist_ok=True)
    rows, cross, allj = [], collections.defaultdict(lambda: collections.defaultdict(list)), {}
    impx = collections.defaultdict(lambda: collections.Counter())
    for sym in syms:
        try:
            raw, der, meta = load(o.w, sym)
        except FileNotFoundError:
            continue
        md, s = company_md(sym, raw, der, meta)
        open(os.path.join(rd, sym + '.md'), 'w', encoding='utf-8').write(md)
        allj[sym] = s
        L = s['layers']
        rows.append('| %s | %d | %.1f%% | %d | %d | %d | %d | %d | %d | %d | %d | %d | %d |' % (
            sym, s['n'], s['okp'] * 100, s['v'].get('DIFF', 0), s['v'].get('MISS', 0), s['v'].get('EXTRA', 0), s['v'].get('OLD', 0),
            s['soft'], L.get('impact', 0), sum(v for k, v in L.items() if k.startswith('growth')), L.get('px', 0),
            L.get('formula', 0) + L.get('mformula', 0), L.get('mimpact', 0)))
        for x in raw:
            if x['verdict'] in BAD + SOFT:
                cross[(x['verdict'], x['m'])][sym].append(x)
        for x in der:
            if x['layer'] in ('impact', 'mimpact'):
                impx[x['k']][sym] += 1
    W = ['# גל — סיכום', '', 'חברות: **%d** · ערכי בסיס: **%d** · מאומתים/נגזרים־מאומתים: **%d** · פערים: **%d** · הגדרה: **%d**' % (
        len(allj), sum(s['n'] for s in allj.values()), sum(s['ok'] for s in allj.values()), sum(s['bad'] for s in allj.values()),
        sum(s['soft'] for s in allj.values())), '',
        '| חברה | ערכים | מאומת | DIFF | MISS | EXTRA | OLD | הגדרה | נגזר שגוי | צמיחה | מחיר | נוסחה | מכפיל |',
        '|---|---|---|---|---|---|---|---|---|---|---|---|---|'] + rows
    W += ['', '## פערים לפי מדד על פני החברות (שורש משותף = אותו מדד באותו ורדיקט בהרבה חברות)', '',
          '| ורדיקט | מדד | חברות | ערכים | דוגמאות |', '|---|---|---|---|---|']
    for (v, m), by in sorted(cross.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        ex = '; '.join('%s %s %s: %s→%s' % (sym, xs[0]['mode'], xs[0]['end'], fmt(m, xs[0]['ours']), fmt(m, xs[0].get('exp'))) for sym, xs in list(by.items())[:3])
        W.append('| %s | %s | %d | %d | %s |' % (v, NAMES.get(m, m), len(by), sum(len(xs) for xs in by.values()), esc(ex)))
    W += ['', '## נגזרים ומכפילים שגויים במסך — לפי מדד', '', '| מדד | חברות | ערכים |', '|---|---|---|']
    for k, c in sorted(impx.items(), key=lambda kv: -sum(kv[1].values())):
        W.append('| %s | %d | %d |' % (NAMES.get(k, k), len(c), sum(c.values())))
    open(os.path.join(rd, '_wave.md'), 'w', encoding='utf-8').write('\n'.join(W) + '\n')
    json.dump(allj, open(os.path.join(rd, '_wave.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('דוחות: %d חברות → %s' % (len(allj), rd))


if __name__ == '__main__':
    main()
