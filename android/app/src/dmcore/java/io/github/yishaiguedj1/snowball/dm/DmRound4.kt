package io.github.yishaiguedj1.snowball.dm

import org.json.JSONArray
import org.json.JSONObject
import java.io.InputStream
import java.net.URL
import java.security.MessageDigest
import java.util.Base64
import java.util.Locale

/*
 * 02/11/2026 — השדרוג "מקצועי", סבב 4א: הכללים הטהורים (בלי אנדרואיד, נבדקים ב־testDm/DmRound4Test).
 * מדיה (33 קטע, 34 המרה, 35 פרקים, 37 חיפוש בכתוביות), 7 תור סנכרון, 38 פידים, 10 Metalink ומראות,
 * 47 אימות Repr-Digest, 5 סורק אתר (robots.txt).
 */

/* ---------- 33: רק קטע ---------- */

object DmClip {
    /** "12:30" / "1:02:03" / "90" → שניות; לא תקין → null */
    fun parse(s: String?): Int? {
        val t = (s ?: "").trim()
        if (t.isEmpty() || !Regex("^\\d{1,5}(:\\d{1,2}){0,2}$").matches(t)) return null
        val p = t.split(':').map { it.toInt() }
        if (p.size > 1 && p.drop(1).any { it >= 60 }) return null
        return p.fold(0) { a, v -> a * 60 + v }
    }

    fun fmt(sec: Int): String = if (sec >= 3600) String.format(Locale.US, "%d:%02d:%02d", sec / 3600, sec / 60 % 60, sec % 60)
        else String.format(Locale.US, "%d:%02d", sec / 60, sec % 60)

    /** dur = משך הסרטון (0 = לא ידוע) */
    fun valid(s0: Int, s1: Int, dur: Int): Boolean = s0 >= 0 && s1 > s0 && (dur <= 0 || s1 <= dur)
}

/* ---------- 34: המרה אחרי הורדה ---------- */

object DmConv {
    /** "" = בלי · mp3 / m4a / opus = רק קול עם תגיות · mp4 = MP4 תואם (H.264) */
    val MODES = listOf("", "mp3", "m4a", "opus", "mp4")
    val AUDIO = setOf("mp3", "m4a", "opus")

    fun norm(s: String?): String = (s ?: "").trim().lowercase(Locale.ROOT).takeIf { it in MODES } ?: ""
    fun audio(spec: String) = norm(spec) in AUDIO

    /** הפרמטרים ל־yt-dlp (אחרי ההורדה, דרך ffmpeg שבתוך האפליקציה). עטיפה ותגיות — לכל קול; mp4 = איחוד מחדש בלי קידוד */
    fun args(spec: String): List<String> = when (val m = norm(spec)) {
        "mp3", "m4a" -> listOf("-x", "--audio-format", m, "--audio-quality", "0", "--embed-thumbnail", "--embed-metadata")
        "opus" -> listOf("-x", "--audio-format", "opus", "--audio-quality", "0", "--embed-metadata")
        "mp4" -> listOf("--remux-video", "mp4", "--embed-metadata")
        else -> emptyList()
    }

    /** "עד גודל": האיכות הטובה ביותר שנכנסת ביעד (בלי קידוד מחדש). sizes = גודל לכל איכות מהטובה לפחות טובה (0 = לא ידוע).
     *  אין אחת שנכנסת — הקטנה ביותר הידועה; אין גדלים בכלל — null */
    fun fit(sizes: List<Long>, target: Long): Int? {
        if (target <= 0) return null
        val known = sizes.withIndex().filter { it.value > 0 }
        if (known.isEmpty()) return null
        return known.firstOrNull { it.value <= target }?.index ?: known.minByOrNull { it.value }!!.index
    }
}

/* ---------- 35: פרקים ---------- */

object DmChap {
    /** "" = רגיל · list = רשימת פרקים בנגן · split = קובץ לכל פרק */
    val MODES = listOf("", "list", "split")
    data class C(val start: Int, val title: String)

    fun norm(s: String?) = (s ?: "").trim().takeIf { it in MODES } ?: ""

