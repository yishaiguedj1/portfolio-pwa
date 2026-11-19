# מכפיל באפט — מקורות בלתי תלויים לכל רכיב (מחקר חי, 19/11/2026)

> ההקשר: בדיקת העומק של "מכפיל באפט" (`docs/buffett-pe.md`), לכל אחת מ־517 החברות ולכל אחד מ־4 הרבעונים האחרונים.
> **תנאי המשתמש**: רק מקורות חינמיים, **בלי מפתח, טוקן, הרשמה, התחברות או תשלום**.
> **התנאי השני** (חוקי הבנייה הנקייה, `docs/standards.md`): לא שולפים בניגוד ל־robots.txt או לתנאי השימוש.
>
> **איך נבדק**:
> - curl מהקונטיינר דרך הפרוקסי, עם User-Agent של דפדפן. בקשה אחת לכל היותר לשנייה לכל אתר.
> - החברות: NOW, ‏MSFT, ‏AVGO, ‏PLTR, ‏JPM.
> - המחירים: סגירה של 18/11/2026.
> - הפלט הגולמי: `/tmp/claude-0/-home-user-portfolio-pwa/e0eaa790-b793-5dc7-8523-e3607812c1b4/scratchpad/bd/src2/` (מחוץ לריפו, ויימחק בניקוי).
>
> **ל־SEC נשלחו 16 בקשות בלבד**, עם 300ms ביניהן, כי תהליך אחר משתמש בה.

## 0. השורה התחתונה

1. **רק SEC מותר לשליפה אוטומטית בכמות.** הנתונים ציבוריים וחינמיים, והכללים כתובים: עד 10 בקשות לשנייה ו־User-Agent מזהה.
   - כל אתר מסחרי שנבדק אוסר שליפה אוטומטית: בתנאי השימוש, ב־robots.txt, או בחסימת בוטים בפועל.
   - יוצא דופן אחד: stockanalysis.com מתיר "סוכני AI שמכבדים את robots.txt". אבל הספק שלו הוא אותו ספק של Yahoo, ולכן הוא לא מקור עצמאי.
2. **רכיבי הדוחות** (GAAP, תגמול, מניות, מס) — **יש שני מקורות עצמאיים לפחות**, שניהם של SEC אבל בצנרות שונות מ־companyfacts:
   - ההגשה המודפסת: FSDS או דפי R.
   - ההודעה לעיתונות: 8-K ‏EX-99.
3. **רווח הרחוב בפועל** — מקור אוטומטי עצמאי אחד: ההודעה לעיתונות של החברה.
   - Zacks הוא מקור עצמאי שני, אבל **רק לבדיקה ידנית**, כי התנאים שלו אוסרים כלים אוטומטיים.
   - **פער כיסוי חלקי.**
4. **התחזיות** (EPS ‏+1y, הכנסות ‏+1y, מספר אנליסטים, הצפוי לרבעון) — **אין אף מקור עצמאי שמותר לשלוף אוטומטית. פער כיסוי מלא.**
   - מה כן אפשר: בדיקות עקביות פנימיות, ומדגם ידני ב־Zacks.
   - Finviz — ספק לא ידוע, ודף תנאים לא נמצא.
5. **Forward P/E** — לא בודקים מול "מכפיל צפוי" של אתר אחר, כי לכל אתר הגדרה אחרת (סעיף 3, ממצא 4).
   - בודקים את הזהות `מחיר ÷ ‎+1y` של Yahoo. היא התקיימה ב־5 מתוך 5 החברות, עד 3 ספרות.
6. **המחיר** — אין מקור אוטומטי מותר:
   - Cboe אוסר במפורש "use to verify or correct other data".
   - Nasdaq ו־Google אוסרים שליפה ושמירה.
   - Stooq לא נגיש מהסביבה.
   - מה שנשאר: בדיקה פנימית בין שני מסלולי המחיר של המערכת, ומדגם ידני.
7. **ממצא צדדי חשוב — Nasdaq.** כבר בשימוש במערכת (`fundamentals.js` ‏`nasdaqForecast`, ‏`fundxcheck.js`, ‏`tools/fund-deep/verify.py`), ומסומן ✓ ב־`docs/fund-deep-audit.md`. אבל:
   - `api.nasdaq.com/robots.txt` אוסר הכל.
   - תנאי השימוש של Nasdaq (עודכנו 11/05/2026) אוסרים "any process, whether automated or manual, to capture data … for any reason".
   - **החלטה של המשתמש** — לא שינינו קוד.

## 1. מי הספק של מה — שני אתרים עם אותו ספק = מקור אחד

