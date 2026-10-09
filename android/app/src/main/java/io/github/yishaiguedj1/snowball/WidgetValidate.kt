package io.github.yishaiguedj1.snowball

/**
 * שלב 4 (אבטחה): בדיקת מה שמגיע ל־WidgetSyncActivity. כל אתר יכול לשלוח intent://widget, ולכן מקבלים רק את
 * הצורה המדויקת שהאפליקציה שולחת (app.js: widgetParam / widgetWatchLists) — שום דבר אחר לא נשמר ולא מוצג.
 * בלי תלות באנדרואיד (נבדק עם kotlinc לבד).
 *   פריט: SYM~src~name[~logo], ‏src = i | m | w, ‏SYM כמו בשרתון (גם ^ למדד, ‎.TA, ‏=F, ‏-USD), שם עד 40 תווים, לוגו — מזהה TradingView
 *   רשימת מעקב: i (מזהה, עד 24 תווים), n (שם, עד 30), s (פריטים כמו למעלה, עד 30)
 */
object WidgetValidate {
    private val SYM = Regex("^\\^?[A-Za-z0-9][A-Za-z0-9.=\\-]{0,19}$")
    private val LOGO = Regex("^[a-z0-9][a-z0-9-]{0,59}$")
    private val LIST_ID = Regex("^[A-Za-z0-9_-]{1,24}$")
    const val MAX_ITEMS = 60
    const val MAX_WATCH_ITEMS = 30
    const val MAX_LISTS = 20

    /** טקסט להצגה: בלי תווי בקרה, בלי < > " ~ , (מפרידים), עד max תווים */
    fun cleanText(t: String, max: Int): Boolean =
        t.length <= max && t.none { it.isISOControl() || it == '<' || it == '>' || it == '"' || it == '~' || it == ',' || it == '‮' || it == '‭' }

    fun item(x: String): Boolean {
        val p = x.split('~')
        if (p.size < 3 || p.size > 4) return false
        if (!SYM.matches(p[0]) || p[1] !in setOf("i", "m", "w")) return false
        if (!cleanText(p[2], 40)) return false
        return p.size == 3 || p[3].isEmpty() || LOGO.matches(p[3])
    }

    fun items(s: String, max: Int = MAX_ITEMS): Boolean {
        if (s.isEmpty()) return true
        if (s.length > 4000) return false
        val all = s.split(',')
        return all.size <= max && all.all { item(it) }
    }

    fun list(id: String, name: String, s: String): Boolean =
        LIST_ID.matches(id) && cleanText(name, 30) && s.isNotEmpty() && items(s, MAX_WATCH_ITEMS)
}