    /** {DIR} מוחלף בתיקיית ההורדה (DlEngine). info.json — כדי לקרוא את רשימת הפרקים אחרי ההורדה */
    fun args(mode: String): List<String> = when (norm(mode)) {
        "list" -> listOf("--embed-chapters", "--write-info-json")
        "split" -> listOf("--split-chapters", "--write-info-json", "-o", "chapter:{DIR}/%(title).60B - %(section_number)03d %(section_title).60B.%(ext)s")
        else -> emptyList()
    }

    /** הפרקים מתוך ה־info.json של yt-dlp (עד 300) */
    fun fromInfo(json: String?): List<C> {
        val a = runCatching { JSONObject(json ?: "").optJSONArray("chapters") }.getOrNull() ?: return emptyList()
        return (0 until minOf(a.length(), 300)).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            C(o.optDouble("start_time", -1.0).toInt().takeIf { it >= 0 } ?: return@mapNotNull null, o.optString("title").replace('\n', ' ').take(120))
        }.sortedBy { it.start }
    }

    fun dump(cs: List<C>): String = cs.joinToString("\n") { "${it.start}|${it.title.replace('\n', ' ')}" }
    fun parse(s: String?): List<C> = (s ?: "").split('\n').mapNotNull { l ->
        val n = l.substringBefore('|').toIntOrNull() ?: return@mapNotNull null
        C(n, l.substringAfter('|', ""))
    }

    private val PART = Regex(" - (\\d{3}) ")

    /** קבצי הפרקים שבתיקייה, לפי הסדר (שם עם " - 001 ") */
    fun files(names: List<String>): List<String> = names.filter { PART.containsMatchIn(it) && !it.endsWith(".part") && !it.endsWith(".json") }
        .sortedBy { PART.find(it)!!.groupValues[1].toInt() }
}

/* ---------- 37: חיפוש בכתוביות שירדו ---------- */

object DmSubIndex {
    data class Cue(val ms: Long, val text: String)
    data class Hit(val id: String, val ms: Long, val text: String)

    private val TIME = Regex("(\\d{1,2}):(\\d{2}):(\\d{2})[,.](\\d{1,3})\\s*-->")

    /** SRT / VTT → שורות עם זמן ההתחלה */
    fun parse(srt: String): List<Cue> {
        val out = ArrayList<Cue>()
        val lines = srt.replace("\r", "").split('\n')
        var i = 0
        while (i < lines.size) {
            val m = TIME.find(lines[i])
            if (m == null) { i++; continue }
            val (h, mi, s, f) = m.destructured
            val ms = ((h.toLong() * 60 + mi.toLong()) * 60 + s.toLong()) * 1000 + f.padEnd(3, '0').toLong()
            val sb = StringBuilder(); i++
            while (i < lines.size && lines[i].isNotBlank()) { sb.append(lines[i].replace(Regex("<[^>]+>"), "")).append(' '); i++ }
            val t = sb.toString().trim()
            if (t.isNotEmpty()) out.add(Cue(ms, t))
        }
        return out
    }

    /** כל ההופעות (לפי DmFind — כל מילה בשאילתה), עד max */
    fun search(q: String, docs: Map<String, List<Cue>>, max: Int = 200): List<Hit> {
        if (q.isBlank()) return emptyList()
        val out = ArrayList<Hit>()
        for ((id, cues) in docs) for (c in cues) {
            if (DmFind.match(q, c.text)) { out.add(Hit(id, c.ms, c.text)); if (out.size >= max) return out }
        }
        return out
    }
}

/* ---------- 7 + 38: תור סנכרון (קבצים, פידים, ערוצים ורשימות) ---------- */

/**
 * פריט במעקב. kind: file = קובץ שנבדק ב־HEAD (ETag / Last-Modified / גודל) · feed = RSS/Atom (פודקאסט) ·
 * list = ערוץ / רשימת השמעה (yt-dlp, רשימה שטוחה). seen = המזהים שכבר טופלו (עד 500). keep = כמה פרקים אחרונים לשמור (0 = הכל)
 */
