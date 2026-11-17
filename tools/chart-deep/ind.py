#!/usr/bin/env python3
"""
ind.py — גל 5 של בדיקת העומק של גרף הנרות (docs/chart-deep-audit.md, סעיף 7):
אימות בלתי תלוי של כל המחוונים והטרנספורמציות שהגרף יכול להציג.

שימוש
  python3 tools/chart-deep/ind.py --selftest
      בדיקה עצמית: דוגמאות קטנות שחושבו ביד (assert). בלי נתונים ובלי node.
  python3 tools/chart-deep/ind.py --out <תיקייה> --data <תיקיית disp> [--sym AAPL] [--tfs 1D,5m] [--bench SPY]
      1. מחשב את ערכי המוצר: chartlib.js (IND/CALC, העזרים, הטרנספורמציות) ו־KLineChart 10.1 (המחוונים
         המובנים) — דרך node ו־vm, עותק בזיכרון בלבד, בלי לשנות אף קובץ.
      2. מחשב כאן את ההגדרה המקובלת של כל מחוון, ואת החלופות המוכרות (מוסכמות אחרות).
      3. משווה אחרי תקופת חימום, ופוסק לכל מחוון: זהה / אתחול בלבד / הגדרה שונה (איזו) / לא תואם.
      הפלט (מחירים ציבוריים — בסקראצ'פד, לא בריפו): prod-<סמל>-<מרווח>.json, cmp-<סמל>-<מרווח>.json, summary.md.

עקרון העבודה
  כל מחוון כאן נכתב מההגדרה המקובלת (ספרות והגדרות ציבוריות) לפני קריאת המימוש ב־JS.
  "מקובל" = הגרסה הראשונה ברשימת הגרסאות של כל מחוון (VARIANTS); אחריה חלופות מוכרות, כדי שההשוואה
  תאמר לא רק "שונה" אלא "שונה — כמו מוסכמה X". גרסה שמסומנת "שחזור" נוספה רק אחרי שנמצא הפרש
  ונקרא הקוד — כדי לאשר את השורש, לא כהגדרה.
  "מוצר הייחוס" = מוצר הייחוס של ת־גרף (docs/standards.md); השם לא נכתב כאן.

סימונים: i = אינדקס הנר, n = אורך, C/O/H/L/V = סגירה/פתיחה/גבוה/נמוך/נפח, X₋₁ = הערך בנר הקודם,
HH(n)/LL(n) = הגבוה/הנמוך של n הנרות האחרונים כולל הנוכחי, hl2=(H+L)/2, hlc3=(H+L+C)/3.

עזרים
  SMA(x,n)   ממוצע פשוט של n הערכים האחרונים כולל הנוכחי; ריק עד שיש n ערכים רצופים.
  EMA(x,n)   α=2/(n+1). אתחול מקובל: הערך הראשון = ממוצע פשוט של n הערכים הראשונים (ריק לפני כן).
             חלופה: אתחול מהערך הראשון. במוצר הייחוס הפונקציה המובנית מתחילה אחרי n נרות (אתחול בממוצע פשוט).
  RMA(x,n)   החלקת Wilder ‏(SMMA): α=1/n, אתחול בממוצע פשוט של n הראשונים — כך אצל Wilder וכך במוצר הייחוס.
  WMA(x,n)   משקלים 1..n (לנוכחי n), חלוקה ב־n(n+1)/2.
  STDEV      סטיית תקן של האוכלוסייה (חלוקה ב־n) — כמו אצל בולינגר; ברירת המחדל גם במוצר הייחוס.
  TR         max(H−L, |H−C₋₁|, |L−C₋₁|); בנר הראשון H−L.
  ATR(n)     RMA(TR,n) — Wilder; ה־H−L של הנר הראשון נכנס לממוצע הפתיחה (כמו במוצר הייחוס).
  RSI(n)     Wilder: שינויי סגירה מנר 1; ממוצעי רווח/הפסד ב־RMA (פתיחה בממוצע פשוט של n השינויים הראשונים);
             RSI=100−100/(1+רווח/הפסד); הפסד ממוצע 0 → 100. חלופה ידועה: RSI של Cutler (סכומים פשוטים).
  LINREG     ריבועים פחותים על n הערכים האחרונים; הערך בקצה (הנר הנוכחי).

המחוונים שלנו (IND ב־chartlib.js; הפרמטרים — ברירות המחדל שבמוצר)
  VWAP(1,2)        מעוגן למושב: Σ(hlc3·V)/ΣV מתחילת היום (בשעון הבורסה). רצועות ±k·σ, ‏σ = סטיית התקן
                   המשוקללת בנפח (אוכלוסייה) של hlc3 סביב ה־VWAP. בגרף יומי עיגון "מושב" = כל נר לעצמו
                   (VWAP=hlc3) — כך במוצר הייחוס (עיגון מושב); חלופות: שבוע/חודש/שנה/מצטבר.
  WMA(20)          כמו בעזרים.
  HMA(21)          WMA(2·WMA(n/2) − WMA(n), √n); ‏n/2 מעוגל למטה; במוצר הייחוס √n מעוגל (round) — 5 ל־21;
                   במקור של Hull השורש נחתך (4). שתי הגרסאות נבדקות.
  DEMA(21)         2·EMA − EMA(EMA).          TEMA(21)  3·EMA − 3·EMA(EMA) + EMA(EMA(EMA)).
  VWMA(20)         Σ(C·V)/ΣV על n נרות.
  RIBBON           EMA של 8,13,21,34,55,89.
  SUPERTREND(10,3) hl2 ± 3·ATR(10) (RMA); רצועות "סופיות" בנעילה (העליונה רק יורדת כל עוד C₋₁ מתחתיה, התחתונה
                   רק עולה כל עוד C₋₁ מעליה); מגמה מתהפכת כש־C חוצה את הרצועה הפעילה. כיוון התחלתי: ירידה
                   (כמו במוצר הייחוס). up = הרצועה התחתונה במגמת עלייה, dn = העליונה במגמת ירידה.
  ICHIMOKU(9,26,52) טנקן=(HH9+LL9)/2, קיג'ון=(HH26+LL26)/2, ‏Span A=(טנקן+קיג'ון)/2, ‏Span B=(HH52+LL52)/2 — שני
                   ה־Span מוזזים קדימה, צ'יקו = C מוזז אחורה. מקובל בספרות: הזזה 26; במוצר הייחוס ההזזה בפועל
                   היא 25 (displacement−1, הנר הנוכחי נספר כראשון). שתי הגרסאות נבדקות.
  KELTNER(20,2)    EMA20(C) ± 2·ATR(10) — הגרסה המודרנית המקובלת (וברירת המחדל במוצר הייחוס: ATR באורך 10).
                   חלופה: ATR באורך n (20).
  DONCHIAN(20)     HH20 / LL20 כולל הנר הנוכחי, ואמצע. ENVELOPE(20,2.5) ‏SMA20 × (1 ± 2.5%).
  ALLIGATOR(13,8,5) RMA(hl2) באורכים 13/8/5, מוזזים קדימה 8/5/3 (ההגדרה של Bill Williams).
  CHANDELIER(22,3) ארוך: HH22 − 3·ATR22; קצר: LL22 + 3·ATR22 (ההגדרה המקורית, בלי נעילה). חלופה: עם נעילה (ratchet).
  PIVOTS(0)        נקודות ציר מהתקופה הקודמת: תוך־יומי — היום הקודם; יומי — החודש הקודם (כמו "אוטומטי" במוצר
                   הייחוס). סוגים: מסורתי (R3=H+2(P−L)), קלאסי (R3=P+2(H−L)), פיבונאצ'י, קמרילה, וודי.
  LINREG(100,2)    ערוץ רגרסיה: קו ריבועים פחותים על 100 הנרות האחרונים ± 2σ של השאריות. במוצר הייחוס הערוץ
                   מצויר רק על 100 הנרות האחרונים ו־σ מחולק ב־(n−1). חלופות: ערוץ מתגלגל (ערך קצה בכל נר),
                   σ באוכלוסייה, σ של המחיר.
  ZIGZAG(5)        נקודות מפנה על H/L: היפוך כשהמחיר זז 5% נגד הקיצון האחרון (מהשיא: L ≤ H·0.95; מהשפל:
                   H ≥ L·1.05); הרגל האחרונה לא מאושרת (מסתיימת בקיצון הנוכחי).
  ATR(14)          כמו בעזרים.
  ADX(14)          Wilder: ‏+DM=H−H₋₁ אם גדול מ־L₋₁−L ומאפס; ‏−DM בהתאמה; ‏DI=100·RMA(DM)/RMA(TR) (מנר 1);
                   DX=100·|+DI−−DI|/(+DI+−DI); ‏ADX=RMA(DX,14) — כמו במוצר הייחוס (14/14).
  STOCH(14,3,3)    ‏%K גולמי = 100·(C−LL14)/(HH14−LL14); ‏%K=SMA3; ‏%D=SMA3(%K) ("סטוכסטי איטי" של Lane).
                   במוצר הייחוס ברירת המחדל 14/1/3.
  STOCHRSI(14,14,3,3) סטוכסטי על RSI(14) של Wilder בחלון 14; ‏K=SMA3, ‏D=SMA3(K) — כמו במוצר הייחוס.
  MFI(14)          זרם כספי = hlc3·V; חיובי כש־hlc3 עולה, שלילי כשיורד; ‏MFI=100−100/(1+Σחיובי/Σשלילי); שלילי 0 → 100.
  CMF(20)          Σ(CLV·V)/ΣV, ‏CLV=((C−L)−(H−C))/(H−L), ‏0 כש־H=L.
  AROON(25)        חלון של n+1 נרות (כולל הנוכחי): Up=100·(n − נרות מאז השיא)/n; שוויון — השיא האחרון.
                   (במוצר הייחוס: highestbars על length+1.)
  CMO(9)           ‏100·(Σרווח−Σהפסד)/(Σרווח+Σהפסד) על 9 שינויים (Chande).
  ULTOSC(7,14,28)  BP=C−min(L,C₋₁), ‏TR=max(H,C₋₁)−min(L,C₋₁); ‏UO=100·(4·A7+2·A14+A28)/7, ‏Ak=ΣBP/ΣTR.
  TSI(25,13,13)    ‏100·EMA13(EMA25(ΔC))/EMA13(EMA25(|ΔC|)); אות = EMA13(TSI).
  COPPOCK(10,14,11) WMA10(ROC14 + ROC11), ‏ROC באחוזים.
  FISHER(9)        Ehlers: ‏x=0.66·((hl2−LL)/(HH−LL)−0.5)+0.67·x₋₁ (HH/LL של hl2 על 9), חסימה ±0.999,
                   ‏F=0.5·ln((1+x)/(1−x))+0.5·F₋₁; טריגר = F₋₁ — כמו במוצר הייחוס.
  CHOP(14)         ‏100·log10(ΣTR14/(HH14−LL14))/log10(14).
  HV(20,252)       ‏100·σ(ln(C/C₋₁),20)·√252, ‏σ מדגמית (n−1) — המקובל בפיננסים. במוצר הייחוס: σ אוכלוסייה ו־365.
  SQUEEZE(20,2,1.5) BB(SMA20 ± 2σ) בתוך KC(‏SMA20 ± 1.5·SMA20(TR)) = "סחיטה"; מומנטום = LINREG20 של
                   C − ((HH20+LL20)/2 + SMA20)/2. חלופה: KC על EMA ו־ATR.
  ELDER(13)        Bull=H−EMA13, ‏Bear=L−EMA13.
  VORTEX(14)       ‏VI+=Σ|H−L₋₁|/ΣTR, ‏VI−=Σ|L−H₋₁|/ΣTR על 14 (מנר 1).
  PPO(12,26,9)     ‏100·(EMA12−EMA26)/EMA26; אות EMA9; היסטוגרמה = PPO − אות.
  DPO(20)          ההגדרה הקלאסית (ממורכז): C − SMA20 מוזז k=n/2+1=11 נרות קדימה (בנר j: ‏C_j − SMA_{j+11}).
                   במוצר הייחוס (ברירת מחדל לא ממורכז): C − SMA20₋₁₁. שתיהן נבדקות.
  KST              ‏Pring: ‏ROC 10/15/20/30, ‏SMA 10/10/10/15, משקלים 1..4; אות SMA9.
  MASS(25)         Σ25 של EMA9(H−L)/EMA9(EMA9(H−L)).
  BOP(14)          ‏SMA14((C−O)/(H−L)); ‏0 כש־H=L.   AD  Σ(CLV·V) מצטבר מהנר הראשון.
  CHAIKIN(3,10)    ‏EMA3(AD) − EMA10(AD).     FORCE(13)  EMA13((C−C₋₁)·V).
  RVOL(20)         ‏V / ממוצע הנפח של 20 הנרות הקודמים (בלי הנוכחי). חלופה: כולל הנוכחי.
  ZSCORE(20)       ‏(C−SMA20)/σ20 (אוכלוסייה).
  RS(50)           ‏C / C של מדד הייחוס באותו זמן; ‏MA=SMA50. חלופות: ×100, מנורמל לנר הראשון.

המחוונים המובנים של KLineChart 10.1 (BUILTIN ב־chart.js; ברירות המחדל של הספרייה)
  מערביים — לפי ההגדרה המערבית המקובלת:
  MA/EMA            ממוצעים (EMA באתחול ממוצע פשוט).   BOLL(20,2)  SMA20 ± 2σ אוכלוסייה.
  SAR(2,2,20)       Wilder: ‏SAR₊₁=SAR+AF·(EP−SAR), ‏EP עד הנר הקודם (בלי הצצה קדימה), חסימה בשני הנמוכים/
                    הגבוהים הקודמים, היפוך כשהמחיר חוצה; ‏AF 0.02→0.2 בצעדי 0.02, מתאפס ל־0.02 בכל היפוך.
                    אתחול כמו במוצר הייחוס (נר 1: C₁>C₀ → עלייה, SAR=L₀, EP=H₁).
  MACD(12,26,9)     DIF=EMA12−EMA26, ‏DEA=EMA9(DIF), היסטוגרמה = DIF−DEA (כמו במוצר הייחוס).
                    חלופה ידועה (המוסכמה הסינית): היסטוגרמה = 2·(DIF−DEA).
  RSI(6,12,24)      Wilder (כנ"ל). חלופה: Cutler (סכומים פשוטים). מקובל: אורך 14.
  OBV(30)           מצטבר: ±V לפי כיוון הסגירה, 0 בנר הראשון; ‏MAOBV=SMA30.
  CCI(20)           ‏(hlc3−SMA20)/(0.015·סטייה ממוצעת מוחלטת).
  WR(6,10,14)       ‏Williams %R: ‏−100·(HH−C)/(HH−LL) (טווח −100..0, כמו במוצר הייחוס). חלופה סינית: 0..100.
  AO(5,34)          SMA5(hl2) − SMA34(hl2).
  TRIX(12,9)        ‏100·שינוי יחסי של EMA(EMA(EMA(C))); ‏MATRIX=SMA9.
  ROC(12,6) / MTM(12,6)  ‏100·(C/C₋₁₂−1) / ‏C−C₋₁₂, עם SMA6.
  DMI(14,6)         שתי מוסכמות: סינית (DI מסכומים פשוטים של 14, ‏ADX=SMA6(DX), ‏ADXR=(ADX+ADX₋₆)/2) —
                    המקובלת לפרמטרים האלה; ו־Wilder ‏(RMA) — כמו במוצר הייחוס (14/14).
  מוסכמה סינית (אין להם הגדרה מערבית) — לפי הנוסחאות הציבוריות של תוכנות המסחר הסיניות:
  SMA(12,2)         ‏Y=(M·X+(N−M)·Y₋₁)/N, ‏Y₀=X₀.
  KDJ(9,3,3)        ‏RSV=100·(C−LL9)/(HH9−LL9) (טווח 0 → 0); ‏K=(2·K₋₁+RSV)/3, ‏D=(2·D₋₁+K)/3, ‏K₋₁=D₋₁=50; ‏J=3K−2D.
  BBI(3,6,12,24)    ממוצע ארבעת ה־MA.     BIAS(6,12,24)  ‏100·(C−MA)/MA.
  BRAR(26)          ‏AR=100·Σ(H−O)/Σ(O−L); ‏BR=100·Σmax(0,H−C₋₁)/Σmax(0,C₋₁−L).
  CR(26,10,20,40,60) ‏MID=(H₋₁+L₋₁)/2; ‏CR=100·Σmax(0,H−MID)/Σmax(0,MID−L); ‏MAk=SMA(CR,M) מוזז M/2.5+1 קדימה.
  DMA(10,50,10)     ‏DIF=MA10−MA50; ‏AMA=MA10(DIF).
  EMV(14,9)         ‏VOLR=MA(V,14)/V; ‏MID=100·(H+L−(H₋₁+L₋₁))/(H+L); ‏EMV=MA(MID·VOLR·(H−L)/MA(H−L,14),14); ‏MAEMV=MA9.
                    חלופה מערבית (Arms): ‏MA14(((H+L)/2−(H₋₁+L₋₁)/2)/((V/10⁸)/(H−L))).
  PSY(12,6)         ‏100·(מספר הנרות שנסגרו מעל הקודם ב־12)/12; ‏MAPSY=SMA6.
  PVT               ‏Σ((C−C₋₁)/C₋₁·V), ‏0 בנר הראשון.
  VR(26,6)          ‏100·(2·ΣV↑+ΣV=)/(2·ΣV↓+ΣV=); ‏MAVR=SMA6.
  AVP               מחיר ממוצע מצטבר: Σמחזור/Σנפח; בלי שדה מחזור — קירוב Σ(hlc3·V)/ΣV.
  VOL               הנפח עצמו (chart.js מוריד את שלושת הממוצעים).

טרנספורמציות (chart.js:172)
  Heikin-Ashi       ‏c=(O+H+L+C)/4; ‏o=(o₋₁+c₋₁)/2, בנר הראשון (O+C)/2 — כמו במוצר הייחוס; ‏h=max(H,o,c), ‏l=min(L,o,c).
  רנקו (תיבה)       מסורתי על סגירות: לבנה חדשה בכיוון כשהסגירה עוברת תיבה מעבר לקצה הלבנה האחרונה; היפוך רק
                    אחרי שתי תיבות (תיבה אחת מעבר לתחתית/ראש הלבנה האחרונה). הבסיס — הסגירה הראשונה. במוצר
                    הייחוס ברירת המחדל לגודל התיבה: ATR(14) (קבוע לכל הגרף). גודל התיבה של המוצר נמדד מהפלט.
  שבירת 3 קווים     על סגירות: קו חדש בכיוון כשהסגירה עוברת את קצה הקו האחרון; היפוך כשהסגירה שוברת את
                    הקיצון של 3 הקווים האחרונים; קו ההיפוך מתחיל מהקצה הנגדי של הקו האחרון.
  קאגי (4%)         על סגירות: קו ממשיך כל עוד המחיר בכיוונו; היפוך כשהמחיר זז 4% נגד הקיצון (מהשיא: ≤ שיא·0.96;
                    מהשפל: ≥ שפל·1.04). הקו הראשון נקבע כשהמחיר זז 4% מהסגירה הראשונה; חלופה (הבנייה הקלאסית):
                    הקו הראשון בכיוון השינוי הראשון, בכל גודל — סף ההיפוך חל רק על היפוכים. שתיהן נבדקות.

גרסאות "שחזור" (נוספו אחרי שנמצא הפרש ונקרא הקוד — מאשרות את השורש, לא הגדרה): HMA ‏(Math.round(n/2)),
ZIGZAG (שוויון → הנר המאוחר + קו רציף), FISHER (חסימה פשוטה), RS (מילוי מהקודם), ובמובנים של KLineChart:
SMA ‏(α=M/(N+1)), SAR, AVP, DMI, BRAR, EMV.
"""
import argparse
import json
import math
import os
import subprocess
import sys
from datetime import date, timedelta

