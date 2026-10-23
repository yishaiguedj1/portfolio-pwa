package io.github.yishaiguedj1.snowball.dm

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.URLDecoder
import java.net.UnknownHostException
import java.util.Locale

/** הפיצול הדינמי — כמו IDM: חיבור שהתפנה לוקח את חצי השארית של המקטע הגדול ביותר, ולא "32 חיבורים" מראש */
object DmSegs {
    const val MIN_SEG = 1L shl 20          // מקטע לא קטן מ־1MB — פחות מזה, פתיחת חיבור עולה יותר ממה שהיא חוסכת
    const val MAX_CONNS = 8

    /** התחלה: עד `conns` מקטעים שווים (לא קטנים מ־MIN_SEG). בלי גודל ידוע / בלי Range — מקטע אחד */
    fun initial(total: Long, ranges: Boolean, conns: Int): MutableList<Seg> {
        if (total <= 0) return mutableListOf(Seg(0, Long.MAX_VALUE))
        if (!ranges) return mutableListOf(Seg(0, total))
        val n = conns.coerceIn(1, MAX_CONNS).toLong().coerceAtMost((total / MIN_SEG).coerceAtLeast(1))
        val size = total / n
        return MutableList(n.toInt()) { i -> Seg(i * size, if (i == n.toInt() - 1) total else (i + 1) * size) }
    }

    /**
     * חיבור התפנה: חותכים את המקטע עם השארית הגדולה ביותר (מ־`busy` — אלה שחיבור עובד עליהם, או שלא התחילו)
     * באמצע השארית שלו. מחזיר את המקטע החדש (שכבר נוסף לרשימה) או null כשאין מה לחתוך.
     * המקטע הישן רק מתקצר: החיבור שלו קורא את `end` בכל קריאה ונעצר בגבול החדש.
     */
    fun split(segs: MutableList<Seg>, min: Long = MIN_SEG): Seg? {
        val big = segs.filter { !it.finished }.maxByOrNull { it.left } ?: return null
        if (big.left < 2 * min) return null
        val cut = big.pos + big.left / 2
        val n = Seg(cut, big.end)
        big.end = cut
        segs.add(segs.indexOf(big) + 1, n)
        return n
    }

    /** חתכים שנגמרו ושהם רצופים — מאחדים (הרשימה לא גדלה בלי סוף בקובץ גדול) */
    fun compact(segs: MutableList<Seg>) {
        var i = 0
        while (i < segs.size - 1) {
            val a = segs[i]; val b = segs[i + 1]
            if (a.finished && b.finished && a.end == b.start) { segs[i] = Seg(a.start, b.end, b.end - a.start); segs.removeAt(i + 1) } else i++
        }
    }

    /** הקובץ שלם: כל המקטעים נגמרו ומכסים את [0, total) בלי רווח */
    fun complete(segs: List<Seg>, total: Long): Boolean {
        if (total <= 0) return false
        var at = 0L
        for (s in segs.sortedBy { it.start }) { if (s.start > at || !s.finished) return false; at = maxOf(at, s.end) }
        return at >= total
    }
}

/** תקלה → מה עושים. רק מספרים וקודים, בלי טקסט מהשרת */
object DmRetry {
    enum class Act { RETRY, FATAL, RESTART }
    data class Verdict(val act: Act, val code: String)

    const val MAX_TRIES = 12

    fun http(status: Int): Verdict = when (status) {
        408, 425, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524 -> Verdict(Act.RETRY, "http_$status")
        401, 403, 410 -> Verdict(Act.FATAL, "expired")      // לרוב קישור שפג — שלב 2: "רענון קישור"
        404 -> Verdict(Act.FATAL, "http_404")
        416 -> Verdict(Act.RESTART, "range")
        else -> if (status in 400..499) Verdict(Act.FATAL, "http_$status") else Verdict(Act.RETRY, "http_$status")
    }

    fun io(e: Throwable): Verdict = when (e) {
        is UnknownHostException -> Verdict(Act.RETRY, "net")
        is SocketTimeoutException -> Verdict(Act.RETRY, "net")
        is javax.net.ssl.SSLHandshakeException -> Verdict(Act.FATAL, "ssl")
        is DmSpace -> Verdict(Act.FATAL, "space")
        is IOException -> Verdict(Act.RETRY, "net")
        else -> Verdict(Act.FATAL, "fail")
    }

    /** המתנה לפני הניסיון ה־n: ‏1, 2, 4… עד 60 שנ׳ (או Retry-After של השרת, עד 5 דק׳) */
    fun backoffMs(n: Int, retryAfterSec: Long = -1): Long {
        if (retryAfterSec in 1..300) return retryAfterSec * 1000
        return (1000L shl n.coerceIn(0, 6)).coerceAtMost(60_000)
    }
}

/** אין מקום בטלפון — לא מנסים שוב */
class DmSpace : IOException("space")

/** שם קובץ: מהשרת (Content-Disposition), מהכתובת, ותמיד בטוח לשמירה */
object DmName {
    private val BAD = Regex("[\\\\/:*?\"<>|\\u0000-\\u001f\\u007f]")

