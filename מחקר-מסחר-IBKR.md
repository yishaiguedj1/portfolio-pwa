# מחקר: מסחר מ־IBKR מתוך גרף הנרות (27/10/2026)

> מסמך מחקר. אין בו קוד ואין בו אישור לשום הוצאה. כל מחיר שמופיע כאן הוא **לאימות** בפורטל של IBKR לפני כל רכישה (⛔ כסף רק באישור מפורש).
> המשימה הפתוחה: `משימות-פתוחות.md` (שורה ~23). הרקע על Flex: `docs/ibkr.md`.

## תקציר והמלצה

**ההמלצה: IB Gateway + TWS API, בקונטיינר נפרד בשרת Hetzner. מתחילים בחשבון Paper בלבד, ובמצב קריאה בלבד.**

1. **הגישה הכי נקייה (OAuth ל־Web API) לא פתוחה ללקוח פרטי.** IBKR אומרת במפורש: לקוח ריטייל ניגש ל־Web API רק דרך Client Portal Gateway. ‏OAuth 1.0a נשאר למוסדיים. ‏OAuth 2.0 "נשקל" ליחידים בעתיד, ומופיע רק כבטא לארגונים (בלוג השינויים, 26/02/2026). לא מצאתי הודעה מ־2026 על פתיחה לריטייל.
2. **Client Portal Gateway (עם IBeam או בלי) דורש כניסה מחדש בכל יום.** כל כניסה כזו = אישור 2FA בטלפון. הסשן גם נופל בתדירות גבוהה (דיווחים על נפילה "כמעט כל יומיים").
3. **IB Gateway דורש 2FA פעם בשבוע בלבד** (הכניסה הראשונה אחרי מוצאי שבת בשעון ניו יורק). עם הפעלה אוטומטית מחדש בכל לילה אין צורך ב־2FA בין לבין.
   - ה־API (סוקט) עשיר ומבוסס אירועים: פקודות, ביצועים, פוזיציות, רווח והפסד ומחירים נדחפים מיד, בלי polling.
   - יש ספריית Node מוכרת, `@stoqey/ib`, שמתאימה לשרתון.
4. **בכל מקרה הגשר יושב בשרת שלנו (Hetzner) ולא ב־Vercel.** סשן מחזיק חיבור פתוח, ו־Vercel (‏12/12 פונקציות, בלי מצב) לא מתאים לזה. בטלפון יש רק תצוגה ובקשות.

**החלטות המשתמש (27/10/2026):**
- (א) החשבון הוא **IBKR Pro**. שתי הדרכים פתוחות, וההמלצה (IB Gateway) נשארת.
- (ג) **בלי מנויי נתוני שוק**. המחירים החיים נשארים מהשרתון, ו־IBKR משמש רק לפקודות ולחשבון.
- (ב) ממתין להסבר. ההמלצה: משתמש שני לשרת בלבד, שעולה $0 כשאין מנויים. נדרש רק בשלב 3 (החשבון האמיתי).

**שלוש ההחלטות (הנוסח המקורי):**
- (א) האם החשבון הוא **IBKR Pro או Lite**. ‏Client Portal API עובד רק עם Pro. ‏TWS API עובד עם שניהם.
- (ב) **משתמש שני (username) לחשבון האמיתי.** IBKR מרשה סשן מסחר אחד לכל משתמש, ולכן כניסה לאפליקציה של IBKR בטלפון "תעיף" את הגשר.
  - המשתמש השני עצמו חינם.
  - **אבל דמי נתוני השוק נגבים לכל משתמש בנפרד.** להכריע רק אחרי בדיקת המחיר בפורטל.
  - בשלב Paper זה לא נדרש: לחשבון Paper יש username משלו.
- (ג) **מנויי נתוני שוק בזמן אמת.** לא חובה בשלב הראשון: המחירים החיים כבר מגיעים מהשרתון. ראו הסעיף על עלויות.

---

## 1. שלוש הדרכים להתחבר

