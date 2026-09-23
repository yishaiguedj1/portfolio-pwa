'use strict';
/* ============================================================
 * תיק ההשקעות — PWA עצמאית
 * נתונים סטטיים: פוזיציות, הפקדות, פנסיה (מהגיליון, 2026-09-22)
 * מחירים חיים: Yahoo (ראשי) ← CNBC (גיבוי), דיליי ~15 דקות
 * היסטוריה לגרפים: Twelve Data (ראשי; מפתח חינמי נשמר בטלפון) ← Yahoo ← Stooq
 * שער דולר: open.er-api.com / frankfurter
 * ============================================================ */

/* ---------------- שפה: עברית / English ----------------
   מילון מרכזי לכל המחרוזות הגלויות למשתמש.
   t('key') מחזיר את המחרוזת בשפה הנוכחית; t('key', {name: val}) ממלא {name}.
   השפה נשמרת ברמת המכשיר בלבד (pwa_lang_v1) — לא בענן. ברירת מחדל: עברית. */
const LS_LANG = 'pwa_lang_v1';
const LS_THEME = 'pwa_theme_v1'; // 'light' | 'dark' | 'system' — נשמר ברמת המכשיר בלבד, לא בענן

const STRINGS = {
he: {
  appTitle: 'תיק ההשקעות',
  loadingSource: 'מקור: טוען…',
  curAria: 'בחירת מטבע',
  curUsd: 'הצג בדולרים',
  curIls: 'הצג בשקלים',
  loading: 'טוען…',
  refresh: 'רענון נתונים',
  tabsAria: 'לשוניות',
  tabOverview: 'סקירה',
  tabStocks: 'מניות',
  tabDeposits: 'הפקדות',
  tabPension: 'פנסיה',
  tabSettings: 'הגדרות',
  langTitle: 'שפה',
  themeTitle: 'ערכת נושא',
  themeLight: 'בהיר',
  themeSystem: 'מערכת',
  themeDark: 'כהה',

  ovStocksValue: 'שווי תיק המניות',
  ovGL: 'רווח / הפסד',
  ovVsNetDeposits: 'מול הפקדות נטו',
  ovYield: 'תשואה',
  ovBreakdown: 'מניות: {a} · מזומן: {b}',
  ovUpdated: 'עודכן: {time}',
  pfTitle: 'ביצועי התיק לאורך זמן',
  pfNote: 'שווי התיק בשקלים לאורך זמן, לפי האחזקות הנוכחיות (אין יומן קניות היסטורי).',
  pieTitle: 'חלוקת תיק מניות',
  calcTitle: 'שקיפות חישובים',
  calcNote1: 'התשואה מחושבת מול <b>סך ההפקדות נטו ({total})</b> כפי שמופיע בגיליון:',
  calcNote2: 'רווח/הפסד = שווי התיק − הפקדות · תשואה = רווח ÷ הפקדות.',
  calcNote3: 'שים לב: סכום (כמות × מחיר קנייה ממוצע) עומד על כ־$65,672 (כ־₪198K) — כ־₪10.7K מעל סך ההפקדות. פער אפשרי מעיגול או עדכון מחירי הקנייה בגיליון, מרשומת +₪37,000 (משיכה/תיקון) או מהשפעות מט״ח. כדאי לוודא מול הגיליון.',
  calcNote4: 'התשואה בשקלים מגלמת גם את תנועת שער הדולר, לא רק את ביצועי המניות.',

  myStocks: 'המניות שלי',
  editBtn: '✏️ עריכה',
  editHintStocks: 'מצב עריכה פעיל — אפשר לערוך, להוסיף ולמחוק מניות. בסיום לחצו שוב על ✏️ עריכה.',
  editHint: 'מצב עריכה פעיל — בסיום לחצו שוב על ✏️ עריכה.',
  addStock: 'הוספת מניה',
  noStocks: 'אין מניות בתיק. הפעילו ✏️ עריכה כדי להוסיף.',
  btnEdit: '✏️ ערוך',
  btnDelete: '🗑 מחק',
  todayChg: 'היום {v}',
  kvShares: 'מניות',
  kvAvg: 'מחיר קנייה ממוצע',
  kvValue: 'שווי',
  kvGL: 'רווח/הפסד',
  kvWeight: 'משקל בתיק',
  offAth: '{v} מהשיא',
  measure: '📏 מדידה',
  measureTitle: 'בחירת שתי נקודות על הגרף למדידת תשואה ביניהן',
  measureOn: 'מצב מדידה: געו בשתי נקודות על הגרף — התשואה ביניהן תוצג. געו שוב כדי להתחיל מחדש.',
  measureTip: 'טיפ: לחצו 📏 מדידה ואז געו בשתי נקודות כדי למדוד תשואה ביניהן.',
  mReturn: 'תשואה: ',
  clearMeasure: 'ניקוי מדידה',
  loadingData: 'טוען נתונים…',
  loadingHist: 'טוען נתוני היסטוריה…',
  chartNeedsKey: 'הגרף דורש מפתח נתונים (לשונית הגדרות)',
  noChartData: 'לא התקבלו נתוני גרף',
  noChartNow: 'אין נתוני גרף כרגע',
  noPriceYet: 'אין נתוני מחיר עדיין',
  totalStocks: 'סך מניות',
  myPortfolio: 'התיק שלי',

  rangeDay: 'יום',
  rangeWeek: 'שבוע',
  rangeMonth: 'חודש',
  rangeYtd: 'YTD',
  rangeYear: 'שנה',
  range5y: '5 שנים',
  range3y: '3 שנים',
  rangeMax: 'מקסימום',

  sourceLabel: 'מקור: {src} · דיליי ~15 דקות{stale}',
  staleSuffix: ' · מוצגים נתונים שמורים',
  fxSource: 'שער חליפין',
  noPriceConn: 'אין חיבור למקור המחירים — מוצגים נתונים אחרונים מ־{time}.',
  noPrices: 'לא התקבלו מחירים. בדקו חיבור לאינטרנט ונסו לרענן.',

  errTimeout: 'לא ענה בזמן',
  errBlocked: 'חסימת דפדפן/רשת',
  errGeneric: 'שגיאה',
  srcEmpty: '{name}: החזיר ריק',
  tdBadKey: 'TwelveData: המפתח לא תקין — צריך להזין מפתח חדש',
  tdKeyRejected: 'TwelveData: המפתח לא התקבל (401)',

  depTotalTitle: 'סך הפקדות נטו',
  depCalcNote: 'מחושב מהרשומות למטה',
  allDeposits: 'כל ההפקדות',
  depNote: 'סכומים שליליים = כסף שהופקד לתיק. הרשומה החיובית (+₪37,000 ב־19/02/2025) היא משיכה/תיקון כפי שמופיעה בגיליון.',
  records: '{n} רשומות',
  addDeposit: 'הוספת הפקדה',
  btnEditRow: 'ערוך',
  btnDeleteRow: 'מחק',
  adjTitle: 'משיכה/תיקון',
  fldDate: 'תאריך',
  fldType: 'סוג',
  optIn: 'הפקדה (כסף נכנס)',
  optOut: 'משיכה (כסף יוצא)',
  fldAmountIls: 'סכום (₪)',
  fldPlace: 'חברה / הערה',
  phOptional: 'אופציונלי',
  btnSave: 'שמור',
  btnCancel: 'ביטול',
  saved: 'נשמר ✓',
  newDeposit: 'הפקדה חדשה',
  depositAdded: 'ההפקדה נוספה ✓',
  depositDeleted: 'ההפקדה נמחקה ✓',
  delDepositConfirm: 'למחוק את ההפקדה מ־{date} ({amt} ₪)?',
  errDateInvalid: 'תאריך לא תקין',
  errAmtPos: 'הסכום חייב להיות חיובי',

  pensionTotalTitle: 'סך פנסיה והשתלמות',
  pensionDepositsTitle: 'הפקדות פנסיה',
  pensionReturn: 'תשואת פנסיה (סך הכל)',
  studyReturn: 'תשואת קרן השתלמות (סך הכל)',
  studyTag: '· קרן השתלמות',
  fldCompany: 'חברה',
  fldAssoc: 'שיוך',
  optPension: 'פנסיה',
  optStudy: 'קרן השתלמות',
  fldPeriod: 'תקופה',
  fldNote: 'הערה',
  newPensionDeposit: 'הפקדת פנסיה חדשה',
  pensionDepositAdded: 'נוספה ✓',
  pensionDepositDeleted: 'נמחקה ✓',
  delPensionConfirm: 'למחוק את ההפקדה של {place} ({amt} ₪)?',
  errCompanyNeeded: 'צריך למלא את שם החברה',

  myAccount: 'החשבון שלי 👤',
  appVersion: 'גרסת אפליקציה: ',
  tdKeyTitle: 'מפתח נתונים (Twelve Data) 📈',
  tdKeyDesc: 'המפתח מפעיל את הגרפים. נשמר בחשבון שלך בענן (או בטלפון, בלי חשבון).',
  tdSignup: 'להרשמה חינמית ב־Twelve Data',
  tdKeyPh: 'הדבק כאן את המפתח',
  tdKeySaved: 'מפתח שמור: ••••{last4} — הגרפים פעילים',
  tdKeyMissing: 'אין מפתח שמור — הגרפים לא יעבדו. הזן מפתח למטה.',
  tdKeySavedFlash: 'המפתח נשמר ✓',

  ibkrTitle: 'חיבור ברוקר למשיכת מידע 🏦',
  ibkrDesc: 'אופציונלי — מושך דוח קריאה־בלבד מ־Interactive Brokers. אי אפשר לסחור דרכו. הסנכרון רק מוריד נתונים לצפייה; כפתור הייבוא מכניס את הפוזיציות לתיק (בהסכמתך).',
  ibkrProxyLabel: 'כתובת השרתון',
  ibkrQueryPh: 'מ־IBKR',
  ibkrTokenNote: 'ה־token נשמר בטלפון בלבד — לעולם לא בענן ולא בקוד.',
  ibkrSaveTest: 'שמור ובדוק חיבור',
  ibkrSyncImportBtn: '🔄 סנכרן וייבא מ־IBKR',
  ibkrDisconnectBtn: 'ניתוק',
  ibkrNotConnected: 'לא מחובר — מוצגים הנתונים הידניים.',
  ibkrConnectedSynced: 'מחובר ✓ · סונכרן: {time}',
  ibkrConnectedNever: 'מחובר ✓ · טרם בוצע סנכרון.',
  ibkrDataSummary: 'פוזיציות: {n} · עסקאות בדוח: {m} · תנועות מזומן: {k}',
  proxyUrlMissing: 'כתובת השרתון לא הוגדרה',
  credsMissing: 'חסרים Flex token או Query ID',
  credsMissingSave: 'חסרים Flex token או Query ID — שמור קודם',
  connOk: 'החיבור תקין ✓ (IBKR קיבל את הבקשה)',
  testFailed: 'הבדיקה נכשלה: {err}',
  reqReport: 'מבקש דוח מ־IBKR…',
  genReport: 'IBKR מייצר את הדוח… (לוקח בדרך כלל דקה־שתיים)',
  importNoStocks: 'לא נמצאו פוזיציות מניות בדוח IBKR',
  importSkippedNote: ' ({n} שורות שאינן מניות דולריות דולגו)',
  importCashLine: 'מזומן מהדוח: ${usd} / ₪{ils}',
  importCashMissing: 'מזומן לא נמצא בדוח — יישמר המזומן הקיים (כדאי להוסיף את מקטע Cash Report לשאילתת ה־Flex).',
  importConfirm: 'נמצאו {n} מניות בדוח ({lots} שורות קנייה אוחדו לפי סימבול).\n{cashLine}\nפעולה זו תחליף את המניות והמזומן בתיק. פנסיה והפקדות לא ישתנו.{skipped}\nלהמשיך?',
  importedOk: 'סונכרן ויובאו {n} מניות מ־IBKR ✓',
  importFailed: 'הסנכרון והייבוא נכשלו: {err}',
  disconnectConfirm: 'לנתק את חיבור הברוקר? הטוקן ונתוני הסנכרון יימחקו מהטלפון. הנתונים הידניים לא ייפגעו.',
  disconnected: 'החיבור נותק',
  proxyPrefix: 'שרתון: ',
  proxyBadResponse: 'תשובה לא תקינה מהשרתון',
  proxyErr: 'שגיאת שרתון',
  netPrefix: 'רשת: ',
  reportTimeout: 'הדוח לא היה מוכן בזמן — נסה שוב',
  ibkrErr1001: 'IBKR לא הצליח ליצור את הדוח כרגע (עומס זמני אצלם) — נסה שוב בעוד כמה דקות.',
  ibkrErrRate: 'IBKR דחה את הבקשה כרגע — נסה שוב בעוד כמה דקות.',
  ibkrErrTokenExp: 'הטוקן פג תוקף — צור טוקן חדש ב־IBKR והזן אותו כאן.',
  ibkrErrTokenIp: 'הטוקן מוגבל לכתובת IP מסוימת — ב־IBKR בטל את הגבלת ה־IP.',
  ibkrErrQuery: 'ה־Query ID לא נמצא — בדוק שהמספר שהזנת נכון.',
  ibkrErrTokenBad: 'הטוקן לא תקין — בדוק שהעתקת את כולו, בלי רווחים.',
  ibkrErrAccount: 'בעיה בחשבון ב־IBKR — בדוק שהחשבון פעיל.',
  ibkrErrCode: 'קוד הדוח לא תקין — נסה סנכרון חדש.',
  ibkrErrMany: 'יותר מדי בקשות ברצף — המתן דקה ונסה שוב.',
  ibkrErrBlocked: 'הגישה ל־IBKR נחסמה זמנית — נסה שוב בעוד כמה דקות.',
  ibkrErrCreds: 'חסרים Flex token או Query ID.',
  ibkrErrNet: 'לא הצלחנו להגיע לשרתון — בדוק חיבור לאינטרנט.',

  cashTitle: 'מזומן בתיק',
  cashUsdL: 'דולרים ($)',
  cashIlsL: 'שקלים (₪)',
  saveCash: 'שמור מזומן',
  cashSaved: 'המזומן נשמר ✓',
  errCashNonNeg: 'הסכומים חייבים להיות מספרים לא־שליליים',

  fundsTitle: 'קרנות פנסיה והשתלמות',
  newFundName: 'שם קרן חדשה',
  newFundPh: 'למשל: מיטב',
  fldDollars: 'דולרים ($)',
  fldShekels: 'שקלים (₪)',
  addFund: '＋ הוסף קרן',
  saveFunds: 'שמור קרנות',
  fundsSaved: 'הקרנות נשמרו ✓',
  fundAdded: 'הקרן נוספה ✓',
  errFundsNonNeg: 'כל הערכים חייבים להיות מספרים לא־שליליים',
  errFundName: 'הזן שם לקרן החדשה',

  resetTitle: 'איפוס נתונים',
  resetDesc: 'מוחק את כל הנתונים (מניות, הפקדות, פנסיה, מזומן) מהענן ומהטלפון — התיק חוזר לתיק הדוגמה. לא ניתן לבטל.',
  resetBtn: 'איפוס התיק',
  resetConfirm: 'לאפס את כל הנתונים? התיק יימחק לגמרי (מניות, הפקדות, פנסיה, מזומן) ויחזור לתיק הדוגמה.\nלא ניתן לבטל.',

  footerNote: 'המחירים מתעדכנים בכל פתיחה (דיליי של כ־15 דקות). הגרף היומי כולל גם מסחר מורחב — לפני הפתיחה ואחרי הסגירה. מחוץ לשעות המסחר מוצג מחיר הסגירה האחרון.',

  loginAria: 'התחברות',
  loginSub: 'מתחברים פעם אחת — התיק נשמר בענן<br>ומסונכרן בכל מכשיר',
  googleSignIn: 'התחברות עם Google',
  skipLogin: 'המשך בלי חשבון',
  loginFailed: 'ההתחברות נכשלה — נסו שוב',
  signingIn: 'מתחבר…',
  cloudNotSetup: 'חיבור ענן לא הוגדר עדיין — הנתונים נשמרים בטלפון הזה בלבד.',
  userLabel: 'משתמש',
  signOut: 'התנתקות',
  cloudConnected: 'מחובר — הנתונים נשמרים בענן ומסונכרנים אוטומטית בכל מכשיר.',
  localMode: 'מצב מקומי — הנתונים נשמרים רק בטלפון הזה.',
  offlineMode: 'מצב לא מקוון — מוצגים נתונים מקומיים',

  fldSymbol: 'סימול (אנגלית)',
  fldNameHe: 'שם בעברית',
  fldFullName: 'שם מלא (אופציונלי)',
  phExampleName: 'אנבידיה',
  fldShares: 'כמות מניות',
  fldAvgPrice: 'מחיר קנייה ממוצע ($)',
  addStockTitle: 'הוספת מניה',
  btnAddStock: 'הוסף מניה',
  stockAdded: 'המניה נוספה ✓',
  stockDeleted: 'המניה נמחקה ✓',
  delStockConfirm: 'למחוק את {name} ({sym}) מהתיק?\nגם נתוני הגרף השמורים שלה יימחקו.',
  errSymInvalid: 'סימול לא תקין — אותיות באנגלית בלבד',
  errSymExists: 'המניה כבר קיימת בתיק',
  errSharesPos: 'כמות המניות חייבת להיות חיובית',
  errAvgPos: 'מחיר הקנייה חייב להיות חיובי'
},
en: {
  appTitle: 'Portfolio',
  loadingSource: 'Source: loading…',
  curAria: 'Currency selection',
  curUsd: 'Show in dollars',
  curIls: 'Show in shekels',
  loading: 'Loading…',
  refresh: 'Refresh data',
  tabsAria: 'Tabs',
  tabOverview: 'Overview',
  tabStocks: 'Stocks',
  tabDeposits: 'Deposits',
  tabPension: 'Pension',
  tabSettings: 'Settings',
  langTitle: 'Language',
  themeTitle: 'Theme',
  themeLight: 'Light',
  themeSystem: 'System',
  themeDark: 'Dark',

  ovStocksValue: 'Stock portfolio value',
  ovGL: 'Gain / Loss',
  ovVsNetDeposits: 'vs. net deposits',
  ovYield: 'Return',
  ovBreakdown: 'Stocks: {a} · Cash: {b}',
  ovUpdated: 'Updated: {time}',
  pfTitle: 'Portfolio performance over time',
  pfNote: 'Portfolio value in ILS over time, based on current holdings (no historical trade log).',
  pieTitle: 'Stock allocation',
  calcTitle: 'Calculation transparency',
  calcNote1: 'Return is calculated against <b>total net deposits ({total})</b> as shown in the sheet:',
  calcNote2: 'Gain/Loss = portfolio value − deposits · Return = gain ÷ deposits.',
  calcNote3: 'Note: sum (shares × avg buy price) is about $65,672 (about ₪198K) — about ₪10.7K above total deposits. Possible gap from rounding or buy-price updates in the sheet, a +₪37,000 entry (withdrawal/correction), or FX effects. Worth checking against the sheet.',
  calcNote4: 'The ILS return also reflects USD/ILS moves, not just stock performance.',

  myStocks: 'My stocks',
  editBtn: '✏️ Edit',
  editHintStocks: 'Edit mode is on — you can edit, add and delete stocks. When done, tap ✏️ Edit again.',
  editHint: 'Edit mode is on — when done, tap ✏️ Edit again.',
  addStock: 'Add stock',
  noStocks: 'No stocks in the portfolio. Turn on ✏️ Edit to add.',
  btnEdit: '✏️ Edit',
  btnDelete: '🗑 Delete',
  todayChg: 'Today {v}',
  kvShares: 'Shares',
  kvAvg: 'Avg buy price',
  kvValue: 'Value',
  kvGL: 'Gain/Loss',
  kvWeight: 'Portfolio weight',
  offAth: '{v} off ATH',
  measure: '📏 Measure',
  measureTitle: 'Pick two points on the chart to measure the return between them',
  measureOn: 'Measure mode: tap two points on the chart — the return between them will show. Tap again to restart.',
  measureTip: 'Tip: tap 📏 Measure, then tap two points to measure the return between them.',
  mReturn: 'Return: ',
  clearMeasure: 'Clear measurement',
  loadingData: 'Loading data…',
  loadingHist: 'Loading history data…',
  chartNeedsKey: 'Chart needs a data key (Settings tab)',
  noChartData: 'No chart data received',
  noChartNow: 'No chart data right now',
  noPriceYet: 'No price data yet',
  totalStocks: 'Stocks total',
  myPortfolio: 'My portfolio',

  rangeDay: 'Day',
  rangeWeek: 'Week',
  rangeMonth: 'Month',
  rangeYtd: 'YTD',
  rangeYear: 'Year',
  range5y: '5Y',
  range3y: '3Y',
  rangeMax: 'Max',

  sourceLabel: 'Source: {src} · ~15 min delay{stale}',
  staleSuffix: ' · showing saved data',
  fxSource: 'Exchange rate',
  noPriceConn: 'No connection to the price source — showing last data from {time}.',
  noPrices: 'No prices received. Check your internet connection and try refreshing.',

  errTimeout: 'Timed out',
  errBlocked: 'Browser/network blocked',
  errGeneric: 'Error',
  srcEmpty: '{name}: returned empty',
  tdBadKey: 'TwelveData: invalid key — please enter a new key',
  tdKeyRejected: 'TwelveData: key rejected (401)',

  depTotalTitle: 'Total net deposits',
  depCalcNote: 'calculated from the records below',
  allDeposits: 'All deposits',
  depNote: 'Negative amounts = money deposited into the portfolio. The positive entry (+₪37,000 on 19/02/2025) is a withdrawal/correction as shown in the sheet.',
  records: '{n} records',
  addDeposit: 'Add deposit',
  btnEditRow: 'Edit',
  btnDeleteRow: 'Delete',
  adjTitle: 'Withdrawal/correction',
  fldDate: 'Date',
  fldType: 'Type',
  optIn: 'Deposit (money in)',
  optOut: 'Withdrawal (money out)',
  fldAmountIls: 'Amount (₪)',
  fldPlace: 'Company / note',
  phOptional: 'Optional',
  btnSave: 'Save',
  btnCancel: 'Cancel',
  saved: 'Saved ✓',
  newDeposit: 'New deposit',
  depositAdded: 'Deposit added ✓',
  depositDeleted: 'Deposit deleted ✓',
  delDepositConfirm: 'Delete the deposit from {date} ({amt} ₪)?',
  errDateInvalid: 'Invalid date',
  errAmtPos: 'Amount must be positive',

  pensionTotalTitle: 'Pension & study fund total',
  pensionDepositsTitle: 'Pension deposits',
  pensionReturn: 'Pension return (total)',
  studyReturn: 'Study fund return (total)',
  studyTag: '· Study fund',
  fldCompany: 'Company',
  fldAssoc: 'Linked to',
  optPension: 'Pension',
  optStudy: 'Study fund',
  fldPeriod: 'Period',
  fldNote: 'Note',
  newPensionDeposit: 'New pension deposit',
  pensionDepositAdded: 'Added ✓',
  pensionDepositDeleted: 'Deleted ✓',
  delPensionConfirm: 'Delete the deposit for {place} ({amt} ₪)?',
  errCompanyNeeded: 'Company name is required',

  myAccount: 'My account 👤',
  appVersion: 'App version: ',
  tdKeyTitle: 'Data key (Twelve Data) 📈',
  tdKeyDesc: 'The key powers the charts. Stored in your cloud account (or on the phone, without an account).',
  tdSignup: 'Free Twelve Data signup',
  tdKeyPh: 'Paste your key here',
  tdKeySaved: 'Key saved: ••••{last4} — charts are active',
  tdKeyMissing: 'No saved key — charts won\'t work. Enter a key below.',
  tdKeySavedFlash: 'Key saved ✓',

  ibkrTitle: 'Broker connection (data pull) 🏦',
  ibkrDesc: 'Optional — pulls a read-only report from Interactive Brokers. No trading possible. Sync only downloads data for viewing; the Import button adds positions to the portfolio (with your approval).',
  ibkrProxyLabel: 'Proxy URL',
  ibkrQueryPh: 'from IBKR',
  ibkrTokenNote: 'The token is stored on this phone only — never in the cloud or in code.',
  ibkrSaveTest: 'Save & test connection',
  ibkrSyncImportBtn: '🔄 Sync & import from IBKR',
  ibkrDisconnectBtn: 'Disconnect',
  ibkrNotConnected: 'Not connected — showing manual data.',
  ibkrConnectedSynced: 'Connected ✓ · Synced: {time}',
  ibkrConnectedNever: 'Connected ✓ · Not synced yet.',
  ibkrDataSummary: 'Positions: {n} · Statement trades: {m} · Cash movements: {k}',
  proxyUrlMissing: 'Proxy URL not set',
  credsMissing: 'Missing Flex token or Query ID',
  credsMissingSave: 'Missing Flex token or Query ID — save first',
  connOk: 'Connection OK ✓ (IBKR received the request)',
  testFailed: 'Test failed: {err}',
  reqReport: 'Requesting report from IBKR…',
  genReport: 'IBKR is generating the report… (usually takes a minute or two)',
  importNoStocks: 'No stock positions found in the IBKR report',
  importSkippedNote: ' ({n} non-USD-stock rows skipped)',
  importCashLine: 'Cash from report: ${usd} / ₪{ils}',
  importCashMissing: 'No cash found in the report — keeping existing cash (consider adding the Cash Report section to your Flex query).',
  importConfirm: 'Found {n} stocks in the report ({lots} purchase rows merged by symbol).\n{cashLine}\nThis will replace the stocks and cash in the portfolio. Pension and deposits will not change.{skipped}\nContinue?',
  importedOk: 'Synced & imported {n} stocks from IBKR ✓',
  importFailed: 'Sync & import failed: {err}',
  disconnectConfirm: 'Disconnect the broker? The token and sync data will be deleted from this phone. Manual data will not be affected.',
  disconnected: 'Disconnected',
  proxyPrefix: 'Proxy: ',
  proxyBadResponse: 'Invalid response from proxy',
  proxyErr: 'Proxy error',
  netPrefix: 'Network: ',
  reportTimeout: 'Report wasn\'t ready in time — try again',
  ibkrErr1001: 'IBKR couldn\'t generate the report right now (temporary load on their side) — try again in a few minutes.',
  ibkrErrRate: 'IBKR rejected the request for now — try again in a few minutes.',
  ibkrErrTokenExp: 'Token expired — create a new token in IBKR and enter it here.',
  ibkrErrTokenIp: 'Token is restricted to a specific IP — remove the IP restriction in IBKR.',
  ibkrErrQuery: 'Query ID not found — check the number you entered.',
  ibkrErrTokenBad: 'Invalid token — make sure you copied all of it, with no spaces.',
  ibkrErrAccount: 'IBKR account issue — check that the account is active.',
  ibkrErrCode: 'Invalid report code — try syncing again.',
  ibkrErrMany: 'Too many requests in a row — wait a minute and try again.',
  ibkrErrBlocked: 'Access to IBKR temporarily blocked — try again in a few minutes.',
  ibkrErrCreds: 'Missing Flex token or Query ID.',
  ibkrErrNet: 'Couldn\'t reach the proxy server — check your internet connection.',

  cashTitle: 'Portfolio cash',
  cashUsdL: 'Dollars ($)',
  cashIlsL: 'Shekels (₪)',
  saveCash: 'Save cash',
  cashSaved: 'Cash saved ✓',
  errCashNonNeg: 'Amounts must be non-negative numbers',

  fundsTitle: 'Pension & study funds',
  newFundName: 'New fund name',
  newFundPh: 'e.g. Meitav',
  fldDollars: 'Dollars ($)',
  fldShekels: 'Shekels (₪)',
  addFund: '＋ Add fund',
  saveFunds: 'Save funds',
  fundsSaved: 'Funds saved ✓',
  fundAdded: 'Fund added ✓',
  errFundsNonNeg: 'All values must be non-negative numbers',
  errFundName: 'Enter a name for the new fund',

  resetTitle: 'Reset data',
  resetDesc: 'Deletes all data (stocks, deposits, pension, cash) from the cloud and this phone — the portfolio returns to the demo. Cannot be undone.',
  resetBtn: 'Reset portfolio',
  resetConfirm: 'Reset all data? The portfolio will be fully deleted (stocks, deposits, pension, cash) and return to the demo portfolio.\nThis cannot be undone.',

  footerNote: 'Prices update on every open (~15 min delay). The daily chart includes extended-hours trading — pre-market and after-hours. Outside trading hours the last closing price is shown.',

  loginAria: 'Sign in',
  loginSub: 'Sign in once — your portfolio is saved in the cloud<br>and synced on every device',
  googleSignIn: 'Sign in with Google',
  skipLogin: 'Continue without an account',
  loginFailed: 'Sign-in failed — try again',
  signingIn: 'Signing in…',
  cloudNotSetup: 'Cloud connection not set up yet — data is stored on this phone only.',
  userLabel: 'User',
  signOut: 'Sign out',
  cloudConnected: 'Connected — data is saved in the cloud and syncs automatically on every device.',
  localMode: 'Local mode — data is stored on this phone only.',
  offlineMode: 'Offline — showing local data',

  fldSymbol: 'Symbol',
  fldNameHe: 'Name',
  fldFullName: 'Full name (optional)',
  phExampleName: 'Nvidia',
  fldShares: 'Shares',
  fldAvgPrice: 'Avg buy price ($)',
  addStockTitle: 'Add stock',
  btnAddStock: 'Add stock',
  stockAdded: 'Stock added ✓',
  stockDeleted: 'Stock deleted ✓',
  delStockConfirm: 'Delete {name} ({sym}) from the portfolio?\nIts saved chart data will also be deleted.',
  errSymInvalid: 'Invalid symbol — English letters only',
  errSymExists: 'This stock is already in the portfolio',
  errSharesPos: 'Share count must be positive',
  errAvgPos: 'Buy price must be positive'
}
};

