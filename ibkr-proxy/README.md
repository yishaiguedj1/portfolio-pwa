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
- `GET /api/flex-statement?token=..&code=..`
  → `{ ok:true, status:'pending' }` עד שהדוח מוכן,
  → `{ ok:true, status:'ready', data:{...} }` כשמוכן.

## מבנה data
`{ meta, trades[], positions[], cashTransactions[], nav, cashBalances[] }`

## אבטחה
- הטוקן של Flex הוא לקריאה בלבד (אי אפשר לסחור דרכו) וניתן לביטול בפורטל.
- הגבלת קצב בסיסית לפי IP כלולה בקוד.