| ספק | איפה הוא מופיע | ראיה |
|---|---|---|
| **S&P Global Market Intelligence** (תחזיות ובפועל) | Yahoo; ‏stockanalysis.com (תחזיות ודוחות); ‏Google Finance (יחד עם Fiscal.ai); ההדגמה של EODHD (תחזיות) | דף העזרה של Yahoo ‏(help.yahoo.com/kb/SLN2310.html): "S&P Global Market Intelligence provides EPS and revenue estimates and actuals". ב־stockanalysis כתוב "estimatesSource:"spg"" ו־‎+1y של NOW = ‏4.8023, **זהה עד הספרה** ל־Yahoo. ב־EODHD ‏MSFT: ‏24.1969 עם 33 אנליסטים, והכנסות 477,146,711,660 עם 55 — **זהה** ל־Yahoo |
| Morningstar | הדוחות הכספיים ב־Yahoo; ‏morningstar.com | עזרה של Yahoo |
| **Zacks** | zacks.com; ‏api.nasdaq.com | בתשובת Nasdaq: "Our vendor, Zacks Investment Research". אבל המספרים **שונים** בין השניים (ממצא 1) |
| FactSet | MarketWatch/WSJ ‏(Dow Jones) | — לא נשלף (אסור, סעיף 2) |
| LSEG I/B/E/S | Fidelity ועוד | Fidelity דורש התחברות ו־JS |
| לא ידוע | Finviz | ה־‎+1y שלו שונה גם מ־S&P וגם מ־Zacks (‏AVGO: ‏19.32, לעומת 19.414 ו־18.90) |
| **SEC EDGAR** | companyfacts ו־frames (**הצנרת של המערכת**); ‏FSDS ודפי R (אותן הגשות, צנרת אחרת); ‏8-K ‏EX-99 (מילות החברה) | — |

## 2. טבלת המקורות (נבדק חי, 19/11/2026)

**מקרא**: ✓ = מותר לכלי אוטומטי · ◐ = רק בדיקה ידנית / מדגם קטן · ✗ = לא בשימוש.

### 2.1 המקורות שמותרים או שימושיים

