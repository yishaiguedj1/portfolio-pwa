package io.github.yishaiguedj1.snowball.br

import java.net.URL
import java.net.URLDecoder
import java.util.Locale
import java.util.PriorityQueue

/**
 * 03/11/2026 (בקשת המשתמש): סריקת אתר שלם לסרטונים — הלוגיקה הטהורה, בלי רשת ובלי אנדרואיד (`BrScanTest`).
 * הרשת, העוגיות וה־robots — ב־`BrScanAndroid.kt`; המסירה ל־DM — `DmBridge.sendScan`.
 *
 * מה נחשב סרטון: קובץ וידאו ישיר, זרם HLS/DASH, נגן מוטמע מאתר וידאו (yt-dlp), או דף פרק עם נגן.
 * הסדר: לפי המספור באתר (עונה/פרק/חלק, בעברית ובאנגלית), ואחר כך לפי סדר הקישורים בדף.
 *
 * ⛔ עדינות מול השרת: בקשה אחת בכל פעם, לפחות 1.5 שניות בין דפים (+אקראיות), Crawl-delay של robots.txt,
 *    האטה כשהשרת איטי, המתנה ל־Retry-After ב־429/503, ועצירה לבד אחרי כמה סירובים ברצף.
 * ⛔ אבטחה (סריקה כמחובר): רק GET של דפי HTML מאותו אתר; אף פעם לא טופס, לא התנתקות ולא קישור פעולה;
 *    מ־https לא יורדים ל־http; הדפים לא מוצגים ולא מריצים קוד — רק ניתוח טקסט.
 */
object BrScan {
    const val MAX_PAGES = 1000
    const val MAX_ITEMS = 500           // = DmBridge.FILES_MAX
    const val MAX_RAW = 800
    const val HTML_MAX = 3 shl 20
    const val MIN_GAP_MS = 1500L
    const val MAX_GAP_MS = 30_000L
    private const val QUEUE_MAX = 20_000

    /** הדף הפתוח אחרי JS (אתרים שבונים את הרשימה בדפדפן) — רק המסגרת הראשית, רק קריאה */
    const val DOM_JS = "(function(){try{var h=document.documentElement.outerHTML;return h.length>3145728?h.slice(0,3145728):h}catch(e){return ''}})()"

    /** depth 1 = הדף הזה בלבד; prefix = רק כתובות מתחת לנתיב של הדף */
    enum class Mode(val depth: Int, val prefix: Boolean) { PAGE(1, false), LINKS(2, false), SECTION(8, true), SITE(8, false) }

    /** f = קובץ ישיר, s = זרם (HLS/DASH), e = נגן מאתר וידאו, p = דף עם נגן (yt-dlp בודק את הדף) */
    data class Media(val url: String, val kind: Char, val ext: String)
    data class Link(val url: String, val text: String, val next: Boolean, val section: String = "")
    data class Page(val url: String, val title: String, val site: String, val media: List<Media>, val links: List<Link>, val player: Boolean)
    data class Num(val season: Int = -1, val ep: Int = -1, val part: Int = -1) { val has get() = ep >= 0 }
    data class Item(val media: Media, val page: String, val title: String, val num: Num, val seq: Int, val group: String, val groupName: String) {
        val id get() = media.url
        val yt get() = media.kind != 'f'
    }
    data class Group(val key: String, val name: String, val season: Int, val items: List<Item>, val course: String = "", val sec: Int = 0)
    data class Resp(val code: Int, val url: String, val html: String?, val retryAfter: Int = -1, val ms: Long = 0)
    class Robots(val allow: (String) -> Boolean, val delayMs: Long)
    enum class End { DONE, STOPPED, CAP, BUSY, DENIED, FAIL, LOGIN }

    /* ---------------- כתובות ---------------- */

    private val PAGE_EXT = setOf("", "html", "htm", "php", "asp", "aspx", "jsp", "shtml", "xhtml", "cfm")
    val VIDEO_EXT = setOf("mp4", "m4v", "webm", "mkv", "mov", "avi", "flv", "wmv", "3gp", "ogv")
    val STREAM_EXT = setOf("m3u8", "mpd")
    private val TRACK = Regex("^(utm_.*|fbclid|gclid|yclid|msclkid|mc_cid|mc_eid|_ga|_gl|igshid|ref_src|spm)$", RegexOption.IGNORE_CASE)

    /** ⛔ לא נכנסים לעולם — בעיקר כשהסריקה מחוברת: התנתקות, מחיקה, עגלה, חשבון, פעולות, חיפוש, הזנות */
    private val SKIP = Regex(
        "log-?out|sign-?out|logoff|/wp-login|/wp-admin|/login|/signin|/sign-in|/register|/signup|/sign-up|/password|/reset|/auth/|/oauth|/sso" +
            "|/cart|/checkout|/basket|add[-_]to[-_]cart|/order|/payment|/billing|/subscribe|unsubscribe|/account|/my-account|/profile|/settings|/preferences" +
            "|/delete|/remove|/destroy|/edit|/admin|/cdn-cgi/|/wp-json|xmlrpc|/feed/?$|/rss|/comments?/|replytocom=|[?&](action|do|cmd|token|nonce|_wpnonce|delete|logout)=" +
            "|[?&](s|q|search|query)=|/search|/print/|[?&]print=|[?&]share=|/share/|/download/?$|/like/|/vote/|/follow/|/report/" +
            "|/(un)?watch(ed)?/?$|/setfree|/set_?free|/mark|/complete|/progress|/track|[/_-]attach|[/_-]upload|discussion|[/_-]quiz|/captcha|/cable|/bookmark|/favou?rite|/rate/|/enroll|/purchase|/payments?/|shoppingcart|/storage|/api/|/graphql|/ajax",
        RegexOption.IGNORE_CASE)
    private val LOW = Regex("/(tag|tags|author|authors|category|categories|archive|archives|date|about|contact|privacy|terms|faq|help|blog|news|press|careers|jobs)(/|$)|/20\\d\\d/\\d\\d(/|$)", RegexOption.IGNORE_CASE)
    private val HIGH = Regex("watch|video|episode|series|season|serie|lesson|lecture|course|chapter|play|vod|stream|פרק|עונה|סדרה|שיעור|הרצאה|קורס|צפי", RegexOption.IGNORE_CASE)
    private val PAGINATION = Regex("[?&](page|p|pg|paged|start|offset)=\\d+|/page/\\d+/?$|/p/\\d+/?$", RegexOption.IGNORE_CASE)

