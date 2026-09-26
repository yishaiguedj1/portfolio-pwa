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
const ICON_CLOSE = _IC_PRE + '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
const ICON_FILTER = _IC_PRE + '<path d="M3 5h18l-7 8.5V19l-4 2v-7.5Z"/></svg>';
const ICON_LIST = _IC_PRE + '<line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>';
const ICON_CHECK = _IC_PRE + '<polyline points="4 12.5 9.5 18 20 6.5"/></svg>';
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
  menuCloseAria: 'סגירת התפריט',
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
  srcFilterLabel: 'הצג לפי מקור',
  srcFilterBtn: 'סינון',
  agorotUnit: 'אגורות',
  agShort: 'אג׳',
  ptsShort: 'נק׳',
  ptsUnit: 'נקודות',
  histRetryLater: 'אין כרגע גישה להיסטוריית המחירים — ננסה שוב אוטומטית',
  agorotFixed: 'תוקנו {n} מחירים של מניות ת"א שהוזנו באגורות',
  srcFilterAll: 'הכל',
  srcFilterManual: 'ידני',
  srcFilterIbkr: 'Interactive Brokers',
  srcFilterEmpty: 'אין פריטים מהמקור הזה.',
  sortSize: 'גודל בתיק',
  sortDay: 'ביצועי היום',
  sortGain: 'מהקנייה',
  editHint: 'מצב עריכה פעיל — בסיום לחצו שוב על עריכה.',
  addStock: 'הוספת מניה',
  noStocks: 'אין מניות בתיק. הפעילו עריכה כדי להוסיף.',
  btnEdit: ICON_EDIT + 'ערוך',
  btnDelete: ICON_TRASH + 'מחק',
  todayChg: 'היום {v}',
  buyChg: 'מהקנייה {v}',
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
  pfHoldingsLegend: 'האחזקות הנוכחיות',
  pfNoteManualTwr: 'תשואה משוקללת־זמן (TWR) בדולרים מהעסקאות הידניות — קנייה ומכירה לא נספרות כרווח, כמו ב־IBKR.',
  pfNoteHoldings: 'האחזקות הנוכחיות בדולרים לאורך זמן (אין עסקאות עם תאריך). להיסטוריה מדויקת — הוסיפו מניות "לפי עסקאות".',
  twrManual: 'TWR מהעסקאות הידניות',
  twrManualLoading: 'TWR נטען…',
  ovGLHoldings: 'ממומש + לא־ממומש',
  perfTitleManual: 'ביצועי התיק',
  perfPeriodManual: 'מהעסקה הראשונה ({a}) עד היום · בדולרים',
  perfNoTrades: 'לפי מחיר ממוצע · בדולרים',
  perfNeedTrades: 'נדרשות עסקאות עם תאריך',
  perfGainManual: 'רווח/הפסד כולל',
  perfFeesManual: 'עמלות',

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
  sessionNight: ' · מסחר לילי (overnight)',
  sessPreShort: 'טרום־מסחר',
  sessPostShort: 'אחרי־מסחר',
  sessNightShort: 'לילי',
  sessExtTitle: 'שינוי מהסגירה הרגילה',
  sessClosed: 'השוק סגור',
  sessClosedPrefix: 'השוק סגור ·',
  sessLastClose: 'סגירה',
  hdTaErevRH: 'ערב ראש השנה', hdTaRH: 'ראש השנה', hdTaErevYK: 'ערב יום כיפור', hdTaYK: 'יום כיפור',
  hdTaErevSukkot: 'ערב סוכות', hdTaSukkot: 'סוכות', hdTaErevSimchat: 'הושענא רבה', hdTaSimchat: 'שמחת תורה',
  hdTaPurim: 'פורים', hdTaErevPesach: 'ערב פסח', hdTaPesach: 'פסח', hdTaIndependence: 'יום העצמאות',
  hdTaErevShavuot: 'ערב שבועות', hdTaShavuot: 'שבועות', hdTaTishaBav: 'ט׳ באב',
  sessPostTiny: 'אחרי־מסחר',
  sessPreTiny: 'טרום־מסחר',
  sessNightTiny: 'לילי',
  sessClosedTitle: 'השוק סגור — השינוי הוא מהמסחר המאוחר האחרון',
  hdWeekend: 'סופ״ש',
  hdNewYear: 'ראש השנה',
  hdMlk: 'יום MLK',
  hdPresidents: 'הנשיאים',
  hdGoodFriday: 'שישי הטוב',
  hdMemorial: 'יום הזיכרון',
  hdJuneteenth: 'ג׳ונטינת׳',
  hdIndependence: '4 ביולי',
  hdLabor: 'העבודה',
  hdThanksgiving: 'חג ההודיה',
  hdChristmas: 'חג המולד',
  staleSuffix: ' · מוצגים נתונים שמורים',
  fxSource: 'שער חליפין',
  fxRateLabel: 'שער הדולר',
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
  ibkrErrAppKey: 'השרתון דחה את הבקשה כי הוגדר בו APP_KEY. ב־Vercel: Settings ← Environment Variables ← מחק את APP_KEY ← Redeploy.',
  ibkrErrOrigin: 'השרתון מקבל בקשות רק מהאתר של האפליקציה. פתח את האפליקציה מהכתובת הרגילה שלה.',
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
  demoDesc: 'טוענים תיק דמו מלא בלחיצה אחת: העתק של תיק המניות של וורן באפט (ברקשייר האת׳וויי) ב־6 השנים האחרונות — כל קנייה ומכירה לפי הדוחות הרבעוניים שלו, במחירי שוק אמיתיים ובסכומים של תיק פרטי. ועוד: 3 מניות ומדד מת״א, הפקדות ומשיכות, מזומן ופנסיה. הנתונים שלך לא נמחקים — הם מחכים לך ביציאה מהדמו.',
  demoBtn: '✨ טען תיק דמו',
  demoConfirm: 'לטעון תיק דמו?\nהנתונים שלך נשמרים בצד וחוזרים ביציאה מהדמו. שינויים בזמן הדמו לא נשמרים בענן.',
  demoBuilding: 'בונה תיק דמו ממחירי שוק אמיתיים…',
  demoReady: 'תיק הדמו מוכן — סיור נעים!',
  demoFail: 'מקורות מחירי השוק לא עונים כרגע (לפעמים הם מגבילים לכמה דקות). נסו שוב בעוד כמה דקות.',
  demoProgTitle: 'בונים את תיק הדמו',
  btnClose: 'סגירה',
  demoProgSub: 'מחירי שוק אמיתיים של 6 השנים האחרונות — עוד כמה רגעים',
  demoStepPrices: 'מושכים מחירי מניות ומדדים',
  demoStepFx: 'מושכים שערי דולר־שקל',
  demoStepBuild: 'בונים את העסקאות של באפט, הפקדות ופנסיה',
  demoStepSave: 'מכינים את התיק',
  demoStepOf: '{n} מתוך {total}',
  demoStepServer: 'מהשרת — בבקשה אחת',
  demoRetry: 'נסו שוב',
  demoStepStocks: '{n} מניות ומדדים',
  demoActiveTitle: 'מצב דמו פעיל',
  demoActiveDesc: 'זה תיק לדוגמה — אפשר לגעת בהכל. שינויים כאן לא נשמרים בענן, והנתונים האמיתיים שלך חוזרים ביציאה מהדמו.',
  demoExitBtn: 'יציאה מהדמו',
  demoBanner: 'מצב דמו — נתונים לדוגמה',
  demoSyncBlocked: 'במצב דמו אין סנכרון IBKR — צא מהדמו קודם (בהגדרות).',
  demoDepPlace: 'העברה מהבנק',
  demoWdPlace: 'משיכה לחשבון הבנק',
  demoReservePlace: 'הפקדה פותחת',
  demoWlBrk: 'המניה של ברקשייר — להשוואה מול התיק',
  demoPension: 'קרן פנסיה – מסלול כללי',
  demoStudy: 'קרן השתלמות – מסלול כללי',
  demoPension2: 'קרן פנסיה – מסלול מניות',
  demoNameDefense: 'מדד ת"א ביטחוניות',
  demoStudy2: 'קרן השתלמות – מסלול S&P 500',

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
  menuCloseAria: 'Close menu',
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
  srcFilterLabel: 'Show by source',
  srcFilterBtn: 'Filter',
  agorotUnit: 'agorot',
  agShort: 'ag.',
  ptsShort: 'pts',
  ptsUnit: 'points',
  histRetryLater: 'Price history is unavailable right now — retrying automatically',
  agorotFixed: 'Fixed {n} TASE prices that were entered in agorot',
  srcFilterAll: 'All',
  srcFilterManual: 'Manual',
  srcFilterIbkr: 'Interactive Brokers',
  srcFilterEmpty: 'No items from this source.',
  sortSize: 'Position size',
  sortDay: "Day's change",
  sortGain: 'Since buy',
  editHint: 'Edit mode is on — when done, tap Edit again.',
  addStock: 'Add stock',
  noStocks: 'No stocks in the portfolio. Turn on Edit to add.',
  btnEdit: ICON_EDIT + 'Edit',
  btnDelete: ICON_TRASH + 'Delete',
  todayChg: 'Today {v}',
  buyChg: 'Since purchase {v}',
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
  pfHoldingsLegend: 'Current holdings',
  pfNoteManualTwr: 'Time-weighted return (TWR) in USD from your manual trades — buys and sells are not counted as gains, like IBKR.',
  pfNoteHoldings: 'Current holdings in USD over time (no dated trades). For exact history, add stocks "by trades".',
  twrManual: 'TWR from manual trades',
  twrManualLoading: 'TWR loading…',
  ovGLHoldings: 'Realized + unrealized',
  perfTitleManual: 'Portfolio Performance',
  perfPeriodManual: 'From the first trade ({a}) to today · in USD',
  perfNoTrades: 'By average price · in USD',
  perfNeedTrades: 'Needs dated trades',
  perfGainManual: 'Total gain/loss',
  perfFeesManual: 'Commissions',

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
  sessionNight: ' · overnight',
  sessPreShort: 'Pre-market',
  sessPostShort: 'After hours',
  sessNightShort: 'Overnight',
  sessExtTitle: 'Change from regular close',
  sessClosed: 'Closed',
  sessClosedPrefix: 'Closed ·',
  sessLastClose: 'Close',
  hdTaErevRH: 'Erev Rosh Hashanah', hdTaRH: 'Rosh Hashanah', hdTaErevYK: 'Erev Yom Kippur', hdTaYK: 'Yom Kippur',
  hdTaErevSukkot: 'Erev Sukkot', hdTaSukkot: 'Sukkot', hdTaErevSimchat: 'Hoshana Rabbah', hdTaSimchat: 'Simchat Torah',
  hdTaPurim: 'Purim', hdTaErevPesach: 'Erev Passover', hdTaPesach: 'Passover', hdTaIndependence: 'Independence Day',
  hdTaErevShavuot: 'Erev Shavuot', hdTaShavuot: 'Shavuot', hdTaTishaBav: "Tisha B'Av",
  sessPostTiny: 'Post',
  sessPreTiny: 'Pre',
  sessNightTiny: 'Night',
  sessClosedTitle: 'Market closed — change is from the last extended session',
  hdWeekend: 'Weekend',
  hdNewYear: 'New Year',
  hdMlk: 'MLK Day',
  hdPresidents: 'Presidents',
  hdGoodFriday: 'Good Friday',
  hdMemorial: 'Memorial',
  hdJuneteenth: 'Juneteenth',
  hdIndependence: 'July 4th',
  hdLabor: 'Labor Day',
  hdThanksgiving: 'Thanksgiving',
  hdChristmas: 'Christmas',
  staleSuffix: ' · showing saved data',
  fxSource: 'Exchange rate',
  fxRateLabel: 'USD rate',
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
  ibkrErrAppKey: 'The proxy rejected the request because APP_KEY is set on it. In Vercel: Settings → Environment Variables → delete APP_KEY → Redeploy.',
  ibkrErrOrigin: 'The proxy only accepts requests from the app’s own site. Open the app from its usual address.',
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
  demoDesc: 'Load a complete demo portfolio in one tap: a copy of Warren Buffett’s stock portfolio (Berkshire Hathaway) over the last 6 years — every buy and sell following his quarterly filings, at real market prices, scaled to a private portfolio. Plus 3 Tel Aviv stocks and an index, deposits and withdrawals, cash and pension. Your data is not deleted — it’s waiting for you when you exit the demo.',
  demoBtn: '✨ Load demo portfolio',
  demoConfirm: 'Load a demo portfolio?\nYour data is set aside and comes back when you exit the demo. Changes during the demo are not saved to the cloud.',
  demoBuilding: 'Building a demo portfolio from real market prices…',
  demoReady: 'Demo portfolio ready — enjoy the tour!',
  demoFail: 'Market price sources are not responding right now (they sometimes limit requests for a few minutes). Try again in a few minutes.',
  demoProgTitle: 'Building the demo portfolio',
  btnClose: 'Close',
  demoProgSub: 'Real market prices from the last 6 years — just a moment',
  demoStepPrices: 'Fetching stock and index prices',
  demoStepFx: 'Fetching USD/ILS rates',
  demoStepBuild: 'Building Buffett’s trades, deposits and pension',
  demoStepSave: 'Preparing the portfolio',
  demoStepOf: '{n} of {total}',
  demoStepServer: 'From the server — one request',
  demoRetry: 'Try again',
  demoStepStocks: '{n} stocks and indexes',
  demoActiveTitle: 'Demo mode is on',
  demoActiveDesc: 'This is a sample portfolio — feel free to touch everything. Changes here are not saved to the cloud, and your real data comes back when you exit the demo.',
  demoExitBtn: 'Exit demo',
  demoBanner: 'Demo mode — sample data',
  demoSyncBlocked: 'IBKR sync is off in demo mode — exit the demo first (in Settings).',
  demoDepPlace: 'Bank transfer',
  demoWdPlace: 'Withdrawal to bank',
  demoReservePlace: 'Opening deposit',
  demoWlBrk: 'Berkshire’s own stock — to compare with the portfolio',
  demoPension: 'Pension fund – General track',
  demoStudy: 'Study fund – General track',
  demoPension2: 'Pension fund – Equity track',
  demoNameDefense: 'TA-Defense index',
  demoStudy2: 'Study fund – S&P 500 track',

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
  try { if (typeof positionTabIndicator === 'function') positionTabIndicator(); } catch (e) {}
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
  const apply = () => {
    applyI18n();
    if (typeof renderAll === 'function') renderAll({ all: true }); // v193: כל הטאבים — הטקסטים בכולם משתנים
    if (typeof renderIbkrCard === 'function') renderIbkrCard();
    if (typeof renderTdKeyStatus === 'function') renderTdKeyStatus();
    if (typeof updateSourceLabel === 'function') updateSourceLabel();
  };
  if (typeof withViewTransition === 'function') withViewTransition(apply); else apply();
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
  cssVarCacheClear(); // v193
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
  withViewTransition(applyTheme); // v193: מעבר בהיר/כהה בהצלבה רכה (View Transitions כשיש)
}
/* v193: מריץ שינוי מסך בתוך View Transition (הצלבה של המסך הישן והחדש, ~280ms) כשהדפדפן תומך;
   אחרת — מיד. מכבד "הפחתת תנועה". fn חייבת להיות סינכרונית. */
function withViewTransition(fn) {
  try {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce && typeof document !== 'undefined' && typeof document.startViewTransition === 'function') { document.startViewTransition(() => { fn(); }); return; }
  } catch (e) {}
  fn();
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
  // v154: כשהתפריט פתוח כפתור המטבע הופך לכפתור ערכה — מציג את הערכה שאליה עוברים
  const alt = document.querySelector && document.querySelector('#curToggleBtn .face-alt');
  if (alt) alt.innerHTML = resolveTheme() === 'dark' ? ICON_SUN : ICON_MOON;
}
/* קורא משתנה CSS מהערכה הנוכחית; בטסטים (אין getComputedStyle) מחזיר ברירת מחדל. */
/* v193: מטמון לפי ערכה — getComputedStyle נקרא עשרות פעמים בכל ציור גרף; הערך משתנה רק כשהערכה מתחלפת (applyTheme מנקה). */
const _cssVarCache = {};
function cssVar(name, fallback) {
  try {
    if (typeof getComputedStyle !== 'function') return fallback;
    if (name in _cssVarCache) return _cssVarCache[name] || fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    const out = (v && v.trim()) || '';
    _cssVarCache[name] = out;
    return out || fallback;
  } catch (e) { return fallback; }
}
function cssVarCacheClear() { for (const k of Object.keys(_cssVarCache)) delete _cssVarCache[k]; }

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
/* כותרות לשרתון. X-App-Key רדום (v150): השדה הוסר מההגדרות כי APP_KEY לא מוגדר ב־Vercel.
   להפעלה מחדש: להחזיר שדה שכותב ל־ibkrCfg().appKey (ראה v148 ביומן) + APP_KEY ב־Vercel. */
function ibkrProxyHeaders() {
  const h = { 'Content-Type': 'application/json' };
  let k = '';
  try { k = String(ibkrCfg().appKey || '').trim(); } catch (e) {}
  if (k) h['X-App-Key'] = k;
  return h;
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
    headers: ibkrProxyHeaders(),
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
        headers: ibkrProxyHeaders(),
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
  const m = String(msg || '').match(/flex_(\d+)|ibkr_http_(\d+)|no_reference_code|rate_limited|bad_params|fetch_failed|bad_app_key|forbidden_origin/);
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
    case 'bad_app_key':
      return t('ibkrErrAppKey');
    case 'forbidden_origin':
      return t('ibkrErrOrigin');
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
  // v150: שדה "מפתח שרתון" הוסר (APP_KEY לא מוגדר ב־Vercel) — מפתח ישן שנשמר נמחק
  if (cfg.appKey) ibkrSaveCfg({ appKey: '' });
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

/* v158: TWR של תיק ידני מהעסקאות בלבד (בלי IBKR) — בדולרים, כמו IBKR. קנייה/מכירה = תזרים,
   לא רווח. כל יום עם עסקה מחולק לשתי תת־תקופות (TWR אמיתי):
     עד רגע העסקה: V_b / M_{t−1}   — V_b = האחזקות הקודמות; מניה שנסחרה היום לפי מחיר העסקה,
                                      השאר לפי הסגירה של היום (אחרת התנועה שלהן "נמהלת" בכסף החדש)
     מרגע העסקה:   M_t / (V_b + G)  — G = כסף שנכנס (קנייה + עמלה, מכירה − נטו)
   יום בלי עסקאות = M_t / M_{t−1}. קנייה בסגירה לא משנה את התשואה; סכום גדול לתיק קטן לא "מתפוצץ".
   מניה בשקלים — בשער של אותו יום. מחזיר [{date,value}] מדד שמתחיל ב־100 ביום שלפני העסקה
   הראשונה, או null. טהורה. */
function manualTwrRows(trades, histOf, fxOf) {
  const tr = mtSorted(trades);
  if (!tr.length) return null;
  const toU = (v, sym, date) => {
    if (symCur(sym) !== 'ILS') return v;
    const r = fxOf ? fxOf(date) : null;
    return r > 0 ? v / r : null;
  };
  const syms = [...new Set(tr.map((x) => x.sym))];
  const first = tr[0].date;
  const dset = new Set(tr.map((x) => x.date));
  let prevD = null;
  for (const sym of syms) {
    for (const r of (histOf(sym) || [])) {
      if (r.date >= first) dset.add(r.date);
      else if (!prevD || r.date > prevD) prevD = r.date;
    }
  }
  const held = {};
  const valAt = (date) => {
    let v = 0;
    for (const sym of syms) {
      const sh = held[sym] || 0;
      if (!(sh > 1e-9)) continue;
      const c = closeOnOrBefore(histOf(sym) || [], date);
      if (!(c > 0)) return null;
      const u = toU(sh * c, sym, date);
      if (u === null) return null;
      v += u;
    }
    return v;
  };
  const start = prevD || addDaysISO(first, -1);
  const out = [{ date: start, value: 100 }];
  let v = 100, prevM = 0, last = start, ti = 0;
  for (const d of [...dset].sort()) {
    const today = [];
    while (ti < tr.length && tr[ti].date <= d) today.push(tr[ti++]);
    if (today.length) {
      // מחיר העסקה (ממוצע משוקלל) לכל מניה שנסחרה היום, והכסף שנכנס
      const px = {}, qn = {};
      let g = 0;
      for (const x of today) {
        px[x.sym] = (px[x.sym] || 0) + x.qty * x.price; qn[x.sym] = (qn[x.sym] || 0) + x.qty;
        const f = toU(x.side === 'BUY' ? x.qty * x.price + x.fee : -(x.qty * x.price - x.fee), x.sym, x.date);
        if (f === null) return null;
        g += f;
      }
      let vb = 0;
      for (const sym of syms) {
        const sh = held[sym] || 0;
        if (!(sh > 1e-9)) continue;
        const p = qn[sym] ? px[sym] / qn[sym] : closeOnOrBefore(histOf(sym) || [], d);
        if (!(p > 0)) return null;
        const u = toU(sh * p, sym, d);
        if (u === null) return null;
        vb += u;
      }
      if (prevM > 0 && vb > 0) v *= vb / prevM;
      for (const x of today) held[x.sym] = Math.max(0, (held[x.sym] || 0) + (x.side === 'BUY' ? x.qty : -x.qty));
      const m = valAt(d);
      if (m === null) return null;
      if (vb + g > 1e-9) v *= m / (vb + g);
      prevM = m;
    } else {
      const m = valAt(d);
      if (m === null) return null;
      if (prevM > 0) v *= m / prevM;
      prevM = m;
    }
    out.push({ date: d, value: v });
    last = d;
  }
  return out.length >= 2 ? out : null;
}

/* v158: בלי עסקאות עם תאריך — האחזקות הנוכחיות בדולרים לאורך זמן (להשוואה מול המדדים).
   מתחיל מהיום הראשון שיש מחיר לכל המניות, כדי שמניה "חדשה" בהיסטוריה לא תיראה כזינוק. טהורה. */
function holdingsUsdRows(positions, histOf, fxOf) {
  const ps = (positions || []).filter((p) => p && p.shares > 0);
  if (!ps.length) return null;
  let from = '';
  const dset = new Set();
  for (const p of ps) {
    const h = histOf(p.sym) || [];
    if (!h.length) return null;
    if (h[0].date > from) from = h[0].date;
    for (const r of h) dset.add(r.date);
  }
  const out = [];
  for (const d of [...dset].sort()) {
    if (d < from) continue;
    let v = 0, ok = true;
    for (const p of ps) {
      const c = closeOnOrBefore(histOf(p.sym) || [], d);
      if (!(c > 0)) { ok = false; break; }
      if (symCur(p.sym) === 'ILS') { const r = fxOf ? fxOf(d) : null; if (!(r > 0)) { ok = false; break; } v += c * p.shares / r; }
      else v += c * p.shares;
    }
    if (ok) out.push({ date: d, value: v });
  }
  return out.length >= 2 ? out : null;
}

/* v158: ביצועי תיק ידני — אותם שדות כמו כרטיס IBKR, מהנתונים הידניים. בדולרים.
   positions = כל האחזקות (לפי ממוצע + לפי עסקאות), trades = עסקאות פעילות.
   twr/xirr — מהעסקאות בלבד (מניות לפי ממוצע אין להן תאריך). טהורה. */
function manualPerfUSD(positions, trades, quotes, fx, histOf, fxOf, today) {
  const priceOf = (sym) => { const q = (quotes || {})[sym]; return q && q.close > 0 ? q.close : null; };
  const usd = (v, sym) => nativeToUSD(v, sym, fx);
  const tr = mtSorted(trades);
  let realized = 0, unrealized = 0, fees = 0, tradeVal = 0, missing = 0, avgOnly = 0;
  for (const sym of new Set(tr.map((x) => x.sym))) {
    const st = mtPosition(tr, sym);
    realized += usd(st.realized, sym) || 0;
    if (st.shares > 0) {
      const px = priceOf(sym);
      if (px === null) { missing++; continue; }
      unrealized += usd(px * st.shares - st.cost, sym) || 0;
      tradeVal += usd(px * st.shares, sym) || 0;
    }
  }
  for (const x of tr) fees += usd(x.fee, x.sym) || 0;
  for (const p of (positions || [])) {
    if (!p || p.fromTrades) continue;
    avgOnly++;
    const px = priceOf(p.sym);
    if (px === null) { missing++; continue; }
    unrealized += usd((px - (Number(p.avg) || 0)) * p.shares, p.sym) || 0;
  }
  let twr = null, rows = null;
  if (tr.length && histOf) {
    rows = manualTwrRows(tr, histOf, fxOf);
    if (rows) twr = (rows[rows.length - 1].value / rows[0].value - 1) * 100;
  }
  let xirr = null;
  if (tr.length && !missing) {
    const flows = [];
    for (const x of tr) {
      const r = symCur(x.sym) === 'ILS' ? (fxOf ? fxOf(x.date) : null) : 1;
      if (!(r > 0)) { flows.length = 0; break; }
      const amt = (x.side === 'BUY' ? -(x.qty * x.price + x.fee) : (x.qty * x.price - x.fee)) / r;
      flows.push({ d: x.date, amt: amt });
    }
    if (flows.length && tradeVal > 0) flows.push({ d: today, amt: tradeVal });
    if (flows.length >= 2 && flows[flows.length - 1].d > flows[0].d) {
      try { xirr = rXirr(flows); } catch (e) { xirr = null; }
    }
  }
  return { twr: twr, rows: rows, xirr: xirr, gain: realized + unrealized, realized: realized,
    unrealized: unrealized, fees: fees, avgOnly: avgOnly, missing: missing,
    fromDate: tr.length ? tr[0].date : null };
}

/* v158: מצב ידני — היסטוריה חיה (עם המחיר של היום) לכל מניה, ושער לכל יום */
function manualHistOf(sym) { return stockChartRows(state.hist[sym] || [], state.quotes[sym]); }
function manualPerfNow() {
  const trades = mtActiveTrades();
  const need = [...new Set(trades.map((x) => mtNorm(x).sym))].filter((sym) => !(state.hist[sym] || []).length);
  const needFx = trades.some((x) => symCur(mtNorm(x).sym) === 'ILS') && !fxHistCache;
  const ready = !need.length && !needFx;
  const mp = manualPerfUSD(POSITIONS, trades, state.quotes, state.fx, ready ? manualHistOf : null,
    (d) => fxOnOrBefore(d), todayISO());
  mp.loading = !ready;
  mp.need = need;
  mp.needFx = needFx;
  return mp;
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
function positionSource(p) { return isIbkrPosition(p, isIbkrMode()) ? 'ibkr' : 'manual'; }

/* v155: סינון לפי מקור (הכל / ידני / IB) — בהפקדות, בעסקאות ובמניות. נשמר לכל טאב בנפרד. */
const LS_SRCFILTER = 'pwa_srcfilter_v1';
const SRC_FILTERS = ['all', 'manual', 'ibkr'];
function getSrcFilter(tab) {
  try {
    const o = JSON.parse(localStorage.getItem(LS_SRCFILTER) || '{}') || {};
    return SRC_FILTERS.includes(o[tab]) ? o[tab] : 'all';
  } catch (e) { return 'all'; }
}
function setSrcFilter(tab, v) {
  if (!SRC_FILTERS.includes(v)) return;
  try {
    const o = JSON.parse(localStorage.getItem(LS_SRCFILTER) || '{}') || {};
    o[tab] = v;
    localStorage.setItem(LS_SRCFILTER, JSON.stringify(o));
  } catch (e) {}
  if (tab === 'deposits') renderDeposits();
  else if (tab === 'trades') renderTrades();
  else if (tab === 'stocks') renderStocks();
}
/* טהורה: האם פריט ממקור src עובר את הסינון f */
function srcPass(f, src) { return f === 'all' || f === src; }
/* v156: כפתור "סינון" אחד; הבחירה בבועה קטנה מתחתיו (במקום שורת צ'יפים גלויה).
   נבנה מחדש בכל ציור (הטקסט לפי השפה). כשמסונן — הכפתור ירוק ומציג את המקור. */
function srcFilterName(k) {
  return k === 'manual' ? t('srcFilterManual') : k === 'ibkr' ? t('srcFilterIbkr') : t('srcFilterAll');
}
function closeSrcPops(except) {
  document.querySelectorAll('.src-filter.open').forEach((w) => {
    if (w === except) return;
    w.classList.remove('open');
    const b = w.querySelector('.src-btn'); if (b) b.setAttribute('aria-expanded', 'false');
    const p = w.querySelector('.src-pop'); if (p) p.classList.add('hidden');
  });
}
function renderSrcFilter(tab) {
  const wrap = document.getElementById(tab + 'SrcFilter');
  if (!wrap) return;
  const cur = getSrcFilter(tab);
  const lead = { all: ICON_LIST, manual: ICON_EDIT, ibkr: '<img src="ibkr-logo.png" alt="" width="18" height="18">' };
  wrap.classList.remove('open');
  wrap.innerHTML = '<button class="chip-btn src-btn' + (cur !== 'all' ? ' on' : '') + '" type="button" aria-haspopup="true" aria-expanded="false">' +
    ICON_FILTER + esc(t('srcFilterBtn')) + '</button>' +
    '<div class="src-pop menu-drop hidden" role="menu">' +
      '<div class="src-pop-title">' + esc(t('srcFilterLabel')) + '</div>' +
      SRC_FILTERS.map((k) => '<button class="src-opt' + (k === cur ? ' on' : '') + '" type="button" role="menuitemradio" aria-checked="' + (k === cur) +
        '" data-srcf="' + k + '"><span class="src-opt-ic">' + lead[k] + '</span><span class="src-opt-name">' + esc(srcFilterName(k)) + '</span>' +
        '<span class="src-opt-check">' + (k === cur ? ICON_CHECK : '') + '</span></button>').join('') +
    '</div>';
  const btn = wrap.querySelector('.src-btn');
  const pop = wrap.querySelector('.src-pop');
  if (!btn || !pop) return;
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = !wrap.classList.contains('open');
    closeSrcPops(wrap);
    wrap.classList.toggle('open', open);
    pop.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', String(open));
  });
  pop.addEventListener('click', (e) => e.stopPropagation());
  pop.querySelectorAll('button[data-srcf]').forEach((b) => {
    b.addEventListener('click', () => { closeSrcPops(); setSrcFilter(tab, b.dataset.srcf); });
  });
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', () => closeSrcPops());
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSrcPops(); });
}
/* טהורה: מפתח מיון לתאריך הפקדה — ISO או DD/MM/YYYY → YYYYMMDD */
function depDateKey(d) {
  const s = String((d && d.date) || '');
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + m[2] + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return m[3] + m[2].padStart(2, '0') + m[1].padStart(2, '0');
  return '';
}
/* טהורה: הפקדות מהחדשה לישנה, עם האינדקס המקורי (לעריכה/מחיקה) */
function depositsNewestFirst(list) {
  return list.map((d, i) => ({ d, i }))
    .sort((a, b) => { const ka = depDateKey(a.d), kb = depDateKey(b.d); return ka < kb ? 1 : ka > kb ? -1 : b.i - a.i; });
}