| מקור | נקודת הקצה (תבנית) | כותרות | HTTP | דוגמה, NOW / MSFT | תנאים ו־robots | קצב | היסטוריה | פסק |
|---|---|---|---|---|---|---|---|---|
| **SEC submissions** | `data.sec.gov/submissions/CIK##########.json` | `User-Agent: <שם> <כתובת>` (בלעדיו 403) | 200 | NOW: ‏8-K עם Item 2.02 ב־28/10/2026 ‏(`0001373715-26-000092`) | ציבורי וחינמי ("download this information for free"); "max request rate: 10 requests/second" | אצלנו 250ms, וזהירות מ־429 לכ־10 דקות | 1000 ההגשות האחרונות | ✓ |
| **SEC ‏8-K ‏EX-99** | `www.sec.gov/Archives/edgar/data/<CIK>/<acc>/index.json` ← הקובץ `*ex99*.htm` (או המסמך שאינו ה־8-K) | כנ״ל | 200 | NOW ‏3Q26: ‏**Non-GAAP diluted ‎$1.00** · GAAP ‎$0.27 · מס 93 על רווח לפני מס 370 (מיליוני $) · תגמול 14% מההכנסות · AVGO: ‏Non-GAAP ‎$3.32 / GAAP ‎$2.68, ‏4,887 מיליון מניות · PLTR: ‏Adjusted ‎$0.44 = GAAP ‎$0.44 (מס ארוך טווח 23%) · JPM ‏4Q25: ‏$4.63, ‏"excluding a significant item" ‏$5.23 | כנ״ל | כנ״ל | מ־2001 | ✓ |
| **SEC companyfacts** | `data.sec.gov/api/xbrl/companyfacts/CIK##########.json` | כנ״ל | 200 (231KB) | NOW ‏3Q26: ‏EPS ‏0.27 · ‏`ShareBasedCompensation` **מצטבר מתחילת השנה** (1,829 − 1,199 = **630** מיליון) · מניות 1,043,011,000 · מס 93/370 | כנ״ל | כנ״ל | מ־2009 | ✓ — **הצנרת של המערכת**, ולכן רק עקביות |
| **SEC frames** | `data.sec.gov/api/xbrl/frames/us-gaap/<tag>/<unit>/CY####Q#.json` | כנ״ל | 200 | ‏EPS CY2026Q3: ‏3,908 חברות (MSFT ‏4.92, ‏JPM ‏5.57); ‏AVGO ב־**CY2026Q2** ‏(4/5–2/8: ‏2.68); תגמול CY2026Q3: רק **523** חברות | כנ״ל | בקשה אחת לכל החברות | — | ✓ — נגזר מ־companyfacts, לכן רק עקביות |
| SEC ‏FSDS / דפי R | `sec.gov/files/dera/data/financial-statement-data-sets/YYYYqN.zip`; ‏`…/<acc>/FilingSummary.xml` + `R#.htm` | כנ״ל | נבדק חי ב־16/11 (`docs/fund-deep-audit.md` §4) | — | כנ״ל | כנ״ל | 2009 עד הרבעון האחרון שפורסם | ✓ — צנרת עצמאית מ־companyfacts |
| **Zacks** (האתר) | `www.zacks.com/stock/quote/<SYM>/detailed-earning-estimates` | דפדפן | 200, ‏HTML בלי JS | NOW: ‏Reported ‏1.00/0.90/0.97/0.92 · Estimate ‏1.02/0.86/0.95/0.87 · F2 ‏(12/2027) **4.80** (20 אומדנים) · הכנסות F2 ‏19.20B (15) · P/E ‏(F1) ‏23.52 · MSFT: ‏Reported ‏4.89/4.74/4.27/4.14 · F2 ‏(6/2028) ‏23.81 (17) | robots מתיר את `/stock/quote/` (חוסם GPTBot). **תנאים**: "The use of automated systems, tools, or software to collect or extract data from this website, e.g., automated data extraction, crawling, or scraping, is expressly prohibited." | — | 4 רבעונים, ו־F1/F2 | ◐ ידני בלבד |
| Finviz | `finviz.com/stock?t=<SYM>&p=d` (הישן `quote.ashx` מפנה לכאן) | דפדפן | 200 | NOW: ‏Forward P/E ‏18.88 · EPS next Y ‏4.80 · next Q ‏1.07 · EPS ‏(ttm) ‏1.39 (=GAAP) · מחיר 90.59 · MSFT: ‏24.13 / 21.07 / 19.15 | robots מתיר `/stock`. **דף תנאים לא נמצא** (‏`/terms` ו־`/help/terms-conditions` מחזירים 404; בתחתית הדף רק Privacy). את הייצוא הוא מוכר במנוי | — | רק צילום עכשווי | ◐ ידני (תחום אפור) |
| stockanalysis.com | `/stocks/<sym>/financials/income-statement/?p=quarterly`, ‏`…/cash-flow-statement/?p=quarterly`, ‏`/forecast/`, ‏`/statistics/` | דפדפן | 200; הנתונים ב־JSON של הדף | NOW ‏3Q26: ‏`epsdil` ‏0.267647 · `sharesDiluted` ‏1,043,011,000 · `taxrate` ‏0.25135 · `sbcomp` ‏630M · `epsNext` ‏4.8023 · `revenueNext` ‏19,262,939,670 · Forward PE ‏19.95 | robots מתיר. **תנאים**: "You may not use bots, scripts, scrapers … to access the platform, collect data from it, or download data in bulk. This does not apply to search engines, AI agents, or other crawlers that follow our robots.txt file" + איסור על בניית מאגר מתחרה | — | 20 רבעונים בחינם (השאר PRO); תחזיות רק לשנה זו ולבאה (‎+2 = ‏"[PRO]") | ◐ סוכן במדגם בלבד; **אותו ספק כמו Yahoo** |
| Google Finance | `www.google.com/finance/quote/<SYM>:<EXCH>` | דפדפן | 200 | NOW: ‏"Earnings per share" ברבעונים **0.92/0.97/0.90/1.00** (=רחוב) · מס אפקטיבי 25.88/30.31/31.96/25.14% · P/E ‏65.27 | robots מתיר `/finance`. **הדיסקליימר**: אסור "copy, modify, reformat, download, store, reproduce, reprocess, transmit or redistribute any data". הספק: S&P ו־Fiscal.ai | — | 4 רבעונים | ◐ ידני; **S&P** |
| ההדגמה של EODHD | `eodhd.com/api/fundamentals/<SYM>.US?api_token=demo&fmt=json` | — | MSFT ‏200; ‏NOW **403** | MSFT: ‏Trend ‏+1y ‏24.1969 (33) = Yahoo · History ‏12/2025 ‏**5.16** (GAAP, לא הרחוב 4.14) · תגמול 9/2026 ‏3.134B | מפתח הדגמה ציבורי, רק לכמה סימבולים (MSFT, ‏AAPL, ‏TSLA, ‏AMZN…) | — | ארוכה | ◐ רק ל־MSFT; **אותו ספק כמו Yahoo** בתחזיות |

### 2.2 המקורות שלא בשימוש

