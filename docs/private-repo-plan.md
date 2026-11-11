# הפיכת הריפו לפרטי — בלי תוספת כסף ובלי לאבד יכולת (תוכנית, 11/11/2026)

בקשת המשתמש (11/11/2026): "שהכל יעבוד כמו היום או אפילו טוב יותר, בלי להוסיף כסף". מה שהיום נשען על ריפו ציבורי עובר לשרת שלנו (Hetzner) או ל־R2.
**ההיפוך עצמו (Settings ← Change visibility) — רק בסוף, אחרי שכל הגלים פרוסים והטלפון אישר.**

## 1. מה נשבר בריפו פרטי (נבדק 11/11/2026)
| # | תלות | איפה בקוד | בפרטי |
|---|---|---|---|
| 1 | דקות Actions | כל `.github/workflows/` | נמדד: ~8,700 דקות־קיר ב־11 ימים (בלי `upgrade` שכבר הסתיים: ~5,100 → **~14 אלף לחודש**). פרטי חינם = 2,000. מעבר = ‏$0.006/דקה (לינוקס, מחירי 1/2026) → **~$70+ לחודש** |
| 2 | שער האישור (Required reviewers ב־Environment `production`) | `deploy`, `worker-image`, `app-image`, `server`, `hostfix` | Free/Pro/Team — **רק בריפו ציבורי**; בפרטי רק Enterprise. ב־Free פרטי אין Environments בכלל (גם לא סודות לפי סביבה) → בלי תחליף, פריסות לייצור ירוצו **בלי אישור** |
| 3 | הורדות מ־Releases | `android-latest` (APK ×7 + תוסף Chrome, ~294MB), `lab-models` (~1.1GB), `fund-audit` | Releases של ריפו פרטי דורשים התחברות → נשברים: `Upd.kt` (עדכון עצמי), `DmBridge.kt`, `BrChrome.kt`, `PhModels.kt`, הקישורים ב־`index.html`/`app.js`(core)/`shell.js`/`studio.js`/`admin-app.js`, `ibkr-proxy/lib/fundaudit.js` |
| 4 | קריאות לא מאומתות מהשרתון | `ibkr-proxy/api/studio.js` (גרסת העובד ~ש׳1818, `משימות-פתוחות.md` ~ש׳3227), `ibkr-proxy/ignore-build.sh` | 404. (`aoJson` כבר שולח `GITHUB_TOKEN`) |
| 5 | `translator/setup.sh` מ־raw | `translator/setup.sh`, ההוראה ב־`studio.js` | 404 |
| 6 | אימג'ים ב־GHCR | `worker-image.yml`, `app-image.yml`, `infra/host/snb-common.sh` | חבילה פרטית: 500MB חינם בלבד (האימג'ים גדולים בהרבה). להשאיר ציבורית = **הקוד שבתוך האימג' חשוף** — סותר את המטרה |
| 7 | GitHub Pages (`yishaiguedj1.github.io/portfolio-pwa/`) | `deploy.yml` (job `deploy`), `move.js` | Pages מריפו פרטי דורש Pro → כתובת ההעברה הישנה נעלמת |
| 8 | CodeQL, סריקת סודות + push protection | `codeql.yml` | בפרטי — רישיון בתשלום |
| — | **עובד כרגיל** | Cloudflare (Direct Upload), Vercel Hobby (חשבון אישי), Firebase, R2, Hetzner, Dependabot, סשנים ו־Routines של Claude (GitHub App) | — |

עובדות נוספות: 0 מזלגות, 0 כוכבים. אין כללי הגנת ענף (אין מה לאבד). **קוד האתר (JS/HTML) ממילא יורד לכל דפדפן** — הפרטיות מכסה את השרתון, העובד, הכלים, `docs/`, היומן וההיסטוריה. מה שכבר היה ציבורי (היסטוריה) — ייתכן שנשמר בארכיונים חיצוניים; סוד שנכנס אי־פעם ל־git — מסובבים בכל מקרה.