/* v147: תגית מקור אחידה לכל פריט — "ידני" או הלוגו של Interactive Brokers.
   אותה תגית על כפתורי האיפוס, כך שרואים מה כל כפתור מוחק. */
function srcTagHTML(kind) {
  if (kind === 'ibkr') {
    return '<span class="src-tag src-ibkr" title="Interactive Brokers" aria-label="Interactive Brokers">' +
      '<img src="ibkr-logo.png" alt="IBKR" width="14" height="14"></span>';
  }
  return '<span class="src-tag">' + esc(t('manualTag')) + '</span>';
}

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
   מ־v168: העתק של תיק המניות של באפט (ברקשייר) — ראו BRK_13F. הכל ידני: עסקאות, הפקדות, מזומן, פנסיה. */
const LS_PREDEMO = 'pwa_predemo_v1';
/* v168: תיק הדמו = העתק של תיק המניות של ברקשייר האת'וויי (באפט), מתוך דוחות 13F הרבעוניים ל־SEC.
   BRK_13F[sym][i] = שווי האחזקה בסוף הרבעון BRK_13F_Q[i], בדולרים, מוקטן פי מיליון (~$300K היום).
   בכל סוף רבעון התיק מתיישר לאחזקות של ברקשייר — כמות = שווי ÷ סגירה (מחירי Yahoo מותאמי ספליט,
   כך שספליט עתידי לא שובר את הטבלה). הטבלה נוצרת ב־tools/brk13f.py — לעדכן אחרי כל דוח (אמצע פבר'/מאי/אוג'/נוב').
   בחוץ: ניירות בלי היסטוריה ב־Yahoo (ATVI, מניות המעקב של Liberty SiriusXM, STORE), אחזקות קטנות מ־0.35%
   שכבר נמכרו, ואחזקות של פחות ממניה אחת בקנה המידה הזה (NVR, LEN.B, JEF, DHI היום).
   נבדק מול כל 91 הניירות שיש להם מחירים: TWR ל־6 שנים זהה עד ~0.1 נקודה. */
const BRK_13F_Q = ['2020-09-30','2020-12-31','2021-03-31','2021-06-30','2021-09-30','2021-12-31','2022-03-31','2022-06-30','2022-09-30','2022-12-31','2023-03-31','2023-06-30','2023-09-30','2023-12-31','2024-03-31','2024-06-30','2024-09-30','2024-12-31','2025-03-31','2025-06-30','2025-09-30','2025-12-31','2026-03-31','2026-06-30'];
const BRK_13F = {
  'AAPL': [109359,117714,108364,121502,125530,157529,155564,122337,123662,116305,150976,177591,156753,174347,135361,84248,69900,75126,66639,57448,60656,61962,57843,65950],
  'AXP': [15199,18331,21444,25051,25399,24804,28351,21016,20454,22400,25008,26411,22619,28403,34520,35105,41117,44997,40791,48361,50359,56088,45859,51282],
  'KO': [19748,21936,21084,21644,20988,23684,24800,25164,22408,25444,24812,24088,22392,23572,24472,25460,28744,24904,28648,28300,26528,27964,30420,32508],
  'GOOGL': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4338,5586,15600,28158],
  'BAC': [24333,30616,39081,41646,42879,44939,41636,31444,30505,33455,29540,29633,28279,34776,39166,41077,31652,29896,26356,28641,29307,28451,25039,27544],
  'CVX': [3188,4096,2481,2422,2912,4488,25919,23373,23757,29253,21604,19373,18590,18808,19399,18553,17468,17180,19842,17478,18955,19837,17457,13986],
  'OXY': [0,0,0,0,0,0,7738,9335,11943,12242,13217,13179,14542,14552,16119,16090,13157,13053,13078,11130,12518,10894,17221,12868],
  'CB': [0,0,0,0,0,0,0,0,0,0,0,0,1695,4543,6718,6896,7796,7469,8164,7832,8844,10690,11163,11670],
  'MCO': [7151,7160,7367,8940,8760,9636,8324,6709,5997,6873,7549,8578,7800,9635,9696,10384,11708,11678,11488,12374,11755,12603,10762,11173],
  'GOOG': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1028,9606],
  'KHC': [9753,11287,13025,13279,11990,11690,12827,12420,10860,13257,12592,11560,10954,12042,12016,10492,11433,10000,9909,8408,8480,7897,7324,7691],
  'DVA': [3092,4238,3890,4347,4196,4106,4083,2886,2988,2695,2928,3627,3412,3781,4983,5002,5917,5398,5376,4814,4273,3608,4626,6425],
  'DAL': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2647,5369],
  'SIRI': [268,318,266,286,266,0,0,0,0,0,0,0,44,220,142,376,2487,2678,2700,2751,2905,2496,2881,3687],
  'VRSN': [2625,2773,2547,2918,2627,3253,2851,2144,2226,2633,2708,2896,2596,2640,2429,2279,2434,2747,3374,3838,2513,2184,2233,2261],
  'KR': [847,1065,1838,2367,2498,2780,3327,2482,2199,2229,2468,2350,2238,2286,2856,2497,2865,3058,3384,3587,3371,3124,3618,2166],
  'ALLY': [0,0,0,0,0,0,390,1005,835,729,739,783,774,1013,1177,1150,1032,1044,1058,1130,1137,1313,1138,1241],
  'LEN': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,222,780,889,725,877,1186],
  'LLYVK': [0,0,0,0,0,0,0,0,0,0,0,0,357,416,488,418,560,743,744,886,1059,908,996,1118],
  'NYT': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,352,1268,1099],
  'COF': [0,0,0,0,0,0,0,0,0,0,954,1364,1210,1635,1857,1359,1363,1328,1282,1521,1520,1733,1304,602],
  'LLYVA': [0,0,0,0,0,0,0,0,0,0,0,0,161,185,214,187,247,332,335,396,470,406,457,505],
  'LPX': [0,0,0,0,0,0,0,0,297,417,382,528,389,499,554,491,641,587,521,487,503,457,412,446],
  'NUE': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,693,857,868,1045,661,414],
  'M': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,55,173],
  'DHI': [0,0,0,0,0,0,0,0,0,0,0,726,642,0,0,0,0,0,192,191,0,0,0,1],
  'VZ': [3471,8620,9236,8899,8578,8253,70],
  'USB': [4731,6110,7173,7343,7514,7101,6719,5513,3136,291],
  'GM': [2367,3019,3850,3550,3163,3518,2714,1679,1604,1682,1467,848],
  'TSM': [0,0,0,0,0,0,0,0,4118,618],
  'CHTR': [3255,3449,3217,3761,3056,2496,2089,1794,1162,1298,1369,1407,1684,1488,1113,1145,915,683,731,434,292,221],
  'C': [0,0,0,0,0,0,2945,2537,2298,2495,2590,2543,2272,2842,3494,3506,3458,1030],
  'BNY': [2485,3071,3422,3707,3751,4203,3591,3018,2396,1141],
  'WFC': [2995,1582,26,31,31,32],
  'V': [1997,2185,2115,2335,2130,1798,1840,1634,1474,1724,1871,1970,1908,2160,2316,2178,2281,2622,2908,2946,2833,2910],
  'HPQ': [0,0,0,0,0,0,3792,3425,2604,2807,3550,3714,2635,688],
  'ABBV': [1863,2736,2475,2312,1553,411],
  'MA': [1544,1629,1625,1667,1491,1432,1425,1258,1134,1386,1449,1568,1578,1700,1920,1759,1969,2099,2185,2240,2268,2276],
  'MRK': [1858,2347,1379,712],
  'AMZN': [1679,1737,1650,1835,1752,1778,1739,1133,1205,896,1090,1375,1271,1519,1804,1932,1863,2194,1903,2194,2196,525],
  'STZ': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1243,2204,2180,1805,1793,95],
  'BMY': [1807,2068,1959,1757,1305,324],
  'PSKY': [0,0,0,0,0,0,2607,1935,1737,1581,2091,1491,1209,937,89],
  'SNOW': [1537,1724,1404,1481,1852,2075,1404,852,1041,879,945,1078,936,1219,990],
  'UNH': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1572,1740,1664],
  'AON': [0,0,943,1050,1256,1321,1431,1186,1178,1319,1367,1496,1329,1193,1368,1204,1419,1473,1636,1463,1462,1271],
  'DPZ': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,549,1000,1204,1187,1287,1396],
  'NU': [0,0,0,0,0,1005,827,401,471,436,510,845,777,892,1278,1381,1180,416],
  'STNE': [749,1189,655,717,371,180,125,82,102,101,102,136,114],
  'RH': [654,775,1048,1217,1195,974,708,461,581,631],
  'POOL': [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,152,204,466,1008,1072,702],
  'TMUS': [276,707,657,759,670,608,673,705,703,734,759,728,734,840,856,823,964,960,1036],
  'MCK': [0,0,0,0,0,0,895,1043,1087,1071,815],
  'CE': [0,0,0,0,0,0,1126,1077,877,993,960,621],
};
/* ישראליות "לפי ממוצע" — בשווי וברווח, לא ב־TWR (כך התשואה נשארת של באפט): [סימבול, תאריך קנייה, תקציב ₪] */
const DEMO_IL = [['POLI.TA', '2021-03-01', 10000], ['ESLT.TA', '2022-06-01', 10000], ['BEZQ.TA', '2023-10-02', 8000]];
/* מדד ת"א ביטחוניות (207) — ב־Yahoo יש רק מחיר חי, בלי היסטוריה (גם לקרנות הסל שעוקבות אחריו) → נקנה במחיר של היום */
const DEMO_IL_INDEX = '207.TA';
const DEMO_WATCH = ['BRK-B'];
const DEMO_YEARS = 6;
const DEMO_FEE = 1;
/* פנסיה והשתלמות: [מפתח שם, סוג, הפקדה שנתית בשנה הראשונה, גידול הפקדה לשנה, תשואה שנתית] */
const DEMO_FUNDS = [
  ['demoPension', 'pension', 30000, 0.06, 0.065], ['demoPension2', 'pension', 12000, 0.05, 0.095],
  ['demoStudy', 'study', 15500, 0.02, 0.06], ['demoStudy2', 'study', 8000, 0.03, 0.11],
];
const DEMO_NAMES = {
  AAPL: 'Apple', AXP: 'American Express', KO: 'Coca-Cola', GOOGL: 'Alphabet A', GOOG: 'Alphabet C', BAC: 'Bank of America',
  CVX: 'Chevron', OXY: 'Occidental Petroleum', CB: 'Chubb', MCO: "Moody's", KHC: 'Kraft Heinz', DVA: 'DaVita',
  DAL: 'Delta Air Lines', SIRI: 'SiriusXM', VRSN: 'VeriSign', KR: 'Kroger', ALLY: 'Ally Financial', LEN: 'Lennar',
  LLYVK: 'Liberty Live C', LLYVA: 'Liberty Live A', NYT: 'New York Times', COF: 'Capital One', LPX: 'Louisiana-Pacific',
  NUE: 'Nucor', M: "Macy's", DHI: 'D.R. Horton', V: 'Visa', MA: 'Mastercard', AMZN: 'Amazon', UNH: 'UnitedHealth',
  AON: 'Aon', DPZ: "Domino's", POOL: 'Pool Corp', STZ: 'Constellation Brands', CHTR: 'Charter', C: 'Citigroup',
  VZ: 'Verizon', USB: 'U.S. Bancorp', BNY: 'BNY Mellon', WFC: 'Wells Fargo', GM: 'General Motors', HPQ: 'HP',
  TSM: 'TSMC', ABBV: 'AbbVie', MRK: 'Merck', BMY: 'Bristol-Myers Squibb', PSKY: 'Paramount', SNOW: 'Snowflake',
  NU: 'Nu Holdings', STNE: 'StoneCo', RH: 'RH', TMUS: 'T-Mobile', MCK: 'McKesson', CE: 'Celanese', 'BRK-B': 'Berkshire Hathaway B',
};
function demoStockName(sym, lang) {
  for (const [s, en, he] of TASE_STOCKS) if (s === sym) return lang === 'en' ? en : he;
  return DEMO_NAMES[sym] || sym;
}

function isDemoMode() { return !!(typeof DB !== 'undefined' && DB && DB.demo); }

