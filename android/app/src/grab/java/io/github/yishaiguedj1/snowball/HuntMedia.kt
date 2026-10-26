package io.github.yishaiguedj1.snowball

import java.net.URI

/**
 * 22/10/2026 (שלב 2 של ההורדה מקישור): דפדפן הציד — אילו בקשות רשת הן סרטון. טהור (נבדק ב־JVM).
 * כמו IDM ו־cat-catch: לפי סיומת וצורת הכתובת (ב־WebView אין כותרות תשובה ב־shouldInterceptRequest), ולפי מה
 * שהסקריפט בדף מדווח (fetch/XHR/‏<video>). קטעים בודדים (‎.ts/.m4s) — לא מוצעים: הרשימה שלהם היא מה שמורידים.
 */
object HuntMedia {
    enum class Kind { HLS, DASH, FILE }

    /** guess = נמצא בלי סיומת מוכרת (בקשת Range של נגן) — נספר רק אם השרת עונה שזה וידאו/קול */
    data class Hit(val url: String, val kind: Kind, val host: String, val guess: Boolean = false)

    private val HLS = Regex("""\.m3u8?$""", RegexOption.IGNORE_CASE)
    private val DASH = Regex("""\.mpd$""", RegexOption.IGNORE_CASE)
    private val FILE = Regex("""\.(mp4|m4v|webm|mov|mkv|flv)$""", RegexOption.IGNORE_CASE)
    /* בלי פרסומות ובלי תמונות־תצוגה: שמות נפוצים של שרתי פרסום וקובצי preview.
       26/10/2026 (בקשת המשתמש: "שהמערכת תזהה פרסומות ותסנן אותן כמו IDM"): גם רשתות הפרסום של וידאו (VAST/VPAID, ‏FreeWheel,
       ‏SpotX, ‏Innovid, ‏Teads…) ושמות של פרסומת לפני/באמצע סרטון. רק שמות חד־משמעיים — לא "ad" לבד (download, ‏head) */
    private val NOISE = Regex("""(doubleclick|googlesyndication|googleads|adservice|imasdk|/ads?/|[?&]ad_|preview|thumbnail|sprite|storyboard|""" +
        """[./_-]vast[./_?-]|vpaid|pre-?roll|mid-?roll|post-?roll|adserver|adsystem|adnxs|fwmrm|freewheel|springserve|spotx|innovid|teads|""" +
        """serving-sys|tremorhub|smartadserver|pubmatic|moatads|/advert|[./_-]adcontent|adtech)""", RegexOption.IGNORE_CASE)

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

    const val GRACE = 1500L

    /** אותו "חלק" בדף — בלי ה־#: שינוי של נתיב או של שאילתה = שיעור / סרטון אחר */
    fun samePage(a: String, b: String): Boolean = a.substringBefore('#') == b.substringBefore('#')

    /* קבצים שנגן לא מבקש (סקריפטים, עיצוב, תמונות, גופנים, נתונים) — לא "ניחוש" גם כשיש להם Range */
    private val STATIC = Regex("""\.(js|mjs|css|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|json|html?|xml|txt|wasm|ts|m4s|vtt|srt)$""", RegexOption.IGNORE_CASE)

    /**
     * 26/10/2026 (שלב 1 בתוכנית הדפדפן): בקשה שהדפדפן ראה — הכתובת וכותרות הבקשה. נגן ‎<video>‎ מבקש קובץ עם
     * ‎Range: bytes=…‎ גם כשלכתובת אין סיומת (שרתי וידאו של קורסים, CDN עם מזהה) → ניחוש שנבדק בשרת (headOk).
     */
    fun fromRequest(url: String, headers: Map<String, String>?): Hit? {
        classify(url)?.let { return it }
        val range = headers?.entries?.firstOrNull { it.key.equals("range", true) }?.value ?: return null
        if (!range.trim().startsWith("bytes=")) return null
        val u = try { URI(url.trim()) } catch (e: Exception) { return null }
        if (u.scheme !in setOf("http", "https")) return null
        val host = u.host?.lowercase() ?: return null
        val path = u.rawPath ?: ""
        if (STATIC.containsMatchIn(path) || NOISE.containsMatchIn(url) || url.length > 4096) return null
        return Hit(u.toString(), Kind.FILE, host.removePrefix("www."), guess = true)
    }