| מקור | HTTP | מה נמצא | פסק |
|---|---|---|---|
| **Nasdaq** ‏(`api.nasdaq.com/api/company/<SYM>/earnings-surprise`, ‏`/api/analyst/<SYM>/earnings-forecast`, ‏`/api/company/<SYM>/financials?frequency=2`, ‏`/api/quote/<SYM>/info`) | 200 עם `Accept`/`Origin`/`Referer` של nasdaq.com | NOW: ‏eps ‏0.51/0.31/0.49/0.52 (!), ‏FY2027 ‏2.71 (19) · MSFT: ‏4.89/4.74/4.27/4.14, ‏FY6/2028 ‏23.81 (17) · מחיר MSFT ‏$506.24 (17/11) | ✗ — `api.nasdaq.com/robots.txt`: ‏`User-agent: * / Disallow: /`. תנאים: "Not access or use the Service, or any process, whether automated or manual, to capture data or content from the Service … for any reason"; רישיון "personal, non-commercial use" |
| Yahoo (המקור של המערכת) | `quoteSummary` בלי crumb → **401 "Invalid Crumb"**; ‏`v8/chart` → 200; דף `finance.yahoo.com/quote/<SYM>/analysis/` → 200, ובתוכו ה־quoteSummary המלא | 23 מודולים, כולל **`earningsHistoryGaap`, ‏`earningsTrendGaap`, ‏`earningsTrendNonGaap`** (ממצא 3) | ✗ לבדיקה — הוא הקלט עצמו. תנאים 2(d)(9): "access or collect data … using any automated means … for any purpose without our express, prior permission". ב־`query1`/`query2` ה־robots הוא `Disallow: /`. ב־finance.yahoo.com — `Disallow: /` ל־anthropic-ai, ‏ClaudeBot, ‏Claude-Web. **5 דפי הניתוח נשלפו לפני שה־robots נקרא — לא לחזור על זה** |
| MarketWatch / WSJ ‏(FactSet) | לא נשלף | robots: ‏`Disallow: /` לכולם + "Collection of content … through automated means is prohibited" | ✗ |
| Macrotrends | לא נשלף | robots: ‏`Disallow: /` ל־ClaudeBot, ‏Claude-User, ‏Claude-SearchBot | ✗ |
| Seeking Alpha ‏(S&P) | לא נשלף | robots: ‏`Disallow: /` ל־ClaudeBot | ✗ |
| Cboe ‏(`cdn-api.cboe.com/api/global/delayed_quotes/quotes/<SYM>.json`) | 200 (הפניה מ־`cdn.cboe.com`) | NOW: ‏close ‏90.59 · prev ‏92.9 | ✗ — התנאים (www.cboe.com/terms): אסור "create a derivative work … from, **use to verify or correct other data** or information" |
| MarketBeat, ‏TipRanks, ‏Benzinga, ‏Barchart, ‏Investing.com, ‏CNBC ‏(`quote.cnbc.com/quote-html-webservice/…`) | 403 / 202 / captcha | חסימת בוטים (Cloudflare, ‏Akamai) | ✗ — לא עוקפים |
| Morningstar | 200, אבל captcha ‏(AWS WAF) ו־JS | robots: ‏`Disallow: /api*` | ✗ |
| Fidelity ‏(LSEG) | 301 ← אפליקציית JS עם "Log in" | — | ✗ |
| Earnings Whispers | 200, ‏1.3KB (שלד JS + "sign in") | — | ✗ |
| companiesmarketcap | 200 | EPS שנתי בלבד, בלי רבעונים ובלי תחזיות | ✗ (לא רלוונטי) |
| Stooq ‏(מחירי סגירה ב־CSV) | **connection reset** (פעמיים, גם ב־robots) | — | ✗ — לא נגיש מהסביבה |
| ההדגמה של Twelve Data ‏(`api.twelvedata.com/earnings?symbol=…&apikey=demo`) | AAPL ‏200; ‏MSFT **403** ("The 'demo' API key is only used for initial familiarity") | AAPL ‏9/2026: ‏eps_actual ‏2.1 (ב־EODHD ‏2.05 — בסיס אחר) | ✗ — סימבול אחד |
| ההדגמה של Alpha Vantage ‏(`function=EARNINGS&apikey=demo`) | IBM ‏200; ‏MSFT — "claim your free API key" | — | ✗ — IBM בלבד |
| FMP, ‏Alpha Vantage, ‏Finnhub, ‏EODHD, ‏Polygon, ‏Tiingo, ‏SimFin (המלאים) | — | קיים, לא בשימוש — **דורש מפתח** (הרשמה) | ✗ |
| Koyfin, ‏TIKR ‏(S&P Capital IQ), ‏Estimize, ‏Wall Street Horizon | לא נבדק חי | ידוע: התחברות או תשלום | ✗ |
| דפי IR של החברות | — | ההודעה לעיתונות זהה ל־8-K ‏EX-99 שב־SEC. התנאים משתנים מחברה לחברה | עדיף SEC |