    fun host(u: String): String = runCatching { URL(u).host.lowercase(Locale.ROOT).removePrefix("www.") }.getOrDefault("")

    fun extOf(u: String): String {
        val p = runCatching { URL(u).path }.getOrNull() ?: u.substringBefore('?').substringBefore('#')
        val last = p.substringAfterLast('/')
        return if ('.' in last) last.substringAfterLast('.').lowercase(Locale.ROOT).take(8) else ""
    }

    /** כתובת נקייה: בלי # ובלי פרמטרי מעקב. null = לא http(s) או לא תקינה */
    fun norm(raw: String, base: String? = null): String? {
        val r = decode(raw.trim()).replace(Regex("[\\r\\n\\t]"), "")
        if (r.isEmpty() || r.startsWith("#") || Regex("^(javascript|mailto|tel|sms|data|blob|about|intent|file):", RegexOption.IGNORE_CASE).containsMatchIn(r)) return null
        val u = runCatching { if (base != null) URL(URL(base), r) else URL(r) }.getOrNull() ?: return null
        val pr = u.protocol.lowercase(Locale.ROOT)
        if (pr != "http" && pr != "https") return null
        if (u.userInfo != null) return null   // user:pass@ בכתובת — לא שולחים
        val q = u.query?.split('&')?.filter { it.isNotEmpty() && !TRACK.matches(it.substringBefore('=')) }?.joinToString("&")
        val port = if (u.port == -1 || u.port == u.defaultPort) "" else ":" + u.port
        return pr + "://" + u.host.lowercase(Locale.ROOT) + port + u.path.ifEmpty { "/" } + (if (q.isNullOrEmpty()) "" else "?$q")
    }

    /** המפתח לכפילויות: בלי פרוטוקול, בלי www ובלי / בסוף */
    fun key(u: String): String = u.substringAfter("://").removePrefix("www.").let { s ->
        val path = s.substringBefore('?'); val q = s.substringAfter('?', "")
        path.trimEnd('/') + (if (q.isEmpty()) "" else "?$q")
    }.lowercase(Locale.ROOT)

    /** הבסיס של "הסעיף": הנתיב של הדף בלי שם קובץ בסוף */
    fun prefixOf(start: String): String {
        val p = runCatching { URL(start).path }.getOrDefault("/").ifEmpty { "/" }
        val last = p.substringAfterLast('/')
        val dir = if ('.' in last || last.matches(Regex("\\d{1,5}"))) p.substringBeforeLast('/') else p
        return dir.trimEnd('/')
    }

    /** ⛔ האם מותר לבקש את הדף בסריקה. httpsOnly — הסריקה התחילה ב־https: לא יורדים ל־http (העוגיות לא עוברות בגלוי) */
    fun crawlable(u: String, host0: String, prefix: String?, httpsOnly: Boolean): Boolean {
        if (httpsOnly && !u.startsWith("https://")) return false
        if (host(u) != host0) return false
        if (extOf(u) !in PAGE_EXT) return false
        if (SKIP.containsMatchIn(u)) return false
        if (prefix != null && prefix.isNotEmpty()) {
            val p = runCatching { URL(u).path }.getOrDefault("").trimEnd('/')
            if (p != prefix && !p.startsWith("$prefix/")) return false
        }
        return u.length < 2000
    }

    fun score(l: Link): Int {
        var s = 0
        val t = l.url + " " + l.text
        if (l.next || PAGINATION.containsMatchIn(l.url)) s += 3
        if (num(l.text).has || EP_WORD.containsMatchIn(l.text)) s += 2
        if (HIGH.containsMatchIn(t)) s += 1
        if (LOW.containsMatchIn(l.url)) s -= 2
        return s
    }

    /* ---------------- ניתוח דף (טקסט בלבד — לא מריצים ולא מציגים) ---------------- */

    private val OPT = setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
    private val ATTR = Regex("([a-zA-Z_:][-a-zA-Z0-9_:.]*)\\s*=\\s*(\"([^\"]*)\"|'([^']*)'|([^\\s\"'>]+))")
    private val A_TAG = Regex("<a\\b([^>]*)>(.*?)</a\\s*>", OPT)
    private val VIDEO_TAG = Regex("<video\\b([^>]*)>(.*?)</video\\s*>", OPT)
    private val SOURCE_TAG = Regex("<source\\b([^>]*)>", OPT)
    private val IFRAME_TAG = Regex("<(iframe|embed)\\b([^>]*)>", OPT)
    private val META_TAG = Regex("<meta\\b([^>]*)>", OPT)
    private val LINK_TAG = Regex("<link\\b([^>]*)>", OPT)
    private val TITLE_TAG = Regex("<title\\b[^>]*>(.*?)</title\\s*>", OPT)
    private val H1_TAG = Regex("<h1\\b[^>]*>(.*?)</h1\\s*>", OPT)
    private val COMMENT = Regex("<!--.*?-->", RegexOption.DOT_MATCHES_ALL)
    private val NOISE = Regex("<(script|style|noscript|template)\\b[^>]*>.*?</\\1\\s*>", OPT)
    private val TAGS = Regex("<[^>]+>")
    private val IN_TEXT = Regex("https?://[^\"'\\s<>()\\\\]+?\\.(?:mp4|m4v|webm|mov|mkv|m3u8|mpd)(?:\\?[^\"'\\s<>()\\\\]*)?(?=[\"'\\s<>()\\\\,;]|$)", RegexOption.IGNORE_CASE)
    private val PLAYER = Regex("<video\\b|jwplayer|video-js|videojs|plyr|flowplayer|mediaelement|hls\\.js|dash\\.js|shaka-player|clappr|vjs-|data-video-?(id|src)", RegexOption.IGNORE_CASE)
    private val ADS = Regex("doubleclick|googlesyndication|googleads|adservice|/ads?/|imasdk|adnxs|taboola|outbrain", RegexOption.IGNORE_CASE)
    private val GENERIC = Regex("^(צפ(ייה|יה)|לצפ(ייה|יה)|צפו|לצפייה עכשיו|watch|watch now|play|more|read more|קרא עוד|לקריאה|עוד|הבא|next|prev|previous|הקודם|»|«|›|‹|>|<|\\d+)$", RegexOption.IGNORE_CASE)
    private val NEXT_TXT = Regex("^(next|older|הבא|הבאים|עמוד הבא|לעמוד הבא|›|»|>|→|←)$", RegexOption.IGNORE_CASE)

