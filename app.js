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

/* v91: סט אייקונים נקי בקו־מתאר — מחליף אימוג'ים צבעוניים.
   סגנון אחיד: viewBox 24, stroke בצבע המותג, קצוות מעוגלים. */
const _IC_PRE = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
const ICON_EDIT = _IC_PRE + '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const ICON_SEARCH = _IC_PRE + '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>';
const ICON_SYNC = _IC_PRE + '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.5 9a9 9 0 0 1 14.9-3.4L23 10"/><path d="M1 14l4.6 4.4A9 9 0 0 0 20.5 15"/></svg>';
const ICON_MEASURE = _IC_PRE + '<path d="M3 17 17 3l4 4L7 21Z"/><line x1="8.5" y1="12.5" x2="10.5" y2="14.5"/><line x1="11.5" y1="9.5" x2="13.5" y2="11.5"/><line x1="14.5" y1="6.5" x2="16.5" y2="8.5"/></svg>';
const ICON_PIN = _IC_PRE + '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
const ICON_CHART = _IC_PRE + '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>';
const ICON_TRASH = _IC_PRE + '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
const ICON_GLOBE = _IC_PRE + '<circle cx="12" cy="12" r="9"/><line x1="3" y1="12" x2="21" y2="12"/><path d="M12 3a13.5 13.5 0 0 1 0 18M12 3a13.5 13.5 0 0 0 0 18"/></svg>';

const STRINGS = {
he: {
  appTitle: 'תיק ההשקעות',
  loadingSource: 'מקור: טוען…',
  curToggleAria: 'החלפת מטבע — דולר / שקל',
  langAria: 'בחירת שפה',
  loading: 'טוען…',
  tabsAria: 'לשוניות',
  tabOverview: 'סקירה',
  tabStocks: 'מניות',
  tabTrades: 'עסקאות',
  tradesTitle: 'היסטוריית עסקאות',
  tradesNeedIbkr: 'חברו את IBKR וסנכרנו כדי לראות כאן את היסטוריית הקניות והמכירות.',
  tradesEmpty: 'אין עסקאות בדוח המסונכרן — ודאו שמקטע Trades מאופשר בשאילתת ה־Flex.',
  buySide: 'קנייה',
  sellSide: 'מכירה',
  commissionLbl: 'עמלה',
  depEmptyIbkr: 'אין תנועות מזומן בדוח — ודאו שמקטע Cash Transactions מאופשר ברמת Detail (כולל Deposits & Withdrawals), שמרו את השאילתה וסנכרנו מחדש.',
  depEmptyIbkrTypes: 'בדוח יש תנועות מזומן, אבל לא זוהו הפקדות/משיכות. הסוגים שהתקבלו: {types}. אם יש ביניהם הפקדות — שלחו לי צילום של השורה הזאת.',
  flexGuide: 'מקטעים מומלצים בשאילתת ה־Flex: Trades · Cash Transactions · Open Positions · Cash Report · Change in NAV.',
  tabDeposits: 'הפקדות',
  tabWishlist: 'מעקב',
  wishlistTitle: 'רשימת מעקב',
  wishlistHint: 'מניות שמעניינות אותך — מחיר חי ושינוי יומי. לא חלק מהתיק.',
  wlSymbolPh: 'סימבול (למשל NVDA)',
  wlNotePh: 'הערה (אופציונלי)',
  wlAdd: '＋ הוסף למעקב',
  wlEmpty: 'עוד לא הוספת מניות למעקב.',
  wlAdded: 'נוסף למעקב ✓',
  wlRemoved: 'הוסר מהמעקב',
  wlRemove: 'הסר {sym} מהמעקב',
  wlDelConfirm: 'להסיר את {sym} מרשימת המעקב?',
  wlExists: '{sym} כבר ברשימה',
  wlAlreadyOwn: '{sym} כבר בתיק שלך — אין צורך לעקוב',
  wlNoPrice: 'אין מחיר עדיין',
  earnTitle: ICON_CHART + 'דוחות קרובים',
  earnToday: 'היום',
  earnTomorrow: 'מחר',
  earnInDays: 'בעוד {n} ימים',
  earnBmo: 'לפני הפתיחה',
  earnAmc: 'אחרי הסגירה',
  earnDate: 'דוח: {date}',
  ibkrPerfTitle: 'ביצועי IBKR',
  perfPeriod: 'תקופת הדוח: {a}–{b}',
  twrOfficial: 'TWR רשמי של IBKR',
  twrMissing: 'חסר בדוח — הפעילו את מקטע Change in NAV ב־Flex',
  estMark: '(משוער)',
  yieldEstNote: 'תשואה משוערת מנתוני הדוח — לא TWR רשמי',
  perfGainEst: 'רווח משוער לתקופה',
  navWarn: 'הדוח חסר את מקטע "Change in NAV" — בלי זה אי אפשר לחשב תשואה (TWR), רווח/הפסד בתקופה ו־XIRR. לתיקון: ב־IBKR נכנסים לדוחות ← Flex Queries ← עריכת השאילתה ← מסמנים Change in NAV ← שומרים ← מסנכרנים מחדש באפליקציה.',
  ovValueReport: 'כולל מזומן · לפי דוח IBKR',
  ovStocksSub: 'כולל מזומן',
  perfTwr: 'תשואה משוקללת־זמן (TWR)',
  pfDiag: 'דיאגנוסטיקה: {t} עסקאות · {f} תזרימים · {d} דיבידנדים · {from} עד {to} · סוגים: {y} · בלי היסטוריה: {w}',
  perfXirr: 'תשואה משוקללת־כסף (XIRR)',
  perfRealized: 'רווח ממומש',
  perfUnrealized: 'רווח לא־ממומש',
  perfDividends: 'דיבידנדים',
  perfInterest: 'ריבית',
  perfTaxes: 'מסים (ניכוי במקור)',
  perfFees: 'עמלות ועמלות נוספות',
  cantCalc: 'לא ניתן לחשב',
  ovInReportPeriod: 'בתקופת הדוח',
  pfNoteIbkr: 'שווי אמיתי מ־IBKR (NAV יומי מהדוח), בדולרים.',
  ibkrNavLegend: 'שווי אמיתי (IBKR)',
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
  editBtn: ICON_EDIT + 'עריכה',
  editHintStocks: 'מצב עריכה פעיל — אפשר לערוך, להוסיף ולמחוק מניות. בסיום לחצו שוב על עריכה.',
  stockSearchPh: 'חפש מניה להוספה (למשל: AAPL)',
  stockSearchNoResults: 'לא נמצאו תוצאות',
  stockSearchError: 'החיפוש נכשל — נסה שוב',
  sortBy: 'מיון:',
  sortSize: 'גודל בתיק',
  sortDay: 'ביצועי היום',
  sortGain: 'מהקנייה',
  editHint: 'מצב עריכה פעיל — בסיום לחצו שוב על עריכה.',
  addStock: 'הוספת מניה',
  noStocks: 'אין מניות בתיק. הפעילו עריכה כדי להוסיף.',
  btnEdit: ICON_EDIT + 'ערוך',
  btnDelete: ICON_TRASH + 'מחק',
  todayChg: 'היום {v}',
  kvShares: 'מניות',
  kvAvg: 'מחיר קנייה ממוצע',
  kvValue: 'שווי',
  kvGL: 'רווח/הפסד',
  kvWeight: 'משקל בתיק',
  offAth: '{v} מהשיא',
  measure: ICON_MEASURE + 'מדידה',
  measureTitle: 'בחירת שתי נקודות על הגרף למדידת תשואה ביניהן',
  measureOn: 'מצב מדידה: געו בשתי נקודות על הגרף — התשואה ביניהן תוצג. געו שוב כדי להתחיל מחדש.',
  measureTip: 'טיפ: לחצו מדידה ואז געו בשתי נקודות כדי למדוד תשואה ביניהן.',
  mReturn: 'תשואה: ',
  clearMeasure: 'ניקוי מדידה',
  loadingData: 'טוען נתונים…',
  loadingHist: 'טוען נתוני היסטוריה…',
  loadingHistN: 'טוען נתוני היסטוריה… ({done}/{total})',
  noChartData: 'לא התקבלו נתוני גרף',
  noChartNow: 'אין נתוני גרף כרגע',
  noPriceYet: 'אין נתוני מחיר עדיין',
  totalStocks: 'סך מניות',
  myPortfolio: 'התיק שלי',

  rangeDay: 'יום',
  rangeWeek: 'שבוע',
  rangeMonth: 'חודש',
  range1m: 'חודש',
  range3m: '3 חודשים',
  range6m: '6 חודשים',
  rangeYtd: 'YTD',
  rangeYear: 'שנה',
  range5y: '5 שנים',
  range3y: '3 שנים',
  rangeMax: 'מקסימום',
  benchSP: 'S&P 500',
  benchNasdaq: 'Nasdaq 100',
  pfConfirmFrom: 'לקבוע את {date} כהתחלה?',
  pfCustom: 'מותאם אישית',
  pfClearCustom: '✕ נקה',
  pfNoBench: 'אין נתוני מדדים כרגע — מוצג התיק בלבד',
  pfBenchIbkrOnly: 'השוואת מדדים זמינה בסנכרון IBKR',
  pfFromBtn: 'תשואה מתאריך',
  pfMarkOnChart: ICON_PIN + 'סמן בגרף',
  pfPickFromCal: 'בחר מהיומן',
  pfCalTitle: 'בחר תאריך התחלה',
  pfPickBubble: 'געו בנקודה על הגרף לבחירת תאריך ההתחלה',
  pfRangeReturn: 'תשואת התיק',
  pfNoteTrades: 'היסטוריה אמיתית — משוחזרת מעסקאות IBKR: קניות, מכירות והפקדות/משיכות מנוטרלות מהתשואה',

  sourceLabel: 'מקור: {src} · דיליי ~15 דקות{sess}{stale}',
  sessionPre: ' · טרום־מסחר',
  sessionPost: ' · אחרי־מסחר',
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
  btnOk: 'אישור',
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

  myAccount: 'החשבון שלי',
  appVersion: 'גרסת אפליקציה: ',
  clearCacheBtn: 'נקה מטמון ורענן',
  tdKeyTitle: 'מפתח נתונים (Twelve Data)',
  tdKeyDesc: 'המפתח מפעיל את הגרפים. נשמר בחשבון שלך בענן (או בטלפון, בלי חשבון).',
  tdSignup: 'להרשמה חינמית ב־Twelve Data',
  tdKeyPh: 'הדבק כאן את המפתח',
  tdKeySaved: 'מפתח שמור: ••••{last4} — הגרפים פעילים',
  tdKeyMissing: 'אין מפתח שמור — הגרפים לא יעבדו. הזן מפתח למטה.',
  tdKeySavedFlash: 'המפתח נשמר ✓',

  ibkrTitle: 'חיבור ברוקר למשיכת מידע',
  ibkrDesc: 'אופציונלי — מושך דוח קריאה־בלבד מ־Interactive Brokers. אי אפשר לסחור דרכו. הסנכרון רק מוריד נתונים לצפייה; כפתור הייבוא מכניס את הפוזיציות לתיק (בהסכמתך).',
  ibkrProxyLabel: 'כתובת השרתון',
  ibkrQueryPh: 'מ־IBKR',
  ibkrTokenNote: 'ה־token נשמר בטלפון בלבד — לעולם לא בענן ולא בקוד.',
  ibkrSaveTest: 'שמור ובדוק חיבור',
  ibkrSyncImportBtn: ICON_SYNC + 'סנכרן וייבא מ־IBKR',
  ibkrDisconnectBtn: 'ניתוק',
  ibkrNotConnected: 'לא מחובר — מוצגים הנתונים הידניים.',
  ibkrDepositsNote: 'מסונכרן מ־IBKR — ההפקדות מתעדכנות אוטומטית בכל סנכרון.',
  ibkrStocksNote: 'מסונכרן מ־IBKR — המניות מתעדכנות אוטומטית בכל סנכרון. עריכה ידנית תידרס בסנכרון הבא.',
  importTruncatedWarn: 'שים לב: ההעברה הכי מוקדמת בדוח היא מתאריך {date} — ייתכן שהפקדות מוקדמות יותר לא נכללו, ואז התשואה המחושבת עלולה להיות מנופחת.',
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
  fetchHistory: 'מושך היסטוריה מ־IBKR… (חלק {n} מתוך {total})',
  importNoStocks: 'לא נמצאו פוזיציות מניות בדוח IBKR',
  importSkippedNote: ' ({n} שורות שאינן מניות דולריות דולגו)',
  importCashLine: 'מזומן מהדוח: ${usd} / ₪{ils}',
  importCashMissing: 'מזומן לא נמצא בדוח — יישמר המזומן הקיים (כדאי להוסיף את מקטע Cash Report לשאילתת ה־Flex).',
  importConfirm: 'נמצאו {n} מניות בדוח ({lots} שורות קנייה אוחדו לפי סימבול).\n{cashLine}\n{depLine}\nפעולה זו תחליף את המניות, המזומן וההפקדות בתיק. פנסיה לא תשתנה.{skipped}\nלהמשיך?',
  importDepLine: 'הפקדות מהדוח: {n} העברות (נטו {total}) — יחליפו את רשימת ההפקדות.',
  importDepMissing: 'לא נמצאו הפקדות/משיכות בדוח — רשימת ההפקדות לא תשתנה (כדאי להוסיף את מקטע Cash Transactions לשאילתת ה־Flex).',
  importedOk: 'סונכרן ויובאו {n} מניות מ־IBKR ✓',
  importFailed: 'הסנכרון והייבוא נכשלו: {err}',
  disconnectConfirm: 'לנתק את חיבור הברוקר? הטוקן ונתוני הסנכרון יימחקו מהטלפון, והנתונים הידניים שהיו לפני החיבור ישוחזרו.',
  disconnected: 'החיבור נותק',
  disconnectedRestored: 'החיבור נותק והנתונים הידניים שוחזרו',
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
  curToggleAria: 'Toggle currency — dollar / shekel',
  langAria: 'Choose language',
  loading: 'Loading…',
  tabsAria: 'Tabs',
  tabOverview: 'Overview',
  tabStocks: 'Stocks',
  tabTrades: 'Trades',
  tradesTitle: 'Trade history',
  tradesNeedIbkr: 'Connect IBKR and sync to see your buy/sell history here.',
  tradesEmpty: 'No trades in the synced report — make sure the Trades section is enabled in your Flex query.',
  buySide: 'Buy',
  sellSide: 'Sell',
  commissionLbl: 'Commission',
  depEmptyIbkr: 'No cash transactions in the report — make sure the Cash Transactions section is enabled at Detail level (including Deposits & Withdrawals), save the query, then re-sync.',
  depEmptyIbkrTypes: 'The report has cash transactions, but no deposits/withdrawals were identified. Received types: {types}. If deposits are among them — send me a screenshot of this line.',
  flexGuide: 'Recommended Flex query sections: Trades · Cash Transactions · Open Positions · Cash Report · Change in NAV.',
  tabDeposits: 'Deposits',
  tabWishlist: 'Watchlist',
  wishlistTitle: 'Watchlist',
  wishlistHint: 'Stocks you are watching — live price and daily change. Not part of the portfolio.',
  wlSymbolPh: 'Symbol (e.g. NVDA)',
  wlNotePh: 'Note (optional)',
  wlAdd: '＋ Add to watchlist',
  wlEmpty: 'No stocks on your watchlist yet.',
  wlAdded: 'Added to watchlist ✓',
  wlRemoved: 'Removed from watchlist',
  wlRemove: 'Remove {sym} from watchlist',
  wlDelConfirm: 'Remove {sym} from the watchlist?',
  wlExists: '{sym} is already on the list',
  wlAlreadyOwn: '{sym} is already in your portfolio',
  wlNoPrice: 'No price yet',
  earnTitle: ICON_CHART + 'Upcoming earnings',
  earnToday: 'Today',
  earnTomorrow: 'Tomorrow',
  earnInDays: 'in {n} days',
  earnBmo: 'Before open',
  earnAmc: 'After close',
  earnDate: 'Earnings: {date}',
  ibkrPerfTitle: 'IBKR Performance',
  perfPeriod: 'Report period: {a}–{b}',
  twrOfficial: "IBKR's official TWR",
  twrMissing: 'Missing from report — enable the Change in NAV Flex section',
  estMark: '(est.)',
  yieldEstNote: 'Estimated return from report data — not official TWR',
  perfGainEst: 'Est. period gain',
  navWarn: 'The report is missing the "Change in NAV" section — without it, return (TWR), period gain/loss and XIRR cannot be computed. To fix: in IBKR go to Reports → Flex Queries → edit the query → check "Change in NAV" → save → re-sync in the app.',
  ovValueReport: 'Incl. cash · per IBKR report',
  ovStocksSub: 'Incl. cash',
  perfTwr: 'Time-Weighted Return (TWR)',
  pfDiag: 'Diagnostics: {t} trades · {f} flows · {d} dividends · {from} to {to} · types: {y} · no history: {w}',
  perfXirr: 'Money-Weighted Return (XIRR)',
  perfRealized: 'Realized P&L',
  perfUnrealized: 'Unrealized P&L',
  perfDividends: 'Dividends',
  perfInterest: 'Interest',
  perfTaxes: 'Taxes (withheld)',
  perfFees: 'Commissions & other fees',
  cantCalc: 'Cannot compute',
  ovInReportPeriod: 'in the report period',
  pfNoteIbkr: 'Real IBKR value (daily NAV from the report), in USD.',
  ibkrNavLegend: 'Real value (IBKR)',
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
  editBtn: ICON_EDIT + 'Edit',
  editHintStocks: 'Edit mode is on — you can edit, add and delete stocks. When done, tap Edit again.',
  stockSearchPh: 'Search a stock to add (e.g. AAPL)',
  stockSearchNoResults: 'No results found',
  stockSearchError: 'Search failed — try again',
  sortBy: 'Sort:',
  sortSize: 'Position size',
  sortDay: "Day's change",
  sortGain: 'Since buy',
  editHint: 'Edit mode is on — when done, tap Edit again.',
  addStock: 'Add stock',
  noStocks: 'No stocks in the portfolio. Turn on Edit to add.',
  btnEdit: ICON_EDIT + 'Edit',
  btnDelete: ICON_TRASH + 'Delete',
  todayChg: 'Today {v}',
  kvShares: 'Shares',
  kvAvg: 'Avg buy price',
  kvValue: 'Value',
  kvGL: 'Gain/Loss',
  kvWeight: 'Portfolio weight',
  offAth: '{v} off ATH',
  measure: ICON_MEASURE + 'Measure',
  measureTitle: 'Pick two points on the chart to measure the return between them',
  measureOn: 'Measure mode: tap two points on the chart — the return between them will show. Tap again to restart.',
  measureTip: 'Tip: tap Measure, then tap two points to measure the return between them.',
  mReturn: 'Return: ',
  clearMeasure: 'Clear measurement',
  loadingData: 'Loading data…',
  loadingHist: 'Loading history data…',
  loadingHistN: 'Loading history data… ({done}/{total})',
  noChartData: 'No chart data received',
  noChartNow: 'No chart data right now',
  noPriceYet: 'No price data yet',
  totalStocks: 'Stocks total',
  myPortfolio: 'My portfolio',

  rangeDay: 'Day',
  rangeWeek: 'Week',
  rangeMonth: 'Month',
  range1m: '1M',
  range3m: '3M',
  range6m: '6M',
  rangeYtd: 'YTD',
  rangeYear: 'Year',
  range5y: '5Y',
  range3y: '3Y',
  rangeMax: 'Max',
  benchSP: 'S&P 500',
  benchNasdaq: 'Nasdaq 100',
  pfConfirmFrom: 'Set {date} as the start?',
  pfCustom: 'Custom',
  pfClearCustom: '✕ Clear',
  pfNoBench: 'No benchmark data right now — portfolio only',
  pfBenchIbkrOnly: 'Benchmark comparison is available with IBKR sync',
  pfFromBtn: 'Return from date',
  pfMarkOnChart: ICON_PIN + 'Pick on chart',
  pfPickFromCal: 'Choose from calendar',
  pfCalTitle: 'Choose start date',
  pfPickBubble: 'Tap a point on the chart to choose the start date',
  pfRangeReturn: 'Portfolio return',
  pfNoteTrades: 'True history — reconstructed from IBKR trades: buys, sells and deposits/withdrawals excluded from the return',

  sourceLabel: 'Source: {src} · ~15 min delay{sess}{stale}',
  sessionPre: ' · pre-market',
  sessionPost: ' · post-market',
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
  btnOk: 'OK',
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

  myAccount: 'My account',
  appVersion: 'App version: ',
  clearCacheBtn: 'Clear cache & reload',
  tdKeyTitle: 'Data key (Twelve Data)',
  tdKeyDesc: 'The key powers the charts. Stored in your cloud account (or on the phone, without an account).',
  tdSignup: 'Free Twelve Data signup',
  tdKeyPh: 'Paste your key here',
  tdKeySaved: 'Key saved: ••••{last4} — charts are active',
  tdKeyMissing: 'No saved key — charts won\'t work. Enter a key below.',
  tdKeySavedFlash: 'Key saved ✓',

  ibkrTitle: 'Broker connection (data pull)',
  ibkrDesc: 'Optional — pulls a read-only report from Interactive Brokers. No trading possible. Sync only downloads data for viewing; the Import button adds positions to the portfolio (with your approval).',
  ibkrProxyLabel: 'Proxy URL',
  ibkrQueryPh: 'from IBKR',
  ibkrTokenNote: 'The token is stored on this phone only — never in the cloud or in code.',
  ibkrSaveTest: 'Save & test connection',
  ibkrSyncImportBtn: ICON_SYNC + 'Sync & import from IBKR',
  ibkrDisconnectBtn: 'Disconnect',
  ibkrNotConnected: 'Not connected — showing manual data.',
  ibkrDepositsNote: 'Synced from IBKR — deposits update automatically on every sync.',
  ibkrStocksNote: 'Synced from IBKR — stocks update automatically on every sync. Manual edits will be overwritten on the next sync.',
  importTruncatedWarn: 'Note: the earliest transfer in the report is from {date} — earlier deposits may be missing, so the computed return could be overstated.',
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
  fetchHistory: 'Fetching history from IBKR… (part {n} of {total})',
  importNoStocks: 'No stock positions found in the IBKR report',
  importSkippedNote: ' ({n} non-USD-stock rows skipped)',
  importCashLine: 'Cash from report: ${usd} / ₪{ils}',
  importCashMissing: 'No cash found in the report — keeping existing cash (consider adding the Cash Report section to your Flex query).',
  importConfirm: 'Found {n} stocks in the report ({lots} purchase rows merged by symbol).\n{cashLine}\n{depLine}\nThis will replace the stocks, cash and deposits in the portfolio. Pension will not change.{skipped}\nContinue?',
  importDepLine: 'Deposits from the report: {n} transfers (net {total}) — will replace the deposits list.',
  importDepMissing: 'No deposits/withdrawals found in the report — the deposits list will not change (consider adding the Cash Transactions section to your Flex query).',
  importedOk: 'Synced & imported {n} stocks from IBKR ✓',
  importFailed: 'Sync & import failed: {err}',
  disconnectConfirm: 'Disconnect the broker? The token and sync data will be deleted from this phone, and the manual data from before the connection will be restored.',
  disconnected: 'Disconnected',
  disconnectedRestored: 'Disconnected — manual data restored',
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
  try { renderPfNote(); } catch (e) {}
  try {
    const gSub = document.getElementById('ovGLSub');
    if (gSub) gSub.textContent = (typeof isIbkrMode === 'function' && isIbkrMode())
      ? t('ovInReportPeriod') : t('ovVsNetDeposits');
  } catch (e) {}
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
  try { paintLangMenu(); } catch (e) {}
}

/* v92: תפריט שפה נקי ב־header — נפתח/נסגר, בחירה מחליפה שפה בכל האפליקציה. */
function paintLangMenu() {
  const cur = getLang();
  document.querySelectorAll('#langMenu .lang-menu-item').forEach((it) => {
    const on = it.dataset.lang === cur;
    it.classList.toggle('on', on);
    it.setAttribute('aria-checked', on ? 'true' : 'false');
  });
}
function initLangMenu() {
  const btn = document.getElementById('langBtn');
  const menu = document.getElementById('langMenu');
  if (!btn || !menu) return;
  btn.innerHTML = ICON_GLOBE;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    if (willOpen) paintLangMenu();
  });
  menu.querySelectorAll('.lang-menu-item').forEach((it) => {
    it.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.classList.add('hidden');
      setLang(it.dataset.lang);
    });
  });
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('hidden') && !e.target.closest('.lang-wrap')) {
      menu.classList.add('hidden');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') menu.classList.add('hidden');
  });
  paintLangMenu();
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
    if (meta) meta.setAttribute('content', th === 'dark' ? '#000000' : '#006A4E');
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
    const adjArr = (res.indicators && res.indicators.adjclose && res.indicators.adjclose[0] &&
      res.indicators.adjclose[0].adjclose) || [];
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
        volume: parseInt(vols[i], 10) || 0,
        _adj: pf(adjArr[i]) || 0, // זמני לזיהוי ספליטים
      });
    }
    applySplitAdjustment(rows);
    for (const r of rows) delete r._adj;
  } catch (e) {}
  return rows;
}

