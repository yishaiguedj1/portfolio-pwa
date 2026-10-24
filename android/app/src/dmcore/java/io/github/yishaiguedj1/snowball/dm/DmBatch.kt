package io.github.yishaiguedj1.snowball.dm

import java.io.InputStream
import java.security.MessageDigest

/**
 * שלב 3 (23/10/2026): מה שעוזר לנהל הרבה הורדות — בלי אנדרואיד, נבדק ב־JVM.
 *  · DmImport — טקסט שהודבק: רשימת קישורים, או קובץ "ייצוא הרשימה" של DM (גיבוי ושחזור);
 *  · DmHash — בדיקת שלמות של קובץ שירד מול סיכום שהאתר מפרסם (MD5 / SHA-1 / SHA-256 / SHA-512).
 */
object DmImport {
    sealed class Parsed {
        data class Links(val urls: List<String>) : Parsed()
        /** גיבוי של DM: משימות להוספה מחדש — בלי מקטעים, בלי קובץ בטלפון, במצב "בתור" */
        data class Backup(val tasks: List<DmTask>) : Parsed()
        object Empty : Parsed()
    }

    fun parse(text: String?): Parsed {
        val t = (text ?: "").trim()
        if (t.startsWith("{") && t.contains("\"tasks\"")) {
            val list = DmTask.listOf(t).take(DmLink.MAX_BATCH).map { o ->
                DmTask(o.id, o.url, o.ref, o.kind).also {
                    it.name = DmName.clean(o.name); it.vf = o.vf; it.af = o.af; it.height = o.height
                    it.audioOnly = o.audioOnly; it.title = o.title.take(300)
                }
            }
            if (list.isNotEmpty()) return Parsed.Backup(list)
        }
        val urls = DmLink.all(t)
        return if (urls.isEmpty()) Parsed.Empty else Parsed.Links(urls)
    }

    /** מה מהגיבוי חדש: לא קישור שכבר ברשימה, ומזהה חדש אם המזהה תפוס */
    fun fresh(backup: List<DmTask>, have: Set<String>, ids: Set<String>, newId: () -> String): List<DmTask> {
        val seen = HashSet(have)
        return backup.filter { seen.add(it.url) }.map { t ->
            if (t.id !in ids) t else DmTask(newId(), t.url, t.ref, t.kind).also {
                it.name = t.name; it.vf = t.vf; it.af = t.af; it.height = t.height; it.audioOnly = t.audioOnly; it.title = t.title
            }
        }
    }
}

object DmHash {
    /** לפי האורך של הסיכום שהודבק (הקסדצימלי): 32 = MD5, ‏40 = SHA-1, ‏64 = SHA-256, ‏128 = SHA-512 */
    fun algoOf(expected: String): String? = when (clean(expected).length) {
        32 -> "MD5"; 40 -> "SHA-1"; 64 -> "SHA-256"; 128 -> "SHA-512"; else -> null
    }

    /** הסיכום מתוך מה שהודבק ("sha256: AB12…", שורה של sha256sum עם שם קובץ…) — רק ה־hex הארוך הראשון */
    fun clean(s: String): String = Regex("[0-9a-fA-F]{32,128}").find(s)?.value?.lowercase() ?: ""

    fun digest(input: InputStream, algo: String, onBytes: (Long) -> Unit = {}, stop: () -> Boolean = { false }): String {
        val md = MessageDigest.getInstance(algo)
        val buf = ByteArray(256 * 1024)
        var n = 0L
        input.use { inp ->
            while (true) {
                if (stop()) throw InterruptedException("stop")
                val k = inp.read(buf); if (k < 0) break
                md.update(buf, 0, k); n += k; onBytes(n)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    /** null = הסיכום לא תקין; אחרת אם תואם */
    fun matches(actual: String, expected: String): Boolean? {
        val e = clean(expected)
        return if (algoOf(e) == null) null else actual.equals(e, ignoreCase = true)
    }
}

/**
 * כללים לפי אתר — נלמדים לבד (כמו "מספר חיבורים לשרת" ב־IDM, בלי שהמשתמש יגדיר): אתר שענה "יותר מדי" (429/503)
 * כמה פעמים בהורדה אחת — מקבל חצי מהחיבורים בפעם הבאה (לפחות 1); הורדה נקייה אחרי זה מחזירה צעד אחד למעלה.
 * נשמר לכל אתר (DmLink.host), עד MAX_HOSTS אתרים.
 */
object DmHostRules {
    const val BUSY_HITS = 2
    const val MAX_HOSTS = 100

    /** כמה חיבורים לאתר בפעם הבאה: rule = מה שנלמד עד עכשיו (0 = אין כלל), used = כמה היו בהורדה הזו */
    fun next(rule: Int, used: Int, throttled: Boolean, max: Int): Int = when {
        throttled -> (used / 2).coerceAtLeast(1)
        rule <= 0 -> 0
        else -> (rule * 2).let { if (it >= max) 0 else it }   // חוזרים לברירת המחדל בהדרגה
    }

    fun conns(rule: Int, default: Int): Int = if (rule <= 0) default else minOf(rule, default)

    fun parse(s: String?): MutableMap<String, Int> {
        val m = LinkedHashMap<String, Int>()
        (s ?: "").split(';').forEach { p ->
            val i = p.lastIndexOf('='); if (i <= 0) return@forEach
            val h = p.substring(0, i); val n = p.substring(i + 1).toIntOrNull() ?: return@forEach
            if (Regex("^[a-z0-9.-]{1,253}$").matches(h) && n in 1..DmSegs.MAX_CONNS) m[h] = n
        }
        return m
    }

    fun dump(m: Map<String, Int>): String = m.entries.toList().takeLast(MAX_HOSTS).joinToString(";") { "${it.key}=${it.value}" }
}

/** חיפוש ברשימת ההורדות (24/10): כל המילים בשאילתה מופיעות באחד השדות (שם, כותרת, אתר), בלי תלות באותיות גדולות/קטנות */
object DmFind {
    fun match(q: String, vararg fields: String): Boolean {
        val words = q.lowercase().split(Regex("\\s+")).filter { it.isNotEmpty() }
        if (words.isEmpty()) return true
        val hay = fields.joinToString(" ") { it.lowercase() }
        return words.all { hay.contains(it) }
    }
}