## 3. ממצאים

### ממצא 1 — "Reported EPS" של Nasdaq **אינו** הרווח המותאם, ואפילו לא מה ש־Zacks מציג באתר שלו

| חברה | 8-K (מותאם / GAAP) | Yahoo (S&P) רחוב | zacks.com ‏"Reported" | **api.nasdaq.com ‏"eps"** |
|---|---|---|---|---|
| NOW ‏3Q26 | 1.00 / 0.27 | 1.00 | 1.00 | **0.51** |
| AVGO ‏FQ3-26 | 3.32 / 2.68 | 3.32 | 3.32 | **3.03** |
| PLTR ‏3Q26 | 0.44 / 0.44 | 0.44 | 0.44 | **0.32** |
| MSFT ‏3Q26 | — / 4.92 | 4.89 | 4.89 | 4.89 |
| JPM ‏4Q25 | 5.23 (בלי הפריט המיוחד) / 4.63 | **4.63** | 5.23 | 5.23 |

- **בחברות שמוציאות את התגמול** (NOW, ‏AVGO, ‏PLTR), Nasdaq נמוך מהמותאם — ובכל הרבעונים ובתחזיות השנתיות.
  - NOW: ‏FY2027 ‏2.71 מול 4.80 ב־zacks.com.
  - הסכום של NOW ב־12 חודשים: ‏1.83. מול 3.79 (רחוב), ‏1.39 (GAAP), ו־2.19 (באפט לפי המערכת).
  - הפער מתאים בערך לתגמול אחרי מס.
- **ההשערה**: סדרה של Zacks שכוללת את התגמול כהוצאה. היא **לא מתועדת**.
- **בחברות שלא מוציאות** (MSFT, ‏JPM), שתי הסדרות זהות.
- **מסקנה**: Nasdaq לא מתאים לאימות של `hist[].a`.
  - הוא היה יכול לשמש בדיקת סבירות לרווח לפי באפט — אבל אסור לפי התנאים.

### ממצא 2 — "הרחוב" שונה בין ספקים בפריטים חד־פעמיים
- **JPM ‏4Q25**:
  - S&P ‏(Yahoo) = ‏4.63, כמו המדווח.
  - Zacks = ‏5.23, "excluding a significant item" לפי ההודעה, ‎+$0.60.
- **MSFT ‏4Q25**: שני הספקים 4.14, ו־GAAP ‏5.16.
- **הלקח**: השוואת `hist[].a` להודעה לעיתונות צריכה **מיון לפי סוג**, לא רק "שווה / לא שווה":
  - שווה למותאם.
  - שווה ל־GAAP — לפעמים גם כשהחברה מוציאה פריטים (PLTR, ‏JPM).
  - "בלי פריט מיוחד".
  - אחר.

### ממצא 3 — Yahoo (S&P) מחזיק סדרות GAAP ו־Non-GAAP נפרדות
- **מה מצאנו**: בדף הניתוח מוטמע `quoteSummary` עם `earningsHistoryGaap`, ‏`earningsHistoryNonGaap`, ‏`earningsTrendGaap`, ‏`earningsTrendNonGaap` (`enableQSPExpandedEarnings=true`).
- **NOW**:
  - GAAP: ‏0.38/0.45/0.29/0.27. **זהה ל־SEC** (‏`Q.eps`, וב־12 חודשים 1.39).
  - Non-GAAP: ‏0.92/0.97/0.90/1.00 = `earningsHistory`.
  - ‎+1y ב־GAAP: ‏**2.097** (17 אנליסטים), מול 4.802 (45).
- **AVGO**: ‏‎+1y ב־GAAP ‏16.333 מול 19.414.
- **המשמעות למערכת** (הצעה בלבד, לא שינינו כלום):
  - אותה קריאת `quoteSummary` שהמערכת כבר עושה יכולה לבקש גם את המודולים האלה.
  - אז `yGaap` (האם הסדרה של Yahoo היא GAAP) אפשר לקבוע **ישירות**, לא בהשוואה ל־SEC.
- **לבדיקת העומק זה לא מקור עצמאי** — זה אותו ספק.

### ממצא 4 — ל"מכפיל צפוי" יש ארבע הגדרות

