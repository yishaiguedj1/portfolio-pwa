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
// imp = יובאה מ־Chrome (התיקייה "מיובאות מ־Chrome"); x = מתי יצאה ל־Chrome בקובץ (0 = עוד לא) — BrSync.toExport
// sid = המזהה בסנכרון עם Chrome (n… = הסימנייה ב־Chrome, a… = נשמרה כאן ועוד לא הגיעה) — BrChrome
// f = התיקייה כמו ב־Chrome: "b/Learning/x" (b סרגל, o אחרות, m נייד); ריק = נשמרה כאן (בנייד) — BrSync.folderOf
data class BrMark(val url: String, val title: String, val at: Long, val imp: Boolean = false, val x: Long = 0L, val sid: String = "", val f: String = "")
data class BrTabRec(val url: String, val title: String)

object BrStore {
    private const val HISTORY_MAX = 5000
    private lateinit var dir: File
    private val ui = Handler(Looper.getMainLooper())
    val history = ArrayList<BrVisit>()   // מהישן לחדש
    val marks = ArrayList<BrMark>()       // מהחדש לישן
    /** סימניות שמחקת כאן (לפי BrSync.key) — ייבוא מ־Chrome לא מחזיר אותן. עד GONE_MAX, הישנות יוצאות */
    private val gone = LinkedHashSet<String>()
    private const val GONE_MAX = 3000
    private var dirty = false
    /** הסנכרון עם Chrome (BrChrome) מקשיב: סימנייה נוספה / נמחקה, וביקור — רק מה שקרה כאן, לא מה שהגיע מ־Chrome */
    var onMark: ((add: Boolean, m: BrMark) -> Unit)? = null
    var onVisit: ((BrVisit) -> Unit)? = null

