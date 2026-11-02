package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.io.OutputStream
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.ServerSocket
import java.net.Socket
import java.net.URL
import java.net.URLDecoder
import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Locale

/*
 * 02/11/2026 — השדרוג "מקצועי", סבב 4ב: הכללים הטהורים (testDm/DmRound4bTest).
 * 12 שרת זמני ברשת הבית, 11 קוד מהמחשב, 18 כניסות לאתרים (Basic/Digest), 31 רשת מתקדמת, 24 נדידה ומצב חו"ל,
 * 28 ספרייה מקצועית, 30 רשימות חריגים, 39 גיליון הוספה חכם, 41 סיכום יומי.
 */

/* ---------- 12: מהטלפון למחשב ברשת הבית ---------- */

/**
 * שרת HTTP זמני לקובץ אחד: כתובת עם אסימון אקראי (בקוד ה־QR) + PIN שמוקלד בדפדפן של המחשב. נסגר אחרי העברה מלאה,
 * אחרי `ttlMs`, או אחרי 5 ניסיונות PIN שגויים. בלי JavaScript בדף, בלי עוגיות, תומך ב־Range (המשך הורדה).
 */
class DmLanServer(
    private val name: String, private val size: Long, private val mime: String,
    private val open: (Long) -> InputStream,
    val pin: String = pinNew(), val token: String = tokenNew(),
    private val ttlMs: Long = 10 * 60_000L,
    private val onEnd: (Boolean) -> Unit = {},
) {
    private var ss: ServerSocket? = null
    @Volatile var closed = false; private set
    @Volatile var sent = 0L; private set
    private var bad = 0
    private val started = System.currentTimeMillis()
    val port get() = ss?.localPort ?: 0

    fun start(bind: InetAddress?): Int {
        val s = ServerSocket(); s.reuseAddress = true
        s.bind(InetSocketAddress(bind, 0), 8); s.soTimeout = 1000
        ss = s
        Thread {
            while (!closed) {
                if (System.currentTimeMillis() - started > ttlMs) { stop(false); break }
                val c = try { s.accept() } catch (e: java.net.SocketTimeoutException) { continue } catch (e: Throwable) { break }
                Thread { runCatching { serve(c) }; runCatching { c.close() } }.apply { isDaemon = true }.start()
            }
        }.apply { isDaemon = true; name = "dm-lan" }.start()
        return s.localPort
    }

    fun stop(done: Boolean) {
        if (closed) return
        closed = true; runCatching { ss?.close() }; onEnd(done)
    }

    private fun serve(c: Socket) {
        c.soTimeout = 30_000
        val r = BufferedReader(InputStreamReader(c.getInputStream(), Charsets.ISO_8859_1))
        val line = r.readLine() ?: return
        val hdr = HashMap<String, String>()
        while (true) { val h = r.readLine() ?: break; if (h.isEmpty()) break; if (hdr.size < 50) hdr[h.substringBefore(':').trim().lowercase(Locale.ROOT)] = h.substringAfter(':', "").trim() }
        val parts = line.split(' ')
        val out = c.getOutputStream()
        if (parts.size < 2 || (parts[0] != "GET" && parts[0] != "HEAD")) return reply(out, 405, "text/plain", "")
        val path = parts[1].substringBefore('?'); val q = query(parts[1].substringAfter('?', ""))
        if (closed) return reply(out, 410, "text/plain", "")
        when (path) {
            "/$token" -> reply(out, 200, "text/html; charset=utf-8", page(false))
            "/$token/f" -> {
                if (bad >= 5) { stop(false); return reply(out, 410, "text/plain", "") }
                if (q["pin"] != pin) { synchronized(this) { bad++ }; return reply(out, 403, "text/html; charset=utf-8", page(true)) }
                file(out, hdr["range"], parts[0] == "HEAD")
            }
            else -> reply(out, 404, "text/plain", "")
        }
    }

    private fun file(out: OutputStream, range: String?, head: Boolean) {
        val m = range?.let { Regex("^bytes=(\\d+)-(\\d*)$").find(it.trim()) }
        val a = m?.groupValues?.get(1)?.toLongOrNull() ?: 0L
        val b = m?.groupValues?.get(2)?.toLongOrNull()?.coerceAtMost(size - 1) ?: (size - 1)
        if (a > b || a >= size) return reply(out, 416, "text/plain", "")
        val len = b - a + 1
        val fn = name.replace(Regex("[\"\\\\\r\n]"), "_")
        val enc = java.net.URLEncoder.encode(name, "UTF-8").replace("+", "%20")
        val h = StringBuilder()
        h.append(if (m != null) "HTTP/1.1 206 Partial Content\r\n" else "HTTP/1.1 200 OK\r\n")
        h.append("Content-Type: ${mime.ifEmpty { "application/octet-stream" }}\r\nContent-Length: $len\r\nAccept-Ranges: bytes\r\n")
        if (m != null) h.append("Content-Range: bytes $a-$b/$size\r\n")
        h.append("Content-Disposition: attachment; filename=\"$fn\"; filename*=UTF-8''$enc\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n")
        out.write(h.toString().toByteArray(Charsets.UTF_8))
        if (head) { out.flush(); return }
        open(a).use { inp ->
            val buf = ByteArray(64 * 1024); var left = len
            while (left > 0 && !closed) {
                val n = inp.read(buf, 0, minOf(buf.size.toLong(), left).toInt()); if (n < 0) break
                out.write(buf, 0, n); left -= n; sent += n
            }
            out.flush()
            if (left == 0L && b == size - 1) stop(true)   // הקובץ הגיע עד הסוף — נסגר
        }
    }

    private fun page(wrong: Boolean): String {
        val esc = name.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        return "<!doctype html><html dir=rtl lang=he><meta charset=utf-8><meta name=viewport content=\"width=device-width\"><title>Studio DM</title>" +
            "<body style=\"font:18px system-ui;max-width:420px;margin:40px auto;padding:0 16px\"><h2>Studio DM</h2><p>$esc</p>" +
            (if (wrong) "<p style=color:#c00>PIN ✗</p>" else "") +
            "<form action=\"/$token/f\" method=get><input name=pin inputmode=numeric autocomplete=off maxlength=8 placeholder=PIN " +
            "style=\"font-size:22px;width:9em;padding:8px\" autofocus> <button style=\"font-size:20px;padding:8px 18px\">⬇</button></form></body></html>"
    }

    private fun reply(out: OutputStream, st: Int, type: String, body: String) {
        val b = body.toByteArray(Charsets.UTF_8)
        out.write(("HTTP/1.1 $st X\r\nContent-Type: $type\r\nContent-Length: ${b.size}\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n").toByteArray(Charsets.UTF_8))
        out.write(b); out.flush()
    }

    private fun query(q: String): Map<String, String> = q.split('&').filter { '=' in it }.associate {
        it.substringBefore('=') to runCatching { URLDecoder.decode(it.substringAfter('='), "UTF-8") }.getOrDefault("")
    }

    fun url(host: String) = "http://$host:$port/$token"

    companion object {
        private val rnd = SecureRandom()
        fun pinNew() = String.format(Locale.US, "%06d", rnd.nextInt(1_000_000))
        fun tokenNew(): String { val b = ByteArray(12); rnd.nextBytes(b); return b.joinToString("") { "%02x".format(it) } }
        /** כתובת IPv4 פרטית של הטלפון ברשת הבית (10/8, 172.16/12, 192.168/16) — לא ציבורית */
        fun lanOk(ip: String): Boolean {
            val p = ip.split('.').mapNotNull { it.toIntOrNull() }
            if (p.size != 4 || p.any { it !in 0..255 }) return false
            return p[0] == 10 || (p[0] == 172 && p[1] in 16..31) || (p[0] == 192 && p[1] == 168)
        }
    }
}