    /** נגנים מוכרים: כתובת קנונית ל־yt-dlp, או null */
    fun embed(u: String): String? {
        val h = host(u); val l = u.lowercase(Locale.ROOT)
        Regex("(?:youtube(?:-nocookie)?\\.com/(?:embed/|shorts/|live/|v/|watch\\?(?:.*&)?v=)|youtu\\.be/)([A-Za-z0-9_-]{11})").find(u)
            ?.let { return "https://www.youtube.com/watch?v=" + it.groupValues[1] }
        Regex("(?:player\\.vimeo\\.com/video/|//(?:www\\.)?vimeo\\.com/)(\\d{5,12})(?:/([0-9a-f]{6,20}))?").find(u)?.let { m ->
            val h = m.groupValues[2].ifEmpty { Regex("[?&]h=([0-9a-f]{6,20})").find(u)?.groupValues?.get(1) ?: "" }
            return "https://player.vimeo.com/video/" + m.groupValues[1] + (if (h.isNotEmpty()) "?h=$h" else "")
        }
        Regex("dailymotion\\.com/(?:embed/)?video/([A-Za-z0-9]+)|dai\\.ly/([A-Za-z0-9]+)").find(u)?.let { m ->
            return "https://www.dailymotion.com/video/" + m.groupValues[1].ifEmpty { m.groupValues[2] }
        }
        val known = listOf("wistia.net", "wistia.com", "players.brightcove.net", "kaltura.com", "mediadelivery.net", "streamable.com", "rumble.com/embed",
            "ok.ru/videoembed", "vk.com/video_ext", "player.twitch.tv", "facebook.com/plugins/video", "cdn.jwplayer.com/players", "vidyard.com",
            "loom.com/embed", "odysee.com/$/embed", "archive.org/embed", "embed.ted.com", "sproutvideo.com", "spotlightr.com", "player.cloudinary.com",
            "iframe.videodelivery.net", "customer-", "mux.com", "bilibili.com", "kick.com")
        if (known.any { it in l } && (h.isNotEmpty())) return u
        return null
    }

    fun parse(html: String, url: String): Page {
        val src = COMMENT.replace(html.take(HTML_MAX), " ")
        val metas = META_TAG.findAll(src).map { attrs(it.groupValues[1]) }.toList()
        fun meta(vararg ks: String) = metas.firstOrNull { m -> ks.any { k -> (m["property"] ?: m["name"] ?: "").equals(k, true) } }?.get("content")
        val site = clean(meta("og:site_name") ?: "")
        val title = pageTitle(meta("og:title"), H1_TAG.find(src)?.groupValues?.get(1), TITLE_TAG.find(src)?.groupValues?.get(1), site)
        val media = LinkedHashMap<String, Media>()
        fun add(raw: String?, hint: Char = ' ') {
            val u = norm(raw ?: return, url) ?: return
            if (ADS.containsMatchIn(u)) return
            val e = extOf(u)
            val m = when {
                e in STREAM_EXT -> Media(u, 's', e)
                e in VIDEO_EXT -> Media(u, 'f', e)
                else -> embed(u)?.let { Media(it, 'e', "") } ?: if (hint == 'e') Media(u, 'e', "") else null
            } ?: return
            media.putIfAbsent(key(m.url), m)
        }
        // <video> — חוץ מסרטון רקע (autoplay + muted + loop)
        VIDEO_TAG.findAll(src).forEach { v ->
            val a = attrs(v.groupValues[1])
            if ("autoplay" in a && "muted" in a && "loop" in a) return@forEach
            add(a["src"] ?: a["data-src"])
            SOURCE_TAG.findAll(v.groupValues[2]).forEach { s -> attrs(s.groupValues[1]).let { add(it["src"] ?: it["data-src"]) } }
        }
        listOf("og:video:secure_url", "og:video:url", "og:video", "twitter:player:stream").forEach { k -> add(meta(k)) }
        IFRAME_TAG.findAll(src).forEach { f ->
            val a = attrs(f.groupValues[2])
            val s = a["src"] ?: a["data-src"] ?: a["data-lazy-src"] ?: return@forEach
            val n = norm(s, url) ?: return@forEach
            val generic = Regex("embed|player|video", RegexOption.IGNORE_CASE).containsMatchIn(n.substringAfter("://").substringAfter('/'))
            add(s, if (generic) 'e' else ' ')
        }
        // JSON-LD / סקריפטים: contentUrl / embedUrl / כתובות וידאו בטקסט (גם עם \/)
        val flat = src.replace("\\/", "/").replace("\\u002F", "/", ignoreCase = true)
        Regex("\"(?:contentUrl|embedUrl)\"\\s*:\\s*\"([^\"]+)\"").findAll(flat).forEach { add(it.groupValues[1]) }
        IN_TEXT.findAll(flat).take(60).forEach { add(it.value) }
        // קישורים — מהדף בלי סקריפטים
        val body = NOISE.replace(src, " ")
        val links = LinkedHashMap<String, Link>()
        LINK_TAG.findAll(src).forEach { l -> val a = attrs(l.groupValues[1]); if (a["rel"]?.lowercase(Locale.ROOT)?.split(' ')?.contains("next") == true) norm(a["href"] ?: "", url)?.let { links[key(it)] = Link(it, "", true) } }
        A_TAG.findAll(body).forEach { m ->
            val a = attrs(m.groupValues[1])
            val u = norm(a["href"] ?: return@forEach, url) ?: return@forEach
            val inner = m.groupValues[2]
            val alt = Regex("alt\\s*=\\s*\"([^\"]*)\"", RegexOption.IGNORE_CASE).find(inner)?.groupValues?.get(1)
            val text = clean(TAGS.replace(inner, " ")).ifEmpty { clean(a["title"] ?: a["aria-label"] ?: alt ?: "") }.take(200)
            val next = a["rel"]?.lowercase(Locale.ROOT)?.split(' ')?.contains("next") == true || NEXT_TXT.matches(text)
            val e = extOf(u)
            if (e in VIDEO_EXT || e in STREAM_EXT || embed(u) != null) { add(u); return@forEach }
            val k = key(u)
            val old = links[k]
            if (old == null || (old.text.isEmpty() && text.isNotEmpty()) || (next && !old.next)) links[k] = Link(u, if (old != null && text.isEmpty()) old.text else text, next || old?.next == true)
            if (links.size > 5000) return@forEach
        }
        // נתוני JSON בתוך הדף (React/Next/Nuxt, ld+json, data-*-props): קישורים לשיעורים (עם שם ופרק) וסרטונים לפי מזהה
        val blobs = JSON_SCRIPT.findAll(src).map { it.groupValues[1] }.toMutableList()
        DATA_PROPS.findAll(src).forEach { blobs.add(decode(it.groupValues[1])) }
        var budget = 3 shl 20
        blobs.forEach { b ->
            if (b.length > budget) return@forEach
            budget -= b.length
            val v = runCatching { org.json.JSONTokener(b.trim()).nextValue() }.getOrNull() ?: return@forEach
            JsonWalk(url, ::add) { l -> val k = key(l.url); if (links[k]?.text.isNullOrEmpty() || l.section.isNotEmpty()) links[k] = l }.walk(v, "", "", 0)
        }
        return Page(url, title, site, media.values.toList(), links.values.toList(), PLAYER.containsMatchIn(src))
    }

