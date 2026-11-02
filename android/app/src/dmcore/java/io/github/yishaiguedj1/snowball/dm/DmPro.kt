package io.github.yishaiguedj1.snowball.dm

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.io.SequenceInputStream
import java.net.HttpURLConnection
import java.net.InetAddress
import java.util.zip.CRC32
import java.util.zip.Inflater
import java.util.zip.InflaterInputStream

/*
 * השדרוג "מקצועי", סבב 1 (01/11/2026, בקשת המשתמש — docs/dm-upgrade-plan.md, לפי ת־הורדות).
 * ליבה בלי אנדרואיד, נבדקת ב־JVM (testDm/DmProTest):
 *  · DmPattern — הורדה סדרתית לפי תבנית: ‎…/ep[01-40].mp4‎;
 *  · DmZipPeek — מה יש בתוך ZIP/APK לפני שמורידים (Range לסוף הקובץ), והורדה של קובץ אחד מתוכו;
 *  · DmApk — שם החבילה, הגרסה וההרשאות מתוך AndroidManifest.xml הבינארי (גם מההצצה, בלי להוריד את ה־APK);
 *  · DmHeat — פחות חיבורים ומהירות כשהטלפון חם / הסוללה נמוכה;
 *  · DmDiag — "למה זה לא יורד?": הסבר + פעולה מוצעת, ובדיקה חיה שלב אחר שלב.
 */

/** תבנית בכתובת: ‏[01-40] (ריפוד לפי האורך), ‏[1-9], ‏[a-z]. כמה סוגריים = כל הצירופים, עד MAX */
object DmPattern {
    private val RE = Regex("\\[(\\d{1,6})-(\\d{1,6})]|\\[([a-zA-Z])-([a-zA-Z])]")

    /** התבנית רק אחרי שם המארח — ‏[::1] של IPv6 הוא לא תבנית */
    private fun pathStart(url: String): Int {
        val s = url.indexOf("://").takeIf { it > 0 } ?: return -1
        val p = url.indexOf('/', s + 3)
        return if (p < 0) url.length else p
    }

    fun has(url: String): Boolean {
        if (!url.startsWith("http", true)) return false
        val p = pathStart(url); if (p < 0) return false
        return RE.containsMatchIn(url.substring(p))
    }

    /** כמה כתובות התבנית תיתן (בלי לבנות אותן) */
    fun count(url: String): Long {
        val p = pathStart(url); if (p < 0) return 0
        var n = 1L
        for (m in RE.findAll(url.substring(p))) { n *= values(m).size.toLong(); if (n > 1_000_000) return n }
        return n
    }

    private fun values(m: MatchResult): List<String> {
        val g = m.groupValues
        return if (g[1].isNotEmpty()) {
            val a = g[1].toLong(); val b = g[2].toLong()
            val pad = if (g[1].length > 1 && g[1].startsWith("0") || g[1].length == g[2].length) g[1].length else 0
            val r = if (a <= b) (a..b) else (a downTo b)
            r.take(MAX_ONE).map { if (pad > 0) it.toString().padStart(pad, '0') else it.toString() }
        } else {
            val a = g[3][0]; val b = g[4][0]
            if (a.isUpperCase() != b.isUpperCase()) emptyList()
            else (if (a <= b) (a..b) else (b..a).reversed()).map { it.toString() }
        }
    }

    const val MAX_ONE = 10_000

    fun expand(url: String, max: Int = DmLink.MAX_BATCH): List<String> {
        if (!has(url)) return listOf(url)
        val p = pathStart(url)
        val head = url.substring(0, p); val path = url.substring(p)
        val ms = RE.findAll(path).toList()
        val parts = ArrayList<String>(); val vals = ArrayList<List<String>>()
        var at = 0
        for (m in ms) { parts.add(path.substring(at, m.range.first)); vals.add(values(m)); at = m.range.last + 1 }
        parts.add(path.substring(at))
        if (vals.any { it.isEmpty() }) return emptyList()
        val out = ArrayList<String>()
        fun walk(i: Int, acc: StringBuilder) {
            if (out.size >= max) return
            if (i == vals.size) { out.add(head + acc.toString() + parts.last()); return }
            for (v in vals[i]) {
                if (out.size >= max) return
                val len = acc.length
                acc.append(parts[i]).append(v)
                walk(i + 1, acc)
                acc.setLength(len)
            }
        }
        walk(0, StringBuilder())
        return out
    }
}