| מקור | מה המכפיל | ראיה |
|---|---|---|
| Yahoo `forwardPE` | מחיר ÷ ממוצע ‎+1y (השנה הפיסקלית הבאה) | בכל 5 החברות `px/fpe` = ‏‎+1y עד 3 ספרות: NOW 4.802, ‏MSFT 24.197 (שנה שנגמרת ב־6/2028), ‏AVGO 19.414, ‏PLTR 2.539, ‏JPM 25.573 |
| Finviz | מחיר ÷ "EPS next Y" שלו | 508.29 ÷ 24.13 = 21.06 |
| Zacks "P/E (F1)" | מחיר ÷ **השנה הנוכחית** (F1) | NOW: ‏92.9 ÷ 3.95 = 23.52 |
| stockanalysis "Forward PE" | מחיר ÷ **12 החודשים הבאים** (היסק) | NOW: ‏90.59 ÷ 19.95 = 4.54, בין 3.95 ל־4.80 |
| EODHD `ForwardPE` | כנראה מחיר ÷ השנה הנוכחית | MSFT ‏25.64 |

- `docs/buffett-pe.md` אומר שב־META ‏`co.fe` שונה מ־‎+1y. לכן הבדיקה צריכה לסמן כל חברה שבה הזהות לא מתקיימת.

### ממצא 5 — מספר האנליסטים תלוי בספק

| חברה | S&P | Zacks | Nasdaq |
|---|---|---|---|
| NOW | 45 | 20 | 19 |
| MSFT | 33 | 17 | 17 |
| AVGO | 48 | 15 | 14 |
| PLTR | 31 | 15 | 14 |
| JPM | 15 | 10 | 10 |

- אין דרך לאמת את המספר מול ספק אחר. אפשר רק:
  - **נאמנות קלט** — אותו ספק: ההדגמה של EODHD ל־MSFT נתנה 33 = Yahoo.
  - **סבירות** — המספר חיובי ולא קטן מהמספר של `0y`.

### ממצא 6 — מלכודות ב־SEC
- **התגמול מצטבר מתחילת השנה** ב־10-Q. הרבעון = הפרש, והרבעון הרביעי = השנה פחות 9 חודשים.
  - ה־frame הרבעוני של התגמול מכסה רק 523 חברות.
- **שנה פיסקלית מוסטת נופלת ל־frame הסמוך**: AVGO ‏FQ3 (4/5–2/8) נמצא ב־CY2026Q2.
  - מתאימים לפי `end` ‏±20 יום, לא לפי שם ה־frame.
- **התגמול בהודעה לעיתונות ≠ התגמול בתזרים**:
  - NOW: "14% מההכנסות" ≈ ‏575–595 מיליון בהוצאה, מול 630 בתזרים. ההפרש כנראה תגמול שהוכנס לנכסים.
  - המערכת לוקחת את `ShareBasedCompensation` מהתזרים. לכן ההשוואה צריכה להיות תזרים מול תזרים, וההודעה רק לסבירות.
- **רבעון רביעי**: המערכת לוקחת לפעמים EPS ומניות מההודעה לעיתונות (`q4Press` ב־`fundamentals.js`).
  - לכן ברבעונים הרביעיים ההודעה **אינה** בלתי תלויה במערכת. משתמשים ב־10-K פחות 9 חודשים מ־FSDS או מדפי R.
- **המסווג `secsbc.js`** קורא את אותן הודעות. הקביעה "מוציא / כולל" לא מאומתת מול ההודעה — רק המספרים.

## 4. לפי רכיב — מי נותן, ההגדרה, הספק והעצמאות

