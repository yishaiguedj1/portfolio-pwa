# מנגנוני חיוב והעברת כסף ב־IBKR, הופעתם ב־Flex, ותוכניות IB/FA (סבב השלמה, מצב ל־16/11/2026)

> העותק לריפו של מחקר 16/11/2026 — מחקר התנהגות בלבד, לא הועתקו טקסט, קוד או תבניות. שמות מסחריים הוחלפו בכינויים (שירות ה׳ = החברה שמנכה מס במקור ללקוחות IBKR; גוף ישראלי א׳ = הברוקר המציג הישראלי שהחשבונות יושבים תחתיו); מקורות מסחריים מצוטטים במזהה Wn, והמפה נשמרה מחוץ לריפו.

הערת שיטה: נקראו במלואם דפי ibkrguides.com וקוד המקור של ibflex (GitHub, ענף master). דפי interactivebrokers.com, ibkrcampus, ה־KB ו־web.archive.org נחסמו (403 / חסום בכלי) ולא נעקף החסימה. דפי ibkrguides אינם נושאים תאריך פרסום; תקצירי החיפוש ציינו שגילם כ־90 עד 460 יום, ולכן יש לראות בכולם "כפי שהוצגו ב־16/11/2026". קריאות הדפים נעשו דרך כלי שמסכם את הדף (לא טקסט גולמי), ולכן הציטוטים הם כפי שהכלי החזיר. תוויות: מאומת / לא ודאי / סותר.

## 1. Fee Administration של IB ו־FA: סוג Invoice, מטבע, אישור לקוח, ביטול

### Takeaway
מאומת: חיוב לפי חשבונית ("Invoice") נעשה בתוך תקרה (cap) שהלקוח אישר מראש; סכום החשבונית יכול להשתנות בכל פעם (עד התקרה), חשבונית אחת ליום לכל חשבון לקוח, עד 10 לקוחות בבת אחת. הדוקומנטציה קובעת במפורש מטבע רק ל־CSV: מטבע הבסיס של חשבון הלקוח, כלומר אין מקור שמאשר חשבונית ב־ILS לחשבון שבסיסו USD. מנגנון הערעור/ביטול מצד הלקוח לא תועד בדפים שנקראו.

