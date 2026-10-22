package io.github.yishaiguedj1.snowball

import java.net.URI

/**
 * 22/10/2026 (שלב 1.5 של ההורדה מקישור): האם הטקסט בשורת הכתובת של הדפדפן הוא דף של סרטון.
 * טהור — בלי אנדרואיד (נבדק ב־JVM: src/test). רק לפי הכתובת: הבועה מופיעה בדף צפייה, לא בדף הבית של האתר.
 * את הסרטון עצמו מוציא העובד (yt-dlp) — כאן רק "שווה להציע".
 */
object VideoUrl {
    sealed class Hit {
        /** דף של סרטון — הכתובת המלאה */
        data class Video(val url: String) : Hit()
        /** אתר וידאו, אבל השורה מציגה רק את שם האתר (בלי הנתיב) — את הכתובת המלאה קוראים בנגיעה */
        data class SiteOnly(val host: String) : Hit()
        /** הניסוי: דף באתר לא מוכר שיש בו נגן — שולחים את הדף, והשרת (yt-dlp, מחלץ כללי) מחפש בו את הסרטון */
        data class Page(val url: String) : Hit()
        object None : Hit()
    }

    private val MEDIA_EXT = Regex("""\.(mp4|m4v|m3u8|mpd|webm|mov|mkv)$""", RegexOption.IGNORE_CASE)

    /* אתר → הנתיבים שהם דף צפייה (הסיומת של שם האתר, בלי www./m.) */
    private val SITES: List<Pair<String, Regex?>> = listOf(
        "youtube.com" to Regex("""^/(watch|shorts/[\w-]{6,}|live/[\w-]{6,}|embed/[\w-]{6,})"""),
        "youtu.be" to Regex("""^/[\w-]{6,}"""),
        "vimeo.com" to Regex("""^/(\d+|channels/[^/]+/\d+|video/\d+|showcase/\d+/video/\d+)"""),
        "ted.com" to Regex("""^/talks/[^/]+"""),
        "tiktok.com" to Regex("""^/(@[^/]+/video/\d+|t/\w+|v/\d+)"""),
        "instagram.com" to Regex("""^/((reel|reels|p|tv)/[\w-]+|[^/]+/reel/[\w-]+)"""),
        "facebook.com" to Regex("""^/(watch|reel/\d+|[^/]+/videos/|share/[rv]/)"""),
        "fb.watch" to Regex("""^/\w+"""),
        "x.com" to Regex("""^/[^/]+/status/\d+"""),
        "twitter.com" to Regex("""^/[^/]+/status/\d+"""),
        "dailymotion.com" to Regex("""^/video/\w+"""),
        "dai.ly" to Regex("""^/\w+"""),
        "twitch.tv" to Regex("""^/(videos/\d+|[^/]+/clip/[\w-]+|[^/]+/v/\d+)"""),
        "clips.twitch.tv" to Regex("""^/[\w-]+"""),
        "reddit.com" to Regex("""^/r/[^/]+/comments/\w+"""),
        "v.redd.it" to Regex("""^/\w+"""),
        "rumble.com" to Regex("""^/v[\w-]+\.html"""),
        "bilibili.com" to Regex("""^/video/\w+"""),
        "archive.org" to Regex("""^/details/[^/]+"""),
        "streamable.com" to Regex("""^/\w{4,}$"""),
        "kan.org.il" to Regex("""/(content|program|lobby)/"""),
        "mako.co.il" to Regex("""vod"""),
        "linkedin.com" to Regex("""^/(posts|feed/update)/"""),
        "loom.com" to Regex("""^/(share|embed)/\w+"""),
        "odysee.com" to Regex("""^/@[^/]+/[^/]+"""),
        "bitchute.com" to Regex("""^/video/\w+"""),
        "9gag.com" to Regex("""^/gag/\w+"""),
        "pinterest.com" to Regex("""^/pin/\d+"""),
        "imdb.com" to Regex("""^/video/"""),
    )