function getLang() {
  try { const v = localStorage.getItem(LS_LANG); return v === 'en' ? 'en' : 'he'; }
  catch (e) { return 'he'; }
}

/* מחזיר מחרוזת מתורגמת; {var} מוחלף בערכים מ־vars. נופל לעברית ואז למפתח. */
function t(key, vars) {
  const lang = (typeof state !== 'undefined' && state.lang) || getLang();
  let s = (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.he[key] || key;
  if (vars) {
    for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  }
  return s;
}

/* מחיל את השפה על כל האלמנטים הסטטיים (data-i18n/*) ועל כיוון הדף. */
function applyI18n() {
  const lang = (typeof state !== 'undefined' && state.lang) || getLang();
  const root = document.documentElement;
  if (root) {
    root.lang = lang;
    root.dir = lang === 'he' ? 'rtl' : 'ltr';
  }
  document.title = t('appTitle');
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
  const verEl = document.getElementById('appVersion');
  if (verEl && typeof APP_VERSION !== 'undefined') verEl.textContent = t('appVersion') + APP_VERSION;
  renderLangToggle();
}

/* שומר שפה, מחיל על הדף ומרנדר מחדש את כל התוכן הדינמי. */
function setLang(lang) {
  const l = lang === 'en' ? 'en' : 'he';
  try { localStorage.setItem(LS_LANG, l); } catch (e) {}
  if (typeof state !== 'undefined') state.lang = l;
  applyI18n();
  if (typeof renderAll === 'function') renderAll();
  if (typeof renderIbkrCard === 'function') renderIbkrCard();
  if (typeof renderTdKeyStatus === 'function') renderTdKeyStatus();
  if (typeof updateSourceLabel === 'function') updateSourceLabel();
}

/* מצייר את מצב המתג (איזה כפתור פעיל). */
function renderLangToggle() {
  const lang = (typeof state !== 'undefined' && state.lang) || getLang();
  const heB = document.getElementById('langHe');
  const enB = document.getElementById('langEn');
  if (heB) heB.classList.toggle('active', lang === 'he');
  if (enB) enB.classList.toggle('active', lang === 'en');
}

/* ---------------- ערכת נושא: בהיר / כהה / מערכת ----------------
   נשמרת ברמת המכשיר בלבד (pwa_theme_v1) — לא בענן. ברירת מחדל: מערכת. */
function getThemeMode() {
  try { const v = localStorage.getItem(LS_THEME); return v === 'dark' || v === 'light' ? v : 'system'; }
  catch (e) { return 'system'; }
}
function systemDark() {
  try { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  catch (e) { return false; }
}
function resolveTheme() {
  const m = getThemeMode();
  return m === 'system' ? (systemDark() ? 'dark' : 'light') : m;
}
/* מחיל data-theme על <html> ומעדכן את צבע שורת הסטטוס. */
function applyTheme() {
  const th = resolveTheme();
  try {
    if (document.documentElement) document.documentElement.dataset.theme = th;
    const meta = document.querySelector && document.querySelector('#themeColorMeta');
    if (meta) meta.setAttribute('content', th === 'dark' ? '#0A0E0C' : '#006A4E');
  } catch (e) {}
  renderThemeToggle();
}
function setThemeMode(mode) {
  const m = mode === 'dark' ? 'dark' : mode === 'light' ? 'light' : 'system';
  try { localStorage.setItem(LS_THEME, m); } catch (e) {}
  applyTheme();
}
/* מצייר את מצב מתג ערכת הנושא. */
function renderThemeToggle() {
  const m = getThemeMode();
  const map = { light: 'themeLight', system: 'themeSystem', dark: 'themeDark' };
  for (const k of Object.keys(map)) {
    const b = document.getElementById(map[k]);
    if (b) b.classList.toggle('active', m === k);
  }
}
/* קורא משתנה CSS מהערכה הנוכחית; בטסטים (אין getComputedStyle) מחזיר ברירת מחדל. */
function cssVar(name, fallback) {
  try {
    if (typeof getComputedStyle !== 'function') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  } catch (e) { return fallback; }
}

/* ---------------- עזרים טהורים (נבדקים ב-node) ---------------- */

function pf(v) {
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
}

/* מפענח היסטוריית Stooq יומית/תוך-יומית: Date[,Time],Open,High,Low,Close,Volume */
function parseHistoryCSV(text) {
  const rows = [];
  if (!text || typeof text !== 'string') return rows;
  const lines = text.trim().split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const c = line.split(',');
    if (c.length < 6) continue;
    const m = c[0].trim().match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
    if (!m) continue; // כותרת או שורה לא תקינה
    const close = pf(c[4]);
    if (close === null || close <= 0) continue;
    rows.push({
      date: m[1],
      time: m[2] || null,
      open: pf(c[1]),
      high: pf(c[2]),
      low: pf(c[3]),
      close: close,
      volume: parseInt(c[5], 10) || 0
    });
  }
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time || '', tb = b.time || '';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  return rows;
}

function pad2(n) { return String(n).padStart(2, '0'); }

/* מפענח תשובת Yahoo Finance v8: timestamp (שניות UTC) + נרות OHLCV.
   withTime=true מחזיר גם שעה בשעון הבורסה (לגרף תוך־יומי, כולל מסחר מורחב). */
function parseYahooBars(json, withTime) {
  const rows = [];
  try {
    const chart = json && json.chart;
    const res = chart && chart.result && chart.result[0];
    if (!res || chart.error) return rows;
    const ts = res.timestamp || [];
    const ind = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
    const opens = ind.open || [], highs = ind.high || [], lows = ind.low || [],
          closes = ind.close || [], vols = ind.volume || [];
    const off = (res.meta && res.meta.gmtoffset) || 0;
    for (let i = 0; i < ts.length; i++) {
      const close = pf(closes[i]);
      if (!(close > 0)) continue;
      const d = new Date((ts[i] + off) * 1000);
      rows.push({
        date: d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()),
        time: withTime ? pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) : null,
        open: pf(opens[i]),
        high: pf(highs[i]),
        low: pf(lows[i]),
        close: close,
        volume: parseInt(vols[i], 10) || 0
      });
    }
  } catch (e) {}
  return rows;
}