data class DmWatch(
    val id: String, val url: String, val kind: String, val name: String = "", val everyH: Int = 24,
    val etag: String = "", val lastMod: String = "", val size: Long = -1, val checked: Long = 0, val changed: Long = 0,
    val seen: List<String> = emptyList(), val keep: Int = 0, val audio: Boolean = false, val height: Int = 0, val err: String = "",
)

object DmWatches {
    val KINDS = listOf("file", "feed", "list")
    val EVERY = listOf(1, 3, 6, 12, 24, 72, 168)
    const val MAX = 100
    const val MAX_SEEN = 500

    fun parse(s: String?): List<DmWatch> {
        val a = runCatching { JSONArray(s ?: "") }.getOrNull() ?: return emptyList()
        return (0 until minOf(a.length(), MAX)).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            val u = o.optString("u"); val k = o.optString("k")
            if (!u.startsWith("http") || k !in KINDS) return@mapNotNull null
            val sn = o.optJSONArray("sn")
            DmWatch(o.optString("id").take(16), u, k, o.optString("n").take(120), o.optInt("e", 24).coerceIn(1, 24 * 30),
                o.optString("et"), o.optString("lm"), o.optLong("sz", -1), o.optLong("ck"), o.optLong("ch"),
                if (sn == null) emptyList() else (0 until sn.length()).map { sn.optString(it) }.takeLast(MAX_SEEN),
                o.optInt("kp").coerceIn(0, 100), o.optBoolean("au"), o.optInt("h").coerceAtLeast(0), o.optString("er").take(24))
        }
    }

    fun dump(ws: List<DmWatch>): String = JSONArray().also { a ->
        ws.take(MAX).forEach { w ->
            a.put(JSONObject().put("id", w.id).put("u", w.url).put("k", w.kind).put("n", w.name).put("e", w.everyH)
                .put("et", w.etag).put("lm", w.lastMod).put("sz", w.size).put("ck", w.checked).put("ch", w.changed)
                .put("sn", JSONArray(w.seen.takeLast(MAX_SEEN))).put("kp", w.keep).put("au", w.audio).put("h", w.height).put("er", w.err))
        }
    }.toString()

    fun newId(ws: List<DmWatch>): String { var i = ws.size + 1; while (ws.any { it.id == "w$i" }) i++; return "w$i" }

    /** מה הגיע הזמן לבדוק */
    fun due(ws: List<DmWatch>, now: Long): List<DmWatch> = ws.filter { now - it.checked >= it.everyH * 3_600_000L - 60_000 }

    /** כמה דקות עד הבדיקה הבאה (לפחות 15 — מגבלת המערכת למשימה מחזורית) */
    fun nextMin(ws: List<DmWatch>, now: Long): Long? = ws.minOfOrNull { (it.checked + it.everyH * 3_600_000L - now) / 60_000 }?.coerceAtLeast(15)

    /** הקובץ בשרת השתנה? ETag קודם (חזק), אחריו Last-Modified, ואחרון — הגודל. בלי שום מידע קודם = לא (הבדיקה הראשונה רק לומדת) */
    fun changed(w: DmWatch, etag: String, lastMod: String, size: Long): Boolean = when {
        w.etag.isNotEmpty() && etag.isNotEmpty() -> w.etag != etag
        w.lastMod.isNotEmpty() && lastMod.isNotEmpty() -> w.lastMod != lastMod
        w.size > 0 && size > 0 -> w.size != size
        else -> false
    }

    /** פיד / רשימה: המזהים החדשים (לפי הסדר שבפיד — החדש קודם). בפעם הראשונה (seen ריק) — רק `first` האחרונים */
    fun fresh(w: DmWatch, ids: List<String>, first: Int = 1): List<String> {
        if (w.seen.isEmpty() && w.checked == 0L) return ids.take(first)
        val s = w.seen.toHashSet()
        return ids.filter { it !in s }.take(50)
    }

    /** אחרי הבדיקה: כל המזהים שבפיד נחשבים "נראו" */
    fun markSeen(w: DmWatch, ids: List<String>): List<String> = (w.seen + ids.filter { it !in w.seen.toHashSet() }).takeLast(MAX_SEEN)
}

/** פיד RSS / Atom (פודקאסט, בלוג, ערוץ יוטיוב) — קריאה סלחנית בלי DTD (בלי XXE), עד 500 פריטים */
object DmFeed {
    data class Item(val id: String, val title: String, val url: String, val date: String)
    data class Feed(val title: String, val items: List<Item>)

