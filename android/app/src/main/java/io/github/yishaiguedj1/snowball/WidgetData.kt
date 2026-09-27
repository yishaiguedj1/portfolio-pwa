package io.github.yishaiguedj1.snowball

/**
 * מה שהווידג'ט מציג — שורה מוכנה לתצוגה (הטקסטים כבר מעוצבים, כמו המודל של השרתון ב־lib/widget-model.js).
 * שלב 2: נתוני דוגמה קבועים (מחירים מתיק הדמו, לא התיק של המשתמש). שלב 3: סנכרון מהאפליקציה + מחירים מהשרתון.
 */
enum class Dir { POS, NEG, FLAT }
enum class Src { IBKR, MANUAL }

data class WidgetRow(
    val sym: String,          // הסימבול (גם לקישור ‎#stock=SYM)
    val disp: String,         // מה שמוצג (בלי .TA)
    val name: String,
    val price: String,
    val chg: String,          // "+$5.15 (+1.53%)" — מבודד LTR בתצוגה
    val dir: Dir,
    val sub: String,          // "אחרי־מסחר" / "סגור · סופ״ש"
    val subPct: String,
    val subDir: Dir,
    val src: Src,
    val logoUrl: String?,
)

data class WidgetHeader(val lines: List<String>, val live: Boolean)

data class WidgetModel(val header: WidgetHeader, val rows: List<WidgetRow>)

object SampleData {
    private const val M = "−" // מינוס אמיתי, כמו באפליקציה
    private fun fmp(s: String) = "https://financialmodelingprep.com/image-stock/$s.png"
    private fun r(sym: String, name: String, price: String, chg: String, dir: Dir, sub: String, subPct: String, subDir: Dir, src: Src = Src.IBKR) =
        WidgetRow(sym, sym.removeSuffix(".TA"), name, price, chg, dir, sub, subPct, subDir, src, fmp(sym))

    fun model(): WidgetModel = WidgetModel(
        WidgetHeader(listOf("השוק סגור · סופ״ש"), live = false),
        listOf(
            r("AAPL", "Apple", "$341.46", "+$5.15 (+1.53%)", Dir.POS, "אחרי־מסחר", "+0.11%", Dir.POS),
            r("AXP", "American Express", "$309.10", "+$3.23 (+1.06%)", Dir.POS, "אחרי־מסחר", "+0.07%", Dir.POS),
            r("BAC", "Bank of America", "$56.75", "+$0.67 (+1.20%)", Dir.POS, "אחרי־מסחר", "+0.08%", Dir.POS),
            r("KO", "Coca-Cola", "$87.66", "${M}$0.29 (${M}0.33%)", Dir.NEG, "אחרי־מסחר", "${M}0.17%", Dir.NEG),
            r("CVX", "Chevron", "$204.00", "${M}$1.20 (${M}0.58%)", Dir.NEG, "אחרי־מסחר", "${M}0.22%", Dir.NEG),
            r("OXY", "Occidental Petroleum", "$56.82", "${M}$1.19 (${M}2.05%)", Dir.NEG, "אחרי־מסחר", "${M}0.07%", Dir.NEG, Src.MANUAL),
            r("MCO", "Moody's", "$469.23", "+$1.35 (+0.29%)", Dir.POS, "אחרי־מסחר", "+0.11%", Dir.POS),
            r("UNH", "UnitedHealth", "$351.20", "${M}$2.44 (${M}0.69%)", Dir.NEG, "אחרי־מסחר", "+0.04%", Dir.POS),
            r("BRK-B", "Berkshire Hathaway", "$505.56", "+$0.30 (+0.06%)", Dir.POS, "אחרי־מסחר", "+0.02%", Dir.POS),
        ),
    )
}
