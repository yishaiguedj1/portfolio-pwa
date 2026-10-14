package io.github.yishaiguedj1.snowball

import android.content.Context
import org.json.JSONObject

/**
 * מה שהווידג'ט מציג — המודל שהשרתון בונה (`/api/widget?format=json`, lib/widget-model.js): אותו חישוב של
 * השינוי היומי, אחרי־המסחר, האגורות בת״א ולוח החגים כמו בתמונת ה־KWGT ובאפליקציה. הטקסטים מגיעים מוכנים.
 */
enum class Dir { POS, NEG, FLAT }
enum class Src { IBKR, MANUAL, WATCH }

data class WidgetRow(
    val sym: String,          // הסימבול (גם לקישור ‎#stock=SYM)
    val disp: String,         // מה שמוצג (בלי .TA)
    val name: String,
    val price: String,
    val chg: String,
    val dir: Dir,
    val sub: String,          // "אחרי־מסחר" / "סגור · סופ״ש"
    val subPct: String,
    val subDir: Dir,
    val src: Src,
    val logoUrl: String?,
    val active: Boolean,      // המחיר זז עכשיו (מסחר רגיל / טרום / אחרי / לילי) → רענון כל דקה
    val bubble: Bubble?,
)

/** בועת הסשן — זהה לבועה של כרטיס המניה באפליקציה (השרתון בונה אותה: lib/widget-model.js → bubbleOf).
    closed: שתי שורות ("השוק סגור · סיבה" / "אחרי־מסחר +0.11%"); אחרת שורה אחת עם נקודה חיה. */
data class Bubble(val closed: Boolean, val l1: String, val l2: String, val pct: String, val dir: Dir)

/** v249: רשימת מעקב לווידג'ט "רשימות מעקב" — מזהה, שם (הטאב), ופריטים בפורמט של הקישור */
data class WatchList(val id: String, val name: String, val items: String)

data class WidgetHeader(val lines: List<String>, val live: Boolean)

/** v228: בועת שער הדולר בכותרת (במקום בועת מצב השוק) — השרתון מחזיר fx = { v: "3.06", dir, open } */
data class Fx(val value: String, val dir: Dir, val open: Boolean)

data class WidgetModel(val header: WidgetHeader, val rows: List<WidgetRow>, val fx: Fx? = null) {
    companion object {
        private fun dir(s: String?) = when (s) { "pos" -> Dir.POS; "neg" -> Dir.NEG; else -> Dir.FLAT }

        /** JSON של השרתון ({ok, model}) או המודל עצמו → WidgetModel; קלט פגום → null */
        fun parse(json: String?): WidgetModel? = runCatching {
            val root = JSONObject(json ?: return null)
            val m = root.optJSONObject("model") ?: root
            val h = m.getJSONObject("header")
            val lines = h.optJSONArray("lines")
            val header = WidgetHeader(List(lines?.length() ?: 0) { lines!!.optString(it) }.filter { it.isNotEmpty() }, h.optBoolean("live"))
            val cards = m.getJSONArray("cards")
            val rows = List(cards.length()) { i ->
                val c = cards.getJSONObject(i)
                val q = c.optJSONObject("q")
                val session = q?.optString("session") ?: "closed"
                WidgetRow(
                    sym = c.getString("sym"),
                    disp = c.optString("disp", c.getString("sym")),
                    name = c.optString("name"),
                    price = c.optString("price"),
                    chg = c.optString("chg"),
                    dir = dir(c.optString("dir")),
                    sub = c.optString("sub"),
                    subPct = c.optString("subPct"),
                    subDir = dir(c.optString("subDir")),
                    src = when (c.optString("src")) { "ibkr" -> Src.IBKR; "watch" -> Src.WATCH; else -> Src.MANUAL },
                    logoUrl = c.optString("logo").takeIf { it.startsWith("https://") },
                    active = session != "closed" && session.isNotEmpty(),
                    bubble = c.optJSONObject("bubble")?.let { b ->
                        Bubble(b.optBoolean("closed"), b.optString("l1"), b.optString("l2"), b.optString("pct"), dir(b.optString("dir")))
                    },
                )
            }
            val fx = m.optJSONObject("fx")?.let { f ->
                f.optString("v").takeIf { it.isNotEmpty() }?.let { Fx(it, dir(f.optString("dir")), f.optBoolean("open")) }
            }
            WidgetModel(header, rows, fx)
        }.getOrNull()
    }
}