    /**
     * הודעה מהסקריפט בדף: כתובת, או "‎@hls / @dash / @file‎ כתובת" כשהסוג נקבע לפי Content-Type של התשובה
     * (רשימת HLS בלי סיומת, ‎/manifest?id=…‎). עם סוג מהשרת — בלי לנחש לפי השם, אבל עם אותו סינון פרסומות.
     */
    fun fromHook(msg: String?): Hit? {
        val m = msg?.trim() ?: return null
        val kind = when {
            m.startsWith("@hls ") -> Kind.HLS
            m.startsWith("@dash ") -> Kind.DASH
            m.startsWith("@file ") -> Kind.FILE
            else -> return classify(m)
        }
        val url = m.substringAfter(' ').trim()
        if (url.length > 4096 || !url.startsWith("http", ignoreCase = true) || NOISE.containsMatchIn(url)) return null
        val u = try { URI(url) } catch (e: Exception) { return null }
        if (u.scheme !in setOf("http", "https")) return null
        val host = u.host?.lowercase() ?: return null
        return Hit(u.toString(), kind, host.removePrefix("www."))
    }

    /** תשובת HEAD לקובץ שנמצא: קטן מדי / דף / תמונה / נתונים — לא סרטון. ניחוש — רק וידאו, קול או קובץ בינארי */
    fun headOk(type: String?, len: Long, guess: Boolean, minBytes: Long): Boolean {
        val t = (type ?: "").lowercase()
        if (len in 1 until minBytes) return false
        if (t.startsWith("text/") || t.startsWith("image/") || t.contains("json")) return false
        if (guess) return t.startsWith("video/") || t.startsWith("audio/") || t.startsWith("application/octet-stream")
        return true
    }

    /* 26/10/2026 (דיווח המשתמש ב־Vimeo): חתימה שמשתנה בכל טעינה בתוך הנתיב (‎/1793027351-0x12d6…a8/98a3d4df/…‎) —
       אותו קובץ נראה "חדש". חלק בנתיב שנראה כמו חתימה (ארוך עם ספרות, ‎0x…‎, ‎exp=…‎, ‏~) לא נכנס למפתח */
    private val TOKEN = Regex("""^(?=.*\d)[A-Za-z0-9_~=-]{24,}$|0x[0-9a-f]{12,}|^(exp|hmac|token|sig|auth|hdnts|acl)[=_~-]""", RegexOption.IGNORE_CASE)

    /** המפתח של קובץ לזיהוי כפולים: השרת והנתיב, בלי השאילתה ובלי חלקים שהם חתימה */
    fun keyOf(url: String): String = try {
        val u = URI(url)
        u.host + (u.rawPath ?: "").split('/').joinToString("/") { if (TOKEN.containsMatchIn(it)) "*" else it }
    } catch (e: Exception) { url }

    /** רשימת הממצאים בדף: בלי כפולים (אותו נתיב עם חתימה אחרת = אותו קובץ), עד 30, והטוב קודם (רשימה ראשית לפני קבצים) */
    class Found {
        private val byKey = LinkedHashMap<String, Hit>()
        private val at = HashMap<String, Long>()
        val list: List<Hit> get() = byKey.values.sortedBy { it.kind.ordinal }

        /** true = חדש. now = מתי נראה (לניקוי במעבר בין חלקים באותו דף — navigated) */
        fun add(h: Hit, now: Long = 0L): Boolean {
            val k = keyOf(h.url)
            if (byKey.containsKey(k)) return false
            // רשימת HLS "ראשית" (master) מכילה את האחרות — אם כבר יש אחת מאותו שרת, רשימת משנה לא נוספת
            if (h.kind == Kind.HLS && byKey.values.any { it.kind == Kind.HLS && it.host == h.host && it.url.contains("master", true) } && !h.url.contains("master", true)) return false
            if (byKey.size >= 30) return false
            byKey[k] = h
            at[k] = now
            return true
        }

        fun clear() { byKey.clear(); at.clear() }

        /**
         * 25/10/2026 (דיווח המשתמש — קורס ב־schooler.biz): אתר של "דף אחד" מחליף שיעור בלי טעינת דף (pushState),
         * ו־onPageStarted לא נקרא — הרשימה צברה את הסרטונים של כל השיעורים. במעבר כזה מוחקים מה שנראה לפני
         * יותר מ־GRACE (הנגן החדש לפעמים מבקש את הסרטון רגע לפני שהכתובת מתעדכנת).
         */
        fun navigated(now: Long, grace: Long = GRACE): Boolean {
            val old = at.filterValues { now - it > grace }.keys
            old.forEach { byKey.remove(it); at.remove(it) }
            return old.isNotEmpty()
        }
        val size get() = byKey.size
    }
}