    private val OPT = setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)
    private val ITEM = Regex("<(item|entry)\\b[^>]*>(.*?)</\\1>", OPT)
    private fun tag(x: String, t: String) = Regex("<$t\\b[^>]*>(.*?)</$t>", OPT).find(x)?.groupValues?.get(1)?.let { clean(it) } ?: ""
    private fun attr(x: String, t: String, a: String, where: String? = null): String {
        Regex("<$t\\b([^>]*)/?>", OPT).findAll(x).forEach { m ->
            val at = m.groupValues[1]
            if (where != null && !Regex(where, RegexOption.IGNORE_CASE).containsMatchIn(at)) return@forEach
            Regex("\\b$a\\s*=\\s*([\"'])(.*?)\\1", OPT).find(at)?.groupValues?.get(2)?.let { return unesc(it) }
        }
        return ""
    }
    private fun unesc(s: String) = s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&#39;", "'").trim()
    private fun clean(s: String) = unesc(s.replace(Regex("<!\\[CDATA\\[(.*?)]]>", OPT), "$1").replace(Regex("<[^>]+>"), "")).replace(Regex("\\s+"), " ").take(300)

    fun looks(text: String): Boolean { val h = text.take(2000); return Regex("<(rss|feed|rdf:RDF)\\b", RegexOption.IGNORE_CASE).containsMatchIn(h) }

    fun parse(xml: String): Feed? {
        if (!looks(xml)) return null
        val head = xml.substringBefore("<item").substringBefore("<entry")
        val items = ITEM.findAll(xml).take(500).mapNotNull { m ->
            val x = m.groupValues[2]
            val yt = tag(x, "yt:videoId")
            val url = when {
                yt.isNotEmpty() -> "https://www.youtube.com/watch?v=$yt"
                else -> attr(x, "enclosure", "url").ifEmpty { attr(x, "media:content", "url") }
                    .ifEmpty { attr(x, "link", "href", "enclosure").ifEmpty { attr(x, "link", "href").ifEmpty { tag(x, "link") } } }
            }
            if (!url.startsWith("http")) return@mapNotNull null
            Item(tag(x, "guid").ifEmpty { tag(x, "id") }.ifEmpty { url }.take(300), tag(x, "title"), url,
                tag(x, "pubDate").ifEmpty { tag(x, "published") }.ifEmpty { tag(x, "updated") })
        }.toList()
        return Feed(tag(head, "title"), items)
    }

    /** קישור של ערוץ/רשימה ביוטיוב → הפיד הרשמי שלו (בלי yt-dlp). אחר — null */
    fun youtubeFeed(url: String): String? {
        Regex("youtube\\.com/channel/(UC[\\w-]{20,24})").find(url)?.let { return "https://www.youtube.com/feeds/videos.xml?channel_id=" + it.groupValues[1] }
        Regex("youtube\\.com/(?:playlist|watch)\\?[^#]*\\blist=([\\w-]{10,64})").find(url)?.let { return "https://www.youtube.com/feeds/videos.xml?playlist_id=" + it.groupValues[1] }
        return null
    }
}

/* ---------- 10: Metalink ומראות ---------- */

object DmMeta4 {
    data class File(
        val name: String, val size: Long, val hashes: Map<String, String>, val pieceLen: Long, val pieceAlgo: String,
        val pieces: List<String>, val urls: List<String>,
    )