## 2. ההחלטות (המלצה)
- **CI על השרת שלנו**: runner של GitHub (self-hosted) ב־Docker על Hetzner. לפי תיעוד החיוב של GitHub — **חינם** (חיוב של ‏$0.002/דקה על self-hosted בריפו פרטי הוכרז ל־3/2026 ו**נדחה בלי תאריך**; נכון ל־11/2026 לא חל). אם יחול: ~14K דקות → ~$28 לחודש → עוברים לתוכנית ב׳ (§3, גל 3ב) — CI משלנו בלי Actions.
- **הורדות** → R2, דלי ציבורי לקריאה `snb-dl` בדומיין `dl.thesnowball.app` (תעבורה יוצאת חינם; ~1.4GB מתוך 10GB חינם — לבדוק קודם את הניצול הנוכחי של R2; אם צפוף — מהשרת, `api.thesnowball.app/dl/…`, 20TB תעבורה כלולים).
- **אימג'ים** → נבנים **בשרת עצמו** (הצרכן היחיד), בלי registry: תגיות מקומיות `prod`/`staging`/`prev` + digest. מהיר יותר מהיום (בלי דחיפה ומשיכה של GB).
- **שער האישור** → כפתור "אשר פריסה" במרכז הניהול: השרתון (אדמין בלבד, `hasEmail`, נרשם ביומן) מפעיל `workflow_dispatch` של שלב הייצור עם ה־SHA שעבר staging. התראה לטלפון כבר קיימת; המגדל כבר רואה ריצות ממתינות (`aoFacts`).
- **github.io** → ריפו ציבורי קטן `yishaiguedj1.github.io` (נראה שכבר קיים — `/.well-known/assetlinks.json` עונה 200) מקבל `portfolio-pwa/` עם דף העברה בלבד (`move.js` + SW שמעביר) — בלי קוד האפליקציה.
- **אבטחת קוד בחינם** → `gitleaks` (MIT) ב־CI וב־`tools/t.sh`; `eslint-plugin-security` (Apache-2.0) או Opengrep (LGPL) במקום CodeQL; `privacy-guard`/`xss-guard` נשארים.
- **מתג חירום**: כל workflow — `runs-on: ${{ vars.SNB_RUNNER || 'ubuntu-latest' }}`. השרת למטה → מחליפים משתנה אחד וחוזרים ל־GitHub (2,000 הדקות החינמיות כגיבוי).

## 3. הגלים (PR לכל גל; הכל בזמן שהריפו עוד ציבורי — שום דבר לא נשבר בדרך)
0. **הכנה**: ניצול R2 ודיסק השרת; טוקן GitHub fine-grained `THE SNOWBALL GitHub [prod]` לריפו הזה בלבד (Contents: read, Actions: read/write, Administration: read/write לרישום runner, Metadata) — מוצפן ב־`lib/vault.js` בשרת ו־`GITHUB_TOKEN` ב־Vercel; לברר אילו סודות מוגדרים ברמת Environment ולהעביר לרמת הריפו.
1. **הורדות ל־R2**: `android.yml`/`lab-models.yml`/`fund-audit.yml` מעלים גם ל־`snb-dl` (בתקופת המעבר גם ל־Releases); כל הקישורים (§1 שורה 3, ושורה 5) לכתובת החדשה; `Upd.kt` בודק את הכתובת החדשה עם נפילה לישנה. **כל האפליקציות המותקנות חייבות להתעדכן לגרסה הזו לפני ההיפוך** (גרסה ישנה מחפשת עדכון ב־Releases).
2. **השרתון**: `GITHUB_TOKEN` לכל קריאה ל־`api.github.com`/raw (`studio.js`, `ignore-build.sh`); בדיקות.
3. **CI בשרת**: runner ephemeral בקונטיינר (משתמש נפרד, בלי docker socket, `--cpus` מוגבל ועדיפות CPU נמוכה — התרגום קודם; ראו `docs/studio-parallel-plan.md`), תווית `snb`; runner שני `snb-build` עם Docker רק לבניית אימג'ים מ־main. מתג `SNB_RUNNER`. תזמונים (`studio-watch`, `fund-audit`, `damodaran`, `stock-universe`, `autobuy`) — על ה־runner או cron בשרת. **יעד: פחות מ־300 דקות hosted בחודש** (נמדד עם אותו סקריפט: runs × זמן).
   3ב (רק אם GitHub יתחיל לחייב self-hosted): CI משלנו — webhook לשרתון → בדיקות בקונטיינר → commit status דרך ה־API (חינם גם בפרטי).