    fun init(ctx: Context) {
        if (::dir.isInitialized) return
        dir = BrUsers.dir(ctx)   // לכל משתמש בדפדפן — תיקייה משלו (הראשי: filesDir/br)
        read("history.json")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { history.add(BrVisit(it.optString("u"), it.optString("t"), it.optLong("a"))) } }
        read("marks.json")?.let { a -> for (i in 0 until a.length()) a.optJSONObject(i)?.let { marks.add(BrMark(it.optString("u"), it.optString("t"), it.optLong("a"), it.optBoolean("i"), it.optLong("x"), it.optString("s"), it.optString("f"))) } }
        read("gone.json")?.let { a -> for (i in 0 until a.length()) a.optString(i).takeIf { it.isNotEmpty() }?.let { gone.add(it) } }
    }

    private fun read(name: String): JSONArray? = try { File(dir, name).takeIf { it.exists() }?.readText()?.let { JSONArray(it) } } catch (e: Exception) { null }

    private fun write(name: String, a: JSONArray) {
        try {
            val tmp = File(dir, "$name.tmp"); tmp.writeText(a.toString())
            if (!tmp.renameTo(File(dir, name))) { File(dir, name).delete(); tmp.renameTo(File(dir, name)) }
        } catch (e: Exception) {}
    }

    /** שמירה מרוכזת — לא בכל טעינת דף */
    /** עולה בכל שינוי — הסנכרון בענן מחשב את התמונה של הסימניות/ההיסטוריה מחדש רק כשהיא השתנתה */
    var rev = 0L; private set

    private fun later() {
        rev++
        if (dirty) return
        dirty = true
        ui.postDelayed({ dirty = false; saveNow() }, 1500)
    }

    fun saveNow() {
        rev++
        if (!::dir.isInitialized) return
        write("history.json", JSONArray().apply { history.forEach { put(JSONObject().put("u", it.url).put("t", it.title).put("a", it.at)) } })
        write("marks.json", JSONArray().apply { marks.forEach { put(JSONObject().put("u", it.url).put("t", it.title).put("a", it.at).apply { if (it.imp) put("i", true); if (it.x > 0) put("x", it.x); if (it.sid.isNotEmpty()) put("s", it.sid); if (it.f.isNotEmpty()) put("f", it.f) }) } })
        write("gone.json", JSONArray().apply { gone.forEach { put(it) } })
    }

    fun visit(url: String, title: String) {
        if (!url.startsWith("http")) return
        val last = history.lastOrNull()
        if (last != null && last.url == url) { if (title.isNotEmpty() && title != last.title) history[history.size - 1] = last.copy(title = title) }
        else BrVisit(url, title, System.currentTimeMillis()).let { history.add(it); onVisit?.invoke(it) }
        while (history.size > HISTORY_MAX) history.removeAt(0)
        later()
    }

    fun setTitle(url: String, title: String) {
        if (title.isEmpty()) return
        for (i in history.indices.reversed().take(20)) if (history[i].url == url) { history[i] = history[i].copy(title = title); later(); break }
    }

    fun removeVisit(v: BrVisit) { history.remove(v); histDel += BrSync.visitKey(v.url, v.at); later() }
    fun clearHistory() { history.forEach { histDel += BrSync.visitKey(it.url, it.at) }; history.clear(); later() }

    /* ---------- הסנכרון בענן (BrCloud) ---------- */

    /** ביקורים שמחקת (לא ביקורים שיצאו בגלל התקרה) — הסנכרון בענן הופך אותם למחיקה בכל המכשירים */
    private val histDel = HashSet<String>()
    fun takeHistDeleted(): Set<String> { val s = HashSet(histDel); histDel.clear(); return s }

    /** הסימניות אחרי מיזוג מהענן. הגשר ל־Chrome (onMark) שומע רק את מה שבאמת השתנה */
    fun applyCloudMarks(list: List<BrMark>) {
        val before = marks.associateBy { BrSync.key(it.url) }
        val after = list.associateBy { BrSync.key(it.url) }
        marks.clear(); marks.addAll(list)
        for ((k, m) in after) if (k !in before) { gone.remove(k); onMark?.invoke(true, m) }
        for ((k, m) in before) if (k !in after) { onMark?.invoke(false, m); gone.add(k) }
        while (gone.size > GONE_MAX) gone.remove(gone.first())
        saveNow()
    }

    /** ההיסטוריה אחרי מיזוג מהענן — לפי הזמן, והחדשים נשארים כשעוברים את התקרה */
    fun applyCloudHistory(list: List<BrVisit>) {
        history.clear(); history.addAll(list.sortedBy { it.at })
        while (history.size > HISTORY_MAX) history.removeAt(0)
        saveNow()
    }

    /** אותה סימנייה גם בכתובת שנכתבה אחרת (www, "/" בסוף, utm…) — BrSync.key */
    private fun markOf(url: String): BrMark? { val k = BrSync.key(url); return marks.firstOrNull { it.url == url || BrSync.key(it.url) == k } }
    fun isMarked(url: String) = markOf(url) != null
    fun toggleMark(url: String, title: String): Boolean {
        val m = markOf(url)
        if (m != null) forget(m) else {
            gone.remove(BrSync.key(url))
            val n = BrMark(url, title.ifEmpty { hostOf(url) }, System.currentTimeMillis())
            marks.add(0, n); onMark?.invoke(true, n)
        }
        later()
        return m == null
    }
    fun removeMark(m: BrMark) { forget(m); later() }
    private fun forget(m: BrMark) {
        marks.remove(m); onMark?.invoke(false, m)
        gone.remove(BrSync.key(m.url)); gone.add(BrSync.key(m.url))
        while (gone.size > GONE_MAX) gone.remove(gone.first())
    }

    /** הסימניות אחרי סנכרון עם Chrome (BrSync.applyState) — מחליף את הרשימה כולה */
    fun replaceMarks(list: List<BrMark>) { marks.clear(); marks.addAll(list); saveNow() }

    /** ביקורים מ־Chrome (state.json של התוסף) — רק מה שעוד אין */
    fun addVisits(items: List<BrImport.Item>): Int {
        val nv = BrSync.planVisits(history, items)
        if (nv.isEmpty()) return 0
        history.addAll(nv); history.sortBy { it.at }
        while (history.size > HISTORY_MAX) history.removeAt(0)
        later()
        return nv.size
    }

    class ImportStat(val marks: Int, val visits: Int, val known: Int)

    /** ייבוא מ־Chrome (BrImport): רק מה שחדש — BrSync.planMarks/planVisits (בלי כפולים גם בכתובת שנכתבה אחרת, ובלי
     *  מה שמחקת כאן). הביקורים ממוזגים לפי הזמן, והחדשים נשארים כשעוברים את התקרה */
    fun importAll(r: BrImport.Result): ImportStat {
        val now = System.currentTimeMillis()
        val pm = BrSync.planMarks(marks, r.marks, gone, now)
        marks.addAll(pm.add)
        val nv = BrSync.planVisits(history, r.visits)
        if (nv.isNotEmpty()) {
            history.addAll(nv); history.sortBy { it.at }
            while (history.size > HISTORY_MAX) history.removeAt(0)
        }
        if (pm.add.isNotEmpty() || nv.isNotEmpty()) saveNow()
        return ImportStat(pm.add.size, nv.size, pm.known + pm.gone + (r.visits.size - nv.size))
    }

    /** ייצוא ל־Chrome (26/10/2026, בקשת המשתמש: "שגם Chrome יתעדכן ממנו"): Chrome Sync סגור לאפליקציות אחרות, אז
     *  הסימניות יוצאות בפורמט הקובץ של הדפדפנים — "ייבוא סימניות" של Chrome קורא אותו. רק מה ש־Chrome עוד לא קיבל */
    fun exportList(all: Boolean) = BrSync.toExport(marks, all)
    fun anyExported() = marks.any { it.x > 0 }

    /** אחרי שהקובץ נשמר — מסמנים שיצאו, כדי שהקובץ הבא לא יכיל אותן שוב */
    fun markExported(list: List<BrMark>) {
        val now = System.currentTimeMillis()
        val ks = list.mapTo(HashSet()) { BrSync.key(it.url) }
        for (i in marks.indices) if (!marks[i].imp && BrSync.key(marks[i].url) in ks) marks[i] = marks[i].copy(x = now)
        saveNow()
    }

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
    private val sp = BrUsers.prefs(ctx, "br")
    var engine: String get() = sp.getString("eng", "google") ?: "google"; set(v) { sp.edit().putString("eng", v).apply() }
    var barBottom: Boolean get() = sp.getBoolean("bottom", false); set(v) { sp.edit().putBoolean("bottom", v).apply() }
    var homeBtn: Boolean get() = sp.getBoolean("home", false); set(v) { sp.edit().putBoolean("home", v).apply() }
    // בועת ההורדה על הנגן: פועלת, וכמה פעמים הוצגה התווית שלידה
    var bubble: Boolean get() = sp.getBoolean("bub", true); set(v) { sp.edit().putBoolean("bub", v).apply() }
    var bubHints: Int get() = sp.getInt("bubH", 0); set(v) { sp.edit().putInt("bubH", v).apply() }
    // הצעות חיפוש תוך כדי הקלדה (כמו Chrome — מה שמקלידים נשלח למנוע החיפוש שנבחר), גודל הטקסט בדפים (%)
    var suggest: Boolean get() = sp.getBoolean("sug", true); set(v) { sp.edit().putBoolean("sug", v).apply() }
    var zoom: Int get() = sp.getInt("zoom", 100); set(v) { sp.edit().putInt("zoom", v).apply() }
    /** הייבוא האחרון מ־Chrome: "סימניות,ביקורים,זמן" — לשורת התוצאה במסך הייבוא */
    var lastImport: String get() = sp.getString("imp", "") ?: ""; set(v) { sp.edit().putString("imp", v).apply() }
    // שלב 3 (26/10): חסימת פרסומות ומעקב, הודעות עוגיות, נעילת הטאבים הפרטיים, ניגון ברקע ותמונה בתוך תמונה
    var shield: Boolean get() = sp.getBoolean("shield", true); set(v) { sp.edit().putBoolean("shield", v).apply() }
    var cookies: Boolean get() = sp.getBoolean("ck", true); set(v) { sp.edit().putBoolean("ck", v).apply() }
    var lockPriv: Boolean get() = sp.getBoolean("lockP", false); set(v) { sp.edit().putBoolean("lockP", v).apply() }
    var bgPlay: Boolean get() = sp.getBoolean("bgPlay", true); set(v) { sp.edit().putBoolean("bgPlay", v).apply() }
    var pip: Boolean get() = sp.getBoolean("pip", true); set(v) { sp.edit().putBoolean("pip", v).apply() }
    /** ההגדרות לכל אתר — BrShield.encode/decode */
    var sites: String get() = sp.getString("sites", "") ?: ""; set(v) { sp.edit().putString("sites", v).apply() }
    /** כמה בקשות נחסמו מאז ההתקנה — למסך הפרטיות */
    var blockedAll: Long get() = sp.getLong("blk", 0L); set(v) { sp.edit().putLong("blk", v).apply() }
}