/* חודש m אחרי תאריך ISO (יום בחודש נחתך לסוף החודש). טהורה. */
function demoAddMonths(iso, m) {
  const y = +iso.slice(0, 4), mo = +iso.slice(5, 7) - 1 + m, d = +iso.slice(8, 10);
  const t = new Date(Date.UTC(y, mo, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  t.setUTCDate(Math.min(d, last));
  return t.toISOString().slice(0, 10);
}
/* יום המסחר הראשון מתאריך (עד 10 ימים קדימה). טהורה. */
function demoRowFrom(h, iso) {
  for (const r of (h || [])) if (r.date >= iso && r.close > 0) return r.date <= addDaysISO(iso, 10) ? r : null;
  return null;
}
/* יום המסחר האחרון עד תאריך (עד 10 ימים אחורה) — המחיר שבו 13F מעריך את האחזקה. טהורה. */
function demoRowOnOrBefore(h, iso) {
  for (let i = (h || []).length - 1; i >= 0; i--) {
    const r = h[i];
    if (r.date > iso || !(r.close > 0)) continue;
    return r.date >= addDaysISO(iso, -10) ? r : null;
  }
  return null;
}
/* הרבעון הראשון: האחרון שלא אחרי "לפני 6 שנים" — כך טווח 6 השנים מכוסה (ואם הטבלה מתחילה אחריו — הראשון). טהורה. */
function demoFirstQuarter(today) {
  const from = demoAddMonths(today, -12 * DEMO_YEARS);
  let i0 = 0;
  for (let i = 0; i < BRK_13F_Q.length; i++) if (BRK_13F_Q[i] <= from) i0 = i;
  return i0;
}
/* כמות המניות בכל רבעון (מ־i0) לכל סימבול שיש לו היסטוריה: שווי ÷ סגירה, מעוגל.
   שינוי של פחות מ־0.5% מול העיגון האחרון = אותה אחזקה (רעש עיגול, לא עסקה). טהורה. */
function demoCloneShares(hist, i0) {
  const out = {};
  for (const sym of Object.keys(BRK_13F)) {
    const h = hist[sym] || [];
    if (!h.length) continue;
    const vals = BRK_13F[sym];
    let prevU = 0, prevI = 0;
    const row = [];
    for (let i = i0; i < BRK_13F_Q.length; i++) {
      const v = vals[i] || 0;
      const r = v > 0 ? demoRowOnOrBefore(h, BRK_13F_Q[i]) : null;
      if (!r) { row.push(0); prevU = 0; prevI = 0; continue; }
      const u = v / r.close;
      if (prevU > 0 && Math.abs(u - prevU) / prevU < 0.005) { row.push(prevI); continue; }
      prevU = u; prevI = Math.round(u); row.push(prevI);
    }
    if (row.some((x) => x > 0)) out[sym] = row;
  }
  return out;
}

/* בונה את תיק הדמו — טהורה (hist, שערים ותאריך מבחוץ). tr = פונקציית תרגום. taNow = { '207.TA': מחיר חי }.
   ארה"ב: עסקאות בסוף כל רבעון לפי השינוי באחזקות של ברקשייר (מכירות קודם, אז קניות, במחיר הסגירה).
   קניות שהמזומן לא מכסה — הפקדה (מעוגלת ל־₪10,000 למעלה); רבעון של מכירות נטו — משיכה של כמחצית.
   כך שווי − הפקדות = רווח אמיתי (עד תנודות שער). */
function demoBuild(hist, fxOf, fxNow, today, tr, lang, taNow) {
  const r2 = (v) => Math.round(v * 100) / 100;
  const fx = (d) => (fxOf && fxOf(d)) || fxNow;
  const trades = [], deposits = [];
  let usdCash = 0, ilsCash = 0, n = 0;
  const addDep = (iso, ils, place) => deposits.push({ date: fmtDateIL(iso), amount: ils > 0 ? -ils : Math.abs(ils), place: place, _iso: iso });
  const i0 = demoFirstQuarter(today);
  const sh = demoCloneShares(hist, i0);
  const syms = Object.keys(sh);
  if (syms.length < 4) return null;
  const held = {};
  for (let k = 0; i0 + k < BRK_13F_Q.length; k++) {
    const q = BRK_13F_Q[i0 + k];
    if (q >= today) break;
    const sells = [], buys = [];
    for (const sym of syms) {
      const d = sh[sym][k] - (held[sym] || 0);
      if (!d) continue;
      const row = demoRowOnOrBefore(hist[sym], q);
      if (row) (d < 0 ? sells : buys).push({ sym: sym, qty: Math.abs(d), date: row.date, price: r2(row.close) });
    }
    if (!sells.length && !buys.length) continue;
    const qd = sells.concat(buys).reduce((a, x) => (x.date < a ? x.date : a), q);
    let proceeds = 0, cost = 0;
    for (const x of sells) {
      trades.push({ id: 'demo' + (++n), date: x.date, sym: x.sym, side: 'SELL', qty: x.qty, price: x.price, fee: DEMO_FEE });
      proceeds += x.qty * x.price - DEMO_FEE;
      held[x.sym] = (held[x.sym] || 0) - x.qty;
    }
    for (const x of buys) cost += x.qty * x.price + DEMO_FEE;
    usdCash += proceeds;
    if (cost > usdCash + 1e-6) {
      const dIso = addDaysISO(qd, -2);
      const dep = Math.ceil((cost - usdCash) * fx(dIso) / 10000) * 10000;
      addDep(dIso, dep, tr(k === 0 ? 'demoReservePlace' : 'demoDepPlace'));
      usdCash += dep / fx(dIso);
    }
    for (const x of buys) {
      trades.push({ id: 'demo' + (++n), date: x.date, sym: x.sym, side: 'BUY', qty: x.qty, price: x.price, fee: DEMO_FEE });
      held[x.sym] = (held[x.sym] || 0) + x.qty;
    }
    usdCash -= cost;
    const wIso = addDaysISO(qd, 7);
    const w = Math.floor((proceeds - cost) * fx(wIso) * 0.5 / 1000) * 1000;
    if (w >= 5000 && wIso <= today) {
      addDep(wIso, -w, tr('demoWdPlace'));
      usdCash -= w / fx(wIso);
    }
  }
  if (!trades.length) return null;
  const positions = [];
  for (const sym of [...new Set(trades.map((x) => x.sym))]) {
    const st = mtPosition(trades, sym);
    if (st.shares > 0) positions.push({ sym: sym, name: demoStockName(sym, lang), full: '', shares: st.shares, avg: st.avg, src: 'manual', fromTrades: true });
  }
  // ישראליות: "לפי ממוצע" (בלי עסקאות) — מחיר סגירה אמיתי ביום הקנייה, הפקדה בשקלים
  const ilBuy = (sym, iso, qty, px, name) => {
    const cost = qty * px;
    const dep = Math.ceil(cost / 1000) * 1000;
    addDep(iso, dep, tr('demoDepPlace'));
    ilsCash += dep - cost;
    positions.push({ sym: sym, name: name, full: '', shares: qty, avg: px, src: 'manual' });
  };
  for (const [sym, iso, budget] of DEMO_IL) {
    const row = demoRowFrom(hist[sym], iso);
    if (!row) continue;
    const px = r2(row.close);
    ilBuy(sym, addDaysISO(row.date, -3), Math.max(1, Math.floor(budget / px)), px, demoStockName(sym, lang));
  }
  const idxPx = taNow && taNow[DEMO_IL_INDEX];
  if (idxPx > 0) ilBuy(DEMO_IL_INDEX, today, Math.max(1, Math.floor(12000 / idxPx)), r2(idxPx), tr('demoNameDefense'));
  deposits.sort((a, b) => (a._iso < b._iso ? 1 : a._iso > b._iso ? -1 : 0));
  for (const d of deposits) delete d._iso;
  // פנסיה והשתלמות: הפקדה לכל שנה (השנה הנוכחית — לפי החודשים שעברו), שווי = הפקדות שצמחו בתשואה השנתית
  const y = Number(today.slice(0, 4)), monthsNow = Number(today.slice(5, 7));
  const pensionFunds = [], pensionDeposits = [];
  for (const [key, kind, dep0, depGrow, ret] of DEMO_FUNDS) {
    let value = 0;
    for (let k = 0; k < DEMO_YEARS; k++) {
      const yr = y - DEMO_YEARS + 1 + k;
      const part = yr === y ? monthsNow / 12 : 1;
      const dep = Math.round(dep0 * Math.pow(1 + depGrow, k) * part / 100) * 100;
      if (!(dep > 0)) continue;
      pensionDeposits.push({ place: tr(key), period: String(yr), amount: -dep, note: '', kind: kind });
      const age = (y - yr) + (monthsNow / 12) - part / 2; // הפקדה באמצע התקופה שלה
      value += dep * Math.pow(1 + ret, Math.max(0, age));
    }
    pensionFunds.push({ name: tr(key), usd: 0, ils: Math.round(value / 100) * 100, kind: kind });
  }
  return {
    v: 1,
    positions: positions,
    deposits: deposits,
    manualTrades: trades,
    cash: { usd: r2(Math.max(0, usdCash)), ils: r2(Math.max(0, ilsCash)) },
    wishlist: DEMO_WATCH.map((s) => ({ sym: s, note: tr('demoWlBrk') })),
    pensionFunds: pensionFunds,
    pensionDeposits: pensionDeposits.sort((a, b) => (a.period < b.period ? 1 : a.period > b.period ? -1 : 0)),
    source: 'manual',
    demo: true,
  };
}

/* היסטוריה של מניה שנמכרה כולה — רק סביב תקופת ההחזקה (ל־TWR), כדי לא למלא את הטלפון. טהורה. */
function demoTrimSold(rows, from, to) {
  const a = addDaysISO(from, -20), b = addDaysISO(to, 5);
  return (rows || []).filter((r) => r.date >= a && r.date <= b);
}

let _demoBusy = false;

/* v163: התקדמות בניית הדמו — בתוך כרטיס הדמו עצמו (לא חלון צף): שלבים (ממתין / עכשיו / הושלם)
   + פס התקדמות. מחזיר בקר: step(i, פירוט), detail, progress(0..1), done(), fail(הודעה). */
function demoProgressOpen() {
  const card = document.getElementById('demoOffer');
  const noop = { shown: 0, progress() {}, step() {}, detail() {}, done() {}, fail() { flash(t('demoFail')); } };
  if (!card) return noop;
  const old = card.querySelector('.demo-inline');
  if (old) old.remove();
  const box = el('div', 'demo-inline');
  box.setAttribute('aria-live', 'polite');
  box.innerHTML = '<h2>' + esc(t('demoProgTitle')) + '</h2>' +
    '<p class="demo-prog-sub">' + esc(t('demoProgSub')) + '</p>' +
    '<div class="demo-prog-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"><span></span></div>' +
    '<div class="demo-prog-pct" dir="ltr">0%</div>' +
    '<ol class="demo-steps">' + [t('demoStepPrices'), t('demoStepFx'), t('demoStepBuild'), t('demoStepSave')].map((lbl) => '<li class="demo-step" data-state="wait">' +
      '<span class="ds-dot" aria-hidden="true"></span><span class="ds-txt"><span class="ds-lbl">' + esc(lbl) +
      '</span><span class="ds-det"></span></span></li>').join('') + '</ol>' +
    '<div class="demo-prog-err hidden"></div>';
  card.appendChild(box);
  card.classList.add('building');
  const bar = box.querySelector('.demo-prog-bar');
  const pct = box.querySelector('.demo-prog-pct');
  const steps = [...box.querySelectorAll('.demo-step')];
  const close = () => { box.remove(); card.classList.remove('building', 'failed'); };
  const ctl = {
    shown: 0,
    progress(f) {
      const v = Math.max(ctl.shown, Math.min(1, f || 0)); // לא חוזרים אחורה
      ctl.shown = v;
      bar.firstChild.style.width = (v * 100).toFixed(1) + '%';
      bar.setAttribute('aria-valuenow', String(Math.round(v * 100)));
      pct.textContent = Math.round(v * 100) + '%';
    },
    step(i, det) {
      steps.forEach((li, k) => { li.dataset.state = k < i ? 'done' : k === i ? 'now' : 'wait'; });
      if (det !== undefined) steps[i].querySelector('.ds-det').textContent = det;
    },
    detail(i, det) { steps[i].querySelector('.ds-det').textContent = det; },
    done() {
      steps.forEach((li) => { li.dataset.state = 'done'; });
      ctl.progress(1);
      setTimeout(close, 500);
    },
    fail(msg) {
      card.classList.add('failed');
      steps.forEach((li) => { if (li.dataset.state === 'now') li.dataset.state = 'fail'; });
      const e = box.querySelector('.demo-prog-err');
      e.innerHTML = '<p>' + esc(msg) + '</p><div class="demo-err-btns"><button class="btn" type="button" data-act="retry">' +
        esc(t('demoRetry')) + '</button><button class="chip-btn" type="button" data-act="close">' + esc(t('btnClose')) + '</button></div>';
      e.classList.remove('hidden');
      e.querySelector('[data-act="close"]').addEventListener('click', close);
      e.querySelector('[data-act="retry"]').addEventListener('click', () => { close(); demoCreate(null, true); });
    },
  };
  return ctl;
}

async function demoCreate(btn, noConfirm) {
  if (_demoBusy || isDemoMode()) return;
  if (!noConfirm && !confirm(t('demoConfirm'))) return;
  _demoBusy = true;
  if (btn) btn.disabled = true;
  const ui = demoProgressOpen();
  try {
    const today = todayISO();
    const demoTexts = {
      demoDepPlace: t('demoDepPlace'), demoWdPlace: t('demoWdPlace'), demoReservePlace: t('demoReservePlace'),
      demoWlBrk: t('demoWlBrk'), demoPension: t('demoPension'), demoStudy: t('demoStudy'),
      demoPension2: t('demoPension2'), demoStudy2: t('demoStudy2'), demoNameDefense: t('demoNameDefense'),
    };
    // שלב 1: מחירים — מהשרתון, עד 40 סימבולים לבקשה (במקביל); רק מה שחסר — ישירות
    ui.step(0, t('demoStepServer'));
    const syms = Object.keys(BRK_13F).concat(DEMO_IL.map((x) => x[0]));
    const hist = {};
    ui.progress(0.05);
    const creep = setInterval(() => ui.progress(Math.min(0.5, (ui.shown || 0) + 0.03)), 400); // תנועה בזמן ההמתנה
    const taNow = {};
    const idxQ = proxyQuotes([DEMO_IL_INDEX]).then((got) => {
      const q = got[DEMO_IL_INDEX];
      if (q && q.close > 0) taNow[DEMO_IL_INDEX] = q.close;
    }).catch(() => {});
    const parts = [];
    for (let i = 0; i < syms.length; i += 40) parts.push(syms.slice(i, i + 40));
    await Promise.all(parts.map(async (part) => {
      try {
        const got = await proxyHistory(part, '7y', 25000);
        for (const s of Object.keys(got)) if (got[s].length > 200) hist[s] = got[s];
      } catch (e) { /* השרת לא ענה — ממשיכים ישירות */ }
    }));
    clearInterval(creep);
    const missing = syms.filter((s) => !hist[s]);
    let done = syms.length - missing.length;
    ui.detail(0, t('demoStepOf', { n: done, total: syms.length }));
    ui.progress(0.05 + 0.65 * done / syms.length);
    if (missing.length) {
      histProxyOff = true;
      try {
        await pool(missing, 6, async (s) => {
          let h = [];
          try { h = (await getDailyFast(s, true)) || []; } catch (e) { h = []; }
          if (!h.length) h = state.hist[s] || []; // מה שיש במטמון
          if (h.length) hist[s] = h;
          done++;
          ui.detail(0, t('demoStepOf', { n: done, total: syms.length }));
          ui.progress(0.05 + 0.65 * done / syms.length);
        });
      } finally { histProxyOff = false; }
    }
    await idxQ;
    // שלב 2: שערי דולר־שקל לכל התקופה
    ui.step(1);
    ui.progress(0.78);
    try { await ensureFxHist(addDaysISO(BRK_13F_Q[demoFirstQuarter(today)], -30)); } catch (e) {}
    // שלב 3: עסקאות לפי הדוחות של ברקשייר, הפקדות ופנסיה
    ui.step(2);
    ui.progress(0.86);
    await new Promise((r) => setTimeout(r, 60)); // לתת למסך להתעדכן לפני החישוב
    const db = demoBuild(hist, (d) => fxOnOrBefore(d), state.fx || 3.7, today, (k) => demoTexts[k], state.lang, taNow);
    // שומרים היסטוריה רק למה שנסחר; מניה שנמכרה כולה — רק סביב תקופת ההחזקה (ל־TWR)
    const span = {};
    for (const x of (db ? db.manualTrades : [])) {
      const o = span[x.sym] || (span[x.sym] = { from: x.date, to: x.date });
      if (x.date < o.from) o.from = x.date;
      if (x.date > o.to) o.to = x.date;
    }
    const heldNow = new Set((db ? db.positions : []).map((p) => p.sym));
    for (const s of Object.keys(hist)) {
      if (heldNow.has(s)) storeHistRows(s, hist[s]);
      else if (span[s]) storeHistRows(s, demoTrimSold(hist[s], span[s].from, span[s].to));
      else { delete state.hist[s]; try { localStorage.removeItem(LS_HIST + s); } catch (e) {} }
    }
    if (!db) { ui.fail(t('demoFail')); return; }
    ui.detail(2, t('demoStepStocks', { n: db.positions.length }));
    // שלב 4: שמירה אחרונה של הנתונים האמיתיים לענן — ואז גיבוי מקומי, והדמו לא נשמר בענן
    ui.step(3);
    ui.progress(0.94);
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
    ui.done();
    const ov = document.querySelector('.tab[data-tab="overview"]');
    if (ov) ov.click();
    flash(t('demoReady'));
  } catch (e) {
    ui.fail(t('demoFail'));
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
  for (const sym of new Set(POSITIONS.concat(WISHLIST, DB.manualTrades || []).map((p) => p.sym))) { // v168: גם מה שנמכר
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
  // אבטחה: ניתוק מוחק מהטלפון גם את פרטי הגישה (token, Query ID, מפתח שרתון) — כפי שההודעה מבטיחה
  ibkrSaveCfg({ lastSync: 0, data: null, token: '', queryId: '', appKey: '', statementUrl: '' });
  for (const id of ['ibkrToken', 'ibkrQuery']) { const e = document.getElementById(id); if (e) e.value = ''; }
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
  ibkrSaveCfg({ proxyUrl, token, queryId, appKey: '', fromDate: /^\d{4}-\d{2}-\d{2}$/.test(fromDate) ? fromDate : '', historyYears: depthYears });
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
/* v159: מחיר מניה בת"א — באגורות, כמו בבורסה ("7,830 אג'"). בפנים נשמר בשקלים.
   עטוף בבידוד RTL כדי ש"אג'" יופיע משמאל למספר בכל הקשר (גם בתוך dir=ltr וגם בקנבס). */
function fmtAg(v, sym) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  if (sym && isTaseIndex(sym)) {
    const p = v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return state.lang === 'en' ? p + ' pts' : '\u2067' + p + ' ' + t('ptsShort') + '\u2069';
  }
  const n = (Math.round(v * 100 * 100) / 100).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return state.lang === 'en' ? n + ' ag.' : '\u2067' + n + ' ' + t('agShort') + '\u2069';
}
function fmtILS2(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '₪' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* v142: מטבע המסחר של מניה — בורסת ת"א (סיומת .TA) בשקלים, השאר בדולרים.
   כל מחיר/ממוצע/עסקה של מניה נשמר במטבע שלה; סכומים (שווי, רווח, עוגה, תשואה)
   מומרים לדולר דרך nativeToUSD, ומשם למטבע התצוגה כמו תמיד. */
function symCur(sym) { return /\.TA$/i.test(String(sym || '')) ? 'ILS' : 'USD'; }
/* v168: מדד של בורסת ת"א (סימבול מספרי — 207.TA = ת"א ביטחוניות). Yahoo מדווח בנקודות (ILS, לא ILA):
   מוצג בנקודות ומוזן בנקודות; שווי = יחידות × נקודות בשקלים. */
function isTaseIndex(sym) { return /^\d{1,4}\.TA$/i.test(String(sym || '')); }
/* v157: מחיר מניה בת"א מוזן באגורות — כמו הציטוט הרשמי בבורסה. בפנים נשמר בשקלים (כמו Yahoo אחרי חלוקה ב־100).
   עמלה נשארת בשקלים. טהורות. */
function pxInFactor(sym) { return symCur(sym) === 'ILS' && !isTaseIndex(sym) ? 100 : 1; }
function pxFromInput(sym, v) { return v / pxInFactor(sym); }
function pxToInput(sym, v) {
  if (v === undefined || v === null || v === '' || !isFinite(+v)) return '';
  return String(Math.round(+v * pxInFactor(sym) * 1e6) / 1e6);
}
function pxUnit(sym) { return isTaseIndex(sym) ? t('ptsUnit') : symCur(sym) === 'ILS' ? t('agorotUnit') : '$'; }
/* v157: תיקון חד־פעמי — מחיר ת"א שהוזן באגורות לפני v157 נשמר כשקלים (פי 100). מזהים לפי יחס למחיר החי:
   30–300 = כמעט בוודאות אגורות (מניה לא יורדת פי 30). טהורה על db + מחירים; מחזירה כמה תוקנו. */
function fixAgorotEntries(db, priceOf) {
  let n = 0;
  const off = (sym, v) => { const px = priceOf(sym); if (!(px > 0) || !(v > 0)) return false; const r = v / px; return r >= 30 && r <= 300; };
  for (const p of (db.positions || [])) {
    if (!p || symCur(p.sym) !== 'ILS' || p.fromTrades) continue; // IBKR ממפה רק USD — כל מניית ת"א ידנית
    if (off(p.sym, p.avg)) { p.avg = p.avg / 100; n++; }
  }
  for (const x of (db.manualTrades || [])) {
    if (!x || symCur(x.sym) !== 'ILS') continue;
    if (off(String(x.sym).toUpperCase(), +x.price)) { x.price = +x.price / 100; n++; }
  }
  return n;
}
function nativeToUSD(v, sym, fx) {
  if (v === null || v === undefined || !isFinite(v)) return null;
  if (symCur(sym) !== 'ILS') return v;
  const r = fx === undefined ? state.fx : fx;
  return r > 0 ? v / r : null;
}
/* מחיר למניה לתצוגה: מניה ישראלית תמיד בשקלים (ככה היא נסחרת); מניה אמריקאית
   לפי מטבע התצוגה (כמו קודם). */
function fmtPx(v, sym) {
  if (symCur(sym) === 'ILS') return fmtAg(v, sym);
  return state.currency === 'ILS' && state.fx ? fmtILS(v * state.fx) : fmtUSD2(v);
}
function fmtILS(v) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  return '₪' + Math.round(v).toLocaleString('en-US');
}
/* v166: מספר עם סימן תמיד משמאל למספר ("+0.52%", "−$2,215") — גם בתוך טקסט עברי. בלי בידוד,
   ב־RTL הדפדפן מזיז את הסימן לימין ("0.52%+"). LRI…PDI = בידוד LTR שלא נראה על המסך. */
function ltrNum(s) { return '\u2066' + s + '\u2069'; }
function fmtPct(v, signed) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  const s = v < 0 ? '−' : signed && v > 0 ? '+' : '';
  return ltrNum(s + Math.abs(v).toFixed(2) + '%');
}
/* סכום עם סימן: "+$2,215" / "−₪1,300" (מטבע לפי cur). null → מקף. */
function fmtSignedMoney(v, cur) {
  if (v === null || v === undefined || !isFinite(v)) return '—';
  if (Math.abs(v) < 0.5) return ltrNum(money(0, cur)); // v168: "$0" בלי סימן (מניה שנקנתה היום)
  return ltrNum((v < 0 ? '−' : '+') + money(Math.abs(v), cur));
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
const APP_VERSION = 'v208';


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
/* v178: צבעי הפרוסות לפי הדירוג בתיק (בקשת המשתמש — בדיוק הצבעים מצילום העוגה של הדמו): הגדולה ירוקה, השנייה תכלת,
   השלישית אלמוגית וכו'. אחרי 21 — מתחילים מחדש. */
const PIE_RANK_PALETTE = ['#8DC63F', '#8FC1E3', '#F46A5C', '#C95CF5', '#8BC9A6', '#F2D250', '#BE5B8D', '#9A9AA6', '#7CC6C2',
  '#97E38F', '#C6783F', '#F45CE6', '#D4F55C', '#8B9FC9', '#F25070', '#9DA69A', '#5BA6BE', '#9D7CC6', '#3FC656', '#E38FC1', '#5CF46A'];
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
/* v169: לוגו לבן/בהיר מאוד (UNH, UBER, APP ב־FMP הם לבן על שקוף) — נעלם על אריח לבן.
   מזהים לפי הבהירות הממוצעת של הפיקסלים האטומים; אז האריח כהה (כמו אייקון אפליקציה). */
function logoIsLight(img) {
  try {
    if (/s3-symbol-logo\.tradingview\.com/.test(img.src || '')) return false; // רקע משלו
    const w = Math.min(64, img.naturalWidth || 0), h = Math.min(64, img.naturalHeight || 0);
    if (w < 4 || h < 4) return false;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const d = ctx.getImageData(0, 0, w, h).data;
    let sum = 0, cnt = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 128) { sum += d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; cnt++; }
    }
    return cnt >= 5 && sum / cnt > 225;
  } catch (e) { return false; }
}
/* v173: כמו בטאב המניות — לוגו לבן מתהפך לשחור על האריח הלבן (במקום אריח כהה). עותק הפוך בקנבס. */
function logoInverted(img) {
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const im = ctx.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    ctx.putImageData(im, 0, 0);
    return c;
  } catch (e) { return null; }
}
/* v169: שם החברה המלא, נקי ("Microsoft", "Meta Platforms", "בנק הפועלים"): ת"א בעברית לפי שפה,
   אחרת רשימת החיפוש / השם מ־Yahoo / מה שנשמר. בלי "Inc." / "Corp." וכו'. */
function companyName(sym, fallback) {
  const s = normalizeSym(sym);
  let n = '';
  for (const r of TASE_STOCKS) if (r[0] === s) { n = state.lang === 'en' ? r[1] : r[2]; break; }
  if (!n) for (const r of POPULAR_STOCKS) if (r[0] === s) { n = r[1]; break; }
  if (!n) { const q = state.quotes[s]; n = (q && q.longName) || ''; }
  if (!n) { const p = POSITIONS.find((x) => x.sym === sym); n = (p && (p.full || (p.name !== p.sym ? p.name : ''))) || fallback || ''; }
  return String(n).replace(/,?\s+(Inc|Corp|Corporation|Co|Ltd|Limited|Holdings|Hldgs|N\.V|plc|S\.A|AG|SE|Company)\.?(?=\s|$)/gi, '').replace(/\s{2,}/g, ' ').trim();
}
/* v183: פריסת "הסברים" (callouts) לתיק עם הרבה מניות — ארבעה אזורים סביב העוגה: שורה מעל (פרוסות ליד 12),
   טור מימין, שורה מתחת (ליד 6), טור משמאל — השורות רק עם rows=true; ברירת המחדל: שני טורים מאוזנים. כל התוויות על לולאה אחת עם כיוון השעון (שמאל למעלה → מעל → ימין
   למטה → מתחת → שמאל למעלה), כך שהקווים המובילים לעולם לא מצטלבים; שורה מלאה שופכת לטורים הסמוכים, והטורים
   מאוזנים. items: [{mid}], chipW/chipH בגודל הסופי. מחזיר { h, R, cx, cy, pos: [{x, y, zone, side}] } או null. טהורה. */
function pieCalloutLayout(items, w, hMax, chipH, chipW, gap) {
  // v186: השבבים מקיפים את העוגה — שורה מעל (משמאל לימין), טור ימני (מלמעלה למטה), שורה מתחת (מימין לשמאל), טור שמאלי (מלמטה למעלה):
  // לולאה אחת עם כיוון השעון, כל שבב בצד שאליו מצביעה הפרוסה שלו. צד מלא → השבב שבקצה הקרוב יותר לפינה עובר לצד השכן (הסדר נשמר,
  // לכן הקווים לא מצטלבים; השבב הגדול נשאר מול הפרוסה שלו). הגובה = הנמוך ביותר שבו הכול נכנס; צד ריק לא תופס מקום.
  // בתוך צד: כל שבב מול הזווית שלו, נדחקים זה מזה בלי חפיפה.
  const n = items.length;
  if (!n) return null;
  const Q = Math.PI / 4;
  const norm = (a) => { let t = a; while (t < 5 * Q) t += Math.PI * 2; while (t >= 13 * Q) t -= Math.PI * 2; return t; }; // [225°, 585°)
  const colW = chipW, R = (w - 2 * colW - 2 * gap) / 2;
  if (R < 40) return null;
  const step = chipH + 4, stepX = chipW + 6;
  const rowCap = Math.max(0, Math.floor((w - 8) / stepX));
  const ord = items.map((it, i) => i).sort((p, q) => norm(items[p].mid) - norm(items[q].mid));
  const ang = (i) => norm(items[i].mid);
  const ZONES = 'TRBL'.split(''), LO = { T: 5 * Q, R: 7 * Q, B: 9 * Q, L: 11 * Q }; // מעל, ימין, מתחת, שמאל — לפי כיוון השעון
  const pack = (targets, lo, hi, st) => { // סדר נשמר; נדחקים זה מזה בלי לחרוג מהגבולות
    const y = targets.slice();
    for (let it = 0; it < 8; it++) {
      for (let k = 0; k < y.length; k++) y[k] = Math.max(k ? y[k - 1] + st : lo, Math.min(y[k], hi - (y.length - 1 - k) * st));
      for (let k = y.length - 1; k >= 0; k--) y[k] = Math.min(k < y.length - 1 ? y[k + 1] - st : hi, Math.max(y[k], lo + k * st));
    }
    return y;
  };
  const build = (useT, useB) => {
    const topH = useT ? chipH + 8 : 0, botH = useB ? chipH + 8 : 0, cands = [];
    for (let h = topH + botH + 2 * R + 24; h <= hMax + 0.5; h += step) {
      const colCap = Math.max(0, Math.floor((h - topH - botH - 8 - chipH) / step) + 1);
      const cap = { T: useT ? rowCap : 0, R: colCap, B: useB ? rowCap : 0, L: colCap };
      if (2 * colCap + cap.T + cap.B < n) continue;
      const z = { T: [], R: [], B: [], L: [] };
      for (const i of ord) { const a = ang(i); z[a < 7 * Q ? 'T' : a < 9 * Q ? 'R' : a < 11 * Q ? 'B' : 'L'].push(i); }
      let okAll = true;
      for (let guard = 0; guard < n * 4; guard++) {
        const full = ZONES.find((k) => z[k].length > cap[k]);
        if (!full) break;
        const zi = ZONES.indexOf(full), prev = ZONES[(zi + 3) % 4], next = ZONES[(zi + 1) % 4];
        const first = z[full][0], last = z[full][z[full].length - 1];
        const dFirst = ang(first) - LO[full], dLast = LO[full] + 2 * Q - ang(last); // מרחק מהפינה
        // מקום בצד השכן — ואם הוא מלא, השכן דוחף את הקצה שלו לצד הסמוך לו (הסדר לאורך הלולאה נשמר)
        const room = (k, dir, depth) => {
          if (z[k].length < cap[k]) return true;
          if (depth >= 1) return false; // רק לצד הסמוך — שני צדדים הלאה = קו שחוצה את העוגה
          const nk = ZONES[(ZONES.indexOf(k) + (dir < 0 ? 3 : 1)) % 4];
          if (!z[k].length || !room(nk, dir, depth + 1)) return false;
          if (dir < 0) z[nk].push(z[k].shift()); else z[nk].unshift(z[k].pop());
          return true;
        };
        const tryPrev = () => room(prev, -1, 0) && (z[prev].push(z[full].shift()), true);
        const tryNext = () => room(next, 1, 0) && (z[next].unshift(z[full].pop()), true);
        if (!(dFirst <= dLast ? (tryPrev() || tryNext()) : (tryNext() || tryPrev()))) { okAll = false; break; }
      }
      if (!okAll) continue;
      const cx = w / 2, cy = topH + (h - topH - botH) / 2;
      const pos = items.map(() => null);
      const col = (idx, x, side) => { // L: מלמטה למעלה לפי הסדר; R: מלמעלה למטה
        if (!idx.length) return;
        const seq = side < 0 ? idx.slice().reverse() : idx;
        const lo = topH + chipH / 2 + 4, hi = h - botH - chipH / 2 - 4;
        const y = pack(seq.map((i) => cy + Math.sin(items[i].mid) * (hi - lo) / 2), lo, hi, step);
        seq.forEach((i, k) => { pos[i] = { x: x, y: y[k], zone: side < 0 ? 'L' : 'R', side: side }; });
      };
      const row = (idx, y, zone) => { // T: משמאל לימין; B: מימין לשמאל
        if (!idx.length) return;
        const seq = zone === 'B' ? idx.slice().reverse() : idx;
        const x = pack(seq.map((i) => cx + Math.cos(items[i].mid) * (R + 40)), chipW / 2 + 4, w - chipW / 2 - 4, stepX);
        seq.forEach((i, k) => { pos[i] = { x: x[k], y: y, zone: zone, side: x[k] < cx ? -1 : 1 }; });
      };
      col(z.L, colW / 2 + 2, -1);
      col(z.R, w - colW / 2 - 2, 1);
      row(z.T, chipH / 2 + 4, 'T');
      row(z.B, h - chipH / 2 - 4, 'B');
      // איכות = סטייה זוויתית בין הפרוסה לשבב שלה מעבר ל־25° (משוקללת בגודל הפרוסה): גובה נוסף נבחר רק כשהוא באמת מקרב שבבים לפרוסות
      let q = 0;
      items.forEach((it, i) => { let d = Math.abs(norm(Math.atan2(pos[i].y - cy, pos[i].x - cx)) - norm(it.mid)); if (d > Math.PI) d = 2 * Math.PI - d; d = Math.max(0, d - 0.44); q += (0.02 + (it.span || 0)) * d * d; });
      cands.push({ h: h, R: R, cx: cx, cy: cy, pos: pos, usedT: z.T.length > 0, usedB: z.B.length > 0, q: q });
      if (cands.length >= 6) break;
    }
    if (!cands.length) return null;
    const qMin = Math.min(...cands.map((c) => c.q)); // הגובה הנמוך ביותר שאיכותו קרובה לטובה ביותר
    return cands.find((c) => c.q <= qMin * 1.2 + 0.01);
  };
  let L = build(true, true);
  if (L && (!L.usedT || !L.usedB)) L = build(L.usedT, L.usedB) || L; // שורה ריקה — בלי הרווח שלה
  return L;
}

/* v178: הבהרה/הכהיה של צבע hex (k>0 בהיר יותר, לבן ב־1). טהורה. */
function pieShade(hex, k) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))));
  return '#' + [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)].map((v) => v.toString(16).padStart(2, '0')).join('');
}
/* v178: איזו פרוסה נמצאת בנקודה (x,y ביחס לקנבס) — או null. טהורה על הגאומטריה. */
function pieHitSym(geom, x, y) {
  if (!geom) return null;
  for (const c of (geom.chips || [])) if (x >= c.x - 4 && x <= c.x + c.w + 4 && y >= c.y - 3 && y <= c.y + c.h + 3) return c.sym; // v183: נגיעה בשבב
  const dx = x - geom.cx, dy = y - geom.cy, d = Math.hypot(dx, dy);
  if (d < geom.r - 2 || d > geom.R + 16) return null;
  let ang = Math.atan2(dy, dx);
  for (const g of geom.segs) {
    let t = ang;
    while (t < g.a) t += Math.PI * 2;
    if (t <= g.a2) return g.sym;
  }
  return null;
}
/* v179: אנימציית קפיץ (spring) — הפרוסה קופצת החוצה עם "נשימה" קטנה ונרגעת; השאר נסוגות בעמעום.
   פיזיקה אמיתית (מהירות + ריסון) ולא עקומה קבועה — המעבר רציף גם אם נוגעים שוב באמצע. */
const PIE_SPRING = { k: 320, c: 20 };
let pieAnimRaf = 0;
function pieAnimateLift(target) {
  state.pieLift = state.pieLift || {};
  state.pieVel = state.pieVel || {};
  state.pieTarget = target || null;
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || typeof requestAnimationFrame !== 'function') {
    for (const k of Object.keys(state.pieLift)) state.pieLift[k] = 0;
    if (target) state.pieLift[target] = 1;
    state.pieFocus = target ? 1 : 0;
    try { drawPie(); } catch (e) {}
    return;
  }
  if (target && !(target in state.pieLift)) state.pieLift[target] = 0;
  let last = 0;
  const step = (now) => {
    const dt = Math.min(0.034, last ? (now - last) / 1000 : 0.016);
    last = now;
    let moving = false;
    const keys = Object.keys(state.pieLift).concat(['__focus']);
    for (const k of keys) {
      const isF = k === '__focus';
      const x = isF ? (state.pieFocus || 0) : state.pieLift[k];
      const v = state.pieVel[k] || 0;
      const goal = isF ? (state.pieTarget ? 1 : 0) : (k === state.pieTarget ? 1 : 0);
      const cc = isF ? PIE_SPRING.c * 1.6 : PIE_SPRING.c; // העמעום בלי קפיצה
      const a = PIE_SPRING.k * (goal - x) - cc * v;
      const nv = v + a * dt, nx = x + nv * dt;
      if (Math.abs(goal - nx) < 0.002 && Math.abs(nv) < 0.01) {
        if (isF) state.pieFocus = goal; else state.pieLift[k] = goal;
        state.pieVel[k] = 0;
        if (!isF && goal === 0) delete state.pieLift[k];
      } else {
        if (isF) state.pieFocus = Math.max(0, nx); else state.pieLift[k] = Math.max(0, nx);
        state.pieVel[k] = nv;
        moving = true;
      }
    }
    try { drawPie(); } catch (e) {}
    pieAnimRaf = moving ? requestAnimationFrame(step) : 0;
  };
  if (!pieAnimRaf) pieAnimRaf = requestAnimationFrame(step);
}
function pieWireTouch(canvas) {
  if (!canvas || !canvas.addEventListener || canvas.dataset.pieTouch) return;
  canvas.dataset.pieTouch = '1';
  canvas.style.cursor = 'pointer';
  canvas.style.touchAction = 'manipulation';
  canvas.addEventListener('pointerdown', (ev) => {
    const rc = canvas.getBoundingClientRect();
    const sym = pieHitSym(state.pieGeom, ev.clientX - rc.left, ev.clientY - rc.top);
    const cur = state.pieActive || null;
    const next = sym && sym !== cur ? sym : null;
    state.pieActive = next;
    if (next) { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }
    pieAnimateLift(next);
  });
}

