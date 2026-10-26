package io.github.yishaiguedj1.snowball

import org.json.JSONArray
import org.json.JSONObject
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * 22/10/2026 (בקשת המשתמש: "כל ההורדות תמיד מקומית למכשיר"): הסיכום של `yt-dlp -J` — עותק של
 * translator/fetchurl.py ‏(summarize, options, recommended, best_audio, best_video, subs_list, err_code, selector),
 * כדי שהטלפון יציג בדיוק את אותן איכויות שהשרת הציג. טהור (נבדק ב־JVM מול הפלט של הפייתון — DlProbeTest).
 * שינוי באחד = גם בשני.
 */
object DlProbe {
    const val URL_MAX = 2048
    const val TITLE_MAX = 200
    const val CH_MAX = 30
    const val SUB_MAX = 40
    const val FMT_MAX = 60
    const val DEFAULT_H = 1080

    private val VC = listOf("av01" to "av1", "vp09" to "vp9", "vp9" to "vp9", "vp8" to "vp8", "avc" to "h264", "h264" to "h264",
        "hev" to "h265", "hvc" to "h265", "h265" to "h265")
    private val AC = listOf("opus" to "opus", "mp4a" to "aac", "aac" to "aac", "mp3" to "mp3", "vorbis" to "vorbis", "ac-3" to "ac3",
        "ec-3" to "eac3", "flac" to "flac")
    private val V_RANK = mapOf("av1" to 4, "vp9" to 3, "h265" to 3, "h264" to 2, "vp8" to 1)
    private val A_RANK = mapOf("opus" to 3, "flac" to 3, "aac" to 2, "eac3" to 2, "ac3" to 1, "vorbis" to 1, "mp3" to 1)

    data class Row(val id: String, val k: String, val h: Int, val fps: Int, val c: String, val ac: String, val hdr: Int,
                   val sz: Long, val br: Int, val lang: String, val orig: Int, val m3u8: Int)

    data class Opt(val h: Int, val v: String, val a: String, val c: String, val ac: String, val fps: Int, val hdr: Int, val sz: Long)

    private fun fam(codec: Any?, table: List<Pair<String, String>>): String {
        val c = str(codec).lowercase()
        if (c.isEmpty() || c == "none") return ""
        for ((pre, name) in table) if (c.startsWith(pre)) return name
        return "other"
    }

    /** null/NULL של org.json → "" (כמו str(x or '') בפייתון) */
    private fun str(v: Any?): String = if (v == null || v == JSONObject.NULL) "" else v.toString()

    private fun num(v: Any?): Double? = when (v) {
        is Number -> v.toDouble()
        else -> null
    }

    /** round של פייתון 3 = עיגול בנקאי (חצי לזוגי) */
    fun pyRound(x: Double): Int = Math.rint(x).toInt()

    private fun size(f: JSONObject, dur: Double): Long {
        for (k in listOf("filesize", "filesize_approx")) {
            val v = num(f.opt(k))
            if (v != null && v > 0) return v.toLong()
        }
        val tbr0 = num(f.opt("tbr"))
        val tbr = if (tbr0 != null && tbr0 != 0.0) tbr0 else ((num(f.opt("vbr")) ?: 0.0) + (num(f.opt("abr")) ?: 0.0))
        if (tbr > 0 && dur > 0) return (tbr * 125 * dur).toLong()
        return 0
    }

    private val CTRL = Regex("[\\u0000-\\u001f\\u007f\\u202a-\\u202e\\u2066-\\u2069]")
    // \s של פייתון = יוניקוד. בלי דגל U: אנדרואיד (ICU) לא מכיר את הדגל — Regex נזרק בטעינת המחלקה, ו־Studio קרס
    // מיד בפתיחת חלון ההורדה (23/10/2026). רשימה מפורשת = אותה תוצאה ב־JVM (הבדיקות) ובאנדרואיד
    private val WS = Regex("[\\t\\n\\u000b\\f\\r\\u001c-\\u001f \\u0085\\u00a0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000]+")
    fun clean(s: Any?, n: Int): String {
        val t = WS.replace(CTRL.replace(str(s), " "), " ").trim()
        return if (t.length > n) t.substring(0, n) else t
    }

