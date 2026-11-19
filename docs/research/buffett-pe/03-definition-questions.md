# מכפיל באפט — שאלות ההגדרה (מחקר, 19/11/2026)

> המחקר של גל 5 ב־`docs/buffett-pe-audit.md`. עונה על שבע שאלות ההגדרה של `docs/buffett-pe.md`, ועל שאלה שמינית שעלתה בדרך.
> - **הציטוטים של באפט** — מהטקסט המלא של המכתבים באתר ברקשייר. הורדו ונבדקו מילה במילה (לא מסיכומים).
> - **הציטוטים של FASB ו־SEC** — מהמסמכים עצמם.
> - **מה לא הצלחתי לאחזר**: מאמר הדעה של באפט בוושינגטון פוסט (2002) והמאמר של Mauboussin ו־Callahan (2023) — חסומים (403). לא מצוטטים מהם משפטים שלא נבדקו.
> - **⛔ אף שינוי שמוצע כאן לא מיושם בלי אישור מפורש של המשתמש.** כל המלצה לשינוי מסומנת "דורש אישור".

## תקציר

| # | שאלה | היום | ההמלצה | אישור |
|---|---|---|---|---|
| 1 | מה באפט אמר על תגמול במניות | מורידים אחרי מס | **להשאיר.** באפט עקבי 24 שנה (1992–2016): תגמול = הוצאה | — |
| 2 | שיעור המס על התגמול | אפקטיבי GAAP של 12 חודשים, חסום 10%–35% | **לשנות**: השיעור שהחברה עצמה הפעילה ברווח המותאם (כשהיא מפרסמת אותו). גיבוי — הקיים, ברצועה צרה יותר. ב־NOW: רווח לפי באפט 2.20 → 2.02, מכפיל 42.3 → 45.9 | דורש אישור |
| 3 | הפחתה מרכישות | לא מורידים | **להשאיר.** אבל באפט עצמו קורא להפחתת **תוכנה** נרכשת "very real". להציג שורת מידע ולמדוד | שורת המידע — דורש אישור |
| 4 | תגמול במזומן, האצה, חד־פעמי | כל שורת התגמול בדוח התזרים | **12 חודשים — להשאיר**, ולהוסיף הערה על קפיצה. **בצפוי — שיעור עמיד** (חציון) | דורש אישור |
| 5 | דילול מול ניכוי — ספירה כפולה? | — | **אין ספירה כפולה** (FASB, Damodaran, Doran). להשאיר. תיקון קטן אפשרי: מספר המניות כשיש הפסד GAAP | התיקון — דורש אישור |
| 6 | `clamp(רחוב − GAAP, 0, תגמול)` | כשאין הודעות | **להשאיר כגבול עליון.** קודם לצמצם את המקרים: לקרוא גם 6-K. ולבדוק בבדיקה לאחור את "הפער פחות ההפחתה" | דורש אישור |
| 7 | מקור שמפרסם מכפיל אחרי תגמול | — | לא נמצא מקור מרכזי (מחקר נפרד: `01-…`, `02-…`) | — |
| 8 | (נוסף) ארגון מחדש ו"חד־פעמי" שחוזר | לא מורידים | באפט (2016) נגד ההתעלמות. למדוד את הגודל, לא לשנות עכשיו | דורש אישור |

---

## 1. מה באפט אמר על תגמול במניות