/**
 * מה שנשמר בטלפון: רשימת המניות שהאפליקציה שלחה (סימבול~מקור~שם[~לוגו ת״א] — בלי כמויות/שווי, כמו קישור ה־KWGT),
 * השפה, והמודל האחרון מהשרתון (כדי שהווידג'ט יוצג מיד גם בלי רשת).
 */
object WidgetStore {
    private const val PREFS = "snowball_widget"
    const val PROXY = "https://ibkr-proxy-wine.vercel.app"
    private val ITEMS_RE = Regex("^[^<>\"]{1,3000}$")

    private fun p(c: Context) = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun items(c: Context): String = p(c).getString("s", "") ?: ""
    /** v249: רשימות המעקב (JSON כפי שהאתר שלח — [{i,n,s}]); נשמר כמו שהוא כדי שהחתימה תהיה זהה לאתר */
    fun watch(c: Context): String = p(c).getString("w", "") ?: ""
    fun watchLists(c: Context): List<WatchList> = runCatching {
        val a = org.json.JSONArray(watch(c).ifEmpty { return emptyList() })
        List(a.length()) { i -> a.getJSONObject(i).let { WatchList(it.optString("i"), it.optString("n"), it.optString("s")) } }
            .filter { it.id.isNotEmpty() && it.items.isNotEmpty() }
    }.getOrDefault(emptyList())
    fun watchModel(c: Context, id: String): String? = p(c).getString("wm_" + id, null)
    fun saveWatchModel(c: Context, id: String, json: String) { p(c).edit().putString("wm_" + id, json).apply() }
    fun watchUpdated(c: Context): Long = p(c).getLong("wt", 0L)
    fun saveWatchTime(c: Context, t: Long) { p(c).edit().putLong("wt", t).apply() }
    fun lang(c: Context): String = p(c).getString("l", "he") ?: "he"
    fun model(c: Context): String? = p(c).getString("model", null)
    fun updated(c: Context): Long = p(c).getLong("t", 0L)

    /** מהאפליקציה (snowball://widget?s=…&l=…[&w=…]). מחזיר true אם משהו השתנה. s ריק מותר כשיש רשימות מעקב (v249) */
    fun setItems(c: Context, s: String, l: String, w: String = ""): Boolean {
        if (s.isNotEmpty() && (!ITEMS_RE.matches(s) || !WidgetValidate.items(s))) return false
        // שלב 4: רשימות המעקב — כל רשימה בצורה המדויקת שהאפליקציה שולחת (WidgetValidate), לא רק JSON תקין
        val wOk = w.isEmpty() || (w.length <= 30000 && !w.contains('<') && runCatching {
            val a = org.json.JSONArray(w)
            a.length() <= WidgetValidate.MAX_LISTS && (0 until a.length()).all { k ->
                val o = a.getJSONObject(k)
                WidgetValidate.list(o.optString("i"), o.optString("n"), o.optString("s"))
            }
        }.getOrDefault(false))
        if (!wOk || (s.isEmpty() && w.isEmpty())) return false
        val lang = if (l == "en") "en" else "he"
        if (s == items(c) && lang == lang(c) && w == watch(c)) return false
        val e = p(c).edit().putString("s", s).putString("l", lang).putString("w", w)
        if (s != items(c) || lang != lang(c)) e.remove("model")
        e.apply()
        return true
    }

    fun saveModel(c: Context, json: String, t: Long) { p(c).edit().putString("model", json).putLong("t", t).apply() }

    /** חתימת הרשימה — האפליקציה משווה אליה (‎#app=…) ומסנכרנת רק כשיש הבדל. זהה ל־String.hashCode ב־JS של app.js */
    fun sig(c: Context): String = if (items(c).isEmpty() && watch(c).isEmpty()) "0"
        else (items(c) + "|" + lang(c) + (if (watch(c).isEmpty()) "" else "|" + watch(c))).hashCode().toUInt().toString(36)
}