| | **Web API + OAuth** | **Client Portal Gateway / IBeam** | **IB Gateway + TWS API** |
|---|---|---|---|
| זמין לחשבון פרטי? | **לא.** ‏OAuth 1.0a למוסדיים, ‏2.0 בבטא לארגונים | כן. זו הדרך הרשמית לריטייל ל־Web API | כן. גם ל־Pro וגם ל־Lite |
| רישום אצל IBKR | אישור "צד ראשון" או vendor, מפתח צרכן | אין. רק משתמש וסיסמה | אין. רק משתמש וסיסמה, והפעלת API בהגדרות |
| תחזוקת הסשן | ‏~24 שעות לטוקן, בלי דפדפן | **כניסה מחדש כל יום** (איפוס בחצות), ‏tickle כל דקה. ‏IBeam = דפדפן אוטומטי (Selenium) שמזין סיסמה, ואת ה־2FA מאשרים ידנית בטלפון | **‏2FA פעם בשבוע.** הפעלה מחדש יומית אוטומטית בלי 2FA |
| אמינות לפי פורומים | — | נמוכה: נפילות תכופות, ו־IBeam "לא מבטיח רציפות" | טובה כשמוגדרים auto-restart ו־"Never lock". ‏IBKR לא תומכת רשמית ב־headless (מריצים עם תצוגה וירטואלית) |
| ממשק | REST + WebSocket | REST + WebSocket (‏`smd` מחירים, ‏`sor` פקודות, ‏`str` עסקאות, ‏`spl` רווח והפסד) | סוקט TCP עם קולבקים: `openOrder`, ‏`orderStatus`, ‏`execDetails`, ‏`position`, ‏`pnlSingle`, ‏`tickPrice` |
| אבטחה | הטובה ביותר: בלי סיסמה בשרת | **הסיסמה בשרת** (IBeam מזין אותה). ‏Gateway מקומי עם תעודה עצמית | **הסיסמה בשרת** (‏IBC / תמונת gateway מזינים אותה) |
| מגבלות קצב | כ־10 בקשות בשנייה | כ־10 בקשות בשנייה, ‏`/iserver/account/trades` רק 7 ימים אחורה | ‏50 הודעות בשנייה, ומגבלות על מספר הזרמים |
| מה היה קורה איתנו | הייתה הבחירה, אילו הייתה זמינה | עובד, אבל דורש לחיצה בטלפון כל בוקר | **מומלץ** |

**הערה על IBC.** הכלי הקלאסי לאוטומציית הכניסה ל־IB Gateway הוא IBC. מקור יחיד (דף PyPI של `ibc2`) טוען שהוא "פרש" בספטמבר 2026, ולא אימתתי את זה.
- החלופה: תמונת `gnzsnz/ib-gateway`, שמתוחזקת וכוללת `AUTO_RESTART_TIME` ו־`TWOFA_TIMEOUT_ACTION=restart`. היא תיבדק לפני הבחירה.
- היא תוצמד ל־digest, כמו שאנחנו עושים בתמונות שלנו.

### אבטחה לפי כללי הפרויקט (ריפו ציבורי)
- **הסיסמה של IBKR = סוד מוצפן** דרך `lib/vault.js`. הוא נפתח רק בתוך הקונטיינר של ה־Gateway בעלייה, ולא נכתב לדיסק או ללוג.
  - לא ב־`SNB_ENV_GZ` הכללי: קונטיינר נפרד עם קובץ env משלו (`0600`).
- **הסוקט של ה־Gateway (‏4001 חי / ‏4002 Paper) רק ברשת הפנימית של Docker.** אין לו פורט פתוח החוצה. רק חדר האפליקציה (`server.js`) מדבר איתו.
- **בהגדרות ה־API ב־IB Gateway:**
  - "Trusted IPs" = רק הרשת הפנימית.
  - "Read-Only API" **דלוק** בשלב 1.
  - "Master API client ID" קבוע.
- **כל פקודה מהטלפון:**
  - הבקשה עוברת דרך השרתון עם Firebase ID token ובדיקת `uid` של הבעלים. החשבון הוא של משתמש אחד בלבד.
  - אחר כך חלון אישור (`askConfirm`) עם סיכום מלא: סימבול, צד, כמות, סוג פקודה ומחיר, ובקשה עם nonce חד־פעמי.
  - בשרת נבדקות מגבלות בטיחות: תקרת כמות או שווי לפקודה, ו־`outsideRth` רק כשביקשו.
- **מספר החשבון, אחזקות, יתרות וביצועים לא נכנסים ל־git, ללוגים או ל־`console.log`.** בלוג נרשם רק `orderId` מקומי וסטטוס. הבדיקות רצות על mocks בלבד (כמו ב־Flex).

---

## 2. עסקאות על גרף הנרות (כמו TradingView), ב־KLineChart 10

