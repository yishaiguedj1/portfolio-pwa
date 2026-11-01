package io.github.yishaiguedj1.snowball.dm

import java.net.URL
import java.util.Locale

/*
 * 01/11/2026 — השדרוג "מקצועי", סבב 2 (docs/dm-upgrade-plan.md). החלק הטהור, בלי אנדרואיד: נבדק ב־testDm (DmRound2Test).
 *  · DmPageLinks — "כל הקישורים בדף" (פריט 4) ובדיקה מקוונת של הרשימה (46);
 *  · DmBond — Wi‑Fi וסלולר יחד (1): איזה חיבור הולך בסלולר, ותקרה יומית;
 *  · DmRefresh — רענון אוטומטי של קישור שפג (8): איזה מהקישורים שנמצאו בדף הוא אותו קובץ;
 *  · DmGrow — צפייה תוך כדי הורדה (9): כמה בתים רצופים כבר בקובץ מנקודה מסוימת.
 */

/** "כל הקישורים בדף": הקבצים שהדף מקשר אליהם, לפי הסוג, בלי כפולים */
object DmPageLinks {
    data class L(val url: String, val name: String, val cat: DmName.Cat, val ext: String)

    const val MAX = 2000
    const val MAX_HTML = 4 * 1024 * 1024

    private val ATTR = Regex("""(?:href|src|data-src|data-href|data-url|poster|content)\s*=\s*(["'])(.*?)\1""", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))
    private val BASE = Regex("""<base\s[^>]*href\s*=\s*(["'])(.*?)\1""", RegexOption.IGNORE_CASE)
    private val SRCSET = Regex("""srcset\s*=\s*(["'])(.*?)\1""", RegexOption.IGNORE_CASE)
    /** סיומות של דפים — לא "קובץ להורדה" */
    private val PAGE_EXT = setOf("html", "htm", "php", "asp", "aspx", "jsp", "cgi", "shtml", "xhtml", "js", "css", "json", "xml", "svg", "ico", "woff", "woff2", "ttf")
    /** סוגים שאינם בקטגוריה אבל הם בבירור קבצים */
    private val FILE_EXT = setOf("exe", "msi", "dmg", "iso", "img", "bin", "deb", "rpm", "torrent", "jar", "xapk", "apks", "apkm", "m3u8", "mpd", "cbz", "cbr", "odt", "ods", "rtf", "psd", "ai", "mobi", "azw3")

    private fun unescape(s: String) = s.replace("&amp;", "&").replace("&#38;", "&").replace("&quot;", "\"").replace("&#39;", "'").replace("&lt;", "<").replace("&gt;", ">").trim()

    /** הקבצים שבדף. base = הכתובת של הדף (אחרי הפניות). רק http/https, בלי עוגן, עד MAX */
    fun extract(html: String, base: String): List<L> {
        val root = runCatching { URL(base) }.getOrNull() ?: return emptyList()
        val b = BASE.find(html)?.groupValues?.get(2)?.let { runCatching { URL(root, unescape(it)) }.getOrNull() } ?: root
        val raw = ArrayList<String>()
        ATTR.findAll(html).forEach { raw.add(it.groupValues[2]) }
        SRCSET.findAll(html).forEach { m -> m.groupValues[2].split(',').forEach { raw.add(it.trim().substringBefore(' ')) } }
        val seen = HashSet<String>(); val out = ArrayList<L>()
        for (r0 in raw) {
            if (out.size >= MAX) break
            val r = unescape(r0)
            if (r.isEmpty() || r.length > 4096 || r.startsWith("#") || r.startsWith("javascript:", true) || r.startsWith("mailto:", true) || r.startsWith("data:", true) || r.startsWith("tel:", true)) continue
            val u = runCatching { URL(b, r) }.getOrNull() ?: continue
            if (u.protocol != "http" && u.protocol != "https" || u.host.isNullOrEmpty()) continue
            val s = u.toString().substringBefore('#')
            if (!seen.add(s)) continue
            val name = DmName.fromUrl(s)
            val e = DmName.ext(name)
            if (e.isEmpty() || e in PAGE_EXT) continue
            val c = DmName.cat(name, "")
            if (c == DmName.Cat.OTHER && e !in FILE_EXT) continue
            out.add(L(s, name, c, e))
        }
        return out
    }

    /** הדף עצמו (רק HTML, עד MAX_HTML) — הכתובת שאחרי ההפניות ותוכן */
    fun fetch(url: String, ref: String, ua: String, cookies: ((String) -> String?)? = null): Pair<String, String> {
        val c = DmFetch.open(url, ref, ua, mapOf("Accept" to "text/html,application/xhtml+xml"), cookies)
        try {
            if (c.responseCode !in 200..299) throw DmHttpError(c.responseCode, -1)
            val ct = (c.contentType ?: "").lowercase(Locale.ROOT)
            if (!ct.contains("html")) throw java.io.IOException("not_html")
            val cs = Regex("charset=([\\w-]+)").find(ct)?.groupValues?.get(1)?.let { runCatching { charset(it) }.getOrNull() } ?: Charsets.UTF_8
            val buf = java.io.ByteArrayOutputStream()
            c.inputStream.use { inp ->
                val b = ByteArray(32 * 1024)
                while (buf.size() < MAX_HTML) { val n = inp.read(b); if (n < 0) break; buf.write(b, 0, minOf(n, MAX_HTML - buf.size())) }
            }
            return c.url.toString() to String(buf.toByteArray(), cs)
        } finally { runCatching { c.disconnect() } }
    }

    /** הבדיקה המקוונת של קישור אחד: גודל וסוג, או קוד תקלה */
    data class Check(val size: Long, val mime: String, val ok: Boolean, val code: String = "")

    fun check(url: String, ref: String, ua: String, cookies: ((String) -> String?)? = null): Check = try {
        val p = DmFetch.probe(url, ref, ua, cookies)
        Check(p.total, p.mime, !p.mime.startsWith("text/html"), if (p.mime.startsWith("text/html")) "page" else "")
    } catch (e: Throwable) {
        val v = if (e is DmHttpError) DmRetry.http(e.status) else DmRetry.io(e)
        Check(-1, "", false, v.code)
    }
}