    const val MAX_FILES = 50
    const val MAX_MIRRORS = 8
    private val OPT = setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL)

    /** שם האלגוריתם במסמך → השם ב־Java (רק החזקים; md5/sha-1 — לא נחשבים אימות) */
    fun javaAlgo(t: String): String? = when (t.lowercase(Locale.ROOT).replace("_", "-")) {
        "sha-256", "sha256" -> "SHA-256"; "sha-512", "sha512" -> "SHA-512"; "sha-384", "sha384" -> "SHA-384"; else -> null
    }

    fun looks(text: String) = Regex("<metalink\\b", RegexOption.IGNORE_CASE).containsMatchIn(text.take(4000))
    fun isUrl(u: String) = Regex("\\.(meta4|metalink)(\\?|#|$)", RegexOption.IGNORE_CASE).containsMatchIn(u)

    /** RFC 5854 (meta4) וגם הגרסה הישנה (3.0): שם, גודל, סיכום, חלקים, כתובות לפי עדיפות. רק http/https */
    fun parse(xml: String): List<File> {
        if (!looks(xml)) return emptyList()
        return Regex("<file\\b([^>]*)>(.*?)</file>", OPT).findAll(xml).take(MAX_FILES).mapNotNull { m ->
            val name = DmName.clean(Regex("name\\s*=\\s*([\"'])(.*?)\\1").find(m.groupValues[1])?.groupValues?.get(2) ?: "")
            val x = m.groupValues[2]
            if (name.isEmpty()) return@mapNotNull null
            val size = Regex("<size>\\s*(\\d+)\\s*</size>", OPT).find(x)?.groupValues?.get(1)?.toLongOrNull() ?: -1L
            val pieceBlock = Regex("<pieces\\b([^>]*)>(.*?)</pieces>", OPT).find(x)
            val outside = if (pieceBlock != null) x.replace(pieceBlock.value, "") else x
            val hashes = LinkedHashMap<String, String>()
            Regex("<hash\\b([^>]*)>\\s*([0-9a-fA-F]{40,128})\\s*</hash>", OPT).findAll(outside).forEach { h ->
                val t = Regex("type\\s*=\\s*([\"'])(.*?)\\1").find(h.groupValues[1])?.groupValues?.get(2) ?: ""
                javaAlgo(t)?.let { hashes[it] = h.groupValues[2].lowercase(Locale.ROOT) }
            }
            var pLen = 0L; var pAlgo = ""; var pieces = emptyList<String>()
            if (pieceBlock != null) {
                val at = pieceBlock.groupValues[1]
                pLen = Regex("length\\s*=\\s*([\"'])(\\d+)\\1").find(at)?.groupValues?.get(2)?.toLongOrNull() ?: 0
                pAlgo = javaAlgo(Regex("type\\s*=\\s*([\"'])(.*?)\\1").find(at)?.groupValues?.get(2) ?: "") ?: ""
                pieces = Regex("<hash\\b[^>]*>\\s*([0-9a-fA-F]{40,128})\\s*</hash>", OPT).findAll(pieceBlock.groupValues[2]).map { it.groupValues[1].lowercase(Locale.ROOT) }.toList()
                // החלקים חייבים לכסות את כל הקובץ בדיוק — אחרת מתעלמים מהם (אבל הסיכום של הקובץ כולו נשאר)
                if (pAlgo.isEmpty() || pLen < 16 * 1024 || size <= 0 || pieces.size.toLong() != (size + pLen - 1) / pLen) { pLen = 0; pAlgo = ""; pieces = emptyList() }
            }
            val urls = Regex("<url\\b([^>]*)>\\s*(.*?)\\s*</url>", OPT).findAll(x).mapNotNull { u ->
                val v = u.groupValues[2].replace("&amp;", "&").trim()
                if (!v.startsWith("http://") && !v.startsWith("https://")) return@mapNotNull null
                val at = u.groupValues[1]
                // meta4: priority 1 = הכי טוב · 3.0: preference 100 = הכי טוב
                val pri = Regex("priority\\s*=\\s*([\"'])(\\d+)\\1").find(at)?.groupValues?.get(2)?.toIntOrNull()
                    ?: Regex("preference\\s*=\\s*([\"'])(\\d+)\\1").find(at)?.groupValues?.get(2)?.toIntOrNull()?.let { 1000 - it } ?: 999_999
                pri to v
            }.sortedBy { it.first }.map { it.second }.distinct().take(MAX_MIRRORS).toList()
            if (urls.isEmpty()) null else File(name, size, hashes, pLen, pAlgo, pieces, urls)
        }.toList()
    }

    /** החלקים שהסיכום שלהם לא תואם (מהקובץ שבטלפון) */
    fun badPieces(input: InputStream, pieceLen: Long, algo: String, pieces: List<String>): List<Int> {
        val bad = ArrayList<Int>()
        val buf = ByteArray(64 * 1024)
        input.use { inp ->
            for ((i, want) in pieces.withIndex()) {
                val md = MessageDigest.getInstance(algo)
                var left = pieceLen
                while (left > 0) {
                    val n = inp.read(buf, 0, minOf(buf.size.toLong(), left).toInt())
                    if (n < 0) break
                    md.update(buf, 0, n); left -= n
                }
                val got = md.digest().joinToString("") { "%02x".format(it) }
                if (!got.equals(want, true)) bad.add(i)
            }
        }
        return bad
    }

    /** מקטעים להורדה חוזרת של החלקים הפגומים בלבד: כל השאר מסומן כגמור */
    fun redo(bad: List<Int>, pieceLen: Long, total: Long): MutableList<Seg> {
        val out = ArrayList<Seg>()
        var at = 0L
        for (i in bad.sorted().distinct()) {
            val a = i * pieceLen; val b = minOf(total, a + pieceLen)
            if (a >= total) continue
            if (a > at) out.add(Seg(at, a, a - at))
            out.add(Seg(a, b, 0)); at = b
        }
        if (at < total) out.add(Seg(at, total, total - at))
        return out
    }

    fun dumpPieces(f: File) = f.pieces.joinToString("\n")
    fun parsePieces(s: String?) = (s ?: "").split('\n').map { it.trim() }.filter { it.length >= 40 }
}