/** ZIP מבחוץ: ה־central directory בסוף הקובץ — שתיים־שלוש בקשות Range, בלי להוריד את הארכיון */
object DmZipPeek {
    data class Entry(
        val name: String, val csize: Long, val size: Long, val method: Int, val crc: Long,
        val off: Long, val dosTime: Long, val dir: Boolean, val enc: Boolean,
    )
    data class Listing(val entries: List<Entry>, val count: Long, val truncated: Boolean)

    class Bad(code: String) : IOException(code)

    const val MAX_CD = 16 shl 20
    const val MAX_ENTRIES = 5000
    private val EXT = setOf("zip", "apk", "jar", "epub", "cbz", "xapk", "apks", "apkm", "docx", "xlsx", "pptx", "odt", "aar", "whl", "nupkg")

    fun canPeek(name: String, ranges: Boolean, total: Long) = ranges && total > 22 && DmName.ext(name) in EXT

    private fun u16(b: ByteArray, i: Int) = (b[i].toInt() and 0xff) or ((b[i + 1].toInt() and 0xff) shl 8)
    private fun u32(b: ByteArray, i: Int) = u16(b, i).toLong() or (u16(b, i + 2).toLong() shl 16)
    private fun u64(b: ByteArray, i: Int) = u32(b, i) or (u32(b, i + 4) shl 32)

    /** read(pos, len) = בדיוק len בתים מהמיקום (מהשרת / מקובץ) */
    fun list(total: Long, read: (Long, Int) -> ByteArray): Listing {
        val tailLen = minOf(total, 22L + 65535).toInt()
        val tailPos = total - tailLen
        val tail = read(tailPos, tailLen)
        var e = -1
        for (i in tail.size - 22 downTo 0) if (u32(tail, i) == 0x06054b50L) { e = i; break }
        if (e < 0) throw Bad("not_zip")
        var count = u16(tail, e + 10).toLong()
        var cdSize = u32(tail, e + 12)
        var cdOff = u32(tail, e + 16)
        // ZIP64: ה־locator צמוד לפני ה־EOCD
        if ((count == 0xffffL || cdSize == 0xffffffffL || cdOff == 0xffffffffL) && e >= 20 && u32(tail, e - 20) == 0x07064b50L) {
            val z = u64(tail, e - 12)
            val r = read(z, 56)
            if (u32(r, 0) != 0x06064b50L) throw Bad("not_zip")
            count = u64(r, 32); cdSize = u64(r, 40); cdOff = u64(r, 48)
        }
        if (cdOff < 0 || cdSize < 0 || cdOff + cdSize > total) throw Bad("not_zip")
        if (cdSize > MAX_CD) throw Bad("too_big")
        val cd = if (cdOff >= tailPos) tail.copyOfRange((cdOff - tailPos).toInt(), (cdOff - tailPos + cdSize).toInt()) else read(cdOff, cdSize.toInt())
        val out = ArrayList<Entry>()
        var i = 0
        while (i + 46 <= cd.size && out.size < MAX_ENTRIES) {
            if (u32(cd, i) != 0x02014b50L) break
            val flags = u16(cd, i + 8); val method = u16(cd, i + 10)
            val dos = u32(cd, i + 12)
            val crc = u32(cd, i + 16)
            var cs = u32(cd, i + 20); var us = u32(cd, i + 24)
            val nl = u16(cd, i + 28); val xl = u16(cd, i + 30); val cl = u16(cd, i + 32)
            var off = u32(cd, i + 42)
            if (i + 46 + nl + xl > cd.size) break
            val raw = cd.copyOfRange(i + 46, i + 46 + nl)
            val name = if (flags and 0x800 != 0) String(raw, Charsets.UTF_8) else decodeLegacy(raw)
            // zip64 extra (0x0001): רק השדות שמסומנים 0xFFFFFFFF, לפי הסדר
            var x = i + 46 + nl
            val xe = x + xl
            while (x + 4 <= xe) {
                val id = u16(cd, x); val sz = u16(cd, x + 2)
                if (id == 1) {
                    var p = x + 4
                    if (us == 0xffffffffL && p + 8 <= x + 4 + sz) { us = u64(cd, p); p += 8 }
                    if (cs == 0xffffffffL && p + 8 <= x + 4 + sz) { cs = u64(cd, p); p += 8 }
                    if (off == 0xffffffffL && p + 8 <= x + 4 + sz) { off = u64(cd, p) }
                }
                x += 4 + sz
            }
            out.add(Entry(name, cs, us, method, crc, off, dos, name.endsWith("/"), flags and 1 != 0))
            i += 46 + nl + xl + cl
        }
        return Listing(out, count, out.size < count)
    }