    fun fromDisposition(h: String?): String {
        h ?: return ""
        // RFC 6266/5987: ‏filename*=UTF-8''… גובר על filename=
        Regex("filename\\*\\s*=\\s*([^;]+)", RegexOption.IGNORE_CASE).find(h)?.let { m ->
            val v = m.groupValues[1].trim().trim('"')
            val i = v.indexOf("''")
            val cs = if (i > 0) v.substring(0, i) else "UTF-8"
            val raw = if (i >= 0) v.substring(i + 2) else v
            runCatching { return clean(URLDecoder.decode(raw.replace("+", "%2B"), cs)) }
        }
        Regex("filename\\s*=\\s*(\"([^\"]*)\"|[^;]+)", RegexOption.IGNORE_CASE).find(h)?.let { m ->
            return clean(m.groupValues[2].ifEmpty { m.groupValues[1] }.trim())
        }
        return ""
    }

    fun fromUrl(u: String): String {
        val path = u.substringBefore('#').substringBefore('?').substringAfter("://").substringAfter('/', "")
        val last = path.substringAfterLast('/')
        return clean(runCatching { URLDecoder.decode(last.replace("+", "%2B"), "UTF-8") }.getOrDefault(last))
    }

    fun clean(s: String): String {
        var t = s.replace(BAD, "_").trim().trim('.').trim()
        if (t.length > 120) {
            val ext = ext(t)
            t = t.take(120 - ext.length - 1).trimEnd() + (if (ext.isNotEmpty()) ".$ext" else "")
        }
        return t
    }

    fun ext(name: String): String {
        val i = name.lastIndexOf('.')
        if (i <= 0 || i == name.length - 1) return ""
        val e = name.substring(i + 1).lowercase(Locale.ROOT)
        return if (e.length <= 8 && e.all { it.isLetterOrDigit() }) e else ""
    }

    private val MIME_EXT = mapOf(
        "video/mp4" to "mp4", "video/webm" to "webm", "video/x-matroska" to "mkv", "video/quicktime" to "mov",
        "audio/mpeg" to "mp3", "audio/mp4" to "m4a", "audio/ogg" to "ogg", "audio/opus" to "opus", "audio/wav" to "wav",
        "audio/flac" to "flac", "application/pdf" to "pdf", "application/zip" to "zip", "application/x-7z-compressed" to "7z",
        "application/vnd.rar" to "rar", "application/x-rar-compressed" to "rar", "application/vnd.android.package-archive" to "apk",
        "image/jpeg" to "jpg", "image/png" to "png", "image/webp" to "webp", "image/gif" to "gif", "text/plain" to "txt",
        "application/epub+zip" to "epub", "application/x-subrip" to "srt",
    )

    fun extOfMime(m: String) = MIME_EXT[m.substringBefore(';').trim().lowercase(Locale.ROOT)] ?: ""

    fun mimeOfExt(e: String): String = MIME_EXT.entries.firstOrNull { it.value == e.lowercase(Locale.ROOT) }?.key ?: ""

    /** השם הסופי: Content-Disposition → הכתובת → "download"; סיומת לפי הסוג כשחסרה */
    fun pick(disposition: String?, url: String, mime: String): String {
        var n = fromDisposition(disposition).ifEmpty { fromUrl(url) }.ifEmpty { "download" }
        if (ext(n).isEmpty()) extOfMime(mime).takeIf { it.isNotEmpty() }?.let { n = "$n.$it" }
        return n
    }

    /** לאיזו "ספרייה" (תיקייה חכמה) ולאיזה אוסף ב־MediaStore */
    enum class Cat { VIDEO, AUDIO, IMAGE, DOC, ARCHIVE, APK, OTHER }

    fun cat(name: String, mime: String): Cat {
        val m = mime.lowercase(Locale.ROOT); val e = ext(name)
        return when {
            m.startsWith("video/") || e in setOf("mp4", "mkv", "webm", "mov", "m4v", "avi", "ts") -> Cat.VIDEO
            m.startsWith("audio/") || e in setOf("mp3", "m4a", "ogg", "opus", "wav", "flac", "aac") -> Cat.AUDIO
            m.startsWith("image/") || e in setOf("jpg", "jpeg", "png", "webp", "gif", "heic") -> Cat.IMAGE
            e in setOf("zip", "7z", "rar", "tar", "gz", "xz", "bz2") -> Cat.ARCHIVE
            e == "apk" -> Cat.APK
            e in setOf("pdf", "epub", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "srt", "csv") -> Cat.DOC
            else -> Cat.OTHER
        }
    }
}

/** קלט: הקישור הראשון בטקסט ששותף / בלוח */
object DmLink {
    private val RE = Regex("https?://[^\\s<>\"'`]+", RegexOption.IGNORE_CASE)
    fun first(text: String?): String = RE.find(text ?: "")?.value?.trimEnd('.', ',', ')', ']', '»', '"', '\'')?.take(4096) ?: ""
}