/** מראות: לכל חיבור כתובת אחרת (לפי המספר שלו); מראה שנכשלה סופית יוצאת מהסבב */
object DmMirrors {
    fun pick(urls: List<String>, slot: Int, dead: Set<Int>): Int? {
        if (urls.isEmpty()) return null
        val alive = urls.indices.filter { it !in dead }
        if (alive.isEmpty()) return null
        return alive[Math.floorMod(slot, alive.size)]
    }
}

/* ---------- 47: Repr-Digest (RFC 9530) ---------- */

object DmDigest {
    /** הסיכום של הקובץ כולו מהכותרות: Repr-Digest (‏sha-256=:base64:), ו־Digest הישן (RFC 3230). → "SHA-256:hex", או "" */
    fun parse(repr: String?, legacy: String?): String {
        val best = ArrayList<Pair<String, String>>()
        (repr ?: "").split(',').forEach { p ->
            val m = Regex("^\\s*(sha-256|sha-512)\\s*=\\s*:([A-Za-z0-9+/=]+):\\s*$", RegexOption.IGNORE_CASE).find(p) ?: return@forEach
            hex(m.groupValues[2])?.let { best.add(DmMeta4.javaAlgo(m.groupValues[1])!! to it) }
        }
        if (best.isEmpty()) (legacy ?: "").split(',').forEach { p ->
            val m = Regex("^\\s*(sha-256|sha-512)\\s*=\\s*([A-Za-z0-9+/=]+)\\s*$", RegexOption.IGNORE_CASE).find(p) ?: return@forEach
            hex(m.groupValues[2])?.let { best.add(DmMeta4.javaAlgo(m.groupValues[1])!! to it) }
        }
        val pick = best.firstOrNull { it.first == "SHA-512" } ?: best.firstOrNull() ?: return ""
        return pick.first + ":" + pick.second
    }

    private fun hex(b64: String): String? = runCatching { Base64.getDecoder().decode(b64) }.getOrNull()
        ?.takeIf { it.size == 32 || it.size == 64 }?.joinToString("") { "%02x".format(it) }

    fun algo(dg: String) = dg.substringBefore(':', "").takeIf { it == "SHA-256" || it == "SHA-512" }
    fun value(dg: String) = dg.substringAfter(':', "")
}

/* ---------- 5: סורק אתר ---------- */

/** robots.txt: הקבוצה של "*" (או של DM), Allow/Disallow עם * ו־$, ההתאמה הארוכה גוברת, Allow גובר בתיקו */
class DmRobots(private val rules: List<Pair<Boolean, Regex>>, private val lens: List<Int>) {
    fun allowed(path: String): Boolean {
        var best = -1; var ok = true
        rules.forEachIndexed { i, (allow, re) ->
            if (re.containsMatchIn(path) && (lens[i] > best || (lens[i] == best && allow))) { best = lens[i]; ok = allow }
        }
        return ok
    }