    private val JSON_SCRIPT = Regex("<script\\b[^>]*(?:type\\s*=\\s*[\"'](?:application/(?:ld\\+)?json)[\"']|id\\s*=\\s*[\"']__(?:NEXT|NUXT)_DATA__[\"'])[^>]*>(.*?)</script\\s*>", OPT)
    private val DATA_PROPS = Regex("\\sdata-(?:react-)?props\\s*=\\s*\"([^\"]{2,2000000})\"", OPT)
    /** מפתחות שערכם כתובת של דף תוכן (לא פעולה) */
    private val LINK_KEY = Regex("^(path|url|href|link|permalink|canonical_?url|(lesson|episode|page|watch|item|post|chapter|video_?page)_?(path|url|link)|next|prev(ious)?|next_?(lesson_?)?(path|url))$", RegexOption.IGNORE_CASE)
    private val NAME_KEY = listOf("lesson_name", "lessonName", "episode_name", "title", "name", "label", "heading", "displayName", "display_name")
    private val SECTION_KEY = listOf("section_name", "sectionName", "chapter_name", "chapterName", "module_name", "moduleName", "season_name", "unit_name")
    private val VID_KEY = Regex("^(video_?id|vimeo_?id|youtube_?id|yt_?id|wistia_?id|hashed_?id|media_?id|external_?id)$", RegexOption.IGNORE_CASE)

    /** הליכה על JSON: עד עומק 40 ו־60 אלף צמתים. לא מבקשת כלום — רק אוספת */
    private class JsonWalk(val base: String, val media: (String?, Char) -> Unit, val link: (Link) -> Unit) {
        var nodes = 0
        fun walk(v: Any?, name: String, section: String, depth: Int) {
            if (depth > 40 || ++nodes > 60_000) return
            when (v) {
                is org.json.JSONArray -> for (i in 0 until minOf(v.length(), 5000)) walk(v.opt(i), name, section, depth + 1)
                is org.json.JSONObject -> obj(v, section, depth)
            }
        }
        private fun str(o: org.json.JSONObject, ks: List<String>) = ks.firstNotNullOfOrNull { k -> o.optString(k).takeIf { it.isNotBlank() && it.length <= 300 } } ?: ""
        private fun obj(o: org.json.JSONObject, section0: String, depth: Int) {
            val nm = clean(str(o, NAME_KEY)).take(200)
            val sec = clean(str(o, SECTION_KEY)).ifEmpty { section0 }.take(200)
            // סרטון לפי מזהה וספק: {type: "vimeo", videoId: 123}
            val prov = (o.optString("type") + " " + o.optString("provider") + " " + o.optString("source") + " " + o.optString("platform") + " " + o.optString("host")).lowercase(Locale.ROOT)
            val keys = o.keys().asSequence().toList()
            for (k in keys) {
                val x = o.opt(k)
                if (x is String || x is Number) {
                    val s = x.toString().trim()
                    if (VID_KEY.matches(k) && s.isNotEmpty()) {
                        val kp = k.lowercase(Locale.ROOT) + " " + prov
                        val u = when {
                            "vimeo" in kp && s.matches(Regex("\\d{5,12}")) -> "https://player.vimeo.com/video/$s" + (o.optString("hash").ifEmpty { o.optString("h") }.takeIf { it.matches(Regex("[0-9a-f]{6,20}")) }?.let { "?h=$it" } ?: "")
                            ("youtube" in kp || k.startsWith("yt", true)) && s.matches(Regex("[A-Za-z0-9_-]{11}")) -> "https://www.youtube.com/watch?v=$s"
                            "wistia" in kp && s.matches(Regex("[a-z0-9]{6,20}")) -> "https://fast.wistia.net/embed/iframe/$s"
                            "dailymotion" in kp && s.matches(Regex("[A-Za-z0-9]{5,12}")) -> "https://www.dailymotion.com/video/$s"
                            else -> null
                        }
                        if (u != null) media(u, 'e')
                        continue
                    }
                    if (x !is String || s.length > 2000) continue
                    if (s.startsWith("http") || s.startsWith("//")) {
                        val e = extOf(s)
                        if (e in VIDEO_EXT || e in STREAM_EXT || embed(s) != null) { media(s, ' '); continue }
                    }
                    if (LINK_KEY.matches(k) && (s.startsWith("/") || s.startsWith("http")) && !s.startsWith("//")) {
                        val u = norm(s, base) ?: continue
                        // "הבא"/"הקודם" — השם שליד הוא של השיעור הנוכחי, לא של היעד
                        val nav = k.lowercase(Locale.ROOT).let { it.startsWith("next") || it.startsWith("prev") }
                        if (host(u) == host(base)) link(Link(u, if (nav) "" else nm, false, if (nav) "" else sec))
                    }
                } else if (x is org.json.JSONObject || x is org.json.JSONArray) walk(x, nm, if (x is org.json.JSONArray && nm.isNotEmpty() && sec == section0) nm.takeIf { depth > 0 } ?: sec else sec, depth + 1)
            }
        }
    }