    private fun decodeLegacy(b: ByteArray): String {
        // בלי סימון UTF-8: רוב הארכיונים החדשים בכל זאת UTF-8; אחרת — אחד לאחד (לא מפילים)
        val s = String(b, Charsets.UTF_8)
        return if ('�' in s) String(b, Charsets.ISO_8859_1) else s
    }

    /** התאריך של DOS → מילישניות (UTC, מספיק לתצוגה) */
    fun timeOf(dos: Long): Long {
        if (dos == 0L) return 0
        val c = java.util.Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"))
        c.clear()
        c.set(((dos shr 25) and 0x7f).toInt() + 1980, ((dos shr 21) and 0x0f).toInt() - 1, ((dos shr 16) and 0x1f).toInt().coerceAtLeast(1),
            ((dos shr 11) and 0x1f).toInt(), ((dos shr 5) and 0x3f).toInt(), ((dos and 0x1f) * 2).toInt())
        return c.timeInMillis
    }

    /** איפה מתחילים הנתונים של הרשומה (אחרי ה־local header — אורכי השם וה־extra שם יכולים להיות שונים מה־CD) */
    fun dataStart(e: Entry, read: (Long, Int) -> ByteArray): Long {
        val h = read(e.off, 30)
        if (u32(h, 0) != 0x04034b50L) throw Bad("not_zip")
        return e.off + 30 + u16(h, 26) + u16(h, 28)
    }

    /** הרשומה → out, עם בדיקת CRC והגודל. stream(pos, len) = זרם של הבתים האלה */
    fun extract(e: Entry, read: (Long, Int) -> ByteArray, stream: (Long, Long) -> InputStream, out: OutputStream,
                onBytes: (Long) -> Unit = {}, stop: () -> Boolean = { false }) {
        if (e.enc) throw Bad("encrypted")
        if (e.method != 0 && e.method != 8) throw Bad("method")
        if (e.size > DmZip.MAX_BYTES) throw Bad("too_big")
        val start = dataStart(e, read)
        val raw = stream(start, e.csize)
        // Inflater(nowrap) צריך בית "דמה" אחרי הנתונים
        val inp: InputStream = if (e.method == 8) InflaterInputStream(SequenceInputStream(raw, java.io.ByteArrayInputStream(ByteArray(1))), Inflater(true), 1 shl 16) else raw
        val crc = CRC32()
        val buf = ByteArray(1 shl 16)
        var n = 0L
        inp.use { s ->
            while (true) {
                if (stop()) throw InterruptedException("stop")
                val k = s.read(buf); if (k < 0) break
                n += k
                if (n > e.size) throw Bad("crc")
                crc.update(buf, 0, k); out.write(buf, 0, k); onBytes(n)
            }
        }
        if (n != e.size || crc.value != e.crc) throw Bad("crc")
    }

    /** קורא HTTP: Range מדויק, ‏If-Range לפי ETag/Last-Modified (הקובץ השתנה → Bad("changed")) */
    class Http(private val url: String, private val ref: String, private val ua: String, private val validator: String,
               private val cookies: ((String) -> String?)? = null) {
        private fun conn(pos: Long, len: Long): HttpURLConnection {
            val h = LinkedHashMap<String, String>()
            h["Range"] = "bytes=$pos-${pos + len - 1}"
            if (validator.isNotEmpty()) h["If-Range"] = validator
            val c = DmFetch.open(url, ref, ua, h, cookies)
            val st = c.responseCode
            if (st == 200) { c.disconnect(); throw Bad("changed") }
            if (st != 206) { c.disconnect(); throw DmHttpError(st, -1) }
            val cr = c.getHeaderField("Content-Range") ?: ""
            if (Regex("bytes\\s+(\\d+)-").find(cr)?.groupValues?.get(1)?.toLongOrNull() != pos) { c.disconnect(); throw Bad("changed") }
            return c
        }

        fun read(pos: Long, len: Int): ByteArray {
            if (len <= 0) return ByteArray(0)
            val c = conn(pos, len.toLong())
            try {
                val o = ByteArrayOutputStream(len)
                c.inputStream.use { s -> val b = ByteArray(1 shl 16); while (o.size() < len) { val k = s.read(b, 0, minOf(b.size, len - o.size())); if (k < 0) break; o.write(b, 0, k) } }
                if (o.size() != len) throw IOException("eof")
                return o.toByteArray()
            } finally { c.disconnect() }
        }

        fun stream(pos: Long, len: Long): InputStream {
            if (len <= 0) return java.io.ByteArrayInputStream(ByteArray(0))
            val c = conn(pos, len)
            return object : java.io.FilterInputStream(c.inputStream) { override fun close() { runCatching { super.close() }; c.disconnect() } }
        }
    }
}