    companion object {
        val ALL = DmRobots(emptyList(), emptyList())

        fun parse(txt: String?, agent: String = "studiodm"): DmRobots {
            val groups = LinkedHashMap<String, MutableList<Pair<Boolean, String>>>()
            var cur = mutableListOf<String>(); var lastWasAgent = false
            (txt ?: "").take(512 * 1024).lines().forEach { raw ->
                val l = raw.substringBefore('#').trim()
                val k = l.substringBefore(':').trim().lowercase(Locale.ROOT); val v = l.substringAfter(':', "").trim()
                when (k) {
                    "user-agent" -> { if (!lastWasAgent) cur = mutableListOf(); cur.add(v.lowercase(Locale.ROOT)); groups.getOrPut(v.lowercase(Locale.ROOT)) { mutableListOf() }; lastWasAgent = true }
                    "allow", "disallow" -> { lastWasAgent = false; if (v.isNotEmpty() || k == "allow") cur.forEach { a -> groups.getOrPut(a) { mutableListOf() }.add((k == "allow") to v) } }
                    else -> if (k.isNotEmpty()) lastWasAgent = false
                }
            }
            val g = groups.entries.firstOrNull { it.key != "*" && agent.startsWith(it.key) }?.value ?: groups["*"] ?: return ALL
            val rs = g.filter { it.second.isNotEmpty() }
            return DmRobots(rs.map { (a, p) -> a to Regex(fixDollar(p)) }, rs.map { it.second.length })
        }

        private fun fixDollar(p: String): String {
            val end = p.endsWith("$")
            val body = if (end) p.dropLast(1) else p
            return "^" + body.split('*').joinToString(".*") { Regex.escape(it) } + if (end) "$" else ""
        }
    }
}

/** פרויקט סריקה (נשמר — אפשר להריץ שוב ולקבל רק את מה שחדש) */
data class DmCrawlJob(
    val id: String, val start: String, val depth: Int = 1, val sameHost: Boolean = true, val exts: Set<String> = emptySet(),
    val minKb: Long = 0, val maxMb: Long = 0, val seen: List<String> = emptyList(),
)

object DmCrawl {
    const val MAX_FILES = 500
    const val MAX_PAGES = 150
    const val DELAY_MS = 1000L
    val PRESETS = mapOf(
        "video" to setOf("mp4", "mkv", "webm", "mov", "avi", "m4v"), "audio" to setOf("mp3", "m4a", "flac", "wav", "ogg", "opus", "aac"),
        "doc" to setOf("pdf", "epub", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"), "archive" to setOf("zip", "rar", "7z", "tar", "gz", "iso"),
        "image" to setOf("jpg", "jpeg", "png", "gif", "webp"), "apk" to setOf("apk"),
    )
    private val PAGE_EXT = setOf("", "html", "htm", "php", "asp", "aspx", "jsp", "shtml", "xhtml", "cgi")
    private val HREF = Regex("""href\s*=\s*(["'])(.*?)\1""", setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL))

    data class Page(val url: String, val html: String?)
    data class Found(val url: String, val name: String, val ext: String, val from: String)

    fun extOf(u: String) = DmName.ext(DmName.fromUrl(u)).lowercase(Locale.ROOT)

    /** הקישורים לדפים אחרים (לא קבצים) */
    fun pages(html: String, base: String): List<String> {
        val root = runCatching { URL(base) }.getOrNull() ?: return emptyList()
        return HREF.findAll(html).mapNotNull { m ->
            val r = m.groupValues[2].replace("&amp;", "&").trim()
            if (r.isEmpty() || r.startsWith("#") || r.startsWith("javascript:", true) || r.startsWith("mailto:", true)) return@mapNotNull null
            val u = runCatching { URL(root, r) }.getOrNull() ?: return@mapNotNull null
            if (u.protocol != "http" && u.protocol != "https") return@mapNotNull null
            val s = u.toString().substringBefore('#')
            if (extOf(s) in PAGE_EXT) s else null
        }.distinct().take(MAX_PAGES * 4).toList()
    }