    private fun attrs(s: String): Map<String, String> {
        val m = HashMap<String, String>()
        ATTR.findAll(s).forEach { a -> m.putIfAbsent(a.groupValues[1].lowercase(Locale.ROOT), a.groupValues[3].ifEmpty { a.groupValues[4] }.ifEmpty { a.groupValues[5] }) }
        Regex("(?:^|\\s)(autoplay|muted|loop)(?=\\s|$|/)", RegexOption.IGNORE_CASE).findAll(s).forEach { m.putIfAbsent(it.groupValues[1].lowercase(Locale.ROOT), "") }
        return m
    }

    fun decode(s: String): String = s.replace(Regex("&(#x[0-9a-fA-F]{1,6}|#\\d{1,7}|amp|lt|gt|quot|apos|nbsp|#39);")) { m ->
        val v = m.groupValues[1]
        when {
            v.startsWith("#x", true) -> v.drop(2).toIntOrNull(16)?.let { cp -> runCatching { String(Character.toChars(cp)) }.getOrNull() } ?: m.value
            v.startsWith("#") -> v.drop(1).toIntOrNull()?.let { cp -> runCatching { String(Character.toChars(cp)) }.getOrNull() } ?: m.value
            else -> when (v) { "amp" -> "&"; "lt" -> "<"; "gt" -> ">"; "quot" -> "\""; "apos" -> "'"; "nbsp" -> " "; else -> m.value }
        }
    }

    fun clean(s: String): String = decode(TAGS.replace(s, " ")).replace(Regex("[\\s\\u200e\\u200f\\u202a-\\u202e]+"), " ").trim()

    /** הכותרת בלי שם האתר ("פרק 3 | האתר" → "פרק 3") */
    fun pageTitle(og: String?, h1: String?, title: String?, site: String): String {
        var t = clean(og ?: "").ifEmpty { clean(h1 ?: "") }.ifEmpty { clean(title ?: "") }
        if (site.isNotEmpty() && t.length > site.length + 3) {
            for (sep in listOf(" | ", " - ", " – ", " — ", " :: ", " · ")) {
                if (t.endsWith(sep + site, true)) { t = t.dropLast(sep.length + site.length); break }
                if (t.startsWith(site + sep, true)) { t = t.drop(site.length + sep.length); break }
            }
        }
        if (" | " in t) t = t.substringBeforeLast(" | ").ifEmpty { t }
        return t.take(200).trim()
    }

    /* ---------------- המספור ---------------- */

    private const val PRE = "(?<![\\p{L}\\p{N}])"
    private val ORD = mapOf("ראשון" to 1, "ראשונה" to 1, "שני" to 2, "שנייה" to 2, "שניה" to 2, "שלישי" to 3, "שלישית" to 3, "רביעי" to 4, "רביעית" to 4,
        "חמישי" to 5, "חמישית" to 5, "שישי" to 6, "שישית" to 6, "שביעי" to 7, "שביעית" to 7, "שמיני" to 8, "שמינית" to 8, "תשיעי" to 9, "תשיעית" to 9,
        "עשירי" to 10, "עשירית" to 10, "first" to 1, "second" to 2, "third" to 3, "fourth" to 4, "fifth" to 5, "sixth" to 6, "seventh" to 7,
        "eighth" to 8, "ninth" to 9, "tenth" to 10, "one" to 1, "two" to 2, "three" to 3, "four" to 4, "five" to 5, "six" to 6, "seven" to 7, "eight" to 8, "nine" to 9, "ten" to 10)
    private val ORD_ALT = ORD.keys.sortedByDescending { it.length }.joinToString("|")
    private const val SEASON_W = "[ובלהמש]?עונה|season|saison|staffel|temporada|stagione|сезон|series"
    private const val EP_W = "[ובלהמש]?פרק|episode|episodio|épisode|folge|серия|эпизод|ep|chapter|ch|lesson|lecture|[ובלהמש]?שיעור|[ובלהמש]?הרצאה|module|[ובלהמש]?מודול|unit|[ובלהמש]?יחידה|video|[ובלהמש]?סרטון|day|יום|week|שבוע"
    private const val PART_W = "part|pt|[ובלהמש]?חלק|vol|volume|כרך"
    private val SXE = Regex("${PRE}s(\\d{1,2})[\\s._-]*e(\\d{1,4})(?!\\d)", RegexOption.IGNORE_CASE)
    private val NXN = Regex("${PRE}(\\d{1,2})x(\\d{1,3})(?![\\d\\p{L}])", RegexOption.IGNORE_CASE)
    private val SEASON = Regex("$PRE(?:$SEASON_W)\\.?\\s*[:#.-]?\\s*(\\d{1,3}|$ORD_ALT)(?![\\d\\p{L}])", RegexOption.IGNORE_CASE)
    private val EP = Regex("$PRE(?:$EP_W)\\.?\\s*(?:no\\.?|מס['׳]?|מספר)?\\s*[:#.-]?\\s*(\\d{1,4}|$ORD_ALT)(?![\\d\\p{L}])", RegexOption.IGNORE_CASE)
    private val EP_HASH = Regex("(?:^|\\s)#(\\d{1,4})(?!\\d)")
    private val PART = Regex("$PRE(?:$PART_W)\\.?\\s*[:#.-]?\\s*(\\d{1,3}|$ORD_ALT)(?![\\d\\p{L}])", RegexOption.IGNORE_CASE)
    private val EP_WORD = Regex("$PRE(?:$EP_W|$SEASON_W|$PART_W)(?!\\p{L})", RegexOption.IGNORE_CASE)
    private val LEAD_NUM = Regex("^(\\d{1,3})(?:\\s*[.):\\-–—]\\s+|\\s+-\\s+)")
    private val TAIL_NUM = Regex("(?<![\\d.,:/])(\\d{1,3})\\s*$")
    private val URL_NUM = Regex("(?:^|[-_.])(\\d{1,4})(?:[-_.]|$)")

