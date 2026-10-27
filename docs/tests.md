<!-- הועבר מ־CLAUDE.md ב־27/10/2026 (פרויקט חיסכון הטוקנים). נטען רק כשעובדים על הנושא. לקח חדש בנושא — כאן, לא ב־CLAUDE.md. -->

# בדיקות — פירוט

## 7. בדיקות

- `node --check app.js` תמיד לפני push. **הדחיפה מותנית בבדיקות** — בשרשור פקודות: `[ "$fails" = 0 ] && git push` (לקח v252: `;` אחרי הבדיקות דחף קוד עם בדיקה אדומה). **גם צינור מסתיר כשל**: `node tests/run.js | tail` = קוד היציאה של `tail` (קרה שוב ב־04/10/2026 בבדיקות השרתון) — להריץ לקובץ, `rc=$?`, ורק `[ $rc = 0 ] && git push`. קוד שנוגע ב־`window`/`document` — עם שמירה (`typeof window !== 'undefined' && window.addEventListener`), הבדיקות רצות ב־vm בלי DOM מלא.
- `node tests/ibkr-app.test.js` — לוגיקת IBKR/קצב/עומק/הודעות (205 אסרטים, כולל שמירה שה־CSV לא חוזר). `node tests/pf-v125.test.js` (41) — גרף/טווחים/NAV יומי. `pf-v126.test.js` (10) — טולטיפ מול מדידה. `pf-v127.test.js` (18) — יום כפול בסנכרון המשך.
- `node tests/pf-v110.test.js` (28), `pf-v111.test.js` (19) — רגרסיות סנכרון; `pf-v112.test.js` (61) — מנוע התשואות על נתוני דוח סינתטיים.
- `node tests/i18n-coverage.test.js` (711) — כל מחרוזת גלויה בעברית **ובאנגלית**.
- `node tests/ui-v193.test.js` (≈45) — ביצועים ומעברים: ציור רק של הטאב הנראה, מפתח ציור לעוגה, אתחול מיידי, רשת, SW, אנימציות.
- `node ibkr-proxy/tests/run.js` (62) — שרתון.
- `node tools/deploy-guard.js <base> <head>` — שומר הפריסה על PR (ב־CI אוטומטי, סעיף 11).
- הכל: הלולאה ב־`.github/workflows/test.yml` (אין `tests/run-all.sh` בריפו). בדיקות תאימות `CACHE_NAME`↔`APP_VERSION` — דרך `tests/_swver.js` (`swVersionOk`). מ־v394 הן תמיד שוות (swgen כותב את שתיהן מאותו מקום); הסובלנות לגרסה אחת אחורה נשארה מהפרוטוקול הדו־שלבי ולא מזיקה. **`tests/swgen.test.js` = השומר**: `sw.js` לא מעודכן לקבצים = אדום. בדיקת גרסה חדשה — רק דרך `swVersionOk`.
- מוסכמה: בבדיקות multi-chunk מעבירים `{ chunkGapMs: 5 }` — זה מחליף את כל הקצב (בלי מגביל, בלי המתנת poll ראשונה). לבדיקת קצב אמיתי: `{ limiter: ibkrMakeLimiter({now, sleep}), sleep }` עם שעון מדומה.
- 13 קבצי בדיקות מורשתיים מוחרגים מ־CI (רשימה ב־`.github/workflows/test.yml`): בודקים פונקציות/אלמנטים שהוסרו בריפקטורים (`buildTradesHistory`, `navToTwr`, `ibkrInceptionDate`, `ibkrNavHistory`, `ibkrPerfSums`, `ibkrChunks`). נשמרים כהיסטוריה; החייאה = כתיבה מחדש.