/**
 * Wi‑Fi וסלולר יחד (פריט 1): חלק מהחיבורים של הורדה אחת עוברים בסלולר, והשאר ב־Wi‑Fi — שתי הרשתות במקביל.
 * רק כשההגדרה דלוקה, רק כשהטלפון ב־Wi‑Fi (בסלולר בלבד אין מה לאחד), ועד התקרה היומית של נפח סלולרי.
 */
object DmBond {
    const val DEFAULT_CAP_MB = 500
    val CAPS_MB = listOf(100, 250, 500, 1000, 2000, 0)   // 0 = בלי תקרה

    /** החיבור הזה (לפי המספר שלו בהורדה) בסלולר? כל חיבור שני, וכשיש רק אחד — לא */
    fun cellular(slot: Int, conns: Int, on: Boolean, onWifi: Boolean, usedToday: Long, capMb: Int): Boolean {
        if (!on || !onWifi || conns < 2) return false
        if (capMb > 0 && usedToday >= capMb * 1024L * 1024L) return false
        return slot % 2 == 1
    }

    /** היום (לספירת הנפח היומי), לפי שעון המכשיר */
    fun day(now: Long, tzOffsetMs: Long): Long = (now + tzOffsetMs) / 86_400_000L
}

/**
 * רענון אוטומטי של קישור שפג (פריט 8): הדף נטען מחדש ברקע, הצייד אוסף את הקישורים, וכל אחד נבדק.
 * אותו קובץ = אותו גודל בדיוק, ואם יש שם עם סיומת — אותה סיומת. בלי גודל ידוע — אין רענון אוטומטי (אולי קובץ אחר).
 */
object DmRefresh {
    /** הקודים שבהם שווה לנסות: הקישור פג / נחסם / נעלם */
    val CODES = setOf("expired", "gone", "blocked", "login", "http_403", "http_404", "http_410", "http_401")

    fun worth(t: DmTask): Boolean = t.kind == DmKind.HTTP && t.total > 0 && t.ref.startsWith("http") && t.err in CODES && t.autoRefresh < MAX_AUTO

    const val MAX_AUTO = 2

    fun same(t: DmTask, size: Long, name: String): Boolean {
        if (size != t.total || size <= 0) return false
        val a = DmName.ext(t.name); val b = DmName.ext(name)
        return a.isEmpty() || b.isEmpty() || a == b
    }

    /** הראשון מהמועמדים שהוא אותו קובץ (מועמד = כתובת + מה שהבדיקה החזירה) */
    fun pick(t: DmTask, cands: List<Pair<String, DmProbe>>): Pair<String, DmProbe>? =
        cands.firstOrNull { (u, p) -> u != t.url && p.ranges && same(t, p.total, DmName.pick(p.disposition, p.finalUrl, p.mime)) }
            ?: cands.firstOrNull { (u, p) -> u != t.url && same(t, p.total, DmName.pick(p.disposition, p.finalUrl, p.mime)) }
}

/**
 * צפייה תוך כדי הורדה (פריט 9): הנגן קורא מהקובץ שבכתיבה. מותר לו לקרוא רק בתים שכבר ירדו — כמה בתים רצופים יש מנקודה
 * מסוימת, לפי המקטעים. כשאין — הנגן מחכה, וההורדה מקבלת "בקשה" להתחיל חיבור מאותה נקודה (DmFetch.want).
 */
object DmGrow {
    /** כמה בתים רצופים כבר בקובץ מ־pos (0 = עוד לא) */
    fun avail(segs: List<Seg>, total: Long, pos: Long): Long {
        if (total > 0 && pos >= total) return 0
        var p = pos
        var progress = true
        while (progress) {
            progress = false
            for (s in segs) {
                val done = minOf(s.pos, s.end)
                if (s.start <= p && done > p) { p = done; progress = true }
            }
        }
        return p - pos
    }

    /** הקובץ כולו נגמר מ־pos והלאה? */
    fun toEnd(segs: List<Seg>, total: Long, pos: Long) = total > 0 && pos + avail(segs, total, pos) >= total
}