כבר יש לנו את התבנית. ‏`kcAlert` ב־`chart.js` (שורה ~801) הוא אוברליי של קו מחיר אופקי שגוררים אותו (`onPressedMoveEnd`, שורה ~1356), עם `groupId` משלו, בחירה באצבע ב־14px (‏`hitAt`) ותפריט בלחיצה ארוכה. פקודות ועסקאות הן אותו דפוס, בקבוצות חדשות:

| רכיב | איך | הערות |
|---|---|---|
| **חיצי קנייה ומכירה** | אוברליי `kcFill` (‏`groupId: 'fills'`, ‏`lock: true`). נקודה = `{timestamp, value: מחיר הביצוע}`. ‏`createPointFigures` מצייר משולש ירוק מתחת לנר בקנייה ואדום מעליו במכירה, עם תווית כמות קטנה | כמה ביצועים באותו נר מתאחדים לחץ אחד עם סכום (כמו TV). בטווח זמן גדול "מתיישרים" לנר שמכיל את הזמן. מקור: עסקאות ה־DB (מ־Flex) ועוד ביצועים חיים מ־`execDetails` |
| **קווי פקודות פתוחות** | אוברליי `kcOrder` (‏`groupId: 'orders'`): קו מקווקו בצבע הצד, ותגית בצד שמאל "LMT 10 @ 182.50 ✕". אפשר לגרור אותו כמו `kcAlert` | `onPressedMoveEnd` לא שולח מיד. הוא פותח אישור "לשנות את המחיר ל־X?", ורק אז נשלח `modifyOrder`. עד שמגיע `orderStatus` הקו "ממתין" (אפור). ‏✕ = ביטול באישור. ‏Stop ו־Take-profit של פקודת bracket = שני קווים מקושרים |
| **מחיר ממוצע של הפוזיציה** | אוברליי `kcPos`: קו מלא דק, ותגית "10 מניות · ממוצע 175.20" עם תווית בציר Y (כמו `kcExtPx` בשורה ~813) | ‏`lock: true`, אי אפשר לגרור אותו |
| **רווח והפסד חי** | בתוך התגית של `kcPos`: "+$73.00 (+4.2%)", ירוק או אדום, ומתעדכן עם המחיר החי שכבר מגיע לגרף | החישוב בטלפון: (מחיר − ממוצע) × כמות. כך אין צורך בזרם `pnlSingle` לכל מניה. הוא רק מאמת |
| **פקודה חדשה מהגרף** | לחיצה ארוכה על מחיר → תפריט "קנייה בלימיט ב־X / מכירה בלימיט / סטופ ב־X". "+" בציר Y כמו ב־TV | תמיד דרך גיליון הזמנה עם אישור. אף פעם לא בלחיצה אחת |

הקבצים שזה נוגע בהם: `chart.js` (אוברליים חדשים ב־`registerOverlays`, וציור מחדש בכל עדכון כמו `drawAlerts`), ו־`STRINGS.he/en` (‏i18n-coverage).
- נדרש QA ברתמה עם מגע CDP אמיתי: גרירה, ביטול וחיצים.
- חיצי העסקאות לבד אפשר להוסיף **כבר עכשיו, מנתוני Flex שיש ב־DB**, בלי שום חיבור חדש. זה שלב 0 בתוכנית.

---

## 3. מה עוד הסנכרון נותן

| יכולת | היום (Flex) | עם הגשר |
|---|---|---|
| אחזקות ויתרות | פעם ביום, באיחור של שעות (הדוח נוצר בסוף יום) | **מיד.** ‏`reqPositions`/‏`reqAccountUpdates` נדחפים בכל שינוי. קנייה דרכנו = האחזקה מתעדכנת תוך שנייה |
| פקודות פתוחות | אין | `reqOpenOrders`/‏`openOrder`: כולל פקודות שנשלחו מהאפליקציה של IBKR |
| התראות ביצוע | אין | `execDetails` → התראה לטלפון ("נקנו 10 AAPL ב־182.50"), באותו ערוץ של התראות המחיר |
| מחירים | Yahoo דרך השרתון (חי, חינם) | אפשר ממנויי IBKR. **לא חובה**, ראו למטה |
| WebSocket לטלפון | — | חדר האפליקציה מחזיק את הסוקט ל־Gateway, ומעביר לטלפון רק שינויים בזרם SSE או WebSocket (כשהאפליקציה פתוחה). כשהיא סגורה — התראות בלבד |

