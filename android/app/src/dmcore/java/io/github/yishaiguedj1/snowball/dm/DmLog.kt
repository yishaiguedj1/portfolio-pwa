package io.github.yishaiguedj1.snowball.dm

import org.json.JSONObject

/**
 * 24/10/2026 (בקשת המשתמש: מאגר נתונים מ־DM שיזין את Claude, כמו בסטודיו) — שלב א׳: יומן מקומי בלבד.
 * לכל הורדה: אירוע (התחלה / הסתיימה / נכשלה / נעצרה), קוד הכשל, גודל, מהירות, חיבורים, ניסיונות,
 * הדומיין ושם הקובץ — **בלי הכתובת המלאה** (חתומה, עם אסימונים) ובלי עוגיות. כל טקסט חופשי
 * (הודעת חריגה, שורות של yt-dlp) עובר `redact` לפני שהוא נשמר. השליחה לשרת (שלב ב׳) רק בהסכמה מפורשת.
 */
object DmLog {
    const val MSG_MAX = 300
    const val TAIL_MAX = 12

    data class Event(
        val t: Long,
        val k: String,            // start / done / fail / stop
        val id: String,           // מזהה המשימה ב־DM (אקראי, לא קשור לקישור)
        val kind: String,         // http / yt
        val dom: String = "",
        val name: String = "",
        val code: String = "",
        val size: Long = -1,
        val got: Long = 0,
        val ms: Long = 0,
        val bps: Long = 0,        // ממוצע: got ÷ ms
        val conns: Int = 0,
        val tries: Int = 0,
        val ex: String = "",      // סוג החריגה בלבד (IOException…)
        val msg: String = "",
        val tail: List<String> = emptyList(),
    ) {
        fun json(): JSONObject = JSONObject().apply {
            put("t", t); put("k", k); put("id", id); put("kind", kind)
            if (dom.isNotEmpty()) put("dom", dom)
            if (name.isNotEmpty()) put("name", name)
            if (code.isNotEmpty()) put("code", code)
            if (size >= 0) put("size", size)
            if (got > 0) put("got", got)
            if (ms > 0) put("ms", ms)
            if (bps > 0) put("bps", bps)
            if (conns > 0) put("conns", conns)
            if (tries > 0) put("tries", tries)
            if (ex.isNotEmpty()) put("ex", ex)
            if (msg.isNotEmpty()) put("msg", msg)
            if (tail.isNotEmpty()) put("tail", org.json.JSONArray(tail))
        }

        companion object {
            fun of(o: JSONObject) = Event(
                o.optLong("t"), o.optString("k"), o.optString("id"), o.optString("kind"), o.optString("dom"), o.optString("name"),
                o.optString("code"), o.optLong("size", -1), o.optLong("got"), o.optLong("ms"), o.optLong("bps"), o.optInt("conns"),
                o.optInt("tries"), o.optString("ex"), o.optString("msg"),
                o.optJSONArray("tail")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList(),
            )
        }
    }

    private val URL = Regex("""(?i)\b(?:https?|ftp|wss?)://([^/\s?#'"<>]+)[^\s'"<>]*""")
    private val EMAIL = Regex("""[\w.+-]+@[\w-]+\.[\w.-]+""")
    private val KV = Regex("""(?i)\b(token|key|sig|signature|auth|session|cookie|password|pass|secret|expire|expires|policy|credential|x-amz-[a-z-]+)\s*[=:]\s*[^\s&;,'"]+""")
    private val BEARER = Regex("""(?i)\bbearer\s+[\w.\-~+/=]+""")
    private val LONG = Regex("""[A-Za-z0-9_\-+/=]{32,}""")
    private val PATH = Regex("""(/(?:data|storage|sdcard)/[^\s'"]*)""")

    /** טקסט חופשי → בלי כתובות (רק הדומיין), בלי מיילים, אסימונים, עוגיות ונתיבים בטלפון */
    fun redact(s: String?): String {
        if (s.isNullOrEmpty()) return ""
        var x = s.replace('\n', ' ').replace('\r', ' ')
        x = URL.replace(x) { m -> "<" + m.groupValues[1].substringAfterLast('@').lowercase() + ">" }
        x = BEARER.replace(x, "bearer <…>")
        x = KV.replace(x) { m -> m.groupValues[1] + "=<…>" }
        x = EMAIL.replace(x, "<email>")
        x = PATH.replace(x) { m -> "<path>/" + m.value.substringAfterLast('/').take(60) }
        x = LONG.replace(x, "<…>")
        x = x.replace(Regex("\\s+"), " ").trim()
        return if (x.length > MSG_MAX) x.take(MSG_MAX) + "…" else x
    }

    /** שם הקובץ — רק השם (בלי תיקייה), ובלי מה שנראה כמו אסימון */
    fun cleanName(n: String): String = redact(n.substringAfterLast('/')).take(120)

    /** הדומיין בלבד, בלי www */
    fun domain(url: String): String = DmLink.host(url).removePrefix("www.")

    /** שורות אחרונות של yt-dlp — רק מה שמסביר תקלה (WARNING/ERROR/Retrying), מנוקות */
    class Tail(private val max: Int = TAIL_MAX) {
        private val q = ArrayDeque<String>()
        @Synchronized fun add(line: String?) {
            val l = (line ?: "").trim()
            if (l.isEmpty() || !(l.startsWith("ERROR") || l.startsWith("WARNING") || l.contains("Retrying") || l.contains("HTTP Error"))) return
            q.addLast(redact(l)); while (q.size > max) q.removeFirst()
        }
        @Synchronized fun list(): List<String> = q.toList()
    }

    /** שורה קריאה לייצוא — להדבקה בצ'אט עם Claude */
    fun line(e: Event): String {
        val ts = java.text.SimpleDateFormat("dd/MM HH:mm:ss", java.util.Locale.US).format(java.util.Date(e.t))
        val p = mutableListOf(ts, e.k, e.kind)
        if (e.dom.isNotEmpty()) p += e.dom
        if (e.name.isNotEmpty()) p += "\"${e.name}\""
        if (e.code.isNotEmpty()) p += "code=${e.code}"
        if (e.size >= 0) p += "size=${e.size}"
        if (e.got > 0) p += "got=${e.got}"
        if (e.ms > 0) p += "ms=${e.ms}"
        if (e.bps > 0) p += "bps=${e.bps}"
        if (e.conns > 0) p += "conns=${e.conns}"
        if (e.tries > 0) p += "tries=${e.tries}"
        if (e.ex.isNotEmpty()) p += "ex=${e.ex}"
        if (e.msg.isNotEmpty()) p += "msg=${e.msg}"
        val s = p.joinToString(" · ")
        return if (e.tail.isEmpty()) s else s + "\n" + e.tail.joinToString("\n") { "    | $it" }
    }

    /** הייצוא: כותרת (גרסה, מכשיר) + האירועים מהחדש לישן */
    fun export(head: String, events: List<Event>, max: Int = 300): String =
        head + "\n\n" + events.takeLast(max).reversed().joinToString("\n") { line(it) }
}