/* מסווג שגיאת רשת למילים פשוטות — כדי שנראה מה קרה בטלפון */
function netErrName(e) {
  if (e && e.name === 'AbortError') return t('errTimeout');
  if (e instanceof TypeError) return t('errBlocked');
  if (e && e.message) return String(e.message).slice(0, 40);
  return t('errGeneric');
}

/* ניסיון אחד להביא נרות מ־Yahoo; מחזיר rows או null ורושם מה קרה */
async function fetchYahooBars(url, withTime, notes, name) {
  try {
    const rows = parseYahooBars(await fetchJSONTimeout(url, 12000), withTime);
    if (rows.length) return rows;
    notes.push(t('srcEmpty', { name }));
  } catch (e) { notes.push(name + ': ' + netErrName(e)); }
  return null;
}

/* ---------------- Twelve Data (היסטוריה לגרפים) ---------------- */
/* עובד ישירות מהדפדפן (CORS מאושר), זמן אמת בחינם.
   דורש מפתח חינמי — נשמר ב־localStorage בטלפון בלבד, לעולם לא בקוד/בריפו. */
const LS_TDKEY = 'pwa_tdkey_v1';
const LS_INTRA = 'pwa_intra_v1_'; // + sym — מטמון תוך־יומי קצר (10 דקות)

function tdKey() {
  try { return (localStorage.getItem(LS_TDKEY) || '').trim(); } catch (e) { return ''; }
}

const tdURL = (sym, interval, outputsize) =>
  'https://api.twelvedata.com/time_series?symbol=' + encodeURIComponent(sym.toUpperCase()) +
  '&interval=' + interval + '&outputsize=' + outputsize +
  '&timezone=America/New_York&order=ASC&apikey=' + encodeURIComponent(tdKey());

/* מפענח תשובת Twelve Data time_series לשורות הגרף.
   withTime=true לגרף תוך־יומי (datetime כולל שעה, שעון ניו־יורק). */
function parseTwelveBars(json, withTime) {
  const rows = [];
  try {
    const vals = json && json.values;
    if (!Array.isArray(vals)) return rows;
    for (const v of vals) {
      if (!v || typeof v !== 'object') continue;
      const close = pf(v.close);
      if (!(close > 0)) continue;
      const m = String(v.datetime || '').match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
      if (!m) continue;
      rows.push({
        date: m[1],
        time: withTime ? (m[2] || null) : null,
        open: pf(v.open),
        high: pf(v.high),
        low: pf(v.low),
        close: close,
        volume: parseInt(v.volume, 10) || 0
      });
    }
  } catch (e) {}
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    const ta = a.time || '', tb = b.time || '';
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });
  return rows;
}

/* מגבלת התוכנית החינמית: 8 קריאות/דקה — מרווחים קריאות כדי לא להיחסם (429) */
let tdLastAt = 0;
function tdThrottle() {
  const now = Date.now();
  const wait = 8000 - (now - tdLastAt);
  tdLastAt = Math.max(now, tdLastAt + 8000);
  return wait > 0 ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

/* ניסיון אחד להביא נרות מ־Twelve Data.
   kind: 'daily' | 'intraday'. מחזיר rows, null, או 'BADKEY' כשהמפתח לא תקין. */
async function fetchTwelveBars(sym, kind, wantMax, notes) {
  if (!tdKey()) return null;
  await tdThrottle();
  const intraday = kind === 'intraday';
  const url = tdURL(sym, intraday ? '5min' : '1day', intraday ? 250 : (wantMax ? 5000 : 1500));
  try {
    const json = await fetchJSONTimeout(url, 15000);
    if (json && (json.status === 'error' || (json.code && json.code >= 400))) {
      const msg = String((json && json.message) || json.code || t('errGeneric'));
      notes.push('TwelveData: ' + msg.slice(0, 60));
      if (json.code === 401 || /invalid|unauthorized|api\s?key/i.test(msg)) return 'BADKEY';
      return null;
    }
    const rows = parseTwelveBars(json, intraday);
    if (rows.length) return rows;
    notes.push(t('srcEmpty', { name: 'TwelveData' }));
  } catch (e) {
    // מפתח לא תקין מגיע כ־HTTP 401 (זריקה), לא כ־JSON
    if (e && /http 401/.test(e.message || '')) {
      notes.push(t('tdKeyRejected'));
      return 'BADKEY';
    }
    notes.push('TwelveData: ' + netErrName(e));
  }
  return null;
}

/* מפתח לא תקין — מוחקים אותו מהטלפון ומציגים שוב את כרטיס ההזנה */
function clearTdKey(notes) {
  try { localStorage.removeItem(LS_TDKEY); } catch (e) {}
  notes.push(t('tdBadKey'));
  switchTab('settings');
  renderTdKeyStatus();
}

/* סינון טווח מתוך היסטוריה יומית ממוינת (ישן -> חדש) */
function filterRange(rows, range) {
  if (!rows || !rows.length) return [];
  const n = rows.length;
  switch (range) {
    case 'week':  return rows.slice(-5);
    case 'month': return rows.slice(-22);
    case 'ytd': {
      const y = rows[n - 1].date.slice(0, 4);
      return rows.filter((r) => r.date.slice(0, 4) === y);
    }
    case 'year':  return rows.slice(-252);
    case '3y':    return rows.slice(-756);
    case '5y':    return rows.slice(-1260);
    case 'max':
    default:      return rows.slice();
  }
}

/* דילול נקודות לציור חלק */
function downsample(rows, max) {
  if (rows.length <= max) return rows;
  const step = rows.length / max;
  const out = [];
  for (let i = 0; i < max; i++) out.push(rows[Math.floor(i * step)]);
  out.push(rows[rows.length - 1]);
  return out;
}

/* ---------------- חיבור ברוקר (IBKR Flex) — אופציונלי ----------------
   דוח קריאה־בלבד, לא מאפשר מסחר. הטוקן נשמר בטלפון בלבד (localStorage),
   לעולם לא בענן ולא בקוד. הנתונים הידניים (DB) לא נפגעים — נתוני IBKR
   נשמרים בנפרד ומוצגים בנפרד. */

const LS_IBKR = 'pwa_ibkr_v1';
const IBKR_PROXY_DEFAULT = 'https://ibkr-proxy-wine.vercel.app';

function ibkrCfg() {
  try { return JSON.parse(localStorage.getItem(LS_IBKR) || 'null') || {}; }
  catch (e) { return {}; }
}
function ibkrSaveCfg(patch) {
  const c = Object.assign({}, ibkrCfg(), patch);
  try { localStorage.setItem(LS_IBKR, JSON.stringify(c)); } catch (e) {}
  return c;
}
function ibkrProxyBase() {
  return (((ibkrCfg().proxyUrl || '') || IBKR_PROXY_DEFAULT).trim().replace(/\/+$/, ''));
}

/* מבקש מ־IBKR (דרך השרתון) ליצור דוח Flex. מחזיר { referenceCode, statementUrl }. */
async function ibkrRequestReport(fetchFn, proxyUrl, token, queryId) {
  const r = await fetchFn(proxyUrl + '/api/flex-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, queryId })
  });
  let j = null;
  try { j = await r.json(); } catch (e) {}
  if (!j || j.ok !== true || !j.referenceCode) {
    throw new Error(j && j.error ? t('proxyPrefix') + j.error : t('proxyBadResponse'));
  }
  return j;
}

/* שואל את השרתון שוב ושוב עד שהדוח מוכן (IBKR מייצר אותו בדיליי).
   מחזיר את data המפורסר. הטוקן עובר ב־body בלבד, לא ב־URL. */
async function ibkrPollStatement(fetchFn, proxyUrl, token, code, statementUrl, opts) {
  const o = opts || {};
  const tries = o.tries || 20;
  const delayMs = o.delayMs || 8000;
  const sleep = o.sleep || ((ms) => new Promise((res) => setTimeout(res, ms)));
  let netErr = null;
  for (let i = 0; i < tries; i++) {
    let j = null;
    try {
      const r = await fetchFn(proxyUrl + '/api/flex-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code, statementUrl: statementUrl || '' })
      });
      j = await r.json();
    } catch (e) { netErr = e; }
    if (j && j.ok === true && j.status === 'ready' && j.data) return j.data;
    if (j && j.ok === false) {
      throw new Error(j.error ? t('proxyPrefix') + j.error : t('proxyErr'));
    }
    await sleep(delayMs); // pending או כשל רשת חולף — מנסים שוב
  }
  throw new Error(netErr ? t('netPrefix') + netErr.message : t('reportTimeout'));
}

function ibkrShowErr(msg) {
  const e = document.getElementById('ibkrErr');
  if (e) { e.textContent = msg; e.classList.remove('hidden'); }
}
/* מתרגם קודי שגיאה טכניים של IBKR/השרתון לעברית פשוטה. */
function ibkrFriendlyErr(msg) {
  const m = String(msg || '').match(/flex_(\d+)|ibkr_http_(\d+)|rate_limited|bad_params|fetch_failed/);
  const code = m ? (m[1] || m[2] || m[0]) : '';
  switch (code) {
    case '1001': case '1004': case '1009': case '1019': case '1021':
      return t('ibkrErr1001');
    case '1020':
      return t('ibkrErrRate');
    case '1012':
      return t('ibkrErrTokenExp');
    case '1013':
      return t('ibkrErrTokenIp');
    case '1014':
      return t('ibkrErrQuery');
    case '1015':
      return t('ibkrErrTokenBad');
    case '1016':
      return t('ibkrErrAccount');
    case '1017':
      return t('ibkrErrCode');
    case '1018': case 'rate_limited':
      return t('ibkrErrMany');
    case '403':
      return t('ibkrErrBlocked');
    case 'bad_params':
      return t('ibkrErrCreds');
    case 'fetch_failed':
      return t('ibkrErrNet');
    default:
      return msg;
  }
}
function ibkrClearErr() {
  const e = document.getElementById('ibkrErr');
  if (e) { e.textContent = ''; e.classList.add('hidden'); }
}
function ibkrSetBusy(busy) {
  ['ibkrSaveTest', 'ibkrSyncImport', 'ibkrDisconnect'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.disabled = !!busy;
  });
}

function renderIbkrCard() {
  const cfg = ibkrCfg();
  const px = document.getElementById('ibkrProxy');
  const tk = document.getElementById('ibkrToken');
  const qd = document.getElementById('ibkrQuery');
  if (px && !px.value) px.value = cfg.proxyUrl || IBKR_PROXY_DEFAULT;
  if (tk && !tk.value) tk.value = cfg.token || '';
  if (qd && !qd.value) qd.value = cfg.queryId || '';
  const s = document.getElementById('ibkrStatus');
  const d = document.getElementById('ibkrData');
  const connected = !!(cfg.proxyUrl && cfg.token && cfg.queryId);
  if (s) {
    s.textContent = !connected
      ? t('ibkrNotConnected')
      : cfg.lastSync
        ? t('ibkrConnectedSynced', { time: fmtTimeIL(cfg.lastSync) })
        : t('ibkrConnectedNever');
  }
  if (d) {
    const data = cfg.data;
    d.textContent = (connected && data)
      ? t('ibkrDataSummary', { n: (data.positions || []).length, m: (data.trades || []).length, k: (data.cashTransactions || []).length })
      : '';
  }
}

async function ibkrSaveAndTest() {
  ibkrClearErr();
  const proxyUrl = (document.getElementById('ibkrProxy').value || '').trim().replace(/\/+$/, '');
  const token = (document.getElementById('ibkrToken').value || '').trim();
  const queryId = (document.getElementById('ibkrQuery').value || '').trim();
  if (!proxyUrl) return ibkrShowErr(t('proxyUrlMissing'));
  if (!token || !queryId) return ibkrShowErr(t('credsMissing'));
  ibkrSaveCfg({ proxyUrl, token, queryId });
  ibkrSetBusy(true);
  renderIbkrCard();
  try {
    const rep = await ibkrRequestReport(fetch, proxyUrl, token, queryId);
    ibkrSaveCfg({ statementUrl: rep.statementUrl || '' });
    flash(t('connOk'));
  } catch (e) {
    ibkrShowErr(t('testFailed', { err: ibkrFriendlyErr(e.message) }));
  }
  ibkrSetBusy(false);
  renderIbkrCard();
}

