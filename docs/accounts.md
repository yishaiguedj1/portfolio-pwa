# החשבונות וההתחברות אצלנו — שלב 2 בתוכנית העצמאות מ־Firebase

נבנה מ־6/11/2026. התוכנית: `תוכנית-עצמאות-מ-Firebase.md`, "שלב 2". הבדיקות: `tests/accounts.test.js`.

## המבנה
- **`ibkr-proxy/lib/accounts.js`** — טבלת החשבונות. `snbAcc/{uid}`: רשומה מוצפנת כולה (`vault.seal`, AAD `snb-acc|uid`) עם `em` (מיילים מאומתים), `g` (מזהי Google), `pw` (scrypt), `ct`, `lt`. ‏`snbAccIx/{id}`: אינדקס, id = HMAC של `g|sub` / `e|מייל` במפתח `vault.derive('snb-acc-ix/v1')`, והתוכן מוצפן (AAD `snb-accix|id`).
- הגישה דרך Firestore REST. בשרת שלנו האוספים נענים מהמסד (`ldb`), ו־Firestore מקבל עותק. בכללים אין להם הרשאה לטלפון.
- **אותו uid של Firebase.** חשבון לא מוכר → `fbadmin.lookup` (לפי מייל או `federatedUserId` של Google). "אין כזה" → uid חדש של 28 תווים, ו־Firebase יוצר את המשתמש ב־`signInWithCustomToken`. Firebase לא עונה → שגיאה, לא חשבון חדש.
- הפעולות ב־`lib/session.js` (רק בשרת שלנו, `SERVER_ONLY`; ב־Vercel אין אותן, והטלפון ממשיך עם Firebase):
  - `accReg {idToken}` — רישום שקט מכל טוקן Firebase מאומת (גם לא טרי). גם `login` רושם.
  - `gLogin {code, redirect, nonce, cv?}` — הקוד מ־`oauth.html` של הלקוח `GDRIVE_CLIENT_ID` (`REDIRECT_RE` של `gdrive.js`). **כתובת חזרה חייבת להיות רשומה גם בלקוח ב־Google Cloud** — בניסוי הלקוח נפרד (`THE SNOWBALL Drive staging`), ועד 7/11/2026 חסרה בו `invest-staging` (`redirect_uri_mismatch`); נוספו שלוש כתובות הניסוי. לפני הדלקה בייצור — לבדוק ברשימה של לקוח הייצור את `invest`, ‏`academy` ו־`studio`. השרת מחליף את הקוד, מאמת את `id_token` (חתימה מול `oauth2/v3/certs`, ‏iss, ‏aud, ‏exp, ‏nonce), ודורש `email_verified`.
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
2. ✓ הטלפון (723). הקוד באזור `<auth>` החדש של `cloud.js` (נכנס גם ל־`auth.js` דרך coregen), וב־`acclink.js`:
   - **Google**: ‏`gCfg` (פעולה חדשה, בלי התחברות: `{on, cid}`, דולק רק כש־`accOn` והלקוח מוגדר) נשאל מראש כשאין משתמש (`gPrep`), כי אחרי await בלחיצה כבר אי אפשר לפתוח את החלון של Firebase. דולק → `gTry` פותח את `oauth.html` בתוך הלחיצה, ‏state (`li…`), ‏nonce ו־PKCE מ־`crypto.getRandomValues`, הקוד מתקבל רק עם ה־state שלנו → `gLogin` → `ctSignIn` (בלי `ct` — `who`). חזרה לאפליקציה בלי קוד → ביטול אחרי 4 שניות (`w.closed` לא אמין מול COOP). כבוי / מזהה לא תקין → Firebase כמו קודם. נכשל אחרי שהחלון נפתח → "ההתחברות נכשלה", והלחיצה הבאה — Firebase (`gSrvOff`). גם חזרה בלי קוד (בוטל, או ש־Google חסם בתוך החלון) → הלחיצה הבאה דרך Firebase (724), בלי לולאה.
   - **קוד במייל**: ‏`s:1` → `SnbAcct.ct(j.ct)` גם בלי `oc`. הוספה לחשבון המחובר (`l`) — רק דרך `oc`.
   - **`accReg`** מתוך `sessCheck`, פעם ביום לכל חשבון (`pwa_accreg_v1`; ‏`off` מסומן עד מחר, תקלה — בבדיקה הבאה).
   - **`pwSet`** מיד אחרי כניסה/הרשמה בסיסמה ב־Firebase, וגם אחרי "הוספת מייל וסיסמה" לחשבון (724; אחרי כניסה עם טוקן מותאם השרת עונה `not_fresh`, והסיסמה תגיע בכניסה הבאה בסיסמה), פעם אחת לכל חשבון במכשיר (`pwa_pwset_v1`, רק תחילית ה־uid). הסיסמה לא נשמרת. ‏**`pwLogin`** רק כש־Firebase לא זמין (`fbDown`: רשת, מכסה, תקלה פנימית, too-many-requests) — לא בסיסמה שגויה. ‏`bad_login` מציג את ההודעה של Firebase (ייתכן שהסיסמה עוד לא אצלנו).
   - **סיכון ידוע** (טופל בגל 3): סיסמה שהוחלפה ב־Firebase (איפוס) לא התעדכנה אצלנו עד כניסה במכשיר חדש.
   - בדיקות: `tests/session-client.test.js`, ‏`tests/auth.test.js`, ‏`tests/acc-email.test.js`, ‏`tests/accounts.test.js` (`gCfg`).