/* התאמת ספליטים: מחירי Yahoo לא מותאמים לספליט. מזהים קפיצה ביחס adjclose/close
   (דיבידנד מזיז מעט, ספליט קופץ פי 2/3/5/10) ומחלקים את המחירים שלפני הספליט ביחס.
   אם אין adjclose (מקור לא־Yahoo כמו Stooq), מזהים מגאפ מחירים: פתיחה חדה
   מתחת לסגירה קודמת ביחס ספליט נפוץ. בלי זה, שחזור TWR מנפח את העבר ומדכא תשואה.
   (פונקציה טהורה — נבדקת) */
function applySplitAdjustment(rows) {
  if (!rows || rows.length < 2) return rows;
  const splits = []; // {date, ratio}
  const hasAdj = rows.some((r) => r._adj > 0);
  if (hasAdj) {
    for (let i = 1; i < rows.length; i++) {
      const a0 = rows[i - 1]._adj, c0 = rows[i - 1].close;
      const a1 = rows[i]._adj, c1 = rows[i].close;
      if (!(a0 > 0) || !(c0 > 0) || !(a1 > 0) || !(c1 > 0)) continue;
      const r0 = a0 / c0, r1 = a1 / c1;
      if (!(r0 > 0) || !(r1 > 0)) continue;
      const jump = r1 / r0;
      // ספליט: קפיצה חדה ביחס. דיבידנד רגיל מזיז <2%, סף 8% בטוח.
      // לספליט 2:1: לפני הספליט r=0.5, אחריו r=1 → ratio=2, מחלקים מחירי עבר ב־2.
      if (jump > 1.08 || jump < 0.92) {
        const ratio = r1 / r0;
        if (ratio > 1.08 || ratio < 0.92) splits.push({ date: rows[i].date, ratio });
      }
    }
  } else {
    // אין adjclose (Stooq/Twelve) — זיהוי מגאפ: פתיחה חדה מתחת לסגירה קודמת
    for (let i = 1; i < rows.length; i++) {
      const pc = rows[i - 1].close, op = rows[i].open;
      if (!(pc > 0) || !(op > 0)) continue;
      const g = op / pc;
      let ratio = 0;
      if (g > 0.47 && g < 0.53) ratio = 2;        // 2:1
      else if (g > 0.31 && g < 0.36) ratio = 3;   // 3:1
      else if (g > 0.23 && g < 0.27) ratio = 4;   // 4:1
      else if (g > 0.18 && g < 0.22) ratio = 5;   // 5:1 (NOW דצמבר 2025)
      else if (g > 0.09 && g < 0.11) ratio = 10;  // 10:1
      else if (g > 0.63 && g < 0.71) ratio = 1.5; // 3:2
      else if (g > 1.9 && g < 2.1) ratio = 0.5;   // איחוד 1:2
      if (ratio) splits.push({ date: rows[i].date, ratio });
    }
  }
  if (!splits.length) return rows;
  for (const s of splits) {
    for (const r of rows) {
      if (r.date < s.date) {
        r.close /= s.ratio; r.open /= s.ratio; r.high /= s.ratio; r.low /= s.ratio;
      }
    }
  }
  rows.splitsApplied = splits.map((s) => s.date + '×' + (Math.round(s.ratio * 100) / 100)).join(',');
  return rows;
}

/* ספליטים ידועים עובדתית — רשת ביטחון למקרה שמטא־הספליטים אבדו מהמטמון
   (למשל שורות שנשמרו לפני v70, כש־JSON השמיט את התכונה המותאמת).
   NOW: ספליט 5:1 ב־18/12/2025 — אומת מול נתוני המסחר של IBKR. */
const KNOWN_SPLITS = {
  'NOW': [{ date: '2025-12-18', ratio: 5 }],
};
const LS_HIST_V1 = 'pwa_hist_v1_'; // מפתח המטמון הקודם — לנדידת חירום בלבד (v71)

/* מתקן שורות מטמון ישנות שאין להן מטא־ספליטים: בודק את המחירים סביב תאריך
   הספליט הידוע — אם היחס לפני/אחרי ≈ יחס הספליט, המחירים עוד לא הותאמו
   ומחלקים אותם; אם היחס ≈ 1, כבר הותאמו ורק מצרפים מטא־נתונים.
   אם לא ניתן לזהות — לא נוגע (בטוח). פונקציה טהורה, נבדקת. */
function repairKnownSplits(sym, rows) {
  const known = KNOWN_SPLITS[String(sym || '').toUpperCase()];
  if (!known || !rows || rows.length < 10) return false;
  let fixed = false;
  for (const s of known) {
    const meta = s.date + '×' + (Math.round(s.ratio * 100) / 100);
    const has = String(rows.splitsApplied || '').split(',').some((x) => x.split('×')[0] === s.date);
    const pre = [], post = [];
    for (const r of rows) {
      if (!r || !r.date || !(r.close > 0)) continue;
      if (r.date < s.date) { if (r.date >= addDaysISO(s.date, -14)) pre.push(r.close); }
      else if (r.date > s.date) { if (r.date <= addDaysISO(s.date, 14)) post.push(r.close); }
    }
    if (pre.length < 3 || post.length < 3) continue;
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    const obs = avg(pre) / avg(post);
    if (Math.abs(obs - s.ratio) / s.ratio < 0.25) {
      for (const r of rows) {
        if (r.date < s.date) {
          if (r.open) r.open /= s.ratio;
          if (r.high) r.high /= s.ratio;
          if (r.low) r.low /= s.ratio;
          r.close /= s.ratio;
        }
      }
      if (!has) rows.splitsApplied = (rows.splitsApplied ? rows.splitsApplied + ',' : '') + meta;
      fixed = true;
    } else if (Math.abs(obs - 1) < 0.25) {
      // המחירים כבר מותאמים (Yahoo) — רק מסמנים מטא כדי שהעסקאות יומרו.
      // (הוכח ב־v70: בלי מטא, עסקאות טרום־ספליט לא מומרות → TWR שגוי.)
      if (!has) rows.splitsApplied = (rows.splitsApplied ? rows.splitsApplied + ',' : '') + meta;
      fixed = true;
    }
  }
  return fixed;
}

/* נדידת חירום v1→v2: מעתיקה שורות מהמפתח הישן (שה־v70 ייתם) למפתח החדש,
   עם תיקון ספליטים — כדי שהגרף יעלה מיד בלי 17 טעינות רשת איטיות,
   וה־TWR יישאר נכון גם בלי רשת. מחזירה רשומת מטמון או null. */
function migrateHistCacheV1(sym) {
  try {
    const key = LS_HIST_V1 + String(sym || '').toUpperCase();
    const old = lsGet(key);
    if (!old || !old.rows || !old.rows.length) return null;
    const rows = old.rows;
    try { repairKnownSplits(sym, rows); } catch (e) {}
    const rec = { at: Number(old.at) || Date.now(), rows: rows, splits: rows.splitsApplied || null };
    lsSet(LS_HIST + String(sym || '').toUpperCase(), rec);
    try { localStorage.removeItem(key); } catch (e) {}
    return rec;
  } catch (e) { return null; }
}

/* מסווג שגיאת רשת למילים פשוטות — כדי שנראה מה קרה בטלפון */
function netErrName(e) {
  if (e && e.name === 'AbortError') return t('errTimeout');
  if (e instanceof TypeError) return t('errBlocked');
  if (e && e.message) return String(e.message).slice(0, 40);
  return t('errGeneric');
}

