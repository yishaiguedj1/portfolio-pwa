KLineChart 10.1.0 (https://github.com/klinecharts/KLineChart) — Apache-2.0.
הקובץ klinecharts.min.js = dist/umd/klinecharts.min.js מחבילת npm klinecharts@10.1.0 כפי שהוא (רק שורת sourceMappingURL הוסרה), עם שני שינויים קטנים (27/10/2026, "תנועה בדיוק כמו TradingView"), מסומנים גם בראש הקובץ:
1. `tapEvent`: הקשה במגע לא פותחת צלב, רק מסתירה אותו. הצלב מופיע בלחיצה ארוכה (`longTapEvent`), כמו ב־TradingView וב־Apple Stocks.
2. `pinchEvent`: הזום בצביטה הוא `10*(e/prev-1)` במקום `5*(e-prev)`. כך רוחב הנר מוכפל ביחס האצבעות, 1:1. קודם הוא זז בחצי מהקצב.
בעדכון גרסה של הספרייה — להחיל שוב (`tests/chart.test.js` בודק).
נטען רק מ־chart.js (גרף הנרות) בלחיצה על "גרף נרות".
