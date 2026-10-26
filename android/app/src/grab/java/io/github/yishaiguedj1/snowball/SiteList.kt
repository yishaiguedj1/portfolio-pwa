package io.github.yishaiguedj1.snowball

import java.net.URI

/**
 * 26/10/2026 (שלב 1 בתוכנית הדפדפן): האתרים שבהם הורדת דרך הדפדפן של DM — שם כנראה צריך את ההתחברות שבדפדפן
 * של DM, ולכן הבועה ב־Chrome מופיעה בהם ופותחת את הדף שם (לא שולחת אותו להורדה בלי ההתחברות). טהור (JVM).
 * רק שמות אתרים — בלי כתובות מלאות ובלי עוגיות. DM שומר (DmPrefs) ומגיש לבועה דרך DmSitesProvider.
 */
object SiteList {
    const val MAX = 300

    fun norm(host: String?): String =
        host?.trim()?.lowercase()?.trimEnd('.')?.removePrefix("www.")?.removePrefix("m.") ?: ""

    /** שם האתר מכתובת, גם כמו שהיא בשורת הכתובת (בלי https://) */
    fun hostOf(url: String?): String {
        val s = url?.trim() ?: return ""
        val full = if (Regex("""^https?://""", RegexOption.IGNORE_CASE).containsMatchIn(s)) s else "https://$s"
        return norm(try { URI(full).host } catch (e: Exception) { null })
    }

    /** החדש בראש, בלי כפולים, עד MAX */
    fun add(list: List<String>, host: String): List<String> {
        val h = norm(host)
        if (!h.contains('.') || h.length > 253) return list
        return (listOf(h) + list.filter { it != h }).take(MAX)
    }

    /** האתר עצמו או אתר־אב שנשמר (‎video.site.com ← site.com) */
    fun has(sites: Collection<String>, host: String): Boolean {
        var h = norm(host)
        while (h.contains('.')) {
            if (h in sites) return true
            h = h.substringAfter('.')
        }
        return false
    }

    fun parse(s: String?): List<String> =
        (s ?: "").split('\n').map(::norm).filter { it.contains('.') }.distinct().take(MAX)
}
