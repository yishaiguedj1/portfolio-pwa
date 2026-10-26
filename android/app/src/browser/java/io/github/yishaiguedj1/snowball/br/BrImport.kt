package io.github.yishaiguedj1.snowball.br

import org.json.JSONObject
import java.io.InputStream
import java.util.zip.ZipInputStream

/**
 * 26/10/2026 (בקשת המשתמש: "סנכרון של כל המידע שלי ב־Chrome, כמו סימניות"): ל־Chrome אין ממשק פתוח לסנכרון
 * (Chrome Sync סגור לאפליקציות אחרות), אז הדרך היחידה הרשמית = הייצוא של Google: Google Takeout ← Chrome (קובץ ZIP
 * עם הסימניות והיסטוריית הגלישה), או "ייצוא סימניות" של Chrome במחשב (קובץ HTML). כאן — הקריאה של הקבצים האלה.
 * מזהים לפי התוכן ולא לפי השם (השמות בתוך Takeout מתורגמים לשפת החשבון). רק כתובות http/https.
 */
object BrImport {
    data class Item(val url: String, val title: String, val at: Long)
    class Result(val marks: List<Item>, val visits: List<Item>)

    private const val ENTRY_MAX = 64L shl 20      // קובץ בודד בתוך ה־ZIP — לכל היותר 64MB
    private const val TOTAL_MAX = 256L shl 20

    /** קובץ ZIP של Takeout, HTML של סימניות או JSON של היסטוריה */
    fun read(input: InputStream, name: String): Result {
        val head = input.buffered()
        head.mark(4)
        val zip = head.read() == 'P'.code && head.read() == 'K'.code
        head.reset()
        if (!zip) {
            val s = readCapped(head, ENTRY_MAX)
            return Result(if (isBookmarks(s)) bookmarks(s) else emptyList(), if (isHistory(s)) history(s) else emptyList())
        }
        val marks = ArrayList<Item>(); val visits = ArrayList<Item>()
        var total = 0L
        ZipInputStream(head).use { z ->
            while (true) {
                val e = z.nextEntry ?: break
                if (e.isDirectory) continue
                val n = e.name.lowercase()
                if (!n.endsWith(".html") && !n.endsWith(".htm") && !n.endsWith(".json")) continue
                val s = readCapped(z, ENTRY_MAX)
                total += s.length
                if (total > TOTAL_MAX) break
                if (isBookmarks(s)) marks += bookmarks(s) else if (isHistory(s)) visits += history(s)
            }
        }
        return Result(marks, visits)
    }

    private fun readCapped(i: InputStream, max: Long): String {
        val out = java.io.ByteArrayOutputStream()
        val buf = ByteArray(64 * 1024)
        var got = 0L
        while (true) {
            val r = i.read(buf); if (r < 0) break
            got += r; if (got > max) return ""          // גדול מדי — מדלגים
            out.write(buf, 0, r)
        }
        return out.toString("UTF-8")
    }

    fun isBookmarks(s: String) = s.contains("NETSCAPE-Bookmark-file", ignoreCase = true)
    fun isHistory(s: String) = s.contains("\"Browser History\"")

    private val A = Regex("""<A\s([^>]*)>(.*?)</A>""", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
    private val HREF = Regex("""HREF\s*=\s*"([^"]*)"""", RegexOption.IGNORE_CASE)
    private val ADD = Regex("""ADD_DATE\s*=\s*"(\d+)"""", RegexOption.IGNORE_CASE)

    /** קובץ הסימניות בפורמט של הדפדפנים (Netscape) — בלי התיקיות (הסימניות כאן ברשימה אחת) */
    fun bookmarks(s: String): List<Item> = A.findAll(s).mapNotNull { m ->
        val attrs = m.groupValues[1]
        val url = unescape(HREF.find(attrs)?.groupValues?.get(1) ?: return@mapNotNull null).trim()
        if (!url.startsWith("http://") && !url.startsWith("https://")) return@mapNotNull null
        val title = unescape(m.groupValues[2].replace(Regex("<[^>]+>"), "")).trim().take(300)
        val at = (ADD.find(attrs)?.groupValues?.get(1)?.toLongOrNull() ?: 0L) * 1000L
        Item(url.take(4000), title, at)
    }.distinctBy { it.url }.toList()

    /** "Browser History" של Takeout: ‏time_usec = מיקרו־שניות */
    fun history(s: String): List<Item> {
        val a = try { JSONObject(s).optJSONArray("Browser History") } catch (e: Exception) { null } ?: return emptyList()
        val out = ArrayList<Item>()
        for (i in 0 until a.length()) {
            val o = a.optJSONObject(i) ?: continue
            val url = o.optString("url")
            if (!url.startsWith("http://") && !url.startsWith("https://")) continue
            out += Item(url.take(4000), o.optString("title").take(300), o.optLong("time_usec") / 1000L)
        }
        return out
    }

    private val ENT = Regex("""&(#\d+|#x[0-9a-fA-F]+|amp|lt|gt|quot|apos|#39);""")
    fun unescape(s: String): String = ENT.replace(s) { m ->
        when (val k = m.groupValues[1]) {
            "amp" -> "&"; "lt" -> "<"; "gt" -> ">"; "quot" -> "\""; "apos", "#39" -> "'"
            else -> runCatching {
                val cp = if (k.startsWith("#x")) k.substring(2).toInt(16) else k.substring(1).toInt()
                String(Character.toChars(cp))
            }.getOrDefault(m.value)
        }
    }
}