/* סנכרון וייבוא מ־IBKR בלחיצה אחת: מושך דוח טרי, מאחד לוטות לפי סימבול,
   מבקש אישור עם סיכום, ומחליף מניות (+מזומן, רק אם נמצא בדוח).
   פנסיה והפקדות לא נפגעות. */
async function ibkrSyncImport() {
  ibkrClearErr();
  const cfg = ibkrCfg();
  const proxyUrl = ibkrProxyBase();
  if (!proxyUrl) return ibkrShowErr(t('proxyUrlMissing'));
  if (!cfg.token || !cfg.queryId) return ibkrShowErr(t('credsMissingSave'));
  ibkrSetBusy(true);
  try {
    const s = document.getElementById('ibkrStatus');
    if (s) s.textContent = t('reqReport');
    const rep = await ibkrRequestReport(fetch, proxyUrl, cfg.token, cfg.queryId);
    if (s) s.textContent = t('genReport');
    const data = await ibkrPollStatement(fetch, proxyUrl, cfg.token, rep.referenceCode, rep.statementUrl || cfg.statementUrl);
    ibkrSaveCfg({ lastSync: Date.now(), statementUrl: rep.statementUrl || cfg.statementUrl || '', data });
    const imp = ibkrMapImport(data);
    if (!imp.positions.length) {
      ibkrShowErr(t('importNoStocks') + (imp.skipped ? t('importSkippedNote', { n: imp.skipped }) : ''));
      return;
    }
    const cashLine = imp.cash
      ? t('importCashLine', { usd: imp.cash.usd, ils: imp.cash.ils })
      : t('importCashMissing');
    const msg = t('importConfirm', {
      n: imp.positions.length,
      lots: imp.lots,
      cashLine,
      skipped: imp.skipped ? '\n' + t('importSkippedNote', { n: imp.skipped }).trim() : ''
    });
    if (!confirm(msg)) return;
    DB.positions = imp.positions;
    if (imp.cash) DB.cash = { usd: imp.cash.usd, ils: imp.cash.ils };
    saveDB();
    renderAll();
    refreshQuotes();
    flash(t('importedOk', { n: imp.positions.length }));
  } catch (e) {
    ibkrShowErr(t('importFailed', { err: ibkrFriendlyErr(e.message) }));
  } finally {
    ibkrSetBusy(false);
    renderIbkrCard();
  }
}

/* ממפה נתוני IBKR מסונכרנים למבנה התיק של האפליקציה (פונקציה טהורה — נבדקת).
   הדוח מחזיר שורה לכל קנייה (לוט); כאן מאחדים לפי סימבול: כמויות מסוכמות
   ומחיר ממוצע משוקלל לפי עלות כוללת. רק מניות (STK) דולריות בכמות חיובית.
   מחזיר { positions:[{sym,name,full,shares,avg}], lots, cash:{usd,ils}|null, skipped }.
   cash הוא null כשאין יתרות מזומן בדוח — כדי לא לדרוס מזומן קיים באפס. */
function ibkrMapImport(data) {
  const d = data || {};
  const bySym = new Map();
  let skipped = 0, lots = 0;
  for (const p of (d.positions || [])) {
    const qty = Number(p.qty) || 0;
    const sym = String(p.symbol || '').trim();
    const isStock = !p.asset || p.asset === 'STK';
    if (!(qty > 0) || !sym || !isStock || p.currency !== 'USD') { skipped++; continue; }
    lots++;
    const cb = Math.abs(Number(p.costBasis) || 0);
    let e = bySym.get(sym);
    if (!e) { e = { sym, shares: 0, cost: 0, mp: 0 }; bySym.set(sym, e); }
    e.shares += qty;
    e.cost += cb;
    const mp = Number(p.markPrice) || 0;
    if (mp > 0) e.mp = mp;
  }
  const positions = [];
  for (const e of bySym.values()) {
    const avg = e.cost > 0 ? e.cost / e.shares : e.mp;
    positions.push({ sym: e.sym, name: e.sym, full: '', shares: e.shares, avg: avg > 0 ? avg : 0 });
  }
  let usd = 0, ils = 0, hasCash = false;
  for (const c of (d.cashBalances || [])) {
    const b = Number(c.balance) || 0;
    if (c.currency === 'USD') { usd += b; hasCash = true; }
    else if (c.currency === 'ILS') { ils += b; hasCash = true; }
  }
  const r2 = (v) => Math.round(v * 100) / 100;
  return { positions, lots, cash: hasCash ? { usd: r2(usd), ils: r2(ils) } : null, skipped };
}

function ibkrDisconnect() {
  ibkrClearErr();
  if (!confirm(t('disconnectConfirm'))) return;
  ibkrSaveCfg({ token: '', queryId: '', statementUrl: '', lastSync: 0, data: null });
  const tk = document.getElementById('ibkrToken');
  const qd = document.getElementById('ibkrQuery');
  if (tk) tk.value = '';
  if (qd) qd.value = '';
  renderIbkrCard();
  flash(t('disconnected'));
}

/* מחיר סגירה קודם לחישוב שינוי יומי (מתמודד עם סופ"ש/חג) */
function prevCloseFor(quoteDate, hist) {
  if (!hist || !hist.length) return null;
  for (let i = hist.length - 1; i >= 0; i--) {
    if (hist[i].date < quoteDate) return hist[i].close;
  }
  return hist.length > 1 ? hist[hist.length - 2].close : null;
}

function athOf(hist) {
  if (!hist || !hist.length) return null;
  let best = hist[0];
  for (const r of hist) if (r.close > best.close) best = r;
  return { price: best.close, date: best.date };
}

/* ---------------- פורמט ---------------- */

function fmtUSD(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '$' + Math.round(v).toLocaleString('en-US');
}
function fmtUSD2(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtILS(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '₪' + Math.round(v).toLocaleString('en-US');
}
function fmtPct(v, signed) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const s = signed && v > 0 ? '+' : '';
  return s + v.toFixed(2) + '%';
}
function fmtDateIL(iso) { // YYYY-MM-DD -> DD/MM/YYYY
  if (!iso) return '—';
  const p = iso.split('-');
  return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
}
function fmtTimeIL(ts) {
  try {
    return new Date(ts).toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit'
    });
  } catch (e) { return '—'; }
}
function money(v, cur) { return cur === 'ILS' ? fmtILS(v) : fmtUSD(v); }

/* ---------------- נתוני ברירת מחדל — תיק דוגמה פיקטיבי ---------------- */
/* נשמרים בטלפון (localStorage) וניתנים לעריכה מהאפליקציה. */

/* מסד הנתונים המקומי — נטען פעם אחת, נשמר אחרי כל שינוי */
const LS_DB = 'pwa_db_v1';

/* תיק דוגמה — מה שמוצג למי שלא התחבר או למשתמש חדש במצב מקומי.
   הנתונים האמיתיים נשמרים רק בענן, בחשבון הפרטי של כל משתמש. */
const DEFAULT_DB = {
  v: 1,
  positions: [
    { sym: 'GOOGL', name: 'גוגל', full: 'Alphabet Inc',      shares: 10, avg: 140.00 },
    { sym: 'META',  name: 'מטא',  full: 'Meta Platforms Inc', shares: 5,  avg: 480.00 }
  ],
  deposits: [{ date: '01/01/2026', amount: -1000, place: 'הפקדת דוגמה' }],
  pensionFunds: [{ name: 'פנסיה — מקום עבודה', usd: 0, ils: 1000 }],
  pensionDeposits: [],
  cash: { usd: 100, ils: 100 }
};

/* גרסת האפליקציה — מוצגת בהגדרות כדי לוודא שהטלפון מעודכן */
const APP_VERSION = 'v30';


function saveDBto(db) {
  try { localStorage.setItem(LS_DB, JSON.stringify(db)); } catch (e) {}
}
function loadDB() {
  try {
    const raw = localStorage.getItem(LS_DB);
    if (raw) {
      const db = JSON.parse(raw);
      if (db && db.v === 1 && Array.isArray(db.positions) && Array.isArray(db.deposits)) {
        if (!db.cash) db.cash = { usd: 0, ils: 0 };
        if (!Array.isArray(db.pensionFunds)) db.pensionFunds = [];
        ensurePensionKinds(db);
        return db;
      }
    }
  } catch (e) {}
  const db = JSON.parse(JSON.stringify(DEFAULT_DB));
  ensurePensionKinds(db);
  saveDBto(db);
  return db;
}
const DB = loadDB();
function saveDB() { saveDBto(DB); if (window.__cloudSave) window.__cloudSave(); }

/* תיק דוגמה — למי שאין לו נתונים: משתמש חדש, אחרי איפוס, או לא מחובר */
function demoDb() {
  return JSON.parse(JSON.stringify(DEFAULT_DB));
}

/* מחיל נתונים על ה-DB החי — במקום, כדי לא לשבור הפניות קיימות */
function applyDbData(data) {
  const clean = JSON.parse(JSON.stringify(data || {}));
  if (!Array.isArray(DB.positions)) DB.positions = [];
  if (!Array.isArray(DB.deposits)) DB.deposits = [];
  if (!Array.isArray(DB.pensionFunds)) DB.pensionFunds = [];
  if (!Array.isArray(DB.pensionDeposits)) DB.pensionDeposits = [];
  DB.positions.length = 0;
  if (Array.isArray(clean.positions)) DB.positions.push(...clean.positions);
  DB.deposits.length = 0;
  if (Array.isArray(clean.deposits)) DB.deposits.push(...clean.deposits);
  DB.pensionFunds.length = 0;
  if (Array.isArray(clean.pensionFunds)) DB.pensionFunds.push(...clean.pensionFunds);
  ensurePensionKinds(DB);
  DB.pensionDeposits.length = 0;
  if (Array.isArray(clean.pensionDeposits)) DB.pensionDeposits.push(...clean.pensionDeposits);
  const c = clean.cash || {};
  DB.cash = { usd: num(c.usd) || 0, ils: num(c.ils) || 0 };
  saveDBto(DB);
}

/* שמות תואמים לקוד הקיים — מצביעים לאותם מערכים; עריכה תמיד במקום (push/splice) */
let POSITIONS = DB.positions;
let DEPOSITS = DB.deposits;
let PENSION_FUNDS = DB.pensionFunds;
let PENSION_DEPOSITS = DB.pensionDeposits;

/* סך הפקדות נטו — מחושב מהרשומות (סכום שלילי = כסף שנכנס לתיק) */
function netDepositsILS() {
  return -DEPOSITS.reduce((a, d) => a + (num(d.amount) || 0), 0);
}

/* מזומן במטבע התצוגה */
function cashInCur(cur) {
  const c = (DB && DB.cash) || { usd: 0, ils: 0 };
  if (cur === 'ILS' && state.fx) return (c.ils || 0) + (c.usd || 0) * state.fx;
  return (c.usd || 0) + (state.fx && c.ils ? c.ils / state.fx : 0);
}

/* ---------------- מקורות נתונים ---------------- */
/* מחירים חיים: Yahoo (ראשי) ← CNBC (גיבוי). היסטוריה ומסחר מורחב: Twelve Data (ראשי) ← Yahoo ← Stooq. */

const stooqDailyURL = (sym) => 'https://stooq.com/q/d/l/?s=' + sym.toLowerCase() + '.us&i=d';
const stooqIntradayURL = (sym) => 'https://stooq.com/q/d/l/?s=' + sym.toLowerCase() + '.us&i=5';

/* Yahoo Finance v8 — ללא מפתח, כולל מסחר מורחב (includePrePost) */
const yahooURL = (sym, params, host) =>
  'https://' + (host || 'query1') + '.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym.toUpperCase()) + '?' + params;
const yahooQuoteURL = (sym) => yahooURL(sym, 'interval=1d&range=5d');

const LS_QUOTES = 'pwa_quotes_v2'; // v2: ניקוי מטמון ישן שסומן כ־Stooq
const LS_HIST = 'pwa_hist_v1_'; // + sym

const PIE_COLORS = ['#006A4E','#2E7D32','#1565C0','#5E35B1','#C2185B','#E65100','#B7791F','#00838F','#6D4C41'];

/* ---------------- מצב ---------------- */

const state = {
  currency: 'USD',
  quotes: {},       // sym -> quote
  fx: null,         // USDILS
  source: null,     // מאיזה מקור הגיעו המחירים (Yahoo / CNBC)
  quotesAt: null,
  stale: false,     // מוצגים נתונים שמורים (אין חיבור)
  hist: {},         // sym -> daily rows
  intra: {},        // sym -> intraday rows (יום)
  histDbg: {},      // sym -> מה קרה בניסיון להביא היסטוריה (לאבחון)
  open: {},         // sym -> bool (שורה פתוחה)
  range: {},        // sym -> 'day'|'week'|'month'|'ytd'|'year'|'5y'|'max'
  measure: {},      // sym -> { on, pts:[idxA, idxB] }
  pfRange: '5y',    // טווח גרף ביצועי התיק
  edit: { stocks: false, deposits: false, pension: false },  // מצב עריכה (מוגן מטעויות)
  lang: getLang()   // 'he' | 'en' — נשמר ברמת המכשיר בלבד (pwa_lang_v1)
};

const RANGES = [
  ['day', 'rangeDay'], ['week', 'rangeWeek'], ['month', 'rangeMonth'], ['ytd', 'rangeYtd'],
  ['year', 'rangeYear'], ['5y', 'range5y'], ['max', 'rangeMax']
];

function lsGet(k) {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; }
}
function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
}

/* ---------------- רשת ---------------- */

async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: n }, async () => {
    while (i < items.length) {
      const idx = i++;
      try { out[idx] = await fn(items[idx]); } catch (e) { out[idx] = null; }
    }
  });
  await Promise.all(workers);
  return out;
}

/* ---------------- מקורות מחיר (רשת) ---------------- */
/* סדר הניסיון: Yahoo ← CNBC ← נתונים שמורים. */

async function fetchTextTimeout(url, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
    if (!res.ok) throw new Error('http ' + res.status);
    return res.text();
  } finally { clearTimeout(timer); }
}

async function fetchJSONTimeout(url, ms) {
  return JSON.parse(await fetchTextTimeout(url, ms));
}

function num(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(/,/g, '').replace('%', '').trim());
  return isFinite(n) ? n : null;
}

function todayISO() {
  const d = new Date();
  const p2 = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
}

/* --- כתובת CNBC (גיבוי; נבנית מחדש אחרי כל שינוי ברשימת המניות) --- */
const cnbcURL = () =>
  'https://quote.cnbc.com/quote-html-webservice/restQuote/symbolType/symbol?symbols=' +
  POSITIONS.map((p) => p.sym.toUpperCase()).join('|') +
  '&requestMethod=quick&noform=1&partnerId=2&fund=1&exthrs=1&output=json';

function parseCNBCQuotes(json) {
  const out = {};
  const fqr = (json && json.FormattedQuoteResult) || {};
  let arr = fqr.FormattedQuote || [];
  if (!Array.isArray(arr)) arr = [arr];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const sym = String(it.symbol || '').toUpperCase();
    if (!sym) continue;
    const close = num(it.last);
    if (!(close > 0)) continue;
    out[sym] = {
      symbol: sym,
      date: todayISO(),
      time: String(it.last_time || ''),
      open: num(it.open),
      high: num(it.high),
      low: num(it.low),
      close: close,
      volume: parseInt(String(it.volume || '').replace(/,/g, ''), 10) || 0
    };
  }
  return out;
}

async function tryFx() {
  const urls = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.frankfurter.app/latest?from=USD&to=ILS'
  ];
  for (const u of urls) {
    try {
      const j = await fetchJSONTimeout(u, 8000);
      const r = num(j && j.rates && j.rates.ILS);
      if (r > 0) return r;
    } catch (e) {}
  }
  throw new Error('no fx');
}

async function tryCNBCQuotes() {
  const [json, fx] = await Promise.all([
    fetchJSONTimeout(cnbcURL(), 10000),
    tryFx()
  ]);
  const q = parseCNBCQuotes(json);
  const missing = POSITIONS.filter((p) => !q[p.sym]).length;
  if (missing > Math.max(1, Math.floor(POSITIONS.length / 2))) throw new Error('too few quotes');
  return { quotes: q, fx: fx, source: 'CNBC' };
}