    private val FID = Regex("^[\\p{L}\\p{N}_.+-]{1,60}$")   // \w של פייתון, בלי דגל U

    fun rows(info: JSONObject): List<Row> {
        val dur = num(info.opt("duration")) ?: 0.0
        val lang0 = str(info.opt("language")).lowercase()
        val out = ArrayList<Row>()
        val fs = info.optJSONArray("formats") ?: return out
        for (i in 0 until fs.length()) {
            val f = fs.optJSONObject(i) ?: continue
            val fid = str(f.opt("format_id"))
            if (fid.isEmpty() || !FID.matches(fid)) continue
            val note = str(f.opt("format_note")).lowercase()
            if (f.optBoolean("has_drm", false) || "storyboard" in note || str(f.opt("ext")) == "mhtml") continue
            if ("drc" in note || fid.endsWith("-drc")) continue
            val rv = f.opt("vcodec"); val ra = f.opt("acodec")
            val vc = if (str(rv) == "none") "" else fam(rv, VC).ifEmpty { "other" }
            val ac = if (str(ra) == "none") "" else fam(ra, AC).ifEmpty { "other" }
            val hv = f.opt("height")
            val h = if (hv is Int || hv is Long) (hv as Number).toInt() else 0
            if (vc.isEmpty() && ac.isEmpty()) continue
            val k = if (vc.isNotEmpty() && ac.isNotEmpty()) "av" else if (vc.isNotEmpty()) "v" else "a"
            val lang = str(f.opt("language")).lowercase().take(10)
            val dr = str(f.opt("dynamic_range")).ifEmpty { "SDR" }.uppercase()
            val br = if (k == "a") pyRound(num(f.opt("abr")) ?: 0.0) else pyRound(num(f.opt("tbr")) ?: 0.0)
            out.add(Row(fid, k, if (vc.isNotEmpty()) h else 0, if (vc.isNotEmpty()) pyRound(num(f.opt("fps")) ?: 0.0) else 0,
                vc, ac, if (dr != "SDR" && dr.isNotEmpty()) 1 else 0, size(f, dur), br, lang,
                if ("original" in note || (lang0.isNotEmpty() && lang == lang0)) 1 else 0,
                if ("m3u8" in str(f.opt("protocol"))) 1 else 0))
        }
        return out
    }

    fun bestAudio(rows: List<Row>): Row? {
        val aud = rows.filter { it.k == "a" }
        if (aud.isEmpty()) return null
        val hasOrig = aud.any { it.orig == 1 }
        return maxBy(aud, compareBy<Row>({ if (hasOrig) it.orig else 0 },
            { (A_RANK[it.ac] ?: 0) * 64 + min(it.br, 400) / 8.0 }, { -it.m3u8 }))
    }

    fun bestVideo(rows: List<Row>, h: Int): Row? {
        val vid = rows.filter { (it.k == "v" || it.k == "av") && it.h != 0 }
        if (vid.isEmpty()) return null
        var at = vid.filter { it.h == h }.ifEmpty { vid.filter { it.h < h } }
        if (at.isEmpty()) at = listOf(vid.minBy { it.h })
        val top = at.maxOf { it.h }
        at = at.filter { it.h == top }
        return maxBy(at, compareBy<Row>({ 1 - it.hdr }, { if (it.k == "v") 1 else 0 }, { V_RANK[it.c] ?: 0 }, { it.fps }, { it.br }, { -it.m3u8 }))
    }

    /** max של פייתון: הראשון מבין השווים */
    private fun <T> maxBy(xs: List<T>, cmp: Comparator<T>): T {
        var best = xs[0]
        for (i in 1 until xs.size) if (cmp.compare(xs[i], best) > 0) best = xs[i]
        return best
    }

