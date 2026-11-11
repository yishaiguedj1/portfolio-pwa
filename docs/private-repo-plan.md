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

## 4. "טוב יותר מהיום"
בנייה ובדיקות על 16 ליבות עם מטמון חם; פריסת עובד בלי registry (דקות במקום עשרות); אישור פריסה בלחיצה אחת באפליקציה; הורדות מהדומיין שלנו; הקוד, `docs/` והיומן לא חשופים.

## 5. מקורות (11/11/2026)
- דחיית החיוב על self-hosted: theregister.com/2025/12/17/github_charge_dev_own_hardware · devclass.com (17/12/2025) · tenki.cloud/blog/github-actions-runner-pricing-2026
- Required reviewers בפרטי: docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