/** AndroidManifest.xml הבינארי (AXML) → מה שחשוב לדעת לפני התקנה. לא תלוי באנדרואיד */
object DmApk {
    data class Info(
        val pkg: String, val versionName: String, val versionCode: Long, val minSdk: Int, val targetSdk: Int,
        val perms: List<String>, val risky: List<String>, val accessibility: Boolean, val label: String,
    )

    /** הרשאות שכדאי לשים לב אליהן (נגישות, SMS, שיחות, מיקום, מיקרופון…) — רק השם הקצר מוצג */
    val RISKY = setOf(
        "READ_SMS", "SEND_SMS", "RECEIVE_SMS", "READ_CALL_LOG", "WRITE_CALL_LOG", "PROCESS_OUTGOING_CALLS", "CALL_PHONE",
        "READ_CONTACTS", "WRITE_CONTACTS", "GET_ACCOUNTS", "ACCESS_FINE_LOCATION", "ACCESS_BACKGROUND_LOCATION", "CAMERA",
        "RECORD_AUDIO", "READ_PHONE_STATE", "READ_PHONE_NUMBERS", "SYSTEM_ALERT_WINDOW", "REQUEST_INSTALL_PACKAGES",
        "QUERY_ALL_PACKAGES", "MANAGE_EXTERNAL_STORAGE", "BIND_DEVICE_ADMIN", "PACKAGE_USAGE_STATS", "WRITE_SETTINGS",
        "BODY_SENSORS", "BIND_NOTIFICATION_LISTENER_SERVICE", "READ_EXTERNAL_STORAGE", "READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO",
        "USE_CREDENTIALS", "MANAGE_ACCOUNTS", "REQUEST_DELETE_PACKAGES", "BIND_VPN_SERVICE",
    )

    private const val A_NAME = 0x01010003; private const val A_LABEL = 0x01010001
    private const val A_VCODE = 0x0101021b; private const val A_VNAME = 0x0101021c
    private const val A_MIN = 0x0101020c; private const val A_TARGET = 0x01010270; private const val A_PERM = 0x01010006

    private fun u16(b: ByteArray, i: Int) = (b[i].toInt() and 0xff) or ((b[i + 1].toInt() and 0xff) shl 8)
    private fun i32(b: ByteArray, i: Int) = u16(b, i) or (u16(b, i + 2) shl 16)

    fun parse(b: ByteArray): Info? = runCatching { parseOrThrow(b) }.getOrNull()