/* ---------- 11: מהמחשב לטלפון (קוד QR מהתוסף) ---------- */

object DmScan {
    /** מה שנסרק: קישור studiodm://add?url=… (מהתוסף), או כתובת http/https רגילה. בלי עוגיות, תמיד עם הגיליון */
    fun parse(raw: String?): DmApi.Req? {
        val s = (raw ?: "").trim().take(8192)
        DmApi.fromUri(s)?.let { return it }
        val u = DmLink.first(s)
        if (u.isEmpty() || u != s) return null
        return DmApi.parse({ if (it == "url") u else null }, false)
    }
}

/* ---------- 18: כניסות לאתרים ---------- */

/** שם משתמש וסיסמה לאתר אחד בדיוק (בלי תת־דומיינים). הסיסמה נשמרת מוצפנת ב־Keystore (בשכבת אנדרואיד), לא כאן */
data class DmCred(val host: String, val user: String, val pass: String)

object DmAuth {
    fun basic(user: String, pass: String) = "Basic " + java.util.Base64.getEncoder().encodeToString("$user:$pass".toByteArray(Charsets.UTF_8))

    fun hostOf(s: String): String = (DmLink.host(if (s.contains("://")) s else "https://$s")).takeIf { Regex("^[a-z0-9.-]{1,253}$").matches(it) } ?: ""