    fun options(rows: List<Row>): List<Opt> {
        val a = bestAudio(rows)
        val out = ArrayList<Opt>()
        val seen = HashSet<String>()
        val heights = rows.filter { (it.k == "v" || it.k == "av") && it.h != 0 }.map { it.h }.toSortedSet().reversed()
        for (h in heights) {
            val v = bestVideo(rows, h) ?: continue
            if (v.id in seen) continue
            seen.add(v.id)
            val needA = v.k == "v" && a != null
            out.add(Opt(v.h, v.id, if (needA) a!!.id else "", v.c, if (needA) a!!.ac else v.ac, v.fps, v.hdr, v.sz + (if (needA) a!!.sz else 0)))
        }
        if (out.isEmpty()) {
            val vs = rows.filter { it.k == "v" || it.k == "av" }
            if (vs.isNotEmpty()) {
                val v = maxBy(vs, compareBy<Row>({ if (it.k == "av") 1 else 0 }, { it.br }, { it.sz }))
                val needA = v.k == "v" && a != null
                out.add(Opt(0, v.id, if (needA) a!!.id else "", v.c, if (needA) a!!.ac else v.ac, v.fps, v.hdr, v.sz + (if (needA) a!!.sz else 0)))
            }
        }
        return out
    }

    fun recommended(opts: List<Opt>): Opt? {
        if (opts.isEmpty()) return null
        val below = opts.filter { it.h <= DEFAULT_H }
        return if (below.isNotEmpty()) maxBy(below, compareBy { it.h }) else opts.minBy { it.h }
    }

    private val LANG_RE = Regex("^[A-Za-z]{2,3}([-_][A-Za-z0-9]{2,8}){0,2}$")

    fun subsList(info: JSONObject): JSONArray {
        val out = JSONArray()
        val lang0 = str(info.opt("language")).lowercase()
        for ((auto, key) in listOf(0 to "subtitles", 1 to "automatic_captions")) {
            val m = info.optJSONObject(key) ?: continue
            val it = m.keys()
            while (it.hasNext()) {
                val l = it.next()
                if (!LANG_RE.matches(l) || l.lowercase() == "live_chat") continue
                if (auto == 1 && !(l.lowercase() == lang0 || l.lowercase().endsWith("-orig"))) continue
                val tr = m.optJSONArray(l)
                val name = if (tr != null && tr.length() > 0) clean((tr.optJSONObject(0) ?: JSONObject()).opt("name"), 60) else ""
                out.put(JSONObject().put("l", l.take(20)).put("n", name).put("a", auto))
                if (out.length() >= SUB_MAX) return out
            }
        }
        return out
    }

    fun thumbUrl(info: JSONObject): String {
        var best = ""; var bd = 1e9
        val ts = info.optJSONArray("thumbnails")
        if (ts != null) for (i in 0 until ts.length()) {
            val t = ts.optJSONObject(i) ?: continue
            val u = str(t.opt("url")); val w = (num(t.opt("width")) ?: 0.0)
            if (!(u.startsWith("https://") || u.startsWith("http://")) || (u.endsWith(".webp") && w == 0.0)) continue
            val d = abs((if (w == 0.0) 480.0 else w) - 480)
            if (d < bd) { best = u; bd = d }
        }
        val u = best.ifEmpty { str(info.opt("thumbnail")) }
        return if ((u.startsWith("https://") || u.startsWith("http://")) && u.length <= URL_MAX) u else ""
    }

    private val UD = Regex("^\\d{8}$")
    private val LIVE = setOf("is_live", "is_upcoming", "post_live")

