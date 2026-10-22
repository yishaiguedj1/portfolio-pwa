# הניטור של הסטודיו — Cloudflare Worker

כל 10 דקות קורא ל־`GET /api/studio` בשרתון: שרת שנפל, "המשך" אוטומטי, בדיקת הכתובות, הגיבוי היומי, האצווה של מאגר הלמידה.
ה־cron של GitHub (`studio-watch.yml`) רץ בפועל פעם ב־3–4 שעות, ולכן הניטור עבר לכאן. הקובץ ב־GitHub נשאר כגיבוי.

## הקמה בממשק (פעם אחת, מהטלפון)
1. dash.cloudflare.com → Workers & Pages → Create → Create Worker (Start with Hello World).
2. השם: `snb-studio-watch` → Deploy.
3. Edit code → למחוק הכל ולהדביק את `worker.js` → Deploy.
4. Settings → Trigger Events → Add → Cron Triggers → `*/10 * * * *` → Add.
5. בדיקה: לפתוח את הכתובת של ה־Worker — צריך לחזור `"status":200`.

עלות: חינם (Workers Free — 100 אלף בקשות ביום; כאן 144).