    /** WWW-Authenticate → (סוג, פרמטרים). רק Basic ו־Digest */
    fun challenge(h: String?): Pair<String, Map<String, String>>? {
        val s = (h ?: "").trim()
        val type = s.substringBefore(' ').lowercase(Locale.ROOT)
        if (type != "basic" && type != "digest") return null
        val m = HashMap<String, String>()
        Regex("(\\w+)\\s*=\\s*(?:\"([^\"]*)\"|([^,\\s]+))").findAll(s.substringAfter(' ', "")).forEach { m[it.groupValues[1].lowercase(Locale.ROOT)] = it.groupValues[2].ifEmpty { it.groupValues[3] } }
        return type to m
    }

    /** RFC 7616 (‏MD5 / SHA-256, ‏qop=auth או בלי) → הכותרת Authorization */
    fun digest(ch: Map<String, String>, user: String, pass: String, method: String, uri: String, cnonce: String, nc: Int = 1): String? {
        val algo = (ch["algorithm"] ?: "MD5").uppercase(Locale.ROOT)
        val j = when (algo) { "MD5" -> "MD5"; "SHA-256" -> "SHA-256"; else -> return null }
        val realm = ch["realm"] ?: return null; val nonce = ch["nonce"] ?: return null
        fun h(x: String) = MessageDigest.getInstance(j).digest(x.toByteArray(Charsets.UTF_8)).joinToString("") { "%02x".format(it) }
        val qop = ch["qop"]?.split(',')?.map { it.trim() }?.let { if ("auth" in it) "auth" else return null }
        val ha1 = h("$user:$realm:$pass"); val ha2 = h("$method:$uri")
        val ncs = String.format(Locale.US, "%08x", nc)
        val resp = if (qop != null) h("$ha1:$nonce:$ncs:$cnonce:$qop:$ha2") else h("$ha1:$nonce:$ha2")
        val sb = StringBuilder("Digest username=\"$user\", realm=\"$realm\", nonce=\"$nonce\", uri=\"$uri\", response=\"$resp\"")
        if (algo != "MD5" || ch.containsKey("algorithm")) sb.append(", algorithm=$algo")
        ch["opaque"]?.let { sb.append(", opaque=\"$it\"") }
        if (qop != null) sb.append(", qop=$qop, nc=$ncs, cnonce=\"$cnonce\"")
        return sb.toString()
    }

    fun parse(s: String?): List<Pair<String, String>> {
        val a = runCatching { JSONArray(s ?: "") }.getOrNull() ?: return emptyList()
        return (0 until minOf(a.length(), 100)).mapNotNull { i -> a.optJSONObject(i)?.let { o -> hostOf(o.optString("h")).takeIf { it.isNotEmpty() }?.let { it to o.optString("u").take(200) } } }
    }
}