    /** הסיכום — אותה צורה של fetchurl.summarize (בלי _th; התמונה ב־th אחרי הקטנה). כשל → IllegalArgumentException(קוד) */
    fun summarize(info: JSONObject): JSONObject {
        val type = str(info.opt("_type"))
        if ((type == "playlist" || type == "multi_video") && info.optJSONArray("formats").let { it == null || it.length() == 0 })
            throw IllegalArgumentException("playlist")
        if (info.optBoolean("is_live", false) || str(info.opt("live_status")) in LIVE) throw IllegalArgumentException("live")
        val rows = rows(info)
        if (rows.isEmpty()) throw IllegalArgumentException(if (info.optBoolean("_has_drm", false)) "drm" else "no_video")
        val dur = pyRound(num(info.opt("duration")) ?: 0.0)
        val opts = options(rows)
        val rec = recommended(opts)
        val a = bestAudio(rows)
        val ch = JSONArray()
        val cs = info.optJSONArray("chapters")
        if (cs != null) for (i in 0 until min(cs.length(), CH_MAX)) {
            val c = cs.optJSONObject(i) ?: continue
            val st = num(c.opt("start_time")) ?: (if (c.isNull("start_time")) 0.0 else continue)
            val t = clean(c.opt("title"), 80)
            if (t.isNotEmpty()) ch.put(JSONArray().put(max(0, pyRound(st))).put(t))
        }
        val ud = str(info.opt("upload_date"))
        val q = JSONArray()
        for (o in opts) q.put(JSONObject().put("h", o.h).put("v", o.v).put("a", o.a).put("c", o.c).put("ac", o.ac)
            .put("fps", o.fps).put("hdr", o.hdr).put("sz", o.sz))
        val fm = JSONArray()
        val sorted = rows.sortedWith(compareBy<Row>({ -it.h }, { if (it.k != "v") 1 else 0 }, { -(V_RANK[it.c] ?: 0) }, { -it.br }))
        for (r in sorted.take(FMT_MAX)) fm.put(JSONObject().put("id", r.id).put("k", r.k).put("h", r.h).put("fps", r.fps)
            .put("c", r.c).put("ac", r.ac).put("hdr", r.hdr).put("sz", r.sz).put("br", r.br))
        val title = clean(info.opt("title").let { if (str(it).isEmpty()) info.opt("fulltitle") else it }, TITLE_MAX).ifEmpty { "video" }
        val up = info.opt("uploader").let { if (str(it).isEmpty()) info.opt("channel") else it }
        val ex = info.opt("extractor_key").let { if (str(it).isEmpty()) info.opt("extractor") else it }
        return JSONObject()
            .put("t", title)
            .put("u", str(info.opt("webpage_url")).take(URL_MAX))
            .put("s", clean(ex, 40))
            .put("up", clean(up, 100))
            .put("d", dur)
            .put("ud", if (UD.matches(ud)) ud else "")
            .put("lang", str(info.opt("language")).take(10))
            .put("ch", ch)
            .put("sub", subsList(info))
            .put("q", q)
            .put("rec", rec?.h ?: 0)
            .put("ao", if (a != null) JSONObject().put("id", a.id).put("ac", a.ac).put("br", a.br).put("sz", a.sz) else JSONObject.NULL)
            .put("fm", fm)
            .put("drm", if (info.optBoolean("_has_drm", false)) 1 else 0)
    }

    /** הקובץ שירד: הגדול ביותר בתיקייה של ההורדה, בלי קבצי ביניים של yt-dlp (חלקים, וידאו/קול לפני האיחוד, כתוביות) */
    fun outFile(dir: java.io.File): java.io.File? = dir.listFiles()?.filter { f ->
        val n = f.name.lowercase()
        f.isFile && f.length() > 0 && !Regex("\\.(part|ytdl|temp|tmp|srt|vtt|ass|json|jpg|jpeg|png|webp)$|\\.part-frag\\d+$|\\.f[0-9a-z_-]+\\.[a-z0-9]+$").containsMatchIn(n)
    }?.maxByOrNull { it.length() }

    /** הבחירה מהאתר → בורר פורמט של yt-dlp (= fetchurl.selector) */
    fun selector(v0: String?, a0: String?, h0: Int?): String {
        val v = if (FID.matches(v0 ?: "")) v0!! else ""
        val a = if (FID.matches(a0 ?: "")) a0!! else ""
        val h = if (h0 != null && h0 in 100..4320) h0 else DEFAULT_H
        val exact = if (v.isNotEmpty() && a.isNotEmpty()) "$v+$a" else v
        val fall = "bv*[height<=$h]+ba/b[height<=$h]/bv*+ba/b"
        return (if (exact.isNotEmpty()) "$exact/" else "") + fall
    }

