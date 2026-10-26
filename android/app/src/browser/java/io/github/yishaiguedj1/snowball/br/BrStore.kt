package io.github.yishaiguedj1.snowball.br

import android.content.Context
import android.net.Uri
import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Studio Browser (26/10/2026, בקשת המשתמש: "Chrome אחד לאחד, בגימור של Apple") — מה שנשמר בטלפון: היסטוריה, סימניות
 * והטאבים הפתוחים. קבצי JSON באחסון הפרטי של האפליקציה (filesDir/br), כתיבה אטומית. טאב פרטי — לא נשמר כאן לעולם.
 */
data class BrVisit(val url: String, val title: String, val at: Long)
data class BrMark(val url: String, val title: String, val at: Long)
data class BrTabRec(val url: String, val title: String)

object BrStore {
    private const val HISTORY_MAX = 5000
    private lateinit var dir: File
    private val ui = Handler(Looper.getMainLooper())
    val history = ArrayList<BrVisit>()   // מהישן לחדש
    val marks = ArrayList<BrMark>()       // מהחדש לישן
    private var dirty = false

    fun init(ctx: Context) {
        if (::dir.isInitialized) return
        dir = File(ctx.filesDir, "br").apply { mkdirs() }
        read("history.json")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { history.add(BrVisit(it.optString("u"), it.optString("t"), it.optLong("a"))) } }
        read("marks.json")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { marks.add(BrMark(it.optString("u"), it.optString("t"), it.optLong("a"))) } }
    }

    private fun read(name: String): JSONArray? = try { File(dir, name).takeIf { it.exists() }?.readText()?.let { JSONArray(it) } } catch (e: Exception) { null }

    private fun write(name: String, a: JSONArray) {
        try {
            val tmp = File(dir, "$name.tmp"); tmp.writeText(a.toString())
            if (!tmp.renameTo(File(dir, name))) { File(dir, name).delete(); tmp.renameTo(File(dir, name)) }
        } catch (e: Exception) {}
    }

    /** שמירה מרוכזת — לא בכל טעינת דף */
    private fun later() {
        if (dirty) return
        dirty = true
        ui.postDelayed({ dirty = false; saveNow() }, 1500)
    }

    fun saveNow() {
        if (!::dir.isInitialized) return
        write("history.json", JSONArray().apply { history.forEach { put(JSONObject().put("u", it.url).put("t", it.title).put("a", it.at)) } })
        write("marks.json", JSONArray().apply { marks.forEach { put(JSONObject().put("u", it.url).put("t", it.title).put("a", it.at)) } })
    }

    fun visit(url: String, title: String) {
        if (!url.startsWith("http")) return
        val last = history.lastOrNull()
        if (last != null && last.url == url) { if (title.isNotEmpty() && title != last.title) history[history.size - 1] = last.copy(title = title) }
        else history.add(BrVisit(url, title, System.currentTimeMillis()))
        while (history.size > HISTORY_MAX) history.removeAt(0)
        later()
    }

    fun setTitle(url: String, title: String) {
        if (title.isEmpty()) return
        for (i in history.indices.reversed().take(20)) if (history[i].url == url) { history[i] = history[i].copy(title = title); later(); break }
    }

    fun removeVisit(v: BrVisit) { history.remove(v); later() }
    fun clearHistory() { history.clear(); later() }

    fun isMarked(url: String) = marks.any { it.url == url }
    fun toggleMark(url: String, title: String): Boolean {
        val m = marks.firstOrNull { it.url == url }
        if (m != null) marks.remove(m) else marks.add(0, BrMark(url, title.ifEmpty { hostOf(url) }, System.currentTimeMillis()))
        later()
        return m == null
    }
    fun removeMark(m: BrMark) { marks.remove(m); later() }

    /** הצעות בשורת הכתובת: סימניות קודם, אחר כך היסטוריה לפי כמה פעמים ומתי — כמו Chrome */
    fun suggest(q: String, n: Int = 6): List<BrMark> {
        val t = q.trim().lowercase()
        if (t.isEmpty()) return emptyList()
        fun hit(u: String, ti: String) = u.lowercase().removePrefix("https://").removePrefix("http://").removePrefix("www.").startsWith(t) ||
            ti.lowercase().contains(t) || (t.length >= 3 && u.lowercase().contains(t))
        val out = LinkedHashMap<String, BrMark>()
        for (m in marks) if (hit(m.url, m.title)) out.putIfAbsent(m.url, m)
        val score = HashMap<String, Pair<Int, BrVisit>>()
        for (v in history) if (hit(v.url, v.title)) score[v.url] = ((score[v.url]?.first ?: 0) + 1) to v
        score.values.sortedWith(compareByDescending<Pair<Int, BrVisit>> { it.first }.thenByDescending { it.second.at })
            .forEach { out.putIfAbsent(it.second.url, BrMark(it.second.url, it.second.title, it.second.at)) }
        return out.values.take(n)
    }

    /** קיצורי הדרך בטאב חדש: האתרים שביקרת בהם הכי הרבה (30 יום) */
    fun topSites(n: Int = 8): List<BrMark> {
        val since = System.currentTimeMillis() - 30L * 86400_000
        val cnt = LinkedHashMap<String, Pair<Int, BrVisit>>()
        for (v in history) if (v.at >= since) { val h = hostOf(v.url); if (h.isNotEmpty()) cnt[h] = ((cnt[h]?.first ?: 0) + 1) to v }
        return cnt.entries.sortedByDescending { it.value.first }.take(n).map { (h, p) ->
            val u = Uri.parse(p.second.url)
            BrMark("${u.scheme}://$h/", siteName(h), p.second.at)
        }
    }

    fun saveTabs(tabs: List<BrTabRec>, cur: Int) {
        if (!::dir.isInitialized) return
        write("tabs.json", JSONArray().apply {
            put(JSONObject().put("cur", cur))
            tabs.forEach { put(JSONObject().put("u", it.url).put("t", it.title)) }
        })
    }

    fun loadTabs(): Pair<List<BrTabRec>, Int> {
        val a = read("tabs.json") ?: return emptyList<BrTabRec>() to 0
        val cur = a.optJSONObject(0)?.optInt("cur", 0) ?: 0
        val list = (1 until a.length()).mapNotNull { a.optJSONObject(it) }.map { BrTabRec(it.optString("u"), it.optString("t")) }
        return list to cur.coerceIn(0, (list.size - 1).coerceAtLeast(0))
    }

    fun hostOf(url: String): String = try { Uri.parse(url).host?.lowercase()?.removePrefix("www.") ?: "" } catch (e: Exception) { "" }

    /** "youtube.com" → "YouTube"? לא מנחשים — השם הראשון של הדומיין, באות גדולה */
    fun siteName(host: String): String {
        val parts = host.split('.').filter { it.isNotEmpty() }
        val main = when {
            parts.size >= 3 && parts[parts.size - 2].length <= 3 -> parts[parts.size - 3]   // ynet.co.il → ynet
            parts.size >= 2 -> parts[parts.size - 2]
            else -> host
        }
        return main.replaceFirstChar { it.uppercase() }
    }

    /** מה שהוקלד → כתובת: כתובת מלאה, דומיין, או חיפוש במנוע שנבחר */
    fun toUrl(raw: String, engine: String): String {
        val t = raw.trim()
        if (t.isEmpty()) return ""
        return when {
            Regex("""^https?://""", RegexOption.IGNORE_CASE).containsMatchIn(t) -> t
            !t.contains(' ') && Regex("""^[\w.-]+\.[a-z]{2,}(:\d+)?(/|$)""", RegexOption.IGNORE_CASE).containsMatchIn(t) -> "https://$t"
            else -> searchUrl(engine, t)
        }
    }

    fun searchUrl(engine: String, q: String): String = when (engine) {
        "ddg" -> "https://duckduckgo.com/?q="
        "bing" -> "https://www.bing.com/search?q="
        else -> "https://www.google.com/search?q="
    } + Uri.encode(q)
}

/** ההגדרות של הדפדפן */
class BrPrefs(ctx: Context) {
    private val sp = ctx.getSharedPreferences("br", Context.MODE_PRIVATE)
    var engine: String get() = sp.getString("eng", "google") ?: "google"; set(v) { sp.edit().putString("eng", v).apply() }
    var barBottom: Boolean get() = sp.getBoolean("bottom", false); set(v) { sp.edit().putBoolean("bottom", v).apply() }
    var homeBtn: Boolean get() = sp.getBoolean("home", false); set(v) { sp.edit().putBoolean("home", v).apply() }
}
