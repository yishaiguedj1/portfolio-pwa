# IBKR Flex Proxy

שרתון stateless זעיר שמתווך בין אפליקציית התיק (PWA סטטית) לבין
IBKR Flex Web Service. הוא **לא שומר שום סוד** — הטוקן ומזהה השאילתה
מגיעים בכל בקשה מהמשתמש, ומועברים הלאה ל־IBKR.

## למה צריך אותו?
- הדפדפן לא יכול לקרוא ישירות ל־IBKR (אין CORS).
- הטוקן לא צריך לשבת בקוד האפליקציה.

## פריסה (Vercel, חינם)
1. להיכנס ל־[vercel.com](https://vercel.com) ולפתוח חשבון.
2. ‎"Add New → Project" → לייבא את הריפו `portfolio-pwa`.
3. **חשוב:** בהגדרות הפרויקט → ‎"Root Directory"‎ לבחור `ibkr-proxy`.
4. Deploy — אין צורך במשתני סביבה.
5. בסוף מקבלים כתובת כמו `https://portfolio-ibkr-proxy.vercel.app` —
   אותה מדביקים באפליקציה בהגדרות ← חיבור ברוקר.

## API
- `POST /api/flex-request` עם `{ token, queryId }`
  → `{ ok:true, referenceCode }` (או `{ ok:false, error }`)
- `POST /api/flex-statement` עם `{ token, code, statementUrl? }`
  (POST בלבד — הטוקן לעולם לא ב־URL; `GET` מחזיר 405).
  `statementUrl` הוא ה־`<Url>` ש־SendRequest מחזיר — מתקבלים רק שרתי IBKR
  הידועים (`ndcdyn`/`gdcdyn.interactivebrokers.com`), אחרת משתמשים בברירת המחדל.
  → `{ ok:true, status:'pending' }` עד שהדוח מוכן,
  → `{ ok:true, status:'ready', data:{...} }` כשמוכן,
  → `{ ok:false, error }` בשגיאה.

## מבנה data
`{ meta, trades[], positions[], cashTransactions[], nav, cashBalances[] }`

## אבטחה
- הטוקן של Flex הוא לקריאה בלבד (אי אפשר לסחור דרכו) וניתן לביטול בפורטל.
- **Origin מאושר בלבד**: השרתון עונה רק לבקשות מ־`https://yishaiguedj1.github.io`
  (ומ־`localhost` לבדיקות). בקשה מאתר אחר או בלי Origin (curl) → 403 `forbidden_origin`.
- **מפתח אפליקציה (מומלץ)**: משתנה סביבה `APP_KEY` ב־Vercel (Settings → Environment
  Variables → Redeploy). כשהוא מוגדר, כל בקשה חייבת כותרת `X-App-Key` זהה, אחרת 401
  `bad_app_key`. באפליקציה: הגדרות → חיבור ברוקר → הגדרות חיבור → "מפתח שרתון".
  בלי `APP_KEY` — לא נבדק (כדי שהשרתון לא יישבר לפני ההגדרה).
- קלט מוגבל: token עד 64 ספרות, Query ID עד 12 ספרות, גוף עד 4KB.
- הגבלת קצב בסיסית לפי IP (best effort — ב־serverless כל מופע סופר לבד).