/* v169: מלבן מעוגל (גם בדפדפנים בלי roundRect) */
function pieRoundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
/* v169: האם מלבן (מרכז cx0,cy0 ביחס למרכז העוגה) נכנס כולו לתוך הפרוסה [a,a2] בטבעת [r,R], עם שוליים. טהורה. */
function pieBoxFits(x, y, w, h, a, a2, r, R, pad) {
  const pts = [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x - w / 2, y + h / 2], [x + w / 2, y + h / 2], [x, y - h / 2], [x, y + h / 2], [x - w / 2, y], [x + w / 2, y]];
  for (const [px, py] of pts) {
    const d = Math.hypot(px, py);
    if (d < r + pad || d > R - pad) return false;
    let ang = Math.atan2(py, px);
    while (ang < a) ang += Math.PI * 2;
    while (ang > a + Math.PI * 2) ang -= Math.PI * 2;
    if (ang > a2) return false;
    if (d * (ang - a) < pad || d * (a2 - ang) < pad) return false;
  }
  return true;
}
/* v169: סכום מקוצר לבועה: $13.2K / $950 / ₪1.2M */
function fmtShortMoney(v, cur) {
  const sym = cur === 'ILS' ? '₪' : '$';
  const a = Math.abs(v);
  const t = a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 0 : 1) + 'M' : a >= 1e4 ? (a / 1e3).toFixed(0) + 'K' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'K' : Math.round(a).toString();
  return sym + t.replace(/\.0(?=[KM])/, '');
}

/* v193: ציור עוגה מאוחד — כמה לוגואים שנטענים באותה שנייה = ציור אחד בפריים הבא, לא ציור מלא לכל לוגו */
let _pieDrawT = 0;
function schedulePie() {
  if (_pieDrawT) return;
  const run = () => { _pieDrawT = 0; try { drawPie(); } catch (e) {} };
  _pieDrawT = typeof requestAnimationFrame === 'function' ? requestAnimationFrame(run) : setTimeout(run, 16);
}
function pieLogoImg(sym) {
  const s = normalizeSym(sym);
  let e = PIE_LOGO_CACHE[s];
  if (!e) {
    e = PIE_LOGO_CACHE[s] = { img: new Image(), ready: false, failed: false };
    e.img.onload = () => { e.ready = true; e.light = logoIsLight(e.img); if (e.light) e.inv = logoInverted(e.img); schedulePie(); };
    e.img.onerror = () => { e.failed = true; schedulePie(); };
    const src = logoSrc(s);
    if (src) { e.img.crossOrigin = 'anonymous'; e.img.src = src; } else e.failed = true;
  }
  return e;
}

/* v159: לוגו רשמי. מניות ת"א — לוגו TradingView לפי מזהה החברה (FMP החזיר תמונות אקראיות,
   למשל בניין במקום הלוגו של הפועלים); ת"א שלא ברשימה — בלי תמונה (האות הראשונה). */
const TASE_LOGOS = ('LUMI:leumi POLI:bank-hapoalim DSCT:discount MZTF:mizrahi-tefahot FIBI:fibi-bank TEVA:teva ' +
  'ESLT:elbit-systems NICE:nice ICL:icl BEZQ:bezeq AZRG:azrieli DLEKG:delek NVMI:nova TSEM:tower-semiconductor ' +
  'ORL:bazan HARL:harel PHOE:phoenix CLIS:clal-insurance MGDL:migdal-insur MMHD:menora-miv-hld SPEN:shapir-eng ' +
  'ENLT:enlight-energy ENRG:energix OPCE:opc-energy SAE:shufersal STRS:strauss ALHE:alony-hetz AMOT:amot ' +
  'MLSR:melisron BIG:big NWMD:newmed-energy-ltd CEL:cellcom PTNR:partner ELAL:el-al-israel-airlines-ltd FTAL:fattal ' +
  'MTRX:matrix ONE:one-technologi ELTR:electra SKBN:shikun-and-binui ASHG:ashtrom CAMT:camtek KEN:kenon-ltd ' +
  'DANE:danel ELCO:elco HLAN:hilan AURA:aura ISRA:isramco-negev-2 NXSN:next-vision-stabil FORTY:formula ' +
  'MVNE:mivne ILCO:israel').split(' ').reduce((o, kv) => { const [k, v] = kv.split(':'); o[k] = v; return o; }, {});
function logoSrc(sym) {
  const s = normalizeSym(sym);
  if (!s) return null;
  if (/\.TA$/i.test(s)) {
    const id = TASE_LOGOS[s.replace(/\.TA$/i, '')];
    return id ? 'https://s3-symbol-logo.tradingview.com/' + id + '.svg' : null;
  }
  return 'https://financialmodelingprep.com/image-stock/' + encodeURIComponent(s) + '.png';
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
    // v159: CNBC מחזיר מניות ת"א באגורות (בלי סימון) — כמו Yahoo ILA, מחלקים ב־100
    const ag = symCur(sym) === 'ILS' && String(it.currencyCode || 'ILA').toUpperCase() !== 'ILS' ? 100 : 1;
    if (ag !== 1) close = close / ag;
    out[sym] = {
      symbol: sym,
      date: todayISO(),
      time: tm,
      prev: (num(it.previous_day_closing) || (num(it.change) ? num(it.last) - num(it.change) : 0)) / ag || null,
      open: num(it.open) / ag,
      high: num(it.high) / ag,
      low: num(it.low) / ag,
      close: close,
      session: session,
      volume: parseInt(String(it.volume || '').replace(/,/g, ''), 10) || 0
    };
  }
  return out;
}

/* סשן המסחר כרגע לפי שעון ניו־יורק: pre / post / '' — טהור־למחצה, נבדק */
/* v199: לוח החגים של NYSE — לפי הכללים הרשמיים (nyse.com/markets/hours-calendars), דטרמיניסטי לכל שנה, בלי
   תלות ברשת: ראש השנה האזרחית, MLK (ב׳ ה־3 בינואר), הנשיאים (ב׳ ה־3 בפברואר), שישי הטוב (פסחא−2),
   הזיכרון (ב׳ האחרון במאי), ג׳ונטינת׳ (19/6), העצמאות (4/7), העבודה (ב׳ ה־1 בספטמבר), ההודיה (ה׳ ה־4 בנובמבר),
   המולד (25/12). חג שנופל בשבת נצפה ביום שישי, בראשון — ביום שני; חריג רשמי: 1/1 שנופל בשבת לא נצפה ב־31/12.
   סגירות מיוחדות (ימי אבל לאומי) לא ניתנות לחיזוי — אז מוצג "השוק סגור" בלי סיבה (מצב CLOSED מ־Yahoo). */
function easterSunday(y) { // אלגוריתם גרגוריאני אנונימי
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return { m: mo, d: da };
}
function nyseHolidays(y) {
  const out = {};
  const key = (m, d) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const dow = (m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const nthDow = (m, wd, n) => { const first = dow(m, 1); let d = 1 + ((wd - first + 7) % 7) + (n - 1) * 7; return d; };
  const lastDow = (m, wd) => { const dim = new Date(Date.UTC(y, m, 0)).getUTCDate(); const last = dow(m, dim); return dim - ((last - wd + 7) % 7); };
  const observed = (m, d, name, noFriday) => { // שבת → שישי, ראשון → שני
    const w = dow(m, d);
    if (w === 6) { if (noFriday) return; const dt = new Date(Date.UTC(y, m - 1, d - 1)); out[key(dt.getUTCMonth() + 1, dt.getUTCDate())] = name; }
    else if (w === 0) { const dt = new Date(Date.UTC(y, m - 1, d + 1)); out[key(dt.getUTCMonth() + 1, dt.getUTCDate())] = name; }
    else out[key(m, d)] = name;
  };
  observed(1, 1, 'hdNewYear', true);
  out[key(1, nthDow(1, 1, 3))] = 'hdMlk';
  out[key(2, nthDow(2, 1, 3))] = 'hdPresidents';
  const e = easterSunday(y); const gf = new Date(Date.UTC(y, e.m - 1, e.d - 2)); out[key(gf.getUTCMonth() + 1, gf.getUTCDate())] = 'hdGoodFriday';
  out[key(5, lastDow(5, 1))] = 'hdMemorial';
  observed(6, 19, 'hdJuneteenth');
  observed(7, 4, 'hdIndependence');
  out[key(9, nthDow(9, 1, 1))] = 'hdLabor';
  out[key(11, nthDow(11, 4, 4))] = 'hdThanksgiving';
  observed(12, 25, 'hdChristmas');
  return out;
}
const _nyseHolCache = {};
function etDateParts(nowMs) {
  const d = nowMs ? new Date(nowMs) : new Date();
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' }).formatToParts(d);
  const g = (t) => (parts.find((p) => p.type === t) || {}).value;
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday'));
  return { y: +g('year'), m: +g('month'), d: +g('day'), dow: wd, key: g('year') + '-' + g('month') + '-' + g('day') };
}
/* סיבת הסגירה כרגע (שעון ניו־יורק): 'hdWeekend' / מפתח חג / null (יום מסחר רגיל — סגור רק בגלל השעה) */
function marketClosedReason(nowMs) {
  try {
    const p = etDateParts(nowMs);
    if (p.dow === 0 || p.dow === 6) return 'hdWeekend';
    const hol = _nyseHolCache[p.y] || (_nyseHolCache[p.y] = nyseHolidays(p.y));
    return hol[p.key] || null;
  } catch (e) { return null; }
}
/* v206: הבורסה בתל אביב — מסחר ב'–ו' (מינואר 2026), ב'–ה' עד ~17:30, ו' עד ~14:00 (שעון ישראל). אין מסחר מאוחר/לילי.
   חגים לפי הלוח העברי — מחושב עם לוח השנה העברי המובנה בדפדפן (Intl, calendar 'hebrew'), בלי רשת:
   ערב+ראש השנה, ערב+יום כיפור, ערב+סוכות, הושענא רבה+שמחת תורה, פורים, ערב+פסח וערב+שביעי של פסח, יום העצמאות (כולל הקדמה/דחייה),
   ערב+שבועות, ט׳ באב. סגירה מיוחדת (בחירות וכו') לא ניתנת לחיזוי — אז "השוק סגור" בלי סיבה. */
function ilDateParts(nowMs) {
  const d = nowMs ? new Date(nowMs) : new Date();
  const g = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
  const pick = (a, t) => (a.find((p) => p.type === t) || {}).value;
  const h = new Intl.DateTimeFormat('en-u-ca-hebrew', { timeZone: 'Asia/Jerusalem', day: 'numeric', month: 'long' }).formatToParts(d);
  return { dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pick(g, 'weekday')), mins: (+pick(g, 'hour') % 24) * 60 + (+pick(g, 'minute')), hm: pick(h, 'month'), hd: +pick(h, 'day') };
}
function taseHolidayKey(p) {
  const m = p.hm, d = p.hd;
  if (m === 'Elul' && d === 29) return 'hdTaErevRH';
  if (m === 'Tishri') return ({ 1: 'hdTaRH', 2: 'hdTaRH', 9: 'hdTaErevYK', 10: 'hdTaYK', 14: 'hdTaErevSukkot', 15: 'hdTaSukkot', 21: 'hdTaErevSimchat', 22: 'hdTaSimchat' })[d] || null;
  if ((m === 'Adar' || m === 'Adar II') && d === 14) return 'hdTaPurim';
  if (m === 'Nisan') return ({ 14: 'hdTaErevPesach', 15: 'hdTaPesach', 20: 'hdTaErevPesach', 21: 'hdTaPesach' })[d] || null;
  if (m === 'Iyar' && d >= 3 && d <= 6) { // יום העצמאות: ה׳ באייר, מוקדם לחמישי אם ו׳/שבת, נדחה לשלישי אם שני
    const dow5 = (p.dow + (5 - d) + 7) % 7;
    const obs = dow5 === 5 ? 4 : dow5 === 6 ? 3 : dow5 === 1 ? 6 : 5;
    return d === obs ? 'hdTaIndependence' : null;
  }
  if (m === 'Sivan') return ({ 5: 'hdTaErevShavuot', 6: 'hdTaShavuot' })[d] || null;
  if (m === 'Av' && d === 9 && p.dow !== 6) return 'hdTaTishaBav';
  return null;
}
/* { closed, reason } לבורסה בת״א עכשיו. חג קודם לסופ״ש (שבת בסוכות = "סוכות") */
function taseMarketNow(nowMs) {
  try {
    const p = ilDateParts(nowMs);
    const hol = taseHolidayKey(p);
    if (hol) return { closed: true, reason: hol };
    if (p.dow === 0 || p.dow === 6) return { closed: true, reason: 'hdWeekend' };
    const end = p.dow === 5 ? 14 * 60 : 17 * 60 + 30;
    return { closed: p.mins < 9 * 60 + 59 || p.mins >= end, reason: null };
  } catch (e) { return { closed: false, reason: null }; }
}
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
    volume: parseInt(meta.regularMarketVolume, 10) || 0,
    longName: meta.longName || meta.shortName || ''
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
  // v193: מרוץ — Yahoo (תוך־יומי, עדיף) מול המקורות היומיים במקביל, לא בטור. Yahoo מקבל יתרון של 1.2 שניות;
  // אם הוא חסום/איטי — המקור היומי הראשון שעונה. לפני כן: Yahoo נכשל בטלפון → 8 שניות המתנה ואז המקורות בזה אחר זה.
  const urls = [
    'https://open.er-api.com/v6/latest/USD',
    'https://api.frankfurter.app/latest?from=USD&to=ILS'
  ];
  const daily = (u) => fetchJSONTimeout(u, 8000).then((j) => { const r = num(j && j.rates && j.rates.ILS); if (!(r > 0)) throw new Error('no fx'); return r; });
  return new Promise((resolve, reject) => {
    let done = false, backup = null, yahooDead = false, backupDead = false, timer = null;
    const finish = (v) => { if (done) return; done = true; clearTimeout(timer); resolve(v); };
    const fail = () => { if (!done && yahooDead && backupDead) reject(new Error('no fx')); };
    tryFxYahoo().then((v) => { if (v > 0) finish(v); else { yahooDead = true; if (backup) finish(backup); fail(); } },
      () => { yahooDead = true; if (backup) finish(backup); fail(); });
    Promise.any(urls.map(daily)).then((v) => { backup = v; if (yahooDead) finish(v); else timer = setTimeout(() => finish(v), 1200); },
      () => { backupDead = true; fail(); });
  });
}

/* v207: שוק המט״ח (דולר־שקל) פתוח 24/5 — מראשון 17:00 עד שישי 17:00 שעון ניו־יורק */
function fxMarketOpen(nowMs) {
  try {
    const d = nowMs ? new Date(nowMs) : new Date();
    const g = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(d);
    const pick = (t) => (g.find((p) => p.type === t) || {}).value;
    const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(pick('weekday'));
    const mins = (+pick('hour') % 24) * 60 + (+pick('minute'));
    if (dow === 6) return false;
    if (dow === 0) return mins >= 17 * 60;
    if (dow === 5) return mins < 17 * 60;
    return true;
  } catch (e) { return true; }
}
/* v207: נקודת שער הדולר — מהבהבת ירוק/אדום לפי כיוון היום כשיש מסחר, אפורה קבועה כשאין */
function paintFxDot() {
  const dot = document.getElementById('fxDot');
  if (!dot) return;
  const open = fxMarketOpen();
  const dir = state.fx > 0 && state.fxPrev > 0 ? (state.fx >= state.fxPrev ? 'pos' : 'neg') : '';
  dot.className = 'ext-dot' + (open ? (dir ? ' ' + dir : '') : ' off');
}

/* v196: ציור בועת שער הדולר בהדר — המספר מתגלגל ספרה־ספרה (אותו livePriceSwap של המניות) כשהשער זז */
function paintFxPill(changed) {
  try { paintFxDot(); } catch (e) {}
  const v = document.getElementById('fxPillValue');
  if (!v) return;
  let num = v.querySelector('.fx-num');
  if (!num) { v.innerHTML = '<span class="fx-cur">₪</span><span class="fx-num" dir="ltr" data-px="0">—</span>'; num = v.querySelector('.fx-num'); }
  if (!(state.fx > 0)) { num.textContent = '—'; num.dataset.px = '0'; return; }
  const fresh = el('span');
  fresh.dataset.px = String(state.fx);
  fresh.textContent = state.fx.toFixed(2);
  if (num.textContent === '—' || !changed) { num.dataset.px = fresh.dataset.px; num.textContent = fresh.textContent; return; }
  livePriceSwap(num, fresh);
}

/* v196: השער בזמן אמת — מגיע עם המחירים בטיק המלא של הלולאה החיה (USDILS=X באותה בקשה לשרתון) */
function applyLiveFx(r, prev) {
  if (!(r > 0)) return;
  if (prev > 0) state.fxPrev = prev;
  const moved = r !== state.fx;
  state.fx = r;
  state.fxAt = Date.now();
  paintFxPill(moved);
  if (moved && state.currency === 'ILS') { try { renderOverview(true); } catch (e) {} }
}

/* v101: טיקר חי — כל 60 שניות מרענן שער דולר בלבד (זול),
   מעדכן את הפיל; אם השער השתנה — גם מספרי ה־₪ בעמוד הראשי. */