3. ✓ אסימון גישה משלנו (725, 7/11/2026). אושר בטלפון בניסוי (7/11 ‏16:37: ‏`at:ok` ב־Studio וב־Invest, ‏`acc:g:ok`, בלי `at:off`/`at:no_acc`, ובלי קריאות Firestore נוספות לאימות). בדיקות: `tests/snbat.test.js`, ‏`tests/session-client.test.js`.
   - **`lib/snbat.js`**: JWT עם כותרת קבועה `{alg:HS256, typ:JWT, kid:snb-at/1}` (הכותרת מושווית כמחרוזת — alg אחר, none או סדר אחר נדחים). המפתח `vault.derive('snb-at/v1')`. בתוכו: `sub` (uid), ‏`aud` = `snb:<אפליקציה>`, ‏`app`, ‏`iat`, ‏`exp` (15 דק׳), ‏`vs` (מתי הונפקה העוגייה), ‏`p` (הפרויקט), ‏`em` (המיילים המאומתים מ־`snbAcc` — להרשאות לפי מייל, `hasEmail`). כל אימות: HMAC בזמן קבוע, ‏iss, ‏aud מול app ורשימת האפליקציות, ‏exp/iat ותפוגה מרבית, פרויקט, ו־**ביטול**: `vs` ישן מ־`sessions/{uid}.vs` נדחה (תקלה בקריאה — נדחה). מטמון vs לאימות — 10 דק׳; ההתנתקות נכתבת באותו תהליך ומעדכנת אותו מיד.
   - **הנפקה** (`session.js`): ‏`at` (חידוש מהעוגייה, בלי IAM), וגם בתשובות `who`, ‏`gLogin`, ‏`pwLogin`, ‏`mailCode` (`at`, ‏`atx`). רק כש־`accOn` ורק לחשבון שרשום אצלנו; אחרת בלי אסימון.
   - **קבלה**: `gauth.verifyIdToken` מעביר ל־`snbat.verify` רק כשאין `process.env.VERCEL`, ‏`accOn` דולק ו־`own !== false`. ‏`session.js` מאמת עם `own:false` (כניסות דורשות Firebase אמיתי). ‏`appscope.appDenied`: האסימון שלנו ממקור של אפליקציה אחרת — `wrong_app` בכל פעולה. ב־Vercel — Firebase בלבד (401).
   - **הטלפון** (אזור `<auth>` ב־`cloud.js`): ‏`window.snbIdToken(u, force)` — מקור אחד: אסימון שלנו בתוקף לאותו uid (יותר מ־2 דק׳), אחרת `op:'at'` (רק אם השרת כבר הנפיק במכשיר בשבוע האחרון — `pwa_aton_v1`, ‏`ACCOUNT_KEYS`), אחרת `getIdToken`. האסימון רק בזיכרון. ‏`off` → 30 דק׳ בלי, והסימון נמחק. ‏**`atFetch`** עוטף את `fetch`: תשובת 401 לבקשה שנשאה את האסימון שלנו (Vercel אחרי מעבר לגיבוי, דגל שכבה, ביטול) → אותה בקשה שוב עם `getIdToken`. הוחלפו: ‏`udCall` (cloud.js), ‏`fbIdToken`/`ibkrBgIdToken`/devErr/גיבוי התיק (app.js), ‏`idToken` (library.js), ‏`idTok` (studio.js), ‏`api` (cashflow.js), ‏`api0` (admin-app.js). נשארו עם Firebase בכוונה: ‏`login`, ‏`accReg`, ‏`pwSet`, ‏`merge`, ‏`mailSend verify` — הם מוכיחים כניסה ב־Firebase.
   - **הוספת מייל לחשבון** (`mailCode` עם `add:1` ועוגייה תקפה): הקוד מוכיח את המייל → `accounts.addEmail` (מייל של חשבון אחר אצלנו או ב־Firebase — לא מוסיף, `added:false`; ‏`oc` נשאר לקישור/מיזוג ב־Firebase). עד 725 הוספה בקוד הייתה מכניסה את העוגייה לחשבון של המייל — תוקן: `add` לא נוגע בעוגייה.
   - **סיסמה אחרי איפוס**: `setPw` שומר `pa`. ‏`loginPw` ו־`pwState` משווים ל־`passwordUpdatedAt` של Firebase (`fbadmin.lookup {uid}` → `pu`): הוחלפה אחרי `pa` → הישנה נמחקת ונדחית. ‏`accReg` עונה `pw:0` → הטלפון מוחק את סימון `pwa_pwset_v1` של החשבון, ו־`pwSet` נשלח שוב בכניסה הבאה בסיסמה. גם בקשת איפוס מהמכשיר (`sendReset`) מוחקת את הסימונים.
   - **סיכונים שנשארו**: (א) Firebase לא עונה → `loginPw` מקבל סיסמה ישנה (זה המצב שבשבילו יש כניסה אצלנו). (ב) "התנתק" במכשיר אחד (לא מכל המכשירים) לא מבטל אסימון שכבר הונפק — עד 15 דק׳; בטלפון עצמו הוא נמחק מהזיכרון. (ג) מטמון ה־vs בזיכרון התהליך — שרת אחד; שרת נוסף יצטרך ביטול משותף.
