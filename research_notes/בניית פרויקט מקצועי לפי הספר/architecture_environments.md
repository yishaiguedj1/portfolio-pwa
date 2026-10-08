# ארכיטקטורה וסביבות "לפי הספר" — מה עושות חברות תוכנה, ומה מתאים לפרויקט של אדם אחד (מצב 10/2026)

> מקרא אמינות: **[מאומת]** = נקרא ישירות במקור הראשי (תיעוד רשמי / המאמר המקורי) בסשן הזה, 08/10/2026. **[משני]** = מקור צד שלישי / סיכום של מנוע חיפוש, לא נבדק מול המקור. **[מהפרויקט]** = עובדה על THE SNOWBALL מתוך `CLAUDE.md` שבריפו, לא ממחקר חיצוני.
> הקשר הפרויקט [מהפרויקט]: חזית סטטית ב־GitHub Pages (כל הריפו הציבורי מתפרסם), שרתון Node ב־Vercel Hobby (12 פונקציות — כבר מלא), Firebase אחד לכל דבר (Auth + Firestore), קבצים ב־Drive של המשתמש, מעטפת אנדרואיד (TWA), שרת לינוקס חדש עם Docker. פריסה ישירה ל־`main` אחרי בדיקות CI, בלי סביבת staging.

## 1. השכבות: חזית, שרת (backend), עובדים (workers), מסד נתונים — ולמה מפרידים; חוזי API; ריפו אחד או כמה

### Takeaway
ההפרדה המקובלת היא לפי "מה רץ איפה ומה מחזיק מצב": חזית (רץ אצל המשתמש), שרת API ללא מצב (stateless), עובדים לעבודות ארוכות, ומסד נתונים/שירותי גיבוי שמחוברים כ"משאבים מצורפים" (attached resources). לפרויקט של אדם אחד + AI, ההמלצה של המקורות הקלאסיים היא **מונולית מודולרי בריפו אחד (monorepo)** עם חוזה API כתוב — לא מיקרו־שירותים.

