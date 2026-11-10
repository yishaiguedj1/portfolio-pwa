"""דגלי ניסוי (02/11/2026, תוכנית איכות התרגום — PR1 1.8).

עבודה מקבלת דגלים מ־spec.xf (רק מ־goldRun עם arms, מנהל בלבד — השרתון מסנן ב־normXf). הדגלים בעבודה =
XF_DEFAULT ∪ spec.xf, ו־'-שם' מכבה דגל שכבר הופעל כברירת מחדל. ההפעלה של דגל לכולם = PR קטן שמוסיף אותו ל־XF_DEFAULT.
**XF_KEYS זהה ל־XF_KEYS ב־ibkr-proxy/lib/studio.js** (tests/quality-xf.test.js משווה).
מתגי סביבה (SNB_*) לא משמשים ל־A/B — הם חלים על כל העבודות. מתג שהמחקר מציע ל־A/B נקרא גם מכאן (למשל rvs60 = SNB_RV_SLICE 60),
וברירת המחדל נשארת מהסביבה.
"""
from __future__ import annotations

XF_KEYS = ('smf', 'gq', 'qskip', 'rvs60', 'vwin')   # PR 1.6: v… = דגלי הניתוח (vwin — חלון מיפוי של VI_WIN_TOK_X טוקנים)
XF_DEFAULT: frozenset = frozenset()


def flags(spec) -> frozenset:
    """הדגלים הפעילים בעבודה — XF_DEFAULT ∪ spec.xf, פחות '-שם'. דגל לא מוכר — נזרק"""
    on, off = set(XF_DEFAULT), set()
    xf = spec.get('xf') if isinstance(spec, dict) else None
    for f in xf if isinstance(xf, list) else []:
        f = str(f)
        name = f[1:] if f.startswith('-') else f
        if name in XF_KEYS:
            (off if f.startswith('-') else on).add(name)
    return frozenset(on - off)


def on(st, name: str) -> bool:
    """st = מצב העבודה (ctx.st) או spec — האם הדגל פעיל"""
    st = st if isinstance(st, dict) else {}
    spec = st.get('spec') if isinstance(st.get('spec'), dict) else st
    return name in flags(spec)
