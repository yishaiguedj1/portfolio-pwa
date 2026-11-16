/* נתוני הייחוס של תיק אקמן (16/11/2026) — מה שלא נגזר אוטומטית מה־13F: פעולות תאגידיות, אומדנים ידניים ופרמטרים.
   כל שורה עם מקור. פעולה תאגידית שלא מופיעה כאן לא "נעלמת": ההפרש בין שני דיווחי 13F הופך לעסקה נאמדת (מסומנת),
   ולכן השווי בסוף כל רבעון נשאר זהה ל־13F — אבל העלות והרווח הממומש נכונים רק כשהפעולה מוגדרת כאן.
   כל יחס כאן נבדק מול כמויות ה־13F לפני ואחרי (docs/ackman-research.md, "פעולות תאגידיות"). */
'use strict';

/* type: split (ratio = מניות חדשות לכל ישנה) · spinoff (sym נשארת, to חדשה, ratio לכל מניה של sym, px = מחיר החדשה ביום
   הראשון כשאין נתוני מסחר) · merger (sym יוצאת; to × ratio + cash למניה; px = מחיר to כשאין נתונים) */
const ACTIONS = [
  { date: '2008-09-29', type: 'merger', sym: 'WEN-2008', to: 'WEN', ratio: 4.25, src: 'מיזוג Wendy\'s International עם Triarc (Wendy\'s/Arby\'s Group): 4.25 מניות WEN לכל מניה. 13F: ‏13,087,000 → ‏55,619,748' },
  { date: '2011-05-09', type: 'split', sym: 'C', ratio: 0.1, src: 'Citigroup — איחוד מניות 1 ל־10. 13F: ‏146,707,777 → ‏14,670,777 (+קניות)' },
  { date: '2011-10-04', type: 'spinoff', sym: 'FO', to: 'FBIN', ratio: 1, src: 'Fortune Brands חילקה את Fortune Brands Home & Security ‏1:1. 13F ‏31/12/2011: ‏20,818,545 של כל אחת' },
  { date: '2011-10-04', type: 'merger', sym: 'FO', to: 'BEAM', ratio: 1, src: 'Fortune Brands שינתה את שמה ל־Beam Inc. (אותן מניות)' },
  { date: '2012-07-02', type: 'spinoff', sym: 'MATX', to: 'ALEX', ratio: 1, src: 'Alexander & Baldwin (היום Matson) פיצלה את A&B החדשה ‏1:1' },
  { date: '2014-12-12', type: 'merger', sym: 'BKW', to: 'QSR', ratio: 0.99, src: 'Burger King Worldwide → Restaurant Brands International: ‏0.99 מניה + 0.01 יחידת שותפות (מחוץ ל־13F). 13F: ‏38,387,865 → ‏38,003,984' },
  { date: '2015-03-17', type: 'merger', sym: 'AGN-2015', to: 'ACT', ratio: 0.3683, cash: 129.22, src: 'Actavis רכשה את Allergan: ‏129.22$ במזומן + 0.3683 מניית Actavis לכל מניה' },
  { date: '2016-10-03', type: 'spinoff', sym: 'APD', to: 'VSM', ratio: 0.5, px: 22.53, src: 'Air Products פיצלה את Versum Materials, מניה לכל 2. מחיר היום הראשון נגזר ממקדם ההתאמה של Yahoo (‏1.081)' },
  { date: '2024-06-26', type: 'split', sym: 'CMG', ratio: 50, src: 'Chipotle — ספליט 50:1' },
  { date: '2024-08-01', type: 'spinoff', sym: 'HHH', to: 'SEG', ratio: 1 / 9, src: 'Howard Hughes פיצלה את Seaport Entertainment, מניה לכל 9. 13F: ‏18,852,064 HHH → ‏2,094,673 SEG' },
  { date: '2025-10-10', type: 'split', sym: 'BN', ratio: 1.5, src: 'Brookfield Corp — ספליט 3:2' },
];

/* עסקאות ידניות (אומדן מתועד) — אירוע שאין לו מחיר מסחר בנתונים */
const MANUAL = [
  { date: '2016-10-03', sym: 'VSM', qty: -2012570, price: 22.53, est: true, src: 'אומדן', note: 'מניות Versum שהתקבלו בספינאוף נמכרו ברבעון 4 2016 (לא מופיעות ב־13F) — מחיר היום הראשון' },
];

/* מחיר ידני למניה בלי נתוני מסחר (מעבר למחירים המשתמעים מה־13F) */
const MARKS = { VSM: [['2016-10-03', 22.53]] };

/* מדינת המנפיק לצורך מס במקור על דיבידנדים (ברירת מחדל US) */
const COUNTRY = { CP: 'CA', QSR: 'CA', BN: 'CA', BHC: 'CA', CSG: 'GB', CBY: 'GB', GLRE: 'KY', ACT: 'IE', NOMD: 'VG' };

/* פרמטרים: dailyFrom — מאז כל המניות בתיק עם נתוני מסחר יומיים; עמלה — אומדן מוסדי לכל מניה;
   מס במקור — שיעור משוקלל לפי חלק הקרנות הזרות (PSH בגרנזי, PS International בקיימן: 30% על דיבידנד אמריקאי;
   PS L.P. ו־PSUS האמריקאיות: 0%; דיבידנד קנדי: 25% לזרות, 15% לאמריקאיות). עד הכיול מול הדוחות של PSH — אומדן. */
const PARAMS = {
  dailyFrom: '2015-06-30',
  commission: { perShare: 0.01 },
  wht: {
    US: [[2004, 0.12], [2013, 0.18], [2015, 0.21], [2021, 0.25], [2026, 0.20]],
    CA: [[2004, 0.19], [2013, 0.21], [2015, 0.22], [2021, 0.24], [2026, 0.22]],
    GB: [[2004, 0]], KY: [[2004, 0]], IE: [[2004, 0]], VG: [[2004, 0]],
  },
  fees: [],
};

module.exports = { ACTIONS, MANUAL, MARKS, COUNTRY, PARAMS };