### Cited Findings
- 12-Factor App מגדיר את הכללים לשכבת השרת: "Execute the app as one or more stateless processes" (תהליכים ללא מצב — המצב נשמר רק במסד נתונים/שירות חיצוני), "Treat backing services as attached resources" (מסד נתונים, תור, דואר = משאב שמחברים דרך הגדרה, אפשר להחליף בלי לשנות קוד), "Run admin/management tasks as one-off processes", "Treat logs as event streams" **[מאומת]** — [12factor.net](https://12factor.net/)
- "One codebase tracked in revision control, many deploys" — בסיס קוד אחד, הרבה פריסות (dev/staging/prod הן פריסות של אותו קוד, לא עותקים שונים) **[מאומת]** — [12factor.net](https://12factor.net/)
- Martin Fowler, "Monolith First" (3/6/2015): בהתחלה המהירות חשובה מכל; "the premium of microservices is a drag you should do without"; הפרמיה = "the cost of managing a suite of services, will slow down a team, favoring a monolith for simpler applications"; "Any refactoring of functionality between services is much harder than it is in a monolith" — גבולות בין שירותים קשה לנחש מראש **[מאומת]** — [martinfowler.com/bliki/MonolithFirst](https://martinfowler.com/bliki/MonolithFirst.html)
- monorepo מוגדר כ־"a single repository containing multiple distinct projects, with well-defined relationships"; polyrepo = כל אפליקציה בריפו נפרד עם תלויות/CI משלה. יתרונות: שינוי אטומי (atomic commit) שחוצה פרויקטים ב־PR אחד ("Everything works together at every commit"), שיתוף קוד בלי פרסום חבילות, מוסכמות שנאכפות במקום אחד. "A good monorepo is the opposite of monolithic!" — monorepo ≠ מונולית; צריך חלוקה ברורה לתיקיות/מודולים **[מאומת]** — [monorepo.tools](https://monorepo.tools/)
- חוזה API: OpenAPI Specification = "the most broadly adopted industry standard for describing new APIs" — תיאור מכונה־קריא של API מבוסס HTTP, שמשמש לתיעוד, ליצירת קוד לקוח/שרת (codegen) ולוולידציה של בקשות/תשובות. הגרסה האחרונה שמכוסה באתר הרשמי היא 3.2 (לפי מדריכי השדרוג שם) **[מאומת חלקית — מספר הגרסה מוסק מהאתר, לא נאמר במפורש]** — [learn.openapis.org](https://learn.openapis.org/)
- גרסאות API ושינוי שובר (breaking change): תבנית "Parallel Change" (expand → migrate → contract, Danilo Sato, 13/5/2014): מוסיפים את הממשק החדש לצד הישן, מעבירים את הלקוחות בהדרגה, ורק אז מוחקים את הישן; המחיר — "the supplier has to support two different versions" בתקופת המעבר **[מאומת]** — [martinfowler.com/bliki/ParallelChange](https://martinfowler.com/bliki/ParallelChange.html)

### Inferences
- **אצלנו**: החזית (`app.js`/`library.js`/`studio.js`) = שכבת לקוח; `ibkr-proxy/` = שכבת API ללא מצב (תואם 12-Factor — המצב ב־Firestore); העובד של הסטודיו (Routine + `translator/`) ובעתיד השרת החדש = שכבת workers; Firestore + Drive = backing services. כלומר המבנה הקיים כבר "לפי הספר" ברמת השכבות; מה שחסר הוא בעיקר הפרדת סביבות (סעיף 2).
- ריפו אחד (`portfolio-pwa`) הוא בחירה נכונה לאדם אחד + AI: ה־AI רואה את כל ההקשר, שינוי שחוצה חזית+שרתון נכנס ב־PR אחד, והבדיקות כבר משוות קבצים "זהים" בין חזית לשרתון (`lib/market.js`, `lib/ibkrdates.js`) — זו בדיוק בעיית polyrepo שנחסכת. התנאי: חלוקה ברורה לתיקיות (כבר קיים: `ibkr-proxy/`, `android/`, `translator/`).
- חוזה API: החלופה הקלה ל־OpenAPI מלא היא קובץ חוזה אחד (OpenAPI או אפילו JSON Schema) לכל endpoint חיצוני שהשרת החדש יחשוף — מועיל במיוחד כש־AI כותב גם לקוח וגם שרת (מקור אמת אחד שאפשר לבדוק מולו בבדיקות). כרגע האפליקציה וחנות האנדרואיד/ווידג׳ט צורכות את `/api/widget` — שם שינוי שובר מסוכן במיוחד (APK ישן בשטח), ולכן expand/contract רלוונטי.

### Gaps
- לא נמצא מקור ראשי עדכני (2025–2026) שממליץ במפורש על מבנה ריפו לפרויקט "סולו + AI"; ההמלצה כאן מוסקת מהעקרונות הכלליים.
- לא נבדקו מדריכי versioning ספציפיים (URI `/v1/` מול כותרת) ממקור ראשי.

## 2. סביבות: מקומי, תצוגה מקדימה (preview), staging, ייצור (production) — ומה המינימום האפקטיבי

### Takeaway
החברות מחזיקות שרשרת סביבות שכל אחת "דומה יותר לייצור" מהקודמת, עם **הגדרות (config) במשתני סביבה**, **פרויקט Firebase נפרד לכל סביבה**, מפתחות ותקציבים נפרדים, ונתוני בדיקה מזויפים. לפרויקט סולו המינימום האפקטיבי: מקומי עם אמולטורים + preview אוטומטי לכל PR (שבא "בחינם" ב־Vercel/Cloudflare) + ייצור; staging קבוע הוא אופציונלי.

### Cited Findings
- **ההגדרה של config ב־12-Factor**: "everything that is likely to vary between deploys (staging, production, developer environments, etc)" — כתובות שירותים, סודות, שם המארח. מבחן הלקמוס: "whether the codebase could be made open source at any moment, without compromising any credentials". משתני סביבה עדיפים כי משנים אותם בין פריסות בלי לשנות קוד, וקשה לשמור אותם בריפו בטעות **[מאומת]** — [12factor.net/config](https://12factor.net/config)
- **Dev/prod parity** — שלושה פערים: זמן ("code that takes days, weeks, or even months to go into production"), אנשים ("Developers write code, ops engineers deploy it"), כלים (SQLite מקומי מול PostgreSQL בייצור). "The twelve-factor developer resists the urge to use different backing services between development and production"; כל הסביבות צריכות "same type and version of each of the backing services"; Docker מקל על שחזור הייצור מקומית **[מאומת]** — [12factor.net/dev-prod-parity](https://12factor.net/dev-prod-parity)
- עוד עקרונות 12-Factor: "Strictly separate build and run stages" (בונים פעם אחת, אותו תוצר עובר בין סביבות); "Maximize robustness with fast startup and graceful shutdown" (disposability — אפשר להרוג ולהפעיל מחדש תהליך בכל רגע) **[מאומת — כותרות בלבד]** — [12factor.net](https://12factor.net/)
- **Firebase**: "Firebase recommends using a separate Firebase project for each environment in your development workflow"; גרסאות debug ו־release בפרויקטים נפרדים; הפרויקטים לא חולקים משאבים כי נתוני debug עלולים "לזהם או לדרוס" נתוני ייצור; גרסאות פלטפורמה (אנדרואיד/ווב) באותה סביבה יכולות לחלוק פרויקט **[מאומת]** — [Firebase: general best practices](https://firebase.google.com/docs/projects/dev-workflows/general-best-practices)
- **Firebase Local Emulator Suite**: מדמה Firestore, Auth, Hosting, Storage, Realtime DB, ו־(בטא) Functions/Pub/Sub/Extensions; מאפשר "integration testing or QA without touching production data", בדיקות יחידה ו־CI, ובדיקה ידנית "without configuring a test project"; אזהרה: "built for accuracy, not performance or security, and are not appropriate to use in production" **[מאומת]** — [firebase.google.com/docs/emulator-suite](https://firebase.google.com/docs/emulator-suite)
- **Vercel** (תיעוד עודכן 17/09/2026): שלוש סביבות ברירת מחדל — Local, Preview, Production. Preview נוצר אוטומטית בכל push לענף שאינו ענף הייצור ובכל PR, עם כתובת לענף וכתובת לקומיט. לכל סביבה משתני סביבה משלה. **Custom Environments (למשל `staging`) — רק Pro/Enterprise** (Pro: אחת לפרויקט). ב־Hobby אפשר staging בדרך "Preview branch for staging": ענף `staging` + דומיין משויך + משתני Preview ייעודיים לענף. אפשרות שלישית: "staged production deployment" — לבטל שיוך אוטומטי של דומיין הייצור ולקדם (promote) ידנית אחרי בדיקה; אזהרה: זו משתמשת במשתני הייצור "so testing can access production services and data" **[מאומת]** — [vercel.com/docs/deployments/environments](https://vercel.com/docs/deployments/environments)
- **Feature flags** (Pete Hodgson, martinfowler.com, 2016/2017): ארבעה סוגים — Release toggles (מסתירים קוד לא גמור בייצור; קצרי חיים, שבוע־שבועיים), Experiment (A/B), Ops (מתג חירום — "kill switch", לכבות פיצ'ר כבד בעומס, חייב להשתנות בלי פריסה), Permissioning (פיצ'ר לקבוצת משתמשים, למשל בטא). אזהרה: כל דגל מוסיף ענפי קוד ומעמסת בדיקות; לנהל אותם כ"מלאי" שצריך לצמצם, תאריך תפוגה, משימת הסרה לכל דגל; הסיפור של Knight Capital כאזהרה לדגלים ישנים **[מאומת]** — [martinfowler.com/articles/feature-toggles](https://martinfowler.com/articles/feature-toggles.html)
- **מגבלות הוצאה**: ב־Google Cloud (שמתחת ל־Firebase) תקציב התראות "doesn't automatically cap ... usage or spending"; לחסימה צריך Pub/Sub שמכבה חיוב בפרויקט ("programmatically disabling Cloud Billing on a project"), או תקציב spend-cap היכן שנתמך **[מאומת]** — [Google Cloud: budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets)
- **Continuous Delivery** (Fowler, 2013/2014): התוכנה "can be released to production at any time"; Continuous Deployment = "every change goes through the pipeline and automatically gets put into production" — דורש CD קודם; ה־pipeline מעביר תוצרים דרך סביבות "יותר ויותר דומות לייצור" **[מאומת]** — [martinfowler.com/bliki/ContinuousDelivery](https://martinfowler.com/bliki/ContinuousDelivery.html)
- Google SRE, Release Engineering: builds הרמטיים (אותה תוצאה בכל מכונה), שחרורים תכופים = פחות שינויים בין גרסאות, וההגדרות (configuration) נשמרות בריפו תחת סקירה כי "Configuration changes are a potential source of instability" **[מאומת — ציטוטים דרך סיכום של כלי הקריאה]** — [sre.google/sre-book/release-engineering](https://sre.google/sre-book/release-engineering/)

### Inferences
- **"לפי הספר" בחברה גדולה**: local (אמולטורים/Docker) → preview לכל PR (נתוני בדיקה, מפתחות בדיקה) → staging קבוע (העתק מלא של הייצור, פרויקט Firebase נפרד, דומיין נפרד) → production, עם קידום של **אותו תוצר בנוי** בין השלבים, ומפתחות/תקציבים/חשבונות שירות נפרדים לכל סביבה.
- **המינימום האפקטיבי לסולו + AI** (מוסק):
  1. **פרויקט Firebase שני** (`…-dev`) לכל מה שאינו ייצור — זו ההמלצה הרשמית, חינמית ב־Spark, ומונעת את התרחיש שבדיקה/preview כותבת ל־`users/{uid}` האמיתי. בנוסף אמולטורים בבדיקות.
  2. **Preview אוטומטי לכל PR** — כבר קיים לשרתון ב־Vercel (Hobby), אבל כרגע Preview משתמש באותם משתנים כמו הייצור אם לא הוגדרו נפרדים → להגדיר משתני Preview שמצביעים ל־Firebase ה־dev ולמפתחות בדיקה (Gemini/Drive/Anthropic נפרדים או מושבתים).
  3. **ייצור** — כמו היום, עם המנגנון הדו־שלבי של `sw.js`.
  4. staging קבוע — לא חובה; אם רוצים: ענף `staging` עם דומיין ב־Vercel (נתמך ב־Hobby) + אתר חזית נפרד.
- **מבחן ה־12-Factor על הפרויקט**: הריפו ציבורי ומבחן "אפשר לפרסם את הקוד בכל רגע" כבר נאכף ב־`privacy-guard.test.js`. אבל כתובות כמו `IBKR_PROXY_DEFAULT` ומזהה פרויקט Firebase "קשיחים" בקוד הם config לפי ההגדרה — כדי שאותה חזית תרוץ מול dev ומול prod, הם צריכים להיבחר לפי הסביבה (למשל לפי ה־hostname) ולא להיות קבועים.
- **תקציבים**: התראת תקציב לא עוצרת חיוב — בפרויקט ייצור עם חיוב (למשל Gemini Tier 1) כדאי מפסק אמיתי (הקוד כבר עושה את זה ברמת האפליקציה — `lib/aicache.js` עם מפסק יומי [מהפרויקט]) ומפתח API נפרד ל־dev עם מכסה נמוכה.
- **Feature flags לסולו**: Ops toggle ("מתג חירום") ו־Release toggle פשוט (שדה בהגדרות/ב־Firestore) נותנים את רוב הערך; מערכת דגלים חיצונית מלאה מיותרת. לכל דגל — תאריך הסרה.
- **נתוני בדיקה**: כבר קיים תיק דמו פיקטיבי (`BRK_13F`) — זה בדיוק "test data" לפי הספר; ההרחבה הטבעית היא seed קבוע לפרויקט ה־dev/אמולטור.

### Gaps
- לא נבדק מול מקור ראשי מה ההבדל המדויק במשתני סביבה בין preview ל־production ב־Cloudflare Pages (העמוד שנקרא לא כיסה זאת).
- AWS Well-Architected לא נקרא בסשן הזה — אין ממנו ציטוטים.
- לא נמצא מקור ראשי שמכמת "כמה סביבות" מתאימות לגודל צוות.

## 3. שינויי מסד נתונים (schema) בבטחה: מיגרציות, תאימות לאחור (expand/contract), Firestore בין גרסאות

### Takeaway
הכלל המקצועי: **מפרידים את שינוי מבנה הנתונים מפריסת הקוד**, ועושים אותו בשלבים שבהם הישן והחדש עובדים יחד (expand → migrate → contract). ב־Firestore (בלי טבלאות ובלי ALTER) זה אומר: קוד שקורא את שתי הצורות, שדה גרסה במסמך, והמרה בזמן קריאה או סקריפט מילוי (backfill) — שנבדק קודם באמולטור.

### Cited Findings
- Fowler, Blue-Green Deployment (2010, עדכון 2015): "The trick is to separate the deployment of schema changes from application upgrades" — קודם שינוי במסד שתומך בגרסה הישנה והחדשה, אחר כך הקוד החדש, ורק אחרי שהתייצב — הסרת התמיכה בישן; וגם "Blue-green deployment also gives you a rapid way to rollback" (החלפת ראוטר בין שתי סביבות זהות) **[מאומת]** — [martinfowler.com/bliki/BlueGreenDeployment](https://martinfowler.com/bliki/BlueGreenDeployment.html)
- Parallel Change: expand / migrate / contract — "particularly useful when practicing ContinuousDelivery" **[מאומת]** — [martinfowler.com/bliki/ParallelChange](https://martinfowler.com/bliki/ParallelChange.html)
- ב־Firestore אין ALTER TABLE; שינוי מודל = סקריפט שקורא וכותב מחדש מסמכים בזמן שהאפליקציה חיה, ולכן יש תקופה של נתונים מעורבים **[משני]** — [newline.co checklist](https://www.newline.co/@Dipen/8-step-firebase-schema-migration-checklist--80b78686)
- המרה בזמן קריאה עם `FirestoreDataConverter` — כל שאר הקוד רואה רק את הצורה החדשה **[משני]** — [strift, Medium](https://strift.medium.com/handling-schema-evolution-with-cloud-firestore-22d94fb9722f)
- שדה גרסה במסמך (`schema_version`) ומיגרציה עצלה (בזמן גישה) או בקבוצות — מקור MongoDB, הרעיון זהה **[משני]** — [reintech](https://reintech.io/blog/best-practices-mongodb-schema-versioning)
- `fireway` — מריץ מיגרציות ממוספרות ל־Firestore בסגנון Flyway, שומר אילו רצו באוסף בתוך Firestore, תומך ב־`--dryrun` ומול האמולטור **[משני — README של הכלי]** — [github.com/j1mmie/fireway](https://github.com/j1mmie/fireway)

### Inferences
- **רלוונטי מאוד לפרויקט**: לאפליקציה יש קוד ישן בשטח שלא מתעדכן מיד — PWA עם Service Worker (גרסה ישנה יכולה לרוץ עד שהלשונית נסגרת, סעיף 5) ו־APK. לכן גרסה N ו־N−1 של הלקוח יקראו את אותו מסמך `users/{uid}` במקביל — כל שינוי במבנה המסמך חייב להיות additive (רק להוסיף שדות) ושני הצדדים חייבים לסבול שדה חסר/לא מוכר. הפרויקט כבר עושה זאת בפועל (למשל `stripLegacyDemo`, `fixAgorotEntries`, `normSettings` — מיגרציות בזמן קריאה [מהפרויקט]); מה שחסר לפי הספר: שדה גרסה מפורש במסמך ובדיקת מיגרציה מול האמולטור לפני ייצור.
- מחיקה/שינוי שם של שדה = שלב contract — רק אחרי שכל הלקוחות עודכנו (בפועל: כמה ימים/שבועות, בגלל APK ומטמון SW).

### Gaps
- לא נמצא תיעוד רשמי של Google על "schema migrations" ב־Firestore; הממצאים על Firestore הם ממקורות משניים.

## 4. תשתית כקוד (Infrastructure as Code): Docker Compose, Terraform/OpenTofu — ולמה זה חשוב

### Takeaway
IaC = כל ההגדרות של השרתים/השירותים בקבצים בריפו, לא בלחיצות בממשק — כך אפשר לשחזר סביבה, ליצור staging זהה לייצור, ולראות היסטוריה של כל שינוי. לשרת Docker יחיד, קובץ `compose.yaml` בריפו הוא כבר IaC מספיק; Terraform/OpenTofu מתחילים להשתלם כשיש הרבה משאבי ענן (פרויקטי Firebase, DNS, כמה שרתים).

### Cited Findings
- Fowler, Infrastructure as Code (1/3/2016): "the approach to defining computing and network infrastructure through source code"; עקרונות: קבצי הגדרה, "At no time should anyone log into a server and make on-the-fly adjustments", לשמור הכל בבקרת גרסאות, בדיקות רציפות, שינויים קטנים — "The bigger the infrastructure update, the more likely it is to contain an error" **[מאומת]** — [martinfowler.com/bliki/InfrastructureAsCode](https://martinfowler.com/bliki/InfrastructureAsCode.html)
- Docker Compose: שם הפרויקט (project name) "isolate[s] environments from each other" — אפשר להריץ כמה עותקים של אותו stack על מחשב אחד; קובעים אותו ב־`-p`, `COMPOSE_PROJECT_NAME`, או `name:` בקובץ **[מאומת]** — [docs.docker.com/compose/how-tos/project-name](https://docs.docker.com/compose/how-tos/project-name/)
- OpenTofu: "a community-driven open source fork of Terraform", תחליף ישיר, פרויקט של Linux Foundation; גרסה יציבה ראשונה 1.6.0 ב־10/1/2024 **[מאומת]** — [opentofu.org](https://opentofu.org/blog/opentofu-is-going-ga/)
- הרקע: ב־10/8/2023 HashiCorp העבירה את Terraform מ־MPL 2.0 ל־Business Source License 1.1 (מותר כל שימוש חוץ מהצעה מתחרה); OpenTofu התקבל ב־Linux Foundation ב־20/9/2023 **[משני — הודעה לעיתונות דרך צד שלישי]** — [Seeking Alpha (הודעת HashiCorp)](https://seekingalpha.com/pr/19429483-hashicorp-adopts-the-business-source-license-for-future-releases-of-its-products), [CCS Insight](https://www.ccsinsight.com/blog/terraform-community-breaks-ground-on-open-source-alternative/)
- Google SRE: builds הרמטיים — "insensitive to the libraries" שמותקנות במכונה **[מאומת דרך סיכום]** — [sre.google](https://sre.google/sre-book/release-engineering/)

### Inferences
- **אצלנו**: הסביבה של העובד בענן כבר נבנית מסקריפט (`translator/setup.sh`) — זה IaC בקטן. לשרת החדש: `compose.yaml` + `Dockerfile` + קובץ `.env.example` בריפו (בלי סודות), ושום שינוי ידני על השרת ("no on-the-fly adjustments") — ככה ה־AI יכול לשחזר/לתקן את השרת מתוך הריפו, ושרת חלופי עולה בפקודה.
- Terraform/OpenTofu לסולו: אופציונלי. יכול לנהל פרויקטי Firebase/DNS/Cloudflare כקוד, אבל מוסיף "state" שצריך לשמור ולהגן עליו. סביר לדחות עד שיש יותר משרת אחד או כמה סביבות ענן.

### Gaps
- לא נמצאה עמדה עדכנית של Thoughtworks Tech Radar על OpenTofu (החיפוש לא החזיר blip רשמי).

## 5. חזית סטטית / PWA: preview ו־staging, והשלכות של Service Worker

### Takeaway
GitHub Pages מגיש **אתר אחד לריפו בלי preview לכל ענף**; Cloudflare Pages ו־Vercel נותנים preview אוטומטי לכל ענף/PR בכתובת נפרדת. ב־PWA, כל סביבה חייבת להיות על **origin נפרד** (דומיין/תת־דומיין) — אחרת Service Worker, מטמון ו־localStorage מתערבבים — ושינוי גרסה צריך לקחת בחשבון שגרסה ישנה ממשיכה לרוץ עד שכל הלשוניות נסגרות.

### Cited Findings
- GitHub Pages: אתר עד 1GB, 100GB/חודש (רך), 10 בניות לשעה (רך, לא חל על פריסה ב־Actions), timeout של 10 דקות; "not intended for or allowed to be used as a free web-hosting service" לעסקים/SaaS; "shouldn't be used for sensitive transactions like sending passwords or credit card numbers". העמוד לא מזכיר preview לכל ענף **[מאומת]** — [docs.github.com: Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)
- Cloudflare Pages: preview לכל ענף ו־PR; כתובת עם hash (`373f31e2.<project>.pages.dev`) + כינוי לענף (`<branch>.<project>.pages.dev`); ציבורי כברירת מחדל, אפשר להגביל בהגדרת Access; `X-Robots-Tag: noindex` כברירת מחדל **[מאומת]** — [developers.cloudflare.com/pages](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
- Vercel: preview לכל push לענף שאינו ייצור ולכל PR, כתובת לענף ולקומיט **[מאומת]** — [vercel.com/docs](https://vercel.com/docs/deployments/environments)
- Service Worker (web.dev): בדיקת עדכון בכל ניווט (ובאירועים — לא יותר מפעם ב־24 שעות); "מעודכן" = בייטים שונים; SW חדש שנכשל בהתקנה נזרק והישן ממשיך; החדש **ממתין** עד שאין אף לשונית שנשלטת ע"י הישן (רענון רגיל לא מספיק); `skipWaiting()` מפעיל מיד אבל אז דפים שנטענו בגרסה הישנה עלולים לקבל בקשות שמטופלות ע"י הגרסה החדשה; שם מטמון חדש לכל גרסה (`static-v2`); ניקוי מטמונים ישנים ב־`activate`; Cache Storage משותף לכל ה־origin; לא לשנות את כתובת קובץ ה־SW **[מאומת]** — [web.dev: service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)

### Inferences
- **השלכה ישירה לפרויקט**: preview/staging של החזית **לא יכול** לשבת תחת `yishaiguedj1.github.io/…` — זה אותו origin של האפליקציה האמיתית, שחולק `localStorage` (כולל נתוני IBKR) ו־Cache Storage. `CLAUDE.md` כבר הגיע לאותה מסקנה בסעיף 15 [מהפרויקט]. דרכים: Cloudflare Pages (preview אוטומטי ב־`*.pages.dev`, origin נפרד לכל preview), או אתר Pages נוסף בריפו/ארגון אחר לסביבת staging.
- ה־"פרוטוקול הדו־שלבי" של הפרויקט (תוכן קודם, `sw.js` אחר כך) הוא פתרון לבעיה שנובעת מכך ש־GitHub Pages מעדכן קבצים לא בבת אחת וב־CDN עם מטמון. פלטפורמות עם פריסות אטומיות (immutable deployments — כל פריסה בכתובת משלה והדומיין מוחלף בבת אחת, כמו ב־Vercel/Cloudflare) מקטינות את הסיכון הזה — **מוסק, לא נבדק מול תיעוד של "אטומיות" בסשן הזה**.
- כיוון שגרסה ישנה של הלקוח חיה זמן מה, תאימות לאחור של ה־API ושל מבנה Firestore (סעיפים 1, 3) היא חובה ולא "nice to have".

### Gaps
- לא אומת בתיעוד ראשי שפריסת GitHub Pages אינה אטומית; זו התנהגות שהפרויקט עצמו תיעד (לקח "הרעלת מטמון") [מהפרויקט].
- לא נבדק אם GitHub Pages עם פריסה דרך Actions תומך ב־preview (יש "environments" ב־Actions, אך לא נמצא תיעוד לאתר preview נפרד).

## 6. מה מיותר לסולו (Kubernetes, מיקרו־שירותים) — ועקרון "הטכנולוגיה המשעממת"

### Takeaway
המקורות הקלאסיים ממליצים לסולו להתחיל במונולית וטכנולוגיות מוכרות, ולהוציא "אסימוני חדשנות" רק היכן שהם נותנים ערך עסקי. Kubernetes ומיקרו־שירותים פותרים בעיות של צוותים רבים ועומסים גדולים, ומוסיפים "פרמיה" תפעולית שאדם אחד משלם בזמן.

### Cited Findings
- Dan McKinley, "Choose Boring Technology" (30/3/2015): "Let's say every company gets about three innovation tokens" — כל טכנולוגיה חדשה/לא מוכחת "עולה" אסימון; "the general tendency is to overestimate the contents of your wallet" **[מאומת]** — [mcfunley.com](https://mcfunley.com/choose-boring-technology)
- Fowler, Monolith First — פרמיית המיקרו־שירותים "will slow down a team, favoring a monolith for simpler applications" **[מאומת]** — [martinfowler.com](https://martinfowler.com/bliki/MonolithFirst.html)
- Firebase Emulator — לא תחליף לשרת ייצור ("not appropriate to use in production") **[מאומת]** — [firebase docs](https://firebase.google.com/docs/emulator-suite)
- Feature flags — כל דגל הוא חוב; "treat toggles as inventory" **[מאומת]** — [martinfowler.com](https://martinfowler.com/articles/feature-toggles.html)

### Inferences
- **מיותר בשלב הזה** (מוסק): Kubernetes (שרת אחד ⇒ Compose מספיק), מיקרו־שירותים (גבולות לא ידועים; כל שירות = עוד פריסה/לוגים/סודות), Terraform לכל דבר, מערכת feature flags מסחרית, multi-region, service mesh.
- **שווה את המאמץ גם לסולו**: פרויקט Firebase נפרד ל־dev, preview לכל PR על origin נפרד, config בסביבה, Compose בריפו, תאימות לאחור, גיבוי ושחזור נבדק של Firestore, rollback בפקודה אחת.
- הבחירות הקיימות (Node, Firestore, Docker) הן "משעממות" במובן החיובי. ה"אסימונים" שכבר הוצאו בפרויקט: Routine של Claude כעובד, WebGL משלנו (`ribbon3d`/`pagecurl`), foliate-js "API לא יציב" [מהפרויקט] — כדאי לא להוסיף עוד בתשתית.

### Gaps
- לא נקראו דיוני HN ספציפיים; אין מהם ציטוטים.

## 7. (תוספת המתאם) כלי פריסה לשרת ה־Docker: איך כל גישה מממשת dev/preview/staging/prod, סודות לכל סביבה, ו־rollback

### Takeaway
שלוש גישות: (א) פאנל PaaS עצמי (Coolify / Dokploy / Komodo) — הכי "לחיצה אחת", עם preview לכל PR מובנה (Coolify, Dokploy) אבל מצב שחי בממשק ולא בריפו; (ב) Docker Compose + GitHub Actions + GitHub Environments — הכי שקוף ו־IaC, סודות והגנות לכל סביבה ב־GitHub (חינם לריפו ציבורי), preview צריך לבנות לבד; (ג) Kamal — destinations מפורשים (`-d staging`) עם קבצי סודות לכל סביבה ו־`kamal rollback` מובנה. לסולו + AI, הכי נקי מבחינת הפרדה ושחזור הוא (ב) או (ג) כי הכל טקסט בריפו שה־AI קורא וכותב.

### Cited Findings
- **Coolify — preview לכל PR**: כל PR רץ ב־preview נפרד מהייצור עם דומיין ומשתנים משלו; תבנית `{{pr_id}}.{{domain}}` (דורש DNS wildcard); משתני production ו־preview בקבוצות נפרדות, ו־"use non-production credentials" ל־preview; מחיקה אוטומטית כשה־PR נסגר/ממוזג. **אזהרת אבטחה**: קוד ה־preview "untrusted" — PR מריץ קוד על השרת; להשאיר "Repository members only" (חוסם PR מ־fork), "Public (fork PRs allowed)" רק אם מקבלים את הסיכון **[מאומת]** — [coolify.io/docs: preview deploy](https://coolify.io/docs/applications/ci-cd/github/preview-deploy)
- Coolify — היררכיה: שרת → Project → Environment (Production/Staging/Dev) → Resource; פרויקט חדש נוצר עם סביבת production והשאר מוסיפים; משתני סביבה לכל סביבה **[משני — מדריכי צד שלישי + עמוד concepts שלא נקרא במלואו]** — [coolify.io/docs/get-started/concepts](https://coolify.io/docs/get-started/concepts), [Vultr](https://docs.vultr.com/how-to-deploy-an-application-with-vultr-coolify-marketplace-app), [azdigi](https://azdigi.com/en/blog/self-hosted/coolify-interface-detailed-dashboard-usage-guide). Rollback ב־Coolify — לא נמצא עמוד רשמי (הכתובת שנוסתה החזירה 404).
- **Dokploy**: preview נוצר אוטומטית כש־PR נפתח מול ענף היעד, מתעדכן בכל קומיט, נמחק בסגירה/מיזוג; סינון לפי labels; דומיין `traefik.me` או wildcard משלכם; משתנה `${{DOKPLOY_DEPLOY_URL}}` **[מאומת]** — [docs.dokploy.com](https://docs.dokploy.com/docs/core/applications/preview-deployments). יש מדריך rollbacks נפרד שלא נקרא.
- **Komodo**: ממשק לניהול שרתים, builds, פריסות, Compose stacks (מהממשק, מהשרת או מ־git עם auto-deploy ב־push), Swarm, Procedures מתוזמנים, משתנים וסודות משותפים, יומן ביקורת לכל שינוי; רישיון GPL-3.0. העמוד לא מזכיר environments / preview / rollback **[מאומת]** — [komo.do/docs/intro](https://komo.do/docs/intro)
- **GitHub Environments**: סביבות בשם (למשל `staging`, `production`) עם סודות ומשתנים שזמינים רק ל־job שמשתמש בסביבה ורק אחרי שהכללים עברו; כללי הגנה: עד 6 מאשרים נדרשים (אפשר לחסום אישור עצמי), טיימר המתנה, הגבלת ענפים/תגיות שמותר לפרוס מהם. **ב־GitHub Free — רק לריפו ציבורי**; ריפו שהופך לפרטי — הכללים והסודות מתעלמים **[מאומת]** — [docs.github.com: manage environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
- **Compose — כמה סביבות על שרת אחד**: שם פרויקט שונה (`-p staging` / `-p prod`) מבודד את העותקים **[מאומת]** — [docs.docker.com](https://docs.docker.com/compose/how-tos/project-name/)
- **Kamal — destinations**: `kamal deploy -d staging` קורא `config/deploy.staging.yml` וממזג עם `config/deploy.yml`; סודות: קודם `<secrets_path>-common` ואז `<secrets_path>.<destination>` (ברירת מחדל `.kamal/secrets` ⇒ `.kamal/secrets.staging` — מוסק, לא כתוב במפורש) **[מאומת]** — [kamal-deploy.org: configuration](https://kamal-deploy.org/docs/configuration/overview/)
- **Kamal — rollback**: `kamal app containers -q` לרשימת גרסאות, `kamal rollback <version>` עוצר את הקונטיינר הנוכחי ומפעיל את התמונה הקודמת, "Nothing needs to be downloaded from the registry"; קונטיינרים ישנים נגזמים אחרי 3 ימים ב־`kamal deploy` **[מאומת]** — [kamal-deploy.org: rollback](https://kamal-deploy.org/docs/commands/rollback/)

### Inferences
- **השוואה (מוסקת מהממצאים)**:

| | (א) Coolify / Dokploy | (ב) Compose + Actions + GitHub Environments | (ג) Kamal |
|---|---|---|---|
| preview לכל PR | מובנה (wildcard DNS) | לבנות לבד (job שמריץ `compose -p pr-N` + תת־דומיין) | לא מובנה (destination לכל סביבה קבועה) |
| staging/prod | Environments בפרויקט (Coolify) | שני Compose projects + שני GitHub Environments | `-d staging` / `-d production` |
| סודות לכל סביבה | בממשק הפאנל | GitHub Environment secrets + הגבלת ענף + מאשר | `.kamal/secrets.<dest>` (מקומי/מנהל סודות, לא בריפו) |
| rollback | בממשק (Coolify: לא אומת רשמית) | `docker compose` עם תג תמונה קודם — ידני/סקריפט | `kamal rollback` מובנה |
| איפה ה"אמת" | במסד של הפאנל | בריפו | בריפו |
| סיכון | פאנל = עוד שירות לתחזק ולאבטח; preview מריץ קוד PR על השרת | עבודה ידנית ל־preview | פחות מתאים לכמה שירותים מורכבים |

- **המלצה מוסקת לסולו + AI**: (ב) — Compose בריפו + Actions עם GitHub Environments (`staging`, `production` עם "required reviewer" = המשתמש, שתואם לכלל "לא לפרוס בלי אישור" [מהפרויקט]), ותמונות עם תג לפי קומיט כדי ש־rollback = פריסה מחדש של התג הקודם. היתרון: הכל טקסט שה־AI רואה, אין מצב נסתר בפאנל, ו־GitHub Environments חינמי כי הריפו ציבורי. Kamal הוא חלופה טובה אם רוצים rollback מובנה בלי לכתוב אותו. פאנל (Coolify/Dokploy) מתאים אם המשתמש רוצה ממשק גרפי לנגיעה מהטלפון — במחיר מצב שלא בריפו.
- **אזהרה ספציפית לפרויקט**: הריפו ציבורי — preview אוטומטי לכל PR על השרת (Coolify/Dokploy/Actions) חייב להיות מוגבל ל־PR של בעל הריפו בלבד, ובלי סודות ייצור, אחרת כל אחד יכול להריץ קוד על השרת דרך PR מ־fork (בהתאם לאזהרה של Coolify).
- staging ו־production על אותו שרת = הפרדה ברמת קונטיינרים/רשתות/דומיינים, לא ברמת חומרה; עומס או פריצה ב־staging משפיעים על ייצור. לסולו זה מקובל אם ה־staging משתמש בפרויקט Firebase ובמפתחות נפרדים.

### Gaps
- לא נמצא תיעוד רשמי ל־rollback של Coolify ושל Dokploy (קיים עמוד ב־Dokploy שלא נקרא; העמוד שנוסה ב־Coolify החזיר 404).
- לא אומת במקור ראשי אם ל־Komodo יש מנגנון environments/preview.
- לא נבדקו מקורות ראשיים על עלות משאבים (RAM) של הפאנלים עצמם על שרת קטן.