/* ---------- 31: רשת מתקדמת (הגדרות המנוע — נקבעות מהשכבה של אנדרואיד) ---------- */

object DmNet {
    /** פרוקסי לבחירה (‏null = ישיר) */
    @Volatile var proxy: Proxy? = null
    @Volatile var connectMs = 20_000
    @Volatile var readMs = 30_000
    /** User-Agent לפי אתר (‏host → UA); ריק = של ההורדה */
    @Volatile var uaRules: Map<String, String> = emptyMap()
    /** כניסה לאתר: host → (משתמש, סיסמה). נשאל רק לאתר עצמו */
    @Volatile var creds: (String) -> DmCred? = { null }
    /** אתרים שכבר ביקשו Basic — נשלח מראש בפעם הבאה (רק ב־https) */
    private val basicHosts = java.util.Collections.synchronizedSet(HashSet<String>())

    fun openRaw(u: URL): java.net.URLConnection = proxy?.let { u.openConnection(it) } ?: u.openConnection()

    fun uaFor(host: String, ua: String): String = uaRules[host] ?: uaRules.entries.firstOrNull { host.endsWith("." + it.key) }?.value ?: ua

    /** כותרת שנשלחת מראש (Basic, אחרי שהאתר ביקש פעם אחת), או null */
    fun preAuth(u: URL): String? {
        val h = DmLink.host(u.toString())
        if (u.protocol != "https" || h !in basicHosts) return null
        return creds(h)?.let { DmAuth.basic(it.user, it.pass) }
    }

    /** תשובת 401 → הכותרת לניסיון החוזר (פעם אחת), או null. Basic רק ב־https (אחרת הסיסמה עוברת גלויה) */
    fun answer(u: URL, method: String, wwwAuth: List<String>): String? {
        val h = DmLink.host(u.toString())
        val c = creds(h) ?: return null
        val chs = wwwAuth.mapNotNull { DmAuth.challenge(it) }
        chs.firstOrNull { it.first == "digest" }?.let { (_, m) ->
            val uri = (u.path.ifEmpty { "/" }) + (u.query?.let { "?$it" } ?: "")
            return DmAuth.digest(m, c.user, c.pass, method, uri, DmLanServer.tokenNew().take(16))
        }
        if (chs.any { it.first == "basic" } && u.protocol == "https") { basicHosts.add(h); return DmAuth.basic(c.user, c.pass) }
        return null
    }

    /** "http://host:port" / "socks://host:port" / "host:port" (‏HTTP) → פרוקסי; לא תקין → null */
    fun parseProxy(s: String?): Proxy? {
        val t = (s ?: "").trim(); if (t.isEmpty()) return null
        val socks = t.startsWith("socks", true)
        val hp = t.substringAfter("://")
        val host = hp.substringBeforeLast(':'); val port = hp.substringAfterLast(':', "").trimEnd('/').toIntOrNull() ?: return null
        if (!Regex("^[A-Za-z0-9.-]{1,253}$").matches(host) || port !in 1..65535) return null
        return Proxy(if (socks) Proxy.Type.SOCKS else Proxy.Type.HTTP, InetSocketAddress.createUnresolved(host, port))
    }

    val UA_PRESETS = mapOf(
        "desktop" to "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
        "mobile" to DmFetch.UA,
    )

    /** "host=desktop|mobile|<UA>" בכל שורה */
    fun parseUa(s: String?): Map<String, String> = (s ?: "").lines().mapNotNull { l ->
        val h = DmAuth.hostOf(l.substringBefore('=').trim()); val v = l.substringAfter('=', "").trim()
        if (h.isEmpty() || v.isEmpty() || '\r' in v) null else h to (UA_PRESETS[v] ?: v.take(300))
    }.take(100).toMap()
}

