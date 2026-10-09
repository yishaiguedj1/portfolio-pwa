# אבטחה — THE SNOWBALL

הקובץ הזה מפרט איפה כל סוד נמצא, מה הוא פותח, ואיך מחליפים אותו. הערכים עצמם לא מופיעים כאן ולא בשום מקום בריפו. הריפו ציבורי, והאתר מפרסם את כולו.

**דיווח על בעיית אבטחה:** דרך GitHub ← Security ← Report a vulnerability (דיווח פרטי). לא ב־issue פתוח.

## העיקרון

אף אדם, מפתח או שינוי בקוד לא מגיע לבד לסביבת האמת או לנתונים:
- **הטלפון** מחזיק רק את ההתחברות שלו. מפתחות, טוקנים והרשאות קבועות נמצאים רק בשרתון, מוצפנים בכספת (`lib/vault.js`, ‏AES-256-GCM).
- **השרת (Hetzner)** לא פותח אף פורט. הוא מריץ רק קופסה חתומה שאישרת (`infra/README.md`).
- **Firestore:** הטלפון ניגש רק למסמך שלו (`firestore/firestore.rules`).

## רשימת הסודות

| הסוד | איפה | מה הוא פותח | החלפה |
|---|---|---|---|
| `GDRIVE_SA_KEY` | Vercel | חשבון השירות: Firestore (כל המסמכים) ותיקיית הספרייה ב־Drive | Google Cloud ← IAM ← Service accounts ← Keys: מפתח חדש ← Vercel ← Redeploy ← למחוק את הישן. **אם `IBKR_VAULT_KEY` לא מוגדר, הכספות מוצפנות במפתח שנגזר מזה** — קודם להגדיר את `IBKR_VAULT_KEY` (בשורה הבאה) |
| `IBKR_VAULT_KEY` | Vercel (מומלץ להגדיר) | מפתח ההצפנה של הכספות (IBKR, ‏Drive, ‏Routine) | אחרי החלפה הכספות הישנות לא נפתחות. משתמשים מתחברים מחדש (IBKR, ‏Drive, ‏Routine). לא להחליף בלי סיבה |
| `GDRIVE_CLIENT_ID/SECRET` | Vercel | חיבור Drive של הספרייה (OAuth) | Google Cloud ← Credentials ← Reset secret ← Vercel ← Redeploy |
| `STUDIO_GDRIVE_CLIENT_ID/SECRET` | Vercel | חיבור Drive של הסטודיו (לקוח נפרד) | כמו בשורה הקודמת |
| `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `GOOGLE_BOOKS_KEY` | Vercel | תרגום, ניתוח מכתבים, פרטי ספרים | יוצרים מפתח חדש אצל הספק ← Vercel ← Redeploy ← מוחקים את הישן |
| `CRON_SECRET` | Vercel (רשות) | הפעלת הסנכרון היומי של IBKR | מחרוזת אקראית חדשה ← Vercel |
| `ANTHROPIC_API_KEY` | השרת בלבד (`/etc/snb/worker.env`, נכנס דרך "קוד ההקמה" — גם במטא־דאטה של Hetzner, רק ל־root בשרת). Workspace `snowball` עם תקרה, תוקף כ־3 חודשים | Claude במצב "API של המערכת" | Console של Anthropic ← מפתח חדש ← שרת חדש עם קוד הקמה חדש (או `snb-setup`) ← מחיקת הישן ב־Console |
| טוקן השרת | השרת (`worker.env`, דרך קוד ההקמה), בשרתון רק hash | לקחת עבודות מהתור | באפליקציה: מסך השרת ← הסרה ← הוספת שרת ← קוד הקמה חדש |
| מפתח עבודה | נוצר לכל הפעלה, בשרתון רק hash, תקף 48 שעות | עבודה אחת | מתחלף לבד |
| מפתח ה־Routine | כספת בשרתון (`studioVault`) | הפעלת ה־Routine | claude.ai ← הטריגר ← מפתח חדש ← בסטודיו "הגדרה מחדש" |
| token ו־Query ID של IBKR | כספת בשרתון (`ibkrVault`) | דוחות Flex | IBKR ← Flex Web Service ← טוקן חדש ← באפליקציה: ניתוק וחיבור |
| `SNOWBALL_KEYSTORE_B64` + `SNOWBALL_KS_PASS` | GitHub Secrets | חתימת אפליקציית האנדרואיד | **אי אפשר להחליף בלי להתקין מחדש.** חובה גיבוי לא מקוון של קובץ המפתח והסיסמה |

## מה רק אתה יכול לעשות

1. **מפתחות כניסה (Passkeys) או אימות דו־שלבי בכל החשבונות:** Google, ‏GitHub, ‏Vercel, ‏Hetzner, ‏Anthropic, ‏IBKR.
2. **כלל הגנה על `main`** (GitHub ← Settings ← Rules): PR חובה ובדיקות ירוקות חובה, בלי חריגים.
3. **להעלות את כללי Firestore** לקונסולה (`firestore/README.md`).
4. **להגדיר `IBKR_VAULT_KEY` נפרד** ב־Vercel: 32 בתים אקראיים, למשל `openssl rand -base64 32`.
5. **גיבוי לא מקוון** של מפתח החתימה של האנדרואיד.
6. **תקרת הוצאה חודשית** ב־Console של Anthropic.
7. **לאשר או לדחות** את ההרשאה המוגדרת מראש לדחוף ישירות ל־`main` (`.claude/settings.json`).

## שומרים אוטומטיים

- **ב־CI:**
  - `tests/privacy-guard.test.js`: מספרי חשבון, טוקנים ומפתחות בקבצים.
  - `tests/xss-guard.test.js`.
  - `tests/csp.test.js`.
  - `tests/security-stage4.test.js`: הגנה מהטמעה באתר זר, ‏SSRF, ‏PKCE, אימות הווידג׳ט, ותיקון כל action ל־SHA.
  - `firestore-rules`: בדיקת הכללים מול האמולטור.
  - `translator/tests/test_infra.py`: הקשחת השרת.
- **CodeQL:** סריקת קוד בכל PR ופעם בשבוע.
- **Dependabot:** עדכוני כלים ותמונת הבסיס של העובד, כ־PR שמחכה למיזוג.