    // שגיאה של yt-dlp → קוד קבוע (= fetchurl.ERR_RULES, אותו סדר)
    private val ERR = listOf(
        "drm" to Regex("\\bDRM\\b|drm protected|widevine", RegexOption.IGNORE_CASE),
        "blocked" to Regex("confirm you.?re not a bot|sign in to confirm|HTTP Error 429|too many requests|po.?token|blocked", RegexOption.IGNORE_CASE),
        "login" to Regex("only works when logged.in|private video|members.only|join this channel|login required|log in|sign in to view|age.restricted|confirm your age|requires authentication", RegexOption.IGNORE_CASE),
        "geo" to Regex("available in your country|geo.?restrict|geoblock", RegexOption.IGNORE_CASE),
        "live" to Regex("live event will begin|is live|premieres in|this live", RegexOption.IGNORE_CASE),
        "gone" to Regex("video unavailable|has been removed|does not exist|HTTP Error 404|HTTP Error 410|no longer available|account.*terminated", RegexOption.IGNORE_CASE),
        "unsupported" to Regex("unsupported url|no video formats found|unable to extract", RegexOption.IGNORE_CASE),
        "timeout" to Regex("timed out|timeout", RegexOption.IGNORE_CASE),
        "net" to Regex("unable to download webpage|connection (reset|refused)|name or service not known|temporary failure in name resolution|network is unreachable|ssl", RegexOption.IGNORE_CASE),
    )

    fun errCode(text: String?): String {
        val t = text ?: ""
        for ((code, rx) in ERR) if (rx.containsMatchIn(t)) return code
        return "fail"
    }

    /** קישור ראשון מטקסט ששותף (= fetchurl.extract_url) */
    fun extractUrl(text: String?): String {
        val m = Regex("https?://[^\\s<>\"'\\u200e\\u200f]+").find(text ?: "") ?: return ""
        return m.value.trimEnd('.', ',', ';', ':', '!', '?', ')', ']', '}', '»')
    }

    /**
     * 23/10/2026: כתובות חלופיות כשהבדיקה לא מצאה סרטון. Chrome מסתיר את "www." בשורת הכתובת, והבועה שולחת
     * imdb.com/video/… — המחלץ של IMDb ב־yt-dlp מכיר רק www/m. לכן: שם אתר בלי תת־דומיין → גם www.;
     * תת־דומיין (buffett.cnbc.com) → גם www של האתר הראשי (CNBC מכיר רק www.cnbc.com). רק http(s), לכל היותר 2.
     */
    fun altUrls(url: String): List<String> {
        val m = Regex("^(https?://)([^/:?#]+)(.*)$", RegexOption.IGNORE_CASE).matchEntire(url) ?: return emptyList()
        val (sch, host0, rest) = m.destructured
        val host = host0.lowercase()
        if (host.startsWith("www.") || host.startsWith("m.") || Regex("^[\\d.]+$").matches(host)) return emptyList()
        val parts = host.split('.')
        if (parts.size < 2 || parts.any { it.isEmpty() }) return emptyList()
        val sld = parts.size >= 3 && parts[parts.size - 1].length == 2 && parts[parts.size - 2] in SLD
        val base = if (sld) 3 else 2                       // כמה תוויות הן "שם האתר" (example.co.il = 3)
        return when {
            parts.size == base -> listOf("${sch}www.$host$rest")
            parts.size == base + 1 -> listOf("${sch}www.${parts.drop(1).joinToString(".")}$rest")
            else -> emptyList()
        }
    }
    private val SLD = setOf("co", "com", "org", "net", "ac", "gov", "edu")

    /** Referer מהאתר (דפדפן הציד) → רק http(s) תקין, אחרת "" (= fetchurl.ref_ok) */
    fun refOk(r0: String?): String {
        val r = (r0 ?: "").trim()
        return if (r.length <= 2048 && Regex("^https?://[^\\s\\u0000-\\u001f\\u007f]+$").matches(r)) r else ""
    }
}