let _fxT = null;
function startFxTicker() {
  if (_fxT) return;
  const tick = async () => {
    if (document.visibilityState !== 'visible') return;
    if (live.on && state.live && Date.now() - (state.fxAt || 0) < 30000) return; // v196: הלולאה החיה כבר מביאה שער
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
/* v165: Yahoo עצמו מזיז את המחיר כל 1–2 שניות בזמן מסחר (נמדד: 23 שינויים ב־24 דגימות בדקה).
   טיק כל 2 שניות: כרטיסים פתוחים בכל טיק, כל התיק כל 2 טיקים (4 שניות). הכל בבקשה אחת לשרתון
   (מטמון 1.5 שניות שם) — 30 בקשות בדקה מהטלפון, במקום ~100 ישירות ל־Yahoo לפני v164. */
const LIVE_FAST_MS = 2000;
const LIVE_ALL_EVERY = 2;
const LIVE_IDLE_MS = 60000;
const LIVE_IDLE_AFTER = 15; // ~1 דקה בלי תזוזה (שוק סגור) → טיק לדקה
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

/* v165: שדות מורחבים מהשרתון (v7/quote של Yahoo): marketState + טרום־מסחר / אחרי־מסחר / overnight
   יחסית לסגירה הרגילה. q.session נקבע לפי marketState של Yahoo (מדויק יותר מחלון הזמן).
   שומר: q.regClose (סגירה רגילה), q.ext = { kind: 'pre'|'post'|'night', price, ch, pct, t }. טהורה. */
const YAHOO_STATE_SESSION = { PRE: 'pre', PREPRE: 'pre', POST: 'post', POSTPOST: 'post', OVERNIGHT: 'night', CLOSED: 'closed', REGULAR: 'regular' };
function applyExtQuote(q, x) {
  if (!q || !x) return q;
  const sess = YAHOO_STATE_SESSION[String(x.state || '').toUpperCase()];
  if (sess) q.session = sess;
  if (x.reg && x.reg.p > 0) { q.regClose = x.reg.p; q.regCh = x.reg.ch; q.regPct = x.reg.pct; }
  const pick = sess === 'night' ? (x.night || x.post) : sess === 'post' ? x.post : sess === 'pre' ? x.pre : null;
  const kind = sess === 'night' ? (x.night ? 'night' : 'post') : sess;
  if (pick && pick.p > 0) q.ext = { kind: kind, price: pick.p, ch: pick.ch, pct: pick.pct, t: pick.t };
  else if (sess === 'closed' && x.post && x.post.p > 0) q.ext = { kind: 'post', price: x.post.p, ch: x.post.ch, pct: x.post.pct, t: x.post.t };
  return q;
}
/* תווית הסשן לכרטיס: "טרום־מסחר −0.4%" וכו'. null בזמן מסחר רגיל / בלי נתונים. */
function extSessionHTML(q, m) {
  const tsym = (m && m.p && m.p.sym) || (q && q.symbol) || '';
  if (/\.TA$/i.test(tsym)) return taseSessionHTML(m);
  if (!q || !q.ext || !(q.ext.price > 0)) return '';
  const pct = Number(q.ext.pct) || 0;
  const cls = Math.abs(pct) < 0.005 ? '' : pct >= 0 ? 'pos' : 'neg';
  // v199: השוק סגור (סופ״ש/חג/לילה) — "השוק סגור · סיבה" עם השינוי של המסחר המאוחר האחרון; בלי נקודה מהבהבת
  if (q.session === 'closed') {
    const why = marketClosedReason();
    const names = { hdWeekend: t('hdWeekend'), hdNewYear: t('hdNewYear'), hdMlk: t('hdMlk'), hdPresidents: t('hdPresidents'), hdGoodFriday: t('hdGoodFriday'), hdMemorial: t('hdMemorial'), hdJuneteenth: t('hdJuneteenth'), hdIndependence: t('hdIndependence'), hdLabor: t('hdLabor'), hdThanksgiving: t('hdThanksgiving'), hdChristmas: t('hdChristmas') };
    // v202: "השוק סגור ·" והסיבה ב־spans נפרדים — רק במסך צר מאוד נשברים ביניהם (במקום לעלות על תגית המקור)
    // באנגלית אין רוחב ל־"Closed ·" + סיבה ליד תגית "Manual" — שם רק הסיבה (הנקודה האפורה = סגור); בעברית "השוק סגור ·" + סיבה
    const pre = t('sessClosedPrefix'); // v203: גם באנגלית "Closed ·" + סיבה
    const lblHTML = why && names[why] ? (pre ? esc(pre) + '</span><span class="ext-lbl">' : '') + esc(names[why]) : esc(t('sessClosed'));
    // v201: שתי שורות — "השוק סגור · סיבה" ומתחת "אחרי־מסחר +0.25%" (הסשן המורחב האחרון); בועה צרה, צמודה לקצה
    const last = q.ext.kind === 'pre' ? t('sessPreTiny') : q.ext.kind === 'night' ? t('sessNightTiny') : t('sessPostTiny'); // v202: קצר (באנגלית) — שתי שורות ליד המחיר
    return '<span class="ext-sess closed ' + cls + '" title="' + esc(t('sessClosedTitle')) + '"><span class="ext-line"><span class="ext-dot off"></span><span class="ext-lbl">' + lblHTML + '</span></span><span class="ext-line"><span class="ext-lbl">' + esc(last) + '</span> <span class="ext-pct">' + fmtPct(pct, true) + '</span></span></span>';
  }
  const lbl = q.ext.kind === 'pre' ? t('sessPreShort') : q.ext.kind === 'night' ? t('sessNightShort') : t('sessPostShort');
  return '<span class="ext-sess ' + cls + '" title="' + esc(t('sessExtTitle')) + '"><span class="ext-dot"></span><span class="ext-lbl">' + esc(lbl) + '</span><span class="ext-pct">' + fmtPct(pct, true) + '</span></span>';
}

/* v206: בועת הסשן למניות ת״א — אותו עיצוב כמו בארה״ב. בזמן מסחר: כלום (כמו מסחר רגיל בארה״ב).
   סגור: "השוק סגור · סיבה" ומתחת "סגירה" + השינוי של יום המסחר האחרון (בת״א אין מסחר מאוחר/לילי). */
function taseSessionHTML(m) {
  const st = taseMarketNow();
  if (!st.closed) return '';
  const names = { hdWeekend: t('hdWeekend'), hdTaErevRH: t('hdTaErevRH'), hdTaRH: t('hdTaRH'), hdTaErevYK: t('hdTaErevYK'), hdTaYK: t('hdTaYK'),
    hdTaErevSukkot: t('hdTaErevSukkot'), hdTaSukkot: t('hdTaSukkot'), hdTaErevSimchat: t('hdTaErevSimchat'), hdTaSimchat: t('hdTaSimchat'),
    hdTaPurim: t('hdTaPurim'), hdTaErevPesach: t('hdTaErevPesach'), hdTaPesach: t('hdTaPesach'), hdTaIndependence: t('hdTaIndependence'),
    hdTaErevShavuot: t('hdTaErevShavuot'), hdTaShavuot: t('hdTaShavuot'), hdTaTishaBav: t('hdTaTishaBav') };
  const why = st.reason && names[st.reason];
  const lblHTML = why ? esc(t('sessClosedPrefix')) + '</span><span class="ext-lbl">' + esc(why) : esc(t('sessClosed'));
  const pct = m && m.dayChg !== null && m.dayChg !== undefined && isFinite(m.dayChg) ? m.dayChg : null;
  const cls = pct === null || Math.abs(pct) < 0.005 ? '' : pct >= 0 ? 'pos' : 'neg';
  const line2 = pct === null ? '' : '<span class="ext-line"><span class="ext-lbl">' + esc(t('sessLastClose')) + '</span> <span class="ext-pct">' + fmtPct(pct, true) + '</span></span>';
  return '<span class="ext-sess closed ' + cls + '" title="' + esc(t('sessClosed')) + '"><span class="ext-line"><span class="ext-dot off"></span><span class="ext-lbl">' + lblHTML + '</span></span>' + line2 + '</span>';
}

/* v164: מחירים חיים דרך השרתון — בקשה אחת לכל התיק (Yahoo מהשרת). עד v163 הטלפון שלח בקשה
   נפרדת לכל מניה כל 5–10 שניות (~90 בדקה בזמן מסחר) — Yahoo חסם את הטלפון (429) וזה הפיל גם את
   הגרפים. התשובה במבנה של Yahoo (חתוכה) — אותו parseYahooQuote. */
async function proxyQuotes(syms, ms) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const to = setTimeout(() => { if (ctl) ctl.abort(); }, ms || 9000);
  try {
    const r = await fetch(ibkrProxyBase() + '/api/quotes', {
      method: 'POST', headers: ibkrProxyHeaders(), body: JSON.stringify({ syms: syms.slice(0, 40) }),
      signal: ctl ? ctl.signal : undefined,
    });
    const j = await r.json();
    if (!j || !j.ok || !j.data) throw new Error((j && j.error) || 'proxy_quotes');
    const out = {};
    for (const sym of Object.keys(j.data)) {
      const q = parseYahooQuote(j.data[sym], sym);
      if (q) { applyExtQuote(q, j.data[sym].x); out[sym] = q; }
    }
    return out;
  } finally { clearTimeout(to); }
}
/* קודם השרתון; ישירות ל־Yahoo רק אם השרתון לא ענה וגם Yahoo לא ידוע כחוסם (ואז — מעדכן את ההפסקה) */
async function liveFetch(syms) {
  let out = {};
  try { out = await proxyQuotes(syms); } catch (e) { out = {}; }
  const rest = syms.filter((s) => !out[s] && s !== FX_SYM); // v196: שער חסר — לא ישירות מ־Yahoo (CORS בטלפון היה נספר ככשל)
  if (!rest.length || yahooCooling()) return out;
  const res = await pool(rest, 3, async (sym) => {
    try { return parseYahooQuote(await fetchJSONTimeout(yahooQuoteURL(sym), 8000), sym); } catch (e) { return null; }
  });
  let direct = 0;
  for (const r of res) if (r) { out[r.symbol] = r; direct++; }
  if (direct) yahooOk(); else yahooFailed();
  return out;
}

/* ממזג ציטוטים חדשים — מחזיר את הסימבולים שהמחיר שלהם זז. פונקציה טהורה על state. */
/* v159: רשת ביטחון — ציטוט ת"א שגדול פי 30–300 מהסגירה האחרונה הידועה הגיע באגורות
   (מקור שלא סימן ILA). מחלקים ב־100. טהורה על האובייקט; מחזירה כמה תוקנו. */
function taseFixQuotes(quotes, refOf) {
  let n = 0;
  for (const s of Object.keys(quotes || {})) {
    const q = quotes[s];
    if (!q || symCur(s) !== 'ILS' || !(q.close > 0)) continue;
    const ref = refOf(s);
    if (!(ref > 0)) continue;
    const r = q.close / ref;
    if (r >= 30 && r <= 300) {
      for (const k of ['close', 'open', 'high', 'low', 'prev', 'prevClose', 'pre', 'post']) if (q[k] > 0) q[k] = q[k] / 100;
      n++;
    }
  }
  return n;
}
function taseRef(s) {
  const h = state.hist[s];
  if (h && h.length) return h[h.length - 1].close;
  const p = POSITIONS.find((x) => x.sym === s);
  if (p && p.avg > 0) return p.avg;
  const o = state.quotes[s];
  return o && o.close > 0 ? o.close : null;
}
function liveMerge(got) {
  taseFixQuotes(got, taseRef);
  const moved = [];
  for (const s of Object.keys(got)) {
    const old = state.quotes[s];
    if (!old || old.close !== got[s].close) moved.push(s);
    state.quotes[s] = got[s];
  }
  return moved;
}

/* v160: הגנה על Yahoo — כשכל הבקשות בטיק נכשלות (בדרך כלל 429 "יותר מדי בקשות", שבדפדפן נראה
   כחסימת CORS), מפסיקים לשאול את Yahoo לזמן הולך וגדל (דקה → 10 דקות) במקום להפציץ כל 5 שניות
   ולהאריך את החסימה. בזמן ההפסקה — CNBC. כש־Yahoo חוזר: משלימים היסטוריות חסרות וגרפים פתוחים. */
const yahooGate = { until: 0, backoff: 0 };
function yahooCooling(now) { return (now || Date.now()) < yahooGate.until; }
function yahooFailed(now) {
  yahooGate.backoff = Math.min(yahooGate.backoff ? yahooGate.backoff * 2 : 60000, 600000);
  yahooGate.until = (now || Date.now()) + yahooGate.backoff;
}
function yahooOk() { const was = yahooGate.backoff > 0; yahooGate.backoff = 0; yahooGate.until = 0; return was; }
async function yahooRecovered() {
  const syms = quoteSymbols().filter((sym) => isChartableSym(sym) && !(state.hist[sym] || []).length);
  for (const sym of syms) delete histNegCache[sym];
  await histBatchWarm(syms); // v193
  // בלי force — טעינה שכבר רצה לאותה מניה משותפת (histInflight), לא כפולה
  await pool(syms, 3, (sym) => getDailyFast(sym, false).catch(() => null));
  const open = Object.keys(state.open).filter((x) => state.open[x]);
  for (const sym of open) { try { ensureChartData(sym, true); } catch (e) {} }
  try { renderLive(syms.concat(open)); } catch (e) {}
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
        let src = 'Yahoo';
        const wasCooling = yahooCooling();
        let got = await liveFetch(full ? syms.concat([FX_SYM]) : syms); // v196: שער הדולר באותו טיק
        if (got[FX_SYM]) { const fxq = got[FX_SYM]; delete got[FX_SYM]; if (fxq.close > 0) applyLiveFx(fxq.close, fxq.prev); }
        // מחירים חזרו (ישירות או דרך השרתון) ויש מניות בלי היסטוריה — משלימים גרפים (לכל היותר פעם בשתי דקות)
        const lacking = quoteSymbols().some((x) => isChartableSym(x) && !(state.hist[x] || []).length);
        if (Object.keys(got).length && ((wasCooling && !yahooCooling()) || lacking) && Date.now() - (live.lastRecover || 0) > 120000) {
          live.lastRecover = Date.now();
          yahooRecovered().catch(() => {});
        }
        // Yahoo חסום/נכשל: CNBC בבקשה אחת לכל הסימבולים (ציטוט מושהה — התווית אומרת "דיליי")
        if (!Object.keys(got).length && full) {
          try { got = parseCNBCQuotes(await fetchJSONTimeout(cnbcURL(), 8000), etSessionNow()) || {}; src = 'CNBC'; } catch (e) { got = {}; }
        }
        if (Object.keys(got).length) {
          const moved = liveMerge(got);
          state.quotesAt = Date.now();
          if (state.stale) setBanner(null); // v160: מחירים חזרו — מסירים את "לא התקבלו מחירים"
          state.stale = false;
          if (full) {
            live.still = moved.length ? 0 : live.still + 1;
            const sess = (Object.values(got).find((r) => r.session) || {}).session || '';
            state.session = (sess === 'regular' || sess === 'closed') ? '' : sess;
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
  live.lastRecover = Date.now(); // v164: השלמת גרפים — לא בטעינה הראשונית (היא כבר טוענת)
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
/* v165: החלפת מחיר בסגנון Robinhood — הספרות שהשתנו "מתגלגלות" למעלה (עלייה) או למטה (ירידה),
   והמחיר מהבהב לרגע בירוק/אדום. הספרות שלא השתנו נשארות במקום, כך שהעין רואה בדיוק מה זז.
   מכבד "הפחת תנועה" (רק צבע). טהורה על שני אלמנטים — לא נוגעת ב־state. */
function livePriceSwap(a, b) {
  const oldPx = parseFloat(a.dataset.px), newPx = parseFloat(b.dataset.px);
  const oldTxt = a.textContent, newTxt = b.textContent;
  if (oldTxt === newTxt) return;
  a.dataset.px = b.dataset.px;
  // מחיר באגורות ("7,830 אג׳") עטוף בבידוד RTL — פירוק לספרות מערבב אותו באמצע הגלגול; שם רק הבזק
  if (!(oldPx > 0 && newPx > 0) || oldTxt.length !== newTxt.length || /[\u2067\u0590-\u05FF]/.test(newTxt) || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)) {
    a.textContent = newTxt;
    if (oldPx > 0 && newPx > 0) livePriceFlash(a, newPx > oldPx ? 'up' : 'down');
    return;
  }
  const dir = newPx > oldPx ? 'up' : 'down';
  let html = '';
  for (let i = 0; i < newTxt.length; i++) {
    const o = oldTxt[i], nch = newTxt[i];
    if (o === nch || !/\d/.test(nch)) html += esc(nch);
    else html += '<span class="px-roll ' + dir + '"><span class="px-old">' + esc(o) + '</span><span class="px-new">' + esc(nch) + '</span></span>';
  }
  a.innerHTML = html;
  livePriceFlash(a, dir);
  setTimeout(() => { if (a.dataset.px === String(newPx)) a.textContent = newTxt; }, 420);
}
function livePriceFlash(el, dir) {
  el.classList.remove('px-up', 'px-down');
  void el.offsetWidth; // מאפס את האנימציה גם כשאותו כיוון פעמיים ברצף
  el.classList.add(dir === 'up' ? 'px-up' : 'px-down');
}

function renderLive(syms) {
  try { renderOverview(true); } catch (e) {}
  for (const s of syms) {
    const p = POSITIONS.find((x) => x.sym === s);
    const card = p && document.querySelector('#stockList .stock[data-sym="' + s + '"]');
    if (!card) continue;
    const m = metrics(s);
    const fresh = el('div'); // v193: רק הכותרת — לא כרטיס שלם עם גוף וקנבס בכל טיק
    fresh.innerHTML = stockHeadHTML(p, m);
    const pa = card.querySelector('.stock-head .stock-price'), pb = fresh.querySelector('.stock-price');
    if (pa && pb) livePriceSwap(pa, pb);
    for (const cls of ['.stock-sub', '.stock-ext']) {
      const sa = card.querySelector('.stock-head ' + cls), sb = fresh.querySelector(cls);
      if (sa && sb && sa.innerHTML !== sb.innerHTML) sa.innerHTML = sb.innerHTML;
    }
    if (state.open[s]) {
      const g = card.querySelector('.stock-body .kv-grid');
      if (g) { g.innerHTML = kvGridHTML(p, m); ensureChartData(s, true); }
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
  taseFixQuotes(res.quotes, taseRef);
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
    const sess = state.session === 'pre' ? t('sessionPre') : state.session === 'post' ? t('sessionPost') : state.session === 'night' ? t('sessionNight') : '';
    const lag = state.live && state.source === 'Yahoo' ? t('lagLive') : t('lagDelayed');
    el.textContent = t('sourceLabel', { src: state.source || '—', lag: lag, sess: sess, stale: state.stale ? t('staleSuffix') : '' });
  }
}

const FX_SYM = 'USDILS=X';
async function tryYahooQuotes() {
  // v193: שער הדולר באותה בקשה לשרתון (USDILS=X) — חוסך סבב רשת שלם בטעינה; tryFx רק אם חסר
  const q = await liveFetch(quoteSymbols().concat([FX_SYM])); // v164: שרתון בבקשה אחת, ישירות רק כגיבוי
  const fxq = q[FX_SYM]; delete q[FX_SYM];
  const results = Object.values(q);
  const missing = POSITIONS.filter((p) => !q[p.sym]).length;
  if (missing > Math.max(1, Math.floor(POSITIONS.length / 2))) throw new Error('too few quotes');
  if (fxq && fxq.prev > 0) state.fxPrev = fxq.prev; // v207: לכיוון היומי של נקודת שער הדולר
  const fx = fxq && fxq.close > 0 ? fxq.close : await tryFx();
  const sess = (results.find((r) => r && r.session) || {}).session || '';
  return { quotes: q, fx: fx, source: 'Yahoo', session: (sess === 'regular' || sess === 'closed') ? '' : sess };
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
    try { taseFixQuotes(cached.quotes, (x) => { const h = state.hist[x]; if (h && h.length) return h[h.length - 1].close; const p = POSITIONS.find((y) => y.sym === x); return p && p.avg > 0 ? p.avg : null; }); } catch (e) {}
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

/* v168: רשומת מטמון היסטוריה. שורות רזות (תאריך + סגירה — בדמו) נשמרות דחוסות: יום ראשון + הפרשי ימים
   + סגירות — פי ~4 פחות מקום בטלפון (הדמו עם ~55 מניות הגיע ל־3MB). שורות מלאות — כמו קודם. טהורות. */
function histCacheRec(rows) {
  const rec = { at: Date.now(), rows: rows, splits: rows.splitsApplied || null };
  if (!rows.length || !rows.every((r) => r && Object.keys(r).length === 2 && typeof r.date === 'string' && r.close > 0)) return rec;
  const day = (iso) => Math.round(Date.parse(iso + 'T00:00:00Z') / 86400000);
  const d = [];
  let prev = 0;
  for (const r of rows) { const k = day(r.date); d.push(k - prev); prev = k; }
  delete rec.rows;
  rec.z = { d: d, c: rows.map((r) => r.close) };
  return rec;
}
function histCacheUnpack(rec) {
  if (!rec || rec.rows || !rec.z || !Array.isArray(rec.z.d) || !Array.isArray(rec.z.c)) return rec;
  const rows = [];
  let k = 0;
  for (let i = 0; i < rec.z.d.length; i++) {
    k += rec.z.d[i];
    rows.push({ date: new Date(k * 86400000).toISOString().slice(0, 10), close: rec.z.c[i] });
  }
  return { at: rec.at, rows: rows, splits: rec.splits || null };
}

/* טוען רשומת מטמון v2, ואם חסרה — מנסה נדידת חירום מ־v1 (v71).
   מחזיר רשומת מטמון או null. */
function loadHistCacheRec(sym) {
  let cached = null;
  try { cached = histCacheUnpack(lsGet(LS_HIST + sym)); } catch (e) {}
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
    if (isDemoMode()) rows = histSlimForDemo(rows);
    state.hist[sym] = rows;
    state.histDbg[sym] = null;
    delete histNegCache[sym]; // v72: הצלחה מבטלת מטמון שלילי
    // v70: שומרים מטא־ספליטים בנפרד — תכונה מותאמת על מערך לא שורדת JSON
    lsSet(LS_HIST + sym, histCacheRec(rows));
    return rows;
  };
  const notes = [];
  const td = await fetchTwelveBars(sym, 'daily', wantMax, notes);
  if (td === 'BADKEY') clearTdKey(notes);
  else if (td) return save(td);
  // v163: היסטוריה דרך השרתון (Yahoo מהשרת) — ראשון כש־Yahoo כבר ידוע כחוסם את הטלפון, אחרון אחרת
  const viaProxy = async () => {
    if (histProxyOff) return null;
    try {
      const got = await proxyHistory([sym], wantMax ? '10y' : isDemoMode() ? '7y' : '5y', 15000);
      const r = got[sym];
      if (r && r.length) { notes.push('Proxy: ok'); return r; }
      notes.push('Proxy: —');
    } catch (e) { notes.push('Proxy: ' + netErrName(e)); }
    return null;
  };
  if (yahooCooling()) { const pr = await viaProxy(); if (pr) return save(pr); }
  const dq = (host) => yahooURL(sym, 'interval=1d&range=' + (wantMax ? 'max' : isDemoMode() ? '10y' : '5y'), host);
  let rows = await fetchYahooBars(dq('query1'), false, notes, 'Yahoo')
          || await fetchYahooBars(dq('query2'), false, notes, 'Yahoo2');
  if (rows) return save(rows);
  try {
    rows = parseHistoryCSV(await fetchTextTimeout(stooqDailyURL(sym), 12000));
    if (rows.length) return save(rows);
    notes.push(t('srcEmpty', { name: 'Stooq' }));
  } catch (e) { notes.push('Stooq: ' + netErrName(e)); }
  if (!yahooCooling()) { const pr = await viaProxy(); if (pr) return save(pr); }
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
  const soldTo = {};
  for (const x of mtActiveTrades()) {
    const n = mtNorm(x);
    syms.add(n.sym); // v141: גם מניות ידניות שנמכרו (לתשואה)
    if (!soldTo[n.sym] || n.date > soldTo[n.sym]) soldTo[n.sym] = n.date;
  }
  // v168: מניה שנמכרה כולה — ההיסטוריה שלה לא משתנה; מטמון שמכסה עד העסקה האחרונה מספיק (בלי משיכה יומית מחדש)
  for (const sym of [...syms]) {
    if (POSITIONS.some((p) => p.sym === sym) || state.hist[sym]) continue;
    const rec = loadHistCacheRec(sym);
    const rows = rec && rec.rows;
    if (rows && rows.length && rows[rows.length - 1].date >= soldTo[sym]) { restoreHistRows(sym, rec); syms.delete(sym); }
  }
  await histBatchWarm([...syms]); // v193: כל מה שחסר — בבקשה אחת לשרתון
  await pool([...syms], 3, (sym) => getDaily(sym, false));
  renderStocks();
  renderOverview();
}

/* v193: חימום היסטוריות בבקשה אחת: מה שאין בזיכרון ולא במטמון טרי (24 שעות) נשלח לשרתון ב־POST אחד (עד 40 סימבולים)
   ונשמר כמו fetch רגיל. מה שהשרתון לא החזיר — נופל אחר כך למסלול הרגיל (Yahoo/Stooq ישירות). לפני כן: בקשה לכל מניה,
   מהטלפון ישירות ל־Yahoo (שחוסם), עם timeouts של 8 שניות. */
async function histBatchWarm(syms) {
  if (histProxyOff) return;
  const need = [];
  for (const raw of syms) {
    const sym = normalizeSym(raw);
    if (!sym || !isChartableSym(sym) || state.hist[sym] || need.includes(sym)) continue;
    if (histInflight[sym]) continue;
    let fresh = false;
    try {
      const rec = loadHistCacheRec(sym);
      const age = rec ? Date.now() - (Number(rec.at) || 0) : Infinity;
      fresh = !!(rec && rec.rows && rec.rows.length && age >= 0 && age < 24 * 60 * 60 * 1000);
    } catch (e) {}
    if (!fresh) need.push(sym);
  }
  if (!need.length) return;
  await Promise.all(need.slice(0, 40).map((sym) => proxyHistQueued(sym).then((rows) => { if (rows && rows.length) storeHistRows(sym, rows); }).catch(() => null)));
}

/* הפרדה בין סוגי משתמשים: השוואת מדדים רק כשההיסטוריה אמיתית מ־IBKR.
   בהזנה ידנית (סימולציית אחזקות נוכחיות) אין השוואה — רק קו התיק. */
function pfShowBench(srcKind) {
  return srcKind === 'ibkr' || srcKind === 'trades' || srcKind === 'holdings';
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
/* v163: היסטוריית מחירים דרך השרתון שלנו (Vercel) — בקשה אחת לכל הסימבולים. בטלפון Yahoo חוסם
   לפעמים (429 לכתובת של הספק הסלולרי) ו־Stooq לא עונה, ולמניות ת"א אין מקור אחר; מהשרת זה עובד.
   מחזיר { SYM: [{date, close}] } (ת"א כבר בשקלים). */
async function proxyHistory(syms, range, ms) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const to = setTimeout(() => { if (ctl) ctl.abort(); }, ms || 20000);
  try {
    const r = await fetch(ibkrProxyBase() + '/api/history', {
      method: 'POST', headers: ibkrProxyHeaders(), body: JSON.stringify({ syms: syms, range: range || '5y' }),
      signal: ctl ? ctl.signal : undefined,
    });
    const j = await r.json();
    if (!j || !j.ok || !j.data) throw new Error((j && j.error) || 'proxy_history');
    return proxyHistoryRows(j.data);
  } finally { clearTimeout(to); }
}
/* טהורה: { SYM: {t:[ימים מאז 1970], c:[סגירות]} } → { SYM: [{date, close}] } */
function proxyHistoryRows(data) {
  const out = {};
  for (const sym of Object.keys(data || {})) {
    const v = data[sym];
    if (!v || !Array.isArray(v.t) || !Array.isArray(v.c)) continue;
    const rows = [];
    for (let i = 0; i < v.t.length; i++) {
      if (v.c[i] > 0) rows.push({ date: new Date(v.t[i] * 86400000).toISOString().slice(0, 10), close: v.c[i] });
    }
    if (rows.length) out[sym] = rows;
  }
  return out;
}
/* שומר היסטוריה שהגיעה מבחוץ כמו fetch רגיל: ספליטים, דמו רזה, זיכרון ומטמון */
function storeHistRows(sym, rows) {
  try { repairKnownSplits(sym, rows); } catch (e) {}
  if (isDemoMode() || _demoBusy) rows = histSlimForDemo(rows);
  state.hist[sym] = rows;
  state.histDbg[sym] = null;
  delete histNegCache[sym];
  lsSet(LS_HIST + sym, histCacheRec(rows));
  return rows;
}
/* גיבוי בגרפים הרגילים: כמה מניות שנכשלו באותו רגע נאספות לבקשה אחת (250ms) */
const proxyHistQ = { syms: {}, timer: null };
let histProxyOff = false; // בזמן בניית הדמו — השרת כבר נוסה, לא לשאול שוב על כל מניה
function proxyHistQueued(sym) {
  if (histProxyOff) return Promise.resolve(null);
  return new Promise((resolve) => {
    (proxyHistQ.syms[sym] = proxyHistQ.syms[sym] || []).push(resolve);
    if (proxyHistQ.timer) return;
    proxyHistQ.timer = setTimeout(async () => {
      const batch = proxyHistQ.syms;
      proxyHistQ.syms = {}; proxyHistQ.timer = null;
      const list = Object.keys(batch).slice(0, 40);
      let got = {};
      try { got = await proxyHistory(list, (isDemoMode() || _demoBusy) ? '7y' : '5y', 12000); } catch (e) { got = {}; }
      for (const k of Object.keys(batch)) for (const fn of batch[k]) fn(got[k] || null);
    }, 60); // v193: חלון איסוף קצר — הקוראים כבר מגיעים יחד
  });
}

/* v161: תיק הדמו — 7 השנים האחרונות, תאריך + סגירה בלבד (מעוגל). 30+ מניות × 10 שנים במבנה המלא
   (פתיחה/גבוה/נמוך/מחזור) מילאו ~5.6MB — על גבול הזיכרון של הדפדפן בטלפון. */
function histSlimForDemo(rows) {
  if (!rows || !rows.length) return rows;
  const cut = addDaysISO(todayISO(), -7 * 366);
  const out = rows.filter((r) => r.date >= cut).map((r) => ({ date: r.date, close: Math.round(r.close * 1e4) / 1e4 }));
  if (rows.splitsApplied) out.splitsApplied = rows.splitsApplied;
  return out;
}

async function _getDailyFastInner(sym, force) {
  // v161: תיק הדמו מציג 6 שנים — בדמו (ובזמן בנייתו) 10 שנים מ־Yahoo, נחתך ל־7 כדי לא למלא את הטלפון
  const demoLong = isDemoMode() || _demoBusy;
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
    if (demoLong) rows = histSlimForDemo(rows);
    state.hist[sym] = rows;
    state.histDbg[sym] = null;
    delete histNegCache[sym]; // v72: הצלחה מבטלת מטמון שלילי
    // v70: שומרים מטא־ספליטים בנפרד — תכונה מותאמת על מערך לא שורדת JSON
    lsSet(LS_HIST + sym, histCacheRec(rows));
    // v69: היסטוריה חדשה = TWR חדש — מנקים מטמון
    try { if (typeof ibkrThCacheClear === 'function') ibkrThCacheClear(); } catch (e) {}
    return rows;
  };
  const notes = [];
  // v163: Yahoo כבר ידוע כחוסם את הטלפון — ישר לשרתון, בלי לחכות ל־timeouts של המרוץ
  // v193: השרתון ראשון תמיד (בקשות מקבילות מאוחדות לאחת) — מהטלפון Yahoo ישירות נחסם ומחכה ל־timeout; ישירות רק כגיבוי
  let proxyTried = false;
  if (!histProxyOff) {
    proxyTried = true;
    const px = await proxyHistQueued(sym);
    if (px && px.length) return save(px);
  }
  const dq = (host) => yahooURL(sym, 'interval=1d&range=' + (demoLong ? '10y' : '5y'), host);
  // מרוץ מקבילי: הראשון שעונה מנצח — לא מחכים ל־timeout של מקור חסום (v19 לימד אותנו)
  const racers = [
    fetchYahooBars(dq('query1'), false, notes, 'Yahoo', 8000),
    fetchYahooBars(dq('query2'), false, notes, 'Yahoo2', 8000),
    (async () => {
      if (symCur(sym) !== 'USD') return null; // v160: Stooq כאן = ארה"ב בלבד (היה מבקש poli.ta.us)
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
  // v163: Yahoo ו־Stooq לא ענו מהטלפון — דרך השרתון (Yahoo מהשרת)
  if (!proxyTried) try {
    const px = await proxyHistQueued(sym);
    if (px && px.length) { notes.push('Proxy: ok'); return save(px); }
    notes.push('Proxy: —');
  } catch (e) { notes.push('Proxy: ' + netErrName(e)); }
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
  await histBatchWarm(syms); // v193: בקשה אחת לכל מה שחסר, ואז המסלול הרגיל למה שנשאר
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
    const pc = prevCloseFor(q.mdate || q.date, hist);
    if (pc) dayChg = (q.close - pc) / pc * 100;
  }
  // v160: בלי היסטוריה (מקור ההיסטוריה חסום) — השינוי היומי מהסגירה הקודמת שבציטוט עצמו
  if (dayChg === null && q && q.prev > 0 && q.close > 0) dayChg = (q.close - q.prev) / q.prev * 100;
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

/* אבטחה (CSP, v149): בלי handlers בתוך HTML (onload=/onerror=) — מדיניות האבטחה חוסמת
   אותם. מאזין אחד בשלב ה־capture (אירועי load/error של תמונות לא "מבעבעים"). */
(function wireImgEvents() {
  if (typeof document === 'undefined' || !document.addEventListener) return;
  const on = (type, fn) => document.addEventListener(type, (e) => {
    const im = e.target;
    if (im && im.tagName === 'IMG') { try { fn(im); } catch (err) {} }
  }, true);
  on('load', (im) => { if (im.dataset && im.dataset.logo) logoImgFix(im); });
  on('error', (im) => {
    if (!im.dataset) return;
    if (im.dataset.logo) logoImgErr(im);
    else if (im.dataset.err === 'hide-parent' && im.parentElement) im.parentElement.style.display = 'none';
    else if (im.dataset.err === 'hide-self') im.style.display = 'none'; // v169: נשארת האות מתחת
  });
})();

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

/* v193: מציירים רק את הטאב שרואים. כל מצייר־טאב שואל tabShouldRender(שם): טאב מוסתר לא מצויר אלא מסומן "מלוכלך",
   ומצויר ברגע שעוברים אליו (switchTab). ככה טיק חי / שינוי מטבע / הגעת מחירים לא בונים 6 טאבים מחדש בכל פעם.
   בלי DOM (בדיקות) — תמיד מציירים. */
const tabDirty = {};
let _renderForce = false;
function tabShouldRender(name) {
  if (_renderForce) { tabDirty[name] = false; return true; }
  let cur = null;
  try { const a = document.querySelector('.tabpage.active'); cur = a && a.id ? String(a.id).replace(/^tab-/, '') : null; } catch (e) { cur = null; }
  if (!cur || cur === name) { tabDirty[name] = false; return true; }
  tabDirty[name] = true;
  return false;
}
const TAB_ORDER = ['overview', 'stocks', 'trades', 'wishlist', 'deposits', 'pension', 'settings'];
function tabRenderer(name) {
  return { overview: renderOverview, stocks: renderStocks, trades: renderTrades, wishlist: renderWishlist, deposits: renderDeposits, pension: renderPension }[name] || null;
}
/* v193: גלולה ירוקה שמחליקה בין הלשוניות (במקום רקע שקופץ) — כמו בורר מקטעים של אפל. ממוקמת פיזית (offsetLeft),
   עובד ב־RTL וב־LTR ובתוך סרגל שגולל. הפעם הראשונה — בלי אנימציה. */
function positionTabIndicator() {
  const tabs = document.querySelector('.tabs');
  if (!tabs || !tabs.querySelector) return;
  let ind = tabs.querySelector('.tab-ind');
  if (!ind) {
    ind = document.createElement('span');
    ind.className = 'tab-ind';
    ind.setAttribute('aria-hidden', 'true');
    tabs.insertBefore(ind, tabs.firstChild);
  }
  const act = tabs.querySelector('.tab.active');
  if (!act || !act.offsetWidth) return;
  ind.style.width = act.offsetWidth + 'px';
  ind.style.transform = 'translateX(' + act.offsetLeft + 'px)';
  if (!tabs.classList.contains('has-ind')) {
    ind.style.transition = 'none';
    tabs.classList.add('has-ind');
    void ind.offsetWidth; // מיקום ראשון בלי החלקה
    ind.style.transition = '';
  }
}
/* v193: כיוון הכניסה של העמוד (ציר משותף, כמו Material/iOS) — לשונית "קדימה" = העמוד נכנס מהצד שאליו הולכים
   (ב־RTL הפוך). נכתב כמשתנה CSS על העמוד; האנימציה עצמה ב־styles.css (tabIn). */
function setTabPageDirection(prev, name) {
  const page = document.getElementById('tab-' + name);
  if (!page || !page.style || !page.style.setProperty || prev === name) return;
  const fwd = TAB_ORDER.indexOf(name) > TAB_ORDER.indexOf(prev);
  const rtl = String((document.documentElement && document.documentElement.dir) || 'ltr') === 'rtl';
  page.style.setProperty('--tab-dx', ((fwd !== rtl) ? 22 : -22) + 'px');
}
function switchTab(name) {
  const prev = currentTabName();
  let actTab = null;
  document.querySelectorAll('.tab').forEach((t) => {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    if (on) actTab = t;
  });
  // v193: הגלולה נמדדת לפני שהעמוד החדש מוצג — ה־layout הכפוי (offsetLeft) מכסה רק את שורת הלשוניות
  try { positionTabIndicator(); } catch (e) {}
  if (actTab && actTab.scrollIntoView) {
    try { actTab.scrollIntoView({ inline: 'nearest', block: 'nearest' }); } catch (e) {}
  }
  setTabPageDirection(prev, name);
  document.querySelectorAll('.tabpage').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + name));
  if (tabDirty[name]) { const fn = tabRenderer(name); if (fn) { try { fn(); } catch (e) {} } } // v193: הטאב השתנה בזמן שהיה מוסתר
  // v85: שמירת הטאב האחרון — חזרה לאותו עמוד אחרי רענון
  try { localStorage.setItem('pwa_lasttab_v1', name); } catch (e) {}
  requestAnimationFrame(() => { try { fitNumbers(); } catch (e) {} }); // התאמת מספרים אחרי המעבר (fitNumbers)
  // v85/v153: שחזור מיקום גלילה שמור לטאב הזה — גם כשהתוכן עוד נטען (restoreScrollTo)
  restoreScrollTo(name, getSavedScrollY(name));
}

/* v153: שחזור גלילה עמיד. לפני כן: scrollTo אחד מיד אחרי המעבר, כשהדף עוד קצר (מחירים,
   גרפים ורשימות נטענים אחר כך) — הדפדפן "חתך" את הקפיצה, ואירוע הגלילה שמר את המיקום
   החתוך במקום האמיתי. עכשיו: מנסים שוב כל 120ms עד שהדף ארוך מספיק (עד 8 שניות),
   לא שומרים מיקום בזמן השחזור, ועוצרים מיד אם המשתמש נוגע/גולל בעצמו. */
let _scrollRestore = null;
const RESTORE_STOP_EVENTS = ['touchstart', 'wheel', 'keydown', 'mousedown'];
function cancelScrollRestore() {
  const r = _scrollRestore;
  if (!r) return;
  _scrollRestore = null;
  clearTimeout(r.timer);
  for (const ev of RESTORE_STOP_EVENTS) { try { window.removeEventListener(ev, r.stop); } catch (e) {} }
}
function restoreScrollTo(tab, y) {
  cancelScrollRestore();
  if (!(y > 0) || typeof window === 'undefined' || !window.scrollTo) return;
  const t0 = Date.now();
  const r = { tab: tab, y: y, timer: 0, stop: () => cancelScrollRestore() };
  _scrollRestore = r;
  for (const ev of RESTORE_STOP_EVENTS) { try { window.addEventListener(ev, r.stop, { passive: true }); } catch (e) {} }
  const step = () => {
    if (_scrollRestore !== r) return;
    if (currentTabName() !== tab) return cancelScrollRestore();
    const de = document.documentElement;
    const maxY = Math.max(0, (de.scrollHeight || 0) - (window.innerHeight || 0));
    try { window.scrollTo(0, Math.min(y, maxY)); } catch (e) {}
    if (maxY >= y - 2 || Date.now() - t0 > 8000) return cancelScrollRestore(); // הגענו / נגמר הזמן
    r.timer = setTimeout(step, 120);
  };
  r.timer = setTimeout(step, 0);
}
function scrollRestoring() { return !!_scrollRestore; }

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
      if (scrollRestoring()) return; // v153: לא דורסים את המיקום השמור בזמן שחזור
      try { saveScrollY(currentTabName(), window.scrollY); } catch (e) {}
    }, 300);
  }, { passive: true });
  // שמירה גם לפני עזיבת הדף — למקרה שהדפדפן נסגר מהר
  window.addEventListener('beforeunload', () => {
    if (scrollRestoring()) return;
    try { saveScrollY(currentTabName(), window.scrollY); } catch (e) {}
  });
  // v153: טלפון שמעביר את האפליקציה לרקע לא תמיד שולח beforeunload
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !scrollRestoring()) { try { saveScrollY(currentTabName(), window.scrollY); } catch (e) {} }
  });
}