**Flex נשאר** כמקור האמת ההיסטורי ולמס (עסקאות מלאות, דיבידנדים, עמלות, TWR). הגשר מוסיף "שכבת היום" מעליו. בסוף היום Flex מאחד, וכפילויות מזוהות לפי `execId` / `tradeID`.

### עלויות נתוני שוק (⛔ לאימות בפורטל לפני כל רכישה. לא מאושר)
- **Paper**: משתף את מנויי החשבון האמיתי (הגדרה בפורטל: "Share real-time market data with paper account"). בלי מנוי — מחירים מושהים בחינם.
- **בלי מנויים בכלל: ‏$0.** המחירים החיים בגרף נשארים מהשרתון כמו היום, ו־IBKR משמש רק לפקודות ולחשבון. **זו ההמלצה לשלבים 1–3.**
- אם תרצה מחירי IBKR עצמם (למשל מחיר ביצוע מדויק או עומק):
  - "US Securities Snapshot and Futures Value Bundle": לפי דף העזרה **‏$10 לחודש, ומבוטל בחודש עם עמלות של $30 ומעלה**. הדף עצמו מפנה לטבלת המחירים העדכנית.
  - תוספות סטרימינג ל־NYSE/AMEX/NASDAQ (Network A/B/C): במסמך ישן **‏$1.50 כל אחת לחודש** למי שאינו מקצועי. הטבלה הנוכחית שמצאתי סותרת חלקית, ולכן לאמת.
  - **ת״א (TASE)**: לא מצאתי מחיר פומבי. המחיר מופיע ב־Client Portal ← Settings ← Market Data Subscriptions.
  - **החיוב הוא לכל משתמש (username).** משתמש שני לגשר = מנויים כפולים. זו הסיבה שבשלב החי עדיף לבדוק קודם אם אפשר לחיות עם סשן אחד (לא להיכנס לאפליקציה של IBKR בזמן שהגשר מחובר), לפני שמוסיפים משתמש.
- השרת: כבר משולם (Hetzner). קונטיינר Gateway דורש בערך 1–1.5GB זיכרון (Java), ויש לנו מקום. **‏$0 נוספים.**

---

## 4. תוכנית מימוש בשלבים

| שלב | מה | חיבור חדש? | כסף |
|---|---|---|---|
| **0** | חיצי קנייה ומכירה וקו ממוצע (סטטי) על הגרף, מעסקאות Flex שכבר ב־DB | לא | $0 |
| **1** | קונטיינר IB Gateway **Paper, ‏Read-Only** ב־Hetzner, וגשר `lib/ibgw.js` בחדר האפליקציה. אחזקות, יתרות ופקודות פתוחות חיות. התראה לטלפון כשהסשן נפל ("לאשר 2FA") | כן, Paper | $0 |
| **2** | פקודות ב־Paper מהגרף: גיליון הזמנה, אישור, קווי פקודות שגוררים, ביטול, התראות ביצוע | Paper | $0 |
| **3** | אחרי שבועיים יציבים ב־Paper: **החשבון האמיתי** (Read-Only קודם), ותקרות בטיחות בשרת | חי | $0 (אם בלי משתמש שני ובלי מנויים) |
| **4** | (רשות) מחירי IBKR / עומק שוק | — | **רק באישורך, עם מחיר מאומת** |

### כללי הפרויקט בכל שלב
- **פרטיות**:
  - שום מספר חשבון, כמות, יתרה או מחיר ביצוע אמיתי לא נכנס ל־git, ללוגים, לפיקסטורות או לצילומים. ‏`privacy-guard` ירוץ גם על הקבצים החדשים.
  - הבדיקות רצות על mock של TWS API (מחלקה מדומה שפולטת אירועים), אף פעם לא על Gateway אמיתי.
  - בטלפון: מטמון האחזקות החיות נכנס ל־`LS_CACHE_PREFIXES`, ומפתח העדפה חדש ל־`ACCOUNT_KEYS`.
- **appscope**:
  - כל פעולה חדשה מקבלת שורה ב־`SCOPE` (`ibkr-proxy/lib/appscope.js`) עם `['invest']`.
  - פעולות לדוגמה: `op:'live'` (תמונת מצב), ‏`op:'orders'`, ‏`op:'place'`, ‏`op:'modify'`, ‏`op:'cancel'`, ‏`op:'stream'`.
  - ‏`place`/`modify`/`cancel` מקבלות גם בדיקה של הבעלים (uid יחיד, מוגדר בשרת).