    /**
     * הסריקה עצמה (BFS, דף אחרי דף עם השהיה). fetch = הורדת דף (null = לא דף / תקלה), robots = לפי אתר.
     * עומק 1 = רק הקבצים בדף ההתחלה. sameHost=false — אתרים אחרים רק לקבצים, לא לסריקה פנימה.
     */
    fun run(job: DmCrawlJob, fetch: (String) -> Page?, robots: (String) -> DmRobots, sleep: (Long) -> Unit, stop: () -> Boolean,
            onFound: (Found) -> Unit, onPage: (Int) -> Unit = {}): List<Found> {
        val host0 = DmLink.host(job.start)
        val seenPages = HashSet<String>(); val seenFiles = HashSet<String>(job.seen)
        val out = ArrayList<Found>()
        val queue = ArrayDeque<Pair<String, Int>>().apply { add(job.start to 1) }
        var pages = 0
        while (queue.isNotEmpty() && !stop() && out.size < MAX_FILES && pages < MAX_PAGES) {
            val (u, d) = queue.removeFirst()
            if (!seenPages.add(u)) continue
            val host = DmLink.host(u)
            if (job.sameHost && host != host0) continue
            val path = runCatching { URL(u).let { (it.path.ifEmpty { "/" }) + (it.query?.let { q -> "?$q" } ?: "") } }.getOrDefault("/")
            if (!robots(host).allowed(path)) continue
            if (pages > 0) sleep(DELAY_MS)
            val p = fetch(u) ?: continue
            pages++; onPage(pages)
            val html = p.html ?: continue
            for (l in DmPageLinks.extract(html, p.url)) {
                if (out.size >= MAX_FILES) break
                if (job.exts.isNotEmpty() && l.ext.lowercase(Locale.ROOT) !in job.exts) continue
                if (job.sameHost && DmLink.host(l.url) != host0) continue
                if (!seenFiles.add(l.url)) continue
                val f = Found(l.url, l.name, l.ext.lowercase(Locale.ROOT), p.url)
                out.add(f); onFound(f)
            }
            if (d < job.depth) pages(html, p.url).forEach { n ->
                if (n !in seenPages && (DmLink.host(n) == host0)) queue.add(n to d + 1)
            }
        }
        return out
    }

    fun parseJobs(s: String?): List<DmCrawlJob> {
        val a = runCatching { JSONArray(s ?: "") }.getOrNull() ?: return emptyList()
        return (0 until minOf(a.length(), 30)).mapNotNull { i ->
            val o = a.optJSONObject(i) ?: return@mapNotNull null
            val st = o.optString("s"); if (!st.startsWith("http")) return@mapNotNull null
            val ex = o.optString("x").split(',').map { it.trim().lowercase(Locale.ROOT) }.filter { it.matches(Regex("[a-z0-9]{1,8}")) }.toSet()
            val sn = o.optJSONArray("sn")
            DmCrawlJob(o.optString("id").take(16), st, o.optInt("d", 1).coerceIn(1, 3), o.optBoolean("h", true), ex,
                o.optLong("mn").coerceAtLeast(0), o.optLong("mx").coerceAtLeast(0),
                if (sn == null) emptyList() else (0 until sn.length()).map { sn.optString(it) }.takeLast(2000))
        }
    }

    fun dumpJobs(js: List<DmCrawlJob>): String = JSONArray().also { a ->
        js.take(30).forEach { j ->
            a.put(JSONObject().put("id", j.id).put("s", j.start).put("d", j.depth).put("h", j.sameHost).put("x", j.exts.joinToString(","))
                .put("mn", j.minKb).put("mx", j.maxMb).put("sn", JSONArray(j.seen.takeLast(2000))))
        }
    }.toString()

    /** סינון לפי גודל אחרי בדיקה (0 = בלי גבול). size < 0 = לא ידוע → עובר */
    fun sizeOk(job: DmCrawlJob, size: Long): Boolean = size < 0 || ((job.minKb <= 0 || size >= job.minKb * 1024) && (job.maxMb <= 0 || size <= job.maxMb * 1024 * 1024))
}