/* ---------------- רינדור: סקירה ---------------- */

/* התאמת גודל מספרים גדולים לרוחב הכרטיס — נשארים גדולים ככל האפשר,
   אבל מתכווצים אוטומטית לפי אורך המספר כדי שאף ספרה לא תיחתך. */
function fitNumbers() {
  // v193: רק בטאב הנראה, וקריאות/כתיבות בקבוצות — לפני כן כל מספר עשה עד 40 סבבי מדידה→שינוי (layout thrash)
  const SEL = '.stat-value, .lg-pct, .pension-total';
  const els = document.querySelectorAll(SEL.split(', ').map((x) => '.tabpage.active ' + x).join(', '));
  if (!els.length) return;
  // זיכרון לכל אלמנט: אותו טקסט באותו רוחב מסך = אותה תוצאה — טיק חי שלא שינה מספר לא נוגע ב־layout בכלל
  const vw = (typeof window !== 'undefined' && window.innerWidth) || 0;
  const todo = [];
  for (const elm of els) {
    const key = elm.textContent + '|' + vw;
    if (elm._fitKey === key) continue;
    elm._fitKey = key;
    todo.push(elm);
  }
  if (!todo.length) return;
  for (const elm of todo) if (elm.style.fontSize) elm.style.fontSize = '';
  const items = [];
  for (const elm of todo) {
    const w = elm.clientWidth;
    if (!w) { elm._fitKey = ''; continue; } // מוסתר — נמדוד כשיוצג
    const sw = elm.scrollWidth;
    if (sw <= w + 1) continue;
    const size = parseFloat(getComputedStyle(elm).fontSize) || 25;
    items.push({ elm: elm, w: w, size: Math.max(13, Math.floor(size * (w / sw) * 0.98)) });
  }
  if (!items.length) return;
  for (const it of items) it.elm.style.fontSize = it.size + 'px';
  for (let pass = 0; pass < 3; pass++) { // בדרך כלל מדויק מהניסיון הראשון; עוד צעד־שניים ליישור
    let again = false;
    for (const it of items) if (it.size > 13 && it.elm.scrollWidth > it.w + 1) { it.size -= 1; it.elm.style.fontSize = it.size + 'px'; again = true; }
    if (!again) break;
  }
}

let ovTwrKind = 'official';
function renderOverview(light) {
  if (!tabShouldRender('overview')) return; // v193
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
    if (vTxt === '—' && quotesPending() && POSITIONS.length) vEl.innerHTML = SKEL_HTML; else vEl.textContent = vTxt; // v193: שלד עד המחיר הראשון
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
  // v158: מצב ידני בלי הפקדות — רווח ממומש + לא־ממומש מהאחזקות (כמו IBKR: לא תלוי בהזנת הפקדות)
  if (!isIbkrMode() && gl === null && POSITIONS.length) {
    const mp = manualPerfUSD(POSITIONS, mtActiveTrades(), state.quotes, state.fx, null, null, todayISO());
    if (!mp.missing) gl = usdToCur(mp.gain);
    if (gSub) gSub.textContent = t('ovGLHoldings');
  } else if (!isIbkrMode() && gSub) gSub.textContent = t('ovVsNetDeposits');
  state._ovSimpleYld = yld;
  if (gl === null) { if (quotesPending() && POSITIONS.length) gEl.innerHTML = SKEL_HTML; else gEl.textContent = '—'; }
  else { gEl.textContent = fmtSignedMoney(gl, cur); }
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
    paintManualHead();
  }

  let twrTxt = '';
  if (isIbkrMode()) {
    twrTxt = ' · ' + (!ibkrYieldOfficial ? t('twrMissingShort')
      : ovTwrKind === 'combined' ? t('twrCombined') : t('twrOfficial'));
    if (ovTwrKind === 'needsDaily') twrTxt += ' · ' + t('twrNeedsDaily');
    if (mt && mt.avgOnly) twrTxt += ' · ' + t('twrAvgNote', { n: mt.avgOnly });
  }
  if (isIbkrMode()) document.getElementById('ovMeta').textContent =
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

/* v158: כותרת התשואה במצב ידני — TWR מהעסקאות (כמו TWR של IBKR), אחרת התשואה הפשוטה
   (שווי מול הפקדות/עלות). נקרא שוב כשההיסטוריה נטענת (drawPfChart). */
function paintManualHead() {
  const yEl = document.getElementById('ovYield');
  const meta = document.getElementById('ovMeta');
  if (!yEl || isIbkrMode()) return;
  const mp = manualPerfNow();
  let y = state._ovSimpleYld === undefined ? null : state._ovSimpleYld;
  let note = '';
  if (mp.twr !== null && isFinite(mp.twr)) {
    y = mp.twr;
    note = ' · ' + t('twrManual');
    if (mp.avgOnly) note += ' · ' + t('twrAvgNote', { n: mp.avgOnly });
  } else if (mp.fromDate && mp.loading) note = ' · ' + t('twrManualLoading');
  yEl.textContent = y === null || !isFinite(y) ? '—' : fmtPct(y, true);
  yEl.className = 'stat-value ' + (y === null || !isFinite(y) ? '' : y >= 0 ? 'pos' : 'neg');
  if (meta) meta.textContent = t('ovUpdated', { time: state.quotesAt ? fmtTimeIL(state.quotesAt) : '—' }) + note;
  try { renderManualPerf(mp); } catch (e) {}
  try { fitNumbers(); } catch (e) {}
}