try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

ROOT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))


# =====================================================================
# עזרים בסיסיים
# =====================================================================

def num(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def zipmap(f, *xs):
    """f על כל נר שבו כל הקלטים מוגדרים; f יכולה להחזיר None."""
    return [None if any(v is None for v in t) else f(*t) for t in zip(*xs)]


def shift(x, k):
    """k>0: הערך של k נרות קודם (מזיז את הסדרה קדימה בגרף). k<0: הערך של |k| נרות אחר כך."""
    n = len(x)
    return [x[i - k] if 0 <= i - k < n else None for i in range(n)]


def sma(x, n):
    n = int(n)
    out = [None] * len(x)
    run, s = 0, 0.0
    for i, v in enumerate(x):
        if v is None:
            run, s = 0, 0.0
            continue
        run += 1
        s += v
        if run > n:
            s -= x[i - n]
        if run >= n:
            if (run - n) % 256 == 0:   # ריענון נגד סחף של סכום רץ
                s = math.fsum(x[i - n + 1:i + 1])
            out[i] = s / n
    return out


def ema(x, n, seed='sma', alpha=None):
    """seed='sma' — ממוצע פשוט של n הערכים הראשונים; seed='first' — הערך הראשון."""
    a = 2.0 / (n + 1) if alpha is None else alpha
    out = [None] * len(x)
    prev, buf = None, []
    for i, v in enumerate(x):
        if v is None:
            continue
        if prev is None:
            if seed == 'first':
                prev = v
            else:
                buf.append(v)
                if len(buf) < n:
                    continue
                prev = math.fsum(buf) / n
            out[i] = prev
            continue
        prev = a * v + (1 - a) * prev
        out[i] = prev
    return out


def rma(x, n, seed='sma'):
    return ema(x, n, seed, 1.0 / n)


def csma(x, n, m, seed='first'):
    """'SMA' בסגנון הסיני: Y=(M·X+(N−M)·Y₋₁)/N — החלקה מעריכית עם α=M/N."""
    return ema(x, n, seed, float(m) / n)


def window(x, n, f):
    n = int(n)
    out = [None] * len(x)
    for i in range(n - 1, len(x)):
        w = x[i - n + 1:i + 1]
        if None in w:
            continue
        out[i] = f(w)
    return out


def wma(x, n):
    n = int(n)
    den = n * (n + 1) / 2.0
    return window(x, n, lambda w: math.fsum((k + 1) * v for k, v in enumerate(w)) / den)


def highest(x, n):
    return window(x, n, max)


def lowest(x, n):
    return window(x, n, min)


def msum(x, n):
    return window(x, n, math.fsum)


def stdev(x, n, ddof=0):
    def f(w):
        m = math.fsum(w) / len(w)
        return math.sqrt(math.fsum((v - m) ** 2 for v in w) / (len(w) - ddof))
    return window(x, n, f)


def change(x, k=1):
    return [None if i < k or x[i] is None or x[i - k] is None else x[i] - x[i - k] for i in range(len(x))]


def roc(x, k):
    return [None if i < k or x[i] is None or not x[i - k] else 100.0 * (x[i] - x[i - k]) / x[i - k] for i in range(len(x))]


def true_range(B, first=True):
    h, l, c = B['h'], B['l'], B['c']
    out = [None] * len(c)
    for i in range(len(c)):
        if i == 0:
            out[i] = h[0] - l[0] if first else None
        else:
            out[i] = max(h[i] - l[i], abs(h[i] - c[i - 1]), abs(l[i] - c[i - 1]))
    return out


def atr(B, n, first=True):
    return rma(true_range(B, first), n)


def linreg_fit(w):
    """ריבועים פחותים על x=0..n−1 → (a, b) כך ש־y ≈ a + b·x."""
    n = len(w)
    sx = n * (n - 1) / 2.0
    sxx = (n - 1) * n * (2 * n - 1) / 6.0
    sy = math.fsum(w)
    sxy = math.fsum(k * v for k, v in enumerate(w))
    den = n * sxx - sx * sx
    b = (n * sxy - sx * sy) / den if den else 0.0
    return (sy - b * sx) / n, b


def linreg(x, n):
    return window(x, n, lambda w: (lambda ab: ab[0] + ab[1] * (len(w) - 1))(linreg_fit(w)))


def rsi_wilder(c, n):
    d = change(c)
    ag = rma([None if v is None else max(v, 0.0) for v in d], n)
    al = rma([None if v is None else max(-v, 0.0) for v in d], n)
    return zipmap(lambda g, l: 100.0 if l == 0 else 100.0 - 100.0 / (1.0 + g / l), ag, al)


def rsi_cutler(c, n):
    d = change(c)
    sg = msum([None if v is None else max(v, 0.0) for v in d], n)
    sl = msum([None if v is None else max(-v, 0.0) for v in d], n)
    return zipmap(lambda g, l: 100.0 if l == 0 else 100.0 - 100.0 / (1.0 + g / l), sg, sl)


def hl2(B):
    return [(a + b) / 2.0 for a, b in zip(B['h'], B['l'])]


def hlc3(B):
    return [(a + b + c) / 3.0 for a, b, c in zip(B['h'], B['l'], B['c'])]


def stoch_raw(c, h, l, n, flat=None):
    hh, ll = highest(h, n), lowest(l, n)
    return [None if a is None or b is None else (flat if a == b else 100.0 * (x - b) / (a - b)) for x, a, b in zip(c, hh, ll)]


# =====================================================================
# עיגון בזמן (VWAP, נקודות ציר)
# =====================================================================

def day_keys(ts_sec, tz):
    """מפתח יום בשעון הבורסה — כמו dayKeyFor ב־chart.js: floor((ms + היסט)/יום)."""
    if ZoneInfo is None:
        return [int(t // 86400) for t in ts_sec]
    from datetime import datetime
    z = ZoneInfo(tz)
    return [int((t + datetime.fromtimestamp(t, z).utcoffset().total_seconds()) // 86400) for t in ts_sec]


def anchor_keys(B, X, anchor):
    days = X['day']
    if anchor == 'session':
        return days if X['intra'] else list(range(len(days)))
    if anchor == 'bar':
        return list(range(len(days)))
    if anchor == 'day':
        return days
    if anchor == 'all':
        return [0] * len(days)
    out = []
    for k in days:
        d = date(1970, 1, 1) + timedelta(days=k)
        if anchor == 'week':
            iso = d.isocalendar()
            out.append((iso[0], iso[1]))
        elif anchor == 'month':
            out.append((d.year, d.month))
        elif anchor == 'year':
            out.append(d.year)
        else:
            raise ValueError(anchor)
    return out


# =====================================================================
# המחוונים שלנו (IND) — הגרסה המקובלת והחלופות
# =====================================================================

def i_vwap(B, P, X, anchor='session'):
    k1, k2 = P[0], P[1]
    keys = anchor_keys(B, X, anchor)
    tp = hlc3(B)
    N = len(tp)
    f = {k: [None] * N for k in ('vwap', 'up1', 'dn1', 'up2', 'dn2')}
    cur, sw, mean, m2 = object(), 0.0, 0.0, 0.0
    for i, (p, v) in enumerate(zip(tp, B['v'])):
        if keys[i] != cur:
            cur, sw, mean, m2 = keys[i], 0.0, 0.0, 0.0
        if v > 0:   # Welford משוקלל — יציב מספרית
            sw += v
            d = p - mean
            mean += d * v / sw
            m2 += v * d * (p - mean)
        if sw <= 0:
            continue
        sd = math.sqrt(max(m2 / sw, 0.0))
        f['vwap'][i] = mean
        f['up1'][i], f['dn1'][i] = mean + k1 * sd, mean - k1 * sd
        f['up2'][i], f['dn2'][i] = mean + k2 * sd, mean - k2 * sd
    return f


def i_wma(B, P, X):
    return {'wma': wma(B['c'], P[0])}


def i_hma(B, P, X, sq='round', half='floor'):
    n = int(P[0])
    h2 = n // 2 if half == 'floor' else int(math.floor(n / 2.0 + 0.5))   # 'round' — כמו Math.round ב־JS (10.5 → 11)
    d = zipmap(lambda a, b: 2 * a - b, wma(B['c'], h2), wma(B['c'], n))
    m = int(round(math.sqrt(n))) if sq == 'round' else int(math.floor(math.sqrt(n)))
    return {'hma': wma(d, m)}


def i_dema(B, P, X):
    n = int(P[0])
    e = ema(B['c'], n)
    return {'dema': zipmap(lambda a, b: 2 * a - b, e, ema(e, n))}


def i_tema(B, P, X):
    n = int(P[0])
    e = ema(B['c'], n)
    e2 = ema(e, n)
    return {'tema': zipmap(lambda a, b, c: 3 * a - 3 * b + c, e, e2, ema(e2, n))}


def i_vwma(B, P, X):
    n = int(P[0])
    return {'vwma': zipmap(lambda a, b: a / b if b else None, msum([c * v for c, v in zip(B['c'], B['v'])], n), msum(B['v'], n))}


def i_ribbon(B, P, X):
    return {'e%d' % j: ema(B['c'], int(p)) for j, p in enumerate(P)}


def i_supertrend(B, P, X):
    n, m = int(P[0]), P[1]
    h, l, c = B['h'], B['l'], B['c']
    a = atr(B, n)
    N = len(c)
    up, dn = [None] * N, [None] * N
    fu = fl = None
    d = None
    for i in range(N):
        if a[i] is None:
            continue
        mid = (h[i] + l[i]) / 2.0
        bu, bl = mid + m * a[i], mid - m * a[i]
        if fu is None:
            fu, fl, d = bu, bl, -1
        else:
            pu, pl = fu, fl
            fu = bu if (bu < pu or c[i - 1] > pu) else pu
            fl = bl if (bl > pl or c[i - 1] < pl) else pl
            d = (1 if c[i] > fu else -1) if d == -1 else (-1 if c[i] < fl else 1)
        if d == 1:
            up[i] = fl
        else:
            dn[i] = fu
    return {'up': up, 'dn': dn}


def i_ichimoku(B, P, X, disp=26):
    a, b, cb = int(P[0]), int(P[1]), int(P[2])
    h, l = B['h'], B['l']

    def mid(n):
        return zipmap(lambda x, y: (x + y) / 2.0, highest(h, n), lowest(l, n))
    ten, kij, sb = mid(a), mid(b), mid(cb)
    sa = zipmap(lambda x, y: (x + y) / 2.0, ten, kij)
    return {'tenkan': ten, 'kijun': kij, 'chikou': shift(B['c'], -disp), 'spanA': shift(sa, disp), 'spanB': shift(sb, disp)}


def i_keltner(B, P, X, atr_n=10, mid='ema'):
    n, m = int(P[0]), P[1]
    md = ema(B['c'], n) if mid == 'ema' else sma(B['c'], n)
    a = atr(B, atr_n or n)
    return {'up': zipmap(lambda x, y: x + m * y, md, a), 'mid': md, 'dn': zipmap(lambda x, y: x - m * y, md, a)}


def i_donchian(B, P, X):
    n = int(P[0])
    u, d = highest(B['h'], n), lowest(B['l'], n)
    return {'up': u, 'mid': zipmap(lambda x, y: (x + y) / 2.0, u, d), 'dn': d}


def i_envelope(B, P, X, mid='sma'):
    n, p = int(P[0]), P[1] / 100.0
    md = sma(B['c'], n) if mid == 'sma' else ema(B['c'], n)
    return {'up': [None if v is None else v * (1 + p) for v in md], 'mid': md, 'dn': [None if v is None else v * (1 - p) for v in md]}


def i_alligator(B, P, X, shifts=(8, 5, 3)):
    m = hl2(B)
    return {k: shift(rma(m, int(n)), s) for k, n, s in zip(('jaw', 'teeth', 'lips'), P, shifts)}


def i_chandelier(B, P, X, ratchet=False, src='hl'):
    n, m = int(P[0]), P[1]
    a = atr(B, n)
    hh = highest(B['h'] if src == 'hl' else B['c'], n)
    ll = lowest(B['l'] if src == 'hl' else B['c'], n)
    lg = zipmap(lambda x, y: x - m * y, hh, a)
    sh = zipmap(lambda x, y: x + m * y, ll, a)
    if ratchet:
        c = B['c']
        for i in range(1, len(c)):
            if lg[i] is not None and lg[i - 1] is not None and c[i - 1] > lg[i - 1]:
                lg[i] = max(lg[i], lg[i - 1])
            if sh[i] is not None and sh[i - 1] is not None and c[i - 1] < sh[i - 1]:
                sh[i] = min(sh[i], sh[i - 1])
    return {'long': lg, 'short': sh}


def pivot_levels(typ, H, L, C):
    P = (H + L + C) / 3.0
    R = H - L
    if typ == 'woodie':
        P = (H + L + 2 * C) / 4.0
    if typ in ('trad', 'woodie'):
        return dict(p=P, r1=2 * P - L, s1=2 * P - H, r2=P + R, s2=P - R, r3=H + 2 * (P - L), s3=L - 2 * (H - P))
    if typ == 'classic':
        return dict(p=P, r1=2 * P - L, s1=2 * P - H, r2=P + R, s2=P - R, r3=P + 2 * R, s3=P - 2 * R)
    if typ == 'fib':
        return dict(p=P, r1=P + 0.382 * R, s1=P - 0.382 * R, r2=P + 0.618 * R, s2=P - 0.618 * R, r3=P + R, s3=P - R)
    if typ == 'cam':
        return dict(p=P, r1=C + 1.1 * R / 12, s1=C - 1.1 * R / 12, r2=C + 1.1 * R / 6, s2=C - 1.1 * R / 6, r3=C + 1.1 * R / 4, s3=C - 1.1 * R / 4)
    raise ValueError(typ)


def i_pivots(B, P, X, typ='trad', period='auto'):
    per = ('day' if X['intra'] else 'month') if period == 'auto' else period
    keys = anchor_keys(B, X, per)
    N = len(keys)
    f = {k: [None] * N for k in ('r3', 'r2', 'r1', 'p', 's1', 's2', 's3')}
    groups, start = [], 0
    for i in range(1, N + 1):
        if i == N or keys[i] != keys[start]:
            groups.append((start, i))
            start = i
    for (a0, a1), (b0, b1) in zip(groups, groups[1:]):
        lv = pivot_levels(typ, max(B['h'][a0:a1]), min(B['l'][a0:a1]), B['c'][a1 - 1])
        for i in range(b0, b1):
            for k in f:
                f[k][i] = lv[k]
    return f


def i_linreg(B, P, X, mode='last', sd='resid1'):
    n, k = int(P[0]), P[1]
    c = B['c']
    N = len(c)
    f = {'up': [None] * N, 'mid': [None] * N, 'dn': [None] * N}

    def sdev(w, a, b):
        if sd == 'price':
            m = math.fsum(w) / len(w)
            return math.sqrt(math.fsum((v - m) ** 2 for v in w) / len(w))
        r2 = math.fsum((v - (a + b * j)) ** 2 for j, v in enumerate(w))
        return math.sqrt(r2 / (len(w) - 1 if sd == 'resid1' else len(w)))
    if mode == 'rolling':
        for i in range(n - 1, N):
            w = c[i - n + 1:i + 1]
            a, b = linreg_fit(w)
            m, s = a + b * (n - 1), sdev(w, a, b)
            f['mid'][i], f['up'][i], f['dn'][i] = m, m + k * s, m - k * s
    elif N >= n:
        w = c[N - n:]
        a, b = linreg_fit(w)
        s = sdev(w, a, b)
        for j in range(n):
            m = a + b * j
            f['mid'][N - n + j], f['up'][N - n + j], f['dn'][N - n + j] = m, m + k * s, m - k * s
    return f


def zigzag_pivots(h, l, p, tie='first'):
    """tie='first' — קיצון שווה לא מזיז את נקודת המפנה; tie='later' — עובר לנר המאוחר (שחזור)."""
    ge = (lambda a, b: a >= b) if tie == 'later' else (lambda a, b: a > b)
    N = len(h)
    piv = []
    trend, hi, lo, ext = 0, 0, 0, 0
    for i in range(1, N):
        if trend == 0:
            if h[i] > h[hi]:
                hi = i
            if l[i] < l[lo]:
                lo = i
            if lo < hi and h[hi] >= l[lo] * (1 + p):
                piv.append((lo, l[lo]))
                trend, ext = 1, hi
            elif hi < lo and l[lo] <= h[hi] * (1 - p):
                piv.append((hi, h[hi]))
                trend, ext = -1, lo
        elif trend == 1:
            if ge(h[i], h[ext]):
                ext = i
            elif l[i] <= h[ext] * (1 - p):
                piv.append((ext, h[ext]))
                trend, ext = -1, i
        else:
            if ge(-l[i], -l[ext]):
                ext = i
            elif h[i] >= l[ext] * (1 + p):
                piv.append((ext, l[ext]))
                trend, ext = 1, i
    if trend:
        piv.append((ext, h[ext] if trend == 1 else l[ext]))   # הרגל האחרונה — לא מאושרת
    return piv


def i_zigzag(B, P, X, src='hl', tie='first', line=False):
    h, l = (B['h'], B['l']) if src == 'hl' else (B['c'], B['c'])
    zz = [None] * len(h)
    piv = zigzag_pivots(h, l, P[0] / 100.0, tie)
    for i, v in piv:
        zz[i] = v
    if line:   # קו רציף: אינטרפולציה בין נקודות המפנה
        for (a, pa), (b, pb) in zip(piv, piv[1:]):
            for i in range(a, b + 1):
                zz[i] = pa + (pb - pa) * (i - a) / ((b - a) or 1)
    return {'zz': zz}


def i_atr(B, P, X):
    return {'atr': atr(B, int(P[0]))}


def dmi_parts(B):
    h, l = B['h'], B['l']
    N = len(h)
    pdm, mdm = [None] * N, [None] * N
    for i in range(1, N):
        u, d = h[i] - h[i - 1], l[i - 1] - l[i]
        pdm[i] = u if (u > d and u > 0) else 0.0
        mdm[i] = d if (d > u and d > 0) else 0.0
    return pdm, mdm


def i_adx(B, P, X, tr_first=False):
    n = int(P[0])
    pdm, mdm = dmi_parts(B)
    tr = rma(true_range(B, tr_first), n)
    pdi = zipmap(lambda a, t: 100.0 * a / t if t else None, rma(pdm, n), tr)
    mdi = zipmap(lambda a, t: 100.0 * a / t if t else None, rma(mdm, n), tr)
    dx = zipmap(lambda a, b: 0.0 if a + b == 0 else 100.0 * abs(a - b) / (a + b), pdi, mdi)
    return {'adx': rma(dx, n), 'pdi': pdi, 'mdi': mdi}


def i_stoch(B, P, X, ksm=None):
    n, k, d = int(P[0]), int(ksm or P[1]), int(P[2])
    raw = stoch_raw(B['c'], B['h'], B['l'], n)
    K = sma(raw, k) if k > 1 else raw
    return {'k': K, 'd': sma(K, d)}


def i_stochrsi(B, P, X):
    rn, sn, k, d = (int(v) for v in P)
    r = rsi_wilder(B['c'], rn)
    K = sma(stoch_raw(r, r, r, sn), k)
    return {'k': K, 'd': sma(K, d)}


def i_mfi(B, P, X):
    n = int(P[0])
    tp, v = hlc3(B), B['v']
    N = len(tp)
    pos, neg = [None] * N, [None] * N
    for i in range(1, N):
        f = tp[i] * v[i]
        pos[i] = f if tp[i] > tp[i - 1] else 0.0
        neg[i] = f if tp[i] < tp[i - 1] else 0.0
    return {'mfi': zipmap(lambda a, b: 100.0 if b == 0 else 100.0 - 100.0 / (1.0 + a / b), msum(pos, n), msum(neg, n))}


def clv(B):
    return [((c - l) - (h - c)) / (h - l) if h != l else 0.0 for h, l, c in zip(B['h'], B['l'], B['c'])]


def i_cmf(B, P, X):
    n = int(P[0])
    mfv = [a * v for a, v in zip(clv(B), B['v'])]
    return {'cmf': zipmap(lambda a, b: a / b if b else None, msum(mfv, n), msum(B['v'], n))}


def i_aroon(B, P, X, tie='recent', extra=1):
    n = int(P[0])
    W = n + extra
    h, l = B['h'], B['l']
    N = len(h)
    up, dn = [None] * N, [None] * N
    for i in range(W - 1, N):
        wh, wl = h[i - W + 1:i + 1], l[i - W + 1:i + 1]
        if tie == 'recent':
            jh, jl = W - 1 - wh[::-1].index(max(wh)), W - 1 - wl[::-1].index(min(wl))
        else:
            jh, jl = wh.index(max(wh)), wl.index(min(wl))
        up[i] = 100.0 * (n - (W - 1 - jh)) / n
        dn[i] = 100.0 * (n - (W - 1 - jl)) / n
    return {'up': up, 'dn': dn}


def i_cmo(B, P, X):
    n = int(P[0])
    d = change(B['c'])
    su = msum([None if v is None else max(v, 0.0) for v in d], n)
    sd = msum([None if v is None else max(-v, 0.0) for v in d], n)
    return {'cmo': zipmap(lambda a, b: 0.0 if a + b == 0 else 100.0 * (a - b) / (a + b), su, sd)}


def i_ultosc(B, P, X):
    h, l, c = B['h'], B['l'], B['c']
    N = len(c)
    bp = [None] + [c[i] - min(l[i], c[i - 1]) for i in range(1, N)]
    tr = [None] + [max(h[i], c[i - 1]) - min(l[i], c[i - 1]) for i in range(1, N)]
    A = [zipmap(lambda x, y: x / y if y else None, msum(bp, int(n)), msum(tr, int(n))) for n in P]
    return {'uo': zipmap(lambda x, y, z: 100.0 * (4 * x + 2 * y + z) / 7.0, *A)}


def i_tsi(B, P, X):
    lo, sh, sg = (int(v) for v in P)
    pc = change(B['c'])
    num_ = ema(ema(pc, lo), sh)
    den = ema(ema([None if v is None else abs(v) for v in pc], lo), sh)
    t = zipmap(lambda a, b: 100.0 * a / b if b else None, num_, den)
    return {'tsi': t, 'sig': ema(t, sg)}


def i_coppock(B, P, X):
    w, lo, sh = (int(v) for v in P)
    return {'cop': wma(zipmap(lambda a, b: a + b, roc(B['c'], lo), roc(B['c'], sh)), w)}


def i_fisher(B, P, X, clamp='ehlers'):
    """clamp='ehlers' — מעל 0.99 קופץ ל־0.999 (המקור); clamp='minmax' — חסימה פשוטה ל־±0.999 (שחזור)."""
    n = int(P[0])
    m = hl2(B)
    hh, ll = highest(m, n), lowest(m, n)
    N = len(m)
    fish, trig = [None] * N, [None] * N
    xv, fv, prev = 0.0, 0.0, None
    for i in range(N):
        if hh[i] is None:
            continue
        rng = hh[i] - ll[i]
        x = 0.66 * (((m[i] - ll[i]) / rng if rng else 0.0) - 0.5) + 0.67 * xv
        if clamp == 'ehlers':
            x = 0.999 if x > 0.99 else (-0.999 if x < -0.99 else x)
        else:
            x = max(-0.999, min(0.999, x))
        pf = fv
        fv = 0.5 * math.log((1 + x) / (1 - x)) + 0.5 * fv
        xv = x
        fish[i], trig[i], prev = fv, (prev if clamp == 'ehlers' else pf), fv
    return {'fish': fish, 'trig': trig}


def i_chop(B, P, X):
    n = int(P[0])
    s, hh, ll = msum(true_range(B), n), highest(B['h'], n), lowest(B['l'], n)
    return {'chop': zipmap(lambda a, b, d: None if b == d else 100.0 * math.log10(a / (b - d)) / math.log10(n), s, hh, ll)}


def i_hv(B, P, X, ddof=1, year=None):
    n, yr = int(P[0]), (P[1] if year is None else year)
    c = B['c']
    r = [None] + [math.log(c[i] / c[i - 1]) if c[i] > 0 and c[i - 1] > 0 else None for i in range(1, len(c))]
    return {'hv': [None if v is None else 100.0 * v * math.sqrt(yr) for v in stdev(r, n, ddof)]}


def i_squeeze(B, P, X, kc='sma-tr'):
    n, bbm, kcm = int(P[0]), P[1], P[2]
    c = B['c']
    basis, dev = sma(c, n), stdev(c, n, 0)
    if kc == 'sma-tr':
        ma, rng = sma(c, n), sma(true_range(B), n)
    elif kc == 'ema-atr':
        ma, rng = ema(c, n), atr(B, n)
    else:   # 'sma-atr'
        ma, rng = sma(c, n), atr(B, n)
    N = len(c)
    sq, rel = [None] * N, [None] * N
    for i in range(N):
        if None in (basis[i], dev[i], ma[i], rng[i]):
            continue
        ub, lb = basis[i] + bbm * dev[i], basis[i] - bbm * dev[i]
        uk, lk = ma[i] + kcm * rng[i], ma[i] - kcm * rng[i]
        if lb > lk and ub < uk:
            sq[i] = 0.0
        elif lb < lk and ub > uk:
            rel[i] = 0.0
    x = zipmap(lambda cc, a, b, m: cc - ((a + b) / 2.0 + m) / 2.0, c, highest(B['h'], n), lowest(B['l'], n), basis)
    return {'mom': linreg(x, n), 'sq': sq, 'rel': rel}


def i_elder(B, P, X):
    e = ema(B['c'], int(P[0]))
    return {'bull': zipmap(lambda a, b: a - b, B['h'], e), 'bear': zipmap(lambda a, b: a - b, B['l'], e)}


def i_vortex(B, P, X):
    n = int(P[0])
    h, l = B['h'], B['l']
    N = len(h)
    vp = [None] + [abs(h[i] - l[i - 1]) for i in range(1, N)]
    vm = [None] + [abs(l[i] - h[i - 1]) for i in range(1, N)]
    st = msum(true_range(B, False), n)
    return {'vip': zipmap(lambda a, b: a / b if b else None, msum(vp, n), st), 'vim': zipmap(lambda a, b: a / b if b else None, msum(vm, n), st)}


def i_ppo(B, P, X):
    f, s, g = (int(v) for v in P)
    p = zipmap(lambda a, b: 100.0 * (a - b) / b if b else None, ema(B['c'], f), ema(B['c'], s))
    sg = ema(p, g)
    return {'ppo': p, 'sig': sg, 'hist': zipmap(lambda a, b: a - b, p, sg)}


def i_dpo(B, P, X, mode='centered'):
    n = int(P[0])
    k = n // 2 + 1
    c, ma = B['c'], sma(B['c'], n)
    if mode == 'centered':
        out = zipmap(lambda a, b: a - b, c, shift(ma, -k))
    elif mode == 'lagged-ma':
        out = zipmap(lambda a, b: a - b, c, shift(ma, k))
    elif mode == 'lagged-close':
        out = zipmap(lambda a, b: a - b, shift(c, k), ma)
    else:
        out = zipmap(lambda a, b: a - b, c, ma)
    return {'dpo': out}


def i_kst(B, P, X):
    c = B['c']
    parts = [sma(roc(c, r), s) for r, s in ((10, 10), (15, 10), (20, 10), (30, 15))]
    k = zipmap(lambda a, b, d, e: a + 2 * b + 3 * d + 4 * e, *parts)
    return {'kst': k, 'sig': sma(k, 9)}


def i_mass(B, P, X):
    r = [a - b for a, b in zip(B['h'], B['l'])]
    e1 = ema(r, 9)
    return {'mi': msum(zipmap(lambda a, b: a / b if b else None, e1, ema(e1, 9)), int(P[0]))}


def i_bop(B, P, X):
    raw = [(c - o) / (h - l) if h != l else 0.0 for o, h, l, c in zip(B['o'], B['h'], B['l'], B['c'])]
    return {'bop': sma(raw, int(P[0]))}


def ad_line(B):
    s, out = 0.0, []
    for a, v in zip(clv(B), B['v']):
        s += a * v
        out.append(s)
    return out


def i_ad(B, P, X):
    return {'ad': ad_line(B)}


def i_chaikin(B, P, X):
    ad = ad_line(B)
    return {'co': zipmap(lambda a, b: a - b, ema(ad, int(P[0])), ema(ad, int(P[1])))}


def i_force(B, P, X):
    c, v = B['c'], B['v']
    raw = [None] + [(c[i] - c[i - 1]) * v[i] for i in range(1, len(c))]
    return {'fi': ema(raw, int(P[0]))}


def i_rvol(B, P, X, mode='prev'):
    n = int(P[0])
    m = sma(B['v'], n)
    if mode == 'prev':
        m = shift(m, 1)
    return {'rvol': zipmap(lambda a, b: a / b if b else None, B['v'], m)}


def i_zscore(B, P, X, ddof=0):
    n = int(P[0])
    return {'z': zipmap(lambda c, m, s: (c - m) / s if s else None, B['c'], sma(B['c'], n), stdev(B['c'], n, ddof))}


def i_rs(B, P, X, mode='ratio'):
    n = int(P[0])
    bench = X.get('bench') or {}
    N = len(B['c'])
    if not bench:
        return {'rs': [None] * N, 'ma': [None] * N}
    if mode == 'norm-asof':
        last, rs = None, []
        for i, t in enumerate(B['t']):
            last = bench.get(t, last)
            rs.append(B['c'][i] / last if last else None)
        mode = 'norm'
    else:
        rs = [B['c'][i] / bench[t] if bench.get(t) else None for i, t in enumerate(B['t'])]
    if mode == 'ratio100':
        rs = [None if v is None else 100.0 * v for v in rs]
    elif mode == 'norm':
        f = next((v for v in rs if v is not None), None)
        rs = [None if v is None else 100.0 * v / f for v in rs]
    return {'rs': rs, 'ma': sma(rs, n)}


# =====================================================================
# המובנים של KLineChart — ההגדרה המקובלת והחלופות
# =====================================================================

def k_ma(B, P):
    return {'ma%d' % (j + 1): sma(B['c'], int(p)) for j, p in enumerate(P)}


def k_ema(B, P, seed='sma'):
    return {'ema%d' % (j + 1): ema(B['c'], int(p), seed) for j, p in enumerate(P)}


def k_sma(B, P, mode='cn-first'):
    n, m = int(P[0]), P[1]
    if mode == 'klc':   # שחזור: α=M/(N+1), אתחול SMA
        return {'sma': ema(B['c'], n, 'sma', float(m) / (n + 1))}
    if mode == 'rma':   # "ממוצע נע מוחלק" במובן המערבי (SMMA = RMA)
        return {'sma': rma(B['c'], n)}
    if mode == 'cn-first':
        return {'sma': csma(B['c'], n, m, 'first')}
    if mode == 'cn-sma':
        return {'sma': csma(B['c'], n, m, 'sma')}
    return {'sma': ema(B['c'], n)}   # 'ema' — EMA רגיל באורך n


def k_boll(B, P):
    n, k = int(P[0]), P[1]
    m, s = sma(B['c'], n), stdev(B['c'], n, 0)
    return {'up': zipmap(lambda a, b: a + k * b, m, s), 'mid': m, 'dn': zipmap(lambda a, b: a - k * b, m, s)}


def sar(B, start=0.02, step=0.02, mx=0.2, order='wilder'):
    """Parabolic SAR של Wilder. order='wilder' — חסימה בשני הנרות הקודמים לפני בדיקת החצייה;
    order='late' — בדיקת החצייה על הערך הלא־חסום, החסימה אחריה."""
    h, l, c = B['h'], B['l'], B['c']
    N = len(c)
    out = [None] * N
    if N < 2:
        return out
    up = c[1] > c[0]
    s = l[0] if up else h[0]
    ep = h[1] if up else l[1]
    af = start
    out[1] = s
    for i in range(2, N):
        s = s + af * (ep - s)
        if order == 'wilder':
            s = min(s, l[i - 1], l[i - 2]) if up else max(s, h[i - 1], h[i - 2])
        rev = (l[i] < s) if up else (h[i] > s)
        if rev:
            s = max(ep, h[i]) if up else min(ep, l[i])
            up = not up
            ep = l[i] if not up else h[i]
            af = start
        else:
            if up and h[i] > ep:
                ep, af = h[i], min(af + step, mx)
            elif not up and l[i] < ep:
                ep, af = l[i], min(af + step, mx)
            if order == 'late':
                s = min(s, l[i - 1], l[i - 2]) if up else max(s, h[i - 1], h[i - 2])
        out[i] = s
    return out


def sar_klc(B, start, step, mx):
    """שחזור של SAR ב־KLineChart 10.1 (נכתב אחרי קריאת הקוד — לאישור השורש בלבד)."""
    h, l = B['h'], B['l']
    af, ep, up, s, out = start, -100.0, False, 0.0, []
    for i in range(len(h)):
        pre, hi, lo = s, h[i], l[i]
        if up:
            if ep == -100 or ep < hi:
                ep, af = hi, min(af + step, mx)
            s = pre + af * (ep - pre)
            p = min(l[max(1, i) - 1], lo)
            if s > lo:
                s, af, ep, up = ep, start, -100.0, False
            elif s > p:
                s = p
        else:
            if ep == -100 or ep > lo:
                ep, af = lo, min(af + step, mx)
            s = pre + af * (ep - pre)
            g = max(h[max(1, i) - 1], hi)
            if s < hi:
                s, af, ep, up = ep, start, -100.0, True
            elif s < g:
                s = g
        out.append(s)
    return out


def k_sar(B, P, order='wilder'):
    if order == 'klc':
        return {'sar': sar_klc(B, P[0] / 100.0, P[1] / 100.0, P[2] / 100.0)}
    return {'sar': sar(B, P[0] / 100.0, P[1] / 100.0, P[2] / 100.0, order)}


def k_bbi(B, P):
    ms = [sma(B['c'], int(p)) for p in P]
    return {'bbi': zipmap(lambda *a: math.fsum(a) / len(a), *ms)}


def k_avp(B, P, src='hlc3'):
    if src == 'klc':   # שחזור: Σturnover/ΣV כשאין שדה turnover בנרות → 0
        out, sv = [], 0.0
        for v in B['v']:
            sv += v
            out.append(0.0 if sv else None)
        return {'avp': out}
    px = hlc3(B) if src == 'hlc3' else B['c']
    sv = spv = 0.0
    out = []
    for p, v in zip(px, B['v']):
        sv += v
        spv += p * v
        out.append(spv / sv if sv else None)
    return {'avp': out}


def k_vol(B, P):
    return {'volume': list(B['v'])}


def k_macd(B, P, mult=1.0):
    f, s, g = (int(v) for v in P)
    dif = zipmap(lambda a, b: a - b, ema(B['c'], f), ema(B['c'], s))
    dea = ema(dif, g)
    return {'dif': dif, 'dea': dea, 'macd': zipmap(lambda a, b: mult * (a - b), dif, dea)}


def k_rsi(B, P, mode='wilder'):
    fn = rsi_wilder if mode == 'wilder' else rsi_cutler
    return {'rsi%d' % (j + 1): fn(B['c'], int(p)) for j, p in enumerate(P)}


def k_kdj(B, P):
    n, m1, m2 = (int(v) for v in P)
    rsv = stoch_raw(B['c'], B['h'], B['l'], n, flat=0.0)
    N = len(rsv)
    K, D, J = [None] * N, [None] * N, [None] * N
    k = d = 50.0
    for i in range(N):
        if rsv[i] is None:
            continue
        k = ((m1 - 1) * k + rsv[i]) / m1
        d = ((m2 - 1) * d + k) / m2
        K[i], D[i], J[i] = k, d, 3 * k - 2 * d
    return {'k': K, 'd': D, 'j': J}


def obv_line(B, start='zero'):
    c, v = B['c'], B['v']
    s = 0.0 if start == 'zero' else float(v[0])
    out = [s]
    for i in range(1, len(c)):
        s += v[i] if c[i] > c[i - 1] else (-v[i] if c[i] < c[i - 1] else 0.0)
        out.append(s)
    return out


def k_obv(B, P, start='zero'):
    o = obv_line(B, start)
    return {'obv': o, 'maObv': sma(o, int(P[0]))}


def k_cci(B, P):
    n = int(P[0])
    tp = hlc3(B)

    def f(w):
        m = math.fsum(w) / len(w)
        md = math.fsum(abs(v - m) for v in w) / len(w)
        return None if md == 0 else (w[-1] - m) / (0.015 * md)
    return {'cci': window(tp, n, f)}


def k_dmi(B, P, mode='cn'):
    n, mm = int(P[0]), int(P[1])
    pdm, mdm = dmi_parts(B)
    tr = true_range(B, False)
    if mode == 'klc':   # שחזור: נר 0 נכנס לסכום הפתיחה (TR=H−L, DM=0), ‏ADX=RMA(DX,n), ‏ADXR מול ADX של mm−1 נרות קודם
        tr, pdm, mdm = true_range(B, True), [0.0] + pdm[1:], [0.0] + mdm[1:]
        st, sp, sm = rma(tr, n), rma(pdm, n), rma(mdm, n)
        pdi = zipmap(lambda a, t: 100.0 * a / t if t else 0.0, sp, st)
        mdi = zipmap(lambda a, t: 100.0 * a / t if t else 0.0, sm, st)
        dx = zipmap(lambda a, b: 0.0 if a + b == 0 else 100.0 * abs(a - b) / (a + b), pdi, mdi)
        adx = rma(dx, n)
        adxr = [None] * len(adx)
        for i in range(2 * n + mm - 3, len(adx)):
            adxr[i] = ((adx[i - (mm - 1)] or 0.0) + adx[i]) / 2.0
        return {'pdi': pdi, 'mdi': mdi, 'adx': adx, 'adxr': adxr}
    if mode == 'cn':
        st, sp, sm = msum(tr, n), msum(pdm, n), msum(mdm, n)
    else:
        st, sp, sm = rma(tr, n), rma(pdm, n), rma(mdm, n)
    pdi = zipmap(lambda a, t: 100.0 * a / t if t else None, sp, st)
    mdi = zipmap(lambda a, t: 100.0 * a / t if t else None, sm, st)
    dx = zipmap(lambda a, b: 0.0 if a + b == 0 else 100.0 * abs(a - b) / (a + b), pdi, mdi)
    if mode == 'cn':
        adx = sma(dx, mm)
    elif mode == 'wilder':
        adx = rma(dx, mm)
    else:   # 'wilder14' — כמו במוצר הייחוס (החלקת ADX באורך n)
        adx = rma(dx, n)
    return {'pdi': pdi, 'mdi': mdi, 'adx': adx, 'adxr': zipmap(lambda a, b: (a + b) / 2.0, adx, shift(adx, mm))}


def k_wr(B, P, sign=-1.0):
    out = {}
    for j, p in enumerate(P):
        hh, ll = highest(B['h'], int(p)), lowest(B['l'], int(p))
        out['wr%d' % (j + 1)] = zipmap(lambda c, a, b: None if a == b else sign * 100.0 * (a - c) / (a - b), B['c'], hh, ll)
    return out


def k_ao(B, P):
    m = hl2(B)
    return {'ao': zipmap(lambda a, b: a - b, sma(m, int(P[0])), sma(m, int(P[1])))}


def k_trix(B, P, seed='sma'):
    n, m = int(P[0]), int(P[1])
    t = ema(ema(ema(B['c'], n, seed), n, seed), n, seed)
    tx = zipmap(lambda a, b: 100.0 * (a - b) / b if b else None, t, shift(t, 1))
    return {'trix': tx, 'maTrix': sma(tx, m)}


def k_roc(B, P):
    r = roc(B['c'], int(P[0]))
    return {'roc': r, 'maRoc': sma(r, int(P[1]))}


def k_mtm(B, P):
    r = change(B['c'], int(P[0]))
    return {'mtm': r, 'maMtm': sma(r, int(P[1]))}


def k_bias(B, P):
    return {'bias%d' % (j + 1): zipmap(lambda c, m: 100.0 * (c - m) / m if m else None, B['c'], sma(B['c'], int(p))) for j, p in enumerate(P)}


def k_brar(B, P, mode='std'):
    n = int(P[0])
    if mode == 'klc':   # שחזור: BR בלי max(0,·), ונר 0 מול עצמו
        o, h, l, c = B['o'], B['h'], B['l'], B['c']
        cp = [c[0]] + c[:-1]
        ar = zipmap(lambda a, b: 100.0 * a / b if b else 0.0, msum([x - y for x, y in zip(h, o)], n), msum([x - y for x, y in zip(o, l)], n))
        br = zipmap(lambda a, b: 100.0 * a / b if b else 0.0, msum([x - y for x, y in zip(h, cp)], n), msum([y - x for x, y in zip(l, cp)], n))
        return {'br': br, 'ar': ar}
    o, h, l, c = B['o'], B['h'], B['l'], B['c']
    N = len(c)
    ar = zipmap(lambda a, b: 100.0 * a / b if b else None, msum([x - y for x, y in zip(h, o)], n), msum([x - y for x, y in zip(o, l)], n))
    bu = [None] + [max(0.0, h[i] - c[i - 1]) for i in range(1, N)]
    bd = [None] + [max(0.0, c[i - 1] - l[i]) for i in range(1, N)]
    br = zipmap(lambda a, b: 100.0 * a / b if b else None, msum(bu, n), msum(bd, n))
    return {'br': br, 'ar': ar}


def k_cr(B, P):
    n = int(P[0])
    h, l = B['h'], B['l']
    N = len(h)
    mid = [None] + [(h[i - 1] + l[i - 1]) / 2.0 for i in range(1, N)]
    u = [None if m is None else max(0.0, x - m) for x, m in zip(h, mid)]
    d = [None if m is None else max(0.0, m - y) for y, m in zip(l, mid)]
    cr = zipmap(lambda a, b: 100.0 * a / b if b else None, msum(u, n), msum(d, n))
    out = {'cr': cr}
    for j, m in enumerate(P[1:5]):
        out['ma%d' % (j + 1)] = shift(sma(cr, int(m)), int(m / 2.5 + 1))
    return out


def k_dma(B, P):
    a, b, m = (int(v) for v in P)
    d = zipmap(lambda x, y: x - y, sma(B['c'], a), sma(B['c'], b))
    return {'dma': d, 'ama': sma(d, m)}


def k_emv(B, P, mode='cn'):
    n, m = int(P[0]), int(P[1])
    h, l, v = B['h'], B['l'], B['v']
    N = len(h)
    if mode == 'klc':   # שחזור: emv = EMV של נר אחד (בלי החלקה), maEmv = SMA(n); הפרמטר השני לא בשימוש
        raw = [None] + [(((h[i] + l[i]) / 2.0 - (h[i - 1] + l[i - 1]) / 2.0) / ((v[i] / 1e8) / (h[i] - l[i]))) if v[i] and h[i] != l[i] else 0.0 for i in range(1, N)]
        return {'emv': raw, 'maEmv': sma(raw, n)}
    if mode == 'cn':
        volr = zipmap(lambda a, b: a / b if b else None, sma(v, n), v)
        mid = [None] + [100.0 * (h[i] + l[i] - (h[i - 1] + l[i - 1])) / (h[i] + l[i]) if h[i] + l[i] else None for i in range(1, N)]
        rng = [a - b for a, b in zip(h, l)]
        x = zipmap(lambda a, b, r, mr: a * b * r / mr if mr else None, mid, volr, rng, sma(rng, n))
        e = sma(x, n)
    else:   # Arms
        x = [None] + [(((h[i] + l[i]) / 2.0 - (h[i - 1] + l[i - 1]) / 2.0) / ((v[i] / 1e8) / (h[i] - l[i]))) if v[i] and h[i] != l[i] else None for i in range(1, N)]
        e = sma(x, n)
    return {'emv': e, 'maEmv': sma(e, m)}


def k_psy(B, P):
    n, m = int(P[0]), int(P[1])
    c = B['c']
    up = [None] + [1.0 if c[i] > c[i - 1] else 0.0 for i in range(1, len(c))]
    p = [None if s is None else 100.0 * s / n for s in msum(up, n)]
    return {'psy': p, 'maPsy': sma(p, m)}


def k_pvt(B, P):
    c, v = B['c'], B['v']
    s, out = 0.0, [0.0]
    for i in range(1, len(c)):
        s += (c[i] - c[i - 1]) / c[i - 1] * v[i] if c[i - 1] else 0.0
        out.append(s)
    return {'pvt': out}


def k_vr(B, P):
    n, m = int(P[0]), int(P[1])
    c, v = B['c'], B['v']
    N = len(c)
    th = [None] + [v[i] if c[i] > c[i - 1] else 0.0 for i in range(1, N)]
    tl = [None] + [v[i] if c[i] < c[i - 1] else 0.0 for i in range(1, N)]
    tq = [None] + [v[i] if c[i] == c[i - 1] else 0.0 for i in range(1, N)]
    vr = zipmap(lambda a, b, q: 100.0 * (2 * a + q) / (2 * b + q) if (2 * b + q) else None, msum(th, n), msum(tl, n), msum(tq, n))
    return {'vr': vr, 'maVr': sma(vr, m)}


# =====================================================================
# טרנספורמציות
# =====================================================================

def t_ha(B):
    o, h, l, c = B['o'], B['h'], B['l'], B['c']
    R = {'o': [], 'h': [], 'l': [], 'c': []}
    for i in range(len(c)):
        hc = (o[i] + h[i] + l[i] + c[i]) / 4.0
        ho = (o[0] + c[0]) / 2.0 if i == 0 else (R['o'][-1] + R['c'][-1]) / 2.0
        R['o'].append(ho)
        R['c'].append(hc)
        R['h'].append(max(h[i], ho, hc))
        R['l'].append(min(l[i], ho, hc))
    return R


def t_renko(c, box, eps=1e-9):
    """מחזיר רשימת לבנים (פתיחה, סגירה, אינדקס הנר שיצר אותה)."""
    out = []
    if not c or not box:
        return out
    base = c[0]
    d, hi, lo = 0, base, base
    for i in range(1, len(c)):
        x = c[i]
        if d >= 0 and x >= hi + box * (1 - eps):
            k = int(math.floor((x - hi) / box + eps))
            for _ in range(k):
                out.append((hi, hi + box, i))
                lo, hi = hi, hi + box
            d = 1
        elif d <= 0 and x <= lo - box * (1 - eps):
            k = int(math.floor((lo - x) / box + eps))
            for _ in range(k):
                out.append((lo, lo - box, i))
                hi, lo = lo, lo - box
            d = -1
        elif d == 1 and x <= lo - box * (1 - eps):
            k = int(math.floor((lo - x) / box + eps))
            for _ in range(k):
                out.append((lo, lo - box, i))
                hi, lo = lo, lo - box
            d = -1
        elif d == -1 and x >= hi + box * (1 - eps):
            k = int(math.floor((x - hi) / box + eps))
            for _ in range(k):
                out.append((hi, hi + box, i))
                lo, hi = hi, hi + box
            d = 1
    return out


def t_line_break(o, c, n=3, first='bar', run_only=False):
    """first='bar' — הקו הראשון = פתיחה→סגירה של הנר הראשון; first='close' — מהסגירה הראשונה לסגירה השונה הבאה.
    run_only — ההיפוך נמדד רק מול קווי הריצה הנוכחית (עד n)."""
    lines = []
    N = len(c)
    start = 0
    if first == 'bar':
        lines.append((o[0], c[0], 0))
    else:
        j = next((i for i in range(1, N) if c[i] != c[0]), None)
        if j is None:
            return lines
        lines.append((c[0], c[j], j))
        start = j
    for i in range(start + 1, N):
        x = c[i]
        lo_, cl_, _ = lines[-1]
        up = cl_ >= lo_
        tail = lines[-n:]
        if run_only:
            tail = []
            for ln in reversed(lines):
                if (ln[1] >= ln[0]) != up or len(tail) == n:
                    break
                tail.append(ln)
        hi = max(max(a, b) for a, b, _ in tail)
        lo = min(min(a, b) for a, b, _ in tail)
        if up:
            if x > cl_:
                lines.append((cl_, x, i))
            elif x < lo:
                lines.append((min(lo_, cl_), x, i))
        else:
            if x < cl_:
                lines.append((cl_, x, i))
            elif x > hi:
                lines.append((max(lo_, cl_), x, i))
    return lines


def t_kagi(c, r=0.04, start='threshold'):
    """מחזיר רשימת קטעים [התחלה, סוף, אינדקס הנר שפתח את הקטע].
    start='threshold' — הקו הראשון רק אחרי תנועה של r מהסגירה הראשונה; start='first-move' — הקו הראשון בכיוון
    השינוי הראשון, בכל גודל (הבנייה הקלאסית: סף ההיפוך חל רק על היפוכים)."""
    segs = []
    if not c:
        return segs
    base, d, ext = c[0], 0, c[0]
    for i in range(1, len(c)):
        x = c[i]
        if d == 0 and start == 'first-move':
            if x != base:
                d, ext = (1 if x > base else -1), x
                segs.append([base, x, i])
        elif d == 0:
            if x >= base * (1 + r):
                d, ext = 1, x
                segs.append([base, x, i])
            elif x <= base * (1 - r):
                d, ext = -1, x
                segs.append([base, x, i])
        elif d == 1:
            if x > ext:
                ext = x
                segs[-1][1] = x
            elif x <= ext * (1 - r):
                d = -1
                segs.append([ext, x, i])
                ext = x
        else:
            if x < ext:
                ext = x
                segs[-1][1] = x
            elif x >= ext * (1 + r):
                d = 1
                segs.append([ext, x, i])
                ext = x
    return segs


# =====================================================================
# הגרסאות לכל מחוון: הראשונה = המקובלת
# =====================================================================

OURS = {
    'VWAP': [('מושב (מקובל)', lambda B, P, X: i_vwap(B, P, X, 'session')), ('יום', lambda B, P, X: i_vwap(B, P, X, 'day')),
             ('שבוע', lambda B, P, X: i_vwap(B, P, X, 'week')), ('חודש', lambda B, P, X: i_vwap(B, P, X, 'month')),
             ('שנה', lambda B, P, X: i_vwap(B, P, X, 'year')), ('מצטבר מתחילת הנתונים', lambda B, P, X: i_vwap(B, P, X, 'all'))],
    'WMA': [('מקובל', i_wma)],
    'HMA': [('n/2 נחתך, √n מעוגל (מקובל)', i_hma), ('√n נחתך', lambda B, P, X: i_hma(B, P, X, 'floor')),
            ('שחזור: n/2 מעוגל (Math.round)', lambda B, P, X: i_hma(B, P, X, 'round', 'round'))],
    'DEMA': [('מקובל', i_dema)],
    'TEMA': [('מקובל', i_tema)],
    'VWMA': [('מקובל', i_vwma)],
    'RIBBON': [('מקובל', i_ribbon)],
    'SUPERTREND': [('מקובל', i_supertrend)],
    'ICHIMOKU': [('הזזה 26 (ספרות)', i_ichimoku), ('הזזה 25 (displacement−1)', lambda B, P, X: i_ichimoku(B, P, X, 25))],
    'KELTNER': [('EMA20 ± 2·ATR10 (מקובל)', i_keltner), ('EMA20 ± 2·ATR20', lambda B, P, X: i_keltner(B, P, X, 0)),
                ('SMA20 ± 2·ATR20', lambda B, P, X: i_keltner(B, P, X, 0, 'sma'))],
    'DONCHIAN': [('מקובל', i_donchian)],
    'ENVELOPE': [('SMA (מקובל)', i_envelope), ('EMA', lambda B, P, X: i_envelope(B, P, X, 'ema'))],
    'ALLIGATOR': [('RMA מוזז 8/5/3 (מקובל)', i_alligator), ('בלי הזזה', lambda B, P, X: i_alligator(B, P, X, (0, 0, 0)))],
    'CHANDELIER': [('בלי נעילה (מקובל)', i_chandelier), ('עם נעילה', lambda B, P, X: i_chandelier(B, P, X, True)),
                   ('על סגירות', lambda B, P, X: i_chandelier(B, P, X, False, 'c'))],
    'PIVOTS': [('מסורתי, תקופה אוטומטית (מקובל)', i_pivots)] +
              [('%s, %s' % (t, p), (lambda t, p: lambda B, P, X: i_pivots(B, P, X, t, p))(t, p))
               for t in ('trad', 'classic', 'fib', 'cam', 'woodie') for p in ('day', 'week', 'month', 'year')],
    'LINREG': [('ערוץ על 100 האחרונים, σ שאריות n−1 (מקובל)', i_linreg),
               ('ערוץ על 100 האחרונים, σ שאריות n', lambda B, P, X: i_linreg(B, P, X, 'last', 'resid')),
               ('מתגלגל, σ שאריות n−1', lambda B, P, X: i_linreg(B, P, X, 'rolling', 'resid1')),
               ('מתגלגל, σ שאריות n', lambda B, P, X: i_linreg(B, P, X, 'rolling', 'resid')),
               ('מתגלגל, σ מחיר', lambda B, P, X: i_linreg(B, P, X, 'rolling', 'price'))],
    'ZIGZAG': [('H/L (מקובל)', i_zigzag), ('סגירות', lambda B, P, X: i_zigzag(B, P, X, 'c')),
               ('שחזור: שוויון → המאוחר + קו רציף', lambda B, P, X: i_zigzag(B, P, X, 'hl', 'later', True))],
    'ATR': [('מקובל', i_atr)],
    'ADX': [('Wilder (מקובל)', i_adx), ('Wilder, TR כולל נר 0', lambda B, P, X: i_adx(B, P, X, True))],
    'STOCH': [('14/3/3 (מקובל)', i_stoch), ('14/1/3', lambda B, P, X: i_stoch(B, P, X, 1))],
    'STOCHRSI': [('מקובל', i_stochrsi)],
    'MFI': [('מקובל', i_mfi)],
    'CMF': [('מקובל', i_cmf)],
    'AROON': [('חלון n+1, שוויון — האחרון (מקובל)', i_aroon), ('חלון n+1, שוויון — הראשון', lambda B, P, X: i_aroon(B, P, X, 'first')),
              ('חלון n', lambda B, P, X: i_aroon(B, P, X, 'recent', 0))],
    'CMO': [('מקובל', i_cmo)],
    'ULTOSC': [('מקובל', i_ultosc)],
    'TSI': [('מקובל', i_tsi)],
    'COPPOCK': [('מקובל', i_coppock)],
    'FISHER': [('Ehlers (מקובל)', i_fisher), ('שחזור: חסימה פשוטה ±0.999', lambda B, P, X: i_fisher(B, P, X, 'minmax'))],
    'CHOP': [('מקובל', i_chop)],
    'HV': [('σ מדגמית, 252 (מקובל)', i_hv), ('σ אוכלוסייה, 252', lambda B, P, X: i_hv(B, P, X, 0)),
           ('σ אוכלוסייה, 365', lambda B, P, X: i_hv(B, P, X, 0, 365))],
    'SQUEEZE': [('KC = SMA ± SMA(TR) (מקובל)', i_squeeze), ('KC = EMA ± ATR', lambda B, P, X: i_squeeze(B, P, X, 'ema-atr')),
                ('KC = SMA ± ATR', lambda B, P, X: i_squeeze(B, P, X, 'sma-atr'))],
    'ELDER': [('מקובל', i_elder)],
    'VORTEX': [('מקובל', i_vortex)],
    'PPO': [('מקובל', i_ppo)],
    'DPO': [('ממורכז (קלאסי)', i_dpo), ('C − SMA₋₁₁', lambda B, P, X: i_dpo(B, P, X, 'lagged-ma')),
            ('C₋₁₁ − SMA', lambda B, P, X: i_dpo(B, P, X, 'lagged-close')), ('C − SMA בלי הזזה', lambda B, P, X: i_dpo(B, P, X, 'plain'))],
    'KST': [('מקובל', i_kst)],
    'MASS': [('מקובל', i_mass)],
    'BOP': [('מקובל', i_bop)],
    'AD': [('מקובל', i_ad)],
    'CHAIKIN': [('מקובל', i_chaikin)],
    'FORCE': [('מקובל', i_force)],
    'RVOL': [('מול 20 הקודמים (מקובל)', i_rvol), ('כולל הנוכחי', lambda B, P, X: i_rvol(B, P, X, 'incl'))],
    'ZSCORE': [('σ אוכלוסייה (מקובל)', i_zscore), ('σ מדגמית', lambda B, P, X: i_zscore(B, P, X, 1))],
    'RS': [('יחס (מקובל)', i_rs), ('יחס×100', lambda B, P, X: i_rs(B, P, X, 'ratio100')), ('מנורמל לנר הראשון', lambda B, P, X: i_rs(B, P, X, 'norm')),
           ('שחזור: מנורמל לנר הראשון, מילוי מהקודם', lambda B, P, X: i_rs(B, P, X, 'norm-asof'))],
}

KLC = {
    'MA': [('מקובל', k_ma)],
    'EMA': [('אתחול SMA (מקובל)', k_ema), ('אתחול מהערך הראשון', lambda B, P: k_ema(B, P, 'first'))],
    'SMA': [('סיני: (M·X+(N−M)·Y)/N, Y₀=X₀ (מקובל)', k_sma), ('סיני, אתחול SMA', lambda B, P: k_sma(B, P, 'cn-sma')),
            ('EMA(N)', lambda B, P: k_sma(B, P, 'ema')), ('ממוצע מוחלק מערבי SMMA=RMA(N)', lambda B, P: k_sma(B, P, 'rma')),
            ('שחזור: α=M/(N+1)', lambda B, P: k_sma(B, P, 'klc'))],
    'BOLL': [('מקובל', k_boll)],
    'SAR': [('Wilder (מקובל)', k_sar), ('חסימה אחרי בדיקת החצייה', lambda B, P: k_sar(B, P, 'late')),
            ('שחזור: EP של הנר הנוכחי, AF מתחיל ב־0.04', lambda B, P: k_sar(B, P, 'klc'))],
    'BBI': [('מקובל', k_bbi)],
    'AVP': [('Σ(hlc3·V)/ΣV (קירוב למחזור/נפח)', k_avp), ('Σ(C·V)/ΣV', lambda B, P: k_avp(B, P, 'c')),
            ('שחזור: אין turnover → 0', lambda B, P: k_avp(B, P, 'klc'))],
    'VOL': [('מקובל', k_vol)],
    'MACD': [('היסטוגרמה = DIF−DEA (מקובל)', k_macd), ('היסטוגרמה = 2·(DIF−DEA) (סיני)', lambda B, P: k_macd(B, P, 2.0))],
    'RSI': [('Wilder (מקובל)', k_rsi), ('Cutler (סכומים פשוטים)', lambda B, P: k_rsi(B, P, 'cutler'))],
    'KDJ': [('מקובל', k_kdj)],
    'OBV': [('מתחיל ב־0 (מקובל)', k_obv), ('מתחיל בנפח הנר הראשון', lambda B, P: k_obv(B, P, 'v0'))],
    'CCI': [('מקובל', k_cci)],
    'DMI': [('סיני: סכומים, ADX=SMA6 (מקובל לפרמטרים)', k_dmi), ('Wilder, ADX=RMA6', lambda B, P: k_dmi(B, P, 'wilder')),
            ('Wilder 14/14 (מוצר הייחוס)', lambda B, P: k_dmi(B, P, 'wilder14')),
            ('שחזור: Wilder 14/14, ‏ADXR מול mm−1', lambda B, P: k_dmi(B, P, 'klc'))],
    'WR': [('−100..0 (מקובל)', k_wr), ('0..100 (סיני)', lambda B, P: k_wr(B, P, 1.0))],
    'AO': [('מקובל', k_ao)],
    'TRIX': [('מקובל', k_trix), ('אתחול מהערך הראשון', lambda B, P: k_trix(B, P, 'first'))],
    'ROC': [('מקובל', k_roc)],
    'MTM': [('מקובל', k_mtm)],
    'BIAS': [('מקובל', k_bias)],
    'BRAR': [('מקובל', k_brar), ('שחזור: BR בלי max(0,·)', lambda B, P: k_brar(B, P, 'klc'))],
    'CR': [('מקובל', k_cr)],
    'DMA': [('מקובל', k_dma)],
    'EMV': [('סיני (מקובל)', k_emv), ('Arms (מערבי)', lambda B, P: k_emv(B, P, 'arms')),
            ('שחזור: emv בלי החלקה, maEmv=SMA14', lambda B, P: k_emv(B, P, 'klc'))],
    'PSY': [('מקובל', k_psy)],
    'PVT': [('מקובל', k_pvt)],
    'VR': [('מקובל', k_vr)],
}

# ברירות מחדל מקובלות (לבדיקת הפרמטרים). None = אין מוסכמה אחת.
CONV_PARAMS = {
    'ATR': [14], 'ADX': [14], 'STOCH': [14, 3, 3], 'STOCHRSI': [14, 14, 3, 3], 'MFI': [14], 'CMF': [20], 'AROON': [25],
    'CMO': [9], 'ULTOSC': [7, 14, 28], 'TSI': [25, 13, 13], 'COPPOCK': [10, 14, 11], 'FISHER': [9], 'CHOP': [14],
    'HV': [20, 252], 'SQUEEZE': [20, 2, 1.5], 'ELDER': [13], 'VORTEX': [14], 'PPO': [12, 26, 9], 'DPO': [20], 'MASS': [25],
    'BOP': [14], 'CHAIKIN': [3, 10], 'FORCE': [13], 'SUPERTREND': [10, 3], 'ICHIMOKU': [9, 26, 52], 'KELTNER': [20, 2],
    'DONCHIAN': [20], 'ALLIGATOR': [13, 8, 5], 'CHANDELIER': [22, 3], 'LINREG': [100, 2], 'ZIGZAG': [5], 'VWAP': [1, 2],
    'K.BOLL': [20, 2], 'K.MACD': [12, 26, 9], 'K.RSI': [14], 'K.KDJ': [9, 3, 3], 'K.CCI': [20], 'K.WR': [14], 'K.SAR': [2, 2, 20],
    'K.DMI': [14, 14], 'K.AO': [5, 34], 'K.TRIX': [15, 9], 'K.ROC': [12], 'K.MTM': [10], 'K.OBV': [], 'K.MA': None, 'K.EMA': None,
}


# =====================================================================
# השוואה
# =====================================================================

TOL = 1e-7   # יחסי לגודל הערך + חציון הסדרה — רעש עיגול, לא הבדל הגדרה


def to_num(v):
    if isinstance(v, str):
        return v   # 'nan' / 'inf' — לא מספר סופי
    return v if num(v) else None


def series_stats(prod, mine, warm):
    N = min(len(prod), len(mine))
    mags = sorted(abs(v) for v in mine[:N] if num(v))
    s = mags[len(mags) // 2] if mags else 1.0
    s = s or 1.0
    st = dict(n=0, only_p=0, only_m=0, only_p_post=0, only_m_post=0, nonfinite=0, bad=0, bad_post=0,
              max_abs=0.0, max_rel=0.0, max_abs_post=0.0, max_rel_post=0.0, first_bad=None, last_bad=None,
              first_p=None, first_m=None, const_off=None, const_ratio=None, len_p=len(prod), len_m=len(mine),
              p50_rel_post=None, p95_rel_post=None, max_rel_recent=0.0, frac_bad_post=None)
    diffs_post, rels_post, ratios = [], [], []
    recent = N - 500
    for i in range(N):
        p, m = to_num(prod[i]), mine[i]
        if isinstance(p, str):
            st['nonfinite'] += 1
            p = None
        if p is not None and st['first_p'] is None:
            st['first_p'] = i
        if m is not None and st['first_m'] is None:
            st['first_m'] = i
        if p is None and m is None:
            continue
        if p is None or m is None:
            k = 'only_m' if p is None else 'only_p'
            st[k] += 1
            if i >= warm:
                st[k + '_post'] += 1
            continue
        d = abs(p - m)
        rel = d / (abs(m) + s)
        st['n'] += 1
        st['max_abs'] = max(st['max_abs'], d)
        st['max_rel'] = max(st['max_rel'], rel)
        if i >= warm:
            st['max_abs_post'] = max(st['max_abs_post'], d)
            st['max_rel_post'] = max(st['max_rel_post'], rel)
            diffs_post.append(p - m)
            rels_post.append(rel)
            if abs(m) > 1e-9 * s:
                ratios.append(p / m)
        if i >= recent:
            st['max_rel_recent'] = max(st['max_rel_recent'], rel)
        if rel > TOL:
            st['bad'] += 1
            if i >= warm:
                st['bad_post'] += 1
            if st['first_bad'] is None:
                st['first_bad'] = i
            st['last_bad'] = i
    if rels_post:
        rs_ = sorted(rels_post)
        st['p50_rel_post'] = rs_[len(rs_) // 2]
        st['p95_rel_post'] = rs_[int(len(rs_) * 0.95)]
        st['frac_bad_post'] = st['bad_post'] / float(len(rs_))
    if st['bad_post'] and diffs_post:
        lo, hi = min(diffs_post), max(diffs_post)
        if hi - lo <= TOL * (abs(hi) + s):
            st['const_off'] = (lo + hi) / 2.0
        if ratios and max(ratios) - min(ratios) <= 1e-9 * abs(max(ratios)):
            st['const_ratio'] = (max(ratios) + min(ratios)) / 2.0
    return st


def field_verdict(st):
    if st['n'] == 0:
        return 'ריק'
    if st['bad_post'] or st['only_p_post'] or st['only_m_post'] or st['nonfinite']:
        return 'שונה'
    if st['bad'] or st['only_p'] or st['only_m']:
        return 'אתחול'
    return 'זהה'


RANK = {'זהה': 0, 'אתחול': 1, 'שונה': 2, 'ריק': 3, 'חסר': 4}


def compare_fields(prod_fields, mine_fields, warm):
    res = {}
    for k, mv in mine_fields.items():
        pv = prod_fields.get(k)
        if pv is None:
            res[k] = {'verdict': 'חסר'}
            continue
        st = series_stats(pv, mv, warm)
        st['verdict'] = field_verdict(st)
        res[k] = st
    worst = max((RANK[r['verdict']] for r in res.values()), default=4)
    return res, [v for v, r in RANK.items() if r == worst][0]


def judge(name, variants, prod_fields, B, P, X, warm, kind='ours'):
    out = {'variants': []}
    for vn, fn in variants:
        try:
            mine = fn(B, P, X) if kind == 'ours' else fn(B, P)
        except Exception as e:   # noqa: BLE001
            out['variants'].append({'name': vn, 'error': repr(e)})
            continue
        fields, worst = compare_fields(prod_fields, mine, warm)
        out['variants'].append({'name': vn, 'verdict': worst, 'fields': fields})
    ok = [v for v in out['variants'] if v.get('verdict') in ('זהה', 'אתחול')]
    conv = out['variants'][0]
    if conv.get('verdict') in ('זהה', 'אתחול'):
        out['verdict'] = conv['verdict']
        out['match'] = conv['name']
    elif ok:
        out['verdict'] = 'שונה — השורש שוחזר' if ok[0]['name'].startswith('שחזור') else 'הגדרה שונה'
        out['match'] = ok[0]['name']
    else:
        out['verdict'] = 'לא תואם'
        out['match'] = None
    return out


def seq_compare(prod, mine, tol=1e-7):
    """השוואת רצפים (לבנים / קווים / קטעים): [(o,c)...]"""
    n = min(len(prod), len(mine))
    same, first_bad, mx = 0, None, 0.0
    for i in range(n):
        d = max(abs(prod[i][0] - mine[i][0]), abs(prod[i][1] - mine[i][1]))
        sc = abs(mine[i][1]) + 1e-12
        mx = max(mx, d)
        if d <= tol * sc:
            if first_bad is None:
                same += 1
        elif first_bad is None:
            first_bad = i
    return {'len_p': len(prod), 'len_m': len(mine), 'prefix_same': same, 'first_bad': first_bad, 'max_abs': mx}


# =====================================================================
# הרתמה ב־node: ערכי המוצר (chartlib.js + KLineChart), עותק בזיכרון בלבד
# =====================================================================

HARNESS = r"""
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const [ROOT, DATA, BENCH, OUT] = process.argv.slice(2);
const enc = (v) => (typeof v === 'number' ? (Number.isFinite(v) ? v : (Number.isNaN(v) ? 'nan' : (v > 0 ? 'inf' : '-inf'))) : null);
function loadLib() {
  const src = fs.readFileSync(path.join(ROOT, 'chartlib.js'), 'utf8');
  const sb = { console, Date, Math, JSON, Map, Set, WeakMap, Array, Number, Infinity, isFinite, Object, Intl };
  vm.createContext(sb);
  vm.runInContext(src.replace(/^export (async )?(function|const)/gm, '$1$2') + '\n;globalThis.L = Object.assign({}, _test, { isIntraday, trueRange });', sb);
  return sb.L;
}
function loadK() {
  let src = fs.readFileSync(path.join(ROOT, 'vendor/klinecharts/klinecharts.min.js'), 'utf8');
  const hook = 't.getSupportedIndicators=function(){return Object.keys(Qt)}';
  if (!src.includes(hook)) throw new Error('KLineChart: לא נמצאה נקודת החשיפה');
  src = src.replace(hook, hook + ',t.__indMap=function(){return Qt}');
  const sb = { console, Math, Date, JSON, Map, Set, WeakMap, Array, Number, Object, isFinite, Infinity, setTimeout, clearTimeout, Promise };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  sb.navigator = { userAgent: 'node', platform: 'Linux', maxTouchPoints: 0 };
  sb.document = { createElement: () => ({ getContext: () => ({ measureText: () => ({ width: 0 }) }), style: {} }), addEventListener() {}, documentElement: { style: {} } };
  sb.devicePixelRatio = 1; sb.addEventListener = () => {};
  vm.createContext(sb);
  vm.runInContext(src, sb);
  return sb.klinecharts;
}
const TZOFF = new Map();
function tzOffset(tz, ms) {
  const k = tz + '|' + Math.floor(ms / 3600000);
  if (TZOFF.has(k)) return TZOFF.get(k);
  let off = 0;
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms));
    const g = (t) => +p.find((x) => x.type === t).value;
    off = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms / 60000) * 60000;
  } catch (e) { off = 0; }
  TZOFF.set(k, off);
  return off;
}
const dayKeyFor = (tz) => (ms) => Math.floor((ms + tzOffset(tz, ms)) / 86400000);
const toBars = (d) => d.bars.map(([t, o, h, l, c, v]) => ({ timestamp: t * 1000, open: o, high: h, low: l, close: c, volume: v || 0 }));
const fieldsOf = (r, keys) => { const o = {}; for (const k of keys) o[k] = r.map((x) => enc(x && x[k])); return o; };
const keysOf = (r) => { const s = new Set(); for (const x of r) if (x && typeof x === 'object') for (const k of Object.keys(x)) s.add(k); return [...s]; };
(async () => {
  const L = loadLib();
  const d = JSON.parse(fs.readFileSync(DATA, 'utf8'));
  const bars = toBars(d);
  const bench = BENCH ? toBars(JSON.parse(fs.readFileSync(BENCH, 'utf8'))) : null;
  const tz = d.tz || 'America/New_York';
  const ctx = { intra: !!L.isIntraday(d.tf), dayKey: dayKeyFor(tz), cmp: bench };
  const res = { meta: { sym: d.sym, tf: d.tf, tz, n: bars.length, intra: ctx.intra, bench: !!bench } };
  for (const k of Object.keys(L.IND)) {
    const def = L.IND[k], params = def.p.map((x) => x[1]);
    try {
      let r = L.CALC[k](bars.map((b) => Object.assign({}, b)), params.slice(), ctx);
      if (r && typeof r.then === 'function') r = await r;
      const keys = def.f.map((x) => x[0]);
      res['P.' + k] = { params, fields: fieldsOf(r, keys), extra: keysOf(r).filter((x) => !keys.includes(x)), len: r.length };
    } catch (e) { res['P.' + k] = { params, error: String((e && e.stack) || e) }; }
  }
  const seqT = (arr) => ({ t: arr.map((b) => b.timestamp), o: arr.map((b) => b.open), h: arr.map((b) => b.high), l: arr.map((b) => b.low), c: arr.map((b) => b.close), v: arr.map((b) => b.volume) });
  for (const [k, fn] of [['ha', () => L.heikinAshi(bars)], ['renko', () => L.renko(bars)], ['lb', () => L.lineBreak(bars, 3)], ['kagi', () => L.kagi(bars, 0.04)]]) {
    try { res['T.' + k] = seqT(fn()); } catch (e) { res['T.' + k] = { error: String((e && e.stack) || e) }; }
  }
  const C = bars.map((b) => b.close);
  const H = { sma: () => L.sma(C, 20), ema: () => L.ema(C, 20), rma: () => L.rma(C, 14), wma: () => L.wma(C, 20), hma: () => L.hma(C, 21),
    dema: () => L.dema(C, 21), tema: () => L.tema(C, 21), stdev: () => L.stdev(C, 20), atr: () => L.atr(bars, 14), rsi: () => L.rsi(C, 14),
    tr: () => L.trueRange(bars), linreg: () => C.map((_, i) => { const v = L.linreg(C, 20, i); return typeof v === 'number' ? v : (v && typeof v === 'object' ? JSON.stringify(v) : null); }) };
  try { res['Z.zigzag'] = L.zigzag(bars, 0.05).map((s) => [s.i, s.price]); } catch (e) { res['Z.zigzag'] = { error: String(e) }; }
  for (const k of Object.keys(H)) { try { res['H.' + k] = H[k]().map((v) => (typeof v === 'string' ? v : enc(v))); } catch (e) { res['H.' + k] = { error: String(e) }; } }
  const K = loadK(), M = K.__indMap();
  res.meta.klc = K.version();
  for (const n of K.getSupportedIndicators()) {
    try {
      const inst = new M[n]();
      if (n === 'VOL') inst.calcParams = [];   // כמו chart.js: נפח בלי שלושת הממוצעים
      let r = inst.calc(bars.map((b) => Object.assign({}, b)), inst);
      if (r && typeof r.then === 'function') r = await r;
      if (!Array.isArray(r)) r = bars.map((b) => r[b.timestamp] || {});
      res['K.' + n] = { params: inst.calcParams, fields: fieldsOf(r, keysOf(r)) };
    } catch (e) { res['K.' + n] = { error: String((e && e.stack) || e) }; }
  }
  fs.writeFileSync(OUT, JSON.stringify(res));
})().catch((e) => { console.error(e); process.exit(1); });
"""


def load_bars(path):
    with open(path, encoding='utf-8') as fh:
        d = json.load(fh)
    b = d['bars']
    B = {'t': [x[0] * 1000 for x in b], 'o': [x[1] for x in b], 'h': [x[2] for x in b], 'l': [x[3] for x in b],
         'c': [x[4] for x in b], 'v': [x[5] or 0 for x in b]}
    return d, B


def run_product(out_dir, data_path, bench_path, tag):
    hp = os.path.join(out_dir, 'prod-harness.js')
    with open(hp, 'w', encoding='utf-8') as fh:
        fh.write(HARNESS)
    op = os.path.join(out_dir, 'prod-%s.json' % tag)
    subprocess.run(['node', hp, ROOT, data_path, bench_path or '', op], check=True)
    with open(op, encoding='utf-8') as fh:
        return json.load(fh)


def fmt(v):
    if v is None:
        return '—'
    if isinstance(v, float):
        return '%.3g' % v
    return str(v)


def compare_tf(out_dir, data_dir, sym, tf, bench_sym):
    data_path = os.path.join(data_dir, sym, tf + '.0.json')
    bp = os.path.join(data_dir, bench_sym, tf + '.0.json') if bench_sym else None
    bench_path = bp if bp and os.path.exists(bp) else None
    tag = '%s-%s' % (sym, tf)
    prod = run_product(out_dir, data_path, bench_path, tag)
    d, B = load_bars(data_path)
    N = len(B['c'])
    warm = min(2000, N // 3)
    X = {'intra': prod['meta']['intra'], 'day': day_keys([t // 1000 for t in B['t']], d.get('tz') or 'America/New_York'), 'bench': None}
    if bench_path:
        _, BB = load_bars(bench_path)
        X['bench'] = dict(zip(BB['t'], BB['c']))
    rep = {'meta': dict(prod['meta'], warm=warm), 'ours': {}, 'klc': {}, 'helpers': {}, 'transforms': {}}
    for k, variants in OURS.items():
        p = prod.get('P.' + k)
        if not p or 'error' in p:
            rep['ours'][k] = {'verdict': 'שגיאה', 'error': (p or {}).get('error', 'חסר')}
            continue
        r = judge(k, variants, p['fields'], B, p['params'], X, warm, 'ours')
        r['params'] = p['params']
        r['conv_params'] = CONV_PARAMS.get(k)
        r['extra'] = p.get('extra')
        rep['ours'][k] = r
    for k, variants in KLC.items():
        p = prod.get('K.' + k)
        if not p or 'error' in p:
            rep['klc'][k] = {'verdict': 'שגיאה', 'error': (p or {}).get('error', 'חסר')}
            continue
        r = judge(k, variants, p['fields'], B, p['params'], X, warm, 'klc')
        r['params'] = p['params']
        r['conv_params'] = CONV_PARAMS.get('K.' + k)
        rep['klc'][k] = r
    C = B['c']
    mineH = {'sma': sma(C, 20), 'ema': ema(C, 20), 'rma': rma(C, 14), 'wma': wma(C, 20), 'hma': i_hma(B, [21], X)['hma'],
             'hma_floor': i_hma(B, [21], X, 'floor')['hma'], 'dema': i_dema(B, [21], X)['dema'], 'tema': i_tema(B, [21], X)['tema'],
             'stdev': stdev(C, 20, 0), 'stdev_s': stdev(C, 20, 1), 'atr': atr(B, 14), 'rsi': rsi_wilder(C, 14), 'tr': true_range(B),
             'linreg': linreg(C, 20), 'ema_first': ema(C, 20, 'first')}
    for k, mv in mineH.items():
        pk = 'H.' + k.split('_')[0]
        pv = prod.get(pk)
        if isinstance(pv, list) and k == 'linreg':
            pv = [json.loads(v).get('end') if isinstance(v, str) and v.startswith('{') else v for v in pv]
        if not isinstance(pv, list):
            rep['helpers'][k] = {'verdict': 'שגיאה', 'error': str(pv)[:300]}
            continue
        st = series_stats(pv, mv, warm)
        st['verdict'] = field_verdict(st)
        rep['helpers'][k] = st
    # טרנספורמציות
    ha = prod.get('T.ha', {})
    if 'error' not in ha:
        mha = t_ha(B)
        rep['transforms']['ha'] = {k: dict(series_stats(ha[k], mha[k], 0), verdict=None) for k in 'ohlc'}
        rep['transforms']['ha']['t_same'] = ha['t'] == B['t']
        for k in 'ohlc':
            rep['transforms']['ha'][k]['verdict'] = field_verdict(rep['transforms']['ha'][k])
    rk = prod.get('T.renko', {})
    if 'error' not in rk and rk.get('o'):
        box = abs(rk['c'][0] - rk['o'][0])
        mine = t_renko(C, box)
        rep['transforms']['renko'] = dict(seq_compare(list(zip(rk['o'], rk['c'])), [(a, b) for a, b, _ in mine]), box=box,
                                          atr14_last=atr(B, 14)[-1], close_last=C[-1])
    lb = prod.get('T.lb', {})
    if 'error' not in lb and lb.get('o'):
        pl = list(zip(lb['o'], lb['c']))
        rep['transforms']['lb'] = {
            'bar': seq_compare(pl, [(a, b) for a, b, _ in t_line_break(B['o'], C, 3, 'bar')]),
            'close': seq_compare(pl, [(a, b) for a, b, _ in t_line_break(B['o'], C, 3, 'close')]),
            'bar_run': seq_compare(pl, [(a, b) for a, b, _ in t_line_break(B['o'], C, 3, 'bar', True)]),
        }
    kg = prod.get('T.kagi', {})
    if 'error' not in kg and kg.get('o'):
        pk = list(zip(kg['o'], kg['c']))
        rep['transforms']['kagi'] = {'threshold': seq_compare(pk, [(a, b) for a, b, _ in t_kagi(C, 0.04)]),
                                     'first-move': seq_compare(pk, [(a, b) for a, b, _ in t_kagi(C, 0.04, 'first-move')])}
    zp = prod.get('Z.zigzag')
    if isinstance(zp, list):
        zz = {}
        for tie in ('first', 'later'):
            mine = zigzag_pivots(B['h'], B['l'], 0.05, tie)
            same = sum(1 for a, b in zip(zp, mine) if a[0] == b[0] and abs(a[1] - b[1]) <= 1e-12 * abs(b[1]))
            zz[tie] = {'len_p': len(zp), 'len_m': len(mine), 'same': same,
                       'same_price_seq': sum(1 for a, b in zip(zp, mine) if abs(a[1] - b[1]) <= 1e-12 * abs(b[1]))}
        rep['zigzag_pivots'] = zz
    ks = prod.get('K.SAR', {}).get('fields', {}).get('sar')
    if ks:
        conv = sar(B, 0.02, 0.02, 0.2)
        n_side = n_cmp = 0
        for i in range(warm, N):
            if num(ks[i]) and conv[i] is not None:
                n_cmp += 1
                if (C[i] > ks[i]) != (C[i] > conv[i]):
                    n_side += 1
        flips_p = sum(1 for i in range(warm + 1, N) if num(ks[i]) and num(ks[i - 1]) and (C[i] > ks[i]) != (C[i - 1] > ks[i - 1]))
        flips_m = sum(1 for i in range(warm + 1, N) if conv[i] is not None and conv[i - 1] is not None and (C[i] > conv[i]) != (C[i - 1] > conv[i - 1]))
        rep['sar_side'] = {'bars': n_cmp, 'side_differs': n_side, 'flips_prod': flips_p, 'flips_wilder': flips_m}
    with open(os.path.join(out_dir, 'cmp-%s.json' % tag), 'w', encoding='utf-8') as fh:
        json.dump(rep, fh, ensure_ascii=False, indent=1)
    return rep


def summary_lines(rep):
    m = rep['meta']
    out = ['## %s %s — %d נרות, חימום %d' % (m['sym'], m['tf'], m['n'], m['warm']), '',
           '| מחוון | פסיקה | גרסה תואמת | הפרש יחסי מרבי / חציון / 500 אחרונים (מול המקובל) | נר ראשון שונה | פרמטרים | מקובל |',
           '|---|---|---|---|---|---|---|']
    for grp in ('ours', 'klc'):
        for k, r in rep[grp].items():
            if 'variants' not in r:
                out.append('| %s%s | %s | — | — | — | — | — |' % ('K.' if grp == 'klc' else '', k, r['verdict']))
                continue
            cv = r['variants'][0]
            fl = cv.get('fields', {})
            mr = max((f.get('max_rel_post', 0.0) for f in fl.values() if isinstance(f, dict)), default=None)
            md = max((f.get('p50_rel_post') or 0.0 for f in fl.values() if isinstance(f, dict)), default=None)
            mrr = max((f.get('max_rel_recent') or 0.0 for f in fl.values() if isinstance(f, dict)), default=None)
            fb = min((f['first_bad'] for f in fl.values() if isinstance(f, dict) and f.get('first_bad') is not None), default=None)
            out.append('| %s%s | %s | %s | %s / %s / %s | %s | %s | %s |' % ('K.' if grp == 'klc' else '', k, r['verdict'], r.get('match') or '—',
                                                                          fmt(mr), fmt(md), fmt(mrr), fmt(fb), r.get('params'), r.get('conv_params')))
    out.append('')
    for k, st in rep['helpers'].items():
        out.append('- עזר `%s`: %s (הפרש יחסי מרבי %s, נר ראשון שונה %s)' % (k, st.get('verdict'), fmt(st.get('max_rel')), fmt(st.get('first_bad'))))
    out.append('')
    tr = rep['transforms']
    if 'ha' in tr:
        out.append('- Heikin-Ashi: ' + ', '.join('%s %s' % (k, tr['ha'][k]['verdict']) for k in 'ohlc') + ', זמנים זהים: %s' % tr['ha']['t_same'])
    for k in ('renko', 'kagi'):
        if k in tr:
            out.append('- %s: %s' % (k, json.dumps(tr[k], ensure_ascii=False)))
    if 'lb' in tr:
        out.append('- שבירת 3 קווים: ' + json.dumps(tr['lb'], ensure_ascii=False))
    for k in ('zigzag_pivots', 'sar_side'):
        if k in rep:
            out.append('- %s: %s' % (k, json.dumps(rep[k], ensure_ascii=False)))
    out.append('')
    return out


# =====================================================================
# בדיקה עצמית — דוגמאות שחושבו ביד
# =====================================================================

def close(a, b, tol=1e-9):
    if a is None or b is None:
        return a is b
    return abs(a - b) <= tol * max(1.0, abs(b))


def eqlist(a, b, tol=1e-9):
    return len(a) == len(b) and all(close(x, y, tol) for x, y in zip(a, b))


def selftest():
    # SMA / EMA / RMA / WMA
    assert eqlist(sma([1, 2, 3, 4, 5], 3), [None, None, 2, 3, 4])
    assert eqlist(ema([2, 4, 6, 8, 12], 3), [None, None, 4, 6, 9])            # α=½, פתיחה (2+4+6)/3
    assert eqlist(ema([2, 4, 6, 8, 12], 3, 'first'), [2, 3, 4.5, 6.25, 9.125])
    assert eqlist(rma([2, 4, 6, 8, 12], 3), [None, None, 4, 16 / 3, 68 / 9])  # α=⅓
    assert eqlist(wma([1, 2, 3, 4], 3), [None, None, 14 / 6, 20 / 6])
    assert eqlist(csma([10, 20], 3, 1), [10, (1 * 20 + 2 * 10) / 3])
    # סטיית תקן של אוכלוסייה — הדוגמה הקלאסית: ממוצע 5, שונות 4
    assert close(stdev([2, 4, 4, 4, 5, 5, 7, 9], 8)[-1], 2.0)
    bb = k_boll({'c': [2, 4, 4, 4, 5, 5, 7, 9]}, [8, 2])
    assert close(bb['mid'][-1], 5) and close(bb['up'][-1], 9) and close(bb['dn'][-1], 1)
    # TR: (10,8,9) (12,9,11) (11,7,8) → 2, 3, 4
    B3 = {'o': [9, 9, 11], 'h': [10, 12, 11], 'l': [8, 9, 7], 'c': [9, 11, 8], 'v': [1, 1, 1]}
    assert true_range(B3) == [2, 3, 4]
    # RSI של Wilder, n=2, סגירות 1,2,3,2,3: נר 2 → 100; נר 3: רווח ½ הפסד ½ → 50; נר 4: ¾ מול ¼ → 75
    assert eqlist(rsi_wilder([1, 2, 3, 2, 3], 2), [None, None, 100, 50, 75])
    # RSI של Cutler, n=2: נר 3: רווח 1 הפסד 1 → 50; נר 4: רווח 1 הפסד 1 → 50
    assert eqlist(rsi_cutler([1, 2, 3, 2, 3], 2), [None, None, 100, 50, 50])
    # MACD על סדרה קבועה = 0
    m = k_macd({'c': [5.0] * 60}, [12, 26, 9])
    assert all(v == 0 for v in m['macd'] if v is not None) and m['macd'][-1] == 0
    # סטוכסטי: HH=5, LL=1, C=4 → 75; Williams %R → −25; KDJ: K=(2·50+75)/3, D=(2·50+K)/3, J=3K−2D
    Bs = {'h': [3, 4, 5], 'l': [1, 2, 3], 'c': [2, 3, 4], 'o': [2, 3, 4], 'v': [1, 1, 1]}
    assert close(stoch_raw(Bs['c'], Bs['h'], Bs['l'], 3)[-1], 75)
    assert close(k_wr(Bs, [3])['wr1'][-1], -25)
    kd = k_kdj(Bs, [3, 3, 3])
    assert close(kd['k'][-1], 175 / 3) and close(kd['d'][-1], (100 + 175 / 3) / 3) and close(kd['j'][-1], 3 * 175 / 3 - 2 * (100 + 175 / 3) / 3)
    # CCI n=3: TP 1,2,3 → ממוצע 2, סטייה ממוצעת ⅔ → (3−2)/(0.015·⅔) = 100
    Bc = {'h': [1, 2, 3], 'l': [1, 2, 3], 'c': [1, 2, 3]}
    assert close(k_cci(Bc, [3])['cci'][-1], 100)
    # A/D: ‏(10,8,9.5,V=100): CLV=½ → 50
    assert close(ad_line({'h': [10], 'l': [8], 'c': [9.5], 'v': [100]})[-1], 50)
    # OBV: סגירות 10,11,10.5,10.5 נפחים 100,200,50,70 → 0,200,150,150
    assert obv_line({'c': [10, 11, 10.5, 10.5], 'v': [100, 200, 50, 70]}) == [0, 200, 150, 150]
    # Heikin-Ashi: ‏(10,12,9,11) (11,13,10,12)
    ha = t_ha({'o': [10, 11], 'h': [12, 13], 'l': [9, 10], 'c': [11, 12]})
    assert ha == {'o': [10.5, 10.5], 'h': [12, 13], 'l': [9, 10], 'c': [10.5, 11.5]}
    # רנקו, תיבה 1: ‏10 → 11.2 (לבנה 10→11) → 12.1 (11→12) → 11.5 (כלום) → 9.9 (היפוך: 11→10)
    assert [(a, b) for a, b, _ in t_renko([10, 10.5, 11.2, 12.1, 11.5, 9.9], 1.0)] == [(10, 11), (11, 12), (11, 10)]
    # שבירת 3 קווים: נר ראשון 10→11, סגירות 12, 13, 12.5, 10.5 (לא שובר את 10), 9.5 (שובר) → 12→9.5
    lb = t_line_break([10, 0, 0, 0, 0, 0], [11, 12, 13, 12.5, 10.5, 9.5], 3)
    assert [(a, b) for a, b, _ in lb] == [(10, 11), (11, 12), (12, 13), (12, 9.5)]
    # קאגי 4%: ‏100,103,105 (קו 100→105),100.5 (היפוך: ≤100.8),100,99 (המשך),104 (היפוך: ≥102.96)
    assert [(a, b) for a, b, _ in t_kagi([100, 103, 105, 100.5, 100, 99, 104], 0.04)] == [(100, 105), (105, 99), (99, 104)]
    # קאגי בהתחלה מהשינוי הראשון: ‏100→99 (קו יורד בלי סף), 104 (היפוך: ≥ 99·1.04=102.96), 100 (≤ 104·0.96=99.84? לא) → [(100,99),(99,104)]
    assert [(a, b) for a, b, _ in t_kagi([100, 99, 104, 100], 0.04, 'first-move')] == [(100, 99), (99, 104)]
    # SAR על סדרה עולה: H=2..6, L=1..5 → 1, 1, 1.12, 1.3528 (Wilder, AF 0.02/0.02/0.2)
    Bu = {'h': [2, 3, 4, 5, 6], 'l': [1, 2, 3, 4, 5], 'c': [1.5, 2.5, 3.5, 4.5, 5.5]}
    assert eqlist(sar(Bu), [None, 1, 1, 1.12, 1.3528])
    # טנקן n=2 על H 3,5 L 1,2 → (5+1)/2 = 3
    assert close(i_ichimoku({'h': [3, 5], 'l': [1, 2], 'c': [2, 3]}, [2, 2, 2], {})['tenkan'][-1], 3)
    # רגרסיה ליניארית על קו ישר: ערך הקצה = הערך האחרון
    assert close(linreg([1, 3, 5, 7], 4)[-1], 7)
    # זיגזג 5%: ‏100→106 (שיא) → 100 (ירידה ≥5% מ־106: 100.7) → 106 (עלייה ≥5% מ־100)
    zz = zigzag_pivots([100, 106, 101, 100, 106], [100, 105, 100.5, 100, 105], 0.05)
    assert zz == [(0, 100), (1, 106), (3, 100), (4, 106)]
    # Aroon n=2: חלון 3 נרות; השיא לפני נר אחד → Up=100·(2−1)/2=50; השפל עכשיו → Down=100
    ar = i_aroon({'h': [1, 3, 2], 'l': [2, 2, 1]}, [2], {})
    assert close(ar['up'][-1], 50) and close(ar['dn'][-1], 100)
    print('selftest: כל הבדיקות עברו')


# =====================================================================

def main():
    ap = argparse.ArgumentParser(description='גל 5: אימות בלתי תלוי של המחוונים והטרנספורמציות של הגרף')
    ap.add_argument('--selftest', action='store_true')
    ap.add_argument('--out')
    ap.add_argument('--data', help='תיקיית disp של כלי הצילום (<סמל>/<מרווח>.0.json)')
    ap.add_argument('--sym', default='AAPL')
    ap.add_argument('--tfs', default='1D,5m')
    ap.add_argument('--bench', default='SPY')
    a = ap.parse_args()
    if a.selftest:
        selftest()
        return 0
    if not a.out or not a.data:
        ap.error('צריך --out ו־--data (או --selftest)')
    os.makedirs(a.out, exist_ok=True)
    lines = ['# גל 5 — השוואת מחוונים (נוצר על ידי tools/chart-deep/ind.py)', '']
    for tf in a.tfs.split(','):
        rep = compare_tf(a.out, a.data, a.sym, tf, a.bench)
        lines += summary_lines(rep)
    with open(os.path.join(a.out, 'summary.md'), 'w', encoding='utf-8') as fh:
        fh.write('\n'.join(lines) + '\n')
    print('נכתב:', os.path.join(a.out, 'summary.md'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
