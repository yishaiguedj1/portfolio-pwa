# ניהול גרסאות, שחרורים, CI/CD ובדיקות — מה עושים המקצוענים (2025–2026), מותאם למייסד יחיד שהקוד שלו נכתב על ידי AI

> נכון ל־08/10/2026. מקרא: **[מאומת]** = נקרא ישירות במקור הראשי (תיעוד רשמי / האתר של התקן / DORA). **[משני]** = דרך סיכום או כתבה של צד שלישי, או שלא הצלחתי לפתוח את המקור המלא. "הסקה" = מסקנה שלי, לא עובדה מצוטטת.
>
> הקשר הפרויקט (מהבריף): PWA ב־GitHub Pages + שרתון ב־Vercel + Firebase + שרת Docker חדש + אפליקציית אנדרואיד (APK נבנה ב־Actions). ריפו ציבורי אחד, ה־AI עובד בענפי פיצ'ר ופותח PR, הבעלים ממזג מהטלפון; CI מריץ בדיקות Node בכל push; גרסה = מונה vNNN שמועלה ידנית ב־`app.js` ובשם המטמון של ה־Service Worker, ונפרס בשני PR נפרדים כדי למנוע "הרעלת מטמון"; אין סביבת ביניים (staging); אין חזרה אוטומטית לגרסה קודמת (rollback); יומן השינויים = קובץ עברי.

## 1. אסטרטגיית ענפים (Branching): Trunk-based מול GitFlow מול GitHub Flow, סקירת קוד, הגנה על main

### Takeaway
המחקר של DORA קושר ביצועים גבוהים לפיתוח מבוסס־גזע (trunk-based development): ענפים קצרים מאוד (שעות עד יומיים), מיזוג ל־main לפחות פעם ביום, לכל היותר שלושה ענפים פעילים, ובלי "הקפאות קוד". הזרימה הקיימת בפרויקט (ענף קצר של ה־AI → PR → מיזוג ל־main) היא כבר בפועל GitHub Flow / ענפי פיצ'ר קצרים — הכיוון הנכון; מה שחסר הוא אכיפה אוטומטית ב־GitHub (כללי ענף — rulesets) במקום הסתמכות על משמעת.