function applyQuotes(res) {
  state.quotes = res.quotes;
  state.fx = res.fx;
  state.source = res.source;
  state.quotesAt = Date.now();
  state.stale = false;
  lsSet(LS_QUOTES, { at: state.quotesAt, fx: state.fx, quotes: res.quotes, source: res.source });
  setBanner(null);
  updateSourceLabel();
}

function updateSourceLabel() {
  const el = document.getElementById('sourceLabel');
  if (el) {
    el.textContent = t('sourceLabel', { src: state.source || '—', stale: state.stale ? t('staleSuffix') : '' });
  }
}

async function tryYahooQuotes() {
  const results = await pool(POSITIONS.map((p) => p.sym), 3, async (sym) => {
    try {
      const json = await fetchJSONTimeout(yahooQuoteURL(sym), 10000);
      const chart = json && json.chart;
      const res = chart && chart.result && chart.result[0];
      if (!res || chart.error) return null;
      const meta = res.meta || {};
      const close = num(meta.regularMarketPrice);
      if (!(close > 0)) return null;
      return {
        symbol: sym,
        date: todayISO(),
        time: '',
        open: null,
        high: num(meta.regularMarketDayHigh),
        low: num(meta.regularMarketDayLow),
        close: close,
        volume: parseInt(meta.regularMarketVolume, 10) || 0
      };
    } catch (e) { return null; }
  });
  const q = {};
  for (const r of results) if (r) q[r.symbol] = r;
  const missing = POSITIONS.filter((p) => !q[p.sym]).length;
  if (missing > Math.max(1, Math.floor(POSITIONS.length / 2))) throw new Error('too few quotes');
  const fx = await tryFx();
  return { quotes: q, fx: fx, source: 'Yahoo' };
}

async function refreshQuotes() {
  if (!POSITIONS.length) {
    try { state.fx = await tryFx(); } catch (e) { /* אין שער */ }
    state.quotes = {};
    state.quotesAt = Date.now();
    state.source = state.fx ? t('fxSource') : null;
    state.stale = false;
    setBanner('');
    updateSourceLabel();
    renderAll();
    return;
  }
  // מרוץ מקורות: Yahoo ו־CNBC במקביל — מי שמגיב ראשון מנצח.
  // ככה לא מחכים ל-timeout של מקור חסום ברשת של המשתמש.
  try {
    const res = await Promise.any([tryYahooQuotes(), tryCNBCQuotes()]);
    applyQuotes(res); renderAll(); return;
  } catch (e) { /* שניהם נכשלו — נופלים לנתונים שמורים */ }
  const cached = lsGet(LS_QUOTES);
  if (cached && cached.quotes && cached.fx) {
    state.quotes = cached.quotes;
    state.fx = cached.fx;
    state.quotesAt = cached.at;
    state.source = cached.source || null;
    state.stale = true;
    setBanner(t('noPriceConn', { time: fmtTimeIL(cached.at) }));
  } else {
    state.source = null;
    setBanner(t('noPrices'));
  }
  updateSourceLabel();
  renderAll();
}

async function getDaily(sym, force) {
  const wantMax = state.range[sym] === 'max';
  if (!force && !wantMax) {
    if (state.hist[sym]) return state.hist[sym];
    const cached = lsGet(LS_HIST + sym);
    if (cached && cached.rows && cached.rows.length) {
      const dayOld = new Date(cached.at).toDateString() !== new Date().toDateString();
      if (!dayOld) { state.hist[sym] = cached.rows; return cached.rows; }
    }
  }
  const save = (rows) => {
    state.hist[sym] = rows;
    state.histDbg[sym] = null;
    lsSet(LS_HIST + sym, { at: Date.now(), rows: rows });
    return rows;
  };
  const notes = [];
  const td = await fetchTwelveBars(sym, 'daily', wantMax, notes);
  if (td === 'BADKEY') clearTdKey(notes);
  else if (td) return save(td);
  const dq = (host) => yahooURL(sym, 'interval=1d&range=' + (wantMax ? 'max' : '5y'), host);
  let rows = await fetchYahooBars(dq('query1'), false, notes, 'Yahoo')
          || await fetchYahooBars(dq('query2'), false, notes, 'Yahoo2');
  if (rows) return save(rows);
  try {
    rows = parseHistoryCSV(await fetchTextTimeout(stooqDailyURL(sym), 12000));
    if (rows.length) return save(rows);
    notes.push(t('srcEmpty', { name: 'Stooq' }));
  } catch (e) { notes.push('Stooq: ' + netErrName(e)); }
  state.histDbg[sym] = notes.join(' · ');
  const cached = lsGet(LS_HIST + sym);
  if (cached && cached.rows) { state.hist[sym] = cached.rows; return cached.rows; }
  return [];
}

async function getIntraday(sym) {
  if (state.intra[sym]) return state.intra[sym];
  // מטמון קצר (10 דקות) לחיסכון במכסת הקריאות החינמית
  const cached = lsGet(LS_INTRA + sym);
  if (cached && cached.rows && cached.rows.length && (Date.now() - cached.at) < 10 * 60 * 1000) {
    state.intra[sym] = cached.rows;
    return cached.rows;
  }
  const notes = [];
  const td = await fetchTwelveBars(sym, 'intraday', false, notes);
  if (td === 'BADKEY') clearTdKey(notes);
  else if (td) {
    state.intra[sym] = td;
    lsSet(LS_INTRA + sym, { at: Date.now(), rows: td });
    return td;
  }
  const iq = (host) => yahooURL(sym, 'interval=5m&range=1d&includePrePost=true', host);
  let rows = await fetchYahooBars(iq('query1'), true, notes, 'Yahoo')
          || await fetchYahooBars(iq('query2'), true, notes, 'Yahoo2');
  if (rows) { state.intra[sym] = rows; return rows; }
  try {
    rows = parseHistoryCSV(await fetchTextTimeout(stooqIntradayURL(sym), 12000));
    if (rows.length) { state.intra[sym] = rows; return rows; }
  } catch (e) {}
  return [];
}

async function warmHistories() {
  await pool(POSITIONS.map((p) => p.sym), 3, (sym) => getDaily(sym, false));
  renderStocks();
  renderOverview();
}

/* ---------------- חישובים ---------------- */

function metrics(sym) {
  const p = POSITIONS.find((x) => x.sym === sym);
  const q = state.quotes[sym];
  const price = q ? q.close : null;
  const hist = state.hist[sym] || [];
  let dayChg = null;
  if (q && hist.length) {
    const pc = prevCloseFor(q.date, hist);
    if (pc) dayChg = (q.close - pc) / pc * 100;
  }
  const value = price !== null ? price * p.shares : null;
  const gl = price !== null ? (price - p.avg) * p.shares : null;
  const ath = athOf(hist);
  const offAth = (ath && price !== null) ? (price - ath.price) / ath.price * 100 : null;
  return { p, q, price, dayChg, value, gl, ath, offAth };
}

function totalsUSD() {
  let stockVal = 0;
  for (const p of POSITIONS) {
    const q = state.quotes[p.sym];
    if (q) stockVal += q.close * p.shares;
  }
  const usd = (DB.cash && DB.cash.usd) || 0;
  const ils = (DB.cash && DB.cash.ils) || 0;
  return { stockVal: stockVal, total: stockVal + usd + (state.fx ? ils / state.fx : 0) };
}

function depositsInCur() {
  const nd = netDepositsILS();
  return state.currency === 'ILS' ? nd : (state.fx ? nd / state.fx : null);
}

/* ---------------- DOM ---------------- */

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function flash(msg) {
  let toastEl = document.getElementById('toast');
  if (!toastEl) {
    toastEl = el('div', 'toast');
    toastEl.id = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._h);
  toastEl._h = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function setBanner(msg) {
  const b = document.getElementById('statusBanner');
  if (!msg) { b.classList.add('hidden'); b.textContent = ''; return; }
  b.classList.remove('hidden');
  b.textContent = msg;
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tabpage').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
}

/* ---------------- רינדור: סקירה ---------------- */

function renderOverview() {
  const cur = state.currency;
  const tot = totalsUSD();
  const total = cur === 'ILS' && state.fx ? tot.total * state.fx : tot.total;
  const stockVal = cur === 'ILS' && state.fx ? tot.stockVal * state.fx : tot.stockVal;
  const dep = depositsInCur();
  const gl = (dep !== null) ? total - dep : null;
  const yld = (dep && dep !== 0 && gl !== null) ? gl / dep * 100 : null;

  const vEl = document.getElementById('ovValue');
  vEl.textContent = money(total, cur);
  document.getElementById('ovValueSub').textContent =
    t('ovBreakdown', { a: money(stockVal, cur), b: money(cashInCur(cur), cur) });

  const gEl = document.getElementById('ovGL');
  if (gl === null) { gEl.textContent = '—'; }
  else { gEl.textContent = (gl < 0 ? '−' : '+') + money(Math.abs(gl), cur); }
  gEl.className = 'stat-value ' + (gl === null ? '' : gl >= 0 ? 'pos' : 'neg');

  const yEl = document.getElementById('ovYield');
  yEl.textContent = fmtPct(yld, true);
  yEl.className = 'stat-value ' + (yld === null ? '' : yld >= 0 ? 'pos' : 'neg');

  document.getElementById('ovMeta').textContent =
    t('ovUpdated', { time: state.quotesAt ? fmtTimeIL(state.quotesAt) : '—' }) +
    (state.fx ? ' · $=₪' + state.fx.toFixed(4) : '');

  drawPie();
  drawPfChart();
}

function drawPie() {
  const canvas = document.getElementById('pieChart');
  const tot = totalsUSD();
  const slices = POSITIONS.map((p, i) => {
    const q = state.quotes[p.sym];
    const v = q ? q.close * p.shares : 0;
    return { sym: p.sym, name: p.name, value: v, color: PIE_COLORS[i % PIE_COLORS.length] };
  }).filter((s) => s.value > 0);
  const total = slices.reduce((a, s) => a + s.value, 0);

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = 220;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (!total) {
    ctx.fillStyle = cssVar('--on-surface-var', '#9AA5A0'); ctx.font = '15px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(t('noPriceYet'), w / 2, h / 2);
    return;
  }
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 10, r = R * 0.62;
  let a = -Math.PI / 2;
  for (const s of slices) {
    const a2 = a + (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, a, a2);
    ctx.arc(cx, cy, r, a2, a, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    a = a2;
  }
  ctx.fillStyle = cssVar('--on-surface', '#191C1A'); ctx.textAlign = 'center';
  ctx.font = '700 13px system-ui';
  ctx.fillText(t('totalStocks'), cx, cy - 4);
  ctx.font = '800 17px system-ui';
  const cur = state.currency;
  ctx.fillText(money(cur === 'ILS' && state.fx ? total * state.fx : total, cur), cx, cy + 18);

  const legend = document.getElementById('pieLegend');
  legend.innerHTML = '';
  const sorted = slices.slice().sort((a, b) => b.value - a.value);
  for (const s of sorted) {
    const li = el('li', '',
      '<span class="dot" style="background:' + s.color + '"></span>' +
      '<span class="lg-name">' + s.name + ' (' + s.sym + ')</span>' +
      '<span class="lg-val">' + money(cur === 'ILS' && state.fx ? s.value * state.fx : s.value, cur) + '</span>' +
      '<span class="lg-pct">' + (s.value / total * 100).toFixed(1) + '%</span>');
    legend.appendChild(li);
  }
}

/* ---------------- גרף ביצועי התיק + בנצ'מרק S&P 500 ---------------- */

const PF_RANGES = [['year', 'rangeYear'], ['3y', 'range3y'], ['5y', 'range5y'], ['max', 'rangeMax']];

/* מחיר סגירה אחרון עד תאריך נתון (היסטוריה ממוינת ישן -> חדש) */
function closeOnOrBefore(hist, date) {
  let lo = 0, hi = hist.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (hist[mid].date <= date) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans >= 0 ? hist[ans].close : null;
}


/* ---------------- היסטוריית שער דולר־שקל (לבנצ'מרק מותאם הפקדות) ---------------- */
/* מקור חינמי, בלי מפתח: Frankfurter. נשמר לצמיתות — היסטוריה לא משתנה. */
const LS_FXHIST = 'pwa_fxhist_v1';
let fxHistCache = null; // {dates:[iso], rates:{iso:rate}}

function parseDepDate(dstr) { // 'DD/MM/YYYY' -> 'YYYY-MM-DD'
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(dstr || '').trim());
  if (!m) return null;
  const iso = m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
  return isNaN(new Date(iso + 'T12:00:00Z')) ? null : iso;
}

function addDaysISO(iso, n) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function ensureFxHist() {
  if (fxHistCache) return fxHistCache;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS_FXHIST) || 'null'); } catch (e) {}
  const today = todayISO();
  let earliest = null;
  for (const d of DEPOSITS) {
    const iso = parseDepDate(d.date);
    if (iso && (!earliest || iso < earliest)) earliest = iso;
  }
  if (!earliest) earliest = addDaysISO(today, -5 * 365);
  const have = (saved && saved.rates) || {};
  const haveDates = Object.keys(have).sort();
  const lastHave = haveDates.length ? haveDates[haveDates.length - 1] : null;
  const rates = Object.assign({}, have);
  const fetchFrom = (lastHave && lastHave >= earliest) ? addDaysISO(lastHave, 1) : earliest;
  if (fetchFrom <= today) {
    let ok = false;
    try {
      const j = await fetchJSONTimeout(
        'https://api.frankfurter.dev/v1/' + fetchFrom + '..' + today + '?base=USD&symbols=ILS', 25000);
      if (j && j.rates) {
        for (const [dt, r] of Object.entries(j.rates)) if (r && r.ILS > 0) rates[dt] = r.ILS;
        ok = true;
      }
    } catch (e) { /* גיבוי: Twelve Data */ }
    if (!ok && tdKey()) {
      try {
        const rows = parseTwelveBars(await fetchJSONTimeout(tdURL('USD/ILS', '1day', 5000), 25000), false);
        for (const r of rows) if (r.date >= fetchFrom && r.close > 0) rates[r.date] = r.close;
        ok = rows.length > 0;
      } catch (e) {}
    }
    if (ok) {
      try { localStorage.setItem(LS_FXHIST, JSON.stringify({ rates: rates })); } catch (e) {}
    }
  }
  fxHistCache = { dates: Object.keys(rates).sort(), rates: rates };
  return fxHistCache;
}

/* שער דולר־שקל ביום נתון (או יום העסקים הקודם — סופ"ש/חג) */
function fxOnOrBefore(iso) {
  const c = fxHistCache;
  if (!c || !c.dates.length) return state.fx || null;
  let lo = 0, hi = c.dates.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (c.dates[mid] <= iso) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans >= 0 ? c.rates[c.dates[ans]] : null;
}

/* סדרת שווי התיק בשקלים לאורך זמן (אחזקות נוכחיות + מזומן).
   מגבלה ידועה: אין יומן קניות היסטורי, אז מניחים את האחזקות הנוכחיות לאורך כל התקופה. */
function portfolioSeriesILS() {
  const dates = new Set();
  for (const p of POSITIONS) for (const r of (state.hist[p.sym] || [])) dates.add(r.date);
  if (!dates.size) return [];
  const cashU = (DB.cash && DB.cash.usd) || 0;
  const cashI = (DB.cash && DB.cash.ils) || 0;
  const out = [];
  for (const d of [...dates].sort()) {
    const fx = fxOnOrBefore(d) || state.fx;
    if (!fx) continue;
    let v = cashI + cashU * fx;
    for (const p of POSITIONS) {
      const c = closeOnOrBefore(state.hist[p.sym] || [], d);
      if (c) v += c * p.shares * fx;
    }
    out.push({ date: d, value: v });
  }
  return out;
}

/* סך תשואת קרן (פנסיה / השתלמות) — כמו תשואת התיק: שווי נוכחי מול סך הפקדות.
   תמיד בשקלים (ההפקדות והשווי העיקרי בשקלים). kind: 'pension' | 'study'.
   רשומות ישנות בלי kind נחשבות פנסיה. */