/* ---------- 24: נדידה ומצב חו"ל ---------- */

object DmTravel {
    enum class Act { OK, WIFI_ONLY, ASK }

    /**
     * roaming = הרשת הסלולרית הפעילה בנדידה. until = מצב חו"ל עד (0 = כבוי). roamOk = בחו"ל מותר גם בנדידה (חבילה בחו"ל).
     * בלי מצב חו"ל ובנדידה → רק Wi‑Fi, ושואלים את המשתמש (התראה) אם להפעיל מצב חו"ל.
     */
    fun act(roaming: Boolean, until: Long, roamOk: Boolean, now: Long): Act = when {
        until > now -> if (roaming && !roamOk) Act.WIFI_ONLY else if (!roamOk) Act.WIFI_ONLY else Act.OK
        roaming -> Act.ASK
        else -> Act.OK
    }

    /** מצב חו"ל שתאריך הסיום שלו עבר — כבה (חוזר לרגיל) */
    fun expired(until: Long, now: Long) = until in 1..now

    /** "עד" = סוף היום שנבחר (23:59:59 בשעון המקומי) */
    fun endOfDay(y: Int, m: Int, d: Int, tz: java.util.TimeZone = java.util.TimeZone.getDefault()): Long {
        val c = java.util.Calendar.getInstance(tz); c.clear(); c.set(y, m - 1, d, 23, 59, 59); return c.timeInMillis
    }
}

/* ---------- 28: ספרייה מקצועית ---------- */

object DmLib {
    enum class Sort { DATE, SIZE, SITE, NAME }
    data class Q(val text: String = "", val sort: Sort = Sort.DATE, val tag: String = "", val queue: String = "")

    fun tags(s: String?): List<String> = (s ?: "").split(',').map { it.trim().take(24) }.filter { it.isNotEmpty() }.distinct().take(10)
    fun allTags(ts: List<DmTask>): List<String> = ts.flatMap { tags(it.tags) }.groupingBy { it }.eachCount().entries.sortedByDescending { it.value }.map { it.key }.take(30)

    fun apply(ts: List<DmTask>, q: Q): List<DmTask> {
        val f = ts.filter { t ->
            (q.text.isBlank() || DmFind.match(q.text, t.name, t.title, DmLink.host(t.url), t.note, t.tags)) &&
                (q.tag.isEmpty() || q.tag in tags(t.tags)) && (q.queue.isEmpty() || t.q == q.queue)
        }
        return when (q.sort) {
            Sort.DATE -> f.sortedByDescending { it.finishedAt.takeIf { v -> v > 0 } ?: it.created }
            Sort.SIZE -> f.sortedByDescending { if (it.total > 0) it.total else it.got }
            Sort.SITE -> f.sortedWith(compareBy<DmTask> { DmLink.host(it.url) }.thenByDescending { it.finishedAt })
            Sort.NAME -> f.sortedBy { it.name.ifEmpty { it.title }.lowercase(Locale.ROOT) }
        }
    }

    /** "לנקות הורדות שהסתיימו לפני X ימים" (מהרשימה בלבד — הקובץ נשאר). 0 = כבוי */
    fun stale(ts: List<DmTask>, days: Int, now: Long): List<String> =
        if (days <= 0) emptyList() else ts.filter { it.state == DmState.DONE && it.finishedAt > 0 && now - it.finishedAt > days * 86_400_000L }.map { it.id }
}

/* ---------- 30: רשימות חריגים ---------- */

object DmExcl {
    /** שורה = אתר (‏example.com — כולל תת־דומיינים) או סיומת (‏.exe) */
    fun parse(s: String?): Pair<Set<String>, Set<String>> {
        val hosts = HashSet<String>(); val exts = HashSet<String>()
        (s ?: "").lines().map { it.trim().lowercase(Locale.ROOT) }.filter { it.isNotEmpty() }.take(200).forEach { l ->
            if (l.startsWith(".") && l.length in 2..9 && l.drop(1).all { it.isLetterOrDigit() }) exts.add(l.drop(1))
            else DmAuth.hostOf(l).takeIf { it.isNotEmpty() }?.let { hosts.add(it) }
        }
        return hosts to exts
    }