    private fun parseOrThrow(b: ByteArray): Info? {
        if (b.size < 8 || u16(b, 0) != 0x0003) return null
        var strings: List<String> = emptyList()
        var resMap = IntArray(0)
        var pkg = ""; var vn = ""; var vc = 0L; var min = 0; var target = 0; var label = ""
        val perms = ArrayList<String>(); var acc = false
        var p = u16(b, 2)
        while (p + 8 <= b.size) {
            val type = u16(b, p); val hs = u16(b, p + 2); val size = i32(b, p + 4)
            if (size < 8 || p + size > b.size) break
            when (type) {
                0x0001 -> strings = pool(b, p)
                0x0180 -> resMap = IntArray((size - hs) / 4) { i32(b, p + hs + it * 4) }
                0x0102 -> {
                    val el = strings.getOrElse(i32(b, p + 20)) { "" }
                    val aStart = u16(b, p + 24); val aSize = u16(b, p + 26); val aCount = u16(b, p + 28)
                    val base = p + 16 + aStart
                    val attrs = HashMap<String, Any>()
                    for (k in 0 until aCount) {
                        val a = base + k * aSize
                        if (a + 20 > b.size) break
                        val ni = i32(b, a + 4)
                        val raw = i32(b, a + 8); val dt = b[a + 15].toInt() and 0xff; val data = i32(b, a + 16)
                        val rid = resMap.getOrElse(ni) { 0 }
                        val key = when (rid) {
                            A_NAME -> "name"; A_LABEL -> "label"; A_VCODE -> "versionCode"; A_VNAME -> "versionName"
                            A_MIN -> "minSdkVersion"; A_TARGET -> "targetSdkVersion"; A_PERM -> "permission"
                            else -> strings.getOrElse(ni) { "" }
                        }
                        val v: Any = when {
                            raw != -1 -> strings.getOrElse(raw) { "" }
                            dt == 0x03 -> strings.getOrElse(data) { "" }
                            dt in 0x10..0x1f -> data.toLong() and 0xffffffffL
                            else -> ""
                        }
                        attrs[key] = v
                    }
                    fun s(k: String) = (attrs[k] as? String) ?: (attrs[k] as? Long)?.toString() ?: ""
                    fun n(k: String) = (attrs[k] as? Long) ?: (attrs[k] as? String)?.toLongOrNull() ?: 0L
                    when (el) {
                        "manifest" -> { pkg = s("package"); vn = s("versionName"); vc = n("versionCode") }
                        "uses-sdk" -> { min = n("minSdkVersion").toInt(); target = n("targetSdkVersion").toInt() }
                        "uses-permission", "uses-permission-sdk-23" -> s("name").takeIf { it.isNotEmpty() }?.let { if (it !in perms) perms.add(it) }
                        "application" -> label = s("label")
                        "service" -> if (s("permission") == "android.permission.BIND_ACCESSIBILITY_SERVICE") acc = true
                    }
                }
            }
            p += size
        }
        if (pkg.isEmpty()) return null
        val risky = perms.map { it.substringAfterLast('.') }.filter { it in RISKY }.distinct()
        return Info(pkg, vn, vc, min, target, perms, risky, acc, label.takeIf { !it.startsWith("@") && it != "0" } ?: "")
    }

    private fun pool(b: ByteArray, p: Int): List<String> {
        val count = i32(b, p + 8); val flags = i32(b, p + 16); val sStart = i32(b, p + 20)
        val utf8 = flags and 0x100 != 0
        val hs = u16(b, p + 2)
        if (count < 0 || count > 200_000) return emptyList()
        return List(count) { k ->
            runCatching {
                val at = p + sStart + i32(b, p + hs + k * 4)
                if (utf8) {
                    var q = at
                    q += if (b[q].toInt() and 0x80 != 0) 2 else 1          // אורך ב־UTF-16
                    var len = b[q].toInt() and 0xff
                    if (len and 0x80 != 0) { len = ((len and 0x7f) shl 8) or (b[q + 1].toInt() and 0xff); q += 2 } else q += 1
                    String(b, q, len, Charsets.UTF_8)
                } else {
                    var q = at
                    var len = u16(b, q)
                    if (len and 0x8000 != 0) { len = ((len and 0x7fff) shl 16) or u16(b, q + 2); q += 4 } else q += 2
                    String(b, q, len * 2, Charsets.UTF_16LE)
                }
            }.getOrDefault("")
        }
    }
}

/** חום וסוללה → כמה חיבורים ואיזו מהירות. thermal = PowerManager.THERMAL_STATUS_* (0 בלי, 1 קל … 4 חמור מאוד) */
object DmHeat {
    enum class Why { NONE, HOT, HEAT, BATTERY, SAVER }
    data class Cap(val conns: Int, val bps: Long, val why: Why)

    const val LOW_BATT = 15

    fun cap(conns: Int, thermal: Int, batt: Int, charging: Boolean, saver: Boolean): Cap {
        val c = conns.coerceAtLeast(1)
        return when {
            thermal >= 4 -> Cap(1, 512L shl 10, Why.HEAT)
            thermal == 3 -> Cap(maxOf(1, c / 4), 2L shl 20, Why.HEAT)
            thermal == 2 -> Cap(maxOf(1, c / 2), 0, Why.HOT)
            !charging && batt in 0..LOW_BATT -> Cap(maxOf(1, c / 2), 0, Why.BATTERY)
            !charging && saver -> Cap(maxOf(1, c / 2), 0, Why.SAVER)
            else -> Cap(c, 0, Why.NONE)
        }
    }
}