- **Vercel ‏12/12**:
  - **אין פונקציה חדשה.** הפעולות נכנסות כ־`op` בתוך `api/ibkr-sync.js`, ומסומנות **`SERVER_ONLY`**: רק בחדר האפליקציה, כי רק שם יש סוקט ל־Gateway.
  - ב־Vercel הן מחזירות 421, והטלפון יודע ליפול לתצוגת Flex (אותו דפוס של `gbRemote`).
- **מכסת Firestore (50K ביום)**:
  - **המצב החי לא עובר דרך Firestore.** הוא נשמר בזיכרון של חדר האפליקציה, ומגיע לטלפון בזרם או בבקשה.
  - נכתב ל־Firestore רק אירוע שצריך להישמר: ביצוע (`execId`), במסמך אחד שמתעדכן, עם debounce.
  - בלי קריאה בכל tick. ‏`studio-fsreads.test` יורחב.
- **אמינות**:
  - healthcheck לקונטיינר.
  - מצב הסשן (`connected` / `needs2FA` / `down`) מוצג בכרטיס IBKR ובמגדל.
  - כשהסשן לא מחובר — כל כפתורי המסחר מושבתים, עם הסבר. אף פעם לא "פקודה בתור".
- **פריסה**:
  - תמונת ה־Gateway מוצמדת ל־digest, וקובץ compose נפרד ב־`server-provision`.
  - סודות חדשים (סיסמת Paper, ואחר כך החי) נכנסים כסוד GitHub מוצפן, לפי הדפוס של `SNB_ENV_GZ`, עם שם מוכן:
    ```
    THE SNOWBALL IBKR Gateway paper
    ```

### מה לא נכלל
פרוקסי overnight, ‏Alpaca, ‏Backblaze B2. נדחו בעבר ולא נבחנו כאן.

---

## מקורות
- [IBKR — Trading Web API (גישת ריטייל דרך Client Portal Gateway, OAuth לארגונים)](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-trading/)
- [IBKR — OAuth 1.0A Extended](https://www.interactivebrokers.com/campus/ibkr-api-page/oauth-1-0a-extended/)
- [IBKR — Web API Changelog (‏OAuth 2.0, ‏26/02/2026)](https://www.interactivebrokers.com/campus/ibkr-api-page/web-api-changelog/)
- [IBKR — Client Portal API v1 (‏WebSocket, ‏Pro בלבד)](https://www.interactivebrokers.com/campus/ibkr-api-page/cpapi-v1/)
- [IBKR — Launching and Authenticating the Gateway](https://www.interactivebrokers.com/campus/trading-lessons/launching-and-authenticating-the-gateway/)
- [IBKR — The IB Gateway (TWS API)](https://www.interactivebrokers.com/docs/tws-api/doc/architecture/the-trader-workstation/the-ib-gateway)
- [IBKR — Weekly Reauthentication](https://www.interactivebrokers.com/docs/excel/dde/best-practice-configure-tws-ib-gateway-for-dde/weekly-reauthentication)
- [IBKR KB — Subscription considerations for U.S. market data (Non-Professionals)](https://ibkb.interactivebrokers.com/fr/node/2840)
- [IBKR — Market data fees](https://www.interactivebrokers.ie/en/index.php?f=37645)
- [IBKR — Finding your paper user credentials](https://www.interactivebrokers.com/docs/general/market-data-subscriptions/market-data-users/finding-your-paper-user-credentials/step-three-go-to-the-settings-page)
- [IBeam (voyz) — PyPI](https://pypi.org/project/ibeam/) · [דיון על 2FA ונפילות ב־IBeam](https://lightrun.com/answers/voyz-ibeam-running-ibeam-for-workflow-services)
- [gnzsnz/ib-gateway (Docker)](https://hub.docker.com/r/gnzsnz/ib-gateway) · [ibc2 — PyPI (הטענה על פרישת IBC)](https://pypi.org/project/ibc2/) · [IBC releases](https://github.com/IbcAlpha/IBC/releases)
- [QuantConnect — IB Gateway automation](https://www.quantconnect.com/announcements/15493/ib-gateway-automation/)
- [ספריית Rust ‏ibkr (דיווח מעשי על OAuth צד ראשון)](https://lib.rs/crates/ibkr)
- [KLineChart — Overlay guide (v9; ה־API של האירועים זהה ל־10, נבדק מול `chart.js`)](https://v9.klinecharts.com/en-US/guide/overlay)
