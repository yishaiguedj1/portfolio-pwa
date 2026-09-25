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
const ICON_GEAR = _IC_PRE + '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const ICON_SUN = _IC_PRE + '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.9" y1="4.9" x2="6.3" y2="6.3"/><line x1="17.7" y1="17.7" x2="19.1" y2="19.1"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.9" y1="19.1" x2="6.3" y2="17.7"/><line x1="17.7" y1="6.3" x2="19.1" y2="4.9"/></svg>';
const ICON_MOON = _IC_PRE + '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const ICON_AUTO = _IC_PRE + '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none"/></svg>';
const ICON_MENU = _IC_PRE + '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/></svg>';

const STRINGS = {
he: {
  appTitle: 'תיק ההשקעות',
  loadingSource: 'מקור: טוען…',
  curToggleAria: 'החלפת מטבע — דולר / שקל',
  displayTitle: 'תצוגה',
  curTitle: 'מטבע',
  langAria: 'בחירת שפה',
  menuAria: 'תפריט ראשי',
  menuSettings: 'הגדרות',
  themeCycleAria: 'ערכת נושא — בהיר / כהה / מערכת',
  menuThemeAria: 'ערכת נושא — בהיר / כהה',
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
  flexGuide: 'מקטעים מומלצים בשאילתת ה־Flex: Trades · Cash Transactions · Open Positions · Cash Report · Change in NAV · Net Asset Value (NAV) in Base (לתשואה לפי חודש/שנה/YTD).',
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
  twrMissing: 'לא זמין — אין TWR רשמי בדוח',
  twrMissingShort: 'אין TWR רשמי',
  navWarn: 'הדוח חסר TWR רשמי — התשואה לא תוצג (לא מנחשים). כדי לקבל תשואות רשמיות: ודאו ששאילתת ה־Flex כוללת את המקטע "Change in NAV", ואז נתקו וסנכרנו מחדש.',
  ovValueReport: 'כולל מזומן · לפי דוח IBKR',
  ovStocksSub: 'כולל מזומן',
  perfTwr: 'תשואה משוקללת־זמן (TWR)',
  perfGain: 'רווח/הפסד בתקופה',
  pfDiagPeriods: '{n} תקופות רשמיות · {a}–{b} · TWR: {twr}',
  perfXirr: 'תשואה משוקללת־כסף (XIRR)',
  perfRealized: 'רווח ממומש',
  perfUnrealized: 'רווח לא־ממומש',
  perfDividends: 'דיבידנדים',
  perfWithholding: 'מס שנוכה במקור',
  perfFees: 'עמלות ועמלות נוספות',
  cantCalc: 'לא ניתן לחשב',
  ovInReportPeriod: 'בתקופת הדוח',
  pfNoteIbkr: 'TWR רשמי של IBKR מהדוח, משורשר בין תקופות, בדולרים.',
  pfNoteIbkrDaily: 'TWR יומי מה־NAV של IBKR, בדולרים — הפקדות ומשיכות מנוטרלות, ומעוגן ל־TWR הרשמי של כל תקופה בדוח.',
  pfRangeNeedsDaily: 'אין נתונים מספיק מפורטים לטווח הזה — בדוח יש נקודה אחת לכל תקופה (שנה). כדי לקבל תשואה לפי חודש/שנה/YTD: הוסף בשאילתת ה־Flex ב־IBKR את המקטע "Net Asset Value (NAV) in Base", ואז נתק וסנכרן מחדש.',
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
  editHintStocks: 'מצב עריכה פעיל — אפשר להוסיף מניות חדשות. בסיום לחצו שוב על עריכה.',
  stockSearchPh: 'חפש מניה להוספה (למשל: AAPL, טבע, LUMI)',
  stockSearchNoResults: 'לא נמצאו תוצאות',
  mktTase: 'ת״א · ₪',
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
  stockRangeReturn: 'תשואת המניה',
  pfNoteTrades: 'היסטוריה אמיתית — משוחזרת מעסקאות IBKR: קניות, מכירות והפקדות/משיכות מנוטרלות מהתשואה',

  sourceLabel: 'מקור: {src} · {lag}{sess}{stale}',
  lagLive: 'חי',
  lagDelayed: 'דיליי ~15 דקות',
  sessionPre: ' · טרום־מסחר',
  sessionPost: ' · אחרי־מסחר',
  staleSuffix: ' · מוצגים נתונים שמורים',
  fxSource: 'שער חליפין',
  fxRateLabel: 'שער דולר־שקל',
  fxUpd: 'עודכן {time}',
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

  ibkrTitle: 'חיבור ל־IBKR',
  ibkrNever: 'טרם סונכרן — מוצגים הנתונים הידניים.',
  ibkrSyncStatus: 'תקופה: {a}–{b} · סונכרן: {time}',
  ibkrImportConfirm: 'נמצא דוח IBKR:\nתקופה: {a} – {b}\nTWR רשמי: {twr}\n\n{delta}{warns}\n\nרק המידע החדש יתווסף — הקיים לא ישוכפל ולא יימחק. להמשיך?',
  ibkrImportDeltaFirst: 'סנכרון ראשון — ייובא במלואו.',
  ibkrImportDeltaPeriods: 'תקופות חדשות: {ranges}',
  ibkrImportDeltaReplaced: 'תקופות שיוחלפו (חופפות לחדש): {ranges}',
  ibkrImportDeltaTrades: 'עסקאות חדשות: {n} · תנועות מזומן חדשות: {k}',
  ibkrImportDeltaDup: 'כבר קיימים וידולגו: {n} עסקאות · {m} תנועות מזומן',
  ibkrImportNothingNew: 'אין מידע חדש — כל הנתונים כבר קיימים באפליקציה.',
  ibkrDisconnectBtn: 'ניתוק',
  ibkrDepositsNote: 'מסונכרן מ־IBKR — מתעדכן בכל סנכרון.',
  ibkrStocksNote: 'מניות IBKR מתעדכנות בכל סנכרון. מניות שמוסיפים ידנית (מסומנות "ידני") נשמרות בסנכרון ונכללות בשווי, ברווח ובתשואה.',
  ibkrDataSummary: 'פוזיציות: {n} · עסקאות בדוח: {m} · תנועות מזומן: {k}',
  ibkrChunkFail: 'חלק {fd}–{td} נכשל ({err})',
  proxyUrlMissing: 'כתובת השרתון לא הוגדרה',
  credsMissing: 'חסרים Flex token או Query ID',
  credsMissingSave: 'חסרים Flex token או Query ID — שמור קודם',
  connOk: 'החיבור תקין ✓ (IBKR קיבל את הבקשה)',
  testFailed: 'הבדיקה נכשלה: {err}',
  fetchHistory: 'מושך היסטוריה מ־IBKR… (חלק {n} מתוך {total})',
  importNoStocks: 'לא נמצאו פוזיציות מניות בדוח IBKR',
  importSkippedNote: ' ({n} שורות שאינן מניות דולריות דולגו)',
  importDone: 'הייבוא הושלם: {added} פוזיציות חדשות · {kept} קיימות נשמרו',
  importReplaced: '{n} הוחלפו',
  importSkipped: '{n} דולגו',
  importSnapshotNote: 'הנתונים הידניים נשמרו וישוחזרו בניתוק.',
  // סנכרון Flex — אופציה נוספת למשיכת נתונים
  ibkrConnTitle: 'הגדרות חיבור (שרתון · Query ID · token)',
  ibkrRangeTitle: 'טווח המשיכה',
  ibkrFlexHowTitle: 'איך מגדירים את שאילתת ה־Flex?',
  ibkrSyncDesc: 'הנתונים נמשכים מ־IBKR דרך Flex Web Service: יוצרים שאילתת Flex ב־Client Portal ‏(Reports ← Flex Queries), ומפעילים Flex Web Service כדי לקבל token.',
  flexGuide: 'מקטעים מומלצים בשאילתת ה־Flex: Trades · Cash Transactions · Open Positions · Cash Report · Change in NAV · Net Asset Value (NAV) in Base (לתשואה לפי חודש/שנה/YTD).',
  ibkrProxyLabel: 'כתובת השרתון',
  ibkrQueryPh: 'מ־IBKR',
  ibkrTokenNote: 'ה־token נשמר בטלפון בלבד — לעולם לא בענן ולא בקוד.',
  ibkrFromDateLabel: 'או תאריך התחלה מדויק',
  ibkrFromDatePh: 'אופציונלי — דורס את בחירת העומק',
  ibkrFromDateNote: 'בוחרים כמה שנים אחורה למשוך במשיכה הראשונה — או תאריך מדויק, ללא הגבלה. כשכבר יש נתונים, הסנכרון ממשיך מהנקודה שהם נגמרו.',
  ibkrDepthLabel: 'עומק היסטוריה למשיכה ראשונה',
  ibkrDepth1: 'שנה אחת',
  ibkrDepth2: 'שנתיים',
  ibkrDepth3: '3 שנים',
  ibkrDepth5: '5 שנים',
  ibkrDepth10: '10 שנים',
  ibkrBadFromDate: 'תאריך ההתחלה אינו תקין (עתידי או לא חוקי).',
  ibkrUpToDate: 'הנתונים כבר מעודכנים עד יום המסחר האחרון שנסגר — אין מה למשוך כרגע.',
  fetchHistoryAuto: 'מושך היסטוריה עמוקה מ־IBKR… (חלק {n} מתוך {total})',
  ibkrFlexOlderHint: 'נמצא מידע עד {date}. אם החשבון נפתח לפני כן — אפשר לבחור עומק גדול יותר או תאריך מוקדם יותר, ולייבא שוב.',
  ibkrGapWarn: '⚠ חלק מהתקופה חסר — {detail}. סנכרון רגיל לא יחזור אחורה לסגור את זה; הזן תאריך התחלה מדויק {date} ולחץ שוב על "סנכרן וייבא".',
  ibkrSaveTest: 'שמור ובדוק חיבור',
  ibkrSyncImportBtn: ICON_SYNC + 'סנכרן וייבא מ־IBKR',
  importFailed: 'הסנכרון והייבוא נכשלו: {err}',
  importPartialBlocked: 'הסנכרון לא הושלם — חלק מהנתונים לא נטענו מ־IBKR. הנתונים הקודמים נשמרו ולא יובא שום דבר חלקי. המתן כמה דקות ונסה לסנכרן שוב.',
  importNotAvailable: 'הדוח העדכני של IBKR עדיין לא זמין (הוא מתפרסם בשעות הבוקר בארה״ב). החיבור תקין — אין מה לתקן. הנתונים הקודמים נשמרו; נסה לסנכרן שוב מאוחר יותר.',
  importThrottled: 'IBKR הגביל זמנית את קצב הבקשות (מותרות עד 10 בדקה) — כנראה בעקבות רצף בקשות מהיר. הנתונים הקודמים נשמרו ולא יובא שום דבר חלקי. המתן כ־15 דקות, לחץ "שמור ובדוק חיבור" — אם הבדיקה מצליחה, סנכרן שוב.',
  ibkrErr1003: 'הדוח המבוקש עדיין לא פורסם ב־IBKR. נסה שוב מאוחר יותר.',
  disconnectConfirm: 'לנתק את חיבור הברוקר? הטוקן ונתוני הסנכרון יימחקו מהטלפון, והנתונים הידניים שהיו לפני החיבור ישוחזרו.',
  disconnected: 'החיבור נותק',
  disconnectedRestored: 'החיבור נותק והנתונים הידניים שוחזרו',
  proxyPrefix: 'שרתון: ',
  proxyBadResponse: 'תשובה לא תקינה מהשרתון',
  proxyErr: 'שגיאת שרתון',
  netPrefix: 'רשת: ',
  reportTimeout: 'הדוח לא היה מוכן בזמן — נסה שוב',
  ibkrStageRequest: 'שולח בקשה ל־IBKR',
  ibkrStageWait: 'IBKR מכין את הדוח (בדיקה {n})',
  ibkrErr1001: 'IBKR לא הצליח ליצור את הדוח כרגע (עומס זמני אצלם) — נסה שוב בעוד כמה דקות.',
  ibkrErrRate: 'IBKR דחה את הבקשה כרגע — נסה שוב בעוד כמה דקות.',
  ibkrErrTokenExp: 'הטוקן פג תוקף — צור טוקן חדש ב־IBKR והזן אותו כאן.',
  ibkrErrTokenIp: 'הטוקן מוגבל לכתובת IP מסוימת — ב־IBKR בטל את הגבלת ה־IP.',
  ibkrErrQuery: 'ה־Query ID לא נמצא — בדוק שהמספר שהזנת נכון.',
  ibkrErrTokenBad: 'הטוקן לא תקין — בדוק שהעתקת את כולו, בלי רווחים.',
  ibkrErrAccount: 'בעיה בחשבון ב־IBKR — בדוק שהחשבון פעיל.',
  ibkrErrCode: 'קוד הדוח לא תקין — נסה סנכרון חדש.',
  ibkrErrMany: 'יותר מדי בקשות ברצף — קצב הבקשות הוגבל זמנית. המתן כ־15 דקות ונסה שוב.',
  ibkrErrLocked: 'הטוקן ננעל זמנית בעקבות יותר מדי ניסיונות כושלים — המתן כמה שעות (עד יום) ונסה שוב. ניסיון מוקדם עלול להאריך את הנעילה.',
  importLocked: 'IBKR נעל זמנית את הטוקן בעקבות יותר מדי ניסיונות כושלים. המתן כמה שעות (עד יום) ונסה שוב — ניסיון מוקדם עלול להאריך את הנעילה. הנתונים הקודמים נשמרו ולא יובא שום דבר חלקי.',
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
  resetDesc: 'איפוס מלא: מוחק הכל — ידני ו־IBKR — מהענן ומהטלפון. התיק מתחיל ריק.',
  resetBtn: 'איפוס מלא',
  resetConfirm: 'למחוק את כל הנתונים? הכל יימחק מהענן ומהטלפון (מניות, עסקאות, הפקדות, פנסיה, מזומן ונתוני IBKR), והתיק יתחיל ריק.\nלא ניתן לבטל.',
  resetManualDesc: 'מה שהוזן ביד: מניות ועסקאות ידניות, הפקדות ידניות, מזומן ידני ופנסיה. נתוני IBKR ורשימת המעקב נשארים.',
  resetManualBtn: 'איפוס נתונים ידניים',
  resetManualConfirm: 'למחוק את כל הנתונים שהוזנו ביד?\nמניות ועסקאות ידניות, הפקדות ידניות, מזומן ידני ופנסיה יימחקו. נתוני IBKR ורשימת המעקב נשארים.\nלא ניתן לבטל.',
  resetManualDone: 'הנתונים הידניים נמחקו',
  resetIbkrDesc: 'מה שהגיע מ־IBKR: מניות, הפקדות, מזומן והדוח השמור. הנתונים הידניים והגדרות החיבור נשארים — אפשר לסנכרן מחדש.',
  resetIbkrBtn: 'איפוס נתוני IBKR',
  resetIbkrConfirm: 'למחוק את כל הנתונים שהגיעו מ־IBKR?\nמניות, הפקדות, מזומן והדוח השמור יימחקו. הנתונים הידניים והחיבור נשארים, ואפשר לסנכרן מחדש.\nלא ניתן לבטל.',
  resetIbkrDone: 'נתוני IBKR נמחקו — אפשר לסנכרן מחדש מההגדרות',
  resetIbkrNone: 'אין נתוני IBKR למחיקה',
  demoTitle: 'רוצה לראות את האפליקציה במלואה?',
  demoDesc: 'טוענים תיק דמו מלא בלחיצה אחת: המניות החמות בשוק עכשיו מארה״ב ומת״א, קניות ומכירות לפי מחירי שוק אמיתיים, הפקדות ומשיכות, מזומן בדולרים ובשקלים ופנסיה. הנתונים שלך לא נמחקים — הם מחכים לך ביציאה מהדמו.',
  demoBtn: '✨ טען תיק דמו',
  demoConfirm: 'לטעון תיק דמו?\nהנתונים שלך נשמרים בצד וחוזרים ביציאה מהדמו. שינויים בזמן הדמו לא נשמרים בענן.',
  demoBuilding: 'בונה תיק דמו ממחירי שוק אמיתיים…',
  demoReady: 'תיק הדמו מוכן — סיור נעים!',
  demoFail: 'לא הצלחתי למשוך מחירי שוק — צריך חיבור לאינטרנט. נסה שוב.',
  demoActiveTitle: 'מצב דמו פעיל',
  demoActiveDesc: 'זה תיק לדוגמה — אפשר לגעת בהכל. שינויים כאן לא נשמרים בענן, והנתונים האמיתיים שלך חוזרים ביציאה מהדמו.',
  demoExitBtn: 'יציאה מהדמו',
  demoBanner: 'מצב דמו — נתונים לדוגמה',
  demoSyncBlocked: 'במצב דמו אין סנכרון IBKR — צא מהדמו קודם (בהגדרות).',
  demoDepPlace: 'העברה מהבנק',
  demoWdPlace: 'משיכה לחשבון הבנק',
  demoReservePlace: 'הפקדה פותחת',
  demoWlNote: 'במעקב — מומנטום חזק',
  demoPension: 'קרן פנסיה',
  demoStudy: 'קרן השתלמות',

  footerNote: 'המחירים מתעדכנים חי כל כמה שניות כשהאפליקציה פתוחה. הגרף היומי כולל גם מסחר מורחב — לפני הפתיחה ואחרי הסגירה. מחוץ לשעות המסחר מוצג מחיר הסגירה האחרון.',

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
  fldAvgPrice: 'מחיר קנייה ממוצע ({c})',
  addStockTitle: 'הוספת מניה',
  btnAddStock: 'הוסף מניה',
  stockAdded: 'המניה נוספה ✓',
  stockDeleted: 'המניה נמחקה ✓',
  delStockConfirm: 'למחוק את {name} ({sym}) מהתיק?\nגם נתוני הגרף השמורים שלה יימחקו.',
  addModeAvg: 'לפי מחיר ממוצע',
  addModeTrades: 'לפי עסקאות',
  addModeAvgHint: 'מהיר: כמות ומחיר ממוצע. נכלל בשווי וברווח — בלי תאריכים, לכן לא בתשואה לאורך זמן.',
  addModeTradesHint: 'מדויק: כל קנייה ומכירה עם תאריך. נכלל גם בגרף הביצועים ובתשואה לפי טווחי זמן.',
  fldTradeQty: 'כמות',
  fldTradePrice: 'מחיר למניה ({c})',
  fldFee: 'עמלה ({c}, אופציונלי)',
  mtAddTitle: 'עסקה ידנית',
  mtEditTitle: 'עריכת עסקה',
  btnAddTrade: 'הוסף עסקה',
  tradesAddManual: '＋ עסקה ידנית',
  mtErrDate: 'תאריך לא תקין (לא בעתיד)',
  mtErrQty: 'כמות חייבת להיות גדולה מאפס',
  mtErrPrice: 'מחיר חייב להיות גדול מאפס',
  mtErrOversell: 'אי אפשר למכור יותר מניות ממה שמוחזק בתאריך הזה',
  mtErrHeldIbkr: '{sym} מגיעה מ־IBKR — הקניות והמכירות שלה מתעדכנות בסנכרון',
  mtErrHeldAvg: '{sym} הוזנה לפי מחיר ממוצע. כדי לנהל אותה לפי עסקאות — מחק אותה והוסף מחדש "לפי עסקאות".',
  mtErrDeleteBreaks: 'בלי העסקה הזו תישאר מכירה של יותר מניות ממה שהוחזק — מחק או ערוך קודם את המכירה',
  mtDelConfirm: 'למחוק את העסקה ({side} {qty} {sym} ב־{date})?',
  mtSaved: 'העסקה נשמרה ✓',
  mtDeleted: 'העסקה נמחקה ✓',
  manualTag: 'ידני',
  depInclManual: 'כולל {amt} קניות ידניות',
  depManualTitle: 'קניות ידניות — מחוץ ל־IBKR',
  depManualNote: 'כסף שהוכנס לתיק דרך מניות שהוספת ביד: קנייה = הפקדה, מכירה = משיכה. דולר הומר לשקל לפי שער יום העסקה. לא משנה את התשואה (TWR מנטרל תזרימים).',
  depManualAvg: 'לפי ממוצע',
  mtShadowed: 'לא נספר — {sym} מוחזקת עכשיו ב־IBKR',
  kvRealized: 'רווח ממומש',
  mtManageHint: 'המניה מנוהלת לפי עסקאות — הכמות והמחיר הממוצע מחושבים מהן.',
  btnManageTrades: 'עסקאות',
  twrCombined: 'TWR משולב: IBKR + עסקאות ידניות',
  twrAvgNote: '{n} מניות לפי מחיר ממוצע — בשווי וברווח, לא בתשואה',
  twrNeedsDaily: 'עסקאות ידניות לא נכללות בתשואה — הדוח בלי NAV יומי',
  delTradesPosConfirm: 'למחוק את {sym} ואת כל {n} העסקאות שלה?',
  errSymInvalid: 'סימול לא תקין — אותיות באנגלית בלבד',
  errSymExists: 'המניה כבר קיימת בתיק',
  errSharesPos: 'כמות המניות חייבת להיות חיובית',
  errAvgPos: 'מחיר הקנייה חייב להיות חיובי'
},
en: {
  appTitle: 'Portfolio',
  loadingSource: 'Source: loading…',
  curToggleAria: 'Toggle currency — dollar / shekel',
  displayTitle: 'Display',
  curTitle: 'Currency',
  langAria: 'Choose language',
  menuAria: 'Main menu',
  menuSettings: 'Settings',
  themeCycleAria: 'Theme — light / dark / system',
  menuThemeAria: 'Theme — light / dark',
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
  flexGuide: 'Recommended Flex query sections: Trades · Cash Transactions · Open Positions · Cash Report · Change in NAV · Net Asset Value (NAV) in Base (for month/year/YTD returns).',
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
  twrMissing: 'Unavailable — no official TWR in the report',
  twrMissingShort: 'No official TWR',
  navWarn: 'The report has no official TWR — the return will not be shown (never guessed). To get official returns: make sure your Flex query includes the "Change in NAV" section, then disconnect and sync again.',
  ovValueReport: 'Incl. cash · per IBKR report',
  ovStocksSub: 'Incl. cash',
  perfTwr: 'Time-Weighted Return (TWR)',
  perfGain: 'Period gain/loss',
  pfDiagPeriods: '{n} official periods · {a}–{b} · TWR: {twr}',
  perfXirr: 'Money-Weighted Return (XIRR)',
  perfRealized: 'Realized P&L',
  perfUnrealized: 'Unrealized P&L',
  perfDividends: 'Dividends',
  perfWithholding: 'Withholding tax',
  perfFees: 'Commissions & other fees',
  cantCalc: 'Cannot compute',
  ovInReportPeriod: 'in the report period',
  pfNoteIbkr: "IBKR's official TWR from the report, chained across periods, in USD.",
  pfNoteIbkrDaily: "Daily TWR from IBKR's NAV, in USD — deposits and withdrawals neutralized, anchored to the official TWR of each report period.",
  pfRangeNeedsDaily: 'Not enough detail for this range — the report has one point per period (year). To get month/year/YTD returns: add the "Net Asset Value (NAV) in Base" section to your IBKR Flex query, then disconnect and sync again.',
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
  editHintStocks: 'Edit mode is on — you can add new stocks. When done, tap Edit again.',
  stockSearchPh: 'Search a stock to add (e.g. AAPL, TEVA.TA)',
  stockSearchNoResults: 'No results found',
  mktTase: 'TASE · ₪',
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
  stockRangeReturn: 'Stock return',
  pfNoteTrades: 'True history — reconstructed from IBKR trades: buys, sells and deposits/withdrawals excluded from the return',

  sourceLabel: 'Source: {src} · {lag}{sess}{stale}',
  lagLive: 'live',
  lagDelayed: '~15 min delay',
  sessionPre: ' · pre-market',
  sessionPost: ' · post-market',
  staleSuffix: ' · showing saved data',
  fxSource: 'Exchange rate',
  fxRateLabel: 'USD/ILS rate',
  fxUpd: 'updated {time}',
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

  ibkrTitle: 'IBKR connection',
  ibkrNever: 'Not synced yet — showing manual data.',
  ibkrSyncStatus: 'Period: {a}–{b} · synced: {time}',
  ibkrImportConfirm: 'Found an IBKR report:\nPeriod: {a} – {b}\nOfficial TWR: {twr}\n\n{delta}{warns}\n\nOnly new information will be added — existing data will not be duplicated or deleted. Continue?',
  ibkrImportDeltaFirst: 'First sync — will be fully imported.',
  ibkrImportDeltaPeriods: 'New periods: {ranges}',
  ibkrImportDeltaReplaced: 'Periods to be replaced (overlapping): {ranges}',
  ibkrImportDeltaTrades: 'New trades: {n} · New cash movements: {k}',
  ibkrImportDeltaDup: 'Already exist, will be skipped: {n} trades · {m} cash movements',
  ibkrImportNothingNew: 'No new information — everything is already imported.',
  ibkrDisconnectBtn: 'Disconnect',
  ibkrDepositsNote: 'Synced from IBKR — updates on every sync.',
  ibkrStocksNote: 'IBKR stocks update on every sync. Stocks you add manually (tagged "Manual") are kept on sync and counted in value, P&L and returns.',
  ibkrDataSummary: 'Positions: {n} · Statement trades: {m} · Cash movements: {k}',
  ibkrChunkFail: 'chunk {fd}–{td} failed ({err})',
  proxyUrlMissing: 'Proxy URL not set',
  credsMissing: 'Missing Flex token or Query ID',
  credsMissingSave: 'Missing Flex token or Query ID — save first',
  connOk: 'Connection OK ✓ (IBKR received the request)',
  testFailed: 'Test failed: {err}',
  fetchHistory: 'Fetching history from IBKR… (part {n} of {total})',
  importNoStocks: 'No stock positions found in the IBKR report',
  importSkippedNote: ' ({n} non-USD-stock rows skipped)',
  importDone: 'Import complete: {added} new positions · {kept} existing kept',
  importReplaced: '{n} replaced',
  importSkipped: '{n} skipped',
  importSnapshotNote: 'Manual data was snapshotted and will be restored on disconnect.',
  // Flex sync — an additional data-pull option
  ibkrConnTitle: 'Connection settings (proxy · Query ID · token)',
  ibkrRangeTitle: 'Pull range',
  ibkrFlexHowTitle: 'How do I set up the Flex query?',
  ibkrSyncDesc: 'Data is pulled from IBKR via Flex Web Service: create a Flex query in the Client Portal (Reports → Flex Queries), and enable Flex Web Service to get a token.',
  flexGuide: 'Recommended Flex query sections: Trades · Cash Transactions · Open Positions · Cash Report · Change in NAV · Net Asset Value (NAV) in Base (for month/year/YTD returns).',
  ibkrProxyLabel: 'Proxy URL',
  ibkrQueryPh: 'from IBKR',
  ibkrTokenNote: 'The token is stored on this phone only — never in the cloud or in code.',
  ibkrFromDateLabel: 'Or an exact start date',
  ibkrFromDatePh: 'Optional — overrides the depth choice',
  ibkrFromDateNote: 'Choose how many years back the first pull covers — or an exact date, with no limit. When data already exists, sync continues from where it ended.',
  ibkrDepthLabel: 'History depth for first pull',
  ibkrDepth1: '1 year',
  ibkrDepth2: '2 years',
  ibkrDepth3: '3 years',
  ibkrDepth5: '5 years',
  ibkrDepth10: '10 years',
  ibkrBadFromDate: 'Invalid start date (in the future or malformed).',
  ibkrUpToDate: 'Data is already up to date through the last closed trading day — nothing to fetch right now.',
  fetchHistoryAuto: 'Deep history pull from IBKR… (chunk {n} of {total})',
  ibkrFlexOlderHint: 'Data was found back to {date}. If the account is older, choose a greater depth or an earlier start date and import again.',
  ibkrGapWarn: '⚠ Part of the period is missing — {detail}. A regular sync won\'t go back to fill it; enter exact start date {date} and tap "Sync & Import" again.',
  ibkrSaveTest: 'Save & test connection',
  ibkrSyncImportBtn: ICON_SYNC + 'Sync & import from IBKR',
  importFailed: 'Sync & import failed: {err}',
  importPartialBlocked: 'Sync did not complete — some data could not be loaded from IBKR. Your previous data was kept and nothing partial was imported. Wait a few minutes and try syncing again.',
  importNotAvailable: 'The latest IBKR report is not published yet (it is usually released in the US morning hours). The connection is fine — nothing to fix. Your previous data was kept; try syncing again later.',
  importThrottled: 'IBKR has temporarily rate-limited requests (max 10 per minute) — likely after a burst of rapid requests. Your previous data was kept and nothing partial was imported. Wait about 15 minutes, tap "Save and test connection" — if the test succeeds, sync again.',
  ibkrErr1003: 'The requested report is not published by IBKR yet. Try again later.',
  disconnectConfirm: 'Disconnect the broker? The token and sync data will be deleted from this phone, and the manual data from before the connection will be restored.',
  disconnected: 'Disconnected',
  disconnectedRestored: 'Disconnected — manual data restored',
  proxyPrefix: 'Proxy: ',
  proxyBadResponse: 'Invalid response from proxy',
  proxyErr: 'Proxy error',
  netPrefix: 'Network: ',
  reportTimeout: 'Report wasn\'t ready in time — try again',
  ibkrStageRequest: 'Requesting report from IBKR',
  ibkrStageWait: 'IBKR is preparing the report (check {n})',
  ibkrErr1001: 'IBKR couldn\'t generate the report right now (temporary load on their side) — try again in a few minutes.',
  ibkrErrRate: 'IBKR rejected the request for now — try again in a few minutes.',
  ibkrErrTokenExp: 'Token expired — create a new token in IBKR and enter it here.',
  ibkrErrTokenIp: 'Token is restricted to a specific IP — remove the IP restriction in IBKR.',
  ibkrErrQuery: 'Query ID not found — check the number you entered.',
  ibkrErrTokenBad: 'Invalid token — make sure you copied all of it, with no spaces.',
  ibkrErrAccount: 'IBKR account issue — check that the account is active.',
  ibkrErrCode: 'Invalid report code — try syncing again.',
  ibkrErrMany: 'Too many requests in a row — request rate temporarily limited. Wait about 15 minutes and try again.',
  ibkrErrLocked: 'Token temporarily locked after too many failed attempts — wait several hours (up to a day) and try again. Retrying too soon can extend the lockout.',
  importLocked: 'IBKR has temporarily locked the token after too many failed attempts. Wait several hours (up to a day) and try again — retrying too soon can extend the lockout. Your previous data was kept and nothing partial was imported.',
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
  resetDesc: 'Full reset: deletes everything — manual and IBKR — from the cloud and this phone. The portfolio starts empty.',
  resetBtn: 'Full reset',
  resetConfirm: 'Delete all data? Everything will be deleted from the cloud and this phone (stocks, trades, deposits, pension, cash and IBKR data), and the portfolio will start empty.\nThis cannot be undone.',
  resetManualDesc: 'What you entered by hand: manual stocks and trades, manual deposits, manual cash and pension. IBKR data and the watchlist stay.',
  resetManualBtn: 'Reset manual data',
  resetManualConfirm: 'Delete all manually entered data?\nManual stocks and trades, manual deposits, manual cash and pension will be deleted. IBKR data and the watchlist stay.\nThis cannot be undone.',
  resetManualDone: 'Manual data deleted',
  resetIbkrDesc: 'What came from IBKR: stocks, deposits, cash and the saved report. Manual data and the connection settings stay — you can sync again.',
  resetIbkrBtn: 'Reset IBKR data',
  resetIbkrConfirm: 'Delete all data that came from IBKR?\nStocks, deposits, cash and the saved report will be deleted. Manual data and the connection stay, and you can sync again.\nThis cannot be undone.',
  resetIbkrDone: 'IBKR data deleted — you can sync again from Settings',
  resetIbkrNone: 'No IBKR data to delete',
  demoTitle: 'Want to see the full app?',
  demoDesc: 'Load a complete demo portfolio in one tap: today’s hottest stocks from the US and Tel Aviv, buys and sells at real market prices, deposits and withdrawals, cash in dollars and shekels, and pension. Your data is not deleted — it’s waiting for you when you exit the demo.',
  demoBtn: '✨ Load demo portfolio',
  demoConfirm: 'Load a demo portfolio?\nYour data is set aside and comes back when you exit the demo. Changes during the demo are not saved to the cloud.',
  demoBuilding: 'Building a demo portfolio from real market prices…',
  demoReady: 'Demo portfolio ready — enjoy the tour!',
  demoFail: 'Could not fetch market prices — an internet connection is needed. Try again.',
  demoActiveTitle: 'Demo mode is on',
  demoActiveDesc: 'This is a sample portfolio — feel free to touch everything. Changes here are not saved to the cloud, and your real data comes back when you exit the demo.',
  demoExitBtn: 'Exit demo',
  demoBanner: 'Demo mode — sample data',
  demoSyncBlocked: 'IBKR sync is off in demo mode — exit the demo first (in Settings).',
  demoDepPlace: 'Bank transfer',
  demoWdPlace: 'Withdrawal to bank',
  demoReservePlace: 'Opening deposit',
  demoWlNote: 'Watching — strong momentum',
  demoPension: 'Pension fund',
  demoStudy: 'Study fund',

  footerNote: 'Prices update live every few seconds while the app is open. The daily chart includes extended-hours trading — pre-market and after-hours. Outside trading hours the last closing price is shown.',

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
  fldAvgPrice: 'Avg buy price ({c})',
  addStockTitle: 'Add stock',
  btnAddStock: 'Add stock',
  stockAdded: 'Stock added ✓',
  stockDeleted: 'Stock deleted ✓',
  delStockConfirm: 'Delete {name} ({sym}) from the portfolio?\nIts saved chart data will also be deleted.',
  addModeAvg: 'By average price',
  addModeTrades: 'By trades',
  addModeAvgHint: 'Quick: quantity and average price. Counted in value and P&L — no dates, so not in returns over time.',
  addModeTradesHint: 'Precise: every buy and sell with a date. Also counted in the performance chart and range returns.',
  fldTradeQty: 'Quantity',
  fldTradePrice: 'Price per share ({c})',
  fldFee: 'Fee ({c}, optional)',
  mtAddTitle: 'Manual trade',
  mtEditTitle: 'Edit trade',
  btnAddTrade: 'Add trade',
  tradesAddManual: '＋ Manual trade',
  mtErrDate: 'Invalid date (not in the future)',
  mtErrQty: 'Quantity must be greater than zero',
  mtErrPrice: 'Price must be greater than zero',
  mtErrOversell: "Can't sell more shares than held on that date",
  mtErrHeldIbkr: '{sym} comes from IBKR — its buys and sells update on sync',
  mtErrHeldAvg: '{sym} was entered by average price. To track it by trades — delete it and add it again "By trades".',
  mtErrDeleteBreaks: 'Without this trade a sell would exceed the shares held — delete or edit the sell first',
  mtDelConfirm: 'Delete this trade ({side} {qty} {sym} on {date})?',
  mtSaved: 'Trade saved ✓',
  mtDeleted: 'Trade deleted ✓',
  manualTag: 'Manual',
  depInclManual: 'incl. {amt} in manual buys',
  depManualTitle: 'Manual buys — outside IBKR',
  depManualNote: 'Money that entered the portfolio through stocks you added by hand: a buy counts as a deposit, a sell as a withdrawal. USD converted to ILS at the trade-date rate. Does not change the return (TWR neutralizes flows).',
  depManualAvg: 'By average',
  mtShadowed: 'Not counted — {sym} is now held at IBKR',
  kvRealized: 'Realized P&L',
  mtManageHint: 'This stock is tracked by trades — quantity and average price are computed from them.',
  btnManageTrades: 'Trades',
  twrCombined: 'Combined TWR: IBKR + manual trades',
  twrAvgNote: '{n} stocks by average price — in value and P&L, not in returns',
  twrNeedsDaily: 'Manual trades not in returns — report has no daily NAV',
  delTradesPosConfirm: 'Delete {sym} and all {n} of its trades?',
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
  try { renderThemeToggle(); } catch (e) {}
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
  const lmHe = document.getElementById('langMenuHe');
  const lmEn = document.getElementById('langMenuEn');
  if (lmHe) lmHe.classList.toggle('active', lang === 'he');
  if (lmEn) lmEn.classList.toggle('active', lang === 'en');
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
/* v108: בקרת ערכה בטאב ההגדרות — בהיר/כהה/מערכת; כפתור יחיד בתפריט — בהיר/כהה. */
function renderThemeToggle() {
  const m = getThemeMode();
  const l = document.getElementById('themeLight');
  const d = document.getElementById('themeDark');
  const s = document.getElementById('themeSystem');
  if (l) l.classList.toggle('active', m === 'light');
  if (d) d.classList.toggle('active', m === 'dark');
  if (s) s.classList.toggle('active', m === 'system');
  const mt = document.getElementById('menuThemeTxt');
  if (mt) {
    const dark = resolveTheme() === 'dark';
    mt.innerHTML = dark
      ? ICON_MOON + '<span>' + esc(t('themeDark')) + '</span>'
      : ICON_SUN + '<span>' + esc(t('themeLight')) + '</span>';
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
    // v142: בורסת ת"א מדווחת באגורות (ILA) — לשקלים
    const k = String((res.meta && res.meta.currency) || '').toUpperCase() === 'ILA' ? 0.01 : 1;
    const pk = (v) => { const x = pf(v); return x > 0 ? x * k : x; };
    for (let i = 0; i < ts.length; i++) {
      const close = pk(closes[i]);
      if (!(close > 0)) continue;
      const d = new Date((ts[i] + off) * 1000);
      rows.push({
        date: d.getUTCFullYear() + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()),
        time: withTime ? pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) : null,
        open: pk(opens[i]),
        high: pk(highs[i]),
        low: pk(lows[i]),
        close: close,
        volume: parseInt(vols[i], 10) || 0,
        _adj: pk(adjArr[i]) || 0, // זמני לזיהוי ספליטים
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
  if (!tdKey() || symCur(sym) === 'ILS') return null; // v142: ת"א — Yahoo בלבד
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

/* v134: נקודת הסיום של גרף המניה = המחיר החי, לא השורה האחרונה בהיסטוריה
   השמורה (מטמון עד 24 שעות — הייתה נגמרת אתמול או לפני כמה ימים). לא בטרום־מסחר:
   אז "היום" עוד לא נסחר והסגירה האחרונה כבר בהיסטוריה. */
function stockChartRows(hist, q) {
  const rows = (hist || []).slice();
  if (!q || !(q.close > 0) || q.session === 'pre') return rows;
  const d = q.mdate || q.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return rows;
  const last = rows[rows.length - 1];
  if (!last || d > last.date) rows.push({ date: d, close: q.close });
  else if (d === last.date) rows[rows.length - 1] = Object.assign({}, last, { close: q.close });
  return rows;
}

function daysBetweenIso(a, b) {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
}

/* v134: טווח גרף המניה לפי תאריך לוח שנה, כמו Yahoo/Google: הבסיס = הסגירה
   האחרונה בתאריך החיתוך או לפניו ("שנה" = אותו יום לפני שנה). filterRange הישן ספר שורות (שנה = 252, שבוע = 5 → רק 4 ימי שינוי). */
function stockRangeRows(rows, range) {
  if (!rows || !rows.length) return [];
  const lastIso = rows[rows.length - 1].date;
  // v135: YTD כמו Google — מסגירת יום המסחר הראשון של השנה (NOW: 147.45 ב־02/01/2026)
  if (range === 'ytd') {
    const y = lastIso.slice(0, 4);
    const i = rows.findIndex((r) => r.date.slice(0, 4) === y);
    return i < 0 ? rows.slice() : rows.slice(i);
  }
  let cut = null;
  if (range === 'week') {
    const t = new Date(lastIso + 'T00:00:00Z');
    t.setUTCDate(t.getUTCDate() - 7);
    cut = t.toISOString().slice(0, 10);
  } else if (range !== 'max') {
    cut = pfRangeCutoff(lastIso, range === 'month' ? '1m' : range);
  }
  if (!cut) return rows.slice();
  for (let i = rows.length - 1; i >= 0; i--) if (rows[i].date <= cut) return rows.slice(i);
  return rows.slice();
}

/* v125: טווחי גרף הביצועים לפי תאריכים, לא לפי מספר שורות.
   filterRange הניח שורה לכל יום מסחר ("חודש" = 22 שורות); בנתוני IBKR יש
   שורה לכל תקופה (שנה) — אז כל טווח לקח את הכל והציג את אותה תשואה.
   מחזיר את תאריך הבסיס של הטווח (ISO) ביחס לתאריך האחרון, או null ל"מקסימום". */
function pfRangeCutoff(lastIso, range) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastIso || '')) return null;
  const y = +lastIso.slice(0, 4), m = +lastIso.slice(5, 7) - 1, d = +lastIso.slice(8, 10);
  const back = (dy, dm) => {
    // אותו יום בחודש/שנה קודמים; יום שלא קיים (31/2) נחתך לסוף החודש
    const t = new Date(Date.UTC(y - dy, m - dm, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    t.setUTCDate(Math.min(d, last));
    return t.toISOString().slice(0, 10);
  };
  switch (range) {
    case '1m': return back(0, 1);
    case '3m': return back(0, 3);
    case '6m': return back(0, 6);
    case 'ytd': return (y - 1) + '-12-31';
    case 'year': return back(1, 0);
    case '3y': return back(3, 0);
    case '5y': return back(5, 0);
    default: return null;
  }
}

/* חיתוך שורות לטווח (פונקציה טהורה, נבדקת): הבסיס = השורה האחרונה בתאריך
   הבסיס או לפניו. gapDays = כמה ימים הבסיס רחוק מתאריך הבסיס האמיתי —
   בנתונים יומיים עד כמה ימים (סופ"ש/חג); בנתוני תקופות — חודשים, ואז
   התשואה לטווח לא ניתנת לחישוב אמיתי. */
function pfSliceRange(rows, range) {
  if (!rows || !rows.length) return { rows: [], gapDays: 0 };
  const cutoff = pfRangeCutoff(rows[rows.length - 1].date, range);
  if (!cutoff || rows[0].date >= cutoff) return { rows: rows.slice(), gapDays: 0 };
  let bi = 0;
  for (let i = 0; i < rows.length; i++) if (rows[i].date <= cutoff) bi = i;
  return { rows: rows.slice(bi), gapDays: pfDaysBetween(rows[bi].date, cutoff) };
}

/* ימים בין שני תאריכי ISO (ערך מוחלט). מקומי ב־app.js — לא תלוי ב־returns.js
   (טלפון יכול לרגע להריץ app.js חדש עם returns.js ישן מהמטמון). */
function pfDaysBetween(a, b) {
  const pa = String(a).split('-'), pb = String(b).split('-');
  return Math.abs(Math.round((Date.UTC(+pb[0], +pb[1] - 1, +pb[2]) - Date.UTC(+pa[0], +pa[1] - 1, +pa[2])) / 86400000));
}

/* תזרימים חיצוניים לפי תאריך, במטבע הבסיס (הפקדה חיובית, משיכה שלילית) —
   לחישוב TWR יומי מ־NAV יומי. */
function ibkrFlowsByDate(data) {
  const out = {};
  for (const c of ((data && data.cashTransactions) || [])) {
    if (!ibkrIsDepositTx(c)) continue;
    const date = String(c.date || '').slice(0, 10);
    const amt = Number(c.amount) || 0;
    const cur = String(c.currency || '').toUpperCase();
    const base = String((data.meta && data.meta.baseCurrency) || 'USD').toUpperCase();
    const fx = (!cur || cur === base) ? 1 : (Number(c.fxToBase) || 0);
    if (!date || !amt || !(fx > 0)) continue;
    out[date] = (out[date] || 0) + amt * fx;
  }
  return out;
}

/* מיקום יחסי (0..1) של כל נקודה על ציר הזמן (פונקציה טהורה, נבדקת).
   תאריך לא תקין -> נופל לפריסה לפי אינדקס. */
function pfTimeFractions(dates) {
  const n = (dates || []).length;
  if (n <= 1) return n ? [0] : [];
  const ts = dates.map((d) => {
    const p = String(d).split('-');
    return Date.UTC(+p[0], +p[1] - 1, +p[2]);
  });
  const t0 = ts[0], t1 = ts[n - 1];
  if (!ts.every((t) => isFinite(t)) || !(t1 > t0)) return dates.map((_, i) => i / (n - 1));
  return ts.map((t) => (t - t0) / (t1 - t0));
}

/* תוויות ציר X (פונקציה טהורה, נבדקת): עד 4 תוויות, בלי כפילויות,
   פורמט לפי אורך הטווח — ימים/חודש לטווח קצר, חודש/שנה לארוך. */
function pfAxisLabels(dates) {
  const n = (dates || []).length;
  if (!n) return [];
  const span = n > 1 ? pfDaysBetween(dates[0], dates[n - 1]) : 0;
  const fmt = (iso) => span <= 120
    ? iso.slice(8, 10) + '/' + iso.slice(5, 7)
    : iso.slice(5, 7) + '/' + iso.slice(2, 4);
  // נקודות תווית לפי זמן (שליש/שני שלישים של הטווח), הקרובה ביותר מכל אחת
  const fr = pfTimeFractions(dates);
  const near = (f) => { let b = 0; for (let i = 1; i < n; i++) if (Math.abs(fr[i] - f) < Math.abs(fr[b] - f)) b = i; return b; };
  const idx = n === 1 ? [0] : [...new Set([0, near(1 / 3), near(2 / 3), n - 1])];
  const out = [];
  for (const i of idx) {
    const text = fmt(dates[i]);
    if (out.length && out[out.length - 1].text === text) continue;
    out.push({ i, text });
  }
  return out;
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

/* ---------------- נתוני IBKR — סנכרון Flex ----------------
   הנתונים נמשכים מ־IBKR דרך Flex Web Service (שרתון Vercel + token שנשמר
   בטלפון בלבד). התשואות הן המספרים הרשמיים של IBKR מהדוח (TWR) — לעולם לא
   משוערות. הנתונים הידניים (DB) לא נפגעים — נתוני IBKR נשמרים בנפרד. */

const LS_IBKR = 'pwa_ibkr_v1';

function ibkrCfg() {
  try { return JSON.parse(localStorage.getItem(LS_IBKR) || 'null') || {}; }
  catch (e) { return {}; }
}
function ibkrSaveCfg(patch) {
  const c = Object.assign({}, ibkrCfg(), patch);
  try { localStorage.setItem(LS_IBKR, JSON.stringify(c)); } catch (e) {}
  return c;
}

function ibkrShowErr(msg) {
  const e = document.getElementById('ibkrErr');
  if (e) { e.textContent = msg; e.classList.remove('hidden'); }
}
function ibkrClearErr() {
  const e = document.getElementById('ibkrErr');
  if (e) { e.textContent = ''; e.classList.add('hidden'); }
}
function ibkrSetBusy(busy) {
  state.ibkrSyncing = !!busy; // v139: עוצר את הטיק החי בזמן סנכרון
  ['ibkrDisconnect', 'ibkrSaveTest', 'ibkrSyncImport'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.disabled = !!busy;
  });
}

/* כתובת ברירת המחדל של השרתון (Vercel, של המשתמש). ניתנת לדריסה בהגדרות. */
const IBKR_PROXY_DEFAULT = 'https://ibkr-proxy-wine.vercel.app';

function ibkrProxyBase() {
  return (((ibkrCfg().proxyUrl || '') || IBKR_PROXY_DEFAULT).trim().replace(/\/+$/, ''));
}

/* מחלק טווח תאריכים לחלקים לפי שנים קלנדריות (פונקציה טהורה, נבדקת).
   מחזיר מערך של {fd, td} בפורמט YYYYMMDD.
   v124: IBKR מסרב (flex_1003 "Statement is not available") לטווח ישן
   שמתחיל באמצע השנה — הוכח מהשטח: 23/09/2023–21/09/2024 נכשל,
   01/01/2023–31/12/2023 עבד. לכן כל חלק מתחיל ב־1 בינואר (חוץ מהראשון,
   שמתחיל בתאריך המבוקש). שנה מעוברת מלאה (366 יום, מעל מגבלת 365):
   1/1–30/12 + 31/12 כחלק נפרד — ההתחלה ב־1/1 היא הצורה שהוכחה, ובמקרה
   הגרוע חסר יום אחד (ומוצגת אזהרה), לא חצי שנה. */
function ibkrDateChunks(startYmd, endYmd) {
  const chunks = [];
  if (!(startYmd <= endYmd)) return chunks;
  for (let y = +startYmd.slice(0, 4); y <= +endYmd.slice(0, 4); y++) {
    const fd = String(y) + '0101' > startYmd ? String(y) + '0101' : startYmd;
    const td = String(y) + '1231' < endYmd ? String(y) + '1231' : endYmd;
    const leapFull = fd === String(y) + '0101' && td === String(y) + '1231' && new Date(y, 1, 29).getMonth() === 1;
    if (leapFull) {
      chunks.push({ fd, td: String(y) + '1230' });
      chunks.push({ fd: String(y) + '1231', td });
    } else {
      chunks.push({ fd, td });
    }
  }
  return chunks;
}

function ibkrYmd(d) {
  return d.getFullYear().toString().padStart(4, '0') +
    (d.getMonth() + 1).toString().padStart(2, '0') +
    d.getDate().toString().padStart(2, '0');
}

/* v136: יום המסחר האחרון שנסגר לפי שעון ניו־יורק, לא ישראל. בחצות בישראל
   עדיין 17:00 באותו יום בניו־יורק — "אתמול" הישראלי הוא היום שעוד לא נגמר,
   ו־IBKR מחזיר עליו flex_1003. מחזיר Date מקומי (לשימוש עם ibkrYmd). */
function ibkrLastClosedDate(now) {
  const n = now || new Date();
  let iso = '';
  try {
    iso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(n);
  } catch (e) {}
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) iso = new Date(n.getTime() - 5 * 3600000).toISOString().slice(0, 10);
  const d = new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
  d.setDate(d.getDate() - 1);
  return d;
}

/* יום החול הקודם ל־YYYYMMDD (מדלג על סופ"ש). */
function ibkrPrevWeekdayYmd(ymd) {
  const d = new Date(+ymd.slice(0, 4), +ymd.slice(4, 6) - 1, +ymd.slice(6, 8));
  do { d.setDate(d.getDate() - 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return ibkrYmd(d);
}

/* תכנית ניסיונות חוזרים לחלק שנכשל — פונקציה טהורה (נבדקת).
   flex_1003 = "הדוח לא זמין" — בדרך כלל IBKR עדיין לא פרסם את הדוח העדכני.
   נותנים לו יותר זמן ויותר ניסיונות. */
function ibkrChunkRetryPlan(err) {
  const notAvail = /flex_1003/.test(String((err && err.message) || err || ''));
  return notAvail ? { attempts: 3, waitMs: 15000 } : { attempts: 2, waitMs: 3000 };
}

/* מושך היסטוריה מ־IBKR (Flex Web Service) במספר בקשות (כל אחת עד 365 יום)
   וממזג למודל הנתונים של returns.js:
   { meta, trades, positions, cashTransactions, navPeriods, cashBalances }.
   - עסקאות: ביטול כפילויות לפי tradeId (כשקיים) או מפתח שדות.
   - פוזיציות/מזומן: רק מהחלק העדכני ביותר שהצליח — לעולם לא מחלק ישן.
   - navPeriods: מסעיפי ChangeInNAV של כל חלק (TWR רשמי, באחוזים).
   החלקים מסתיימים באתמול — IBKR לא מייצר דוח לתאריך שעדיין פתוח. */
/* קצב מול מגבלת IBKR הרשמית (בקשה לשנייה, עד 10 בדקה לטוקן —
   גם SendRequest וגם GetStatement נספרים).
   v121: במקום הפוגה קבועה של 60 שניות בין חלקים (שהפכה משיכה של 10 שנים
   ל־15+ דקות, רובן המתנה ריקה) — מגביל קצב מתגלגל: כל בקשה ל־IBKR עוברת
   דרכו, ועד 8 בקשות בכל חלון של 60 שניות, לפחות 1.5 שניות בין בקשות.
   ממתינים רק כשהתקציב באמת נגמר — אותו מרווח ביטחון (~20% מתחת לתקרה),
   בלי לבזבז דקות כשאין צורך.
   שגיאה 1018 היא הגבלה רגעית — אין בתיעוד Flex "קופסת עונשין של 10 דקות". */
const IBKR_RATE_MAX = 8;             // בקשות מקסימום בחלון (תקרת IBKR: 10)
const IBKR_RATE_WINDOW_MS = 60000;   // חלון מתגלגל של דקה
const IBKR_RATE_MIN_GAP_MS = 1500;   // מרווח מינימלי בין בקשות (IBKR: בקשה לשנייה)
const IBKR_POLL_FIRST_MS = 4000;     // המתנה לפני השאילתה הראשונה — שאילתה מיידית כמעט תמיד "עדיין מייצר"
const IBKR_POLL_DELAY_MS = 6000;     // מרווח בין שאילתות GetStatement (המגביל שומר על התקציב)
const IBKR_POLL_TRIES = 30;          // תקציב ~3 דקות ל"עדיין מייצר" (דוח של שנה נוצר בדרך כלל תוך שניות)
const IBKR_POLL_MAX_FAILS = 3;       // כשלי שרתון/רשת רצופים בזמן ההמתנה לדוח — ואז עוצרים עם שגיאה ברורה
/* מגביל קצב מתגלגל (נבדק עם שעון מדומה). מחזיר פונקציה אסינכרונית שממתינה
   עד שמותר לשלוח בקשה נוספת ואז רושמת אותה. קריאות מקבילות נכנסות לתור. */
function ibkrMakeLimiter(opts) {
  const o = opts || {};
  const max = o.max || IBKR_RATE_MAX;
  const win = o.windowMs || IBKR_RATE_WINDOW_MS;
  const gap = (typeof o.minGapMs === 'number') ? o.minGapMs : IBKR_RATE_MIN_GAP_MS;
  const now = o.now || (() => Date.now());
  const sleep = o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const stamps = [];
  const take = async () => {
    for (;;) {
      const t0 = now();
      while (stamps.length && t0 - stamps[0] >= win) stamps.shift();
      let wait = 0;
      if (stamps.length >= max) wait = stamps[0] + win - t0;
      if (stamps.length) wait = Math.max(wait, stamps[stamps.length - 1] + gap - t0);
      if (wait <= 0) { stamps.push(t0); return; }
      await sleep(wait);
    }
  };
  let chain = Promise.resolve();
  const acquire = () => (chain = chain.then(take, take));
  acquire.stamps = stamps;
  return acquire;
}
/* מגביל אחד לכל האפליקציה — כל הבקשות לאותו טוקן חולקות תקציב
   (גם "בדוק חיבור" וגם סנכרון). */
const IBKR_LIMITER = ibkrMakeLimiter();
const IBKR_HISTORY_YEARS_DEFAULT = 5; // עומק ברירת מחדל למשיכה ראשונה (בשנים)
/* תאריך התחלה למשיכה ראשונה לפי עומק בשנים (פונקציה טהורה, נבדקת).
   מחליף את רצפת 2020 הקבועה: המשתמש בוחר כמה שנים באמת צריך (1–10),
   ותאריך מדויק נשאר בלתי מוגבל. */
function ibkrDepthStartYmd(endD, years) {
  const y = Math.min(10, Math.max(1, parseInt(years, 10) || IBKR_HISTORY_YEARS_DEFAULT));
  const d = (endD && typeof endD.getTime === 'function') ? new Date(endD.getTime()) : new Date();
  // v124: מתחילים ב־1 בינואר של אותה שנה — IBKR מסרב לטווח ישן שמתחיל באמצע
  // השנה (flex_1003). "3 שנים" = לפחות 3 שנים מלאות, מתחילת השנה.
  return String(d.getFullYear() - y) + '0101';
}
/* האם המידע שנמצא מגיע עד קרוב לתחילת הטווח המבוקש (תוך 90 יום) —
   אם כן, ייתכן שהחשבון ישן יותר וכדאי להעמיק. פונקציה טהורה (נבדקת). */
function ibkrReachedStart(earliestIso, startYmd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(earliestIso || '') || !/^\d{8}$/.test(startYmd || '')) return false;
  const s = new Date(+startYmd.slice(0, 4), +startYmd.slice(4, 6) - 1, +startYmd.slice(6, 8));
  s.setDate(s.getDate() + 90);
  const lim = ibkrYmd(s).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  return earliestIso <= lim;
}
/* האם השגיאה מעידה על הגבלת קצב/חסימה זמנית של IBKR — במקרה כזה אסור
   לנסות שוב מיד: כל ניסיון נוסף עלול להאריך את החסימה (פונקציה טהורה, נבדקת). */
function ibkrIsThrottleErr(err) {
  return /flex_1018|no_reference_code|rate_limited/i.test(String((err && err.message) || err || ''));
}
/* נעילת טוקן של IBKR (קוד 1025, לא מתועד): יותר מדי ניסיונות יצירת דוח
   כושלים — אסור לנסות שוב כלל, רק להמתין שעות (ניסיון מוקדם מאריך את הנעילה).
   נגרם מניסיונות SendRequest חוזרים במקום לשאול את אותו קוד דוח. */
function ibkrIsLockoutErr(err) {
  return /flex_1025/i.test(String((err && err.message) || err || ''));
}
/* ברירת מחדל חכמה לתאריך ההתחלה של משיכת Flex (פונקציה טהורה, נבדקת):
   אם כבר יש נתונים מיובאים — מתחילים ביום שאחרי תאריך הסיום שלהם; אחרת —
   שנתיים אחורה. המשתמש יכול לדרוס בכל תאריך עבר.
   v127: לא מתאריך הסיום עצמו — תקופה חדשה שמתחילה ביום שבו הקודמת נגמרה לא
   מזוהה כחופפת במיזוג, שתיהן נשמרות, ויום הגבול נספר פעמיים ברווח וב־TWR
   בכל סנכרון המשך (שוחזר: 19.26% -> 19.74% אחרי סנכרון אחד). */
function ibkrDefaultFromYmd(existingData, endD) {
  const m = (existingData && existingData.meta) || {};
  if (/^\d{4}-\d{2}-\d{2}$/.test(m.toDate || '')) {
    const p = m.toDate.split('-');
    return ibkrYmd(new Date(+p[0], +p[1] - 1, +p[2] + 1));
  }
  // בדיקת duck-type במקום instanceof — עובד גם כשהתאריך נוצר ב־realm אחר (טסטים)
  const d = (endD && typeof endD.getTime === 'function') ? new Date(endD.getTime()) : new Date();
  d.setFullYear(d.getFullYear() - 2);
  return ibkrYmd(d);
}
/* האם יש לפחות יום חול אחד בטווח YYYYMMDD (כולל) — פונקציה טהורה, נבדקת.
   טווח של סופ"ש בלבד: IBKR לא מפיק עליו דוח (1003), אז אין מה למשוך. */
function ibkrHasWeekday(fromYmd, toYmd) {
  if (!(fromYmd <= toYmd)) return false;
  const d = new Date(+fromYmd.slice(0, 4), +fromYmd.slice(4, 6) - 1, +fromYmd.slice(6, 8));
  for (let i = 0; i < 7 && ibkrYmd(d) <= toYmd; i++) {
    const w = d.getDay();
    if (w !== 0 && w !== 6) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

/* האם יש מידע מיובא כלשהו (פונקציה טהורה, נבדקת). */
function ibkrHasImportedData(d) {
  return !!d && (((d.positions || []).length + (d.trades || []).length + ((d.navPeriods || []).length)) > 0);
}

/* התאריך המוקדם ביותר במידע המיובא (פונקציה טהורה, נבדקת).
   משמש להצעת תאריך התחלה מוקדם יותר כשהמידע מגיע עד רצפת המשיכה האוטומטית. */
function ibkrEarliestDate(d) {
  let min = '';
  const consider = (s) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(s || '') && (!min || s < min)) min = s;
  };
  for (const tr of ((d && d.trades) || [])) consider(tr.date);
  for (const c of ((d && d.cashTransactions) || [])) consider(c.date);
  for (const r of ((d && d.navPeriods) || [])) consider(r.fromDate);
  return min;
}

/* שולף חלק בודד (fd..td) עם ניסיונות חוזרים. מחזיר data, או null כשהחלק נכשל
   (הכשלון נרשם ב־chunkResults, הייבוא ממשיך בלעדיו). */
async function ibkrFetchChunk(fetchFn, proxyUrl, token, queryId, fd, td, chunkResults, pollOpts) {
  let data = null, err = null;
  let plan = { attempts: 2, waitMs: 3000 };
  const stage = (pollOpts && pollOpts.onStage) || null;
  for (let attempt = 0; attempt < plan.attempts && !data; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, plan.waitMs));
    let gotRef = false;
    try {
      if (stage) { try { stage('request', 0); } catch (e) {} }
      const rep = await ibkrRequestReport(fetchFn, proxyUrl, token, queryId, fd, td, pollOpts && pollOpts.limiter);
      gotRef = true;
      data = await ibkrPollStatement(fetchFn, proxyUrl, token, rep.referenceCode, rep.statementUrl, pollOpts);
    } catch (e) {
      err = e;
      // הגבלת קצב או נעילת טוקן של IBKR: לא מנסים שוב — ניסיון נוסף רק מאריך את החסימה/הנעילה
      if (ibkrIsThrottleErr(e) || ibkrIsLockoutErr(e)) break;
      // v122: הדוח כבר הוזמן ונכשל בהמתנה (שרתון/רשת/זמן) — לא מזמינים דוח חדש:
      // SendRequest חוזר לא יעזור, מכפיל את הזמן ומסכן נעילת טוקן (1025).
      // רק 1003 ("עדיין לא פורסם") מצדיק הזמנה חוזרת.
      if (gotRef && !/flex_1003/.test(String((e && e.message) || e || ''))) break;
      plan = ibkrChunkRetryPlan(e);
      // v136: ניסיון הגיבוי (יום מסחר קודם) — פעם אחת בלבד, לא עוד SendRequest
      if (pollOpts && pollOpts.no1003Retry && /flex_1003/.test(String((e && e.message) || e || ''))) break;
    }
  }
  if (data) return data;
  chunkResults.push({ fd, td, ok: false, error: String((err && err.message) || err).slice(0, 120) });
  console.warn('Chunk failed:', fd, td, err && err.message);
  return null;
}
async function ibkrFetchFullHistory(fetchFn, proxyUrl, token, queryId, startYmd, onProgress, opts) {
  const o = opts || {};
  // קצב: ברירת המחדל היא המגביל המתגלגל המשותף (בלי הפוגה קבועה בין חלקים).
  // בדיקות מעבירות chunkGapMs — קצב ידני מהיר במקום המגביל, בלי לישון באמת.
  const manualPace = (typeof o.chunkGapMs === 'number');
  const gapMs = manualPace ? o.chunkGapMs : 0;
  const limiter = ('limiter' in o) ? o.limiter : (manualPace ? null : IBKR_LIMITER);
  const pollOpts = {
    tries: o.pollTries || o.tries, delayMs: o.pollDelayMs || o.delayMs, limiter, sleep: o.sleep, onStage: o.onStage,
    firstDelayMs: (typeof o.pollFirstMs === 'number') ? o.pollFirstMs : (manualPace ? o.chunkGapMs : undefined),
  };
  const endD = o.endDate || ibkrLastClosedDate();
  const endYmd = ibkrYmd(endD);
  // כל המשיכות מקוטעות לחלקי 365 יום מהעבר הרחוק קדימה — זה הנתיב שהוכח
  // כמושך מ־IBKR היסטוריה מלאה (v118), כולל שנים אחורה.
  if (!/^\d{8}$/.test(startYmd || '')) startYmd = ibkrDepthStartYmd(endD, IBKR_HISTORY_YEARS_DEFAULT);
  const chunks = ibkrDateChunks(startYmd, endYmd);
  let latestTd = chunks.length ? chunks[chunks.length - 1].td : '';
  const iso = (y) => y.slice(0, 4) + '-' + y.slice(4, 6) + '-' + y.slice(6, 8);
  const merged = {
    meta: { fromDate: iso(startYmd), toDate: '', baseCurrency: 'USD', kind: 'flex', title: 'IBKR Flex' },
    trades: [], positions: [], cashTransactions: [], navPeriods: [], cashBalances: [],
  };
  const seenTrade = new Set(), seenCash = new Map(), seenNav = new Set(), navDay = new Map();
  const chunkResults = [];
  let latestChunkOk = false, posTd = '', metaTd = '', minFromDate = '', consecFails = 0, anyOk = false;
  const tKey = (tr) => {
    const id = String(tr.tradeId || '').trim();
    if (id) return 'id:' + id;
    return [tr.date, tr.symbol, tr.qty, tr.side, Math.round((Number(tr.price) || 0) * 10000)].join('|');
  };
  // מזהה יציב קודם, אחרת תוכן; ההשוואה מודעת־מופעים (Map סופר)
  const cKey = (c) => {
    const id = String(c.id || c.cashId || c.transactionId || '').trim();
    if (id) return 'id:' + id;
    return [c.date, c.type, Math.round((Number(c.amount) || 0) * 100),
      String(c.description || '').slice(0, 30)].join('|');
  };

  const absorb = (data, fd, td) => {
    anyOk = true;
    const m = (data && data.meta) || {};
    chunkResults.push({
      fd, td, ok: true,
      trades: (data.trades || []).length, cash: (data.cashTransactions || []).length,
      positions: (data.positions || []).length,
    });
    for (const tr of (data.trades || [])) {
      const k = tKey(tr);
      if (!seenTrade.has(k)) { seenTrade.add(k); merged.trades.push(tr); }
    }
    // תנועות מזומן: דדופליקציה מודעת־מופעים — כפילות לגיטימית באותו
    // חלק (אותו יום/סכום/תיאור) נשמרת, חזרה על אותו חלק בחלק הבא מסוננת
    const used = {};
    for (const c of (data.cashTransactions || [])) {
      const k = cKey(c);
      used[k] = (used[k] || 0) + 1;
      const already = seenCash.get(k) || 0;
      if (used[k] > already) { seenCash.set(k, already + 1); merged.cashTransactions.push(c); }
    }
    for (const r of (data.navHistory || [])) {
      const k = (r.fromDate || '') + '|' + (r.toDate || '');
      if (r.fromDate && r.toDate && !seenNav.has(k)) {
        seenNav.add(k);
        merged.navPeriods.push({
          fromDate: r.fromDate, toDate: r.toDate,
          startingValue: r.startingValue, endingValue: r.endingValue,
          twr: r.twr,
          // v125: תזרימים חיצוניים מהדוח — בלעדיהם הפקדות נספרו כרווח
          netFlows: (typeof r.flows === 'number' && isFinite(r.flows)) ? r.flows : 0,
        });
      }
    }
    // v125: NAV יומי — איחוד לפי תאריך (חלק מאוחר גובר ביום חופף)
    for (const d of (data.navDaily || [])) {
      if (d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && isFinite(Number(d.total))) navDay.set(d.date, Number(d.total));
    }
    // פוזיציות/מזומן: רק מהחלק העדכני ביותר — לעולם לא מחלק ישן יותר
    if (td >= posTd) {
      if (data.positions && data.positions.length) { merged.positions = data.positions; posTd = td; }
      if (td === latestTd) {
        latestChunkOk = true;
        // החלק האחרון הצליח: הפוזיציות שלו הן העדכניות (גם אם ריקות — תיק ריק)
        merged.positions = data.positions || [];
        merged.cashBalances = data.cashBalances || [];
        posTd = td;
      }
    }
    // fromDate: התאריך המוקדם ביותר מכל חלק שהצליח — לא תלוי בסדר העיבוד
    // (v123: סבב הניסיון החוזר בסוף מעבד חלקים שלא בסדר כרונולוגי)
    if (m.fromDate && (!minFromDate || m.fromDate < minFromDate)) { minFromDate = m.fromDate; merged.meta.fromDate = m.fromDate; }
    if (td >= metaTd) {
      merged.meta.toDate = m.toDate || merged.meta.toDate;
      merged.meta.baseCurrency = m.baseCurrency || merged.meta.baseCurrency;
      metaTd = td;
    }
  };

  for (let i = 0; i < chunks.length; i++) {
    const { fd, td } = chunks[i];
    if (onProgress) onProgress(i + 1, chunks.length, fd, td);
    // הפוגה ידנית (בדיקות בלבד); בפועל המגביל המתגלגל שומר על הקצב
    if (i > 0 && gapMs > 0) await new Promise((r) => setTimeout(r, gapMs));
    const isLastChunk = i === chunks.length - 1;
    // v137: 1003 על תקופה ישנה לא ישתנה בניסיון חוזר — רק החלק העדכני (דוח שעוד לא פורסם) מקבל ניסיונות
    const data = await ibkrFetchChunk(fetchFn, proxyUrl, token, queryId, fd, td, chunkResults,
      isLastChunk ? pollOpts : Object.assign({}, pollOpts, { no1003Retry: true }));
    if (data) { consecFails = 0; absorb(data, fd, td); }
    else {
      const lastRes = chunkResults[chunkResults.length - 1];
      // v137: 1003 לפני שחלק כלשהו החזיר נתונים = שנים שלפני פתיחת החשבון (עומק 5 שנים
      // לחשבון בן 3). לא כשל — ממשיכים קדימה, לא נספר ברצף הכשלונות שעוצר את המשיכה.
      if (!anyOk && !isLastChunk && lastRes && /flex_1003/.test(lastRes.error || '')) { lastRes.beforeStart = true; continue; }
      consecFails++;
      // נעילת טוקן — עוצרים מיד, אפילו לא מחכים לכשלון שני
      if (lastRes && ibkrIsLockoutErr(lastRes.error)) { merged._locked = true; break; }
      // שני כשלונות רצופים — עוצרים במקום לבזבז דקות ובקשות על חלקים נוספים.
      // "הגבלת קצב" רק כשזו באמת השגיאה; אחרת ההודעה מציגה את הקוד האמיתי
      if (consecFails >= 2) {
        merged._stopped = true;
        if (lastRes && ibkrIsThrottleErr(lastRes.error)) merged._throttled = true;
        break;
      }
    }
  }
  // v136: החלק העדכני נכשל ב־1003 — הדוח של היום האחרון עוד לא פורסם (IBKR
  // מפרסם בבוקר בארה"ב). ניסיון אחד שמסתיים יום מסחר אחד קודם, במקום להפיל
  // את כל הסנכרון. סנכרון ההמשך הבא ישלים את היום החסר.
  const lastChunk = chunks[chunks.length - 1];
  const lastRes = lastChunk && chunkResults.find((c) => !c.ok && c.fd === lastChunk.fd && c.td === lastChunk.td);
  if (!merged._locked && !merged._throttled && lastRes && /flex_1003/.test(lastRes.error || '')) {
    const td2 = ibkrPrevWeekdayYmd(lastChunk.td);
    if (td2 >= lastChunk.fd) {
      const data = await ibkrFetchChunk(fetchFn, proxyUrl, token, queryId, lastChunk.fd, td2, [],
        Object.assign({}, pollOpts, { no1003Retry: true }));
      if (data) {
        chunkResults.splice(chunkResults.indexOf(lastRes), 1);
        latestTd = td2;
        absorb(data, lastChunk.fd, td2);
      }
    }
  }
  // v123: חלק בודד יכול ליפול מסיבה חולפת (קור-סטארט של השרתון, הפרעת רשת
  // רגעית) בלי שני כשלונות רצופים שהיו עוצרים את המשיכה — ואז נשמט בשקט,
  // גם כשהיבוא "הושלם" כי החלק האחרון הצליח. סבב ניסיון נוסף אחד לכל חלק
  // שנכשל (לא נעילה/הגבלת קצב), אחרי שכל שאר החלקים כבר נמשכו.
  if (!merged._locked && !merged._stopped) {
    // מריצים מחדש רק חלקים שקיבלו ניסיון יחיד ונשברו מיד (v122: כשל אחרי
    // reference code, לא 1003) — אלה שסבלו מתקלה חולפת בלי סיכוי אמיתי.
    // לא: 1003 (כבר קיבל את מכסת הניסיונות המלאה של ibkrChunkRetryPlan),
    // ולא throttle (1018/no_reference_code — ניסיון נוסף רק מאריך את החסימה).
    const stillFailed = chunkResults.filter((c) => !c.ok && !/flex_1003/.test(c.error || '') && !ibkrIsThrottleErr(c.error));
    for (const f of stillFailed) {
      const retryResults = [];
      const data = await ibkrFetchChunk(fetchFn, proxyUrl, token, queryId, f.fd, f.td, retryResults, pollOpts);
      if (data) {
        const idx = chunkResults.indexOf(f);
        if (idx >= 0) chunkResults.splice(idx, 1);
        absorb(data, f.fd, f.td);
      }
    }
  }
  merged.trades.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  merged.cashTransactions.sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  merged.navPeriods.sort((a, b) => (a.fromDate < b.fromDate ? -1 : 1));
  merged.navDaily = [...navDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([date, total]) => ({ date, total }));
  // v137: שנים ריקות שלפני החשבון — לא כשל ולא "פער" (אם שום חלק לא הצליח, נשארות כשלונות)
  if (anyOk) for (const c of chunkResults) if (c.beforeStart) { c.ok = true; c.noData = true; }
  merged._chunks = chunkResults;
  merged.latestChunkOk = latestChunkOk;
  merged.positionsAsOf = posTd;
  return merged;
}

/* האם מותר לייבא את תוצאת הסנכרון — פונקציה טהורה (נבדקת).
   חוסמת יבוא כשהחלק העדכני נכשל: אסור להתקין פוזיציות ישנות כעדכניות. */
function ibkrSyncIsComplete(data) {
  return !!(data && data.latestChunkOk);
}

/* מבקש מ־IBKR (דרך השרתון) ליצור דוח Flex. מחזיר { referenceCode, statementUrl }.
   fd/td אופציוניים (YYYYMMDD) לדריסת טווח התאריכים — עד 365 יום לבקשה. */
async function ibkrRequestReport(fetchFn, proxyUrl, token, queryId, fd, td, limiter) {
  const body = { token, queryId };
  if (/^\d{8}$/.test(fd || '') && /^\d{8}$/.test(td || '')) {
    body.fd = fd; body.td = td;
  }
  if (limiter) await limiter();
  const r = await fetchWithTimeout(fetchFn, proxyUrl + '/api/flex-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }, 45000);
  let j = null;
  try { j = await r.json(); } catch (e) {}
  if (!j || j.ok !== true || !j.referenceCode) {
    const detail = j && j.error
      ? t('proxyPrefix') + j.error + (j.message ? ' — ' + j.message : '')
      : t('proxyBadResponse');
    throw new Error(detail);
  }
  return j;
}

/* שואל את השרתון שוב ושוב עד שהדוח מוכן (IBKR מייצר אותו בדיליי).
   מחזיר את data המפורסר. הטוקן עובר ב־body בלבד, לא ב־URL. */
async function ibkrPollStatement(fetchFn, proxyUrl, token, code, statementUrl, opts) {
  const o = opts || {};
  const tries = o.tries || IBKR_POLL_TRIES;
  const delayMs = o.delayMs || IBKR_POLL_DELAY_MS;
  const sleep = o.sleep || ((ms) => new Promise((res) => setTimeout(res, ms)));
  const firstMs = (typeof o.firstDelayMs === 'number') ? o.firstDelayMs : Math.min(IBKR_POLL_FIRST_MS, delayMs);
  const proxyErr = (j) => new Error(j.error ? t('proxyPrefix') + j.error + (j.message ? ' — ' + j.message : '') : t('proxyErr'));
  let netErr = null, fails = 0, httpStatus = 0;
  // IBKR צריך כמה שניות לייצר את הדוח — שאילתה מיידית רק שורפת בקשה מהתקציב
  if (firstMs > 0) await sleep(firstMs);
  for (let i = 0; i < tries; i++) {
    let j = null;
    httpStatus = 0; netErr = null;
    if (o.limiter) await o.limiter();
    if (o.onStage) { try { o.onStage('wait', i + 1); } catch (e) {} }
    try {
      const r = await fetchWithTimeout(fetchFn, proxyUrl + '/api/flex-statement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, code, statementUrl: statementUrl || '' }),
      }, 40000);
      httpStatus = (r && r.status) || 0;
      j = await r.json();
    } catch (e) { netErr = e; }
    if (j && j.ok === true && j.status === 'ready' && j.data) return j.data;
    if (j && j.ok === true) { fails = 0; await sleep(delayMs); continue; } // עדיין מייצר
    // v122: כשל — לא "עדיין מייצר". שגיאת Flex/פרמטרים נזרקת מיד; כשל שרתון/רשת
    // (תשובה לא־JSON כמו timeout של Vercel, ibkr_http_*, fetch_failed) מקבל עד
    // IBKR_POLL_MAX_FAILS ניסיונות רצופים — במקום לחכות בשקט עשרות דקות.
    const errCode = (j && j.error) || '';
    const transient = !j || /^(ibkr_http_(0|5\d\d)|fetch_failed|timeout)$/.test(errCode);
    if (!transient) throw proxyErr(j);
    fails++;
    if (fails >= IBKR_POLL_MAX_FAILS) {
      if (j) throw proxyErr(j);
      throw new Error(t('netPrefix') + (httpStatus && httpStatus !== 200 ? 'proxy_http_' + httpStatus : (netErr ? netErr.message : 'proxy_http_0')));
    }
    await sleep(delayMs);
  }
  throw new Error(t('reportTimeout'));
}

/* ממפה קוד שגיאת Flex/שרתון להודעה מובנת למשתמש. */
function ibkrFriendlyErr(msg) {
  const m = String(msg || '').match(/flex_(\d+)|ibkr_http_(\d+)|no_reference_code|rate_limited|bad_params|fetch_failed/);
  const code = m ? (m[1] || m[2] || m[0]) : '';
  switch (code) {
    case '1001': case '1004': case '1009': case '1019': case '1021':
      return t('ibkrErr1001');
    case '1003': // הדוח המבוקש עדיין לא פורסם ב־IBKR — לא בעיית חיבור
      return t('ibkrErr1003');
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
    case '1018': case 'rate_limited': case 'no_reference_code':
      return t('ibkrErrMany');
    case '1025': // נעילת טוקן — אסור לנסות שוב, רק להמתין שעות
      return t('ibkrErrLocked');
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

function renderIbkrCard() {
  const cfg = ibkrCfg();
  // שחזור ערכי שדות הסנכרון (token נשמר בטלפון בלבד)
  const px = document.getElementById('ibkrProxy');
  const tk = document.getElementById('ibkrToken');
  const qd = document.getElementById('ibkrQuery');
  if (px && !px.value) px.value = cfg.proxyUrl || IBKR_PROXY_DEFAULT;
  if (tk && !tk.value) tk.value = cfg.token || '';
  if (qd && !qd.value) qd.value = cfg.queryId || '';
  // v128: הגדרות החיבור מקופלות — נפתחות לבד רק כשעוד אין token/Query ID
  const cdet = document.getElementById('ibkrConnDetails');
  if (cdet && !(cfg.token && cfg.queryId)) cdet.open = true;
  const data = cfg.data;
  // עומק היסטוריה — בחירת המשתמש (נשמרת בטלפון), ברירת מחדל 5 שנים
  const dhe = document.getElementById('ibkrHistoryDepth');
  if (dhe) {
    const dv = String(cfg.historyYears || IBKR_HISTORY_YEARS_DEFAULT);
    dhe.value = /^(1|2|3|5|10)$/.test(dv) ? dv : String(IBKR_HISTORY_YEARS_DEFAULT);
  }
  // תאריך התחלה למשיכה — בחירת המשתמש (נשמרת בטלפון) או ברירת מחדל חכמה
  const fde = document.getElementById('ibkrFromDate');
  if (fde && !fde.value) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(cfg.fromDate || '')) {
      fde.value = cfg.fromDate;
    } else if (ibkrHasImportedData(data)) {
      // יש נתונים — ברירת המחדל: המשך מהנקודה שהם נגמרו
      const yest = ibkrLastClosedDate();
      fde.value = ibkrDefaultFromYmd(data, yest).replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
    }
    // אחרת השדה נשאר ריק = משיכה עמוקה אוטומטית עד קצה ההיסטוריה
  }
  const has = !!(data && (data.positions || []).length + (data.trades || []).length + (data.navPeriods || []).length);
  const s = document.getElementById('ibkrStatus');
  if (s) {
    if (!has) {
      s.textContent = t('ibkrNever');
    } else {
      const meta = data.meta || {};
      s.textContent = t('ibkrSyncStatus', {
        a: meta.fromDate ? fmtDateIL(meta.fromDate) : '—',
        b: meta.toDate ? fmtDateIL(meta.toDate) : '—',
        time: cfg.lastSync ? fmtTimeIL(cfg.lastSync) : '—',
      });
    }
  }
  const d = document.getElementById('ibkrData');
  if (d) {
    d.textContent = has
      ? t('ibkrDataSummary', {
          n: (data.positions || []).length,
          m: (data.trades || []).length,
          k: (data.cashTransactions || []).length,
        })
      : '';
  }
  // התראה בולטת כשהדוח חסר TWR רשמי — בלי זה אין תשואות, רק סכומים
  const w = document.getElementById('ibkrNavWarn');
  if (w) {
    const miss = has && (typeof rSourceKind === 'function') && rSourceKind(data) !== 'official';
    w.classList.toggle('hidden', !miss);
    if (miss) w.textContent = t('navWarn');
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
  // v141: פוזיציות ידניות שנוספו אחרי הצילום — לא נמחקות בניתוק
  const manual = DB.positions.filter((p) => p.src === 'manual');
  DB.positions.length = 0;
  DB.positions.push(...(snap.positions || []));
  for (const m of manual) if (!DB.positions.some((p) => p.sym === m.sym)) DB.positions.push(m);
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
    // מסנן פירוט LOT גולמי (כפילות שורות, תיקון באג כפילות v68) — אבל שורות Lot
    // מצורפות (lots: מספר הלוטים) הן פוזיציה אחת מאוחדת ומתקבלות.
    if (p.levelOfDetail && p.levelOfDetail !== 'SUMMARY' && !p.lots) { skipped++; continue; }
    const qty = Number(p.qty) || 0;
    const sym = String(p.symbol || '').trim();
    const _a = String(p.asset || '').toUpperCase();
    const isStock = !_a || _a === 'STK' || _a === 'STOCKS'; // Flex: 'STK' (ונתונים ישנים: 'Stocks')
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

/* ---------------- v141: אחזקות ידניות — לפי מחיר ממוצע או לפי עסקאות ----------------
   • לפי מחיר ממוצע: כמות + מחיר ממוצע. נכלל בשווי וברווח; בלי תאריכים — לא בתשואה
     לאורך זמן.
   • לפי עסקאות (DB.manualTrades): קנייה/מכירה עם תאריך, כמות, מחיר ועמלה. הכמות
     והממוצע נגזרים מהעסקאות (עלות ממוצעת, כולל רווח ממומש במכירות) ומשתתפים בגרף
     הביצועים ובתשואה — כמו נתוני IBKR.
   פוזיציה ידנית = src:'manual' (fromTrades:true כשהיא מעסקאות). סנכרון IBKR מחליף רק
   את הפוזיציות שלו — הידניות נשמרות. מניה שמוחזקת ב־IBKR לא ניתנת להזנה ידנית;
   עסקאות ידניות של מניה ש־IBKR התחיל להחזיק "מוצללות" (לא נספרות, מסומנות). */

function mtList() {
  if (!Array.isArray(DB.manualTrades)) DB.manualTrades = [];
  return DB.manualTrades;
}

function mtNorm(x) {
  const r = x || {};
  return {
    id: String(r.id || ''),
    date: String(r.date || '').slice(0, 10),
    sym: String(r.sym || '').trim().toUpperCase(),
    side: String(r.side || '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
    qty: Math.abs(Number(r.qty) || 0),
    price: Math.abs(Number(r.price) || 0),
    fee: Math.abs(Number(r.fee) || 0),
  };
}

/* כרונולוגי; באותו יום — קניות לפני מכירות, ואז לפי סדר ההזנה. טהורה. */
function mtSorted(trades, sym) {
  return (trades || []).map((x, i) => [mtNorm(x), i])
    .filter((e) => !sym || e[0].sym === sym)
    .sort((a, b) => {
      if (a[0].date !== b[0].date) return a[0].date < b[0].date ? -1 : 1;
      if (a[0].side !== b[0].side) return a[0].side === 'BUY' ? -1 : 1;
      return a[1] - b[1];
    })
    .map((e) => e[0]);
}

/* מצב האחזקה מתוך העסקאות — שיטת עלות ממוצעת (כמו ברוקרים): קנייה מוסיפה עלות
   (כולל עמלה); מכירה מורידה עלות לפי הממוצע, ורושמת רווח ממומש (תמורה − עמלה −
   עלות). upto (YYYY-MM-DD, אופציונלי) = מצב בסוף היום הזה. טהורה. */
function mtPosition(trades, sym, upto) {
  let shares = 0, cost = 0, realized = 0, first = '';
  for (const x of mtSorted(trades, sym)) {
    if (upto && x.date > upto) break;
    if (!first) first = x.date;
    if (x.side === 'BUY') { shares += x.qty; cost += x.qty * x.price + x.fee; }
    else {
      const q = Math.min(x.qty, shares);
      const avgc = shares > 0 ? cost / shares : 0;
      realized += q * x.price - x.fee - avgc * q;
      cost -= avgc * q;
      shares -= q;
    }
    if (shares < 1e-9) { shares = 0; cost = 0; }
  }
  return { shares: shares, cost: cost, avg: shares > 0 ? cost / shares : 0, realized: realized, firstDate: first };
}

/* ולידציה לעסקה חדשה/ערוכה (replaceId) — מחזירה הודעת שגיאה או null. בודקת גם
   שאף מכירה (של אותה מניה, בכל נקודה בזמן) לא עוברת את הכמות שמוחזקת. טהורה. */
function mtValidate(trades, cand, replaceId, today) {
  const c = mtNorm(cand);
  if (!/^[A-Z][A-Z0-9.\-]{0,9}$/.test(c.sym)) return t('errSymInvalid');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date) || isNaN(Date.parse(c.date)) || c.date > (today || todayISO())) return t('mtErrDate');
  if (!(c.qty > 0)) return t('mtErrQty');
  if (!(c.price > 0)) return t('mtErrPrice');
  const rest = (trades || []).filter((x) => !replaceId || String(x.id) !== String(replaceId));
  return mtOversold(rest.concat([c]), c.sym) ? t('mtErrOversell') : null;
}

function mtOversold(trades, sym) {
  let shares = 0;
  for (const x of mtSorted(trades, sym)) {
    if (x.side === 'BUY') shares += x.qty;
    else { if (x.qty > shares + 1e-9) return true; shares -= x.qty; }
  }
  return false;
}

/* תזרים הכסף שנכנס לאחזקות הידניות לפי תאריך — קנייה (+עלות כולל עמלה),
   מכירה (−תמורה נטו). בתשואה זה כמו הפקדה/משיכה, כדי שקנייה לא תיראה כרווח. */
function mtFlowsByDate(trades) {
  const out = {};
  for (const x of mtSorted(trades)) {
    const f = x.side === 'BUY' ? x.qty * x.price + x.fee : -(x.qty * x.price - x.fee);
    out[x.date] = (out[x.date] || 0) + f;
  }
  return out;
}

/* מניה עם עסקאות ידניות שמוחזקת ממקור אחר (IBKR / מחיר ממוצע) — העסקאות מוצללות. */
function mtShadowed(sym, positions) {
  const p = (positions || POSITIONS).find((x) => x.sym === sym);
  return !!(p && !p.fromTrades);
}
function mtActiveTrades() {
  return mtList().filter((x) => !mtShadowed(mtNorm(x).sym));
}

/* מסנכרן את רשימת הפוזיציות עם העסקאות (במקום — POSITIONS הוא DB.positions):
   כמות/ממוצע מחושבים מחדש; מניה שנמכרה כולה יורדת מהרשימה (הרווח הממומש שלה
   נשאר בחישובים). לא נוגע בפוזיציות IBKR או לפי מחיר ממוצע. */
function mtSyncPositions() {
  const trades = mtList();
  const syms = [...new Set(trades.map((x) => mtNorm(x).sym))];
  for (const sym of syms) {
    const i = POSITIONS.findIndex((p) => p.sym === sym);
    const cur = i >= 0 ? POSITIONS[i] : null;
    if (cur && !cur.fromTrades) continue;
    const st = mtPosition(trades, sym);
    if (st.shares > 0) {
      if (cur) { cur.shares = st.shares; cur.avg = st.avg; }
      else POSITIONS.push({ sym: sym, name: sym, full: '', shares: st.shares, avg: st.avg, src: 'manual', fromTrades: true });
    } else if (cur) POSITIONS.splice(i, 1);
  }
  for (let i = POSITIONS.length - 1; i >= 0; i--) {
    if (POSITIONS[i].fromTrades && !syms.includes(POSITIONS[i].sym)) POSITIONS.splice(i, 1);
  }
}

/* במצב IBKR: פוזיציה שלא הגיעה מהדוח = ידנית (נוספה ביד לפני v141 — למשל GOOG).
   מסמן src:'manual' כדי שתיכלל בחישובים ותישמר בסנכרון. מחזיר כמה סומנו. */
function markManualPositions() {
  if (!isIbkrMode()) return 0;
  const data = ibkrCfg().data;
  if (!data) return 0;
  const ib = {};
  for (const p of ibkrMapImport(data).positions) ib[p.sym] = true;
  let n = 0;
  for (const p of POSITIONS) {
    if (!p.src && !ib[p.sym]) { p.src = 'manual'; n++; }
  }
  return n;
}

/* שווי ורווח (דולר) של האחזקות הידניות: לפי ממוצע — (מחיר − ממוצע) × כמות;
   לפי עסקאות — רווח ממומש + (שווי − עלות שנותרה). trades = עסקאות פעילות בלבד.
   missing = מניות ידניות בלי מחיר (לא נספרות). טהורה. */
function manualTotalsUSD(positions, trades, quotes, fx) {
  let value = 0, gain = 0, avgOnly = 0, missing = 0;
  const priceOf = (sym) => { const q = (quotes || {})[sym]; return q && q.close > 0 ? q.close : null; };
  // v142: מניה ישראלית — סכומים בשקלים, מומרים לדולר בשער הנוכחי
  const usd = (v, sym) => nativeToUSD(v, sym, fx);
  for (const p of (positions || [])) {
    if (p.src !== 'manual') continue;
    const px = priceOf(p.sym);
    if (!p.fromTrades) avgOnly++;
    const v = px === null ? null : usd(px * p.shares, p.sym);
    if (v === null) { missing++; continue; }
    value += v;
    if (!p.fromTrades) gain += usd((px - (Number(p.avg) || 0)) * p.shares, p.sym);
  }
  for (const sym of new Set((trades || []).map((x) => mtNorm(x).sym))) {
    const st = mtPosition(trades, sym);
    let g;
    if (st.shares > 0) {
      const px = priceOf(sym);
      if (px === null) continue;
      g = usd(st.realized + px * st.shares - st.cost, sym);
    } else g = usd(st.realized, sym);
    if (g !== null) gain += g;
  }
  return { value: value, gain: gain, avgOnly: avgOnly, missing: missing };
}

/* TWR משולב: IBKR + אחזקות לפי עסקאות. עד היום שלפני העסקה הידנית הראשונה —
   הסדרה של IBKR כמו שהיא (רשמית/מעוגנת); מאז — תשואה יומית על הסכום:
     r_t = (NAV_t + M_t − F_t − G_t) / (NAV_{t−1} + M_{t−1}) − 1
   M = שווי הידניות בסגירה (כמות באותו יום × סגירה), F = הפקדות IBKR, G = כסף
   שנכנס לידניות (קנייה +, מכירה −) — שניהם בחלון (t−1, t], כך שסופ"ש לא נבלע.
   דורש NAV יומי (baseRows מסדרה יומית). מחזיר null אם אי אפשר (אין NAV יומי
   שמכסה את העסקה הראשונה / חסרה היסטוריית מחיר). טהורה. */
function rowsWithManualTwr(baseRows, navDaily, ibkrFlows, trades, histOf, fxOf) {
  const tr = mtSorted(trades);
  // v142: מניה בשקלים — שווי ותזרים מומרים לדולר בשער של אותו יום
  const toU = (v, sym, date) => {
    if (symCur(sym) !== 'ILS') return v;
    const r = fxOf ? fxOf(date) : null;
    return r > 0 ? v / r : null;
  };
  if (!tr.length) return baseRows;
  const nav = (navDaily || []).filter((d) => d && /^\d{4}-\d{2}-\d{2}$/.test(d.date || '') && isFinite(Number(d.total)))
    .slice().sort((a, b) => (a.date < b.date ? -1 : 1));
  const first = tr[0].date;
  if (!nav.length || !(baseRows || []).length) return null;
  // כל העסקאות הידניות אחרי סוף נתוני IBKR — תקופת IBKR לא מושפעת
  if (first > nav[nav.length - 1].date) return baseRows;
  let s = -1;
  for (let i = 0; i < nav.length; i++) if (nav[i].date < first) s = i;
  if (s < 0) return null; // עסקה ידנית לפני תחילת ה־NAV היומי — אין בסיס לשילוב
  let seamV = null;
  for (const r of baseRows) if (r.date <= nav[s].date) seamV = r.value;
  if (!(seamV > 0)) return null;
  const syms = [...new Set(tr.map((x) => x.sym))];
  const mFlows = {};
  for (const x of tr) {
    const f = toU(x.side === 'BUY' ? x.qty * x.price + x.fee : -(x.qty * x.price - x.fee), x.sym, x.date);
    if (f === null) return null;
    mFlows[x.date] = (mFlows[x.date] || 0) + f;
  }
  const mVal = (date) => {
    let v = 0;
    for (const sym of syms) {
      const sh = mtPosition(tr, sym, date).shares;
      if (!(sh > 0)) continue;
      const c = closeOnOrBefore(histOf(sym) || [], date);
      if (!(c > 0)) return null;
      const u = toU(sh * c, sym, date);
      if (u === null) return null;
      v += u;
    }
    return v;
  };
  const inWin = (map, a, b) => {
    let f = 0;
    for (const k of Object.keys(map || {})) if (k > a && k <= b) f += Number(map[k]) || 0;
    return f;
  };
  // v142: חלק IBKR לפי הסדרה המעוגנת לרשמי (לא NAV גולמי) — בלי עסקאות ידניות
  // התוצאה זהה בדיוק לרשמית; רק הידניות משנות אותה:
  //   r_t = [NAV_{t−1}·(1+r_IBKR) + M_t − G_t] / (NAV_{t−1} + M_{t−1}) − 1
  const baseAt = {};
  for (const r of baseRows) baseAt[r.date] = r.value;
  const out = baseRows.filter((r) => r.date <= nav[s].date);
  let v = seamV;
  let prevM = mVal(nav[s].date) || 0;
  for (let i = s + 1; i < nav.length; i++) {
    const m = mVal(nav[i].date);
    if (m === null) return null;
    const navPrev = Number(nav[i - 1].total), navCur = Number(nav[i].total);
    const b0 = baseAt[nav[i - 1].date], b1 = baseAt[nav[i].date];
    const rIb = (b0 > 0 && b1 > 0) ? b1 / b0 - 1
      : (navPrev > 0 ? (navCur - inWin(ibkrFlows, nav[i - 1].date, nav[i].date)) / navPrev - 1 : null);
    if (rIb === null || !(navPrev + prevM > 0)) return null;
    const g = inWin(mFlows, nav[i - 1].date, nav[i].date);
    v *= (navPrev * (1 + rIb) + m - g) / (navPrev + prevM);
    out.push({ date: nav[i].date, value: v });
    prevM = m;
  }
  return out;
}

/* סדרת התשואה של מצב IBKR — עם עסקאות ידניות אם יש. kind:
   'official' (אין עסקאות ידניות פעילות), 'combined', 'needsDaily' (אין NAV יומי
   מתאים / מטבע בסיס לא דולר), 'loading' (חסרה היסטוריית מחיר של מניה ידנית). */
function ibkrReturnRows(data) {
  const flows = ibkrFlowsByDate(data);
  const base = (typeof rCombinedTwrSeries === 'function')
    ? rCombinedTwrSeries(rNavPeriods(data), data.navDaily, flows)
    : rTwrIndexSeries(rNavPeriods(data));
  const trades = mtActiveTrades();
  if (!trades.length) return { rows: base, kind: 'official' };
  if (ibkrBaseCur(data) !== 'USD' || !(data.navDaily || []).length) return { rows: base, kind: 'needsDaily' };
  const tSyms = [...new Set(trades.map((x) => mtNorm(x).sym))];
  const missing = tSyms.filter((sym) => !(state.hist[sym] || []).length);
  const needFx = tSyms.some((sym) => symCur(sym) === 'ILS') && !fxHistCache;
  if (missing.length || needFx) return { rows: base, kind: 'loading', missing: missing, needFx: needFx };
  const rows = rowsWithManualTwr(base, data.navDaily, flows, trades, (sym) => state.hist[sym], (d) => fxOnOrBefore(d));
  if (!rows) return { rows: base, kind: 'needsDaily' };
  return { rows: rows, kind: rows === base ? 'official' : 'combined', base: base };
}

/* v143: כותרת התשואה המשולבת — על אותה תקופה כמו הרשמית (מתחילת החשבון), לא
   מתחילת ה־NAV היומי. כשה־NAV היומי מתחיל אחרי פתיחת החשבון (למשל 09/2023 מול
   01/2023), last/first של הסדרה מודד תקופה קצרה יותר — והכותרת "עם" ו"בלי"
   מניה ידנית לא היו ברות השוואה. הסדרות זהות עד העסקה הידנית, אז ההשפעה של
   הידניות = יחס הערך האחרון; מכפילים בו את הרשמי. טהורה. */
function combinedHeadlineTwr(officialPct, rows, base) {
  if (!rows || !rows.length || !base || !base.length) return null;
  const k = rows[rows.length - 1].value / base[base.length - 1].value;
  if (!(k > 0) || !isFinite(k)) return null;
  if (officialPct === null || officialPct === undefined || !isFinite(officialPct)) {
    return rows[0].value > 0 ? (rows[rows.length - 1].value / rows[0].value - 1) * 100 : null;
  }
  return ((1 + officialPct / 100) * k - 1) * 100;
}

/* ---------------- v146: שני מאגרים — ידני מול IBKR, איפוס נפרד ---------------- */
/* הפקדה מ־IBKR: מתויגת src:'ibkr' (מ־v146), ורשומות ישנות מזוהות בתאריך ISO
   (ibkrMapDeposits כותב YYYY-MM-DD; הטופס הידני כותב DD/MM/YYYY). טהורה. */
function isIbkrDeposit(d) {
  return !!d && (d.src === 'ibkr' || /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')));
}
/* פוזיציה מ־IBKR: במצב IBKR — כל מה שלא סומן ידני. */
function isIbkrPosition(p, ibkrMode) { return !!p && !!ibkrMode && p.src !== 'manual'; }

/* איפוס הנתונים הידניים — במקום, על db. נתוני IBKR ורשימת המעקב נשארים. טהורה. */
function resetManualData(db, ibkrMode) {
  const keepPos = (db.positions || []).filter((p) => isIbkrPosition(p, ibkrMode));
  db.positions.length = 0; db.positions.push(...keepPos);
  const keepDep = (db.deposits || []).filter(isIbkrDeposit);
  db.deposits.length = 0; db.deposits.push(...keepDep);
  db.manualTrades = [];
  if (Array.isArray(db.pensionFunds)) db.pensionFunds.length = 0;
  if (Array.isArray(db.pensionDeposits)) db.pensionDeposits.length = 0;
  if (!ibkrMode) db.cash = { usd: 0, ils: 0 };
  delete db.ibkrSnapshot;
}

/* איפוס נתוני IBKR — במקום. הנתונים הידניים נשארים; התיק עובר למצב ידני. טהורה. */
function resetIbkrData(db, ibkrMode) {
  const keepPos = (db.positions || []).filter((p) => !isIbkrPosition(p, ibkrMode));
  db.positions.length = 0; db.positions.push(...keepPos);
  const keepDep = (db.deposits || []).filter((d) => !isIbkrDeposit(d));
  db.deposits.length = 0; db.deposits.push(...keepDep);
  if (ibkrMode) db.cash = { usd: 0, ils: 0 }; // המזומן במצב IBKR הגיע מהדוח
  delete db.ibkrSnapshot;
  db.source = 'manual';
}

function doResetManual() {
  if (!confirm(t('resetManualConfirm'))) return;
  resetManualData(DB, isIbkrMode());
  saveDB(); renderAll();
  flash(t('resetManualDone'));
}
function doResetIbkr() {
  const hasIbkr = isIbkrMode() || !!ibkrCfg().data || DEPOSITS.some(isIbkrDeposit);
  if (!hasIbkr) { flash(t('resetIbkrNone')); return; }
  if (!confirm(t('resetIbkrConfirm'))) return;
  resetIbkrData(DB, isIbkrMode());
  ibkrSaveCfg({ lastSync: 0, data: null }); // החיבור (token/Query ID) נשאר — אפשר לסנכרן מחדש
  saveDB(); renderAll();
  try { renderIbkrCard(); } catch (e) {}
  flash(t('resetIbkrDone'));
}

/* ---------------- v146: תיק דמו ---------------- */
/* נבנה ממחירי סגירה אמיתיים (Yahoo), כך שהמחיר החי, הגרפים והתשואות עקביים.
   "לוהטות" = המומנטום החזק ביותר ב־6 החודשים האחרונים מתוך רשימת מועמדים,
   בתנאי שהן גם מעל המחיר של לפני 18 חודשים. הכל ידני: עסקאות, הפקדות, מזומן, פנסיה. */
const LS_PREDEMO = 'pwa_predemo_v1';
const DEMO_US = ('NVDA PLTR AVGO META TSM AMD NFLX MSFT AMZN GOOGL ORCL MU TSLA APP CRWD ANET LLY COST SHOP UBER').split(' ');
const DEMO_TA = ('ESLT.TA LUMI.TA POLI.TA NVMI.TA TSEM.TA PHOE.TA DSCT.TA TEVA.TA').split(' ');
const DEMO_US_BUDGET = [9000, 7500, 6500, 6000, 5000, 4500]; // דולר לכל מניה
const DEMO_TA_BUDGET = [26000, 18000];                        // שקל לכל מניה
/* רווח יעד לכל מניה — תיק "יפה" אבל אמין (לא קנייה בשפל של קריסה → +500%) */
const DEMO_US_TARGET = [0.62, 0.48, 0.41, 0.33, 0.27, 0.18];
const DEMO_TA_TARGET = [0.44, 0.22];

/* נקודת קנייה: התאריך האחרון בחלון שבו המחיר היה ≤ מחיר היום ÷ (1+יעד).
   אם המחיר מעולם לא ירד כך בחלון — השפל של החלון. טהורה. */
function demoEntry(h, lastPx, target, from, to) {
  const lim = lastPx / (1 + target);
  for (let i = (h || []).length - 1; i >= 0; i--) {
    const r = h[i];
    if (r.date > to) continue;
    if (r.date < from) break;
    if (r.close > 0 && r.close <= lim) return r;
  }
  return demoExtreme(h, from, to, false);
}

function isDemoMode() { return !!(typeof DB !== 'undefined' && DB && DB.demo); }

/* מדרג לפי מומנטום 6 חודשים. טהורה. */
function demoPickHot(hist, syms, n, today) {
  const scored = [];
  for (const s of syms) {
    const h = hist[s] || [];
    if (h.length < 300) continue;
    const last = h[h.length - 1].close;
    const b6 = closeOnOrBefore(h, addDaysISO(today, -182));
    const b18 = closeOnOrBefore(h, addDaysISO(today, -540));
    if (!(last > 0 && b6 > 0 && b18 > 0) || last <= b18) continue;
    scored.push({ sym: s, score: last / b6 - 1 });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map((x) => x.sym);
}

function demoExtreme(h, from, to, wantMax) {
  let best = null;
  for (const r of (h || [])) {
    if (r.date < from || r.date > to || !(r.close > 0)) continue;
    if (!best || (wantMax ? r.close > best.close : r.close < best.close)) best = r;
  }
  return best;
}

function demoStockName(sym, lang) {
  for (const [s, en, he] of TASE_STOCKS) if (s === sym) return lang === 'en' ? en : he;
  for (const [s, en] of POPULAR_STOCKS) {
    if (s === sym) return String(en).replace(/,? (Inc|Corp|Corporation|Ltd|Co|Holdings|N\.V|plc)\.?$/i, '').replace(/\.$/, '');
  }
  const extra = { ANET: 'Arista Networks', APP: 'AppLovin', PLTR: 'Palantir', CRWD: 'CrowdStrike', TSM: 'TSMC',
    AVGO: 'Broadcom', MU: 'Micron', ORCL: 'Oracle', SHOP: 'Shopify', UBER: 'Uber', LLY: 'Eli Lilly', COST: 'Costco' };
  return extra[sym] || sym;
}

/* בונה את תיק הדמו — טהורה (hist, שערים ותאריך מבחוץ). tr = פונקציית תרגום.
   קנייה ראשונה = הנקודה האחרונה (3–18 חודשים אחורה) שנותנת את רווח היעד של המניה;
   מניה זוגית מוסיפה בהמשך (חצי מהיעד), מניה אי־זוגית מממשת ~30% בשיא שאחרי הקנייה.
   כל קנייה ממומנת בהפקדה (מעוגלת ל־₪1,000 למעלה) — העודף נשאר מזומן; אחרי מכירה —
   משיכה של כמחצית. כך שווי − הפקדות = רווח אמיתי (עד תנודות שער). */
function demoBuild(hist, picks, fxOf, fxNow, today, tr, lang) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const fx = (d) => (fxOf && fxOf(d)) || fxNow;
  const trades = [], deposits = [];
  let usdCash = 0, ilsCash = 0, n = 0;
  const addDep = (iso, ils, place) => deposits.push({ date: fmtDateIL(iso), amount: ils > 0 ? -ils : Math.abs(ils), place: place, _iso: iso });
  const all = picks.us.map((s, i) => ({ s, cur: 'USD', budget: DEMO_US_BUDGET[i] || 4000, target: DEMO_US_TARGET[i] || 0.2, i }))
    .concat(picks.ta.map((s, i) => ({ s, cur: 'ILS', budget: DEMO_TA_BUDGET[i] || 15000, target: DEMO_TA_TARGET[i] || 0.2, i: i + 1 })));
  for (const o of all) {
    const h = hist[o.s] || [];
    const fee = o.cur === 'ILS' ? 5 : 1.5;
    const buy = (row, qty) => {
      const price = r2(row.close);
      trades.push({ id: 'demo' + (++n), date: row.date, sym: o.s, side: 'BUY', qty: qty, price: price, fee: fee });
      const cost = qty * price + fee;
      const costIls = o.cur === 'ILS' ? cost : cost * fx(row.date);
      const dep = Math.ceil(costIls / 1000) * 1000;
      const dIso = addDaysISO(row.date, -3);
      addDep(dIso, dep, tr('demoDepPlace'));
      if (o.cur === 'ILS') ilsCash += dep - cost; else usdCash += dep / fx(row.date) - cost;
    };
    if (!h.length) continue;
    const lastPx = h[h.length - 1].close;
    const b1 = demoEntry(h, lastPx, o.target, addDaysISO(today, -540), addDaysISO(today, -90));
    if (!b1) continue;
    buy(b1, Math.max(1, Math.floor(o.budget * 0.7 / b1.close)));
    if (o.i % 2 === 0) {
      const b2 = demoEntry(h, lastPx, o.target * 0.6, addDaysISO(b1.date, 30), addDaysISO(today, -21));
      if (b2 && b2.date > b1.date) buy(b2, Math.max(1, Math.floor(o.budget * 0.3 / b2.close)));
    } else {
      const sp = demoExtreme(h, addDaysISO(b1.date, 20), addDaysISO(today, -14), true);
      const st = mtPosition(trades, o.s);
      const q = Math.floor(st.shares * 0.3);
      if (sp && q >= 1 && sp.close > st.avg) {
        const price = r2(sp.close);
        trades.push({ id: 'demo' + (++n), date: sp.date, sym: o.s, side: 'SELL', qty: q, price: price, fee: fee });
        const proceeds = q * price - fee;
        if (o.cur === 'ILS') ilsCash += proceeds; else usdCash += proceeds;
        const wIso = addDaysISO(sp.date, 7);
        const pIls = o.cur === 'ILS' ? proceeds : proceeds * fx(wIso);
        const w = Math.floor(pIls * 0.5 / 1000) * 1000;
        if (w > 0) {
          addDep(wIso, -w, tr('demoWdPlace'));
          if (o.cur === 'ILS') ilsCash -= w; else usdCash -= w / fx(wIso);
        }
      }
    }
  }
  if (!trades.length) return null;
  // הפקדה פותחת לרזרבת מזומן — חלק נשאר בשקלים, חלק הומר לדולרים
  const first = trades.reduce((a, x) => (x.date < a ? x.date : a), trades[0].date);
  const rIso = addDaysISO(first, -10);
  addDep(rIso, 8000, tr('demoReservePlace'));
  ilsCash += 3000; usdCash += 5000 / fx(rIso);
  deposits.sort((a, b) => (a._iso < b._iso ? 1 : a._iso > b._iso ? -1 : 0));
  for (const d of deposits) delete d._iso;
  const syms = [...new Set(trades.map((x) => x.sym))];
  const positions = [];
  for (const sym of syms) {
    const st = mtPosition(trades, sym);
    if (st.shares > 0) positions.push({ sym: sym, name: demoStockName(sym, lang), full: '', shares: st.shares, avg: st.avg, src: 'manual', fromTrades: true });
  }
  const y = Number(today.slice(0, 4));
  return {
    v: 1,
    positions: positions,
    deposits: deposits,
    manualTrades: trades,
    cash: { usd: r2(Math.max(0, usdCash)), ils: r2(Math.max(0, ilsCash)) },
    wishlist: (picks.watch || []).map((s) => ({ sym: s, note: tr('demoWlNote') })),
    pensionFunds: [
      { name: tr('demoPension'), usd: 0, ils: 186400, kind: 'pension' },
      { name: tr('demoStudy'), usd: 0, ils: 94700, kind: 'study' },
    ],
    pensionDeposits: [
      { place: tr('demoPension'), period: String(y), amount: -38000, note: '', kind: 'pension' },
      { place: tr('demoPension'), period: String(y - 1), amount: -52000, note: '', kind: 'pension' },
      { place: tr('demoPension'), period: String(y - 2), amount: -49000, note: '', kind: 'pension' },
      { place: tr('demoStudy'), period: String(y), amount: -15000, note: '', kind: 'study' },
      { place: tr('demoStudy'), period: String(y - 1), amount: -20500, note: '', kind: 'study' },
      { place: tr('demoStudy'), period: String(y - 2), amount: -20500, note: '', kind: 'study' },
    ],
    source: 'manual',
    demo: true,
  };
}

let _demoBusy = false;
async function demoCreate(btn) {
  if (_demoBusy || isDemoMode()) return;
  if (!confirm(t('demoConfirm'))) return;
  _demoBusy = true;
  if (btn) btn.disabled = true;
  flash(t('demoBuilding'));
  try {
    const today = todayISO();
    const demoTexts = {
      demoDepPlace: t('demoDepPlace'), demoWdPlace: t('demoWdPlace'), demoReservePlace: t('demoReservePlace'),
      demoWlNote: t('demoWlNote'), demoPension: t('demoPension'), demoStudy: t('demoStudy'),
    };
    const hist = {};
    await Promise.all(DEMO_US.concat(DEMO_TA).map(async (s) => {
      try { hist[s] = (await getDailyFast(s)) || []; } catch (e) { hist[s] = []; }
    }));
    const rankUS = demoPickHot(hist, DEMO_US, 9, today);
    const picks = { us: rankUS.slice(0, 6), ta: demoPickHot(hist, DEMO_TA, 2, today), watch: rankUS.slice(6, 9) };
    try { await ensureFxHist(addDaysISO(today, -600)); } catch (e) {}
    const db = picks.us.length >= 3
      ? demoBuild(hist, picks, (d) => fxOnOrBefore(d), state.fx || 3.7, today, (k) => demoTexts[k], state.lang) : null;
    // לא שומרים היסטוריה של מועמדים שלא נבחרו — חוסך מקום בטלפון
    const keep = new Set(picks.us.concat(picks.ta, picks.watch));
    for (const s of Object.keys(hist)) if (!keep.has(s)) { delete state.hist[s]; try { localStorage.removeItem(LS_HIST + s); } catch (e) {} }
    if (!db) { flash(t('demoFail')); return; }
    // שמירה אחרונה של הנתונים האמיתיים לענן — ואז גיבוי מקומי, והדמו לא נשמר בענן
    try { if (window.Cloud && window.Cloud.flushSave) await window.Cloud.flushSave(); } catch (e) {}
    try { localStorage.setItem(LS_PREDEMO, JSON.stringify(DB)); } catch (e) {}
    applyDbData(db);
    DB.source = 'manual';
    DB.demo = true;
    delete DB.ibkrSnapshot;
    saveDBto(DB);
    renderAll();
    renderDemoUi();
    try { refreshQuotes(); } catch (e) {}
    const ov = document.querySelector('.tab[data-tab="overview"]');
    if (ov) ov.click();
    flash(t('demoReady'));
  } finally {
    _demoBusy = false;
    if (btn) btn.disabled = false;
  }
}

/* יציאה מהדמו: הנתונים האמיתיים חוזרים מהגיבוי המקומי; בטעינה מחדש הענן (מקור האמת) נטען כרגיל. */
function demoExit() {
  if (!isDemoMode()) return;
  let backup = null;
  try { backup = JSON.parse(localStorage.getItem(LS_PREDEMO) || 'null'); } catch (e) {}
  // היסטוריית מחירים של מניות הדמו — לא נשארת בטלפון (אלא אם המניה בתיק/במעקב האמיתי)
  const keep = new Set([].concat((backup && backup.positions) || [], (backup && backup.wishlist) || []).map((p) => p && p.sym));
  for (const sym of new Set(POSITIONS.concat(WISHLIST).map((p) => p.sym))) {
    if (!keep.has(sym)) { try { localStorage.removeItem(LS_HIST + sym); } catch (e) {} }
  }
  applyDbData(backup || {});
  delete DB.demo;
  if (backup && backup.source) DB.source = backup.source; else delete DB.source;
  if (backup && backup.ibkrSnapshot) DB.ibkrSnapshot = backup.ibkrSnapshot;
  saveDBto(DB);
  try { localStorage.removeItem(LS_PREDEMO); } catch (e) {}
  location.reload();
}

function renderDemoUi() {
  const on = isDemoMode();
  const tog = (id, show) => { const e = document.getElementById(id); if (e) e.classList.toggle('hidden', !show); };
  tog('demoOffer', !on);
  tog('demoActive', on);
  tog('demoBanner', on);
  tog('resetCard', !on);
}

function ibkrDisconnect() {
  ibkrClearErr();
  if (!confirm(t('disconnectConfirm'))) return;
  ibkrSaveCfg({ lastSync: 0, data: null });
  // שחזור הנתונים הידניים שהיו לפני הייבוא (אם נשמר צילום) — לא משאירים נתוני IBKR כ"ידניים"
  const restored = ibkrRestoreManual();
  DB.source = 'manual';
  saveDB();
  renderAll();
  renderIbkrCard();
  if (restored) flash(t('disconnectedRestored')); else flash(t('disconnected'));
}

/* בדיקת יבוא מסנכרון IBKR: תצוגה מקדימה של מה חדש מול מה שכבר נשמר,
   אישור, וסיום יבוא עם מיזוג בלי כפילויות. */

/* מטמון מיושן: האפליקציה "זוכרת" יבוא קודם, אבל אף סימבול ממנו לא נמצא בתיק
   בפועל (למשל אחרי איפוס או מחיקה). דילוג על כפילויות חל רק כשהמידע כבר הוזן
   ולא נמחק — כל עוד המידע לא קיים באמת במערכת, מושכים אותו מחדש. */
function ibkrCacheIsStale(cached, curPositions) {
  const cps = (cached && cached.positions) || [];
  if (!cps.length) return false;
  const cur = {};
  for (const p of (curPositions || [])) cur[String(p.sym || '').trim()] = true;
  return !cps.some((p) => cur[String(p.symbol || '').trim()]);
}
function ibkrReviewImport(existing, incoming, warnTxt) {
  if (ibkrCacheIsStale(existing, typeof POSITIONS !== 'undefined' ? POSITIONS : [])) existing = null;
  const preview = rMergePreview(existing, incoming);
  const deltaTxt = ibkrImportDeltaText(preview, !!existing);
  if (deltaTxt === null) { flash(t('ibkrImportNothingNew')); return; }
  const meta = incoming.meta || {};
  const twr = rHeadlineTwr(incoming);
  const okGo = confirm(t('ibkrImportConfirm', {
    a: meta.fromDate ? fmtDateIL(meta.fromDate) : '—',
    b: meta.toDate ? fmtDateIL(meta.toDate) : '—',
    twr: (twr === null || twr === undefined) ? '—' : fmtPct(twr, true),
    delta: deltaTxt,
    warns: warnTxt || '',
  }));
  if (!okGo) return;
  ibkrFinishImport(rMergeData(existing, incoming));
}

async function ibkrSaveAndTest() {
  ibkrClearErr();
  const proxyUrl = (document.getElementById('ibkrProxy').value || '').trim().replace(/\/+$/, '');
  const token = (document.getElementById('ibkrToken').value || '').trim();
  const queryId = (document.getElementById('ibkrQuery').value || '').trim();
  const fromDateEl = document.getElementById('ibkrFromDate');
  const fromDate = ((fromDateEl && fromDateEl.value) || '').trim();
  const dhe = document.getElementById('ibkrHistoryDepth');
  const depthYears = Math.min(10, Math.max(1, parseInt((dhe && dhe.value) || '', 10) || IBKR_HISTORY_YEARS_DEFAULT));
  if (!proxyUrl) return ibkrShowErr(t('proxyUrlMissing'));
  if (!token || !queryId) return ibkrShowErr(t('credsMissing'));
  ibkrSaveCfg({ proxyUrl, token, queryId, fromDate: /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : '', historyYears: depthYears });
  ibkrSetBusy(true);
  renderIbkrCard();
  try {
    const rep = await ibkrRequestReport(fetch, proxyUrl, token, queryId, '', '', IBKR_LIMITER);
    ibkrSaveCfg({ statementUrl: rep.statementUrl || '' });
    flash(t('connOk'));
  } catch (e) {
    ibkrShowErr(t('testFailed', { err: ibkrFriendlyErr(e.message) }));
  }
  ibkrSetBusy(false);
  renderIbkrCard();
}

/* סנכרון מ־IBKR (Flex Web Service) — מקור הנתונים היחיד של מצב IBKR.
   מושך דוח טרי דרך השרתון ומכניס אותו לאותו צינור יבוא מאוחד. */
async function ibkrSyncImport() {
  ibkrClearErr();
  if (isDemoMode()) return ibkrShowErr(t('demoSyncBlocked'));
  const cfg = ibkrCfg();
  const proxyUrl = ibkrProxyBase();
  if (!proxyUrl) return ibkrShowErr(t('proxyUrlMissing'));
  if (!cfg.token || !cfg.queryId) return ibkrShowErr(t('credsMissingSave'));
  // טווח המשיכה — שלושה מצבים:
  // 1. תאריך ידני בשדה (נשמר בטלפון) — המשתמש בחר בדיוק כמה אחורה.
  // 2. יש נתונים מיובאים ואין תאריך — ממשיכים מהנקודה שהם נגמרו (מהיר, בלי כפילויות).
  // 3. אין נתונים ואין תאריך — משיכה עמוקה אוטומטית מינואר 2020 קדימה,
  //    בחלקי 365 יום (אותו נתיב שהוכח כמושך מ־IBKR היסטוריה מלאה).
  // בכל המצבים הקיטוע לחלקי 365 יום והאיחוד אוטומטיים.
  const fde = document.getElementById('ibkrFromDate');
  const fromStr = ((fde && fde.value) || cfg.fromDate || '').trim();
  // עומק היסטוריה בשנים — כמה שנים אחורה המשתמש באמת צריך (בחירתו, נשמרת בטלפון)
  const dhe = document.getElementById('ibkrHistoryDepth');
  const depthYears = Math.min(10, Math.max(1, parseInt(((dhe && dhe.value) || cfg.historyYears || ''), 10) || IBKR_HISTORY_YEARS_DEFAULT));
  ibkrSaveCfg({ historyYears: depthYears });
  const endD = ibkrLastClosedDate();
  const endYmd = ibkrYmd(endD);
  let startYmd, autoMode = false;
  const hasData = ibkrHasImportedData(cfg.data);
  // v127: התאריך שהוצע אוטומטית בשדה (המשך מהנתונים הקיימים, או הערך הישן
  // שנשמר ממנו) הוא לא "תאריך ידני" — שמירתו כקבוע גרמה למשיכה חוזרת מאותו
  // יום ישן בכל סנכרון. סנכרון המשך תמיד מתחיל ביום שאחרי הנתונים הקיימים.
  const contYmd = hasData ? ibkrDefaultFromYmd(cfg.data, endD) : '';
  const lastYmd = hasData ? String((cfg.data.meta || {}).toDate || '').replace(/-/g, '') : '';
  const fromYmd = fromStr.replace(/-/g, '');
  const isContinuation = hasData && /^\d{8}$/.test(fromYmd) && (fromYmd === contYmd || fromYmd === lastYmd);
  if (/^\d{4}-\d{2}-\d{2}$/.test(fromStr) && !isContinuation) {
    // תאריך מדויק — ללא הגבלה (גם 10+ שנים אחורה)
    startYmd = fromYmd;
    if (startYmd > endYmd) return ibkrShowErr(t('ibkrBadFromDate'));
    ibkrSaveCfg({ fromDate: fromStr });
  } else if (hasData) {
    startYmd = contYmd;
    ibkrSaveCfg({ fromDate: '' });
    // השדה יתמלא מחדש אחרי הסנכרון מהנתונים המעודכנים — לא נשאר ערך ישן
    if (fde) fde.value = '';
    // כבר מעודכן (או שנותרו רק ימי סופ"ש, שעליהם IBKR לא מפיק דוח)
    if (!ibkrHasWeekday(startYmd, endYmd)) {
      if (fde) fde.value = '';
      renderIbkrCard();
      return flash(t('ibkrUpToDate'));
    }
  } else {
    // משיכה ראשונה: מתחילים מהעומק שהמשתמש בחר — לא יותר ממה שצריך, לא פחות
    startYmd = ibkrDepthStartYmd(endD, depthYears);
    autoMode = true;
    ibkrSaveCfg({ fromDate: '' });
  }
  ibkrSetBusy(true);
  // v122: מסך דלוק במהלך המשיכה — טלפון שנכבה משהה את הדף והמשיכה "נתקעת"
  let wakeLock = null;
  try {
    if (typeof navigator !== 'undefined' && navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen');
  } catch (e) {}
  // v122: שורת מצב חיה — חלק, שלב (בקשה / IBKR מכין את הדוח) וזמן שעבר,
  // כדי שיהיה ברור מה קורה ולא ייראה "תקוע"
  const s = document.getElementById('ibkrStatus');
  const t0 = Date.now();
  let base = autoMode ? t('fetchHistoryAuto', { n: 1, total: '…' }) : t('fetchHistory', { n: 1, total: '…' });
  let stageTxt = '';
  const paint = () => { if (s) s.textContent = ibkrStatusLine(base, stageTxt, Date.now() - t0); };
  const ticker = setInterval(paint, 1000);
  try {
    paint();
    const incoming = await ibkrFetchFullHistory(fetch, proxyUrl, cfg.token, cfg.queryId, startYmd, (i, total) => {
      base = autoMode ? t('fetchHistoryAuto', { n: i, total }) : t('fetchHistory', { n: i, total });
      stageTxt = '';
      paint();
    }, {
      onStage: (st, n) => {
        stageTxt = st === 'request' ? t('ibkrStageRequest') : t('ibkrStageWait', { n });
        paint();
      },
    });
    // אם החלק העדכני נכשל — לא שומרים ולא מייבאים. אסור להתקין
    // פוזיציות ישנות כעדכניות.
    // אם כל הכשלונות הם flex_1003 (הדוח עדיין לא פורסם ב־IBKR) — מסבירים
    // שהפתרון הוא פשוט לנסות שוב מאוחר יותר, לא לתקן שום דבר בחיבור.
    if (!ibkrSyncIsComplete(incoming)) {
      const fails = (incoming._chunks || []).filter((c) => !c.ok);
      const failText = fails.map((c) => t('ibkrChunkFail', { fd: c.fd, td: c.td, err: c.error || '' })).join('; ');
      const locked = !!incoming._locked || fails.some((c) => ibkrIsLockoutErr(c.error)); // 1025: נעילה — להמתין שעות
      const throttled = !locked && (!!incoming._throttled || fails.some((c) => ibkrIsThrottleErr(c.error)));
      const notAvail = !locked && !throttled && fails.length > 0 && fails.every((c) => /flex_1003/.test(c.error || ''));
      renderIbkrCard();
      const head = locked ? t('importLocked') : throttled ? t('importThrottled') : (notAvail ? t('importNotAvailable') : t('importPartialBlocked'));
      return ibkrShowErr(head + (failText ? ' ' + failText : ''));
    }
    const imp = ibkrMapImport(incoming);
    if (!imp.positions.length && !(incoming.navPeriods || []).length && !(incoming.trades || []).length) {
      ibkrShowErr(t('importNoStocks') + (imp.skipped ? ' ' + t('importSkippedNote', { n: imp.skipped }).trim() : ''));
      return;
    }
    // המשיכה האוטומטית מתחילה בעומק שהמשתמש בחר. אם המידע שנמצא מגיע
    // עד קרוב לתחילת הטווח — ייתכן שהחשבון ישן יותר, ומציעים להעמיק.
    let deepNote = '';
    if (autoMode) {
      const earliest = ibkrEarliestDate(incoming);
      if (ibkrReachedStart(earliest, startYmd)) {
        deepNote = '\n' + t('ibkrFlexOlderHint', { date: fmtDateIL(startYmd.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')) });
      }
    }
    // v123: החלק האחרון הצליח (מותר לייבא), אבל חלק ישן יותר עדיין נכשל אחרי
    // סבב הניסיון הנוסף — מזהירים שיש פער בטווח, כדי שהמשתמש ידע ויסנכרן שוב
    const stillFailed = (incoming._chunks || []).filter((c) => !c.ok);
    if (stillFailed.length) {
      const gapText = stillFailed.map((c) => t('ibkrChunkFail', { fd: c.fd, td: c.td, err: c.error || '' })).join('; ');
      // סנכרון רגיל ממשיך קדימה מהתאריך האחרון שנמשך בהצלחה — הוא לא יחזור
      // אחורה לסגור פער ישן. צריך תאריך התחלה ידני = תחילת הפער.
      const gapStart = stillFailed.map((c) => c.fd).sort()[0];
      const gapStartIso = gapStart.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
      deepNote += '\n' + t('ibkrGapWarn', { detail: gapText, date: fmtDateIL(gapStartIso) });
    }
    ibkrReviewImport(ibkrCfg().data, incoming, deepNote);
  } catch (e) {
    ibkrShowErr(t('importFailed', { err: ibkrFriendlyErr(e.message) }));
  } finally {
    clearInterval(ticker);
    try { if (wakeLock) wakeLock.release(); } catch (e) {}
    ibkrSetBusy(false);
    renderIbkrCard();
  }
}

/* שורת מצב של משיכה (פונקציה טהורה, נבדקת): "חלק 2 מתוך 6 · שלב · 1:05". */
function ibkrStatusLine(base, stage, elapsedMs) {
  const sec = Math.max(0, Math.floor((elapsedMs || 0) / 1000));
  const clock = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  return [base, stage, clock].filter(Boolean).join(' · ');
}

/* טקסט "מה יתווסף" לדיאלוג האישור — משווה את הדוח החדש למה שכבר נשמר.
   מחזיר null כשאין שום מידע חדש. */
function ibkrImportDeltaText(preview, hasExisting) {
  const pr = preview;
  if (!hasExisting) return t('ibkrImportDeltaFirst');
  const lines = [];
  const rng = (p) => fmtDateIL(p.fromDate) + '–' + fmtDateIL(p.toDate);
  if (pr.addedPeriods.length) lines.push(t('ibkrImportDeltaPeriods', { ranges: pr.addedPeriods.map(rng).join(', ') }));
  if (pr.replacedPeriods.length) lines.push(t('ibkrImportDeltaReplaced', { ranges: pr.replacedPeriods.map(rng).join(', ') }));
  if (pr.newTrades || pr.newCash) lines.push(t('ibkrImportDeltaTrades', { n: pr.newTrades, k: pr.newCash }));
  // אין שום דבר חדש — גם אם יש כפילויות שידולגו, אין טעם בדיאלוג
  if (!lines.length) return null;
  if (pr.dupTrades || pr.dupCash) lines.push(t('ibkrImportDeltaDup', { n: pr.dupTrades, m: pr.dupCash }));
  return lines.join('\n');
}

/* סיום יבוא: מאחד לוטות לפי סימבול, מכניס פוזיציות לתיק (בהסכמת המשתמש
   שכבר ניתנה), מזומן (רק אם נמצא בדוח) והפקדות (רק העברות חיצוניות מהדוח,
   מומרות לשקלים). פנסיה לא נפגעת. */
function ibkrFinishImport(data) {
  const isManual = DB.source === 'manual';
  const snapshotOk = isManual && ibkrSnapshotManual();
  const imp = ibkrMapImport(data);
  const impSyms = {};
  for (const p of (imp.positions || [])) impSyms[p.sym] = true;
  const curSyms = {};
  for (const p of POSITIONS) curSyms[p.sym] = true;
  // v141: פוזיציות ידניות (src:'manual') נשמרות — IBKR מחליף רק את שלו. מניה
  // ש־IBKR מחזיק עכשיו גוברת על הזנה ידנית לפי ממוצע (עסקאות ידניות שלה מוצללות).
  const manualKeep = POSITIONS.filter((p) => p.src === 'manual' && !impSyms[p.sym]);
  const replaced = POSITIONS.filter((p) => !impSyms[p.sym] && p.src !== 'manual').length;
  POSITIONS.length = 0;
  for (const e of (imp.positions || [])) POSITIONS.push(e);
  for (const e of manualKeep) POSITIONS.push(e);
  mtSyncPositions();
  const added = (imp.positions || []).filter((e) => !curSyms[e.sym]).length;
  const kept = Object.keys(curSyms).length - replaced;
  // מזומן מהדוח — רק אם נמצא בדוח
  if (imp.cash) DB.cash = imp.cash;
  // הפקדות: רק העברות חיצוניות מהדוח, מומרות לשקלים — בלי כפילויות בייבוא חוזר
  const fxOf = (iso) => fxOnOrBefore(iso) || state.fx || 1;
  const deps = ibkrMapDeposits(data.cashTransactions || [], fxOf);
  // מודע־מופעים: שתי הפקדות זהות באותו יום הן לגיטימיות; יבוא חוזר לא מכפיל
  const depKey = (d) => d.date + '|' + d.amount;
  const existCount = {};
  for (const d of (DB.deposits || [])) { const k = depKey(d); existCount[k] = (existCount[k] || 0) + 1; }
  const usedCount = {};
  const newDeps = deps.filter((d) => {
    const k = depKey(d);
    usedCount[k] = (usedCount[k] || 0) + 1;
    return usedCount[k] > (existCount[k] || 0);
  });
  const skipped = imp.skipped;
  if (newDeps.length || imp.cash || (imp.positions || []).length) {
    if (newDeps.length) DB.deposits = DB.deposits.concat(newDeps);
    DB.source = 'ibkr';
    saveDB();
  }
  ibkrSaveCfg({ lastSync: Date.now(), data: data });
  renderAll();
  renderIbkrCard();
  let msg = t('importDone', { added: added, kept: kept });
  if (replaced > 0) msg += ' ' + t('importReplaced', { n: replaced });
  if (skipped > 0) msg += ' ' + t('importSkipped', { n: skipped });
  if (snapshotOk) msg += ' ' + t('importSnapshotNote');
  flash(msg);
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
function fmtILS2(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '₪' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* v142: מטבע המסחר של מניה — בורסת ת"א (סיומת .TA) בשקלים, השאר בדולרים.
   כל מחיר/ממוצע/עסקה של מניה נשמר במטבע שלה; סכומים (שווי, רווח, עוגה, תשואה)
   מומרים לדולר דרך nativeToUSD, ומשם למטבע התצוגה כמו תמיד. */
function symCur(sym) { return /\.TA$/i.test(String(sym || '')) ? 'ILS' : 'USD'; }
function nativeToUSD(v, sym, fx) {
  if (v === null || v === undefined || !isFinite(v)) return null;
  if (symCur(sym) !== 'ILS') return v;
  const r = fx === undefined ? state.fx : fx;
  return r > 0 ? v / r : null;
}
/* מחיר למניה לתצוגה: מניה ישראלית תמיד בשקלים (ככה היא נסחרת); מניה אמריקאית
   לפי מטבע התצוגה (כמו קודם). */
function fmtPx(v, sym) {
  if (symCur(sym) === 'ILS') return fmtILS2(v);
  return state.currency === 'ILS' && state.fx ? fmtILS(v * state.fx) : fmtUSD2(v);
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

/* v146: תיק חדש מתחיל ריק — בלי מניות/הפקדות/פנסיה/מזומן לדוגמה.
   (עד v145 היו כאן GOOGL/META, הפקדה ₪1,000, פנסיה ₪1,000 ומזומן 100 — והם
   נשמרו כנתונים אמיתיים אצל משתמשים; stripLegacyDemo מנקה אותם.)
   תיק דמו מלא — בכפתור בהגדרות (demoCreate). */
const DEFAULT_DB = {
  v: 1,
  positions: [],
  deposits: [],
  wishlist: [],
  pensionFunds: [],
  pensionDeposits: [],
  cash: { usd: 0, ils: 0 },
  manualTrades: []
};

/* מסיר את רשומות הדוגמה הישנות (עד v145) — רק טביעת אצבע מדויקת, לא נתון אמיתי. מחזיר true אם שינה. */
function stripLegacyDemo(db) {
  if (!db) return false;
  let changed = false;
  const isDep = (d) => d && d.date === '01/01/2026' && Number(d.amount) === -1000 && d.place === 'הפקדת דוגמה';
  const isPos = (p) => p && !p.src && (
    (p.sym === 'GOOGL' && p.name === 'גוגל' && Number(p.shares) === 10 && Number(p.avg) === 140) ||
    (p.sym === 'META' && p.name === 'מטא' && Number(p.shares) === 5 && Number(p.avg) === 480));
  const isFund = (f) => f && f.name === 'פנסיה — מקום עבודה' && Number(f.ils) === 1000 && !Number(f.usd);
  const strip = (arr, bad) => {
    if (!Array.isArray(arr)) return;
    for (let i = arr.length - 1; i >= 0; i--) if (bad(arr[i])) { arr.splice(i, 1); changed = true; }
  };
  const hadDep = Array.isArray(db.deposits) && db.deposits.some(isDep);
  strip(db.deposits, isDep);
  strip(db.positions, isPos);
  strip(db.pensionFunds, isFund);
  if (db.ibkrSnapshot) { strip(db.ibkrSnapshot.deposits, isDep); strip(db.ibkrSnapshot.positions, isPos); }
  if (hadDep && db.source !== 'ibkr' && db.cash && Number(db.cash.usd) === 100 && Number(db.cash.ils) === 100) {
    db.cash = { usd: 0, ils: 0 }; changed = true;
  }
  return changed;
}

/* גרסת האפליקציה — מוצגת בהגדרות כדי לוודא שהטלפון מעודכן */
const APP_VERSION = 'v146';


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
        if (!Array.isArray(db.manualTrades)) db.manualTrades = [];
        ensurePensionKinds(db);
        if (stripLegacyDemo(db)) saveDBto(db);
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

/* תיק ריק — למשתמש חדש או אחרי איפוס (השם נשמר לתאימות עם cloud.js) */
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
  DB.manualTrades = Array.isArray(clean.manualTrades) ? clean.manualTrades : [];
  stripLegacyDemo(DB);
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

/* v145: כסף שנכנס לתיק מחוץ ל־IBKR — קניות/מכירות ידניות, בשקלים, בכיוון של הפקדה.
   קנייה = הפקדה (qty×price+עמלה), מכירה = משיכה (qty×price−עמלה). דולר → שקל לפי שער
   יום העסקה (fxOf), פוזיציה "לפי ממוצע" (בלי תאריך) — עלות × שער נוכחי.
   amount בכיוון רשומות ההפקדה: שלילי = כסף שנכנס. טהורה, נבדקת. */
function manualFlowsILS(positions, trades, fxOf, fxNow) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const toIls = (v, sym, rate) => (symCur(sym) === 'ILS' ? v : (rate > 0 ? v * rate : null));
  const rows = [], avgRows = [];
  let inILS = 0, missing = 0;
  for (const raw of (trades || [])) {
    const x = mtNorm(raw);
    if (!x.sym || !(x.qty > 0) || !(x.price > 0)) continue;
    const gross = x.qty * x.price;
    const native = x.side === 'BUY' ? gross + x.fee : gross - x.fee;
    const ils = toIls(native, x.sym, (fxOf && fxOf(x.date)) || fxNow);
    if (ils === null) { missing++; continue; }
    const amount = x.side === 'BUY' ? -r2(ils) : r2(ils);
    rows.push({ id: x.id, date: x.date, sym: x.sym, side: x.side, qty: x.qty, price: x.price, amount: amount });
    inILS -= amount;
  }
  for (const p of (positions || [])) {
    if (!p || p.src !== 'manual' || p.fromTrades) continue;
    const cost = (num(p.shares) || 0) * (num(p.avg) || 0);
    if (!(cost > 0)) continue;
    const ils = toIls(cost, p.sym, fxNow);
    if (ils === null) { missing++; continue; }
    avgRows.push({ sym: p.sym, qty: num(p.shares), price: num(p.avg), amount: -r2(ils) });
    inILS += r2(ils);
  }
  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return { rows: rows, avgRows: avgRows, inILS: r2(inILS), missing: missing };
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

/* צבעי תרשים העוגה (v133): צבע המותג האמיתי של החברה כשהוא ידוע (מקורות
   ציבוריים — brandcolors.net/brandpalettes.com, ל־24/09/2026; מותג
   רב־צבעי כמו מיקרוסופט מיוצג בגוון אחד מהסט הרשמי). קבועים במכוון בין
   בהיר לכהה — צבע מותג לא אמור להשתנות לפי ערכת הנושא, רק רקע הכרטיס
   משתנה סביבו. חברה לא ממותגת מקבלת גוון פסטלי מ־PIE_FALLBACK_PALETTE
   (בהשראת גרף העוגה שהמשתמש שלח כדוגמה). */
const PIE_BRAND_COLORS = {
  META: '#0866FF', ADBE: '#FA0C00', MSFT: '#FFB900', NOW: '#62D84E',
  MBLY: '#1A1F71', UNH: '#263D96', UBER: '#3AA76D', INTU: '#236CFF',
};
const PIE_FALLBACK_PALETTE = ['#8DC63F', '#8FC1E3', '#F46A5C', '#F5A35C', '#C98BBE', '#F2D250', '#9AA0A6', '#5B8DBE', '#B07CC6'];

/* hex -> {h,s,l} (0..360 / 0..1 / 0..1) — עזר להשוואת צבעים. */
function pieHexToHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return { h: 0, s: 0, l: 0.5 };
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s0 = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s0 = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
  }
  return { h: h, s: s0, l: l };
}

/* {h,s,l} -> hex — הופכת ל-pieHexToHsl, לבניית גוון פסטלי מהגוון המקורי. */
function pieHslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (v) => Math.max(0, Math.min(255, Math.round((v + m) * 255))).toString(16).padStart(2, '0');
  return '#' + toHex(r) + toHex(g) + toHex(b);
}

/* מרככת צבע מותג חד/רווי לגוון פסטלי (כמו בגרף העוגה שהמשתמש שלח כדוגמה):
   שומרת את הגוון (h) של המותג — כדי שהחברה עדיין תהיה מזוהה — אבל מגבילה
   רוויה ומעלה בהירות. פונקציה טהורה, נבדקת. */
function pastelizeBrand(hex) {
  const c = pieHexToHsl(hex);
  const s = Math.min(c.s, 0.55);
  const l = Math.min(0.8, Math.max(0.68, c.l * 0.4 + 0.62));
  return pieHslToHex(c.h, s, l);
}

/* צבע לסימבול: גוון פסטלי של צבע המותג אם ידוע, אחרת גוון מהפלטה הפסטלית —
   הסבב בפלטה נספר רק על חברות לא־ממותגות (fallbackIdx), כדי שהוספת/הסרת
   חברה ממותגת לא תזיז את כל שאר הצבעים. פונקציה טהורה, נבדקת. */
function pieColorFor(sym, fallbackIdx) {
  const s = String(sym || '').toUpperCase();
  return PIE_BRAND_COLORS[s]
    ? pastelizeBrand(PIE_BRAND_COLORS[s])
    : PIE_FALLBACK_PALETTE[((fallbackIdx % PIE_FALLBACK_PALETTE.length) + PIE_FALLBACK_PALETTE.length) % PIE_FALLBACK_PALETTE.length];
}

/* מרחק "תפיסתי" גס בין שני צבעים (0 = זהים, גבוה = קל להבדיל) —
   הפרש גוון מעגלי (0–180°) משוקלל בעיקר, ועוד קצת הפרש בהירות.
   פונקציה טהורה, נבדקת. */
function pieColorDistance(hexA, hexB) {
  const a = pieHexToHsl(hexA), b = pieHexToHsl(hexB);
  let dh = Math.abs(a.h - b.h); if (dh > 180) dh = 360 - dh;
  return (dh / 180) * 0.7 + Math.abs(a.l - b.l) * 0.3;
}

/* מוודאת שאין שתי חברות (לא רק שכנות בעוגה — גם בכל הגרף/המקרא) בצבע
   כמעט זהה: כמה מהחברות בתיק חולקות משפחת גוון (למשל כמה "כחולים"
   רשמיים שונים) — אחרי הפסטול הם עלולים להתכנס לאותו גוון בערך.
   עוברת חתיכה־חתיכה לפי הסדר שקיבלה, ומסובבת את הגוון (h) של כל
   חתיכה שקרובה מדי לאחת שכבר "ננעלה" עד שהיא מרוחקת מספיק מכולן —
   שומרת רוויה/בהירות (עדיין פסטלי), רק מזיזה גוון. פונקציה טהורה,
   לא משנה את המערך שקיבלה, נבדקת. */
function pieDedupeColors(slices) {
  const out = (slices || []).map((s) => Object.assign({}, s));
  for (let i = 1; i < out.length; i++) {
    const minDistTo = (hex) => {
      let d = Infinity;
      for (let j = 0; j < i; j++) d = Math.min(d, pieColorDistance(hex, out[j].color));
      return d;
    };
    let bestD = minDistTo(out[i].color);
    if (bestD >= 0.15) continue;
    // מספיק קרוב לחברה קודמת: מחפשת בין 24 גוונים מרווחים באופן שווה
    // (כל 15°) סביב הגוון המקורי את זה שהכי רחוק מכל הצבעים שכבר ננעלו —
    // חיפוש גלובלי, לא "צעד אחר צעד", כדי לא להיתקע באזור צפוף.
    const c = pieHexToHsl(out[i].color);
    let bestHex = out[i].color;
    for (let step = 15; step < 360; step += 15) {
      const cand = pieHslToHex(c.h + step, c.s, c.l);
      const d = minDistTo(cand);
      if (d > bestD) { bestD = d; bestHex = cand; }
    }
    out[i].color = bestHex;
  }
  return out;
}

/* מסדר מחדש חתיכות עוגה כך ששתי חתיכות שכנות (כולל התפר המעגלי בין
   האחרונה לראשונה) לא יהיו בצבעים קרובים מדי — כדי שאפשר תמיד להבדיל
   בין שתי חברות סמוכות. אלגוריתם חמדני: מתחילים מהחתיכה הראשונה,
   ובכל צעד בוחרים מהנותרות את הצבע הכי רחוק מהאחרונה שהונחה; בסוף
   ניסיון תיקון אחד לתפר המעגלי אם הוא יצא קרוב מדי. פונקציה טהורה,
   לא משנה את המערך שקיבלה, נבדקת. */
function pieArrangeSlices(slices) {
  const left = (slices || []).slice();
  if (left.length <= 2) return left;
  const out = [left.shift()];
  while (left.length) {
    let bi = 0, bd = -1;
    for (let i = 0; i < left.length; i++) {
      const d = pieColorDistance(out[out.length - 1].color, left[i].color);
      if (d > bd) { bd = d; bi = i; }
    }
    out.push(left.splice(bi, 1)[0]);
  }
  const wrapD = pieColorDistance(out[out.length - 1].color, out[0].color);
  if (wrapD < 0.12) {
    for (let i = 1; i < out.length - 1; i++) {
      const d1 = pieColorDistance(out[i].color, out[0].color);
      const d2 = pieColorDistance(out[out.length - 1].color, out[i - 1].color);
      if (d1 > 0.12 && d2 > 0.12) { out.push(out.splice(i, 1)[0]); break; }
    }
  }
  return out;
}

/* מטמון תמונות לוגו לתרשים העוגה (Image, לא DOM) — לוגו כל סימבול
   נטען פעם אחת; ברגע שהוא מוכן מציירים מחדש כדי שהוא יופיע. */
const PIE_LOGO_CACHE = {};
function pieLogoImg(sym) {
  const s = normalizeSym(sym);
  let e = PIE_LOGO_CACHE[s];
  if (!e) {
    e = PIE_LOGO_CACHE[s] = { img: new Image(), ready: false, failed: false };
    e.img.onload = () => { e.ready = true; try { drawPie(); } catch (er) {} };
    e.img.onerror = () => { e.failed = true; try { drawPie(); } catch (er) {} };
    e.img.src = 'https://financialmodelingprep.com/image-stock/' + encodeURIComponent(s) + '.png';
  }
  return e;
}

/* ---------------- מצב ---------------- */

const state = {
  currency: 'USD',
  quotes: {},       // sym -> quote
  fx: null,         // USDILS
  fxAt: null,        // מתי עודכן השער (v101)
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
  pfMeasure: { on: false, pts: [] }, // v126: מדידה רק אחרי לחיצה על כפתור "מדידה" (כמו בגרף המניה)
  pfTipIdx: null,   // v126: נקודה שנבחרה בלחיצה רגילה — טולטיפ בלבד
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
  // v142: בורסת ת"א מדווחת באגורות (ILA) — כל המחירים לשקלים
  const k = String(meta.currency || '').toUpperCase() === 'ILA' ? 0.01 : 1;
  const kk = (v) => (v === null || v === undefined ? v : v * k);
  // הסגירה האחרונה של נר הדקה — חיה גם ב־pre/post; גיבוי למחיר הרגיל
  const close = kk(closes.length ? closes[closes.length - 1] : num(meta.regularMarketPrice));
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
  // v134: תאריך המסחר לפי שעון הבורסה — אחרי חצות בישראל todayISO כבר "מחר"
  // v139: + שעת הדקה האחרונה שנסחרה (HH:MM בשעון הבורסה) — נקודת "עכשיו" בגרף היומי
  let mdate = null, mtime = null;
  const off = num(meta.gmtoffset) || 0;
  const ts = res.timestamp || [];
  const rawC = ind.close || [];
  let li = Math.min(ts.length, rawC.length) - 1;
  while (li >= 0 && !(rawC[li] > 0)) li--;
  const lastTs = li >= 0 ? num(ts[li]) : num(meta.regularMarketTime);
  if (lastTs > 0) {
    const iso = new Date((lastTs + off) * 1000).toISOString();
    mdate = iso.slice(0, 10);
    if (li >= 0) mtime = iso.slice(11, 16);
  }
  return {
    symbol: sym,
    date: todayISO(),
    mdate: mdate,
    mtime: mtime,
    time: '',
    open: null,
    high: kk(num(meta.regularMarketDayHigh)),
    low: kk(num(meta.regularMarketDayLow)),
    close: close,
    prev: kk(num(meta.chartPreviousClose)),
    session: session,
    volume: parseInt(meta.regularMarketVolume, 10) || 0
  };
}

/* v101: שער דולר־שקל תוך־יומי מ־Yahoo (מתעדכן במסחר).
   נופל בחזרה למקורות היומיים אם Yahoo חסום/מוגבל. */
async function tryFxYahoo() {
  const j = await fetchJSONTimeout('https://query1.finance.yahoo.com/v8/finance/chart/USDILS=X?interval=1m&range=1d', 8000);
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  if (!res) throw new Error('no yahoo fx');
  const meta = res.meta || {};
  let p = num(meta.regularMarketPrice) || num(meta.previousClose);
  if (!(p > 0)) {
    const q = res.indicators && res.indicators.quote && res.indicators.quote[0];
    const c = q && q.close;
    if (c) for (let i = c.length - 1; i >= 0; i--) if (c[i] > 0) { p = c[i]; break; }
  }
  if (!(p > 0)) throw new Error('no yahoo fx');
  return p;
}

async function tryFx() {
  try { return await tryFxYahoo(); } catch (e) {}
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

/* v101: ציור פיל שער הדולר בראש העמוד הראשי */
function paintFxPill(changed) {
  const v = document.getElementById('fxPillValue');
  if (v) {
    v.textContent = state.fx ? '$1 = ₪' + state.fx.toFixed(4) : '—';
    if (changed) {
      const pill = document.getElementById('fxPill');
      if (pill) { pill.classList.remove('flash'); void pill.offsetWidth; pill.classList.add('flash'); }
    }
  }
  const u = document.getElementById('fxPillUpd');
  if (u) u.textContent = state.fxAt ? t('fxUpd', { time: fmtTimeIL(state.fxAt) }) : '';
}

/* v101: טיקר חי — כל 60 שניות מרענן שער דולר בלבד (זול),
   מעדכן את הפיל; אם השער השתנה — גם מספרי ה־₪ בעמוד הראשי. */
let _fxT = null;
function startFxTicker() {
  if (_fxT) return;
  const tick = async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      const r = await tryFx();
      if (!(r > 0)) return;
      if (r !== state.fx) {
        state.fx = r;
        state.fxAt = Date.now();
        paintFxPill(true);
        const ov = document.getElementById('tab-overview');
        if (ov && ov.classList.contains('active')) { try { renderOverview(); } catch (e) {} }
      } else {
        state.fxAt = Date.now();
        paintFxPill(false);
      }
    } catch (e) { /* שומר על השער האחרון */ }
  };
  _fxT = setInterval(tick, 60000);
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

/* ---------------- v139: מחירים חיים ----------------
   ציטוטי Yahoo בזמן אמת (נמדד: נר הדקה האחרון בן שניות) — אותו endpoint
   שכבר עובד מהדפדפן, בלי שרתון ובלי מפתח. כרטיסי מניה פתוחים כל 5 שניות,
   כל התיק כל 10. מעדכן במקום (מחיר/שינוי/שווי/גרף פתוח) — לא בונה מחדש את
   הרשימות, כדי לא לאפס טפסים, מיון, מדידה או כרטיס פתוח. עוצר כשהאפליקציה
   ברקע, בזמן עריכה/הקלדה ובזמן סנכרון IBKR; מאט לדקה כשהמחירים לא זזים
   (שוק סגור). ~50 בקשות בדקה בזמן מסחר — הרבה מתחת לרף החסימה של Yahoo. */
const LIVE_FAST_MS = 5000;
const LIVE_ALL_EVERY = 2;
const LIVE_IDLE_MS = 60000;
const LIVE_IDLE_AFTER = 6;
const live = { timer: null, busy: false, n: 0, still: 0, on: false };

function liveCanTick() {
  if (typeof document !== 'undefined' && document.hidden) return false;
  if (live.busy || state.ibkrSyncing) return false;
  if (state.edit && Object.keys(state.edit).some((k) => state.edit[k])) return false;
  const a = typeof document !== 'undefined' ? document.activeElement : null;
  if (a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName || '')) return false;
  return true;
}

/* אילו סימבולים לשאול בטיק הזה: כל התיק+מעקב בטיק מלא, אחרת רק כרטיסים פתוחים. */
function liveSymbolsFor(full) {
  const all = quoteSymbols();
  if (full) return all;
  return Object.keys(state.open).filter((s) => state.open[s] && all.includes(s));
}

async function liveFetch(syms) {
  const res = await pool(syms, 3, async (sym) => {
    try { return parseYahooQuote(await fetchJSONTimeout(yahooQuoteURL(sym), 8000), sym); } catch (e) { return null; }
  });
  const out = {};
  for (const r of res) if (r) out[r.symbol] = r;
  return out;
}

/* ממזג ציטוטים חדשים — מחזיר את הסימבולים שהמחיר שלהם זז. פונקציה טהורה על state. */
function liveMerge(got) {
  const moved = [];
  for (const s of Object.keys(got)) {
    const old = state.quotes[s];
    if (!old || old.close !== got[s].close) moved.push(s);
    state.quotes[s] = got[s];
  }
  return moved;
}

async function liveTick() {
  live.timer = null;
  if (!live.on) return;
  if (liveCanTick()) {
    const full = live.n % LIVE_ALL_EVERY === 0;
    live.n++;
    const syms = liveSymbolsFor(full);
    if (syms.length) {
      live.busy = true;
      try {
        let got = await liveFetch(syms);
        let src = 'Yahoo';
        // Yahoo חסום/נכשל: CNBC בבקשה אחת לכל הסימבולים (ציטוט מושהה — התווית אומרת "דיליי")
        if (!Object.keys(got).length && full) {
          try { got = parseCNBCQuotes(await fetchJSONTimeout(cnbcURL(), 8000), etSessionNow()) || {}; src = 'CNBC'; } catch (e) { got = {}; }
        }
        if (Object.keys(got).length) {
          const moved = liveMerge(got);
          state.quotesAt = Date.now();
          state.stale = false;
          if (full) {
            live.still = moved.length ? 0 : live.still + 1;
            const sess = (Object.values(got).find((r) => r.session) || {}).session || '';
            state.session = sess === 'regular' ? '' : sess;
            state.source = src;
            state.live = src === 'Yahoo';
            lsSet(LS_QUOTES, { at: state.quotesAt, fx: state.fx, quotes: state.quotes, source: state.source, session: state.session });
            updateSourceLabel();
          }
          if (moved.length) renderLive(moved);
        }
      } catch (e) { /* טיק שנכשל — הבא ינסה שוב */ }
      finally { live.busy = false; }
    }
  }
  liveSchedule();
}

function liveSchedule() {
  if (!live.on) return;
  if (live.timer) clearTimeout(live.timer);
  live.timer = setTimeout(liveTick, live.still >= LIVE_IDLE_AFTER ? LIVE_IDLE_MS : LIVE_FAST_MS);
}

function liveStart() {
  if (live.on) return;
  live.on = true;
  liveSchedule();
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !live.on) return;
    if (live.timer) clearTimeout(live.timer);
    live.n = 0; // חזרה לאפליקציה: טיק מלא מיד
    liveTick();
  });
}

/* עדכון במקום אחרי טיק: כותרת כרטיס (מחיר/שינוי יומי/שווי), אריחי כרטיס פתוח
   וגרף פתוח, סקירה בלי גרף הביצועים, ורשימת המעקב. */
function renderLive(syms) {
  try { renderOverview(true); } catch (e) {}
  for (const s of syms) {
    const p = POSITIONS.find((x) => x.sym === s);
    const card = p && document.querySelector('#stockList .stock[data-sym="' + s + '"]');
    if (!card) continue;
    const fresh = buildStockCard(p);
    for (const cls of ['.stock-price', '.stock-sub']) {
      const a = card.querySelector('.stock-head ' + cls), b = fresh.querySelector('.stock-head ' + cls);
      if (a && b) a.innerHTML = b.innerHTML;
    }
    if (state.open[s]) {
      const g = card.querySelector('.stock-body .kv-grid'), g2 = fresh.querySelector('.stock-body .kv-grid');
      if (g && g2) g.innerHTML = g2.innerHTML;
      if (g) ensureChartData(s, true);
    }
  }
  if (syms.some((s) => WISHLIST.some((w) => w.sym === s))) { try { renderWishlist(); } catch (e) {} }
  try { fitNumbers(); } catch (e) {}
}

/* v139: נקודת "עכשיו" בגרף היומי — המחיר החי בשעת הדקה האחרונה שנסחרה.
   מחליפה את הנר האחרון אם זו אותה דקה, אחרת נוספת אחריו. לא משנה את המטמון. */
function intradayLiveRows(rows, q) {
  const out = (rows || []).slice();
  if (!q || !(q.close > 0) || !q.mtime || !q.mdate || !out.length) return out;
  const last = out[out.length - 1];
  if (q.mdate !== last.date) return out;
  if (q.mtime < (last.time || '')) return out;
  if (q.mtime === last.time) out[out.length - 1] = Object.assign({}, last, { close: q.close });
  else out.push({ date: q.mdate, time: q.mtime, close: q.close });
  return out;
}

function applyQuotes(res) {
  state.quotes = res.quotes;
  state.fx = res.fx;
  state.fxAt = Date.now();
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
    const lag = state.live && state.source === 'Yahoo' ? t('lagLive') : t('lagDelayed');
    el.textContent = t('sourceLabel', { src: state.source || '—', lag: lag, sess: sess, stale: state.stale ? t('staleSuffix') : '' });
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
    try { state.fx = await tryFx(); state.fxAt = Date.now(); } catch (e) { /* אין שער */ }
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
    applyQuotes(res); renderAll();
    // v142: CNBC לא מכיר מניות ת"א — מה שחסר נשלף מ־Yahoo
    const miss = quoteSymbols().filter((sym) => !state.quotes[sym]);
    if (miss.length) liveFetch(miss).then((got) => { if (Object.keys(got).length) { liveMerge(got); renderAll(); } }).catch(() => {});
    return;
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
  // v139: בזיכרון עד 10 דקות (כמו המטמון) — אפליקציה פתוחה שעות לא נתקעת על גרף יומי ישן
  if (state.intra[sym] && Date.now() - ((state.intraAt || {})[sym] || 0) < 10 * 60 * 1000) return state.intra[sym];
  if (!state.intraAt) state.intraAt = {};
  state.intraAt[sym] = Date.now();
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
  const syms = new Set(POSITIONS.map((p) => p.sym));
  for (const x of mtActiveTrades()) syms.add(mtNorm(x).sym); // v141: גם מניות ידניות שנמכרו (לתשואה)
  await pool([...syms], 3, (sym) => getDaily(sym, false));
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
  // v142: שווי ורווח בדולרים (מניה ישראלית מומרת); המחיר נשאר במטבע המניה
  const value = price !== null ? nativeToUSD(price * p.shares, sym) : null;
  const gl = price !== null ? nativeToUSD((price - p.avg) * p.shares, sym) : null;
  let ath = athOf(hist);
  // v139: שיא חדש במחיר החי — ה־ATH הוא המחיר עכשיו, לא השיא הישן מההיסטוריה
  if (price !== null && (!ath || price > ath.price) && hist.length) ath = { price: price, date: (q && (q.mdate || q.date)) || todayISO() };
  const offAth = (ath && price !== null) ? (price - ath.price) / ath.price * 100 : null;
  return { p, q, price, dayChg, value, gl, ath, offAth };
}

function totalsUSD() {
  let stockVal = 0;
  for (const p of POSITIONS) {
    const q = state.quotes[p.sym];
    if (q) stockVal += nativeToUSD(q.close * p.shares, p.sym) || 0;
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
  return POSITIONS.reduce((a, p) => a + (nativeToUSD((num(p.avg) || 0) * (num(p.shares) || 0), p.sym) || 0), 0);
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
      src: 'ibkr',
    });
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

/* ---------------- ביצועי IBKR מהדוח (פונקציות טהורות — נבדקות) ---------------- */
/* מטבע הבסיס של דוח IBKR */
function ibkrBaseCur(data) { return (data && data.meta && data.meta.baseCurrency) || 'USD'; }

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

let ovTwrKind = 'official';
function renderOverview(light) {
  const cur = state.currency;
  const tot = totalsUSD();
  const total = cur === 'ILS' && state.fx ? tot.total * state.fx : tot.total;
  const stockVal = cur === 'ILS' && state.fx ? tot.stockVal * state.fx : tot.stockVal;
  // כרטיס "שווי תיק המניות" — היה מת אף פעם לא מולא (v43)
  const vEl = document.getElementById('ovValue');
  const vSub = document.getElementById('ovValueSub');
  // v141: אחזקות ידניות (מחיר ממוצע / עסקאות) — נכנסות גם במצב IBKR
  const mt = isIbkrMode() ? manualTotalsUSD(POSITIONS, mtActiveTrades(), state.quotes, state.fx) : null;
  const usdToCur = (v) => (cur === 'ILS' ? (state.fx ? v * state.fx : null) : v);
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
      if (disp !== null && mt && mt.value) { const add = usdToCur(mt.value); disp = add === null ? null : disp + add; }
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
    // במצב IBKR: רווח/הפסד = שווי סיום − שווי התחלה − תזרימים נטו (תקופת הדוח).
    // בלי תקופות NAV תקינות — מקף, לא אומדן.
    const data = ibkrCfg().data;
    const pg = rGain(data);
    if (pg === null || !isFinite(pg)) {
      gl = null;
    } else {
      const base = ibkrBaseCur(data);
      gl = (cur === 'ILS' && state.fx && base === 'USD') ? pg * state.fx
        : (cur === 'ILS' ? null : pg);
      if (gl !== null && mt && mt.gain) { const add = usdToCur(mt.gain); gl = add === null ? null : gl + add; }
    }
    if (gSub) gSub.textContent = t('ovInReportPeriod');
  }
  if (gl === null) { gEl.textContent = '—'; }
  else { gEl.textContent = (gl < 0 ? '−' : '+') + money(Math.abs(gl), cur); }
  gEl.className = 'stat-value ' + (gl === null ? '' : gl >= 0 ? 'pos' : 'neg');

  const yEl = document.getElementById('ovYield');
  let ibkrYieldOfficial = true;
  if (isIbkrMode()) {
    // במצב IBKR התשואה הראשית היא ה־TWR הרשמי המשורשר מהדוח.
    // בלי TWR רשמי — "לא זמין", לא אומדן.
    const data = ibkrCfg().data;
    let twr = rHeadlineTwr(data);
    // v141: עסקאות ידניות — TWR משולב מהסדרה היומית (IBKR + ידני)
    let rr = null;
    try { rr = data ? ibkrReturnRows(data) : null; } catch (e) { rr = null; }
    if (rr && rr.kind === 'combined' && rr.rows.length >= 2) {
      const c = combinedHeadlineTwr(twr, rr.rows, rr.base);
      if (c !== null) twr = c;
    }
    ovTwrKind = rr ? rr.kind : 'official';
    const yval = (twr === null || !isFinite(twr)) ? null : twr;
    ibkrYieldOfficial = yval !== null;
    yEl.textContent = yval === null ? '—' : fmtPct(yval, true);
    yEl.className = 'stat-value ' + (yval === null ? '' : yval >= 0 ? 'pos' : 'neg');
  } else {
    yEl.textContent = fmtPct(yld, true);
    yEl.className = 'stat-value ' + (yld === null ? '' : yld >= 0 ? 'pos' : 'neg');
  }

  let twrTxt = '';
  if (isIbkrMode()) {
    twrTxt = ' · ' + (!ibkrYieldOfficial ? t('twrMissingShort')
      : ovTwrKind === 'combined' ? t('twrCombined') : t('twrOfficial'));
    if (ovTwrKind === 'needsDaily') twrTxt += ' · ' + t('twrNeedsDaily');
    if (mt && mt.avgOnly) twrTxt += ' · ' + t('twrAvgNote', { n: mt.avgOnly });
  }
  document.getElementById('ovMeta').textContent =
    t('ovUpdated', { time: state.quotesAt ? fmtTimeIL(state.quotesAt) : '—' }) + twrTxt;
  paintFxPill(false);

  /* v109: כל ציור עטוף בנפרד — כשל באחד לא יחסום את הכרטיסים שאחריו (כולל "ביצועי IBKR") */
  try { drawPie(); } catch (e) {}
  // v139: טיק חי — בלי גרף הביצועים/דוחות/IBKR (לא תלויים במחיר החי, ויאפסו מגע בגרף)
  if (!light) {
    try { drawPfChart(); } catch (e) {}
    try { renderEarningsCard(); } catch (e) {}
    try { renderIbkrPerf(); } catch (e) {}
  }
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
  const base = ibkrBaseCur(data);
  if (period) period.textContent = t('perfPeriod', { a: fmtDateIL(meta.fromDate), b: fmtDateIL(meta.toDate) });
  // מנוע חדש (returns.js): TWR רשמי משורשר, רווח מהזהות החשבונאית, XIRR מתזרימים.
  // בלי TWR רשמי — לא מנחשים: מציגים "לא זמין".
  const sums = rSums(data);
  const twr = rHeadlineTwr(data);
  const gain = rGain(data);
  const official = rSourceKind(data) === 'official';
  const xr = rXirr(rXirrFlows(data));
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
  mrow(t('perfTwr'), official
    ? mval(twr, false)
    : { txt: t('twrMissing'), cls: 'perf-note' });
  mrow(t('perfGain'), gain === null
    ? { txt: '—', cls: '' }
    : mval(gain, true));
  mrow(t('perfXirr'), xr === null
    ? { txt: t('cantCalc'), cls: 'perf-note' }
    : mval(xr, false));
  mrow(t('perfRealized'), mval(sums.realized, true));
  mrow(t('perfUnrealized'), mval(sums.unrealized, true));
  mrow(t('perfDividends'), mval(sums.dividends, true));
  mrow(t('perfWithholding'), mval(sums.withholding, true));
  mrow(t('perfFees'), mval(Math.abs(sums.fees + sums.commissions) < 0.005 ? 0 : -(sums.fees + sums.commissions), true));
  try { fitNumbers(); } catch (e) {}
}

function drawPie() {
  const canvas = document.getElementById('pieChart');
  const tot = totalsUSD();
  let fbIdx = 0;
  const slices = POSITIONS.map((p) => {
    const q = state.quotes[p.sym];
    const v = q ? (nativeToUSD(q.close * p.shares, p.sym) || 0) : 0;
    const branded = !!PIE_BRAND_COLORS[String(p.sym || '').toUpperCase()];
    const color = pieColorFor(p.sym, fbIdx);
    if (!branded) fbIdx++;
    return { sym: p.sym, name: p.name, value: v, color: color };
  }).filter((s) => s.value > 0);
  // v133: כמה מותגים "נופלים" לאותו גוון פסטלי בקירוב (למשל כמה כחולים
  // רשמיים שונים) — מפזרת ביניהם לפני שממשיכים, כדי שכל חברה תיבדל
  // גם ברשימת המקרא ולא רק בין שכנות בטבעת.
  const slicesUnique = pieDedupeColors(slices);
  const total = slicesUnique.reduce((a, s) => a + s.value, 0);

  const dpr = window.devicePixelRatio || 1;
  // v133: גדול ככל שהרוחב הזמין מאפשר (הקנבס מרובע — CSS aspect-ratio:1/1)
  const w = canvas.clientWidth || 320, h = canvas.clientHeight || w;
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (!total) {
    ctx.fillStyle = cssVar('--on-surface-var', '#9AA5A0'); ctx.font = '15px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(t('noPriceYet'), w / 2, h / 2);
    return;
  }
  // v133: חתיכות שכנות (כולל התפר המעגלי) לא בצבעים קרובים מדי — קל להבדיל
  const ordered = pieArrangeSlices(slicesUnique);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 10, r = R * 0.62;
  const band = R - r, rMid = (R + r) / 2;
  let a = -Math.PI / 2;
  for (const s of ordered) {
    const a2 = a + (s.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, R, a, a2);
    ctx.arc(cx, cy, r, a2, a, true);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
    // v133: לוגו החברה בתוך המשולש — בגודל פרופורציונלי לפרוסה (רוחב
    // הטבעת ואורך הקשת), על תג לבן קטן לקריאוּת מעל כל צבע. פרוסות
    // צרות מדי מדלגות על לוגו במקום לדחוס אחד בלתי קריא.
    const mid = (a + a2) / 2;
    const arcLen = (a2 - a) * rMid;
    const box = Math.min(band * 0.78, arcLen * 0.72, 46);
    if (box >= 20) {
      const e = pieLogoImg(s.sym);
      const lx = cx + Math.cos(mid) * rMid, ly = cy + Math.sin(mid) * rMid;
      ctx.save();
      ctx.beginPath(); ctx.arc(lx, ly, box / 2 + 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 3;
      ctx.fill(); ctx.restore();
      if (e.ready && !e.failed && e.img.naturalWidth) {
        const iw = e.img.naturalWidth, ih = e.img.naturalHeight;
        const scale = Math.min(box / iw, box / ih);
        const dw = iw * scale, dh = ih * scale;
        ctx.drawImage(e.img, lx - dw / 2, ly - dh / 2, dw, dh);
      } else if (e.failed) {
        ctx.fillStyle = '#3A3A3C'; ctx.font = '700 ' + Math.round(box * 0.42) + 'px system-ui';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((normalizeSym(s.sym) || '?').charAt(0), lx, ly);
      }
    }
    a = a2;
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = cssVar('--on-surface', '#191C1A'); ctx.textAlign = 'center';
  ctx.font = '700 13px system-ui';
  ctx.fillText(t('totalStocks'), cx, cy - 4);
  ctx.font = '800 17px system-ui';
  const cur = state.currency;
  ctx.fillText(money(cur === 'ILS' && state.fx ? total * state.fx : total, cur), cx, cy + 18);

  const legend = document.getElementById('pieLegend');
  legend.innerHTML = '';
  const sorted = slicesUnique.slice().sort((a, b) => b.value - a.value);
  for (const s of sorted) {
    const li = el('li', '',
      '<span class="pie-leg-logo"><img src="https://financialmodelingprep.com/image-stock/' +
      encodeURIComponent(normalizeSym(s.sym)) + '.png" alt="" loading="lazy" onerror="this.parentElement.style.display=\'none\'"></span>' +
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
      if (c) v += symCur(p.sym) === 'ILS' ? c * p.shares : c * p.shares * fx;
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

  // v126: כפתור מדידה — אותו רכיב כמו בגרף המניה. בלי מצב מדידה, לחיצה על
  // הגרף מציגה רק את התשואות בנקודה (טולטיפ).
  const mb = el('button', 'chip-btn' + (state.pfMeasure.on ? ' on' : ''), t('measure'));
  mb.type = 'button';
  mb.title = t('measureTitle');
  mb.addEventListener('click', () => {
    state.pfMeasure.on = !state.pfMeasure.on;
    state.pfMeasure.pts = [];
    state.pfPickDate = false;
    // הסבר קצר בהודעה צפה — שורת הסבר קבועה הייתה מזיזה את הגרף מתחת לאצבע
    if (state.pfMeasure.on) flash(t('measureOn'));
    hidePfTip();
    renderPfTools();
    updatePfPickUI();
    paintPfChart();
  });
  wrap.appendChild(mb);

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
  const hasDaily = isIbkrMode() && ((ibkrCfg().data || {}).navDaily || []).length > 1;
  if (srcKind === 'ibkr') txt = hasDaily ? t('pfNoteIbkrDaily') : t('pfNoteIbkr');
  else txt = t('pfNote');
  if (srcKind === 'manual') txt += ' · ' + t('pfBenchIbkrOnly');
  else if (noBench) txt += ' · ' + t('pfNoBench');
  try {
    // דיאגנוסטיקת תקופות: כמה תקופות רשמיות נטענו מהדוח
    if (isIbkrMode()) {
      const d = ibkrCfg().data;
      const ps = (typeof rNavPeriods === 'function') ? rNavPeriods(d) : [];
      const twr = (typeof rHeadlineTwr === 'function') ? rHeadlineTwr(d) : null;
      if (ps.length) {
        txt += ' · ' + t('pfDiagPeriods', {
          n: ps.length,
          a: fmtDateIL(ps[0].fromDate),
          b: fmtDateIL(ps[ps.length - 1].toDate),
          twr: (twr === null || twr === undefined) ? '—' : fmtPct(twr, true),
        });
      }
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
  state.pfTipIdx = null;
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
  if (x < map.padL - 14 || x > map.padL + map.plotW + 14) { hidePfTip(); paintPfChart(); return; }
  // הנקודה הקרובה ביותר לפי מיקום בפועל (ציר זמן, לא אינדקס אחיד)
  let idx = 0;
  if (map.xs && map.xs.length === map.n) {
    for (let i = 1; i < map.n; i++) if (Math.abs(map.xs[i] - x) < Math.abs(map.xs[idx] - x)) idx = i;
  } else {
    idx = Math.max(0, Math.min(map.n - 1, Math.round((x - map.padL) / map.plotW * (map.n - 1))));
  }

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
  // v126: בלי מצב מדידה — לחיצה מציגה רק את התשואות בנקודה (סמן + טולטיפ)
  if (!state.pfMeasure.on) {
    showPfTip(idx, x);
    state.pfTipIdx = idx;
    paintPfChart();
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

  const ibkrData = isIbkrMode() ? ibkrCfg().data : null;
  // TWR רשמי משורשר מתקופות הדוח — אין שחזור, אין אומדן.
  const ibkrOfficial = ibkrData && rSourceKind(ibkrData) === 'official';
  let allRows, srcKind = 'manual';
  if (ibkrOfficial) {
    if (loading) loading.classList.add('hidden');
    // v125: יומי מ־NAV יומי (אם הדוח כולל אותו), אחרת נקודות התקופות הרשמיות
    // v141: + עסקאות ידניות (TWR משולב) — טוענים קודם היסטוריה חסרה של המניות הידניות
    let rr = ibkrReturnRows(ibkrData);
    if (rr.kind === 'loading') {
      if (rr.needFx) await ensureFxHist().catch(() => null);
      await pool(rr.missing, 3, (sym) => getDaily(sym, false).catch(() => null));
      if (my !== pfChartToken) return;
      rr = ibkrReturnRows(ibkrData);
    }
    allRows = rr.rows;
    if (allRows.length < 2) allRows = portfolioSeriesILS();
    else srcKind = 'ibkr';
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
    // בלי TWR רשמי מהדוח — אין היסטוריה אמיתית: סימולציית אחזקות נוכחיות (כמו ידני).
    allRows = portfolioSeriesILS();
  }

  // הפרדה בין סוגי משתמשים: השוואת מדדים רק כשההיסטוריה אמיתית מ־IBKR.
  // בהזנה ידנית (סימולציית אחזקות נוכחיות) אין השוואה — רק קו התיק.
  const showBench = pfShowBench(srcKind);

  let pfRows, rangeGap = 0;
  if (state.pfCustomFrom) {
    pfRows = sliceFromDate(allRows, state.pfCustomFrom);
    if (pfRows.length && allRows[0].date < state.pfCustomFrom) rangeGap = pfDaysBetween(pfRows[0].date, state.pfCustomFrom);
  } else {
    const sl = pfSliceRange(allRows, state.pfRange);
    pfRows = sl.rows; rangeGap = sl.gapDays;
  }
  // v125: אין נקודה קרובה לתחילת הטווח (נתוני תקופות, בלי NAV יומי) —
  // לא מציגים תשואה מומצאת. מסבירים איך לקבל נתונים מפורטים.
  if (srcKind === 'ibkr' && rangeGap > 10) {
    if (loading) { loading.textContent = t('pfRangeNeedsDaily'); loading.classList.remove('hidden'); }
    if (legend) legend.innerHTML = '';
    canvas._pfMap = null;
    canvas._pfPaint = null;
    const ctx0 = canvas.getContext && canvas.getContext('2d');
    if (ctx0) ctx0.clearRect(0, 0, canvas.width, canvas.height);
    renderPfNote(true, srcKind);
    renderPfRangeSummary(null);
    renderPfBenchToggles(false);
    return;
  }
  // חיתוך לתחילת תקופת הדוח — טווח שמתחיל לפני שהתיק נפתח מציג תשואה פיקטיבית.
  if (isIbkrMode() && pfRows.length >= 2) {
    try {
      const ps = ibkrData ? rNavPeriods(ibkrData) : [];
      const inception = ps.length ? ps[0].fromDate : null;
      if (inception && pfRows[0].date < inception) {
        // v125: הבסיס = השורה האחרונה עד תחילת התקופה (סגירת היום הקודם, עד
        // שבוע לפני) — אחרת התשואה של יום המסחר הראשון נחתכת מהחישוב
        let bi = pfRows.findIndex((r) => r.date >= inception);
        if (bi > 0 && pfDaysBetween(pfRows[bi - 1].date, inception) <= 7) bi--;
        const cut = bi >= 0 ? pfRows.slice(bi) : [];
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
    { name: srcKind === 'ibkr' ? t('ibkrNavLegend') : t('myPortfolio'), color: cssVar('--primary', '#006A4E'), rows: pfRows },
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
  canvas._pfPaint = { series: series, benchEmpty: benchSeries.length === 0, srcKind: srcKind };
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
  // v125: ציר X לפי זמן, לא לפי אינדקס — בנתוני תקופות (נקודה לשנה) תקופה
  // של יום אחד תפסה רוחב של שנה שלמה והגרף היה מעוות
  const fr = pfTimeFractions(series[0].pts.map((p) => p.date));
  const X = (i) => padL + (n <= 1 ? plotW / 2 : fr[i] * plotW);
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
  // v125: תוויות בלי כפילויות, הראשונה מיושרת לשמאל והאחרונה לימין (לא נחתכות)
  const labels = pfAxisLabels(pts0.map((p) => p.date));
  labels.forEach((lb, k) => {
    ctx.textAlign = labels.length > 1 && k === 0 ? 'left' : (labels.length > 1 && k === labels.length - 1 ? 'right' : 'center');
    const x = ctx.textAlign === 'right' ? Math.min(X(lb.i), w - padR) : X(lb.i);
    ctx.fillText(lb.text, x, h - 20);
  });

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
  if (!ms.on && state.pfTipIdx !== null && state.pfTipIdx < n) drawMarker(state.pfTipIdx);

  canvas._pfMap = { n, padL, plotW, series, xs: fr.map((f) => padL + f * plotW) };
  canvas.classList.toggle('measuring', state.pfPickDate || ms.on);
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

/* v98: רשימת מניות/ETF פופולריות לחיפוש מקומי — גיבוי כשה־API חסום,
   וסובלנות לשגיאות כתיב (מרחק לוינשטיין). */
const POPULAR_STOCKS = [
  'AAPL|Apple Inc.|EQUITY',
  'MSFT|Microsoft Corp.|EQUITY',
  'GOOGL|Alphabet Inc. Class A|EQUITY',
  'GOOG|Alphabet Inc. Class C|EQUITY',
  'AMZN|Amazon.com Inc.|EQUITY',
  'META|Meta Platforms Inc.|EQUITY',
  'NVDA|NVIDIA Corp.|EQUITY',
  'TSLA|Tesla Inc.|EQUITY',
  'AVGO|Broadcom Inc.|EQUITY',
  'ORCL|Oracle Corp.|EQUITY',
  'ADBE|Adobe Inc.|EQUITY',
  'CRM|Salesforce Inc.|EQUITY',
  'AMD|Advanced Micro Devices|EQUITY',
  'INTC|Intel Corp.|EQUITY',
  'QCOM|Qualcomm Inc.|EQUITY',
  'TXN|Texas Instruments|EQUITY',
  'INTU|Intuit Inc.|EQUITY',
  'NOW|ServiceNow Inc.|EQUITY',
  'APP|AppLovin Corp.|EQUITY',
  'UBER|Uber Technologies|EQUITY',
  'MBLY|Mobileye Global|EQUITY',
  'UNH|UnitedHealth Group|EQUITY',
  'NFLX|Netflix Inc.|EQUITY',
  'DIS|Walt Disney Co.|EQUITY',
  'PYPL|PayPal Holdings|EQUITY',
  'SHOP|Shopify Inc.|EQUITY',
  'ABNB|Airbnb Inc.|EQUITY',
  'COIN|Coinbase Global|EQUITY',
  'PLTR|Palantir Technologies|EQUITY',
  'SNOW|Snowflake Inc.|EQUITY',
  'DDOG|Datadog Inc.|EQUITY',
  'CRWD|CrowdStrike Holdings|EQUITY',
  'NET|Cloudflare Inc.|EQUITY',
  'ARM|Arm Holdings|EQUITY',
  'MU|Micron Technology|EQUITY',
  'AMAT|Applied Materials|EQUITY',
  'LRCX|Lam Research Corp.|EQUITY',
  'MRVL|Marvell Technology|EQUITY',
  'JPM|JPMorgan Chase|EQUITY',
  'BAC|Bank of America|EQUITY',
  'WFC|Wells Fargo & Co.|EQUITY',
  'GS|Goldman Sachs|EQUITY',
  'MS|Morgan Stanley|EQUITY',
  'AXP|American Express|EQUITY',
  'V|Visa Inc.|EQUITY',
  'MA|Mastercard Inc.|EQUITY',
  'JNJ|Johnson & Johnson|EQUITY',
  'PFE|Pfizer Inc.|EQUITY',
  'MRK|Merck & Co.|EQUITY',
  'ABBV|AbbVie Inc.|EQUITY',
  'LLY|Eli Lilly & Co.|EQUITY',
  'TMO|Thermo Fisher Scientific|EQUITY',
  'DHR|Danaher Corp.|EQUITY',
  'AMGN|Amgen Inc.|EQUITY',
  'GILD|Gilead Sciences|EQUITY',
  'CVS|CVS Health Corp.|EQUITY',
  'WMT|Walmart Inc.|EQUITY',
  'COST|Costco Wholesale|EQUITY',
  'TGT|Target Corp.|EQUITY',
  'HD|Home Depot Inc.|EQUITY',
  'NKE|Nike Inc.|EQUITY',
  'SBUX|Starbucks Corp.|EQUITY',
  'KO|Coca-Cola Co.|EQUITY',
  'PEP|PepsiCo Inc.|EQUITY',
  'PG|Procter & Gamble|EQUITY',
  'XOM|Exxon Mobil Corp.|EQUITY',
  'CVX|Chevron Corp.|EQUITY',
  'COP|ConocoPhillips|EQUITY',
  'BA|Boeing Co.|EQUITY',
  'CAT|Caterpillar Inc.|EQUITY',
  'DE|Deere & Co.|EQUITY',
  'HON|Honeywell International|EQUITY',
  'UPS|United Parcel Service|EQUITY',
  'GE|General Electric|EQUITY',
  'LMT|Lockheed Martin|EQUITY',
  'RTX|RTX Corp.|EQUITY',
  'T|AT&T Inc.|EQUITY',
  'VZ|Verizon Communications|EQUITY',
  'CMCSA|Comcast Corp.|EQUITY',
  'BRK.B|Berkshire Hathaway B|EQUITY',
  'TSM|Taiwan Semiconductor|EQUITY',
  'ASML|ASML Holding|EQUITY',
  'BABA|Alibaba Group|EQUITY',
  'TEVA|Teva Pharmaceutical|EQUITY',
  'SPY|SPDR S&P 500 ETF|ETF',
  'VOO|Vanguard S&P 500 ETF|ETF',
  'QQQ|Invesco QQQ Trust|ETF',
  'VTI|Vanguard Total Stock Market ETF|ETF',
  'DIA|SPDR Dow Jones Industrial ETF|ETF',
  'IWM|iShares Russell 2000 ETF|ETF',
  'ARKK|ARK Innovation ETF|ETF',
  'XLK|Technology Select Sector SPDR|ETF',
  'XLF|Financial Select Sector SPDR|ETF',
  'SCHD|Schwab US Dividend Equity ETF|ETF',
].map((l) => l.split("|"));

/* v142: מניות בורסת ת"א — סימבול Yahoo (.TA), שם באנגלית, שם בעברית. החיפוש של
   Yahoo לא מקבל עברית (400) — הרשימה הזו מאפשרת "לאומי", "טבע" וכו'. כל הסימבולים
   אומתו מול Yahoo (25/09/2026). מחירי ת"א ב־Yahoo באגורות — מומרים לשקלים בפענוח. */
const TASE_STOCKS = [
  'LUMI.TA|Bank Leumi|לאומי', 'POLI.TA|Bank Hapoalim|הפועלים', 'DSCT.TA|Israel Discount Bank|דיסקונט',
  'MZTF.TA|Mizrahi Tefahot Bank|מזרחי טפחות', 'FIBI.TA|First International Bank|הבינלאומי',
  'TEVA.TA|Teva Pharmaceutical|טבע', 'ESLT.TA|Elbit Systems|אלביט מערכות', 'NICE.TA|NICE Ltd.|נייס',
  'ICL.TA|ICL Group|כיל', 'BEZQ.TA|Bezeq|בזק', 'AZRG.TA|Azrieli Group|עזריאלי', 'DLEKG.TA|Delek Group|קבוצת דלק',
  'NVMI.TA|Nova Ltd.|נובה', 'TSEM.TA|Tower Semiconductor|טאואר', 'ORL.TA|Oil Refineries (Bazan)|בזן',
  'HARL.TA|Harel Insurance|הראל', 'PHOE.TA|Phoenix Financial|הפניקס', 'CLIS.TA|Clal Insurance|כלל ביטוח',
  'MGDL.TA|Migdal Insurance|מגדל', 'MMHD.TA|Menora Mivtachim|מנורה מבטחים', 'SPEN.TA|Shapir Engineering|שפיר הנדסה',
  'ENLT.TA|Enlight Renewable Energy|אנלייט', 'ENRG.TA|Energix|אנרג׳יקס', 'OPCE.TA|OPC Energy|או.פי.סי',
  'SAE.TA|Shufersal|שופרסל', 'STRS.TA|Strauss Group|שטראוס', 'ALHE.TA|Alony-Hetz|אלוני חץ', 'AMOT.TA|Amot Investments|אמות',
  'MLSR.TA|Melisron|מליסרון', 'BIG.TA|BIG Shopping Centers|ביג', 'NWMD.TA|NewMed Energy|ניו־מד',
  'CEL.TA|Cellcom Israel|סלקום', 'PTNR.TA|Partner Communications|פרטנר', 'ELAL.TA|El Al Israel Airlines|אל על',
  'FTAL.TA|Fattal Holdings|פתאל', 'MTRX.TA|Matrix IT|מטריקס', 'ONE.TA|One Software Technologies|וואן טכנולוגיות',
  'ELTR.TA|Electra|אלקטרה', 'SKBN.TA|Shikun & Binui|שיכון ובינוי', 'ASHG.TA|Ashtrom Group|אשטרום',
  'CAMT.TA|Camtek|קמטק', 'KEN.TA|Kenon Holdings|קנון', 'DANE.TA|Danel|דנאל', 'ELCO.TA|Elco|אלקו',
  'HLAN.TA|Hilan|חילן', 'AURA.TA|Aura Investments|אאורה', 'ISRA.TA|Isramco Negev 2|ישראמקו',
  'NXSN.TA|NextVision|נקסטויז׳ן', 'FORTY.TA|Formula Systems|פורמולה מערכות', 'MVNE.TA|Mivne Real Estate|מבנה',
  'ILCO.TA|Israel Corporation|החברה לישראל',
].map((l) => l.split('|'));

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1), cur = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    cur[0] = i;
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    const tmp = prev; prev = cur; cur = tmp;
  }
  return prev[n];
}

/* חיפוש מקומי סובלני־שגיאות: סימבול מדויק/תחילית, שם מכיל, או טעות כתיב קלה.
   v142: גם מניות ת"א — לפי סימבול (עם או בלי .TA), שם באנגלית או בעברית. מיידי. */
function localStockSearch(query) {
  const raw = String(query || '').trim();
  const q = raw.toUpperCase();
  const heb = /[֐-׿]/.test(raw);
  if (q.length < (heb ? 1 : 2)) return [];
  const out = [];
  const score = (sym, name, he) => {
    const base = sym.replace(/\.TA$/, '');
    if (heb) {
      if (!he) return 0;
      if (he === raw) return 100;
      if (he.startsWith(raw)) return 85;
      return he.includes(raw) ? 65 : 0;
    }
    if (sym === q || base === q) return 100;
    if (sym.startsWith(q) || base.startsWith(q)) return 80;
    if (name.toUpperCase().includes(q)) return 60;
    if (q.length >= 3) { const d = levenshtein(base, q); if (d <= 2) return 50 - d * 10; }
    return 0;
  };
  for (const [sym, name, type] of POPULAR_STOCKS) {
    const sc = score(sym, name, '');
    if (sc > 0) out.push({ sym, name, type, _s: sc });
  }
  for (const [sym, name, he] of TASE_STOCKS) {
    const sc = score(sym, name, he);
    if (sc > 0) out.push({ sym, name: he + ' · ' + name, type: 'EQUITY', _s: sc - 1 });
  }
  out.sort((a, b) => b._s - a._s);
  return out.slice(0, 8).map(({ sym, name, type }) => ({ sym, name, type }));
}

/* בדיקת סימבול ישירה דרך Stooq (גיבוי כשה־chart של Yahoo חסום) */
async function stooqDirectSymbol(q) {
  const sym = String(q || '').replace(/[^A-Z0-9.-]/g, '');
  if (!sym || sym.length > 12) return null;
  try {
    const s = sym.includes('.') ? sym : sym + '.US';
    const res = await fetch('https://stooq.com/q/l/?s=' + encodeURIComponent(s) + '&f=sd2t2ohlcv&h&e=csv');
    if (!res.ok) return null;
    const lines = (await res.text()).trim().split('\n');
    if (lines.length < 2) return null;
    const parts = lines[1].split(',');
    if (!parts[6] || parts[6] === 'N/D') return null;
    return { sym, name: sym, type: 'EQUITY' };
  } catch (e) { return null; }
}

/* v142: חיפוש מהיר — הכל במקביל עם timeout קצר, תוצאות מוצגות ברגע שמגיעות,
   ומטמון לכל שאילתה (מחיקה והקלדה חוזרת — מיידי). קודם היה רצף: search API →
   בדיקת סימבול → מקומי, בלי timeout; כשמקור אחד נתקע החיפוש חיכה לו. */
const _searchCache = new Map();
let _searchSeq = 0;
const SEARCH_TIMEOUT_MS = 3500;

function withTimeout(p, ms) {
  return Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);
}

/* מיזוג תוצאות ממקורות שונים — בלי כפילויות, סימבול מדויק (גם עם .TA) ראשון. טהורה. */
function mergeSearchResults(q, lists) {
  const Q = String(q || '').trim().toUpperCase();
  const seen = new Set(), out = [];
  for (const l of lists) for (const it of (l || [])) {
    if (!it || !it.sym || seen.has(it.sym)) continue;
    seen.add(it.sym);
    out.push(it);
  }
  const exact = (it) => (it.sym === Q || it.sym === Q + '.TA' ? 1 : 0);
  return out.sort((x, y) => exact(y) - exact(x)).slice(0, 10);
}

async function searchStocksYahoo(query, onUpdate) {
  const q = String(query || '').trim();
  if (q.length < 1) return [];
  const key = q.toUpperCase();
  if (_searchCache.has(key)) return _searchCache.get(key);
  const heb = /[֐-׿]/.test(q); // Yahoo לא מחפש בעברית — רק הרשימה המקומית
  const local = localStockSearch(q);
  const parts = { api: null, direct: null, stooq: null };
  const all = () => [parts.direct, parts.api, local, parts.stooq];
  const emit = () => { if (onUpdate) onUpdate(mergeSearchResults(q, all())); };
  const tasks = [];
  let apiOk = false;
  if (!heb) {
    tasks.push(withTimeout(yahooSearchAPI(q), SEARCH_TIMEOUT_MS).then((r) => {
      if (Array.isArray(r)) { apiOk = true; parts.api = r; emit(); }
      return r;
    }));
    const sym = normalizeSym(q).replace(/[^A-Z0-9.-]/g, '');
    if (sym && sym.length <= 12) {
      tasks.push(withTimeout(yahooDirectSymbol(sym), SEARCH_TIMEOUT_MS).then((r) => { if (r) { parts.direct = [r]; emit(); } return r; }));
    }
  }
  const res = await Promise.all(tasks);
  if (res.includes('aborted')) return 'aborted';
  let merged = mergeSearchResults(q, all());
  // Stooq רק כמוצא אחרון (איטי יותר) — כשאין שום תוצאה
  if (!merged.length && !heb) {
    const sym = normalizeSym(q).replace(/[^A-Z0-9.-]/g, '');
    const st = sym ? await withTimeout(stooqDirectSymbol(sym), SEARCH_TIMEOUT_MS) : null;
    if (st) { parts.stooq = [st]; merged = mergeSearchResults(q, all()); }
  }
  if (apiOk || heb) _searchCache.set(key, merged); // כשל רשת — לא נשמר, כדי לנסות שוב
  if (!merged.length && !apiOk && !heb) return null;
  return merged;
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
    if (!searchMarketOk(s)) return null;
    return { sym: s, name: meta.longName || meta.shortName || s, type: qt || 'EQUITY' };
  } catch (e) { return null; }
}

/* סימבול שנתמך: ארה"ב (בלי סיומת בורסה) או ת"א (.TA). טהורה. */
function searchMarketOk(sym) {
  const s = String(sym || '').toUpperCase();
  return !/\./.test(s) || /\.TA$/.test(s);
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
    // v142: רק ארה"ב ות"א — בורסות אחרות במטבעות שהאפליקציה לא מתמחרת
    return quotes
      .filter((x) => x && x.symbol && ['EQUITY', 'ETF'].includes(x.quoteType) && searchMarketOk(x.symbol))
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
  if (status === 'loading' && (!items || !items.length)) {
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
      '<span class="ss-type">' + esc(symCur(it.sym) === 'ILS' ? t('mktTase') : it.type) + '</span>' +
      '<span class="ss-add">＋</span>';
    row.addEventListener('click', () => {
      box.classList.add('hidden');
      const inp = document.getElementById('stockSearchInput');
      if (inp) inp.value = '';
      openAddStockWithSymbol(it.sym, it.name);
    });
    box.appendChild(row);
  }
  if (status === 'loading') {
    const d = el('div', 'stock-search-loading');
    d.textContent = '…';
    box.appendChild(d);
  }
}

/* פותח את טופס הוספת המניה עם סימבול (ושם) מולאים מראש.
   v100: כבר לא מפעיל מצב עריכה אוטומטית — הטופס נפתח ישירות,
   וכפתורי עריכה/מחיקה לא צצים יותר על כל המניות הקיימות. */
function openAddStockWithSymbol(sym, name) {
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
    if (card._paintCur) card._paintCur();
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
    const my = ++_searchSeq;
    if (!q) { box.classList.add('hidden'); box.innerHTML = ''; return; }
    const owned = new Set(POSITIONS.map((p) => p.sym));
    // loading = עוד מחכים לרשת (התוצאות שכבר יש מוצגות); ok/empty = סופי
    const show = (items, loading) => {
      if (my !== _searchSeq) return; // תשובה של הקלדה ישנה
      const f = (items || []).filter((r) => !owned.has(r.sym));
      if (f.length) renderStockSearchResults(f, loading ? 'loading' : 'ok');
      else renderStockSearchResults(null, loading ? 'loading' : 'empty');
    };
    const cached = _searchCache.get(q.toUpperCase());
    if (cached) { show(cached, false); return; }
    show(localStockSearch(q), true); // מיידי — בלי לחכות לרשת
    _stockSearchT = setTimeout(async () => {
      const res = await searchStocksYahoo(q, (partial) => show(partial, true));
      if (res === 'aborted' || my !== _searchSeq) return;
      if (res === null) {
        const loc = localStockSearch(q);
        if (loc.length) show(loc, false); else renderStockSearchResults(null, 'error');
        return;
      }
      show(res, false);
    }, 150);
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
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(s)) return t('errSymInvalid');
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
    '<label>' + t('fldAvgPrice', { c: symCur(p.sym) === 'ILS' ? '₪' : '$' }) + '<input id="ep-avg" type="number" min="0" step="any" inputmode="decimal" value="' + p.avg + '"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="ep-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="ep-save" type="button">' + t('btnSave') + '</button>' +
    '<button class="link-btn" id="ep-cancel" type="button">' + t('btnCancel') + '</button>' +
    '<button class="chip-btn danger" id="ep-delete" type="button">' + t('btnDelete') + '</button></div>';
  body.querySelector('#ep-cancel').addEventListener('click', () => refreshStockBody(p.sym));
  body.querySelector('#ep-delete').addEventListener('click', () => deletePosition(p));
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
  // v141: שני מצבים — לפי מחיר ממוצע (מהיר) או לפי עסקאות (תאריך לכל קנייה)
  let mode = 'avg';
  card.innerHTML =
    '<h2>' + t('addStockTitle') + '</h2>' +
    '<div class="chip-row add-mode">' +
    '<button type="button" class="range-btn active" data-mode="avg">' + t('addModeAvg') + '</button>' +
    '<button type="button" class="range-btn" data-mode="trades">' + t('addModeTrades') + '</button>' +
    '</div>' +
    '<p class="fine add-mode-hint" id="ap-hint">' + esc(t('addModeAvgHint')) + '</p>' +
    '<div class="form-grid">' +
    '<label>' + t('fldSymbol') + '<input id="ap-sym" type="text" dir="ltr" placeholder="NVDA" autocomplete="off"></label>' +
    '<label>' + t('fldNameHe') + '<input id="ap-name" type="text" placeholder="' + t('phExampleName') + '"></label>' +
    '<label>' + t('fldFullName') + '<input id="ap-full" type="text" dir="ltr" placeholder="NVIDIA Corp" autocomplete="off"></label>' +
    '<label class="m-avg">' + t('fldShares') + '<input id="ap-shares" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '<label class="m-avg">' + '<span>' + t('fldAvgPrice', { c: '<span class="cur-sym">$</span>' }) + '</span>' + '<input id="ap-avg" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '<label class="m-tr hidden">' + t('fldDate') + '<input id="ap-date" type="date" max="' + todayISO() + '" value="' + todayISO() + '"></label>' +
    '<label class="m-tr hidden">' + t('fldTradeQty') + '<input id="ap-qty" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '<label class="m-tr hidden">' + '<span>' + t('fldTradePrice', { c: '<span class="cur-sym">$</span>' }) + '</span>' + '<input id="ap-price" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '<label class="m-tr hidden">' + '<span>' + t('fldFee', { c: '<span class="cur-sym">$</span>' }) + '</span>' + '<input id="ap-fee" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="ap-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="ap-save" type="button">' + t('btnAddStock') + '</button>' +
    '<button class="link-btn" id="ap-cancel" type="button">' + t('btnCancel') + '</button></div>';
  list.insertBefore(card, list.firstChild);
  bindCurSym(card, card.querySelector('#ap-sym'));
  card.querySelectorAll('.add-mode [data-mode]').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    card.querySelectorAll('.add-mode [data-mode]').forEach((x) => x.classList.toggle('active', x === b));
    card.querySelectorAll('.m-avg').forEach((x) => x.classList.toggle('hidden', mode !== 'avg'));
    card.querySelectorAll('.m-tr').forEach((x) => x.classList.toggle('hidden', mode !== 'trades'));
    card.querySelector('#ap-hint').textContent = (mode === 'avg' ? t('addModeAvgHint') : t('addModeTradesHint'));
  }));
  card.querySelector('#ap-cancel').addEventListener('click', () => card.remove());
  card.querySelector('#ap-save').addEventListener('click', () => {
    const sym = card.querySelector('#ap-sym').value.trim().toUpperCase();
    const name = card.querySelector('#ap-name').value.trim() || sym;
    const full = card.querySelector('#ap-full').value.trim();
    const errEl = card.querySelector('#ap-err');
    const fail = (m) => { errEl.textContent = m; errEl.classList.remove('hidden'); };
    if (mode === 'avg') {
      const shares = parseFloat(card.querySelector('#ap-shares').value);
      const avg = parseFloat(card.querySelector('#ap-avg').value);
      const err = validPosition(sym, shares, avg, null);
      if (err) return fail(err);
      POSITIONS.push({ sym: sym, name: name, full: full, shares: shares, avg: avg, src: 'manual' });
    } else {
      const err0 = validPosition(sym, 1, 1, null);
      if (err0) return fail(err0);
      const tr = { id: mtNewId(), date: card.querySelector('#ap-date').value, sym: sym, side: 'BUY',
        qty: parseFloat(card.querySelector('#ap-qty').value), price: parseFloat(card.querySelector('#ap-price').value),
        fee: parseFloat(card.querySelector('#ap-fee').value) || 0 };
      const err = mtValidate(mtList(), tr, null);
      if (err) return fail(err);
      mtList().push(mtNorm(tr));
      POSITIONS.push({ sym: sym, name: name, full: full, shares: 0, avg: 0, src: 'manual', fromTrades: true });
      mtSyncPositions();
    }
    saveDB();
    card.remove();
    renderAll();
    flash(t('stockAdded'));
    refreshQuotes().then(() => warmHistories());
  });
}

/* v142: סימן המטבע בתוויות המחיר מתעדכן לפי הסימבול — ₪ למניה בת"א (.TA), אחרת $ */
function bindCurSym(card, symInp) {
  if (!card || !symInp) return;
  const paint = () => {
    const c = symCur(symInp.value.trim()) === 'ILS' ? '₪' : '$';
    card.querySelectorAll('.cur-sym').forEach((x) => { x.textContent = c; });
  };
  symInp.addEventListener('input', paint);
  card._paintCur = paint;
  paint();
}

function mtNewId() {
  return 'mt' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* טופס עסקה ידנית (חדשה או עריכה). host = איפה להציג; opts: { sym, lockSym,
   trade (לעריכה), name, onClose }. */
function showTradeForm(host, opts) {
  const o = opts || {};
  if (!host || host.querySelector('.mt-form')) return;
  const tr = o.trade ? mtNorm(o.trade) : null;
  let side = tr ? tr.side : 'BUY';
  const card = el('div', 'card mt-form');
  const v = (x) => (x === undefined || x === null ? '' : String(x));
  card.innerHTML =
    '<h2>' + (tr ? t('mtEditTitle') : t('mtAddTitle')) + '</h2>' +
    '<div class="chip-row add-mode">' +
    '<button type="button" class="range-btn" data-side="BUY">' + t('buySide') + '</button>' +
    '<button type="button" class="range-btn" data-side="SELL">' + t('sellSide') + '</button>' +
    '</div>' +
    '<div class="form-grid">' +
    '<label>' + t('fldSymbol') + '<input class="mt-sym" type="text" dir="ltr" autocomplete="off" placeholder="GOOG" value="' + esc(v(tr ? tr.sym : o.sym)) + '"' + (o.lockSym || tr ? ' readonly' : '') + '></label>' +
    '<label>' + t('fldDate') + '<input class="mt-date" type="date" max="' + todayISO() + '" value="' + esc(tr ? tr.date : todayISO()) + '"></label>' +
    '<label>' + t('fldTradeQty') + '<input class="mt-qty" type="number" min="0" step="any" inputmode="decimal" value="' + esc(v(tr && tr.qty)) + '"></label>' +
    '<label>' + '<span>' + t('fldTradePrice', { c: '<span class="cur-sym">$</span>' }) + '</span>' + '<input class="mt-price" type="number" min="0" step="any" inputmode="decimal" value="' + esc(v(tr && tr.price)) + '"></label>' +
    '<label>' + '<span>' + t('fldFee', { c: '<span class="cur-sym">$</span>' }) + '</span>' + '<input class="mt-fee" type="number" min="0" step="any" inputmode="decimal" value="' + esc(v(tr && tr.fee ? tr.fee : '')) + '"></label>' +
    '</div>' +
    '<div class="form-err hidden"></div>' +
    '<div class="edit-actions"><button class="btn mt-save" type="button">' + t('btnSave') + '</button>' +
    '<button class="link-btn mt-cancel" type="button">' + t('btnCancel') + '</button></div>';
  const paintSide = () => card.querySelectorAll('[data-side]').forEach((b) => b.classList.toggle('active', b.dataset.side === side));
  paintSide();
  card.querySelectorAll('[data-side]').forEach((b) => b.addEventListener('click', () => { side = b.dataset.side; paintSide(); }));
  host.insertBefore(card, host.firstChild);
  bindCurSym(card, card.querySelector('.mt-sym'));
  const close = () => { card.remove(); if (o.onClose) o.onClose(); };
  card.querySelector('.mt-cancel').addEventListener('click', close);
  card.querySelector('.mt-save').addEventListener('click', () => {
    const errEl = card.querySelector('.form-err');
    const fail = (m) => { errEl.textContent = m; errEl.classList.remove('hidden'); };
    const cand = {
      id: tr ? tr.id : mtNewId(),
      sym: card.querySelector('.mt-sym').value.trim().toUpperCase(),
      date: card.querySelector('.mt-date').value, side: side,
      qty: parseFloat(card.querySelector('.mt-qty').value),
      price: parseFloat(card.querySelector('.mt-price').value),
      fee: parseFloat(card.querySelector('.mt-fee').value) || 0,
    };
    const held = POSITIONS.find((p) => p.sym === cand.sym);
    if (held && !held.fromTrades) return fail((held.src === 'manual' ? t('mtErrHeldAvg', { sym: cand.sym }) : t('mtErrHeldIbkr', { sym: cand.sym })));
    const err = mtValidate(mtList(), cand, tr ? tr.id : null);
    if (err) return fail(err);
    const list = mtList();
    const i = tr ? list.findIndex((x) => String(x.id) === String(tr.id)) : -1;
    if (i >= 0) list[i] = mtNorm(cand); else list.push(mtNorm(cand));
    if (!held) POSITIONS.push({ sym: cand.sym, name: o.name || cand.sym, full: '', shares: 0, avg: 0, src: 'manual', fromTrades: true });
    mtSyncPositions();
    saveDB();
    card.remove();
    renderAll();
    flash(t('mtSaved'));
    refreshQuotes().then(() => warmHistories());
  });
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function mtDeleteTrade(x) {
  const n = mtNorm(x);
  const rest = mtList().filter((y) => String(y.id) !== String(n.id));
  if (mtOversold(rest, n.sym)) { alert(t('mtErrDeleteBreaks')); return false; }
  if (!confirm(t('mtDelConfirm', { side: (n.side === 'BUY' ? t('buySide') : t('sellSide')), qty: n.qty, sym: n.sym, date: fmtDateIL(n.date) }))) return false;
  DB.manualTrades = rest;
  mtSyncPositions();
  saveDB();
  renderAll();
  flash(t('mtDeleted'));
  return true;
}

/* שורת עסקה ידנית — כמו שורת IBKR + תגית "ידני" וכפתורי עריכה/מחיקה. */
function buildManualTradeRow(x, onEdit) {
  const n = mtNorm(x);
  const li = buildTradeRow({ date: n.date, symbol: n.sym, side: n.side, qty: n.qty, price: n.price, commission: n.fee, currency: symCur(n.sym) });
  li.classList.add('mt-row');
  const first = li.firstChild;
  if (first) {
    const tag = el('span', 'src-tag', t('manualTag'));
    first.insertBefore(tag, first.querySelector('br'));
    if (mtShadowed(n.sym)) first.appendChild(el('div', 'fine', t('mtShadowed', { sym: n.sym })));
  }
  const act = el('span', 'mt-actions');
  const eb = el('button', 'link-btn', t('btnEditRow'));
  eb.type = 'button';
  eb.addEventListener('click', () => onEdit(x));
  const db = el('button', 'link-btn danger', t('btnDeleteRow'));
  db.type = 'button';
  db.addEventListener('click', () => mtDeleteTrade(x));
  act.appendChild(eb);
  act.appendChild(db);
  (li.lastChild || li).appendChild(act);
  return li;
}

/* ניהול העסקאות של מניה אחת — בתוך הכרטיס הפתוח. */
function showPositionTrades(card, p) {
  const body = card.querySelector('.stock-body');
  card.classList.add('open');
  body.innerHTML = '';
  const wrap = el('div', 'mt-manage');
  wrap.appendChild(el('p', 'fine', t('mtManageHint')));
  const formHost = el('div');
  wrap.appendChild(formHost);
  const ul = el('ul', 'rows');
  const trades = mtList().filter((x) => mtNorm(x).sym === p.sym)
    .sort((a, b) => (mtNorm(a).date < mtNorm(b).date ? 1 : -1));
  const edit = (x) => showTradeForm(formHost, { trade: x, lockSym: true });
  for (const x of trades) ul.appendChild(buildManualTradeRow(x, edit));
  wrap.appendChild(ul);
  const actions = el('div', 'edit-actions');
  const add = el('button', 'btn', t('btnAddTrade'));
  add.type = 'button';
  add.addEventListener('click', () => showTradeForm(formHost, { sym: p.sym, lockSym: true, name: p.name }));
  const close = el('button', 'link-btn', t('btnCancel'));
  close.type = 'button';
  close.addEventListener('click', () => refreshStockBody(p.sym));
  const del = el('button', 'chip-btn danger', t('btnDelete'));
  del.type = 'button';
  del.addEventListener('click', () => deletePosition(p));
  actions.appendChild(add);
  actions.appendChild(close);
  actions.appendChild(del);
  wrap.appendChild(actions);
  body.appendChild(wrap);
}

function deletePosition(p) {
  // v141: מניה לפי עסקאות — מוחקים גם את העסקאות שלה (אחרת היא "חוזרת" מהן)
  const own = p.fromTrades ? mtList().filter((x) => mtNorm(x).sym === p.sym) : [];
  const msg = own.length ? t('delTradesPosConfirm', { sym: p.sym, n: own.length }) : t('delStockConfirm', { name: p.name, sym: p.sym });
  if (!confirm(msg)) return;
  if (own.length) DB.manualTrades = mtList().filter((x) => mtNorm(x).sym !== p.sym);
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
  if (!/^[A-Z0-9][A-Z0-9.\-]{0,11}$/.test(s)) return { err: t('errSymInvalid') };
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
        ? '<span class="wl-close" dir="ltr">' + (symCur(w.sym) === 'ILS' ? fmtILS2(close) : fmtUSD2(close)) + '</span>'
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
   v97: אריח לבן תמיד (גם בערכת כהה); אות הגיבוי מוסתרת ברגע שהלוגו
   נטען — נראית רק אם הטעינה נכשלה. */
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
/* v97: מסתיר את אות הגיבוי ברגע שהלוגו נטען (שלא תציץ מאחוריו),
   והופך לוגו בהיר כדי שייראה על האריח הלבן. */
function logoImgFix(img) {
  try {
    const fb = img.previousElementSibling;
    if (fb && fb.classList && fb.classList.contains('stock-logo-fb')) fb.style.display = 'none';
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h || w < 4 || h < 4) return;
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
    if (avg > 205) {
      img.style.filter = 'invert(1)';
    }
  } catch (e) { /* תמונה מוכתמת (tainted) — משאיר כמו שהיא */ }
}

function buildStockCard(p) {
  const sym = p.sym;
  const m = metrics(sym);
  const cur = state.currency;
  const priceTxt = m.price === null ? '—' : fmtPx(m.price, sym);

  const card = el('div', 'stock' + (state.open[sym] ? ' open' : ''));
  card.dataset.sym = sym;
  const head = el('button', 'stock-head');
  head.type = 'button';
  head.innerHTML =
    '<span class="stock-id">' + stockLogoHTML(sym) + '<span class="stock-sym">' + sym + '</span>' +
    '<span class="stock-name">' + esc(p.name) + '</span>' +
    (p.src === 'manual' ? '<span class="src-tag">' + esc(t('manualTag')) + '</span>' : '') + '</span>' +
    '<span class="stock-price">' + priceTxt + '</span>' +
    '<span class="stock-sub"><span class="day-chg ' + (m.dayChg === null ? '' : m.dayChg >= 0 ? 'pos' : 'neg') + '">' +
    (m.dayChg === null ? '—' : t('todayChg', { v: fmtPct(m.dayChg, true) })) + '</span>' +
    '<span>' + (m.value === null ? '—' : money(cur === 'ILS' && state.fx ? m.value * state.fx : m.value, cur)) +
    ' <span class="chev">▾</span></span></span>';
  head.addEventListener('click', () => toggleStock(sym, card));
  card.appendChild(head);

  // v100: אין יותר כפתורי עריכה/מחיקה גלובליים על הכרטיסים.
  // "ערוך" מופיע בתחתית הכרטיס הפתוח (ב־buildStockBody), ו"מחק" רק בתוך טופס העריכה.

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
    kvHTML(t('kvAvg'), fmtPx(p.avg, sym)) +
    kvHTML(t('kvValue'), m.value === null ? '—' : money(toCur(m.value), cur)) +
    kvHTML(t('kvGL'),
      m.gl === null ? '—' : (m.gl < 0 ? '−' : '+') + money(Math.abs(toCur(m.gl)), cur) +
        ' (' + fmtPct(p.avg > 0 ? (m.price / p.avg - 1) * 100 : null, true) + ')',
      m.gl === null ? '' : m.gl >= 0 ? 'pos' : 'neg') +
    kvHTML(t('kvWeight'), weightTxt(sym)) +
    (p.fromTrades ? (() => {
      const rz = mtPosition(mtList(), sym).realized;
      const rzU = nativeToUSD(rz, sym);
      return rzU !== null && Math.abs(rz) > 0.005 ? kvHTML(t('kvRealized'), (rz < 0 ? '−' : '+') + money(Math.abs(toCur(rzU)), cur), rz >= 0 ? 'pos' : 'neg') : '';
    })() : '') +
    // v102: אריח ATH מינימליסטי — רק מחיר ותאריך, מעט גדולים יותר
    kvHTML('ATH',
      m.ath ? fmtPx(m.ath.price, sym) +
        '<br><span style="font-weight:400;font-size:14px">' + fmtDateIL(m.ath.date) + '</span>'
        : (state.hist[sym] ? '—' : '…'));
  wrap.appendChild(grid);

  if (!state.range[sym]) state.range[sym] = 'year';
  // v107: שורת כלים בשבלונת הגרף הראשי — כפתור מדידה נקי (chip-btn)
  const tools = el('div', 'pf-tools');
  const mb = el('button', 'chip-btn' + (measureState(sym).on ? ' on' : ''), t('measure'));
  mb.type = 'button';
  mb.title = t('measureTitle');
  mb.addEventListener('click', () => {
    const ms = measureState(sym);
    ms.on = !ms.on;
    ms.pts = [];
    refreshStockBody(sym);
  });
  tools.appendChild(mb);
  wrap.appendChild(tools);

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

  // v107: טווחים מתחת לגרף + שורת תשואה + legend — כמו בגרף הראשי
  const ranges = el('div', 'chip-row stock-chips');
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
  wrap.appendChild(ranges);

  const sret = el('div', 'pf-range-summary');
  sret.id = 'sret-' + sym;
  wrap.appendChild(sret);

  const sleg = el('ul', 'legend');
  sleg.id = 'sleg-' + sym;
  wrap.appendChild(sleg);

  const hint = el('div', 'chart-hint',
    measureState(sym).on ? t('measureOn') : t('measureTip'));
  wrap.appendChild(hint);

  attachMeasure(canvas, sym);
  // ציור יתבצע אחרי טעינת היסטוריה (ensureChartData)

  // v100: כפתור "ערוך" בתחתית הכרטיס הפתוח — מופיע תמיד בלחיצה על המניה,
  // לא תלוי במצב העריכה הגלובלי. כפתור המחיקה נחשף רק בתוך טופס העריכה.
  // v141: גם במצב IBKR — למניות ידניות. מניה לפי עסקאות נפתחת לניהול העסקאות.
  if (!isIbkrMode() || p.src === 'manual') {
    const actions = el('div', 'edit-actions');
    const eb = el('button', 'chip-btn', p.fromTrades ? t('btnManageTrades') : t('btnEdit'));
    eb.type = 'button';
    eb.addEventListener('click', () => {
      const card = document.querySelector('#stockList .stock[data-sym="' + sym + '"]');
      if (!card) return;
      if (p.fromTrades) showPositionTrades(card, p); else showEditPositionForm(card, p);
    });
    actions.appendChild(eb);
    wrap.appendChild(actions);
  }

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
  const v = nativeToUSD(q.close * p.shares, sym);
  return v === null ? '—' : (v / tot.stockVal * 100).toFixed(1) + '%';
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

async function ensureChartData(sym, quiet) {
  const loading = document.getElementById('cload-' + sym);
  const range = state.range[sym] || 'year';
  if (loading && !quiet) { loading.classList.remove('hidden'); loading.textContent = t('loadingData'); }
  try {
    if (range === 'day') {
      const intra = await getIntraday(sym);
      if (intra.length) {
        drawStockChart(sym, intradayLiveRows(intra, state.quotes[sym]), true);
        if (loading) loading.classList.add('hidden');
        return;
      }
      // נפילה לגרף יומי אם אין תוך-יומי
    }
    let hist = await getDaily(sym, false);
    // v134: היסטוריה בזיכרון/מטמון שנתקעה ימים אחורה (אפליקציה פתוחה ברקע) — טוענים מחדש
    const lastD = hist && hist.length ? hist[hist.length - 1].date : '';
    if (lastD && daysBetweenIso(lastD, todayISO()) > 4) {
      try { const fresh = await getDaily(sym, true); if (fresh && fresh.length) hist = fresh; } catch (e) {}
    }
    const rows = stockChartRows(hist, state.quotes[sym]);
    const pts = drawStockChart(sym, stockRangeRows(rows, range === 'day' ? 'month' : range), false);
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

  // v107: שבלונת הציור של הגרף הראשי — גיאומטריה, טיפוגרפיה, קו, סמנים
  const padL = 6, padR = 54, padT = 10, padB = 36;
  const plotW = w - padL - padR, plotH = h - padT - padB;
  let min = Infinity, max = -Infinity;
  for (const p of pts) { if (p.close < min) min = p.close; if (p.close > max) max = p.close; }
  if (min === max) { min *= 0.99; max *= 1.01; }
  const X = (i) => padL + (pts.length === 1 ? plotW / 2 : (i / (pts.length - 1)) * plotW);
  const Y = (v) => padT + (1 - (v - min) / (max - min)) * plotH;

  const up = pts[pts.length - 1].close >= pts[0].close;
  const lineCol = up ? cssVar('--gain', '#137333') : cssVar('--loss', '#B3261E');

  // רשת אופקית + תוויות מחיר
  ctx.font = '12.5px system-ui'; ctx.textBaseline = 'middle';
  for (let g = 0; g <= 4; g++) {
    const v = min + (max - min) * g / 4;
    const y = Y(v);
    ctx.strokeStyle = cssVar('--outline', '#E3E7E4'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
    ctx.fillStyle = cssVar('--on-surface-var', '#9AA5A0');
    ctx.textAlign = 'left';
    ctx.fillText(symCur(sym) === 'ILS' ? fmtILS2(v) : fmtUSD2(v), w - padR + 6, y);
  }

  // קו — 2.5px כמו בגרף הראשי, בלי מילוי שטח
  ctx.beginPath();
  pts.forEach((p, i) => { const x = X(i), y = Y(p.close); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
  ctx.strokeStyle = lineCol; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();

  // תוויות ציר זמן — כמו בגרף הראשי (MM/YYYY, צעד קבוע, בלי חפיפות)
  ctx.fillStyle = cssVar('--on-surface-var', '#9AA5A0');
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const n = pts.length;
  const step = Math.max(1, Math.floor(n / 4));
  for (let i = 0; i < n; i += step) {
    const lbl = intraday ? pts[i].label : fmtDateIL(pts[i].date).slice(3);
    ctx.fillText(lbl, X(i), h - 20);
  }

  // סמני מדידה — כמו בגרף הראשי: הילה רכה, קו מקווקו, טבעת לבנה, רצועה בין הנקודות
  const marker = cssVar('--primary', '#006A4E');
  if (ms.pts.length >= 2) {
    const a = Math.min(ms.pts[0], ms.pts[1]), b = Math.max(ms.pts[0], ms.pts[1]);
    ctx.fillStyle = marker + '1F';
    ctx.fillRect(X(a), padT, X(b) - X(a), plotH);
  }
  const drawMarker = (i) => {
    const x = X(i), y = Y(pts[i].close);
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

  // שמירת מיפוי למדידה
  canvas._chartMap = { n: pts.length, padL: padL, plotW: plotW, pts: pts };
  canvas.classList.toggle('measuring', ms.on || ms.pts.length > 0);
  updateMeasureChip(sym);
  renderStockRangeSummary(sym, pts, lineCol);
  return pts;
}

/* v107: שורת תשואת הטווח + legend לגרף המניה — כמו בגרף הראשי */
function renderStockRangeSummary(sym, pts, lineCol) {
  const box = document.getElementById('sret-' + sym);
  const leg = document.getElementById('sleg-' + sym);
  if (!pts || pts.length < 2) {
    if (box) box.innerHTML = '';
    if (leg) leg.innerHTML = '';
    return;
  }
  const r = (pts[pts.length - 1].close - pts[0].close) / pts[0].close * 100;
  let rangeName = '';
  for (const [rk, labelKey] of RANGES) {
    if (rk === (state.range[sym] || 'year')) { rangeName = t(labelKey); break; }
  }
  if (box) box.innerHTML = '<span>' + esc(t('stockRangeReturn')) + '</span>' +
    '<span class="rs-val ' + (r >= 0 ? 'pos' : 'neg') + '">' + fmtPct(r, true) + '</span>' +
    (rangeName ? '<span class="rs-range">' + esc(rangeName) + '</span>' : '');
  if (leg) leg.innerHTML = '<li><span class="dot" style="background:' + lineCol + '"></span>' +
    '<span class="lg-name">' + esc(sym) + '</span>' +
    '<span class="lg-pct">' + fmtRetHTML(r) + '</span></li>';
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
  const ib = ready ? ibkrTrades() : [];
  const man = mtList();
  if (cnt) cnt.textContent = ib.length + man.length;
  list.innerHTML = '';
  if (hint) {
    // v141: בלי IBKR עדיין אפשר עסקאות ידניות — ההסבר רק כשאין כלום להציג
    const showHint = !ready && !man.length;
    hint.classList.toggle('hidden', !showHint);
    if (showHint) hint.textContent = t('tradesNeedIbkr');
  }
  if (!ib.length && !man.length) {
    if (ready) list.appendChild(el('p', 'fine', t('tradesEmpty')));
    return;
  }
  // מאוחד, מהחדש לישן — ידניות מסומנות ועם עריכה/מחיקה
  const host = document.getElementById('tradeFormHost');
  const edit = (x) => { if (host) { host.innerHTML = ''; showTradeForm(host, { trade: x }); } };
  const rows = ib.map((x) => ({ d: String(x.date || '').slice(0, 10), ib: x }))
    .concat(man.map((x) => ({ d: mtNorm(x).date, mt: x })))
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  for (const r of rows) list.appendChild(r.mt ? buildManualTradeRow(r.mt, edit) : buildTradeRow(r.ib));
}

function renderDeposits() {
  // v145: במצב IBKR — גם כסף שנכנס מחוץ ל־IBKR דרך קניות ידניות (סה"כ = IBKR + ידני)
  const mf = isIbkrMode()
    ? manualFlowsILS(POSITIONS, mtActiveTrades(), (iso) => fxOnOrBefore(iso), state.fx) : null;
  const hasMf = !!(mf && (mf.rows.length || mf.avgRows.length));
  if (hasMf && !fxHistCache && mf.rows.some((r) => symCur(r.sym) !== 'ILS') && !state._depFxLoading) {
    state._depFxLoading = true; // שער יום העסקה — נטען פעם אחת ומצייר שוב
    ensureFxHist().then(() => renderDeposits()).catch(() => null);
  }
  const nd = netDepositsILS() + (hasMf ? mf.inILS : 0);
  const ndTxt = (nd < 0 ? '−' : '') + '₪' + Math.abs(Math.round(nd * 100) / 100).toLocaleString('en-US');
  document.getElementById('depTotal').textContent = ndTxt;
  document.getElementById('depCount').textContent = t('records', { n: DEPOSITS.length }) +
    (hasMf ? ' · ' + t('depInclManual', { amt: (mf.inILS < 0 ? '−' : '') + '₪' + Math.abs(mf.inILS).toLocaleString('en-US') }) : '');
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
  if (hasMf) {
    const head = el('li', 'dep-sub');
    head.innerHTML = '<span><b>' + esc(t('depManualTitle')) + '</b><br><span class="r-note">' +
      esc(t('depManualNote')) + '</span></span>';
    ul.appendChild(head);
    const side = (s) => (s === 'SELL' ? t('sellSide') : t('buySide'));
    for (const r of mf.rows) {
      const li = el('li');
      li.innerHTML = '<span><span class="r-date">' + fmtDateIL(r.date) + '</span> <span class="src-tag">' +
        esc(t('manualTag')) + '</span><br><span class="r-note">' + esc(r.sym) + ' · ' + esc(side(r.side)) +
        ' ' + r.qty + ' × ' + esc(fmtPx(r.price, r.sym)) + '</span></span>' +
        '<span>' + depositAmountHTML(r.amount) + '</span>';
      ul.appendChild(li);
    }
    for (const r of mf.avgRows) {
      const li = el('li');
      li.innerHTML = '<span><span class="r-date">' + esc(t('depManualAvg')) + '</span> <span class="src-tag">' +
        esc(t('manualTag')) + '</span><br><span class="r-note">' + esc(r.sym) + ' · ' + r.qty + ' × ' +
        esc(fmtPx(r.price, r.sym)) + '</span></span>' +
        '<span>' + depositAmountHTML(r.amount) + '</span>';
      ul.appendChild(li);
    }
  }
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
  // v141: מניה שנוספה ביד במצב IBKR (לפני v141) מסומנת ידנית — נכללת בחישובים ונשמרת בסנכרון
  try { if (markManualPositions()) saveDB(); } catch (e) {}
  renderOverview();
  renderStocks();
  renderTrades();
  renderWishlist();
  renderDeposits();
  renderPension();
  renderIbkrLocks();
  try { renderDemoUi(); } catch (e) {}
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
  // טאבים
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => switchTab(t.dataset.tab));
  });
  // מטבע — כפתור בטאב ההגדרות + כפתור בהדר (v109) שמחליפים בין $ ל־₪; נשמר בין רענונים
  const paintCurBtn = () => {
    const lbl = state.currency === 'ILS' ? '₪' : '$';
    const b = document.getElementById('setCurBtn');
    if (b) b.textContent = lbl;
    const h = document.getElementById('curToggleBtn');
    if (h) h.textContent = lbl;
  };
  const setCur = (c) => {
    state.currency = c;
    try { localStorage.setItem('pwa_currency_v1', c); } catch (e) {}
    paintCurBtn();
    renderAll();
  };
  const curBtn = document.getElementById('setCurBtn');
  if (curBtn) curBtn.addEventListener('click', () => setCur(state.currency === 'ILS' ? 'USD' : 'ILS'));
  const curToggle = document.getElementById('curToggleBtn');
  if (curToggle) curToggle.addEventListener('click', () => setCur(state.currency === 'ILS' ? 'USD' : 'ILS'));
  // ערכת נושא — מקטע בטאב ההגדרות: בהיר / כהה / מערכת (v108)
  const thL = document.getElementById('themeLight');
  const thD = document.getElementById('themeDark');
  const thS = document.getElementById('themeSystem');
  if (thL) thL.addEventListener('click', () => setThemeMode('light'));
  if (thD) thD.addEventListener('click', () => setThemeMode('dark'));
  if (thS) thS.addEventListener('click', () => setThemeMode('system'));
  // שחזור מטבע שמור מטעינה קודמת
  try {
    const savedCur = localStorage.getItem('pwa_currency_v1');
    if (savedCur === 'ILS' || savedCur === 'USD') state.currency = savedCur;
  } catch (e) {}
  paintCurBtn();
  try { initMainMenu(); } catch (e) {}
  try { initHeaderButtons(); } catch (e) {}
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

  // נתוני IBKR — סנכרון Flex
  renderIbkrCard();
  const ibkrDc = document.getElementById('ibkrDisconnect');
  if (ibkrDc) ibkrDc.addEventListener('click', ibkrDisconnect);
  const ibkrSt = document.getElementById('ibkrSaveTest');
  if (ibkrSt) ibkrSt.addEventListener('click', ibkrSaveAndTest);
  const ibkrSi = document.getElementById('ibkrSyncImport');
  if (ibkrSi) ibkrSi.addEventListener('click', ibkrSyncImport);

  // מצבי עריכה — כבויים כברירת מחדל כדי למנוע טעויות בלחיצות אקראיות
  wireEditToggle('editStocksBtn', 'editStocksHint', 'stocks', renderStocks);
  wireEditToggle('editDepositsBtn', 'editDepositsHint', 'deposits', renderDeposits);
  wireEditToggle('editPensionBtn', 'editPensionHint', 'pension', renderPension);
  // v87: חיפוש מניות להוספה — זמין בשני המצבים
  try { initStockSearch(); } catch (e) {}
  try { initStockSort(); } catch (e) {}
  // v101: טיקר חי לשער הדולר — מתחיל עם האפליקציה
  try { startFxTicker(); } catch (e) {}

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
      try { localStorage.removeItem(LS_PREDEMO); } catch (e) {}
      // מנקה גם את מטמון הייבוא (IBKR) — אחרת יבוא חוזר אחרי איפוס נחסם כ"אין מידע חדש"
      try { localStorage.removeItem(LS_IBKR); } catch (e) {}
      location.reload();
    };
    if (window.Cloud && window.Cloud.resetCloud) window.Cloud.resetCloud().then(doReset);
    else doReset();
  });

  // v146: איפוס נפרד + תיק דמו
  const rmBtn = document.getElementById('resetManual');
  if (rmBtn) rmBtn.addEventListener('click', doResetManual);
  const riBtn = document.getElementById('resetIbkr');
  if (riBtn) riBtn.addEventListener('click', doResetIbkr);
  const dBtn = document.getElementById('demoCreateBtn');
  if (dBtn) dBtn.addEventListener('click', () => demoCreate(dBtn));
  for (const id of ['demoExitBtn', 'demoBannerExit']) {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', demoExit);
  }

  // ניקוי מטמון ורענון — מביא את הגרסה החדשה ביותר מהשרת
  const amtBtn = document.getElementById('addManualTradeBtn');
  if (amtBtn) amtBtn.addEventListener('click', () => {
    const host = document.getElementById('tradeFormHost');
    if (host) { host.innerHTML = ''; showTradeForm(host, {}); }
  });
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
    refreshQuotes().then(() => { warmHistories(); liveStart(); });
    refreshEarnings().then(() => { renderOverview(); renderWishlist(); });
  };
  if (window.Cloud && window.Cloud.boot) window.Cloud.boot(startApp);
  else startApp();
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', init);
}

/* v103: תפריט המבורגר ראשי — נפתח/נסגר, נסגר בלחיצה בחוץ או Escape */
/* v109: כפתורי ההדר — גלובוס שפה עם תפריט מינימלי, צמודים להמבורגר. */
function initHeaderButtons() {
  const langBtn = document.getElementById('langBtn');
  const langMenu = document.getElementById('langMenu');
  if (langBtn) {
    try { langBtn.innerHTML = ICON_GLOBE; } catch (e) {}
  }
  const closeLangMenu = () => { if (langMenu) langMenu.classList.add('hidden'); };
  if (langBtn && langMenu) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const drop = document.getElementById('menuDrop');
      if (drop) drop.classList.add('hidden');
      langMenu.classList.toggle('hidden');
    });
  }
  const lmHe = document.getElementById('langMenuHe');
  const lmEn = document.getElementById('langMenuEn');
  if (lmHe) lmHe.addEventListener('click', (e) => { e.stopPropagation(); setLang('he'); closeLangMenu(); });
  if (lmEn) lmEn.addEventListener('click', (e) => { e.stopPropagation(); setLang('en'); closeLangMenu(); });
  document.addEventListener('click', (e) => {
    if (langMenu && !langMenu.classList.contains('hidden') && !e.target.closest('.lang-wrap')) closeLangMenu();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLangMenu(); });
  renderLangToggle();
}

function initMainMenu() {
  const btn = document.getElementById('menuBtn');
  const drop = document.getElementById('menuDrop');
  if (!btn || !drop) return;
  btn.innerHTML = ICON_MENU;
  const closeMenu = () => {
    drop.classList.add('hidden');
    btn.setAttribute('aria-expanded', 'false');
  };
  const setBtn = document.getElementById('menuSettingsBtn');
  if (setBtn) {
    try { setBtn.insertAdjacentHTML('afterbegin', ICON_GEAR); } catch (e) {}
    setBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeMenu();
      switchTab('settings');
      try { window.scrollTo(0, 0); } catch (err) {}
    });
  }
  /* v108: כפתור ערכה יחיד בתפריט — מחליף בהיר/כהה בלבד */
  const themeBtn = document.getElementById('menuThemeBtn');
  if (themeBtn) themeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setThemeMode(resolveTheme() === 'dark' ? 'light' : 'dark');
  });
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const willOpen = drop.classList.contains('hidden');
    drop.classList.toggle('hidden');
    btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
  });
  document.addEventListener('click', (e) => {
    if (!drop.classList.contains('hidden') && !e.target.closest('.menu-wrap')) closeMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  renderThemeToggle();
}