    private fun ordNum(s: String): Int = s.toIntOrNull() ?: ORD[s.lowercase(Locale.ROOT)] ?: -1

    /** עונה/פרק/חלק מטקסט אחד (כותרת, טקסט קישור). אין = Num() */
    fun num(text: String): Num {
        val s = text.replace('_', ' ')
        SXE.find(s)?.let { return Num(it.groupValues[1].toInt(), it.groupValues[2].toInt(), PART.find(s)?.let { p -> ordNum(p.groupValues[1]) } ?: -1) }
        NXN.find(s)?.let { m -> if (!Regex("\\d{3,4}x\\d{3,4}").containsMatchIn(s)) return Num(m.groupValues[1].toInt(), m.groupValues[2].toInt()) }
        val season = SEASON.find(s)?.let { ordNum(it.groupValues[1]) } ?: -1
        var ep = EP.findAll(s).map { ordNum(it.groupValues[1]) }.firstOrNull { it >= 0 } ?: EP_HASH.find(s)?.groupValues?.get(1)?.toInt() ?: -1
        var part = PART.find(s)?.let { ordNum(it.groupValues[1]) } ?: -1
        if (ep < 0) LEAD_NUM.find(s.trim())?.let { ep = it.groupValues[1].toInt() }
        if (ep < 0 && part >= 0) { ep = part; part = -1 }
        if (ep < 0 && season >= 0) TAIL_NUM.find(s.trim())?.let { ep = it.groupValues[1].toInt() }
        return Num(season, ep, part)
    }

    /** מספר מהכתובת (‎/episode-12/‎, ‎/s2/e5‎) — רק כשאין בטקסט */
    fun numUrl(u: String): Num {
        val path = runCatching { URLDecoder.decode(URL(u).path, "UTF-8") }.getOrDefault("")
        val segs = path.split('/').filter { it.isNotEmpty() }
        val n = num(segs.takeLast(2).joinToString(" ") { it.replace('-', ' ') })
        if (n.has) return n
        val last = segs.lastOrNull()?.substringBeforeLast('.') ?: return Num()
        val m = URL_NUM.findAll(last).map { it.groupValues[1].toInt() }.filter { it !in 1900..2100 }.lastOrNull() ?: return Num()
        return Num(-1, m)
    }

    /** המפתח לסדרה: הכותרת בלי מספרי פרק/עונה/חלק ובלי סימנים */
    fun seriesKey(t: String): String = seriesName(t).lowercase(Locale.ROOT).replace(Regex("[^\\p{L}]+"), "")

    fun seriesName(t: String): String {
        var s = t
        listOf(SXE, NXN, SEASON, EP, PART, EP_HASH).forEach { s = it.replace(s, " ") }
        s = s.replace(Regex("\\b\\d{1,4}\\b"), " ").replace(Regex("[\\s|:·•,.\\-–—()\\[\\]]+$"), "").replace(Regex("^[\\s|:·•,.\\-–—()\\[\\]]+"), "")
        return s.replace(Regex("\\s{2,}"), " ").trim()
    }

    /* ---------------- סידור ---------------- */

    data class Raw(val media: Media, val page: String, val pageTitle: String, val label: String, val seq: Int, val idx: Int, val n: Int, val section: String = "")