4. **אימג'ים בשרת**: `worker-image`/`app-image` בונים על `snb-build`; `snb-common.sh` עובר לתגיות מקומיות; rollback מקומי; עדכון `translator/tests/test_infra.py`, `tests/server-hostfix.test.js`.
5. **שער האישור באפליקציה**: שלבי הייצור → `workflow_dispatch` עם `sha`; כפתור במרכז הניהול + בדיקה שה־SHA הוא האחרון שעבר staging; הסרת `environment:` מה־workflows; `tools/wait-ci.sh --deploy` וסעיף 8 ב־CLAUDE.md מתעדכנים ("Review deployments" → הכפתור).
6. **github.io**: דף העברה בריפו `yishaiguedj1.github.io`; הסרת job ה־Pages מ־`deploy.yml`.
7. **אבטחת קוד**: gitleaks + eslint-security; הסרת `codeql.yml` (רק בגל 8, כדי לא לאבד כיסוי לפני).
8. **ההיפוך**: צ'קליסט — כל ה־APK עודכנו בטלפון; הורדות מ־`dl.` עובדות; 3 ימים CI ירוק על השרת; פריסה מלאה אחת דרך הכפתור; אז Change visibility → מיד: בנייה ב־Vercel, פריסה ל־Cloudflare, עדכון עצמי של APK, Routine של הסטודיו, סשן Claude חדש, ריצת `fund-audit`, ודקות hosted בחודש הראשון.

## מצב (11/11/2026)
- **גלים 1–2 — נבנו** (ענף `ccr-be65b3de-1isos1`): `tools/dl-put.sh` (R2 דרך S3, בלי מפתחות = אזהרה ויציאה 0; `DL_REQUIRED=1` אחרי ההיפוך); `android.yml`/`lab-models.yml` מעתיקים ל־`dl.thesnowball.app`, `fund-audit.yml` ב־job נפרד (הבדיקה הלילית נשארת בלי סודות); `Upd.kt` (`BASES`: R2 ← GitHub, ההורדה מאותו מקור של `latest.json`), `PhModels.kt` (לסירוגין, הטביעה מאמתת), `fundaudit.js` (`SRCS`); השרתון — `ghHdr` לכל קריאה ל־GitHub, `ignore-build.sh` עם הטוקן. בדיקה: `tests/private-repo.test.js`.
- **מה שהמשתמש מגדיר פעם אחת** (גל 0): דלי R2 `snb-dl` + דומיין `dl.thesnowball.app` + טוקן R2 לדלי בלבד → הסודות `DL_R2_ACCESS_KEY_ID`/`DL_R2_SECRET_ACCESS_KEY`; ‏`GITHUB_TOKEN` (fine-grained, קריאה) ב־Vercel ובשרת (`PROD_APP_EXTRA`).
- **עוד לא**: הקישורים הגלויים (`index.html`, `app.js`/core, `shell.js`, `studio.js`, `admin-app.js`, `DmBridge.BROWSER_APK`, `BrChrome.EXT_ZIP`) עוברים ל־`dl.` רק אחרי שהדלי מאומת חי (PR קטן); `translator/setup.sh` — בגל 3; גלים 3–8.

## 3א. ⛔ אין נעילה בחוץ (דרישת המשתמש 11/11/2026, "מאוד חשוב")
שני כללים, נאכפים בבדיקה (`tests/no-lockout.test.js`, נבנית בגל 5):
1. **לכל פעולת ייצור (פריסה, אישור, תיקון שרת, החזרה לאחור) — לפחות שני מסלולים בלתי תלויים, ואחד מהם לא נשען על שום מערכת שלנו** (רק GitHub או הקונסולה של הספק).
2. **מסלול התיקון של מערכת X לעולם לא תלוי ב־X.** תיקון השרת לא רץ על השרת; תיקון מרכז הניהול לא עובר דרך מרכז הניהול.