function fundKindReturn(kind) {
  const fx = state.fx;
  let val = 0, hasAny = false;
  for (const f of PENSION_FUNDS) {
    if ((f.kind || 'pension') !== kind) continue;
    hasAny = true;
    val += (num(f.ils) || 0) + (fx ? (num(f.usd) || 0) * fx : 0);
  }
  let dep = 0;
  for (const r of PENSION_DEPOSITS) {
    if ((r.kind || 'pension') !== kind) continue;
    hasAny = true;
    dep += -(num(r.amount) || 0);
  }
  if (!hasAny || !(dep > 0)) return null;
  return (val / dep - 1) * 100;
}

/* שיוך סוג אוטומטי לקרנות ישנות לפי השם — רץ בכל טעינה, אבל נוגע
   רק בקרנות שעוד לא הוגדר להן kind במפורש (לא דורס בחירת משתמש).
   מנורה = פנסיה; הפניקס/מיטב/״השתלמות״ = קרן השתלמות. */
function ensurePensionKinds(db) {
  const funds = (db || DB).pensionFunds || [];
  let changed = false;
  for (const f of funds) {
    if (f.kind === 'pension' || f.kind === 'study') continue;
    const nm = String(f.name || '');
    f.kind = /מיטב|פניקס|השתלמות/.test(nm) ? 'study' : 'pension';
    changed = true;
  }
  return changed;
}

/* הוספת קרן חדשה (פנסיה / השתלמות) — לשימוש עתידי מההגדרות */
function addPensionFund(name, kind) {
  const nm = String(name || '').trim();
  if (!nm) return null;
  const f = { name: nm, usd: 0, ils: 0, kind: kind === 'study' ? 'study' : 'pension' };
  DB.pensionFunds.push(f);
  saveDB();
  return f;
}