/* ניסיון אחד להביא נרות מ־Yahoo; מחזיר rows או null ורושם מה קרה */
async function fetchYahooBars(url, withTime, notes, name, ms) {
  try {
    const rows = parseYahooBars(await fetchJSONTimeout(url, ms || 12000), withTime);
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
const LS_EARN = 'pwa_earn_v1'; // מטמון דוחות קרובים — 24 שעות

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

/* מפענח תשובת earnings_calendar של Twelve Data למיפוי sym -> { date, time }.
   טהור וסובלני לשני מבני תשובה אפשריים (data[] או earnings{}). */
function parseEarningsCalendar(json) {
  const out = {};
  try {
    let entries = [];
    if (json && Array.isArray(json.data)) {
      entries = json.data;
    } else if (json && json.earnings && typeof json.earnings === 'object') {
      if (Array.isArray(json.earnings)) entries = json.earnings;
      else for (const k of Object.keys(json.earnings)) {
        const arr = json.earnings[k];
        if (Array.isArray(arr)) entries = entries.concat(arr.map((e) => Object.assign({ symbol: k }, e)));
      }
    }
    const today = todayISO();
    for (const e of entries) {
      if (!e || typeof e !== 'object') continue;
      const sym = String(e.symbol || '').toUpperCase();
      const date = String(e.date || '').slice(0, 10);
      if (!sym || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < today) continue;
      if (!out[sym] || date < out[sym].date) out[sym] = { date: date, time: String(e.time || '') };
    }
  } catch (err) {}
  return out;
}

/* דוחות קרובים — בקשה אחת לכל הסימבולים (40 קרדיטים), מטמון 24 שעות.
   כישלון שקט: פשוט לא מציגים (לא קריטי כמו מחירים). */
async function refreshEarnings() {
  const syms = quoteSymbols();
  if (!syms.length) return;
  const cached = lsGet(LS_EARN);
  const freshDay = cached && cached.at && cached.bySym &&
    new Date(cached.at).toDateString() === new Date().toDateString();
  if (freshDay) { state.earnings = cached.bySym; return; }
  if (!tdKey()) return;
  await tdThrottle();
  const url = 'https://api.twelvedata.com/earnings_calendar?symbol=' + encodeURIComponent(syms.join(',')) +
    '&start_date=' + todayISO() + '&apikey=' + encodeURIComponent(tdKey());
  try {
    const json = await fetchJSONTimeout(url, 15000);
    if (json && (json.status === 'error' || (json.code && json.code >= 400))) return;
    const bySym = parseEarningsCalendar(json);
    state.earnings = bySym;
    lsSet(LS_EARN, { at: Date.now(), bySym: bySym });
  } catch (e) { /* שקט */ }
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
    case '1m':    return rows.slice(-22);
    case '3m':    return rows.slice(-66);
    case '6m':    return rows.slice(-132);
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
  try { if (typeof ibkrThCacheClear === 'function') ibkrThCacheClear(); } catch (e) {}
  return c;
}
function ibkrProxyBase() {
  return (((ibkrCfg().proxyUrl || '') || IBKR_PROXY_DEFAULT).trim().replace(/\/+$/, ''));
}

/* מחלק טווח תאריכים לחלקים של עד 365 יום (מגבלת IBKR לבקשה).
   מחזיר מערך של {fd, td} בפורמט YYYYMMDD. */
function ibkrDateChunks(startYmd, endYmd) {
  const chunks = [];
  let cur = startYmd;
  while (cur <= endYmd) {
    // מוסיף 364 ימים (365 כולל) או עד הסוף
    const curDate = new Date(cur.slice(0,4), cur.slice(4,6)-1, cur.slice(6,8));
    curDate.setDate(curDate.getDate() + 364);
    let chunkEnd = curDate.getFullYear().toString().padStart(4,'0') +
      (curDate.getMonth()+1).toString().padStart(2,'0') +
      curDate.getDate().toString().padStart(2,'0');
    if (chunkEnd > endYmd) chunkEnd = endYmd;
    chunks.push({ fd: cur, td: chunkEnd });
    // החלק הבא מתחיל יום אחרי סוף החלק הנוכחי
    const nextDate = new Date(chunkEnd.slice(0,4), chunkEnd.slice(4,6)-1, chunkEnd.slice(6,8));
    nextDate.setDate(nextDate.getDate() + 1);
    cur = nextDate.getFullYear().toString().padStart(4,'0') +
      (nextDate.getMonth()+1).toString().padStart(2,'0') +
      nextDate.getDate().toString().padStart(2,'0');
  }
  return chunks;
}

/* מושך היסטוריה מלאה מ־IBKR במספר בקשות (כל אחת עד 365 יום) וממזג.
   startYmd: תאריך התחלה בפורמט YYYYMMDD (ברירת מחדל: שנתיים אחורה).
   מחזיר data ממוזג עם trades, cashTransactions, positions (מהדוח האחרון), וכו'. */
async function ibkrFetchFullHistory(fetchFn, proxyUrl, token, queryId, startYmd, onProgress) {
  const today = new Date();
  const endYmd = today.getFullYear().toString().padStart(4,'0') +
    (today.getMonth()+1).toString().padStart(2,'0') +
    today.getDate().toString().padStart(2,'0');
  if (!/^\d{8}$/.test(startYmd || '')) {
    // ברירת מחדל: שנתיים אחורה (מגבלת השמירה של IBKR)
    const d = new Date(today);
    d.setFullYear(d.getFullYear() - 2);
    startYmd = d.getFullYear().toString().padStart(4,'0') +
      (d.getMonth()+1).toString().padStart(2,'0') +
      d.getDate().toString().padStart(2,'0');
  }
  const chunks = ibkrDateChunks(startYmd, endYmd);
  const merged = { trades: [], cashTransactions: [], positions: [], transfers: [] };
  const seenTradeKeys = new Set();
  const seenCashKeys = new Set();
  
  for (let i = 0; i < chunks.length; i++) {
    const { fd, td } = chunks[i];
    if (onProgress) onProgress(i + 1, chunks.length, fd, td);
    try {
      const rep = await ibkrRequestReport(fetchFn, proxyUrl, token, queryId, fd, td);
      const data = await ibkrPollStatement(fetchFn, proxyUrl, token, rep.referenceCode, rep.statementUrl);
      // ממזג עסקאות (מניעת כפילויות לפי מפתח ייחודי)
      for (const tr of (data.trades || [])) {
        const key = [tr.date, tr.symbol, tr.quantity, tr.price, tr.buySell].join('|');
        if (!seenTradeKeys.has(key)) {
          seenTradeKeys.add(key);
          merged.trades.push(tr);
        }
      }
      // ממזג תנועות מזומן
      for (const c of (data.cashTransactions || [])) {
        const key = [c.date, c.amount, c.type, c.description].join('|');
        if (!seenCashKeys.has(key)) {
          seenCashKeys.add(key);
          merged.cashTransactions.push(c);
        }
      }
      // פוזיציות: לוקח מהדוח האחרון (העדכני ביותר)
      if (data.positions && data.positions.length) {
        merged.positions = data.positions;
      }
      // שומר מטא-דאטה מהדוח האחרון
      if (i === chunks.length - 1) {
        merged.accountId = data.accountId;
        merged.fromDate = startYmd;
        merged.toDate = endYmd;
      }
    } catch (e) {
      // אם חלק נכשל (למשל 1003 - אין נתונים לתקופה), ממשיכים לחלק הבא
      console.warn('Chunk failed:', fd, td, e.message);
    }
  }
  // ממיין לפי תאריך
  merged.trades.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  merged.cashTransactions.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  return merged;
}

/* מבקש מ־IBKR (דרך השרתון) ליצור דוח Flex. מחזיר { referenceCode, statementUrl }.
   fd/td אופציונליים (YYYYMMDD) לדריסת טווח התאריכים — עד 365 יום לבקשה. */
async function ibkrRequestReport(fetchFn, proxyUrl, token, queryId, fd, td) {
  const body = { token, queryId };
  if (/^\d{8}$/.test(fd || '') && /^\d{8}$/.test(td || '')) {
    body.fd = fd; body.td = td;
  }
  const r = await fetchWithTimeout(fetchFn, proxyUrl + '/api/flex-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }, 45000);
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
      const r = await fetchWithTimeout(fetchFn, proxyUrl + '/api/flex-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code, statementUrl: statementUrl || '' })
      }, 45000);
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
  // התראה בולטת כשהדוח חסר Change in NAV — בלי זה אין תשואות
  const w = document.getElementById('ibkrNavWarn');
  if (w) {
    const miss = connected && !!(cfg.data) && !(cfg.data.nav);
    w.classList.toggle('hidden', !miss);
    if (miss) w.textContent = t('navWarn');
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
   מבקש אישור עם סיכום, ומחליף מניות (+מזומן, רק אם נמצא בדוח) והפקדות
   (רק העברות חיצוניות מהדוח, מומרות לשקלים). פנסיה לא נפגעת. */
async function ibkrSyncImport() {
  ibkrClearErr();
  const cfg = ibkrCfg();
  const proxyUrl = ibkrProxyBase();
  if (!proxyUrl) return ibkrShowErr(t('proxyUrlMissing'));
  if (!cfg.token || !cfg.queryId) return ibkrShowErr(t('credsMissingSave'));
  ibkrSetBusy(true);
  try {
    const s = document.getElementById('ibkrStatus');
    // מושך היסטוריה מלאה — שנתיים אחורה (מגבלת השמירה של IBKR).
    // במספר חלקים של עד 365 יום, עם מיזוג ומניעת כפילויות.
    if (s) s.textContent = t('fetchHistory', { n: 1, total: '…' });
    const data = await ibkrFetchFullHistory(fetch, proxyUrl, cfg.token, cfg.queryId, null, (i, total) => {
      if (s) s.textContent = t('fetchHistory', { n: i, total });
    });
    ibkrSaveCfg({ lastSync: Date.now(), data });
    const imp = ibkrMapImport(data);
    if (!imp.positions.length) {
      ibkrShowErr(t('importNoStocks') + (imp.skipped ? t('importSkippedNote', { n: imp.skipped }) : ''));
      return;
    }
    // הפקדות מהדוח: רק העברות חיצוניות (הפקדה/משיכה), מומרות לשקלים לפי שער יום ההעברה
    let txEarliest = null;
    for (const c of (data.cashTransactions || [])) {
      const dt = String(c.date || '').slice(0, 10);
      if (/^\d{4}-\d{2}-\d{2}$/.test(dt) && (!txEarliest || dt < txEarliest)) txEarliest = dt;
    }
    if (txEarliest) { try { await ensureFxHist(txEarliest); } catch (e) {} }
    const depList = ibkrMapDeposits(data.cashTransactions, (iso) => fxOnOrBefore(iso));
    const depNet = depList.reduce((a, d) => a + (d.amount || 0), 0);
    const depLine = depList.length
      ? t('importDepLine', { n: depList.length, total: '₪' + Math.abs(depNet).toLocaleString('en-US') })
      : t('importDepMissing');
    // אזהרת קטיעה: אם ההעברה הכי מוקדמת צמודה לתחילת הדוח, ייתכן שהפקדות מוקדמות חסרות
    const fromDate = (data.meta && data.meta.fromDate) || '';
    const truncLine = (txEarliest && fromDate && txEarliest <= addDaysISO(fromDate, 7))
      ? '\n' + t('importTruncatedWarn', { date: fromDate })
      : '';
    const cashLine = imp.cash
      ? t('importCashLine', { usd: imp.cash.usd, ils: imp.cash.ils })
      : t('importCashMissing');
    const msg = t('importConfirm', {
      n: imp.positions.length,
      lots: imp.lots,
      cashLine,
      depLine,
      skipped: (imp.skipped ? '\n' + t('importSkippedNote', { n: imp.skipped }).trim() : '') + truncLine
    });
    if (!confirm(msg)) return;
    // צילום הנתונים הידניים לפני הדריסה (רק אם אין כבר צילום), ואז החלפה מלאה:
    // במצב IBKR הטאבים מציגים את נתוני IBKR במקום הידניים (גם רשימת הפקדות ריקה)
    ibkrSnapshotManual();
    DB.positions.length = 0;
    DB.positions.push(...imp.positions);
    DEPOSITS.length = 0;
    DEPOSITS.push(...depList);
    DB.source = 'ibkr';
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

/* צילום הנתונים הידניים לפני יבוא IBKR — כדי שאפשר יהיה לשחזרם בניתוק.
   נשמר רק אם אין כבר צילום (סנכרון חוזר במצב IBKR לא דורס את המקור הידני).
   מחזיר true אם נשמר צילום חדש. */
function ibkrSnapshotManual() {
  if (DB.ibkrSnapshot) return false;
  const cp = (v) => JSON.parse(JSON.stringify(v || []));
  DB.ibkrSnapshot = {
    positions: cp(DB.positions),
    deposits: cp(DB.deposits),
    cash: JSON.parse(JSON.stringify(DB.cash || { usd: 0, ils: 0 })),
  };
  return true;
}

/* שחזור הנתונים הידניים אחרי ניתוק IBKR. מחזיר true אם שוחזר מצילום. */
function ibkrRestoreManual() {
  const snap = DB.ibkrSnapshot;
  if (!snap) return false;
  DB.positions.length = 0;
  DB.positions.push(...(snap.positions || []));
  DEPOSITS.length = 0;
  DEPOSITS.push(...(snap.deposits || []));
  DB.cash = snap.cash || { usd: 0, ils: 0 };
  delete DB.ibkrSnapshot;
  return true;
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
    // מסנן LOT (פירוט כפול) — רק SUMMARY (תיקון באג כפילות v68)
    if (p.levelOfDetail && p.levelOfDetail !== 'SUMMARY') { skipped++; continue; }
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
  // שחזור הנתונים הידניים שהיו לפני החיבור (אם נשמר צילום) — לא משאירים נתוני IBKR כ"ידניים"
  const restored = ibkrRestoreManual();
  DB.source = 'manual';
  saveDB();
  const tk = document.getElementById('ibkrToken');
  const qd = document.getElementById('ibkrQuery');
  if (tk) tk.value = '';
  if (qd) qd.value = '';
  renderAll();
  renderIbkrCard();
  if (restored) flash(t('disconnectedRestored')); else flash(t('disconnected'));
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

/* ימים מהיום עד תאריך ISO (שלילי = עבר) */
function daysUntil(iso) {
  const t = new Date(todayISO() + 'T00:00:00');
  const d = new Date(String(iso).slice(0, 10) + 'T00:00:00');
  return Math.round((d - t) / 86400000);
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
  wishlist: [],
  pensionFunds: [{ name: 'פנסיה — מקום עבודה', usd: 0, ils: 1000 }],
  pensionDeposits: [],
  cash: { usd: 100, ils: 100 }
};

/* גרסת האפליקציה — מוצגת בהגדרות כדי לוודא שהטלפון מעודכן */
const APP_VERSION = 'v96';


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
        if (!Array.isArray(db.wishlist)) db.wishlist = [];
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
  if (!Array.isArray(DB.wishlist)) DB.wishlist = [];
  if (!Array.isArray(DB.pensionFunds)) DB.pensionFunds = [];
  if (!Array.isArray(DB.pensionDeposits)) DB.pensionDeposits = [];
  DB.positions.length = 0;
  if (Array.isArray(clean.positions)) DB.positions.push(...clean.positions);
  DB.deposits.length = 0;
  if (Array.isArray(clean.deposits)) DB.deposits.push(...clean.deposits);
  DB.wishlist.length = 0;
  if (Array.isArray(clean.wishlist)) DB.wishlist.push(...clean.wishlist);
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
let WISHLIST = DB.wishlist;
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
const yahooQuoteURL = (sym) => yahooURL(sym, 'interval=1m&range=1d&includePrePost=true');

const LS_QUOTES = 'pwa_quotes_v2'; // v2: ניקוי מטמון ישן שסומן כ־Stooq
const LS_HIST = 'pwa_hist_v2_'; // + sym — v2: שומר מטא־ספליטים (תיקון באג מטמון v70)

/* צבעי תרשים העוגה — נגזרים מטוקני פלטת iOS 26 החיים, כך שהם מתחלפים
   אוטומטית בין ערכת בהיר לכהה (בטסטים: fallback של ערכת בהיר). */
const PIE_VARS = ['--sys-green', '--sys-blue', '--sys-teal', '--sys-purple', '--sys-pink', '--sys-orange', '--sys-yellow', '--sys-mint', '--sys-brown'];
const PIE_FALLBACK = ['#34C759', '#007AFF', '#5AC8FA', '#AF52DE', '#FF2D55', '#FF9500', '#FFCC00', '#00C7BE', '#A2845E'];
function pieColor(i) {
  return cssVar(PIE_VARS[i % PIE_VARS.length], PIE_FALLBACK[i % PIE_VARS.length]);
}

/* ---------------- מצב ---------------- */

const state = {
  currency: 'USD',
  quotes: {},       // sym -> quote
  fx: null,         // USDILS
  source: null,     // מאיזה מקור הגיעו המחירים (Yahoo / CNBC)
  session: '',      // סשן מסחר: 'pre' | 'post' | '' (רגיל/סגור)
  quotesAt: null,
  stale: false,     // מוצגים נתונים שמורים (אין חיבור)
  hist: {},         // sym -> daily rows
  earnings: {},     // sym -> { date, time } — דוחות קרובים מ־Twelve Data
  intra: {},        // sym -> intraday rows (יום)
  histDbg: {},      // sym -> מה קרה בניסיון להביא היסטוריה (לאבחון)
  open: {},         // sym -> bool (שורה פתוחה)
  range: {},        // sym -> 'day'|'week'|'month'|'ytd'|'year'|'5y'|'max'
  measure: {},      // sym -> { on, pts:[idxA, idxB] }
  pfRange: 'year',    // טווח גרף ביצועי התיק
  pfBench: null,      // {SPY:true, QQQ:true} — נטען/נשמר, ברירת מחדל: הכל דולק
  pfCustomFrom: null, // תאריך התחלה מותאם (YYYY-MM-DD) — דורס את pfRange
  pfPickDate: false,  // מצב בחירת תאריך התחלה בלחיצה על הגרף
  pfMeasure: { pts: [] }, // מדידה בין שתי נקודות על גרף התיק — מובנית בגרף
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

/* fetch עם timeout — לקריאות שעלולות להיתקע (פרוקסי IBKR): בלי זה בקשה
   תלויה אחת מקפיאה את כל הסנכרון ללא הגבלה. */
async function fetchWithTimeout(fetchFn, url, opts, ms) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms || 45000);
  try {
    return await fetchFn(url, Object.assign({}, opts, { signal: ctrl.signal }));
  } finally { clearTimeout(timer); }
}

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

function parseCNBCQuotes(json, useExt) {
  const out = {};
  const fqr = (json && json.FormattedQuoteResult) || {};
  let arr = fqr.FormattedQuote || [];
  if (!Array.isArray(arr)) arr = [arr];
  for (const it of arr) {
    if (!it || typeof it !== 'object') continue;
    const sym = String(it.symbol || '').toUpperCase();
    if (!sym) continue;
    // מסחר מורחב: last הרגיל תקוע על סגירת אתמול; ExtendedMktQuote חי
    let close = num(it.last), session = '', tm = String(it.last_time || '');
    const ext = (it.ExtendedMktQuote && typeof it.ExtendedMktQuote === 'object') ? it.ExtendedMktQuote : null;
    const extLast = ext ? num(ext.last) : 0;
    const extType = ext ? String(ext.type || '') : '';
    if (useExt && ext && extLast > 0 &&
        ((useExt === 'pre' && extType === 'PRE_MKT') || (useExt === 'post' && extType === 'POST_MKT'))) {
      close = extLast;
      session = useExt;
      tm = String(ext.last_timedate || ext.last_time || tm);
    }
    if (!(close > 0)) continue;
    out[sym] = {
      symbol: sym,
      date: todayISO(),
      time: tm,
      open: num(it.open),
      high: num(it.high),
      low: num(it.low),
      close: close,
      session: session,
      volume: parseInt(String(it.volume || '').replace(/,/g, ''), 10) || 0
    };
  }
  return out;
}

/* סשן המסחר כרגע לפי שעון ניו־יורק: pre / post / '' — טהור־למחצה, נבדק */
function etSessionNow(nowMs) {
  try {
    const d = nowMs ? new Date(nowMs) : new Date();
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
    const h = +parts.find((p) => p.type === 'hour').value % 24;
    const m = +parts.find((p) => p.type === 'minute').value;
    const t = h * 60 + m;
    if (t >= 4 * 60 && t < 9 * 60 + 30) return 'pre';
    if (t >= 16 * 60 && t < 20 * 60) return 'post';
  } catch (e) {}
  return '';
}

/* מפענח תשובת Yahoo v8 לציטוט חי — כולל מסחר מורחב (pre/post).
   טהור, נבדק. מחזיר null אם אין מחיר. */
function parseYahooQuote(json, sym, nowMs) {
  const chart = json && json.chart;
  const res = chart && chart.result && chart.result[0];
  if (!res || chart.error) return null;
  const meta = res.meta || {};
  const ind = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
  const closes = (ind.close || []).filter((c) => c > 0);
  // הסגירה האחרונה של נר הדקה — חיה גם ב־pre/post; גיבוי למחיר הרגיל
  const close = closes.length ? closes[closes.length - 1] : num(meta.regularMarketPrice);
  if (!(close > 0)) return null;
  let session = '';
  try {
    const ctp = meta.currentTradingPeriod || {};
    const nowS = (nowMs ? nowMs : Date.now()) / 1000;
    const inP = (p) => p && nowS >= p.start && nowS < p.end;
    if (inP(ctp.pre)) session = 'pre';
    else if (inP(ctp.post)) session = 'post';
    else session = 'regular';
  } catch (e) {}
  return {
    symbol: sym,
    date: todayISO(),
    time: '',
    open: null,
    high: num(meta.regularMarketDayHigh),
    low: num(meta.regularMarketDayLow),
    close: close,
    prev: num(meta.chartPreviousClose),
    session: session,
    volume: parseInt(meta.regularMarketVolume, 10) || 0
  };
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
  const sess = etSessionNow();
  const q = parseCNBCQuotes(json, sess);
  const missing = POSITIONS.filter((p) => !q[p.sym]).length;
  if (missing > Math.max(1, Math.floor(POSITIONS.length / 2))) throw new Error('too few quotes');
  return { quotes: q, fx: fx, source: 'CNBC', session: sess };
}

/* כל הסימבולים שצריכים ציטוט חי: אחזקות + רשימת מעקב */
function quoteSymbols() {
  const s = new Set();
  for (const p of POSITIONS) if (p.sym) s.add(p.sym);
  for (const w of WISHLIST) if (w.sym) s.add(w.sym);
  return [...s];
}

function applyQuotes(res) {
  state.quotes = res.quotes;
  state.fx = res.fx;
  state.source = res.source;
  state.session = res.session || '';
  state.quotesAt = Date.now();
  state.stale = false;
  lsSet(LS_QUOTES, { at: state.quotesAt, fx: state.fx, quotes: res.quotes, source: res.source, session: res.session || '' });
  setBanner(null);
  updateSourceLabel();
}

function updateSourceLabel() {
  const el = document.getElementById('sourceLabel');
  if (el) {
    const sess = state.session === 'pre' ? t('sessionPre') : state.session === 'post' ? t('sessionPost') : '';
    el.textContent = t('sourceLabel', { src: state.source || '—', sess: sess, stale: state.stale ? t('staleSuffix') : '' });
  }
}

async function tryYahooQuotes() {
  const results = await pool(quoteSymbols(), 3, async (sym) => {
    try {
      const json = await fetchJSONTimeout(yahooQuoteURL(sym), 10000);
      return parseYahooQuote(json, sym);
    } catch (e) { return null; }
  });
  const q = {};
  for (const r of results) if (r) q[r.symbol] = r;
  const missing = POSITIONS.filter((p) => !q[p.sym]).length;
  if (missing > Math.max(1, Math.floor(POSITIONS.length / 2))) throw new Error('too few quotes');
  const fx = await tryFx();
  const sess = (results.find((r) => r && r.session) || {}).session || '';
  return { quotes: q, fx: fx, source: 'Yahoo', session: sess === 'regular' ? '' : sess };
}

async function refreshQuotes() {
  if (!quoteSymbols().length) {
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
    state.session = cached.session || '';
    state.stale = true;
    setBanner(t('noPriceConn', { time: fmtTimeIL(cached.at) }));
  } else {
    state.source = null;
    setBanner(t('noPrices'));
  }
  updateSourceLabel();
  renderAll();
}

/* משחזר שורות היסטוריה מרשומת מטמון: מטא־ספליטים + רשת ביטחון לספליטים
   ידועים + שמירה ב־state. מחזיר את השורות. */
function restoreHistRows(sym, cached) {
  const rows = cached.rows;
  if (cached.splits) rows.splitsApplied = cached.splits; // v70: שחזור מטא־ספליטים
  // v74: תמיד מריץ תיקון לספליטים ידועים (לא רק כשחסר מטא) — למקרה שהמטא
  // השמור שגוי (למשל: מסמן "מותאם" כשהמחירים לא הותאמו, או להפך).
  let repaired = false;
  try { repaired = repairKnownSplits(sym, rows); } catch (e) {}
  state.hist[sym] = rows;
  // אם התיקון שינה מחירים — מטמון ה־TWR הישן לא תקף
  if (repaired) { try { if (typeof ibkrThCacheClear === 'function') ibkrThCacheClear(); } catch (e) {} }
  return rows;
}

/* טוען רשומת מטמון v2, ואם חסרה — מנסה נדידת חירום מ־v1 (v71).
   מחזיר רשומת מטמון או null. */
function loadHistCacheRec(sym) {
  let cached = null;
  try { cached = lsGet(LS_HIST + sym); } catch (e) {}
  if (cached && cached.rows && cached.rows.length) return cached;
  return migrateHistCacheV1(sym);
}

async function getDaily(sym, force) {
  const wantMax = state.range[sym] === 'max';
  if (!force && !wantMax) {
    if (state.hist[sym]) return state.hist[sym];
    const cached = loadHistCacheRec(sym); // v71: כולל נדידת v1
    if (cached && cached.rows && cached.rows.length) {
      // v69: מטמון 24 שעות (כמו getDailyFast) — עקבי
      const ageMs = Date.now() - (Number(cached.at) || 0);
      if (ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000) {
        return restoreHistRows(sym, cached);
      }
    }
  }
  const save = (rows) => {
    // v72: רשת ביטחון לספליטים גם בנתיב fetch טרי (כמו ב־_getDailyFastInner)
    if (rows) { try { repairKnownSplits(sym, rows); } catch (e) {} } // v74: תמיד, לא רק כשחסר
    state.hist[sym] = rows;
    state.histDbg[sym] = null;
    delete histNegCache[sym]; // v72: הצלחה מבטלת מטמון שלילי
    // v70: שומרים מטא־ספליטים בנפרד — תכונה מותאמת על מערך לא שורדת JSON
    lsSet(LS_HIST + sym, { at: Date.now(), rows: rows, splits: rows.splitsApplied || null });
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
  const cached = loadHistCacheRec(sym); // v71: כולל נדידת v1
  if (cached && cached.rows) {
    return restoreHistRows(sym, cached);
  }
  return [];
}

/* ---- פונקציות עזר לגרף הביצועים ---- */

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

/* הפרדה בין סוגי משתמשים: השוואת מדדים רק כשההיסטוריה אמיתית מ־IBKR.
   בהזנה ידנית (סימולציית אחזקות נוכחיות) אין השוואה — רק קו התיק. */
function pfShowBench(srcKind) {
  return srcKind === 'ibkr' || srcKind === 'trades';
}

/* מדדי השוואה דולקים/כבויים — ברירת מחדל: הכל דולק */
function pfBenchOn(sym) {
  const b = state.pfBench;
  return !b || b[sym] !== false;
}

/* כפתורי סימון/ביטול למדדי ההשוואה — ממשק נקי בסגנון אפל.
   מוצגים רק כשיש היסטוריה אמיתית מ־IBKR; בהזנה ידנית אין השוואה. */
function renderPfBenchToggles(show) {
  const host = document.getElementById('pfBenchToggles');
  if (!host) return;
  host.innerHTML = '';
  host.classList.toggle('hidden', !show);
  if (!show) return;
  for (const [sym, labelKey, color] of BENCH_SYMS) {
    const on = pfBenchOn(sym);
    const b = el('button', 'pf-bench-toggle' + (on ? ' on' : ''));
    b.type = 'button';
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    const dot = el('span', 'pf-bench-dot');
    dot.style.background = color;
    b.appendChild(dot);
    b.appendChild(el('span', 'pf-bench-lbl', t(labelKey)));
    const chk = el('span', 'pf-bench-check', on ? '✓' : '');
    b.appendChild(chk);
    b.addEventListener('click', async () => {
      if (!state.pfBench) state.pfBench = {};
      const turningOn = !pfBenchOn(sym);
      state.pfBench[sym] = turningOn;
      renderPfBenchToggles(true);
      if (turningOn) await drawPfChart(); // הפעלה: טוען את המדד החסר (מהיר — מטמון/מרוץ) ומצייר
      else paintPfChart(); // כיבוי: סינכרוני ומיידי, בלי רשת
    });
    host.appendChild(b);
  }
}

/* היסטוריה יומית מהירה לגרף הביצועים: מרוץ מקבילי Yahoo/Yahoo2/Stooq —
   הראשון שעונה מנצח, בלי לחכות ל־timeout של מקור חסום. Twelve Data רק
   כגיבוי אחרון (צריך מפתח). אותו מטמון ואותו פורמט שורות כמו getDaily. */
async function _getDailyFastInner(sym, force) {
  if (!force) {
    if (state.hist[sym]) return state.hist[sym];
    // v72: כשלון טרי — לא שורפים timeout רשת שוב; מחזירים מטמון פג־תוקף אם קיים
    const negAt = histNegCache[sym] || 0;
    if (negAt && Date.now() - negAt < HIST_NEG_TTL_MS) {
      const negCached = loadHistCacheRec(sym);
      if (negCached && negCached.rows) return restoreHistRows(sym, negCached);
      return [];
    }
    const cached = loadHistCacheRec(sym); // v71: כולל נדידת v1
    if (cached && cached.rows && cached.rows.length) {
      // v69: מטמון 24 שעות במקום "היום הקלנדרי" — מעבר בין טווחים מיידי גם
      // אחרי שעות, בלי רשת. נתוני סוף־יום לא משתנים תוך 24 שעות ברוב המקרים.
      const ageMs = Date.now() - (Number(cached.at) || 0);
      if (ageMs >= 0 && ageMs < 24 * 60 * 60 * 1000) {
        return restoreHistRows(sym, cached);
      }
      // v71: stale-while-revalidate — מטמון פג־תוקף מוחזר מיד כדי שהגרף
      // יעלה בלי לחכות לרשת, והרענון קורה ברקע. מונע "תקיעה" בטעינה.
      restoreHistRows(sym, cached);
      refreshHistInBackground(sym);
      return state.hist[sym];
    }
  }
  const save = (rows) => {
    // v72: רשת ביטחון לספליטים גם בנתיב fetch טרי — Yahoo מחזיר מחירים
    // כבר־מותאמים בלי מטא, ובלי המטא buildTradesHistory לא ממיר עסקאות
    // טרום־ספליט (באג שיורי: מקסימום ‎-12%‎ במקום ‎+47.95%‎). אידמפוטנטי.
    if (rows) { try { repairKnownSplits(sym, rows); } catch (e) {} } // v74: תמיד, לא רק כשחסר
    state.hist[sym] = rows;
    state.histDbg[sym] = null;
    delete histNegCache[sym]; // v72: הצלחה מבטלת מטמון שלילי
    // v70: שומרים מטא־ספליטים בנפרד — תכונה מותאמת על מערך לא שורדת JSON
    lsSet(LS_HIST + sym, { at: Date.now(), rows: rows, splits: rows.splitsApplied || null });
    // v69: היסטוריה חדשה = TWR חדש — מנקים מטמון
    try { if (typeof ibkrThCacheClear === 'function') ibkrThCacheClear(); } catch (e) {}
    return rows;
  };
  const notes = [];
  const dq = (host) => yahooURL(sym, 'interval=1d&range=5y', host);
  // מרוץ מקבילי: הראשון שעונה מנצח — לא מחכים ל־timeout של מקור חסום (v19 לימד אותנו)
  const racers = [
    fetchYahooBars(dq('query1'), false, notes, 'Yahoo', 8000),
    fetchYahooBars(dq('query2'), false, notes, 'Yahoo2', 8000),
    (async () => {
      try {
        const r = parseHistoryCSV(await fetchTextTimeout(stooqDailyURL(sym), 7000));
        return r.length ? r : null;
      } catch (e) { notes.push('Stooq: ' + netErrName(e)); return null; }
    })(),
  ];
  let rows = await Promise.any(racers.map((p) => p.then((r) => {
    if (!r) throw new Error('empty');
    return r;
  }))).catch(() => null);
  if (rows) {
    // התאמת ספליטים גם למקור לא־Yahoo (זיהוי מגאפ) — קריטי ל־NOW 5:1 בדצמבר 2025
    if (!rows.splitsApplied) { try { applySplitAdjustment(rows); } catch (e) {} }
    return save(rows);
  }
  if (tdKey()) {
    const td = await fetchTwelveBars(sym, 'daily', false, notes);
    if (td === 'BADKEY') clearTdKey(notes);
    else if (td) {
      if (!td.splitsApplied) { try { applySplitAdjustment(td); } catch (e) {} }
      return save(td);
    }
  }
  state.histDbg[sym] = notes.join(' · ');
  histNegCache[sym] = Date.now(); // v72: לא מנסים רשת שוב ב־10 הדקות הקרובות
  const cached = loadHistCacheRec(sym); // v71: כולל נדידת v1
  if (cached && cached.rows) {
    return restoreHistRows(sym, cached);
  }
  return [];
}

/* רענון רקע להיסטוריה (stale-while-revalidate): לא חוסם את הגרף.
   כשהרשת מסיימת, השורות הטריות נשמרות למטמון v2 ומחליפות את הישנות. */
function refreshHistInBackground(sym) {
  try {
    const p = getDailyFast(sym, true);
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (e) {}
}

/* מעטפת עם מניעת כפילויות: שתי קריאות מקביליות לאותו סימבול חולקות בקשה אחת.
   גם מנרמלת לאותיות גדולות כדי לא לפצל מטמון. */
const histInflight = {};
/* v72: מטמון שלילי לסשן — סימבול שכל המקורות נכשלו בו לא ישרוף timeout
   רשת שוב בכל מעבר טווח; מנסים שוב רק אחרי 10 דקות (ורענון הרקע עם
   force=true עוקף את זה תמיד, כך שכשל חולף מתאושש מעצמו). */
const histNegCache = {};
const HIST_NEG_TTL_MS = 10 * 60 * 1000;
async function getDailyFast(sym, force) {
  const key = String(sym || '').toUpperCase();
  if (!key) return [];
  if (!force && histInflight[key]) return histInflight[key];
  const p = _getDailyFastInner(key, force);
  if (!force) {
    histInflight[key] = p;
    const clear = () => { if (histInflight[key] === p) delete histInflight[key]; };
    p.then(clear, clear);
  }
  return p;
}

/* סימבול שאפשר לצייר לו גרף: מניה אמיתית, לא צמד מט"ח (USD.ILS) ולא אופציה.
   סמלים כאלה אף פעם לא יחזרו מאף מקור — בלי הסינון כל טעינה שורפת עליהם timeout. */
function isChartableSym(s) {
  if (!s) return false;
  s = normalizeSym(s);
  if (/\.[A-Z]{3}$/.test(s)) return false;
  return /^[A-Z0-9.-]{1,12}$/.test(s);
}

/* מנרמל סימבול למחירים: "BRK B" -> "BRK-B" (Yahoo), מסיר רווחים. */
function normalizeSym(s) {
  return String(s || '').toUpperCase().replace(/\s+/g, '-').trim();
}

/* מחמם את ההיסטוריות של כל האחזקות (וגם סמלים מעסקאות IBKR היסטוריות)
   לטובת גרף הביצועים — במקביל, כדי שהגרף ייטען תוך שניות ולא דקות.
   onProgress(done, total) — לעדכון מחוון טעינה, כדי שלא ייראה "תקוע". */
async function warmPfHistories(onProgress, fromDate) {
  const syms = [];
  const add = (s) => { s = normalizeSym(s); if (s && isChartableSym(s) && !syms.includes(s)) syms.push(s); };
  for (const p of POSITIONS) add(p.sym);
  if (isIbkrMode()) { try { for (const tr of ibkrTrades()) {
    // YTD: רק סימבולים מ־2026 — מהיר יותר, פחות טעינות
    if (fromDate && String(tr.date || '').slice(0, 10) < fromDate) continue;
    add(tr.symbol);
  } } catch (e) {} }
  let done = 0;
  const tick = () => {
    done++;
    if (onProgress) { try { onProgress(done, syms.length); } catch (e) {} }
  };
  await pool(syms, 8, async (sym) => { try { await getDailyFast(sym, false); } finally { tick(); } });
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

/* הפרדה בין שני סוגי משתמשים:
   - 'ibkr' — הנתונים סונכרנו מ־IBKR: מתעלמים מההפקדות הידניות, וכל החישובים
     מתבססים על עלות הקנייה (avg) שבאה מהדוח. ההפקדות נשמרות לתיעוד בלבד.
   - 'manual' (ברירת מחדל) — החישובים מתבססים על ההפקדות הידניות. */
function isIbkrMode() { return !!(typeof DB !== 'undefined' && DB && DB.source === 'ibkr'); }

/* עלות קנייה כוללת בדולרים — סכום avg×shares על הפוזיציות */
function costBasisUSD() {
  return POSITIONS.reduce((a, p) => a + (num(p.avg) || 0) * (num(p.shares) || 0), 0);
}
function costBasisInCur() {
  const b = costBasisUSD();
  if (state.currency === 'ILS') return state.fx ? b * state.fx : null;
  return b;
}

/* רווח/תשואה: שווי נוכחי מול בסיס (הפקדות או עלות קנייה) — פונקציה טהורה, נבדקת */
function portfolioPerformance(total, basis) {
  if (!(basis > 0) || total === null || total === undefined) return { gl: null, yld: null };
  const gl = total - basis;
  return { gl: gl, yld: gl / basis * 100 };
}

/* במצב IBKR כל הנתונים (מניות והפקדות) מגיעים מהדוח — אין עריכה ידנית.
   פנסיה נשארת בעריכה ידנית כי היא לא חלק מנתוני IBKR. */
function editAllowed(key) {
  // v87: עריכת מניות מותרת גם במצב IBKR (לבקשת המשתמש)
  if (key === 'stocks') return !!state.edit[key];
  return !!state.edit[key] && !isIbkrMode();
}

/* נעילת ממשק במצב IBKR: מסתיר כפתורי עריכה ומכבה מצב עריכה פעיל */
function renderIbkrLocks() {
  const ibkr = isIbkrMode();
  for (const id of ['editStocksBtn', 'editDepositsBtn']) {
    const b = document.getElementById(id);
    if (b) b.classList.toggle('hidden', ibkr);
  }
  const sn = document.getElementById('ibkrStocksNote');
  if (sn) {
    sn.classList.toggle('hidden', !ibkr);
    if (ibkr) sn.textContent = t('ibkrStocksNote');
  }
  if (ibkr) { state.edit.stocks = false; state.edit.deposits = false; }
}

/* בסיס החישוב לפי סוג המשתמש — ב־IBKR הכל מהדוח:
   קודם ההפקדות המסונכרנות; אם אין כאלה, גיבוי לעלות הקנייה (גם היא מ־IBKR).
   ידני — ההפקדות הידניות. */
function portfolioBasisInCur() {
  if (isIbkrMode()) {
    const dep = depositsInCur();
    if (dep && dep > 0) return dep;
    return costBasisInCur();
  }
  return depositsInCur();
}

/* האם תנועת מזומן היא הפקדה/משיכה חיצונית — טהור, נבדק.
   בודק גם type וגם description (דוחות white-label שונים בניסוח).
   העברות פנימיות בין חשבונות אינן הפקדה אמיתית — מסוננות. */
function ibkrIsDepositTx(c) {
  const type = String((c && c.type) || '');
  const desc = String((c && c.description) || '');
  // Transfer IN/OUT בין חשבונות (כולל INTERNAL מחשבון אחר) — תזרים אמיתי.
  // מסננים רק העברות פנימיות בתוך אותו חשבון (לא מהדוח הזה).
  if (/^transfer (in|out)$/i.test(type.trim())) return true;
  if (/internal/i.test(type) && !/transfer/i.test(type)) return false;
  if (/internal/i.test(desc) && !/transfer from/i.test(desc)) return false;
  return /deposit|withdraw/i.test(type) || /deposit|withdraw/i.test(desc);
}

/* רשימת סוגי תנועות המזומן בדוח (ממוינת, בלי כפילויות) — לדיאגנוסטיקה.
   מחזיר רק שמות סוגים, בלי סכומים. טהור, נבדק. */
function ibkrCashTxTypeList(cashTx) {
  const s = new Set();
  for (const c of (cashTx || [])) {
    const tp = String((c && c.type) || '').trim();
    if (tp) s.add(tp);
  }
  return [...s].sort();
}

/* ממפה תנועות מזומן מ־IBKR להפקדות האפליקציה (פונקציה טהורה — נבדקת).
   נלקחות רק העברות חיצוניות (הפקדה/משיכה) — לא דיבידנדים, ריביות או עמלות.
   fxOf: פונקציה (isoDate) => שער USD→ILS.
   מחזיר [{date, amount, place}] — amount בשקלים, שלילי = כסף שנכנס (מוסכמת האפליקציה). */
function ibkrMapDeposits(cashTx, fxOf) {
  const out = [];
  for (const c of (cashTx || [])) {
    if (!ibkrIsDepositTx(c)) continue;
    const type = String(c.type || '');
    const amt = Number(c.amount) || 0;
    if (!amt) continue;
    const cur = String(c.currency || 'USD').toUpperCase();
    let ils;
    if (cur === 'ILS') {
      ils = amt;
    } else {
      const fx = fxOf ? fxOf(String(c.date || '').slice(0, 10)) : null;
      const toUsd = cur === 'USD' ? 1 : (Number(c.fxToBase) || 0);
      if (!(fx > 0) || !(toUsd > 0)) continue;
      ils = amt * toUsd * fx;
    }
    const r2 = (v) => Math.round(v * 100) / 100;
    // ב־IBKR חיובי = נכנס; באפליקציה שלילי = נכנס. שומרים גם את הסכום המקורי לתצוגה.
    const origTxt = (cur !== 'ILS' && amt)
      ? ' · ' + cur + ' ' + Math.abs(amt).toLocaleString('en-US', { maximumFractionDigits: 2 })
      : '';
    out.push({
      date: String(c.date || '').slice(0, 10),
      amount: amt > 0 ? -r2(Math.abs(ils)) : r2(Math.abs(ils)),
      place: String(c.description || type || 'IBKR').slice(0, 40) + origTxt,
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/* ---------------- ביצועי IBKR מהדוח (פונקציות טהורות — נבדקות) ---------------- */
/* מטבע הבסיס של דוח IBKR */
function ibkrBaseCur(data) { return (data && data.meta && data.meta.baseCurrency) || 'USD'; }
/* אובייקט ה־NAV מהסנכרון האחרון */
function ibkrNav() { const d = ibkrCfg().data; return (d && d.nav) || null; }

/* שווי החשבון לפי הדוח המסונכרן, במטבע הבסיס: שווי שוק הפוזיציות + מזומן.
   לא תלוי במחירים חיים — זה המספר של IBKR עצמו. null אם אין נתונים. */
function ibkrReportTotal(data, cash, fx) {
  if (!data) return null;
  const base = ibkrBaseCur(data);
  let t = 0, any = false;
  for (const p of (data.positions || [])) {
    const mv = Number(p.marketValue);
    if (!isFinite(mv)) continue;
    t += mv * (Number(p.fxToBase) || 1);
    any = true;
  }
  if (!any) return null;
  const c = cash || { usd: 0, ils: 0 };
  const usd = Number(c.usd) || 0, ils = Number(c.ils) || 0;
  if (base === 'USD') t += usd + (fx > 0 ? ils / fx : 0);
  else if (base === 'ILS') t += ils + (fx > 0 ? usd * fx : 0);
  else t += usd + ils; // מטבע בסיס אחר — קירוב
  return t;
}

/* סכומי ביצועים מהדוח, במטבע הבסיס.
   twr ב־ChangeInNAV הוא אחוז (12.34 = 12.34%) — מוצג כמו שהוא, בלי חלוקה. */
function ibkrPerfSums(data) {
  const out = { realized: 0, unrealized: 0, dividends: 0, interest: 0, taxes: 0, fees: 0 };
  if (!data) return out;
  for (const tr of (data.trades || [])) {
    const fx = Number(tr.fxToBase) || 1;
    out.realized += (Number(tr.realized) || 0) * fx;
    out.fees += Math.abs(Number(tr.commission) || 0) * fx;
  }
  for (const p of (data.positions || [])) {
    const fx = Number(p.fxToBase) || 1;
    out.unrealized += (Number(p.unrealized) || 0) * fx;
  }
  for (const c of (data.cashTransactions || [])) {
    const type = String(c.type || '').toLowerCase();
    const fx = Number(c.fxToBase) || 1;
    const amt = (Number(c.amount) || 0) * fx;
    if (/dividend/.test(type)) out.dividends += amt;
    else if (/interest/.test(type)) out.interest += amt;
    else if (/tax/.test(type) && !/receiv/.test(type)) out.taxes += amt;
    else if (/fee/.test(type) && !/receiv/.test(type)) out.fees += Math.abs(amt);
  }
  return out;
}

/* תזרימים לחישוב XIRR מהדוח: ערך התחלה (שלילי) + הפקדות/משיכות + ערך סיום (חיובי).
   ב־Flex הפקדה = סכום חיובי, משיכה = שלילי; מנקודת מבט המשקיע זה הפוך.
   כשמקטע Change in NAV חסר, ערך ההתחלה הוא אומדן (endBase − הפקדות − רווח) —
   endBase הוא שווי הסיום במטבע הבסיס (מ־ibkrReportTotal). (פונקציה טהורה — נבדקת) */
function ibkrXirrFlows(data, endBase) {
  if (!data) return null;
  const nav = data.nav, meta = data.meta || {};
  if (!meta.fromDate || !meta.toDate) return null;
  let start = null, end = null;
  if (nav) {
    const s = Number(nav.startingValue), e = Number(nav.endingValue);
    if (s >= 0) start = s;
    if (e >= 0) end = e;
  }
  if (end === null) end = (endBase > 0 && isFinite(endBase)) ? endBase : null;
  if (start === null && end !== null) {
    const est = ibkrEstimate(data, end);
    start = est ? est.start : null;
  }
  if (!(start >= 0) || !(end >= 0)) return null;
  const flows = [];
  if (start > 0) flows.push({ d: String(meta.fromDate).slice(0, 10), amt: -start });
  for (const c of (data.cashTransactions || [])) {
    if (!/deposit|withdraw/i.test(String(c.type || ''))) continue;
    const amt = (Number(c.amount) || 0) * (Number(c.fxToBase) || 1);
    const dt = String(c.date || '').slice(0, 10);
    if (!amt || !/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue;
    flows.push({ d: dt, amt: -amt });
  }
  flows.push({ d: String(meta.toDate).slice(0, 10), amt: end });
  flows.sort((a, b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  const hasNeg = flows.some((f) => f.amt < 0), hasPos = flows.some((f) => f.amt > 0);
  return (hasNeg && hasPos) ? flows : null;
}

/* XIRR — תשואה שנתית משוקללת־כסף. flows: [{d:'YYYY-MM-DD', amt}] שלילי = הושקע.
   מחזיר אחוז (12.34 = 12.34%) או null אם לא ניתן לחשב. */
function xirr(flows) {
  if (!flows || flows.length < 2) return null;
  const t0 = Date.parse(flows[0].d);
  if (!isFinite(t0)) return null;
  const yrs = flows.map((f) => {
    const tt = Date.parse(f.d);
    return isFinite(tt) ? (tt - t0) / 31557600000 : NaN;
  });
  if (yrs.some((y) => !isFinite(y))) return null;
  const npv = (r) => flows.reduce((s, f, i) => s + f.amt / Math.pow(1 + r, yrs[i]), 0);
  const dnpv = (r) => flows.reduce((s, f, i) => s + f.amt * -yrs[i] / Math.pow(1 + r, yrs[i] + 1), 0);
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(r), d = dnpv(r);
    if (!isFinite(f) || !isFinite(d) || Math.abs(d) < 1e-10) return null;
    const nr = r - f / d;
    if (!isFinite(nr) || nr <= -0.9999) return null;
    if (Math.abs(nr - r) < 1e-9) return nr * 100;
    r = nr;
  }
  return null;
}

/* היסטוריית NAV יומית מהדוח — [{date:'YYYY-MM-DD', value}] ממוין, בלי כפילויות.
   מחזיר פחות מ־2 נקודות אם אין היסטוריה אמיתית (ואז הגרף נשאר משוחזר). */
function ibkrNavHistory() {
  const d = ibkrCfg().data;
  const rows = (d && d.navHistory) || [];
  const byDate = {};
  for (const r of rows) {
    const dt = String(r.toDate || r.fromDate || '').slice(0, 10);
    const v = Number(r.endingValue);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt) || !isFinite(v)) continue;
    byDate[dt] = v; // כפילות תאריך: האחרונה מנצחת
  }
  return Object.keys(byDate).sort().map((dt) => ({ date: dt, value: byDate[dt] }));
}

/* TWR מסדרת NAV רשמית של IBKR — מנטרל תזרימים חיצוניים (הפקדות/משיכות).
   navRows: [{date, value}] ממוין עולה (מ־ibkrNavHistory).
   flowsByDate: {date: סכום} — חיובי = הפקדה (נכנס), שלילי = משיכה.
   מחזיר [{date, value}] כאשר value הוא מדד TWR מצטבר המתחיל מ־100.
   בלי נטרול תזרימים, הפקדה של $10K תיראה כ"תשואה" של $10K — זו הייתה
   הסיבה שמקסימום הראה ‎-12%‎ במקום ‎+48%‎ (v73). */
function navToTwr(navRows, flowsByDate) {
  if (!navRows || navRows.length < 2) return [];
  const flows = flowsByDate || {};
  const out = [{ date: navRows[0].date, value: 100 }];
  let cum = 100;
  for (let i = 1; i < navRows.length; i++) {
    const prev = Number(navRows[i - 1].value);
    const curr = Number(navRows[i].value);
    const flow = Number(flows[navRows[i].date]) || 0;
    if (prev > 0 && isFinite(prev) && isFinite(curr)) {
      const growth = (curr - flow) / prev;
      if (growth > 0 && growth < 10 && isFinite(growth)) cum *= growth;
    }
    out.push({ date: navRows[i].date, value: cum });
  }
  return out;
}

/* תאריך הקמת התיק — תאריך התזרים החיצוני (הפקדה) הראשון, או העסקה הראשונה.
   טווחים שמתחילים לפני תאריך זה מציגים תשואה פיקטיבית — חותכים אותם.
   v75: תיקון לטווחי 3Y/מקסימום שהראו ‎-12%‎ במקום ‎+48%‎. */
function ibkrInceptionDate() {
  const d = ibkrCfg().data;
  if (!d) return null;
  let first = null;
  const consider = (dt) => {
    dt = String(dt || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) return;
    if (!first || dt < first) first = dt;
  };
  for (const c of (d.cashTransactions || [])) {
    if (!c || !ibkrIsDepositTx(c)) continue;
    consider(c.date);
  }
  for (const t of (d.trades || [])) {
    if (!t || !ibkrIsStockTrade(t)) continue;
    consider(t.date);
  }
  return first;
}

/* מפת תזרימים יומית מנתוני IBKR — {date: סכום ב־USD}, חיובי = נכנס.
   משמש לנטרול תזרימים ב־TWR מסדרת NAV רשמית. */
function ibkrFlowsByDate() {
  const d = ibkrCfg().data;
  const flows = {};
  for (const c of ((d && d.cashTransactions) || [])) {
    if (!c || !ibkrIsDepositTx(c)) continue;
    const dt = String(c.date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dt)) continue;
    const amt = Number(c.amount) || 0;
    if (!amt) continue;
    const fxb = Number(c.fxToBase) || 1;
    const cur = String(c.currency || 'USD').toUpperCase();
    const usd = cur === 'USD' ? amt : amt * fxb;
    flows[dt] = (flows[dt] || 0) + usd;
  }
  return flows;
}

/* הפקדות נטו בתקופת הדוח, במטבע הבסיס (חיובי = כסף שנכנס).
   סימן IBKR מקורי: הפקדה חיובית, משיכה שלילית. */
function ibkrNetDeposits(data) {
  let s = 0;
  for (const c of ((data && data.cashTransactions) || [])) {
    if (!/deposit|withdraw/i.test(String(c.type || ''))) continue;
    s += (Number(c.amount) || 0) * (Number(c.fxToBase) || 1);
  }
  return s;
}

/* רווח/הפסד כלכלי בתקופת הדוח — לוגיקת Change in NAV של IBKR:
   שווי סיום − שווי התחלה − הפקדות נטו. null אם חסר NAV (ואז אסור
   להציג מספר — ההפקדות בדוח חלקיות ויתנו תוצאה מטעה). */
function ibkrPeriodGain(data) {
  const nav = data && data.nav;
  if (!nav) return null;
  const s = Number(nav.startingValue), e = Number(nav.endingValue);
  if (!isFinite(s) || !isFinite(e)) return null;
  const dep = ibkrNetDeposits(data);
  return e - s - (isFinite(dep) ? dep : 0);
}

/* אומדן ביצועים מנתוני הדוח כשמקטע Change in NAV חסר (פונקציה טהורה — נבדקת).
   רווח = ממומש + לא־ממומש + דיבידנדים + ריבית + מסים (שלילי כששולם) − עמלות.
   שווי התחלה משוער = שווי סיום − הפקדות נטו − רווח; תשואה = רווח / שווי התחלה.
   זהו אומדן פשוט (לא TWR רשמי) — מוצג תמיד עם סימון "משוער". null כשאין בסיס לחישוב. */
function ibkrEstimate(data, endBase) {
  if (!data || !(endBase > 0) || !isFinite(endBase)) return null;
  const hasActivity = ((data.trades || []).length > 0) ||
    ((data.positions || []).length > 0) || ((data.cashTransactions || []).length > 0);
  if (!hasActivity) return null;
  const sums = ibkrPerfSums(data);
  const gain = sums.realized + sums.unrealized + sums.dividends + sums.interest +
    sums.taxes - Math.abs(sums.fees);
  if (!isFinite(gain)) return null;
  const dep = ibkrNetDeposits(data);
  const start = endBase - (isFinite(dep) ? dep : 0) - gain;
  if (!(start > 0) || !isFinite(start)) return null;
  return { gain: gain, ret: gain / start * 100, end: endBase, start: start };
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
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    if (on && t.scrollIntoView) {
      try { t.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (e) {}
    }
  });
  document.querySelectorAll('.tabpage').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  // v85: שמירת הטאב האחרון — חזרה לאותו עמוד אחרי רענון
  try { localStorage.setItem('pwa_lasttab_v1', name); } catch (e) {}
  requestAnimationFrame(() => { try { fitNumbers(); } catch (e) {} });
  // v85: שחזור מיקום גלילה שמור לטאב הזה (אחרי שהתוכן נטען)
  const savedY = getSavedScrollY(name);
  if (savedY > 0) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try { window.scrollTo(0, savedY); } catch (e) {}
    }));
  }
}

/* v85: שמירת/שחזור מיקום גלילה לכל טאב — חזרה לאותה נקודה אחרי רענון */
function getSavedScrollY(tab) {
  try {
    const all = JSON.parse(localStorage.getItem('pwa_lastscroll_v1') || '{}');
    return Number(all[tab]) || 0;
  } catch (e) { return 0; }
}
function saveScrollY(tab, y) {
  try {
    const all = JSON.parse(localStorage.getItem('pwa_lastscroll_v1') || '{}');
    all[tab] = Math.round(y);
    localStorage.setItem('pwa_lastscroll_v1', JSON.stringify(all));
  } catch (e) {}
}
function currentTabName() {
  const el = document.querySelector('.tab.active');
  return (el && el.dataset.tab) || 'overview';
}
// שמירת גלילה (debounced) — כל 300ms אחרי עצירת הגלילה
let _scrollSaveT = null;
function initScrollSaver() {
  window.addEventListener('scroll', () => {
    clearTimeout(_scrollSaveT);
    _scrollSaveT = setTimeout(() => {
      try { saveScrollY(currentTabName(), window.scrollY); } catch (e) {}
    }, 300);
  }, { passive: true });
  // שמירה גם לפני עזיבת הדף — למקרה שהדפדפן נסגר מהר
  window.addEventListener('beforeunload', () => {
    try { saveScrollY(currentTabName(), window.scrollY); } catch (e) {}
  });
}

/* ---------------- רינדור: סקירה ---------------- */

/* התאמת גודל מספרים גדולים לרוחב הכרטיס — נשארים גדולים ככל האפשר,
   אבל מתכווצים אוטומטית לפי אורך המספר כדי שאף ספרה לא תיחתך. */
function fitNumbers() {
  document.querySelectorAll('.stat-value, .lg-pct, .pension-total').forEach((elm) => {
    elm.style.fontSize = '';
    const w = elm.clientWidth;
    if (!w) return; // לשונית מוסתרת — יימדד כשנפתח
    let size = parseFloat(getComputedStyle(elm).fontSize) || 25;
    const min = 13;
    let guard = 40;
    while (guard-- > 0 && size > min && elm.scrollWidth > w + 1) {
      size -= 1;
      elm.style.fontSize = size + 'px';
    }
  });
}

function renderOverview() {
  const cur = state.currency;
  const tot = totalsUSD();
  const total = cur === 'ILS' && state.fx ? tot.total * state.fx : tot.total;
  const stockVal = cur === 'ILS' && state.fx ? tot.stockVal * state.fx : tot.stockVal;
  // כרטיס "שווי תיק המניות" — היה מת אף פעם לא מולא (v43)
  const vEl = document.getElementById('ovValue');
  const vSub = document.getElementById('ovValueSub');
  if (vEl) {
    let vTxt = '—';
    if (isIbkrMode()) {
      // במצב IBKR: השווי לפי הדוח עצמו (מספר של IBKR), לא תלוי במחירים חיים
      const data = ibkrCfg().data;
      const rt = ibkrReportTotal(data, DB.cash, state.fx);
      const base = ibkrBaseCur(data);
      let disp = null;
      if (rt !== null && isFinite(rt)) {
        if (base === 'USD' && cur === 'ILS' && state.fx) disp = rt * state.fx;
        else if (base === 'ILS' && cur === 'USD' && state.fx) disp = rt / state.fx;
        else if ((base === 'ILS') === (cur === 'ILS')) disp = rt;
      }
      if (disp !== null && isFinite(disp)) vTxt = money(disp, cur);
    } else if (!POSITIONS.length || POSITIONS.some((p) => state.quotes[p.sym])) {
      vTxt = money(total, cur);
    }
    vEl.textContent = vTxt;
    if (vSub) {
      if (isIbkrMode()) vSub.textContent = t('ovValueReport');
      else vSub.textContent = t('ovStocksSub');
    }
  }
  // בסיס החישוב לפי סוג המשתמש (הפקדות מסונכרנות / עלות קנייה / הפקדות ידניות)
  const perf = portfolioPerformance(total, portfolioBasisInCur());
  const gEl = document.getElementById('ovGL');
  const gSub = document.getElementById('ovGLSub');
  let gl = perf.gl, yld = perf.yld;
  if (isIbkrMode()) {
    // במצב IBKR: רווח/הפסד = שווי סיום − שווי התחלה − הפקדות נטו (תקופת הדוח).
    // כשמקטע Change in NAV חסר בדוח — אומדן מנתוני הדוח (מסומן "משוער"), לא מקפים.
    const data = ibkrCfg().data;
    let pg = ibkrPeriodGain(data);
    let est = null;
    if (pg === null || !isFinite(pg)) {
      est = ibkrEstimate(data, ibkrReportTotal(data, DB.cash, state.fx));
      pg = est ? est.gain : null;
    }
    if (pg === null || !isFinite(pg)) {
      gl = null;
    } else {
      const base = ibkrBaseCur(data);
      gl = (cur === 'ILS' && state.fx && base === 'USD') ? pg * state.fx
        : (cur === 'ILS' ? null : pg);
    }
    if (gSub) gSub.textContent = t('ovInReportPeriod') + (est ? ' ' + t('estMark') : '');
  }
  if (gl === null) { gEl.textContent = '—'; }
  else { gEl.textContent = (gl < 0 ? '−' : '+') + money(Math.abs(gl), cur); }
  gEl.className = 'stat-value ' + (gl === null ? '' : gl >= 0 ? 'pos' : 'neg');

  const yEl = document.getElementById('ovYield');
  let ibkrYieldOfficial = true;
  if (isIbkrMode()) {
    // במצב IBKR התשואה הראשית היא ה־TWR הרשמי מהדוח.
    // כשהוא חסר (אין Change in NAV) — אומדן מנתוני הדוח, מסומן "משוער".
    const data = ibkrCfg().data;
    const nav = ibkrNav();
    const twr = (nav && nav.twr !== null && nav.twr !== undefined && nav.twr !== '')
      ? Number(nav.twr) : null;
    let yval = (twr === null || !isFinite(twr)) ? null : twr;
    let estMark = '';
    if (yval === null) {
      const est = ibkrEstimate(data, ibkrReportTotal(data, DB.cash, state.fx));
      if (est && isFinite(est.ret)) { yval = est.ret; estMark = ' ' + t('estMark'); ibkrYieldOfficial = false; }
    }
    yEl.textContent = (yval === null || !isFinite(yval)) ? '—' : fmtPct(yval, true) + estMark;
    yEl.className = 'stat-value ' + ((yval === null || !isFinite(yval)) ? '' : yval >= 0 ? 'pos' : 'neg');
  } else {
    yEl.textContent = fmtPct(yld, true);
    yEl.className = 'stat-value ' + (yld === null ? '' : yld >= 0 ? 'pos' : 'neg');
  }

  document.getElementById('ovMeta').textContent =
    t('ovUpdated', { time: state.quotesAt ? fmtTimeIL(state.quotesAt) : '—' }) +
    (state.fx ? ' · $=₪' + state.fx.toFixed(4) : '') +
    (isIbkrMode() ? ' · ' + (ibkrYieldOfficial ? t('twrOfficial') : t('yieldEstNote')) : '');

  drawPie();
  drawPfChart();
  renderEarningsCard();
  renderIbkrPerf();
  try { fitNumbers(); } catch (e) {}
}

/* כרטיס "דוחות קרובים" — תיק + מעקב, ממוין לפי תאריך */
function renderEarningsCard() {
  const card = document.getElementById('earnCard');
  const list = document.getElementById('earnList');
  if (!card || !list) return;
  const names = {};
  for (const p of POSITIONS) names[p.sym] = p.name || p.sym;
  for (const w of WISHLIST) if (!names[w.sym]) names[w.sym] = w.sym;
  const rows = [];
  for (const sym of Object.keys(state.earnings || {})) {
    const e = state.earnings[sym];
    if (!e || !e.date || daysUntil(e.date) < 0) continue;
    rows.push({ sym: sym, date: e.date, time: e.time || '' });
  }
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  if (!rows.length) { card.classList.add('hidden'); return; }
  card.classList.remove('hidden');
  list.innerHTML = '';
  for (const r of rows.slice(0, 12)) {
    const d = daysUntil(r.date);
    const when = d === 0 ? t('earnToday') : d === 1 ? t('earnTomorrow') : t('earnInDays', { n: d });
    const tm = r.time === 'bmo' ? ' · ' + t('earnBmo') : r.time === 'amc' ? ' · ' + t('earnAmc') : '';
    const li = el('li', 'earn-row');
    li.innerHTML = '<span class="earn-sym" dir="ltr">' + esc(r.sym) + '</span>' +
      '<span class="earn-name">' + esc(names[r.sym] || r.sym) + '</span>' +
      '<span class="earn-when">' + esc(when) + esc(tm) + '</span>' +
      '<span class="earn-date">' + esc(fmtDateIL(r.date)) + '</span>';
    list.appendChild(li);
  }
}

/* כרטיס "ביצועי IBKR" — TWR רשמי, XIRR, ממומש/לא־ממומש, דיבידנדים, ריבית, מסים, עמלות.
   מוצג רק במצב IBKR ורק אם יש נתוני סנכרון. */
function renderIbkrPerf() {
  const card = document.getElementById('ibkrPerfCard');
  const list = document.getElementById('ibkrPerfList');
  const period = document.getElementById('ibkrPerfPeriod');
  if (!card || !list) return;
  const show = isIbkrMode() && !!(ibkrCfg().data);
  card.classList.toggle('hidden', !show);
  if (!show) return;
  const data = ibkrCfg().data;
  const meta = data.meta || {};
  const navMissing = !data.nav;
  const nav = data.nav || {};
  const base = ibkrBaseCur(data);
  if (period) period.textContent = t('perfPeriod', { a: fmtDateIL(meta.fromDate), b: fmtDateIL(meta.toDate) });
  const sums = ibkrPerfSums(data);
  const twr = (nav.twr === null || nav.twr === undefined || nav.twr === '') ? null : Number(nav.twr);
  const endBase = ibkrReportTotal(data, DB.cash, state.fx);
  // בלי TWR רשמי — אומדן מנתוני הדוח (מסומן), במקום מקפים
  const est = (twr === null || !isFinite(twr)) ? ibkrEstimate(data, endBase) : null;
  const xr = xirr(ibkrXirrFlows(data, endBase));
  const xrEst = xr !== null && navMissing;
  const mrow = (lbl, val) => {
    const li = el('li', 'perf-row');
    li.innerHTML = '<span class="perf-lbl">' + esc(lbl) + '</span>' +
      '<span class="perf-val ' + (typeof val === 'object' ? val.cls : '') + '">' +
      esc(typeof val === 'object' ? val.txt : val) + '</span>';
    list.appendChild(li);
  };
  const mval = (v, isMoney) => {
    if (v === null || v === undefined || !isFinite(v)) return { txt: '—', cls: '' };
    return { txt: isMoney ? money(v, base) : fmtPct(v, true), cls: v > 0 ? 'pos' : v < 0 ? 'neg' : '' };
  };
  list.innerHTML = '';
  const estVal = (v, isMoney) => {
    if (v === null || v === undefined || !isFinite(v)) return { txt: '—', cls: '' };
    return {
      txt: (isMoney ? money(v, base) : fmtPct(v, true)) + ' ' + t('estMark'),
      cls: v > 0 ? 'pos' : v < 0 ? 'neg' : '',
    };
  };
  mrow(t('perfTwr'), twr === null || !isFinite(twr)
    ? (est ? estVal(est.ret, false) : { txt: t('twrMissing'), cls: 'perf-note' })
    : mval(twr, false));
  mrow(t('perfXirr'), xr === null
    ? { txt: t('cantCalc'), cls: 'perf-note' }
    : (xrEst ? estVal(xr, false) : mval(xr, false)));
  if (est) mrow(t('perfGainEst'), estVal(est.gain, true));
  mrow(t('perfRealized'), mval(sums.realized, true));
  mrow(t('perfUnrealized'), mval(sums.unrealized, true));
  mrow(t('perfDividends'), mval(sums.dividends, true));
  mrow(t('perfInterest'), mval(sums.interest, true));
  mrow(t('perfTaxes'), mval(sums.taxes, true));
  mrow(t('perfFees'), mval(Math.abs(sums.fees) < 0.005 ? 0 : -Math.abs(sums.fees), true));
  try { fitNumbers(); } catch (e) {}
}

function drawPie() {
  const canvas = document.getElementById('pieChart');
  const tot = totalsUSD();
  const slices = POSITIONS.map((p, i) => {
    const q = state.quotes[p.sym];
    const v = q ? q.close * p.shares : 0;
    return { sym: p.sym, name: p.name, value: v, color: pieColor(i) };
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

const PF_RANGES = [['1m', 'range1m'], ['3m', 'range3m'], ['6m', 'range6m'], ['ytd', 'rangeYtd'], ['year', 'rangeYear'], ['3y', 'range3y'], ['5y', 'range5y'], ['max', 'rangeMax']];

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

/* שורת בנצ'מרק מיושרת לתאריכי התיק — מחזירה את מחירי הסגירה הגולמיים
   בדולרים, בלי שום המרת מט"ח (מדידה כמו IBKR). מחזירה null אם לאחד
   התאריכים אין מחיר זמין. */
function benchRowsForDates(hist, dates) {
  const rows = [];
  for (const d of dates) {
    const c = closeOnOrBefore(hist, d);
    if (!(c > 0)) return null;
    rows.push({ date: d, value: c });
  }
  return rows.length >= 2 ? rows : null;
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

async function ensureFxHist(earliestOverride) {
  if (fxHistCache) return fxHistCache;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS_FXHIST) || 'null'); } catch (e) {}
  const today = todayISO();
  let earliest = earliestOverride || null;
  if (!earliest) {
    for (const d of DEPOSITS) {
      const iso = parseDepDate(d.date);
      if (iso && (!earliest || iso < earliest)) earliest = iso;
    }
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

/* היסטוריה אמיתית של שווי התיק — שחזור לאחור מעסקאות IBKR.
   הולכים מהיום אחורה: מבטלים קניות/מכירות והפקדות/משיכות, ובכל יום מחשבים
   שווי ניירות + מזומן. התשואה היא TWR יומי — הפקדות ומשיכות חיצוניות
   מנוטרלות, כך שהן לא נראות כרווח/הפסד. דיבידנדים, ריבית ועמלות נשארים
   בתוך התשואה (כמו אצל IBKR).
   o: { trades:[{date,symbol,side,qty,price,commission,currency,fxToBase}],
        cashTx:[{date,amount,currency,fxToBase,type,description}],
        positions:[{sym,shares}], cash:{usd,ils},
        hist:{sym:[{date,close}]}, fxOf:(iso)=>rate }
   מחזיר [{date, value}] עולה, value = מדד TWR (100 = תחילת הנתונים). */
/* עסקת מניה אמיתית? מסנן המרות מט"ח (USD.ILS), אופציות וחוזים — סמלים
   שאין להם היסטוריית מחירים. בלי הסינון, ביטול המרת מט"ח בהליכה אחורה
   מנפח את המזומן ההיסטורי בסכום ההמרה המלא ומעוות את התשואה לשלילית. */
function ibkrIsStockTrade(x) {
  const raw = String((x && x.symbol) || '');
  const s = normalizeSym(raw);
  if (!s) return false;
  if (/^[A-Z]{3}\.[A-Z]{3}$/.test(s)) return false;
  // אופציה: סימבול עם רווח + תבנית תאריך/סטרייק (למשל "AAPL  260919C00150000")
  // אבל "BRK B" הוא מניה תקינה (מנורמל ל־BRK-B)
  if (/ /.test(raw.trim()) && !/^BRK B$/i.test(raw.trim())) {
    // אם יש ספרות אחרי הרווח — אופציה
    if (/\d/.test(raw)) return false;
  }
  return true;
}

/* תנועת מזומן פנימית (דיבידנד / מס דיבידנד): כסף שנכנס מהשוק, לא הפקדה חיצונית.
   בהליכה אחורה מבטלים אותה מהמזומן (לפני התשלום הוא לא היה), אבל לא מנטרלים
   ב־TWR — דיבידנד הוא תשואה, לא תזרים חיצוני. */
function ibkrIsDividendTx(c) {
  const s = String((c && c.type) || '') + ' ' + String((c && c.description) || '');
  return /dividend|withholding/i.test(s);
}

function buildTradesHistory(o, fromDate) {
  // fromDate (אופציונלי): מסנן אירועים לפני התאריך — לחישוב YTD נקי מ־1/1
  // בלי זיהום מנתוני 2024-2025. אם לא סופק, משתמש בכל ההיסטוריה.
  // מפת ספליטים מההיסטוריה: sym -> [{date, ratio}] (מ־applySplitAdjustment)
  const splitsBySym = {};
  for (const sym of Object.keys(o.hist || {})) {
    const h = o.hist[sym] || [];
    const sa = h.splitsApplied;
    if (!sa) continue;
    splitsBySym[sym.toUpperCase()] = String(sa).split(',').map((s) => {
      const parts = s.split('×');
      return { date: parts[0], ratio: Number(parts[1]) || 1 };
    }).filter((s) => s.ratio > 1.08 || s.ratio < 0.92);
  }
  const trades = (o.trades || [])
    .filter((x) => x && x.symbol && x.date && ibkrIsStockTrade(x))
    .map((x) => {
      const sym = normalizeSym(x.symbol);
      const date = String(x.date).slice(0, 10);
      let qty = Math.abs(Number(x.qty) || 0);
      let price = Number(x.price) || 0;
      // עסקה לפני ספליט: המרה ליחידות של היום (כמות × יחס, מחיר ÷ יחס).
      // v81: בדיקת חוסן — אם מחיר העסקה כבר תואם להיסטוריה המותאמת (IBKR
      // לפעמים מדווח כבר מותאם), לא מכפילים שוב (מניעת התאמה כפולה).
      for (const s of (splitsBySym[sym] || [])) {
        if (date < s.date) {
          const hc = closeOnOrBefore(o.hist[sym] || o.hist[sym.toUpperCase()] || [], date);
          const alreadyAdj = hc && price > 0 && Math.abs(price - hc) / hc < 0.3;
          if (!alreadyAdj) { qty *= s.ratio; price /= s.ratio; }
        }
      }
      return {
        date: date,
        sym: sym,
        buy: String(x.side || '').toUpperCase() === 'BUY',
        qty: qty,
        price: price,
        comm: Math.abs(Number(x.commission) || 0),
        fxb: Number(x.fxToBase) || 1,
      };
    })
    .filter((x) => x.qty > 0 && x.date >= '2000-01-01')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  // סינון YTD: רק אירועים מ־fromDate והלאה (למשל 2026-01-01)
  const tradesF = fromDate ? trades.filter((x) => x.date >= fromDate) : trades;
  if (!tradesF.length) return [];

  // תזרימי מזומן חיצוניים (הפקדות/משיכות בלבד) — בחתימת IBKR: חיובי = נכנס
  const flows = {}; // date -> סכום ב־USD
  for (const c of (o.cashTx || [])) {
    if (!c || !ibkrIsDepositTx(c)) continue;
    const d = String(c.date || '').slice(0, 10);
    if (fromDate && d < fromDate) continue;
    const amt = Number(c.amount) || 0;
    if (!d || !amt) continue;
    const fxb = Number(c.fxToBase) || 1;
    const cur = String(c.currency || 'USD').toUpperCase();
    const usd = cur === 'USD' ? amt : amt * fxb;
    flows[d] = (flows[d] || 0) + usd;
  }

  // תזרימי מזומן פנימיים (דיבידנדים/מס) — מבוטלים בהליכה אחורה, לא ב־TWR
  const cashAdj = {}; // date -> סכום ב־USD (חיובי = נכנס)
  for (const c of (o.cashTx || [])) {
    if (!c || !ibkrIsDividendTx(c)) continue;
    const d = String(c.date || '').slice(0, 10);
    if (fromDate && d < fromDate) continue;
    const amt = Number(c.amount) || 0;
    if (!d || !amt) continue;
    const fxb = Number(c.fxToBase) || 1;
    const cur = String(c.currency || 'USD').toUpperCase();
    cashAdj[d] = (cashAdj[d] || 0) + (cur === 'USD' ? amt : amt * fxb);
  }

  // הליכה אחורה: מבטלים אירועים ושומרים מצב יומי.
  // המדידה בדולרים בלבד — כמו ש־IBKR מודד. כל המזומן (USD + שקל) מומר ל־USD
  // פעם אחת בשער העדכני; המרות מט"ח הן ניטרליות בערך דולרי (למעט ספרד זניח)
  // ולכן אינן מבוטלות בהליכה אחורה ואינן מוסיפות "מזומן פנטום" לעבר.
  const shares = {};
  for (const p of (o.positions || [])) shares[normalizeSym(p.sym)] = Number(p.shares) || 0;
  const fxOfNow = o.fxOf || (() => 1);
  const fxNow = fxOfNow(todayISO()) || 1;
  let cashUsd = (Number((o.cash || {}).usd) || 0) + (Number((o.cash || {}).ils) || 0) / fxNow;
  const byDate = new Map(); // date -> [{kind:'trade',x} | {kind:'flow',amt} | {kind:'div',amt}]
  const addEv = (d, ev) => {
    if (!byDate.has(d)) byDate.set(d, []);
    byDate.get(d).push(ev);
  };
  for (const x of tradesF) addEv(x.date, { kind: 'trade', x });
  for (const d of Object.keys(flows)) addEv(d, { kind: 'flow', amt: flows[d] });
  for (const d of Object.keys(cashAdj)) addEv(d, { kind: 'div', amt: cashAdj[d] });
  // הערה: לא מסננים ל־YTD כאן — הסינון לטווח נעשה בתצוגה (drawPfChart).
  // הסרת פילטר v64 ששבר את טווחי 1Y/3Y (הציגו אותו מספר כמו YTD).
  const allEvDates = [...byDate.keys()].sort();
  const firstEvDate = [...byDate.keys()].sort()[0];
  // v79: אם fromDate סופק (YTD/הקמה) — מתחילים ממנו, לא מ־1/1.
  // (באג: firstEv='2024-01-01' כלל חודשים פיקטיביים לפני ההקמה ב־2024-09-24.)
  const firstEv = fromDate ? fromDate.slice(0, 10) :
    (firstEvDate ? firstEvDate.slice(0, 4) + '-01-01' : todayISO());
  const stateByDate = {}; // date -> {shares:{}, cashUsd}
  const evDates = [...byDate.keys()].sort().reverse(); // חדש -> ישן
  let ei = 0;
  const snap = () => ({ shares: Object.assign({}, shares), cashUsd });
  // כל התאריכים הרלוונטיים: ימי מסחר מההיסטוריה + תאריכי עסקאות, מהאירוע הראשון והלאה
  const dateSet = new Set();
  for (const sym of Object.keys(o.hist || {})) for (const r of (o.hist[sym] || [])) {
    if (r.date >= firstEv) dateSet.add(r.date);
  }
  for (const d of byDate.keys()) dateSet.add(d);
  const allDates = [...dateSet].sort().reverse(); // חדש -> ישן
  for (const d of allDates) {
    while (ei < evDates.length && evDates[ei] > d) {
      for (const e of byDate.get(evDates[ei])) {
        if (e.kind === 'flow') { cashUsd -= e.amt; continue; } // הפקדה: קודם היה פחות מזומן
        if (e.kind === 'div') { cashUsd -= e.amt; continue; } // דיבידנד: קודם עוד לא התקבל
        const x = e.x;
        const usd = x.qty * x.price * x.fxb + x.comm * x.fxb;
        if (x.buy) { shares[x.sym] = (shares[x.sym] || 0) - x.qty; cashUsd += usd; }
        else { shares[x.sym] = (shares[x.sym] || 0) + x.qty; cashUsd -= (x.qty * x.price * x.fxb - x.comm * x.fxb); }
      }
      ei++;
    }
    // אירועי היום עצמו שייכים לסוף היום — מבטלים רק מה שעבר אותו
    stateByDate[d] = snap();
  }
  // v82: מבטלים גם את אירועי התאריך המוקדם ביותר (שלא בוטלו בלולאה) —
  // כדי לקבל את מצב הפתיחה האמיתי (לפני כל האירועים).
  let inceptionCashUsd = cashUsd;
  try {
    while (ei < evDates.length) {
      for (const e of byDate.get(evDates[ei])) {
        if (e.kind === 'flow') { cashUsd -= e.amt; continue; }
        if (e.kind === 'div') { cashUsd -= e.amt; continue; }
        const x = e.x;
        const usd = x.qty * x.price * x.fxb + x.comm * x.fxb;
        if (x.buy) { shares[x.sym] = (shares[x.sym] || 0) - x.qty; cashUsd += usd; }
        else { shares[x.sym] = (shares[x.sym] || 0) + x.qty; cashUsd -= (x.qty * x.price * x.fxb - x.comm * x.fxb); }
      }
      ei++;
    }
    inceptionCashUsd = cashUsd;
  } catch (e) {}


  // v81: כיול מזומן מ־NAV רשמי (ChangeInNAV). אם המזומן ההתחלתי (DB.cash)
  // שגוי, כל הסדרה המשוחזרת סוטה בקבוע — והסטייה מתעצמת בהליכה אחורה.
  // עיגון ל־NAV רשמי מתקן את הסטייה.
  try {
    const anchor = o.cashAnchor;
    if (anchor && anchor.date && isFinite(anchor.nav)) {
      const ad = String(anchor.date).slice(0, 10);
      const st = stateByDate[ad];
      if (st) {
        let secUsd = 0;
        for (const sym of Object.keys(st.shares)) {
          const q = st.shares[sym];
          if (!q) continue;
          const c = closeOnOrBefore((o.hist || {})[sym] || [], ad);
          if (c) secUsd += q * c;
        }
        const impliedCash = anchor.nav - secUsd;
        const delta = impliedCash - st.cashUsd;
        if (isFinite(delta) && Math.abs(delta) > 0.01) {
          for (const d of Object.keys(stateByDate)) stateByDate[d].cashUsd += delta;
        }
      }
    }
  } catch (e) {}

  const asc = [...dateSet].sort();
  const vals = []; // {date, v, f} — הכל ב־USD
  const noHistSyms = []; // סמלים עם עסקאות אבל בלי היסטוריית מחירים
  for (const d of asc) {
    const st = stateByDate[d];
    if (!st) continue;
    let secUsd = 0;
    for (const sym of Object.keys(st.shares)) {
      const q = st.shares[sym];
      if (!q) continue; // אפס — אין פוזיציה; שלילי = שורט (ערך שלילי, תקין)
      const h = (o.hist || {})[sym] || [];
      if (!h.length && !noHistSyms.includes(sym)) noHistSyms.push(sym);
      const c = closeOnOrBefore(h, d);
      if (c) secUsd += q * c; // q שלילי = התחייבות שורט
    }
    const v = secUsd + st.cashUsd;
    const f = flows[d] || 0;
    vals.push({ date: d, v, f });
  }
  // TWR יומי מצטבר
  const out = [];
  let cum = 100, prev = null, based = false;
  for (const r of vals) {
    // v81: תאריך הבסיס (ראשון עם NAV חיובי) נדחף עם 100 — קודם הוא הושמט,
    // והתשואה חושבה מהיום השני (סטייה של יום אחד).
    if (!(r.v > 0)) { prev = r.v; continue; }
    if (!based) {
      out.push({ date: r.date, value: 100 });
      prev = r.v; based = true; continue;
    }
    if (prev === null || !(prev > 0)) { prev = r.v; continue; }
    const den = prev;
    const num = r.v - r.f;
    if (den > 0 && isFinite(num) && isFinite(den)) {
      const k = num / den;
      if (k > 0 && k < 10) cum *= k;
    }
    out.push({ date: r.date, value: cum });
    prev = r.v;
  }
  out.noHist = noHistSyms;
  // v82: חושף את המזומן בתאריך ההתחלה — לזיהוי הפקדת פתיחה חסרה (2024).
  // (מזומן הפתיחה האמיתי, אחרי ביטול כל האירועים — לא סוף היום הראשון.)
  try { out.inceptionCash = inceptionCashUsd || 0; } catch (e) {}
  return out;
}

/* עטיפה למצב IBKR: ההיסטוריה האמיתית מעסקאות, או [] אם אין עסקאות.
   fromDate (אופציונלי): לחישוב YTD נקי — רק אירועים מ־1/1.
   v69: מטמון תוצאות — מעבר בין טווחי זמן לא מחשב מחדש, רק מסנן. */
let _ibkrThCache = {};
function _ibkrThSig(d) {
  // חתימה מהירה לשינוי נתונים: עסקאות, תזרים, פוזיציות, מזומן, היסטוריות, NAV רשמי
  let histSig = '';
  try {
    histSig = Object.keys(state.hist || {}).sort()
      .map((s) => s + ':' + (state.hist[s] || []).length).join('|');
  } catch (e) {}
  let navSig = '';
  try {
    navSig = JSON.stringify((d.navHistory || []).map((r) => r.fromDate + ':' + r.startingValue));
  } catch (e) {}
  return [
    (d.trades || []).length,
    ((d.trades || [])[0] || {}).date || '',
    ((d.trades || []).slice(-1)[0] || {}).date || '',
    (d.cashTransactions || []).length,
    JSON.stringify((d.positions || []).map((p) => p.symbol + ':' + p.qty).sort()),
    JSON.stringify((DB && DB.cash) || {}),
    histSig,
    navSig,
  ].join('~');
}
function ibkrThCacheClear() { _ibkrThCache = {}; }
function ibkrTradesHistory(fromDate) {
  if (!isIbkrMode()) return [];
  const d = ibkrCfg().data;
  const trades = (d && d.trades) || [];
  if (!trades.length) return [];
  // בדיקת מטמון
  const ck = String(fromDate || 'full');
  const sig = _ibkrThSig(d);
  const hit = _ibkrThCache[ck];
  if (hit && hit.sig === sig) return hit.rows;
  // פוזיציות לשחזור — כולל שורט (כמות שלילית), שאינן ב־POSITIONS של התצוגה.
  // מסנן LOT (פירוט כפול) — רק SUMMARY (תיקון באג כפילות v68).
  const posMap = {};
  const posHasLOD = ((d && d.positions) || []).some((p) => p && p.levelOfDetail);
  for (const p of ((d && d.positions) || [])) {
    if (p.levelOfDetail && p.levelOfDetail !== 'SUMMARY') continue;
    const qty = Number(p.qty) || 0;
    const sym = String(p.symbol || '').toUpperCase();
    const isStock = !p.asset || p.asset === 'STK';
    if (!qty || !sym || !isStock || p.currency !== 'USD') continue;
    // v82: הגנה מפני שורות כפולות (SUMMARY+LOT בלי levelOfDetail) — לוקחים את
    // הכמות הגדולה ביותר (בערך מוחלט) במקום לסכום, כדי לא להכפיל פוזיציות.
    // אם יש levelOfDetail, הסינון למעלה כבר מטפל — הסכימה בטוחה.
    if (posHasLOD) {
      posMap[sym] = (posMap[sym] || 0) + qty;
    } else {
      if (!posMap[sym] || Math.abs(qty) > Math.abs(posMap[sym])) posMap[sym] = qty;
    }
  }
  const positions = Object.keys(posMap).map((sym) => ({ sym, shares: posMap[sym] }));
  // v80: מזומן מנתוני IBKR (cashBalances), לא מ־DB.cash הידני — עקבי עם הפוזיציות.
  // (באג: DB.cash עלול להיות אפס/ישן אם הדוח לא כלל יתרות מזומן, ואז השחזור מתחיל ממזומן שגוי.)
  let ibkrCash = null;
  try {
    const cbs = (d && d.cashBalances) || [];
    let usd = 0, ils = 0, has = false;
    for (const c of cbs) {
      const b = Number(c.balance) || 0;
      if (c.currency === 'USD') { usd += b; has = true; }
      else if (c.currency === 'ILS') { ils += b; has = true; }
    }
    if (has) ibkrCash = { usd: Math.round(usd * 100) / 100, ils: Math.round(ils * 100) / 100 };
  } catch (e) {}
  // v81: עוגן כיול מ־NAV רשמי (ChangeInNAV) — מתקן סטיית מזומן קבועה.
  let cashAnchor = null;
  try {
    const nh = (d && d.navHistory) || [];
    // בוחרים את השורה עם startingValue העדכנית ביותר (תקופת הדוח הארוכה)
    let best = null;
    for (const r of nh) {
      const sv = Number(r.startingValue);
      const fd = String(r.fromDate || '').slice(0, 10);
      if (isFinite(sv) && /^\d{4}-\d{2}-\d{2}$/.test(fd)) {
        if (!best || fd < String(best.fromDate).slice(0, 10)) best = r;
      }
    }
    if (best) cashAnchor = { date: String(best.fromDate).slice(0, 10), nav: Number(best.startingValue) };
  } catch (e) {}
  const rows = buildTradesHistory({
    trades: trades,
    cashTx: (d && d.cashTransactions) || [],
    positions: positions,
    cash: ibkrCash || (DB && DB.cash) || { usd: 0, ils: 0 },
    hist: state.hist,
    fxOf: (iso) => fxOnOrBefore(iso) || state.fx || 1,
    cashAnchor: cashAnchor,
  }, fromDate);
  _ibkrThCache[ck] = { sig: sig, rows: rows };
  return rows;
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

/* ---------------- בנצ'מרקים לגרף הביצועים (S&P 500 / Nasdaq 100) ----------------
   היסטוריה יומית מ־Stooq (חינם, בלי מפתח), נשמרת במטמון. כל קו מנורמל ל־100
   בתחילת הטווח — כמו התיק — כדי שההשוואה תהיה הוגנת. */
const LS_BENCH = 'pwa_bench_v1';
const BENCH_SYMS = [['SPY', 'benchSP', '#1A73E8'], ['QQQ', 'benchNasdaq', '#9334E6']];
let benchCache = null;

function benchStore() {
  if (benchCache) return benchCache;
  try { benchCache = JSON.parse(localStorage.getItem(LS_BENCH) || 'null') || {}; }
  catch (e) { benchCache = {}; }
  return benchCache;
}

/* היסטוריית מדד: [{date, close}] ישן -> חדש. נשמר עד 6 שנים אחורה.
   עובר דרך getDailyFast — אותו מטמון ואותו מרוץ מקבילי מהיר כמו שאר הגרף. */
async function getBenchHist(sym) {
  // רק הסימולים המוכרים — כל השאר null (לא שולחים בקשות מיותרות)
  if (!BENCH_SYMS.some(([s]) => s === sym)) return null;
  const store = benchStore();
  const today = todayISO();
  const cached = store[sym];
  if (cached && cached.updated === today && cached.rows && cached.rows.length > 30) {
    return cached.rows.map(([d, c]) => ({ date: d, close: c }));
  }
  const stale = (cached && cached.rows && cached.rows.length > 30)
    ? cached.rows.map(([d, c]) => ({ date: d, close: c })) : null;
  let out = [];
  try {
    const rows = await getDailyFast(sym, false);
    out = rows.filter((r) => r.date >= addDaysISO(today, -6 * 365))
              .map((r) => ({ date: r.date, close: r.close }));
  } catch (e) { /* נופל למטמון ישן */ }
  if (!out.length) return stale || [];
  if (out.length > 30) {
    store[sym] = { updated: today, rows: out.map((r) => [r.date, r.close]) };
    try { localStorage.setItem(LS_BENCH, JSON.stringify(store)); } catch (e) {}
  }
  return out;
}

/* נרמול סדרה ל־100 בנקודת ההתחלה — טהור, נבדק */
function normalize100(rows) {
  if (!rows || !rows.length) return [];
  const b = Number(rows[0].value);
  if (!(b > 0)) return [];
  return rows.map((r) => ({ date: r.date, norm: r.value / b * 100 }));
}

/* חיתוך סדרה מתאריך ואילך (כולל) — טהור, נבדק */
function sliceFromDate(rows, iso) {
  if (!rows || !rows.length || !iso) return rows ? rows.slice() : [];
  return rows.filter((r) => r.date >= iso);
}

/* תשואה באחוזים בין שני ערכים — טהור, נבדק. null כשלא ניתן לחשב. */
function retPct(a, b) {
  a = Number(a); b = Number(b);
  if (!(a > 0) || !isFinite(b)) return null;
  return (b / a - 1) * 100;
}

/* HTML לתשואה: צבעוני או מקף כשאין ערך */
function fmtRetHTML(r) {
  if (r === null || !isFinite(r)) return '<b>—</b>';
  return '<b class="' + (r >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r, true) + '</b>';
}

function renderPfChips() {  const box = document.getElementById('pfChips');
  if (!box || box.children.length) return;
  for (const [key, label] of PF_RANGES) {
    const b = el('button', 'range-btn' + (state.pfRange === key ? ' active' : ''), t(label));
    b.type = 'button';
    b.addEventListener('click', () => {
      state.pfRange = key;
      state.pfCustomFrom = null;
      state.pfMeasure.pts = [];
      box.querySelectorAll('.range-btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      drawPfChart();
    });
    box.appendChild(b);
  }
}

/* גרף שווי התיק בשקלים לאורך זמן (לפי האחזקות הנוכחיות — אין יומן קניות היסטורי) */

let pfChartToken = 0;

/* שורת כלי גרף הביצועים: כפתור "תשואה מתאריך" + תג טווח מותאם + צ'יפ מדידה.
   המדידה עצמה מובנית בגרף — שתי לחיצות על נקודות. */
/* אייקון לוח־שנה נקי בצבע המותג — מחליף את האימוג'י הצבעוני 📅 */
const CAL_ICON = '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>';
function renderPfTools() {
  const box = document.getElementById('pfTools');
  if (!box) return;
  box.innerHTML = '';
  const wrap = el('div', 'pf-tools');

  const fromBtn = el('button', 'chip-btn', CAL_ICON + esc(t('pfFromBtn')));
  fromBtn.type = 'button';
  fromBtn.addEventListener('click', openPfFromSheet);
  wrap.appendChild(fromBtn);

  if (state.pfCustomFrom) {
    const tag = el('span', 'pf-custom-tag', esc(t('pfCustom')) + ' · ' + fmtDateIL(state.pfCustomFrom));
    wrap.appendChild(tag);
    const clr = el('button', 'chip-btn', t('pfClearCustom'));
    clr.type = 'button';
    clr.addEventListener('click', () => {
      state.pfCustomFrom = null;
      state.pfRange = 'year';
      state.pfMeasure.pts = [];
      drawPfChart();
    });
    wrap.appendChild(clr);
  }

  box.appendChild(wrap);

  const chip = el('div', 'measure-chip hidden');
  chip.id = 'pfMeasureChip';
  box.appendChild(chip);
}

/* גיליון "תשואה מתאריך": סימון בגרף או בחירה מהיומן */
function closePfSheet() {
  const v = document.getElementById('pfSheetVeil');
  if (v) v.remove();
}
function openPfFromSheet() {
  closePfSheet();
  const veil = el('div', 'pf-sheet-veil');
  veil.id = 'pfSheetVeil';
  const sheet = el('div', 'pf-sheet');
  const h = el('h3');
  h.textContent = t('pfFromBtn');
  sheet.appendChild(h);
  const b1 = el('button', 'sheet-btn', t('pfMarkOnChart'));
  b1.type = 'button';
  b1.addEventListener('click', () => {
    closePfSheet();
    state.pfPickDate = true;
    state.pfMeasure.pts = [];
    hidePfTip();
    updatePfPickUI();
    paintPfChart();
  });
  const b2 = el('button', 'sheet-btn', CAL_ICON + esc(t('pfPickFromCal')));
  b2.type = 'button';
  b2.addEventListener('click', openPfCalSheet);
  const b3 = el('button', 'sheet-btn', '✕ ' + t('btnCancel'));
  b3.type = 'button';
  b3.addEventListener('click', closePfSheet);
  sheet.appendChild(b1);
  sheet.appendChild(b2);
  sheet.appendChild(b3);
  veil.appendChild(sheet);
  veil.addEventListener('click', (e) => { if (e.target === veil) closePfSheet(); });
  document.body.appendChild(veil);
}
function openPfCalSheet() {
  const sheet = document.querySelector('#pfSheetVeil .pf-sheet');
  if (!sheet) { openPfFromSheet(); return; }
  sheet.innerHTML = '';
  const h = el('h3');
  h.textContent = t('pfCalTitle');
  sheet.appendChild(h);
  const inp = document.createElement('input');
  inp.type = 'date';
  inp.max = todayISO();
  if (state.pfCustomFrom) inp.value = state.pfCustomFrom;
  sheet.appendChild(inp);
  const row = el('div', 'sheet-row');
  const ok = el('button', 'btn', t('btnOk'));
  ok.type = 'button';
  ok.addEventListener('click', () => {
    const v = inp.value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v) && v <= todayISO()) {
      state.pfCustomFrom = v;
      state.pfRange = 'custom';
      state.pfMeasure.pts = [];
      closePfSheet();
      drawPfChart();
    } else {
      inp.focus();
    }
  });
  const cancel = el('button', 'btn', t('btnCancel'));
  cancel.type = 'button';
  cancel.style.background = 'var(--surface-container, var(--surface))';
  cancel.style.color = 'var(--on-surface)';
  cancel.addEventListener('click', openPfFromSheet);
  row.appendChild(ok);
  row.appendChild(cancel);
  sheet.appendChild(row);
}

/* מצב בחירת תאריך מהגרף: בועת הסבר + גוון מודגש לגרף */
function updatePfPickUI() {
  const wrap = document.getElementById('pfWrap');
  const bub = document.getElementById('pfPickBubble');
  const on = !!state.pfPickDate;
  if (wrap) wrap.classList.toggle('picking', on);
  if (bub) {
    bub.textContent = t('pfPickBubble');
    bub.classList.toggle('hidden', !on);
  }
}

/* הסבר מתחת לגרף הביצועים — מותאם למקור הנתונים */
function renderPfNote(noBench, srcKind) {
  const p = document.getElementById('pfNoteEl');
  if (!p) return;
  let txt;
  if (srcKind === 'trades') txt = t('pfNoteTrades');
  else {
    const ibkrPts = isIbkrMode() ? ibkrNavHistory() : [];
    txt = ibkrPts.length >= 2 ? t('pfNoteIbkr') : t('pfNote');
  }
  if (srcKind === 'manual') txt += ' · ' + t('pfBenchIbkrOnly');
  else if (noBench) txt += ' · ' + t('pfNoBench');
  try {
    const cv = document.getElementById('pfChart');
    const dg = cv && cv._pfPaint && cv._pfPaint.diag;
    if (dg && dg.from) txt += ' · ' + t('pfDiag', { t: dg.t, f: dg.f, d: dg.d, from: dg.from, to: dg.to, y: dg.y || '—', w: dg.w || '—' });
    // דיאגנוסטיקת NAV: האם התקבל Change in NAV מהדוח
    if (isIbkrMode()) {
      const d = ibkrCfg().data;
      const nh = (d && d.navHistory) || [];
      const nt = (d && d.nav && d.nav.twr !== null && d.nav.twr !== undefined && d.nav.twr !== '') ? d.nav.twr : null;
      txt += ' · NAV: ' + (nh.length > 0 ? nh.length + ' נק׳' : 'אין') + (nt !== null ? ' (TWR ' + nt + '%)' : '');
    }
  } catch (e) {}
  p.textContent = txt;
}

/* שורת תשואת הטווח הנבחר מתחת לגרף — מספר אחד גדול וברור */
function renderPfRangeSummary(s0) {
  const box = document.getElementById('pfRangeSummary');
  if (!box) return;
  if (!s0 || s0.pts.length < 2) { box.innerHTML = ''; return; }
  const r = s0.pts[s0.pts.length - 1].norm - 100;
  let rangeName;
  if (state.pfCustomFrom) rangeName = t('pfCustom') + ' · ' + fmtDateIL(state.pfCustomFrom);
  else {
    const found = PF_RANGES.find(([k]) => k === state.pfRange);
    const labelKey = found ? found[1] : '';
    rangeName = labelKey ? t(labelKey) : '';
  }
  box.innerHTML = '<span>' + esc(t('pfRangeReturn')) + '</span>' +
    '<span class="rs-val ' + (r >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r, true) + '</span>' +
    (rangeName ? '<span class="rs-range">' + esc(rangeName) + '</span>' : '');
}

/* טולטיפ של גרף הביצועים */
function hidePfTip() {
  const tip = document.getElementById('pfTip');
  if (tip) tip.classList.add('hidden');
}
function showPfTip(idx, xPx) {
  const canvas = document.getElementById('pfChart');
  const map = canvas && canvas._pfMap;
  if (!map || map.n < 2) return;
  const wrap = canvas.parentElement;
  let tip = document.getElementById('pfTip');
  if (!tip) {
    tip = el('div', 'pf-tip hidden');
    tip.id = 'pfTip';
    wrap.appendChild(tip);
  }
  const d = map.series[0].pts[idx].date;
  let html = '<b>' + fmtDateIL(d) + '</b>';
  for (const s of map.series) {
    html += '<div><span class="dot" style="background:' + s.color + '"></span>' +
      esc(s.name) + ' ' + fmtRetHTML(s.pts[idx].norm - 100) + '</div>';
  }
  tip.innerHTML = html;
  tip.classList.remove('hidden');
  const wrapW = wrap.clientWidth || 300;
  tip.style.left = Math.min(Math.max(xPx - 70, 4), Math.max(wrapW - 160, 4)) + 'px';
  tip.style.top = '8px';
}

/* צ'יפ תוצאת המדידה בגרף הביצועים */
function updatePfMeasureChip() {
  const chip = document.getElementById('pfMeasureChip');
  const canvas = document.getElementById('pfChart');
  const map = canvas && canvas._pfMap;
  const ms = state.pfMeasure;
  if (!chip || ms.pts.length < 2 || !map) {
    if (chip) { chip.classList.add('hidden'); chip.innerHTML = ''; }
    return;
  }
  const s0 = map.series[0];
  const da = s0.pts[ms.pts[0]].date, db = s0.pts[ms.pts[1]].date;
  const [d1, i1, d2, i2] = da <= db ? [da, ms.pts[0], db, ms.pts[1]] : [db, ms.pts[1], da, ms.pts[0]];
  let html = '<span>' + t('mReturn');
  for (const s of map.series) {
    html += ' <span class="dot" style="background:' + s.color + '"></span> ' +
      fmtRetHTML(retPct(s.pts[i1].norm, s.pts[i2].norm));
  }
  html += ' <span style="font-weight:400">(' + fmtDateIL(d1) + ' ← ' + fmtDateIL(d2) + ')</span></span>' +
    '<button type="button" aria-label="' + t('clearMeasure') + '">✕</button>';
  chip.classList.remove('hidden');
  chip.innerHTML = html;
  chip.querySelector('button').addEventListener('click', () => {
    state.pfMeasure.pts = [];
    drawPfChart();
  });
}

/* לחיצה על גרף הביצועים: בחירת תאריך התחלה / מדידה מובנית / טולטיפ.
   מדידה: לחיצה ראשונה מסמנת נקודה א', לחיצה שנייה — נקודה ב' והתשואה ביניהן.
   לחיצה שלישית מתחילה מדידה חדשה. */
function onPfTap(e) {
  const canvas = document.getElementById('pfChart');
  const map = canvas && canvas._pfMap;
  if (!map || map.n < 2) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  if (x < map.padL - 14 || x > map.padL + map.plotW + 14) { hidePfTip(); return; }
  let idx = Math.round((x - map.padL) / map.plotW * (map.n - 1));
  idx = Math.max(0, Math.min(map.n - 1, idx));

  if (state.pfPickDate) {
    const d = map.series[0].pts[idx].date;
    if (confirm(t('pfConfirmFrom', { date: fmtDateIL(d) }))) {
      state.pfCustomFrom = d;
      state.pfRange = 'custom';
    }
    state.pfPickDate = false;
    state.pfMeasure.pts = [];
    updatePfPickUI();
    drawPfChart();
    return;
  }
  const pts = state.pfMeasure.pts;
  pts.push(idx);
  if (pts.length === 1) {
    showPfTip(idx, x); // נקודה ראשונה — סמן + טולטיפ
  } else {
    hidePfTip();
    if (pts.length > 2) { state.pfMeasure.pts = [idx]; showPfTip(idx, x); } // שלישית — מחדש
  }
  paintPfChart();
}

/* גרף ביצועי התיק מול S&P 500 ו־Nasdaq 100 — כל הקווים מנורמלים לתשואה
   (100 = תחילת הטווח). ציר Y באחוזים. */
async function drawPfChart() {
  const canvas = document.getElementById('pfChart');
  const loading = document.getElementById('pfLoading');
  const legend = document.getElementById('pfLegend');
  if (!canvas) return;
  if (!canvas._pfTapAttached) {
    canvas.addEventListener('pointerdown', onPfTap);
    canvas._pfTapAttached = true;
  }
  renderPfChips();
  renderPfTools();
  hidePfTip();
  updatePfPickUI();
  const my = ++pfChartToken;

  const ibkrPts = isIbkrMode() ? ibkrNavHistory() : [];
  const useIbkrNav = ibkrPts.length >= 2;
  let allRows, srcKind = 'manual';
  if (useIbkrNav) {
    if (loading) loading.classList.add('hidden');
    // v73: TWR אמיתי מה־NAV הרשמי — מנטרל תזרימים (הפקדות/משיכות).
    // לפני כן חושבה תשואה פשוטה (סוף/התחלה) שהתעוותה בגלל תזרימים.
    allRows = navToTwr(ibkrPts, ibkrFlowsByDate());
    if (allRows.length < 2) allRows = ibkrPts; // נפילה בטוחה
    srcKind = 'ibkr';
  } else {
    if (loading) {
      loading.textContent = t('loadingHist');
      loading.classList.remove('hidden');
    }
    // YTD/1Y: טוען רק היסטוריות מהטווח — מהיר יותר (v79: גם 1Y, לא רק YTD)
    const isYtdRange = state.pfRange === 'ytd' && !state.pfCustomFrom;
    const is1yRange = state.pfRange === 'year' && !state.pfCustomFrom;
    let warmFrom = null;
    if (isYtdRange) warmFrom = todayISO().slice(0, 4) + '-01-01';
    else if (is1yRange) { const d = new Date(); d.setFullYear(d.getFullYear() - 1); warmFrom = d.toISOString().slice(0, 10); }
    await warmPfHistories((done, total) => {
      if (loading && my === pfChartToken) loading.textContent = t('loadingHistN', { done, total });
    }, warmFrom); // מהיר: מרוץ מקבילי + מטמון
    if (my !== pfChartToken) return;
    await ensureFxHist();
    if (my !== pfChartToken) return;
    if (isIbkrMode()) {
      // YTD: חישוב ייעודי מ־1/1 בלבד — "once and for all", בלי זיהום מ־2024-2025.
      // v76: טווחים ארוכים (3Y/5Y/מקסימום) מתחילים מתאריך ההקמה — לא לפני.
      // (החישוב עצמו מתחיל מההקמה, לא רק החיתוך החזותי — תיקון ל־v75.)
      // v79: 1Y מתחיל מלפני שנה (יעיל — לא מחשב היסטוריה מיותרת מ־2024).
      const isYtd = state.pfRange === 'ytd' && !state.pfCustomFrom;
      const ytdStart = isYtd ? todayISO().slice(0, 4) + '-01-01' : null;
      let histFrom = ytdStart;
      if (!isYtd && !state.pfCustomFrom) {
        try {
          if (state.pfRange === 'year') {
            const d = new Date(); d.setFullYear(d.getFullYear() - 1);
            histFrom = d.toISOString().slice(0, 10);
          } else {
            const inception = ibkrInceptionDate();
            // רק לטווחים ארוכים שעלולים להתחיל לפני ההקמה
            if (inception && ['3y', '5y', 'max'].includes(state.pfRange)) histFrom = inception;
          }
        } catch (e) {}
      }
      const th = ibkrTradesHistory(histFrom);
      if (th.length >= 2) { allRows = th; srcKind = 'trades'; }
      else allRows = portfolioSeriesILS();
    } else {
      allRows = portfolioSeriesILS();
    }
  }

  // הפרדה בין סוגי משתמשים: השוואת מדדים רק כשההיסטוריה אמיתית מ־IBKR.
  // בהזנה ידנית (סימולציית אחזקות נוכחיות) אין השוואה — רק קו התיק.
  const showBench = pfShowBench(srcKind);

  let pfRows;
  if (state.pfCustomFrom) {
    pfRows = sliceFromDate(allRows, state.pfCustomFrom);
  } else {
    pfRows = filterRange(allRows, state.pfRange);
  }
  // v75: חיתוך לתאריך הקמה — טווח שמתחיל לפני שהתיק נפתח מציג תשואה פיקטיבית.
  // (3Y/מקסימום הראו ‎-12%‎ כי כללו חודשים לפני ההפקדה הראשונה.)
  if (isIbkrMode() && pfRows.length >= 2) {
    try {
      const inception = ibkrInceptionDate();
      if (inception && pfRows[0].date < inception) {
        const cut = pfRows.filter((r) => r.date >= inception);
        if (cut.length >= 2) {
          const base = cut[0].value;
          if (base > 0) {
            pfRows = cut.map((r) => ({ date: r.date, value: (r.value / base) * 100 }));
          } else {
            pfRows = cut;
          }
        }
      }
    } catch (e) {}
  }
  if (pfRows.length < 2) {
    if (loading) { loading.textContent = t('noChartNow'); loading.classList.remove('hidden'); }
    if (legend) legend.innerHTML = '';
    canvas._pfMap = null;
    canvas._pfPaint = null;
    renderPfNote(true, srcKind);
    renderPfRangeSummary(null);
    renderPfBenchToggles(false);
    return;
  }

  // בנצ'מרקים מיושרים לתאריכי התיק — רק לנתוני IBKR אמיתיים
  const benchSeries = [];
  if (showBench) {
  if (loading) { loading.textContent = t('loadingData'); loading.classList.remove('hidden'); }
  try {
    const wantBench = BENCH_SYMS.filter(([s]) => pfBenchOn(s)); // לא מושכים מדד כבוי
    const hists = await Promise.all(wantBench.map(([s]) => getBenchHist(s)));
    if (my !== pfChartToken) return;
    // המדדים נמדדים בדולרים — בדיוק כמו ש־IBKR מודד. אין שום התאמה לשקלים.
    wantBench.forEach(([sym, labelKey, color], bi) => {
      const hist = hists[bi];
      const rows = hist && hist.length >= 2 ? benchRowsForDates(hist, pfRows.map((r) => r.date)) : null;
      if (rows) benchSeries.push({ name: t(labelKey), color, rows, sym });
    });
  } catch (e) { /* בלי מדדים — התיק בלבד */ }
  } // showBench
  if (loading) loading.classList.add('hidden');

  const allSeries = [
    { name: useIbkrNav ? t('ibkrNavLegend') : t('myPortfolio'), color: cssVar('--primary', '#006A4E'), rows: pfRows },
    ...benchSeries,
  ];
  for (const s of allSeries) s.pts = downsample(normalize100(s.rows), 300);
  const series = allSeries.filter((s) => s.pts.length >= 2);
  if (!series.length) {
    if (loading) { loading.textContent = t('noChartNow'); loading.classList.remove('hidden'); }
    if (legend) legend.innerHTML = '';
    canvas._pfMap = null;
    canvas._pfPaint = null;
    renderPfNote(true, srcKind);
    renderPfRangeSummary(null);
    return;
  }
  // דיאגנוסטיקה למצב שחזור־מעסקאות: כמה עסקאות/תזרימים זוהו ומה טווח התאריכים.
  // עוזר לאמת מול הדוח של IBKR כשהתשואה נראית לא נכונה.
  let pfDiag = null;
  if (srcKind === 'trades') {
    try {
      const dd = (typeof ibkrCfg === 'function' && ibkrCfg().data) || {};
      const csh = (dd.cashTransactions || []);
      const flows = csh.filter(ibkrIsDepositTx);
      // v82: טווח תאריכי תזרימים + פילוח שנתי — לזיהוי הפקדות חסרות ב־2024-2025
      const fdates = flows.map((c) => String(c.date || '').slice(0, 10)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      const byYear = {};
      for (const d of fdates) { const y = d.slice(0, 4); byYear[y] = (byYear[y] || 0) + 1; }
      const fRange = fdates.length ? fdates[0] + '..' + fdates[fdates.length - 1] : '—';
      const yBreak = Object.keys(byYear).sort().map((y) => y + ':' + byYear[y]).join(' ');
      pfDiag = {
        t: (dd.trades || []).filter(ibkrIsStockTrade).length,
        f: flows.length,
        d: csh.filter(ibkrIsDividendTx).length,
        from: pfRows.length ? pfRows[0].date : '',
        to: pfRows.length ? pfRows[pfRows.length - 1].date : '',
        y: ibkrCashTxTypeList(csh).join(', '),
        w: (pfRows.noHist || []).join(', ') + ' | תזרימים: ' + fRange + ' (' + yBreak + ')',
      };
    } catch (e) { pfDiag = null; }
  }
  canvas._pfPaint = { series: series, benchEmpty: benchSeries.length === 0, srcKind: srcKind, diag: pfDiag };
  renderPfBenchToggles(showBench);
  paintPfChart();
}

/* ציור סינכרוני של גרף הביצועים מהנתונים האחרונים (בלי טעינת רשת ובלי
   בניית DOM מחדש) — ללחיצות מהירות: טולטיפ, מדידה, סמנים. */
function paintPfChart() {
  const canvas = document.getElementById('pfChart');
  const legend = document.getElementById('pfLegend');
  const paint = canvas && canvas._pfPaint;
  if (!canvas || !paint) return;
  const series = paint.series.filter((s) => !s.sym || pfBenchOn(s.sym));
  if (!series.length) return;
  const n = series[0].pts.length;

  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 320, h = 210;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);

  let min = Infinity, max = -Infinity;
  for (const s of series) for (const p of s.pts) {
    const v = p.norm - 100;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!isFinite(min)) { min = -1; max = 1; }
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.08 || 1;
  min -= pad; max += pad;

  const padL = 6, padR = 54, padT = 10, padB = 36;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  const X = (i) => padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  ctx.font = '12.5px system-ui';
  ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g++) {
    const v = min + (max - min) * g / 4;
    const y = Y(v);
    ctx.strokeStyle = cssVar('--outline', '#E3E7E4');
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = cssVar('--on-surface-var', '#9AA5A0');
    ctx.textAlign = 'left';
    ctx.fillText((v > 0 ? '+' : '') + v.toFixed(1) + '%', w - padR + 6, y);
  }
  if (min < 0 && max > 0) {
    ctx.strokeStyle = cssVar('--outline', '#E3E7E4');
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(padL, Y(0)); ctx.lineTo(w - padR, Y(0)); ctx.stroke();
    ctx.setLineDash([]);
  }
  const pts0 = series[0].pts;
  ctx.fillStyle = cssVar('--on-surface-var', '#9AA5A0');
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const step = Math.max(1, Math.floor(n / 4));
  for (let i = 0; i < n; i += step) ctx.fillText(fmtDateIL(pts0[i].date).slice(3), X(i), h - 20);

  for (const s of series) {
    ctx.beginPath();
    s.pts.forEach((p, i) => {
      const x = X(i), y = Y(p.norm - 100);
      if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
    });
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s === series[0] ? 2.5 : 2;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // סמני מדידה — בולטים ונעימים: הילה רכה, טבעת לבנה, ורצועה בין הנקודות
  const ms = state.pfMeasure;
  ms.pts = ms.pts.filter((i) => i >= 0 && i < n);
  const marker = cssVar('--primary', '#006A4E');
  if (ms.pts.length >= 2) {
    const a = Math.min(ms.pts[0], ms.pts[1]), b = Math.max(ms.pts[0], ms.pts[1]);
    ctx.fillStyle = marker + '1F';
    ctx.fillRect(X(a), padT, X(b) - X(a), plotH);
  }
  const drawMarker = (i) => {
    const x = X(i), y = Y(pts0[i].norm - 100);
    ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fillStyle = marker + '2E'; ctx.fill();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = marker; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = marker; ctx.fill();
    ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
  };
  for (const i of ms.pts) drawMarker(i);

  canvas._pfMap = { n, padL, plotW, series };
  canvas.classList.toggle('measuring', state.pfPickDate || ms.pts.length > 0);
  updatePfMeasureChip();

  if (legend) {
    legend.innerHTML = series.map((s) => {
      const r = s.pts[s.pts.length - 1].norm - 100;
      return '<li><span class="dot" style="background:' + s.color + '"></span>' +
        '<span class="lg-name">' + esc(s.name) + '</span>' +
        '<span class="lg-pct">' + fmtRetHTML(r) + '</span></li>';
    }).join('');
  }
  renderPfRangeSummary(series[0]);
  renderPfNote(paint.benchEmpty, paint.srcKind);
}

/* ---------------- רינדור: מניות ---------------- */

/* v87: חיפוש מניות ב־Yahoo Finance להוספה מהירה.
   עובד בשני המצבים (ידני ו־IBKR) — פותח את טופס ההוספה עם הסימבול מולא מראש. */
let _stockSearchT = null;
let _stockSearchAbort = null;

async function searchStocksYahoo(query) {
  const q = String(query || '').trim();
  if (q.length < 1) return [];
  // 1. ה־search API של Yahoo (חיפוש חופשי)
  const apiRes = await yahooSearchAPI(q);
  if (apiRes === 'aborted') return 'aborted';
  if (apiRes && apiRes.length) return apiRes;
  // 2. גיבוי: בדיקת סימבול ישירה דרך ה־chart API — ה־search API מוגבל/נחסם
  //    לפעמים (429), וה־chart API אמין יותר. מכסה הקלדת סימבול כמו GOOG.
  const direct = await yahooDirectSymbol(q);
  if (direct) return [direct];
  return apiRes === null ? null : [];
}

/* בדיקת סימבול ישירה: שולף meta מה־chart API של Yahoo (כולל longName) */
async function yahooDirectSymbol(q) {
  const sym = normalizeSym(q).replace(/[^A-Z0-9.-]/g, '');
  if (!sym || sym.length > 12) return null;
  try {
    const res = await fetch(yahooURL(sym, 'interval=1d&range=5d'), { headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const j = await res.json();
    const meta = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
    if (!meta || !meta.symbol) return null;
    const qt = String(meta.quoteType || '').toUpperCase();
    if (qt && !['EQUITY', 'ETF'].includes(qt)) return null;
    const s = String(meta.symbol).toUpperCase();
    return { sym: s, name: meta.longName || meta.shortName || s, type: qt || 'EQUITY' };
  } catch (e) { return null; }
}

async function yahooSearchAPI(query) {
  const q = String(query || '').trim();
  const url = 'https://query2.finance.yahoo.com/v1/finance/search?q=' + encodeURIComponent(q) + '&quotesCount=8&newsCount=0';
  try {
    if (_stockSearchAbort) { try { _stockSearchAbort.abort(); } catch (e) {} }
    _stockSearchAbort = new AbortController();
    const res = await fetch(url, { signal: _stockSearchAbort.signal, headers: { 'Accept': 'application/json' } });
    if (!res.ok) return null;
    const j = await res.json();
    const quotes = (j && j.quotes) || [];
    // רק מניות/ETF — בלי אופציות, מט"ח, קרנות
    return quotes
      .filter((x) => x && x.symbol && ['EQUITY', 'ETF'].includes(x.quoteType))
      .slice(0, 8)
      .map((x) => ({ sym: String(x.symbol).toUpperCase(), name: x.longname || x.shortname || x.symbol, type: x.quoteType }));
  } catch (e) {
    if (e && e.name === 'AbortError') return 'aborted';
    return null;
  }
}

function renderStockSearchResults(items, status) {
  const box = document.getElementById('stockSearchResults');
  if (!box) return;
  box.innerHTML = '';
  if (status === 'loading') {
    box.classList.remove('hidden');
    const d = el('div', 'stock-search-loading');
    d.textContent = '…';
    box.appendChild(d);
    return;
  }
  if (status === 'error') {
    box.classList.remove('hidden');
    const d = el('div', 'stock-search-empty');
    d.textContent = t('stockSearchError');
    box.appendChild(d);
    return;
  }
  if (!items || !items.length) {
    if (status === 'empty') {
      box.classList.remove('hidden');
      const d = el('div', 'stock-search-empty');
      d.textContent = t('stockSearchNoResults');
      box.appendChild(d);
    } else {
      box.classList.add('hidden');
    }
    return;
  }
  box.classList.remove('hidden');
  for (const it of items) {
    const row = el('div', 'stock-search-item');
    row.innerHTML =
      '<span class="ss-logo">' + stockLogoHTML(it.sym) + '</span>' +
      '<span class="ss-sym" dir="ltr">' + esc(it.sym) + '</span>' +
      '<span class="ss-name">' + esc(it.name) + '</span>' +
      '<span class="ss-type">' + esc(it.type) + '</span>' +
      '<span class="ss-add">＋</span>';
    row.addEventListener('click', () => {
      box.classList.add('hidden');
      const inp = document.getElementById('stockSearchInput');
      if (inp) inp.value = '';
      openAddStockWithSymbol(it.sym, it.name);
    });
    box.appendChild(row);
  }
}

/* פותח את טופס הוספת המניה עם סימבול (ושם) מולאים מראש.
   אם לא במצב עריכה — מפעיל אותו אוטומטית כדי שהטופס יופיע. */
function openAddStockWithSymbol(sym, name) {
  if (!state.edit['stocks']) {
    const btn = document.getElementById('editStocksBtn');
    if (btn) btn.click();
    else { state.edit['stocks'] = true; renderStocks(); }
  }
  const list = document.getElementById('stockList');
  showAddPositionForm(list);
  // ממלא את השדות אחרי שהטופס נוצר
  setTimeout(() => {
    const card = document.getElementById('addPosForm');
    if (!card) return;
    const symInp = card.querySelector('#ap-sym');
    const nameInp = card.querySelector('#ap-full');
    if (symInp) symInp.value = sym;
    if (nameInp && name) nameInp.value = name;
    const sharesInp = card.querySelector('#ap-shares');
    if (sharesInp) sharesInp.focus();
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 50);
}

function initStockSearch() {
  const inp = document.getElementById('stockSearchInput');
  const box = document.getElementById('stockSearchResults');
  if (!inp || !box) return;
  inp.addEventListener('input', () => {
    clearTimeout(_stockSearchT);
    const q = inp.value.trim();
    if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    renderStockSearchResults(null, 'loading');
    _stockSearchT = setTimeout(async () => {
      const res = await searchStocksYahoo(q);
      if (res === 'aborted') return;
      if (res === null) { renderStockSearchResults(null, 'error'); return; }
      // מסנן מניות שכבר בתיק
      const existing = new Set(POSITIONS.map((p) => p.sym));
      const filtered = res.filter((r) => !existing.has(r.sym));
      renderStockSearchResults(filtered, filtered.length ? 'ok' : 'empty');
    }, 400);
  });
  // סגירת תוצאות בלחיצה בחוץ
  document.addEventListener('click', (e) => {
    if (!box.classList.contains('hidden') && !e.target.closest('.stock-search-wrap')) {
      box.classList.add('hidden');
    }
  });
  // Escape סוגר
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { box.classList.add('hidden'); inp.blur(); }
  });
}

/* v90: מיון רשימת המניות — נשמר בין טעינות, ברירת מחדל: גודל בתיק */
const LS_STOCKSORT = 'pwa_stocksort_v1';
const STOCK_SORTS = ['size', 'day', 'gain'];
function getStockSort() {
  try {
    const v = localStorage.getItem(LS_STOCKSORT);
    return STOCK_SORTS.includes(v) ? v : 'size';
  } catch (e) { return 'size'; }
}
function setStockSort(v) {
  if (!STOCK_SORTS.includes(v)) return;
  try { localStorage.setItem(LS_STOCKSORT, v); } catch (e) {}
  paintStockSortChips();
  renderStocks();
}
function gainPctOf(p, price) {
  if (price === null || !(p.avg > 0)) return null;
  return (price - p.avg) / p.avg * 100;
}
/* טהורה לבדיקות: ממיינת עותק לפי מצב; null בסוף */
function sortPositionsList(list, mode, mOf) {
  const arr = list.slice();
  const key = (p) => {
    const m = mOf(p);
    if (mode === 'day') return m.dayChg;
    if (mode === 'gain') return m.gainPct;
    return m.value;
  };
  arr.sort((a, b) => {
    const ka = key(a), kb = key(b);
    if (ka === null && kb === null) return 0;
    if (ka === null) return 1;
    if (kb === null) return -1;
    return kb - ka;
  });
  return arr;
}
function paintStockSortChips() {
  const cur = getStockSort();
  document.querySelectorAll('#stockSortRow .sort-chip').forEach((b) => {
    b.classList.toggle('on', b.dataset.sort === cur);
  });
}
function initStockSort() {
  const row = document.getElementById('stockSortRow');
  if (!row) return;
  row.querySelectorAll('.sort-chip').forEach((b) => {
    b.addEventListener('click', () => setStockSort(b.dataset.sort));
  });
  paintStockSortChips();
}

function renderStocks() {
  const list = document.getElementById('stockList');
  list.innerHTML = '';
  const sc = document.getElementById('stockCount');
  if (sc) sc.textContent = POSITIONS.length;
  if (editAllowed('stocks')) {
    const add = el('button', 'card add-card');
    add.type = 'button';
    add.innerHTML = '<span class="add-plus">＋</span> ' + t('addStock');
    add.addEventListener('click', () => showAddPositionForm(list));
    list.appendChild(add);
  }
  if (!POSITIONS.length && !editAllowed('stocks')) {
    const m = el('p', 'fine');
    m.style.padding = '0';
    m.textContent = t('noStocks');
    list.appendChild(m);
  }
  const mode = getStockSort();
  const mOf = (p) => {
    const m = metrics(p.sym);
    return { value: m.value, dayChg: m.dayChg, gainPct: gainPctOf(p, m.price) };
  };
  for (const p of sortPositionsList(POSITIONS, mode, mOf)) {
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

/* ---------------- רשימת מעקב (wishlist) — לא חלק מהתיק ---------------- */

/* ולידציה טהורה — ניתנת לבדיקה */
function wlValidate(sym) {
  const s = String(sym || '').trim().toUpperCase();
  if (!/^[A-Z.]{1,8}$/.test(s)) return { err: t('errSymInvalid') };
  if (WISHLIST.some((w) => w.sym === s)) return { err: t('wlExists', { sym: s }) };
  if (POSITIONS.some((p) => p.sym === s)) return { err: t('wlAlreadyOwn', { sym: s }) };
  return { sym: s };
}

function wlAddItem() {
  const symEl = document.getElementById('wlSym');
  const noteEl = document.getElementById('wlNote');
  const errEl = document.getElementById('wlErr');
  const v = wlValidate(symEl.value);
  if (v.err) { errEl.textContent = v.err; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');
  WISHLIST.push({ sym: v.sym, note: noteEl.value.trim() });
  saveDB();
  symEl.value = ''; noteEl.value = '';
  renderWishlist();
  flash(t('wlAdded'));
  refreshQuotes();
}

function wlRemove(w) {
  if (!confirm(t('wlDelConfirm', { sym: w.sym }))) return;
  const i = WISHLIST.findIndex((x) => x.sym === w.sym);
  if (i >= 0) WISHLIST.splice(i, 1);
  delete state.quotes[w.sym];
  saveDB();
  renderWishlist();
  flash(t('wlRemoved'));
}

function renderWishlist() {
  const list = document.getElementById('wishlistList');
  if (!list) return;
  list.innerHTML = '';
  const wc = document.getElementById('wishlistCount');
  if (wc) wc.textContent = WISHLIST.length;
  if (!WISHLIST.length) {
    const m = el('p', 'fine');
    m.textContent = t('wlEmpty');
    list.appendChild(m);
    return;
  }
  for (const w of WISHLIST) {
    const q = state.quotes[w.sym] || {};
    const close = num(q.close);
    const prev = num(q.prev);
    const chg = (close > 0 && prev > 0) ? (close - prev) / prev * 100 : null;
    const er = (state.earnings || {})[w.sym];
    const card = el('div', 'card wl-card');
    card.innerHTML =
      '<div class="wl-top">' +
      '<div><div class="wl-sym" dir="ltr">' + esc(w.sym) + '</div>' +
      (w.note ? '<div class="wl-note">' + esc(w.note) + '</div>' : '') +
      '</div>' +
      '<button class="link-btn wl-del" type="button" aria-label="' + esc(t('wlRemove', { sym: w.sym })) + '">✕</button>' +
      '</div>' +
      '<div class="wl-price">' +
      (close > 0
        ? '<span class="wl-close" dir="ltr">$' + close.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</span>'
        : '<span class="fine">' + t('wlNoPrice') + '</span>') +
      (chg !== null
        ? '<span class="wl-chg ' + (chg >= 0 ? 'pos' : 'neg') + '" dir="ltr">' + (chg >= 0 ? '+' : '') + chg.toFixed(2) + '%</span>'
        : '') +
      '</div>' +
      (er && er.date && daysUntil(er.date) >= 0
        ? '<div class="wl-earn">' + esc(t('earnDate', { date: fmtDateIL(er.date) })) + '</div>'
        : '');
    card.querySelector('.wl-del').addEventListener('click', () => wlRemove(w));
    list.appendChild(card);
  }
}

/* v88/v93: לוגו חברה לכרטיס מניה — עם אות ראשונה כגיבוי אם הלוגו לא נטען.
   מקור: Financial Modeling Prep (חינמי, ללא מפתח).
   v93: אריח בהיר כמו v88; תיקון ניגודיות אוטומטי — לוגו בהיר על שקוף
   (UBER/APP/UNH) עובר invert כדי להיראות על האריח הבהיר. עובד גם למניות
   עתידיות כי הניתוח נעשה בזמן אמת על התמונה שנטענה (FMP שולח CORS). */
function stockLogoHTML(sym) {
  const nsym = normalizeSym(sym);
  const first = (nsym || '?').charAt(0);
  return '<span class="stock-logo">' +
    '<span class="stock-logo-fb">' + esc(first) + '</span>' +
    '<img class="stock-logo-img" crossorigin="anonymous" src="https://financialmodelingprep.com/image-stock/' +
    encodeURIComponent(nsym) + '.png" alt="" loading="lazy" ' +
    'onload="logoImgFix(this)" onerror="logoImgErr(this)">' +
    '</span>';
}

/* נכשל בטעינת CORS — מנסה שוב בלי CORS (תצוגה בלבד, בלי תיקון ניגודיות).
   כישלון שני — מסתיר את התמונה ונשאר הגיבוי (אות ראשונה). */
function logoImgErr(img) {
  try {
    if (img.dataset.nocors) { img.style.display = 'none'; return; }
    img.dataset.nocors = '1';
    img.removeAttribute('crossorigin');
    const s = img.src;
    img.removeAttribute('src');
    img.src = s;
  } catch (e) { try { img.style.display = 'none'; } catch (e2) {} }
}

/* מנתח את בהירות הלוגו; לוגו בהיר על אריח בהיר (או כהה על אריח כהה)
   עובר invert אוטומטי כדי להישאר קריא. */
function logoImgFix(img) {
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h || w < 4 || h < 4) return;
    const darkTile = document.documentElement.dataset.theme === 'dark';
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, cnt = 0;
    for (let i = 0; i < d.length; i += 40) {
      if (d[i + 3] > 128) {
        sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        cnt++;
      }
    }
    if (cnt < 5) return;
    const avg = sum / cnt;
    if ((!darkTile && avg > 205) || (darkTile && avg < 50)) {
      img.style.filter = 'invert(1)';
    }
  } catch (e) { /* תמונה מוכתמת (tainted) — משאיר כמו שהיא */ }
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
    '<span class="stock-id">' + stockLogoHTML(sym) + '<span class="stock-sym">' + sym + '</span>' +
    '<span class="stock-name">' + esc(p.name) + '</span></span>' +
    '<span class="stock-price">' + priceTxt + '</span>' +
    '<span class="stock-sub"><span class="day-chg ' + (m.dayChg === null ? '' : m.dayChg >= 0 ? 'pos' : 'neg') + '">' +
    (m.dayChg === null ? '—' : t('todayChg', { v: fmtPct(m.dayChg, true) })) + '</span>' +
    '<span>' + (m.value === null ? '—' : money(cur === 'ILS' && state.fx ? m.value * state.fx : m.value, cur)) +
    ' <span class="chev">▾</span></span></span>';
  head.addEventListener('click', () => toggleStock(sym, card));
  card.appendChild(head);

  // מצב עריכה: כפתורי עריכה/מחיקה מתחת לכותרת הכרטיס
  if (editAllowed('stocks')) {
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
  const markerBlue = cssVar('--sys-blue', '#007AFF');
  if (ms.pts.length >= 1) drawMarker(ms.pts[0], markerBlue);
  if (ms.pts.length >= 2) {
    drawMarker(ms.pts[1], markerBlue);
    const a = pts[ms.pts[0]], b = pts[ms.pts[1]];
    ctx.strokeStyle = markerBlue; ctx.setLineDash([6, 4]); ctx.lineWidth = 2;
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

/* ---------------- עסקאות IBKR: קניות/מכירות מהדוח ---------------- */
/* רשימת העסקאות מהסנכרון האחרון, ממוינת מהחדשה לישנה (פונקציה טהורה — נבדקת). */
function ibkrTrades() {
  const d = ibkrCfg().data;
  const trs = ((d && d.trades) || []).filter((t) => t && t.symbol);
  return trs.slice().sort((a, b) => {
    const da = String(a.date || ''), db = String(b.date || '');
    return db < da ? -1 : db > da ? 1 : 0;
  });
}

/* עיצוב סכום במטבע העסקה (פונקציה טהורה — נבדקת). */
function fmtTradeMoney(v, cur) {
  const n = Math.abs(Number(v) || 0);
  const s = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const c = String(cur || 'USD').toUpperCase();
  if (c === 'USD') return '$' + s;
  if (c === 'ILS') return '₪' + s;
  return c + ' ' + s;
}

/* נתוני שורה לתצוגה — מחושבים בנפרד כדי שאפשר יהיה לבדוק בלי DOM (נבדקת). */
function tradeRowData(tr) {
  const t = tr || {};
  const isBuy = String(t.side || '').toUpperCase() === 'BUY';
  const cur = String(t.currency || 'USD').toUpperCase();
  const qty = Math.abs(Number(t.qty) || 0);
  const price = Number(t.price) || 0;
  const comm = Math.abs(Number(t.commission) || 0);
  const commCur = String(t.commissionCurrency || cur).toUpperCase();
  return {
    date: String(t.date || '').slice(0, 10),
    symbol: String(t.symbol || ''),
    isBuy,
    qtyTxt: Number.isInteger(qty) ? String(qty) : String(+qty.toFixed(4)),
    priceTxt: fmtTradeMoney(price, cur),
    totalTxt: (isFinite(qty) && isFinite(price)) ? fmtTradeMoney(qty * price, cur) : null,
    commTxt: comm > 0 ? fmtTradeMoney(comm, commCur) : null,
  };
}

function buildTradeRow(tr) {
  const d = tradeRowData(tr);
  const li = el('li');
  const main = el('span');
  main.innerHTML = '<span class="r-date">' + esc(fmtDateIL(d.date)) + '</span> ' +
    '<span class="side-chip ' + (d.isBuy ? 'buy' : 'sell') + '">' +
    esc(d.isBuy ? t('buySide') : t('sellSide')) + '</span><br>' +
    '<span class="r-note">' + esc(d.symbol) + ' · ' + esc(d.qtyTxt) + ' × ' + esc(d.priceTxt) + '</span>';
  li.appendChild(main);
  const wrap = el('span');
  let html = d.totalTxt === null
    ? '<span class="r-amt zero">—</span>'
    : '<span class="r-amt">' + esc(d.totalTxt) + '</span>';
  if (d.commTxt) html += '<br><span class="r-note">' + esc(t('commissionLbl')) + ': ' + esc(d.commTxt) + '</span>';
  wrap.innerHTML = html;
  li.appendChild(wrap);
  return li;
}

function renderTrades() {
  const list = document.getElementById('tradeList');
  const hint = document.getElementById('tradesHint');
  const cnt = document.getElementById('tradeCount');
  if (!list) return;
  const ready = isIbkrMode() && !!(ibkrCfg().data);
  const trs = ready ? ibkrTrades() : [];
  if (cnt) cnt.textContent = trs.length;
  list.innerHTML = '';
  if (hint) {
    if (!ready) { hint.classList.remove('hidden'); hint.textContent = t('tradesNeedIbkr'); }
    else hint.classList.add('hidden');
  }
  if (!ready) return;
  if (!trs.length) {
    const p = el('p', 'fine', t('tradesEmpty'));
    list.appendChild(p);
    return;
  }
  for (const tr of trs) list.appendChild(buildTradeRow(tr));
}

function renderDeposits() {
  const nd = netDepositsILS();
  const ndTxt = '₪' + Math.abs(nd).toLocaleString('en-US');
  document.getElementById('depTotal').textContent = ndTxt;
  document.getElementById('depCount').textContent = t('records', { n: DEPOSITS.length });
  const cn = document.getElementById('calcNotePara');
  if (cn) cn.innerHTML = t('calcNote1', { total: ndTxt }) +
    (isIbkrMode() ? '<br><span class="fine">' + t('ibkrDepositsNote') + '</span>' : '');
  const dn = document.getElementById('depNoteEl');
  if (dn) dn.classList.toggle('hidden', isIbkrMode()); // ההסבר הידני (גיליון) לא רלוונטי במצב IBKR
  const de = document.getElementById('depIbkrEmpty');
  if (de) {
    const show = isIbkrMode() && !DEPOSITS.length;
    de.classList.toggle('hidden', !show);
    if (show) {
      // דיאגנוסטיקה: מה באמת הגיע בדוח — בלי סכומים, רק שמות סוגים
      const d = ibkrCfg().data;
      const txs = (d && d.cashTransactions) || [];
      if (!txs.length) {
        de.textContent = t('depEmptyIbkr');
      } else {
        const types = ibkrCashTxTypeList(txs);
        de.textContent = t('depEmptyIbkrTypes', { types: types.join(', ') || '—' });
      }
    }
  }
  const ul = document.getElementById('depositList');
  ul.innerHTML = '';
  const ed = editAllowed('deposits');
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
  try { fitNumbers(); } catch (e) {}
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
  renderTrades();
  renderWishlist();
  renderDeposits();
  renderPension();
  renderIbkrLocks();
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
  // מטבע — כפתור יחיד שמחליף בין $ ל־₪ (v92); נשמר בין רענונים
  const paintCurBtn = () => {
    const b = document.getElementById('curToggleBtn');
    if (b) b.textContent = state.currency === 'ILS' ? '₪' : '$';
  };
  const setCur = (c) => {
    state.currency = c;
    try { localStorage.setItem('pwa_currency_v1', c); } catch (e) {}
    paintCurBtn();
    renderAll();
  };
  const curBtn = document.getElementById('curToggleBtn');
  if (curBtn) curBtn.addEventListener('click', () => setCur(state.currency === 'ILS' ? 'USD' : 'ILS'));
  // שחזור מטבע שמור מטעינה קודמת
  try {
    const savedCur = localStorage.getItem('pwa_currency_v1');
    if (savedCur === 'ILS' || savedCur === 'USD') state.currency = savedCur;
  } catch (e) {}
  paintCurBtn();
  // תפריט שפה (v92)
  try { initLangMenu(); } catch (e) {}
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
        const checkUpdate = () => { try { if (reg && reg.update) reg.update().catch(() => {}); } catch (e) {} };
        checkUpdate();
        // גם כשהאפליקציה חוזרת מהרקע — מעבר ממסך הבית לא תמיד טוען את הדף מחדש
        document.addEventListener('visibilitychange', () => { if (!document.hidden) checkUpdate(); });
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
  // v85: שחזור הטאב האחרון אחרי רענון (לפני בדיקת המפתח — אם אין מפתח, הגדרות גובר)
  try {
    const lastTab = localStorage.getItem('pwa_lasttab_v1');
    if (lastTab && document.getElementById('tab-' + lastTab)) {
      switchTab(lastTab);
    }
  } catch (e) {}
  if (!tdKey()) { switchTab('settings'); }
  // v85: שמירת מיקום גלילה לכל טאב
  try { initScrollSaver(); } catch (e) {}

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
  // v87: חיפוש מניות להוספה — זמין בשני המצבים
  try { initStockSearch(); } catch (e) {}
  try { initStockSort(); } catch (e) {}

  // רשימת מעקב — הוספה/מחיקה ישירה, לא חלק מהתיק
  const wlAdd = document.getElementById('wlAddBtn');
  if (wlAdd) wlAdd.addEventListener('click', wlAddItem);
  const wlSym = document.getElementById('wlSym');
  if (wlSym) wlSym.addEventListener('keydown', (e) => { if (e.key === 'Enter') wlAddItem(); });
  const wlNote = document.getElementById('wlNote');
  if (wlNote) wlNote.addEventListener('keydown', (e) => { if (e.key === 'Enter') wlAddItem(); });

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

  // ניקוי מטמון ורענון — מביא את הגרסה החדשה ביותר מהשרת
  const clearCacheBtn = document.getElementById('clearCache');
  if (clearCacheBtn) clearCacheBtn.addEventListener('click', async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
    } catch (e) {}
    location.reload();
  });

  // התאמה מחדש של גודל המספרים כשהמסך מסתובב או משתנה
  let fitT = null;
  window.addEventListener('resize', () => {
    clearTimeout(fitT);
    fitT = setTimeout(() => { try { fitNumbers(); } catch (e) {} }, 150);
  });

  const startApp = () => {
    renderAll();
    refreshQuotes().then(() => warmHistories());
    refreshEarnings().then(() => { renderOverview(); renderWishlist(); });
  };
  if (window.Cloud && window.Cloud.boot) window.Cloud.boot(startApp);
  else startApp();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}