/** "למה זה לא יורד?" — מקוד התקלה + מה שהיומן יודע → הסבר ופעולה. הטקסטים בממשק (dg<Key>) */
object DmDiag {
    enum class Act { RETRY, REFRESH, BROWSER, FEWER, CELL, SPACE, RESTART, NONE }
    data class Why(val key: String, val act: Act)

    fun explain(code: String, kind: DmKind, ranges: Boolean, tries: Int, ex: String = "", wifiOnly: Boolean = false): List<Why> {
        val out = ArrayList<Why>()
        val c = code.lowercase()
        out += when {
            c == "net" && ex.contains("UnknownHost") -> Why("Dns", Act.RETRY)
            c == "net" -> Why("Net", Act.RETRY)
            c == "wifi" -> Why("Wifi", if (wifiOnly) Act.CELL else Act.RETRY)
            c == "expired" -> Why("Expired", if (kind == DmKind.HTTP) Act.REFRESH else Act.BROWSER)
            c == "http_404" || c == "http_410" -> Why("Gone", Act.BROWSER)
            c == "http_429" || c == "http_503" -> Why("Busy", Act.FEWER)
            c.startsWith("http_5") -> Why("Server", Act.RETRY)
            c == "space" -> Why("Space", Act.SPACE)
            c == "ssl" -> Why("Ssl", Act.BROWSER)
            c == "changed" || c == "range" -> Why("Changed", Act.RESTART)
            c == "incomplete" -> Why("Incomplete", Act.RESTART)
            c == "page" -> Why("Page", Act.BROWSER)
            c == "login" || c == "private" -> Why("Login", Act.BROWSER)
            c == "blocked" -> Why("Blocked", Act.BROWSER)
            c == "drm" -> Why("Drm", Act.NONE)
            c == "geo" || c == "unavailable" -> Why("Geo", Act.NONE)
            c == "live" -> Why("Live", Act.NONE)
            c == "unsupported" || c == "no_video" -> Why("NoVideo", Act.BROWSER)
            c == "heat" -> Why("Heat", Act.NONE)
            else -> Why("Unknown", Act.RETRY)
        }
        // הרבה ניסיונות על אותה תקלה של רשת/שרת — כנראה השרת מגביל חיבורים מאותו טלפון
        if (kind == DmKind.HTTP && tries >= 3 && (c == "net" || c.startsWith("http_5")) && out.none { it.act == Act.FEWER }) out += Why("Busy", Act.FEWER)
        if (kind == DmKind.HTTP && !ranges && c != "space") out += Why("NoResume", Act.NONE)
        return out
    }

    /** שלב בבדיקה החיה: k = dns/conn/http/size/ranges/same, v = ערך קצר להצגה (לא כתובת מלאה) */
    data class Step(val k: String, val ok: Boolean, val v: String)

    fun check(url: String, ref: String, ua: String, cookies: ((String) -> String?)?, prevTotal: Long, prevTag: String,
              resolve: (String) -> Int = { h -> InetAddress.getAllByName(h).size }): List<Step> {
        val out = ArrayList<Step>()
        val host = DmLink.host(url)
        val n = try { resolve(runCatching { java.net.URI(url).host }.getOrNull() ?: "") } catch (e: Throwable) { -1 }
        out += Step("dns", n > 0, host)
        if (n <= 0) return out
        val p = try { DmFetch.probe(url, ref, ua, cookies) } catch (e: DmHttpError) {
            out += Step("conn", true, ""); out += Step("http", false, e.status.toString()); return out
        } catch (e: javax.net.ssl.SSLException) {
            out += Step("conn", false, "tls"); return out
        } catch (e: Throwable) {
            out += Step("conn", false, if (e is java.net.SocketTimeoutException) "timeout" else "net"); return out
        }
        out += Step("conn", true, "")
        out += Step("http", true, "OK")
        val fin = DmLink.host(p.finalUrl)
        if (fin.isNotEmpty() && fin != host) out += Step("redir", true, fin)
        if (p.mime == "text/html") { out += Step("page", false, ""); return out }
        out += Step("size", p.total > 0, if (p.total > 0) p.total.toString() else "")
        out += Step("ranges", p.ranges, "")
        if (prevTotal > 0 && p.total > 0) {
            val tag = p.etag.ifEmpty { p.lastMod }
            out += Step("same", p.total == prevTotal && (prevTag.isEmpty() || tag.isEmpty() || tag == prevTag), "")
        }
        return out
    }
}