function renderPfChips() {
  const box = document.getElementById('pfChips');
  if (!box || box.children.length) return;
  for (const [key, label] of PF_RANGES) {
    const b = el('button', 'range-btn' + (state.pfRange === key ? ' active' : ''), t(label));
    b.type = 'button';
    b.addEventListener('click', () => {
      state.pfRange = key;
      box.querySelectorAll('.range-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      drawPfChart();
    });
    box.appendChild(b);
  }
}

/* גרף שווי התיק בשקלים לאורך זמן (לפי האחזקות הנוכחיות — אין יומן קניות היסטורי) */
let pfChartToken = 0;
async function drawPfChart() {
  const canvas = document.getElementById('pfChart');
  const loading = document.getElementById('pfLoading');
  const legend = document.getElementById('pfLegend');
  if (!canvas) return;
  renderPfChips();
  const my = ++pfChartToken;
  if (loading) {
    loading.textContent = tdKey() ? t('loadingHist') : t('chartNeedsKey');
    loading.classList.remove('hidden');
  }

  await ensureFxHist();
  if (my !== pfChartToken) return;

  const pf = filterRange(portfolioSeriesILS(), state.pfRange);
  if (!pf.length) {
    if (loading) { loading.textContent = t('noChartNow'); loading.classList.remove('hidden'); }
    if (legend) legend.innerHTML = '';
    return;
  }
  if (loading) loading.classList.add('hidden');
  const pfD = downsample(pf, 300);

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = 210;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  let min = Infinity, max = -Infinity;
  for (const p of pfD) { if (p.value < min) min = p.value; if (p.value > max) max = p.value; }
  if (min === max) { min *= 0.99; max *= 1.01; }
  const padL = 6, padR = 46, padT = 10, padB = 22;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const X = (i, n) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  ctx.font = '12.5px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.strokeStyle = cssVar('--outline', '#E3E7E4'); ctx.fillStyle = cssVar('--on-surface-var', '#9AA5A0');
  for (let g = 0; g <= 4; g++) {
    const v = min + (max - min) * g / 4;
    const y = Y(v);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillText(v >= 1000 ? (v / 1000).toFixed(1) + 'K' : v.toFixed(0), w - padR + 6, y);
  }
  ctx.textAlign = 'center';
  const step = Math.max(1, Math.floor(pfD.length / 4));
  for (let i = 0; i < pfD.length; i += step) {
    ctx.fillText(fmtDateIL(pfD[i].date).slice(3), X(i, pfD.length), h - 8);
  }

  if (pfD.length > 1) {
    ctx.beginPath();
    pfD.forEach((p, i) => {
      const x = X(i, pfD.length), y = Y(p.value);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = cssVar('--primary', '#006A4E'); ctx.lineWidth = 2.5; ctx.stroke();
  }

  if (legend) {
    // סך תשואה — אותה נוסחה כמו במסך הראשי: שווי נוכחי מול סך הפקדות
    const tot = totalsUSD();
    const totalILS = state.fx ? tot.total * state.fx : null;
    const depILS = netDepositsILS();
    const ret = (totalILS !== null && depILS > 0) ? (totalILS / depILS - 1) * 100 : null;
    const cls = ret === null ? '' : ret >= 0 ? 'pos' : 'neg';
    legend.innerHTML =
      '<li><span class="dot" style="background:var(--primary)"></span>' +
      '<span class="lg-name">' + t('myPortfolio') + '</span>' +
      '<span class="lg-pct ' + cls + '">' + (ret === null ? '—' : fmtPct(ret, true)) + '</span></li>';
  }
}

/* ---------------- רינדור: מניות ---------------- */

function renderStocks() {
  const list = document.getElementById('stockList');
  list.innerHTML = '';
  const sc = document.getElementById('stockCount');
  if (sc) sc.textContent = POSITIONS.length;
  if (state.edit.stocks) {
    const add = el('button', 'card add-card');
    add.type = 'button';
    add.innerHTML = '<span class="add-plus">＋</span> ' + t('addStock');
    add.addEventListener('click', () => showAddPositionForm(list));
    list.appendChild(add);
  }
  if (!POSITIONS.length && !state.edit.stocks) {
    const m = el('p', 'fine');
    m.style.padding = '0';
    m.textContent = t('noStocks');
    list.appendChild(m);
  }
  for (const p of POSITIONS) {
    list.appendChild(buildStockCard(p));
  }
}

/* ולידציה למניה (טהורה — ניתנת לבדיקה) */
function validPosition(sym, shares, avg, ignoreSym) {
  const s = String(sym || '').trim().toUpperCase();
  if (!/^[A-Z.]{1,8}$/.test(s)) return t('errSymInvalid');
  if (ignoreSym !== s && POSITIONS.some((p) => p.sym === s)) return t('errSymExists');
  if (!(shares > 0)) return t('errSharesPos');
  if (!(avg > 0)) return t('errAvgPos');
  return null;
}

/* טופס עריכת כמות ומחיר קנייה בתוך כרטיס המניה */
function showEditPositionForm(card, p) {
  const body = card.querySelector('.stock-body');
  card.classList.add('open');
  body.innerHTML =
    '<div class="form-grid">' +
    '<label>' + t('fldShares') + '<input id="ep-shares" type="number" min="0" step="any" inputmode="decimal" value="' + p.shares + '"></label>' +
    '<label>' + t('fldAvgPrice') + '<input id="ep-avg" type="number" min="0" step="any" inputmode="decimal" value="' + p.avg + '"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="ep-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="ep-save" type="button">' + t('btnSave') + '</button>' +
    '<button class="link-btn" id="ep-cancel" type="button">' + t('btnCancel') + '</button></div>';
  body.querySelector('#ep-cancel').addEventListener('click', () => refreshStockBody(p.sym));
  body.querySelector('#ep-save').addEventListener('click', () => {
    const shares = parseFloat(body.querySelector('#ep-shares').value);
    const avg = parseFloat(body.querySelector('#ep-avg').value);
    const err = validPosition(p.sym, shares, avg, p.sym);
    const errEl = body.querySelector('#ep-err');
    if (err) { errEl.textContent = err; errEl.classList.remove('hidden'); return; }
    p.shares = shares;
    p.avg = avg;
    saveDB();
    refreshStockBody(p.sym);
    renderOverview();
    flash(t('saved'));
  });
}

/* טופס הוספת מניה חדשה */
function showAddPositionForm(list) {
  if (document.getElementById('addPosForm')) return;
  const card = el('div', 'card');
  card.id = 'addPosForm';
  card.innerHTML =
    '<h2>' + t('addStockTitle') + '</h2>' +
    '<div class="form-grid">' +
    '<label>' + t('fldSymbol') + '<input id="ap-sym" type="text" dir="ltr" placeholder="NVDA" autocomplete="off"></label>' +
    '<label>' + t('fldNameHe') + '<input id="ap-name" type="text" placeholder="' + t('phExampleName') + '"></label>' +
    '<label>' + t('fldFullName') + '<input id="ap-full" type="text" dir="ltr" placeholder="NVIDIA Corp" autocomplete="off"></label>' +
    '<label>' + t('fldShares') + '<input id="ap-shares" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '<label>' + t('fldAvgPrice') + '<input id="ap-avg" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="ap-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="ap-save" type="button">' + t('btnAddStock') + '</button>' +
    '<button class="link-btn" id="ap-cancel" type="button">' + t('btnCancel') + '</button></div>';
  list.insertBefore(card, list.firstChild);
  card.querySelector('#ap-cancel').addEventListener('click', () => card.remove());
  card.querySelector('#ap-save').addEventListener('click', () => {
    const sym = card.querySelector('#ap-sym').value.trim().toUpperCase();
    const name = card.querySelector('#ap-name').value.trim() || sym;
    const full = card.querySelector('#ap-full').value.trim();
    const shares = parseFloat(card.querySelector('#ap-shares').value);
    const avg = parseFloat(card.querySelector('#ap-avg').value);
    const err = validPosition(sym, shares, avg, null);
    const errEl = card.querySelector('#ap-err');
    if (err) { errEl.textContent = err; errEl.classList.remove('hidden'); return; }
    POSITIONS.push({ sym: sym, name: name, full: full, shares: shares, avg: avg });
    saveDB();
    card.remove();
    renderAll();
    flash(t('stockAdded'));
    refreshQuotes().then(() => warmHistories());
  });
}

function deletePosition(p) {
  if (!confirm(t('delStockConfirm', { name: p.name, sym: p.sym }))) return;
  const i = POSITIONS.findIndex((x) => x.sym === p.sym);
  if (i >= 0) POSITIONS.splice(i, 1);
  delete state.hist[p.sym];
  delete state.intra[p.sym];
  delete state.quotes[p.sym];
  delete state.open[p.sym];
  delete state.range[p.sym];
  try {
    localStorage.removeItem(LS_HIST + p.sym);
    localStorage.removeItem(LS_INTRA + p.sym);
  } catch (e) {}
  saveDB();
  renderAll();
  flash(t('stockDeleted'));
  refreshQuotes().then(() => warmHistories());
}

function buildStockCard(p) {
  const sym = p.sym;
  const m = metrics(sym);
  const cur = state.currency;
  const priceTxt = m.price === null ? '—' : (cur === 'ILS' && state.fx ? fmtILS(m.price * state.fx) : fmtUSD2(m.price));

  const card = el('div', 'stock' + (state.open[sym] ? ' open' : ''));
  card.dataset.sym = sym;
  const head = el('button', 'stock-head');
  head.type = 'button';
  head.innerHTML =
    '<span class="stock-id"><span class="stock-sym">' + sym + '</span>' +
    '<span class="stock-name">' + esc(p.name) + '</span></span>' +
    '<span class="stock-price">' + priceTxt + '</span>' +
    '<span class="stock-sub"><span class="day-chg ' + (m.dayChg === null ? '' : m.dayChg >= 0 ? 'pos' : 'neg') + '">' +
    (m.dayChg === null ? '—' : t('todayChg', { v: fmtPct(m.dayChg, true) })) + '</span>' +
    '<span>' + (m.value === null ? '—' : money(cur === 'ILS' && state.fx ? m.value * state.fx : m.value, cur)) +
    ' <span class="chev">▾</span></span></span>';
  head.addEventListener('click', () => toggleStock(sym, card));
  card.appendChild(head);

  // מצב עריכה: כפתורי עריכה/מחיקה מתחת לכותרת הכרטיס
  if (state.edit.stocks) {
    const actions = el('div', 'edit-actions');
    const eb = el('button', 'chip-btn', t('btnEdit'));
    eb.type = 'button';
    eb.addEventListener('click', (ev) => { ev.stopPropagation(); showEditPositionForm(card, p); });
    const dbtn = el('button', 'chip-btn danger', t('btnDelete'));
    dbtn.type = 'button';
    dbtn.addEventListener('click', (ev) => { ev.stopPropagation(); deletePosition(p); });
    actions.appendChild(eb);
    actions.appendChild(dbtn);
    card.appendChild(actions);
  }

  const body = el('div', 'stock-body');
  body.appendChild(buildStockBody(p, m));
  card.appendChild(body);
  return card;
}

function kvHTML(k, v, cls) {
  return '<div class="kv"><div class="k">' + k + '</div><div class="v' + (cls ? ' ' + cls : '') + '">' + v + '</div></div>';
}

function buildStockBody(p, m) {
  const sym = p.sym;
  const cur = state.currency;
  const wrap = el('div');
  const toCur = (usd) => (usd === null ? null : (cur === 'ILS' && state.fx ? usd * state.fx : usd));

  const grid = el('div', 'kv-grid');
  grid.innerHTML =
    kvHTML(t('kvShares'), p.shares.toLocaleString('en-US')) +
    kvHTML(t('kvAvg'), cur === 'ILS' && state.fx ? fmtILS(p.avg * state.fx) : fmtUSD2(p.avg)) +
    kvHTML(t('kvValue'), m.value === null ? '—' : money(toCur(m.value), cur)) +
    kvHTML(t('kvGL'),
      m.gl === null ? '—' : (m.gl < 0 ? '−' : '+') + money(Math.abs(toCur(m.gl)), cur) +
        ' (' + fmtPct(m.gl / (p.avg * p.shares) * 100, true) + ')',
      m.gl === null ? '' : m.gl >= 0 ? 'pos' : 'neg') +
    kvHTML(t('kvWeight'), weightTxt(sym)) +
    kvHTML('ATH',
      m.ath ? (cur === 'ILS' && state.fx ? fmtILS(m.ath.price * state.fx) : fmtUSD2(m.ath.price)) +
        '<br><span style="font-weight:400;font-size:12px">' + fmtDateIL(m.ath.date) +
        (m.offAth !== null ? ' · ' + t('offAth', { v: fmtPct(m.offAth, true) }) : '') + '</span>'
        : (state.hist[sym] ? '—' : '…'));
  wrap.appendChild(grid);

  if (!state.range[sym]) state.range[sym] = 'year';
  const chead = el('div', 'chart-head');
  const ranges = el('div', 'ranges');
  for (const [key, label] of RANGES) {
    const b = el('button', 'range-btn' + (state.range[sym] === key ? ' active' : ''), t(label));
    b.type = 'button';
    b.addEventListener('click', () => {
      state.range[sym] = key;
      state.measure[sym] = { on: false, pts: [] };
      refreshStockBody(sym);
    });
    ranges.appendChild(b);
  }
  chead.appendChild(ranges);
  const mb = el('button', 'measure-btn' + (measureState(sym).on ? ' on' : ''), t('measure'));
  mb.type = 'button';
  mb.title = t('measureTitle');
  mb.addEventListener('click', () => {
    const ms = measureState(sym);
    ms.on = !ms.on;
    ms.pts = [];
    refreshStockBody(sym);
  });
  chead.appendChild(mb);
  wrap.appendChild(chead);

  const chip = el('div', 'measure-chip hidden');
  chip.id = 'mchip-' + sym;
  wrap.appendChild(chip);

  const cwrap = el('div', 'chart-wrap');
  const canvas = el('canvas');
  canvas.id = 'chart-' + sym;
  if (measureState(sym).on) canvas.classList.add('measuring');
  const loading = el('div', 'chart-loading', t('loadingData'));
  loading.id = 'cload-' + sym;
  cwrap.appendChild(canvas);
  cwrap.appendChild(loading);
  wrap.appendChild(cwrap);

  const hint = el('div', 'chart-hint',
    measureState(sym).on ? t('measureOn') : t('measureTip'));
  wrap.appendChild(hint);

  attachMeasure(canvas, sym);
  // ציור יתבצע אחרי טעינת היסטוריה (ensureChartData)
  return wrap;
}

function measureState(sym) {
  if (!state.measure[sym]) state.measure[sym] = { on: false, pts: [] };
  return state.measure[sym];
}

function weightTxt(sym) {
  const tot = totalsUSD();
  const p = POSITIONS.find((x) => x.sym === sym);
  const q = state.quotes[sym];
  if (!tot.stockVal || !q) return '—';
  return (q.close * p.shares / tot.stockVal * 100).toFixed(1) + '%';
}

function toggleStock(sym, card) {
  state.open[sym] = !state.open[sym];
  card.classList.toggle('open', state.open[sym]);
  if (state.open[sym]) ensureChartData(sym);
}

function refreshStockBody(sym) {
  const card = document.querySelector('#stockList .stock[data-sym="' + sym + '"]');
  const p = POSITIONS.find((x) => x.sym === sym);
  if (!card || !p) return;
  const m = metrics(sym);
  const body = card.querySelector('.stock-body');
  body.innerHTML = '';
  body.appendChild(buildStockBody(p, m));
  ensureChartData(sym);
}

async function ensureChartData(sym) {
  const loading = document.getElementById('cload-' + sym);
  const range = state.range[sym] || 'year';
  if (loading) { loading.classList.remove('hidden'); loading.textContent = t('loadingData'); }
  try {
    if (range === 'day') {
      const intra = await getIntraday(sym);
      if (intra.length) {
        drawStockChart(sym, intra, true);
        if (loading) loading.classList.add('hidden');
        return;
      }
      // נפילה לגרף יומי אם אין תוך-יומי
    }
    const hist = await getDaily(sym, false);
    const pts = drawStockChart(sym, filterRange(hist, range === 'day' ? 'month' : range), false);
    if (pts && loading) loading.classList.add('hidden');
  } catch (e) {
    if (loading) { loading.textContent = t('noChartData'); loading.classList.remove('hidden'); }
  }
}

/* ---------------- גרף קו ---------------- */

function chartPoints(sym, rows, intraday) {
  return downsample(rows, 400).map((r) => ({
    label: intraday && r.time ? r.time.slice(0, 5) : fmtDateIL(r.date),
    date: r.date, time: r.time, close: r.close
  }));
}

function drawStockChart(sym, rows, intraday) {
  const canvas = document.getElementById('chart-' + sym);
  const loading = document.getElementById('cload-' + sym);
  if (!canvas) return null;
  const pts = chartPoints(sym, rows, intraday);
  if (!pts.length) {
    if (loading) {
      const dbg = state.histDbg && state.histDbg[sym];
      loading.innerHTML = t('noChartNow') + (dbg ? '<br><small style="opacity:.65">' + dbg + '</small>' : '');
      loading.classList.remove('hidden');
    }
    return null;
  }
  if (loading) loading.classList.add('hidden');

  const ms = measureState(sym);
  // ולידציה של אינדקסי מדידה מול אורך עדכני
  ms.pts = ms.pts.filter((i) => i >= 0 && i < pts.length);

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = 210;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  const padL = 6, padR = 58, padT = 10, padB = 22;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  let min = Infinity, max = -Infinity;
  for (const p of pts) { if (p.close < min) min = p.close; if (p.close > max) max = p.close; }
  if (min === max) { min *= 0.99; max *= 1.01; }
  const X = (i) => padL + (pts.length === 1 ? plotW / 2 : (i / (pts.length - 1)) * plotW);
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  const up = pts[pts.length - 1].close >= pts[0].close;
  const lineCol = up ? cssVar('--gain', '#137333') : cssVar('--loss', '#B3261E');

  // רשת אופקית + תוויות מחיר
  ctx.font = '11px system-ui'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g++) {
    const v = min + (max - min) * g / 4;
    const y = Y(v);
    ctx.strokeStyle = cssVar('--outline', '#E7ECE8'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR + 6, y); ctx.stroke();
    ctx.fillStyle = cssVar('--on-surface-var', '#6B7570');
    ctx.fillText(fmtUSD2(v), w - padR + 10, y);
  }

  // מילוי שטח
  const grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
  grad.addColorStop(0, up ? 'rgba(19,115,51,.25)' : 'rgba(179,38,30,.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.beginPath();
  pts.forEach((p, i) => { const x = X(i), y = Y(p.close); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.lineTo(X(pts.length - 1), padT + plotH);
  ctx.lineTo(X(0), padT + plotH);
  ctx.closePath();
  ctx.fillStyle = grad; ctx.fill();

  // קו
  ctx.beginPath();
  pts.forEach((p, i) => { const x = X(i), y = Y(p.close); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = lineCol; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();

  // תוויות ציר זמן (עד 5)
  ctx.fillStyle = cssVar('--on-surface-var', '#6B7570'); ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const ticks = Math.min(5, pts.length);
  for (let k = 0; k < ticks; k++) {
    const i = Math.round(k * (pts.length - 1) / (ticks - 1 || 1));
    ctx.fillText(pts[i].label, Math.min(Math.max(X(i), 30), w - padR - 20), padT + plotH + 6);
  }

  // נקודת מדידה
  const drawMarker = (i, color) => {
    const x = X(i), y = Y(pts[i].close);
    ctx.strokeStyle = color; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
  };
  if (ms.pts.length >= 1) drawMarker(ms.pts[0], '#1565C0');
  if (ms.pts.length >= 2) {
    drawMarker(ms.pts[1], '#1565C0');
    const a = pts[ms.pts[0]], b = pts[ms.pts[1]];
    ctx.strokeStyle = '#1565C0'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(X(ms.pts[0]), Y(a.close));
    ctx.lineTo(X(ms.pts[1]), Y(b.close));
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // שמירת מיפוי למדידה
  canvas._chartMap = { n: pts.length, padL: padL, plotW: plotW, pts: pts };
  updateMeasureChip(sym);
  return pts;
}

function updateMeasureChip(sym) {
  const chip = document.getElementById('mchip-' + sym);
  if (!chip) return;
  const ms = measureState(sym);
  const canvas = document.getElementById('chart-' + sym);
  const pts = canvas && canvas._chartMap ? canvas._chartMap.pts : [];
  if (!ms.on || ms.pts.length < 2 || !pts.length) {
    chip.classList.add('hidden');
    chip.innerHTML = '';
    return;
  }
  const a = pts[ms.pts[0]], b = pts[ms.pts[1]];
  const ret = (b.close - a.close) / a.close * 100;
  const la = a.time ? fmtDateIL(a.date) + ' ' + a.time.slice(0, 5) : fmtDateIL(a.date);
  const lb = b.time ? fmtDateIL(b.date) + ' ' + b.time.slice(0, 5) : fmtDateIL(b.date);
  chip.classList.remove('hidden');
  chip.innerHTML =
    '<span>' + t('mReturn') + '<b class="' + (ret >= 0 ? 'pos' : 'neg') + '">' + fmtPct(ret, true) + '</b>' +
    ' <span style="font-weight:400">(' + la + ' ← ' + lb + ')</span></span>' +
    '<button type="button" aria-label="' + t('clearMeasure') + '">✕</button>';
  chip.querySelector('button').addEventListener('click', () => {
    ms.pts = [];
    ensureChartData(sym);
  });
}

/* מדידה בשתי נקודות — עובד עם מגע (אצבע) ועם עכבר דרך Pointer Events */
function attachMeasure(canvas, sym) {
  canvas.addEventListener('pointerdown', (e) => {
    const ms = measureState(sym);
    if (!ms.on) return;
    const map = canvas._chartMap;
    if (!map || map.n < 2) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let idx = Math.round((x - map.padL) / map.plotW * (map.n - 1));
    idx = Math.max(0, Math.min(map.n - 1, idx));
    ms.pts.push(idx);
    if (ms.pts.length > 2) ms.pts = [idx]; // געו שלישית — מתחילים מחדש
    ensureChartData(sym);
  });
}

/* ---------------- רינדור: הפקדות ---------------- */

/* ---------------- עריכת הפקדות ---------------- */

/* המרת תאריך DD/MM/YYYY <-> YYYY-MM-DD (לטופס תאריך) */
function dateToInput(s) {
  const m = String(s || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? m[3] + '-' + m[2] + '-' + m[1] : '';
}
function dateFromInput(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[3] + '/' + m[2] + '/' + m[1] : '';
}
function validDeposit(dateStr, amount) {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr || '')) return t('errDateInvalid');
  if (!(amount > 0)) return t('errAmtPos');
  return null;
}

function depositAmountHTML(amt) {
  if (amt === 0) return '<span class="r-amt zero">₪0</span>';
  if (amt > 0) return '<span class="r-amt in" title="' + t('adjTitle') + '">+₪' + amt.toLocaleString('en-US') + '</span>';
  return '<span class="r-amt out">₪' + Math.abs(amt).toLocaleString('en-US') + '</span>';
}

function renderDeposits() {
  const nd = netDepositsILS();
  const ndTxt = '₪' + Math.abs(nd).toLocaleString('en-US');
  document.getElementById('depTotal').textContent = ndTxt;
  document.getElementById('depCount').textContent = t('records', { n: DEPOSITS.length });
  const cn = document.getElementById('calcNotePara');
  if (cn) cn.innerHTML = t('calcNote1', { total: ndTxt });
  const ul = document.getElementById('depositList');
  ul.innerHTML = '';
  const ed = state.edit.deposits;
  if (ed) {
    const addLi = el('li');
    const addBtn = el('button', 'chip-btn', '＋ ' + t('addDeposit'));
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => showAddDepositForm(ul));
    addLi.appendChild(addBtn);
    ul.appendChild(addLi);
  }
  DEPOSITS.forEach((d, i) => ul.appendChild(buildDepositRow(d, i, ed)));
}

function buildDepositRow(d, i, ed) {
  const li = el('li');
  li.dataset.depIdx = i;
  const main = el('span');
  main.innerHTML = '<span class="r-date">' + d.date + '</span>' +
    (d.place ? '<br><span class="r-note">' + esc(d.place) + '</span>' : '');
  li.appendChild(main);
  const wrap = el('span');
  wrap.innerHTML = depositAmountHTML(d.amount);
  li.appendChild(wrap);
  if (ed) {
    const actions = el('span', 'row-actions');
    const eb = el('button', 'mini-btn', t('btnEditRow'));
    eb.type = 'button';
    eb.addEventListener('click', () => showEditDepositForm(li, d, i));
    const dbtn = el('button', 'mini-btn danger', t('btnDeleteRow'));
    dbtn.type = 'button';
    dbtn.addEventListener('click', () => deleteDeposit(i));
    actions.appendChild(eb);
    actions.appendChild(dbtn);
    li.appendChild(actions);
  }
  return li;
}

/* טופס עריכת הפקדה — בתוך שורת הרשימה */
function depositFormHTML(d, idp) {
  const isOut = d.amount > 0;
  return '<div class="form-grid">' +
    '<label>' + t('fldDate') + '<input id="' + idp + '-date" type="date" value="' + dateToInput(d.date) + '"></label>' +
    '<label>' + t('fldType') + '<select id="' + idp + '-type">' +
      '<option value="in"' + (!isOut ? ' selected' : '') + '>' + t('optIn') + '</option>' +
      '<option value="out"' + (isOut ? ' selected' : '') + '>' + t('optOut') + '</option>' +
    '</select></label>' +
    '<label>' + t('fldAmountIls') + '<input id="' + idp + '-amt" type="number" min="0" step="any" inputmode="decimal" value="' + Math.abs(d.amount) + '"></label>' +
    '<label>' + t('fldPlace') + '<input id="' + idp + '-place" type="text" value="' + esc(d.place || '') + '" placeholder="' + t('phOptional') + '"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="' + idp + '-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="' + idp + '-save" type="button">' + t('btnSave') + '</button>' +
    '<button class="link-btn" id="' + idp + '-cancel" type="button">' + t('btnCancel') + '</button></div>';
}

function readDepositForm(box, idp) {
  const date = dateFromInput(box.querySelector('#' + idp + '-date').value);
  const type = box.querySelector('#' + idp + '-type').value;
  const amount = parseFloat(box.querySelector('#' + idp + '-amt').value);
  const place = box.querySelector('#' + idp + '-place').value.trim();
  const err = validDeposit(date, amount);
  if (err) return { err: err };
  return { date: date, amount: type === 'out' ? Math.abs(amount) : -Math.abs(amount), place: place };
}

function showEditDepositForm(li, d, i) {
  const idp = 'de' + i;
  li.classList.add('form-li');
  li.innerHTML = depositFormHTML(d, idp);
  li.querySelector('#' + idp + '-cancel').addEventListener('click', () => renderDeposits());
  li.querySelector('#' + idp + '-save').addEventListener('click', () => {
    const r = readDepositForm(li, idp);
    const errEl = li.querySelector('#' + idp + '-err');
    if (r.err) { errEl.textContent = r.err; errEl.classList.remove('hidden'); return; }
    DEPOSITS[i] = { date: r.date, amount: r.amount, place: r.place };
    saveDB();
    renderDeposits();
    renderOverview();
    flash(t('saved'));
  });
}

function showAddDepositForm(ul) {
  if (document.getElementById('addDepForm')) return;
  const li = el('li');
  li.id = 'addDepForm';
  li.classList.add('form-li');
  li.innerHTML = '<b>' + t('newDeposit') + '</b>' + depositFormHTML({ date: '', amount: 0, place: '' }, 'da');
  ul.insertBefore(li, ul.firstChild);
  li.querySelector('#da-cancel').addEventListener('click', () => li.remove());
  li.querySelector('#da-save').addEventListener('click', () => {
    const r = readDepositForm(li, 'da');
    const errEl = li.querySelector('#da-err');
    if (r.err) { errEl.textContent = r.err; errEl.classList.remove('hidden'); return; }
    DEPOSITS.unshift({ date: r.date, amount: r.amount, place: r.place });
    saveDB();
    renderDeposits();
    renderOverview();
    flash(t('depositAdded'));
  });
}

function deleteDeposit(i) {
  const d = DEPOSITS[i];
  if (!d) return;
  if (!confirm(t('delDepositConfirm', { date: d.date, amt: Math.abs(d.amount).toLocaleString('en-US') }))) return;
  DEPOSITS.splice(i, 1);
  saveDB();
  renderDeposits();
  renderOverview();
  flash(t('depositDeleted'));
}

/* ---------------- רינדור: פנסיה ---------------- */

function renderPension() {
  const cur = state.currency;
  const wrap = document.getElementById('pensionCards');
  wrap.innerHTML = '';
  for (const f of PENSION_FUNDS) {
    const v = cur === 'ILS' ? f.ils : f.usd;
    const card = el('div', 'card stat',
      '<div class="stat-label">' + esc(f.name) + '</div>' +
      '<div class="stat-value">' + money(v, cur) + '</div>');
    wrap.appendChild(card);
  }
  const tu = PENSION_FUNDS.reduce((a, f) => a + (num(f.usd) || 0), 0);
  const ti = PENSION_FUNDS.reduce((a, f) => a + (num(f.ils) || 0), 0);
  document.getElementById('pensionTotal').textContent = money(cur === 'ILS' ? ti : tu, cur);

  // סך תשואה לכל סוג — שווי נוכחי מול סך הפקדות, כמו בתיק
  const prBox = document.getElementById('pensionReturns');
  if (prBox) {
    const hasKind = (k) => PENSION_FUNDS.some((f) => (f.kind || 'pension') === k) ||
                           PENSION_DEPOSITS.some((r) => (r.kind || 'pension') === k);
    const cls = (v) => v === null ? '' : v >= 0 ? 'pos' : 'neg';
    const prow = (name, v) =>
      '<li><span class="lg-name">' + name + '</span>' +
      '<span class="lg-pct ' + cls(v) + '">' + (v === null ? '—' : fmtPct(v, true)) + '</span></li>';
    let phtml = '';
    if (hasKind('pension')) phtml += prow(t('pensionReturn'), fundKindReturn('pension'));
    if (hasKind('study')) phtml += prow(t('studyReturn'), fundKindReturn('study'));
    prBox.innerHTML = phtml;
  }

  const ul = document.getElementById('pensionDeposits');
  ul.innerHTML = '';
  const ed = state.edit.pension;
  if (ed) {
    const addLi = el('li');
    const addBtn = el('button', 'chip-btn', '＋ ' + t('addDeposit'));
    addBtn.type = 'button';
    addBtn.addEventListener('click', () => showAddPensionDepositForm(ul));
    addLi.appendChild(addBtn);
    ul.appendChild(addLi);
  }
  PENSION_DEPOSITS.forEach((r, i) => ul.appendChild(buildPensionDepositRow(r, i, ed)));
}

function buildPensionDepositRow(r, i, ed) {
  const li = el('li');
  const kindTag = (r.kind || 'pension') === 'study'
    ? ' <span class="r-note">' + t('studyTag') + '</span>' : '';
  li.innerHTML =
    '<span><b>' + esc(r.place) + '</b><br><span class="r-date">' + esc(r.period) + '</span>' + kindTag +
    (r.note ? '<br><span class="r-note">' + esc(r.note) + '</span>' : '') + '</span>' +
    '<span class="r-amt out">₪' + Math.abs(r.amount).toLocaleString('en-US') + '</span>';
  if (ed) {
    const actions = el('span', 'row-actions');
    const eb = el('button', 'mini-btn', t('btnEditRow'));
    eb.type = 'button';
    eb.addEventListener('click', () => showEditPensionDepositForm(li, r, i));
    const dbtn = el('button', 'mini-btn danger', t('btnDeleteRow'));
    dbtn.type = 'button';
    dbtn.addEventListener('click', () => deletePensionDeposit(i));
    actions.appendChild(eb);
    actions.appendChild(dbtn);
    li.appendChild(actions);
  }
  return li;
}

function pensionDepositFormHTML(r, idp) {
  const isOut = r.amount > 0;
  const kind = r.kind || 'pension';
  return '<div class="form-grid">' +
    '<label>' + t('fldCompany') + '<input id="' + idp + '-place" type="text" value="' + esc(r.place || '') + '"></label>' +
    '<label>' + t('fldAssoc') + '<select id="' + idp + '-kind">' +
      '<option value="pension"' + (kind !== 'study' ? ' selected' : '') + '>' + t('optPension') + '</option>' +
      '<option value="study"' + (kind === 'study' ? ' selected' : '') + '>' + t('optStudy') + '</option>' +
    '</select></label>' +
    '<label>' + t('fldPeriod') + '<input id="' + idp + '-period" type="text" dir="ltr" value="' + esc(r.period || '') + '" placeholder="MM/YYYY – MM/YYYY"></label>' +
    '<label>' + t('fldType') + '<select id="' + idp + '-type">' +
      '<option value="in"' + (!isOut ? ' selected' : '') + '>' + t('optIn') + '</option>' +
      '<option value="out"' + (isOut ? ' selected' : '') + '>' + t('optOut') + '</option>' +
    '</select></label>' +
    '<label>' + t('fldAmountIls') + '<input id="' + idp + '-amt" type="number" min="0" step="any" inputmode="decimal" value="' + Math.abs(r.amount) + '"></label>' +
    '<label>' + t('fldNote') + '<input id="' + idp + '-note" type="text" value="' + esc(r.note || '') + '" placeholder="' + t('phOptional') + '"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="' + idp + '-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="' + idp + '-save" type="button">' + t('btnSave') + '</button>' +
    '<button class="link-btn" id="' + idp + '-cancel" type="button">' + t('btnCancel') + '</button></div>';
}

function readPensionDepositForm(box, idp) {
  const place = box.querySelector('#' + idp + '-place').value.trim();
  const period = box.querySelector('#' + idp + '-period').value.trim();
  const type = box.querySelector('#' + idp + '-type').value;
  const amount = parseFloat(box.querySelector('#' + idp + '-amt').value);
  const note = box.querySelector('#' + idp + '-note').value.trim();
  if (!place) return { err: t('errCompanyNeeded') };
  if (!(amount > 0)) return { err: t('errAmtPos') };
  const kind = box.querySelector('#' + idp + '-kind');
  return { place: place, period: period, amount: type === 'out' ? Math.abs(amount) : -Math.abs(amount), note: note, kind: kind ? kind.value : 'pension' };
}

function showEditPensionDepositForm(li, r, i) {
  const idp = 'pe' + i;
  li.classList.add('form-li');
  li.innerHTML = pensionDepositFormHTML(r, idp);
  li.querySelector('#' + idp + '-cancel').addEventListener('click', () => renderPension());
  li.querySelector('#' + idp + '-save').addEventListener('click', () => {
    const v = readPensionDepositForm(li, idp);
    const errEl = li.querySelector('#' + idp + '-err');
    if (v.err) { errEl.textContent = v.err; errEl.classList.remove('hidden'); return; }
    PENSION_DEPOSITS[i] = { place: v.place, period: v.period, amount: v.amount, note: v.note, kind: v.kind || 'pension' };
    saveDB();
    renderPension();
    flash(t('saved'));
  });
}

function showAddPensionDepositForm(ul) {
  if (document.getElementById('addPenDepForm')) return;
  const li = el('li');
  li.id = 'addPenDepForm';
  li.classList.add('form-li');
  li.innerHTML = '<b>' + t('newPensionDeposit') + '</b>' + pensionDepositFormHTML({ place: '', period: '', amount: 0, note: '' }, 'pa');
  ul.insertBefore(li, ul.firstChild);
  li.querySelector('#pa-cancel').addEventListener('click', () => li.remove());
  li.querySelector('#pa-save').addEventListener('click', () => {
    const v = readPensionDepositForm(li, 'pa');
    const errEl = li.querySelector('#pa-err');
    if (v.err) { errEl.textContent = v.err; errEl.classList.remove('hidden'); return; }
    PENSION_DEPOSITS.unshift({ place: v.place, period: v.period, amount: v.amount, note: v.note, kind: v.kind || 'pension' });
    saveDB();
    renderPension();
    flash(t('pensionDepositAdded'));
  });
}

function deletePensionDeposit(i) {
  const r = PENSION_DEPOSITS[i];
  if (!r) return;
  if (!confirm(t('delPensionConfirm', { place: r.place, amt: Math.abs(r.amount).toLocaleString('en-US') }))) return;
  PENSION_DEPOSITS.splice(i, 1);
  saveDB();
  renderPension();
  flash(t('pensionDepositDeleted'));
}

/* ---------------- כללי ---------------- */

function renderAll() {
  renderOverview();
  renderStocks();
  renderDeposits();
  renderPension();
  // ציור מחדש של גרפים פתוחים (למשל אחרי מעבר מטבע)
  for (const sym of Object.keys(state.open)) {
    if (state.open[sym]) ensureChartData(sym);
  }
}

/* ---------------- הגדרות ומצב עריכה ---------------- */

function renderTdKeyStatus() {
  const s = document.getElementById('tdKeyStatus');
  if (!s) return;
  const k = tdKey();
  s.textContent = k
    ? t('tdKeySaved', { last4: k.slice(-4) })
    : t('tdKeyMissing');
}

function wireEditToggle(btnId, hintId, key, rerender) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    state.edit[key] = !state.edit[key];
    btn.classList.toggle('on', state.edit[key]);
    const hint = document.getElementById(hintId);
    if (hint) hint.classList.toggle('hidden', !state.edit[key]);
    rerender();
  });
}

function renderCashInputs() {
  const u = document.getElementById('cashUsd');
  const s = document.getElementById('cashIls');
  if (u) u.value = (DB.cash && DB.cash.usd) || 0;
  if (s) s.value = (DB.cash && DB.cash.ils) || 0;
}

function renderPensionFundEditors() {
  const box = document.getElementById('pensionFundEditors');
  if (!box) return;
  box.innerHTML = '';
  PENSION_FUNDS.forEach((f, i) => {
    const d = el('div', 'fund-editor');
    d.innerHTML = '<b>' + esc(f.name) + '</b>' +
      '<div class="form-grid">' +
      '<label>' + t('fldAssoc') + '<select data-fund-kind="' + i + '">' +
        '<option value="pension"' + ((f.kind || 'pension') !== 'study' ? ' selected' : '') + '>' + t('optPension') + '</option>' +
        '<option value="study"' + ((f.kind || 'pension') === 'study' ? ' selected' : '') + '>' + t('optStudy') + '</option>' +
      '</select></label>' +
      '<label>' + t('fldDollars') + '<input data-fund="' + i + '" data-cur="usd" type="number" min="0" step="any" inputmode="decimal" value="' + f.usd + '"></label>' +
      '<label>' + t('fldShekels') + '<input data-fund="' + i + '" data-cur="ils" type="number" min="0" step="any" inputmode="decimal" value="' + f.ils + '"></label>' +
      '</div>';
    box.appendChild(d);
  });
}

function init() {
  // ערכת נושא — מחיל מיד (מונע הבהוב; הסקריפט ב־<head> כבר קבע data-theme)
  applyTheme();
  // מעקב אחרי שינוי ערכת המערכת כשהמשתמש בחר "מערכת"
  try {
    const mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
    const onSys = () => { if (getThemeMode() === 'system') applyTheme(); };
    if (mq) { if (mq.addEventListener) mq.addEventListener('change', onSys); else if (mq.addListener) mq.addListener(onSys); }
  } catch (e) {}
  // שפה — מחיל מיד (עברית RTL כברירת מחדל, או השפה השמורה במכשיר)
  applyI18n();
  const langHe = document.getElementById('langHe');
  const langEn = document.getElementById('langEn');
  if (langHe) langHe.addEventListener('click', () => setLang('he'));
  if (langEn) langEn.addEventListener('click', () => setLang('en'));
  const thL = document.getElementById('themeLight');
  const thS = document.getElementById('themeSystem');
  const thD = document.getElementById('themeDark');
  if (thL) thL.addEventListener('click', () => setThemeMode('light'));
  if (thS) thS.addEventListener('click', () => setThemeMode('system'));
  if (thD) thD.addEventListener('click', () => setThemeMode('dark'));
  // טאבים
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  // מטבע
  const setCur = (c) => {
    state.currency = c;
    document.getElementById('curUSD').classList.toggle('active', c === 'USD');
    document.getElementById('curILS').classList.toggle('active', c === 'ILS');
    renderAll();
  };
  document.getElementById('curUSD').addEventListener('click', () => setCur('USD'));
  document.getElementById('curILS').addEventListener('click', () => setCur('ILS'));
  // רענון
  document.getElementById('refreshBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.classList.add('spinning');
    state.hist = {}; state.intra = {};
    await refreshQuotes();
    await warmHistories();
    btn.classList.remove('spinning');
  });
  // שינוי גודל — ציור מחדש של גרפים פתוחים
  let rzT = null;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      drawPie();
      drawPfChart();
      for (const sym of Object.keys(state.open)) {
        if (state.open[sym]) ensureChartData(sym);
      }
    }, 250);
  });

  // Service Worker (רק בהקשר מאובטח, לא file://)
  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
    // כשיוצאת גרסה חדשה והיא משתלטת — לרענן אוטומטית כדי שהמשתמש יקבל אותה מיד.
    // רק אם הדף כבר היה תחת שליטה (עדכון), לא בהתקנה ראשונה.
    const hadController = !!navigator.serviceWorker.controller;
    let autoReloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (autoReloaded || !hadController) return;
      autoReloaded = true;
      location.reload();
    });
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        // בדיקת עדכון יזומה בכל פתיחה — למקרה שהדפדפן דילג על הבדיקה האוטומטית
        try { if (reg && reg.update) reg.update().catch(() => {}); } catch (e) {}
      }).catch(() => {});
    });
  }

  // מפתח Twelve Data לגרפים (נשמר בטלפון בלבד) — בלשונית הגדרות
  const tdSave = document.getElementById('tdKeySave');
  if (tdSave) tdSave.addEventListener('click', () => {
    const inp = document.getElementById('tdKeyInput');
    const v = (inp && inp.value || '').trim();
    if (!v) return;
    try { localStorage.setItem(LS_TDKEY, v); } catch (e) {}
    renderTdKeyStatus();
    if (window.__cloudSave) window.__cloudSave();
    flash(t('tdKeySavedFlash'));
    state.hist = {}; state.intra = {};
    warmHistories();
    for (const sym of Object.keys(state.open)) if (state.open[sym]) ensureChartData(sym);
  });
  renderTdKeyStatus();
  if (!tdKey()) { switchTab('settings'); }

  // חיבור ברוקר (IBKR) — אופציונלי, הנתונים הידניים נשארים ברירת המחדל
  renderIbkrCard();
  const ibkrST = document.getElementById('ibkrSaveTest');
  if (ibkrST) ibkrST.addEventListener('click', ibkrSaveAndTest);
  const ibkrSI = document.getElementById('ibkrSyncImport');
  if (ibkrSI) ibkrSI.addEventListener('click', ibkrSyncImport);
  const ibkrDc = document.getElementById('ibkrDisconnect');
  if (ibkrDc) ibkrDc.addEventListener('click', ibkrDisconnect);

  // מצבי עריכה — כבויים כברירת מחדל כדי למנוע טעויות בלחיצות אקראיות
  wireEditToggle('editStocksBtn', 'editStocksHint', 'stocks', renderStocks);
  wireEditToggle('editDepositsBtn', 'editDepositsHint', 'deposits', renderDeposits);
  wireEditToggle('editPensionBtn', 'editPensionHint', 'pension', renderPension);

  // מזומן
  renderCashInputs();
  document.getElementById('cashSave').addEventListener('click', () => {
    const u = parseFloat(document.getElementById('cashUsd').value);
    const s = parseFloat(document.getElementById('cashIls').value);
    const errEl = document.getElementById('cashErr');
    if (!(u >= 0) || !(s >= 0)) {
      errEl.textContent = t('errCashNonNeg');
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    DB.cash = { usd: u, ils: s };
    saveDB();
    renderOverview();
    flash(t('cashSaved'));
  });

  // קרנות פנסיה והשתלמות
  renderPensionFundEditors();
  document.getElementById('pensionFundsSave').addEventListener('click', () => {
    const errEl = document.getElementById('pfErr');
    const vals = [];
    let bad = false;
    document.querySelectorAll('#pensionFundEditors input').forEach((inp) => {
      const v = parseFloat(inp.value);
      if (!(v >= 0)) { bad = true; return; }
      vals.push([+inp.dataset.fund, inp.dataset.cur, v]);
    });
    if (bad) {
      errEl.textContent = t('errFundsNonNeg');
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    for (const [i, c, v] of vals) PENSION_FUNDS[i][c] = v;
    document.querySelectorAll('#pensionFundEditors select[data-fund-kind]').forEach((sel) => {
      PENSION_FUNDS[+sel.dataset.fundKind].kind = sel.value;
    });
    saveDB();
    renderPension();
    flash(t('fundsSaved'));
  });
  document.getElementById('pensionFundAdd').addEventListener('click', () => {
    const errEl = document.getElementById('pfErr');
    const nameEl = document.getElementById('newFundName');
    const kindEl = document.getElementById('newFundKind');
    const f = addPensionFund(nameEl.value, kindEl.value);
    if (!f) {
      errEl.textContent = t('errFundName');
      errEl.classList.remove('hidden');
      return;
    }
    errEl.classList.add('hidden');
    nameEl.value = '';
    renderPensionFundEditors();
    renderPension();
    flash(t('fundAdded'));
  });

  // איפוס נתונים
  const verEl = document.getElementById('appVersion');
  if (verEl && typeof APP_VERSION !== 'undefined') verEl.textContent = t('appVersion') + APP_VERSION;
  document.getElementById('resetData').addEventListener('click', () => {
    if (!confirm(t('resetConfirm'))) return;
    const doReset = () => {
      try { localStorage.removeItem(LS_DB); } catch (e) {}
      location.reload();
    };
    if (window.Cloud && window.Cloud.resetCloud) window.Cloud.resetCloud().then(doReset);
    else doReset();
  });

  const startApp = () => {
    renderAll();
    refreshQuotes().then(() => warmHistories());
  };
  if (window.Cloud && window.Cloud.boot) window.Cloud.boot(startApp);
  else startApp();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