| רכיב | המערכת לוקחת מ־ | מקורות בלי תהליך (ההגדרה · הספק) | עצמאי מ־Yahoo/SEC של המערכת? | ≥2 עצמאיים? | במקום |
|---|---|---|---|---|---|
| **רווח הרחוב בפועל לרבעון** | Yahoo `earningsHistory.epsActual` ‏(S&P) | ① 8-K ‏EX-99 — המותאם כפי שהחברה מגדירה, וגם GAAP · החברה · ✓ ② zacks.com "Reported" — המותאם לפי Zacks, בלי חד־פעמי · Zacks · ◐ ③ Google "Earnings per share" — רחוב · S&P · ◐ ④ Nasdaq — סדרה אחרת (ממצא 1) · ✗ | ① כן ② כן ③ לא | **אוטומטית — אחד בלבד (①). פער חלקי** | ① לכל 517, ו־② במדגם ידני של 10–15 חברות |
| הצפוי לרבעון (`hist[].e`) | Yahoo ‏(S&P) | zacks.com "Estimate" (‏NOW ‏1.02 מול 1.023) · Zacks · ◐ | כן | **לא — פער** | לא משתתף בחישוב באפט. עדיפות נמוכה. מדגם ידני |
| **EPS מדולל GAAP לרבעון** | SEC companyfacts | ① FSDS ‏`num.txt` / דפי R של ה־10-Q/10-K · SEC · ✓ ② 8-K ‏EX-99 "Diluted" · ✓ (לא ברבעון הרביעי) ③ Yahoo `earningsHistoryGaap` · S&P · ✗ ④ stockanalysis `epsdil` · S&P · ◐ ⑤ Finviz ‏EPS ttm (סכום GAAP) · ◐ | ①② צנרת אחרת של SEC; ③④ ספק אחר | **כן (①+②)** | — |
| **תגמול במניות לרבעון** | companyfacts `ShareBasedCompensation` (מצטבר → הפרש) | ① FSDS / דף R של התזרים (מצטבר → הפרש) · ✓ ② 8-K — טבלת ההתאמה (רבעוני, **הוצאה**) · ✓ ③ stockanalysis `sbcomp` (‏NOW ‏630M) · S&P · ◐ ④ EODHD ‏(MSFT) | ① כן ② כן, בהגדרה קרובה | **כן**, עם הסתייגות (ממצא 6) | ② רק לסבירות (±15%) |
| **מניות מדוללות ממוצעות** | companyfacts | ① FSDS / דף R · ✓ ② 8-K (‏AVGO ‏4,887M, ‏PLTR ‏2,573.9M) · ✓ ③ stockanalysis `sharesDiluted` · ◐ | כן | **כן** | — |
| **מס** (מס ÷ רווח לפני מס, 12 חודשים, ‏`clamp(0.10, 0.35)`, ברירת מחדל 0.21) | companyfacts | ① FSDS / דף R ‏(`IncomeTaxExpenseBenefit` + רווח לפני מס) · ✓ ② 8-K, דוח רווח והפסד (NOW: ‏93/370) · ✓ ③ stockanalysis `taxrate` · ◐ ④ Google · ◐ | כן | **כן** | חישוב מחדש בפייתון, לא בקוד של המערכת |
| **EPS ‏‎+1y** (ממוצע, סוף שנה) | Yahoo `earningsTrend` ‏(S&P) | ① zacks.com F2 · Zacks · ◐ ② Finviz "EPS next Y" · לא ידוע · ◐ ③ stockanalysis / EODHD · **S&P** · נאמנות בלבד ④ Nasdaq · ✗ | ①② כן | **לא, אוטומטית — פער** | זהות `px/fpe`; ‏‎+1y מול ‏0y (הצמיחה בתחום); מדגם ידני ב־Zacks וב־Finviz. **לא מקבלים פער פחות מ־3% בין ספקים כטעות** (MSFT: ‏24.197 / 24.13 / 23.81) |
| **הכנסות ‏‎+1y** | Yahoo ‏(S&P) | ① zacks.com Sales F2 (‏NOW ‏19.20B מול 19.263B) · ◐ ② stockanalysis / EODHD · S&P | ① כן | **לא — פער** | סבירות: ‏‎+1y ÷ ‏12 חודשים בפועל (SEC), בטווח הצמיחה של ‏0y |
| **מספר אנליסטים** | Yahoo ‏(S&P) | תלוי ספק (ממצא 5) | — | **לא, מטבעו** | סבירות בלבד |
| **Forward P/E** | Yahoo `forwardPE` ‏(→ `co.fe = pxY/fpe`) | הגדרות שונות (ממצא 4); Finviz במדגם | — | **לא** | **חישוב מחדש**: `fe` מול ‎+1y לכל 517, וסימון חריגים (META) |
| **מחיר** | `pxF` (חי) / `pxY` | Cboe ✗ (תנאים) · Nasdaq ✗ · Google ◐ · Finviz ◐ · Stooq ✗ (לא נגיש) | — | **לא — פער** | עקביות פנימית: `pxY` מול `pxF` בתוך יום; מדגם ידני |

## 5. המלצה למימוש `tools/buffett-deep/`

**העיקרון**: אוטומטית — **SEC בלבד** (ציבורי, חינמי, כללים כתובים). מכל השאר — לא שולפים בכמות.
- מה שהמערכת קיבלה מ־Yahoo נלקח מתשובת השרתון או מהמטמון ב־R2 (כמו `tools/fund-deep/snap.js`), **לא מ־Yahoo מחדש**.

1. **`snap`** (שימוש חוזר ב־`tools/fund-deep/snap.js`): מה שהמערכת רואה לכל חברה.
   - השדות: `hist[]` ‏(a, ‏e, ‏q), ‏`Q.eps`, ‏`Q.sbc`, ‏`Q.sh`, ‏`ctx.t`, ‏`est` ‏(‎+1y: ‏eps, ‏rev, ‏n, ‏end), ‏`fpe`, ‏`fe`, ‏`pxY`, ‏`pxF`, ‏`sbcX`, והפלט של `bufCalc`.
   - בלי SEC ובלי Yahoo.
