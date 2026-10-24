package io.github.yishaiguedj1.snowball

import java.net.URI

/**
 * 22/10/2026 (שלב 2 של ההורדה מקישור): דפדפן הציד — אילו בקשות רשת הן סרטון. טהור (נבדק ב־JVM).
 * כמו IDM ו־cat-catch: לפי סיומת וצורת הכתובת (ב־WebView אין כותרות תשובה ב־shouldInterceptRequest), ולפי מה
 * שהסקריפט בדף מדווח (fetch/XHR/‏<video>). קטעים בודדים (‎.ts/.m4s) — לא מוצעים: הרשימה שלהם היא מה שמורידים.
 */
object HuntMedia {
    enum class Kind { HLS, DASH, FILE }

    data class Hit(val url: String, val kind: Kind, val host: String)

    private val HLS = Regex("""\.m3u8?$""", RegexOption.IGNORE_CASE)
    private val DASH = Regex("""\.mpd$""", RegexOption.IGNORE_CASE)
    private val FILE = Regex("""\.(mp4|m4v|webm|mov|mkv|flv)$""", RegexOption.IGNORE_CASE)
    /* בלי פרסומות ובלי תמונות־תצוגה: שמות נפוצים של שרתי פרסום וקובצי preview */
    private val NOISE = Regex("""(doubleclick|googlesyndication|googleads|adservice|imasdk|/ads?/|[?&]ad_|preview|thumbnail|sprite|storyboard)""", RegexOption.IGNORE_CASE)

    fun classify(raw: String?): Hit? {
        val s = raw?.trim() ?: return null
        if (s.length > 4096 || !s.startsWith("http", ignoreCase = true)) return null
        val u = try { URI(s) } catch (e: Exception) { return null }
        if (u.scheme !in setOf("http", "https")) return null
        val host = u.host?.lowercase() ?: return null
        val path = u.rawPath ?: ""
        if (NOISE.containsMatchIn(s)) return null
        val q = u.rawQuery ?: ""
        val kind = when {
            HLS.containsMatchIn(path) -> Kind.HLS
            DASH.containsMatchIn(path) -> Kind.DASH
            FILE.containsMatchIn(path) -> Kind.FILE
            // שרתים שמגישים רשימת HLS בלי סיומת (‎…/playlist?format=m3u8, ‎…/manifest(format=m3u8-aapl))
            Regex("""(format=m3u8|m3u8-aapl|/hls/[^/]*master|mime=application%2Fx-mpegurl)""", RegexOption.IGNORE_CASE).containsMatchIn(path + "?" + q) -> Kind.HLS
            Regex("""(format=mpd|mpd-time-csf|/dash/[^/]*manifest)""", RegexOption.IGNORE_CASE).containsMatchIn(path + "?" + q) -> Kind.DASH
            else -> return null
        }
        return Hit(u.toString(), kind, host.removePrefix("www."))
    }

    /** רשימת הממצאים בדף: בלי כפולים (אותו נתיב עם חתימה אחרת = אותו קובץ), עד 30, והטוב קודם (רשימה ראשית לפני קבצים) */
    class Found {
        private val byKey = LinkedHashMap<String, Hit>()
        val list: List<Hit> get() = byKey.values.sortedBy { it.kind.ordinal }

        /** true = חדש */
        fun add(h: Hit): Boolean {
            val k = try { URI(h.url).let { it.host + it.rawPath } } catch (e: Exception) { h.url }
            if (byKey.containsKey(k)) return false
            // רשימת HLS "ראשית" (master) מכילה את האחרות — אם כבר יש אחת מאותו שרת, רשימת משנה לא נוספת
            if (h.kind == Kind.HLS && byKey.values.any { it.kind == Kind.HLS && it.host == h.host && it.url.contains("master", true) } && !h.url.contains("master", true)) return false
            if (byKey.size >= 30) return false
            byKey[k] = h
            return true
        }

        fun clear() = byKey.clear()
        val size get() = byKey.size
    }
}
