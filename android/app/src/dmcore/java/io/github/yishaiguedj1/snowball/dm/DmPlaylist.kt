package io.github.yishaiguedj1.snowball.dm

import org.json.JSONObject

/**
 * רשימת השמעה (24/10/2026 — כמו ב־1DM/Seal): yt-dlp ‎--flat-playlist -J‎ → כותרת + הסרטונים (בלי בדיקה של כל אחד —
 * כל סרטון נבדק כשההורדה שלו מתחילה). טהור.
 */
object DmPlaylist {
    const val MAX = 500
    data class Entry(val url: String, val title: String, val dur: Int)
    data class Playlist(val title: String, val up: String, val entries: List<Entry>)

    private val YT_ID = Regex("^[A-Za-z0-9_-]{11}$")

    fun parse(o: JSONObject?): Playlist? {
        o ?: return null
        val type = o.optString("_type")
        if (type != "playlist" && type != "multi_video") return null
        val arr = o.optJSONArray("entries") ?: return null
        val out = ArrayList<Entry>()
        val seen = HashSet<String>()
        for (i in 0 until arr.length()) {
            val e = arr.optJSONObject(i) ?: continue
            val url = entryUrl(e)
            if (url.isEmpty() || !seen.add(url)) continue
            val t = e.optString("title").trim()
            if (t == "[Private video]" || t == "[Deleted video]") continue
            out += Entry(url, t.take(200).ifEmpty { url }, e.optDouble("duration", 0.0).toInt().coerceAtLeast(0))
            if (out.size >= MAX) break
        }
        if (out.isEmpty()) return null
        return Playlist(o.optString("title").take(200), o.optString("uploader", o.optString("channel")).take(100), out)
    }

    /** כתובת הסרטון: url מלא אם יש, אחרת לפי ה־ie (יוטיוב — מזהה בן 11 תווים) */
    fun entryUrl(e: JSONObject): String {
        val u = e.optString("url")
        if (u.startsWith("https://") || u.startsWith("http://")) return u
        val id = e.optString("id").ifEmpty { u }
        val ie = e.optString("ie_key", e.optString("ie"))
        if ((ie.equals("Youtube", true) || ie.isEmpty()) && YT_ID.matches(id)) return "https://www.youtube.com/watch?v=$id"
        return ""
    }

    /** קישור לסרטון ששייך לרשימה (watch?v=…&list=…) → כתובת הרשימה עצמה; אחרת "" */
    fun listUrl(url: String): String {
        val m = Regex("[?&]list=([A-Za-z0-9_-]{10,64})").find(url) ?: return ""
        if (!Regex("^https?://([a-z0-9-]+\\.)*(youtube\\.com|youtu\\.be)/", RegexOption.IGNORE_CASE).containsMatchIn(url)) return ""
        return "https://www.youtube.com/playlist?list=" + m.groupValues[1]
    }

    /** בורר הפורמט לסרטון מרשימה (בלי בדיקה מראש): עד הגובה שנבחר; "תואם" — H.264 + AAC קודם */
    fun format(height: Int, audio: Boolean, codec: String): String {
        if (audio) return "ba/b"
        val h = if (height in 100..4320) height else 4320
        val base = "bv*[height<=$h]+ba/b[height<=$h]/bv*+ba/b"
        return if (codec == DmCodec.COMPAT) "bv*[height<=$h][vcodec^=avc1]+ba[acodec^=mp4a]/b[height<=$h][vcodec^=avc1]/$base" else base
    }
}
