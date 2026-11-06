# החשבונות וההתחברות אצלנו — שלב 2 בתוכנית העצמאות מ־Firebase

נבנה מ־6/11/2026. התוכנית: `תוכנית-עצמאות-מ-Firebase.md`, "שלב 2". הבדיקות: `tests/accounts.test.js`.

## המבנה
- **`ibkr-proxy/lib/accounts.js`** — טבלת החשבונות. `snbAcc/{uid}`: רשומה מוצפנת כולה (`vault.seal`, AAD `snb-acc|uid`) עם `em` (מיילים מאומתים), `g` (מזהי Google), `pw` (scrypt), `ct`, `lt`. ‏`snbAccIx/{id}`: אינדקס, id = HMAC של `g|sub` / `e|מייל` במפתח `vault.derive('snb-acc-ix/v1')`, והתוכן מוצפן (AAD `snb-accix|id`).
- הגישה דרך Firestore REST. בשרת שלנו האוספים נענים מהמסד (`ldb`), ו־Firestore מקבל עותק. בכללים אין להם הרשאה לטלפון.
- **אותו uid של Firebase.** חשבון לא מוכר → `fbadmin.lookup` (לפי מייל או `federatedUserId` של Google). "אין כזה" → uid חדש של 28 תווים, ו־Firebase יוצר את המשתמש ב־`signInWithCustomToken`. Firebase לא עונה → שגיאה, לא חשבון חדש.
- הפעולות ב־`lib/session.js` (רק בשרת שלנו, `SERVER_ONLY`; ב־Vercel אין אותן, והטלפון ממשיך עם Firebase):
  - `accReg {idToken}` — רישום שקט מכל טוקן Firebase מאומת (גם לא טרי). גם `login` רושם.
  - `gLogin {code, redirect, nonce, cv?}` — הקוד מ־`oauth.html` של הלקוח `GDRIVE_CLIENT_ID` (כתובות החזרה כבר רשומות, `REDIRECT_RE` של `gdrive.js`). השרת מחליף את הקוד, מאמת את `id_token` (חתימה מול `oauth2/v3/certs`, ‏iss, ‏aud, ‏exp, ‏nonce), ודורש `email_verified`.
  - `pwLogin {email, password}` — רק סיסמה שכבר אצלנו. 5 כישלונות ב־15 דק׳ למייל, ו־20 לכתובת IP. תשובה אחידה `bad_login`.
  - `pwSet {idToken, password}` — רק אחרי כניסה טרייה (עד 5 דק׳, לא טוקן מותאם).
  - `mailCode` — כשדולק: הקוד מאמת את המייל → החשבון אצלנו, עוגייה, `s:1`, `u`, `ct`. ‏`oc` נשאר לגיבוי. ‏`mailSend` בלי קישור מ־Firebase → מייל עם קוד בלבד.
  - כל כניסה = העוגייה `__Host-snb_s` + `ct` (טוקן מותאם של Firebase, כגיבוי לגישה הישירה ל־Firestore). כשאין `ct` (IAM לא זמין) העוגייה עדיין תקפה.
- **הדגל**: `SNB_ACC=on|off` גובר. בלעדיו — בניסוי דולק תמיד, ובייצור לפי `acc_srv` במרכז הניהול (`def:false`, נקרא מהמסד ב־`ldbsync.flag`). כבוי → `off`, והטלפון ממשיך כמו היום.

## אבטחה (הצ'קליסט ב־`docs/privacy.md`, "מערכות משלנו")
- אין מייל, uid או מזהה Google גלוי במסד, בעותק או ב־`GET /api/session` (מונים בלבד, `acc:*`).
- רשומה שהועתקה ל־uid אחר לא נפתחת (AAD). רשומה פגומה נחשבת כאילו אין רשומה.
- סיסמאות: scrypt N=2^15, ‏r=8, ‏p=1, ומלח של 16 בתים. ההשוואה בזמן קבוע, ונעשה scrypt גם כשאין רשומה.
- **סיכון שנשאר**: הנעילה של `pwLogin` בזיכרון התהליך, ולכן עלייה מחדש מאפסת אותה. ההגבלה הכללית לכתובת (60 לדקה) נשארת.

## הגלים
1. ✓ השרת (722).
2. הטלפון (`auth.js`/`acclink.js`): כפתור Google דרך `gLogin` (חלון `oauth.html` כמו ב־Drive, ‏PKCE + nonce). קוד במייל: `s:1` בלי `oc` → `who`. ‏`accReg` פעם ביום. ‏`pwSet` אחרי כניסה בסיסמה. ‏`pwLogin` כש־Firebase נכשל.
3. טוקן גישה משלנו, שהשרתון מקבל לצד ה־ID token של Firebase, כדי שבקשות לא יהיו תלויות ב־Firebase.
