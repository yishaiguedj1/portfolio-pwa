package io.github.yishaiguedj1.snowball.br

import io.github.yishaiguedj1.snowball.dm.DmCookies
import io.github.yishaiguedj1.snowball.dm.DmFetch
import io.github.yishaiguedj1.snowball.dm.DmRobots

/**
 * 03/11/2026: סריקת אתר — הרשת (הלוגיקה ב־`BrScan`).
 *
 * ⛔ אבטחה — סריקה כמחובר:
 *  - הסיסמה לא עוברת כאן לעולם: מתחברים לאתר בדפדפן עצמו, והסורק משתמש בעוגיות שכבר יש לדפדפן.
 *  - העוגיות נלקחות מ־CookieManager לפי הכתובת של כל בקשה וכל קפיצת הפניה (`DmFetch.open`) — כך הן מגיעות רק לאתר שלהן,
 *    ועוגייה עם Secure לא נשלחת ב־http. ‏`BrScan.crawlable` מגביל לאותו אתר, ובסריקה שהתחילה ב־https — רק https.
 *  - כרטיסייה פרטית: בלי עוגיות בכלל.
 *  - רק GET של HTML (בדיקת Content-Type, עד 3MB, עד 8 הפניות); הדף לא נטען ב־WebView ולא מריץ קוד.
 *  - שום דבר לא נשמר בדיסק ולא נכתב ללוג: הרשימה בזיכרון בלבד.
 */
object BrScanAndroid {

    fun fetcher(ua: String, cookies: Boolean): (String) -> BrScan.Resp? = { url ->
        val t0 = System.currentTimeMillis()
        runCatching {
            val c = DmFetch.open(url, "", ua, mapOf("Accept" to "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language" to "he,en;q=0.8"),
                cookies = if (cookies) { u -> runCatching { DmCookies.get().getCookie(u) }.getOrNull() } else null)
            try {
                val code = c.responseCode
                val ra = c.getHeaderField("Retry-After")?.trim()?.toIntOrNull() ?: -1
                val type = (c.contentType ?: "").lowercase()
                val html = if (code in 200..299 && (type.isEmpty() || "html" in type)) c.inputStream.use { s -> read(s, BrScan.HTML_MAX, charset(type)) } else null
                if (code !in 200..299) runCatching { c.errorStream?.close() }
                BrScan.Resp(code, c.url.toString(), html, ra, System.currentTimeMillis() - t0)
            } finally { c.disconnect() }
        }.getOrElse { e ->
            // יותר מדי הפניות (למשל שיעור נעול שמפנה בלולאה) = דף שלא נכנסים אליו, לא "אין חיבור"
            if (e is io.github.yishaiguedj1.snowball.dm.DmHttpError) BrScan.Resp(e.status, url, null) else null
        }
    }

    /** robots.txt — בקשה אחת לסריקה, בלי עוגיות */
    fun robots(ua: String, https: Boolean): (String) -> BrScan.Robots = { host ->
        val txt = runCatching {
            val c = DmFetch.open((if (https) "https://" else "http://") + host + "/robots.txt", "", ua)
            try {
                if (c.responseCode in 200..299 && (c.contentType ?: "").lowercase().let { !it.contains("html") }) c.inputStream.use { read(it, 256 * 1024, Charsets.UTF_8) } else null
            } finally { c.disconnect() }
        }.getOrNull()
        val r = DmRobots.parse(txt)
        BrScan.Robots({ p -> r.allowed(p) }, BrScan.crawlDelay(txt))
    }

    /** האם יש לדפדפן עוגיות לאתר (= כנראה מחובר) — לתצוגה בלבד, הערך עצמו לא יוצא מכאן */
    fun hasSession(url: String): Boolean = runCatching { !DmCookies.get().getCookie(url).isNullOrBlank() }.getOrDefault(false)

    private fun charset(type: String) = runCatching {
        Regex("charset=([\\w-]+)").find(type)?.groupValues?.get(1)?.let { java.nio.charset.Charset.forName(it) }
    }.getOrNull() ?: Charsets.UTF_8

    private fun read(s: java.io.InputStream, max: Int, cs: java.nio.charset.Charset): String {
        val b = java.io.ByteArrayOutputStream(); val buf = ByteArray(16 * 1024)
        while (b.size() < max) { val n = s.read(buf); if (n < 0) break; b.write(buf, 0, n) }
        return String(b.toByteArray(), cs)
    }
}
