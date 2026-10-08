# ארכיטקטורת אבטחה ומודל איומים ל־THE SNOWBALL (08/10/2026)

> שני מקורות ידע: (א) קריאה של הקוד בריפו בלבד, בלי שינויים (המצב ב־08/10/2026, קומיט `40acde8`); (ב) מחקר של שיטות העבודה המומלצות ב־2025–2026.
> סימונים: **[מאומת]** = נבדק היום בקוד, ב־`gh api`/`curl` או בתיעוד הרשמי. **[משני]** = כתבה או בלוג של צד שלישי. **[הסקה]** = מסקנה שלי ולא עובדה.
> פרטיות: אין כאן אף סוד, טוקן או נתון פיננסי. כשמוזכרים שמות של משתני סביבה (למשל `GEMINI_API_KEY`), מדובר בשם בלבד ולא בערך.
> ראיות מהריפו מופיעות כנתיב יחסי לשורש הריפו. שורה = מספר השורה בקובץ.
> משלים את הקבצים [current_project_audit.md](current_project_audit.md) ו־[../ספקי שרתים לפרויקט שגדל/security.md](../ספקי%20שרתים%20לפרויקט%20שגדל/security.md), ומשתמש בחלק מהמקורות שלהם.

---

## 1. מה אנחנו מגינים עליו (הנכסים, ו"תכשיטי הכתר")

### Takeaway
לפרויקט יש **שלושה "מפתחות מאסטר"** ששווים יותר מכל השאר:
1. **חשבון GitHub**: שולט בקוד, באתר החי (Pages), בשרתון (Vercel מתפרס מכל push), במפתח החתימה של האנדרואיד (סוד ב־Actions), בסקריפט שהעובד בענן מריץ, ובקובץ `assetlinks.json`.
2. **המפתח של חשבון השירות של Firebase**, שיושב ב־Vercel. הוא גם מנהל את Firestore, וגם **ממנו נגזר מפתח ההצפנה של כל הכספות** (IBKR, Drive, סטודיו), אלא אם הוגדר `IBKR_VAULT_KEY`.
3. **חשבון Google של הבעלים**, שמנהל את פרויקט Firebase ואת הלקוחות של OAuth.

מי שמשיג אחד מהשלושה משיג כמעט הכל. כל שאר הנכסים נגזרים מהם.

### Cited Findings
**הנכסים, לפי סדר הנזק אם הם דולפים:**
- **טוקן IBKR Flex ו־Query ID**: מאפשרים לקרוא את כל ההיסטוריה הפיננסית של החשבון (קריאה בלבד, Flex לא מבצע מסחר). הם יושבים בשני מקומות:
  - בטלפון, ב־`localStorage` תחת `pwa_ibkr_v1` — [app.js:1736](../../app.js), ובתוך רשימת `ACCOUNT_KEYS` ב־[app.js:4541](../../app.js) **[מאומת]**.
  - מוצפנים בכספת `ibkrVault/{uid}` ב־Firestore: ‏AES‑256‑GCM, ‏IV אקראי, ‏AAD שקושר כל ערך למשתמש ולשדה — [ibkr-proxy/lib/vault.js](../../ibkr-proxy/lib/vault.js) **[מאומת]**.
