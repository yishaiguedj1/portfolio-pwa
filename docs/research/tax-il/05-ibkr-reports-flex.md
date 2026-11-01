# 05 — דוחות IBKR ושדות Flex Query לחישוב מס ישראלי (נכון ל־1/11/2026)

> מקרא ודאות: **מאומת** = נקרא ישירות במקור הרשמי של IBKR (ibkrguides.com / interactivebrokers.com) בתאריך המחקר · **סותר** = מקורות לא מסכימים · **לא ודאי** = מקור משני (ספריית קוד פתוח, תוצאת חיפוש בלבד) או הסקה.
> שמות התכונות ב־XML (camelCase) — מדריך ה־Reporting Reference של IBKR מציג רק **כותרות תצוגה** ("Open Date Time", "Holding Period Date Time"), לא את שם התכונה ב־XML. את המיפוי לשמות XML לקחתי מהגדרות הנתונים של ספריית קוד פתוח לפענוח Flex (`ibflex`, קובץ `Types.py`/`enums.py`) — רק כדי ללמוד שמות, בלי להעתיק קוד. לכן כל שם XML שלא מופיע כבר בקוד הפרויקט מסומן **לא ודאי** עד שייבדק מול XML אמיתי של המשתמש (בטלפון/שרתון, לא בריפו).
> מקורות עיקריים (נקראו ב־curl ב־1/11/2026):
> - [Trades (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm) · [Corporate Actions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/corporate%20actionsfq.htm) · [Cash Transactions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/cash%20transactionsfq.htm) · [Change in Dividend Accruals (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/change%20in%20dividend%20accrualsfq.htm) · [Interest Accruals (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/interest%20accrualsfq.htm) · [Transfers (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/transfersfq.htm) · [Financial Instrument Information (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/financialinstrumentinformationfq.htm) · [Open Positions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/open%20positionsfq.htm) · [Statement of Funds (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/statement%20of%20fundsfq.htm) · [Codes](https://www.ibkrguides.com/reportingreference/reportguide/codes_default.htm) · [Corporate Actions (דוח ברירת מחדל)](https://www.ibkrguides.com/reportingreference/reportguide/corporateactions_default.htm) · [Dividends (דוח ברירת מחדל)](https://www.ibkrguides.com/reportingreference/reportguide/dividends_default.htm)
> - [Tax Optimizer (TWS)](https://www.ibkrguides.com/traderworkstation/tax-optimizer.htm) · [Change Match Method for Current or Prior Day](https://www.ibkrguides.com/clientportal/trade/change-match-method-current-prior-day.htm)
> - [Non-US: Year-End Tax Forms](https://www.interactivebrokers.com/en/support/tax-nonus-forms.php) · [Non-US: Year-End Reports](https://www.interactivebrokers.com/en/support/tax-nonus-reports.php) · [Reports and Dates (שנת מס 2025)](https://www.interactivebrokers.com/en/support/reports-and-dates.php)
> - [Flex Web Service OpenAPI](https://www.interactivebrokers.com/docs/openapi/flex-web-service.json)
> - שמות XML (משני): [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py), [ibflex enums.py](https://github.com/csingley/ibflex/blob/master/ibflex/enums.py)

## שאלה 1 — אילו דוחות של IBKR רלוונטיים, והאם יש דוח מס ישראלי?

### Takeaway
אין ל־IBKR דוח מס ייעודי לישראל. ללקוח לא־אמריקאי יש שלושה תוצרים שנתיים: Annual Statement (רווח/הפסד ממומש לפי FIFO או שיטת ההתאמה שנבחרה — **במטבע הבסיס**), Dividend Report (דיבידנדים + ניכוי מס, **במטבע הבסיס**) ו־Form 1042-S (הכנסה ממקור אמריקאי וניכוי במקור). אף אחד מהם לא בשקלים לפי שער יציג ביום העסקה — לכן חישוב ישראלי מדויק חייב להיבנות מנתוני Flex ברמת עסקה/מנה, עם המרה עצמאית לש״ח.

### Cited Findings
- ה־Annual Statement מציג פירוט עסקאות לרווח/הפסד "on a First In, First Out (FIFO) matching basis or the specific method of tax accounting selected for your account" — **מאומת** — [Non-US Year-End Reports](https://www.interactivebrokers.com/en/support/tax-nonus-reports.php)
- ה־Dividend Report מציג את כל הדיבידנדים והתשלומים במקום דיבידנד ואת ניכוי המס עליהם, מסוכם לפי סוג הכנסה; "Dividends will be reported in the base currency of the account"; ניתן לכל הלקוחות — **מאומת** — [Non-US Year-End Reports](https://www.interactivebrokers.com/en/support/tax-nonus-reports.php)
- Form 1042-S מדווח הכנסה ממקור אמריקאי של לא־תושבי ארה״ב שחייבת בניכוי: ריבית, דיבידנדים, substitute payments in lieu ועמלות מנהלי חשבון; טופס נפרד לכל סוג הכנסה לפי קוד ב־Box 1 (01 ריבית ממנפיק אמריקאי, 29 ריבית פיקדון, 30 OID, 06 דיבידנד מחברה אמריקאית, 34 substitute dividends, 35 substitute other, 51 Other Income); Box 2 = סכום ההכנסה, Box 3b/4b = שיעור הניכוי, Box 7 = המס האמריקאי שנוכה, Box 6 = קוד פטור (למשל 04 = פטור לפי אמנה); מדווח גם ל־IRS; הגישה: Reports > Tax > Tax Forms — **מאומת** — [Non-US Year-End Tax Forms](https://www.interactivebrokers.com/en/support/tax-nonus-forms.php)
- מועדי שנת המס 2025: Annual Statement — 2/2/2026; Dividend Report — 17/3/2026 ללקוחות לא־אמריקאים; Form 1042-S — 16/3/2026 ("All accounts"); Forex Income Worksheet — 2/3/2026; "Forms and reports will be available by the end of the day of the date listed" — **מאומת** — [Reports and Dates](https://www.interactivebrokers.com/en/support/reports-and-dates.php). שאלות נפוצות ישנות של IBKR נוקבות "בדרך כלל עד 15 במרץ" — **סותר** (הפרש של יום; הקובע הוא דף המועדים של השנה הנוכחית) — לפי תוצאות החיפוש בלבד.
- IBKR מצהירה שאינה נותנת ייעוץ מס ואינה מסייעת בהגשת דוחות; ברשימות הטפסים/הדוחות הרשמיות לא מופיע שום דוח לישראל (מופיעים טפסי ארה״ב, קנדה T5/T5008/NR4, ולא־אמריקאים 1042-S) — **מאומת** (היעדר) — [Reports and Dates](https://www.interactivebrokers.com/en/support/reports-and-dates.php), [Non-US Year-End Tax Forms](https://www.interactivebrokers.com/en/support/tax-nonus-forms.php)
- Tax Optimizer: כלי ב־TWS/Client Portal לבחירת שיטת התאמת מנות למניות, אופציות, אג״ח, כתבי אופציה, SSF וקרנות; אפשר לשנות ברירת מחדל לחשבון, שיטה ליום הנוכחי/הקודם, שיטה לסימבול ליום הנוכחי/הקודם, והתאמה ידנית של מכירה למנות ספציפיות (current or prior trading day). חוזים עתידיים ואופציות על חוזים — תמיד FIFO. "All profit and loss amounts in the Tax Optimizer are converted to the base currency of your account. However, prices are NOT converted" — **מאומת** — [Tax Optimizer](https://www.ibkrguides.com/traderworkstation/tax-optimizer.htm)
- מועד אחרון לשינוי: 20:30 שעון ניו־יורק (ET), ליום הנוכחי וליום המסחר הקודם; אחרי ה־cut-off של היום הקודם — "will not be able to submit any more changes for that trading day" — **מאומת** — [Change Match Method](https://www.ibkrguides.com/clientportal/trade/change-match-method-current-prior-day.htm)
- קודי שיטת ההתאמה שמופיעים בעמודת הקוד: `HC` Highest Cost, `LI` LIFO, `SL` Specific Lot, `ML` Maximize Losses, `MLG`/`MLL` Max LT Gain/Loss, `MSG`/`MSL` Max ST Gain/Loss; ו־`LT`/`ST` רווח לטווח ארוך/קצר, `LD` הפסד שנפסל בגלל wash sale — **מאומת** — [Codes](https://www.ibkrguides.com/reportingreference/reportguide/codes_default.htm)

### Inferences
- שינוי שיטה ב־Tax Optimizer **משנה** את הרווח הממומש שמופיע בדוחות של IBKR (ה־Annual Statement אומר במפורש "or the specific method ... selected"), ולכן גם את `fifoPnlRealized` ב־Flex — למרות השם. ההוכחה העקיפה: קודי השיטה (`LI`/`HC`/`SL`/`ML`…) מופיעים על שורות העסקה. מכאן: החישוב הישראלי לא יכול לסמוך על `fifoPnlRealized`; הוא צריך לבצע FIFO בעצמו מכל שורות הקנייה/מכירה (או מ־CLOSED_LOT כשהשיטה FIFO) — **לא ודאי** (הסקה).
- זיהוי: מכירה שיש לה בעמודת `notes` אחד מהקודים `LI|HC|SL|ML|MLG|MLL|MSG|MSL` → ההתאמה של IBKR אינה FIFO; להציג אזהרה "IBKR התאים מנות בשיטה X — החישוב כאן לפי FIFO" — **לא ודאי** (הסקה).
- 1042-S שימושי בישראל רק כאסמכתה לסכום המס האמריקאי שנוכה (זיכוי מס זר) — הוא בדולרים, שנתי, ולא מפרט תאריך לכל תשלום. ההמרה לש״ח לפי תאריך התשלום חייבת להגיע מ־CashTransaction — **לא ודאי** (הסקה; כללי הזיכוי בישראל — בתחום של חוקר אחר).

### Gaps
- לא מצאתי דף רשמי שמגדיר במפורש ש־`fifoPnlRealized` ב־Flex מחושב לפי השיטה שנבחרה ולא תמיד FIFO.
- דף רשמי עם רשימת שיטות ההתאמה המלאה (כולל FIFO כברירת מחדל ושיטת "Tax-loss" ל־non-US) לא נקרא — הדף של Client Portal לא מפרט אותן; הקודים לקוחים מדף הקודים.
- האם ה־Tax Optimizer זמין ללקוח ישראלי של IBKR (ישות IBLLC מול ישות אחרת) — לא נמצא מקור.
- מדריך צד ג׳ ישראלי (אתר א׳, נמצא רק כתוצאת חיפוש) טוען ש־IBKR "מפיק דוחות שימושיים להגשה בישראל" וממליץ להמיר לפי שער בנק ישראל — לא אומת ולא נקרא במלואו.

## שאלה 2 — אילו מקטעי Flex ושדות מדויקים צריך, מול מה שהפרויקט כבר קורא?

### Takeaway
הקוד (`ibkr-proxy/lib/ibkr.js`) קורא היום את `Trade`, `OpenPosition`, `CashTransaction`, `Transfer`, `ChangeInNAV`, `EquitySummaryByReportDateInBase` (ובנוסף לפי התדריך CashReport, ForexBalances). לחישוב ישראלי חסרים: (1) מקטע **Corporate Actions**, (2) רמת פירוט **Closed Lots** ב־Trades, (3) **Change in Dividend Accruals** (ex/pay date, gross/tax/fee), (4) **Financial Instrument Information** (subCategory/type), (5) **Conversion Rates** (בקרה), ו־(6) כמה שדות חסרים ב־Trade/CashTransaction (`conid`, `assetCategory`, `subCategory`, `transactionType`, `notes`, `cost`, `tradeDate`, `settleDateTarget`, `reportDate`, `origTradeID`/`origTradeDate`, `actionID`, `code`, `exDate`, `settleDate`).

### Cited Findings
**Trades — מה המדריך הרשמי אומר**
- "For the purpose of cost basis and realized profit or loss, commissions are netted." · Cost Basis: "The basis of an opening trade is the inverse of proceeds plus commission and tax amount. For closing trades, the basis is the basis of the opening trade." · Realized PNL = proceeds של עסקת הסגירה + עמלות + basis — **מאומת** — [Trades (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm)
- שדות קיימים במקטע (כותרות תצוגה): Trade Date, Settle Date Target ("The settle date of execution"), Open/Close Indicator, Notes/Codes, Cost Basis, Realized PNL, MTM PNL, Open Date Time ("The date and time of the initial trade"), Holding Period Date Time (Wash Sales), When Realized/When Reopened (Wash Sales), Original Trade Price/Date/ID/Order ID ("that was cancelled"), IB Order ID, IB Execution ID, Order Time, FX Rate to Base ("conversion rate from asset currency to base currency"), Level of Detail ("Executions, orders or closed lots") — **מאומת** — [Trades (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm)
- רמות פירוט שאפשר לבחור ב־Trades: Symbol Summary, Executions, Orders, Asset Class, **Closed Lots**, Wash Sales — **מאומת** — [Trades (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm)
- Brokerage Order ID / Order Reference / Volatility Order Link — "Available on daily (single-day) activity flex queries only" — **מאומת** — [Trades (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm)
- שמות XML של Trade (90 תכונות) כוללים: `transactionType openCloseIndicator buySell assetCategory subCategory currency fxRateToBase symbol conid cusip isin figi listingExchange multiplier strike expiry putCall underlyingConid underlyingSymbol tradeID transactionID ibExecID ibOrderID reportDate tradeDate tradeTime dateTime settleDateTarget exchange quantity tradePrice tradeMoney proceeds netCash netCashInBase taxes ibCommission ibCommissionCurrency closePrice notes cost fifoPnlRealized capitalGainsPnl fxPnl mtmPnl origTradePrice origTradeDate origTradeID origOrderID origTransactionID relatedTradeID relatedTransactionID openDateTime holdingPeriodDateTime whenRealized whenReopened levelOfDetail orderTime accruedInt principalAdjustFactor issuerCountryCode positionActionID` — **לא ודאי** (ספריית קוד פתוח) — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- בספרייה, מנות סגורות מוגדרות כאלמנט נפרד `Lot` (אותן תכונות כמו Trade, עם `levelOfDetail` ו־`openDateTime`, `cost`), ו־FX כ־`FxTransaction` בתוך `FxTransactions` — **לא ודאי** — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- ערכי `transactionType`: `ExchTrade`, `TradeCancel`, `TradeCorrect`, `FracShare`, `FracShareCancel`, `BookTrade`, `DvpTrade`; ערכי `buySell`: `BUY`, `SELL`, `BUY (Ca.)`, `SELL (Ca.)`; `openCloseIndicator`: `O`, `C`, `C;O`, `-` — **לא ודאי** — [ibflex enums.py](https://github.com/csingley/ibflex/blob/master/ibflex/enums.py)
- `assetCategory`: `STK OPT FUT FOP CASH BOND BILL WAR CFD FXCFD CRYPTO IOPT CMDTY FUND …`; `subCategory` (לפחות): `COMMON ADR ETF` — **לא ודאי** — [ibflex enums.py](https://github.com/csingley/ibflex/blob/master/ibflex/enums.py). המדריך הרשמי: Subcategory = "Stocks only. The specific type of stock or share (e.g., Common or Preferred)" — **מאומת** — [Financial Instrument Information](https://www.ibkrguides.com/reportingreference/reportguide/financialinstrumentinformationfq.htm)

**Open Positions**
- Level of Detail = "Summary or Lot"; ברמת Lot יש Open Date Time, Holding Period Date Time, Originating Order ID ("If the lot originates from an ACATS transfer or a corporate action, there is no available ID"), Originating Transaction ID, Accrued Interest — **מאומת** — [Open Positions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/open%20positionsfq.htm)

**Corporate Actions**
- שדות: Currency, Asset Class, FX Rate to Base, Symbol, Description, Conid, Security ID, CUSIP, ISIN, FIGI, Underlying Conid/Symbol, Multiplier, Report Date ("The day that the corporate action is reflected on the statement"), Date/Time ("The date and time of the corporate action"), Amount, Proceeds, Value, Quantity, Realized P/L, MTM PNL, Code, Type, Transaction ID — **מאומת** — [Corporate Actions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/corporate%20actionsfq.htm)
- קודי `type` (שתי אותיות): OR Asset Purchase · BC Bond Conversion · BM Bond Maturity · CD Cash Dividend · HD/HI Choice Dividend Delivery/Issue · CC Contract Consolidation · CA Contract Soulte · CO Contract Spin Off · CS Contract Split · CI Convertible Issue · CP Coupon Payment · DW Delist Worthless · DI Dividend Rights Issue · ED Expire Dividend Right · FA Fee Allocation · FS Forward Split · GV Generic Voluntary · IC Issue Change · FI Issue Forward Split · TC Merger · PC Partial Call Issue · RS Reverse Split · PI Share Purchase Issue · SO Spin Off · SD Stock Dividend · RI Subscribable Rights Issue · SR Subscribe Rights · TM Tbill Maturity · TI Tender Issue · UE Unknown Event · TO Voluntary Conversion — **מאומת** — [Corporate Actions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/corporate%20actionsfq.htm)
- שמות XML כוללים גם `actionID`, `actionDescription`, `fifoPnlRealized`, `capitalGainsPnl`, `fxPnl`, `costBasis`, `levelOfDetail`, `issuerCountryCode` — **לא ודאי** (לא מופיעים בדף הרשמי; `costBasis` ו־`actionID` במיוחד) — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- בדוח ברירת המחדל, פירוט Closed Lot ו־Wash Sale בתחתית כל מטבע מופיע רק בתבנית מותאמת עם "Hide details for Positions, Trades and Client Fees", ו"not included in default monthly or annual statements" — **מאומת** — [Corporate Actions (default)](https://www.ibkrguides.com/reportingreference/reportguide/corporateactions_default.htm)

**Cash Transactions**
- תיאור: הפקדות, משיכות ותשלומי דיבידנד; שדות: Currency, Asset Class, FX Rate to Base, Symbol, Description, Conid, Security ID, CUSIP, ISIN, FIGI, Underlying Conid/Symbol, Date/Time, Amount, Type, Trade ID, 871(m) Withholding, Code — **מאומת** — [Cash Transactions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/cash%20transactionsfq.htm)
- ערכי `type`: `Dividends`, `Payment In Lieu Of Dividends`, `Withholding Tax`, `Broker Interest Paid`, `Broker Interest Received`, `Bond Interest Received`, `Bond Interest Paid`, `Other Fees`, `Commission Adjustments`, `Advisor Fees`, `Deposits & Withdrawals` — **לא ודאי** — [ibflex enums.py](https://github.com/csingley/ibflex/blob/master/ibflex/enums.py)
- שמות XML נוספים ב־CashTransaction: `actionID`, `exDate`, `settleDate`, `reportDate`, `code`, `transactionID`, `levelOfDetail`, `issuerCountryCode`, `subCategory`, `availableForTradingDate`, `clientReference` — **לא ודאי** — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)

**Change in Dividend Accruals**
- רשומות Po = רישום צבירה חדשה; Re = ביטול, מסיבות: תיקון בצבירה, ביטול צבירה, או "reversal due to payout in cash". שדות: Date, **Ex Date**, **Pay Date**, Quantity ("held prior to ex date"), **Tax**, **Fee**, **Gross Rate** (לכל מניה), **Gross Amount**, **Net Amount**, Code, FromAcct/ToAcct, Report Date, ISIN, Conid — **מאומת** — [Change in Dividend Accruals (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/change%20in%20dividend%20accrualsfq.htm)
- שמות XML: `exDate payDate grossRate grossAmount tax fee netAmount code actionID` — **לא ודאי** — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- הדוח הרגיל Dividends כולל "dividend accruals and accrual reversals as well as ordinary dividend payments" — **מאומת** — [Dividends (default)](https://www.ibkrguides.com/reportingreference/reportguide/dividends_default.htm)

**Interest Accruals**
- ריבית נצברת יומית ומשולמת/מחויבת פעם בחודש אחרי סגירת החודש; בעת הרישום הצבירות היומיות מתבטלות; ההמרה לבסיס "using the conversion rates in effect at the time of the transaction". שדות: Currency, From Date, To Date, Starting Accrual Balance, Interest Accrual, Accrual Reversal, Ending Accrual Balance — **מאומת** — [Interest Accruals (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/interest%20accrualsfq.htm)

**Transfers**
- העברות פוזיציות (ACATS, ATON) והעברות פנימיות; שדות: Report Date, Date, Type, Direction (In/Out), Transfer Company, Transfer Account, Quantity, **Transfer Price**, Position Amount (+in Base), P/L Amount (+in Base), Code, Transaction ID — **מאומת** — [Transfers (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/transfersfq.htm). **אין** בדף שדה עלות מקורית / תאריך רכישה מקורי לפוזיציה שהועברה.
- ערכי `type`: `ACATS`, `ATON`, `FOP`, `INTERNAL`, `INTERCOMPANY`, `OTC`; `direction`: `IN`/`OUT` — **לא ודאי** — [ibflex enums.py](https://github.com/csingley/ibflex/blob/master/ibflex/enums.py)

**Financial Instrument Information / Statement of Funds**
- Financial Instrument Information: Asset Class, Symbol, Subcategory, Listing Exchange, Conid, Security ID, CUSIP ("only if you are subscribed to the CUSIP Service"), ISIN, FIGI, Multiplier, Expiry, Strike, Maturity, Issue Date — **מאומת** — [Financial Instrument Information](https://www.ibkrguides.com/reportingreference/reportguide/financialinstrumentinformationfq.htm). שמות XML: אלמנט `SecurityInfo` במכל `SecuritiesInfo`, עם `type`, `subCategory`, `issuerCountryCode`, `figi` — **לא ודאי** — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- Statement of Funds: יומן של כל תנועות המזומן עם Date, Settle Date, Activity Code, Activity Description, Debit, Credit, Balance, Trade Code, Trade ID — מקטע אופציונלי, לפי מטבע — **מאומת** — [Statement of Funds](https://www.ibkrguides.com/reportingreference/reportguide/statement%20of%20fundsfq.htm)

**Conversion Rates**
- אלמנט `ConversionRate` במכל `ConversionRates` עם `reportDate fromCurrency toCurrency rate` — **לא ודאי** (לא נמצא דף רשמי) — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)

**מה הפרויקט כבר קורא** (נבדק בקוד ב־1/11/2026)
- `ibkr-proxy/lib/ibkr.js` עובר על `findKids(st,'Trade')` (שורה 230), `OpenPosition` (258, מעדיף SUMMARY, LOT רק כגיבוי), `CashTransaction` (299), `Transfer` (313), `ChangeInNAV` (340), `EquitySummaryByReportDateInBase` (358/400). אין קריאה של `CorporateAction`, `ConversionRate`, `SecurityInfo`, `ChangeInDividendAccrual`, `Lot`/CLOSED_LOT, `FxTransaction` — **מאומת** (קוד הפרויקט).

### Inferences
**רשימה מומלצת להוספה (מינימום הכרחי לחישוב ישראלי)**

| מקטע ב־Flex | רמת פירוט | שדות להוסיף (מעבר למה שנקרא היום) | למה |
|---|---|---|---|
| Trades | Executions + **Closed Lots** | `conid`, `assetCategory`, `subCategory`, `transactionType`, `notes`, `tradeDate`, `settleDateTarget`, `reportDate`, `cost`, `tradeMoney`, `multiplier`, `origTradeID`, `origTradeDate`, `relatedTradeID`, `ibExecID`, `levelOfDetail`, `openDateTime`, `fxPnl`, `accruedInt` | FIFO עצמאי לפי מנה; זיהוי ביטול/תיקון (`Ca`/`Co`, `TradeCancel`/`TradeCorrect`); המרה לש״ח לפי **tradeDate** (לא settle); אופציות (`multiplier`, `Ex`/`A`/`Ep`) |
| Corporate Actions | Detail | `type`, `actionID`, `actionDescription`, `description`, `dateTime`, `reportDate`, `quantity`, `proceeds`, `value`, `amount`, `fifoPnlRealized`, `conid`, `isin`, `underlyingConid`, `costBasis` (אם קיים) | פיצול/איחוד (FS/RS/FI), ספין־אוף (SO), מיזוג (TC), מחיקה (DW), דיבידנד במניות (SD), זכויות (RI/SR/DI), פדיון (BM/TM) — כולם משנים כמות/עלות של מנות ב־FIFO |
| Cash Transactions | Detail | `type`, `actionID`, `code`, `reportDate`, `settleDate`, `exDate`, `conid`, `isin`, `symbol`, `issuerCountryCode`, `transactionID`, `levelOfDetail`, `tradeID` | זוג דיבידנד↔ניכוי לפי `actionID` (או conid+תאריך); `Re` = ביטול/תיקון (לקזז, לא להכפיל); ריבית ועמלות |
| Change in Dividend Accruals | Detail | `exDate`, `payDate`, `grossRate`, `grossAmount`, `tax`, `fee`, `netAmount`, `code`, `actionID` | ברוטו/מס לפני תשלום; בקרה מול CashTransaction; צבירה בסוף שנה |
| Financial Instrument Information | — | `conid`, `assetCategory`, `subCategory`, `type`, `listingExchange`, `issuerCountryCode`, `isin`, `multiplier` | סיווג ETF/ADR/REIT/אג״ח לשיעורי מס/ניכוי |
| Conversion Rates | — | `reportDate`, `fromCurrency`, `toCurrency`, `rate` | **רק בקרה**: שער ה־IBKR אינו שער יציג של בנק ישראל |
| Transfers | Detail | `type`, `direction`, `date`, `quantity`, `transferPrice`, `positionAmount`, `conid`, `isin`, `transactionID` | פוזיציה נכנסת — אין עלות מקורית ב־Flex; צריך קלט ידני מהמשתמש |
| Interest Accruals | — | (אופציונלי) | ריבית ממומשת נרשמת ב־CashTransaction; הצבירות רק לבקרה |

**זיהוי מקרים מיוחדים מהקודים**
- `notes` מכיל `Ca` או `transactionType=TradeCancel` → לבטל את העסקה המקורית לפי `origTradeID`; `Co`/`TradeCorrect` → להחליף. אחרת יש כפילות — **לא ודאי** (הסקה מהגדרות הקודים, [Codes](https://www.ibkrguides.com/reportingreference/reportguide/codes_default.htm)).
- `Ex`/`A`/`Ep` → מימוש/הקצאה/פקיעה של אופציה: הפרמיה מתגלגלת לעלות/תמורה של מניית הבסיס — **לא ודאי** (הסקה).
- `R` = השקעה חוזרת של דיבידנד (קנייה חדשה = מנה חדשה); `Re` = ביטול צבירת ריבית/דיבידנד; `Po` = רישום צבירה — **מאומת** (ההגדרות) — [Codes](https://www.ibkrguides.com/reportingreference/reportguide/codes_default.htm)
- `AFx` (המרת מט״ח אוטומטית מעסקה) — **לא ודאי** (מופיע רק ב־[ibflex enums.py](https://github.com/csingley/ibflex/blob/master/ibflex/enums.py), לא בדף הקודים הרשמי) — המרות מט״ח הן `assetCategory=CASH` ב־Trades.
- `LD` (wash sale) ו־`holdingPeriodDateTime`/`whenRealized`/`whenReopened` — כלל אמריקאי; בישראל אין wash sale, לכן הרווח הממומש של IBKR עלול לכלול התאמות שלא רלוונטיות לישראל — **לא ודאי** (הסקה; דין ישראלי — חוקר אחר).
- `RI`/`SR`/`DI` + `SO`: לרוב מופיעים כמה שורות לאותו `actionID` (הנפקת זכות + מימוש/פקיעה) — לקבץ לפי `actionID` — **לא ודאי**.

### Gaps
- לא נמצא דף רשמי שמציג את **שמות תכונות ה־XML**; כל השמות שאינם כבר בקוד מבוססים על ספריית קוד פתוח ודורשים אימות מול XML אמיתי (בשרתון, בלי לשמור בריפו).
- לא אומת ש־CLOSED_LOT מגיע כאלמנט `<Lot>` נפרד ולא כ־`<Trade levelOfDetail="CLOSED_LOT">`. אם הוא מגיע כ־`Trade`, הלולאה הנוכחית בשורה 230 **תכפיל** עסקאות ברגע שהמשתמש יוסיף Closed Lots לשאילתה — חובה לסנן לפי `levelOfDetail` (EXECUTION בלבד לרשימת העסקאות).
- דף רשמי למקטע Conversion Rates ולמקטעי FX (Forex P/L Details / FX Positions / FxTransactions) לא נמצא (404 בשמות שנוסו).
- עלות מקורית של פוזיציה שהועברה מברוקר אחר — לא נמצא שדה ב־Flex; IBKR מאפשרת להזין עלות במערכת שלה (לא נמצא מקור) — לא ידוע אם זה משתקף ב־OpenPosition LOT.

## שאלה 3 — מגבלות Flex ואיך `fifoPnlRealized` של IBKR שונה מחישוב ישראלי

### Takeaway
בקשה אחת ל־Flex Web Service מוגבלת ל־365 יום (הפרויקט כבר חותך לשנים קלנדריות), 1 בקשה בשנייה ו־10 בדקה לטוקן. `fifoPnlRealized` הוא במטבע הנכס (לא בש״ח), כולל עמלות, מושפע משיטת ההתאמה שנבחרה ומהתאמות wash sale, ואינו כולל הפרשי שער — לכן הוא לא בסיס לחישוב ישראלי, רק לבקרה.

### Cited Findings
- `p` (Period): "Number of days from the current date ... A maximum of 365 days may be requested" (מינימום 1, מקסימום 365); `fd`/`td` — "If `fd` is used, the `td` parameter is required"; קצב: "1 request per second; maximum 10 requests per minute per token"; גרסה `v=3` — **מאומת** — [Flex Web Service OpenAPI](https://www.interactivebrokers.com/docs/openapi/flex-web-service.json)
- הפרויקט כבר מתעד: מקסימום 365 יום לבקשה, חיתוך לפי שנים קלנדריות (v124), קוד 1018 = הגבלה רגעית — **מאומת** (תיעוד הפרויקט, `docs/ibkr.md` שורות 16–19)
- Trade Date מול Settle Date Target ("The settle date of execution") הם שדות נפרדים; Report Date ב־Corporate Actions = "The day that the corporate action is reflected on the statement" לעומת Date/Time של האירוע — **מאומת** — [Trades (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm), [Corporate Actions (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/corporate%20actionsfq.htm)
- `fxRateToBase` = "The conversion rate from asset currency to base currency" — שער של IBKR, לא של בנק ישראל; ב־Interest Accruals ההמרה "using the conversion rates in effect at the time of the transaction" — **מאומת** — [Trades (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm), [Interest Accruals](https://www.ibkrguides.com/reportingreference/reportguide/interest%20accrualsfq.htm)
- Realized P/L של IBKR: עמלות "netted" ב־basis; הדוחות השנתיים לפי FIFO "or the specific method ... selected"; ב־Tax Optimizer כל ה־P&L מומר למטבע הבסיס — **מאומת** — [Trades (Flex)](https://www.ibkrguides.com/reportingreference/reportguide/tradesfq.htm), [Non-US Year-End Reports](https://www.interactivebrokers.com/en/support/tax-nonus-reports.php), [Tax Optimizer](https://www.ibkrguides.com/traderworkstation/tax-optimizer.htm)
- קיימים שדות נפרדים `fifoPnlRealized`, `capitalGainsPnl`, `fxPnl`, `mtmPnl` ב־Trade — **לא ודאי** (שמות XML) — [ibflex Types.py](https://github.com/csingley/ibflex/blob/master/ibflex/Types.py)
- מקור משני (פרויקט קוד פתוח) מדווח שה־Period שמוגדר בשאילתה ב־Client Portal גובר על `fd`/`td` שנשלחים בבקשה — **לא ודאי** — לפי תוצאות חיפוש בלבד (הערות שחרור של פרויקט צד ג׳)

### Inferences
- הבדלים בין `fifoPnlRealized` לחישוב ישראלי: (א) מטבע הנכס במקום ש״ח לפי שער יציג ביום הקנייה וביום המכירה בנפרד; (ב) אין רכיב "סכום אינפלציוני"/הפרשי שער; (ג) תלוי בשיטת ההתאמה (קודי Tax Optimizer); (ד) כולל התאמות wash sale (`LD`); (ה) אירועי חברה (SO/TC) מחולקים לפי כללי IBKR — **לא ודאי** (הסקה).
- ההמרה הישראלית צריכה להיות לפי `tradeDate` (תאריך העסקה), לא `settleDateTarget` ולא `reportDate`; בדיבידנד — לפי תאריך התשלום (`payDate` מ־Change in Dividend Accruals, או `dateTime` של CashTransaction), לא `exDate` — **לא ודאי** (הסקה; כלל הדין — חוקר אחר).
- `ConversionRates` של IBKR יכול לשמש בקרת סבירות בלבד מול שער בנק ישראל (חריגה של מעל ~1% = חשד לתאריך שגוי) — **לא ודאי** (הסקה).
- Corrections: עסקה שבוטלה/תוקנה בשנה מאוחרת יותר מופיעה רק בבקשת הטווח של השנה ההיא (לפי `reportDate`) → בטעינה מחדש של שנה קודמת צריך למשוך גם את השנה הבאה ולהחיל ביטולים לפי `origTradeID` — **לא ודאי** (הסקה).
- ריבוי חשבונות: כל שורה נושאת `accountId`; FIFO צריך להיות לכל חשבון בנפרד או מאוחד לפי ההחלטה המשפטית — **לא ודאי**.

### Gaps
- לא נמצא מקור רשמי לעומק ההיסטוריה הזמין ב־Flex (מאיזו שנה אפשר למשוך), ואם יש הגבלה של 365 יום גם על `fd`/`td` (ה־OpenAPI מציין 365 רק עבור `p`).
- לא נמצא מקור רשמי על התנהגות "Corrections" (האם ביטול מופיע בטווח של העסקה המקורית או של יום הביטול).
- לא נמצאה הגדרה רשמית של `capitalGainsPnl` מול `fifoPnlRealized`.
- דפי ה־FAQ הישנים של IBKR (ibkb.interactivebrokers.com) לא נקראו במלואם — רק קטעי חיפוש.