ההגנה העיקרית — **האישור הוא `workflow_dispatch` עצמו**: שלב הייצור רץ רק כשמישהו עם הרשאת כתיבה (בריפו פרטי — רק אתה) מפעיל אותו. בלי קלט חובה: ברירת המחדל = ה־SHA האחרון שעבר staging. הכפתור במרכז הניהול הוא **רק קיצור דרך** לאותה הפעלה, לא השער עצמו.

| מה קרס | מה עדיין עובד |
|---|---|
| מרכז הניהול / השרתון (Vercel) / ההתחברות (Firebase) | GitHub, מהטלפון: Actions ← `deploy-prod` ← Run workflow (כמו "Review deployments" היום) · או לבקש מסשן Claude (כלי `actions_run_trigger`) |
| השרת שלנו (Hetzner) — ה־runner לא זמין | **פריסת האתר ל־Cloudflare ו־`hostfix`/`server` רצות תמיד על `ubuntu-latest`** (כמה דקות בחודש, בתוך 2,000 החינמיות) — לא תלויות בשרת. בדיקות ושאר הזרימות: המשתנה `SNB_RUNNER=ubuntu-latest` (Settings ← Variables, מהטלפון) מחזיר הכל ל־GitHub. תיקון/בנייה מחדש של השרת: `hostfix`/`server` (הסוד `HCLOUD_TOKEN` שמור ב־GitHub, לא רק בשרת) או הקונסולה של Hetzner (Rescue, Snapshot) |
| השרת אבד לגמרי | בנייה מחדש מאפס: `server.yml` על `ubuntu-latest`; הטוקן לשיבוט הריפו הפרטי ושאר סודות האתחול — ב־GitHub Secrets (עותק נאמנות), לא רק ב־vault שעל השרת; האימג'ים נבנים מחדש מהריפו |
| R2 | עדכון ה־APK: `Upd.kt` עם רשימת מקורות (R2 ← עותק בשרת); בדיקה ידנית: קישור ישיר מהשרת |
| הטוקן של GitHub בשרת פג/בוטל | רק הכפתור נופל; מסלול GitHub עובד. התראה במגדל 30 יום לפני תפוגה |
| גרסה שבורה עלתה לאתר | החזרה בלחיצה בקונסולה של Cloudflare (Deployments ← Rollback) — בלי GitHub ובלי מערכות שלנו |
| GitHub עצמו למטה | האתר והשרת ממשיכים לרוץ; החזרה לאחור — דרך Cloudflare; פריסה חדשה מחכה (התקלות של GitHub קצרות) |
| גישה לחשבון GitHub (2FA) | קודי השחזור של GitHub שמורים אצלך מחוץ לטלפון — חובה, בצ'קליסט של גל 8 |

הבדיקה אוכפת: הזרימות `deploy-prod`, `hostfix`, `server` ו־job הפריסה ל־Cloudflare — `runs-on: ubuntu-latest` מילולי (לא דרך `SNB_RUNNER`); ל־`deploy-prod` יש `workflow_dispatch` בלי קלט חובה; אף זרימת ייצור לא דורשת קריאה לשרתון כדי לרוץ. לפני ההיפוך (גל 8) — **תרגיל**: פריסה אחת דרך GitHub בלבד, וכיבוי ה־runner להפעלה אחת כדי לראות שהמתג עובד.

## 4. "טוב יותר מהיום"
בנייה ובדיקות על 16 ליבות עם מטמון חם; פריסת עובד בלי registry (דקות במקום עשרות); אישור פריסה בלחיצה אחת באפליקציה; הורדות מהדומיין שלנו; הקוד, `docs/` והיומן לא חשופים.

## 5. מקורות (11/11/2026)
- דחיית החיוב על self-hosted: theregister.com/2025/12/17/github_charge_dev_own_hardware · devclass.com (17/12/2025) · tenki.cloud/blog/github-actions-runner-pricing-2026
- Required reviewers בפרטי: docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