/* v158: כרטיס "ביצועי התיק" במצב ידני — המקבילה של "ביצועי IBKR", מהעסקאות והאחזקות הידניות */
function renderManualPerf(mp) {
  const card = document.getElementById('ibkrPerfCard');
  const list = document.getElementById('ibkrPerfList');
  const period = document.getElementById('ibkrPerfPeriod');
  const title = document.getElementById('ibkrPerfTitleEl');
  if (!card || !list || isIbkrMode()) return;
  const show = POSITIONS.length > 0 || mtList().length > 0;
  card.classList.toggle('hidden', !show);
  if (!show) return;
  if (title) title.textContent = t('perfTitleManual');
  if (period) period.textContent = mp.fromDate ? t('perfPeriodManual', { a: fmtDateIL(mp.fromDate) }) : t('perfNoTrades');
  const mrow = (lbl, val) => {
    const li = el('li', 'perf-row');
    li.innerHTML = '<span class="perf-lbl">' + esc(lbl) + '</span>' +
      '<span class="perf-val ' + val.cls + '">' + esc(val.txt) + '</span>';
    list.appendChild(li);
  };
  const mval = (v, isMoney) => {
    if (v === null || v === undefined || !isFinite(v)) return { txt: '—', cls: '' };
    return { txt: isMoney ? ltrNum((v < 0 ? '−' : '') + money(Math.abs(v), 'USD')) : fmtPct(v, true), cls: v > 0 ? 'pos' : v < 0 ? 'neg' : '' };
  };
  list.innerHTML = '';
  mrow(t('perfTwr'), mp.twr !== null ? mval(mp.twr, false)
    : { txt: mp.fromDate ? (mp.loading ? t('loadingData') : t('cantCalc')) : t('perfNeedTrades'), cls: 'perf-note' });
  mrow(t('perfGainManual'), mp.missing ? { txt: '—', cls: '' } : mval(mp.gain, true));
  mrow(t('perfXirr'), mp.xirr !== null ? mval(mp.xirr, false)
    : { txt: mp.fromDate ? t('cantCalc') : t('perfNeedTrades'), cls: 'perf-note' });
  mrow(t('perfRealized'), mval(mp.realized, true));
  mrow(t('perfUnrealized'), mp.missing ? { txt: '—', cls: '' } : mval(mp.unrealized, true));
  mrow(t('perfFeesManual'), mval(Math.abs(mp.fees) < 0.005 ? 0 : -mp.fees, true));
  if (mp.avgOnly && mp.fromDate) {
    const li = el('li', 'perf-row');
    li.innerHTML = '<span class="perf-lbl fine">' + esc(t('twrAvgNote', { n: mp.avgOnly })) + '</span>';
    list.appendChild(li);
  }
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
  if (!isIbkrMode()) return; // v158: במצב ידני — renderManualPerf
  const tEl = document.getElementById('ibkrPerfTitleEl');
  if (tEl) tEl.textContent = t('ibkrPerfTitle');
  const show = !!(ibkrCfg().data);
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
    return { txt: isMoney ? ltrNum((v < 0 ? '−' : '') + money(Math.abs(v), base)) : fmtPct(v, true), cls: v > 0 ? 'pos' : v < 0 ? 'neg' : '' };
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
  const w = canvas.clientWidth || 320;
  let h = w; // v183: מרובע; עם הרבה מניות הקנבס מתארך (למטה)
  // v193: מפתח ציור — כשכלום שנראה לא השתנה (רוחב, ערכה, שפה, מטבע, אחוזים/שווי מקוצר, לוגואים, הרמה) לא מציירים שוב.
  // הטיק החי (כל 2 שניות) קורא ל־drawPie דרך renderOverview(true); רוב הטיקים לא מזיזים אף אחוז — ואז זה חינם.
  try {
    const cur0 = state.currency, dark0 = document.documentElement.getAttribute('data-theme') === 'dark';
    const key = [w, dark0 ? 'd' : 'l', state.lang, cur0, state.pieActive || '', Math.round((state.pieFocus || 0) * 1000), JSON.stringify(state.pieLift || {}),
      slicesUnique.slice().sort((x, y) => y.value - x.value).map((sl) => { const e = PIE_LOGO_CACHE[normalizeSym(sl.sym)];
        return sl.sym + ':' + (total ? (sl.value / total * 100).toFixed(1) : '') + ':' + fmtShortMoney(cur0 === 'ILS' && state.fx ? sl.value * state.fx : sl.value, cur0) + ':' + (e ? (e.ready ? 'r' : e.failed ? 'f' : 'p') : '-'); }).join('|')].join('#');
    if (canvas._pieDrawKey === key && canvas.width && !pieAnimRaf) return;
    canvas._pieDrawKey = key;
  } catch (e) {}
  canvas.width = w * dpr; canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, w, h);
  if (!total) {
    ctx.fillStyle = cssVar('--on-surface-var', '#9AA5A0'); ctx.font = '15px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(t('noPriceYet'), w / 2, h / 2);
    return;
  }
  // v170: לפי הגודל בתיק — הגדולה ביותר מ־12 בשעון, ומשם בכיוון השעון (מימין לשמאל), כמו המקרא.
  // הצבעים כבר מובדלים גלובלית (pieDedupeColors), כך שגם שכנות נבדלות.
  const ordered = slicesUnique.slice().sort((x, y) => y.value - x.value);
  ordered.forEach((x, i) => { x.color = PIE_RANK_PALETTE[i % PIE_RANK_PALETTE.length]; }); // v178: צבע לפי דירוג (גם במקרא)
  // v169→v171: עיצוב נקי בסגנון אפל/גוגל — טבעת עבה עם רווח דק בצבע הכרטיס בין הפרוסות. לכל מניה אותה "תווית":
  // אריח לוגו בגודל אחיד + סימבול + בועה (אחוז מעל שווי). פרוסה קטנה מדי — התווית בולטת החוצה מעבר לשפה
  // (הטבעת מתכווצת בדיוק כמה שצריך), ותוויות לא עולות אחת על השנייה (מוזזות לאורך הטבעת).
  let cx = w / 2, cy = h / 2;
  const dark = document.documentElement && document.documentElement.getAttribute && document.documentElement.getAttribute('data-theme') === 'dark';
  const surface = cssVar('--surface', dark ? '#1C1C1E' : '#FFFFFF');
  const cur = state.currency;
  const val = (v) => (cur === 'ILS' && state.fx ? v * state.fx : v);
  const FONT = '-apple-system, system-ui, "Segoe UI", Roboto, sans-serif';
  const tw = (txt) => { const m = ctx.measureText(txt); return (m && m.width) || txt.length * 6; };
  const HOLE = 0.38; // חור קטן יותר = טבעת עבה יותר, יותר תוויות נכנסות לפרוסה
  const LS = 26, SYM_H = 12, BUB_H = 26, H = LS + 2 + SYM_H + 2 + BUB_H;
  let a0 = -Math.PI / 2;
  const segs = ordered.map((s) => {
    const a2 = a0 + (s.value / total) * Math.PI * 2;
    const pct = s.value / total * 100;
    // v187: זווית התווית (`lab`) נקבעת בשרשרת ב־posAt — צמודה לצד שנגד כיוון השעון של הפרוסה
    const g = { s: s, a: a0, a2: a2, mid: (a0 + a2) / 2, lab: (a0 + a2) / 2, pctTxt: pct.toFixed(1) + '%',
      valTxt: fmtShortMoney(val(s.value), cur), symTxt: normalizeSym(s.sym) || '?' };
    ctx.font = '700 10.5px ' + FONT;
    const symW = tw(g.symTxt), pW = tw(g.pctTxt);
    ctx.font = '500 10px ' + FONT;
    g.bubW = Math.max(pW, tw(g.valTxt)) + 14;
    g.W = Math.max(LS, symW, g.bubW);
    a0 = a2;
    return g;
  });
  // v173: כל התוויות באותו גודל, על מעגל אחד. מעט מניות — במרכז הפרוסות; ככל שיש יותר מניות, המעגל של
  // התוויות מתרחק מהמרכז (והטבעת מתכווצת בהתאם) — עד שאין שתי תוויות שנוגעות זו בזו. מה שגם אז לא נכנס
  // (עשרות מניות זעירות) — רק ברשימה, לפי סדר גודל.
  const R0 = Math.min(w, h) / 2 - 11; // v178: מקום לפרוסה ש"מורמת" בנגיעה
  const holeOf = (R) => Math.max(R * HOLE, Math.min(R * 0.62, 58)); // החור נשאר רחב מספיק לסכום במרכז
  let SC = 1;
  const clash = (p, q) => Math.abs(p.x - q.x) < (p.W + q.W) / 2 * SC + 3 && Math.abs(p.y - q.y) < H * SC + 3;
  // v187: "שרשרת" — התוויות מונחות בסדר השעון (מ־12), כל אחת צמודה ככל האפשר לצד שנגד כיוון השעון של הפרוסה שלה
  // (הקצה שהיא חולקת עם הפרוסה הגדולה ממנה), ורק נדחקת עם כיוון השעון אם היא נוגעת בתווית שכבר הונחה.
  // כך UNH יורדת, מפנה מקום ל־UBER, שמפנה ל־GOOG… ואף תווית לא נשמטת. מחזיר true כשהכול נכנס בלי נגיעות ובלי לגלוש מהפרוסה.
  const posAt = (rho) => {
    // v190: ρ = רדיוס המעגל של ה*לוגואים* (לא של מרכזי התוויות) — כך כל הלוגואים באותו מרחק מהמרכז, קרוב לשפה החיצונית,
    // בין אם הפרוסה למעלה (הבועה מתחת ללוגו, לתוך הטבעת) ובין אם למטה (הבועה מתחת ללוגו, החוצה). מראה אחיד לכולן.
    // v188: הקריטריון = הלוגו (החלק העליון של התווית) יושב על הפרוסה של המניה, כמה שיותר קרוב לקצה שנגד כיוון השעון;
    // הבועה עם המספרים מותר לה לגלוש לפרוסה השכנה (בקשת המשתמש) — מה שחשוב שהלוגו משויך בוודאות לפרוסה.
    const placed = [];
    const dyLogo = (H / 2 - LS / 2) * SC; // הלוגו מעל מרכז התווית (מסך), לא רדיאלי
    const dyShift = dyLogo * 0.6; // v190: התווית תלויה מתחת למעגל הלוגואים (חלקית — שלא לאבד רדיוס בתחתית הקנבס)
    let fine = true;
    for (const g of segs) {
      const put = (t) => { g.x = Math.cos(t) * rho; g.y = Math.sin(t) * rho + dyShift; }; // v190: הלוגואים על מעגל אחד, התווית תלויה מתחת
      const hit = () => placed.some((o) => clash(o, g));
      const logoOn = () => { // מרכז הלוגו בתוך הפרוסה (עם שוליים של חצי לוגו); פרוסה צרה מהלוגו — הלוגו מול אמצע הפרוסה
        const lx = g.x, ly = g.y - dyLogo, rl = Math.hypot(lx, ly), m = (LS / 2) * SC / Math.max(rl, 1);
        let phi = Math.atan2(ly, lx);
        while (phi < g.a - Math.PI) phi += Math.PI * 2;
        while (phi > g.a + Math.PI) phi -= Math.PI * 2;
        const narrow = g.a2 - g.a < 2 * m + 0.02;
        return narrow ? Math.abs(phi - g.mid) < m + 0.04 : (phi >= g.a + m && phi <= g.a2 - m); // צרה: הלוגו עד חצי מחוץ לפרוסה
      };
      let th = null;
      if (g === segs[0]) { th = g.mid; put(th); } // הגדולה — מול הפרוסה שלה (v185), משאירה מקום ליד 12 לקטנות שבסוף
      else {
        let best = null;
        for (let t = g.a - 0.35; t <= g.a2 + 0.35; t += 0.02) { // סריקה עם כיוון השעון — הראשון שמתאים = הכי נגד כיוון השעון
          put(t);
          if (hit()) continue;
          if (logoOn()) { th = t; break; }
          if (best === null || Math.abs(t - g.mid) < Math.abs(best - g.mid)) best = t;
        }
        if (th === null) { // אין מקום על הפרוסה — הקרוב ביותר בלי נגיעה (עם סיכה), גם רחוק יותר
          fine = false;
          if (best === null) for (let t = g.mid - 1.6; t <= g.mid + 1.6; t += 0.03) { put(t); if (!hit() && (best === null || Math.abs(t - g.mid) < Math.abs(best - g.mid))) best = t; }
          th = best === null ? g.mid : best; put(th);
        }
      }
      if (hit()) fine = false;
      g.lab = th;
      placed.push(g);
    }
    // v189: מעבר חוזר, מהאחרונה אחורה — כל תווית חוזרת לכיוון אמצע הפרוסה שלה עד שהיא נוגעת בשכנה שאחריה (עם כיוון השעון).
    // כך תווית נצמדת לקצה שנגד כיוון השעון רק כשבאמת צריך לפנות מקום לשכנות הצפופות; כשיש מקום — היא ממורכזת (META/ADBE/MBLY/MSFT).
    for (let i = segs.length - 1; i >= 1; i--) {
      const g = segs[i], others = segs.filter((o) => o !== g);
      const put = (t) => { g.x = Math.cos(t) * rho; g.y = Math.sin(t) * rho + dyShift; }; // v190: הלוגואים על מעגל אחד, התווית תלויה מתחת
      let best = g.lab;
      for (let t = g.lab + 0.02; t <= g.mid; t += 0.02) { put(t); if (others.some((o) => clash(o, g))) break; best = t; }
      g.lab = best; put(best);
    }
    return fine;
  };
  // v185: התוויות שואפות לחלק החיצוני של הפרוסה (62% מרוחב הטבעת) — נוגעות בפרוסה, לא עמוק בפנים
  const ringAt = (RR, f) => holeOf(RR) + (RR - holeOf(RR)) * f;
  let R = R0, rho = ringAt(R0, 0.9), ok = false; // v191: הלוגואים ב־90% מרוחב הטבעת — ממש על השפה החיצונית
  const OUTER = segs.length > 12; // v193: מעל 12 — הפריסה של השבבים (למטה); שלבי התוויות של מעט מניות מיותרים
  // v193: מטמון פריסה — אותן פרוסות (זוויות, רוחבי תוויות) באותו רוחב = אותה פריסה; החיפוש (סריקות + נגיעות) לא רץ שוב
  const layKey = w + '|' + h + '|' + segs.map((g) => g.s.sym + ':' + g.a.toFixed(4) + ':' + g.a2.toFixed(4) + ':' + g.W).join('|');
  const LC = state.pieLayoutCache;
  const layHit = !OUTER && LC && LC.key === layKey && LC.pos.length === segs.length;
  if (layHit) { rho = LC.rho; R = LC.R; SC = LC.SC; ok = true; segs.forEach((g, i) => { g.x = LC.pos[i][0]; g.y = LC.pos[i][1]; g.lab = LC.pos[i][2]; }); }
  // 1) מעט מניות: במרכז הפרוסות — אם צריך, כל התוויות קטנות יחד (עד 82%) כדי שלא ייגעו
  if (!OUTER && !layHit) for (const sc of [1, 0.9, 0.82, 0.76, 0.7]) { // v188: עדיף תוויות קטנות יותר מאשר תוויות מחוץ לטבעת — הלוגו על הפרוסה
    SC = sc;
    const cap = Math.min(w, h) / 2 - 2 - Math.max(...segs.map((g) => Math.max(g.W / 2, H / 2 + (H / 2 - LS / 2) * 0.6) * SC)); // v190: הבועה שתלויה מתחת ללוגו נשארת בתוך הקנבס
    for (const d of [0, 6, 12, 18]) { const r1 = Math.min(rho + d, cap); if (posAt(r1)) { ok = true; rho = r1; break; } }
    if (ok) break;
  }
  if (ok && !layHit && !OUTER) { // v192: אם הקנבס לא מאפשר להגיע ל־90% מרוחב הטבעת — הטבעת מתכווצת כך שהלוגואים באמת יושבים על השפה
    let RR = R0;
    for (let i = 0; i < 4; i++) RR = (rho - 0.1 * holeOf(RR)) / 0.9;
    R = Math.max(R0 * 0.8, Math.min(R0, RR));
  }
  // 2) יותר מניות: כל התוויות מתרחקות מהמרכז באותה מידה (הטבעת מתכווצת ונשארת מתחתן), עד שאין נגיעות
  if (!ok && !OUTER) {
    let rhoMax = 0;
    for (const sc of [0.85, 0.78, 0.72]) { // v190: אם גם בשפה לא נכנס — תוויות קטנות עוד יותר לפני שמקבלים נגיעות
      SC = sc;
      rhoMax = Math.min(w, h) / 2 - 2 - Math.max(...segs.map((g) => Math.max(g.W / 2, H / 2 + (H / 2 - LS / 2) * 0.6) * SC));
      for (rho = ringAt(R0, 0.9); rho <= rhoMax; rho += 3) { if (posAt(rho)) { ok = true; break; } }
      if (ok) break;
    }
    if (!ok) { rho = rhoMax; posAt(rho); }
    R = Math.max(R0 * 0.6, Math.min(R0, rho + H * SC * 0.22)); // v175: התוויות יושבות על השפה — הטבעת נשארת גדולה
  }
  if (!OUTER && !layHit) state.pieLayoutCache = { key: layKey, rho: rho, R: R, SC: SC, pos: segs.map((g) => [g.x, g.y, g.lab]) };
  // 3) v183: הרבה מניות (מעל 12) — "הסברים": לכל מניה שבב (פס בצבע הפרוסה + לוגו + אחוז מעל שווי) בטור לצד העוגה,
  // ממוין לפי הזווית, עם קו מוביל בצבע הפרוסה מהפרוסה אל השבב — הקווים לא מצטלבים, ואף מניה לא מוסתרת.
  // הקנבס מתארך לפי הצורך (עד פי 1.5 מהרוחב); גודל השבב — הגדול ביותר שמשאיר עוגה של לפחות 29% מהרוחב.
  const CHIP_H = LS + 2 + BUB_H; // v186: שבב אנכי — לוגו מעל הבועה (אחוז/שווי), בלי סימבול — אותו מבנה כמו במעט מניות
  if (OUTER) {
    const key = ['cols', w].concat(segs.map((g) => g.s.sym + ':' + g.pctTxt + ':' + g.valTxt)).join('|');
    let L = state.pieOuterCache && state.pieOuterCache.key === key ? state.pieOuterCache.L : null;
    if (!L) {
      segs.forEach((g) => { g.chipW = Math.max(LS, g.bubW); });
      const colW0 = Math.max(...segs.map((g) => g.chipW));
      const items = segs.map((g) => ({ mid: g.mid, span: g.a2 - g.a }));
      let best = null, fallback = null;
      for (const sc of [1, 0.92, 0.84, 0.76, 0.7, 0.64]) {
        const lay = pieCalloutLayout(items, w, w * 1.5, CHIP_H * sc, colW0 * sc, 12); // v186: שבבים מסביב לעוגה
        if (!lay) continue;
        if (!fallback) fallback = { sc: sc, lay: lay };
        if (lay.R >= 0.29 * w) { best = { sc: sc, lay: lay }; break; }
      }
      if (!best) best = fallback || { sc: 0.64, lay: pieCalloutLayout(items, w, w * 2.2, CHIP_H * 0.64, colW0 * 0.64, 12) };
      L = best.lay ? { h: best.lay.h, R: best.lay.R, cx: best.lay.cx, cy: best.lay.cy, sc: best.sc, pos: best.lay.pos, chipW: segs.map((g) => g.chipW) } : null;
      state.pieOuterCache = { key: key, L: L };
    }
    if (L) {
      if (Math.abs(L.h - h) > 0.5) { // גובה הקנבס לפי הפריסה (שורות מעל/מתחת, טורים)
        h = L.h;
        canvas.style.height = h + 'px';
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      R = L.R; SC = L.sc;
      cx = L.cx; cy = L.cy; // v183: עם שורה מעל/מתחת — מרכז העוגה זז
      segs.forEach((g, i) => { g.chip = true; g.chipW = L.chipW[i]; g.x = L.pos[i].x - cx; g.y = L.pos[i].y - cy; g.side = L.pos[i].side; g.zone = L.pos[i].zone; g.W = g.chipW; });
    }
  }
  if (!OUTER && canvas.style && canvas.style.height) { canvas.style.height = ''; } // חזרה לקנבס מרובע
  // v187: כל תווית מוצגת תמיד (המיקום נקבע בשרשרת ב־posAt) — אף מניה לא נשמטת מהגרף
  for (const g of segs) {
    g.sc = SC; g.out = OUTER || rho > (holeOf(R) + R) / 2 + 6; // תווית על השפה (לא במרכז הפרוסה) → קו מוביל
    g.skip = false;
  }
  const r = holeOf(R);
  const gap = ordered.length > 1 ? 2.5 : 0;
  // v178: נגיעה בפרוסה "מרימה" אותה — יוצאת החוצה מהטבעת, גדלה מעט ומטילה צל רך (תחושת עומק מוחשית).
  // הצבע: גרדיאנט עדין (בהיר ליד המרכז) — נפח בלי להעמיס.
  const lift = (g) => (state.pieLift && state.pieLift[g.s.sym]) || 0;
  const slicePath = (g, L) => {
    const off = L * 6, ox = Math.cos(g.mid) * off, oy = Math.sin(g.mid) * off;
    const X = cx + ox, Y = cy + oy, Ro = R + L * 4;
    // v182: פינות מעוגלות לכל פרוסה (רדיוס עד 7px, קטן יותר בפרוסה צרה)
    const span = g.a2 - g.a;
    const cr = Math.max(0, Math.min(7, (Ro - r) / 4, span * r / 2.4, span * Ro / 2.4));
    ctx.beginPath();
    if (cr < 1 || !ctx.arcTo) {
      ctx.arc(X, Y, Ro, g.a, g.a2);
      ctx.arc(X, Y, r, g.a2, g.a, true);
      ctx.closePath();
      return [ox, oy];
    }
    const pt = (ang, rad) => [X + Math.cos(ang) * rad, Y + Math.sin(ang) * rad];
    const dO = cr / Ro, dI = cr / r;
    ctx.moveTo(...pt(g.a, r + cr));
    ctx.lineTo(...pt(g.a, Ro - cr));
    ctx.arcTo(...pt(g.a, Ro), ...pt(g.a + dO, Ro), cr);
    ctx.arc(X, Y, Ro, g.a + dO, g.a2 - dO);
    ctx.arcTo(...pt(g.a2, Ro), ...pt(g.a2, Ro - cr), cr);
    ctx.lineTo(...pt(g.a2, r + cr));
    ctx.arcTo(...pt(g.a2, r), ...pt(g.a2 - dI, r), cr);
    ctx.arc(X, Y, r, g.a2 - dI, g.a + dI, true);
    ctx.arcTo(...pt(g.a, r), ...pt(g.a, r + cr), cr);
    ctx.closePath();
    return [ox, oy];
  };
  const sliceFill = (g, L, ox, oy) => {
    const gr = ctx.createRadialGradient ? ctx.createRadialGradient(cx + ox, cy + oy, r, cx + ox, cy + oy, R + L * 4) : null;
    if (gr && gr.addColorStop) {
      gr.addColorStop(0, pieShade(g.s.color, 0.16 + L * 0.06));
      gr.addColorStop(1, pieShade(g.s.color, L * 0.04));
      ctx.fillStyle = gr;
    } else ctx.fillStyle = g.s.color;
    ctx.fill();
  };
  // v179: כשפרוסה מורמת — השאר נסוגות לרקע (שקיפות), כמו מיקוד באפל
  const focus = Math.max(0, Math.min(1, state.pieFocus || 0));
  const dimA = 1 - 0.5 * focus;
  for (const g of segs) {
    if (lift(g) > 0.001) continue;
    const [ox, oy] = slicePath(g, 0);
    ctx.save();
    ctx.globalAlpha = dimA;
    ctx.fillStyle = g.s.color; // (גם לבדיקות: הצבע הבסיסי)
    sliceFill(g, 0, ox, oy);
    ctx.restore();
  }
  // רווחים בין הפרוסות — קווים רדיאליים בצבע הכרטיס
  if (gap) {
    ctx.save();
    ctx.strokeStyle = surface; ctx.lineWidth = gap; ctx.lineCap = 'butt';
    for (const g of segs) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(g.a) * (r - 1), cy + Math.sin(g.a) * (r - 1));
      ctx.lineTo(cx + Math.cos(g.a) * (R + 1), cy + Math.sin(g.a) * (R + 1));
      ctx.stroke();
    }
    ctx.restore();
  }
  for (const g of segs) {
    const L = lift(g);
    if (L <= 0.001) continue;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,' + (0.3 * L).toFixed(3) + ')'; ctx.shadowBlur = 22 * L; ctx.shadowOffsetY = 8 * L;
    const [ox, oy] = slicePath(g, L);
    sliceFill(g, L, ox, oy);
    ctx.restore();
    // ברק עדין על הפרוסה המורמת — כמו אור מלמעלה על משטח אמיתי
    if (ctx.createLinearGradient) {
      ctx.save();
      slicePath(g, L);
      ctx.clip();
      const sh = ctx.createLinearGradient(cx + ox, cy + oy - R, cx + ox, cy + oy + R);
      if (sh && sh.addColorStop) {
        sh.addColorStop(0, 'rgba(255,255,255,' + (0.28 * Math.min(1, L)).toFixed(3) + ')');
        sh.addColorStop(0.55, 'rgba(255,255,255,0)');
        ctx.fillStyle = sh; ctx.fillRect(0, 0, w, h);
      }
      ctx.restore();
    }
    slicePath(g, L);
    ctx.strokeStyle = surface; ctx.lineWidth = gap || 1.5; ctx.stroke();
    if (!g.chip) { g.x += ox; g.y += oy; } // v180: התווית זזה יחד עם הפרוסה; שבב בטור נשאר במקומו (הקו המוביל זז)
  }
  if (canvas.classList) canvas.classList.add('drawn'); // v193: הקנבס נכנס בעמעום כשיש מה להראות
  state.pieGeom = { cx: cx, cy: cy, r: r, R: R, segs: segs.map((g) => ({ sym: g.s.sym, a: g.a, a2: g.a2 })),
    chips: segs.filter((g) => g.chip).map((g) => ({ sym: g.s.sym, x: cx + g.x - g.chipW * SC / 2, y: cy + g.y - CHIP_H * SC / 2, w: g.chipW * SC, h: CHIP_H * SC })) };
  pieWireTouch(canvas);
  if (OUTER) { // v183: קו מוביל בצבע הפרוסה: מהשפה, קטע רדיאלי קצר, ואז ישר אל השבב (הקווים לא מצטלבים — הטור ממוין לפי הזווית)
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const g of segs) {
      if (g.skip || !g.chip) continue;
      const L = lift(g);
      const off = L * 6, ox = Math.cos(g.mid) * off, oy = Math.sin(g.mid) * off;
      const r1 = R + L * 4 + 1, r2 = R + 10;
      const sx = cx + ox + Math.cos(g.mid) * r1, sy = cy + oy + Math.sin(g.mid) * r1;
      const ex = cx + ox + Math.cos(g.mid) * r2, ey = cy + oy + Math.sin(g.mid) * r2;
      const cw = g.chipW * SC, chh = CHIP_H * SC;
      const tx = g.zone === 'T' || g.zone === 'B' ? cx + g.x : cx + g.x - g.side * (g.bubW * SC / 2 + 2);
      const ty = g.zone === 'T' ? cy + g.y + chh / 2 + 2 : g.zone === 'B' ? cy + g.y - chh / 2 - 2 : cy + g.y + (chh / 2 - BUB_H * SC / 2); // בטור: אל אמצע הבועה
      ctx.globalAlpha = L > 0.5 ? 1 : (0.55 + 0.45 * (1 - focus));
      ctx.strokeStyle = pieShade(g.s.color, -0.22);
      ctx.lineWidth = 1.25 + L * 1.25;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.lineTo(tx, ty); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx, ty, 2 + L, 0, Math.PI * 2); ctx.fillStyle = pieShade(g.s.color, -0.22); ctx.fill();
    }
    ctx.restore();
  }
  if (!OUTER) { // v183/v184: במעט מניות — תווית שיושבת על השפה מקבלת "סיכה" קצרה בצבע הפרוסה: מקצה התווית ~18px לתוך הפרוסה, לא עמוק
    ctx.save();
    ctx.lineCap = 'round';
    for (const g of segs) {
      if (g.skip || !g.out) continue;
      // v186: בלי סיכה כשהתווית יושבת בבירור על הפרוסה שלה — בתוך הזווית שלה, והפרוסה רחבה מהתווית בגובה התווית
      const rhoL = Math.hypot(g.x, g.y);
      let thL = Math.atan2(g.y, g.x);
      while (thL < g.a) thL += Math.PI * 2;
      while (thL > g.a + Math.PI * 2) thL -= Math.PI * 2;
      const onSlice = thL <= g.a2 && rhoL <= R + 2 && (g.a2 - g.a) * Math.min(rhoL, R) >= g.W * SC * 0.6;
      if (onSlice) continue;
      const L = lift(g);
      const off = L * 6, ox = Math.cos(g.mid) * off, oy = Math.sin(g.mid) * off;
      const tx = ox + Math.cos(g.mid) * (r + R) / 2, ty = oy + Math.sin(g.mid) * (r + R) / 2; // אמצע הפרוסה (יחסית למרכז)
      const dx = tx - g.x, dy = ty - g.y, dist = Math.hypot(dx, dy);
      if (dist < 1) continue;
      const ux = dx / dist, uy = dy / dist;
      const hw = g.W * SC / 2 + 2, hh = H * SC / 2 + 2;
      const edge = Math.min(Math.abs(ux) > 1e-6 ? hw / Math.abs(ux) : Infinity, Math.abs(uy) > 1e-6 ? hh / Math.abs(uy) : Infinity);
      if (dist <= edge + 6) continue; // התווית כבר מכסה את אמצע הפרוסה — ברור בלי קו
      const len = Math.min(18, dist - edge - 3);
      const sx = cx + g.x + ux * edge, sy = cy + g.y + uy * edge;
      const ex = sx + ux * len, ey = sy + uy * len;
      ctx.globalAlpha = L > 0.5 ? 1 : (0.6 + 0.4 * (1 - focus));
      ctx.strokeStyle = pieShade(g.s.color, -0.3);
      ctx.lineWidth = 1.5 + L;
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, 2.2 + L, 0, Math.PI * 2); ctx.fillStyle = pieShade(g.s.color, -0.3); ctx.fill();
    }
    ctx.restore();
  }
  ctx.direction = 'ltr';
  const ink = dark ? '#F2F2F7' : '#1C1C1E', sub = dark ? 'rgba(242,242,247,.7)' : 'rgba(28,28,30,.62)';
  for (const g of segs) {
    if (g.skip) continue;
    const s = g.s, x = 0;
    ctx.save();
    if (lift(g) < 0.5) ctx.globalAlpha = dimA;
    ctx.translate(cx + g.x, cy + g.y);
    const gL = lift(g);
    const pop = 1 + 0.2 * gL; // v180: התווית "קופצת" יחד עם הפרוסה — אותו קפיץ, אותו תזמון
    ctx.scale((g.sc || 1) * pop, (g.sc || 1) * pop); // גודל יחסי לפרוסה — הלוגו, הסימבול והבועה יחד
    let top = -(g.chip ? CHIP_H : H) / 2; // v186: שבב (הרבה מניות) — בלי שורת הסימבול
    // לוגו — אותו גודל לכל החברות
    const e = pieLogoImg(s.sym);
    const lx = x - LS / 2;
    const light = !!(e.ready && e.light && !e.inv); // לוגו לבן שלא הצלחנו להפוך — אריח כהה
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,' + (0.18 + 0.16 * Math.min(1, gL)).toFixed(3) + ')'; ctx.shadowBlur = 6 + 10 * gL; ctx.shadowOffsetY = 1.5 + 4 * gL;
    pieRoundRect(ctx, lx, top, LS, LS, LS * 0.26);
    ctx.fillStyle = light ? '#1D1D1F' : '#FFFFFF';
    ctx.fill();
    ctx.restore();
    if (e.ready && !e.failed && e.img.naturalWidth) {
      ctx.save();
      pieRoundRect(ctx, lx, top, LS, LS, LS * 0.26);
      ctx.clip();
      const inner = /tradingview/.test(e.img.src || '') ? LS : LS * 0.74;
      const iw = e.img.naturalWidth, ih = e.img.naturalHeight;
      const sc = Math.min(inner / iw, inner / ih);
      ctx.drawImage(e.inv || e.img, x - iw * sc / 2, top + LS / 2 - ih * sc / 2, iw * sc, ih * sc);
      ctx.restore();
    } else {
      ctx.fillStyle = '#3A3A3C'; ctx.font = '700 ' + Math.round(LS * 0.44) + 'px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.symTxt.charAt(0), x, top + LS / 2 + 0.5);
    }
    top += LS + 2;
    if (!g.chip) { // סימבול — מחוץ לטבעת בצבע הטקסט של הכרטיס, בתוכה כהה על הפסטל
      ctx.fillStyle = g.out ? cssVar('--on-surface', ink) : 'rgba(28,28,30,.88)';
      ctx.font = '700 10.5px ' + FONT;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(g.symTxt, x, top + SYM_H / 2);
      top += SYM_H + 2;
    }
    // בועה: אחוז מהתיק מעל השווי
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.14)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 1;
    pieRoundRect(ctx, x - g.bubW / 2, top, g.bubW, BUB_H, 9);
    ctx.fillStyle = dark ? 'rgba(44,44,46,.96)' : 'rgba(255,255,255,.96)';
    ctx.fill();
    ctx.restore();
    if (g.out && !dark) { // על רקע הכרטיס הלבן — קו מתאר עדין במקום צל בלבד
      pieRoundRect(ctx, x - g.bubW / 2 + 0.5, top + 0.5, g.bubW - 1, BUB_H - 1, 9);
      ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = ink; ctx.font = '700 10.5px ' + FONT;
    ctx.fillText(g.pctTxt, x, top + 9);
    ctx.fillStyle = sub; ctx.font = '500 10px ' + FONT;
    ctx.fillText(g.valTxt, x, top + 19.5);
    ctx.restore();
  }
  ctx.textBaseline = 'alphabetic';
  ctx.direction = 'inherit';
  ctx.textAlign = 'center';
  // v179: במרכז — הסכום הכולל; כשפרוסה מורמת, מתחלף בעמעום לפרטי המניה (סימבול, אחוז, שווי)
  const act = state.pieActive && segs.find((g) => g.s.sym === state.pieActive);
  const cf = act ? focus : 0;
  const big = r > 64 ? 21 : 18, small = r > 64 ? 13 : 12;
  if (cf < 0.999) {
    ctx.save(); ctx.globalAlpha = 1 - cf;
    ctx.fillStyle = cssVar('--on-surface-var', '#6B6B70');
    ctx.font = '600 ' + small + 'px ' + FONT;
    ctx.fillText(t('totalStocks'), cx, cy - 8 - cf * 6);
    ctx.fillStyle = cssVar('--on-surface', '#191C1A');
    ctx.font = '800 ' + big + 'px ' + FONT;
    ctx.fillText(money(val(total), cur), cx, cy + 17 - cf * 6);
    ctx.restore();
  }
  if (act && cf > 0.001) {
    ctx.save(); ctx.globalAlpha = cf; ctx.direction = 'ltr';
    const dy = (1 - cf) * 8;
    ctx.font = '700 ' + small + 'px ' + FONT;
    ctx.fillStyle = act.s.color;
    ctx.beginPath(); ctx.arc(cx - tw(act.symTxt) / 2 - 8, cy - 22 + dy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = cssVar('--on-surface', '#191C1A');
    ctx.fillText(act.symTxt, cx, cy - 18 + dy);
    ctx.font = '800 ' + big + 'px ' + FONT;
    ctx.fillText(act.pctTxt, cx, cy + 5 + dy);
    ctx.fillStyle = cssVar('--on-surface-var', '#6B6B70');
    ctx.font = '600 ' + small + 'px ' + FONT;
    ctx.fillText(money(val(act.s.value), cur), cx, cy + 24 + dy);
    ctx.restore();
  }

  const legend = document.getElementById('pieLegend');
  // v180: בזמן האנימציה לא בונים את הרשימה מחדש (התמונות היו מהבהבות) — רק מסמנים את השורה הפעילה
  if (pieAnimRaf && legend.children && legend.children.length) { pieMarkLegend(legend); return; }
  legend.innerHTML = '';
  const sorted = slicesUnique.slice().sort((a, b) => b.value - a.value);
  for (const s of sorted) {
    const src = logoSrc(s.sym);
    const e = src ? pieLogoImg(s.sym) : null;
    const full = companyName(s.sym, s.name);
    const li = el('li', '',
      '<span class="pie-leg-logo' + (e && e.ready && e.light ? ' inv' : '') + '">' +
      '<span class="pie-leg-fb">' + esc((normalizeSym(s.sym) || '?').charAt(0)) + '</span>' +
      (src && !(e && e.failed) ? '<img src="' + src + '" alt="" loading="lazy" decoding="async" data-err="hide-self">' : '') + '</span>' +
      '<span class="dot" style="background:' + s.color + '"></span>' +
      '<span class="lg-name"><bdi dir="ltr" class="lg-sym">' + esc(s.sym) + '</bdi>' +
      (full && full.toUpperCase() !== String(s.sym).toUpperCase() ? '<span class="lg-full" dir="auto">' + esc(full) + '</span>' : '') + '</span>' +
      '<span class="lg-val">' + money(val(s.value), cur) + '</span>' +
      '<span class="lg-pct">' + (s.value / total * 100).toFixed(1) + '%</span>');
    if (li.dataset) li.dataset.sym = s.sym;
    li.addEventListener && li.addEventListener('click', () => { // נגיעה בשורה = נגיעה בפרוסה
      const next = state.pieActive === s.sym ? null : s.sym;
      state.pieActive = next;
      if (next) { try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) {} }
      pieAnimateLift(next);
    });
    legend.appendChild(li);
  }
  pieMarkLegend(legend);
}
/* v180: השורה של הפרוסה הפעילה מודגשת, והלוגו שלה קופץ (CSS, אותו תזמון כמו בעוגה) */
function pieMarkLegend(legend) {
  for (const li of (legend.children || [])) {
    if (li.classList) li.classList.toggle('active', !!state.pieActive && li.dataset && li.dataset.sym === state.pieActive);
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
  // v162: מטמון קיים שמתחיל מאוחר מדי לבקשה (למשל דמו של 6 שנים) — משלימים אחורה
  const tooShort = (c) => !!(earliestOverride && c && c.dates.length && c.dates[0] > addDaysISO(earliestOverride, 10));
  if (fxHistCache && !tooShort(fxHistCache)) return fxHistCache;
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
  const firstHave = haveDates.length ? haveDates[0] : null;
  const fetchFrom = (lastHave && lastHave >= earliest && firstHave <= addDaysISO(earliest, 10)) ? addDaysISO(lastHave, 1) : earliest;
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
  if (srcKind === undefined) { const c = document.getElementById('pfChart'); srcKind = c && c._pfPaint ? c._pfPaint.srcKind : 'manual'; }
  if (srcKind === 'ibkr') txt = hasDaily ? t('pfNoteIbkrDaily') : t('pfNoteIbkr');
  else if (srcKind === 'trades') txt = t('pfNoteManualTwr');
  else if (srcKind === 'holdings') txt = t('pfNoteHoldings');
  else txt = t('pfNote');
  if (noBench && srcKind !== 'manual') txt += ' · ' + t('pfNoBench');
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
    allRows = null;
    if (!isIbkrMode()) {
      // v158: מצב ידני — TWR בדולרים מהעסקאות (כולל מניות שכבר נמכרו), אחרת האחזקות הנוכחיות בדולרים.
      // שניהם מול המדדים, כמו במצב IBKR.
      const tr = mtActiveTrades();
      const tSyms = [...new Set(tr.map((x) => mtNorm(x).sym))].filter((sym) => !(state.hist[sym] || []).length);
      if (tSyms.length) await pool(tSyms, 4, (sym) => getDailyFast(sym, false).catch(() => null));
      if (my !== pfChartToken) return;
      const mr = tr.length ? manualTwrRows(tr, manualHistOf, (d) => fxOnOrBefore(d)) : null;
      if (mr) { allRows = mr; srcKind = 'trades'; }
      else if (!tr.length) {
        const hr = holdingsUsdRows(POSITIONS, manualHistOf, (d) => fxOnOrBefore(d));
        if (hr) { allRows = hr; srcKind = 'holdings'; }
      }
      try { paintManualHead(); } catch (e) {}
    }
    // בלי TWR רשמי מהדוח — אין היסטוריה אמיתית: סימולציית אחזקות נוכחיות (כמו ידני).
    if (!allRows) allRows = portfolioSeriesILS();
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
    { name: srcKind === 'ibkr' ? t('ibkrNavLegend') : srcKind === 'holdings' ? t('pfHoldingsLegend') : t('myPortfolio'), color: cssVar('--primary', '#006A4E'), rows: pfRows },
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
    ctx.direction = 'ltr'; // v166: הסימן משמאל למספר גם בקנבס (ברירת המחדל יורשת RTL)
    ctx.fillText((v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(1) + '%', w - padR + 6, y);
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
  if (canvas.classList) canvas.classList.add('drawn'); // v193
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
  const sc = document.getElementById('stockCount');
  if (sc) sc.textContent = POSITIONS.length;
  if (!tabShouldRender('stocks')) return; // v193
  const list = document.getElementById('stockList');
  const wasEmpty = !list.querySelector || !list.querySelector('.stock'); // v193: כניסה מדורגת רק כשהרשימה נבנית מאפס
  list.innerHTML = '';
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
  renderSrcFilter('stocks');
  const sf = getSrcFilter('stocks');
  const shown = POSITIONS.filter((p) => srcPass(sf, positionSource(p)));
  if (!shown.length && POSITIONS.length) {
    const m = el('p', 'fine', t('srcFilterEmpty'));
    m.style.padding = '0';
    list.appendChild(m);
  }
  let idx = 0;
  for (const p of sortPositionsList(shown, mode, mOf)) {
    const card = buildStockCard(p);
    if (wasEmpty && idx < 10 && card.style && card.style.setProperty) { card.classList.add('enter'); card.style.setProperty('--i', idx); }
    idx++;
    list.appendChild(card);
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
    '<div class="stock-body-in"><div class="form-grid">' +
    '<label>' + t('fldShares') + '<input id="ep-shares" type="number" min="0" step="any" inputmode="decimal" value="' + p.shares + '"></label>' +
    '<label>' + t('fldAvgPrice', { c: esc(pxUnit(p.sym)) }) + '<input id="ep-avg" type="number" min="0" step="any" inputmode="decimal" value="' + pxToInput(p.sym, p.avg) + '"></label>' +
    '</div>' +
    '<div class="form-err hidden" id="ep-err"></div>' +
    '<div class="edit-actions"><button class="btn" id="ep-save" type="button">' + t('btnSave') + '</button>' +
    '<button class="link-btn" id="ep-cancel" type="button">' + t('btnCancel') + '</button>' +
    '<button class="chip-btn danger" id="ep-delete" type="button">' + t('btnDelete') + '</button></div></div>';
  body.querySelector('#ep-cancel').addEventListener('click', () => refreshStockBody(p.sym));
  body.querySelector('#ep-delete').addEventListener('click', () => deletePosition(p));
  body.querySelector('#ep-save').addEventListener('click', () => {
    const shares = parseFloat(body.querySelector('#ep-shares').value);
    const avg = pxFromInput(p.sym, parseFloat(body.querySelector('#ep-avg').value));
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
    '<label class="m-avg">' + '<span>' + t('fldAvgPrice', { c: '<span class="cur-px">$</span>' }) + '</span>' + '<input id="ap-avg" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '<label class="m-tr hidden">' + t('fldDate') + '<input id="ap-date" type="date" lang="he-IL" max="' + todayISO() + '" value="' + todayISO() + '"></label>' +
    '<label class="m-tr hidden">' + t('fldTradeQty') + '<input id="ap-qty" type="number" min="0" step="any" inputmode="decimal"></label>' +
    '<label class="m-tr hidden">' + '<span>' + t('fldTradePrice', { c: '<span class="cur-px">$</span>' }) + '</span>' + '<input id="ap-price" type="number" min="0" step="any" inputmode="decimal"></label>' +
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
      const avg = pxFromInput(sym, parseFloat(card.querySelector('#ap-avg').value));
      const err = validPosition(sym, shares, avg, null);
      if (err) return fail(err);
      POSITIONS.push({ sym: sym, name: name, full: full, shares: shares, avg: avg, src: 'manual' });
    } else {
      const err0 = validPosition(sym, 1, 1, null);
      if (err0) return fail(err0);
      const tr = { id: mtNewId(), date: card.querySelector('#ap-date').value, sym: sym, side: 'BUY',
        qty: parseFloat(card.querySelector('#ap-qty').value), price: pxFromInput(sym, parseFloat(card.querySelector('#ap-price').value)),
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
    card.querySelectorAll('.cur-px').forEach((x) => { x.textContent = pxUnit(symInp.value.trim()); });
    pxHints(card, symInp);
  };
  symInp.addEventListener('input', paint);
  card._paintCur = paint;
  paint();
}

/* v157: מתחת לשדה מחיר באגורות — "= ₪682.40", שלא יהיה ספק מה נשמר */
function pxHints(card, symInp) {
  card.querySelectorAll('.cur-px').forEach((u) => {
    const lab = u.closest('label');
    const inp = lab && lab.querySelector('input');
    if (!inp) return;
    let h = lab.querySelector('.px-hint');
    if (!h) {
      h = el('span', 'px-hint');
      lab.appendChild(h);
      inp.addEventListener('input', () => pxHints(card, symInp));
    }
    const sym = symInp.value.trim();
    const val = parseFloat(inp.value);
    const show = symCur(sym) === 'ILS' && !isTaseIndex(sym) && val > 0;
    h.textContent = show ? '= ₪' + (Math.round(pxFromInput(sym, val) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 }) : '';
    h.classList.toggle('hidden', !show);
  });
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
    '<label>' + t('fldDate') + '<input class="mt-date" type="date" lang="he-IL" max="' + todayISO() + '" value="' + esc(tr ? tr.date : todayISO()) + '"></label>' +
    '<label>' + t('fldTradeQty') + '<input class="mt-qty" type="number" min="0" step="any" inputmode="decimal" value="' + esc(v(tr && tr.qty)) + '"></label>' +
    '<label>' + '<span>' + t('fldTradePrice', { c: '<span class="cur-px">$</span>' }) + '</span>' + '<input class="mt-price" type="number" min="0" step="any" inputmode="decimal" value="' + esc(tr ? pxToInput(tr.sym, tr.price) : '') + '"></label>' +
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
      price: pxFromInput(card.querySelector('.mt-sym').value.trim(), parseFloat(card.querySelector('.mt-price').value)),
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
  const li = buildTradeRow({ date: n.date, symbol: n.sym, side: n.side, qty: n.qty, price: n.price, commission: n.fee, currency: symCur(n.sym) }, 'manual');
  li.classList.add('mt-row');
  const first = li.firstChild;
  if (first) {
    if (mtShadowed(n.sym)) first.appendChild(el('div', 'fine', t('mtShadowed', { sym: n.sym })));
  }
  const act = el('span', 'mt-actions');
  const eb = el('button', 'mini-btn', t('btnEditRow'));
  eb.type = 'button';
  eb.addEventListener('click', () => onEdit(x));
  const db = el('button', 'mini-btn danger', t('btnDeleteRow'));
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
  const wrap = el('div', 'mt-manage stock-body-in');
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
  const wc = document.getElementById('wishlistCount');
  if (wc) wc.textContent = WISHLIST.length;
  if (!tabShouldRender('wishlist')) return; // v193
  list.innerHTML = '';
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
      '<button class="mini-btn danger wl-del" type="button" aria-label="' + esc(t('wlRemove', { sym: w.sym })) + '">' + esc(t('btnDeleteRow')) + '</button>' +
      '</div>' +
      '<div class="wl-price">' +
      (close > 0
        ? '<span class="wl-close" dir="ltr">' + (symCur(w.sym) === 'ILS' ? fmtAg(close, w.sym) : fmtUSD2(close)) + '</span>'
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
  const src = logoSrc(nsym);
  return '<span class="stock-logo">' +
    '<span class="stock-logo-fb">' + esc(first) + '</span>' +
    (src ? '<img class="stock-logo-img" crossorigin="anonymous" src="' + src + '" alt="" loading="lazy" decoding="async" ' +
    'data-logo="1">' : '') +
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
    if (/s3-symbol-logo\.tradingview\.com/.test(img.src || '')) return; // v159: לוגו רשמי עם רקע משלו — בלי היפוך צבעים
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

/* v166: שורות המשנה בכרטיס — זוגות הגיוניים, שורה לכל שאלה:
     היום  +0.52%           |  $25,448 ▾   (שווי)
     מהקנייה +40.04%        |  +$2,215     (רווח/הפסד מהקנייה, בדולרים/שקלים לפי המטבע הנבחר)
   שורת "מהקנייה" רק כשיש מחיר קנייה ומחיר חי. */
function stockSubHTML(p, m) {
  const cur = state.currency;
  const toCur = (usd) => (usd === null || usd === undefined ? null : (cur === 'ILS' && state.fx ? usd * state.fx : usd));
  const cls = (v) => (v === null || !isFinite(v) || Math.abs(v) < 0.005 ? '' : v >= 0 ? 'pos' : 'neg');
  const day = m.dayChg === null ? null : (Math.abs(m.dayChg) < 0.005 ? 0 : m.dayChg);
  // v208: גם השינוי היומי בכסף (שווי האחזקה היום פחות שוויה בסגירה הקודמת), באותו צבע, מעט קל יותר
  const dayAmt = day === null || m.value === null || !isFinite(m.value) ? null : m.value - m.value / (1 + day / 100);
  const dayAmtHTML = dayAmt === null || !isFinite(dayAmt) ? '' : ' <span class="day-amt">' + fmtSignedMoney(toCur(Math.abs(dayAmt) < 0.5 ? 0 : dayAmt), cur) + '</span>';
  let html = '<span class="day-chg ' + cls(day) + '">' + (day === null ? '—' : t('todayChg', { v: fmtPct(day, true) }) + dayAmtHTML) + '</span>' +
    '<span class="sub-val">' + (m.value === null ? '—' : money(toCur(m.value), cur)) + ' <span class="chev">▾</span></span>';
  let gp = (p && p.avg > 0 && m.price !== null) ? gainPctOf(p, m.price) : null;
  if (gp !== null && Math.abs(gp) < 0.005) gp = 0; // בלי "+0.00%"
  if (gp !== null && isFinite(gp)) {
    html += '<span class="buy-chg ' + cls(gp) + '">' + t('buyChg', { v: fmtPct(gp, true) }) + '</span>' +
      '<span class="buy-amt ' + cls(gp) + '">' + (m.gl === null ? '—' : fmtSignedMoney(toCur(m.gl), cur)) + '</span>';
  }
  return html;
}

/* v193: "שלד" מהבהב במקום "—" בזמן שהמחירים הראשונים עוד בדרך (אין עדיין ציטוט ולא נתונים שמורים) */
const SKEL_HTML = '<span class="skel" aria-hidden="true"></span>';
function quotesPending() { return !state.quotesAt && !state.stale; }
/* v193: כותרת הכרטיס (לוגו, סימבול, שם, מחיר, שינוי) — משותף לבנייה ולעדכון החי, בלי לבנות כרטיס שלם בכל טיק */
/* v205: המחיר בכרטיס גדול (27px); מחיר ארוך במיוחד ("$12,345.67", "226,240 אג׳") מוקטן בשלב אחד או שניים כדי שהשורה לא תגלוש */
function stockPriceSizeCls(txt) {
  const n = String(txt || '').replace(/<[^>]*>/g, '').replace(/[\u2066-\u2069]/g, '').length;
  return n >= 10 ? ' px-xl' : n >= 9 ? ' px-lg' : '';
}
function stockHeadHTML(p, m) {
  const sym = p.sym;
  const priceTxt = m.price === null ? (quotesPending() ? SKEL_HTML : '—') : fmtPx(m.price, sym);
  // v204: שתי שורות עצמאיות ליד הלוגו — שורה 1: סימבול + תגית המקור + מחיר; שורה 2: שם החברה + בועת הסשן.
  // כך הבועה מתחרה רק עם שם החברה (שנקטע ב־…) ולא עם הסימבול/התגית — תמיד שתי שורות, בלי התנגשות.
  return '<span class="stock-id">' + stockLogoHTML(sym) +
    '<span class="sh-r1"><span class="stock-sym"><bdi dir="ltr">' + esc(sym) + '</bdi></span>' + srcTagHTML(positionSource(p)) +
    '<span class="stock-price' + stockPriceSizeCls(priceTxt) + '" data-px="' + (m.price === null ? '' : m.price) + '">' + priceTxt + '</span></span>' +
    '<span class="sh-r2"><span class="stock-name">' + esc(companyName(p.sym, p.name) || p.name) + '</span>' + // v201: שם החברה, לא הסימבול פעמיים
    '<span class="stock-ext">' + extSessionHTML(m.q, m) + '</span></span></span>' +
    '<span class="stock-sub">' + stockSubHTML(p, m) + '</span>';
}
function buildStockCard(p) {
  const sym = p.sym;
  const m = metrics(sym);

  const card = el('div', 'stock' + (state.open[sym] ? ' open' : ''));
  card.dataset.sym = sym;
  const head = el('button', 'stock-head');
  head.type = 'button';
  head.innerHTML = stockHeadHTML(p, m);
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

/* v193: אריחי הכרטיס הפתוח (כמות, ממוצע, שווי, רווח, משקל, ATH) — משותף לבנייה ולעדכון החי */
function kvGridHTML(p, m) {
  const sym = p.sym;
  const cur = state.currency;
  const toCur = (usd) => (usd === null ? null : (cur === 'ILS' && state.fx ? usd * state.fx : usd));
  return kvHTML(t('kvShares'), p.shares.toLocaleString('en-US')) +
    kvHTML(t('kvAvg'), fmtPx(p.avg, sym)) +
    kvHTML(t('kvValue'), m.value === null ? '—' : money(toCur(m.value), cur)) +
    kvHTML(t('kvGL'),
      m.gl === null ? '—' : fmtSignedMoney(toCur(m.gl), cur) +
        ' (' + fmtPct(p.avg > 0 ? (m.price / p.avg - 1) * 100 : null, true) + ')',
      m.gl === null ? '' : m.gl >= 0 ? 'pos' : 'neg') +
    kvHTML(t('kvWeight'), weightTxt(sym)) +
    (p.fromTrades ? (() => {
      const rz = mtPosition(mtList(), sym).realized;
      const rzU = nativeToUSD(rz, sym);
      return rzU !== null && Math.abs(rz) > 0.005 ? kvHTML(t('kvRealized'), fmtSignedMoney(toCur(rzU), cur), rz >= 0 ? 'pos' : 'neg') : '';
    })() : '') +
    // v102: אריח ATH מינימליסטי — רק מחיר ותאריך, מעט גדולים יותר
    kvHTML('ATH',
      m.ath ? fmtPx(m.ath.price, sym) +
        '<br><span style="font-weight:400;font-size:14px">' + fmtDateIL(m.ath.date) + '</span>'
        : (state.hist[sym] ? '—' : '…'));
}
function buildStockBody(p, m) {
  const sym = p.sym;
  const wrap = el('div', 'stock-body-in'); // v193: עוטף יחיד — הגוף נפתח/נסגר באנימציית גובה (grid-template-rows)

  const grid = el('div', 'kv-grid');
  grid.innerHTML = kvGridHTML(p, m);
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

/* v193: פתיחה/סגירה עם אנימציית גובה (grid 0fr↔1fr) — אבל גוף סגור נשאר display:none (בלי עלות layout ל־10 גופים
   סגורים בכל ציור). המצב 'anim' מחזיק את הגוף מוצג לאורך המעבר; נופל לזמן קצוב אם transitionend לא מגיע. */
function toggleStock(sym, card) {
  state.open[sym] = !state.open[sym];
  const body = card.querySelector && card.querySelector('.stock-body');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!body || reduce || !card.classList) {
    card.classList.toggle('open', state.open[sym]);
    if (state.open[sym]) ensureChartData(sym);
    return;
  }
  clearTimeout(card._animT);
  const done = () => { clearTimeout(card._animT); card.classList.remove('anim'); body.removeEventListener('transitionend', onEnd); };
  const onEnd = (e) => { if (e.target === body) done(); };
  body.addEventListener('transitionend', onEnd);
  card._animT = setTimeout(done, 450);
  if (state.open[sym]) {
    card.classList.add('anim'); // display:grid ב־0fr
    void body.offsetHeight; // נקודת מוצא לפני המעבר
    card.classList.add('open'); // → 1fr
    ensureChartData(sym);
  } else {
    card.classList.add('anim');
    void body.offsetHeight;
    card.classList.remove('open'); // → 0fr, ואז display:none כשנגמר
  }
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
    // v160: אין היסטוריה (המקור חסום כרגע) — אומרים את זה, לא "טוען" לנצח ולא גרף של נקודה אחת.
    // ננסה שוב אוטומטית כש־Yahoo חוזר (yahooRecovered).
    if (!(hist && hist.length) && loading) { loading.textContent = t('histRetryLater'); loading.classList.remove('hidden'); }
    else if (pts && loading) loading.classList.add('hidden');
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
      loading.innerHTML = esc(t('noChartNow')) + (dbg ? '<br><small style="opacity:.65">' + esc(dbg) + '</small>' : '');
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
  let min = Infinity, max = -Infinity;
  for (const p of pts) { if (p.close < min) min = p.close; if (p.close > max) max = p.close; }
  if (min === max) { min *= 0.99; max *= 1.01; }
  // v151: עמודת התוויות ברוחב התווית הארוכה בפועל (54 קבוע חתך "$629.26")
  ctx.font = '12.5px system-ui';
  const fmtAxis = (v) => (symCur(sym) === 'ILS' ? fmtAg(v, sym) : fmtUSD2(v));
  const padL = 6, padR = Math.ceil(Math.max(ctx.measureText(fmtAxis(min)).width, ctx.measureText(fmtAxis(max)).width)) + 12, padT = 10, padB = 36;
  const plotW = w - padL - padR, plotH = h - padT - padB;
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
    ctx.fillText(symCur(sym) === 'ILS' ? fmtAg(v, sym) : fmtUSD2(v), w - padR + 6, y);
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
  if (canvas.classList) canvas.classList.add('drawn'); // v193
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
  if (amt > 0) return '<span class="r-amt in" title="' + t('adjTitle') + '">−₪' + amt.toLocaleString('en-US') + '</span>'; // v151: משיכה — מינוס אפור, לא ירוק
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

function buildTradeRow(tr, src) {
  const d = tradeRowData(tr);
  const li = el('li');
  const main = el('span');
  main.innerHTML = '<span class="r-date">' + esc(fmtDateIL(d.date)) + '</span> ' +
    '<span class="side-chip ' + (d.isBuy ? 'buy' : 'sell') + '">' +
    esc(d.isBuy ? t('buySide') : t('sellSide')) + '</span>' + (src ? srcTagHTML(src) : '') + '<br>' +
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
  if (!tabShouldRender('trades')) return; // v193
  list.innerHTML = '';
  renderSrcFilter('trades');
  const sf = getSrcFilter('trades');
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
    .filter((r) => srcPass(sf, r.mt ? 'manual' : 'ibkr'))
    .sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : 0));
  if (!rows.length) list.appendChild(el('p', 'fine', t('srcFilterEmpty')));
  for (const r of rows) list.appendChild(r.mt ? buildManualTradeRow(r.mt, edit) : buildTradeRow(r.ib, 'ibkr'));
}

function renderDeposits() {
  if (!tabShouldRender('deposits')) return; // v193
  // v145: במצב IBKR — גם כסף שנכנס מחוץ ל־IBKR דרך קניות ידניות (סה"כ = IBKR + ידני)
  const mf = isIbkrMode()
    ? manualFlowsILS(POSITIONS, mtActiveTrades(), (iso) => fxOnOrBefore(iso), state.fx) : null;
  const hasMf = !!(mf && (mf.rows.length || mf.avgRows.length));
  if (hasMf && !fxHistCache && mf.rows.some((r) => symCur(r.sym) !== 'ILS') && !state._depFxLoading) {
    state._depFxLoading = true; // שער יום העסקה — נטען פעם אחת ומצייר שוב
    ensureFxHist().then(() => renderDeposits()).catch(() => null);
  }
  const nd = netDepositsILS() + (hasMf ? mf.inILS : 0);
  const ndTxt = ltrNum((nd < 0 ? '−' : '') + '₪' + Math.abs(Math.round(nd * 100) / 100).toLocaleString('en-US'));
  document.getElementById('depTotal').textContent = ndTxt;
  document.getElementById('depCount').textContent = t('records', { n: DEPOSITS.length }) +
    (hasMf ? ' · ' + t('depInclManual', { amt: ltrNum((mf.inILS < 0 ? '−' : '') + '₪' + Math.abs(mf.inILS).toLocaleString('en-US')) }) : '');
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
  renderSrcFilter('deposits');
  const sf = getSrcFilter('deposits');
  const shown = depositsNewestFirst(DEPOSITS).filter((x) => srcPass(sf, isIbkrDeposit(x.d) ? 'ibkr' : 'manual'));
  shown.forEach((x) => ul.appendChild(buildDepositRow(x.d, x.i, ed)));
  if (!shown.length && DEPOSITS.length && !(hasMf && srcPass(sf, 'manual'))) ul.appendChild(el('p', 'fine', t('srcFilterEmpty')));
  if (hasMf && srcPass(sf, 'manual')) {
    const head = el('li', 'dep-sub');
    head.innerHTML = '<span><b>' + esc(t('depManualTitle')) + '</b><br><span class="r-note">' +
      esc(t('depManualNote')) + '</span></span>';
    ul.appendChild(head);
    const side = (s) => (s === 'SELL' ? t('sellSide') : t('buySide'));
    for (const r of mf.rows) {
      const li = el('li');
      li.innerHTML = '<span><span class="r-date">' + fmtDateIL(r.date) + '</span> ' +
        srcTagHTML('manual') + '<br><span class="r-note">' + esc(r.sym) + ' · ' + esc(side(r.side)) +
        ' ' + r.qty + ' × ' + esc(fmtPx(r.price, r.sym)) + '</span></span>' +
        '<span>' + depositAmountHTML(r.amount) + '</span>';
      ul.appendChild(li);
    }
    for (const r of mf.avgRows) {
      const li = el('li');
      li.innerHTML = '<span><span class="r-date">' + esc(t('depManualAvg')) + '</span> ' +
        srcTagHTML('manual') + '<br><span class="r-note">' + esc(r.sym) + ' · ' + r.qty + ' × ' +
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
  const dTxt = /^\d{4}-\d{2}-\d{2}$/.test(String(d.date || '')) ? fmtDateIL(d.date) : String(d.date || '');
  main.innerHTML = '<span class="r-date">' + esc(dTxt) + '</span> ' + srcTagHTML(isIbkrDeposit(d) ? 'ibkr' : 'manual') +
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
    '<label>' + t('fldDate') + '<input id="' + idp + '-date" type="date" lang="he-IL" value="' + dateToInput(d.date) + '"></label>' +
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
  if (!tabShouldRender('pension')) return; // v193
  const cur = state.currency;
  const wrap = document.getElementById('pensionCards');
  wrap.innerHTML = '';
  for (const f of PENSION_FUNDS) {
    // v151: קרן בשקלים לא מוצגת $0 במצב דולרים — המרה לפי השער, כמו הסך
    const v = cur === 'ILS' ? (num(f.ils) || 0) + (state.fx ? (num(f.usd) || 0) * state.fx : 0) : (num(f.usd) || 0) + (state.fx ? (num(f.ils) || 0) / state.fx : 0);
    const card = el('div', 'card stat',
      '<div class="stat-label">' + esc(f.name) + '</div>' +
      '<div class="stat-value">' + money(v, cur) + '</div>');
    wrap.appendChild(card);
  }
  const tu = PENSION_FUNDS.reduce((a, f) => a + (num(f.usd) || 0), 0);
  const ti = PENSION_FUNDS.reduce((a, f) => a + (num(f.ils) || 0), 0);
  // v151: הסך כולל את שני המטבעות לפי השער (קרן בשקלים לא נעלמת במצב דולרים)
  const totCur = cur === 'ILS' ? ti + (state.fx ? tu * state.fx : 0) : tu + (state.fx ? ti / state.fx : 0);
  document.getElementById('pensionTotal').textContent = money(totCur, cur);

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
    '<span><b>' + esc(r.place) + '</b> ' + srcTagHTML('manual') + '<br><span class="r-date">' + esc(r.period) + '</span>' + kindTag +
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

function renderAll(opts) {
  _renderForce = !!(opts && opts.all); // v193: {all:true} = גם טאבים מוסתרים (למשל החלפת שפה)
  try { renderAllInner(); } finally { _renderForce = false; }
}
function renderAllInner() {
  // v141: מניה שנוספה ביד במצב IBKR (לפני v141) מסומנת ידנית — נכללת בחישובים ונשמרת בסנכרון
  try { if (markManualPositions()) saveDB(); } catch (e) {}
  // v157: מחירי ת"א שהוזנו באגורות לפני v157 — מתוקנים פעם אחת כשיש מחיר חי
  try {
    if (!isDemoMode()) {
      const fixed = fixAgorotEntries({ positions: POSITIONS, manualTrades: mtList() }, (sym) => (state.quotes[sym] ? state.quotes[sym].close : null));
      if (fixed) { mtSyncPositions(); saveDB(); flash(t('agorotFixed', { n: fixed })); }
    }
  } catch (e) {}
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
    if (h) {
      if (!h.querySelector('.face-main')) h.innerHTML = btnFacesHTML('', '');
      h.querySelector('.face-main').textContent = lbl;
      renderThemeToggle();
    }
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
  if (curToggle) curToggle.addEventListener('click', (e) => {
    // v154: תפריט פתוח → הכפתור הוא מתג בהיר/כהה (התפריט נשאר פתוח)
    if (mainMenuOpen()) { e.stopPropagation(); setThemeMode(resolveTheme() === 'dark' ? 'light' : 'dark'); return; }
    setCur(state.currency === 'ILS' ? 'USD' : 'ILS');
  });
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
  // v153: הדפדפן לא משחזר גלילה בעצמו — אנחנו עושים את זה לפי טאב, אחרי שהתוכן נטען
  try { if ('scrollRestoration' in history) history.scrollRestoration = 'manual'; } catch (e) {}
  // v85: שחזור הטאב האחרון אחרי רענון (לפני בדיקת המפתח — אם אין מפתח, הגדרות גובר)
  try {
    const lastTab = localStorage.getItem('pwa_lasttab_v1');
    if (lastTab && document.getElementById('tab-' + lastTab)) {
      switchTab(lastTab);
    }
  } catch (e) {}
  // v153: לא מעבירים להגדרות כשאין מפתח Twelve Data — הוא רק גיבוי אחרון (Yahoo הוא המקור
  // הראשי), ומ־v148 הוא לא נטען מהענן, אז כל רענון נחת בהגדרות.
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
      try { localStorage.removeItem(LS_TDKEY); } catch (e) {} // איפוס מלא = כל מה שבטלפון
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

  // v193: מציירים מיד מהנתונים שבטלפון ומתחילים למשוך מחירים — לא מחכים ל־Firebase (SDK + התחברות + Firestore, ~1–2 שניות).
  // כשהענן עונה: אם הנתונים זהים — כלום; אם השתנו — ציור מחדש ומחירים למניות החדשות.
  let appStarted = false, bootSig = '';
  const dbSig = () => { try { return JSON.stringify(DB); } catch (e) { return String(Math.random()); } };
  const startApp = () => {
    if (appStarted) {
      if (dbSig() === bootSig) return;
      bootSig = dbSig();
      renderAll();
      refreshQuotes().then(() => { warmHistories(); });
      return;
    }
    appStarted = true;
    bootSig = dbSig();
    renderAll();
    requestAnimationFrame(() => { try { positionTabIndicator(); } catch (e) {} });
    refreshQuotes().then(() => { warmHistories(); liveStart(); });
    refreshEarnings().then(() => { renderOverview(); renderWishlist(); });
  };
  /* v193: ציור מיידי מהנתונים המקומיים; הענן מאשר אחר כך (startApp עמיד — מצייר שוב רק אם הנתונים השתנו).
     יוצא מן הכלל: אין כלום באחסון המקומי אבל במכשיר הזה יש משתמש ענן מחובר (pwa_cloud_user_v1) —
     אז מחכים לענן (עד 6 שניות) כדי לא להבהב "תיק ריק" לפני שהנתונים מגיעים. */
  let waitCloud = false;
  try { waitCloud = !localStorage.getItem(LS_DB) && localStorage.getItem('pwa_cloud_user_v1') === '1' && !!(window.Cloud && window.Cloud.isConfigured && window.Cloud.isConfigured()); } catch (e) { waitCloud = false; }
  if (!waitCloud) startApp();
  else setTimeout(startApp, 6000);
  if (window.Cloud && window.Cloud.boot) window.Cloud.boot(startApp);
  window.addEventListener('resize', () => { try { positionTabIndicator(); } catch (e) {} });
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
    try { langBtn.innerHTML = btnFacesHTML(ICON_GLOBE, ICON_GEAR); } catch (e) {}
  }
  const closeLangMenu = () => { if (langMenu) langMenu.classList.add('hidden'); };
  if (langBtn && langMenu) {
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      // v154: תפריט פתוח → הגלובוס הוא כפתור "הגדרות"
      if (mainMenuOpen()) {
        setMainMenuOpen(false);
        switchTab('settings');
        cancelScrollRestore();
        try { window.scrollTo(0, 0); } catch (err) {}
        return;
      }
      setMainMenuOpen(false);
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

/* v154: כשההמבורגר פתוח, שני הכפתורים שלידו מתחלפים באנימציה — גלובוס → הגדרות,
   מטבע → בהיר/כהה, והמבורגר → ✕. בסגירה הם חוזרים. הכפתורים הכפולים הוסרו מהתפריט. */
function btnFacesHTML(main, alt) {
  return '<span class="face face-main">' + main + '</span><span class="face face-alt" aria-hidden="true">' + alt + '</span>';
}
function mainMenuOpen() {
  const d = document.getElementById('menuDrop');
  return !!d && !d.classList.contains('hidden');
}
function setMainMenuOpen(open) {
  const d = document.getElementById('menuDrop');
  const btn = document.getElementById('menuBtn');
  if (!d || !btn) return;
  d.classList.toggle('hidden', !open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  const acts = document.querySelector('.appbar-actions');
  if (acts) acts.classList.toggle('menu-open', open);
  const lang = document.getElementById('langBtn');
  const cur = document.getElementById('curToggleBtn');
  if (lang) lang.setAttribute('aria-label', open ? t('menuSettings') : t('langAria'));
  if (cur) cur.setAttribute('aria-label', open ? t('menuThemeAria') : t('curToggleAria'));
  btn.setAttribute('aria-label', open ? t('menuCloseAria') : t('menuAria'));
  if (open) { const lm = document.getElementById('langMenu'); if (lm) lm.classList.add('hidden'); }
}

function initMainMenu() {
  const btn = document.getElementById('menuBtn');
  const drop = document.getElementById('menuDrop');
  if (!btn || !drop) return;
  btn.innerHTML = btnFacesHTML(ICON_MENU, ICON_CLOSE);
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    setMainMenuOpen(!mainMenuOpen());
  });
  document.addEventListener('click', (e) => {
    if (mainMenuOpen() && !e.target.closest('.menu-wrap')) setMainMenuOpen(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mainMenuOpen()) setMainMenuOpen(false);
  });
  renderThemeToggle();
}