    fun blocked(url: String, ex: Pair<Set<String>, Set<String>>): Boolean {
        val h = DmLink.host(url)
        if (ex.first.any { h == it || h.endsWith(".$it") }) return true
        return DmName.ext(DmName.fromUrl(url)).lowercase(Locale.ROOT) in ex.second
    }
}

/* ---------- 39: גיליון הוספה חכם ---------- */

object DmSmart {
    enum class K { EMPTY, ONE, LIST, PATTERN, BACKUP, METALINK, FEED, STUDIODM, MAGNET, TEXT }

    /** מה הודבק — מזהים לפי הצורה בלבד (בלי רשת). FEED/METALINK לפי הסיומת; לפי הסוג מהשרת — בבדיקה */
    fun kind(text: String?): K {
        val t = (text ?: "").trim()
        if (t.isEmpty()) return K.EMPTY
        if (t.startsWith("magnet:", true)) return K.MAGNET
        if (t.startsWith(DmApi.SCHEME + "://", true)) return K.STUDIODM
        if (DmMeta4.looks(t)) return K.METALINK
        return when (val p = DmImport.parse(t)) {
            is DmImport.Parsed.Backup -> K.BACKUP
            is DmImport.Parsed.Links -> when {
                p.pattern -> K.PATTERN
                p.urls.size > 1 -> K.LIST
                DmMeta4.isUrl(p.urls[0]) -> K.METALINK
                feedUrl(p.urls[0]) -> K.FEED
                else -> K.ONE
            }
            DmImport.Parsed.Empty -> K.TEXT
        }
    }

    fun feedUrl(u: String) = Regex("(\\.(rss|atom)(\\?|$)|/feed/?(\\?|$)|/rss/?(\\?|$)|feeds/videos\\.xml|[?&]format=rss)", RegexOption.IGNORE_CASE).containsMatchIn(u)

    fun feedMime(m: String) = m.lowercase(Locale.ROOT).let { it.contains("rss") || it.contains("atom") }
    fun metaMime(m: String) = m.lowercase(Locale.ROOT).contains("metalink")
}

/* ---------- 41: סיכום יומי ---------- */

object DmDaily {
    data class Day(val day: Int, val bytes: Long, val ms: Long, val done: Int, val failed: Int)

    fun parse(s: String?): Day = runCatching {
        val o = JSONObject(s ?: "")
        Day(o.optInt("d"), o.optLong("b"), o.optLong("ms"), o.optInt("ok"), o.optInt("bad"))
    }.getOrDefault(Day(0, 0, 0, 0, 0))

    fun dump(d: Day): String = JSONObject().put("d", d.day).put("b", d.bytes).put("ms", d.ms).put("ok", d.done).put("bad", d.failed).toString()

    /** הוספת ריצה (‏day = yyyymmdd). יום אחר — מתחילים מחדש (הקודם חוזר כ־second לסיכום) */
    fun add(cur: Day, day: Int, bytes: Long, ms: Long, ok: Boolean?, ): Pair<Day, Day?> {
        val base = if (cur.day == day) cur else Day(day, 0, 0, 0, 0)
        val n = base.copy(bytes = base.bytes + bytes.coerceAtLeast(0), ms = base.ms + ms.coerceAtLeast(0),
            done = base.done + if (ok == true) 1 else 0, failed = base.failed + if (ok == false) 1 else 0)
        return n to (if (cur.day != day && cur.day != 0 && (cur.done + cur.failed) > 0) cur else null)
    }

    /** ממוצע בבתים לשנייה (לפי זמן ההורדה בפועל) */
    fun avg(d: Day) = if (d.ms <= 0) 0L else d.bytes * 1000 / d.ms

    fun worth(d: Day) = d.done + d.failed > 0
}