### Cited Findings
- מאומת: ב־IB (ברוקר) קיימים חיובי עמלה: markups לכל עסקה (Percent/Absolute/Ticket Charge/Tiered), markups על ריבית, markups על ריבית השאלה, וחשבוניות אלקטרוניות ל־Fully-Disclosed Brokers: מגדירים "Automatic Billing" חודשי/רבעוני ו"markup limit" לכל חשבון, ואפשר "לחשב ולהגיש חשבונית לכל חשבון, עד המגבלה, בכל עת". הציטוט: "The invoice amount will be automatically transferred from the client account to the broker account." — [Broker Fee Information](https://www.ibkrguides.com/brokerportal/broker-fee-information.htm)
- מאומת: הגשה לעד 10 לקוחות בבת אחת, חשבונית אחת ליום לחשבון; העלאת CSV עם מספר חשבון, סכום ו־memo אופציונלי. "CSV invoice amounts are in the client account's base currency." — [Broker Fee Information](https://www.ibkrguides.com/brokerportal/broker-fee-information.htm); אותו ניסוח (CSV, מטבע בסיס) גם ב־[Advisor Fee Information](https://www.ibkrguides.com/advisorportal/ug/advisor-fee-information.htm)
- מאומת: חשבוניות שהוגשו לפני 17:30 EST מעובדות באותו יום ומופיעות בדוחות אותו יום; אחרי השעה הזו, ביום העסקים הבא — [Invoicing (broker)](https://www.ibkrguides.com/brokerportal/homemenu/invoicing.htm), [Advisor Fee Information](https://www.ibkrguides.com/advisorportal/ug/advisor-fee-information.htm)
- מאומת (לגבי FA): חשבונית NLV מוגבלת לתקרת אחוז שנתי מ־NAV (חודשי/רבעוני); חשבונית ביצועים מוגבלת לאחוז מהכנסת התקופה הקודמת; אם הוגדרו גם תקרת סכום וגם תקרת אחוז — חל הנמוך. חשבונית ללקוח חדש מותרת רק עד 30 יום (חודשי) או 90 יום (רבעוני) מפתיחה/מימון. מגבלת "תקופת מעבר" של 2% — [Advisor Client Fees](https://www.ibkrguides.com/advisorportal/ug/fees.htm), [Advisor Fee Information](https://www.ibkrguides.com/advisorportal/ug/advisor-fee-information.htm)
- מאומת: "For electronic NLV invoicing, the client must confirm the maximum fee percentage" — כלומר הלקוח מאשר את התקרה (באחוז), לא כל חשבונית בנפרד. ב־FA: "In the case of fee increases, the client will be required to approve the fee increase with a signature." תצורות ממתינות פוקעות אחרי 90 יום אם הלקוח לא אישר — [Advisor Fee Information](https://www.ibkrguides.com/advisorportal/ug/advisor-fee-information.htm)
- מאומת (תקציר חיפוש): אישור הלקוח נעשה ב־Pending Items ב־Client Portal, או ב־שירות חתימה 1 (השיטה המועדפת) או בטופס מודפס עם חתימה פיזית; הורדת עמלה מעובדת אוטומטית בלי אישור — [Client Authorization](https://www.ibkrguides.com/advisorportal/homemenu/clientauth.htm) (לא נקרא במלואו; הציטוטים מתקציר חיפוש)
- מאומת: ה־IB בעל "Client Service Program": ב־Streamlined אין הרשאת תשלומי צד שלישי; שינויי מימון דורשים אישור הלקוח ב־Client Portal (SMS + אישור/דחייה) — [Client Service Programs](https://www.ibkrguides.com/brokerportal/clientserviceprogram.htm)
- מאומת: תקרות markup: עד פי 15 מהתעריף המדורג הגבוה של IBKR בתוספת עמלות חיצוניות; אופציות ארה"ב עד 10% מערך העסקה — [Broker Fee Information](https://www.ibkrguides.com/brokerportal/broker-fee-information.htm)
- מאומת: הגדרת אחוז מ־NLV לפי נוסחה: (NLV ביום העסקים האחרון × שיעור) ÷ (252 ÷ ימי עמלה); מחויב ביום העסקים האמריקאי הראשון של החודש; אין חיוב אם הכסף נמשך ביום האחרון של התקופה. "Direct billing": "IBKR will not remove funds from your client's account" — [Advisor Client Fees](https://www.ibkrguides.com/advisorportal/ug/fees.htm)
- מאומת: החיוב האוטומטי של FA לא מנוכה מחשבונות מתחת ל־3,000 USD; חשבון master חייב להחזיק 1,000 USD לחיוב העמלות בו — [Advisor Fee Information](https://www.ibkrguides.com/advisorportal/ug/advisor-fee-information.htm)
- מאומת: ה־FA יכול להחזיר (reimburse) עמלות עד 50% מהחשבוניות במסגרת 12 חודשים — פעולה של היועץ, לא ערעור לקוח — [Advisor Fee Information](https://www.ibkrguides.com/advisorportal/ug/advisor-fee-information.htm)
- מאומת: התראות חשבונית ללקוח: אימייל, אימייל+Message Center, או כלל לא (יועצים רשומים בארה"ב מופעלים כברירת מחדל); "all advisory fees processed through IBKR are reflected on the client's Activity Statements" — [Advisor Fee Information](https://www.ibkrguides.com/advisorportal/ug/advisor-fee-information.htm)
- מאומת: ב־Web API (תיעוד IBKR) נזכרים `feesTemplateName` ו־`advisorWrapFees` (לפי תקציר חיפוש בלבד; הדף עצמו 403) — [Client Fees](https://www.interactivebrokers.com/docs/web-api/account-management/account-information/client-fees)

### Inferences
- חשבונית בסכום משתנה השווה למס מחושב (נתון חודשי) אפשרית מבחינה מבנית: החשבונית נשלחת בכל פעם עם סכום חופשי עד התקרה שהלקוח אישר. אבל התקרה מוגדרת כאחוז מ־NLV (או סכום מרבי), ולא כ"סכום המס": מס חודשי גבוה (למשל אחרי מימוש גדול) ייחתך אם יעלה על התקרה. מקורות הדפים אינם מציינים זאת במפורש; זו הסקה.
- מאחר שהסכום הוא CSV במטבע הבסיס, חיוב של סכום ILS מחייב המרה מחוץ למנגנון (חישוב בצד המנכה) אם בסיס החשבון אינו ILS. לא נמצא מקור על חשבונית ב־ILS.
- מנגנון "Invoice" מצד IB מיועד ל־Fully Disclosed Brokers (נאמר במפורש בדף ה־IB); קשר לגוף ישראלי א׳ לא אומת.

### Gaps
- אין מקור על ערעור/ביטול של חשבונית מצד הלקוח, ועל ביטול ההרשאה/התקרה אחרי אישור (הדפים לא מתארים). קיים רק Reimbursement ביוזמת היועץ.
- הדף של Fee Templates (`feesTemplateName`) לא נקרא; מערכת "תבניות" ב־ibkrguides של ה־FA לא נמצאה בשם הזה (הדף configclientfees לא משתמש במונח templates).
- Campus "Invoicing for Introducing Brokers" (403) לא נקרא; ייתכנו בו פרטים נוספים.
- מגבלת מטבע מפורשת לחשבונית (ILS/אחר) — לא נמצאה.

## 2. איך חיובים מופיעים ב־Activity Statement וב־Flex (שמות אלמנטים, enum)

### Takeaway
מאומת מקוד ibflex: ב־CashTransaction השדה `type` מקבל את ה־enum CashAction: "Other Fees" (FEES), "Advisor Fees" (ADVISORFEES), "Commission Adjustments" (COMMADJ), "Withholding Tax", "Deposits & Withdrawals" ועוד. ה־enum הוא שלד של ibflex; IBKR עצמה לא מפרטת ערכי Type בדף. הסעיפים ClientFees/ClientFeesDetail הם דוחות של ה־master (IB/FA) על ההכנסות שלו, לא של הלקוח. הניחוש "Other Fees ב־ILS" לא אומת ולא הופרך, ויש כיוון מתחרה: "Deposits & Withdrawals" או "Advisor Fees".

### Cited Findings
- מאומת: CashAction ב־ibflex: DEPOSITWITHDRAW="Deposits & Withdrawals", BROKERINTPAID="Broker Interest Paid", BROKERINTRCVD="Broker Interest Received", WHTAX="Withholding Tax", BONDINTRCVD="Bond Interest Received", BONDINTPAID="Bond Interest Paid", FEES="Other Fees", DIVIDEND="Dividends", PAYMENTINLIEU="Payment In Lieu Of Dividends", COMMADJ="Commission Adjustments", ADVISORFEES="Advisor Fees" — [ibflex enums.py](https://github.com/csingley/ibflex/blob/master/ibflex/enums.py) (נקרא כ־raw דרך הכלי; ראו הערת השיטה)
- מאומת: שדות CashTransaction ב־ibflex: type, assetCategory, subCategory, accountId, currency, fxRateToBase, description, conid, securityID, cusip, isin, listingExchange, underlyingConid, amount, dateTime, symbol, tradeID, code, transactionID, reportDate, clientReference, settleDate, acctAlias, actionID, model, levelOfDetail, serialNumber, deliveryType, commodityType, fineness, weight, figi, issuerCountryCode, availableForTradingDate, exDate (ועוד) — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- מאומת: IBKR עצמה מגדירה Type ב־Cash Transactions כ"The type of the cash transaction" ו־Description כ"The description of the cash transaction", בלי רשימת ערכים; שדות הסעיף (24) כולל Code, Trade ID, 871(m) Withholding — [Cash Transactions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/cash%20transactionsfq.htm); תיאור הסעיף שם: "cash deposits, withdrawals, and dividend payments".
- מאומת: ClientFee (ibflex): accountId, acctAlias, model, currency, fxRateToBase, feeType, date, description, expenseIndicator, revenue, expense, net, revenueInBase, expenseInBase, netInBase, tradeID, execID, levelOfDetail, assetCategory, settleDate, buySell, quantity, tradePrice, proceeds, symbol, underlyingSymbol, multiplier, underlyingSecurityID — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- מאומת: ClientFeesDetail (ibflex): accountId, acctAlias, model, currency, fxRateToBase, date, tradeID, execID, totalRevenue, totalCommission, brokerExecutionCharge, clearingCharge, thirdPartyExecutionCharge, thirdPartyRegulatoryCharge, regFINRATradingActivityFee, regSection31TransactionFee, regOther, totalNet, totalNetInBase, levelOfDetail, other — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- מאומת: Client Fees ב־Flex מופיע ב"master account statement" של יועצים/ברוקרים שגובים עמלות מלקוחותיהם: Revenue = הכנסת העמלה, Expense = עמלה ל־IB, Net = רווח היועץ; Fee Type = "Category of the fee"; "Currency the fee is denominated in" — [Client Fees (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/client%20feesfq.htm). כלומר זהו תצוגת ה־master, ולא נקבע אם לקוח רואה אותו (הדף שותק).
- מאומת: רשימת קטעי FlexStatement ב־ibflex כוללת ClientFees, ClientFeesDetail, CashTransactions, UnbundledCommissionDetails, StmtFunds, CashReport, ChangeInNAV, Transfers ועוד (רשימה מלאה בהערת הכלי; כ־55 קטעים) — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- מאומת: Cash Report (Flex) כולל את השורות: Client Fees, Commissions, Commission Credits, Billable Commissions, Other Fees ("Total other fees"), Advisor Fees ("Total financial advisor fees for an advisor client"), Fees Receivables, Deposits/Withdrawals, Deposits, Withdrawals, Account Transfers, Linking Adjustments, Internal Transfers, Debit Card Activity, Bill Pay Activity, Dividends, Withholding Tax, Transaction Tax — [Cash Report (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/cash%20reportfq.htm)
- מאומת (תקציר חיפוש): ב־Statement of Funds קוד פעילות ADJ כולל "Client Fees, Commission Adjustments, Option Cash Settlements..." — [Statement of Funds (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/statement%20of%20fundsfq.htm) (מהתקציר, לא נקרא במלואו)
- מאומת: StatementOfFundsLine ב־ibflex כולל activityDescription, activityCode, amount, balance, debit, credit, fxRateToBase — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- מאומת: UnbundledCommissionDetail (עמלות עסקאות מפורקות) ב־ibflex כולל totalCommission, brokerExecutionCharge, brokerClearingCharge, thirdParty*..., other — אינו מקום לעמלת יועץ (רק פירוק עמלות עסקה) — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- מאומת: Advisor Fees ב־Cash Report מוגדר "for an advisor client" — כלומר שורה בצד הלקוח; וההצהרה "all advisory fees processed through IBKR are reflected on the client's Activity Statements" — [Cash Report](https://www.ibkrguides.com/reportingreference/reportguide/cash%20reportfq.htm), [Advisor Fee Information](https://www.ibkrguides.com/advisorportal/ug/advisor-fee-information.htm)
- לא ודאי: ההפניה של dוח Cash Report ב־Flex למספר "Commission Adjustments" — הדף הרשמי של Cash Report (Flex) לא כולל שורה כזו ואילו ibflex כולל COMMADJ; סותר חלקית — [Cash Report](https://www.ibkrguides.com/reportingreference/reportguide/cash%20reportfq.htm) מול [ibflex enums.py](https://github.com/csingley/ibflex/blob/master/ibflex/enums.py)
- סותר/הקשר: ב־Activity Statement ברירת המחדל של IB Canada קיים סעיף "Details of Fees and Charges" (פירוט עמלות, בשנתי בלבד, CAD) — לא רלוונטי לישראל — [Details of Fees and Charges](https://www.ibkrguides.com/reportingreference/reportguide/detailsfeescharges.htm)

### Inferences
- חיוב של צד שלישי (כמו מס) שמבוצע כחשבונית IB/FA צפוי להופיע בצד הלקוח כ־CashTransaction עם type "Advisor Fees" (לחשבון יועץ) או "Other Fees" (חיוב broker/אחר) או כחיוב חופשי תחת "Deposits & Withdrawals" אם הועבר כמשיכה. אין מקור שמכריע. מומלץ בקוד: זיהוי לפי `type` בקבוצת {Other Fees, Advisor Fees, Commission Adjustments, Deposits & Withdrawals} יחד עם `description` ו־`currency`, וכן שמירת דוגמאות אמיתיות ממשתמשים מסוכמות ומוסוות (ללא נתונים בריפו).
- ה־enum של ibflex מבוסס על דוגמאות XML ממשתמשים ואינו מובטח מלא; ערכי type נוספים אפשריים (למשל "Other Income"?) — לא נבדק, להתייחס לערך לא מוכר כ"אחר".

### Gaps
- אין תיעוד IBKR רשמי של ערכי Type/Description לחיוב חשבונית של IB/FA, ואין דוגמת XML פומבית של חיוב כזה. לא נמצא פורום 2/פורום עם דוגמה (לא חיפשתי בעומק פורומים בעברית).
- ב־beancount importers ו־ib_insync לא נבדקו (ב־ib_insync flexreport אין סכימה משלו; הוא מפרק דינמית לפי שם אלמנט).
- הדף "client feesfq" לא מבהיר אם ClientFees נראה ללקוח.
- אין אימות ל־"Other Fees ב־ILS" (ראו שאלת הישות/מטבע, סעיף 6).

## 3. העברת כסף: משיכות, צד שלישי, העברות פנימיות

### Takeaway
מאומת: משיכה לצד שלישי היא תהליך דו־שלבי (אישור פרטי הנמען ואז בקשת משיכה, שניהם באישור IBKR); "Tax payments" מופיעים במפורש בין המטרות ש־IBKR "may permit" לאחר בדיקה. הדף לא אומר "wire only" אלא "wire or check". תשלום עבור סחורות/שירותים, השקעות פרטיות, פירעון הלוואות, תשלומים לחברות בבעלות הלקוח — בדרך כלל לא מאושרים. יועץ/ברוקר יכול ליזום משיכה בפורטל, ובאישורי לקוח לפי תוכנית השירות.

### Cited Findings
- מאומת: "A third-party withdrawal is a two-step process": שלב 1 הגשת פרטי הנמען לאישור; שלב 2 יצירת בקשת משיכה על בסיס הפרטים המאושרים; "The payee information requires approval first, and the withdrawal itself is also subject to approval." — [Withdraw Funds to a Third Party (Advisor)](https://www.ibkrguides.com/advisorportal/ug/withdrawfunds3rdparty.htm), [אותו נושא ב־Client Portal](https://www.ibkrguides.com/clientportal/transferandpay/withdrawfunds3rdparty.htm)
- מאומת: "only wire or check withdrawals are permitted" (לא wire בלבד — מתקן את סבב 1) — [Client Portal 3rd party](https://www.ibkrguides.com/clientportal/transferandpay/withdrawfunds3rdparty.htm)
- מאומת: IBKR "may allow" משיכות לצד שלישי למטרות כגון "Tax payments", רכישת בית/פירעון משכנתא והוצאות חשבון מסוימות, לאחר due diligence; בדרך כלל לא מאושר: השקעות פרטיות, פירעון הלוואות, תשלומים לחברות בבעלות הלקוח, תשלום עבור סחורות או שירותים; יחידים: בדרך כלל בן/בת זוג, הורה, אח או ילד — [Client Portal 3rd party](https://www.ibkrguides.com/clientportal/transferandpay/withdrawfunds3rdparty.htm), [Advisor 3rd party](https://www.ibkrguides.com/advisorportal/ug/withdrawfunds3rdparty.htm)
- מאומת: מטבע המשיכה נבחר ברשימה "Currency" במסך Withdraw Funds; הדף אינו מפרט אילו מטבעות נתמכים — [Enter Withdrawals](https://www.ibkrguides.com/advisorportal/ug/enterwithdrawal.htm)
- מאומת: יש משיכות מחזוריות (חודשי/רבעוני/שנתי) — [Enter Withdrawals](https://www.ibkrguides.com/advisorportal/ug/enterwithdrawal.htm)
- מאומת: משתמש שמנהל חשבונות לקוח בוחר חשבון ב־Account Selector ואז Withdraw Funds; ההוראה מאושרת בכניסה עם 2FA — [Enter Withdrawals](https://www.ibkrguides.com/advisorportal/ug/enterwithdrawal.htm)
- מאומת (תקציר חיפוש): מדריך Ongoing Account Management: יועץ יכול להזין בקשת משיכה עבור לקוח (למשל הפצה/עמלה) ואז הלקוח מאשר או, אם מורשה באופן מלא, היא עוברת ישירות — [Ongoing Account Management and CRM Tool Usage](https://www.ibkrguides.com/clientonboarding/ongoing-account-am-crm-tool.htm) (לא נקרא במלואו)
- מאומת: ב־"Full Service" ה־broker מורשה לתשלומי צד שלישי ו־wires, עם הגבלה בסכום ובתקופה בחודשים (למשל לא יותר מ־5,000$ ל־3 חודשים, לפי תקציר); ב־Streamlined אין הרשאה לתשלומי צד שלישי; Full Service מתאים רק ל"IBLLC Fully Disclosed Brokers registered with FINRA and/or Introducing Brokers from eligible countries" — [Client Service Programs](https://www.ibkrguides.com/brokerportal/clientserviceprogram.htm)
- מאומת: העברות פנימיות: "Transfer Funds Between Accounts"; אפשר רק בין חשבונות שהכותרת שלהם זהה לשם בעל החשבון; אי אפשר ממוסדי לאישי אלא אם הכותרות זהות — [Transfer Funds](https://www.ibkrguides.com/advisorportal/ug/transferfunds.htm)
- לא נמצא: Web API / Account Management API לפעולות funds-transfer של IB/FA. הדף "Account Management Web API" (ibkrguides.com/damfb) הופיע בחיפוש אך לא נקרא.

### Inferences
- מס הוא מטרה מוכרת למשיכה לצד שלישי, אבל תהליך הנמען דו־שלבי ובאישור IBKR, ואישור כללי לתשלומים חוזרים אינו מתועד. מודל "חברה מנכה מס חודשית לחשבון בנק של רשות המסים" דרך משיכה לצד שלישי יצטרך אישור פרטי הנמען פעם אחת (מבנה הדף) — לא אומת שחיוב חוזר מותר.
- המרה ל־ILS (עבור תשלום למס) יכולה להתבצע על ידי הלקוח/המנהל בחשבון; לא אומת מי רשאי.

### Gaps
- אין מקור על Web API / Account Management funds-transfer ל־IB/FA, ועל הרשאת User Access Right המדויקת ליזום משיכות.
- אין מקור על ביטול משיכה מחזורית ועל קשר בין "Funding" access right לבין Flex.

## 4. קישור/העברת חשבון קיים תחת IB או FA

### Takeaway
מאומת: קיימת פעולה "Link My Existing Account to an Advisor/Broker" (Manage Account Linking), אבל מוגבלת: קישור רק בין קרובי משפחה (חוץ מ־IBLLC Non-Professional Advisor) והלקוח מצהיר שלא ייגבו עמלות — כלומר מסלול רגיל אינו מתאים לשירות ניכוי מסחרי. כל המזומן והפוזיציות עוברים לחשבון המנוהל.

### Cited Findings
- מאומת: תהליך: User menu > Settings > Account Configuration > Manage Account Linking > Link My Existing Account to an Advisor/Broker; הזנת Account ID ושם של חשבון היועץ/הברוקר; חתימה על הסכמים; היועץ/הברוקר מאשר ב־Pending Items — [Link My Existing Account](https://www.ibkrguides.com/clientportal/moveaccounttoadvisorbroker.htm)
- מאומת: קריטריונים: "Linking clients must be family members, unless the link is for an IBLLC Non-Professional Advisor."; "Clients must agree that fees will not be charged, unless the link is for an IBLLC Non-Professional Advisor."; נדרש הסבר מספק לקישור — [Link My Existing Account](https://www.ibkrguides.com/clientportal/moveaccounttoadvisorbroker.htm)
- מאומת: השלכות: כל המזומן והפוזיציות עוברים לחשבון המנוהל; מעבר ליועץ מבטל כניסת TWS ומנוי נתוני שוק; מעבר לברוקר שומר TWS; ההעברה כל יום עסקים אחרי 15:00 EST; אחרי המעבר עמלות "may be debited as specified by the Advisor or Broker" — [Link My Existing Account](https://www.ibkrguides.com/clientportal/moveaccounttoadvisorbroker.htm)
- מאומת (תקציר חיפוש): חלופות: פתיחת חשבון מקושר חדש בניהול יועץ/ברוקר, או חלוקת חשבון (partition) ל־parent עצמאי ו־child מנוהל; מעבר בין יועצים רק בתוך אותה ישות IBKR — [Create a New Linked Account](https://www.ibkrguides.com/clientportal/createlinkedaccountunderadvisorbroker.htm), [Partition Your Account](https://ibkrguides.com/clientportal/partitionaccount.htm), [Move to a New Advisor](https://www.ibkrguides.com/clientportal/move-account-to-new-advisor.htm) (לא נקראו במלואם)
- מאומת (תקציר חיפוש): IBKR לא ממירה חשבון Individual לחשבון יועץ; נדרש אפליקציה חדשה — [FAQ article-136](https://ibkrguides.com/kb/article-136.htm)
- מאומת: Cash Report מגדיר "Linking Adjustments": "Balances from the day before a mid-period link, or negated balances on the de-link date" — כלומר קישור/ניתוק באמצע תקופה משנה את הנתונים ב־Flex (דורש טיפול בקוד) — [Cash Report](https://www.ibkrguides.com/reportingreference/reportguide/cash%20reportfq.htm)

### Inferences
- קישור "חשבון קיים לברוקר" אינו מתיר חיוב עמלות במסלול הרגיל; לכן חברות שירות מסחריות כנראה פותחות חשבון חדש ישירות דרך ה־IB (onboarding), או משתמשות ב־Individual עם הרשאה/הוראה אחרת. ספקולציה.

### Gaps
- אין מקור על ביטול הקישור (revocation) — הדף שותק; דף "Manage Account Linking" (createmovelinkpartition) לא נקרא.

## 5. Users & Access Rights: משתמש קריאה בלבד, צד שלישי

### Takeaway
מאומת: ב־Client Portal ניתן להוסיף משתמשים עם הרשאות לפי קבוצות (User Settings, Trading, Reporting, Funding, Account Settings); בחשבון Individual עד 5 אנשים עם Power of Attorney. לא נמצא תיעוד של תפקיד "view only" לצד שלישי; "Read-Only Access" הוא מצב בפלטפורמת המסחר. מצד שני, ה־Flex Web Service הוא הערוץ הקריאה־בלבד המעשי של המשתמש.

### Cited Findings
- מאומת: נתיב: User menu > Settings > User & Access Rights; ניתן להעתיק זכויות ממשתמש קיים, מתפקיד או פרופיל חדש; הקבוצות: User Settings, Trading, Reporting, Funding, Account Settings; כל פונקציה מסומנת בנפרד; אפשר להגביל לחשבונות משנה — [Adding a User](https://ibkrguides.com/clientportal/uar/addingauser.htm)
- מאומת: בחשבון Individual: עד שני שמות משתמש לאדם; "Up to 5 persons may be added with a Power of Attorney" — [Users](https://www.ibkrguides.com/clientportal/uar/users.htm)
- מאומת (תקציר): "Read-Only Access" ב־Settings > Trading Platform מאפשר צפייה ביתרות ופעילות בלי כניסה ולא תפקיד לצד שלישי — [Read-Only Access](https://www.ibkrguides.com/clientportal/usersettings/readonlyaccess.htm) (לא נקרא במלואו)
- מאומת: הרצת דוחות כולל "Third-Party Downloads" ב־Performance & Reports > Statements — [How to Run a Statement](https://www.ibkrguides.com/orgportal/performanceandstatements/runstatement.htm) (תקציר חיפוש, לא נקרא)
- מאומת: בחשבון Individual "Individual advisors can add only themselves" — [Users](https://www.ibkrguides.com/clientportal/uar/users.htm)

### Inferences
- משתמש עם זכויות Reporting בלבד כנראה אפשרי טכנית; לא אומת שהוא מוגבל לקריאה בלבד, ולא אומת תנאי ה־POA לאותו משתמש (ייתכן שדרוש POA כשאין בעלות).

### Gaps
- אין מקור על "Third-Party Downloads" (מה זה, איך מאשרים), ועל הרשאת Reporting-only ללא POA, ועל משלוח דוחות לרואה חשבון.

## 6. תוכניות IB ו־FA, ישות ישראלית, ILS

### Takeaway
מאומת: בקשת IB היא טופס מקוון; הרישוי אינו תנאי בלעדי (אפשר לבחור "לא מורשה/לא רשום"), אך IBKR קובעת שהמשימות Full Service זמינות רק ל־IB מארצות "eligible". רשימת המדינות והסף של IB/FA לא נמצאו. בישראל: גוף ישראלי א׳ היא מותג של גוף ישראלי א׳ (קפריסין, CySEC), IB של IBKR; החשבונות לפי מקורות משניים נפתחים ב־IBIE (אירלנד). שירות ניכוי המס של שירות ה׳ נמצא במקורות משניים בלבד.

### Cited Findings
- מאומת: בקשת Introducing Broker: בוחרים אם הפירמה מורשית/רשומה אצל רגולטור; אם כן — פרטי כל רגולטור; נדרשים Authorized Person, Chief Compliance Officer, MLRO, סיווג מס; חשבון broker הוא master שמקושר לחשבונות הלקוחות ונועד לגביית עמלות ויכול לכלול חשבון proprietary אחד; "can be white branded"; מימון אופציונלי; סקירה על ידי back office — [Introducing Broker application](https://www.ibkrguides.com/appguide/introducing-broker-application.htm). הדף אינו מפרט fully disclosed מול omnibus, מינימום הון או רשימת מדינות.
- מאומת (תקציר חיפוש): IBKR קובעת שמוטלת על היועצים/ברוקרים החובה לברר דרישות רישום בעצמם ושרישום משתנה בין תחומי שיפוט — [Introducing Broker application](https://www.ibkrguides.com/appguide/introducing-broker-application.htm)
- מאומת: Full Service/Streamlined זמינות ל"IBLLC Fully Disclosed Brokers registered with FINRA and/or Introducing Brokers from eligible countries" — [Client Service Programs](https://www.ibkrguides.com/brokerportal/clientserviceprogram.htm)
- מאומת (תקציר חיפוש): הסכם Fully Disclosed Clearing של IBIE (דרך עותק באתר צד ג', ברוקר זר 14): ה־IB אחראי "solely and exclusively" ל־KYC, suitability ושיווק; IBIE מפוקחת על ידי הבנק המרכזי של אירלנד — IBIE Fully Disclosed Clearing Agreement (עותק ברוקר זר 14) [W17] (מקור צד שלישי; לא נקרא)
- מאומת (תקציר חיפוש): יועץ לא־מקצועי (Non-Professional Advisor) מיועד ליועצים פטורים מרישום המנהלים חשבונות לא־מקצועיים (משפחה/חברים); מי שרישומו תלוי ועומד יכול לפתוח ולשדרג לאחר רישום; IBKR מדגישה שעל היועץ לחקור בעצמו את דרישות הרישום — [Non-Professional Advisors](https://www.interactivebrokers.com/en/index.php?f=59795) (לא נקרא; 403 לדומיין; מידע מתקציר)
- מאומת (תקציר חיפוש): "Professional Advisor Registration Requirements" קיים לפי מדינה — [UK](https://www.interactivebrokers.co.uk/en/accounts/advisor-registration.php), [SG](https://www.interactivebrokers.com.sg/en/accounts/advisor-registration.php); עמוד ישראלי לא נמצא
- מאומת (מקור משני): גוף ישראלי א׳ היא מותג של גוף ישראלי א׳, חברה קפריסאית, "separate company ... acting as an introducing broker", בפיקוח CySEC; כספי הלקוחות אינם אצלה (חשבונות נפתחים ישירות מול IBKR); חשבונות לקוחות ישראלים בדרך כלל ב־IBIE (הכתבה עצמה לא עקבית: במקום אחר כתוב שפתיחה בדף הגלובלי מנותבת לישות האמריקאית) — אתר תוכן 1, 11/4/2026 [W5]
- מאומת (מקור משני): שירות ה׳, חברה צד שלישי, מחשבת את המס על רווחי הון ודיבידנדים ומנכה אותו מהחשבון מדי חודש; בסוף שנה מונפק טופס 867 כאישור ניכוי במקור; השירות בחינם ורק לגוף ישראלי א׳; "The article does not say which currency the deduction is made in" — אתר תוכן 1, 11/4/2026 [W5]; קיום השירות גם מופיע במקור: מקור חיפוש גוף ישראלי א׳ [W102] (לא נקרא)
- מאומת (תקציר): ILS ניתן כמטבע הפקדה בהעברה בנקאית וניתן להמיר ל־USD בחשבון — עיתון 6 blog [W103] (בלוג, לא רשמי); ו־KB רשמי של IBKR על "ZAHAV and SWIFT payments for ILS" קיים (https://ibkb.interactivebrokers.com/de/node/4720 — 403, לא נקרא)
- מאומת (תקציר): KB רשמי "Leveraged FX Currency Restrictions for Israeli Retail Clients" קיים — מציין כללי יתרת מטבע שלילית לישראלים — [KB 3242](https://ibkb.interactivebrokers.com/article/3242) (לא נקרא; קיים שם הפניה לישות שיכולה להיות רגולטורית ישראלית — לא ודאי)
- לא ודאי: TASE — לקוחות פרטיים ישראלים לא זכאים (2019, ישן) — [KB TASE](https://ibkb.interactivebrokers.com/ja/node/3382)

### Inferences
- מכיוון שאין מקור שמשייך את שירות ה׳ לשיטת חיוב (Invoice/משיכה/אחר) ולמטבע, ניתן לראות רק שלושה כיוונים: (א) חשבונית IB עם `type` "Other Fees" ב־base USD/EUR של החשבון; (ב) משיכה לצד שלישי תחת "Deposits & Withdrawals" (המרה ל־ILS בחשבון תופיע ב־Trades/FX); (ג) חיוב ב־ILS בחשבון שמחזיק ILS. ללא דוגמה אמיתית — אין להכריע.
- אם הניכוי הוא חשבונית IB, קיימת ההגבלה ש־Full Service/Invoice מיועד ל־IB מארצות eligible; גוף ישראלי א׳ (קפריסין) כ־IB של IBIE — אפשרי, לא אומת.

### Gaps
- רישיון ישראלי נדרש לגביית מס או לייעוץ (רשות ניירות ערך/רשות המסים) — לא נבדק (מחוץ לתחום מקורות IBKR).
- אין רשימת מדינות eligible, מינימום הון, fully disclosed מול omnibus, ואין הצהרה מ־IBKR על "Israeli tax" או שותפים ישראליים.
- ILS כמטבע מזומן בבסיס החשבון, ולמי מותר להחזיק יתרת ILS — לא אומת רשמית.
- אין ראיה פומבית לצורת החיוב של שירות ה׳ ב־Statement/Flex.

## סיכום פער "Other Fees ב־ILS"
- לא מאומת ולא הופרך. ידוע: מקור הנתונים (CashTransaction.type) מקבל "Other Fees" ו"Advisor Fees"; שורת `currency` בשורה היא "currency denomination of the cash transaction"; חשבונית IB/FA ב־CSV במטבע בסיס. כדי להכריע נדרש Flex אמיתי (מוסווה) של לקוח גוף ישראלי א׳ עם ניכוי.