### Cited Findings
- **[מאומת]** DORA מגדירה trunk-based development כעבודה בקבוצות קטנות (small batches) ומיזוג ל־trunk "לפחות פעם ביום (ואולי כמה פעמים ביום)"; ענפים בשיטה זו חיים בדרך כלל "לא יותר מכמה שעות", לעומת ענפי פיצ'ר שיכולים להימשך ימים או שבועות — [DORA: Trunk-based development](https://dora.dev/capabilities/trunk-based-development/)
- **[מאומת]** לפי נתוני DORA (2016–2017), צוותים שעמדו בשלושה כללים הגיעו למהירות, יציבות וזמינות גבוהות יותר: "שלושה ענפים פעילים או פחות", "מיזוג ל־trunk לפחות פעם ביום", "בלי הקפאות קוד ובלי שלבי אינטגרציה" — [DORA](https://dora.dev/capabilities/trunk-based-development/)
- **[מאומת]** DORA: trunk-based הוא תנאי לאינטגרציה רציפה (CI); שומרים את הבנייה "ירוקה" — אם כשל לא מתוקן תוך דקות, מחזירים (revert) את השינוי; הבנייה והבדיקות צריכות להסתיים תוך דקות — [DORA](https://dora.dev/capabilities/trunk-based-development/)
- **[מאומת]** trunkbaseddevelopment.com: ענף פיצ'ר קצר "צריך להחזיק רק כמה ימים" (בערך יומיים); ארוך מזה הופך ל"ענף ארוך־חיים — ההפך של trunk-based"; הענף חוזר כ־pull request, מתעדכן מ־main לפני המיזוג, ונמחק אחרי המיזוג; מפתח אחד (או זוג) לכל ענף — [Short-lived feature branches](https://trunkbaseddevelopment.com/short-lived-feature-branches/)
- **[מאומת]** כללי ענף ב־GitHub (rulesets) כוללים, בין היתר: חסימת מחיקה וחסימת force push (פעילים כברירת מחדל), "חובת PR לפני מיזוג", מספר אישורים נדרש, **"חובת בדיקות סטטוס עוברות" (required status checks)** — במצב strict הענף חייב להיות מעודכן מול main, "חובת פריסה מוצלחת לסביבה לפני מיזוג", היסטוריה לינארית (squash/rebase בלבד), קומיטים חתומים, חסימה לפי תוצאות סריקת קוד (code scanning), חסימה לפי כיסוי קוד (תצוגה מקדימה), והגבלת נתיבי קבצים/סיומות/גודל. אפשר לתת "עקיפה" (bypass) לתפקידים, צוותים או GitHub Apps — [GitHub Docs: Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- **[מאומת]** "סוקרים לפי צוות לנתיבי קבצים" (Required reviewers teams) אינו זמין בריפו בבעלות משתמש פרטי (רק בארגון) — [GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- **[מאומת]** יש גם כלל שמסמן PR של Copilot שאינו משויך לאדם כמחייב אישור נוסף כברירת מחדל (תצוגה מקדימה) — [GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- **[משני — דרך תוצאות חיפוש מ־docs.github.com]** סקירת קוד אוטומטית של Copilot: אפשר להגדיר בכלל ענף "Automatically request Copilot code review", עם אפשרויות לסקור כל push חדש ו/או טיוטות. הסקירה של Copilot היא "Comment" ולא "Approve", ולכן **לא נספרת כאישור הנדרש**; כל סקירה צורכת "בקשת פרימיום" מהמכסה של פותח ה־PR — [GitHub Docs: Configuring automatic code review by Copilot](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-automatic-review)

### Inferences
- למייסד יחיד, GitFlow (ענפי develop/release/hotfix ארוכים) הוא עודף טקס — סותר את ממצאי DORA על ענפים קצרים ובלי הקפאות. ההמלצה: GitHub Flow = ענף קצר אחד לכל משימה של ה־AI, PR, מיזוג ב־squash, מחיקת הענף.
- ה"סוקר" האנושי היחיד הוא הבעלים מהטלפון, ולכן הסקירה האמיתית צריכה להיות **בדיקות אוטומטיות חובה** + אולי סוקר AI שני (Copilot / Claude אחר בהקשר נקי) כהערות. סוקר AI לא מחליף שער חובה, כי (לפי התיעוד) הוא אפילו לא נספר כאישור.
- CODEOWNERS (קובץ שמגדיר מי חייב לאשר שינוי בנתיבים מסוימים) פחות רלוונטי לאדם אחד — אבל אפשר להשתמש ברעיון: לסמן נתיבים רגישים (`sw.js`, `ibkr-proxy/`, `.github/workflows/`, `android/`) כנתיבים שה־AI לא נוגע בהם בלי אישור מפורש, דרך כלל "הגבלת נתיבי קבצים" או בדיקת CI שנכשלת.

### Gaps
- לא אימתתי ישירות בתיעוד של GitHub שכל כללי ה־rulesets זמינים בחינם לריפו ציבורי של משתמש (התיעוד שנקרא לא מציין זמינות לפי תוכנית). מהידע הכללי — rulesets זמינים לריפו ציבורי ב־Free, אך זה לא אומת כאן.
- לא מצאתי מחקר DORA ספציפי על סקירת קוד ע"י AI.

## 2. ניהול גרסאות: SemVer, CalVer, Conventional Commits, יומן שינויים אוטומטי, תגיות ו־Releases — ואיך מגרסים PWA + SW + API + אנדרואיד ביחד

### Takeaway
SemVer נועד לספריות עם "ממשק ציבורי" שאחרים תלויים בו; לאפליקציה למשתמש קצה יש חלופות טובות (מונה פשוט או CalVer). הכלים המקובלים לאוטומציה הם Conventional Commits (פורמט הודעת קומיט) + release-please (PR שחרור שמעלה גרסה, כותב CHANGELOG, יוצר תגית ו־GitHub Release). לאנדרואיד יש חוק ברזל משלו: `versionCode` חייב לעלות תמיד.

### Cited Findings
- **[מאומת]** SemVer 2.0.0: MAJOR = שינוי לא תואם ב־API, MINOR = יכולת חדשה תואמת לאחור, PATCH = תיקון באג תואם לאחור. "תוכנה שמשתמשת ב־SemVer חייבת להצהיר על API ציבורי". גרסה 0.y.z = פיתוח ראשוני, "הכל עשוי להשתנות בכל רגע". תוויות טרום־שחרור (`-beta`) ומטא־דאטה של בנייה (`+sha`) — [semver.org](https://semver.org/)
- **[מאומת]** CalVer = גרסה לפי לוח השנה (למשל Ubuntu `YY.0M`, ‏Home Assistant `YYYY.M.MICRO`, pip, JetBrains, Stripe API; Apple עברה למספור לפי שנה ב־2025). מתאים לפרויקטים עם היקף משתנה, תלויי זמן, או **לקהל לא טכני שלא צריך לשפוט אם שינוי "שובר"**. CalVer "בכוונה לא מנסה לתקשר שינויים שוברים", ולכן ממליצים לצרף יומן שינויים — [calver.org](https://calver.org/)
- **[מאומת]** Conventional Commits 1.0.0: מבנה `<type>[scope]: <description>` + גוף + כותרות תחתונות; `fix` → PATCH, `feat` → MINOR, `!` או `BREAKING CHANGE:` → MAJOR; `docs`/`chore` בלי השפעה. יתרונות: יומן שינויים אוטומטי, קביעת הגרסה הבאה אוטומטית, הפעלת תהליכי בנייה/פרסום — [conventionalcommits.org](https://www.conventionalcommits.org/en/v1.0.0/)
- **[מאומת]** release-please (של Google): קורא את היסטוריית הקומיטים לפי Conventional Commits ומתחזק "PR שחרור" שמתעדכן כל הזמן; מיזוג ה־PR מעדכן CHANGELOG וקבצי גרסה, מתייג את הקומיט ויוצר GitHub Release. סוגי פרויקט כוללים `node` ו־`simple` (קובץ `version.txt` + `CHANGELOG.md`); תומך בכמה רכיבים מאותו ריפו (manifest); `Release-As: x.y.z` מכריח גרסה. "לא מטפל בפרסום למנהלי חבילות" — [release-please](https://github.com/googleapis/release-please)
- **[מאומת]** אנדרואיד: `versionCode` = מספר שלם חיובי פנימי, "המערכת משתמשת בו כדי להגן מפני שנמוך (downgrade)" — אי אפשר להתקין APK עם `versionCode` נמוך מהמותקן; יש להעלות אותו בכל שחרור; מקסימום ב־Play ‏2,100,000,000. `versionName` = מחרוזת חופשית שמוצגת למשתמש — [Android Developers: Version your app](https://developer.android.com/studio/publish/versioning)
- **[מאומת]** תגיות (tags) אפשר להגן עליהן באותם כללי rulesets (הגבלת יצירה/עדכון/מחיקה) — [GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- **[משני]** במתקפת שרשרת האספקה על Trivy (מרץ 2026) רק תגית אחת שהייתה מוגנת ב־"immutable releases" של GitHub לא שוכתבה — [Aqua (דרך סיכום חיפוש)](https://www.aquasec.com/blog/trivy-supply-chain-attack-what-you-need-to-know)

### Inferences
- לפרויקט הזה (אפליקציה אישית, אין צרכני API חיצוניים) **המונה vNNN הוא בחירה לגיטימית** — הוא בעצם "מספר בנייה" מונוטוני, בדיוק כמו `versionCode` של אנדרואיד. אין צורך לעבור ל־SemVer. אם רוצים משהו קריא לבני אדם: CalVer (למשל `2026.10.3`) ב־`versionName`/בממשק, והמונה כמספר הפנימי.
- הבעיה האמיתית אינה הפורמט אלא **הכתיבה הידנית בשני מקומות** (`APP_VERSION` ו־`CACHE_NAME`). מקובל שגרסה נכתבת **במקום אחד** (למשל `version.txt`) ומוזרקת בבנייה לכל השאר (app.js, sw.js, `versionCode` של אנדרואיד, תשובת health של השרתון). release-please במצב `simple` עושה בדיוק את זה, אבל דורש Conventional Commits — ה־AI יכול לכתוב הודעות כאלה בקלות (גם בעברית בתיאור, עם type באנגלית).
- גרסה אחת משותפת לכל הרכיבים (PWA + SW + שרתון + APK) פשוטה יותר לאדם אחד מגרסה נפרדת לכל רכיב; release-please manifest מאפשר נפרד אם יידרש בעתיד.
- יומן העבודה העברי יכול להישאר (הוא תיעוד החלטות ולקחים, לא רק רשימת שינויים); ה־CHANGELOG האוטומטי + GitHub Release (עם תגית `v359` וכו') נותן "נקודת שחזור" מסומנת לכל גרסה — הבסיס ל־rollback.

### Gaps
- לא בדקתי את changesets (כלי חלופי, נפוץ במונוריפו של JS); לפי הידע הכללי הוא מבוסס קבצי "changeset" שהמפתח כותב, לא הודעות קומיט — לא אומת כאן.
- לא אימתתי את פרטי "extra-files" של release-please (עדכון גרסה בקובץ שרירותי כמו sw.js) — מתועד בדף customizing שלא נקרא.

## 3. שלבי צינור CI/CD: בדיקות סטטיות, יחידה, אינטגרציה, קצה־לקצה, סריקות אבטחה, "בונים פעם אחת ומקדמים", staging, בדיקות עשן, שער אישור

### Takeaway
הצינור המקובל: בדיקה סטטית (lint/typecheck) → בדיקות יחידה ואינטגרציה → בנייה **פעם אחת** של תוצר (artifact) → פריסה לסביבת ביניים → בדיקות עשן (smoke) → אישור ידני (שער) → קידום **אותו תוצר בדיוק** לייצור. לריפו ציבורי ב־GitHub כמעט כל כלי האבטחה והשערים חינמיים — כולל Environments עם סוקר נדרש.

### Cited Findings
- **[מאומת]** "גביע הבדיקות" (Testing Trophy) של Kent C. Dodds: מלמטה — סטטי (type checking + lint), יחידה, אינטגרציה (השכבה הרחבה), קצה־לקצה. מבוסס על העצה "Write tests. Not too many. Mostly integration." והעיקרון: "ככל שהבדיקות דומות יותר לאופן שבו משתמשים בתוכנה, כך הן נותנות יותר ביטחון". זהו מודל של **החזר על השקעה** (ביטחון מול זמן) — [Kent C. Dodds](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- **[מאומת]** באותו מאמר: הפירמידה של Fowler (הרבה בדיקות יחידה, מעט E2E) "יצאה מהאופנה" לטענת swyx; Justin Searls מכנה את הוויכוח על התמהיל "הסחת דעת" — [Kent C. Dodds](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications)
- **[משני]** "בונים את הבינארי רק פעם אחת" — כלל יסוד ב־*Continuous Delivery* של Humble ו־Farley: בנייה מחדש בכל שלב יכולה להכניס הבדלים שקטים (מהדר אחר, גרסת ספרייה אחרת), ולכן התוצר נשמר במאגר ושלבים מאוחרים רק קוראים אותו; כך מה שנבדק = מה שנשלח — [DZone: Build binaries only once](https://dzone.com/articles/build-binaries-only-once-for-continuous-deployment); [Farley 2007, The Deployment Pipeline](https://continuousdelivery.com/wp-content/uploads/2010/01/The-Deployment-Pipeline-by-Dave-Farley-2007.pdf)
- **[מאומת]** GitHub Environments: "סוקרים נדרשים" (required reviewers) — עד 6 אנשים/צוותים, אחד מספיק; אפשר לחסום אישור עצמי; טיימר המתנה 1–43,200 דקות; הגבלת ענפים/תגיות שמותר להם לפרוס לסביבה; סודות סביבה זמינים רק לג'ובים שמפנים לסביבה. **ב־Free: סוקרים נדרשים, טיימר וכללי הגנה מותאמים — רק לריפו ציבורי**; הגבלת ענפים ותגיות — לכל ריפו ציבורי — [GitHub Docs: Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- **[מאומת]** GitHub Pages אפשר לפרוס דרך workflow מותאם: ג'וב בנייה עם `upload-pages-artifact` (קובץ tar דחוס, עד 10GB), ג'וב פריסה עם `deploy-pages`, הרשאות `pages: write` + `id-token: write`, וסביבה `github-pages` — "סביבה חייבת להיות מוגדרת כדי לאכוף כללי הגנה על ענפים/פריסה" — [GitHub Docs: Custom workflows with Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
- **[מאומת]** כלי אבטחה זמינים לכל התוכניות: Dependabot alerts, Dependabot security updates, Dependabot version updates. **לריפו ציבורי כברירת מחדל**: סריקת קוד (CodeQL), סריקת סודות (secret scanning), **חסימת push עם סוד (push protection)**, dependency review, Copilot Autofix — [GitHub Docs: Security features](https://docs.github.com/en/code-security/getting-started/github-security-features)
- **[מאומת]** Trivy (סורק קונטיינרים): סורק image, מערכת קבצים, ריפו, IaC; ברירת המחדל סורקת חולשות + סודות; ברירת המחדל לא מכשילה את הבנייה (`exit-code: 0`) — צריך `exit-code: '1'` + `severity: 'CRITICAL,HIGH'`; תוצאות SARIF מועלות ל־code scanning של GitHub — [trivy-action](https://github.com/aquasecurity/trivy-action)
- **[משני]** ב־19/03/2026 תוקפים שכתבו 76 מתוך 77 תגיות הגרסה של `aquasecurity/trivy-action` (ו־7 של `setup-trivy`) לקוד זדוני שגנב סודות CI לפני שהריץ את הסריקה האמיתית (CVE-2026-33634); מי שהריץ בין 19–22/03 נדרש להניח שהסודות דלפו. מקורות שונים נותנים ספירה מעט שונה (Snyk: 75 מתוך 76) — [Wiz](https://www.wiz.io/es-es/blog/trivy-compromised-teampcp-supply-chain-attack); [SafeDep](https://safedep.io/trivy-teampcp-supply-chain-compromise/); [Snyk](https://snyk.io/es/articles/trivy-github-actions-supply-chain-compromise/)
- **[מאומת]** כללי ענף יכולים לחייב "פריסה מוצלחת לסביבה" ו"תוצאות סריקת קוד" לפני מיזוג — [GitHub Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

### Inferences
- **הפרויקט כבר עושה דבר אחד מצוין**: Actions מקובעים ל־SHA (לפי CLAUDE.md) — זה בדיוק מה שהיה מגן ממתקפת Trivy (שכתוב תגיות). לשמור על זה, ולתת ל־Dependabot לעדכן את ה־SHA־ים.
- הבעיה המרכזית בצינור היום (לפי CLAUDE.md, סעיף 15): **GitHub Pages מתפרס גם כשהבדיקות אדומות**, כי הוא מתפרס ישירות מהענף. מעבר לפריסת Pages דרך workflow (`needs: tests` → build → deploy לסביבה `github-pages`) הופך את הבדיקות לשער אמיתי, מאפשר לפרסם **רק קבצי האפליקציה** (לא CLAUDE.md/יומן/בדיקות), ומאפשר לשים סוקר נדרש על הסביבה (הריפו ציבורי → חינם).
- "בנייה פעם אחת" כאן = ה־tar של Pages, ה־APK החתום, ו־image של Docker — כל אחד נבנה פעם אחת ב־CI ומקודם; לא בונים מחדש לייצור.
- תמהיל בדיקות מומלץ ליחיד עם AI: (1) סטטי — ESLint + `node --check` (ואולי בדיקת טיפוסים קלה דרך JSDoc/`tsc --checkJs`), (2) הרבה בדיקות אינטגרציה (כבר קיימות — ה־vm עם app.js), (3) מעט E2E ב־Playwright על התרחישים הקריטיים (פתיחה, מחיר חי, ניווט "חזור") — כבר יש כלי כזה (`tools/qa-motion.js`) אבל הוא לא שער ב־CI.

### Gaps
- לא נמצא מקור ראשי שמכמת יחס "נכון" בין סוגי בדיקות; המקורות עצמם אומרים שהיחס פחות חשוב מהביטחון.
- לא אימתתי ש־CodeQL תומך ב־JavaScript בלי שלב בנייה (מהידע הכללי — כן), וגם לא את מגבלות הזמן של Actions לריפו ציבורי.

## 4. טכניקות שחרור בטוח: preview, canary, blue-green, feature flags, rollback אוטומטי, סדר מיגרציות, ועדכון Service Worker

### Takeaway
הכלים: סביבות תצוגה מקדימה לכל PR, דגלי פיצ'ר (feature flags) כדי למזג קוד לא גמור בלי להפעיל אותו, rollback מיידי לגרסה הקודמת, ושינויים לא־תואמים בשיטת "הרחבה־העברה־כיווץ" (expand/contract). ל־PWA עם Service Worker הפתרון המקצועי לבעיית "הרעלת המטמון" הוא **מטמון מגורסן לפי תוכן (hash) שנוצר בבנייה** — לא מספר גרסה ידני.

### Cited Findings
- **[מאומת]** מחזור חיי Service Worker: הדפדפן בודק עדכון אחרי ניווט לדף בתחום (ואחרי אירועי push/sync, אלא אם נבדק ב־24 השעות האחרונות); עובד נחשב "מעודכן" אם הוא "שונה בבייט אחד" ממה שיש לדפדפן; Chrome 68+ מתעלם מכותרות HTTP cache בבדיקת הסקריפט. העובד החדש מותקן לצד הישן; אם ההתקנה נכשלת — נזרק והישן ממשיך. אחרי התקנה הוא **ממתין** עד שהישן לא שולט באף לשונית (רענון לא משחרר) — [web.dev: Service worker lifecycle](https://web.dev/articles/service-worker-lifecycle)
- **[מאומת]** אותו מקור: `skipWaiting()` גורם לעובד החדש לשלוט בדפים שנטענו בגרסה הישנה — "בקשות מדף אחד עלולות להיות מטופלות ע"י שני עובדים"; להשתמש רק כשגרסאות מעורבות בטוחות (למשל אחרי פעולת משתמש). המלצות: לא לשנות את כתובת הסקריפט, שמות מטמון עם קידומת וגרסה, מחיקת מטמונים ישנים ב־`activate`, `reg.update()` מחזורי, והצגת מצב עדכון למשתמש — [web.dev](https://web.dev/articles/service-worker-lifecycle)
- **[מאומת]** Workbox precaching: כל כתובת ברשימת המטמון מקבלת `revision`; קבצים עם hash בשם — revision ‏`null` ("המידע על הגרסה נמצא בכתובת עצמה"); קבצים בלי hash מקבלים hash של התוכן שנוצר **בזמן הבנייה**. אזהרה מפורשת: "לעולם אל תקודדו מידע גרסה ידנית ברשימה שנכתבה ביד". נכסים חדשים נכנסים למטמון ב־`install` של העובד החדש, הוא לא משרת בקשות עד `activate`, ואז מוחקים את מה שכבר לא ברשימה — [Chrome Developers: workbox-precaching](https://developer.chrome.com/docs/workbox/modules/workbox-precaching)
- **[מאומת]** Feature toggles (Martin Fowler / Pete Hodgson): ארבעה סוגים — Release (קוד לא גמור; "לא אמור להישאר יותר משבוע־שבועיים"), Experiment (A/B), Ops (כולל "מתג השבתה" — kill switch, לשינוי בלי שחרור חדש), Permission (לקבוצת משתמשים, יכול להישאר שנים). דגלים הם "מלאי עם עלות החזקה" — להוסיף משימת הסרה, תאריך תפוגה ("פצצת זמן" שמכשילה בדיקות), ותקרה על מספר הדגלים. Release toggles הם מה שמאפשר trunk-based. Canary = הפעלה ל"אחוז קטן מהמשתמשים" — [martinfowler.com: Feature Toggles](https://martinfowler.com/articles/feature-toggles.html)
- **[מאומת]** Parallel change (expand/contract): הרחבה (מוסיפים גרסה חדשה לצד הישנה) → העברה (לקוחות עוברים בהדרגה — "הכי ארוך כשיש לקוחות חיצוניים") → כיווץ (מוחקים את הישנה). מתאים לסכמת מסד נתונים ול־API מרוחק; "אם לא מבצעים את הכיווץ אפשר לגמור במצב גרוע מההתחלה" — [martinfowler.com: ParallelChange](https://martinfowler.com/bliki/ParallelChange.html)
- **[מאומת]** Vercel Instant Rollback: מחזיר מיד את הדומיינים לפריסה קודמת. **ב־Hobby — רק לפריסה הקודמת מיד**; ב־Pro/Enterprise — לכל פריסה שהייתה בייצור. אחרי rollback Vercel **מכבה שיוך אוטומטי של דומיין הייצור** (push חדש לא עולה לבד) עד "Undo Rollback" / `vercel promote`. משתני סביבה לא מתגלגלים אחורה; cron חוזר למצב הפריסה הישנה — [Vercel Docs: Instant Rollback](https://vercel.com/docs/instant-rollback)
- **[מאומת]** DORA 2025 (מודל יכולות AI): "שימוש תכוף ביכולות rollback משפר את הביצועים של צוותים שעובדים עם AI"; מערכת ניהול הגרסאות היא "רשת ביטחון קריטית" — [Google Cloud: DORA AI Capabilities Model](https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model)

### Inferences
- **הפתרון לפרוטוקול שני ה־PR**: מקור "הרעלת המטמון" הוא שה־SW החדש מוריד את app.js מה־CDN בזמן שה־CDN עוד מגיש את הישן, ושומר אותו תחת שם המטמון החדש. הדרך המקצועית: (א) **שם המטמון/רשימת המטמון נוצרים בבנייה מ־hash של התוכן** (כמו Workbox — "לא לכתוב גרסה ביד"), (ב) כתובות הנכסים כוללות את ה־hash (`app.js?v=<hash>` או שם קובץ עם hash) — כך SW חדש לא יכול לקבל עותק ישן תחת המפתח החדש, ו־(ג) פריסה דרך Actions כתוצר אחד. זה מבטל את הצורך בשני PR ואת הטעות האנושית של שכחת העלאת `CACHE_NAME`. (הסקה — לא מצאתי מקור שמתאר בדיוק את תרחיש ה־CDN של Pages.)
- "Blue-green" ו־"canary" במובן התשתיתי לא רלוונטיים ל־Pages (אין שני שרתים). ל־PWA ה"קנרי" הטבעי הוא **דגל פיצ'ר** (למשל הפעלה רק לחשבון של הבעלים) — וזה כבר קרוב למה שהפרויקט עושה עם `IBKR_SYNC_USERS`/`STUDIO_USERS`.
- סביבת תצוגה מקדימה: לשרתון Vercel כבר יש Preview Deployments לכל ענף (תכונה מוכרת של Vercel — לא אומתה כאן); ל־PWA אפשר לפרוס כל PR לנתיב/דומיין נפרד — אבל זהירות: לפי CLAUDE.md, כל מה שתחת `yishaiguedj1.github.io` חולק `localStorage` עם האפליקציה (כולל token של IBKR), ולכן preview חייב להיות על origin אחר (Cloudflare Pages / Vercel).
- Rollback לאתר סטטי = פריסה מחדש של התוצר מהתגית הקודמת (workflow_dispatch עם קלט tag). ל־SW חשוב שה"חזרה" תהיה **גרסה חדשה** (bump) עם התוכן הישן — אחרת לקוחות שכבר עודכנו לא יחזרו (העובד "החדש" צריך להיות שונה בבייט).
- Firestore בלי סכמה, אבל אותו עיקרון expand/contract חל על שדות במסמך `users/{uid}`: גרסה חדשה של האפליקציה צריכה לקרוא גם את המבנה הישן (לקוחות עם SW ישן ממשיכים לכתוב בפורמט הישן ימים).

### Gaps
- לא אימתתי אם פריסת GitHub Pages דרך `deploy-pages` היא אטומית (כל הקבצים מתחלפים יחד) ומה התנהגות ה־CDN שלה מול `max-age=600`.
- לא נמצא מקור ראשי על rollback אוטומטי (לפי ניטור) לאתרים סטטיים; זה בדרך כלל דורש ניטור שגיאות בצד הלקוח (למשל Sentry) — לא נחקר.

## 5. מדדי DORA: ארבעה (חמישה) מדדים, איך נראה "עילית", ומה פרויקט של אדם אחד צריך למדוד

### Takeaway
DORA מודדת היום חמישה מדדים בשתי קבוצות — תפוקה (זמן מהקומיט לייצור, תדירות פריסה, זמן התאוששות מפריסה כושלת) וחוסר יציבות (שיעור כשלי שינוי, שיעור פריסות תיקון לא מתוכננות). ב־2024 "עילית" = פריסה לפי דרישה, פחות מיום מקומיט לייצור, ~5% כשלים, התאוששות בפחות משעה. ב־2025 DORA זנחה את ארבע הדרגות לטובת שבעה "ארכיטיפים" של צוותים, וקבעה ש־AI הוא "מגבר": משפר צוותים עם יסודות טובים ומחמיר בעיות אצל אחרים.

### Cited Findings
- **[מאומת]** חמשת המדדים (הגדרות DORA): **Change lead time** — הזמן מקומיט לניהול גרסאות ועד פריסה בייצור; **Deployment frequency** — מספר פריסות בתקופה; **Failed deployment recovery time** — הזמן להתאושש מפריסה שנכשלה ודרשה התערבות מיידית; **Change fail rate** — שיעור הפריסות שדרשו התערבות מיידית; **Deployment rework rate** — שיעור הפריסות הלא מתוכננות שנובעות מתקלה בייצור — [dora.dev: DORA metrics](https://dora.dev/guides/dora-metrics/)
- **[מאומת]** הנחיות מדידה של DORA: למדוד לכל אפליקציה בנפרד; **לא להפוך מדדים ליעדים** (מזמין "משחקים"); להשתמש בכמה מדדים שמושכים זה נגד זה; לא להשקיע מוקדם באינטגרציות — להתחיל בשיחה / DORA Quick Check ולחזור אליו לאורך זמן — [dora.dev](https://dora.dev/guides/dora-metrics/)
- **[משני]** אשכולות DORA 2024: עילית — lead time פחות מיום, פריסה לפי דרישה, 5% כשלים, התאוששות פחות משעה; גבוה — יום עד שבוע, יומי עד שבועי, 20%, פחות מיום; בינוני — שבוע עד חודש, שבועי עד חודשי, 10%, פחות מיום; נמוך — חודש עד חצי שנה, חודשי עד פעמיים בשנה, 40%, שבוע עד חודש. ב־2024 לראשונה לאשכול הבינוני היה שיעור כשלים נמוך מהגבוה. עילית = פחות מ־20% מהארגונים — [Octopus Deploy](https://octopus.com/blog/2024-devops-performance-clusters); [RDEL](https://rdel.substack.com/p/rdel-68-what-are-the-latest-benchmarks)
- **[משני]** תוכנית המחקר של 2025 זנחה את סיווג ארבע הדרגות — [סיכום חיפוש על בסיס RDEL/Octopus](https://rdel.substack.com/p/rdel-68-what-are-the-latest-benchmarks)
- **[מאומת]** דוח DORA 2025 ("State of AI-assisted Software Development", כמעט 5,000 משיבים): אימוץ AI 90% (עלייה של 14%), חציון של כשעתיים ביום עם AI; 65% מסתמכים עליו במידה ניכרת; מעל 80% מדווחים על שיפור פרודוקטיביות, 59% על השפעה חיובית על איכות הקוד; רק 24% סומכים על AI "הרבה" או "מאוד"; אימוץ AI קשור עכשיו לתפוקה גבוהה יותר (היפוך מ־2024); AI הוא "מראה ומכפיל"; שבעה ארכיטיפים של צוותים — [Google blog: DORA 2025](https://blog.google/technology/developers/dora-report-2025/)
- **[מאומת]** שבע היכולות שמגבירות את התועלת מ־AI (DORA AI Capabilities Model): עמדה ברורה לגבי AI, מערך נתונים בריא, נתונים פנימיים נגישים ל־AI, **פרקטיקות ניהול גרסאות חזקות** (קומיטים תכופים + שימוש תכוף ב־rollback), **עבודה בקבוצות קטנות** ("חזק במיוחד בסביבה עם AI"), מיקוד במשתמש (בלעדיו AI עלול להזיק — "לנוע מהר בכיוון הלא נכון"), ופלטפורמות פנימיות איכותיות — [Google Cloud: DORA AI Capabilities Model](https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model)
- **[משני]** פרשנויות לדוח 2025: רק שני הארכיטיפים העליונים ("Pragmatic performers", "Harmonious high-achievers") מעלים תפוקה בלי עלייה בשיעור הכשלים; Splunk מעריך שהם 40% מהתעשייה — מספר שמתנגש עם ניסוח "מיעוט קטן" אצל פרשנים אחרים; יש גם הסתייגות מתודולוגית לגבי מדגם שבחר את עצמו — [Rob Bowley](https://blog.robbowley.net/2025/10/01/dora-2025-ai-assisted-dev-report-some-benefit-most-dont/); [Splunk](https://www.splunk.com/en_us/blog/learn/state-of-devops.html); [InfoQ](https://www.infoq.com/news/2025/09/dora-state-of-ai-in-dev-2025)

### Inferences
- לפי הערכה גסה מהבריף, הפרויקט כבר "עילית" בתפוקה (מאות גרסאות, פריסות כמעט יומיות, lead time של שעות). מה שלא נמדד הוא **חוסר היציבות**: כמה גרסאות היו "תיקון לתקלה שהגרסה הקודמת יצרה" (= Deployment rework rate) וכמה זמן לקח לחזור. היומן העברי מכיל את המידע הזה, אבל לא בצורה ספירה.
- מה כדאי ליחיד למדוד (פשוט, בלי כלים): (1) שיעור גרסאות־תיקון — אפשר לסמן ב־Conventional Commits (`fix:` שמתקן את הגרסה הקודמת, או תווית `hotfix` על ה־PR); (2) זמן התאוששות — מהדיווח בטלפון עד גרסה מתקנת חיה; (3) כמה פעמים CI אדום הגיע ל־main (אמור להיות 0 אחרי שער חובה). לא להפוך אותם ליעד — לפי DORA.

### Gaps
- לא הצלחתי לפתוח את הדוחות המלאים של DORA 2024/2025 (PDF); טבלת האשכולות של 2024 היא ממקור משני.
- לא נמצאו מדדים ייעודיים לפרויקט של אדם אחד במחקר DORA (המחקר מתמקד בצוותים/ארגונים).

## 6. מה צריך לאכוף אוטומטית בזרימה של מייסד יחיד + AI, כדי שה־AI לא יוכל לשבור את הייצור

### Takeaway
העיקרון: **ה־AI כותב ופותח PR; רק מכונה (CI) ורק הבעלים מחליטים מה עולה לייצור**. אוכפים זאת בשכבות GitHub שה־AI לא יכול לעקוף: main מוגן (בלי push ישיר, בלי force push, PR חובה, בדיקות חובה), פריסה רק מ־workflow שרץ אחרי בדיקות ירוקות, סביבת ייצור עם אישור ידני של הבעלים, סודות הייצור רק בסביבה, ו־rollback בלחיצה.

### Cited Findings
- **[מאומת]** כללים זמינים: חסימת force push ומחיקה, PR חובה, בדיקות סטטוס חובה (strict — מעודכן מול main), "פריסה מוצלחת לסביבה לפני מיזוג", חסימה לפי סריקת קוד/סודות/כיסוי, הגבלת נתיבי קבצים, ורשימת עקיפה (bypass) שאפשר להשאיר ריקה — [GitHub Docs: rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)
- **[מאומת]** סביבות GitHub: סוקר נדרש (אפשר לחסום מאשר עצמי), הגבלת ענפים/תגיות לפריסה, וסודות שזמינים רק לג'וב שמפנה לסביבה — לריפו ציבורי בחינם — [GitHub Docs: environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- **[מאומת]** push protection לסודות פעיל כברירת מחדל בריפו ציבורי — [GitHub Docs: security features](https://docs.github.com/en/code-security/getting-started/github-security-features)
- **[מאומת]** DORA: לשמור את הבנייה ירוקה ולעשות revert אם אין תיקון תוך דקות; קבוצות קטנות ו־rollback תכוף משפרים צוותי AI — [DORA TBD](https://dora.dev/capabilities/trunk-based-development/); [DORA AI Capabilities](https://cloud.google.com/blog/products/ai-machine-learning/introducing-doras-inaugural-ai-capabilities-model)
- **[משני]** סקירת Copilot לא נספרת כאישור — כלומר AI אחד לא יכול "לאשר" קוד של AI אחר דרך המנגנון הזה — [GitHub Docs (דרך חיפוש)](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-automatic-review)
- **[מאומת]** Coolify ממליץ שהבקשה לפריסה תבוא "אחרי בדיקות, בדיקות אבטחה, בניית ה־image ודחיפה למאגר", ולהשתמש בתגית ייחודית לקומיט ולא רק `latest` — [Coolify Docs: GitHub Actions](https://coolify.io/docs/applications/ci-cd/github/actions)

### Inferences
רשימת אכיפה מוצעת (מסודרת לפי עלות/תועלת — הסקה):
1. **Ruleset על `main`**: בלי push ישיר (גם לא לבעלים — כל שינוי דרך PR), בלי force push/מחיקה, PR חובה, **בדיקות חובה בשם** (ה־job של test.yml), היסטוריה לינארית (squash). אישור אנושי = המיזוג עצמו מהטלפון (אין טעם ב־"Required approvals" כשיש אדם אחד — אי אפשר לאשר PR של עצמך ב־GitHub; אבל PR שה־AI פתח דרך חשבון הבעלים נחשב "של הבעלים").
2. **פריסה רק מ־workflow** (Pages דרך Actions; Docker דרך Actions; APK — כבר כך), עם `needs:` על הבדיקות. כך גם מיזוג בטעות של קוד אדום לא נפרס.
3. **סביבת `production` עם סוקר נדרש = הבעלים** + הגבלה "רק מ־main" או "רק מתגיות `v*`" + סודות הייצור (מפתח חתימת APK, טוקן GHCR/שרת) רק בסביבה. ה־AI בענף שלו לא יכול להגיע לסודות האלה.
4. **שער כפול לשינויים רגישים**: בדיקת CI שמכשילה PR שנוגע ב־`.github/workflows/`, `sw.js`, `CLAUDE.md` (כללי ההוק), או מוחקת/מחלישה בדיקות — אלא אם יש תווית מפורשת שהבעלים הוסיף. (הפרויקט כבר עושה משהו דומה עם `tests/hebrew-rule.test.js` ו־privacy-guard.)
5. **בדיקות עשן אחרי פריסה** (curl לגרסה החיה — כבר נעשה ידנית בפרוטוקול) הופכות ל־job אוטומטי; כישלון → התראה + הצעת rollback.
6. **Rollback כפעולה מוכנה מראש**: workflow שפורס תגית קודמת (Pages/Docker), Instant Rollback ב־Vercel (ב־Hobby — רק לגרסה הקודמת).
7. **Dependabot + CodeQL + secret scanning + push protection** (חינם בריפו ציבורי) + Actions מקובעים ל־SHA (קיים).

### Gaps
- לא אימתתי את ההתנהגות המדויקת של "PR שנפתח ע"י AI דרך אינטגרציה/חשבון הבעלים" מול חובת אישורים — תלוי באיזה זהות ה־AI פותח PR (GitHub App או טוקן אישי).
- לא נחקרו כלי ניטור שגיאות לקוח (Sentry וכד') שיאפשרו rollback אוטומטי לפי שגיאות.

## 7. (נוסף ע"י המתאם) כלי הפריסה לשרת ה־Docker החדש: פאנל PaaS (Coolify/Dokploy/Komodo) מול Docker Compose + GitHub Actions מול Kamal

### Takeaway
מכל הכיוונים, **"בנייה ב־GitHub Actions → דחיפה ל־GHCR עם תגית קומיט → פריסה לשרת"** הוא שמתיישב הכי טוב עם השערים של GitHub (בדיקות חובה, סביבה עם אישור ידני, סודות לסביבה) ועם "בונים פעם אחת ומקדמים". פאנלים כמו Coolify/Dokploy נותנים rollback וממשק נוח, ושניהם תומכים במצב שבו Actions בונה ו־הפאנל רק מושך image מוכן — שילוב שמשמר את השערים. מצב "git push → הפאנל בונה בעצמו" עוקף את שערי GitHub ולכן פחות מתאים לקוד שנכתב ע"י AI.

### Cited Findings
- **[מאומת]** Coolify + GitHub Actions: Actions בונה image, דוחף ל־GHCR, ושולח POST ל־webhook של Coolify עם טוקן API (הרשאת Deploy) ששמור כסוד GitHub; "Coolify לא בונה מחדש את המקור" — משתמשים באפליקציית Docker Image או Compose עם `image:` במקום `build:`. "שימו את הבקשה ל־Coolify אחרי בדיקות, בדיקות אבטחה, בניית ה־image והדחיפה למאגר"; לגרסאות בלתי משתנות — תגית לפי קומיט ולא רק `latest` — [Coolify Docs: GitHub Actions](https://coolify.io/docs/applications/ci-cd/github/actions)
- **[מאומת]** Coolify תומך בפריסה אוטומטית ו־preview deployments ל־PR דרך GitHub App (webhooks + אירועי pull-request); בריפו ציבורי/deploy key נדרשים webhooks ידניים — [Coolify Docs: CI/CD intro](https://coolify.io/docs/applications/ci-cd/introduction)
- **[מאומת]** Dokploy: שני סוגי rollback — אוטומטי של Docker Swarm (חוזר לגרסה הקודמת אם בדיקת health נכשלת; דורש `/health` ו־curl בקונטיינר) ו־rollback לפי מאגר (כל פריסה מתויגת ונדחפת ל־Docker Hub/GHCR; אפשר לחזור לכל פריסה קודמת, לא רק האחרונה). יש גם preview deployments ו־auto deploy (מוזכרים, לא מפורטים בדף) — [Dokploy Docs: Rollbacks](https://docs.dokploy.com/docs/core/applications/rollbacks)
- **[מאומת]** Kamal: `kamal rollback <version>` עוצר את הקונטיינר הנוכחי ומפעיל קונטיינר מאותו image של הגרסה המבוקשת — "אין צורך להוריד דבר מהמאגר"; קונטיינרים ישנים נשמרים 3 ימים כברירת מחדל; הגרסאות מזוהות במחרוזת hex של 40 תווים (בפועל SHA של קומיט — לא נאמר במפורש בדף) — [Kamal Docs: rollback](https://kamal-deploy.org/docs/commands/rollback/)
- **[מאומת]** סביבות GitHub (אישור ידני, סודות לסביבה, הגבלת ענפים/תגיות) זמינות בחינם לריפו ציבורי — [GitHub Docs: environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)
- **[מאומת]** Trivy יכול לסרוק את ה־image ב־CI ולהכשיל לפי חומרה — [trivy-action](https://github.com/aquasecurity/trivy-action); **[משני]** אבל ה־action עצמו נפרץ במרץ 2026 — לקבע ל־SHA — [Wiz](https://www.wiz.io/es-es/blog/trivy-compromised-teampcp-supply-chain-attack)

### Inferences
השוואה (הסקה, על בסיס הממצאים):

| קריטריון | Compose + Actions + GHCR | Coolify / Dokploy (מצב "Actions בונה, הפאנל מושך") | Coolify / Dokploy (מצב "הפאנל בונה מ־git push") | Kamal |
|---|---|---|---|---|
| בונים פעם אחת ומקדמים אותו image | כן — תגית קומיט אחת עוברת staging→prod | כן | לא — הבנייה בשרת, בכל סביבה מחדש | כן (בונה ודוחף למאגר, פורס לפי תגית) |
| בדיקות חובה לפני פריסה | כן, `needs:` | כן, אם ה־webhook רק אחרי הבדיקות | לא מובטח — webhook של push עוקף את CI | כן, אם מריצים `kamal deploy` מתוך Actions |
| שער אישור ידני (GitHub Environment) | כן, מובנה | כן — הג'וב שקורא ל־webhook מפנה לסביבה | לא דרך GitHub | כן, אם רץ מ־Actions |
| Rollback | פריסה מחדש של התגית הקודמת (workflow ידני) | כן, בלחיצה בממשק (Dokploy — לכל פריסה קודמת) | כן, בממשק | `kamal rollback` — מהיר, בלי הורדה |
| Preview לכל PR | צריך לבנות לבד | כן, מובנה | כן, מובנה | לא מובנה |
| עומס תחזוקה ליחיד | נמוך, אבל הכל קוד | פאנל נוסף לתחזק ולאבטח (חשוף לרשת) | כנ"ל | נמוך, CLI |

- המלצה לפרויקט: **Compose + Actions + GHCR** כשכבה הבסיסית (הכי שקוף, הכל בריפו, ה־AI יכול לתחזק), עם סביבות `staging` ו־`production` ב־GitHub, תגית image = SHA של הקומיט, ו־rollback = workflow_dispatch שפורס תגית קודמת. אם רוצים ממשק לחיצה ו־preview — Dokploy/Coolify **רק במצב שבו Actions בונה ו־הפאנל מושך image** (לא מצב build-on-push).
- Kamal מתאים אם השרת יארח כמה אפליקציות ורוצים rollback של שניות בלי פאנל; הוא דורש Ruby/CLI ותצורה משלו (לא נבדק לעומק).
- כל כיוון שבו השרת מקבל webhook — הטוקן חייב להיות סוד **בסביבה** (`production`) ולא סוד ריפו כללי, כדי שרק ג'וב מאושר יוכל להפעיל אותו.

### Gaps
- **Komodo לא נחקר** (לא הגעתי לתיעוד שלו בתקציב הקריאות).
- דף ה־rollback של Coolify לא נקרא — לא אימתתי איך Coolify מבצע rollback (רק שקיים פריט "Rollbacks" בתפריט התיעוד).
- לא אומת ש־Dokploy תומך בהפעלת פריסה מ־Actions עם image מוכן (רק שמשתמש במאגר ל־rollback, ושיש auto deploy).
- לא נבדקו zero-downtime / kamal-proxy, ולא דרישות המשאבים של הפאנלים על שרת קטן.