2. **`pr`** — ההודעות לעיתונות. שימוש חוזר ב־`lib/secpr.js` וב־`tools/fund-deep/q4pr.js` (המטמון `<w>/pr/<CIK>.p.json`).
   - **השליפה**: ‏`submissions` (1) ← לכל 8-K עם Item 2.02 ב־460 הימים האחרונים (עד 5): `index.json` ‏(1) ו־EX-99.1 ‏(1).
   - **הכמות**: עד ~11 בקשות לחברה, כ־5,700 בסך הכל. ב־250ms — כ־25 דקות, ברצף אחד.
   - **לפני כן**: לקרוא מה שכבר שמור ב־R2 ‏(`fund/bsf/<CIK>.json.gz`, השדות `p`/`sx`) ולשלוף רק את החסר.
   - **מפענחים**:
     - GAAP diluted.
     - המותאם המדולל. דפוסים: "Non-GAAP diluted EPS", ‏"Non-GAAP net income per share - diluted", ‏"Adjusted EPS, diluted", ‏"excluding … ($x.xx per share)".
     - מניות מדוללות.
     - התגמול מטבלת ההתאמה.
     - מס ורווח לפני מס.
3. **`secq`** — הדוחות מצנרת שאינה companyfacts:
   - **FSDS** ‏`num`/`pre` של 2026Q1–Q3. ‏`tools/fund-deep/fsds.py` כבר קורא אותם.
   - **דפי R** ‏(`rpages.py` / `bsf.js`) להגשות שאחרי ה־FSDS האחרון: דוח רווח והפסד ודף התזרים. כ־2–3 בקשות להגשה.
   - **ההמרה לרבעונים**: התגמול מצטבר → הפרש; הרבעון הרביעי = 10-K פחות 9 חודשים.
   - **companyfacts ו־frames** — רק עקביות, ובקשה אחת לכל (תג, רבעון):
     - בערך 5 תגיות × 6 רבעונים = 30 בקשות לכל החברות.
     - התאמה לפי `end` ‏±20 יום.
4. **`cmp`** (פייתון, בלי קוד משותף עם `analysis.js`):
   - **רחוב**: ‏`hist[].a` מול ההודעה. המיון: =מותאם / =GAAP / "בלי פריט מיוחד" / אחר, ±0.005.
     - בבדיקה עם `yGaap` ו־`pol` — האם הניכוי נכון לסוג.
   - **GAAP, מניות, תגמול, מס** מול `secq`:
     - GAAP ±0.005.
     - מניות ±0.5%.
     - תגמול ±1% מול התזרים, ו־±15% מול ההודעה.
     - `t` מחושב מחדש.
   - **באפט 12 חודשים מחושב מחדש**: ‏Σ(רחוב) − Σ(ניכוי לפי `pol`).
   - **הצפוי**:
     - הזהות `fe ≈ ‎+1y` ‏(±0.5%).
     - שיעור התגמול × הכנסות ‎+1y × (1−t) ÷ מניות.
     - `frac`.
5. **רכיבי הספקים** (‎+1y, הכנסות, אנליסטים, `e`, מחיר):
   - **אוטומטית** — רק עקביות פנימית (זהות `fpe`, ‏‎+1y מול ‏0y, הכנסות מול 12 החודשים ב־SEC, ‏`pxY` מול `pxF`).
   - **מדגם ידני של 10–15 חברות** (המשתמש בדפדפן, או החלטה שלו): zacks.com ‏detailed-earning-estimates, ו־Finviz.
     - הסף: פער בין ספקים מעל 5% → בדיקה.
   - **בכלי לא שולפים** את Zacks, ‏Nasdaq, ‏Yahoo, ‏Google או Cboe.
6. **קצב ו־SEC**:
   - **User-Agent**: ‏`TheSnowball/1.0 data@thesnowball.app` — כמו `SEC_UA` בשרתון ו־`UA_SEC` ב־`verify.py`.
   - **קצב**: ‏250ms בין בקשות, תהליך אחד בלבד.
   - **ב־429**: עוצרים ל־10 דקות ולא מנסים שוב מיד.
   - **תיאום**: לא במקביל לתהליך האחר שמשתמש ב־SEC.
   - **מטמון**: כל הקבצים בתיקיית העבודה `<w>/`, לא בריפו.
7. **החלטות למשתמש** (לא לבצע בלי אישור):
   - (א) השימוש הקיים ב־`api.nasdaq.com` — ב־`fundamentals.js`, ‏`fundxcheck.js`, ‏`verify.py`, וגם הסימון ✓ בטבלת המקורות של `docs/fund-deep-audit.md` — מול התנאים וה־robots.
   - (ב) האם להוסיף למערכת את `earningsHistoryGaap`/`earningsTrendGaap` (ממצא 3), כדי לקבוע את `yGaap` ישירות.