    /** הממצאים → פריטים מסודרים לפי קבוצה (סדרה+עונה) ומספור. סרטון שמופיע ב־3 דפים ומעלה = של כל האתר (טריילר/פרסומת) — לא נכנס */
    fun order(raw: List<Raw>, siteName: String = ""): List<Group> {
        val pagesPer = raw.groupBy { key(it.media.url) }.mapValues { e -> e.value.map { it.page }.distinct().size }
        val best = LinkedHashMap<String, Raw>()
        raw.forEach { r ->
            val k = key(r.media.url)
            if ((pagesPer[k] ?: 0) >= 3) return@forEach
            val o = best[k]
            if (o == null || r.n < o.n) best[k] = r
        }
        // כותרת שחוזרת ב־3 דפים ומעלה = כותרת כללית של האתר (אתר JS) — אז טקסט הקישור עדיף
        val shared = best.values.groupBy { it.pageTitle }.filter { (t, l) -> t.isNotEmpty() && l.map { it.page }.distinct().size >= 3 }.keys
        val items = best.values.sortedBy { it.seq }.map { r ->
            val label = r.label.takeIf { it.length >= 3 && !GENERIC.matches(it) } ?: ""
            val pt = r.pageTitle.takeIf { it !in shared } ?: ""
            val base = (if (r.n > 1) "" else if (pt.isEmpty() || (num(label).has && !num(pt).has)) label else pt).ifEmpty { pt }.ifEmpty { label }.ifEmpty { r.pageTitle }.ifEmpty { host(r.page) }
            var n = if (r.n > 1) Num() else num(label).takeIf { it.has } ?: num(pt).takeIf { it.has } ?: numUrl(r.page)
            if (!n.has && r.media.kind == 'f') n = num(r.media.url.substringAfterLast('/').substringBefore('?').substringBeforeLast('.').replace('-', ' '))
            val title = if (r.n > 1) "$base · ${r.idx + 1}" else base
            val (g, gn) = when {
                r.n > 1 -> ("p:" + key(r.page)) to r.pageTitle.ifEmpty { host(r.page) }
                n.has -> (seriesKey(base) + "|" + n.season) to seriesName(base)
                else -> "" to ""
            }
            if (r.n > 1 && !n.has) n = Num(-1, r.idx + 1)
            // האתר עצמו מחלק לפרקים/חלקים (נתוני הקורס) — זה הסדר הנכון
            if (r.section.isNotEmpty() && r.n <= 1) return@map Item(r.media, r.page, title, n, r.seq, "s:" + r.section, r.section)
            Item(r.media, r.page, title, n, r.seq, g, gn)
        }
        // סדרה עם פריט אחד בלבד ושם שונה מכל השאר — כנראה כותרות בלי שם סדרה משותף: מאחדים לקבוצה לפי עונה
        val counts = items.groupingBy { it.group }.eachCount()
        val heur = { g: String -> g.isNotEmpty() && !g.startsWith("p:") && !g.startsWith("s:") }
        val singles = items.count { heur(it.group) && counts[it.group] == 1 }
        val merged = if (singles >= 3) items.map { if (heur(it.group) && counts[it.group] == 1) it.copy(group = "|" + it.num.season, groupName = "") else it } else items
        // שם הקורס: הכותרת שחוזרת בדפים (או האתר)
        val course = shared.firstOrNull() ?: siteName
        var sec = 0
        val groups = merged.groupBy { it.group }
        return groups.entries.sortedWith(compareBy<Map.Entry<String, List<Item>>>({ it.key.isEmpty() }, { e -> e.value.minOf { it.seq } })).map { (k, l) ->
            val sorted = if (k.isEmpty() || k.startsWith("s:")) l.sortedBy { it.seq } else l.sortedWith(compareBy({ it.num.season }, { it.num.ep }, { it.num.part }, { it.seq }))
            Group(k, l.first().groupName.ifEmpty { siteName }, l.first().num.season, sorted, course, if (k.startsWith("s:")) ++sec else 0)
        }
    }

