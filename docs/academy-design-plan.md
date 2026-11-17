# Academy בזכוכית — תוכנית (17/11/2026)

**המטרה**: להעביר את Academy לשפת הזכוכית של Invest (2.166.0). **המבנה זהה** — אותם מסכים, כפתורים וחוגה; רק חומר, טיפוגרפיה וניקיון. הייחוס "לפי ת־עיצוב" (שם המוצר רק ב־`docs/standards.md`). המחקר: `docs/research/studio-academy-design/02-academy-books.md`.

## התצוגה המקדימה (שלב 1)
- Artifact: https://claude.ai/artifact/5LvwfenxRniUZRYwMgkPMX — `academy.html` האמיתי ב־iframe, fetch מדומה ו־17 ספרי EPUB מקוריים לדמו (בלי נתונים אמיתיים), בלי CSP ובלי frame-busting.
- שכבת ההצעה `@layer invglass` עם `html.ap-*` לכל פריט; מתג היום/מוצע, בהיר/כהה, זכוכית מוצקה/שקופה; ניווט אוטומטי לכל פריט.
- ההחלטות ב־db של ה־Artifact (`decisions/<ap-id>` = `{v: yes|maybe|no, note, t}`).
- המקורות בסקרץ׳ של הסשן (`pv/`): `gen.js` (EPUB), `covers.js`, `build.sh`, `live/pv-mock.js`, `live/pv-ap.css`. ספרי הדמו מוגשים כ־`.epub.b64.txt` (ה־Artifact לא מגיש epub).

## 20 הפריטים
1 חומר · 2 הדר · 3 חוגה · 4 חיפוש · 5 צ'יפים · 6 להמשיך לקרוא · 7 כריכות · 8 אוספים · 9 דף ספר · 10 כרטיסי תובנות · 11 סרגלי הקורא · 12 גיליונות · 13 בוררים · 14 ערכות · 15 בועת הדגשה · 16 מה למדתי · 17 הגדרות · 18 תפריט · 19 הודעה קופצת · 20 לחיצה גמישה.

## היישום (שלב 2 — רק אחרי אישור)
- `academy-glass.css` רק ב־`academy.html`: שכבה `acglass` מוצהרת ראשונה (`@layer acglass, glassbtn;` כמו `invglass`), `!important` בתוך השכבה כדי לגבור על `glass-btn.css`. בוררים מוגבלים ל־`.lib-root`/`.rd`/`.lib-sheet`/`.appbar` של Academy — לא לגעת ב־Studio.
- רק הפריטים שאושרו, בלי מחלקות `ap-*` (ישירות).
- `tests/academy-glass.test.js` (כמו `invest-glass.test.js`): השכבה ראשונה, הקובץ רק באקדמיה, אין שמות מותג, יש reduced-motion.
- coregen/swgen, `APP_RELEASE` MINOR, CHANGELOG, יומן, PR אחרי `git merge origin/main` ובדיקת PR פתוחים. פריסה רק באישור.

## לקחים מהתצוגה
- הנבחר בחוגה = `.tab[aria-selected="true"]`; בועת ההדגשה היא `.tr-card` (דרך `show-annotation`), לא `.rd-pop`.
- "הספרייה שלי" ריקה מציגה את שדה הקובץ רק בתוך `label.bk-cta`.
- `cover.r` = רוחב/גובה (ספר עומד ≈ 0.667).