### 1.1 מכתב 1992 (נכתב 1/3/1993) — שלוש השאלות
[berkshirehathaway.com/letters/1992.html](https://www.berkshirehathaway.com/letters/1992.html)

> "It seems to me that the realities of stock options can be summarized quite simply: If options aren't a form of compensation, what are they? If compensation isn't an expense, what is it? And, if expenses shouldn't go into the calculation of earnings, where in the world should they go?"

"נראה לי שאפשר לסכם את המציאות של אופציות בפשטות: אם אופציות אינן צורה של תגמול, מה הן? אם תגמול אינו הוצאה, מה הוא? ואם הוצאות לא נכנסות לחישוב הרווח, לאן בכלל הן צריכות להיכנס?"

- **על הטענה "אין מזומן — אין עלות"**:
  > "So if you're a CEO and subscribe to this "no cash-no cost" theory of accounting, I'll make you an offer you can't refuse: Give us a call at Berkshire and we will happily sell you insurance in exchange for a bundle of long-term options on your company's stock."

  "אם אתה מנכ"ל ומאמין בתיאוריה 'אין מזומן — אין עלות', יש לי הצעה שאי אפשר לסרב לה: תתקשר לברקשייר, ונמכור לך בשמחה ביטוח תמורת צרור אופציות ארוכות על המניה שלך."

### 1.2 מכתב 1998 (1/3/1999) — "Accounting — Part 1": איך באפט עצמו מתקן את הרווח
[berkshirehathaway.com/letters/1998htm.html](https://www.berkshirehathaway.com/letters/1998htm.html)

זה הציטוט הקרוב ביותר לשיטה שלנו:

> "When we consider investing in an option-issuing company, we make an appropriate downward adjustment to reported earnings, simply subtracting an amount equal to what the company could have realized by publicly selling options of like quantity and structure. Similarly, if we contemplate an acquisition, we include in our evaluation the cost of replacing any option plan."

"כשאנחנו שוקלים להשקיע בחברה שמנפיקה אופציות, אנחנו מתקנים כלפי מטה את הרווח המדווח: פשוט מורידים סכום ששווה למה שהחברה הייתה מקבלת אילו מכרה בציבור אופציות באותה כמות ובאותו מבנה. כך גם ברכישה — אנחנו כוללים בהערכה את העלות של החלפת כל תוכנית אופציות."

- **הגודל**:
  > "The earning revisions that Charlie and I have made for options in recent years have frequently cut the reported per-share figures by 5%, with 10% not all that uncommon."

  "התיקונים שצ'רלי ואני עשינו בשנים האחרונות בגלל אופציות הורידו לעיתים קרובות 5% מהרווח למניה המדווח, ו־10% לא נדיר."
- **הוא מכיר בניכוי המס** (חשוב לשאלה 2):
  > "It is true, also, that companies receive a tax deduction when employee options are exercised; publicly-traded options deliver no such benefit. But there's an offset to these points: Options issued to employees are often repriced, a transformation that makes them much more costly than the public variety."

  "נכון גם שחברות מקבלות ניכוי במס כשעובדים מממשים אופציות, ואופציות סחירות לא נותנות הטבה כזו. אבל יש קיזוז: לאופציות של עובדים מורידים לעיתים קרובות את מחיר המימוש, וזה מייקר אותן בהרבה."
- **ג'נרל רי**: באפט החליף את תוכנית האופציות בתוכנית מזומן "with matching economics" — "באותה כלכלה". בדוח הפרו־פורמה של המיזוג, הוצאת התגמול עלתה ב־63 מיליון דולר, בלי שום שינוי כלכלי.
- **המשמעות לנו**:
  - המדד של באפט = **השווי ההוגן של ההענקות**. זה בדיוק מה ש־ASC 718 רושם, וזו השורה שאנחנו מורידים.
  - באפט לא כתב במפורש "אחרי מס". אבל הוא מונה את ניכוי המס כגורם שמקטין את העלות, ולכן ניכוי אחרי מס עקבי איתו.

### 1.3 מכתב 2002 (21/2/2003) — EBITDA ו"הוצאה שלא במזומן"
[berkshirehathaway.com/letters/2002pdf.pdf](https://www.berkshirehathaway.com/letters/2002pdf.pdf)

> "Trumpeting EBITDA (earnings before interest, taxes, depreciation and amortization) is a particularly pernicious practice. Doing so implies that depreciation is not truly an expense, given that it is a "non-cash" charge. That's nonsense."

"להבליט EBITDA זה נוהג מזיק במיוחד. הוא רומז שפחת אינו באמת הוצאה, כי הוא 'לא במזומן'. זו שטות."

> "Imagine, if you will, that at the beginning of this year a company paid all of its employees for the next ten years of their service […]. In the following nine years, compensation would be a "non-cash" expense – a reduction of a prepaid compensation asset established this year. Would anyone care to argue that the recording of the expense in years two through ten would be simply a bookkeeping formality?"

"דמיינו שבתחילת השנה חברה שילמה לכל עובדיה מראש על עשר שנות עבודה. בתשע השנים הבאות התגמול יהיה הוצאה 'לא במזומן' — הקטנה של נכס תגמול ששולם מראש. מישהו יטען שרישום ההוצאה בשנים 2–10 הוא רק פורמליות?"

- **הלקח**: "לא במזומן" ≠ "לא עלות". זה הטיעון המרכזי של מי שמוציא תגמול מהרווח, ובאפט דוחה אותו.
- **באותו מכתב**, על מאבק הרישום כהוצאה:
  > "Many CEOs also fought expensing because they knew that the obscene megagrants of options they craved would be slashed if the true costs of these had to be recorded."

  "מנכ"לים רבים נאבקו ברישום כהוצאה, כי ידעו שההענקות הענקיות והמגונות שהשתוקקו להן יקוצצו אם יצטרכו לרשום את עלותן האמיתית."

### 1.4 2002 — מאמר הדעה בוושינגטון פוסט ואסיפת בעלי המניות
- **"Stock Options and Common Sense"**, The Washington Post, ‏9/4/2002.
  - הטקסט המלא לא אוחזר: הארכיון בתשלום (403), ולא נמצא עותק נאמן. לכן לא מצוטט ממנו משפט.
  - לפי סיקור משני ([CEI](https://cei.org/?p=62505)): באפט טען שם שמודל Black-Scholes מספיק כדי לתמחר אופציות של עובדים.
- **באסיפה של מאי 2002** — לפי רשימות של משתתף ([Motley Fool](https://www.fool.com/specials/2002/05/07/foolcom-notes-from-omaha-special-may-7-2.aspx)), לא תמליל רשמי:
  > "I don't have a problem with options per se, but I have trouble with them not being counted as expenses."

  "אין לי בעיה עם אופציות עצמן. יש לי בעיה עם זה שלא סופרים אותן כהוצאה."

### 1.5 מכתב 2015 (27/2/2016) — "the most egregious example"
[berkshirehathaway.com/letters/2015ltr.pdf](https://www.berkshirehathaway.com/letters/2015ltr.pdf)

> "I suggest that you ignore a portion of GAAP amortization costs. But it is with some trepidation that I do that, knowing that it has become common for managers to tell their owners to ignore certain expense items that are all too real. "Stock-based compensation" is the most egregious example. The very name says it all: "compensation." If compensation isn't an expense, what is it? And, if real and recurring expenses don't belong in the calculation of earnings, where in the world do they belong?"

"אני מציע להתעלם מחלק מהוצאות ההפחתה של GAAP. אבל אני עושה זאת בחשש, כי נעשה מקובל שמנהלים אומרים לבעלים להתעלם מהוצאות אמיתיות לגמרי. 'תגמול מבוסס מניות' הוא הדוגמה הבוטה ביותר. השם אומר הכל: 'תגמול'. אם תגמול אינו הוצאה, מה הוא? ואם הוצאות אמיתיות וחוזרות לא שייכות לחישוב הרווח, איפה בכלל הן שייכות?"

> "Wall Street analysts often play their part in this charade, too, parroting the phony, compensation-ignoring "earnings" figures fed them by managements."

"גם האנליסטים בוול סטריט משחקים תפקיד בהצגה הזו: הם חוזרים כתוכים על 'רווחים' מזויפים שמתעלמים מהתגמול, כפי שההנהלות מאכילות אותם."

- **זה בדיוק "רווח הרחוב"** — הבסיס של המכפיל הצפוי של Yahoo. הניכוי שלנו מבטל את מה שבאפט מבקר כאן.
- **באותה פסקה** מופיעה גם ההבחנה על ההפחתה (שאלה 3): להתעלם רק מ"חלק" ממנה.

### 1.6 מכתב 2016 (25/2/2017) — "adjusted earnings" ו"מעבדת החשבונאות"
[berkshirehathaway.com/letters/2016ltr.pdf](https://www.berkshirehathaway.com/letters/2016ltr.pdf)

> "Too many managements – and the number seems to grow every year – are looking for any means to report, and indeed feature, "adjusted earnings" that are higher than their company's GAAP earnings. […] Two of their favorites are the omission of "restructuring costs" and "stock-based compensation" as expenses."

"יותר מדי הנהלות — ונראה שמספרן גדל כל שנה — מחפשות כל דרך לדווח, ואף להבליט, 'רווח מותאם' גבוה מרווח ה־GAAP. שתיים מהשיטות האהובות עליהן: להשמיט את 'עלויות הארגון מחדש' ואת 'התגמול מבוסס המניות' מההוצאות."

> "To say "stock-based compensation" is not an expense is even more cavalier. CEOs who go down that road are, in effect, saying to shareholders, "If you pay me a bundle in options or restricted stock, don't worry about its effect on earnings. I'll 'adjust' it away.""

"לומר ש'תגמול מבוסס מניות' אינו הוצאה זה עוד יותר קל דעת. מנכ"לים שהולכים בדרך הזו אומרים בעצם לבעלי המניות: 'אם תשלמו לי צרור אופציות או מניות חסומות, אל תדאגו להשפעה על הרווח. אני "אתאים" אותה החוצה.'"

> "If CEOs want to leave out stock-based compensation in reporting earnings, they should be required to affirm to their owners one of two propositions: why items of value used to pay employees are not a cost or why a payroll cost should be excluded when calculating earnings."

"אם מנכ"לים רוצים להשמיט את התגמול מבוסס המניות מהרווח, צריך לחייב אותם להוכיח לבעלים אחת משתי טענות: למה דברים בעלי ערך שמשמשים לתשלום לעובדים אינם עלות, או למה עלות שכר צריכה לצאת מחישוב הרווח."

### 1.7 Owner Earnings — מכתב 1986 (27/2/1987), הנספח על Scott Fetzer
[berkshirehathaway.com/letters/1986.html](https://www.berkshirehathaway.com/letters/1986.html)

> "These represent (a) reported earnings plus (b) depreciation, depletion, amortization, and certain other non-cash charges such as Company N's items (1) and (4) less (c) the average annual amount of capitalized expenditures for plant and equipment, etc. that the business requires to fully maintain its long-term competitive position and its unit volume."

"אלה הם (א) הרווח המדווח, ועוד (ב) פחת, אזילה, הפחתה וחיובים אחרים שלא במזומן — כמו פריטים (1) ו־(4) של חברה N, פחות (ג) הממוצע השנתי של ההשקעות ההוניות שהעסק צריך כדי לשמור לגמרי על מעמדו התחרותי לטווח ארוך ועל היקף פעילותו."

- **ה"חיובים שלא במזומן" שבאפט מחזיר** הם **חשבונאות רכישה**, לא תגמול:
  - פריט (1): "non-cash inventory costs" — עלויות מלאי שנוצרו מהשערוך ברכישה.
  - פריט (4): "deferred-tax acrobatics" — אקרובטיקה של מס נדחה.
  - ובלשונו: "none of these newly-created accounting costs […] are deductible for income tax purposes" — אף אחת מהעלויות החשבונאיות החדשות האלה לא מותרת בניכוי לצורכי מס.
- **מכאן שאי אפשר להשתמש ב־Owner Earnings כדי להחזיר תגמול במניות**. "לא במזומן" לא מספיק (סעיף 1.3), והמכתבים של 1998, 2015 ו־2016 אומרים זאת במפורש.
- **הערה על השם**: "רווח לפי באפט" שלנו **אינו** Owner Earnings. הוא לא מוריד השקעות הוניות ולא מחזיר פחת. זה רווח עם שני התיקונים של באפט: תגמול = הוצאה, והפחתה מרכישה = לרוב לא.

### 1.8 צ'רלי מאנגר
- **אסיפת 2003, על EBITDA** — הנוסח משתנה בין התמלילים ([סיכום עם מקורות](https://www.oldschoolvalue.com/?p=19178)):
  > "I think you would understand any presentation using the word EBITDA if every time you saw that word, you just substituted the phrase 'bull[…] earnings.'"

  "תבינו כל מצגת עם המילה EBITDA, אם בכל פעם שתראו אותה פשוט תחליפו אותה ב'רווח של שטויות'."
- **אסיפת 2002, על המתנגדים לרישום אופציות כהוצאה** — לפי רשימות המשתתף (Motley Fool, לא תמליל): מאנגר אמר שהיה מעדיף להתפרנס מנגינה בפסנתר בבית בושת מאשר לייצג את העמדה הציבורית נגד הרישום.

### 1.9 המסקנה לשאלה 1
- **אין מחלוקת בתוך באפט**: חמישה מכתבים (1992, 1998, 2002, 2015, 2016) ואסיפות — תגמול במניות הוא הוצאה.
- **ההיקף**: התיקון שלו ב־1998 (5%–10%) נעשה על רווח שבו האופציות לא נרשמו בכלל. היום GAAP כבר כולל את התגמול, ולכן התיקון שלנו נדרש **רק כשמתחילים מ"רווח הרחוב"**. וזה מה שאנחנו עושים: `pol=0` (הרווח המותאם כולל) → אפס.
- **ההמלצה**: **להשאיר את העיקרון כמו שהוא.**

---

## 2. שיעור המס על התגמול

### 2.1 מה עושים היום
`ctx` ב־`analysis.js`:
- `t = clamp(מס ÷ רווח לפני מס, 0.10, 0.35)` — של 12 החודשים (`nowP`), מ־GAAP.
- ברירת המחדל 21% — כשאין רווח לפני מס חיובי.
- הניכוי: `Q.sbc × (1 − t) ÷ Q.sh` לכל רבעון, ובצפוי אותו `t`.

### 2.2 החשבונאות והמס — למה ההוצאה בדוחות ≠ הניכוי במס
- **FAS 123(R) ‏¶58** — היום ASC 718-740 ([FASB](https://storage.fasb.org/fas123r.pdf)):
  > "allowable tax deductions are generally measured as the intrinsic value of an instrument on a specified date. The time value component, if any, of the fair value of an instrument generally is not tax deductible. Therefore, tax deductions generally will arise in different amounts and in different periods from compensation cost recognized in financial statements."

  "הניכויים המותרים במס נמדדים בדרך כלל לפי הערך הפנימי של המכשיר ביום מסוים. רכיב ערך הזמן שבשווי ההוגן בדרך כלל לא מותר בניכוי. לכן הניכויים במס נוצרים בסכומים אחרים ובתקופות אחרות מההוצאה שנרשמת בדוחות."
  - מניה חסומה (RSU) — הניכוי לפי שווי המניה ביום ההבשלה.
  - אופציה רגילה (NQSO) — הניכוי לפי הרווח במימוש.
- **ההפרש = "excess tax benefit"** (הגדרה זהה ב־123R וב־ASU 2016-09):
  > "The excess tax benefit is the amount resulting from a tax deduction for compensation in excess of compensation expense recognized for financial reporting purposes."

  "הטבת המס העודפת היא הסכום שנובע מניכוי במס על תגמול, מעבר להוצאת התגמול שנרשמה בדוחות הכספיים."
- **ASU 2016-09** — מ־2017 ההפרש נכנס להוצאות המס בדוח רווח והפסד ([FASB](https://storage.fasb.org/ASU%202016-09.pdf)):
  > "All excess tax benefits and tax deficiencies (including tax benefits of dividends on share-based payment awards) should be recognized as income tax expense or benefit in the income statement."

  "כל הטבות המס העודפות וחוסרי המס (כולל הטבות מס על דיבידנדים על הענקות) יוכרו כהוצאה או הטבה של מסים על ההכנסה בדוח רווח והפסד."
  - **התוצאה**: שיעור המס האפקטיבי ב־GAAP זז עם מחיר המניה. מניה שעלתה = ניכוי גדול מההוצאה = שיעור אפקטיבי נמוך.
- **סעיף 162(m) בקוד המס האמריקאי** ([LII](https://www.law.cornell.edu/uscode/text/26/162)):
  > "no deduction shall be allowed […] for applicable employee remuneration with respect to any covered employee to the extent that the amount of such remuneration for the taxable year with respect to such employee exceeds $1,000,000."

  "לא יותר ניכוי על תגמול לעובד מכוסה (בכירים) מעבר ל־1,000,000 דולר בשנה."
  - חלק מהתגמול במניות של הבכירים לא מותר בניכוי בכלל.
  - גם אופציות מסוג ISO לא מזכות בניכוי (לרוב).
  - בחלק מהמדינות מחוץ לארה"ב הניכוי מוגבל.

### 2.3 מה ה־SEC דורש מהחברות — C&DI 102.11 (מ־17/5/2016)
[sec.gov — Non-GAAP C&DIs](https://www.sec.gov/corpfin/non-gaap-financial-measures)

> "If a measure is a performance measure, the registrant should include current and deferred income tax expense commensurate with the non-GAAP measure of profitability. In addition, adjustments to arrive at a non-GAAP measure should not be presented "net of tax." Rather, income taxes should be shown as a separate adjustment and clearly explained."

"אם המדד הוא מדד ביצוע, על החברה לכלול הוצאות מס שוטפות ונדחות התואמות את מדד הרווח שאינו GAAP. בנוסף, ההתאמות לא יוצגו 'נטו ממס'. המסים יוצגו כהתאמה נפרדת ויוסברו בבירור."

- **המשמעות**: לכל רווח מותאם יש **שיעור מס משלו**, והוא גלוי (או ניתן לחילוץ) מטבלת ההתאמה.

### 2.4 מה החברות עושות בפועל — "non-GAAP tax rate"
חברות רבות (בעיקר טכנולוגיה) מפעילות **שיעור מס קבוע לטווח ארוך** על כל הרווח המותאם. NOW, בהודעה של הרבעון השלישי 2026 (8-K מ־28/10/2026, [EDGAR](https://www.sec.gov/Archives/edgar/data/1373715/000137371526000092/erq3fy26.htm)):

> "We use a non-GAAP effective tax rate for evaluating our operating results to provide consistency across reporting periods. Based on our long-term projections, we are using a non-GAAP tax rate of 21% for the three and nine months ended September 30, 2026 and 20% for the three and nine months ended September 30, 2025."

"אנחנו משתמשים בשיעור מס אפקטיבי שאינו GAAP כדי לשמור על עקביות בין תקופות. לפי התחזיות שלנו לטווח ארוך, אנחנו מפעילים שיעור של 21% על שלושת ותשעת החודשים שהסתיימו ב־30/9/2026, ו־20% על אותן תקופות ב־2025."

- **אימות מטבלת ההתאמה** (במיליוני דולר): שיעור הרווח המותאם = (מס GAAP + "Income tax effects and adjustments") ÷ (רווח לפני מס GAAP + ההתאמות לפני מס).
  - **רבעון 3/2026**: (93 + 184) ÷ (370 + 633 + 198 + 35 + 87 − 7) = 277 ÷ 1,316 = **21.0%** ✓.
  - **רבעון 4/2025**: (140 + 100) ÷ (541 + 494 + 41 + 65 + 21 + 37) = 240 ÷ 1,199 = **20.0%** ✓.
- **אותה נוסחה עובדת לכל חברה שמצייתת ל־102.11**, גם כשהיא לא כותבת את השיעור במילים.

### 2.5 הספרות — זהירות: החברות בוחרות שיעורים "נוחים"
Chen, Chiu, Shevlin & Wang, *Taxes in Non-GAAP Reporting: Evidence of Strategic Behavior in Selecting Tax Rates Applied to Exclusions*, Management Science 69(5), 2023 ([RePEc](https://ideas.repec.org/a/inm/ormnsc/v69y2023i5p3100-3120.html)):

> "Second, among firms that disclose the tax effects of exclusions, we find that managers strategically select the tax rates applied to exclusions to achieve after-tax earnings targets. Third, manager-reported non-GAAP earnings are less persistent for future operating earnings and cash flows relative to non-GAAP earnings calculated by applying various benchmark tax rates to exclusions."

"שנית, בין החברות שמגלות את השפעת המס של ההחרגות, המנהלים בוחרים באופן אסטרטגי את שיעורי המס על ההחרגות כדי להגיע ליעדי רווח אחרי מס. שלישית, הרווח המותאם שהמנהלים מדווחים יציב פחות (כמנבא לרווח התפעולי ולתזרים העתידיים) מרווח מותאם שמחושב בשיעורי מס של ייחוס."

- **המשמעות**: שיעור המס של החברה הוא הדרך **המדויקת** להפוך את ההחרגה שלה. אבל הוא לא תמיד "האמת הכלכלית".
- **ההגנה**: לחסום אותו ברצועה סבירה.

### 2.6 דוגמה במספרים — NOW, ‏12 החודשים עד 30/9/2026
המקורות: ההודעות ל־Q4/2025 ול־Q3/2026, דרך EDGAR. רווח הרחוב 3.79 = 0.92 + 2.87, ‏GAAP ‏1.39 = 0.38 + 1.01 — זהה ל־QA ב־`docs/buffett-pe.md`.

**הנתונים**:
- התגמול בדוח התזרים: 494 (Q4/25) + 1,829 (9 חודשים 2026) = 2,323 מיליון. כ־$2.23 למניה לפני מס.
- שיעור המס האפקטיבי ב־GAAP ל־12 חודשים: (140 + 437) ÷ (541 + 1,481) = **28.5%**.

| שיטה | `t` | הניכוי אחרי מס | רווח לפי באפט | המכפיל ב־$92.75 |
|---|---|---|---|---|
| **היום** — GAAP אפקטיבי של 12 חודשים | 28.5% | $1.60 | **$2.20** | **42.3** |
| השיעור של הרווח המותאם (20% ב־Q4/25, 21% ב־2026) | 20%–21% | $1.77 | **$2.02** | **45.9** |
| 21% קבוע | 21% | $1.76 | $2.03 | 45.8 |

- **הפער**: 8% ברווח לפי באפט (−$0.17), ו־3.6 נקודות במכפיל.
- **הצפוי**: הניכוי גדל באותו יחס, (1−0.21)÷(1−0.285) = ×1.105.
- **למה ה־GAAP גבוה כאן** — הסבר אפשרי, לא נבדק בדוח השנתי:
  - ההפחתה מרכישות קפצה ב־2026 (198 ברבעון 3 מול 33 שנה קודם). ברכישה של מניות (לא של נכסים) היא לרוב לא מותרת בניכוי — כמו שבאפט כתב ב־1986.
  - ועוד פריטים בדידים.
  - **אם כך, אלה פריטים שלא קשורים לתגמול** — ובכל זאת מקטינים אצלנו את הניכוי שלו.

### 2.7 לאן כל שיטה מטה
| מצב בחברה | ה־GAAP האפקטיבי מול השיעור המותאם | ההשפעה אצלנו היום |
|---|---|---|
| הפחתה לא מותרת בניכוי, הפסדים בחו"ל עם הפרשה להערכת שווי, 162(m) | גבוה יותר | ניכוי קטן מדי — **רווח לפי באפט גבוה מדי** (NOW) |
| מניה שעלתה — הטבות מס עודפות (ASU 2016-09), זיכויי מחקר, הטבה בדידה | נמוך יותר (עד רצפת 10%) | ניכוי גדול מדי — רווח לפי באפט נמוך מדי |
| רווח לפני מס קטן או שלילי | לא יציב, נחסם או 21% | אקראי |

- **פרדוקס**: כשמחיר המניה עולה, ההטבה העודפת מורידה את שיעור המס האפקטיבי. ה־`(1−t)` שלנו גדל, ואנחנו מורידים **יותר** תגמול.
- **אבל כלכלית ההפך**: באותו מצב ניכוי המס האמיתי על התגמול **גדל** (הוא לפי שווי ההבשלה), כלומר העלות נטו קטנה. השיטה של היום נעה בכיוון ההפוך לכלכלה.

### 2.8 ההמלצה (⛔ דורש אישור המשתמש)
1. **שיעור ראשי — השיעור שהחברה עצמה הפעילה על הרווח המותאם**, לכל רבעון.
   - **למה**: "רווח לפי באפט" = רווח הרחוב שבו התגמול מטופל כמו כל הוצאה אחרת. החברה מיסתה את כל שאר הרווח המותאם בשיעור הזה, ולכן ההחזרה העקבית היא בדיוק `SBC × (1 − t_ng)`.
   - **מאיפה**: המסווג (`lib/secsbc.js`) כבר קורא את ההודעה של כל רבעון. אפשר לחלץ ממנה משפט בתבנית `non-GAAP (effective )?tax rate of NN%`, או לחשב את השיעור מטבלת ההתאמה (סעיף 2.4).
   - **ההגנה (סעיף 2.5)**: לקבל רק שיעור ברצועה 10%–30%. מחוץ לרצועה — לגיבוי.
2. **גיבוי — השיטה של היום, ברצועה צרה יותר** (מועמדת: 15%–26%).
   - **התקרה**: השיעור המשולב בארה"ב (21% פדרלי + מס מדינה) הוא כ־25.7% בממוצע משוקלל, לפי [Tax Foundation](https://taxfoundation.org/data/all/federal/us-corporate-income-tax-more-competitive/). שיעור אפקטיבי מעל זה מעיד בדרך כלל על פריטים שלא מותרים בניכוי, ולא על ערך הניכוי של התגמול.
   - **הרצפה**: שיעור אפקטיבי נמוך מאוד נובע לרוב מהטבות בדידות (סעיף 2.7), ולא מערך הניכוי של התגמול.
   - הרצועה תיקבע לפי המדידה (2.9), לא לפי ההערכה הזו.
3. **לא מומלץ: 21% קבוע לכולם.** פשוט, ובמקרה קרוב ל־NOW, אבל שגוי לכל חברה ששיעור המס המותאם שלה רחוק מ־21%. כמה רחוק — ייבדק במדידה (2.9).

### 2.9 איך מודדים
- **הכלים**: `tools/buffett-deep/` (`prfetch.js` שומר את ההודעות, `model.js` מחשב לפי רבעון).
- **הצעדים**:
  1. **הכיסוי**: לספור בהודעות השמורות כמה חברות כותבות שיעור במילים, וכמה אפשר לחשב מהטבלה.
  2. **ההשוואה**: לכל חברה ולכל רבעון — `t` של היום מול `t_ng`. ההשפעה על הרווח לפי באפט היא ‎`Δ = SBC/sh × (t_ng − t)`‎, ועל המכפיל — ביחס הפוך.
  3. **הדוח**: התפלגות `Δ/רווח לפי באפט` (חציון, האחוזון ה־90, מספר החברות מעל 5%) ו־10 החברות עם הפער הגדול ביותר, כל אחת עם שורת המקור מההודעה.
- **קריטריון מוצע**: אם ביותר מ־10% מהחברות הרווח לפי באפט זז ביותר מ־5% — זה שינוי שמצדיק את ההחלטה. ההחלטה עצמה — של המשתמש.

---

## 3. הפחתה מרכישות (amortization of acquired intangibles)

### 3.1 ההחלטה היום
- **לא מורידים** — "לפי באפט, לרוב לא עלות כלכלית".
- **בפועל**: כשהחברה מוציאה את ההפחתה מהרווח המותאם (רוב החברות), גם הרווח לפי באפט בלעדיה.

### 3.2 באפט — בעד ההחלטה
- **נספח המוניטין, מכתב 1983** ("Goodwill and its Amortization: The Rules and The Realities", [1983.html](https://www.berkshirehathaway.com/letters/1983.html)):
  > "We believe managers and investors alike should view intangible assets from two perspectives: In analysis of operating results – that is, in evaluating the underlying economics of a business unit – amortization charges should be ignored. […] In evaluating the wisdom of business acquisitions, amortization charges should be ignored also. They should be deducted neither from earnings nor from the cost of the business. This means forever viewing purchased Goodwill at its full cost, before any amortization."

  "אנחנו סבורים שמנהלים ומשקיעים צריכים לראות נכסים לא מוחשיים משתי נקודות מבט. בניתוח התוצאות התפעוליות — כלומר בהערכת הכלכלה של יחידה עסקית — יש להתעלם מחיובי ההפחתה. […] גם בהערכת החוכמה של רכישות יש להתעלם מהם: לא להוריד אותם מהרווח ולא מעלות העסק. כלומר, לראות תמיד את המוניטין שנרכש בעלותו המלאה, לפני הפחתה."
- **מכתב 2016** ([2016ltr.pdf](https://www.berkshirehathaway.com/letters/2016ltr.pdf)):
  > "In our opinion, most of those amortization "expenses" are not truly an economic cost."

  "לדעתנו, רוב 'הוצאות' ההפחתה האלה אינן באמת עלות כלכלית."
  - ועוד באותו מכתב: "My judgment is that about 20% of the 2016 charge is a "real" cost" — "להערכתי, כ־20% מהחיוב של 2016 הם עלות 'אמיתית'".
- **מכתב 1986**: Owner Earnings מחזיר את ההפחתה ואת שאר חשבונאות הרכישה (סעיף 1.7).

### 3.3 באפט — ההסתייגות: תוכנה נרכשת היא כן עלות
מכתב 2014 ([2014ltr.pdf](https://www.berkshirehathaway.com/letters/2014ltr.pdf)); הנוסח כמעט זהה ב־2015:

> "Some truly deplete over time, while others in no way lose value. For software, as a big example, amortization charges are very real expenses. The concept of making charges against other intangibles, such as the amortization of customer relationships, however, arises through purchase-accounting rules and clearly does not reflect reality. […] We would call about 20% of these "real," the rest not."

"חלקם באמת נשחקים עם הזמן, ואחרים לא מאבדים ערך כלל. בתוכנה, כדוגמה גדולה, חיובי ההפחתה הם הוצאות אמיתיות מאוד. לעומת זאת, הרעיון לחייב נכסים לא מוחשיים אחרים, כמו קשרי לקוחות, נובע מכללי חשבונאות הרכישה וברור שאינו משקף את המציאות. […] את כ־20% מהם היינו מכנים 'אמיתיים', ואת השאר לא."

- **ה־20% של באפט הוא התמהיל של ברקשייר**: בעיקר קשרי לקוחות ומותגים.
- **בחברות תוכנה וטכנולוגיה**, חלק גדול מהנכסים הנרכשים הוא **טכנולוגיה מפותחת** — ובאפט היה קורא להפחתה שלה "very real".
- **הגודל ב־NOW**: ההפחתה מרכישות ב־12 החודשים = 41 + 494 = 535 מיליון. כ־$0.51 למניה לפני מס, כ־$0.41 אחרי 21% — **כ־20% מהרווח לפי באפט** ($2.02).

### 3.4 הצד השני — ביקורת על התעלמות מהפחתה ברכישות חוזרות
- **Damodaran** (שקפי הקורס, [session8slides.pdf](https://pages.stern.nyu.edu/~adamodar/podcasts/valUGspr20/session8slides.pdf)): רכישות הן השקעה הונית.
  > "Acquisitions of other firms, since these are like capital expenditures […] Adjusted Net Cap Ex = Net Capital Expenditures + Acquisitions of other firms - Amortization of such acquisitions […] Most firms do not do acquisitions every year. Hence, a normalized measure of acquisitions (looking at an average over time) should be used"

  "רכישות של חברות אחרות, כי הן כמו השקעות הוניות […] השקעה הונית נטו מתואמת = השקעה הונית נטו + רכישות − ההפחתה של הרכישות האלה […] רוב החברות לא רוכשות כל שנה, ולכן יש להשתמש במדד מנורמל (ממוצע לאורך זמן)."
- **באפט עצמו (1983)** מתעלם מההפחתה ברווח, אבל **סופר את מלוא מחיר הרכישה בהון** ("forever viewing purchased Goodwill at its full cost").
  - מכפיל רווח לא רואה הון.
  - לכן בחברה שקונה צמיחה ברכישות חוזרות, מכפיל בלי הפחתה ובלי ניכוי ההשקעה ברכישות **מחמיא** לה.
- **בגודל**: ההפחתה היא **ההתאמה הגדולה ביותר בדולרים** ברווחים המותאמים של S&P 500 ([Calcbench](https://calcbench.blogspot.com/2025/06/non-gaap-analysis-part-ii-types-of.html)):
  > "amortization of intangibles accounted for 31 percent of the total non-GAAP adjustments in 2024"

  "הפחתת נכסים לא מוחשיים היוותה 31% מכלל ההתאמות של הרווח המותאם ב־2024."
  - ב־2023 ([Calcbench](https://calcbench.blogspot.com/2024/05/special-report-non-gaap-adjustments-in.html)): ‎$60.4 מיליארד מתוך $181.5 מיליארד.

### 3.5 ההמלצה
- **להשאיר את ההגדרה** (לא מורידים הפחתה): זו עמדת באפט המפורשת.
- **שתי תוספות (⛔ דורשות אישור)**:
  1. **שורת מידע ב־`bufSheet`**: "הפחתה מרכישות אחרי מס: $X למניה — לא הורדה". מראה כמה מהפער רחוב−GAAP נשאר בחוץ, בלי לשנות את המכפיל.
  2. **בדיקה (לא שינוי) של חלק הטכנולוגיה**:
     - **המקור**: ב־XBRL יש ברוב החברות פילוח של הנכסים הלא מוחשיים לפי סוג (`FiniteLivedIntangibleAssetsByMajorClassAxis`: ‏`DevelopedTechnologyRightsMember` מול `CustomerRelationshipsMember`).
     - **הקירוב**: הפחתה × (חלק הטכנולוגיה מהסך הגולמי) × (1−t) = מה שבאפט היה קורא לו "real".
     - **אם יימצא חומרי** (למשל מעל 5% מהרווח לפי באפט ביותר מעשירית מהחברות) — להציג למשתמש כאפשרות להגדרה.
- **מדידה**: `AmortizationOfIntangibleAssets` מ־XBRL לכל 526 החברות: ההתפלגות של "הפחתה אחרי מס ÷ רווח לפי באפט", וחלק הטכנולוגיה איפה שיש פילוח.

---

## 4. תגמול שמסולק במזומן, האצה ברכישה, הענקות חד־פעמיות

### 4.1 מה בעצם יש ב־`Q.sbc`
- **המקור**: שורת התגמול **בדוח התזרים** — התוספת של הוצאה שלא במזומן.
  - XBRL: `ShareBasedCompensation` / `AllocatedShareBasedCompensationExpense`.
  - IFRS: `AdjustmentsForSharebasedPayments`.
  - ב־`lib/fundamentals.js`: `sbc: ['cf']`.
- **מה זה אומר**: יש כאן רק הענקות שמסולקות **במניות**. הוצאה על הענקה שמסולקת במזומן (התחייבות) נשארת ב־GAAP, אבל לא נכנסת לשורה הזו.
- **פער קטן מול ההתאמה**: ב־NOW, ‏9 חודשים 2026 — 1,829 בתזרים מול 1,846 בטבלת ההתאמה.

### 4.2 מה החברות מוציאות **מעבר** לשורה הזו — ואנחנו לא מורידים
- **מס מעסיק על הבשלת מניות** — **עלות במזומן**. חברות רבות מוציאות אותו יחד עם התגמול. Fastly, הודעת Q1/2026 ([EDGAR](https://www.sec.gov/Archives/edgar/data/0001517413/000151741326000129/ex991-fslypressrelease33126.htm)):
  > "starting with the quarter ended March 31, 2026, we are excluding stock-based compensation related employer payroll taxes from our non-GAAP financial measures."

  "החל מהרבעון שהסתיים ב־31/3/2026 אנחנו מוציאים מהמדדים שאינם GAAP את מסי המעסיק הקשורים לתגמול מבוסס מניות."
  - **הגודל באותו רבעון**: שורת "Stock-based compensation expense and related employer payroll taxes" = 37.9 מיליון, מול תגמול של 35.0 מיליון בדוח רווח והפסד — כ־8% יותר.
- **תגמול שקשור לרכישה** — חלקו בשורה נפרדת. NOW מוציאה "business combination and other related costs including compensation expense" (153 מיליון ב־9 חודשים 2026; לא כולו תגמול).
- **תגמול שמסולק במזומן** (SARs, יחידות פאנטום) — נדיר בארה"ב, נפוץ יותר בחו"ל.

### 4.3 האצה ברכישה והענקות חד־פעמיות
- **ASC 805** (הענקות חלופיות ברכישה):
  - החלק שמיוחס לשירות **לפני** הרכישה = חלק ממחיר הרכישה.
  - החלק **שאחרי** = הוצאת תגמול.
  - האצת הבשלה שהרוכש בחר בה = הוצאה מיידית.
  - **התוצאה**: קפיצה ברבעון אחד.
- **הנפקה (IPO)** — הכרה מצטברת על שנים של שירות, בבת אחת. Uber, רבעון 2/2019 ([EDGAR](https://www.sec.gov/Archives/edgar/data/1543151/000154315119000006/uberq219earningspressrelea.htm)):
  > "Q2 2019 includes $3.9 billion of stock-based compensation expenses, primarily due to RSU expense recognition in connection with our initial public offering."

  "רבעון 2/2019 כולל 3.9 מיליארד דולר הוצאות תגמול מבוסס מניות, בעיקר בגלל הכרה בהוצאה על מניות חסומות בקשר להנפקה."
- **הענקות ענק למנכ"ל** — **בדיוק** מה שבאפט רוצה שייספר ("obscene megagrants", 2002). אין סיבה להוציא אותן.
- **באפט על "חד־פעמי"** (2016): לתאר, לא להשמיט.
  > "Charlie and I want managements, in their commentary, to describe unusual items – good or bad – that affect the GAAP numbers."

  "צ'רלי ואני רוצים שההנהלות יתארו בדבריהן פריטים חריגים — טובים או רעים — שמשפיעים על מספרי ה־GAAP."
- **ברכישה** (1998): "we include in our evaluation the cost of replacing any option plan" — התגמול של עובדי החברה הנרכשת הוא תגמול שוטף.

### 4.4 ההמלצה
- **12 החודשים — להשאיר**: מורידים את כל שורת התגמול בתזרים, כולל האצות.
  - עקבי עם באפט (תגמול = תגמול) ועם ההבחנה שלו: לתאר חריג, לא להשמיט.
- **⛔ דורש אישור — הערת קפיצה ב־`bufSheet`**: כשתגמול ברבעון גבוה מפי 2 מהחציון של 4 הרבעונים שלפניו — "רבעון חריג: $X (רכישה/הנפקה?)".
- **⛔ דורש אישור — הצפוי**: היום `rate = sbc ÷ rev` של 12 החודשים, ולכן קפיצה אחת מנפחת את כל השנה הבאה.
  - **מוצע**: חציון של השיעור הרבעוני ב־4 (או 8) הרבעונים, או ממוצע בלי הרבעון החריג.
  - **הנימוק**: הצפוי צריך לשקף תגמול **שוטף**. האצה ברכישה היא חלק מעלות הרכישה (כמו ההפחתה בסעיף 3), לא שכר שחוזר.
- **לא מומלץ עכשיו**: להוסיף את מס המעסיק ואת התגמול במזומן.
  - אין להם שדה XBRL אחיד, וצריך לחלץ אותם מטבלת ההתאמה.
  - קודם למדוד כמה חברות מוציאות אותם.
- **מדידה**:
  1. כמה חברות מתוך 526 עם רבעון חריג ב־8 הרבעונים האחרונים, ומה ההשפעה של חציון מול 12 חודשים על הצפוי.
  2. בהודעות השמורות — כמה מוציאות "payroll tax" ו"acquisition-related compensation", ובאיזה גודל ביחס לתגמול.

---

## 5. דילול מול ניכוי — ספירה כפולה?

### 5.1 הטענה
- **המכנה**: רווח הרחוב מחולק במספר המניות **המדולל**, שכבר כולל אופציות ומניות חסומות.
- **המונה**: אם מורידים מהרווח גם את ההוצאה — האם התגמול נספר פעמיים?

### 5.2 FASB — עמדה רשמית: לא
- **FAS 123 (1995)** — הטענה כפי שהוצגה לוועדה ([fas123.pdf](https://storage.fasb.org/fas123.pdf)):
  > "Some respondents that opposed recognizing compensation cost for employee stock options said that to do so would "double count" the effect of issuing stock options. The dilutive effect of any in-the-money stock options is included in the denominator of earnings per share, and a reduction in net income (the numerator) would, in their view, create an inappropriate dual effect."

  "חלק מהמגיבים שהתנגדו להכרה בעלות התגמול על אופציות לעובדים טענו שזה 'יספור פעמיים' את השפעת ההנפקה. השפעת הדילול של אופציות בכסף כבר נכללת במכנה של הרווח למניה, והקטנת הרווח הנקי (המונה) תיצור, לדעתם, השפעה כפולה לא ראויה."
- **FAS 123(R) (2004), ‏B28** — התשובה ([fas123r.pdf](https://storage.fasb.org/fas123r.pdf)):
  > "Earnings per share is a metric—no expense (cost), revenue, or other element of financial statements is "recognized" by including its effect only in earnings per share. A transaction that results in an expense and that also increases the number of common shares outstanding properly affects both the numerator and the denominator of earnings per share. […] If an entity issues equity shares, equity share options, or share purchase warrants for cash and uses the cash received to pay employee salaries, earnings are reduced and more actual or potential common shares are outstanding."

  "רווח למניה הוא מדד. שום הוצאה, הכנסה או רכיב אחר בדוחות לא 'מוכר' רק דרך ההשפעה על הרווח למניה. עסקה שיוצרת הוצאה וגם מגדילה את מספר המניות משפיעה כראוי גם על המונה וגם על המכנה. […] אם חברה מנפיקה מניות, אופציות או כתבי אופציה תמורת מזומן ומשלמת בו משכורות, הרווח קטן וגם יש יותר מניות, בפועל או בכוח."
- **שיטת המניות באוצר** (FAS 128 ‏¶21, כפי שתוקן ב־123R) — המכנה סופר רק דילול **נטו**:
  > "the assumed proceeds shall be the sum of (a) the amount, if any, the employee must pay upon exercise, (b) the amount of compensation cost attributed to future services and not yet recognized, and (c) the amount of excess tax benefits […]"

  "התמורה המונחת היא הסכום של (א) מה שהעובד משלם במימוש, (ב) עלות התגמול שמיוחסת לשירות עתידי ועוד לא הוכרה, ו־(ג) הטבות המס העודפות [...]"
  - סעיף (ג) בוטל ב־ASU 2016-09.
  - **הנקודה**: עלות שעוד לא נרשמה כהוצאה "קונה בחזרה" מניות במכנה. כלומר, השיטה עצמה נבנתה כדי לא לספור פעמיים.
- **מחקר — Doran, "Employee Stock Options And Diluted Earnings Per Share"**, Journal of Business & Economics Research 3(11), 2005 ([JBER](https://clutejournals.com/index.php/JBER/article/view/2828)):
  - במודל של תקופה אחת: השילוב של שווי הוגן ושיטת המניות באוצר **לא** סופר פעמיים.
  - הרווח למניה בשיטת הערך הפנימי (בלי הוצאה) — מנופח.

### 5.3 Damodaran — עבר מול עתיד
"Share Count Confusion: Dilution, Employee Options and Multiple Share Classes!", ‏26/7/2018 ([Musings on Markets](https://aswathdamodaran.blogspot.com/2018/07/share-count-confusion-dilution-employee.html)):

> "Expected future grants: To the extent that a company is expected to continue to compensate its employees with options or restricted shares in future years, the most logical way to deal with these grants is to treat them as expenses in future years, and reduce expected income and cash flows."

"הענקות עתידיות: אם החברה צפויה להמשיך לתגמל במניות, הדרך ההגיונית ביותר היא לרשום אותן כהוצאה בשנים הבאות ולהקטין את הרווח והתזרים הצפויים."

> "At first sight, it may seem like double counting to lower future earnings because you expect option and share grants in the future, and then again lower the value of equity that you obtain by the value of options that are already outstanding. It is not, since we are dealing with two separate issues. A company that has had a history of stock based compensation, but has decided to suspend using SBC in the future, will be affected by only the second adjustment, whereas a company that has never used share based compensation in the past but plans to use it in the future, will be affected only by the former."

"במבט ראשון זה נראה כמו ספירה כפולה: מקטינים את הרווח העתידי בגלל הענקות צפויות, ושוב מקטינים את שווי ההון בשווי האופציות שכבר קיימות. זה לא, כי מדובר בשתי סוגיות נפרדות. חברה שתגמלה במניות בעבר אבל הפסיקה תושפע רק מהתיקון השני, וחברה שמעולם לא תגמלה במניות אבל מתכננת להתחיל תושפע רק מהראשון."

- **איפה כן יש ספירה כפולה, לפי Damodaran**: הענקות **עתידיות** שנספרות גם כהוצאה וגם כגידול צפוי במספר המניות.
  > "You cannot do both, because you are then reducing value per share twice for the same phenomenon"

  "אי אפשר לעשות את שניהם, כי אז מורידים את השווי למניה פעמיים בגלל אותה תופעה."
- **על החזרת התגמול לרווח**:
  > "Adjusting earnings and EBITDA, by adding back stock based compensation, is an abomination, used by desperate companies and analysts to show you that they are making money, when they are not even close."

  "תיאום הרווח וה־EBITDA על ידי החזרת התגמול במניות הוא תועבה. חברות ואנליסטים נואשים משתמשים בו כדי להראות שהם מרוויחים, כשהם אפילו לא קרובים."
- **Mauboussin ו־Callahan**: *Stock-Based Compensation: Unpacking the Issues* (Morgan Stanley, Consilient Observer, אפריל 2023).
  - הטקסט חסום (403), ולכן לא מצוטט ממנו.
  - לפי הפוסט של Mauboussin עצמו ([X](https://x.com/mjmauboussin/status/1648359495981056001)): התגמול במניות בארה"ב היה כ־270 מיליארד דולר ב־2022, כ־6%–8% מכלל התגמול.

### 5.4 ההחלה על המכפיל שלנו
- **12 החודשים — אין כפל**:
  - המכנה (מניות מדוללות) = הענקות שכבר קיימות, נטו מהעלות שעוד לא נרשמה.
  - המונה (הניכוי) = עלות השירות שהתקבל ברבעון.
  - שני דברים שונים: FASB ‏B28, ‏Damodaran.
- **הצפוי — כמעט אין כפל**: אנחנו מחלקים במספר המניות **הנוכחי** (`Q.sh[L]`), בלי הנחה על הנפקות עתידיות.
  - **שארית קטנה**: אם האנליסטים שמאחורי תחזית Yahoo הניחו גידול במספר המניות בגלל תגמול עתידי, יש כפל חלקי.
  - בדרך כלל ההנחה שלהם היא מספר מניות קבוע או יורד (רכישות חוזרות), ולכן ההשפעה זניחה.
- **מקרה קצה אמיתי — הפסד ב־GAAP**:
  - ברבעון שיש בו הפסד, המכנה ב־GAAP הוא **בסיסי** (דילול לא נספר בהפסד).
  - הרווח המותאם (רווח) מחולק במדולל.
  - הניכוי שלנו, `Q.sbc/Q.sh`, מחולק במספר הבסיסי — ולכן **גדול מעט מדי**, בשיעור הדילול (כמה אחוזים, ב־SNOW ודומותיה).
  - ⛔ **דורש אישור — תיקון אפשרי**: כשה־EPS ב־GAAP שלילי, להשתמש במספר המניות המדולל מההודעה. בגיבוי: מספר המניות של הרבעון הרווחי הקרוב.
- **מדידה**: בהודעות השמורות — הפער בין מספר המניות המדולל לרווח המותאם לבין `Q.sh`, בכל רבעון עם הפסד ב־GAAP. ההשפעה = הניכוי × (1 − בסיסי/מדולל).
- **ההמלצה**: **להשאיר את העיקרון.** את התיקון הקטן — רק אם המדידה תראה יותר מ־2% ברווח לפי באפט.

---

## 6. חברה בלי מידע על המדיניות — `clamp(רחוב − GAAP, 0, תגמול)`

### 6.1 מתי זה קורה
- **מתי**: `sbcX` ריק.
- **למה**: `lib/secsbc.js` קורא רק **8-K עם Item 2.02**. חברה זרה (foreign private issuer) מגישה את ההודעה ב־**6-K**, ולכן נופלת תמיד לכלל הזה. וכך גם חברה שלא נמצאו לה הודעות.
- חברות שהדוחות שלהן במטבע אחר כבר מקבלות null (`fxNote`). נשארות זרות שמדווחות בדולר.

### 6.2 מה יש בפער רחוב−GAAP
הנתונים מ־Calcbench, ‏S&P 500 (סעיף 3.4):
- **בדולרים, 2023, לפי הסדר**: הפחתה, ירידות ערך, תגמול במניות, תביעות משפטיות, מיזוגים ורכישות.
- **ב־2024**: ההפחתה 31%, ארגון מחדש 18.7%, ירידות ערך 17.4%.
- **הכיוון**: "86 percent of companies adjusted non-GAAP income upwards" — ב־86% מהחברות הרווח המותאם גבוה מ־GAAP.
- **חוץ מזה** יש בפער גם: רווחים והפסדים מהשקעות (הנפוץ ביותר במספר), התאמות מס, ובמקרים מסוימים רווח חד־פעמי שמקטין את הפער.

### 6.3 ההטיות של הכלל
| מקרה | מה הכלל עושה | ההטיה |
|---|---|---|
| מוציא תגמול + עוד פריטים (הפחתה, ארגון מחדש) | פער ≥ תגמול ← כל התגמול | ✓ נכון |
| לא מוציא שום דבר (רחוב = GAAP) | פער ≈ 0 ← אפס | ✓ נכון |
| **כולל** את התגמול, אבל מוציא הפחתה או ארגון מחדש (נפוץ בתרופות, ציוד רפואי, תעשייה) | פער > 0 ← עד כל התגמול | ✗ **ניכוי מיותר** — רווח לפי באפט נמוך מדי, עד כל התגמול |
| מוציא תגמול, אבל יש ב־GAAP רווח חד־פעמי | פער < תגמול ← רק חלק | ✗ ניכוי חסר — רווח לפי באפט גבוה מדי |
| רחוב ≠ ההגדרה של החברה (הסדרה של Yahoo שונה) | לא צפוי | ✗ רעש |

- **למה ה־clamp הגיוני בכל זאת**:
  - **התקרה (תגמול)**: מבטיחה שלעולם לא נוריד יותר ממה שבאפט היה מוריד.
  - **הרצפה (0)**: מונעת "הוספה".
  - **זה גבול עליון שמרני**, לא אומדן מרכזי. ההטיה העיקרית שלו היא **כלפי מטה** ברווח לפי באפט (המכפיל גבוה מדי), במי שכולל את התגמול ומוציא הפחתה.

### 6.4 חלופות
1. **⛔ דורש אישור — לצמצם את המקרים**: לקרוא גם **6-K**.
   - **איך**: עם הנספחים EX-99, ולסנן לפי `classify(...).er` (הודעת תוצאות) — הדגל כבר קיים.
   - **התוצאה**: רוב החברות הזרות שמדווחות בדולר יקבלו מדיניות אמיתית במקום כלל.
2. **⛔ דורש אישור — כלל משופר**: ‎`clamp(פער − הפחתה×(1−t), 0, תגמול)`‎.
   - **איפה הוא טוב יותר**: מתקן את המקרה של "כולל תגמול, מוציא הפחתה".
   - **איפה הוא גרוע יותר**: בחברה שכוללת הפחתה ומוציאה תגמול (נדיר) — ניכוי חסר.
   - **הנתון**: `AmortizationOfIntangibleAssets` כבר זמין ברוב החברות ב־XBRL.
3. **לא מומלץ — הנחה לפי ענף**. `docs/buffett-pe.md` דחה זאת במפורש: החברות משנות מדיניות (INTU, ‏NVDA).

### 6.5 איך מודדים — בדיקה לאחור על חברות שהאמת שלהן ידועה
- **הסט**: כל החברות ב־8-K שיש להן `pol` לכל רבעון (כולל 67 החברות שאומתו).
- **החישוב**: לכל רבעון — הניכוי לפי הכלל (גרסה של היום וגרסה 2), מול הניכוי לפי המדיניות האמיתית.
- **המדדים**:
  - שיעור הרבעונים שבהם הכלל נכון בטווח 5%.
  - ההטיה הממוצעת (בדולר למניה ובאחוז מהרווח לפי באפט).
  - הפילוח לפי "כולל" מול "מוציא".
- **ההחלטה**: הכלל עם השגיאה הקטנה ביותר. המטרה — לבחור לפי מספרים, לא לפי טיעון.

### 6.6 ההמלצה
- **להשאיר את `clamp` כמו שהוא** עד המדידה.
- **אחריה (⛔ דורש אישור)**: קודם 6-K (מקטין את התלות בכלל), ואז הכלל שמנצח בבדיקה לאחור.

---

## 7. מקורות נתונים שמפרסמים רווח או מכפיל אחרי תגמול (בקצרה)
- **לא נמצא ספק נתונים מרכזי** שמפרסם "מכפיל רווח אחרי תגמול במניות" כשדה מוכן. המחקר הנפרד (`01-…`, `02-…`) מכסה את זה.
- **מה כן נמצא בדרך**:
  - [StockRover](https://www.stockrover.com/metrics/valuation/) מפרסם "Compensation Yield" — התגמול במניות השנתי כאחוז ממחיר המניה. מדד קרוב, לא מכפיל.

---

## 8. שאלה שעלתה בדרך — ארגון מחדש ו"חד־פעמי" שחוזר
- **מה קורה היום**: רווח הרחוב מוציא בדרך כלל גם עלויות ארגון מחדש ופיטורים, ואנחנו לא נוגעים בהן.
- **ב־NOW**:
  - פיטורים: 21 מיליון (Q4/25) ו־167 מיליון (9 חודשים 2026).
  - סיום חוזים: 37 מיליון (Q4/25).
  - **כולם הוצאו** מהרווח המותאם.
- **באפט, מכתב 2016**:
  > "We have never, however, singled out restructuring charges and told you to ignore them in estimating our normal earning power. If there were to be some truly major expenses in a single year, I would, of course, mention it in my commentary."

  "אבל מעולם לא הפרדנו חיובי ארגון מחדש ואמרנו לכם להתעלם מהם בהערכת כושר הרווח הרגיל שלנו. אם תהיה שנה עם הוצאות גדולות באמת, כמובן שאזכיר זאת בדבריי."
  - ושם גם:
    > "But, to tell owners year after year, "Don't count this," when management is simply making business adjustments that are necessary, is misleading."

    "אבל לומר לבעלים שנה אחרי שנה 'אל תספרו את זה', כשההנהלה פשוט עושה התאמות עסקיות נחוצות — זה מטעה."
- **המשמעות**: לפי באפט, ארגון מחדש **שחוזר** הוא עלות רגילה. השיטה שלנו מטפלת היום רק בתגמול.
- **ההמלצה**: **לא לשנות עכשיו** (ההגדרה שאושרה היא "רחוב פחות תגמול").
  - **למדוד**: ב־12 הרבעונים האחרונים, כמה חברות מוציאות ארגון מחדש ב־3 רבעונים או יותר, ובאיזה גודל ביחס לרווח לפי באפט.
  - **אם חומרי** — להציג למשתמש כשאלת הגדרה נפרדת (⛔ דורש אישור).

---

## 9. סדר המדידות המוצע (גל 5), מהזול ליקר
1. **שיעור המס (2.9)** — רק קריאה של ההודעות השמורות וחישוב. ההשפעה הצפויה הגדולה ביותר (8% ב־NOW).
2. **בדיקה לאחור של ה־clamp (6.5)** — על הנתונים הקיימים.
3. **קפיצות בתגמול (4.4)** — מהנתונים הקיימים.
4. **הפחתה וחלק הטכנולוגיה (3.5)** — צריך שדות XBRL נוספים.
5. **מספר המניות בהפסד (5.4)** ו**ארגון מחדש (8)** — מההודעות השמורות.

כל תוצאה תיכנס ל"ממצאים" ב־`docs/buffett-pe-audit.md`. כל שינוי בהגדרה — רק אחרי אישור המשתמש, ונרשם ב"החלטות" שם.

---

## מקורות
**באפט ומאנגר**
- מכתבי באפט: [1983](https://www.berkshirehathaway.com/letters/1983.html) · [1986](https://www.berkshirehathaway.com/letters/1986.html) · [1992](https://www.berkshirehathaway.com/letters/1992.html) · [1998](https://www.berkshirehathaway.com/letters/1998htm.html) · [2002](https://www.berkshirehathaway.com/letters/2002pdf.pdf) · [2014](https://www.berkshirehathaway.com/letters/2014ltr.pdf) · [2015](https://www.berkshirehathaway.com/letters/2015ltr.pdf) · [2016](https://www.berkshirehathaway.com/letters/2016ltr.pdf).
- אסיפת 2002 — רשימות משתתף: [fool.com](https://www.fool.com/specials/2002/05/07/foolcom-notes-from-omaha-special-may-7-2.aspx).
- מאנגר על EBITDA, 2003: [oldschoolvalue.com](https://www.oldschoolvalue.com/?p=19178).
- "Stock Options and Common Sense", The Washington Post, ‏9/4/2002 — לא אוחזר. סיקור: [CEI](https://cei.org/?p=62505).

**תקינה ורגולציה**
- FASB: [FAS 123](https://storage.fasb.org/fas123.pdf) · [FAS 123(R)](https://storage.fasb.org/fas123r.pdf) · [ASU 2016-09](https://storage.fasb.org/ASU%202016-09.pdf).
- SEC: [Non-GAAP C&DIs (102.11)](https://www.sec.gov/corpfin/non-gaap-financial-measures).
- IRC §162(m): [LII](https://www.law.cornell.edu/uscode/text/26/162).
- שיעור המס המשולב בארה"ב: [Tax Foundation](https://taxfoundation.org/data/all/federal/us-corporate-income-tax-more-competitive/).

**ספרות**
- Chen, Chiu, Shevlin & Wang (2023), Management Science: [RePEc](https://ideas.repec.org/a/inm/ormnsc/v69y2023i5p3100-3120.html).
- Doran (2005), JBER: [clutejournals](https://clutejournals.com/index.php/JBER/article/view/2828).
- Damodaran: [Share Count Confusion (2018)](https://aswathdamodaran.blogspot.com/2018/07/share-count-confusion-dilution-employee.html) · [שקפים — רכישות כהשקעה הונית](https://pages.stern.nyu.edu/~adamodar/podcasts/valUGspr20/session8slides.pdf).
- Mauboussin: [הפוסט על המחקר מ־2023](https://x.com/mjmauboussin/status/1648359495981056001). הטקסט המלא לא אוחזר.
- Calcbench: [2024](https://calcbench.blogspot.com/2025/06/non-gaap-analysis-part-ii-types-of.html) · [2023](https://calcbench.blogspot.com/2024/05/special-report-non-gaap-adjustments-in.html).

**הודעות לעיתונות (EDGAR)**
- NOW: [Q3/2026](https://www.sec.gov/Archives/edgar/data/1373715/000137371526000092/erq3fy26.htm) · [Q4/2025](https://www.sec.gov/Archives/edgar/data/1373715/000137371526000005/erq4fy25.htm).
- Fastly: [Q1/2026](https://www.sec.gov/Archives/edgar/data/0001517413/000151741326000129/ex991-fslypressrelease33126.htm).
- Uber: [Q2/2019](https://www.sec.gov/Archives/edgar/data/1543151/000154315119000006/uberq219earningspressrelea.htm).