- **מפתח ההצפנה של הכספת**: הפונקציה `keys()` ב־[vault.js:15](../../ibkr-proxy/lib/vault.js) לוקחת את `IBKR_VAULT_KEY` אם הוגדר. אחרת היא גוזרת את המפתח ב־HKDF‑SHA256 **מהמפתח הפרטי של חשבון השירות** **[מאומת]**. אותה `vault.js` מצפינה גם את ה־refresh tokens של Drive ‏(`driveVault`, ‏`studioDrive`) — [ibkr-proxy/lib/gdrive.js:3,13,133–134](../../ibkr-proxy/lib/gdrive.js) **[מאומת]** — וגם את כתובת ה־Routine והמפתח שלו ‏(`studioVault`) לפי CLAUDE.md §3. מכאן שמפתח חשבון השירות פותח את **כל** הכספות.
- **חשבון השירות של Firebase/GCP** ‏(`GDRIVE_SA_KEY` ב־Vercel, לפי CLAUDE.md §16): מנפיק טוקנים עם scope ‏`datastore` (Firestore מלא) ועם scope ‏`drive.readonly` — [ibkr-proxy/lib/gauth.js:84–85](../../ibkr-proxy/lib/gauth.js) **[מאומת]**. מפתח של חשבון שירות "לא פג כברירת מחדל", ולכן Google ממליצה לא להשתמש במפתחות כאלה — [Google Cloud blog](https://cloud.google.com/blog/products/identity-security/want-your-cloud-to-be-more-secure-stop-using-service-account-keys/); [סיכום WIF](https://pub.towardsai.net/stop-using-service-account-keys-workload-identity-federation-on-gcp-a5c49aa99c7d) **[משני]**.
- **מפתחות AI** (`GEMINI_API_KEY`, ‏Mistral, ‏`GOOGLE_BOOKS_KEY` ב־Vercel; כל המסלולים עוברים דרך `lib/aicache.js` עם מפסק יומי, לפי CLAUDE.md §16 v339). הסיכון הוא בעיקר **כסף**. גם קורא שלא מחובר מקבל תרגום, עם מגבלה לפי IP — [ibkr-proxy/api/translate.js:195–198](../../ibkr-proxy/api/translate.js) **[מאומת]**. OWASP מגדיר את זה כ־LLM10 "Unbounded Consumption" (צריכה בלי גבול) — [Coralogix](https://coralogix.com/ai-blog/owasp-top-10-for-llm-applications/); [F5](https://www.f5.com/resources/infographic/owasp-llm-top10) **[משני]**.
- **סודות לקוחות OAuth של Google** (`GDRIVE_CLIENT_SECRET`, ‏`STUDIO_GDRIVE_CLIENT_SECRET`) ו־refresh tokens (מוצפנים): נותנים גישה ל־Drive של המשתמש, רק לקבצים שהאפליקציה יצרה (`drive.file`) — CLAUDE.md §17–18; [gdrive.js:101–104](../../ibkr-proxy/lib/gdrive.js) בודק את ה־scope **[מאומת]**.
- **מפתח החתימה של אפליקציית האנדרואיד**: שמור בסודות של GitHub (`SNOWBALL_KEYSTORE_B64`, ‏`SNOWBALL_KS_PASS`) — [.github/workflows/android.yml:39,52](../../.github/workflows/android.yml) **[מאומת]**. אם הוא אובד, אי אפשר לעדכן את האפליקציה. אם הוא נגנב, אפשר להפיץ APK מזויף שהטלפון יקבל כעדכון.
- **מפתח ה־Routine של הסטודיו** (כתובת `api.anthropic.com/.../fire` + טוקן): מאפשר להפעיל סשנים של Claude על חשבון המנוי. מוצפן ב־`studioVault`. הכתובת נבדקת מול ביטוי רגולרי, וזה מונע SSRF (השרת פונה לכתובת שתוקף בחר) — [ibkr-proxy/lib/studio.js:8](../../ibkr-proxy/lib/studio.js) **[מאומת]**.
- **מפתח עבודה של העובד**: 32 בתים אקראיים. נשמר רק ה־SHA‑256 שלו, ההשוואה בזמן קבוע (`timingSafeEqual`), תקף 48 שעות — [ibkr-proxy/lib/studio.js:17,146–152](../../ibkr-proxy/lib/studio.js) **[מאומת]**.
- **נתוני המשתמשים**: התיק ב־`users/{uid}` (Firestore), ההדגשות וההתקדמות בספרייה, וסרטונים/תמלילים ב־Drive של המשתמש. לפי CLAUDE.md §3 הם אף פעם לא נכנסים לריפו.
- **החשבונות של הפלטפורמות**: Vercel (משתני הסביבה), Firebase/Google (חוקי Firestore נמצאים רק במסוף), Anthropic (המנוי וה־Routines), ובעתיד ספק השרת.
- **הדומיין**: האתר על `yishaiguedj1.github.io`. זה **לא דומיין בבעלות הפרויקט**. הוא קשור לשם המשתמש ב־GitHub, וכל הכתובת חולקת origin (מקור אחד בדפדפן, עם אחסון משותף) — CLAUDE.md §15 **[מאומת בתיעוד הפרויקט]**.

### Inferences
- **[הסקה]** לפי סדר החשיבות: (1) חשבון GitHub, (2) המפתח של חשבון השירות ב־Vercel, (3) חשבון Google, (4) חשבון Vercel עצמו (מי שנכנס אליו רואה את כל משתני הסביבה), (5) חשבון Anthropic, (6) מפתח החתימה, (7) מפתחות AI (נזק כספי בלבד).
- **[הסקה]** הדבר החשוב ביותר לתיקון ארכיטקטוני: **כל הכספות תלויות בסוד אחד** (מפתח חשבון השירות). אם הוא דולף, התוקף יכול גם לקרוא את Firestore וגם לפענח את מה שמוצפן בו. ההצפנה מגינה רק מפני מי שהשיג את Firestore **בלי** את Vercel.

### Gaps
- לא ידוע אם `IBKR_VAULT_KEY` מוגדר בפועל ב־Vercel. משתני הסביבה לא נגישים מכאן. אם הוא לא מוגדר, הכל נגזר ממפתח חשבון השירות.
- לא ידוע אילו תפקידי IAM (הרשאות) יש לחשבון השירות. CLAUDE.md §16 מזכיר את "Cloud Datastore User". אם יש לו גם Owner/Editor, הנזק מדליפה גדול בהרבה.

---

## 2. מודל איומים: מי עלול לתקוף, איך, ומה כבר מגן

### Takeaway
הסכנה המציאותית ביותר היא **לא האקר שמכוון לפרויקט**. יש שלוש סכנות סבירות יותר:
- **השתלטות על חשבון** של הבעלים (פישינג, טלפון שנפרץ).
- **שרשרת אספקה**: Action, ספרייה או סקריפט התקנה שהושחתו.
- **העוזר החכם עצמו**: Claude שדוחף שינוי שגוי ל־main, או שמשתמשים בו דרך תוכן זדוני בתוך סרטון, תמליל או EPUB.

ההגנות בקוד טובות יחסית לפרויקט אישי (כספת, אימות טוקנים, CSP, שומרי פרטיות). החולשה היא **בשכבת התהליך והזהויות**: אין הגנה על ענף main, יש חשבון אחד עם כל הכוח, ואין סביבת staging.

### Cited Findings
**הטבלה לפי תוקף.** המונחים בסוגריים הם מ־STRIDE: S = התחזות, T = שינוי, R = הכחשה, I = דליפת מידע, D = מניעת שירות, E = העלאת הרשאות.

| תוקף | תרחיש | סבירות | נזק | מה כבר מגן (ראיה) | הפער |
|---|---|---|---|---|---|
| **סורקי אינטרנט ובוטים** | קריאות לשרתון מחוץ לדפדפן כדי לשרוף מכסת AI או את Vercel (D, ‏E) | גבוהה | בינוני (כסף, השבתה) | `guard`: ‏Origin מאושר, ‏POST, גוף עד 4KB — [ibkr-proxy/lib/ibkr.js:58–103](../../ibkr-proxy/lib/ibkr.js); מגבלת קצב — [ibkr.js:113–119](../../ibkr-proxy/lib/ibkr.js); מפסק יומי ל־AI ‏(aicache) **[מאומת]** | ה־Origin ניתן לזיוף מחוץ לדפדפן, וזה כתוב בקוד עצמו ([ibkr.js:60–61](../../ibkr-proxy/lib/ibkr.js)). `APP_KEY` לא הוגדר (CLAUDE.md §3). מגבלת הקצב שמורה בזיכרון של כל מופע serverless בנפרד ולא נספרת בכולם יחד. נקודת `widget` פתוחה ל־`*` ([widget.js:94](../../ibkr-proxy/api/widget.js), נתוני שוק ציבוריים בלבד) |
| **סורקים, על השרת החדש** | פורט SSH, לוח ניהול או מסד נתונים חשופים (S, ‏E) | גבוהה מאוד ברגע שהשרת עולה | קריטי (root) | עדיין אין שרת | Docker עוקף את ufw. ‏`-p 8080:80` פתוח לעולם גם כש־ufw אומר deny — [SSD Nodes](https://www.ssdnodes.com/learn/docker-ports-bypass-ufw) **[משני]**. כ־52,890 לוחות Coolify היו חשופים באינטרנט ב־01/2026 — [The Hacker News](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html) **[משני]** |
| **מי שמכוון לבעלים** | פישינג לחשבון Google/GitHub/Vercel ‏(S) | בינונית | קריטי | מצב ה־2FA בחשבונות לא ידוע (לא ניתן לבדוק מכאן) | אין מידע על passkeys או מפתחות חומרה. כל החשבונות על מייל אחד |
| **XSS (הזרקת סקריפט לדף) או סקריפט זר על אותו origin** | גניבת `pwa_ibkr_v1` מ־localStorage ‏(I) | נמוכה–בינונית | גבוה | CSP קפדני: אין `unsafe-inline` לסקריפטים, יש hash ו־SRI — [index.html:6](../../index.html); [tests/csp.test.js](../../tests/csp.test.js); [tests/xss-guard.test.js](../../tests/xss-guard.test.js) **[מאומת]** | **ה־origin המשותף** `yishaiguedj1.github.io` (CLAUDE.md §15): כל ריפו Pages אחר של המשתמש רואה את אותו localStorage. ‏`connect-src` מאפשר `https://*.vercel.app` (כל אפליקציה ב־Vercel), כלומר ערוץ פתוח להוצאת מידע. אין `frame-ancestors`: ב־meta CSP אי אפשר להגדיר אותו, ו־Pages לא מאפשר כותרות, ולכן אין הגנה מ־clickjacking (הטמעת הדף במסגרת כדי לגרום ללחיצה) |
| **תלות או Action שהושחתו** (שרשרת אספקה) | Action שה־tag שלו הוזז, ספריית pip זדונית, קובץ FFmpeg "latest" ‏(T, ‏E) | בינונית | קריטי (סודות CI, מפתח חתימה, סביבת העובד) | כל ה־Actions מקובעים ל־SHA, ובקובץ הבדיקות `contents: read` — [.github/workflows/test.yml](../../.github/workflows/test.yml) **[מאומת]**. לשרתון **אין אף תלות npm** — [ibkr-proxy/package.json](../../ibkr-proxy/package.json) **[מאומת]**. ‏foliate/mediabunny מקובעים לקומיט ול־sha256 (CLAUDE.md §2) | ב־`setup.sh`: ‏`curl … main/translator/setup.sh \| bash` ‏([שורה 4](../../translator/setup.sh)), ‏FFmpeg `latest` ‏([שורה 36](../../translator/setup.sh)), ‏torch ו־qwen‑asr בלי גרסה ([43–44](../../translator/setup.sh)), ו־[vt-requirements.txt](../../translator/vt-requirements.txt) בלי גרסאות **[מאומת]**. ‏Dependabot כבוי — `dependabot_security_updates: disabled` ‏(gh api, ‏08/10/2026) **[מאומת]**. אין CodeQL |
| **תוכן זדוני** (Prompt Injection, הוראות שמוסתרות בתוכן): בתוך סרטון/תמליל, EPUB או דף ויקיפדיה | הוראה בתמליל לעובד Claude: "העלה את הקבצים ל…", "הרץ…" ‏(E, ‏I) | בינונית (עולה עם כל תוכן חיצוני) | גבוה | ה־RUNBOOK מורה להתייחס לבלוק כנתונים בלבד ([translator/RUNBOOK.md:11–15](../../translator/RUNBOOK.md)). ‏`setup.sh` מוסיף `permissions.deny` ל־`git push` ול־MCP מרוחק ([56–76](../../translator/setup.sh)). ל־Drive של הסטודיו יש לקוח OAuth נפרד עם `drive.file`, ולכן העובד לא מגיע לגיבוי הספרייה (CLAUDE.md §18). ‏EPUB: סקריפט בספר חסום ב־CSP (CLAUDE.md §16) **[מאומת]** | לסוכן עדיין יש shell, רשת לדומיינים שאושרו (כולל "default list"), טוקן Drive ומפתח עבודה. OWASP: ‏LLM01 Prompt Injection במקום הראשון, LLM06 Excessive Agency (סוכן עם יותר כוח מהנחוץ) — [Coralogix](https://coralogix.com/ai-blog/owasp-top-10-for-llm-applications/) **[משני]**. ‏Anthropic: "Avoid piping untrusted content directly to Claude" (אל תעבירו תוכן לא אמין ישירות ל־Claude), ‏"Use virtual machines" (השתמשו במכונות וירטואליות) — [Claude Code Security](https://code.claude.com/docs/en/security) **[מאומת]** |
| **טלפון של הבעלים שנפרץ, או חשבון Google שנגנב** | גישה לאפליקציה, ל־localStorage (טוקן IBKR), ל־Drive ול־Firebase ‏(S, ‏I) | נמוכה | קריטי | הפרדת חשבונות במכשיר (v313) — [tests/account-v313.test.js](../../tests/account-v313.test.js). הסנכרון ברקע מאפשר לא להחזיק את הטוקן בטלפון **[מאומת]** | הטוקן עדיין נשמר בטלפון ב־`pwa_ibkr_v1`, גם כשהסנכרון ברקע פעיל [הסקה מ־ACCOUNT_KEYS]. ‏`android:allowBackup="true"` ([AndroidManifest.xml:9](../../android/app/src/main/AndroidManifest.xml)): נתוני הווידג׳ט (רשימת הסמלים בתיק) נכנסים לגיבוי של Google **[מאומת]** |
| **"איש פנים" = העוזר החכם** (Claude בסשן פיתוח) | דחיפה ישירה ל־main בלי אישור או בלי בדיקות, מחיקת בדיקה "כדי שיעבור", שינוי CSP/guard ‏(T, ‏R) | **בינונית–גבוהה** (קרה בעבר: לקח v252, דחיפה עם בדיקה אדומה, CLAUDE.md §7) | גבוה (פריסה ישירה לייצור) | כללים כתובים ב־CLAUDE.md §8 ("לא לפרוס בלי אישור"). מסווג Auto mode חוסם "Production Deploy" (CLAUDE.md §8) | **אין הגנה טכנית**: ‏`main` לא מוגן ואין rulesets (‏`gh api …/rulesets` → ‏`[]`, ‏`…/branches/main/protection` → ‏404 "Branch not protected", ‏08/10/2026) **[מאומת]**. ‏[.claude/settings.json](../../.claude/settings.json) מאשר מראש `Bash(git push origin HEAD:main)` **[מאומת]**. לפי Anthropic, הפרוקסי של GitHub בסשן ענן מכבד branch protection ו־rulesets, אבל "A rule that access can bypass doesn't block a session's push" (כלל שהגישה יכולה לעקוף לא חוסם את הדחיפה) — [Claude Code Security](https://code.claude.com/docs/en/security) **[מאומת]** |
| **ספק GPU זר** (בעתיד: Vast/RunPod) | קריאת סרטונים, תמלילים או טוקנים מהדיסק או מהזיכרון ‏(I) | בינונית בשוק פתוח | בינוני–גבוה (פרטיות) | עדיין לא בשימוש | ר׳ [../ספקי שרתים לפרויקט שגדל/security.md](../ספקי%20שרתים%20לפרויקט%20שגדל/security.md) §א3: על מחשב של זר המידע לא מוגן |
| **מניעת שירות / עלות** | הצפה של `/api/translate` אנונימי, של `bookmeta` או של הפעלות Routine ‏(D) | בינונית | כסף + השבתה | מכסות יומיות ב־aicache; לכל היותר 20 הפעלות בשעה למשתמש (CLAUDE.md §18); אין ניסיון חוזר אוטומטי להפעלה **[מאומת בתיעוד]** | הקצב נמדד לפי `x-forwarded-for` ([flex-request.js:20](../../ibkr-proxy/api/flex-request.js)) ובזיכרון בלבד. מגבלת ההוצאה של Gemini נאכפת רק אחרי כ־10 דקות — [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/more-control-over-gemini-api-costs/); [סיכום 03/2026](https://shellypalmer.com/2026/03/google-gives-developers-cost-controls-for-gemini-api/) **[משני]** |

**הגנות קיימות שראוי לציין (ישרות, יש הרבה)** **[מאומת]**:
- אימות Firebase ID token בשרתון: ‏RS256 מול מפתחות Google, עם בדיקת `aud`/`iss`/`exp` — [ibkr-proxy/lib/gauth.js:26–40](../../ibkr-proxy/lib/gauth.js).
- רשימת קוראים חתומה ב־HMAC (CLAUDE.md §16).
- כתובת החזרה של OAuth מוגבלת לביטוי רגולרי — [gdrive.js:25](../../ibkr-proxy/lib/gdrive.js).
- הקרון של סנכרון IBKR: ‏`CRON_SECRET` נאכף רק אם הוגדר — [ibkr-sync.js:115–117](../../ibkr-proxy/api/ibkr-sync.js). אם לא הוגדר, הקרון פתוח, אבל הוא אידמפוטנטי (הפעלה חוזרת לא עושה עבודה נוספת), כך ש־IBKR לא מקבל יותר פניות.
- שומרי פרטיות ב־CI — [tests/privacy-guard.test.js](../../tests/privacy-guard.test.js).
- secret scanning ו־push protection פעילים בריפו (gh api, ‏08/10/2026).

### Inferences
- **[הסקה]** שלוש התקיפות עם יחס "סבירות × נזק" הגבוה ביותר: (1) **שינוי שגוי או זדוני שנכנס ל־main בלי בקרה** (בגלל AI, חשבון שנפרץ או Action מושחת), כי ‏main = ייצור מיידי ב־Pages, ב־Vercel ובסקריפט של העובד; (2) **השתלטות על חשבון של הבעלים**; (3) **שריפת כסף ב־AI**.
- **[הסקה]** ‏`setup.sh` נמשך מ־main בכל בנייה של הסביבה. לכן כל מי שיכול לדחוף ל־main מקבל **הרצת קוד בסביבת העובד**, שם יש טוקן Drive ומפתח עבודה. זו שרשרת ישירה מ־"push" ל־"גישה לנתוני משתמש".

### Gaps
- לא נבדק אם ל־2FA בחשבונות של הבעלים יש passkey או מפתח חומרה. רק הבעלים יכול לבדוק.
- לא אומת אם Vercel מנקה `X-Forwarded-For` שמגיע מהלקוח. אם לא, אפשר לזייף IP ולעקוף את מגבלת הקצב.
- לא ידוע מה כולל "default list" של הרשת בסביבת הסטודיו ב־claude.ai. ההנחה: מאגרי חבילות, GitHub וכו'.

---

## 3. נקודות התורפה היום, עם ראיות

### Takeaway
הקוד עצמו "לפי הספר" יותר מהממוצע. הפערים הם **בתשתית מסביב**: ‏main לא מוגן, אין staging, חוקי Firestore לא בריפו ולא נבדקים, סוד מאסטר אחד, ‏origin משותף, תלויות Python וסקריפטים לא מקובעים, ואין ניטור או התראות. רובם זולים לתיקון.

### Cited Findings
1. **‏main לא מוגן ואין rulesets** **[מאומת, gh api ‏08/10/2026]**. גם ה־AI מורשה מראש לדחוף ל־main ([.claude/settings.json](../../.claude/settings.json)). ב־OWASP CI/CD Top 10 זה CICD‑SEC‑1 "Insufficient Flow Control Mechanisms" (אין מנגנון שמונע מגורם יחיד להעביר קוד לייצור), ההמלצה: "configuring branch protection without exempting any actors" (הגנה על ענפים בלי חריגים לאף אחד) — [OWASP CI/CD Top 10](https://owasp.org/www-project-top-10-ci-cd-security-risks/); [שקפי OWASP Bangkok 2023](https://owasp.org/www-chapter-bangkok/slides/2023/2023-07-21_Top-10-CI-CD-Security-Risks.pdf) **[מאומת]**. ‏Rulesets זמינים בחינם בריפו ציבורי — [GitHub docs: troubleshooting rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules) **[מאומת]**.
2. **פריסה בלי שער ובלי staging**: ‏Pages מתפרס גם כשהבדיקות אדומות (CLAUDE.md §15). ‏Vercel מתפרס מכל push שנוגע ב־`ibkr-proxy/` (CLAUDE.md §8). אין סביבת ביניים. הפרוטוקול הדו־שלבי של sw.js הוא נוהל ידני ולא שער.
3. **כל הריפו מתפרסם באתר**: ‏`CLAUDE.md`, ‏`translator/RUNBOOK.md` ו־`ibkr-proxy/lib/vault.js` מחזירים 200 מ־`yishaiguedj1.github.io/portfolio-pwa/` **[מאומת, curl ‏08/10/2026]** (קבצי נקודה כמו `.github/` מחזירים 404). אין שם סודות, והריפו ציבורי בכל מקרה. אבל זה מוסיף שטח: כל קובץ HTML שנכנס לריפו (מוקאפים, דוחות) נהיה דף חי על ה־origin של האפליקציה, עם גישה ל־localStorage שלה **[הסקה]**.
4. **‏origin משותף + טוקן ב־localStorage** (CLAUDE.md §15, סיכון 2) **[מאומת בתיעוד]**. כל דף תחת `yishaiguedj1.github.io/*`, כולל ריפו `assetlinks` בשורש ואפליקציות עתידיות, קורא את `pwa_ibkr_v1`.
5. **השרתון מוגן ב־Origin בלבד**: ‏`APP_KEY` לא הוגדר (CLAUDE.md §3). מגבלת הקצב נשמרת בזיכרון של המופע ([ibkr.js:113–119](../../ibkr-proxy/lib/ibkr.js); [studio.js:29–35](../../ibkr-proxy/api/studio.js)) **[מאומת]**. אין App Check של Firebase (חיפוש `appcheck` ‏→ אין תוצאות) **[מאומת]**.
6. **סוד מאסטר אחד** (ר׳ §1). יש מנגנון להחלפת מפתח (`kid` = ‏`e`/`s` בפורמט `v1.<kid>…`), אבל **אין כלי שמצפין מחדש** רשומות ישנות, ואין נוהל מתועד להחלפה — [vault.js](../../ibkr-proxy/lib/vault.js) **[מאומת]**.
7. **חוקי Firestore לא נמצאים בריפו** (`find` של `firestore.rules`/`firebase.json` ‏→ אין) **[מאומת]**, ולכן גם לא נבדקים. ב־CLAUDE.md §14 יש "המלצה פתוחה" לוודא שהלקוח ניגש רק ל־`users/{uid}`. Firebase מספקת `@firebase/rules-unit-testing` עם `assertFails`/`assertSucceeds` מול אמולטור, ומדגישה ש"never touches your production resources" (לא נוגע במשאבי הייצור) — [Firebase: Build unit tests](https://firebase.google.com/docs/rules/unit-tests) **[מאומת]**. **[הסקה]** אם החוקים מאפשרים ללקוח לכתוב ל־`aiCache`, אפשר "להרעיל" תרגומים לכל הקוראים. אם הם מאפשרים לקרוא את `studioJobs`/`ibkrVault`, דולפים מטא־נתונים (המידע עצמו מוצפן).
8. **פרויקט Firebase אחד וחשבון שירות אחד לכל השימושים**: ייצור, בדיקות ידניות, ספרייה, סטודיו ו־IBKR (CLAUDE.md §16–18). Google ממליצה "dedicated service accounts for each application… minimum IAM roles" (חשבון שירות נפרד לכל אפליקציה, עם המינימום של ההרשאות) ולחסום יצירת מפתחות ב־`iam.disableServiceAccountKeyCreation` — [Google Cloud blog](https://cloud.google.com/blog/products/identity-security/want-your-cloud-to-be-more-secure-stop-using-service-account-keys/) **[משני]**.
9. **שרשרת אספקה בצד העובד**: ‏`curl … | bash` מ־main, ‏FFmpeg `latest`, ‏pip בלי גרסאות ובלי hash ([translator/setup.sh](../../translator/setup.sh); [vt-requirements.txt](../../translator/vt-requirements.txt)) **[מאומת]**. ‏OWASP Top 10:2025 העלה את "A03 Software Supply Chain Failures" (כשלים בשרשרת האספקה) לקטגוריה חדשה במקום השלישי — [Fastly](https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know); [Secure Code Warrior](https://www.securecodewarrior.com/blog/owasp-top-10-2025-software-supply-chain-failures) **[משני]**. אירוע tj‑actions ‏(CVE‑2025‑30066, ‏03/2025): ה־tags הוזזו לקומיט זדוני שהדפיס סודות ללוגים. הלקח: קיבוע ל־SHA ("labels can be moved") — [Wiz](https://www.wiz.io/ko-kr/blog/github-action-tj-actions-changed-files-supply-chain-attack-cve-2025-30066); [SentinelOne](https://www.sentinelone.com/vulnerability-database/cve-2025-30066) **[משני]**. הפרויקט כבר מקבע Actions ל־SHA ✓.
10. **‏Workflows עם הרשאות כתיבה**: ‏`android.yml` ו־`stock-universe.yml` עם `contents: write` ([android.yml:15](../../.github/workflows/android.yml); [stock-universe.yml:16](../../.github/workflows/stock-universe.yml)) **[מאומת]**. זה מוצדק (Release, דחיפת היקום), אבל ברמת ה־workflow ולא ברמת ה־job. **[הסקה]** כדאי לצמצם את ההרשאה ל־job שצריך אותה.
11. **Dependabot כבוי, אין CodeQL** **[מאומת]**. secret scanning ו־push protection פעילים **[מאומת]**. לפי GitHub, push protection ברמת החשבון חוסם סודות בדחיפה לריפו ציבורי, ומי שיש לו הרשאת כתיבה יכול לעקוף אותה עם נימוק, והעקיפה נרשמת ב־audit log (יומן ביקורת) — [GitHub docs: push protection](https://docs.github.com/en/code-security/concepts/secret-security/push-protection) **[מאומת]**.
12. **שומר הפרטיות סורק רק את העץ הנוכחי** (`git ls-files`, [tests/privacy-guard.test.js](../../tests/privacy-guard.test.js)) ולא את ההיסטוריה. "ניקוי היסטוריה ציבורית" עדיין פתוח (CLAUDE.md §14) **[מאומת]**.
13. **אין ניטור או התראות מרכזיים**: אין בריפו בדיקת זמינות, התראה על חריגת עלות AI, התראה על כניסה חשודה או נוהל לתקרית. OWASP Top 10:2025: ‏"A09 Security Logging and Alerting Failures" (כשלים ברישום ובהתראות) — [Fastly](https://www.fastly.com/blog/new-2025-owasp-top-10-list-what-changed-what-you-need-to-know) **[משני]**.
14. **גיבוי Firestore**: אין שום אזכור בריפו לגיבוי או לייצוא מתוזמן של Firestore **[מאומת: חיפוש בתיעוד]**. התיק האמיתי של המשתמש חי רק שם (CLAUDE.md §3).
15. **אנדרואיד**: ‏`WidgetSyncActivity` מוגדר `exported="true"` עם סכמה `snowball://widget` ([AndroidManifest.xml:40–50](../../android/app/src/main/AndroidManifest.xml)) **[מאומת]**. **[הסקה]** כל אפליקציה או דף יכולים לשלוח לו רשימת סמלים ולשנות את מה שהווידג׳ט מציג. זה נזק לשלמות בלבד, ונמוך. מפתח החתימה תלוי בסוד יחיד ב־GitHub, ואין גיבוי מתועד מחוץ לו (CLAUDE.md §2: "אבד = אי אפשר לעדכן").
16. **CSP**: ‏`style-src 'unsafe-inline'`, ‏`connect-src https://*.vercel.app`, ואין `frame-ancestors`/HSTS שאפשר לשלוט בהם (Pages) — [index.html:6](../../index.html) **[מאומת]**.

### Inferences
- **[הסקה]** כמעט כל הפערים "בחינם" או כמעט בחינם: ruleset, ‏Dependabot, קובץ חוקים בריפו + בדיקת אמולטור, ‏`APP_KEY`, ‏`IBKR_VAULT_KEY` נפרד, ייצוא Firestore. מה שדורש מאמץ: מעבר ל־origin נפרד (דומיין משלכם) והפרדת סביבות.
- **[הסקה]** הנקודה החמורה ביותר היא 1+2+9 ביחד: **push אחד ל־main = ייצור בשלוש מערכות** (אתר, שרתון, עובד), בלי שער.

### Gaps
- הגדרות האבטחה של חשבונות Vercel, Firebase ו־Anthropic לא נבדקו (2FA, חברי צוות, יומני ביקורת).
- לא נבדקו הגדרות Pages (‏`https_enforced`): ה־API חסום דרך הפרוקסי של הסביבה.

---

## 4. ארכיטקטורת היעד: "מאובטח מהתכנון" לשלב החדש

### Takeaway
העיקרון: **אף זהות אחת, סוד אחד או push אחד לא מגיעים לבד לייצור או לנתונים.**
- זהויות: מפתחות חומרה או passkeys לכל החשבונות.
- קוד: הגנה על main ל**כל** הגורמים, כולל הבעלים וה־AI.
- סביבות dev/staging/prod עם **סודות, פרויקט Firebase ומפתחות AI נפרדים**.
- שרת בלי פורטים ציבוריים מלבד 443.
- עובד AI בקונטיינר סגור, עם יציאה לרשת רק לרשימה מאושרת, ותזמור בסקריפט ולא ב"סוכן חופשי".
- ניטור + נוהל דליפה + גיבוי שאי אפשר למחוק.

### Cited Findings
**א. זהות וגישה**
- **‏2FA עמיד לפישינג** (passkey או מפתח חומרה): ‏GitHub, ‏Google (כולל Firebase/GCP), ‏Vercel, ‏Anthropic, ספק השרת ורשם הדומיין. שני מפתחות חומרה (ראשי + גיבוי). **[הסקה — אין כאן מקור שנקרא; מומלץ לאמת בתיעוד של כל ספק]**.
- **Rulesets על main בלי רשימת עוקפים**: חובת PR, חובת בדיקות `tests` ירוקות (מקובעות ל־GitHub Actions כ־app), חסימת force‑push ומחיקה — [GitHub docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/troubleshooting-rules) **[מאומת]**; [Otterdog: bypass actors](https://otterdog.readthedocs.io/en/latest/reference/organization/repository/ruleset/) **[משני]**. כך גם סשן Claude בענן לא יוכל לדחוף ל־main ("GitHub decides which branches a session can update by applying your repository's branch protection rules and rulesets", ‏GitHub מחליט לאילו ענפים הסשן יכול לדחוף לפי חוקי ההגנה של הריפו) — [Claude Code Security](https://code.claude.com/docs/en/security) **[מאומת]**. הפרוטוקול של "שני PR" (CLAUDE.md §8) נשאר, והמיזוג נעשה בטלפון של הבעלים.
- **סביבות GitHub (Environments) עם מאשרים חובה** לפריסה לייצור (ל־Pages דרך Actions, לשרת): בתוכנית החינמית זמין רק בריפו ציבורי, וכאן הריפו ציבורי ✓. אפשר למנוע ממי שהפעיל את הפריסה לאשר אותה בעצמו — [GitHub docs: deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) **[מאומת]**; [GitHub community #170307](https://github.com/orgs/community/discussions/170307) **[משני]**.
- **בלי מפתחות של חשבון שירות**: ‏Vercel תומך ב־OIDC federation ל־GCP (‏Workload Identity Federation, החלפת טוקן קצר מועד במקום מפתח קבוע) "on all plans" — [Vercel docs: OIDC GCP](https://docs.vercel.com/docs/oidc/gcp) **[משני — תקציר של התיעוד]**. ‏GitHub Actions תומך ב־OIDC באותה צורה. ‏Google: לחסום יצירת מפתחות (`iam.disableServiceAccountKeyCreation`) — [Google Cloud blog](https://cloud.google.com/blog/products/identity-security/want-your-cloud-to-be-more-secure-stop-using-service-account-keys/) **[משני]**.
- **חשבון שירות נפרד לכל שירות ולכל סביבה**: שרתון IBKR, ספרייה, סטודיו, העובד ו־CI. כל אחד עם התפקיד המינימלי — [Google Cloud blog](https://cloud.google.com/blog/products/identity-security/want-your-cloud-to-be-more-secure-stop-using-service-account-keys/) **[משני]**.

**ב. רשת (השרת החדש)**
- אין SSH ציבורי. הגישה דרך Tailscale (חיבורים יוצאים בלבד, בלי פורט פתוח). מדיניות ה־tailnet קובעת מי נכנס. דרך מילוט = הקונסולה של הספק — מסוכם ב־[security.md §ב1](../ספקי%20שרתים%20לפרויקט%20שגדל/security.md) **[משני]**.
- פתוחים לאינטרנט רק 80/443 של ה־reverse proxy. כל שירות פנימי מפרסם פורט רק על `127.0.0.1` או על כתובת ה־tailnet (ר׳ המלכודת של Docker ו־ufw) — [SSD Nodes](https://www.ssdnodes.com/learn/docker-ports-bypass-ufw) **[משני]**. חומת האש של הספק היא השכבה הראשונה, ובודקים מבחוץ עם nmap.
- **לוח ניהול לעולם לא ציבורי** (ר׳ §5).

**ג. סודות**
- **מקור אמת אחד לכל סביבה**: משתני סביבה של Vercel לשרתון, ‏Environment secrets של GitHub ל־CI, וקובץ סודות מוצפן על השרת (למשל SOPS/age, או Docker secrets). בלי עותקים בטלפון, בצ'אט או בריפו. **[הסקה]**
- **‏`IBKR_VAULT_KEY` ייעודי** (מפריד את הכספת ממפתח חשבון השירות; הקוד כבר תומך ב־`kid=e` ‏— [vault.js](../../ibkr-proxy/lib/vault.js)) ✓. בעתיד: KMS (שירות ניהול מפתחות) ‏+ "הצפנת מעטפה" (מפתח לכל רשומה, שמוצפן במפתח מרכזי) **[הסקה]**.
- **מפתחות AI נפרדים לכל סביבה, עם תקרת הוצאה**:
  - ב־Anthropic, workspace מקבל מגבלת הוצאה חודשית, ומפתח API שייך ל־workspace אחד ולא עובר — [Anthropic: Workspaces](https://anthropic.com/news/workspaces); [Claude support](https://support.claude.com/en/articles/9796807-creating-and-managing-workspaces-in-the-claude-console) **[משני/רשמי חלקי]**.
  - ב־Gemini, "Project Spend Caps" מ־16/03/2026. הם נאכפים עם השהיה של כ־10 דקות, ויש גם תקרות לפי Tier — [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/more-control-over-gemini-api-costs/) **[רשמי — תקציר]**; [agentdeals](https://agentdeals.dev/gemini-api-pricing-2026) **[משני]**.
- **לוח החלפת מפתחות**: AI ו־`APP_KEY` כל 90 יום, או מיד בחשד. מפתח הכספת — רק עם הצפנה מחדש מתוכננת. מפתח החתימה — לעולם לא מוחלף; גיבוי לא מקוון בשני מקומות **[הסקה]**.

**ד. נתונים**
- צמצום: הטוקן של IBKR **רק בשרתון**, ולא ב־localStorage, כשהסנכרון ברקע פעיל. סרטונים ותמלילים נמחקים מהשרת/העובד בסוף עבודה, ונשארים רק ב־Drive של המשתמש (CLAUDE.md §3 כבר דורש). staging עם נתונים פיקטיביים בלבד (כמו תיק הדמו).
- **origin נפרד**: האפליקציה על דומיין משלכם (למשל `app.<domain>`) ולא תחת `*.github.io`. זה פותר את §3.4 ומאפשר כותרות אמיתיות (‏`frame-ancestors`, ‏HSTS, ‏CSP בכותרת) דרך reverse proxy או Cloudflare **[הסקה]**. שימו לב: מעבר דומיין מחייב לעדכן `ALLOWED_ORIGINS`, ‏`REDIRECT_RE` של OAuth, ‏assetlinks והדומיינים המאושרים של Firebase (CLAUDE.md §3, §17).
- **חוקי Firestore כקוד**: ‏`firestore.rules` בריפו, בדיקות אמולטור ב־CI (‏`assertFails` על `ibkrVault`, ‏`studioJobs`, ‏`aiCache`, ‏`academy/config`; ‏`assertSucceeds` רק על `users/{uid}` של המשתמש עצמו) — [Firebase docs](https://firebase.google.com/docs/rules/unit-tests) **[מאומת]**. בנוסף, Firebase App Check **[הסקה, לא נחקר כאן]**.
- **גיבויים**: ייצוא Firestore מתוזמן לדלי (bucket) עם Object Lock (נעילה: אי אפשר למחוק או לשנות לתקופה מוגדרת), ‏restic מהשרת. הגיבוי נבדק בשחזור — ר׳ [security.md §ב3](../ספקי%20שרתים%20לפרויקט%20שגדל/security.md) **[משני]**.

**ה. בטיחות של סוכני AI** (‏OWASP LLM Top 10 2025: ‏LLM01 Prompt Injection, ‏LLM02 Sensitive Info Disclosure, ‏LLM06 Excessive Agency, ‏LLM10 Unbounded Consumption — [Coralogix](https://coralogix.com/ai-blog/owasp-top-10-for-llm-applications/); [Invicti](https://invicti.com/blog/web-security/owasp-top-10-risks-llm-security-2025) **[משני]**)
- **תזמור בסקריפט, המודל מקבל טקסט בלבד**: השלבים הדטרמיניסטיים (הורדה, ‏ASR, יישור, צריבה, העלאה) רצים ב־`job.py` בלי מודל. המודל מקבל רק את קובץ הטקסט ומחזיר רק קובץ תיקונים/תרגום בפורמט שנבדק (`tr-check`). אין לו shell. היום הסשן הוא סוכן Claude עם Bash, ‏Write ותת־סוכנים ([RUNBOOK.md §2](../../translator/RUNBOOK.md)) **[מאומת]**. בשרת משלכם: קריאה ל־API מתוך הסקריפט במקום סוכן **[הסקה]**.
- **ארגז חול**: קונטיינר נפרד לעובד. בלי docker.sock, ‏`read_only`, ‏`cap_drop: ALL`, ‏`no-new-privileges`, משתמש לא־root, ‏tmpfs, בלי mount של המארח — [security.md §ב2](../ספקי%20שרתים%20לפרויקט%20שגדל/security.md) **[משני; לפי ידע כללי, ר׳ שם]**. Anthropic ממליצה על VM/ארגז חול לתוכן חיצוני — [Claude Code Security](https://code.claude.com/docs/en/security) **[מאומת]**.
- **יציאה לרשת רק לרשימה מאושרת**: ‏`googleapis.com` (Drive), כתובת השרתון, ספק ה־API של המודל. בלי "default list" כללי. התקנות נעשות בבניית ה־image ולא בזמן ריצה **[הסקה]**.
- **הרשאות מינימליות**: טוקן Drive לשעה ורק לתיקיית העבודה (כבר `drive.file` ✓), מפתח עבודה ל־48 שעות ✓, בלי גישה לריפו ✓ (deny ל־git push). צריך להוסיף: מגבלת זמן ותקציב טוקנים לכל עבודה (LLM10).
- **הסוכן בסשן הפיתוח**: להסיר את `Bash(git push origin HEAD:main)` מ־[.claude/settings.json](../../.claude/settings.json). הגנה על main ב־ruleset (למעלה). ‏`/security-review` לפני כל PR שנוגע ב־`ibkr-proxy/lib/`, ב־CSP או ב־`sw.js` — [Claude Code Security](https://code.claude.com/docs/en/security) **[מאומת]**.

**ו. שרשרת אספקה** (‏NIST SSDF, ‏SP 800‑218 v1.1. טיוטת v1.2 ‏(800‑218r1) פורסמה ב־17/12/2025 — [NIST CSRC](https://csrc.nist.gov/pubs/sp/800/218/ipd); [Shostack](https://shostack.org/blog/nist-800-218-revision/) **[משני לגבי התוכן]**)
- Actions מקובעים ל־SHA ✓. להוסיף Dependabot (גם עדכוני Actions), ‏CodeQL (חינם לריפו ציבורי) **[הסקה: זמינות לפי ידע כללי]**, ובדיקת היסטוריה עם secret scanning ✓ (קיים).
- Python: ‏`requirements.txt` עם גרסאות מדויקות ו־hashes (‏`pip install --require-hashes`). ‏FFmpeg מגרסה עם sha256 ולא `latest`. ‏setup.sh מתג קבוע או מ־image, ולא `curl main | bash`.
- Images: digest קבוע (`image@sha256:`), ‏SBOM (רשימת רכיבים) וחתימה (cosign) כשהשרת עולה. מסגרת SLSA לשרשרת הבנייה **[הסקה — SLSA לא נקרא כאן]**.

**ז. ניטור ותגובה לתקרית**
- התראות מינימום: (1) חריגה בהוצאה (AI, ‏Vercel, ‏GCP Budget); (2) כניסה חדשה לחשבונות (התראות מובנות של Google ו־GitHub); (3) בדיקת זמינות לאתר, לשרתון ולשרת; (4) push שעקף את push protection (ב־audit log) — [GitHub docs](https://docs.github.com/en/code-security/concepts/secret-security/push-protection) **[מאומת]**.
- **נוהל דליפת מפתח** (מסמך קצר בריפו, בלי סודות): לזהות → לבטל אצל הספק → להנפיק חדש → לעדכן במקור האמת → לפרוס מחדש → לבדוק בלוגים מה נעשה בחלון הדליפה. מקרים מיוחדים:
  - **מפתח חשבון השירות**: לבטל את המפתח ב־IAM, להוסיף `IBKR_VAULT_KEY` חדש, להצפין מחדש את הכספות (או למחוק אותן ולבקש מהמשתמשים חיבור מחדש), ולבטל את כל ה־refresh tokens של Drive.
  - **טוקן IBKR**: לבטל ב־Client Portal ולהנפיק חדש.
  - **מפתח Routine**: ‏Regenerate ב־claude.ai.
  - **מפתח חתימה**: אין ביטול. זה מחייב אפליקציה חדשה ועדכון assetlinks. לכן הגיבוי חייב להיות בטוח.
  - הלקח מ־tj‑actions: כל סוד שהופיע בריצה פגיעה נחשב דלוף — [Wiz](https://www.wiz.io/ko-kr/blog/github-action-tj-actions-changed-files-supply-chain-attack-cve-2025-30066) **[משני]**.

### Inferences
- **[הסקה]** סדר בנייה מומלץ: קודם **זהויות ו־main** (חוסם את רוב התרחישים), אחר כך **הפרדת סודות וסביבות**, ורק אחר כך השרת. שרת חדש בלי ruleset ובלי staging רק מוסיף שטח.
- **[הסקה]** ASVS 5.0 (שוחרר ב־30/05/2025, כ־350 דרישות ב־17 תחומים — [Intertek](https://assuranceinaction.intertek.com/post/102kghm/owasp-release-version-5-0-of-the-application-security-verification-standard-asvs); [SoftwareMill](https://softwaremill.com/whats-new-in-asvs-5-0/) **[משני]**) מתאים כרשימת בדיקה לשרתון ולשרת. רמה 1 מספיקה לפרויקט אישי, ורמה 2 לנקודות שנוגעות בכספת.

### Gaps
- לא נקראו ישירות: ‏Tailscale docs, ‏SLSA, ‏CISA Secure by Design ‏(Pledge), ‏OpenRouter (מפתחות עם תקרה). ההמלצות שתלויות בהם מסומנות [הסקה].
- לא אומת ש־Firebase Auth/Firestore עובדים עם Vercel OIDC בלי שינוי קוד. היום `gauth.js` חותם JWT בעצמו עם המפתח הפרטי ([gauth.js:65–81](../../ibkr-proxy/lib/gauth.js)), ומעבר ל־WIF ידרוש החלפה של `saToken`.
- זמינות CodeQL ו־Dependabot בחינם לריפו ציבורי — לפי ידע כללי ולא נבדק היום.

---

## 5. החלטת אבטחה: לוח ניהול (PaaS) או Compose+Actions או Kamal

### Takeaway
מבחינת אבטחה, **Docker Compose + GitHub Actions** (או Kamal) עדיפים על Coolify/Dokploy. אין תהליך root ותיק שרץ בשרת עם ממשק ווב, הסודות וההגדרות בריפו (שעובר בקרה ב־PR), וכל פריסה עוברת את אותו שער של GitHub. אם בוחרים לוח בכל זאת: רק דרך Tailscale, משתמש יחיד, עדכון שבועי, ובלי Preview Deployments מ־PR של זרים.

### Cited Findings
- **Coolify, ‏01/2026**: ‏11 פרצות קריטיות (CVSS 9.4–10.0). רובן הזרקת פקודות שנותנת root (גיבוי DB, ‏proxy, שדה git, ‏Compose). אחת מאפשרת למשתמש עם הרשאות נמוכות לקרוא מפתח SSH של root (CVE‑2025‑64420). תוקנו ב־beta.451. ‏Censys מנה כ־52,890 מופעים חשופים — [The Hacker News](https://thehackernews.com/2026/01/coolify-discloses-11-critical-flaws.html); [heise](https://heise.de/-11134651) **[משני]**.
- **Coolify, ‏07/2026**: ‏CVE‑2026‑34038/34047/57498/34037/34048 (הרצת פקודות בידי חברי צוות, שרשרת ל־root). תוקנו ב־beta.464–474 — [heise 06/07/2026](https://www.heise.de/en/news/Coolify-Critical-vulnerabilities-could-enable-remote-attacks-11354777.html) **[מאומת בסשן קודם, ר׳ control_panels.md]**. בדף ה־advisories: "Unauthenticated Deployment Trigger via Webhook HMAC Bypass with Null Secret" (הפעלת פריסה בלי הזדהות), 25/06/2026 — [Coolify advisories](https://github.com/coollabsio/coolify/security/advisories) **[מאומת בסשן קודם]**. ארכיטקטורה: תהליך אחד עם docker.sock ו־SSH כ־root לכל השרתים — [bex.co](https://bex.co/blog/2026/07/10/coolify-cve-pileup-single-daemon-paas-risk) **[משני — מתחרה]**.
- **Dokploy**: ‏CVE‑2025‑53825 (CVSS 9.4, **בלי הזדהות**): ‏PR לריפו ציבורי עם Preview Deployments → הרצת קוד וקריאת משתני סביבה. תוקן ב־0.24.3 — [NVD](https://nvd.nist.gov/vuln/detail/CVE-2025-53825) **[מאומת בסשן קודם]**. **רלוונטי במיוחד כאן, כי הריפו ציבורי.** ‏CVE‑2026‑45628 (9.6, הזרקה דרך שם ענף) — [cvelogic](https://www.cvelogic.com/vendor/dokploy) **[משני]**. ‏Dokploy עדיין לפני 1.0 (v0.30.2) — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/) **[משני]**.
- **Kamal**: אין לוח ואין תהליך פלטפורמה שרץ בשרת. ההגדרות ב־YAML בריפו, והפריסה ב־SSH (אצלנו דרך Tailscale) — [WZ-IT](https://wz-it.com/en/blog/self-hosted-paas-comparison-coolify-dokploy-caprover/) **[משני]**.
- **Compose + Actions**: מקבל את כל ההגנות של GitHub. Environment ‏`production` עם מאשר חובה, סודות לפי סביבה ו־OIDC — [GitHub docs](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments) **[מאומת]**. הסיכון עובר ל־CI עצמו (CICD‑SEC‑4 "Poisoned Pipeline Execution", הרעלת הצינור, למשל דרך PR זדוני) — [OWASP CI/CD Top 10](https://owasp.org/www-project-top-10-ci-cd-security-risks/) **[מאומת]**. לכן: workflow של פריסה רק על `push` ל־main ולא על `pull_request_target`, וה־runner לא נמצא על שרת הייצור **[הסקה]**.

| | Coolify/Dokploy | Compose + Actions | Kamal |
|---|---|---|---|
| תהליך שרץ בשרת עם root/docker.sock | כן (הלוח) | לא (רק Docker) | לא (רק kamal-proxy) |
| ממשק ווב שאפשר לתקוף | כן (חובה מאחורי VPN) | לא | לא |
| רקורד CVE ‏2025–2026 | עשרות, ‏CVSS 9–10 | — (תלוי ב־GitHub/Docker) | לא נמצאו פרצות קריטיות בחיפוש **[פער]** |
| בקרת שינויים | בממשק (קשה לבקר) | PR + ruleset | PR + ruleset |
| מתאים לבעלים לא טכני | יותר | פחות (ה־AI כותב) | פחות |

### Inferences
- **[הסקה]** כש־AI כותב את הקוד והבעלים מאשר מהטלפון, **Compose + Actions** הוא הבחירה הבטוחה ביותר: כל שינוי עובר PR, בדיקות ואישור Environment. אין עוד מערכת עם root ועם ממשק שצריך לעדכן ולהגן עליה.
- **[הסקה]** אם הבעלים רוצה לוח "לראות מה רץ": לוח לקריאה בלבד (Uptime Kuma או Grafana) דרך Tailscale. זה עדיף על PaaS עם הרשאות פריסה.

### Gaps
- לא נבדק דף ה־advisories של Kamal/kamal-proxy, ולא דף האבטחה של Komodo.

---

## 6. מפת דרכים לאבטחה, לפי עדיפות

### Takeaway
**"עכשיו"** = כשעה–שעתיים של הבעלים ויום עבודה של ה־AI, וזה סוגר את רוב הסיכון. **"כשהשרת עולה"** = הקשחה, סביבות, ‏OIDC וגיבוי. **"כשהפרויקט גדל"** = דומיין ו־origin נפרד, ‏KMS, ‏SBOM וחתימות, ‏ASVS L2.

### Cited Findings
(המקורות לכל פריט מופיעים בסעיפים 3–5. כאן רק הסדר, המאמץ ומי עושה.)

**א. עכשיו (זול, השפעה גבוהה)**

| # | פעולה | מי | מאמץ |
|---|---|---|---|
| 1 | passkey או מפתח חומרה (2 יחידות) ל־GitHub, ‏Google, ‏Vercel ו־Anthropic. בדיקה שאין SMS כגיבוי | **הבעלים** | 1 שעה + כ־₪200–400 למפתחות [הסקה לגבי מחיר] |
| 2 | Ruleset על `main`: ‏PR חובה, בדיקות `tests` חובה, בלי force‑push ובלי עוקפים | הבעלים (‏AI מכין הוראות וצילומים) | 15 דק׳ |
| 3 | הסרת `Bash(git push origin HEAD:main)` מ־`.claude/settings.json` | AI (ב־PR) | 5 דק׳ |
| 4 | הפעלת Dependabot (security + version updates ל־Actions) ו־CodeQL | AI (קבצי `.github/`) + הבעלים מאשר | 30 דק׳ |
| 5 | ‏`IBKR_VAULT_KEY` ייעודי ב־Vercel (מנתק את הכספת מחשבון השירות) + כלי להצפנה מחדש | AI כותב את הכלי. **הבעלים** מזין את הסוד | 2–3 שעות |
| 6 | ‏`APP_KEY` + `CRON_SECRET` ב־Vercel (דרך צילומי מסך: CLAUDE.md §3 אומר "לא לנדנד". להציע פעם אחת עם ההסבר שזה חלק מהתוכנית) | הבעלים | 15 דק׳ |
| 7 | תקרות הוצאה: ‏Gemini Project Spend Cap, ‏Anthropic workspace limit, ‏GCP Budget alert | **הבעלים** | 20 דק׳ |
| 8 | ‏`firestore.rules` בריפו + בדיקות אמולטור ב־CI (בלי פריסה אוטומטית של החוקים בשלב הראשון) | AI. **הבעלים** מעתיק את החוקים הנוכחיים מהמסוף | חצי יום |
| 9 | ייצוא Firestore שבועי (גיבוי) | AI + הבעלים | 1–2 שעות [פער: דורש Blaze?] |
| 10 | קיבוע pip (גרסאות + hashes) ו־FFmpeg (גרסה + sha256) ב־`translator/` | AI | 2 שעות |
| 11 | נוהל "דליפת מפתח" (קובץ קצר, בלי סודות) + גיבוי לא מקוון של מפתח החתימה | AI כותב. **הבעלים** שומר את הגיבוי | 1 שעה |
| 12 | צמצום `contents: write` לרמת ה־job; ‏`connect-src` בלי `*.vercel.app` (רק כתובת השרתון) | AI | 30 דק׳ |

**ב. כשהשרת עולה**
- Tailscale ל־SSH ולכל הלוחות. חומת אש של הספק עם 443 בלבד. פורטים של Docker על `127.0.0.1`. בדיקת nmap מבחוץ. ‏unattended‑upgrades. (AI כותב, הבעלים מאשר. כיום עבודה.)
- **בלי PaaS**: ‏Compose + Actions עם Environment ‏`production` ומאשר חובה. ‏`staging` נפרד עם פרויקט Firebase נפרד, מפתחות AI נפרדים ונתוני דמו בלבד. (1–2 ימים.)
- OIDC: ‏GitHub Actions ← GCP, ו־Vercel ← GCP (WIF), ואז מחיקת מפתח חשבון השירות + `iam.disableServiceAccountKeyCreation`. (חצי יום–יום. דורש שינוי ב־`gauth.js`.)
- העובד בקונטיינר סגור: יציאה רק לרשימה, ‏`read_only`, ‏`cap_drop`, בלי shell למודל. המודל מקבל טקסט ומחזיר טקסט שנבדק. מחיקת קבצים בסוף עבודה. (2–3 ימים.)
- גיבוי עם Object Lock + בדיקת שחזור רבעונית. ניטור זמינות + התראות עלות. (חצי יום.)

**ג. כשהפרויקט גדל**
- דומיין משלכם → origin נפרד לאפליקציה (פותר את localStorage המשותף ומאפשר כותרות אבטחה). להעביר את טוקן IBKR רק לשרתון. (1–2 ימים + עדכון ALLOWED_ORIGINS, ‏OAuth ו־assetlinks.)
- KMS להצפנת הכספות. רוטציה מתוזמנת. ‏App Check.
- SBOM, חתימת images ‏(cosign), ‏provenance ‏(SLSA L2), ‏ASVS 5.0 L2 לשרתון.
- ניקוי ההיסטוריה הציבורית בריפו (CLAUDE.md §14) או מעבר לריפו פרטי לקוד השרת. **[שימו לב: ריפו פרטי בתוכנית חינמית מאבד את Environments עם מאשרים — ר׳ §4]**.
- אם יש משתמשים נוספים: מדיניות פרטיות, מחיקת חשבון מלאה, ויומן ביקורת לגישה לנתונים.

### Inferences
- **[הסקה]** פריטים 1–3 לבדם (כ־שעה וחצי) סוגרים את שני התרחישים החמורים ביותר: השתלטות על חשבון ו־push ישיר לייצור. **הם צריכים לבוא לפני כל עבודה על השרת החדש.**
- **[הסקה]** מה שרק הבעלים יכול לעשות: מפתחות חומרה, ‏ruleset, הזנת סודות ב־Vercel/GCP, תקרות הוצאה, העתקת חוקי Firestore מהמסוף ושמירת גיבוי מפתח החתימה. כל השאר — ה־AI ב־PR, באישור הבעלים.

### Gaps
- לא נבדק אם ייצוא מתוזמן של Firestore דורש מעבר לתוכנית Blaze (בתשלום). לבדוק לפני פריט 9.
- מחירי מפתחות חומרה בישראל לא נבדקו.
- לא נבדק בפועל אם Vercel Hobby מאפשר OIDC ל־GCP. התיעוד אומר "all plans", אבל לפי תקציר בלבד.