    /** שם הקובץ: "S01E02 - כותרת" / "03 - כותרת" (אפסים לפי הגדול בקבוצה, כדי שהקבצים יסתדרו בתיקייה) */
    fun fileName(i: Item, g: Group): String {
        val w = maxOf(2, (g.items.maxOfOrNull { x -> x.num.ep } ?: 0).toString().length)
        val pad = { n: Int -> n.toString().padStart(w, '0') }
        val pre = when {
            g.key.startsWith("s:") -> (g.items.indexOf(i) + 1).toString().padStart(maxOf(2, g.items.size.toString().length), '0')
            !i.num.has || g.key.isEmpty() -> ""
            i.num.season >= 0 -> "S" + i.num.season.toString().padStart(2, '0') + "E" + pad(i.num.ep) + (if (i.num.part >= 0) "-" + i.num.part else "")
            else -> pad(i.num.ep) + (if (i.num.part >= 0) "." + i.num.part else "")
        }
        val t = i.title.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}]+"), " ").replace(Regex("\\s+"), " ").trim().take(120)
        val base = listOf(pre, t).filter { s -> s.isNotEmpty() }.joinToString(" - ").ifEmpty { "video" }
        return if (i.media.kind == 'f') "$base.${i.media.ext}" else base
    }

    /** תיקייה אחת לכל סריקה: שם הסדרה/האתר */
    fun folder(g: Group, site: String): String {
        val c = { x: String -> x.replace(Regex("[\\\\/:*?\"<>|\\p{Cntrl}.]+"), " ").replace(Regex("\\s+"), " ").trim().take(60) }
        // קורס עם חלקים: "הקורס/01 חלק ראשון" (שתי רמות — DmFolders)
        if (g.key.startsWith("s:")) return c(g.course.ifEmpty { site }) + "/" + g.sec.toString().padStart(2, '0') + " " + c(g.name).take(50)
        return c(g.name.ifEmpty { site })
    }

    /* ---------------- הקצב ---------------- */

    /** Crawl-delay מ־robots.txt (שניות → מ״ש, עד 30 שניות). 0 = אין */
    fun crawlDelay(txt: String?, agent: String = "studiodm"): Long {
        var mine = false; var any = false; var d = -1.0; var star = -1.0
        (txt ?: "").take(512 * 1024).lines().forEach { raw ->
            val l = raw.substringBefore('#').trim(); val k = l.substringBefore(':').trim().lowercase(Locale.ROOT); val v = l.substringAfter(':', "").trim()
            when (k) {
                "user-agent" -> { val a = v.lowercase(Locale.ROOT); mine = a != "*" && agent.startsWith(a); any = a == "*" }
                "crawl-delay" -> v.toDoubleOrNull()?.let { if (mine) d = it else if (any) star = it }
            }
        }
        val s = if (d >= 0) d else star
        return if (s <= 0) 0 else (s * 1000).toLong().coerceAtMost(MAX_GAP_MS)
    }

    /** הקצב מול השרת: מרווח בסיס + אקראיות, האטה כשהשרת איטי, וסבלנות לסירובים */
    class Pace(private val minMs: Long = MIN_GAP_MS, var robotsMs: Long = 0, private val rnd: (Int) -> Int = { java.util.Random().nextInt(it) }) {
        private var slow = 0L; private var busy = 0; private var denied = 0; private var errs = 0
        fun gap(): Long { val b = maxOf(minMs, robotsMs, slow).coerceAtMost(MAX_GAP_MS); return b + b * rnd(50) / 100 }
        /** תשובה תקינה: הזמן שלקח לשרת לענות */
        fun ok(ms: Long) { busy = 0; denied = 0; errs = 0; slow = if (ms > 2000) minOf(ms * 2, MAX_GAP_MS) else slow * 3 / 4 }
        /** 429/503: כמה לחכות לפני ניסיון חוזר; -1 = לעצור (4 ברצף) */
        fun busy(retryAfterSec: Int): Long {
            if (++busy > 3) return -1
            slow = maxOf(slow, minMs * 2 * busy)
            return (if (retryAfterSec > 0) retryAfterSec * 1000L else 10_000L shl (busy - 1)).coerceIn(5_000, 120_000)
        }
        /** 401/403 ברצף 3 פעמים = האתר חוסם */
        fun denied(): Boolean = ++denied >= 3
        /** תקלת רשת ברצף 5 פעמים = עוצרים */
        fun error(): Boolean { slow = maxOf(slow, minMs * 2); return ++errs >= 5 }
    }

    /* ---------------- הסריקה ---------------- */

    class State {
        @Volatile var pages = 0
        @Volatile var queued = 0
        @Volatile var cur = ""
        val raw = ArrayList<Raw>()
        var site = ""
    }

    /**
     * BFS לפי עדיפות (עומק, ציון, סדר בדף). seed = ה־HTML של הדף שכבר פתוח (ה־DOM אחרי JS) — לא מבקשים אותו שוב.
     * דפי המשך (עמוד 2, "הבא") לא מוסיפים עומק. fetch מקבל רק כתובת שעברה את crawlable.
     */
    fun run(start: String, mode: Mode, cap: Int, seed: String?, fetch: (String) -> Resp?, robots: (String) -> Robots, sleep: (Long) -> Unit,
            stop: () -> Boolean, st: State, onChange: () -> Unit): End {
        val s0 = norm(start) ?: return End.FAIL
        val host0 = host(s0)
        val httpsOnly = s0.startsWith("https://")
        val prefix = if (mode.prefix) prefixOf(s0) else null
        val limit = cap.coerceIn(1, MAX_PAGES)
        data class Q(val url: String, val depth: Int, val score: Int, val seq: Int, val text: String, val section: String = "")
        val q = PriorityQueue<Q>(compareBy<Q>({ it.depth }, { -it.score }, { it.seq }))
        val seen = HashSet<String>()
        var seq = 0
        var r: Robots? = null
        val pace = Pace()
        q.add(Q(s0, 1, 0, seq++, "")); seen.add(key(s0))
        var first = true
        var hits = 0   // בקשות שכבר יצאו לשרת (robots.txt נחשב) — מרווח לפני כל בקשה אחריהן
        var end = End.DONE
        while (q.isNotEmpty()) {
            if (stop()) { end = End.STOPPED; break }
            if (st.pages >= limit) { end = End.CAP; break }
            if (st.raw.size >= MAX_RAW) { end = End.CAP; break }
            val cq = q.poll() ?: break
            st.queued = q.size; st.cur = cq.url
            val page: Page
            if (first && seed != null) {
                page = parse(seed, s0)
            } else {
                if (r == null) { r = robots(host0); pace.robotsMs = r.delayMs; hits++ }
                val path = runCatching { URL(cq.url).let { u -> u.path.ifEmpty { "/" } + (u.query?.let { x -> "?$x" } ?: "") } }.getOrDefault("/")
                if (!r.allow(path)) { first = false; continue }
                if (hits > 0) sleep(pace.gap())
                if (stop()) { end = End.STOPPED; break }
                var res = fetch(cq.url); hits++
                var giveUp: End? = null
                while (res != null && (res.code == 429 || res.code == 503)) {
                    val w = pace.busy(res.retryAfter)
                    if (w < 0) { giveUp = End.BUSY; break }
                    sleep(w)
                    if (stop()) { giveUp = End.STOPPED; break }
                    res = fetch(cq.url); hits++
                }
                if (giveUp != null) { end = giveUp; break }
                if (res == null) { if (pace.error()) { end = End.FAIL; break }; sleep(pace.gap() * 4); first = false; continue }
                if (res.code == 401 || res.code == 403) { if (first || pace.denied()) { end = End.DENIED; break }; first = false; continue }
                if (res.code !in 200..299 || res.html == null) { first = false; continue }
                pace.ok(res.ms)
                // הפניה לדף התחברות = ההתחברות פגה — לא ממשיכים בלי לדעת
                val fu = norm(res.url) ?: cq.url
                if (!first && BrDev.sensitive(fu) && !BrDev.sensitive(cq.url)) { end = End.LOGIN; break }
                if (host(fu) != host0 || (httpsOnly && !fu.startsWith("https://"))) { first = false; continue }
                page = parse(res.html, fu)
            }
            first = false
            st.pages++
            if (st.site.isEmpty()) st.site = page.site
            // ממצאים
            val ms = page.media.ifEmpty {
                // דף פרק עם נגן בלי כתובת גלויה — yt-dlp יבדוק את הדף עצמו
                if (page.player && (num(cq.text).has || num(page.title).has || cq.depth == 1)) listOf(Media(page.url, 'p', "")) else emptyList()
            }
            // השם והחלק של הדף עצמו — גם מהרשומה שלו ברשימת השיעורים שבדף (הדף הפתוח, או קישור בלי טקסט)
            val self = page.links.firstOrNull { key(it.url) == key(page.url) }
            val lbl = cq.text.ifEmpty { self?.text ?: "" }; val sct = cq.section.ifEmpty { self?.section ?: "" }
            synchronized(st.raw) { ms.forEachIndexed { i, m -> st.raw.add(Raw(m, page.url, page.title, lbl, cq.seq * 1000 + i, i, ms.size, sct)) } }
            // הקישורים הבאים
            page.links.forEach { l ->
                if (q.size >= QUEUE_MAX) return@forEach
                val k = key(l.url)
                if (k in seen || !crawlable(l.url, host0, prefix, httpsOnly)) return@forEach
                val pag = l.next || PAGINATION.containsMatchIn(l.url)
                val d = if (pag) cq.depth else cq.depth + 1
                if (d > mode.depth) return@forEach
                seen.add(k)
                q.add(Q(l.url, d, score(l), seq++, if (pag) cq.text else l.text, if (pag) cq.section else l.section))
            }
            onChange()
        }
        st.queued = q.size; st.cur = ""
        onChange()
        return end
    }
}