    private fun site(host: String): Pair<String, Regex?>? =
        SITES.firstOrNull { (h, _) -> host == h || host.endsWith(".$h") }

    /**
     * הניסוי (22/10/2026, בקשת המשתמש — "בועה בכל דף שיש בו סרטון"): כתובת של דף רגיל באתר לא מוכר → הכתובת המלאה,
     * כדי לחפש בו נגן (GrabService.hasVideo). לא דפי חיפוש ולא דפים "פנימיים" של הדפדפן.
     */
    fun page(raw: CharSequence?): String? {
        var s = raw?.toString()?.trim() ?: return null
        if (s.isEmpty() || s.length > 2048 || s.any { it.isWhitespace() }) return null
        if (!Regex("""^https?://""", RegexOption.IGNORE_CASE).containsMatchIn(s)) {
            if (!Regex("""^[\w.-]+\.[a-z]{2,}(:\d+)?/""", RegexOption.IGNORE_CASE).containsMatchIn(s)) return null   // רק עם נתיב — דף בית לא
            s = "https://$s"
        }
        val u = try { URI(s) } catch (e: Exception) { return null }
        val host = (u.host ?: return null).lowercase().removePrefix("www.").removePrefix("m.")
        if (!host.contains('.') || (u.rawPath ?: "").length < 2) return null
        if (Regex("""(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex)\.""").containsMatchIn(host) && (u.rawPath ?: "").startsWith("/search")) return null
        return u.toString()
    }

    /**
     * צומת בעץ הנגישות של הדף = נגן וידאו? Chrome מעביר את התפקיד מה־HTML ב־extras (‏"AccessibilityNodeInfo.chromeRole"),
     * ותיאור תפקיד ב־roleDescription; נגן מערכת — VideoView. טהור (נבדק ב־JVM). לא אומת על כל גרסאות Chrome — ניסוי.
     */
    fun isVideoNode(className: CharSequence?, chromeRole: CharSequence?, roleDesc: CharSequence?): Boolean {
        val r = chromeRole?.toString()?.lowercase() ?: ""
        if (r == "video") return true
        if (className?.toString() == "android.widget.VideoView") return true
        val d = roleDesc?.toString()?.trim()?.lowercase() ?: return false
        return d == "video" || d == "סרטון" || d == "וידאו"
    }

    /** הטקסט מהשורה (כמו שהוא — לרוב בלי https://) → מה להציע */
    fun classify(raw: CharSequence?): Hit {
        var s = raw?.toString()?.trim() ?: return Hit.None
        if (s.isEmpty() || s.length > 2048 || s.any { it.isWhitespace() }) return Hit.None
        if (!Regex("""^https?://""", RegexOption.IGNORE_CASE).containsMatchIn(s)) {
            if (!Regex("""^[\w.-]+\.[a-z]{2,}(:\d+)?([/?#]|$)""", RegexOption.IGNORE_CASE).containsMatchIn(s)) return Hit.None
            s = "https://$s"
        }
        val u = try { URI(s) } catch (e: Exception) { return Hit.None }
        val host0 = (u.host ?: return Hit.None).lowercase().trimEnd('.')
        if (!host0.contains('.')) return Hit.None
        val host = host0.removePrefix("www.").removePrefix("m.").removePrefix("mobile.")
        val path = u.rawPath ?: ""
        val query = u.rawQuery ?: ""
        if (MEDIA_EXT.containsMatchIn(path)) return Hit.Video(u.toString())
        val rule = site(host) ?: return Hit.None
        if (path.isEmpty() || path == "/") return if (query.isEmpty()) Hit.SiteOnly(host) else Hit.None
        val re = rule.second ?: return Hit.Video(u.toString())
        if (!re.containsMatchIn(path)) return Hit.None
        if (host == "youtube.com" && path.startsWith("/watch") && !Regex("""(^|&)v=[\w-]{6,}""").containsMatchIn(query)) return Hit.None
        return Hit.Video(u.toString())
    }
}
